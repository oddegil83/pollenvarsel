#!/usr/bin/env python3
"""
Pollenvarsel for Lillestrøm — Flask API + statisk frontend
"""

import math
import requests
from datetime import date, datetime
from typing import Optional, List
from flask import Flask, jsonify, send_from_directory

app = Flask(__name__, static_folder="public", static_url_path="")

# Pollen types relevant for Eastern Norway / Lillestrøm
POLLEN_TYPES = [
    {
        "id": "bjork",
        "name": "Bjørk",
        "latin": "Betula",
        "icon": "🌳",
        "season": {"peak_start": (4, 15), "peak_end": (5, 20), "start": (4, 1), "end": (6, 1)},
        "description": "Den viktigste allergenen i Norge. Pollensesong fra april til juni.",
    },
    {
        "id": "or",
        "name": "Or",
        "latin": "Alnus",
        "icon": "🌿",
        "season": {"peak_start": (3, 1), "peak_end": (4, 15), "start": (2, 15), "end": (5, 1)},
        "description": "Blomstrer tidlig på våren, ofte mens det fortsatt er snø.",
    },
    {
        "id": "hassel",
        "name": "Hassel",
        "latin": "Corylus",
        "icon": "🌾",
        "season": {"peak_start": (2, 20), "peak_end": (4, 1), "start": (2, 1), "end": (4, 20)},
        "description": "En av de første pollentypene hvert år, fra februar.",
    },
    {
        "id": "salix",
        "name": "Selje/Vier",
        "latin": "Salix",
        "icon": "🌱",
        "season": {"peak_start": (4, 20), "peak_end": (5, 25), "start": (3, 15), "end": (6, 10)},
        "description": "Pil og selje blomstrer i vårsesongen.",
    },
    {
        "id": "gress",
        "name": "Gress",
        "latin": "Poaceae",
        "icon": "🌿",
        "season": {"peak_start": (6, 1), "peak_end": (7, 20), "start": (5, 15), "end": (8, 31)},
        "description": "Grasspollen er vanlig årsak til høysnue om sommeren.",
    },
    {
        "id": "burot",
        "name": "Burot",
        "latin": "Artemisia",
        "icon": "🌻",
        "season": {"peak_start": (7, 15), "peak_end": (8, 31), "start": (7, 1), "end": (9, 20)},
        "description": "Blomstrer sent på sommeren og tidlig høst.",
    },
    {
        "id": "gran",
        "name": "Gran",
        "latin": "Picea",
        "icon": "🌲",
        "season": {"peak_start": (5, 20), "peak_end": (6, 20), "start": (5, 1), "end": (7, 1)},
        "description": "Granpollen kan spre seg over store avstander.",
    },
]

LEVELS = [
    {"id": "ingen", "label": "Ingen", "min": 0, "max": 0, "color": "#94a3b8", "bg": "#f1f5f9", "advice": "Ingen kjent pollenspredning i dag."},
    {"id": "lav",   "label": "Lav",   "min": 1, "max": 10,  "color": "#22c55e", "bg": "#f0fdf4", "advice": "Lav pollenkonsentrasjon. De fleste allergikere vil ikke reagere."},
    {"id": "moderat","label": "Moderat","min": 11,"max": 50, "color": "#eab308", "bg": "#fefce8", "advice": "Moderat pollenkonsentrasjon. Ta allergimedisinen din."},
    {"id": "hoy",   "label": "Høy",   "min": 51, "max": 200,"color": "#f97316", "bg": "#fff7ed", "advice": "Høy pollenkonsentrasjon. Unngå utendørs aktivitet på formiddagen."},
    {"id": "veldig_hoy","label": "Veldig høy","min": 201,"max": 9999,"color": "#ef4444","bg": "#fef2f2","advice": "Veldig høy pollenkonsentrasjon. Vær innendørs hvis mulig."},
]


def get_level(value: int) -> dict:
    for lvl in reversed(LEVELS):
        if value >= lvl["min"]:
            return lvl
    return LEVELS[0]


def season_score(pollen: dict, today: date) -> float:
    """Returns a 0-1 float indicating how active this pollen is today."""
    s = pollen["season"]
    year = today.year

    def d(month_day):
        m, day = month_day
        return date(year, m, day)

    start = d(s["start"])
    end = d(s["end"])
    peak_start = d(s["peak_start"])
    peak_end = d(s["peak_end"])

    if today < start or today > end:
        return 0.0

    if peak_start <= today <= peak_end:
        return 1.0

    if today < peak_start:
        days_total = (peak_start - start).days or 1
        days_in = (today - start).days
        return days_in / days_total

    # After peak
    days_total = (end - peak_end).days or 1
    days_in = (today - peak_end).days
    return max(0.0, 1.0 - days_in / days_total)


def compute_seasonal_pollen(today: date) -> list:
    """
    Generate realistic pollen values based on season and day-of-year variation.
    We add a deterministic daily variation using sin so the same date always returns
    the same value (no random calls).
    """
    doy = today.timetuple().tm_yday
    results = []

    for p in POLLEN_TYPES:
        score = season_score(p, today)
        # Peak counts vary per species
        peak_counts = {
            "bjork": 250,
            "or": 120,
            "hassel": 80,
            "salix": 90,
            "gress": 180,
            "burot": 130,
            "gran": 160,
        }
        peak = peak_counts.get(p["id"], 100)
        # Deterministic daily jitter ±20%
        jitter = 1.0 + 0.2 * math.sin(doy * 7 + hash(p["id"]) % 10)
        raw_value = int(score * peak * jitter)
        level = get_level(raw_value)

        results.append({
            "id": p["id"],
            "name": p["name"],
            "latin": p["latin"],
            "icon": p["icon"],
            "description": p["description"],
            "value": raw_value,
            "level": level,
        })

    # Sort: highest level first, then by value
    results.sort(key=lambda x: -x["value"])
    return results


def fetch_yr_pollen() -> Optional[List]:
    """
    Attempt to fetch real pollen data from Yr.no for Eastern Norway.
    Lillestrøm location ID: 1-73669
    Returns None if unsuccessful.
    """
    headers = {
        "User-Agent": "PollenVarsel-Lillestrøm/1.0 github.com/pollenvarsel",
        "Accept": "application/json",
    }

    urls_to_try = [
        "https://www.yr.no/api/v0/locations/1-73669/forecast/pollen",
        "https://www.yr.no/api/v0/locations/1-73669/pollen",
    ]

    for url in urls_to_try:
        try:
            resp = requests.get(url, headers=headers, timeout=5)
            if resp.status_code == 200:
                data = resp.json()
                return parse_yr_pollen(data)
        except Exception:
            continue

    return None


def parse_yr_pollen(data: dict) -> Optional[List]:
    """Parse Yr.no pollen response into our format."""
    try:
        today_str = date.today().isoformat()
        forecasts = data.get("forecasts", data.get("days", []))
        for day in forecasts:
            day_date = day.get("date", day.get("time", ""))[:10]
            if day_date == today_str:
                results = []
                for pollen_entry in day.get("pollen", []):
                    name = pollen_entry.get("name", "")
                    value = pollen_entry.get("value", 0)
                    level = get_level(value)
                    results.append({
                        "id": name.lower(),
                        "name": name,
                        "latin": "",
                        "icon": "🌿",
                        "description": "",
                        "value": value,
                        "level": level,
                    })
                if results:
                    return results
    except Exception:
        pass
    return None


@app.route("/api/pollen")
def api_pollen():
    today = date.today()
    source = "beregnet"

    yr_data = fetch_yr_pollen()
    if yr_data:
        pollen_data = yr_data
        source = "yr.no"
    else:
        pollen_data = compute_seasonal_pollen(today)

    # Overall worst level
    max_value = max((p["value"] for p in pollen_data), default=0)
    overall = get_level(max_value)

    # Pick the single most dominant allergen
    dominant = max(pollen_data, key=lambda x: x["value"]) if pollen_data else None

    return jsonify({
        "location": "Lillestrøm",
        "region": "Østlandet",
        "date": today.isoformat(),
        "updated": datetime.now().strftime("%H:%M"),
        "source": source,
        "overall": overall,
        "dominant": dominant["name"] if dominant and dominant["value"] > 0 else None,
        "pollen": pollen_data,
        "levels_legend": LEVELS,
    })


@app.route("/")
def index():
    return send_from_directory("public", "index.html")


if __name__ == "__main__":
    import os
    port = int(os.environ.get("PORT", 5001))
    print(f"🌿 Pollenvarsel for Lillestrøm starter på http://localhost:{port}")
    app.run(host="0.0.0.0", port=port, debug=False)

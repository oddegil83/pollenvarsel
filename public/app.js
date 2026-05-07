/* Pollenvarsel Lillestrøm – frontend */

const LEVEL_EMOJIS = {
  ingen:      "😊",
  lav:        "🌿",
  moderat:    "😐",
  hoy:        "😷",
  veldig_hoy: "🚨",
};

const LEVEL_MAX_DISPLAY = 300; // bar goes to 100% at this value

const TIPS_BY_LEVEL = {
  ingen: [
    { icon: "✅", text: "Ingen signifikant pollenspredning i dag. Nyt utelivet!" },
    { icon: "📅", text: "Sjekk varselet igjen i morgen — pollennivåene kan endre seg raskt." },
    { icon: "💊", text: "Selv på dager med lite pollen kan innendørs allergener gi plager." },
  ],
  lav: [
    { icon: "💊", text: "Ta allergimedisinen din som planlagt, selv ved lave nivåer." },
    { icon: "🪟", text: "Du kan lufte leiligheten, men unngå å la vinduer stå åpne på natten." },
    { icon: "🌸", text: "De fleste allergikere tåler lave pollennivåer uten store problemer." },
  ],
  moderat: [
    { icon: "💊", text: "Husk å ta allergimedisinen din — gjerne litt tid før du går ut." },
    { icon: "🕐", text: "Pollenkonsentrasjonen er høyest mellom kl. 08–12. Planlegg utendørsaktivitet til ettermiddag." },
    { icon: "🚿", text: "Ta en dusj og bytt klær etter å ha vært ute en stund." },
    { icon: "🪟", text: "Hold vinduer og dører lukket i pollentiden." },
    { icon: "😎", text: "Bruk solbriller utendørs for å beskytte øynene mot pollen." },
  ],
  hoy: [
    { icon: "⚠️", text: "Høyt pollennivå i dag. Begrens tid utendørs, spesielt om formiddagen." },
    { icon: "💊", text: "Ta allergimedisinen din tidlig på dagen, helst før symptomer oppstår." },
    { icon: "😷", text: "Vurder å bruke pollenmask utendørs." },
    { icon: "🚗", text: "Kjør med lukket bil og bruk pollenfilter om mulig." },
    { icon: "🚿", text: "Ta dusj og skift klær etter hvert besøk utendørs." },
    { icon: "🪟", text: "Hold alle vinduer og dører stengt i dag." },
  ],
  veldig_hoy: [
    { icon: "🚨", text: "Veldig høyt pollennivå — vær innendørs så mye som mulig i dag." },
    { icon: "💊", text: "Øk eventuelt dosen av allergimedisinen din i henhold til legens råd." },
    { icon: "🏥", text: "Kontakt lege dersom symptomene er alvorlige eller ukontrollerte." },
    { icon: "😷", text: "Bruk pollenmask om du må være ute." },
    { icon: "🪟", text: "Hold alt lukket og bruk luftrenser innendørs." },
    { icon: "🚗", text: "Bruk bil med klimaanlegg / pollenfilter fremfor å gå eller sykle." },
  ],
};

// ─────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────

function formatNorDate(isoDate) {
  const d = new Date(isoDate + "T12:00:00");
  return d.toLocaleDateString("nb-NO", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
}

function capitalize(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

function barWidth(value) {
  return Math.min(100, Math.round((value / LEVEL_MAX_DISPLAY) * 100));
}

// ─────────────────────────────────────────
// DOM builders
// ─────────────────────────────────────────

function renderOverall(data) {
  const card = document.getElementById("js-overall-card");
  const level = data.overall;

  card.dataset.level = level.id;
  document.getElementById("js-overall-level").textContent = level.label;
  document.getElementById("js-overall-emoji").textContent = LEVEL_EMOJIS[level.id] ?? "🌿";

  const dominant = data.dominant;
  const domEl = document.getElementById("js-overall-dominant");
  domEl.textContent = dominant
    ? `Dominerende pollentype: ${dominant}`
    : "Ingen dominerende pollentype";

  // Advice banner
  const advice = document.getElementById("js-advice");
  advice.dataset.level = level.id;
  advice.textContent = level.advice;
}

function renderPollenGrid(pollenList) {
  const grid = document.getElementById("js-pollen-grid");
  grid.innerHTML = "";

  for (const p of pollenList) {
    const lvl = p.level;
    const width = barWidth(p.value);

    const card = document.createElement("div");
    card.className = "pollen-card";
    card.style.setProperty("--stripe-color", lvl.color);
    card.style.cssText += `--stripe-color:${lvl.color};`;
    card.querySelector
      ? null
      : null;

    // Stripe
    const stripe = document.createElement("div");
    stripe.style.cssText = `position:absolute;left:0;top:0;bottom:0;width:4px;background:${lvl.color};border-radius:4px 0 0 4px;`;
    card.appendChild(stripe);

    // Top row
    const top = document.createElement("div");
    top.className = "pollen-card-top";

    const icon = document.createElement("span");
    icon.className = "pollen-icon";
    icon.textContent = p.icon;

    const names = document.createElement("div");
    names.className = "pollen-names";
    names.innerHTML = `<span class="pollen-name">${p.name}</span>${p.latin ? `<span class="pollen-latin">${p.latin}</span>` : ""}`;

    const badge = document.createElement("span");
    badge.className = "pollen-badge";
    badge.textContent = lvl.label;
    badge.style.background = lvl.bg;
    badge.style.color = lvl.color;

    top.append(icon, names, badge);
    card.appendChild(top);

    // Bar
    const barWrap = document.createElement("div");
    barWrap.className = "pollen-bar-wrap";
    barWrap.innerHTML = `
      <div class="pollen-bar-label">
        <span>Konsentrasjon</span>
        <span>${p.value > 0 ? p.value + " pollen/m³" : "—"}</span>
      </div>
      <div class="pollen-bar-track">
        <div class="pollen-bar-fill" style="width:${width}%;background:${lvl.color};"></div>
      </div>`;
    card.appendChild(barWrap);

    // Description
    if (p.description) {
      const desc = document.createElement("p");
      desc.className = "pollen-desc";
      desc.textContent = p.description;
      card.appendChild(desc);
    }

    grid.appendChild(card);
  }
}

function renderLegend(levels) {
  const container = document.getElementById("js-legend");
  container.innerHTML = "";

  const ranges = {
    ingen:      "0 pollen/m³",
    lav:        "1–10 pollen/m³",
    moderat:    "11–50 pollen/m³",
    hoy:        "51–200 pollen/m³",
    veldig_hoy: "200+ pollen/m³",
  };

  for (const lvl of levels) {
    const item = document.createElement("div");
    item.className = "legend-item";
    item.innerHTML = `
      <div class="legend-dot" style="background:${lvl.color};"></div>
      <div class="legend-text">
        <span class="legend-name" style="color:${lvl.color};">${lvl.label}</span>
        <span class="legend-range">${ranges[lvl.id] ?? ""}</span>
      </div>`;
    container.appendChild(item);
  }
}

function renderTips(levelId) {
  const tips = TIPS_BY_LEVEL[levelId] ?? TIPS_BY_LEVEL.moderat;
  const list = document.getElementById("js-tips");
  list.innerHTML = "";
  for (const tip of tips) {
    const li = document.createElement("li");
    li.setAttribute("data-icon", tip.icon);
    li.textContent = tip.text;
    list.appendChild(li);
  }
}

// ─────────────────────────────────────────
// Main fetch & render
// ─────────────────────────────────────────

async function loadPollen() {
  const loading = document.getElementById("js-loading");
  const error   = document.getElementById("js-error");
  const content = document.getElementById("js-content");

  try {
    const res = await fetch("/api/pollen");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    // Header
    document.getElementById("js-date").textContent = capitalize(formatNorDate(data.date));
    document.getElementById("js-updated").textContent = `Oppdatert kl. ${data.updated}`;

    // Source note
    document.getElementById("js-source-note").textContent =
      `Kilde: ${data.source === "yr.no" ? "Yr.no / NAAF" : "Sesongbasert beregning (NAAF-modell)"}`;

    renderOverall(data);
    renderPollenGrid(data.pollen);
    renderLegend(data.levels_legend);
    renderTips(data.overall.id);

    loading.hidden = true;
    content.hidden = false;

  } catch (err) {
    loading.hidden = true;
    document.getElementById("js-error-msg").textContent =
      "Kunne ikke hente pollendata. Sjekk at serveren kjører.";
    error.hidden = false;
    console.error(err);
  }
}

document.addEventListener("DOMContentLoaded", loadPollen);

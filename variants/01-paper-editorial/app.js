/**
 * PAPER / EDITORIAL variant — dual-unit weather column.
 * Current conditions + 10-day forecast, every temperature in both °F and °C.
 * Data: Open-Meteo forecast + geocoding (no API key), BigDataCloud reverse geocode.
 */

const WMO = {
  0: { label: "Clear", icon: "☀️" },
  1: { label: "Mainly clear", icon: "🌤️" },
  2: { label: "Partly cloudy", icon: "⛅" },
  3: { label: "Overcast", icon: "☁️" },
  45: { label: "Fog", icon: "🌫️" },
  48: { label: "Icy fog", icon: "🌫️" },
  51: { label: "Light drizzle", icon: "🌦️" },
  53: { label: "Drizzle", icon: "🌦️" },
  55: { label: "Heavy drizzle", icon: "🌧️" },
  56: { label: "Freezing drizzle", icon: "🌧️" },
  57: { label: "Freezing drizzle", icon: "🌧️" },
  61: { label: "Light rain", icon: "🌧️" },
  63: { label: "Rain", icon: "🌧️" },
  65: { label: "Heavy rain", icon: "🌧️" },
  66: { label: "Freezing rain", icon: "🌧️" },
  67: { label: "Freezing rain", icon: "🌧️" },
  71: { label: "Light snow", icon: "🌨️" },
  73: { label: "Snow", icon: "❄️" },
  75: { label: "Heavy snow", icon: "❄️" },
  77: { label: "Snow grains", icon: "🌨️" },
  80: { label: "Light showers", icon: "🌦️" },
  81: { label: "Showers", icon: "🌧️" },
  82: { label: "Heavy showers", icon: "🌧️" },
  85: { label: "Snow showers", icon: "🌨️" },
  86: { label: "Heavy snow showers", icon: "❄️" },
  95: { label: "Thunderstorm", icon: "⛈️" },
  96: { label: "Thunderstorm + hail", icon: "⛈️" },
  99: { label: "Thunderstorm + hail", icon: "⛈️" },
};

const els = {
  form: document.getElementById("search-form"),
  input: document.getElementById("search-input"),
  popup: document.getElementById("search-popup"),
  geo: document.getElementById("geo-btn"),
  status: document.getElementById("status"),
  skeleton: document.getElementById("skeleton"),
  empty: document.getElementById("empty"),
  current: document.getElementById("current"),
  location: document.getElementById("location"),
  temps: document.getElementById("temps"),
  condition: document.getElementById("condition"),
  hl: document.getElementById("hl"),
  daily: document.getElementById("daily"),
  dailyList: document.getElementById("daily-list"),
  dateline: document.getElementById("dateline"),
};

/* ------------------------------------------------------- search popup */

const searchState = {
  results: [],
  active: -1,
  open: false,
  query: "",
  timer: null,
  abort: null,
  reqId: 0,
};

function placeFromResult(r) {
  const parts = [r.name, r.admin1, r.country_code].filter(Boolean);
  return { name: parts.join(", "), lat: r.latitude, lon: r.longitude };
}

function placeMeta(r) {
  return [r.admin1, r.country].filter(Boolean).join(", ");
}

function closePopup() {
  searchState.open = false;
  searchState.active = -1;
  searchState.results = [];
  els.popup.hidden = true;
  els.popup.innerHTML = "";
  els.input.setAttribute("aria-expanded", "false");
  els.input.removeAttribute("aria-activedescendant");
}

function setActiveIndex(i) {
  const items = els.popup.querySelectorAll(".search-popup__item");
  if (!items.length) {
    searchState.active = -1;
    els.input.removeAttribute("aria-activedescendant");
    return;
  }
  searchState.active = ((i % items.length) + items.length) % items.length;
  items.forEach((el, idx) => {
    const on = idx === searchState.active;
    el.classList.toggle("is-active", on);
    el.setAttribute("aria-selected", on ? "true" : "false");
  });
  const active = items[searchState.active];
  els.input.setAttribute("aria-activedescendant", active.id);
  active.scrollIntoView({ block: "nearest" });
}

function renderPopup(results, { loading = false, empty = false } = {}) {
  searchState.results = results;
  searchState.active = -1;

  if (loading) {
    els.popup.innerHTML = `<li class="search-popup__loading" role="presentation">Searching…</li>`;
  } else if (empty) {
    els.popup.innerHTML = `<li class="search-popup__empty" role="presentation">No cities found</li>`;
  } else {
    els.popup.innerHTML = results
      .map((r, i) => {
        const meta = placeMeta(r);
        return `
          <li role="presentation">
            <button
              type="button"
              class="search-popup__item"
              role="option"
              id="search-opt-${i}"
              data-index="${i}"
              aria-selected="false"
            >
              <span class="search-popup__name">${escapeHtml(r.name)}</span>
              ${
                meta
                  ? `<span class="search-popup__meta">${escapeHtml(meta)}</span>`
                  : ""
              }
            </button>
          </li>`;
      })
      .join("");
  }

  els.popup.hidden = false;
  searchState.open = true;
  els.input.setAttribute("aria-expanded", "true");
}

async function searchCities(query) {
  const reqId = ++searchState.reqId;
  if (searchState.abort) searchState.abort.abort();
  searchState.abort = new AbortController();

  renderPopup([], { loading: true });

  try {
    const url = new URL("https://geocoding-api.open-meteo.com/v1/search");
    url.searchParams.set("name", query);
    url.searchParams.set("count", "8");
    url.searchParams.set("language", "en");
    url.searchParams.set("format", "json");
    const res = await fetch(url, { signal: searchState.abort.signal });
    if (!res.ok) throw new Error("Geocoding failed");
    const data = await res.json();
    if (reqId !== searchState.reqId) return;

    const results = data.results || [];
    if (!results.length) {
      renderPopup([], { empty: true });
      return;
    }
    renderPopup(results);
    setActiveIndex(0);
  } catch (err) {
    if (err.name === "AbortError") return;
    if (reqId !== searchState.reqId) return;
    closePopup();
  }
}

function scheduleSearch(query) {
  clearTimeout(searchState.timer);
  searchState.query = query;
  if (query.length < 2) {
    if (searchState.abort) searchState.abort.abort();
    closePopup();
    return;
  }
  searchState.timer = setTimeout(() => searchCities(query), 220);
}

function pickResult(index) {
  const r = searchState.results[index];
  if (!r) return;
  const place = placeFromResult(r);
  closePopup();
  els.input.value = "";
  els.input.blur();
  loadPlace(place);
}

/* ---------------------------------------------------------------- helpers */

const cToF = (c) => (c * 9) / 5 + 32;
const round = (n) => Math.round(n);
const clamp = (n, lo, hi) => Math.min(Math.max(n, lo), hi);

const escapeHtml = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (ch) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        ch
      ]
  );

function wmo(code) {
  return WMO[code] ?? { label: "Unknown", icon: "🌡️" };
}

/**
 * Print-ink palette: muted slate blue (cold) → terracotta (warm),
 * mapped over roughly -10 °C … 35 °C. No neon on paper.
 */
function tempColor(c) {
  const t = clamp((c + 10) / 45, 0, 1);
  const hue = 199 - t * 179;
  const sat = 26 + t * 36;
  const light = 40 - t * 4;
  return `hsl(${hue.toFixed(0)} ${sat.toFixed(0)}% ${light.toFixed(0)}%)`;
}

function dayLabel(isoDate, index) {
  const d = new Date(isoDate + "T12:00:00");
  if (index === 0) return "Today";
  return d.toLocaleDateString(undefined, { weekday: "short" });
}

function setDateline() {
  if (!els.dateline) return;
  els.dateline.textContent = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

/* --------------------------------------------------------- view state */

/** state: "idle" | "loading" | "ready" | "error" */
function setView(state) {
  const loading = state === "loading";
  const showData = state === "ready";
  const showEmpty = state === "idle";

  const applyHidden = (el, hide) => {
    if (!el) return;
    el.hidden = hide;
    if (hide) el.setAttribute("hidden", "");
    else el.removeAttribute("hidden");
  };

  applyHidden(els.skeleton, !loading);
  applyHidden(els.empty, !showEmpty);
  applyHidden(els.current, !showData);
  applyHidden(els.daily, !showData);

  if (els.geo) {
    els.geo.classList.toggle("is-busy", loading);
    els.geo.setAttribute("aria-busy", loading ? "true" : "false");
  }
}

function setStatus(msg, kind = "info") {
  els.status.textContent = msg || "";
  els.status.classList.toggle("is-error", Boolean(msg) && kind === "error");
  els.status.classList.toggle("is-loading", Boolean(msg) && kind === "loading");
}

function replay(el, ...classes) {
  el.classList.remove("fade-in", "fade-in--delayed");
  void el.offsetWidth; // restart the animation
  el.classList.add(...classes);
}

/* ------------------------------------------------------------------ data */

async function reverseGeocode(lat, lon) {
  try {
    // BigDataCloud client reverse geocode — free, no key, browser-friendly
    const url = new URL(
      "https://api.bigdatacloud.net/data/reverse-geocode-client"
    );
    url.searchParams.set("latitude", lat);
    url.searchParams.set("longitude", lon);
    url.searchParams.set("localityLanguage", "en");
    const res = await fetch(url);
    if (!res.ok) return "Current location";
    const data = await res.json();
    const name =
      data.city || data.locality || data.principalSubdivision || null;
    if (!name) return "Current location";
    const region = data.principalSubdivisionCode || data.countryCode || "";
    return region ? `${name}, ${region.replace(/^US-/, "")}` : name;
  } catch {
    return "Current location";
  }
}

async function fetchWeather(lat, lon) {
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", lat);
  url.searchParams.set("longitude", lon);
  url.searchParams.set(
    "current",
    "temperature_2m,weather_code,apparent_temperature"
  );
  url.searchParams.set(
    "daily",
    "weather_code,temperature_2m_max,temperature_2m_min"
  );
  url.searchParams.set("temperature_unit", "celsius");
  url.searchParams.set("timezone", "auto");
  url.searchParams.set("forecast_days", "10");
  const res = await fetch(url);
  if (!res.ok) throw new Error("Weather request failed");
  return res.json();
}

/* --------------------------------------------------------------- render */

function bigTempHtml(c, unit) {
  const value = unit === "F" ? round(cToF(c)) : round(c);
  return `
    <div class="temp temp--${unit.toLowerCase()}">
      <span class="temp__value">${value}<span class="temp__deg">°</span></span>
      <span class="temp__unit">${unit === "F" ? "Fahrenheit" : "Celsius"}</span>
    </div>`;
}

function hlChipHtml(key, c) {
  return `
    <span class="hl">
      <span class="hl__key">${key}</span>
      <span class="hl__f">${round(cToF(c))}°F</span>
      <span class="hl__c">${round(c)}°C</span>
    </span>`;
}

function renderCurrent(placeName, data) {
  const cur = data.current;
  const { label, icon } = wmo(cur.weather_code);
  const hi = data.daily.temperature_2m_max[0];
  const lo = data.daily.temperature_2m_min[0];
  const f = round(cToF(cur.temperature_2m));
  const c = round(cur.temperature_2m);

  els.location.textContent = placeName;

  els.temps.innerHTML =
    bigTempHtml(cur.temperature_2m, "F") +
    `<span class="temps__divider" aria-hidden="true"></span>` +
    bigTempHtml(cur.temperature_2m, "C");
  els.temps.setAttribute(
    "aria-label",
    `Now ${f} degrees Fahrenheit, ${c} degrees Celsius`
  );

  els.condition.innerHTML = `<span class="cond__icon" aria-hidden="true">${icon}</span>${escapeHtml(
    label
  )}`;

  els.hl.innerHTML = hlChipHtml("High", hi) + hlChipHtml("Low", lo);
  els.hl.setAttribute(
    "aria-label",
    `High ${round(cToF(hi))} degrees Fahrenheit, ${round(hi)} Celsius. ` +
      `Low ${round(cToF(lo))} degrees Fahrenheit, ${round(lo)} Celsius.`
  );
}

function renderDaily(data) {
  const { time, weather_code, temperature_2m_max, temperature_2m_min } =
    data.daily;
  const nowC = data.current?.temperature_2m;

  // Global min/max drive relative bar position and width
  const allMin = Math.min(...temperature_2m_min);
  const allMax = Math.max(...temperature_2m_max);
  const span = Math.max(allMax - allMin, 1);

  els.dailyList.innerHTML = time
    .map((iso, i) => {
      const lo = temperature_2m_min[i];
      const hi = temperature_2m_max[i];
      const { icon, label } = wmo(weather_code[i]);
      const left = clamp(((lo - allMin) / span) * 100, 0, 100);
      const width = clamp(((hi - lo) / span) * 100, 3, 100 - left);
      const nowDot =
        i === 0 && Number.isFinite(nowC)
          ? `<span class="bar__now" style="left:${clamp(
              ((nowC - allMin) / span) * 100,
              0,
              100
            ).toFixed(1)}%" aria-hidden="true"></span>`
          : "";

      return `
        <li class="day${i === 0 ? " day--today" : ""}">
          <span class="day__name">${dayLabel(iso, i)}</span>
          <span class="day__icon" role="img" aria-label="${escapeHtml(label)}">${icon}</span>
          <span class="t t--lo">
            <span class="sr-only">Low </span>
            <span class="t__f">${round(cToF(lo))}°<span class="sr-only">F</span></span>
            <span class="t__c">${round(lo)}°C</span>
          </span>
          <span class="day__range" aria-hidden="true">
            <span class="bar">
              <span class="bar__fill" style="left:${left.toFixed(
                1
              )}%;width:${width.toFixed(1)}%;--from:${tempColor(
                lo
              )};--to:${tempColor(hi)};animation-delay:${(i * 25).toFixed(0)}ms"></span>
              ${nowDot}
            </span>
          </span>
          <span class="t t--hi">
            <span class="sr-only">High </span>
            <span class="t__f">${round(cToF(hi))}°<span class="sr-only">F</span></span>
            <span class="t__c">${round(hi)}°C</span>
          </span>
        </li>`;
    })
    .join("");
}

/* ----------------------------------------------------------------- flow */

async function loadPlace(place) {
  setView("loading");
  setStatus("Setting the type…", "loading");
  try {
    const data = await fetchWeather(place.lat, place.lon);
    renderCurrent(place.name, data);
    renderDaily(data);
    setView("ready");
    setStatus("");
    replay(els.current, "fade-in");
    replay(els.daily, "fade-in", "fade-in--delayed");
    localStorage.setItem("lastPlace", JSON.stringify(place));
  } catch (err) {
    setView(els.location.textContent ? "ready" : "idle");
    setStatus(err.message || "Failed to load weather", "error");
  }
}

async function loadFromCoords(lat, lon) {
  setView("loading");
  setStatus("Finding your location…", "loading");
  const name = await reverseGeocode(lat, lon);
  await loadPlace({ name, lat, lon });
}

function useGeolocation() {
  if (!navigator.geolocation) {
    setView(els.location.textContent ? "ready" : "idle");
    setStatus("Geolocation is not available", "error");
    return;
  }
  setView("loading");
  setStatus("Getting your location…", "loading");
  navigator.geolocation.getCurrentPosition(
    (pos) => loadFromCoords(pos.coords.latitude, pos.coords.longitude),
    () => {
      setView(els.location.textContent ? "ready" : "idle");
      setStatus("Location permission denied", "error");
    },
    { enableHighAccuracy: false, timeout: 12000 }
  );
}

els.form.addEventListener("submit", (e) => {
  e.preventDefault();
  if (searchState.open && searchState.results.length) {
    const i = searchState.active >= 0 ? searchState.active : 0;
    pickResult(i);
    return;
  }
  const q = els.input.value.trim();
  if (q.length < 2) return;
  // No open list yet — fetch once and take the top hit
  clearTimeout(searchState.timer);
  searchCities(q).then(() => {
    if (searchState.results.length) pickResult(0);
    else {
      setStatus(`No place found for “${q}”`, "error");
      closePopup();
    }
  });
});

els.input.addEventListener("input", () => {
  scheduleSearch(els.input.value.trim());
});

els.input.addEventListener("keydown", (e) => {
  if (!searchState.open) {
    if (e.key === "ArrowDown" && els.input.value.trim().length >= 2) {
      e.preventDefault();
      scheduleSearch(els.input.value.trim());
    }
    return;
  }

  if (e.key === "ArrowDown") {
    e.preventDefault();
    if (searchState.results.length) setActiveIndex(searchState.active + 1);
  } else if (e.key === "ArrowUp") {
    e.preventDefault();
    if (searchState.results.length) setActiveIndex(searchState.active - 1);
  } else if (e.key === "Escape") {
    e.preventDefault();
    closePopup();
  } else if (e.key === "Tab") {
    closePopup();
  }
});

els.popup.addEventListener("mousedown", (e) => {
  // Keep input focus so click still registers before blur-close
  e.preventDefault();
});

els.popup.addEventListener("click", (e) => {
  const btn = e.target.closest(".search-popup__item");
  if (!btn) return;
  const i = Number(btn.dataset.index);
  if (Number.isFinite(i)) pickResult(i);
});

els.input.addEventListener("blur", () => {
  // Delay so option click can fire first
  setTimeout(() => {
    if (!els.form.contains(document.activeElement)) closePopup();
  }, 120);
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && searchState.open) closePopup();
});

els.geo.addEventListener("click", useGeolocation);

// Boot: dateline, then last place, else geolocation, else empty state
(function boot() {
  setDateline();
  setView("idle");
  try {
    const saved = JSON.parse(localStorage.getItem("lastPlace"));
    if (saved?.lat != null && saved?.lon != null && saved?.name) {
      loadPlace(saved);
      return;
    }
  } catch {
    /* ignore */
  }
  useGeolocation();
})();

# Resort Direct — feed audit & integration gameplan

**Status (2026-06-20): prototyped, then PARKED behind "Coming soon."** The Weather tab's
**Resort Direct** + **SnoCountry** cards are parked placeholders, but the ingestion engine
was **built and is dormant in the repo** (kept, easy to revive):
- **Direct Feed** — a multi-feed "build-your-own" card: add N endpoints per resort, each via
  paste-a-sample or live fetch → `flatten()` auto-detect → heuristic map → combined preview
  (merges feeds, "top feed wins" on overlap). Works in the dashboard; **not wired to the live
  widget** (needs the server-side proxy for CORS-blocked/secret feeds).
- **SnoCountry** — a working **Live Status adapter** (`src/shared/weather/snocountry.js`,
  `fetchSnoCountry`; CORS-open, baked public read key; verified live).
- **Composition layer** — `src/shared/weather/compose.js` turns the saved source selection
  into the widget's 6-cell card (Open-Meteo live today; the above are dormant).
- **OpenSnow was removed** (API access denied).

To revive: un-park the two "Coming soon" tiles on `weather.html` (swap them back to active
cards). The audit below is the build reference for finishing the proxy + more sources.

> ⚠️ This repo is **public**. Per-resort endpoint URLs, API keys/tokens, and sample
> payloads are **not** stored here — credentials live in Keeper. This doc keeps only the
> architectural findings (shapes, auth *types*, CORS behavior).

---

## Why Resort Direct exists

Open-Meteo gives global live **weather** (temp / wind / conditions / snow-level / a 5-day
snowfall forecast) but cannot give resort **operations** data — base depth, 24h & season
snow totals, lift / trail / terrain status, parking. Those only come from each resort's own
feed. Resort Direct is the connector that ingests a resort feed and maps it into the GSB
normalized model (the same shape `src/shared/weather/open-meteo.js` emits).

---

## The audit

~11 partner feeds were probed live. They collapse into **~7 recognizable shape families**:

| Family | Example resort(s) | Auth type | Browser CORS | Shape notes |
|---|---|---|---|---|
| **OpenSnow** | any resort by numeric ID | api_key (query) | ✅ open | **response IS our normalized model** (`forecast_current.{conditions_id,temp,wind_dir_label,snow_level}` + hourly/daily) — zero mapping |
| **Alta Ops** | Alta | bearer | ✅ open | flat `currentWeather[0]` — base/mid/top temp, wind, `sky_cover` text, `base_depth`; numbers as strings |
| **Powdr DOR** | Killington, Pico | none | ❌ blocked | `data.current.{temperature_f,wind_mph,summary}` + per-area `sensors[]` with a `primary` flag |
| **WordPress (WP-JSON)** | Sipapu, Pajarito | none | ✅ open | `current_temperature`, `current_weather`, `snow[]` label/value array |
| **ResortsTapped** | Cranmore | apikey header | ✅ open | `mountain_report` + `snow_reports[]` (HTML in summary) |
| **Infosnow / Mtn-News** | Grand Targhee | none | ❌ blocked | deeply-nested `content.resorts[0]…` enterprise feed (100KB+) |
| **Custom / label-value** | Gunstock, Snow Trails, Jackson Hole, Diamond Peak (InterMaps) | none | ❌ mostly blocked | bespoke shapes; many values are display strings (`"0\""`, `"0 of 11"`, `"40.0"` as string) |

(Separate from weather: `tools.mcp.ski` exposes lift-ticket **pricing/availability** for the
Mountain Capital Partners resorts — different domain, not a conditions feed.)

### Two load-bearing findings

1. **CORS splits the world in half.** Roughly half the feeds send no
   `Access-Control-Allow-Origin` header → a browser **cannot** fetch them. So Resort Direct
   ultimately **needs a server-side poller/proxy** (Cloudflare Worker / Lambda) for the blocked
   half **and** for any secret-bearing auth (keys must never reach the public browser bundle).
   The dashboard "fetch sample" step can still hit the CORS-open families directly for setup.
   This is why the UI copy says *"polled every 15 minutes."*
2. **OpenSnow already returns our schema.** Its `forecast_current` is byte-for-byte the GSB
   normalized model — because our model was originally derived from it. OpenSnow is therefore a
   near-zero-mapping source and a strong candidate for a **second built-in** source (configured
   by resort ID instead of lat/lng), giving ski-specific snow data Open-Meteo lacks.

---

## The gameplan (recommended build)

**Paste URL → Fetch sample → auto-detect shape → auto-map → preview → Save.**

- **Auto-detect** by signature-sniffing the response:
  `forecast_current.conditions_id` ⇒ OpenSnow · `currentWeather[].base_temp` ⇒ Alta ·
  `data.current.temperature_f` ⇒ Powdr DOR · `current_temperature` + `snow[]` ⇒ WordPress ·
  `mountain_report` ⇒ ResortsTapped · else ⇒ **Generic**.
- **Family presets do the mapping** for known feeds. The generic dot-path field-mapper (the UI
  we prototyped, since removed from `weather.html`) becomes the **fallback** for unknown shapes —
  so most resorts are "paste URL → Save," no manual mapping.
- A **coercion layer** parses display strings → numbers and condition text → `conditions_id`.

### Architecture

- `src/shared/weather/resort-direct.js` — config `{ family, url, auth, mappings, units }` →
  normalized model (mirrors `open-meteo.js`, the existing source of truth).
- **Server poller** (Worker/Lambda) for the CORS-blocked half + secret-bearing auth.
- Source choice persists in `localStorage["gsb-weather-config-v1"]`, which is already
  **source-aware** (`source: 'open-meteo' | 'resort-direct'` — see weather.html save model).

### Suggested order

1. **OpenSnow passthrough** — zero mapping, proves the fetch → detect → normalize → preview → save loop.
2. **Auto-detect + adapters for the CORS-open four** (OpenSnow, Alta, Cranmore, WordPress) — works end-to-end in the dashboard with no backend.
3. **Generic mapper fallback** for unknown shapes.
4. **Server poller** for the blocked half (Jackson Hole, Grand Targhee, Gunstock, Killington/Pico, Snow Trails, Diamond Peak).

### Bigger picture

This is only the **weather** slice of a broader **Resort Data Feeds** layer (snow report,
lift/terrain status, parking, events) that would power the AI's realtime-data actions
(`get_snow_report`, `get_lift_status`, …). Architect Resort Direct as the first piece of that,
not a one-off weather connector.

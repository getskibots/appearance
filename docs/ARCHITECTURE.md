# Architecture & Runtime

How the code is organized, how it runs, and how to extend it. Pairs with
[`HANDOFF.md`](./HANDOFF.md) (orientation) and
[`botscrew-widget-settings.md`](./botscrew-widget-settings.md) (data contract).

---

## The two halves

The app is two independent vanilla-JS IIFEs that share the page and talk through a
small `window` bridge. No framework, no bund-time coupling.

### 1. Dashboard — `src/dashboard/dashboard.js`

The admin UI. The core pattern is **state → render**:

- `DEFAULTS` — the canonical config object (every field the widget understands).
- `state` — a deep clone of `DEFAULTS`, hydrated on load from saved config.
- `saved` — the last-saved snapshot, used for the dirty banner + Revert.
- Every control has a handler that mutates `state` and calls `render()`.
- `render()` is the single place that pushes `state` into the live preview. It does
  this **declaratively** by setting:
  - **CSS variables** on `:root` / the launcher (e.g. `--brand`, `--brand-deep`,
    `--gsb-radius`, `--gsb-body-font`, `--gsb-depth-effect`).
  - **data-attributes** on the preview canvas / launcher (e.g. `data-variant`,
    `data-icon-style`, `data-show-weather`, `data-slide-state`).
  - text content + control sync (so reopening the dashboard reflects state).

Because styling is driven entirely by CSS vars + data-attrs, the same mechanism can
style a real embedded widget — that's the intended consumption path for `gsbAppearance`.

Helper conventions: `$(id)` = `getElementById`; `setToggle(id, bool)` sets
`aria-checked`; `bindToggle(id, getter, setter)` wires a toggle to a state field.

### 2. Widget — `src/widget/widget-runtime.js`

The chat surface runtime (interim "umbrella" module — slated to split into
chat-module / knowledge-base / data / voice). Responsibilities:

- **Data fetch** (`fetchAll`) — pulls Jackson Hole feeds (snow/webcams/parking) with
  a cached `FALLBACK` snapshot when CORS blocks the request.
- **Live weather** (`applyOpenMeteoWeather`) — overrides temps/wind from Open-Meteo
  via the shared adapter. Snow stats stay from the resort feed/fallback.
- **Conditions card render** (`renderAllData`) — fills the `cell*` elements.
- **Message routing** — keyword-based demo responses over the JH knowledge base.
- **Season Update banner** — renders the manual "Recent update" copy; a non-empty
  manual value sets `data-manual-update` so the live weather feed won't overwrite it.
- **Voice** — Web Speech mic dictation, TTS read-aloud, hands-free Voice Mode. The
  hands-free Voice Mode is gated by **Behavior → Realtime voice** (`body[data-voice]`);
  the dictation mic is independent.

(Ambient snowfall is a live effect — configured in the **Animations & effects**
card and rendered on the chat surface, off by default since it animates
continuously.)

Public bridge: `window.gsbChatPreview = { openChat, closeChat, setVariant,
refreshData, handleQuery }`. This exists for the **dashboard** to drive the preview —
it is not yet a production mount/init API.

---

## Config flow (produce → persist → consume)

```
 controls ──▶ state ──▶ render()              (live preview, via CSS vars + data-attrs)
                │
                ├─ Save ─▶ toBotscrewWidgetSettings(state)
                │            └─▶ localStorage["gsb_widget_settings"]   (durable, BotScrew shape)
                │
                └─ change ▶ buildLivePreviewConfig(state)
                             └─▶ localStorage["gsb_preview_config"]    (sharable.link live preview)

 on load ──▶ fromBotscrewWidgetSettings(localStorage["gsb_widget_settings"])
              └─▶ merged over DEFAULTS ──▶ state
```

- **Producer / consumer mapper:** `src/shared/widget-config.js` —
  `toBotscrewWidgetSettings(state)` and the lossless inverse
  `fromBotscrewWidgetSettings(settings)`.
- **`gsb_widget_settings`** — the durable config, written by the **Save button**,
  hydrated on startup. This is the object BotScrew should persist per bot.
- **`gsb_preview_config`** — a subset auto-written on every change, only for the
  sharable.link live-preview page. Not the source of truth.

To wire per-bot persistence: replace the `localStorage` read on load with
`GET /bot/{botId}/widget`, and the `localStorage` write in the Save handler with
`PATCH /bot/{botId}/widget`. The mapper output already matches the contract shape.

---

## Weather subsystem

One shared adapter, two consumers:

- **`src/shared/weather/open-meteo.js`** — `fetchOpenMeteo({lat,lng,elevationFt,name})`
  → normalized model (°F / mph). The single source of truth for live conditions.
- Consumed by **`weather.html`** (the config/preview tab) and the **widget runtime**
  (which overrides `data.snow.weather` after the resort feed loads).

Coordinate resolution order (widget): `window.gsbWeatherConfig` →
`localStorage["gsb-weather-config-v1"]` → Jackson Hole defaults.

`weather.html` is a **two-card accordion** — **Open-Meteo** (the active source: coords +
optional summit, a Location Detail panel, live readings + chat preview, a ⚡ Live-preview
toggle) and **Resort Direct** (a "Coming soon" placeholder). The saved config is
**source-aware** — `gsb-weather-config-v1` stores `source: 'open-meteo' | 'resort-direct'`
and restores the saved source's card (✓-marked) on load.

**What's live vs snapshot:**

| Field | Source | Live? |
|---|---|---|
| Base/summit temp, wind | Open-Meteo (CORS-open) | ✅ live |
| Snow 24h, season total, depth | resort `snow.json` (CORS-blocked) | ❌ baked snapshot |

Open-Meteo provides current weather + snowfall forecast, but **not** resort snow
depth or season totals. Making those live needs the resort's own feed (Resort Direct).
The prototype field-mapper was removed and Resort Direct is now a "Coming soon" card —
the full feed audit (7 shape families, CORS split, OpenSnow = our schema) and build plan
live in [`RESORT-DIRECT-FEEDS.md`](./RESORT-DIRECT-FEEDS.md).

---

## How to extend (common tasks)

- **Add an appearance field:** add it to `DEFAULTS`, render it in `render()`
  (set a CSS var or data-attr), wire its control handler, and add it to
  `gsbAppearance` in `src/shared/widget-config.js` (+ the contract doc). Save/load
  is then automatic.
- **Add a weather field:** extend the normalized model in `open-meteo.js` so both
  consumers get it for free.
- **Change persistence target:** see the config-flow section — it's two call sites
  (load + save) in `dashboard.js`.

---

## Provenance

The first commit is a pristine import of the production prototype from sharable.link.
Every later commit is an incremental, behavior-preserving extraction (CSS first,
then JS), with byte-faithful splitter tooling under `scripts/`. The git history is
the audit trail.

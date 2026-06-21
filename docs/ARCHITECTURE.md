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
- **Season Update banner** — when config drives the banner (via `applyWidgetConfig`
  or the dashboard `render`) it always sets `data-manual-update='true'`, so the
  runtime's baked demo copy can never leak in: a set `recentUpdate` shows, a blank
  one hides the banner.
- **Voice** — Web Speech mic dictation, TTS read-aloud, hands-free Voice Mode. The
  hands-free Voice Mode is gated by **Behavior → Realtime voice** (`body[data-voice]`);
  the dictation mic is independent.

**`src/widget/apply-config.js` — `applyWidgetConfig(config)`** is the single faithful
config→DOM path (CSS vars + `data-` attrs + content). The dashboard `render` and the
demo both apply config; `applyWidgetConfig` keeps them at parity so the demo is
pixel-faithful and the eventual embed reuses one function. The demo-only background
photo rides here too (`--gsb-bg-image` + `body[data-bg-image]` / `[data-bg-text]`).

**Embeddable search bar** — a real shippable component (`.gsb-embed-search`, in
`chat-widget.css`), driven by `--gsb-search-*`. The dashboard preview and the demo hero
search render the *same* component (the demo adds an `is-hero` size variant), so the
hero search is faithful, not a re-creation.

**Launcher auto-hide on scroll** — both the dashboard and the demo slide the launcher
away on scroll-down and reveal it on scroll-up/idle (driven by `autoHideOnScroll` +
`data-slide-state`). The demo's below-the-fold section gives the page something to scroll.
A shared-CSS fix stops the `radiate` pulse while hidden so the slide-off transform wins.

(Ambient snowfall is a live effect — configured in the **Animations & effects** card,
rendered on the chat surface by the shared `src/shared/snow-engine.js` engine that
**both** the dashboard preview and the demo import. Off by default since it animates
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
                             └─▶ localStorage["gsb_preview_config"]    (demo preview: preview.html)
                                  + Live Preview button → preview.html#cfg=<base64>

 on load ──▶ fromBotscrewWidgetSettings(localStorage["gsb_widget_settings"])
              └─▶ merged over DEFAULTS ──▶ state
```

- **Producer / consumer mapper:** `src/shared/widget-config.js` —
  `toBotscrewWidgetSettings(state)` and the lossless inverse
  `fromBotscrewWidgetSettings(settings)`.
- **`gsb_widget_settings`** — the durable config, written by the **Save button**,
  hydrated on startup. This is the object BotScrew should persist per bot.
- **`gsb_preview_config`** — a subset auto-written on every change, read by the demo
  preview page (`preview.html`) via same-origin `localStorage` or the Live Preview
  button's `#cfg=` URL hash. Not the source of truth, and a **prototype** hand-off:
  production selects the bot by `publicIdentifier` in the URL and loads
  `/widget/info/{botId}` instead (see [INTEGRATION.md §10](./INTEGRATION.md)).

To wire per-bot persistence: replace the `localStorage` read on load with
`GET /bot/{botId}/widget`, and the `localStorage` write in the Save handler with
`PATCH /bot/{botId}/widget`. The mapper output already matches the contract shape.

---

## Weather subsystem

**Adapters → a composition layer → two consumers.**

- **`src/shared/weather/open-meteo.js`** — `fetchOpenMeteo({lat,lng,elevationFt,name})`
  → normalized model (°F / mph). The **live** weather source.
- **`src/shared/weather/compose.js`** — `composeConditions(cfg, coords)` reads the saved
  source selection (`localStorage["gsb-weather-integrations-v1"]`) and produces the data the
  widget renders: a **6-cell conditions card filled by ONE active source** (Open-Meteo today).
  No merging/precedence — one source → six cells.
- **`src/shared/weather/snocountry.js`** — `fetchSnoCountry()` Live Status adapter. **Built
  but dormant** (its card is parked "Coming soon").
- Consumed by **`weather.html`** (the config/preview tab) and the **widget runtime**
  (`omSeasonCells(...).slice(0,6)` renders the composed card).

Coordinate resolution order (widget): `window.gsbWeatherConfig` →
`localStorage["gsb-weather-config-v1"]` → Jackson Hole defaults (Summer card).

`weather.html` is a **vertical stack of source cards** — **Open-Meteo** (live: coords +
optional summit, Location Detail panel, live readings + chat preview, ⚡ Live-preview toggle;
**on by default**, **JH coords + Summer** demo defaults, auto-fetches on load) + **Direct
Feed** and **SnoCountry**, both parked as **"Coming soon"** rows.

**What's live vs parked:**

| Source | State |
|---|---|
| Open-Meteo — temp/wind/conditions/UV/precip/snow-level (CORS-open) | ✅ live, drives the card |
| Direct Feed — resort's own API(s), multi-feed build-your-own engine | ⏸ built, parked (needs a server-side proxy to reach the live widget) |
| SnoCountry — base depth / new snow / lifts / trails / surface (CORS-open) | ⏸ built, parked |
| OpenSnow | ❌ removed (API access denied) |

Open-Meteo covers current weather + a snowfall forecast, but **not** resort operations
(depth, lifts, trails) — those come from a resort feed (Direct Feed / SnoCountry), which is
why those cards exist. Full feed audit (7 shape families, CORS split) + revival plan in
[`RESORT-DIRECT-FEEDS.md`](./RESORT-DIRECT-FEEDS.md).

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

The first commit is a pristine import of the production chat prototype.
Every later commit is an incremental, behavior-preserving extraction (CSS first,
then JS), with byte-faithful splitter tooling under `scripts/`. The git history is
the audit trail.

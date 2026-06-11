# GetSkiBots Appearance — Engineering Handoff

**Audience:** BotScrew engineering (Oleksa Hraban).
**Purpose:** everything needed to understand this repo, run it, and integrate it
into BotScrew's admin + the resort website embed.

Start here, then branch to the deeper docs linked at the bottom.

---

## TL;DR

- This repo is the GetSkiBots **appearance dashboard** (the admin UI a resort uses
  to style its chat widget) plus the **embeddable chat widget** that dashboard
  configures.
- It's a **vanilla Vite multi-page app** — no framework, no build-time magic, no
  backend. The live demo is static GitHub Pages.
- The **data contract** between this dashboard and BotScrew's `Widget → Appearance`
  tab is fully specified in [`botscrew-widget-settings.md`](./botscrew-widget-settings.md).
  **That is the single most important doc for integration.**
- Where the build stands: the **admin UI** and **Open-Meteo weather** are largely
  done; the **per-bot-ID persistence, the embed loader, and webcam** are the main
  remaining work. Full breakdown in [`BUILD-STATUS.md`](./BUILD-STATUS.md).

---

## Live demo

| Page | URL | What it is |
|---|---|---|
| Dashboard | https://getskibots.github.io/appearance/ | Admin appearance UI (`index.html`) |
| Widget preview | https://getskibots.github.io/appearance/preview.html | Widget on a resort-site mock |
| Weather config | https://getskibots.github.io/appearance/weather.html | Resort coordinate + feed config |

Auto-deploys via GitHub Actions on every push to `main`.

---

## Run it locally

```bash
npm install
npm run dev      # Vite dev server (serves index.html, preview.html, weather.html)
npm run build    # emits all pages to dist/ (base path /appearance/ for Pages)
npm run preview  # serve the production build
```

No env vars, no secrets, no backend required. Everything runs client-side.

---

## Repo map

```
index.html              Appearance dashboard (admin UI)
preview.html            Standalone widget preview on a resort-site mock
weather.html            Weather/coordinate config tab (+ "own feed" field mapper)
vite.config.js          Multi-page build config (3 entries)

src/
  shared/
    tokens.css          Design tokens (CSS variables)
    reset.css           Base reset
    widget-config.js    BotScrew config mapper (to/fromBotscrewWidgetSettings)
    weather/
      open-meteo.js     Shared Open-Meteo adapter (the ONE weather source of truth)
  dashboard/
    dashboard.css       Dashboard styling
    dashboard.js        Dashboard logic: state, render(), save/load, all controls
  widget/
    chat-widget.css     Widget styling
    widget-runtime.js   The chat widget runtime (interim umbrella module)
    knowledge/
      jackson-hole.js   Demo knowledge base (Jackson Hole)
  assets/               Sample logo, etc.

docs/
  HANDOFF.md                  ← you are here
  ARCHITECTURE.md             Code + runtime model, how to extend
  BUILD-STATUS.md             What's done vs pending (where the build is)
  botscrew-widget-settings.md Data contract (authoritative)

scripts/                Byte-faithful extraction tooling (refactor provenance)
```

---

## Runtime model in 60 seconds

The dashboard and the widget are **two IIFEs** that communicate through a small
bridge on `window`:

1. **Dashboard** (`dashboard.js`) holds a flat `state` object. Every control
   mutates `state` then calls `render()`. `render()` applies the whole state to the
   live preview by setting **CSS variables** (`--brand`, `--gsb-radius`, …) and
   **data-attributes** (`data-variant`, `data-icon-style`, …) on the preview DOM.
2. **Widget** (`widget-runtime.js`) owns the chat surface: data fetching, the
   conditions card, message routing, voice, snowfall. It exposes
   `window.gsbChatPreview` so the dashboard can drive open/close/variant/query.
3. **Persistence:** the Save button writes the config (in BotScrew shape) to
   `localStorage["gsb_widget_settings"]`; the dashboard hydrates from it on load.

Full detail in [`ARCHITECTURE.md`](./ARCHITECTURE.md).

---

## The integration boundary — what BotScrew owns

The dashboard **produces** a config object; production must **consume** it per bot.
These four items are the seam between "what GSB built" and "what BotScrew wires":

1. **Per-bot load/save.** Today the dashboard persists to `localStorage` only.
   Production needs `GET /bot/{botId}/widget` on load and `PATCH /bot/{botId}/widget`
   on save, in the shape defined by the [contract](./botscrew-widget-settings.md).
   The mapper (`src/shared/widget-config.js`) already emits/ingests that exact shape.

2. **Appearance application to a real embedded widget.** Right now the **dashboard**
   applies styling via `render()`. A standalone embedded widget that reads the saved
   `gsbAppearance` + native fields and renders itself is **not yet built**
   (`preview.html` still runs an older inline copy of the widget). Unifying the
   widget onto one core that consumes the config is open work.

3. **Embed loader.** The dashboard's Install tab sketches the embed shape
   (`<div data-gsb-search></div>`, `<div data-gsb-search-button></div>`, the chat
   bubble) but **no loader script implements it** and there is no `botId` attribute
   wired. The 3 modular embed scripts are unbuilt (see BUILD-STATUS, Epic 7).

4. **Config injection the widget already honors today:**
   - `window.gsbWeatherConfig` — resort coordinates (base/summit lat/lng/elev).
   - `localStorage["gsb-weather-config-v1"]` — what the Weather tab saves.
   - Falls back to Jackson Hole defaults so nothing renders empty.

---

## Important constraints (read before integrating)

- **No backend in this repo.** It's a static demo. Anything needing server-side
  work (per-bot persistence, minting realtime-voice keys, proxying a no-CORS resort
  feed) lives on BotScrew/ODIN's side.
- **Resort snow feeds are CORS-blocked from the browser.** `jacksonhole.com/api/snow.json`
  returns `Failed to fetch` client-side, so snow figures fall back to a baked
  snapshot. Open-Meteo (temps/wind/snowfall) *is* CORS-open and renders live. Making
  resort snow numbers live needs a server-side fetch/proxy. See ARCHITECTURE → Weather.
- **Single-tenant today.** Everything is hardwired to the Jackson Hole demo; there is
  no multi-tenant/bot-ID layer yet. That layer is the largest cross-cutting piece of
  remaining work.

---

## Where to go next

- **Integrating into BotScrew admin** → [`botscrew-widget-settings.md`](./botscrew-widget-settings.md)
- **Understanding / modifying the code** → [`ARCHITECTURE.md`](./ARCHITECTURE.md)
- **Knowing what's done vs left** → [`BUILD-STATUS.md`](./BUILD-STATUS.md)

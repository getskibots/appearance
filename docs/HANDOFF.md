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
  done; the **per-bot-ID persistence** and **webcam** are the main remaining work.
  Full breakdown in [`BUILD-STATUS.md`](./BUILD-STATUS.md).
- **Milestone 1 is an iframe chat-app swap, not a customer-snippet replacement.**
  BotScrew's existing host-page loader (`script-chatbot.js`) already creates the
  launcher, greeting popup, and iframe, and bridges to the iframe via `postMessage`.
  Our job is to drop the GetSkiBots widget UI **inside that iframe** and consume
  BotScrew's config/conversation APIs — not to rewrite the loader or change the
  embed snippet. The contract is captured in
  [`SCRIPT-CHATBOT-CONTRACT.md`](./SCRIPT-CHATBOT-CONTRACT.md).

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
preview.html            Prospect demo: a resort-homepage mock with the widget embedded,
                        three entry points, a GetSkiBots demo control deck, and the
                        Live Preview sync (themed entirely by applyWidgetConfig). See INTEGRATION §10
weather.html            Weather config tab — Open-Meteo (active) + Resort Direct (coming soon) accordion
vite.config.js          Multi-page build config (3 entries)

src/
  shared/
    tokens.css          Design tokens (CSS variables)
    reset.css           Base reset
    widget-config.js    BotScrew config mapper (to/fromBotscrewWidgetSettings)
    snow-engine.js      Ambient snowfall engine — shared by the dashboard preview AND the demo
    webcam-render.js    Renders a hero cam/image by detected kind (img/iframe/video)
    webcam.js           Webcam URL kind detection
    image-compress.js   Client-side resize + WebP/optimize (logos, featured + background images)
    sample-logo.js      JH demo logo as a data URI (bundles reliably on Pages)
    weather/
      open-meteo.js     Shared Open-Meteo adapter (the ONE weather source of truth)
  dashboard/
    dashboard.css       Dashboard styling
    dashboard.js        Dashboard logic: state, render(), save/load, all controls
  widget/
    apply-config.js     applyWidgetConfig() — the single faithful config→DOM path (demo + embed)
    chat-widget.css     Widget styling + the shippable embeddable search-bar component
                        (.gsb-embed-search) shared by the dashboard preview AND the demo
    widget-runtime.js   The chat widget runtime (interim umbrella module)
    knowledge/
      jackson-hole.js   Demo knowledge base (Jackson Hole)
  assets/               GetSkiBots logo, etc.

docs/
  HANDOFF.md                  ← you are here
  ARCHITECTURE.md             Code + runtime model, how to extend
  BUILD-STATUS.md             What's done vs pending (where the build is)
  botscrew-widget-settings.md Data contract (authoritative)
  SCRIPT-CHATBOT-CONTRACT.md  BotScrew host-page loader contract: script tag, iframe,
                              parent↔iframe postMessage protocol, public API inventory
  RESORT-DIRECT-FEEDS.md      Resort-feed audit (7 shape families) + Resort Direct build plan

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
   conditions card, the Season Update banner, message routing, and voice
   (toggleable via Behavior → Realtime voice). It exposes
   `window.gsbChatPreview` so the dashboard can drive open/close/variant/query.
   (Ambient snowfall is a live effect, configured in the **Animations & effects**
   card and rendered on the chat surface — off by default, since it animates
   continuously.)
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

2. **Appearance application to a real embedded widget.** ✅ `preview.html` now styles the
   widget **entirely from a config object** via `applyWidgetConfig` — every appearance-tab
   field maps to the Chat UI (color, fonts, layout, launcher + depth effect + CTA, Season
   Update banner, webcam/featured hero, snowfall, voice, embed components). The dashboard's
   **Live Preview** button feeds it the live config (`localStorage` + a `#cfg=` URL hash;
   an open tab live-updates via the `storage` event — see
   [INTEGRATION.md §10](./INTEGRATION.md)). What production swaps in: select the bot by
   `publicIdentifier` in the URL (the existing
   `…/widget-demo/{publicIdentifier}?isTestMode=true` structure) and load
   `GET /widget/info/{botId}` into `applyWidgetConfig` instead of the prototype
   localStorage/hash sync. **Same render layer — only the config *source* changes.**

3. **Embed loaders.** Two different things, don't conflate them:
   - **Primary chat bubble — already exists.** BotScrew's `script-chatbot.js` is the
     host-page loader (launcher bubble, greeting popup, iframe creation, parent
     resize/open/close, `postMessage` bridge). We do **not** rebuild it; we adapt the
     GSB iframe app to its existing protocol. See
     [`SCRIPT-CHATBOT-CONTRACT.md`](./SCRIPT-CHATBOT-CONTRACT.md).
   - **New modular GSB entry points — unbuilt.** The Install tab sketches
     `<div data-gsb-search></div>` and `<div data-gsb-search-button></div>`, but no
     loader implements them and there's no `botId` attribute wired. *These* are the
     unbuilt loaders (BUILD-STATUS, Epic 7) — a Milestone 3 concern, not Milestone 1.

4. **Config injection the widget already honors today:**
   - `window.gsbWeatherConfig` — resort coordinates (base/summit lat/lng/elev).
   - `localStorage["gsb-weather-config-v1"]` — what the Weather tab saves. **Source-aware:**
     also stores `source: 'open-meteo' | 'resort-direct'` (Resort Direct is parked → effectively
     always Open-Meteo today).
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

- **The host-page loader & iframe protocol** (Milestone 1 target) → [`SCRIPT-CHATBOT-CONTRACT.md`](./SCRIPT-CHATBOT-CONTRACT.md)
- **Integrating into BotScrew admin** → [`botscrew-widget-settings.md`](./botscrew-widget-settings.md)
- **Dropping the widget into your embed** (iframe/snippet, seams, provenance) → [`INTEGRATION.md`](./INTEGRATION.md)
- **Understanding / modifying the code** → [`ARCHITECTURE.md`](./ARCHITECTURE.md)
- **Knowing what's done vs left** → [`BUILD-STATUS.md`](./BUILD-STATUS.md)
- **Building Resort Direct (own-feed) support** → [`RESORT-DIRECT-FEEDS.md`](./RESORT-DIRECT-FEEDS.md)

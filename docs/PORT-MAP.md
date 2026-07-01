# PORT-MAP.md — exactly what to port (and what to skip)

For BotScrew: how to take this prototype to production so it **mirrors the prototype**.
"Port" means three different things depending on the file — grouped below. The goal is
**reuse the render engine, port the admin UI, wire the integration, delete the demo.**

---

## A. Reuse (nearly) as-is — the render engine
Framework-agnostic. **Copy these in; do NOT rewrite.** This is what makes the widget
pixel-identical to the prototype.

| File | What it is |
|---|---|
| `src/widget/apply-config.js` | **`applyWidgetConfig(config)`** — the single config → DOM render function. The heart of it. |
| `src/widget/chat-widget.css` | All widget styling (launcher, chat, hero, conditions card, voice…). |
| `src/shared/tokens.css` | Design tokens (CSS variables). |
| `src/shared/reset.css` | Base reset (merge with yours if you already have one). |
| `src/shared/widget-config.js` | The **BotScrew config mapper** (`to/fromBotscrewWidgetSettings`). |
| `src/shared/markdown.js` | `linkifyMarkdown` + `autolink` (message/link rendering). |
| `src/shared/webcam-render.js`, `src/shared/webcam.js` | Hero cam/image carousel + URL type detection. |
| `src/shared/snow-engine.js` | Snowfall effect. |
| `src/shared/analytics.js` | Analytics event layer (set `GSB_GA4_ID`). |
| `src/shared/weather/open-meteo.js` (+ `compose.js`, `snocountry.js`) | Weather adapters → normalized conditions model. |
| `src/shared/fonts/font-loader.js`, `fonts/google-fonts.json` | On-demand Google Fonts + the catalog. |
| `src/shared/image-compress.js`, `src/shared/logo.js` | Client-side WebP optimizer + logo validation. |

## B. Port the widget shell (into your iframe app)
| Item | Note |
|---|---|
| **Chat widget HTML skeleton** — inside `preview.html` markup (`.gsb-chat`, `.gsb-launcher`, `#gsbHero`, `#gsbMessages`, `#welcomeLine`, the conditions grid, composer, voice overlay) | The **DOM contract** `applyWidgetConfig` themes. Extract it as your iframe template. |
| `src/widget/widget-runtime.js` | Port the **rendering** parts (conditions card, season banner, message rendering, voice UI); **replace the demo answer-routing with your socket / `answerProvider`.** |

## C. Port the dashboard to React (logic reuses, DOM → components)
| File | Note |
|---|---|
| `index.html` | Dashboard markup — cards, controls, labels, info-tooltip copy → React components (structure + copy port directly). |
| `weather.html` | Weather config tab → React. |
| `src/dashboard/dashboard.js` | State model, `DEFAULTS`, all control logic, `render()`. **Logic ports directly**; DOM manipulation becomes React. Biggest translate job. |
| `src/dashboard/dashboard.css` | Dashboard styling — reuse. |
| `src/dashboard/featured-crop.js`, `src/dashboard/font-picker.js` | Crop tool + font picker → React (canvas/logic reuses). |

## D. Do NOT port — strip (demo-only; details in `DEMO-CODE.md`)
- `src/widget/knowledge/jackson-hole.js` — demo knowledge base
- `src/shared/sample-logo.js` — inlined Jackson Hole logo
- the keyword answer-routing + JH facts inside `src/widget/widget-runtime.js`
- `preview.html` **chrome** (the fake resort homepage) — keep as a **reference**, don't ship
- `public/featured/*`, `src/assets/logo*.png` — demo images
- `vite.config.js`, `package.json` — you'll use your own build

---

## The one-liner
> Copy **bucket A** verbatim (widget renders identically) · port **bucket C** to React
> (admin UI) · wire **bucket B** into your iframe + socket · delete **bucket D**.

## Why "reuse, not rebuild" matters
**Bucket A is what makes production match the prototype.** If the widget CSS/render is
rebuilt from scratch, it *will* drift from the demo. Reuse it and the visitor-facing
widget is identical **by construction** — which is the whole point of shipping a working
reference. When re-scoping: everything in A/B is **port** (translate working, spec'd
code), not **build** (design from zero). The genuine *build* work is the integration
boundary — see `OVERVIEW.md` → "The 3 things to integrate."

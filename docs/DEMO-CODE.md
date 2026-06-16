# Demo / Single-Tenant Code to Strip (Jackson Hole)

**For BotScrew.** This repo runs standalone with **no backend** by hardwiring a single
**Jackson Hole** demo. Everything below is **demo-only** — replace it with per-bot data
from your runtime, or delete it. **Do not port it.**

> The opposite of this list — the actual deliverable — is at the bottom. The Appearance
> dashboard UI, `applyWidgetConfig`, and the config mapper are **not** demo code.

Line numbers are approximate (they drift as the code changes); the file + description is
the durable reference.

---

## 1. Replace / delete — Jackson Hole demo data & the "fake AI"

| Location | What it is | Production replacement |
|---|---|---|
| `src/widget/knowledge/jackson-hole.js` (~160 lines) | JH demo "knowledge base" — official links + curated guidance | BotScrew **Flows / ODIN** |
| `src/widget/widget-runtime.js` — keyword answer routing + hardcoded JH facts (Aerial Tram, Corbet's, Rendezvous… ~L629) | The **fake "AI"** that maps keywords → canned answers | Socket **`answerProvider`** ([SCRIPT-CHATBOT-CONTRACT.md](./SCRIPT-CHATBOT-CONTRACT.md)) |
| `src/widget/widget-runtime.js` — JH resort API URLs + cached fallback snapshot (~L95–98, fallback ~L108/124) | Hardcoded `jacksonhole.com` snow/webcam/parking/lift endpoints + baked offline data | Per-resort feeds via a **server-side proxy** (CORS — see HANDOFF → constraints) |
| `src/widget/widget-runtime.js` — JH coords (~L140–141), webcam defaults (~L46–48), demo season copy (~L34) | Hardwired JH location, cams, and the "April 2026 season wrapped" blurb | Per-bot **weather config** + **appearance config** |
| `src/shared/sample-logo.js`; `SAMPLE_LOGO` (`dashboard.js` ~L163); `JH_LOGO` (`preview.html`) | The Jackson Hole logo inlined as a base64 string | Per-bot **logo** (`imageUrl`) |
| `dashboard.js` `DEFAULTS` + `preview.html` `CONFIG` — JH seed values | `widgetName: "Jackson Hole Support"`, the JH welcome line, season-update copy, coordinates | Per-bot config from **`GET /widget/info/{botId}`** |

## 2. Keep as reference — don't port literally

| Location | What it is | Note |
|---|---|---|
| `preview.html` | Resort-homepage **mock** + the GetSkiBots demo control deck | Sales demo **and** the reference harness showing the iframe/render wiring. The production widget lives inside BotScrew's `script-chatbot.js` iframe — this page is not production. |
| localStorage `gsb_widget_settings` / `gsb_preview_config` + `#cfg=` URL sync | Prototype persistence + Live Preview sync | Replaced by `GET/PATCH` per-bot + the iframe `postMessage` bridge ([INTEGRATION §10](./INTEGRATION.md)) |

---

## 3. NOT demo code — this is the deliverable

Keep and integrate these as-is:

- **`src/widget/apply-config.js`** (`applyWidgetConfig`) — the single config→DOM render layer.
- **`src/widget/chat-widget.css`** — the widget styling.
- **`src/shared/widget-config.js`** — the BotScrew config mapper (`to/fromBotscrewWidgetSettings`).
- **The Appearance dashboard** (`dashboard.js` / `dashboard.css` / `index.html`) — minus the JH seed values in §1.
- **`src/shared/weather/open-meteo.js`**, **`snow-engine.js`**, and the webcam / image-compress / markdown helpers.

**Rule of thumb:** if it renders a configured *widget*, keep it. If it answers questions, names a resort, or carries Jackson Hole data, it's in §1.

# Build Status — where the build is

A feature-by-feature read of what's implemented in this repo versus what remains.
Organized against the agreed scope (epics 1–7). Percentages are a GSB internal
estimate of UI/prototype completeness, **before** the per-bot-ID wiring discount
described at the bottom.

Legend: ✅ built · 🟡 partial · ⬜ mostly open

---

## Summary

| | |
|---|---|
| Strongest area | **Appearance tab (Epic 5)** — ~95% built, the bulk of the UI |
| Live + working | Open-Meteo weather, live conditions card, all appearance controls, save/load persistence |
| Largest open items | Per-bot persistence (cross-cutting), embed loader (7), webcam manager (6.3), conversation-starter admin (3), entry-point orchestration (1) |
| Hard external constraint | Resort snow feeds are CORS-blocked → need server-side fetch (see HANDOFF → constraints) |

---

## By epic

### 1 · Entry points & unified session — 🟡 ~40%
- ✅ The three entry-point **components** exist: chat bubble (launcher), hero search
  bar, standalone search button. Hero-search submit passes the query into chat as
  the first message.
- ⬜ All-three-live-on-homepage orchestration, single shared session across entry
  points, and "focus existing instance vs open new" are **not** wired (needs the
  embed loader + runtime session layer).

### 2 · Responsive & launcher behavior — ✅ high
- ✅ Auto-hide-on-scroll launcher (both Status pill and Slide-in pill, per-style
  default), mobile preview drawer, responsive dashboard.
- 🟡 Mobile "always full-screen chat" exists in the preview; verify against final
  embed.

### 3 · Page-context conversation starters — ⬜ ~25%
- ✅ Starter chips render inside the chat; input placeholder is configurable.
- ⬜ Admin configuration of starters per page/URL, 0–4 count control, and passing
  page context through the embed are **not** built.

### 4 · Chat opening experience
- **4.1 Chat header** — 🟡 logo/name/welcome ✅, webcam hero with fallback ✅;
  per-cam location label + "last updated" partial.
- **4.2 Live conditions block** — ✅ ~70%. Card built; base/summit temp + wind
  **live via Open-Meteo**; snow figures from feed/fallback. Open-endpoint mapper
  exists. Open: an Appearance "turn off conditions" toggle, and visibility/label cells.

### 5 · Appearance tab — ✅ ~95% (the heaviest pre-build)
- **5.1 Logo & branding** ✅ — logo upload, height, corner radius (launcher + panel),
  depth effect, header color, widget name, placeholder, welcome message.
  *Delta:* spec wants JPEG **accepted**; we currently reject it (one-line messaging change).
- **5.2 Launcher bubble** ✅ — all styles (simple/status pill/slide-in/custom), CTA
  text (≤24 glyphs), status-pill feature toggles, Save + live preview.
- **5.3 Configurable icon style** 🟡 — styles done; business-hours auto live-agent not done.
- **5.4 Snowfall** ✅ — realistic/crystalline/storm, intensity, show-on-mobile,
  pause-when-idle, reduced-motion lock.
- **5.5 Search bar** ✅ — radius, thickness, width, placeholder, live preview.
- **5.6 Search button** ✅ — size, shape, background, icon weight, label.
- **5.7 Typography** ✅ — body font, display font, text scale.
- **5.8 Panel layout** ✅ — sidebar/middle/full, blurred background, thumbnails.
- **5.9 Behavior** ✅ — sound, popup preview, ask-for-rating, disable text input.

### 6 · Widget integrations
- **6.1 Weather (Open-Meteo)** ✅ ~75% — coords (base + optional summit), live
  readings preview, widget preview, launcher temp. Default source, works today.
- **6.2 Weather (own endpoint)** 🟡 ~75% — the field-mapper UI exists in
  `weather.html` ("point at any JSON, map fields, poll 15 min"); the widget actually
  consuming a mapped resort feed + per-bot wiring is open.
- **6.3 Webcam v1** ⬜ ~18% — hero image + fallback only. Multi-cam carousel,
  URL auto-detect (still/YouTube/fallback), type badges, per-cam label/timestamp
  admin are **not** built.

### 7 · Installation & embed — ⬜ ~18%
- ✅ Install tab exists and sketches the embed shape (`data-gsb-search`,
  `data-gsb-search-button`).
- ⬜ The three modular embed scripts (main widget / hero search / header icon), the
  loader that mounts them, copy-button snippets with `botId`, and "appearance applied
  from platform" are **not** built.

---

## Cross-cutting discount — per-bot-ID wiring

Everything above is **single-tenant Jackson Hole on `localStorage`**. None of it
loads or saves **per bot ID** through the BotScrew/ODIN API. That wiring threads
through every feature's effort, so while the **UI layer is ~60% pre-built**, realistic
**delivered value against a full productionization estimate is closer to ~45–55%**.

The mapper (`src/shared/widget-config.js`) already emits/consumes the exact BotScrew
config shape, so this layer is "swap two call sites" in concept (see
[`ARCHITECTURE.md`](./ARCHITECTURE.md) → config flow) — the volume is in doing it
across all features + auth + the embed.

---

## Deferred / known gaps

- `preview.html` still runs an **older inline copy** of the widget (not unified onto
  `src/widget/widget-runtime.js`) — so it shows mock weather. Unifying it is the
  proxy task for "a real embedded widget that consumes the saved config."
- **Voice** (mic dictation, TTS, hands-free Voice Mode) is built in the widget but
  hardcoded on, with no dashboard control; full conversational voice needs a backend
  to mint realtime keys.
- **Summer/off-season conditions** — snow depth/season-total cells don't make sense
  off-season; a summer mode is undesigned.
- Resort snow-feed **CORS** → needs a server-side proxy or the resort's own endpoint
  to go fully live.

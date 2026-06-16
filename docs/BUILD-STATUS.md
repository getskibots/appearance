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
| Largest open items | Per-bot persistence (cross-cutting), iframe-app swap into BotScrew's existing `script-chatbot.js` (M1), new GSB modular loaders (7), conversation-starter admin (3), entry-point orchestration (1), Resort Direct feeds (6.2) |
| Hard external constraint | Resort snow feeds are CORS-blocked → need server-side fetch (see HANDOFF → constraints) |

---

## Built vs not built — at a glance (for BotScrew)

**✅ Built & working in this repo (no backend needed):**
- The full **Appearance dashboard** (every control) and the **chat widget UI** (`index.html`, `chat-widget.css` + `widget-runtime.js`).
- **`applyWidgetConfig`** — the single faithful config→DOM path; every appearance field maps to the widget (color, logo, fonts, layout, launcher + depth effect + CTA, status pill, Season Update banner, webcam/featured hero, snowfall, typing, voice toggle, embed components).
- The **BotScrew config mapper** (`to/fromBotscrewWidgetSettings`) — emits/ingests the exact `widgetSettings` shape; **Save/Load** persists it (to localStorage today).
- The **shippable embeddable components**: search bar (`.gsb-embed-search`) + standalone search button — both config-driven, shared by the dashboard preview AND the demo.
- The **prospect demo page** (`preview.html`): resort-homepage mock, three entry points, the GetSkiBots control deck, the Live Preview sync, slide-away-on-scroll, benefits band.
- **Open-Meteo** live weather + conditions card; the shared **snowfall engine**; depth effects, typography, layouts, launcher styles.

**⬜ Not built — BotScrew / production wiring:**
- **Per-bot persistence** (the big one): load/save config per `botId` via `GET /widget/info/{botId}` + `PATCH /private/bot/{id}/widget` instead of localStorage. Threads through everything — the mapper already emits the right shape (see [INTEGRATION.md](./INTEGRATION.md) §3a, §9).
- **`answerProvider`** — streaming + structured-message rendering behind the seam (your socket → the widget). Stub/curated answers only today (§3c).
- **`gsbAppearance` persistence decision** — confirm your config can store the opaque JSON block (Option B = zero backend change) or add one field (§4, the one open decision).
- **New GSB embed loaders** — only the `data-gsb-search` / `data-gsb-search-button` modular entry points are unbuilt (sketched in the Install tab, not implemented; Epic 7). The **primary chat-bubble loader already exists** — it's BotScrew's `script-chatbot.js` (launcher + greeting + iframe + postMessage bridge). We adapt to it, not rebuild it. See [SCRIPT-CHATBOT-CONTRACT.md](./SCRIPT-CHATBOT-CONTRACT.md).
- **Season Update flow** — the "Get live updates" picker defaults to **"Connect flow…"** and is a shell (stubbed flow list + "+ Create new flow"). Wire it to the bot's real Flows + builder deep-link; runtime fills the banner from the flow's output. Spec: [INTEGRATION §5a](./INTEGRATION.md).
- **Welcome-in-Appearance** → write to your atom API (§5 provenance).
- **Demo per-bot wiring** — production selects the bot by `publicIdentifier` in the URL and loads `/widget/info/{botId}`; the demo's localStorage/`#cfg=` sync is a prototype hand-off (INTEGRATION §10).
- **Backend-only**: resort snow feeds (CORS → server-side fetch), realtime-voice key minting.

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

### 3 · Page-context conversation starters — 🟡 ~50%
- ✅ Starter chips render inside the chat; input placeholder is configurable.
- ✅ **Hero-search starter chips (0–4) are now admin-configurable** in Appearance →
  Embeddable components: type up to 4 chips, see them live beneath the bar, and the
  install snippet auto-generates with `data-gsb-placeholder` + `data-gsb-starters`
  (pipe-delimited). The demo hero renders them and a click opens chat with the query.
  Contract: [`EMBED-SNIPPETS.md`](./EMBED-SNIPPETS.md).
- ⬜ Still open: **per-page/URL** management (today the chips are authored per-snippet,
  which already gives different chips per page via inline `data-gsb-starters`; an
  admin-managed `data-gsb-page` model is the future option), and **the loader that reads
  the attrs on a live host page** (Epic 7).

### 4 · Chat opening experience
- **4.1 Chat header** — 🟡 logo/name/welcome ✅, webcam hero with fallback ✅;
  per-cam location label + "last updated" partial.
- **4.2 Live conditions block** — ✅ ~70%. Card built; base/summit temp + wind
  **live via Open-Meteo**; the snow figures (24h / season total / depth) are
  **leftover resort-feed cells with no Open-Meteo source** (static fallback) and are
  slated to be retired. A **Winter/Summer mode toggle** is **built on the Weather config
  page** (`weather.html`, Open-Meteo card): one season cell-map swaps both the Live Readings
  grid and the chat-preview card — winter = base/summit temp, summit wind, conditions, 5-day
  snowfall, snow level; summer = temp, feels-like, conditions, wind, UV index, precip.
  `seasonMode` persists in `gsb-weather-config-v1`. ✅ The same season swap is **also wired into
  the production widget conditions card** (`widget-runtime.js` `resolveSeasonMode` + `omSeasonCells`,
  summer default). Scoped to Open-Meteo on purpose; Resort Direct defines its own season
  handling when built. The **"turn off conditions" toggle is now built** — the Appearance
  **Weather readout** switch is one control for all weather: off hides both the launcher
  temperature *and* the in-chat conditions card (`body[data-show-conditions="false"]`).

### 5 · Appearance tab — ✅ ~95% (the heaviest pre-build)
- **5.1 Identity & branding** ✅ — logo upload (JPEG now **accepted with a warning**,
  no longer rejected), height, header color, widget name, placeholder, welcome message, plus
  the **Recent update** control that feeds the chat's Season Update banner (Write-it-myself /
  Get-live-updates source toggle). The Get-live-updates picker is now a **flow shell**: a
  stubbed list of the bot's Flows grouped under "Your flows" + a **"+ Create new flow"** action
  that opens the builder in a new tab — production lists the bot's real Flows and deep-links the
  builder (spec: [INTEGRATION.md §5a](./INTEGRATION.md)). Two-column card. (Corner radius now
  lives in the **Launcher** card.)
- **5.1b Webcams & featured image** ✅ — hero source (webcam / featured image / none).
  **Webcams** and **featured images** both use a multi-card editor (horizontal cards,
  add/remove, drag-to-reorder) and render through one shared carousel (3 dots, hover
  arrows, touch swipe, auto-rotate). Webcams carry a LIVE pill + "Updated just now";
  featured images are caption-only with an optional tap-through link (no LIVE chrome) and
  rotate a touch slower; **uploaded** featured images open a per-card **crop & reposition**
  surface (drag to frame, zoom, live-baked to an optimized 16:9), while URL images cover-fit.
  Plus a **Demo background image** (URL or upload) that themes the
  prospect demo page with a **Light/Dark** text treatment. (Background image is demo-only
  today; reserved for an optional Chat UI background later.)
- **5.2 Launcher bubble** ✅ — all styles (simple/status pill/slide-in/custom), CTA
  text (≤24 glyphs), status-pill feature toggles, Save + live preview.
- **5.3 Configurable icon style** 🟡 — styles done; business-hours auto live-agent not done.
- **5.4 Animations & effects** ✅ — panel open animation (scale/slide/fade), typing
  indicator (dots/orb/label), depth effect (none/shadow/glow/radiate), and ambient
  snowfall (realistic/crystalline/storm, intensity, show-on-mobile, pause-when-idle,
  reduced-motion lock) — snowfall **off by default**, the heaviest continuous effect.
- **5.5 Search bar** ✅ — radius, thickness, width, placeholder, live preview.
- **5.6 Search button** ✅ — size, shape, background, icon weight, label.
- **5.7 Typography** ✅ — body font, display font, text scale.
- **5.8 Panel layout** ✅ — Side / Full (two-column hero+chat), blurred background, thumbnails.
- **5.9 Behavior** ✅ — **realtime voice** on/off (hides the hands-free Voice Mode
  button + overlay in the chat; dictation mic is separate), sound, popup preview,
  ask-for-rating, disable text input.

### 6 · Widget integrations
- **6.1 Weather (Open-Meteo)** ✅ ~85% — coords (base + optional summit), live readings,
  chat preview, widget launcher temp. The Weather tab is now a **two-card accordion**
  (Open-Meteo = active, Resort Direct = coming soon) matching the Appearance accordion;
  **source-aware save** (`gsb-weather-config-v1.source`, restored on load, ✓-marked active
  card); a **Location Detail** panel (reverse-geocoded place, model-DEM elevation, base↔summit
  distance, sign-flip/elevation validation); a **⚡ Live preview** toggle (instant debounced
  fetch as you type, without saving). Works today.
- **6.2 Weather (Resort Direct / own endpoint)** ⬜ **coming soon** — the prototype 3-step
  field-mapper was **removed**; Resort Direct is a tidy "Coming soon" card. The real design
  (paste URL → auto-detect one of 7 feed-shape families → auto-map → save, with a server-side
  poller for the CORS-blocked half) is fully captured in
  [`RESORT-DIRECT-FEEDS.md`](./RESORT-DIRECT-FEEDS.md). Big finding: **OpenSnow already returns
  our normalized model**, so it's a near-zero-mapping second source.
- **6.3 Webcam — multi-cam** ✅ (multi-cam re-added, with a polished treatment). Built:
  a **webcam card list** in the Appearance card — each cam is a card with a **live preview**
  thumbnail (+ LIVE badge), URL, **auto-detected type pill with a "change" override** menu
  (still / YouTube / iframe / HLS / MP4), and **Title + Subtitle** (e.g. "Tram Station" +
  "9,095 ft"). Renders **every format** (`webcam-render.js`: `<img>` / `<iframe>` /
  `<video>`+hls.js / poster + "Open live cam ↗" / blocked notice). The chat hero is a full
  **carousel** (`renderWebcamCarousel`): slide track, **dots**, **hover arrows + swipe/drag**, **6s
  auto-rotate** with **hover + 15s manual pause**, and a per-slide **caption** (title · sub ·
  "Updated just now") + LIVE pill. Old single `hero.webcam` migrates to
  `hero.webcams[]`. **Drag-to-reorder is built** (drag the handle to set rotation order).
  Remaining to fully close = cross-cutting **per-bot save/load** (shared with every feature).

### 7 · Installation & embed — ⬜ ~25%
- ✅ The embed shape is defined and the **search-bar snippet is now live + copyable**
  (`<div data-gsb-search …>` auto-generated with `data-gsb-placeholder` /
  `data-gsb-starters`, copy button). Per-page contract: [`EMBED-SNIPPETS.md`](./EMBED-SNIPPETS.md).
- ⬜ The three modular embed scripts (main widget / hero search / header icon), the
  loader that mounts them + reads the data-attrs on a host page, snippets carrying
  `botId`, and "appearance applied from platform" are **not** built.

### 8 · Shareable prospect demo page — 🟡 demo built; per-prospect backdrop pending
A self-serve sales tool: one link sales sends a prospect that opens a site with the
GetSkiBots chat already in place.
- **Built:** [`preview.html`](../preview.html) is a polished, **resort-agnostic homepage
  mock** with the widget embedded and all three entry points (header search icon, hero
  search, chat launcher). It is now the **Live Preview target** — the dashboard button
  opens it themed by the current config, and the widget is driven **entirely** by
  `applyWidgetConfig` (every appearance field maps to the Chat UI). See
  [INTEGRATION.md §10](./INTEGRATION.md). This is the generic "their brand on a believable
  site" demo.
- **Still pending — per-prospect backdrop:** open the prospect's *own* site behind the
  chat via a locked query param (e.g. `?site=<url>&lock=1`), hiding the address input — one
  link per prospect, generated by sales.
- **Constraint (important):** most resort sites block iframing (`X-Frame-Options` / CSP
  `frame-ancestors`), so a live iframe backdrop comes up **blank** for many of them — the
  worst failure mode for a sales demo. Use a **server-side screenshot** of the resort
  homepage as a static backdrop (always renders) with the live widget overlaid; live
  iframes and header-stripping proxies are fragile and not prospect-safe.
- **Per-bot wiring (production):** today the demo is fed config by a single-tenant
  localStorage + `#cfg=` hash sync (prototype only). Production must select the bot by
  `publicIdentifier` in the URL — the existing
  `…/widget-demo/{publicIdentifier}?isTestMode=true` structure — and load
  `GET /widget/info/{botId}` into `applyWidgetConfig`. See
  [INTEGRATION.md §10](./INTEGRATION.md).

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

- `preview.html` now renders the widget **fully from config** via `applyWidgetConfig` —
  every appearance field maps to the Chat UI (color, fonts, layout, launcher + depth
  effect + CTA, Season Update banner, webcam/featured hero, snowfall, voice, embed
  components). The dashboard's **Live Preview** button feeds it the live config
  (localStorage + `#cfg=` hash; an open tab live-updates via the `storage` event). ✅ The
  remaining piece is **per-bot production wiring**: select the bot by `publicIdentifier` in
  the URL and load `/widget/info/{botId}` instead of the localStorage/hash prototype sync —
  see [INTEGRATION.md §10](./INTEGRATION.md).
- **Voice** (mic dictation, TTS, hands-free Voice Mode) is built in the widget and now
  has a dashboard control — **Behavior → Realtime voice** hides the hands-free Voice
  Mode when off. Full conversational voice still needs a backend to mint realtime keys.
- **Winter/Summer mode** — ✅ built on the Weather config page (see §4.2) **and** wired into
  the production widget conditions card (`widget-runtime.js`, summer default).
- **Season Update "Automatic" source** — the source toggle + data-source picker are
  wired in the UI as a placeholder; consuming a live BotScrew Flow / AI Action output
  (rendered into the banner) is open work. Manual copy works today.
- Resort snow-feed **CORS** → needs a server-side proxy or the resort's own endpoint
  to go fully live.

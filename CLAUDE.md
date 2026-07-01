# CLAUDE.md — repo orientation for AI assistants (and new devs)

**This is the GetSkiBots "Chat UI v3" prototype** — an admin **Appearance dashboard**
plus the **embeddable chat widget** it configures. It's a working, thoroughly documented
reference.

**If you're from BotScrew:** your job is to **port this into production (your React
runtime) so production mirrors the prototype** — *not* to rebuild it from scratch. Most
of the UI is already built and working; the real effort is the integration seams.

## Read these first (in order)
1. `docs/OVERVIEW.md` — one-page front door: how it ports, the 3 integration points, the Appearance-tab inventory.
2. `docs/PORT-MAP.md` — the **exact files** to reuse / port / strip.
3. `docs/SCRIPT-CHATBOT-CONTRACT.md` — the host-page loader + iframe/postMessage contract. **Milestone 1 is an iframe app-swap, not a loader rewrite** — your `script-chatbot.js` already exists.
4. `docs/botscrew-widget-settings.md` — the data contract (your native fields + the opaque `gsbAppearance` block).
5. `docs/DEMO-CODE.md` — the Jackson Hole / demo-only code to **STRIP** (do not port).

## Tech at a glance
- **Vanilla Vite multi-page. No framework. One npm dep (`vite`). Zero production dependencies.**
- Runtime externals, all lazy/CDN: `hls.js` (HLS webcams), `gtag.js` (analytics), Google Fonts, Open-Meteo (weather API).
- `npm install && npm run dev` serves `index.html` (dashboard), `preview.html` (demo), `weather.html` (weather tab). `npm run build` emits to `dist/`.

## The 4 golden rules for the port
1. **Reuse the render layer verbatim.** `src/widget/apply-config.js` (`applyWidgetConfig`) + `src/widget/chat-widget.css` + `src/shared/tokens.css` are framework-agnostic — drop them into a React component. **This is why production matches the prototype. Do NOT rewrite the widget CSS/render — that's how it drifts.**
2. **Port the dashboard to React.** `src/dashboard/*` + `index.html`/`weather.html`: the *logic and copy* port directly; the DOM manipulation becomes components. `dashboard.css` reuses.
3. **Strip the demo.** Everything in `docs/DEMO-CODE.md` (JH knowledge base, the keyword "AI", baked feeds/coords/logo). Rule of thumb: if it answers questions or carries Jackson Hole data, it's not part of the deliverable.
4. **The integration boundary is the real work** — per-bot persistence (`GET/PATCH`, storing the opaque `gsbAppearance` block), wiring your socket to the `answerProvider` seam, and the iframe app-swap. See `docs/OVERVIEW.md` → "The 3 things to integrate."

## Ground truth
- The **live demo** (https://getskibots.github.io/appearance/) is the reference — diff production against it.
- The prototype is **single-tenant Jackson Hole on localStorage**; production swaps the config *source* (`/widget/info/{botId}`), **not the render layer**.
- All config round-trips through `src/shared/widget-config.js` (`to/fromBotscrewWidgetSettings`).
- The docs are authoritative; when unsure, prefer the docs + a diff against the live demo.

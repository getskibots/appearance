# Scope ↔ Build — 1:1 against Daria's scope doc

A line-by-line read of Daria's scope (Epics 1–7) against what's actually in this repo,
with GSB notes/answers for each item and the **exact location** to read more.

Status legend: ✅ built & working · 🟡 partial · ⬜ not built (production wiring)

> **One cross-cutting caveat for every row:** everything below is built **single-tenant
> (Jackson Hole) on `localStorage`**. The one big shared open item is **per-bot
> persistence** — load/save each row's config per `botId` via `GET /widget/info/{botId}` +
> `PATCH /private/bot/{id}/widget` instead of localStorage. The config **mapper already
> emits the exact BotScrew `widgetSettings` shape**, so this is "swap two call sites" in
> concept. See [INTEGRATION.md §3a + §9](./INTEGRATION.md) and BUILD-STATUS "Cross-cutting
> discount."

---

## Epic 1 — Entry Points

| Req | Status | GSB note / answer | Where to read more |
|---|---|---|---|
| **1.1** Multiple bot entry points (3) | 🟡 ~40% | All **three entry-point components exist and are live together on `preview.html`**: header search icon, hero search bar, chat launcher. What's not built is the **production embed orchestration** (mounting all three on a real resort page via the loader scripts — Epic 7). | [BUILD-STATUS §1 + §8](./BUILD-STATUS.md); demo `preview.html`; [INTEGRATION §2 (embed model) + §10](./INTEGRATION.md) |
| **1.2** Unified bot session | 🟡 | ✅ Hero-search/​magnifying-glass query is **passed into the chat as the first message** (component-level, working in the demo). ⬜ A **single shared session across all three entry points** and **"focus existing instance vs. open a second"** require the runtime session layer that ships with the embed loader (Epic 7). | [BUILD-STATUS §1](./BUILD-STATUS.md); [INTEGRATION §6 (conversation channel)](./INTEGRATION.md) |

---

## Epic 2 — UI & Experience

| Req | Status | GSB note / answer | Where to read more |
|---|---|---|---|
| **2.1** Responsive behavior | ✅ high (1 verify) | ✅ Desktop follows the admin panel style (expand/minimize/close). ✅ **Auto-hide-on-scroll launcher** works on **both** Status pill and Slide-in pill (slides away on scroll-down, returns on scroll-up / at top). 🟡 **Mobile "always full-screen chat"** is implemented in the preview — **verify once against the final production embed**. | [BUILD-STATUS §2](./BUILD-STATUS.md); panel/mobile rules in `src/widget/chat-widget.css`; [INTEGRATION §10](./INTEGRATION.md) |

---

## Epic 3 — Conversation Starters

| Req | Status | GSB note / answer | Where to read more |
|---|---|---|---|
| **3.1** Page-context conversation starters | ⬜ ~25% | ✅ **Starter chips render inside the chat**, and the **search placeholder is configurable separately** from starters (as required). ⬜ **Admin-configures starters per page/URL**, the **0–4 count control**, on/off independent of placeholder, and **passing page context through the embed** are **not** built — they depend on the embed script (Epic 7) carrying page context. | [BUILD-STATUS §3](./BUILD-STATUS.md); placeholder control in the Appearance tab; embed context in [INTEGRATION §2 + §3a](./INTEGRATION.md) |

---

## Epic 4 — Chat Opening Experience

| Req | Status | GSB note / answer | Where to read more |
|---|---|---|---|
| **4.1** Chat header — visual & info | 🟡 | ✅ Static header image, ✅ **live webcam hero with static-image fallback** when offline, ✅ resort name / welcome message (admin-configurable), ✅ conversation starters in header. 🟡 **Per-cam location label** (admin-entered, *not* pulled from API — matches your spec) and **"Last updated" timestamp** are partial. Image-behind + webcam-inset combined layout is still TBD (as you flagged). | [BUILD-STATUS §4.1](./BUILD-STATUS.md); [INTEGRATION §5 (content provenance)](./INTEGRATION.md); hero render in `src/widget/widget-runtime.js` |
| **4.2** Live conditions block | ✅ ~70% | ✅ Conditions card shows on open; **base/summit temp + summit wind are live via Open-Meteo**. ✅ **Open-Meteo (default)** + **resort own endpoint** sources (6.2 is "coming soon"). ✅ **"If a field is missing, that cell is hidden."** ✅ **NOW BUILT: the whole block can be turned off** — the Appearance **Weather readout** toggle is one switch that hides both the launcher temp and the in-chat card. ✅ **Lodging/non-ski "weather-only" view** via Open-Meteo (summer mode on the weather page). ⚠️ The **snow figures (24h / season / depth)** are leftover static cells with no Open-Meteo source and are **slated to be retired** in the production card. | [BUILD-STATUS §4.2 + §6.1 + §6.2](./BUILD-STATUS.md); [RESORT-DIRECT-FEEDS.md](./RESORT-DIRECT-FEEDS.md); weather page `weather.html` |

---

## Epic 5 — Appearance Tab (the heaviest pre-build — ✅ ~95%)

| Req | Status | GSB note / answer | Where to read more |
|---|---|---|---|
| **5.1** Logo & branding | ✅ | ✅ **JPEG now accepted** with a guidance warning (the "JPEGs not accepted" hard-reject is removed — prefers PNG/SVG). ✅ Logo height, ✅ **corner radius applied to both launcher bubble AND open panel** (Jackson Hole **zero-radius / sharp rectangular** use case supported), ✅ depth effect, ✅ header color picker, ✅ widget name, ✅ input placeholder, ✅ **welcome message** (shown on open). | [BUILD-STATUS §5.1](./BUILD-STATUS.md); [INTEGRATION §4 (config contract) + §5](./INTEGRATION.md); `src/dashboard/dashboard.js`, `src/widget/apply-config.js` |
| **5.2** Launcher bubble | ✅ | ✅ All styles (Simple / Status pill / Slide-in vertical / Custom upload), ✅ slide-in configurable text label, ✅ **status-pill feature toggles (live agent / weather / "Need help?" CTA) reflected on the launcher**, ✅ CTA text field (≤24 chars), ✅ Save Changes + live preview. *(Just refined: the pill now shrink-wraps to its content so toggling features off leaves no dead space.)* | [BUILD-STATUS §5.2](./BUILD-STATUS.md); `src/widget/chat-widget.css` (launcher) |
| **5.3** Configurable chat icon style | 🟡 | ✅ Traditional / Enhanced+Weather / Live-Agent styles all selectable; ✅ **weather element collapses gracefully** when no data (and now also when Weather readout is off — see 4.2). 🟡 **Live-agent following business hours automatically** is **not** built (manual on/off works). | [BUILD-STATUS §5.3](./BUILD-STATUS.md) |
| **5.4** Snowfall / effects | ✅ | ✅ Effect type (Realistic / Crystalline / Storm), intensity slider, show-on-mobile, pause-when-idle, **respect reduced-motion** (accessibility). Off by default (heaviest continuous effect). Save + live preview. | [BUILD-STATUS §5.4](./BUILD-STATUS.md); `src/shared/snow-engine.js` |
| **5.5** Search bar | ✅ | ✅ Border radius, border thickness, width, placeholder — all live-previewed. Drives the **real shippable `.gsb-embed-search` component** (shared by dashboard + demo). | [BUILD-STATUS §5.5](./BUILD-STATUS.md); component in `src/widget/chat-widget.css` |
| **5.6** Search button | ✅ | ✅ Size, shape, background, icon weight, label — live-previewed. Standalone button component. | [BUILD-STATUS §5.6](./BUILD-STATUS.md) |
| **5.7** Typography | ✅ | ✅ Body font, display font, base text size — live-previewed; fonts flow through to the chat UI. | [BUILD-STATUS §5.7](./BUILD-STATUS.md) |
| **5.8** Panel layout | ✅ | ✅ Sidebar / Middle / Full (two-column hero+chat), ✅ blurred-background toggle, ✅ thumbnail previews + descriptions, ✅ applies globally regardless of entry point, ✅ **mobile exception — always full-screen**. Save + live preview. | [BUILD-STATUS §5.8](./BUILD-STATUS.md) |
| **5.9** Behavior | ✅ | ✅ Sound notifications, ✅ pop-up message preview, ✅ ask-for-rating, ✅ disable text input (all languages). **Bonus:** realtime-voice on/off toggle. | [BUILD-STATUS §5.9](./BUILD-STATUS.md) |

---

## Epic 6 — Widget Integrations

| Req | Status | GSB note / answer | Where to read more |
|---|---|---|---|
| **6.1** Weather (Open-Meteo) | ✅ ~85% | ✅ Admin enters lat / long / elevation for **base + optional summit**; ✅ **live readings panel** in the dashboard; ✅ **chat preview** of how it appears to guests; ✅ launcher temp + condition icon; ✅ in-chat base/summit/wind. Two-card accordion (Open-Meteo active), source-aware save, **Location Detail** validation panel, **⚡ Live preview** as-you-type. Works today. | [BUILD-STATUS §6.1](./BUILD-STATUS.md); `weather.html` |
| **6.2** Weather (own endpoint) | ⬜ coming soon | The prototype 3-step field-mapper was **removed** in favor of a tidy "Coming soon" card. The **full real design** (paste URL → auto-detect one of 7 feed-shape families → auto-map → save, with a server-side poller for CORS-blocked feeds) is captured in detail. **Notable finding:** OpenSnow already returns our normalized model → near-zero-mapping second source. | [BUILD-STATUS §6.2](./BUILD-STATUS.md); **[RESORT-DIRECT-FEEDS.md](./RESORT-DIRECT-FEEDS.md)** |
| **6.3** Webcam v1 | ⬜ ~18% | ✅ Single hero webcam + static fallback only. ⬜ Not built: **URL auto-detect** (still / YouTube / fallback), **multi-cam carousel** (6s rotate, 15s manual pause, swipe), **type badges**, **per-cam label + "last updated."** Your v1 **exclusions** (Roundshot 360, iframe embeds, HLS/MP4) are understood — dashboard should still capture the URL for future support. | [BUILD-STATUS §6.3](./BUILD-STATUS.md) |

---

## Epic 7 — Installation & Embed

| Req | Status | GSB note / answer | Where to read more |
|---|---|---|---|
| **7.1** Modular embed scripts | ⬜ ~18% | ✅ Install tab exists and **sketches the embed shape** (`data-gsb-search`, `data-gsb-search-button`). ⬜ Not built: the **three separate scripts** (main widget — unchanged for backward-compat / hero search / header icon), the **loader that mounts them**, **copy-button snippets with `botId`**, and "appearance applied from the platform (no resort CSS needed)." This epic is also what unblocks 1.1, 1.2, and 3.1 (page-context + session). | [BUILD-STATUS §7](./BUILD-STATUS.md); embed model in [INTEGRATION §2 + §3](./INTEGRATION.md) |

---

## What's needed to complete the handover (the shared open items)

These thread across multiple rows above — once decided/wired, most rows flip to ✅:

1. **Per-bot persistence** — `GET /widget/info/{botId}` to load + `PATCH /private/bot/{id}/widget` to save, replacing localStorage. Mapper already emits the right shape. → [INTEGRATION §3a + §9](./INTEGRATION.md)
2. **`gsbAppearance` storage decision** (the one open product decision) — confirm the opaque JSON block can be stored as-is (**Option B = zero backend change**) or add one field. → [INTEGRATION §4 + §8](./INTEGRATION.md), [botscrew-widget-settings.md](./botscrew-widget-settings.md)
3. **`answerProvider`** — wire your socket/ODIN answers (streaming + structured messages) behind the seam; curated/stub answers today. → [INTEGRATION §3c + §6](./INTEGRATION.md)
4. **Embed loader (Epic 7)** — unblocks entry-point orchestration, unified session, and page-context starters.
5. **Backend-only constraints** — resort snow feeds are **CORS-blocked** (need server-side fetch); realtime-voice key minting. → [HANDOFF "Important constraints"](./HANDOFF.md)

## Doc index (exact files)

| Doc | What it answers |
|---|---|
| [BUILD-STATUS.md](./BUILD-STATUS.md) | Feature-by-feature built/not-built, organized by epic 1–7 (matches this mapping) |
| [INTEGRATION.md](./INTEGRATION.md) | The BotScrew drop-in spec: embed model (§2), the seams you wire (§3), config contract (§4), provenance (§5), demo wiring (§10) |
| [HANDOFF.md](./HANDOFF.md) | Engineering handoff: repo map, runtime model, integration boundary, **constraints** |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Internal architecture + config flow |
| [RESORT-DIRECT-FEEDS.md](./RESORT-DIRECT-FEEDS.md) | The full 6.2 resort-own-endpoint design (feed families, auto-mapping, poller) |
| [botscrew-widget-settings.md](./botscrew-widget-settings.md) | The exact `widgetSettings` JSON shape the mapper emits/ingests |

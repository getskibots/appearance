# Analytics — Chat Widget Event Layer

How GetSkiBots tracks chat usage, what's built, what BotScrew's runtime already
exposes, and the roadmap. The emitter is `src/shared/analytics.js`.

---

## Destinations (every event fans out to up to 3)

| # | Destination | When | Configured where |
|---|---|---|---|
| 1 | **GetSkiBots' GA4** (`GSB_GA4_ID = G-BN9CX96J18`, the dedicated Get Ski Bots property) | **always** | Hardcoded in the widget — NOT stored in BotScrew |
| 2 | **The resort's GA4** | only when set | Appearance → **Behavior → Google Analytics Measurement ID** (`gsbAppearance.analytics.ga4MeasurementId`, blank = off) |
| 3 | **Console** (`[GSB Analytics] …`) | debug/testing | `gsbAnalyticsDebug(true)` in the browser console |

- **Console-first & ad-blocker safe:** events are fully testable in console-only mode; if gtag is blocked/absent the widget keeps working with no errors.
- **GA is opt-in** (`init({ enableGA:true })`) — the prototype/demo never sends to GA, so local testing can't pollute the real property.
- **Admin/dashboard usage** (resort partners *using the Appearance tool*) is tracked by **BotScrew's existing dashboard tag**, not by us — don't add a second one.
- **Privacy:** never send raw message *text* to GA. "Top questions" should come from BotScrew's flow/intent layer (categories), not the guest's literal words.

---

## Events we fire today ✅

snake_case names, primitive props (GA4 convention).

| Event | Props | Fires when |
|---|---|---|
| `widget_opened` | `entry_point` (`header`/`hero`/`bubble`) | The panel opens (each time) |
| `conversation_started` | `entry_point` | First user message — **once per session** (no double-count across entry points) |
| `message_sent` | `turn_number` | Each user message |
| `starter_clicked` | `starter_text` | A conversation-starter chip — **both** in-chat chips *and* hero-bar starters |
| `webcam_viewed` | — | Webcam hero shown |
| `voice_mode_used` | — | Hands-free voice mode opened |
| `handoff_to_human` | `turn_number` | Conversation routed to a live agent (**containment signal**) |
| `widget_closed` | `turn_count`, `duration_seconds` | The panel closes (each time) |
| `conversation_ended` | `turn_count`, **`contained`**, `duration_seconds` | Session end (`visibilitychange → hidden`) — **once per session** |
| `outbound_click` | `destination`, `context` | A booking/ticket/lesson link is clicked. `context`: `message`/`welcome`/`season_banner`/`featured`/`webcam`. **The conversion signal.** |

**The money metrics:**
- **Containment rate** = `conversation_ended` where `contained:true` ÷ all conversations. `contained` = ended *without* a `handoff_to_human`.
- **Conversion** = `outbound_click` (chat → booking/ticket/lesson).

> Session-end is currently `visibilitychange → hidden` (one clean `conversation_ended` per visit). It's emitted from one function and **swappable** (chat-close or idle-timeout) in a 1–2 line change if we redefine "a conversation."

---

## BotScrew signals we can map to GA (their runtime already exposes these)

From the [host-page contract](./SCRIPT-CHATBOT-CONTRACT.md) — **don't rebuild these**, hook them. (Names from our bundle review — validate against the live `script-chatbot.js`.)

| BotScrew signal | → GA event | Resort value |
|---|---|---|
| `POST /bot/{botId}/analytics/feedback/{chatId}` | `conversation_rated { rating }` | **CSAT / quality** |
| `GET /greeting` + `POST/PATCH /greeting/event` | `greeting_shown`, `greeting_submitted` | Proactive-popup conversion |
| `POST /chat/{chatId}/action` | `quick_reply_clicked { value }` | Which AI suggestions drive action |
| `GET /persistentMenu` | `menu_opened`, `menu_item_clicked` | Navigation intent |
| socket `streamable_text` (START→STORED) | `ai_reply_received` (+ latency) | Response speed/quality |
| postMessage `zoom-image` | `image_zoomed` | Webcam/featured engagement |

---

## Roadmap (prioritized for resort value)

| Priority | Event | Owner | Notes |
|---|---|---|---|
| ✅ Done | `outbound_click` | **GSB** | Shipped — the conversion signal |
| 🔜 High | `conversation_rated` | BotScrew-sourced | Mirror the feedback endpoint → CSAT |
| 🔜 High | `greeting_shown` / `greeting_submitted` | BotScrew-sourced | Top-of-funnel popup |
| Med | `quick_reply_clicked` | BotScrew-sourced | In-conversation actions |
| Med | deflection (opened, no message) | GSB | Derivable in GA, or an explicit event |
| Low | `menu_*`, `image_zoomed`, language selected | mixed | Nice-to-have |

**Ownership:** our 10 events are GSB (fired from the Chat UI). The BotScrew-sourced ones are cleanest if **BotScrew emits them to GA**, or we hook the `postMessage` bridge / observe their API calls — a quick coordination item for Oleksa.

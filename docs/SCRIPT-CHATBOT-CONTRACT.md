# BotScrew Host-Page Loader Contract (`script-chatbot.js`)

**Status:** derived from a review of the shipped `script-chatbot.js` bundle.
**Validate before wiring:** the message names, endpoints, and attributes below were
read from the bundle, not from BotScrew's source. Diff them against the actual file
(`https://bots.getskitickets.com/widget/script-chatbot.js`) before hardcoding any of
them into the GSB iframe app.

---

## Why this doc exists

Earlier handoff notes described "the embed loader" as **unbuilt**. That was imprecise.
BotScrew's primary chat loader **already exists** — `script-chatbot.js` is the
host-page snippet/controller. It is **not** the chat UI; it's the parent-page wrapper
that creates the iframe the chat UI lives in.

**Consequence:** Milestone 1 is an **iframe chat-app swap**, not a loader rewrite. We
keep BotScrew's loader, launcher, greeting popup, iframe, socket, and APIs. We provide
the new iframe UI, the Appearance dashboard, the config mapper, and the `gsbAppearance`
extension block. Do **not** rewrite `script-chatbot.js`, do **not** change the customer
embed snippet, do **not** move Appearance settings into script-tag `data-*` attributes.

---

## The three layers

```
Layer 1 — Host-page snippet        Owned by BotScrew (script-chatbot.js)
  launcher bubble · greeting popup · iframe creation · parent resize/open/close ·
  background dim · mobile scroll lock · postMessage bridge · per-bot localStorage

Layer 2 — Iframe chat app          Target for the GetSkiBots widget UI
  header · messages · composer · hero webcam/featured image · conditions card ·
  theme · layout · voice UI · snowfall/effects

Layer 3 — Admin Appearance dash    Built in this repo (index.html)
  edits config · previews config · maps state → BotScrew widget settings
```

The Appearance tab is Layer 3. The widget preview/runtime is Layer 2. BotScrew owns
Layer 1.

> **Launcher caveat.** The launcher bubble is rendered by Layer 1 (the parent script),
> *outside* the iframe. Today's `script-chatbot.js` supports the basic bubble +
> greeting popup. The dashboard's richer launcher styles — **Status pill, Slide-in
> pill, launcher depth effects, in-launcher weather/status, custom CTA layout** — are
> Layer-1 concerns that require parent-script changes. They are valid for the prospect
> demo and the end-state, but in a Milestone-1 production embed the visitor sees
> BotScrew's launcher until Layer 1 is updated (Milestone 3). See "Milestones" below.

---

## What the snippet owns (observed behavior)

- Reads the installed `<script>` tag; reads `data-bot-id` / `bot-id` and
  `data-server-url` / `server-url`.
- Derives the iframe `src` by stripping `script-chatbot.js` from the script `src`.
- Fetches public launcher/greeting settings: `GET /public/greeting-settings/{botId}`.
- Creates the iframe, the floating launcher bubble, and the greeting popup.
- Handles background dim, mobile scroll locking, and iframe resizing.
- Stores per-bot widget state in `localStorage`; coordinates cross-tab open state via
  `tabs-{botId}`.
- Sends `initialization` data into the iframe via `postMessage`; listens for iframe
  messages (`resize-widget`, `toggle-widget`, `widget-background`,
  `update-local-storage`, `update-greeting`, …).

## The customer embed snippet (stays as-is)

```html
<script
  type="text/javascript"
  id="chatbot-initials-script"
  src="https://bots.getskitickets.com/widget/script-chatbot.js"
  data-server-url="https://bots.getskitickets.com/api"
  data-bot-id="BOT_PUBLIC_IDENTIFIER">
</script>
```

The script tag is a **bootstrapper only**: `data-server-url` = where the backend is,
`data-bot-id` = which bot/public identifier to load. Appearance configuration lives
**behind the bot ID** in BotScrew widget settings, never in the tag.

---

## Parent ↔ iframe `postMessage` protocol

**Parent → iframe**

```
initialization · reset-chat-history · open-widget · submit-greeting ·
close-greeting · is-widget-open-at-some-tab · widget-resize-screen
```

**Iframe → parent**

```
widget-background · zoom-image · widget-set-url · resize-widget · update-greeting ·
reload-page · clear-storage · toggle-widget · update-local-storage ·
set-browser-tab-name · remove-event-listeners
```

### What the GSB iframe app must do

Listen for `initialization` and boot from it:

```js
window.addEventListener('message', async (event) => {
  if (event.data?.type !== 'initialization') return;
  const { botId, serverUrl, url, attributes, storage, isMobile, open, isTestMode, screenSize } = event.data;
  // Use botId/serverUrl to load runtime config, then applyWidgetConfig(config).
});
```

Emit the parent messages on the matching state changes:

```js
// when open state or layout changes
window.parent.postMessage({ type: 'resize-widget', width: '420px', height: '720px', isFullScreenWidget: false }, '*');
// when opened/closed
window.parent.postMessage({ type: 'toggle-widget', isWidgetOpen: true }, '*');
// when it wants the parent page dimmed
window.parent.postMessage({ type: 'widget-background', background: true }, '*');
// when session state changes
window.parent.postMessage({ type: 'update-local-storage', storage: { chatId, language } }, '*');
```

Do **not** invent a competing protocol for Milestone 1.

---

## Public widget API inventory (found in the bundle)

```
GET   /public/greeting-settings/{botId}
GET   /widget/info/{botId}?chatId={chatId}
GET   /widget/info/{botId}?language={language}
GET   /widget/{botId}/persistentMenu?chatId={chatId}
POST  /widget/{botId}/chat/{chatId}/action
GET   /widget/{botId}/greeting
POST  /widget/{botId}/greeting/event
PATCH /widget/{botId}/greeting/event
POST  /bot/{botId}/analytics/feedback/{chatId}
GET   /widget/{botId}/conversation-starters
```

Do **not** duplicate these. Adapt the iframe UI to consume/render their current
outputs. Conversation streaming (existing pattern):

```
subscribe /topic/messaging.{chatId}
send      /app/widget/{publicIdentifier}/{chatId}
receive   streamable_text frames:  START → APPEND → STOP → STORED
```

---

## Runtime config loading (production)

Prototype-only sources — **do not ship**:

```
localStorage["gsb_widget_settings"] · localStorage["gsb_preview_config"] · preview.html#cfg=
```

Production boot (target):

```js
async function bootFromBotscrewInitialization(init) {
  const { botId, serverUrl, storage } = init;
  const language = storage?.language || 'English';
  const chatId   = storage?.chatId;
  const query = chatId ? `chatId=${encodeURIComponent(chatId)}` : `language=${encodeURIComponent(language)}`;
  const res  = await fetch(`${serverUrl}/widget/info/${botId}?${query}`);
  const json = await res.json();
  const runtimeSettings = json.data || json;
  const config = normalizeBotscrewRuntimeConfig(runtimeSettings);
  applyWidgetConfig(config);
}
```

Integration target to add (stubs are fine to start): `src/widget/botscrew-runtime-adapter.js`

```js
export async function loadBotscrewRuntimeConfig({ serverUrl, botId, chatId, language }) {}
export function normalizeBotscrewRuntimeConfig(runtimeSettings) {}   // → applyWidgetConfig() shape
export function createBotscrewAnswerProvider({ serverUrl, botId, chatId }) {}
```

### Conversation seam — `answerProvider`

The GSB widget owns message/stream/button/quick-reply rendering, the composer, voice
UI, and visual state. BotScrew owns flows, atoms, ODIN, the socket client,
conversation state, persistent menu, conversation starters, greeting events, and
analytics. Bridge them with an `answerProvider` that maps BotScrew's stream frames
(START/APPEND/STOP/STORED) into a normalized async chunk stream the renderer consumes.

---

## localStorage keys (parent script)

```
per-bot widget state     (open/closed, session)
tabs-{botId}             cross-tab open coordination
```

These are Layer-1 (parent) concerns; the iframe app reflects state via
`update-local-storage` rather than writing host-page storage directly.

---

## Milestone 1 compatibility checklist

```
[ ] Existing installed customer snippet still works (no embed change).
[ ] Parent launcher opens the GSB iframe app.
[ ] Parent greeting popup can submit into the GSB iframe app.
[ ] GSB iframe receives `initialization`.
[ ] GSB iframe loads runtime widget config (GET /widget/info/{botId}).
[ ] applyWidgetConfig renders brand / logo / name / color / layout.
[ ] GSB iframe emits `resize-widget`.
[ ] GSB iframe emits `toggle-widget`.
[ ] GSB iframe emits `update-local-storage`.
[ ] Mobile scroll lock still handled by the parent script.
[ ] Existing chat/session behavior still works.
```

---

## Milestones (summary)

- **M1 — iframe app swap.** Keep loader, snippet, launcher, greeting popup, iframe,
  parent protocol, socket/ODIN. Replace only the iframe-rendered chat UI. Wire
  `initialization` → `/widget/info/{botId}` → `normalizeBotscrewRuntimeConfig()` →
  `applyWidgetConfig()` → existing parent `postMessage`.
- **M2 — admin Appearance persistence.** Dashboard load `GET /bot/{botId}/widget`,
  save `PATCH /bot/{botId}/widget`; native fields → BotScrew-native, new fields →
  `gsbAppearance` (round-trips opaquely); featured-image upload via existing file/media
  endpoint. See [`botscrew-widget-settings.md`](./botscrew-widget-settings.md).
- **M3 — host-page enhancements (optional).** Richer GSB launcher styles in
  `script-chatbot.js`, the embeddable search bar / standalone search button loaders,
  and shared session across chat bubble + search components. Only after M1, and only
  where the parent script explicitly supports them.

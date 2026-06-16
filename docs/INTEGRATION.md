# Widget Integration — BotScrew Drop-in Spec

**Audience:** BotScrew engineering.
**Purpose:** how the new GetSkiBots widget drops into BotScrew's existing embed —
themed per-bot from the config you already store, answering via the ODIN socket you
already run. Grounded in the live **bot 43 (Jackson Hole)** config + protocol.

**One-line version:** our widget replaces the **chat app inside your iframe.** Everything
around it — the loader, launcher bubble, greeting popup, postMessage, config API, socket,
flows, ODIN — stays yours, unchanged.

> Companion docs: the config field contract is in
> [`botscrew-widget-settings.md`](./botscrew-widget-settings.md); orientation/run is in
> [`HANDOFF.md`](./HANDOFF.md).

---

## 1 · The three roles

The widget is a **render layer**. All per-resort content and behavior come from systems
you already own — so the widget code is 100% resort-agnostic and JH is just "profile #1."

| Role | Owner | Source |
|---|---|---|
| **Render** — the chat UI | GSB widget | resort-agnostic; themed by config |
| **Config** — look + copy | BotScrew | `/widget/info/{botId}` (runtime) · `/private/bot/{id}/widget` (storage) |
| **Conversation** — welcome, menus, answers | BotScrew Flows + ODIN | the socket |
| **Host** — loader, launcher, open/close | BotScrew snippet + iframe | `script-chatbot.js` |

---

## 2 · The embed model — where the widget sits

`script-chatbot.js` injects an **iframe**; the chat UI runs **inside** it. The snippet
renders the **launcher bubble + greeting popup** on the host page and talks to the iframe
via **postMessage**.

```
host page
 ├─ snippet (script-chatbot.js)         ← BotScrew, unchanged
 │   ├─ launcher bubble + greeting popup
 │   ├─ background dim, mobile scroll-lock
 │   └─ postMessage  ⇄  iframe
 └─ <iframe>   ←  THE GSB WIDGET DROPS IN HERE
       └─ chat UI: header, conversation, composer, voice
```

**Integration = swap the iframe's chat app for ours.** No change to the loader, the
launcher, or the postMessage protocol. The launcher lives in the *snippet*, so our
widget's own launcher is for standalone/demo only — in-embed, the snippet opens us.

---

## 3 · The seams (what you wire)

Three clean injection points. The widget knows nothing else.

### 3a · Config in
`applyWidgetConfig(config)` ([`src/widget/apply-config.js`](../src/widget/apply-config.js))
— a pure function that turns a config object into the widget's CSS variables,
`data-` attributes, and content. Feed it the runtime config from `GET /widget/info/{botId}`.

### 3b · Open / close / resize
The widget exposes `openChat` / `closeChat`; the **host** drives them. In-embed, wire the
snippet's existing postMessages (`toggle-widget`, `resize-widget`) to these. We deliberately
made open/close a **host responsibility** before we knew about postMessage — it already
fits your model.

### 3c · Answers — the conversation channel
`answerProvider` is the seam the widget calls for conversation: send a query → render a
**stream of chunks** (plus structured messages — buttons, quick replies, menus). It's a
**streaming** channel, not one-shot Q&A.

**The interface is the contract (ours); the implementation is yours.** The widget defines
*what it expects* — a streaming provider it can drive and render. *How* that provider
connects to your socket / ODIN is entirely on your side; we don't specify or constrain it.

For reference, here's how your *current* client already does it — **illustrative, not a
spec you must match**:
- subscribe `/topic/messaging.{chatId}`
- send `/app/widget/{publicIdentifier}/{chatId}`
- bot frames: `type:"streamable_text"` with `stream.{action, index}` (START→APPEND→STOP→STORED),
  plus structured types (buttons, quick replies, menus).

**Adapters behind the seam:**

| Adapter | Owner | Purpose |
|---|---|---|
| **Stub** (curated JH answers) | us | reference; runs our standalone preview with no backend |
| **Production** | **BotScrew** | your existing SockJS/STOMP client → the seam |
| *Live PoC (optional)* | *us — throwaway* | *only if you want a pre-handoff live demo; it's a quick standalone hookup, **not required** and not meant to ship* |

You already own a working SockJS/STOMP client (it runs your current widget). Production isn't
new plumbing — it's pointing that client at this one interface. And the **real live-answer
demo already exists on your side** (`/widget-demo/{publicIdentifier}`) — swap in our widget
and it gets live answers + the new UI for free.

---

## 4 · The config contract

Two shapes, same data:

- **Storage** (`/private/bot/{id}/widget`, what the admin saves): `languageConfigs.{lang}.*`
  plus the global `isComposerInputEnabled`. Fields: `color`, `imageUrl`, `widgetName`,
  `welcomeTitle`/`welcomeSubtitle`, `inputPlaceholder`, `conversationStartersSettings`,
  `greetingMessagePopupSettings`, the `do*` flags, `isLoginName/EmailInputEnabled`,
  `doEnableAttachments`.
- **Runtime** (`/widget/info/{botId}`, what the widget consumes): the flattened settings
  — `logo` (note: `imageUrl` in storage → `logo` at runtime), nested
  `widgetSettings.{doEnableSoundNotifications, …}`, plus labels/`statusesLabels`/
  `promptButtons`/`hasPersistentMenu`/`greetingMessagePopupSettings`.

**Native vs `gsbAppearance`.** The native config has **no** `cornerRadius`,
`chatHeaderColor`, `logoMaxHeight`, layout variant, typography, depth, snowfall, typing
indicator, or voice. All of that visual richness rides in a namespaced **`gsbAppearance`**
block (Option B — full table in [`botscrew-widget-settings.md`](./botscrew-widget-settings.md)).

> **⚠️ The one open question to resolve.** The live bot-43 config has **no catch-all field**
> for `gsbAppearance`. Confirm whether your widget config can persist an opaque JSON block
> as-is (Option B = **zero backend change**) or needs **one JSON field added**. This is the
> single decision that sets the integration-effort baseline.

---

## 5 · Content provenance — where every element comes from

The crux of the whole integration: **don't wire the welcome (or menus) to config — they're
conversation.**

| Widget element | Source | Your component / endpoint |
|---|---|---|
| Brand color, logo, name, placeholder | **Config** | AppearanceTab · ColorSelector · LogoDropzone |
| Corner radius, layout, typography, effects | **Config → `gsbAppearance`** | AppearanceTab (new controls) |
| Launcher popup (logo, size, alignment, spacing) | **Config** | GreetingMessagePopupAppearanceSection |
| **Welcome message** | **Flow atom** — *not* config | edited in Appearance, **stored in the atom** (`PUT /bot/{id}/atom`) |
| Suggested questions / quick replies | **Flow / conversation-starters** | ConversationStartersTab · `/widget/{botId}/conversation-starters` |
| Snow report, lift status, all answers | **Flow + ODIN** | the socket |
| Conditions grid, webcam hero, season banner | **GSB enhancement** (Open-Meteo / webcam) | no BotScrew source — our addition |

**Edit-surface ≠ storage.** Simple copy like the welcome can be *edited* in the Appearance
tab while still *living* in the flow atom — a friendly field that writes to your atom API
(`PUT /bot/{id}/atom`, per-language). Conversational *behavior* (menus, branching) stays in
Flows. The test: **"is it just copy, or is it behavior?"**

### 5a · Season Update "Get live updates" → a Flow (production wiring)

The Season Update banner (Appearance → Identity → **Recent update**) has two sources:
- **Write it myself** — manual copy (`recentUpdate`). Works today.
- **Get live updates** — the banner is written automatically by a **Flow** the admin picks.
  The Appearance prototype ships a *shell* for this picker; production wires it to real Flows.

**The picker (what to build):**
- The dropdown lists the **bot's existing Flows** (`GET` the bot's flows), grouped under
  "Your flows". `recentUpdateFlow` stores the chosen flow id.
- A divider-separated **"+ Create new flow"** action sits at the **bottom** — an action, not a
  selection. It **must open the Flow builder in a NEW TAB**: the admin has unsaved Appearance
  edits that a same-tab navigation would destroy.
- **Deep-link with context** so the new flow ties back to the banner and can return the admin,
  e.g. `…/admin/bot/{botId}/flows/new?source=season-banner&return=appearance`.
- **Empty state** (no flows yet): skip the empty dropdown — show a primary
  "Create your first flow →" CTA instead.
- **Preview** runs the selected flow and renders its output into the banner preview.

**Runtime:** when `recentUpdateSource === 'flow'`, the widget fills the Season Update banner
from the selected flow's output (refreshed on chat open) instead of the manual text.

**Prototype today:** `index.html` `#updateFlow` is a stubbed flow list ("Mountain Conditions",
"Lift & Trail Status", …) + the "+ Create new flow" action (opens the builder URL in a new
tab). No live flow data. The mapper already carries `recentUpdateSource` + `recentUpdateFlow`
in `gsbAppearance`, so only the flow list + builder deep-link are net-new on BotScrew's side.

---

## 6 · The conversation channel

- **Authoring:** flows/atoms (`/bot/{id}/flow`, `/atom`) — your Flow editor. The widget
  **never reads these.**
- **Runtime:** the flow engine executes and **emits messages over the socket.** The widget
  renders messages (streaming text + buttons + quick replies + menus). It consumes
  *messages*, not flow definitions.
- **Knowledge:** ODIN, linked per bot via `odinConfigs.projectId`. Backend-routed; the
  widget only talks to your socket.

Public widget API surface (the iframe app calls these): `/widget/info/{botId}`,
`/widget/{botId}/conversation-starters`, `/widget/{botId}/persistentMenu`,
`/widget/{botId}/greeting`, `/widget/{botId}/chat/{chatId}/action`,
`/public/greeting-settings/{botId}`.

---

## 7 · Jackson Hole / bot 43 — the worked reference

| Thing | Value |
|---|---|
| Bot id | `43` |
| `publicIdentifier` (demo + socket key) | `776bd241-fbc3-4e17-92c7-8af31e84e6dd` |
| `odinConfigs.projectId` (answers) | `66aa889e43c47120371b9636` |
| Brand color | `#a41e23` |
| Logo (`imageUrl`) | served from `/api/file/…` |
| Demo page | `/widget-demo/{publicIdentifier}?isTestMode=true` (screenshot backdrop) |

Prove the pipeline for bot 43; the other 100+ are the **same pipeline with a different bot
id** — no per-resort code.

---

## 8 · Decisions for BotScrew

1. **`gsbAppearance` persistence** — opaque-JSON field exists, or add one? (§4) *(the big one)*
2. **Welcome edit surface** — expose in AppearanceTab, writing to the atom? (§5)
3. **Rich-welcome handling** — text-only field + "managed in Flows" when a welcome has buttons?
4. **Launcher in-embed** — confirmed: snippet's bubble stays; our launcher is standalone/demo only.

---

## 9 · Effort read

**Low — most of it is your own plumbing, reused:**

- **Config** → you have the API; feed `/widget/info/{botId}` to `applyWidgetConfig`.
- **Open / close / resize** → your existing postMessage → our seam.
- **Answers** → your existing socket client → our `answerProvider`.
- **Welcome-in-Appearance** → a field → your existing atom API.

The widget is a **drop-in replacement for the iframe's chat app.** The loader, launcher,
postMessage protocol, socket, flows, and config API are all **untouched.** The net new work
on our side — streaming/structured message rendering behind the `answerProvider` seam — is
already on the build plan ([`BUILD-STATUS.md`](./BUILD-STATUS.md)).

---

## 10 · The demo preview page & Live Preview wiring

[`preview.html`](../preview.html) is a **resort-agnostic homepage mock** with the widget
embedded — the surface sales shows a prospect ("here is your site with our assistant on
it"). It is also what the dashboard's **Live Preview** button opens.

### What it proves (all faithful — every pixel from config)

The widget is themed **entirely** by `applyWidgetConfig(config)`
([`src/widget/apply-config.js`](../src/widget/apply-config.js)) from one `CONFIG` object —
nothing widget-related is hand-built. Every appearance-tab field maps to the Chat UI:

- brand color, logo, corner radius, fonts (Inter body / Playfair display, true weights)
- layout variant (side / middle / full), panel-open animation, blurred background
- launcher style (simple / status-pill / slide-in / custom icon), depth effect
  (glow / radiate / shadow), CTA copy, slide-in state, status-pill features
- Season Update banner (`updateLabel` + `recentUpdate`), webcam / featured-image hero
- snowfall (on/off + style + intensity) — the engine is shared at
  [`src/shared/snow-engine.js`](../src/shared/snow-engine.js) so the dashboard preview and
  the demo render snow from one source and **can't drift**
- typing indicator, realtime voice, disable-text-input, embeddable search bar + button

Three entry points — header search icon, hero search bar, chat launcher — all open the
same chat; a search submit injects the query as the first message. Two on-page control
bars let a resort play with color / launcher style / live-agent live (each mutates
`CONFIG` and re-applies). Those bars are a **GetSkiBots-branded "control deck"** — dark
dashboard-blue with the white GSB logo, deliberately wearing **our** colors (not the
resort's `var(--brand)`), so it reads as demo tooling wrapping a preview of the resort's
site below. (Only the in-deck Color picker stays tied to the resort color — it's the
resort-color tool.) The optional **demo background photo** (`backgroundImage`) renders
behind the hero with a legibility overlay + auto Light/Dark text, to make the mock feel
like the resort's real site.

### How config reaches the page TODAY — prototype only

The dashboard syncs its current state to `localStorage['gsb_preview_config']` (debounced)
and encodes it into the Live Preview link as a URL hash (`preview.html#cfg=<base64>`).
`preview.html` reads the hash first (cross-device shareable links), then same-origin
`localStorage`, merges over the JH defaults, and applies. An open preview tab also
live-updates via the `storage` event.

> ⚠️ **This localStorage / hash sync is a single-tenant, same-origin demo mechanism. It is
> NOT how production selects a bot.** It exists so the prototype's Live Preview works with
> no backend.

### How it must be wired in production — per bot instance

The live admin already has a per-bot preview at:

```
https://bots.getskitickets.com/widget-demo/{publicIdentifier}?isTestMode=true
# e.g. bot 43 (Jackson Hole):
https://bots.getskitickets.com/widget-demo/776bd241-fbc3-4e17-92c7-8af31e84e6dd?isTestMode=true
```

Production wiring **replaces the localStorage / hash hand-off with bot selection by
`publicIdentifier` in the URL**: the config comes from `GET /widget/info/{botId}` (§4) fed
straight into `applyWidgetConfig` — no localStorage, no hash. Same render layer, real
per-bot config; `isTestMode=true` is the existing flag for the admin-facing (non-public)
preview.

**Net:** the `applyWidgetConfig(config)` seam (§3a) is already production-ready and proven
end-to-end by the demo. Only the **config source** swaps — from the prototype sync to the
per-bot `/widget/info/{botId}` load keyed off the URL's `publicIdentifier`. This is the
same per-bot-ID wiring called out for every other feature (see
[`BUILD-STATUS.md`](./BUILD-STATUS.md) → per-bot-ID wiring).

### Showcase defaults (what the demo + fresh appearance tab ship with)

The defaults are chosen to **light up the most config→widget mappings at once**, so a
BotScrew engineer can see each setting doing something. They're a *showcase*, not the most
conservative production preset:

| Area | Default | Why |
|---|---|---|
| Launcher style | **Status pill** (`enhanced`) | The only style that shows avatars + live-agent + weather + CTA together — most visible in one glance |
| Status-pill features | **all on** (live agent, weather, "Need help?" CTA) | So the pill isn't bare; every element is demonstrated |
| Depth effect | **Radiate** (intensity 65) | Demonstrates the depth-effect system + draws the eye to the launcher |
| Auto-hide on scroll | **on** | Shows the slide-away (down hides, up/idle reveals) |
| Placement | **Right, 32 / 32** | Conventional |
| Layout | **Side panel** | Most "embedded widget" feel; the demo bar flips Middle/Full live |
| Hero (chat top) | **Webcam** (live cam) | Demonstrates the live-data/webcam integration |
| Season Update | **populated** (manual source) | Banner visible; shows the manual-vs-flow toggle |
| Typing / voice | **dots / realtime voice on** | Conversation polish |
| Typography | **Inter + Playfair** | The font-pairing system |
| Search bar / button | pill radius · fixed 480 · round brand button | Embeddable-component styling |

**Deliberately off** (each is a "turn it on to see it" toggle, not a sensible always-on):
`snowfall` (heaviest continuous effect), `disableTextInput`, custom launcher icon.

> ⚠️ **Demo-only fields:** `backgroundImage` and `bgTextMode` theme the *demo page*
> (`preview.html`), **not** the widget — the widget doesn't consume them yet (reserved for
> an optional Chat UI background later). Don't map them to widget behavior.

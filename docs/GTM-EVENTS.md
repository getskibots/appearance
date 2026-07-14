# Chat Widget — `dataLayer` Event Contract (for GTM)

**What this is:** the analytics events the chat widget pushes to the browser
`dataLayer`, so any Google Tag Manager container — the resort's own — can trigger
on chat behavior and route it wherever they want (GA4, Google Ads, Meta Pixel, …).

This doc is the **source of truth** for two things:
1. The **GTM template container** GSB ships (its triggers match the events below).
2. The **spec a resort's marketer** follows to build their own tags.

Implemented in `src/shared/analytics.js` (`analytics.track()`). Every event is a
single `window.dataLayer.push()`.

---

## How a resort connects it

In the widget's **Analytics ID** field (Behavior section), the resort pastes **one** id:

| They paste | What happens |
|---|---|
| **GA4 id** — `G-XXXXXXXXXX` | Events go straight to their Google Analytics 4 property. Nothing else to configure. |
| **GTM container id** — `GTM-XXXXXXX` | Their GTM container loads and routes events by *its* tags. **They import the GSB chat-events template first** (below), then plug in their own GA4/Ads/Pixel ids. |

The id is auto-detected by prefix. It's stored per-bot in `gsbAppearance.analytics`
(one string in the config blob — no schema change). GetSkiBots' own analytics run
regardless; this is only the resort's copy.

---

## The event payloads

Every event pushes `{ event: '<name>', ...params }`. Names are prefixed **`gsb_`**
so a GTM trigger can match `gsb_*` cleanly and never collide with the resort's
other dataLayer events.

| `event` | Fires when | Params | Notes |
|---|---|---|---|
| `gsb_widget_opened` | The chat is opened | `entry_point` (bubble / starter / …) | |
| `gsb_widget_closed` | The chat is closed | `turn_count`, `duration_seconds` | |
| `gsb_conversation_started` | The first user message of a session | `entry_point` | |
| `gsb_message_sent` | A user sends a message | `turn_number` | |
| `gsb_conversation_ended` | A session ends | `turn_count`, `contained`, `duration_seconds` | **`contained` = resolved without a human** (the key quality metric) |
| `gsb_handoff_to_human` | Escalated to a live agent | `turn_number` | |
| `gsb_starter_clicked` | A conversation-starter chip is clicked | `starter_text` | |
| `gsb_webcam_viewed` | The hero webcam is viewed | — | |
| `gsb_voice_mode_used` | Voice chat is used | — | |
| `gsb_outbound_click` | A link/CTA to the resort site is clicked | `destination`, `context` | **The conversion event** — map this to a GA4 conversion / Ads conversion |

All params are primitives (string / number / boolean). `contained` on
`conversation_ended` and `gsb_outbound_click` are the two most valuable signals —
containment (self-service rate) and conversion (did the chat drive a click out).

---

## The GTM template container

An empty container does nothing — it needs tags/triggers that listen for these
events. So GSB ships a **prebuilt container** the resort imports:

- **Lives as:** a GTM container **export (JSON)** — versioned in this repo at
  `gtm/chat-events-template.json` (authored in GTM → *Admin → Export Container*).
- **Contains:** one **trigger per `gsb_*` event** (Custom Event, matching the
  `event` name), the **variables** for each param (Data Layer Variable), and
  **starter GA4 tags** wired to those triggers.
- **The resort:** *Admin → Import Container* → drops in their own GA4 / Ads / Pixel
  ids → publishes. Chat events start flowing into their analytics with zero code.

> Building the container is **GTM-UI configuration work**, not code — ~an afternoon,
> done once, reused by every resort. This spec is its blueprint.

---

## Production wiring (BotScrew runtime)

The prototype is **console-first** — it pushes to `dataLayer` (so you can watch
events in DevTools) but loads **no external scripts**. Production turns the
transports on:

```js
analytics.init({
  analyticsId: config.gsbAppearance.analytics.ga4MeasurementId, // 'G-…' or 'GTM-…'
  enableGA: true,   // load gtag.js / gtm.js
});
```

- `G-…` → loads `gtag.js`, configures the property, routes events via `send_to`.
- `GTM-…` → loads the resort's `gtm.js` container; the imported template does the routing.
- Either way, **GSB's own GA4 always fires** (hardcoded `GSB_GA4_ID`) so GSB's
  baseline analytics never depend on the resort's setup.

---

## Open decision — where GTM runs (the iframe question)

The widget runs in an **iframe**, so a host page's GTM can't see inside it. Two models:

1. **Container loads *inside* the widget iframe** (via the resort's `GTM-` id). Captures
   chat events cleanly; needs the imported template. ← matches "paste your container id."
2. **`postMessage` events to the *parent* page's GTM.** Uses their existing site
   container as-is, but the parent page must add a small listener.

Model 1 is the default this contract assumes. Confirm with BotScrew before building
the runtime loader.

---

## Change history
- **v1** — initial contract: 10 `gsb_*` events, GA4-or-GTM auto-detect, template-container model.

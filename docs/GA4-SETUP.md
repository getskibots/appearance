# GA4 / GTM Setup — Chat Widget Analytics

Everything needed to stand up **complete** analytics for the chat widget: where the
code lives, the events it fires, and the GA4 admin steps that turn "events show up in
Realtime" into a real, reportable install.

> The event **contract** (names + params, for building a GTM template) is in
> [`GTM-EVENTS.md`](GTM-EVENTS.md). This doc is the **operational setup guide.**

---

## 1. Where the code lives
| File | Role |
|---|---|
| `src/shared/analytics.js` | The emitter. Holds `GSB_GA4_ID` (GetSkiBots' own property, `G-BN9CX96J18`), `track()`, and the GA4/GTM transport (auto-detects `G-` vs `GTM-`, loads the right script, routes via `send_to`). |
| `src/shared/analytics-bootstrap.js` | The **on switch** — `bootstrapAnalytics({ analyticsId, enableGA })`, plus the `?ga=…` test opt-in. |
| `src/widget/widget-runtime.js` | Where the ~10 events are **fired** (`analytics.track(...)`). |
| `index.html` (Behavior card) | The **Analytics ID** input; stored per-bot at `gsbAppearance.analytics.ga4MeasurementId`. |

**Flow:** `widget-runtime.js` fires → `analytics.js` routes → `analytics-bootstrap.js` enables.

---

## 2. The events (summary — full spec in GTM-EVENTS.md)
`widget_opened` · `widget_closed` · `conversation_started` · `message_sent` ·
`conversation_ended` · `handoff_to_human` · `starter_clicked` · `webcam_viewed` ·
`voice_mode_used` · **`outbound_click`** (the conversion).

In GA4 these appear as the **bare names** (no `gsb_` prefix — that prefix is only on the
`dataLayer` for GTM triggers).

---

## 3. Stand up a complete GA4 install (~15 min)

### Step 1 — Connect the property
Paste the resort's **GA4 measurement id** (`G-XXXXXXXXXX`) **or** their **GTM container id**
(`GTM-XXXXXXX`) into the **Analytics ID** field (Behavior card). Auto-detected by prefix;
stored per-bot. (GSB's own property always captures regardless — see §5.)

### Step 2 — Turn on production sending
The widget is **console-first** by default (no external send). Production enables it:
```js
bootstrapAnalytics({ analyticsId: bot.gsbAppearance.analytics.ga4MeasurementId, enableGA: true });
```

### Step 3 — Mark the conversion
GA4 → **Admin → Data display → Events** → find **`outbound_click`** → toggle
**"Mark as key event."** Now it counts as a conversion and shows in *Key events by Event name*.
*(Optional: also mark `conversation_ended` — its `contained: true` = the bot resolved
without a human, i.e. a self-service success.)*

### Step 4 — Register the parameters (so you can REPORT on them)
GA4 shows event **counts** out of the box, but the params are invisible in reports until
registered. GA4 → **Admin → Custom definitions → Create**:

| Register as **Custom dimension** | On events |
|---|---|
| `entry_point` | widget_opened, conversation_started |
| `starter_text` | starter_clicked |
| `destination` | outbound_click |
| `context` | outbound_click |
| `contained` | conversation_ended |

| Register as **Custom metric** (numeric) | On events |
|---|---|
| `turn_number` | message_sent, handoff_to_human |
| `turn_count` | widget_closed, conversation_ended |
| `duration_seconds` | widget_closed, conversation_ended |

This is what unlocks the real value — *which entry points convert, which links drive
`outbound_click`, your containment rate, conversation depth.*

### Step 5 (optional) — Consent Mode
For EU resorts, wire GA4 **Consent Mode** to the site's cookie-consent state so events
respect consent. (Not built into the widget yet.)

---

## 4. Testing / verifying
1. Open the demo with `?ga=1` (fires GSB's property) or `?ga=G-…` / `?ga=GTM-…` to add a
   resort destination; add `&gadebug=1` to log every event to the console.
   `…/appearance/preview.html?ga=1`
2. Interact (open chat, send a message, click a starter, click an outbound link).
3. GA4 → **Realtime → "Event count by Event name"** → events appear in ~30s.

⚠️ **Use a browser with NO ad-blocker / tracking protection** (Chrome incognito, extensions
disabled). Blockers stop `googletagmanager.com`, so `gtag` never loads and **0 events
reach GA4** — a false negative, not a bug. Smoking-gun check: DevTools → Network → filter
`collect` (firing = good) or `gtag` (blocked/red = the browser is blocking it).

---

## 5. GetSkiBots' own property (always-on)
`GSB_GA4_ID = 'G-BN9CX96J18'` is hardcoded in `analytics.js` and receives **every** event
across **every** resort's widget — GSB's cross-resort telemetry, independent of what each
resort configures. **Verified live** (2026-07-15): `widget_opened` landing in the Get Ski
Bots property's Realtime. *(This is NOT stored in BotScrew — it's baked into the widget.
Decide with BotScrew whether it stays on when they ship.)*

---

## 6. The ceiling — and the durable fix
Client-side GA/GTM **only lands when the visitor's browser doesn't block Google** — and a
meaningful share do. For **guaranteed capture at scale**, move to **server-side / first-party
tagging** (route analytics through your own domain so blockers can't recognize it). The
event layer above is unchanged; only the transport moves server-side.

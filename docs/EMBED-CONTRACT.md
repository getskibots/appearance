# Appearance Dashboard — Admin Embed Contract

**Status:** implemented on the GSB side (`src/dashboard/embed.js`,
`src/shared/appearance-store.js`). This doc is what BotScrew needs to wire the
**parent side** — no reverse-engineering required. Message names and payloads
below are the *actual* ones the iframe app listens for and emits.

> Scope: this is embed **(a)** — the GSB Appearance **dashboard** inside the
> BotScrew **admin**. It is a different surface from embed **(b)**, the public
> chat **widget** on the resort's site (that's `SCRIPT-CHATBOT-CONTRACT.md`).
> Same render layer underneath; this one adds admin auth + config write-back.

---

## The shape in one paragraph

BotScrew's admin renders the Appearance tab as an **iframe** pointing at a
GSB-hosted URL, passing the `botId`. GSB hosts both the app **and** the backend
(Supabase) — so BotScrew builds **no new storage, no config schema, no image
hosting**. The iframe loads that bot's saved appearance, lets the admin edit it,
and on **Save** writes the config (plus any newly uploaded images) back to GSB's
Supabase, keyed by `botId`. The live resort-site widget keeps reading appearance
through BotScrew's existing runtime path; this dashboard only edits the stored
config. Auth is a **short-lived signed token** handed to the iframe via
origin-checked `postMessage` — never third-party cookies.

---

## 1. The iframe URL

```
https://getskibots.github.io/appearance/index.html?embed=1&botId={BOT_ID}
```

- `embed=1` switches the app into embed mode (per-bot load/save instead of the
  standalone localStorage demo).
- `botId` is **required**. It is the multi-tenant key — one config row per bot.
- Host is the current GitHub Pages deploy; a custom domain (e.g.
  `appearance.getskibots.com`) can replace it with no contract change.
- **Versioning:** BotScrew should point at a **pinned path** (e.g.
  `/appearance/v3/…`) so a future GSB change can't break their tab
  unannounced. (GSB to provide the versioned path at go-live.)

Two ways to deliver identity (`botId` + `token`) — pick one:

| | A. `postMessage` (recommended) | B. Signed URL |
|---|---|---|
| Delivery | Parent posts `initialization` after the iframe signals ready | `…&botId=…&token=…` in the src |
| Token exposure | Not in the URL / referrer / logs | Present in the URL (use very short TTL) |
| Timing | Robust — iframe tells you when it's listening | Must be valid at first paint |

The app supports **both**; A is preferred because the token stays out of the URL.

---

## 2. Message sequence (postMessage variant)

```
BotScrew admin (parent)                 GSB iframe (child)
        │                                       │
        │            iframe loads               │
        │──────────────────────────────────────►│
        │                                        │  posts when ready:
        │◄───────────────────────────────────────┤  { type: 'gsb-appearance-ready' }
        │                                        │
        │  { type: 'initialization',             │
        │    botId, token, serverUrl }           │
        │───────────────────────────────────────►│  loads bot config, renders
        │                                        │
        │◄───────────────────────────────────────┤  on any content-height change:
        │   { type: 'resize', height }           │  (set iframe height from this)
        │                                        │
        │                (admin edits, clicks Save inside the iframe)
        │                                        │  writes config + images to GSB Supabase
```

**Origin-check everything.** The iframe validates that `initialization` came from
BotScrew's admin origin (`https://bots.getskitickets.com`); BotScrew must
likewise validate that `resize` / `gsb-appearance-ready` came from the GSB iframe
origin before acting.

---

## 3. Exact message payloads

**Child → parent — "ready to receive identity":**
```js
{ type: 'gsb-appearance-ready' }
```

**Parent → child — identity handshake (send on receiving `ready`):**
```js
iframeEl.contentWindow.postMessage({
  type: 'initialization',
  botId: '43',            // string; must match the ?botId in the src
  token: '<JWT>',         // short-lived, signed — see §4
  serverUrl: 'https://bots.getskitickets.com' // optional, informational
}, 'https://getskibots.github.io'); // <-- target origin, never '*'
```

**Child → parent — auto-resize (fires whenever content height changes):**
```js
{ type: 'resize', height: 1240 } // px; set iframeEl.style.height = height + 'px'
```

---

## 4. Auth — the short-lived token

The iframe is cross-origin, so it **cannot** use BotScrew's admin cookie. Instead
BotScrew hands it a **short-lived signed JWT** that identifies which bots the
current admin may edit.

- **Claim required:** `authorized_bots` — an array of bot-id strings the token
  bearer may read/write (e.g. `["43"]` or the admin's full set). GSB's Supabase
  Row-Level Security enforces access **per `bot_id`** against this claim, so a
  token for bot 43 can never read or write bot 44.
- **TTL:** minutes, not hours. The dashboard is a short editing session.
- **Where it's used:** the iframe sends it as the `Authorization: Bearer` header
  on its Supabase requests. GSB's publishable anon key is the `apikey` header;
  RLS (not the anon key) is what protects data.

**Who mints it — one decision to make (§7):** simplest is a tiny GSB
**token-mint endpoint** that BotScrew's admin backend calls server-to-server
(authenticated) to exchange "this admin manages bots X,Y,Z" for a scoped JWT,
which BotScrew then passes into the iframe. GSB can provide this endpoint.

---

## 5. What GSB hosts (so BotScrew doesn't build it)

- **The app** — the Appearance dashboard, deployed and versioned by GSB.
- **Config storage** — Supabase table `bot_appearance` (PK `bot_id`, jsonb
  `config`), one row per bot. Schema + RLS SQL live in the header of
  [`src/shared/appearance-store.js`](../src/shared/appearance-store.js).
- **Image hosting** — Supabase Storage bucket `appearance`, path `{botId}/…`.
  Uploaded logos/backgrounds/featured images are optimized client-side, pushed to
  Storage on Save, and stored in the config as CDN URLs (not base64). BotScrew
  **does not** need to host or serve any appearance images.
- **The data contract** — native BotScrew fields map 1:1; everything else rides
  in an opaque `gsbAppearance` block. See
  [`botscrew-widget-settings.md`](botscrew-widget-settings.md).

---

## 6. What GSB needs from BotScrew

1. **Embed the iframe** in the admin Appearance tab at the URL in §1, passing
   `botId`, and set its height from the `resize` messages.
2. **Send the `initialization` message** (§3) with a scoped `token` (§4) —
   or call the GSB token-mint endpoint and pass the result.
3. **Confirm the admin origin** (`https://bots.getskitickets.com`) so GSB can
   pin the postMessage / CORS allow-list to it.
4. **Frame-ancestors / CSP:** allow the GSB app origin to be framed by the admin
   (and GSB will allow-list the admin origin as a framer).

That's the whole ask. No DB schema, no image pipeline, no appearance API on
BotScrew's side — the tab becomes a thin frame over GSB-hosted infrastructure,
mirroring the omni-odin Knowledge-page model.

---

## 7. Open decisions (need a BotScrew answer)

- **Token minting** — GSB endpoint that BotScrew's backend calls, **or** BotScrew
  signs with a shared secret GSB's Supabase trusts? (Recommend the GSB endpoint.)
- **Token scope** — one bot per token (tab reload per bot) vs the admin's full
  bot set in `authorized_bots` (switch bots without re-minting)?
- **Host domain** — stay on `getskibots.github.io/appearance/` or move to a GSB
  custom domain before go-live?
- **Pinned version path** — GSB to publish the immutable versioned URL BotScrew
  frames against.

---

## 8. Current implementation status (GSB side)

| Piece | State |
|---|---|
| `?embed=1` mode, `botId` capture, `ready`/`initialization` handshake | ✅ built |
| Auto-resize (`ResizeObserver` → `resize` postMessage) | ✅ built |
| Per-bot config load on init → hydrate dashboard | ✅ built |
| Save → write config to Supabase, keyed by `botId` | ✅ built |
| Image upload → Storage on Save, config carries CDN URLs | ✅ built |
| Origin-checked postMessage, RLS-by-`bot_id` | ✅ built |
| Supabase project + creds (`embed-config.js`) | ⏳ blank until the project exists |
| Token-mint endpoint | ⏳ pending §7 decision |
| BotScrew parent-side wiring | ⏳ this doc is the spec for it |

Everything above the dashed line is code-complete and **inert** until the
Supabase creds in `src/dashboard/embed-config.js` are filled — nothing breaks
before the backend exists.

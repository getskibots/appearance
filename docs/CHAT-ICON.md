# Chat icon / reply avatar — port spec

**For BotScrew.** This documents the reply-avatar "chat icon" system in the prototype
so production mirrors it. It's a working reference — see `index.html` (Identity &
branding), `src/dashboard/dashboard.js`, `src/widget/apply-config.js`,
`src/widget/chat-widget.css`, `src/widget/widget-runtime.js`,
`src/shared/widget-config.js`. Live demo: https://getskibots.github.io/appearance/

## The problem it fixes
The reply avatar is a small (~26px) circle. Production feeds it the **header logo**,
which is usually a **wide horizontal lockup** (e.g. Jackson Hole is 263×92, ~2.9:1).
Forced into the circle with `object-fit: cover`, it crops to an unreadable vertical
sliver. A wide logo and a round avatar are different shapes — one asset can't serve
both. The fix is a **dedicated square "chat icon,"** separate from the wide logo.

## Admin field (Identity & branding → Logo & color, directly under "Choose widget logo")
- **Chat icon (square)** uploader + a live 26px reply-avatar preview.
- **Fetch from website** — auto-pulls a favicon (see below).
- **Crop from logo** — square crop with a circle safe-zone guide (see below).
- **Disc background**: White / Brand / None.
- **Padding**: 0–30% breathing room inside the disc.
- **Low-res warning** when the source is too small to stay crisp.

Keep the **header logo field unchanged** — it stays the wide lockup (contain,
max-height). The chat icon is a *separate, square* asset.

## Source chain (what the avatar shows), in priority order
1. **`chatIconUrl`** — explicit square icon (upload, crop, or fetched favicon). Always used.
2. **Logo — only if near-square** (aspect ratio 0.7–1.4, measured from natural size).
   A wide/tall logo is skipped (it would shrink to a sliver).
3. **Monogram** — initials of the widget name on a brand-colored disc.

Rendered with **`background-size: contain`-style** (a padding %), so the mark always
shows **whole — it never crops**. The circle is a CSS mask; the same square asset also
works as a rounded-square (launcher).

## Crop UX
- Enforce a **square (1:1) crop**; show a **circle overlay** marking the safe zone
  (keep the mark within ~80% center — corners may be masked by the circle).
- Drag to reposition, zoom to scale; live circle + square previews.
- Export a **256×256** image. Store the crop (a derivative here; a non-destructive
  crop rect is fine too). One square asset drives avatar **and** launcher.

## Favicon fetch
- Try, in order: `apple-touch-icon.png` → `apple-touch-icon-precomposed.png` →
  an icon service (e.g. `icons.duckduckgo.com/ip3/<host>.ico`) →
  `/favicon.ico`. Prefer ≥128px (apple-touch-icon is usually best).
- ⚠️ **Production must fetch + STORE the image** (as an asset/data URI), **not
  hotlink** it — a hotlinked favicon can CORS-block or vanish (same failure class as
  hotlinked webcam images). The prototype hotlinks and says so in the UI.

## Low-res guidance
- A mark needs enough pixels to stay crisp up to the launcher (~56px @2× ≈ 112px).
- Warn when an uploaded/fetched icon's min dimension < ~96px, or when a crop captures
  < ~160px of source. SVG is vector — never warn.

## Data contract (in the opaque `gsbAppearance` block — see `widget-config.js`)
| Field | Type | Meaning |
|---|---|---|
| `chatIconUrl` | string (URL/data URI) | the square mark; empty → fall back to logo/monogram |
| `chatIconBg` | `'white' \| 'brand' \| 'transparent'` | disc background |
| `chatIconPadding` | number (0–30) | % breathing room inside the disc |
| `avatarShape` | `'circle' \| 'rounded' \| 'square'` | avatar mask shape (default circle) |

Round-trips losslessly via `to/fromBotscrewWidgetSettings`.

## CSS tokens & classes (the render hooks — emit these from the React runtime)
Set by `applyWidgetConfig` on the root:
| Token | Value | Notes |
|---|---|---|
| `--gsb-chat-icon` | `url("…")` | the icon image; **unset** → monogram shows |
| `--gsb-avatar-bg` | color | disc background (white / `var(--brand)` / transparent); brand when monogram |
| `--gsb-avatar-fit` | `%` | `background-size` = `100 − 2×padding`% (keeps aspect, adds padding) |
| `--gsb-avatar-fg` | color | monogram text color (`var(--enhanced-fg)`, auto-contrast) |
| `--gsb-avatar-radius` | `%` | avatar mask shape: circle `50%` / rounded `28%` / square `14%` |

Body hooks: `body.gsb-has-chat-icon` (an image is set → hide monogram text);
`body[data-avatar-monogram="JH"]` (the initials).

Classes (`chat-widget.css`):
- `.gsb-msg-row` / `.gsb-msg-row--ai` — the avatar + bubble row for AI messages.
- `.gsb-avatar` — 26px disc: `border-radius:50%`, `background: var(--gsb-avatar-bg)` +
  `var(--gsb-chat-icon)` at `background-size: var(--gsb-avatar-fit)`, centered; a
  flex-centered monogram (initials) shows when `--gsb-chat-icon` is unset.

The avatar is added to **every AI message row** (normal reply, typing indicator, and
voice streaming) — see `aiRow()` in `widget-runtime.js`.

## Port checklist for BotScrew
- [ ] Add the **Chat icon (square)** admin field where noted (separate from the logo).
- [ ] Persist `chatIconUrl` / `chatIconBg` / `chatIconPadding` in `gsbAppearance`.
- [ ] Reply avatar sources chatIcon → near-square logo → monogram; render `contain`-on-disc (never `cover`).
- [ ] Favicon fetch **stores** the image server-side (no hotlinking).
- [ ] Square crop with a circle safe-zone guide; export a square; reuse it for the launcher icon.
- [ ] Low-res warning per thresholds above.

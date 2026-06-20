# BotScrew Widget Settings — Integration Contract

This is the **drop-in contract** between the GetSkiBots appearance dashboard and
BotScrew's admin (`Widget → Appearance` tab). It mirrors BotScrew's existing
widget settings structure so the two align cleanly, and is implemented 1:1 by
[`src/shared/widget-config.js`](../src/shared/widget-config.js). **Keep this file
and that module in lockstep** — the TypeScript interface below is the source of
truth.

This contract is designed to align closely with BotScrew's existing widget
settings, so integrating the GetSkiBots dashboard is a structural match rather
than a rebuild. The 8 native fields map 1:1; everything else travels in a
namespaced `gsbAppearance` block BotScrew stores as opaque JSON.

## How BotScrew stores appearance

BotScrew scopes appearance **per language** under `widgetSettings.languageConfigs[<lang>]`
(default key `"English"`), plus one **global** flag `isComposerInputEnabled`.

- Load: `GET {API}/bot/{botId}/widget` and `GET {API}/bot/{botId}/widget/default-translations`
- Save: `PATCH {API}/bot/{botId}/widget` (whole object; saves on blur/enter, "disable input" saves immediately)
- Logo upload: `POST {API}/file/widgetLogo` (multipart `file`, `credentials: "include"`, jpeg/png/jpg/gif/svg, **max 2 MB**) — shared by widget logo + popup logo
- ⚠️ **Featured / hero image upload — needs a server endpoint.** Uploaded featured images (and any hero assets in `gsbAppearance.hero`) are **base64 `data:` blobs in the prototype** — fine for the demo, but they must NOT be persisted in the config (they'd bloat every `/widget/info` fetch). Production flow: we optimize client-side (`image-compress.js` → WebP), **POST the blob to a media endpoint**, and store **only the returned URL** in `gsbAppearance.hero.featuredImages[].url`. **Ask:** can `POST /file/widgetLogo` be generalized (e.g. `/file/widgetAsset`) to accept non-logo assets, or is there an existing media endpoint to use?
- `doAskForRating` is **only rendered when `bot.type !== "AI_AGENT"`**
- The component is `({ languageConfigs, botType }) => …` (React function component, hooks, CSS Modules)

## The alignment strategy (Option B)

BotScrew's tab exposes **8** appearance fields. Our dashboard configures **~23**.
The 8 overlapping fields map **1:1** to BotScrew's native schema. The remaining
~15 have **no BotScrew field**, so we carry them in a namespaced **`gsbAppearance`**
block. BotScrew's backend persists that block as **opaque JSON** (and may strip or
ignore it without breaking the native tab). **No change to BotScrew's own schema.**

## TypeScript contract (authoritative)

```ts
type Alignment = 'Left' | 'Right';

interface GreetingMessagePopupSettings {
  popupLogoUrl: string | null;
  popupLogoSize: number;   // px, valid 40–100
  alignment: Alignment;
  bottomSpacing: number;   // px, valid 24–300
  sideSpacing: number;     // px, valid 24–300
}

/** BotScrew-native per-language appearance fields. */
interface LanguageConfig {
  imageUrl: string;                          // ⇄ state.logoUrl
  color: string;                             // ⇄ state.color (hex)
  widgetName: string;                        // ⇄ state.widgetName
  inputPlaceholder: string;                  // ⇄ state.inputPlaceholder
  doEnableSoundNotifications: boolean;       // ⇄ state.soundNotifications
  doShowPopupMessagePreview: boolean;        // ⇄ state.popupMessagePreview
  doAskForRating: boolean;                   // ⇄ state.askForRating (hidden for AI_AGENT)
  greetingMessagePopupSettings: GreetingMessagePopupSettings;
}

/** Non-BotScrew extension: everything BotScrew has no field for.
 *  Persisted by BotScrew as opaque JSON; consumed only by the GSB widget. */
interface GsbAppearance {
  logoMaxHeight: number;
  cornerRadius: number;
  chatHeaderColor: string;
  backgroundImage: string;                    // demo-page background photo (URL or data: blob). Demo-only today (themes preview.html); reserved for an optional Chat UI background later
  bgTextMode: 'light' | 'dark';               // demo-page hero text treatment over the bg photo (light = dark scrim + white text; dark = bright scrim + dark text)
  welcomeText: string;
  updateLabel: string;                        // eyebrow for the Season Update banner
  recentUpdate: string;                       // banner body; blank hides the banner
  recentUpdateSource: 'manual' | 'flow';      // source of the Season Update content
  recentUpdateFlow: string;                   // selected Flow / AI Action id (when source==='flow'; placeholder)
  realtimeVoice: boolean;                      // show the hands-free Voice Mode feature in the chat
  typingIndicator: 'dots' | 'orb' | 'label';   // the "reply is being written" animation
  messageStyle: 'classic' | 'elevated' | 'squared'; // chat message bubble look
  /** The hero slot at the top of the open chat (Webcams & featured image card). */
  hero: {
    source: 'webcam' | 'featured' | 'none';
    webcams: Array<{        // 0+ cams; 2+ auto-rotate in a carousel (order = rotation order)
      url: string;            // any cam URL; blank = use the live conditions feed
      label: string;
      sub: string;            // caption subtitle (e.g. elevation)
      kind: 'image' | 'mjpeg' | 'unknown' | 'hls' | 'dash' | 'mp4' | 'youtube' | 'vimeo'
          | 'roundshot' | 'panomax' | 'feratel' | 'bergfex' | 'earthcam' | 'hdontap'
          | 'windy' | 'brownrice' | 'rtsp' | 'rtmp';   // auto-detected delivery type
      poster: string;         // best-effort still for non-image kinds (e.g. YouTube thumb)
    }>;
    featuredImages: Array<{ url: string; caption: string; link: string }>;  // Appearance-owned;
    // 0+ promo images; 2+ rotate in the same carousel (no LIVE pill, caption-only, tap-to-link)
  };
  ctaText: string;
  bubbleStyle: 'traditional' | 'custom' | 'enhanced' | 'slidein';
  mobileSlideIn: boolean;                     // phones force the slide-in pill (clears bottom CTAs); default true
  customIconUrl: string | null;
  customIconSize: number;                     // px diameter of the custom launcher (40–96)
  slideState: 'visible' | 'hidden';
  autoHideOnScroll: { enhanced: boolean; slidein: boolean; custom: boolean };  // per-style slide-away-on-scroll
  layoutVariant: 'side' | 'full';
  animationStyle: 'scale' | 'slide' | 'fade'; // panel open animation (default 'scale')
  blurredBackground: boolean;
  effectMode: 'none' | 'shadow' | 'glow' | 'radiate';   // Animations & effects card
  effectIntensity: number;                   // 0–100
  gradientAccent: 'none' | 'subtle' | 'moderate' | 'vivid'; // optional launcher gradient, auto-derived from brand color (default 'none')
  snowfall: {                                // ambient snowfall overlay (default off)
    enabled: boolean;
    style: 'realistic' | 'crystalline' | 'storm';
    intensity: number;                       // 20–200 (flake count)
    showOnMobile: boolean;
    pauseWhenIdle: boolean;
    respectReducedMotion: boolean;           // a11y-locked, always true
  };
  statusPillFeatures: { liveAgent: boolean; weather: boolean; needHelpCta: boolean };
  typography: {
    bodyFont: string;                        // Google Fonts family name, e.g. "Inter", "Montserrat"
    displayFont: string;                     // Google Fonts family name, e.g. "Playfair Display"
    textScale: number;                       // e.g. 0.9 | 1.0 | 1.1
  };
  embedSearch: {
    borderRadius: number; borderThickness: number;
    width: 'hug' | 'fixed' | 'full'; placeholder: string;
  };
  embedButton: {
    size: number; shape: 'round' | 'square' | 'pill';
    background: 'brand' | 'transparent' | 'white';
    iconWeight: 'thin' | 'regular' | 'bold'; label: string;
  };
  analytics: {
    ga4MeasurementId: string;  // the RESORT's own GA4 id ('' = off, format 'G-XXXXXXXXXX')
  };
}

interface WidgetSettings {
  isComposerInputEnabled: boolean;           // global; = !state.disableTextInput
  languageConfigs: Record<string, LanguageConfig>;
  gsbAppearance?: GsbAppearance;             // GSB extension (top-level, global)
}
```

## Native field mapping (1:1)

| Dashboard `state` | BotScrew | Notes |
|---|---|---|
| `logoUrl` | `languageConfigs[lang].imageUrl` | upload via `POST /file/widgetLogo` |
| `color` | `…​.color` | hex |
| `widgetName` | `…​.widgetName` | default "Agent" in BotScrew |
| `inputPlaceholder` | `…​.inputPlaceholder` | default "Write your reply" |
| `soundNotifications` | `…​.doEnableSoundNotifications` | |
| `popupMessagePreview` | `…​.doShowPopupMessagePreview` | reused for pop-up preview AND greeting popup |
| `askForRating` | `…​.doAskForRating` | **hidden when `botType === "AI_AGENT"`** |
| `disableTextInput` | `isComposerInputEnabled` | **inverted, global** |
| `placement.align` | `greetingMessagePopupSettings.alignment` | launcher Placement control; `'left'`⇄`'Left'`, `'right'`⇄`'Right'` |
| `placement.bottomSpacing` | `greetingMessagePopupSettings.bottomSpacing` | px, 24–300 |
| `placement.sideSpacing` | `greetingMessagePopupSettings.sideSpacing` | px, 24–300 |

## `gsbAppearance` extension — unmapped field reference

These have **no native BotScrew field**. BotScrew persists the block verbatim; the
GSB widget reads it. Defaults below match the dashboard's `DEFAULTS`.

> The **Animations & effects** card's fields — `animationStyle`, `effectMode` /
> `effectIntensity` (depth), and `snowfall` — are all opaque-JSON like the rest of
> `gsbAppearance`: **zero BotScrew backend change**. Any saved config from before
> these fields existed still loads identically (absent → DEFAULTS, e.g.
> `animationStyle` → `scale`, `snowfall.enabled` → `false`).

| Field | Type | Default | Controls |
|---|---|---|---|
| `logoMaxHeight` | number (px) | `44` | Header logo cap height |
| `cornerRadius` | number (px) | `7` | Master rounding (launcher pills, chat surface) |
| `chatHeaderColor` | hex | `#ffffff` | Chat header background |
| `backgroundImage` | string | `''` | **Demo-page only today.** A background photo for the prospect demo (`preview.html`) so it feels like a real resort site — URL or an uploaded `data:` blob (optimized client-side like featured images; the blob is stripped from the share-link hash, kept in localStorage). Applied via `--gsb-bg-image` + `body[data-bg-image]`. **Reserved for an optional Chat UI background later** (the widget doesn't consume it yet) |
| `bgTextMode` | enum | `light` | **Demo-page only.** Hero text treatment over `backgroundImage`: `light` (dark scrim + white text, suits most photos) or `dark` (bright scrim + dark text, for light/airy photos). Applied via `body[data-bg-text]` |
| `welcomeText` | string | "Welcome to Jackson Hole…" | First greeting line |
| `updateLabel` | string | `Season update` | Eyebrow label on the Season Update banner |
| `recentUpdate` | string | "The 2025/26 ski season…" | Season Update banner body; **blank hides the banner**. Manual copy wins over the live weather feed (`data-manual-update`) |
| `recentUpdateSource` | enum | `manual` | Where the Season Update content comes from: `manual` (typed copy) or `flow` (a BotScrew Flow / AI Action). **Partner-facing label is "Automatic"** — "flow" is kept out of the UI as jargon |
| `recentUpdateFlow` | string | `''` | Selected Flow / AI Action id when `recentUpdateSource === 'flow'`. **Placeholder** — the picker is wired in the UI but live flow output is not yet consumed |
| `hero` | object | `{source:'webcam', webcam:{url:'…codybowl.jpg', label:'Cody Bowl', kind:'image', poster:''}, featuredImage:{…}}` | The hero image area at the top of the open chat. `source` = **Webcam** (any cam URL, or blank → live conditions feed), **Featured image** (Appearance-owned), or **None**. `webcam.kind` is **auto-detected** (`src/shared/webcam.js`) and the widget **auto-renders by kind** (`src/shared/webcam-render.js`): `<img>` for image/mjpeg/snapshot, `<iframe>` for youtube/vimeo/roundshot/panomax/feratel/bergfex/windy/earthcam, `<video>`+hls.js (loaded on demand) for `.m3u8`, native `<video>` for `.mp4`. Only `rtsp`/`rtmp` can't render in a browser (shows a transcode notice). Embeds keep a pop-out "Open ↗" in case a provider blocks framing. Partners just paste a URL — no type picker. **Uploaded featured images are optimized client-side** (`src/shared/image-compress.js`: Canvas resize to ≤1600×900 + WebP re-encode under a 250KB budget) **before upload**, so BotScrew's existing file path receives small files — no server-side processing to build. Single webcam for now — multi-cam is the separately-quoted extension |
| `realtimeVoice` | boolean | `true` | Behavior toggle. When `false`, the chat hides the hands-free voice-chat button + overlay (`body[data-voice="off"]`). **User-facing label is "Voice chat"** — "realtime" stays internal, like `flow`. The dictation mic is a separate feature, unaffected |
| `typingIndicator` | enum | `dots` | **Animations & effects card.** The "reply is being written" animation: `dots` (brand-tinted pulsing dots), `orb` (breathing brand orb, kin to the Voice Mode orb), or `label` ("{widgetName} is typing…" with animated ellipsis). Widget reads `body[data-typing-indicator]` + `data-typing-label` |
| `messageStyle` | enum | `classic` | **Animations & effects card.** Chat message bubble look: `classic` (solid fills + a real pointer tail), `elevated` (both float as soft-shadowed cards), or `squared` (crisp sharp corners). Widget reads `body[data-msg-style]` |
| `ctaText` | string | `Need help?` | Launcher CTA label (≤24 glyphs) |
| `bubbleStyle` | enum | `slidein` | Launcher style: traditional/custom/enhanced/slidein |
| `mobileSlideIn` | boolean | `true` | **Launcher card.** On phone-width viewports (≤768px), force the **slide-in pill** regardless of `bubbleStyle`, so it auto-hides on scroll and clears bottom CTAs (booking / add-to-cart). Desktop is unaffected. ⚠️ **Parent-script:** the launcher is rendered by `script-chatbot.js` in production, so BotScrew's loader applies this swap — we define the flag, you honor it |
| `customIconUrl` | string\|null | `null` | Uploaded launcher icon (custom style) |
| `customIconSize` | number (px) | `56` | Custom launcher diameter (40–96; image fills it) |
| `slideState` | enum | `visible` | Slide-in pill shown/hidden |
| `autoHideOnScroll` | object | `{enhanced:true, slidein:true, custom:true}` | Per-style auto-hide-on-scroll (Status pill, Slide-in pill, Custom; on by default) |
| `layoutVariant` | enum | `side` | Panel layout: side/full |
| `animationStyle` | enum | `scale` | **Animations & effects card.** Panel open animation: `scale` (grows from the launcher — current default behavior), `slide` (rises from the bottom edge), `fade` (opacity + small rise). Drives `body[data-animation]`; absent → `scale` |
| `blurredBackground` | boolean | `true` | Backdrop blur when open |
| `effectMode` | enum | `radiate` | **Animations & effects card.** Depth effect: none/shadow/glow/radiate |
| `effectIntensity` | number | `65` | Depth strength 0–100 |
| `gradientAccent` | enum | `none` | **Identity & branding card.** Optional launcher gradient, **auto-derived from the brand color** (no extra color input). `none` = flat fill; `subtle`/`moderate`/`vivid` deepen the second stop. Launcher fill only (the three brand-filled styles); opaque-JSON, **zero backend change** — absent → flat |
| `snowfall` | object | `{enabled:false, style:'realistic', intensity:90, showOnMobile:true, pauseWhenIdle:true, respectReducedMotion:true}` | **Animations & effects card.** Ambient snowfall overlay on the chat surface. **Off by default** (heaviest, continuous effect). `style` realistic/crystalline/storm; `intensity` 20–200 flakes; behavior toggles for mobile, idle-pause, and reduced-motion (a11y-locked on) |
| `statusPillFeatures` | object | `{liveAgent,weather,needHelpCta:true}` | Status-pill toggles |
| `typography` | object | `{Inter, Playfair Display, 1.0}` | Body/display fonts + text scale. **`bodyFont`/`displayFont` are Google Fonts family names** (any of the ~1,800-family catalog). The embed must load the saved families from Google Fonts (`<link href="…css2?family=…">`) — the dashboard does this via `src/shared/fonts/font-loader.js`, which the widget loader can reuse |
| `embedSearch` | object | see schema | Embeddable search-bar config. Drives the **shippable `.gsb-embed-search` component** (in `chat-widget.css`) via `--gsb-search-*` (radius/border/width/max-width) — sparkle on the left, chat-composer-style mic + Voice/Send on the right. The dashboard preview and the demo hero search use the *same* component |
| `embedButton` | object | see schema | Embeddable magnifying-glass button config (the standalone search button), driven via `--gsb-embed-btn-*` |
| `analytics` | object | `{ ga4MeasurementId: '' }` | **Behavior card.** Optional GA4 analytics for the chat widget. **`ga4MeasurementId` is the RESORT's own GA4 id** (`''` = off). GetSkiBots' own GA4 property is **hardcoded in the widget — NOT stored in BotScrew** — so this block is *only* the resort's id. Opaque-JSON, **zero backend change** — absent → analytics off (GSB's own still runs in production). Widget routes one event to both properties via gtag `send_to`; ad-blocker safe |

## What BotScrew's backend needs to do

To support Option B, BotScrew must:

1. **Accept + persist** a top-level `gsbAppearance` object on `PATCH /bot/{botId}/widget`
   and return it on `GET …/widget` — treat it as **opaque JSON** (no validation of
   inner fields required).
2. Leave the **native schema unchanged** — the 8 native fields keep their exact
   names/shapes; nothing about the existing tab breaks if `gsbAppearance` is absent.

If BotScrew cannot persist the extension yet, the native tab still works fully;
the GSB-only features simply fall back to dashboard `DEFAULTS`.

## Producing & consuming this contract

The appearance dashboard (`index.html` + `src/dashboard/dashboard.js`) is the
**producer**: on **Save** it maps its internal `state` to this shape via
[`src/shared/widget-config.js`](../src/shared/widget-config.js)
(`toBotscrewWidgetSettings`) and writes it to `localStorage["gsb_widget_settings"]`.
On load it hydrates `state` from that key via `fromBotscrewWidgetSettings` (merged
over `DEFAULTS`), so a round-trip is lossless. (A separate `gsb_preview_config` is
auto-written on every change, but only feeds the live preview — it is not the
source of truth.)

To drop into BotScrew, an engineer:

1. Loads `widgetSettings` with `GET /bot/{botId}/widget` (and
   `…/widget/default-translations`) and renders the Appearance tab from it.
2. On edit, saves the whole object with `PATCH /bot/{botId}/widget`
   (debounced, `credentials: "include"`).
3. Uploads logos with `POST /file/widgetLogo` (multipart `file`, ≤ 2 MB).

The 8 native fields map 1:1; the `gsbAppearance` block is persisted as opaque JSON.

> ⚠️ **Unconfirmed:** the exact field on the `POST /file/widgetLogo` response that
> holds the uploaded image URL — confirm against BotScrew's API. Everything else
> (endpoints, methods, payloads) is aligned with BotScrew's existing API.

## Local testing

The dashboard writes the BotScrew-shaped object to `localStorage["gsb_widget_settings"]`
when you click **Save changes** (and hydrates from it on reload). Inspect it in DevTools:

```js
JSON.parse(localStorage.getItem('gsb_widget_settings'))
```

## React integration — what drops in vs what's a port

BotScrew's admin is React; this build is framework-free vanilla. Those are two
different integration stories, so here's the honest map.

**Framework-agnostic — `import` straight into React, no DOM-framework coupling.**
These are pure functions or self-contained DOM helpers; wrap them in hooks/effects.

| Module | What it does | Drop-in |
|---|---|---|
| `src/shared/widget-config.js` | `to`/`fromBotscrewWidgetSettings` — **this contract's mapper** | ✅ pure |
| `src/shared/weather/open-meteo.js` | Open-Meteo adapter → normalized model (°F/mph) | ✅ pure |
| `src/shared/webcam.js` | webcam URL classification (`detectWebcamKind`/`webcamRender`/`embedUrl`/poster) | ✅ pure |
| `src/shared/webcam-render.js` | renders any cam (img / iframe / video+hls.js) into an element | ✅ DOM helper |
| `src/shared/image-compress.js` | client-side resize + compress (Canvas) — `optimizeImage`/`optimizeCrop` | ✅ Canvas |
| `src/shared/logo.js` | bulletproof logo validate (magic-byte sniff, HEIC reject, decode-verify) + alpha-preserving optimize | ✅ Canvas |
| `src/shared/fonts/font-loader.js` + `google-fonts.json` | Google Fonts dynamic loader + catalog | ✅ DOM helper |

**The embeddable widget — `src/widget/` — vanilla, and should *stay* vanilla.** It
mounts on the *resort's* site via a script tag; requiring React on a customer's page
is a liability, not a feature.

**The Appearance dashboard UI — `src/dashboard/` — a React port, not a drop-in.** It's
imperative DOM (a `render()` that sets CSS vars/data-attrs, the font picker, the crop
editor, the accordion). BotScrew **rebuilds this as React components**, but it's a
*guided* rebuild, not from scratch: our build is the pixel-precise spec, the plain CSS
is already value-matched to their Bootstrap look (radii/spacing/shadows matched to
BotScrew's existing UI), and the controls just read/write the **exact shape this doc defines**.
The crop/optimize/webcam/weather/font logic above ports as-is, so their components are
thin shells over it.

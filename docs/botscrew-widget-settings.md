# BotScrew Widget Settings — Integration Contract

This is the **drop-in contract** between the GetSkiBots appearance dashboard and
BotScrew's admin (`Widget → Appearance` tab). It was reverse-engineered from the
live BotScrew bundle (`main.ce2404c7.js`) and is implemented 1:1 by
[`src/shared/widget-config.js`](../src/shared/widget-config.js). **Keep this file
and that module in lockstep** — the TypeScript interface below is the source of
truth.

## How BotScrew stores appearance

BotScrew scopes appearance **per language** under `widgetSettings.languageConfigs[<lang>]`
(default key `"English"`), plus one **global** flag `isComposerInputEnabled`.

- Load: `GET {API}/bot/{botId}/widget` and `GET {API}/bot/{botId}/widget/default-translations`
- Save: `PATCH {API}/bot/{botId}/widget` (whole object; saves on blur/enter, "disable input" saves immediately)
- Logo upload: `POST {API}/file/widgetLogo` (multipart `file`, `credentials: "include"`, jpeg/png/jpg/gif/svg, **max 2 MB**) — shared by widget logo + popup logo
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
  welcomeText: string;
  updateLabel: string;                        // eyebrow for the Season Update banner
  recentUpdate: string;                       // banner body; blank hides the banner
  ctaText: string;
  bubbleStyle: 'traditional' | 'custom' | 'enhanced' | 'slidein';
  customIconUrl: string | null;
  customIconSize: number;                     // px diameter of the custom launcher (40–96)
  slideState: 'visible' | 'hidden';
  autoHideOnScroll: { enhanced: boolean; slidein: boolean; custom: boolean };  // per-style slide-away-on-scroll
  layoutVariant: 'side' | 'middle' | 'full';
  blurredBackground: boolean;
  effectMode: 'none' | 'shadow' | 'glow' | 'radiate';
  effectIntensity: number;                   // 0–100
  statusPillFeatures: { liveAgent: boolean; weather: boolean; needHelpCta: boolean };
  typography: {
    bodyFont: 'Inter' | 'DM Sans' | 'System';
    displayFont: 'Playfair Display' | 'DM Serif Display' | 'Merriweather';
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

| Field | Type | Default | Controls |
|---|---|---|---|
| `logoMaxHeight` | number (px) | `44` | Header logo cap height |
| `cornerRadius` | number (px) | `7` | Master rounding (launcher pills, chat surface) |
| `chatHeaderColor` | hex | `#ffffff` | Chat header background |
| `welcomeText` | string | "Welcome to Jackson Hole…" | First greeting line |
| `updateLabel` | string | `Season update` | Eyebrow label on the Season Update banner |
| `recentUpdate` | string | "The 2025/26 ski season…" | Season Update banner body; **blank hides the banner**. Manual copy wins over the live weather feed (`data-manual-update`) |
| `ctaText` | string | `Need help?` | Launcher CTA label (≤24 glyphs) |
| `bubbleStyle` | enum | `slidein` | Launcher style: traditional/custom/enhanced/slidein |
| `customIconUrl` | string\|null | `null` | Uploaded launcher icon (custom style) |
| `customIconSize` | number (px) | `56` | Custom launcher diameter (40–96; image fills it) |
| `slideState` | enum | `visible` | Slide-in pill shown/hidden |
| `autoHideOnScroll` | object | `{enhanced:true, slidein:true, custom:true}` | Per-style auto-hide-on-scroll (Status pill, Slide-in pill, Custom; on by default) |
| `layoutVariant` | enum | `side` | Panel layout: side/middle/full |
| `blurredBackground` | boolean | `true` | Backdrop blur when open |
| `effectMode` | enum | `radiate` | Depth effect: none/shadow/glow/radiate |
| `effectIntensity` | number | `65` | Depth strength 0–100 |
| `statusPillFeatures` | object | `{liveAgent,weather,needHelpCta:true}` | Status-pill toggles |
| `typography` | object | `{Inter, Playfair Display, 1.0}` | Body/display fonts + text scale |
| `embedSearch` | object | see schema | Embeddable search-bar config |
| `embedButton` | object | see schema | Embeddable magnifying-glass button config |

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
auto-written on every change, but only feeds the sharable.link live preview — it is
not the source of truth.)

To drop into BotScrew, an engineer:

1. Loads `widgetSettings` with `GET /bot/{botId}/widget` (and
   `…/widget/default-translations`) and renders the Appearance tab from it.
2. On edit, saves the whole object with `PATCH /bot/{botId}/widget`
   (debounced, `credentials: "include"`).
3. Uploads logos with `POST /file/widgetLogo` (multipart `file`, ≤ 2 MB).

The 8 native fields map 1:1; the `gsbAppearance` block is persisted as opaque JSON.

> ⚠️ **Unconfirmed:** the exact field on the `POST /file/widgetLogo` response that
> holds the uploaded image URL — confirm against BotScrew's API. Everything else
> (endpoints, methods, payloads) is verified from their bundle.

## Local testing

The dashboard writes the BotScrew-shaped object to `localStorage["gsb_widget_settings"]`
when you click **Save changes** (and hydrates from it on reload). Inspect it in DevTools:

```js
JSON.parse(localStorage.getItem('gsb_widget_settings'))
```

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
  ctaText: string;
  bubbleStyle: 'traditional' | 'custom' | 'enhanced' | 'slidein';
  customIconUrl: string | null;
  slideState: 'visible' | 'hidden';
  layoutVariant: 'side' | 'middle' | 'full';
  blurredBackground: boolean;
  effectMode: 'none' | 'shadow' | 'glow' | 'radiate';
  effectIntensity: number;                   // 0–100
  snowfall: {
    enabled: boolean;
    style: 'realistic' | 'crystalline' | 'storm';
    intensity: number;                       // 20–200 (flake count)
    showOnMobile: boolean;
    pauseWhenIdle: boolean;
    respectReducedMotion: boolean;           // a11y-locked, always true
  };
  statusPillFeatures: { liveAgent: boolean; weather: boolean; needHelpCta: boolean };
  typography: {
    bodyFont: 'Inter' | 'DM Sans' | 'System';
    displayFont: 'Playfair Display' | 'DM Serif Display' | 'Merriweather';
    textScale: number;                       // e.g. 0.9 | 1.0 | 1.1
  };
  embedSearch: {
    borderRadius: number; borderThickness: number;
    width: 'hug' | 'fixed' | 'full'; placeholder: string; inlineGlass: boolean;
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

## `gsbAppearance` extension — unmapped field reference

These have **no native BotScrew field**. BotScrew persists the block verbatim; the
GSB widget reads it. Defaults below match the dashboard's `DEFAULTS`.

| Field | Type | Default | Controls |
|---|---|---|---|
| `logoMaxHeight` | number (px) | `44` | Header logo cap height |
| `cornerRadius` | number (px) | `7` | Master rounding (launcher pills, chat surface) |
| `chatHeaderColor` | hex | `#ffffff` | Chat header background |
| `welcomeText` | string | "Welcome to Jackson Hole…" | First greeting line |
| `ctaText` | string | `Need help?` | Launcher CTA label (≤24 glyphs) |
| `bubbleStyle` | enum | `slidein` | Launcher style: traditional/custom/enhanced/slidein |
| `customIconUrl` | string\|null | `null` | Uploaded launcher icon (custom style) |
| `slideState` | enum | `visible` | Slide-in pill shown/hidden |
| `layoutVariant` | enum | `side` | Panel layout: side/middle/full |
| `blurredBackground` | boolean | `true` | Backdrop blur when open |
| `effectMode` | enum | `radiate` | Depth effect: none/shadow/glow/radiate |
| `effectIntensity` | number | `65` | Depth strength 0–100 |
| `snowfall` | object | `{enabled:false,…}` | Snow overlay engine config |
| `statusPillFeatures` | object | `{liveAgent,weather,needHelpCta:true}` | Status-pill toggles |
| `typography` | object | `{Inter, Playfair Display, 1.0}` | Body/display fonts + text scale |
| `embedSearch` | object | see schema | Embeddable search-bar config |
| `embedButton` | object | see schema | Embeddable magnifying-glass button config |

> **`respectReducedMotion`** inside `snowfall` is a11y-locked to `true`.

## What BotScrew's backend needs to do

To support Option B, BotScrew must:

1. **Accept + persist** a top-level `gsbAppearance` object on `PATCH /bot/{botId}/widget`
   and return it on `GET …/widget` — treat it as **opaque JSON** (no validation of
   inner fields required).
2. Leave the **native schema unchanged** — the 8 native fields keep their exact
   names/shapes; nothing about the existing tab breaks if `gsbAppearance` is absent.

If BotScrew cannot persist the extension yet, the native tab still works fully;
the GSB-only features simply fall back to dashboard `DEFAULTS`.

## Wiring (drop-in usage)

The component is controlled; BotScrew composes it with the API client
([`src/botscrew/botscrewApi.js`](../src/botscrew/botscrewApi.js)) inside their
authenticated app. `baseUrl`, `botId`, `botType` come from their runtime context.

```tsx
import { useEffect, useMemo, useState } from 'react';
import AppearanceTab from './AppearanceTab';
import { createBotscrewApi, debounce } from './botscrewApi';

function WidgetAppearance({ baseUrl, botId, botType }) {
  const api = useMemo(() => createBotscrewApi({ baseUrl, botId }), [baseUrl, botId]);
  const [settings, setSettings] = useState(null);
  useEffect(() => { api.loadWidgetSettings().then(setSettings); }, [api]);
  const save = useMemo(() => debounce((s) => api.saveWidgetSettings(s), 500), [api]);
  if (!settings) return null;
  return (
    <AppearanceTab
      settings={settings}
      botType={botType}
      onChange={(next) => { setSettings(next); save(next); }}     // PATCH /bot/{id}/widget
      onUploadLogo={(file) => api.uploadWidgetLogo(file).then((r) => r.url)} // POST /file/widgetLogo
    />
  );
}
```

> ⚠️ **Unconfirmed:** the exact field on the `POST /file/widgetLogo` response that
> holds the uploaded image URL (assumed `r.url`) — confirm against BotScrew's API.
> Everything else (endpoints, methods, payloads) is verified from their bundle.

## Local testing

The dashboard writes the BotScrew-shaped object to `localStorage["gsb_widget_settings"]`
on every change (alongside the legacy `gsb_preview_config`). Inspect it in DevTools:

```js
JSON.parse(localStorage.getItem('gsb_widget_settings'))
```

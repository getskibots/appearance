/* BotScrew widget-settings mapper — the single source of truth for "drop-in"
 * alignment between this dashboard's flat `state` and BotScrew's real
 * `widgetSettings` shape (reverse-engineered from the live admin bundle, see
 * docs/botscrew-widget-settings.md).
 *
 * BotScrew stores appearance per language under `languageConfigs[<lang>]`, plus
 * one global `isComposerInputEnabled`. Their tab exposes ~8 fields; our dashboard
 * configures ~15 more (snowfall, depth, bubble styles, typography, embeddables).
 * Those extras have NO native BotScrew field, so we carry them in a namespaced
 * `gsbAppearance` block that BotScrew's backend can persist as opaque JSON and
 * strip/ignore if unsupported. Native fields map 1:1; nothing about BotScrew's
 * own schema changes.
 *
 * Keep this file in lockstep with docs/botscrew-widget-settings.md — the TS
 * interface there is the contract this implements.
 */

/** Default language key BotScrew uses (their default config is "English"). */
export const DEFAULT_LANG = 'English';

/** GreetingMessagePopupSettings defaults — BotScrew exposes these, our dashboard
 *  does not yet, so we emit sensible defaults (documented as not-yet-exposed). */
function greetingPopupDefaults(state) {
  return {
    popupLogoUrl: state.logoUrl || null,
    popupLogoSize: 64,     // BotScrew valid range 40–100 px
    alignment: 'Right',    // 'Left' | 'Right'
    bottomSpacing: 32,     // BotScrew valid range 24–300 px
    sideSpacing: 32,       // BotScrew valid range 24–300 px
  };
}

/** The GSB extension block: every appearance field BotScrew has no home for.
 *  Mirrors our `state` exactly (minus the 8 natively-mapped fields). */
function toGsbAppearance(state) {
  return {
    logoMaxHeight: state.logoMaxHeight,
    cornerRadius: state.cornerRadius,
    chatHeaderColor: state.chatHeaderColor,
    welcomeText: state.welcomeText,
    ctaText: state.ctaText,
    bubbleStyle: state.bubbleStyle,
    customIconUrl: state.customIconUrl,
    slideState: state.slideState,
    layoutVariant: state.layoutVariant,
    blurredBackground: state.blurredBackground,
    effectMode: state.effectMode,
    effectIntensity: state.effectIntensity,
    snowfall: state.snowfall,
    statusPillFeatures: state.statusPillFeatures,
    typography: state.typography,
    embedSearch: state.embedSearch,
    embedButton: state.embedButton,
  };
}

/**
 * Convert our flat dashboard `state` into BotScrew's `widgetSettings` shape.
 * @param {object} state  Our dashboard state (see DEFAULTS in dashboard.js).
 * @param {{ lang?: string }} [opts]
 * @returns {object} BotScrew-shaped widgetSettings (native fields 1:1 +
 *   top-level gsbAppearance extension).
 */
export function toBotscrewWidgetSettings(state, opts) {
  var lang = (opts && opts.lang) || DEFAULT_LANG;
  var languageConfigs = {};
  languageConfigs[lang] = {
    // ---- BotScrew-native fields (exact 1:1) ----
    imageUrl: state.logoUrl,
    color: state.color,
    widgetName: state.widgetName,
    inputPlaceholder: state.inputPlaceholder,
    doEnableSoundNotifications: state.soundNotifications,
    doShowPopupMessagePreview: state.popupMessagePreview,
    doAskForRating: state.askForRating, // only RENDERED when botType !== 'AI_AGENT'
    greetingMessagePopupSettings: greetingPopupDefaults(state),
  };
  return {
    // Global (BotScrew-native): their checkbox is "Disable text input", stored
    // inverted as isComposerInputEnabled.
    isComposerInputEnabled: !state.disableTextInput,
    languageConfigs: languageConfigs,
    // ---- GSB extension (non-BotScrew; opaque to their backend) ----
    gsbAppearance: toGsbAppearance(state),
  };
}

/**
 * Inverse: hydrate our flat `state` from a BotScrew `widgetSettings` object.
 * Native fields come from languageConfigs[lang]; everything else from the
 * gsbAppearance block if present (so a round-trip is lossless). Useful for the
 * eventual drop-in: BotScrew hands us settings, we render from them.
 * @param {object} settings  BotScrew widgetSettings.
 * @param {{ lang?: string }} [opts]
 * @returns {object} Partial dashboard state (merge over DEFAULTS).
 */
export function fromBotscrewWidgetSettings(settings, opts) {
  if (!settings) return {};
  var lang = (opts && opts.lang) || DEFAULT_LANG;
  var lc = (settings.languageConfigs && settings.languageConfigs[lang]) || {};
  var ext = settings.gsbAppearance || {};
  var out = {
    logoUrl: lc.imageUrl,
    color: lc.color,
    widgetName: lc.widgetName,
    inputPlaceholder: lc.inputPlaceholder,
    soundNotifications: lc.doEnableSoundNotifications,
    popupMessagePreview: lc.doShowPopupMessagePreview,
    askForRating: lc.doAskForRating,
    disableTextInput: settings.isComposerInputEnabled === undefined
      ? undefined
      : !settings.isComposerInputEnabled,
  };
  // Layer the extension fields back in (snowfall, typography, etc.).
  for (var k in ext) {
    if (Object.prototype.hasOwnProperty.call(ext, k)) out[k] = ext[k];
  }
  // Drop undefined keys so callers can cleanly merge over DEFAULTS.
  Object.keys(out).forEach(function (k) {
    if (out[k] === undefined) delete out[k];
  });
  return out;
}

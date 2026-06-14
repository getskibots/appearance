/* GetSkiBots — apply a widget appearance config to the live DOM.
 *
 * Single source of truth for turning a config object into the CSS variables,
 * data-attributes, and content the widget reads. The dashboard, preview.html,
 * and the eventual standalone embed all call this — so the widget themes itself
 * identically everywhere, from one config shape (the flat shape the dashboard's
 * `state` / buildLivePreviewConfig() produce; the BotScrew mapper lands here too).
 *
 * Pure DOM application: no dashboard controls, no `state`, no side effects beyond
 * styling the widget. Absent fields fall back to the defaults baked into
 * tokens.css, so a partial config degrades gracefully. New appearance fields are
 * added here once and every surface picks them up.
 */

/* ---- color helpers (kept in sync with the dashboard's COLOR HELPERS) ---- */
function hexToRgb(hex) {
  var m = /^#?([a-f0-9]{2})([a-f0-9]{2})([a-f0-9]{2})$/i.exec(hex);
  return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : null;
}
function rgbToHex(r, g, b) {
  function p(v) { v = Math.max(0, Math.min(255, Math.round(v))); var s = v.toString(16); return s.length === 1 ? '0' + s : s; }
  return '#' + p(r) + p(g) + p(b);
}
function darken(hex, amt) {
  var rgb = hexToRgb(hex);
  return rgb ? rgbToHex(rgb[0] * (1 - amt), rgb[1] * (1 - amt), rgb[2] * (1 - amt)) : hex;
}
function relativeLuminance(hex) {
  var rgb = hexToRgb(hex); if (!rgb) return 0;
  function chan(v) { v = v / 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }
  return 0.2126 * chan(rgb[0]) + 0.7152 * chan(rgb[1]) + 0.0722 * chan(rgb[2]);
}

function setVar(name, val) { if (val != null) document.documentElement.style.setProperty(name, val); }
function setText(id, val) { var el = document.getElementById(id); if (el && val != null) el.textContent = val; }

export function applyWidgetConfig(config) {
  config = config || {};
  var body = document.body;

  /* ---- Brand color (+ derived enhanced / contrast tokens) ---- */
  if (config.color && /^#?[a-f0-9]{6}$/i.test(config.color)) {
    var hex = (config.color.charAt(0) === '#' ? config.color : '#' + config.color).toLowerCase();
    var lightBrand = relativeLuminance(hex) > 0.55;
    var rgb = hexToRgb(hex) || [164, 30, 35];
    setVar('--brand', hex);
    setVar('--brand-deep', darken(hex, 0.25));
    setVar('--brand-rgb', rgb.join(','));
    setVar('--enhanced-bg', hex);
    setVar('--enhanced-fg', lightBrand ? '#1a1a1a' : '#ffffff');
    setVar('--enhanced-fg-soft', lightBrand ? 'rgba(26,26,26,0.65)' : 'rgba(255,255,255,0.78)');
    setVar('--enhanced-divider', lightBrand ? 'rgba(0,0,0,0.14)' : 'rgba(255,255,255,0.18)');
    setVar('--enhanced-human-bg', lightBrand ? 'rgba(0,0,0,0.18)' : 'rgba(255,255,255,0.18)');
  }

  /* ---- Shape / surface ---- */
  if (config.cornerRadius != null) {
    setVar('--gsb-radius', config.cornerRadius + 'px');
    setVar('--gsb-radius-sm', Math.round(config.cornerRadius * 0.55) + 'px');
  }
  if (config.chatHeaderColor) setVar('--gsb-chat-header-bg', config.chatHeaderColor);
  if (config.logoMaxHeight != null) setVar('--logo-max-height', config.logoMaxHeight + 'px');

  /* ---- Launcher placement (popup + open panel inherit it) ---- */
  var place = config.placement || {};
  if (place.bottomSpacing != null) setVar('--gsb-launcher-bottom', place.bottomSpacing + 'px');
  if (place.sideSpacing != null) setVar('--gsb-launcher-side', place.sideSpacing + 'px');

  /* ---- Typography (caller is responsible for actually loading the fonts) ---- */
  var typo = config.typography || {};
  if (typo.bodyFont) setVar('--gsb-body-font', "'" + typo.bodyFont + "', system-ui, -apple-system, sans-serif");
  if (typo.displayFont) setVar('--gsb-display-font', "'" + typo.displayFont + "', Georgia, serif");
  if (typo.textScale != null) setVar('--gsb-text-scale', String(typo.textScale));

  /* ---- Logo: image when set, text placeholder otherwise ---- */
  var headerLogo = document.getElementById('headerLogo');
  var brandColLogo = document.getElementById('brandColLogo');
  var placeholder = document.getElementById('headerPlaceholder');
  if (config.logoUrl) {
    if (headerLogo) { headerLogo.src = config.logoUrl; headerLogo.style.display = ''; }
    if (brandColLogo) { brandColLogo.src = config.logoUrl; brandColLogo.style.display = ''; }
    if (placeholder) placeholder.style.display = 'none';
  } else {
    if (headerLogo) { headerLogo.removeAttribute('src'); headerLogo.style.display = 'none'; }
    if (brandColLogo) { brandColLogo.removeAttribute('src'); brandColLogo.style.display = 'none'; }
    if (placeholder) placeholder.style.display = '';
  }

  /* ---- Copy ---- */
  setText('headerPlaceholderName', config.widgetName);
  setText('brandColTitle', config.widgetName);
  setText('welcomeLine', config.welcomeText);
  var composer = document.getElementById('gsbComposerInput');
  if (composer && config.inputPlaceholder != null) composer.placeholder = config.inputPlaceholder;

  /* ---- Behavior data-attributes (the widget CSS reads these on <body>) ---- */
  if (config.layoutVariant) body.setAttribute('data-variant', config.layoutVariant);
  if (config.animationStyle) body.setAttribute('data-animation', config.animationStyle);
  if (config.typingIndicator) body.setAttribute('data-typing-indicator', config.typingIndicator);
  body.setAttribute('data-typing-label', config.widgetName || 'AI Concierge');
  if (config.blurredBackground != null) body.setAttribute('data-modal-blur', config.blurredBackground ? 'true' : 'false');

  /* ---- Live-agent indicator → header pill + label ("Online" vs "AI Concierge") ---- */
  var pill = config.statusPillFeatures || {};
  var liveAgent = pill.liveAgent !== false; // default on
  body.setAttribute('data-liveagent', liveAgent ? 'on' : 'off');
  setText('gsbAgentStatusLabel', liveAgent ? 'Online' : 'AI Concierge');

  /* ---- Hands-free voice on/off ---- */
  body.setAttribute('data-voice', config.realtimeVoice === false ? 'off' : 'on');

  /* ---- Ambient snowfall style (engine, when present, reads this) ---- */
  var snow = config.snowfall || {};
  if (snow.style) body.setAttribute('data-snow-style', snow.style);

  /* ---- Launcher attributes ---- */
  var launcher = document.querySelector('.gsb-launcher');
  if (launcher) {
    if (config.bubbleStyle) launcher.setAttribute('data-icon-style', config.bubbleStyle);
    var isPill = config.bubbleStyle === 'enhanced' || config.bubbleStyle === 'slidein';
    launcher.setAttribute('data-show-weather', (pill.weather && isPill) ? 'true' : 'false');
    launcher.setAttribute('data-show-cta', (pill.needHelpCta && isPill) ? 'true' : 'false');
    if (place.align) launcher.setAttribute('data-align', place.align === 'left' ? 'left' : 'right');
    launcher.setAttribute('data-custom-icon', config.customIconUrl ? 'true' : 'false');
  }
}

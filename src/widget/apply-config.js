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

import { renderWebcamHero, clearWebcamHero } from '../shared/webcam-render.js';

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

  /* ---- Demo/page background image (the preview page now; optional Chat UI later) ---- */
  if (config.backgroundImage) {
    setVar('--gsb-bg-image', 'url("' + config.backgroundImage + '")');
    body.setAttribute('data-bg-image', 'true');
  } else {
    document.documentElement.style.removeProperty('--gsb-bg-image');
    body.setAttribute('data-bg-image', 'false');
  }
  body.setAttribute('data-bg-text', config.bgTextMode === 'dark' ? 'dark' : 'light');

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

  /* ---- Ambient snowfall style (engine, when present, reads this) ----
     Reflect the effective style: 'none' when the effect is disabled, so the
     CSS kill-switch + engine both see the off state (mirrors the dashboard). */
  var snow = config.snowfall || {};
  body.setAttribute('data-snow-style', snow.enabled ? (snow.style || 'realistic') : 'none');

  /* ---- Launcher attributes ---- */
  var launcher = document.querySelector('.gsb-launcher');
  if (launcher) {
    if (config.bubbleStyle) launcher.setAttribute('data-icon-style', config.bubbleStyle);
    var isPill = config.bubbleStyle === 'enhanced' || config.bubbleStyle === 'slidein';
    launcher.setAttribute('data-show-weather', (pill.weather && isPill) ? 'true' : 'false');
    launcher.setAttribute('data-show-cta', (pill.needHelpCta && isPill) ? 'true' : 'false');
    if (place.align) launcher.setAttribute('data-align', place.align === 'left' ? 'left' : 'right');
    launcher.setAttribute('data-custom-icon', config.customIconUrl ? 'true' : 'false');
    // Slide-in launcher peek/visible state.
    if (config.slideState) launcher.setAttribute('data-slide-state', config.slideState);
    // Custom launcher icon image (shown only in the 'custom' bubble style).
    var customIconImg = document.getElementById('customIconImg');
    if (customIconImg) {
      if (config.customIconUrl) { customIconImg.src = config.customIconUrl; customIconImg.style.display = ''; }
      else { customIconImg.removeAttribute('src'); customIconImg.style.display = 'none'; }
    }
  }

  /* ---- Embeddable components (hero search bar + standalone search button) ----
     Global CSS vars on :root, so any embed-component markup — the dashboard
     preview, the demo homepage, or a real on-site embed — follows the appearance
     config. Markup/placeholder is page-specific; these vars carry the styling. */
  var es = config.embedSearch || {};
  // Radius: cap at the pill value (>=100 → fully round), matching the dashboard.
  if (es.borderRadius != null) setVar('--gsb-embed-search-radius', (es.borderRadius >= 100 ? 999 : es.borderRadius) + 'px');
  if (es.borderThickness != null) setVar('--gsb-embed-search-border', es.borderThickness + 'px');
  // Width: hug = shrink to content, fixed = 480px cap, full = unconstrained.
  if (es.width) setVar('--gsb-embed-search-maxw', es.width === 'hug' ? 'max-content' : (es.width === 'full' ? 'none' : '480px'));

  var eb = config.embedButton || {};
  if (eb.size != null) setVar('--gsb-embed-btn-size', eb.size + 'px');
  if (eb.shape) setVar('--gsb-embed-btn-radius', eb.shape === 'square' ? '8px' : (eb.shape === 'pill' ? '999px' : '50%'));
  if (eb.background) {
    setVar('--gsb-embed-btn-bg', eb.background === 'white' ? '#ffffff' : (eb.background === 'transparent' ? 'transparent' : 'var(--brand)'));
    setVar('--gsb-embed-btn-fg', eb.background === 'brand' ? 'var(--enhanced-fg, #fff)' : 'var(--brand)');
  }
  if (eb.iconWeight) setVar('--gsb-embed-btn-stroke', eb.iconWeight === 'thin' ? '1.4' : (eb.iconWeight === 'bold' ? '2.4' : '1.8'));

  /* ---- Depth effect (launcher box-shadow + radiate/glow pulse) ----
     Mirrors the dashboard render(): one --gsb-depth-effect value the launcher +
     embed surfaces share, plus the launcher's data-effect-mode and pulse strength.
     'radiate'/'none' keep the box-shadow transparent (the launcher pulse owns it). */
  if (config.effectMode) {
    var fxI = Math.max(0, Math.min(100, config.effectIntensity || 0)) / 100;
    var depth;
    if (config.effectMode === 'shadow') {
      var sLift = Math.round(8 + fxI * 24), sB1 = Math.round(30 + fxI * 50), sB2 = Math.round(6 + fxI * 14);
      depth = '0 ' + sLift + 'px ' + sB1 + 'px rgba(23,19,15,' + (0.06 + fxI * 0.20).toFixed(3) + '), '
            + '0 4px ' + sB2 + 'px rgba(23,19,15,' + (0.03 + fxI * 0.07).toFixed(3) + ')';
    } else if (config.effectMode === 'glow') {
      var gSpread = Math.round(fxI * 24), gBlur = Math.round(20 + fxI * 40), gSoft = Math.round(40 + fxI * 60);
      var gOp = (0.20 + fxI * 0.45).toFixed(3), gSoftOp = (0.10 + fxI * 0.20).toFixed(3);
      depth = '0 0 0 ' + gSpread + 'px rgba(var(--brand-rgb), ' + gOp + '), '
            + '0 0 ' + gBlur + 'px rgba(var(--brand-rgb), ' + gOp + '), '
            + '0 8px ' + gSoft + 'px rgba(var(--brand-rgb), ' + gSoftOp + ')';
    } else {
      depth = '0 0 0 transparent';
    }
    setVar('--gsb-depth-effect', depth);
    if (launcher) {
      launcher.setAttribute('data-effect-mode', config.effectMode);
      launcher.style.setProperty('--gsb-radiate-strength', String(0.4 + fxI * 1.2));
      launcher.style.setProperty('--gsb-glow-strength', String(fxI));
    }
  }
  if (config.customIconSize != null) setVar('--gsb-custom-launcher-size', config.customIconSize + 'px');

  /* ---- Launcher CTA text (the "Need help?" pill copy) ---- */
  if (launcher && config.ctaText != null) {
    var ctaEl = launcher.querySelector('.gsb-cta-text');
    if (ctaEl) ctaEl.textContent = config.ctaText || 'Need help?';
  }

  /* ---- Season Update banner — Appearance-owned copy (updateLabel + recentUpdate).
     Manual copy (or a Flow stub) is flagged data-manual-update so the live weather
     feed leaves it alone; blank hides the banner. Matches the dashboard render(). */
  var seasonBanner = document.getElementById('gsbSeasonBanner');
  if (seasonBanner && (config.updateLabel != null || config.recentUpdate != null || config.recentUpdateSource != null)) {
    var flowLabels = { 'operations': 'Get Operations', 'conditions': 'Get Conditions', 'ecommerce': 'Get Ecommerce', 'events': 'Get Events', 'alerts': 'Get Alerts' };
    var manualUpd = config.recentUpdateSource !== 'flow';
    var sShow, sBody;
    if (!manualUpd) {
      var fName = flowLabels[config.recentUpdateFlow];
      sShow = !!fName;
      sBody = fName ? ('Live updates from “' + fName + '” will appear here.') : '';
    } else {
      sShow = !!(config.recentUpdate && config.recentUpdate.trim());
      sBody = config.recentUpdate || '';
    }
    seasonBanner.style.display = sShow ? 'block' : 'none';
    // Always claim the banner so the widget runtime's hardcoded demo season copy
    // can never leak in. Blank manual text simply hides it (no stale filler).
    seasonBanner.setAttribute('data-manual-update', 'true');
    var sTitle = seasonBanner.querySelector('.gsb-season-banner__title');
    if (sTitle && config.updateLabel != null) sTitle.textContent = config.updateLabel || 'Season update';
    var sText = document.getElementById('gsbSeasonText');
    if (sText) sText.textContent = sBody;
  }

  /* ---- Hero (webcam / featured image) source + station caption ----
     The webcam image itself is drawn by the widget runtime; here we set the
     source + managed flags it honors, plus the station label from config. */
  var heroEl = document.getElementById('gsbHero');
  if (heroEl && config.hero) {
    var h = config.hero;
    if (h.source) heroEl.setAttribute('data-hero-source', h.source);
    var station = document.getElementById('gsbHeroStation');
    if (h.source === 'featured') {
      // Appearance-owned still image — render it here (the runtime only draws cams).
      if (h.featuredImage && h.featuredImage.url) renderWebcamHero(heroEl, { url: h.featuredImage.url, kind: 'image', poster: '' });
      else clearWebcamHero(heroEl);
      if (station) station.textContent = (h.featuredImage && h.featuredImage.caption) || '';
      heroEl.setAttribute('data-hero-managed', 'true');
    } else if (h.source === 'none') {
      heroEl.setAttribute('data-hero-managed', 'true');
    } else if (station && h.webcam && h.webcam.label) {
      station.textContent = h.webcam.label; // 'webcam' — runtime renders the live cam
    }
  }

  /* ---- Disable text input (composer becomes read-only) ---- */
  var composerInput = document.getElementById('gsbComposerInput');
  if (composerInput && config.disableTextInput != null) {
    composerInput.disabled = !!config.disableTextInput;
    body.setAttribute('data-input-disabled', config.disableTextInput ? 'true' : 'false');
  }
}

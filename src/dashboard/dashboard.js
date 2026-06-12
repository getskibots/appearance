/* GetSkiBots — Dashboard (admin appearance UI) logic.
   Extracted verbatim from index.html's inline <script> (IIFE #1).
   Drives the chat preview via the window.gsbChatPreview bridge defined by the
   widget runtime. To be decomposed into color-utils / snowfall / sync modules. */

// BotScrew-aligned config mapper (drop-in contract). See docs/botscrew-widget-settings.md.
import { toBotscrewWidgetSettings, fromBotscrewWidgetSettings } from '../shared/widget-config.js';
// Google Fonts typography: catalog + dynamic loader + searchable picker.
import { loadFont, loadPreview, fontStack } from '../shared/fonts/font-loader.js';
import { createFontPicker } from './font-picker.js';
import FONT_CATALOG from '../shared/fonts/google-fonts.json';

(function() {
  'use strict';

  // ============= FONT CATALOG (Google Fonts) =============
  // Lookup by family for category + available weights; curated shortlists are the
  // picker's default "Popular for resorts" view (search covers the full catalog).
  var FONT_BY_NAME = {};
  FONT_CATALOG.forEach(function(e) { FONT_BY_NAME[e.f] = e; });
  var CURATED_BODY = ['Inter', 'Poppins', 'Montserrat', 'Lato', 'Work Sans', 'Nunito Sans', 'DM Sans', 'Open Sans', 'Raleway', 'Mulish', 'Source Sans 3', 'Roboto'];
  var CURATED_DISPLAY = ['Playfair Display', 'Merriweather', 'Lora', 'Fraunces', 'Cormorant', 'Oswald', 'Bebas Neue', 'Archivo', 'DM Serif Display', 'Libre Baskerville'];
  var bodyPicker = null, displayPicker = null;

  // ============= COLOR HELPERS =============
  function hexToRgb(hex) {
    var m = /^#?([a-f0-9]{2})([a-f0-9]{2})([a-f0-9]{2})$/i.exec(hex);
    if (!m) return null;
    return [parseInt(m[1],16), parseInt(m[2],16), parseInt(m[3],16)];
  }
  function rgbToHex(r, g, b) {
    function p(v) { v = Math.max(0, Math.min(255, Math.round(v))); var s = v.toString(16); return s.length === 1 ? '0' + s : s; }
    return '#' + p(r) + p(g) + p(b);
  }
  function darken(hex, amt) {
    var rgb = hexToRgb(hex); if (!rgb) return hex;
    return rgbToHex(rgb[0]*(1-amt), rgb[1]*(1-amt), rgb[2]*(1-amt));
  }
  function relativeLuminance(hex) {
    var rgb = hexToRgb(hex); if (!rgb) return 0;
    function chan(v) { v = v/255; return v <= 0.03928 ? v/12.92 : Math.pow((v+0.055)/1.055, 2.4); }
    return 0.2126*chan(rgb[0]) + 0.7152*chan(rgb[1]) + 0.0722*chan(rgb[2]);
  }
  function contrastRatio(hex1, hex2) {
    var L1 = relativeLuminance(hex1), L2 = relativeLuminance(hex2);
    var lighter = Math.max(L1,L2), darker = Math.min(L1,L2);
    return (lighter + 0.05) / (darker + 0.05);
  }
  function saturation(hex) {
    var rgb = hexToRgb(hex); if (!rgb) return 0;
    var r=rgb[0]/255, g=rgb[1]/255, b=rgb[2]/255;
    var max = Math.max(r,g,b), min = Math.min(r,g,b);
    if (max === min) return 0;
    var l = (max+min)/2;
    var d = max - min;
    return l > 0.5 ? d / (2 - max - min) : d / (max + min);
  }
  function applyBrandColor(hex) {
    if (!/^#?[a-f0-9]{6}$/i.test(hex)) return false;
    if (hex.charAt(0) !== '#') hex = '#' + hex;
    hex = hex.toLowerCase();
    var deep = darken(hex, 0.25);
    var rgb = hexToRgb(hex) || [164,30,35];
    var L = relativeLuminance(hex);
    var fg, fgSoft, divider, humanBg;
    if (L > 0.55) {
      fg = '#1a1a1a'; fgSoft = 'rgba(26,26,26,0.65)';
      divider = 'rgba(0,0,0,0.14)'; humanBg = 'rgba(0,0,0,0.18)';
    } else {
      fg = '#ffffff'; fgSoft = 'rgba(255,255,255,0.78)';
      divider = 'rgba(255,255,255,0.18)'; humanBg = 'rgba(255,255,255,0.18)';
    }
    var root = document.documentElement.style;
    root.setProperty('--brand', hex);
    root.setProperty('--brand-deep', deep);
    root.setProperty('--brand-rgb', rgb.join(','));
    root.setProperty('--enhanced-bg', hex);
    root.setProperty('--enhanced-fg', fg);
    root.setProperty('--enhanced-fg-soft', fgSoft);
    root.setProperty('--enhanced-divider', divider);
    root.setProperty('--enhanced-human-bg', humanBg);
    return true;
  }
  function evaluateColorWarning(hex) {
    var L = relativeLuminance(hex);
    var ratio = contrastRatio(hex, '#ffffff');
    var sat = saturation(hex);
    if (L > 0.95) return { msg: 'This color will be invisible on the white chat surface. Consider a darker brand color.' };
    if (L < 0.05) return { msg: 'The launcher will look like a black void. Consider a slightly lighter brand color.' };
    if (ratio < 3.0) {
      var fg = L > 0.55 ? 'black' : 'white';
      return { msg: 'Low contrast against the white chat surface — accents may look soft. Foreground text will be ' + fg + '.' };
    }
    if (sat < 0.08 && L > 0.3 && L < 0.85) return { msg: 'This is a low-saturation neutral, not a typical brand color. That can work, but most resorts choose something more saturated.' };
    return null;
  }

  // ============= GLYPH (USER-VISIBLE CHARACTER) HELPERS =============
  // Multi-codepoint emojis (🎿, 🏂, family/skin-tone sequences) are 2+ UTF-16
  // code units, so .length over-counts them. These helpers count actual
  // user-visible glyphs (graphemes) using Intl.Segmenter when available, with
  // a spread-array fallback for code-point counting on older browsers.
  // Trade-off: spread-array still over-counts ZWJ sequences (e.g. 👨‍👩‍👧
  // = 5 code points but 1 glyph), but it handles the common single-emoji case
  // correctly, which is what partners will mostly use.
  var graphemeSegmenter = null;
  try {
    if (typeof Intl !== 'undefined' && Intl.Segmenter) {
      graphemeSegmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
    }
  } catch (_) {}

  function glyphCount(str) {
    if (!str) return 0;
    if (graphemeSegmenter) {
      var n = 0;
      var iter = graphemeSegmenter.segment(str);
      // eslint-disable-next-line no-unused-vars
      for (var _seg of iter) n++;
      return n;
    }
    // Fallback: count Unicode code points (handles single emojis correctly,
    // imperfect for ZWJ sequences but good enough for partner CTA text)
    return Array.from(str).length;
  }

  function truncateGlyphs(str, maxGlyphs) {
    if (!str) return '';
    if (glyphCount(str) <= maxGlyphs) return str;
    if (graphemeSegmenter) {
      var out = '';
      var n = 0;
      var iter = graphemeSegmenter.segment(str);
      for (var seg of iter) {
        if (n >= maxGlyphs) break;
        out += seg.segment;
        n++;
      }
      return out;
    }
    // Fallback: spread array slice (handles single emojis correctly)
    return Array.from(str).slice(0, maxGlyphs).join('');
  }

  // ============= STATE =============
  // Jackson Hole resort logo (mountain mark + JH wordmark + ®, 263x92), inlined for demo
  var SAMPLE_LOGO = 'data:image/jpeg;base64,' + '/9j/4QAYRXhpZgAASUkqAAgAAAAAAAAAAAAAAP/sABFEdWNreQABAAQAAAAeAAD/4QMwaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wLwA8P3hwYWNrZXQgYmVnaW49Iu+7vyIgaWQ9Ilc1TTBNcENlaGlIenJlU3pOVGN6a2M5ZCI/PiA8eDp4bXBtZXRhIHhtbG5zOng9ImFkb2JlOm5zOm1ldGEvIiB4OnhtcHRrPSJBZG9iZSBYTVAgQ29yZSAxMC4wLWMwMDAgNzkuZDIwZTQ2NjMwLCAyMDI1LzEyLzA5LTAyOjExOjIzICAgICAgICAiPiA8cmRmOlJERiB4bWxuczpyZGY9Imh0dHA6Ly93d3cudzMub3JnLzE5OTkvMDIvMjItcmRmLXN5bnRheC1ucyMiPiA8cmRmOkRlc2NyaXB0aW9uIHJkZjphYm91dD0iIiB4bWxuczp4bXA9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC8iIHhtbG5zOnhtcE1NPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvbW0vIiB4bWxuczpzdFJlZj0iaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wL3NUeXBlL1Jlc291cmNlUmVmIyIgeG1wOkNyZWF0b3JUb29sPSJBZG9iZSBQaG90b3Nob3AgMjcuNSAoV2luZG93cykiIHhtcE1NOkluc3RhbmNlSUQ9InhtcC5paWQ6OUU4OUExNEI0MTg2MTFGMUIwMjQ5NzBCREZGMTdDMjIiIHhtcE1NOkRvY3VtZW50SUQ9InhtcC5kaWQ6OUU4OUExNEM0MTg2MTFGMUIwMjQ5NzBCREZGMTdDMjIiPiA8eG1wTU06RGVyaXZlZEZyb20gc3RSZWY6aW5zdGFuY2VJRD0ieG1wLmlpZDo5RTg5QTE0OTQxODYxMUYxQjAyNDk3MEJERkYxN0MyMiIgc3RSZWY6ZG9jdW1lbnRJRD0ieG1wLmRpZDo5RTg5QTE0QTQxODYxMUYxQjAyNDk3MEJERkYxN0MyMiIvPiA8L3JkZjpEZXNjcmlwdGlvbj4gPC9yZGY6UkRGPiA8L3g6eG1wbWV0YT4gPD94cGFja2V0IGVuZD0iciI/Pv/uAA5BZG9iZQBkwAAAAAH/2wCEABALCwsMCxAMDBAXDw0P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';

  var DEFAULTS = {
    logoUrl: SAMPLE_LOGO,
    logoMaxHeight: 44,
    cornerRadius: 7,
    effectMode: 'radiate',    // 'none' | 'shadow' | 'glow' | 'radiate'
    effectIntensity: 65,      // 0-100, percentage of max effect strength
    color: '#a41e23',
    chatHeaderColor: '#ffffff',
    widgetName: 'Jackson Hole Support',
    inputPlaceholder: 'Ask me anything. Here to help!',
    welcomeText: "Welcome to Jackson Hole, ask us anything, we're here to help.",
    // "Recent update" pushed into the chat's Season Update banner.
    // updateLabel is the eyebrow; recentUpdate is the manual body (blank hides it).
    updateLabel: 'Season update',
    recentUpdate: "The 2025/26 ski season has wrapped. The Aerial Tram reopens for summer sightseeing on May 16th, with the gondolas joining June 6th.",
    // Source toggle: 'manual' = typed copy above; 'flow' = pull from a BotScrew
    // Flow / AI Action (placeholder — recentUpdateFlow holds the selected flow id).
    recentUpdateSource: 'manual',
    recentUpdateFlow: '',
    // Hero slot at the top of the open chat (Webcams & featured image card).
    // source: 'webcam' (live cam / feed) | 'featured' (Appearance-owned image) | 'none'.
    hero: {
      source: 'webcam',
      webcam: { url: 'https://cams.jacksonhole.com/webcam/codybowl.jpg', label: 'Cody Bowl' },
      featuredImage: { url: '', caption: '', link: '' }
    },
    ctaText: 'Need help?',
    bubbleStyle: 'slidein',
    customIconUrl: null,
    customIconSize: 56,         // px diameter of the custom launcher (the image fills it)
    slideState: 'visible',
    // Auto-hide-on-scroll is available on both pill styles AND the custom launcher.
    // Per-style so each remembers its own setting; default ON so the launcher stays
    // clear of checkout/CTA elements out of the box.
    autoHideOnScroll: { enhanced: true, slidein: true, custom: true },
    // Launcher placement: which corner it anchors to + spacing from the screen
    // edges (px). Maps to BotScrew's greetingMessagePopupSettings.{alignment,
    // bottomSpacing, sideSpacing}; the greeting popup + open panel inherit it.
    placement: { align: 'right', bottomSpacing: 32, sideSpacing: 32 },
    statusPillFeatures: { liveAgent: true, weather: true, needHelpCta: true },
    layoutVariant: 'side',
    blurredBackground: true,
    soundNotifications: true,
    popupMessagePreview: false,
    askForRating: false,
    realtimeVoice: true,        // show the hands-free Voice Mode feature in the chat
    disableTextInput: false,
    // Typography
    typography: {
      bodyFont: 'Inter',
      displayFont: 'Playfair Display',
      textScale: 1.0
    },
    // Embeddable Search controls
    embedSearch: {
      borderRadius: 999,        // px (999 = pill)
      borderThickness: 1.5,     // px
      width: 'fixed',           // 'hug' | 'fixed' | 'full'
      placeholder: 'Ask anything about your visit…'
    },
    embedButton: {
      size: 44,                 // px
      shape: 'round',           // 'round' | 'square' | 'pill'
      background: 'brand',      // 'brand' | 'transparent' | 'white'
      iconWeight: 'regular',    // 'thin' | 'regular' | 'bold'
      label: ''
    }
  };

  // Device mode is preview-only (not part of saved config)
  var previewDevice = 'desktop';
  // Preview mode toggles the canvas between Chat surface and Embeddable Search
  var previewMode = 'chat';

  // Durable saved-config key. We persist in BotScrew widgetSettings shape — the
  // same payload the eventual bot drop-in consumes — so Save/Load is lossless and
  // production-ready (see src/shared/widget-config.js).
  var SAVED_CONFIG_KEY = 'gsb_widget_settings';

  // Restore the last saved config so settings survive a page reload. Hydrate via
  // the inverse mapper and merge over DEFAULTS: top-level scalars overwrite, and
  // nested objects (snowfall, typography, embedSearch…) merge sub-keys so any
  // field added since the config was saved keeps its default instead of vanishing.
  function loadSavedState() {
    var base = JSON.parse(JSON.stringify(DEFAULTS));
    try {
      var raw = localStorage.getItem(SAVED_CONFIG_KEY);
      if (!raw) return base;
      var restored = fromBotscrewWidgetSettings(JSON.parse(raw));
      for (var k in restored) {
        if (!Object.prototype.hasOwnProperty.call(restored, k)) continue;
        var val = restored[k];
        if (val && typeof val === 'object' && !Array.isArray(val) &&
            base[k] && typeof base[k] === 'object') {
          for (var sk in val) {
            if (Object.prototype.hasOwnProperty.call(val, sk)) base[k][sk] = val[sk];
          }
        } else {
          base[k] = val;
        }
      }
    } catch (err) {
      console.warn('[appearance] could not restore saved config:', err);
    }
    return base;
  }

  var state = loadSavedState();
  var saved = JSON.parse(JSON.stringify(state));

  var $ = function(id) { return document.getElementById(id); };
  var canvas = $('previewCanvas');
  var launcher = $('previewLauncher');

  function setToggle(id, checked) {
    var t = $(id); if (!t) return;
    t.setAttribute('aria-checked', String(!!checked));
  }

  function render() {
    applyBrandColor(state.color);
    if (document.activeElement !== $('brandColorHex')) $('brandColorHex').value = state.color;
    if (document.activeElement !== $('brandColorPicker')) $('brandColorPicker').value = state.color;

    var w = evaluateColorWarning(state.color);
    if (w) { $('colorWarn').textContent = w.msg; $('colorWarn').setAttribute('data-show','true'); }
    else { $('colorWarn').removeAttribute('data-show'); }

    // ============= DEPTH EFFECT =============
    // Computes a box-shadow value based on effectMode + effectIntensity.
    // 'none' → empty shadow. 'shadow' → neutral dark drop shadow. 'glow' →
    // brand-colored halo using --brand-rgb. Intensity scales the spread,
    // blur, and opacity. Pushed to :root so all consuming surfaces (chat
    // panel, embed search, embed button) update in lockstep.
    var depthEffect;
    var intensity01 = (state.effectIntensity || 0) / 100; // 0..1
    if (state.effectMode === 'shadow') {
      // Shadow mode ADDS on top of the chat panel's always-on baseline. The
      // baseline is already a confident drop shadow — Shadow mode layers
      // additional depth (deeper, more spread) so the partner can dial up
      // from "default lift" to "dramatic lift". We keep this layer modest
      // so it stacks cleanly with the baseline rather than overwhelming it.
      var blur1 = Math.round(30 + intensity01 * 50);   // 30..80
      var blur2 = Math.round(6 + intensity01 * 14);    // 6..20
      var op1 = (0.06 + intensity01 * 0.20).toFixed(3); // 0.06..0.26
      var op2 = (0.03 + intensity01 * 0.07).toFixed(3); // 0.03..0.10
      var lift = Math.round(8 + intensity01 * 24);    // 8..32
      depthEffect = '0 ' + lift + 'px ' + blur1 + 'px rgba(23,19,15,' + op1 + '), '
                  + '0 4px ' + blur2 + 'px rgba(23,19,15,' + op2 + ')';
    } else if (state.effectMode === 'glow') {
      // Brand-colored glow halo — STATIC, applies to chat panel + embed
      // surfaces + launcher. Two layers (close + soft outer).
      var spread = Math.round(intensity01 * 24);         // 0..24
      var glowBlur = Math.round(20 + intensity01 * 40);  // 20..60
      var glowOp = (0.20 + intensity01 * 0.45).toFixed(3); // 0.20..0.65
      var softBlur = Math.round(40 + intensity01 * 60);  // 40..100
      var softOp = (0.10 + intensity01 * 0.20).toFixed(3); // 0.10..0.30
      depthEffect = '0 0 0 ' + spread + 'px rgba(var(--brand-rgb), ' + glowOp + '), '
                  + '0 0 ' + glowBlur + 'px rgba(var(--brand-rgb), ' + glowOp + '), '
                  + '0 8px ' + softBlur + 'px rgba(var(--brand-rgb), ' + softOp + ')';
    } else if (state.effectMode === 'radiate') {
      // Radiate is LAUNCHER-ONLY. The launcher's pulse animation provides the
      // entire visual — a rippling brand-color halo emanating from the
      // launcher pill. Chat panel keeps its baseline shadow, no extra layer.
      // The pulse strength is modulated by --gsb-radiate-strength below.
      depthEffect = '0 0 0 transparent';
    } else {
      // 'none' — no additive effect. Chat panel still gets its baseline shadow
      // from the .gsb-chat rule directly. Embed surfaces fall back via their
      // var(...) fallback to actual `none`.
      depthEffect = '0 0 0 transparent';
    }
    document.documentElement.style.setProperty('--gsb-depth-effect', depthEffect);

    // Push effect mode onto the launcher so CSS can react. The launcher's
    // pulse animation owns box-shadow when running, so we need to either
    // disable the pulse (for 'none' / 'shadow' modes) or keep it (for 'glow')
    // — see the .gsb-launcher[data-effect-mode="..."] rules below.
    if (launcher) {
      launcher.setAttribute('data-effect-mode', state.effectMode);
      // Effect intensity feeds the keyframes. For 'radiate' mode the value
      // modulates the pulse animation's halo strength (spread + opacity).
      // We map the slider's 0..100 to a usable range — too low looks broken,
      // so we anchor a minimum visible strength of 0.4 even at 0%, ramping
      // to 1.6 at 100% for a strong presence.
      var radiateStrength = 0.4 + intensity01 * 1.2; // 0.4..1.6
      launcher.style.setProperty('--gsb-radiate-strength', String(radiateStrength));
      launcher.style.setProperty('--gsb-glow-strength', String(intensity01));
    }

    // Sync segmented picker active states + intensity slider
    document.querySelectorAll('#effectModeSegmented [data-effect-mode]').forEach(function(b) {
      var active = b.dataset.effectMode === state.effectMode;
      b.setAttribute('data-active', String(active));
      b.setAttribute('aria-checked', String(active));
    });
    var intensityRow = $('effectIntensityRow');
    if (intensityRow) intensityRow.setAttribute('data-disabled', String(state.effectMode === 'none'));
    var intensitySlider = $('effectIntensity');
    if (intensitySlider && document.activeElement !== intensitySlider) intensitySlider.value = String(state.effectIntensity);
    if ($('effectIntensityReadout')) $('effectIntensityReadout').textContent = state.effectIntensity;

    // Logo
    if (state.logoUrl) {
      $('logoPreview').src = state.logoUrl;
      $('logoPreview').style.display = '';
      $('logoEmpty').style.display = 'none';
      $('headerLogo').src = state.logoUrl;
      $('headerLogo').style.display = '';
      $('brandColLogo').src = state.logoUrl;
      $('brandColLogo').style.display = '';
      $('headerPlaceholder').style.display = 'none';
    } else {
      $('logoPreview').removeAttribute('src');
      $('logoPreview').style.display = 'none';
      $('logoEmpty').style.display = 'block';
      $('headerLogo').removeAttribute('src');
      $('headerLogo').style.display = 'none';
      $('brandColLogo').removeAttribute('src');
      $('brandColLogo').style.display = 'none';
      $('headerPlaceholder').style.display = 'flex';
    }

    document.documentElement.style.setProperty('--logo-max-height', state.logoMaxHeight + 'px');
    if (document.activeElement !== $('logoMaxHeight')) $('logoMaxHeight').value = state.logoMaxHeight;
    document.querySelectorAll('.max-height-presets button').forEach(function(b) {
      b.setAttribute('data-active', String(parseInt(b.dataset.preset,10) === state.logoMaxHeight));
    });

    // Master corner radius — drives launcher pills, slide-in pill, chat surface
    document.documentElement.style.setProperty('--gsb-radius', state.cornerRadius + 'px');
    document.documentElement.style.setProperty('--gsb-radius-sm', Math.round(state.cornerRadius * 0.55) + 'px');
    if (document.activeElement !== $('cornerRadius')) $('cornerRadius').value = state.cornerRadius;
    var crReadout = $('cornerRadiusReadout');
    if (crReadout) crReadout.textContent = state.cornerRadius;
    document.querySelectorAll('.radius-presets button').forEach(function(b) {
      b.setAttribute('data-active', String(parseInt(b.dataset.radiusPreset, 10) === state.cornerRadius));
    });

    // Chat header background — drives the chat surface header bar across all variants
    document.documentElement.style.setProperty('--gsb-chat-header-bg', state.chatHeaderColor);
    if (document.activeElement !== $('chatHeaderColorHex')) $('chatHeaderColorHex').value = state.chatHeaderColor;
    if (document.activeElement !== $('chatHeaderColorPicker')) $('chatHeaderColorPicker').value = state.chatHeaderColor;

    $('headerPlaceholderName').textContent = state.widgetName || 'Demo Resort';
    $('welcomeLine').textContent = state.welcomeText || "Welcome, ask us anything, we're here to help.";
    $('brandColTitle').textContent = state.widgetName || 'Demo Resort';

    // Recent update → Season Update banner. Source = 'manual' (typed copy) or
    // 'flow' (placeholder: shows a stub line for the selected flow). Either way
    // we flag data-manual-update so the live weather feed leaves the banner alone.
    var FLOW_LABELS = { 'snow-report': 'Daily snow report', 'lift-status': 'Lift & terrain status', 'events': 'Events & happenings' };
    var updateSource = state.recentUpdateSource === 'flow' ? 'flow' : 'manual';
    // Reflect the source toggle: segmented active state + which group is visible.
    var srcBtns = document.querySelectorAll('#updateSourceSegmented [data-update-source]');
    for (var si = 0; si < srcBtns.length; si++) {
      var srcOn = srcBtns[si].getAttribute('data-update-source') === updateSource;
      srcBtns[si].setAttribute('data-active', srcOn ? 'true' : 'false');
      srcBtns[si].setAttribute('aria-checked', srcOn ? 'true' : 'false');
    }
    if ($('updateManualGroup')) $('updateManualGroup').style.display = updateSource === 'flow' ? 'none' : '';
    if ($('updateFlowGroup')) $('updateFlowGroup').style.display = updateSource === 'flow' ? '' : 'none';
    if ($('updateFlow') && document.activeElement !== $('updateFlow')) $('updateFlow').value = state.recentUpdateFlow || '';

    var seasonBanner = $('gsbSeasonBanner');
    if (seasonBanner) {
      var bannerShow, bannerBody;
      if (updateSource === 'flow') {
        var flowName = FLOW_LABELS[state.recentUpdateFlow];
        bannerShow = !!flowName;
        bannerBody = flowName ? ('Live updates from “' + flowName + '” will appear here.') : '';
      } else {
        bannerShow = !!(state.recentUpdate && state.recentUpdate.trim());
        bannerBody = state.recentUpdate || '';
      }
      seasonBanner.style.display = bannerShow ? 'block' : 'none';
      seasonBanner.setAttribute('data-manual-update', bannerShow ? 'true' : 'false');
      var seasonTitle = seasonBanner.querySelector('.gsb-season-banner__title');
      if (seasonTitle) seasonTitle.textContent = state.updateLabel || 'Season update';
      if ($('gsbSeasonText')) $('gsbSeasonText').textContent = bannerBody;
    }

    // ============= HERO (Webcams & featured image) =============
    var hero = state.hero;
    var heroEl = $('gsbHero');
    if (heroEl) {
      heroEl.setAttribute('data-hero-source', hero.source);
      var heroStation = $('gsbHeroStation');
      function setHeroImg(url) {
        var i = heroEl.querySelector('.gsb-webcam-img');
        if (!i) { i = document.createElement('img'); i.className = 'gsb-webcam-img'; i.alt = ''; heroEl.insertBefore(i, heroEl.firstChild); }
        i.src = url;
        var fb = heroEl.querySelector('.gsb-webcam-fallback'); if (fb) fb.style.display = 'none';
      }
      if (hero.source === 'featured') {
        if (hero.featuredImage.url) setHeroImg(hero.featuredImage.url);
        if (heroStation) heroStation.textContent = hero.featuredImage.caption || '';
        heroEl.setAttribute('data-hero-managed', 'true');
      } else if (hero.source === 'webcam') {
        if (hero.webcam.url) { setHeroImg(hero.webcam.url); heroEl.setAttribute('data-hero-managed', 'true'); }
        else heroEl.removeAttribute('data-hero-managed');
        if (heroStation) heroStation.textContent = hero.webcam.label || 'Webcam';
      } else {
        // 'none' — hidden via CSS; flag managed so the live feed doesn't repopulate.
        heroEl.setAttribute('data-hero-managed', 'true');
      }
    }
    // Reflect the source toggle + show the matching control group.
    var heroBtns = document.querySelectorAll('#heroSourceSegmented [data-hero-source]');
    for (var hi = 0; hi < heroBtns.length; hi++) {
      var hon = heroBtns[hi].getAttribute('data-hero-source') === hero.source;
      heroBtns[hi].setAttribute('data-active', String(hon));
      heroBtns[hi].setAttribute('aria-checked', String(hon));
    }
    if ($('heroWebcamGroup')) $('heroWebcamGroup').style.display = hero.source === 'webcam' ? '' : 'none';
    if ($('heroFeaturedGroup')) $('heroFeaturedGroup').style.display = hero.source === 'featured' ? '' : 'none';
    if ($('webcamUrl') && document.activeElement !== $('webcamUrl')) $('webcamUrl').value = hero.webcam.url;
    if ($('webcamLabel') && document.activeElement !== $('webcamLabel')) $('webcamLabel').value = hero.webcam.label;
    if ($('featuredImageUrl') && document.activeElement !== $('featuredImageUrl')) $('featuredImageUrl').value = hero.featuredImage.url.indexOf('data:') === 0 ? '' : hero.featuredImage.url;
    if ($('featuredCaption') && document.activeElement !== $('featuredCaption')) $('featuredCaption').value = hero.featuredImage.caption;
    if ($('featuredLink') && document.activeElement !== $('featuredLink')) $('featuredLink').value = hero.featuredImage.link;
    // Target the visible chat composer (#gsbComposerInput); fall back to the old
    // hidden #composerInput alias only if the real input isn't present.
    var composerEl = $('gsbComposerInput') || $('composerInput');
    if (composerEl) composerEl.placeholder = state.inputPlaceholder || 'Ask…';

    canvas.setAttribute('data-variant', state.layoutVariant);
    canvas.setAttribute('data-device', previewDevice);
    launcher.setAttribute('data-icon-style', state.bubbleStyle);

    // Launcher placement — corner + edge spacing (popup + open panel inherit it)
    var place = state.placement || {};
    var pAlign = place.align === 'left' ? 'left' : 'right';
    var pBottom = place.bottomSpacing != null ? place.bottomSpacing : 32;
    var pSide = place.sideSpacing != null ? place.sideSpacing : 32;
    launcher.setAttribute('data-align', pAlign);
    document.documentElement.style.setProperty('--gsb-launcher-bottom', pBottom + 'px');
    document.documentElement.style.setProperty('--gsb-launcher-side', pSide + 'px');
    document.querySelectorAll('#placementAlignSegmented button').forEach(function(b) {
      var active = b.dataset.value === pAlign;
      b.setAttribute('data-active', String(active));
      b.setAttribute('aria-checked', String(active));
    });
    if (document.activeElement !== $('placementBottom')) $('placementBottom').value = pBottom;
    if (document.activeElement !== $('placementSide')) $('placementSide').value = pSide;

    var isPillStyle = (state.bubbleStyle === 'enhanced' || state.bubbleStyle === 'slidein');
    launcher.setAttribute('data-show-weather', state.statusPillFeatures.weather && isPillStyle ? 'true' : 'false');
    launcher.setAttribute('data-show-cta', state.statusPillFeatures.needHelpCta && isPillStyle ? 'true' : 'false');
    canvas.setAttribute('data-liveagent', state.statusPillFeatures.liveAgent ? 'on' : 'off');
    document.body.setAttribute('data-liveagent', state.statusPillFeatures.liveAgent ? 'on' : 'off');
    // Realtime voice on/off → hides the hands-free Voice Mode button + overlay in the chat.
    canvas.setAttribute('data-voice', state.realtimeVoice ? 'on' : 'off');
    document.body.setAttribute('data-voice', state.realtimeVoice ? 'on' : 'off');
    canvas.setAttribute('data-modal-blur', state.blurredBackground ? 'true' : 'false');

    // Swap chat header agent label: "AI Concierge" by default, "Agent Online" when liveAgent toggle is active
    var agentLabelText = state.statusPillFeatures.liveAgent ? 'Online' : 'AI Concierge';
    var agentLabelEl = $('gsbAgentStatusLabel');
    if (agentLabelEl) agentLabelEl.textContent = agentLabelText;
    // (Left-column agent-status footer removed; only the chat-header label remains.)

    $('pillFeaturesGroup').setAttribute('data-disabled', isPillStyle ? 'false' : 'true');

    // Custom icon block visibility
    var customBlock = $('customIconBlock');
    if (customBlock) {
      customBlock.style.display = state.bubbleStyle === 'custom' ? 'block' : 'none';
    }
    // Custom launcher size — the uploaded image fills the launcher, so this scales
    // the whole thing (diameter in px).
    var customSize = state.customIconSize != null ? state.customIconSize : 56;
    document.documentElement.style.setProperty('--gsb-custom-launcher-size', customSize + 'px');
    if ($('customIconSize') && document.activeElement !== $('customIconSize')) $('customIconSize').value = customSize;
    // Gate the custom launcher's soft center-radiate on an uploaded icon (so an
    // empty custom launcher never pulses around nothing).
    launcher.setAttribute('data-custom-icon', state.customIconUrl ? 'true' : 'false');

    // Auto-hide-on-scroll behavior block — shown for both pill styles; the note +
    // Simulate button (#autoHideDetail) only when the behavior is switched on.
    var autoHide = state.autoHideOnScroll || {};
    var canAutoHide = supportsAutoHide(state.bubbleStyle);
    var autoHideOn = canAutoHide && !!autoHide[state.bubbleStyle];
    var slideinBlock = $('slideinNoteBlock');
    if (slideinBlock) {
      slideinBlock.style.display = canAutoHide ? 'block' : 'none';
    }
    setToggle('toggleAutoHide', autoHideOn);
    var autoHideDetail = $('autoHideDetail');
    if (autoHideDetail) autoHideDetail.style.display = autoHideOn ? 'block' : 'none';

    // Custom icon rendering inside the launcher
    var customIconImg = $('customIconImg');
    if (customIconImg) {
      if (state.customIconUrl) {
        customIconImg.src = state.customIconUrl;
        customIconImg.style.display = '';
      } else {
        customIconImg.removeAttribute('src');
        customIconImg.style.display = 'none';
      }
    }
    var customIconPreview = $('customIconPreview');
    if (customIconPreview) {
      if (state.customIconUrl) {
        customIconPreview.src = state.customIconUrl;
        customIconPreview.style.display = '';
        var emp = $('customIconEmpty');
        if (emp) emp.style.display = 'none';
      } else {
        customIconPreview.removeAttribute('src');
        customIconPreview.style.display = 'none';
        var emp2 = $('customIconEmpty');
        if (emp2) emp2.style.display = 'block';
      }
    }

    // Slide state — applies when auto-hide-on-scroll is on for the current pill
    // style (Status pill or Slide-in pill). Otherwise the launcher stays put.
    if (autoHideOn) {
      launcher.setAttribute('data-slide-state', state.slideState || 'visible');
    } else {
      launcher.removeAttribute('data-slide-state');
    }

    document.querySelectorAll('#bubbleStyleCards .radio-card').forEach(function(c) {
      c.setAttribute('data-checked', String(c.dataset.value === state.bubbleStyle));
    });
    document.querySelectorAll('#layoutCards .radio-card').forEach(function(c) {
      c.setAttribute('data-checked', String(c.dataset.value === state.layoutVariant));
    });

    setToggle('toggleLiveAgent', state.statusPillFeatures.liveAgent);
    setToggle('toggleWeather', state.statusPillFeatures.weather);
    setToggle('toggleCta', state.statusPillFeatures.needHelpCta);
    setToggle('toggleBlur', state.blurredBackground);
    setToggle('toggleSound', state.soundNotifications);
    setToggle('togglePopup', state.popupMessagePreview);
    setToggle('toggleRating', state.askForRating);
    setToggle('toggleVoice', state.realtimeVoice);
    setToggle('toggleDisableInput', state.disableTextInput);

    if (document.activeElement !== $('widgetName')) $('widgetName').value = state.widgetName;
    if (document.activeElement !== $('inputPlaceholder')) $('inputPlaceholder').value = state.inputPlaceholder;
    if (document.activeElement !== $('welcomeText')) $('welcomeText').value = state.welcomeText;
    if (document.activeElement !== $('updateLabel')) $('updateLabel').value = state.updateLabel;
    if (document.activeElement !== $('recentUpdate')) $('recentUpdate').value = state.recentUpdate;

    // CTA text on the launcher pill + character counter state.
    // Use glyph counting (Intl.Segmenter or spread-array fallback) so that
    // multi-codepoint emojis like 🎿 or 🏂 count as a single glyph instead of
    // 2 UTF-16 code units. Partners shouldn't be penalized for using emoji.
    var ctaTextStr = state.ctaText || 'Need help?';
    var ctaSpan = launcher.querySelector('.gsb-cta-text');
    if (ctaSpan) ctaSpan.textContent = ctaTextStr;
    var ctaInput = $('ctaText');
    if (ctaInput && document.activeElement !== ctaInput) ctaInput.value = ctaTextStr;
    var ctaCounter = $('ctaCounter');
    if (ctaCounter) {
      var len = glyphCount(ctaTextStr);
      ctaCounter.textContent = len + '/24';
      var counterState = 'ok';
      if (len >= 22) counterState = 'danger';
      else if (len >= 18) counterState = 'warn';
      ctaCounter.setAttribute('data-state', counterState);
    }
    // Disable CTA text row when "Need help? CTA" toggle is off — editing the text
    // is meaningless when the CTA itself isn't shown on the pill.
    var ctaRow = $('ctaTextRow');
    var ctaActive = !!state.statusPillFeatures.needHelpCta;
    if (ctaRow) ctaRow.setAttribute('data-disabled', String(!ctaActive));
    if (ctaInput) ctaInput.disabled = !ctaActive;

    // ============= TYPOGRAPHY =============
    var typo = state.typography;
    // Body/display are free-form Google family names. Look up category + available
    // weights from the catalog; fall back gracefully for unknown/legacy values.
    var bodyEntry = FONT_BY_NAME[typo.bodyFont];
    var displayEntry = FONT_BY_NAME[typo.displayFont];
    var bodyStack = fontStack(typo.bodyFont, bodyEntry && bodyEntry.c)
      || "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    var displayStack = fontStack(typo.displayFont, (displayEntry && displayEntry.c) || 'se')
      || "Georgia, serif";
    // Pull the actual faces from Google on demand — only the two fonts in use.
    loadFont(typo.bodyFont, bodyEntry && bodyEntry.w);
    loadFont(typo.displayFont, displayEntry && displayEntry.w);
    // Set on :root so they cascade to BOTH the launcher (outside canvas) AND
    // the chat surface (inside canvas). Setting on canvas leaves the launcher
    // out of the cascade since it's a sibling, not a descendant.
    document.documentElement.style.setProperty('--gsb-body-font', bodyStack);
    document.documentElement.style.setProperty('--gsb-display-font', displayStack);
    document.documentElement.style.setProperty('--gsb-text-scale', String(typo.textScale));

    // Reflect the current selection in the pickers (trigger label + face).
    if (bodyPicker) bodyPicker.sync();
    if (displayPicker) displayPicker.sync();
    // Sync preset highlights + the "Now using" anchor. The active pairing is the
    // matching preset's name, or "Custom" when fine-tuned off every preset.
    var activePreset = null;
    document.querySelectorAll('#fontPresets .font-preset').forEach(function(p) {
      var matches = p.dataset.body === typo.bodyFont && p.dataset.display === typo.displayFont;
      p.setAttribute('data-active', String(matches));
      if (matches) activePreset = p.querySelector('.font-preset__name').textContent;
    });
    if ($('typoNowBadge')) {
      $('typoNowBadge').textContent = activePreset || 'Custom';
      $('typoNowBadge').setAttribute('data-custom', activePreset ? 'false' : 'true');
    }
    if ($('typoNowFonts')) $('typoNowFonts').textContent = typo.bodyFont + ' · ' + typo.displayFont;

    // Sync text size slider + label + presets
    if (document.activeElement !== $('textSizeSlider')) {
      $('textSizeSlider').value = typo.textScale;
    }
    var sizeLabel;
    if (typo.textScale <= 0.92) sizeLabel = 'Compact';
    else if (typo.textScale >= 1.08) sizeLabel = 'Large';
    else if (Math.abs(typo.textScale - 1.0) < 0.02) sizeLabel = 'Standard';
    else sizeLabel = typo.textScale.toFixed(2) + '×';
    $('textSizeValue').textContent = sizeLabel;
    document.querySelectorAll('#textSizePresets button').forEach(function(b) {
      b.setAttribute('data-active', String(Math.abs(parseFloat(b.dataset.preset) - typo.textScale) < 0.005));
    });

    // Canvas mode stays fixed to 'chat' — the embeddable/chat toggle was removed
    canvas.setAttribute('data-preview-mode', 'chat');

    // ============= EMBEDDABLE SEARCH =============
    var es = state.embedSearch;
    // Apply identical styling to all search bar instances:
    // - embedSearchBar (offscreen, in the unused embed canvas mock)
    // - embedSearchPreview (new inline live preview in the form)
    var searchNodes = [$('embedSearchBar'), $('embedSearchPreview')];
    var searchInputs = [$('embedSearchInput'), $('embedSearchPreviewInput')];
    searchNodes.forEach(function(search) {
      if (!search) return;
      search.style.setProperty('--gsb-search-radius', (es.borderRadius >= 100 ? 999 : es.borderRadius) + 'px');
      search.style.setProperty('--gsb-search-border', es.borderThickness + 'px');
      // Width behavior
      if (es.width === 'hug') {
        search.style.setProperty('--gsb-search-width', 'auto');
        search.style.setProperty('--gsb-search-maxwidth', 'none');
      } else if (es.width === 'fixed') {
        search.style.setProperty('--gsb-search-width', '100%');
        search.style.setProperty('--gsb-search-maxwidth', '480px');
      } else { // full
        search.style.setProperty('--gsb-search-width', '100%');
        search.style.setProperty('--gsb-search-maxwidth', 'none');
      }
    });
    searchInputs.forEach(function(searchInput) {
      if (searchInput && document.activeElement !== searchInput) searchInput.placeholder = es.placeholder;
    });

    // Update slider control values + preset highlighting (don't fight active typing)
    if (document.activeElement !== $('searchRadiusSlider')) {
      $('searchRadiusSlider').value = es.borderRadius;
    }
    $('searchRadiusValue').textContent = es.borderRadius >= 100 ? 'Pill' : es.borderRadius + 'px';
    document.querySelectorAll('#searchRadiusPresets button').forEach(function(b) {
      var p = parseInt(b.dataset.preset, 10);
      var isPill = (p === 999 && es.borderRadius >= 100);
      b.setAttribute('data-active', String(isPill || p === es.borderRadius));
    });
    document.querySelectorAll('#searchBorderSegmented button').forEach(function(b) {
      b.setAttribute('data-active', String(parseFloat(b.dataset.value) === es.borderThickness));
    });
    document.querySelectorAll('#searchWidthSegmented button').forEach(function(b) {
      b.setAttribute('data-active', String(b.dataset.value === es.width));
    });
    if (document.activeElement !== $('searchPlaceholder')) $('searchPlaceholder').value = es.placeholder;

    // ============= EMBEDDABLE BUTTON =============
    var eb = state.embedButton;
    var btnNodes = [$('embedButton'), $('embedButtonNav'), $('embedButtonPreview')];
    var labelNodes = [$('embedButtonLabel'), $('embedButtonNavLabel'), $('embedButtonPreviewLabel')];
    btnNodes.forEach(function(btn, i) {
      if (!btn) return;
      btn.style.setProperty('--gsb-btn-size', eb.size + 'px');
      // Shape → border radius
      var radius;
      if (eb.shape === 'round') radius = '50%';
      else if (eb.shape === 'square') radius = '6px';
      else radius = '999px'; // pill
      btn.style.setProperty('--gsb-btn-radius', radius);
      btn.setAttribute('data-bg', eb.background);
      btn.setAttribute('data-icon-weight', eb.iconWeight);
      btn.setAttribute('data-has-label', eb.label ? 'true' : 'false');

      var lbl = labelNodes[i];
      if (lbl) {
        if (eb.label) {
          lbl.textContent = eb.label;
          lbl.style.display = '';
        } else {
          lbl.style.display = 'none';
          lbl.textContent = '';
        }
      }
    });

    // Update button control values + preset highlighting
    if (document.activeElement !== $('btnSizeSlider')) {
      $('btnSizeSlider').value = eb.size;
    }
    $('btnSizeValue').textContent = eb.size + 'px';
    document.querySelectorAll('#btnSizePresets button').forEach(function(b) {
      b.setAttribute('data-active', String(parseInt(b.dataset.preset, 10) === eb.size));
    });
    document.querySelectorAll('#btnShapeSegmented button').forEach(function(b) {
      b.setAttribute('data-active', String(b.dataset.value === eb.shape));
    });
    document.querySelectorAll('#btnBgSegmented button').forEach(function(b) {
      b.setAttribute('data-active', String(b.dataset.value === eb.background));
    });
    document.querySelectorAll('#btnIconWeightSegmented button').forEach(function(b) {
      b.setAttribute('data-active', String(b.dataset.value === eb.iconWeight));
    });
    if (document.activeElement !== $('btnLabel')) $('btnLabel').value = eb.label;

    var isDirty = JSON.stringify(state) !== JSON.stringify(saved);
    $('dirtyBanner').setAttribute('data-dirty', String(isDirty));

    // Per-accordion-card dirty dots — flag any card whose fields differ from the
    // last saved snapshot, so collapsed cards still signal what's been edited.
    var ACC_CARD_FIELDS = {
      identity: ['logoUrl','logoMaxHeight','cornerRadius','effectMode','effectIntensity','color','chatHeaderColor','widgetName','inputPlaceholder','welcomeText','updateLabel','recentUpdate','recentUpdateSource','recentUpdateFlow'],
      media: ['hero'],
      launcher: ['bubbleStyle','customIconUrl','customIconSize','slideState','autoHideOnScroll','placement','statusPillFeatures','ctaText'],
      typography: ['typography'],
      panel: ['layoutVariant','blurredBackground'],
      behavior: ['soundNotifications','popupMessagePreview','askForRating','realtimeVoice','disableTextInput'],
      embed: ['embedSearch','embedButton']
    };
    Object.keys(ACC_CARD_FIELDS).forEach(function(id) {
      var card = document.querySelector('.acc-card[data-acc-id="' + id + '"]');
      if (!card) return;
      var dirty = ACC_CARD_FIELDS[id].some(function(k) {
        return JSON.stringify(state[k]) !== JSON.stringify(saved[k]);
      });
      card.setAttribute('data-acc-dirty', String(dirty));
    });
  }

  // ============= WIRING =============
  $('brandColorPicker').addEventListener('input', function(e){ setColor(e.target.value); });
  $('brandColorHex').addEventListener('input', function(e){
    var v = e.target.value.trim();
    if (/^#?[a-f0-9]{6}$/i.test(v)) setColor(v);
  });
  $('brandColorHex').addEventListener('blur', function(e){
    if (!/^#?[a-f0-9]{6}$/i.test(e.target.value)) e.target.value = state.color;
  });

  function setColor(hex) {
    if (hex.charAt(0) !== '#') hex = '#' + hex;
    hex = hex.toLowerCase();
    if (hex === state.color) return;
    state.color = hex;
    render();
  }

  $('resetColorBtn').addEventListener('click', function(){ setColor(DEFAULTS.color); });

  // Chat header color
  $('chatHeaderColorPicker').addEventListener('input', function(e){ setChatHeaderColor(e.target.value); });
  $('chatHeaderColorHex').addEventListener('input', function(e){
    var v = e.target.value.trim();
    if (/^#?[a-f0-9]{6}$/i.test(v)) setChatHeaderColor(v);
  });
  $('chatHeaderColorHex').addEventListener('blur', function(e){
    if (!/^#?[a-f0-9]{6}$/i.test(e.target.value)) e.target.value = state.chatHeaderColor;
  });

  function setChatHeaderColor(hex) {
    if (hex.charAt(0) !== '#') hex = '#' + hex;
    hex = hex.toLowerCase();
    if (hex === state.chatHeaderColor) return;
    state.chatHeaderColor = hex;
    render();
  }

  $('resetChatHeaderColorBtn').addEventListener('click', function(){ setChatHeaderColor(DEFAULTS.chatHeaderColor); });

  $('logoFile').addEventListener('change', function(e) {
    var f = e.target.files && e.target.files[0];
    if (!f) return;
    var reader = new FileReader();
    reader.onload = function() {
      var url = reader.result;
      var img = new Image();
      img.onload = function() {
        var warnings = [];
        if (/jpeg|jpg/.test(f.type)) warnings.push('JPEGs aren\'t recommended — they can\'t have a transparent background, so a PNG or SVG will sit cleaner on the chat header.');
        if (img.naturalWidth < 240) warnings.push('Logo is narrower than 240px — may look soft on retina.');
        if (img.naturalWidth > 2000) warnings.push('Logo is wider than 2000px — consider downsizing.');
        if (f.size > 200 * 1024) warnings.push('File is over 200KB — most logos compress under 50KB.');
        var ratio = img.naturalWidth / img.naturalHeight;
        if (ratio < 0.9 && state.logoMaxHeight === 44) warnings.push('This looks like a vertical/tall logo. Consider bumping max-height to 80px.');

        $('logoInfo').innerHTML =
          '<div class="logo-info__row"><span class="logo-info__label">Format:</span><span class="logo-info__value">' + (f.type.split('/')[1] || 'unknown').toUpperCase() + '</span></div>' +
          '<div class="logo-info__row"><span class="logo-info__label">Source:</span><span class="logo-info__value">' + img.naturalWidth + ' × ' + img.naturalHeight + '</span></div>' +
          '<div class="logo-info__row"><span class="logo-info__label">Size:</span><span class="logo-info__value">' + Math.round(f.size/1024) + ' KB</span></div>';

        if (warnings.length) {
          $('logoWarn').innerHTML = warnings.map(function(w){ return '• ' + w; }).join('<br>');
          $('logoWarn').setAttribute('data-show','true');
        } else {
          $('logoWarn').removeAttribute('data-show');
        }

        state.logoUrl = url;
        render();
      };
      img.src = url;
    };
    reader.readAsDataURL(f);
  });

  $('removeLogoBtn').addEventListener('click', function() {
    state.logoUrl = null;
    $('logoWarn').removeAttribute('data-show');
    $('logoInfo').innerHTML = '<div class="logo-info__row" style="font-style:italic">No logo uploaded.</div>';
    render();
  });

  // Custom icon upload (separate from logo)
  $('customIconFile').addEventListener('change', function(e) {
    var f = e.target.files && e.target.files[0];
    if (!f) return;
    if (/jpeg|jpg/.test(f.type)) {
      // Re-use color warn area for custom icon errors? No — use logoWarn analog.
      // Simplest: show an inline alert. For prototype, just reject silently with console.
      alert("JPEGs aren't accepted for custom icons. Use PNG with transparent background or SVG.");
      e.target.value = '';
      return;
    }
    var reader = new FileReader();
    reader.onload = function() {
      state.customIconUrl = reader.result;
      // Auto-switch to custom bubble style if not already
      if (state.bubbleStyle !== 'custom') state.bubbleStyle = 'custom';
      render();
    };
    reader.readAsDataURL(f);
  });

  $('removeCustomIconBtn').addEventListener('click', function() {
    state.customIconUrl = null;
    render();
  });

  // Custom launcher size (px diameter; the uploaded image fills it)
  $('customIconSize').addEventListener('input', function(e) {
    var v = parseInt(e.target.value, 10);
    if (isNaN(v)) return;
    state.customIconSize = Math.max(40, Math.min(96, v));
    render();
  });

  // Placement — align (corner) + bottom/side spacing (px, clamped to BotScrew's 24–300)
  document.querySelectorAll('#placementAlignSegmented button').forEach(function(b) {
    b.addEventListener('click', function() {
      state.placement.align = b.dataset.value;
      render();
    });
  });
  $('placementBottom').addEventListener('input', function(e) {
    var v = parseInt(e.target.value, 10);
    if (isNaN(v)) return;
    state.placement.bottomSpacing = Math.max(24, Math.min(300, v));
    render();
  });
  $('placementSide').addEventListener('input', function(e) {
    var v = parseInt(e.target.value, 10);
    if (isNaN(v)) return;
    state.placement.sideSpacing = Math.max(24, Math.min(300, v));
    render();
  });

  // Launcher styles that support the auto-hide-on-scroll (slide away) behavior.
  function supportsAutoHide(style) {
    return style === 'enhanced' || style === 'slidein' || style === 'custom';
  }
  // True when the active launcher style has auto-hide-on-scroll switched on.
  function isAutoHideActive() {
    var ah = state.autoHideOnScroll || {};
    return supportsAutoHide(state.bubbleStyle) && !!ah[state.bubbleStyle];
  }

  // Auto-hide-on-scroll toggle — per-style; turning it off snaps the launcher back.
  $('toggleAutoHide').addEventListener('click', function() {
    if (!supportsAutoHide(state.bubbleStyle)) return;
    var cur = !!(state.autoHideOnScroll && state.autoHideOnScroll[state.bubbleStyle]);
    state.autoHideOnScroll[state.bubbleStyle] = !cur;
    if (cur) state.slideState = 'visible'; // turning off → snap back to visible
    render();
  });

  // Simulate scroll button — toggles slide state for the active auto-hide pill.
  $('simulateScrollBtn').addEventListener('click', function() {
    if (!isAutoHideActive()) return;
    var btn = $('simulateScrollBtn');
    if (state.slideState === 'visible' || !state.slideState) {
      state.slideState = 'hidden';
      btn.innerHTML = '<svg width="11" height="11" viewBox="0 0 12 12" fill="none"><path d="M6 10V2M3 5l3-3 3 3" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg> Simulate scroll-up (show)';
    } else {
      state.slideState = 'visible';
      btn.innerHTML = '<svg width="11" height="11" viewBox="0 0 12 12" fill="none"><path d="M6 2v8M3 7l3 3 3-3" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg> Simulate scroll-down (hide)';
    }
    render();
  });

  // ============= SCROLL-TRIGGERED SLIDE-IN BEHAVIOR =============
  // Slidein pill behaves like a real mobile scroll listener: hides on
  // scroll-down (user moving away from start), reveals on scroll-up or pause.
  // Replaces the previous 3.2s auto-cycle timer with real scroll direction
  // tracking against window scrollY. Inactive when chat is open or bubble
  // style isn't slidein. Partners can also use the simulate button.
  var lastScrollY = window.scrollY || window.pageYOffset || 0;
  var scrollIdleTimer = null;
  var SCROLL_THRESHOLD = 6; // ignore tiny inertia jitter

  function handleSlideScroll() {
    if (!isAutoHideActive()) return;
    if (canvas.getAttribute('data-preview-open') === 'true') return;

    var currentY = window.scrollY || window.pageYOffset || 0;
    var delta = currentY - lastScrollY;

    if (Math.abs(delta) < SCROLL_THRESHOLD) return;

    var nextState = state.slideState;
    if (delta > 0) {
      // Scrolling down — hide pill (get out of user's way)
      nextState = 'hidden';
    } else if (delta < 0) {
      // Scrolling up — show pill (user looking for help)
      nextState = 'visible';
    }
    lastScrollY = currentY;

    if (nextState !== state.slideState) {
      state.slideState = nextState;
      syncSimulateButton();
      render();
    }

    // After scroll pauses for 1.2s, reveal the pill (assume user has stopped)
    if (scrollIdleTimer) clearTimeout(scrollIdleTimer);
    scrollIdleTimer = setTimeout(function() {
      if (!isAutoHideActive()) return;
      if (canvas.getAttribute('data-preview-open') === 'true') return;
      if (state.slideState !== 'visible') {
        state.slideState = 'visible';
        syncSimulateButton();
        render();
      }
    }, 1200);
  }

  function syncSimulateButton() {
    var btn = $('simulateScrollBtn');
    if (!btn) return;
    if (state.slideState === 'hidden') {
      btn.innerHTML = '<svg width="11" height="11" viewBox="0 0 12 12" fill="none"><path d="M6 10V2M3 5l3-3 3 3" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg> Simulate scroll-up (show)';
    } else {
      btn.innerHTML = '<svg width="11" height="11" viewBox="0 0 12 12" fill="none"><path d="M6 2v8M3 7l3 3 3-3" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg> Simulate scroll-down (hide)';
    }
  }

  // Throttled scroll listener using requestAnimationFrame for smooth handling
  var scrollTicking = false;
  window.addEventListener('scroll', function() {
    if (!scrollTicking) {
      window.requestAnimationFrame(function() {
        handleSlideScroll();
        scrollTicking = false;
      });
      scrollTicking = true;
    }
  }, { passive: true });

  // No-op shims for any code that still references __gsbSlideCycle
  window.__gsbSlideCycle = { start: function(){}, stop: function(){} };

  $('logoMaxHeight').addEventListener('input', function(e) {
    var v = parseInt(e.target.value, 10);
    if (isNaN(v)) return;
    v = Math.max(32, Math.min(96, v));
    state.logoMaxHeight = v;
    render();
  });

  document.querySelectorAll('.max-height-presets button').forEach(function(b) {
    b.addEventListener('click', function(){
      state.logoMaxHeight = parseInt(b.dataset.preset, 10);
      render();
    });
  });

  // Corner radius (master) — slider + presets
  $('cornerRadius').addEventListener('input', function(e) {
    var v = parseInt(e.target.value, 10);
    if (isNaN(v)) return;
    v = Math.max(0, Math.min(28, v));
    state.cornerRadius = v;
    render();
  });

  document.querySelectorAll('.radius-presets button').forEach(function(b) {
    b.addEventListener('click', function() {
      state.cornerRadius = parseInt(b.dataset.radiusPreset, 10);
      render();
    });
  });

  // Depth effect — segmented mode picker (none/shadow/glow) + intensity slider
  document.querySelectorAll('#effectModeSegmented [data-effect-mode]').forEach(function(b) {
    b.addEventListener('click', function() {
      state.effectMode = b.dataset.effectMode;
      render();
    });
  });
  $('effectIntensity').addEventListener('input', function(e) {
    var v = parseInt(e.target.value, 10);
    if (isNaN(v)) return;
    state.effectIntensity = Math.max(0, Math.min(100, v));
    render();
  });

  $('widgetName').addEventListener('input', function(e){ state.widgetName = e.target.value; render(); });
  $('inputPlaceholder').addEventListener('input', function(e){ state.inputPlaceholder = e.target.value; render(); });
  $('welcomeText').addEventListener('input', function(e){ state.welcomeText = e.target.value; render(); });
  $('updateLabel').addEventListener('input', function(e){ state.updateLabel = e.target.value; render(); });
  $('recentUpdate').addEventListener('input', function(e){ state.recentUpdate = e.target.value; render(); });
  document.querySelectorAll('#updateSourceSegmented [data-update-source]').forEach(function(btn){
    btn.addEventListener('click', function(){ state.recentUpdateSource = btn.getAttribute('data-update-source'); render(); });
  });
  $('updateFlow').addEventListener('change', function(e){ state.recentUpdateFlow = e.target.value; render(); });

  // ============= HERO (Webcams & featured image) WIRING =============
  document.querySelectorAll('#heroSourceSegmented [data-hero-source]').forEach(function(btn){
    btn.addEventListener('click', function(){
      state.hero.source = btn.getAttribute('data-hero-source');
      render();
      // Returning to a feed-driven webcam (no manual URL) — repopulate from the
      // live feed so a previously-shown featured image doesn't linger.
      if (state.hero.source === 'webcam' && !state.hero.webcam.url &&
          window.gsbChatPreview && typeof window.gsbChatPreview.refreshData === 'function') {
        window.gsbChatPreview.refreshData();
      }
    });
  });
  $('webcamUrl').addEventListener('input', function(e){ state.hero.webcam.url = e.target.value; render(); });
  $('webcamLabel').addEventListener('input', function(e){ state.hero.webcam.label = e.target.value; render(); });
  $('featuredImageUrl').addEventListener('input', function(e){ state.hero.featuredImage.url = e.target.value; render(); });
  $('featuredCaption').addEventListener('input', function(e){ state.hero.featuredImage.caption = e.target.value; render(); });
  $('featuredLink').addEventListener('input', function(e){ state.hero.featuredImage.link = e.target.value; render(); });
  $('featuredImageFile').addEventListener('change', function(e){
    var f = e.target.files && e.target.files[0];
    if (!f) return;
    var reader = new FileReader();
    reader.onload = function(){ state.hero.featuredImage.url = reader.result; render(); };
    reader.readAsDataURL(f);
  });
  $('ctaText').addEventListener('input', function(e){
    // Glyph-aware cap at 24 user-visible chars (so 🎿 counts as 1, not 2).
    // Note: maxlength was removed from the HTML input because it counts
    // UTF-16 code units which over-counts emojis.
    var v = truncateGlyphs(e.target.value, 24);
    if (v !== e.target.value) e.target.value = v;
    state.ctaText = v;
    render();
  });

  document.querySelectorAll('#bubbleStyleCards .radio-card').forEach(function(c) {
    c.addEventListener('click', function() {
      state.bubbleStyle = c.dataset.value;
      // Reset slide state when switching bubble style
      state.slideState = 'visible';
      var simBtn = $('simulateScrollBtn');
      if (simBtn) simBtn.innerHTML = '<svg width="11" height="11" viewBox="0 0 12 12" fill="none"><path d="M6 2v8M3 7l3 3 3-3" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg> Simulate scroll-down (hide)';
      c.querySelector('input[type="radio"]').checked = true;
      // Auto-cycle: start when user picks slidein, stop when they pick anything else
      if (window.__gsbSlideCycle) {
        if (state.bubbleStyle === 'slidein') {
          window.__gsbSlideCycle.start();
        } else {
          window.__gsbSlideCycle.stop();
        }
      }
      render();
    });
  });

  document.querySelectorAll('#layoutCards .radio-card').forEach(function(c) {
    c.addEventListener('click', function() {
      state.layoutVariant = c.dataset.value;
      c.querySelector('input[type="radio"]').checked = true;
      // Drive demo's setVariant FIRST — it reads body.dataset.variant for prev state,
      // so we must call it before mutating body. setVariant itself sets body.dataset.variant.
      if (window.gsbChatPreview && typeof window.gsbChatPreview.setVariant === 'function') {
        window.gsbChatPreview.setVariant(state.layoutVariant);
      }
      // Auto-open the chat in the newly-selected variant so partners see it immediately
      setOpen(true);
      render();
    });
  });

  function bindToggle(id, getter, setter) {
    $(id).addEventListener('click', function() { setter(!getter()); render(); });
  }
  bindToggle('toggleLiveAgent', function(){ return state.statusPillFeatures.liveAgent; }, function(v){ state.statusPillFeatures.liveAgent = v; });
  bindToggle('toggleWeather', function(){ return state.statusPillFeatures.weather; }, function(v){ state.statusPillFeatures.weather = v; });
  bindToggle('toggleCta', function(){ return state.statusPillFeatures.needHelpCta; }, function(v){ state.statusPillFeatures.needHelpCta = v; });
  bindToggle('toggleBlur', function(){ return state.blurredBackground; }, function(v){ state.blurredBackground = v; });
  bindToggle('toggleSound', function(){ return state.soundNotifications; }, function(v){ state.soundNotifications = v; });
  bindToggle('togglePopup', function(){ return state.popupMessagePreview; }, function(v){ state.popupMessagePreview = v; });
  bindToggle('toggleRating', function(){ return state.askForRating; }, function(v){ state.askForRating = v; });
  bindToggle('toggleVoice', function(){ return state.realtimeVoice; }, function(v){ state.realtimeVoice = v; });
  bindToggle('toggleDisableInput', function(){ return state.disableTextInput; }, function(v){ state.disableTextInput = v; });

  launcher.addEventListener('click', function(){ setOpen(true); });
  $('chatCloseBtn').addEventListener('click', function(){ setOpen(false); });

  // Embed search bar preview — functional trigger that opens chat and
  // optionally pre-sends the typed query as the first user message.
  var embedSearchForm = $('embedSearchPreview');
  var embedSearchInput = $('embedSearchPreviewInput');
  if (embedSearchForm) {
    // ChatGPT-style swap (visual): Voice Mode when empty, Send (arrow) once typing.
    function syncEmbedSearchActions() {
      embedSearchForm.setAttribute('data-has-text',
        (embedSearchInput && embedSearchInput.value.trim()) ? 'true' : 'false');
    }
    if (embedSearchInput) embedSearchInput.addEventListener('input', syncEmbedSearchActions);
    embedSearchForm.addEventListener('submit', function(e) {
      e.preventDefault();
      var q = (embedSearchInput && embedSearchInput.value || '').trim();
      setOpen(true);
      if (q && window.gsbChatPreview && typeof window.gsbChatPreview.handleQuery === 'function') {
        // Wait for chat to mount + animate in, then send query
        setTimeout(function() {
          window.gsbChatPreview.handleQuery(q);
        }, 300);
      }
      if (embedSearchInput) embedSearchInput.value = '';
      syncEmbedSearchActions();
    });
    syncEmbedSearchActions();
  }

  // Embed mag glass button preview — opens chat normally
  var embedButtonPrev = $('embedButtonPreview');
  if (embedButtonPrev) {
    embedButtonPrev.addEventListener('click', function() { setOpen(true); });
  }
  // Also bind the visible X button (gsbChatClose) — the chat module's
  // closeChat hook only handles voice mode exit; the actual close logic
  // lives in dashboard's setOpen.
  var visibleClose = document.getElementById('gsbChatClose');
  if (visibleClose) {
    visibleClose.addEventListener('click', function(){ setOpen(false); });
  }

  // Backdrop click to close chat
  var backdrop = document.querySelector('.gsb-backdrop');
  if (backdrop) {
    backdrop.addEventListener('click', function() { setOpen(false); });
  }

  // Escape key to close chat
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && canvas.getAttribute('data-preview-open') === 'true') {
      setOpen(false);
    }
  });

  function setOpen(open) {
    canvas.setAttribute('data-preview-open', String(open));
    // Mirror state to body so the embedded demo chat CSS works
    if (open) {
      document.body.classList.add('modal-open');
      document.body.setAttribute('data-variant', state.layoutVariant);
      document.body.setAttribute('data-liveagent', state.statusPillFeatures.liveAgent ? 'on' : 'off');
      // Trigger the chat module's openChat hook if present
      if (window.gsbChatPreview && typeof window.gsbChatPreview.openChat === 'function') {
        window.gsbChatPreview.openChat();
      }
      // Refresh real Jackson Hole data so the conditions table is current
      if (window.gsbChatPreview && typeof window.gsbChatPreview.refreshData === 'function') {
        window.gsbChatPreview.refreshData();
      }
    } else {
      document.body.classList.remove('modal-open');
      if (window.gsbChatPreview && typeof window.gsbChatPreview.closeChat === 'function') {
        window.gsbChatPreview.closeChat();
      }
    }
  }

  $('saveBtn').addEventListener('click', function() {
    saved = JSON.parse(JSON.stringify(state));
    // Persist durably so the config survives a reload. Stored in BotScrew
    // widgetSettings shape — the exact payload the bot drop-in consumes.
    try {
      localStorage.setItem(SAVED_CONFIG_KEY, JSON.stringify(toBotscrewWidgetSettings(state)));
    } catch (err) {
      console.warn('[appearance] save failed:', err);
    }
    render();
    var b = $('saveBtn');
    var orig = b.textContent;
    b.textContent = '✓ Saved';
    setTimeout(function(){ b.textContent = orig; }, 1400);
  });

  $('revertBtn').addEventListener('click', function() {
    state = JSON.parse(JSON.stringify(saved));
    render();
  });

  // Mobile preview drawer behavior
  // When the preview-col is collapsed (mobile only), tapping anywhere on it
  // opens it. When open, the close button dismisses it.
  var previewCol = document.querySelector('.preview-col');
  previewCol.addEventListener('click', function(e) {
    // Only act when in mobile (collapsed) mode
    var isMobile = window.matchMedia('(max-width: 720px)').matches;
    if (!isMobile) return;
    var isOpen = previewCol.getAttribute('data-mobile-open') === 'true';
    if (!isOpen) {
      previewCol.setAttribute('data-mobile-open', 'true');
      e.stopPropagation();
    }
  });
  $('previewCloseMobileBtn').addEventListener('click', function(e) {
    e.stopPropagation();
    previewCol.removeAttribute('data-mobile-open');
  });

  // ============= TYPOGRAPHY WIRING =============
  bodyPicker = createFontPicker({
    root: $('bodyFontPicker'), kind: 'body', catalog: FONT_CATALOG, curated: CURATED_BODY,
    getValue: function() { return state.typography.bodyFont; },
    onSelect: function(fam) { state.typography.bodyFont = fam; render(); }
  });
  displayPicker = createFontPicker({
    root: $('displayFontPicker'), kind: 'display', catalog: FONT_CATALOG, curated: CURATED_DISPLAY,
    getValue: function() { return state.typography.displayFont; },
    onSelect: function(fam) { state.typography.displayFont = fam; render(); }
  });
  document.querySelectorAll('#fontPresets .font-preset').forEach(function(preset) {
    preset.addEventListener('click', function() {
      state.typography.bodyFont = preset.dataset.body;
      state.typography.displayFont = preset.dataset.display;
      render();
    });
  });
  // Preload preview faces so the preset tiles render their Aa samples in-font.
  ['Inter', 'Playfair Display', 'DM Sans', 'Fraunces', 'Montserrat', 'Oswald', 'Lato', 'Lora'].forEach(loadPreview);
  // Text size slider + presets
  $('textSizeSlider').addEventListener('input', function(e) {
    state.typography.textScale = parseFloat(e.target.value);
    render();
  });
  document.querySelectorAll('#textSizePresets button').forEach(function(b) {
    b.addEventListener('click', function() {
      state.typography.textScale = parseFloat(b.dataset.preset);
      render();
    });
  });

  // ============= EMBEDDABLE SEARCH WIRING =============

  // SEARCH BAR — radius slider + presets
  $('searchRadiusSlider').addEventListener('input', function(e) {
    state.embedSearch.borderRadius = parseInt(e.target.value, 10);
    render();
  });
  document.querySelectorAll('#searchRadiusPresets button').forEach(function(b) {
    b.addEventListener('click', function() {
      state.embedSearch.borderRadius = parseInt(b.dataset.preset, 10);
      render();
    });
  });

  // SEARCH BAR — border thickness
  document.querySelectorAll('#searchBorderSegmented button').forEach(function(b) {
    b.addEventListener('click', function() {
      state.embedSearch.borderThickness = parseFloat(b.dataset.value);
      render();
    });
  });

  // SEARCH BAR — width behavior
  document.querySelectorAll('#searchWidthSegmented button').forEach(function(b) {
    b.addEventListener('click', function() {
      state.embedSearch.width = b.dataset.value;
      render();
    });
  });

  // SEARCH BAR — placeholder text
  $('searchPlaceholder').addEventListener('input', function(e) {
    state.embedSearch.placeholder = e.target.value;
    render();
  });

  // BUTTON — size slider + presets
  $('btnSizeSlider').addEventListener('input', function(e) {
    state.embedButton.size = parseInt(e.target.value, 10);
    render();
  });
  document.querySelectorAll('#btnSizePresets button').forEach(function(b) {
    b.addEventListener('click', function() {
      state.embedButton.size = parseInt(b.dataset.preset, 10);
      render();
    });
  });

  // BUTTON — shape, background, icon weight (segmented controls)
  document.querySelectorAll('#btnShapeSegmented button').forEach(function(b) {
    b.addEventListener('click', function() {
      state.embedButton.shape = b.dataset.value;
      render();
    });
  });
  document.querySelectorAll('#btnBgSegmented button').forEach(function(b) {
    b.addEventListener('click', function() {
      state.embedButton.background = b.dataset.value;
      render();
    });
  });
  document.querySelectorAll('#btnIconWeightSegmented button').forEach(function(b) {
    b.addEventListener('click', function() {
      state.embedButton.iconWeight = b.dataset.value;
      render();
    });
  });

  // BUTTON — optional label
  $('btnLabel').addEventListener('input', function(e) {
    state.embedButton.label = e.target.value;
    render();
  });

  // On small dashboards (Android phones administering this), default the preview
  // to mobile device mode since the partner is already in a mobile mindset.
  if (window.matchMedia('(max-width: 720px)').matches) {
    previewDevice = 'mobile';
  }

  // ============= LIVE PREVIEW SYNC =============
  // Writes the current dashboard state to localStorage so the live preview
  // page (sharable.link/0wa0vh2t) can pick it up. Both pages live on the
  // sharable.link origin so localStorage is shared. Auto-sync is debounced
  // to avoid hammering on slider drags. The "Live Preview" button click also
  // syncs immediately and encodes state in the URL hash for shareability —
  // partners can text the URL to anyone and the recipient sees the same
  // configured chat regardless of whether their localStorage is fresh.
  var LIVE_PREVIEW_URL = 'https://sharable.link/0wa0vh2t';
  var LIVE_PREVIEW_LS_KEY = 'gsb_preview_config';
  var syncDebounceTimer = null;
  var syncStatusEl = $('livePreviewSyncStatus');

  // Build a config object the preview can consume. The preview's loadConfig()
  // reads these keys. We pass the full state — preview ignores keys it doesn't
  // recognize (snowfall, depth effect, etc.) so this is forward-compatible
  // with future preview updates.
  function buildLivePreviewConfig() {
    return {
      logoUrl: state.logoUrl,
      logoMaxHeight: state.logoMaxHeight,
      cornerRadius: state.cornerRadius,
      color: state.color,
      chatHeaderColor: state.chatHeaderColor,
      widgetName: state.widgetName,
      inputPlaceholder: state.inputPlaceholder,
      welcomeText: state.welcomeText,
      updateLabel: state.updateLabel,
      recentUpdate: state.recentUpdate,
      recentUpdateSource: state.recentUpdateSource,
      recentUpdateFlow: state.recentUpdateFlow,
      hero: state.hero,
      realtimeVoice: state.realtimeVoice,
      ctaText: state.ctaText,
      bubbleStyle: state.bubbleStyle,
      customIconUrl: state.customIconUrl,
      layoutVariant: state.layoutVariant,
      statusPillFeatures: state.statusPillFeatures,
      typography: state.typography,
      // Forward-compatible — preview will read these when updated:
      effectMode: state.effectMode,
      effectIntensity: state.effectIntensity
    };
  }

  // base64-url encode (URL-safe base64) for the hash payload
  function encodeConfigForUrl(config) {
    try {
      var json = JSON.stringify(config);
      // Strip the data: URI logo from URL payload — it can be ~80KB+ which
      // would push the URL past CDN limits. The localStorage write still
      // contains the full logo so same-device viewing works perfectly.
      var lite = JSON.parse(json);
      if (lite.logoUrl && lite.logoUrl.indexOf('data:') === 0) {
        delete lite.logoUrl;
      }
      var liteJson = JSON.stringify(lite);
      var b64 = btoa(unescape(encodeURIComponent(liteJson)));
      return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    } catch (err) {
      console.warn('[live-preview] encode failed:', err);
      return null;
    }
  }

  function setSyncStatus(state, message) {
    if (!syncStatusEl) return;
    syncStatusEl.setAttribute('data-state', state);
    if (message !== undefined) syncStatusEl.textContent = message;
  }

  function syncToLivePreview() {
    var config = buildLivePreviewConfig();
    setSyncStatus('syncing', 'Syncing…');
    try {
      localStorage.setItem(LIVE_PREVIEW_LS_KEY, JSON.stringify(config));
      // Note: the durable BotScrew-shaped config (gsb_widget_settings) is written
      // by the Save button, not here — auto-sync only feeds the sharable.link live
      // preview, so Save/Revert and the dirty banner stay truthful.
      setSyncStatus('synced', 'Synced');
      // Fade back to idle after 2 seconds
      setTimeout(function() {
        if (syncStatusEl && syncStatusEl.getAttribute('data-state') === 'synced') {
          setSyncStatus('idle', '');
        }
      }, 2000);
    } catch (err) {
      // localStorage can fail in private/incognito mode or if quota exceeded
      console.warn('[live-preview] sync failed:', err);
      setSyncStatus('error', 'Sync failed');
      setTimeout(function() {
        if (syncStatusEl && syncStatusEl.getAttribute('data-state') === 'error') {
          setSyncStatus('idle', '');
        }
      }, 3000);
    }
  }

  // Debounced auto-sync — fires 500ms after the last state change so we don't
  // hammer localStorage during slider drags. localStorage writes are cheap but
  // the status indicator flicker would be distracting if it fired on every tick.
  function scheduleLivePreviewSync() {
    if (syncDebounceTimer) clearTimeout(syncDebounceTimer);
    syncDebounceTimer = setTimeout(syncToLivePreview, 500);
  }

  // Wrap render() to auto-sync after every state change. We do this by
  // monkey-patching render — the original is preserved and we add the sync
  // call. This approach avoids editing render's body throughout the file.
  var __originalRender = render;
  render = function() {
    __originalRender.apply(this, arguments);
    scheduleLivePreviewSync();
  };

  // Live Preview button click — sync immediately (no debounce) and update the
  // URL with hash payload so recipients on other devices can see the same
  // config without needing localStorage.
  var livePreviewLink = $('livePreviewLink');
  if (livePreviewLink) {
    livePreviewLink.addEventListener('click', function(e) {
      // Sync now (don't wait for debounce)
      if (syncDebounceTimer) clearTimeout(syncDebounceTimer);
      syncToLivePreview();
      // Build URL with hash payload for cross-device sharing
      var encoded = encodeConfigForUrl(buildLivePreviewConfig());
      if (encoded) {
        // Use hash so it survives same-origin navigation + isn't sent to server
        livePreviewLink.href = LIVE_PREVIEW_URL + '#cfg=' + encoded;
      } else {
        livePreviewLink.href = LIVE_PREVIEW_URL;
      }
      // Let the default <a> behavior handle the new-tab open
    });
  }

  // ============= ACCORDION =============
  // Each Appearance section is a collapsible card. A header toggles its own card;
  // "Expand all" toggles every card. Purely a view layer — never touches state,
  // so it never trips the Unsaved-changes banner.
  function accCards() { return document.querySelectorAll('.acc-card'); }
  function accAllOpen() {
    var cards = accCards();
    return cards.length > 0 && Array.prototype.every.call(cards, function(c) {
      return c.getAttribute('data-open') === 'true';
    });
  }
  function setAccExpandAllLabel() {
    var b = $('accExpandAll');
    if (b) b.textContent = accAllOpen() ? 'Collapse all' : 'Expand all';
  }
  document.querySelectorAll('.acc-head').forEach(function(head) {
    head.addEventListener('click', function() {
      var card = head.closest('.acc-card');
      var open = card.getAttribute('data-open') === 'true';
      card.setAttribute('data-open', open ? 'false' : 'true');
      head.setAttribute('aria-expanded', open ? 'false' : 'true');
      setAccExpandAllLabel();
    });
  });
  if ($('accExpandAll')) {
    $('accExpandAll').addEventListener('click', function() {
      var open = !accAllOpen();
      accCards().forEach(function(c) {
        c.setAttribute('data-open', open ? 'true' : 'false');
        var h = c.querySelector('.acc-head');
        if (h) h.setAttribute('aria-expanded', open ? 'true' : 'false');
      });
      setAccExpandAllLabel();
    });
  }
  setAccExpandAllLabel();

  render();
  // Auto-open the chat preview on load so partners can immediately interact
  // with the composer (without it, body.modal-open is never set and the chat
  // surface stays pointer-events:none, making the input dead on click/type).
  setOpen(true);
})();


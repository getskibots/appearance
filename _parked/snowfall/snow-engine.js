// ============= SNOWFALL ENGINE =============
// (Parked) Was an IIFE near the top of src/dashboard/dashboard.js, before STATE.
// Renders the actual flake/streak elements inside the chat surface based
// on state.snowfall. Three styles supported: realistic (soft circles),
// crystalline (sharp 6-pointed flakes), storm (diagonal streaks).
// Re-runs whenever style or intensity changes; pauses when chat is closed
// (perf), respects prefers-reduced-motion (a11y), supports idle pause.
var SnowEngine = (function() {
  var container = null;
  var currentStyle = null;
  var currentIntensity = 0;
  var currentMobileEnabled = true;
  var idleTimer = null;
  var idlePaused = false;
  var IDLE_MS = 60000;

  function reduceMotion() {
    try {
      return window.matchMedia &&
             window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch (_) { return false; }
  }

  function isMobileViewport() {
    // Check the dashboard's preview canvas device toggle for "mobile",
    // or the actual viewport width. Either signal kills the overlay if
    // the partner has disabled mobile snowfall.
    try {
      var canvasEl = document.querySelector('.preview-canvas');
      if (canvasEl && canvasEl.getAttribute('data-device') === 'mobile') return true;
    } catch (_) {}
    return window.innerWidth < 720;
  }

  function clear() {
    if (!container) return;
    container.innerHTML = '';
  }

  function build(style, intensity) {
    if (!container) container = document.getElementById('gsbSnowfall');
    if (!container) return;
    clear();

    // Disable on mobile if partner toggled it off
    if (isMobileViewport() && !currentMobileEnabled) return;

    // Map intensity (20..200) to actual flake count. Cap at 80 for perf
    // even at "Whiteout" — 80 elements is plenty visually and stays smooth
    // even on low-end devices.
    var count = Math.min(80, Math.max(8, Math.round(intensity / 2.5)));

    var staticMode = reduceMotion();

    for (var i = 0; i < count; i++) {
      var el = document.createElement('span');
      var leftPct = Math.random() * 100;
      var size, fallDuration, drift, opacity, animation;

      if (style === 'crystalline') {
        el.className = 'gsb-snow-crystal';
        size = 6 + Math.random() * 10;        // 6-16px
        fallDuration = 7 + Math.random() * 6;  // 7-13s (slower, deliberate)
        drift = (Math.random() - 0.5) * 30;    // gentle sway
        opacity = 0.7 + Math.random() * 0.3;
        animation = 'gsb-snow-fall';
      } else if (style === 'storm') {
        el.className = 'gsb-snow-streak';
        size = 8 + Math.random() * 14;        // height 8-22px (streaks)
        fallDuration = 0.8 + Math.random() * 1.2; // 0.8-2s (fast)
        drift = -50 - Math.random() * 80;      // strong sideways wind
        opacity = 0.7 + Math.random() * 0.3;
        animation = 'gsb-snow-fall-storm';
        el.style.height = size + 'px';
        el.style.left = leftPct + '%';
        el.style.setProperty('--flake-drift', drift + 'px');
        el.style.setProperty('--flake-opacity', String(opacity));
        el.style.setProperty('--flake-distance', '700px');
        el.style.animationDuration = fallDuration + 's';
        el.style.animationDelay = (Math.random() * fallDuration) + 's';
        el.style.animationName = animation;
        el.style.animationTimingFunction = 'linear';
        el.style.animationIterationCount = 'infinite';
        container.appendChild(el);
        continue;
      } else {
        // realistic (default)
        el.className = 'gsb-snow-flake';
        size = 3 + Math.random() * 6;         // 3-9px
        fallDuration = 5 + Math.random() * 7;  // 5-12s
        drift = (Math.random() - 0.5) * 60;
        opacity = 0.6 + Math.random() * 0.4;
        animation = 'gsb-snow-fall';
      }

      // Common positioning + animation properties
      el.style.width = size + 'px';
      el.style.height = size + 'px';
      el.style.left = leftPct + '%';
      el.style.setProperty('--flake-drift', drift + 'px');
      el.style.setProperty('--flake-opacity', String(opacity));
      el.style.setProperty('--flake-distance', '700px');
      el.style.animationDuration = fallDuration + 's';
      el.style.animationDelay = (Math.random() * fallDuration) + 's';
      el.style.animationName = animation;
      el.style.animationTimingFunction = 'linear';
      el.style.animationIterationCount = 'infinite';

      if (staticMode) {
        // Static dusting — kill animation, place at random vertical positions
        el.style.animationPlayState = 'paused';
        el.style.top = (Math.random() * 90) + '%';
        el.style.opacity = String(opacity * 0.5);
      }

      container.appendChild(el);
    }
  }

  function shouldRender() {
    // Don't render if chat is closed (perf — flakes outside view are wasted)
    var canvasEl = document.querySelector('.preview-canvas');
    if (canvasEl && canvasEl.getAttribute('data-preview-open') !== 'true') {
      return false;
    }
    return true;
  }

  function apply(snow) {
    if (!snow) return;
    currentMobileEnabled = !!snow.showOnMobile;

    // Idle pause hook — restart timer on every apply (state change = activity)
    if (snow.pauseWhenIdle) {
      if (idleTimer) clearTimeout(idleTimer);
      idleTimer = setTimeout(function() {
        idlePaused = true;
        if (container) {
          container.querySelectorAll('span').forEach(function(el) {
            el.style.animationPlayState = 'paused';
          });
        }
      }, IDLE_MS);
      // If we were previously idle-paused, resume now
      if (idlePaused && container) {
        idlePaused = false;
        container.querySelectorAll('span').forEach(function(el) {
          el.style.animationPlayState = 'running';
        });
      }
    }

    // None style → clear and bail
    if (snow.style === 'none' || !snow.style) {
      clear();
      return;
    }

    // Skip rebuild if nothing relevant changed (perf)
    if (snow.style === currentStyle && snow.intensity === currentIntensity && container && container.children.length > 0) {
      return;
    }

    currentStyle = snow.style;
    currentIntensity = snow.intensity || 90;

    if (shouldRender()) {
      build(currentStyle, currentIntensity);
    } else {
      clear();
    }
  }

  function refresh() {
    // Called when chat opens — rebuilds in case it was cleared while closed
    if (currentStyle && shouldRender()) {
      build(currentStyle, currentIntensity);
    }
  }

  return { apply: apply, refresh: refresh, clear: clear };
})();

/* GetSkiBots — ambient snowfall engine (shared).
 *
 * Populates a container (#gsbSnowfall by default, absolutely positioned inside
 * .gsb-chat) with animated flakes. Three styles: realistic (soft circles),
 * crystalline (sharp 6-pointed flakes), storm (diagonal streaks). Re-runs on
 * style/intensity change; pauses when the chat is closed (perf, dashboard only);
 * respects reduced-motion; idle-pauses.
 *
 * createSnowEngine(containerId) → { apply(snow), refresh(), clear() }
 *   apply(snow): snow = { style, intensity, showOnMobile, pauseWhenIdle }.
 *                style 'none'/falsy clears. Drives both the dashboard live
 *                preview and the demo widget so they can't drift.
 *
 * The .preview-canvas look-ups below are dashboard-specific gates; outside the
 * dashboard they fall back gracefully (always render, viewport-width mobile check).
 */
export function createSnowEngine(containerId) {
  containerId = containerId || 'gsbSnowfall';
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
    try {
      var canvasEl = document.querySelector('.preview-canvas');
      if (canvasEl && canvasEl.getAttribute('data-device') === 'mobile') return true;
    } catch (_) {}
    return window.innerWidth < 720;
  }

  function clear() {
    if (!container) container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '';
  }

  function build(style, intensity) {
    if (!container) container = document.getElementById(containerId);
    if (!container) return;
    clear();
    if (isMobileViewport() && !currentMobileEnabled) return;
    var count = Math.min(80, Math.max(8, Math.round(intensity / 2.5)));
    var staticMode = reduceMotion();
    for (var i = 0; i < count; i++) {
      var el = document.createElement('span');
      var leftPct = Math.random() * 100;
      var size, fallDuration, drift, opacity, animation;
      if (style === 'crystalline') {
        el.className = 'gsb-snow-crystal';
        size = 6 + Math.random() * 10;
        fallDuration = 7 + Math.random() * 6;
        drift = (Math.random() - 0.5) * 30;
        opacity = 0.7 + Math.random() * 0.3;
        animation = 'gsb-snow-fall';
      } else if (style === 'storm') {
        el.className = 'gsb-snow-streak';
        size = 8 + Math.random() * 14;
        fallDuration = 0.8 + Math.random() * 1.2;
        drift = -50 - Math.random() * 80;
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
        el.className = 'gsb-snow-flake';
        size = 3 + Math.random() * 6;
        fallDuration = 5 + Math.random() * 7;
        drift = (Math.random() - 0.5) * 60;
        opacity = 0.6 + Math.random() * 0.4;
        animation = 'gsb-snow-fall';
      }
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
        el.style.animationPlayState = 'paused';
        el.style.top = (Math.random() * 90) + '%';
        el.style.opacity = String(opacity * 0.5);
      }
      container.appendChild(el);
    }
  }

  function shouldRender() {
    var canvasEl = document.querySelector('.preview-canvas');
    if (canvasEl && canvasEl.getAttribute('data-preview-open') !== 'true') return false;
    return true;
  }

  function apply(snow) {
    if (!snow) return;
    currentMobileEnabled = !!snow.showOnMobile;
    if (snow.pauseWhenIdle) {
      if (idleTimer) clearTimeout(idleTimer);
      idleTimer = setTimeout(function() {
        idlePaused = true;
        if (container) {
          container.querySelectorAll('span').forEach(function(el) { el.style.animationPlayState = 'paused'; });
        }
      }, IDLE_MS);
      if (idlePaused && container) {
        idlePaused = false;
        container.querySelectorAll('span').forEach(function(el) { el.style.animationPlayState = 'running'; });
      }
    }
    if (snow.style === 'none' || !snow.style) { clear(); return; }
    if (snow.style === currentStyle && snow.intensity === currentIntensity && container && container.children.length > 0) return;
    currentStyle = snow.style;
    currentIntensity = snow.intensity || 90;
    if (shouldRender()) build(currentStyle, currentIntensity);
    else clear();
  }

  function refresh() {
    if (currentStyle && shouldRender()) build(currentStyle, currentIntensity);
  }

  return { apply: apply, refresh: refresh, clear: clear };
}

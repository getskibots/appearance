/* (Parked) The scattered snowfall glue from src/dashboard/dashboard.js.
   Each block is annotated with where it goes. Paste alongside snow-engine.js. */

/* ---- 1. DEFAULTS field (inside the DEFAULTS object) ---- */
// snowfall: {
//   enabled: false,         // master on/off
//   style: 'realistic',     // 'realistic' | 'crystalline' | 'storm'
//   intensity: 90,          // 20-200, flake count
//   showOnMobile: true,
//   pauseWhenIdle: true,
//   respectReducedMotion: true  // a11y-locked, always true
// },

/* ---- 2. render() block (was right after the DEPTH/effect-intensity sync) ---- */
// ============= SNOWFALL EFFECT =============
// Sync style cards (primary + overflow) — only one is checked at a time.
var snow = state.snowfall || {};
setToggle('toggleSnowEnabled', !!snow.enabled);
// Dim/disable the rest of the snowfall controls when master toggle is off
var snowControls = $('snowfallControls');
if (snowControls) snowControls.setAttribute('data-disabled', String(!snow.enabled));
document.querySelectorAll('.snow-card').forEach(function(c) {
  var checked = c.dataset.value === snow.style;
  c.setAttribute('data-checked', String(checked));
  var input = c.querySelector('input[type="radio"]');
  if (input) input.checked = checked;
});
// Intensity slider + readout
var snowSlider = $('snowfallIntensity');
if (snowSlider && document.activeElement !== snowSlider) snowSlider.value = String(snow.intensity);
if ($('snowfallIntensityReadout')) $('snowfallIntensityReadout').textContent = snow.intensity;
// Behavior toggles
setToggle('toggleSnowMobile', !!snow.showOnMobile);
setToggle('toggleSnowPause', !!snow.pauseWhenIdle);
setToggle('toggleSnowReducedMotion', true); // always locked on
// Push snowfall config to chat surface via data attributes for the runtime
// (the snowfall engine reads these to render the actual overlay).
// When disabled, set style to 'none' so CSS kill switch and engine both stop.
var effectiveStyle = snow.enabled ? (snow.style || 'realistic') : 'none';
if (canvas) {
  canvas.setAttribute('data-snow-style', effectiveStyle);
  canvas.setAttribute('data-snow-intensity', String(snow.intensity || 90));
  canvas.setAttribute('data-snow-mobile', snow.showOnMobile ? 'true' : 'false');
  canvas.setAttribute('data-snow-idle-pause', snow.pauseWhenIdle ? 'true' : 'false');
}
// Run the engine — builds/rebuilds the actual flakes inside the chat surface
SnowEngine.apply({
  style: effectiveStyle,
  intensity: snow.intensity,
  showOnMobile: snow.showOnMobile,
  pauseWhenIdle: snow.pauseWhenIdle
});

/* ---- 3. Handlers (was in the WIRING section) ---- */
// ============= SNOWFALL HANDLERS =============
// Style card clicks (3 primary styles)
document.querySelectorAll('.snow-card').forEach(function(card) {
  card.addEventListener('click', function() {
    state.snowfall.style = card.dataset.value;
    render();
  });
});
// Intensity slider
$('snowfallIntensity').addEventListener('input', function(e) {
  var v = parseInt(e.target.value, 10);
  if (isNaN(v)) return;
  state.snowfall.intensity = Math.max(20, Math.min(200, v));
  render();
});
// Behavior toggles (reduced motion is locked, no handler needed)
bindToggle('toggleSnowEnabled',
  function(){ return state.snowfall.enabled; },
  function(v){ state.snowfall.enabled = v; });
bindToggle('toggleSnowMobile',
  function(){ return state.snowfall.showOnMobile; },
  function(v){ state.snowfall.showOnMobile = v; });
bindToggle('toggleSnowPause',
  function(){ return state.snowfall.pauseWhenIdle; },
  function(v){ state.snowfall.pauseWhenIdle = v; });

/* ---- 4. setOpen() calls ---- */
// In setOpen(true), after refreshData():
//   // Refresh snowfall (in case it was cleared while chat was closed)
//   SnowEngine.refresh();
// In setOpen(false), after closeChat():
//   // Clear snowfall when chat closes — saves CPU
//   SnowEngine.clear();

/* ---- 5. buildLivePreviewConfig() field ---- */
//   snowfall: state.snowfall

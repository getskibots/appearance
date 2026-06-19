/* GetSkiBots — analytics event layer.
 *
 * A thin, framework-agnostic *semantic* event emitter. One call —
 * analytics.track('widget_opened', { entry_point: 'bubble' }) — fans out to up
 * to three destinations:
 *   1. GetSkiBots' own GA4 property  (ALWAYS — hardcoded GSB_GA4_ID below)
 *   2. the resort's own GA4 property (ONLY when config.ga4MeasurementId is set)
 *   3. the browser console           (debug/testing)
 *
 * CONSOLE-FIRST: this module is fully functional and testable in console-only
 * mode. The GA (gtag) transport is added in a later step — until then,
 * routeToGA() is a safe no-op, so events can be verified independent of GA.
 *
 * Ad-blocker safe: every external call is guarded; if gtag is blocked or absent
 * the widget keeps working with zero thrown errors.
 *
 * Usage:
 *   analytics.init({ ga4MeasurementId: 'G-RESORT123', debug: false })
 *   analytics.track('message_sent', { turn_number: 3 })
 *   analytics.setDebug(true)
 */

// ─────────────────────────────────────────────────────────────────────────────
// GetSkiBots' own GA4 measurement id — ALWAYS receives every event.
// Hardcoded in the widget (NOT stored in BotScrew). Only the resort's id is
// configurable via gsbAppearance.analytics.ga4MeasurementId.
// GetSkiBots' own GA4 — getskitickets.com (Colorado Travel Company).
export var GSB_GA4_ID = 'G-JH3FX7ENNT';
// ─────────────────────────────────────────────────────────────────────────────

function isPlaceholderGsbId() {
  return !GSB_GA4_ID || /^G-X+$/i.test(GSB_GA4_ID) || GSB_GA4_ID.indexOf('XXXX') !== -1;
}

var _config = { ga4MeasurementId: '' }; // resort's own GA4 id ('' = off)
// Console-first by default while GSB_GA4_ID is a placeholder, so events log even
// before init() is called. init({ debug }) or setDebug() override this.
var _debug = isPlaceholderGsbId();
// GA transport is OPT-IN: only the production widget bootstrap sets enableGA.
// The prototype, the prospect demo, and the admin tool all leave it false →
// console-only, so they never send events to a real GA property.
var _enableGA = false;
var _gaLoaded = false;
var _gaSendTo = []; // the measurement ids each event is routed to (send_to)

/**
 * Initialise the emitter.
 * @param {{ ga4MeasurementId?: string, debug?: boolean }} [config]
 *   ga4MeasurementId — the RESORT's GA4 id ('' disables their destination).
 *   debug — force console logging on/off. If omitted, console mode auto-enables
 *           while GSB_GA4_ID is still a placeholder (so console-first just works).
 */
export function init(config) {
  config = config || {};
  _config = { ga4MeasurementId: String(config.ga4MeasurementId || '').trim() };
  _debug = (typeof config.debug === 'boolean') ? config.debug : isPlaceholderGsbId();
  _enableGA = config.enableGA === true;
  if (_enableGA) ensureGtag(); // load gtag once, when GA is actually enabled
}

/** Toggle console logging independent of init(). */
export function setDebug(on) { _debug = !!on; }

/**
 * Fire a semantic event to every active destination.
 * @param {string} event  snake_case event name (GA4 convention)
 * @param {object} [props] primitive values only (string/number/bool)
 */
export function track(event, props) {
  if (!event) return;
  props = props || {};

  // Destination 3: console (debug/testing).
  if (_debug) {
    try { console.log('[GSB Analytics] ' + event, props); } catch (e) { /* never throw */ }
  }

  // Destinations 1 & 2: GA4 (GSB always + resort when set).
  // Wired in a later commit; safe no-op until then.
  routeToGA(event, props);
}

// ── GA4 transport (gtag.js) ──────────────────────────────────────────────────
// Loads gtag ONCE, configures every live property, and routes each event to all
// of them via send_to. Ad-blocker safe: every step is guarded; if gtag is
// blocked or fails to load, the widget keeps working with zero thrown errors.

function gtagAvailable() {
  return typeof window !== 'undefined' && typeof window.gtag === 'function';
}

// Which property ids are live: GSB's own (unless still a placeholder) + the
// resort's (when configured). Empty → nothing to send, stay console-only.
function liveMeasurementIds() {
  var ids = [];
  if (!isPlaceholderGsbId()) ids.push(GSB_GA4_ID);
  if (_config.ga4MeasurementId) ids.push(_config.ga4MeasurementId);
  return ids;
}

function ensureGtag() {
  if (_gaLoaded || !_enableGA) return;
  var ids = liveMeasurementIds();
  if (!ids.length) return;            // no real ids yet → console-only
  _gaLoaded = true;
  _gaSendTo = ids;
  try {
    window.dataLayer = window.dataLayer || [];
    window.gtag = window.gtag || function () { window.dataLayer.push(arguments); };
    window.gtag('js', new Date());
    // Configure each property; suppress auto page_view — we only emit our events.
    ids.forEach(function (id) { window.gtag('config', id, { send_page_view: false }); });
    // Inject gtag.js ONCE (one loader serves all configured properties).
    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(ids[0]);
    s.onerror = function () { /* blocked by an ad blocker — stay silent, no throw */ };
    (document.head || document.documentElement).appendChild(s);
  } catch (e) { /* never throw */ }
}

function routeToGA(event, props) {
  ensureGtag();                       // lazy: picks up a resort id set after first events
  if (!_gaSendTo.length) return;      // console-only (no live ids)
  try {
    if (!gtagAvailable()) return;     // blocked / not loaded → drop silently
    var payload = {};
    for (var k in props) { if (Object.prototype.hasOwnProperty.call(props, k)) payload[k] = props[k]; }
    payload.send_to = _gaSendTo;      // one event → all live GA4 properties
    window.gtag('event', event, payload);
  } catch (e) { /* never throw — ad-blocker safe */ }
}

export var analytics = { init: init, track: track, setDebug: setDebug };

// Convenience for testing: flip console logging from the browser console, even
// after GSB_GA4_ID is a real id (which turns the default logging off). Sending
// to GA is unaffected — this only controls the [GSB Analytics] console output.
//   e.g.  gsbAnalyticsDebug(true)
if (typeof window !== 'undefined') window.gsbAnalyticsDebug = setDebug;

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
// TODO(Brandon): replace this placeholder with the real GSB GA4 id before GA goes live.
export var GSB_GA4_ID = 'G-XXXXXXXXXX'; // <-- PLACEHOLDER — fill me in
// ─────────────────────────────────────────────────────────────────────────────

function isPlaceholderGsbId() {
  return !GSB_GA4_ID || /^G-X+$/i.test(GSB_GA4_ID) || GSB_GA4_ID.indexOf('XXXX') !== -1;
}

var _config = { ga4MeasurementId: '' }; // resort's own GA4 id ('' = off)
// Console-first by default while GSB_GA4_ID is a placeholder, so events log even
// before init() is called. init({ debug }) or setDebug() override this.
var _debug = isPlaceholderGsbId();

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
  // GA transport is initialised in a later step; console mode is live now.
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

// Placeholder for the GA transport (added in a separate, later step). Kept as a
// no-op so the emitter is complete and usable in console-only mode today.
function routeToGA(event, props) {
  /* GA transport added in a later commit (gtag send_to routing). */
}

export var analytics = { init: init, track: track, setDebug: setDebug };

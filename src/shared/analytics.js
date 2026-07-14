/* GetSkiBots — analytics event layer.
 *
 * A thin, framework-agnostic *semantic* event emitter. One call —
 * analytics.track('widget_opened', { entry_point: 'bubble' }) — fans out to up
 * to four destinations:
 *   1. the browser `dataLayer`        (ALWAYS — so ANY Google Tag Manager
 *      container, the resort's or a parent page's, can trigger on chat events)
 *   2. GetSkiBots' own GA4 property    (ALWAYS — hardcoded GSB_GA4_ID below)
 *   3. the resort's own analytics      (their GA4 *or* GTM container — see below)
 *   4. the browser console            (debug/testing)
 *
 * The resort's id is auto-detected by prefix:
 *   • `G-XXXXXXXXXX`  → GA4 measurement id (events go straight to their GA4)
 *   • `GTM-XXXXXXX`   → GTM container id (their container loads + routes events,
 *                        via the imported chat-events template — see docs/GTM-EVENTS.md)
 *
 * dataLayer is pushed ALWAYS; external scripts (gtag.js / gtm.js) load only when
 * enableGA is set (production bootstrap), so the prototype/demo stay console-only.
 *
 * Ad-blocker safe: every external call is guarded; if a script is blocked or
 * absent the widget keeps working with zero thrown errors.
 *
 * Usage:
 *   analytics.init({ analyticsId: 'G-RESORT123', enableGA: true })   // or 'GTM-XXXX'
 *   analytics.track('message_sent', { turn_number: 3 })
 *   analytics.setDebug(true)
 */

// ─────────────────────────────────────────────────────────────────────────────
// GetSkiBots' own GA4 measurement id — ALWAYS receives every event.
// Hardcoded in the widget (NOT stored in BotScrew). Only the resort's id is
// configurable via gsbAppearance.analytics.
// The DEDICATED Get Ski Bots property (widget telemetry across all resorts) —
// NOT the getskitickets.com website property (G-JH3FX7ENNT), so widget events
// never pollute the website's analytics.
export var GSB_GA4_ID = 'G-BN9CX96J18';
// ─────────────────────────────────────────────────────────────────────────────

function isPlaceholderGsbId() {
  return !GSB_GA4_ID || /^G-X+$/i.test(GSB_GA4_ID) || GSB_GA4_ID.indexOf('XXXX') !== -1;
}
function isGtmId(id) { return /^GTM-[\w-]+$/i.test(String(id || '').trim()); }
function isGa4Id(id) { var s = String(id || '').trim(); return /^G-[\w-]+$/i.test(s) && !isGtmId(s); }

var _resortId = ''; // the resort's own analytics id — GA4 (G-…) OR GTM (GTM-…); '' = off
var _debug = isPlaceholderGsbId();
var _includeGsb = true;  // fire GSB's own GA4 too (false = isolated test → only the resort id)
var _enableGA = false;   // OPT-IN: only the production bootstrap loads external scripts
var _gaLoaded = false;
var _gtmLoaded = false;
var _gaSendTo = [];      // GA4 property ids each event routes to (send_to)

/**
 * Initialise the emitter.
 * @param {{ analyticsId?: string, ga4MeasurementId?: string, debug?: boolean, enableGA?: boolean }} [config]
 *   analyticsId — the RESORT's GA4 id (G-…) or GTM container id (GTM-…). '' = off.
 *                 `ga4MeasurementId` accepted as a legacy alias.
 *   enableGA    — load external scripts (gtag/gtm). Prototype/demo leave false.
 */
export function init(config) {
  config = config || {};
  _resortId = String(config.analyticsId || config.ga4MeasurementId || '').trim();
  _debug = (typeof config.debug === 'boolean') ? config.debug : isPlaceholderGsbId();
  _includeGsb = config.includeGsb !== false;
  _enableGA = config.enableGA === true;
  if (_enableGA) ensureTransports();
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

  // Destination 4: console (debug/testing).
  if (_debug) {
    try { console.log('[GSB Analytics] ' + event, props); } catch (e) { /* never throw */ }
  }

  // Destination 1: dataLayer — ALWAYS. Prefixed `gsb_` so a GTM container can
  // trigger on our events cleanly (see docs/GTM-EVENTS.md). Just an array push;
  // harmless even with no GTM present, and needs no external script.
  pushDataLayer(event, props);

  // Destinations 2 & 3: GA4 via gtag (GSB always + the resort's GA4 when a G- id).
  routeToGA(event, props);
}

// ── dataLayer (GTM) transport ────────────────────────────────────────────────
function ensureDataLayer() {
  if (typeof window === 'undefined') return null;
  window.dataLayer = window.dataLayer || [];
  return window.dataLayer;
}
function pushDataLayer(event, props) {
  try {
    var dl = ensureDataLayer();
    if (!dl) return;
    var payload = { event: 'gsb_' + event };
    for (var k in props) { if (Object.prototype.hasOwnProperty.call(props, k)) payload[k] = props[k]; }
    dl.push(payload);
  } catch (e) { /* never throw */ }
}

// ── external transports (opt-in via enableGA) ────────────────────────────────
function ensureTransports() {
  if (!_enableGA || typeof window === 'undefined') return;
  ensureGtag();        // GSB's GA4 (+ the resort's GA4 when they gave a G- id)
  ensureResortGtm();   // the resort's GTM container when they gave a GTM- id
}

// Which GA4 property ids fire via gtag: GSB's own + the resort's IF it's a GA4 id.
function liveMeasurementIds() {
  var ids = [];
  if (_includeGsb && !isPlaceholderGsbId()) ids.push(GSB_GA4_ID);
  if (isGa4Id(_resortId)) ids.push(_resortId);
  return ids;
}

function ensureGtag() {
  if (_gaLoaded) return;
  var ids = liveMeasurementIds();
  if (!ids.length) return;            // no real GA4 ids yet → nothing to load
  _gaLoaded = true;
  _gaSendTo = ids;
  try {
    window.dataLayer = window.dataLayer || [];
    window.gtag = window.gtag || function () { window.dataLayer.push(arguments); };
    window.gtag('js', new Date());
    ids.forEach(function (id) { window.gtag('config', id, { send_page_view: false }); });
    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(ids[0]);
    s.onerror = function () { /* blocked → stay silent */ };
    (document.head || document.documentElement).appendChild(s);
  } catch (e) { /* never throw */ }
}

// Load the resort's GTM container (their tags + the imported chat-events template
// route our dataLayer events wherever they want: GA4, Ads, Meta Pixel, …).
function ensureResortGtm() {
  if (_gtmLoaded || !isGtmId(_resortId)) return;
  _gtmLoaded = true;
  try {
    var id = _resortId;
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({ 'gtm.start': (new Date()).getTime(), event: 'gtm.js' });
    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtm.js?id=' + encodeURIComponent(id);
    s.onerror = function () { /* blocked → stay silent */ };
    (document.head || document.documentElement).appendChild(s);
  } catch (e) { /* never throw */ }
}

function gtagAvailable() {
  return typeof window !== 'undefined' && typeof window.gtag === 'function';
}

function routeToGA(event, props) {
  if (_enableGA) ensureTransports(); // lazy: picks up a resort id set after first events
  if (!_gaSendTo.length) return;      // no live GA4 ids → dataLayer/console only
  try {
    if (!gtagAvailable()) return;     // blocked / not loaded → drop silently
    var payload = {};
    for (var k in props) { if (Object.prototype.hasOwnProperty.call(props, k)) payload[k] = props[k]; }
    payload.send_to = _gaSendTo;      // one event → all live GA4 properties
    window.gtag('event', event, payload);
  } catch (e) { /* never throw — ad-blocker safe */ }
}

export var analytics = { init: init, track: track, setDebug: setDebug };

// Convenience for testing: flip console logging from the browser console.
//   e.g.  gsbAnalyticsDebug(true)
if (typeof window !== 'undefined') window.gsbAnalyticsDebug = setDebug;

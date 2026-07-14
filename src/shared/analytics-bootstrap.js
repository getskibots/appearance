/* Analytics bootstrap — turns the console-first event layer into LIVE transport.
 * =============================================================================
 * The event layer (analytics.js) is console-first: it pushes to dataLayer +
 * console but never loads gtag/gtm until something opts in. This is that opt-in.
 *
 * PRODUCTION (BotScrew runtime / GSB loader) — enable for real, per bot:
 *   bootstrapAnalytics({ analyticsId: bot.gsbAppearance.analytics.ga4MeasurementId, enableGA: true });
 *   // → GSB's own GA4 fires + the resort's GA4/GTM (when they set one).
 *
 * TESTING — opt in with a URL param, so the PUBLIC demo stays console-first and
 * only YOU trigger live sends:
 *   ?ga=1            → turn analytics ON — GSB's own GA4 fires (watch it in Realtime)
 *   ?ga=G-XXXXXXXXXX → also route to that GA4 property
 *   ?ga=GTM-XXXXXXX  → also load that GTM container
 *   &gadebug=1       → also log every event to the console
 * =============================================================================
 */
import { analytics } from './analytics.js';

export function bootstrapAnalytics(opts) {
  opts = opts || {};
  var cfg = {
    analyticsId: opts.analyticsId || '',
    enableGA: opts.enableGA === true,
    debug: opts.debug,
  };

  // URL-param test opt-in (never affects the demo unless the param is present).
  try {
    var p = new URLSearchParams(location.search);
    var q = p.get('ga');
    if (q) {
      cfg.enableGA = true;
      if (q !== '1') cfg.analyticsId = q; // a specific GA4/GTM id, else just GSB's own
      if (p.get('gadebug') === '1') cfg.debug = true;
    }
  } catch (e) { /* no-op */ }

  analytics.init(cfg);
  return cfg;
}

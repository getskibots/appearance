/* GetSkiBots — weather composition.
   Turns the dashboard's integration SELECTION (localStorage
   'gsb-weather-integrations-v1') into the data the chat widget renders.

   WEATHER comes from Open-Meteo (global, coordinate-based — the always-on floor so
   the card never empties). LIVE STATUS (base depth / new snow / lifts / trails)
   comes from SnoCountry. Direct Feed (a resort's own API) will join both through
   the server-side proxy — deferred (CORS/secrets).

   Store shape (written by the Weather tab):
     { 'open-meteo': {enabled},
       'snocountry': {enabled, resortId, key?},
       'direct-feed':{enabled, ...} }
   Open-Meteo's coords live separately in 'gsb-weather-config-v1'. */

import { fetchOpenMeteo } from './open-meteo.js';
import { fetchSnoCountry } from './snocountry.js';

const STORE = 'gsb-weather-integrations-v1';

export function readIntegrations() {
  try { return JSON.parse(localStorage.getItem(STORE) || '{}') || {}; }
  catch (e) { return {}; }
}
function on(cfg, id) { return !!(cfg && cfg[id] && cfg[id].enabled); }

// Fetch enabled sources and compose. `coords` = resolved base/summit for Open-Meteo.
// Returns { weather: { base, summit }, liveStatus, sources: [] }.
export async function composeConditions(cfg, coords) {
  cfg = cfg || {};
  const out = { weather: { base: null, summit: null }, liveStatus: null, sources: [] };

  // ---- WEATHER — Open-Meteo (baseline: ON by default, off only if explicitly disabled) ----
  const omOn = cfg['open-meteo'] ? cfg['open-meteo'].enabled !== false : true;
  if (omOn && coords && coords.base) {
    const [base, summit] = await Promise.all([
      fetchOpenMeteo({ lat: coords.base.lat, lng: coords.base.lng, elevationFt: coords.base.elevFt, name: 'Base' }).catch(() => null),
      coords.summit
        ? fetchOpenMeteo({ lat: coords.summit.lat, lng: coords.summit.lng, elevationFt: coords.summit.elevFt, name: 'Summit' }).catch(() => null)
        : Promise.resolve(null)
    ]);
    if (base) { out.weather.base = base; out.sources.push('open-meteo'); }
    out.weather.summit = summit || null;
  }

  // ---- LIVE STATUS — SnoCountry ----
  const sc = cfg['snocountry'];
  if (on(cfg, 'snocountry') && sc && sc.resortId) {
    try {
      out.liveStatus = await fetchSnoCountry(sc.resortId, sc.key);
      if (out.liveStatus) out.sources.push('snocountry');
    } catch (e) { /* no live status this cycle */ }
  }

  return out;
}

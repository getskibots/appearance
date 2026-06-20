/* GetSkiBots — OpenSnow adapter (Weather/Forecast source).
   OpenSnow's `snow-detail` response is already shaped like our normalized model
   (forecast_current / hourly / semi_daily / snow_daily / snow_summary, imperial
   units, our conditions_id vocab) — so this is a light passthrough: validate,
   attach location meta + attribution, and stamp a monochrome icon per row.

   ⚠️ LICENSE REQUIREMENT (OpenSnow): you MUST show "Powered by OpenSnow" branding
   ABOVE the data and a "View …" link BELOW it — both come from `attribution`
   (description, image_light_url/image_dark_url, link_url, link_text). Pass it
   through and render it; do not strip it.

   Endpoint: https://api.opensnow.com/forecast/snow-detail/{locationId}?api_key=…&v=1
   The api_key is a LICENSED credential — server-side/vault in production, never
   committed in real deployments.

   Input  : the snow-detail JSON.
   Output : normalized model (or null if unusable). */

import { conditionIcon } from './open-meteo.js';

function stamp(row) {
  if (!row) return row;
  return Object.assign({}, row, { icon_svg: conditionIcon(row.conditions_id, row.day_period) });
}

export function normalizeOpenSnow(json) {
  if (!json || !json.forecast_current) return null;
  return {
    source: 'opensnow',
    location: {
      id: json.id, slug: json.slug, name: json.name,
      timezone: json.timezone, elevation: json.elevation, coordinates: json.coordinates
    },
    attribution: json.attribution || null,         // REQUIRED to display
    forecast_current: stamp(json.forecast_current),
    forecast_hourly: (json.forecast_hourly || []).map(stamp),
    forecast_semi_daily: (json.forecast_semi_daily || []).map(stamp),
    forecast_snow_daily: json.forecast_snow_daily || [],
    forecast_snow_summary: json.forecast_snow_summary || []
  };
}

// Render a snow range the OpenSnow way: a single figure when min===max, else "min-max".
export function snowRange(min, max) {
  if (min == null && max == null) return null;
  const lo = min == null ? max : min, hi = max == null ? min : max;
  return lo === hi ? String(lo) : lo + '-' + hi;
}

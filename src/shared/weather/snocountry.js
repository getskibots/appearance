/* GetSkiBots — SnoCountry adapter (Live Status source).
   Normalizes a SnoCountry `getSnowReport` item into the GSB **Live Status** model:
   the operator-reported layer (snow + lifts/trails + surface/status) that a weather
   model can't produce. Pure: takes raw JSON, returns the normalized shape. NO fetch,
   NO key — the SnoCountry apiKey lives server-side (proxy/vault), never here.

   SnoCountry is an aggregator: one key → hundreds of resorts by numeric id, one
   standardized schema. So this single adapter covers every SnoCountry resort.

   Input  : the getSnowReport response `{ items:[ {...} ] }` (or a bare item).
   Output : normalized Live Status (or null if unusable). Missing/empty → null so
            the card can hide that cell rather than render junk. */

// SnoCountry numbers arrive as STRINGS, frequently empty off-season.
function num(v) {
  if (v == null || v === '') return null;
  const n = parseFloat(String(v).replace(/[^0-9.\-]/g, ''));
  return Number.isFinite(n) ? n : null;
}
function str(v) {
  if (v == null) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
}
// Several fields come as a min/max pair (base depth, new snow). Collapse to a single
// representative figure (the max — the conventional "reported" number) but keep the range.
function range(min, max) {
  const lo = num(min), hi = num(max);
  if (lo == null && hi == null) return null;
  return { value: hi != null ? hi : lo, min: lo, max: hi };
}
// open/total pair → { open, total }, null only when BOTH are missing.
function pair(open, total) {
  const o = num(open), t = num(total);
  return (o == null && t == null) ? null : { open: o, total: t };
}

export function normalizeSnoCountry(input) {
  if (!input) return null;
  const r = input.items ? input.items[0] : input;
  if (!r || r.id == null) return null;

  const baseDepth = range(r.avgBaseDepthMin, r.avgBaseDepthMax);
  const newSnow   = range(r.newSnowMin, r.newSnowMax);

  return {
    source: 'snocountry',
    resort_id:   str(r.id),
    resort_name: str(r.resortName),
    report_time: str(r.reportDateTime),
    operating_status: str(r.operatingStatus),     // "Open" | "Open for Events/Activities" | ...
    is_open: /open/i.test(r.operatingStatus || '') && !/closed/i.test(r.operatingStatus || ''),

    // ----- Snow (inches) -----
    surface:      str(r.primarySurfaceCondition),
    base_depth:   baseDepth ? baseDepth.value : null,
    base_depth_range: baseDepth,
    new_snow_24h: newSnow ? newSnow.value : null,
    new_snow_48h: num(r.snowLast48Hours),
    snow_comments: str(r.snowComments),

    // ----- Operations (open / total) -----
    lifts:  pair(r.openDownHillLifts,  r.maxOpenDownHillLifts),
    trails: pair(r.openDownHillTrails,  r.maxOpenDownHillTrails),
    acres:  pair(r.openDownHillAcres,   r.maxOpenDownHillAcres),
    miles:  pair(r.openDownHillMiles,   r.maxOpenDownHillMiles),
    open_percent: num(r.openDownHillPercent),
    night_skiing: str(r.nightSkiing),

    // ----- SnoCountry's only "weather": a forecast label + wind DIRECTION (no temps) -----
    forecast_today: {
      condition: str(r.weatherToday_Condition),
      wind_dir:  str(r.weatherToday_WindDirection)
    },

    attribution: { source: 'snocountry', name: 'SnoCountry', link_text: 'SnoCountry' }
  };
}

// Field catalog this source can fill — drives the "assign field → cell" UX later.
export const SNOCOUNTRY_FIELDS = [
  { key: 'base_depth',       label: 'Base Depth',   unit: '"' },
  { key: 'new_snow_24h',     label: 'New Snow 24h', unit: '"' },
  { key: 'new_snow_48h',     label: 'New Snow 48h', unit: '"' },
  { key: 'surface',          label: 'Surface' },
  { key: 'lifts',            label: 'Lifts Open',   render: 'open_total' },
  { key: 'trails',           label: 'Trails Open',  render: 'open_total' },
  { key: 'acres',            label: 'Acres Open',   render: 'open_total' },
  { key: 'operating_status', label: 'Status' }
];

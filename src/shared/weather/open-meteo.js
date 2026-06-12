/* GetSkiBots — Open-Meteo weather adapter (shared).
   Single source of truth for live conditions, used by BOTH the Weather config
   dashboard (weather.html) and the embeddable chat widget (src/widget).

   fetchOpenMeteo({ lat, lng, elevationFt?, name? }) → normalized model:
     { resort, forecast_current, forecast_hourly, forecast_semi_daily,
       forecast_snow_daily, forecast_snow_summary, attribution }

   Temps are returned in °F, wind in mph (Open-Meteo does the unit conversion).
   Lifted from the weather.html prototype's inline fetchOM so the two can't drift. */

// ---- unit helpers -------------------------------------------------------
export const mToFt = m => m == null ? null : Math.round(m * 3.28084);
export const ftToM = ft => ft == null ? null : Math.round(ft / 3.28084);

export const dirToCompass = (deg) => {
  if (deg == null) return null;
  const dirs = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];
  return dirs[Math.round(deg / 22.5) % 16];
};

// ---- WMO weather code → conditions vocabulary ---------------------------
// conditions_id: 10=Cloudy 11=Mostly Sunny/Clear 12=Partly Cloudy
// 13=Mostly Cloudy/Fog 14=Sunny/Clear 15=Snow 16=Storms 17=Rain 18=Freezing
const WMO_TO_CONDITIONS = {
  0:  { id: 14, label_day: 'Sunny',       label_night: 'Clear',          icon: '☀️' },
  1:  { id: 11, label_day: 'Mostly Sunny',label_night: 'Mostly Clear',   icon: '🌤️' },
  2:  { id: 12, label_day: 'Partly Cloudy',label_night: 'Partly Cloudy', icon: '⛅' },
  3:  { id: 10, label_day: 'Cloudy',      label_night: 'Cloudy',         icon: '☁️' },
  45: { id: 13, label_day: 'Fog',         label_night: 'Fog',            icon: '🌫️' },
  48: { id: 13, label_day: 'Rime Fog',    label_night: 'Rime Fog',       icon: '🌫️' },
  51: { id: 17, label_day: 'Light Drizzle',label_night: 'Light Drizzle', icon: '🌦️', precip: 1 },
  53: { id: 17, label_day: 'Drizzle',     label_night: 'Drizzle',        icon: '🌦️', precip: 1 },
  55: { id: 17, label_day: 'Heavy Drizzle',label_night:'Heavy Drizzle',  icon: '🌧️', precip: 1 },
  56: { id: 18, label_day: 'Freezing Drizzle',label_night:'Freezing Drizzle',icon:'🌨️', precip: 3 },
  57: { id: 18, label_day: 'Freezing Drizzle',label_night:'Freezing Drizzle',icon:'🌨️', precip: 3 },
  61: { id: 17, label_day: 'Light Rain',  label_night: 'Light Rain',     icon: '🌦️', precip: 1 },
  63: { id: 17, label_day: 'Rain',        label_night: 'Rain',           icon: '🌧️', precip: 1 },
  65: { id: 17, label_day: 'Heavy Rain',  label_night: 'Heavy Rain',     icon: '🌧️', precip: 1 },
  66: { id: 18, label_day: 'Freezing Rain',label_night:'Freezing Rain',  icon: '🌨️', precip: 3 },
  67: { id: 18, label_day: 'Freezing Rain',label_night:'Freezing Rain',  icon: '🌨️', precip: 3 },
  71: { id: 15, label_day: 'Light Snow',  label_night: 'Light Snow',     icon: '🌨️', precip: 2 },
  73: { id: 15, label_day: 'Snow',        label_night: 'Snow',           icon: '❄️', precip: 2 },
  75: { id: 15, label_day: 'Heavy Snow',  label_night: 'Heavy Snow',     icon: '❄️', precip: 2 },
  77: { id: 15, label_day: 'Snow Grains', label_night: 'Snow Grains',    icon: '🌨️', precip: 2 },
  80: { id: 17, label_day: 'Light Showers',label_night:'Light Showers',  icon: '🌦️', precip: 1 },
  81: { id: 17, label_day: 'Showers',     label_night: 'Showers',        icon: '🌧️', precip: 1 },
  82: { id: 17, label_day: 'Heavy Showers',label_night:'Heavy Showers',  icon: '🌧️', precip: 1 },
  85: { id: 15, label_day: 'Snow Showers',label_night: 'Snow Showers',   icon: '🌨️', precip: 2 },
  86: { id: 15, label_day: 'Heavy Snow Showers',label_night:'Heavy Snow Showers',icon:'❄️',precip: 2 },
  95: { id: 16, label_day: 'Thunderstorms',label_night:'Thunderstorms',  icon: '⛈️', precip: 3 },
  96: { id: 16, label_day: 'Storms w/ Hail',label_night:'Storms w/ Hail',icon: '⛈️', precip: 3 },
  99: { id: 16, label_day: 'Severe Storms',label_night: 'Severe Storms', icon: '⛈️', precip: 3 }
};

export function wmoToConditions(wmo, dayPeriod) {
  const m = WMO_TO_CONDITIONS[wmo];
  if (!m) return { conditions_id: null, conditions_label: `Code ${wmo}`, icon_emoji: '❓', precip_type: 0 };
  return {
    conditions_id: m.id,
    conditions_label: dayPeriod === 'night' ? m.label_night : m.label_day,
    icon_emoji: m.icon,
    precip_type: m.precip ?? 0
  };
}

// ---- date helpers -------------------------------------------------------
function localTimeLabel(iso, tz) {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    const opts = { hour: 'numeric', hour12: true };
    if (tz) opts.timeZone = tz;
    return d.toLocaleTimeString('en-US', opts).replace(' ', '').toLowerCase();
  } catch (_) { return ''; }
}
function dayLabel(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' });
  } catch (_) { return iso; }
}

// ---- main adapter -------------------------------------------------------
// Accepts elevationFt (preferred) or elevationM; converts to meters for the API.
export async function fetchOpenMeteo({ lat, lng, elevationFt = null, elevationM = null, name = null }) {
  const elevM = elevationM != null ? elevationM : ftToM(elevationFt);

  const params = new URLSearchParams({
    latitude: lat, longitude: lng,
    current: 'temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,cloud_cover,pressure_msl,wind_speed_10m,wind_direction_10m,wind_gusts_10m,freezing_level_height,uv_index',
    hourly: 'temperature_2m,precipitation_probability,weather_code,wind_speed_10m,wind_direction_10m,is_day,freezing_level_height',
    daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,snowfall_sum,wind_speed_10m_max,wind_direction_10m_dominant',
    temperature_unit: 'fahrenheit',
    wind_speed_unit: 'mph',
    precipitation_unit: 'inch',
    timezone: 'auto',
    forecast_days: 7
  });
  if (elevM) params.set('elevation', elevM);

  const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`);
  if (!res.ok) throw new Error(`Open-Meteo returned ${res.status}`);
  const data = await res.json();
  const c = data.current;

  const cond = wmoToConditions(c.weather_code, c.is_day ? 'day' : 'night');
  // Practical heuristic: snow level ≈ freezing level − 200ft
  const snowLevelFt = c.freezing_level_height != null
    ? Math.max(0, mToFt(c.freezing_level_height) - 200)
    : null;

  const forecast_current = {
    display_at: new Date().toISOString(),
    display_at_local_label: localTimeLabel(c.time, data.timezone),
    day_period: c.is_day ? 'day' : 'night',
    conditions_id: cond.conditions_id,
    conditions_label: cond.conditions_label,
    icon_emoji: cond.icon_emoji,
    temp: Math.round(c.temperature_2m),
    apparent_temp: Math.round(c.apparent_temperature),
    wind_dir: c.wind_direction_10m,
    wind_dir_label: dirToCompass(c.wind_direction_10m),
    wind_speed: Math.round(c.wind_speed_10m),
    wind_gust_speed: Math.round(c.wind_gusts_10m),
    pop: null,
    precip_type: cond.precip_type,
    snow_level: snowLevelFt,
    uv: c.uv_index != null ? Math.round(c.uv_index) : null,
    humidity: Math.round(c.relative_humidity_2m),
    pressure_mb: Math.round(c.pressure_msl),
    _native: { modelElevM: Math.round(data.elevation), userElevM: elevM != null ? Number(elevM) : null, timezone: data.timezone }
  };

  // Hourly: 24 entries starting at the current hour
  const hourlyRaw = data.hourly || {};
  const nowMs = Date.now();
  const startIdx = (hourlyRaw.time || []).findIndex(t => new Date(t).getTime() >= nowMs - 60 * 60 * 1000);
  const idxStart = Math.max(0, startIdx);
  const forecast_hourly = [];
  for (let i = idxStart; i < idxStart + 24 && i < (hourlyRaw.time || []).length; i++) {
    const isDayHour = hourlyRaw.is_day?.[i];
    const hcond = wmoToConditions(hourlyRaw.weather_code?.[i], isDayHour ? 'day' : 'night');
    const hSnowLvl = hourlyRaw.freezing_level_height?.[i] != null
      ? Math.max(0, mToFt(hourlyRaw.freezing_level_height[i]) - 200)
      : null;
    forecast_hourly.push({
      display_at: hourlyRaw.time[i],
      display_at_local_label: localTimeLabel(hourlyRaw.time[i], data.timezone),
      day_period: isDayHour ? 'day' : 'night',
      conditions_id: hcond.conditions_id,
      conditions_label: hcond.conditions_label,
      icon_emoji: hcond.icon_emoji,
      temp: Math.round(hourlyRaw.temperature_2m[i]),
      wind_dir: hourlyRaw.wind_direction_10m?.[i],
      wind_dir_label: dirToCompass(hourlyRaw.wind_direction_10m?.[i]),
      wind_speed: Math.round(hourlyRaw.wind_speed_10m?.[i]),
      pop: hourlyRaw.precipitation_probability?.[i] != null ? hourlyRaw.precipitation_probability[i] / 100 : null,
      precip_type: hcond.precip_type,
      snow_level: hSnowLvl
    });
  }

  // Daily → semi-daily + snow daily
  const dailyRaw = data.daily || {};
  const forecast_semi_daily = [];
  const forecast_snow_daily = [];
  for (let i = 0; i < (dailyRaw.time || []).length; i++) {
    const wcond = wmoToConditions(dailyRaw.weather_code?.[i], 'day');
    forecast_semi_daily.push({
      display_at: dailyRaw.time[i],
      display_at_local_label: dayLabel(dailyRaw.time[i]),
      day_period: 'day',
      conditions_id: wcond.conditions_id,
      conditions_label: wcond.conditions_label,
      icon_emoji: wcond.icon_emoji,
      temp_max: Math.round(dailyRaw.temperature_2m_max[i]),
      temp_min: Math.round(dailyRaw.temperature_2m_min[i]),
      wind_speed: Math.round(dailyRaw.wind_speed_10m_max[i]),
      wind_dir_label: dirToCompass(dailyRaw.wind_direction_10m_dominant?.[i]),
      pop: dailyRaw.precipitation_probability_max?.[i] != null ? dailyRaw.precipitation_probability_max[i] / 100 : null
    });
    forecast_snow_daily.push({
      display_at: dailyRaw.time[i],
      display_at_local_label: dayLabel(dailyRaw.time[i]),
      precip_snow: dailyRaw.snowfall_sum?.[i] || 0,
      precip_snow_min: dailyRaw.snowfall_sum?.[i] || 0,
      precip_snow_max: dailyRaw.snowfall_sum?.[i] || 0
    });
  }

  const snowSum = forecast_snow_daily.slice(0, 5).reduce((a, d) => a + (d.precip_snow || 0), 0);
  const forecast_snow_summary = [{
    display_at_local_label: 'Next 1-5 Days',
    precip_snow: Math.round(snowSum * 10) / 10,
    precip_snow_min: Math.round(snowSum * 10) / 10,
    precip_snow_max: Math.round(snowSum * 10) / 10,
    period_count: 5
  }];

  return {
    resort: {
      name: name || `${lat},${lng}`,
      coordinates: { point: [parseFloat(lng), parseFloat(lat)] },
      elevation: elevationFt,
      timezone: data.timezone
    },
    forecast_current,
    forecast_hourly,
    forecast_semi_daily,
    forecast_snow_daily,
    forecast_snow_summary,
    attribution: {
      source: 'open-meteo',
      link_url: 'https://open-meteo.com/',
      link_text: 'Open-Meteo',
      description: 'Weather data by Open-Meteo.com'
    }
  };
}

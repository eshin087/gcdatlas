// GET /api/weather: the weather over the three launch sites (Starbase, Cape Canaveral, Vandenberg) and, since the cities came (0.14), over the
// centres of the cities (New York, Tokyo, Dubai, London, Paris; since 0.19.0 Hong Kong, San Francisco, Sydney, Rome, Los Angeles, Rio de Janeiro; since 0.20.0 Las Vegas), hour by hour from three days ago to two days ahead, from Open-Meteo (free,
// CC BY 4.0: "Weather data by Open-Meteo.com"). The page draws the clouds, the wind that carries a launch's smoke and the haze from it (0.10.0)
// and each city's own sky. The coordinates are the pads' and the cities' centres, fixed here: nothing about the visitor is sent anywhere.
// One upstream request for all fifteen places. Cached at the edge for 30 minutes. Query strings are refused (see _lib/guard.js).
import { cachedHandler } from './_lib/guard.js';
const SITES = [['starbase', 25.997, -97.158], ['cape', 28.58, -80.59], ['vandenberg', 34.632, -120.611],
  ['newyork', 40.758, -73.9855], ['tokyo', 35.6812, 139.7671], ['dubai', 25.1972, 55.2744], ['london', 51.5074, -0.1278], ['paris', 48.8566, 2.3522],
  ['hongkong', 22.2855, 114.1577], ['sanfrancisco', 37.7915, -122.399], ['sydney', -33.861, 151.2108], ['rome', 41.8961, 12.4823], ['losangeles', 34.0522, -118.2437], ['rio', -22.935, -43.18],
  ['lasvegas', 36.1155, -115.1722]];
const VARS = { low:'cloud_cover_low', mid:'cloud_cover_mid', high:'cloud_cover_high', ws:'wind_speed_10m', wd:'wind_direction_10m', ws850:'wind_speed_850hPa', wd850:'wind_direction_850hPa',
  vis:'visibility', rain:'precipitation', code:'weather_code', rh:'relative_humidity_2m', temp:'temperature_2m' };
const SRC = 'https://api.open-meteo.com/v1/forecast?latitude=' + SITES.map(s => s[1]).join(',') + '&longitude=' + SITES.map(s => s[2]).join(',') +
  '&hourly=' + Object.values(VARS).join(',') + '&past_days=3&forecast_days=2&wind_speed_unit=ms&timezone=GMT&timeformat=unixtime';
// (whole numbers for percentages, codes and metres of visibility; one decimal for wind, rain and the temperature in degrees Celsius)
const round = (k, v) => v == null ? null : k === 'ws' || k === 'ws850' || k === 'rain' || k === 'temp' ? Math.round(v*10)/10 : Math.round(v);
export default cachedHandler({ what:'weather', minAge:15*60e3, sMaxAge:1800, swr:7200, load:async () => {
  const r = await fetch(SRC, { headers:{ 'User-Agent':'gcdatlas (https://gcdatlas.com)' }, signal:AbortSignal.timeout(15000) });
  if (!r.ok) throw new Error('Open-Meteo answered ' + r.status);
  const j = await r.json(), arr = Array.isArray(j) ? j : [j];
  if (arr.length !== SITES.length) throw new Error('Open-Meteo returned ' + arr.length + ' places');
  const sites = {};
  let t0 = null;
  arr.forEach((L, i) => {
    const h = L.hourly || {}; t0 = t0 ?? (h.time && h.time[0]);
    sites[SITES[i][0]] = Object.fromEntries(Object.entries(VARS).map(([k, v]) => [k, (h[v] || []).map(x => round(k, x))]));
  });
  if (t0 == null) throw new Error('Open-Meteo returned no hours');
  return JSON.stringify({ updated:new Date().toISOString(), t0, step:3600, sites });
} });

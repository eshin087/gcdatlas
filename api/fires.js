// GET /api/fires: where the satellites saw fires burning in the last 24 hours, from NASA FIRMS (VIIRS 375 m active fire detections,
// public CSV files, no key; "free and open"). FIRMS's file is about 6 MB and 40 000 detections, so it is read here and added up on a
// 0.1 degree grid (about 11 km): each cell gives its number of detections and their total fire power in megawatts (FRP). Detections
// FIRMS rates low in confidence are left out. The page draws them as glowing points on the night side and in smoke-grey haze by day (0.15).
// The cells are sorted by power, the strongest first. Cached at the edge for 2 hours (FIRMS adds data within 3 hours of a pass).
// If the first satellite's file fails or is stale the next one is used: NOAA-20, then NOAA-21, then Suomi NPP (whose file has been empty since
// early November 2026). Query strings are refused (see _lib/guard.js).
import { cachedHandler } from './_lib/guard.js';
const BASE = 'https://firms.modaps.eosdis.nasa.gov/data/active_fire/';
const SOURCES = [
  ['VIIRS NOAA-20', BASE + 'noaa-20-viirs-c2/csv/J1_VIIRS_C2_Global_24h.csv'],
  ['VIIRS NOAA-21', BASE + 'noaa-21-viirs-c2/csv/J2_VIIRS_C2_Global_24h.csv'],
  ['VIIRS S-NPP', BASE + 'suomi-npp-viirs-c2/csv/SUOMI_VIIRS_C2_Global_24h.csv'],
];
const CELL = 0.1, NLAT = 1800, NLON = 3600, MAX = 20000, STALE = 30*3600;   // (the newest detection must be under 30 h old)
const num = (v, k) => v >= 10 ? Math.round(v) : Math.round(v*10)/10;
// the file's rows (latitude, longitude, acq_date, acq_time as HHMM in UTC, confidence, frp) added up on the grid, for the 24 hours before its newest detection
function addUp(text){
  const head = text.slice(0, text.indexOf('\n')).trim().split(',');
  const at = n => { const i = head.indexOf(n); if (i < 0) throw new Error('FIRMS file has no ' + n); return i; };
  const iLat = at('latitude'), iLon = at('longitude'), iDate = at('acq_date'), iTime = at('acq_time'), iConf = at('confidence'), iFrp = at('frp');
  const lines = text.split('\n'), n = lines.length - 1;
  const lat = new Float32Array(n), lon = new Float32Array(n), t = new Int32Array(n), frp = new Float32Array(n);
  const days = new Map();
  let m = 0, tmax = 0;
  for (let i = 1; i <= n; i++){
    const p = lines[i].split(',');
    if (p.length <= iFrp) continue;
    const c = p[iConf];
    if (c === 'l' || c === 'low' || (c !== '' && !isNaN(c) && +c < 30)) continue;   // (low confidence: sun glint, noise)
    const la = +p[iLat], lo = +p[iLon], f = +p[iFrp];
    if (!(la >= -90 && la <= 90 && lo >= -180 && lo <= 180) || !isFinite(f)) continue;
    let d = days.get(p[iDate]);
    if (d === undefined){ d = Date.parse(p[iDate] + 'T00:00:00Z')/1000; days.set(p[iDate], d); }
    const hm = p[iTime].padStart(4, '0'), ts = d + (+hm.slice(0, 2))*3600 + (+hm.slice(2, 4))*60;
    if (!isFinite(ts)) continue;
    lat[m] = la; lon[m] = lo; t[m] = ts; frp[m] = Math.max(f, 0); m++;
    if (ts > tmax) tmax = ts;
  }
  const cells = new Map();
  let raw = 0;
  for (let i = 0; i < m; i++){
    if (t[i] <= tmax - 86400) continue;
    const li = Math.min(NLAT - 1, Math.floor((lat[i] + 90)/CELL)), lj = Math.min(NLON - 1, Math.floor((lon[i] + 180)/CELL)), k = li*4096 + lj, v = cells.get(k);
    if (v) { v[0]++; v[1] += frp[i]; } else cells.set(k, [1, frp[i]]);
    raw++;
  }
  // (cell centres in whole hundredths of a degree, so they print as -25.65 and not -25.650000000000002)
  const out = [...cells].map(([k, v]) => [(Math.floor(k/4096)*10 - 9000 + 5)/100, ((k % 4096)*10 - 18000 + 5)/100, v[0], num(v[1])]);
  out.sort((a, b) => b[3] - a[3] || b[2] - a[2]);
  return { tmax, raw, fires:out.slice(0, MAX) };
}
export default cachedHandler({ what:'fire data', minAge:60*60e3, sMaxAge:7200, swr:21600, load:async () => {
  const t0 = Date.now(), now = Math.round(t0/1000);
  for (const [name, url] of SOURCES){
    const left = 9000 - (Date.now() - t0);
    if (left < 2000) break;
    try {
      const r = await fetch(url, { headers:{ 'User-Agent':'gcdatlas (https://gcdatlas.com; github eshin087/gcdatlas)' }, signal:AbortSignal.timeout(Math.min(left, 7500)) });
      if (!r.ok) throw new Error(name + ' answered ' + r.status);
      const { tmax, raw, fires } = addUp(await r.text());
      if (now - tmax > STALE) throw new Error(name + ' is stale');
      if (fires.length < 500) throw new Error(name + ' gave ' + fires.length + ' cells');
      return JSON.stringify({ updated:new Date().toISOString(), source:name, from:tmax - 86400, to:tmax, cell:CELL, raw, n:fires.length, fires });
    } catch (e){ console.error('FIRMS ' + name + ':', e && e.message); }
  }
  throw new Error('no FIRMS file worked');
} });

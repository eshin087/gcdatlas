// GET /api/launches: the next rocket launches worldwide (The Space Devs, Launch Library 2), trimmed to what the page shows.
// Cached at the edge for an hour, which keeps well inside the free API's limits. Query strings are refused (see _lib/guard.js).
import { cachedHandler } from './_lib/guard.js';
const SRC = 'https://ll.thespacedevs.com/2.2.0/launch/upcoming/?limit=15&hide_recent_previous=true';
const num = x => { const v = parseFloat(x); return isFinite(v) ? +v.toFixed(4) : null; };
export default cachedHandler({ what:'launch data', minAge:30*60e3, sMaxAge:3600, swr:21600, load:async () => {
  const r = await fetch(SRC, { headers:{ 'User-Agent':'gcdatlas (https://gcdatlas.vercel.app)' }, signal:AbortSignal.timeout(15000) });
  if (!r.ok) throw new Error('Launch Library answered ' + r.status);
  const j = await r.json();
  const launches = (j.results || []).map(l => ({
    name:String(l.name || '').slice(0, 90),
    net:l.net || null,
    status:(l.status && (l.status.abbrev || l.status.name)) || '',
    provider:String((l.launch_service_provider && l.launch_service_provider.name) || l.lsp_name || '').slice(0, 60),
    rocket:String((l.rocket && l.rocket.configuration && l.rocket.configuration.name) || '').slice(0, 60),
    pad:String((l.pad && l.pad.name) || '').slice(0, 80),
    site:String((l.pad && l.pad.location && l.pad.location.name) || l.location || '').slice(0, 80),
    lat:num(l.pad && l.pad.latitude), lon:num(l.pad && l.pad.longitude),
  })).filter(l => l.net && l.lat != null && l.lon != null);
  return JSON.stringify({ updated:new Date().toISOString(), launches });
} });

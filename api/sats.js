// GET /api/sats: every active satellite (CelesTrak), compacted for the page. Cached at the edge for 6 hours so CelesTrak
// sees a handful of requests a day however many people visit. No input is taken from the request (query strings are refused:
// see _lib/guard.js), so it cannot be used to reach anything else or to hammer CelesTrak.
import { compact } from './_lib/orbits.js';
import { cachedHandler } from './_lib/guard.js';
const SRC = 'https://celestrak.org/NORAD/elements/gp.php?GROUP=active&FORMAT=json';
export default cachedHandler({ what:'satellite data', minAge:2*3600e3, sMaxAge:21600, swr:86400, load:async () => {
  const r = await fetch(SRC, { headers:{ 'User-Agent':'gcdatlas (https://gcdatlas.vercel.app)' }, signal:AbortSignal.timeout(20000) });
  if (!r.ok) throw new Error('CelesTrak answered ' + r.status);
  const records = await r.json();
  if (!Array.isArray(records) || !records.length) throw new Error('no records');
  return JSON.stringify(compact(records, Date.now()));
} });

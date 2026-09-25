// GET /api/sats: every active satellite (CelesTrak), compacted for the page. Cached at the edge for 6 hours so CelesTrak
// sees a handful of requests a day however many people visit. No input is taken from the request, so nothing can be abused.
import { compact } from './_lib/orbits.js';
const SRC = 'https://celestrak.org/NORAD/elements/gp.php?GROUP=active&FORMAT=json';
export default async function handler(req, res){
  try {
    const r = await fetch(SRC, { headers:{ 'User-Agent':'gcdatlas (https://gcdatlas.vercel.app)' }, signal:AbortSignal.timeout(20000) });
    if (!r.ok) throw new Error('CelesTrak answered ' + r.status);
    const records = await r.json();
    if (!Array.isArray(records) || !records.length) throw new Error('no records');
    const body = compact(records, Date.now());
    res.setHeader('Cache-Control', 'public, s-maxage=21600, stale-while-revalidate=86400');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.status(200).send(JSON.stringify(body));
  } catch (e){
    res.setHeader('Cache-Control', 'public, s-maxage=600');
    res.status(502).json({ error:'satellite data unavailable', detail:String(e.message || e).slice(0, 120) });
  }
}

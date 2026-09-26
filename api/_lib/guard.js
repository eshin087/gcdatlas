// Shared protection for the /api functions (see docs/SECURITY.md).
// - Only a plain GET of the bare path is served. Vercel's edge cache keys on the full URL, so a query string
//   (/api/sats?x=1, ?x=2, ...) would make every request a cache miss that runs the function and hits the upstream API.
// - A warm function instance keeps its last good answer for `minAge` ms, and requests that arrive together share one
//   upstream fetch. If the upstream fails, the last good answer is served (marked stale) instead of an error.
export function cachedHandler({ minAge, load, sMaxAge, swr, what }){
  let memo = null, inflight = null;
  return async function handler(req, res){
    if (req.method !== 'GET' && req.method !== 'HEAD'){ res.setHeader('Allow', 'GET, HEAD'); return res.status(405).end(); }
    if ((req.url || '').includes('?')){ res.setHeader('Cache-Control', 'public, s-maxage=86400'); return res.status(404).json({ error:'not found' }); }
    try {
      if (!memo || Date.now() - memo.at > minAge){
        inflight = inflight || load().finally(() => { inflight = null; });
        memo = { at:Date.now(), body:await inflight };
      }
      res.setHeader('Cache-Control', `public, s-maxage=${sMaxAge}, stale-while-revalidate=${swr}`);
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return res.status(200).send(memo.body);
    } catch (e){
      console.error(what + ' upstream failed:', e && e.message);   // (logged for us; not sent to the visitor)
      if (memo){ res.setHeader('Cache-Control', 'public, s-maxage=600'); res.setHeader('Content-Type', 'application/json; charset=utf-8'); return res.status(200).send(memo.body); }
      res.setHeader('Cache-Control', 'public, s-maxage=600');
      return res.status(502).json({ error:what + ' unavailable' });
    }
  };
}

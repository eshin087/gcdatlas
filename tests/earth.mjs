// The real Earth's finer tiles and the ground anywhere (0.12.0), which load only over http: the page is served from dist/ by a small server
// here. The five cities (0.13.0) and a famous place (0.15.0) are drawn with their own layers. Three things Codex's review of #43 found:
//   - on a phone (12 tile slots), the ground near the pole covers more tiles than there are slots: the tile under the camera must still load;
//   - climbing away from the ground and looking elsewhere, the ground's tiles must be let go, so the tiles there load;
//   - with the SpaceX flag off (?flags=-spacex), the ground anywhere must still be drawn, and the clock run in real time at a place.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { openPage, report, ROOT } from './lib.mjs';
const DIST = path.join(ROOT, 'dist'), TYPES = { '.html':'text/html', '.js':'text/javascript', '.json':'application/json', '.webp':'image/webp', '.jpg':'image/jpeg', '.png':'image/png' };
const server = http.createServer((q, r) => {
  let p = decodeURIComponent(q.url.split('?')[0]); if (p === '/') p = '/index.html';
  const f = path.join(DIST, p); if (!f.startsWith(DIST) || !fs.existsSync(f) || fs.statSync(f).isDirectory()){ r.writeHead(404); r.end(); return; }
  r.writeHead(200, { 'Content-Type':TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r);
}).listen(0);
const URL0 = `http://127.0.0.1:${server.address().port}/`;
const errors = [], notes = [];
// wait in real time (fetches and the GPU work happen in the page's own loop) until f() in the page is true
const until = async (page, f, arg, sec, what) => { const t0 = Date.now();
  while (Date.now() - t0 < sec*1000){ if (await page.evaluate(f, arg)) return (Date.now() - t0)/1000; await page.waitForTimeout(500); }
  errors.push('timed out: ' + what); return null; };
const go = (page, name) => page.evaluate(n => { const c = window.__cosmos; c.ssRate = 0; const r = c.epl.find(n)[0]; c.epl.go(r); return r && r[0]; }, name);
try {
  // ---- a phone, near the pole, then away
  { const { browser, page, errors:pe } = await openPage({ phone:true, url:URL0 });
    await page.evaluate(() => window.__cosmos.epl.load());
    await until(page, () => window.__cosmos.epl.state === 2, null, 30, 'the names');
    const where = await go(page, 'murmansk');
    await until(page, () => window.__cosmos.egr.ready, null, 120, 'the ground at ' + where);
    // (the tile under the camera: in once the ground's own tiles are in)
    const under = await until(page, () => { const c = window.__cosmos, d = c.egr.dbg(); return c.etl.heightAt(d.la*Math.PI/180, d.lo*Math.PI/180) != null; }, null, 90, 'the tile under the camera at ' + where);
    const s1 = await page.evaluate(() => { const c = window.__cosmos; return { extra:c.etl.dbg.extra, slots:c.etl.SLOTS, d:c.egr.dbg() }; });
    if (!(s1.extra > s1.slots)) notes.push(`(the ground at ${where} asked for ${s1.extra} tiles, not more than the ${s1.slots} slots)`);
    // (up to 410 km over Australia: the ground lets go of its tiles and Australia's come in)
    await page.evaluate(() => window.__cosmos.egl.lookAt(-25, 135, 0.95, 30));
    await until(page, () => window.__cosmos.etl.dbg.extra === 0, null, 10, 'the ground letting go of its tiles');
    const k = 10*32 + 28;   // (the tile at 25 degrees south, 135 east)
    const there = await until(page, k => window.__cosmos.etl.state.some(t => t.k === k && t.fade > 0), k, 60, "Australia's tile after leaving the ground");
    notes.push(`phone: ${where} ${s1.extra} ground tiles for ${s1.slots} slots, the one under the camera in after ${under} s; away over Australia its tile in after ${there} s`);
    errors.push(...pe); await browser.close(); }
  // ---- a city with its own layers (0.13.0): New York, its towers standing up, its lights, its time and weather
  { const { browser, page, errors:pe } = await openPage({ url:URL0 });
    await page.evaluate(() => window.__cosmos.epl.load());
    await until(page, () => window.__cosmos.epl.state === 2, null, 30, 'the names (city)');
    await page.evaluate(() => { const c = window.__cosmos; c.ssRate = 0; c.epl.go(c.epl.PICKS.cities.find(r => r[0] === 'New York City')); });
    const t = await until(page, () => { const c = window.__cosmos; return !c.flight && c.ect.dbg().env === 'city-newyork'; }, null, 150, 'New York drawn with its own layers');
    const s = await page.evaluate(() => { const c = window.__cosmos, o = c.OBJ[c.orbit.lock]; return { name:o && o.name, ro:o && o.readout ? o.readout() : '', d:c.ect.dbg(), views:o && o.views.length }; });
    if (s.name !== 'New York') errors.push('the place flown to is ' + s.name + ', not New York');
    if (!/local time/.test(s.ro)) errors.push("New York's readout has no local time: " + s.ro);
    if (!(s.d.lights > 0)) errors.push('no tower lights in New York');
    notes.push(`New York drawn with its layers after ${t} s (${s.d.layers.find(x => x.startsWith('newyork'))} in, ${s.d.lights} tower lights, ${s.views} framings)`);
    // (0.14.0: its traffic's road maps drawn, its planes and boats, the readout's runways)
    const tt = await until(page, () => { const c = window.__cosmos, r = c.etr.dbg(), a = c.eas.dbg(); return r.state === 2 && r.nearAt >= 0 && r.farAt >= 0 && a.routes > 0 && a.points > 0 && c.ect.dbg().cityProg; }, null, 90, "New York's traffic, planes and boats");
    const a = await page.evaluate(() => { const c = window.__cosmos, o = c.OBJ[c.orbit.lock]; return { r:c.etr.dbg(), a:c.eas.dbg(), ro:o.readout() }; });
    if (!/planes \(simulated[^)]*\): landing JFK/.test(a.ro)) errors.push("New York's readout does not name the runways in use: " + a.ro);
    if (!(a.r.busy > 0 && a.r.busy <= 1)) errors.push('the traffic is not busy at all: ' + JSON.stringify(a.r));
    notes.push(`traffic after ${tt} s more (${a.r.segs} road segments, busy ${a.r.busy}), ${a.a.airports.join(' ')}, ${a.a.boats} boats on ${a.a.routes} routes, ${a.a.points} lights`);
    // (Paris: the ground drawn with the copy of the shader that has the Eiffel Tower as a model, which compiles only there)
    await page.evaluate(() => { const c = window.__cosmos; c.epl.go(c.epl.PICKS.cities.find(r => r[0] === 'Paris')); });
    const tp = await until(page, () => { const c = window.__cosmos, d = c.ect.dbg(); return !c.flight && d.env === 'city-paris' && d.eiffel; }, null, 150, 'Paris drawn with the Eiffel Tower');
    notes.push(`Paris drawn with the Eiffel Tower after ${tp} s`);
    // (Tokyo: the copy with Tokyo Tower and the Skytree as models)
    await page.evaluate(() => { const c = window.__cosmos; c.epl.go(c.epl.PICKS.cities.find(r => r[0] === 'Tokyo')); });
    const tk = await until(page, () => { const c = window.__cosmos, d = c.ect.dbg(); return !c.flight && d.env === 'city-tokyo' && d.tokyo; }, null, 150, 'Tokyo drawn with its towers');
    notes.push(`Tokyo drawn with Tokyo Tower and the Skytree after ${tk} s`);
    // (0.19.0: Rio de Janeiro, a city of the second batch, drawn with its own layers and Christ the Redeemer's copy of the shader)
    await page.evaluate(() => { const c = window.__cosmos; c.epl.go(c.epl.PICKS.cities.find(r => r[0] === 'Rio de Janeiro')); });
    const tr = await until(page, () => { const c = window.__cosmos, d = c.ect.dbg(); return !c.flight && d.env === 'city-rio' && d.landmark === 'sxEnvRio'; }, null, 150, 'Rio drawn with Christ the Redeemer');
    notes.push(`Rio drawn with Christ the Redeemer after ${tr} s`);
    // (0.22.0: Las Vegas, drawn with its landmarks' copy; the Fountains of Bellagio during a show (Saturday 17 October 2026, 21:02 local
    // time: shows every 15 minutes from 20:00) and not between two (21:10))
    await page.evaluate(() => { const c = window.__cosmos; c.epl.go(c.epl.PICKS.cities.find(r => r[0] === 'Las Vegas')); });
    const tv = await until(page, () => { const c = window.__cosmos, d = c.ect.dbg(); return !c.flight && d.env === 'city-lasvegas' && d.landmark === 'sxEnvLV'; }, null, 150, 'Las Vegas drawn with its landmarks');
    const at = (h, m) => page.evaluate(jd => { const c = window.__cosmos; c.ssRate = 0; c.setDays(jd - (performance.timeOrigin/86400000 + 2440587.5)); }, Date.UTC(2026, 9, 18, h, m)/86400000 + 2440587.5);
    await at(4, 2); const fOn = await until(page, () => window.__cosmos.eas.dbg().fountains > 40, null, 20, 'the fountains during a show');
    await at(4, 10); const fOff = await until(page, () => window.__cosmos.eas.dbg().fountains === 0, null, 20, 'no fountains between shows');
    notes.push(`Las Vegas drawn with its landmarks after ${tv} s; the fountains ${fOn != null && fOff != null ? 'run in a show and rest between' : 'off schedule'}`);
    errors.push(...pe); await browser.close(); }
  // ---- a famous place with its own layers (0.15.0): Everest from the atlas's row, drawn with its own layers, its credits in the readout;
  // the search finds the places by their other names; moved by hand, the camera goes to a place object and Everest's own stays put
  { const { browser, page, errors:pe } = await openPage({ url:URL0 });
    const s0 = await page.evaluate(() => { const c = window.__cosmos, r = c.epl.find('khufu')[0], t = [...document.querySelectorAll('#tourList .trow')].find(b => /wonders of Earth/.test(b.textContent));
      return { n:c.plc.places.length, tour:t ? t.textContent : null, khufu:r && c.epl.ownOf(r) && c.epl.ownOf(r).obj.key }; });
    if (s0.khufu !== 'earth-iconic-giza') errors.push('a search for khufu does not lead to the Pyramids of Giza: ' + s0.khufu);
    if (!s0.tour || !s0.tour.includes(s0.n + ' stops')) errors.push('no tour of the ' + s0.n + ' famous places: ' + s0.tour);
    await page.evaluate(() => { const c = window.__cosmos; c.ssRate = 0; c.epl.go(c.epl.PICKS.mountains.find(r => r[0] === 'Mount Everest')); });
    const t = await until(page, () => { const c = window.__cosmos, p = c.plc.byKey('everest'); return !c.flight && c.plc.dbg().env === 'place-everest' && p.ed.layers.every(L => L.state === 2); }, null, 150, 'Everest drawn with its own layers');
    const s = await page.evaluate(() => { const c = window.__cosmos, o = c.OBJ[c.orbit.lock]; return { key:o && o.key, ro:o && o.readout ? o.readout() : '', views:o && o.views.length, sun:c.egr.dbg().sun, cam:c.plc.dbg().cam, share:c.shareUrl() }; });
    if (s.key !== 'earth-iconic-everest') errors.push('the place flown to is ' + s.key + ', not Everest\'s own');
    // over http the share button copies the place's own page (0.24.0), with the camera carried in the query
    if (!s.share.startsWith(URL0 + 'p/earth-iconic-everest')) errors.push("Everest's share link is not its share page: " + s.share);
    if (!/Copernicus DEM/.test(s.ro) || !/Sentinel/.test(s.ro)) errors.push("Everest's readout has no credits for its images and heights: " + s.ro);
    if (!(s.sun > 10)) errors.push(`Everest was not flown to by day: the Sun ${s.sun} degrees up`);
    const m = await page.evaluate(() => { const c = window.__cosmos, o = c.OBJ[c.orbit.lock], la = o.place.la; c.epl.panKm(o, 30, 0); const n = c.OBJ[c.orbit.lock]; return { moved:n !== o && n.earthSpot && !n.own, stays:o.place.la === la, env:c.plc.dbg().env }; });
    if (!m.moved || !m.stays) errors.push('moving over the ground from Everest: ' + JSON.stringify(m));
    notes.push(`Everest drawn with its ${s.views} framings and all its layers after ${t} s, camera at ${s.cam.join(', ')} km, the Sun ${s.sun} degrees up; ${s0.n} famous places`);
    errors.push(...pe); await browser.close(); }
  // ---- the SpaceX flag off (the ground anywhere: Aconcagua, far from the famous places, which draw their own)
  { const { browser, page, errors:pe } = await openPage({ url:URL0 + '?flags=-spacex' });
    await page.evaluate(() => window.__cosmos.epl.load());
    await until(page, () => window.__cosmos.epl.state === 2, null, 30, 'the names (no SpaceX)');
    const where = await go(page, 'aconcagua');
    const t = await until(page, () => { const c = window.__cosmos; return !c.flight && c.egr.dbg().drawn; }, null, 150, 'the ground drawn at ' + where + ' with SpaceX off');
    const s = await page.evaluate(() => { const c = window.__cosmos; return { rate:c.ssRate, d:c.egr.dbg() }; });
    if (Math.abs(s.rate - 1/86400) > 1e-9) errors.push(`with SpaceX off the clock at ${where} runs at ${s.rate} days a second, not in real time`);
    notes.push(`SpaceX off: the ground drawn at ${where} after ${t} s, ${s.d.alt} km up, the Sun ${s.d.sun} degrees up`);
    errors.push(...pe); await browser.close(); }
} catch (e) { errors.push(String(e && e.stack || e)); }
server.close();
report('earth', errors, notes.join(' · '));

// The real Moon (0.27.0): NASA's map of the whole Moon on its globe, and the places on it drawn from their own layers. Both load only over
// http, so the page is served from dist/ by a small server here (as tests/earth.mjs).
//   - the globe switches to its map copy (P.moonMap) once the map is in, and the map's credit shows in the readout;
//   - a flight from Earth to Tranquility Base lands on its first angle, the clock eased to the morning there (the Sun low in the east, as at
//     the landing), the ground drawn round it from its layers, the globe under it no longer drawn, the camera above the ground;
//   - the lander's label says it is a model; the place is in the atlas under the Moon and in the search; the tour lists the nine places;
//   - every place's first angle frames ground (no place under the ground or in the sky);
//   - a phone takes the smaller maps.
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
const until = async (page, f, arg, sec, what) => { const t0 = Date.now();
  while (Date.now() - t0 < sec*1000){ if (await page.evaluate(f, arg)) return (Date.now() - t0)/1000; await page.waitForTimeout(500); }
  errors.push('timed out: ' + what); return null; };
try {
  // ---- a desk: the globe, then a flight down to Tranquility Base
  { const { browser, page, errors:pe } = await openPage({ url:URL0 });
    await page.evaluate(() => { const c = window.__cosmos; c.setTour(false); c.ssRate = 0; c.view('moon', 0); });
    const tm = await until(page, () => window.__cosmos.mpl.dbg().map.prog, null, 90, "the Moon's map on its globe");
    // (the credit shows once the map has faded in)
    await until(page, () => /NASA LRO/.test(window.__cosmos.BYKEY.moon.readout()), null, 30, "the Moon's readout crediting its map");
    notes.push(`the globe's map in after ${tm} s`);
    // (from Earth: a long flight; it must land on the place's first angle with the clock eased to its morning)
    await page.evaluate(() => { const c = window.__cosmos; c.view('earth', 0); c.ssRate = 1/86400; c.lockOn(c.BYKEY.apollo11.index); });
    const fl = await page.evaluate(() => window.__cosmos.land(1));
    const s = await page.evaluate(() => { const c = window.__cosmos, o = c.BYKEY.apollo11, p = c.mpl.byKey('apollo11'), sun = c.mpl.sunAt(p, c.days);
      return { lock:c.OBJ[c.orbit.lock].key, finite:isFinite(c.cam.rel[0]) && isFinite(c.orbit.dist), sun, distM:c.orbit.dist*9.4607e15 }; });
    if (s.lock !== 'apollo11' || !s.finite) errors.push('the flight to Tranquility Base ended at ' + JSON.stringify(s));
    if (!(Math.abs(s.sun.el - 11) < 4 && s.sun.east)) errors.push('the Sun at Tranquility Base is not low in the east after the flight: ' + JSON.stringify(s.sun));
    const te = await until(page, () => { const d = window.__cosmos.mpl.dbg(); return d.env === 'apollo11' && d.layers >= 3 && d.fade > 0.99; }, null, 120, 'the ground at Tranquility Base from its layers');
    const g = await page.evaluate(() => { const c = window.__cosmos, o = c.BYKEY.apollo11; c.tick(1/30); c.render();
      return { volOff:c.BYKEY.moon.volOff(), ro:o.readout(), d:c.mpl.dbg(), clear:c.mdt.heightAt ? (() => { const KM = 1/9.4607e12, cm = c.mdt.camM(), h = c.mdt.heightAt(cm); return h == null ? null : (Math.hypot(...cm) - c.mdt.R)*1000 - h; })() : null }; });
    if (!g.volOff) errors.push("the Moon's globe is still drawn under the ground at Tranquility Base");
    if (!/ground: NASA LRO/.test(g.ro)) errors.push("Tranquility Base's readout does not credit its ground: " + g.ro);
    if (!(g.clear > 1)) errors.push('the camera is not above the ground at Tranquility Base: ' + g.clear + ' m');
    notes.push(`flight ${fl.toFixed(1)} s, the ground from ${g.d.layers} layers after ${te} s more, the Sun ${s.sun.el.toFixed(1)} degrees up, the camera ${g.clear && g.clear.toFixed(0)} m above the ground`);
    // (the close angle: the lander's label, a model)
    await page.evaluate(() => { const c = window.__cosmos; c.view('apollo11', 2); c.tick(1/30); c.render(); c.tick(1/30); });
    await page.waitForTimeout(800);
    const lab = await page.evaluate(() => { const L = [...document.querySelectorAll('.lab')].find(e => /Eagle/.test(e.textContent)); return L ? { t:L.textContent, on:L.classList.contains('on') } : null; });
    if (!lab || !/model/.test(lab.t) || !lab.on) errors.push("Eagle's label is not shown, or does not say it is a model: " + JSON.stringify(lab));
    // (zoomed all the way in on the lander, low down: the camera stays 12 m from what it looks at, and outside the lander)
    const lz = await page.evaluate(() => { const c = window.__cosmos, o = c.BYKEY.apollo11, KM = 1/9.4607e12;
      c.orbit.dist = c.orbit.distT = o.rad*o.minZoom; c.orbit.pitch = 0.02; for (let i=0;i<20;i++) c.tick(1/30);
      const cm = c.mdt.camM(), h = c.mdt.heightAt(cm), u = o.u, R = c.mdt.R, along = cm[0]*u[0] + cm[1]*u[1] + cm[2]*u[2];
      const side = Math.sqrt(Math.max(0, cm[0]*cm[0] + cm[1]*cm[1] + cm[2]*cm[2] - along*along))*1000;
      return { dist:o.rad*o.minZoom/KM*1000, up:h == null ? null : (Math.hypot(...cm) - R)*1000 - h, side }; });
    if (!(lz.dist >= 11.9) || !(lz.up > 2.4) || (lz.side < 6 && lz.up < 4.8)) errors.push('zoomed in on Eagle, the camera is too close: ' + JSON.stringify(lz));
    // (the atlas: every place right under the Moon, which sits under Earth, a level further in, "on the Moon")
    const atl = await page.evaluate(() => { document.querySelector('#btnAtlas').click();
      const bs = [...document.querySelectorAll('#atlasList .arow')], rows = bs.map(b => b.textContent);
      const i = rows.findIndex(t => /^the Moon/.test(t)), j = rows.findIndex(t => /^Tranquility Base/.test(t)), names = rows.slice(i + 1, i + 10).map(t => t.replace(/on the Moon$/, ''));
      const r = { i, j, row:rows[j], grand:bs[j] ? bs[j].classList.contains('grand') : false, names };
      document.querySelector('#btnAtlas').click(); return r; });
    if (!(atl.i >= 0 && atl.j === atl.i + 1) || !/on the Moon$/.test(atl.row || '') || !atl.grand) errors.push('Tranquility Base is not listed right under the Moon in the atlas: ' + JSON.stringify(atl));
    const want = await page.evaluate(() => window.__cosmos.mpl.places.map(p => p.name));
    if (want.join('|') !== atl.names.join('|')) errors.push('the places on the Moon are not all listed under it, in order: ' + JSON.stringify(atl.names));
    // (the tour)
    const tour = await page.evaluate(() => { const c = window.__cosmos; c.startTour('moon'); const n = c.TOUR.length, k = c.OBJ[c.TOUR[0]].key; c.setTour(false); return { n, k, id:c.tourId }; });
    if (tour.n !== 9 || tour.k !== 'apollo11') errors.push('the Footsteps on the Moon tour: ' + JSON.stringify(tour));
    // (every place's first angle frames ground: from the middle of the screen down, the ray meets the ground)
    const keys = await page.evaluate(() => window.__cosmos.mpl.places.map(p => p.key));
    for (const k of keys){
      await page.evaluate(k => { const c = window.__cosmos; c.view(k, 0); }, k);
      // (the ground round this place's own site, with its heights on the CPU under the camera)
      await until(page, k => { const c = window.__cosmos, d = c.mpl.dbg(); return d.env === c.mpl.byKey(k).site && d.layers >= 2 && c.mdt.heightAt(c.mdt.camM()) != null; }, k, 90, 'the ground at ' + k);
      const r = await page.evaluate(k => { const c = window.__cosmos, o = c.BYKEY[k], cm = c.mdt.camM(), h = c.mdt.heightAt(cm); return { finite:isFinite(c.cam.rel[0]), clear:h == null ? null : (Math.hypot(...cm) - c.mdt.R)*1000 - h, views:o.views.length, fact:o.fact.length, ro:o.readout() }; }, k);
      if (!r.finite || !(r.clear > 1) || r.views < 2 || r.fact < 60) errors.push(k + ': ' + JSON.stringify(r));
    }
    errors.push(...pe); await browser.close(); }
  // ---- a flight from Earth to the Moon (0.27.6): the maps are asked for as it sets out, while the Moon is still a dot, so it lands on the
  // map; and a map that comes in on a big disc dissolves in over seconds (no step of more than a twentieth between two frames 1/30 s apart)
  { const { browser, page, errors:pe } = await openPage({ url:URL0 });
    await page.evaluate(() => { const c = window.__cosmos; c.setTour(false); c.ssRate = 0; c.view('earth', 0); c.tick(1/30); c.lockOn(c.BYKEY.moon.index); });
    const early = await page.evaluate(async () => { const c = window.__cosmos, t0 = performance.now();
      while (performance.now() - t0 < 20000){ const m = c.mpl.dbg().map; if (m.c >= 1 && m.h >= 1) return { rpx:c.BYKEY.moon.rpx, flying:!!c.stepTarget }; await new Promise(r => setTimeout(r, 30)); }
      return null; });
    if (!early || !(early.rpx < 10)) errors.push('the maps were not asked for as the flight to the Moon set out: ' + JSON.stringify(early));
    await page.evaluate(() => window.__cosmos.land(1));
    await until(page, () => window.__cosmos.mpl.dbg().map.fade === 1, null, 90, "the Moon's map in after a flight to it");
    // (the dissolve itself: the page frozen on the Moon's first angle, the map taken away and given back)
    const steps = await page.evaluate(() => { const c = window.__cosmos; window.__freeze = true; c.view('moon', 0); c.mgl.off = true; c.tick(1/30); c.render(); c.mgl.off = false;
      const f = []; for (let i=0;i<150 && f[f.length - 1] !== 1;i++){ c.tick(1/30); c.render(); f.push(c.mpl.dbg().map.fade); }
      window.__freeze = false; return { n:f.length, max:Math.max(...f.map((x, i) => x - (i ? f[i - 1] : 0))), end:f[f.length - 1], rpx:c.BYKEY.moon.rpx }; });
    if (!(steps.end === 1 && steps.n >= 60 && steps.max <= 0.05)) errors.push("the Moon's map does not dissolve in gradually on a big disc: " + JSON.stringify(steps));
    notes.push(`maps asked for at ${early && early.rpx.toFixed(1)} px, the dissolve ${steps.n} frames`);
    errors.push(...pe); await browser.close(); }
  // ---- a phone: the smaller maps
  { const { browser, page, errors:pe } = await openPage({ phone:true, url:URL0 });
    const sz = await page.evaluate(() => window.__cosmos.mgl.SZ);
    if (sz !== 2048) errors.push('a phone takes the ' + sz + ' maps, not the 2048 ones');
    errors.push(...pe); await browser.close(); }
} catch (e) { errors.push('threw: ' + (e.stack || e)); }
server.close();
report('moon', errors, notes.join(' · '));

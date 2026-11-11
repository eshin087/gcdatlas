// The real Earth's finer tiles and the ground anywhere (0.12.0), which load only over http: the page is served from dist/ by a small server
// here. The five cities (0.13.0) and a famous place (0.15.0) are drawn with their own layers. Three things Codex's review of #43 found:
//   - on a phone (12 tile slots), the ground near the pole covers more tiles than there are slots: the tile under the camera must still load;
//   - climbing away from the ground and looking elsewhere, the ground's tiles must be let go, so the tiles there load;
//   - with the SpaceX flag off (?flags=-spacex), the ground anywhere must still be drawn, and the clock run in real time at a place.
// The living planet (0.26.0): this week's earthquakes and the last day's fires, from canned /api answers (no live network in tests).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { openPage, report, ROOT } from './lib.mjs';
const DIST = path.join(ROOT, 'dist'), TYPES = { '.html':'text/html', '.js':'text/javascript', '.json':'application/json', '.webp':'image/webp', '.jpg':'image/jpeg', '.png':'image/png' };
// (the /api answers: canned ones for the living planet's section, else none, as on the artifact page)
let API = null;
const server = http.createServer((q, r) => {
  let p = decodeURIComponent(q.url.split('?')[0]); if (p === '/') p = '/index.html';
  if (p.startsWith('/api/')){ const a = API && API[p.slice(5)]; r.writeHead(a ? 200 : 404, { 'Content-Type':'application/json' }); r.end(a ? JSON.stringify(a) : '{"error":"not here"}'); return; }
  const f = path.join(DIST, p); if (!f.startsWith(DIST) || !fs.existsSync(f) || fs.statSync(f).isDirectory()){ r.writeHead(404); r.end(); return; }
  r.writeHead(200, { 'Content-Type':TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r);
}).listen(0);
const URL0 = `http://127.0.0.1:${server.address().port}/`;
const errors = [], notes = [];
// wait in real time (fetches and the GPU work happen in the page's own loop) until f() in the page is true
const until = async (page, f, arg, sec, what) => { const t0 = Date.now();
  while (Date.now() - t0 < sec*1000){ if (await page.evaluate(f, arg)) return (Date.now() - t0)/1000; await page.waitForTimeout(500); }
  errors.push('timed out: ' + what); return null; };
// ---- canned answers for /api/quakes and /api/fires, as api/quakes.js and api/fires.js give them (docs/LIVE_DATA.md), at a fixed moment
const NOW = Date.UTC(2026, 10, 8, 12, 0), TS = NOW/1000;
function cannedQuakes(){
  const q = [[TS - 3*3600, 38.1, 142.9, 20, 7.2, '90 km E of Ishinomaki, Japan'], [TS - 26*3600, -18.2, -178.1, 600, 6, 'Fiji region'], [TS - 50*3600, -23.4, -66.8, 180, 5.4, 'Jujuy, Argentina']];
  for (let i = 0; i < 40; i++) q.push([TS - 600 - i*14000, 33 + (i % 7)*0.9, -118 - (i % 5)*0.8, 8, +(2.5 + (i % 9)*0.2).toFixed(1), i + ' km N of Ridgecrest, CA']);
  q.push([TS - 7200, 'x', 10, 5, 4, 'a bad row'], [TS - 7200, 95, 10, 5, 4, 'off the globe']);   // (both refused by the page)
  q.sort((a, b) => b[0] - a[0]);
  return { updated:new Date(NOW).toISOString(), generated:TS - 120, from:TS - 120 - 7*86400, minMag:2.5, n:q.length, quakes:q };
}
function cannedFires(){
  // (three burning regions of 20 x 20 cells: northern Australia, southern Africa, the Amazon)
  const f = []; let k = 0;
  for (const [la, lo] of [[-14.05, 131.05], [-12.05, 24.05], [-8.05, -55.05]]) for (let i = 0; i < 20; i++) for (let j = 0; j < 20; j++){ k++;
    f.push([+(la + i*0.1).toFixed(2), +(lo + j*0.1).toFixed(2), 1 + k % 5, +(((k*37) % 400)/4 + 0.5).toFixed(1)]); }
  f.push([null, 10, 1, 1]);   // (refused)
  f.sort((a, b) => (b[3] ?? 0) - (a[3] ?? 0));
  return { updated:new Date(NOW).toISOString(), source:'VIIRS NOAA-20', from:TS - 3600 - 86400, to:TS - 3600, cell:0.1, raw:3600, n:f.length, fires:f };
}
const go = (page, name) => page.evaluate(n => { const c = window.__cosmos; c.ssRate = 0; const r = c.epl.find(n)[0]; c.epl.go(r); return r && r[0]; }, name);
try {
  // ---- the living planet (0.26.0): the canned week of quakes and day of fires drawn on Earth, its readout, the toast for the M 7.2, the row
  // under the readout, Earth's angle over the largest, the flight to it (a place object dressed as the quake, the clock left alone), the
  // replay, the search, the switch; then without /api, quiet
  { API = { quakes:cannedQuakes(), fires:cannedFires() };
    const { browser, page, errors:pe } = await openPage({ url:URL0, now:NOW });
    const t = await until(page, () => { const d = window.__cosmos.qk.dbg(); return d.q.state === 2 && d.f.state === 2; }, null, 60, 'the earthquakes and fires answers');
    const d = await page.evaluate(() => window.__cosmos.qk.dbg());
    if (d.q.n !== 43 || d.q.n5 !== 3 || !d.q.big || d.q.big[0] !== 7.2 || d.q.newest !== TS - 600) errors.push('the earthquakes: ' + JSON.stringify(d.q));
    const L = d.f.levels;
    if (d.f.n !== 1200 || L.length !== 3 || !(L[2][1] < L[1][1] && L[1][1] < L[0][1]) || L.some(x => x[0] > x[1] || Math.abs(x[3] - L[0][3]) > 2)) errors.push('the fires and their levels: ' + JSON.stringify(d.f));
    // (Earth: its readout, the row under it, the toast for the M 7.2 of 3 hours ago, its angle over the largest)
    await page.evaluate(() => { const c = window.__cosmos; c.ssRate = 0; c.tour.on = false; c.view('earth', 0); });
    await until(page, () => window.__cosmos.qk.dbg().row && !!window.__cosmos.qk.dbg().toast, null, 15, 'the row under the readout and the toast');
    const e = await page.evaluate(() => { const c = window.__cosmos, o = c.BYKEY.earth; return { ro:o.readout(), go:document.getElementById('qkGo').textContent, toast:c.qk.dbg().toast,
      angle:o.views.findIndex(v => v.track && v.ready && v.ready()), drawn:o.particles.filter(s => /^qk/.test(s.prog)).map(s => s.prog + ' ' + s.show()) }; });
    if (!/earthquakes this week: 43 of M 2\.5 and over, 3 of M 5 and over · the largest, M 7\.2, 90 km E of Ishinomaki, Japan, 3 hours ago \(USGS\)/.test(e.ro)) errors.push("Earth's readout has no line for this week's earthquakes: " + e.ro);
    if (!/fires and heat sources, last 24 hours: 1,200 cells of 11 km.*\(NASA FIRMS, VIIRS NOAA-20\)/.test(e.ro)) errors.push("Earth's readout has no line for the fires: " + e.ro);
    if (e.go !== 'fly to the M 7.2 quake') errors.push('the button to the largest quake says: ' + e.go);
    if (e.toast !== 'M 7.2 earthquake, 90 km E of Ishinomaki, Japan, 3 hours ago (USGS)') errors.push('the toast for the M 7.2: ' + e.toast);
    if (e.angle < 0) errors.push("Earth has no angle over the week's largest quake");
    if (!e.drawn.includes('qkDot true') || !e.drawn.includes('qkRing true') || !e.drawn.includes('qkFire true')) errors.push("the quakes and fires are not drawn at Earth's first angle: " + JSON.stringify(e.drawn));
    // (the replay of the week: halfway through, its readout; then over by itself)
    // (with the time setting paused: the replay runs on real time all the same)
    const r = await page.evaluate(() => { const c = window.__cosmos; c.setOpt('time', '0', true); c.qk.startReplay(); c.simulate(20); const mid = c.BYKEY.earth.readout(); c.simulate(21); c.setOpt('time', '1', true); return { mid, on:c.qk.dbg().replay.on }; });
    if (!/replay of the week: \w{3} \d+ Nov, \d\d:\d\d UTC · \d+ of 43 earthquakes so far/.test(r.mid) || r.on) errors.push('the replay: ' + JSON.stringify(r));
    // (the flight to the largest: a place object dressed as the quake; the clock is not moved)
    const g = await page.evaluate(() => { const c = window.__cosmos, d0 = c.days; c.qk.goBig(); c.land(); const o = c.OBJ[c.orbit.lock];
      return { name:o.name, type:o.type, spot:!!o.earthSpot, ro:o.readout(), fact:o.fact, dd:c.days - d0 }; });
    if (g.name !== 'M 7.2 earthquake' || !g.spot || !/^earthquake · 90 km E of Ishinomaki, Japan/.test(g.type)) errors.push('the flight to the largest quake landed on: ' + JSON.stringify(g));
    if (!/M 7\.2 · 20 km deep · Sun 8 Nov, 09:00 UTC, 3 hours ago/.test(g.ro) || !/magnified/.test(g.ro) || !/USGS/.test(g.ro)) errors.push("the quake's readout: " + g.ro);
    if (!/8 November 2026 at 09:00 UTC/.test(g.fact)) errors.push("the quake's fact: " + g.fact);
    if (Math.abs(g.dd) > 0.01) errors.push('the flight to the quake moved the clock by ' + g.dd + ' days');
    // (both place objects set to somewhere else in turn, the one that was the quake included: the quake's row goes)
    const p = await page.evaluate(() => { const c = window.__cosmos; for (let i = 0; i < 2; i++){ c.epl.go(['Test Basin', 'r', 10, 10, 500, '', 'basin']); c.land(); }
      const o = c.OBJ[c.orbit.lock]; return { name:o.name, row:c.qk.dbg().row, quake:c.qk.isQuakeSpot(o) }; });
    if (p.name !== 'Test Basin' || p.row || p.quake) errors.push('a place object reused after the quake still shows it: ' + JSON.stringify(p));
    // (the search lists the week's largest; the place's other words narrow it down)
    const f = await page.evaluate(() => { const c = window.__cosmos; return [c.epl.find('earthquake').map(r => r[0]), c.epl.find('quakes argentina').map(r => r[0])]; });
    if (!f[0].length || !/^M 7\.2 earthquake, 90 km E of Ishinomaki/.test(f[0][0]) || f[1][0] !== 'M 5.4 earthquake, Jujuy, Argentina') errors.push('the search for earthquakes: ' + JSON.stringify(f));
    // (the switch: off, nothing drawn and nothing said)
    const o = await page.evaluate(() => { const c = window.__cosmos; c.setOpt('quakes', false, true); c.view('earth', 0); const e = c.BYKEY.earth;
      const res = { on:c.qk.on(), drawn:e.particles.filter(s => /^qk/.test(s.prog)).some(s => s.show()), ro:/earthquakes|fires and heat/.test(e.readout()) }; c.setOpt('quakes', true, true); return res; });
    if (o.on || o.drawn || o.ro) errors.push('with the switch off: ' + JSON.stringify(o));
    notes.push('the living planet: 43 quakes and 1,200 fire cells in after ' + t + ' s (' + L.map(x => x[1]).join(' / ') + " points by level), the M 7.2's toast, flight and readout, the replay and the search");
    errors.push(...pe); await browser.close(); }
  // ---- without /api (as on the artifact page, or when an upstream is down): quiet; a shared link to a quake still opens as an earthquake
  { API = null;
    const { browser, page, errors:pe } = await openPage({ url:URL0 + '#o=earth-place-0&g=' + encodeURIComponent('38.1,142.9,r,1300,,earthquake,M 7.2 earthquake'), now:NOW });
    await until(page, () => { const d = window.__cosmos.qk.dbg(); return d.q.state === 3 && d.f.state === 3; }, null, 60, 'the earthquakes and fires answers refused');
    const q = await page.evaluate(() => { const c = window.__cosmos, s = c.BYKEY['earth-place-0'], link = { name:s.name, type:s.type, fact:s.fact, ro:s.readout() };
      c.view('earth', 0); return { ro:c.BYKEY.earth.readout(), row:c.qk.dbg().row, link }; });
    if (/earthquakes|fires and heat/.test(q.ro) || q.row) errors.push('without /api something is still said: ' + JSON.stringify(q));
    if (q.link.name !== 'M 7.2 earthquake' || q.link.type !== 'an earthquake' || /Natural Earth/.test(q.link.fact) || !/USGS/.test(q.link.ro)) errors.push('a link to a quake without its list: ' + JSON.stringify(q.link));
    errors.push(...pe); await browser.close(); }
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
  // ---- scrolling out of a place (0.27.12, owner: "it gets very buggy and things seem to spiral out of control"): the wheel with the cursor
  // off to a side never moves the place, the camera goes over to the Earth with no jump in where it looks, a gentle roll and never under
  // the ground, and scrolling back in on the way comes back to the place. From a file, the clock and the page's loop held still.
  { const { browser, page, errors:pe } = await openPage({ freeze:true, now:NOW });
    const z = await page.evaluate(() => { const c = window.__cosmos, earth = c.OBJ.find(o => o.key === 'earth'), paris = c.epl.PICKS.cities.find(r => r[0] === 'Paris'); c.ssRate = 0;
      const ang = (a, b) => Math.acos(Math.max(-1, Math.min(1, a[0]*b[0] + a[1]*b[1] + a[2]*b[2])))*180/Math.PI, key = () => c.OBJ[c.orbit.lock].key;
      c.epl.go(paris); c.land(1);
      const o = c.OBJ[c.orbit.lock], la = o.place.la, lo = o.place.lo, d0 = c.orbit.dist, R = Math.hypot(...o.offset), cv = document.querySelector('#view');
      // (the wheel, 400 px right of and 200 px above the middle: 24 notches out)
      for (let i = 0; i < 24; i++){ cv.dispatchEvent(new WheelEvent('wheel', { deltaY:300, clientX:innerWidth/2 + 400, clientY:innerHeight/2 - 200, bubbles:true, cancelable:true })); for (let k = 0; k < 6; k++) c.tick(1/60); }
      for (let i = 0; i < 120; i++) c.tick(1/60);
      const out = { name:o.name, moved:Math.abs(o.place.la - la) + Math.abs(o.place.lo - lo), wheel:key() };
      // (again, in one hard pull, every tick measured)
      c.epl.go(paris); c.land(1); c.zoomTo(d0*1e5);
      let pf = null, pu = null; out.turn = out.roll = 0; out.low = 1e9;
      for (let i = 0; i < 60*4; i++){ c.tick(1/60); const f = c.cam.fwd.slice(), u = c.cam.up.slice();
        if (pf){ out.turn = Math.max(out.turn, ang(pf, f)); out.roll = Math.max(out.roll, ang(pu, u)); } pf = f; pu = u;
        out.low = Math.min(out.low, Math.hypot(...earth.rel)/R); }
      out.pull = key(); out.pitch = c.orbit.pitch;
      // (out to between the two distances, then back in before the camera has gone over)
      c.epl.go(paris); c.land(1); const p = c.OBJ[c.orbit.lock]; c.zoomTo(R*2.5); for (let i = 0; i < 40; i++) c.tick(1/60);
      out.mid = p.riseW; c.zoomTo(d0); for (let i = 0; i < 60*4; i++) c.tick(1/60);
      out.back = key(); out.backW = p.riseW; out.backOff = Math.hypot(...c.orbit.off)/R; out.place = p.key; return out; });
    if (z.name !== 'Paris' || z.moved > 1e-9) errors.push(`scrolling out with the cursor off to a side moved the place: ${z.name}, ${z.moved} degrees`);
    if (z.wheel !== 'earth' || z.pull !== 'earth') errors.push(`scrolled far out of Paris the camera is locked on ${z.wheel} and ${z.pull}, not Earth`);
    if (!(z.turn < 0.5) || !(z.roll < 1.5) || !(z.low > 1)) errors.push(`going over to the Earth the view turned ${z.turn.toFixed(2)} and rolled ${z.roll.toFixed(2)} degrees in a tick, lowest ${z.low.toFixed(3)} Earth radii`);
    if (!(z.mid > 0.1 && z.mid < 0.9) || z.back !== z.place || z.backW !== 0 || !(z.backOff < 1e-3)) errors.push(`scrolling back in on the way out did not come back to the place: ${JSON.stringify(z)}`);
    notes.push(`scrolled out of Paris: the place stays, the camera goes over to Earth rolling at most ${(z.roll*60).toFixed(0)} degrees a second`);
    errors.push(...pe); await browser.close(); }
} catch (e) { errors.push(String(e && e.stack || e)); }
server.close();
report('earth', errors, notes.join(' · '));

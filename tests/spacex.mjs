// SpaceX flights and Starman's Roadster: every mission flown to its end without drawing (the paths only), where each stage ends up, the launch
// camera through a whole flight, a live launch from the schedule, and the Roadster against JPL Horizons.
//   node tests/spacex.mjs
import { openPage, report } from './lib.mjs';
const NOW = Date.parse('2026-09-29T12:00:00Z');
const { browser, page, errors } = await openPage({ now:NOW, freeze:true });
const r = await page.evaluate(() => {
  const C = window.__cosmos, X = C.sx, out = [], info = {};
  C.setTour(false); C.view('earth', 0);
  const bad = v => !v || v.some(x => !isFinite(x));
  const st = k => C.BYKEY[k].sx.st;
  const flat = (a, b) => Math.hypot(...a.map((x, i) => x - b[i]))*1000;   // metres between two Earth-fixed km points
  // fly each mission from T-10 s to its end in 0.5 s steps (mission time), checking every stage on the way
  for (const key of ['starship', 'falcon9', 'falconheavy', 'dragon']){
    const run = X.start(key, 'click', -10), end = X.MIS[key].end;
    let maxV = 0, t = -10;
    for (; t <= end; t += 0.5){
      if (key === 'dragon' && t > 760 && t < 1000) t = 1000;
      X.setMt(key, t);
      for (const k in X.SX.parts){ const o = C.BYKEY[k]; if (o.sx.fam !== run.mis.fam || o.hidden) continue; const s = o.sx.st;
        if (bad(s.base) || bad(s.axis) || bad(o.offset)){ out.push(`${key}: ${k} has no position at T${t}`); t = 1e9; break; }
        if (!s.atISS && s.alt < -0.002) out.push(`${key}: ${k} below the ground at T${t} (${(s.alt*1000).toFixed(1)} m)`);
        maxV = Math.max(maxV, s.speed || 0); }
    }
    if (maxV > 8.2) out.push(`${key}: a stage flew at ${maxV.toFixed(2)} km/s`);
    info[key] = { maxV:+maxV.toFixed(2) };
    // where things end
    if (key === 'starship'){ const b = st('superheavy'), pad = X.SX.parts.superheavy && C.BYKEY['sx-starbase'];
      const sb = C.BYKEY['sx-starbase'].sxSite, d = flat(b.base.map((x, i) => x), sb.p), h = b.alt*1000;
      info.catch = { fromMount:Math.round(Math.hypot(d, 0) - 0), h:Math.round(h) };
      if (!(h > 25 && h < 45)) out.push(`starship: the booster ends ${h.toFixed(0)} m up, not in the chopsticks`);
      if (Math.sqrt(Math.max(d*d - h*h, 0)) > 3) out.push(`starship: the booster ends ${Math.sqrt(Math.max(d*d - h*h, 0)).toFixed(1)} m off the mount`);
      if (st('starship').alt < 150) out.push('starship: the ship ends below 150 km'); }
    if (key === 'falcon9' || key === 'falconheavy'){ const core = st(key === 'falcon9' ? 'falcon9' : 'falconheavy'), ds = X.SX.clusters.find(c => c.site && c.site.kind === 4 && c.parts.some(p => p.key === (key === 'falcon9' ? 'falcon9' : 'falconheavy')));
      if (!ds) out.push(`${key}: the core does not end on its droneship`);
      else { const d = flat(core.base, ds.site.p); info[key].ds = Math.round(d); if (d > 30) out.push(`${key}: the core lands ${d.toFixed(0)} m from the droneship's centre`); } }
    if (key === 'falconheavy'){ const lz = C.BYKEY['sx-lz'].sxSite; for (const k of ['fhside1', 'fhside2']){ const s = st(k), d = flat(s.base, lz.p); info[k] = Math.round(d); if (d > 200 || s.alt > 0.003) out.push(`${k}: ends ${d.toFixed(0)} m from the landing zones, ${(s.alt*1000).toFixed(0)} m up`); } }
    if (key === 'dragon'){ const s = st('dragon'); info.dock = s.dist; if (!s.atISS || s.dist > 0.1) out.push(`dragon: not docked at the end (${s.dist} m)`); }
    X.endRun(run);
  }
  // the launch camera through a whole Starship flight at replay speed: always a focus, a finite camera, a lens in range
  const run = X.start('starship', 'click', -10); X.camNow('starship');
  let n = 0, lensMax = 0;
  for (let k=0;k<60*300 && !run.ended;k++){ C.tick(1/60); n++;
    if (!X.LCAM.on && !run.ended){ out.push(`the launch camera let go at T${run.mt.toFixed(1)}`); break; }
    if (bad(C.cam.rel) || bad(C.cam.fwd)){ out.push(`the launch camera has no position at T${run.mt.toFixed(1)}`); break; }
    lensMax = Math.max(lensMax, X.LENS.k); }
  info.cam = { seconds:Math.round(n/60), lensMax:+lensMax.toFixed(1), ended:run.ended };
  if (!run.ended) out.push('a Starship replay did not end within 5 minutes of watching');
  if (!(n/60 > 150 && n/60 < 300)) out.push(`a watched Starship flight took ${Math.round(n/60)} s`);
  if (lensMax > 16.01) out.push('the lens went past 16x');
  for (let k=0;k<60*8;k++) C.tick(1/60);
  if (X.LCAM.on) out.push('the launch camera did not hand back after the flight');
  // a live launch: a SpaceX Falcon 9 on the schedule 2 minutes from now appears as a live flight with a caption and a watch button, and
  // plays on the wall clock
  X.endRun(X.famRun('star')); C.view('earth', 0);
  X.SX.fake = [{ name:'Falcon 9 Block 5 | Starlink Group 10-12', net:new Date(Date.now() + 120e3).toISOString(), status:'Go', provider:'SpaceX', rocket:'Falcon 9', lat:28.5619, lon:-80.5773 }];
  C.tick(1/60);
  const live = X.famRun('f9');
  info.live = live && { mode:live.mode, mt:Math.round(live.mt), site:live.site };
  if (!live || live.mode !== 'real' || Math.abs(live.mt + 120) > 2 || live.site !== 'slc40') out.push('the live Falcon 9 did not appear: ' + JSON.stringify(info.live));
  C.caption(0.1); const cap = document.querySelector('#capText').textContent, btn = document.querySelector('#capBtn');
  info.caption = cap;
  if (!/^live · Falcon 9 · Starlink Group 10-12 from Cape Canaveral · T-0[12]:/.test(C.showcap || cap) && !/^live/.test(cap)) out.push('the live caption: ' + cap);
  if (btn.hidden || btn.textContent !== 'watch') out.push('no watch button on the live caption');
  X.SX.fake = []; X.endRun(live);
  // a Crew Dragon replay nobody watches leaves the atlas clock alone (0.27.5): through its skip to the docking the clock moves only at its
  // own rate; watched late, the clock eases on to sunlight at the station (under an hour, never a day); watched through, a day as before
  { X.SX.nextReplay = Infinity; C.view('earth', 0); C.tick(1/30);
    const rep = X.start('dragon', 'replay', 700); let d0 = C.days, worst = 0, k = 0;
    for (; k < 30*60 && rep.mt < 1010; k++){ C.tick(1/30); worst = Math.max(worst, Math.abs(C.days - d0 - C.ssRate/30)); d0 = C.days; }
    info.unwatched = { mt:Math.round(rep.mt), worstS:+(worst*86400).toFixed(3), dock:!!rep.dock };
    if (rep.mt < 1000) out.push('the unwatched Dragon replay did not reach its docking');
    if (worst*86400 > 0.01) out.push(`an unwatched Dragon replay moved the atlas clock by ${(worst*86400).toFixed(1)} s in one step`);
    if (!rep.dock) out.push('the unwatched Dragon replay did not note its docking for a later watch');
    d0 = C.days; X.watch(rep); C.land(); for (let i=0;i<30*4;i++) C.tick(1/30);
    const late = C.days - d0; info.lateWatch = { on:X.LCAM.on, min:+(late*1440).toFixed(1) };
    if (!X.LCAM.on || X.LCAM.run !== rep) out.push('watching the Dragon replay after its docking began did not start the launch camera');
    if (rep.dock || late < 0 || late*1440 > 60) out.push(`watching the Dragon replay late moved the clock by ${(late*1440).toFixed(1)} minutes`);
    X.endRun(rep); C.view('earth', 0);
    const run2 = X.start('dragon', 'click', 700); X.camNow('dragon'); d0 = C.days;
    for (k = 0; k < 30*60 && run2.mt < 1010; k++) C.tick(1/30);
    info.watched = { days:+(C.days - d0).toFixed(3) };
    if (!(C.days - d0 >= 1 && C.days - d0 < 1.08)) out.push(`a watched Dragon flight moved the clock by ${(C.days - d0).toFixed(3)} days at the docking, not a day`);
    X.endRun(run2); C.view('earth', 0); }
  // Starman's Roadster against JPL Horizons (2026-09-29 00:00 TDB, heliocentric ICRF, AU)
  const p = X.rd(2461312.5).p, ref = [1.535555063434398, -0.1552658121746102, -0.04826330765441568];
  const dkm = Math.hypot(...p.map((x, i) => x - ref[i]))*149597870.7;
  info.roadsterKm = Math.round(dkm);
  if (dkm > 50000) out.push(`the Roadster is ${Math.round(dkm)} km from Horizons`);
  const ro = document.createElement('div'); C.view('roadster', 0); info.roadster = document.querySelector('#readout').textContent.split('\n')[0];
  return { out, info };
});
errors.push(...r.out);
report('spacex', errors, JSON.stringify(r.info));
await browser.close();

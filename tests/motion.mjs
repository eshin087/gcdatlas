// Camera motion regression: the angle loop after picking an object, play / pause (button and space), flights that land
// exactly on a moving destination (no jump on arrival), ladder picks that keep moving, riding along with the Halo, tour trips without zoom dips,
// and the Halo at work (always travelling, light speed and folds, its jobs, scan beams on the surface). Deterministic: steps the simulation with __cosmos.tick.
// Usage: node tests/motion.mjs
import { openPage, report } from './lib.mjs';

const { browser, page, errors } = await openPage({ width:1200, height:750 });
const fail = m => errors.push('check: ' + m);

// 1. picking an object flies there, then loops through its tour angles
const loop = await page.evaluate(() => {
  const C = __cosmos, sat = C.BYKEY.saturn; C.setTour(false);
  C.lockOn(sat.index);
  C.land(0.2);
  const afterFlight = { lock:C.orbit.lock === sat.index, playing:!document.getElementById('btnPlay').classList.contains('paused') };
  const yaw0 = C.orbit.yaw;
  for (let i=0;i<60*40;i++) C.tick(1/60);   // long enough to swing to another angle
  return { afterFlight, moved:Math.abs(C.orbit.yaw - yaw0) > 0.05, views:sat.views.length };
});
if (!loop.afterFlight.lock) fail('lock-on did not land on Saturn');
if (!loop.afterFlight.playing) fail('the angle loop did not start after landing');
if (!loop.moved) fail('the camera did not move through the angles');

// 2. pause and play: the button and the space bar
const pp = await page.evaluate(() => {
  const C = __cosmos, st = () => ({ paused:document.getElementById('btnPlay').classList.contains('paused'), yaw:C.orbit.yaw, tour:C.tour.on });
  document.getElementById('btnPlay').click(); C.tick(1/60); const a = st();
  for (let i=0;i<60*5;i++) C.tick(1/60); const b = st();
  document.getElementById('btnPlay').click(); for (let i=0;i<60*3;i++) C.tick(1/60); const c = st();
  dispatchEvent(new KeyboardEvent('keydown', { key:' ', bubbles:true })); C.tick(1/60); const d = st();
  return { a, b, c, d };
});
if (!pp.a.paused) fail('pause did not pause');
if (Math.abs(pp.b.yaw - pp.a.yaw) > 1e-6) fail('the camera kept moving while paused');
if (pp.c.paused) fail('play did not resume the loop');
if (!pp.d.paused) fail('space did not pause');

// 3. from the edge of the observable universe to Earth: Earth grows smoothly and the flight lands exactly on the final framing
const fl = await page.evaluate(() => {
  const C = __cosmos, e = C.BYKEY.earth; C.setTour(false);
  C.view('universe', 0); C.tick(1/60);
  C.lockOn(e.index);
  const dur = C.flightDur(), tanY = Math.tan(C.cam.fovY/2), px = () => e.rad/e.dist/tanY*innerHeight/2;
  let prev = px(), worst = 1, t = 0;
  while ((C.flight || t < dur) && t < 200){ C.tick(1/60); t += 1/60; const p = px(); if (prev > 20) worst = Math.max(worst, p/prev, prev/p); prev = p; }
  return { worstFrameToFrameScale:+worst.toFixed(3), lock:C.orbit.lock === e.index };
});
if (!fl.lock) fail('the flight did not land on Earth');
if (fl.worstFrameToFrameScale > 1.12) fail('Earth jumped in size between two frames (x' + fl.worstFrameToFrameScale + ')');

// 4. a scale picked on the ladder keeps the camera moving on arrival (a slow circle), and shared links start playing too
const lad = await page.evaluate(() => {
  const C = __cosmos, m = C.LADDER.find(m => m.key === 'jupiter') || C.LADDER[0];
  C.goLadder(m); C.land(0.2);
  const y0 = C.orbit.yaw; for (let i=0;i<120;i++) C.tick(1/60);
  return { name:m.name, show:C.show.on, playing:!document.getElementById('btnPlay').classList.contains('paused'), moved:Math.abs(C.orbit.yaw - y0) > 1e-3 };
});
if (!lad.show || !lad.playing || !lad.moved) fail('a ladder pick arrived paused: ' + JSON.stringify(lad));

// 5. the Halo: its indicator is off until the ship button is pressed; riding along lands behind it, stays with it through a fold and a
// light-speed jump, and a drag lets go
const ride = await page.evaluate(() => {
  const C = __cosmos, h = C.BYKEY.halo, D = h.dbg, vis = () => !document.getElementById('shipMark').hidden || !document.getElementById('shipArrow').hidden;
  const r = { markOff:!vis() };
  document.getElementById('btnShip').click(); C.tick(1/60); C.hud(); r.markOn = C.SET.haloMark;
  document.getElementById('btnShip').click();
  C.startShipCam('chase'); C.land(0.3);
  r.riding = C.shipCam.on; r.dist = Math.hypot(...h.rel)/h.rad;
  // the next hop is a fold, the one after it a light-speed jump; the camera must stay on the ship all the way
  let i = 0; while (h.S.phase !== 'pass' && i++ < 60*30) C.tick(1/60);
  D.force({ travel:'fold' }); D.replan();
  const k0 = h.S.target.key; let far = 0, farLs = 0, legs = 0; i = 0;
  while (h.S.target.key === k0 && i < 60*60){ C.tick(1/60); i++; }
  for (let j=0;j<60;j++){ C.tick(1/60); far = Math.max(far, Math.hypot(...h.rel)/h.rad); }
  r.folded = h.S.target.key !== k0; r.farAfterFold = +far.toFixed(2); r.stillRiding = C.shipCam.on;
  i = 0; while (h.S.phase !== 'pass' && i++ < 60*30) C.tick(1/60);
  D.force({ travel:'light' }); D.replan();
  const k1 = h.S.target.key; i = 0;
  while ((h.S.target.key === k1 || h.S.phase !== 'pass') && i < 60*70){ C.tick(1/60); i++; if (h.S.phase === 'light') legs++; farLs = Math.max(farLs, Math.hypot(...h.rel)/h.rad); }
  r.jumped = h.S.target.key !== k1 && legs > 60; r.farInLightSpeed = +farLs.toFixed(2); r.ridingAfterJump = C.shipCam.on;
  C.setShipCamMode('cockpit'); for (let j=0;j<60;j++) C.tick(1/60); r.cockpit = Math.hypot(...h.rel)/h.rad < 1;
  C.togglePlay(); r.paused = !C.shipCam.on; C.togglePlay(); r.resumed = C.shipCam.on;
  C.setShipCamMode('chase'); C.stopShipCam();
  return r;
});
if (!ride.markOff) fail('the Halo indicator shows before the ship button is pressed');
if (!ride.markOn) fail('the ship button did not switch the Halo indicator on');
if (!ride.riding || ride.dist > 6) fail('riding along did not land behind the ship: ' + JSON.stringify(ride));
if (!ride.folded || !ride.stillRiding || ride.farAfterFold > 6) fail('the camera lost the ship when it folded space: ' + JSON.stringify(ride));
if (!ride.jumped || !ride.ridingAfterJump || ride.farInLightSpeed > 6) fail('the camera lost the ship at light speed: ' + JSON.stringify(ride));
if (!ride.cockpit) fail('the cockpit view is not on the ship');
if (!ride.paused || !ride.resumed) fail('pause / play did not stop and resume riding along');

// 6. arrows: from the Moon, "next" goes up the scale bar to Earth; the arrows beside the name step angles and the loop carries on;
//    changing the travel speed mid-flight re-times the rest of the trip
const nav = await page.evaluate(() => {
  const C = __cosmos, land = () => { C.land(0.3); };
  C.setTour(false); C.lockOn(C.BYKEY.moon.index); land();
  C.stepObject(1); const next = C.stepTarget; land();
  C.stepObject(1); const next2 = C.stepTarget; land();
  const v0 = C.show.view; document.getElementById('nextObj').click(); for (let i=0;i<60*4;i++) C.tick(1/60);
  const angle = { from:v0, to:C.show.view, looping:C.show.on };
  C.setOpt('travel', 'cinematic', true); C.lockOn(C.BYKEY.sun.index); for (let i=0;i<30;i++) C.tick(1/60);
  const slow = C.flightDur(); C.setOpt('travel', 'warp', true); const fast = C.flightDur(); C.setOpt('travel', 'quick', true); land();
  return { next, next2, angle, slow:+slow.toFixed(2), fast:+fast.toFixed(2) };
});
if (nav.next !== 'earth' || nav.next2 !== 'jupiter') fail('next did not follow the scale bar from the Moon: ' + JSON.stringify(nav));
if (nav.angle.to === nav.angle.from || !nav.angle.looping) fail('the angle arrows did not step the loop: ' + JSON.stringify(nav.angle));
if (!(nav.fast < nav.slow)) fail('changing the speed mid-flight did not re-time it: ' + JSON.stringify(nav));

// 7. every grand tour trip is one smooth flight: the zoom never dips and comes back out on the way (that read as locking on to
// something in the way), and the camera never flies through an object that is not one end of the trip (or around it)
const trips = await page.evaluate(() => {
  const C = __cosmos, T = C.TOUR, bad = []; let passes = 0;
  C.setOpt('travel', 'cinematic', true);
  for (let i=0;i<T.length - 1;i++){
    const a = C.OBJ[T[i]], b = C.OBJ[T[i + 1]];
    C.tourGo(T[i], true); C.tick(1/30); C.tourGo(T[i + 1]);
    if (C.via) passes++;
    const ws = [], inside = new Set(); let n = 0;
    const around = o => [a, b].some(e => Math.hypot(o.pos[0] - e.pos[0], o.pos[1] - e.pos[1], o.pos[2] - e.pos[2]) < o.rad);
    while (C.stepTarget && n++ < 3000){
      C.tick(1/30); ws.push(C.orbit.dist);
      for (const o of C.OBJ) if (o !== a && o !== b && !o.parent && o.prog && o.layer >= 2 && !o.marker && o.dist < o.rad && !around(o)) inside.add(o.key);
    }
    let dips = 0; for (let j=2;j<ws.length - 2;j++) if (ws[j] < ws[j - 1]*0.999 && ws[j] < ws[j + 1]*0.999 && ws[j] < ws[j - 2] && ws[j] < ws[j + 2]) dips++;
    if (dips || inside.size) bad.push(`${a.key} -> ${b.key}: ${dips} zoom dips, inside ${[...inside].join(',') || '-'}`);
  }
  C.setOpt('travel', 'quick', true);
  return { n:T.length - 1, bad, passes };
});
if (trips.bad.length) fail('tour trips that dip or fly through something: ' + trips.bad.join('; '));

// 8. the Halo at work: it is always travelling (never stopped, never turning on the spot, never circling), it travels both by light
// speed and by folds, it does different jobs, scan beams end exactly where they first meet the surface, and a weapons test leaves nothing behind
const halo = await page.evaluate(() => {
  const C = __cosmos, h = C.BYKEY.halo, D = h.dbg, S = h.S, dt = 1/30;
  C.setTour(false); if (C.shipCam.on) C.stopShipCam(); C.view('earth', 0);
  const r = { modes:{}, acts:{}, minTurnRadius:1e9, maxTurn20s:0, stopped:0, steps:0 };
  const head = () => [h.R0[3], h.R0[4], h.R0[5]];
  let H0 = head(), P0 = h.pos.slice(), ph0 = S.phase, win = [];
  D.force({ travel:'light' });   // (the next hop by light speed and a later one by a fold, whatever the dice say)
  for (let i=0;i<30*420;i++){
    if (i === 30*150) D.force({ travel:'fold' });
    C.tick(dt);
    const H = head(), ph = S.phase, same = ph === ph0 && !(ph0 === 'fold' || ph === 'fold');
    r.modes[ph] = 1; if (D.act) r.acts[D.act] = 1;
    const ang = Math.acos(Math.min(1, Math.max(-1, H[0]*H0[0] + H[1]*H0[1] + H[2]*H0[2]))), mv = Math.hypot(h.pos[0] - P0[0], h.pos[1] - P0[1], h.pos[2] - P0[2])/h.rad;
    if (same){ r.steps++; if (!(mv > 0)) r.stopped++; if (ang > 1e-4) r.minTurnRadius = Math.min(r.minTurnRadius, mv/ang); }
    win.push(same ? ang : 0); if (win.length > 20*30) win.shift();
    r.maxTurn20s = Math.max(r.maxTurn20s, win.reduce((a, b) => a + b, 0)*57.3);
    H0 = H; P0 = h.pos.slice(); ph0 = ph;
  }
  r.minTurnRadius = +r.minTurnRadius.toFixed(0); r.maxTurn20s = +r.maxTurn20s.toFixed(0);
  // scan beams on Jupiter, seen from a camera locked on the ship: every beam ends on the drawn surface, at the first point its line meets it
  let n = 0; while (S.phase !== 'pass' && n++ < 30*40) C.tick(dt);
  if (S.target.key === 'jupiter'){ D.force({ target:'saturn', act:'scan', travel:'fold' }); D.replan(); D.skip(); n = 0; while (!(S.phase === 'pass' && S.target.key === 'saturn') && n++ < 30*60) C.tick(dt); }
  D.force({ target:'jupiter', act:'scan', travel:'fold' }); D.replan(); D.skip();
  n = 0; while (!(S.phase === 'pass' && S.target.key === 'jupiter') && n++ < 30*60) C.tick(dt);
  C.view('halo', 0);
  let beams = 0, worst = 0;
  for (const tau of [1.2, 2.5, 4.3, 6, 8.1, 9.5]){
    n = 0; while (D.tau < tau && n++ < 30*60) C.tick(dt);
    C.render();
    for (const b of D.beams){
      beams++;
      const d = b.end.map((x, k) => x - b.E[k]), L = Math.hypot(...d), u = d.map(x => x/L), oc = b.E.map((x, k) => x - b.C[k]);
      const bb = oc[0]*u[0] + oc[1]*u[1] + oc[2]*u[2], hh = bb*bb - (oc[0]*oc[0] + oc[1]*oc[1] + oc[2]*oc[2]) + b.R*b.R, t = -bb - Math.sqrt(Math.max(hh, 0));
      const onSurface = Math.abs(Math.hypot(...b.end.map((x, k) => x - b.C[k]))/b.R - 1), firstHit = hh >= 0 ? Math.abs(t - L)/b.R : 1;
      worst = Math.max(worst, onSurface, firstHit);
    }
  }
  r.beams = beams; r.beamWorst = worst;
  // a weapons test: blasts happen, and some seconds after the job every trace of them is gone
  D.force({ target:'moon', act:'weapons', travel:'light' }); D.replan(); D.skip();
  n = 0; while (!(S.phase === 'pass' && S.target.key === 'moon') && n++ < 30*60) C.tick(dt);
  let blasts = 0; n = 0; while (D.act === 'weapons' && n++ < 30*40){ C.tick(dt); blasts = Math.max(blasts, D.FX.filter(e => e.anc === C.BYKEY.moon).length); }
  for (let i=0;i<30*6;i++) C.tick(dt);
  r.blasts = blasts; r.leftAfter = D.FX.filter(e => e.anc === C.BYKEY.moon).length;
  return r;
});
if (halo.stopped) fail('the Halo stood still for ' + halo.stopped + ' steps');
if (halo.minTurnRadius < 20) fail('the Halo turned on the spot (turn radius ' + halo.minTurnRadius + ' ship lengths)');
if (halo.maxTurn20s > 300) fail('the Halo turned ' + halo.maxTurn20s + ' degrees within 20 s (circling)');
if (!halo.modes.light || !halo.modes.fold) fail('the Halo did not use both light speed and folds: ' + JSON.stringify(halo.modes));
if (Object.keys(halo.acts).length < 4) fail('the Halo did fewer than 4 kinds of job: ' + JSON.stringify(halo.acts));
if (halo.beams < 20 || halo.beamWorst > 1e-3) fail('scan beams do not end on the surface: ' + JSON.stringify({ beams:halo.beams, worst:halo.beamWorst }));
if (!halo.blasts || halo.leftAfter) fail('the weapons test did not blast, or left something behind: ' + JSON.stringify({ blasts:halo.blasts, left:halo.leftAfter }));

report('motion', errors, `Saturn loops through ${loop.views} angles · pause, play and space work · universe to Earth, largest frame-to-frame change x${fl.worstFrameToFrameScale} · ladder picks keep moving · riding the Halo through a fold and a light-speed jump (camera within ${ride.farAfterFold} / ${ride.farInLightSpeed} ship radii) · the Halo always moving (tightest turn ${halo.minTurnRadius} ship lengths, at most ${halo.maxTurn20s} degrees in 20 s), ${Object.keys(halo.acts).length} kinds of job, ${halo.beams} scan beams on the surface (error ${halo.beamWorst.toExponential(1)}) · Moon → ${nav.next} → ${nav.next2} · mid-flight speed change ${nav.slow}s → ${nav.fast}s · ${trips.n} tour trips without dips (${trips.passes} pass-bys)`);
await browser.close();

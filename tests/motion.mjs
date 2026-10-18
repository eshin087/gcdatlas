// Camera motion regression: the angle loop after picking an object, play / pause (button and space), flights that land
// exactly on a moving destination (no jump on arrival), ladder picks that keep moving, riding along with the Halo, tour trips without zoom dips,
// the Halo at work (always travelling, light speed and folds, its jobs, a scan's hologram on the surface, Pip the drone), and the controls that say where they go
// (next stop, angle arrows that count every tap, Esc closing panels first, the tour's angles at Earth), and the random tour. Deterministic: the page's clock is fixed and
// its own animation loop frozen, so only __cosmos.tick moves the simulation, and the Halo flies a route of its own (dbg.reset): every run is the same.
// Usage: node tests/motion.mjs
import { openPage, report } from './lib.mjs';

const NOW = Date.UTC(2026, 8, 26, 12);   // (the Solar System as on this date; the Halo sections put the clock back to it with setDays(0))
const HALO_SEED = +(process.env.HALO_SEED || 1);   // (the Halo's route; HALO_SEED=n node tests/motion.mjs flies another one, the same on every run)
const { browser, page, errors } = await openPage({ width:1200, height:750, now:NOW, freeze:true });
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

// 5. the Halo: its indicator is off until the ship button is pressed; riding along lands by it, stays with it through a fold and a
// light-speed jump, and a drag lets go. The camera eases toward a point at most ride.reach() from the ship's centre (the ride camera's shot,
// 08r-ride.js, or the chase pose between places), so while it rides it is never further than that: a camera that lost the ship would be far
// beyond it. (With the still camera, so the distance after the fold is the one shot's.)
const ride = await page.evaluate(seed => {
  const C = __cosmos, h = C.BYKEY.halo, D = h.dbg, vis = () => !document.getElementById('shipMark').hidden || !document.getElementById('shipArrow').hidden;
  C.setDays(0); C.tick(0); D.reset(seed);   // (the same route every run, whatever came before: the clock back to NOW, the planets moved there, then the ship)
  C.setOpt('rideCam', 'still', true);
  const r = { markOff:!vis(), rig:C.ride.reach()/h.rad, chase:Math.hypot(...C.SHIP_POSE.chase.eye)*C.shipCam.zoom };
  document.getElementById('btnShip').click(); C.tick(1/60); C.hud(); r.markOn = C.SET.haloMark;
  document.getElementById('btnShip').click();
  C.startShipCam('chase'); C.land(0.3);
  r.riding = C.shipCam.on; r.dist = +(Math.hypot(...h.rel)/h.rad).toFixed(4); r.rig = C.ride.reach()/h.rad;
  // the next hop is a fold, the one after it a light-speed jump; the camera must stay on the ship all the way
  let i = 0; while (h.S.phase !== 'pass' && i++ < 60*30) C.tick(1/60);
  D.force({ travel:'fold' }); D.replan();
  // (the fold winds up for about 7 s, the ship easing off, and a starburst marks the jump and the arrival)
  // (0.9.3, owner: no shield anywhere in the teleport: out within a second of the wind-up starting, back only after the hull has formed; the
  // heart streaks in on arrival, the ship a point until it arrives)
  const k0 = h.S.target.key, F = D.FLK; let far = 0, farLs = 0, legs = 0, wind = 0, v0 = 0, vMin = 1e300, burstOut = false, shield = 0, zipBig = 0; i = 0;
  const shieldOff = () => { if (h.S.asm < F.A1 + 0.25) shield = Math.max(shield, h.S.shK); if (h.S.asm < F.ZIP - 0.05) zipBig = Math.max(zipBig, h.S.scale); };
  while (h.S.target.key === k0 && i < 60*60){ C.tick(1/60); i++;
    if (h.S.phase === 'align' && h.S.next.mode === 'fold'){ if (!wind) v0 = h.S.speed; wind += 1/60; vMin = Math.min(vMin, h.S.speed); if (wind > 1) shield = Math.max(shield, h.S.shK); }
    if (h.S.phase === 'fold'){ shield = Math.max(shield, h.S.shK); if (D.FX.some(e => e.kind === 'fold-out')) burstOut = true; } }
  r.fold = { wind:+wind.toFixed(2), eased:+(vMin/v0).toFixed(2), burstOut, burstIn:D.FX.some(e => e.kind === 'fold-in') };
  for (let j=0;j<60;j++){ C.tick(1/60); shieldOff(); far = Math.max(far, Math.hypot(...h.rel)/h.rad); }
  r.folded = h.S.target.key !== k0; r.farAfterFold = +far.toFixed(4); r.stillRiding = C.shipCam.on;
  // (the chase camera moves in during a fold, and must ease all the way back out once the hull has formed: 7 s more, still in the pass)
  for (let j=0;j<60*7;j++){ C.tick(1/60); shieldOff(); }
  Object.assign(r.fold, { shield, zipBig, zipped:!!h.S.zipped });
  r.backOut = { fz:h.S.fz, dist:+(Math.hypot(...h.rel)/h.rad).toFixed(4), phase:h.S.phase };
  i = 0; while (h.S.phase !== 'pass' && i++ < 60*30) C.tick(1/60);
  D.force({ travel:'light' }); D.replan();
  const k1 = h.S.target.key; i = 0;
  while ((h.S.target.key === k1 || h.S.phase !== 'pass') && i < 60*70){ C.tick(1/60); i++; if (h.S.phase === 'light') legs++; farLs = Math.max(farLs, Math.hypot(...h.rel)/h.rad); }
  r.jumped = h.S.target.key !== k1 && legs > 60; r.farInLightSpeed = +farLs.toFixed(4); r.ridingAfterJump = C.shipCam.on;
  C.setShipCamMode('cockpit'); for (let j=0;j<60;j++) C.tick(1/60); r.cockpit = Math.hypot(...h.rel)/h.rad < 1;
  C.togglePlay(); r.paused = !C.shipCam.on; C.togglePlay(); r.resumed = C.shipCam.on;
  C.setShipCamMode('chase'); C.stopShipCam(); C.setOpt('rideCam', 'moving', true);
  return r;
}, HALO_SEED);
if (!ride.markOff) fail('the Halo indicator shows before the ship button is pressed');
if (!ride.markOn) fail('the ship button did not switch the Halo indicator on');
const offRig = d => d > ride.rig*(1 + 1e-6);
if (!ride.riding || offRig(ride.dist)) fail('riding along did not land behind the ship: ' + JSON.stringify(ride));
if (!ride.folded || !ride.stillRiding || offRig(ride.farAfterFold)) fail('the camera lost the ship when it folded space: ' + JSON.stringify(ride));
if (!(ride.fold.wind >= 6.5) || !(ride.fold.eased < 0.6) || !ride.fold.burstOut || !ride.fold.burstIn) fail('the fold did not wind up slowly (about 7 s, the ship easing off) with a starburst as it went and as it arrived: ' + JSON.stringify(ride.fold));
if (ride.fold.shield > 0 || !(ride.fold.zipBig < 0.05) || !ride.fold.zipped) fail('the shield showed in the teleport, or the heart did not streak in before the hull formed: ' + JSON.stringify(ride.fold));
if (ride.backOut.phase !== 'pass' || ride.backOut.fz !== 1 || !(ride.backOut.dist >= 0.95*ride.chase)) fail('the chase camera did not ease back out after a fold: ' + JSON.stringify({ backOut:ride.backOut, rig:ride.rig }));
if (!ride.jumped || !ride.ridingAfterJump || offRig(ride.farInLightSpeed)) fail('the camera lost the ship at light speed: ' + JSON.stringify(ride));
if (!ride.cockpit) fail('the cockpit view is not on the ship');
if (!ride.paused || !ride.resumed) fail('pause / play did not stop and resume riding along');

// 5b. riding along (0.9.6). (a) From the edge of the observable universe to the Halo at Andromeda, the ship stays in the middle of the view
// all the way in: the flight used to aim at a point rounded to thousands of kilometres off it, the ship off the screen and its marker jumping at
// the edge until the last frame. (b) The moving camera shows the place the ship visits: in every pass and loop its near edge is inside the view,
// the ship on the screen, and it plays several shots; the still camera holds one. (c) The Halo tour flies the tour's stops in order, names each
// place in the caption, and the green button sends it on.
const rideB = await page.evaluate(seed => {
  const C = __cosmos, h = C.BYKEY.halo, D = h.dbg, S = h.S, r = {}, [tx, ty] = C.dbg.tan, deg = 180/Math.PI;
  const inView = v => { const z = v[0]*C.cam.fwd[0] + v[1]*C.cam.fwd[1] + v[2]*C.cam.fwd[2]; if (!(z > 0)) return false;
    return Math.abs((v[0]*C.cam.right[0] + v[1]*C.cam.right[1] + v[2]*C.cam.right[2])/(z*tx)) < 1 && Math.abs((v[0]*C.cam.up[0] + v[1]*C.cam.up[1] + v[2]*C.cam.up[2])/(z*ty)) < 1; };
  // (a)
  C.setDays(0); C.tick(0); D.reset(seed, 'andromeda'); C.view('universe', 0); C.ride.seed(1); C.startShipCam('chase');
  let off = 0, n = 0; while (C.flight && n < 60*60){ C.tick(1/60); n++; if (C.cam.focus === h.index){ const v = C.cam.rel.map(x => -x), c = (v[0]*C.cam.fwd[0] + v[1]*C.cam.fwd[1] + v[2]*C.cam.fwd[2])/Math.hypot(...v); off = Math.max(off, Math.acos(Math.min(1, c))*deg); } }
  r.far = { off:+off.toFixed(1), landed:C.shipCam.on };
  // (b)
  const watch = (key, sec, cam) => {
    C.stopShipCam(); C.setOpt('rideCam', cam, true); D.reset(seed + 1, key); for (let i = 0; i < 60*7; i++) C.tick(1/60); C.startShipCam('chase'); C.land(0.2);
    const q = { key, ticks:0, shipOut:0, bodyOut:0, shots:new Set() };
    for (let i = 0; i < 60*sec; i++){ C.tick(1/60);
      if (!C.shipCam.on || C.ride.RIDE.wc > 0.05 || (S.phase !== 'pass' && S.phase !== 'loop')) continue;
      q.ticks++; q.shots.add(C.ride.shot);
      if (!inView(C.cam.rel.map(x => -x))) q.shipOut++;
      const tg = S.target, b = h.offset.map((x, j) => -x - C.cam.rel[j]), bd = Math.hypot(...b), R = tg.solid ? tg.rad*tg.solid : tg.rad*0.6;
      const ang = Math.acos(Math.min(1, (b[0]*C.cam.fwd[0] + b[1]*C.cam.fwd[1] + b[2]*C.cam.fwd[2])/bd))*deg, al = Math.asin(Math.min(1, R/bd))*deg;
      if (ang - al > Math.atan(ty)*deg) q.bodyOut++;
    }
    q.shots = [...q.shots].filter(Boolean); return q; };
  r.moving = [watch('saturn', 70, 'moving'), watch('earth', 70, 'moving')];
  r.still = watch('jupiter', 40, 'still');
  C.setOpt('rideCam', 'moving', true);
  // (c)
  C.stopShipCam(); D.reset(seed + 2, 'saturn'); C.ride.seed(seed + 2); for (let i = 0; i < 60*7; i++) C.tick(1/60);
  C.haloTourStart('grand'); C.land(0.2);
  const L = C.HT.stops.map(o => o.key), seen = [], caps = []; let t = 0;
  r.tour = { on:C.HT.on, start:S.target.key, n:L.length, epic:C.ride.RIDE.epic, next:document.getElementById('goNextTxt').textContent };
  let tEnd = 1e9; while (t < tEnd && t < 60*400){ C.tick(1/30); t++; if (seen.length === 3 && tEnd > 1e8) tEnd = t + 60;
    const k = S.target.key; if ((S.phase === 'pass' || S.phase === 'loop') && seen[seen.length - 1] !== k && seen.length < 3){ seen.push(k); caps.push(null); }
    if (!caps[caps.length - 1] && C.showcap) caps[caps.length - 1] = C.showcap;
    if (S.stay && S.stay.t > 12 && (S.phase === 'pass' || S.phase === 'loop') && !C.HT.want) document.getElementById('goNext').click(); }
  Object.assign(r.tour, { seen, want:L.slice(L.indexOf('saturn'), L.indexOf('saturn') + 3), caps:caps.map(c => (c || '').split(' · ')[0]), names:seen.map(k => C.BYKEY[k].name) });
  C.haloTourEnd(true); r.tour.off = !C.HT.on && !C.ride.RIDE.epic; C.stopShipCam();
  return r;
}, HALO_SEED);
if (!rideB.far.landed || rideB.far.off > 30) fail('riding along from the edge of the universe lost the Halo on the way in: ' + JSON.stringify(rideB.far));
for (const q of rideB.moving) if (q.ticks < 600 || q.shipOut || q.bodyOut || q.shots.length < 3) fail('the moving ride camera did not keep the ship and ' + q.key + ' in view, or played fewer than 3 shots: ' + JSON.stringify(q));
if (rideB.still.shipOut || rideB.still.bodyOut || rideB.still.shots.join() !== 'still') fail('the still ride camera moved, or lost the ship or Jupiter: ' + JSON.stringify(rideB.still));
if (!rideB.tour.on || !rideB.tour.epic || rideB.tour.start !== 'saturn' || rideB.tour.seen.join() !== rideB.tour.want.join() || rideB.tour.caps.join() !== rideB.tour.names.join() || !/^next stop/.test(rideB.tour.next) || !rideB.tour.off)
  fail('the Halo tour did not fly the grand tour from Saturn, stop by stop, naming each: ' + JSON.stringify(rideB.tour));

// 5c. the Halo tour frames the place first (owner, 0.9.12: "the tour object should be the main focus of almost every shot and halo is more a
// bonus cool addon"): at a place (a pass or a loop, the chase pose not holding the camera), the place's disc covers at least 4% of the view,
// or is at least 3 times the ship's size on the screen, in 85% of the samples; the ship stays in the picture and is never bigger on the screen
// than the place. Before 0.9.12 the ship covered 10 to 50% of the view and the place 0.2 to 3%, and a click on the ship lost the place
const tourFrame = await page.evaluate(seed => {
  const C = __cosmos, h = C.BYKEY.halo, D = h.dbg, S = h.S, W = innerWidth, H = innerHeight;
  C.stopShipCam(); if (C.HT.on) C.haloTourEnd(true); C.setDays(0); C.tick(0); D.reset(seed + 3, 'saturn'); C.ride.seed(seed + 3); for (let i = 0; i < 60*3; i++) C.tick(1/60);
  C.haloTourStart('grand'); C.land(0.2);
  // (a click on the ship on the tour rides along again, with the tour's shots)
  C.stopShipCam(); C.lockOn(h.index); const clickRides = C.HT.on && (C.shipCam.on || C.shipCam.pending); C.land(0.2);
  const q = { n:0, good:0, shipIn:0, shipBig:0, places:[], clickRides, low:[], stops:[], moves:0, jobs:0 };
  let at = S.target.key, ta = 0, tt = 0, sawMove = false, sawJob = false;
  const pxOf = (rel, R) => { const d = Math.hypot(...rel); return d <= R ? 1e4 : Math.tan(Math.asin(R/d))/C.dbg.tan[1]*H/2; };
  for (let i = 0; i < 30*240; i++){ C.tick(1/30); tt += 1/30;
    // (0.10.2, owner: a stop as long as the normal tour's: from one arrival to the next, the move or the job flown on the way in)
    if (S.phase === 'pass' && S.plan.sig) sawMove = true; if (S.act && S.act.kind !== 'probe') sawJob = true;
    if (S.target.key !== at && S.phase !== 'light' && S.phase !== 'fold'){ if (q.stops.length || ta > 0) q.stops.push(+(tt - ta).toFixed(1)); if (sawMove) q.moves++; if (sawJob) q.jobs++; at = S.target.key; ta = tt; sawMove = sawJob = false; }
    if (i % 15) continue;
    if (!(S.phase === 'pass' || S.phase === 'loop') || C.ride.RIDE.wc > 0.05 || !C.shipCam.on) continue;
    const tg = h.parent, prp = pxOf(tg.rel, C.ride.frame(tg, Math.hypot(...h.offset))), srp = pxOf(h.rel, h.rad), p = C.proj({ rel:tg.rel });
    let cov = prp >= 1e4 ? 1 : 0;
    if (!cov && p){ let n = 0, m = 0; for (let a = 0; a < 20; a++) for (let b = 0; b < 20; b++){ const u = (a + 0.5)/10 - 1, v = (b + 0.5)/10 - 1; if (u*u + v*v > 1) continue; m++; const x = p.x + u*prp, y = p.y + v*prp; if (x >= 0 && x <= W && y >= 0 && y <= H) n++; } cov = Math.PI*prp*prp*n/m/(W*H); }
    const sp = C.proj({ rel:h.rel }), ok = cov >= 0.04 || (!!p && p.x > 0 && p.x < W && p.y > 0 && p.y < H && prp >= 3*srp);
    q.n++; if (ok) q.good++; else if (q.low.length < 6) q.low.push([+(i/30).toFixed(1), tg.key, C.ride.shot, +cov.toFixed(3), Math.round(prp), Math.round(srp)]);
    if (sp && sp.x > 0 && sp.x < W && sp.y > 0 && sp.y < H) q.shipIn++;
    if (srp > prp) q.shipBig++;
    if (!q.places.includes(tg.key)) q.places.push(tg.key);
  }
  C.haloTourEnd(true); C.stopShipCam();
  return q;
}, HALO_SEED);
if (!tourFrame.clickRides || tourFrame.n < 200 || tourFrame.places.length < 2 || tourFrame.good < 0.85*tourFrame.n || tourFrame.shipIn < 0.9*tourFrame.n || tourFrame.shipBig > 0.05*tourFrame.n)
  fail('the Halo tour did not frame the place first (its disc 4% of the view or 3 times the ship, the ship in the picture and smaller): ' + JSON.stringify(tourFrame));
// (the pace of the normal tour, 26 to 64 s a stop and 43 on average: 30 to 50 s on average and none over 70; the Halo's move on arrival at
// most stops and a job at about one in three)
{ const st = tourFrame.stops.slice(1), avg = st.reduce((a, b) => a + b, 0)/Math.max(st.length, 1);
  if (st.length < 3 || avg < 30 || avg > 50 || Math.max(...st) > 70 || tourFrame.moves < 2 || tourFrame.jobs < 1)
    fail('the Halo tour did not keep the pace of the normal tour (30 to 50 s a stop, none over 70, moves and a job): ' + JSON.stringify({ stops:tourFrame.stops, moves:tourFrame.moves, jobs:tourFrame.jobs })); }
console.log(`  Halo tour: the place framed first in ${Math.round(100*tourFrame.good/Math.max(tourFrame.n, 1))}% of ${tourFrame.n} samples at ${tourFrame.places.join(', ')}, the ship in the picture in ${Math.round(100*tourFrame.shipIn/Math.max(tourFrame.n, 1))}%; stops of ${tourFrame.stops.join(', ')} s, ${tourFrame.moves} moves and ${tourFrame.jobs} jobs on arrival`);

// 6. arrows: from the Moon, "next" goes up the scale bar to Earth; the arrows beside the name step angles and the loop carries on;
//    changing the travel speed mid-flight re-times the rest of the trip
const nav = await page.evaluate(() => {
  const C = __cosmos, land = () => { C.land(0.3); };
  C.setTour(false); C.lockOn(C.BYKEY.moon.index); land();
  C.stepObject(1); const next = C.stepTarget; land();
  C.stepObject(1); const next2 = C.stepTarget; land();
  const v0 = C.show.view; document.getElementById('nextObj').click(); for (let i=0;i<60*4;i++) C.tick(1/60);
  const angle = { from:v0, to:C.show.view, looping:C.show.on };
  // fast taps while the camera is still swinging: each one counts (three taps, three angles on), and the angle line shows where it is going
  const v1 = C.show.view, nv = C.OBJ[C.orbit.lock].views.length, b = document.getElementById('nextObj');
  b.click(); for (let i=0;i<6;i++) C.tick(1/60); b.click(); for (let i=0;i<6;i++) C.tick(1/60); b.click(); C.hud();
  angle.fast = { want:(v1 + 3) % nv, label:document.getElementById('progLabel').textContent }; for (let i=0;i<60*4;i++) C.tick(1/60); angle.fast.got = C.show.view;
  angle.fast.arrowsOnLine = document.getElementById('progress').contains(b) && document.getElementById('progress').classList.contains('angles');
  C.setOpt('travel', 'cinematic', true); C.lockOn(C.BYKEY.sun.index); for (let i=0;i<30;i++) C.tick(1/60);
  const slow = C.flightDur(); C.setOpt('travel', 'warp', true); const fast = C.flightDur(); C.setOpt('travel', 'quick', true); land();
  // a swing to an angle that follows a planet round its star, from the far side of it, turns one way all the way (it used to snap round mid-swing)
  let wrap = 0;
  for (const key of ['hd189733b', 'peg51b']) for (const s of [1, -1]){
    C.view(key, 0); for (let i=0;i<5;i++) C.tick(1/60); C.orbit.yaw -= s*(Math.PI - 0.25); C.tick(1/60); C.stepAngle(0);
    let prev = C.cam.fwd.slice();
    for (let f=0; f<60*3; f++){ C.tick(1/60); const q = C.cam.fwd; wrap = Math.max(wrap, Math.acos(Math.min(1, prev[0]*q[0] + prev[1]*q[1] + prev[2]*q[2]))*180/Math.PI); prev = q.slice(); }
  }
  return { next, next2, angle, slow:+slow.toFixed(2), fast:+fast.toFixed(2), wrap:+wrap.toFixed(1) };
});
if (nav.next !== 'earth' || nav.next2 !== 'jupiter') fail('next did not follow the scale bar from the Moon: ' + JSON.stringify(nav));
if (nav.angle.to === nav.angle.from || !nav.angle.looping) fail('the angle arrows did not step the loop: ' + JSON.stringify(nav.angle));
if (nav.angle.fast.got !== nav.angle.fast.want || !nav.angle.fast.label.startsWith(`angle ${nav.angle.fast.want + 1}/`) || !nav.angle.fast.arrowsOnLine) fail('three fast taps on the angle arrow did not move three angles: ' + JSON.stringify(nav.angle.fast));
if (!(nav.fast < nav.slow)) fail('changing the speed mid-flight did not re-time it: ' + JSON.stringify(nav));
if (!(nav.wrap < 10)) fail(`a swing to a tracked angle from the far side jumped ${nav.wrap} degrees in one frame (limit 10; it was up to 120)`);

// 6b. angles that wait for their moment: on 27 September 2026 (Mimas passes through Saturn's shadow every orbit until about 2028) its crater
// angle plays only while Herschel is in sunlight, and when the shadow covers the moon the camera pulls back from the dark disc (it used to
// stay close on a black moon, and show a plain ball on the crater angle half the time)
const mim = await page.evaluate(() => {
  const C = __cosmos, m = C.BYKEY.mimas, dt = 1/30, r = { dark:0, darkClose:0, crater:0, craterNight:0 };
  C.setDays(2461311 - (Date.now()/864e5 + 2440587.5)); C.setTour(false); C.lockOn(m.index); C.land(0.5);
  for (let i=0;i<150/dt;i++){
    C.tick(dt); if (C.show.phase !== 'hold') continue;
    const dark = m.views[0].state(), close = C.orbit.dist/m.rad < 8;
    if (dark){ r.dark += dt; if (close) r.darkClose += dt; }
    if (C.show.view === 1){ r.crater += dt; if (m.views[1].state() === 0) r.craterNight += dt; }
  }
  C.setDays(0); for (const k in r) r[k] = +r[k].toFixed(1);
  return r;
});
if (!(mim.dark > 3 && mim.crater > 3) || mim.darkClose > 0.5 || mim.craterNight > 0.5) fail('Mimas: close on the dark moon, or its crater angle in the night: ' + JSON.stringify(mim));
console.log(`  angles: tracked swings at most ${nav.wrap}° a frame · Mimas in 150 s: ${mim.dark} s in Saturn's shadow (close: ${mim.darkClose} s), crater angle ${mim.crater} s (in the night: ${mim.craterNight} s)`);

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

// 8. the Halo at work: it is always travelling (never stopped, never turning on the spot, never circling, never turning faster than its
// tightest turn, three times its usual rate: a corner in its path would), it travels both by light speed and by folds, it does different
// jobs, a scan's hologram lies on the drawn surface (and never in a black hole's shadow), and a weapons test leaves nothing behind
const halo = await page.evaluate(HALO_SEED => {
  const C = __cosmos, h = C.BYKEY.halo, D = h.dbg, S = h.S, dt = 1/30;
  // (the objects' own clocks back to 0 too, 0.10.2: the moons and the rest move by them, so without it the route depended on how long the
  // sections before this one ran, and a faster Halo tour changed it)
  C.setTour(false); if (C.shipCam.on) C.stopShipCam(); for (const o of C.OBJ) o.t = 0; C.setDays(0); C.view('earth', 0); D.reset(HALO_SEED);   // (the same route every run, as in 5)
  C.tick(0);   // (the ship takes its place on the new route before anything is measured: otherwise the first step turns it from where it was)
  const r = { modes:{}, acts:{}, minTurnRadius:1e9, maxTurn20s:0, maxRate:0, stopped:0, steps:0 };
  const head = () => [h.R0[3], h.R0[4], h.R0[5]];
  let H0 = head(), P0 = h.pos.slice(), ph0 = S.phase, win = [], vis0 = S.visits, cur = { at:S.target.key, t:0, passes:1 };
  r.stays = [];
  D.force({ travel:'light' });   // (hops by light speed until one really is, and a later one by a fold, whatever the dice say)
  for (let i=0;i<30*420;i++){
    if (i < 30*150 && !r.modes.light && !S.force.travel) D.force({ travel:'light' });   // (a hop the ship cannot fly by light speed without a corner folds)
    if (i === 30*150) D.force({ travel:'fold' });
    C.tick(dt);
    const H = head(), ph = S.phase, same = ph === ph0 && !(ph0 === 'fold' || ph === 'fold');
    r.modes[ph] = 1; if (D.act) r.acts[D.act] = 1;
    // (each stay: how long the ship roams round a place, from its arrival to the jump away, and how many passes it flies there)
    if (S.visits !== vis0){ vis0 = S.visits; r.stays.push(cur); cur = { at:S.target.key, t:0, passes:1 }; }
    else { if (ph === 'pass' || ph === 'loop' || ph === 'align') cur.t += dt; if (ph === 'pass' && ph0 !== 'pass') cur.passes++; }
    const ang = Math.acos(Math.min(1, Math.max(-1, H[0]*H0[0] + H[1]*H0[1] + H[2]*H0[2]))), mv = Math.hypot(h.pos[0] - P0[0], h.pos[1] - P0[1], h.pos[2] - P0[2])/h.rad;
    if (same){ r.steps++; if (!(mv > 0)) r.stopped++; if (ang > 1e-4) r.minTurnRadius = Math.min(r.minTurnRadius, mv/ang); r.maxRate = Math.max(r.maxRate, ang/dt*57.3); }
    win.push(same ? ang : 0); if (win.length > 20*30) win.shift();
    r.maxTurn20s = Math.max(r.maxTurn20s, win.reduce((a, b) => a + b, 0)*57.3);
    H0 = H; P0 = h.pos.slice(); ph0 = ph;
  }
  r.stays = r.stays.map(s => ({ at:s.at, t:+s.t.toFixed(0), passes:s.passes }));
  r.minTurnRadius = +r.minTurnRadius.toFixed(0); r.maxTurn20s = +r.maxTurn20s.toFixed(0); r.maxRate = +r.maxRate.toFixed(1); r.rateLimit = +(3*D.HALO.TURN*57.3*1.05).toFixed(1);
  // the scan (a hologram sweep) on Jupiter, seen from a camera locked on the ship. Its hologram lies on the drawn surface: its centre and frame
  // are the planet's, and points of its ring, from what the job hands the shader, lie on Jupiter's surface as FS_JUPITER draws it (a sphere of
  // 0.9 bounding radii, flattened by 0.0649) within 1e-3 of its radius. It is a solid surface's hologram (the shader draws only where the ray
  // first meets it: nothing on the hidden side) and the brackets face the camera. The Great Red Spot's bracket sits on the spot where the
  // shader draws it (once the sweep is done the spot is turned toward the camera, so the check never depends on where it happened to be).
  // The readout's numbers are the table's, and the table's sizes those the bodies are drawn at; the job draws at most 1,500 line ends a frame.
  // (The same steps and pictures as before the scan was a hologram, so the route after it is unchanged)
  let n = 0; while (S.phase !== 'pass' && n++ < 30*40) C.tick(dt);
  if (S.target.key === 'jupiter'){ D.force({ target:'saturn', act:'scan', travel:'fold' }); D.replan(); D.skip(); n = 0; while (!(S.phase === 'pass' && S.target.key === 'saturn') && n++ < 30*60) C.tick(dt); }
  D.force({ target:'jupiter', act:'scan', travel:'fold' }); D.replan(); D.skip();
  n = 0; while (!(S.phase === 'pass' && S.target.key === 'jupiter') && n++ < 30*60) C.tick(dt);
  C.view('halo', 0);
  const J = C.BYKEY.jupiter, SC = D.scan, OBL = 0.0649, LYKM = 9.4607e12, [tx, ty] = C.dbg.tan;
  // (a camera-relative point in a body's own frame, in units of s; and back)
  const loc = (p, o, s) => { const d = [0, 1, 2].map(k => p[k] - o.rel[k]), R = o.rot; return [0, 1, 2].map(k => (R[k*3]*d[0] + R[k*3 + 1]*d[1] + R[k*3 + 2]*d[2])/s); };
  const toWorld = (o, l) => [0, 1, 2].map(k => o.rel[k] + (o.rot[k]*l[0] + o.rot[3 + k]*l[1] + o.rot[6 + k]*l[2])*o.rad);
  // (how squarely a point on Jupiter faces the camera: its surface normal, in world axes, against the line of sight)
  const faceJ = p => { const l = loc(p, J, 1), nl = [l[0], l[1]/((1 - OBL)*(1 - OBL)), l[2]], nw = [0, 1, 2].map(k => J.rot[k]*nl[0] + J.rot[3 + k]*nl[1] + J.rot[6 + k]*nl[2]); return -(nw[0]*p[0] + nw[1]*p[1] + nw[2]*p[2])/(Math.hypot(...nw)*Math.hypot(...p)); };
  const la = -22.4*Math.PI/180, spot = lon => { const n0 = [Math.cos(la)*Math.cos(lon), Math.sin(la), -Math.cos(la)*Math.sin(lon)]; return toWorld(J, [0.9*n0[0], 0.9*n0[1]*(1 - OBL), 0.9*n0[2]]); };
  const scr = p => { const z = p[0]*C.cam.fwd[0] + p[1]*C.cam.fwd[1] + p[2]*C.cam.fwd[2]; return z > 0 ? [(p[0]*C.cam.right[0] + p[1]*C.cam.right[1] + p[2]*C.cam.right[2])/(z*tx), (p[0]*C.cam.up[0] + p[1]*C.cam.up[1] + p[2]*C.cam.up[2])/(z*ty), z] : null; };
  // (in the picture, and clear of the ship, which the camera locked on it has in front of the planet: the hull hides what is behind it)
  const inView = p => { const q = scr(p), s = scr(h.rel); if (!q || !(Math.abs(q[0]) < 0.85 && Math.abs(q[1]) < 0.85)) return false; return !s || Math.hypot((q[0] - s[0])*tx/ty, q[1] - s[1]) > 1.3*h.rad/(s[2]*ty); };
  const scan = { holo:0, ring:0, worst:0, frame:0, lines:0, kind:-1, faceMin:9, brk:-1, turned:false, said:false, sizes:[], noFacts:[] };
  let dJ = 0;   // (how far Jupiter's clock was turned on, to put it back)
  for (const tau of [1.2, 2.5, 4.3, 6, 8.1, 9.5]){
    // (the ring has reached the far pole at SW0 + SWT: turn the spot toward the camera, where FS_JUPITER has it, glon = lon + t 0.0015 - 1.1 = 0,
    // 22.4 degrees south, at a longitude where it is in the picture and faces the camera; its bracket locks on the next step)
    if (tau === 8.1){ n = 0; while (D.tau < SC.SCAN.SW0 + SC.SCAN.SWT + 0.1 && n++ < 30*60) C.tick(dt);
      const cL = loc([0, 0, 0], J, 1), lonC = Math.atan2(-cL[2], cL[0]);
      for (let k=0;k<126;k++){ const lon = lonC + (k % 2 ? 1 : -1)*Math.ceil(k/2)*0.05, p = spot(lon); if (inView(p) && faceJ(p) > 0.35){ const t1 = (((1.1 - lon) % (2*Math.PI)) + 2*Math.PI)/0.0015; dJ = t1 - J.t; J.t = t1; scan.turned = true; break; } } }
    // (from the turn on, every frame is drawn: the bracket is measured in each frame it is shown, as the ship's own flight past Jupiter can
    // carry the hull in front of the spot within the second before 8.1 s)
    n = 0; while (D.tau < tau && n++ < 30*60){ C.tick(dt);
      if (tau === 8.1 && scan.turned){ C.render(); const A1 = SC.job, g1 = A1 && A1.shown.find(s => s.name === 'Great Red Spot');
        if (g1) scan.brk = Math.max(scan.brk, Math.hypot(...g1.p.map((x, k) => x - spot(1.1 - J.t*0.0015)[k]))/J.rad); } }
    C.render();
    const A = SC.job, U = A && A.holoU; if (!U) continue;
    scan.holo++; scan.lines = Math.max(scan.lines, A.nl); scan.kind = U.p2[1];
    scan.frame = Math.max(scan.frame, ...U.R.map((x, k) => Math.abs(x - J.rot[k])), Math.hypot(...U.C.map((x, k) => x - J.rel[k]))/J.rad);
    for (const s of A.shown) scan.faceMin = Math.min(scan.faceMin, faceJ(s.p));
    const g = A.shown.find(s => s.name === 'Great Red Spot'); if (g && tau === 8.1) scan.brk = Math.max(scan.brk, Math.hypot(...g.p.map((x, k) => x - spot(1.1 - J.t*0.0015)[k]))/J.rad);
    if (U.p3[3] > 0) for (let k=0;k<48;k++){
      const lr = Math.asin(U.p0[2]), lo = k/48*2*Math.PI, a = U.p0[0]*U.B, b = U.p0[1]*U.B;
      const q = [a*Math.cos(lr)*Math.cos(lo), b*Math.sin(lr), -a*Math.cos(lr)*Math.sin(lo)], w = [0, 1, 2].map(i => U.C[i] + U.R[i]*q[0] + U.R[3 + i]*q[1] + U.R[6 + i]*q[2]);
      const l = loc(w, J, J.rad); scan.ring++; scan.worst = Math.max(scan.worst, Math.abs(Math.hypot(l[0], l[1]/(1 - OBL), l[2])/0.9 - 1));
    }
    // (the readout, once the scan is complete, gives every number in the table)
    if (tau === 8.1) scan.said = SC.facts.jupiter.every(f => h.readout().includes(f));
  }
  J.t -= dJ;
  // the table: numbers for every place the ship visits, and each size the body is drawn at (Saturn is drawn at its mean radius, 3% under its
  // equatorial one, which the table gives; "2.4 million km" is rounded to 1%)
  for (const k of SC.targets) if (!(SC.facts[k] || []).length) scan.noFacts.push(k);
  for (const [k, f] of Object.entries(SC.facts)){ const m = /^([\d,.]+)( million)? km wide/.exec(f[0]), o = C.BYKEY[k]; if (!m || !o || !o.solid) continue;
    scan.sizes.push([k, +Math.abs(2*o.rad*o.solid*LYKM/(+m[1].replace(/,/g, '')*(m[2] ? 1e6 : 1)) - 1).toFixed(4)]); }
  r.scan = scan;
  // a weapons test: an attack run on the Moon, its nose on it; Pip settles on the needle and the railgun unfolds round it (fully), fires three
  // rail slugs and a big shot straight along the heading, each making a blast and a crater; it folds away, and some seconds later every trace of
  // the shots is gone
  // (only what the job made counts: the streak the ship leaves when it jumps away from the Moon later is also tied to the Moon)
  D.force({ target:'moon', act:'weapons', travel:'light' }); D.replan(); D.skip();
  n = 0; while (!(S.phase === 'pass' && S.target.key === 'moon') && n++ < 30*60) C.tick(dt);
  const pip = D.drone, dr = C.BYKEY['halo-drone'];
  const made = new Set(), kinds = new Set(); let blasts = 0, gunForm = false, aimOff = 0; n = 0;
  while (D.act === 'weapons' && n++ < 30*40){ C.tick(dt); const gg = D.FX.find(e => e.kind === 'gun'); if (gg && gg.dc >= 1.599) gunForm = true;
    // (each shot leaves along the ship's heading: its streak's direction as it fired)
    for (const e of D.FX) if ((e.kind === 'pg-slug' || e.kind === 'pg-big') && e.t === dt && e.dir){ const hd = [h.R0[3], h.R0[4], h.R0[5]]; aimOff = Math.max(aimOff, Math.acos(Math.min(1, e.dir[0]*hd[0] + e.dir[1]*hd[1] + e.dir[2]*hd[2]))*57.3); } const b = D.FX.filter(e => e.anc === C.BYKEY.moon || e.kind === 'gun'); b.forEach(e => { made.add(e); kinds.add(e.kind); }); blasts = Math.max(blasts, b.length); }
  for (let i=0;i<30*8;i++) C.tick(dt);
  const fired = k => [...made].filter(e => e.kind === k).length;
  r.blasts = blasts; r.leftAfter = D.FX.filter(e => made.has(e)).length; r.shots = [...kinds].sort().join(' ');
  r.gun = { form:gunForm, bolts:fired('pg-slug'), balls:fired('pg-big'), craters:fired('pg-crater'), after:pip.state.form, aimOff:+aimOff.toFixed(2) };
  // Pip out and about (0.9.9: out for most of every stay): at Mars, from its arrival to the jump away, with Pip's own show (the probe job) on
  // the first pass. It comes out and is out for most of the stay, in the picture of the camera locked on the ship for much of it; it does
  // several bits and says what it does; its face changes with them (three faces or more, happy among them); its body never touches the hull
  // (clr: the hull's distance from its centre, as the ship's shader draws it, less its radius) nor dips below the drawn surface; it is never
  // more than PIP_FAR (3.2) ship radii from the ship's centre; it is back in the bay, as embers, before the ship jumps (never out in light
  // speed or a fold); and the show's outings differ from the last show's
  D.force({ target:'mars', act:'probe', travel:'fold' }); D.replan(); D.skip();
  n = 0; while (!(S.phase === 'pass' && S.target.key === 'mars') && n++ < 30*60) C.tick(dt);
  const stayOf = (hurryAt = -1) => {
    const v0 = S.visits, at = S.target.key, lines = new Set(), faces = new Set(), bits = new Set();
    let ticks = 0, outN = 0, shown = 0, clr = 9, far = 0, low = 9, left = false, hurried = null, back = null, sad = null, emb = -1, wasOut = false, show = null; n = 0;
    while (S.visits === v0 && n++ < 30*260){
      C.tick(dt); const s = pip.state;
      if (S.phase === 'pass' || S.phase === 'loop') ticks++;
      if (!show && D.act === 'probe' && pip.plan && pip.plan.acts.length) show = pip.plan.acts.join(' ');
      if (s.st === 'out'){ outN++; wasOut = true; if (s.shows) shown++; if (s.form === 'pod') clr = Math.min(clr, s.clr); far = Math.max(far, s.far);
        if (S.phase === 'light' || S.phase === 'fold') left = true;
        faces.add(s.face); if (s.bit) bits.add(s.bit); if (hurried != null && sad == null && !s.bk) sad = s.face === 'sad';
        const tg = S.target, R = D.surfDrawn(tg); low = Math.min(low, (Math.hypot(...dr.rel.map((x, k) => x - tg.rel[k])) - R - dr.rad*s.scale)/R);
        if (hurryAt >= 0 && hurried == null && S.stay && S.stay.t >= hurryAt){ pip.hurry(); hurried = S.stay.t; } }
      else { if (hurried != null && back == null) back = +(S.stay.t - hurried).toFixed(2); if (wasOut && emb < 0) emb = +s.embIn.toFixed(3); if (S.phase === 'light' || S.phase === 'fold') { /* home: fine */ } }
      for (const L of h.readout().split('\n')) if (/Pip/.test(L)) lines.add(L);
      if (hurryAt >= 0 && back != null && S.stay.t > hurried + 3) break;
    }
    return { at, ticks, out:outN, shown, clr:+clr.toFixed(4), far:+far.toFixed(2), low:+low.toFixed(4), left, emb, lines:lines.size, faces:[...faces].join(' '), bits:[...bits].sort().join(' '), show, back, sad };
  };
  r.pip = stayOf();
  // (the next stop, Jupiter, with another show: 20 s into the stay Pip is called home early, drone.hurry, as for a ship that has to leave now)
  n = 0; while (S.phase !== 'pass' && n++ < 30*60) C.tick(dt);
  D.force({ target:'jupiter', act:'probe', travel:'fold' }); D.replan(); D.skip();
  n = 0; while (!(S.phase === 'pass' && S.target.key === 'jupiter') && n++ < 30*120) C.tick(dt);
  r.pip2 = stayOf(20);
  // its dice: 40 outings in a row, as a visitor would see them, never the same twice running and all four kinds, launches and ways home used
  const mixes = []; let last = '', lastActs = ''; for (let s = 1; s <= 40; s++){ const m = pip.mix(s*7919 + 17, false, last, lastActs); mixes.push(m); last = m.sig; lastActs = m.acts.join(); }
  r.mix = { distinct:new Set(mixes.map(m => m.acts.join())).size, repeats:mixes.filter((m, i) => i && m.acts.join() === mixes[i - 1].acts.join()).length,
    acts:new Set(mixes.flatMap(m => m.acts)).size, launch:new Set(mixes.map(m => m.launch)).size, ret:new Set(mixes.map(m => m.ret)).size };
  // a scan at a black hole (Sgr A*): nothing of it is ever drawn inside the shadow (there the picture is the same with the hologram as without it,
  // pixel for pixel, while just outside it the hologram shows); and when the job is over nothing of it is left (the hole's own draw hook back,
  // no labels, no lines, no hologram). (A route of its own from Saturn, so the scan is sure to be there, whatever the ship was doing)
  D.reset(HALO_SEED); C.tick(0);
  D.force({ target:'sgra', act:'scan', travel:'fold' }); D.replan(); D.skip();
  n = 0; while (!(S.phase === 'pass' && S.target.key === 'sgra') && n++ < 30*60) C.tick(dt);
  C.view('halo', 0);
  n = 0; while (D.tau < 4 && n++ < 30*60) C.tick(dt);
  const cv = document.querySelector('#view'), gl = cv.getContext('webgl2'), sg = C.BYKEY.sgra, kp = cv.width/cv.clientWidth, pr = C.proj('sgra');
  const rs = pr ? sg.holeR/(pr.z*ty)*(cv.clientHeight/2) : 0;   // (the shadow's radius on screen, CSS pixels)
  // (the brightness of the drawn pixels r0 to r1 CSS pixels from the hole's centre, those on the canvas)
  const grab = (r0, r1) => { C.render(); const x0 = clamp_(Math.floor((pr.x - r1)*kp), 0, cv.width), x1 = clamp_(Math.ceil((pr.x + r1)*kp), 0, cv.width), y0 = clamp_(Math.floor(cv.height - (pr.y + r1)*kp), 0, cv.height), y1 = clamp_(Math.ceil(cv.height - (pr.y - r1)*kp), 0, cv.height);
    const w = x1 - x0, hh = y1 - y0, px = new Uint8Array(Math.max(w*hh, 1)*4), out = []; if (w > 0 && hh > 0) gl.readPixels(x0, y0, w, hh, gl.RGBA, gl.UNSIGNED_BYTE, px);
    for (let j=0;j<hh;j++) for (let i=0;i<w;i++){ const d = Math.hypot((x0 + i + 0.5)/kp - pr.x, (cv.height - (y0 + j + 0.5))/kp - pr.y); if (d >= r0 && d < r1) out.push(px[(j*w + i)*4] + px[(j*w + i)*4 + 1] + px[(j*w + i)*4 + 2]); } return out; };
  const clamp_ = (x, a, b) => Math.min(b, Math.max(a, x));
  let inside = -1, outside = -1;
  // (with the screen's glow off: it blurs every bright thing a little, over the shadow's edge too)
  if (rs > 12 && D.act === 'scan'){ const glow = C.SET.glow; C.setOpt('glow', false, true);
    SC.dbg.noHolo = true; const offIn = grab(0, 0.8*rs), offOut = grab(1.1*rs, 1.9*rs); SC.dbg.noHolo = false; const onIn = grab(0, 0.8*rs), onOut = grab(1.1*rs, 1.9*rs);
    inside = onIn.length > 50 ? Math.max(0, ...onIn.map((v, i) => Math.abs(v - offIn[i]))) : -1; outside = onOut.filter((v, i) => Math.abs(v - offOut[i]) > 30).length;
    C.setOpt('glow', glow, true); }
  scan.hole = { at:S.target.key, act:D.act, r:+rs.toFixed(1), inside, outside };
  n = 0; while (D.act === 'scan' && n++ < 30*40) C.tick(dt);
  const holo0 = SC.dbg.holo; C.render(); C.hud();
  scan.left = { hook:Object.prototype.hasOwnProperty.call(sg, 'drawBefore'), labels:SC.labels.length, lines:SC.dbg.lines, holo:SC.dbg.holo - holo0 };
  // a weapons test there (the lab's button, at once): no point or line end of a shot or a blast is ever drawn inside the shadow as the camera
  // sees it, in front of the hole or behind it (the gun by the ship is not a shot), while the shots do show round it
  // (the railgun fires only on an attack run: the job waits for the next pass, which is one)
  const wh = { started:h.demo.jobNow('weapons'), inside:0, shown:0, kinds:new Set() };
  n = 0; while (D.act !== 'weapons' && n++ < 30*120) C.tick(dt);
  n = 0; while (D.act === 'weapons' && n++ < 30*60){ C.tick(dt);
    if (n % 3) continue;
    const Hc = sg.rel, hl = Math.hypot(...Hc);
    for (const [kind, q] of D.fxPts()){ if (kind.startsWith('gun')) continue; wh.kinds.add(kind);
      for (let i=0;i<q.length;i+=3){ const p = [q[i], q[i + 1], q[i + 2]], pl = Math.hypot(...p); if (!(pl > 0) || p[0]*C.cam.fwd[0] + p[1]*C.cam.fwd[1] + p[2]*C.cam.fwd[2] <= 0) continue;
        const cx = Hc[1]*p[2] - Hc[2]*p[1], cy = Hc[2]*p[0] - Hc[0]*p[2], cz = Hc[0]*p[1] - Hc[1]*p[0], b = Math.hypot(cx, cy, cz)/pl;
        if (b < sg.holeR && p[0]*Hc[0] + p[1]*Hc[1] + p[2]*Hc[2] > 0) wh.inside++; else wh.shown++; } } }
  r.wHole = { started:wh.started, inside:wh.inside, shown:wh.shown, kinds:[...wh.kinds].sort().join(' ') };
  return r;
}, HALO_SEED);
if (halo.stopped) fail('the Halo stood still for ' + halo.stopped + ' steps');
if (halo.minTurnRadius < 20) fail('the Halo turned on the spot (turn radius ' + halo.minTurnRadius + ' ship lengths)');
if (halo.maxTurn20s > 300) fail('the Halo turned ' + halo.maxTurn20s + ' degrees within 20 s (circling)');
if (halo.maxRate > halo.rateLimit) fail('the Halo turned at ' + halo.maxRate + ' degrees a second, faster than its tightest turn (a corner in its path)');
if (!halo.modes.light || !halo.modes.fold) fail('the Halo did not use both light speed and folds: ' + JSON.stringify(halo.modes));
if (Object.keys(halo.acts).length < 3) fail('the Halo did fewer than 3 kinds of job: ' + JSON.stringify(halo.acts));
if (halo.stays.length < 2 || halo.stays.some(s => s.t < 90 || s.t > 200 || s.passes < 3)) fail('the Halo did not roam round each place for about two minutes (90 to 200 s, three passes or more): ' + JSON.stringify(halo.stays));
const sc = halo.scan;
if (sc.holo < 3 || sc.kind !== 0 || sc.frame > 1e-9 || sc.ring < 48 || !(sc.worst < 1e-3)) fail('the scan\'s hologram is not on Jupiter\'s drawn surface: ' + JSON.stringify({ holo:sc.holo, kind:sc.kind, frame:sc.frame, ring:sc.ring, worst:sc.worst }));
if (sc.faceMin < 0.2) fail('a scan bracket sits on a feature the camera cannot see: ' + sc.faceMin);
// (on another route, HALO_SEED, the camera may not see Jupiter's southern latitudes at all; on the route every run flies, seed 1, it does)
if ((sc.turned || HALO_SEED === 1) && !(sc.brk >= 0 && sc.brk < 1e-6)) fail('the Great Red Spot\'s bracket is not on the spot: ' + JSON.stringify({ turned:sc.turned, off:sc.brk }));
if (!sc.said || sc.noFacts.length || sc.sizes.some(s => s[1] > 0.04)) fail('the scan\'s numbers do not match its table, or the table the drawn sizes: ' + JSON.stringify({ said:sc.said, noFacts:sc.noFacts, sizes:sc.sizes }));
if (sc.lines > 1500) fail('the scan drew ' + sc.lines + ' line ends in a frame');
if (sc.left.hook || sc.left.labels || sc.left.lines || sc.left.holo) fail('the scan left something behind: ' + JSON.stringify(sc.left));
if (!(sc.hole.inside === 0 && sc.hole.outside > 20)) fail('the scan drew inside Sgr A*\'s shadow, or nothing round it: ' + JSON.stringify(sc.hole));
{ const p = halo.pip, q = halo.pip2, m = halo.mix;
  if (p.at !== 'mars' || p.out < 0.6*p.ticks || p.shown < 0.35*p.out || p.lines < 5 || p.bits.split(' ').length < 4 || !p.show) fail('Pip, the drone, was not out for most of the stay at Mars, in the picture, saying what it does and doing several things: ' + JSON.stringify(p));
  if (p.left || !(p.emb >= 0.999)) fail('Pip was out when the ship left, or did not go back into the bay as embers: ' + JSON.stringify({ left:p.left, emb:p.emb }));
  for (const o of [p, q]) if (!(o.far <= 3.3) || !(o.clr >= -0.002) || !(o.low > 0)) fail('Pip went far from the ship, into its hull or below the surface: ' + JSON.stringify(o));
  if (q.at !== 'jupiter' || !q.show || q.show === p.show) fail("two of Pip's shows in a row were the same: " + JSON.stringify({ first:p.show, second:q.show }));
  if (!(q.back > 0 && q.back <= 1.7)) fail('Pip called home early (drone.hurry) was not back in the bay within 1.7 s: ' + JSON.stringify(q));
  if (p.faces.split(' ').length < 3 || !/happy/.test(p.faces) || q.sad !== true) fail("Pip's face did not change with what it does, or it did not look sad called home early: " + JSON.stringify({ faces:p.faces, sad:q.sad }));
  if (m.repeats || m.distinct < 12 || m.acts !== 4 || m.launch !== 3 || m.ret !== 3) fail('Pip\'s outings do not vary enough: ' + JSON.stringify(m)); }
{ const g = halo.gun; if (!halo.blasts || halo.leftAfter || halo.shots !== 'gun pg-big pg-blast pg-crater pg-slug' || !g.form || g.bolts !== 3 || g.balls !== 1 || g.craters !== 4 || g.after !== 'pod' || g.aimOff > 1)
  fail('the weapons test did not unfold the railgun, fire three slugs and a big shot along the heading, and leave nothing behind: ' + JSON.stringify({ blasts:halo.blasts, left:halo.leftAfter, shots:halo.shots, gun:g })); }
{ const w = halo.wHole; if (!w.started || w.inside || w.shown < 500 || w.kinds !== 'pg-big pg-fall pg-slug') fail("the weapons test drew inside Sgr A*'s shadow, or too little round it: " + JSON.stringify(w)); }

// 8b. hops that went wrong before 0.8.7, each flown on purpose from a pass that showed it: into a galaxy the ship is inside (it flew out to the
// start of the pass and U-turned there; now it folds), Jupiter to Europa (the turn before the jump aimed from the wrong place, so the leg
// began with a corner), the Pleiades to HL Tau (a glide that overshot and parked the ship), the Milky Way to Earth and M87 to Proxima (the
// last stretch of a very long leg moved in jerks, rounding over the whole distance; M87 by light speed is forced, the site folds that far).
// On every one the ship gets there, never stands still, and never turns faster than its tightest turn
const hops = await page.evaluate(() => {
  const C = __cosmos, h = C.BYKEY.halo, D = h.dbg, S = h.S, dt = 1/30, limit = 3*D.HALO.TURN*57.3*1.05, out = [];
  const head = () => [h.R0[3], h.R0[4], h.R0[5]];
  for (const [a, b, seed] of [['earth', 'milkyway', 1], ['sn1987a', 'lmc', 1], ['jupiter', 'europa', 32], ['pleiades', 'hltau', 10], ['milkyway', 'earth', 1], ['m87bh', 'proxima', 1]]){
    C.setDays(0); C.view('earth', 0); D.reset(seed, a); C.tick(0);
    D.force({ target:b, travel:'light' }); D.replan();
    let H0 = head(), O0 = h.offset.slice(), P0 = h.pos.slice(), par0 = h.parent, ph0 = S.phase, rate = 0, stood = 0, n = 0, end = -1, by = null;
    while (n++ < 30*120){
      C.tick(dt);
      if (S.phase === 'light' || S.phase === 'fold') by = S.phase;
      const H = head(), same = S.phase === ph0 && S.phase !== 'fold' && ph0 !== 'fold', ang = Math.acos(Math.min(1, Math.max(-1, H[0]*H0[0] + H[1]*H0[1] + H[2]*H0[2])));
      // (moved: relative to the body it is at, exact; across a change of body, between absolute positions)
      const mv = h.parent === par0 ? Math.hypot(h.offset[0] - O0[0], h.offset[1] - O0[1], h.offset[2] - O0[2]) : Math.hypot(h.pos[0] - P0[0], h.pos[1] - P0[1], h.pos[2] - P0[2]);
      if (same){ if (!(mv > 0)) stood++; rate = Math.max(rate, ang/dt*57.3); }
      H0 = H; O0 = h.offset.slice(); P0 = h.pos.slice(); par0 = h.parent; ph0 = S.phase;
      if (S.phase === 'pass' && S.target.key === b && end < 0) end = n + 150;   // (on 5 s into the pass there: an arrival swing shows then)
      if (end > 0 && n >= end) break;
    }
    out.push({ hop:a + ' > ' + b, by, arrived:end > 0, stood, rate:+rate.toFixed(1) });
  }
  return { out, limit:+limit.toFixed(1) };
});
for (const o of hops.out) if (!o.arrived || o.stood || o.rate > hops.limit) fail(`the Halo's hop ${o.hop} went wrong (turn rate limit ${hops.limit} degrees a second): ` + JSON.stringify(o));

// 9. staying with it: H goes home to Earth's opening view and pauses a running tour ("resume tour" stays); a camera that lets go of
// Earth keeps moving with it (the Solar System clock does not carry it away) and says so; play and the "back to" pill fly back;
// letting go of Jupiter does not blow it up around the camera (the overview still enlarges it); W A S D stays within reach of something
const stay = await page.evaluate(() => {
  const C = __cosmos, E = C.BYKEY.earth, J = C.BYKEY.jupiter, cam = C.cam, r = {}, key = (k, type = 'keydown') => dispatchEvent(new KeyboardEvent(type, { key:k, bubbles:true }));
  const txt = s => document.querySelector(s).textContent, off = o => { const v = o.rel, l = Math.hypot(...v); return Math.acos(Math.min(1, (v[0]*cam.fwd[0] + v[1]*cam.fwd[1] + v[2]*cam.fwd[2])/l))*180/Math.PI; };
  C.startTour('grand'); C.land(0.1); C.tourGo(C.BYKEY.crab.index, true); C.tick(1/60);   // (really at the Crab: the flight to the first stop has landed)
  const at = C.flight ? 'flying' : C.OBJ[C.orbit.lock].key;
  key('h'); r.home = { at, tour:C.tour.on, last:C.tour.last != null ? C.OBJ[C.tour.last].key : null, to:C.stepTarget };
  C.land(0.3); C.hud(); r.home.lock = C.orbit.lock >= 0 ? C.OBJ[C.orbit.lock].key : null; r.home.view = C.show.view; r.home.resume = !document.getElementById('goNext').hidden && document.getElementById('goNext').textContent === 'back to the tour · Crab Nebula›';
  C.setTour(false); C.view('earth', 0); C.hud(); r.here = txt('#objDist');
  key('Escape'); for (let i=0;i<60*5;i++) C.tick(1/60); C.hud();
  r.drift = { off:+off(E).toFixed(2), focus:C.OBJ[cam.focus].key, free:C.orbit.lock < 0, where:txt('#objDist'), play:document.getElementById('btnPlay').getAttribute('aria-label') };
  key(' '); r.back = C.stepTarget; C.land(0.3); r.backLock = C.orbit.lock >= 0 ? C.OBJ[C.orbit.lock].key : null;
  C.unlock(); C.orbit.target = C.orbit.target.map((v, i) => v + cam.right[i]*E.rad*12); for (let i=0;i<60;i++){ C.tick(1/60); C.hud(); }
  const pill = document.getElementById('backPill'); r.pill = pill.hidden ? null : pill.textContent; pill.click(); r.pillTo = C.stepTarget; C.land(0.3);
  C.view('jupiter', 0); for (let i=0;i<60;i++) C.tick(1/60); C.unlock(); for (let i=0;i<60*5;i++) C.tick(1/60); r.jupiterFree = +(J.mag || 1).toFixed(2);
  C.view('solarsystem', 0); C.unlock(); for (let i=0;i<60*5;i++) C.tick(1/60); r.overviewFree = +(J.mag || 1).toFixed(1);
  C.view('earth', 0); C.unlock(); for (let i=0;i<30;i++) C.tick(1/60);
  key('s'); let worst = 0; for (let i=0;i<60*30;i++){ C.tick(1/60); let g = Infinity; for (const o of C.OBJ) if (o.layer >= 2 && !o.noPick && !o.marker && !o.hidden && o.key !== 'halo' && o.dist > o.rad) g = Math.min(g, o.dist - o.rad*(o.solid || 1)); worst = Math.max(worst, g/C.orbit.dist); }
  key('s', 'keyup'); r.reach = +worst.toFixed(2);
  return r;
});
if (stay.home.at !== 'crab' || stay.home.tour || stay.home.last !== 'crab' || stay.home.to !== 'earth' || stay.home.lock !== 'earth' || stay.home.view !== 0 || !stay.home.resume) fail('H did not fly home to Earth and pause the tour: ' + JSON.stringify(stay.home));
if (stay.here !== 'you are here') fail('Earth\'s card does not say "you are here": ' + stay.here);
if (!(stay.drift.off <= 2) || stay.drift.focus !== 'earth' || !stay.drift.free) fail('the free camera did not keep moving with Earth: ' + JSON.stringify(stay.drift));
if (stay.drift.where !== 'free camera · H for home') fail('the card still says "' + stay.drift.where + '" in free camera');
if (stay.drift.play !== 'Back to Earth (space)' || stay.back !== 'earth' || stay.backLock !== 'earth') fail('play in free camera did not fly back to Earth: ' + JSON.stringify(stay));
if (!stay.pill || !/^.back to Earth · [\d,]+ km$/.test(stay.pill) || stay.pillTo !== 'earth') fail('no "back to Earth" pill, or it did not fly back: ' + JSON.stringify({ pill:stay.pill, to:stay.pillTo }));
if (stay.jupiterFree > 1.5) fail('Jupiter swelled x' + stay.jupiterFree + ' around a camera that had just let go of it');
if (!(stay.overviewFree > 5)) fail('the Solar System overview no longer enlarges Jupiter in free camera (x' + stay.overviewFree + ')');
if (stay.reach > 8.2) fail('W A S D took the camera ' + stay.reach + ' view distances from anything');

// 10. saying where it goes: the green button beside the name ("next stop · Moon", "start again" on the last stop, "back to the tour" after
// leaving it, hidden with no tour); the tour's name opens the tours; the ‹ › around "tours" and the second resume button are gone;
// [ ] step tour stops on a tour; Esc closes an open panel or the search before it lets go; the scale bar hides while the atlas is open,
// and a pick empties the search box; on the tour Earth plays three angles, about 30 s
const say = await page.evaluate(() => {
  const C = __cosmos, g = document.getElementById('goNext'), key = k => dispatchEvent(new KeyboardEvent('keydown', { key:k, bubbles:true })), r = {};
  const btn = () => g.hidden ? null : g.textContent, lock = () => C.orbit.lock >= 0 ? C.OBJ[C.orbit.lock].key : null;
  C.startTour('grand'); C.land(0.1); C.hud(); r.first = btn(); r.stop = document.getElementById('stopInfo').textContent;
  g.click(); r.clickTo = C.stepTarget; C.land(0.1);
  key(']'); r.keyNext = C.stepTarget; C.land(0.1); key('['); r.keyPrev = C.stepTarget; C.land(0.1);
  C.tourGo(C.TOUR[C.TOUR.length - 1], true); C.tick(1/60); C.hud(); r.last = btn(); g.click(); r.againTo = C.stepTarget; C.land(0.1);
  C.lockOn(C.BYKEY.mars.index); C.land(0.1); C.hud(); r.left = btn(); r.leftBack = g.classList.contains('back'); g.click(); r.backTo = C.stepTarget; r.backTour = C.tour.on; C.land(0.1);
  C.setTour(false); C.tour.last = null; C.lockOn(C.BYKEY.mars.index); C.land(0.1); C.hud(); r.none = btn();
  r.gone = ['tourPrev', 'tourNext', 'btnResume', 'btnResumeI'].filter(id => document.getElementById(id));
  document.getElementById('btnSettings').click(); key('Escape'); r.escSettings = { open:!document.getElementById('settings').hidden, lock:lock() };
  // (also with the focus on one of its sliders)
  document.getElementById('btnSettings').click(); const ts = document.getElementById('textSize'); ts.focus(); ts.dispatchEvent(new KeyboardEvent('keydown', { key:'Escape', bubbles:true }));
  r.escSlider = { open:!document.getElementById('settings').hidden, lock:lock() };
  document.getElementById('btnAtlas').click(); r.ladderInAtlas = getComputedStyle(document.getElementById('ladder')).display; key('Escape'); r.escAtlas = { open:!document.getElementById('atlas').hidden, lock:lock() };
  const s = document.getElementById('search'); s.focus(); s.value = 'jupiter'; s.dispatchEvent(new Event('input', { bubbles:true }));
  s.dispatchEvent(new KeyboardEvent('keydown', { key:'Enter', bubbles:true })); r.pick = { to:C.stepTarget, box:s.value, box2:document.getElementById('atlasSearch').value }; C.land(0.1);
  s.focus(); s.value = 'sat'; s.dispatchEvent(new Event('input', { bubbles:true })); s.dispatchEvent(new KeyboardEvent('keydown', { key:'Escape', bubbles:true }));
  r.escSearch = { atlas:!document.getElementById('atlas').hidden, box:s.value, lock:lock() };
  key('Escape'); r.escNothing = lock();
  // Earth on the tour: three angles, about 30 s (it was five, a minute)
  C.setOpt('travel', 'cinematic', true); C.startTour('grand'); C.land(0.1); C.tourGo(C.BYKEY.earth.index, true);
  let t = 0; const seen = []; while (C.tour.obj === C.BYKEY.earth.index && t < 120){ C.tick(1/30); t += 1/30; if (C.tour.obj === C.BYKEY.earth.index && seen[seen.length - 1] !== C.tour.view) seen.push(C.tour.view); }
  r.earth = { t:+t.toFixed(1), views:seen }; C.setOpt('travel', 'quick', true); C.setTour(false);
  return r;
});
if (say.first !== 'next stop · Moon›' || say.stop !== 'stop 1 / 31' || say.clickTo !== 'moon') fail('the green button on the tour: ' + JSON.stringify(say));
if (say.keyNext !== 'sun' || say.keyPrev !== 'moon') fail('[ ] did not step the tour stops: ' + JSON.stringify({ next:say.keyNext, prev:say.keyPrev }));
if (say.last !== 'start again›' || say.againTo !== 'earth') fail('the last stop does not offer "start again": ' + JSON.stringify({ last:say.last, to:say.againTo }));
if (say.left !== 'back to the tour · Earth›' || !say.leftBack || say.backTo !== 'earth' || !say.backTour) fail('leaving the tour does not offer the way back: ' + JSON.stringify({ left:say.left, to:say.backTo, tour:say.backTour }));
if (say.none !== null) fail('the green button shows with no tour involved: ' + say.none);
if (say.gone.length) fail('these should be gone: ' + say.gone.join(', '));
if (say.escSettings.open || say.escSettings.lock !== 'mars') fail('Esc did not close settings first: ' + JSON.stringify(say.escSettings));
if (say.escSlider.open || say.escSlider.lock !== 'mars') fail('Esc on a settings slider did not close settings (or let go): ' + JSON.stringify(say.escSlider));
if (say.ladderInAtlas !== 'none') fail('the scale bar shows while the atlas is open');
if (say.escAtlas.open || say.escAtlas.lock !== 'mars') fail('Esc did not close the atlas first: ' + JSON.stringify(say.escAtlas));
if (say.pick.to !== 'jupiter' || say.pick.box || say.pick.box2) fail('a pick from the search did not empty the box: ' + JSON.stringify(say.pick));
if (say.escSearch.atlas || say.escSearch.box || !say.escSearch.lock) fail('Esc in the search did not close it (or let go): ' + JSON.stringify(say.escSearch));
if (say.escNothing !== null) fail('Esc with nothing open did not let go of the object');
if (say.earth.views.join() !== '0,2,1' || say.earth.t < 26 || say.earth.t > 36) fail('the tour does not play three Earth angles in about 30 s: ' + JSON.stringify(say.earth));

// 11. the random tour (second in the list of tours): 12 places from the whole atlas, a new mix on every start. No place twice (a place and
// what belongs to it count as one), never the Halo, at most 3 of one kind, never where it sets off from, and the first stop is not even the
// same place (from Earth the Moon may come later, not first); places not seen yet come first (a seen place only when no unseen one could
// be dealt, or when every trip to one would be much rougher than to a seen place); with only 6 places left unseen the trips stay smooth;
// the tour track on the scale bar shows each new deal's names; on the last stop the green button (also when paused there), ] and the end
// of the last angle deal 12 new places from there, none of the 12 just played (dealt ahead while that stop plays or waits paused); with the
// list of tours open a first random tour is dealt ahead too; a shared link starts a new random tour at the linked place (a link to 'your
// sky' opens the sky); the same seed deals the same tour (visitors get their seed from Math.random); and the tour played as a visitor
// sees it (every angle, then the trip into the next deal) never dips or flies through a third object.
// (Deterministic: the page is frozen, so no live frame marks places seen between the steps; it starts with nothing seen, whatever the
// sections above did, and with the Solar System clock on a fixed date, so the planets stand in the same places on any day. What it has
// seen and the clock are put back at the end)
const rt = await page.evaluate(() => {
  const C = __cosmos, g = document.getElementById('goNext'), key = k => dispatchEvent(new KeyboardEvent('keydown', { key:k, bubbles:true })), r = {};
  const wasFrozen = window.__freeze; window.__freeze = true; const wasSeen = [...C.SEEN]; C.SEEN.clear();
  location.hash = '#o=earth&jd=2461310.5'; C.applyHash(); history.replaceState(null, '', location.pathname);   // (2026-09-27 0:00 UTC)
  const keys = () => C.TOUR.map(i => C.OBJ[i].key), btn = () => g.hidden ? null : g.textContent, catOf = o => o.atlasKind || ((o.isBH || o.prog === C.BYKEY.sgra.prog) ? 'bh' : o.group);   // (as catOf in 09-render.js: the S-stars are stars)
  const overlap = T => C.TOUR.filter(i => T.includes(i)).length;
  const check = (T, from) => { const os = T.map(i => C.OBJ[i]), bad = [], per = {};
    if (T.length !== 12 || new Set(T).size !== 12) bad.push(T.length + ' stops');
    os.forEach((o, i) => { if (!C.tourable(o)) bad.push(o.key + ' may not be toured'); if (from && (o === from || (i === 0 && C.samePlace(from, o)))) bad.push(o.key + ' is where it set off'); per[catOf(o)] = (per[catOf(o)] || 0) + 1; });
    os.forEach((a, i) => os.slice(i + 1).forEach(b => { if (C.samePlace(a, b)) bad.push(a.key + ' and ' + b.key + ' are one place'); }));
    for (const c in per) if (per[c] > 3) bad.push(per[c] + ' stops of ' + c);
    return bad; };
  C.setOpt('dwell', 'normal', true); C.setTour(false); C.randomSeed(1); C.lockOn(C.BYKEY.earth.index); C.land(0.1);
  const row = document.querySelectorAll('#tourList .trow')[1]; row.click(); C.hud();
  r.first = { id:C.tourId, n:C.TOUR.length, bad:check(C.TOUR, C.BYKEY.earth), halo:keys().includes('halo'), row:row.querySelector('b').textContent, current:row.getAttribute('aria-current'),
    head:document.getElementById('modeTourName').textContent, stop:document.getElementById('stopInfo').textContent, to:C.stepTarget, want:keys()[0] };
  const T1 = C.TOUR.slice(); C.land(0.1);
  C.startTour('random'); C.hud();
  r.second = { overlap:overlap(T1), bad:check(C.TOUR, C.OBJ[T1[0]]), track:[...document.querySelectorAll('.tour-track .tt')].map(b => b.textContent).join('|'), names:C.TOUR.map(i => C.OBJ[i].label || C.OBJ[i].name).join('|') };
  C.land(0.1);
  const T2 = C.TOUR.slice(), gen = C.tourGen; C.tourGo(T2[11], true); C.tick(1/60); C.hud();
  r.last = { btn:btn(), title:g.title }; g.click();
  r.deal = { on:C.tour.on, gen:C.tourGen > gen, overlap:overlap(T2), to:C.stepTarget, first:keys()[0], bad:check(C.TOUR, C.OBJ[T2[11]]) }; C.land(0.1);
  const T3 = C.TOUR.slice(); C.tourGo(T3[11], true); C.tick(1/60); key(']');
  r.key = { overlap:overlap(T3), to:C.stepTarget, first:keys()[0] }; C.land(0.1);
  // (paused there, the next 12 are dealt ahead too)
  const T4 = C.TOUR.slice(); C.tourGo(T4[11], true); C.tick(1/60); document.getElementById('btnPlay').click(); C.tick(1/60); C.hud();
  r.paused = { on:C.tour.on, btn:btn() }; let n4 = 0; while (!(C.nextDeal && C.nextDeal.stops) && n4++ < 900) C.tick(1/30);
  const pre4 = C.nextDeal && C.nextDeal.stops ? C.nextDeal.stops.map(([k]) => k).join() : null; g.click();
  Object.assign(r.paused, { after:C.tour.on, overlap:overlap(T4), to:C.stepTarget, first:keys()[0], ahead:pre4 === keys().join(), steps:n4 }); C.land(0.1);
  C.setOpt('dwell', 'short', true);
  const T5 = C.TOUR.slice(); C.tourGo(T5[11], true); let t = 0, ahead = null;
  while (C.tour.obj === T5[11] && t < 120){ const d = C.nextDeal; if (d && d.stops) ahead = d.stops.map(([k]) => k).join(); C.tick(1/30); t += 1/30; }
  r.auto = { overlap:overlap(T5), obj:C.OBJ[C.tour.obj].key, first:keys()[0], t:+t.toFixed(1), ahead:ahead === keys().join(), bad:check(C.TOUR, C.OBJ[T5[11]]) }; C.setOpt('dwell', 'normal', true); C.land(0.1);
  C.setTour(false); location.hash = '#o=crab&tour=random'; const linked = C.applyHash();
  r.link = { linked, on:C.tour.on, id:C.tourId, first:keys()[0], n:C.TOUR.length, lock:C.orbit.lock >= 0 ? C.OBJ[C.orbit.lock].key : null, bad:check(C.TOUR, null), hash:C.viewHash() };
  // (not a place: 'your sky' is a backdrop, so a random tour link to it opens the sky without starting the tour)
  C.setTour(false); location.hash = '#o=backyard&tour=random'; C.applyHash();
  r.link.backyard = { first:keys()[0], lock:C.orbit.lock >= 0 ? C.OBJ[C.orbit.lock].key : null, on:C.tour.on };
  history.replaceState(null, '', location.pathname);
  // (with the list of tours open, a first random tour is dealt ahead from where you are, and its row starts that one)
  C.setTour(false); C.lockOn(C.BYKEY.saturn.index); C.land(0.1); document.getElementById('btnTours').click();
  let n5 = 0; while (!(C.nextDeal && C.nextDeal.stops) && n5++ < 900) C.tick(1/30);
  const pre5 = C.nextDeal && C.nextDeal.stops ? C.nextDeal.stops.map(([k]) => k).join() : null;
  document.querySelectorAll('#tourList .trow')[1].click();
  r.panel = { ahead:pre5 === keys().join(), steps:n5, on:C.tour.on, bad:check(C.TOUR, C.BYKEY.saturn) };
  if (!document.getElementById('tours').hidden) document.getElementById('toursClose').click(); C.land(0.1);
  const deal = s => { C.randomSeed(s); return C.dealRandom(C.BYKEY.earth, null, new Set()).join(); };
  r.seeded = { same:deal(7) === deal(7), differ:deal(7) !== deal(8) };
  // (from Earth, what belongs to Earth may come later in the tour)
  r.near = 0; for (let s = 1; s <= 30; s++){ C.randomSeed(s); if (C.dealRandom(C.BYKEY.earth, null, new Set()).some(([k]) => ['moon', 'iss', 'hubble', 'jwst'].includes(k))) r.near++; }
  // unseen first: with all but 10 places seen, a seen place is only dealt when none of the unseen ones could have been, or when the trip to
  // every one that could would weigh at most RANDOM_W.defer of the best trip to a seen place (it waits for a later stop, not dealt
  // through a zoom out to the whole universe and back)
  const W = C.RANDOM_W, E = C.BYKEY.earth, pool = C.tourPool(), unseen = new Set(pool.filter((o, i) => i % 12 === 2).slice(0, 10).map(o => o.key)), was = [...C.SEEN];
  C.SEEN.clear(); for (const o of pool) if (!unseen.has(o.key)) C.SEEN.add(o.key);
  r.tiers = { unseen:unseen.size, seen:0, waited:0, bad:[] };
  for (const s of [3, 4, 5]){
    C.randomSeed(s); const d = C.dealRandom(E, null, new Set()).map(([k]) => C.BYKEY[k]);
    d.forEach((o, i) => {
      if (!C.SEEN.has(o.key)) return; r.tiers.seen++;
      const before = d.slice(0, i), p = i ? d[i - 1] : E, per = {}; before.forEach(q => { per[catOf(q)] = (per[catOf(q)] || 0) + 1; });
      const run = i >= W.run && before.slice(i - W.run).every(q => catOf(q) === catOf(before[i - 1])) ? catOf(before[i - 1]) : null;
      const wOf = c => C.tripW(p, c)*(catOf(c) === run ? W.sameCat : 1);
      const ok = c => c !== E && !(i === 0 && C.samePlace(E, c)) && !before.some(q => C.samePlace(q, c)) && (per[catOf(c)] || 0) < 3;
      const best = Math.max(0, ...pool.filter(c => C.SEEN.has(c.key) && ok(c)).map(wOf)), open = pool.filter(c => !C.SEEN.has(c.key) && ok(c));
      const could = open.filter(c => wOf(c) > best*W.defer && C.tripClear(p, c));
      if (could.length) r.tiers.bad.push(`seed ${s}: ${o.key} (seen) at stop ${i + 1} while ${could.map(c => c.key).join(',')} were not`);
      else if (open.length) r.tiers.waited++;
    });
  }
  // only 6 places left unseen: the trips stay smooth. Each trip as it is flown, from the first tour angle of one stop to the next: how
  // much wider the widest view on the way is than the wider end
  const back = (a, b) => { C.view(a.key, (a.tourViews || [0])[0]); C.tourGo(b.index); const f = C.flight; C.tour.on = false; if (!f) return 1;
    let wm = 0; for (let i = 0; i <= 48; i++) wm = Math.max(wm, f.path.w(f.path.S*i/48)); return wm/Math.max(f.path.w(0), f.path.w(f.path.S)); };
  const fewSeen = s => { const keep = new Set(pool.slice().sort((x, y) => ((x.index*7919 + s*104729) % 1000) - ((y.index*7919 + s*104729) % 1000)).slice(0, 6).map(o => o.key));
    C.SEEN.clear(); for (const o of pool) if (!keep.has(o.key)) C.SEEN.add(o.key); return keep; };
  r.few = { n:0, b3:0, b5:0, unseen:0 };
  for (let s = 1; s <= 8; s++){
    const keep = fewSeen(s); C.randomSeed(s); let a = E;
    for (const [k] of C.dealRandom(E, null, new Set())){ const b = C.BYKEY[k], x = back(a, b); r.few.n++; if (x > 1e3) r.few.b3++; if (x > 1e5) r.few.b5++; if (keep.has(k)) r.few.unseen++; a = b; }
  }
  C.setTour(false); C.SEEN.clear(); for (const k of was) C.SEEN.add(k);
  // (trips as in 7; the star a planet at either end circles counts as part of that end: a trip to Kepler-16b may pass its suns. The third
  // tour is played with only 6 places left unseen)
  C.setOpt('travel', 'cinematic', true); C.setOpt('dwell', 'short', true); r.trips = { n:0, bad:[], deals:0 };
  for (const seed of [1, 2, 3]){
    if (seed === 3) fewSeen(seed);
    C.setTour(false); C.randomSeed(seed); C.view('earth', 0); C.startTour('random');
    const gen0 = C.tourGen; let a = C.BYKEY.earth, trip = null, n = 0;
    while (n++ < 30*1500){
      C.tick(1/30);
      if (C.flight){
        if (!trip){ const b = C.flight.dest || C.flight.obj; trip = { a, b, ws:[], inside:new Set(), around:o => [a, b].some(e => e.parent === o || Math.hypot(o.pos[0] - e.pos[0], o.pos[1] - e.pos[1], o.pos[2] - e.pos[2]) < o.rad) }; }
        trip.ws.push(C.orbit.dist);
        for (const o of C.OBJ) if (o !== trip.a && o !== trip.b && !o.parent && o.prog && o.layer >= 2 && !o.marker && o.dist < o.rad && !trip.around(o)) trip.inside.add(o.key);
      } else if (trip){
        const ws = trip.ws; let dips = 0; for (let j=2;j<ws.length - 2;j++) if (ws[j] < ws[j - 1]*0.999 && ws[j] < ws[j + 1]*0.999 && ws[j] < ws[j - 2] && ws[j] < ws[j + 2]) dips++;
        if (dips || trip.inside.size) r.trips.bad.push(`seed ${seed}, ${trip.a.key} -> ${trip.b.key}: ${dips} zoom dips, inside ${[...trip.inside].join(',') || '-'}`);
        r.trips.n++; a = trip.b; trip = null;
        if (C.tourGen > gen0){ r.trips.deals++; break; }   // (the trip into the next deal was the last one)
      }
    }
  }
  C.setOpt('travel', 'quick', true); C.setOpt('dwell', 'normal', true); C.setTour(false);
  C.SEEN.clear(); for (const k of wasSeen) C.SEEN.add(k); C.setDays(0); window.__freeze = wasFrozen;
  return r;
});
if (rt.first.id !== 'random' || rt.first.n !== 12 || rt.first.bad.length || rt.first.halo || rt.first.to !== rt.first.want) fail('the random tour did not deal 12 good places: ' + JSON.stringify(rt.first));
if (rt.first.row !== 'random tour' || rt.first.current !== 'true' || rt.first.head !== 'random tour' || rt.first.stop !== 'stop 1 / 12') fail('the random tour row, name or stop line: ' + JSON.stringify(rt.first));
if (rt.second.overlap || rt.second.bad.length) fail('starting the random tour again did not deal 12 new places: ' + JSON.stringify(rt.second));
if (rt.second.track !== rt.second.names) fail('the tour track kept the old names after a new deal: ' + rt.second.track + ' / ' + rt.second.names);
if (rt.last.btn !== 'new random tour›' || !/^12 new places/.test(rt.last.title)) fail('the last stop of the random tour does not offer a new one: ' + JSON.stringify(rt.last));
if (!rt.deal.on || !rt.deal.gen || rt.deal.overlap || rt.deal.to !== rt.deal.first || rt.deal.bad.length) fail('"new random tour" did not deal 12 new places and fly to the first: ' + JSON.stringify(rt.deal));
if (rt.key.overlap || rt.key.to !== rt.key.first) fail('] on the last stop did not deal a new random tour: ' + JSON.stringify(rt.key));
if (rt.paused.on || rt.paused.btn !== 'new random tour›' || !rt.paused.after || rt.paused.overlap || rt.paused.to !== rt.paused.first) fail('paused on the last stop, the green button did not deal a new random tour: ' + JSON.stringify(rt.paused));
if (rt.auto.overlap || rt.auto.obj !== rt.auto.first || rt.auto.bad.length) fail('the end of the last angle did not go on to a new random tour: ' + JSON.stringify(rt.auto));
if (!rt.auto.ahead) fail('the next random tour was not dealt ahead while the last stop played: ' + JSON.stringify(rt.auto));
if (!rt.paused.ahead) fail('paused on the last stop, the next random tour was not dealt ahead: ' + JSON.stringify(rt.paused));
if (!rt.panel.ahead || !rt.panel.on || rt.panel.bad.length) fail('with the list of tours open, a first random tour was not dealt ahead and started: ' + JSON.stringify(rt.panel));
if (!rt.link.linked || !rt.link.on || rt.link.id !== 'random' || rt.link.first !== 'crab' || rt.link.lock !== 'crab' || rt.link.n !== 12 || rt.link.bad.length || !/tour=random/.test(rt.link.hash)) fail('a shared random tour link did not start one at the Crab: ' + JSON.stringify(rt.link));
if (rt.link.backyard.first === 'backyard' || rt.link.backyard.lock !== 'backyard' || rt.link.backyard.on) fail('a random tour link to "your sky" did not open the sky without the tour: ' + JSON.stringify(rt.link.backyard));
if (!rt.seeded.same || !rt.seeded.differ) fail('the random tour does not follow its seed: ' + JSON.stringify(rt.seeded));
if (!rt.near) fail('no random tour from Earth in 30 visits the Moon, the ISS, Hubble or JWST');
if (rt.tiers.bad.length || rt.tiers.unseen !== 10 || rt.tiers.seen < 6) fail('the random tour dealt a place already seen before an unseen one: ' + JSON.stringify(rt.tiers));
if (rt.few.b5 > 0.06*rt.few.n || rt.few.b3 > 0.18*rt.few.n || rt.few.unseen < 4*8) fail('with 6 places left unseen, the random tour trips are not smooth (or skip the unseen places): ' + JSON.stringify(rt.few));
if (rt.trips.deals !== 3) fail('playing the random tour did not reach the next deal: ' + JSON.stringify(rt.trips));
if (rt.trips.bad.length) fail('random tour trips that dip or fly through something: ' + rt.trips.bad.join('; '));

report('motion', errors, `random tour: 12 places, unseen first (${rt.tiers.seen} seen places in 3 deals with 10 unseen, none too early, ${rt.tiers.waited} while the unseen ones were rough trips), with 6 unseen left ${rt.few.unseen}/${8*6} of them dealt in 8 deals and ${rt.few.b3} of ${rt.few.n} trips pull back over 1,000x (${rt.few.b5} over 100,000x), new names on the track, dealt ahead (last stop, paused, list open) and again at the end, ${rt.trips.n} trips played without dips · next stop, start again and back to the tour · three fast angle taps, three angles · Esc closes panels first · Earth on the tour: angles ${say.earth.views.join(', ')} in ${say.earth.t} s · home from the Crab pauses the tour · free camera stays with Earth (${stay.drift.off.toFixed(1)}° off centre after 5 s), back by play and by the pill ("${(stay.pill || '').replace(/^\W/, '› ')}") · Jupiter x${stay.jupiterFree} after letting go, x${stay.overviewFree} in the overview · W A S D within ${stay.reach} view distances · Saturn loops through ${loop.views} angles · pause, play and space work · universe to Earth, largest frame-to-frame change x${fl.worstFrameToFrameScale} · ladder picks keep moving · riding the Halo through a fold (a ${ride.fold.wind} s wind-up, easing to ${ride.fold.eased} of its speed, a starburst each end) and a light-speed jump (camera within ${ride.farAfterFold.toFixed(2)} / ${ride.farInLightSpeed.toFixed(2)} of ${ride.rig.toFixed(2)} ship radii) · the Halo roams round each place (${halo.stays.map(s => s.at + ' ' + s.t + ' s, ' + s.passes + ' passes').join('; ')}), always moving (tightest turn ${halo.minTurnRadius} ship lengths, at most ${halo.maxTurn20s} degrees in 20 s and ${halo.maxRate} of ${halo.rateLimit} degrees a second) · ${hops.out.length} hops that used to go wrong, now at most ${Math.max(...hops.out.map(o => o.rate))} degrees a second (${hops.out.filter(o => o.by === 'fold').map(o => o.hop).join(', ')} fold), ${Object.keys(halo.acts).length} kinds of job, a scan's hologram on Jupiter's surface (error ${halo.scan.worst.toExponential(1)}), its Great Red Spot bracket on the spot, none of it in Sgr A*'s shadow (${halo.scan.hole.outside} pixels round it), an attack run with Pip's railgun (3 slugs and a big shot along the heading, ${halo.gun.craters} craters; shots fall into Sgr A*, none in its shadow, ${halo.wHole.shown} points round it), Pip out ${(halo.pip.out/30).toFixed(0)} of ${(halo.pip.ticks/30).toFixed(0)} s at Mars (${halo.pip.bits}; show: ${halo.pip.show}; ${halo.pip.faces.split(' ').length} faces), in the picture ${(halo.pip.shown/30).toFixed(1)} s, at most ${Math.max(halo.pip.far, halo.pip2.far)} ship radii out and ${Math.min(halo.pip.clr, halo.pip2.clr)} clear of the hull, home as embers before the jump (${Math.round(halo.pip.emb*100)}% arrived), a show of ${halo.pip2.show} at Jupiter, called home in ${halo.pip2.back} s; ${halo.mix.distinct} mixes in 40 outings · Moon → ${nav.next} → ${nav.next2} · mid-flight speed change ${nav.slow}s → ${nav.fast}s · ${trips.n} tour trips without dips (${trips.passes} pass-bys)`);
await browser.close();

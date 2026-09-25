// Camera motion regression: the angle loop after picking an object, play / pause (button and space), flights that land
// exactly on a moving destination (no jump on arrival), ladder picks that keep moving, and riding along with the Halo. Deterministic: steps the simulation with __cosmos.tick.
// Usage: node tests/motion.mjs
import { openPage, report } from './lib.mjs';

const { browser, page, errors } = await openPage({ width:1200, height:750 });
const fail = m => errors.push('check: ' + m);

// 1. picking an object flies there, then loops through its tour angles
const loop = await page.evaluate(() => {
  const C = __cosmos, sat = C.BYKEY.saturn; C.setTour(false);
  C.lockOn(sat.index);
  const n = Math.ceil((C.flightDur() + 0.2)*60); for (let i=0;i<n;i++) C.tick(1/60);
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
  while (t < dur + 0.5){ C.tick(1/60); t += 1/60; const p = px(); if (prev > 20) worst = Math.max(worst, p/prev, prev/p); prev = p; }
  return { worstFrameToFrameScale:+worst.toFixed(3), lock:C.orbit.lock === e.index };
});
if (!fl.lock) fail('the flight did not land on Earth');
if (fl.worstFrameToFrameScale > 1.12) fail('Earth jumped in size between two frames (x' + fl.worstFrameToFrameScale + ')');

// 4. a scale picked on the ladder keeps the camera moving on arrival (a slow circle), and shared links start playing too
const lad = await page.evaluate(() => {
  const C = __cosmos, m = C.LADDER.find(m => m.key === 'jupiter') || C.LADDER[0];
  C.goLadder(m); const n = Math.ceil((C.flightDur() + 0.2)*60); for (let i=0;i<n;i++) C.tick(1/60);
  const y0 = C.orbit.yaw; for (let i=0;i<120;i++) C.tick(1/60);
  return { name:m.name, show:C.show.on, playing:!document.getElementById('btnPlay').classList.contains('paused'), moved:Math.abs(C.orbit.yaw - y0) > 1e-3 };
});
if (!lad.show || !lad.playing || !lad.moved) fail('a ladder pick arrived paused: ' + JSON.stringify(lad));

// 5. the Halo: its indicator is off until the ship button is pressed; riding along lands behind it, stays with it through a fold, and a drag lets go
const ride = await page.evaluate(() => {
  const C = __cosmos, h = C.BYKEY.halo, vis = () => !document.getElementById('shipMark').hidden || !document.getElementById('shipArrow').hidden;
  const r = { markOff:!vis() };
  document.getElementById('btnShip').click(); C.tick(1/60); C.hud(); r.markOn = C.SET.haloMark;
  document.getElementById('btnShip').click();
  C.startShipCam('chase'); const n = Math.ceil((C.flightDur() + 0.3)*60); for (let i=0;i<n;i++) C.tick(1/60);
  r.riding = C.shipCam.on; r.dist = Math.hypot(...h.rel)/h.rad;
  const k0 = h.S.target.key; let far = 0, i = 0;
  while (h.S.target.key === k0 && i < 60*60){ C.tick(1/60); i++; }
  for (let j=0;j<60;j++){ C.tick(1/60); far = Math.max(far, Math.hypot(...h.rel)/h.rad); }
  r.folded = h.S.target.key !== k0; r.farAfterFold = +far.toFixed(2); r.stillRiding = C.shipCam.on;
  C.setShipCamMode('cockpit'); for (let j=0;j<60;j++) C.tick(1/60); r.cockpit = Math.hypot(...h.rel)/h.rad < 1;
  C.togglePlay(); r.paused = !C.shipCam.on; C.togglePlay(); r.resumed = C.shipCam.on;
  C.setShipCamMode('chase'); C.stopShipCam();
  return r;
});
if (!ride.markOff) fail('the Halo indicator shows before the ship button is pressed');
if (!ride.markOn) fail('the ship button did not switch the Halo indicator on');
if (!ride.riding || ride.dist > 6) fail('riding along did not land behind the ship: ' + JSON.stringify(ride));
if (!ride.folded || !ride.stillRiding || ride.farAfterFold > 6) fail('the camera lost the ship when it folded space: ' + JSON.stringify(ride));
if (!ride.cockpit) fail('the cockpit view is not on the ship');
if (!ride.paused || !ride.resumed) fail('pause / play did not stop and resume riding along');

report('motion', errors, `Saturn loops through ${loop.views} angles · pause, play and space work · universe to Earth, largest frame-to-frame change x${fl.worstFrameToFrameScale} · ladder picks keep moving · riding the Halo through a fold (camera within ${ride.farAfterFold} ship radii)`);
await browser.close();

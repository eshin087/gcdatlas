
// ================================================================ camera: focus-relative, orbiting in the locked object's frame, zoom-pan flights
const cam = { focus:0, rel:[0,0,1], fwd:[0,0,-1], right:[1,0,0], up:[0,1,0], fovY:55*DEG };
const orbit = { yaw:0, pitch:0.1, dist:1, distT:1, lock:0, off:[0,0,0], offFn:null, target:[0,0,0], frame:M3.I() };
let flight = null, tween = null;
const tour = { on:true, obj:0, view:0, phase:'hold', t:0 };
const keys = new Set();
let timeScale = 1, manualAt = -1e9, zoomAt = -1e9;
// on phones the camera looks slightly off-centre so the object sits in the middle of the space the interface leaves free (radians, set by 09h-ui.js)
const viewShift = { x:0, y:0 };
let wakeTapAt = -1e9;   // a tap that only woke the faded interface does not also pick an object

// the frame the camera orbits in when locked on o: its own frame, unless it supplies a camera frame (the Halo: up is its deck, behind is its stern)
const camFrameOf = o => o.camFrame ? o.camFrame() : o.R0;
const sphL = (yaw, pitch) => [Math.cos(pitch)*Math.sin(yaw), Math.sin(pitch), Math.cos(pitch)*Math.cos(yaw)];
function setBasis(fwd, up){
  cam.fwd = V.norm(fwd);
  let r = V.cross(cam.fwd, up);
  if (V.len(r) < 1e-6) r = V.cross(cam.fwd, V.norm([up[1], up[2], up[0]]));
  cam.right = V.norm(r); cam.up = V.cross(cam.right, cam.fwd);
  if ((viewShift.x || viewShift.y) && !SKYV.on){
    // turn the view a little (left for x > 0, down for y > 0) so the target appears right of / above the centre
    const cx = Math.cos(viewShift.x), sx = Math.sin(viewShift.x), cy = Math.cos(viewShift.y), sy = Math.sin(viewShift.y);
    let f = V.sub(V.mul(cam.fwd, cx), V.mul(cam.right, sx)); cam.right = V.add(V.mul(cam.right, cx), V.mul(cam.fwd, sx));
    cam.fwd = V.sub(V.mul(f, cy), V.mul(cam.up, sy)); cam.up = V.add(V.mul(cam.up, cy), V.mul(f, sy));
  }
}
function orbitDir(){ return M3.apply(orbit.frame, sphL(orbit.yaw, orbit.pitch)); }
function applyOrbit(){
  if (SKYV.on && SKYV.site){ skyCamera(); return; }
  const d = orbitDir();
  cam.rel = V.add(orbit.target, V.mul(d, orbit.dist));
  setBasis(V.mul(d, -1), M3.apply(orbit.frame, [0,1,0]));
}
// planetarium: the camera stands at your location on the turning Earth; dragging looks around (azimuth, altitude)
function skyCamera(){
  const s = SKYV.site, up = V.norm(s.offset), pole = M3.apply(earth.R0, [0, 1, 0]);
  const north = V.norm(V.sub(pole, V.mul(up, V.dot(pole, up)))), east = V.norm(V.cross(north, up));
  orbit.pitch = clamp(orbit.pitch, -0.25, 1.52);
  const az = -orbit.yaw, alt = orbit.pitch, dir = V.add(V.mul(V.add(V.mul(north, Math.cos(az)), V.mul(east, Math.sin(az))), Math.cos(alt)), V.mul(up, Math.sin(alt)));
  cam.focus = s.index; orbit.lock = s.index; cam.rel = V.mul(up, 2*KM);
  orbit.dist = orbit.distT = 30; orbit.target = V.add(cam.rel, dir);
  SKYV.az = az; SKYV.alt = alt; SKYV.up = up; SKYV.north = north; SKYV.east = east;
  setBasis(dir, up);
}
function viewParams(o, vi){ return viewParamsV(o, o.views[vi]); }
function viewParamsV(o, v){
  let d = [0, 0.3, 1];
  if (v.d) d = v.d;
  if (v.dirFn || v.track) d = M3.applyT(o.R0, (v.track || v.dirFn)());
  d = V.norm(d);
  let off = [0,0,0], offFn = null;
  if (typeof v.off === 'function') offFn = () => V.mul(M3.apply(o.R0, v.off()), o.rad);
  if (v.off) off = offFn ? offFn() : V.mul(M3.apply(o.R0, v.off), o.rad);
  return { yaw:Math.atan2(d[0], d[2]), pitch:Math.asin(clamp(d[1], -0.999, 0.999)), dist:v.k*o.rad*(v.off ? 1 : viewFit), off, offFn };
}
// van Wijk & Nuij optimal zoom-and-pan path (numerically stable forms)
function vwPath(u1, w0, w1, rho){
  if (u1 < 1e-7*Math.min(w0, w1)){ const k = Math.log(w1/w0); return { S:Math.abs(k)/rho + 1e-6, u:() => 0, w:s => w0*Math.exp(Math.sign(k)*rho*s) }; }
  const r4 = rho*rho*rho*rho;
  const b0 = (w1*w1 - w0*w0 + r4*u1*u1)/(2*w0*rho*rho*u1), b1 = (w1*w1 - w0*w0 - r4*u1*u1)/(2*w1*rho*rho*u1);
  const r0 = -Math.asinh(b0), r1 = -Math.asinh(b1);
  return { S:(r1 - r0)/rho, u:s => w0*Math.sinh(rho*s)/(rho*rho*Math.cosh(rho*s + r0)), w:s => w0*Math.cosh(r0)/Math.cosh(rho*s + r0) };
}
function slerpDir(a, b, t){
  const c = clamp(V.dot(a, b), -1, 1), th = Math.acos(c);
  if (th < 1e-4) return V.norm(V.lerp(a, b, t));
  if (th > 3.1) { const ax = V.norm(V.cross(a, Math.abs(a[1]) < 0.9 ? [0,1,0] : [1,0,0])); return V.norm(V.add(V.mul(a, Math.cos(th*t)), V.mul(ax, Math.sin(th*t)))); }
  const s = Math.sin(th);
  return V.add(V.mul(a, Math.sin((1 - t)*th)/s), V.mul(b, Math.sin(t*th)/s));
}
function startFlight(o, vp, onDone, via, glide){
  const A = orbit.target.slice(), w0 = Math.max(V.len(V.sub(cam.rel, A)), 1e-30);
  const B = V.add(frel(o), vp.off || [0,0,0]), w1 = vp.dist;
  const path = vwPath(V.len(V.sub(B, A)), w0, w1, 1.3);
  const pass = via ? passBy(via.o, A, B, path) : null;
  const dirEnd = M3.apply(camFrameOf(o), sphL(vp.yaw, vp.pitch));
  // long journeys zoom far out: swing the camera over the galactic pole on the way, so the trip reads as a map
  let wMax = 0; for (let i=0;i<=24;i++) wMax = Math.max(wMax, path.w(path.S*i/24));
  const scenic = wMax > 30*Math.max(w0, w1) && wMax > 2000;
  const dirMid = V.norm([0.3, 0.15, 1]), upMid = V.norm(V.sub([1, 0, 0], V.mul(dirMid, dirMid[0])));
  // progress table: eased at both ends, and for scenic trips slowed right at the widest point so the big picture can sink in
  let sPeak = 0, wp = -1; for (let i=0;i<=48;i++){ const w = path.w(path.S*i/48); if (w > wp){ wp = w; sPeak = i/48; } }
  const tbl = [0]; let acc = 0;
  // (the floor falls from 0.15 at departure to 0.025 on arrival: the camera glides in and settles, rather than arriving at speed and stopping dead)
  // (passing an object on the way, the camera eases off a little as it goes by, but never stops)
  const f0 = 0.15, f1 = 0.025;
  // (glide: a long, slow final approach, used to come up behind the Halo)
  for (let i=1;i<=64;i++){ const x = (i - 0.5)/64, ease = (Math.sin(Math.PI*x)*0.85 + f0*(1 - x) + f1*x)*(glide ? 1 - 0.55*smooth(0.6, 1, x) : 1), hover = (scenic ? 1 - 0.8*Math.exp(-Math.pow((x - sPeak)/0.07, 2)) : 1)*(pass ? 1 - 0.4*Math.exp(-Math.pow((x - pass.e)/0.08, 2)) : 1); acc += 1/(ease*hover); tbl.push(acc); }
  const prog = tbl.map(v => v/acc);   // prog[i] = time fraction at which s/S = i/64
  // travel speed: cinematic (slow and scenic), quick (default), warp (near-instant, same path and effects compressed)
  // (the speed you pick always wins, also on computers that ask for reduced motion; changing it mid-flight re-times the rest of the trip)
  const durs = { cinematic:clamp(1.6 + path.S*0.42, 2.4, 13) + (scenic ? 3 : 0), quick:clamp(1.3 + path.S*0.2, 1.8, 6.5) + (scenic ? 1.4 : 0), warp:clamp(0.85 + path.S*0.03, 0.95, 1.6) };
  if (pass) for (const k in durs) if (k !== 'warp') durs[k] += 1.2;
  if (glide) for (const k in durs) if (k !== 'warp') durs[k] += 2.5;
  const dur = durs[SET.travel] || durs.quick;
  shipCam.on = shipCam.pending = false;   // any flight takes the camera off the ship (riding along starts again when its own flight lands)
  // start compiling the destination's shaders now, so it is ready to draw on arrival
  if (o.prog) progReady(o.prog); for (const sp of o.particles || []) if (P[sp.prog]) progReady(P[sp.prog]);
  music.whoosh(dur);
  flight = { t:0, dur, durs, path, A, B, L0:V.len(V.sub(B, A)), dir0:V.norm(V.sub(cam.rel, A)), dir1:dirEnd, prog,
    up0:cam.up.slice(), up1:vp.up || M3.apply(camFrameOf(o), [0,1,0]), obj:o, vp, onDone, switched:false, spin:scenic || pass ? 0 : (rnd() < 0.5 ? -1 : 1)*0.5, scenic, dirMid, upMid,
    pass, via:pass ? via.o : null };
  tween = null;
}
// ---------------------------------------------------------------- scenic travel: a long trip goes past something real on the way (a nebula, a cluster, a galaxy near the route).
// It is one continuous flight: the route bends so the object drifts through the frame beside the path, the camera eases off a little
// while it goes by, then carries on. It never zooms in on it or stops there (that looked like locking on to the wrong object).
// Only objects that will look the right size at that point of the trip qualify: big enough to see, small enough not to fill the screen.
const PASS = { minR:0.05, maxR:0.3, side:1.5 };   // object radius / camera distance at the pass; how far beside the path (object radii)
// where along `path` (A to B, relative positions) the object W is passed, and how the route must bend to go by it at a comfortable distance
function passBy(W, A, B, path){
  const AB = V.sub(B, A), L = V.len(AB); if (!(L > 0)) return null;
  const WR = frel(W), t = V.dot(V.sub(WR, A), AB)/(L*L);
  let e = 0.5, best = 1e9; for (let i=0;i<=64;i++){ const d = Math.abs(path.u(path.S*i/64)/L - t); if (d < best){ best = d; e = i/64; } }
  const q = V.sub(WR, V.add(A, V.mul(AB, t))), ql = V.len(q), m = W.rad*PASS.side;
  return { e, bend:ql > m ? V.mul(q, 1 - m/ql) : [0, 0, 0], w:path.w(path.S*e) };
}
// how much of the bend applies at progress e: 0 at both ends, 1 where the object is passed, smooth in between
function passBump(p, e){
  const e0 = Math.max(p.e - 0.35, 0), e1 = Math.min(p.e + 0.35, 1);
  return e <= e0 || e >= e1 ? 0 : e < p.e ? smooth(0, 1, (e - e0)/(p.e - e0)) : smooth(0, 1, (e1 - e)/(e1 - p.e));
}
function scenicWaypoint(o, vp){
  if (SET.travel === 'warp' || cmp || SKYV.on) return null;
  const F = OBJ[cam.focus]; if (!F) return null;
  const A = orbit.target.slice(), B = V.add(frel(o), vp.off || [0, 0, 0]), AB = V.sub(B, A), L = V.len(AB);
  const w0 = Math.max(V.len(V.sub(cam.rel, A)), 1e-30);
  if (!(L > 40*Math.max(w0, vp.dist))) return null;   // a short hop: nothing to see on the way
  if (L < 0.05) return null;   // (inside the Solar System the planets are the scenery)
  const path = vwPath(L, w0, vp.dist, 1.3), u = V.mul(AB, 1/L); let best = null, bs = -1e9; if (PASS.log) PASS.log.length = 0;
  for (const c of OBJ){
    if (c === o || c === F || c.marker || c.noPick || c.hidden || !c.prog || c.parent || c.layer < 2 || c.noWaypoint || !c.views || !c.views.length) continue;
    const r = V.sub(frel(c), A), t = V.dot(r, u)/L; if (t < 0.18 || t > 0.82) continue;
    if (V.len(r) < c.rad*1.2 || V.len(V.sub(frel(c), B)) < c.rad*1.2) continue;   // it contains one end of the trip (the Milky Way on a trip inside it)
    if (V.len(V.sub(c.pos, o.pos)) < o.rad*4 || V.len(V.sub(c.pos, F.pos)) < F.rad*4) continue;    // part of either end
    const perp = V.len(V.sub(r, V.mul(u, t*L))); if (perp > 0.4*L + c.rad) continue;
    // the size it would have on screen as the camera goes by: skip specks and anything that would fill the view
    const p = passBy(c, A, B, path); if (!p) continue;
    const ratio = c.rad/p.w; if (PASS.log) PASS.log.push(c.key + ':' + ratio.toFixed(3)); if (ratio < PASS.minR || ratio > PASS.maxR) continue;
    const sc = -Math.abs(Math.log(ratio/0.15)) - 3*perp/L - 1.5*Math.abs(t - 0.5);
    if (sc > bs){ bs = sc; best = c; }
  }
  return best;
}
// fly somewhere by way of whatever is worth seeing on the way (lockOn, tours, the scale bar)
function flyTo(o, vp, onDone){
  const W = scenicWaypoint(o, vp);
  startFlight(o, vp, onDone, W ? { o:W } : null);
  if (W){ flight.dest = o; toast('passing ' + W.name); }
}
function updateFlight(dt){
  const f = flight; f.t += dt;
  const x = clamp(f.t/f.dur, 0, 1);
  let j = 0; while (j < 63 && f.prog[j + 1] < x) j++;
  const e = clamp((j + (x - f.prog[j])/Math.max(f.prog[j + 1] - f.prog[j], 1e-9))/64, 0, 1), s = f.path.S*e;
  // aim at where the destination is now, not where it was at take-off: planets and moons keep moving during the flight,
  // and aiming at a stale point meant closing in on empty space and then jumping to the real object in the last frame
  const Bnow = V.add(frel(f.obj), f.vp.offFn ? f.vp.offFn() : (f.vp.off || [0, 0, 0]));
  const tgt = V.add(f.A, V.mul(V.sub(Bnow, f.A), f.L0 > 0 ? clamp(f.path.u(s)/f.L0, 0, 1) : 1));
  if (f.pass){ const b = passBump(f.pass, e); tgt[0] += f.pass.bend[0]*b; tgt[1] += f.pass.bend[1]*b; tgt[2] += f.pass.bend[2]*b; }
  const w = x >= 1 ? f.vp.dist : f.path.w(s);
  if (!f.switched && x > 0.5){
    const D = frel(f.obj);
    f.A = V.sub(f.A, D); tgt[0] -= D[0]; tgt[1] -= D[1]; tgt[2] -= D[2];
    cam.focus = f.obj.index; f.switched = true;
  }
  const k = smooth(0.15, 0.85, x);
  let dir, up;
  if (f.scenic){
    if (x < 0.5){ const a = smooth(0.04, 0.42, x); dir = slerpDir(f.dir0, f.dirMid, a); up = V.norm(V.lerp(f.up0, f.upMid, a)); }
    else { const a = smooth(0.58, 0.96, x); dir = slerpDir(f.dirMid, f.dir1, a); up = V.norm(V.lerp(f.upMid, f.up1, a)); }
  } else { dir = slerpDir(f.dir0, f.dir1, k); up = V.norm(V.lerp(f.up0, f.up1, k)); }
  const sw = Math.sin(Math.PI*x)*f.spin;
  dir = V.add(V.mul(dir, Math.cos(sw)), V.mul(V.cross(up, dir), Math.sin(sw)));
  orbit.target = tgt; orbit.dist = orbit.distT = w;
  cam.rel = V.add(tgt, V.mul(dir, w));
  setBasis(V.mul(dir, -1), up);
  if (x >= 1){
    if (!f.switched){ const D = frel(f.obj); cam.focus = f.obj.index; orbit.target = V.sub(orbit.target, D); }
    orbit.lock = f.obj.index; orbit.frame = camFrameOf(f.obj); orbit.off = (f.vp.off || [0,0,0]).slice(); orbit.offFn = f.vp.offFn || null;
    orbit.yaw = f.vp.yaw; orbit.pitch = f.vp.pitch; orbit.dist = orbit.distT = f.vp.dist;
    orbit.target = V.add(frel(f.obj), orbit.off);
    flight = null; applyOrbit(); f.onDone && f.onDone();
  }
}
let flyMove = null;   // a flyby playing outside a tour
function startTween(to, dur){ tween = { t:0, dur, from:{yaw:orbit.yaw, pitch:orbit.pitch, dist:orbit.dist, off:orbit.off.slice()}, to }; }
function updateTween(dt){
  const w = tween; w.t += dt; const u = ease(clamp(w.t/w.dur, 0, 1));
  let dy = w.to.yaw - w.from.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
  orbit.yaw = w.from.yaw + dy*u;
  orbit.pitch = w.from.pitch + (w.to.pitch - w.from.pitch)*u;
  orbit.dist = orbit.distT = Math.exp(Math.log(w.from.dist) + (Math.log(w.to.dist) - Math.log(w.from.dist))*u);
  orbit.off = V.lerp(w.from.off, w.to.offFn ? w.to.offFn() : (w.to.off || [0,0,0]), u);
  if (w.t >= w.dur){ orbit.offFn = w.to.offFn || null; tween = null; w.onDone && w.onDone(); }
}
const TOUR = [];   // filled after all objects exist (list of object indices)
// the guided tour: outward from home to the edge of the observable universe
const TOUR_KEYS = ['earth', 'moon', 'sun', 'jupiter', 'saturn', 'solarsystem', 'oort', 'alphacen', 'betelgeuse', 'hltau', 'catseye', 'pillars', 'crab', 'crabpulsar', 'etacar', 'rsoph',
  'omegacen', 'galcentre', 'sgra', 'magnetar', 'milkyway', 'sn1987a', 'andromeda', 'm51', 'antennae', 'm87', 'gw170817', '3c273', 'ton618', 'cosmicweb', 'universe'];
function tourGo(i, instant){
  const o = OBJ[i]; tour.obj = i; tour.view = 0; tour.t = 0; tour.last = null; show.on = show.pending = false; motion.last = 'tour';
  o.tourReset && o.tourReset();
  const vp = viewParams(o, 0);
  setInfo(i);
  if (instant){
    cam.focus = i; orbit.lock = i; orbit.frame = camFrameOf(o); orbit.off = vp.off.slice(); orbit.offFn = vp.offFn;
    orbit.yaw = vp.yaw; orbit.pitch = vp.pitch; orbit.dist = orbit.distT = vp.dist; orbit.target = V.add(frel(o), vp.off);
    applyOrbit(); tour.phase = 'hold'; return;
  }
  tour.phase = 'fly';
  flyTo(o, vp, () => { tour.phase = 'hold'; tour.t = 0; });
}
function tourNext(dir = 1){ const k = TOUR.indexOf(tour.obj); return TOUR[((k < 0 ? 0 : k) + dir + TOUR.length) % TOUR.length]; }
function updateTour(dt){
  const o = OBJ[tour.obj];
  if (tour.phase === 'hold'){
    const v = o.views[tour.view], hold = holdOf(v);
    tour.t += dt;
    if (v.to) playMove(o, v, clamp(tour.t/hold, 0, 1));
    else if (v.track) trackView(o, v, dt);
    else orbit.yaw += v.drift*dt;
    if (tour.t > hold){
      if (tour.view < o.views.length - 1){
        tour.phase = 'swing'; tour.t = 0;
        startTween(viewParams(o, tour.view + 1), swingDur());
        tween.onDone = () => { tour.view++; tour.phase = 'hold'; tour.t = 0; };
      } else tourGo(tourNext(1));
    }
  }
}
const holdOf = v => v.hold*(v.to ? Math.max(dwellK(), 0.75) : dwellK());
// a view with track(): while it holds, the camera keeps turning toward a moving direction (world frame) instead of drifting
function trackView(o, v, dt){
  const d = M3.applyT(o.R0, V.norm(v.track())), y = Math.atan2(d[0], d[2]), p = Math.asin(clamp(d[1], -0.999, 0.999));
  const k = 1 - Math.exp(-dt*2.5); let dy = y - orbit.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
  orbit.yaw += dy*k; orbit.pitch += (p - orbit.pitch)*k;
}
// ---------------------------------------------------------------- riding along with the Halo: a chase camera behind and above the ship (third person), or the bridge (first person)
// Poses are in the ship's frame (+y forward, -x dorsal = up); the camera follows them with a little lag so turns feel like flying, not like a bolted-on view.
// When the ship folds space the camera folds with it: it stays attached, and a flash covers the jump.
const shipCam = { on:false, pending:false, mode:'chase', zoom:1, eye:null, fwd:null, up:null };
const SHIP_POSE = { chase:{ eye:[-0.95, -3.0, 0], look:[-0.2, 1.4, 0], lag:3.2 }, cockpit:{ eye:[-0.27, 0.3, 0], look:[-0.05, 2.2, 0], lag:14 } };
function shipPose(mode){
  const q = SHIP_POSE[mode], R = ship.R0, r = ship.rad;
  const z = mode === 'chase' ? shipCam.zoom : 1, eye = V.mul(M3.apply(R, V.mul(q.eye, z)), r), look = V.mul(M3.apply(R, q.look), r);
  return { eye, look, fwd:V.norm(V.sub(look, eye)), up:M3.apply(R, [-1, 0, 0]) };
}
function shipCamSnap(p){ shipCam.eye = p.eye; shipCam.fwd = p.fwd; shipCam.up = p.up; }
function startShipCam(mode){
  if (typeof ship === 'undefined' || !ship.S.target) return;
  stopTour(false); pauseShow(); tween = null; flyMove = null; if (cmp) endCompare(true);
  shipCam.mode = mode || shipCam.mode; motion.last = 'ship';
  setInfo(ship.index);
  const near = cam.focus === ship.index && orbit.lock === ship.index && V.len(cam.rel) < ship.rad*30 && !flight;
  if (near){ shipCam.on = true; shipCam.eye = cam.rel.slice(); shipCam.fwd = cam.fwd.slice(); shipCam.up = cam.up.slice(); updateModeUI(); return; }
  // fly in first, landing exactly on the chase pose, then take over
  const p = shipPose('chase'), dl = M3.applyT(ship.R0, V.norm(V.sub(p.eye, p.look)));
  const vp = { yaw:Math.atan2(dl[0], dl[2]), pitch:Math.asin(clamp(dl[1], -0.999, 0.999)), dist:V.len(V.sub(p.eye, p.look)), off:p.look, offFn:null, up:p.up };
  startFlight(ship, vp, () => { shipCam.on = true; shipCam.pending = false; shipCamSnap(shipPose('chase')); updateShipCam(0); updateModeUI(); }, null, true);
  shipCam.pending = true;
  updateModeUI();
}
function stopShipCam(){
  if (!shipCam.on) return false;
  shipCam.on = false; motion.last = 'ship';
  // hand the camera over as an ordinary lock on the ship, from exactly where it is
  orbit.lock = ship.index; orbit.frame = camFrameOf(ship); orbit.target = [0, 0, 0]; orbit.off = [0, 0, 0]; orbit.offFn = null; cam.focus = ship.index;
  syncOrbitFromCam(); updateModeUI();
  return true;
}
function setShipCamMode(m){ shipCam.mode = m; if (!shipCam.on) startShipCam(m); updateModeUI(); toast(m === 'cockpit' ? 'cockpit view · on the bridge of the Halo' : 'chase view · behind the Halo'); }
function updateShipCam(dt){
  if (cam.focus !== ship.index){ const D = frel(ship); cam.rel = V.sub(cam.rel, D); cam.focus = ship.index; if (shipCam.eye) shipCam.eye = cam.rel.slice(); }
  const p = shipPose(shipCam.mode), k = dt > 0 ? 1 - Math.exp(-dt*SHIP_POSE[shipCam.mode].lag) : 1;
  if (!shipCam.eye) shipCamSnap(p);
  shipCam.eye = V.lerp(shipCam.eye, p.eye, k); shipCam.fwd = V.norm(V.lerp(shipCam.fwd, p.fwd, k)); shipCam.up = V.norm(V.lerp(shipCam.up, p.up, k));
  cam.rel = shipCam.eye.slice(); setBasis(shipCam.fwd, shipCam.up);
  orbit.lock = ship.index; orbit.frame = camFrameOf(ship); orbit.off = [0, 0, 0]; orbit.offFn = null; orbit.target = [0, 0, 0];
  orbit.dist = orbit.distT = Math.max(V.len(cam.rel), ship.rad*0.3);
}
const swingDur = () => SET.travel === 'warp' ? 1.4 : SET.travel === 'quick' ? 2.6 : 3.4;
// the travel speed changed while flying: keep the same point of the trip, finish it at the new pace
function retimeFlight(){ if (!flight || !flight.durs) return; const x = clamp(flight.t/flight.dur, 0, 1), d = flight.durs[SET.travel] || flight.dur; flight.dur = d; flight.t = x*d; }
// ---------------------------------------------------------------- the angle loop: an object you pick yourself plays its tour angles, round and round, until you take the camera
// (pending: the loop starts when the flight there lands). motion.last remembers what play should bring back: the tour or the loop.
const show = { on:false, pending:false, obj:-1, view:0, t:0, phase:'hold', free:false };   // free: a scale picked on the ladder, so the camera only circles slowly at that distance
const motion = { last:'tour' };
function startShow(i, view = 0, free = false){
  const o = OBJ[i]; if (!o) return;
  show.free = free; show.on = true; show.pending = false; show.obj = i; show.view = clamp(view, 0, o.views.length - 1); show.t = 0; show.phase = 'hold'; motion.last = 'show';
  updateModeUI();
}
function updateShow(dt){
  const o = OBJ[show.obj];
  if (!o || orbit.lock !== show.obj){ show.on = false; updateModeUI(); return; }
  if (show.phase !== 'hold'){ if (!tween){ show.phase = 'hold'; show.t = 0; } return; }   // gliding between angles: the tween moves the camera
  if (show.free){ orbit.yaw += 0.035*dt; return; }
  const v = o.views[show.view], hold = holdOf(v);
  show.t += dt;
  if (v.to) playMove(o, v, clamp(show.t/hold, 0, 1));
  else if (v.track) trackView(o, v, dt);
  else orbit.yaw += v.drift*dt;
  if (show.t > hold && o.views.length > 1){
    const next = (show.view + 1) % o.views.length;
    show.phase = 'swing'; show.t = 0;
    startTween(viewParams(o, next), swingDur());
    tween.onDone = () => { show.view = next; show.phase = 'hold'; show.t = 0; };
  }
}
// carry on from wherever the camera is: glide back into the current angle, then keep looping
function resumeShow(){
  const i = orbit.lock, o = OBJ[i]; if (!o) return;
  const view = show.obj === i ? show.view : 0;
  if (show.free && show.obj === i){ show.on = true; show.pending = false; show.phase = 'hold'; motion.last = 'show'; if (flight) finishFlightHere(); updateModeUI(); return; }
  show.free = false; show.on = true; show.pending = false; show.obj = i; show.view = view; show.phase = 'swing'; show.t = 0; motion.last = 'show';
  if (flight) finishFlightHere();
  startTween(viewParams(o, view), swingDur()*0.8);
  tween.onDone = () => { show.phase = 'hold'; show.t = 0; };
  updateModeUI();
}
function pauseShow(){ if (show.on || show.pending){ show.on = show.pending = false; motion.last = 'show'; if (show.phase === 'swing') tween = null; } }
const isPlaying = () => tour.on || show.on || show.pending || !!flyMove || shipCam.on || (!!flight && !!shipCam.pending && flight.obj === ship);
// the play / pause control (and the space bar): pause whatever moves the camera; play brings back the last thing that did
function togglePlay(){
  if (tour.on){ stopTour(false); motion.last = 'tour'; toast('paused · press play (or space) to carry on with the tour'); }
  else if (shipCam.on){ stopShipCam(); toast('paused · press play to ride along with the Halo again'); }
  else if (motion.last === 'ship' && typeof ship !== 'undefined' && orbit.lock === ship.index){ startShipCam(); }
  else if (show.on || show.pending || flyMove){ pauseShow(); flyMove = null; tween = null; toast('paused · the camera is yours · press play to carry on'); }
  else if (motion.last === 'show' && orbit.lock >= 0 && !cmp) resumeShow();
  else setTour(true);
  updateModeUI();
}
// a camera move: glide from the view's own framing to its 'to' framing, easing in and out, distance changing smoothly in log space
function playMove(o, v, u){
  const a = viewParamsV(o, v), b = viewParamsV(o, Object.assign({ hold:1, drift:0 }, v.to));
  const e = v.ease === 'out' ? 1 - Math.pow(1 - u, 3) : u*u*(3 - 2*u);
  let dy = b.yaw - a.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
  orbit.yaw = a.yaw + dy*e; orbit.pitch = a.pitch + (b.pitch - a.pitch)*e;
  orbit.dist = orbit.distT = Math.exp(Math.log(a.dist) + (Math.log(b.dist) - Math.log(a.dist))*(v.distEase ? v.distEase(e) : e));   // (moves are designed to stay outside the object)
  // offW 'dist': the aim point shifts in step with the real distance travelled, so a pull-back keeps its subject in frame
  const w = v.offW === 'dist' && Math.abs(b.dist - a.dist) > 1e-30 ? clamp((orbit.dist - a.dist)/(b.dist - a.dist), 0, 1) : e;
  orbit.offFn = null; orbit.off = V.lerp(a.offFn ? a.offFn() : a.off, b.offFn ? b.offFn() : b.off, w);
}
function setTour(on){
  tour.on = on;
  if (on){ show.on = show.pending = false; motion.last = 'tour'; shipCam.on = false; }
  $('#btnTour').setAttribute('aria-pressed', String(on));
  if (on){
    let i = orbit.lock >= 0 ? orbit.lock : nearestObject();
    if (tour.last != null && TOUR.includes(tour.last)){ i = tour.last; toast('resuming the tour at ' + OBJ[i].name); }   // back to where the tour left off
    if (!TOUR.includes(i)) i = TOUR[0];
    if (orbit.lock === i && !flight){ tour.obj = i; tour.view = 0; tour.t = 0; tour.phase = 'swing'; startTween(viewParams(OBJ[i], 0), 2.5); tween.onDone = () => { tour.phase = 'hold'; tour.t = 0; }; setInfo(i); }
    else tourGo(i);
  }
  updateModeUI();
}
function stopTour(msg){
  if (!tour.on) return;
  tour.on = false; tween = null; tour.last = tour.obj;
  if (flight) finishFlightHere();
  $('#btnTour').setAttribute('aria-pressed', 'false');
  if (msg) toast('tour paused · press play (or space) to pick up where it left off');
  updateModeUI();
}
// abandon a flight mid-way, keeping the camera where it is
function finishFlightHere(){
  const f = flight; flight = null;
  const o = f.obj;
  if (cam.focus !== o.index){ const D = frel(o); cam.rel = V.sub(cam.rel, D); orbit.target = V.sub(orbit.target, D); cam.focus = o.index; }
  orbit.lock = o.index; orbit.frame = camFrameOf(o); orbit.off = V.sub(orbit.target, frel(o)); orbit.offFn = null;
  syncOrbitFromCam();
  if (typeof infoObj !== 'undefined' && infoObj !== o.index) setInfo(o.index);   // stopped on the way past something: show what it is
}
function syncOrbitFromCam(){
  const d = V.sub(cam.rel, orbit.target); orbit.dist = orbit.distT = Math.max(V.len(d), 1e-30);
  const n = M3.applyT(orbit.frame, V.norm(d)); orbit.yaw = Math.atan2(n[0], n[2]); orbit.pitch = Math.asin(clamp(n[1], -0.999, 0.999));
}
function lockOn(i, viewIdx = 0, loop = true){
  stopTour(false); orbit.offFn = null; show.on = false;
  const o = OBJ[i], vi = Math.min(viewIdx, o.views.length - 1);
  const vp = viewParams(o, vi);
  setInfo(i);
  show.pending = loop; if (loop) motion.last = 'show';
  flyTo(o, vp, loop ? () => { if (show.pending) startShow(i, vi); } : null);
  updateModeUI();
}
function unlock(){ shipCam.on = false; pauseShow(); if (orbit.lock < 0 && !tour.on) return; stopTour(false); if (flight) finishFlightHere(); orbit.lock = -1; orbit.offFn = null; updateModeUI(); }
function nearestObject(){ let b = 0, bd = 1e300; OBJ.forEach((o, i) => { if (o.layer < 2 || o.noPick || o.marker) return; const d = o.dist/o.rad; if (d < bd){ bd = d; b = i; } }); return b; }

// ---------------------------------------------------------------- input
const pointers = new Map();
let drag = null;
canvas.addEventListener('contextmenu', e => e.preventDefault());
canvas.addEventListener('pointerdown', e => {
  canvas.setPointerCapture(e.pointerId);
  pointers.set(e.pointerId, {x:e.clientX, y:e.clientY});
  if (pointers.size === 1) drag = { x0:e.clientX, y0:e.clientY, t0:performance.now(), moved:0, pan:e.button === 2 || e.shiftKey };
  else if (drag) drag.moved = 99;
  canvas.classList.add('dragging');
});
canvas.addEventListener('pointermove', e => {
  const p = pointers.get(e.pointerId); if (!p) return;
  const dx = e.clientX - p.x, dy = e.clientY - p.y;
  if (pointers.size === 2){
    const pts = [...pointers.values()];
    const before = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
    p.x = e.clientX; p.y = e.clientY;
    const after = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
    beginManual();
    if (before > 10 && after > 10) zoomBy(Math.pow(before/after, 1.6));
    panBy(dx*0.5, dy*0.5);
    return;
  }
  p.x = e.clientX; p.y = e.clientY;
  if (!drag) return;
  drag.moved += Math.abs(dx) + Math.abs(dy);
  if (drag.moved < 4) return;
  beginManual();
  if (drag.pan) panBy(dx, dy);
  else { orbit.yaw -= dx*0.005; orbit.pitch = clamp(orbit.pitch + dy*0.005, -1.52, 1.52); }
});
function endPointer(e){
  const wasTap = drag && pointers.size === 1 && drag.moved < 6 && performance.now() - drag.t0 < 450;
  pointers.delete(e.pointerId);
  if (pointers.size === 0){ canvas.classList.remove('dragging'); if (wasTap && Math.abs(drag.t0 - wakeTapAt) > 150) pick(e.clientX, e.clientY); drag = null; }
}
canvas.addEventListener('pointerup', endPointer);
canvas.addEventListener('pointercancel', endPointer);
canvas.addEventListener('wheel', e => { e.preventDefault();
  // riding along: the wheel moves the chase camera nearer or further back instead of letting go of the ship
  if (shipCam.on && shipCam.mode === 'chase'){ shipCam.zoom = clamp(shipCam.zoom*Math.exp(clamp(e.deltaY*(e.deltaMode ? 0.06 : 0.0022), -0.6, 0.6)), 0.55, 4); return; }
  beginManual(); zoomBy(Math.exp(clamp(e.deltaY*(e.deltaMode ? 0.06 : 0.0022), -0.6, 0.6))); }, {passive:false});

function beginManual(){
  manualAt = performance.now();
  if (stopShipCam()) toast('the camera is yours · press play to ride along with the Halo again');
  shipCam.pending = false;
  if (tour.on){ stopTour(true); motion.last = 'tour'; }
  if (show.on || show.pending){ pauseShow(); updateModeUI(); }
  if (flight) finishFlightHere();
  tween = null; flyMove = null;
  hideHint();
}
const MAX_DIST = 1.6e11;
function zoomBy(f){
  const o = orbit.lock >= 0 ? OBJ[orbit.lock] : null;
  const lo = o ? o.rad*o.minZoom : 1e-12;
  orbit.distT = clamp(orbit.distT*f, lo, MAX_DIST); zoomAt = performance.now();
}
function zoomTo(d){ beginManual(); zoomAt = performance.now(); orbit.distT = clamp(d, orbit.lock >= 0 ? OBJ[orbit.lock].rad*OBJ[orbit.lock].minZoom : 1e-12, MAX_DIST); }
function panBy(dx, dy){
  if (orbit.lock >= 0){ orbit.lock = -1; orbit.offFn = null; updateModeUI(); }
  const s = orbit.dist*0.0016;
  orbit.target = V.add(orbit.target, V.add(V.mul(cam.right, -dx*s), V.mul(cam.up, dy*s)));
}
function pick(cx, cy){
  let best = -1, bz = 1e300;
  OBJ.forEach((o, i) => {
    if (o.noPick || o.marker || o.hidden || o.magHide > 0.5) return;
    const pr = projectCSS(o.rel); if (!pr) return;
    const rpx = o.rad*magOf(o)/(pr.z*tanY)*(viewHcss/2);
    if (rpx > viewHcss*0.8 || (o.layer < 3 && rpx > 60)) return;
    const d = Math.hypot(cx - pr.x, cy - pr.y);
    if (d < Math.max(rpx*0.8, 26) && pr.z < bz){ bz = pr.z; best = i; }
  });
  if (best >= 0) lockOn(best);
}
addEventListener('keydown', e => {
  if (e.target.closest && (e.target.closest('input') || (e.target.closest('button') && (e.key === ' ' || e.key === 'Enter')))) return;
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const k = e.key.toLowerCase();
  if (!$('#help').hidden){ if (k === 'escape' || k === '?' || k === 'h') toggleHelp(false); return; }
  if (k === 'escape'){
    if (!$('#settings').hidden || !$('#tours').hidden || !$('#timem').hidden){ togglePanel(null, false); return; }
    if (!$('#atlas').hidden){ toggleAtlas(false); return; }
    unlock(); return;
  }
  if (k === ' '){ e.preventDefault(); togglePlay(); return; }
  if (k === '/' || k === 'o'){ e.preventDefault(); focusSearch(); return; }
  if (k === 'c' && typeof ship !== 'undefined'){ setShipCamMode(shipCam.on && shipCam.mode === 'chase' ? 'cockpit' : 'chase'); return; }
  if (k === 'y'){ setOpt('travel', cycle(['quick', 'warp', 'cinematic'], SET.travel)); return; }
  if (k === 'm'){ setOpt('sound', !SET.sound); return; }
  if (k === '[' || k === ']'){ stepObject(k === ']' ? 1 : -1); return; }
  if (k === '+' || k === '='){ beginManual(); zoomBy(0.6); return; }
  if (k === '-' || k === '_'){ beginManual(); zoomBy(1.7); return; }
  if (k === 't'){ setOpt('time', cycle([1, 3, 10, 0, 0.25], timeScale)); return; }
  if (k === 'v'){ setOpt('detail', (detailIdx + 1) % DETAIL.length); return; }
  if (k === 'g'){ setOpt('glow', !SET.glow); return; }
  if (k === 'l'){ setOpt('labels', !SET.labels); return; }
  if (k === '?' || k === 'h'){ toggleHelp(true); return; }
  if ('wasdrfqe'.includes(k) && k.length === 1){ keys.add(k); if (!e.repeat) beginManual(); }
  if (k.startsWith('arrow')){ e.preventDefault(); keys.add(k); if (!e.repeat) beginManual(); }
});
addEventListener('keyup', e => keys.delete(e.key.toLowerCase()));
addEventListener('blur', () => keys.clear());
// next / previous (top-right arrows, [ ]): on a tour, the next tour stop; otherwise the next marker up or down the scale bar
function stepObject(dir){
  if (tour.on){ const n = tourNext(dir); tween = null; if (flight) finishFlightHere(); tourGo(n); return; }
  ladderStep(dir);
}
function ladderStep(dir){
  const L = LADDER, cur = flight ? (flight.dest || flight.obj) : (orbit.lock >= 0 ? OBJ[orbit.lock] : null), here = Math.log10(Math.max(flight ? flight.vp.dist : orbit.dist, 1e-30));
  // where we are on the bar: the marker of the object in view (the one closest in scale, if it has two), else our zoom level
  let k = -1, best = 1e9;
  L.forEach((m, j) => { if (cur && m.key === cur.key){ const e = Math.abs(Math.log10(m.d) - here); if (e < best){ best = e; k = j; } } });
  let n;
  if (k >= 0) n = k + dir;
  else if (dir > 0){ n = L.findIndex(m => Math.log10(m.d) > here + 0.05); if (n < 0) n = L.length; }
  else { n = -1; L.forEach((m, j) => { if (Math.log10(m.d) < here - 0.05) n = j; }); }
  if (n < 0 || n >= L.length){ toast(n < 0 ? 'the Moon is the smallest marker on the scale bar' : 'the observable universe is the top of the scale bar'); return; }
  goLadder(L[n]);
}
// the arrows beside the object's name: step through its camera angles (the loop carries on from the new angle)
function stepAngle(dir){
  if (shipCam.on){ setShipCamMode(shipCam.mode === 'chase' ? 'cockpit' : 'chase'); return; }
  if (cmp || flight) return;
  if (tour.on){
    const o = OBJ[tour.obj], n = o.views.length; if (n < 2) return;
    const next = (tour.view + dir + n) % n;
    tour.phase = 'swing'; tour.t = 0; startTween(viewParams(o, next), swingDur()*0.7);
    tween.onDone = () => { tour.view = next; tour.phase = 'hold'; tour.t = 0; };
    return;
  }
  const i = orbit.lock; if (i < 0) return;
  const o = OBJ[i], n = o.views.length, cur = show.obj === i ? show.view : 0, next = (cur + dir + n) % n;
  show.on = true; show.pending = false; show.free = false; show.obj = i; show.phase = 'swing'; show.t = 0; motion.last = 'show';
  startTween(viewParams(o, next), swingDur()*0.7); tween.onDone = () => { show.view = next; show.phase = 'hold'; show.t = 0; };
  updateModeUI();
}
function updateKeys(dt){
  if (!keys.size) return;
  const f = (keys.has('w')?1:0) - (keys.has('s')?1:0), r = (keys.has('d')?1:0) - (keys.has('a')?1:0), u = (keys.has('r')||keys.has('e')?1:0) - (keys.has('f')||keys.has('q')?1:0);
  if (keys.has('arrowleft')) orbit.yaw += dt*1.2;
  if (keys.has('arrowright')) orbit.yaw -= dt*1.2;
  if (keys.has('arrowup')) orbit.pitch = clamp(orbit.pitch + dt*1.0, -1.52, 1.52);
  if (keys.has('arrowdown')) orbit.pitch = clamp(orbit.pitch - dt*1.0, -1.52, 1.52);
  if (f || r || u){
    if (orbit.lock >= 0){ orbit.lock = -1; orbit.offFn = null; updateModeUI(); }
    const sp = orbit.dist*1.1*dt;
    orbit.target = V.add(orbit.target, V.add(V.add(V.mul(cam.fwd, f*sp), V.mul(cam.right, r*sp)), V.mul(cam.up, u*sp)));
  }
}

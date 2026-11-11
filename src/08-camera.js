
// ================================================================ camera: focus-relative, orbiting in the locked object's frame, zoom-pan flights
const cam = { focus:0, rel:[0,0,1], fwd:[0,0,-1], right:[1,0,0], up:[0,1,0], fovY:55*DEG };
const orbit = { yaw:0, pitch:0.1, dist:1, distT:1, lock:0, off:[0,0,0], offFn:null, target:[0,0,0], frame:M3.I() };
// the distance a place's looks go by (what shows at which zoom: a nebula fading round the star inside it, orbit lines, the Crab round its
// pulsar, a readout's close-up line): the camera's distance to what it is locked on; with the Halo, to the place the ship is visiting.
// (Riding along, the lock is the ship a few hundred km away, and every such look took its closest form: the Crab Nebula faded to 4% and
// Saturn's readout said the camera was inside its rings. Owner, 0.9.12: the place must show on the Halo tour)
function viewDist(){ return orbit.lock >= 0 && OBJ[orbit.lock] === ship && ship.parent ? ship.parent.dist : orbit.dist; }
let flight = null, tween = null;
const tour = { on:true, obj:0, view:0, to:null, phase:'hold', t:0 };   // (to: the angle a swing is heading for)
const keys = new Set();
let timeScale = 1, manualAt = -1e9, zoomAt = -1e9;
// on phones the camera looks slightly off-centre so the object sits in the middle of the space the interface leaves free (radians, set by 09h-ui.js)
const viewShift = { x:0, y:0 };
// the leash: two fingers moving together slide the locked object across the screen without letting go of it. x, y: how far its centre sits
// from the middle of the free space, in CSS pixels (right, down); bx, by: how far it may go (35% of the free space); avoid: a rectangle its
// centre stays out of (the card, on a phone on its side). The limits are set by 09h-ui.js. It eases back to the middle when play, a tour
// or a flight takes over, or after a double-tap on the sky (home).
const leash = { x:0, y:0, bx:0, by:0, avoid:null, home:false };
let wakeTapAt = -1e9;   // a tap that only woke the faded interface does not also pick an object
let freeFrom = -1;      // the object the camera last let go of: play and the "back to" pill fly back to it, and the free camera keeps moving with it while near

// the frame the camera orbits in when locked on o: its own frame, unless it supplies a camera frame (the Halo: up is its deck, behind is its stern)
const camFrameOf = o => o.camFrame ? o.camFrame() : o.R0;
const sphL = (yaw, pitch) => [Math.cos(pitch)*Math.sin(yaw), Math.sin(pitch), Math.cos(pitch)*Math.cos(yaw)];
function setBasis(fwd, up){
  cam.fwd = V.norm(fwd);
  let r = V.cross(cam.fwd, up);
  if (V.len(r) < 1e-6) r = V.cross(cam.fwd, V.norm([up[1], up[2], up[0]]));
  cam.right = V.norm(r); cam.up = V.cross(cam.right, cam.fwd);
  // (viewShift is for the view without a long lens: through one, the same shift in pixels is a smaller turn. Worked out for the lens of the
  // moment and eased, it lagged the Halo tour's zoom, and at 40 times it put Alpha Centauri off a phone's screen: 0.9.12)
  const lk = LENS.k || 1;
  let shX = Math.atan(Math.tan(viewShift.x)/lk), shY = Math.atan(Math.tan(viewShift.y)/lk);
  if ((leash.x || leash.y) && !SKYV.on){
    // after the turn below the target sits at X = tan(shX)/cos(shY), Y = tan(shY) on screen (in units of tanX, tanY per half screen):
    // move it by the leash's pixels exactly
    const Y = Math.tan(shY) - leash.y/Math.max(viewHcss/2, 1)*tanY, X = Math.tan(shX)/Math.cos(shY) + leash.x/Math.max(viewWcss/2, 1)*tanX;
    shY = Math.atan(Y); shX = Math.atan(X*Math.cos(shY));
  }
  if ((shX || shY) && !SKYV.on){
    // turn the view a little (left for x > 0, down for y > 0) so the target appears right of / above the centre
    const cx = Math.cos(shX), sx = Math.sin(shX), cy = Math.cos(shY), sy = Math.sin(shY);
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
// A view can say when it is worth playing and when the framing it gave is out of date:
//   ready()  false: the angle loop and the tour skip it (Mimas's crater angle while Herschel is in the night)
//   state()  a value that changes when its framing should change (Mimas going into Saturn's shadow). Each framing remembers the state it
//            was made for; while the camera holds on the angle and the state changes, it glides to the new framing, or moves on if the
//            angle is no longer ready (holdCheck)
const FRAMED = new WeakMap();
const viewReady = v => !v || !v.ready || !!v.ready();
function viewParamsV(o, v){
  if (v.state) FRAMED.set(v, v.state());
  let d = [0, 0.3, 1];
  if (v.d) d = v.d;
  if (v.dirFn || v.track) d = M3.applyT(o.R0, (v.track || v.dirFn)());
  d = V.norm(d);
  let off = [0,0,0], offFn = null;
  if (typeof v.off === 'function') offFn = () => V.mul(M3.apply(o.R0, v.off()), o.rad);
  if (v.off) off = offFn ? offFn() : V.mul(M3.apply(o.R0, v.off), o.rad);
  return { yaw:Math.atan2(d[0], d[2]), pitch:Math.asin(clamp(d[1], -0.999, 0.999)), dist:v.k*o.rad*(v.off ? 1 : viewFit), off, offFn, track:v.track ? () => trackYP(o, v) : null };
}
// the yaw and pitch a view with track() asks for right now (flights and swings to it follow it, so they land on the angle it has then)
function trackYP(o, v){ const d = M3.applyT(o.R0, V.norm(v.track())); return [Math.atan2(d[0], d[2]), Math.asin(clamp(d[1], -0.999, 0.999))]; }
// van Wijk & Nuij optimal zoom-and-pan path (numerically stable forms)
function vwPath(u1, w0, w1, rho){
  // (peak: where along the path the view is widest; w rises to it and falls after it)
  // (rem: the distance still to go, u1 - u(s), worked out without that subtraction: near the end of a trip of millions of light-years it is
  // a few kilometres, far below what the difference of two such numbers can hold)
  if (u1 < 1e-7*Math.min(w0, w1)){ const k = Math.log(w1/w0); return { S:Math.abs(k)/rho + 1e-6, u:() => 0, rem:() => u1, w:s => w0*Math.exp(Math.sign(k)*rho*s), peak:k > 0 ? Infinity : -Infinity }; }
  const r4 = rho*rho*rho*rho;
  const b0 = (w1*w1 - w0*w0 + r4*u1*u1)/(2*w0*rho*rho*u1), b1 = (w1*w1 - w0*w0 - r4*u1*u1)/(2*w1*rho*rho*u1);
  const r0 = -Math.asinh(b0), r1 = -Math.asinh(b1), S = (r1 - r0)/rho, c0 = w0*Math.cosh(r0)/(rho*rho);
  return { S, u:s => w0*Math.sinh(rho*s)/(rho*rho*Math.cosh(rho*s + r0)), rem:s => c0*Math.sinh(rho*(S - s))/(Math.cosh(r1)*Math.cosh(rho*s + r0)),
    w:s => w0*Math.cosh(r0)/Math.cosh(rho*s + r0), peak:-r0/rho };
}
// the widest view on a trip's path, among 25 evenly spaced points (as isScenic has always measured it). The view widens up to the peak and
// narrows after it, so the widest of those points is one of the two around the peak: two evaluations instead of 25.
function pathWidest(path){ const i = Math.floor(clamp(path.peak/path.S*24, 0, 24)); return Math.max(path.w(path.S*i/24), path.w(path.S*Math.min(i + 1, 24)/24)); }
// a trip that zooms far out on the way (its widest view more than 30 times either end, and over 2,000 light-years): such a trip swings over
// the galactic pole and takes longer. (One rule, shared with the random tour, which keeps these trips few.)
function isScenic(path, w0, w1, wMax = pathWidest(path)){ return wMax > 30*Math.max(w0, w1) && wMax > 2000; }
function slerpDir(a, b, t){
  const c = clamp(V.dot(a, b), -1, 1), th = Math.acos(c);
  if (th < 1e-4) return V.norm(V.lerp(a, b, t));
  if (th > 3.1) { const ax = V.norm(V.cross(a, Math.abs(a[1]) < 0.9 ? [0,1,0] : [1,0,0])); return V.norm(V.add(V.mul(a, Math.cos(th*t)), V.mul(ax, Math.sin(th*t)))); }
  const s = Math.sin(th);
  return V.add(V.mul(a, Math.sin((1 - t)*th)/s), V.mul(b, Math.sin(t*th)/s));
}
// (a scenic trip swings the camera round to look along this direction at its widest point)
const DIR_MID = V.norm([0.3, 0.15, 1]), UP_MID = V.norm(V.sub([1, 0, 0], V.mul(DIR_MID, DIR_MID[0])));
// progress table: eased at both ends, and for scenic trips slowed right at the widest point so the big picture can sink in
// (prog[i] = the time fraction at which s/S = i/64)
function flightProg(path, scenic, pass, glide){
  let sPeak = 0, wp = -1; for (let i=0;i<=48;i++){ const w = path.w(path.S*i/48); if (w > wp){ wp = w; sPeak = i/48; } }
  const tbl = [0]; let acc = 0;
  // (the floor falls from 0.15 at departure to 0.025 on arrival: the camera glides in and settles, rather than arriving at speed and stopping dead)
  // (passing an object on the way, the camera eases off a little as it goes by, but never stops)
  const f0 = 0.15, f1 = 0.025;
  // (glide: a long, slow final approach, used to come up behind the Halo)
  for (let i=1;i<=64;i++){ const x = (i - 0.5)/64, ease = (Math.sin(Math.PI*x)*0.85 + f0*(1 - x) + f1*x)*(glide ? 1 - 0.55*smooth(0.6, 1, x) : 1), hover = (scenic ? 1 - 0.8*Math.exp(-Math.pow((x - sPeak)/0.07, 2)) : 1)*(pass ? 1 - 0.4*Math.exp(-Math.pow((x - pass.e)/0.08, 2)) : 1); acc += 1/(ease*hover); tbl.push(acc); }
  return tbl.map(v => v/acc);
}
// how far along the path (0 to 1) a flight is at time fraction x
function flightE(prog, x){
  let j = 0; while (j < 63 && prog[j + 1] < x) j++;
  return clamp((j + (x - prog[j])/Math.max(prog[j + 1] - prog[j], 1e-9))/64, 0, 1);
}
// which way the camera looks back from at time fraction x (dir points from the target to the camera), and its up
function flightDir(f, x){
  let dir, up;
  if (f.scenic){
    if (x < 0.5){ const a = smooth(0.04, 0.42, x); dir = slerpDir(f.dir0, f.dirMid, a); up = V.norm(V.lerp(f.up0, f.upMid, a)); }
    else { const a = smooth(0.58, 0.96, x); dir = slerpDir(f.dirMid, f.dir1, a); up = V.norm(V.lerp(f.upMid, f.up1, a)); }
  } else { const k = smooth(0.15, 0.85, x); dir = slerpDir(f.dir0, f.dir1, k); up = V.norm(V.lerp(f.up0, f.up1, k)); }
  const sw = Math.sin(Math.PI*x)*f.spin;
  return [V.add(V.mul(dir, Math.cos(sw)), V.mul(V.cross(up, dir), Math.sin(sw))), up];
}
function startFlight(o, vp, onDone, via, glide){
  const A = orbit.target.slice(), w0 = Math.max(V.len(V.sub(cam.rel, A)), 1e-30);
  const B = V.add(frel(o), vp.off || [0,0,0]), w1 = vp.dist;
  const path = vwPath(V.len(V.sub(B, A)), w0, w1, 1.3);
  const pass = via ? passBy(via.o, A, B, path) : null;
  const dirEnd = M3.apply(camFrameOf(o), sphL(vp.yaw, vp.pitch));
  // long journeys zoom far out: swing the camera over the galactic pole on the way, so the trip reads as a map
  const scenic = isScenic(path, w0, w1), dirMid = DIR_MID, upMid = UP_MID;
  const prog = flightProg(path, scenic, pass, glide);
  // travel speed: cinematic (slow and scenic), quick (default), warp (near-instant, same path and effects compressed)
  // (the speed you pick always wins, also on computers that ask for reduced motion; changing it mid-flight re-times the rest of the trip)
  const durs = { cinematic:clamp(1.6 + path.S*0.42, 2.4, 13) + (scenic ? 3 : 0), quick:clamp(1.3 + path.S*0.2, 1.8, 6.5) + (scenic ? 1.4 : 0), warp:clamp(0.85 + path.S*0.03, 0.95, 1.6) };
  if (pass) for (const k in durs) if (k !== 'warp') durs[k] += 1.2;
  if (glide) for (const k in durs) if (k !== 'warp') durs[k] += 2.5;
  // (vp.minDur: a flight that shows something on the way takes at least that long, except at warp: the descent onto a launch pad)
  const dur = Math.max(durs[SET.travel] || durs.quick, SET.travel === 'warp' ? 0 : (vp.minDur || 0)*(SET.travel === 'quick' ? 0.65 : 1));
  shipCam.on = shipCam.pending = false;   // any flight takes the camera off the ship (riding along starts again when its own flight lands)
  if (LCAM.on) stopLaunchCam(true, true);   // (and off a launch it was following)
  // start compiling the destination's shaders now, so it is ready to draw on arrival
  if (o.prog) progReady(o.prog); for (const sp of o.particles || []) if (P[sp.prog]) progReady(P[sp.prog]);
  music.whoosh(dur);
  flight = { t:0, dur, durs, path, A, B, L0:V.len(V.sub(B, A)), dir0:V.norm(V.sub(cam.rel, A)), dir1:dirEnd, prog,
    up0:cam.up.slice(), up1:vp.up || M3.apply(camFrameOf(o), [0,1,0]), obj:o, vp, onDone, switched:false, spin:scenic || pass || vp.dirAt ? 0 : (rnd() < 0.5 ? -1 : 1)*0.5, scenic, dirMid, upMid,
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
  // (a place on Earth below the camera's horizon: first up over it, then down, or the flight would go through the Earth; EPL.flyIn,
  // e7s-earth-search.js. It takes over and returns true, or leaves the flight to this)
  if (o.flyIn && o.flyIn(vp, onDone)) return;
  const W = scenicWaypoint(o, vp);
  startFlight(o, vp, onDone, W ? { o:W } : null);
  if (W){ flight.dest = o; toast('passing ' + W.name); }
}
// would a tour trip from a to b stay clear of everything else? The camera path is worked out as startFlight and updateFlight would fly it,
// setting off from any of a's tour angles (with either sway) to b's first one; it must not enter the bounding sphere of a third object
// (one that holds neither end). A trip out of the Large Magellanic Cloud can swing through the edge of the Milky Way's sphere, for example.
// (For the random tour, which picks trips nobody planned; the motion test checks the real flights.)
// list: the objects to stay out of, from clearList (a deal builds it once for all its trips; positions are relative to the camera's focus,
// so the list is only good while the focus stays the same)
function clearList(){ const L = []; for (const o of OBJ) if (!o.parent && o.prog && o.layer >= 2 && !o.marker) L.push({ o, c:frel(o), r:o.rad*1.1 }); return L; }
function tripClear(a, b, list = clearList()){
  const vb = viewParams(b, tourViews(b)[0]), B = V.add(frel(b), vb.off), w1 = vb.dist;
  const dir1 = M3.apply(camFrameOf(b), sphL(vb.yaw, vb.pitch)), up1 = M3.apply(camFrameOf(b), [0, 1, 0]);
  // (an object that holds either end does not count, nor the star a planet at either end circles: a trip to Kepler-16b may pass its suns)
  const holds = (o, e) => V.len(V.sub(o.pos, e.pos)) < o.rad || e.parent === o;
  const near = list.filter(e => e.o !== a && e.o !== b && !holds(e.o, a) && !holds(e.o, b));
  let others = [];
  // (the camera moves in a straight line between two samples: the chord is checked, not only its ends)
  const hit = (P, Q) => {
    const dx = Q[0] - P[0], dy = Q[1] - P[1], dz = Q[2] - P[2], dd = dx*dx + dy*dy + dz*dz;
    for (let i = 0; i < others.length; i += 4){
      const cx = others[i] - P[0], cy = others[i + 1] - P[1], cz = others[i + 2] - P[2], r = others[i + 3];
      const t = dd > 0 ? clamp((cx*dx + cy*dy + cz*dz)/dd, 0, 1) : 0, ex = cx - dx*t, ey = cy - dy*t, ez = cz - dz*t;
      if (ex*ex + ey*ey + ez*ez < r*r) return true;
    }
    return false; };
  for (const v of tourViews(a)){
    const va = viewParams(a, v), A = V.add(frel(a), va.off), w0 = va.dist, AB = V.sub(B, A), L = V.len(AB);
    const path = vwPath(L, w0, w1, 1.3), wMax = pathWidest(path), scenic = isScenic(path, w0, w1, wMax);
    // (the camera looks at a point on the line from A to B, from at most the widest view away (with a margin for the sampling): only the
    // spheres that come that close to the line can be hit, which leaves few or none to check on most trips)
    others = []; for (const e of near){ const t = L > 0 ? clamp(V.dot(V.sub(e.c, A), AB)/(L*L), 0, 1) : 0; if (V.len(V.sub(e.c, V.add(A, V.mul(AB, t)))) < wMax*1.1 + e.r) others.push(e.c[0], e.c[1], e.c[2], e.r); }
    if (!others.length) continue;
    const prog = flightProg(path, scenic, null, false);
    // (the camera's up at departure is the frame's up made square to the view, as setBasis leaves it)
    const dir0 = M3.apply(camFrameOf(a), sphL(va.yaw, va.pitch)), fu = M3.apply(camFrameOf(a), [0, 1, 0]), up0 = V.norm(V.sub(fu, V.mul(dir0, V.dot(fu, dir0))));
    const f = { scenic, dir0, dir1, dirMid:DIR_MID, up0, up1, upMid:UP_MID, spin:0 };
    for (const spin of scenic ? [0] : [-0.5, 0.5]){
      f.spin = spin; let P = V.add(A, V.mul(f.dir0, w0));
      for (let i=1;i<=40;i++){
        const x = i/40, s = path.S*flightE(prog, x), tgt = V.add(A, V.mul(V.sub(B, A), L > 0 ? clamp(path.u(s)/L, 0, 1) : 1));
        const Q = V.add(tgt, V.mul(flightDir(f, x)[0], i === 40 ? w1 : path.w(s)));
        if (hit(P, Q)) return false;
        P = Q;
      }
    }
  }
  return true;
}
function updateFlight(dt){
  const f = flight; f.t += dt;
  const x = clamp(f.t/f.dur, 0, 1);
  const e = flightE(f.prog, x), s = f.path.S*e;
  // (the share of the trip still to go, by distance, as the path measures it: exact however long the trip)
  const g = f.L0 > 0 ? clamp(f.path.rem(s)/f.L0, 0, 1) : 0, w = x >= 1 ? f.vp.dist : f.path.w(s);
  // positions switch to being relative to the destination halfway by time, or sooner, halfway by distance, when the place it set off from
  // is too far away to put the destination within a thousandth of the view's width (a float64 holds about 16 digits: from the observable
  // universe that is thousands of kilometres, and the 2.5 km Halo was lost off the screen until the last frame, 0.9.6)
  if (!f.switched){
    const D = x > 0.5 || g < 0.5 ? frel(f.obj) : null;
    if (D && (x > 0.5 || V.len(D)*2.3e-16 > 1e-3*w)){ f.A = V.sub(f.A, D); cam.focus = f.obj.index; f.switched = true; }
  }
  // aim at where the destination is now, not where it was at take-off: planets and moons keep moving during the flight,
  // and aiming at a stale point meant closing in on empty space and then jumping to the real object in the last frame
  const Bnow = V.add(frel(f.obj), f.vp.offFn ? f.vp.offFn() : (f.vp.off || [0, 0, 0]));
  // (measured from the nearer end: from where it set off in the first half of the way, back from the destination in the second, so rounding
  // never moves it by more than a sliver of what is left to go)
  const dAB = V.sub(Bnow, f.A); let tgt = g > 0.5 ? V.add(f.A, V.mul(dAB, 1 - g)) : V.sub(Bnow, V.mul(dAB, g));
  // (a destination can bend the way the aim travels: vp.tgtAt, round the Earth instead of through it, s4-spacex-run.js)
  if (f.vp.tgtAt) tgt = f.vp.tgtAt(tgt, f.A, Bnow, g, w, x);
  if (f.pass){ const b = passBump(f.pass, e); tgt[0] += f.pass.bend[0]*b; tgt[1] += f.pass.bend[1]*b; tgt[2] += f.pass.bend[2]*b; }
  // flying up to the Halo: it turns as it goes, so the final framing follows its frame (no swing on landing)
  if (f.obj.camFrame){ f.dir1 = M3.apply(camFrameOf(f.obj), sphL(f.vp.yaw, f.vp.pitch)); f.up1 = f.vp.upFn ? f.vp.upFn() : M3.apply(camFrameOf(f.obj), [0, 1, 0]); }
  // flying to an angle that follows something moving (a planet's day side as it circles its star): the landing direction follows it too
  if (f.vp.track){ [f.vp.yaw, f.vp.pitch] = f.vp.track(); f.dir1 = M3.apply(camFrameOf(f.obj), sphL(f.vp.yaw, f.vp.pitch)); }
  let [dir, up] = flightDir(f, x);
  // (a destination can steer the camera itself: vp.dirAt, the rockets' approach, which comes down over the pad from above: s4-spacex-run.js)
  if (f.vp.dirAt) [dir, up] = f.vp.dirAt(x, w, dir, up, tgt, f);
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
// (on a place on Earth the aim it starts from is kept in the place's frame, which turns with the Earth: kept fixed in space, it went
// under the ground when the time was moved during a swing; 0.13.0)
function startTween(to, dur){ const o = OBJ[orbit.lock], loc = !!(o && o.earthSpot);
  tween = { t:0, dur, from:{yaw:orbit.yaw, pitch:orbit.pitch, dist:orbit.dist, off:orbit.off.slice(), offL:loc ? M3.applyT(orbit.frame, orbit.off) : null}, to }; }
const wrapA = a => Math.atan2(Math.sin(a), Math.cos(a));
function updateTween(dt){
  const w = tween; w.t += dt; const u = ease(clamp(w.t/w.dur, 0, 1));
  // the way round is chosen once, on the first frame; after that a tracked angle only adds its own motion, so a target that
  // crosses the far side during the swing does not flip the turn the other way (it used to jump up to 120 degrees in one frame)
  if (w.to.track){ const [y, p] = w.to.track(); w.dy = w.dy == null ? wrapA(y - w.from.yaw) : w.dy + wrapA(y - w.ty); w.ty = y; w.to.yaw = y; w.to.pitch = p; }
  else if (w.dy == null) w.dy = wrapA(w.to.yaw - w.from.yaw);
  orbit.yaw = w.from.yaw + w.dy*u;
  orbit.pitch = w.from.pitch + (w.to.pitch - w.from.pitch)*u;
  orbit.dist = orbit.distT = Math.exp(Math.log(w.from.dist) + (Math.log(w.to.dist) - Math.log(w.from.dist))*u);
  orbit.off = V.lerp(w.from.offL ? M3.apply(orbit.frame, w.from.offL) : w.from.off, w.to.offFn ? w.to.offFn() : (w.to.off || [0,0,0]), u);
  if (w.t >= w.dur){ orbit.offFn = w.to.offFn || null; tween = null; w.onDone && w.onDone(); }
}
const TOUR = [];   // filled after all objects exist (list of object indices)
// the angles a tour plays at a stop (indices into o.views): all of them, unless the object lists fewer for tours (tourViews: Earth plays
// three there, about 30 s instead of a minute; picked by itself it still loops through all of them)
const TVIEWS = new WeakMap();
function tourViews(o){
  let c = TVIEWS.get(o);
  if (!c || c.v !== o.views){ const all = o.views.map((_, i) => i), L = (o.tourViews || []).filter(i => o.views[i]); c = { v:o.views, L:L.length ? L : all }; TVIEWS.set(o, c); }
  return c.L;
}
// the guided tour: outward from home to the edge of the observable universe
const TOUR_KEYS = ['earth', 'moon', 'sun', 'jupiter', 'saturn', 'solarsystem', 'oort', 'alphacen', 'betelgeuse', 'hltau', 'catseye', 'pillars', 'crab', 'crabpulsar', 'etacar', 'rsoph',
  'omegacen', 'galcentre', 'sgra', 'magnetar', 'milkyway', 'sn1987a', 'andromeda', 'm51', 'antennae', 'm87', 'gw170817', '3c273', 'ton618', 'cosmicweb', 'universe'];
function tourGo(i, instant){
  const o = OBJ[i]; tour.obj = i; tour.view = tourViews(o)[0]; tour.to = null; tour.t = 0; tour.last = null; show.on = show.pending = false; motion.last = 'tour';
  o.tourReset && o.tourReset();
  const vp = viewParams(o, tour.view);
  setInfo(i);
  if (instant){
    cam.focus = i; orbit.lock = i; orbit.frame = camFrameOf(o); orbit.off = vp.off.slice(); orbit.offFn = vp.offFn;
    orbit.yaw = vp.yaw; orbit.pitch = vp.pitch; orbit.dist = orbit.distT = vp.dist; orbit.target = V.add(frel(o), vp.off);
    applyOrbit(); tour.phase = 'hold'; return;
  }
  tour.phase = 'fly';
  flyTo(o, vp, () => { tour.phase = 'hold'; tour.t = 0; });
}
// the stop after (or before) this one; on the last stop of a dealt tour (the random tour) going on deals new places, starting from here,
// so it never loops. (Its callers fly on at once; goNextState must not call it, it only says where the button goes.)
function tourNext(dir = 1){
  const k = TOUR.indexOf(tour.obj);
  if (dir > 0 && k === TOUR.length - 1 && tourDeals()){ dealAgain(OBJ[tour.obj]); return TOUR[0]; }
  return TOUR[((k < 0 ? 0 : k) + dir + TOUR.length) % TOUR.length];
}
function updateTour(dt){
  const o = OBJ[tour.obj];
  if (tour.phase === 'hold'){
    const v = o.views[tour.view], hold = holdOf(v);
    tour.t += dt;
    const chk = holdCheck(v);
    if (chk === 'reframe'){
      tour.phase = 'swing'; tour.t = 0; tour.to = tour.view;
      startTween(viewParams(o, tour.view), swingDur()); tween.onDone = () => { tour.to = null; tour.phase = 'hold'; tour.t = 0; };
      return;
    }
    if (chk === 'skip') tour.t = hold + 1;
    if (v.to) playMove(o, v, clamp(tour.t/hold, 0, 1));
    else if (v.track) trackView(o, v, dt);
    else orbit.yaw += v.drift*dt;
    if (tour.t > hold){
      const L = tourViews(o), k = L.indexOf(tour.view);
      let j = k + 1; while (j < L.length && !viewReady(o.views[L[j]])) j++;   // (angles that are not ready are skipped)
      if (k >= 0 && j < L.length){
        const next = L[j];
        tour.phase = 'swing'; tour.t = 0; tour.to = next;
        startTween(viewParams(o, next), swingDur());
        tween.onDone = () => { tour.view = next; tour.to = null; tour.phase = 'hold'; tour.t = 0; };
      } else tourGo(tourNext(1));
    }
  }
}
const holdOf = v => v.hold*(v.to ? Math.max(dwellK(), 0.75) : dwellK());
// holding on an angle whose state() changed since its framing was made: 'reframe' (glide to its new framing) or 'skip' (it is not ready any more: move on)
function holdCheck(v){
  if (!v.state || !FRAMED.has(v) || v.state() === FRAMED.get(v)) return null;
  return viewReady(v) ? 'reframe' : 'skip';
}
// a view with track(): while it holds, the camera keeps turning toward a moving direction (world frame) instead of drifting
function trackView(o, v, dt){
  const [y, p] = trackYP(o, v);
  const k = 1 - Math.exp(-dt*2.5); let dy = y - orbit.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
  orbit.yaw += dy*k; orbit.pitch += (p - orbit.pitch)*k;
}
// ---------------------------------------------------------------- riding along with the Halo: a chase camera behind and above the ship (third person), or the bridge (first person)
// Poses are in the ship's frame (+y forward, -x dorsal = up); the camera follows them with a little lag so turns feel like flying, not like a bolted-on view.
// The chase camera sits low and looks along the heading: from higher up the needle points up the screen and the ship seems to climb.
// When the ship folds space the camera folds with it: it stays attached, and a flash covers the jump.
const shipCam = { on:false, pending:false, mode:'chase', zoom:1, eye:null, fwd:null, up:null, turn:null };
const SHIP_POSE = { chase:{ eye:[-0.8, -3.0, 0], look:[-0.3, 1.5, 0], lag:3.2 }, cockpit:{ eye:[-0.15, -0.1, 0], look:[-0.05, 2.2, 0], lag:14 }, turn:{ lag:12 } };
// (while the Halo works on a body below it, ship.viewR turns the chase rig toward the body and ship.chaseOff aims it at the ship's belly,
// so the job shows beside and beneath it; on the bridge the eye stays put and the pilot's gaze, ship.gazeR, turns toward the body)
// ('turn': a camera circling the ship for the showcase, its pose set from outside in the ship's frame, in ship radii: shipCam.turn = { eye, look, up })
function shipPose(mode){
  const q = SHIP_POSE[mode], R = ship.R0, r = ship.rad;
  if (mode === 'turn'){ const T = shipCam.turn, eye = V.mul(M3.apply(R, T.eye), r), look = V.mul(M3.apply(R, T.look || [0, 0, 0]), r);
    return { eye, look, fwd:V.norm(V.sub(look, eye)), up:M3.apply(R, T.up || [-1, 0, 0]) }; }
  // (riding along, 0.9.6: the camera shows the ship with the place it visits behind it, and moves between shots: ridePose in 08r-ride.js,
  // which blends into chasePose between places)
  if (mode === 'chase') return ridePose();
  const Rg = ship.gazeR || R, eye = V.mul(M3.apply(R, q.eye), r), look = V.add(eye, V.mul(M3.apply(Rg, V.sub(q.look, q.eye)), r));
  return { eye, look, fwd:V.norm(V.sub(look, eye)), up:M3.apply(Rg, [-1, 0, 0]) };
}
// the chase pose: low behind the ship, looking along its heading (riding along between places, and in the lab)
// (ship.S.fz: closer in while the ship folds, and aimed a little more at the ship, so the break-up fills more of the screen; 07h-halo.js)
function chasePose(){
  const q = SHIP_POSE.chase, R = ship.R0, r = ship.rad, Rv = ship.viewR || R, o = ship.chaseOff || [0, 0, 0], fz = ship.S.fz || 1;
  const eye = V.mul(M3.apply(Rv, V.mul(q.eye, shipCam.zoom*fz)), r), look = V.mul(M3.apply(Rv, V.add(V.mul(q.look, fz*fz), o)), r);
  return { eye, look, fwd:V.norm(V.sub(look, eye)), up:M3.apply(Rv, [-1, 0, 0]) };
}
function shipCamSnap(p){ shipCam.eye = p.eye; shipCam.fwd = p.fwd; shipCam.up = p.up; }
function startShipCam(mode){
  if (typeof ship === 'undefined' || !ship.S.target) return;
  stopTour(false); pauseShow(); tween = null; flyMove = null; if (cmp) endCompare(true);
  shipCam.mode = mode || shipCam.mode; motion.last = 'ship';
  setInfo(ship.index);
  const near = cam.focus === ship.index && orbit.lock === ship.index && V.len(cam.rel) < ship.rad*30 && !flight;
  rideStart();   // (the first shot, so the flight up to the ship lands on it)
  if (near){ shipCam.on = true; shipCam.eye = cam.rel.slice(); shipCam.fwd = cam.fwd.slice(); shipCam.up = cam.up.slice(); updateModeUI(); return; }
  // fly in first, landing exactly on the ride pose, then take over (the ship keeps moving and turning: the flight follows its pose as it goes,
  // the place it visits turning round it too: rideFrame, and the landing direction by track)
  const p = shipPose('chase'), yp = q => { const d = M3.applyT(camFrameOf(ship), V.norm(V.sub(q.eye, q.look))); return [Math.atan2(d[0], d[2]), Math.asin(clamp(d[1], -0.999, 0.999))]; }, [y0, p0] = yp(p);
  const vp = { yaw:y0, pitch:p0, dist:V.len(V.sub(p.eye, p.look)), off:p.look, offFn:() => { rideFrame(0); return shipPose('chase').look; }, up:p.up, upFn:() => shipPose('chase').up, track:() => yp(shipPose('chase')) };
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
function setShipCamMode(m){ shipCam.mode = m; if (!shipCam.on) startShipCam(m); updateModeUI(); toast(m === 'cockpit' ? 'cockpit view · on the bridge of the Halo' : rideStill() ? 'outside view · the Halo with the place it visits behind it' : 'outside view · the camera moves round the Halo and the place it visits'); }
function updateShipCam(dt){
  if (cam.focus !== ship.index){ const D = frel(ship); cam.rel = V.sub(cam.rel, D); cam.focus = ship.index; if (shipCam.eye) shipCam.eye = cam.rel.slice(); }
  if (shipCam.mode === 'chase') rideStep(dt);
  // (the lag in step with the Halo tour's lens: through a long lens the same lag moves the picture as many times further, and at 40 times
  // it lost Alpha Centauri from a view a degree and a half high. The tour's own shots are smooth already, every change eased or on a
  // spring, and follow closely: on a low pass the view swings fast, and a quarter of a second behind, the horizon fell out of the picture)
  const ride = shipCam.mode === 'chase', lag = SHIP_POSE[shipCam.mode].lag*(ride ? Math.max(RIDE.fam === 'tour' ? 4 : 1, Math.exp(RIDE.lk)) : 1);
  const p = shipPose(shipCam.mode), k = dt > 0 ? 1 - Math.exp(-dt*lag) : 1;
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
const show = { on:false, pending:false, obj:-1, view:0, to:null, t:0, phase:'hold', free:false };   // free: a scale picked on the ladder, so the camera only circles slowly at that distance
const motion = { last:'tour' };
function startShow(i, view = 0, free = false){
  const o = OBJ[i]; if (!o) return;
  show.free = free; show.on = true; show.pending = false; show.obj = i; show.view = clamp(view, 0, o.views.length - 1); show.to = null; show.t = 0; show.phase = 'hold'; motion.last = 'show';
  updateModeUI();
}
function updateShow(dt){
  const o = OBJ[show.obj];
  if (!o || orbit.lock !== show.obj){ show.on = false; updateModeUI(); return; }
  if (show.phase !== 'hold'){ if (!tween){ show.phase = 'hold'; show.t = 0; } return; }   // gliding between angles: the tween moves the camera
  if (show.free){ orbit.yaw += 0.035*dt; return; }
  const v = o.views[show.view], hold = holdOf(v);
  show.t += dt;
  const chk = holdCheck(v);
  if (chk === 'reframe'){
    show.phase = 'swing'; show.t = 0; show.to = show.view;
    startTween(viewParams(o, show.view), swingDur()); tween.onDone = () => { show.to = null; show.phase = 'hold'; show.t = 0; };
    return;
  }
  if (chk === 'skip') show.t = hold + 1;
  if (v.to) playMove(o, v, clamp(show.t/hold, 0, 1));
  else if (v.track) trackView(o, v, dt);
  else orbit.yaw += v.drift*dt;
  if (show.t > hold && o.views.length > 1){
    const n = o.views.length; let next = (show.view + 1) % n;
    for (let j=1;j<n;j++){ const c = (show.view + j) % n; if (viewReady(o.views[c])){ next = c; break; } }   // (angles that are not ready are skipped)
    show.phase = 'swing'; show.t = 0; show.to = next;
    startTween(viewParams(o, next), swingDur());
    tween.onDone = () => { show.view = next; show.to = null; show.phase = 'hold'; show.t = 0; };
  }
}
// carry on from wherever the camera is: glide back into the current angle, then keep looping
function resumeShow(){
  const i = orbit.lock, o = OBJ[i]; if (!o) return;
  const view = show.obj === i ? show.view : 0;
  if (show.free && show.obj === i){ show.on = true; show.pending = false; show.phase = 'hold'; motion.last = 'show'; if (flight) finishFlightHere(); updateModeUI(); return; }
  show.free = false; show.on = true; show.pending = false; show.obj = i; show.view = show.to = view; show.phase = 'swing'; show.t = 0; motion.last = 'show';
  if (flight) finishFlightHere();
  startTween(viewParams(o, view), swingDur()*0.8);
  tween.onDone = () => { show.to = null; show.phase = 'hold'; show.t = 0; };
  updateModeUI();
}
function pauseShow(){ if (show.on || show.pending){ show.on = show.pending = false; motion.last = 'show'; if (show.phase === 'swing') tween = null; } }
const isPlaying = () => tour.on || show.on || show.pending || !!flyMove || shipCam.on || (!!flight && !!shipCam.pending && flight.obj === ship) || LCAM.on || (!!flight && !!SX.pend);
// the play / pause control (and the space bar): pause whatever moves the camera; play brings back the last thing that did
function togglePlay(){
  if (tour.on){ stopTour(false); motion.last = 'tour'; toast('paused · press play (or space) to carry on with the tour'); }
  else if (LCAM.on){ stopLaunchCam(); toast('paused · the camera is yours · press play to follow the flight again'); }
  else if (motion.last === 'launch' && sxResume()){}
  else if (shipCam.on){ stopShipCam(); toast('paused · press play to ride along with the Halo again'); }
  else if (motion.last === 'ship' && typeof ship !== 'undefined' && orbit.lock === ship.index){ startShipCam(); }
  else if (show.on || show.pending || flyMove){ pauseShow(); flyMove = null; tween = null; toast('paused · the camera is yours · press play to carry on'); }
  else if (backTarget()) goBack();
  else if (motion.last === 'show' && orbit.lock >= 0 && !cmp) resumeShow();
  else setTour(true);
  updateModeUI();
}
// in free camera, play (and the "back to" pill) flies back to the object you let go of and plays its angles again
const backTarget = () => orbit.lock < 0 && !flight && !tour.on && !cmp && !SKYV.on && OBJ[freeFrom] && !OBJ[freeFrom].hidden ? OBJ[freeFrom] : null;
function goBack(){
  const o = backTarget(); if (!o) return;
  hideHint(); lockOn(o.index, show.obj === o.index ? show.view : 0); toast('back to ' + o.name);
}
// home (the home button, the logo, H and the Home key): fly to Earth's opening view from anywhere. A running tour pauses, so "resume tour" can pick it up again.
function goHome(){
  hideHint();
  if (SKYV.on){ exitSky(); return; }   // (leaving your sky flies back up to Earth)
  if (cmpPick){ cmpPick = false; atlasTitle(); toggleAtlas(false); }
  if (cmp) endCompare(false);
  const touring = tour.on;
  lockOn(earth.index, 0);
  toast(touring ? 'home · Earth · the tour is paused: "back to the tour" picks it up again' : 'home · Earth');
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
    if (orbit.lock === i && !flight){ const v0 = tourViews(OBJ[i])[0]; tour.obj = i; tour.view = tour.to = v0; tour.t = 0; tour.phase = 'swing'; startTween(viewParams(OBJ[i], v0), 2.5); tween.onDone = () => { tour.to = null; tour.phase = 'hold'; tour.t = 0; }; setInfo(i); }
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
  // (on the Halo tour a click on the ship rides along again, with the tour's shots, rather than the ship's own angles, which trail it and
  // leave the place behind the camera: owner, 0.9.12)
  if (HT.on && typeof ship !== 'undefined' && i === ship.index){ if (!shipCam.on && !shipCam.pending) startShipCam('chase'); return; }
  stopTour(false); orbit.offFn = null; show.on = false;
  const o = OBJ[i], vi = Math.min(viewIdx, o.views.length - 1);
  const vp = viewParams(o, vi);
  setInfo(i);
  show.pending = loop; if (loop) motion.last = 'show';
  flyTo(o, vp, loop ? () => { if (show.pending) startShow(i, vi); } : null);
  updateModeUI();
}
function unlock(){ shipCam.on = false; pauseShow(); if (orbit.lock < 0 && !tour.on) return; stopTour(false); if (flight) finishFlightHere(); letGo(); }
// the camera lets go of the object it was locked on (free camera); remember which, so play can fly back and the view keeps moving with it
function letGo(){ if (orbit.lock >= 0) freeFrom = orbit.lock; orbit.lock = -1; orbit.offFn = null; updateModeUI(); }
function nearestObject(){ let b = 0, bd = 1e300; OBJ.forEach((o, i) => { if (o.layer < 2 || o.noPick || o.marker) return; const d = o.dist/o.rad; if (d < bd){ bd = d; b = i; } }); return b; }

// ---------------------------------------------------------------- input
const pointers = new Map();
let drag = null, skyTap = null;
canvas.addEventListener('contextmenu', e => e.preventDefault());
canvas.addEventListener('pointerdown', e => {
  canvas.setPointerCapture(e.pointerId);
  pointers.set(e.pointerId, {x:e.clientX, y:e.clientY});
  // (on a rocket or its pad a right-drag turns round it like a left drag: a pan let go of it, and the free camera, which moves with the
  // rocket, slid the rocket across the screen as if you were dragging it: owner, 0.10.1)
  const lk = OBJ[orbit.lock], onRocket = LCAM.on || !!(lk && (lk.sx || lk.sxSite));
  if (pointers.size === 1) drag = { x0:e.clientX, y0:e.clientY, t0:performance.now(), moved:0, pan:(e.button === 2 || e.shiftKey) && !onRocket, turn:e.button === 2 || e.ctrlKey };
  else if (drag){ drag.moved = 99; drag.two = null; }   // (a new two-finger gesture starts from here)
  // (the class on body stops text being selected under a drag. It was `body:has(#view.dragging) *` until 0.27.2: with :has() on body, every
  // text the page wrote, a readout or the scale bar's number, made the browser work out the style of all 1,800 elements again, 4 ms a time)
  canvas.classList.add('dragging'); document.body.classList.add('view-drag');
});
canvas.addEventListener('pointermove', e => {
  const p = pointers.get(e.pointerId); if (!p) return;
  const dx = e.clientX - p.x, dy = e.clientY - p.y;
  if (pointers.size >= 2){
    const [a, b] = pointers.values();   // (a third finger is ignored)
    if (p !== a && p !== b){ p.x = e.clientX; p.y = e.clientY; return; }
    const before = Math.hypot(a.x - b.x, a.y - b.y), mx0 = (a.x + b.x)/2, my0 = (a.y + b.y)/2;
    p.x = e.clientX; p.y = e.clientY;
    const after = Math.hypot(a.x - b.x, a.y - b.y), mx1 = (a.x + b.x)/2, my1 = (a.y + b.y)/2;
    beginManual();
    twoFingers(before, after, mx0, my0, mx1, my1);
    return;
  }
  p.x = e.clientX; p.y = e.clientY;
  if (!drag || drag.dead) return;
  drag.moved += Math.abs(dx) + Math.abs(dy);
  if (drag.moved < 4) return;
  beginManual();
  // (near a surface the ground follows the mouse, and a right-drag or Ctrl-drag turns and tilts: surfaceMode)
  const S = surfaceMode();
  if (S){
    if (S.kind === 'ground' && !drag.turn && !S.far) EPL.panPx(S.o, dx, dy);
    else { const k = drag.turn || S.kind === 'ground' ? 0.005 : grabK(S); orbit.yaw -= dx*k; orbit.pitch = clamp(orbit.pitch + dy*k, S.kind === 'ground' ? 0.03 : -1.52, 1.52); }
    return;
  }
  if (drag.pan) panBy(dx, dy);
  else { orbit.yaw -= dx*0.005; orbit.pitch = clamp(orbit.pitch + dy*0.005, -1.52, 1.52); }
});
// ---------------------------------------------------------------- near a surface (0.13.0, owner: "fix how to navigate zoomed up planets and cities: very easy and smooth"):
// like Google Earth. Over a place on Earth (the place objects, e7s-earth-search.js) a drag moves over the ground and the ground follows the
// mouse; close to a planet or moon (within 6 of its radii) a drag turns the globe so the ground under the mouse keeps up with it, where it
// used to race ten times faster near the surface. Everywhere near a surface: a right-drag or Ctrl-drag turns and tilts, the wheel zooms
// toward the cursor, W A S D and the arrows glide over the ground, Q E turn, R F tilt. Farther out the camera works as before.
function surfaceMode(){
  const o = OBJ[orbit.lock]; if (!o || flight || SKYV.on || shipCam.on || LCAM.on || cmp) return null;
  if (o.earthSpot) return { kind:'ground', o, far:EPL.rising(o) };   // (far: on the way out to the Earth, where a drag turns and the place stays put)
  if (o.solid && orbit.dist < o.rad*6 && !o.sx && !o.sxSite) return { kind:'globe', o, R:o.rad*o.solid*magOf(o) };
  return null;
}
// ---------------------------------------------------------------- scrolling out of a place on a body (0.27.12 for Earth, 0.27.13 for the Moon;
// owner: zooming out of a place on Earth "spiralled out of control"). Locked on a place, the camera used to stay locked on it however far
// out it went. Between a and 4a km from it the camera goes over from the place to its body: the point it circles glides from the place to
// the body's middle, and its up turns from the place's vertical to the body's north, about the line of sight, so the camera itself never
// swings. At the far end the picture is exactly the one a lock on the body gives, and the lock becomes that. How far over it is follows
// the distance (scrolling back in before the end comes back to the place), but takes 1.7 s or more each way (longer for a big roll, at most about 50 degrees a second) (`o.riseW`): a hard scroll
// passes both distances within a quarter of a second, and the up then rolled at 300 degrees a second. The place's update calls it before
// its own framing (true: it has the camera this tick, so the place leaves its frame and ground clearance alone). Rb: the body's radius, km
function riseK(a, d = orbit.dist){ return clamp(Math.log(Math.max(d/KM, 1e-9)/a)/Math.log(4), 0, 1); }
// (scrolling back in on the way: the camera may come no nearer than the distance that matches how far over it still is, so the way back
// keeps the same pace as the way out and never goes through the ground; the frame's zoom easing obeys it in the same tick, 09-render.js)
const distFloor = { d:0, at:-1 };
const turnAbout = (d, t) => { const c = Math.cos(t), s = Math.sin(t), col = v => V.add(V.add(V.mul(v, c), V.mul(V.cross(d, v), s)), V.mul(d, V.dot(d, v)*(1 - c)));
  return [...col([1, 0, 0]), ...col([0, 1, 0]), ...col([0, 0, 1])]; };
function riseTo(o, body, Rb, a){
  // (only a camera moved by hand: a tour, the angles playing and a swing between two of them frame the place themselves)
  // (riseAt: the last tick this ran; after a gap, a flight or a lock elsewhere, it starts from the place again)
  const byHand = !tween && !tour.on && !show.on && !flyMove && !cmp && !shipCam.on, dt = GT - (o.riseAt == null ? GT : o.riseAt); o.riseAt = GT;
  const d = M3.apply(o.R0, sphL(orbit.yaw, orbit.pitch)), F = camFrameOf(body);
  // (the roll from the place's up to the body's, seen along the line of sight: up to half a turn, from Tycho's first angle 170 degrees)
  const flat = y => { const v = V.sub(y, V.mul(d, V.dot(y, d))); return V.len(v) > 1e-4 ? V.norm(v) : null; };
  const pa = flat(M3.apply(o.R0, [0, 1, 0])), pb = flat(M3.apply(F, [0, 1, 0])), th = pa && pb ? Math.atan2(V.dot(d, V.cross(pa, pb)), V.dot(pa, pb)) : 0;
  // (0.6 a second, slower for a big roll: at most about 50 degrees a second, smooth's steepest slope being 1.5)
  const rate = Math.min(0.6, 0.58/Math.max(Math.abs(th), 1e-3));
  // (after a gap the aim kept for the way back belongs to another visit: forget it, or a new angle opened on the old one's aim; Codex)
  if (!(dt < 0.25)) o.riseOff = null;
  if (!byHand || !(dt < 0.25)) o.riseW = 0;
  else {
    // (out: it follows the distance the camera has reached; in: it heads for where the wheel sent it, and the camera waits for it
    // (distFloor), so the point it circles and its roll come back as smoothly as they went. Two of Codex's reviews: first the camera went
    // through the ground scrolling back in, then a cap on how far over it could be, worked out from the distance, undid tens of degrees of
    // roll in one tick)
    const to = riseK(a, Math.min(orbit.dist, orbit.distT)), v = o.riseW || 0; o.riseW = v + clamp(to - v, -dt*rate, dt*rate);
    if (o.riseW > 0){ distFloor.d = a*KM*Math.pow(4, o.riseW); distFloor.at = GT; }
  }
  const w = smooth(0, 1, o.riseW);
  if (!(o.riseW > 0)){ if (o.riseOff){ orbit.off = M3.apply(o.R0, o.riseOff); o.riseOff = null; } return false; }
  // (the aim the camera had at the place, kept in the place's frame for the way back)
  if (!o.riseOff){ o.riseOff = M3.applyT(o.R0, orbit.off); orbit.offFn = null; }
  if (w >= 1){
    const n = M3.applyT(F, d); o.riseOff = null; o.riseW = 0;
    cam.focus = body.index; orbit.lock = body.index; orbit.frame = F; orbit.off = [0, 0, 0]; orbit.offFn = null;
    orbit.yaw = Math.atan2(n[0], n[2]); orbit.pitch = Math.asin(clamp(n[1], -0.999, 0.999));
    if (typeof setInfo === 'function' && infoObj === o.index) setInfo(body.index);
    if (typeof updateModeUI === 'function') updateModeUI();
    return true;
  }
  // (o.offset: the place from its body's middle)
  orbit.off = V.add(V.mul(M3.apply(o.R0, o.riseOff), 1 - w), V.mul(o.offset, -w));
  orbit.frame = M3.mul(turnAbout(d, th*w), o.R0);
  return true;
}
// (a globe: how far to turn it for a pixel, so the ground under the middle of the view moves with the mouse; never faster than before)
const grabK = S => Math.min(0.005, 2*tanY/viewHcss*Math.max(orbit.dist - S.R, S.R*1e-4)/S.R);
// (the wheel's move toward the cursor, still to go: eased over the same time as the zoom)
const gPend = { x:0, y:0 };
function groundEase(dt){
  if (!gPend.x && !gPend.y) return;
  const S = surfaceMode(); if (!S){ gPend.x = gPend.y = 0; return; }
  const k = 1 - Math.exp(-dt*7), x = gPend.x*k, y = gPend.y*k; gPend.x -= x; gPend.y -= y;
  if (Math.abs(gPend.x) + Math.abs(gPend.y) < 0.05) gPend.x = gPend.y = 0;
  // (toward the cursor: the place moves toward where the mouse is, which is the ground moving the other way)
  if (S.kind === 'ground') EPL.panPx(S.o, -x, -y);
  else { const g = grabK(S); orbit.yaw += x*g; orbit.pitch = clamp(orbit.pitch - y*g, -1.52, 1.52); }
}
// two fingers (touch screens): the spread zooms exactly as far as the fingers spread (three times apart = three times closer), about the object,
// never past its surface; moving both fingers together slides it across the screen on the leash, still locked on (in free camera: a pan).
// A slide only starts once the fingers clearly travel together, so a pinch whose middle drifts a little stays a pure zoom.
function twoFingers(before, after, mx0, my0, mx1, my1){
  const g = drag || (drag = { moved:99 });
  const T = g.two || (g.two = { mx:mx0, my:my0, sp:before, slide:false });
  if (before > 10 && after > 10){ zoomBy(before/after); orbit.dist = orbit.distT; }   // (no easing: the view follows the fingers)
  let dx = mx1 - mx0, dy = my1 - my0;
  if (!T.slide){
    const m = Math.hypot(mx1 - T.mx, my1 - T.my);
    if (m < 16 || m < 0.8*Math.abs(after - T.sp)) return;
    T.slide = true; dx = mx1 - T.mx; dy = my1 - T.my;   // (the slide catches up with the fingers)
  }
  if (SKYV.on) return;
  if (orbit.lock >= 0) slideBy(dx, dy); else panBy(dx, dy);
}
// move the locked object across the screen by (dx, dy) CSS pixels, keeping it inside the leash box
function slideBy(dx, dy){ leash.x += dx; leash.y += dy; leash.home = false; clampLeash(); }
function clampLeash(){
  leash.x = clamp(leash.x, -leash.bx, leash.bx); leash.y = clamp(leash.y, -leash.by, leash.by);
  const A = leash.avoid; if (!A) return;
  // where the object rests (the middle of the free space) and where the leash puts it; a centre that would sit on the card goes over its nearer free edge
  const X0 = Math.tan(viewShift.x)/Math.cos(viewShift.y), Y0 = Math.tan(viewShift.y);
  const rx = viewWcss/2*(1 + X0/tanX0), ry = canvasHcss - viewHcss/2*(1 + Y0/tanY0), px = rx + leash.x, py = ry + leash.y;
  if (px <= A.left || px >= A.right || py <= A.top || py >= A.bottom) return;
  const toTop = A.top - ry, toRight = A.right - rx, okTop = toTop >= -leash.by, okRight = toRight <= leash.bx;
  if (okTop && (!okRight || py - A.top <= A.right - px)) leash.y = toTop; else if (okRight) leash.x = toRight;
}
function updateLeash(dt){
  if (!leash.x && !leash.y){ leash.home = false; return; }
  if (leash.home || orbit.lock < 0 || SKYV.on || flight || tween || cmp || isPlaying()){
    const k = Math.exp(-dt*3); leash.x *= k; leash.y *= k;
    if (Math.abs(leash.x) + Math.abs(leash.y) < 0.5){ leash.x = leash.y = 0; leash.home = false; }
  } else clampLeash();   // (the phone may have turned, or the card grown: the object stays inside the box)
}
function endPointer(e){
  const wasTap = drag && pointers.size === 1 && drag.moved < 6 && performance.now() - drag.t0 < 450;
  pointers.delete(e.pointerId);
  // one finger of two lifted: the other one does nothing until it lifts too (it used to turn the pinch into a sudden orbit)
  if (pointers.size === 1 && drag) drag.dead = true;
  if (pointers.size === 0){ canvas.classList.remove('dragging'); document.body.classList.remove('view-drag'); if (wasTap && Math.abs(drag.t0 - wakeTapAt) > 150) tapAt(e.clientX, e.clientY); drag = null; }
}
// a tap picks what is under it; a double-tap on the sky brings the object on the leash back to the middle
function tapAt(x, y){
  if (pick(x, y)){ skyTap = null; return; }
  const now = performance.now(), t = skyTap;
  if (t && now - t.t < 450 && Math.hypot(x - t.x, y - t.y) < 45){ skyTap = null; if (leash.x || leash.y) leash.home = true; return; }
  skyTap = { t:now, x, y };
}
canvas.addEventListener('pointerup', endPointer);
canvas.addEventListener('pointercancel', endPointer);
function onWheel(e){ e.preventDefault();
  // riding along: the wheel moves the chase camera nearer or further back instead of letting go of the ship
  if (shipCam.on && shipCam.mode === 'chase'){ shipCam.zoom = clamp(shipCam.zoom*Math.exp(clamp(e.deltaY*(e.deltaMode ? 0.06 : 0.0022), -0.6, 0.6)), 0.55, 4); return; }
  const f = Math.exp(clamp(e.deltaY*(e.deltaMode ? 0.06 : 0.0022), -0.6, 0.6));
  // (the rest of a scroll that snapped down onto a place does not stop the flight there; scrolling out still does)
  if (f < 1 && flight && performance.now() - snapAt < 6000) return;
  beginManual();
  const S = surfaceMode();
  // (close to Earth and zooming in further: down onto the famous place nearest the cursor, the way into the ground and cities; owner, 0.13.0)
  if (f < 1 && orbit.lock === earth.index && FLAGS.realEarth && orbit.distT <= earth.rad*earth.minZoom*1.02 && snapToPlace(e.clientX, e.clientY)) return;
  zoomBy(f);
  // (near a surface the zoom goes toward the cursor: the part of the way the zoom covers, eased with it)
  if (S){ const c = projectCSS(V.add(OBJ[orbit.lock].rel, S.kind === 'ground' ? orbit.off : [0, 0, 0])) || { x:viewWcss/2, y:canvasHcss/2 };
    // (scrolling out of a place on Earth goes straight up from it: the pull away from the cursor moved the place, km a pixel from high up,
    // and a few notches carried it across a continent; scrolling in still goes toward the cursor)
    const t = f > 1 && S.kind === 'ground' ? 0 : 1 - f;
    if (!S.far){ gPend.x += (e.clientX - c.x)*t; gPend.y += (e.clientY - c.y)*t; } } }
// the famous place on Earth nearest the cursor (within 1,500 km of the ground under it): fly down to it. False if the cursor is off the Earth
let snapAt = -1e9;
function snapToPlace(cx, cy){
  if (performance.now() - snapAt < 1500) return true;
  const ray = cssRay(cx, cy); if (!ray) return false;
  const c = V.sub(frel(earth), cam.rel), Re = EARTH_R*KM, b = V.dot(ray, c), h = b*b - V.dot(c, c) + Re*Re; if (h < 0) return false;
  const p = V.sub(V.mul(ray, b - Math.sqrt(h)), c), u = V.norm(M3.applyT(earth.rot, p)), la = Math.asin(clamp(u[1], -1, 1)), lo = Math.atan2(-u[2], u[0]);
  const n = EPL.nearest(la, lo, 1500); if (!n) return false;
  snapAt = performance.now(); EPL.go(n.row); toast('down to ' + n.row[0] + ' · scroll out to leave'); return true;
}
// the direction through a point of the canvas (CSS pixels), in world axes
function cssRay(cx, cy){ const x = (cx/viewWcss*2 - 1)*tanX, y = (1 - cy/canvasHcss*2)*tanY; return V.norm(V.add(V.add(cam.fwd, V.mul(cam.right, x)), V.mul(cam.up, y))); }
// labels and the Halo's brackets sit on top of the scene: a wheel over them zooms like a wheel over the sky (it used to do nothing)
for (const el of [canvas, $('#labels'), $('#shipMark')]) el.addEventListener('wheel', onWheel, {passive:false});

function beginManual(){
  manualAt = performance.now();
  if (stopShipCam()) toast('the camera is yours · press play to ride along with the Halo again');
  if (stopLaunchCam()){ LCAM.took = true; toast('the camera is yours · it follows the flight again 10 s after you let go, or press play'); }
  SX.pend = null;
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
// right-drag / shift-drag (and two fingers in free camera): pan; this lets go of the object (free camera)
function panBy(dx, dy){
  if (orbit.lock >= 0) letGo();
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
  return best >= 0;
}
addEventListener('keydown', e => {
  // (keys typed into a box or a slider stay there; Esc still closes the panel around a slider: the search boxes handle their own Esc)
  if (e.target.closest && ((e.target.closest('input') && e.key !== 'Escape') || (e.target.closest('button') && (e.key === ' ' || e.key === 'Enter')))) return;
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const k = e.key.toLowerCase();
  if (modalOpen()){ if (k === 'escape' || k === '?') closeModals(); return; }   // (help or what's new)
  if (k === 'escape'){ if (!closeOpen()) unlock(); return; }   // (an open panel closes first; with nothing open the camera lets go)
  if (k === ' '){ e.preventDefault(); togglePlay(); return; }
  if (k === '/' || k === 'o'){ e.preventDefault(); focusSearch(); return; }
  if (k === 'k' && typeof ship !== 'undefined'){ setOpt('rideCam', SET.rideCam === 'still' ? 'moving' : 'still'); return; }   // (riding along: the camera moves, or holds one angle)
  if (k === 'c' && typeof ship !== 'undefined'){ setShipCamMode(shipCam.on && shipCam.mode === 'chase' ? 'cockpit' : 'chase'); return; }
  if (k === 'y'){ setOpt('travel', cycle(['quick', 'warp', 'cinematic'], SET.travel)); return; }
  if (k === 'm'){ toggleSound(); return; }
  if (k === '[' || k === ']'){ stepObject(k === ']' ? 1 : -1); return; }
  if (k === '+' || k === '='){ beginManual(); zoomBy(0.6); return; }
  if (k === '-' || k === '_'){ beginManual(); zoomBy(1.7); return; }
  if (k === 't'){ setOpt('time', cycle([1, 3, 10, 0, 0.25], timeScale)); return; }
  if (k === 'v'){ setOpt('detail', SET.detailAuto ? 0 : detailIdx >= DETAIL.length - 1 ? 'auto' : detailIdx + 1); return; }   // (auto, ultra, fine, normal, bold, auto…)
  if (k === 'g'){ setOpt('glow', !SET.glow); return; }
  if (k === 'l'){ setOpt('labels', !SET.labels); return; }
  if (k === 'h' || k === 'home'){ e.preventDefault(); goHome(); return; }
  if (k === '?'){ toggleHelp(true); return; }
  if ('wasdrfqe'.includes(k) && k.length === 1){ keys.add(k); if (!e.repeat) beginManual(); }
  if (k.startsWith('arrow')){ e.preventDefault(); keys.add(k); if (!e.repeat) beginManual(); }
});
addEventListener('keyup', e => keys.delete(e.key.toLowerCase()));
addEventListener('blur', () => keys.clear());
// next / previous ([ ]): on a tour, the next tour stop; otherwise the next marker up or down the scale bar
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
// the arrows on the angle line: step through the camera angles (the loop carries on from the new angle). Each tap moves one angle,
// also while the camera is still swinging to the last one: the step counts from the angle it is swinging to (fast taps used to be lost)
function stepAngle(dir){
  if (shipCam.on){ setShipCamMode(shipCam.mode === 'chase' ? 'cockpit' : 'chase'); return; }
  if (cmp || flight) return;
  if (tour.on){
    const o = OBJ[tour.obj], L = tourViews(o), n = L.length; if (n < 2) return;
    const cur = tour.phase === 'swing' && tween && tour.to != null ? tour.to : tour.view, next = L[(Math.max(L.indexOf(cur), 0) + dir + n) % n];
    tour.phase = 'swing'; tour.t = 0; tour.to = next; startTween(viewParams(o, next), swingDur()*0.7);
    tween.onDone = () => { tour.view = next; tour.to = null; tour.phase = 'hold'; tour.t = 0; };
    return;
  }
  const i = orbit.lock; if (i < 0) return;
  const o = OBJ[i], n = o.views.length, cur = show.obj !== i ? 0 : show.phase === 'swing' && tween && show.to != null ? show.to : show.view, next = (cur + dir + n) % n;
  show.on = true; show.pending = false; show.free = false; show.obj = i; show.phase = 'swing'; show.t = 0; show.to = next; motion.last = 'show';
  startTween(viewParams(o, next), swingDur()*0.7); tween.onDone = () => { show.view = next; show.to = null; show.phase = 'hold'; show.t = 0; };
  updateModeUI();
}
function updateKeys(dt){
  groundEase(dt);
  if (!keys.size) return;
  // (near a surface: W S and the up and down arrows glide forward and back over the ground, A D and left and right sideways, Q E turn,
  // R F tilt, at a speed that suits the height: about half the view a second)
  const S = surfaceMode();
  if (S){
    const fw = (keys.has('w') || keys.has('arrowup') ? 1 : 0) - (keys.has('s') || keys.has('arrowdown') ? 1 : 0), sd = (keys.has('d') || keys.has('arrowright') ? 1 : 0) - (keys.has('a') || keys.has('arrowleft') ? 1 : 0);
    const turn = (keys.has('e') ? 1 : 0) - (keys.has('q') ? 1 : 0), tilt = (keys.has('r') ? 1 : 0) - (keys.has('f') ? 1 : 0), px = viewHcss*0.5*dt;
    if (S.kind === 'ground'){ if (fw || sd) EPL.panPx(S.o, -sd*px, fw*px); }
    else if (fw || sd){ const g = grabK(S); orbit.yaw += sd*px*g; orbit.pitch = clamp(orbit.pitch + fw*px*g, -1.52, 1.52); }
    if (turn) orbit.yaw -= turn*dt*0.9;
    if (tilt) orbit.pitch = clamp(orbit.pitch + tilt*dt*0.7, S.kind === 'ground' ? 0.03 : -1.52, 1.52);
    return;
  }
  const f = (keys.has('w')?1:0) - (keys.has('s')?1:0), r = (keys.has('d')?1:0) - (keys.has('a')?1:0), u = (keys.has('r')||keys.has('e')?1:0) - (keys.has('f')||keys.has('q')?1:0);
  if (keys.has('arrowleft')) orbit.yaw += dt*1.2;
  if (keys.has('arrowright')) orbit.yaw -= dt*1.2;
  if (keys.has('arrowup')) orbit.pitch = clamp(orbit.pitch + dt*1.0, -1.52, 1.52);
  if (keys.has('arrowdown')) orbit.pitch = clamp(orbit.pitch - dt*1.0, -1.52, 1.52);
  if (f || r || u){
    if (orbit.lock >= 0) letGo();
    const sp = orbit.dist*1.1*dt;
    orbit.target = V.add(orbit.target, keepNear(V.add(V.add(V.mul(cam.fwd, f*sp), V.mul(cam.right, r*sp)), V.mul(cam.up, u*sp))));
  }
}
// W A S D never takes the camera out into empty black space: it stays within FLY_REACH view distances (orbit.dist) of the nearest object's surface.
// Flying toward something is always allowed; at the edge only the part of the move that would go further out is dropped, so the camera slides along it.
// Zooming out widens the view, and with it the reach. (Objects the camera is inside, like the Oort cloud or the Milky Way, do not count.)
const FLY_REACH = 8;
let reachToastAt = -1e9;
function keepNear(d){
  const lim = FLY_REACH*Math.max(orbit.dist, 1e-30);
  let g0 = Infinity, g1 = Infinity, b0 = null;
  for (const o of OBJ){
    if (o.layer < 2 || o.noPick || o.marker || o.hidden || o.magHide > 0.5 || o === ship || !(o.dist > o.rad)) continue;
    const s = o.rad*(o.solid || 1), a = o.dist - s, n = Math.hypot(o.rel[0] - d[0], o.rel[1] - d[1], o.rel[2] - d[2]) - s;
    if (a < g0){ g0 = a; b0 = o; }
    if (n < g1) g1 = n;
  }
  if (!b0 || g1 <= lim || g1 <= g0) return d;
  const out = V.mul(b0.rel, -1/Math.max(b0.dist, 1e-300)), k = V.dot(d, out);
  if (performance.now() - reachToastAt > 5000){ reachToastAt = performance.now(); toast('free flight stays near ' + b0.name + ' · scroll out to go further'); }
  return k > 0 ? V.sub(d, V.mul(out, k)) : d;
}

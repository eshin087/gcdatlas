
// ================================================================ camera: focus-relative, orbiting in the locked object's frame, zoom-pan flights
const cam = { focus:0, rel:[0,0,1], fwd:[0,0,-1], right:[1,0,0], up:[0,1,0], fovY:55*DEG };
const orbit = { yaw:0, pitch:0.1, dist:1, distT:1, lock:0, off:[0,0,0], offFn:null, target:[0,0,0], frame:M3.I() };
let flight = null, tween = null;
const tour = { on:!reduceMotion, obj:0, view:0, phase:'hold', t:0 };
const keys = new Set();
let timeScale = 1, manualAt = -1e9, zoomAt = -1e9;

const sphL = (yaw, pitch) => [Math.cos(pitch)*Math.sin(yaw), Math.sin(pitch), Math.cos(pitch)*Math.cos(yaw)];
function setBasis(fwd, up){
  cam.fwd = V.norm(fwd);
  let r = V.cross(cam.fwd, up);
  if (V.len(r) < 1e-6) r = V.cross(cam.fwd, V.norm([up[1], up[2], up[0]]));
  cam.right = V.norm(r); cam.up = V.cross(cam.right, cam.fwd);
}
function orbitDir(){ return M3.apply(orbit.frame, sphL(orbit.yaw, orbit.pitch)); }
function applyOrbit(){
  const d = orbitDir();
  cam.rel = V.add(orbit.target, V.mul(d, orbit.dist));
  setBasis(V.mul(d, -1), M3.apply(orbit.frame, [0,1,0]));
}
function viewParams(o, vi){
  const v = o.views[vi];
  let d = [0, 0.3, 1];
  if (v.d) d = v.d;
  if (v.dirFn) d = M3.applyT(o.R0, v.dirFn());
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
function startFlight(o, vp, onDone){
  const A = orbit.target.slice(), w0 = Math.max(V.len(V.sub(cam.rel, A)), 1e-30);
  const B = V.add(frel(o), vp.off || [0,0,0]), w1 = vp.dist;
  const path = vwPath(V.len(V.sub(B, A)), w0, w1, 1.3);
  const dirEnd = M3.apply(o.R0, sphL(vp.yaw, vp.pitch));
  // long journeys zoom far out: swing the camera over the galactic pole on the way, so the trip reads as a map
  let wMax = 0; for (let i=0;i<=24;i++) wMax = Math.max(wMax, path.w(path.S*i/24));
  const scenic = wMax > 30*Math.max(w0, w1) && wMax > 2000;
  const dirMid = V.norm([0.3, 0.15, 1]), upMid = V.norm(V.sub([1, 0, 0], V.mul(dirMid, dirMid[0])));
  // progress table: eased at both ends, and for scenic trips slowed right at the widest point so the big picture can sink in
  let sPeak = 0, wp = -1; for (let i=0;i<=48;i++){ const w = path.w(path.S*i/48); if (w > wp){ wp = w; sPeak = i/48; } }
  const tbl = [0]; let acc = 0;
  for (let i=1;i<=64;i++){ const x = (i - 0.5)/64, ease = Math.sin(Math.PI*x)*0.85 + 0.15, hover = scenic ? 1 - 0.8*Math.exp(-Math.pow((x - sPeak)/0.07, 2)) : 1; acc += 1/(ease*hover); tbl.push(acc); }
  const prog = tbl.map(v => v/acc);   // prog[i] = time fraction at which s/S = i/64
  // travel speed: cinematic (slow and scenic), quick (default), warp (near-instant, same path and effects compressed)
  let dur = clamp(1.6 + path.S*0.42, 2.4, 13) + (scenic ? 3 : 0);
  if (SET.travel === 'quick') dur = clamp(1.3 + path.S*0.2, 1.8, 6.5) + (scenic ? 1.4 : 0);
  else if (SET.travel === 'warp') dur = clamp(0.85 + path.S*0.03, 0.95, 1.6);
  if (reduceMotion) dur = 1;
  // start compiling the destination's shaders now, so it is ready to draw on arrival
  if (o.prog) progReady(o.prog); for (const sp of o.particles || []) if (P[sp.prog]) progReady(P[sp.prog]);
  music.whoosh(dur);
  flight = { t:0, dur, path, A, B, dir0:V.norm(V.sub(cam.rel, A)), dir1:dirEnd, prog,
    up0:cam.up.slice(), up1:M3.apply(o.R0, [0,1,0]), obj:o, vp, onDone, switched:false, spin:scenic ? 0 : (rnd() < 0.5 ? -1 : 1)*0.5, scenic, dirMid, upMid };
  tween = null;
}
function updateFlight(dt){
  const f = flight; f.t += dt;
  const x = clamp(f.t/f.dur, 0, 1);
  let j = 0; while (j < 63 && f.prog[j + 1] < x) j++;
  const e = clamp((j + (x - f.prog[j])/Math.max(f.prog[j + 1] - f.prog[j], 1e-9))/64, 0, 1), s = f.path.S*e;
  const AB = V.sub(f.B, f.A), L = V.len(AB);
  const tgt = L > 0 ? V.add(f.A, V.mul(AB, clamp(f.path.u(s)/L, 0, 1))) : f.A.slice();
  const w = x >= 1 ? f.vp.dist : f.path.w(s);
  if (!f.switched && x > 0.5){
    const D = frel(f.obj);
    f.A = V.sub(f.A, D); f.B = V.sub(f.B, D); tgt[0] -= D[0]; tgt[1] -= D[1]; tgt[2] -= D[2];
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
    orbit.lock = f.obj.index; orbit.frame = f.obj.R0; orbit.off = (f.vp.off || [0,0,0]).slice(); orbit.offFn = f.vp.offFn || null;
    orbit.yaw = f.vp.yaw; orbit.pitch = f.vp.pitch; orbit.dist = orbit.distT = f.vp.dist;
    orbit.target = V.add(frel(f.obj), orbit.off);
    flight = null; applyOrbit(); f.onDone && f.onDone();
  }
}
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
  const o = OBJ[i]; tour.obj = i; tour.view = 0; tour.t = 0;
  o.tourReset && o.tourReset();
  const vp = viewParams(o, 0);
  setInfo(i);
  if (instant){
    cam.focus = i; orbit.lock = i; orbit.frame = o.R0; orbit.off = vp.off.slice(); orbit.offFn = vp.offFn;
    orbit.yaw = vp.yaw; orbit.pitch = vp.pitch; orbit.dist = orbit.distT = vp.dist; orbit.target = V.add(frel(o), vp.off);
    applyOrbit(); tour.phase = 'hold'; return;
  }
  tour.phase = 'fly';
  startFlight(o, vp, () => { tour.phase = 'hold'; tour.t = 0; });
}
function tourNext(dir = 1){ const k = TOUR.indexOf(tour.obj); return TOUR[((k < 0 ? 0 : k) + dir + TOUR.length) % TOUR.length]; }
function updateTour(dt){
  const o = OBJ[tour.obj];
  if (tour.phase === 'hold'){
    const v = o.views[tour.view];
    tour.t += dt;
    if (!reduceMotion) orbit.yaw += v.drift*dt;
    if (tour.t > v.hold){
      if (tour.view < o.views.length - 1){
        tour.phase = 'swing'; tour.t = 0;
        startTween(viewParams(o, tour.view + 1), reduceMotion ? 0.6 : (SET.travel === 'warp' ? 1.4 : SET.travel === 'quick' ? 2.6 : 3.4));
        tween.onDone = () => { tour.view++; tour.phase = 'hold'; tour.t = 0; };
      } else tourGo(tourNext(1));
    }
  }
}
function setTour(on){
  tour.on = on;
  $('#btnTour').setAttribute('aria-pressed', String(on));
  if (on){
    let i = orbit.lock >= 0 ? orbit.lock : nearestObject();
    if (!TOUR.includes(i)) i = TOUR[0];
    if (orbit.lock === i && !flight){ tour.obj = i; tour.view = 0; tour.t = 0; tour.phase = 'swing'; startTween(viewParams(OBJ[i], 0), 2.5); tween.onDone = () => { tour.phase = 'hold'; tour.t = 0; }; setInfo(i); }
    else tourGo(i);
  }
  updateModeUI();
}
function stopTour(msg){
  if (!tour.on) return;
  tour.on = false; tween = null;
  if (flight) finishFlightHere();
  $('#btnTour').setAttribute('aria-pressed', 'false');
  if (msg) toast('tour paused · press space or tap tour to resume');
  updateModeUI();
}
// abandon a flight mid-way, keeping the camera where it is
function finishFlightHere(){
  const f = flight; flight = null;
  const o = f.obj;
  if (cam.focus !== o.index){ const D = frel(o); cam.rel = V.sub(cam.rel, D); orbit.target = V.sub(orbit.target, D); cam.focus = o.index; }
  orbit.lock = o.index; orbit.frame = o.R0; orbit.off = V.sub(orbit.target, frel(o)); orbit.offFn = null;
  syncOrbitFromCam();
}
function syncOrbitFromCam(){
  const d = V.sub(cam.rel, orbit.target); orbit.dist = orbit.distT = Math.max(V.len(d), 1e-30);
  const n = M3.applyT(orbit.frame, V.norm(d)); orbit.yaw = Math.atan2(n[0], n[2]); orbit.pitch = Math.asin(clamp(n[1], -0.999, 0.999));
}
function lockOn(i, viewIdx = 0){
  stopTour(false); orbit.offFn = null;
  const o = OBJ[i];
  const vp = viewParams(o, Math.min(viewIdx, o.views.length - 1));
  setInfo(i);
  startFlight(o, vp, null);
  updateModeUI();
}
function unlock(){ if (orbit.lock < 0 && !tour.on) return; stopTour(false); if (flight) finishFlightHere(); orbit.lock = -1; orbit.offFn = null; updateModeUI(); }
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
  if (pointers.size === 0){ canvas.classList.remove('dragging'); if (wasTap) pick(e.clientX, e.clientY); drag = null; }
}
canvas.addEventListener('pointerup', endPointer);
canvas.addEventListener('pointercancel', endPointer);
canvas.addEventListener('wheel', e => { e.preventDefault(); beginManual(); zoomBy(Math.exp(clamp(e.deltaY*(e.deltaMode ? 0.06 : 0.0022), -0.6, 0.6))); }, {passive:false});

function beginManual(){
  manualAt = performance.now();
  if (tour.on) stopTour(true);
  if (flight) finishFlightHere();
  tween = null;
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
    if (o.noPick || o.marker || o.hidden) return;
    const pr = projectCSS(o.rel); if (!pr) return;
    const rpx = o.rad/(pr.z*tanY)*(viewHcss/2);
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
    if (!$('#settings').hidden){ toggleSettings(false); return; }
    if (!$('#atlas').hidden){ toggleAtlas(false); return; }
    unlock(); return;
  }
  if (k === ' '){ e.preventDefault(); setTour(!tour.on); return; }
  if (k === '/' || k === 'o'){ e.preventDefault(); focusSearch(); return; }
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
function stepObject(dir){
  const cur = tour.on ? tour.obj : (orbit.lock >= 0 ? orbit.lock : nearestObject());
  let k = TOUR.indexOf(cur); if (k < 0) k = 0;
  const n = TOUR[(k + dir + TOUR.length) % TOUR.length];
  if (tour.on){ tween = null; if (flight) finishFlightHere(); tourGo(n); } else lockOn(n);
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

// ================================================================ SpaceX launches (3): the director (clocks, real launches, replays, the caption) and the launch camera
// LENS.k narrows the field of view (a telephoto lens for the tracking shots); 09-render.js applies it to tanX / tanY every tick.
// The launch camera (LCAM) never cuts (owner, 0.9.8: the cuts were abrupt). Each shot gives a pose (eye, aim, up, lens) in Earth-fixed km;
// when the shot changes, the camera blends from the pose it had (which keeps moving with the stage it was on) into the new one over about
// 3 s of real time: the aim slides, the direction swings round it, the distance and the lens ease in log space, and when the two subjects are
// far apart the camera pulls back on the way so both stay in view. Picking a rocket flies the camera straight into the first shot's pose
// (shotVP), and the launch camera takes over from exactly there with a slow zoom.
const LENS = { k:1, want:1 };
const LCAM = { on:false, run:null, shot:-1, focus:null, eo:null, lo:null, from:null, bt:0, bT:3, endT:0, st:0, took:false };
// a dip through black between two shots far apart (a shot with fade: the screen darkens over the last 0.55 s of real time before it, and
// the shot starts from black, without a blend, over 0.8 s). The overlay is set every tick, never by a CSS transition, so recordings repeat
const sxFadeEl = (() => { const d = document.createElement('div'); d.className = 'sx-fade'; d.setAttribute('aria-hidden', 'true'); document.body.appendChild(d); return d; })();
function sxFade(v){ v = v > 0.003 ? +v.toFixed(3) : 0; if (sxFadeEl._v !== v){ sxFadeEl._v = v; sxFadeEl.style.opacity = v; } }
// the part a shot looks at (the camera's focus), and the Earth-fixed point of a shot's eye or look spec
const center = o => V.add(o.sx.st.base, V.mul(o.sx.st.axis, o.sx.def.len*0.5e-3));
function specPart(run, spec){ return spec && (spec[0] === 'part' || spec[0] === 'traj' || spec[0] === 'body') ? famPart(run.mis.fam, spec[1]) : null; }
function specPoint(run, spec){
  const k = spec[0];
  if (k === 'site'){ const S = siteOf(spec[1], run), m = typeof spec[2] === 'string' ? S.air[spec[2]] : spec[2]; return V.add(S.p, V.mul(M3.apply(S.F.M, m), 1e-3)); }
  if (k === 'traj'){ const o = famPart(run.mis.fam, spec[1]), st = o.sx.st, [l, u, f] = spec[2]; return V.add(center(o), V.add(V.mul(st.left, l*1e-3), V.add(V.mul(st.up, u*1e-3), V.mul(st.fwd, f*1e-3)))); }
  if (k === 'part'){ const st = famPart(run.mis.fam, spec[1]).sx.st; return V.add(st.base, V.mul(st.axis, spec[2]*1e-3)); }
  // (a camera fixed to a stage's hull: out from its axis, along the axis above its middle, and across, m, so it stays put as the stage pitches over)
  if (k === 'body'){ const o = famPart(run.mis.fam, spec[1]), st = o.sx.st, B = bodyAxes(o, spec[3]), [l, a, x] = spec[2]; return V.add(center(o), V.add(V.mul(B.L, l*1e-3), V.add(V.mul(st.axis, a*1e-3), V.mul(B.X, x*1e-3)))); }
  if (k === 'iss'){ const I = issFrame(); return V.add(I.c, V.mul(M3.apply(I.M, spec[1]), 1e-3)); }
  if (k === 'mid'){ const I = issFrame(), d = SX.parts.dragon.sx.st; return V.mul(V.add(V.add(I.c, V.mul(M3.apply(I.M, [ISS_PORT, 0, 0]), 1e-3)), V.add(d.base, V.mul(d.axis, 4e-3))), 0.5); }
  return [0, 0, 0];
}
// the axes of a camera fixed to a hull: L out from the axis toward the camera (the stage's left), X across. With 'sun' the camera sits on the
// sunlit side, a third of a right angle round from the Sun so the hull shows its shading, whatever the hour and wherever the stage points
// (on the shaded side the hull read as a flat field of dots); 'sunL' keeps it on the stage's left half (a side booster's outer side)
function bodyAxes(o, sun){
  const st = o.sx.st; let L = st.left;
  if (sun){ const s = sunFixed(), p = V.sub(s, V.mul(st.axis, V.dot(s, st.axis)));
    if (V.len(p) > 0.15){ const n = V.norm(p); L = V.add(V.mul(n, Math.cos(0.55)), V.mul(V.cross(st.axis, n), Math.sin(0.55))); }
    if (sun === 'sunL'){ const d = V.dot(L, st.left); if (d < 0.5){ const t = V.sub(L, V.mul(st.left, d)), tl = V.len(t);
      L = V.add(V.mul(st.left, 0.5), V.mul(tl > 1e-6 ? V.mul(t, 1/tl) : V.cross(st.axis, st.left), Math.sqrt(0.75))); } } }
  return { L, X:V.cross(st.axis, L) };
}
const shotIndex = run => { const S = run.mis.shots; let i = 0; for (let j=0;j<S.length;j++) if (run.mt >= S[j].t) i = j; return i; };
function shotFocus(run, sh){ if (sh.focus) return famPart(run.mis.fam, sh.focus); return specPart(run, sh.look) || specPart(run, sh.eye) || (run.mis.fam === 'f9' && run.key === 'dragon' ? SX.parts.dragon : SX.parts[FAM[run.mis.fam].parts[0].key]); }
const watchPart = run => shotFocus(run, run.mis.shots[shotIndex(run)]);
// a camera standing near the ground stays at least 2.5 m above whatever is under it (a dune, a roof, the terrain of the real ground,
// EDT.heightAt) and sees over everything between it and its subject: the line of sight is sampled, and the eye rises until every sample
// clears the ground by a metre (owner, 0.9.9: a low camera looked at the rocket from behind a dune, "behind a rock")
function groundClear(eye, look){
  const r = V.len(eye), alt = (r - RE_KM)*1000; if (alt > 500) return eye;
  let need = 0; const g = EDT.heightAt(eye); if (g != null) need = g + 2.5 - alt;
  for (let i=1;i<24;i++){ const t = i/24, p = V.lerp(eye, look, t), h = EDT.heightAt(p); if (h == null) continue;
    const lack = h + 1 - (V.len(p) - RE_KM)*1000; if (lack > 0) need = Math.max(need, lack/(1 - t)); }   // (raising the eye by d raises this point by d(1 - t))
  return need > 0 ? V.mul(eye, (r + need*1e-3)/r) : eye;
}
// a shot's pose now: eye, aim (Earth-fixed km), up and lens. Up is the local vertical at the eye, or for a camera on a hull looking down
// along it (up 'side') across the hull, so the hull runs down the right of the picture, clear of the info panel
function launchPose(run, sh){
  const look = specPoint(run, sh.look), eye0 = specPoint(run, sh.eye), eye = sh.eye[0] === 'site' ? groundClear(eye0, look) : eye0, dist = Math.max(V.len(V.sub(look, eye))*1000, 1);
  const lens = clamp(typeof sh.lens === 'number' ? sh.lens : Array.isArray(sh.lens) ? sh.lens[2]*2*Math.tan(cam.fovY/2)*dist/sh.lens[1] : 1, 1, 16);
  const up = sh.up === 'side' ? V.mul(bodyAxes(shotFocus(run, sh), sh.eye[3]).X, -1) : V.norm(eye);
  return { eye, look, up, lens };
}
// a shot that moves (the aerial view of the countdown): from its own pose to its 'to' pose over 'move' seconds of real time, easing in and
// out, then circling its aim slowly ('drift', radians a second) for as long as it lasts (a live launch can hold it for many minutes)
function movePose(run, sh, t){
  let q = launchPose(run, sh);
  if (!sh.to) return q;
  const mv = sh.move || 10;
  q = blendPose(q, launchPose(run, Object.assign({}, sh, sh.to)), smoother(clamp(t/mv, 0, 1)));
  if (sh.drift && t > mv){ const a = sh.drift*(t - mv), u = V.norm(q.look), v = V.sub(q.eye, q.look), c = Math.cos(a), s = Math.sin(a);
    q.eye = V.add(q.look, V.add(V.add(V.mul(v, c), V.mul(V.cross(u, v), s)), V.mul(u, V.dot(u, v)*(1 - c)))); }
  return q;
}
// the camera as it is now, in the same terms (for a blend that starts from wherever the camera happens to be)
function camPose(){
  const toF = w => V.mul(M3.applyT(earth.rot, w), 1/KM), e = V.sub(cam.rel, frel(earth)), d = Math.max(V.len(V.sub(orbit.target || [0, 0, 0], cam.rel)), MET*50);
  const eye = toF(e);
  return { eye, look:V.add(eye, V.mul(M3.applyT(earth.rot, cam.fwd), d/KM)), up:V.norm(M3.applyT(earth.rot, cam.up)), lens:LENS.k };
}
const slerpN = (a, b, e) => { const d = clamp(V.dot(a, b), -1, 1), w = Math.acos(d); if (w < 1e-4) return V.norm(V.lerp(a, b, e)); const s = Math.sin(w); return V.norm(V.add(V.mul(a, Math.sin((1 - e)*w)/s), V.mul(b, Math.sin(e*w)/s))); };
const smoother = x => x*x*x*(x*(x*6 - 15) + 10);
// turn the unit direction a toward b by the fraction t of the angle between them, frame after frame without flipping: about the axis a x b,
// or, while b is nearly opposite to a, about the last good axis, the angle unwrapped from one frame to the next (st keeps both). A plain
// slerp picks a new way round every frame when the two point nearly opposite ways, and the view flipped over (from the space station)
function turnTo(a, b, t, st){
  const c = V.cross(a, b), s = V.len(c), d = clamp(V.dot(a, b), -1, 1);
  if (s < 0.15 && d > 0) return V.norm(V.lerp(a, b, t));
  let ax = st.ax;
  if (s >= 0.15 || !ax){ let nx = s >= 0.15 ? V.mul(c, 1/s) : V.norm(V.cross(a, Math.abs(a[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0]));
    if (ax && V.dot(nx, ax) < 0) nx = V.mul(nx, -1);   // (the same way round as before: the angle, unwrapped, carries on past half a turn)
    ax = nx; st.ax = ax; }
  let th = Math.atan2(V.dot(V.cross(a, b), ax), d);
  if (st.th != null){ while (th - st.th > Math.PI) th -= 2*Math.PI; while (th - st.th < -Math.PI) th += 2*Math.PI; }
  st.th = th;
  const g = th*t, cg = Math.cos(g), sg = Math.sin(g);
  return V.norm(V.add(V.add(V.mul(a, cg), V.mul(V.cross(ax, a), sg)), V.mul(ax, V.dot(ax, a)*(1 - cg))));
}
function blendPose(A, B, e){
  const dA = V.sub(A.eye, A.look), dB = V.sub(B.eye, B.look), la = Math.max(V.len(dA), 1e-6), lb = Math.max(V.len(dB), 1e-6);
  const look = V.lerp(A.look, B.look, e), gap = V.len(V.sub(A.look, B.look)), hA = V.len(A.eye) - RE_KM, hB = V.len(B.eye) - RE_KM;
  let eye;
  // two cameras on the ground: the camera travels along the ground from one to the other (swinging round the subject, it went underground)
  if (hA < 0.15 && hB < 0.15) eye = V.lerp(A.eye, B.eye, e);
  else {
    // (between far-apart subjects the camera widens on the way, so neither leaves the picture)
    const dist = Math.exp(Math.log(la) + (Math.log(lb) - Math.log(la))*e) + gap*0.7*Math.sin(Math.PI*e);
    eye = V.add(look, V.mul(slerpN(V.mul(dA, 1/la), V.mul(dB, 1/lb), e), dist));
  }
  // (and never lower than the lower of the two)
  const r = V.len(eye), rMin = RE_KM + Math.min(hA, hB);
  if (r < rMin) eye = V.mul(eye, rMin/r);
  return { eye, look, up:V.norm(V.lerp(A.up, B.up, e)), lens:Math.exp(Math.log(A.lens) + (Math.log(B.lens) - Math.log(A.lens))*e) };
}
// into or out of a camera fixed to a hull the camera swings round the stage's axis instead: round it, along it and in or out from it (in log
// steps), reaching the hull's height before it closes in and leaving it only once clear, so it never passes through the stage or its plume
function blendRound(A, B, e, c, ax){
  const u = V.norm(V.cross(ax, Math.abs(ax[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0])), v = V.cross(ax, u);
  const cyl = P => { const w = V.sub(P, c), z = V.dot(w, ax), q = V.sub(w, V.mul(ax, z)); return { z, r:Math.max(V.len(q), 1e-6), t:Math.atan2(V.dot(q, v), V.dot(q, u)) }; };
  const a = cyl(A.eye), b = cyl(B.eye), inward = b.r < a.r;
  let dt = b.t - a.t; dt -= Math.round(dt/(2*Math.PI))*2*Math.PI;
  const er = inward ? e*e : 1 - (1 - e)*(1 - e), ez = inward ? 1 - (1 - e)*(1 - e) : e*e;
  const z = a.z + (b.z - a.z)*ez, r = Math.exp(Math.log(a.r) + (Math.log(b.r) - Math.log(a.r))*er), t = a.t + dt*e;
  const eye = V.add(c, V.add(V.mul(ax, z), V.mul(V.add(V.mul(u, Math.cos(t)), V.mul(v, Math.sin(t))), r)));
  return { eye, look:V.lerp(A.look, B.look, e), up:V.norm(V.lerp(A.up, B.up, e)), lens:Math.exp(Math.log(A.lens) + (Math.log(B.lens) - Math.log(A.lens))*e) };
}
function startLaunchCam(run){
  LCAM.from = { F:watchPart(run), rel:null }; LCAM.from.pose = camPose();   // (the blend in starts from the camera as it is)
  LCAM.from.eo = V.sub(LCAM.from.pose.eye, center(LCAM.from.F)); LCAM.from.lo = V.sub(LCAM.from.pose.look, center(LCAM.from.F));
  LCAM.bt = 0; LCAM.bT = 3.2;
  LCAM.on = true; LCAM.took = false; LCAM.run = run; LCAM.shot = shotIndex(run); LCAM.focus = null; LCAM.eo = LCAM.lo = null; LCAM.endT = 0; LCAM.st = 0; LCAM.upW = LCAM.fwW = null; run.hold = false; run.seen = true; motion.last = 'launch';
  stopTour(false); pauseShow(); tween = null; flyMove = null; shipCam.on = shipCam.pending = false;
  if (run.mode === 'real') dayTo(realJD() - JD_NOW, 2.5);   // (a live launch is lit by the real Sun: the atlas clock goes to now)
  dockLight(run, 2.5);
  updateLaunchCam(0); updateModeUI();
}
// (flying off elsewhere only switches it off: the flight has already set the camera, the lock and the info panel)
function stopLaunchCam(quiet, flying){
  if (!LCAM.on) return false;
  LCAM.on = false; LENS.want = 1; sxFade(0);
  if (flying){ updateModeUI(); return true; }
  const F = LCAM.focus; motion.last = 'launch';
  // (the camera stays exactly where it is, aimed where it was aimed; the lens eases back to normal)
  if (F && !F.hidden){ orbit.lock = F.index; orbit.frame = camFrameOf(F); orbit.off = LCAM.pose ? V.mul(M3.apply(earth.rot, V.sub(LCAM.pose.look, center(F))), KM) : [0, 0, 0]; orbit.target = orbit.off.slice(); orbit.offFn = null; cam.focus = F.index; syncOrbitFromCam(); setInfo(F.index); }
  updateModeUI();
  return true;
}
function updateLaunchCam(dt){
  const run = LCAM.run; if (!run || !SX.runs.includes(run)){ stopLaunchCam(true); return; }
  const i = shotIndex(run), sh = run.mis.shots[i], F = shotFocus(run, sh);
  if (!F || !F.sx.st) return;
  // (the time since this shot began, for shots that move)
  if (i !== LCAM.shot) LCAM.st = 0; else LCAM.st += dt;
  const Fc = center(F), raw = movePose(run, sh, LCAM.st);
  // a new shot: blend from the camera's last pose, carried along with the stage it was framing
  if (i !== LCAM.shot && LCAM.focus){
    // (a camera standing on the ground stays where it stands; one flying beside a stage, or on the station, which orbits at 7.7 km/s, goes on with it)
    // (the last pose is carried relative to where its stage was when it was made: measured from where the stage is now, a frame on, the camera
    // fell a frame behind a stage at 2 km/s and the picture hopped by a quarter of the screen at every new shot)
    const pf = LCAM.focus, pc = LCAM.poseC || center(pf), q = LCAM.pose, ps = run.mis.shots[LCAM.shot], stays = ps && ps.eye[0] === 'site';
    LCAM.from = { F:pf, eo:V.sub(q.eye, pc), lo:V.sub(q.look, pc), pose:q, stays, body:ps && ps.eye[0] === 'body' }; LCAM.bt = 0; LCAM.bT = sh.blend || 3;
    if (sh.cut){ LCAM.from = null; foldFlash('blink'); }
    if (sh.fade){ LCAM.from = null; LCAM.upW = LCAM.fwW = null; }   // (from black the new shot starts with its own up: carried over, it turned for a second)
    LCAM.eo = LCAM.lo = null;
  }
  LCAM.shot = i;
  { const nx = run.mis.shots[i + 1], J = run.mis.jump, tn = nx && J && nx.t >= J[1] && run.mt < J[0] ? J[0] : nx ? nx.t : 0;   // (a shot after a skip in time fades out before the skip)
    const out = nx && nx.fade ? clamp(1 - (tn - run.mt)/Math.max(runRate(run), 1e-3)/0.55, 0, 1) : 0, inn = sh.fade ? clamp(1 - LCAM.st/0.8, 0, 1) : 0;
    sxFade(Math.max(smoother(out), smoother(inn))); }
  // within a shot: ground cameras stay put, cameras fixed to a hull move with it, cameras riding beside a stage follow it with a little lag; the aim eases
  let eo = V.sub(raw.eye, Fc), lo = V.sub(raw.look, Fc);
  if (LCAM.eo && LCAM.focus === F && dt > 0){
    const k = sh.eye[0] === 'site' || sh.eye[0] === 'iss' || sh.eye[0] === 'body' ? 1 : 1 - Math.exp(-dt*3/(sh.lag || 1)), kl = 1 - Math.exp(-dt*5);
    eo = V.lerp(LCAM.eo, eo, k); lo = V.lerp(LCAM.lo, lo, kl);
  }
  LCAM.eo = eo; LCAM.lo = lo;
  let pose = { eye:V.add(Fc, eo), look:V.add(Fc, lo), up:raw.up, lens:raw.lens };
  if (LCAM.from){
    LCAM.bt += dt;
    const f = LCAM.from, fc = f.F && f.F.sx && f.F.sx.st ? center(f.F) : null, A = fc && f.eo ? { eye:f.stays ? f.pose.eye : V.add(fc, f.eo), look:V.add(fc, f.lo), up:f.pose ? f.pose.up : raw.up, lens:f.pose ? f.pose.lens : 1 } : f.pose;
    const e = smoother(clamp(LCAM.bt/LCAM.bT, 0, 1)), R = sh.eye[0] === 'body' ? F : f.body ? f.F : null;
    if (A && e < 1) pose = R && R.sx.st ? blendRound(A, pose, e, center(R), R.sx.st.axis) : blendPose(A, pose, e); else LCAM.from = null;
  }
  // (between two cameras standing near the ground the eye stays above the ground and roofs and sees over them, as each camera does)
  if (LCAM.from) pose.eye = groundClear(pose.eye, pose.look);
  // (the up made square to the view, and turning at most 90 degrees a second: where the view and the wanted up nearly line up, looking
  // straight down or up during a blend, the last frame's up is kept, so the picture never flips over)
  { const fw = V.norm(V.sub(pose.look, pose.eye)), sq = u => V.sub(u, V.mul(fw, V.dot(u, fw)));
    let want = sq(pose.up); const prev = LCAM.upW ? sq(LCAM.upW) : null;
    if (V.len(want) < 0.25 && prev && V.len(prev) > 1e-6) want = prev;
    want = V.norm(want);
    if (prev && V.len(prev) > 1e-6 && dt > 0){ const pv = V.norm(prev), a = Math.acos(clamp(V.dot(pv, want), -1, 1)), lim = Math.PI/2*dt;
      if (a > lim){ const ax = V.norm(V.cross(pv, want)), cs = Math.cos(lim), sn = Math.sin(lim); want = V.norm(V.add(V.mul(pv, cs), V.mul(V.cross(ax, pv), sn))); } }
    pose.up = want; LCAM.upW = want; }
  // (during a blend the view turns at most 100 degrees a second: a blend that would swing faster, through a near miss of its aim, eases instead)
  if (LCAM.from && LCAM.fwW && dt > 0){ const fw = V.norm(V.sub(pose.look, pose.eye)), a = Math.acos(clamp(V.dot(fw, LCAM.fwW), -1, 1)), lim = 100*DEG*dt;
    if (a > lim){ const ax = V.cross(LCAM.fwW, fw), al = V.len(ax); if (al > 1e-9){ const u = V.mul(ax, 1/al), cs = Math.cos(lim), sn = Math.sin(lim), nf = V.norm(V.add(V.mul(LCAM.fwW, cs), V.mul(V.cross(u, LCAM.fwW), sn)));
      pose.look = V.add(pose.eye, V.mul(nf, V.len(V.sub(pose.look, pose.eye)))); } } }
  LCAM.fwW = V.norm(V.sub(pose.look, pose.eye));
  LCAM.pose = pose; LCAM.poseC = Fc;
  if (F !== LCAM.focus && infoObj !== F.index) setInfo(F.index);
  LCAM.focus = F;
  LENS.k = LENS.want = pose.lens;
  cam.focus = F.index;
  cam.rel = V.mul(M3.apply(earth.rot, V.sub(pose.eye, Fc)), KM);
  // (the shake: near the pad the air and the ground shake the camera, mostly a sway 1 to 3 times a second with a lighter tremor 10 to 15 times
  // a second, up to about a quarter of a degree (owner, 0.10.1: half a degree of fast jitter was too much); on a hull a gentle buzz; none
  // for people who ask for reduced motion. The pose itself stays still, so blends are not shaken off course)
  let fw = M3.apply(earth.rot, V.norm(V.sub(pose.look, pose.eye))); const upw = M3.apply(earth.rot, pose.up);
  const shk = reduceMotion ? 0 : (HEAR.onboard ? 0.002 : 0.0032)*HEAR.total;
  if (shk > 1e-5){ const t = GT, rt = V.norm(V.cross(fw, upw)), uu = V.cross(rt, fw);
    const nx = Math.sin(t*61.3)*0.25 + Math.sin(t*93.9 + 1.3)*0.12 + Math.sin(t*17.1 + 0.7)*0.45 + Math.sin(t*8.3 + 2.2)*0.35, ny = Math.sin(t*67.7 + 2.1)*0.22 + Math.sin(t*101.3 + 0.4)*0.12 + Math.sin(t*19.3 + 1.9)*0.45 + Math.sin(t*7.1 + 0.6)*0.35;
    fw = V.norm(V.add(fw, V.add(V.mul(rt, nx*shk), V.mul(uu, ny*shk)))); }
  setBasis(fw, upw);
  orbit.lock = F.index; orbit.frame = camFrameOf(F); orbit.off = V.mul(M3.apply(earth.rot, V.sub(pose.look, Fc)), KM); orbit.offFn = null; orbit.target = orbit.off.slice();
  orbit.dist = orbit.distT = Math.max(V.len(V.sub(cam.rel, orbit.target)), F.rad*0.3);
}
// the flight to a rocket lands on its first shot: the pose a flight needs (yaw, pitch, distance and aim in the stage's frame, the up at the eye),
// worked out again every frame of the flight, as the Earth turns
// The approach is one take (owner, 0.9.9: the flight dipped under the Earth, passed behind things and jumped at the end). Over the whole
// flight, by time, the view turns from where it looked at the start to straight down on what it aims at (so it never swings fast), and from
// 1.5 Earth radii in it tilts, in the vertical plane of the first shot, from straight down to the first shot's angle, by the log of the
// distance: a descent from space onto the real ground, the pad growing in the middle of the view. Starting on the far side of the Earth (from
// the station), the aim goes round the Earth, not through it (tgtAt); and whatever the start, the view turns up whenever the camera would
// come within a twentieth of its distance of the ground (dirAt). No scenic detour past anything else.
function shotVP(run){
  const F = watchPart(run), toW = x => V.mul(M3.apply(earth.rot, x), KM), S = siteOf('SITE', run), RE = RE_KM*KM;
  const now = () => movePose(run, run.mis.shots[shotIndex(run)], 0);
  const yp = () => { const q = now(), d = M3.applyT(camFrameOf(F), V.norm(toW(V.sub(q.eye, q.look)))); return [Math.atan2(d[0], d[2]), Math.asin(clamp(d[1], -0.999, 0.999))]; };
  const q = now(), [yaw, pitch] = yp(), off = () => toW(V.sub(now().look, center(F)));
  const vp = { yaw, pitch, dist:V.len(V.sub(q.eye, q.look))*KM, off:off(), offFn:off, up:toW(q.up), upFn:() => V.norm(toW(now().up)), track:yp, minDur:9 };
  const qn0 = () => { const t = GT; if (qn0.t !== t){ qn0.t = t; qn0.v = now(); } return qn0.v; };   // (the first shot's pose, once a frame)
  // (the aim, once it is within 4 Earth radii of the centre, goes round the Earth to the pad when its straight way would pass through it:
  // along a great circle from where it was to the pad, turned toward the pad as it is now (the Earth turns under a flight, fast while the
  // day comes), its height easing from where it was to the pad's, by time; decided once, the first time)
  let arc = null;
  vp.tgtAt = (tgt, A, B, g, w, x) => {
    const E = frel(earth), s = 1 - g, t0 = V.sub(tgt, E), rt = V.len(t0), b = V.sub(B, E), rb = V.len(b);
    // (an aim that starts inside the Earth, at its centre when you were looking at the whole planet, rises straight to the pad: no arc)
    if (arc === null && rt < 4*RE && s < 0.995){ if (rt < RE*1.01){ arc = false; return tgt; }
      const seg = V.sub(b, t0), L2 = V.dot(seg, seg), tt = L2 > 0 ? clamp(-V.dot(t0, seg)/L2, 0, 1) : 0;
      arc = V.len(V.add(t0, V.mul(seg, tt))) < RE*1.05 ? { s0:s, x0:x, a0:V.mul(t0, 1/rt), ra:rt, st:{} } : false;
    }
    if (!arc) return tgt;
    // (by time from where it began, over at least 55% of the flight: the path itself would sweep round the Earth in half a second)
    const q = Math.min(smooth(arc.x0, arc.x0 + Math.max(0.55, (1 - arc.x0)*0.6), x), 1);
    const p = V.add(E, V.mul(turnTo(arc.a0, V.mul(b, 1/rb), q, arc.st), arc.ra + (rb - arc.ra)*q));
    return V.lerp(p, B, smooth(0.9, 1, q));   // (landing exactly on the aim)
  };
  // (the turn to straight over the aim is timed by the flight's own path, worked out on its first frame: it is done by the time the camera
  // comes within 20 Earth radii of what it aims at, so it happens while the Earth is still small in the view and never needs to be fast)
  let uEnd = null, mPrev = 0, xPrev = 0, lastDir = null, lastUp = null, xUp = 0, rollSign = 0, rotEnd, farStart = false; const tdir = {};
  // (the picture's up is carried along as the view turns, then rolled toward the up it lands with, spread evenly over the flight up to 92%
  // of the way: turned together with the view it spun at 200 degrees a second as the view came round to look straight down)
  const carry = (a, b, v) => { const ax = V.cross(a, b), sn = V.len(ax), cs = V.dot(a, b); if (sn < 1e-9) return v;
    const u = V.mul(ax, 1/sn); return V.add(V.add(V.mul(v, cs), V.mul(V.cross(u, v), sn)), V.mul(u, V.dot(u, v)*(1 - cs))); };
  vp.dirAt = (x, w, dDef, uDef, tgt, f) => {
    if (uEnd === null){ let last = 0; for (let i=0;i<=200;i++){ const xx = i/200; if (f.path.w(f.path.S*flightE(f.prog, xx)) >= 20*RE) last = xx; } uEnd = clamp(last + 0.05, 0.5, 0.8); }
    // (while the clock eases to the afternoon the Earth spins under the flight, up to half a turn in a few seconds. Setting off far from the
    // Earth, the view heads for where the pad will be once it is day, and the pad turns into place under it, or it whipped round at 10
    // degrees a frame from Saturn; setting off close to it, the view follows the pad round, a time-lapse under the camera. Decided once)
    if (rotEnd === undefined){ rotEnd = DAY.T > 0 ? earthRotAt(DAY.to) : null; farStart = V.len(V.sub(cam.rel, frel(earth))) > 8*RE; }
    const kEnd = DAY.T > 0 && rotEnd && farStart ? 1 : 0, dN = V.sub(qn0().eye, qn0().look);
    const Unow = V.norm(M3.apply(earth.rot, S.up)), Dnow = V.norm(M3.apply(earth.rot, dN));
    const U = kEnd > 0 ? V.norm(slerpDir(Unow, V.norm(M3.apply(rotEnd, S.up)), kEnd)) : Unow, D1 = kEnd > 0 ? V.norm(slerpDir(Dnow, V.norm(M3.apply(rotEnd, dN)), kEnd)) : Dnow;
    const E = frel(earth), t0 = V.sub(tgt, E), rt = V.len(t0);
    // (the vertical over the aim while it goes round the Earth from a start close by, the station; otherwise the pad's: an arc that begins
    // on the way in from far out would swing it round in one frame)
    const Ut = arc && arc.s0 < 0.02 && rt > RE*1e-6 ? V.mul(t0, 1/rt) : U;   // (world units are light-years: a 'small' length is a fraction of RE)
    // (the first shot's angle at the pad, elevation e1 and horizontal H, carried to that vertical)
    const e1 = Math.asin(clamp(V.dot(D1, U), -1, 1)), hz = V.sub(D1, V.mul(Ut, V.dot(D1, Ut))), Ht = V.len(hz) > 1e-6 ? V.norm(hz) : V.norm(V.cross(Ut, [0, 0, 1]));
    // (the tilt: 0 at the first shot's distance, 1 from 1.5 Earth radii out)
    const fr = smoother(clamp(Math.log(Math.max(w, vp.dist)/vp.dist)/Math.log(1.5*RE/vp.dist), 0, 1)), el = e1 + (Math.PI/2 - e1)*fr;
    const Dn = V.add(V.mul(Ut, Math.sin(el)), V.mul(Ht, Math.cos(el))), Un = V.sub(V.mul(Ut, Math.cos(el)), V.mul(Ht, Math.sin(el)));
    const u = smooth(0.02, uEnd, x);
    let dir = turnTo(f.dir0, Dn, u, tdir);
    // (a safety net: never within a twentieth of its distance of the ground, and never looking at the aim through the Earth. If either would
    // happen the view turns toward straight over the aim, just as far as it must, and lets go of that turn gently)
    const minH = clamp(0.05*w, 0.3*KM, 50*KM);
    const ok = d => { const C = V.add(t0, V.mul(d, w)); if (V.len(C) - RE < minH) return false;
      if (rt < RE*1.0005) return true;
      const sg = V.sub(t0, C), L2 = V.dot(sg, sg), tt = L2 > 0 ? clamp(-V.dot(C, sg)/L2, 0, 0.97) : 0; return V.len(V.add(C, V.mul(sg, tt))) > RE*0.999; };
    let m = 0;
    // (the shortest way up, worked out afresh each frame: its start moves every frame, so there is no turn to keep going the same way round)
    if (!ok(dir)){ let lo = 0, hi = 1; for (let i=0;i<14;i++){ const mm = (lo + hi)/2; if (ok(V.norm(slerpDir(dir, Ut, mm)))) hi = mm; else lo = mm; } m = hi; }
    m = Math.max(m, mPrev - Math.max(x - xPrev, 0)*f.dur*1.2); mPrev = m; xPrev = x;
    if (m > 0) dir = V.norm(slerpDir(dir, Ut, m));
    const sq = v => V.norm(V.sub(v, V.mul(dir, V.dot(v, dir))));
    let upC = lastDir ? sq(carry(lastDir, dir, lastUp)) : sq(f.up0);
    const want = sq(Un); let ang = Math.atan2(V.dot(V.cross(upC, want), dir), clamp(V.dot(upC, want), -1, 1));
    if (Math.abs(ang) > 170*DEG && rollSign && Math.sign(ang) !== rollSign) ang += rollSign > 0 ? 2*Math.PI : -2*Math.PI;   // (keep the way round)
    rollSign = Math.sign(ang) || rollSign;
    const k = x >= 0.92 ? 1 : clamp((x - xUp)/Math.max(0.92 - xUp, 1e-3), 0, 1), g = ang*k, cg = Math.cos(g), sg = Math.sin(g);
    upC = V.norm(V.add(V.mul(upC, cg), V.mul(V.cross(dir, upC), sg)));
    lastDir = dir; lastUp = upC; xUp = x;
    return [dir, upC];
  };
  return { F, vp };
}
// ---------------------------------------------------------------- picking a rocket: fly to it, then watch (a stage that is not flying starts a countdown on its pad)
{ const prev = lockOn; lockOn = function(i, vi = 0, loop = true){
  const o = OBJ[i];
  if (!o || !o.sx || !FLAGS.spacex) return prev(i, vi, loop);
  let run = famRun(o.sx.fam);
  if (!run || run.ended){
    if (run) endRun(run);
    run = newRun(o.sx.fam === 'star' ? 'starship' : o.sx.fam === 'fh' ? 'falconheavy' : o.key === 'dragon' ? 'dragon' : 'falcon9', 'click');
    buildClusters();
    run.day = true;   // (clicked flights are flown by day, owner 0.9.8: the clock eases to the nearest afternoon at the pad, while the camera is still far out)
  }
  for (const pr of [P.sxStar, P.sxFal, P.sxEnv, P.sxSmoke]) progReady(pr);   // (start compiling now, in the background, so the pad is ready when the camera lands)
  { const D = EDT.siteOfPad(run.site); if (D) EDT.want(D.key); }   // (and fetch the images of the ground there, and the weather)
  wxWant();
  sxFly(run);
}; }
// the flight itself: what lockOn does, but landing on the shot's pose, and the launch camera takes over when it lands
function sxFly(run){
  const { F, vp } = shotVP(run);
  stopTour(false); orbit.offFn = null; show.on = show.pending = false;
  setInfo(F.index);
  SX.pend = { run, part:F, at:GT };
  // (straight there: no detour past anything on the way, which took the camera behind the Moon)
  startFlight(F, vp, () => { if (SX.pend && SX.pend.run === run){ SX.pend = null; startLaunchCam(run); } });
  // (the day comes during the first half of the flight, a time-lapse seen from far out, never during the descent)
  if (run.day){ run.day = false; dayTo(afternoonAt(SXS[run.site]), Math.max(1.5, (flight ? flight.dur : 3)*0.5)); }
  dockLight(run, Math.max(1.5, (flight ? flight.dur : 3)*0.5));
  motion.last = 'launch';
  updateModeUI();
}
function sxWatch(run){ if (!run) return; hideHint(); if (cmp) endCompare(false); sxFly(run); }
// play after a pause: follow the flight again, or fly it again once it is over
function sxResume(){
  const o = OBJ[orbit.lock]; if (!o || !o.sx) return false;
  const run = famRun(o.sx.fam);
  if (run && !run.ended){ startLaunchCam(run); return true; }
  lockOn(o.index); return true;
}
// ---------------------------------------------------------------- daylight: the atlas clock eases to a moment (days from the page's start), over a few seconds
const DAY = { from:0, to:0, t:0, T:0 };
function dayTo(target, T){ DAY.from = ssDays; DAY.to = target; DAY.t = 0; DAY.T = Math.max(T, 0.01); }
// the Earth's rotation matrix at a moment of the atlas clock (the clock put back after)
function earthRotAt(days){ const d0 = ssDays; ssDays = days; earth.update(0); const R = earth.rot.slice(); ssDays = d0; earth.update(0); return R; }
function sunUpAt(S, days){ const d0 = ssDays; ssDays = days; earth.update(0); const e = V.dot(sunFixed(), S.up); ssDays = d0; earth.update(0); return e; }
// the moment nearest the atlas clock's (within half a day either way) when the Sun stands about 35 degrees up in the afternoon at a site
function afternoonAt(S){
  let best = ssDays, bd = 1e9;
  for (let k=-48;k<=48;k++){ const t = ssDays + k/96, e = sunUpAt(S, t), e2 = sunUpAt(S, t + 0.004);
    const d = Math.abs(Math.asin(e)/DEG - 35) + (e2 < e ? 0 : 60) + Math.abs(k)*0.02; if (d < bd){ bd = d; best = t; } }
  return best;
}
// ---------------------------------------------------------------- real launches: SpaceX flights from the launch feed, at their scheduled time
function realMission(l){
  if (!/spacex/i.test(l.provider || '') && !/falcon|starship/i.test(l.rocket || '')) return null;
  const r = (l.rocket || '') + ' ' + (l.name || '');
  const key = /starship/i.test(r) ? 'starship' : /falcon heavy/i.test(r) ? 'falconheavy' : /falcon 9/i.test(r) ? (/crew|dragon|crs-|ax-|polaris|fram/i.test(l.name || '') ? 'dragon' : 'falcon9') : null;
  if (!key) return null;
  let site = null, bd = 40;
  for (const k of ['starbase', 'lc39a', 'slc40', 'slc4e']){ const S = SXS[k], d = V.len(V.sub(V.mul(llUnit(l.lat, l.lon), RE_KM), S.p)); if (d < bd){ bd = d; site = k; } }
  if (!site || (key === 'starship') !== (site === 'starbase')) return null;
  const az = key === 'falconheavy' ? 90 : site === 'slc4e' ? 165 : key === 'dragon' ? 44 : MIS[key].az;
  return { key, site, az, t0:Date.parse(l.net), label:(l.name || '').split('|').pop().trim() };
}
function realLaunches(){
  if (typeof earthLive === 'undefined' || !earthLive.launches) return [];
  const now = Date.now(), out = [];
  for (const l of earthLive.launches.concat(SX.fake || [])){
    if (/hold|fail|tbd/i.test(l.status || '')) continue;
    const m = realMission(l); if (!m || !isFinite(m.t0)) continue;
    const end = MIS[m.key].realEnd || MIS[m.key].end;
    if (now > m.t0 - 20*60e3 && now < m.t0 + end*1e3) out.push(m);
  }
  return out;
}
// ---------------------------------------------------------------- the atmosphere: near the ground the sky hides what lies beyond the Solar System (ATM.k: 1 on the ground, 0 above
// about 90 km), read by render() and updateLabels() in 09-render.js; the planetarium ("your sky") keeps the whole sky
const ATM = { k:0 };
// ---------------------------------------------------------------- the director, once a tick (after Earth has turned, before the camera)
const SXD = addObj({ key:'sx-director', name:'launch director', type:'', group:'travel', parent:earth, offset:[0, 0, 0], rad:1*MET, hidden:true, noPick:true, atlas:false, noLabel:true, noTour:true, noImpostor:true,
  update(dt){ if (FLAGS.spacex) sxTick(dt); else if (FLAGS.realEarth) groundTick(dt); } });
// what the ground anywhere needs of the director with the SpaceX flag off (0.12.0, from Codex's review of #43): the day the clock eases to,
// the clock in real time near the ground, the atmosphere over the camera, the weather it draws. sxTick does the same with the rest
function groundTick(dt){ EDT.tick(); dayStep(dt); clockStep(); atmStep(); wxTick(dt); }
// (the atlas clock easing to a daytime moment)
function dayStep(dt){ if (DAY.T > 0){ DAY.t += dt; const e = smoother(clamp(DAY.t/DAY.T, 0, 1)); ssDays = DAY.from + (DAY.to - DAY.from)*e; if (e >= 1) DAY.T = 0; earth.update(0); } }
// (near the ground, watching a launch or visiting a place on Earth, the Solar System clock runs in real time, so the Sun stays put and the
// ground does not spin round)
function clockStep(){
  const want = LCAM.on || (SX.pend && flight) || (SXENV.on && SXENV.alt < 40) || EPL.hold() || MPL.hold();   // (MPL: a place on the Moon, 0.27.0)
  if (want && sxRatePrev == null){ sxRatePrev = ssRate; ssRate = 1/86400; }
  else if (!want && sxRatePrev != null){ if (ssRate === 1/86400) ssRate = sxRatePrev; sxRatePrev = null; }
}
// (the atmosphere over the camera)
function atmStep(){ const cf = camFixed(), alt = V.len(cf) - RE_KM; ATM.k = SKYV.on || !(alt < 120) ? 0 : 1 - smooth(25, 90, alt); }
let SX_T = 0, sxRatePrev = null;
// playback speed: the mission's highlights (sped up in the quiet parts), or real time (the real-speed button, SET.launchReal)
const runRate = run => run.mode === 'real' || (SET.launchReal && LCAM.on && LCAM.run === run) ? 1 : stepRate(run.mis.rate, run.mt);
function sxTick(dt){
  SX_T += dt;
  const now = Date.now();
  EDT.tick();
  // the atlas clock easing to a daytime moment
  dayStep(dt);
  // the pads and droneships turn with the Earth (their objects' places are only used to sort them for drawing and to aim flights)
  for (const S of SITE_LIST()){ S.o.offset = V.mul(M3.apply(earth.rot, V.add(S.p, V.mul(S.up, 0.05))), KM); S.o.pos = V.add(earth.pos, S.o.offset); }
  // real launches: start (or join in progress) a flight for each one in its window, unless a flight you are watching holds that rocket
  for (const m of realLaunches()){
    const id = m.key + m.t0; let run = famRun(MIS[m.key].fam);
    if (run && run.mode === 'real' && run.id === id) continue;
    if (run && LCAM.on && LCAM.run === run) continue;
    run = newRun(m.key, 'real', { site:m.site, az:m.az, t0:m.t0, label:m.label, mt:(now - m.t0)/1000 }); run.id = id;
  }
  for (const run of SX.runs.slice()){
    const mis = run.mis, end = run.mode === 'real' ? (mis.realEnd || mis.end) : mis.end;
    if (run.mode === 'real') run.mt = (now - run.t0)/1000;
    else if (!run.hold && !run.ended){
      run.mt += dt*runRate(run);
      // (the skip to the docking moves the atlas clock on a day only on a flight you are on: watching it, or locked on one of its parts,
      // where the fade through black hides it. A replay nobody watches leaves the clock alone, owner 2026-11-10: looking at Earth, the
      // date, the Moon and the planets hopped a day in one frame. It notes that its docking may be in the dark: dockLight, on a watch)
      if (mis.jump && run.mt >= mis.jump[0] && run.mt < mis.jump[1]){ run.mt = mis.jump[1];
        if (run.key === 'dragon'){ const o = OBJ[orbit.lock];
          if ((LCAM.run === run && (LCAM.on || LCAM.took)) || (!flight && o && o.sx && o.sx.fam === mis.fam)) dockInDaylight(); else run.dock = true; } }
    }
    if (run.mt >= end && !run.ended){ run.ended = true; run.mt = end; run.endAt = SX_T; if (run.mode === 'real' && !(LCAM.on && LCAM.run === run)) { endRun(run); continue; } }
    // an ended flight stays as it finished until the camera has left it; one never watched just ends
    const mine = o => o && o.sx && o.sx.fam === mis.fam;
    const here = mine(OBJ[cam.focus]) || mine(OBJ[orbit.lock]) || (SX.pend && SX.pend.run === run);
    if (run.ended && !(LCAM.on && LCAM.run === run) && !here) { endRun(run); continue; }
    if (run.hold && !here && SX_T - (run.bornT || (run.bornT = SX_T)) > 60) { endRun(run); continue; }
    if (run.mode === 'replay' && !run.seen && run.ended) { endRun(run); continue; }
    sxEval(run);
  }
  sxEval(null);
  // the flight to a rocket was interrupted (another flight, a drag): nothing to wait for
  if (SX.pend && (!SX.runs.includes(SX.pend.run) || (!flight && GT - SX.pend.at > 1.5))) SX.pend = null;
  // you took the camera from the director with a drag or the wheel (owner, 0.10.1: dragging should look round the rocket at any angle, and
  // the director should come back): after 10 s without a touch it glides back in from where you left it, if you are still on that flight
  if (LCAM.took && !LCAM.on){ const run = LCAM.run, o = OBJ[orbit.lock];
    if (!run || run.ended || !SX.runs.includes(run) || flight || tour.on || shipCam.on || !o || !o.sx || o.sx.fam !== run.mis.fam) LCAM.took = false;
    else if (performance.now() - manualAt > 10000 && !pointers.size){ startLaunchCam(run); toast('following the flight again'); } }
  // a flight you watch ends: a moment on the last shot, then the camera is yours
  if (LCAM.on && LCAM.run.ended){ LCAM.endT += dt; if (LCAM.endT > 5){ stopLaunchCam(true); toast('the flight is over · drag to look round · press play to watch it again'); } }
  // replays now and then while you look at Earth: from a pad on the side you see, in daylight
  const atEarth = (orbit.lock === earth.index || (tour.on && tour.obj === earth.index)) && orbit.dist < earth.rad*14 && !SKYV.on && !flight;
  if (atEarth && SX_T > SX.nextReplay && !LCAM.on && !SX.runs.some(r => r.mode !== 'real' || r.mt < 600)){
    const cf = V.norm(camFixed()), sun = sunFixed(), seen = k => V.dot(SXS[k].up, cf) > 0.3 && V.dot(SXS[k].up, sun) > 0.25;
    const opts = [['starship', {}, 0.34], ['falcon9', {}, 0.2], ['falcon9', { site:'slc4e', az:165 }, 0.1], ['dragon', {}, 0.18], ['falconheavy', {}, 0.18]].filter(([k, o]) => seen(o.site || MIS[k].site) && !famRun(MIS[k].fam));
    if (opts.length){ let x = Math.random()*opts.reduce((a, o) => a + o[2], 0), pick = opts[0]; for (const o of opts){ x -= o[2]; if (x <= 0){ pick = o; break; } }
      const r = newRun(pick[0], 'replay', pick[1]); r.mt = -8; SX.nextReplay = SX_T + 150 + Math.random()*110; }
    else SX.nextReplay = SX_T + 15;
  }
  if (!atEarth && SX.nextReplay < SX_T + 20) SX.nextReplay = SX_T + 20;
  // the caption: what is flying, with a button to watch it (while you watch: the button switches between highlights and real speed)
  LCAP.txt = ''; LCAP.btn = ''; LCAP.go = null; LCAP.live = false; LCAP.run = null;
  if (LCAM.on){ const r = LCAM.run, real = r.mode !== 'real' && SET.launchReal;
    LCAP.txt = `${r.mis.name} · ${r.mode === 'real' ? 'live' : real ? 'replay at real speed' : 'replay'}${eventNow(r) ? ' · ' + eventNow(r) : ''} · ${clk(r.mt)}`;
    if (r.mode !== 'real'){ LCAP.btn = SET.launchReal ? 'highlights' : 'real speed'; LCAP.go = () => { setOpt('launchReal', !SET.launchReal, true); toast(SET.launchReal ? 'real speed: every second as it happens (a Starship flight takes about 9 minutes)' : 'highlights: the quiet parts sped up'); }; } }
  else {
    const live = SX.runs.find(r => r.mode === 'real' && !r.ended) || null, rep = SX.runs.find(r => r.mode === 'replay' && !r.ended && r.mt > -8 && atEarth);
    const r = live || rep;
    if (r && !(SX.pend && SX.pend.run === r)){
      const where = SXS[r.site].short;
      LCAP.txt = r.mode === 'real' ? `live · ${r.mis.name}${r.label ? ' · ' + r.label : ''} from ${where} · ${clk(r.mt)}` : `illustrative replay · ${r.mis.name} from ${where}${eventNow(r) ? ' · ' + eventNow(r) : ''} · ${clk(r.mt)}`;
      LCAP.btn = 'watch'; LCAP.go = () => sxWatch(r); LCAP.live = r.mode === 'real' && r.mt > -600; LCAP.run = r;   // (a notice: 09-render.js shows it 10 s)
    }
  }
  // near the ground (or watching) the Solar System clock runs in real time, so the Sun stays put and the pad does not spin round
  clockStep();
  if (!LCAM.on){ const lk = 1 - Math.exp(-dt*2), k0 = LENS.k; LENS.k = Math.exp(Math.log(LENS.k)*(1 - lk));
    // (once the director lets go, the long lens eases back to normal while the camera moves in by as much, so the rocket keeps its size on
    // the screen: let go from a 16 times lens, it shrank to a speck)
    const o = OBJ[orbit.lock]; if (o && (o.sx || o.sxSite) && !flight && k0 > 1.0001){ const f = LENS.k/k0; orbit.dist *= f; orbit.distT = Math.max(orbit.distT*f, o.rad*(o.minZoom || 0)); } }
  // the atmosphere over the camera
  atmStep();
  wxTick(dt); buildClusters(); updateTrail(); smokeUpdate(); sxHear();
  for (const k in SX.parts) SX.parts[k].noLabel = LCAM.on;   // (a clean picture while the launch camera plays)
  // locked on a rocket or a pad, the camera turns with the Earth under it (their frames turn with it)
  if (!LCAM.on && !flight && OBJ[orbit.lock] && (OBJ[orbit.lock].sx || OBJ[orbit.lock].sxSite)) orbit.frame = camFrameOf(OBJ[orbit.lock]);
  // (looking round a stage near the ground the camera stays above it: in the level frame the pitch is the camera's elevation seen from the
  // stage, kept where the eye clears the ground under the stage by 4 m)
  { const o = OBJ[orbit.lock]; if (!LCAM.on && !flight && o && o.sx && o.sx.st && !o.hidden){ const c = center(o), alt = (V.len(c) - RE_KM)*1000;
    if (alt < 3000){ const g = EDT.heightAt(c), dm = orbit.dist/MET, need = ((g == null ? 0 : g) + 4 - alt)/Math.max(dm, 1);
      if (need > -1){ const pm = Math.asin(clamp(need, -1, 0.95)); if (orbit.pitch < pm) orbit.pitch = pm; } } } }
  // a shared link straight to a rocket starts its countdown
  if (!SX.hashDone && GT > 0.3){ SX.hashDone = true; const o = OBJ[orbit.lock]; if (o && o.sx && /[#&]o=/.test(location.hash) && !famRun(o.sx.fam)) lockOn(o.index); }
}
// ---------------------------------------------------------------- what the camera hears and feels, while you watch a flight (music.rocket; the shake in updateLaunchCam)
// Each burning stage as it was when its sound left it (the speed of sound, 343 m/s, in mission time: from the far cameras the roar comes
// seconds after the flame), fainter with distance ((150 m / d)^0.6: a big rocket's roar carries for kilometres) and with thinner air round
// the stage as it climbs; nothing at a camera in near-vacuum, except on a hull, where the structure carries a muffled roar. The engines'
// shares: 33 Raptors 1, a Starship 0.35, a Falcon 9 core 0.6, a side booster 0.45, a vacuum engine 0.2.
const HEAR = { total:0, d:1e9, onboard:false };
const ENG_LOUD = { booster:1, ship:0.35, core:0.6, sideA:0.45, sideB:0.45, s2:0.2 };
function sxHear(){
  HEAR.total = 0; HEAR.d = 1e9; HEAR.onboard = false;
  const run = LCAM.on ? LCAM.run : null;
  SX.snd = null;
  if (!run || typeof music === 'undefined' || !music.rocket){ if (typeof music !== 'undefined' && music.rocket) music.rocket(null); return; }
  const cf = camFixed(), camAlt = (V.len(cf) - RE_KM)*1000, sh = run.mis.shots[LCAM.shot] || {}, onF = sh.eye && sh.eye[0] === 'body' ? shotFocus(run, sh) : null;
  const air = Math.exp(-Math.max(camAlt, 0)/8500);
  let tot = 0, dmin = 1e9;
  for (const id in run.mis.parts){
    const P = run.mis.parts[id]; if (!P || !P.thr) continue;
    const o = famPart(run.mis.fam, id), st = o && o.sx.st; if (!st || !st.on || o.hidden) continue;
    const dm = V.len(V.sub(cf, st.base))*1000, on = o === onF, thr = lin(P.thr, on ? run.mt : run.mt - dm/343);
    if (thr <= 0.005) continue;
    tot += (ENG_LOUD[id] || 0.4)*thr*(on ? 0.85 : Math.pow(150/Math.max(dm, 150), 0.6)*air*Math.exp(-Math.max(st.alt, 0)/15));
    if (on) HEAR.onboard = true; else dmin = Math.min(dmin, dm);
  }
  HEAR.total = Math.min(tot, 1.3); HEAR.d = dmin;
  const d = HEAR.onboard ? 20 : dmin;
  // (SX.snd: this tick's sound, which a recording renders offline with music.rocketRender)
  SX.snd = tot < 0.002 ? null : { roar:tot*(HEAR.onboard ? 0.7 : 1 - 0.55*smooth(3000, 20000, d)), rumble:Math.min(1, tot*(0.7 + 0.5*smooth(800, 8000, d))),
    crackle:HEAR.onboard ? 0 : tot*smooth(120, 450, d)*(1 - smooth(3500, 12000, d)), lp:HEAR.onboard ? 420 : 250 + 7000/(1 + d/900), duck:tot*2.5 };
  music.rocket(SX.snd);
}
// Dragon docks "about a day later": the Solar System clock moves on a day, then on to a moment when the station is in sunlight for the
// next few minutes, so the docking can be seen (it is dark for about 35 of every 93 minutes)
function dockInDaylight(){
  const iss = BYKEY.iss; if (!iss) return;
  DAY.T = 0; ssDays = stationLit(ssDays + 1);
  earth.update(0); iss.update(0);
}
// (the first moment from a moment of the atlas clock, within 100 minutes, when the station is in sunlight then and 2 and 4 minutes later;
// the clock is put back)
function stationLit(from){
  const iss = BYKEY.iss, d0 = ssDays; let t = from;
  for (let k=0;k<100;k++){
    let lit = true;
    for (const dtm of [0, 2, 4]){ ssDays = t + dtm/1440; earth.update(0); iss.update(0); const p = M3.applyT(earth.rot, V.mul(iss.offset, 1/KM)), s = sunFixed();
      if (V.dot(p, s) < 0 && V.len(V.sub(p, V.mul(s, V.dot(p, s)))) < RE_KM) lit = false; }
    if (lit) break;
    t += 1/1440;
  }
  ssDays = d0; earth.update(0); iss.update(0);
  return t;
}
// a Dragon replay that reached its docking with nobody watching left the atlas clock alone (sxTick). Once you watch it, the clock eases on
// over T s to the station's next moment in sunlight, if it is in the dark: 35 minutes at most, never a day
function dockLight(run, T){
  if (!run.dock || !BYKEY.iss) return; run.dock = false;
  const t = stationLit(ssDays); if (t > ssDays + 1e-6) dayTo(t, T);
}
// playback speed at mission time t: the rate of the last step at or before t
// the playback speed at mission time t. A mission's table gives a speed from each time; between two speeds it eases, log-linear in mission
// time, over about RAMP s of real time: starting at the change when it speeds up, ending at it when it slows down, so every slow part plays
// slow from its first second (owner, 0.10.1: the jumps from 3 to 16 times and back to 1.6 looked like cuts and skips)
const RAMP = 1.8;
function rateTable(R){
  if (R._sm) return R._sm;
  const out = [[R[0][0], R[0][1]]];
  for (let i=1;i<R.length;i++){
    const [a, r1] = R[i], [p0, r0] = out[out.length - 1]; if (r1 === r0){ continue; }
    const span = RAMP*Math.sqrt(r0*r1);   // (the mission seconds the ramp takes)
    if (r1 > r0){ if (a > p0) out.push([a, r0]); out.push([a + span, r1]); }
    else { const s0 = Math.max(a - span, p0); if (s0 > p0) out.push([s0, r0]); out.push([Math.max(a, s0 + 1e-3), r1]); }
  }
  Object.defineProperty(R, '_sm', { value:out, enumerable:false }); return out;
}
function stepRate(R, t){
  const T = rateTable(R), n = T.length;
  if (t <= T[0][0]) return T[0][1]; if (t >= T[n - 1][0]) return T[n - 1][1];
  let i = 0; while (i < n - 2 && t >= T[i + 1][0]) i++;
  const [a, ra] = T[i], [b, rb] = T[i + 1], u = (t - a)/Math.max(b - a, 1e-6);
  return Math.exp(Math.log(ra) + (Math.log(rb) - Math.log(ra))*u);
}
function eventNow(run){ let e = ''; for (const [t, s] of run.mis.events) if (run.mt >= t && run.mt - t < (run.mode === 'real' ? 40 : 30)) e = s; return e === '@site' ? SXS[run.site].name : e; }
// ---------------------------------------------------------------- the numbers in the info panel
const SX_IDLE = {
  star:'standing on the launch mount at Starbase, Texas · about 120 m tall with Super Heavy\npick it to launch: the countdown starts when the camera arrives',
  f9:'standing on its pad at Cape Canaveral · 70 m tall\npick it to launch: the countdown starts when the camera arrives',
  fh:'standing on Launch Complex 39A at Kennedy · 70 m tall, 12 m wide\npick it to launch: the countdown starts when the camera arrives',
};
function sxReadout(o){ const t = sxReadout0(o), c = EDT.creditNow(); return c ? t + '\n' + c : t; }
function sxReadout0(o){
  const st = o.sx.st, run = famRun(o.sx.fam);
  if (o.key === 'dragon' && (!run || run.key !== 'dragon' || run.mt < -9)) return st && st.atISS && (!run || run.key !== 'dragon') ? 'docked at the station\'s forward port (illustrative: a Dragon is often there)\npick it to fly a whole mission: launch from Cape Canaveral, then docking' : 'pick it to fly a whole mission: launch, then docking at the ISS';
  if (!run || !st) return SX_IDLE[o.sx.fam] || '';
  const mt = run.mt, ev = eventNow(run);
  const hon = run.mode === 'real' ? 'live: SpaceX\'s launch at its scheduled time (Launch Library 2), drawn by the atlas; the real one can slip' : SET.launchReal && LCAM.on ? 'illustrative: the path and timings are modelled on real flights, played at real speed' : 'illustrative: the path and timings are modelled on real flights, sped up in the quiet parts';
  if (mt < 0) return `${clk(mt)}${ev && ev !== SXS[run.site].name ? ' · ' + ev : ''} · ${SXS[run.site].name}\n${hon}`;
  if (st.atISS) return `${clk(mt)}${ev ? ' · ' + ev : ''}\n${st.dist > 1 ? Math.round(st.dist) + ' m from the docking port' : 'docked'} · the station orbits 420 km up at 28,000 km/h\n${hon}`;
  const alt = st.alt, sp = st.speed*3600;
  const altS = alt < 1 ? Math.round(alt*1000) + ' m' : (alt < 10 ? alt.toFixed(1) : Math.round(alt)) + ' km';
  return `${clk(mt)}${ev ? ' · ' + ev : ''}\naltitude ${altS} · ${Math.round(sp).toLocaleString('en-US')} km/h · ${Math.round(Math.max(st.s || 0, 0)).toLocaleString('en-US')} km downrange\n${hon}`;
}
const SXDBG = { SX, MIS, LCAM, LENS, ATM, DAY, EDT, WX, HEAR, SMK, wxAt, shotVP, launchPose, camPose, famRun, newRun, endRun, sxEval, buildClusters, plumeOf, watch:sxWatch, rd:roadsterEq, afternoonAt:k => afternoonAt(SXS[k]),
  // (tests: move the Solar System clock until the Sun stands at elevation el degrees over a site, rising (am) or setting)
  sunAt(site, el, am = true){ DAY.T = 0; const S = SXS[site] || SX_DS[site]; let best = 0, bd = 1e9; for (let h=0;h<24*4;h++){ ssDays = realJD() - JD_NOW + h/96; earth.update(0); const e = Math.asin(V.dot(sunFixed(), S.up))/DEG, e2 = (ssDays += 0.01, earth.update(0), Math.asin(V.dot(sunFixed(), S.up))/DEG); ssDays -= 0.01; const d = Math.abs(e - el) + ((e2 > e) === am ? 0 : 100); if (d < bd){ bd = d; best = ssDays; } } ssDays = best; earth.update(0); return +(Math.asin(V.dot(sunFixed(), S.up))/DEG).toFixed(1); },
  start(key, mode = 'replay', mt = 0, opt = {}){ const r = newRun(key, mode, Object.assign({ mt }, opt)); r.hold = false; buildClusters(); return r; },
  setMt(key, mt){ const r = famRun(MIS[key].fam); if (r){ const j = r.mis.jump; if (j && r.mt < j[1] && mt >= j[1] && r.key === 'dragon') dockInDaylight(); r.mt = mt; r.hold = false; r.ended = false; sxEval(r); buildClusters(); } return !!r; },
  camNow(key){ const r = famRun(MIS[key].fam); if (r){ startLaunchCam(r); LCAM.from = null; updateLaunchCam(0); } return !!r; },
  // (tests: how long a mission plays, in seconds, at its highlights speed)
  playLength(key){ const m = MIS[key]; let t = -20.5, s = 0; while (t < m.end){ if (m.jump && t >= m.jump[0] && t < m.jump[1]) t = m.jump[1]; const r = stepRate(m.rate, t); t += r/60; s += 1/60; } return Math.round(s); },
  // (tests: look at Earth from k Earth radii straight above a site)
  orbitOver(site, k = 3){ const S = SXS[site]; lockOn(earth.index); flight = null; show.on = show.pending = false; orbit.lock = earth.index; cam.focus = earth.index; orbit.frame = camFrameOf(earth); const d = M3.applyT(orbit.frame, M3.apply(earth.rot, S.up)); orbit.yaw = Math.atan2(d[0], d[2]); orbit.pitch = Math.asin(d[1]); orbit.dist = orbit.distT = earth.rad*k; orbit.off = [0, 0, 0]; orbit.target = [0, 0, 0]; applyOrbit(); return 1; },
  // (tests: replace a mission's camera by one shot from now on, or put its own shots back)
  shot(key, sh){ const m = MIS[key]; if (!m._shots) m._shots = m.shots; m.shots = sh ? [Object.assign({ t:-1e9 }, sh)] : m._shots; LCAM.shot = -1; return m.shots.length; } };


// ================================================================ render targets
const DETAIL = [{name:'ultra', w:4}, {name:'fine', w:5}, {name:'normal', w:6.5}, {name:'bold', w:9}];
if (SET.detailAuto) SET.detail = 1;   // (auto starts on fine; see AUTO_D in the main loop)
let detailIdx = clamp(SET.detail | 0, 0, DETAIL.length - 1), glowOn = SET.glow, labelsOn = SET.labels;
let dpr = 1, cellW = 6, cellH = 11, cols = 1, rows = 1, sceneW = 2, sceneH = 2;
let tanY = Math.tan(cam.fovY/2), tanX = tanY, viewWcss = 1, viewHcss = 1, canvasHcss = 1;
let tanY0 = tanY, tanX0 = tanX;   // (the field of view without the launch camera's telephoto lens, LENS in s4-spacex-run.js)
let RT = null, viewFit = 1, LODK = 1, afterFrame = null;   // afterFrame: run once right after the next frame is drawn   // LODK: ray-march step budget, lowered automatically on slow devices
function freeRT(){ if (!RT) return; for (const k of ['sceneTex','cellTex','glowA','glowB']) gl.deleteTexture(RT[k]); for (const k of ['sceneFBO','cellFBO','glowFA','glowFB']) gl.deleteFramebuffer(RT[k]); }
function resize(){
  dpr = Math.min(devicePixelRatio || 1, 2);
  const cssW = canvas.clientWidth || innerWidth, cssH = canvas.clientHeight || innerHeight;
  canvas.width = Math.max(1, Math.round(cssW*dpr)); canvas.height = Math.max(1, Math.round(cssH*dpr));
  cellW = Math.max(3, Math.round(DETAIL[detailIdx].w*dpr)); cellH = Math.round(cellW*1.8);
  cols = Math.ceil(canvas.width/cellW); rows = Math.ceil(canvas.height/cellH);
  sceneW = cols*2; sceneH = rows*2;
  freeRT();
  const sceneTex = makeTex(sceneW, sceneH, HDR ? gl.RGBA16F : gl.RGBA8, gl.RGBA, HDR ? gl.HALF_FLOAT : gl.UNSIGNED_BYTE, gl.LINEAR);
  const cellTex = makeTex(cols, rows, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, gl.NEAREST);
  const glowA = makeTex(cols, rows, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, gl.LINEAR);
  const glowB = makeTex(cols, rows, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, gl.LINEAR);
  RT = { sceneTex, cellTex, glowA, glowB, sceneFBO:makeFBO(sceneTex), cellFBO:makeFBO(cellTex), glowFA:makeFBO(glowA), glowFB:makeFBO(glowB) };
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  buildAtlas(cellW, cellH);
  canvasHcss = cssH; viewWcss = cols*cellW/dpr; viewHcss = rows*cellH/dpr;
  const aspect = (cols*cellW)/(rows*cellH);
  cam.fovY = Math.max(55*DEG, 2*Math.atan(Math.tan(25*DEG)/aspect));
  viewFit = aspect < 0.8 ? 1.2 : 1;
  tanY0 = tanY = Math.tan(cam.fovY/2); tanX0 = tanX = tanY*aspect;
  const di = $('#detailInfo'); if (di) di.textContent = `${cols} x ${rows} characters`;
}

// ================================================================ drawing
const I3 = M3.I();
let camRot = I3, sky = [1, 0, 0, 1], gcDir = [1, 0, 0], nearSun = 1;
function drawQuad(){ gl.bindVertexArray(quadVAO); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4); }
function setCommon(pr, o){
  gl.uniform2f(pr.u.uRes, sceneW, sceneH);
  gl.uniformMatrix3fv(pr.u.uCamRot, false, camRot);
  gl.uniform2f(pr.u.uTan, tanX, tanY);
  gl.uniform1f(pr.u.uOut, OUT);
  gl.uniform1f(pr.u.uPix, 2*tanY/sceneH);
  gl.uniform1i(pr.u.uNoise, 0);
  gl.uniform4f(pr.u.uSky, sky[0], sky[1], sky[2], sky[3]);
  gl.uniform1f(pr.u.uVis, 1);
  gl.uniform1f(pr.u.uGT, GT); gl.uniform1f(pr.u.uTw, twinkleAmt());
  gl.uniform1i(pr.u.uTex, 5); gl.uniform1i(pr.u.uMW, 6);
  gl.uniform4f(pr.u.uGC, gcDir[0], gcDir[1], gcDir[2], nearSun);
  if (o){ gl.uniform1f(pr.u.uTime, o.t); gl.uniform1f(pr.u.uRad, o.rad); gl.uniformMatrix3fv(pr.u.uRot, false, o.rot);
    gl.activeTexture(gl.TEXTURE5); gl.bindTexture(gl.TEXTURE_2D, o.tex ? TEX[o.tex] : TEX.mw);
    if (o.tex2 && pr.u.uTex2){ gl.uniform1i(pr.u.uTex2, 7); gl.activeTexture(gl.TEXTURE7); gl.bindTexture(gl.TEXTURE_2D, TEX[o.tex2]); } }
}
// The screen rectangle (NDC) a volume's bounding sphere can cover, or null when none of it can be seen.
// A sphere wholly in front of the camera is bounded by the corners of its bounding cube, as always. One that reaches behind the camera
// used to take the whole screen (the Large Magellanic Cloud was ray-marched, out of sight, in many Earth and Sun views). Now:
// seen along one screen axis, the sphere is a disc in the plane of that axis and the view direction, and the two lines from the camera
// that touch the disc bound it on screen. Only what lies in front of the camera counts, so the rectangle gets an open side (out to the
// screen edge) where the sphere passes beside the camera, and a sphere entirely off to the side is not drawn at all.
function discSpan(a, z, r){
  const d2 = a*a + z*z; if (d2 <= r*r) return [-Infinity, Infinity];
  const f = Math.atan2(a, z), h = Math.asin(r/Math.sqrt(d2)), lo = f - h, hi = f + h, Q = Math.PI/2;
  if (lo >= Q || hi <= -Q) return null;
  return [lo <= -Q ? -Infinity : Math.tan(lo), hi >= Q ? Infinity : Math.tan(hi)];
}
function sphereRect(c, r){
  if (V.len(c) < r*1.05) return [-1,-1,1,1];
  const vx = V.dot(c, cam.right), vy = V.dot(c, cam.up), vz = V.dot(c, cam.fwd);
  if (vz + r < 0) return null;
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
  if (vz - r < r*0.02){
    // reaches behind the camera: the touching lines, with a wide margin (some shaders glow a little past rad, and this used to be the whole screen)
    const sx = discSpan(vx, vz, r*1.25), sy = sx && discSpan(vy, vz, r*1.25); if (!sy) return null;
    x0 = sx[0]/tanX; x1 = sx[1]/tanX; y0 = sy[0]/tanY; y1 = sy[1]/tanY;
  } else {
    // wholly in front: the corners of the bounding cube (a little looser than the sphere itself, as it always was)
    for (const sz of [-r, r]){ const z = vz + sz;
      for (const s of [-r, r]){ const x = (vx + s)/(z*tanX), y = (vy + s)/(z*tanY); x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); } }
  }
  const px = 4/sceneW, py = 4/sceneH;
  x0 = Math.max(x0 - px, -1); x1 = Math.min(x1 + px, 1); y0 = Math.max(y0 - py, -1); y1 = Math.min(y1 + py, 1);
  if (x0 >= x1 || y0 >= y1) return null;
  return [x0, y0, x1, y1];
}
// raymarched volume bounded by a sphere; rel = centre relative to the camera, rot = local frame
function drawVolume(o, pr, rel, radius, setU, rot, vis = 1){
  const rect = sphereRect(rel, radius); if (!rect) return false;
  if (!progReady(pr)) return false;
  const dist = V.len(rel), R = rot || o.rot;
  gl.useProgram(pr.p); setCommon(pr, o);
  if (o.outBoost) gl.uniform1f(pr.u.uOut, OUT*o.outBoost);
  gl.uniform1f(pr.u.uRad, radius); gl.uniformMatrix3fv(pr.u.uRot, false, R);
  gl.uniform3fv(pr.u.uCamLocal, M3.applyT(R, V.mul(rel, -1/radius)));
  gl.uniform4f(pr.u.uRect, rect[0], rect[1], rect[2], rect[3]);
  gl.uniform1f(pr.u.uVis, vis);
  const rpx = radius/Math.max(dist - radius*0.5, radius*1e-3)/tanY*sceneH*0.5;
  gl.uniform1f(pr.u.uLod, clamp(rpx/(sceneH*0.3), 0.3, 1)*LODK);
  setU && setU(pr);
  drawQuad();
  return true;
}
function drawParticles(o, s, vis = 1){
  if (s.show && !s.show()) return;
  const pr = P[s.prog]; if (!progReady(pr)) return;
  gl.useProgram(pr.p);
  const rel = s.rel ? s.rel() : (o ? o.rel : [0,0,0]), rad = s.rad || (o ? o.rad : 1);
  gl.uniformMatrix3fv(pr.u.uCamRot, false, camRot); gl.uniform2f(pr.u.uTan, tanX, tanY);
  gl.uniform3fv(pr.u.uRel, rel); gl.uniformMatrix3fv(pr.u.uRot, false, s.rot ? s.rot() : (o ? o.rot : I3)); gl.uniform1f(pr.u.uRad, rad);
  gl.uniform1f(pr.u.uPixAng, 2*tanY/sceneH); gl.uniform1f(pr.u.uMode, s.mode); gl.uniform1f(pr.u.uN, s.ps.count);
  gl.uniform1f(pr.u.uSB, s.mode === 1 || s.mode === 2 ? s.sb*rad*rad : s.sb); gl.uniform1f(pr.u.uSize, s.size); gl.uniform1f(pr.u.uCap, s.cap || 2);
  gl.uniform1f(pr.u.uOut, OUT); gl.uniform1f(pr.u.uT, o ? o.t : 0); gl.uniform1f(pr.u.uVis, vis*(s.vis ? s.vis() : 1));
  if (s.q0) gl.uniform4fv(pr.u.uQ0, s.q0());
  if (s.q1) gl.uniform4fv(pr.u.uQ1, s.q1());
  if (s.mat) gl.uniformMatrix3fv(pr.u.uM, false, s.mat());
  if (s.len) gl.uniform1f(pr.u.uLen, s.len);
  if (pr.u.uHole) gl.uniform4fv(pr.u.uHole, HOLE);
  gl.bindVertexArray(s.ps.vao); gl.drawArrays(s.lines ? gl.LINES : gl.POINTS, 0, s.count ? s.count() : s.ps.count);
}
// black holes: every shadow is pitch black. Each hole's shadow radius (2.6 r_s); per frame the one biggest on screen is handed to the particle shader
for (const o of OBJ) o.holeR = o.prog === P.blackhole ? o.rad*0.13 : (o.isBH && o.sizeR ? o.sizeR*2.6 : 0);
const HOLES = OBJ.filter(o => o.holeR > 0), HOLE = new Float32Array(4);
function pickHole(){
  let best = 0; HOLE[3] = 0;
  for (const o of HOLES){
    if (o.hidden || !(o.dist > o.holeR)) continue;
    const px = o.holeR/o.dist/tanY*(viewHcss/2);   // shadow radius on screen, in pixels
    if (px > 1.5 && px > best){ best = px; HOLE[0] = o.rel[0]; HOLE[1] = o.rel[1]; HOLE[2] = o.rel[2]; HOLE[3] = o.holeR; }
  }
}
// distant objects become softly glowing dots (and fade into their detailed rendering as they grow)
const imp = makePS(512);
const impSpec = { ps:imp, prog:'ptBasic', mode:3, sb:1.6, size:5 };
// soothing flight drift: soft motes that only appear while the camera travels
const drift = (() => { const n = IS_SMALL ? 160 : 260, ps = makePS(n*2);
  for (let i=0;i<n;i++){ const p = [rnd(), rnd(), rnd()], w = 0.3 + 0.7*rnd(), c = V.lerp([0.6, 0.75, 1], [1, 0.9, 0.8], rnd()*0.6);
    for (let k=0;k<2;k++){ ps.a.set([p[0], p[1], p[2], w], (i*2 + k)*4); ps.c.set([c[0], c[1], c[2], k], (i*2 + k)*4); } }
  ps.upload('ac'); return ps; })();
const DR = { off:[0,0,0], vel:[0,0,0], zoom:0, amt:0, prevRel:null, prevFocus:-1, prevDist:1 };
function updateDrift(dt){
  const scale = Math.max(orbit.dist, 1e-30)*1.6;
  let v = [0,0,0], z = 0;
  if (DR.prevRel && DR.prevFocus === cam.focus && dt > 0){ v = V.mul(V.sub(cam.rel, DR.prevRel), 1/scale); z = Math.log(Math.max(orbit.dist, 1e-30)/DR.prevDist); }
  DR.prevRel = cam.rel.slice(); DR.prevFocus = cam.focus; DR.prevDist = Math.max(orbit.dist, 1e-30);
  const lv = V.len(v); if (lv > 0.12) v = V.mul(v, 0.12/lv);   // fast (warp) flights: streaks saturate instead of vanishing
  z = clamp(z, -0.3, 0.3);
  DR.off = [(DR.off[0] + v[0]) % 1e3, (DR.off[1] + v[1]) % 1e3, (DR.off[2] + v[2]) % 1e3];
  const speed = V.len(v)/Math.max(dt, 1e-3) + Math.abs(z)/Math.max(dt, 1e-3)*0.35;
  const target = flight && !reduceMotion ? clamp((speed - 0.08)*0.9, 0, 0.55) : 0;
  DR.amt += (target - DR.amt)*(1 - Math.exp(-dt*(target > DR.amt ? 2.2 : 3.5)));
  DR.vel = V.lerp(DR.vel, V.mul(v, 6), 1 - Math.exp(-dt*4)); DR.zoom += (z*6 - DR.zoom)*(1 - Math.exp(-dt*4));
  DR.scale = scale;
}
function drawDrift(){
  if (DR.amt < 0.01) return;
  for (const [pr, prim] of [[P.driftLn, gl.LINES], [P.driftPt, gl.POINTS]]){
    if (!progReady(pr)) continue;
    gl.useProgram(pr.p);
    gl.uniformMatrix3fv(pr.u.uCamRot, false, camRot); gl.uniform2f(pr.u.uTan, tanX, tanY);
    gl.uniform3fv(pr.u.uDrift, DR.off.map(x => x - Math.floor(x))); gl.uniform3fv(pr.u.uVel, DR.vel); gl.uniform1f(pr.u.uZoom, clamp(DR.zoom, -0.4, 0.4));
    gl.uniform1f(pr.u.uScale, DR.scale); gl.uniform1f(pr.u.uAmt, DR.amt*(prim === gl.LINES ? 0.35 : 0.9)); gl.uniform1f(pr.u.uOut, OUT); gl.uniform1f(pr.u.uPt, 2.2);
    gl.bindVertexArray(drift.vao); gl.drawArrays(prim, 0, drift.count);
  }
}
// (EXTRAS draw hooks are declared in 04-world.js)
// ---------------------------------------------------------------- the Solar System, magnified: at the scale of the whole system the Sun and planets would be
// invisible specks, so while you look at the system itself they are drawn enlarged (orbits and positions stay true).
// The Sun is sized first, as a share of the screen height: SUN_F when the view is 50 AU tall, growing gently (power G) as you zoom in,
// so zooming in never makes it shrink; it is never drawn smaller than it really is.
// Each planet is then drawn at S*(r/rSun)^P (capped so it stays clear of its neighbours' orbits): the Sun is always the largest and
// every planet keeps its real rank in size (Jupiter > Saturn > Uranus > Neptune > Earth > ...). A planet whose orbit falls inside the enlarged Sun steps aside.
// Picking a planet (or the Sun) brings everything back to true size. The readout gives the real ratios.
const SYSMAG = { k:0, SUN_F:0.04, G:0.15, P:0.3, list:[['sun', 0], ['jupiter', 1.84], ['saturn', 2.2], ['uranus', 4.7], ['neptune', 4.7], ['earth', 0.14], ['venus', 0.14],
  ['mars', 0.26], ['mercury', 0.16], ['pluto', 4.7]].filter(([k]) => BYKEY[k]).map(([k, cap]) => ({ o:BYKEY[k], cap:cap*AU_LY })), moons:OBJ.filter(o => o.parent && o.parent !== sun && o.parent.parent === sun && !o.marker && o.key !== 'halo') };
const coreOf = o => o.solid ? o.rad*o.solid : o.rad;
// In free camera the overview only turns on while you look at the system from outside: a wide view (the camera at least ~1 AU from what it
// looks at) and no planet near the camera (each at least 8 to 20 times its enlarged size away). It used to turn on anywhere 1 to 2,000 AU
// from the Sun, so a camera that had just let go of Jupiter saw it swell hundreds of times around it.
function updateSysMag(dt){
  const fo = flight ? flight.obj : OBJ[tour.on ? tour.obj : orbit.lock];
  const dSun = V.len(sun.rel)*(1/AU_LY), far = 1 - smooth(1500, 20000, dSun);
  const H = 2*tanY*Math.max(sun.dist, 1e-30), sunCore = coreOf(sun);   // screen height, in light-years, at the Sun's distance
  const S = Math.max(sunCore, Math.min(SYSMAG.SUN_F*Math.pow(Math.max(H/(50*AU_LY), 1e-4), -SYSMAG.G), 0.12)*H);
  let want = fo === BYKEY.solarsystem ? far : !fo && dSun > 1 && dSun < 2000 ? smooth(0.6, 2.5, dSun)*far : 0;
  if (!fo && want > 0){
    want *= smooth(0.25*AU_LY, 1.2*AU_LY, orbit.dist);
    for (const e of SYSMAG.list){ if (want <= 0) break; if (e.o !== sun){ const s = Math.min(S*Math.pow(coreOf(e.o)/sunCore, SYSMAG.P), e.cap); want *= smooth(8*s, 20*s, e.o.dist); } }
  }
  SYSMAG.k += (want - SYSMAG.k)*(1 - Math.exp(-dt*2.2));
  const k = SYSMAG.k < 0.002 ? 0 : SYSMAG.k;
  for (const e of SYSMAG.list){
    const o = e.o, core = coreOf(o), size = o === sun ? S : Math.min(S*Math.pow(core/sunCore, SYSMAG.P), e.cap);
    o.mag = 1 + Math.max(size/core - 1, 0)*k;
    o.outBoost = o === sun ? 0 : 1 + 2.2*k;   // lit by a Sun that is also in frame, a small planet would look dark: brighten it while enlarged
    if (o !== sun) o.magHide = (1 - smooth(1.0, 1.3, V.len(V.sub(o.rel, sun.rel))/(S + size)))*k;
  }
  // moons would sit inside their enlarged planets: they step aside until the planets shrink back
  for (const m of SYSMAG.moons) m.magHide = k;
}
const magOf = o => o.mag || 1;
// how much of the Sun is not hidden behind a planet or moon, seen from the camera (0 to 1): hides its glow dot and glare during an eclipse
let sunOccluders = null;
function updateSunOcc(){
  sunOccluders = sunOccluders || OBJ.filter(o => o.group === 'solar' && o.solid && o !== sun && o.prog && !o.marker);
  const d = sun.dist; let vis = 1;
  if (d > 0 && d < 2000*AU_LY){
    const u = V.mul(sun.rel, 1/d), rS = coreOf(sun)*magOf(sun);
    for (const b of sunOccluders){
      if (b.hidden || b.magHide > 0.5 || !(b.dist < d)) continue;
      const t = V.dot(b.rel, u); if (t <= 0) continue;
      const r = coreOf(b)*magOf(b), m = V.len(V.sub(b.rel, V.mul(u, t))), rs = rS*t/d;   // the Sun's radius, scaled to the occluder's distance
      vis *= smooth(Math.max(r - rs, 0), r + rs, m);
      if (vis < 0.01){ vis = 0; break; }
    }
  }
  sun.occ = vis;
}
function render(){
  camRot = [...cam.right, ...cam.up, ...cam.fwd];
  pickHole();
  // where are we? inside the Milky Way the sky is full of stars; outside it turns to galaxies
  const mw = milkyway, dGC = V.len(mw.rel), span = orbit.dist, dSun = V.len(sun.rel);
  gcDir = V.norm(mw.rel); nearSun = 1 - smooth(4000, 15000, dSun);
  const outMW = 1 - mw.inside, farOut = smooth(1.5e5, 2e6, dGC);
  sky = [clamp(1 - outMW*0.8 - farOut, 0, 1), smooth(1.5e5, 2e6, dGC)*(1 - smooth(3e8, 3e9, span)), Math.exp(-dGC/5000)*mw.inside, mw.inside];
  // (near the ground the air dims the stars and the Milky Way and hides the galaxies beyond it: ATM in s4-spacex-run.js)
  if (ATM.k > 0){ sky[0] *= 1 - 0.5*ATM.k; sky[1] *= 1 - ATM.k; sky[3] *= 1 - 0.6*ATM.k; }
  gl.bindFramebuffer(gl.FRAMEBUFFER, RT.sceneFBO); gl.viewport(0, 0, sceneW, sceneH);
  gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_3D, noiseTex);
  gl.activeTexture(gl.TEXTURE6); gl.bindTexture(gl.TEXTURE_2D, TEX.mw);
  gl.disable(gl.BLEND);
  gl.useProgram(P.bg.p); setCommon(P.bg, null); gl.uniform4f(P.bg.u.uRect, -1, -1, 1, 1); drawQuad();
  gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  drawDrift();
  const pxK = sceneH*0.5/tanY;
  let ni = 0;
  const order = OBJ.slice().sort((a, b) => a.layer - b.layer || b.dist - a.dist);
  for (const o of order){
    if (o.hidden || o.marker) continue;
    const R = o.rad*magOf(o), rpxTrue = o.rad/Math.max(o.dist, 1e-300)*pxK, rpx = R/Math.max(o.dist, 1e-300)*pxK;
    o.rpx = rpx;
    if (o.magHide > 0.5){ o.vis = 0; o.pvis = 0; continue; }
    if (o.inRange && !o.inRange()){ o.vis = 0; o.pvis = 0; continue; }
    const pmin = o.pxMin || 7;
    let vis = o.visFn ? o.visFn(rpx) : (o.alwaysFull ? 1 : smooth(pmin, pmin*2.6, rpx));
    // near the ground, nothing beyond the Solar System shows through the air (the planetarium keeps the whole sky)
    const deepK = ATM.k > 0.01 && !o.parent && o !== sun && o.dist > 0.01 ? 1 - ATM.k : 1;
    if (deepK < 0.02){ o.vis = 0; o.pvis = 0; continue; }
    vis *= deepK;
    if (cmp && (o === cmp.a || o === cmp.b)) vis = Math.max(vis, smooth(1, 3, rpx));
    if (o.mag > 1.5) vis = Math.max(vis, smooth(0.8, 2.2, rpx)*SYSMAG.k);   // enlarged planets are drawn as real discs even when only a few characters wide   // side by side, even tiny things are drawn for real
    // shaders compile on demand: until this object's are ready it keeps showing as a glowing dot
    if (vis > 0.003 && o.prog && !progReady(o.prog)) vis = 0;
    o.vis = vis;
    if (vis > 0.003){
      // farther glowing dots go down first, so a nearer opaque object (a black hole's shadow) covers them
      if (o.prog && ni){ imp.count = ni; imp.upload('ac'); drawParticles(null, impSpec); ni = 0; }
      // (volOff: something drawn after it covers it entirely this frame, such as the ground round a launch site over Earth)
      if (o.prog) o.onScreen = o.volOff && o.volOff() ? true : drawVolume(o, o.prog, o.rel, R, o.setU && (pr => o.setU(pr)), o.rot, vis);
      if (o.drawBefore) o.drawBefore(vis);
    }
    const pv = (o.particleVis ? o.particleVis(rpxTrue) : smooth(pmin*0.4, pmin*1.4, rpxTrue))*deepK;
    o.pvis = pv;
    if (pv > 0.003) for (const s of o.particles) drawParticles(o, s, pv);
    if (vis > 0.003 && o.drawAfter) o.drawAfter(vis);
    // impostor dot
    if (!o.noImpostor && (vis < 0.999 || o.mag > 1.5) && ni < imp.n){
      // (a dot only stands in for something small: once an object spans the screen, no dot at its centre)
      // (an enlarged planet keeps a soft glow at its centre too, so a disc a few characters wide still reads at a glance)
      const b = (o.mag > 1.5 ? o.farLum*SYSMAG.k*(1 - smooth(8, 30, rpx))*1.1 : o.farLum*(1 - vis)*clamp(Math.pow(rpx/1.2, 0.33), 0, 1.2)*(1 - smooth(40, 120, rpx)))*(o.occ ?? 1)*deepK;
      if (b > 0.015 && V.dot(o.rel, cam.fwd) > 0){ imp.a.set([o.rel[0], o.rel[1], o.rel[2], b], ni*4); imp.c.set([o.farColor[0], o.farColor[1], o.farColor[2], 0], ni*4); ni++; }
    }
  }
  for (const f of EXTRAS) f();
  if (ni){ imp.count = ni; imp.upload('ac'); drawParticles(null, impSpec); }
  gl.disable(gl.BLEND);
  // glyph selection per cell
  gl.bindFramebuffer(gl.FRAMEBUFFER, RT.cellFBO); gl.viewport(0, 0, cols, rows);
  let pr = P.cell; gl.useProgram(pr.p);
  gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, RT.sceneTex);
  gl.uniform1i(pr.u.uScene, 1); gl.uniform2f(pr.u.uGrid, cols, rows); gl.uniform1f(pr.u.uExp, 1.0); gl.uniform1f(pr.u.uIn, 1/OUT);
  gl.uniform1f(pr.u.uLv, atlas.levels); gl.uniform1f(pr.u.uDir0, atlas.dir0); gl.uniform1f(pr.u.uEdge, 1); gl.uniform4f(pr.u.uRect, -1, -1, 1, 1);
  gl.uniform1f(pr.u.uT, GT); gl.uniform1f(pr.u.uDith, 1);
  gl.activeTexture(gl.TEXTURE8); gl.bindTexture(gl.TEXTURE_2D, atlas.lut); gl.uniform1i(pr.u.uLut, 8); gl.uniform1f(pr.u.uSub, atlas.sub);
  drawQuad();
  if (glowOn){
    pr = P.glow; gl.useProgram(pr.p);
    gl.uniform2f(pr.u.uGrid, cols, rows); gl.uniform1f(pr.u.uExp, 1.0); gl.uniform1f(pr.u.uIn, 1/OUT); gl.uniform4f(pr.u.uRect, -1, -1, 1, 1);
    gl.bindFramebuffer(gl.FRAMEBUFFER, RT.glowFA);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, RT.sceneTex); gl.uniform1i(pr.u.uSrc, 1);
    gl.uniform1f(pr.u.uFirst, 1); gl.uniform2f(pr.u.uStep, 1.7/cols, 0); drawQuad();
    gl.bindFramebuffer(gl.FRAMEBUFFER, RT.glowFB);
    gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, RT.glowA); gl.uniform1i(pr.u.uSrc, 2);
    gl.uniform1f(pr.u.uFirst, 0); gl.uniform2f(pr.u.uStep, 0, 1.7/rows); drawQuad();
  }
  gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, canvas.width, canvas.height);
  pr = P.final; gl.useProgram(pr.p);
  gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, RT.cellTex); gl.uniform1i(pr.u.uCellT, 2);
  gl.activeTexture(gl.TEXTURE3); gl.bindTexture(gl.TEXTURE_2D, RT.glowB); gl.uniform1i(pr.u.uGlowT, 3);
  gl.activeTexture(gl.TEXTURE4); gl.bindTexture(gl.TEXTURE_2D, atlas.tex); gl.uniform1i(pr.u.uAtlas, 4);
  gl.uniform2f(pr.u.uCell, cellW, cellH); gl.uniform2f(pr.u.uGrid, cols, rows); gl.uniform1f(pr.u.uAtlasN, atlas.count);
  gl.uniform1f(pr.u.uGlowAmt, glowOn ? 0.16 : 0); gl.uniform3f(pr.u.uBg, 0.012, 0.014, 0.026); gl.uniform4f(pr.u.uRect, -1, -1, 1, 1);
  drawQuad();
  if (afterFrame){ const f = afterFrame; afterFrame = null; try { f(); } catch (e) { console.warn(e); } }
}

// ================================================================ HUD
let infoObj = 0, toastTimer = 0, roTimer = 0, hintHidden = false;
const infoEl = $('.info'), atlasEl = $('#atlas'), settingsEl = $('#settings'), ladderEl = $('#ladder'), controlsEl = $('.controls'), brandEl = $('.brand'), ladChipEl = $('#ladChip'), infoPillEl = $('#infoPill'), shipMenuEl = $('#shipMenu');
const HT_SW = [$('#btnHaloSw'), $('#toursHaloSw')];   // (the Halo tour switches: right of tours on a desk, at the top of the list of tours on a phone)
// panels and the ladder sit just below the toolbar, however many rows it wraps onto
const syncCtl = () => { const b = controlsEl.getBoundingClientRect(); document.documentElement.style.setProperty('--ctl-b', (isCompact() ? 54 : Math.round(b.bottom)) + 'px'); };
if (typeof ResizeObserver !== 'undefined') new ResizeObserver(syncCtl).observe(controlsEl); syncCtl();
function projectCSS(rel){
  const z = V.dot(rel, cam.fwd); if (z <= 0) return null;
  const x = V.dot(rel, cam.right)/(z*tanX), y = V.dot(rel, cam.up)/(z*tanY);
  return { x:(x*0.5 + 0.5)*viewWcss, y:canvasHcss - (y*0.5 + 0.5)*viewHcss, z };
}
function toast(msg){ const t = $('#toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('on'), 2600); }
function hideHint(){ if (hintHidden) return; hintHidden = true; $('#hint').style.opacity = '0'; }
const distFromEarth = o => o.distEarth || fmtDist(V.len(V.sub(o.pos, earth.pos))) + ' from Earth';
const readoutEl = $('#readout'); let roLast = '';
function setReadout(t){
  // the numbers wrap inside the panel, the same width as the fact above them
  if (t === roLast) return; roLast = t;
  readoutEl.textContent = t;
}
// the Halo tour shows the place, not the ship (owner, 0.9.9): while it plays and the camera is with the ship (riding along, or locked on it
// after a drag), the panel shows the place the ship visits or is going to (htPlace, 09t-halotour.js), with a blue line over the name saying
// what the ship is doing. Not during a flight to somewhere else (the tour ends when it lands).
function htShowsPlace(){ return HT.on && !tour.on && !cmp && !SKYV.on && typeof ship !== 'undefined' && (isRiding() || (orbit.lock === ship.index && !flight)); }
function setInfo(i){
  if (typeof ship !== 'undefined' && i === ship.index && htShowsPlace()){ const p = htPlace(); if (p) i = p.index; }
  // a new object's numbers (the orange lines) fade in instead of appearing all at once
  if (i !== infoObj){ readoutEl.classList.remove('fade'); void readoutEl.offsetWidth; readoutEl.classList.add('fade'); }
  infoObj = i; const o = OBJ[i];
  $('#objName').textContent = o.name; $('#objType').textContent = o.type; $('#objFact').textContent = o.fact || '';
  syncStop();
  syncWhere();
  setReadout(o.readout ? o.readout() : '');
  syncFlyby();
  atlasMark(i);
}
// (no flyby on the Halo tour: it would fly the camera away from the ship, and the row of buttons has no room for it beside stop riding)
function syncFlyby(){ $('#btnFlyby').hidden = !OBJ[infoObj].flyby || htShowsPlace(); }
// the Halo tour: the panel follows the place (on to the next stop as soon as the ship sets course for it), and the blue line over the name
function syncHtInfo(){
  const on = htShowsPlace(), el = $('#htLine');
  if (on){ const p = htPlace(); if (p && p.index !== infoObj) setInfo(p.index); }
  if (el.hidden === on) el.hidden = !on;
  if (on){ const t = htDoing(); if (el.textContent !== t){ el.textContent = t; el.title = t; } }
}
// where the object is, under its name; honest once the camera has let go of it (it used to say "you are here" 48 billion light-years out)
const freeCam = () => orbit.lock < 0 && !tour.on && !flight && !cmp && !SKYV.on;
function syncWhere(){
  const o = OBJ[infoObj], el = $('#objDist');
  const t = freeCam() ? (isCompact() ? 'free camera · ⌂ for home' : 'free camera · H for home') : o.key === 'earth' ? 'you are here' :
    (o.distEarth ? o.distEarth + (/away|here|around|from|edge|centre|inside/.test(o.distEarth) ? '' : ' away') : distFromEarth(o));
  if (el.textContent !== t) el.textContent = t;
}
// the row above the name: "stop 3 / 31" on a tour; otherwise the kind of object ("gas giant"), shown while the type line is folded away
// (it used to read "-- / 31" off the tour)
function syncStop(){
  // (on the Halo tour: the stop the panel shows, which is the one the ship is going to while it travels)
  const hk = HT.on ? HT.stops.indexOf(OBJ[infoObj]) : -1;
  const el = $('#stopInfo'), k = tour.on ? TOUR.indexOf(infoObj) : HT.on ? (hk >= 0 ? hk : HT.i) : -1;
  const t = k >= 0 ? 'stop ' + (k + 1) + ' / ' + (tour.on ? TOUR.length : HT.stops.length) : tour.on ? '' : (OBJ[infoObj].type || '').split(' · ')[0];
  if (el.textContent !== t) el.textContent = t;
  el.classList.toggle('kind', k < 0);
}
// the green button beside the name says where it goes: the next stop on a tour ("start again" on the last one); once you have left
// a tour, back to the stop you left it at; paused on that stop (a drag, the pause button), on to the next stop. Hidden when no tour is involved.
function goNextState(){
  if (cmp || SKYV.on) return null;
  if (HT.on && !tour.on){ const o = htNextStop(); return o ? { kind:'halo', o } : null; }   // (the Halo tour: on to its next stop now)
  if (TOUR.length < 2) return null;
  // (on the last stop of the random tour it deals 12 new places, starting from there: 'deal', o is that last stop)
  const nextOf = i => { const k = TOUR.indexOf(i); return k < TOUR.length - 1 ? { kind:'next', o:OBJ[TOUR[k + 1]] } : tourDeals() ? { kind:'deal', o:OBJ[i] } : { kind:'again', o:OBJ[TOUR[0]] }; };
  if (tour.on) return TOUR.includes(tour.obj) ? nextOf(tour.obj) : null;
  if (tour.last == null || !TOUR.includes(tour.last)) return null;
  return orbit.lock === tour.last && !flight && !shipCam.on ? nextOf(tour.last) : { kind:'back', o:OBJ[tour.last] };
}
let goNextShown = '';
function syncGoNext(){
  const s = goNextState(), b = $('#goNext');
  const name = s ? s.o.label || s.o.name : '';
  const txt = !s ? '' : s.kind === 'again' ? 'start again' : s.kind === 'deal' ? 'new ' + tourName() : s.kind === 'back' ? 'back to the tour · ' + name : 'next stop · ' + name;
  if (txt === goNextShown) return; goNextShown = txt;
  b.hidden = !s; if (!s) return;
  $('#goNextTxt').textContent = txt; b.classList.toggle('back', s.kind === 'back');
  b.title = s.kind === 'halo' ? 'The Halo flies on to its next stop now: ' + s.o.name : s.kind === 'again' ? 'Start the tour again from ' + name + ' (])' : s.kind === 'deal' ? RANDOM_N + ' new places picked at random, starting from here (])' : s.kind === 'back' ? 'Back to the tour, at ' + s.o.name : 'Fly on to the next stop: ' + s.o.name + ' (])';
}
function goNextClick(){
  const s = goNextState(); if (!s) return;
  hideHint(); if (cmp) endCompare(false);
  if (s.kind === 'back'){ setTour(true); return; }   // (picks the tour up at the stop you left)
  if (s.kind === 'halo'){ haloTourSkip(); return; }
  tween = null; if (flight) finishFlightHere();
  if (!tour.on){ tour.on = true; shipCam.on = false; }
  if (s.kind === 'deal'){ tour.obj = s.o.index; tourGo(tourNext(1)); } else tourGo(s.o.index);
  updateModeUI();
}
function updateModeUI(){
  const ht = HT.on && !cmp && !tour.on, m = cmp ? 'size compare' : tour.on ? tourName() : ht ? 'halo tour · ' + htTour().name : (orbit.lock >= 0 || flight ? 'locked on' : 'free camera'), me = $('#mode'), mt = $('#modeTour');
  // on a tour the name is a button that opens the list of tours ("GRAND TOUR ▾"; on the Halo tour "HALO TOUR · GRAND TOUR ▾")
  const tb = tour.on || ht; if (mt.hidden === tb){ mt.hidden = !tb; me.hidden = tb; }
  if (tb){ if ($('#modeTourName').textContent !== m) $('#modeTourName').textContent = m; }
  else if (me.textContent !== m){ me.textContent = m; me.className = 'mode ' + (m === 'free camera' ? 'm-free' : 'm-lock'); }
  mt.setAttribute('aria-expanded', String(!$('#tours').hidden));
  syncStop(); syncGoNext();
  $('#btnTours').classList.toggle('touring', tour.on);
  const playing = isPlaying(), back = playing ? null : backTarget();
  for (const b of [$('#btnPlay'), $('#btnPlayM')]){
    b.classList.toggle('paused', !playing); b.setAttribute('aria-pressed', String(!playing));
    b.setAttribute('aria-label', playing ? 'Pause the camera (space)' : back ? 'Back to ' + back.name + ' (space)' : (motion.last === 'tour' || orbit.lock < 0 ? 'Play the tour (space)' : 'Play the angles (space)')); b.title = b.getAttribute('aria-label');
  }
  $('#btnPlay').lastChild.textContent = playing ? 'pause' : back ? 'back to ' + back.name : 'play';
  syncWhere();
  const riding = shipCam.on || (shipCam.pending && !!flight), rb = $('#btnRide'), sb = $('#btnShip'), cpt = isCompact(); rb.classList.toggle('following', riding); rb.setAttribute('aria-pressed', String(riding));   // (lit while riding; its word stays 'ride': 'riding' was wider and pushed ? onto a row of its own at 1280 px)
  // (a desk's ship button toggles the marker; a phone's opens the Halo's menu, and says "riding" while you ride)
  if (cpt){ sb.removeAttribute('aria-pressed'); sb.setAttribute('aria-haspopup', 'menu'); sb.setAttribute('aria-expanded', String(!shipMenuEl.hidden)); sb.title = 'The Halo: ride along, cockpit, marker'; }
  else { sb.setAttribute('aria-pressed', String(!!SET.haloMark)); sb.removeAttribute('aria-haspopup'); sb.removeAttribute('aria-expanded'); sb.title = 'Show where the Halo is (a blue marker)'; }
  sb.classList.toggle('following', cpt && riding); const st = cpt && riding ? 'riding' : 'ship'; if (sb.textContent !== st) sb.textContent = st;
  if (!shipMenuEl.hidden) syncShipMenu();
  rb.title = riding ? 'Stop riding along (the camera stays with the ship)' : 'Ride along with the Halo, the place it visits in view: K holds the camera still, C for the cockpit';
  // (the Halo tour switches, right of tours and in the list of tours, on while the Halo tour plays, which can also end by itself; the camera
  // switch on the lower row while riding along outside the ship; the note in the tours list)
  for (const hs of HT_SW){ hs.setAttribute('aria-checked', String(HT.on));
    hs.title = HT.on ? 'Halo tour: on, the Halo flies ' + htTour().name + '. Click to end it (you keep riding, the Halo roams on its own)' : 'Halo tour: ride along while the Halo flies the tour you pick in tours'; }
  $('#rideCamSeg').hidden = !(riding && shipCam.mode === 'chase'); $('#htNote').hidden = !HT.on;
  // (the panel's own ride buttons: on the Halo, and on the Halo tour, whose panel shows the place)
  syncHtInfo(); syncFlyby();
  const onShip = typeof ship !== 'undefined' && (infoObj === ship.index || htShowsPlace());
  $('#btnRideI').hidden = !onShip; $('#btnRideI').textContent = riding ? 'stop riding' : 'ride along';
  $('#btnCamI').hidden = !riding; $('#btnCamI').textContent = shipCam.mode === 'chase' ? 'cockpit view' : 'outside view';
  $('#btnFree').setAttribute('aria-pressed', String(!tour.on && orbit.lock < 0 && !flight));
  $('#btnTour').setAttribute('aria-pressed', String(tour.on)); $('#btnTour').textContent = tour.on ? 'pause tour' : 'resume ' + tourName();
  if (typeof tourRows !== 'undefined') tourRows.forEach(r => r.b.setAttribute('aria-current', String(HT.on ? r.id === HT.tourId : tour.on && r.id === TOUR_ID)));
}
function goTo(i){
  hideHint(); if (OBJ[i].marker) return;
  clearSearch();   // (a pick empties the search box, so the next search starts fresh and the keys work again)
  if (cmpPick){ cmpPick = false; atlasTitle(); startCompare(cmpA, i); return; }
  if (cmp) endCompare(true);
  if (tour.on && TOUR.includes(i)){ tween = null; if (flight) finishFlightHere(); tourGo(i); } else lockOn(i);
}
const labelEls = OBJ.map((o, i) => {
  const b = document.createElement('button'); b.className = 'lab' + (o.layer < 3 || o.marker ? ' big' : '') + (o.marker ? ' star' : '') + (o.labelClass ? ' ' + o.labelClass : '');
  b.textContent = o.label || o.name; b.tabIndex = -1;
  if (!o.marker) b.addEventListener('click', () => goTo(i));
  $('#labels').appendChild(b); return b;
});
const starEls = STAR_LABELS.map(s => { const b = document.createElement('span'); b.className = 'lab star'; b.textContent = s.name; $('#labels').appendChild(b); return b; });
// interface areas labels must stay clear of
function uiRects(){
  const r = [infoEl.getBoundingClientRect(), controlsEl.getBoundingClientRect(), brandEl.getBoundingClientRect()];
  const lb = ladderEl.getBoundingClientRect(); if (lb.height > 0) r.push({ left:lb.left - 190, right:lb.right + 12, top:lb.top - 30, bottom:lb.bottom + 10 });
  for (const el of [$('.topr'), infoPillEl]) if (!el.hidden){ const b = el.getBoundingClientRect(); if (b.height > 0) r.push(b); }
  if (!atlasEl.hidden) r.push(atlasEl.getBoundingClientRect());
  if (!settingsEl.hidden) r.push(settingsEl.getBoundingClientRect());
  return r;
}
// the marks of places on Earth: the famous places of the atlas's "on Earth" kind (EPL.PICKS); m.min: how big Earth must be on the screen (px)
// (the five cities and the famous places with their own layers, e9p-earth-places.js, are marked as in 3D, and come first)
const earthMarks = FLAGS.realEarth ? EPL.ALL_PICKS.map(r => {
  const city3d = (typeof ECT !== 'undefined' && ECT.match(r[2], r[3], r[0])) || !!EPL.ownOf(r), k = r[1];
  const el = document.createElement('button'); el.className = 'lab emark' + (city3d ? ' e3d' : ''); el.tabIndex = -1;
  el.textContent = r[0] + (city3d ? ' · 3D' : ''); el.title = 'Fly down to ' + r[0];
  el.addEventListener('click', () => { hideHint(); EPL.go(r); });
  $('#labels').appendChild(el);
  return { el, row:r, u:[Math.cos(r[2]*DEG)*Math.cos(r[3]*DEG), Math.sin(r[2]*DEG), -Math.cos(r[2]*DEG)*Math.sin(r[3]*DEG)],
    pri:city3d ? 3 : k === 'C' || k === 'c' ? 1.2 + Math.log10(r[4])*0.1 : k === 'm' ? 1 + r[4]/9000 : 0.8, min:city3d ? 110 : k === 'C' || k === 'c' ? 135 : 230 };
}) : [];
function updateLabels(){
  const focus = tour.on ? tour.obj : orbit.lock;
  const clean = focus >= 0 ? focus : cam.focus;   // the object whose disc stays free of other labels (in free flight: the one the camera is centred on)
  const avoid = uiRects(), placed = [];
  const cand = [];
  const shipId = typeof ship !== 'undefined' ? ship.index : -1;
  OBJ.forEach((o, i) => {
    const el = labelEls[i];
    let pr = null;
    const zs = Math.max(orbit.dist, 1e-30);
    const inScale = o.marker ? (zs > o.labelMin && zs < o.labelRange && o.dist < zs*12) : (o.dist < o.labelRange && o.dist > (o.labelMin || 0) && (o.dist < zs*(o.layer < 3 ? 25 : 60) || (o.rpx > 6 && o.dist < zs*3000)));
    const thinAir = ATM.k > 0.3 && !o.parent && o !== sun && o.dist > 0.01;   // (near the ground, no labels for what the air hides)
    if (labelsOn && !thinAir && !o.noLabel && !o.hidden && !(o.magHide > 0.5) && (inScale || (o.mag > 1.5 && SYSMAG.k > 0.5)) && (!o.inRange || o.inRange()) && i !== shipId) pr = projectCSS(o.rel);
    if (pr){
      const rpx = o.rad*(o.solid && o.solid < 0.5 ? o.solid*1.3 : 1)*magOf(o)/(pr.z*tanY)*(viewHcss/2);
      let ok = pr.x > -40 && pr.x < innerWidth + 40 && pr.y > -20 && pr.y < innerHeight + 20 && (o.marker || rpx < viewHcss*0.3) && !(i === focus && rpx > 20);
      if (ok) cand.push({ i, el, pr, rpx:o.marker ? 0 : rpx, pri:(o.marker ? 1.5 : 0) + (o.layer < 3 ? 2 : 0) + (i === focus ? 3 : 0) + Math.log10(Math.max(rpx, 0.01)) + (o.labelPri || 0) });
    }
    el._show = false;
  });
  // named stars, at the scale where individual stars matter
  const starScale = labelsOn ? smooth(2.5, 8, orbit.dist)*(1 - smooth(2500, 6000, orbit.dist))*(1 - smooth(3000, 8000, V.len(sun.rel))) : 0;
  starEls.forEach(el => el._show = false);
  if (starScale > 0.5){
    STAR_LABELS.forEach((s, j) => { const rel = V.add(sun.rel, s.p), pr = projectCSS(rel); if (!pr) return;
      const f = Math.pow(10, -0.4*s.m)*V.dot(s.p, s.p)/Math.max(V.dot(rel, rel), 1e-12);
      if (f < 0.02) return;
      cand.push({ i:-1, el:starEls[j], pr, rpx:2, pri:-1 + Math.log10(f)*0.5 }); });
  }
  // places on Earth (0.13.0, owner: a natural way to come across the cities and landmarks without a search): famous places marked on the globe
  // once it is big on the screen, the five cities in 3D first (with a mark that says so), mountains and regions only closer; a click flies down
  earthMarks.forEach(m => { m.el._show = false; });
  if (labelsOn && FLAGS.realEarth && !SKYV.on && ATM.k < 0.3 && earth.rpx > 110 && !earth.hidden && !cmp){
    const RE = EARTH_R*KM;
    for (const m of earthMarks){
      if (m.min > earth.rpx) continue;
      const nw = M3.apply(earth.rot, m.u), rel = V.add(earth.rel, V.mul(nw, RE));
      if (V.dot(nw, rel) > -0.12*V.len(rel)) continue;   // (on the far side, or too near the edge of the disc)
      const pr = projectCSS(rel); if (!pr) continue;
      cand.push({ i:-2, el:m.el, pr, rpx:2, pri:m.pri, earthMark:true });
    }
  }
  // labels hide behind planets, stars and black holes that stand in front of them
  const occ = [];
  for (const o of OBJ){
    if (!(o.solid || o.holeR) || !o.onScreen || o.vis < 0.5) continue; const pr = projectCSS(o.rel); if (!pr) continue;
    const R = o.holeR || o.rad*o.solid*magOf(o), r = R/(pr.z*tanY)*(viewHcss/2); if (r > 3) occ.push({ x:pr.x, y:pr.y, r, z:pr.z, o, zf:o.holeR ? pr.z - R : pr.z*0.999, k:o.holeR ? 1.04 : 0.97 });
  }
  const hidden = c => occ.some(q => q.zf < c.pr.z && q.o.index !== c.i && Math.hypot(c.pr.x - q.x, c.pr.y - q.y) < q.r*q.k);
  // the object you are looking at stays clean: no other label may sit on top of it, not even its own parts (Sgr A* on the
  // Galactic Centre, a satellite over Earth). Only a big body visibly in front of it (a moon crossing a planet) keeps its label.
  let fd = null; const fo = clean >= 0 ? OBJ[clean] : null;
  if (fo && labelsOn){ const pr = projectCSS(fo.rel); if (pr){ const R = fo.holeR || fo.rad*(fo.solid || fo.labelDisc || 0.6); fd = { x:pr.x, y:pr.y, r:R/(pr.z*tanY)*(viewHcss/2), z:pr.z, R }; }
    else if (fo.dist < fo.rad) fd = { x:0, y:0, r:1e9, z:0, R:fo.rad }; }
  const overFocus = (c, lx, ly, w, h) => {
    if (!fd || c.i === clean || fd.r < 10 || c.earthMark) return false;   // (places on Earth belong on it)
    const oc = c.i >= 0 ? OBJ[c.i] : null;
    if (oc && !oc.marker && c.rpx > 12 && c.pr.z < fd.z - fd.R) return false;
    const nx = clamp(fd.x, lx, lx + w), ny = clamp(fd.y, ly, ly + h);
    return Math.hypot(nx - fd.x, ny - fd.y) < fd.r*0.95;
  };
  cand.sort((a, b) => b.pri - a.pri);
  for (const c of cand){
    if (occ.length && hidden(c)) continue;
    const w = c.el.offsetWidth || 80, h = 16, off = Math.max(c.rpx*0.72, 5);
    const lx = Math.min(c.pr.x + off, innerWidth - w - 8), ly = c.pr.y - off - 16;
    if (avoid.some(r => lx < r.right + 6 && lx + w > r.left - 6 && ly < r.bottom + 4 && ly + h > r.top - 4)) continue;
    if (overFocus(c, lx, ly, w, h)) continue;
    if (placed.some(p => lx < p.x + p.w + 6 && lx + w + 6 > p.x && ly < p.y + h && ly + h > p.y)) continue;
    if (placed.length > 31) break;
    placed.push({x:lx, y:ly, w}); c.el._show = true;
    c.el.style.transform = `translate3d(${lx.toFixed(1)}px, ${ly.toFixed(1)}px, 0)`;
  }
  // labels fade in and out (CSS) rather than popping
  for (const el of labelEls) if (el.classList.contains('on') !== el._show) el.classList.toggle('on', el._show);
  for (const el of starEls) if (el.classList.contains('on') !== el._show) el.classList.toggle('on', el._show);
  for (const m of earthMarks) if (m.el.classList.contains('on') !== m.el._show) m.el.classList.toggle('on', m.el._show);
}

function updateHUD(dt){
  roTimer -= dt;
  if (roTimer <= 0){
    roTimer = 0.15;
    if (HT.on || !$('#htLine').hidden){ syncHtInfo(); syncFlyby(); }   // (the Halo tour: the place it visits or goes to, and what the ship is doing)
    const o = OBJ[infoObj]; setReadout(o.readout ? o.readout() : '');
    let p = '', f = -1, tip = false, ang = false;
    // the angle line: during a swing it already shows the angle the camera is swinging to (so every tap on an arrow counts visibly), its bar still empty
    const bar = f => { const k = Math.round(f*18); return `[${'#'.repeat(k)}${'-'.repeat(18 - k)}]`; };
    if (tour.on){
      const obj = OBJ[tour.obj];
      if (tour.phase === 'fly') p = 'en route ' + '>'.repeat(1 + Math.floor(performance.now()/250) % 3);
      else { const L = tourViews(obj), sw = tour.phase === 'swing', cur = sw && tour.to != null ? tour.to : tour.view; f = sw ? 0 : clamp(tour.t/holdOf(obj.views[tour.view]), 0, 1);
        p = `angle ${Math.max(L.indexOf(cur), 0) + 1}/${L.length}  ${bar(f)}`; ang = L.length > 1; }
    } else if (show.on && OBJ[show.obj] && OBJ[show.obj].views.length > 1){
      const obj = OBJ[show.obj], n = obj.views.length, sw = show.phase === 'swing', cur = sw && show.to != null ? show.to : show.view; f = sw ? 0 : clamp(show.t/holdOf(obj.views[show.view]), 0, 1);
      p = `angle ${cur + 1}/${n}  ${bar(f)}`; ang = true;
    } else if (shipCam.on && shipCam.mode === 'chase' && typeof ship !== 'undefined'){
      // (riding along: on the Halo tour its stop and how long it stays, as a bar like the angles'; otherwise which camera, and the key)
      const S = S_, st = S.stay;
      if (HT.on && (S.phase === 'light' || S.phase === 'fold')) p = (S.phase === 'light' ? 'light speed ' : 'folding space ') + '>'.repeat(1 + Math.floor(performance.now()/250) % 3);
      else if (HT.on && htGoing()) p = 'setting course ' + '>'.repeat(1 + Math.floor(performance.now()/250) % 3);   // (the panel is on the next stop already)
      else if (HT.on && st){ f = clamp(st.t/st.dur, 0, 1); p = `${S.target.label || S.target.name} · ${HT.i + 1}/${HT.stops.length}  ${bar(f)}`; }
      else p = (SET.rideCam === 'still' ? 'still camera' : 'moving camera') + (isCompact() ? ' · drag to take over' : ' · K switches · drag to take over');
    } else if (orbit.lock >= 0 && !flight && isCompact() && !isPlaying()){ p = 'drag to turn · pinch to zoom · double-tap to centre'; tip = true; }   // (paused on a phone: the gestures)
    else if (orbit.lock >= 0 || flight) p = 'drag to orbit · scroll out to the edge of the universe';
    else { const b = backTarget(); p = 'W A S D to fly · ' + (b ? 'space goes back to ' + b.name : 'tap an object to lock on'); }
    const pl = $('#progLabel');
    if (pl.textContent !== p) pl.textContent = p;
    $('#progress').classList.toggle('hintish', !tour.on && f < 0 && !tip);
    $('#progress').classList.toggle('tip', tip);
    $('#progress').classList.toggle('angles', ang && !cmp && !shipCam.on);
    syncWhere(); syncStop(); syncGoNext();
    updateTourTrack();
    updateScale();
    syncSoundBtn();   // (the browser may let the music start, or stop it, at any moment)
    syncTickSizes();
  }
  updateLadder();
  updateLabels();
  updateShipFinder();
  updateBackPill(dt);
}

// ---------------------------------------------------------------- the ruler (top left): a bar whose length equals a real distance at the object you are looking at
const scaleBar = $('#scaleBar'), scaleTxt = $('#scaleTxt');
function fmtNum(x){ return x >= 1000 ? Math.round(x).toLocaleString('en-US') : (x >= 1 ? String(Math.round(x)) : String(+x.toPrecision(1))); }
function lenUnit(km){
  if (km >= 5e8*LY) return [km/(1e9*LY), 'billion light-years'];
  if (km >= 5e5*LY) return [km/(1e6*LY), 'million light-years'];
  if (km >= 0.02*LY) return [km/LY, 'light-years'];
  if (km >= 0.05*AU) return [km/AU, 'AU'];
  if (km < 1) return [km*1000, 'm'];
  return [km, 'km'];
}
function fmtLen(km, sig){ const [v, u] = lenUnit(km); const r = sig ? +v.toPrecision(sig) : v; const n = r >= 100 ? fmtNum(r) : +r.toPrecision(2); return n + ' ' + (n === 1 && u === 'light-years' ? 'light-year' : u); }
// km per light-year of world space around the viewed object (only a few objects draw their insides magnified)
function kmPerLy(){ const i = tour.on ? tour.obj : (orbit.lock >= 0 ? orbit.lock : -1), o = i >= 0 ? OBJ[i] : null; return o && o.scaleKm ? o.scaleKm(Math.max(orbit.dist, 1e-30)/o.rad) : LY; }
function updateScale(){
  // (on the Halo tour the panel shows the place, so the ruler measures at the place, not at the ship the camera rides with)
  const hp = htShowsPlace() ? OBJ[infoObj] : null, dist = Math.max(hp ? V.len(hp.rel) : orbit.dist, 1e-30);
  const targetPx = innerWidth < 680 ? 90 : 130;
  const km = targetPx*(2*tanY*dist/viewHcss)*(hp ? (hp.scaleKm ? hp.scaleKm(dist/hp.rad) : LY) : kmPerLy());
  const [val, unit] = lenUnit(km);
  const p = Math.pow(10, Math.floor(Math.log10(val))), m = val/p, nice = (m >= 5 ? 5 : m >= 2 ? 2 : 1)*p;
  scaleBar.style.width = (targetPx*nice/val).toFixed(0) + 'px';
  scaleTxt.textContent = '= ' + fmtNum(nice) + ' ' + (nice === 1 && unit === 'light-years' ? 'light-year' : unit);
}

// ---------------------------------------------------------------- scale ladder (right edge): powers of ten from the Moon to the observable universe
// each rung is anchored to a real object: clicking it (or letting go of the marker near it) flies there at that scale
const LADDER = [
  ['the Moon', 'moon', 6e-10], ['Earth', 'earth', 2.5e-9], ['Jupiter', 'jupiter', 2.5e-8], ['the Sun', 'sun', 3e-7],
  ['Sgr A* black hole', 'sgra', 2e-5], ['Betelgeuse', 'betelgeuse', 2e-4], ['Solar System', 'solarsystem', 1.6e-3],
  ['M87* black hole', 'm87bh', 2e-2], ['TON 618 black hole', 'ton618', 0.3], ['Oort cloud', 'oort', 3], ['Pillars of Creation', 'pillars', 12],
  ['Omega Centauri', 'omegacen', 250], ['Galactic Centre', 'galcentre', 1500], ['Magellanic Clouds', 'lmc', 5e4], ['Milky Way', 'milkyway', 2.5e5],
  ['Andromeda', 'andromeda', 9e5], ['Local Group', 'milkyway', 1.2e7], ['Virgo Cluster', 'm87', 6e7], ['Laniakea', 'cosmicweb', 5e8],
  ['cosmic web', 'cosmicweb', 3e9], ['observable universe', 'universe', 1.3e11],
].filter(([, k]) => BYKEY[k]).map(([name, key, d]) => ({ name, key, d }));
const LAD_LO = -9.6, LAD_HI = 11.4;
const ladTrack = $('#ladTrack'), ladMark = $('#ladMark'), ladTxt = $('#ladTxt');
const ladFrac = d => clamp((Math.log10(d) - LAD_LO)/(LAD_HI - LAD_LO), 0, 1);
const viewWidth = d => 2*tanX*d;   // width of the screen, in light-years, at camera distance d
LADDER.forEach(m => {
  const b = document.createElement('button'); b.className = 'tick'; b.textContent = m.name;
  b.style.top = ((1 - ladFrac(m.d))*100).toFixed(2) + '%';
  b.addEventListener('click', e => { e.stopPropagation(); goLadder(m); });
  b.addEventListener('pointerdown', e => e.stopPropagation());
  m.el = b; ladderEl.appendChild(b);
});
function ladTitles(){ LADDER.forEach(m => { m.el.title = `fly to ${m.name} · a view ${fmtLen(viewWidth(m.d)*LY)} wide`; m.el.setAttribute('aria-label', m.el.title); }); }
// every name on the ladder is 28 px tall to tap, or as tall as the gap to the next name where two sit closer, so none covers its neighbour's name
// (checked with the HUD, so it follows window and toolbar changes; the phone's ladder is measured when it opens)
let tickLadH = -1;
function syncTickSizes(){
  const H = ladderEl.getBoundingClientRect().height; if (!H || Math.abs(H - tickLadH) < 0.5) return; tickLadH = H;
  const ys = LADDER.map(m => (1 - ladFrac(m.d))*H);
  LADDER.forEach((m, i) => { const g = Math.min(i > 0 ? Math.abs(ys[i] - ys[i - 1]) : 99, i < ys.length - 1 ? Math.abs(ys[i + 1] - ys[i]) : 99); m.el.style.minHeight = Math.min(28, g).toFixed(1) + 'px'; });
}
function goLadder(m){
  const o = BYKEY[m.key]; if (!o) return;
  hideHint();
  if (tour.on) stopTour(false);
  const vp = viewParams(o, 0); vp.dist = Math.max(m.d, o.rad*o.minZoom*1.05); vp.off = [0, 0, 0]; vp.offFn = null;
  orbit.offFn = null;
  // the camera keeps moving on arrival: it starts at the chosen scale, then loops through the object's angles (pause stops it)
  show.on = false; show.pending = true; motion.last = 'show';
  setInfo(o.index); flyTo(o, vp, () => { if (show.pending) startShow(o.index, 0); }); updateModeUI();
  toast(m.name + ' · a view ' + fmtLen(viewWidth(vp.dist)*LY) + ' wide');
}
let ladDrag = null;
function ladDist(clientY){ const r = ladderEl.getBoundingClientRect(), f = clamp((clientY - r.top)/Math.max(r.height, 1), 0, 1); return Math.pow(10, LAD_HI - f*(LAD_HI - LAD_LO)); }
function ladNear(clientY){
  const r = ladderEl.getBoundingClientRect(); let best = null, bd = 13;
  for (const m of LADDER){ const y = r.top + (1 - ladFrac(m.d))*r.height, dd = Math.abs(y - clientY); if (dd < bd){ bd = dd; best = m; } }
  return best;
}
function ladMove(e){
  const near = ladNear(e.clientY), d = near ? near.d : ladDist(e.clientY);
  ladDrag.near = near; ladDrag.moved += Math.abs(e.clientY - ladDrag.y); ladDrag.y = e.clientY;
  LADDER.forEach(m => m.el.classList.toggle('near', m === near));
  const lo = orbit.lock >= 0 ? OBJ[orbit.lock].rad*OBJ[orbit.lock].minZoom : 1e-12;
  orbit.distT = clamp(d*LY/kmPerLy(), lo, MAX_DIST); zoomAt = performance.now();
}
function ladStart(e){
  if (e.button > 0) return;
  e.preventDefault(); ladderEl.setPointerCapture(e.pointerId);
  beginManual();
  ladDrag = { id:e.pointerId, near:null, moved:0, y:e.clientY, onMark:e.target === ladMark || ladMark.contains(e.target) };
  ladderEl.classList.add('dragging');
  ladMove(e);
}
function ladEnd(e){
  if (!ladDrag || e.pointerId !== ladDrag.id) return;
  const near = ladDrag.near;
  ladderEl.classList.remove('dragging'); LADDER.forEach(m => m.el.classList.remove('near'));
  ladDrag = null;
  if (near) goLadder(near);
}
ladTrack.addEventListener('pointerdown', ladStart);
ladMark.addEventListener('pointerdown', ladStart);
ladderEl.addEventListener('pointermove', e => { if (ladDrag && e.pointerId === ladDrag.id) ladMove(e); });
ladderEl.addEventListener('pointerup', ladEnd);
ladderEl.addEventListener('pointercancel', ladEnd);
ladMark.addEventListener('keydown', e => {
  if (e.key === 'ArrowUp' || e.key === 'ArrowDown'){ e.preventDefault(); e.stopPropagation(); beginManual(); zoomBy(e.key === 'ArrowUp' ? 1.9 : 1/1.9); }
});
function updateLadder(){
  if (ttShown) return;
  const eff = Math.max(orbit.dist, 1e-30)*kmPerLy()/LY;
  const shown = ladDrag && ladDrag.near ? ladDrag.near.d : eff;
  ladMark.style.top = ((1 - ladFrac(shown))*100).toFixed(2) + '%';
  const key = OBJ[infoObj].key;
  let hereM = ladDrag && ladDrag.near ? ladDrag.near : null;
  for (const m of LADDER){ const here = !ladDrag && m.key === key && Math.abs(Math.log10(eff/m.d)) < 0.35; if (here) hereM = m; if (m.el._here !== here){ m.el._here = here; m.el.classList.toggle('here', here); } }
  const txt = (hereM ? hereM.name + ' · ' : '') + fmtLen(viewWidth(shown)*LY, 2);
  if (ladTxt.textContent !== txt){ ladTxt.textContent = txt; ladMark.setAttribute('aria-valuetext', 'view ' + txt + ' wide'); }
}

// ---------------------------------------------------------------- while a tour plays, the ladder becomes the tour's track: every stop, where you are, how much is left
const tourTrack = document.createElement('div'); tourTrack.className = 'tour-track'; tourTrack.hidden = true; ladderEl.appendChild(tourTrack);
const ttFill = document.createElement('div'); ttFill.className = 'tt-fill'; tourTrack.appendChild(ttFill);
let ttId = null, ttTicks = [], ttShown = false;
function buildTourTrack(){
  ttTicks.forEach(t => t.remove()); ttTicks = []; ttId = TOUR_ID + ':' + TOUR_GEN;
  const n = TOUR.length;
  TOUR.forEach((oi, k) => {
    const b = document.createElement('button'); b.className = 'tick tt'; b.textContent = OBJ[oi].label || OBJ[oi].name;
    b.style.top = ((1 - (n > 1 ? k/(n - 1) : 0))*100).toFixed(2) + '%';
    b.title = `stop ${k + 1} of ${n} · ${OBJ[oi].name}`;
    b.addEventListener('click', e => { e.stopPropagation(); hideHint(); tween = null; if (flight) finishFlightHere(); if (!tour.on){ tour.on = true; } tourGo(oi); updateModeUI(); });
    b.addEventListener('pointerdown', e => e.stopPropagation());
    tourTrack.appendChild(b); ttTicks.push(b);
  });
}
function updateTourTrack(){
  const on = tour.on && TOUR.length > 1;
  if (on !== ttShown){ ttShown = on; ladderEl.classList.toggle('touring', on); tourTrack.hidden = !on; $('#ladCap').textContent = on ? 'tour' : 'view width'; }
  if (!on) return;
  if (ttId !== TOUR_ID + ':' + TOUR_GEN) buildTourTrack();   // (a new deal or a new screensaver shuffle has the same length but new names)
  const n = TOUR.length, k = Math.max(TOUR.indexOf(tour.obj), 0), o = OBJ[tour.obj];
  // progress through this stop's angles, so the fill creeps toward the next stop
  const L = tourViews(o), sub = tour.phase === 'fly' ? 0 : tour.phase === 'swing' ? Math.max(L.indexOf(tour.to != null ? tour.to : tour.view), 0)/L.length
    : (Math.max(L.indexOf(tour.view), 0) + clamp(tour.t/holdOf(o.views[tour.view]), 0, 1))/L.length;
  const f = (k + sub*0.999)/Math.max(n - 1, 1);
  ttFill.style.height = (clamp(f, 0, 1)*100).toFixed(2) + '%';
  $('#ladCap').textContent = `tour ${k + 1} / ${n}`;
  // with many stops only some names fit: always the current one, its neighbours, the ends, and an even spread
  const H = ladderEl.getBoundingClientRect().height, gap = H/Math.max(n - 1, 1), every = Math.max(1, Math.ceil(17/Math.max(gap, 1)));
  const th = Math.min(28, gap).toFixed(1) + 'px'; if (tourTrack.style.getPropertyValue('--tt-h') !== th) tourTrack.style.setProperty('--tt-h', th);   // (see syncTickSizes)
  ttTicks.forEach((b, j) => {
    const cls = 'tick tt' + (j < k ? ' done' : j === k ? ' here' : '') + ((j === k || Math.abs(j - k) === 1 || j === 0 || j === n - 1 || j % every === 0) ? '' : ' mute');
    if (b.className !== cls) b.className = cls;
  });
  ladMark.style.top = ((1 - clamp(f, 0, 1))*100).toFixed(2) + '%';
  const txt = o.label || o.name;
  if (ladTxt.textContent !== txt){ ladTxt.textContent = txt; ladMark.setAttribute('aria-valuetext', 'tour stop ' + (k + 1) + ' of ' + n); }
}

// ---------------------------------------------------------------- the Halo indicator (off unless the ship button is on): brackets around the Halo, or an arrow at the screen edge pointing to it
const shipMarkEl = $('#shipMark'), shipArrowEl = $('#shipArrow');
function updateShipFinder(){
  const s = typeof ship !== 'undefined' ? ship : null;
  let showM = false, showA = false;
  // (not on the Halo tour, owner 0.10.2: its shots are the place's, and the ship is in them anyway)
  if (s && SET.haloMark && s.S && s.S.target && !HT.on && !(orbit.lock === s.index && s.rpx > 40)){
    const W = innerWidth, H = innerHeight, dtxt = 'halo · ' + fmtLen(s.dist*LY);
    const pr = projectCSS(s.rel);
    if (pr && pr.x > 24 && pr.x < W - 24 && pr.y > 24 && pr.y < H - 24){
      const r = clamp(s.rad/(pr.z*tanY)*(viewHcss/2)*1.7, 11, 70);
      shipMarkEl.style.width = shipMarkEl.style.height = (2*r).toFixed(0) + 'px';
      shipMarkEl.style.transform = `translate3d(${(pr.x - r).toFixed(1)}px, ${(pr.y - r).toFixed(1)}px, 0)`;
      const sp = shipMarkEl.lastChild; if (sp.textContent !== dtxt) sp.textContent = dtxt;
      showM = true;
    } else { edgeArrow(shipArrowEl, s.rel, dtxt); showA = true; }
  }
  if (shipMarkEl.hidden === showM) shipMarkEl.hidden = !showM;
  if (shipArrowEl.hidden === showA) shipArrowEl.hidden = !showA;
}
// an arrow button at the edge of the screen, in the direction of something off screen (rel: relative to the camera), clear of the interface;
// its first child turns to point that way, its last child holds the text
function edgeArrow(el, rel, txt){
  const W = innerWidth, H = innerHeight;
  const x = V.dot(rel, cam.right)/tanX, y = V.dot(rel, cam.up)/tanY, z = V.dot(rel, cam.fwd);
  let dx = x*(z < 0 ? -1 : 1), dy = -y*(z < 0 ? -1 : 1);
  if (z < 0 && Math.hypot(dx, dy) < 1e-6*Math.abs(z)) dx = 1;
  const L = Math.hypot(dx*W, dy*H) || 1; dx = dx*W/L; dy = dy*H/L;
  const sp = el.lastChild; if (sp.textContent !== txt) sp.textContent = txt;
  const m = 40, cx = W/2, cy = H/2, t = Math.min((cx - m)/Math.max(Math.abs(dx), 1e-6), (cy - m)/Math.max(Math.abs(dy), 1e-6));
  const w = el.offsetWidth || 110, h = el.offsetHeight || 20;
  let ax = clamp(cx + dx*t - w/2, 8, W - w - 8), ay = clamp(cy + dy*t - h/2, 8, H - h - 8);
  const onSide = Math.abs(dx)*(cy - m) > Math.abs(dy)*(cx - m), avoid = uiRects();
  const clash = (x, y) => avoid.some(r => x < r.right + 6 && x + w > r.left - 6 && y < r.bottom + 6 && y + h > r.top - 6);
  for (let k=1; k<40 && clash(ax, ay); k++){
    const off = Math.ceil(k/2)*24*(k % 2 ? 1 : -1);
    const nx = onSide ? ax : clamp(cx + dx*t - w/2 + off, 8, W - w - 8), ny = onSide ? clamp(cy + dy*t - h/2 + off, 8, H - h - 8) : ay;
    if (!clash(nx, ny)){ ax = nx; ay = ny; break; }
  }
  el.style.transform = `translate3d(${ax.toFixed(1)}px, ${ay.toFixed(1)}px, 0)`;
  el.firstChild.style.transform = `rotate(${(Math.atan2(dy, dx)*180/Math.PI).toFixed(0)}deg)`;
}
// ---------------------------------------------------------------- in free camera: once the object you let go of has been off screen for 0.8 s,
// a pill at the edge of the screen points the way back to it ("› back to the Moon · 10,000 km"); tapping it flies back
const backPillEl = $('#backPill'); let backOffT = 0;
function updateBackPill(dt){
  const o = backTarget(); let on = false;
  if (o && !shipCam.on){
    const pr = projectCSS(o.rel), r = pr ? o.rad*(o.solid || 0.6)*magOf(o)/(pr.z*tanY)*(viewHcss/2) : 0;
    const seen = pr && pr.x > -r && pr.x < innerWidth + r && pr.y > -r && pr.y < innerHeight + r;
    backOffT = seen ? 0 : backOffT + dt;
    if (backOffT > 0.8){ edgeArrow(backPillEl, o.rel, 'back to ' + o.name + ' · ' + fmtLen(o.dist*LY, 2)); on = true; }
  } else backOffT = 0;
  if (backPillEl.hidden === on) backPillEl.hidden = !on;
}
backPillEl.addEventListener('click', () => { backPillEl.hidden = true; goBack(); });
// ride along with the Halo (chase camera); the flash when it folds space with you aboard
const followShip = () => { if (typeof ship === 'undefined') return; hideHint(); if (shipCam.on) return; startShipCam('chase'); toast(isCompact() ? 'riding along with the Halo · the place it visits in view' : 'riding along with the Halo · the place it visits in view (K holds the camera still, C for the cockpit)'); };
const foldEl = $('#foldFlash');
// (kinds: 'ls' the quicker, whiter flash of a jump to light speed; 'blink' a soft one; 'jump' / 'arrive' the fold's split second of white
// over the whole screen as it jumps, and the softer one as its heart arrives)
const FLASHES = ['ls', 'blink', 'jump', 'arrive'];
function foldFlash(kind){ foldEl.classList.remove('go', ...FLASHES); void foldEl.offsetWidth; foldEl.classList.add('go'); if (FLASHES.includes(kind)) foldEl.classList.add(kind); }
shipMarkEl.addEventListener('click', followShip);
shipArrowEl.addEventListener('click', followShip);

// ---------------------------------------------------------------- settings
function syncSettingsUI(){
  const v = { detail:SET.detailAuto ? 'auto' : String(detailIdx), travel:SET.travel, time:String(timeScale), dwell:SET.dwell, musicStyle:SET.musicStyle, saverIdle:String(SET.saverIdle), fadeUI:SET.fadeUI, rideCam:SET.rideCam };
  document.querySelectorAll('.seg[data-key]').forEach(seg => { const k = seg.dataset.key; seg.querySelectorAll('button').forEach(b => b.setAttribute('aria-checked', String(b.dataset.v === v[k]))); });
  settingsEl.querySelectorAll('.tog button').forEach(b => b.setAttribute('aria-pressed', String(!!SET[b.dataset.key])));
  $('#volume').value = SET.volume; $('#moodNote').textContent = 'plays ' + music.moodText(SET.musicStyle);
  syncSoundBtn(true);
  $('#textSize').value = SET.textSize; $('#tsTxt').textContent = Math.round(SET.textSize*100) + '%';
  $('#menuSize').value = SET.menuSize; $('#msTxt').textContent = Math.round(SET.menuSize*100) + '%';
  $('#detailInfo').textContent = (SET.detailAuto ? DETAIL[detailIdx].name + ' now · ' : '') + `${cols} x ${rows} characters`;
}
// the sound button shows whether music really plays: a soft red "sound off" (on phones "muted") while it is off,
// and also while the browser still holds it back before the first click, although the setting is on
let soundShown = '', soundSilentAtInput = false, soundHeard = false;
function syncSoundBtn(force){
  const on = SET.sound && music.audible, c = isCompact(), key = (on ? 'on' : 'off') + (c ? 'c' : 'd');
  // the first track's name shows when it can first be heard (not at load, while the browser still holds it back),
  // once the note the first click brought up has gone (it used to replace "riding along with the Halo..." at once)
  if (on && !soundHeard && !$('#toast').classList.contains('on')){ soundHeard = true; if (music.track) toast('♪ ' + music.track.name); }
  if (key === soundShown && !force) return; soundShown = key;
  const b = $('#btnSound');
  b.classList.toggle('silent', !on); b.setAttribute('aria-pressed', String(on));
  b.textContent = on ? 'sound' : (c ? 'muted' : 'sound off');
  b.title = on ? 'Music is on: click to turn it off (M)' : 'Music is off: click to turn it on (M)';
}
// the button and M do what the button showed when they were pressed: while it was red they start the music, never stop it
// (the press itself lets the browser start the music, so by the time of the click it may already be playing)
function toggleSound(){ if (soundSilentAtInput) setOpt('sound', true); else setOpt('sound', !SET.sound); soundSilentAtInput = false; }
function setOpt(key, v, quiet){
  switch (key){
    case 'detail':
      if (v === 'auto'){ SET.detailAuto = true; SET.detail = detailIdx = 1; Object.assign(AUTO_D, { up:0, slow:0, tries:0, off:autoDetailOff() }); adaptCount = 0; resize(); if (!quiet) toast('detail: auto · fine, and ultra when the screen is sharp and there is time to spare'); break; }
      SET.detailAuto = false; detailIdx = SET.detail = clamp(v | 0, 0, DETAIL.length - 1); adaptCount = 0; resize(); if (!quiet) toast(`detail: ${DETAIL[detailIdx].name} (${cols} x ${rows} characters)`); break;
    case 'travel': SET.travel = v; retimeFlight(); if (!quiet) toast('travel: ' + v + (v === 'warp' ? ' · near-instant' : v === 'cinematic' ? ' · slow and scenic' : '')); break;
    case 'time': timeScale = +v; if (!quiet) toast(timeScale ? 'time ' + timeScale + 'x' : 'time paused'); break;
    case 'glow': SET.glow = glowOn = !!v; break;
    case 'labels': SET.labels = labelsOn = !!v; break;
    case 'twinkle': SET.twinkle = !!v; break;
    case 'launchReal': SET.launchReal = !!v; break;
    case 'haloMark': SET.haloMark = !!v; if (!quiet) toast(v ? 'Halo indicator on · the ship is marked in blue (ride along from its card)' : 'Halo indicator off'); updateModeUI(); break;
    case 'sound': SET.sound = !!v; music.set(SET.sound); if (!quiet) toast(v ? 'music on' : 'music off'); break;
    case 'volume': SET.volume = clamp(+v, 0, 1); music.volume(); break;
    case 'musicStyle': SET.musicStyle = music.moods[v] ? v : 'mix'; music.styleChanged(); if (!quiet) toast('music: ' + SET.musicStyle + ' · ' + music.moodText(SET.musicStyle)); break;
    case 'saverIdle': SET.saverIdle = +v || 0; if (!quiet) toast(SET.saverIdle ? `screensaver starts after ${SET.saverIdle} minutes without input` : 'screensaver only when you ask (Z)'); break;
    case 'dwell': SET.dwell = v; if (!quiet) toast('tour stops: ' + v + (v === 'short' ? ' · quicker tour' : v === 'long' ? ' · lingers on each view' : '')); break;
    case 'textSize': SET.textSize = clamp(+v, 0.85, 1.6); applyTextSize(); break;
    case 'menuSize': SET.menuSize = clamp(+v, 0.9, 1.6); applyTextSize(); break;
    case 'rideCam': SET.rideCam = v === 'still' ? 'still' : 'moving'; if (!quiet) toast(SET.rideCam === 'still' ? 'still camera · it holds one angle over the Halo\'s shoulder, the place it visits in view (K)' : 'moving camera · it glides round the Halo from angle to angle (K)'); updateModeUI(); break;
    case 'fadeUI': SET.fadeUI = v; if (!quiet) toast(v === 'off' ? 'the interface stays put' : 'the interface fades ' + (v === 'quick' ? 'after a few seconds (sooner on tours)' : 'after a while') + ' · touch or move to bring it back'); break;
  }
  saveSet(); syncSettingsUI();
}
const cycle = (list, cur) => list[(list.indexOf(cur) + 1) % list.length];
let toggleSettings = on => { settingsEl.hidden = !on; $('#btnSettings').setAttribute('aria-expanded', String(on)); if (on) syncSettingsUI(); };
document.querySelectorAll('.seg[data-key] button').forEach(b => b.addEventListener('click', () => setOpt(b.parentElement.dataset.key, b.dataset.v)));
function applyTextSize(){ const r = document.documentElement.style; r.setProperty('--ts', String(SET.textSize)); r.setProperty('--tsm', String(+(SET.textSize*SET.menuSize).toFixed(3))); roLast = ''; if (!atlasEl.hidden){ fitAtlas(); fitSeenBar(); } }
applyTextSize();
$('#textSize').addEventListener('input', e => { setOpt('textSize', e.target.value, true); });
$('#menuSize').addEventListener('input', e => { setOpt('menuSize', e.target.value, true); });
settingsEl.querySelectorAll('.tog button').forEach(b => b.addEventListener('click', () => setOpt(b.dataset.key, !SET[b.dataset.key])));
$('#volume').addEventListener('input', e => setOpt('volume', e.target.value, true));
$('#btnSettings').addEventListener('click', () => toggleSettings(settingsEl.hidden));
$('#settingsClose').addEventListener('click', () => toggleSettings(false));

// ---------------------------------------------------------------- atlas and search
const atlasList = $('#atlasList'), searchEl = $('#search'), atlasSearch = $('#atlasSearch');
const GROUPS = [['solar', 'Solar System'], ['comets', 'Comets & meteors'], ['stars', 'Stars & stellar remnants'], ['worlds', 'Other worlds'], ['nebulae', 'Nebulae & star clusters'], ['galaxies', 'Galaxies & black holes'], ['cosmic', 'The large-scale universe'], ['travel', 'Travellers']];
// what the numbers under each heading measure: the Solar System and the comets from the Sun (so they climb outward, in the planets' order), the rest from Earth
const FROM_SUN = new Set(['solar', 'comets']);
// the kinds, in the order of the atlas grid ("all" across the top, then three to a row, near to far like the list, then the two kinds that cut
// across it): [id, the short name on its cell, the full name (many), one of them, the heading when it is the one kind shown]. Each object has one
// main kind, catOf (its group, or `atlasKind` when it is not what its group says: the S-stars are stars; black holes get their own, whatever group they
// are listed under), and its `tags` put it in more (catsOf): moons and small worlds, explosions and collisions, star clusters, human-made. With all
// kinds the headings list every object once, under its group. (Human-made matches the tag only, so the made-up Halo is not in it.)
const CATS = [['all', 'all', 'places', 'place', ''],
  ['solar', 'solar system', 'places in the Solar System', 'place in the Solar System', 'Solar System'], ['moons', 'moons & more', 'moons & small worlds', 'moon or small world', 'Moons & small worlds'], ['comets', 'comets', 'comets & meteors', 'comet or meteor shower', 'Comets & meteors'],
  ['stars', 'stars', 'stars & stellar remnants', 'star', 'Stars & stellar remnants'], ['worlds', 'other worlds', 'planets of other stars', 'planet of another star', 'Other worlds'], ['nebulae', 'nebulae', 'nebulae', 'nebula', 'Nebulae'],
  ['clusters', 'star clusters', 'star clusters', 'star cluster', 'Star clusters'], ['bh', 'black holes', 'black holes', 'black hole', 'Black holes'], ['galaxies', 'galaxies', 'galaxies', 'galaxy', 'Galaxies'],
  ['cosmic', 'universe', 'places in the universe at large', 'place in the universe at large', 'The universe at large'], ['events', 'explosions', 'explosions & collisions', 'explosion or collision', 'Explosions & collisions'], ['human', 'human-made', 'human-made craft', 'human-made craft', 'Human-made craft'],
  // (0.12.0: places on Earth, not objects of the atlas: famous mountains, regions, seas and cities, e7s-earth-search.js. Its cell spans the bottom of the grid)
  ['earth', 'on Earth', 'places on Earth', 'place on Earth', 'Places on Earth']];
// each kind's colour (0.12.0, owner: sections easier to tell apart): its cell, its heading and its rows' left edge (CSS: [data-k]). The groups'
// headings take the colour of their main kind
const GROUP_K = { solar:'solar', comets:'comets', stars:'stars', worlds:'worlds', nebulae:'nebulae', galaxies:'galaxies', cosmic:'cosmic', travel:'human' };
const catOf = o => o.atlasKind || ((o.prog === P.blackhole || o.isBH) ? 'bh' : o.group);
const catsOf = o => [catOf(o), ...(o.tags || [])];
// true size (radius in light-years): a black hole's event horizon, a star's surface, otherwise the object's extent
const atlasSize = o => o.prog === P.blackhole ? o.rad/20 : (o.sizeR || (o.starR ? o.starR*o.rad : o.rad*(o.solid || 0.6)));
const earthDist = o => o.key === 'earth' ? 0 : o.distNow ? o.distNow() : V.len(V.sub(o.pos, earth.pos));   // (distNow: drawn at a past moment, sorted by where it is now)
// from the Sun: where a comet is today (it is drawn where it was at its famous moment), anything else where it is drawn
const sunDist = o => o.elNow ? V.len(orbitTp(o.elNow, jdNow())) : V.len(V.sub(o.pos, sun.pos));
const sunAU = ly => { const r = ly/AU_LY; return (r < 0.1 ? r.toFixed(3) : r < 10 ? r.toFixed(2) : r < 100 ? r.toFixed(1) : Math.round(r).toLocaleString('en-US')) + ' AU'; };
const SEEN = new Set((() => { try { return JSON.parse(localStorage.getItem('gcdatlas.seen') || '[]'); } catch (e) { return []; } })());
// the view: sort (kind = grouped under the headings; distance, size and name = one list), its order, one kind or all, and "not seen yet" on top of it
const SORTS = ['kind', 'distance', 'size', 'name'];
const ATL_DEF = { sort:'kind', dir:1, cat:'all', unseen:false };
// the last choice is kept (gcdatlas.atlas). Saved before these controls (no v): the grouped default was "distance, nearest first",
// "not seen yet" was a chip of its own (now all + the box ticked) and human-made was the spacecraft chip ("travel")
const ATL = (() => {
  const a = Object.assign({}, ATL_DEF); let s = null;
  try { s = JSON.parse(localStorage.getItem('gcdatlas.atlas') || 'null'); } catch (e) {}
  if (!s || typeof s !== 'object') return a;
  let cat = s.cat, sort = s.sort, unseen = !!s.unseen;
  if (!s.v){ if (sort === 'distance' && s.dir !== -1 && (cat || 'all') === 'all') sort = 'kind'; if (cat === 'unseen'){ cat = 'all'; unseen = true; } }
  if (cat === 'travel') cat = 'human';
  a.cat = CATS.some(([id]) => id === cat) && (cat !== 'earth' || FLAGS.realEarth) ? cat : 'all';
  a.sort = SORTS.includes(sort) ? sort : 'kind';
  a.dir = s.dir === -1 ? -1 : 1;
  a.unseen = unseen;
  return a;
})();
const saveAtl = () => { try { localStorage.setItem('gcdatlas.atlas', JSON.stringify(Object.assign({ v:2 }, ATL))); } catch (e) {} };
// a badge in the tray can show exactly the places that count for it (planet hopper: the eight planets), when no kind is the same list: { name, keys }.
// It is not saved, and any kind, "all" or the reset ends it.
let badgePick = null;
const atlDefault = () => !badgePick && ATL.sort === ATL_DEF.sort && ATL.dir === ATL_DEF.dir && ATL.cat === ATL_DEF.cat && ATL.unseen === ATL_DEF.unseen;
const catMatch = r => (badgePick ? badgePick.keys.has(r.o.key) : ATL.cat === 'all' || r.cats.includes(ATL.cat)) && !(ATL.unseen && SEEN.has(r.o.key));
// the words for the order, as the list reads from the top: [ascending, descending]
const DIRW = { kind:['near → far', 'far → near'], distance:['near → far', 'far → near'], size:['small → big', 'big → small'], name:['A → Z', 'Z → A'] };
const dirWord = () => DIRW[ATL.sort][ATL.dir > 0 ? 0 : 1];
const NBSP = String.fromCharCode(160);

// catalogue numbers (Messier, NGC, IC) are one word whatever the spaces and case: "M 31", "messier 31" and "m31" are m31, "NGC224" is ngc224.
// In a search a number finds only the same whole number (m4 never finds m42 or m45); the other words match anywhere, as before.
// ("m1-67" and "q2237+030" are not catalogue numbers. No lookbehind: older Safari cannot parse it)
const CAT_RE = /(^|[^\w+\-\/.])(m|messier|ngc|ic)\s*(\d+[a-z]?)(?![\w+\-])/g;
function catSplit(s){
  const codes = [], rest = s.toLowerCase().replace(CAT_RE, (m, pre, p, n) => { codes.push((p === 'messier' ? 'm' : p) + n); return pre + ' '; });
  return { codes, words:rest.split(/\s+/).filter(Boolean) };
}
// two places in the atlas claiming one catalogue number (Messier, NGC, IC, or a Caldwell c number) in their aka: one of them is a duplicate.
// Only listed places count: a part (M87*, the Pillars) leaves its parent's number out, and a hidden piece (M32, M110) is found through the
// place that lists it. The smoke test and npm run catalog fail on any
function catClash(){
  const by = new Map();
  for (const o of OBJ) if (o.aka && o.atlas !== false && !o.marker && GROUPS.some(([g]) => g === o.group))
    for (const c of new Set([...catSplit(o.aka).codes, ...(o.aka.toLowerCase().match(/(?<![\w+\-\/.])c\d{1,3}(?![\w+\-])/g) || [])])) by.set(c, [...(by.get(c) || []), o.key]);
  return [...by].filter(([, ks]) => ks.length > 1).map(([c, ks]) => `${c} is in the aka of ${ks.join(', ')}`);
}
const atlasRows = [], groupHeads = {}, rowOfB = new Map();
let atlasOrder = [], atlasMoved = false;   // (the list as rendered; a catalogue number can move rows, and the next search puts them back)
const mkHead = (title, note) => { const h = document.createElement('div'); h.className = 'agroup'; h.innerHTML = '<span class="gt"></span><span class="gnote"></span>'; h.firstChild.textContent = title; h.lastChild.textContent = note; return h; };
GROUPS.forEach(([g, title]) => { groupHeads[g] = mkHead(title, FROM_SUN.has(g) ? 'from the Sun' : 'from Earth'); groupHeads[g].dataset.k = GROUP_K[g] || ''; });
// grouped with one kind chosen: one heading, the kind's name ("Galaxies"), and what its numbers measure
const kindHead = mkHead('', '');
// (one list by distance: the places we are inside have no one distance; they come last, under their own heading)
const aroundHead = mkHead('all around us', 'we are inside these');
OBJ.filter(o => o.atlas !== false && !o.marker && GROUPS.some(([g]) => g === o.group)).forEach(o => {
  const b = document.createElement('button'); b.className = 'arow'; b.setAttribute('role', 'option'); b.setAttribute('aria-selected', 'false');
  b.innerHTML = `<span class="an"></span><span class="ad"></span>`;
  b.querySelector('.an').textContent = o.name;
  b.title = o.type;
  b.addEventListener('click', () => { if (!trayEl.hidden) setBadgeTray(false); goTo(o.index); });
  // (a distance written out stays; any other is measured each time the atlas opens: things that move, like the Halo or JWST, are only placed on the first frame)
  const dfix = o.key === 'earth' ? 'home' : (o.atlasDist || (o.distEarth && o.distEarth.length < 14 ? o.distEarth : null));
  // (true size across, short: "93 billion ly"; the results line says "true size, across")
  // (codes: every catalogue number in its words; own: those in its aka, which come first: M87 before the M87 jet and M87*)
  const words = o.name + ' ' + (o.label || '') + ' ' + o.type + ' ' + (o.aka || '');
  const r = { b, o, cat:catOf(o), cats:catsOf(o), dfix, around:/^(here|all around)/.test(dfix || ''), stxt:fmtLen(2*atlasSize(o)*LY, 2).replace(/ light-years?$/, ' ly'), text:words.toLowerCase(),
    codes:new Set(catSplit(words).codes), own:new Set(catSplit(o.aka || '').codes) };
  atlasRows.push(r); rowOfB.set(b, r);
});
// moons sit under their planet in the Solar System heading ("└ Io"), measured from it
atlasRows.forEach(r => { const p = typeof r.o.parent === 'string' ? BYKEY[r.o.parent] : r.o.parent;
  r.par = r.o.group === 'solar' && p && p !== sun ? atlasRows.find(q => q.o === p && q.o.group === 'solar') || null : null; });
const catRows = {}; CATS.forEach(([id]) => { catRows[id] = id === 'all' ? atlasRows : atlasRows.filter(r => r.cats.includes(id)); });
// places on Earth (0.12.0, e7s-earth-search.js): a heading and six rows under the list, filled by each search from the names it fetches on the
// first one; a row flies down to its place
const earthHead = mkHead('on Earth', 'cities, mountains, regions, seas'); earthHead.dataset.k = 'earth';
function mkEarthRow(x){
  const b = document.createElement('button'); b.className = 'arow earth'; b.setAttribute('role', 'option'); b.setAttribute('aria-selected', 'false'); b.dataset.k = 'earth';
  b.innerHTML = `<span class="an"></span><span class="ad"></span>`;
  const r = { b, o:null, rank:0, earth:null, go:() => { const p = r.earth; if (!trayEl.hidden) setBadgeTray(false); hideHint(); clearSearch(); if (cmpPick){ cmpPick = false; atlasTitle(); } if (cmp) endCompare(true); EPL.go(p); } };
  r.set = p => { r.earth = p || null; if (p){ const [what, short] = EPL.about(p); b.firstChild.textContent = p[0]; b.lastChild.textContent = short; b.title = p[0] + ': ' + what; } };
  r.set(x); b.addEventListener('click', r.go); rowOfB.set(b, r); return r;
}
const earthRows = [...Array(6)].map(() => { const r = mkEarthRow(null); r.b.hidden = true; return r; });
// the "on Earth" kind's list: famous places under their own headings (built in, so it shows at once, before any names are fetched)
const EPICK_HEADS = { mountains:['Mountains', 'above the sea'], regions:['Deserts, ranges & regions', 'outline spans'], islands:['Islands', 'outline spans'], waters:['Seas & reefs', ''], wonders:['Built by people', ''], cities:['Cities', 'by people'] };
const earthPicks = FLAGS.realEarth ? Object.entries(EPL.PICKS).filter(([, list]) => list.length).map(([k, list]) => { const head = mkHead(EPICK_HEADS[k][0], EPICK_HEADS[k][1]); head.dataset.k = 'earth'; return { head, rows:list.map(mkEarthRow) }; }) : [];
const earthPickN = earthPicks.reduce((a, p) => a + p.rows.length, 0);
function earthFill(q){
  const res = q ? EPL.find(q) : [];
  earthRows.forEach((r, i) => { const x = res[i]; r.set(x); r.b.hidden = !x; r.b.classList.remove('kb'); });
  for (const p of earthPicks) for (const r of p.rows){ r.b.hidden = !!q; r.b.classList.remove('kb'); }
  return res.length;
}
// (the names arrive after the first letters are typed: the search runs again)
EPL.onLoad.push(() => { if (searchEl.value || atlasSearch.value) filterAtlas(searchEl.value || atlasSearch.value, true); });
const atlasEmpty = document.createElement('div'); atlasEmpty.className = 'atlas-empty'; atlasEmpty.innerHTML = '<div></div><button type="button"></button>';
const atlasEnd = Object.assign(document.createElement('div'), { className:'aend', textContent:'real positions and sizes' });

// the controls
const toolsEl = $('#atlasTools'), sortBtns = [...document.querySelectorAll('#atlasSort [data-sort]')], dirBtn = $('#atlasDir'), allBtn = $('#atlasAll'), unseenBtn = $('#atlasUnseen'), catGrid = $('#atlasCats');
const trayEl = $('#badgeTray'), seenBtn = $('#seenBtn'), atlasBody = $('#atlasBody');
const catBtns = CATS.filter(([id]) => id !== 'all' && catRows[id].length).map(([id, short, full]) => {
  const b = document.createElement('button'); b.className = 'cell'; b.setAttribute('role', 'radio'); b.dataset.cat = b.dataset.k = id; b.title = full[0].toUpperCase() + full.slice(1);
  b.innerHTML = '<span class="cl"></span><span class="n"></span>'; b.firstChild.textContent = short;
  b.addEventListener('click', () => pickCat(id, true));
  catGrid.appendChild(b); return b;
});
// (places on Earth, 0.12.0: a cell beside "all" at the top of the grid, so they can be found without a search; "all" spans the rest of the row)
const earthCell = earthPickN ? (() => { const b = document.createElement('button'); b.className = 'cell earthcell'; b.setAttribute('role', 'radio'); b.dataset.cat = b.dataset.k = 'earth';
  b.title = 'Places on Earth: mountains, deserts, islands, seas and cities. Search for any city, mountain or region by name';
  b.innerHTML = '<span class="cl">on Earth</span><span class="n"></span>';
  b.addEventListener('click', () => pickCat('earth', true)); allBtn.after(b); allBtn.classList.add('withearth'); return b; })() : null;
const kindBtns = [allBtn, ...catBtns, ...(earthCell ? [earthCell] : [])];   // (one radio group: "all" first, across the top of the grid)
const hadSearch = () => { const q = !!(searchEl.value || atlasSearch.value); if (q){ searchEl.value = atlasSearch.value = ''; } return q; };
// the list's scroller: the list itself, or in .flow the whole column under the head. After a new choice the list starts from its top
// (in .flow that shows the controls again, where the choice was made)
const atlasFlow = () => atlasEl.classList.contains('flow');
const atlasScroller = () => atlasFlow() ? atlasBody : atlasList;
function atlasTop(){ atlasList.scrollTop = 0; atlasBody.scrollTop = 0; }
// a kind: a second tap on the chosen one goes back to all (a tap while a search is typed clears the search and shows the kind)
function pickCat(id, toggle){ const q = hadSearch(); ATL.cat = toggle && !q && !badgePick && ATL.cat === id ? 'all' : id; badgePick = null; saveAtl(); renderAtlas(); atlasTop(); }
function setSort(s){ if (ATL.sort === s) return; ATL.sort = s; ATL.dir = s === 'size' ? -1 : 1; saveAtl(); renderAtlas(); atlasTop(); }   // (each sort starts in its natural order: size biggest first)
// from the badge tray: one kind (black hole hunter: the black holes), or just the places that count for the badge
function showKind(id, unseen, pick){ hadSearch(); ATL.cat = pick ? 'all' : id; badgePick = pick || null; ATL.unseen = unseen; saveAtl(); renderAtlas(); atlasTop(); }
sortBtns.forEach(b => b.addEventListener('click', () => setSort(b.dataset.sort)));
dirBtn.addEventListener('click', () => { ATL.dir = -ATL.dir; saveAtl(); renderAtlas(); atlasTop(); });
allBtn.addEventListener('click', () => pickCat('all'));
unseenBtn.addEventListener('click', () => { hadSearch(); ATL.unseen = !ATL.unseen; saveAtl(); renderAtlas(); atlasTop(); });
// the results line's button: "clear" while a search is typed, otherwise "reset" (back to the default view)
$('#atlasReset').addEventListener('click', () => {
  if (searchEl.value || atlasSearch.value){ searchEl.value = atlasSearch.value = ''; filterAtlas(''); atlasTop(); return; }
  Object.assign(ATL, ATL_DEF); badgePick = null; saveAtl(); renderAtlas(); atlasTop(); toast('atlas reset');
});
atlasEmpty.lastChild.addEventListener('click', () => {
  if (searchEl.value || atlasSearch.value){ searchEl.value = atlasSearch.value = ''; filterAtlas(''); }
  else if (ATL.unseen){ ATL.unseen = false; saveAtl(); renderAtlas(); }
  else pickCat('all');
  atlasTop();
});
// arrow keys move through a radio group and choose; Home and End jump to the ends. The sort is one row; in the kinds, "all" sits across the top
// of the grid (down or right from it goes to the first kind, up or left from the first row goes back to it)
function radioKeys(box, items, cols){
  box.addEventListener('keydown', e => {
    const L = items(), i = L.indexOf(document.activeElement); if (i < 0) return;
    const c = cols(), top = cols.top || 0, d = { ArrowRight:1, ArrowLeft:-1, ArrowDown:c, ArrowUp:-c }[e.key];
    let j = e.key === 'Home' ? 0 : e.key === 'End' ? L.length - 1 : d === undefined ? -1 : i + d;
    if (top && d !== undefined){ if (i < top) j = d > 0 ? top : i; else if (j < top) j = 0; }   // ("all")
    if (j < 0 && d === undefined) return;
    j = clamp(j, 0, L.length - 1);
    e.preventDefault(); e.stopPropagation();   // (the arrows would otherwise also turn the camera)
    if (j === i) return;
    L[j].focus(); L[j].click();
  });
}
radioKeys($('#atlasSort'), () => sortBtns, () => 1);
const kindCols = () => getComputedStyle(catGrid).gridTemplateColumns.split(' ').length; kindCols.top = 1;
radioKeys(catGrid, () => kindBtns, kindCols);
function syncAtlasTools(){
  sortBtns.forEach(b => { const on = b.dataset.sort === ATL.sort; b.setAttribute('aria-checked', String(on)); b.tabIndex = on ? 0 : -1; });
  const w = dirWord();
  dirBtn.lastChild.textContent = w;
  dirBtn.title = (ATL.sort === 'kind' ? 'Each group runs ' : 'The list runs ') + w.replace('→', 'to') + '. Click to reverse';
  dirBtn.setAttribute('aria-label', 'Order: ' + w.replace('→', 'to') + (ATL.sort === 'kind' ? ' in each group' : '') + '. Reverse it');
  // (a badge's own list checks no kind; the Tab key still lands on "all")
  kindBtns.forEach(b => b.setAttribute('aria-checked', String(!badgePick && b.dataset.cat === ATL.cat)));
  const tab = (!badgePick && kindBtns.find(b => b.dataset.cat === ATL.cat)) || allBtn; kindBtns.forEach(b => { b.tabIndex = b === tab ? 0 : -1; });
  unseenBtn.setAttribute('aria-checked', String(ATL.unseen)); unseenBtn.firstChild.textContent = ATL.unseen ? '[x]' : '[ ]';
  syncCatCounts();
}
// the counts on the cells: how many there are, or with "not seen yet" ticked how many are left to see (a green ✓ once there are none)
function syncCatCounts(){
  const left = rs => ATL.unseen ? rs.filter(r => !SEEN.has(r.o.key)).length : rs.length;
  const nAll = left(atlasRows); allBtn.lastChild.textContent = nAll;
  allBtn.setAttribute('aria-label', 'all places, ' + (ATL.unseen ? nAll + ' not seen yet' : nAll));
  catBtns.forEach(b => { const c = CATS.find(k => k[0] === b.dataset.cat), n = left(catRows[c[0]]), done = ATL.unseen && !n;
    b.lastChild.textContent = done ? '✓' : n; b.classList.toggle('done', done);
    b.setAttribute('aria-label', c[2] + ', ' + (done ? 'all seen' : ATL.unseen ? n + ' not seen yet' : n)); });
  if (earthCell){ earthCell.lastChild.textContent = earthPickN; earthCell.setAttribute('aria-label', 'places on Earth, ' + earthPickN); }
}
const rowDist = r => r.dfix || fmtDist(earthDist(r.o));
// grouped under the headings, the Solar System and the comets are measured from the Sun, and a moon from its planet
function rowSun(r){
  const k = r.o.key;
  if (r.par) return fmtDist(V.len(V.sub(r.o.pos, r.par.o.pos))) + ' from ' + r.par.o.name.replace(/^the /, '');
  if (k === 'sun') return 'centre';
  if (/ from the Sun$/.test(r.o.distEarth || '')) return r.o.distEarth.replace(/ from the Sun$/, '');   // (the Oort cloud: 2,000 to 100,000 AU)
  if (r.around) return r.dfix;
  const t = sunAU(sunDist(r.o));
  return k === 'earth' ? 'home · ' + t : t;
}
// the number on a row: its true size, or its distance, from the Sun (r.sun: grouped under a heading that measures from the Sun) or from Earth
const rowNum = r => ATL.sort === 'size' ? r.stxt : ATL.sort === 'kind' && r.sun ? rowSun(r) : rowDist(r);
// equal distances (a star and its planet, a galaxy and its black hole) keep the order the objects were given (sortKey)
const near = (ka, kb, a, b) => { const d = ka - kb; return Math.abs(d) > 2e-3*Math.max(Math.abs(ka), Math.abs(kb)) ? d : (a.o.sortKey ?? 0) - (b.o.sortKey ?? 0); };
// one heading's rows, sorted by the number they show so the column always climbs: from the Sun, the Solar System first, then the Sun, the planets
// outward with their moons under them, the Oort cloud last. A moon whose planet is not under the same heading sits where the planet would be.
function sectionRows(rows, fromSun){
  const inSet = new Set(rows), lone = r => r.par && !inSet.has(r.par) ? r.par : null;
  const key = r => fromSun ? ({ solarsystem:-2, sun:-1, oort:1e30 }[r.o.key] ?? sunDist(r.o)) : r.around ? -1 : earthDist(r.o);
  const moonD = r => V.len(V.sub(r.o.pos, r.par.o.pos));
  const top = rows.filter(r => !r.par || lone(r)), ks = new Map(top.map(r => [r, key(lone(r) || r)])), out = [];
  top.sort((a, b) => (lone(a) && lone(a) === lone(b) ? moonD(a) - moonD(b) : near(ks.get(a), ks.get(b), a, b))*ATL.dir);
  top.forEach(r => { out.push(r); r.branch = false; const kids = rows.filter(q => q.par === r), kd = new Map(kids.map(q => [q, moonD(q)]));
    kids.sort((a, b) => (kd.get(a) - kd.get(b))*ATL.dir); kids.forEach(q => { q.branch = true; }); out.push(...kids); });
  return out;
}
function flatRows(){
  const rows = atlasRows.slice();
  if (ATL.sort === 'name') return rows.sort((a, b) => a.o.name.replace(/^the /i, '').localeCompare(b.o.name.replace(/^the /i, ''))*ATL.dir);
  const key = ATL.sort === 'size' ? r => atlasSize(r.o) : r => earthDist(r.o), ks = new Map(rows.map(r => [r, key(r)]));
  return rows.sort((a, b) => near(ks.get(a), ks.get(b), a, b)*ATL.dir);
}
// every row is in the list (a search looks through everything); the kind and "not seen yet" hide the others.
// Grouped: with all kinds, one heading per group; with one kind, its places first under one heading named after it ("Galaxies · from Earth"),
// then the rest under their groups for a search. One list by distance: the places we are inside come last, under "all around us".
function renderAtlas(){
  syncAtlasTools();
  atlasRows.forEach(r => { r.shown = catMatch(r); r.b.classList.toggle('seen', SEEN.has(r.o.key)); r.branch = false; r.sun = false; });
  atlasList.textContent = '';
  const put = (h, rows) => { if (!rows.length) return; if (h) atlasList.appendChild(h); rows.forEach(r => atlasList.appendChild(r.b)); };
  if (ATL.sort === 'kind'){
    const one = ATL.cat !== 'all' && !badgePick ? catRows[ATL.cat] : [], mine = new Set(one);
    if (one.length){
      const sun = one.every(r => FROM_SUN.has(r.o.group)), c = CATS.find(k => k[0] === ATL.cat);
      kindHead.firstChild.textContent = c[4]; kindHead.lastChild.textContent = sun ? 'from the Sun' : 'from Earth';
      one.forEach(r => { r.sun = sun; }); put(kindHead, sectionRows(one, sun));
    }
    GROUPS.forEach(([g]) => { const sun = FROM_SUN.has(g), gr = atlasRows.filter(r => r.o.group === g && !mine.has(r)); gr.forEach(r => { r.sun = sun; }); put(groupHeads[g], sectionRows(gr, sun)); });
  } else {
    const rows = flatRows(), pin = ATL.sort === 'distance';
    put(null, pin ? rows.filter(r => !r.around) : rows);
    if (pin) put(aroundHead, rows.filter(r => r.around));
  }
  atlasRows.forEach(r => { r.b.querySelector('.ad').textContent = rowNum(r); });
  // (the colours: one kind chosen, its colour on every row; otherwise each row its own main kind's)
  const oneK = ATL.cat !== 'all' && ATL.cat !== 'earth' && !badgePick ? ATL.cat : null;
  atlasRows.forEach(r => { r.b.dataset.k = oneK || r.cat; });
  kindHead.dataset.k = oneK || '';
  if (ATL.cat === 'earth' && !badgePick) atlasList.prepend(...earthPicks.flatMap(p => [p.head, ...p.rows.map(r => r.b)]));
  atlasList.append(earthHead, ...earthRows.map(r => r.b), atlasEmpty, atlasEnd);
  atlasOrder = [...atlasList.children]; atlasMoved = false;
  filterAtlas(searchEl.value, true);
  atlasMark(infoObj);
}
let kbRow = -1;
// keep a row in sight in the list's scroller (under the headings and the results line that stay at its top)
function keepInView(b){
  const sc = atlasScroller(), sr = sc.getBoundingClientRect(), br = b.getBoundingClientRect(), top = sr.top + (parseFloat(getComputedStyle(b).scrollMarginTop) || 0);
  if (br.top < top || br.bottom > sr.bottom) b.scrollIntoView({ block:'nearest' });
}
function atlasMark(i){
  let cur = null;
  atlasRows.forEach(r => { const on = r.o.index === i; r.b.setAttribute('aria-selected', String(on)); if (on) cur = r; });
  if (cur && !atlasEl.hidden && !cur.b.hidden && cur.b.isConnected) keepInView(cur.b);
}
function visibleRows(){ return [...atlasList.querySelectorAll('.arow')].filter(b => !b.hidden).map(b => rowOfB.get(b)); }
// the keyboard's row while a search is typed (arrow keys, Enter); none otherwise, so no row looks chosen but the object in view
function setKb(k){
  atlasRows.forEach(r => r.b.classList.remove('kb')); earthRows.forEach(r => r.b.classList.remove('kb')); earthPicks.forEach(p => p.rows.forEach(r => r.b.classList.remove('kb')));
  if (k < 0){ kbRow = -1; return; }
  const vis = visibleRows();
  kbRow = vis.length ? clamp(k, 0, vis.length - 1) : -1;
  if (kbRow >= 0){ vis[kbRow].b.classList.add('kb'); keepInView(vis[kbRow].b); }
}
// one column that scrolls (.flow), or the controls beside or above the list: a phone held upright always flows; elsewhere it flows only when the
// list would be squeezed (narrower than 30 characters or 240 px, or under 6 rows tall) or the controls would not fit their pane. Measured when the
// atlas opens, on resize and when the menu text changes.
// (the search boxes' hint, the longest that fits: since 0.12.0 it says places on Earth can be found too)
function searchHint(el, fs, pad = 16){
  const room = el.clientWidth - pad, opts = FLAGS.realEarth ? ['search the universe or a place on Earth', 'search space or Earth', 'search the universe', 'search'] : ['search the universe', 'search'];
  return opts.find(t => room >= t.length*0.6*fs) || 'search';
}
const fitTopSearch = () => { if (searchEl.clientWidth) searchEl.placeholder = searchHint(searchEl, parseFloat(getComputedStyle(searchEl).fontSize) || 12, 22 + (searchEl.nextElementSibling ? searchEl.nextElementSibling.offsetWidth : 0)); };
addEventListener('resize', fitTopSearch); requestAnimationFrame(fitTopSearch);
const ATLAS_UP_MQ = matchMedia('(max-width:680px) and (min-height:521px)');
function fitAtlas(){
  if (atlasEl.hidden) return;
  // (the phone's search box says "search the universe" when that fits, "search" with big menu text)
  const fs = parseFloat(getComputedStyle(atlasSearch).fontSize) || 12;
  atlasSearch.placeholder = searchHint(atlasSearch, fs);
  const was = atlasFlow();
  if (ATLAS_UP_MQ.matches){ atlasEl.classList.add('flow'); if (!was) atlasTop(); return; }
  atlasEl.classList.remove('flow');
  const vr = atlasList.querySelector('.arow:not([hidden])'), l = atlasList.getBoundingClientRect(), row = (vr && vr.getBoundingClientRect().height) || 28;
  const ch = 0.6*(parseFloat(getComputedStyle(atlasRows[0].b).fontSize) || 14);   // (the width of a character in a row)
  const flow = l.width < Math.max(240, 30*ch) || l.height < 6*row || toolsEl.scrollHeight > toolsEl.clientHeight + 1;
  atlasEl.classList.toggle('flow', flow);
  if (flow !== was) atlasTop();
}
addEventListener('resize', () => { if (!atlasEl.hidden){ fitAtlas(); fitSeenBar(); } });
// the results line's height: in .flow the headings stick just under it
new ResizeObserver(() => { atlasEl.style.setProperty('--rh', $('#atlasResult').offsetHeight + 'px'); }).observe($('#atlasResult'));
function toggleAtlas(on){
  atlasEl.hidden = !on; document.body.classList.toggle('atlas-open', on); $('#btnAtlas').setAttribute('aria-expanded', String(on));   // (the scale bar hides while it is open)
  if (on && document.body.classList.contains('lad-open')) setLadOpen(false);   // (on a phone the ladder folds away)
  if (on){ fitAtlas(); renderAtlas(); fitSeenBar();   // (distances are measured again each time it opens: things move)
    // (it opens with the controls in sight in .flow; beside or above the list, the list centres the object in view)
    const cur = atlasRows.find(r => r.o.index === infoObj);
    if (atlasFlow() || searchEl.value) atlasTop(); else if (cur && !cur.b.hidden) cur.b.scrollIntoView({ block:'center' }); }
  else { atlasRows.forEach(r => r.b.classList.remove('kb')); kbRow = -1; if (!trayEl.hidden) setBadgeTray(false); }
}
// show the rows that match (the search, or the kind and "not seen yet"); the headings with none hide. keep: a new render, not a new search
function filterAtlas(q, keep){
  q = q.trim().toLowerCase(); const t = q ? catSplit(q) : null;
  if (atlasMoved){ atlasList.append(...atlasOrder); atlasMoved = false; }
  // (rank 0: every catalogue number searched for is the place's own, in its aka; a search without one ranks every row 0)
  atlasRows.forEach(r => { r.rank = t && !t.codes.every(c => r.own.has(c)) ? 1 : 0;
    r.b.hidden = t ? !(t.codes.every(c => r.codes.has(c)) && t.words.every(w => r.text.includes(w))) : !r.shown; });
  if (t && t.codes.length) rankRows();
  // (places on Earth go first when no name in the atlas starts with the words typed: "paris" lists Paris before anything with "paris" in its notes)
  if (earthFill(q) && !t.codes.length){ const starts = r => !r.b.hidden && (r.o.name.toLowerCase().replace(/^the /, '').startsWith(q) || (r.o.label || '').toLowerCase().startsWith(q));
    if (!atlasRows.some(starts)){ atlasList.prepend(earthHead, ...earthRows.map(r => r.b)); atlasMoved = true; } }
  atlasRows.forEach(r => r.b.classList.toggle('child', r.branch && !r.par.b.hidden));
  atlasList.querySelectorAll('.agroup').forEach(h => { let x = h.nextElementSibling, any = false; while (x && !x.classList.contains('agroup')){ if (x.classList.contains('arow') && !x.hidden) any = true; x = x.nextElementSibling; } h.hidden = !any; });
  atlasCountNow(q);
  setKb(q ? Math.max(0, visibleRows().findIndex(r => !r.rank)) : -1);
  // (in .flow a search shows its results at the top, above the keyboard: the controls scroll away)
  if (q && !keep && atlasFlow()) atlasBody.scrollTop = toolsEl.offsetHeight;
}
// a catalogue number puts the places whose own number it is first under their heading (M87, then the M87 jet and M87*); the keyboard's row
// starts on the first of them
function rankRows(){
  let head = null, sec = [];
  const flush = () => { const v = sec.filter(r => !r.b.hidden);
    if (v.some(r => r.rank) && v.some(r => !r.rank)){ const s = v.filter(r => !r.rank).map(r => r.b); if (head) head.after(...s); else atlasList.prepend(...s); atlasMoved = true; }
    sec = []; };
  for (const e of [...atlasList.children]){ if (e.classList.contains('agroup')){ flush(); head = e; } else if (rowOfB.has(e)) sec.push(rowOfB.get(e)); }
  flush();
}
// the count in the results line and the head: the rows that match now (a place just seen stays in the list, with its ✓, until the next change,
// but no longer counts as not seen yet)
function atlasCountNow(q){
  q = (q ?? searchEl.value).trim().toLowerCase();
  const n = atlasRows.filter(r => !r.b.hidden && (q || catMatch(r))).length + (q ? earthRows.filter(r => !r.b.hidden).length : ATL.cat === 'earth' && !badgePick ? earthPickN : 0);
  atlasSummary(n, q);
}
// the results line says what the list shows, in words ("19 galaxies not seen yet · near → far", "from Earth"), and holds the only reset.
// The default view (grouped by kind, everything) has none. A screen reader hears the same words.
let atlasSaid = '';
function atlasSummary(n, q){
  const total = atlasRows.length, def = atlDefault(), c = CATS.find(k => k[0] === ATL.cat), res = $('#atlasResult');
  const onEarth = ATL.cat === 'earth' && !badgePick && !q;
  $('#atlasCount').textContent = onEarth ? `${n} on Earth` : q || n < total ? `${n} of ${total}` : `${total} places`;
  toolsEl.classList.toggle('searching', !!q);
  let txt, note = '';
  // (a badge's own list: "5 places not seen yet for planet hopper")
  const what = k => badgePick ? (k === 1 ? 'place' : 'places') : k === 1 ? c[3] : c[2], forB = badgePick ? ' for ' + badgePick.name : '';
  if (q) txt = n ? `${n} found · searching all ${total}` : `nothing found for "${q}"`;
  else {
    txt = onEarth ? `${n} famous places on Earth · search for any city or mountain` : `${n} ${what(n)}${ATL.unseen ? ' not seen yet' : ''}${forB}` + (ATL.sort === 'kind' ? (ATL.dir > 0 ? '' : ' · far → near in each group') : ' · ' + dirWord());
    note = onEarth || ATL.sort === 'kind' ? '' : ATL.sort === 'size' ? 'true size, across' : 'from Earth';
  }
  res.hidden = !q && def;
  $('#atlasResultTxt').textContent = txt.replace(/ → /g, NBSP + '→' + NBSP); $('#atlasResultNote').textContent = note;   // ("near → far" never breaks)
  $('#atlasReset').textContent = q ? 'clear' : 'reset';
  $('#atlasReset').title = q ? 'Clear the search' : 'Back to the default view';
  // nothing to show: say why, with a button that gets out of it
  atlasEmpty.hidden = n > 0;
  if (!n){
    const all = badgePick ? atlasRows.filter(r => badgePick.keys.has(r.o.key)).length : catRows[ATL.cat].length;
    const [t, b] = q ? [EPL.can ? 'nothing found · try a planet, star, galaxy or a place on Earth' : 'nothing found · try a planet, star, nebula or galaxy', 'clear the search']
      : ATL.unseen ? [`you have seen all ${all} ${what(all)}${forB} ✓`, 'show them all'] : ['nothing here', 'show everything'];
    atlasEmpty.firstChild.textContent = t; atlasEmpty.lastChild.textContent = b;
  }
  const say = res.hidden ? `${total} places, grouped by kind` : txt + (note ? ', measured ' + note : '');
  if (say !== atlasSaid){ atlasSaid = say; $('#atlasLive').textContent = say.replace(/→/g, 'to'); }
}
// the collection footer's ASCII bar takes the room the words leave (and hides when that is under six characters)
function fitSeenBar(){
  const bar = $('#seenBar'); if (atlasEl.hidden) return;
  bar.textContent = '';
  const w = bar.getBoundingClientRect().width, cw = parseFloat(getComputedStyle(bar).fontSize)*0.6, k = Math.min(20, Math.floor(w/cw) - 2);
  if (!(k >= 6)) return;
  const have = atlasRows.filter(r => SEEN.has(r.o.key)).length, total = atlasRows.length;
  let on = Math.round(have/total*k); if (have && !on) on = 1; if (have < total) on = Math.min(on, k - 1);
  bar.textContent = '[' + '#'.repeat(on) + '-'.repeat(k - on) + ']';
}
// the badge tray slides up over the bottom of the list; the footer, its close button and Esc close it (focus goes back to the footer)
function setBadgeTray(on, focus){
  trayEl.hidden = !on; seenBtn.setAttribute('aria-expanded', String(on));
  if (on) $('#badgeTrayClose').focus({ preventScroll:true }); else if (focus) seenBtn.focus({ preventScroll:true });
}
seenBtn.addEventListener('click', () => setBadgeTray(trayEl.hidden, !trayEl.hidden));
$('#badgeTrayClose').addEventListener('click', () => setBadgeTray(false, true));
renderAtlas();
function onSearchInput(e){
  const v = e.target.value; if (e.target === searchEl) atlasSearch.value = v; else searchEl.value = v;
  if (atlasEl.hidden) toggleAtlas(true);
  filterAtlas(v);
}
function onSearchKey(e){
  const vis = visibleRows();
  if (e.key === 'ArrowDown'){ e.preventDefault(); setKb(kbRow + 1); }
  else if (e.key === 'ArrowUp'){ e.preventDefault(); setKb(Math.max(0, kbRow - 1)); }
  else if (e.key === 'Enter'){ const r = vis[kbRow >= 0 ? kbRow : 0]; if (r) r.go ? r.go() : goTo(r.o.index); }
  else if (e.key === 'Escape'){ e.preventDefault(); e.stopPropagation(); closeAtlas(); }   // (Esc in the search box closes the search, never lets go of the object)
}
// empty both search boxes (after a pick, or when the search closes), and give the keys back to the page
function clearSearch(){
  const a = document.activeElement; if (a === searchEl || a === atlasSearch) canvas.focus({ preventScroll:true });
  if (!searchEl.value && !atlasSearch.value) return;
  searchEl.value = atlasSearch.value = ''; filterAtlas('');
}
function closeAtlas(){ clearSearch(); toggleAtlas(false); if (cmpPick){ cmpPick = false; atlasTitle(); } }
// Esc closes what is open first, and lets go of the object only when nothing is (people press it to close a panel)
function closeOpen(){
  const b = document.body.classList;
  if (b.contains('photo')){ stopPhoto(); return true; }
  if (!$('#story').hidden){ closeStory(); return true; }
  if (!settingsEl.hidden || !$('#tours').hidden || !$('#timem').hidden){ togglePanel(null, false); return true; }
  if (!atlasEl.hidden){ if (!trayEl.hidden) setBadgeTray(false, true); else closeAtlas(); return true; }   // (the badge tray first, then the atlas)
  if (b.contains('lad-open')){ setLadOpen(false); return true; }
  if (!shipMenuEl.hidden){ setShipMenu(false); return true; }
  return false;
}
for (const el of [searchEl, atlasSearch]){ el.addEventListener('input', onSearchInput); el.addEventListener('keydown', onSearchKey); }
searchEl.addEventListener('focus', () => { hideHint(); if (atlasEl.hidden) toggleAtlas(true); });
$('#btnAtlas').addEventListener('click', () => toggleAtlas(atlasEl.hidden));
$('#atlasClose').addEventListener('click', () => { toggleAtlas(false); if (cmpPick){ cmpPick = false; atlasTitle(); } });
function focusSearch(){ if (IS_SMALL || getComputedStyle(searchEl.parentElement).display === 'none'){ toggleAtlas(true); atlasSearch.focus({ preventScroll:true }); } else searchEl.focus({ preventScroll:true }); }

// the arrows on the angle line (each tap moves one angle, also mid-swing); the green button beside the name; the tour's name opens the tours
$('#prevObj').addEventListener('click', () => { hideHint(); stepAngle(-1); roTimer = 0; });
$('#nextObj').addEventListener('click', () => { hideHint(); stepAngle(1); roTimer = 0; });
$('#goNext').addEventListener('click', goNextClick);
$('#modeTour').addEventListener('click', () => { hideHint(); togglePanel('tours', $('#tours').hidden); });
$('#btnTour').addEventListener('click', () => { hideHint(); if (tour.on) stopTour(false); else setTour(true); });   // (pausing here remembers the stop, like the pause button: the green button then goes on from it)
$('#btnFree').addEventListener('click', () => { hideHint(); unlock(); toast(isCompact() ? 'free camera · drag to look around · ⌂ for home' : 'free camera · W A S D to fly, drag to look around · H for home'); });
$('#btnShip').addEventListener('click', () => { if (isCompact()) setShipMenu(shipMenuEl.hidden); else setOpt('haloMark', !SET.haloMark); });
const toggleRide = () => { if (shipCam.on || (shipCam.pending && flight)){ if (flight) finishFlightHere(); shipCam.pending = false; stopShipCam(); haloTourEnd(true); toast('stopped riding · the camera stays with the Halo'); updateModeUI(); } else followShip(); };
// phones: the dock's ship button opens a small menu over the dock (ride along, cockpit, the marker; while riding: chase, cockpit, stop).
// Any choice closes it, and so does a tap anywhere else, Esc, or the layout changing to a desk's.
const isRiding = () => shipCam.on || (shipCam.pending && !!flight);
function setShipMenu(on){ shipMenuEl.hidden = !on; $('#btnShip').setAttribute('aria-expanded', String(on)); if (on){ syncShipMenu(); wakeUI(); } }
function syncShipMenu(){
  const r = isRiding();
  $('#smChase').firstChild.textContent = r ? 'outside' : 'ride along';
  $('#smChase').setAttribute('aria-checked', String(r && shipCam.mode === 'chase'));
  $('#smCock').setAttribute('aria-checked', String(r && shipCam.mode === 'cockpit'));
  $('#smStop').hidden = !r; $('#smMark').hidden = r;
  $('#smChase').lastChild.textContent = r ? 'place in view' : 'and see where';
  $('#smTour').setAttribute('aria-checked', String(HT.on)); $('#smTour small').textContent = HT.on ? htTour().name : 'it flies a tour';   // (a switch: its pill says on or off)
  $('#smStill').hidden = !(r && shipCam.mode === 'chase'); $('#smStill').setAttribute('aria-checked', String(SET.rideCam === 'still')); $('#smStill').lastChild.textContent = SET.rideCam === 'still' ? 'still' : 'moving';
  $('#smMark').setAttribute('aria-checked', String(!!SET.haloMark)); $('#smMark').lastChild.textContent = SET.haloMark ? 'hide it' : 'show it';
}
const rideAs = m => { setShipMenu(false); if (typeof ship === 'undefined') return; hideHint(); if (isRiding()) setShipCamMode(m); else { startShipCam(m); toast(m === 'cockpit' ? 'riding along · on the bridge of the Halo' : 'riding along with the Halo · tap ship for the cockpit'); } };
$('#smChase').addEventListener('click', () => rideAs('chase'));
$('#smCock').addEventListener('click', () => rideAs('cockpit'));
$('#smStop').addEventListener('click', () => { setShipMenu(false); if (isRiding()) toggleRide(); });
$('#smMark').addEventListener('click', () => { setShipMenu(false); setOpt('haloMark', !SET.haloMark); });
$('#smTour').addEventListener('click', () => { setShipMenu(false); hideHint(); if (HT.on) haloTourEnd(); else haloTourStart(TOUR_ID); });
$('#smStill').addEventListener('click', () => { setShipMenu(false); setOpt('rideCam', SET.rideCam === 'still' ? 'moving' : 'still'); });
addEventListener('pointerdown', e => { if (!shipMenuEl.hidden && !(e.target.closest && e.target.closest('#shipMenu, #btnShip'))) setShipMenu(false); }, { capture:true });
COMPACT_MQ.addEventListener('change', () => { if (!isCompact()) setShipMenu(false); });
$('#btnRide').addEventListener('click', toggleRide);
$('#btnRideI').addEventListener('click', toggleRide);
$('#btnCamI').addEventListener('click', () => setShipCamMode(shipCam.mode === 'chase' ? 'cockpit' : 'chase'));
function playFlyby(o){
  hideHint(); if (cmp) endCompare(false);
  stopTour(false); tween = null; flyMove = null; if (show.on || show.pending){ show.on = show.pending = false; motion.last = 'show'; }
  setInfo(o.index);
  startFlight(o, viewParamsV(o, o.flyby), () => { flyMove = { o, v:o.flyby, t:0 }; });
  updateModeUI(); toast('flyby · ' + o.flyby.flyby);
}
$('#btnFlyby').addEventListener('click', () => { const o = OBJ[infoObj]; if (o.flyby) playFlyby(o); });
music.onTrack = tr => { $('#nowPlaying').textContent = tr.name; syncSongs(); if (SET.sound && music.audible) toast('\u266a ' + tr.name); };   // (no track name while the browser still holds the music back)
$('#npSkip').addEventListener('click', () => { music.skip(); if (!SET.sound) toast('music is off · turn it on to hear the next track'); });
// the song list in the settings: every song by style, with its length; a click plays it now (and turns the music on)
const songListEl = $('#songList'), songLen = s => { s = Math.round(s); return Math.floor(s/60) + ':' + String(s % 60).padStart(2, '0'); };
const songsLabel = () => { $('#songsN').textContent = music.songs().length + ' songs ' + (songListEl.hidden ? '\u25BE' : '\u25B4'); };
songsLabel();
function buildSongs(){
  if (songListEl.childElementCount) return;
  const L = music.songs(), styles = [...new Set(L.map(x => x.style))];
  for (const st of styles){
    const moods = Object.keys(music.moods).filter(m => music.moods[m].includes(st)), h = document.createElement('div');
    h.className = 'sg-h'; h.innerHTML = '<span></span><span class="sg-m"></span>';
    h.firstChild.textContent = L.find(x => x.style === st).label; h.lastChild.textContent = moods.join(' · ');
    songListEl.appendChild(h);
    for (const x of L.filter(y => y.style === st)){
      const b = document.createElement('button'); b.className = 'song'; b.dataset.id = x.id;
      b.innerHTML = '<span class="sn"></span><span class="sl"></span>';
      b.firstChild.textContent = x.title; b.lastChild.textContent = songLen(x.sec);
      b.setAttribute('aria-label', `${x.title}, ${x.label}, ${songLen(x.sec)}`);
      b.addEventListener('click', () => { music.play(x.id); if (!SET.sound) setOpt('sound', true, true); syncSongs(x.id); });
      songListEl.appendChild(b);
    }
  }
  syncSongs();
}
function syncSongs(id){
  const cur = id || (music.track && music.track.song);
  songListEl.querySelectorAll('.song').forEach(b => { if (b.dataset.id === cur) b.setAttribute('aria-current', 'true'); else b.removeAttribute('aria-current'); });
}
$('#songsBtn').addEventListener('click', () => {
  const on = songListEl.hidden; if (on) buildSongs(); songListEl.hidden = !on;
  $('#songsBtn').setAttribute('aria-expanded', String(on)); songsLabel();
});
for (const b of ['#btnPlay', '#btnPlayM']) $(b).addEventListener('click', () => { hideHint(); if (cmp) endCompare(false); togglePlay(); });
// home: the button (first in the dock on phones, after the search box on desks) and the logo
$('#btnHome').addEventListener('click', goHome);
brandEl.addEventListener('click', goHome);
brandEl.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' '){ e.preventDefault(); e.stopPropagation(); goHome(); } });
$('#settingsHelp').addEventListener('click', () => { togglePanel('settings', false); toggleHelp(true); });
$('#btnSound').addEventListener('click', toggleSound);
$('#btnHelp').addEventListener('click', () => toggleHelp(true));
$('#helpClose').addEventListener('click', () => toggleHelp(false));
$('#help').addEventListener('click', e => { if (e.target.id === 'help') toggleHelp(false); });
function toggleHelp(on){ $('#help').hidden = !on; if (on){ $('#notes').hidden = true; $('#helpClose').focus(); } else canvas.focus({preventScroll:true}); }
// what's new: the patch notes (docs/PATCHNOTES.md, put in the page by build.mjs). The button shows a dot until you have seen the newest
// version's notes; someone here for the first time has nothing to catch up on, so their first visit counts as seen.
const NOTES_V = ($('#notesList').querySelector('details') || { dataset:{} }).dataset.v || '';
const notesSeen = () => { try { return localStorage.getItem('gcdatlas.notesSeen'); } catch (e) { return NOTES_V; } };
const notesDot = on => { for (const b of [$('#btnNotes'), $('#settingsNotes')]) b.classList.toggle('has-new', on); document.body.classList.toggle('notes-unseen', on); };
const markNotesSeen = () => { try { localStorage.setItem('gcdatlas.notesSeen', NOTES_V); } catch (e) {} notesDot(false); };
try { if (!localStorage.getItem('gcdatlas.settings') && !notesSeen()) markNotesSeen(); } catch (e) {}
notesDot(!!NOTES_V && notesSeen() !== NOTES_V);
function toggleNotes(on){ $('#notes').hidden = !on; if (on){ $('#help').hidden = true; markNotesSeen(); $('#notesClose').focus(); } else canvas.focus({preventScroll:true}); }
$('#btnNotes').addEventListener('click', () => toggleNotes(true));
$('#helpNotes').addEventListener('click', () => toggleNotes(true));
$('#settingsNotes').addEventListener('click', () => { togglePanel('settings', false); toggleNotes(true); });
$('#notesClose').addEventListener('click', () => toggleNotes(false));
$('#notes').addEventListener('click', e => { if (e.target.id === 'notes') toggleNotes(false); });
const modalOpen = () => !$('#help').hidden || !$('#notes').hidden;
const closeModals = () => { toggleHelp(false); toggleNotes(false); };
// browsers that block sound on load accept a click, tap or key press as permission (pointerup and touchend count on phones)
// (first note whether the music was silent, before this very press lets it start: see toggleSound)
for (const ev of ['pointerdown', 'keydown']) addEventListener(ev, () => { soundSilentAtInput = !(SET.sound && music.audible); }, { capture:true, passive:true });
for (const ev of ['pointerdown', 'pointerup', 'touchend', 'click', 'keydown', 'wheel', 'touchstart']) addEventListener(ev, () => music.gesture(), { capture:true, passive:true });

// ================================================================ main loop
let tmT = 0, last = performance.now(), ema = 16, adaptCount = 0, raised = 0, calmT = 0, runTime = 0, resizePending = false, refocusT = 0, lodT = 0;
// Auto detail (the default since 0.9.4): fine, stepping up to ultra where ultra's characters are still at least 6 pixels wide (a sharp screen;
// on an ordinary one they would be 4 x 7 pixels, too small to read as letters) once frames have had room to spare for a few seconds, and back
// to fine after 3 slow seconds. Ultra draws about 1.6 times the characters and ray-marched pixels of fine. After two steps back it stops
// trying, and remembers that on this device for 14 days (gcdatlas.autoDetail).
const autoDetailOff = () => { try { const a = JSON.parse(localStorage.getItem('gcdatlas.autoDetail') || 'null'); return !!a && Date.now() - a.fine < 14*864e5; } catch (e) { return false; } };
const AUTO_D = { up:0, slow:0, tries:0, off:autoDetailOff() };
const ultraSharp = () => Math.round(DETAIL[0].w*dpr) >= 6;
function autoDetail(){
  if (!SET.detailAuto || AUTO_D.off) return;
  if (detailIdx === 1 && ultraSharp()){
    AUTO_D.up = runTime > 3 && ema < 19 && LODK >= 1 ? AUTO_D.up + 1 : 0;
    if (AUTO_D.up >= 4){ AUTO_D.up = 0; AUTO_D.tries++; detailIdx = 0; runTime = 0; ema = 16; calmT = 0; resize(); syncSettingsUI(); }
  } else if (detailIdx === 0){
    AUTO_D.slow = ema > 24 ? AUTO_D.slow + 1 : 0;
    if (AUTO_D.slow >= 3){
      AUTO_D.slow = 0; detailIdx = 1; runTime = 0; ema = 20; calmT = 0; resize(); syncSettingsUI();
      if (AUTO_D.tries >= 2){ AUTO_D.off = true; try { localStorage.setItem('gcdatlas.autoDetail', JSON.stringify({ fine:Date.now() })); } catch (e) {} }
    }
  }
}
addEventListener('resize', () => { if (resizePending) return; resizePending = true; requestAnimationFrame(() => { resizePending = false; resize(); ladTitles(); }); });
// when zooming out from inside the galaxy, rise gently above the disk so the Milky Way unfolds instead of staying edge-on
function riseAboveDisk(dt){
  if (orbit.lock < 0 || performance.now() - zoomAt > 1500 || orbit.distT < orbit.dist*1.002) return;
  const w = smooth(2500, 30000, orbit.dist)*milkyway.inside; if (w < 0.01) return;
  const d = orbitDir(), el = Math.asin(clamp(d[2], -1, 1)), target = 0.95;
  if (el >= target) return;
  const step = Math.min(target - el, dt*0.9*w), up = V.norm(V.sub([0, 0, 1], V.mul(d, d[2])));
  const nd = V.norm(V.add(V.mul(d, Math.cos(step)), V.mul(up, Math.sin(step))));
  const n = M3.applyT(orbit.frame, nd); orbit.yaw = Math.atan2(n[0], n[2]); orbit.pitch = Math.asin(clamp(n[1], -0.999, 0.999));
}
// in free flight the camera moves with an anchor object (the focus it is positioned relative to, which also keeps precision):
// the object you let go of while you are still near it (within ANCHOR_R of its radii), so the Solar System clock does not carry it
// out of view; otherwise the nearest object you are not inside (the Oort cloud or the Milky Way around you would not move with anything near).
// The Halo is never an anchor: the camera would fold across the galaxy with it.
const ANCHOR_R = 1000;
function nearAnchor(){ const F = OBJ[freeFrom]; return F && F !== ship && !F.hidden && F.dist < ANCHOR_R*F.rad ? F : null; }
function anchorObject(){
  const F = nearAnchor(); if (F) return F.index;
  let b = -1, bd = 1e300, b2 = 0, bd2 = 1e300;
  OBJ.forEach((o, i) => { if (o.layer < 2 || o.noPick || o.marker || o === ship) return; const d = o.dist/o.rad; if (d < bd2){ bd2 = d; b2 = i; } if (d >= 1 && d < bd){ bd = d; b = i; } });
  return b >= 0 ? b : b2;
}
function refocus(dt){
  refocusT -= dt; if (refocusT > 0 || orbit.lock >= 0 || flight) return; refocusT = 0.5;
  const i = anchorObject(); if (i === cam.focus) return;
  const D = frel(OBJ[i]); cam.rel = V.sub(cam.rel, D); orbit.target = V.sub(orbit.target, D); cam.focus = i;
}
// CPU simulations (N-body collisions, gas streams, ejecta) only run while someone can see them
// ---------------------------------------------------------------- panels: only one of tours, time machine and settings is open at a time
const PANELS = { tours:['#tours', '#btnTours'], timem:['#timem', '#btnTime'], settings:['#settings', '#btnSettings'] };
function togglePanel(id, on){
  for (const [k, [p, b]] of Object.entries(PANELS)){ const show = k === id ? on : false; $(p).hidden = !show; $(b).setAttribute('aria-expanded', String(show)); }
  document.body.classList.toggle('panel-open', !!on);
  $('#modeTour').setAttribute('aria-expanded', String(!$('#tours').hidden));
  if (on && id === 'settings') syncSettingsUI();
  if (on && id === 'timem') syncTimeUI();
}
toggleSettings = on => togglePanel('settings', on);
$('#btnTours').addEventListener('click', () => togglePanel('tours', $('#tours').hidden));
$('#toursClose').addEventListener('click', () => togglePanel('tours', false));
$('#btnTime').addEventListener('click', () => togglePanel('timem', $('#timem').hidden));
$('#timeClose').addEventListener('click', () => togglePanel('timem', false));

// ---------------------------------------------------------------- tours and story captions
const tourRows = TOURS.map(t => {
  const n = t.deal ? RANDOM_N : tourStops(t.id).length; if (n < 3) return null;   // (a dealt tour picks its stops when it starts)
  const b = document.createElement('button'); b.className = 'trow';
  b.innerHTML = '<b></b><small></small>'; b.querySelector('b').textContent = t.name; b.querySelector('small').textContent = t.blurb + ' · ' + n + ' stops';
  b.addEventListener('click', () => startTour(t.id));
  $('#tourList').appendChild(b); return { b, id:t.id };
}).filter(Boolean);
function startTour(id){
  if (HT.on){ hideHint(); togglePanel('tours', false); haloTourStart(id); return; }   // (the Halo tour flies the tour picked)
  hideHint(); if (cmp) endCompare(false);
  tween = null; if (flight) finishFlightHere();
  useTour(id);   // (after the flight stops: the random tour deals from where the camera is)
  tour.on = true; tourGo(TOUR[0]); updateModeUI();
  toast(tourName() + ' · ' + TOUR.length + ' stops');
}
const capEl = $('#caption'), capText = $('#capText'), capBtn = $('#capBtn');
let capFull = '', capShown = 0, capT = 0;
// (while the interface has faded away the caption fades too, a few seconds after it is written out, and comes back only for a new one:
// owner, 0.10.1. A caption is new when more than its numbers change, so a launch clock ticking on does not bring it back)
let capKey = '', capDoneAt = 0;
const CAP_REST = 4500;
const SHOWCAP = { txt:'' };   // a caption set by the Halo showcase
function setCaption(txt, btn){
  if (txt === capFull){ return; }
  // (a caption that only changes toward its end, like a live number, keeps what is already typed and types on from where the two differ;
  // a new caption is typed from the start)
  let k = 0; const m = Math.min(capShown, txt.length); while (k < m && txt.charCodeAt(k) === capFull.charCodeAt(k)) k++;
  if (!(k >= 8 || (k > 0 && k === capShown))) k = 0;
  capFull = txt; capShown = k; capT = k; capText.textContent = txt.slice(0, k); capEl.classList.toggle('done', !!txt && k >= txt.length);
  // (new: words it did not have before; a caption that only loses its event, back to the clock, stays faded)
  const key = txt.replace(/[0-9]+/g, '#'); if (key !== capKey){ const had = new Set(capKey.split(/\s+/)); if (!txt || key.split(/\s+/).some(w => !had.has(w))){ capDoneAt = 0; capEl.classList.remove('rest'); } capKey = key; }
  capEl.hidden = !txt; capBtn.hidden = !btn; if (btn) capBtn.textContent = btn;
}
function updateCaption(dt){
  let txt = '', btn = '';
  if (cmp) { txt = cmpText(); btn = 'end compare'; }
  else if (LCAP.live){ txt = LCAP.txt; btn = LCAP.btn; }   // (a real launch happening now, even on a tour)
  else if (tour.on && tour.phase !== 'fly' && TOUR_CAP[tour.obj]) txt = TOUR_CAP[tour.obj];
  else if (SHOWCAP.txt) txt = SHOWCAP.txt;
  else if (LCAP.txt){ txt = LCAP.txt; btn = LCAP.btn; }
  setCaption(txt, btn);
  if (capFull && capShown < capFull.length){
    capT += dt*(reduceMotion ? 1e4 : 55); const k = Math.min(capFull.length, Math.floor(capT));
    if (k !== capShown){ capShown = k; capText.textContent = capFull.slice(0, k); if (k >= capFull.length) capEl.classList.add('done'); }
  }
  // (rests once it has been read: written out, and CAP_REST since; only while the interface is faded)
  const now = performance.now();
  if (capFull && capShown >= capFull.length && !capDoneAt) capDoneAt = now;
  capEl.classList.toggle('rest', !!capDoneAt && now - capDoneAt > CAP_REST && document.body.classList.contains('ui-idle'));
}
capBtn.addEventListener('click', () => { if (cmp) endCompare(true); else if (LCAP.go) LCAP.go(); });

// ---------------------------------------------------------------- size compare: put a second object beside this one, at true scale
let cmp = null, cmpPick = false, cmpA = -1;
const sizeR = o => o.sizeR || (o.starR ? o.starR*o.rad : o.rad*(o.solid || 0.6));
const sizeKm = o => sizeR(o)*(o.scaleKm ? o.scaleKm(1) : LY);
function atlasTitle(t){ $('#atlas .ptitle').textContent = t || 'atlas'; }
function beginComparePick(){
  hideHint();
  if (cmp){ endCompare(true); return; }
  cmpA = orbit.lock >= 0 && !htShowsPlace() ? orbit.lock : infoObj; cmpPick = true;   // (on the Halo tour: the place the panel shows)
  atlasTitle('compare ' + OBJ[cmpA].name + ' with'); toggleAtlas(true); focusSearch();
  toast('pick something to put beside ' + OBJ[cmpA].name);
}
function startCompare(a, b){
  if (a === b) return;
  const A = OBJ[a], B = OBJ[b];
  if (tour.on) stopTour(false);
  cmp = { a:A, b:B };
  const ra = sizeR(A), rb = sizeR(B), sep = (ra + rb)*1.3, w = ra + sep + rb, h = 2*Math.max(ra, rb);
  const vp = viewParams(A, 0); vp.off = [0, 0, 0]; vp.offFn = null;
  vp.dist = Math.max(w/(2*tanX), h/(2*tanY))*1.25; vp.dist = Math.max(vp.dist, A.rad*A.minZoom*1.05);
  orbit.offFn = null; setInfo(a); startFlight(A, vp, null); updateModeUI();
  $('#btnCompare').setAttribute('aria-pressed', 'true'); $('#btnCompare').textContent = 'end compare';
}
function endCompare(refly){
  if (!cmp) return; const A = cmp.a; cmp = null;
  $('#btnCompare').setAttribute('aria-pressed', 'false'); $('#btnCompare').textContent = 'compare size';
  if (refly && orbit.lock === A.index){ orbit.off = [0, 0, 0]; const vp = viewParams(A, 0); vp.off = [0, 0, 0]; show.pending = true; motion.last = 'show'; startFlight(A, vp, () => { if (show.pending) startShow(A.index, 0); }); }
  updateModeUI();
}
function fmtRatio(r){ return r >= 100 ? fmtNum(r) : r >= 10 ? String(Math.round(r)) : r.toFixed(1); }
function cmpText(){
  const A = cmp.a, B = cmp.b, da = 2*sizeKm(A), db = 2*sizeKm(B);
  const [big, small, dbig, dsmall] = db >= da ? [B, A, db, da] : [A, B, da, db];
  const r = dbig/dsmall;
  return r < 1.05 ? `${A.name} and ${B.name} are about the same size (${fmtLen(da, 2)} across)` :
    `${big.name} is ${fmtRatio(r)} times as wide as ${small.name}: ${fmtLen(dbig, 2)} vs ${fmtLen(dsmall, 2)} across`;
}
function placeCompare(dt){
  const A = cmp.a, B = cmp.b, ra = sizeR(A), rb = sizeR(B), sep = (ra + rb)*1.3;
  B.rel = V.add(A.rel, V.mul(cam.right, sep)); B.dist = V.len(B.rel);
  if (!flight && orbit.lock === A.index){ const want = V.mul(cam.right, (sep + rb - ra)/2); orbit.off = V.lerp(orbit.off, want, 1 - Math.exp(-dt*3)); orbit.offFn = null; }
}
$('#btnCompare').addEventListener('click', beginComparePick);

// ---------------------------------------------------------------- time machine: the Solar System clock, date jumps, and deep time for the stars
let ssRate = SS_RATE/86400;   // days of Solar System time per second (default: 10 minutes per second)
const tmDate = $('#tmDate'), tmSub = $('#tmSub'), deepEl = $('#deep'), deepTxt = $('#deepTxt'), tbadge = $('#tbadge');
const realJD = () => Date.now()/86400000 + 2440587.5;
function fmtJD(jd){
  const d = new Date((jd - 2440587.5)*86400000); if (isNaN(d)) return '?';
  const y = d.getUTCFullYear(), p = x => String(x).padStart(2, '0');
  return (y < 0 ? '-' + String(-y).padStart(4, '0') : String(y).padStart(4, '0')) + '-' + p(d.getUTCMonth() + 1) + '-' + p(d.getUTCDate()) + ' ' + p(d.getUTCHours()) + ':' + p(d.getUTCMinutes()) + ' UTC';
}
// named stars (and anything travelling with them) drift with the catalogue star they match
const DRIFTERS = [];
for (const o of OBJ){
  if (o.parent || o.layer !== 3 || o.group !== 'stars' || !o.pos || V.len(o.pos) > 6000 || o === sun) continue;
  const v = catalogStars.velocityAt(o.pos); if (v){ o.pos0 = o.pos.slice(); o.vel = v; DRIFTERS.push(o); }
}
if (BYKEY.proxima && BYKEY.alphacen && BYKEY.alphacen.vel && !BYKEY.proxima.vel){ const p = BYKEY.proxima; p.pos0 = p.pos.slice(); p.vel = BYKEY.alphacen.vel; DRIFTERS.push(p); }
function setDeep(kyr){
  DEEP = kyr/1000; catalogStars.setDeep(DEEP);
  for (const o of DRIFTERS) o.pos = V.add(o.pos0, V.mul(o.vel, DEEP));
  deepEl.value = kyr; syncTimeUI();
}
function syncTimeUI(){
  const jd = jdNow(), off = jd - realJD();
  tmDate.textContent = fmtJD(jd);
  tmSub.textContent = Math.abs(off) < 0.02 ? 'the Solar System as it is right now' : (off > 0 ? 'the Solar System ' + fmtSpan(off) + ' from now' : 'the Solar System ' + fmtSpan(-off) + ' ago');
  const yrs = Math.round(Math.abs(DEEP)*1e6).toLocaleString('en-US');
  const dt = DEEP ? 'the stars ' + yrs + ' years ' + (DEEP > 0 ? 'from now' : 'ago') : "today's sky"; if (deepTxt.textContent !== dt) deepTxt.textContent = dt;
  $('#timem').querySelectorAll('.seg[data-key="ssrate"] button').forEach(b => b.setAttribute('aria-checked', String(Math.abs(+b.dataset.v - ssRate) < 1e-4)));
  const badge = DEEP ? 'stars ' + (DEEP > 0 ? '+' : '-') + yrs + ' yr' : (Math.abs(off) > 1 ? fmtJD(jd).slice(0, 10) : '');
  tbadge.hidden = !badge; if (badge) tbadge.textContent = badge;
}
function fmtSpan(days){ return days < 1 ? Math.round(days*24) + ' hours' : days < 60 ? Math.round(days) + ' days' : days < 730 ? Math.round(days/30.44) + ' months' : Math.round(days/365.25).toLocaleString('en-US') + ' years'; }
$('#timem').querySelectorAll('.seg[data-key="ssrate"] button').forEach(b => b.addEventListener('click', () => { ssRate = +b.dataset.v; if (!timeScale) setOpt('time', 1, true); syncTimeUI(); }));
$('#timem').querySelectorAll('.tm-jump button').forEach(b => b.addEventListener('click', () => { ssDays += +b.dataset.j; syncTimeUI(); toast(fmtJD(jdNow()).slice(0, 10)); }));
$('#tmNow').addEventListener('click', () => { ssDays = realJD() - JD_NOW; ssRate = SS_RATE/86400; setDeep(0); toast('back to now'); });
deepEl.addEventListener('input', () => setDeep(+deepEl.value));

// ---------------------------------------------------------------- share links: the address remembers the object, camera angle, comparison, tour and time
function viewHash(){
  // (on the Halo tour, the place the panel shows: a link cannot bring back the ship where it is now)
  const ht = htShowsPlace(), p = new URLSearchParams(), i = orbit.lock >= 0 && !ht ? orbit.lock : infoObj, o = OBJ[i];
  p.set('o', o.key);
  if (o.earthSpot){ const g = EPL.hashOf(o); if (g) p.set('g', g); }   // (a famous place's own object needs no g: its key is enough)
  if (orbit.lock >= 0 && !flight && !ht) p.set('c', orbit.yaw.toFixed(3) + ',' + orbit.pitch.toFixed(3) + ',' + (orbit.distT/o.rad).toPrecision(4));
  if (cmp) p.set('vs', cmp.b.key);
  if (tour.on) p.set('tour', TOUR_ID);
  if (Math.abs(jdNow() - realJD()) > 1) p.set('jd', jdNow().toFixed(2));
  if (DEEP) p.set('deep', Math.round(DEEP*1000));
  return p.toString();
}
let lastHash = '', hashT = 0;
function updateHash(dt){
  hashT -= dt; if (hashT > 0 || flight) return; hashT = 1;
  const h = viewHash(); if (h === lastHash) return; lastHash = h;
  try { history.replaceState(null, '', '#' + h); } catch (e) {}
}
function applyHash(){
  let p; try { p = new URLSearchParams(location.hash.slice(1)); } catch (e) { return false; }
  const o = BYKEY[p.get('o')]; if (!o || o.marker) return false;
  if (o.earthSpot && !EPL.fromHash(o, p.get('g'))) return false;
  // (values from a link are checked: anything that is not a sensible number is ignored)
  const jd = +p.get('jd'), deep = +p.get('deep');
  if (p.get('jd') && isFinite(jd)) ssDays = clamp(jd, JD_NOW - 4e6, JD_NOW + 4e6) - JD_NOW;
  if (p.get('deep') && isFinite(deep)) setDeep(clamp(deep, -200, 200));
  // (a link into the random tour starts a new one at the linked place: the order is not in the link, and it depends on what each visitor has seen)
  if (p.get('tour')){ useTour(p.get('tour'), o); if (TOUR.includes(o.index)){ tour.on = true; tourGo(o.index, true); return true; } }
  tour.on = false;
  const c = (p.get('c') || '').split(',').map(Number);
  const vp = viewParams(o, 0);
  cam.focus = o.index; orbit.lock = o.index; orbit.frame = camFrameOf(o); orbit.off = [0, 0, 0]; orbit.offFn = null;
  if (c.length === 3 && c.every(isFinite) && c[2] > 0){ orbit.yaw = c[0]; orbit.pitch = clamp(c[1], -1.55, 1.55); orbit.dist = orbit.distT = clamp(c[2]*o.rad, o.rad*o.minZoom, MAX_DIST); }
  else { orbit.yaw = vp.yaw; orbit.pitch = vp.pitch; orbit.dist = orbit.distT = vp.dist; }
  orbit.target = frel(o); setInfo(o.index); applyOrbit();
  const vs = BYKEY[p.get('vs')]; if (vs && !vs.marker) startCompare(o.index, vs.index);
  else startShow(o.index, 0);   // a shared or reloaded view starts playing its angles, like any picked object
  return true;
}
// a place in the atlas (or a famous place on Earth) has a share page, /p/<key> (build.mjs): its own preview tags and picture for the
// link-preview bots, and a script that sends people straight on into the atlas. __SHARE_PAGES (written into the page by build.mjs from
// tools/data/share-meta.json) lists the keys whose pages exist: a place added since `npm run og -- --all` falls back to the plain #-link.
const shareable = o => !!o && !o.marker && ((o.atlas !== false && !!o.group) || o.own === true);
const sharePage = o => shareable(o) && Array.isArray(window.__SHARE_PAGES) && window.__SHARE_PAGES.includes(o.key) ? '/p/' + o.key : '';
const shareList = () => OBJ.filter(o => shareable(o)).map(o => ({ key:o.key, name:o.name, fact:o.fact || '', own:!!o.own }));
function shareUrl(){
  const h = viewHash(), p = new URLSearchParams(h), o = BYKEY[p.get('o')], pg = o && sharePage(o);
  if (pg && /^https?:$/.test(location.protocol)){ p.delete('o'); const q = p.toString(); return location.origin + pg + (q ? '?' + q : ''); }
  return location.href.split('#')[0] + '#' + h;
}
async function share(){
  try { await navigator.clipboard.writeText(shareUrl()); toast('link copied · it opens exactly this view'); }
  catch (e) { try { history.replaceState(null, '', '#' + viewHash()); } catch (e2) {} toast('copy the page address to share this exact view'); }
}
$('#btnShare').addEventListener('click', share);

const simActive = o => o.vis > 0.003 || o.pvis > 0.003 || o.index === orbit.lock || (tour.on && o.index === tour.obj) || (flight && flight.obj === o);
// (TICKS: more work to do at the start of each tick, added by later files, e.g. the Halo showcase)
const TICKS = [];
function tick(dt){
  const sdt = dt*timeScale;
  GT += dt;
  for (const f of TICKS) f(dt);
  ssDays += sdt*ssRate;
  for (const o of OBJ){ o.t += sdt; if (o.update && (!o.sim || simActive(o))) o.update(sdt); if (o.parent && !o.selfPos) o.pos = V.add(o.parent.pos, o.offset); }
  updateLeash(dt);
  if (flight) updateFlight(dt);
  else if (shipCam.on) updateShipCam(dt);
  else if (LCAM.on) updateLaunchCam(dt);
  else {
    if (tween) updateTween(dt);
    if (tour.on) updateTour(dt);
    else if (flyMove){ if (!flyMove.frozen) flyMove.t += dt; const h = flyMove.v.hold; playMove(flyMove.o, flyMove.v, clamp(flyMove.t/h, 0, 1)); if (flyMove.t >= h){ flyMove = null; if (motion.last === 'show' && orbit.lock >= 0) resumeShow(); } }
    else if (show.on) updateShow(dt);
    dealAhead();   // (a random tour dealt ahead, a bit each frame: the next one on its last stop, or a first one while the list of tours is open)
    updateKeys(dt);
    if (!tween) orbit.dist = Math.exp(Math.log(orbit.dist) + (Math.log(orbit.distT) - Math.log(orbit.dist))*(1 - Math.exp(-dt*7)));
    riseAboveDisk(dt);
    // locked on the Halo, the orbit frame turns with the ship, so the camera keeps trailing it as it steers
    if (orbit.lock >= 0 && orbit.lock === ship.index) orbit.frame = camFrameOf(ship);
    if (orbit.lock >= 0){ if (orbit.offFn && !tween) orbit.off = orbit.offFn(); orbit.target = V.add(frel(OBJ[orbit.lock]), orbit.off); }
    applyOrbit();
    refocus(dt);
  }
  for (const f of AFTER_CAM) f(dt);
  tanY = tanY0/LENS.k; tanX = tanX0/LENS.k;
  for (const o of OBJ){ o.rel = V.sub(frel(o), cam.rel); o.dist = V.len(o.rel); }
  updateSysMag(dt); updateSunOcc();
  if (cmp) placeCompare(dt);
  updateDrift(dt);
}
// The browser can take the GPU away from the page (a driver reset, a GPU hang in another tab, its own watchdog): drawing stops, a line says so,
// and when the browser gives the context back the page reloads (every texture, buffer and program would have to be made again). Without
// preventDefault the context would never come back.
let glLost = false;
canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); glLost = true; const m = $('#nogl'); m.textContent = 'The browser reset the graphics. The page reloads when they are back, or you can reload it now.'; m.hidden = false; });
canvas.addEventListener('webglcontextrestored', () => { location.reload(); });
function frame(now){
  requestAnimationFrame(frame);
  if (window.__freeze || glLost){ last = now; return; }
  const dtR = Math.min((now - last)/1000, 0.25); last = now;
  const hitch = progBusy > 0; progBusy = 0;   // the last frame compiled a shader: its time says nothing about how fast the scene draws
  const dt = Math.min(dtR, 0.05);
  tick(dt);
  render();
  updateHUD(dt);
  updateCaption(dtR); updateHash(dtR);
  tmT -= dtR; if (tmT <= 0){ tmT = 0.25; syncTimeUI(); }
  runTime += dtR;
  if (!hitch) ema = ema*0.95 + dtR*1000*0.05;
  if (runTime > 2.5) progIdle(1);
  // keep motion smooth on slower devices: first trim ray-march steps, then (at most twice) use bigger characters;
  // after 10 calm seconds at full steps the characters go back to the chosen detail (at most 3 times a session, so it cannot flip back and forth)
  lodT += dtR;
  if (!window.__noAdapt && lodT > 1 && document.visibilityState === 'visible'){
    lodT = 0;
    if (ema > 38) LODK = Math.max(0.5, LODK - 0.1); else if (ema < 24) LODK = Math.min(1, LODK + 0.05);
    autoDetail();
    if (runTime > 10 && ema > 48 && LODK <= 0.5 && adaptCount < 2 && detailIdx < DETAIL.length - 1){
      adaptCount++; runTime = 0; ema = 20; calmT = 0; detailIdx++; resize(); toast('detail lowered to ' + DETAIL[detailIdx].name + ' for smoother motion');
    }
    calmT = detailIdx > SET.detail && ema < 20 && LODK >= 1 ? calmT + 1 : 0;
    if (calmT >= 10 && raised < 3){
      raised++; calmT = 0; runTime = 0; ema = 20; adaptCount = Math.max(0, adaptCount - 1); detailIdx--; resize(); toast('detail back to ' + DETAIL[detailIdx].name);
    }
  }
  if (!hintHidden && performance.now() > 18000) hideHint();
}
resize();
ladTitles();
if (document.fonts) document.fonts.load('500 20px "IBM Plex Mono"').then(() => buildAtlas(cellW, cellH)).catch(() => {});
useTour('grand');
$('#atlasCount').textContent = `${atlasRows.length} places`;
music.set(SET.sound);
syncSettingsUI();
tick(0);
if (!applyHash()) tourGo(TOUR[0], true);
tick(0);
updateModeUI(); syncTimeUI();
window.__cosmos = { get egl(){ return typeof EGL !== 'undefined' ? EGL : null; }, get etl(){ return ETL; }, get egr(){ return EGR; }, get epl(){ return EPL; }, get ect(){ return ECT; }, get plc(){ return PLC; }, get etr(){ return ETR; }, get eas(){ return EAS; }, get ecld(){ return ECLD; }, startTour, playFlyby, setMove(o, v, f){ flight = null; tween = null; tourGo(o.index, true); tour.on = false; flyMove = { o, v, t:f*v.hold, frozen:true }; },  get flyMove(){ return flyMove; }, startCompare, endCompare, setDeep, viewHash, applyHash, get cmp(){ return cmp; }, get ssRate(){ return ssRate; }, set ssRate(v){ ssRate = v; }, dbg:{ imp, impSpec, atlas, sphereRect, get tan(){ return [tanX, tanY]; }, get cols(){ return cols; }, get sceneH(){ return sceneH; }, get LODK(){ return LODK; }, PROGS }, OBJ, BYKEY, tourGo, lockOn, setTour, cam, orbit, tour, TOUR, SET, setOpt, music, LADDER, goLadder,
  land:(extra = 0.2) => { let n = 0; while (flight && n < 60*180){ tick(1/60); n++; } for (let i=0;i<extra*60;i++) tick(1/60); return n/60; },
  setDays:d => { ssDays = d; }, get days(){ return ssDays; }, stepObject, stepAngle, get tourId(){ return TOUR_ID; }, get tourGen(){ return TOUR_GEN; }, randomSeed:n => { RSEED = n >>> 0; }, samePlace, tourable, tourPool, tripClear, dealRandom, RANDOM_W, tripW:(a, b) => tripWeight(tripEnd(a), tripEnd(b)), get nextDeal(){ return nextDeal; }, get stepTarget(){ return flight ? (flight.dest || flight.obj).key : null; }, get via(){ return flight && flight.via ? flight.via.key : null; }, PASS,
  startShipCam, stopShipCam, setShipCamMode, get shipCam(){ return shipCam; }, SHIP_POSE, get show(){ return show; }, togglePlay, get flight(){ return flight; },
  goHome, goBack, unlock, leash, get freeFrom(){ return freeFrom; }, proj:k => { const o = typeof k === 'string' ? BYKEY[k] : k, p = projectCSS(o.rel); return p && { x:p.x, y:p.y, z:p.z }; }, get SYSMAG(){ return SYSMAG; },
  setDetail:i => setOpt('detail', i, true), render, zoomTo, tick, caption:dt => updateCaption(dt), get showcap(){ return SHOWCAP.txt; }, flightDur:() => flight ? flight.dur : 0, hud:() => { roTimer = 0; updateHUD(0.2); },
  simulate:(sec) => { for (let k=0; k<sec*30; k++) tick(1/30); return { obj:tour.obj, view:tour.view, phase:tour.phase, lock:orbit.lock }; },
  view:(i, v) => { if (typeof i === 'string') i = BYKEY[i].index; const o = OBJ[i], vp = viewParams(o, v); flight = null; shipCam.on = false; tween = null; cam.focus = i; leash.x = leash.y = 0; orbit.lock = i; orbit.frame = camFrameOf(o); orbit.yaw = vp.yaw; orbit.pitch = vp.pitch; orbit.dist = orbit.distT = vp.dist; orbit.off = vp.off; orbit.offFn = vp.offFn; orbit.target = V.add(frel(o), vp.off); setInfo(i); applyOrbit(); tick(0); } };
// (the atlas headings and chips, for tools/catalog.mjs, and the seed and the catalogue numbers the smoke test checks; a line of its own so it stays clear of edits to the hooks above)
Object.assign(window.__cosmos.dbg, { GROUPS, CATS, catsOf, ATL, seedObjects:SEED_OBJECTS, catSplit, catClash, shareable, sharePage, shareList });
window.__cosmos.shareUrl = shareUrl;
window.__cosmos.sx = SXDBG;   // (SpaceX launches: runs, missions, the launch camera; s4-spacex-run.js)
requestAnimationFrame(frame);

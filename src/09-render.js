
// ================================================================ render targets
const DETAIL = [{name:'ultra', w:4}, {name:'fine', w:5}, {name:'normal', w:6.5}, {name:'bold', w:9}];
let detailIdx = clamp(SET.detail | 0, 0, DETAIL.length - 1), glowOn = SET.glow, labelsOn = SET.labels;
let dpr = 1, cellW = 6, cellH = 11, cols = 1, rows = 1, sceneW = 2, sceneH = 2;
let tanY = Math.tan(cam.fovY/2), tanX = tanY, viewWcss = 1, viewHcss = 1, canvasHcss = 1;
let RT = null, viewFit = 1, LODK = 1;   // LODK: ray-march step budget, lowered automatically on slow devices
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
  tanY = Math.tan(cam.fovY/2); tanX = tanY*aspect;
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
    gl.activeTexture(gl.TEXTURE5); gl.bindTexture(gl.TEXTURE_2D, o.tex ? TEX[o.tex] : TEX.mw); }
}
function sphereRect(c, r){
  if (V.len(c) < r*1.05) return [-1,-1,1,1];
  const vx = V.dot(c, cam.right), vy = V.dot(c, cam.up), vz = V.dot(c, cam.fwd);
  if (vz + r < 0) return null;
  if (vz - r < r*0.02) return [-1,-1,1,1];
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
  for (const sz of [-r, r]){ const z = vz + sz;
    for (const s of [-r, r]){ const x = (vx + s)/(z*tanX), y = (vy + s)/(z*tanY); x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); } }
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
  gl.bindVertexArray(s.ps.vao); gl.drawArrays(s.lines ? gl.LINES : gl.POINTS, 0, s.count ? s.count() : s.ps.count);
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
function render(){
  camRot = [...cam.right, ...cam.up, ...cam.fwd];
  // where are we? inside the Milky Way the sky is full of stars; outside it turns to galaxies
  const mw = milkyway, dGC = V.len(mw.rel), span = orbit.dist, dSun = V.len(sun.rel);
  gcDir = V.norm(mw.rel); nearSun = 1 - smooth(4000, 15000, dSun);
  const outMW = 1 - mw.inside, farOut = smooth(1.5e5, 2e6, dGC);
  sky = [clamp(1 - outMW*0.8 - farOut, 0, 1), smooth(1.5e5, 2e6, dGC)*(1 - smooth(3e8, 3e9, span)), Math.exp(-dGC/5000)*mw.inside, mw.inside];
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
    const rpx = o.rad/Math.max(o.dist, 1e-300)*pxK;
    o.rpx = rpx;
    if (o.inRange && !o.inRange()){ o.vis = 0; o.pvis = 0; continue; }
    const pmin = o.pxMin || 7;
    let vis = o.visFn ? o.visFn(rpx) : (o.alwaysFull ? 1 : smooth(pmin, pmin*2.6, rpx));
    // shaders compile on demand: until this object's are ready it keeps showing as a glowing dot
    if (vis > 0.003 && o.prog && !progReady(o.prog)) vis = 0;
    o.vis = vis;
    if (vis > 0.003){
      if (o.prog) o.onScreen = drawVolume(o, o.prog, o.rel, o.rad, o.setU && (pr => o.setU(pr)), o.rot, vis);
      if (o.drawBefore) o.drawBefore(vis);
    }
    const pv = o.particleVis ? o.particleVis(rpx) : smooth(pmin*0.4, pmin*1.4, rpx);
    o.pvis = pv;
    if (pv > 0.003) for (const s of o.particles) drawParticles(o, s, pv);
    if (vis > 0.003 && o.drawAfter) o.drawAfter(vis);
    // impostor dot
    if (!o.noImpostor && vis < 0.999 && ni < imp.n){
      const b = o.farLum*(1 - vis)*clamp(Math.pow(rpx/1.2, 0.33), 0, 1.2);
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
}

// ================================================================ HUD
let infoObj = 0, toastTimer = 0, roTimer = 0, hintHidden = false;
const infoEl = $('.info'), atlasEl = $('#atlas'), settingsEl = $('#settings'), ladderEl = $('#ladder'), controlsEl = $('.controls');
function projectCSS(rel){
  const z = V.dot(rel, cam.fwd); if (z <= 0) return null;
  const x = V.dot(rel, cam.right)/(z*tanX), y = V.dot(rel, cam.up)/(z*tanY);
  return { x:(x*0.5 + 0.5)*viewWcss, y:canvasHcss - (y*0.5 + 0.5)*viewHcss, z };
}
function toast(msg){ const t = $('#toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('on'), 2600); }
function hideHint(){ if (hintHidden) return; hintHidden = true; $('#hint').style.opacity = '0'; }
const distFromEarth = o => o.distEarth || fmtDist(V.len(V.sub(o.pos, earth.pos))) + ' from Earth';
function setInfo(i){
  infoObj = i; const o = OBJ[i];
  $('#objName').textContent = o.name; $('#objType').textContent = o.type; $('#objFact').textContent = o.fact || '';
  const k = TOUR.indexOf(i);
  $('#stopNum').textContent = k >= 0 ? String(k + 1).padStart(2, '0') : '--';
  $('#objDist').textContent = o.key === 'earth' ? 'you are here' : (o.distEarth ? o.distEarth + (/away|here|around|from|edge|centre/.test(o.distEarth) ? '' : ' away') : distFromEarth(o));
  $('#readout').textContent = o.readout ? o.readout() : '';
  atlasMark(i);
}
function updateModeUI(){
  $('#mode').textContent = tour.on ? 'guided tour' : (orbit.lock >= 0 || flight ? 'locked on' : 'free camera');
  $('#btnFree').setAttribute('aria-pressed', String(!tour.on && orbit.lock < 0 && !flight));
  $('#btnTour').setAttribute('aria-pressed', String(tour.on));
}
function goTo(i){ hideHint(); if (OBJ[i].marker) return; if (tour.on && TOUR.includes(i)){ tween = null; if (flight) finishFlightHere(); tourGo(i); } else lockOn(i); }
const labelEls = OBJ.map((o, i) => {
  const b = document.createElement('button'); b.className = 'lab' + (o.layer < 3 || o.marker ? ' big' : '') + (o.marker ? ' star' : '') + (o.labelClass ? ' ' + o.labelClass : '');
  b.textContent = o.label || o.name; b.tabIndex = -1;
  if (!o.marker) b.addEventListener('click', () => goTo(i));
  $('#labels').appendChild(b); return b;
});
const starEls = STAR_LABELS.map(s => { const b = document.createElement('span'); b.className = 'lab star'; b.textContent = s.name; $('#labels').appendChild(b); return b; });
// interface areas labels must stay clear of
function uiRects(){
  const r = [infoEl.getBoundingClientRect(), controlsEl.getBoundingClientRect()];
  const lb = ladderEl.getBoundingClientRect(); r.push({ left:lb.left - 190, right:lb.right + 12, top:lb.top - 30, bottom:lb.bottom + 10 });
  if (!atlasEl.hidden) r.push(atlasEl.getBoundingClientRect());
  if (!settingsEl.hidden) r.push(settingsEl.getBoundingClientRect());
  return r;
}
function updateLabels(){
  const focus = tour.on ? tour.obj : orbit.lock;
  const avoid = uiRects(), placed = [];
  const cand = [];
  const shipId = typeof ship !== 'undefined' ? ship.index : -1;
  OBJ.forEach((o, i) => {
    const el = labelEls[i];
    let pr = null;
    const zs = Math.max(orbit.dist, 1e-30);
    const inScale = o.marker ? (zs > o.labelMin && zs < o.labelRange && o.dist < zs*12) : (o.dist < o.labelRange && o.dist > (o.labelMin || 0) && (o.dist < zs*(o.layer < 3 ? 25 : 60) || (o.rpx > 6 && o.dist < zs*3000)));
    if (labelsOn && !o.noLabel && !o.hidden && inScale && (!o.inRange || o.inRange()) && !(i === shipId && SET.shipFinder)) pr = projectCSS(o.rel);
    if (pr){
      const rpx = o.rad/(pr.z*tanY)*(viewHcss/2);
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
  // labels hide behind planets, stars and black holes that stand in front of them
  const occ = [];
  for (const o of OBJ){ if (!o.solid || !o.onScreen || o.vis < 0.5) continue; const pr = projectCSS(o.rel); if (!pr) continue; const r = o.rad*o.solid/(pr.z*tanY)*(viewHcss/2); if (r > 3) occ.push({ x:pr.x, y:pr.y, r, z:pr.z, o }); }
  const hidden = c => occ.some(q => q.z < c.pr.z*0.999 && q.o.index !== c.i && Math.hypot(c.pr.x - q.x, c.pr.y - q.y) < q.r*0.97);
  cand.sort((a, b) => b.pri - a.pri);
  for (const c of cand){
    if (occ.length && hidden(c)) continue;
    const w = c.el.offsetWidth || 80, h = 16, off = Math.max(c.rpx*0.72, 5);
    const lx = Math.min(c.pr.x + off, innerWidth - w - 8), ly = c.pr.y - off - 16;
    if (avoid.some(r => lx < r.right + 6 && lx + w > r.left - 6 && ly < r.bottom + 4 && ly + h > r.top - 4)) continue;
    if (placed.some(p => lx < p.x + p.w + 6 && lx + w + 6 > p.x && ly < p.y + h && ly + h > p.y)) continue;
    if (placed.length > 31) break;
    placed.push({x:lx, y:ly, w}); c.el._show = true;
    c.el.style.transform = `translate3d(${lx.toFixed(1)}px, ${ly.toFixed(1)}px, 0)`;
  }
  for (const el of labelEls){ const v = el._show ? 'visible' : 'hidden'; if (el.style.visibility !== v) el.style.visibility = v; }
  for (const el of starEls){ const v = el._show ? 'visible' : 'hidden'; if (el.style.visibility !== v) el.style.visibility = v; }
}
function updateHUD(dt){
  roTimer -= dt;
  if (roTimer <= 0){
    roTimer = 0.15;
    const o = OBJ[infoObj]; $('#readout').textContent = o.readout ? o.readout() : '';
    let p = '';
    if (tour.on){
      const obj = OBJ[tour.obj];
      if (tour.phase === 'fly') p = 'en route ' + '>'.repeat(1 + Math.floor(performance.now()/250) % 3);
      else { const v = obj.views[tour.view], n = obj.views.length, f = tour.phase === 'swing' ? 1 : clamp(tour.t/v.hold, 0, 1), k = Math.round(f*18);
        p = `angle ${tour.view + 1}/${n}  [${'#'.repeat(k)}${'-'.repeat(18 - k)}]`; }
    } else if (orbit.lock >= 0 || flight) p = 'drag to orbit · scroll out to the edge of the universe';
    else p = 'W A S D to fly · tap an object to lock on';
    $('#progress').textContent = p;
    updateScale();
  }
  updateLadder();
  updateLabels();
  updateShipFinder();
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
  const dist = Math.max(orbit.dist, 1e-30);
  const targetPx = innerWidth < 680 ? 90 : 130;
  const km = targetPx*(2*tanY*dist/viewHcss)*kmPerLy();
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
function goLadder(m){
  const o = BYKEY[m.key]; if (!o) return;
  hideHint();
  if (tour.on) stopTour(false);
  const vp = viewParams(o, 0); vp.dist = Math.max(m.d, o.rad*o.minZoom*1.05); vp.off = [0, 0, 0]; vp.offFn = null;
  orbit.offFn = null;
  setInfo(o.index); startFlight(o, vp, null); updateModeUI();
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
  const eff = Math.max(orbit.dist, 1e-30)*kmPerLy()/LY;
  const shown = ladDrag && ladDrag.near ? ladDrag.near.d : eff;
  ladMark.style.top = ((1 - ladFrac(shown))*100).toFixed(2) + '%';
  const key = OBJ[infoObj].key;
  let hereM = ladDrag && ladDrag.near ? ladDrag.near : null;
  for (const m of LADDER){ const here = !ladDrag && m.key === key && Math.abs(Math.log10(eff/m.d)) < 0.35; if (here) hereM = m; if (m.el._here !== here){ m.el._here = here; m.el.classList.toggle('here', here); } }
  const txt = (hereM ? hereM.name + ' · ' : '') + fmtLen(viewWidth(shown)*LY, 2);
  if (ladTxt.textContent !== txt){ ladTxt.textContent = txt; ladMark.setAttribute('aria-valuetext', 'view ' + txt + ' wide'); }
}

// ---------------------------------------------------------------- ship finder: brackets around the Halo, or an arrow at the screen edge pointing to it
const shipMarkEl = $('#shipMark'), shipArrowEl = $('#shipArrow');
function updateShipFinder(){
  const s = typeof ship !== 'undefined' ? ship : null;
  let showM = false, showA = false;
  if (s && SET.shipFinder && s.S && s.S.target && !(orbit.lock === s.index && s.rpx > 40)){
    const W = innerWidth, H = innerHeight, dtxt = 'halo · ' + fmtLen(s.dist*LY);
    const pr = projectCSS(s.rel);
    if (pr && pr.x > 24 && pr.x < W - 24 && pr.y > 24 && pr.y < H - 24){
      const r = clamp(s.rad/(pr.z*tanY)*(viewHcss/2)*1.7, 11, 70);
      shipMarkEl.style.width = shipMarkEl.style.height = (2*r).toFixed(0) + 'px';
      shipMarkEl.style.transform = `translate3d(${(pr.x - r).toFixed(1)}px, ${(pr.y - r).toFixed(1)}px, 0)`;
      const sp = shipMarkEl.lastChild; if (sp.textContent !== dtxt) sp.textContent = dtxt;
      showM = true;
    } else {
      const x = V.dot(s.rel, cam.right)/tanX, y = V.dot(s.rel, cam.up)/tanY, z = V.dot(s.rel, cam.fwd);
      let dx = x*(z < 0 ? -1 : 1), dy = -y*(z < 0 ? -1 : 1);
      if (z < 0 && Math.hypot(dx, dy) < 1e-6*Math.abs(z)) dx = 1;
      const L = Math.hypot(dx*W, dy*H) || 1; dx = dx*W/L; dy = dy*H/L;
      const m = 40, cx = W/2, cy = H/2, t = Math.min((cx - m)/Math.max(Math.abs(dx), 1e-6), (cy - m)/Math.max(Math.abs(dy), 1e-6));
      const w = shipArrowEl.offsetWidth || 110, h = shipArrowEl.offsetHeight || 20;
      let ax = clamp(cx + dx*t - w/2, 8, W - w - 8), ay = clamp(cy + dy*t - h/2, 8, H - h - 8);
      const onSide = Math.abs(dx)*(cy - m) > Math.abs(dy)*(cx - m), avoid = uiRects();
      const clash = (x, y) => avoid.some(r => x < r.right + 6 && x + w > r.left - 6 && y < r.bottom + 6 && y + h > r.top - 6);
      for (let k=1; k<40 && clash(ax, ay); k++){
        const off = Math.ceil(k/2)*24*(k % 2 ? 1 : -1);
        const nx = onSide ? ax : clamp(cx + dx*t - w/2 + off, 8, W - w - 8), ny = onSide ? clamp(cy + dy*t - h/2 + off, 8, H - h - 8) : ay;
        if (!clash(nx, ny)){ ax = nx; ay = ny; break; }
      }
      shipArrowEl.style.transform = `translate3d(${ax.toFixed(1)}px, ${ay.toFixed(1)}px, 0)`;
      shipArrowEl.firstChild.style.transform = `rotate(${(Math.atan2(dy, dx)*180/Math.PI).toFixed(0)}deg)`;
      const sp = shipArrowEl.lastChild; if (sp.textContent !== dtxt) sp.textContent = dtxt;
      showA = true;
    }
  }
  if (shipMarkEl.hidden === showM) shipMarkEl.hidden = !showM;
  if (shipArrowEl.hidden === showA) shipArrowEl.hidden = !showA;
}
const followShip = () => { if (typeof ship === 'undefined') return; hideHint(); goTo(ship.index); toast('following the Halo'); };
shipMarkEl.addEventListener('click', followShip);
shipArrowEl.addEventListener('click', followShip);

// ---------------------------------------------------------------- settings
function syncSettingsUI(){
  const v = { detail:String(detailIdx), travel:SET.travel, time:String(timeScale) };
  settingsEl.querySelectorAll('.seg').forEach(seg => { const k = seg.dataset.key; seg.querySelectorAll('button').forEach(b => b.setAttribute('aria-checked', String(b.dataset.v === v[k]))); });
  settingsEl.querySelectorAll('.tog button').forEach(b => b.setAttribute('aria-pressed', String(!!SET[b.dataset.key])));
  $('#volume').value = SET.volume;
  $('#btnSound').setAttribute('aria-pressed', String(SET.sound)); $('#btnSound').textContent = SET.sound ? 'sound' : 'sound off';
  $('#btnShip').setAttribute('aria-pressed', String(SET.shipFinder));
  $('#detailInfo').textContent = `${cols} x ${rows} characters`;
}
function setOpt(key, v, quiet){
  switch (key){
    case 'detail': detailIdx = SET.detail = clamp(v | 0, 0, DETAIL.length - 1); adaptCount = 0; resize(); if (!quiet) toast(`detail: ${DETAIL[detailIdx].name} (${cols} x ${rows} characters)`); break;
    case 'travel': SET.travel = v; if (!quiet) toast('travel: ' + v + (v === 'warp' ? ' · near-instant' : v === 'cinematic' ? ' · slow and scenic' : '')); break;
    case 'time': timeScale = +v; if (!quiet) toast(timeScale ? 'time ' + timeScale + 'x' : 'time paused'); break;
    case 'glow': SET.glow = glowOn = !!v; break;
    case 'labels': SET.labels = labelsOn = !!v; break;
    case 'twinkle': SET.twinkle = !!v; break;
    case 'shipFinder': SET.shipFinder = !!v; if (!quiet) toast(v ? 'ship finder on · the Halo is bracketed in blue' : 'ship finder off'); break;
    case 'sound': SET.sound = !!v; music.set(SET.sound); if (!quiet) toast(v ? 'music on' : 'music off'); break;
    case 'volume': SET.volume = clamp(+v, 0, 1); music.volume(); break;
  }
  saveSet(); syncSettingsUI();
}
const cycle = (list, cur) => list[(list.indexOf(cur) + 1) % list.length];
function toggleSettings(on){ settingsEl.hidden = !on; $('#btnSettings').setAttribute('aria-expanded', String(on)); if (on) syncSettingsUI(); }
settingsEl.querySelectorAll('.seg button').forEach(b => b.addEventListener('click', () => setOpt(b.parentElement.dataset.key, b.dataset.v)));
settingsEl.querySelectorAll('.tog button').forEach(b => b.addEventListener('click', () => setOpt(b.dataset.key, !SET[b.dataset.key])));
$('#volume').addEventListener('input', e => setOpt('volume', e.target.value, true));
$('#btnSettings').addEventListener('click', () => toggleSettings(settingsEl.hidden));
$('#settingsClose').addEventListener('click', () => toggleSettings(false));

// ---------------------------------------------------------------- atlas and search
const atlasList = $('#atlasList'), searchEl = $('#search'), atlasSearch = $('#atlasSearch');
const GROUPS = [['solar', 'Solar System'], ['stars', 'Stars & stellar remnants'], ['nebulae', 'Nebulae & star clusters'], ['galaxies', 'Galaxies & black holes'], ['cosmic', 'The large-scale universe'], ['travel', 'Travellers']];
const atlasRows = [];
GROUPS.forEach(([g, title]) => {
  const items = OBJ.filter(o => o.group === g && o.atlas !== false && !o.marker);
  if (!items.length) return;
  const h = document.createElement('div'); h.className = 'agroup'; h.textContent = title; atlasList.appendChild(h);
  items.sort((a, b) => (a.sortKey ?? V.len(a.pos)) - (b.sortKey ?? V.len(b.pos)));
  items.forEach(o => {
    const b = document.createElement('button'); b.className = 'arow'; b.setAttribute('role', 'option'); b.setAttribute('aria-selected', 'false');
    b.innerHTML = `<span class="an"></span><span class="ad"></span>`;
    b.querySelector('.an').textContent = o.name;
    b.querySelector('.ad').textContent = o.key === 'earth' ? 'home' : (o.atlasDist || (o.distEarth && o.distEarth.length < 14 ? o.distEarth : fmtDist(V.len(V.sub(o.pos, earth.pos)))));
    b.title = o.type;
    b.addEventListener('click', () => goTo(o.index));
    atlasList.appendChild(b); atlasRows.push({ b, o, h, text:(o.name + ' ' + (o.label || '') + ' ' + o.type + ' ' + (o.aka || '')).toLowerCase() });
  });
});
const atlasEmpty = document.createElement('div'); atlasEmpty.className = 'atlas-empty'; atlasEmpty.textContent = 'nothing found yet · try a planet, star, nebula or galaxy'; atlasEmpty.hidden = true; atlasList.appendChild(atlasEmpty);
let kbRow = -1;
function atlasMark(i){
  let cur = null;
  atlasRows.forEach(r => { const on = r.o.index === i; r.b.setAttribute('aria-selected', String(on)); if (on) cur = r; });
  if (cur && !atlasEl.hidden){ const lr = atlasList.getBoundingClientRect(), br = cur.b.getBoundingClientRect(); if (br.top < lr.top || br.bottom > lr.bottom) cur.b.scrollIntoView({ block:'nearest' }); }
}
function visibleRows(){ return atlasRows.filter(r => !r.b.hidden); }
function setKb(k){
  const vis = visibleRows(); atlasRows.forEach(r => r.b.classList.remove('kb'));
  kbRow = vis.length ? clamp(k, 0, vis.length - 1) : -1;
  if (kbRow >= 0){ vis[kbRow].b.classList.add('kb'); vis[kbRow].b.scrollIntoView({ block:'nearest' }); }
}
function toggleAtlas(on){
  atlasEl.hidden = !on; document.body.classList.toggle('atlas-open', on); $('#btnAtlas').setAttribute('aria-expanded', String(on));
  if (on){ filterAtlas(searchEl.value); const cur = atlasRows.find(r => r.o.index === infoObj); if (cur && !searchEl.value) cur.b.scrollIntoView({ block:'center' }); }
  else { atlasRows.forEach(r => r.b.classList.remove('kb')); kbRow = -1; }
}
function filterAtlas(q){
  q = q.trim().toLowerCase();
  let n = 0;
  atlasRows.forEach(r => { const hide = !!q && !q.split(/\s+/).every(w => r.text.includes(w)); r.b.hidden = hide; if (!hide) n++; });
  atlasList.querySelectorAll('.agroup').forEach(h => { let x = h.nextElementSibling, any = false; while (x && !x.classList.contains('agroup')){ if (x.classList.contains('arow') && !x.hidden) any = true; x = x.nextElementSibling; } h.hidden = !any; });
  atlasEmpty.hidden = n > 0;
  $('#atlasCount').textContent = q ? `${n} found` : `${atlasRows.length} places`;
  setKb(q ? 0 : -1);
}
function onSearchInput(e){
  const v = e.target.value; if (e.target === searchEl) atlasSearch.value = v; else searchEl.value = v;
  if (atlasEl.hidden) toggleAtlas(true);
  filterAtlas(v);
}
function onSearchKey(e){
  const vis = visibleRows();
  if (e.key === 'ArrowDown'){ e.preventDefault(); setKb(kbRow + 1); }
  else if (e.key === 'ArrowUp'){ e.preventDefault(); setKb(kbRow - 1); }
  else if (e.key === 'Enter'){ const r = vis[kbRow >= 0 ? kbRow : 0]; if (r) goTo(r.o.index); }
  else if (e.key === 'Escape'){ e.preventDefault(); e.stopPropagation(); if (e.target.value){ e.target.value = ''; searchEl.value = atlasSearch.value = ''; filterAtlas(''); } else e.target.blur(); }
}
for (const el of [searchEl, atlasSearch]){ el.addEventListener('input', onSearchInput); el.addEventListener('keydown', onSearchKey); }
searchEl.addEventListener('focus', () => { hideHint(); if (atlasEl.hidden) toggleAtlas(true); });
$('#btnAtlas').addEventListener('click', () => toggleAtlas(atlasEl.hidden));
$('#atlasClose').addEventListener('click', () => toggleAtlas(false));
function focusSearch(){ if (IS_SMALL || getComputedStyle(searchEl.parentElement).display === 'none'){ toggleAtlas(true); atlasSearch.focus({ preventScroll:true }); } else searchEl.focus({ preventScroll:true }); }

$('#prevObj').addEventListener('click', () => { hideHint(); stepObject(-1); });
$('#nextObj').addEventListener('click', () => { hideHint(); stepObject(1); });
$('#btnTour').addEventListener('click', () => { hideHint(); setTour(!tour.on); });
$('#btnFree').addEventListener('click', () => { hideHint(); unlock(); toast('free camera · W A S D to fly, drag to look around'); });
$('#btnShip').addEventListener('click', () => setOpt('shipFinder', !SET.shipFinder));
$('#btnSound').addEventListener('click', () => setOpt('sound', !SET.sound));
$('#btnHelp').addEventListener('click', () => toggleHelp(true));
$('#helpClose').addEventListener('click', () => toggleHelp(false));
$('#help').addEventListener('click', e => { if (e.target.id === 'help') toggleHelp(false); });
function toggleHelp(on){ $('#help').hidden = !on; if (on) $('#helpClose').focus(); else canvas.focus({preventScroll:true}); }
// the first click or key press is what browsers accept as permission to play sound
for (const ev of ['pointerdown', 'keydown', 'wheel', 'touchstart']) addEventListener(ev, () => music.gesture(), { capture:true, passive:true });

// ================================================================ main loop
let last = performance.now(), ema = 16, adaptCount = 0, runTime = 0, resizePending = false, refocusT = 0, lodT = 0;
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
// in free flight, keep the nearest object as the precision anchor
function refocus(dt){
  refocusT -= dt; if (refocusT > 0 || orbit.lock >= 0 || flight) return; refocusT = 0.5;
  const i = nearestObject(); if (i === cam.focus) return;
  const D = frel(OBJ[i]); cam.rel = V.sub(cam.rel, D); orbit.target = V.sub(orbit.target, D); cam.focus = i;
}
// CPU simulations (N-body collisions, gas streams, ejecta) only run while someone can see them
const simActive = o => o.vis > 0.003 || o.pvis > 0.003 || o.index === orbit.lock || (tour.on && o.index === tour.obj) || (flight && flight.obj === o);
function tick(dt){
  const sdt = dt*timeScale;
  GT += dt;
  ssDays += sdt*SS_RATE/86400;
  for (const o of OBJ){ o.t += sdt; if (o.update && (!o.sim || simActive(o))) o.update(sdt); if (o.parent && !o.selfPos) o.pos = V.add(o.parent.pos, o.offset); }
  if (flight) updateFlight(dt);
  else {
    if (tween) updateTween(dt);
    if (tour.on) updateTour(dt);
    updateKeys(dt);
    if (!tween) orbit.dist = Math.exp(Math.log(orbit.dist) + (Math.log(orbit.distT) - Math.log(orbit.dist))*(1 - Math.exp(-dt*7)));
    riseAboveDisk(dt);
    if (orbit.lock >= 0){ if (orbit.offFn && !tween) orbit.off = orbit.offFn(); orbit.target = V.add(frel(OBJ[orbit.lock]), orbit.off); }
    applyOrbit();
    refocus(dt);
  }
  for (const o of OBJ){ o.rel = V.sub(frel(o), cam.rel); o.dist = V.len(o.rel); }
  updateDrift(dt);
}
function frame(now){
  requestAnimationFrame(frame);
  if (window.__freeze){ last = now; return; }
  const dtR = Math.min((now - last)/1000, 0.25); last = now;
  const dt = Math.min(dtR, 0.05);
  tick(dt);
  render();
  updateHUD(dt);
  runTime += dtR;
  ema = ema*0.95 + dtR*1000*0.05;
  if (runTime > 2.5) progIdle(1);
  // keep motion smooth on slower devices: first trim ray-march steps, then (at most twice) use bigger characters
  lodT += dtR;
  if (!window.__noAdapt && lodT > 1 && document.visibilityState === 'visible'){
    lodT = 0;
    if (ema > 38) LODK = Math.max(0.5, LODK - 0.1); else if (ema < 24) LODK = Math.min(1, LODK + 0.05);
    if (runTime > 5 && ema > 48 && LODK <= 0.5 && adaptCount < 2 && detailIdx < DETAIL.length - 1){
      adaptCount++; runTime = 0; ema = 20; detailIdx++; resize(); toast('detail lowered to ' + DETAIL[detailIdx].name + ' for smoother motion');
    }
  }
  if (!hintHidden && performance.now() > 18000) hideHint();
}
resize();
ladTitles();
if (document.fonts) document.fonts.load('500 20px "IBM Plex Mono"').then(() => buildAtlas(cellW, cellH)).catch(() => {});
TOUR_KEYS.forEach(k => { if (BYKEY[k]) TOUR.push(BYKEY[k].index); });
$('#stopCount').textContent = String(TOUR.length).padStart(2, '0');
$('#atlasCount').textContent = `${atlasRows.length} places`;
music.set(SET.sound);
syncSettingsUI();
tick(0);
tourGo(TOUR[0], true);
tick(0);
updateModeUI();
window.__cosmos = { dbg:{ imp, impSpec, get cols(){ return cols; }, get sceneH(){ return sceneH; }, get LODK(){ return LODK; }, PROGS }, OBJ, BYKEY, tourGo, lockOn, setTour, cam, orbit, tour, TOUR, SET, setOpt, music, LADDER, goLadder,
  setDetail:i => setOpt('detail', i, true), render, zoomTo, tick, flightDur:() => flight ? flight.dur : 0, hud:() => { roTimer = 0; updateHUD(0.2); },
  simulate:(sec) => { for (let k=0; k<sec*30; k++) tick(1/30); return { obj:tour.obj, view:tour.view, phase:tour.phase, lock:orbit.lock }; },
  view:(i, v) => { if (typeof i === 'string') i = BYKEY[i].index; const o = OBJ[i], vp = viewParams(o, v); flight = null; tween = null; cam.focus = i; orbit.lock = i; orbit.frame = o.R0; orbit.yaw = vp.yaw; orbit.pitch = vp.pitch; orbit.dist = orbit.distT = vp.dist; orbit.off = vp.off; orbit.offFn = vp.offFn; orbit.target = V.add(frel(o), vp.off); setInfo(i); applyOrbit(); tick(0); } };
requestAnimationFrame(frame);
})();

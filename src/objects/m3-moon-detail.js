// ================================================================ the ground near the places on the Moon (0.27.0): each place's layers (tools/moon-detail.mjs, MOON_DETAIL.sites:
// squares from 410 km down to about a kilometre round a landing site, two files each, the colour and the heights) and the ground drawn with
// them (FS_MOON_ENV, m2-moon-gl.js). None of the images is in the page: a place's layers are fetched as the camera heads there, the widest from
// about 2,000 km away, the finest only near, and let go of two minutes after the camera has left; only the nearest place's load. Below about
// 650 km near a place, and once the whole Moon's map is in (m1-moon-map.js: the ground beyond the layers), the ground is drawn round the
// place and the globe under it is no longer drawn. Offline, in the artifact page, or before the map arrives, the globe stays.
const MDT = (() => {
  const D = typeof MOON_DETAIL !== 'undefined' ? MOON_DETAIL : { sites:[], global:null };
  const can = FLAGS.realMoon && /^https?:$/.test(location.protocol) && typeof createImageBitmap === 'function';
  const R = 1737.4;   // (km)
  const unit = (la, lo) => [Math.cos(la*DEG)*Math.cos(lo*DEG), Math.sin(la*DEG), -Math.cos(la*DEG)*Math.sin(lo*DEG)];
  const axes = u => { const e = V.norm(V.cross([0, 1, 0], u)); return { e, n:V.cross(u, e) }; };
  const sites = D.sites.map(S => ({ key:S.key, name:S.name, la:S.la, lo:S.lo, c:unit(S.la, S.lo), top:S.top, low:Math.min(...S.layers.map(L => L.low)), alb:S.alb || 0.45, used:0,
    layers:S.layers.map(L => Object.assign({}, L, { c:unit(L.la, L.lo) }, axes(unit(L.la, L.lo)), { tc:null, th:null, sc:0, sh:0, hgt:null })).sort((a, b) => a.size - b.size) }));
  const ANISO = gl.getExtension('EXT_texture_filter_anisotropic');
  // a layer's colour (with mipmaps, sharp at glancing angles) or heights (no mipmaps: their two bytes must not be averaged apart; kept on the
  // CPU too, for the camera's clearance above the ground and the landers' feet)
  function load(L, k){
    const s = k === 'c' ? 'sc' : 'sh'; if (L[s] || !can) return; L[s] = 1;
    fetch('moon/' + (k === 'c' ? L.color : L.height)).then(r => r.ok ? r.blob() : Promise.reject(r.status))
      .then(b => createImageBitmap(b, { premultiplyAlpha:'none', colorSpaceConversion:'none' }))
      .then(img => {
        if (glLost){ L[s] = 0; return; }
        const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false); gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, img);
        if (k === 'c'){ gl.generateMipmap(gl.TEXTURE_2D); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
          if (ANISO) gl.texParameterf(gl.TEXTURE_2D, ANISO.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(8, gl.getParameter(ANISO.MAX_TEXTURE_MAX_ANISOTROPY_EXT))); }
        else gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.BROWSER_DEFAULT_WEBGL);
        if (k === 'h') try { const cv = typeof OffscreenCanvas === 'function' ? new OffscreenCanvas(img.width, img.height) : Object.assign(document.createElement('canvas'), { width:img.width, height:img.height });
          const cx = cv.getContext('2d', { willReadFrequently:true }); cx.drawImage(img, 0, 0); const px = cx.getImageData(0, 0, img.width, img.height).data, a = new Float32Array(img.width*img.height);
          for (let i=0;i<a.length;i++) a[i] = L.base + (px[i*4]*256 + px[i*4 + 1])*L.step; L.hgt = a; } catch (e) { L.hgt = null; }
        if (img.close) img.close();
        if (k === 'c') L.tc = t; else L.th = t; L[s] = 2;
      })
      .catch(e => { L[s] = 3; console.info('real Moon: ' + (k === 'c' ? L.color : L.height) + ' not loaded (' + e + ')'); });
  }
  function free(L){ if (L.tc) gl.deleteTexture(L.tc); if (L.th) gl.deleteTexture(L.th); L.tc = L.th = null; L.hgt = null; L.sc = L.sh = 0; }
  const ready = L => L.sc === 2 && L.sh === 2;
  // the camera in the Moon's own frame (km)
  const camM = () => M3.applyT(moon.rot, V.mul(V.sub(cam.rel, frel(moon)), 1/KM));
  // the height above the sphere (m) at a point of the Moon's frame (km), from the finest layer in that has its heights on the CPU, else null
  function heightAt(pt, S){
    const r = V.len(pt); if (!(r > 0)) return null; const u = V.mul(pt, R/r);
    for (const s of S ? [S] : sites){ if (V.dot(u, s.c) < R*0.97) continue;
      for (const L of s.layers){ if (!L.hgt) continue;
        const q = V.sub(u, V.mul(L.c, R)), x = V.dot(q, L.e)*1000, y = V.dot(q, L.n)*1000;
        if (Math.abs(x) >= L.size/2 || Math.abs(y) >= L.size/2) continue;
        const N = L.px, fx = clamp((0.5 + x/L.size)*N - 0.5, 0, N - 1.001), fy = clamp((0.5 - y/L.size)*N - 0.5, 0, N - 1.001), i = Math.floor(fx), j = Math.floor(fy), tx = fx - i, ty = fy - j, H = L.hgt;
        return (H[j*N + i]*(1 - tx) + H[j*N + i + 1]*tx)*(1 - ty) + (H[(j + 1)*N + i]*(1 - tx) + H[(j + 1)*N + i + 1]*tx)*ty;
      } }
    return null;
  }
  // the place the ground is drawn round: the one locked on (MPL sets want), else the nearest whose widest layer the camera is over
  let want = null, last = 0;
  function nearest(cm){ const g = V.mul(cm, R/Math.max(V.len(cm), 1)); let best = null, bd = 1e9;
    for (const S of sites){ const d = V.len(V.sub(g, V.mul(S.c, R))); if (d < bd){ bd = d; best = S; } } return best ? { S:best, d:bd } : null; }
  // once a second: load what the camera heads for (only the nearest place's layers), let go of what it left two minutes ago
  function tick(){
    if (!can || GT - last < 1) return; last = GT;
    const cm = camM(), alt = V.len(cm) - R, g = V.mul(cm, R/Math.max(V.len(cm), 1)), nb = want ? { S:want, d:0 } : nearest(cm);
    for (const S of sites){
      if (nb && S === nb.S && nb.d + Math.max(alt, 0)*0.5 < 3000){
        S.used = GT;
        for (const L of S.layers){ const dL = V.len(V.sub(g, V.mul(L.c, R))) + Math.max(alt, 0)*0.7, k = L.size/1000;
          if (dL < Math.max(k*5, 25) + (k > 100 ? 2000 : 0) || S === want && k > 20){ load(L, 'c'); load(L, 'h'); } }
      }
      if (GT - S.used > 120) for (const L of S.layers) if (L.sc || L.sh) free(L);
    }
  }
  // the uniforms: up to four ready layers of the place, finest first (the fine ones only near the camera), in the place's frame
  const ub = { C:new Float32Array(16), E:new Float32Array(16), N:new Float32Array(16), X:new Float32Array(16) };
  function bind(pr, S, F, cm){
    const d = EDT.dummy(), alt = V.len(cm) - R, g = V.mul(cm, R/Math.max(V.len(cm), 1)), near = L => V.len(V.sub(g, V.mul(L.c, R))) + Math.max(alt, 0);
    let ls = S ? S.layers.filter(L => ready(L) && !(L.size < 20000 && near(L) > (L.size < 5000 ? L.size/1000*3 + 3 : L.size/1000*6 + 10))) : [];
    // (more than four ready, as at Apollo 15 and Hadley Rille with six: from low down the widest goes first, since past the horizon the
    // whole Moon's map serves; then the one whose loss costs least, how much sharper it is than the next wider one times how much of the
    // ground round the camera it holds)
    while (ls.length > 4){
      const n = ls.length; let bi = n - 1;
      if (!(ls[n - 1].size > 300000 && ls[n - 2].size >= 100000 && alt < 20)){ let bs = 1e9;
        for (let i=0;i<n-1;i++){ const L = ls[i], w = Math.max(0, 1 - near(L)/(L.size/1000*0.75)), sc = ls[i + 1].size/L.size*w; if (sc < bs){ bs = sc; bi = i; } } }
      ls.splice(bi, 1);
    }
    ub.C.fill(0); ub.E.fill(0); ub.N.fill(0); ub.X.fill(0);
    ls.forEach((L, i) => {
      const c = M3.applyT(F.M, V.mul(V.sub(V.mul(L.c, R), V.mul(S.c, R)), 1000)), e = M3.applyT(F.M, L.e), n = M3.applyT(F.M, L.n);
      ub.C.set([c[0], c[1], c[2], L.size/2], i*4); ub.E.set([e[0], e[1], e[2], 0], i*4); ub.N.set([n[0], n[1], n[2], 0], i*4); ub.X.set([L.px, L.base, L.step, 0], i*4);
    });
    gl.uniform4fv(pr.u.uMdC, ub.C); gl.uniform4fv(pr.u.uMdE, ub.E); gl.uniform4fv(pr.u.uMdN, ub.N); gl.uniform4fv(pr.u.uMdX, ub.X);
    // (the shell the march starts from: the place's highest ground, or the whole Moon's from high up, where far mountains can show)
    const G = MOON_DETAIL.global, top = Math.max(S ? S.top : 0, alt > 15 ? 10800 : 0), low = Math.min(S ? S.low : 0, -9200);
    gl.uniform4f(pr.u.uMdS, ls.length, top, low, 0);
    for (let i=0;i<4;i++){
      gl.activeTexture(gl.TEXTURE22 + i); gl.bindTexture(gl.TEXTURE_2D, ls[i] ? ls[i].tc : d); gl.uniform1i(pr.u['uMc' + i], 22 + i);
      gl.activeTexture(gl.TEXTURE26 + i); gl.bindTexture(gl.TEXTURE_2D, ls[i] ? ls[i].th : d); gl.uniform1i(pr.u['uMh' + i], 26 + i);
    }
    gl.activeTexture(gl.TEXTURE0);
    if (ls.length) S.used = GT;
    return ls;
  }
  const has = S => !!S && S.layers.some(ready);
  return { sites, tick, bind, heightAt, camM, nearest, has, R, set want(S){ want = S || null; }, get want(){ return want; },
    get ready(){ return sites.flatMap(S => S.layers.filter(ready).map(L => S.key + '-' + L.id)); } };
})();
// ---------------------------------------------------------------- drawing the ground round a place (after the Moon's own volume; the globe under it is not drawn once it covers it)
const MENV = { on:false, fade:0, site:null, alt:1e9, layers:0 };
function moonEnvOn(){ return FLAGS.realMoon && MDT.sites.length > 0; }
function drawMoonEnv(){
  MENV.on = false;
  // (without the map only once a place's own layers are in: offline nothing loads, and the painted globe stays)
  if (!moonEnvOn() || !progReady(P.moonEnv) || (!MGL.ready() && !MDT.has(MDT.want))) return;
  const cm = MDT.camM(), alt = V.len(cm) - MDT.R; MENV.alt = alt;
  if (!(alt < 700) || alt < -20) return;
  const nb = MDT.want ? { S:MDT.want, d:V.len(V.sub(V.mul(cm, MDT.R/Math.max(V.len(cm), 1)), V.mul(MDT.want.c, MDT.R))) } : MDT.nearest(cm); if (!nb || nb.d > 900) return;
  const S = nb.S, fade = 1 - smooth(450, 680, alt);
  if (fade < 0.01) return;
  MENV.on = true; MENV.fade = fade; MENV.site = S;
  const F = enuOf(S.c), Rw = M3.mul(moon.rot, F.M), cl = M3.applyT(F.M, V.mul(V.sub(cm, V.mul(S.c, MDT.R)), 1000));
  const toSite = w => M3.applyT(F.M, M3.applyT(moon.rot, w));
  const L = toSite(sunDirFrom(moon)), Ew = V.norm(V.sub(earth.rel, moon.rel)), E = toSite(Ew);
  // (earthshine: Earth's lit share as seen from the Moon, shown brighter than it is, so the night side is dimly there; ACCURACY.md)
  const sunE = V.norm(V.sub(sun.rel, earth.rel)), lit = (1 + V.dot(sunE, V.mul(Ew, -1)))/2;
  const rel = V.add(moon.rel, V.mul(M3.apply(moon.rot, V.mul(S.c, MDT.R)), KM));
  const lm = typeof MPL !== 'undefined' ? MPL.landerOf(S, F) : null;
  drawVolume(moon, P.moonEnv, rel, V.len(rel)*4 + 1e-3, p => {
    const ls = MDT.bind(p, S, F, cm); MENV.layers = ls.length;
    MGL.bindMaps(p, 'uMgC', 'uMgH');
    gl.uniform4f(p.u.uMg, MGL.ready() ? 1 : 0, MGL.H ? MGL.H.base : 0, MGL.H ? MGL.H.step : 1, 0);
    gl.uniformMatrix3fv(p.u.uMgM, false, F.M);
    gl.uniform4f(p.u.uP0, cl[0], cl[1], cl[2], fade); gl.uniform4f(p.u.uP1, L[0], L[1], L[2], MDT.heightAt(cm, S) ?? 0); gl.uniform4f(p.u.uP2, E[0], E[1], E[2], 0.07*lit);
    // (the exposure near the ground, as the eyes adjust: level ground of the place's usual brightness in the middle of the view comes out at
    // about 0.45 in display terms whatever the Sun's height and the view, by the shader's light law, so slopes toward the Sun read brighter
    // and slopes away darker; the lander keeps a fixed one, a little more when the Sun is very low. uP3.x: the relief's exaggeration from high up)
    const fw = toSite(cam.fwd), mu0 = Math.max(L[1], 0.05), mu = Math.max(-fw[1], 0.03), ga = Math.acos(clamp(-V.dot(L, fw), -1, 1)), gd = ga/DEG;
    const LL = clamp(1 + gd*(-0.019 + gd*(0.000242 - gd*0.00000146)), 0, 1), lgt = (2*LL*mu0/(mu0 + mu) + (1 - LL)*mu0)*clamp(Math.exp(-0.45*(ga - 1.047)), 0.6, 1.25);
    // (the brightness it aims at: the ground's mean in the smallest of the place's layers that holds the view, eased, so a close look at the
    // dark sea round a lander and a wide one over bright mountains both fill the characters' range)
    const lk = OBJ[orbit.lock], vD = lk && lk.moonSpot && !flight ? orbit.dist/KM*1000 : Math.max(alt, 0.3)*3000;
    const Lr = S.layers.find(l => l.size >= 1.5*vD) || S.layers[S.layers.length - 1], ab = Lr.alb || S.alb;
    MENV.alb = MENV.site0 === S && MENV.alb ? MENV.alb + (ab - MENV.alb)*0.06 : ab; MENV.site0 = S;
    const expo = clamp(0.5/(MENV.alb*Math.pow(lgt, 0.8)), 0.6, 5), lmExpo = 1.75*clamp(Math.pow(0.34/Math.max(L[1], 0.08), 0.25), 1, 1.4);
    MENV.expo = expo;
    gl.uniform4f(p.u.uP3, 3, 0, expo, lmExpo); gl.uniform4f(p.u.uP4, GT, 0, 2.5e6, 0);
    if (lm){ gl.uniform4f(p.u.uLm0, lm.x, lm.z, lm.h, lm.yaw); gl.uniform4f(p.u.uLm1, 1, 1, 0, 0); } else gl.uniform4f(p.u.uLm1, 0, 0, 0, 0);
  }, Rw, 1);
}
{ const prev = moon.drawAfter; moon.drawAfter = vis => { if (prev) prev(vis); drawMoonEnv(); }; }
// (while the ground covers the screen below the horizon, the globe under it is not drawn: its sphere would show past low ground)
moon.volOff = () => MENV.on && MENV.fade > 0.999;
{ const prev = moon.update; moon.update = function(dt){ prev.call(this, dt); MDT.tick(); }; }

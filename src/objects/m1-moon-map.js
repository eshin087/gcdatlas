// ================================================================ the whole Moon from NASA's maps (0.27.0, the owner's pick: the real Moon everywhere, so the places on it
// blend in): LRO's WAC mosaic (the albedo, normalized to one lighting so the page lights it with the real Sun, and a little of its real colour)
// and LOLA's heights, made by tools/moon-detail.mjs (MOON_DETAIL.global) and served next to the page as moon/global-*.webp, 4096 x 2048 on a
// desk and 2048 x 1024 on a phone. None is in the page: they are fetched when the Moon grows past a small disc on the screen (or the camera
// heads for a place on it) and let go of a minute after it has shrunk away. The Moon's copy of its surface shader that reads them (P.moonMap,
// FS_PLANETG with MOON_MAP) compiles in the background; until both maps and that copy are ready, and offline (the artifact page), the
// painted Moon stays. The ground near the places (m3-moon-detail.js) reads the same maps beyond its own layers.
const MGL = (() => {
  const G = typeof MOON_DETAIL !== 'undefined' ? MOON_DETAIL.global : null;
  const can = !!G && FLAGS.realMoon && /^https?:$/.test(location.protocol) && typeof createImageBitmap === 'function';
  const SZ = !isCompact() && gl.getParameter(gl.MAX_TEXTURE_SIZE) >= 4096 ? 4096 : 2048;
  const fC = G ? G.color.find(x => x.w === SZ) || G.color[0] : null, fH = G ? G.height.find(x => x.w === SZ) || G.height[0] : null;
  const T = { c:null, h:null }, S = { c:0, h:0 };   // (state: 0 none, 1 loading, 2 ready, 3 failed)
  let fade = 0, seen = -1e9, last = -1e9, off = false, want = false;
  P.moonMap = program(VS_RECT, COMMON + '#define KIND 6\n#define MOON_MAP\n' + FS_PLANETG);
  // a map, as it is in the file (no colour conversion): the colour with mipmaps, the heights without (their two bytes must not be averaged
  // apart), both round the Moon east to west and clamped at the poles
  function load(k, f){
    if (S[k] || !can) return; S[k] = 1;
    fetch('moon/' + f.file).then(r => r.ok ? r.blob() : Promise.reject(r.status))
      .then(b => createImageBitmap(b, { premultiplyAlpha:'none', colorSpaceConversion:'none' }))
      .then(img => {
        if (glLost){ S[k] = 0; return; }
        const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false); gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, img);
        if (k === 'c'){ gl.generateMipmap(gl.TEXTURE_2D); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); }
        else gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.BROWSER_DEFAULT_WEBGL);
        if (img.close) img.close();
        T[k] = t; S[k] = 2;
      })
      .catch(e => { S[k] = 3; console.info('real Moon: ' + f.file + ' not loaded (' + e + ')'); });
  }
  function free(){ for (const k of ['c', 'h']){ if (T[k]) gl.deleteTexture(T[k]); T[k] = null; S[k] = 0; } fade = 0; }
  const ready = () => S.c === 2 && S.h === 2 && !off;
  // twice a second: fetch the maps for a near Moon (or one the camera is heading for), let go of them a minute after it has gone; draw the
  // Moon with its map copy once the maps and that copy are ready
  // (0.27.6, owner: the map came in about a second after the camera had arrived, and the change was jarring. The maps are fetched and the
  // map copy compiled, side by side, from the moment the camera heads for the Moon or anything on it, and from a smaller disc: a flight
  // there then lands on the map)
  const onMoon = o => !!o && (o === moon || o.surfOf === moon || o.parent === moon);
  function tick(){
    if (!can || GT - last < 0.5) return; last = GT;
    const heading = onMoon(OBJ[orbit.lock]) || (!!flight && (onMoon(flight.obj) || onMoon(flight.dest)));
    if ((moon.rpx > 14 && !moon.hidden) || want || heading){ seen = GT; load('c', fC); load('h', fH); progReady(P.moonMap); }
    if (GT - seen > 60 && (T.c || T.h)) free();
    moon.prog = ready() && progReady(P.moonMap) ? P.moonMap : planetProg(6);
  }
  // the maps on texture units 20 and 21 (above everything else the page binds), for the Moon's globe or the ground near a place
  function bindMaps(pr, uC, uH){
    const d = EDT.dummy();
    gl.activeTexture(gl.TEXTURE20); gl.bindTexture(gl.TEXTURE_2D, T.c || d); gl.uniform1i(pr.u[uC], 20);
    gl.activeTexture(gl.TEXTURE21); gl.bindTexture(gl.TEXTURE_2D, T.h || d); gl.uniform1i(pr.u[uH], 21);
    gl.activeTexture(gl.TEXTURE0);
  }
  // the globe's uniforms: how far the map has faded in, the relief's exaggeration (three times: from orbit the real slopes are too gentle
  // to read in characters; ACCURACY.md), the colour's level of detail (about a texel a pixel). The fade goes by the clock, not by frames,
  // and by the Moon's size on the screen (0.27.6): at once on a disc of a few characters, where nothing of it can be told apart, up to
  // 3 s on a big one, eased at both ends, so the painted Moon dissolves into the real one and never pops
  let bindAt = -1;
  function bind(pr){
    if (!pr.u.uMg) return;
    const dt = bindAt < 0 ? 0 : clamp(GT - bindAt, 0, 0.1); bindAt = GT;
    const sz = clamp((moon.rpx - 10)/30, 0, 1), T = 3*sz*sz*(3 - 2*sz);   // (rpx is about 53 at the Moon's first angle)
    fade = !ready() ? 0 : T < 0.05 ? 1 : Math.min(1, fade + dt/T);
    bindMaps(pr, 'uMgC', 'uMgH');
    gl.uniform4f(pr.u.uMg, fade*fade*(3 - 2*fade), 0, 3, Math.log2(Math.max(SZ/(4*Math.max(moon.rpx, 1)), 1)));
    gl.uniform4f(pr.u.uMgS, fH.base, fH.step, 0, 0);
  }
  if (G){
    { const prev = moon.setU; moon.setU = function(pr){ prev.call(this, pr); bind(pr); }; }
    { const prev = moon.update; moon.update = function(dt){ prev.call(this, dt); tick(); }; }
    // (the credit while the map shows)
    { const prev = moon.readout; moon.readout = () => { const t = prev(); return fade > 0.5 && orbit.lock === moon.index ? t + '\nmap: NASA LRO (LROC WAC mosaic, LOLA heights)' : t; }; }
  }
  return { SZ, bindMaps, ready, H:fH, tick, set want(v){ want = !!v; }, set off(v){ off = !!v; fade = 0; }, get on(){ return fade > 0; }, get fade(){ return fade; },
    get state(){ return { c:S.c, h:S.h, prog:moon.prog === P.moonMap, fade:+fade.toFixed(3) } } };
})();

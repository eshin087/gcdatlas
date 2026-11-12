// ================================================================ the living planet (0.26.0, phase 5 of docs/EARTH_PLAN.md): this week's earthquakes and the last day's fires on the
// real Earth, from our own /api/quakes (USGS, the past 7 days, magnitude 2.5 and over) and /api/fires (NASA FIRMS, VIIRS 375 m detections of
// the last 24 hours on a 0.1 degree grid); docs/LIVE_DATA.md says what they answer. The owner's picks (2026-11-08): calm marks, a toast for a
// quake of magnitude 7 or more in the last day (once a visit), and an angle of Earth's own over the week's largest. Fetched only over http(s),
// while Earth is big on screen and the switch is on (settings, show: quakes & fires), again after each answer's cache time; let go of a minute
// after Earth has shrunk away. Without /api (the artifact page, file://, offline, an error) nothing is drawn and nothing is said.
//   - Quakes (glowing spots since 0.28.5, owner's pick from stills: the rings, one-pixel lines, broke into dotted circles of : and ' all over
//     the ocean): a spot at each epicentre of magnitude 3.5 and over, bigger and brighter with magnitude (QSPOT), coloured by depth (red under
//     70 km, violet to 300, blue below: never the orange of the fires and the city lights), full for their first hour and fading over the week
//     by their real age. No standing rings, except round the quake in view (25 km x 2^(M - 2.5) in radius, far bigger than the real break in
//     the rock: the readouts say so), and only once it spans a few characters. The newest one pings: a ring that swells and fades every 3.6 s. The quake in view (a
//     place object set to it, or Earth's angle over the largest while it plays) keeps its ring and ping whatever its age. The replay plays the
//     week in REP.T seconds on a clock of its own (each quake pings as it comes); the atlas clock goes on as it was.
//   - Fires and heat sources: a warm point per cell, brightest on the night side (sunlight hides real fires), added up on coarser grids for
//     wider views (0.1, 0.5 and 2 degrees, eased between by the size of a cell on screen: about a character a point), thinned by power and
//     dimmed toward the limb, where the cells crowd together on the screen. While they show, the made-up fire fronts of FS_EARTH's fire
//     seasons are switched off (uFire).
// They mean something only near today: shown while the atlas clock is within 2 days before and 30 days after the real now (the satellites'
// window), never in Earth's story; their ages always go by the real clock. Points and lines are not depth-tested against volumes: the vertex
// shaders hide whatever the globe covers (the ray from the camera meets it first). Nothing per frame grows with the number of quakes or fires:
// the buffers are filled once an answer, the rest is uniforms.
const QK = (() => {
  const can = FLAGS.realEarth && FLAGS.live && FLAGS.livePlanet && /^https?:$/.test(location.protocol) && !/claude|usercontent|anthropic/.test(location.hostname) && typeof fetch === 'function';
  const R = EARTH_R, UNIT = ((R + 6)/EARTH_B).toFixed(6);   // (the marks 6 km over the sea, in the unit of Earth's particles)
  const unit = (la, lo) => [Math.cos(la*DEG)*Math.cos(lo*DEG), Math.sin(la*DEG), -Math.cos(la*DEG)*Math.sin(lo*DEG)];
  const now = () => Date.now()/1000, rjd = () => Date.now()/86400000 + 2440587.5;   // (the real clock: the marks' ages; GT paces the fetches)
  // how strong the marks are (calm: owner, 2026-11-08), and how far down the fires are thinned at each level (their strength, 0 to 1.3)
  const K = { dot:5, ring:2.2, fire:2.0, day:0.12 }, CUT = [0.16, 0.24, 0.3];
  // the spots: the smallest magnitude drawn (all of them in the replay and the quake in view), how much a spot grows a magnitude over that
  // (times the spot's size, 1.7 px), and their brightness over K.dot
  const QSPOT = { minM:3.5, grow:1.3, gain:2.2 };
  // ---------------------------------------------------------------- shaders (one small vertex shader each; FS_POINT and FS_LINE)
  const HEAD = `#version 300 es
layout(location=0) in vec4 aP; layout(location=1) in vec4 aC;
uniform mat3 uCamRot; uniform vec2 uTan; uniform vec3 uRel; uniform mat3 uRot; uniform float uRad; uniform float uVis; uniform float uPixAng; uniform float uSB; uniform float uSize; uniform float uOut;
uniform vec4 uQ0; uniform vec4 uQ1;
out vec3 vC;
// 0 where the globe (radius r round e, both camera-relative) hides the point w: the ray from the camera meets it first
float seen(vec3 w, vec3 e, float r){ float L = length(w), b = dot(e, w)/L, h = b*b - dot(e, e) + r*r;
  if(h <= 0.) return 1.; float t0 = b - sqrt(h); return t0 > 0. && t0 < L ? 0. : 1.; }
`;
  // quakes: aP = (the epicentre, a unit vector in Earth's frame; the ring's angle), aC = (seconds after Q.ref, magnitude, depth km, kind: 0 the
  // dot or the ring, 1 its ping, + 2 for the newest). uQ0 = (now, seconds after Q.ref; quake seconds a second; strength; a clock for the
  // ping), uQ1 = (1 in a replay; the quake in view: its seconds after Q.ref and its magnitude; fade)
  const VS_QK = HEAD + `
// (by depth, red to violet to blue: never the orange of the fires and the city lights)
vec3 depthCol(float d){ return d < 70. ? vec3(1., .28, .38) : d < 300. ? vec3(.9, .42, 1.) : vec3(.5, .65, 1.); }
// by age in hours: full for the first hour, under half after a day, faint for the rest of the week
float ageK(float h){ return h < 1. ? 1. : max(pow(1. + 0.12*(h - 1.), -0.6), 0.14); }
void main(){
  vec3 c = aP.xyz, p; float m = aC.y, a = uQ0.x - aC.x, h = a/3600.;
  float br = (a < 0. ? 0. : 1.)*uQ0.z*(0.45 + 0.55*smoothstep(2.5, 6.5, m));
  vec3 col = depthCol(aC.z);
  // (the quake in view, a place object set to it or Earth's angle over the largest: its ring and its ping whatever its age)
  float foc = abs(aC.x - uQ1.y) < 0.5 && abs(m - uQ1.z) < 0.05 ? 1. : 0.;
  br *= uQ1.x > 0.5 ? 1. : max(step(${QSPOT.minM.toFixed(2)}, m), foc);
#ifdef RING
  float al = min(25.*exp2(m - 2.5), 1800.)/6371.;
  if(mod(aC.w, 2.) > 0.5){
    // (the ping: in a replay each quake as it comes, live the newest every 3.6 s; it swells from a fifth of the ring to 1.4 times it)
    float ph = uQ1.x > 0.5 ? a/uQ0.y/1.8 : (aC.w > 1.5 || foc > 0.5 ? fract(uQ0.w/3.6) : 9.);
    br *= ph < 1. ? 1.7*(1. - ph)*(1. - ph)*smoothstep(0., 0.06, ph) : 0.;
    al *= 0.2 + 1.2*min(ph, 1.);
  } else br *= foc;
  vec3 e = normalize(cross(abs(c.y) < 0.99 ? vec3(0., 1., 0.) : vec3(1., 0., 0.), c)), n = cross(c, e);
  p = (c*cos(al) + (e*cos(aP.w) + n*sin(aP.w))*sin(al))*${UNIT};
#else
  br *= max(ageK(h), 0.9*foc);
  p = c*${UNIT};
#endif
  vec3 w = uRel + uRot*(p*uRad), v = w*uCamRot;
  br *= seen(w, uRel, uRad*0.8915)*uQ1.w;
#ifndef RING
  br *= smoothstep(0., 0.12, dot(uRot*c, -w)/length(w));   // (a dot right on the limb would float off it)
#endif
  gl_Position = vec4(v.x/uTan.x, v.y/uTan.y, 0., v.z);
#ifdef RING
  // (a ring only once it spans a few characters: smaller, the dot says it all)
  br *= v.z > 0. ? smoothstep(2.5, 6., sin(al)*0.8929*uRad/(v.z*uPixAng)) : 0.;
  gl_PointSize = 1.; vC = col*br*uSB*uOut*uVis;
#else
  if(v.z <= 0. || br <= 0.){ gl_Position = vec4(2., 2., 0., 1.); gl_PointSize = 1.; vC = vec3(0.); return; }
  gl_PointSize = uSize*(1. + ${QSPOT.grow.toFixed(2)}*max(m - ${QSPOT.minM.toFixed(2)}, 0.)); vC = col*br*uSB*uOut*uVis*${QSPOT.gain.toFixed(2)};
#endif
}`;
  // fires: aP = (the cell's middle in Earth's frame; its strength, 0 to 1.3 from its power), aC.x its size in pixels. uQ0 = (this level's
  // share x strength; the share left by day; the cut; 0), uQ1 = (the Sun's direction in Earth's frame; fade)
  const VS_FIRE = HEAD + `
void main(){
  vec3 n = aP.xyz, p = n*${UNIT};
  float b = aP.w, night = smoothstep(0.06, -0.12, dot(n, uQ1.xyz));
  float br = uQ0.x*pow(b, 1.4)*(uQ0.y + (1. - uQ0.y)*night)*step(uQ0.z, b);
  vec3 col = mix(vec3(1., .5, .12), vec3(1., .86, .6), smoothstep(0.85, 1.25, b));
  vec3 w = uRel + uRot*(p*uRad), v = w*uCamRot;
  // (seen at a slant, toward the limb, the cells crowd together on the screen: each is dimmer by as much, so the light per area holds and
  // the limb never piles up into a bright arc)
  float mu = dot(uRot*n, -w)/length(w);
  br *= seen(w, uRel, uRad*0.8915)*uQ1.w*clamp(1.25*mu, 0., 1.)*smoothstep(0.02, 0.12, mu);
  gl_Position = vec4(v.x/uTan.x, v.y/uTan.y, 0., v.z);
  if(v.z <= 0. || br <= 0.002){ gl_Position = vec4(2., 2., 0., 1.); gl_PointSize = 1.; vC = vec3(0.); return; }
  gl_PointSize = aC.x; vC = col*br*uSB*uOut*uVis;
}`;
  P.qkDot = program(VS_QK, FS_POINT); P.qkRing = program(VS_QK.replace('#version 300 es', '#version 300 es\n#define RING'), FS_LINE); P.qkFire = program(VS_FIRE, FS_POINT);
  // ---------------------------------------------------------------- state
  const F = { q:{ url:'/api/quakes', every:300, state:0, at:-1e9, tried:-1e9, busy:false }, f:{ url:'/api/fires', every:7200, state:0, at:-1e9, tried:-1e9, busy:false } };
  let epoch = 0;   // (counts the frees: an answer to a request made before the last one is dropped)
  const Q = { rows:null, ref:0, gen:0, from:0, big:null, newest:null, n5:0, dots:null, ring:null, byM:null };
  const FI = { n:0, raw:0, src:'', from:0, to:0, lv:[] };
  const REP = { on:false, t:0, T:40 };
  const W = [0, 0, 1], U = { q0:new Float32Array(4), q1:new Float32Array(4), f0:[0, 1, 2].map(() => new Float32Array(4)), f1:new Float32Array(4) };
  const on = () => can && SET.quakes && !(EARTH_ERA.ya > 69) && !SKYV.on && timeOk();
  function timeOk(){ const d = jdNow() - rjd(); return d > -2 && d < 30; }
  const ringKm = m => Math.min(25*2**(m - 2.5), 1800);
  // ---------------------------------------------------------------- fetching
  const get = (url, ms) => Promise.race([fetch(url).then(r => r.ok ? r.json() : Promise.reject(r.status)), new Promise((_, no) => setTimeout(() => no('timeout'), ms))]);
  function load(k){
    const f = F[k], e0 = epoch; f.busy = true; f.tried = GT; if (f.state !== 2) f.state = 1;
    get(f.url, 15000).then(j => { if (e0 !== epoch) return; (k === 'q' ? applyQ : applyF)(j); f.at = GT; f.state = 2; })
      .catch(e => { if (e0 !== epoch) return; if (f.state !== 2) f.state = 3; console.info((k === 'q' ? 'earthquakes' : 'fires') + ' unavailable (' + e + ')'); })
      .finally(() => { if (e0 === epoch) f.busy = false; });
  }
  function freePS(ps){ if (!ps || glLost) return; gl.deleteBuffer(ps.b0); gl.deleteBuffer(ps.b1); gl.deleteVertexArray(ps.vao); }
  // ---- quakes: rows (oldest first, the replay's order), their dots and rings
  function applyQ(j){
    if (!j || !Array.isArray(j.quakes)) throw 'no list';
    const rows = [];
    for (const r of j.quakes){
      if (!Array.isArray(r)) continue;
      const [t, la, lo, d, m, pl] = r;
      if (![t, la, lo, d, m].every(Number.isFinite) || Math.abs(la) > 90 || Math.abs(lo) > 180) continue;
      rows.push({ t, la, lo, d:Math.max(d, 0), m:clamp(m, 0, 9.9), pl:String(pl ?? '').slice(0, 64) });
    }
    if (!rows.length) throw 'no earthquakes';
    rows.sort((a, b) => a.t - b.t);
    const gen = Number.isFinite(j.generated) ? j.generated : rows[rows.length - 1].t, from = Number.isFinite(j.from) ? j.from : gen - 7*86400;
    // (the ping goes to the newest quake that is drawn as a spot)
    const ref = from, newest = rows[rows.length - 1], pinged = rows.filter(q => q.m >= QSPOT.minM).pop() || newest, segs = m => m < 5 ? 24 : m < 6 ? 36 : 48;
    let nv = 0; for (const q of rows) nv += 4*segs(q.m);
    const dots = makePS(rows.length), ring = makePS(nv);
    let k = 0;
    rows.forEach((q, i) => {
      const u = unit(q.la, q.lo), tr = q.t - ref, nw = q === pinged ? 2 : 0, N = segs(q.m);
      dots.a.set([u[0], u[1], u[2], 0], i*4); dots.c.set([tr, q.m, q.d, nw], i*4);
      for (let kind = 0; kind < 2; kind++) for (let s = 0; s < N; s++) for (const e of [s, s + 1]){
        ring.a.set([u[0], u[1], u[2], e/N*2*Math.PI], k*4); ring.c.set([tr, q.m, q.d, kind ? 1 + nw : 0], k*4); k++; }
    });
    dots.upload('ac'); ring.upload('ac');
    freePS(Q.dots); freePS(Q.ring);
    const byM = rows.slice().sort((a, b) => b.m - a.m || b.t - a.t);
    Object.assign(Q, { rows, ref, gen, from, newest, dots, ring, byM, big:byM[0], n5:rows.filter(q => q.m >= 5).length });
    dotSpec.ps = dots; ringSpec.ps = ring;
    // (a place object already set to a quake, from a link opened before the list was in: dressed now)
    for (const o of EPL.spots) if (isQuakeSpot(o)){ dress(o, o.place.row); if (uiReady && infoObj === o.index) setInfo(o.index); }
  }
  // ---- fires: three levels, each sorted by power, the strongest first
  const FB = 1/Math.log2(1 + 2135/5), strength = frp => Math.min(Math.log2(1 + Math.max(frp, 0)/5)*FB, 1.3);
  const LEVELS = [0, 0.5, 2], LKM = [11.1, 55.6, 222];
  function level(rows, c, cut){
    let cells;
    if (!c) cells = rows.map(r => ({ u:unit(r[0], r[1]), det:r[2], frp:r[3] }));
    else {
      const m = new Map();
      for (const r of rows){
        const key = Math.floor((r[0] + 90)/c)*1000 + Math.floor((r[1] + 180)/c), u = unit(r[0], r[1]), w = r[3] + 0.5;
        let a = m.get(key); if (!a){ a = { s:[0, 0, 0], det:0, frp:0 }; m.set(key, a); }
        a.s[0] += u[0]*w; a.s[1] += u[1]*w; a.s[2] += u[2]*w; a.det += r[2]; a.frp += r[3];
      }
      // (each at the middle of its fires, weighted by their power: a coarse point sits on the fire, not on its square)
      cells = [...m.values()].map(a => ({ u:V.norm(a.s), det:a.det, frp:a.frp }));
    }
    cells.sort((a, b) => b.frp - a.frp);
    const ps = makePS(Math.max(cells.length, 1));
    let n = 0;
    cells.forEach((x, i) => { const s = strength(x.frp); if (s >= cut) n = i + 1;
      ps.a.set([x.u[0], x.u[1], x.u[2], s], i*4); ps.c.set([clamp(1.5 + 0.55*Math.log2(1 + x.det/3), 1.5, 3.6), 0, 0, 0], i*4); });
    ps.upload('ac');
    return { ps, n, all:cells.length, top:cells.length ? Math.round(cells[0].frp) : 0, sum:Math.round(cells.reduce((a, x) => a + x.frp, 0)) };
  }
  function applyF(j){
    if (!j || !Array.isArray(j.fires)) throw 'no list';
    const rows = j.fires.filter(r => Array.isArray(r) && r.length >= 4 && r.slice(0, 4).every(Number.isFinite) && Math.abs(r[0]) <= 90 && Math.abs(r[1]) <= 180);
    if (!rows.length) throw 'no fires';
    const lv = LEVELS.map((c, i) => level(rows, c, CUT[i]));
    FI.lv.forEach(L => freePS(L.ps));
    Object.assign(FI, { lv, n:rows.length, raw:Number.isFinite(j.raw) ? j.raw : 0, src:String(j.source || '').slice(0, 30), from:Number.isFinite(j.from) ? j.from : 0, to:Number.isFinite(j.to) ? j.to : now() });
    lv.forEach((L, i) => { fireSpecs[i].ps = L.ps; });
  }
  function free(){
    freePS(Q.dots); freePS(Q.ring); FI.lv.forEach(L => freePS(L.ps));
    Object.assign(Q, { rows:null, big:null, newest:null, byM:null, dots:null, ring:null }); FI.lv = []; FI.n = 0;
    F.q.state = F.f.state = 0; F.q.busy = F.f.busy = false; epoch++; REP.on = false;
  }
  // ---------------------------------------------------------------- drawing: Earth's particle systems
  function prep(){
    const alt = earth.dist/KM - R;
    // (gone near the ground, where the cities and places draw their own; and while Earth is too small for them to mean anything)
    const fade = smooth(60, 250, alt)*smooth(16, 32, earth.rpx);
    U.q0[0] = (REP.on ? Q.from + REP.t/REP.T*(Q.gen - Q.from) : now()) - Q.ref; U.q0[1] = REP.on ? (Q.gen - Q.from)/REP.T : 1; U.q0[2] = 1; U.q0[3] = GT % 36;
    const fq = focusQ(); U.q1[0] = REP.on ? 1 : 0; U.q1[1] = fq ? fq.t - Q.ref : -1e9; U.q1[2] = fq ? fq.m : -9; U.q1[3] = fade;
    // (the fires' level: about one point a character, eased between the levels by the size of a cell at the point under the camera)
    const kpp = Math.max(alt, 1)*2*tanY/sceneH, up0 = smooth(1.6, 2.6, LKM[0]/kpp), up1 = smooth(1.6, 2.6, LKM[1]/kpp);
    W[0] = up0; W[1] = up1*(1 - up0); W[2] = 1 - up1;
    // (by day sunlight hides real fires: a faint share up close, almost none from afar)
    const day = K.day*(1 - 0.8*smooth(1500, 8000, alt));
    // (during the replay of the week's quakes, the day's fires step back)
    for (let i = 0; i < 3; i++){ U.f0[i][0] = W[i]*(REP.on ? 0.3 : 1); U.f0[i][1] = day; U.f0[i][2] = CUT[i]; }
    const s = M3.applyT(earth.rot, sunDirFrom(earth)); U.f1[0] = s[0]; U.f1[1] = s[1]; U.f1[2] = s[2]; U.f1[3] = fade;
  }
  const base = { mode:3, size:1, rot:() => earth.rot, rad:EARTH_B*KM };
  const dotSpec = Object.assign({ ps:null, prog:'qkDot', sb:K.dot, size:1.7, show:() => { if (!(on() && Q.dots)) return false; prep(); return U.q1[3] > 0.003; }, q0:() => U.q0, q1:() => U.q1, count:() => Q.rows.length }, base, { size:1.7 });
  const ringSpec = Object.assign({ ps:null, prog:'qkRing', lines:true, sb:K.ring, show:() => { if (!(on() && Q.ring)) return false; prep(); return U.q1[3] > 0.003; }, q0:() => U.q0, q1:() => U.q1 }, base);
  const fireSpecs = [0, 1, 2].map(i => Object.assign({ ps:null, prog:'qkFire', sb:K.fire, show:() => { if (!(on() && FI.lv[i] && FI.lv[i].n)) return false; prep(); return W[i] > 0.01 && U.f1[3] > 0.003; },
    q0:() => U.f0[i], q1:() => U.f1, count:() => FI.lv[i].n }, base));
  earth.particles.push(...fireSpecs, ringSpec, dotSpec);
  // (the made-up fire fronts of the fire seasons go while the real fires show)
  { const prev = earth.setU; earth.setU = function(pr){ prev.call(this, pr); if (pr.u.uFire && on() && FI.n) gl.uniform4f(pr.u.uFire, 0, 0, 0, 0); }; }
  // ---------------------------------------------------------------- words
  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'], DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const MONTH = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const fmtN = n => n.toLocaleString('en-US'), magTxt = m => 'M ' + m.toFixed(1);
  const p2 = x => String(x).padStart(2, '0');
  const dateTxt = t => { const d = new Date(t*1000); return `${DAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MON[d.getUTCMonth()]}, ${p2(d.getUTCHours())}:${p2(d.getUTCMinutes())} UTC`; };
  const longDate = t => { const d = new Date(t*1000); return `${d.getUTCDate()} ${MONTH[d.getUTCMonth()]} ${d.getUTCFullYear()} at ${p2(d.getUTCHours())}:${p2(d.getUTCMinutes())} UTC`; };
  function ago(s){
    if (s < 90) return 'just now';
    if (s < 3600) return Math.round(s/60) + ' minutes ago';
    if (s < 36*3600){ const h = Math.round(s/3600); return h === 1 ? 'an hour ago' : h + ' hours ago'; }
    return Math.round(s/86400) + ' days ago';
  }
  const where = q => q.pl || EPL.llTxt(q.la, q.lo);
  const countTo = t => { let k = 0; for (const q of Q.rows) if (q.t <= t) k++; return k; };
  // Earth's readout, while locked on it: the week's quakes with the largest, the day's fires, their sources
  function lines(){
    if (!on() || orbit.lock !== earth.index) return '';
    const out = [];
    if (Q.rows){
      if (REP.on){ const t = Q.from + REP.t/REP.T*(Q.gen - Q.from); out.push(`replay of the week: ${dateTxt(t)} · ${fmtN(countTo(t))} of ${fmtN(Q.rows.length)} earthquakes so far (USGS)`); }
      else { const b = Q.big, old = now() - Q.gen;
        out.push(`earthquakes this week: ${fmtN(Q.rows.length)} of M 2.5 and over, ${fmtN(Q.n5)} of M 5 and over · the largest, ${magTxt(b.m)}, ${where(b)}, ${ago(now() - b.t)}` + (old > 3600 ? ` · list from ${ago(old)}` : '') + ' (USGS)'); }
    }
    if (FI.n){ const old = now() - FI.to;
      out.push(`fires and heat sources, last 24 hours: ${fmtN(FI.n)} cells of 11 km, brightest by night` + (old > 30*3600 ? ` · seen ${ago(old)}` : '') + ` (NASA FIRMS, ${FI.src || 'VIIRS'})`); }
    return out.join('\n');
  }
  { const prev = earth.readout; earth.readout = () => { const t = prev(), L = lines(); return L ? t + '\n' + L : t; }; }
  // ---------------------------------------------------------------- a quake as a place on Earth (EPL's place objects, e7s-earth-search.js)
  // a row for EPL: [name, kind, latitude, longitude, size km, country, what]; the quake rides along on it
  function rowOf(q){ const r = [`${magTxt(q.m)} earthquake, ${where(q)}`, 'r', q.la, q.lo, Math.round(2*ringKm(q.m)), '', 'earthquake']; r.quake = q; return r; }
  // a place object set to a quake: by its row (setSpot gives every place a row of its own, and moving it far by hand clears it)
  const isQuakeSpot = o => !!(o && o.earthSpot && o.place && o.place.row && o.place.row[6] === 'earthquake');
  function dress(o, r){
    if (!r || r[6] !== 'earthquake') return;
    // (the quake itself: on the row from rowOf, else found in this week's list by its place and the magnitude in its name, as a link gives
    // them: an aftershock can sit within a kilometre of its mainshock)
    const m0 = +((/^M (\d+(?:\.\d)?)/.exec(r[0]) || [])[1]);
    const q = r.quake || (Q.rows && Q.rows.find(x => Math.abs(x.la - r[2]) < 0.006 && Math.abs(x.lo - r[3]) < 0.006 && !(Math.abs(x.m - m0) > 0.05))) || null;
    if (q) r.quake = q;
    // (its size: a quarter of the ring's radius, so the place lets the quake go once it is moved by hand past the ring; a link carries the
    // ring's width, so a quake opened from one before the list is in keeps the same framings)
    const km = q ? ringKm(q.m) : clamp(r[4]/2, 25, 1800), rad = clamp(km/4, 15, 150);
    o.rad = rad*KM; o.minZoom = 0.2;
    // (its marks go by their real age: the flight keeps the clock)
    o.dayAt = () => ssDays;
    // (from high enough that the ring and the ground round it show: from the south-east, lower from the north-west, then straight down)
    const A = clamp(km*9, 1200, 9000)/rad;
    o.views = [{ d:[0.3, 0.86, 0.42], k:A, hold:12, drift:0.01 }, { d:[-0.6, 0.55, -0.58], k:0.7*A, hold:10, drift:0.012 }, { d:[0.04, 1, 0.06], k:1.6*A, hold:10, drift:0.008 }];
    // (and the ground's credit under it, as every place on Earth has)
    const ground = () => typeof EDT !== 'undefined' ? EDT.creditNow() : '';
    if (!q){ o.name = r[0].replace(/,.*$/, ''); o.type = 'an earthquake';
      o.fact = "An earthquake from the USGS's list of the past week. Its details show once this week's list is in.";
      o.dressRO = () => ['earthquakes: USGS, past 7 days', ground()].filter(Boolean).join('\n'); return; }
    o.name = magTxt(q.m) + ' earthquake'; o.type = 'earthquake · ' + where(q);
    o.fact = `A magnitude ${q.m.toFixed(1)} earthquake, ${q.pl ? q.pl + ', ' : ''}on ${longDate(q.t)}. It started ${Math.round(q.d)} km down.` +
      (q.d > 300 ? ' Quakes this deep happen only inside old sea floor sinking into the mantle.' : '') +
      " Its place, depth and size are the USGS's measurements; some are revised in the days after.";
    o.dressRO = () => [`${magTxt(q.m)} · ${Math.round(q.d)} km deep · ${dateTxt(q.t)}, ${ago(now() - q.t)}`,
      `the ring is magnified: drawn ${fmtN(Math.round(2*km))} km across, far wider than the break in the rock`,
      'earthquakes: USGS, past 7 days (from M 2.5 in the United States, mostly M 4 and over elsewhere)', ground()].filter(Boolean).join('\n');
  }
  // the search: "earthquake" (or quake, quakes, seismic...) lists the week's largest, those whose place has the other words typed first
  const fold = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  function findQ(words){
    if (!Q.rows || !on() || !words.some(w => /^(earthq|quake|seism)/.test(w))) return [];
    const rest = words.filter(w => !/^(earthq|quake|seism)/.test(w));
    return Q.byM.filter(q => rest.every(w => fold(q.pl).includes(w))).slice(0, 5).map((q, i) => [96 - i, rowOf(q)]);
  }
  // (EPL is made later, in e7s-earth-search.js: e7t-earth-quakes-places.js adds dress and findQ to its hooks. The info panel's state comes
  // with 09-render.js: the row waits for every file to have run)
  let uiReady = false;
  setTimeout(() => { uiReady = true; }, 0);
  function goBig(){ if (Q.big) EPL.go(rowOf(Q.big)); }
  // ---------------------------------------------------------------- Earth's angle over the week's largest quake (owner, 2026-11-08): played when Earth is picked, not on tours
  // (the camera looks at a point under the quake, so the quake sits in the middle of the view, from a little to the side of straight above
  // it, toward the Sun: by day its ring over the lit ground, by night the lights and fires round it with the dawn beyond; it keeps turning
  // with the Earth while it holds: track)
  const bigU = () => M3.apply(earth.rot, unit(Q.big.la, Q.big.lo));
  function bigDir(){
    if (!Q.big) return sunSide(earth, 0.95, 0.32);
    const u = bigU(), L = sunDirFrom(earth);
    let s = V.sub(L, V.mul(u, V.dot(L, u))); if (V.len(s) < 1e-3) s = V.cross(u, [0, 0, 1]);
    return V.norm(V.add(u, V.mul(V.norm(s), 0.35)));
  }
  const bigOff = () => Q.big ? V.mul(M3.applyT(earth.R0, bigU()), 0.75) : [0, 0, 0];
  const VIEW = { track:bigDir, off:bigOff, k:1.15, hold:11, drift:0, ready:() => on() && !!Q.big, state:() => Q.big ? Q.big.t + ',' + Q.big.la : '' };
  if (can) earth.views.push(VIEW);
  // the quake in view, whose ring and ping show whatever its age: the place object locked on, or the largest while Earth's angle over it plays
  function focusQ(){
    const o = OBJ[orbit.lock];
    if (isQuakeSpot(o) && o.place.row.quake) return o.place.row.quake;
    if (o === earth && Q.big && show.obj === earth.index && (show.on || show.pending) && earth.views[show.to ?? show.view] === VIEW) return Q.big;
    return null;
  }
  // ---------------------------------------------------------------- the replay of the week
  function startReplay(){ if (!Q.rows) return; REP.on = true; REP.t = 0; lastG = GT; toast(`replay of the week · ${fmtN(Q.rows.length)} earthquakes in the order they came, in ${REP.T} seconds`); }
  function stopReplay(){ REP.on = false; }
  // ---------------------------------------------------------------- the info panel's row: a flight to the largest, the replay
  const rowEl = $('#qkRow'), goEl = $('#qkGo'), repEl = $('#qkReplay');
  if (goEl) goEl.addEventListener('click', goBig);
  if (repEl) repEl.addEventListener('click', () => { if (REP.on) stopReplay(); else startReplay(); syncRow(); });
  function syncRow(){
    if (!rowEl || !uiReady) return;
    const o = OBJ[infoObj], show = !!(on() && Q.rows && o && (o === earth || isQuakeSpot(o)) && !cmp && !htShowsPlace());
    if (rowEl.hidden === show) rowEl.hidden = !show;
    if (!show) return;
    const gt = `fly to the ${magTxt(Q.big.m)} quake`; if (goEl.textContent !== gt) goEl.textContent = gt;
    goEl.hidden = o !== earth;
    const rt0 = REP.on ? 'stop the replay' : 'replay the week'; if (repEl.textContent !== rt0){ repEl.textContent = rt0; repEl.setAttribute('aria-pressed', String(REP.on)); }
  }
  // (no switch where it cannot work: the artifact page, file://, or with its flag off)
  if (!can){ const b = document.querySelector('#settings .tog button[data-key="quakes"]'); if (b) b.hidden = true; }
  // ---------------------------------------------------------------- each step
  let lastNet = -1e9, away = 0, toasted = '', lastG = 0;
  function tick(dt){
    // (the replay runs on real time, whatever the time setting)
    const dg = clamp(GT - lastG, 0, 0.25); lastG = GT;
    if (REP.on){ REP.t += dg; if (REP.t >= REP.T || !Q.rows) stopReplay(); }
    if (!can || !uiReady) return;
    const t = GT; if (t - lastNet < 1) return; lastNet = t;
    syncRow();
    const near = earth.rpx > 40 && !earth.hidden;
    if (on() && near) for (const k of ['q', 'f']){ const f = F[k];
      if (!f.busy && (f.state === 0 || (f.state === 2 && t - f.at > f.every && t - f.tried > 300) || (f.state === 3 && t - f.tried > 300))) load(k); }
    // (let go of it all a minute after Earth has shrunk away)
    away = earth.rpx < 4 || earth.hidden ? away + 1 : 0;
    if (away > 60 && (Q.rows || FI.n)) free();
    // a big one, once a visit (owner, 2026-11-08: magnitude 7 and over, in the last 24 hours, while Earth is in view)
    if (!toasted && on() && near && Q.rows){ const b = Q.byM.find(q => q.m >= 7 && now() - q.t < 86400);
      if (b){ toasted = `${magTxt(b.m)} earthquake, ${where(b)}, ${ago(now() - b.t)} (USGS)`; toast(toasted); } }
  }
  { const prev = earth.update; earth.update = function(dt){ if (prev) prev.call(this, dt); tick(dt); }; }
  if (can) setInterval(syncRow, 250);
  // (tests: the state of both answers, the levels' counts and shares, the replay)
  const dbg = () => (syncRow(), { can, on:on(), q:{ state:F.q.state, n:Q.rows ? Q.rows.length : 0, n5:Q.n5, big:Q.big ? [Q.big.m, Q.big.pl] : null, newest:Q.newest ? Q.newest.t : null },
    f:{ state:F.f.state, n:FI.n, src:FI.src, levels:FI.lv.map(L => [L.n, L.all, L.top, L.sum]), w:W.slice() }, replay:{ on:REP.on, t:REP.t, T:REP.T }, row:rowEl ? !rowEl.hidden : false, fade:U.q1[3], toast:toasted });
  return { get can(){ return can; }, on, lines, rowOf, goBig, startReplay, stopReplay, dress, findQ, isQuakeSpot, dbg, REP, K, CUT, get big(){ return Q.big; }, get rows(){ return Q.rows; },
    load:() => { for (const k of ['q', 'f']) if (!F[k].busy) load(k); } };
})();

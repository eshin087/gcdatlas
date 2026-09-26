// ================================================================ content pack (0.7.5): JWST icons, strange worlds, wanderers of the Solar System, cosmic oddities
// Every object sits at its catalogue position and true size. What is illustrative (sped-up orbits, magnified details) says so in its readout.

// ---------------------------------------------------------------- small shared pieces
// orbit from elements with a time of perihelion (JPL small-body database), heliocentric galactic position in light-years.
// a in AU (negative for a hyperbola), angles in degrees, tp and jd as Julian dates. Works for circles to hyperbolas (e > 1).
function orbitTp(el, jd){
  const { a, e, i, om, w, tp } = el, I = i*DEG, Om = om*DEG, W = w*DEG;
  let xp, yp;
  if (e < 1){
    const n = 0.01720209895/Math.pow(a, 1.5), M = ((n*(jd - tp)) % (2*Math.PI) + 2*Math.PI) % (2*Math.PI);
    let E = e > 0.8 ? Math.PI : M; for (let k=0;k<40;k++){ const f = E - e*Math.sin(E) - M; E -= f/(1 - e*Math.cos(E)); if (Math.abs(f) < 1e-12) break; }
    xp = a*(Math.cos(E) - e); yp = a*Math.sqrt(1 - e*e)*Math.sin(E);
  } else {
    const A = Math.abs(a), n = 0.01720209895/Math.pow(A, 1.5), M = n*(jd - tp);
    let H = Math.asinh(M/e); for (let k=0;k<40;k++){ const f = e*Math.sinh(H) - H - M; H -= f/(e*Math.cosh(H) - 1); if (Math.abs(f) < 1e-12) break; }
    xp = A*(e - Math.cosh(H)); yp = A*Math.sqrt(e*e - 1)*Math.sinh(H);
  }
  const cw = Math.cos(W), sw = Math.sin(W), cO = Math.cos(Om), sO = Math.sin(Om), cI = Math.cos(I), sI = Math.sin(I);
  return V.mul(eclToGal([(cw*cO - sw*sO*cI)*xp + (-sw*cO - cw*sO*cI)*yp, (cw*sO + sw*cO*cI)*xp + (-sw*sO + cw*cO*cI)*yp, sw*sI*xp + cw*sI*yp]), AU_LY);
}
// an orbit drawn as a line around the Sun (for comets and small worlds), visible while you look at that body or the Solar System
function orbitTrace(el, n, col, from = 0, to = 1){
  const ps = makePS(n*2), T = el.e < 1 ? 365.25*Math.pow(el.a, 1.5) : 0;
  const at = u => el.e < 1 ? orbitTp(el, el.tp + T*u) : orbitTp(el, el.tp + (u - 0.5)*2*365.25*40);
  for (let k=0;k<n;k++) for (let e=0;e<2;e++){ const p = at(from + (to - from)*(k + e)/n); ps.a.set([p[0], p[1], p[2], 1], (k*2 + e)*4); ps.c.set([col[0], col[1], col[2], 0], (k*2 + e)*4); }
  ps.upload('ac');
  return ps;
}
const nearSS = () => smooth(0.3*AU_LY, 3*AU_LY, orbit.dist)*(1 - smooth(300*AU_LY, 3000*AU_LY, V.len(sun.rel)));

// ---------------------------------------------------------------- irregular small bodies: 'Oumuamua, Arrokoth, the nucleus of Halley's Comet
// uP0: x shape (0 'Oumuamua, 1 Arrokoth, 2 Halley's nucleus), y activity (jets)   uP1: Sun direction (world)
const FS_ROCK = COMMON + `
float sdEll(vec3 p, vec3 r){ float k0 = length(p/r), k1 = length(p/(r*r)); return k0*(k0 - 1.)/max(k1, 1e-5); }
float mapR(vec3 p){
  float k = uP0.x, d;
  if(k < 0.5) d = sdEll(p, vec3(0.9, 0.22, 0.2));
  else if(k < 1.5){ d = min(sdEll(p - vec3(-0.42, 0., 0.), vec3(0.52, 0.5, 0.24)), sdEll(p - vec3(0.45, 0.02, 0.), vec3(0.38, 0.35, 0.25))); }
  else d = min(sdEll(p - vec3(-0.3, 0., 0.), vec3(0.62, 0.46, 0.44)), sdEll(p - vec3(0.36, 0.06, 0.), vec3(0.5, 0.4, 0.38)));
  return d + (fbm3(p*7.) - 0.5)*0.05 + (noise(p*19.) - 0.5)*0.015;
}
vec3 nrmR(vec3 p){ vec2 e = vec2(0.003, 0.); return normalize(vec3(mapR(p + e.xyy) - mapR(p - e.xyy), mapR(p + e.yxy) - mapR(p - e.yxy), mapR(p + e.yyx) - mapR(p - e.yyx))); }
void main(){
  vec3 o, d; localRay(o, d);
  vec2 h = sphIsect(o, d, vec3(0.), 1.); if(h.y < 0.) discard;
  vec3 L = normalize(uP1.xyz*uRot);
  float t = max(h.x, 0.); bool hit = false;
  for(int i=0;i<90;i++){ float s = mapR(o + d*t); if(s < 0.001){ hit = true; break; } t += s*0.8; if(t > h.y) break; }
  vec3 col = vec3(0.); float alpha = 0.;
  float k = uP0.x;
  vec3 alb = k < 0.5 ? vec3(0.62, 0.45, 0.36) : (k < 1.5 ? vec3(0.72, 0.42, 0.3) : vec3(0.24, 0.21, 0.2));
  if(hit){
    vec3 p = o + d*t, n = nrmR(p);
    float dif = max(dot(n, L), 0.), neck = k > 0.5 && k < 1.5 ? exp(-pow((p.x - 0.03)/0.08, 2.))*0.35 : 0.;
    col = alb*(1. + neck)*(pow(dif, 0.85)*1.3 + 0.015)*(0.85 + 0.3*fbm3(p*11.))*(k < 0.5 ? 1.8 : 1.);
    alpha = 1.;
  }
  // a comet's nucleus puffs jets of gas and dust from its sunlit side
  if(uP0.y > 0.01){
    for(int j=0;j<3;j++){
      vec3 jd = normalize(L + 0.45*vec3(sin(float(j)*2.1 + uTime*0.4), cos(float(j)*1.7), sin(float(j)*3.3)));
      col += jet(o, d, jd, 0.85, 0.02, 0.12, 1., uTime*0.8 + float(j), vec3(0.9, 0.95, 1.), vec3(0.6, 0.75, 1.))*uP0.y*1.5;
    }
    col += vec3(0.75, 0.85, 1.)*blob(o, d, vec3(0.), 0.8)*uP0.y*0.06*(1. - alpha*0.5);
  }
  outCol(col, alpha);
}`;
P.rock = program(VS_RECT, FS_ROCK);
function addRock(def){
  const o = addObj(Object.assign({ layer:3, prog:P.rock, parent:sun, offset:[0, 0, 0], selfPos:true, minZoom:1.2, pxMin:5, group:'solar', farLum:0.35, farColor:[0.8, 0.7, 0.62], labelRange:2*AU_LY, noImpostor:false,
    views:[{dirFn:() => sunSide(o, 0.8, 0.35), k:3.4, hold:8, drift:0.05}, {dirFn:() => sunSide(o, 2.2, 0.25), k:2.1, hold:7, drift:0.05}],
    setU(pr){ const L = sunDirFrom(this); gl.uniform4f(pr.u.uP0, def.shape, this.act || 0, 0, 0); gl.uniform4f(pr.u.uP1, L[0], L[1], L[2], 0); },
    update(dt){
      this.offset = orbitTp(def.el, jdNow()); this.pos = V.add(sun.pos, this.offset);
      if (def.spin) this.rot = M3.mul(this.R0, M3.mul(M3.rotY(this.t*def.spin), M3.rotX(this.t*def.spin*0.37)));
      if (def.tick) def.tick.call(this, dt);
    } }, def));
  o.particles.push({ ps:orbitTrace(def.el, 240, def.orbitCol || [0.45, 0.55, 0.75], def.from ?? 0, def.to ?? 1), prog:'lnBasic', lines:true, mode:3, sb:0.35, size:1, rad:1, rel:() => sun.rel, rot:() => I3,
    vis:() => (orbit.lock === o.index || (tour.on && tour.obj === o.index) ? 1 : 0.35*SYSMAG.k)*nearSS() });
  o.particleVis = () => 1;
  o.update(0);
  return o;
}
const heliocentric = o => V.len(o.offset)/AU_LY;
// 'Oumuamua: the first interstellar object ever seen (2017), on a hyperbolic path out of the Solar System
const oumuamua = addRock({ key:'oumuamua', name:"'Oumuamua", label:"'Oumuamua", type:'the first interstellar object · passed the Sun in 2017', group:'comets', shape:0, rad:0.13*KM, spin:0.9, sortKey:40,
  el:{ a:-1.27234, e:1.20113, i:122.7417, om:24.5969, w:241.8105, tp:2458006.007 }, from:0.35, to:0.75, orbitCol:[0.7, 0.5, 0.45],
  fact:'A reddish object a few hundred metres long (its size and shape are uncertain) that came from another star, swung past the Sun and is leaving forever at 26 km/s. It tumbled end over end and sped up slightly, as a comet would, without showing any tail.',
  aka:'oumuamua 1i interstellar asteroid comet', farLum:0.2,
  readout:() => `${heliocentric(oumuamua).toFixed(0)} AU from the Sun and leaving at ~26 km/s\ndrawn as a long thin body, one of the shapes that fit its light curve` });
// Arrokoth: a pristine contact binary in the Kuiper belt, visited by New Horizons on 1 January 2019
const arrokoth = addRock({ key:'arrokoth', name:'Arrokoth', label:'Arrokoth', type:'contact binary in the Kuiper belt · the farthest world ever visited', shape:1, rad:19*KM, spin:0.15, sortKey:44.6,
  el:{ a:44.18, e:0.0356, i:2.45, om:158.9, w:189.1, tp:2475741.404 },
  fact:'Two flattened lumps of ice that drifted together gently 4.5 billion years ago and stuck. New Horizons flew past it in 2019, 6.6 billion km from home: the most distant world any spacecraft has visited.',
  aka:'ultima thule 2014 mu69 kuiper belt new horizons', R0:R0of(0.3, 0.8, 0.2),
  readout:() => `${heliocentric(arrokoth).toFixed(1)} AU from the Sun · 36 km long\nits two lobes are called Wenu and Weeyo` });
// Halley's Comet: nucleus with jets, plus its coma and tails (a separate volume that only appears when the comet is near the Sun)
const halleyEl = { a:17.834, e:0.96714, i:162.262, om:58.42, w:111.33, tp:2446469.974 };
const halley = addRock({ key:'halley', name:"Halley's Comet", label:'Halley', type:'periodic comet · returns every 76 years', group:'comets', shape:2, rad:8.5*KM, spin:0.25, sortKey:35,
  el:halleyEl, orbitCol:[0.5, 0.75, 0.9],
  fact:'A dirty snowball about 15 km long on a 76-year orbit. Near the Sun it grows a glowing coma and two tails: curved dust and straight blue gas, pushed away from the Sun. It was last close in 1986 and returns in 2061.',
  aka:'1p halley comet', farColor:[0.7, 0.85, 1],
  tick(){ const r = heliocentric(this); this.act = 1 - smooth(1.2, 5, r); },
  views:[{dirFn:() => sunSide(halley, 0.9, 0.35), k:3.4, hold:8, drift:0.05}, {dirFn:() => sunSide(halley, 1.9, 0.3), k:2.2, hold:7, drift:0.05}, {dirFn:() => sunSide(halley, 1.6, 0.4), k:0.02*AU_LY/(8.5*KM)*2.6, hold:9, drift:0.02}],
  readout:() => { const r = heliocentric(halley); return r > 5 ? `${r.toFixed(1)} AU from the Sun: frozen, dark and tailless out here\nit comes back in 2061 (set the time machine to see its tails)` : `${r.toFixed(2)} AU from the Sun · the Sun is boiling it\nthe tails point away from the Sun, whichever way it moves`; } });
const FS_COMET = COMMON + `
// local frame: +x points away from the Sun; uP0.x activity, uP0.y dust-tail curvature (sign by the direction of motion)
void main(){
  vec3 o, d; localRay(o, d);
  vec2 h = sphIsect(o, d, vec3(0.), 1.); if(h.y < 0.) discard;
  float act = uP0.x; if(act < 0.01) discard;
  int N = int(mix(28., 48., uLod));
  float t0 = max(h.x, 0.), dt = (h.y - t0)/float(N), jit = hash12(gl_FragCoord.xy)*dt, tm = uTime;
  vec3 col = vec3(0.);
  for(int i=0;i<48;i++){
    if(i >= N) break;
    vec3 p = o + d*(t0 + jit + dt*float(i));
    float r = length(p), x = p.x;
    float coma = exp(-r/(0.012 + 0.02*act))*1.4 + exp(-r/0.06)*0.15;
    // ion tail: straight, narrow, streaky, blue; dust tail: broader, curving back along the orbit, yellow-white
    float xi = max(x, 0.), wI = 0.006 + 0.03*xi;
    float ion = exp(-dot(p.yz, p.yz)/(wI*wI))*exp(-xi/0.5)*step(0., x)*(0.5 + 0.9*pow(noise(vec3(x*14. - tm*0.8, p.y*60., p.z*60.)), 2.));
    vec2 q = p.yz - vec2(uP0.y*xi*xi*0.9, 0.); float wD = 0.01 + 0.09*xi;
    float dust = exp(-dot(q, q)/(wD*wD))*exp(-xi/0.35)*step(0., x)*(0.7 + 0.5*noise(vec3(x*6. - tm*0.2, q*20.)));
    float fade = smoothstep(0.98, 0.75, r);   // gone before the edge of the drawing area
    col += (vec3(0.8, 0.9, 1.)*coma + vec3(0.35, 0.6, 1.)*ion*1.6 + vec3(1., 0.9, 0.7)*dust)*fade*act;
  }
  col += vec3(0.9, 0.95, 1.)*pblob(o, d, vec3(0.), 0.003)*20.*act;
  outCol(col*dt*28., 0.);
}`;
const halleyTail = addObj({ key:'halley-tail', name:"Halley's Comet", label:'', type:'', layer:3, parent:halley, offset:[0, 0, 0], rad:0.03*AU_LY, prog:program(VS_RECT, FS_COMET),
  noPick:true, noLabel:true, atlas:false, noImpostor:true, noWaypoint:true, pxMin:4, minZoom:0.1, views:[{d:[0, 0.3, 1], k:1.5, hold:8, drift:0.02}],
  // (right next to the nucleus the coma would wash out everything: it steps back so you can see the nucleus and its jets)
  visFn(rpx){ return smooth(3, 10, rpx)*smooth(0.02, 0.1, halley.act || 0)*smooth(0.003, 0.03, this.dist/this.rad); },
  update(){
    // frame: +x away from the Sun, the dust tail bends back against the direction of motion
    const away = V.norm(halley.offset), jd = jdNow(), v = V.sub(orbitTp(halleyEl, jd + 1), orbitTp(halleyEl, jd - 1));
    const x = away, y = V.norm(V.cross(away, v)), z = V.cross(x, y); this.rot = [...x, ...y, ...z];
    this.curl = -1;
  },
  setU(pr){ gl.uniform4f(pr.u.uP0, halley.act || 0, this.curl || -1, 0, 0); } });
halleyTail.update();

// ---------------------------------------------------------------- Ceres: the largest body in the asteroid belt (elements from the JPL small-body database, time of perihelion)
{
  const a = 2.7663, n = 0.9856076686/Math.pow(a, 1.5), tp = 2461599.841, om = 80.25, w = 73.29, L0 = w + om + n*(2451545 - tp);
  addBody({ key:'ceres', name:'Ceres', type:'dwarf planet · the largest body in the asteroid belt', parent:sun, R:469.7, pole:[291.4, 66.8], W:[170.65, 952.1532], kind:19,
    el:[a, 0.0797, 10.587, L0, w + om, om, 0, 0, 0, n*36525, 0, 0], farLum:0.35, farColor:[0.8, 0.8, 0.8], sortKey:2.77, labelRange:1.5*AU_LY, aka:'ceres dwarf planet asteroid dawn occator',
    fact:'A round world 940 km across holding a quarter of the asteroid belt\'s mass. NASA\'s Dawn found bright patches of salt in Occator crater, left by briny water welling up from below.',
    readout:() => '940 km across · 2.8 AU from the Sun\none day lasts 9 hours; a year, 4.6 of ours' });
}

// ---------------------------------------------------------------- exoplanets: worlds unlike anything around the Sun
// a planet on a circular orbit around its host (periods shortened so you can see them move; the readout gives the real one)
function exoPlanet(def){
  const host = def.host, a = def.a*AU_LY;
  const b = addBody(Object.assign({ parent:host, pole:[0, 90], lightFrom:host, group:'stars', labelRange:Math.max(a*30, def.R*KM*3e3), farLum:0.3, atlas:true }, def));
  b.update = function(){ const th = (def.phase || 0) + this.t*2*Math.PI/def.P; this.offset = M3.apply(host.R0, [a*Math.cos(th), 0, -a*Math.sin(th)]); this.pos = V.add(host.pos, this.offset);
    this.rot = def.locked ? M3.mul(host.R0, M3.rotY(th)) : M3.mul(host.R0, M3.rotY(this.t*0.4)); };
  b.views = def.views || [{dirFn:() => sunSide(b, 0.7, 0.25), k:3, hold:8, drift:0.03}, {dirFn:() => sunSide(b, 2.5, 0.2), k:2, hold:7, drift:0.04}];
  b.update();
  return b;
}
function orbitRing(host, a, col, far = 30){
  host.particleVis = () => 1;   // (the orbits are drawn even when the star itself is a speck)
  host.particles.push({ ps:ringPS(160, col), prog:'lnBasic', lines:true, mode:3, sb:0.3, size:1, rad:a*AU_LY, rot:() => host.R0,
    vis:() => smooth(a*AU_LY*0.3, a*AU_LY, orbit.dist)*(1 - smooth(a*AU_LY*far, a*AU_LY*far*4, orbit.dist)) });
}
// Kepler-16: a planet with two suns, like Tatooine
const kep16 = namedStar('kepler16', 'Kepler-16', hms(19,16,18.2), dms(51,45,26.8), 245, 0.649, 4450, { label:'Kepler-16 A', atlas:false, type:'orange dwarf with a red dwarf partner',
  star:{ cells:36, act:0.5 }, bound:200, farLum:1, noImpostor:false, labelRange:500, aka:'kepler 16 tatooine',
  fact:'An orange dwarf and a red dwarf circling each other every 41 days. A Saturn-sized planet orbits both.', readout:() => '245 light-years · the two stars are 0.22 AU apart' });
const kep16B = addStar({ key:'kepler16bstar', name:'Kepler-16 B', label:'Kepler-16 B', parent:kep16, offset:[0, 0, 0], R:0.226, T:3308, star:{ cells:30, act:0.8 }, atlas:false, noImpostor:false, farLum:0.9,
  labelRange:0.05, labelMin:1e-6, update:orbitAround(kep16, 0.224*AU_LY, 9, 0.02, 0), type:'red dwarf', fact:'The smaller of the two suns of Kepler-16b.', readout:() => '0.2 solar masses · 3,300 K' });
kep16B.update.call(kep16B);
const kep16b = exoPlanet({ key:'kepler16b', name:'Kepler-16b', host:kep16, type:'circumbinary planet · a real world with two suns', R:0.7538*69911, kind:17, a:0.7048, P:50, phase:1.2, sortKey:245.001,
  aka:'tatooine two suns circumbinary kepler 16',
  fact:'The first planet seen passing in front of two stars at once (2011). From its cloud tops there would be double sunrises and double sunsets. It is a cold gas giant, not a desert world.',
  views:[{dirFn:() => sunSide(kep16b, 2.72, 0.1), k:4.2, hold:9, drift:0.015}, {dirFn:() => sunSide(kep16b, 0.6, 0.3), k:3, hold:8, drift:0.03}, {d:[0.2, 1, 0.3], k:1.3*AU_LY/(0.7538*69911*KM/0.9), hold:9, drift:0.02}],
  readout:() => 'Saturn-sized · orbits both stars every 229 days (sped up here)\nits two suns rise and set together' });
orbitRing(kep16, 0.7048, [0.5, 0.6, 0.8]);
// 55 Cancri e: a lava world so close to its star that its year lasts 18 hours
const cnc55 = namedStar('cnc55', '55 Cancri', hms(8,52,35.8), dms(28,19,51), 41, 0.943, 5196, { type:'Sun-like star with five planets', star:{ cells:36, act:0.4 }, bound:30, farLum:0.6, labelRange:400,
  fact:'A yellow dwarf a little smaller than the Sun with five known planets, one of them a lava world skimming its surface.', aka:'55 cancri copernicus', readout:() => '41 light-years · visible to the eye from a dark site' });
exoPlanet({ key:'cnc55e', name:'55 Cancri e', host:cnc55, type:'lava world · a year of 18 hours', R:1.875*6371, kind:15, a:0.01544, P:5, locked:true, sortKey:41.001, aka:'janssen lava world super earth',
  fact:'Almost twice Earth\'s width and eight times its mass, so close to its star that its surface is probably molten rock. JWST measured its day side at about 1,500 °C, cooler than bare rock would be, a hint of a thick atmosphere perhaps breathed out by the magma.',
  readout:() => 'orbit 17.7 hours (sped up here) at 0.015 AU\nday side ~1,500 °C: hot enough to melt rock' });
// KELT-9b: the hottest planet known, hotter than most stars
const kelt9 = namedStar('kelt9', 'KELT-9', hms(20,31,26.4), dms(39,56,20), 670, 2.36, 10170, { type:'hot blue-white star', star:{ cells:60, act:0, corona:0.3 }, bound:12, farLum:0.8, labelRange:2000,
  fact:'A hot, fast-spinning A0 star twice the Sun\'s size, with a giant planet roasting in a polar orbit around it.', aka:'hd 195689 kelt 9', readout:() => '670 light-years · 10,170 K' });
exoPlanet({ key:'kelt9b', name:'KELT-9b', host:kelt9, type:'the hottest planet known', R:1.891*69911, kind:16, a:0.03462, P:7, locked:true, sortKey:670.001, aka:'hottest exoplanet ultra hot jupiter',
  fact:'A gas giant puffed up to nearly twice Jupiter\'s width, with a day side around 4,300 °C: hotter than most stars. Its molecules are torn apart and its atmosphere is boiling off into space.',
  readout:() => 'orbit 1.5 days (sped up here) · day side ~4,300 °C\ntidally locked: one side always faces the star' });
// HR 8799: four giant planets photographed directly, circling their star over decades to centuries
const hr8799 = namedStar('hr8799', 'HR 8799', hms(23,7,28.7), dms(21,8,3.3), 133, 1.5, 7190, { type:'young star with four photographed giant planets', star:{ cells:60, act:0.1, corona:0.3 }, bound:60, farLum:0.6, labelRange:1500,
  R0:facingEarth(radec(hms(23,7,28.7), dms(21,8,3.3), 133), [0, 1, 0], 0), aka:'hr 8799 direct imaging exoplanets',
  fact:'One of the first planetary systems ever photographed directly (2008). Four giant planets, each several times Jupiter\'s mass, glow in infrared from the heat of their birth, some 30 to 40 million years ago.',
  views:[{dirFn:() => V.norm(V.mul(hr8799.pos, -1)), k:260, hold:10, drift:0.02}, {d:[0.5, 0.45, 0.8], k:160, hold:9, drift:0.03}, {d:[0.3, 0.3, 1], k:2.2, hold:7, drift:0.04}],
  readout:() => '133 light-years · planets 16 to 68 AU out (Jupiter\'s orbit is 5 AU)\norbits of about 50 to 460 years, sped up here' });
[['e', 16.4, 1.1, 18, 3.5], ['d', 27, 1.2, 40, 1.2], ['c', 42, 1.2, 78, 0.3], ['b', 68, 1.2, 190, 5.1]].forEach(([l, a, r, P, ph]) => {
  exoPlanet({ key:'hr8799' + l, name:'HR 8799 ' + l, host:hr8799, type:'young giant planet · photographed directly', R:r*69911, kind:18, a, P, phase:ph, atlas:l === 'b', sortKey:133.001, labelRange:a*AU_LY*25, labelMin:a*AU_LY*0.02,
    fact:'A young giant planet still glowing from its formation, about 1,000 K at its cloud tops.', readout:() => `${a} AU from its star · ~${Math.round(Math.pow(a, 1.5)/Math.sqrt(1.5))} years per orbit` });
  orbitRing(hr8799, a, [0.55, 0.45, 0.7], 12);
});

// ---------------------------------------------------------------- JWST icons
// Cassiopeia A: the youngest known supernova remnant in the Milky Way (the explosion's light reached Earth around 1680)
const FS_CASA = COMMON + `
void main(){
  vec3 o, d; localRay(o, d);
  vec2 h = sphIsect(o, d, vec3(0.), 1.); if(h.y < 0.) discard;
  int N = int(mix(36., 64., uLod));
  float t0 = max(h.x, 0.), dt = (h.y - t0)/float(N), jit = hash12(gl_FragCoord.xy)*dt, tm = uTime;
  vec3 col = vec3(0.); float T = 1.;
  for(int i=0;i<64;i++){
    if(i >= N) break;
    vec3 p = o + d*(t0 + jit + dt*float(i)); float r = length(p); vec3 u = p/max(r, 1e-3);
    // the ejecta: a lumpy shell of knots and filaments, orange and pink (sulphur, oxygen, argon, neon)
    float shell = exp(-pow((r - 0.52 - 0.12*(fbm3(u*2.6 + 2.) - 0.5))/0.08, 2.));
    float knots = pow(ridge(p*6.5 + vec3(0., 0., tm*0.003)), 3.)*1.5 + smoothstep(0.62, 0.86, noise(p*22. + 5.))*1.3;
    float ej = shell*knots;
    vec3 ec = mix(vec3(1., 0.45, 0.18), vec3(1., 0.74, 0.46), noise(p*9.));
    ec = mix(ec, vec3(1., 0.34, 0.62), smoothstep(0.55, 0.8, noise(p*3.6 + 5.))*0.7);
    // the forward shock: a faint, wispy outer sphere where the blast hits the gas around it
    float shock = exp(-pow((r - 0.86 - 0.06*(fbm3(u*5.) - 0.5))/0.03, 2.))*(0.25 + pow(ridge(u*8. + 1.), 2.));
    // the "Green Monster": a sheet of glowing dust in front of the centre, pocked with round holes
    vec3 g = p - vec3(0.08, -0.04, 0.3); vec2 gh = vorc2(g.xy*9.);
    float gm = exp(-pow(g.z/0.05, 2.))*smoothstep(0.32, 0.18, length(g.xy*vec2(1., 1.4)))*smoothstep(0.08, 0.2, gh.x)*(0.5 + fbm3(g*12.));
    float inner = smoothstep(0.5, 0.05, r)*(0.3 + fbm3(p*5. + 7.))*0.08;
    col += T*(ec*ej*3.2 + vec3(0.72, 0.62, 1.)*shock*0.8 + vec3(0.35, 1., 0.45)*gm*1.3 + vec3(0.45, 0.65, 1.)*inner)*dt*3.;
    T *= exp(-ej*1.6*dt);
  }
  col += vec3(0.7, 0.85, 1.)*pblob(o, d, vec3(0.03, -0.04, 0.), 0.003)*40.;
  outCol(col, (1. - T)*0.5);
}`.replace('void main(){', 'vec2 vorc2(vec2 p){ vec2 i = floor(p), f = fract(p); float d1 = 8., d2 = 8.; for(int y=-1;y<=1;y++) for(int x=-1;x<=1;x++){ vec2 g = vec2(float(x), float(y)); vec2 r = g + vec2(hash12(i + g), hash12(i + g + 7.3)) - f; float dd = dot(r, r); if(dd < d1){ d2 = d1; d1 = dd; } else if(dd < d2) d2 = dd; } return vec2(sqrt(d1), sqrt(d2)); }\nvoid main(){');
{
  const pos = radec(hms(23,23,24), dms(58,48,54), 11000);
  addObj({ key:'casa', name:'Cassiopeia A', label:'Cas A', type:'supernova remnant · the youngest known from a massive star', group:'nebulae', sortKey:11000,
    fact:'The shredded remains of a massive star whose light from the explosion reached Earth around the 1660s, though nobody is known to have seen it. JWST sees its debris as knots of orange and pink, a shock front ahead of it, and a curious green curtain nicknamed the Green Monster.',
    pos, rad:6.5, R0:facingEarth(pos, [0, 0, 1], 0), prog:program(VS_RECT, FS_CASA), minZoom:0.1, pxMin:6, farColor:[1, 0.6, 0.45], farLum:0.5, labelRange:9e4, aka:'cas a cassiopeia supernova remnant green monster jwst',
    views:nebView(pos, [{ d:[0.5, 0.3, 0.8], k:1.1, hold:8, drift:0.03 }, { d:[0.1, 0.05, 1], k:0.55, off:[0.1, -0.02, 0.2], hold:8, drift:0.02 }]),
    readout:() => '11,000 light-years · about 10 light-years across\nits debris still flies outward at up to 14,000 km/s' });
}
// WR 124: a Wolf-Rayet star shedding its outer layers into clumps of gas and dust (JWST, 2023)
const FS_WR124 = COMMON + `
void main(){
  vec3 o, d; localRay(o, d);
  vec2 h = sphIsect(o, d, vec3(0.), 1.); if(h.y < 0.) discard;
  int N = int(mix(32., 56., uLod));
  float t0 = max(h.x, 0.), dt = (h.y - t0)/float(N), jit = hash12(gl_FragCoord.xy)*dt, tm = uTime;
  vec3 col = vec3(0.); float T = 1.;
  for(int i=0;i<56;i++){
    if(i >= N) break;
    vec3 p = o + d*(t0 + jit + dt*float(i)); float r = length(p);
    float sh = smoothstep(0.18, 0.4, r)*smoothstep(0.92, 0.62, r);
    float ax = 0.55 + 0.9*pow(abs(dot(p/max(r, 1e-3), normalize(vec3(0.4, 0.85, 0.2)))), 1.5);   // brighter along one axis, as observed
    float cl = smoothstep(0.6, 0.85, noise(p*9. + vec3(0., 0., tm*0.006)))*1.4 + smoothstep(0.66, 0.9, noise(p*22. + 3.))*0.9;
    float dens = sh*cl*ax;
    vec3 c = mix(vec3(1., 0.32, 0.52), vec3(0.78, 0.42, 1.), noise(p*4.5));
    c = mix(c, vec3(1., 0.62, 0.42), smoothstep(0.68, 0.9, noise(p*6.5 + 9.))*0.6);
    float glow = exp(-r/0.16)*0.35;
    col += T*(c*dens*1.1 + vec3(0.5, 0.6, 1.)*glow)*dt*3.;
    T *= exp(-dens*1.2*dt);
  }
  col += vec3(0.85, 0.9, 1.)*(pblob(o, d, vec3(0.), 0.004)*120. + blob(o, d, vec3(0.), 0.05)*0.4);
  outCol(col, (1. - T)*0.5);
}`;
{
  const pos = radec(hms(19,11,30.9), dms(16,51,38), 15000);
  const sp = makeSpikes([{ p:[0, 0, 0], w:2.4, c:[0.85, 0.9, 1] }]);
  addObj({ key:'wr124', name:'WR 124', label:'WR 124', type:'Wolf-Rayet star shedding its skin · JWST', group:'stars', sortKey:15000,
    fact:'A star 30 times the Sun\'s mass in its last brief, violent stage, throwing off its outer layers. The ejected gas cools into clumps of dust that JWST sees glowing in infrared, ten light-years across.',
    pos, rad:5.5, R0:facingEarth(pos, [0, 0, 1], 0), prog:program(VS_RECT, FS_WR124), minZoom:0.1, pxMin:6, farColor:[1, 0.5, 0.8], farLum:0.6, labelRange:8e4, aka:'wr 124 wolf rayet m1-67 jwst',
    views:nebView(pos, [{ d:[0.6, 0.25, 0.75], k:1.1, hold:8, drift:0.03 }, { d:[0.1, 0.1, 1], k:0.5, hold:7, drift:0.02 }]),
    particles:[{ ps:sp, prog:'spike', lines:true, mode:1, sb:2.6, size:1, len:0.05, q0:() => [1, 0, 0, 0] }],
    readout:() => '15,000 to 21,000 light-years (estimates differ) · its gas flies out at ~700 km/s\nit will probably end as a supernova' });
}
// the Southern Ring (NGC 3132): a planetary nebula JWST imaged in its first week of science
{
  const pos = radec(hms(10,7,1.8), dms(-40,26,11), 2500);
  const st = makePS(2); st.a.set([0.02, 0.01, 0, 1.6, -0.015, -0.01, 0, 0.6], 0); st.c.set([0.95, 0.95, 1, 0, 0.8, 0.85, 1, 0], 0); st.upload('ac');
  addRingPN({ key:'southernring', name:'Southern Ring Nebula', label:'Southern Ring', type:'planetary nebula · NGC 3132 · JWST', sortKey:2500, pos, rad:0.35, farColor:[0.9, 0.6, 0.5],
    fact:'Shells of gas thrown off by a dying star, layer after layer. The faint star at the centre, not the bright one beside it, made the nebula; JWST showed for the first time that it is wrapped in dust.',
    aka:'ngc 3132 eight burst southern ring jwst planetary nebula', hero:V.norm([0.15, 0.2, 1]), roll:60,
    u:[[0.42, 0.1, 0.55, 0.55], [0.58, 0.5, 0.55, 0.86], [0.9, 0, 0.1, 0]],
    views:[{ dirFn:() => V.norm(V.mul(pos, -1)), k:1.8, hold:9, drift:0.02 }, { d:[0.9, 0.3, 0.3], k:1.4, hold:8, drift:0.03 }, { d:[0.2, 0.1, 1], k:0.7, hold:7, drift:0.02 }],
    particles:[{ ps:st, prog:'ptBasic', mode:1, sb:1.2, size:2.2 }],
    readout:() => '2,500 light-years · about half a light-year across\nthe ejected shells are spaced by the thousands of years between puffs' });
}
// the Bubble Nebula (NGC 7635): a bubble blown by the wind of one massive star
const FS_BUBBLE = COMMON + `
void main(){
  vec3 o, d; localRay(o, d);
  vec2 h = sphIsect(o, d, vec3(0.), 1.); if(h.y < 0.) discard;
  int N = int(mix(32., 56., uLod));
  float t0 = max(h.x, 0.), dt = (h.y - t0)/float(N), jit = hash12(gl_FragCoord.xy)*dt, tm = uTime;
  vec3 col = vec3(0.); float T = 1.;
  for(int i=0;i<56;i++){
    if(i >= N) break;
    vec3 p = o + d*(t0 + jit + dt*float(i)); float r = length(p);
    float shell = exp(-pow((r - 0.4 - 0.02*(fbm3(p*10. + tm*0.01) - 0.5))/0.014, 2.))*(0.55 + 0.9*fbm3(p*7.));
    float inside = smoothstep(0.4, 0.15, r)*(0.4 + fbm3(p*6.))*0.12;
    // the surrounding cloud: ragged red and orange hydrogen, densest on the side the star is moving away from
    vec3 q = p - vec3(-0.45, -0.1, 0.05);
    float cloud = smoothstep(0.5, 0.78, fbm3(p*3.2 + 2.) + 0.35*smoothstep(0.9, 0.2, length(q)))*smoothstep(1., 0.55, r)*(0.4 + pow(ridge(p*6.), 2.));
    vec3 cc = mix(vec3(1., 0.3, 0.28), vec3(1., 0.62, 0.36), fbm3(p*5. + 4.));
    col += T*(vec3(0.55, 0.82, 1.)*shell*2.4 + vec3(0.4, 0.6, 1.)*inside + cc*cloud*1.2)*dt*3.;
    T *= exp(-cloud*1.4*dt);
  }
  col += vec3(0.8, 0.88, 1.)*(pblob(o, d, vec3(0.13, 0.03, 0.02), 0.004)*140. + blob(o, d, vec3(0.13, 0.03, 0.02), 0.03)*0.4);
  outCol(col, (1. - T)*0.5);
}`;
{
  const pos = radec(hms(23,20,48.3), dms(61,12,6), 7100);
  const sp = makeSpikes([{ p:[0.13, 0.03, 0.02], w:2.2, c:[0.8, 0.88, 1] }]);
  addObj({ key:'bubble', name:'Bubble Nebula', label:'Bubble Nebula', type:'wind-blown bubble · NGC 7635', group:'nebulae', sortKey:7100,
    fact:'The wind of a single star about 45 times the Sun\'s mass, blowing at 1,700 km/s, has inflated a bubble seven light-years wide in the gas around it. The star sits off-centre because the cloud is denser on one side.',
    pos, rad:9, R0:facingEarth(pos, [0, 0, 1], 0), prog:program(VS_RECT, FS_BUBBLE), minZoom:0.1, pxMin:6, farColor:[0.7, 0.8, 1], farLum:0.5, labelRange:8e4, aka:'ngc 7635 bubble nebula cassiopeia',
    views:nebView(pos, [{ d:[0.7, 0.2, 0.7], k:1.2, hold:8, drift:0.03 }, { d:[0.15, 0.05, 1], k:0.55, off:[0.25, 0, 0], hold:8, drift:0.02 }]),
    particles:[{ ps:sp, prog:'spike', lines:true, mode:1, sb:2.2, size:1, len:0.04, q0:() => [1, 0, 0, 0] }],
    readout:() => '7,100 light-years · the bubble is 7 light-years wide\nits star, BD+60 2522, is about 45 times the Sun\'s mass' });
}
// the Pleiades (M45): a young cluster drifting through a dust cloud that its brightest stars light up in blue
const FS_PLEIADES = COMMON + `
// uP0..uP3: the four stars that light most of the dust (local position, brightness)
void main(){
  vec3 o, d; localRay(o, d);
  vec2 h = sphIsect(o, d, vec3(0.), 1.); if(h.y < 0.) discard;
  int N = int(mix(28., 48., uLod));
  float t0 = max(h.x, 0.), dt = (h.y - t0)/float(N), jit = hash12(gl_FragCoord.xy)*dt, tm = uTime;
  vec3 col = vec3(0.);
  vec3 ax = normalize(vec3(0.75, 0.6, 0.25));
  for(int i=0;i<48;i++){
    if(i >= N) break;
    vec3 p = o + d*(t0 + jit + dt*float(i));
    // dust in fine parallel streaks (it is being sheared as the cluster ploughs through it)
    vec3 q = p - ax*dot(p, ax)*0.85; float s = fbm3(q*vec3(9., 9., 9.) + ax*dot(p, ax)*1.5 + vec3(0., 0., tm*0.002));
    float dust = smoothstep(0.42, 0.75, s)*smoothstep(0.35, 0.05, abs(p.z + 0.05 - 0.2*p.x))*smoothstep(1., 0.6, length(p));
    float ill = 0.;
    ill += uP0.w/(dot(p - uP0.xyz, p - uP0.xyz)*60. + 0.12);
    ill += uP1.w/(dot(p - uP1.xyz, p - uP1.xyz)*60. + 0.12);
    ill += uP2.w/(dot(p - uP2.xyz, p - uP2.xyz)*60. + 0.12);
    ill += uP3.w/(dot(p - uP3.xyz, p - uP3.xyz)*60. + 0.12);
    col += vec3(0.5, 0.68, 1.)*dust*ill*0.4;
  }
  col *= dt*3.;
  // the brightest sisters as glowing blue-white stars (four above, three more in uM0's columns)
  vec3 sc = vec3(0.78, 0.86, 1.);
  col += sc*(pblob(o, d, uP0.xyz, 0.005)*160.*uP0.w + blob(o, d, uP0.xyz, 0.04)*0.7*uP0.w);
  col += sc*(pblob(o, d, uP1.xyz, 0.005)*160.*uP1.w + blob(o, d, uP1.xyz, 0.04)*0.7*uP1.w);
  col += sc*(pblob(o, d, uP2.xyz, 0.005)*160.*uP2.w + blob(o, d, uP2.xyz, 0.04)*0.7*uP2.w);
  col += sc*(pblob(o, d, uP3.xyz, 0.005)*160.*uP3.w + blob(o, d, uP3.xyz, 0.04)*0.7*uP3.w);
  for(int k=0;k<3;k++){ vec3 q = uM0[k]; col += sc*(pblob(o, d, q, 0.004)*110. + blob(o, d, q, 0.035)*0.5); }
  outCol(col, 0.);
}`;
{
  const D = 444, pos = radec(hms(3,47,24), dms(24,7,0), D), R0 = facingEarth(pos, [0, 0, 1], 0), RAD = 14;
  // the Seven Sisters and their parents, at their sky positions (depth scattered by a few light-years)
  const B = [['Alcyone', 3,47,29.1, 24,6,18, 2.1], ['Atlas', 3,49,9.7, 24,3,12, 1.5], ['Electra', 3,44,52.5, 24,6,48, 1.4], ['Maia', 3,45,49.6, 24,22,4, 1.3], ['Merope', 3,46,19.6, 23,56,54, 1.2],
    ['Taygeta', 3,45,12.5, 24,28,2, 1.1], ['Pleione', 3,49,11.2, 24,8,12, 0.8], ['Celaeno', 3,44,48.2, 24,17,22, 0.7], ['Asterope', 3,45,54.5, 24,33,16, 0.6]];
  const toLocal = w => V.mul(M3.applyT(R0, V.sub(w, pos)), 1/RAD);
  const bright = B.map(([name, h, m, s, dd, dm, ds, w], i) => ({ name, p:V.add(toLocal(radec(hms(h, m, s), dms(dd, dm, ds), D)), [0, 0, (i % 3 - 1)*0.12]), w, c:blackbodyJS(12000 + 2000*(i % 3)) }));
  const cl = clusterPS(Math.round(900*QUALITY), [0, 0, 0], 0.75, 9000);
  const bps = makePS(bright.length); bright.forEach((b, i) => { bps.a.set([...b.p, b.w], i*4); bps.c.set([...b.c, 0], i*4); }); bps.upload('ac');
  const sp = makeSpikes(bright.map(b => ({ p:b.p, w:b.w, c:b.c })));
  const lit = [4, 0, 3, 2].map(i => bright[i]);   // Merope lights the brightest nebula
  addObj({ key:'pleiades', name:'the Pleiades', label:'Pleiades', type:'young star cluster · the Seven Sisters · M45', group:'nebulae', sortKey:444,
    fact:'About a thousand young stars born together some 100 to 125 million years ago. Their brightest members light up a dust cloud the cluster happens to be passing through, in streaks of blue.',
    pos, rad:RAD, R0, prog:program(VS_RECT, FS_PLEIADES), minZoom:0.08, pxMin:6, farColor:[0.7, 0.8, 1], farLum:0.9, labelRange:3e4, aka:'m45 seven sisters subaru pleiades',
    setU(pr){ lit.forEach((b, i) => gl.uniform4f(pr.u['uP' + i], b.p[0], b.p[1], b.p[2], b.w)); gl.uniformMatrix3fv(pr.u.uM0, false, [...bright[1].p, ...bright[5].p, ...bright[6].p]); },
    views:[{ dirFn:() => V.norm(V.mul(pos, -1)), k:0.95, hold:9, drift:0.02 }, { d:[0.6, 0.35, 0.7], k:1.0, hold:8, drift:0.03 }, { dirFn:() => V.norm(V.mul(pos, -1)), k:0.35, off:bright[4].p, hold:8, drift:0.02 }],
    particles:[{ ps:cl.ps, prog:'ptBasic', mode:1, sb:0.5, size:1.6 }, { ps:bps, prog:'ptBasic', mode:1, sb:3, size:2.6 }, { ps:sp, prog:'spike', lines:true, mode:1, sb:2.4, size:1, len:0.04, q0:() => [1, 0, 0, 0] }],
    readout:() => '444 light-years · about 115 million years old\nthe dust is not left over from their birth: they are drifting through it' });
}

// ---------------------------------------------------------------- cosmic oddities
// the Einstein Cross: a quasar whose light left it ~10 billion years ago, split into four images by a galaxy ~550 million light-years away
const huchra = addGalaxy({ key:'huchra', name:"Huchra's Lens", label:"Huchra's Lens", type:'barred spiral galaxy · the lens of the Einstein Cross', sortKey:5.5e8, atlas:false,
  fact:'An ordinary barred spiral galaxy. Its core happens to sit almost exactly in front of a distant quasar.', pos:radec(hms(22,40,30.3), dms(3,21,31), 5.5e8), rad:45000, incl:30, pa:70,
  g:{ arms:2, pitch:14, bulge:0.3, dust:1, bar:0.22, H:0.012, sf:0.6, Rd:0.28, seed:61, gain:0.25, starGain:0.5 }, readout:() => 'about 550 million light-years',
  // looking along the line of sight from Earth the galaxy is drawn fainter, so the four images of the quasar stand out as they do in telescope images
  dimX(){ const x = BYKEY.einsteincross; return 1 - 0.9*(x && x.align || 0)*smooth(3e4, 1e4, this.dist); },
  visFn(rpx){ return smooth(7, 18, rpx)*(1 - 0.55*milkyway.inside)*this.dimX(); }, particleVis(rpx){ return smooth(2.8, 9.8, rpx)*this.dimX(); } });
const FS_XCROSS = COMMON + `
// uP0.xyz: direction to Earth (local). The four images and the faint ring only exist as seen from Earth's direction
void main(){
  vec3 o, d; localRay(o, d);
  vec3 E = normalize(uP0.xyz), e1 = normalize(cross(E, abs(E.y) < 0.9 ? vec3(0., 1., 0.) : vec3(1., 0., 0.))), e2 = cross(E, e1);
  float al = smoothstep(0.93, 0.995, dot(normalize(o), E));
  if(al < 0.001) discard;
  float fl = 0.8 + 0.2*sin(uTime*0.7);   // each image flickers on its own as stars in the lens galaxy drift across it (microlensing)
  vec3 c = vec3(0.7, 0.85, 1.), col = vec3(0.);
  col += c*blob(o, d, e1*0.3, 0.018)*(0.9 + 0.2*sin(uTime*0.53));
  col += c*blob(o, d, -e1*0.3, 0.018)*(0.8 + 0.25*sin(uTime*0.41 + 2.));
  col += c*blob(o, d, e2*0.27, 0.018)*(0.7 + 0.2*sin(uTime*0.67 + 4.));
  col += c*blob(o, d, -e2*0.27, 0.018)*(0.6 + 0.2*sin(uTime*0.37 + 1.))*fl;
  // the faint arc joining them: the quasar's host galaxy stretched into an Einstein ring
  float tq = dot(-o, E)/max(dot(d, E), 1e-3); vec3 q = o + d*tq; float rr = length(q - E*dot(q, E));
  col += c*exp(-pow((rr - 0.285)/0.02, 2.))*0.0006*step(0., tq);
  outCol(col*al*900., 0.);
}`;
const XIMG = makePS(4), XSPK = makeSpikes([0, 1, 2, 3].map(() => ({ p:[0, 0, 0], w:1, c:[0.7, 0.85, 1] })));
for (let i=0;i<4;i++) XIMG.c.set([0.7, 0.85, 1, 0], i*4); XIMG.upload('c');
addObj({ key:'einsteincross', name:'Einstein Cross', label:'Einstein Cross', type:'a quasar split into four by gravity · Q2237+030', group:'galaxies', sortKey:5.51e8, parent:huchra, offset:[0, 0, 0],
  fact:'Four images of one quasar, whose light set out about 10 billion years ago, arranged around the core of a galaxy far nearer to us. The galaxy\'s gravity bends the quasar\'s light along four paths. Seen from anywhere but here, the cross would fall apart.',
  rad:6000, prog:program(VS_RECT, FS_XCROSS), minZoom:0.2, pxMin:3, farColor:[0.7, 0.85, 1], farLum:0.7, labelRange:4e6, aka:'q2237+030 gravitational lens einstein cross quasar', noWaypoint:true,
  setU(pr){ const e = M3.applyT(this.rot, V.norm(V.mul(this.pos, -1))); gl.uniform4f(pr.u.uP0, e[0], e[1], e[2], 0); },
  // the four images as sharp points with diffraction spikes, placed around the core as seen from Earth's direction
  update(){
    const E = M3.applyT(this.rot, V.norm(V.mul(this.pos, -1))), e1 = V.norm(V.cross(E, Math.abs(E[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0])), e2 = V.cross(E, e1);
    const P4 = [V.mul(e1, 0.3), V.mul(e1, -0.3), V.mul(e2, 0.27), V.mul(e2, -0.27)], w = [1.4, 1.2, 1, 0.8];
    const c = V.norm(V.mul(M3.applyT(this.rot, V.sub(cam.rel, frel(this))), 1));
    this.align = smooth(0.93, 0.995, V.dot(c, E));
    P4.forEach((p, i) => { XIMG.a.set([...p, w[i]*(0.85 + 0.15*Math.sin(this.t*(0.4 + 0.13*i) + i*2))], i*4); for (let k=0;k<8;k++) XSPK.a.set([...p, w[i]], (i*8 + k)*4); });
    XIMG.upload('a'); XSPK.upload('a');
  },
  particleVis:() => 1,
  particles:[{ ps:XIMG, prog:'ptBasic', mode:3, sb:5, size:5, vis:() => BYKEY.einsteincross.align || 0 }, { ps:XSPK, prog:'spike', lines:true, mode:3, sb:3, size:1, len:0.09, q0:() => [1, 0, 0, 0], vis:() => BYKEY.einsteincross.align || 0 }],
  views:[{ dirFn:() => V.norm(V.mul(BYKEY.einsteincross.pos, -1)), k:3.2, hold:10, drift:0 }, { dirFn:() => V.norm(V.mul(BYKEY.einsteincross.pos, -1)), k:40, hold:8, drift:0 }, { d:[1, 0.3, 0.2], k:3, hold:8, drift:0.02 }],
  readout:() => 'the four images are 1.8 arcseconds apart as seen from Earth\nthe quasar\'s light took about 10 billion years to get here' });
// the Boötes Void: a gap in the cosmic web 330 million light-years across with only about 60 galaxies in it
{
  const pos = radec(hms(14,50), dms(46), 7e8), RAD = 2.4e8, rv = 165e6/RAD;
  const nW = Math.round(5000*QUALITY), nI = 60, ps = makePS(nW + nI);
  for (let i=0;i<nW;i++){ const dd = randDir(), r = rv*(1.02 + 0.35*Math.pow(rnd(), 0.7))*(1 + 0.12*Math.sin(dd[0]*5 + dd[1]*4)), c = rnd() < 0.7 ? [1, 0.85, 0.65] : [0.75, 0.82, 1];
    const p = V.mul(dd, Math.min(r, 0.98)); ps.a.set([...p, 0.6 + rnd()*0.8], i*4); ps.c.set([...c, 0], i*4); }
  for (let i=0;i<nI;i++){ const dd = randDir(), r = rv*0.85*Math.pow(rnd(), 0.4), p = V.mul(dd, r); ps.a.set([...p, 1.6], (nW + i)*4); ps.c.set([0.95, 0.9, 1, 0], (nW + i)*4); }
  ps.upload('ac');
  const edge = ringPS(160, [0.4, 0.5, 0.75]);
  addObj({ key:'bootesvoid', name:'Boötes Void', label:'Boötes Void', type:'one of the largest empty regions known', group:'cosmic', sortKey:7e8, layer:1,
    fact:'A roughly spherical hole in the cosmic web some 330 to 400 million light-years across. A region that size would normally hold thousands of galaxies; this one holds about sixty. From its middle, beyond the stars of your own galaxy, you would see almost no other galaxies.',
    pos, rad:RAD, minZoom:0.05, pxMin:3, noImpostor:true, labelRange:1e11, labelMin:3e7, aka:'bootes void great nothing', noWaypoint:true,
    views:[{ d:[0.3, 0.4, 1], k:1.4, hold:9, drift:0.02 }, { d:[0.8, 0.2, 0.5], k:0.5, hold:9, drift:0.02 }],
    particleVis:() => 1,
    particles:[{ ps, prog:'ptBasic', mode:1, sb:0.6, size:1.6, vis:() => smooth(2e7, 1e8, orbit.dist) }, { ps:edge, prog:'lnBasic', lines:true, mode:3, sb:0.25, size:1, rad:rv*RAD, rot:camFacingRot, vis:() => smooth(8e7, 3e8, orbit.dist)*0.6 }],
    readout:() => '700 million light-years · 330 to 400 million light-years across\nabout 60 galaxies, where thousands would be expected' });
}
function camFacingRot(){ return [...cam.right, ...V.mul(cam.fwd, -1), ...cam.up]; }
// El Gordo: "the fat one", the most massive galaxy cluster known at its distance, caught in a collision
const FS_ELGORDO = COMMON + `
void main(){
  vec3 o, d; localRay(o, d);
  vec2 h = sphIsect(o, d, vec3(0.), 1.); if(h.y < 0.) discard;
  vec3 col = vec3(0.);
  float t0 = max(h.x, 0.), dt = (h.y - t0)/32., jit = hash12(gl_FragCoord.xy)*dt;
  vec3 A = vec3(-0.3, 0.08, 0.), B = vec3(0.32, -0.05, 0.);
  for(int i=0;i<32;i++){
    vec3 p = o + d*(t0 + jit + dt*float(i));
    // hot gas (X-rays, pink): a bright compact core with a comet-like wake behind it
    vec3 q = p - vec3(0.12, 0., 0.); float wake = exp(-(q.y*q.y + q.z*q.z)/(0.01 + 0.05*max(-q.x, 0.)))*exp(-max(-q.x, 0.)/0.35)*step(-0.8, q.x);
    float gas = (exp(-dot(q, q)/0.006)*1.2 + wake*0.7 + exp(-dot(p, p)/0.12)*0.25)*(0.7 + 0.6*fbm3(p*8. + 3.));
    // dark matter (blue, mapped by lensing): two lumps that sailed through
    float dm = exp(-dot(p - A, p - A)/0.05) + exp(-dot(p - B, p - B)/0.04);
    // radio relics (green): thin arcs of shocked gas at both ends of the collision
    float r1 = exp(-pow((length((p - vec3(0.75, 0., 0.))*vec3(1., 0.5, 0.8)) - 0.14)/0.025, 2.))*step(0., p.x - 0.62);
    float r2 = exp(-pow((length((p - vec3(-0.72, 0.05, 0.))*vec3(1., 0.55, 0.8)) - 0.12)/0.022, 2.))*step(p.x + 0.6, 0.);
    col += vec3(1., 0.42, 0.7)*gas*0.9 + vec3(0.25, 0.45, 1.)*dm*0.4 + vec3(0.4, 1., 0.6)*(r1 + r2)*(0.6 + fbm3(p*12.))*0.9;
  }
  outCol(col*dt*1.6, 0.);
}`;
{
  const pos = radec(hms(1,2,52.5), dms(-49,14,58), 9.9e9);
  const n = Math.round(2500*QUALITY), ps = makePS(n);
  for (let i=0;i<n;i++){ const b = rnd() < 0.55, c0 = b ? [-0.3, 0.08, 0] : [0.32, -0.05, 0], s = b ? 0.16 : 0.13, c = rnd() < 0.8 ? [1, 0.78, 0.55] : [0.75, 0.8, 1];
    ps.a.set([c0[0] + rndn()*s, c0[1] + rndn()*s, c0[2] + rndn()*s, 0.7 + rnd()], i*4); ps.c.set([...c, 0], i*4); }
  ps.upload('ac');
  addObj({ key:'elgordo', name:'El Gordo', label:'El Gordo', type:'colliding galaxy clusters · the fat one', group:'cosmic', sortKey:9.9e9,
    fact:'Two giant clusters of galaxies smashing together, together weighing about 3 million billion Suns. The collision heats its gas to about 170 million °C and drives shock waves that glow in radio at both ends.',
    pos, rad:6e6, R0:facingEarth(pos, [0, 0, 1], 20), prog:program(VS_RECT, FS_ELGORDO), minZoom:0.1, pxMin:6, farColor:[1, 0.6, 0.85], farLum:0.8, labelRange:3e10, aka:'act-cl j0102-4915 el gordo cluster',
    distEarth:'light left it 7 billion years ago · now ~10 billion ly', views:[{d:[0, 0.1, 1], k:2, hold:9, drift:0.02}, {d:[0.4, 0.8, 0.4], k:1.6, hold:8, drift:0.03}],
    particles:[{ps, prog:'ptBasic', mode:0, sb:0.4, size:1.3, cap:0.6}],
    readout:() => 'about 3 million billion times the Sun\'s mass\nwe see it as it was when the universe was half its age' });
}
// Tabby's Star: a star whose light dips at random by up to 22%, most likely from clumps of dust
{
  const tb = namedStar('tabby', "Tabby's Star", hms(20,6,15.45), dms(44,27,24.6), 1470, 1.58, 6750, { type:'the star with mysterious dips · KIC 8462852', star:{ cells:40, act:0.3 }, bound:14, farLum:0.6, labelRange:4000,
    fact:'Kepler saw this star dim irregularly, once by 22%, with no pattern a planet could make. Its light dims more in blue than in red, the signature of fine dust: most likely uneven clouds of it, perhaps from shattered comets or moons.',
    aka:'kic 8462852 boyajian star wtf alien megastructure', readout:() => '1,470 light-years · dips of up to 22% lasting days\nthe dust clouds are drawn where they could be; nobody has seen them' });
  const n = Math.round(1400*QUALITY), ps = makePS(n);
  for (let i=0;i<n;i++){ const c = Math.floor(rnd()*5), a0 = c*1.1 + rndn()*0.12, r = 0.35 + 0.05*c + rndn()*0.015, y = rndn()*0.01;
    ps.a.set([r*Math.cos(a0), y, r*Math.sin(a0), 0.4 + rnd()], i*4); ps.c.set([0.75, 0.55, 0.4, 0], i*4); }
  ps.upload('ac');
  tb.particles.push({ ps, prog:'ptBasic', mode:0, sb:0.35, size:1.4, cap:0.7, rot:() => M3.mul(tb.R0, M3.rotY(tb.t*0.05)) });
  tb.particleVis = rpx => smooth(4, 14, rpx);
  tb.views = [{d:[0.3, 0.2, 1], k:0.55, hold:9, drift:0.03}, {d:[0.9, 0.3, 0.2], k:0.35, hold:8, drift:0.04}];
}

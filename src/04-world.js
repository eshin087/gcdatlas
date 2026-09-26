
// ================================================================ units, sky coordinates, shared programs, object registry
// World frame: heliocentric galactic Cartesian, in light-years. +X toward the Galactic Centre, +Y toward l = 90°, +Z toward the north galactic pole.
const LY = 9.4607e12, AU = 1.495979e8;   // km
const KM = 1/LY, AU_LY = AU/LY;         // light-years per km / per AU
const RSUN = 695700;
const IS_SMALL = Math.min(innerWidth, innerHeight) < 600;
// the phone layout (dock, info card, scale chip): narrow screens, and short ones on their side. Keep in step with the CSS in 00-head.html.
const COMPACT_MQ = matchMedia('(max-width:680px), (max-height:520px) and (max-width:1000px)');
const isCompact = () => COMPACT_MQ.matches;
// user settings, remembered between visits when the browser allows it
const SET = (() => {
  const d = { detail:1, travel:reduceMotion ? 'quick' : 'cinematic', glow:true, labels:true, twinkle:true, haloMark:false, menuSize:1.15, sound:true, volume:0.55, dwell:'normal', textSize:1, musicStyle:'mix', saverIdle:0, fadeUI:'quick', infoD:'full', infoM:'compact' };
  try { const s = JSON.parse(localStorage.getItem('gcdatlas.settings') || '{}'); for (const k in d) if (k in s && typeof s[k] === typeof d[k]) d[k] = s[k]; } catch (e) {}
  return d;
})();
// feature flags: experiments can ship switched off, or be switched off without touching the code that uses them.
// Override per visitor with ?flags=name,-other in the URL (remembered) or localStorage 'gcdatlas.flags'. See docs/FEATURE_FLAGS.md.
const FLAGS = (() => {
  const f = { live:true, launches:true, planes:true, backyard:true, earthStory:true, social:false };
  try { Object.assign(f, JSON.parse(localStorage.getItem('gcdatlas.flags') || '{}')); } catch (e) {}
  const q = new URLSearchParams(location.search).get('flags');
  if (q){ for (const s of q.split(',')){ const k = s.replace(/^[-+]/, ''); if (k in f) f[k] = !s.startsWith('-'); } try { localStorage.setItem('gcdatlas.flags', JSON.stringify(f)); } catch (e) {} }
  return f;
})();
// shared state for two special modes: looking up from your own backyard, and Earth's story through deep time
const SKYV = { on:false, site:null };
const EARTH_ERA = { era:0, lights:1 };
function saveSet(){ try { localStorage.setItem('gcdatlas.settings', JSON.stringify(SET)); } catch (e) {} }
const dwellK = () => SET.dwell === 'short' ? 0.45 : SET.dwell === 'long' ? 1.7 : 1;   // how long a tour lingers on each view
let GT = 0;   // global clock in seconds (drives twinkle, shimmer and other ambient motion)
const twinkleAmt = () => SET.twinkle ? (reduceMotion ? 0.35 : 1) : 0;
const QUALITY = IS_SMALL ? 0.55 : 1;
const DEG = Math.PI/180;
// J2000 equatorial -> galactic rotation (rows)
const EQ2GAL = [[-0.0548755604, -0.8734370902, -0.4838350155], [0.4941094279, -0.4448296300, 0.7469822445], [-0.8676661490, -0.1980763734, 0.4559837762]];
const eqToGal = e => EQ2GAL.map(r => r[0]*e[0] + r[1]*e[1] + r[2]*e[2]);
const hms = (h, m = 0, s = 0) => h + m/60 + s/3600;
const dms = (d, m = 0, s = 0) => (d < 0 || Object.is(d, -0) ? -1 : 1)*(Math.abs(d) + m/60 + s/3600);
const eqDir = (raDeg, decDeg) => { const a = raDeg*DEG, d = decDeg*DEG; return [Math.cos(d)*Math.cos(a), Math.cos(d)*Math.sin(a), Math.sin(d)]; };
function radecDir(raH, decD){ return eqToGal(eqDir(raH*15, decD)); }
function radec(raH, decD, distLy){ return V.mul(radecDir(raH, decD), distLy); }
const OBL = 23.4393*DEG;
const eclToGal = v => eqToGal([v[0], v[1]*Math.cos(OBL) - v[2]*Math.sin(OBL), v[1]*Math.sin(OBL) + v[2]*Math.cos(OBL)]);
function fmtDist(ly){
  if (ly < 0.05){ const au = ly/AU_LY, km = ly*LY; if (km < 1) return Math.round(km*1000) + ' m'; if (km < 10) return km.toFixed(1) + ' km'; return au < 0.01 ? Math.round(km).toLocaleString('en-US') + ' km' : (au < 10 ? au.toFixed(2) : Math.round(au).toLocaleString('en-US')) + ' AU'; }
  if (ly < 1e3) return (ly < 10 ? ly.toFixed(1) : Math.round(ly)) + ' ly';
  if (ly < 1e6) return Math.round(ly).toLocaleString('en-US') + ' ly';
  if (ly < 1e9) return +(ly/1e6).toPrecision(3) + ' million ly';
  return +(ly/1e9).toPrecision(3) + ' billion ly';
}
// rotation taking local direction a onto world direction b, with local up ua landing as close as possible to world up ub
function frameOf(f, up){ const x = V.norm(f); let y = V.sub(up, V.mul(x, V.dot(up, x))); if (V.len(y) < 1e-6) y = V.sub([0.3, 0.9, 0.1], V.mul(x, V.dot([0.3, 0.9, 0.1], x))); y = V.norm(y); return [x, y, V.cross(x, y)]; }
function orient(a, b, ua = [0,1,0], ub = [0,0,1]){
  const fa = frameOf(a, ua), fb = frameOf(b, ub), R = new Array(9).fill(0);
  for (let k=0;k<3;k++) for (let i=0;i<3;i++) for (let j=0;j<3;j++) R[j*3 + i] += fb[k][i]*fa[k][j];
  return R;
}
// orient an object so that Earth sees it from its local "hero" direction (roll turns it about the line of sight)
const facingEarth = (pos, heroLocal, roll = 0) => {
  const b = V.norm(V.mul(pos, -1)), up0 = V.norm(V.sub([0,0,1], V.mul(b, V.dot([0,0,1], b)))), side = V.cross(b, up0);
  const ub = V.add(V.mul(up0, Math.cos(roll*DEG)), V.mul(side, Math.sin(roll*DEG)));
  return orient(heroLocal, b, [0,1,0], ub);
};
// frame with local +y along a world axis (spin axis / disk normal) and local +x toward a reference direction
function frameY(axis, ref){ const y = V.norm(axis); let x = V.sub(ref, V.mul(y, V.dot(ref, y))); if (V.len(x) < 1e-6) x = V.sub([1,0,0], V.mul(y, y[0])); x = V.norm(x); const z = V.cross(x, y); return [...x, ...y, ...z]; }

// ---------------------------------------------------------------- time: the Solar System runs on its own clock (1 s = 10 minutes)
const JD_NOW = Date.now()/86400000 + 2440587.5;
const SS_RATE = 600;
let ssDays = 0;
const jdNow = () => JD_NOW + ssDays;
// JPL approximate Keplerian elements (1800-2050): a, e, I, L, long. perihelion, long. node and their rates per century
const PLANET_EL = {
  mercury:[0.38709927, 0.20563593, 7.00497902, 252.25032350, 77.45779628, 48.33076593, 0.00000037, 0.00001906, -0.00594749, 149472.67411175, 0.16047689, -0.12534081],
  venus:  [0.72333566, 0.00677672, 3.39467605, 181.97909950, 131.60246718, 76.67984255, 0.00000390, -0.00004107, -0.00078890, 58517.81538729, 0.00268329, -0.27769418],
  earth:  [1.00000261, 0.01671123, -0.00001531, 100.46457166, 102.93768193, 0.0, 0.00000562, -0.00004392, -0.01294668, 35999.37244981, 0.32327364, 0.0],
  mars:   [1.52371034, 0.09339410, 1.84969142, -4.55343205, -23.94362959, 49.55953891, 0.00001847, 0.00007882, -0.00813131, 19140.30268499, 0.44441088, -0.29257343],
  jupiter:[5.20288700, 0.04838624, 1.30439695, 34.39644051, 14.72847983, 100.47390909, -0.00011607, -0.00013253, -0.00183714, 3034.74612775, 0.21252668, 0.20469106],
  saturn: [9.53667594, 0.05386179, 2.48599187, 49.95424423, 92.59887831, 113.66242448, -0.00125060, -0.00050991, 0.00193609, 1222.49362201, -0.41897216, -0.28867794],
  uranus: [19.18916464, 0.04725744, 0.77263783, 313.23810451, 170.95427630, 74.01692503, -0.00196176, -0.00004397, -0.00242939, 428.48202785, 0.40805281, 0.04240589],
  neptune:[30.06992276, 0.00859048, 1.77004347, -55.12002969, 44.96476227, 131.78422574, 0.00026291, 0.00005105, 0.00035372, 218.45945325, -0.32241464, -0.01262724],
};
function orbitEls(el, jd){ const T = (jd - 2451545)/36525; return { a:el[0] + el[6]*T, e:el[1] + el[7]*T, I:(el[2] + el[8]*T)*DEG, L:el[3] + el[9]*T, wb:el[4] + el[10]*T, Om:(el[5] + el[11]*T)*DEG }; }
function orbitPoint(k, E){   // heliocentric galactic position (ly) at eccentric anomaly E
  const xp = k.a*(Math.cos(E) - k.e), yp = k.a*Math.sqrt(1 - k.e*k.e)*Math.sin(E), w = k.wb*DEG - k.Om;
  const cw = Math.cos(w), sw = Math.sin(w), cO = Math.cos(k.Om), sO = Math.sin(k.Om), cI = Math.cos(k.I), sI = Math.sin(k.I);
  return V.mul(eclToGal([(cw*cO - sw*sO*cI)*xp + (-sw*cO - cw*sO*cI)*yp, (cw*sO + sw*cO*cI)*xp + (-sw*sO + cw*cO*cI)*yp, sw*sI*xp + cw*sI*yp]), AU_LY);
}
function keplerE(M, e){ let E = M + e*Math.sin(M); for (let i=0;i<8;i++) E -= (E - e*Math.sin(E) - M)/(1 - e*Math.cos(E)); return E; }
function planetPos(el, jd){ const k = orbitEls(el, jd); const M = (((k.L - k.wb) % 360) + 360) % 360*DEG; return orbitPoint(k, keplerE(M, k.e)); }
// geocentric Moon (low-precision lunar theory), light-years
function moonGeo(jd){
  const d = jd - 2451545, L = (218.316 + 13.176396*d)*DEG, M = (134.963 + 13.064993*d)*DEG, F = (93.272 + 13.229350*d)*DEG, D = (297.850 + 12.190749*d)*DEG;
  const lon = L + (6.289*Math.sin(M) + 1.274*Math.sin(2*D - M) + 0.658*Math.sin(2*D))*DEG, lat = 5.128*DEG*Math.sin(F), r = 385001 - 20905*Math.cos(M);
  return V.mul(eclToGal([Math.cos(lat)*Math.cos(lon), Math.cos(lat)*Math.sin(lon), Math.sin(lat)]), r*KM);
}
// IAU body frame: local +y = north pole, local +x = prime meridian (rotation angle W, degrees), longitude grows toward local -z
function bodyFrame(raDeg, decDeg, Wdeg){
  const P = eqDir(raDeg, decDeg), Q = [-Math.sin(raDeg*DEG), Math.cos(raDeg*DEG), 0], PQ = V.cross(P, Q), w = Wdeg*DEG;
  const X = eqToGal(V.add(V.mul(Q, Math.cos(w)), V.mul(PQ, Math.sin(w)))), Y = eqToGal(P), Z = V.cross(X, Y);
  return [...X, ...Y, ...Z];
}
const poleFrame = (raDeg, decDeg) => bodyFrame(raDeg, decDeg, 0);

// ---------------------------------------------------------------- textures
const TEX = {};
function loadTex(name, url, filter = gl.LINEAR){
  const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 255]));
  TEX[name] = t;
  const img = new Image();
  img.onload = () => {
    gl.bindTexture(gl.TEXTURE_2D, t); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  };
  img.src = url;
  return t;
}

const VS_SPIKE = `#version 300 es
layout(location=0) in vec4 aP; layout(location=1) in vec4 aC;
uniform mat3 uCamRot; uniform vec2 uTan; uniform vec3 uRel; uniform mat3 uRot; uniform float uRad; uniform float uVis;
uniform float uSB; uniform float uOut; uniform float uLen; uniform vec4 uQ0;
out vec3 vC;
void main(){
  vec3 v = (uRel + uRot*(aP.xyz*uRad))*uCamRot;
  if(v.z <= 0.){ gl_Position = vec4(2.,2.,2.,1.); vC = vec3(0.); return; }
  float k = aC.w, b = min(uSB/(v.z*v.z), 3.)*aP.w*uQ0.x;
  vec2 dir = k < 0.5 ? vec2(0.) : (k < 1.5 ? vec2(1.,0.) : (k < 2.5 ? vec2(-1.,0.) : (k < 3.5 ? vec2(0.,1.) : vec2(0.,-1.))));
  vec2 ndc = v.xy/(uTan*v.z) + dir*vec2(uTan.y/uTan.x, 1.)*uLen*sqrt(b);   // (divided by depth: before 0.7.8 it was not, and spikes landed off-screen or at the centre)
  gl_Position = vec4(ndc, 0., 1.);   // (w = 1: both ends share one depth, and a w as small as the Sun's distance in light-years is mangled by some GPUs)
  vC = aC.rgb*b*uOut*uVis*(k < 0.5 ? 1.2 : 0.);
}`;
// real stars: aP.xyz = position (local units), aP.w = luminosity (flux x distance^2, in the object's units), aC.rgb = colour
// apparent brightness follows the true inverse-square law, then a perceptual curve so both Sirius and 5th-magnitude stars read
const VS_CATSTAR = `#version 300 es
layout(location=0) in vec4 aP; layout(location=1) in vec4 aC;
uniform mat3 uCamRot; uniform vec2 uTan; uniform vec3 uRel; uniform mat3 uRot; uniform float uRad; uniform float uVis; uniform float uOut; uniform vec4 uQ0;
out vec3 vC;
void main(){
  vec3 v = (uRel + uRot*(aP.xyz*uRad))*uCamRot;
  float d2 = dot(v, v)/(uRad*uRad);
  if(v.z <= 0. || d2 < 1e-30){ gl_Position = vec4(2.,2.,2.,1.); gl_PointSize = 1.; vC = vec3(0.); return; }
  gl_Position = vec4(v.x/uTan.x, v.y/uTan.y, 0., v.z);
  float f = aP.w/d2*uQ0.x;
  float b = min(uQ0.y*pow(f, 0.42), 2.6);
  // twinkle: three incommensurate slow waves per star, plus a rare glint, so the pattern never visibly repeats
  float id = float(gl_VertexID);
  float h1 = fract(sin(id*12.9898)*43758.545), h2 = fract(sin(id*78.233)*12543.13), h3 = fract(sin(id*39.425)*31337.7), t = uQ0.z;
  float tw = sin(t*(0.5 + 1.3*h1) + h2*6.283)*0.5 + sin(t*(1.7 + 2.3*h2) + h3*6.283)*0.25 + sin(t*(0.11 + 0.23*h3) + h1*6.283)*0.4;
  float glint = pow(max(sin(t*(0.031 + 0.05*h3) + h1*97.), 0.), 60.);
  b *= max(1. + uQ0.w*(0.2*tw + 1.4*glint), 0.2);
  gl_PointSize = clamp(1.3 + 0.55*log(1. + f*6.) + uQ0.w*glint, 1.3, 4.2);
  vC = mix(aC.rgb, vec3(0.85, 0.92, 1.), 0.3*glint*uQ0.w)*b*uOut*uVis*smoothstep(0.004, 0.02, b);
}`;
const P = {
  bg: program(VS_RECT, FS_BG, true),
  cell: program(VS_RECT, FS_CELL, true),
  glow: program(VS_RECT, FS_GLOW, true),
  final: program(VS_RECT, FS_FINAL, true),
  ptBasic: program(particleVS(PB_BASIC), FS_POINT),
  lnBasic: program(particleVS(PB_BASIC), FS_LINE),
  spike: program(VS_SPIKE, FS_LINE),
  catStar: program(VS_CATSTAR, FS_POINT),
  driftLn: program(VS_DRIFT, FS_LINE),
  driftPt: program(VS_DRIFT, FS_POINT),
};
const R0of = (rx, ry, rz) => M3.mul(M3.rotY(ry), M3.mul(M3.rotX(rx), M3.rotZ(rz)));
const OBJ = [], BYKEY = {};
// layer: 0 universe, 1 large-scale context, 2 galaxy context, 3 objects (drawn in that order, far to near within a layer)
function addObj(o){
  o.R0 = o.R0 || R0of(...(o.tilt || [0,0,0])); o.rot = o.rot || o.R0; o.t = 0; o.particles = o.particles || [];
  o.layer = o.layer ?? 3; o.index = OBJ.length; o.vis = 0; o.rel = [0,0,0]; o.dist = 1;
  if (o.parent && !o.offset) o.offset = [0,0,0];
  if (o.parent) o.pos = V.add(o.parent.pos, o.offset);
  o.farColor = o.farColor || [0.85, 0.88, 1]; o.farLum = o.farLum ?? 1; o.labelRange = o.labelRange ?? o.rad*400;
  o.minZoom = o.minZoom ?? 0.1; o.views = o.views || [{d:[0, 0.3, 1], k:2.2, hold:8, drift:0.03}];
  OBJ.push(o); BYKEY[o.key] = o; return o;
}
// position of an object's centre relative to the current focus object (keeps precision via parent chains)
function frel(o){
  const F = OBJ[cam.focus];
  if (o === F) return [0,0,0];
  if (o.parent){
    // walk both chains to the nearest common ancestor so nearby bodies never lose precision
    if (F.parent === o.parent) return V.sub(o.offset, F.offset);
    if (F === o.parent) return o.offset.slice();
    return V.add(frel(o.parent), o.offset);
  }
  if (F.parent === o) return V.mul(F.offset, -1);
  return V.sub(o.pos, F.pos);
}
function makeSpikes(stars){
  const ps = makePS(stars.length*8);
  stars.forEach((s, i) => { for (let k=0;k<4;k++){ for (let e=0;e<2;e++){ const j = (i*8 + k*2 + e)*4; ps.a.set([s.p[0], s.p[1], s.p[2], s.w], j); ps.c.set([s.c[0], s.c[1], s.c[2], e ? k + 1 : 0], j); } } });
  ps.upload('ac');
  return ps;
}
function scaleBlend(dist, dClose, kmClose, dFar, kmFar){
  const u = smooth(Math.log(dClose), Math.log(dFar), Math.log(dist));
  return Math.exp(Math.log(kmClose) + (Math.log(kmFar) - Math.log(kmClose))*u);
}
// the Sun is the light source for Solar System bodies
const sunDirFrom = o => V.norm(V.mul(o.pos, -1));
// B-V colour index -> effective temperature (Ballesteros 2012)
const bvTemp = bv => 4600*(1/(0.92*bv + 1.7) + 1/(0.92*bv + 0.62));
// a ring of n points (unit circle in the local xz plane) for orbit and scale overlays, as line segments
function ringPS(n, col, w = 1){
  const ps = makePS(n*2);
  for (let i=0;i<n;i++) for (let k=0;k<2;k++){ const a = (i + k)/n*Math.PI*2; ps.a.set([Math.cos(a), 0, Math.sin(a), w], (i*2 + k)*4); ps.c.set([col[0], col[1], col[2], 0], (i*2 + k)*4); }
  ps.upload('ac'); return ps;
}
const EXTRAS = [];   // additional draw hooks (ship, events, overlays), run after all objects

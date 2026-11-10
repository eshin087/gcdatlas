// ================================================================ content pack (0.16.0): famous Messier objects, the first pack from the checklists
// The atlas follows the Messier and Caldwell catalogues (tools/data/deep-sky.mjs; docs/CATALOG.md shows what is in and what is next).
// Twenty objects: four nebulae (the Dumbbell, the Owl, the Trifid, the Omega), three open clusters (the Beehive, the Wild Duck, Ptolemy's
// Cluster), three globular clusters (M3, M4, M22) and ten galaxies (the Sunflower, the Black Eye, the Southern Pinwheel, M77, the Leo
// Triplet's M65 and M66, M106, the Phantom, and M84 and M86 in Markarian's Chain). Positions are SIMBAD's (degrees, J2000); distances
// and sizes are in each readout with their method.
// (this pack draws its random numbers from the shared seeded rnd() and then puts the seed back, so everything made after it,
// the Halo's route included, gets the same numbers as before the pack existed)
const P8_SEED = seed;
// a position from SIMBAD's right ascension and declination in degrees, at a distance in light-years
const simbadPos = (raDeg, decDeg, ly) => radec(raDeg/15, decDeg, ly);
// an orientation with the object's long axis at its real position angle on the sky (degrees from celestial north through east) and its
// hero side toward Earth: for a galaxy (hero [sin i, cos i, 0]) the disc's line of nodes is local z; for a nebula (hero [0, 0, 1]) its
// long axis is local x. (facingEarth's roll counts from galactic north, so a catalogue position angle given to it is off by up to 180 deg)
const NCP = radecDir(0, 90);
function skyR0(pos, hero, pa){
  const s = V.norm(pos), b = V.mul(s, -1);
  const N = V.norm(V.sub(NCP, V.mul(s, V.dot(NCP, s)))), E = V.norm(V.cross(NCP, s));
  const major = V.add(V.mul(N, Math.cos(pa*DEG)), V.mul(E, Math.sin(pa*DEG)));
  return orient(hero, b, [0, 1, 0], V.cross(major, b));
}
const discR0 = (pos, incl, pa) => skyR0(pos, [Math.sin(incl*DEG), Math.cos(incl*DEG), 0], pa);

// ---------------------------------------------------------------- the Dumbbell Nebula (M27): the first planetary nebula ever found (1764)
// local radius 1 = 1.6 light-years, +z toward Earth, the axis along local x: an ellipsoidal cloud whose gas is brightest inside an hourglass
// round the axis, narrow at the waist (the "apple core" seen from Earth, its two bites either side of the middle), fainter and redder
// outside it (the "ears"), with dense knots in the outer parts
const FS_DUMBBELL = COMMON + `
void main(){
  vec3 o, d; localRay(o, d);
  vec2 h = sphIsect(o, d, vec3(0.), 1.); if(h.y < 0.) discard;
  int N = int(mix(40., 70., uLod));
  float t0 = max(h.x, 0.), dt = (h.y - t0)/float(N), jit = hash12(gl_FragCoord.xy)*dt, tm = uTime;
  vec3 col = vec3(0.); float T = 1.;
  for(int i=0;i<70;i++){
    if(i >= N) break;
    vec3 p = o + d*(t0 + jit + dt*float(i));
    float r = length(p/vec3(0.8, 0.64, 0.64));
    if(r > 1.2) continue;
    float n = fbmW(p*4.5 + tm*0.004), fine = fbm3(p*13. + 4.);
    float shell = smoothstep(1., 0.84, r);
    float rp = length(p.yz), wx = 0.24 + 0.55*abs(p.x);
    float core = smoothstep(wx + 0.05, wx - 0.1, rp);
    float halo = exp(-pow((r - 1.1)/0.06, 2.))*(0.3 + ridge(p*7.));
    // knots: small dense clumps in the outer parts, like the Helix's
    float knot = smoothstep(0.74, 0.9, fbm3(p*17. + 9.))*smoothstep(0.5, 0.9, r)*shell;
    float em = shell*(0.1 + core)*(0.3 + 1.3*n*n)*(0.4 + 1.1*fine) + halo*0.1;
    vec3 inner = vec3(0.35, 1., 0.78), rim = mix(vec3(1., 0.32, 0.3), vec3(1., 0.5, 0.36), n);
    vec3 c = mix(inner, rim, clamp(smoothstep(0.4, 0.95, r) + (1. - core)*0.6, 0., 1.));
    col += T*(c*em*1.8 + vec3(1., 0.55, 0.45)*knot*0.8)*dt;
    T *= exp(-(em*0.4 + knot*4.)*dt);
  }
  // the central star, over 100,000 degrees, shrinking into a white dwarf
  col += vec3(0.78, 0.86, 1.)*(pblob(o, d, vec3(0.), 0.004)*260. + blob(o, d, vec3(0.), 0.03)*0.35);
  outCol(col, (1. - T)*0.6);
}`;
{
  const D = 1260, pos = simbadPos(299.9015, 22.7212, D), RAD = 1.6;
  addObj({ key:'dumbbell', name:'Dumbbell Nebula', label:'Dumbbell', type:'planetary nebula · M27 · in Vulpecula', group:'nebulae', sortKey:D,
    fact:'The first planetary nebula ever found, by Charles Messier in 1764: the outer layers of a dying Sun-like star, blown off over the last 10,000 years or so. From Earth its brightest gas looks like an apple core.',
    pos, rad:RAD, sizeR:1.45, R0:skyR0(pos, [0, 0, 1], 30), prog:program(VS_RECT, FS_DUMBBELL), minZoom:0.1, pxMin:6, farColor:[0.5, 0.95, 0.8], farLum:0.5, labelRange:2e4,
    aka:'m27 messier 27 ngc 6853 apple core planetary nebula vulpecula',
    // (from Earth; from near the axis, where the hourglass is a ring; from three-quarters, between the two)
    views:[{ dirFn:() => V.norm(V.mul(pos, -1)), k:2.3, hold:9, drift:0.02 }, { d:[1, 0.35, 0.3], k:2, hold:8, drift:0.03 }, { d:[0.6, 0.5, 0.65], k:2.1, hold:8, drift:0.03 }],
    readout:() => '1,260 light-years (Gaia) · about 3 light-years across\nits central star is over 100,000 °C' });
}

// ---------------------------------------------------------------- the Owl Nebula (M97): a round shell with two dark eyes
// local radius 1 = 1.4 light-years: a round bubble (the inner shell) and a faint outer one; the eyes are the two ends of one barrel-shaped
// hollow along an axis tilted about 45 degrees to our line of sight (Guerrero et al. 2003), drawn as two round lobes, their walls the
// brightest gas, so from Earth they show as two dark patches either side of the middle
const FS_OWL = COMMON + `
void main(){
  vec3 o, d; localRay(o, d);
  vec2 h = sphIsect(o, d, vec3(0.), 1.); if(h.y < 0.) discard;
  int N = int(mix(36., 64., uLod));
  float t0 = max(h.x, 0.), dt = (h.y - t0)/float(N), jit = hash12(gl_FragCoord.xy)*dt, tm = uTime;
  vec3 col = vec3(0.); float T = 1.;
  vec3 ax = normalize(vec3(0.72, 0.08, 0.69));
  for(int i=0;i<64;i++){
    if(i >= N) break;
    vec3 p = o + d*(t0 + jit + dt*float(i));
    float r = length(p*vec3(1., 1.04, 1.));
    if(r > 0.98) continue;
    float n = fbmW(p*4. + tm*0.003), fine = fbm3(p*10. + 3.);
    float shell = smoothstep(0.76, 0.68, r)*(0.35 + 0.65*smoothstep(0.72, 0.25, r));
    float eye = min(length(p - ax*0.42), length(p + ax*0.42));
    float cav = smoothstep(0.19, 0.27, eye), rim = smoothstep(0.45, 0.28, eye);
    float outer = smoothstep(0.96, 0.9, r)*smoothstep(0.72, 0.8, r);
    float em = shell*cav*(0.2 + 1.3*rim)*(0.4 + 0.8*n)*(0.6 + 0.6*fine) + outer*0.1*(0.5 + n);
    vec3 c = mix(vec3(0.4, 1., 0.82), vec3(0.75, 0.95, 0.9), n*0.4);
    c = mix(c, vec3(1., 0.42, 0.38), smoothstep(0.62, 0.8, r));
    col += T*c*em*dt*1.3;
    T *= exp(-em*0.3*dt);
  }
  col += vec3(0.78, 0.86, 1.)*(pblob(o, d, vec3(0.), 0.004)*90. + blob(o, d, vec3(0.), 0.025)*0.15);
  outCol(col, (1. - T)*0.55);
}`;
{
  const D = 2660, pos = simbadPos(168.6988, 55.0190, D), RAD = 1.4;
  addObj({ key:'owl', name:'Owl Nebula', label:'Owl Nebula', type:'planetary nebula · M97 · in Ursa Major', group:'nebulae', sortKey:D,
    fact:'A round shell of gas thrown off by a dying star some 10,000 years ago. Two darker patches inside it look like an owl\'s eyes: they are the two ends of one barrel-shaped hollow in the shell, tilted about 45 degrees to our view.',
    pos, rad:RAD, sizeR:1.3, R0:skyR0(pos, [0, 0, 1], 100), prog:program(VS_RECT, FS_OWL), minZoom:0.1, pxMin:6, farColor:[0.55, 0.95, 0.85], farLum:0.4, labelRange:2e4,
    aka:'m97 messier 97 ngc 3587 owl planetary nebula ursa major',
    // (from Earth, the face with the eyes; from the side, where the shell has no eyes; looking along the slant of the hollow)
    views:[{ dirFn:() => V.norm(V.mul(pos, -1)), k:2.4, hold:9, drift:0.02 }, { d:[0.2, 1, 0.3], k:2.2, hold:8, drift:0.03 }, { d:[0.75, 0.2, 0.65], k:2.2, hold:8, drift:0.03 }],
    readout:() => '2,660 light-years (Gaia) · about 2.6 light-years across\nthe eyes are the ends of one tilted hollow, not two holes' });
}

// ---------------------------------------------------------------- the Trifid (M20) and the Omega (M17): two star nurseries in Sagittarius
// One shader for both (compiled once for each: KIND is a constant). Local radius 1, +z toward Earth.
// KIND 0, the Trifid: a round red cloud cut into three lobes by lanes of dark dust that meet near its central star, with a blue reflection
// nebula on its north side. KIND 1, the Omega: a bright bar of glowing gas with a hook at one end (the swan's neck), in a fainter cloud, and
// the dark molecular cloud M17 SW pressing on its south-west. (0.18.0, p9-messier2.js: KIND 2, the Sagittarius Star Cloud M24; KIND 3, the
// reflection nebula M78.)
const FS_NURSERY = `
float lane2(vec2 q, float a, float w){ vec2 u = vec2(cos(a), sin(a)); float s = dot(q, u); return s < 0. ? 0. : smoothstep(w, 0., abs(dot(q, vec2(-u.y, u.x))) - 0.012*s); }
float seg3(vec3 p, vec3 a, vec3 b){ vec3 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba)/dot(ba, ba), 0., 1.); return length(pa - ba*h); }
void main(){
  vec3 o, d; localRay(o, d);
  vec2 h = sphIsect(o, d, vec3(0.), 1.); if(h.y < 0.) discard;
  int N = int(mix(40., 70., uLod));
  float t0 = max(h.x, 0.), dt = (h.y - t0)/float(N), jit = hash12(gl_FragCoord.xy)*dt, tm = uTime;
  vec3 col = vec3(0.); float T = 1.;
  for(int i=0;i<70;i++){
    if(i >= N) break;
    vec3 p = o + d*(t0 + jit + dt*float(i));
    vec3 w = vec3(fbm3(p*2.4 + 3.), fbm3(p*2.4 + 9.), fbm3(p*2.4 + 15.)) - 0.5;
    vec3 q = p + w*0.3;
    float g = fbmW(p*3.2 + vec3(0., 0., tm*0.003)), fine = fbm3(p*11. + w*3. + 5.);
    float em = 0., blue = 0., dust = 0.;
#if KIND == 0
    float body = smoothstep(0.62, 0.3, length((q - vec3(0., -0.12, 0.))*vec3(1., 1.05, 1.6)));
    float core = exp(-dot(p - vec3(0., -0.1, 0.), p - vec3(0., -0.1, 0.))*9.);
    em = body*(0.08 + 2.2*g*g + 0.5*core)*(0.35 + 1.4*fine*fine);
    vec3 rq = q - vec3(0.04, 0.6, -0.05);
    blue = smoothstep(0.46, 0.12, length(rq*vec3(1., 1.15, 1.6)))*(0.25 + 1.3*g)*(0.5 + fine);
    vec2 s = q.xy - vec2(0.02, -0.1);
    float lanes = max(max(lane2(s, 1.35, 0.034), lane2(s, 3.55, 0.038)), lane2(s, 5.6, 0.034));
    dust = lanes*smoothstep(-0.25, 0.1, p.z)*smoothstep(0.75, 0.3, length(s))*(0.6 + 0.8*fbm3(p*6. + 2.));
    vec3 c = mix(vec3(1., 0.3, 0.42), vec3(1., 0.55, 0.5), g);
    col += T*(c*em + vec3(0.42, 0.62, 1.)*blue*0.6)*dt*5.;
#elif KIND == 1
    float bar = seg3(q, vec3(-0.34, 0.02, 0.), vec3(0.36, -0.06, 0.02));
    float neck = min(seg3(q, vec3(-0.34, 0.02, 0.), vec3(-0.46, 0.24, 0.)), seg3(q, vec3(-0.46, 0.24, 0.), vec3(-0.32, 0.4, 0.02)));
    float b = exp(-pow(bar/0.12, 2.))*5., nk = exp(-pow(neck/0.08, 2.))*3.6;
    float cloud = smoothstep(0.85, 0.3, length(q*vec3(0.95, 1.45, 1.7)));
    em = (b + nk)*(0.3 + 2.4*g*g) + cloud*(0.03 + 0.35*g*g*g);
    em *= 0.35 + 1.4*fine*fine;
    dust = smoothstep(0.34, 0.12, length((q - vec3(0.42, -0.3, 0.1))*vec3(1., 1.3, 1.)))*(0.5 + 0.9*fbm3(p*5. + 7.));
    vec3 c = mix(vec3(1., 0.32, 0.45), vec3(1., 0.62, 0.6), clamp(g*b*0.35, 0., 1.));
    c = mix(c, vec3(1., 0.85, 0.8), smoothstep(0.5, 1., b*g*0.45));
    col += T*c*em*dt*3.;
#elif KIND == 2
    // a sea of stars too many and too faint to see one by one: a fine speckle, warm white, brightest in the middle of the window; in front of
    // it the dark clouds Barnard 92 (a round blot) and 93 (a thin streak) and ragged dust round the edge of the window
    float sh = length(q*vec3(1., 1.9, 1.4));
    float body = smoothstep(1., 0.3, sh);
    float spk = pow(noise(p*58. + 3.), 6.)*7. + pow(noise(p*21. + 9.), 4.)*1.6;
    em = body*(0.1 + 0.45*g + 0.7*spk);
    vec3 c = mix(vec3(1., 0.8, 0.58), vec3(0.86, 0.9, 1.), smoothstep(0.45, 0.8, fine));
    float b92 = smoothstep(0.07, 0.015, length((p - vec3(-0.3, 0.17, 0.4))*vec3(1., 1.25, 0.6)) + 0.035*(fbm3(p*14. + 5.) - 0.5));
    float b93 = smoothstep(0.035, 0.008, seg3(p, vec3(-0.19, 0.08, 0.38), vec3(-0.11, 0.24, 0.38)));
    float rim = smoothstep(0.5, 0.95, sh)*smoothstep(0.45, 0.72, fbm3(p*4. + 1.));
    dust = (b92 + b93)*9. + rim*0.8;
    col += T*c*em*dt*1.7;
#else
    // KIND 3, M78: dust lit by two young hot stars at its head; their light falls off with the square of the distance and the dust scatters
    // it, mostly blue; thicker dust in lanes dims what is behind it
    vec3 L1 = vec3(-0.14, 0.2, 0.04), L2 = vec3(-0.04, 0.12, -0.04);
    float body = smoothstep(0.95, 0.2, length((q - vec3(0.1, -0.12, 0.))*vec3(1.1, 0.8, 1.3)));
    float dens = body*(0.12 + 1.5*g*g)*(0.45 + fine);
    float lit = 0.016/(dot(p - L1, p - L1) + 0.012) + 0.01/(dot(p - L2, p - L2) + 0.01);
    em = dens*lit;
    dust = body*smoothstep(0.58, 0.8, fbm3(p*3.5 + 21.))*3. + dens*0.5;
    col += T*mix(vec3(0.5, 0.68, 1.), vec3(0.8, 0.86, 1.), smoothstep(2., 6., lit))*em*dt*13.;
#endif
    T *= exp(-dust*7.*dt);
    if(T < 0.01) break;
  }
#if KIND == 0
  vec3 st = vec3(0.02, -0.1, 0.02);
  col += vec3(0.82, 0.88, 1.)*(pblob(o, d, st, 0.004)*300. + blob(o, d, st, 0.03)*0.5);
#elif KIND == 3
  // the two stars that light M78 (HD 38563 A and B)
  col += vec3(0.75, 0.84, 1.)*(pblob(o, d, vec3(-0.14, 0.2, 0.04), 0.004)*220. + pblob(o, d, vec3(-0.04, 0.12, -0.04), 0.004)*160. + blob(o, d, vec3(-0.1, 0.17, 0.), 0.04)*0.3);
#endif
  outCol(col, (1. - T)*0.85);
}`;
const nurseryProg = kind => program(VS_RECT, COMMON + '#define KIND ' + kind + '\n' + FS_NURSERY);
{
  const D = 4120, pos = simbadPos(270.675, -22.9717, D), RAD = 22;
  const cl = clusterPS(Math.round(160*QUALITY), [0.02, -0.1, 0.02], 0.16, 26000);
  addObj({ key:'trifid', name:'Trifid Nebula', label:'Trifid Nebula', type:'star-forming region · M20 · in Sagittarius', group:'nebulae', sortKey:D,
    fact:'Three kinds of nebula in one: a red cloud of glowing hydrogen, split into three lobes by dark lanes of dust, and a blue cloud of dust beside it that only reflects starlight. A young, very hot star at its middle lights it up.',
    pos, rad:RAD, sizeR:17, R0:skyR0(pos, [0, 0, 1], 0), prog:nurseryProg(0), minZoom:0.04, pxMin:6, farColor:[1, 0.55, 0.65], farLum:0.5, labelRange:1e5, labelMin:10,
    aka:'m20 messier 20 ngc 6514 trifid nebula hd 164492 sagittarius',
    visFn(rpx){ return smooth(6, 16, rpx)*(0.2 + 0.8*smooth(1, 15, viewDist())); },
    views:[{ dirFn:() => V.norm(V.mul(pos, -1)), k:1.7, off:[0, 0.18, 0], hold:9, drift:0.02 }, { d:[0.55, 0.3, 0.8], k:1.7, hold:8, drift:0.03 }, { d:[0.1, -0.2, 1], k:0.8, off:[0.02, -0.08, 0.04], hold:9, drift:0.02 }],
    particles:[{ ps:cl.ps, prog:'ptBasic', mode:1, sb:1.1, size:1.8 }, { ps:cl.spikes, prog:'spike', lines:true, mode:1, sb:1.1, size:1, len:0.03, q0:() => [1, 0, 0, 0] }],
    readout:() => '4,100 light-years (Gaia) · about 35 light-years across\nits dark lanes are dust in front of the glowing gas' });
}
{
  const D = 5480, pos = simbadPos(275.1958, -16.1717, D), RAD = 22;
  const cl = clusterPS(Math.round(260*QUALITY), [-0.05, 0.04, 0], 0.18, 30000);
  addObj({ key:'omega', name:'Omega Nebula', label:'Omega Nebula', type:'star-forming region · M17 · the Swan · in Sagittarius', group:'nebulae', sortKey:D,
    fact:'One of the brightest star-forming regions in our galaxy. Its brightest gas forms a bar with a hook at one end, a swan or a Greek omega. Massive young stars inside are eating into the dark cloud beside it, where new stars are still forming.',
    pos, rad:RAD, sizeR:20, R0:skyR0(pos, [0, 0, 1], 120), prog:nurseryProg(1), minZoom:0.04, pxMin:6, farColor:[1, 0.5, 0.6], farLum:0.55, labelRange:1e5, labelMin:10,
    aka:'m17 messier 17 ngc 6618 omega nebula swan nebula horseshoe nebula checkmark nebula m17 sw sagittarius',
    visFn(rpx){ return smooth(6, 16, rpx)*(0.2 + 0.8*smooth(1, 15, viewDist())); },
    views:nebView(pos, [{ d:[0.4, 0.6, 0.7], k:1.7, hold:8, drift:0.03 }, { d:[0.2, -0.1, 1], k:0.9, off:[-0.1, 0.05, 0.05], hold:9, drift:0.02 }]),
    particles:[{ ps:cl.ps, prog:'ptBasic', mode:1, sb:1.1, size:1.8 }, { ps:cl.spikes, prog:'spike', lines:true, mode:1, sb:1.1, size:1, len:0.03, q0:() => [1, 0, 0, 0] }],
    readout:() => '5,500 light-years (Gaia) · its bright part about 20 light-years across\nits central stars are only about a million years old' });
}

// ---------------------------------------------------------------- open clusters, from their real stars: the Beehive (M44), the Wild Duck (M11), Ptolemy's Cluster (M7)
// (and the open clusters of p9-messier2.js). An open cluster is drawn from its Gaia DR3 members (CLUSTER_STARS, p0-cluster-stars-data.js,
// made by tools/cluster-stars.mjs from Hunt & Reffert 2023): each star at its real place on the sky, with its real brightness and colour.
// Only how far along our line of sight each one sits is made up (a bell curve as wide as the cluster on the sky): one star's parallax is not
// precise enough at these distances. Colour: BP-RP less the reddening (E(BP-RP) about 0.42 AV) turned into a temperature (Mucciarelli &
// Bellazzini 2020, for dwarfs); the size of a point goes by the star's absolute G magnitude. Stars only, no volume.
function gaiaCluster(key){
  const c = CLUSTER_STARS[key], D = c.pc*3.2616, pos = radec(c.ra/15, c.dec, D), R0 = facingEarth(pos, [0, 0, 1], 0);
  const bin = atob(c.s), dv = new DataView(Uint8Array.from(bin, ch => ch.charCodeAt(0)).buffer), n = c.k, cd = Math.cos(c.dec*DEG), lyDeg = DEG*D;
  const S = [];
  for (let i=0;i<n;i++) S.push({ xi:dv.getInt16(i*6, true)/6000, eta:dv.getInt16(i*6 + 2, true)/6000, g:dv.getUint8(i*6 + 4)/10, bc:dv.getInt8(i*6 + 5) });
  const rr = S.map(s => Math.hypot(s.xi, s.eta)*lyDeg).sort((a, b) => a - b), RAD = rr[Math.floor(0.98*(n - 1))]*1.05;
  const sig = Math.sqrt(S.reduce((a, s) => a + (s.xi*s.xi + s.eta*s.eta)*lyDeg*lyDeg, 0)/(2*n));
  // (the depths come from a little generator of its own, seeded by the key, so the shared rnd() is left alone)
  let z = [...key].reduce((h, ch) => Math.imul(h ^ ch.charCodeAt(0), 16777619), 2166136261) >>> 0;
  const u01 = () => { z = (z + 0x6D2B79F5) >>> 0; let t = z; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0)/4294967296; };
  const gauss = () => Math.sqrt(-2*Math.log(Math.max(u01(), 1e-9)))*Math.cos(6.2832*u01());
  const mu = 5*Math.log10(c.pc/10) + 0.79*c.av, ebr = 0.42*c.av, ps = makePS(n), all = [];
  // (a point's size on the drawing: by the star's absolute G, then lifted so the cluster's middle star reads, 0.27.7. Gaia's 600 members of a
  // near cluster reach far down among its dwarfs, the Beehive's most of all, and at the plain scale the whole cluster was a few faint dots)
  const w0 = s => clamp(0.6 + (6 - (s.g - mu))*0.2, 0.5, 2.4), med = S.map(w0).sort((a, b) => a - b)[n >> 1], lift = clamp(1.15/med, 1, 1.9);
  S.forEach((s, i) => {
    const w = radec((c.ra + s.xi/cd)/15, c.dec + s.eta, D + gauss()*sig), p = V.mul(M3.applyT(R0, V.sub(w, pos)), 1/RAD);
    const C = clamp(s.bc === -128 ? 0.8 : s.bc/40 - ebr, -0.45, 3), T = clamp(5040/(0.4929 + 0.5092*C - 0.0353*C*C), 3000, 25000);
    const col = blackbodyJS(T), wt = Math.min(w0(s)*lift, 2.6);
    ps.a.set([p[0], p[1], p[2], wt], i*4); ps.c.set([col[0], col[1], col[2], 0], i*4); all.push({ p, w:wt, c:col });
  });
  ps.upload('ac');
  const bright = all.filter(s => s.w > 1.8).sort((a, b) => b.w - a.w).slice(0, 8).map(s => ({ p:s.p, w:Math.min(s.w, 2.4), c:s.c }));
  return { pos, D, RAD, R0, R90:rr[Math.floor(0.9*(n - 1))], cl:{ ps, spikes:makeSpikes(bright) } };
}
// (the angles: from Earth, from the side, and from inside the cluster's middle; RAD reaches out to its farthest members, so the angles sit
// closer in than a nebula's. In mode 1 drawParticles already scales a point's strength by the square of the object's radius, and its light
// falls off with the square of its distance, so every cluster looks as bright at its own framing, whatever its size. A second (rad/16)^2 here
// made M39 about 13 times brighter than M36 and saturated the big clusters: from Codex's review of #50)
// 0.27.7 (from the review of 2026-11-09: 17 open clusters opened on a few crosses on black, the Beehive on three): the first two angles
// stand outside the cluster, 1.4 and 1.2 radii from its middle, so it reads as a swarm that thickens toward its centre (they stood inside
// it, at 0.7, with its stars strewn across the whole screen), and the third is from inside, at 0.4. The stars are points of 2.5 px whose light
// falls off with their distance, not its square (particle mode 4): by the square, a setting bright enough from outside burned out from
// inside. The crosses on the brightest stars keep the square law (their shader has no other) and are set for the outside angles.
function addOpenCluster(def, cl, extra = []){
  return addObj(Object.assign({ tags:['clusters'], group:'nebulae', R0:facingEarth(def.pos, [0, 0, 1], 0), minZoom:0.03, pxMin:5, farColor:[0.8, 0.86, 1], farLum:0.6,
    views:[{ dirFn:() => V.norm(V.mul(def.pos, -1)), k:1.4, hold:9, drift:0.02 }, { d:[0.6, 0.4, 0.7], k:1.2, hold:8, drift:0.03 }, { d:[0.2, 0.15, 1], k:0.4, hold:8, drift:0.03 }],
    particles:[{ ps:cl.ps, prog:'ptBasic', mode:4, sb:(def.sb ?? 0.7)*5.1, size:2.5 }, ...extra, { ps:cl.spikes, prog:'spike', lines:true, mode:1, sb:6, size:1, len:0.04, q0:() => [1, 0, 0, 0] }] }, def));
}
// an open cluster from its Gaia members, by its key in CLUSTER_STARS (the atlas's key too)
function gaiaOpenCluster(key, def){
  const G = gaiaCluster(key);
  return addOpenCluster(Object.assign({ key, pos:G.pos, rad:G.RAD, R0:G.R0, sizeR:G.R90, sortKey:Math.round(G.D) }, def), G.cl);
}
gaiaOpenCluster('beehive', { name:'Beehive Cluster', label:'Beehive', type:'open star cluster · M44 · Praesepe · in Cancer', labelRange:4e4,
  fact:'Over a thousand stars born together some 600 to 700 million years ago. Known since ancient times as a little cloud, it was seen as stars by Galileo in 1610. Planets have been found round several of its stars.',
  aka:'m44 messier 44 ngc 2632 praesepe beehive manger cancer',
  readout:() => '600 light-years (Gaia) · its stars spread over about 40 light-years\nabout 650 million years old · 600 of its stars as Gaia measured them' });
gaiaOpenCluster('wildduck', { name:'Wild Duck Cluster', label:'Wild Duck', type:'open star cluster · M11 · in Scutum', labelRange:9e4,
  fact:'One of the richest and most massive open clusters known: thousands of stars born together about 300 million years ago. Its brightest stars form a V, like a flight of wild ducks.',
  aka:'m11 messier 11 ngc 6705 wild duck scutum',
  readout:() => '7,300 light-years (Gaia) · its stars spread over about 35 light-years\nabout 300 million years old · 600 of its stars as Gaia measured them' });
gaiaOpenCluster('ptolemy', { name:"Ptolemy's Cluster", label:"Ptolemy's Cluster", type:'open star cluster · M7 · in Scorpius', labelRange:4e4,
  fact:'A bright cluster by the tail of Scorpius, easy to see with the naked eye and the farthest south of all the Messier objects. Ptolemy described it nearly 1,900 years ago as a nebula following the sting of Scorpius.',
  aka:'m7 messier 7 ngc 6475 ptolemy scorpius',
  readout:() => '900 light-years (Gaia) · its stars spread over about 45 light-years\nabout 220 million years old · 600 of its stars as Gaia measured them' });

// ---------------------------------------------------------------- globular clusters: M3, M4, M22 (the glow shader is Omega Centauri's)
function globularPS(n, rc, giants, bhb, flat = 1){
  const ps = makePS(n);
  for (let i=0;i<n;i++){
    let r; do { r = rc/Math.sqrt(Math.pow(Math.max(rnd(), 1e-6), -2/3) - 1); } while (r > 1);   // Plummer sphere
    const dd = randDir(), u = rnd();
    const c = u < giants ? [1, 0.64, 0.38] : (u < giants + bhb ? [0.62, 0.74, 1] : blackbodyJS(5200 + 1100*rnd()));
    const w = u < giants ? 1.7 + rnd() : (u < giants + bhb ? 1.3 : 0.5 + 0.5*rnd());
    ps.a.set([dd[0]*r, dd[1]*r*flat, dd[2]*r, w], i*4); ps.c.set([c[0], c[1], c[2], 0], i*4);
  }
  ps.upload('ac');
  return ps;
}
function addGlobular(def){
  return addObj(Object.assign({ tags:['clusters'], group:'nebulae', R0:facingEarth(def.pos, [0, 0, 1], 0), prog:omegacen.prog, minZoom:0.03, pxMin:5, farColor:[1, 0.9, 0.75], farLum:0.6,
    setU(pr){ gl.uniform4f(pr.u.uP0, def.glow ?? 0.6, 0, 0, 0); },
    views:[{ d:[0.2, 0.3, 1], k:1.7, hold:9, drift:0.03 }, { d:[0.6, 0.4, 0.7], k:0.4, hold:8, drift:0.04 }, { d:[0.3, 0.2, 1], k:0.08, hold:8, drift:0.05 }],
    particles:[{ ps:def.ps, prog:'ptBasic', mode:0, sb:0.4, size:1.3, cap:0.9 }] }, def));
}
{
  const D = 33200, pos = simbadPos(205.5484, 28.3773, D);
  addGlobular({ key:'m3', name:'M3', label:'M3', type:'globular cluster · in Canes Venatici', sortKey:D, pos, rad:100, sizeR:87, labelRange:2.4e5,
    ps:globularPS(Math.round(20000*QUALITY), 0.09, 0.08, 0.06),
    fact:'Some 400,000 Suns\' worth of stars about 11 billion years old, and the first object in his catalogue that Messier discovered himself (1764). It holds about 240 RR Lyrae stars, more than almost any other globular cluster, each brightening and fading every half a day or so.',
    aka:'m3 messier 3 ngc 5272 globular cluster canes venatici rr lyrae variable stars',
    readout:() => '33,200 light-years · about 170 light-years across\nabout 240 of its stars pulse in brightness' });
}
{
  const D = 6030, pos = simbadPos(245.8968, -26.5258, D);
  addGlobular({ key:'m4', name:'M4', label:'M4', type:'globular cluster · the nearest · in Scorpius', sortKey:D, pos, rad:34, sizeR:27, labelRange:1.2e5, glow:0.45,
    ps:globularPS(Math.round(12000*QUALITY), 0.16, 0.08, 0.1, 0.92),
    fact:'The nearest globular cluster to us, about 12 billion years old. Hubble found some of the oldest white dwarfs known in it, and its one known pulsar has a planet, among the oldest planets known.',
    aka:'m4 messier 4 ngc 6121 globular cluster scorpius psr b1620-26 methuselah white dwarfs',
    readout:() => '6,000 light-years · about 55 light-years across\nits pulsar\'s planet probably formed 12 to 13 billion years ago' });
}
{
  const D = 10760, pos = simbadPos(279.0998, -23.9048, D);
  addGlobular({ key:'m22', name:'M22', label:'M22', type:'globular cluster · in Sagittarius', sortKey:D, pos, rad:60, sizeR:50, labelRange:1.6e5,
    ps:globularPS(Math.round(16000*QUALITY), 0.11, 0.08, 0.12, 0.88),
    fact:'Probably the first globular cluster ever found, in 1665, and one of the brightest in our sky. Radio telescopes found two black holes inside it in 2012, and it hides a small planetary nebula.',
    aka:'m22 messier 22 ngc 6656 globular cluster sagittarius black holes',
    readout:() => '10,800 light-years · about 100 light-years across\nabout 470,000 times the Sun\'s mass in all' });
}

// ---------------------------------------------------------------- galaxies (addGalaxy, 06g-galaxies.js), each tilted to its real position angle
// (distances: Cosmicflows-4 by method, PHANGS, the M106 maser, Cepheids for M77; sizes: HyperLeda's D25; inclinations: PHANGS where
// measured, else HyperLeda)
const galAt = (ra, dec, ly, incl, pa) => { const pos = simbadPos(ra, dec, ly); return { pos, R0:discR0(pos, incl, pa), sortKey:ly }; };
// (a smooth elliptical's glow sits well inside its bounding sphere: closer angles than a spiral's. In the galaxy's frame Earth is in the
// direction [sin i, cos i, 0], so the first angle is the view from Earth)
const ellViews = incl => [{ d:[Math.sin(incl*DEG), Math.cos(incl*DEG), 0], k:1.25, hold:9, drift:0.02 }, { d:[0.7, 0.5, 0.5], k:1.1, hold:8, drift:0.03 }, { d:[0.3, 0.9, 0.3], k:0.55, hold:8, drift:0.03 }];
addGalaxy({ key:'sunflower', name:'Sunflower Galaxy', label:'Sunflower', type:'flocculent spiral galaxy · M63 · in Canes Venatici', ...galAt(198.9553, 42.0294, 28.8e6, 59, 102),
  fact:'A spiral without long, clear arms: its stars and dust lie in many short arm segments, like the seeds of a sunflower. A faint loop of stars round it is all that is left of a small galaxy it swallowed.',
  rad:54000, sizeR:49500, g:{ arms:2, pitch:18, bulge:0.7, dust:1.3, H:0.011, sf:0.9, irr:0.55, Rd:0.26, seed:81 },
  aka:'m63 messier 63 ngc 5055 sunflower galaxy flocculent canes venatici',
  readout:() => '29 million light-years · about 100,000 light-years across\nits arms are many short pieces, not two long ones' });
addGalaxy({ key:'blackeye', name:'Black Eye Galaxy', label:'Black Eye', type:'spiral galaxy · M64 · in Coma Berenices', ...galAt(194.1821, 21.6827, 14.4e6, 59, 113),
  fact:'A dark band of dust sweeps across one side of its bright centre, like a black eye. Its outer gas turns the opposite way to its inner gas and stars, probably a sign that it took in gas from a small galaxy long ago.',
  rad:24000, sizeR:21500, g:{ arms:2, pitch:9, bulge:1.3, dust:1.4, H:0.012, sf:0.35, Rd:0.24, ring:0.2, seed:83 },
  aka:'m64 messier 64 ngc 4826 black eye galaxy sleeping beauty evil eye coma berenices',
  readout:() => '14 million light-years · about 43,000 light-years across\nits outer gas turns the other way round' });
addGalaxy({ key:'m83', name:'Southern Pinwheel Galaxy', label:'M83', type:'barred spiral galaxy · M83 · in Hydra', ...galAt(204.2538, -29.8658, 15.6e6, 24, 45),
  fact:'A bright, nearly face-on barred spiral, crowded with pink star-forming regions. Astronomers have seen six supernovae explode in it since 1923, among the most for any galaxy.',
  rad:34000, sizeR:31000, g:{ arms:2, pitch:16, bulge:0.35, dust:1.1, bar:0.14, H:0.01, sf:1.7, irr:0.2, Rd:0.3, armRef:0.32, barAng:30, seed:85 },
  aka:'m83 messier 83 ngc 5236 southern pinwheel barred spiral hydra',
  readout:() => '15.6 million light-years · about 60,000 light-years across\nsix supernovae seen in it since 1923' });
addGalaxy({ key:'m77', name:'M77', label:'M77', type:'spiral galaxy with an active centre · in Cetus', ...galAt(40.6696, -0.0133, 35e6, 35, 72),
  fact:'One of the best-known Seyfert galaxies, whose centres blaze with gas falling into a black hole: here one of about 10 million Suns, hidden behind a ring of dust. In 2022 the IceCube detector at the South Pole found evidence of neutrinos coming from it.',
  rad:34000, sizeR:31000, g:{ arms:2, pitch:12, bulge:1.3, dust:1, H:0.011, sf:1, Rd:0.28, ringR:0.14, ringW:0.03, ringGain:2.2, seed:87 },
  aka:'m77 messier 77 ngc 1068 cetus a squid galaxy seyfert active galaxy icecube neutrinos',
  readout:() => '35 million light-years (Cepheids; older estimates go up to 47)\nabout 60,000 light-years across · a black hole of about 10 million Suns' });
addGalaxy({ key:'m65', name:'M65', label:'M65', type:'spiral galaxy · the Leo Triplet · in Leo', ...galAt(169.733, 13.0923, 36.9e6, 76, 174),
  fact:'One of three spirals close together in Leo, the Leo Triplet. Its arms are wound tightly and it has little gas left, so it forms few new stars now.',
  rad:44000, sizeR:41000, g:{ arms:2, pitch:9, bulge:1, dust:1.6, H:0.011, sf:0.3, Rd:0.24, seed:89 },
  aka:'m65 messier 65 ngc 3623 leo triplet leo',
  readout:() => '37 million light-years · about 80,000 light-years across\nM66 is about 220,000 light-years from it on the sky' });
addGalaxy({ key:'m66', name:'M66', label:'M66', type:'barred spiral galaxy · the Leo Triplet · in Leo', ...galAt(170.0626, 12.9915, 36e6, 57, 173),
  fact:'The brightest of the Leo Triplet. Its arms are lopsided, probably stirred by a close pass with its neighbour NGC 3628 about 800 million years ago.',
  rad:57000, sizeR:53500, g:{ arms:2, pitch:14, bulge:0.8, dust:1.4, bar:0.15, H:0.012, sf:1.4, irr:0.35, Rd:0.28, seed:91 },
  aka:'m66 messier 66 ngc 3627 leo triplet leo',
  readout:() => '36 million light-years · about 105,000 light-years across\nfive possible supernovae seen in it since 1973' });
// (the third of the Leo Triplet, drawn so the group looks right; not on either checklist, so it is left out of the atlas like NGC 1300)
addGalaxy({ key:'ngc3628', name:'NGC 3628', label:'NGC 3628', type:'edge-on spiral · the Hamburger Galaxy · Leo Triplet', ...galAt(170.0709, 13.5895, 36.9e6, 85, 104), atlas:false,
  fact:'Seen edge-on, a thick lane of dust through a puffed-up disc. A tail of stars over 300,000 light-years long trails behind it, pulled out by its neighbours.',
  rad:62000, g:{ arms:2, pitch:12, bulge:0.6, dust:2.6, H:0.022, sf:0.6, Rd:0.3, seed:93 }, farLum:0.5,
  aka:'ngc 3628 hamburger galaxy leo triplet', readout:() => '37 million light-years' });
addGalaxy({ key:'m106', name:'M106', label:'M106', type:'spiral galaxy · in Canes Venatici', ...galAt(184.7401, 47.3037, 24.7e6, 68, 150),
  fact:'Water molecules swirling round its central black hole shine as natural masers. Tracking them gave its distance by pure geometry, the first such distance to a galaxy beyond our Local Group. Two extra arms of hot gas, seen in radio and X-rays, mark where jets from its black hole heat the gas in its disc.',
  rad:64000, sizeR:61000, g:{ arms:2, pitch:15, bulge:0.9, dust:1.2, bar:0.12, H:0.011, sf:0.9, irr:0.2, Rd:0.27, seed:95 },
  aka:'m106 messier 106 ngc 4258 maser anomalous arms canes venatici',
  readout:() => '24.7 million light-years, measured geometrically from its masers\nabout 120,000 light-years across · a black hole of about 40 million Suns' });
addGalaxy({ key:'phantom', name:'Phantom Galaxy', label:'Phantom', type:'grand-design spiral galaxy · M74 · in Pisces', ...galAt(24.1739, 15.7836, 32e6, 9, 25),
  fact:'A textbook spiral seen almost exactly face-on, its two long arms traced by pink star-forming regions. It is faint for a Messier object, hence the name. JWST\'s 2022 picture showed its dust as a lace of filaments.',
  rad:48000, sizeR:45000, g:{ arms:2, pitch:14, bulge:0.4, dust:1.2, H:0.01, sf:1.5, irr:0.15, Rd:0.3, armRef:0.35, seed:97 },
  aka:'m74 messier 74 ngc 628 phantom galaxy grand design pisces jwst',
  readout:() => '32 million light-years · about 90,000 light-years across\nseen almost face-on, tilted about 10 to 20 degrees' });
addGalaxy({ key:'m84', name:'M84', label:'M84', type:'elliptical galaxy · Markarian\'s Chain · Virgo Cluster', ...galAt(186.2656, 12.887, 59.5e6, 30, 133),
  fact:'A big, smooth galaxy near the heart of the Virgo Cluster, at the start of the curved line of galaxies called Markarian\'s Chain. Its central black hole of about 850 million Suns fires two jets that show in radio light.',
  rad:66000, sizeR:63000, g:{ ell:0.12, Rd:0.42, sf:0.05, gain:1.5 }, stars:5000, farLum:0.8, views:ellViews(30),
  aka:'m84 messier 84 ngc 4374 3c 272.1 markarian\'s chain markarian chain virgo cluster',
  readout:() => '60 million light-years · about 125,000 light-years across\nits black hole weighs about 850 million Suns' });
// (M86's distance, 58.3 million light-years, is Blakeslee et al. 2009's: until 0.25.0 it was 54.9, from a typo in Mei et al. 2007 that
// Blakeslee et al. corrected, found while researching the last Messier pack; its size, about 150,000 light-years, is RC3's D25 at it)
addGalaxy({ key:'m86', name:'M86', label:'M86', type:'lenticular galaxy · Markarian\'s Chain · Virgo Cluster', ...galAt(186.5492, 12.946, 58.3e6, 50, 129),
  fact:'One of the few galaxies coming toward us. It falls through the Virgo Cluster toward us at about 1,300 km/s, faster than the cluster itself moves away from us, so its light is shifted to the blue. Its hot gas streams off behind it in a long plume.',
  rad:80000, sizeR:75000, g:{ ell:0.32, Rd:0.42, sf:0.04, gain:1.5 }, stars:5000, farLum:0.85, views:ellViews(50),
  aka:'m86 messier 86 ngc 4406 markarian\'s chain markarian chain virgo cluster blueshift',
  readout:() => '58.3 million light-years · about 150,000 light-years across\ncoming toward us at about 240 km/s' });

seed = P8_SEED;

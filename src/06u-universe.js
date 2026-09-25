
// ================================================================ the cosmic web (real clusters, voids and walls joined by a statistical web) and the observable universe
const cosmicWeb = (() => {
  const R = 2e9, MLY = 1e6;
  const known = [   // name, RA (h), Dec (deg), distance (Mly), richness
    ['Virgo Cluster', hms(12,27), dms(12,43), 54, 1], ['Fornax Cluster', hms(3,38), dms(-35,27), 62, 0.45], ['Centaurus Cluster', hms(12,48,51), dms(-41,18), 170, 0.6],
    ['Hydra Cluster', hms(10,36), dms(-27,31), 158, 0.5], ['Norma Cluster', hms(16,15), dms(-60,54), 220, 0.8], ['Perseus Cluster', hms(3,18), dms(41,30), 240, 0.9],
    ['Coma Cluster', hms(12,59,49), dms(27,59), 321, 1.1], ['Pisces Cluster', hms(1,52), dms(36,9), 212, 0.5], ['Hercules Cluster', hms(16,5), dms(17,45), 500, 0.7],
    ['Leo Cluster', hms(11,44), dms(19,50), 330, 0.6], ['Shapley Supercluster', hms(13,28), dms(-31,30), 650, 1.4], ['Horologium Supercluster', hms(3,19), dms(-50,2), 700, 1],
    ['Corona Borealis Supercluster', hms(15,22), dms(27,42), 1000, 0.8],
  ];
  const voids = [[hms(18,38), 18, 75, 70], [hms(14,50), 46, 700, 165], [hms(3,30), -20, 1000, 180]];   // Local Void, Boötes Void, Eridanus supervoid
  const nodes = [];
  known.forEach(([name, ra, dec, d, r]) => nodes.push({ p:radec(ra, dec, d*MLY), r, name }));
  for (let i=0;i<22;i++){ const ra = 9 + 6*i/21 + rndn()*0.15, dec = 2 + rndn()*2.5, d = 1000 + 90*rndn(); nodes.push({ p:radec(ra, dec, d*MLY), r:0.45 + 0.4*rnd() }); }   // Sloan Great Wall
  const inVoid = p => voids.some(([ra, dec, d, rr]) => V.len(V.sub(p, radec(ra, dec, d*MLY))) < rr*MLY);
  let guard = 0;
  while (nodes.length < 420 && guard++ < 20000){
    const dd = randDir(), r = R*Math.cbrt(rnd());
    const p = V.mul(dd, r); if (r < 25*MLY || inVoid(p)) continue;
    nodes.push({ p, r:Math.min(0.15 + (-Math.log(1 - rnd()*0.999))*0.25, 1.2) });
  }
  // filaments: each node joins its three nearest neighbours
  const edges = new Set();
  nodes.forEach((a, i) => {
    const near = nodes.map((b, j) => [V.len(V.sub(a.p, b.p)), j]).filter(x => x[1] !== i).sort((x, y) => x[0] - y[0]).slice(0, 3);
    near.forEach(([dist, j]) => { if (dist < 420*MLY) edges.add(Math.min(i, j) + ',' + Math.max(i, j)); });
  });
  const nG = Math.round(60000*QUALITY), ps = makePS(nG); let k = 0;
  const put = (p, c, w) => { if (k >= nG) return; ps.a.set([p[0]/R, p[1]/R, p[2]/R, w], k*4); ps.c.set([c[0], c[1], c[2], 0], k*4); k++; };
  const edgeList = [...edges].map(s => s.split(',').map(Number));
  const nodeShare = 0.38;
  nodes.forEach(nd => { const n = Math.round(nG*nodeShare*nd.r/nodes.reduce((s, x) => s + x.r, 0)); for (let i=0;i<n;i++){ const e = randDir(), s = Math.abs(rndn())*(4 + 7*nd.r)*MLY; const q = rnd(); put(V.add(nd.p, V.mul(e, s)), q < 0.7 ? [1, 0.78, 0.55] : [0.8, 0.85, 1], 0.6 + 0.3*nd.r); } });
  const lens = edgeList.map(([a, b]) => V.len(V.sub(nodes[a].p, nodes[b].p))), totL = lens.reduce((s, x) => s + x, 0);
  // filaments bow and wander between their clusters (quadratic curves with a random bulge), thick in the middle
  edgeList.forEach(([a, b], i) => { const n = Math.round(nG*0.52*lens[i]/totL), A = nodes[a].p, B = nodes[b].p, L = lens[i];
    const C = V.add(V.lerp(A, B, 0.5), V.mul(randDir(), L*(0.12 + 0.2*rnd()))), thick = (4 + 8*rnd())*MLY;
    for (let j=0;j<n;j++){ const u = rnd(), q = V.add(V.add(V.mul(A, (1 - u)*(1 - u)), V.mul(C, 2*u*(1 - u))), V.mul(B, u*u));
      const w = thick*(0.5 + Math.sin(u*Math.PI))*(0.6 + 0.8*Math.abs(Math.sin(u*9 + i))), e = randDir();
      put(V.add(q, V.mul(e, Math.abs(rndn())*w)), rnd() < 0.75 ? [0.7, 0.8, 1] : [1, 0.85, 0.65], 0.7); } });
  while (k < nG){ const p = V.mul(randDir(), R*Math.cbrt(rnd())); if (inVoid(p)) continue; put(p, [0.7, 0.75, 0.9], 0.5); }
  ps.count = k; ps.upload('ac');
  const o = addObj({ key:'cosmicweb', name:'the cosmic web', label:'cosmic web', type:'filaments of galaxies around vast empty voids', group:'cosmic', sortKey:1e9, layer:1,
    fact:'Galaxies gather into clusters strung along filaments hundreds of millions of light-years long, around voids. The famous clusters and voids here are at their real positions; the web between them is a statistical model.',
    pos:[0, 0, 0], rad:R, minZoom:0.002, pxMin:3, noImpostor:true, labelRange:1.2e11, labelMin:3e8, distEarth:'all around us', aka:'large scale structure laniakea filaments voids',
    particleVis:rpx => smooth(3e6, 3e7, orbit.dist),
    views:[{d:[0.4, 0.55, 1], k:1.9, hold:10, drift:0.02}, {d:[1, 0.2, 0.2], k:0.55, hold:9, drift:0.03}, {d:[0.3, 1, 0.1], k:0.22, hold:8, drift:0.03}],
    particles:[{ps, prog:'ptBasic', mode:0, sb:0.75, size:1.3, cap:0.55, rot:() => I3}],
    readout:() => 'each dot is a galaxy · the Milky Way sits in the Laniakea supercluster\nthe Boötes Void, 330 million ly across, is almost empty' });
  known.forEach(([name, ra, dec, d]) => addMarker('mk-' + name, name, radec(ra, dec, d*MLY), 2e6, 2.5e9, { labelMin:3e7 }));
  addMarker('mk-bootes', 'Boötes Void', radec(hms(14,50), 46, 700*MLY), 1e8, 3e9, { labelMin:2e8 });
  addMarker('mk-sloan', 'Sloan Great Wall', radec(12, 2, 1000*MLY), 1e8, 4e9, { labelMin:3e8 });
  addMarker('mk-laniakea', 'Laniakea Supercluster', radec(hms(16,15), dms(-50,0), 160*MLY), 1e8, 3e9, { labelMin:2e8 });
  return o;
})();
// the observable universe: galaxy clusters out to the particle horizon, and the cosmic microwave background shell 46.5 billion ly away
const FS_UNIVERSE = COMMON + `
vec3 cmbCol(float x){ x = clamp(x, 0., 1.); return x < 0.5 ? mix(vec3(0.05, 0.1, 0.55), vec3(0.95, 0.92, 0.85), x*2.) : mix(vec3(0.95, 0.92, 0.85), vec3(0.95, 0.35, 0.08), (x - 0.5)*2.); }
float cmb(vec3 u){ return fbm(u*3.) *0.55 + fbm(u*9. + 3.)*0.3 + noise(u*28.)*0.15; }
void main(){
  vec3 o, d; localRay(o, d);
  vec2 h = sphIsect(o, d, vec3(0.), 1.);
  if(h.y < 0.) discard;
  vec3 col = vec3(0.); float a = 0.;
  bool outside = h.x > 0.;
  vec3 p = o + d*(outside ? h.x : h.y);
  float t = cmb(normalize(p));
  if(outside){
    float mu = abs(dot(normalize(p), d));
    col = cmbCol(smoothstep(0.3, 0.75, t))*(0.25 + 0.35*pow(mu, 0.5))*uP0.x;
    // the far side seen through the near side, fainter
    vec3 pb = o + d*h.y; col += cmbCol(smoothstep(0.3, 0.75, cmb(normalize(pb))))*0.06*uP0.x;
    col += vec3(0.6, 0.7, 1.)*pow(1. - mu, 6.)*0.3*uP0.x;
  } else {
    col = cmbCol(smoothstep(0.3, 0.75, t))*0.05*uP0.y;
  }
  outCol(col, 0.);
}`;
const universe = (() => {
  const R = 4.65e10, n = Math.round(45000*QUALITY), ps = makePS(n);
  // clusters of galaxies in a coarse web, thinning out toward the edge where we see the young universe
  const seeds = []; for (let i=0;i<700;i++) seeds.push(V.mul(randDir(), R*0.97*Math.cbrt(rnd())));
  for (let i=0;i<n;i++){ const s = seeds[Math.floor(rnd()*seeds.length)], t = seeds[Math.floor(rnd()*seeds.length)], L = V.len(V.sub(s, t));
    const p = L < R*0.35 ? V.add(V.lerp(s, t, rnd()), V.mul(randDir(), R*0.012*Math.abs(rndn()))) : V.add(s, V.mul(randDir(), R*0.02*Math.abs(rndn())));
    const r = V.len(p)/R, c = V.lerp([0.85, 0.85, 1], [1, 0.55, 0.35], smooth(0.4, 1, r));
    ps.a.set([p[0]/R, p[1]/R, p[2]/R, 0.9*(1 - 0.5*r)], i*4); ps.c.set([c[0], c[1], c[2], 0], i*4); }
  ps.upload('ac');
  const o = addObj({ key:'universe', name:'the observable universe', label:'observable universe', type:'everything light has had time to reach us from, in 13.8 billion years', group:'cosmic', sortKey:9e10, layer:0,
    fact:'A sphere 93 billion light-years across centred on us. Its edge is the cosmic microwave background, the afterglow of the Big Bang released 380,000 years after it began. (The pattern is illustrative.)',
    pos:[0, 0, 0], rad:R, prog:program(VS_RECT, FS_UNIVERSE), minZoom:0.03, pxMin:2, noImpostor:true, labelRange:1e13, labelMin:6e10, distEarth:'46.5 billion ly to the edge', aka:'cmb big bang edge horizon',
    visFn:() => smooth(8e8, 1.2e10, orbit.dist),
    particleVis:() => smooth(4e9, 2.5e10, orbit.dist),
    setU(pr){ gl.uniform4f(pr.u.uP0, smooth(2e10, 8e10, V.len(this.rel)), smooth(3e9, 3e10, orbit.dist), 0, 0); },
    views:[{d:[0.3, 0.4, 1], k:2.6, hold:12, drift:0.02}, {d:[1, 0.1, 0.3], k:1.7, hold:9, drift:0.03}],
    particles:[{ps, prog:'ptBasic', mode:0, sb:0.7, size:1.2, cap:0.8, rot:() => I3}],
    readout:() => 'about 2 trillion galaxies · edge 46.5 billion light-years away\nthe universe has expanded while the light was on its way' });
  return o;
})();

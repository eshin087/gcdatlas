
// ================================================================ M87: giant elliptical galaxy, its 5,000-light-year jet, and M87*, the first black hole ever imaged
const M87_POS = radec(hms(12,30,49.4), dms(12,23,28), 53.5e6);
const m87 = (() => {
  const o = addGalaxy({ key:'m87', name:'M87', label:'M87', type:'giant elliptical galaxy at the heart of the Virgo Cluster', sortKey:53.5e6,
    fact:'One of the most massive galaxies nearby, swarming with some 12,000 globular clusters. From its core a jet of plasma shoots out at nearly the speed of light.',
    pos:M87_POS, rad:120000, incl:0, stars:9000, g:{ ell:0.12, Rd:0.3, starGain:1.2 }, farLum:1, labelRange:4e8, aka:'virgo a m87 elliptical',
    visFn(rpx){ return smooth(7, 18, rpx)*(0.1 + 0.9*smooth(200, 20000, orbit.dist)); },
    readout:() => '53.5 million light-years · about 2.4 trillion solar masses\nits black hole weighs 6.5 billion Suns' });
  const n = Math.round(4000*QUALITY), gc = makePS(n);
  for (let i=0;i<n;i++){ const d = randDir(), r = 0.03 + 0.9*Math.pow(rnd(), 1.8); gc.a.set([d[0]*r, d[1]*r*0.9, d[2]*r, 0.6 + 0.8*rnd()], i*4); const c = blackbodyJS(4400 + 1500*rnd()); gc.c.set([...c, 0], i*4); }
  gc.upload('ac');
  o.particles.push({ ps:gc, prog:'ptBasic', mode:1, sb:0.5, size:1.6, vis:() => smooth(300, 20000, orbit.dist) });
  return o;
})();
const JET_AXIS = V.norm([Math.sin(17*DEG), Math.cos(17*DEG), 0]);
const M87_R0 = facingEarth(M87_POS, JET_AXIS, 200);
const FS_M87JET = COMMON + `
void main(){
  vec3 o, d; localRay(o, d);
  vec3 ax = vec3(0., 1., 0.);
  vec3 col = jet(o, d, ax, 0.92, 0.002, 0.045, 1.6, uTime*0.4, vec3(0.7, 0.8, 1.), vec3(0.55, 0.6, 1.))*9.;
  // bright knots along the jet: HST-1, D, A, B, C (superluminal motion near the core)
  for(int k=0;k<6;k++){ float s = k == 0 ? 0.013 + 0.004*fract(uTime*0.05) : (k == 1 ? 0.1 : (k == 2 ? 0.22 : (k == 3 ? 0.42 : (k == 4 ? 0.52 : 0.68))));
    float w = k == 0 ? 0.004 : 0.012 + 0.01*float(k); col += vec3(0.75, 0.85, 1.)*blob(o, d, ax*s, w)*(k == 0 ? 20. : (k == 3 ? 16. : 7.)); }
  col += vec3(0.85, 0.9, 1.)*pblob(o, d, vec3(0.), 0.0006)*1200.;
  outCol(col, 0.);
}`;
const m87jet = addObj({ key:'m87jet', name:'the M87 jet', label:'M87 jet', type:'relativistic jet · 5,000 light-years long', group:'galaxies', sortKey:53.5e6 + 1,
  fact:'Electrons spiral in magnetic fields at 99% of the speed of light. Blobs in the jet appear to move up to six times faster than light, an illusion caused by their speed toward us.',
  parent:m87, offset:[0, 0, 0], rad:5500, R0:M87_R0, prog:program(VS_RECT, FS_M87JET), minZoom:0.01, pxMin:6, noImpostor:true, labelRange:1e6, labelMin:300, aka:'jet superluminal hst-1',
  visFn:rpx => smooth(6, 16, rpx)*(0.15 + 0.85*smooth(0.5, 30, orbit.dist)),
  views:[{d:[0.9, 0.35, 0.3], k:0.9, off:[0, 0.45, 0], hold:9, drift:0.02}, {dirFn:() => V.norm(V.mul(M87_POS, -1)), k:1.6, off:[0, 0.3, 0], hold:8, drift:0.02}],
  readout:() => 'apparent speed up to 6c: the blobs almost keep pace with their own light\nbeamed toward us, so the far-side counter-jet is invisible' });
const m87bh = (() => {
  const M = 6.5e9, rs = schwarzschild(M), RB = 20;
  const o = addObj({ key:'m87bh', name:'M87*', label:'M87*', type:'supermassive black hole · 6.5 billion Suns · first ever imaged (2019)', group:'galaxies', sortKey:53.5e6 + 2,
    fact:'Its event horizon is wider than our entire Solar System: Neptune\'s orbit would fit inside it 60 times over. The Event Horizon Telescope photographed its glowing ring in 2019.',
    parent:m87, offset:[0, 0, 0], rad:rs*RB, R0:M87_R0, prog:P.blackhole, minZoom:0.18, pxMin:6, noImpostor:true, labelRange:5, labelMin:1e-4, aka:'m87 black hole eht event horizon telescope',
    setU(pr){ gl.uniform4f(pr.u.uP0, 3, 12, 0.7, 1.3); gl.uniform4f(pr.u.uP1, 1.2, 0, 0.75, 0); },
    views:[{dirFn:() => V.norm(V.mul(M87_POS, -1)), k:1.6, hold:9, drift:0.01}, {d:[1, 0.12, 0.2], k:1.15, hold:8, drift:0.03}, {d:[0.3, 0.9, 0.35], k:3.2, hold:9, drift:0.02}] });
  o.readout = bhReadout(o, M, 'event horizon 38 billion km across (256 AU)\nlight takes a day and a half to cross it');
  addScaleRings(o, [SS_RINGS.neptune, SS_RINGS.voyager], [0.45, 0.62, 1], 8);
  return o;
})();


// ================================================================ Omega Centauri: the Milky Way's greatest globular cluster, ten million stars in a ball 150 light-years wide
const FS_GLOBULAR = COMMON + `
void main(){
  vec3 o, d; localRay(o, d);
  vec2 h = sphIsect(o, d, vec3(0.), 1.);
  if(h.y < 0.) discard;
  // unresolved glow of millions of faint stars: a King-like profile integrated along the ray
  float t0 = max(h.x, 0.), dt = (h.y - t0)/24.; vec3 col = vec3(0.);
  for(int i=0;i<24;i++){ vec3 p = o + d*(t0 + dt*(float(i) + 0.5)); float r = length(p*vec3(1., 1.08, 1.));
    col += vec3(1., 0.86, 0.66)*(1./(1. + pow(r/0.045, 2.)))*smoothstep(1., 0.35, r); }
  outCol(col*dt*uP0.x, 0.);
}`;
const omegacen = (() => {
  const RAD = 90, pos = radec(hms(13,26,47.3), dms(-47,28,46), 17090);
  const n = Math.round(42000*QUALITY), ps = makePS(n);
  for (let i=0;i<n;i++){
    // King-profile radii by rejection, then a stellar population: red giants, blue horizontal branch, turn-off stars
    let r; do { r = 0.085/Math.sqrt(Math.pow(Math.max(rnd(), 1e-6), -2/3) - 1); } while (r > 1);   // Plummer sphere
    const d = randDir(), u = rnd();
    const c = u < 0.08 ? [1, 0.62, 0.35] : (u < 0.14 ? [0.6, 0.72, 1] : blackbodyJS(5200 + 1200*rnd()));
    const w = u < 0.08 ? 1.8 + rnd() : (u < 0.14 ? 1.3 : 0.5 + 0.5*rnd());
    ps.a.set([d[0]*r, d[1]*r*0.93, d[2]*r, w], i*4); ps.c.set([c[0], c[1], c[2], 0], i*4);
  }
  ps.upload('ac');
  return addObj({ key:'omegacen', name:'Omega Centauri', label:'ω Centauri', type:'globular cluster · 10 million stars', group:'nebulae', sortKey:17090,
    fact:'Ten million stars packed into a ball 150 light-years across, possibly the stripped core of a small galaxy the Milky Way swallowed. Fast stars at its centre betray a black hole of ~8,000 Suns.',
    pos, rad:RAD, R0:facingEarth(pos, [0, 0, 1], 0), prog:program(VS_RECT, FS_GLOBULAR), minZoom:0.03, pxMin:5, farColor:[1, 0.88, 0.7], farLum:0.7, labelRange:2e5, aka:'omega centauri ngc 5139 globular cluster',
    setU(pr){ gl.uniform4f(pr.u.uP0, 0.9, 0, 0, 0); },
    views:[{d:[0.2, 0.3, 1], k:1.7, hold:9, drift:0.03}, {d:[0.6, 0.4, 0.7], k:0.35, hold:8, drift:0.04}, {d:[0.3, 0.2, 1], k:0.07, hold:8, drift:0.05}],
    particles:[{ps, prog:'ptBasic', mode:0, sb:0.35, size:1.3, cap:0.9}],
    readout:() => '17,000 light-years · 12 billion years old\nnear the centre, stars are 0.1 light-years apart; its night sky would blaze' });
})();

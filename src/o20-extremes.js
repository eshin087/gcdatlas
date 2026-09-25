
// ================================================================ cosmic extremes: the most massive black hole known, dark matter caught in the act, one of the most distant galaxies
const ton618 = (() => {
  const M = 4.07e10, rs = schwarzschild(M), RB = 20;
  const pos = radec(hms(12,28,24.9), dms(31,28,38), 18.2e9);
  const o = addObj({ key:'ton618', name:'TON 618', label:'TON 618', type:'hyperluminous quasar · one of the most massive black holes known', group:'galaxies', sortKey:18.2e9,
    fact:'A black hole of about 40 billion Suns powering a quasar 140 trillion times brighter than the Sun. Its event horizon would swallow the Solar System out to 50 times Neptune\'s distance.',
    pos, rad:rs*RB, R0:facingEarth(pos, V.norm([0.3, 0.9, 0.2]), 0), prog:P.blackhole, minZoom:0.053, pxMin:6, farColor:[0.75, 0.85, 1], farLum:1.2, labelRange:6e10, aka:'ton 618 quasar biggest black hole',
    distEarth:'light left it 10.8 billion years ago · now ~18 billion ly',
    setU(pr){ gl.uniform4f(pr.u.uP0, 3, 15, 1.7, 1.6); gl.uniform4f(pr.u.uP1, 0.8, 0, 0, 0); },
    views:[{d:[0, 0.22, 1], k:1.5, hold:9, drift:0.03}, {d:[0.3, 0.9, 0.3], k:3.2, hold:9, drift:0.02}] });
  o.readout = bhReadout(o, M, 'event horizon ~1,600 AU across; light takes 9 days to cross it\nwe see it as it was 10.8 billion years ago');
  // (no Solar System scale rings here: Neptune, Voyager and even the Oort cloud's inner edge would all sit inside its black shadow)
  return o;
})();
// the Bullet Cluster: two galaxy clusters that passed through each other; the hot gas (pink) lagged behind the dark matter (blue)
const FS_BULLET = COMMON + `
void main(){
  vec3 o, d; localRay(o, d);
  vec2 h = sphIsect(o, d, vec3(0.), 1.);
  if(h.y < 0.) discard;
  vec3 A = vec3(-0.42, 0., 0.), B = vec3(0.5, 0.02, 0.), gA = vec3(-0.12, 0., 0.), gB = vec3(0.26, 0., 0.);
  vec3 col = vec3(0.);
  float t0 = max(h.x, 0.), dt = (h.y - t0)/32., jit = hash12(gl_FragCoord.xy)*dt;
  for(int i=0;i<32;i++){
    vec3 p = o + d*(t0 + jit + dt*float(i));
    float dmA = exp(-dot(p - A, p - A)/0.06), dmB = exp(-dot(p - B, p - B)/0.025);
    vec3 q = p - gB; float bow = exp(-pow((length(q*vec3(1.2, 1., 1.)) - 0.09 + 0.06*q.x/0.1)/0.03, 2.))*step(-0.02, q.x);
    float gas = exp(-dot(p - gA, p - gA)/0.035)*1.1 + exp(-dot(q, q)/0.006)*0.9 + bow*0.9;
    gas *= 0.7 + 0.6*fbm3(p*9. + 3.);
    col += vec3(1., 0.4, 0.7)*gas*0.9 + vec3(0.25, 0.45, 1.)*(dmA + dmB)*0.45;
  }
  outCol(col*dt*1.6, 0.);
}`;
const bullet = (() => {
  const pos = radec(hms(6,58,37.9), dms(-55,57,0), 3.9e9);
  const n = Math.round(2500*QUALITY), ps = makePS(n);
  for (let i=0;i<n;i++){ const b = rnd() < 0.6, c0 = b ? [-0.42, 0, 0] : [0.5, 0.02, 0], s = b ? 0.18 : 0.12, e = [rndn()*s, rndn()*s, rndn()*s], c = rnd() < 0.8 ? [1, 0.8, 0.55] : [0.75, 0.8, 1];
    ps.a.set([c0[0] + e[0], c0[1] + e[1], c0[2] + e[2], 0.7 + rnd()], i*4); ps.c.set([...c, 0], i*4); }
  ps.upload('ac');
  return addObj({ key:'bullet', name:'Bullet Cluster', label:'Bullet Cluster', type:'colliding galaxy clusters · dark matter made visible', group:'cosmic', sortKey:3.9e9,
    fact:'Two clusters collided at 4,500 km/s. Their galaxies and invisible dark matter (blue, mapped by gravitational lensing) sailed through; their hot gas (pink, seen in X-rays) crashed and lagged behind.',
    pos, rad:3e6, R0:facingEarth(pos, [0, 0, 1], 0), prog:program(VS_RECT, FS_BULLET), minZoom:0.1, pxMin:6, farColor:[1, 0.6, 0.85], farLum:0.8, labelRange:2e10, aka:'1e 0657-56 dark matter',
    distEarth:'3.9 billion ly', views:[{d:[0, 0.1, 1], k:2, hold:9, drift:0.02}, {d:[0.3, 0.8, 0.5], k:1.6, hold:8, drift:0.03}],
    particles:[{ps, prog:'ptBasic', mode:0, sb:0.4, size:1.3, cap:0.6}],
    readout:() => 'the strongest direct evidence that dark matter is real\nits gas is 100 million °C' });
})();
const jades = addGalaxy({ key:'jadesz14', name:'JADES-GS-z14-0', label:'JADES-GS-z14-0', type:'one of the most distant galaxies ever confirmed', group:'cosmic', sortKey:3.3e10,
  fact:'Seen by JWST as it was just 290 million years after the Big Bang. Already bright and surprisingly large, it is one of the most distant galaxies ever confirmed.',
  pos:radec(hms(3,32,19.9), dms(-27,51,20), 3.3e10), rad:1600, incl:40, g:{ arms:0, bulge:0.4, dust:0.2, H:0.05, sf:2, irr:1, Rd:0.3, seed:91 },
  farColor:[0.7, 0.8, 1], farLum:0.9, labelRange:9e10, distEarth:'light left it 13.5 billion years ago · now ~33 billion ly', atlas:true,
  readout:() => 'redshift 14.3: its light is stretched 15 times\nfrom ultraviolet into the infrared by the expanding universe' });

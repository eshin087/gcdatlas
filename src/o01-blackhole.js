
// ================================================================ black holes: Schwarzschild null geodesics (units r_s = 1), thin disk with Doppler beaming + gravitational redshift
// uP0: disk inner edge, outer edge (r_s), temperature scale, brightness   uP1: x jet power, y disk thickness look, z tint (0 white-hot, 1 orange)
// uP2: a bright companion star far behind (world direction from the hole, angular radius; w = 0 for none): its light is bent like the rest of the sky
const FS_BLACKHOLE = COMMON + `
void disk(vec3 q, float r, vec3 dir, inout vec3 col, inout float T){
  float per = 7.;
  float t1 = mod(uTime, per), t2 = mod(uTime + per*.5, per);
  float wA = 1. - abs(1. - 2.*t1/per);
  float om = 1.5*pow(r/3., -1.5);
  float a1 = om*t1, a2 = om*t2;
  vec2 r1 = mat2(cos(a1), -sin(a1), sin(a1), cos(a1))*q.xz;
  vec2 r2 = mat2(cos(a2), -sin(a2), sin(a2), cos(a2))*q.xz;
  float n = mix(fbm3(vec3(r2*1.1, r*0.35 + 9.7)), fbm3(vec3(r1*1.1, r*0.35 + 3.1)), wA);
  n = pow(n, 1.7)*1.9;
  float rings = 0.72 + 0.28*sin(r*5.3 + n*3.);
  float rin = uP0.x, rout = uP0.y;
  float x = rin/r;
  float tp = pow(x, .75)*pow(max(1. - sqrt(x), 0.), .25)/0.488;
  vec3 u = normalize(vec3(-q.z, 0., q.x));
  float beta = min(sqrt(0.5/(r - 1.)), 0.95);
  float gam = inversesqrt(1. - beta*beta);
  float dop = 1./(gam*(1. - beta*dot(u, -normalize(dir))));
  float g = dop*sqrt(1. - 1./r);
  float dens = smoothstep(rin, rin + 0.5, r)*smoothstep(rout, rout*0.6, r)*(0.35 + 0.9*n)*rings;
  float a = clamp(dens*1.1, 0., 0.96);
  vec3 em = blackbody(7000.*uP0.z*tp*g)*pow(tp, 2.2)*pow(g, 2.6)*3.4*(0.45 + n)*uP0.w;
  em = mix(em, em*vec3(1.15, 0.72, 0.4), uP1.z);
  col += T*a*em; T *= 1. - a;
}
void main(){
  vec3 rd = rayDir();
  const float RB = 20.;
  vec3 o = uCamLocal*RB, d = rd*uRot;
  vec2 hit = sphIsect(o, d, vec3(0.), RB);
  if(hit.y < 0.) discard;
  vec3 p = o + d*max(hit.x, 0.), v = d;
  vec3 hv = cross(p, v); float h2 = dot(hv, hv);
  vec3 col = vec3(0.), jc = vec3(0.); float T = 1.; bool captured = false;
  int N = int(mix(110., 220., uLod));
  float rin = uP0.x, rout = uP0.y;
  for(int i=0;i<260;i++){
    if(i >= N + 40) break;
    float r = length(p);
    if(r < 1.) { captured = true; break; }
    if(r > RB + 0.5 && dot(p, v) > 0.) break;
    float dt = clamp(0.085*r, 0.02, 1.1);
    vec3 acc = -1.5*h2*p/pow(r, 5.);
    vec3 pn = p + v*dt + 0.5*acc*dt*dt;
    vec3 accn = -1.5*h2*pn/pow(length(pn), 5.);
    vec3 vn = v + 0.5*(acc + accn)*dt;
    if(p.y*pn.y < 0.){
      float f = p.y/(p.y - pn.y);
      vec3 q = mix(p, pn, f); float rq = length(q.xz);
      if(rq > rin && rq < rout) disk(q, rq, mix(v, vn, f), col, T);
    }
    // relativistic jets along the spin axis (launched from just outside the horizon)
    if(uP1.x > 0.){ float ay = abs(pn.y); float w = 0.8 + 0.12*ay; float rr = length(pn.xz); jc += T*vec3(0.62, 0.72, 1.)*exp(-rr*rr/(w*w))*smoothstep(2., 5., ay)*exp(-ay/60.)*uP1.x*dt*0.05; }
    p = pn; v = vn;
    if(T < 0.01) break;
  }
  float b = length(cross(o, d));
  float w = smoothstep(11., 19.5, b);
  vec3 bg = vec3(0.);
  if(!captured && T > 0.01){
    vec3 dv = normalize(mix(uRot*normalize(v), rd, w));
    bg = starfield(dv);
    // (the star itself is 0.0033 rad across from the hole; uP2.w is its glow, as stars are drawn everywhere else, so its bent image spans a character)
    if(uP2.w > 0.){ float a = sqrt(max(2.*(1. - dot(dv, uP2.xyz)), 0.)); bg += vec3(1., 0.9, 0.74)*(1.8*exp(-pow(a/(uP2.w*0.3), 2.)) + 0.55*exp(-pow(a/uP2.w, 2.))); }
  }
  // the jets are in front of the hole, but only faintly where they cross its shadow, so the shadow stays black
  col += jc*(captured ? 0.12 : 1.);
  // photon ring: light that orbited the hole piles up in a razor-thin ring at the shadow's edge
  float pr = exp(-pow((b - 2.598)/0.035, 2.))*(length(o) > 3. ? 1. : 0.);
  col += T*vec3(1., 0.85, 0.6)*pr*0.35*uP0.w;
  outCol(col + T*(1. - w)*bg, 1. - T*w);
}`;
P.blackhole = program(VS_RECT, FS_BLACKHOLE);
// r_s for a mass in solar masses, in light-years
const schwarzschild = m => 2.953*m*KM;
function bhReadout(o, mass, name){
  return () => {
    const r = orbit.lock === o.index ? V.len(o.rel)/o.rad*20 : 99;
    if (r < 8){ const f = Math.sqrt(Math.max(1 - 1/r, 0)); return `you are ${r.toFixed(1)} r_s from the event horizon\nyour clock runs at ${(f*100).toFixed(0)}% of Earth's · one hour here = ${(1/f).toFixed(2)} hours there`; }
    return name;
  };
}

// ---------------------------------------------------------------- Sagittarius A*
const sgra = (() => {
  const M = 4.3e6, rs = schwarzschild(M), RB = 20;
  const o = addObj({ key:'sgra', name:'Sagittarius A*', label:'Sgr A*', type:'supermassive black hole · 4.3 million Suns · heart of the Milky Way', group:'galaxies', sortKey:26670,
    fact:'Its event horizon is 17 times wider than the Sun. Light skimming past bends into a ring; the approaching side of the disk glows brighter and bluer. Its real feeding disk is dimmer than shown.',
    pos:SGRA_POS, rad:rs*RB, solid:0.13, R0:facingEarth(SGRA_POS, V.norm([0.5, 0.86, 0]), 20), prog:P.blackhole, minZoom:0.053, pxMin:6, farColor:[1, 0.7, 0.4], farLum:0.2, labelRange:600,
    aka:'sgr a* black hole galactic centre center',
    setU(pr){ gl.uniform4f(pr.u.uP0, 3, 15, 1, 1); gl.uniform4f(pr.u.uP1, 0, 0, 0, 0); },
    views:[
      {d:[0, 0.2, 1], k:1.45, hold:8, drift:0.035},
      {d:[0.05, 0.075, 1], k:0.23, hold:9, drift:0.012},
      {d:[0.35, 0.75, 0.55], k:2.5, hold:6, drift:-0.05},
      {d:[0, 0.2, 1], k:0.34, off:[0, 0.06, 0], hold:10, drift:0.008},
      {d:[-1, 0.04, 0.25], k:1.25, hold:7, drift:0.03},
    ],
  });
  o.readout = bhReadout(o, M, 'event horizon 25 million km across, 17 Suns wide\ninner disk edge 3 r_s, orbiting at half the speed of light');
  return o;
})();
// the S-stars: real orbit of S2 (GRAVITY), with a swarm of others on random Keplerian orbits
const PB_SSTAR = `void body(out vec3 p, out float br, out vec3 col){
  float a = aP.x, e = aP.y, P = aP.z, M = aP.w + 6.2831853*uQ0.x/P;
  float E = M + e*sin(M); for(int k=0;k<5;k++) E = E - (E - e*sin(E) - M)/(1. - e*cos(E));
  vec2 q = vec2(a*(cos(E) - e), a*sqrt(1. - e*e)*sin(E));
  p = uM*vec3(q.x, 0., -q.y);
  br = 1.; col = aC.rgb;
}`;
P.ptSStar = program(particleVS(PB_SSTAR), FS_POINT);
const sstars = (() => {
  const RAD = 3000, rot = [];
  const mk = (i, o, w) => M3.mul(M3.mul(M3.rotY(o*DEG), M3.rotX(i*DEG)), M3.rotY(w*DEG));
  const defs = [{ a:1031, e:0.8847, P:16.05, i:134.7, O:228.2, w:66.3, c:[0.7, 0.8, 1], ph:0.2 }];
  for (let k=0;k<28;k++){ const a = 300 + 3000*Math.pow(rnd(), 1.4); defs.push({ a, e:Math.sqrt(rnd())*0.95, P:16.05*Math.pow(a/1031, 1.5), i:rnd()*180, O:rnd()*360, w:rnd()*360, c:rnd() < 0.8 ? [0.65, 0.75, 1] : [1, 0.75, 0.5], ph:rnd()*6.28 }); }
  const systems = defs.map(s => { const ps = makePS(1); ps.a.set([s.a/RAD, s.e, s.P, s.ph], 0); ps.c.set([...s.c, 0], 0); ps.upload('ac'); return { ps, m:mk(s.i, s.O, s.w) }; });
  // S2's orbit traced as a thin ellipse
  const s2 = defs[0], SEG = 160, tr = makePS(SEG*2); let k = 0;
  for (let j=0;j<SEG;j++) for (const e of [j, j + 1]){ const E = e/SEG*Math.PI*2, q = [s2.a*(Math.cos(E) - s2.e)/RAD, s2.a*Math.sqrt(1 - s2.e*s2.e)*Math.sin(E)/RAD]; const p = M3.apply(systems[0].m, [q[0], 0, -q[1]]); tr.a.set([p[0], p[1], p[2], 1], k*4); tr.c.set([0.45, 0.55, 0.9, 0], k*4); k++; }
  tr.upload('ac');
  const clock = () => sstars.t*0.8;   // 1 s = 0.8 years
  const o = addObj({ key:'sstars', name:'S2 and the S-stars', label:'S-stars', type:'stars orbiting the black hole · proof it exists', group:'galaxies', sortKey:26670.1,
    fact:'Tracking these stars for 30 years proved Sgr A* is a black hole (Nobel Prize 2020). S2 swings within 120 AU of it every 16 years, reaching 2.5% of light speed.',
    parent:sgra, offset:[0, 0, 0], rad:RAD*AU_LY, R0:facingEarth(SGRA_POS, [0, 1, 0]), minZoom:0.02, pxMin:3, noImpostor:true, labelRange:40, labelMin:3e-3,
    views:[{d:[0.15, 1, 0.25], k:1.1, hold:10, drift:0.02}, {d:[0.9, 0.3, 0.3], k:0.5, hold:8, drift:0.03}],
    particleVis:rpx => smooth(4, 16, rpx),
    particles:[
      ...systems.map(s => ({ ps:s.ps, prog:'ptSStar', mode:3, sb:1.1, size:2.2, mat:() => s.m, q0:() => [clock(), 0, 0, 0] })),
      { ps:tr, prog:'lnBasic', lines:true, mode:3, sb:0.18, size:1, vis:() => smooth(8*AU_LY, 60*AU_LY, orbit.dist) },
    ],
    readout:() => { const ph = ((clock() + 0.2/6.283*16.05)/16.05) % 1; return `S2: 16-year orbit shown in 20 seconds (year ${(ph*16.05).toFixed(1)})\nat closest approach 7,650 km/s; its light is visibly reddened by gravity`; } });
  return o;
})();
// the Galactic Centre: nuclear star cluster, the ionised mini-spiral, the circumnuclear disk, the Radio Arc and the Central Molecular Zone
const FS_GALCENTRE = COMMON + `
void main(){
  vec3 o, d; localRay(o, d);
  vec2 h = sphIsect(o, d, vec3(0.), 1.);
  if(h.y < 0.) discard;
  vec3 col = vec3(0.); float T = 1.;
  int N = int(mix(40., 72., uLod));
  float t0 = max(h.x, 0.), dt = (h.y - t0)/float(N), jit = hash12(gl_FragCoord.xy)*dt;
  for(int i=0;i<72;i++){
    if(i >= N) break;
    vec3 p = o + d*(t0 + jit + dt*float(i));
    float rho = length(p.xz), ay = abs(p.y);
    // Central Molecular Zone: a lumpy bar of dense, dusty gas ~600 ly long (slightly offset, like the real one)
    vec3 q = vec3(p.x*0.96 - p.z*0.28, p.y, p.x*0.28 + p.z*0.96) - vec3(0., 0., 0.12);
    float cmz = exp(-(q.z*q.z/0.3 + q.x*q.x/0.014 + p.y*p.y/0.0025))*smoothstep(0.35, 0.7, fbm3(p*vec3(9., 20., 9.) + 3.));
    // Sgr B2: the most massive molecular cloud in the galaxy
    vec3 b2 = p - vec3(0.05, -0.01, 0.74); float sgrb2 = exp(-dot(b2, b2)/0.004);
    // circumnuclear disk: a clumpy ring 5-20 ly around Sgr A*
    float cnd = exp(-pow((rho - 0.025)/0.012, 2.) - ay*ay/0.00003)*smoothstep(0.4, 0.7, fbm3(p*120.));
    // the mini-spiral of ionised gas streaming inward
    float ang = atan(p.z, p.x), ms = 0.;
    for(int k=0;k<3;k++){ float s = log(max(rho, 1e-4)/0.012)*3.2 + float(k)*2.1; ms += exp(-pow(sin((ang - s)*0.5), 2.)*30.); }
    ms *= exp(-rho/0.009)*exp(-ay*ay/0.00002)*smoothstep(0.0005, 0.002, rho);
    // the Radio Arc: magnetised filaments standing perpendicular to the plane
    float arcx = p.z - 0.21 - 0.03*sin(p.y*20.);
    float arc = exp(-arcx*arcx/0.00012)*exp(-ay/0.35)*(0.4 + 0.8*noise(vec3(p.y*40., p.x*30., 1.)))*smoothstep(0.2, 0., abs(p.x));
    float threads = pow(1. - abs(noise(vec3(p.x*70., p.z*70., 3.))*2. - 1.), 30.)*exp(-ay/0.25)*exp(-rho/0.5)*0.4;
    vec3 em = vec3(1., 0.45, 0.3)*cmz*0.35 + vec3(1., 0.55, 0.35)*sgrb2*0.5 + vec3(0.95, 0.4, 0.3)*cnd*1.2 + vec3(1., 0.42, 0.6)*ms*3.5 + vec3(0.75, 0.45, 1.)*(arc + threads)*0.8;
    col += T*em*dt*12.;
    T *= exp(-(cmz*30. + sgrb2*60. + cnd*10.)*dt);
  }
  // Arches and Quintuplet: the densest young clusters in the galaxy
  col += vec3(0.7, 0.8, 1.)*(blob(o, d, vec3(-0.05, 0.02, 0.14), 0.012)*6. + blob(o, d, vec3(0.1, -0.01, 0.19), 0.014)*5.);
  outCol(col, (1. - T)*0.9);
}`;
const galCentre = (() => {
  const RAD = 400, n = Math.round(12000*QUALITY), ps = makePS(n);
  for (let i=0;i<n;i++){ const d = randDir(), r = 0.004 + 0.3*Math.pow(rnd(), 2.6), c = blackbodyJS(3400 + 2400*rnd()); ps.a.set([d[0]*r, d[1]*r*0.8, d[2]*r, 0.6 + 0.8*rnd()], i*4); ps.c.set([c[0], c[1], c[2], 0], i*4); }
  ps.upload('ac');
  return addObj({ key:'galcentre', name:'the Galactic Centre', label:'Galactic Centre', type:'the crowded core of the Milky Way', group:'galaxies', sortKey:26669,
    fact:'Millions of stars packed within a few light-years of Sgr A*, the magnetised threads of the Radio Arc, and the Central Molecular Zone, the densest gas in the galaxy.',
    parent:sgra, offset:[0, 0, 0], rad:RAD, R0:milkyway.R0, prog:program(VS_RECT, FS_GALCENTRE), minZoom:0.004, pxMin:5, noImpostor:true, labelRange:3e4, labelMin:30,
    visFn:rpx => smooth(5, 13, rpx)*(0.08 + 0.92*smooth(0.02, 2, orbit.dist)),
    aka:'cmz radio arc sgr b2 arches quintuplet',
    views:[{d:[0.35, 0.55, 1], k:1.9, hold:9, drift:0.02}, {d:[0.2, 0.18, 1], k:0.2, hold:8, drift:0.025}, {d:[0.1, 1, 0.3], k:0.045, hold:8, drift:0.03}],
    particleVis:rpx => smooth(4, 16, rpx)*(0.1 + 0.9*smooth(0.01, 1, orbit.dist)),
    particles:[{ps, prog:'ptBasic', mode:0, sb:0.5, size:1.4, cap:0.8}],
    readout:() => 'star density here is a million times the Sun\'s neighbourhood\nthe night sky would hold thousands of stars brighter than Sirius' });
})();

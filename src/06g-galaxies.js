
// ================================================================ galaxies: generic galaxy volume shader, the Milky Way (real arm layout), Magellanic Clouds, Local Group and notable galaxies
// uP0: x arms (0 none), y tan(pitch), z bulge weight, w dust
// uP1: x bar half-length, y disk scale height, z star formation, w elliptical flattening (>0 = elliptical)
// uP2: x irregularity, y seed, z disk scale length, w dust ring radius (0 none)
// uP3: x Orion-spur radius (0 none), y minor-arm weakening, z bar angle, w arm reference radius
const FS_GALAXYG = COMMON + `
float armPat(float psi, float m){ return pow(0.5 + 0.5*cos(m*psi), 3.); }
void main(){
  vec3 o, d; localRay(o, d);
  vec2 h = sphIsect(o, d, vec3(0.), 1.);
  if(h.y < 0.) discard;
  float m = uP0.x, tp = uP0.y, bw = uP0.z, dustK = uP0.w, bar = uP1.x, H = uP1.y, sf = uP1.z, ell = uP1.w, irr = uP2.x, sd = uP2.y, Rd = uP2.z, ringR = uP2.w;
  vec3 col = vec3(0.); float T = 1.;
  vec3 warm = vec3(1., 0.8, 0.56), old = vec3(0.95, 0.86, 0.72), young = vec3(0.58, 0.7, 1.), pink = vec3(1., 0.38, 0.6);
  if(ell > 0.){
    float t0 = max(h.x, 0.), dt = (h.y - t0)/26.; float jit = hash12(gl_FragCoord.xy)*dt;
    for(int i=0;i<26;i++){
      vec3 p = o + d*(t0 + jit + dt*float(i));
      float r = length(p*vec3(1., 1./(1. - ell), 1.));
      float I = exp(-7.67*(pow(max(r, 1e-4)/Rd, 0.25) - 1.))*0.0016;
      col += warm*I*dt*40.;
    }
    col += warm*(pblob(o, d, vec3(0.), 0.004)*40. + blob(o, d, vec3(0.), 0.02)*1.2);
    outCol(col, 0.);
    return;
  }
  float Hs = H*7.;
  float ta = max(h.x, 0.), tb = h.y;
  if(abs(d.y) > 1e-4){ float s0 = (-Hs - o.y)/d.y, s1 = (Hs - o.y)/d.y; ta = max(ta, min(s0, s1)); tb = min(tb, max(s0, s1)); }
  else if(abs(o.y) > Hs) tb = ta;
  if(tb > ta){
    int N = int(mix(26., 48., uLod)); float dt = (tb - ta)/float(N);
    float jit = hash12(gl_FragCoord.xy + sd)*dt;
    float ca = cos(uP3.z), sa = sin(uP3.z);
    for(int i=0;i<48;i++){
      if(i >= N) break;
      vec3 p = o + d*(ta + jit + dt*float(i));
      float rho = length(p.xz), pa = atan(p.z, p.x), ay = abs(p.y);
      float psi = pa + log(max(rho, 1e-3)/uP3.w)/tp;
      float a = m > 0.5 ? armPat(psi, m) : 0.;
      if(uP3.y > 0.){ float k = floor(psi*m/6.2832 + 0.5); a *= 1. - uP3.y*(1. - mod(abs(k), 2.)); }
      if(uP3.x > 0.){ float sr = uP3.x*exp(-pa*0.17); a = max(a, 0.75*exp(-pow((rho - sr)/0.012, 2.))*smoothstep(-0.45, -0.25, pa)*smoothstep(0.35, 0.15, pa)); }
      float clump = fbm3(p*vec3(9., 30., 9.) + sd);
      a = mix(a, smoothstep(0.35, 0.75, clump), irr);
      a *= smoothstep(bar*0.6, bar*1.1, rho);
      float disk = exp(-rho/Rd)*exp(-ay/H)*smoothstep(1., 0.55, rho);
      vec2 q = vec2(p.x*ca + p.z*sa, -p.x*sa + p.z*ca);
      float barD = bar > 0. ? exp(-(q.x*q.x/(bar*bar) + q.y*q.y/(bar*bar*0.12)))*exp(-ay/(H*2.2 + bar*0.12)) : 0.;
      vec3 em = warm*barD*0.9 + mix(old, young, a)*disk*(0.12 + 1.7*a);
      float knots = smoothstep(0.6, 0.78, noise(p*vec3(52., 70., 52.) + sd));
      em += pink*disk*a*knots*sf*3.;
      float lane = m > 0.5 ? armPat(psi + 0.2, m)*(0.4 + 1.2*fbm3(p*40. + sd)) : fbm3(p*18. + sd)*0.6;
      float dust = lane*exp(-ay/(H*0.45))*exp(-rho/(Rd*1.6))*smoothstep(bar*0.4, bar*0.9 + 0.03, rho);
      if(ringR > 0.) dust += exp(-pow((rho - ringR)/(ringR*0.08), 2.))*exp(-ay/(H*0.5))*(0.6 + 0.8*fbm3(p*30.))*3.;
      col += T*em*dt*uP4.x;
      T *= exp(-dust*dustK*dt*70.);
    }
  }
  // the bulge fills a volume far thicker than the disk; light from behind the disk plane is dimmed by its dust
  float Tdisk = T;
  if(bw > 0.){
    float Rb = 0.03 + 0.035*bw;
    vec2 hb = sphIsect(o, d, vec3(0.), min(Rb*6., 1.));
    if(hb.y > 0.){
      float tb0 = max(hb.x, 0.), dtb = (hb.y - tb0)/20., tmid = abs(d.y) > 1e-4 ? -o.y/d.y : 1e9;
      vec3 acc = vec3(0.);
      for(int i=0;i<20;i++){ float t = tb0 + dtb*(float(i) + 0.5); vec3 p = o + d*t; float r = length(p*vec3(1., 1.25, 1.));
        acc += warm*exp(-r/Rb*2.2)*(t > tmid ? Tdisk : 1.); }
      col += acc*dtb*bw*3./Rb;
    }
  }
  col += warm*(pblob(o, d, vec3(0.), 0.003)*30.*bw + blob(o, d, vec3(0.), 0.015)*0.8*bw);
  outCol(col, (1. - T)*0.85);
}`;
P.galaxy = program(VS_RECT, FS_GALAXYG);
// g: {arms, pitch (deg), bulge, dust, bar, H, sf, ell, irr, seed, Rd, ring, spur, minor, barAng, armRef}
function galaxyU(g){
  return pr => {
    gl.uniform4f(pr.u.uP0, g.arms ?? 2, Math.tan((g.pitch ?? 14)*DEG), g.bulge ?? 0.6, g.dust ?? 1);
    gl.uniform4f(pr.u.uP1, g.bar ?? 0, g.H ?? 0.012, g.sf ?? 0.6, g.ell ?? 0);
    gl.uniform4f(pr.u.uP2, g.irr ?? 0, g.seed ?? 1, g.Rd ?? 0.3, g.ring ?? 0);
    gl.uniform4f(pr.u.uP3, g.spur ?? 0, g.minor ?? 0, (g.barAng ?? 20)*DEG, g.armRef ?? 0.3);
    gl.uniform4f(pr.u.uP4, (g.gain ?? 1)*0.32/(g.H ?? 0.012), 0, 0, 0);
  };
}
// star particles that follow the same structure as the volume model (arms, bar, bulge, clumps)
function galaxyStars(g, n){
  const ps = makePS(n), tp = Math.tan((g.pitch ?? 14)*DEG), m = g.arms ?? 2, Rd = g.Rd ?? 0.3, bar = g.bar ?? 0, ref = g.armRef ?? 0.3, ba = (g.barAng ?? 20)*DEG;
  const clumps = Array.from({length:40}, () => { const r = 0.1 + 0.6*Math.sqrt(rnd()), a = rnd()*6.283; return [r*Math.cos(a), r*Math.sin(a)]; });
  let k = 0, guard = 0;
  while (k < n && guard++ < n*20){
    const u = rnd(); let p, c, w = 1;
    if (g.ell){ const d = randDir(), r = Rd*0.4*Math.pow(-Math.log(1 - rnd()*0.995), 1.6); p = [d[0]*r, d[1]*r*(1 - g.ell), d[2]*r]; c = blackbodyJS(3800 + 1400*rnd()); w = 0.8; }
    else if (u < (g.bulge ?? 0.6)*0.18){ const d = randDir(), r = 0.03*(0.5 + (g.bulge ?? 0.6))*(-Math.log(1 - rnd()*0.99)); p = [d[0]*r, d[1]*r*0.7, d[2]*r]; c = blackbodyJS(3600 + 1500*rnd()); w = 0.9; }
    else if (bar && u < 0.3){ const x = rndn()*bar*0.5, z = rndn()*bar*0.13; p = [x*Math.cos(ba) - z*Math.sin(ba), rndn()*0.01, x*Math.sin(ba) + z*Math.cos(ba)]; c = blackbodyJS(4000 + 1200*rnd()); }
    else {
      const rho = -Rd*Math.log(1 - rnd()*0.96); if (rho > 0.95 || rho < bar*0.8) continue;
      let pa = rnd()*6.283, young = false;
      if (m > 0 && rnd() < 0.7 - 0.5*(g.irr ?? 0)){ pa = Math.floor(rnd()*m)*2*Math.PI/m - Math.log(rho/ref)/tp + rndn()*0.12; young = rnd() < 0.6; }
      else if ((g.irr ?? 0) > 0 && rnd() < g.irr){ const cl = clumps[Math.floor(rnd()*clumps.length)]; p = [cl[0] + rndn()*0.04, rndn()*0.01, cl[1] + rndn()*0.04]; young = true; }
      if (!p) p = [rho*Math.cos(pa), rndn()*(g.H ?? 0.012)*0.8, rho*Math.sin(pa)];
      const q = rnd();
      c = young ? (rnd() < 0.15*(g.sf ?? 0.6) ? [1, 0.42, 0.65] : [0.55 + 0.2*q, 0.68 + 0.15*q, 1]) : [1, 0.8 + 0.1*q, 0.6 + 0.2*q];
      w = young ? 1.3 : 0.8;
    }
    ps.a.set([p[0], p[1], p[2], w], k*4); ps.c.set([c[0], c[1], c[2], 0], k*4); k++;
  }
  ps.count = k; ps.upload('ac');
  return ps;
}
function addGalaxy(def){
  const g = def.g || {};
  let o = null;
  o = addObj(Object.assign({ layer:2, prog:P.galaxy, group:'galaxies', pxMin:7, visFn(rpx){ return smooth(7, 18, rpx)*(1 - 0.55*milkyway.inside); }, minZoom:0.05, farLum:0.8, farColor:g.ell ? [1, 0.85, 0.65] : [0.85, 0.85, 1],
    labelRange:def.rad*3000, views:[{dirFn:() => V.norm(V.mul(o.pos, -1)), k:2.3, hold:8, drift:0.03}, {d:[0.2, 0.75, 0.62], k:1.6, hold:8, drift:0.03}, {d:[0.9, 0.2, 0.3], k:1.3, hold:7, drift:0.03}] }, def));
  o.setU = def.setU || galaxyU(g);
  if (!def.noStars) o.particles.push({ ps:galaxyStars(g, Math.round((def.stars || 3500)*QUALITY)), prog:'ptBasic', mode:0, sb:(g.ell ? 0.2 : 0.3)*(g.starGain ?? 1), size:1.3, cap:0.7 });
  // now and then a star in the galaxy explodes: a supernova briefly rivals the whole galaxy
  if (!def.noSN){
    const sn = makePS(1), sp = makeSpikes([{ p:[0, 0, 0], w:1, c:[0.9, 0.93, 1] }]); sn.c.set([0.9, 0.93, 1, 0], 0); sn.upload('c');
    let next = 6 + rnd()*30, age = 99, amp = 0;
    const prev = o.update;
    o.update = function(dt){ prev && prev.call(this, dt);
      next -= dt; age += dt;
      if (next < 0){ next = 25 + rnd()*40; age = 0; const r = (g.Rd ?? 0.3)*(0.3 + 1.5*rnd()), a = rnd()*6.283, p = g.ell ? V.mul(randDir(), r*0.6) : [r*Math.cos(a), 0, r*Math.sin(a)];
        sn.a.set([p[0], p[1], p[2], 1], 0); sn.upload('a'); for (let v=0; v<8; v++) sp.a.set([p[0], p[1], p[2], 1], v*4); sp.upload('a'); }
      amp = age < 0.4 ? age/0.4 : Math.exp(-(age - 0.4)/2.2);
    };
    o.particles.push({ ps:sn, prog:'ptBasic', mode:3, sb:1, size:3, show:() => amp > 0.02, q0:() => [0, 0, 0, 0], vis:() => amp*1.6 });
    o.particles.push({ ps:sp, prog:'spike', lines:true, mode:1, sb:3, size:1, len:0.05, show:() => amp > 0.05, q0:() => [amp*1.5, 0, 0, 0] });
  }
  if (def.incl != null) o.R0 = facingEarth(o.pos, [Math.sin(def.incl*DEG), Math.cos(def.incl*DEG), 0], def.pa || 0);
  o.rot = o.R0;
  return o;
}

// ---------------------------------------------------------------- the Milky Way
const SGRA_POS = radec(hms(17,45,40.04), dms(-29,0,28.2), 26670);
const milkyway = (() => {
  const RAD = 90000;
  const R0 = frameY([0, 0, 1], V.mul(SGRA_POS, -1));
  const g = { arms:4, pitch:12, bulge:0.9, dust:1.1, bar:0.18, H:0.011, sf:0.7, Rd:0.105, spur:26670/RAD, minor:0.45, barAng:27, armRef:23150/RAD, seed:3, gain:0.35 };
  const L = v => V.add(SGRA_POS, M3.apply(R0, V.mul(v, RAD)));   // local (units of RAD) -> world
  // stars: arms, disk, bar, bulge; globular clusters in the halo
  const nA = Math.round(26000*QUALITY), nB = Math.round(7000*QUALITY), nH = Math.round(1500*QUALITY), nG = 157;
  const ps = makePS(nA + nB + nH + nG); let k = 0;
  const tp = Math.tan(12*DEG), armRef = 23150/RAD;
  const put = (p, c, w) => { ps.a.set([p[0], p[1], p[2], w], k*4); ps.c.set([c[0], c[1], c[2], 0], k*4); k++; };
  while (k < nA){
    const rho = 0.06 + 0.55*Math.pow(rnd(), 1.3);
    if (rnd() > Math.exp(-rho/0.16)*1.4) continue;
    let pa;
    const u = rnd();
    if (u < 0.62){ const kk = Math.floor(rnd()*4), weak = kk % 2 === 0 && rnd() < 0.45; if (weak) continue; pa = kk*Math.PI/2 - Math.log(rho/armRef)/tp + rndn()*0.09; }
    else if (u < 0.66){ pa = -0.45 + 0.8*rnd(); const sr = 26670/RAD*Math.exp(-pa*0.17); if (Math.abs(rho - sr) > 0.03) continue; }
    else pa = rnd()*6.283;
    if (rho < 0.12 && u < 0.66) continue;
    const young = u < 0.66 && rnd() < 0.55, q = rnd();
    const c = young ? (rnd() < 0.12 ? [1, 0.45, 0.65] : [0.55 + 0.2*q, 0.68 + 0.15*q, 1]) : [1, 0.78 + 0.12*q, 0.55 + 0.2*q];
    put([rho*Math.cos(pa), rndn()*0.006*(young ? 0.6 : 1.4), rho*Math.sin(pa)], c, young ? 1.2 : 0.8);
  }
  for (let i=0;i<nB;i++){
    const inBar = rnd() < 0.6;
    let p;
    if (inBar){ const x = rndn()*0.09, y = rndn()*0.018, z = rndn()*0.03, a = 27*DEG; p = [x*Math.cos(a) - z*Math.sin(a), y, x*Math.sin(a) + z*Math.cos(a)]; }
    else { const d = randDir(), r = -0.03*Math.log(1 - rnd()*0.98); p = [d[0]*r, d[1]*r*0.7, d[2]*r]; }
    const c = blackbodyJS(3600 + 1600*rnd()); put(p, c, 0.9);
  }
  for (let i=0;i<nH;i++){ const d = randDir(), r = 0.05 + 0.6*Math.pow(rnd(), 1.6), c = blackbodyJS(3900 + 1500*rnd()); put([d[0]*r, d[1]*r*0.8, d[2]*r], V.mul(c, 0.6), 0.6); }
  const nDisk = k;
  for (let i=0;i<nG;i++){ const d = randDir(), r = 0.02 + 0.45*Math.pow(rnd(), 2.2), c = blackbodyJS(4600 + 900*rnd()); put([d[0]*r, d[1]*r, d[2]*r], c, 2.5); }
  ps.count = nDisk; ps.upload('ac');
  const glob = makePS(nG); glob.a.set(ps.a.subarray(nDisk*4, (nDisk + nG)*4)); glob.c.set(ps.c.subarray(nDisk*4, (nDisk + nG)*4)); glob.upload('ac');
  const o = addObj({ key:'milkyway', name:'the Milky Way', label:'Milky Way', type:'barred spiral galaxy · our home, 100,000 light-years across', group:'galaxies', sortKey:0, layer:2,
    fact:'About 200 billion stars. Arms, bar and our place in the Orion Spur follow radio and Gaia maps; nobody has ever seen it from outside.',
    pos:SGRA_POS, rad:RAD, R0, prog:P.galaxy, minZoom:0.08, pxMin:6, farColor:[1, 0.92, 0.8], farLum:1.1, labelRange:2e7, labelMin:4e4, distEarth:'26,670 ly to its centre', aka:'galaxy home',
    setU:galaxyU(g), inside:1,
    visFn(rpx){ return smooth(6, 16, rpx)*(1 - this.inside); },
    particleVis(rpx){ return smooth(5, 14, rpx)*(1 - this.inside*0.97); },
    update(){
      const c = M3.applyT(this.R0, V.mul(this.rel, -1));   // camera in galaxy frame (ly)
      const Rc = Math.hypot(c[0], c[2]), zc = Math.abs(c[1]);
      this.inside = (1 - smooth(1800, 9000, zc))*(1 - smooth(52000, 76000, Rc));
      this.camR = Rc; this.camZ = zc;
    },
    views:[
      {d:[0.28, 1, 0.42], k:1.3, hold:10, drift:0.02},
      {d:[0.82, 0.42, 0.45], k:1.05, hold:9, drift:0.025},
      {d:[0.25, 0.05, 1], k:1.15, hold:8, drift:0.02},
      {d:[1, 0.62, 0.2], k:0.36, off:[26670/RAD, 0, 0], hold:9, drift:0.015},
    ],
    particles:[
      {ps, prog:'ptBasic', mode:0, sb:0.3, size:1.4, cap:0.7},
      {ps:glob, prog:'ptBasic', mode:1, sb:0.8, size:1.8},
    ],
    readout:() => 'the Sun circles the centre at 230 km/s\none lap, a "galactic year", takes about 230 million years' });
  o.L = L;
  return o;
})();
// labels for the structure of our galaxy (shown only when you look at the whole galaxy)
function addMarker(key, label, pos, near, far, extra = {}){
  return addObj(Object.assign({ key, name:label, label, type:'', layer:2, pos, rad:near/400, marker:true, noPick:true, noImpostor:true, atlas:false, labelRange:far, labelMin:near }, extra));
}
{
  const R = 90000, A = (rho, pa) => milkyway.L([rho*Math.cos(pa), 0, rho*Math.sin(pa)]), tp = Math.tan(12*DEG), ref = 23150/R;
  const armAt = (kk, rho) => A(rho, kk*Math.PI/2 - Math.log(rho/ref)/tp);
  addMarker('arm-perseus', 'Perseus Arm', armAt(1, 0.42), 1.2e4, 6e5);
  addMarker('arm-sagittarius', 'Sagittarius Arm', armAt(0, 0.31), 1.2e4, 6e5);
  addMarker('arm-scutum', 'Scutum-Centaurus Arm', armAt(3, 0.33), 1.2e4, 6e5);
  addMarker('arm-norma', 'Norma Arm', armAt(2, 0.28), 1.2e4, 6e5);
  addMarker('arm-outer', 'Outer Arm', armAt(2, 0.52), 1.2e4, 6e5);
  addMarker('orion-spur', 'Orion Spur', A(26670/R*Math.exp(0.3*0.17), -0.3), 6e3, 2.5e5);
  addMarker('mw-bar', 'central bar', A(0.1, 27*DEG + Math.PI), 1.2e4, 6e5);
}

// ---------------------------------------------------------------- Magellanic Clouds and the Local Group
const lmc = addGalaxy({ key:'lmc', name:'Large Magellanic Cloud', label:'LMC', type:'barred irregular galaxy · satellite of the Milky Way', sortKey:163000,
  fact:'A small galaxy orbiting ours, bright enough to see by eye from the southern hemisphere. Its Tarantula Nebula is the most active star factory in the Local Group.',
  pos:radec(hms(5,23,34), dms(-69,45,22), 163000), rad:16000, incl:35, pa:170, g:{ arms:1, pitch:20, bulge:0.25, dust:0.6, bar:0.28, H:0.02, sf:1.8, irr:0.65, seed:7, Rd:0.3, armRef:0.35, barAng:10 },
  farLum:0.9, aka:'magellanic', readout:() => '163,000 light-years away · 1/10 the Milky Way\'s mass\nhost of SN 1987A, the nearest supernova in 400 years' });
const smc = addGalaxy({ key:'smc', name:'Small Magellanic Cloud', label:'SMC', type:'dwarf irregular galaxy · satellite of the Milky Way', sortKey:200000,
  fact:'A dwarf galaxy being torn apart by the Large Magellanic Cloud and the Milky Way, trailing a bridge of gas and young stars behind it.',
  pos:radec(hms(0,52,44.8), dms(-72,49,43), 200000), rad:9000, incl:65, pa:45, g:{ arms:0, bulge:0.2, dust:0.4, bar:0.3, H:0.05, sf:1.2, irr:1, seed:13, Rd:0.3, barAng:40 },
  farLum:0.7, aka:'magellanic', readout:() => '200,000 light-years away · a few hundred million stars' });
const m33 = addGalaxy({ key:'m33', name:'Triangulum Galaxy', label:'M33', type:'spiral galaxy · third-largest in the Local Group', sortKey:2.73e6,
  fact:'A loose, flocculent spiral full of giant star-forming regions. On a dark night it is the most distant thing some people can see with the naked eye.',
  pos:radec(hms(1,33,50.9), dms(30,39,37), 2.73e6), rad:32000, incl:55, pa:23, g:{ arms:2, pitch:24, bulge:0.2, dust:0.6, H:0.012, sf:1.6, irr:0.35, seed:21, Rd:0.3 },
  aka:'m33 triangulum', readout:() => '2.73 million light-years · ~40 billion stars\nmay be a satellite of Andromeda' });
[['sgrdsph', 'Sagittarius Dwarf', hms(18,55,19.5), dms(-30,32,43), 70000, 8000], ['fornaxd', 'Fornax Dwarf', hms(2,39,59.3), dms(-34,26,57), 460000, 3000],
 ['sculptord', 'Sculptor Dwarf', hms(1,0,9.4), dms(-33,42,33), 290000, 1500], ['leoi', 'Leo I', hms(10,8,28.1), dms(12,18,23), 820000, 1300],
 ['dracod', 'Draco Dwarf', hms(17,20,12.4), dms(57,54,55), 260000, 1000], ['ngc6822', "Barnard's Galaxy", hms(19,44,56.6), dms(-14,47,21), 1.6e6, 4500],
 ['ic1613', 'IC 1613', hms(1,4,47.8), dms(2,7,4), 2.4e6, 5000], ['wlm', 'Wolf–Lundmark–Melotte', hms(0,1,58.1), dms(-15,27,39), 3e6, 4000]].forEach(([key, name, ra, dec, dist, r]) => {
  addGalaxy({ key, name, label:name, type:'dwarf galaxy · Local Group', pos:radec(ra, dec, dist), rad:r, incl:40, g:{ ell:0.3, Rd:0.25 }, farLum:0.35, atlas:false, labelRange:r*600, sortKey:dist,
    fact:'One of dozens of small galaxies orbiting the Milky Way or Andromeda.', readout:() => fmtDist(dist) + ' away' });
});
// ---------------------------------------------------------------- notable galaxies beyond the Local Group
addGalaxy({ key:'m81', name:"Bode's Galaxy", label:'M81', type:'grand-design spiral', sortKey:11.8e6, aka:'m81',
  fact:'A textbook spiral whose arms were stirred up by a close pass with its neighbour M82 about 300 million years ago.',
  pos:radec(hms(9,55,33.2), dms(69,3,55), 11.8e6), rad:48000, incl:59, pa:157, g:{ arms:2, pitch:14, bulge:1, dust:1, H:0.01, sf:0.7, Rd:0.24, seed:31 },
  readout:() => '11.8 million light-years · 250 billion stars' });
addGalaxy({ key:'m82', name:'Cigar Galaxy', label:'M82', type:'starburst galaxy', sortKey:11.4e6, aka:'m82',
  fact:'Forming stars ten times faster than the Milky Way. Supernova-driven winds blast red filaments of hydrogen out of both faces of the disk.',
  pos:radec(hms(9,55,52.4), dms(69,40,47), 11.4e6), rad:22000, incl:81, pa:65, g:{ arms:0, bulge:0.4, dust:2.2, H:0.02, sf:2.5, irr:0.8, Rd:0.22, seed:37 },
  readout:() => '11.4 million light-years · a starburst triggered by M81' });
addGalaxy({ key:'m101', name:'Pinwheel Galaxy', label:'M101', type:'face-on spiral', sortKey:20.9e6, aka:'m101',
  fact:'Nearly twice the width of the Milky Way, seen almost face-on, its lopsided arms studded with more than 3,000 star-forming regions.',
  pos:radec(hms(14,3,12.6), dms(54,20,57), 20.9e6), rad:85000, incl:18, pa:39, g:{ arms:3, pitch:22, bulge:0.35, dust:0.8, H:0.01, sf:1.4, irr:0.3, Rd:0.3, seed:41 },
  readout:() => '20.9 million light-years · 170,000 light-years across' });
addGalaxy({ key:'m104', name:'Sombrero Galaxy', label:'M104', type:'spiral seen nearly edge-on', sortKey:31.1e6, aka:'m104',
  fact:'A huge glowing bulge ringed by a dark lane of dust. It hosts about 2,000 globular clusters and a billion-solar-mass black hole.',
  pos:radec(hms(12,39,59.4), dms(-11,37,23), 31.1e6), rad:30000, incl:84, pa:90, g:{ arms:0, bulge:3, dust:2.4, H:0.012, sf:0.1, Rd:0.3, ring:0.52, seed:43 },
  readout:() => '31 million light-years · 50,000 light-years across' });
addGalaxy({ key:'cena', name:'Centaurus A', label:'Cen A', type:'elliptical galaxy with a swallowed spiral', sortKey:12e6, aka:'ngc 5128',
  fact:'A giant elliptical still digesting a spiral galaxy it swallowed. Its black hole fires jets a million light-years long.',
  pos:radec(hms(13,25,27.6), dms(-43,1,9), 12e6), rad:40000, incl:78, pa:120, g:{ arms:0, bulge:2.6, dust:3, H:0.03, sf:0.6, Rd:0.3, ring:0.22, irr:0.6, seed:47 },
  readout:() => '12 million light-years · the nearest radio galaxy' });
addGalaxy({ key:'ngc1300', name:'NGC 1300', label:'NGC 1300', type:'barred spiral', sortKey:61e6, atlas:false,
  fact:'A striking barred spiral: gas flows along the bar into a small spiral at its heart.',
  pos:radec(hms(3,19,41.1), dms(-19,24,41), 61e6), rad:55000, incl:50, pa:106, g:{ arms:2, pitch:10, bulge:0.5, dust:1.3, bar:0.4, H:0.01, sf:0.8, Rd:0.3, armRef:0.45, seed:53 },
  readout:() => '61 million light-years' });

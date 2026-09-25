
// ================================================================ content pack: the black hole zoo (Gaia BH1, Cygnus X-1, a tidal disruption, GW150914)
// no disk: only the shadow and a faint ring of lensed background light
const noDisk = pr => { gl.uniform4f(pr.u.uP0, 30, 1, 0, 1.6); gl.uniform4f(pr.u.uP1, 0, 0, 0, 2.4); };
// an elliptical orbit drawn as line segments in the host's local xz plane (a in host radii)
function orbitLine(a, e, n = 180, col = [0.45, 0.62, 1]){
  const ps = makePS(n*2);
  for (let i=0;i<n;i++) for (let k=0;k<2;k++){ const E = (i + k)/n*Math.PI*2, x = a*(Math.cos(E) - e), z = a*Math.sqrt(1 - e*e)*Math.sin(E); ps.a.set([x, 0, -z, 1], (i*2 + k)*4); ps.c.set([col[0], col[1], col[2], 0], (i*2 + k)*4); }
  ps.upload('ac'); return ps;
}

// ---------------------------------------------------------------- Gaia BH1: the nearest known black hole, found only by the wobble of the Sun-like star circling it
const gaiabh1 = (() => {
  const M = 9.62, rs = schwarzschild(M), RB = 20, pos = radec(hms(17,28,41.09), dms(-0,34,51.9), 1560);
  const A = 1.4*AU_LY, E = 0.45, PER = 26;
  const bh = addObj({ key:'gaiabh1', name:'Gaia BH1', label:'Gaia BH1', type:'the nearest known black hole · dormant · 9.6 Suns', group:'galaxies', sortKey:1560,
    fact:'The closest black hole we know of, 1,560 light-years away. It is not feeding, so it gives off no light at all: astronomers found it in 2022 from the wobble of the Sun-like star that circles it every 186 days.',
    pos, rad:rs*RB, solid:0.13, R0:facingEarth(pos, V.norm([0.3, 0.8, 0.4]), 0), prog:P.blackhole, minZoom:0.053, pxMin:6, farColor:[0.4, 0.45, 0.6], farLum:0.08, labelRange:4e4, noImpostor:true,
    aka:'gaia bh1 nearest black hole dormant', setU:noDisk,
    views:[{ d:[0.2, 1, 0.3], k:A*2.6/(rs*RB), hold:10, drift:0.02 }, { d:[0, 0.3, 1], k:1.6, hold:9, drift:0.03 }, { d:[0.05, 0.08, 1], k:0.3, hold:8, drift:0.01 }],
    particleVis:rpx => smooth(4, 14, rpx*A/(rs*RB)),
    particles:[{ ps:orbitLine(A/(rs*RB), E), prog:'lnBasic', lines:true, mode:3, sb:0.25, size:1, vis:() => smooth(A*0.2, A*0.8, orbit.dist) }],
    readout:() => orbit.lock === bh.index && V.len(bh.rel) < bh.rad*0.4 ? bhReadout(bh, M, '')() : 'event horizon 57 km across, smaller than a city\nits companion orbits 1.4 AU away, about the distance of Mars from the Sun' });
  const star = addStar({ key:'gaiabh1-star', name:'Gaia BH1 companion', label:'Sun-like star', parent:bh, offset:[A, 0, 0], R:1, T:5850, star:{ cells:36, act:0.25 }, atlas:false, noImpostor:false, farLum:0.8, labelRange:A*40, labelMin:A*0.05,
    fact:'An ordinary Sun-like star on a 186-day orbit around an invisible partner ten times its mass.',
    update(){ const Mn = this.t*2*Math.PI/PER, Ea = keplerE(Mn, E); this.offset = M3.apply(bh.R0, [A*(Math.cos(Ea) - E), 0, -A*Math.sqrt(1 - E*E)*Math.sin(Ea)]); } });
  star.update();
  return bh;
})();

// ---------------------------------------------------------------- Cygnus X-1: a black hole eating a blue supergiant
const PB_KEPDISK = `void body(out vec3 p, out float br, out vec3 col){
  float r = aP.x, a = aP.w + uT*uQ0.x*pow(max(r, uQ0.y), -1.5);
  p = vec3(r*cos(a), aP.y*r, r*sin(a));
  br = aP.z*(0.6 + 0.8*pow(0.5 + 0.5*cos(3.*a + 7.*log(r)), 3.)); col = aC.rgb;
}`;
P.ptKepDisk = program(particleVS(PB_KEPDISK), FS_POINT);
const cygx1 = (() => {
  const M = 21.2, rs = schwarzschild(M), RB = 20, pos = radec(hms(19,58,21.68), dms(35,12,5.78), 7300);
  const A = 0.2*AU_LY, PER = 22, R0 = facingEarth(pos, V.norm([0.2, 0.75, 0.6]), 0);
  const rad = rs*RB, AL = A/rad;   // separation in black-hole radii
  // the accretion disk out to ~40% of the separation, and the stream of gas pulled off the star through the inner Lagrange point
  const nD = Math.round(3000*QUALITY), disk = makePS(nD);
  for (let i=0;i<nD;i++){ const r = AL*(0.004 + 0.3*Math.pow(rnd(), 1.5)), T = 9000 + 90000*Math.pow(AL*0.004/r, 0.75), c = blackbodyJS(Math.min(T, 40000)); disk.a.set([r, rndn()*0.02, 0.4 + rnd(), rnd()*6.283], i*4); disk.c.set([c[0], c[1], c[2], 0], i*4); }
  disk.upload('ac');
  const nS = Math.round(900*QUALITY), stream = makePS(nS);
  for (let i=0;i<nS;i++){ const u = rnd(), x = AL*(0.48 - 0.2*u), y = AL*0.12*Math.sin(Math.PI*u*0.9)*(1 - u*0.3), c = blackbodyJS(12000 + 25000*u); stream.a.set([x + rndn()*AL*0.006, rndn()*AL*0.006, y + rndn()*AL*0.006, 0.5 + u], i*4); stream.c.set([c[0], c[1], c[2], 0], i*4); }
  stream.upload('ac');
  const st = { ph:0 };
  const bh = addObj({ key:'cygx1', name:'Cygnus X-1', label:'Cygnus X-1', type:'black hole feeding on a blue supergiant · 21 Suns', group:'galaxies', sortKey:7300,
    fact:'The first object widely accepted as a black hole (1971). Every 5.6 days it circles a blue supergiant 40 times the Sun\'s mass, stripping gas into a disk hot enough to shine in X-rays. Stephen Hawking famously bet it was not a black hole, and lost.',
    pos, rad, solid:0.13, R0, prog:P.blackhole, minZoom:0.053, pxMin:6, farColor:[0.6, 0.75, 1], farLum:0.5, labelRange:8e4, aka:'cyg x-1 cygnus x1 hde 226868 hawking bet',
    setU(pr){ gl.uniform4f(pr.u.uP0, 3, 18, 2.4, 1.3); gl.uniform4f(pr.u.uP1, 0.35, 0, 0, 0); },
    particleVis:rpx => smooth(3, 10, rpx*AL*0.3),
    update(dt){ st.ph += dt*2*Math.PI/PER; },
    views:[{ d:[0.3, 0.5, 1], k:AL*1.45, hold:10, drift:0.02 }, { d:[0, 0.22, 1], k:1.5, hold:9, drift:0.03 }, { d:[0.9, 0.3, 0.3], k:AL*0.9, off:[AL*0.35, 0, 0], hold:8, drift:0.02 }],
    particles:[
      { ps:disk, prog:'ptKepDisk', mode:3, sb:0.6, size:1.6, q0:() => [0.21*Math.pow(AL*0.3, 1.5), AL*0.03, 0, 0], vis:() => smooth(rad*20, rad*300, orbit.dist) },
      { ps:stream, prog:'ptBasic', mode:3, sb:0.7, size:1.5, rot:() => M3.mul(R0, M3.rotY(st.ph)), vis:() => smooth(rad*40, rad*400, orbit.dist) },
    ],
    readout:() => orbit.lock === bh.index && V.len(bh.rel) < bh.rad*0.4 ? bhReadout(bh, M, '')() : 'the two orbit 0.2 AU apart, half of Mercury\'s distance from the Sun\nX-rays come from gas at millions of degrees just before it falls in' });
  const star = addStar({ key:'cygx1-star', name:'HDE 226868', label:'HDE 226868', parent:bh, offset:[A, 0, 0], R:22.9, T:28500, bound:1.25, star:{ cells:48, act:0, corona:0, chromo:0, obl:0.08 }, atlas:false, noImpostor:false, farLum:1, labelRange:A*60, labelMin:A*0.1,
    fact:'The blue supergiant companion of Cygnus X-1, about 40 times the Sun\'s mass. The black hole\'s pull stretches it slightly into an egg shape.',
    update(){ this.offset = M3.apply(R0, [A*Math.cos(st.ph), 0, -A*Math.sin(st.ph)]); this.rot = M3.mul(R0, M3.rotY(st.ph + Math.PI)); } });
  star.update();
  return bh;
})();

// ---------------------------------------------------------------- a tidal disruption: a star that strayed too close to a supermassive black hole
// units: Schwarzschild radii, GM = 0.5, c = 1. The star is torn apart at pericentre; each fragment then follows its own orbit (the "frozen-in" approximation).
const tde = (() => {
  const Mbh = 1e6, rs = schwarzschild(Mbh), pos = radec(hms(4,46,37.88), dms(-10,13,34.9), 215e6);
  const L = 420, GM = 0.5, RP = 45, RSTAR = 3, N = Math.round(2600*QUALITY), CYCLE = 42;   // (the star is drawn ~10x too big so its debris returns within a minute)
  const ps = makePS(N), off = new Float32Array(N*3), p = new Float32Array(N*3), v = new Float32Array(N*3), alive = new Uint8Array(N);
  const went = new Uint8Array(N), inDisk = new Uint8Array(N), rc = new Float32Array(N), ang = new Float32Array(N), tilt = new Float32Array(N);
  for (let i=0;i<N;i++){ const d = randDir(), r = RSTAR*Math.cbrt(rnd()); off.set([d[0]*r, d[1]*r*0.5, d[2]*r], i*3); }
  const st = { t:0, c:[0, 0, 0], vc:[0, 0, 0], torn:false, disk:0, eaten:0, flare:0 };
  function reset(){
    const nu = -2.42, pr = 2*RP, r = pr/(1 + Math.cos(nu)), k = Math.sqrt(GM/pr);
    st.c = [r*Math.cos(nu), 0, r*Math.sin(nu)]; st.vc = [-k*Math.sin(nu), 0, k*(1 + Math.cos(nu))];
    st.t = 0; st.torn = false; st.disk = 0; st.eaten = 0; st.flare = 0; alive.fill(1); went.fill(0); inDisk.fill(0);
  }
  function accel(x, y, z){ const r2 = x*x + y*y + z*z, r = Math.sqrt(r2), k = -GM/(r2*r); return [x*k, y*k, z*k]; }
  function step(dt){
    if (!st.torn){
      const a = accel(...st.c); for (let j=0;j<3;j++){ st.vc[j] += a[j]*dt; st.c[j] += st.vc[j]*dt; }
      if (Math.hypot(...st.c) < RP*1.02 && V.dot(st.c, st.vc) > 0){
        st.torn = true;
        for (let i=0;i<N;i++) for (let j=0;j<3;j++){ p[i*3+j] = st.c[j] + off[i*3+j]; v[i*3+j] = st.vc[j]; }
      }
      return;
    }
    for (let i=0;i<N;i++){
      if (!alive[i]) continue;
      const j = i*3;
      if (inDisk[i]){
        // circularised gas: orbits at the local circular speed and slowly spirals in (the disk's viscosity) until the hole swallows it
        rc[i] -= dt*rc[i]*9e-6; ang[i] += dt*Math.sqrt(GM/(rc[i]*rc[i]*rc[i]));
        p[j] = rc[i]*Math.cos(ang[i]); p[j+1] = rc[i]*tilt[i]*Math.sin(ang[i]*1.3); p[j+2] = rc[i]*Math.sin(ang[i]);
        if (rc[i] < 8){ alive[i] = 0; st.eaten++; }
        continue;
      }
      const a = accel(p[j], p[j+1], p[j+2]);
      v[j] += a[0]*dt; v[j+1] += a[1]*dt; v[j+2] += a[2]*dt; p[j] += v[j]*dt; p[j+1] += v[j+1]*dt; p[j+2] += v[j+2]*dt;
      const r = Math.hypot(p[j], p[j+1], p[j+2]);
      if (r > RP*4) went[i] = 1;
      // returning debris slams into the stream near its closest approach and the shocks circularise it at about twice that distance
      if (went[i] && r < RP*2.2){ inDisk[i] = 1; rc[i] = r*(0.9 + 0.3*Math.random()); ang[i] = Math.atan2(p[j+2], p[j]); tilt[i] = (Math.random() - 0.5)*0.12; }
      if (r < 8){ alive[i] = 0; st.eaten++; }
      else if (r > L*3 && 0.5*(v[j]*v[j] + v[j+1]*v[j+1] + v[j+2]*v[j+2]) > GM/r) alive[i] = 0;   // unbound debris has left for good
    }
  }
  reset();
  // the star's incoming path (a parabola with its closest point at RP), drawn faintly so you can see where it is heading
  const path = makePS(2*160);
  for (let i=0;i<160;i++) for (let k=0;k<2;k++){ const nu = -2.5 + 5*(i + k)/160, r = 2*RP/(1 + Math.cos(nu)); path.a.set([r*Math.cos(nu)/L, 0, r*Math.sin(nu)/L, 1], (i*2 + k)*4); path.c.set([0.55, 0.7, 1, 0], (i*2 + k)*4); }
  path.upload('ac');
  // where the hole is (too small to see from out here), flaring as the debris comes home
  const core = makePS(1); core.a.set([0, 0, 0, 1]); core.c.set([0.75, 0.85, 1, 0]); core.upload('ac');
  const bh = addObj({ key:'tde', name:'A star torn apart', label:'tidal disruption', type:'tidal disruption event · modelled on AT2019qiz', group:'galaxies', sortKey:215e6, isBH:true, sizeR:rs,
    fact:'When a star wanders too close to a giant black hole, the difference in gravity across it pulls it into a long stream of gas: "spaghettification". Half the debris is flung away; the rest falls back, forms a disk and flares for months. This one is modelled on AT2019qiz, the closest such flare yet seen.',
    pos, rad:L*rs, R0:facingEarth(pos, V.norm([0.2, 1, 0.3]), 0), minZoom:0.01, pxMin:4, farColor:[0.8, 0.85, 1], farLum:0.5, labelRange:2e9, noImpostor:false, aka:'tde tidal disruption spaghettification at2019qiz star eaten',
    particleVis:rpx => smooth(3, 10, rpx), sim:st,
    update(dt){
      st.t += dt; if (st.t > CYCLE) reset();
      // time runs slowly while the star plunges past, then much faster so the fallback can be seen
      const speed = st.torn ? 700 + 24000*smooth(2, 12, st.t - (st.tornAt || st.t)) : 700;
      if (st.torn && !st.tornAt) st.tornAt = st.t;
      let left = dt*speed, n = 0;
      while (left > 0 && n < 40){ const h = Math.min(left, 14); step(h); left -= h; n++; }
      st.flare = Math.min(st.eaten/(N*0.08), 1);
      st.disk += (st.flare - st.disk)*(1 - Math.exp(-dt*0.8));
      for (let i=0;i<N;i++){
        const j = i*3, x = st.torn ? p[j] : st.c[0] + off[j], y = st.torn ? p[j+1] : st.c[1] + off[j+1], z = st.torn ? p[j+2] : st.c[2] + off[j+2];
        const r = Math.hypot(x, y, z), heat = clamp(60/r, 0, 1);
        ps.a[i*4] = x/L; ps.a[i*4+1] = y/L; ps.a[i*4+2] = z/L; ps.a[i*4+3] = alive[i] || !st.torn ? 0.5 + 1.2*heat : 0;
        const c = blackbodyJS(4500 + 26000*heat*heat); ps.c[i*4] = c[0]; ps.c[i*4+1] = c[1]; ps.c[i*4+2] = c[2];
      }
      ps.upload('ac');
      if (!st.torn) st.tornAt = 0;
    },
    tourReset(){ reset(); st.tornAt = 0; },
    views:[{ d:[0.25, 1, 0.5], k:3.2, hold:16, drift:0.01 }, { d:[0.6, 0.55, 0.6], k:0.9, hold:12, drift:0.02 }, { d:[0.1, 0.3, 1], k:0.16, hold:10, drift:0.02 }],
    particles:[{ ps:path, prog:'lnBasic', lines:true, mode:3, sb:0.6, size:1, vis:() => st.torn ? Math.max(0, 1 - (st.t - st.tornAt)*0.3) : 1 },
      { ps:core, prog:'ptBasic', mode:3, sb:1, size:7, vis:() => 0.25 + 2.2*st.disk },
      { ps, prog:'ptBasic', mode:3, sb:1.1, size:1.8 }],
    readout:() => !st.torn ? 'a Sun-like star falls toward a black hole of a million Suns\nat 45 Schwarzschild radii its own gravity can no longer hold it together' :
      st.flare < 0.3 ? 'torn apart: half the gas is bound, half escapes at thousands of km/s\nthe stream stretches to thousands of times the star\'s size' : 'the bound debris falls back and piles into a disk\nit shines for months, as bright as a whole galaxy' });
  addObj({ key:'tde-bh', name:'the black hole', label:'', type:'supermassive black hole · a million Suns', group:'galaxies', parent:bh, offset:[0, 0, 0], rad:rs*20, solid:0.13, R0:bh.R0, prog:P.blackhole, minZoom:0.053, pxMin:6, noImpostor:true, atlas:false, noLabel:true,
    setU(pr){ gl.uniform4f(pr.u.uP0, 3, 16, 1.8, 0.25 + 1.6*st.disk); gl.uniform4f(pr.u.uP1, 0, 0, 0, 0); } });
  return bh;
})();

// ---------------------------------------------------------------- GW150914: two black holes merging, the first gravitational waves ever detected
const FS_BBH = COMMON + `
void main(){
  vec3 rd = rayDir();
  vec3 o = uCamLocal, d = rd*uRot;
  vec2 hit = sphIsect(o, d, vec3(0.), 1.); if(hit.y < 0.) discard;
  vec3 A = uP0.xyz, B = uP1.xyz; float ra = uP0.w, rb = uP1.w;
  vec3 p = o + d*max(hit.x, 0.), v = d; bool cap = false;
  int N = int(mix(110., 190., uLod));
  for(int i=0;i<190;i++){
    if(i >= N) break;
    vec3 pa = p - A, pb = p - B; float r1 = length(pa), r2 = rb > 0. ? length(pb) : 1e9;
    if(r1 < ra || r2 < rb){ cap = true; break; }
    if(length(p) > 1.01 && dot(p, v) > 0.) break;
    float dt = clamp(0.05*min(r1, r2), 0.001, 0.05);
    vec3 h1 = cross(pa, v), h2 = cross(pb, v);
    vec3 acc = -1.5*ra*dot(h1, h1)*pa/pow(r1, 5.);
    if(rb > 0.) acc -= 1.5*rb*dot(h2, h2)*pb/pow(r2, 5.);
    v = normalize(v + acc*dt); p += v*dt;
  }
  // photon rings: background light that loops around each hole piles up just outside its shadow (b = 2.6 r_s)
  float b1 = length(cross(A - o, d)), b2 = length(cross(B - o, d));
  float ring = exp(-pow((b1 - 2.62*ra)/(0.1*ra), 2.)) + 0.12*exp(-pow((b1 - 2.9*ra)/(0.6*ra), 2.));
  if(rb > 0.) ring += exp(-pow((b2 - 2.62*rb)/(0.1*rb), 2.)) + 0.12*exp(-pow((b2 - 2.9*rb)/(0.6*rb), 2.));
  float b = length(cross(o, d)), w = smoothstep(0.6, 0.98, b);
  // the sky behind them, bent into arcs and a double Einstein ring: the only way to "see" two black holes
  vec3 dv = normalize(uRot*v);
  float near = max(smoothstep(7.*ra, 2.7*ra, b1), rb > 0. ? smoothstep(7.*rb, 2.7*rb, b2) : 0.);
  vec3 bg = cap ? vec3(0.) : starfield(dv)*1.4 + (starCell(dv, 90., 0.26, 5.)*0.9 + starCell(dv, 48., 0.15, 9.) + vec3(0.5, 0.58, 0.95)*0.05*fbm3(dv*5.))*near*1.6;
  vec3 col = bg + vec3(0.8, 0.86, 1.)*ring*1.3*(cap ? 0.3 : 1.);
  outCol(col*(1. - w), cap ? 1. : 1. - w);
}`;
// the spacetime sheet under the pair: a well beneath each hole, rippling with the gravitational waves they send out
const PB_BBHGRID = `void body(out vec3 p, out float br, out vec3 col){
  p = vec3(aP.x, 0., aP.y);
  float r = length(p.xz), psi = atan(p.z, p.x);
  float tIn = uQ0.x, Tin = uQ0.y, w0 = uQ0.z, cv = uQ0.w;
  float h = 0., tret = tIn - r/cv;
  if(tret > 0. && tret < Tin){ float x = max(1. - tret/Tin, 1e-4); h = cos(2.*(psi - w0*Tin*1.6*(1. - pow(x, 0.625))))/pow(x, 0.25); }
  else if(tret >= Tin){ float s = tret - Tin; h = cos(2.*psi - s*45.)*exp(-s*2.5)*0.8; }
  vec2 e = vec2(cos(uQ1.z), sin(uQ1.z)), A = uQ1.y*e, B = -uQ1.w*e;
  float well = 0.0055/(length(p.xz - A) + 0.035) + 0.0045/(length(p.xz - B) + 0.035);
  float amp = 0.018/max(r, 0.2);
  p.y = -0.12 - well + clamp(h*amp, -0.05, 0.05)*smoothstep(1., 0.6, r);
  br = (0.22 + min(6.*abs(h)*amp, 0.9) + min(well*3., 0.6))*smoothstep(0.95, 0.65, r)*uQ1.x;
  col = h > 0. ? vec3(0.35, 0.58, 1.) : vec3(0.78, 0.4, 1.);
  // the sheet is not lensed, so whatever lies behind a hole's shadow is hidden rather than drawn across it
  vec3 w = uRel + uRot*(p*uRad); float lw = length(w);
  vec3 wa = uRel + uRot*(vec3(A.x, 0., A.y)*uRad), wb = uRel + uRot*(vec3(B.x, 0., B.y)*uRad);
  float sa = (uQ1.y > 0. ? 0.084 : 0.144)*uRad, sb = 0.068*uRad;
  if(lw > length(wa) && length(cross(wa, w/lw)) < sa) br = 0.;
  if(uQ1.y > 0. && lw > length(wb) && length(cross(wb, w/lw)) < sb) br = 0.;
}`;
P.lnBBH = program(particleVS(PB_BBHGRID), FS_LINE);
const gw150914 = (() => {
  const pos = radec(hms(8,0,0), dms(-70,0,0), 1.3e9);   // the waves' origin was only pinned to a long arc of the southern sky
  const m1 = 36, m2 = 29, Tin = 20, a0 = 0.42, w0 = 1.05, CYCLE = 34, CV = 0.3, RS1 = 0.032, RS2 = RS1*m2/m1, RSF = RS1*62/m1;
  const f1 = m2/(m1 + m2), f2 = m1/(m1 + m2);
  const st = { t:0, a:a0, ph:0, merged:false };
  const G = IS_SMALL ? 26 : 34, SEG = IS_SMALL ? 36 : 56, grid = makePS(2*(G + 1)*SEG*2); let gk = 0;
  for (let dir=0; dir<2; dir++) for (let i=0;i<=G;i++){ const u = -1 + 2*i/G;
    for (let s=0;s<SEG;s++){ for (const e of [s, s + 1]){ const vv = -1 + 2*e/SEG; grid.a.set(dir ? [u, vv, 0, 1] : [vv, u, 0, 1], gk*4); grid.c.set([0, 0, 0, 0], gk*4); gk++; } } }
  grid.count = gk; grid.upload('ac');
  const o = addObj({ key:'gw150914', name:'GW150914', label:'GW150914', type:'two black holes merging · the first gravitational waves detected', group:'galaxies', sortKey:1.3e9, isBH:true, sizeR:schwarzschild(62),
    fact:'1.3 billion years ago two black holes of 36 and 29 Suns spiralled together and merged. They gave off no light, but three Suns\' worth of energy left as ripples in spacetime, which reached detectors on Earth on 14 September 2015.',
    pos, rad:3320*KM, R0:facingEarth(pos, V.norm([0.15, 0.55, 0.8]), 0), prog:program(VS_RECT, FS_BBH), minZoom:0.08, pxMin:6, farColor:[0.6, 0.7, 1], farLum:0.2, labelRange:5e9, noImpostor:true, sim:st,
    aka:'gw150914 ligo binary black hole merger gravitational waves 2015',
    update(dt){
      st.t += dt; if (st.t > CYCLE) st.t = 0;
      const t = st.t;
      if (t < Tin){ const x = 1 - t/Tin; st.a = Math.max(a0*Math.pow(x, 0.25), (RS1 + RS2)*1.05); st.ph = w0*Tin*1.6*(1 - Math.pow(x, 0.625)); st.merged = false; }
      else { st.merged = true; st.a = 0; }
    },
    setU(pr){
      if (!st.merged){ const c = Math.cos(st.ph), s = Math.sin(st.ph);
        gl.uniform4f(pr.u.uP0, st.a*f1*c, 0, st.a*f1*s, RS1); gl.uniform4f(pr.u.uP1, -st.a*f2*c, 0, -st.a*f2*s, RS2); }
      else { const ring = 1 + 0.06*Math.exp(-(st.t - Tin)*1.5)*Math.cos((st.t - Tin)*30); gl.uniform4f(pr.u.uP0, 0, 0, 0, RSF*ring); gl.uniform4f(pr.u.uP1, 0, 0, 0, 0); }
    },
    tourReset(){ st.t = 4; },
    views:[{ d:[0.12, 0.72, 0.68], k:0.85, hold:12, drift:0.02 }, { d:[0.05, 0.1, 1], k:0.42, hold:10, drift:0.01 }, { d:[0, 1, 0.05], k:1.3, hold:8, drift:0.02 }],
    particles:[{ ps:grid, prog:'lnBBH', lines:true, mode:1, sb:1.1, size:1, q0:() => [st.t, Tin, w0, CV], q1:() => [smooth(0, 1, st.t)*(1 - smooth(CYCLE - 2, CYCLE, st.t)), st.a*f1, st.ph, st.a*f2] }],
    readout:() => {
      if (!st.merged){ const f = 35*Math.pow(Math.max(1 - st.t/Tin, 1e-3), -0.375); return `wave frequency ${Math.min(f, 250).toFixed(0)} Hz and rising: the "chirp"\nthe pair is circling ${(f/2).toFixed(0)} times a second (shown slowed down)`; }
      return st.t - Tin < 3 ? 'merged: one black hole of 62 Suns, ringing like a struck bell\n3 Suns of mass turned into gravitational waves in a fifth of a second' : 'the light you see is bent starlight: merging black holes are dark\nthe grid shows the spacetime ripples, which are invisible';
    } });
  return o;
})();

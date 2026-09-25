
// ================================================================ 09 interacting binary with recurrent nova (RS Ophiuchi-like)
// physics units: separation a = 1, G(M1+M2) = 1, orbital frequency 1; local = physics * 0.5
const FS_BINARY = COMMON + `
float mu1, mu2; vec3 X1, X2;
float phi(vec3 p){ return -mu1/length(p - X1) - mu2/length(p - X2) - 0.5*(p.x*p.x + p.z*p.z); }
vec3 gphi(vec3 p){ vec3 a = p - X1, b = p - X2; float ra = length(a), rb = length(b); return mu1*a/(ra*ra*ra) + mu2*b/(rb*rb*rb) - vec3(p.x, 0., p.z); }
void main(){
  vec3 o, d; localRay(o, d);
  const float S = 0.5; o /= S;
  mu1 = uP0.x; mu2 = uP0.y; X1 = vec3(-mu2, 0., 0.); X2 = vec3(mu1, 0., 0.);
  float xL1 = uP0.z, PhiS = uP0.w, flash = uP2.x, disrupt = uP2.y;
  vec3 col = vec3(0.); float alpha = 0.;
  // donor: the Roche equipotential surface, with gravity darkening, convection cells, starspots and nova irradiation
  float ts = 1e9; vec3 dcol = vec3(0.);
  vec2 hb = sphIsect(o, d, X1, xL1 - X1.x + 0.02);
  if(hb.y > 0.){
    float ta = max(hb.x, 0.), tb = hb.y; int N = int(mix(44., 80., uLod)); float dt = (tb - ta)/float(N);
    float tp = ta;
    for(int i=0;i<80;i++){
      if(i >= N) break;
      float t = ta + dt*float(i + 1);
      vec3 p = o + d*t;
      if(phi(p) < PhiS && p.x < xL1){
        float lo = tp, hi = t;
        for(int k=0;k<7;k++){ float mid = 0.5*(lo + hi); vec3 q = o + d*mid; if(phi(q) < PhiS && q.x < xL1) hi = mid; else lo = mid; }
        ts = hi; break;
      }
      tp = t;
    }
    if(ts < 1e8){
      vec3 p = o + d*ts; vec3 gv = gphi(p); float g = length(gv); vec3 n = gv/g;
      float mu = max(dot(n, -d), 0.);
      float gd = pow(g/uP1.x, 0.08);
      vec3 sp = p - X1;
      float cells = 1. - pow(ridge(sp*7. + vec3(0., uTime*0.03, 0.)), 1.5)*0.7;
      float spots = smoothstep(0.62, 0.72, fbm3(sp*5. + 9.));
      vec3 toWD = normalize(X2 - p);
      float irr = max(dot(n, toWD), 0.);
      dcol = blackbody(3500.*gd + 700.*irr*uP1.w)*(0.28 + 0.72*mu)*pow(g/uP1.x, 0.32)*cells*(1. - 0.6*spots)*1.7;
      dcol += vec3(0.85, 0.9, 1.)*irr*flash*0.12*(0.4 + 0.6*mu);
    }
  }
  // accretion disk around the white dwarf (continuous light; particles add the clumps)
  vec3 kcol = vec3(0.); float ka = 0., tdisk = 1e9;
  if(abs(d.y) > 1e-5){
    float td = -o.y/d.y;
    if(td > 0.){
      vec3 q = o + d*td; vec2 rel = q.xz - X2.xz; float rq = length(rel), Rd = uP1.z;
      if(rq < Rd){
        tdisk = td;
        float ph = atan(rel.y, rel.x);
        float spiral = 1. + 0.5*cos(2.*ph + 4.5*log(rq) - uTime*0.4);
        float temp = 18000.*pow(max(rq, 0.01)/0.01, -0.6);
        float nn = noise(vec3(rot2(uTime*1.5/(rq*20. + 0.5))*rel*50., uTime*0.2));
        kcol = blackbody(temp)*pow(0.03/max(rq, 0.01), 1.1)*spiral*(0.5 + 0.8*nn)*1.1*(1. - 0.85*disrupt);
        vec2 hs = Rd*vec2(cos(uP1.y), sin(uP1.y));
        kcol += vec3(1., 0.85, 0.7)*exp(-dot(rel - hs, rel - hs)/0.0012)*(2.2 + 1.2*sin(uTime*7.))*(1. - disrupt);
        ka = smoothstep(Rd, Rd*0.75, rq)*0.8*(1. - disrupt);
      }
    }
  }
  if(ts < 1e8 && ts < tdisk){ col = dcol; alpha = 1.; }
  else { col = kcol + (1. - ka)*dcol; alpha = ts < 1e8 ? 1. : ka; }
  // white dwarf and the thermonuclear nova flash
  col += vec3(0.75, 0.85, 1.)*(pblob(o, d, X2, 0.008)*400. + blob(o, d, X2, 0.04)*0.6);
  col += vec3(0.85, 0.9, 1.)*(pblob(o, d, X2, 0.01)*flash*200. + blob(o, d, X2, 0.08 + 0.3*uP2.z)*flash*0.8);
  outCol(col, alpha);
}`;
// Keplerian disk clumps in the co-rotating frame (frame spins at 1, so relative rate is w - 1)
const PB_KDISK = `void body(out vec3 p, out float br, out vec3 col){
  float r = aP.x, a = aP.w + uQ0.x*pow(r/0.03, -1.5)*6.;
  float arm = 0.5 + 0.5*cos(2.*a + 4.5*log(r));
  p = (vec3(uQ0.y, 0., 0.) + vec3(r*cos(a), aP.y*r, r*sin(a)))*0.5;
  br = (0.35 + 1.2*arm*arm)*(1. - 0.9*uQ0.z)*aP.z;
  col = aC.rgb;
}`;
// nova ejecta: an hourglass shell expanding from where the white dwarf was, drawn in the inertial frame
const PB_NOVA = `void body(out vec3 p, out float br, out vec3 col){
  vec3 dir = aP.xyz;
  float v = 0.35 + 0.65*pow(abs(dir.y), 0.5);
  p = uM*(vec3(uQ0.x, 0., 0.) + dir*uQ0.y*v*aP.w)*0.5;
  br = uQ0.z*(0.6 + 0.8*pow(abs(dir.y), 2.));
  col = mix(vec3(1., 0.95, 0.9), aC.rgb, uQ0.w);
}`;
P.ptKDisk = program(particleVS(PB_KDISK), FS_POINT);
P.ptNova = program(particleVS(PB_NOVA), FS_POINT);

const binary = (() => {
  const mu1 = 0.62, mu2 = 0.38, X1 = -mu2, X2 = mu1, S = 0.5, RD = 0.2, H = 0.004, RATE = 0.35, NOVA = 34;
  const dPhi = x => mu1*(x - X1)/Math.pow(Math.abs(x - X1), 3) + mu2*(x - X2)/Math.pow(Math.abs(x - X2), 3) - x;
  let lo = X1 + 0.05, hi = X2 - 0.05;
  for (let i=0;i<60;i++){ const m = 0.5*(lo + hi); if (dPhi(m) > 0) lo = m; else hi = m; }
  const xL1 = 0.5*(lo + hi);
  const phi = (x,y,z) => -mu1/Math.hypot(x-X1,y,z) - mu2/Math.hypot(x-X2,y,z) - 0.5*(x*x + z*z);
  const PhiS = phi(xL1,0,0) - 0.0015;
  let yp = 0.1; for (let i=0;i<60;i++){ if (phi(X1, yp, 0) < PhiS) yp += 0.01; else break; }
  const gp = (() => { const r1 = Math.hypot(0, yp, 0), r2 = Math.hypot(X1 - X2, yp, 0); return V.len([mu2*(X1 - X2)/r2**3 - X1, mu1*yp/r1**3 + mu2*yp/r2**3, 0]); })();
  // stream from L1 (restricted three-body, Coriolis + centrifugal)
  const n = Math.round(1500*QUALITY), ps = makePS(n);
  const p = new Float32Array(n*3), v = new Float32Array(n*3), delay = new Float32Array(n), heat = new Float32Array(n);
  const st = { acc:0, hsAng:2.2, hsX:0, hsZ:0, phase:0, novaT:20, flash:0, disrupt:0, shellR:0, shellA:0, novaPhase:0 };
  const spawn = i => { p[i*3] = xL1 + 0.004; p[i*3+1] = rndn()*0.006; p[i*3+2] = rndn()*0.006; v[i*3] = 0.03 + rnd()*0.03; v[i*3+1] = rndn()*0.004; v[i*3+2] = rndn()*0.006; heat[i] = 0; };
  for (let i=0;i<n;i++){ spawn(i); delay[i] = rnd()*1.2; }
  function step(){
    for (let i=0;i<n;i++){
      if (delay[i] > 0){ delay[i] -= H; continue; }
      const j = i*3, x = p[j], y = p[j+1], z = p[j+2], ax1 = x - X1, ax2 = x - X2;
      const r1 = Math.sqrt(ax1*ax1 + y*y + z*z), r2 = Math.sqrt(ax2*ax2 + y*y + z*z), k1 = mu1/(r1*r1*r1), k2 = mu2/(r2*r2*r2);
      v[j] += (-k1*ax1 - k2*ax2 + x - 2*v[j+2])*H; v[j+1] += (-k1*y - k2*y)*H; v[j+2] += (-k1*z - k2*z + z + 2*v[j])*H;
      p[j] += v[j]*H; p[j+1] += v[j+1]*H; p[j+2] += v[j+2]*H;
      const rr = Math.hypot(p[j] - X2, p[j+2]);
      heat[i] = Math.max(heat[i], 1 - rr/0.6);
      if (rr < RD*0.95){ st.hsX = st.hsX*0.98 + (p[j] - X2)*0.02; st.hsZ = st.hsZ*0.98 + p[j+2]*0.02; spawn(i); }
      else if (r2 > 2.5 || r1 < 0.2) spawn(i);
    }
  }
  // disk clumps
  const nd = Math.round(2600*QUALITY), disk = makePS(nd);
  for (let i=0;i<nd;i++){ const r = 0.015 + 0.19*Math.pow(rnd(), 0.8), c = blackbodyJS(18000*Math.pow(r/0.015, -0.6)); disk.a.set([r, rndn()*0.03, 0.4 + rnd()*0.8, rnd()*6.2832], i*4); disk.c.set([c[0], c[1], c[2], 0], i*4); }
  disk.upload('ac');
  // nova shell
  const nn = Math.round(2400*QUALITY), shell = makePS(nn);
  for (let i=0;i<nn;i++){ const d = randDir(), c = rnd() < 0.6 ? [1, 0.4, 0.35] : [0.5, 0.9, 1]; shell.a.set([d[0], d[1], d[2], 0.85 + 0.3*rnd()], i*4); shell.c.set([c[0], c[1], c[2], 0], i*4); }
  shell.upload('ac');
  st.update = dt => {
    st.acc += dt*RATE; let c = 0;
    while (st.acc >= H && c < 40){ step(); st.acc -= H; c++; }
    if (c >= 40) st.acc = 0;
    st.phase += dt*RATE;
    st.novaT += dt; if (st.novaT > NOVA){ st.novaT = 0; st.novaPhase = st.phase; }
    const tn = st.novaT;
    st.flash = 14*Math.exp(-tn/0.35) + 3*Math.exp(-tn/2.5);
    st.disrupt = smooth(0, 0.6, tn)*(1 - smooth(9, 20, tn));
    st.shellR = 0.04 + 1.7*(1 - Math.exp(-tn/6));
    st.shellA = tn < 0.05 ? 0 : Math.exp(-tn/8)*(1 - smooth(22, 30, tn))*3;
    if (st.hsX*st.hsX + st.hsZ*st.hsZ > 1e-6) st.hsAng = Math.atan2(st.hsZ, st.hsX);
    for (let i=0;i<n;i++){
      const on = delay[i] > 0 ? 0 : 1, h = heat[i];
      ps.a[i*4] = p[i*3]*S; ps.a[i*4+1] = p[i*3+1]*S; ps.a[i*4+2] = p[i*3+2]*S; ps.a[i*4+3] = on*(0.35 + 1.6*h*h)*(1 - 0.8*st.disrupt);
      const col = blackbodyJS(3800 + 12000*h*h); ps.c[i*4] = col[0]; ps.c[i*4+1] = col[1]; ps.c[i*4+2] = col[2];
    }
    ps.upload('ac');
  };
  const pos = radec(hms(17,50,13.2), dms(-6,42,28), 5000);
  const o = addObj({ key:'rsoph', name:'RS Ophiuchi', label:'RS Oph', type:'recurrent nova · red giant feeding a white dwarf', group:'stars', sortKey:5000,
    fact:'A red giant overflows its Roche lobe and feeds a white dwarf. Every ~15 years the piled-up hydrogen ignites in a nova that blasts out an hourglass shell (last in 2021).',
    pos, rad:2.96*AU_LY, R0:facingEarth(pos, V.norm([0, 0.45, 1]), 0), prog:program(VS_RECT, FS_BINARY), minZoom:0.1, pxMin:6, farColor:[1, 0.6, 0.4], farLum:0.5, labelRange:2e3, aka:'nova binary white dwarf red giant',
    views:[{d:[0,0.45,1],k:1.3,hold:9,drift:0},{d:[0.05,1,0.05],k:1.6,hold:9,drift:0},{d:[0.3,0.55,1],k:0.42,off:()=>M3.apply(M3.rotY(st.phase), [X2*S*0.8, 0, 0]),hold:8,drift:0}],
    sim:st, tourReset:()=>{ st.novaT = NOVA - 9; }, update(dt){ st.update(dt); this.rot = M3.mul(this.R0, M3.rotY(st.phase)); },
    setU(pr){ gl.uniform4f(pr.u.uP0, mu1, mu2, xL1, PhiS); gl.uniform4f(pr.u.uP1, gp, st.hsAng, RD, 0.35); gl.uniform4f(pr.u.uP2, st.flash, st.disrupt, smooth(0, 3, st.novaT), 0); },
    particles:[
      {ps, prog:'ptBasic', mode:1, sb:4, size:2},
      {ps:disk, prog:'ptKDisk', mode:1, sb:1.1, size:1.8, q0:()=>[st.phase, X2, st.disrupt, 0]},
      {ps:shell, prog:'ptNova', mode:1, sb:2.5, size:2, q0:()=>[X2, st.shellR, st.shellA, smooth(0, 4, st.novaT)], mat:()=>M3.rotY(-(st.phase - st.novaPhase)), show:()=>st.shellA > 0.01},
    ],
    readout:() => {
      const tn = st.novaT;
      if (tn < 12) return `NOVA: thermonuclear runaway on the white dwarf\nshell racing out at ~4,000 km/s, fastest toward the poles`;
      return `orbital period ~454 days (shown ~20 s) · gas crossing L1\nnext nova in ${(NOVA - tn).toFixed(0)} s (real: every 15 to 20 years)`;
    } });
  return o;
})();

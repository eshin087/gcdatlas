
// ================================================================ 02 quasar
// Scales are log-compressed so one object spans jets (~190,000 ly) down to the torus (~10 ly).
const FS_QUASAR = COMMON + `
vec3 jetH(vec3 o, vec3 d, float sg, float L, float tm, float boost){
  const float Rc = 0.075;
  float a = dot(d.xz, d.xz), b = dot(o.xz, d.xz), c = dot(o.xz, o.xz) - Rc*Rc, t0, t1;
  if(a < 1e-7){ if(c > 0.) return vec3(0.); t0 = 0.; t1 = 1e3; }
  else { float h = b*b - a*c; if(h < 0.) return vec3(0.); h = sqrt(h); t0 = (-b - h)/a; t1 = (-b + h)/a; }
  float ya = 0.003*sg, yb = L*sg;
  if(abs(d.y) > 1e-6){ float s0 = (ya - o.y)/d.y, s1 = (yb - o.y)/d.y; t0 = max(t0, min(s0, s1)); t1 = min(t1, max(s0, s1)); }
  else if((o.y - ya)*(o.y - yb) > 0.) return vec3(0.);
  t0 = max(t0, 0.);
  if(t1 <= t0) return vec3(0.);
  vec3 acc = vec3(0.); const int N = 24; float dt = (t1 - t0)/float(N);
  float jit = hash12(gl_FragCoord.xy + sg);
  for(int i=0;i<N;i++){
    vec3 p = o + d*(t0 + (float(i) + jit)*dt);
    float s = abs(p.y), u = s/L;
    float w = 0.0035 + 0.05*u;
    float ph = s*38. - tm*2.6*sg;
    vec2 q = p.xz - 0.45*w*vec2(cos(ph), sin(ph));
    float r2 = dot(q, q)/(w*w);
    float spine = exp(-r2*2.5);
    float sheath = exp(-r2*0.55)*(0.3 + 1.1*noise(vec3(p.xz*110., s*70. - tm*2.5*sg)));
    float knots = 0.35 + 3.2*pow(0.5 + 0.5*sin(s*26. - tm*4.2 + sg*1.3), 14.)*exp(-u*1.2);
    float prof = smoothstep(0., 0.015, u)*smoothstep(1., 0.88, u)*(1. + 4.*exp(-s/0.012));
    acc += (vec3(0.82, 0.9, 1.)*spine*knots*1.8 + vec3(0.55, 0.4, 1.)*sheath*0.4)*prof;
  }
  return acc*dt*boost*30.;
}
vec3 lobe(vec3 o, vec3 d, float sg, float tm){
  vec3 c = vec3(0., 0.83*sg, 0.);
  vec2 h = sphIsect(o, d, c, 0.21);
  if(h.y < 0.) return vec3(0.);
  float t0 = max(h.x, 0.), dt = (h.y - t0)/20.;
  float jit = hash12(gl_FragCoord.xy + 3.*sg)*dt;
  vec3 acc = vec3(0.); float T = 1.;
  vec3 hsp = vec3(0.01*sg, 0.8*sg, 0.);
  for(int i=0;i<20;i++){
    vec3 p = o + d*(t0 + jit + float(i)*dt), q = p - c;
    float r = length(q*vec3(1., 0.62, 1.) + vec3(0., 0.045*sg, 0.));
    float turb = fbmW(p*15. + vec3(0., -tm*0.12*sg, 0.));
    float dens = smoothstep(0.19, 0.02, r + (turb - 0.5)*0.16)*(0.1 + 2.2*turb*turb*turb);
    float fil = pow(ridge(p*24. + 3.), 3.)*dens;
    vec3 e = p - hsp;
    float hs = exp(-dot(e, e)/0.0003);
    vec3 col = mix(vec3(0.7, 0.28, 0.95), vec3(1., 0.55, 0.8), clamp(fil*1.5, 0., 1.))*(dens*0.7 + fil*2.) + vec3(0.95, 0.92, 1.)*hs*20.;
    acc += T*col*dt*20.;
    T *= exp(-dens*dt*0.6);
  }
  return acc;
}
void main(){
  vec3 o, d; localRay(o, d);
  float tm = uTime; vec3 col = vec3(0.); float T = 1.;
  // host: giant elliptical with a warped dust lane and teal ionisation cones along the jet axis
  float Tcore = 1.; float tcCore = -dot(o, d);
  vec2 hg = sphIsect(o, d, vec3(0.), 0.27);
  if(hg.y > 0.){
    int N = int(mix(30., 56., uLod));
    float t0 = max(hg.x, 0.), dt = (hg.y - t0)/float(N);
    float jit = hash12(gl_FragCoord.xy + 7.)*dt;
    bool passed = false;
    for(int i=0;i<56;i++){
      if(i >= N) break;
      float t = t0 + jit + dt*float(i);
      if(!passed && t > tcCore){ Tcore = T; passed = true; }
      vec3 p = o + d*t;
      float r = length(p*vec3(1., 1.3, 1.));
      float stars = exp(-3.7*(sqrt(r/0.07) - 1.))*0.012;
      float rho = length(p.xz);
      float warp = 0.006*sin(atan(p.z, p.x)*2. + rho*30.);
      float lane = exp(-abs(p.y - warp)/0.011)*smoothstep(0.018, 0.045, rho)*smoothstep(0.17, 0.09, rho);
      float dust = lane*(0.2 + 1.6*pow(fbm3(p*60. + 2.), 2.));
      float ay = abs(p.y);
      float cone = exp(-pow(rho/(ay*0.5 + 0.002), 2.))*exp(-ay/0.075)*smoothstep(0.004, 0.02, ay);
      float coneF = cone*(0.25 + 1.5*pow(fbm3(p*75. + vec3(0., -tm*0.25*sign(p.y), 0.)), 2.));
      float hii = lane*smoothstep(0.72, 0.85, noise(p*160.))*3.;
      vec3 em = vec3(1., 0.8, 0.56)*stars + vec3(0.28, 1., 0.78)*coneF*1.8 + vec3(1., 0.3, 0.35)*(coneF*0.2 + hii);
      col += T*em*dt*9.;
      T *= exp(-dust*210.*dt);
    }
    if(!passed) Tcore = T;
  }
  // parsec-scale engine: clumpy dusty torus hiding (or revealing) a turbulent accretion disk
  float Tt = 1.; vec3 tcol = vec3(0.);
  vec2 ht = sphIsect(o, d, vec3(0.), 0.05);
  if(ht.y > 0.){
    float t0 = max(ht.x, 0.), dt = (ht.y - t0)/26.;
    for(int i=0;i<26;i++){
      vec3 p = o + d*(t0 + (float(i) + 0.5)*dt);
      float rho = length(p.xz);
      float shape = exp(-(pow(rho - 0.03, 2.) + p.y*p.y*1.6)/0.00012);
      float clumps = smoothstep(0.42, 0.7, fbm3(vec3(rot2(tm*0.4/(rho*30. + 0.2))*p.xz*260., p.y*260.)));
      float dn = shape*clumps;
      float face = smoothstep(0.038, 0.02, rho);
      tcol += Tt*blackbody(1300. + 500.*face)*dn*(0.3 + 1.2*face)*dt*60.;
      Tt *= exp(-dn*1800.*dt);
    }
  }
  vec3 core = vec3(0.);
  if(abs(d.y) > 1e-6){
    float td = -o.y/d.y;
    if(td > 0.){
      vec3 q = o + d*td; float r = length(q.xz);
      if(r < 0.014 && r > 0.0008){
        float om = 3.*pow(r/0.003, -1.5);
        vec2 rq = rot2(-om*tm)*q.xz;
        float n = fbm3(vec3(rq*1400., r*900.));
        float spiral = 0.6 + 0.5*sin(atan(rq.y, rq.x)*3. + log(r)*9.);
        vec3 u = normalize(vec3(-q.z, 0., q.x));
        float dop = 1. + 0.6*dot(u, -d);
        float temp = 32000.*pow(r/0.0015, -0.75)*dop;
        core += blackbody(temp)*pow(0.0015/r, 1.6)*(0.4 + 1.2*n*spiral)*pow(dop, 3.)*4.*smoothstep(0.014, 0.008, r);
      }
    }
  }
  core += vec3(0.75, 0.87, 1.)*(pblob(o, d, vec3(0.), 0.0015)*20000. + blob(o, d, vec3(0.), 0.006)*14. + blob(o, d, vec3(0.), 0.03)*1.2);
  col += Tcore*(tcol + Tt*core);
  // relativistic jets (Doppler boosted) and radio lobes
  const float beta = 0.9, gam = 2.294;
  for(int k=0;k<2;k++){
    float sg = k == 0 ? 1. : -1.;
    float dop = 1./(gam*(1. - beta*dot(vec3(0., sg, 0.), -d)));
    col += jetH(o, d, sg, 0.8, tm, min(dop*dop/0.19, 40.));
    col += lobe(o, d, sg, tm);
  }
  outCol(col, (1. - T*Tt)*0.9);
}`;
const PB_QJET = `void body(out vec3 p, out float br, out vec3 col){
  float sg = aP.x > 0.5 ? 1. : -1.;
  float u = fract(aP.y + uT*0.04*(0.8 + 0.4*aP.z));
  float s = 0.004 + u*0.8, w = 0.0035 + 0.05*u;
  float ph = s*38. - uT*2.6*sg + aP.w*6.2832, rr = w*(0.2 + 0.9*aC.w);
  p = vec3(rr*cos(ph), s*sg, rr*sin(ph));
  float dop = 1./(2.294*(1. - 0.9*sg*uQ0.y));
  br = min(dop*dop/0.19, 40.)*smoothstep(1., 0.82, u)*(0.3 + 0.7*smoothstep(0., 0.04, u));
  col = mix(vec3(0.85, 0.92, 1.), vec3(0.62, 0.5, 1.), u);
}`;
const PB_ORBIT = `void body(out vec3 p, out float br, out vec3 col){
  float r = aP.x, a = aP.w + uT*uQ0.x*pow(r/uQ0.y, -1.5);
  vec3 q = vec3(r*cos(a), 0., r*sin(a));
  float ci = cos(aP.y), si = sin(aP.y), cn = cos(aP.z), sn = sin(aP.z);
  q = vec3(q.x, q.z*si, q.z*ci);
  p = vec3(q.x*cn - q.z*sn, q.y, q.x*sn + q.z*cn);
  br = 1.; col = aC.rgb;
}`;
P.ptQJet = program(particleVS(PB_QJET), FS_POINT);
P.ptOrbit = program(particleVS(PB_ORBIT), FS_POINT);

const quasar = (() => {
  const nStars = Math.round(7000*QUALITY), host = makePS(nStars);
  for (let i=0;i<nStars;i++){
    let p;
    if (i < nStars*0.92){ const d = randDir(), r = 0.006 + 0.2*Math.pow(rnd(), 2.1); p = [d[0]*r, d[1]*r*0.78, d[2]*r]; }
    else { const g = Math.floor(rnd()*70), gd = [Math.sin(g*2.4)*Math.cos(g*1.3), Math.cos(g*2.4)*0.8, Math.sin(g*1.3)], gr = 0.09 + 0.16*((g*0.618) % 1), e = randDir(); p = [gd[0]*gr + e[0]*0.003, gd[1]*gr + e[1]*0.003, gd[2]*gr + e[2]*0.003]; }
    const c = blackbodyJS(3900 + 1700*rnd());
    host.a.set([p[0], p[1], p[2], 0.6 + 0.8*rnd()], i*4); host.c.set([c[0], c[1], c[2], 0], i*4);
  }
  host.upload('ac');
  const nJet = Math.round(1800*QUALITY), jets = makePS(nJet);
  for (let i=0;i<nJet;i++){ jets.a.set([i % 2, rnd(), rnd(), rnd()], i*4); jets.c.set([0, 0, 0, rnd()], i*4); }
  jets.upload('ac');
  const nBlr = Math.round(700*QUALITY), blr = makePS(nBlr);
  for (let i=0;i<nBlr;i++){
    const c = rnd() < 0.5 ? [1, 0.55, 0.45] : [0.55, 0.95, 1];
    blr.a.set([0.0035 + 0.011*Math.pow(rnd(), 0.7), (rnd()*2 - 1)*1.2, rnd()*6.2832, rnd()*6.2832], i*4); blr.c.set([c[0], c[1], c[2], 0], i*4);
  }
  blr.upload('ac');
  const pos = radec(hms(12,29,6.7), dms(2,3,9), 2.44e9);
  const camLocal = () => V.norm(M3.applyT(q.R0, V.mul(q.rel, -1)));
  const q = addObj({ key:'3c273', name:'3C 273', label:'3C 273', type:'quasar · the first one ever identified (1963)', group:'galaxies', sortKey:2.44e9,
    fact:'A black hole of nearly a billion Suns feeding so fast its core outshines the whole galaxy 100 times. Its jet runs 200,000 light-years. Inner parts are drawn magnified, as the scale bar shows.',
    pos, rad:250000, R0:facingEarth(pos, V.norm([0.26, 0.97, 0]), 40), prog:program(VS_RECT, FS_QUASAR), minZoom:0.04, pxMin:6, farColor:[0.75, 0.85, 1], farLum:1.3, labelRange:3e10, aka:'quasar agn jet',
    views:[{d:[1,0.35,0.35],k:2.2,hold:7,drift:0.03},{d:[0.9,0.1,-0.42],k:0.55,hold:6,drift:0.05},{d:[0.55,0.42,0.72],k:0.1,hold:7,drift:0.12},{d:[0.32,1,0.16],k:1.7,hold:6,drift:0.03}],
    scaleKm:x => scaleBlend(x, 0.095, 0.001008*LY, 1.8, LY),
    particles:[
      {ps:host, prog:'ptBasic', mode:0, sb:0.09, size:1.3, cap:0.35},
      {ps:blr, prog:'ptOrbit', mode:1, sb:0.01, size:1.8, q0:()=>[1.2, 0.006, 0, 0]},
      {ps:jets, prog:'ptQJet', mode:1, sb:1.4, size:2, q0:()=>{ const c = camLocal(); return [c[0], c[1], c[2], 0]; }},
    ] });
  q.readout = () => {
    const c = camLocal(), b = 0.9, g = 1/Math.sqrt(1 - b*b), ct = Math.abs(c[1]);
    const up = Math.pow(1/(g*(1 - b*ct)), 2)/0.19, dn = Math.pow(1/(g*(1 + b*ct)), 2)/0.19;
    return `2.4 billion light-years · light left it before animals existed\njets at 0.90c: near jet boosted x${up.toFixed(1)}, far jet x${dn.toFixed(2)}`;
  };
  return q;
})();

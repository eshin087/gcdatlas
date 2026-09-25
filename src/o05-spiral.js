
// ================================================================ 05 spiral galaxy (Whirlpool-like, with companion)
const FS_GALAXY = COMMON + `
void main(){
  vec3 o, d; localRay(o, d);
  vec2 h = sphIsect(o, d, vec3(0.), 1.);
  if(h.y < 0.) discard;
  vec3 C = uP1.xyz;
  vec3 col = vec3(0.); float T = 1.;
  // thin disk slab
  const float H = 0.12;
  float ta = max(h.x, 0.), tb = h.y;
  if(abs(d.y) > 1e-4){ float t0 = (-H - o.y)/d.y, t1 = (H - o.y)/d.y; ta = max(ta, min(t0, t1)); tb = min(tb, max(t0, t1)); }
  else if(abs(o.y) > H) tb = ta;
  if(tb > ta){
    int N = int(mix(24., 44., uLod)); float dt = (tb - ta)/float(N);
    float jit = hash12(gl_FragCoord.xy)*dt;
    for(int i=0;i<44;i++){
      if(i >= N) break;
      vec3 p = o + d*(ta + jit + dt*float(i));
      float rho = length(p.xz), pa = atan(p.z, p.x);
      float th = rho*uP0.x + uP0.y;
      float arm = pow(0.5 + 0.5*cos(2.*(pa - th) + 1.5708), 3.);
      float disk = exp(-rho/0.36)*exp(-abs(p.y)/0.018);
      float bulge = exp(-length(p*vec3(1., 1.6, 1.))/0.06);
      float lane = pow(0.5 + 0.5*cos(2.*(pa - th) + 2.35), 9.)*(0.4 + 1.2*fbm3(p*40.));
      float dust = lane*exp(-abs(p.y)/0.007)*smoothstep(0.06, 0.18, rho)*exp(-rho/0.6);
      dust += smoothstep(0.62, 0.8, fbm3(p*55. + 3.))*exp(-abs(p.y)/0.005)*exp(-rho/0.4)*0.6;
      vec3 em = vec3(1., 0.82, 0.56)*bulge*1.1 + mix(vec3(0.95, 0.88, 0.76), vec3(0.58, 0.72, 1.), arm)*disk*(0.3 + 1.2*arm);
      em += vec3(1., 0.38, 0.62)*disk*arm*smoothstep(0.64, 0.8, noise(p*44.))*2.5;
      col += T*em*dt*1.9;
      T *= exp(-dust*60.*dt);
    }
  }
  // nucleus and companion galaxy (NGC 5195-like, crossed by dust)
  col += vec3(1., 0.9, 0.75)*(pblob(o, d, vec3(0.), 0.004)*60. + blob(o, d, vec3(0.), 0.02)*1.5);
  vec2 hc = sphIsect(o, d, C, 0.16);
  if(hc.y > 0.){
    float t0 = max(hc.x, 0.), dt = (hc.y - t0)/16.; float Tc = 1.;
    for(int i=0;i<16;i++){
      vec3 p = o + d*(t0 + (float(i) + 0.5)*dt) - C;
      float r = length(p*vec3(1., 1.25, 1.));
      float st = exp(-3.5*(sqrt(r/0.035) - 1.))*0.02;
      float du = smoothstep(0.55, 0.75, fbm3(p*45. + 1.))*exp(-abs(p.y + 0.2*p.x)/0.02)*smoothstep(0.1, 0.03, r);
      col += T*Tc*vec3(1., 0.78, 0.52)*st*dt*20.;
      Tc *= exp(-du*120.*dt);
    }
    T *= Tc;
  }
  outCol(col, (1. - T)*0.85);
}`;
const PB_SPIRAL2 = `void body(out vec3 p, out float br, out vec3 col){
  col = aC.rgb; br = 1.;
  if(aP.y < 0.){ float an = uT*0.03/(length(aP.xz) + 0.08); float c = cos(an), s = sin(an); p = vec3(aP.x*c - aP.z*s, aP.w, aP.x*s + aP.z*c); return; }
  float a = aP.x, t = aP.z + uT*0.2/(a + 0.07), th = a*uQ0.x + uQ0.y;
  vec2 q = vec2(a*cos(t), a*(1. - aP.y)*sin(t)); float c = cos(th), s = sin(th);
  p = vec3(q.x*c - q.y*s, aP.w, q.x*s + q.y*c);
  float arm = pow(0.5 - 0.5*sin(2.*t), 4.);
  if(aC.w > 1.5) br = 0.04 + 4.5*pow(arm, 1.4)*(0.75 + 0.25*sin(uT*2.3 + aP.z*40.));
  else if(aC.w > 0.5) br = 0.1 + 2.8*arm;
  else br = 0.8 + 0.6*arm;
}`;
const PB_OFFSET = `void body(out vec3 p, out float br, out vec3 col){ p = aP.xyz + uQ0.xyz; br = aP.w*uQ0.w; col = aC.rgb; }`;
P.ptSpiral2 = program(particleVS(PB_SPIRAL2), FS_POINT);
P.ptOffset = program(particleVS(PB_OFFSET), FS_POINT);

const spiral = (() => {
  const TW = 4.2, E = 0.26;
  const nDisk = Math.round(26000*QUALITY), nClump = Math.round(520*QUALITY), per = 10, nBul = Math.round(5000*QUALITY), nGlob = 90, perG = 12, nHalo = Math.round(1500*QUALITY);
  const n = nDisk + nClump*per + nBul + nGlob*perG + nHalo, ps = makePS(n); let k = 0;
  const put = (a, c) => { ps.a.set(a, k*4); ps.c.set(c, k*4); k++; };
  for (let i=0;i<nDisk;i++){
    const a = 0.07 + 0.93*Math.pow(rnd(), 0.85), e = clamp(E + 0.05*rndn(), 0.12, 0.4), young = rnd() < 0.42, q = rnd();
    const c = young ? [0.5 + 0.2*q, 0.66 + 0.14*q, 1] : [1, 0.76 + 0.12*q, 0.5 + 0.2*q];
    put([a, e, rnd()*6.2832, rndn()*0.009*(1 + a)], [c[0], c[1], c[2], young ? 1 : 0]);
  }
  for (let j=0;j<nClump;j++){
    const a0 = 0.12 + 0.86*Math.pow(rnd(), 0.8), t0 = -Math.PI/4 + (rnd() < 0.5 ? 0 : Math.PI) + rndn()*0.22, pink = rnd() < 0.62;
    for (let m=0;m<per;m++){ const c = pink ? [1, 0.36 + 0.1*rnd(), 0.66] : [0.55, 0.72, 1]; put([a0 + rndn()*0.004, E, t0 + rndn()*0.02, rndn()*0.004], [c[0], c[1], c[2], 2]); }
  }
  for (let i=0;i<nBul;i++){ const d = randDir(), r = -0.05*Math.log(1 - rnd()*0.985); const c = blackbodyJS(3700 + 1600*rnd()); put([d[0]*r, -1, d[2]*r, d[1]*r*0.62], [c[0], c[1], c[2], 0]); }
  for (let g=0;g<nGlob;g++){ const d = randDir(), r = 0.2 + 0.9*Math.pow(rnd(), 0.7), c = blackbodyJS(4200 + 900*rnd());
    for (let m=0;m<perG;m++){ const e = randDir(), s = 0.004*rnd(); put([d[0]*r + e[0]*s, -1, d[2]*r + e[2]*s, d[1]*r*0.8 + e[1]*s], [c[0], c[1], c[2], 0]); } }
  for (let i=0;i<nHalo;i++){ const d = randDir(), r = 0.15 + 1.1*Math.pow(rnd(), 0.6), c = blackbodyJS(3900 + 1500*rnd()); put([d[0]*r, -1, d[2]*r, d[1]*r*0.7], [c[0]*0.5, c[1]*0.5, c[2]*0.5, 0]); }
  ps.count = k; ps.upload('ac');
  // companion galaxy stars
  const nC = Math.round(4500*QUALITY), comp = makePS(nC);
  for (let i=0;i<nC;i++){ const d = randDir(), r = 0.004 + 0.12*Math.pow(rnd(), 2), c = blackbodyJS(3800 + 1400*rnd()); comp.a.set([d[0]*r, d[1]*r*0.8, d[2]*r, 0.7 + 0.6*rnd()], i*4); comp.c.set([c[0], c[1], c[2], 0], i*4); }
  comp.upload('ac');
  // supernova flashes somewhere in the disk
  const snPt = makePS(1), snSp = makeSpikes([{p:[0,0,0], w:1, c:[0.85, 0.9, 1]}]);
  snPt.c.set([0.9, 0.93, 1, 0], 0); snPt.upload('c');
  let snT = 2, snAmp = 0;
  const compPos = t => { const a = 1.0, pa = a*TW + t*0.03 - 0.64; return [a*Math.cos(pa), -0.05, a*Math.sin(pa)]; };
  const pos = radec(hms(13,29,52.7), dms(47,11,43), 31e6);
  const o = addObj({ key:'m51', name:'Whirlpool Galaxy', label:'M51', type:'grand-design spiral with a companion · M51', group:'galaxies', sortKey:31e6,
    fact:'The arms are a density wave that stars drift through, lighting up pink star-forming nebulae. The small galaxy NGC 5195 tugs on the end of one arm.',
    pos, rad:42000, R0:facingEarth(pos, [Math.sin(20*DEG), Math.cos(20*DEG), 0], 0), prog:program(VS_RECT, FS_GALAXY), minZoom:0.1, pxMin:7, farColor:[0.85, 0.85, 1], farLum:0.8, labelRange:1.2e8, layer:2, aka:'m51 whirlpool ngc 5194',
    views:[{d:[0,0.9,0.5],k:1.65,hold:9,drift:0.025},{d:[0.45,0.3,0.62],k:0.62,hold:8,drift:0.05},{d:[1,0.06,0.15],k:1.8,hold:7,drift:0.02},{d:[-0.2,0.95,0.3],k:0.28,hold:6,drift:0.06}],
    update(dt){
      snT -= dt;
      if (snT <= 0){ snT = 5 + rnd()*4; const a = 0.2 + 0.7*rnd(), t = rnd()*6.2832, th = a*TW + this.t*0.03, qx = a*Math.cos(t), qy = a*(1 - E)*Math.sin(t);
        const p = [qx*Math.cos(th) - qy*Math.sin(th), 0, qx*Math.sin(th) + qy*Math.cos(th)];
        snPt.a.set([p[0], p[1], p[2], 1], 0); snPt.upload('a');
        for (let v=0; v<8; v++) snSp.a.set([p[0], p[1], p[2], 1], v*4); snSp.upload('a'); this.snAge = 0; }
      this.snAge = (this.snAge || 0) + dt;
      snAmp = this.snAge < 0.25 ? this.snAge/0.25 : Math.exp(-(this.snAge - 0.25)/1.6);
      snPt.a[3] = snAmp; snPt.upload('a');
    },
    setU(pr){ const c = compPos(this.t); gl.uniform4f(pr.u.uP0, TW, this.t*0.03, 0, 0); gl.uniform4f(pr.u.uP1, c[0], c[1], c[2], 0); },
    particles:[
      {ps, prog:'ptSpiral2', mode:0, sb:0.46, size:1.5, cap:0.8, q0:()=>[TW, o.t*0.03, 0, 0]},
      {ps:comp, prog:'ptOffset', mode:0, sb:0.28, size:1.3, cap:0.8, q0:()=>{ const c = compPos(o.t); return [c[0], c[1], c[2], 1]; }},
      {ps:snPt, prog:'ptBasic', mode:1, sb:6, size:2.5, show:()=>snAmp > 0.01},
      {ps:snSp, prog:'spike', lines:true, mode:1, sb:6, size:1, len:0.045, q0:()=>[snAmp*2, 0, 0, 0], show:()=>snAmp > 0.01},
    ],
    readout:()=>`31 million light-years · 76,000 light-years across\none lap of its disk takes ~200 million years (sped up here)` });
  return o;
})();

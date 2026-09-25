
// ================================================================ 04 pulsar inside the Crab Nebula
const FS_CRAB = COMMON + `
void main(){
  vec3 o, d; localRay(o, d);
  vec3 m = normalize(uP0.xyz); float tm = uTime;
  vec3 col = vec3(0.); float T = 1.;
  const vec3 AX = vec3(0.64, 0.93, 0.68);
  vec2 h = sphIsect(o, d, vec3(0.), 0.96);
  if(h.y > 0.){
    int N = int(mix(48., 88., uLod));
    float t0 = max(h.x, 0.), dt = (h.y - t0)/float(N);
    float jit = hash12(gl_FragCoord.xy)*dt;
    for(int i=0;i<88;i++){
      if(i >= N) break;
      vec3 p = o + d*(t0 + jit + dt*float(i));
      float e = length(p/AX) + (fbm3(p*3. + 4.) - 0.5)*0.2;
      if(e > 1.06) continue;
      float cage = smoothstep(0.38, 0.8, e)*smoothstep(1.04, 0.9, e);
      float fil = (pow(ridge(p*4.6 + 1.3), 6.)*4. + pow(ridge(p*10. + 7.), 7.)*1.6)*cage;
      vec3 fcol = mix(vec3(1., 0.33, 0.2), vec3(1., 0.7, 0.34), smoothstep(0.45, 0.75, noise(p*2.5 + 9.)));
      fcol = mix(fcol, vec3(0.72, 1., 0.55), smoothstep(0.7, 0.9, noise(p*3.1 + 2.))*0.7);
      float bay = smoothstep(0.3, 0.08, length(vec2(abs(p.x) - 0.52, p.y*0.8)));
      float sf = fbm(p*3.4 + vec3(0., tm*0.02, 0.));
      float syn = smoothstep(1., 0.15, e)*exp(-e*2.2)*sf*sf*0.55*(1. - 0.85*bay);
      float rho = length(p.xz), ay = p.y;
      float tor = exp(-(pow(rho - 0.085, 2.) + pow(ay*1.8, 2.))/0.0009)*(0.5 + 0.9*noise(p*60. + tm*0.3));
      float ring = exp(-(pow(rho - 0.045, 2.) + ay*ay*6.)/0.00012);
      float wisp = exp(-ay*ay/0.0006)*smoothstep(0.03, 0.06, rho)*smoothstep(0.24, 0.12, rho)*pow(0.5 + 0.5*cos((rho - tm*0.025)*140.), 6.);
      float jw = 0.006 + 0.03*max(ay, 0.);
      float jt = exp(-(pow(p.x - 0.012*sin(ay*50. - tm*3.), 2.) + p.z*p.z)/(jw*jw))*smoothstep(0.22, 0.05, abs(ay))*smoothstep(0.004, 0.02, abs(ay))*(ay > 0. ? 1. : 0.35);
      vec3 em = fcol*fil*2.8 + vec3(0.5, 0.62, 1.)*syn + vec3(0.62, 0.74, 1.)*(tor*3. + ring*2. + wisp*1.8 + jt*2.4);
      col += T*em*dt*3.;
      T *= exp(-fil*dt*4.);
    }
  }
  float cf = uP0.w;
  col += vec3(0.75, 0.85, 1.)*(pblob(o, d, vec3(0.), 0.0012)*2000.*cf + blob(o, d, vec3(0.), 0.006)*6.*cf);
  outCol(col, 1. - T);
}`;
// striped pulsar wind: particles flung along the beam direction at the moment of emission -> a sprinkler spiral
const PB_SPRINKLE = `void body(out vec3 p, out float br, out vec3 col){
  const float life = 4.;
  float age = fract(aP.x + uT/life)*life;
  float ang = uQ0.x*(uT - age);
  vec3 m = vec3(uQ0.y*cos(ang), uQ0.z, -uQ0.y*sin(ang));
  vec3 dir = normalize(m*(aC.w > 0.5 ? 1. : -1.) + aP.yzw*0.07);
  p = dir*age*1.2;
  br = exp(-age*0.65)*smoothstep(0., 0.12, age);
  col = mix(vec3(0.9, 0.95, 1.), vec3(0.62, 0.5, 1.), age/life);
}`;
const PB_DIPOLE = `void body(out vec3 p, out float br, out vec3 col){
  float u = fract(aP.y + uT*0.12*(0.6 + aC.w));
  float th0 = asin(sqrt(min(uQ0.x/aP.x, 1.)));
  float th = mix(th0, 3.14159265 - th0, u);
  float r = aP.x*sin(th)*sin(th);
  p = uM*vec3(r*sin(th)*cos(aP.z), r*cos(th), r*sin(th)*sin(aP.z));
  br = 0.35 + 0.65*sin(u*3.14159265); col = aC.rgb;
}`;
P.ptSprinkle = program(particleVS(PB_SPRINKLE), FS_POINT);
// closed magnetic field loops as line segments (u runs from one footpoint to the other); uQ0: x star radius, y twist
const PB_LOOP = `void body(out vec3 p, out float br, out vec3 col){
  float th0 = asin(sqrt(min(uQ0.x/aP.x, 1.)));
  float th = mix(th0, 3.14159265 - th0, aP.y);
  float r = aP.x*sin(th)*sin(th);
  float phi = aP.z + uQ0.y*cos(th)*1.4;
  p = uM*vec3(r*sin(th)*cos(phi), r*cos(th), r*sin(th)*sin(phi));
  br = 0.25 + 0.4*sin(aP.y*3.14159265); col = aC.rgb*(1. + 2.*uQ0.z);
}`;
P.lnLoop = program(particleVS(PB_LOOP), FS_LINE);
function loopLines(Ls, nAz, seg, col){
  const n = Ls.length*nAz*seg*2, ps = makePS(n); let k = 0;
  for (const L of Ls) for (let a=0;a<nAz;a++) for (let j=0;j<seg;j++) for (const e of [j, j + 1]){ ps.a.set([L, e/seg, a*2*Math.PI/nAz, 0], k*4); ps.c.set([...col, 0], k*4); k++; }
  ps.upload('ac'); return ps;
}
P.ptDipole = program(particleVS(PB_DIPOLE), FS_POINT);

const crab = (() => {
  const pos = radec(hms(5,34,31.94), dms(22,0,52.2), 6500);
  const o = addObj({ key:'crab', name:'Crab Nebula', label:'Crab Nebula', type:'supernova remnant and pulsar wind nebula · M1', group:'nebulae', sortKey:6500,
    fact:'The wreck of a star seen exploding in 1054. A city-sized neutron star spinning 30 times a second at its heart powers the whole nebula.',
    pos, rad:6, R0:facingEarth(pos, V.norm([0.3, 0.15, 1]), 0), prog:program(VS_RECT, FS_CRAB), minZoom:0.02, pxMin:6, farColor:[1, 0.62, 0.45], farLum:0.55, labelRange:6e4, aka:'m1 supernova remnant pulsar',
    views:[{d:[0.3,0.15,1],k:1.9,hold:8,drift:0.03},{d:[0.5,0.38,0.78],k:0.36,hold:7,drift:0.06},{d:[-0.85,0.3,0.4],k:1.05,hold:6,drift:0.05}],
    setU(pr){ gl.uniform4f(pr.u.uP0, 0, 1, 0, 1 - crabPulsar.vis); },
    visFn:rpx => smooth(6, 15.6, rpx)*(0.04 + 0.96*smooth(0.02, 1.5, orbit.dist)),
    readout:() => 'about 11 light-years across, expanding at 1,500 km/s\nlight from it takes 6,500 years to reach us' });
  return o;
})();
// the Crab pulsar itself: a 20-km neutron star, its magnetosphere and lighthouse beams (rotation shown ~50x slower)
const FS_NEUTRON = COMMON + `
void main(){
  vec3 o, d; localRay(o, d);
  vec3 m = normalize(uP0.xyz); float Rn = uP1.x, tm = uTime;
  vec3 col = vec3(0.); float alpha = 0.;
  vec2 h = sphIsect(o, d, vec3(0.), Rn);
  if(h.x > 0.){
    vec3 n = (o + d*h.x)/Rn; float mu = max(dot(n, -d), 0.);
    float cap = pow(abs(dot(n, m)), 40.);
    float crust = 0.5 + 0.5*fbm3(n*9. + tm*0.05);
    col = blackbody(900000.)*(2.2 + 1.2*crust)*(0.6 + 0.4*mu) + vec3(0.8, 0.9, 1.)*cap*6.;
    alpha = 1.;
  }
  // radio/optical beams from the magnetic poles and the glow of the plasma around the star
  col += jet(o, d, m, uP1.y, Rn*0.6, uP1.y*0.09, 0., tm, vec3(0.85, 0.92, 1.), vec3(0.5, 0.6, 1.))*uP1.z;
  col += jet(o, d, -m, uP1.y, Rn*0.6, uP1.y*0.09, 0., tm, vec3(0.85, 0.92, 1.), vec3(0.5, 0.6, 1.))*uP1.z;
  col += vec3(0.6, 0.7, 1.)*(pblob(o, d, vec3(0.), Rn*1.2)*900. + pblob(o, d, vec3(0.), Rn*4.)*250. + blob(o, d, vec3(0.), Rn*3.)*6. + blob(o, d, vec3(0.), Rn*12.)*0.8)*(1. - alpha);
  // magnetar giant flare: a fireball of pair plasma trapped by the field, then an expanding shell
  if(uP2.x > 0.){ col += vec3(0.9, 0.85, 1.)*(blob(o, d, vec3(0.), Rn*(4. + 30.*uP2.y))*uP2.x*8. + blob(o, d, vec3(0.), uP2.y*0.6)*uP2.x*0.6); }
  outCol(col, alpha);
}`;
P.neutron = program(VS_RECT, FS_NEUTRON);
const crabPulsar = (() => {
  const OMEGA = 2*Math.PI/1.6, AL = 40*Math.PI/180, RAD = 2000*KM, RN = 12/2000;
  const nS = Math.round(2600*QUALITY), spr = makePS(nS);
  for (let i=0;i<nS;i++){ spr.a.set([rnd(), rndn(), rndn(), rndn()], i*4); spr.c.set([0, 0, 0, i % 2], i*4); }
  spr.upload('ac');
  const nF = Math.round(3200*QUALITY), fld = makePS(nF), Ls = [0.12, 0.25, 0.45, 0.72];
  for (let i=0;i<nF;i++){ fld.a.set([Ls[i % 4]*(0.98 + 0.04*rnd()), rnd(), Math.floor(rnd()*8)*0.7854 + rndn()*0.015, 0], i*4); fld.c.set([0.62, 0.52, 1, rnd()], i*4); }
  fld.upload('ac');
  const o = addObj({ key:'crabpulsar', name:'Crab Pulsar', label:'Crab Pulsar', type:'neutron star · 1.4 Suns crushed into 20 km', group:'stars', sortKey:6500.1,
    fact:'A ball of neutrons as dense as an atomic nucleus, spinning 30 times a second. Beams from its magnetic poles sweep past Earth like a lighthouse.',
    parent:crab, offset:[0, 0, 0], rad:RAD, R0:crab.R0, prog:P.neutron, minZoom:0.02, pxMin:5, noImpostor:true, labelRange:2e-6, aka:'neutron star pulsar',
    spin:0, mag:M3.I(), m:[0,1,0],
    update(){ this.spin = this.t*OMEGA; this.mag = M3.mul(M3.rotY(this.spin), M3.rotZ(-AL)); this.m = M3.apply(this.mag, [0,1,0]); },
    setU(pr){ gl.uniform4f(pr.u.uP0, this.m[0], this.m[1], this.m[2], 0); gl.uniform4f(pr.u.uP1, RN, 1.4, 12, 0); gl.uniform4f(pr.u.uP2, 0, 0, 0, 0); },
    views:[{d:[0.4, 0.3, 1], k:1.6, hold:8, drift:0.04}, {d:[0.64, 0.77, 0], k:0.25, hold:8, drift:0}, {d:[0.2, 0.05, 1], k:0.04, hold:7, drift:0.05}],
    particleVis:rpx => smooth(4, 14, rpx),
    particles:[
      {ps:spr, prog:'ptSprinkle', mode:1, sb:0.5, size:1.8, q0:()=>[OMEGA, Math.sin(AL), Math.cos(AL), 0]},
      {ps:fld, prog:'ptDipole', mode:1, sb:0.35, size:1.6, q0:()=>[RN, 0, 0, 0], mat:()=>o.mag},
      {ps:loopLines([0.12, 0.25, 0.45, 0.72], 8, 36, [0.5, 0.45, 1]), prog:'lnLoop', lines:true, mode:3, sb:0.8, size:1, q0:()=>[RN, 0, 0, 0], mat:()=>o.mag},
    ],
    readout:()=>'P = 33.7 ms (shown ~50x slower) · slowing 38 ns per day\nits spin-down powers the nebula: ~4.5x10^31 W' });
  return o;
})();

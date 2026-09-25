
// ================================================================ 08 planetary nebula (Cat's Eye-like)
const FS_PNEB = COMMON + `
void main(){
  vec3 o, d; localRay(o, d);
  float tm = uTime;
  vec3 col = vec3(0.); float T = 1.;
  vec3 teal = vec3(0.28, 0.95, 0.85), blue = vec3(0.4, 0.62, 1.), red = vec3(1., 0.3, 0.26), orange = vec3(1., 0.55, 0.3);
  // halo: onion-skin shells from mass-loss pulses every ~1,500 years, drifting outward
  vec2 hh = sphIsect(o, d, vec3(0.), 1.);
  if(hh.y < 0.) discard;
  {
    float t0 = max(hh.x, 0.), dt = (hh.y - t0)/40.;
    float jit = hash12(gl_FragCoord.xy + 1.)*dt;
    for(int i=0;i<40;i++){
      vec3 p = o + d*(t0 + jit + dt*float(i));
      float r = length(p*vec3(1., 0.94, 1.)) + (noise(p*6.) - 0.5)*0.03;
      float rings = pow(0.5 + 0.5*cos(6.2832*((r - 0.42)/0.062 - tm*0.1)), 26.)*smoothstep(0.4, 0.5, r)*smoothstep(0.99, 0.82, r);
      float halo = exp(-pow((r - 0.45)/0.2, 2.))*0.05;
      col += red*(rings*(0.35 + 0.9*noise(p*9. + 3.)) + halo)*dt*5.;
    }
  }
  // bright core: two twisted overlapping bubbles inside a knotty outer shell
  vec2 hi = sphIsect(o, d, vec3(0.), 0.42);
  if(hi.y > 0.){
    int N = int(mix(40., 70., uLod));
    float t0 = max(hi.x, 0.), dt = (hi.y - t0)/float(N);
    float jit = hash12(gl_FragCoord.xy)*dt;
    float tw = 0.05*sin(tm*0.2);
    for(int i=0;i<70;i++){
      if(i >= N) break;
      vec3 p = o + d*(t0 + jit + dt*float(i));
      vec3 q1 = vec3(rot2(0.38 + tw)*p.xy, p.z), q2 = vec3(rot2(-0.45 - tw)*p.xy, p.z);
      float e1 = length(q1/vec3(0.12, 0.22, 0.12)), e2 = length(q2/vec3(0.15, 0.19, 0.12));
      float nn = fbm3(p*18. + tm*0.03);
      float b1 = exp(-pow((e1 - 1.)/0.045, 2.)), b2 = exp(-pow((e2 - 1.)/0.06, 2.));
      float fill = exp(-e1*e1*1.3)*0.08;
      float e3 = length(p/vec3(0.25, 0.33, 0.25)) + (fbm3(p*8.) - 0.5)*0.2;
      float s3 = exp(-pow((e3 - 1.)/0.08, 2.))*(0.2 + 2.*pow(ridge(p*15. + 2.), 2.5));
      float cap = exp(-pow(length(q1 - vec3(0., 0.2*sign(q1.y), 0.))/0.05, 2.));
      vec3 em = teal*b1*(0.45 + nn)*2.6 + vec3(0.45, 0.8, 1.)*b2*(0.45 + nn)*1.8 + blue*fill + orange*s3*1.8 + red*s3*1.1 + vec3(1., 0.45, 0.35)*cap*2.5;
      col += T*em*dt*3.2;
      T *= exp(-s3*dt*3.);
    }
  }
  // fast collimated outflows (FLIERs) with knots
  vec3 ax = normalize(vec3(0.3, 1., 0.12));
  col += jet(o, d, ax, 0.44, 0.003, 0.02, 1., tm*0.7, vec3(1., 0.6, 0.4), vec3(1., 0.35, 0.3))*14.;
  col += jet(o, d, -ax, 0.44, 0.003, 0.02, 1., tm*0.7 + 2., vec3(1., 0.6, 0.4), vec3(1., 0.35, 0.3))*14.;
  col += vec3(0.7, 0.8, 1.)*(pblob(o, d, vec3(0.), 0.004)*1500. + blob(o, d, vec3(0.), 0.025)*2.5);
  outCol(col, (1. - T)*0.8);
}`;
const pneb = (() => {
  const n = Math.round(320*QUALITY), heads = makePS(n), tails = makePS(n*2);
  for (let i=0;i<n;i++){
    const d = randDir(), r = 0.29 + 0.08*rnd(), h = V.mul([d[0], d[1]*1.25, d[2]], r), t = V.mul(h, 1.18 + 0.12*rnd()), w = 0.4 + rnd();
    heads.a.set([h[0], h[1], h[2], w], i*4); heads.c.set([1, 0.72, 0.5, 0], i*4);
    tails.a.set([h[0], h[1], h[2], w*0.8], i*8); tails.c.set([1, 0.35, 0.3, 0], i*8);
    tails.a.set([t[0], t[1], t[2], 0], i*8 + 4); tails.c.set([1, 0.35, 0.3, 1], i*8 + 4);
  }
  heads.upload('ac'); tails.upload('ac');
  const pos = radec(hms(17,58,33.4), dms(66,37,59), 3300);
  return addObj({ key:'catseye', name:"Cat's Eye Nebula", label:"Cat's Eye", type:'planetary nebula · NGC 6543 · what the Sun will become', group:'nebulae', sortKey:3300,
    fact:'A dying Sun-like star puffed off a shell every ~1,500 years, leaving a bull\'s-eye of rings around twisted inner bubbles lit by its exposed hot core.',
    pos, rad:1.6, R0:facingEarth(pos, V.norm([0.15, 0.2, 1]), 0), prog:program(VS_RECT, FS_PNEB), minZoom:0.1, pxMin:6, farColor:[0.5, 0.95, 0.85], farLum:0.45, labelRange:2e4, aka:'ngc 6543 planetary nebula',
    views:[{d:[0.15,0.2,1],k:2.3,hold:9,drift:0.04},{d:[0.4,0.25,0.9],k:0.8,hold:8,drift:0.06},{d:[1,0.1,0.15],k:1.3,hold:7,drift:0.04}],
    particles:[
      {ps:heads, prog:'ptBasic', mode:1, sb:2.8, size:1.8},
      {ps:tails, prog:'lnBasic', lines:true, mode:1, sb:2.2, size:1},
    ],
    readout:()=>'central star ~80,000 K, losing mass in a 1,900 km/s wind\nteal: oxygen · red and orange: nitrogen and hydrogen' });
})();

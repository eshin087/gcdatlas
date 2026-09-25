
// ================================================================ Jupiter: belts and zones at their real latitudes, the Great Red Spot, polar cyclones, moon shadows, the Galilean moons
const FS_JUPITER = COMMON + `
const float RP = 0.9, OBL = 0.0649;
float belt(float la){   // latitude (deg) -> darkness of the cloud band
  float b = 0.;
  b += exp(-pow((la - 12.)/4.2, 2.))*1.;      // North Equatorial Belt
  b += exp(-pow((la + 13.5)/5.2, 2.))*0.95;   // South Equatorial Belt
  b += exp(-pow((la - 23.5)/2.2, 2.))*0.7;    // North Temperate Belt
  b += exp(-pow((la + 29.)/2.6, 2.))*0.6;     // South Temperate Belt
  b += exp(-pow((la - 35.)/2., 2.))*0.45 + exp(-pow((la + 37.)/2., 2.))*0.4;
  b += exp(-pow((la - 44.)/2.5, 2.))*0.35 + exp(-pow((la + 45.)/2.5, 2.))*0.35;
  b += smoothstep(50., 70., abs(la))*0.5;
  return b;
}
float wind(float la){ return 0.9*exp(-pow((la - 23.)/2., 2.)) - 0.35*exp(-pow((la - 17.)/2., 2.)) + 0.4*exp(-pow((la + 7.)/3., 2.)) + 0.4*exp(-pow((la - 7.)/3., 2.)) - 0.3*exp(-pow((la + 18.)/2., 2.)) + 0.35*exp(-pow((la + 26.)/2., 2.)); }
vec3 clouds(vec3 n, out float grs){
  float lat = asin(clamp(n.y, -1., 1.)), la = lat*57.296, lon = atan(-n.z, n.x);
  float w = wind(la);
  float ls = lon + uTime*0.012*w;
  vec3 q = vec3(cos(ls)*cos(lat), sin(lat), sin(ls)*cos(lat));
  float turb = fbm3(q*vec3(5., 22., 5.) + 2.)*2. - 1.;
  float streak = fbm(vec3(cos(ls)*4., la*0.55 + turb*0.9, sin(ls)*4.) + vec3(0., 0., uTime*0.002));
  float lw = la + turb*2.2 + (streak - 0.5)*3.;
  float b = belt(lw);
  vec3 zone = vec3(0.96, 0.91, 0.8), dark = vec3(0.62, 0.43, 0.3);
  vec3 c = mix(zone, dark, clamp(b*(0.7 + 0.6*streak), 0., 1.));
  c = mix(c, vec3(0.93, 0.8, 0.62), exp(-la*la/40.)*0.35);                     // ochre equatorial zone
  // festoons: blue-grey plumes trailing from the NEB's southern edge
  float fest = smoothstep(0.62, 0.8, noise(vec3(ls*9., la*0.9, 1.)))*exp(-pow((la - 7.)/2., 2.));
  c = mix(c, vec3(0.35, 0.42, 0.5), fest*0.6);
  // white ovals in the southern temperate belts
  float ov = smoothstep(0.83, 0.9, noise(vec3(ls*6., la*0.35, 7.)))*exp(-pow((la + 33.)/3., 2.));
  c = mix(c, vec3(1.), ov*0.8);
  // Great Red Spot: an anticyclone twice Earth's width at 22 deg S, drifting slowly against System III
  float glon = lon + uTime*0.0015 - 1.1;
  vec2 g = vec2(atan(sin(glon), cos(glon))*cos(lat)/0.19, (la + 22.4)/5.2);
  float gr = length(g);
  vec2 gs = rot2(3.2/(gr + 0.25) + uTime*0.25)*g;
  grs = smoothstep(1.05, 0.55, gr);
  float gt = fbm3(vec3(gs*2.2, 3.));
  c = mix(c, mix(vec3(0.78, 0.36, 0.2), vec3(0.9, 0.55, 0.36), gt), grs*0.92);
  c = mix(c, vec3(0.98, 0.93, 0.85), exp(-pow((gr - 1.12)/0.1, 2.))*0.5);        // the pale collar around it
  // polar cyclones (Juno): clusters of vortices around each pole
  if(abs(la) > 70.){
    vec2 pp = n.xz/max(abs(n.y), 0.2)*3.;
    float v = 0.;
    for(int k=0;k<6;k++){ float a = float(k)*1.047 + (la > 0. ? 0. : 0.5); vec2 cc = k == 5 ? vec2(0.) : 1.1*vec2(cos(a), sin(a)); vec2 dd = pp - cc; float r = length(dd); v += exp(-r*r*5.)*(0.5 + 0.5*sin(atan(dd.y, dd.x)*2. + r*14. - uTime*0.2)); }
    c = mix(c, vec3(0.5, 0.55, 0.62)*(0.7 + 0.5*v), smoothstep(70., 80., abs(la))*0.8);
  }
  return c;
}
void main(){
  vec3 o, d; localRay(o, d);
  vec3 L = normalize(uP1.xyz*uRot);
  float sq = 1./(1. - OBL);
  vec3 os = o*vec3(1., sq, 1.), ds = normalize(d*vec3(1., sq, 1.));
  vec2 h = sphIsect(os, ds, vec3(0.), RP);
  vec3 col = vec3(0.); float alpha = 0.;
  if(h.x > 0.){
    vec3 ps = os + ds*h.x, n = ps/RP, p = ps*vec3(1., 1./sq, 1.);
    vec3 nn = normalize(n*vec3(1., sq, 1.));
    float grs; vec3 base = clouds(n, grs);
    float dif = max(dot(nn, L), 0.), mu = max(dot(nn, -d), 0.);
    // shadows of the Galilean moons on the cloud tops
    float sh = 1.;
    for(int k=0;k<4;k++){
      vec4 m = k == 0 ? uP2 : (k == 1 ? uP3 : (k == 2 ? uP4 : vec4(uM0[0], uM0[1].x)));
      if(m.w <= 0.) continue;
      vec3 q = m.xyz - p; float tq = dot(q, L); if(tq <= 0.) continue;
      float dq = length(q - L*tq); sh *= smoothstep(m.w*0.8, m.w*1.25, dq);
    }
    col = base*(pow(dif, 0.9)*sh*1.3 + 0.004);
    col *= 0.78 + 0.22*pow(mu, 0.35);                                  // limb darkening
    col += vec3(0.55, 0.6, 0.8)*pow(1. - mu, 3.)*dif*0.25;            // high haze
    // ultraviolet-bright aurora ovals (shown as a violet glow on the night side)
    float al = abs(n.y), lon = atan(-n.z, n.x);
    col += vec3(0.6, 0.35, 1.)*exp(-pow((al - 0.965)/0.01, 2.))*(0.4 + 0.8*noise(vec3(lon*8., uTime*0.3, 2.)))*0.9;
    alpha = 1.;
  } else {
    float dc = length(cross(os, ds)), tc = -dot(os, ds);
    if(tc > 0.){ vec3 pc = os + ds*tc; float lit = smoothstep(-0.3, 0.2, dot(normalize(pc*vec3(1., 1./sq, 1.)), L));
      col += limbAir(os, ds, RP, 0.006, L, vec3(0.9, 0.82, 0.7), vec3(0.9, 0.6, 0.4), 0.9);
      col += vec3(0.6, 0.35, 1.)*exp(-(dc - RP)/0.012)*exp(-pow((abs(pc.y)/length(pc) - 0.95)/0.04, 2.))*0.45*(0.3 + 1.2*noise(vec3(pc*50. + uTime*0.3))); }
  }
  outCol(col, alpha);
}`;
P.jupiter = program(VS_RECT, FS_JUPITER);
const jupiter = (() => {
  const R = 71492*KM, bound = 1/0.9;
  // Io plasma torus: sulphur and oxygen ions glowing along Io's orbit
  const nT = Math.round(2600*QUALITY), torus = makePS(nT);
  for (let i=0;i<nT;i++){ const a = rnd()*6.283, r = 5.9 + rndn()*0.25, z = rndn()*0.35; torus.a.set([r*Math.cos(a)*0.9, z*0.9, r*Math.sin(a)*0.9, 0.5 + rnd()], i*4); torus.c.set([0.85, 0.4, 0.9, 0], i*4); }
  torus.upload('ac');
  const o = addObj({ key:'jupiter', name:'Jupiter', label:'Jupiter', type:'gas giant · largest planet', group:'solar', sortKey:5.2,
    fact:'Over twice the mass of all the other planets combined. The Great Red Spot is a storm wider than Earth that has raged for at least 190 years.',
    parent:sun, offset:planetPos(PLANET_EL.jupiter, JD_NOW), rad:R*bound, solid:0.9, R0:poleFrame(268.056595, 64.495303), prog:P.jupiter, minZoom:1.2, pxMin:6, farColor:[1, 0.9, 0.75], farLum:1, labelRange:2e-3,
    views:[
      {dirFn:() => sunSide(o, 0.55, 0.12), k:3, hold:9, drift:0.03},
      {dirFn:() => sunSide(o, 0.3, -0.42), k:1.55, hold:8, drift:0.02},
      {dirFn:() => sunSide(o, 1.3, 0.05), k:40, hold:9, drift:0.003},
    ],
    update(){ const jd = jdNow(); this.offset = planetPos(PLANET_EL.jupiter, jd); this.pos = V.add(this.parent.pos, this.offset); this.rot = bodyFrame(268.056595, 64.495303, 284.95 + 870.536*(jd - 2451545)); },
    setU(pr){ const L = sunDirFrom(this); gl.uniform4f(pr.u.uP1, L[0], L[1], L[2], 0);
      const ms = [io, europa, ganymede, callisto].map(m => { const c = M3.applyT(this.rot, V.mul(V.sub(m.rel, this.rel), 1/this.rad)); return [c[0], c[1], c[2], m.rad*0.9/this.rad]; });
      gl.uniform4fv(pr.u.uP2, ms[0]); gl.uniform4fv(pr.u.uP3, ms[1]); gl.uniform4fv(pr.u.uP4, ms[2]);
      gl.uniformMatrix3fv(pr.u.uM0, false, [ms[3][0], ms[3][1], ms[3][2], ms[3][3], 0, 0, 0, 0, 0]); },
    particleVis:rpx => smooth(4, 14, rpx),
    particles:[{ps:torus, prog:'ptBasic', mode:0, sb:0.012, size:1.2, cap:0.5, rot:() => o.R0}],
    readout:() => orbit.dist/o.rad > 12 ? 'the four Galilean moons, found by Galileo in 1610\nIo whips around in 1.8 days, Callisto takes 16.7' : 'radius 71,492 km · a day lasts 9 h 56 min\nwinds up to 600 km/h between the bands' });
  return o;
})();
jupiter.bodyFrac = 0.9;
const galilean = (key, name, kind, R, a, L0, n, fact, readout, extra = {}) => addBody(Object.assign({ key, name, type:'moon of Jupiter', parent:jupiter, moonOf:jupiter, R, a, L0, n, kind,
  pole:[268.05, 64.50], W:[L0 + 180, n], shadowOf:jupiter, farLum:0.5, labelRange:0.0005, sortKey:5.2 + a*1e-9, fact, readout:() => readout, minZoom:1.2,
  views:[{dirFn:() => sunSide(BYKEY[key], 0.4, 0.15), k:3.2, hold:8, drift:0.03}, {dirFn:() => sunSide(BYKEY[key], 1.6, 0.1), k:1.9, hold:7, drift:0.03}] }, extra));
const io = galilean('io', 'Io', 7, 1821.6, 421700, 106.07719, 203.488955790,
  'The most volcanic world known. Tidal squeezing by Jupiter melts its interior, feeding hundreds of volcanoes and lava lakes.',
  'radius 1,822 km · 400 active volcanoes\nplumes of sulphur rise 400 km into space');
const europa = galilean('europa', 'Europa', 8, 1560.8, 671034, 175.73161, 101.374724735,
  'A shell of ice cracked into long red streaks, floating on a global ocean holding twice the water of Earth\'s seas.',
  'radius 1,561 km · ice shell 15 to 25 km thick\none of the best places to look for life');
const ganymede = galilean('ganymede', 'Ganymede', 9, 2634.1, 1070412, 120.55883, 50.317609207,
  'The largest moon in the Solar System, bigger than Mercury, with its own magnetic field and a buried salty ocean.',
  'radius 2,634 km · larger than the planet Mercury\nthe only moon with its own magnetosphere', { atlas:false });
const callisto = galilean('callisto', 'Callisto', 10, 2410.3, 1882709, 84.44459, 21.571071177,
  'An ancient, dark surface saturated with craters: one of the least changed worlds in the Solar System.',
  'radius 2,410 km · the most heavily cratered surface known', { atlas:false });


// ================================================================ 10 ringed planet (Saturn) with moons at true distances
const FS_PLANET = COMMON + `
const float RP = 0.38;
float ringOp(float rr){
  float o = 0.;
  o += smoothstep(1.24, 1.27, rr)*smoothstep(1.53, 1.5, rr)*(0.1 + 0.08*step(0.5, fract(rr*18.)));
  o += smoothstep(1.52, 1.57, rr)*smoothstep(1.95, 1.93, rr)*(0.7 + 0.15*sin(rr*95.) + 0.08*sin(rr*211.));
  o += smoothstep(2.02, 2.05, rr)*smoothstep(2.27, 2.25, rr)*0.55*(1. - 0.95*exp(-pow((rr - 2.214)/0.005, 2.)))*(1. - 0.9*exp(-pow((rr - 2.265)/0.002, 2.)));
  o += exp(-pow((rr - 2.33)/0.004, 2.))*0.5;
  o *= 0.78 + 0.4*noise(vec3(rr*170., 1.3, 2.7));
  return clamp(o, 0., 0.96);
}
vec3 ringCol(float rr){ return mix(vec3(0.6, 0.54, 0.46), vec3(0.94, 0.86, 0.72), smoothstep(1.5, 2.05, rr))*(0.85 + 0.3*noise(vec3(rr*60., 5., 1.))); }
vec3 planetCol(vec3 n, out float storm){
  float lat = n.y, cl = sqrt(max(1. - lat*lat, 0.)), lon = atan(n.z, n.x);
  float lw = lon + uTime*0.035*cos(lat*9.);
  vec3 sp = vec3(cos(lw)*cl, lat, sin(lw)*cl);
  float turb = fbm3(sp*vec3(4., 16., 4.) + 3.);
  float fest = fbm3(sp*vec3(9., 44., 9.) + 7.);
  float bands = sin(lat*23. + turb*2.4)*0.5 + 0.5;
  float fine = sin(lat*63. + fest*4.)*0.5 + 0.5;
  vec3 c = mix(vec3(0.78, 0.63, 0.42), vec3(0.98, 0.9, 0.72), bands);
  c = mix(c, vec3(0.62, 0.48, 0.33), fine*0.28);
  c = mix(c, vec3(0.9, 0.85, 0.72), smoothstep(0.62, 0.8, fest)*0.4);
  c = mix(c, vec3(0.55, 0.62, 0.68), smoothstep(0.6, 0.9, abs(lat))*0.45);
  // great white spot: a swirling storm drifting at its own rate
  float slon = lon - 1.2;
  vec2 q = vec2(atan(sin(slon), cos(slon)), (lat - 0.5)*3.2);
  float sr = length(q);
  vec2 qs = rot2(4./(sr + 0.15) - uTime*0.4)*q;
  storm = smoothstep(0.34, 0.05, sr)*(0.55 + 0.6*fbm3(vec3(qs*9., 1.)));
  c = mix(c, vec3(1., 0.98, 0.92), storm);
  // polar hexagon and vortex eye
  if(lat > 0.85){
    float ang = mod(lon, 1.0471976) - 0.5235988, hexR = 0.2/cos(ang);
    c = mix(c, vec3(0.42, 0.52, 0.6), smoothstep(0.025, 0., abs(cl - hexR))*0.75 + smoothstep(hexR, hexR*0.5, cl)*0.3);
    c = mix(c, vec3(0.25, 0.3, 0.38), smoothstep(0.045, 0.015, cl)*0.8);
  }
  return c;
}
void main(){
  vec3 o, d; localRay(o, d);
  vec3 L = normalize(uP1.xyz*uRot);
  vec2 hs = sphIsect(o, d, vec3(0.), RP);
  bool hitP = hs.x > 0.;
  vec3 col = vec3(0.); float alpha = 0.;
  float fwd = pow(max(dot(d, L), 0.), 10.);
  vec3 aur = vec3(0.35, 1., 0.8), aur2 = vec3(0.7, 0.4, 1.);
  if(hitP){
    vec3 p = o + d*hs.x, n = p/RP;
    float dif = max(dot(n, L), 0.), sh = 1.;
    if(abs(L.y) > 1e-3){ float tr = -p.y/L.y; if(tr > 0.){ vec3 q = p + L*tr; sh = 1. - ringOp(length(q.xz)/RP)*0.9; } }
    float storm; vec3 base = planetCol(n, storm);
    float mu = max(dot(n, -d), 0.);
    col = base*(dif*sh*1.2 + 0.01);
    col += base*0.06*max(-dot(n, L), 0.)*smoothstep(0., 0.4, abs(n.y));
    col += vec3(0.95, 0.85, 0.65)*pow(1. - mu, 4.)*dif*0.35;
    float al = abs(n.y), lon = atan(n.z, n.x);
    float band = exp(-pow((al - 0.955)/0.012, 2.))*(0.4 + 0.9*noise(vec3(lon*9. + uTime*0.6, al*40., uTime*0.3)));
    col += mix(aur, aur2, noise(vec3(lon*3., uTime*0.2, 1.)))*band*(0.3 + 0.9*smoothstep(0.2, -0.2, dot(n, L)))*0.9;
    alpha = 1.;
  } else {
    float dc = length(cross(o, d)), tc = -dot(o, d);
    if(tc > 0. && dc > RP){
      col += limbAir(o, d, RP, 0.007, L, vec3(1., 0.86, 0.66), vec3(1., 0.6, 0.35), 0.85);
      vec3 pc = o + d*tc; float al = abs(pc.y)/length(pc);
      col += mix(aur, aur2, 0.4)*exp(-(dc - RP*1.015)/0.01)*exp(-pow((al - 0.95)/0.04, 2.))*(0.6 + 0.6*noise(vec3(pc*60. + uTime*0.4)))*0.9;
    }
  }
  if(abs(d.y) > 1e-5){
    float tr = -o.y/d.y;
    if(tr > 0.){
      vec3 q = o + d*tr; float rr = length(q.xz)/RP, op = ringOp(rr);
      if(op > 0.001 && (!hitP || tr < hs.x)){
        float ang = atan(q.z, q.x) - uTime*0.16;
        float spoke = smoothstep(0.66, 0.84, noise(vec3(cos(ang)*7., sin(ang)*7., rr*3. + uTime*0.05)))*smoothstep(1.6, 1.7, rr)*smoothstep(1.92, 1.82, rr);
        vec2 ps = sphIsect(q, L, vec3(0.), RP);
        float shd = ps.y > 0. ? 0.04 : 1.;
        bool same = o.y*L.y > 0.;
        float lit = same ? (0.3 + 0.8*sqrt(abs(L.y))) : ((1. - op)*op*3.*sqrt(abs(L.y)) + 0.02);
        lit += (1. - op*0.6)*fwd*2.5;
        vec3 rc = ringCol(rr)*lit*shd*(1. - 0.45*spoke);
        col = rc*op + col*(1. - op); alpha = max(alpha, op);
      }
    }
  }
  outCol(col, alpha);
}`;
const PB_RING = `void body(out vec3 p, out float br, out vec3 col){
  float r = aP.x, a = aP.y + uT*0.5*pow(r/1.5, -1.5);
  p = vec3(r*0.38*cos(a), aP.z, r*0.38*sin(a));
  br = 1.; col = aC.rgb;
}`;
P.ptRing = program(particleVS(PB_RING), FS_POINT);

const saturn = (() => {
  const RPL = 0.38, R = 58232*KM;
  const prof = rr => (rr > 1.24 && rr < 1.53 ? 0.15 : 0) + (rr > 1.53 && rr < 1.95 ? 0.8 : 0) + (rr > 2.03 && rr < 2.27 && Math.abs(rr - 2.214) > 0.006 ? 0.55 : 0) + (Math.abs(rr - 2.33) < 0.006 ? 0.5 : 0);
  const nR = Math.round(16000*QUALITY), ring = makePS(nR); let k = 0;
  while (k < nR){ const rr = 1.24 + rnd()*1.1; if (rnd() > prof(rr)) continue; const g = 0.7 + 0.3*rnd(); ring.a.set([rr, rnd()*6.2832, rndn()*0.0006, 1], k*4); ring.c.set([0.95*g, 0.88*g, 0.76*g, 0], k*4); k++; }
  ring.upload('ac');
  const o = addObj({ key:'saturn', name:'Saturn', label:'Saturn', type:'gas giant · the ringed planet', group:'solar', sortKey:9.5,
    fact:'Its icy rings span 20 Earths yet are about 10 metres thick. Titan, bigger than Mercury, circles far outside them wrapped in orange haze.',
    parent:sun, offset:planetPos(PLANET_EL.saturn, JD_NOW), rad:R/RPL, solid:RPL, R0:poleFrame(40.589, 83.537), prog:program(VS_RECT, FS_PLANET), minZoom:0.02, pxMin:6, farColor:[1, 0.92, 0.72], farLum:0.8, labelRange:2e-3,
    views:[
      {dirFn:() => sunSide(o, 0.45, 0.28), k:2.1, hold:8, drift:0.04},
      {d:[0.25, 0.07, -1], k:0.05, off:[0.6, 0, 0.3], hold:8, drift:0.004},
      {dirFn:() => sunSide(o, 2.9, 0.3), k:2.7, hold:7, drift:0.02},
      sunBack('saturn', 5, 0.34),
    ],
    update(){ const jd = jdNow(); this.offset = planetPos(PLANET_EL.saturn, jd); this.pos = V.add(this.parent.pos, this.offset); this.rot = bodyFrame(40.589, 83.537, 38.90 + 810.7939024*(jd - 2451545)); },
    setU(pr){ const L = sunDirFrom(this); gl.uniform4f(pr.u.uP1, L[0], L[1], L[2], 0); },
    particles:[{ps:ring, prog:'ptRing', mode:2, sb:0.0025, size:0.0016, rot:() => o.R0}],
    readout:() => orbit.dist/o.rad < 0.2 ? 'inside the rings: countless chunks of water ice\nfrom dust grains to boulders the size of houses' : 'rings reach 137,000 km from the centre, ~10 m thick\nwinds up to 1,800 km/h · hexagon storm at the north pole' });
  o.bodyFrac = RPL;
  return o;
})();
const saturnMoon = (key, name, kind, R, a, P, ph, fact, readout, extra = {}) => addBody(Object.assign({ key, name, type:'moon of Saturn', parent:saturn, moonOf:saturn, R, a, L0:ph, n:360/P, kind,
  pole:[40.589, 83.537], W:[ph + 180, 360/P], shadowOf:saturn, farLum:0.45, labelRange:0.0004, sortKey:9.5 + a*1e-9, fact, readout:() => readout, atlas:false, minZoom:1.2,
  views:[{dirFn:() => sunSide(BYKEY[key], 0.4, 0.15), k:3.2, hold:8, drift:0.03}, {dirFn:() => sunSide(BYKEY[key], 1.5, 0.1), k:1.9, hold:7, drift:0.03}] }, extra));
const titan = saturnMoon('titan', 'Titan', 11, 2574.7, 1221870, 15.945, 40, 'Bigger than Mercury and wrapped in a thick orange haze. Beneath it lie lakes and seas of liquid methane, rain and rivers: the only other world with standing liquid on its surface.',
  'thick nitrogen atmosphere, 1.5x Earth\'s surface pressure\nlakes of liquid methane and ethane at -179 °C', { atlas:true,
  views:[{dirFn:() => sunSide(titan, 0.5, 0.15), k:3.2, hold:8, drift:0.03}, {dirFn:() => { const u = V.norm(V.mul(titan.offset, -1)), L = sunDirFrom(titan), pp = V.norm(V.sub(L, V.mul(u, V.dot(L, u)))); return V.norm(V.add(V.mul(u, -Math.cos(0.36)), V.mul(pp, Math.sin(0.36)))); }, k:7, hold:9, drift:0}] });
const enceladus = saturnMoon('enceladus', 'Enceladus', 12, 252.1, 237948, 1.370218, 200, 'A small, brilliant ice moon whose south pole sprays geysers of salty water from an ocean below into space, feeding Saturn\'s E ring.',
  'radius 252 km · reflects 99% of sunlight\ngeysers of water vapour from its tiger stripes', { atlas:true });
saturnMoon('mimas', 'Mimas', 13, 198.2, 185539, 0.942422, 120, 'A small icy moon with one giant crater that makes it look like the Death Star.', 'radius 198 km');
saturnMoon('tethys', 'Tethys', 13, 531.1, 294619, 1.887802, 300, 'An icy moon scarred by the huge Ithaca Chasma canyon.', 'radius 531 km');
saturnMoon('dione', 'Dione', 13, 561.4, 377396, 2.736915, 70, 'Icy moon with bright ice cliffs on its trailing side.', 'radius 561 km');
saturnMoon('rhea', 'Rhea', 13, 763.8, 527108, 4.518212, 160, 'Saturn\'s second-largest moon, a cold ball of ice and rock.', 'radius 764 km');

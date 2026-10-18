
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
// the planet is drawn display-referred, like the Solar System's bodies in FS_PLANETG: colours are what a cell shows in full sunlight after
// FS_CELL's tone map, and main undoes that map, so the pale zones and darker belts land on different characters
vec3 unTone(vec3 c){ return -log(1. - clamp(c, 0., 0.985)); }
// darkness of the cloud belts at a latitude (degrees), after Cassini's pictures: the equatorial belts either side of the bright equatorial zone,
// the temperate belts, fainter bands towards the poles
float sbelt(float la){
  float b = exp(-pow((la - 14.)/4.5, 2.))*0.9 + exp(-pow((la + 15.)/5., 2.))*0.85;
  b += exp(-pow((la - 36.)/3., 2.))*0.65 + exp(-pow((la + 36.)/3., 2.))*0.6;
  b += exp(-pow((la - 47.)/2.2, 2.))*0.45 + exp(-pow((la + 46.)/2.2, 2.))*0.4;
  b += exp(-pow((la - 55.)/2., 2.))*0.35 + exp(-pow((la + 55.)/2., 2.))*0.3 + exp(-pow((la - 63.)/2., 2.))*0.3 + exp(-pow((la + 63.)/2., 2.))*0.3;
  b += (exp(-pow((la - 4.)/1.2, 2.)) + exp(-pow((la + 4.)/1.2, 2.)))*0.25;
  return b;
}
vec3 planetCol(vec3 n, out float storm){
  float lat = n.y, cl = sqrt(max(1. - lat*lat, 0.)), lon = atan(n.z, n.x), la = degrees(asin(clamp(lat, -1., 1.)));
  float lw = lon + uTime*0.035*cos(lat*9.);
  vec3 sp = vec3(cos(lw)*cl, lat, sin(lw)*cl);
  float turb = fbm3(sp*vec3(4., 16., 4.) + 3.);
  float fest = fbm3(sp*vec3(9., 44., 9.) + 7.);
  float b = sbelt(la + (turb - 0.5)*3. + (fest - 0.5)*1.5);
  // butterscotch zones, tan belts, the bright equatorial zone, a cooler grey round the north pole and a warmer one round the south
  vec3 c = mix(vec3(0.76, 0.68, 0.5), vec3(0.58, 0.46, 0.31), clamp(b*(0.8 + 0.5*fest), 0., 1.));
  c = mix(c, vec3(0.82, 0.75, 0.57), exp(-la*la/60.)*0.6);
  c = mix(c, vec3(0.55, 0.57, 0.56), smoothstep(60., 72., la)*0.8);
  c = mix(c, vec3(0.6, 0.54, 0.44), smoothstep(-60., -72., la)*0.6);
  c *= 0.93 + 0.14*fest;
  // small white storms in the "storm alley" near 35 deg S
  storm = smoothstep(0.8, 0.9, noise(vec3(lw*6., la*0.4, 4.)))*exp(-pow((la + 35.)/2.5, 2.));
  c = mix(c, vec3(0.86, 0.84, 0.78), storm*0.8);
  // the hexagon: a jet stream round the north pole whose six straight sides lie near 78 deg N; a dark vortex at each pole
  if(lat > 0.85){
    float ang = mod(lon, 1.0471976) - 0.5235988, hexR = 0.2/cos(ang);
    c = mix(c, vec3(0.5, 0.54, 0.58), smoothstep(hexR, hexR*0.8, cl)*0.5);
    c = mix(c, vec3(0.36, 0.4, 0.46), smoothstep(0.035, 0.005, abs(cl - hexR))*0.85);
    c = mix(c, vec3(0.24, 0.27, 0.32), smoothstep(0.05, 0.015, cl)*0.85);
  }
  return mix(c, vec3(0.3, 0.27, 0.24), smoothstep(0.05, 0.015, cl)*step(lat, 0.)*0.8);
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
    // the light rises quickly past the line between day and night and stays nearly level across the lit side, darkening towards the edge
    float lam = (1. - exp(-dif*3.6))/(1. - exp(-3.6))*(0.6 + 0.4*sqrt(mu));
    col = unTone(base*lam*sh);
    col += base*0.06*max(-dot(n, L), 0.)*smoothstep(0., 0.4, abs(n.y));
    col += vec3(0.95, 0.85, 0.65)*pow(1. - mu, 4.)*dif*0.2;
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
      // (from the side of the rings the Sun lights: from the other side they are dark; the Sun crosses the ring plane every 15 years)
      {dirFn:() => sunSide(o, 0.45, M3.applyT(o.R0, sunDirFrom(o))[1] < 0 ? -0.28 : 0.28), k:2.1, hold:8, drift:0.04},
      {d:[0.25, 0.07, -1], k:0.05, off:[0.6, 0, 0.3], hold:8, drift:0.004},
      {dirFn:() => sunSide(o, 2.9, 0.3), k:2.7, hold:7, drift:0.02},
      sunBack('saturn', 5, 0.34),
    ],
    // (tours skip the night side and the view back at the Sun: a thin crescent and a dark disc, they looked empty.
    // The numbers count the flyby, which z8-flybys.js puts in as the second angle: 0 day side, 1 flyby, 2 inside the rings)
    tourViews:[0, 1, 2],
    update(){ const jd = jdNow(); this.offset = planetPos(PLANET_EL.saturn, jd); this.pos = V.add(this.parent.pos, this.offset); this.rot = bodyFrame(40.589, 83.537, 38.90 + 810.7939024*(jd - 2451545)); },
    setU(pr){ const L = sunDirFrom(this); gl.uniform4f(pr.u.uP1, L[0], L[1], L[2], 0); },
    particles:[{ps:ring, prog:'ptRing', mode:2, sb:0.0025, size:0.0016, rot:() => o.R0}],
    readout:() => viewDist()/o.rad < 0.2 ? 'inside the rings: countless chunks of water ice\nfrom dust grains to boulders the size of houses' : 'rings reach 137,000 km from the centre, ~10 m thick\nwinds up to 1,800 km/h · hexagon storm at the north pole' });
  o.bodyFrac = RPL;
  return o;
})();
const saturnMoon = (key, name, kind, R, a, P, ph, fact, readout, extra = {}) => addBody(Object.assign({ key, name, type:'moon of Saturn', tags:['moons'], parent:saturn, moonOf:saturn, R, a, L0:ph, n:360/P, kind,
  pole:[40.589, 83.537], W:[ph + 180, 360/P], shadowOf:saturn, farLum:0.45, labelRange:0.0004, sortKey:9.5 + a*1e-9, fact, readout:() => readout, atlas:false, minZoom:1.2,
  views:[{dirFn:() => sunSide(BYKEY[key], 0.4, 0.15), k:3.2, hold:8, drift:0.03}, {dirFn:() => sunSide(BYKEY[key], 1.5, 0.1), k:1.9, hold:7, drift:0.03}] }, extra));
const titan = saturnMoon('titan', 'Titan', 11, 2574.7, 1221870, 15.945, 40, 'Bigger than Mercury and wrapped in a thick orange haze. Beneath it lie lakes and seas of liquid methane, rain and rivers: the only other world with standing liquid on its surface.',
  'thick nitrogen atmosphere, 1.5x Earth\'s surface pressure\nlakes of liquid methane and ethane at -179 °C', { atlas:true,
  views:[{dirFn:() => sunSide(titan, 0.5, 0.15), k:3.2, hold:8, drift:0.03}, {dirFn:() => { const u = V.norm(V.mul(titan.offset, -1)), L = sunDirFrom(titan), pp = V.norm(V.sub(L, V.mul(u, V.dot(L, u)))); return V.norm(V.add(V.mul(u, -Math.cos(0.36)), V.mul(pp, Math.sin(0.36)))); }, k:7, hold:9, drift:0}] });
const enceladus = saturnMoon('enceladus', 'Enceladus', 12, 252.1, 237948, 1.370218, 200, 'A small, brilliant ice moon whose south pole sprays geysers of salty water from an ocean below into space, feeding Saturn\'s E ring.',
  'radius 252 km · reflects 99% of sunlight\ngeysers of water vapour from its tiger stripes', { atlas:true });
// Mimas and its giant crater Herschel (drawn with its real relief: kind 24 in FS_PLANETG). Herschel is on the side Mimas leads with, so it is
// in sunlight for half of each 22.6-hour orbit (about 68 s at the default clock)
const herschelDir = () => M3.apply(BYKEY.mimas.rot, [-0.37061, -0.02408, 0.92848]);
// in Saturn's shadow: for about three and a half years either side of each Saturn equinox (about seven years in all; the last equinox was
// in May 2025, so until about 2028) Mimas passes through it every orbit, and is dark for up to about two hours (about 13 s at the default clock).
// (Where Mimas is along its orbit is not its real place, so neither are the times it goes dark: see ACCURACY.md)
const mimasDark = () => { const s = mimas.offset, u = V.norm(saturn.pos), along = V.dot(s, u); return along > 0 && V.len(V.sub(s, V.mul(u, along))) < 58232*KM; };
const herschelLit = () => V.dot(herschelDir(), sunDirFrom(mimas)) > 0.1;
// Herschel's angle. In sunlight it looks down on the crater from a little to the south, so it sits high on the disc like the Death Star's dish,
// and from a little away from the Sun while the Sun is low over it, so the rim and peak cast their shadows. While Herschel is in the night the
// camera looks at the moon from its far side from Saturn, so the lit moon often has Saturn and its rings behind it.
function herschelView(){
  const h = herschelDir(), L = sunDirFrom(mimas), hL = V.dot(h, L), S = M3.apply(mimas.R0, [0, -1, 0]);
  if (hL > 0.03){ const hi = smooth(0.3, 0.9, hL); return V.norm(V.add(V.add(h, V.mul(L, -0.45*(1 - hi))), V.mul(S, 0.3 + 0.2*hi))); }
  const u = V.norm(mimas.offset), side = V.norm(V.sub(u, V.mul(L, V.dot(u, L))));   // (away from Saturn, square to the sunlight: the moon is then about three quarters lit)
  return V.norm(V.add(V.add(side, V.mul(L, 0.6)), V.mul(S, -0.12)));
}
// an angle of Mimas: in Saturn's shadow every angle pulls back and looks past the dark moon at Saturn, outlined by sunlight coming through its air.
// (state: the angle loop glides to the new framing when the moon goes into the shadow or comes out of it mid-angle, see 08-camera.js;
// the crater angle is also only ready while Herschel is in sunlight, so the loop skips it while the crater is in the night)
const mimasView = (f, k, hold, drift, x = {}) => Object.assign({ dirFn:() => mimasDark() ? V.norm(V.add(V.norm(mimas.offset), V.mul(M3.apply(mimas.R0, [0, 1, 0]), 0.1))) : f(),
  get k(){ return mimasDark() ? 14 : k; }, hold, drift, state:() => mimasDark() }, x);
const mimas = saturnMoon('mimas', 'Mimas', 24, 198.2, 185539, 0.942422, 120,
  'A ball of ice 396 km across with one enormous crater, Herschel, 130 km wide: about a third of the moon\'s own width. Its walls rise about 5 km and a peak 6 km high stands in the middle, which is why Mimas looks like the Death Star from Star Wars.',
  '396 km across · Herschel is 130 km wide\nits walls rise about 5 km; its central peak stands 6 km tall', { atlas:true, type:'moon of Saturn · the one with the giant crater', aka:'mimas death star herschel crater saturn moon',
  views:[mimasView(() => sunSide(mimas, 0.35, 0.15), 3.2, 8, 0.03),
    mimasView(herschelView, 2.7, 9, 0.01, { ready:() => mimasDark() || herschelLit(), state:() => mimasDark() ? 2 : herschelLit() ? 1 : 0 }),
    mimasView(() => sunSide(mimas, 1.45, 0.12), 2.3, 8, 0.02)],
  readout:() => '396 km across · Herschel is 130 km wide\n' + (mimasDark() ? 'passing through Saturn\'s shadow: the Sun is behind Saturn' :
    V.dot(herschelDir(), sunDirFrom(mimas)) < 0.03 ? 'Herschel is turned away from the Sun; it is lit for half of each orbit' : 'its walls rise about 5 km; its central peak stands 6 km tall') });
// Tethys, Dione and Rhea at their real places along their orbits: mean longitudes fitted to JPL's ephemeris (SAT441 through Horizons, 1980 to
// 2050, within 0.3 deg), counted in Saturn's equator from its node on the Earth's equator, as bodyFrame counts. (JPL's table of mean elements gives
// these three phases that match 1950, not the 2000 it states.) Tethys swings 2.1 deg either way over 71 years, its resonance with Mimas (dL). Each turns so its
// prime meridian is where the IAU's rotation model puts it (the point under Saturn 0.6, 0.8 and 2.9 deg west of it), so the features drawn from the
// IAU gazetteer (kinds 25 to 27 in FS_PLANETG) face the right way, and the moons pass through Saturn's shadow at the real times.
const satDark = o => { const s = o.offset, u = V.norm(saturn.pos), along = V.dot(s, u); return along > 0 && V.len(V.sub(s, V.mul(u, along))) < 58232*KM; };
// a direction on a moon from latitude and east longitude (degrees), in the world, as sph() in FS_PLANETG
const featAt = (o, la, lo) => M3.apply(o.rot, [Math.cos(la*DEG)*Math.cos(lo*DEG), Math.sin(la*DEG), -Math.cos(la*DEG)*Math.sin(lo*DEG)]);
const featLit = (o, la, lo) => V.dot(featAt(o, la, lo), sunDirFrom(o)) > 0.3;
// a moon's angle, as Mimas's are: in Saturn's shadow every angle pulls back and looks past the dark moon at Saturn. With a feature (la, lo), it looks
// down on it, a little from the Sun's side, and is only ready while the Sun is at least 17 degrees up over the feature
function satView(key, f, k, hold, drift, ft){
  const o = () => BYKEY[key], v = { dirFn:() => satDark(o()) ? V.norm(V.add(V.norm(o().offset), V.mul(M3.apply(o().R0, [0, 1, 0]), 0.1))) :
    ft ? V.norm(V.add(featAt(o(), ft[0], ft[1]), V.mul(sunDirFrom(o()), 0.15))) : f(o()), get k(){ return satDark(o()) ? 14 : k; }, hold, drift, state:() => satDark(o()) };
  if (ft) Object.assign(v, { ready:() => satDark(o()) || featLit(o(), ft[0], ft[1]), state:() => satDark(o()) ? 2 : featLit(o(), ft[0], ft[1]) ? 1 : 0 });
  return v;
}
const satLine = (o, s) => satDark(o) ? 'passing through Saturn\'s shadow: the Sun is behind Saturn' : s;
const tethys = saturnMoon('tethys', 'Tethys', 25, 531.1, 294619, 360/190.6979072, 188.411,
  'A moon 1,062 km across made almost entirely of water ice: its density, 0.98 g/cm³, is just under water\'s. Ithaca Chasma, a canyon up to 100 km wide and about 3 km deep, runs some 2,000 km across it, and the crater Odysseus is 445 km wide, more than two fifths of the moon\'s width.', '', { atlas:true, type:'moon of Saturn · almost pure ice', aka:'tethys ithaca chasma odysseus saturn moon',
  dL:jd => { const S5 = (316.45 + 506.2*(jd - 2451545)/36525)*DEG; return 2.109*Math.sin(S5) + 0.166*Math.cos(S5); }, W:[188.411 + 180.6, 190.6979072],
  views:[satView('tethys', o => sunSide(o, 0.4, 0.15), 3.2, 8, 0.03), satView('tethys', null, 2.6, 9, 0.01, [32.82, -128.89]), satView('tethys', null, 2.6, 9, 0.01, [-3, -1])],
  readout:() => '1,062 km across · density 0.98 g/cm³, nearly pure ice\n' + satLine(tethys, 'the dark band on the side it leads with comes from fast electrons in Saturn\'s magnetic field') });
const dione = saturnMoon('dione', 'Dione', 26, 561.4, 377396, 360/131.5349304, 176.916,
  'An icy moon 1,123 km across. Its darker trailing side is streaked with bright cliffs of ice, some of them hundreds of metres high, the walls of canyons where the dark surface material has fallen off; its gravity and shape suggest an ocean about 65 km deep under 100 km of ice.', '', { atlas:true, type:'moon of Saturn · with cliffs of bright ice', aka:'dione wispy terrain ice cliffs saturn moon', W:[176.916 + 180.8, 131.5349304],
  views:[satView('dione', o => sunSide(o, 0.4, 0.15), 3.2, 8, 0.03), satView('dione', null, 2.5, 9, 0.01, [5, -290]), satView('dione', o => sunSide(o, 1.45, 0.12), 2.3, 8, 0.02)],
  readout:() => '1,123 km across · density 1.48 g/cm³, ice and rock\n' + satLine(dione, 'its leading side is 1.6 times as bright as its trailing side') });
const rhea = saturnMoon('rhea', 'Rhea', 27, 763.5, 527108, 360/79.6900458, 52.177,
  'Saturn\'s second-largest moon, 1,527 km across, about three quarters ice and one quarter rock. In 2010 Cassini flew through a whisper of oxygen and carbon dioxide around it, the first oxygen atmosphere sampled directly at a world other than Earth.', '', { atlas:true, type:'moon of Saturn · the second-largest', aka:'rhea inktomi tirawa saturn moon', W:[52.177 + 182.85, 79.6900458],
  views:[satView('rhea', o => sunSide(o, 0.4, 0.15), 3.2, 8, 0.03), satView('rhea', null, 2.5, 9, 0.01, [-14.1, -112.1]), satView('rhea', null, 2.5, 9, 0.01, [10, -280])],
  readout:() => '1,527 km across · orbit 4.5 days, 527,000 km from Saturn\n' + satLine(rhea, 'Inktomi: a young crater 47 km wide with rays hundreds of km long') });

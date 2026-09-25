
// ================================================================ our own travellers: the Voyagers, New Horizons and the James Webb Space Telescope, at their real positions
// uP0.x: 0 = Voyager-style probe (dish, bus, booms), 1 = JWST (gold mirror over a five-layer sunshield), 2 = New Horizons (gold triangular body, dish, one RTG); uP1: sun direction (world)
const FS_PROBE = COMMON + `
float sdBox(vec3 p, vec3 b){ vec3 q = abs(p) - b; return length(max(q, 0.)) + min(max(q.x, max(q.y, q.z)), 0.); }
float sdCap(vec3 p, vec3 a, vec3 b, float r){ vec3 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba)/dot(ba, ba), 0., 1.); return length(pa - ba*h) - r; }
float sdHex(vec3 p, float r, float h){ vec3 q = abs(p); return max(max(q.x*0.866 + q.z*0.5, q.z) - r, q.y - h); }
float map(vec3 p, out float m){
  float d = 1e9; m = 0.;
  if(uP0.x < 0.5){
    // high-gain dish facing +y (toward Earth), ten-sided bus below, three long booms
    vec3 q = p - vec3(0., 0.12, 0.);
    float dish = max(abs(length(q + vec3(0., 0.55, 0.)) - 0.62) - 0.008, -q.y);
    dish = max(dish, length(q.xz) - 0.3);
    float bus = sdBox(p - vec3(0., 0.03, 0.), vec3(0.14, 0.06, 0.14));
    float b1 = sdCap(p, vec3(0.), vec3(0.95, -0.05, 0.1), 0.006), b2 = sdCap(p, vec3(0.), vec3(-0.35, -0.02, 0.4), 0.012), b3 = sdCap(p, vec3(0.), vec3(-0.3, -0.03, -0.42), 0.012);
    float rtg = min(sdCap(p, vec3(-0.25, -0.02, 0.28), vec3(-0.35, -0.02, 0.4), 0.035), sdCap(p, vec3(-0.22, -0.03, -0.3), vec3(-0.3, -0.03, -0.42), 0.03));
    d = dish; m = 1.;
    if(bus < d){ d = bus; m = 2.; }
    float bm = min(min(b1, b2), b3); if(bm < d){ d = bm; m = 3.; }
    if(rtg < d){ d = rtg; m = 3.; }
  } else if(uP0.x > 3.5){
    // Hubble: a silver-foil tube with its aperture door, two solar wings and the aft shroud
    float tube = max(length(p.xz) - 0.25, abs(p.y + 0.05) - 0.72);
    float door = max(max(length(p.xz - vec2(0.18, 0.)) - 0.2, abs(p.y - 0.72) - 0.006), -p.x - 0.02);
    float wings = sdBox(vec3(abs(p.x) - 0.62, p.y + 0.05, p.z), vec3(0.34, 0.5, 0.004));
    float mast = sdCap(p, vec3(-0.3, -0.05, 0.), vec3(0.3, -0.05, 0.), 0.012);
    d = tube; m = 1.;
    if(door < d){ d = door; m = 3.; }
    if(wings < d){ d = wings; m = 7.; }
    if(mast < d){ d = mast; m = 3.; }
  } else if(uP0.x > 2.5){
    // the ISS: the long truss, eight solar wings, radiators, and the stack of pressurised modules across the middle
    float truss = sdBox(p, vec3(0.022, 0.022, 0.9));
    vec3 wp = vec3(p.x, abs(p.y) - 0.33, abs(abs(p.z) - 0.675) - 0.125);
    float wings = sdBox(wp, vec3(0.003, 0.29, 0.1));
    float rad = sdBox(vec3(p.x, p.y + 0.17, abs(p.z) - 0.3), vec3(0.003, 0.11, 0.07));
    float mods = sdCap(p, vec3(-0.52, 0., 0.), vec3(0.46, 0., 0.), 0.048);
    float node = sdCap(p, vec3(0.22, 0., -0.17), vec3(0.22, 0., 0.17), 0.042);
    d = truss; m = 3.;
    if(wings < d){ d = wings; m = 7.; }
    if(rad < d){ d = rad; m = 1.; }
    float mm = min(mods, node); if(mm < d){ d = mm; m = 1.; }
  } else if(uP0.x > 1.5){
    // New Horizons: a squat triangular body in gold foil, the 2.1 m dish on top facing Earth, the plutonium RTG on a strut at one corner, the LORRI telescope on a side
    vec3 q = p; float tri = max(max(q.x*0.866 + q.z*0.5, -q.x*0.866 + q.z*0.5), -q.z) - 0.2;
    float body = max(tri, abs(q.y) - 0.1);
    vec3 dq = p - vec3(0., 0.12, 0.);
    float dish = max(abs(length(dq + vec3(0., 0.5, 0.)) - 0.56) - 0.01, -dq.y);
    dish = max(dish, length(dq.xz) - 0.3);
    float feed = sdCap(p, vec3(0., 0.12, 0.), vec3(0., 0.3, 0.), 0.012);
    float rtg = sdCap(p, vec3(-0.46, -0.02, -0.26), vec3(-0.72, -0.02, -0.42), 0.055);
    float fins = max(sdCap(p, vec3(-0.46, -0.02, -0.26), vec3(-0.72, -0.02, -0.42), 0.1), min(abs(p.y + 0.02), abs(dot(p.xz - vec2(-0.59, -0.34), vec2(0.53, -0.85)))) - 0.006);
    float strut = sdCap(p, vec3(-0.2, -0.02, -0.12), vec3(-0.46, -0.02, -0.26), 0.02);
    float lorri = sdCap(p, vec3(0.18, -0.02, 0.2), vec3(0.18, -0.02, 0.36), 0.035);
    d = body; m = 6.;
    if(dish < d){ d = dish; m = 1.; }
    float grey = min(min(min(rtg, fins), strut), min(feed, lorri)); if(grey < d){ d = grey; m = 3.; }
  } else {
    // sunshield: five stacked kites; above it the gold primary mirror made of 18 hexagons, and the secondary on its tripod
    for(int k=0;k<5;k++){ float y = -0.12 + float(k)*0.018; vec3 q = p - vec3(0., y, 0.); float kite = max(abs(q.x)*0.7 + abs(q.z)*1. - 0.62 + float(k)*0.01, abs(q.y) - 0.002); if(kite < d){ d = kite; m = 4.; } }
    vec3 mp = p - vec3(0., 0.25, -0.02); mp.yz = mat2(0.94, -0.34, 0.34, 0.94)*mp.yz;
    float mir = 1e9;
    for(int i=-2;i<=2;i++) for(int j=-2;j<=2;j++){ vec2 c = vec2(float(i)*0.11 + (abs(j) == 1 ? 0.055 : 0.), float(j)*0.0953); if(length(c) > 0.23 || length(c) < 0.04) continue; mir = min(mir, sdHex(mp - vec3(c.x, 0., c.y), 0.05, 0.006)); }
    if(mir < d){ d = mir; m = 5.; }
    float sec = min(length(mp - vec3(0., 0.28, 0.)) - 0.03, min(sdCap(mp, vec3(0.19, 0., 0.), vec3(0., 0.28, 0.), 0.004), sdCap(mp, vec3(-0.19, 0., 0.), vec3(0., 0.28, 0.), 0.004)));
    if(sec < d){ d = sec; m = 3.; }
    float bus = sdBox(p - vec3(0., -0.2, 0.), vec3(0.08, 0.06, 0.08)); if(bus < d){ d = bus; m = 2.; }
  }
  return d;
}
vec3 nrm(vec3 p){ float m; vec2 e = vec2(0.002, 0.); return normalize(vec3(map(p + e.xyy, m) - map(p - e.xyy, m), map(p + e.yxy, m) - map(p - e.yxy, m), map(p + e.yyx, m) - map(p - e.yyx, m))); }
void main(){
  vec3 o, d; localRay(o, d);
  vec2 hb = sphIsect(o, d, vec3(0.), 1.);
  if(hb.y < 0.) discard;
  vec3 L = normalize(uP1.xyz*uRot);
  float t = max(hb.x, 0.), m = 0.; bool hit = false;
  for(int i=0;i<72;i++){ float h = map(o + d*t, m); if(h < 0.001){ hit = true; break; } t += h; if(t > hb.y) break; }
  vec3 col = vec3(0.); float a = 0.;
  if(hit){
    vec3 p = o + d*t, n = nrm(p); map(p, m);
    vec3 base = m < 1.5 ? vec3(0.9, 0.9, 0.88) : (m < 2.5 ? vec3(0.55, 0.5, 0.42) : (m < 3.5 ? vec3(0.6, 0.6, 0.62) : (m < 4.5 ? vec3(0.75, 0.62, 0.85) : (m < 5.5 ? vec3(1., 0.78, 0.35) : (m < 6.5 ? vec3(0.95, 0.68, 0.22) : vec3(0.3, 0.36, 0.62))))));
    if(m > 5.5) base *= 0.75 + 0.35*noise(p*60.);   // crinkled foil
    float dif = max(dot(n, L), 0.), sp = pow(max(dot(reflect(-L, n), -d), 0.), m > 4.5 ? 12. : 30.);
    col = base*(dif*1.2 + 0.05) + vec3(1., 0.9, 0.7)*sp*(m > 4.5 ? 1.2 : 0.4);
    a = 1.;
  }
  outCol(col, a);
}`;
P.probe = program(VS_RECT, FS_PROBE);
function addProbe(def){
  const o = addObj(Object.assign({ layer:3, prog:P.probe, group:'travel', minZoom:1.2, pxMin:4, farColor:[0.8, 0.9, 1], farLum:0.35, noImpostor:false, labelClass:'ship',
    setU(pr){ const L = sunDirFrom(this); gl.uniform4f(pr.u.uP0, def.kind, 0, 0, 0); gl.uniform4f(pr.u.uP1, L[0], L[1], L[2], 0); } }, def));
  return o;
}
const voyager1 = (() => {
  const d = radecDir(hms(17,13), dms(12,3)), pos = V.mul(d, 171*AU_LY);
  return addProbe({ key:'voyager1', name:'Voyager 1', label:'Voyager 1', type:'space probe · the farthest human-made object', kind:0, sortKey:1,
    fact:'Launched in 1977, it flew past Jupiter and Saturn and in 2012 became the first craft to enter interstellar space. Its radio signal, 20 watts, takes about a day to reach us.',
    pos, rad:0.018*KM, R0:frameY(V.mul(d, -1), [0, 0, 1]), labelRange:0.02, distEarth:'~171 AU from the Sun',
    views:[{d:[0.6, 0.3, 0.75], k:2.4, hold:8, drift:0.05}, {dirFn:() => V.norm(V.add(V.mul(voyager1.pos, 1/V.len(voyager1.pos)), [0, 0, 0.12])), k:3, hold:9, drift:0.01}],
    readout:() => 'moving at 17 km/s · light-time to Earth ~23.7 hours\nfrom here the Sun is only the brightest star; Earth is invisible' });
})();
const voyager2 = addProbe({ key:'voyager2', name:'Voyager 2', label:'Voyager 2', type:'space probe · the only visitor to Uranus and Neptune', kind:0, sortKey:1.1,
  fact:'Voyager 1\'s twin took the grand tour past all four giant planets and crossed into interstellar space in 2018, heading south below the plane of the planets.',
  pos:V.mul(radecDir(hms(20,5), dms(-59,35)), 144*AU_LY), rad:0.018*KM, R0:frameY(V.mul(radecDir(hms(20,5), dms(-59,35)), -1), [0, 0, 1]), labelRange:0.02, distEarth:'~144 AU from the Sun',
  views:[{d:[0.6, 0.3, 0.75], k:2.4, hold:8, drift:0.05}], readout:() => '144 AU out · 15 km/s' });
const newHorizons = addProbe({ key:'newhorizons', name:'New Horizons', label:'New Horizons', type:'space probe · first to Pluto', kind:2, sortKey:1.2,
  fact:'Flew past Pluto in 2015 and the icy Kuiper-belt object Arrokoth in 2019, and is still heading out of the Solar System.',
  pos:V.mul(radecDir(hms(19,50), dms(-20,30)), 65*AU_LY), rad:0.0042*KM, R0:frameY(V.mul(radecDir(hms(19,50), dms(-20,30)), -1), [0, 0, 1]), labelRange:0.01, distEarth:'~65 AU from the Sun',
  views:[{d:[0.55, 0.45, 0.7], k:2.2, hold:8, drift:0.05}, {d:[-0.8, 0.2, -0.5], k:2.6, hold:7, drift:0.04}], readout:() => '65 AU out · 14 km/s · the size of a grand piano, powered by plutonium' });
const jwst = addProbe({ key:'jwst', name:'James Webb Space Telescope', label:'JWST', type:'infrared space telescope at Sun-Earth L2', kind:1, sortKey:1.0005, parent:earth,
  fact:'Parked 1.5 million km from Earth, always in Earth\'s shadow side, behind a sunshield the size of a tennis court. Its 6.5 m gold mirror sees the first galaxies.',
  offset:[0, 0, 0], rad:0.012*KM, labelRange:3e-5, distEarth:'1.5 million km from Earth',
  update(){ const away = V.norm(earth.pos); this.offset = V.mul(away, 1.5e6*KM); this.pos = V.add(earth.pos, this.offset); this.R0 = frameY(V.mul(away, -1), [0, 0, 1]); this.rot = this.R0; },
  views:[{d:[0.7, 0.45, 0.6], k:2.2, hold:8, drift:0.05}, {d:[0.2, -0.9, 0.3], k:2.4, hold:7, drift:0.04}],
  readout:() => 'sunshield 21 x 14 m keeps the telescope at -233 °C\nit has seen galaxies from 290 million years after the Big Bang' });

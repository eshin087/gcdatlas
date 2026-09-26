
// ================================================================ Earth (real coastlines, weather, city lights, aurora), the Moon, the ISS and the satellite swarm
// local units: bounding sphere 1, solid Earth radius RP. uTex: R land, G ice sheet, B city lights (equirectangular)
const FS_EARTH = COMMON + `
const float RP = 0.893;
vec4 etex(vec3 n, float lod){ float lat = asin(clamp(n.y, -1., 1.)), lon = atan(-n.z, n.x); return textureLod(uTex, vec2(lon*0.15915494 + 0.5, 0.5 - lat*0.31830989), lod); }
float clouds(vec3 n, float t){
  float lat = n.y, al = abs(lat);
  // prevailing winds: trade winds blow west, mid-latitude westerlies blow east
  float wind = mix(-0.6, 1.2, smoothstep(0.35, 0.55, al)) - smoothstep(0.85, 1., al)*0.8;
  float a = t*0.02*wind;
  vec3 q = vec3(n.x*cos(a) - n.z*sin(a), n.y, n.x*sin(a) + n.z*cos(a));
  // cyclones: swirl the domain around latitude-bound centres
  vec3 w = vec3(fbm3(q*2.1 + 3.), fbm3(q*2.1 + 9.), fbm3(q*2.1 + 17.));
  float sw = (w.x - 0.5)*3.2*sign(lat);
  vec3 r = vec3(q.x*cos(sw) - q.z*sin(sw), q.y, q.x*sin(sw) + q.z*cos(sw));
  float f = fbm(r*4.2 + w*1.4 + vec3(0., 0., t*0.003));
  float prof = 0.55*exp(-pow(lat/0.12, 2.)) + 0.75*exp(-pow((al - 0.8)/0.16, 2.)) - 0.25*exp(-pow((al - 0.42)/0.1, 2.)) + 0.3*smoothstep(0.9, 1., al);
  return smoothstep(0.65 - prof*0.22, 0.88 - prof*0.2, f + 0.06*fbm3(q*14.));
}
vec3 landCol(vec3 n, float lat, float ice){
  float a = abs(lat)*57.3, h = fbm(n*7.), h2 = fbm3(n*19. + 2.);
  vec3 forest = vec3(0.09, 0.2, 0.07), savanna = vec3(0.42, 0.38, 0.18), desert = vec3(0.78, 0.62, 0.4), tundra = vec3(0.4, 0.38, 0.3), boreal = vec3(0.1, 0.17, 0.1);
  float des = smoothstep(11., 20., a)*smoothstep(38., 27., a)*smoothstep(0.38, 0.55, h + 0.12*h2);
  vec3 c = mix(forest, savanna, smoothstep(0.45, 0.62, h)*smoothstep(5., 14., a));
  c = mix(c, desert, des);
  c = mix(c, forest*1.1, smoothstep(38., 45., a)*smoothstep(58., 50., a)*0.8);
  c = mix(c, boreal, smoothstep(50., 56., a));
  c = mix(c, tundra, smoothstep(62., 68., a));
  c = mix(c, vec3(0.93, 0.95, 0.98), max(ice, smoothstep(70., 76., a + 6.*h2)));
  return c*(0.8 + 0.4*h2);
}
void main(){
  vec3 o, d; localRay(o, d);
  vec3 L = normalize(uP1.xyz*uRot);
  float t = uP0.x, lod = uP0.w;
  vec2 hs = sphIsect(o, d, vec3(0.), RP);
  vec3 col = vec3(0.); float alpha = 0.;
  const float RA = RP*1.028;
  if(hs.x > 0.){
    vec3 p = o + d*hs.x, n = p/RP;
    float lat = asin(n.y);
    vec4 tx = etex(n, lod), txb = etex(n, lod + 3.);
    float land = smoothstep(0.35, 0.65, tx.r), coast = smoothstep(0.05, 0.4, txb.r)*(1. - land);
    float mu = max(dot(n, -d), 0.), sdot = dot(n, L), day = smoothstep(-0.08, 0.12, sdot), dif = max(sdot, 0.);
    vec3 ocean = mix(vec3(0.02, 0.075, 0.2), vec3(0.04, 0.24, 0.32), coast*0.8);
    vec3 surf = mix(ocean, landCol(n, lat, tx.g)*1.7, land);
    // Earth's story: 1 bare rock before land plants, 2 snowball Earth, 3 an ocean world under an orange haze, 4 molten
    float era = uP1.w;
    if(era > 0.001){
      vec3 barren = mix(ocean*vec3(0.9, 1.05, 0.95), vec3(0.42, 0.36, 0.3)*(0.7 + 0.5*tx.r), land);
      vec3 snow = vec3(0.9, 0.93, 0.97)*(0.85 + 0.15*tx.r);
      vec3 water = mix(vec3(0.05, 0.16, 0.13), vec3(0.3, 0.26, 0.22), land*0.2);
      vec3 lava = mix(vec3(0.1, 0.03, 0.02), vec3(0.9, 0.3, 0.08), pow(noise(n*16. + t*0.02), 3.)*2.);
      surf = era < 1. ? mix(surf, barren, era) : era < 2. ? mix(barren, snow, era - 1.) : era < 3. ? mix(snow, water, era - 2.) : mix(water, lava, era - 3.);
    }
    float cl = clouds(n, t);
    // clouds cast soft shadows a little way from themselves
    float cls = clouds(normalize(n + L*0.012), t);
    vec3 lit = surf*dif*(1. - 0.55*cls)*1.25;
    vec3 hv = normalize(L - d); float gl = pow(max(dot(n, hv), 0.), 90.)*(1. - land)*(1. - cl);
    lit += vec3(1., 0.92, 0.75)*gl*1.6*dif;
    lit = mix(lit, vec3(0.96, 0.97, 1.)*(dif*1.15 + 0.01), cl);
    // city lights on the night side, dimmed by cloud
    float lights = tx.b*(1. - day)*(1. - 0.75*cl)*(0.55 + 0.9*noise(n*140.))*uP0.z;
    col = lit + vec3(1., 0.72, 0.36)*lights*1.7;
    if(era > 3.) col += vec3(1., 0.36, 0.08)*pow(noise(n*16. + t*0.02), 3.)*(era - 3.)*2.5;   // the magma ocean glows on its own
    // atmosphere along the view path: blue by day, orange at the terminator
    float path = pow(1. - mu, 2.5);
    vec3 sky = mix(vec3(1., 0.42, 0.16), vec3(0.3, 0.55, 1.), smoothstep(-0.02, 0.3, sdot));
    col += sky*path*smoothstep(-0.1, 0.25, sdot)*0.42;
    alpha = 1.;
  }
  // limb: the thin shell of air seen edge-on
  if(hs.x < 0.) col += limbAir(o, d, RP, 0.0075, L, vec3(0.3, 0.55, 1.), vec3(1., 0.42, 0.16), 1.25);
  // aurora curtains around the geomagnetic poles, glowing on the night side
  if(uP0.y > 0.){
    vec3 mp = normalize(uP2.xyz);
    vec2 ha = sphIsect(o, d, vec3(0.), RP*1.07);
    if(ha.y > 0.){
      float t0 = max(ha.x, 0.), t1 = hs.x > 0. ? hs.x : ha.y; float dt = (t1 - t0)/14.;
      vec3 acc = vec3(0.);
      for(int i=0;i<14;i++){
        vec3 p = o + d*(t0 + dt*(float(i) + 0.5)); float r = length(p); if(r < RP*1.012) continue;
        vec3 u = p/r; float h = (r - RP*1.012)/(RP*0.05);
        float ml = dot(u, mp); ml = abs(ml);
        vec3 e1 = normalize(cross(mp, vec3(0.3, 0.2, 0.9))), e2 = cross(mp, e1);
        float ang = atan(dot(u, e2), dot(u, e1));
        float oval = exp(-pow((ml - 0.93 - 0.012*sin(ang*3. + t*0.05))/0.018, 2.));
        float cur = pow(noise(vec3(ang*9., t*0.02, 1.)), 2.)*(0.4 + 1.2*pow(noise(vec3(ang*55., h*2., t*0.05)), 3.));
        float dark = smoothstep(0.1, -0.2, dot(u, L));
        vec3 c = mix(vec3(0.25, 1., 0.45), vec3(0.8, 0.25, 0.75), smoothstep(0.35, 1., h));
        acc += c*oval*cur*dark*exp(-h*1.4);
      }
      col += acc*dt*uP0.y*40.;
    }
  }
  outCol(col, alpha);
}`;
P.earth = program(VS_RECT, FS_EARTH);
loadTex('earth', EARTH_PNG);
loadTex('mw', MW_PNG);
const earth = (() => {
  const R = 6371*KM, bound = 1.12;
  const magN = [Math.cos(80.8*DEG)*Math.cos(-72.6*DEG), Math.sin(80.8*DEG), -Math.cos(80.8*DEG)*Math.sin(-72.6*DEG)];   // geomagnetic north pole (2025), body frame
  // satellites: ISS, the Starlink-era low orbit swarm, GPS and the geostationary ring
  const PB_SAT = `void body(out vec3 p, out float br, out vec3 col){
    float r = aP.x, inc = aP.y, node = aP.z;
    float n = sqrt(398600./(r*r*r));
    float th = aP.w + uQ0.x*n;
    vec3 q = vec3(cos(th), 0., -sin(th))*r;
    q = vec3(q.x, q.z*sin(inc), q.z*cos(inc));
    p = vec3(q.x*cos(node) - q.z*sin(node), q.y, q.x*sin(node) + q.z*cos(node))/7135.5;
    br = aC.w; col = aC.rgb;
  }`;
  P.ptSat = program(particleVS(PB_SAT), FS_POINT);
  const nS = Math.round(1400*QUALITY), sats = makePS(nS + 1);
  sats.a.set([6371 + 418, 51.64*DEG, 1.1, 0], 0); sats.c.set([1, 0.95, 0.8, 3], 0);   // the ISS
  for (let i=1;i<=nS;i++){
    const u = rnd(); let r, inc, b = 0.5 + 0.5*rnd();
    if (u < 0.62){ r = 6371 + 540 + 30*rnd(); inc = (rnd() < 0.8 ? 53 : 70)*DEG; }
    else if (u < 0.82){ r = 6371 + 600 + 250*rnd(); inc = 97.6*DEG; }
    else if (u < 0.88){ r = 26560; inc = 55*DEG; b *= 1.4; }
    else { r = 42164; inc = rndn()*0.3*DEG; b *= 1.4; }
    sats.a.set([r, inc, rnd()*6.283, rnd()*6.283], i*4); sats.c.set([0.75, 0.85, 1, b*0.5], i*4);
  }
  sats.upload('ac');
  const o = addObj({ key:'earth', name:'Earth', label:'Earth', type:'rocky planet · home', group:'solar', sortKey:1,
    fact:'The only world known to have life. Real coastlines, weather systems pushed by the trade winds and westerlies, city lights on the night side and auroras over the poles.',
    parent:sun, offset:planetPos(PLANET_EL.earth, JD_NOW), rad:R*bound, solid:0.893, R0:poleFrame(0, 90), prog:P.earth, tex:'earth', minZoom:1.035, pxMin:5, farColor:[0.55, 0.7, 1], farLum:0.9, labelRange:2e-3,
    distEarth:'home', aka:'home world planet blue marble',
    views:[
      {dirFn:() => sunSide(o, 0.95, 0.32), k:3.1, hold:9, drift:0.035},
      {dirFn:() => sunSide(o, 2.75, 0.22), k:2.1, hold:9, drift:0.03},
      {dirFn:() => sunSide(o, 0.55, 0.05), k:1.3, off:[0, 0.62, 0], hold:8, drift:0.012},
      // pull back from behind Earth, with the Moon hanging beyond it, until the true gap between them opens up (30 Earths wide)
      {dirFn:() => { const m = V.norm(moon.offset), L = sunDirFrom(o), c = V.norm(V.sub(L, V.mul(m, V.dot(L, m)))); return V.norm(V.add(V.mul(m, -1), V.mul(c, 0.55))); },
       k:2.6, hold:13, drift:0, flyby:'pulling back to the Moon', offW:'dist',
       to:{ dirFn:() => { const m = V.norm(moon.offset), L = sunDirFrom(o), c = V.norm(V.sub(L, V.mul(m, V.dot(L, m)))); return V.norm(V.add(c, V.mul(m, -0.12))); },
         k:74, off:() => V.mul(M3.applyT(o.R0, moon.offset), 0.5/o.rad) }},
      sunBack('earth', 6, 0.27),
    ],
    update(){
      const jd = jdNow();
      this.offset = planetPos(PLANET_EL.earth, jd); this.pos = V.add(this.parent.pos, this.offset);
      this.rot = bodyFrame(0, 90, 190.147 + 360.9856235*(jd - 2451545));
    },
    setU(pr){ const L = sunDirFrom(this);
      gl.uniform4f(pr.u.uP0, this.t, 1, EARTH_ERA.lights, Math.log2(Math.max(160/Math.max(this.rpx*2, 1), 1)));
      gl.uniform4f(pr.u.uP1, L[0], L[1], L[2], EARTH_ERA.era);
      gl.uniform4f(pr.u.uP2, magN[0], magN[1], magN[2], 0); },
    particleVis:rpx => smooth(3, 12, rpx),
    particles:[{ps:sats, prog:'ptSat', mode:3, sb:0.4, size:1.6, rot:() => o.R0, rad:R*bound, q0:() => [(jdNow() - JD_NOW)*86400, 0, 0, 0], vis:() => 1 - smooth(1.5e-8, 6e-8, orbit.dist)}],
    readout:() => { const d = orbit.dist/(R*bound); return d < 2 ? 'the ISS orbits 420 km up at 28,000 km/h\none lap every 93 minutes, 16 sunrises a day' :
      (d > 20 ? 'the Moon is 384,400 km away: 30 Earths could fit in between\nlight crosses that gap in 1.3 seconds' : 'radius 6,371 km · 71% ocean · 1 day = 23 h 56 min\n~10,000 satellites now circle it'); } });
  return o;
})();
const moon = addBody({ key:'moon', name:'the Moon', label:'Moon', type:'Earth\'s natural satellite', parent:earth, R:1737.4, pole:[269.9949, 66.5392], W:[38.3213, 13.17635815], kind:6,
  offsetFn:jd => moonGeo(jd), shadowOf:earth, farLum:0.8, farColor:[0.9, 0.9, 0.88], sortKey:1.001, labelRange:0.004, minZoom:1.15,
  fact:'Born from a giant impact 4.5 billion years ago. The dark "seas" are ancient lava plains; bright rays splash out from young craters like Tycho.',
  views:[{dirFn:() => sunSide(moon, 0.35, 0.12), k:3.2, hold:8, drift:0.03}, {dirFn:() => sunSide(moon, 1.45, 0.1), k:1.8, hold:7, drift:0.03},
    {dirFn:() => sunSide(moon, 1.35, 0.03), k:1.22, off:[0, 0.55, 0], hold:8, drift:0.01}],
  readout:() => 'radius 1,737 km · 384,400 km from Earth\nalways shows us the same face; 12 people have walked on it' });
earth.bodyFrac = 0.893;

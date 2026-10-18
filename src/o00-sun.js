
// ================================================================ stars (generic photosphere/corona shader), the Sun, and the Solar System's large-scale structure
// Local units: bounding sphere radius 1; the photosphere has radius uP1.x.
// uP0: T_eff, convection cells per radius, spot activity, cell speed   uP1: R*, oblateness, corona, prominences
// uP2: flare (local dir, amount)   uP3: CME (local dir, radius)   uP4: x granulation fine detail, y limb darkening, z chromosphere, w colour boost
// uM0[0].x: a tide's stretch along local x (the star that much longer toward a close partner than across; 0 for a round star)
// (a negative w switches on the fire look of a star with a boiling convective surface: churning granulation, flames licking up from the limb, lively prominences;
//  w <= -10 also gives the Sun's warm filtered-photo tint, and its boost is |w| - 10)
const FS_STAR = COMMON + `
vec2 vor(vec3 p, float sp){
  vec3 i = floor(p), f = fract(p); float d1 = 8., d2 = 8.;
  for(int z=-1;z<=1;z++) for(int y=-1;y<=1;y++) for(int x=-1;x<=1;x++){
    vec3 g = vec3(float(x), float(y), float(z)), c = i + g;
    vec3 h = vec3(hash13(c), hash13(c + 17.3), hash13(c + 41.1));
    vec3 r = g + 0.5 + 0.42*sin(uTime*sp + 6.2831*h) - f; float dd = dot(r, r);
    if(dd < d1){ d2 = d1; d1 = dd; } else if(dd < d2) d2 = dd;
  }
  return vec2(sqrt(d1), sqrt(d2));
}
float gCell = 0.;
float boostOf(){ return uP4.w < -9. ? -uP4.w - 10. : abs(uP4.w); }
// the fire palette, from the dark lanes (0) to the hottest cell centres (1): the Sun's warm filtered-photo tones, or the star's own blackbody colours
vec3 firePal(float h){
  if(uP4.w < -9.) return mix(mix(vec3(0.8, 0.22, 0.03), vec3(1., 0.56, 0.12), smoothstep(0.05, 0.45, h)), vec3(1., 0.9, 0.55), smoothstep(0.5, 0.95, h));
  float T = uP0.x;
  return mix(mix(blackbody(T*0.62), blackbody(T*0.85), smoothstep(0.05, 0.45, h)), blackbody(T*1.12), smoothstep(0.5, 0.95, h));
}
vec3 photosphere(vec3 n, float mu, float Rs){
  float T = uP0.x, act = uP0.z;
  float lat = n.y;
  // differential rotation: the equator laps the poles
  float dr = uTime*0.02*(1. - 0.25*lat*lat);
  vec3 q = vec3(n.x*cos(dr) - n.z*sin(dr), n.y, n.x*sin(dr) + n.z*cos(dr));
  vec2 v = vor(q*uP0.y, uP0.w);
  float cell = smoothstep(0., 0.32, v.y - v.x)*(0.8 + 0.2*(1. - v.x));
  if(uP4.x > 0.){ vec2 v2 = vor(q*uP0.y*5.3 + 3.1, uP0.w*2.); cell = mix(cell, cell*(0.55 + 0.45*smoothstep(0., 0.3, v2.y - v2.x)), uP4.x); }
  gCell = cell;
  float big = fbm3(q*2.2 + 4.);
  // active regions: spots with umbra and penumbra, bright faculae around them
  float band = exp(-pow((abs(lat) - 0.28)/0.13, 2.));
  float sn = fbm3(q*4.5 + 11.)*0.8 + noise(q*16. + 3.)*0.2;
  float thr = 0.78 - 0.1*act;
  float pen = smoothstep(thr, thr + 0.035, sn)*band*act, umb = smoothstep(thr + 0.05, thr + 0.08, sn)*band*act;
  float fac = smoothstep(thr - 0.12, thr - 0.02, sn)*(1. - pen)*band*act*pow(1. - mu, 0.7);
  float I = (1. - uP4.y*(1. - mu) - 0.2*(1. - mu)*(1. - mu))*(0.4 + 0.85*cell)*(0.85 + 0.3*big);
  I *= 1. - 0.55*pen - 0.35*umb;
  I += fac*0.6;
  float Tl = T*(0.84 + 0.16*mu)*(0.96 + 0.08*cell)*(1. - 0.25*umb);
  return blackbody(Tl)*I;
}
void main(){
  vec3 o, d; localRay(o, d);
  float Rs = uP1.x, sq = 1. + uP1.y;
  vec3 sv = vec3(1./(1. + uM0[0].x), sq, 1.), os = o*sv, ds = normalize(d*sv);
  vec2 h = sphIsect(os, ds, vec3(0.), Rs);
  vec3 col = vec3(0.); float alpha = 0.;
  float tc = -dot(o, d); vec3 pc = o + d*max(tc, 0.);
  float b = length(pc)/Rs;
  bool hit = h.x > 0.;
  if(hit){
    vec3 p = os + ds*h.x, n = p/Rs; float mu = max(dot(n, -ds), 0.);
    col = photosphere(n, mu, Rs)*1.3*boostOf()*vec3(1., 0.93, 0.8);
    if(uP4.w < 0.){
      // a boiling surface: granules flicker, bigger patches swell and fade, and a slow churning flow runs through it all like fire; hot cell centres burn bright,
      // the lanes between them glow a deeper, redder colour
      float tm = uTime;
      vec3 q = n*uP0.y*0.32; q += 0.7*(vec3(fbm3(q + vec3(0., tm*0.12, 0.)), fbm3(q + vec3(5.2, -tm*0.1, 1.3)), fbm3(q + vec3(9.1, 2.8, tm*0.08))) - 0.5);
      float churn = fbm3(q*2.2 + vec3(0., tm*0.45, -tm*0.3));
      float boil = fbm3(n*uP0.y*0.5 + vec3(0., tm*0.23, tm*0.17)), flick = noise(n*uP0.y*2.3 + vec3(tm*0.8, 0., -tm*0.6));
      float heat = clamp(gCell*0.75 + (boil - 0.5)*0.9 + (churn - 0.5)*0.9 + (flick - 0.5)*0.5 + 0.1, 0., 1.);
      vec3 hot = firePal(heat);
      col = hot*(dot(col, vec3(0.3, 0.5, 0.2))/dot(hot, vec3(0.3, 0.5, 0.2)))*(0.38 + 1.25*heat);   // about the same brightness, a fiery colour, more contrast
    }
    // flare: a blinding ribbon at an active region
    vec3 fd = normalize(uP2.xyz); float fl = uP2.w;
    if(fl > 0.001){ float e = length(n - fd); col += vec3(1., 0.95, 0.9)*fl*(exp(-e*e/0.0015)*6. + exp(-e*e/0.02)*1.2); }
    alpha = 1.;
  }
  // chromosphere rim and prominences: emission just above the limb
  if(!hit || tc < 0.){
    float hgt = b - 1.;
    col += vec3(1., 0.32, 0.35)*exp(-max(hgt, 0.)/0.012)*uP4.z*step(0., hgt);
    if(uP4.w < 0. && hgt > 0.){
      // flames at the limb: a ragged fringe of spicules that rise and flicker, and larger tongues of plasma that swell, lick upward and fall back
      vec3 u = normalize(pc); float tm = uTime;
      float tall = 0.014 + 0.05*pow(noise(u*11. + vec3(0., tm*0.3, 0.)), 2.);
      float fl = pow(noise(u*46. + vec3(tm*0.7, -tm*0.5, tm*0.3) + u*(tm*1.6 - hgt*40.)), 2.2);
      float tongue = pow(noise(u*8. + vec3(tm*0.21, 0., -tm*0.17)), 3.)*2.6;
      float lick = pow(noise(u*22. + u*(tm*1.1 - hgt*18.) + 7.), 1.6);
      float f2 = tongue*lick*exp(-hgt/(0.04 + 0.16*tongue))*smoothstep(0.5, 0.0, hgt);
      float e = fl*exp(-hgt/tall) + f2;
      col += firePal(clamp(0.35 + 0.6*fl*exp(-hgt/tall) + 0.3*lick - hgt*2., 0., 1.))*e*3.2;
    }
  }
  if(uP1.w > 0.001){
    vec2 hp = sphIsect(o, d, vec3(0.), Rs*1.35);
    if(hp.y > 0.){
      float t0 = max(hp.x, 0.), t1 = hit ? h.x : hp.y; float dt = (t1 - t0)/18.;
      float jit = hash12(gl_FragCoord.xy)*dt;
      vec3 acc = vec3(0.);
      for(int i=0;i<18;i++){
        vec3 p = o + d*(t0 + jit + dt*float(i)); float r = length(p)/Rs, hh = r - 1.;
        if(hh < 0.) continue;
        vec3 u = p/(r*Rs);
        float foot = smoothstep(0.6, 0.78, fbm3(u*3.2 + 7.));
        float fire = uP4.w < 0. ? 1. : 0.;
        float arch = ridge(vec3(u.xz*7. + u.y*3., hh*9. - uTime*(0.05 + 0.2*fire)) + vec3(u.y*5., 0., 0.));
        float dens = pow(arch, 5.)*foot*exp(-hh/0.07)*smoothstep(0.35, 0.02, hh)*(1. + fire*(0.8*noise(u*30. + vec3(0., uTime*1.3, 0.)) - 0.2));
        acc += mix(vec3(1., 0.3, 0.32), firePal(0.45), fire*0.6)*dens;
      }
      col += acc*dt*uP1.w*160.;
    }
  }
  // K-corona: streamers near the equator, fine polar plumes; column density falls as r^-2.6
  if(!hit && uP1.z > 0.){
    vec3 u = normalize(pc); float lat = u.y;
    // helmet streamers near the equator, fine radial rays everywhere (noise that depends only on direction = radial streaks)
    float st = 2.6*exp(-lat*lat*4.)*pow(fbm3(vec3(atan(u.z, u.x)*2.2, lat*2., 1.3) + uTime*0.003), 3.);
    float rays = pow(noise(u*vec3(24., 24., 24.) + vec3(0., uTime*0.004, 0.)), 4.)*1.4 + pow(noise(u*55. + 3.), 6.)*1.2;
    float plumes = pow(noise(u*vec3(26., 3., 26.) + 5.), 3.)*smoothstep(0.5, 0.9, abs(lat))*1.2;
    float I = pow(1./max(b, 1.), 3.)*(0.04 + st + rays + plumes)*smoothstep(1., 1.02, b);
    col += vec3(0.95, 0.93, 1.)*I*uP1.z*0.75;
  }
  // coronal mass ejection: a bright expanding loop-shaped shell
  if(uP3.w > 0.){
    vec3 cd = normalize(uP3.xyz); float R = uP3.w*Rs; vec3 c = cd*(Rs + R*0.9);
    vec2 hc = sphIsect(o, d, c, R*1.3);
    if(hc.y > 0.){
      float t0 = max(hc.x, 0.), dt = (hc.y - t0)/14.; vec3 acc = vec3(0.);
      for(int i=0;i<14;i++){ vec3 p = o + d*(t0 + dt*(float(i) + 0.5)), q = p - c; float s = length(q);
        float sh = exp(-pow((s - R)/(0.12*R), 2.))*smoothstep(-0.6, 0.2, dot(q/s, cd))*(0.5 + fbm3(p*18./Rs));
        // the Sun is only drawn inside its bounding sphere (radius 1 here): the cloud thins out and fades before it gets there, instead of being cut off
        sh *= smoothstep(0.97, 0.7, length(p));
        acc += vec3(0.9, 0.92, 1.)*sh; }
      col += acc*dt/R*1.2*exp(-uP3.w*0.6);
    }
  }
  // soft outer glow so the star reads from a distance
  col += blackbody(uP0.x)*(uP4.w < -9. ? vec3(1., 0.72, 0.38) : vec3(1.))*exp(-max(b - 1., 0.)*11.)*0.045*(hit ? 0. : 1.);
  outCol(col, alpha);
}`;
P.star = program(VS_RECT, FS_STAR);
// generic star object: radius in solar radii, temperature, optional spin (days) and pole
const STAR_M0 = new Float32Array(9);
function addStar(def){
  const Rs = def.R*RSUN*KM, bound = def.bound || 3.2;
  const o = addObj(Object.assign({ layer:3, prog:P.star, rad:Rs*bound, solid:1/bound, minZoom:1.08/bound, pxMin:5, group:'stars', farColor:blackbodyJS(def.T), farLum:def.farLum ?? 0.9, noImpostor:def.noImpostor ?? true,
    labelRange:def.labelRange ?? 400, starR:1/bound,
    setU(pr){ const s = this.star;
      gl.uniform4f(pr.u.uP0, def.T, s.cells ?? 34, s.act ?? 0.4, s.speed ?? 0.25);
      gl.uniform4f(pr.u.uP1, this.starR, s.obl ?? 0, s.corona ?? 0.6, s.prom ?? 0);
      gl.uniform4f(pr.u.uP2, 0, 1, 0, 0); gl.uniform4f(pr.u.uP3, 0, 1, 0, 0);
      // stars cooler than ~7,000 K have boiling convective surfaces and get the fire look; hotter stars' surfaces are calm
      gl.uniform4f(pr.u.uP4, s.fine ?? 0, s.limb ?? 0.55, s.chromo ?? 0.25, (s.fire ?? def.T < 7000) ? -(s.boost ?? 1) : (s.boost ?? 1));
      STAR_M0[0] = s.tide ?? 0; gl.uniformMatrix3fv(pr.u.uM0, false, STAR_M0);   // (every star sets it: the program keeps the last star's)
    } }, def));
  o.star = def.star || {};
  if (def.spinDays){ const R0 = o.R0; o.update = function(){ this.rot = M3.mul(R0, M3.rotY(-this.t*SS_RATE/86400/def.spinDays*2*Math.PI)); }; }
  return o;
}

// ---------------------------------------------------------------- the Sun
const sun = (() => {
  const R = RSUN*KM, bound = 4;
  const st = { flareDir:[0,1,0], flare:0, cmeDir:[0,1,0], cmeWorld:[0,1,0], cme:0, nextFlare:6, nextCme:14 };
  const o = addObj({ key:'sun', name:'the Sun', label:'Sun', chip:'Sun', type:'G2V main-sequence star · our star', group:'solar', sortKey:-1,
    fact:'A million Earths would fit inside. Its visible surface boils with convection cells, dark sunspots and looping prominences of glowing hydrogen.',
    pos:[0,0,0], rad:R*bound, solid:1/bound, R0:poleFrame(286.13, 63.87), prog:P.star, minZoom:0.27, pxMin:4, farColor:V.mul(blackbodyJS(5772), 1).map((c, k) => c*[1, 0.82, 0.5][k]), farLum:1.2, labelRange:3e5, distEarth:'8.3 light-minutes',
    aka:'sol star', starR:1/bound,
    views:[{d:[0.2, 0.25, 1], k:1.8, hold:9, drift:0.03}, {d:[0.7, 0.62, 0.35], k:0.62, off:[0.12, 0.16, 0.08], hold:8, drift:0.02}, {d:[-0.95, 0.1, 0.3], k:1.25, hold:8, drift:-0.03}],
    update(dt){
      this.rot = M3.mul(this.R0, M3.rotY(-this.t*0.05));
      st.nextFlare -= dt; st.nextCme -= dt;
      if (st.nextFlare < 0){ st.nextFlare = 8 + rnd()*10; const a = rnd()*6.283, la = (rnd() < 0.5 ? 1 : -1)*(0.2 + 0.2*rnd()); st.flareDir = V.norm([Math.cos(a), la, Math.sin(a)]); st.flareT = 0; }
      if (st.nextCme < 0){ st.nextCme = 16 + rnd()*16; const a = rnd()*6.283; st.cmeWorld = M3.apply(this.rot, V.norm([Math.cos(a), (rnd() - 0.5)*0.9, Math.sin(a)])); st.cmeT = 0; }
      // an ejection leaves in a straight line: it keeps its direction in space while the Sun turns underneath (the shader works in the Sun's turning frame)
      st.cmeDir = M3.applyT(this.rot, st.cmeWorld);
      st.flareT = (st.flareT ?? 99) + dt; st.cmeT = (st.cmeT ?? 99) + dt;
      st.flare = st.flareT < 0.4 ? st.flareT/0.4 : Math.exp(-(st.flareT - 0.4)/1.8);
      st.cme = st.cmeT < 14 ? 0.15 + st.cmeT*0.18 : 0;
    },
    setU(pr){
      gl.uniform4f(pr.u.uP0, 5772, 40, 0.75, 0.22);
      // enlarged in the Solar System overview, the corona and ejections would grow over the inner planets: they fade out instead
      // (zoomed in close it is nearly true size again, and the corona comes back)
      const kc = 1 - (typeof SYSMAG !== 'undefined' ? SYSMAG.k*smooth(1.3, 3, this.mag || 1) : 0);
      gl.uniform4f(pr.u.uP1, 1/bound, 0, kc, kc);
      gl.uniform4f(pr.u.uP2, st.flareDir[0], st.flareDir[1], st.flareDir[2], st.flare);
      gl.uniform4f(pr.u.uP3, st.cmeDir[0], st.cmeDir[1], st.cmeDir[2], kc > 0.05 ? st.cme : 0);
      gl.uniform4f(pr.u.uP4, clamp(1.5 - viewDist()/(this.rad*1.2), 0, 1), 0.58, 0.5, -11);
      STAR_M0[0] = 0; gl.uniformMatrix3fv(pr.u.uM0, false, STAR_M0);
    },
    readout:() => st.cmeT < 10 ? 'coronal mass ejection: a billion tonnes of plasma\nleaving at ~1,000 km/s; it would reach Earth in ~2 days' :
      (st.flareT < 3 ? 'solar flare: magnetic loops snapping and reconnecting\nreleasing the energy of millions of nuclear bombs' : 'surface 5,500 °C, core 15 million °C · 1.39 million km across\nlight from its core takes ~100,000 years to reach the surface\ndrawn warm like a filtered photo · from space it looks white') });
  o.st = st;
  return o;
})();

// ---------------------------------------------------------------- generic planets and small moons
// uP0: x kind, y ring on/off   uP1: sun direction (world)   uP2: shadowing body centre (local units), w radius
// The Solar System's own bodies (kinds 0 to 13, Ceres 19, and Tethys, Dione and Rhea, 25 to 27) are drawn display-referred: their surface functions give the colour a cell should
// show in full sunlight, as FS_CELL sees it after its tone map, and main() undoes that tone map (unTone). So a bright highland and a dark sea land
// on different characters in the middle of the ramp, instead of every lit part piling up on the heaviest ones and only the light's fall-off
// showing. Their markings sit at their real places (latitude, east longitude); relief (craters, volcanoes, canyons) tilts the normal the light
// sees (gN), with slopes steeper than real so it shows in characters. The worlds of other stars and Mimas keep the older, physical path.
const FS_PLANETG = `
#define SOL (KIND < 14 || KIND == 19 || KIND > 24)
const float RP = 0.9, kind = float(KIND);
int ZI = 0;   // (a 0 the compiler cannot see, set in main from a uniform: the crater loops stay loops instead of being unrolled at every call)
vec2 vorc(vec3 p){ vec3 i = floor(p), f = fract(p); float d1 = 8.; vec3 id = vec3(0.);
  for(int z=ZI-1;z<=ZI+1;z++) for(int y=ZI-1;y<=ZI+1;y++) for(int x=ZI-1;x<=ZI+1;x++){ vec3 g = vec3(float(x), float(y), float(z)); vec3 r = g + vec3(hash13(i + g), hash13(i + g + 7.1), hash13(i + g + 3.3)) - f; float dd = dot(r, r); if(dd < d1){ d1 = dd; id = i + g; } }
  return vec2(sqrt(d1), hash13(id + 9.)); }
float craters(vec3 n, float sc){ vec2 v = vorc(n*sc); float r = 0.18 + 0.3*v.y; float rim = exp(-pow((v.x - r)/0.05, 2.)); float bowl = smoothstep(r, r*0.6, v.x); return rim*0.5 - bowl*0.35*step(0.35, v.y); }
vec3 gL = vec3(0., 1., 0.), gEm = vec3(0.);   // light direction for surfaces that depend on it, and light a surface gives off by itself
vec3 gN = vec3(0.);                            // the slope of drawn relief at the point, added to the normal the light sees
// ---- helpers for the Solar System's bodies
vec3 unTone(vec3 c){ return -log(1. - clamp(c, 0., 0.985)); }
// a direction on the unit sphere from latitude and east longitude, in degrees
vec3 sph(float la, float lo){ la = radians(la); lo = radians(lo); return vec3(cos(la)*cos(lo), sin(la), -cos(la)*sin(lo)); }
// a soft patch round (la, lo) with half-widths rla in latitude and rlo along the parallel (degrees at the equator); ll = the point's (lat, lon) in degrees
float area(vec2 ll, float la, float lo, float rla, float rlo){ float dl = mod(ll.y - lo + 540., 360.) - 180.; vec2 q = vec2((ll.x - la)/rla, dl*cos(radians(ll.x))/rlo); return exp(-dot(q, q)); }
// a round rise (h > 0) or hollow (h < 0), radius R (radians) round c: a dome, or with top towards 1 a plateau ending in a steep scarp.
// Adds its slope to gN; returns the distance from its centre in radii
float rise(vec3 n, vec3 c, float R, float h, float top){
  float cs = dot(n, c); vec3 t = n - c*cs; float s = length(t), x = s/R;
  if(cs > 0. && x < 1. && s > 1e-6){ float u = clamp((x - 0.86)/0.14, 0., 1.); gN += t/s*(-2.*x*h*(1. - top) - h*top*6.*u*(1. - u)/0.14)/R; }
  return cs > 0. ? x : 99.;
}
// a ring of mountains (h > 0) or a trough, radius R round c, width w (in radii)
float ringR(vec3 n, vec3 c, float R, float h, float w){
  float cs = dot(n, c); vec3 t = n - c*cs; float s = length(t), x = s/R;
  if(cs > 0. && s > 1e-6){ float e = exp(-pow((x - 1.)/w, 2.)); gN += t/s*(-2.*(x - 1.)/(w*w)*h*e/R); }
  return cs > 0. ? x : 99.;
}
// a field of craters: cells of 1/sc radii, a share keep of them holding a crater (a bowl with a raised rim and ejecta round it). Adds the slopes to gN
// (dep: how steep), returns a change of brightness: fresh rims and ejecta brighter, floors a little darker, the youngest brightest
float crf(vec3 n, float sc, float keep, float dep, float sd){
  vec3 p = n*sc + sd, i = floor(p), f = fract(p); float d1 = 8.; vec3 r1 = vec3(0.), id = vec3(0.);
  for(int z=ZI-1;z<=ZI+1;z++) for(int y=ZI-1;y<=ZI+1;y++) for(int x=ZI-1;x<=ZI+1;x++){ vec3 g = vec3(float(x), float(y), float(z)), c = i + g; vec3 r = g + vec3(hash13(c), hash13(c + 7.1), hash13(c + 3.3)) - f; float dd = dot(r, r); if(dd < d1){ d1 = dd; r1 = r; id = c; } }
  float h = hash13(id + 9.); if(h > keep) return 0.;
  float R = 0.2 + 0.28*hash13(id + 4.2), d = sqrt(d1), x = d/R;
  if(x > 1.8) return 0.;
  float dH = x < 1. ? 2.4*x : -0.9*exp(-(x - 1.)*3.6);
  gN += (-r1/max(d, 1e-4))*dH*smoothstep(1.8, 1.2, x)*dep/R;
  float young = 1. + 2.*step(h, keep*0.2);
  return (x < 1. ? -0.03 + 0.11*smoothstep(0.72, 1., x) : 0.1*exp(-(x - 1.)*2.5))*young;
}
// a young crater's bright ray system round c: a bright halo and thin streaks running out over about len radians
float rays(vec3 n, vec3 c, float len, float sd){
  float cs = dot(n, c); if(cs < 0.2) return 0.;
  vec3 t = n - c*cs; float s = length(t);
  vec3 e1 = normalize(cross(c, vec3(0.13, 0.99, 0.05))), e2 = cross(c, e1);
  vec2 u = vec2(dot(t, e1), dot(t, e2))/max(s, 1e-5);
  float st = smoothstep(0.5, 0.82, noise(vec3(u*11., sd)))*smoothstep(0.25, 0.7, noise(vec3(u*3.2, sd + 5.)));
  return st*exp(-s/len)*smoothstep(0., len*0.15, s) + exp(-s*s/(len*len*0.012));
}
// the distance (radians) from n to a chain of great-circle arcs through c[0] to c[k-1] (a canyon or a line of cliffs traced from a map), and in g
// the way that distance grows (a unit vector along the surface)
float chainD(vec3 n, vec3 c[12], int k, out vec3 g){
  float best = 9.; g = vec3(0.);
  for(int i=ZI;i<k-1;i++){
    vec3 a = c[i], b = c[i + 1], q = normalize(cross(a, b));
    float t = atan(dot(n, cross(q, a)), dot(n, a)), L = acos(clamp(dot(a, b), -1., 1.)), d; vec3 gd;
    if(t > 0. && t < L){ float r = asin(clamp(dot(n, q), -1., 1.)); d = abs(r); gd = (q - n*dot(n, q))*sign(r); }
    else { vec3 e = t <= 0. ? a : b; float ce = dot(n, e); d = acos(clamp(ce, -1., 1.)); gd = n*ce - e; }   // (past an end: from that end)
    if(d < best){ best = d; g = gd; }
  }
  g /= max(length(g), 1e-5);
  return best;
}
// the slope across a trough of half-width w (radians) and depth h (radii; h < 0 for a ridge) with a low raised rim either side, d from its middle
float troughS(float d, float w, float h){ float x = d/w, y = x - 1.35; return h/w*(2.*x*exp(-x*x) - 6.*y*exp(-y*y/0.1)); }
// a crater or basin of radius R round c: a sunk floor (depth h, flattened by top) inside a raised rim; returns the distance from its centre in radii
float crat(vec3 n, vec3 c, float R, float h, float top){ ringR(n, c, R, h*0.45, 0.14); return rise(n, c, R*0.92, -h, top); }
// the Solar System's own bodies: the colour each point shows in full sunlight (display-referred, see above)
#if SOL
vec3 solSurf(vec3 n){
  float lat = n.y, lon = atan(-n.z, n.x);
  vec2 ll = vec2(degrees(asin(clamp(lat, -1., 1.))), degrees(lon));
#if KIND == 0
  { // Mercury: grey and cratered, with bright young ray craters (Hokusai, Debussy, Kuiper, Degas), the Caloris basin (bright plains inside a
    // ring of mountains, dark low-reflectance material round it) and the smoother plains round the north pole
    float pl = smoothstep(50., 66., ll.x);
    float a = crf(n, 4.2, 0.62, 0.09*(1. - 0.6*pl), 0.) + crf(n, 8.6, 0.55, 0.045*(1. - 0.7*pl), 3.7)*0.7;
    vec3 c = vec3(0.5, 0.48, 0.45)*(0.84 + 0.32*fbm3(n*3.6 + 2.))*(1. + a);
    c = mix(c, vec3(0.58, 0.55, 0.5), pl*0.5);
    vec3 cal = sph(30.5, -170.2);
    float xc = ringR(n, cal, 0.314, 0.02*(0.1 + 1.8*noise(n*9. + 2.)), 0.18);
    c = mix(c, vec3(0.64, 0.58, 0.5)*(0.9 + 0.2*fbm3(n*9.)), smoothstep(1., 0.85, xc)*0.75);                               // the plains that flooded Caloris
    float lrm = smoothstep(0.6, 0.0, abs(xc - 1.35))*0.7 + area(ll, -16.2, -164.7, 9., 10.)*0.8 + area(ll, -32.9, 87.9, 10., 11.)*0.5 + smoothstep(0.58, 0.78, fbm3(n*2.6 + 9.))*0.6;
    c = mix(c, vec3(0.3, 0.31, 0.34), clamp(lrm, 0., 1.)*0.7);                                                              // low-reflectance material
    c = mix(c, vec3(0.68, 0.64, 0.56), area(ll, 27.6, 57.6, 3., 3.)*0.8);                                                   // Rachmaninoff's bright floor
    float ry = rays(n, sph(57.8, 16.8), 0.4, 1.) + rays(n, sph(-33.9, -12.5), 0.3, 2.) + rays(n, sph(-11.3, -31.2), 0.16, 3.)*0.9 + rays(n, sph(37.1, -127.3), 0.2, 4.)*0.8;
    return mix(c, vec3(0.9, 0.88, 0.84), clamp(ry, 0., 1.)*0.85);
  }
#elif KIND == 1
  { // Venus: sulphuric acid clouds racing round in 4 days (sped up). To the eye they are nearly plain; the dark Y and the chevrons are
    // drawn as ultraviolet photos show them (the readout says so), with brighter polar hoods
    float w = lon + uTime*0.06, al = abs(ll.x);
    vec3 q = vec3(cos(w)*cos(radians(ll.x)), lat, sin(w)*cos(radians(ll.x)));
    float tb = fbm3(q*vec3(3., 8., 3.) + 2.), tf = fbm3(q*vec3(6., 18., 6.) + 9.);
    float s = mod(w, 6.2832);
    // the dark Y on its side: a stem along the equator a quarter of the way round, then two arms curving out to 45 degrees
    float u = smoothstep(1.6, 3.6, s);
    float y = exp(-pow((al - 45.*u*u)/(10. + 6.*u), 2.))*smoothstep(0.5, 1.2, s)*smoothstep(4.6, 3.8, s);
    // chevrons: broad bands bent into V shapes with their points on the equator, pointing the way the clouds go
    float chev = smoothstep(0.35, 0.8, 0.5 + 0.5*sin(2.*w - radians(al)*3.5 + (tb - 0.5)*2.5));
    float dk = clamp(0.9*y + 0.45*chev*smoothstep(58., 25., al) + 0.25*exp(-al*al/400.) + (tb - 0.5)*0.5 + (tf - 0.5)*0.25, 0., 1.);
    vec3 c = mix(vec3(0.78, 0.7, 0.52), vec3(0.48, 0.39, 0.26), dk);
    // bright polar hoods, each ringed by a darker collar
    c = mix(c, vec3(0.56, 0.48, 0.35), exp(-pow((al - 62.)/5., 2.))*0.5);
    return mix(c, vec3(0.82, 0.77, 0.64), smoothstep(64., 74., al)*0.85);
  }
#elif KIND == 2
  { // Mars: the classical bright and dark markings (albedo maps) at their real places, Tharsis and its volcanoes, Olympus Mons,
    // Valles Marineris, bright Hellas and Argyre basins, the polar caps (drawn as in late spring) with the dark dune collar round the north one
    vec2 w = ll + (vec2(fbm3(n*3.1 + 11.), fbm3(n*3.1 + 23.)) - 0.5)*vec2(8., 13.);
    float dk = 0.;
    dk += 0.9*area(w, 18., 67., 4., 3.5) + 0.9*area(w, 11., 68., 5., 5.5) + 0.9*area(w, 4., 70., 6., 8.) + 0.75*area(w, -3., 72., 5., 10.);   // Syrtis Major, narrowing to the north
    dk += 0.95*area(w, -7., 22., 5., 20.) + 0.85*area(w, -5., 45., 5., 12.);                                         // Sinus Sabaeus
    dk += 0.95*area(w, -3., 0., 4., 8.);                                                                            // Sinus Meridiani
    dk += 0.8*area(w, -10., -24., 8., 7.) + 0.7*area(w, -26., -38., 10., 20.) + 0.7*area(w, -14., -51., 5., 7.);     // Margaritifer Sinus, Mare Erythraeum, Aurorae Sinus
    dk += 0.8*area(w, -26., -88., 6., 9.) + 0.45*area(w, -12., -110., 6., 8.);                                       // Solis Lacus, Phoenicis Lacus
    dk += 0.85*area(w, -30., -150., 7., 22.) + 0.9*area(w, -20., 145., 8., 22.) + 0.85*area(w, -14., 110., 8., 14.); // Mare Sirenum, Mare Cimmerium, Mare Tyrrhenum
    dk += 0.6*area(w, -22., 78., 6., 9.) + 0.55*area(w, -31., 25., 6., 13.) + 0.5*area(w, -38., 95., 6., 8.);        // Iapygia, Mare Serpentis, Mare Hadriacum
    dk += 0.95*area(w, 46., -30., 12., 17.) + 0.6*area(w, 32., -32., 6., 8.);                                        // Mare Acidalium, Niliacus Lacus
    dk += 0.45*area(w, 46., 105., 10., 22.) + 0.45*area(w, 40., 70., 4., 14.) + 0.45*area(w, 12., 158., 5., 10.);    // Utopia, Nilosyrtis, Cerberus
    dk += 0.7*exp(-pow((w.x - 69.)/3., 2.)) + 0.4*exp(-pow((w.x + 62.)/7., 2.))*(0.4 + noise(n*5.));                // the dark dunes round the north cap, Mare Australe
    float dark = smoothstep(0.15, 0.85, dk + (fbm3(n*8. + 3.) - 0.5)*0.4);
    vec3 c = mix(vec3(0.86, 0.53, 0.3)*(0.84 + 0.3*fbm3(n*6. + 7.)), vec3(0.37, 0.27, 0.21)*(0.9 + 0.2*fbm3(n*11.)), dark);
    float bright = area(w, -42., 70., 13., 17.) + 0.85*area(w, -50., -44., 9., 12.);                              // Hellas, Argyre
    c = mix(c, vec3(0.92, 0.74, 0.55), clamp(bright, 0., 1.)*0.85);
    c = mix(c, vec3(0.9, 0.6, 0.36), (area(ll, 12., -118., 18., 26.)*0.5 + area(ll, 22., 8., 14., 22.)*0.35 + area(ll, 25., 150., 9., 12.)*0.35)*(1. - dark));   // Tharsis, Arabia, Elysium
    // relief: Olympus Mons (a shield 600 km wide ringed by a cliff), the three Tharsis Montes, Alba Mons, Elysium Mons; Valles Marineris
    float xo = rise(n, sph(18.65, -133.8), 0.094, 0.05, 0.55);
    rise(n, sph(-8.3, -120.1), 0.062, 0.05, 0.1); rise(n, sph(0.8, -113.4), 0.058, 0.05, 0.1); rise(n, sph(11.8, -104.5), 0.058, 0.05, 0.1);
    rise(n, sph(40.5, -109.9), 0.17, 0.02, 0.); rise(n, sph(25., 147.2), 0.05, 0.035, 0.1);
    c *= 1. - 0.3*exp(-xo*xo/0.02) + 0.12*smoothstep(0.8, 1., xo)*smoothstep(1.25, 1., xo);                        // its caldera, and bright cliffs
    float vla = mix(-7., -13.5, smoothstep(-100., -66., ll.y)) + 3.*smoothstep(-52., -38., ll.y), vw = mix(1., 2.6, smoothstep(-95., -75., ll.y)*smoothstep(-40., -58., ll.y));
    float vm = smoothstep(-104., -98., ll.y)*smoothstep(-34., -42., ll.y), vs = (ll.x - vla)/vw, ve = exp(-vs*vs)*vm;
    gN += normalize(vec3(0., 1., 0.) - n*lat)*(2.*vs/vw*ve*57.3*0.004);                                           // (the walls of the canyon)
    c = mix(c, vec3(0.34, 0.22, 0.16), ve*0.75);
    // polar caps: the north cap with Chasma Boreale cut into it; the small south cap sits off the pole
    float capN = smoothstep(71., 73.5, ll.x + 3.*(noise(n*14.) - 0.5))*(1. - 0.8*area(ll, 83., -5., 2.5, 12.));
    float capS = exp(-pow(length(n - sph(-86.5, -45.)), 2.)/0.008) + smoothstep(-77., -80., ll.x + 2.*(noise(n*12.) - 0.5))*0.7;
    return mix(c, vec3(0.97, 0.95, 0.92), clamp(capN + capS, 0., 1.));
  }
#elif KIND == 3
  { // Uranus: pale cyan, almost featureless; the bright hood over the sunlit north pole with a darker band round its edge, faint bands
    // and now and then a bright storm near the hood's edge (as Hubble, Keck and JWST have shown it in the 2020s)
    float al = ll.x, t = fbm3(n*vec3(3., 11., 3.) + vec3(uTime*0.004, 0., 0.));
    float bands = 0.5 + 0.5*sin(radians(al)*14. + t*2.2);
    vec3 c = mix(vec3(0.33, 0.51, 0.55), vec3(0.4, 0.58, 0.61), bands*0.7);
    c = mix(c, vec3(0.25, 0.42, 0.48), exp(-pow((al - 47.)/5., 2.))*0.8);                                                  // the dark band round the hood
    c = mix(c, vec3(0.6, 0.73, 0.73), smoothstep(52., 64., al + 3.*(t - 0.5)));                                           // the polar hood
    float st = smoothstep(0.7, 0.88, noise(vec3(lon*5. + uTime*0.01, al*0.35, 3.)))*exp(-pow((al - 55.)/3., 2.));
    return mix(c, vec3(0.8, 0.88, 0.88), st*0.8);
  }
#elif KIND == 4
  { // Neptune: azure bands, a dark vortex with bright companion clouds, fast white streaks of methane ice cloud
    float w = lon + uTime*0.05*(1. - 1.5*lat*lat);
    vec3 q = vec3(cos(w)*sqrt(1. - lat*lat), lat, sin(w)*sqrt(1. - lat*lat));
    float b = sin(radians(ll.x)*12. + fbm3(q*vec3(4., 14., 4.))*2.)*0.5 + 0.5;
    vec3 c = mix(vec3(0.17, 0.31, 0.6), vec3(0.3, 0.5, 0.8), b);
    c = mix(c, vec3(0.16, 0.28, 0.54), exp(-pow((ll.x + 62.)/6., 2.))*0.7);                                                // the dark band round the south pole
    c = mix(c, vec3(0.34, 0.52, 0.8), smoothstep(-72., -82., ll.x)*0.7);
    vec2 s = vec2(atan(sin(w - 1.), cos(w - 1.)), (lat + 0.35)*2.6); float sr = length(s*vec2(1., 1.7));
    c = mix(c, vec3(0.08, 0.13, 0.32), smoothstep(0.24, 0.12, sr));
    float cl = smoothstep(0.74, 0.88, fbm3(q*vec3(7., 30., 7.) + 3.))*smoothstep(10., 30., abs(ll.x)) + exp(-pow(sr - 0.28, 2.)/0.003)*0.9 + smoothstep(0.55, 0.8, noise(vec3(w*4., ll.x*0.4, 5.)))*exp(-pow((ll.x + 42.)/3., 2.))*0.8;
    return mix(c, vec3(0.86, 0.9, 0.94), clamp(cl, 0., 1.));
  }
#elif KIND == 5
  { // Pluto: the pale heart (Sputnik Planitia, the bright nitrogen-ice lobe, and the rest of Tombaugh Regio), the dark red belt of Cthulhu,
    // Krun and the smaller maculae along the equator, the grey-yellow north polar cap (New Horizons, 2015)
    vec2 w = ll + (vec2(fbm3(n*4. + 3.), fbm3(n*4. + 8.)) - 0.5)*vec2(8., 10.);
    float sp = smoothstep(0.35, 0.6, area(w, 20., 178., 22., 20.) + area(w, 2., 186., 10., 9.)*0.6);                       // Sputnik Planitia
    float te = smoothstep(0.3, 0.65, area(w, 12., 215., 18., 18.))*(0.7 + 0.3*fbm3(n*9.));                                // eastern Tombaugh Regio
    float dk = area(w, -3., 95., 16., 55.) + 0.9*area(w, -10., 255., 10., 18.) + 0.7*area(w, -2., 300., 8., 12.) + 0.7*area(w, -5., 330., 8., 12.) + 0.4*area(w, -18., 30., 10., 16.);
    dk = smoothstep(0.35, 0.7, dk + (fbm3(n*7.) - 0.5)*0.3)*(1. - sp);
    vec3 c = vec3(0.62, 0.5, 0.39)*(0.85 + 0.3*fbm3(n*6.));
    c = mix(c, vec3(0.6, 0.57, 0.52), smoothstep(45., 65., ll.x)*0.8);                                                   // Lowell Regio
    c = mix(c, vec3(0.3, 0.16, 0.11), dk);
    c = mix(c, vec3(0.8, 0.74, 0.65), te*(1. - sp));
    return mix(c, vec3(0.88, 0.85, 0.8)*(0.95 + 0.05*noise(n*30.)), sp);
  }
#elif KIND == 6
  { // the Moon: the maria (lava plains) at their real selenographic places, cratered highlands, the South Pole-Aitken basin,
    // bright rayed craters (Tycho, Copernicus, Kepler, Aristarchus, Proclus; Giordano Bruno and Jackson on the far side), Orientale's rings
    vec2 w = ll + (vec2(fbm3(n*3.3 + 5.), fbm3(n*3.3 + 17.)) - 0.5)*vec2(7., 9.);
    float m = 0.;
    m += area(w, 33., -16., 10., 12.) + 0.8*area(w, 44., -31., 3., 5.);                    // Imbrium, Sinus Iridum
    m += area(w, 28., 17.5, 7., 8.) + area(w, 8.5, 31., 8., 11.) + area(w, 17., 59., 5., 6.);   // Serenitatis, Tranquillitatis, Crisium
    m += 0.9*area(w, -8., 51., 7., 6.) + 0.9*area(w, -15., 35., 4., 4.);                   // Fecunditatis, Nectaris
    m += 0.9*area(w, -21., -17., 7., 9.) + 0.7*area(w, -10., -23., 4., 5.) + 0.9*area(w, -24., -39., 5., 5.);   // Nubium, Cognitum, Humorum
    m += area(w, 15., -56., 20., 13.) + 0.8*area(w, -3., -45., 8., 10.) + 0.7*area(w, 38., -46., 8., 12.) + 0.7*area(w, 7., -31., 5., 6.);   // Oceanus Procellarum, Insularum
    m += 0.8*area(w, 56., 0., 3.5, 38.) + 0.7*area(w, 13., 4., 3., 4.) + 0.5*area(w, 2., 1., 2., 3.);                  // Frigoris, Vaporum, Sinus Medii
    m += 0.6*area(w, 13., 86., 4., 4.) + 0.6*area(w, -2., 87., 4., 4.) + 0.5*area(w, 7., 68., 2.5, 3.) + 0.5*area(w, -39., 93., 5., 6.) + 0.5*area(w, 57., 81., 3., 5.);   // Marginis, Smythii, Undarum, Australe, Humboldtianum
    m += 0.6*area(w, -19., -93., 3., 3.);                                                  // Orientale
    m += 0.8*area(w, 27., 148., 4., 4.) + 0.8*area(w, -20., 129., 2., 2.) + 0.5*area(w, -34., 164., 3., 3.) + 0.45*area(w, -36., -151., 5., 5.);   // far side: Moscoviense, Tsiolkovskiy, Ingenii, Apollo
    float mare = smoothstep(0.3, 0.72, m + (fbm3(n*9.) - 0.5)*0.3);
    float a = (crf(n, 4.4, 0.62, 0.09*(1. - 0.6*mare), 1.) + crf(n, 9., 0.55, 0.045*(1. - 0.6*mare), 5.3)*0.7)*(1. - 0.75*mare);   // (the seas are younger, with fewer craters)
    ringR(n, sph(-19.4, -92.8), 0.27, 0.018*(0.2 + 1.6*noise(n*9.)), 0.11); ringR(n, sph(-19.4, -92.8), 0.18, 0.011*(0.2 + 1.6*noise(n*9. + 4.)), 0.12);                          // Orientale's rings of mountains
    vec3 hi = vec3(0.58, 0.57, 0.54)*(0.86 + 0.28*fbm3(n*4. + 1.));
    hi = mix(hi, vec3(0.44, 0.43, 0.42), area(ll, -53., -169., 24., 24.)*0.6);                                              // the South Pole-Aitken basin
    vec3 mc = mix(vec3(0.29, 0.28, 0.27), vec3(0.25, 0.27, 0.31), min(area(ll, 8.5, 31., 9., 12.) + area(ll, 15., -56., 20., 13.)*0.5, 1.))*(0.88 + 0.24*fbm3(n*7.));   // (the titanium-rich seas are a little bluer)
    vec3 c = mix(hi, mc, mare)*(1. + a);
    float ry = rays(n, sph(-43.3, -11.2), 0.6, 1.) + rays(n, sph(9.6, -20.1), 0.25, 2.)*0.9 + rays(n, sph(8.1, -38.), 0.14, 3.)*0.8 + rays(n, sph(23.7, -47.4), 0.08, 4.)
      + rays(n, sph(16.1, 46.8), 0.12, 5.)*0.7 + rays(n, sph(36., 103.), 0.14, 6.)*0.8 + rays(n, sph(22., -163.), 0.16, 7.)*0.7;
    return mix(c, vec3(0.86, 0.86, 0.84), clamp(ry, 0., 1.)*0.8);
  }
#elif KIND == 7
  { // Io: sulphur plains, reddish-brown poles, dark volcanic calderas (Loki the biggest), the red ring of Pele, white sulphur dioxide frost
    float f = fbm(n*4. + 1.), g = fbm3(n*12.);
    vec3 c = mix(vec3(0.74, 0.66, 0.33), vec3(0.66, 0.46, 0.2), smoothstep(0.42, 0.7, f));
    c = mix(c, vec3(0.8, 0.79, 0.68), smoothstep(0.58, 0.78, g)*smoothstep(50., 25., abs(ll.x))*0.7);
    c = mix(c, vec3(0.44, 0.32, 0.22), smoothstep(45., 70., abs(ll.x))*0.8);
    vec2 v = vorc(n*6.); c = mix(c, vec3(0.1, 0.07, 0.05), min(smoothstep(0.12, 0.05, v.x)*step(0.6, v.y) + area(ll, 12.6, 51.2, 3., 3.), 1.));
    float pele = length(n - sph(-18.7, 104.7));
    return mix(c, vec3(0.72, 0.32, 0.16), exp(-pow((pele - 0.25)/0.05, 2.))*0.75);
  }
#elif KIND == 8
  { // Europa: water ice crossed by rust-coloured lineae; the trailing side (centred on 90 deg E) darker and redder; Pwyll's rays
    float l1 = 1. - abs(noise(n*vec3(20., 4., 20.))*2. - 1.), l2 = 1. - abs(noise(n*vec3(5., 22., 9.) + 3.)*2. - 1.);
    float lin = pow(max(l1, l2), 14.);
    vec3 c = mix(vec3(0.74, 0.71, 0.64), vec3(0.62, 0.52, 0.4), smoothstep(0.45, 0.75, fbm3(n*4.)));
    c = mix(c, vec3(0.5, 0.4, 0.3), area(ll, 0., 90., 45., 60.)*0.6);
    c = mix(c, vec3(0.52, 0.3, 0.18), lin*0.85);
    return mix(c, vec3(0.85, 0.84, 0.8), clamp(rays(n, sph(-25., 89.), 0.3, 2.), 0., 1.)*0.7);
  }
#elif KIND == 9
  { // Ganymede: dark ancient terrain (Galileo Regio the largest piece), bright grooved terrain, frosty poles, bright ray craters
    vec2 w = ll + (vec2(fbm3(n*3. + 2.), fbm3(n*3. + 6.)) - 0.5)*vec2(24., 30.);
    float dk = area(w, 35., -145., 22., 30.) + 0.9*area(w, -10., 170., 25., 35.) + 0.8*area(w, -20., 0., 15., 22.) + 0.7*area(w, 40., 30., 14., 20.);
    dk = smoothstep(0.35, 0.75, max(dk, smoothstep(0.5, 0.62, fbm(n*2.6 + 7.))*0.8) + (fbm(n*4. + 7.) - 0.5)*0.9);   // (and smaller pieces all round)
    float a = crf(n, 5., 0.5, 0.06, 2.);
    vec3 c = mix(vec3(0.62, 0.6, 0.56)*(0.9 + 0.2*pow(noise(n*vec3(24., 4., 24.)), 2.)), vec3(0.34, 0.31, 0.27), dk)*(1. + a);
    c = mix(c, vec3(0.8, 0.82, 0.84), smoothstep(40., 60., abs(ll.x))*0.6);
    return mix(c, vec3(0.86, 0.86, 0.84), clamp(rays(n, sph(-38., -166.), 0.18, 1.) + rays(n, sph(11., -27.), 0.16, 2.), 0., 1.)*0.8);
  }
#elif KIND == 10
  { // Callisto: dark and saturated with craters, the bright bullseye of the Valhalla basin
    float a = crf(n, 5., 0.7, 0.07, 4.) + crf(n, 11., 0.7, 0.05, 1.3)*0.8;
    vec3 vh = sph(14.7, -56.4); float xv = length(n - vh);
    vec3 c = vec3(0.33, 0.29, 0.25)*(0.85 + 0.3*fbm3(n*5.))*(1. + 1.4*a);
    c = mix(c, vec3(0.62, 0.58, 0.52), min(exp(-xv*xv/0.012)*0.8 + (0.5 + 0.5*cos(xv*60.))*smoothstep(0.55, 0.15, xv)*0.25, 1.));
    return c + vec3(0.3)*step(0.986, hash13(floor(n*50.)));
  }
#elif KIND == 11
  { // Titan: an opaque orange haze, darker in the north
    return mix(vec3(0.56, 0.36, 0.14), vec3(0.64, 0.44, 0.19), smoothstep(0.3, 0.9, lat*0.5 + 0.5)*0.4 + 0.12*fbm3(n*3.));
  }
#elif KIND == 12
  { // Enceladus: brilliant fresh ice, tiger stripes at the south pole
    float tig = pow(1. - abs(sin((lon*0.4 + lat*9.)*3.)), 20.)*smoothstep(-0.8, -0.95, lat);
    return mix(vec3(0.74, 0.76, 0.79), vec3(0.36, 0.5, 0.6), tig)*(0.94 + 0.8*crf(n, 7., 0.4, 0.04, 2.));
  }
#elif KIND == 13
  { // old, cratered ice (TRAPPIST-1 f, g and h, drawn as guesses)
    return vec3(0.66, 0.65, 0.62)*(0.86 + 0.2*fbm3(n*5.))*(1. + crf(n, 5., 0.6, 0.08, 6.) + 0.8*crf(n, 11., 0.5, 0.05, 2.));
  }
#elif KIND == 25
  { // Tethys: bright old ice (positions from the IAU gazetteer; longitudes west there, so east = -west here). The side it leads with
    // (centred on 90 W) is brighter than the trailing side, and carries the dark bluish lens across its equator that fast electrons leave
    // (Schenk et al. 2011: 20 deg either side of the equator at 90 W, narrowing to a few degrees at 0 and 180 W). Odysseus, a basin 445 km
    // wide whose rim and peak have slumped, with Scheria Montes in its middle; Ithaca Chasma, a canyon up to 100 km wide and about 3 km deep
    // with raised rims, about 2,000 km from 70 S up to the north polar region (traced from the USGS map); the biggest old craters
    float a = crf(n, 5.4, 0.62, 0.06, 6.) + 0.8*crf(n, 11.5, 0.5, 0.04, 2.);
    vec3 c = vec3(0.63, 0.63, 0.61)*(0.9 + 0.14*fbm3(n*5. + 3.))*(1. + a);
    c *= mix(vec3(1.), vec3(0.8, 0.76, 0.71), smoothstep(0.15, -0.9, n.z));          // (the trailing side, darkest and reddest at 270 W)
    float dl = abs(mod(ll.y + 90. + 540., 360.) - 180.), hw = 3. + 17.*cos(radians(min(dl, 90.)));
    c = mix(c, c*vec3(0.62, 0.7, 0.84), smoothstep(hw + 2.5, hw - 2.5, abs(ll.x))*smoothstep(97., 88., dl)*0.9);
    vec3 od = sph(32.82, -128.89);
    float xo = rise(n, od, 0.42, -0.035, 0.55);
    ringR(n, od, 0.42, 0.012*(0.4 + 1.2*noise(n*8.)), 0.1);
    rise(n, sph(30., -131.), 0.17, 0.02*(0.5 + noise(n*11.)), 0.);
    c *= 1. - 0.1*smoothstep(1., 0.8, xo) + 0.12*exp(-pow((xo - 1.)/0.07, 2.));
    vec3 ic[12] = vec3[12](sph(-70., -65.), sph(-57., -33.5), sph(-26., -21.), sph(-9., -6.), sph(3., 3.), sph(22., 12.), sph(38., 19.), sph(54., 21.),
      sph(64., 39.), sph(63., 70.), sph(62., 100.), sph(62., 100.));
    vec3 g; float di = chainD(n, ic, 11, g);
    float tp = smoothstep(0., 0.2, acos(clamp(dot(n, ic[0]), -1., 1.)))*smoothstep(0., 0.2, acos(clamp(dot(n, ic[10]), -1., 1.)));
    gN += g*troughS(di, 0.094, 0.022*tp);
    c *= 1. + (0.14*exp(-pow((di - 0.125)/0.03, 2.)) - 0.32*exp(-pow(di/0.075, 2.)))*tp;   // (its floor darker, its raised rims brighter)
    crat(n, sph(-10.83, -249.22), 0.195, 0.014, 0.4); crat(n, sph(-58.5, -192.61), 0.235, 0.014, 0.4); crat(n, sph(-34.53, -356.89), 0.3, 0.01, 0.5);
    crat(n, sph(-30.15, -210.33), 0.179, 0.012, 0.4); crat(n, sph(-59.89, -286.15), 0.13, 0.012, 0.3); crat(n, sph(54., -339.38), 0.087, 0.012, 0.3);
    return c;
  }
#elif KIND == 26
  { // Dione: the side it leads with bright and cratered, the trailing side much darker (0.71 against 0.44 at 0.55 um, Filacchione et al. 2022),
    // crossed by the wispy terrain: bright ice cliffs, the walls of canyons, bright where the darker material has fallen off them. Palatine and Eurotas Chasmata,
    // Padua Chasmata, Clusium Fossae, Drepanum Chasma and Carthage Fossae, traced from the USGS map and drawn wider than the real cliffs so they
    // show; finer cliffs between them. Creusa's bright rays over the leading side and the side facing Saturn; Evander, Aeneas, Dido and other
    // craters; Janiculum Dorsa, a ridge 1 to 2 km high
    float tr = smoothstep(0.3, -0.85, n.z);
    float a = (crf(n, 5.6, 0.6, 0.06, 4.) + 0.8*crf(n, 12., 0.55, 0.04, 9.))*(1. - 0.4*tr);
    vec3 c = mix(vec3(0.62, 0.61, 0.59), vec3(0.34, 0.33, 0.31), tr)*(0.9 + 0.16*fbm3(n*5. + 1.))*(1. + a);
    vec3 g, g2; float w;
    vec3 pe[12] = vec3[12](sph(-72., -338.), sph(-57., -326.), sph(-48., -318.), sph(-41., -313.), sph(-31., -310.), sph(-15., -306.), sph(-2.5, -302.8),
      sph(18.5, -295.8), sph(44., -293.), sph(44., -293.), sph(44., -293.), sph(44., -293.));
    float d1 = chainD(n, pe, 9, g);
    vec3 pa[12] = vec3[12](sph(45., -221.), sph(25., -244.), sph(14., -249.), sph(-1., -244.), sph(-14., -232.), sph(-24., -226.),
      sph(47., -311.), sph(30., -293.), sph(12., -357.), sph(12., -322.), sph(-27., -263.), sph(-66., -267.));
    float d2 = chainD(n, pa, 6, g2), d3 = 9.;
    for(int i=ZI;i<3;i++){ vec3 p2[12]; p2[0] = pa[6 + i*2]; p2[1] = pa[7 + i*2]; vec3 gi; d3 = min(d3, chainD(n, p2, 2, gi)); }   // (Clusium, Carthage, Drepanum)
    float dw = min(min(d1, d2), d3);
    w = exp(-pow(dw/0.045, 2.))*(0.8 + 0.2*sin(dw*200.));                          // (several cliffs side by side)
    gN += g*troughS(d1, 0.04, 0.006) + g2*troughS(d2, 0.04, 0.006);
    // finer cliffs over the trailing side, mostly north-south and round Amata
    float m = smoothstep(0.1, -0.5, n.z)*smoothstep(70., 50., abs(ll.x));
    float f = pow(1. - abs(noise(n*vec3(22., 6., 22.) + 4.)*2. - 1.), 18.)*smoothstep(0.45, 0.65, fbm3(n*3. + 8.));
    w = max(w, f*m*0.7);
    c = mix(c, vec3(0.86, 0.86, 0.85), clamp(w, 0., 1.)*0.92);
    vec3 cr = sph(49.19, -76.32);
    c = mix(c, vec3(0.86, 0.85, 0.82), clamp(rays(n, cr, 0.8, 3.)*(1. - tr), 0., 1.)*0.55);
    crat(n, sph(-57., -145.), 0.312, 0.012, 0.6); crat(n, sph(25.89, -46.27), 0.143, 0.016, 0.4); crat(n, sph(-23.97, -18.82), 0.109, 0.018, 0.3);
    crat(n, sph(-8.15, -26.85), 0.081, 0.016, 0.3); crat(n, sph(5.17, -279.81), 0.068, 0.016, 0.3); crat(n, sph(15.59, -345.31), 0.09, 0.014, 0.3);
    vec3 jd[12] = vec3[12](sph(-22., -145.), sph(25., -144.), sph(55., -142.), vec3(0.), vec3(0.), vec3(0.), vec3(0.), vec3(0.), vec3(0.), vec3(0.), vec3(0.), vec3(0.));
    vec3 gj; float dj = chainD(n, jd, 3, gj);
    gN += gj*troughS(dj, 0.08, -0.012);
    return c;
  }
#elif KIND == 27
  { // Rhea: the side it leads with bright and the most cratered, the trailing side darker (0.67 against 0.48 at 0.55 um, Filacchione et al. 2022)
    // with bright north-south fractures (Avaiki, Galunlati, Yamsi, Pulag and Vaupas Chasmata, Kunlun Linea; drawn wider than the real cliffs);
    // Inktomi, a crater 47 km wide and likely the youngest large one in Saturn's system, with bright rays reaching hundreds of km in a
    // butterfly pattern (it was hit at a slant from the west); the basins Tirawa, 360 km wide and 5 km deep, and the older Mamaldi under it
    float tr = smoothstep(0.3, -0.85, n.z);
    float a = (crf(n, 5.8, 0.72, 0.065, 7.) + 0.85*crf(n, 12.5, 0.62, 0.045, 3.))*(1. - 0.3*tr);
    vec3 c = mix(vec3(0.61, 0.6, 0.58), vec3(0.4, 0.39, 0.37), tr)*(0.9 + 0.16*fbm3(n*5. + 2.))*(1. + a);
    vec3 fr[12] = vec3[12](sph(3., -279.), sph(47., -279.), sph(4., -290.), sph(60., -290.), sph(-42., -280.5), sph(-14., -280.5),
      sph(-40., -266.5), sph(-26., -266.5), sph(-42., -260.), sph(-24., -260.), sph(40., -304.), sph(50., -312.));
    float dw = 9.; vec3 gw = vec3(0.);
    for(int i=ZI;i<6;i++){ vec3 p2[12]; p2[0] = fr[i*2]; p2[1] = fr[i*2 + 1]; vec3 gi; float di = chainD(n, p2, 2, gi); if(di < dw){ dw = di; gw = gi; } }
    gN += gw*troughS(dw, 0.035, 0.005);
    c = mix(c, vec3(0.85, 0.86, 0.87), exp(-pow(dw/0.04, 2.))*(0.8 + 0.2*sin(dw*240.))*0.9);
    vec3 ik = sph(-14.1, -112.1), ie = normalize(cross(vec3(0., 1., 0.), ik)), t = n - ik*dot(n, ik);
    float s = length(t), ue = dot(t, ie)/max(s, 1e-5), un = sqrt(max(1. - ue*ue, 0.));
    float ry = rays(n, ik, 0.45, 5.)*(0.35 + 0.65*un)*(1. - 0.6*smoothstep(0., -0.9, ue));
    c = mix(c, vec3(0.88, 0.88, 0.86), clamp(ry + exp(-s*s/0.0012), 0., 1.)*0.85);
    crat(n, ik, 0.031, 0.02, 0.2);
    crat(n, sph(34.2, -151.7), 0.236, 0.02, 0.5); crat(n, sph(14., -184.), 0.314, 0.008, 0.6);
    crat(n, sph(-8.2, -280.4), 0.178, 0.01, 0.5); crat(n, sph(-49.4, -310.2), 0.164, 0.012, 0.4); crat(n, sph(48.6, -269.7), 0.08, 0.014, 0.3);
    return c;
  }
#else
  // Ceres: dark grey, cratered, with the bright salt spots of Occator crater
  vec3 oc = normalize(vec3(cos(0.346)*cos(4.177), sin(0.346), -cos(0.346)*sin(4.177)));
  float spot = exp(-dot(n - oc, n - oc)/0.0005) + 0.6*exp(-dot(n - oc - vec3(0.03, 0.01, 0.02), n - oc - vec3(0.03, 0.01, 0.02))/0.0002);
  return vec3(0.42, 0.41, 0.4)*(0.86 + 0.2*fbm3(n*5.))*(1. + crf(n, 5., 0.6, 0.08, 3.) + 0.8*crf(n, 11., 0.55, 0.05, 8.)) + vec3(0.6)*spot;
#endif
}
#else
vec3 surface(vec3 n, float kind, out float spec){
  float lat = n.y, lon = atan(-n.z, n.x); spec = 0.;
  if(kind < 14.5){ // tidally locked rocky exoplanet: scorched day side, ice on the night side
    float f = fbm(n*4. + 3.); vec3 c = mix(vec3(0.55, 0.36, 0.26), vec3(0.72, 0.5, 0.34), f);
    return mix(c, vec3(0.85, 0.88, 0.95), smoothstep(-0.2, -0.6, n.x))*(0.85 + 0.3*craters(n, 6.));
  }
  else if(kind < 15.5){ // lava world: dark basalt crust; the side facing the star a churning sea of magma, cracks glowing on the night side
    float day = dot(n, gL), f = fbm(n*5. + vec3(uTime*0.02, 0., -uTime*0.015)), cr = fbm3(n*14. + 2.);
    float melt = smoothstep(-0.15, 0.4, day + 0.3*(f - 0.5));
    float crack = pow(1. - abs(noise(n*16. + 3.)*2. - 1.), 10.);
    gEm = mix(vec3(1., 0.32, 0.05), vec3(1., 0.78, 0.32), smoothstep(0.45, 0.85, f))*(melt*(0.6 + 0.9*f) + crack*0.5*(1. - melt))*1.7*(0.8 + 0.4*noise(n*9. + uTime*0.3));
    return mix(vec3(0.12, 0.1, 0.09)*(0.7 + 0.6*cr), vec3(0.3, 0.12, 0.05), melt);
  }
  else if(kind < 16.5){ // ultra-hot giant: the day side glows by its own heat, hotter than many stars
    float day = dot(n, gL), b = sin(lat*10. + fbm3(n*vec3(3., 10., 3.) + vec3(uTime*0.03, 0., 0.))*2.)*0.5 + 0.5, hot = smoothstep(-0.35, 0.85, day);
    gEm = mix(vec3(0.85, 0.22, 0.05), vec3(1., 0.86, 0.62), hot)*(0.2 + 1.7*hot)*(0.85 + 0.3*b);
    return vec3(0.35, 0.2, 0.15);
  }
  else if(kind < 17.5){ // cold Saturn-like giant: pale butterscotch bands
    float b = sin(lat*16. + fbm3(n*vec3(3., 14., 3.) + vec3(uTime*0.01, 0., 0.))*2.)*0.5 + 0.5;
    return mix(vec3(0.78, 0.7, 0.55), vec3(0.92, 0.86, 0.72), b);
  }
  else if(kind < 18.5){ // young giant still hot from its birth: dusky clouds and a faint red glow of its own
    float b = sin(lat*12. + fbm3(n*vec3(4., 12., 4.) + vec3(uTime*0.02, 0., 0.))*2.5)*0.5 + 0.5;
    gEm = vec3(0.9, 0.3, 0.15)*(0.12 + 0.2*b);
    return mix(vec3(0.55, 0.35, 0.45), vec3(0.72, 0.52, 0.45), b);
  }
  else if(kind > 20.5){
    if(kind < 21.5){ // a hot Jupiter drawn as a guess (51 Pegasi b): dark cloud bands, the day side glowing faintly red with its own heat
      float day = dot(n, gL), b = sin(lat*11. + fbm3(n*vec3(3., 11., 3.) + vec3(uTime*0.02, 0., 0.))*2.2)*0.5 + 0.5;
      gEm = vec3(0.75, 0.2, 0.06)*smoothstep(-0.3, 0.9, day)*(0.1 + 0.12*b);
      return mix(vec3(0.42, 0.34, 0.27), vec3(0.64, 0.52, 0.4), b);
    }
    if(kind < 22.5){ // a hazy sub-Neptune drawn as a guess (K2-18 b): soft bands under a thick hydrogen sky
      float b = sin(lat*9. + fbm3(n*vec3(3., 9., 3.) + vec3(uTime*0.01, 0., 0.))*1.6)*0.5 + 0.5;
      return mix(vec3(0.5, 0.66, 0.74), vec3(0.74, 0.86, 0.9), b*0.5 + smoothstep(0.55, 0.9, abs(lat))*0.35);
    }
    if(kind < 23.5){ // HD 189733 b: deep blue (Hubble measured its colour), streaked by winds of thousands of km/h
      float w = lon + uTime*0.08*(1. - lat*lat), cl = sqrt(max(1. - lat*lat, 0.));
      vec3 q = vec3(cos(w)*cl, lat, sin(w)*cl);
      float b = sin(lat*13. + fbm3(q*vec3(4., 16., 4.))*2.4)*0.5 + 0.5;
      return mix(vec3(0.07, 0.18, 0.6), vec3(0.2, 0.4, 0.95), b*0.6 + 0.3*fbm3(q*vec3(8., 30., 8.)));
    }
    // Mimas: old ice, craters on craters (the relief of Herschel is added in main)
    return vec3(0.84, 0.83, 0.8)*(0.8 + 0.45*craters(n, 8.) + 0.25*craters(n, 19.) + 0.15*fbm3(n*5.));
  }
  // temperate rocky world locked to its star (TRAPPIST-1e, an illustrative guess): open sea around the point under the star,
  // a few rocky islands, ice beyond the warm middle and across the night side, and a slow swirl of cloud over the warmest water (plus a thin blue haze: atm in main)
  float day = dot(n, gL), f = fbm(n*3.5 + 1.), g = fbm3(n*9. + 4.);
  float sea = smoothstep(0.18, 0.42, day + 0.3*(f - 0.5));
  vec3 water = mix(vec3(0.03, 0.1, 0.26), vec3(0.07, 0.19, 0.38), g);
  vec3 rock = vec3(0.42, 0.35, 0.28)*(0.8 + 0.4*g);
  vec3 ice = mix(vec3(0.78, 0.84, 0.92), vec3(0.96, 0.97, 1.), g)*(0.9 + 0.1*noise(n*24.));
  vec3 c = mix(ice, mix(water, rock, smoothstep(0.64, 0.68, f)), sea);
  float cl = smoothstep(0.55, 0.78, fbm(n*5. + vec3(uTime*0.01, 0., 0.)))*smoothstep(0.3, 0.8, day);
  return mix(c, vec3(0.95), cl*0.6);
}
#endif
// Herschel, the giant crater on Mimas (centred 1.4 deg S, 111.8 deg W; 130 km wide). Its height in Mimas radii against the distance from its
// centre in crater radii, after NASA's figures: parts of the floor ~10 km deep, walls ~5 km high, a central peak 6 km tall
const vec3 HC = vec3(-0.37061, -0.02408, 0.92848);
const float HR = 0.328;
float herH(float x){ return x < 1. ? -0.045 + 0.057*pow(smoothstep(0.42, 1., x), 1.6) + 0.03*exp(-x*x/0.03) : 0.012*exp(-(x - 1.)/0.22); }
float herAt(vec3 q){ return herH(acos(clamp(dot(normalize(q), HC), -1., 1.))/HR); }
// the surface normal tilted by the crater's slopes, and the shadows its rim and peak cast (a short walk toward the Sun above the relief)
// (the shading uses slopes 2.5 times steeper than the real ones, so the walls and peak still read in characters with the Sun high over
// the crater; the shadows are cast by the true heights)
vec3 herschel(vec3 n, vec3 L, out float shade){
  shade = 1.;
  float th = acos(clamp(dot(n, HC), -1., 1.)), x = th/HR;
  if(x > 2.2) return n;
  vec3 t = n*dot(n, HC) - HC; float tl = length(t);
  float e = 0.004, slope = 2.5*(herH((th + e)/HR) - herH(max(th - e, 0.)/HR))/(e + min(th, e));
  vec3 nn = tl < 1e-5 ? n : normalize(n - t/tl*slope);
  if(dot(n, L) > -0.25){
    vec3 p = n*(1. + herH(x));
    for(int i=1;i<=14;i++){ vec3 q = p + L*(float(i)*0.05); if(length(q) - 1. < herAt(q) - 0.001){ shade = 0.; break; } }
  }
  return nn;
}
void main(){
  vec3 o, d; localRay(o, d);
  ZI = int(uM0[2].z);
  vec3 L = normalize(uP1.xyz*uRot);
  vec2 h = sphIsect(o, d, vec3(0.), RP);
  vec3 col = vec3(0.); float alpha = 0.;
  bool giantX = kind > 15.5 && kind < 18.5, newX = kind > 20.5, sol = SOL;
  // (the air at the limb; Pluto's is the thin blue haze New Horizons saw backlit in 2015)
  vec3 atm = newX ? (kind < 21.5 ? vec3(0.9, 0.55, 0.35) : (kind < 22.5 ? vec3(0.6, 0.8, 0.95) : (kind < 23.5 ? vec3(0.35, 0.55, 1.) : vec3(0.)))) : giantX ? (kind < 16.5 ? vec3(1., 0.55, 0.25) : (kind < 17.5 ? vec3(0.9, 0.8, 0.6) : vec3(0.8, 0.45, 0.55))) : kind > 19.5 ? vec3(0.45, 0.65, 1.) : kind > 4.5 && kind < 5.5 ? vec3(0.4, 0.62, 1.) : kind < 0.5 || (kind > 4.5 && kind < 11.) || kind > 11.5 ? vec3(0.) : (kind < 1.5 ? vec3(1., 0.85, 0.55) : (kind < 2.5 ? vec3(0.95, 0.62, 0.45) : (kind < 3.5 ? vec3(0.55, 0.85, 0.95) : (kind < 4.5 ? vec3(0.4, 0.55, 1.) : vec3(0.95, 0.6, 0.25)))));
  float atmK = newX ? (kind < 21.5 ? 0.7 : (kind < 22.5 ? 1.1 : 0.9)) : giantX ? 0.8 : kind > 19.5 ? 0.4 : kind > 4.5 && kind < 5.5 ? 0.3 : kind < 1.5 ? 0.9 : (kind < 2.5 ? 0.35 : (kind < 4.5 ? 0.7 : 1.));
  if(h.x > 0.){
    vec3 p = o + d*h.x, n = p/RP;
    gL = L; gN = vec3(0.);
#if SOL
    vec3 base = solSurf(n);
#else
    float spec; vec3 base = surface(n, kind, spec);
#endif
    float mu = max(dot(n, -d), 0.), sh = 1.;
    vec3 nl = n;
    if(kind > 23.5 && kind < 24.5){   // (Mimas: the slopes and shadows of Herschel; its floor a shade darker than the fresh ice of its walls and peak)
      nl = herschel(n, L, sh); float x = acos(clamp(dot(n, HC), -1., 1.))/HR;
      base *= 1. - 0.14*smoothstep(0.85, 0.5, x) + 0.12*exp(-pow((x - 0.9)/0.1, 2.)) + 0.12*exp(-x*x/0.02);
    }
    if(sol) nl = normalize(n - (gN - n*dot(gN, n)));
    float dif = max(dot(nl, L), 0.);
    // eclipse by a nearby body (a planet's shadow on its moon)
    if(uP2.w > 0.){ vec3 q = uP2.xyz - p; float tq = dot(q, L); if(tq > 0.){ float dq = length(q - L*tq); sh *= smoothstep(uP2.w*0.96, uP2.w*1.04, dq); } }
    if(sol){
      // the Solar System's bodies: the light rises quickly past the line between day and night and then stays nearly level across the lit
      // side (bare ground scatters light back the way it came, which is why the full Moon looks flat; cloud tops darken a little more towards
      // the edge), so the markings, not the fall-off of the light, make the picture. Relief is shaded on top of that, like a relief map:
      // each slope brighter or darker by how much more or less it faces the Sun
      bool cloud = (kind > 0.5 && kind < 1.5) || (kind > 2.5 && kind < 4.5) || (kind > 10.5 && kind < 11.5);
      float c0 = max(dot(n, L), 0.), kS = cloud ? 3.6 : 5.;
      float lam = (1. - exp(-c0*kS))/(1. - exp(-kS))*(cloud ? 0.62 + 0.38*sqrt(mu) : 0.84 + 0.16*mu);
      lam *= clamp(1. + 1.8*(dot(nl, L) - dot(n, L)), 0.15, 1.8);
      col = unTone(base*lam*sh);
    } else {
      float lam = (newX && kind < 23.5) ? dif : pow(dif, 0.8)*(0.4 + 0.6*pow(mu, 0.2));   // gas and cloud tops vs rough regolith
      if(kind > 23.5 && kind < 24.5) lam = pow(dif, 1.5)*(0.5 + 0.5*pow(mu, 0.2))*1.25;   // (Mimas: a harder falloff, like Vesta's, so the crater's relief shows)
      col = base*(lam*sh*1.25 + 0.006) + gEm;
    }
    col += diskAir(mu, dot(n, L), atm, atm*vec3(1., 0.6, 0.45), atmK*1.3);
    if(kind > 0.5 && kind < 1.5) col += vec3(0.25, 0.08, 0.02)*smoothstep(0.1, -0.2, dot(n, L))*0.08;
    alpha = 1.;
  } else if(length(atm) > 0.){
    col += limbAir(o, d, RP, 0.004 + 0.016*atmK, L, atm, atm*vec3(1., 0.55, 0.4), atmK*1.1);
  }
  outCol(col, alpha);
}`;
// one program per kind, each holding only its own surface and compiled the first time such a body is drawn (all of them in one program took
// over 3 s to compile on Windows, where ANGLE hands the shader to Direct3D, which unrolls every loop at every call)
const PLANETG = {};
const planetProg = kind => PLANETG[kind] || (PLANETG[kind] = program(VS_RECT, COMMON + '#define KIND ' + kind + '\n' + FS_PLANETG));
// a sphere body orbiting the Sun (or a planet), lit by the Sun, with its IAU pole and rotation
function addBody(def){
  const R = def.R*KM, bound = 1/0.9;
  const o = addObj(Object.assign({ layer:3, prog:planetProg(def.kind), rad:R*bound, solid:0.9, minZoom:1.3, pxMin:6, group:'solar', farLum:0.6, labelRange:def.labelRange ?? R*bound*6e4,
    R0:poleFrame(def.pole[0], def.pole[1]),
    views:[{dirFn:() => sunSide(o, 0.8, 0.35), k:3.2, hold:8, drift:0.04}, {dirFn:() => sunSide(o, 2.2, 0.2), k:1.9, hold:7, drift:0.04}],
    update(){
      const jd = jdNow();
      // (dL: a moon's swing about its mean longitude, degrees, which it turns with: Tethys's libration)
      const dL = def.dL ? def.dL(jd) : 0;
      if (def.el) this.offset = planetPos(def.el, jd);
      else if (def.moonOf){ const P = def.moonOf, th = (def.L0 + def.n*(jd - 2451545) + dL)*DEG, r = def.a*KM; this.offset = M3.apply(P.R0, [r*Math.cos(th), 0, -r*Math.sin(th)]); }
      else if (def.offsetFn) this.offset = def.offsetFn(jd);
      this.pos = V.add(this.parent.pos, this.offset);
      this.rot = def.W ? bodyFrame(def.pole[0], def.pole[1], def.W[0] + def.W[1]*(jd - 2451545) + dL) : this.R0;
    },
    setU(pr){ const L = def.lightFrom ? V.norm(V.sub(def.lightFrom.rel, this.rel)) : sunDirFrom(this); gl.uniform4f(pr.u.uP0, def.kind, 0, 0, 0); gl.uniform4f(pr.u.uP1, L[0], L[1], L[2], 0);
      const sh = def.shadowOf;
      if (sh){ const c = M3.applyT(this.rot, V.mul(V.sub(sh.rel, this.rel), 1/this.rad)); gl.uniform4f(pr.u.uP2, c[0], c[1], c[2], sh.rad*(sh.bodyFrac || 0.9)/this.rad); }
      else gl.uniform4f(pr.u.uP2, 0, 0, 0, 0); } }, def));
  if (def.el && !def.noSunView) o.views = [...o.views, sunBack(o)];
  o.update(0);
  return o;
}
// a view direction (in the body's R0 frame) that shows the sunlit side: `ang` radians around from the Sun, `up` elevation
// a view from a planet's night side looking back at the Sun, which sits just beyond the planet's edge (true size, with its glare)
// k: distance in planet radii (the planet's disc then spans about asin(0.9/k)); a: how far from the planet's centre the Sun appears (radians)
// (ref: the object, or its key when the view is written inside the object's own definition)
// F: the frame whose equator the angles are measured along (the body's own by default; Uranus, lying on its side, uses the ecliptic's)
const sunBack = (ref, k = 6, a = 0.27, F) => ({ dirFn:() => sunSide(typeof ref === 'string' ? BYKEY[ref] : ref, Math.PI - a, 0.05, F), k, hold:9, drift:0.004 });
function sunSide(o, ang, up, F = o.R0){
  const L = M3.applyT(F, o.lightFrom ? V.norm(V.sub(o.lightFrom.pos, o.pos)) : sunDirFrom(o)), Lh = V.norm([L[0], 0, L[2]]);
  const c = Math.cos(ang), s = Math.sin(ang), d = [Lh[0]*c - Lh[2]*s, 0, Lh[0]*s + Lh[2]*c];
  return M3.apply(F, V.norm([d[0], Math.tan(up), d[2]]));
}

// ---------------------------------------------------------------- the Solar System as a whole: orbits, asteroid belt, Trojans, Kuiper belt; the Oort cloud
const ECL = (() => { const x = eclToGal([1,0,0]), y = eclToGal([0,1,0]), z = eclToGal([0,0,1]); return [...x, ...z, ...V.mul(y, -1)]; })();   // local y = ecliptic north
const PB_KEPLER = `void body(out vec3 p, out float br, out vec3 col){
  // aP: a (AU), e, mean anomaly at epoch, longitude of perihelion; aC: colour, w = inclination; uQ0.x = days since epoch
  float a = aP.x, e = aP.y, M = aP.z + uQ0.x*0.0172021/(a*sqrt(a));
  float E = M + e*sin(M); E = E - (E - e*sin(E) - M)/(1. - e*cos(E)); E = E - (E - e*sin(E) - M)/(1. - e*cos(E));
  vec2 q = vec2(a*(cos(E) - e), a*sqrt(1. - e*e)*sin(E));
  float lam = aP.w + atan(q.y, q.x), rr = length(q);
  vec3 v = vec3(rr*cos(lam), 0., -rr*sin(lam));
  float inc = aC.w, node = fract(aC.w*91.7 + aP.z*3.1)*6.2832;
  vec3 k = vec3(cos(node), 0., -sin(node));
  p = v*cos(inc) + cross(k, v)*sin(inc) + k*dot(k, v)*(1. - cos(inc));
  br = 1.; col = aC.rgb;
}`;
P.ptKepler = program(particleVS(PB_KEPLER), FS_POINT);
const solarSystem = (() => {
  // planet orbits (drawn as line loops, in ly relative to the Sun)
  const names = Object.keys(PLANET_EL), SEG = 200, ps = makePS(names.length*SEG*2);
  const cols = { mercury:[0.7,0.65,0.6], venus:[0.95,0.85,0.6], earth:[0.45,0.65,1], mars:[0.95,0.5,0.3], jupiter:[0.95,0.8,0.6], saturn:[0.95,0.88,0.65], uranus:[0.6,0.9,0.95], neptune:[0.4,0.55,1] };
  let k = 0;
  names.forEach(nm => { const kk = orbitEls(PLANET_EL[nm], JD_NOW);
    for (let i=0;i<SEG;i++) for (const e of [i, i + 1]){ const p = orbitPoint(kk, e/SEG*Math.PI*2); ps.a.set([p[0]/AU_LY, p[1]/AU_LY, p[2]/AU_LY, 1], k*4); ps.c.set([...cols[nm], 0], k*4); k++; } });
  ps.upload('ac');
  // asteroid belt with Kirkwood gaps, Jupiter Trojans at L4/L5, Kuiper belt and scattered disk
  const nA = Math.round(5000*QUALITY), nT = Math.round(900*QUALITY), nK = Math.round(4500*QUALITY), belt = makePS(nA + nT + nK);
  const jup = orbitEls(PLANET_EL.jupiter, JD_NOW), jupM = ((jup.L - jup.wb) % 360)*DEG, jupW = jup.wb*DEG;
  let b = 0;
  const gaps = [2.5, 2.82, 2.95, 3.27];
  while (b < nA){ const a = 2.1 + 1.2*Math.pow(rnd(), 0.9); if (gaps.some(g => Math.abs(a - g) < 0.035) && rnd() < 0.92) continue;
    const c = rnd() < 0.7 ? [0.72, 0.62, 0.52] : [0.62, 0.62, 0.66], w = rnd()*6.283;
    belt.a.set([a, rnd()*0.2, rnd()*6.283, w], b*4); belt.c.set([...c, Math.abs(rndn())*0.14], b*4); b++; }
  for (let i=0;i<nT;i++){ const side = i % 2 ? 1 : -1, a = 5.2*(1 + rndn()*0.015);
    belt.a.set([a, rnd()*0.08, jupM + side*Math.PI/3 + rndn()*0.25, jupW], b*4); belt.c.set([0.7, 0.6, 0.55, Math.abs(rndn())*0.2], b*4); b++; }
  for (let i=0;i<nK;i++){ const sc = rnd() < 0.15, a = sc ? 50 + 60*rnd() : (rnd() < 0.3 ? 39.4 + rndn()*0.3 : 42 + 5*rnd());
    belt.a.set([a, sc ? 0.2 + 0.5*rnd() : rnd()*0.12, rnd()*6.283, rnd()*6.283], b*4); belt.c.set([0.6, 0.66, 0.78, Math.abs(rndn())*(sc ? 0.4 : 0.1)], b*4); b++; }
  belt.upload('ac');
  const zoomVis = (lo, hi, lo2, hi2) => () => smooth(lo, hi, viewDist())*(1 - smooth(lo2, hi2, viewDist()));
  const beltVis = zoomVis(3e-5, 1.5e-4, 0.03, 0.4);
  const o = addObj({ key:'solarsystem', name:'the Solar System', label:'Solar System', type:'our planetary system · 8 planets, 5 dwarf planets, millions of small bodies', group:'solar', sortKey:-2, layer:2,
    fact:'Planets shown where they are today, on their true orbits. The asteroid belt hides gaps carved by Jupiter; two swarms of Trojans share its orbit.',
    pos:[0,0,0], rad:50*AU_LY, R0:ECL, minZoom:0.00025, pxMin:3, noImpostor:true, labelRange:3e3, farLum:0, distEarth:'you are inside it', atlasDist:'here',
    // all eight orbits (Neptune's fills the screen), then out to Saturn, then the inner planets and the asteroid belt from above
    views:[{d:[0.35, 0.62, 1], k:1.0, hold:10, drift:0.025}, {d:[0.3, 0.45, 1], k:0.3, hold:9, drift:0.03}, {d:[0.5, 1, 0.2], k:0.055, hold:9, drift:0.03}],
    particleVis:rpx => smooth(4, 20, rpx),
    particles:[
      {ps, prog:'lnBasic', lines:true, mode:3, sb:0.4, size:1, rad:AU_LY, rot:() => I3, vis:zoomVis(2.5e-5, 1.2e-4, 0.02, 0.2)},
      // (seen from far out the belt is a few characters wide and its dots pile up into a solid blob: it dims as the view widens)
      {ps:belt, prog:'ptKepler', mode:3, sb:0.35, size:1.6, rad:AU_LY, rot:() => ECL, q0:() => [jdNow() - JD_NOW, 0, 0, 0], vis:() => beltVis()*(1 - 0.85*smooth(8e-5, 4e-4, viewDist()))},
    ],
    readout:() => `Neptune orbits 30 AU out · light takes 4 hours to get there` +
      (jdNow() >= VOY1.from ? `\nVoyager 1, our farthest probe, is ~${Math.round(V.len(voyager1At(jdNow()))/AU_LY)} AU away after ${Math.floor((jdNow() - VOY1.launch)/365.25)} years` : '') +
      (typeof SYSMAG !== 'undefined' && SYSMAG.k > 0.5 && BYKEY.jupiter.mag > 2 ? sysMagNote() : '') });
  function sysMagNote(){
    const hid = ['mercury', 'venus', 'earth', 'mars'].filter(k => BYKEY[k] && BYKEY[k].magHide > 0.5).map(k => BYKEY[k].name.replace(/^the /, ''));
    return `\nthe Sun and planets are drawn enlarged, in their true order of size; really the Sun is 10x wider than Jupiter, and Jupiter 11x wider than Earth. Orbits are to scale` +
      (hid.length ? `\n${hid.length > 1 ? hid.slice(0, -1).join(', ') + ' and ' + hid[hid.length - 1] + ' are' : hid[0] + ' is'} hidden behind the enlarged Sun at this scale: zoom in to see ${hid.length > 1 ? 'them' : 'it'}` : '');
  }
  return o;
})();
const oort = (() => {
  const n = Math.round(9000*QUALITY), ps = makePS(n);
  for (let i=0;i<n;i++){ const inner = rnd() < 0.3; let d = randDir(); if (inner) d = V.norm([d[0], d[1]*0.45, d[2]]);
    const r = inner ? 2000 + 18000*Math.pow(rnd(), 1.5) : 20000 + 80000*Math.pow(rnd(), 0.8);
    ps.a.set([d[0]*r, d[1]*r, d[2]*r, 0.4 + rnd()], i*4); ps.c.set([0.62, 0.72, 0.9, 0], i*4); }
  ps.upload('ac');
  return addObj({ key:'oort', name:'the Oort cloud', label:'Oort cloud', type:'shell of icy bodies · source of long-period comets', group:'solar', sortKey:-0.5, layer:2,
    fact:'Trillions of comet nuclei surround the Sun out to a light-year or more, a third of the way to the nearest star. None has ever been seen directly.',
    pos:[0,0,0], rad:1.6, R0:ECL, minZoom:0.02, pxMin:3, noImpostor:true, labelRange:60, farLum:0, distEarth:'2,000 to 100,000 AU from the Sun', atlasDist:'all around us',
    views:[{d:[0.3, 0.45, 1], k:3.4, hold:9, drift:0.03}, {d:[0.9, 0.2, 0.3], k:1.3, hold:8, drift:0.03}],
    particleVis:rpx => smooth(8, 40, rpx)*smooth(0.004, 0.03, viewDist()),
    particles:[{ps, prog:'ptBasic', mode:3, sb:0.4, size:1.6, rad:AU_LY}],
    readout:() => 'outer edge ~100,000 AU (1.6 light-years)\na comet from here takes millions of years per orbit' });
})();

// ---------------------------------------------------------------- the other planets and Pluto (Earth, Jupiter and Saturn have their own files)
const mercury = addBody({ key:'mercury', name:'Mercury', type:'rocky planet · closest to the Sun', parent:sun, el:PLANET_EL.mercury, R:2439.7, pole:[281.0103, 61.4155], W:[329.5988, 6.1385108], kind:0,
  fact:'A scorched, cratered world with almost no air: 430 °C by day, −180 °C at night. Its year is shorter than two of its own days.', farLum:0.5, farColor:[0.85, 0.8, 0.75], sortKey:0.39,
  readout:() => 'radius 2,440 km · 0.39 AU from the Sun\none solar day lasts 176 Earth days' });
const venus = addBody({ key:'venus', name:'Venus', type:'rocky planet · runaway greenhouse', parent:sun, el:PLANET_EL.venus, R:6051.8, pole:[272.76, 67.16], W:[160.20, -1.4813688], kind:1,
  fact:'Almost Earth\'s twin in size, smothered by clouds of sulphuric acid. The surface is 465 °C under 92 times Earth\'s air pressure.', farLum:1.1, farColor:[1, 0.95, 0.82], sortKey:0.72,
  readout:() => 'radius 6,052 km · spins backwards, once every 243 days\nits cloud tops race around in just 4 days\ncloud patterns drawn as ultraviolet photos show them: to the eye Venus looks plain' });
const mars = addBody({ key:'mars', name:'Mars', type:'rocky planet · the red planet', parent:sun, el:PLANET_EL.mars, R:3389.5, pole:[317.269, 54.432], W:[176.630, 350.89198226], kind:2,
  fact:'Rust-red dust, polar ice caps, Olympus Mons (three times the height of Everest) and a canyon as long as the United States.', farLum:0.7, farColor:[1, 0.62, 0.42], sortKey:1.52,
  readout:() => 'radius 3,390 km · a day lasts 24 h 37 min\nsurface pressure under 1% of Earth\'s' });
const uranus = addBody({ key:'uranus', name:'Uranus', type:'ice giant · tipped on its side', parent:sun, el:PLANET_EL.uranus, R:25362, pole:[257.311, -15.175], W:[203.81, -501.1600928], kind:3,
  // (its angles go round it in the plane of the planets' orbits, not its own equator: with its axis tipped over, angles measured from its
  // equator looked at the half-lit planet from the side; these look at the sunlit pole, as we see Uranus in the 2020s, and past the night side at the Sun)
  views:[{dirFn:() => sunSide(uranus, 0.5, 0.2, ECL), k:3.2, hold:8, drift:0.04}, {dirFn:() => sunSide(uranus, 1.9, 0.2, ECL), k:1.9, hold:7, drift:0.04}, sunBack('uranus', 6, 0.27, ECL)], noSunView:true,
  fact:'Knocked over by an ancient collision, it rolls around the Sun with its axis tilted 98°, so each pole gets 42 years of daylight.', farLum:0.4, farColor:[0.7, 0.9, 0.95], sortKey:19.2,
  readout:() => 'radius 25,360 km · 19 AU from the Sun\nlight from the Sun takes 2 h 40 min to arrive' });
const neptune = addBody({ key:'neptune', name:'Neptune', type:'ice giant · outermost planet', parent:sun, el:PLANET_EL.neptune, R:24622, pole:[299.36, 43.46], W:[249.978, 541.1397757], kind:4,
  fact:'The windiest world known: storms race at 2,000 km/h around a deep-blue methane atmosphere. It takes 165 years to orbit the Sun once.', farLum:0.35, farColor:[0.5, 0.65, 1], sortKey:30,
  readout:() => 'radius 24,620 km · 30 AU from the Sun\nfound in 1846 by mathematics before telescopes' });
const pluto = addBody({ key:'pluto', tags:['moons'], name:'Pluto', type:'dwarf planet · Kuiper belt', parent:sun, R:1188.3, pole:[132.993, -6.163], W:[302.695, 56.3625225], kind:5,
  el:[39.48211675, 0.24882730, 17.14001206, 238.92903833, 224.06891629, 110.30393684, -0.00031596, 0.00005170, 0.00004818, 145.20780515, -0.04062942, -0.01183482],
  // (tipped over like Uranus, 120 deg, so its angles are measured round the plane of the planets' orbits too)
  views:[{dirFn:() => sunSide(pluto, 0.5, 0.2, ECL), k:3.2, hold:8, drift:0.04}, {dirFn:() => sunSide(pluto, 1.9, 0.2, ECL), k:1.9, hold:7, drift:0.04}, sunBack('pluto', 6, 0.27, ECL)], noSunView:true,
  fact:'A world of nitrogen glaciers, water-ice mountains and a vast pale heart, seen close up only once, by New Horizons in 2015.', farLum:0.2, farColor:[0.9, 0.8, 0.7], sortKey:39.5,
  readout:() => 'radius 1,188 km, smaller than our Moon\nsunlight there is 1,000 times dimmer than at Earth' });

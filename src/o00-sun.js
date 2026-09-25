
// ================================================================ stars (generic photosphere/corona shader), the Sun, and the Solar System's large-scale structure
// Local units: bounding sphere radius 1; the photosphere has radius uP1.x.
// uP0: T_eff, convection cells per radius, spot activity, cell speed   uP1: R*, oblateness, corona, prominences
// uP2: flare (local dir, amount)   uP3: CME (local dir, radius)   uP4: x granulation fine detail, y limb darkening, z chromosphere, w colour boost
// (a negative w switches on the Sun's look: a warm filtered-photo tint, boiling granulation that pulses, and flickering spicules at the limb)
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
  vec3 os = o*vec3(1., sq, 1.), ds = normalize(d*vec3(1., sq, 1.));
  vec2 h = sphIsect(os, ds, vec3(0.), Rs);
  vec3 col = vec3(0.); float alpha = 0.;
  float tc = -dot(o, d); vec3 pc = o + d*max(tc, 0.);
  float b = length(pc)/Rs;
  bool hit = h.x > 0.;
  if(hit){
    vec3 p = os + ds*h.x, n = p/Rs; float mu = max(dot(n, -ds), 0.);
    col = photosphere(n, mu, Rs)*1.3*abs(uP4.w)*vec3(1., 0.93, 0.8);
    if(uP4.w < 0.){
      // the Sun: boiling patches swell and fade, granules flicker; hot cell centres burn yellow-white, the lanes between them deep orange
      float boil = fbm3(n*uP0.y*0.5 + vec3(0., uTime*0.23, uTime*0.17)), flick = noise(n*uP0.y*2.3 + vec3(uTime*0.8, 0., -uTime*0.6));
      float heat = clamp(gCell*0.8 + (boil - 0.5)*1.1 + (flick - 0.5)*0.45 + 0.1, 0., 1.);
      vec3 hot = mix(mix(vec3(0.8, 0.22, 0.03), vec3(1., 0.56, 0.12), smoothstep(0.05, 0.45, heat)), vec3(1., 0.88, 0.5), smoothstep(0.5, 0.95, heat));
      col = hot*(dot(col, vec3(0.3, 0.5, 0.2))/dot(hot, vec3(0.3, 0.5, 0.2)))*(0.42 + 1.15*heat);   // about the same brightness, warmer colour, more contrast
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
      // spicules: a ragged fringe of flame-like jets that flicker along the limb
      vec3 u = normalize(pc);
      float tall = 0.012 + 0.035*pow(noise(u*11. + vec3(0., uTime*0.25, 0.)), 2.);
      float fl = pow(noise(u*46. + vec3(uTime*0.7, -uTime*0.5, uTime*0.3) - u*hgt*30.), 2.5);
      col += mix(vec3(1., 0.35, 0.08), vec3(1., 0.7, 0.25), fl)*fl*exp(-hgt/tall)*2.2;
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
        float arch = ridge(vec3(u.xz*7. + u.y*3., hh*9. - uTime*0.05) + vec3(u.y*5., 0., 0.));
        float dens = pow(arch, 5.)*foot*exp(-hh/0.07)*smoothstep(0.35, 0.02, hh);
        acc += vec3(1., 0.3, 0.32)*dens;
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
  col += blackbody(uP0.x)*(uP4.w < 0. ? vec3(1., 0.72, 0.38) : vec3(1.))*exp(-max(b - 1., 0.)*11.)*0.045*(hit ? 0. : 1.);
  outCol(col, alpha);
}`;
P.star = program(VS_RECT, FS_STAR);
// generic star object: radius in solar radii, temperature, optional spin (days) and pole
function addStar(def){
  const Rs = def.R*RSUN*KM, bound = def.bound || 3.2;
  const o = addObj(Object.assign({ layer:3, prog:P.star, rad:Rs*bound, solid:1/bound, minZoom:1.08/bound, pxMin:5, group:'stars', farColor:blackbodyJS(def.T), farLum:def.farLum ?? 0.9, noImpostor:def.noImpostor ?? true,
    labelRange:def.labelRange ?? 400, starR:1/bound,
    setU(pr){ const s = this.star;
      gl.uniform4f(pr.u.uP0, def.T, s.cells ?? 34, s.act ?? 0.4, s.speed ?? 0.25);
      gl.uniform4f(pr.u.uP1, this.starR, s.obl ?? 0, s.corona ?? 0.6, s.prom ?? 0);
      gl.uniform4f(pr.u.uP2, 0, 1, 0, 0); gl.uniform4f(pr.u.uP3, 0, 1, 0, 0);
      gl.uniform4f(pr.u.uP4, s.fine ?? 0, s.limb ?? 0.55, s.chromo ?? 0.25, s.boost ?? 1);
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
      gl.uniform4f(pr.u.uP1, 1/bound, 0, 1, 1);
      gl.uniform4f(pr.u.uP2, st.flareDir[0], st.flareDir[1], st.flareDir[2], st.flare);
      gl.uniform4f(pr.u.uP3, st.cmeDir[0], st.cmeDir[1], st.cmeDir[2], st.cme);
      gl.uniform4f(pr.u.uP4, clamp(1.5 - orbit.dist/(this.rad*1.2), 0, 1), 0.58, 0.5, -1);
    },
    readout:() => st.cmeT < 10 ? 'coronal mass ejection: a billion tonnes of plasma\nleaving at ~1,000 km/s; it would reach Earth in ~2 days' :
      (st.flareT < 3 ? 'solar flare: magnetic loops snapping and reconnecting\nreleasing the energy of millions of nuclear bombs' : 'surface 5,500 °C, core 15 million °C · 1.39 million km across\nlight from its core takes ~100,000 years to reach the surface\ndrawn warm like a filtered photo · from space it looks white') });
  o.st = st;
  return o;
})();

// ---------------------------------------------------------------- generic planets and small moons
// uP0: x kind, y ring on/off   uP1: sun direction (world)   uP2: shadowing body centre (local units), w radius
const FS_PLANETG = COMMON + `
const float RP = 0.9;
vec2 vorc(vec3 p){ vec3 i = floor(p), f = fract(p); float d1 = 8.; vec3 id = vec3(0.);
  for(int z=-1;z<=1;z++) for(int y=-1;y<=1;y++) for(int x=-1;x<=1;x++){ vec3 g = vec3(float(x), float(y), float(z)); vec3 r = g + vec3(hash13(i + g), hash13(i + g + 7.1), hash13(i + g + 3.3)) - f; float dd = dot(r, r); if(dd < d1){ d1 = dd; id = i + g; } }
  return vec2(sqrt(d1), hash13(id + 9.)); }
float craters(vec3 n, float sc){ vec2 v = vorc(n*sc); float r = 0.18 + 0.3*v.y; float rim = exp(-pow((v.x - r)/0.05, 2.)); float bowl = smoothstep(r, r*0.6, v.x); return rim*0.5 - bowl*0.35*step(0.35, v.y); }
vec3 surface(vec3 n, float kind, out float spec){
  float lat = n.y, lon = atan(-n.z, n.x); spec = 0.;
  if(kind < 0.5){ // Mercury
    float c = craters(n, 7.) + craters(n, 17.)*0.6; float f = fbm3(n*5.);
    return vec3(0.58, 0.54, 0.5)*(0.72 + 0.4*f + 0.5*c);
  } else if(kind < 1.5){ // Venus: sulphuric acid clouds, faint Y-shaped bands in super-rotation
    float w = lon + uTime*0.06;
    vec3 q = vec3(cos(w)*sqrt(1. - lat*lat), lat, sin(w)*sqrt(1. - lat*lat));
    float y = fbm3(q*vec3(3., 9., 3.) + vec3(0., abs(lat)*4., 0.));
    return mix(vec3(0.93, 0.84, 0.62), vec3(0.8, 0.66, 0.45), smoothstep(0.45, 0.75, y)*0.6);
  } else if(kind < 2.5){ // Mars
    float f = fbm(n*3.2 + 2.), g = fbm3(n*9. + 5.);
    vec3 c = mix(vec3(0.78, 0.42, 0.22), vec3(0.62, 0.3, 0.18), smoothstep(0.4, 0.7, g));
    float dark = smoothstep(0.52, 0.66, f)*smoothstep(0.75, 0.2, abs(lat));
    float syrtis = exp(-(pow(lon - 1.22, 2.)*6. + pow(lat - 0.15, 2.)*12.));
    float valles = exp(-pow((lat + 0.24)/0.025, 2.))*smoothstep(-1.75, -1.3, lon)*smoothstep(-0.7, -1.05, lon);
    float olympus = exp(-(pow(lon + 2.34, 2.) + pow(lat - 0.31, 2.))/0.004);
    c = mix(c, vec3(0.36, 0.22, 0.16), clamp(dark + syrtis*0.8 + valles*0.8, 0., 0.85));
    c += vec3(0.25, 0.14, 0.08)*olympus;
    float cap = smoothstep(0.93, 0.96, lat + 0.04*noise(n*20.)) + smoothstep(0.95, 0.975, -lat + 0.04*noise(n*20.));
    return mix(c, vec3(0.97, 0.95, 0.93), cap);
  } else if(kind < 3.5){ // Uranus
    float b = sin(lat*18. + fbm3(n*vec3(3., 12., 3.))*1.5)*0.5 + 0.5;
    return mix(vec3(0.62, 0.84, 0.88), vec3(0.72, 0.9, 0.92), b*0.25 + smoothstep(0.6, 0.95, lat)*0.4);
  } else if(kind < 4.5){ // Neptune: bands, a dark vortex with bright companion clouds, fast white streaks
    float w = lon + uTime*0.05*(1. - 1.5*lat*lat);
    vec3 q = vec3(cos(w)*sqrt(1. - lat*lat), lat, sin(w)*sqrt(1. - lat*lat));
    float b = sin(lat*14. + fbm3(q*vec3(4., 14., 4.))*2.)*0.5 + 0.5;
    vec3 c = mix(vec3(0.22, 0.38, 0.92), vec3(0.32, 0.5, 1.), b*0.5);
    vec2 s = vec2(atan(sin(w - 1.), cos(w - 1.)), (lat + 0.35)*2.6); float sr = length(s*vec2(1., 1.7));
    c = mix(c, vec3(0.1, 0.18, 0.5), smoothstep(0.22, 0.12, sr));
    c += vec3(0.9)*smoothstep(0.78, 0.9, fbm3(q*vec3(7., 30., 7.) + 3.))*smoothstep(0.1, 0.5, abs(lat))*0.8 + vec3(0.8)*exp(-pow(sr - 0.26, 2.)/0.002)*0.6;
    return c;
  } else if(kind < 5.5){ // Pluto: the nitrogen-ice heart
    float heart = smoothstep(0.34, 0.26, length(vec2(atan(sin(lon - 3.14), cos(lon - 3.14))*0.8, lat - 0.25)));
    float cth = smoothstep(0.6, 0.45, length(vec2(atan(sin(lon - 1.9), cos(lon - 1.9))*0.5, lat + 0.05)*vec2(1., 2.2)));
    vec3 c = vec3(0.74, 0.62, 0.5)*(0.8 + 0.35*fbm3(n*6.));
    c = mix(c, vec3(0.36, 0.2, 0.14), cth*0.8);
    return mix(c, vec3(0.98, 0.94, 0.88), heart);
  } else if(kind < 6.5){ // Moon: maria at their real selenographic positions, cratered highlands, rayed Tycho and Copernicus
    float m = 0.;
    m += exp(-(pow(lon + 0.28, 2.) + pow(lat - 0.56, 2.)*1.3)/0.03);          // Imbrium
    m += exp(-(pow(lon - 0.3, 2.) + pow(lat - 0.49, 2.))/0.012);              // Serenitatis
    m += exp(-(pow(lon - 0.54, 2.) + pow(lat - 0.15, 2.))/0.018);             // Tranquillitatis
    m += exp(-(pow(lon - 1.03, 2.) + pow(lat - 0.28, 2.))/0.005);             // Crisium
    m += exp(-(pow(lon - 0.88, 2.) + pow(lat + 0.1, 2.))/0.01);               // Fecunditatis
    m += exp(-(pow(lon + 0.29, 2.) + pow(lat + 0.36, 2.))/0.012);             // Nubium
    m += exp(-(pow(lon + 0.95, 2.)*0.5 + pow(lat - 0.2, 2.))/0.06);           // Procellarum
    m += exp(-(pow(lon - 0.62, 2.) + pow(lat + 0.27, 2.))/0.008);             // Nectaris
    m = clamp(m*(0.7 + 0.5*fbm3(n*8.)), 0., 1.);
    float c = craters(n, 9.) + craters(n, 23.)*0.5;
    vec3 col = mix(vec3(0.72, 0.7, 0.67)*(0.85 + 0.6*c), vec3(0.38, 0.37, 0.36)*(0.9 + 0.2*c), m);
    vec3 ty = normalize(vec3(cos(-0.76)*cos(-0.19), sin(-0.76), -cos(-0.76)*sin(-0.19)));
    float dt = length(n - ty); col += vec3(0.5)*exp(-dt*dt/0.0015) + vec3(0.18)*pow(noise(normalize(n - ty*0.9)*30.), 6.)*exp(-dt*2.5)*3.;
    vec3 co = normalize(vec3(cos(0.17)*cos(-0.35), sin(0.17), -cos(0.17)*sin(-0.35)));
    float dc = length(n - co); col += vec3(0.35)*exp(-dc*dc/0.001) + vec3(0.12)*pow(noise(normalize(n - co*0.9)*30.), 6.)*exp(-dc*3.)*3.;
    return col;
  } else if(kind < 7.5){ // Io: sulphur plains, dark volcanic calderas, red Pele ring
    float f = fbm(n*4. + 1.), g = fbm3(n*12.);
    vec3 c = mix(vec3(0.95, 0.88, 0.45), vec3(0.85, 0.62, 0.25), smoothstep(0.4, 0.7, f));
    c = mix(c, vec3(0.95, 0.95, 0.8), smoothstep(0.6, 0.8, g)*0.5);
    vec2 v = vorc(n*6.); c = mix(c, vec3(0.12, 0.07, 0.04), smoothstep(0.12, 0.05, v.x)*step(0.6, v.y));
    float pele = length(n - normalize(vec3(cos(-0.326)*cos(1.83), sin(-0.326), -cos(-0.326)*sin(1.83))));
    c = mix(c, vec3(0.8, 0.3, 0.15), exp(-pow((pele - 0.25)/0.05, 2.))*0.7);
    return c;
  } else if(kind < 8.5){ // Europa: water ice crossed by rust-coloured lineae
    float l1 = 1. - abs(noise(n*vec3(20., 4., 20.))*2. - 1.), l2 = 1. - abs(noise(n*vec3(5., 22., 9.) + 3.)*2. - 1.);
    float lin = pow(max(l1, l2), 18.);
    vec3 c = mix(vec3(0.93, 0.9, 0.84), vec3(0.8, 0.7, 0.55), smoothstep(0.45, 0.75, fbm3(n*4.)));
    return mix(c, vec3(0.6, 0.32, 0.18), lin*0.8);
  } else if(kind < 9.5){ // Ganymede: dark ancient terrain and bright grooved terrain
    float f = fbm(n*3. + 7.);
    vec3 c = mix(vec3(0.42, 0.38, 0.33), vec3(0.78, 0.76, 0.72), smoothstep(0.45, 0.6, f));
    return c*(0.85 + 0.3*craters(n, 12.) + 0.15*pow(noise(n*vec3(30., 4., 30.)), 3.));
  } else if(kind < 10.5){ // Callisto: dark, saturated with craters
    return vec3(0.36, 0.32, 0.28)*(0.8 + 0.8*max(craters(n, 14.), -0.2) + 0.3*craters(n, 31.)) + vec3(0.35)*step(0.985, hash13(floor(n*60.)));
  } else if(kind < 11.5){ // Titan: opaque orange haze
    return mix(vec3(0.85, 0.55, 0.22), vec3(0.95, 0.68, 0.3), smoothstep(0.3, 0.9, lat*0.5 + 0.5)*0.4 + 0.1*fbm3(n*3.));
  } else if(kind < 12.5){ // Enceladus: brilliant fresh ice, tiger stripes at the south pole
    float tig = pow(1. - abs(sin((lon*0.4 + lat*9.)*3.)), 20.)*smoothstep(-0.8, -0.95, lat);
    return mix(vec3(0.97, 0.98, 1.), vec3(0.45, 0.62, 0.72), tig)*(0.92 + 0.08*craters(n, 10.));
  }
  else if(kind < 13.5){ return vec3(0.82, 0.8, 0.76)*(0.8 + 0.5*craters(n, 8.) + 0.2*fbm3(n*5.)); }
  else if(kind < 14.5){ // tidally locked rocky exoplanet: scorched day side, ice on the night side
    float f = fbm(n*4. + 3.); vec3 c = mix(vec3(0.55, 0.36, 0.26), vec3(0.72, 0.5, 0.34), f);
    return mix(c, vec3(0.85, 0.88, 0.95), smoothstep(-0.2, -0.6, n.x))*(0.85 + 0.3*craters(n, 6.));
  }
  // temperate world: oceans, land and cloud (TRAPPIST-1e style guess)
  float f = fbm(n*3.5 + 1.), cl = smoothstep(0.55, 0.75, fbm(n*5. + vec3(uTime*0.01, 0., 0.)));
  vec3 c = mix(vec3(0.05, 0.14, 0.32), vec3(0.45, 0.35, 0.22), smoothstep(0.5, 0.56, f));
  return mix(c, vec3(0.95), cl*0.8);
}
void main(){
  vec3 o, d; localRay(o, d);
  float kind = uP0.x;
  vec3 L = normalize(uP1.xyz*uRot);
  vec2 h = sphIsect(o, d, vec3(0.), RP);
  vec3 col = vec3(0.); float alpha = 0.;
  vec3 atm = kind < 0.5 || (kind > 4.5 && kind < 11.) || kind > 11.5 ? vec3(0.) : (kind < 1.5 ? vec3(1., 0.85, 0.55) : (kind < 2.5 ? vec3(0.95, 0.62, 0.45) : (kind < 3.5 ? vec3(0.55, 0.85, 0.95) : (kind < 4.5 ? vec3(0.4, 0.55, 1.) : vec3(0.95, 0.6, 0.25)))));
  float atmK = kind < 1.5 ? 0.9 : (kind < 2.5 ? 0.35 : (kind < 4.5 ? 0.7 : 1.));
  if(h.x > 0.){
    vec3 p = o + d*h.x, n = p/RP;
    float spec; vec3 base = surface(n, kind, spec);
    float dif = max(dot(n, L), 0.), mu = max(dot(n, -d), 0.);
    // eclipse by a nearby body (a planet's shadow on its moon)
    float sh = 1.;
    if(uP2.w > 0.){ vec3 q = uP2.xyz - p; float tq = dot(q, L); if(tq > 0.){ float dq = length(q - L*tq); sh = smoothstep(uP2.w*0.96, uP2.w*1.04, dq); } }
    float lam = kind > 0.5 && kind < 4.5 ? dif : pow(dif, 0.8)*(0.4 + 0.6*pow(mu, 0.2));   // gas and cloud tops vs rough regolith
    col = base*(lam*sh*1.25 + 0.006);
    col += diskAir(mu, dot(n, L), atm, atm*vec3(1., 0.6, 0.45), atmK*1.3);
    if(kind > 0.5 && kind < 1.5) col += vec3(0.25, 0.08, 0.02)*smoothstep(0.1, -0.2, dot(n, L))*0.08;
    alpha = 1.;
  } else if(length(atm) > 0.){
    col += limbAir(o, d, RP, 0.004 + 0.016*atmK, L, atm, atm*vec3(1., 0.55, 0.4), atmK*1.1);
  }
  outCol(col, alpha);
}`;
P.planetG = program(VS_RECT, FS_PLANETG);
// a sphere body orbiting the Sun (or a planet), lit by the Sun, with its IAU pole and rotation
function addBody(def){
  const R = def.R*KM, bound = 1/0.9;
  const o = addObj(Object.assign({ layer:3, prog:P.planetG, rad:R*bound, solid:0.9, minZoom:1.3, pxMin:6, group:'solar', farLum:0.6, labelRange:def.labelRange ?? R*bound*6e4,
    R0:poleFrame(def.pole[0], def.pole[1]),
    views:[{dirFn:() => sunSide(o, 0.8, 0.35), k:3.2, hold:8, drift:0.04}, {dirFn:() => sunSide(o, 2.2, 0.2), k:1.9, hold:7, drift:0.04}],
    update(){
      const jd = jdNow();
      if (def.el) this.offset = planetPos(def.el, jd);
      else if (def.moonOf){ const P = def.moonOf, th = (def.L0 + def.n*(jd - 2451545))*DEG, r = def.a*KM; this.offset = M3.apply(P.R0, [r*Math.cos(th), 0, -r*Math.sin(th)]); }
      else if (def.offsetFn) this.offset = def.offsetFn(jd);
      this.pos = V.add(this.parent.pos, this.offset);
      this.rot = def.W ? bodyFrame(def.pole[0], def.pole[1], def.W[0] + def.W[1]*(jd - 2451545)) : this.R0;
    },
    setU(pr){ const L = def.lightFrom ? V.norm(V.sub(def.lightFrom.rel, this.rel)) : sunDirFrom(this); gl.uniform4f(pr.u.uP0, def.kind, 0, 0, 0); gl.uniform4f(pr.u.uP1, L[0], L[1], L[2], 0);
      const sh = def.shadowOf;
      if (sh){ const c = M3.applyT(this.rot, V.mul(V.sub(sh.rel, this.rel), 1/this.rad)); gl.uniform4f(pr.u.uP2, c[0], c[1], c[2], sh.rad*(sh.bodyFrac || 0.9)/this.rad); }
      else gl.uniform4f(pr.u.uP2, 0, 0, 0, 0); } }, def));
  o.update(0);
  return o;
}
// a view direction (in the body's R0 frame) that shows the sunlit side: `ang` radians around from the Sun, `up` elevation
function sunSide(o, ang, up){
  const L = M3.applyT(o.R0, o.lightFrom ? V.norm(V.sub(o.lightFrom.pos, o.pos)) : sunDirFrom(o)), Lh = V.norm([L[0], 0, L[2]]);
  const c = Math.cos(ang), s = Math.sin(ang), d = [Lh[0]*c - Lh[2]*s, 0, Lh[0]*s + Lh[2]*c];
  return M3.apply(o.R0, V.norm([d[0], Math.tan(up), d[2]]));
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
  const zoomVis = (lo, hi, lo2, hi2) => () => smooth(lo, hi, orbit.dist)*(1 - smooth(lo2, hi2, orbit.dist));
  const o = addObj({ key:'solarsystem', name:'the Solar System', label:'Solar System', type:'our planetary system · 8 planets, 5 dwarf planets, millions of small bodies', group:'solar', sortKey:-2, layer:2,
    fact:'Planets shown where they are today, on their true orbits. The asteroid belt hides gaps carved by Jupiter; two swarms of Trojans share its orbit.',
    pos:[0,0,0], rad:50*AU_LY, R0:ECL, minZoom:0.002, pxMin:3, noImpostor:true, labelRange:3e3, farLum:0, distEarth:'you are inside it', atlasDist:'here',
    // all eight orbits (Neptune's fills the screen), then out to Saturn, then the inner planets and the asteroid belt from above
    views:[{d:[0.35, 0.62, 1], k:1.0, hold:10, drift:0.025}, {d:[0.3, 0.45, 1], k:0.3, hold:9, drift:0.03}, {d:[0.5, 1, 0.2], k:0.09, hold:8, drift:0.03}],
    particleVis:rpx => smooth(4, 20, rpx),
    particles:[
      {ps, prog:'lnBasic', lines:true, mode:3, sb:0.4, size:1, rad:AU_LY, rot:() => I3, vis:zoomVis(2.5e-5, 1.2e-4, 0.02, 0.2)},
      {ps:belt, prog:'ptKepler', mode:3, sb:0.35, size:1.6, rad:AU_LY, rot:() => ECL, q0:() => [jdNow() - JD_NOW, 0, 0, 0], vis:zoomVis(3e-5, 1.5e-4, 0.03, 0.4)},
    ],
    readout:() => `Neptune orbits 30 AU out · light takes 4 hours to get there\nVoyager 1, our farthest probe, is ~171 AU away after 49 years` });
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
    pos:[0,0,0], rad:1.6, R0:ECL, minZoom:0.02, pxMin:3, noImpostor:true, labelRange:60, farLum:0, distEarth:'2,000 to 100,000 AU from the Sun', atlasDist:'all around',
    views:[{d:[0.3, 0.45, 1], k:3.4, hold:9, drift:0.03}, {d:[0.9, 0.2, 0.3], k:1.3, hold:8, drift:0.03}],
    particleVis:rpx => smooth(8, 40, rpx)*smooth(0.004, 0.03, orbit.dist),
    particles:[{ps, prog:'ptBasic', mode:3, sb:0.4, size:1.6, rad:AU_LY}],
    readout:() => 'outer edge ~100,000 AU (1.6 light-years)\na comet from here takes millions of years per orbit' });
})();

// ---------------------------------------------------------------- the other planets and Pluto (Earth, Jupiter and Saturn have their own files)
const mercury = addBody({ key:'mercury', name:'Mercury', type:'rocky planet · closest to the Sun', parent:sun, el:PLANET_EL.mercury, R:2439.7, pole:[281.0103, 61.4155], W:[329.5988, 6.1385108], kind:0,
  fact:'A scorched, cratered world with almost no air: 430 °C by day, −180 °C at night. Its year is shorter than two of its own days.', farLum:0.5, farColor:[0.85, 0.8, 0.75], sortKey:0.39,
  readout:() => 'radius 2,440 km · 0.39 AU from the Sun\none solar day lasts 176 Earth days' });
const venus = addBody({ key:'venus', name:'Venus', type:'rocky planet · runaway greenhouse', parent:sun, el:PLANET_EL.venus, R:6051.8, pole:[272.76, 67.16], W:[160.20, -1.4813688], kind:1,
  fact:'Almost Earth\'s twin in size, smothered by clouds of sulphuric acid. The surface is 465 °C under 92 times Earth\'s air pressure.', farLum:1.1, farColor:[1, 0.95, 0.82], sortKey:0.72,
  readout:() => 'radius 6,052 km · spins backwards, once every 243 days\nits cloud tops race around in just 4 days' });
const mars = addBody({ key:'mars', name:'Mars', type:'rocky planet · the red planet', parent:sun, el:PLANET_EL.mars, R:3389.5, pole:[317.269, 54.432], W:[176.630, 350.89198226], kind:2,
  fact:'Rust-red dust, polar ice caps, Olympus Mons (three times the height of Everest) and a canyon as long as the United States.', farLum:0.7, farColor:[1, 0.62, 0.42], sortKey:1.52,
  readout:() => 'radius 3,390 km · a day lasts 24 h 37 min\nsurface pressure under 1% of Earth\'s' });
const uranus = addBody({ key:'uranus', name:'Uranus', type:'ice giant · tipped on its side', parent:sun, el:PLANET_EL.uranus, R:25362, pole:[257.311, -15.175], W:[203.81, -501.1600928], kind:3,
  fact:'Knocked over by an ancient collision, it rolls around the Sun with its axis tilted 98°, so each pole gets 42 years of daylight.', farLum:0.4, farColor:[0.7, 0.9, 0.95], sortKey:19.2,
  readout:() => 'radius 25,360 km · 19 AU from the Sun\nlight from the Sun takes 2 h 40 min to arrive' });
const neptune = addBody({ key:'neptune', name:'Neptune', type:'ice giant · outermost planet', parent:sun, el:PLANET_EL.neptune, R:24622, pole:[299.36, 43.46], W:[249.978, 541.1397757], kind:4,
  fact:'The windiest world known: storms race at 2,000 km/h around a deep-blue methane atmosphere. It takes 165 years to orbit the Sun once.', farLum:0.35, farColor:[0.5, 0.65, 1], sortKey:30,
  readout:() => 'radius 24,620 km · 30 AU from the Sun\nfound in 1846 by mathematics before telescopes' });
const pluto = addBody({ key:'pluto', name:'Pluto', type:'dwarf planet · Kuiper belt', parent:sun, R:1188.3, pole:[132.993, -6.163], W:[302.695, 56.3625225], kind:5,
  el:[39.48211675, 0.24882730, 17.14001206, 238.92903833, 224.06891629, 110.30393684, -0.00031596, 0.00005170, 0.00004818, 145.20780515, -0.04062942, -0.01183482],
  fact:'A world of nitrogen glaciers, water-ice mountains and a vast pale heart, seen close up only once, by New Horizons in 2015.', farLum:0.2, farColor:[0.9, 0.8, 0.7], sortKey:39.5,
  readout:() => 'radius 1,188 km, smaller than our Moon\nsunlight there is 1,000 times dimmer than at Earth' });

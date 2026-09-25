
// ================================================================ content pack: famous nebulae (Orion, Horsehead, Helix, Ring, Carina, Veil)
// Each nebula is a volume inside its bounding sphere (local radius 1, +z faces Earth for the classic view).
const sdSeg2 = `float sdSeg(vec2 p, vec2 a, vec2 b, float r){ vec2 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba)/dot(ba, ba), 0., 1.); return length(pa - ba*h) - r; }`;
// a cluster of young stars: positions scattered around centre c with spread s (local units)
function clusterPS(n, c, s, hot = 22000, extra){
  const ps = makePS(n); const bright = [];
  for (let i=0;i<n;i++){
    const r = s*Math.pow(rnd(), 0.8), d = randDir(), p = V.add(c, V.mul(d, r)), w = 0.25 + 2.6*Math.pow(rnd(), 8), col = blackbodyJS(3500 + hot*Math.pow(rnd(), 1.5));
    ps.a.set([p[0], p[1], p[2], w], i*4); ps.c.set([col[0], col[1], col[2], 0], i*4);
    if (w > 1.3 && bright.length < 10) bright.push({ p, w:Math.min(w, 2.4), c:col });
  }
  ps.upload('ac');
  return { ps, spikes:makeSpikes(bright) };
}
const nebView = (pos, extra = []) => [{ dirFn:() => V.norm(V.mul(pos, -1)), k:1.6, hold:9, drift:0.02 }, ...extra];

// ---------------------------------------------------------------- the Orion Nebula (M42): a bowl blown into a molecular cloud by the Trapezium stars
const FS_ORION = COMMON + `
void main(){
  vec3 o, d; localRay(o, d);
  vec2 h = sphIsect(o, d, vec3(0.), 1.); if(h.y < 0.) discard;
  int N = int(mix(40., 72., uLod));
  float t0 = max(h.x, 0.), dt = (h.y - t0)/float(N), jit = hash12(gl_FragCoord.xy)*dt, tm = uTime;
  vec3 col = vec3(0.); float T = 1.;
  for(int i=0;i<72;i++){
    if(i >= N) break;
    vec3 p = o + d*(t0 + jit + dt*float(i)); float r = length(p);
    vec3 w = vec3(fbm3(p*2.1 + 3.), fbm3(p*2.1 + 7.), fbm3(p*2.1 + 11.)) - 0.5;
    vec3 q = p + w*0.45;
    float bowl = length((q - vec3(0.03, 0.02, 0.28))*vec3(1., 1.12, 1.25));
    float wall = exp(-pow((bowl - 0.58)/0.15, 2.))*smoothstep(0.3, -0.35, q.z);
    float g = fbmW(p*3.3 + vec3(0., 0., tm*0.004));
    float em = wall*(0.3 + 2.2*g*g) + exp(-bowl*bowl*5.)*0.9*(0.35 + g);
    // the Orion Bar: an ionisation front seen edge-on, south-east of the Trapezium
    vec2 bq = rot2(0.5)*(p.xy - vec2(0.18, -0.2));
    float bar = exp(-pow(bq.y/0.035, 2.))*smoothstep(0.42, 0.05, abs(bq.x))*smoothstep(0.35, -0.25, p.z);
    em += bar*(0.6 + 1.4*ridge(p*10.))*1.6;
    // outer wings and the M43 bubble to the north
    em += exp(-pow((length(p.xy*vec2(0.85, 1.15)) - 0.74)/0.13, 2.))*smoothstep(0.45, -0.5, p.z)*(0.2 + ridge(p*4. + 2.))*0.55;
    em += exp(-pow((length(p - vec3(0.02, 0.62, -0.1)) - 0.12)/0.05, 2.))*0.9;
    em += exp(-dot(p.xy - vec2(0.02, 0.0), p.xy - vec2(0.02, 0.0))*22.)*smoothstep(-0.2, 0.25, p.z)*smoothstep(0.5, 0.2, p.z)*1.6*(0.6 + g);   // the bright heart around the Trapezium
    float hot = exp(-dot(p.xy, p.xy)*7.)*smoothstep(-0.6, 0.2, p.z);
    vec3 c = mix(vec3(1., 0.32, 0.3), vec3(0.42, 1., 0.78), hot*0.85);
    c = mix(c, vec3(1., 0.62, 0.45), bar*0.5);
    // dust: the Fish's Mouth lane, foreground veils, and the dark cloud the bowl is carved into
    float lane = smoothstep(0.08, 0., abs(p.y - 0.3 - 0.12*sin(p.x*5.)) - 0.05*fbm3(p*6.))*smoothstep(0.42, 0.12, abs(p.x + 0.1))*smoothstep(-0.1, 0.35, p.z);
    float veil = smoothstep(0.56, 0.8, fbm3(p*2.4 + 20.))*smoothstep(0.1, 0.6, p.z)*0.8;
    float back = smoothstep(-0.25, -0.75, p.z)*smoothstep(0.5, 1., r);
    col += T*c*em*dt*5.;
    T *= exp(-(lane*16. + veil*1.4 + back*3.)*dt);
    if(T < 0.01) break;
  }
  // the Trapezium: four massive young stars lighting the whole nebula
  vec3 tp[4] = vec3[](vec3(0.02, 0.035, 0.28), vec3(-0.018, 0.012, 0.3), vec3(0.03, -0.022, 0.29), vec3(-0.006, -0.034, 0.31));
  for(int k=0;k<4;k++) col += vec3(0.75, 0.85, 1.)*(pblob(o, d, tp[k], 0.004)*700. + blob(o, d, tp[k], 0.03)*0.7);
  outCol(col, (1. - T)*0.9);
}`;
const orion = (() => {
  const pos = radec(hms(5,35,17.3), dms(-5,23,28), 1344), cl = clusterPS(Math.round(420*QUALITY), [0, 0, 0.25], 0.32, 26000);
  return addObj({ key:'orion', name:'Orion Nebula', label:'Orion Nebula', type:'stellar nursery · M42 · in the sword of Orion', group:'nebulae', sortKey:1344,
    fact:'The nearest big star factory, visible to the naked eye as the fuzzy middle "star" of Orion\'s sword. Four hot young stars at its heart, the Trapezium, light the whole cloud.',
    pos, rad:14, R0:facingEarth(pos, [0, 0, 1], 0), prog:program(VS_RECT, FS_ORION), minZoom:0.06, pxMin:6, farColor:[0.7, 0.9, 0.8], farLum:0.55, labelRange:2e4, aka:'m42 orion nebula trapezium stellar nursery',
    views:nebView(pos, [{ d:[0.55, 0.25, 0.8], k:0.7, off:[0, 0, 0.2], hold:8, drift:0.03 }, { d:[-0.2, 0.15, 1], k:0.28, off:[0.02, 0.02, 0.28], hold:8, drift:0.02 }]),
    particles:[{ ps:cl.ps, prog:'ptBasic', mode:1, sb:1.4, size:1.8 }, { ps:cl.spikes, prog:'spike', lines:true, mode:1, sb:1.4, size:1, len:0.03, q0:() => [1, 0, 0, 0] }],
    readout:() => '1,344 light-years · about 24 light-years across\n~2,000 newborn stars, most under a million years old' });
})();

// ---------------------------------------------------------------- the Horsehead Nebula (Barnard 33): dark dust against the red glow of IC 434
const FS_HORSEHEAD = COMMON + sdSeg2 + `
float taper(vec2 p, vec2 a, vec2 b, float r0, float r1){ vec2 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba)/dot(ba, ba), 0., 1.); return length(pa - ba*h) - mix(r0, r1, h); }
// the silhouette in profile, facing left: neck rising from the cloud, head sloping down to the muzzle, one ear, the mane behind
float horse(vec2 q){
  float neck = taper(q, vec2(0.1, -0.42), vec2(0.03, 0.12), 0.15, 0.11);
  float head = taper(q, vec2(0.03, 0.27), vec2(-0.27, 0.0), 0.115, 0.062);
  float cheek = length(q - vec2(-0.01, 0.1)) - 0.1;
  float ear = taper(q, vec2(0.04, 0.33), vec2(0.075, 0.44), 0.03, 0.012);
  float mane = taper(q, vec2(0.13, 0.26), vec2(0.17, -0.12), 0.05, 0.075);
  return min(min(min(neck, head), min(cheek, ear)), mane);
}
void main(){
  vec3 o, d; localRay(o, d);
  vec2 h = sphIsect(o, d, vec3(0.), 1.); if(h.y < 0.) discard;
  int N = int(mix(44., 80., uLod));
  float t0 = max(h.x, 0.), dt = (h.y - t0)/float(N), jit = hash12(gl_FragCoord.xy)*dt, tm = uTime;
  vec3 col = vec3(0.); float T = 1.;
  for(int i=0;i<80;i++){
    if(i >= N) break;
    vec3 p = o + d*(t0 + jit + dt*float(i));
    float edge = -0.3 + 0.07*fbm3(vec3(p.x*5., 0., p.z*5.)) + 0.04*sin(p.x*9.);
    // IC 434: glowing hydrogen behind, streaked by the wind of sigma Orionis above
    float slab = smoothstep(-0.8, -0.55, p.z)*smoothstep(-0.05, -0.3, p.z);
    float streak = pow(ridge(vec3(p.x*13., p.y*1.6 + tm*0.01, p.z*4.)), 2.);
    float glow = slab*smoothstep(edge - 0.1, edge + 0.25, p.y)*(0.25 + 0.9*streak + 0.5*fbmW(p*4.))*(0.6 + 0.4*smoothstep(-0.6, 0.8, p.x + p.y*0.3));
    // the dark cloud L1630 below, and the horsehead rising out of it
    float cloud = smoothstep(edge + 0.02, edge - 0.04, p.y)*smoothstep(-0.35, -0.15, p.z)*smoothstep(0.35, 0.15, p.z);
    vec2 q = p.xy + (vec2(fbm3(p*7.), fbm3(p*7. + 5.)) - 0.5)*0.05;
    float hs = horse(q);
    float head = smoothstep(0.01, -0.02, hs)*smoothstep(0.14, 0.08, abs(p.z + 0.02));
    float rim = exp(-pow(hs/0.018, 2.))*smoothstep(0.16, 0.06, abs(p.z + 0.02))*smoothstep(-0.3, 0.3, p.y);
    col += T*(vec3(1., 0.24, 0.3)*glow*3.4 + vec3(1., 0.5, 0.45)*rim*3.)*dt;
    // NGC 2023: a small blue reflection nebula lit by a young star below the head
    col += T*vec3(0.45, 0.65, 1.)*exp(-dot(p - vec3(-0.42, -0.58, 0.05), p - vec3(-0.42, -0.58, 0.05))*55.)*0.9*dt;
    T *= exp(-(cloud*14. + head*30.)*dt);
    if(T < 0.01) break;
  }
  col += vec3(0.75, 0.85, 1.)*(pblob(o, d, vec3(0.5, 0.78, -0.35), 0.006)*500. + blob(o, d, vec3(0.5, 0.78, -0.35), 0.05)*0.5);   // sigma Orionis
  col += vec3(0.8, 0.88, 1.)*pblob(o, d, vec3(-0.42, -0.58, 0.05), 0.003)*300.;
  outCol(col, (1. - T)*0.95);
}`;
const horsehead = (() => {
  const pos = radec(hms(5,40,59), dms(-2,27,30), 1375);
  return addObj({ key:'horsehead', name:'Horsehead Nebula', label:'Horsehead', type:'dark nebula · Barnard 33 · in Orion', group:'nebulae', sortKey:1375,
    fact:'A pillar of cold, dusty gas that happens to look like a horse\'s head, silhouetted against glowing hydrogen lit by the star sigma Orionis.',
    pos, rad:4, R0:facingEarth(pos, [0, 0, 1], -8), prog:program(VS_RECT, FS_HORSEHEAD), minZoom:0.08, pxMin:6, farColor:[1, 0.45, 0.45], farLum:0.35, labelRange:1.5e4, aka:'barnard 33 b33 ic 434 horse head dark nebula',
    views:nebView(pos, [{ d:[0.35, 0.1, 0.95], k:0.8, off:[-0.08, 0.15, 0], hold:8, drift:0.02 }, { d:[-0.9, 0.2, 0.35], k:1.1, off:[0, 0.1, 0], hold:8, drift:0.03 }]),
    readout:() => '1,375 light-years · the head is about 3.5 light-years tall\nit is slowly being eroded and will be gone in ~5 million years' });
})();

// ---------------------------------------------------------------- ring-shaped planetary nebulae: the Helix (NGC 7293) and the Ring (M57)
// uP0: ring radius, width, barrel half-length, inner fill   uP1: second ring radius, tilt, strength, halo radius   uP2: halo strength, knot glow, colour shift
const FS_RINGPN = COMMON + `
float barrel(vec3 q, float R, float W, float Hh){ float rho = length(q.xy); return exp(-pow((rho - R*(1. + 0.14*q.z*q.z/(Hh*Hh)))/W, 2.))*smoothstep(Hh, Hh*0.55, abs(q.z)); }
void main(){
  vec3 o, d; localRay(o, d);
  vec2 h = sphIsect(o, d, vec3(0.), 1.); if(h.y < 0.) discard;
  int N = int(mix(40., 70., uLod));
  float t0 = max(h.x, 0.), dt = (h.y - t0)/float(N), jit = hash12(gl_FragCoord.xy)*dt, tm = uTime;
  float R = uP0.x, W = uP0.y, Hh = uP0.z;
  vec3 col = vec3(0.); float T = 1.;
  mat2 tl = rot2(uP1.y);
  for(int i=0;i<70;i++){
    if(i >= N) break;
    vec3 p = o + d*(t0 + jit + dt*float(i));
    float n = fbmW(p*6. + tm*0.008);
    float b = barrel(p, R, W, Hh)*(0.35 + 1.3*n);
    vec3 p2 = vec3(p.x, tl*p.yz); float b2 = uP1.z > 0. ? barrel(p2, uP1.x, W*1.2, Hh*1.3)*(0.3 + 1.2*n)*uP1.z : 0.;
    float rho = length(p.xy);
    float fill = smoothstep(R, R*0.2, rho)*smoothstep(Hh*1.2, 0., abs(p.z))*uP0.w*(0.4 + n);
    float halo = uP2.x > 0. ? exp(-pow((length(p) - uP1.w)/0.06, 2.))*(0.2 + pow(ridge(p*6. + 3.), 2.))*uP2.x : 0.;
    vec3 inner = mix(vec3(0.3, 0.85, 1.), vec3(0.35, 1., 0.75), uP2.z);
    vec3 rimc = mix(vec3(1., 0.38, 0.3), vec3(1., 0.55, 0.35), n);
    vec3 c = mix(inner, rimc, smoothstep(R - W*0.8, R + W*0.5, rho));
    col += T*(c*(b + b2)*1.5 + inner*fill*0.8 + vec3(1., 0.3, 0.3)*halo)*dt*2.2;
    T *= exp(-(b + b2)*0.6*dt);
  }
  col += vec3(0.8, 0.88, 1.)*(pblob(o, d, vec3(0.), 0.004)*260. + blob(o, d, vec3(0.), 0.03)*0.35);
  outCol(col, (1. - T)*0.6);
}`;
P.ringpn = program(VS_RECT, FS_RINGPN);
function addRingPN(def){
  const u = def.u;
  const o = addObj(Object.assign({ group:'nebulae', prog:P.ringpn, minZoom:0.1, pxMin:6, farLum:0.45, labelRange:def.rad*1e4,
    setU(pr){ gl.uniform4fv(pr.u.uP0, u[0]); gl.uniform4fv(pr.u.uP1, u[1]); gl.uniform4fv(pr.u.uP2, u[2]); } }, def));
  o.R0 = facingEarth(o.pos, def.hero || [0, 0, 1], def.roll || 0); o.rot = o.R0;
  return o;
}
const helix = (() => {
  const pos = radec(hms(22,29,38.55), dms(-20,50,13.6), 655);
  // thousands of cometary knots: dense heads pointing at the central star, with tails streaming outward
  const n = Math.round(700*QUALITY), heads = makePS(n), tails = makePS(n*2);
  for (let i=0;i<n;i++){
    const a = rnd()*6.283, r = 0.3 + 0.16*Math.pow(rnd(), 0.7), z = rndn()*0.06, h = [r*Math.cos(a), r*Math.sin(a), z], t = V.mul(h, 1.1 + 0.12*rnd()), w = 0.4 + rnd();
    heads.a.set([h[0], h[1], h[2], w], i*4); heads.c.set([1, 0.72, 0.62, 0], i*4);
    tails.a.set([h[0], h[1], h[2], w*0.7], i*8); tails.c.set([1, 0.4, 0.35, 0], i*8); tails.a.set([t[0], t[1], t[2], 0], i*8 + 4); tails.c.set([1, 0.4, 0.35, 0], i*8 + 4);
  }
  heads.upload('ac'); tails.upload('ac');
  return addRingPN({ key:'helix', name:'Helix Nebula', label:'Helix', type:'planetary nebula · NGC 7293 · "the Eye of God"', sortKey:655, pos, rad:2.2, farColor:[0.5, 0.9, 1],
    fact:'One of the closest planetary nebulae: the outer layers of a dying Sun-like star, blown into a double ring that looks like a giant eye. Its inner edge is peppered with thousands of comet-shaped knots.',
    aka:'ngc 7293 eye of god planetary nebula', hero:V.norm([0.1, 0.25, 1]), roll:20,
    u:[[0.42, 0.09, 0.45, 0.25], [0.66, 0.9, 0.7, 0.93], [0.55, 1, 0.2, 0]],
    views:nebView(pos, [{ d:[0.6, 0.3, 0.7], k:1.2, hold:8, drift:0.03 }, { d:[0.05, 0.1, 1], k:0.5, off:[0.3, 0.1, 0], hold:8, drift:0.02 }]),
    particles:[{ ps:heads, prog:'ptBasic', mode:1, sb:1.2, size:1.6 }, { ps:tails, prog:'lnBasic', lines:true, mode:1, sb:0.8, size:1 }],
    readout:() => '655 light-years · 2.9 light-years across\nits central white dwarf is about 100,000 °C' });
})();
const ringNeb = addRingPN({ key:'ringneb', name:'Ring Nebula', label:'Ring Nebula', type:'planetary nebula · M57 · in Lyra', sortKey:2570, rad:1.2, farColor:[0.6, 0.95, 0.8],
  pos:radec(hms(18,53,35.08), dms(33,1,45), 2570),
  fact:'A glowing barrel of gas thrown off by a dying star, seen almost end-on so it looks like a smoke ring. The blue-green centre is oxygen; the red rim is hydrogen and nitrogen.',
  aka:'m57 ngc 6720 planetary nebula lyra', hero:V.norm([0.05, 0.1, 1]), roll:-30,
  u:[[0.46, 0.1, 0.55, 0.45], [0, 0, 0, 0.9], [0.35, 0, 0.8, 0]],
  views:[{ dirFn:() => V.norm(V.mul(ringNeb.pos, -1)), k:1.8, hold:9, drift:0.02 }, { d:[1, 0.2, 0.1], k:1.5, hold:8, drift:0.03 }, { d:[0.3, 0.15, 1], k:0.7, hold:7, drift:0.02 }],
  readout:() => '2,570 light-years · about a light-year across\nseen from the side it is a hollow barrel, not a ring' });

// ---------------------------------------------------------------- the Carina Nebula: one of the biggest star-forming regions in the Milky Way, home of Eta Carinae
const FS_CARINA = COMMON + sdSeg2 + `
// dust columns pointing at the central clusters, their tips lit by ultraviolet light
float column(vec3 p, vec2 base, vec2 tip, float r0, float n){
  vec2 ba = tip - base, pa = p.xy - base; float hh = clamp(dot(pa, ba)/dot(ba, ba), 0., 1.);
  float rad = r0*(1. - 0.55*hh) + (n - 0.5)*0.05;
  return max(length(vec2(length(pa - ba*hh), p.z*1.3)) - rad, -0.2);
}
void main(){
  vec3 o, d; localRay(o, d);
  vec2 h = sphIsect(o, d, vec3(0.), 1.); if(h.y < 0.) discard;
  int N = int(mix(44., 76., uLod));
  float t0 = max(h.x, 0.), dt = (h.y - t0)/float(N), jit = hash12(gl_FragCoord.xy)*dt, tm = uTime;
  vec3 col = vec3(0.); float T = 1.;
  for(int i=0;i<76;i++){
    if(i >= N) break;
    vec3 p = o + d*(t0 + jit + dt*float(i)); float r = length(p);
    float g = fbmW(p*2.6 + vec3(0., tm*0.003, 0.)), g2 = fbm3(p*5. + 4.);
    float em = pow(g, 3.2)*4.2*smoothstep(1., 0.45, r)*smoothstep(0.55, 0.15, abs(p.z));
    vec3 c = mix(vec3(1., 0.3, 0.3), vec3(0.4, 0.95, 0.85), smoothstep(0.45, 0.75, g2));
    c = mix(c, vec3(1., 0.62, 0.35), smoothstep(0.62, 0.8, fbm3(p*3. + 9.))*0.6);
    // the great dark V of dust across the middle, and the Keyhole near Eta Carinae
    float vlane = smoothstep(0.1, 0., abs(abs(p.x + 0.05)*0.8 - (p.y + 0.45)*0.55) - 0.05*fbm3(p*7.))*smoothstep(-0.55, 0.1, p.y)*smoothstep(0.35, 0.1, abs(p.z));
    float key = smoothstep(0.09, 0.03, length((p - vec3(0.12, 0.04, 0.1))*vec3(1., 1.6, 1.)) + (fbm3(p*18.) - 0.5)*0.05);
    // Mystic Mountain and its cousins around the rim
    float n = fbm3(p*9.);
    float colD = min(min(column(p, vec2(-0.85, -0.55), vec2(-0.5, -0.28), 0.1, n), column(p, vec2(0.85, -0.6), vec2(0.52, -0.3), 0.09, n)), column(p, vec2(0.2, -0.95), vec2(0.18, -0.6), 0.08, n));
    float colDust = smoothstep(0.02, -0.02, colD), colRim = exp(-pow(colD/0.02, 2.))*smoothstep(0.2, -0.2, colD);
    col += T*(c*em + vec3(1., 0.55, 0.35)*colRim*1.8)*dt*4.6;
    T *= exp(-(vlane*9. + key*20. + colDust*26. + smoothstep(0.6, 0.8, fbm3(p*3. + 30.))*smoothstep(0.1, 0.5, p.z)*3.)*dt);
    if(T < 0.01) break;
  }
  outCol(col, (1. - T)*0.9);
}`;
const carina = (() => {
  const pos = radec(hms(10,45,8.5), dms(-59,52,4), 7500);
  const t14 = clusterPS(Math.round(260*QUALITY), [-0.12, 0.08, 0.05], 0.1, 30000), t16 = clusterPS(Math.round(300*QUALITY), [0.08, -0.02, 0.05], 0.16, 28000);
  return addObj({ key:'carina', name:'Carina Nebula', label:'Carina Nebula', type:'giant star-forming region · NGC 3372', group:'nebulae', sortKey:7500,
    fact:'Four times bigger than the Orion Nebula and home to some of the most massive stars known, including Eta Carinae. Its dust pillars, like Mystic Mountain, are being carved by their light.',
    pos, rad:150, R0:facingEarth(pos, [0, 0, 1], 25), prog:program(VS_RECT, FS_CARINA), minZoom:0.02, pxMin:6, farColor:[1, 0.6, 0.55], farLum:0.6, labelRange:3e5, labelMin:30, aka:'ngc 3372 eta carinae nebula mystic mountain keyhole trumpler',
    visFn(rpx){ return smooth(6, 16, rpx)*(0.12 + 0.88*smooth(4, 60, orbit.dist)); },
    views:nebView(pos, [{ d:[0.2, -0.45, 0.85], k:0.85, off:[-0.45, -0.3, 0], hold:8, drift:0.02 }, { d:[-0.7, 0.3, 0.65], k:1.3, hold:8, drift:0.03 }]),
    particles:[{ ps:t14.ps, prog:'ptBasic', mode:1, sb:1.2, size:1.8 }, { ps:t16.ps, prog:'ptBasic', mode:1, sb:1.2, size:1.8 }, { ps:t14.spikes, prog:'spike', lines:true, mode:1, sb:1.2, size:1, len:0.03, q0:() => [1, 0, 0, 0] }],
    readout:() => '~7,500 light-years · about 300 light-years across\nits clusters hold dozens of stars over 50 times the Sun\'s mass' });
})();

// ---------------------------------------------------------------- the Veil Nebula: the frayed shell of a star that exploded about 15,000 years ago
const FS_VEIL = COMMON + `
void main(){
  vec3 o, d; localRay(o, d);
  vec2 h = sphIsect(o, d, vec3(0.), 1.); if(h.y < 0.) discard;
  int N = int(mix(40., 70., uLod));
  float t0 = max(h.x, 0.), dt = (h.y - t0)/float(N), jit = hash12(gl_FragCoord.xy)*dt, tm = uTime;
  vec3 col = vec3(0.);
  for(int i=0;i<70;i++){
    if(i >= N) break;
    vec3 p = o + d*(t0 + jit + dt*float(i)); float r = length(p) + (fbm3(p*3.) - 0.5)*0.12;
    vec3 u = normalize(p);
    float shell = exp(-pow((r - 0.84)/0.06, 2.));
    float arcs = smoothstep(0.35, 0.65, fbm3(u*2.2 + 5.));
    float fil = pow(ridge(p*5. + vec3(tm*0.004)), 3.) + 0.6*pow(ridge(p*13. + 7.), 5.);
    float em = shell*arcs*fil;
    vec3 c = mix(vec3(1., 0.3, 0.32), vec3(0.3, 0.95, 1.), smoothstep(0.8, 0.9, r));
    col += c*em*dt*20.;
  }
  outCol(col, 0.);
}`;
const veil = (() => {
  const pos = radec(hms(20,51,0), dms(30,40,0), 2400);
  return addObj({ key:'veil', name:'Veil Nebula', label:'Veil Nebula', type:'supernova remnant · the Cygnus Loop', group:'nebulae', sortKey:2400,
    fact:'The expanding wreckage of a star that exploded 10,000 to 20,000 years ago. The blast wave is still ploughing into surrounding gas, lighting it up in long twisted filaments.',
    pos, rad:65, R0:facingEarth(pos, [0, 0, 1], 0), prog:program(VS_RECT, FS_VEIL), minZoom:0.05, pxMin:6, farColor:[0.55, 0.9, 1], farLum:0.4, labelRange:1.5e5, labelMin:10, aka:'cygnus loop ngc 6960 6992 witch broom supernova remnant',
    visFn(rpx){ return smooth(6, 16, rpx)*(0.15 + 0.85*smooth(3, 40, orbit.dist)); },
    views:nebView(pos, [{ d:[0.9, 0.1, 0.4], k:0.45, off:[0.82, 0, 0], hold:8, drift:0.02 }, { d:[0.3, 0.6, 0.7], k:1.5, hold:8, drift:0.03 }]),
    readout:() => '2,400 light-years · about 110 light-years across\nthe shock is still racing outward at ~1.5 million km/h' });
})();

// ---------------------------------------------------------------- the Eagle Nebula (M16): the cavity the Pillars of Creation stand in
// Local radius 1 = 40 light-years. The young cluster NGC 6611 sits in the middle of a cavity it has blown; the cold cloud around it is
// being eaten from the inside, leaving columns that all point back at the cluster: the Pillars, the Spire, and several smaller trunks.
const FS_EAGLE = COMMON + `
float column(vec3 p, vec3 base, vec3 tip, float r0){ vec3 pa = p - base, ba = tip - base; float h = clamp(dot(pa, ba)/dot(ba, ba), 0., 1.); return length(pa - ba*h) - r0*mix(1., 0.4, h); }
void main(){
  vec3 o, d; localRay(o, d);
  vec2 hh = sphIsect(o, d, vec3(0.), 1.); if(hh.y < 0.) discard;
  int N = int(mix(34., 58., uLod));
  float t0 = max(hh.x, 0.), dt = (hh.y - t0)/float(N), jit = hash12(gl_FragCoord.xy)*dt, tm = uTime;
  vec3 col = vec3(0.); float T = 1.;
  vec3 PIL = uP0.xyz;
  for(int i=0;i<58;i++){
    if(i >= N) break;
    vec3 p = o + d*(t0 + jit + dt*float(i)); float r = length(p);
    vec2 w = vec2(fbm3(p*1.7 + 3.), fbm3(p*1.7 + 7.)) - 0.5;
    float edge = smoothstep(1., 0.5, r + 0.35*w.x);
    if(edge < 0.002) continue;
    vec3 q = p + vec3(w, w.x*w.y)*0.5;
    float rq = length(q*vec3(1., 1.15, 1.35));
    float wallD = rq - 0.45;
    float front = exp(-pow(wallD/0.11, 2.));
    float inside = smoothstep(0.1, -0.2, wallD);
    float g = fbm3(p*3.1 + vec3(0., 0., tm*0.003) + vec3(w*1.5, 0.));
    float cloud = smoothstep(-0.05, 0.3, wallD)*edge;
    float cols = column(p, vec3(0.44, -0.55, -0.05), vec3(0.2, -0.2, -0.02), 0.07);
    cols = min(cols, column(p, vec3(-0.58, 0.3, -0.1), vec3(-0.32, 0.17, -0.05), 0.05));
    cols = min(cols, column(p, vec3(0.58, 0.36, -0.15), vec3(0.36, 0.2, -0.08), 0.045));
    cols = min(cols, column(p, vec3(-0.16, 0.64, -0.1), vec3(-0.08, 0.41, -0.05), 0.04));
    cols = min(cols, column(p, vec3(-0.62, -0.26, 0.), vec3(-0.39, -0.15, 0.), 0.05));
    cols = min(cols, column(p, vec3(0.2, -0.66, -0.2), vec3(0.12, -0.44, -0.1), 0.05));
    if(cols < 0.08) cols += (noise(p*18.) - 0.5)*0.05;
    float dust = smoothstep(0.012, -0.03, cols);
    float rim = exp(-pow((cols - 0.012)/0.022, 2.));
    float pil = smoothstep(0.05, 0.13, length(p - PIL));   // room for the detailed Pillars model
    float em = (inside*(0.16 + 1.1*g*g) + front*(0.35 + 2.4*g*g*g))*edge*pil;
    vec3 teal = vec3(0.18, 0.72, 0.68), gold = vec3(1., 0.7, 0.33), red = vec3(1., 0.33, 0.26);
    vec3 c = mix(teal, mix(gold, red, smoothstep(0.55, 0.9, rq)), smoothstep(0.2, 0.55, rq + 0.25*w.y));
    col += T*(c*em + gold*rim*2.4*pil*edge)*dt*2.3;
    T *= exp(-(dust*16.*pil + cloud*(0.6 + 3.*smoothstep(0.5, 0.75, g + 0.3*w.y)))*dt);
    if(T < 0.01) break;
  }
  outCol(col, (1. - T)*0.9);
}`;
const eagle = (() => {
  const pil = BYKEY.pillars, R0 = pil.R0, rad = 40;
  const offL = [0.08, -0.27, 0.04];   // the Pillars, south-east of the cluster, in Eagle units
  const pos = V.sub(pil.pos, M3.apply(R0, V.mul(offL, rad)));
  const cl = clusterPS(Math.round(420*QUALITY), [0, 0.03, 0.05], 0.13, 30000);
  return addObj({ key:'eagle', name:'Eagle Nebula', label:'Eagle Nebula', type:'star-forming region · M16, home of the Pillars of Creation', group:'nebulae', sortKey:6499,
    fact:'A cavity 20 light-years wide, blown into a cold cloud by the hot young stars of NGC 6611. What is left of the cloud stands in columns pointing back at the cluster: the Pillars of Creation, the 9-light-year Spire and a dozen smaller trunks.',
    pos, rad, R0, prog:program(VS_RECT, FS_EAGLE), minZoom:0.05, pxMin:6, farColor:[0.55, 0.85, 0.72], farLum:0.5, labelRange:8e4, labelMin:25, aka:'m16 eagle nebula ngc 6611 spire fairy star queen',
    setU(pr){ gl.uniform4f(pr.u.uP0, offL[0], offL[1], offL[2], 0); },
    // close to the Pillars the surrounding cloud steps back, so the columns stand out against a darker sky as in the telescope images
    visFn(rpx){ return smooth(6, 16, rpx)*(0.3 + 0.7*smooth(9, 45, V.len(pil.rel))); },
    views:[{ dirFn:() => V.norm(V.mul(pos, -1)), k:1.45, hold:9, drift:0.02 }, { d:[0.55, 0.3, 0.8], k:0.85, hold:8, drift:0.03 }, { d:[0.1, -0.25, 1], k:0.3, off:offL, hold:8, drift:0.02 }],
    particles:[{ ps:cl.ps, prog:'ptBasic', mode:1, sb:0.45, size:1.8 }, { ps:cl.spikes, prog:'spike', lines:true, mode:1, sb:0.45, size:1, len:0.02, q0:() => [1, 0, 0, 0] }],
    readout:() => '6,500 light-years · about 70 x 55 light-years\nthe Pillars are about 10 light-years from the cluster that is slowly destroying them' });
})();

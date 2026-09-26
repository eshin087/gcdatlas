
// ================================================================ Betelgeuse: a red supergiant with a handful of giant convection cells, a molecular envelope and dusty plumes
// local: bounding sphere 1, photosphere radius RS; uP0.x = dimming dust veil strength
const FS_BETELGEUSE = COMMON + `
const float RS = 0.2;
vec2 vorB(vec3 p){
  vec3 i = floor(p), f = fract(p); float d1 = 8., d2 = 8.;
  for(int z=-1;z<=1;z++) for(int y=-1;y<=1;y++) for(int x=-1;x<=1;x++){
    vec3 g = vec3(float(x), float(y), float(z)), c = i + g;
    vec3 h = vec3(hash13(c), hash13(c + 17.3), hash13(c + 41.1));
    vec3 r = g + 0.5 + 0.45*sin(uTime*0.06 + 6.2831*h) - f; float dd = dot(r, r);
    if(dd < d1){ d2 = d1; d1 = dd; } else if(dd < d2) d2 = dd;
  }
  return vec2(sqrt(d1), sqrt(d2));
}
float bump(vec3 n){ return 1. + 0.05*(fbm3(n*1.6 + uTime*0.01) - 0.5)*2.; }
void main(){
  vec3 o, d; localRay(o, d);
  vec3 col = vec3(0.); float T = 1., alpha = 0.;
  // the lumpy photosphere: find the surface along the ray
  vec2 hs = sphIsect(o, d, vec3(0.), RS*1.06);
  float tsurf = 1e9; vec3 n = vec3(0.);
  if(hs.y > 0.){
    float t = max(hs.x, 0.);
    for(int i=0;i<24;i++){ vec3 p = o + d*t; float r = length(p), rr = RS*bump(p/r); float dd = r - rr; if(dd < 0.0004){ tsurf = t; n = p/r; break; } t += dd*0.9; if(t > hs.y) break; }
  }
  // extended envelope and dust: march from the camera up to the surface (or through)
  vec2 he = sphIsect(o, d, vec3(0.), 1.);
  if(he.y > 0.){
    float t0 = max(he.x, 0.), t1 = min(he.y, tsurf); int N = int(mix(30., 54., uLod)); float dt = (t1 - t0)/float(N);
    float jit = hash12(gl_FragCoord.xy)*dt;
    for(int i=0;i<54;i++){
      if(i >= N) break;
      vec3 p = o + d*(t0 + jit + dt*float(i)); float r = length(p)/RS; vec3 u = p/length(p);
      if(r < 1.) continue;
      // MOLsphere: warm molecular gas hugging the star, churning slowly
      float mol = exp(-(r - 1.)/0.25)*(0.6 + 0.8*fbm3(p*18. + vec3(0., uTime*0.03, -uTime*0.02)));
      // dust: clumpy plumes launched from the surface that drift outward and fray (as in the VLT/VISIR images), and the 2019 veil
      // over the south. The pattern moves out along the radius with time; everything fades out well before the edge of the volume.
      float tm = uTime*0.05;
      vec3 w = u*2.6 + 0.35*vec3(fbm3(u*2. + 3.1 + tm*0.3), fbm3(u*2. + 8.4 - tm*0.2), fbm3(u*2. + 5.7));
      float flow = fbm3(w + vec3(0., 0., -(r - tm*3.)*0.55) + 7.);
      float fil = ridge(w*1.7 + vec3(0., -(r - tm*3.)*0.9, 0.) + 2.);
      float plume = pow(flow, 2.2)*(0.55 + 0.9*fil)*smoothstep(1.25, 2., r)*exp(-(r - 1.8)/1.5)*smoothstep(4.9, 3.4, r);
      float veil = uP0.x*exp(-pow((u.y + 0.55)/0.35, 2.))*exp(-pow((r - 1.35)/0.25, 2.))*(0.5 + fbm3(p*12. + tm));
      float dust = plume*1.5 + veil*3.;
      vec3 lit = vec3(1., 0.5, 0.25)/(r*r);          // starlight scattered by dust
      col += T*(vec3(1., 0.32, 0.12)*mol*0.9 + lit*dust*0.5)*dt*6.;
      T *= exp(-(dust*0.6 + mol*0.15)*dt*10.);
    }
  }
  if(tsurf < 1e8){
    float mu = max(dot(n, -d), 0.);
    // a few giant convection cells (as in the ALMA and VLT images), smaller cells inside them, and close up
    // (uP0.y) a turbulent skin of granules and bright filaments that slowly churns
    vec2 v = vorB(n*1.9 + 2.);
    float cell = smoothstep(0., 0.55, v.y - v.x);
    vec2 v2 = vorB(n*6.5 + 9.);
    float fine = smoothstep(0., 0.3, v2.y - v2.x);
    float close = uP0.y, tm = uTime;
    float gran = 0.5, fil = 0.;
    if(close > 0.01){
      vec3 q = n*9. + 0.8*vec3(fbm3(n*3. + tm*0.03), fbm3(n*3. + 5.2 - tm*0.025), fbm3(n*3. + 9.1 + tm*0.02));
      gran = fbm3(q*3.2 + vec3(0., tm*0.08, 0.));
      fil = ridge(q*1.6 + vec3(tm*0.03, 0., -tm*0.02));
    }
    float hot = pow(noise(n*2.4 + vec3(0., tm*0.015, 0.)), 5.)*5.;   // rising plumes of hotter gas
    float heat = clamp(0.55*cell + 0.3*(fine - 0.5) + close*(1.5*(gran - 0.5) + 0.8*(fil - 0.45)) + 0.2*min(hot, 1.5) + 0.14, 0., 1.);
    float I = pow(mu, 0.75)*(0.12 + 0.95*heat)*(1. + 0.3*close*(fil - 0.4));
    float Tl = mix(2700., 4200., heat)*(0.86 + 0.14*mu);   // dark lanes near 2,700 K, cell tops near 4,200 K (mean 3,600 K)
    col += T*blackbody(Tl)*I*3.*vec3(1., 0.84, 0.72);
    alpha = 1.;
  }
  outCol(col, max(alpha, 1. - T));
}`;
const betelgeuse = (() => {
  const R = 764*RSUN*KM, pos = radec(hms(5,55,10.3), dms(7,24,25), 548);
  const o = addObj({ key:'betelgeuse', name:'Betelgeuse', label:'Betelgeuse', type:'red supergiant · the shoulder of Orion', group:'stars', sortKey:548,
    fact:'Placed where the Sun is, it would swallow Mercury, Venus, Earth and Mars. Its surface is a few giant boiling cells; in 2019-20 it dimmed when it coughed out a cloud of dust. It will explode as a supernova.',
    pos, rad:R/0.2, solid:0.2, R0:facingEarth(pos, [0, 0.25, 1], 0), prog:program(VS_RECT, FS_BETELGEUSE), minZoom:0.23, pxMin:5, farColor:[1, 0.55, 0.3], farLum:1, noImpostor:true, labelRange:9000, aka:'alpha orionis red supergiant',
    views:[{d:[0.15, 0.25, 1], k:0.62, hold:10, drift:0.03}, {d:[0.3, 0.95, 0.35], k:1.9, hold:10, drift:0.02}, {d:[0.85, -0.2, 0.4], k:0.32, hold:8, drift:0.03}],
    setU(pr){ gl.uniform4f(pr.u.uP0, 0.6 + 0.4*Math.sin(this.t*0.05), smooth(120, 500, this.rpx || 0), 0, 0); },
    readout:() => '764 times the Sun\'s radius · 3.6 AU · 548 light-years\nabout 100,000 times as luminous as the Sun, and only ~10 million years old' });
  return o;
})();


// ================================================================ GLSL: shared
const VS_RECT = `#version 300 es
layout(location=0) in vec2 aPos;
uniform vec4 uRect;
void main(){ gl_Position = vec4(mix(uRect.xy, uRect.zw, aPos), 0., 1.); }`;

const COMMON = `#version 300 es
precision highp float;
precision highp sampler3D;
uniform vec2 uRes; uniform vec3 uCamPos; uniform mat3 uCamRot; uniform vec2 uTan;
uniform float uTime; uniform float uOut; uniform float uPix; uniform sampler3D uNoise;
uniform vec3 uPos; uniform float uRad; uniform mat3 uRot; uniform float uLod; uniform vec3 uCamLocal; uniform float uVis; uniform vec4 uSky;
uniform sampler2D uTex; uniform sampler2D uMW; uniform vec4 uGC;
uniform vec4 uP0; uniform vec4 uP1; uniform vec4 uP2; uniform vec4 uP3; uniform vec4 uP4; uniform mat3 uM0;
out vec4 fragColor;
#define PI 3.14159265
float hash13(vec3 p){ p = fract(p*0.1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y)*p.z); }
float hash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx)*0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y)*p3.z); }
float noise(vec3 p){ return texture(uNoise, p*(1./64.)).r; }
float fbm(vec3 p){ float a=.5, s=0.; for(int i=0;i<5;i++){ s += a*noise(p); p = p*2.03 + vec3(1.7,9.2,3.1); a *= .5; } return s/0.97; }
float fbm3(vec3 p){ float a=.5, s=0.; for(int i=0;i<3;i++){ s += a*noise(p); p = p*2.03 + vec3(1.7,9.2,3.1); a *= .5; } return s/0.875; }
// ridged multifractal: thin bright filaments
float ridge(vec3 p){ float a = .5, s = 0., w = 1.; for(int i=0;i<4;i++){ float n = 1. - abs(noise(p)*2. - 1.); n *= n; s += a*n*w; w = clamp(n*2., 0., 1.); p = p*2.1 + vec3(3.1,1.7,7.3); a *= .5; } return s/0.9375; }
// domain-warped fbm: turbulent, billowing gas
float fbmW(vec3 p){ vec3 q = vec3(fbm3(p), fbm3(p + 5.2), fbm3(p + 9.7)); return fbm(p + (q - 0.5)*2.6); }
mat2 rot2(float a){ float c = cos(a), s = sin(a); return mat2(c, s, -s, c); }
vec3 rayDir(){ vec2 uv = gl_FragCoord.xy/uRes*2. - 1.; return normalize(uCamRot*vec3(uv*uTan, 1.)); }
vec2 sphIsect(vec3 ro, vec3 rd, vec3 c, float r){ vec3 oc = ro - c; float b = dot(oc, rd); float h = b*b - dot(oc,oc) + r*r; if(h < 0.) return vec2(-1.); h = sqrt(h); return vec2(-b - h, -b + h); }
vec3 blackbody(float t){
  t = clamp(t, 1000., 40000.)/100.; vec3 c;
  c.r = t <= 66. ? 1. : clamp(1.292936*pow(t - 60., -0.1332047), 0., 1.);
  c.g = t <= 66. ? clamp(0.3900816*log(t) - 0.6318414, 0., 1.) : clamp(1.1298909*pow(t - 60., -0.0755148), 0., 1.);
  c.b = t >= 66. ? 1. : (t <= 19. ? 0. : clamp(0.5432068*log(t - 10.) - 1.1962541, 0., 1.));
  return c;
}
// integral of a 3D gaussian blob (centre c, width s) along the ray
float blob(vec3 o, vec3 d, vec3 c, float s){ vec3 oc = c - o; float t = dot(oc, d); if(t < -2.*s) return 0.; vec3 pc = oc - d*t; return exp(-dot(pc,pc)/(s*s))*s*1.7725; }
// point-like source: widened to at least one pixel while conserving its total flux
float pblob(vec3 o, vec3 d, vec3 c, float s){ float t = max(dot(c - o, d), 1e-3); float se = max(s, uPix*t*0.9); return blob(o, d, c, se)*pow(s/se, 3.); }
// emission of a gaussian tube (jet / beam) along axis ax from the origin, length L, width w0 -> w1
vec3 jet(vec3 o, vec3 d, vec3 ax, float L, float w0, float w1, float knots, float tm, vec3 cA, vec3 cB){
  float e = dot(d, ax), ao = dot(ax, o), dd = dot(d, o);
  float den = max(1. - e*e, 1e-4), sinT = sqrt(den);
  float tc, R;
  if(sinT > 0.3){ tc = (e*ao - dd)/den; R = min(3.*max(w0,w1)/sinT, L); }
  else { tc = (L*0.5 - ao)/e; R = L*0.6/abs(e); }
  float ta = max(tc - R, 0.), tb = max(tc + R, 0.);
  if(tb <= ta) return vec3(0.);
  vec3 acc = vec3(0.); float dt = (tb - ta)/12.;
  for(int i=0;i<12;i++){
    float t = ta + (float(i) + .5)*dt;
    vec3 p = o + d*t; float s = dot(p, ax);
    if(s < 0.004 || s > L) continue;
    vec3 perp = p - ax*s; float u = s/L; float w = mix(w0, w1, u);
    float k = 1. + knots*(pow(0.5 + 0.5*sin(s*38. - tm*5.), 8.)*2.2*exp(-u*1.5) - 0.45);
    float prof = smoothstep(0., 0.05, u)*smoothstep(1., 0.8, u);
    acc += mix(cA, cB, u)*exp(-dot(perp,perp)/(w*w))*k*prof;
  }
  return acc*dt;
}
vec3 starCell(vec3 d, float sc, float dens, float sd){
  vec3 c = floor(d*sc);
  if(hash13(c + sd) > dens) return vec3(0.);
  vec3 sp = normalize(c + vec3(hash13(c + sd + 11.3), hash13(c + sd + 27.1), hash13(c + sd + 41.9)));
  if(dot(d, sp) < 0.) return vec3(0.);
  vec3 cr = cross(d, sp); float pw = uPix*0.8;
  float f = exp(-dot(cr,cr)/(pw*pw));
  float mag = 0.1 + 0.25*hash13(c + sd + 5.1) + 3.2*pow(hash13(c + sd + 63.7), 16.);
  return blackbody(2800. + 9500.*pow(hash13(c + sd + 87.3), 2.2))*mag*f;
}
// the Milky Way as seen from inside it: measured sky map near the Sun, a procedural band elsewhere in the disk
float mwMap(vec3 d){ return texture(uMW, vec2(atan(d.y, d.x)*0.15915494 + 0.5, 0.5 - asin(clamp(d.z, -1., 1.))*0.31830989)).r; }
vec3 starfield(vec3 d){
  float b = d.z;
  float gc = max(dot(d, uGC.xyz), 0.);
  float proc = exp(-b*b*18.)*(0.35 + 1.3*pow(max(dot(normalize(vec3(d.xy, 0.) + 1e-5), normalize(vec3(uGC.xy, 0.) + 1e-5)), 0.), 3.)) + 0.5*exp(-(1. - gc)*14.)*smoothstep(0.6, 1., gc);
  float mapv = mwMap(d);
  float band = mix(proc*0.8, pow(mapv, 1.2)*1.3 + 0.03*exp(-b*b*30.), uGC.w)*uSky.w;
  vec3 col = starCell(d, 38., 0.04 + 0.12*min(band, 1.), 0.) + starCell(d, 21., 0.07, 7.) + starCell(d, 64., 0.008 + 0.07*min(band, 1.), 13.)*0.6;
  float n = fbm(d*9.), n2 = fbm3(d*26. + 5.);
  float lanes = smoothstep(0.45, 0.62, fbm3(d*16. + 3.))*exp(-b*b*60.);
  vec3 mw = mix(vec3(0.5, 0.58, 0.82), vec3(1., 0.82, 0.58), smoothstep(0.2, 1., gc));
  col += mw*band*(0.045 + 0.09*n*n*(0.5 + 0.9*n2))*(1. - 0.7*lanes*(1. - uGC.w*0.6));
  // deep in the bulge the whole sky is crowded with old, yellow stars
  if(uSky.z > 0.01){ col += (starCell(d, 44., 0.12, 21.) + starCell(d, 90., 0.1, 29.)*0.7)*uSky.z*vec3(1., 0.85, 0.65) + vec3(1., 0.78, 0.52)*uSky.z*(0.004 + 0.02*fbm3(d*6. + 2.))*(0.5 + gc); }
  col += vec3(0.28,0.07,0.2)*smoothstep(0.55, 0.8, fbm3(d*3. + 11.))*0.02*uSky.w;
  col += vec3(0.05,0.16,0.22)*smoothstep(0.58, 0.82, fbm3(d*4. - 7.))*0.018*uSky.w;
  return col;
}
void outCol(vec3 c, float a){ fragColor = vec4(max(c, 0.)*uOut*uVis, clamp(a, 0., 1.)*uVis); }
// camera ray in object-local units (object bounding sphere = radius 1)
void localRay(out vec3 o, out vec3 d){ vec3 rd = rayDir(); o = uCamLocal; d = rd*uRot; }
`;

const FS_BG = COMMON + `
vec3 galaxyCell(vec3 d, float sc, float sd){
  vec3 c = floor(d*sc);
  if(hash13(c + sd) > 0.35) return vec3(0.);
  vec3 sp = normalize(c + vec3(hash13(c + sd + 1.3), hash13(c + sd + 2.7), hash13(c + sd + 4.1)));
  vec3 cr = cross(d, sp); float r = length(cr)*sc;
  float e = exp(-r*r*18.*(1. + 2.*hash13(c + sd + 7.)));
  return mix(vec3(1., 0.85, 0.6), vec3(0.65, 0.75, 1.), hash13(c + sd + 9.))*e*0.18;
}
void main(){
  vec3 d = rayDir();
  vec3 col = starfield(d)*uSky.x;
  col += (galaxyCell(d, 60., 3.) + galaxyCell(d, 110., 8.)*0.6)*uSky.y;
  outCol(col, 1.);
}`;

// per-cell glyph selection: tone map, pick density glyph or an edge glyph
const FS_CELL = `#version 300 es
precision highp float;
uniform sampler2D uScene; uniform vec2 uGrid; uniform float uExp; uniform float uIn; uniform float uLv; uniform float uDir0; uniform float uEdge;
out vec4 o;
vec3 tmAt(vec2 c){ vec3 x = texture(uScene, (c + .5)/uGrid).rgb*uIn; return 1. - exp(-x*uExp); }
float lum(vec3 t){ return max(dot(t, vec3(.2126,.7152,.0722)), max(t.r, max(t.g, t.b))*.62); }
void main(){
  vec2 c = floor(gl_FragCoord.xy);
  vec3 t = tmAt(c); float v = lum(t);
  float g = 0.; const float th = 0.03;
  if(v > th) g = 1. + min(floor(pow((v - th)/(1. - th), 1.2)*uLv), uLv - 1.);
  if(uEdge > 0.5 && v > 0.09 && v < 0.9){
    float l00 = lum(tmAt(c + vec2(-1,-1))), l10 = lum(tmAt(c + vec2(0,-1))), l20 = lum(tmAt(c + vec2(1,-1)));
    float l01 = lum(tmAt(c + vec2(-1,0))), l21 = lum(tmAt(c + vec2(1,0)));
    float l02 = lum(tmAt(c + vec2(-1,1))), l12 = lum(tmAt(c + vec2(0,1))), l22 = lum(tmAt(c + vec2(1,1)));
    float gx = (l20 + 2.*l21 + l22) - (l00 + 2.*l01 + l02);
    float gy = (l02 + 2.*l12 + l22) - (l00 + 2.*l10 + l20);
    float G = length(vec2(gx, gy));
    float nb = (l00 + l10 + l20 + l01 + l21 + l02 + l12 + l22)*0.125;
    float bright = step(0.12, l00) + step(0.12, l10) + step(0.12, l20) + step(0.12, l01) + step(0.12, l21) + step(0.12, l02) + step(0.12, l12) + step(0.12, l22);
    float dark = step(l00, v*0.45) + step(l10, v*0.45) + step(l20, v*0.45) + step(l01, v*0.45) + step(l21, v*0.45) + step(l02, v*0.45) + step(l12, v*0.45) + step(l22, v*0.45);
    if(G > 1.5 && v < nb*1.7 + 0.04 && bright >= 4. && dark >= 3.){
      float ang = mod(atan(gy, gx) + 1.5707963, 3.14159265);
      g = uDir0 + mod(floor(ang/0.7853982 + 0.5), 4.);
    }
  }
  float mx = max(t.r, max(t.g, t.b));
  vec3 col = t/max(mx, 1e-4)*(0.34 + 0.66*sqrt(mx));
  col = mix(col, vec3(1.), smoothstep(0.8, 1., v)*0.35);
  o = vec4(col, g/255.);
}`;

// separable blur for the phosphor glow (first pass tone-maps the scene)
const FS_GLOW = `#version 300 es
precision highp float;
uniform sampler2D uSrc; uniform vec2 uStep; uniform vec2 uGrid; uniform float uFirst; uniform float uExp; uniform float uIn;
out vec4 o;
void main(){
  vec2 uv = gl_FragCoord.xy/uGrid; vec3 s = vec3(0.);
  float w[5] = float[](0.227, 0.1945, 0.1216, 0.054, 0.0162);
  for(int i=-4;i<=4;i++){
    vec3 x = texture(uSrc, uv + uStep*float(i)).rgb;
    if(uFirst > 0.5) x = 1. - exp(-x*uIn*uExp);
    s += x*w[i < 0 ? -i : i];
  }
  o = vec4(s, 1.);
}`;

// final composite at full resolution: glyph mask x cell colour over glow
const FS_FINAL = `#version 300 es
precision highp float;
uniform sampler2D uCellT; uniform sampler2D uGlowT; uniform sampler2D uAtlas;
uniform vec2 uCell; uniform vec2 uGrid; uniform float uAtlasN; uniform float uGlowAmt; uniform vec3 uBg;
out vec4 o;
void main(){
  vec2 cf = gl_FragCoord.xy/uCell; vec2 ci = floor(cf); vec2 lc = cf - ci;
  vec4 cd = texelFetch(uCellT, ivec2(ci), 0);
  float gi = floor(cd.a*255. + .5);
  float m = texture(uAtlas, vec2((gi + lc.x)/uAtlasN, 1. - lc.y)).a;
  vec3 glow = texture(uGlowT, cf/uGrid).rgb*uGlowAmt;
  o = vec4(uBg + glow*(1. - 0.6*m) + cd.rgb*m, 1.);
}`;

// ---------------------------------------------------------------- particles
function particleVS(body){ return `#version 300 es
layout(location=0) in vec4 aP;
layout(location=1) in vec4 aC;
uniform mat3 uCamRot; uniform vec2 uTan; uniform vec3 uRel; uniform mat3 uRot; uniform float uRad; uniform float uVis;
uniform float uPixAng; uniform float uMode; uniform float uN; uniform float uSB; uniform float uSize; uniform float uOut; uniform float uT;
uniform vec4 uQ0; uniform vec4 uQ1; uniform mat3 uM; uniform float uCap;
out vec3 vC;
${body}
void main(){
  vec3 p; float br; vec3 col; body(p, br, col);
  vec3 v = (uRel + uRot*(p*uRad))*uCamRot;
  gl_Position = vec4(v.x/uTan.x, v.y/uTan.y, 0., v.z);
  if(v.z <= 0.){ gl_PointSize = 1.; vC = vec3(0.); return; }
  br = max(br, 0.);
  float size, b;
  if(uMode < 0.5){ float S = uRad/(v.z*uPixAng); size = clamp(uSize*S/sqrt(uN), 1.6, 3.5); b = min(4.*uSB*3.1416*S*S/(uN*size*size), uCap); }
  else if(uMode < 1.5){ size = uSize; b = min(uSB/(v.z*v.z), 3.); }
  else if(uMode < 2.5){ size = clamp(uSize*uRad/(v.z*uPixAng), 1.5, 9.); b = min(uSB/(v.z*v.z), 2.5); }
  else { size = uSize; b = uSB; }
  gl_PointSize = size; vC = col*br*b*uOut*uVis;
}`; }
const FS_POINT = `#version 300 es
precision mediump float;
in vec3 vC; out vec4 o;
void main(){ vec2 q = gl_PointCoord*2. - 1.; float r2 = dot(q,q); if(r2 > 1.) discard; o = vec4(vC*exp(-r2*4.), 0.); }`;

// soothing flight drift: soft motes wrapped in a camera-centred cube whose size follows the view scale
const VS_DRIFT = `#version 300 es
layout(location=0) in vec4 aP; layout(location=1) in vec4 aC;
uniform mat3 uCamRot; uniform vec2 uTan; uniform vec3 uDrift; uniform vec3 uVel; uniform float uZoom; uniform float uScale; uniform float uAmt; uniform float uOut; uniform float uPt;
out vec3 vC;
void main(){
  vec3 q = fract(aP.xyz - uDrift) - 0.5;
  bool tail = aC.w > 0.5;
  vec3 qt = tail ? q - uVel - q*uZoom : q;
  vec3 v = qt*uScale*uCamRot, vn = q*uScale*uCamRot;
  float r = length(q);
  gl_Position = vec4(v.x/uTan.x, v.y/uTan.y, 0., v.z);
  if(vn.z < 0.01*uScale || v.z < 0.01*uScale){ gl_PointSize = 1.; vC = vec3(0.); return; }
  gl_PointSize = uPt;
  float fade = smoothstep(0.5, 0.3, r)*smoothstep(0.04, 0.14, r);
  vC = aC.rgb*aP.w*uAmt*uOut*fade*(tail ? 0. : 1.);
}`;
const FS_LINE = `#version 300 es
precision mediump float;
in vec3 vC; out vec4 o;
void main(){ o = vec4(vC, 0.); }`;
const PB_BASIC = `void body(out vec3 p, out float br, out vec3 col){ p = aP.xyz; br = aP.w; col = aC.rgb; }`;
// density-wave spiral: stars on nested ellipses whose orientation twists with radius
const PB_SPIRAL = `void body(out vec3 p, out float br, out vec3 col){
  col = aC.rgb; br = 1.;
  if(aP.y < 0.){ float an = uT*0.05/(length(aP.xz) + 0.05); float c = cos(an), s = sin(an); p = vec3(aP.x*c - aP.z*s, aP.w, aP.x*s + aP.z*c); return; }
  float a = aP.x; float t = aP.z + uT*0.2/(a + 0.07);
  float th = a*uQ0.x + uQ0.y;
  vec2 q = vec2(a*cos(t), a*(1. - aP.y)*sin(t)); float c = cos(th), s = sin(th);
  p = vec3(q.x*c - q.y*s, aP.w, q.x*s + q.y*c);
  float arm = pow(0.5 - 0.5*sin(2.*t), 4.);
  if(aC.w > 0.5) br = 0.1 + 2.8*arm; else br = 0.75 + 0.5*arm;
}`;
// supernova debris: homologous expansion along fixed directions
const PB_SN = `void body(out vec3 p, out float br, out vec3 col){
  p = aP.xyz*uQ0.x*aP.w; br = uQ0.y*smoothstep(0., 1.2, uQ0.w)*step(0., uQ0.w);
  col = mix(vec3(1., .95, .9), aC.rgb, uQ0.z);
}`;
// pulsar: charged particles streaming along rotating dipole field lines r = L sin^2(theta)
const PB_FIELD = `void body(out vec3 p, out float br, out vec3 col){
  float u = fract(aP.y + uT*0.07*(0.6 + aC.w));
  float th0 = asin(sqrt(min(0.012/aP.x, 1.)));
  float th = mix(th0, 3.14159265 - th0, u);
  float r = aP.x*sin(th)*sin(th);
  vec3 pm = vec3(r*sin(th)*cos(aP.z), r*cos(th), r*sin(th)*sin(aP.z));
  p = uM*pm; br = 0.35 + 0.65*sin(u*3.14159265); col = aC.rgb;
}`;

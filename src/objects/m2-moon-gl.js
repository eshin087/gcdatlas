// ================================================================ the ground near a place on the Moon (0.27.0): FS_MOON_ENV, drawn by m3-moon-detail.js. A cousin of the
// Earth's FS_SX_ENV (s2-spacex-gl.js) cut down to what the Moon has: no air, haze, water, clouds, weather or towns. The heights of the place's
// layers (two bytes each, so the plains have no terraces in low light) and, beyond them, of the whole Moon's map are marched from the camera;
// the ground is lit by the real Sun, hard, with the shadows the heights cast (the Sun's half-degree disc gives their edges); a little earthshine
// on the night side; and the sky is left empty (alpha 0), so the stars, the Sun and Earth the page draws behind it show where they really are.
// The frame is the place's: x east, y up, z south, metres, the origin on the 1,737.4 km sphere under the place's middle.
// From high up (a flight coming down) it shades like the globe (FS_PLANETG's Solar System look, relief steeper than real), so the two blend
// with no seam; near the ground the light is physical: Lommel-Seeliger with some Lambert, and a phase law that brightens toward the opposition.
// One loop reads the heights (the march, the halving of its last step, the normal's two samples, the walk toward the Sun): Direct3D's compiler
// copies a function at every call, and the heights are the heavy part.
const FS_MOON_ENV = COMMON + `
const float RM = 1737400.;
uniform vec4 uMdC[4]; uniform vec4 uMdE[4]; uniform vec4 uMdN[4]; uniform vec4 uMdX[4]; uniform vec4 uMdS;
uniform sampler2D uMc0; uniform sampler2D uMc1; uniform sampler2D uMc2; uniform sampler2D uMc3;
uniform sampler2D uMh0; uniform sampler2D uMh1; uniform sampler2D uMh2; uniform sampler2D uMh3;
uniform sampler2D uMgC; uniform sampler2D uMgH; uniform vec4 uMg; uniform mat3 uMgM;
uniform vec4 uLm0; uniform vec4 uLm1;
int ZI = 0;
vec3 unTone(vec3 c){ return -log(1. - clamp(c, 0., 0.985)); }
// the reference sphere under (x, z): its y in this frame (no cancellation: -r^2/(R + sqrt(R^2 - r^2)))
float sphY(vec2 xz){ float r2 = min(dot(xz, xz), RM*RM*0.998); return -r2/(RM + sqrt(RM*RM - r2)); }
vec3 sphPt(vec2 xz){ return vec3(xz.x, sphY(xz), xz.y); }
// where a point S on the sphere falls on layer i: (u, v, how far in from its edge, 0 at the edge, 1 at the middle)
vec3 mdUV(int i, vec3 S){ vec3 q = S - uMdC[i].xyz; float hs = uMdC[i].w; vec2 xy = vec2(dot(q, uMdE[i].xyz), dot(q, uMdN[i].xyz));
  return vec3(0.5 + xy.x/(2.*hs), 0.5 - xy.y/(2.*hs), 1. - max(abs(xy.x), abs(xy.y))/hs); }
// (two bytes, filtered as they are: a linear blend of R*256 + G is the blend of the heights)
float mdH(int i, vec2 uv){ vec2 t = (i == 0 ? textureLod(uMh0, uv, 0.) : i == 1 ? textureLod(uMh1, uv, 0.) : i == 2 ? textureLod(uMh2, uv, 0.) : textureLod(uMh3, uv, 0.)).rg;
  return uMdX[i].y + (t.x*65280. + t.y*255.)*uMdX[i].z; }
vec4 mdC(int i, vec2 uv, vec2 gx, vec2 gy){ return i == 0 ? textureGrad(uMc0, uv, gx, gy) : i == 1 ? textureGrad(uMc1, uv, gx, gy) : i == 2 ? textureGrad(uMc2, uv, gx, gy) : textureGrad(uMc3, uv, gx, gy); }
// the whole Moon's map at a point of the sphere
vec2 mgUV(vec3 S){ vec3 u = uMgM*normalize(S + vec3(0., RM, 0.)); return vec2(atan(-u.z, u.x)*0.15915494 + 0.5, 0.5 - asin(clamp(u.y, -1., 1.))*0.31830989); }
float mgH(vec2 uv){ vec2 t = textureLod(uMgH, uv, 0.).rg; return uMg.y + (t.x*65280. + t.y*255.)*uMg.z; }
// the height of the ground above the sphere at (x, z): the finest layer there, eased into the next over its outer 6%; past them the whole Moon
float groundH(vec2 xz){
  vec3 S = sphPt(xz); float h = 0., w = 0.;
  for(int i=ZI;i<4;i++){
    if(float(i) >= uMdS.x || w > 0.999) break;
    vec3 u = mdUV(i, S); if(u.z <= 0.) continue;
    float k = smoothstep(0., 0.06, u.z)*(1. - w); h += mdH(i, u.xy)*k; w += k;
  }
  // (no map: the bare sphere, offline and in the artifact page)
  if(w < 0.999 && uMg.x > 0.5) h += mgH(mgUV(S))*(1. - w);
  return h;
}
// the ground's colour (display terms, as the files hold it) over a pixel's footprint (g1 along the view, g2 across), the same way round
vec3 groundC(vec3 S, vec3 g1, vec3 g2, float fp){
  vec3 c = vec3(0.); float w = 0.;
  for(int i=ZI;i<4;i++){
    if(float(i) >= uMdS.x || w > 0.995) break;
    vec3 u = mdUV(i, S); if(u.z <= 0.) continue;
    float k = smoothstep(0., 0.06, u.z)*(1. - w), s = 1./(2.*uMdC[i].w);
    c += mdC(i, u.xy, vec2(dot(g1, uMdE[i].xyz), -dot(g1, uMdN[i].xyz))*s, vec2(dot(g2, uMdE[i].xyz), -dot(g2, uMdN[i].xyz))*s).rgb*k; w += k;
  }
  if(w < 0.995) c += (uMg.x > 0.5 ? textureLod(uMgC, mgUV(S), max(log2(fp/(RM*6.2832/float(textureSize(uMgC, 0).x))), 0.)).rgb : vec3(0.42, 0.41, 0.39))*(1. - w);
  return c;
}
// ---- the descent stage of a lunar module, left where it landed (a model at its real size: the body an octagon 4.2 m across, 1.65 m tall,
// its four legs out to footpads 9.4 m apart, the engine bell under it; gold foil and black panels). Frame: y up, its middle at the ground
float lmSeg(vec3 p, vec3 a, vec3 b, float r){ vec3 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba)/dot(ba, ba), 0., 1.); return length(pa - ba*h) - r; }
float lmMap(vec3 p, float px){
  vec2 q = abs(p.xz);
  float oc = max(max(q.x, q.y), (q.x + q.y)*0.7071) - 2.1, body = max(oc, abs(p.y - 2.42) - 0.83);
  // (legs and struts drawn at least a third of a pixel thick, so they read as lines from afar)
  float rl = max(0.11, px*0.35), rp = max(0.47, px*0.5);
  vec3 a = vec3(q.x > q.y ? q.x : q.y, p.y, q.x > q.y ? q.y : q.x);   // (the nearer leg's frame: its axis along +x)
  float leg = min(lmSeg(a, vec3(2.0, 2.7, 0.), vec3(4.35, 0.25, 0.), rl), lmSeg(a, vec3(2.0, 1.6, 0.9), vec3(4.0, 0.6, 0.), rl*0.8));
  float pad = max(length(a.xz - vec2(4.4, 0.)) - rp, abs(p.y - 0.12) - 0.12);
  float bell = max(length(p.xz) - mix(0.75, 0.47, clamp((1.6 - p.y)/0.8, 0., 1.)), abs(p.y - 1.2) - 0.4);
  return min(min(body, bell), min(leg, pad));
}
// where the ray meets the lander (-1: not before tMax), and its normal
float lmHit(vec3 o, vec3 d, float tMax, out vec3 nl, out vec3 ql){
  nl = vec3(0., 1., 0.); ql = vec3(0.);
  if(uLm1.x < 0.5) return -1.;
  float c = cos(uLm0.w), s = sin(uLm0.w);
  vec3 B = vec3(uLm0.x, sphY(uLm0.xy) + uLm0.z, uLm0.y), r = o - B; vec3 ol = vec3(c*r.x + s*r.z, r.y, -s*r.x + c*r.z), dl = vec3(c*d.x + s*d.z, d.y, -s*d.x + c*d.z);
  // (its bounding box first: nearly every ray misses it)
  vec3 iv = 1./(dl + vec3(dl.x < 0. ? -1e-7 : 1e-7, dl.y < 0. ? -1e-7 : 1e-7, dl.z < 0. ? -1e-7 : 1e-7));
  vec3 t0 = (vec3(-5., -0.5, -5.) - ol)*iv, t1 = (vec3(5., 3.4, 5.) - ol)*iv, tn = min(t0, t1), tf = max(t0, t1);
  float ta = max(max(tn.x, tn.y), max(tn.z, 0.)), tb = min(min(tf.x, tf.y), min(tf.z, tMax));
  if(ta >= tb) return -1.;
  float t = ta; int hi = -1; vec3 ph = vec3(0.), n = vec3(0.); float ep = 0.;
  for(int i=ZI;i<72;i++){
    int mm = hi < 0 ? -1 : i - hi - 1;
    vec3 kv = mm == 0 ? vec3(1., -1., -1.) : mm == 1 ? vec3(-1., -1., 1.) : mm == 2 ? vec3(-1., 1., -1.) : vec3(1.), p = mm < 0 ? ol + dl*t : ph + kv*ep;
    float h = lmMap(p, t*uPix);
    if(mm >= 0){ n += kv*h; if(mm == 3) break; continue; }
    if(h < t*uPix*0.4){ hi = i; ph = p; ep = max(0.02, t*uPix*0.3); continue; }
    t += max(h, t*uPix*0.2); if(t > tb) break;
  }
  if(hi < 0) return -1.;
  nl = normalize(n + vec3(0., 1e-6, 0.)); ql = ph;
  // (back to this frame)
  nl = vec3(c*nl.x - s*nl.z, nl.y, s*nl.x + c*nl.z);
  return t;
}
// whether the lander stands between a point and the Sun (its body and legs as boxes and a cylinder: its long shadow at a low Sun)
float lmShadow(vec3 p, vec3 L){
  if(uLm1.x < 0.5) return 1.;
  float c = cos(uLm0.w), s = sin(uLm0.w);
  vec3 B = vec3(uLm0.x, sphY(uLm0.xy) + uLm0.z, uLm0.y), r = p - B, ol = vec3(c*r.x + s*r.z, r.y, -s*r.x + c*r.z), dl = vec3(c*L.x + s*L.z, L.y, -s*L.x + c*L.z);
  if(dot(ol.xz, ol.xz) > 90000.) return 1.;
  float sh = 1.;
  for(int i=ZI;i<24;i++){ float t = 0.3 + float(i)*0.32*(1. + float(i)*0.25); vec3 q = ol + dl*t; if(q.y > 3.4 || t > 300.) break; float h = lmMap(q, 0.); if(h < 0.05){ sh = 0.; break; } }
  return sh;
}
void main(){
  ZI = int(uP4.w);
  vec3 d = rayDir()*uRot, o = uP0.xyz, L = normalize(uP1.xyz), E = uP2.xyz;
  float fade = uP0.w;
  float CALT = (dot(o.xz, o.xz) + o.y*o.y + 2.*RM*o.y)/(length(o + vec3(0., RM, 0.)) + RM);   // (the camera's height above the sphere)
  float near = smoothstep(90000., 25000., CALT);   // (above about 90 km the globe's look, below about 25 km the light as it is)
  // where the ray comes down into the shell of the highest ground, and where it leaves it again (or the march's limit)
  float H = uMdS.y + 50., Hl = uMdS.z - 50.;
  vec3 oc = o + vec3(0., RM, 0.); float b = dot(oc, d), cO = dot(o, o) + 2.*RM*o.y - 2.*RM*H - H*H, disc = b*b - cO;
  float t0 = -1., t1 = -1.;
  if(disc > 0.){ float sq = sqrt(disc); t0 = cO > 0. ? (b < 0. ? cO/(sq - b) : -1.) : 0.; t1 = cO > 0. ? (b < 0. ? (sq - b) : -1.) : -b + sq; }
  float cI = dot(o, o) + 2.*RM*o.y - 2.*RM*Hl - Hl*Hl, dI = b*b - cI;   // (the shell of the lowest ground: a ray that reaches it surely meets the ground before)
  if(dI > 0. && cI > 0. && b < 0.) t1 = min(t1 > 0. ? t1 : 1e12, cI/(sqrt(dI) - b) + 10.);
  t1 = min(t1, uP4.z);
  // ---- one loop for everything that reads the heights: 0 the march, 1 halving its last step, 2 the normal's two samples, 3 the walk
  // toward the Sun for the shadow
  int ph = t0 >= 0. && t1 > t0 ? 0 : 9, nb = 0, k = 0;
  float t = max(t0, 0.), tp = t, lo = 0., hi = 0., hit = -1., fp = 1., sStep = 1., h0 = 0., hx = 0., sh = 1., ts = 0.;
  vec2 P = vec2(0.); vec3 Q0 = vec3(0.), n = vec3(0., 1., 0.);
  for(int i=ZI;i<236;i++){
    if(ph > 3) break;
    vec2 xz; float ref;
    if(ph == 0){ vec3 p = o + d*t; xz = p.xz; ref = p.y; }
    else if(ph == 1){ vec3 p = o + d*(0.5*(lo + hi)); xz = p.xz; ref = p.y; }
    else if(ph == 2){ xz = P + (k == 1 ? vec2(sStep, 0.) : k == 2 ? vec2(0., sStep) : vec2(0.)); ref = 0.; }
    else { vec3 q = Q0 + L*ts; xz = q.xz; ref = q.y; }
    float gy = sphY(xz) + groundH(xz), dh = ref - gy;
    if(ph == 0){
      if(dh < 0.){ ph = 1; lo = tp; hi = t; nb = 0; continue; }
      // (a ray grazing a plain closes on it slowly, a step a fraction of its height above the ground: past 170 steps, one within two
      // pixels of the ground takes the ground where it is, so the far plain under the horizon is not left as sky, and the walk toward
      // the Sun keeps the steps it needs; a ray passing over the horizon higher than that goes on to the sky)
      if(i >= 170 && dh < t*uPix*2.){ hit = t; P = (o + d*hit).xz; fp = max(hit*uPix, 0.02); sStep = max(fp*1.2, 0.6); ph = 2; k = 0; continue; }
      tp = t; t += clamp(dh*0.6, 0.15 + t*0.002, 1500. + t*0.06);
      if(t > t1) ph = 9;
    } else if(ph == 1){
      if(dh < 0.) hi = 0.5*(lo + hi); else lo = 0.5*(lo + hi);
      if(++nb >= 8){ hit = hi; vec3 p = o + d*hit; P = p.xz; fp = max(hit*uPix, 0.02); sStep = max(fp*1.2, 0.6); ph = 2; k = 0; }
    } else if(ph == 2){
      if(k == 0){ h0 = gy; k = 1; }
      else if(k == 1){ hx = gy; k = 2; }
      else { n = normalize(vec3(h0 - hx, sStep, h0 - gy)); ph = dot(n, L) > -0.02 ? 3 : 9; Q0 = vec3(P.x, h0, P.y) + n*max(0.05, fp*0.6); ts = max(0.4, fp); }
    } else {
      // (the share of the Sun's disc, 0.53 degrees across, above the ground along the walk)
      sh = min(sh, smoothstep(-ts*0.0047, ts*0.0047, dh));
      ts *= 1.28; if(sh < 0.02 || ts > 90000. || dh > 12000.) ph = 9;
    }
  }
  // the lander, if the ray meets it first
  vec3 nL, qL; float tL = lmHit(o, d, hit > 0. ? hit : 1e9, nL, qL);
  if(tL > 0.){
    float mu0 = max(dot(nL, L), 0.), here = (0.35 + 0.65*mu0)*lmShadow(o + d*tL + nL*0.05, L)*smoothstep(-0.05, 0.05, L.y);
    // (gold foil on the body's sides and the legs' upper parts, dark on top and the bell, a little shine toward the Sun)
    vec3 base = qL.y > 1.55 && qL.y < 3.2 && abs(nL.y) < 0.6 ? vec3(0.95, 0.72, 0.32) : qL.y < 1.6 && length(qL.xz) < 0.8 ? vec3(0.32, 0.31, 0.3) : vec3(0.78, 0.76, 0.72);
    vec3 col = base*here*1.1 + vec3(1., 0.95, 0.85)*pow(max(dot(reflect(d, nL), L), 0.), 24.)*0.6*here + base*uP2.w*0.6;
    outCol(unTone(col*uP3.w)*fade, fade); return;
  }
  // (a grazing ray still on its way down when the steps ran out meets the plain beyond, not far past where it stopped: the sphere at the
  // height of the ground under the camera (uP1.w, one plane for every pixel, so no stripes), lit, its normal straight up; one passing
  // over that plain's horizon, or meeting it far off, is sky. Worked out without subtracting big numbers)
  if(hit < 0. && ph == 0){
    float gC = uP1.w, b2 = dot(o, d) + RM*d.y, c2 = dot(o, o) + 2.*RM*o.y - 2.*RM*gC - gC*gC, q = b2*b2 - c2, tq = c2/(sqrt(max(q, 0.)) - b2);
    if(q > 0. && b2 < 0. && c2 > 0. && tq < t*4.){ hit = tq; vec3 p = o + d*hit; P = p.xz; h0 = p.y; n = normalize(p + vec3(0., RM, 0.)); sh = 1.; fp = max(hit*uPix, 0.02); }
  }
  if(hit < 0.){ outCol(vec3(0.), 0.); return; }
  vec3 S = sphPt(P), up = normalize(S + vec3(0., RM, 0.));
  // (a pixel's footprint on the ground, along the view and across it, for the colour's filtering)
  vec3 hd = normalize(vec3(d.x, 0., d.z) + vec3(1e-5, 0., 0.)), g1 = hd*fp/max(abs(dot(d, up)), 0.0625), g2 = vec3(-hd.z, 0., hd.x)*fp;
  vec3 alb = groundC(S, g1, g2, fp);
  float shL = sh*lmShadow(vec3(P.x, h0, P.y) + n*0.05, L);
  // near the ground: the light as it is, by McEwen's lunar-Lambert law (the share that scatters like Lommel-Seeliger, flat as the full Moon,
  // falls as the angle between the Sun and the view grows, so across the light the relief shows), the Sun's disc sinking below the horizon
  // taken into account by the walk; uP3.z the exposure (m3-moon-detail.js works out the same law for level ground in the middle of the view)
  float mu0 = max(dot(n, L), 0.)*shL, mu = max(dot(n, -d), 0.03), g = acos(clamp(dot(L, -d), -1., 1.)), gd = degrees(g);
  float LL = clamp(1. + gd*(-0.019 + gd*(0.000242 - gd*0.00000146)), 0., 1.);
  // (the phase law gentler than the Moon's own, so a view with the Sun behind the camera does not wash out and one across the light is not
  // dim: in characters both read)
  float lgt = (2.*LL*mu0/(mu0 + mu) + (1. - LL)*mu0)*clamp(exp(-0.45*(g - 1.047)), 0.6, 1.25);
  vec3 cNear = alb*pow(lgt, 0.8)*uP3.z;
  // from high up: the globe's look (FS_PLANETG): the light level across the day side, the relief shown like a relief map, steeper than real
  vec3 nl = normalize(up + (n - up)*uP3.x);
  float c0 = max(dot(up, L), 0.), lam = (1. - exp(-c0*5.))/(1. - exp(-5.))*(0.84 + 0.16*max(dot(up, -d), 0.));
  lam *= clamp(1. + 1.8*(dot(nl, L) - dot(up, L)), 0.15, 1.8)*mix(1., shL, 0.7);
  vec3 cFar = alb*lam;
  vec3 col = mix(cFar, cNear, near);
  // earthshine on the night side: Earth's light, bluish and faint (shown brighter than it is: the eyes adjust; ACCURACY.md)
  col += alb*vec3(0.75, 0.85, 1.)*uP2.w*max(dot(n, E), 0.)*(1. - smoothstep(-0.02, 0.06, dot(up, L)));
  outCol(unTone(col)*fade, fade);
}`;
P.moonEnv = program(VS_RECT, FS_MOON_ENV);

// ================================================================ SpaceX launches (1): the shaders. The rest (sites, flights, the camera) is in s3-spacex.js.
// A "cluster" is one ray-marched volume holding everything close together: a pad with its tower and any stage near it, or a stage
// (or stack) in flight, or the droneship with the booster landing on it. One march per cluster, so the tower's chopsticks hide the
// booster they catch. Distances are in metres in the cluster's frame (x east, y up, z south at its anchor, see sxFrame in s3).
// Two programs, one per family, so each stays small enough to compile quickly: Starship (P.sxStar: Super Heavy, the ship, the tower
// with its chopsticks, the launch mount) and Falcon (P.sxFal: Falcon 9, Falcon Heavy, the second stage with a fairing or Dragon,
// Dragon on its own, the pads, the droneship, the landing zone). Loops start from ZI (a 0 the compiler cannot see) so ANGLE on
// Direct3D does not unroll them, and map() has two call sites (the march and one normal loop).
// Uniforms (arrays of 4 parts):
//   uPt[i] = position of the part's base (engine exit plane), type (0 none; 1 Super Heavy, 2 ship; 3 Falcon core, 4 Falcon Heavy side
//            core, 6 second stage, 7 Dragon)
//   uPa[i] = axis (unit, nose-ward), throttle 0..1
//   uPb[i] = side axis (unit, x of the part), a (Falcon: landing legs 0..1; ship: flaps; second stage: payload 0 fairing, 1 Dragon, 2 none)
//   uPc[i] = plume length (m), plume radius at the nozzles (m), spread (radius gained per metre), b (grid fins out 0..1; ship: heat glow)
//   uSo = site origin (m), site yaw (rad);  uSt = site kind (0 none, 1 Starbase, 2 Falcon pad, 3 Falcon pad with a crew tower, 4 droneship,
//         5 landing zone), chopstick height (m), chopsticks open 0..1, strongback / crew arm swing (rad)
//   uLt = sun direction, daylight 0..1;  uPl = the brightest plume's light: position, strength
//   uCl = ground cloud centre, age (s, < 0 none);  uCl2 = strength, steam (1 white, 0 brown), size, venting 0..1
//   uDim = bounding radius (m), time (s), ZI (0), seed
const SX_GLSL = `
uniform vec4 uPt[4]; uniform vec4 uPa[4]; uniform vec4 uPb[4]; uniform vec4 uPc[4];
uniform vec4 uSo; uniform vec4 uSt; uniform vec4 uLt; uniform vec4 uPl; uniform vec4 uCl; uniform vec4 uCl2; uniform vec4 uDim;
uniform vec4 uVc;   // the vapour cone: strength, part index, the collar's height up the part (m), length (m)
uniform mat3 uCm; uniform vec4 uCo;   // this frame to the frame the clouds are in (the site's): p_site = uCm p + uCo.xyz; uCo.w: that site's height above the sea
#define ZI int(uDim.z)
float sdBox(vec3 p, vec3 b){ vec3 q = abs(p) - b; return length(max(q, 0.)) + min(max(q.x, max(q.y, q.z)), 0.); }
float sdCylY(vec3 p, float r, float y0, float y1){ vec2 d = vec2(length(p.xz) - r, abs(p.y - (y0 + y1)*0.5) - (y1 - y0)*0.5); return min(max(d.x, d.y), 0.) + length(max(d, 0.)); }
float sdCap(vec3 p, vec3 a, vec3 b, float r){ vec3 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba)/dot(ba, ba), 0., 1.); return length(pa - ba*h) - r; }
// a point in part i's own frame (y along its axis, origin at its engines)
vec3 toPart(vec3 p, int i){ vec3 y = uPa[i].xyz, x = uPb[i].xyz, z = cross(x, y), q = p - uPt[i].xyz; return vec3(dot(q, x), dot(q, y), dot(q, z)); }
// fold the plane round the axis onto the nearest of n directions, starting at angle a0 (for fins, legs, columns)
vec2 polarFold(vec2 xz, float n, float a0){ float a = atan(xz.y, xz.x) - a0, s = 6.2831853/n, k = floor(a/s + 0.5)*s + a0; float c = cos(k), sn = sin(k); return vec2(c*xz.x + sn*xz.y, -sn*xz.x + c*xz.y); }
// a square lattice tower of half-width w and height h (corner columns, a floor of beams every 'cell' metres, one diagonal per face and cell)
float lattice(vec3 q, float w, float h, float cell, float b){
  float bound = sdBox(q - vec3(0., h*0.5, 0.), vec3(w + b, h*0.5, w + b));
  if(bound > 1.5) return bound;
  float cols = length(vec2(abs(q.x) - w, abs(q.z) - w)) - b*1.4;
  float yb = q.y - cell*floor(q.y/cell + 0.5);
  float per = max(abs(q.x), abs(q.z));
  float beams = max(min(length(vec2(abs(q.x) - w, yb)), length(vec2(abs(q.z) - w, yb))) - b, per - w - b);
  float y0 = mod(q.y, cell), k = 2.*w/cell, n = inversesqrt(1. + k*k);
  float dg = min(length(vec2(abs(q.x) - w, (q.z + w - y0*k)*n)), length(vec2(abs(q.z) - w, (q.x + w - y0*k)*n))) - b*0.8;
  dg = max(dg, per - w - b);
  return max(min(min(cols, beams), dg), bound);
}
// plume emission of every burning part along the ray, up to tMax (the surface hit), in the cluster's metres
vec3 plumes(vec3 ro, vec3 rd, float tMax){
  vec3 acc = vec3(0.);
  for(int i=ZI;i<4;i++){
    float thr = uPa[i].w; if(uPt[i].w < 0.5 || thr < 0.01) continue;
    vec3 ax = -uPa[i].xyz, e = uPt[i].xyz;
    float L = uPc[i].x, r0 = uPc[i].y, sp = uPc[i].z, R = r0 + L*sp;
    vec3 w = ro - e; float ea = dot(rd, ax), wa = dot(w, ax);
    vec3 dd = rd - ax*ea, ww = w - ax*wa;
    float A = dot(dd, dd), B = 2.*dot(dd, ww), C = dot(ww, ww) - R*R, D = B*B - 4.*A*C;
    if(D < 0. || A < 1e-8) { if(A >= 1e-8) continue; }
    float sq = sqrt(max(D, 0.)), t0 = A < 1e-8 ? 0. : (-B - sq)/(2.*A), t1 = A < 1e-8 ? 1e9 : (-B + sq)/(2.*A);
    // the stretch along the axis 0..L
    if(abs(ea) > 1e-5){ float ta = -wa/ea, tb = (L - wa)/ea; t0 = max(t0, min(ta, tb)); t1 = min(t1, max(ta, tb)); }
    else if(wa < 0. || wa > L) continue;
    t0 = max(t0, 0.); t1 = min(t1, tMax); if(t1 <= t0) continue;
    float ty = uPt[i].w, ker = (ty > 2.5 && ty < 6.5) ? 1. : 0.;   // kerosene (Falcon) or methane (Starship)
    float vac = clamp(sp*3., 0., 1.);   // how far the plume has blown open with altitude
    vec3 acc1 = vec3(0.); float dt = (t1 - t0)/14.;
    for(int k=ZI;k<14;k++){
      vec3 p = w + rd*(t0 + dt*(float(k) + 0.5)); float s = dot(p, ax); vec3 pr = p - ax*s; float rho = length(pr);
      if(uSt.x > 0.5 && (p + e).y < uSo.y + 0.5) continue;   // (the plume ends on the pad: the ground cloud takes it from there)
      float rr = r0 + s*sp, u = s/L;
      float core = exp(-rho*rho/(rr*rr)*2.2)*pow(r0/rr, 1.7);   // (as it widens the same light spreads out: dimmer, not bigger and brighter)
      float dia = 1. + (1. - vac)*0.9*pow(0.5 + 0.5*cos(s/(r0*0.9)*3.1416), 6.)*exp(-u*4.);   // shock diamonds near the ground
      float flick = 0.85 + 0.3*noise(vec3(s*0.08 - uDim.y*9., rho*0.1, float(i)*7.));
      float fall = exp(-u*(2.6 - vac*1.4))*smoothstep(0., 0.04, u + 0.02);
      vec3 hot = ker > 0.5 ? vec3(1., 0.86, 0.55) : vec3(1., 0.8, 0.62), mid = ker > 0.5 ? vec3(1., 0.5, 0.16) : vec3(1., 0.45, 0.22);
      vec3 c = mix(hot*1.6, mid, smoothstep(0.02, 0.35, u));
      c = mix(c, vec3(0.55, 0.62, 1.)*0.8, vac*smoothstep(0.1, 0.6, u));   // thin, bluish in near vacuum
      acc1 += c*core*dia*flick*fall;
    }
    acc += acc1*dt*thr*(2.2/max(r0, 0.5))*mix(1., 0.35, vac);
  }
  return acc;
}
// the ground cloud (exhaust and steam from the sound-suppression water) and venting before launch: front-to-back, returns colour and
// transmittance (xyz, w). Since 0.9.9 (owner: more smoke, as in a real launch) it billows out to about 500 m round Starbase's pad within
// 45 s and rises to about 170 m, its lobes rolling outward, with a ring of dust and spray thrown out at ignition by the blast (the first
// 4 s). Lit by the Sun (brighter on its sunward side), the sky from above, and the plume from inside while the engines are near
vec4 cloud(vec3 ro, vec3 rd, float tMax){
  vec3 col = vec3(0.); float T = 1.;
  float age = uCl.w;
  if(age >= 0. && uCl2.x > 0.01){
    float S = uCl2.z, ag = min(max(age, 0.), 60.), Rr = S*(30. + 40.*pow(ag, 0.62)), H = S*(14. + 13.*pow(ag, 0.62));
    // (the shock ring: out at 150 m/s at first, slowing, 4 s)
    float ra = age, rr = S*(12. + 150.*pow(ra, 0.72)), rth = S*(7. + ra*5.), rk = ra < 4. ? (1. - ra/4.)*(1. - ra/4.) : 0.;
    float Rb = max(Rr, rk > 0. ? rr + 2.2*rth : 0.);
    vec3 c0 = uCl.xyz;
    // bounding cylinder round the pad
    vec3 w = ro - c0; float A = dot(rd.xz, rd.xz), B = 2.*dot(w.xz, rd.xz), C = dot(w.xz, w.xz) - Rb*Rb, D = B*B - 4.*A*C;
    if(D > 0. && A > 1e-8){
      float sq = sqrt(D), t0 = max((-B - sq)/(2.*A), 0.), t1 = min((-B + sq)/(2.*A), tMax);
      if(abs(rd.y) > 1e-5){ float ta = (-w.y - 2.)/rd.y, tb = (H*1.6 - w.y)/rd.y; t0 = max(t0, min(ta, tb)); t1 = min(t1, max(ta, tb)); }
      if(t1 > t0){
        float dt = (t1 - t0)/26.;
        vec3 steam = mix(vec3(0.62, 0.5, 0.4), vec3(0.92, 0.93, 0.95), uCl2.y);
        vec3 Ls = normalize(vec3(uLt.x, max(uLt.y, 0.05), uLt.z));
        for(int k=ZI;k<26;k++){
          vec3 p = w + rd*(t0 + dt*(float(k) + 0.5)); float rl = length(p.xz), r = rl/Rr, y = p.y/H;
          float shape = smoothstep(1., 0.4, r)*smoothstep(1.5, 0.15, y + 0.35*r)*smoothstep(-0.2, 0.12, y);
          float ring = rk > 0. ? rk*exp(-pow((rl - rr)/rth, 2.))*smoothstep(S*(10. + ra*6.), 0., p.y)*smoothstep(-2., 1., p.y) : 0.;
          if(shape + ring < 0.01) continue;
          // (the billows roll outward from the pad as they grow: the noise is carried out along the ground and up)
          vec2 out2 = rl > 1. ? p.xz/rl : vec2(0.);
          vec3 q = p/(S*13.) - vec3(out2.x, 0., out2.y)*age*0.045 + vec3(0., -age*0.04, 0.);
          float n = fbm3(q + 0.55*noise(q*1.9 + vec3(uDim.w)) + vec3(uDim.w)) - 0.48 + 0.3*shape;
          float dens = 1. - exp(-(clamp(n*3., 0., 1.)*shape*uCl2.x + ring*clamp(0.6 + (noise(p/(S*5.)) - 0.5)*2., 0., 1.))*0.055*dt);   // (Beer-Lambert: never more than all of the light)
          if(dens < 1e-4) continue;
          // (its sunward side brighter: the cloud's own shape toward the Sun stands in for a shadow ray)
          vec3 ps = p + Ls*S*30.; float rs = length(ps.xz)/Rr, ys = ps.y/H;
          float shd = smoothstep(1., 0.4, rs)*smoothstep(1.5, 0.15, ys + 0.35*rs)*smoothstep(-0.2, 0.12, ys);
          vec3 wp = p + c0; float lp = uPl.w/(1. + dot(wp - uPl.xyz, wp - uPl.xyz)/(900.*S*S));
          float yy = clamp(y, 0., 1.);
          // (bright: sunlit steam is the whitest thing at a launch, brighter than the ground round it)
          vec3 L = steam*(0.05 + uLt.w*(0.3 + 0.8*(1. - 0.65*shd))*(0.6 + 0.4*yy) + uLt.w*0.16*vec3(0.8, 0.88, 1.)) + vec3(1., 0.55, 0.22)*lp*0.7*(1. - 0.5*yy);
          col += T*L*dens; T *= 1. - dens; if(T < 0.04) break;
        }
      }
    }
  }
  // venting: thin white vapour streaming from the stack before launch
  if(uCl2.w > 0.01 && uPt[0].w > 0.5){
    for(int k=ZI;k<10;k++){
      float fk = float(k), h = fract(fk*0.618 + 0.13);
      vec3 base = uPt[0].xyz + uPa[0].xyz*(12. + h*95.), dir = normalize(vec3(sin(fk*2.4), -0.15, cos(fk*2.4)));
      float ph = fract(uDim.y*0.25 + h);
      vec3 cpos = base + dir*(5. + ph*14.) + vec3(0., -ph*6., 0.);
      float s = 1.5 + ph*4.;
      float b = blob(ro, rd, cpos, s)*uCl2.w*(1. - ph)*0.05;
      col += T*vec3(0.85, 0.88, 0.92)*(0.1 + 0.8*uLt.w)*b;
    }
  }
  return vec4(col, T);
}
// the vapour cone: going through the speed of sound in damp air a stage wears a thin conical sheet of condensation, flaring back from its
// shoulder (the collar uVc.z up part uVc.y) over uVc.w m, flickering as it forms and clears. Front-to-back like the cloud
vec4 vcone(vec3 ro, vec3 rd, float tMax){
  vec3 col = vec3(0.); float T = 1.;
  if(uVc.x < 0.01) return vec4(col, T);
  int i = int(uVc.y); float yc = uVc.z, L = uVc.w, ta = 0.8, hr = uPt[i].w < 2.5 ? 4.6 : 1.9;
  // (the stretch of the ray within the cylinder round the axis that holds the cone)
  vec3 ax = uPa[i].xyz, e = uPt[i].xyz + ax*(yc - L*0.5); float Rc = hr + L*ta + 1.;
  vec3 w = ro - e; float ea = dot(rd, ax), wa = dot(w, ax); vec3 dd = rd - ax*ea, ww = w - ax*wa;
  float A = dot(dd, dd), B = 2.*dot(dd, ww), C = dot(ww, ww) - Rc*Rc, D = B*B - 4.*A*C;
  if(D <= 0. || A < 1e-8) return vec4(col, T);
  float sq = sqrt(D), t0 = max((-B - sq)/(2.*A), 0.), t1 = min((-B + sq)/(2.*A), tMax);
  if(abs(ea) > 1e-5){ float tA = (-L*0.5 - 2. - wa)/ea, tB = (L*0.5 + 2. - wa)/ea; t0 = max(t0, min(tA, tB)); t1 = min(t1, max(tA, tB)); }
  if(t1 <= t0) return vec4(col, T);
  float dt = (t1 - t0)/18.;
  for(int k=ZI;k<18;k++){
    vec3 q = toPart(ro + rd*(t0 + dt*(float(k) + 0.5)), i); float s = yc + 1.5 - q.y;
    if(s < 0. || s > L) continue;
    float rho = length(q.xz), dc = rho - (hr + s*ta), th = 0.5 + s*0.05;
    float fl = 0.55 + 0.45*noise(vec3(atan(q.z, q.x)*2.5, s*0.35 - uDim.y*3., uDim.y*5.));
    float dens = 1. - exp(-exp(-dc*dc/(th*th))*smoothstep(0., 2.5, s)*smoothstep(L, L*0.5, s)*fl*uVc.x*0.5*dt);
    col += T*vec3(0.95, 0.96, 1.)*(0.15 + 1.1*uLt.w)*dens; T *= 1. - dens;
  }
  return vec4(col, T);
}
`;

// ---------------------------------------------------------------- Starship: Super Heavy, the ship, the tower and the launch mount
const FS_SX_STAR = COMMON + CLOUD_GLSL + SX_GLSL + `
float booster(vec3 q, out float m){
  float d = sdCylY(q, 4.5, 2.4, 69.); m = 1.;
  float sk = sdCylY(q, 4.25, 0., 2.4); if(sk < d){ d = sk; m = 3.; }
  float ring = sdCylY(q, 4.45, 69., 71.3); if(ring < d){ d = ring; m = 4.; }
  vec2 f = polarFold(q.xz, 4., 0.785);
  float fin = sdBox(vec3(f.x - 6.1, q.y - 65.6, f.y), vec3(1.65, 1.9, 0.3)); if(fin < d){ d = fin; m = 5.; }
  float ch = sdBox(vec3(abs(q.x) - 4.62, q.y - 35., q.z), vec3(0.26, 27., 0.22)); if(ch < d){ d = ch; m = 1.; }
  return d;
}
float shipSD(vec3 q, float fl, out float m){
  float body = sdCylY(q, 4.5, 1.9, 36.);
  float nose = q.y > 36. ? (length(vec3(q.x, (q.y - 36.)*0.3147, q.z)) - 4.5)*0.9 : 1e9;
  float d = min(body, max(nose, 36. - q.y)); m = 1.;
  float eng = sdCylY(q, 3.4, -0.2, 1.9); if(eng < d){ d = eng; m = 3.; }
  vec3 f = vec3(abs(q.x), q.y, q.z);
  vec3 fa = f - vec3(4.5, 2.2, -1.1); fa.xz = mat2(cos(fl), sin(fl), -sin(fl), cos(fl))*fa.xz;
  float af = sdBox(fa - vec3(1.9, 5.2, 0.), vec3(1.9, 5.2, 0.26)); if(af < d){ d = af; m = 6.; }
  float ff = sdBox(f - vec3(5.55, 41.5, -0.9), vec3(1.25, 3.6, 0.24)); if(ff < d){ d = ff; m = 6.; }
  if(m < 1.5 && q.z < -0.4 && q.y > 1.9) m = 2.;   // the heat shield: black tiles on the windward half
  return d;
}
float site(vec3 p, out float m){
  m = 11.; float d = 1e9;
  vec3 q = p - uSo.xyz;
  // tower: square lattice 9 m wide, 146 m to the lightning rod, 28 m north of the mount
  vec3 tq = q - vec3(0., 0., -28.);
  d = lattice(tq, 4.5, 141., 9., 0.55);
  float rod = sdCylY(tq, 0.4, 141., 152.); d = min(d, rod);
  float top = sdBox(tq - vec3(0., 141.5, 0.), vec3(5.2, 0.6, 5.2)); d = min(d, top);
  // the chopsticks: two arms on a carriage, hinged at the tower's front corners
  float hc = uSt.y, op = uSt.z*0.55;
  float car = max(sdBox(tq - vec3(0., hc + 1., 0.), vec3(6.4, 3.4, 6.4)), -sdBox(tq - vec3(0., hc + 1., 0.), vec3(5.3, 4., 5.3)));
  d = min(d, car);
  for(int k=ZI;k<2;k++){
    float sg = k == 0 ? 1. : -1.;
    vec3 a = tq - vec3(4.8*sg, hc, 4.5); float an = -op*sg; a.xz = mat2(cos(an), -sin(an), sin(an), cos(an))*a.xz;
    float arm = sdBox(a - vec3(1.2*sg, 0., 16.5), vec3(0.75, 1.9, 16.5)); if(arm < d){ d = arm; m = 13.; }
  }
  // the ship's quick-disconnect arm at 112 m, swinging back to the tower before launch
  vec3 qa = tq - vec3(-3., 112., 4.5); float sw = uSt.w; qa.xz = mat2(cos(sw), -sin(sw), sin(sw), cos(sw))*qa.xz;
  float qd = sdBox(qa - vec3(1.5, 0., 9.), vec3(1.1, 1.7, 9.)); if(qd < d){ d = qd; m = 11.; }
  // launch mount: a ring table on six legs, 20 m up, over the water-cooled steel plate
  float tab = max(abs(length(q.xz) - 8.2) - 2.6, abs(q.y - 18.2) - 1.8); if(tab < d){ d = tab; m = 11.; }
  vec2 lg = polarFold(q.xz, 6., 0.); float legs = sdCylY(vec3(lg.x - 9.6, q.y, lg.y), 1.25, 0., 17.); if(legs < d){ d = legs; m = 11.; }
  float plate = sdCylY(q, 15., -1., 0.5); if(plate < d){ d = plate; m = 10.; }
  // two tanks of the tank farm, west of the pad
  float tk = min(sdCylY(q - vec3(-150., 0., -40.), 5., 0., 32.), sdCylY(q - vec3(-165., 0., -18.), 5., 0., 32.)); if(tk < d){ d = tk; m = 1.; }
  return d;
}
float map(vec3 p, out float m){
  float d = 1e9, mm; m = 0.;
  if(uSt.x > 0.5){ d = site(p, mm); m = mm; }
  for(int i=ZI;i<4;i++){
    float ty = uPt[i].w; if(ty < 0.5) continue;
    vec3 q = toPart(p, i);
    if(length(q - vec3(0., 36., 0.)) > 44.){ d = min(d, length(q - vec3(0., 36., 0.)) - 40.); continue; }
    float dp = ty < 1.5 ? booster(q, mm) : shipSD(q, uPb[i].w, mm);
    if(dp < d){ d = dp; m = mm + (ty < 1.5 ? 0. : 20.); }
  }
  return d;
}
`;
// ---------------------------------------------------------------- Falcon 9 and Falcon Heavy, the second stage, Dragon, the pads, the droneship and the landing zone
const FS_SX_FAL = COMMON + CLOUD_GLSL + SX_GLSL + `
float core(vec3 q, float legs, float fins, float nose, out float m){
  if(length(q - vec3(0., 23., 0.)) > 34.){ m = 7.; return length(q - vec3(0., 23., 0.)) - 30.; }
  float d = sdCylY(q, 1.83, 1.1, 41.2); m = 7.;
  float eng = sdCylY(q, 1.72, 0., 1.1); if(eng < d){ d = eng; m = 3.; }
  if(nose > 0.5){ float nc = q.y > 41.2 ? (length(vec3(q.x, (q.y - 41.2)*0.34, q.z)) - 1.83)*0.9 : 1e9; nc = max(nc, 41.2 - q.y); if(nc < d){ d = nc; m = 9.; } }
  else { float is = sdCylY(q, 1.83, 41.2, 47.7); if(is < d){ d = is; m = 8.; } }
  vec2 f = polarFold(q.xz, 4., 0.785);
  float gy = nose > 0.5 ? 40. : 46.4;
  float fin = sdBox(vec3(f.x - 1.83 - 0.75*fins, q.y - gy, f.y), vec3(0.05 + 0.72*fins, 0.75, 0.62 - 0.52*fins)); if(fin < d){ d = fin; m = 5.; }
  vec2 g = polarFold(q.xz, 4., 0.);
  vec2 foot = mix(vec2(1.96, 10.4), vec2(8.4, -1.4), legs);
  float leg = sdCap(vec3(g.x, q.y, g.y), vec3(1.96, 1.3, 0.), vec3(foot.x, foot.y, 0.), 0.28); if(leg < d){ d = leg; m = 8.; }
  return d;
}
float dragonSD(vec3 q, out float m){
  float d = sdCylY(q, 1.85, 0., 3.7); m = q.x > 0.2 ? 12. : 7.;   // trunk: solar cells on one half
  float u = clamp((q.y - 3.7)/4.1, 0., 1.);
  float cap = max((length(q.xz) - mix(1.96, 1.05, u))*0.93, abs(q.y - 5.75) - 2.05); if(cap < d){ d = cap; m = 9.; }
  float nc = max(length(vec3(q.x, (q.y - 7.8)*1.6, q.z)) - 1.02, 7.8 - q.y); if(nc < d){ d = nc; m = 8.; }
  return d;
}
float stage2(vec3 q, float pay, out float m){
  if(length(q - vec3(0., 13., 0.)) > 18.){ m = 7.; return length(q - vec3(0., 13., 0.)) - 14.; }
  float u = clamp(q.y/2.9, 0., 1.), rb = mix(1.55, 0.45, pow(u, 0.7));
  float d = max(abs(length(q.xz) - rb) - 0.035, abs(q.y - 1.45) - 1.45); m = 3.;
  float tk = sdCylY(q, 1.83, 2.9, 12.6); if(tk < d){ d = tk; m = 7.; }
  if(pay < 0.5){
    float fr = sdCylY(q, 2.6, 13.2, 19.6); float og = q.y > 19.6 ? (length(vec3(q.x, (q.y - 19.6)*0.43, q.z)) - 2.6)*0.9 : 1e9; og = max(og, 19.6 - q.y);
    float bt = sdCylY(q, 2.6 - 0.8*clamp((13.2 - q.y)/0.6, 0., 1.), 12.6, 13.2);
    float fa = min(min(fr, og), bt); if(fa < d){ d = fa; m = 7.; }
  } else if(pay < 1.5){ float mm; float dg = dragonSD(q - vec3(0., 12.6, 0.), mm); if(dg < d){ d = dg; m = mm; } }
  return d;
}
float site(vec3 p, out float m){
  vec3 q = p - uSo.xyz; float c = cos(uSo.w), s = sin(uSo.w); q.xz = mat2(c, -s, s, c)*q.xz;
  float k = uSt.x, d = 1e9; m = 10.;
  if(k < 3.5){
    // pad: the launch mount and the strongback (transporter-erector) on the north side, leaning back before launch
    float mt = max(sdBox(q - vec3(0., 1.6, 0.), vec3(4.5, 1.6, 4.5)), -sdCylY(q, 2.2, 0., 4.)); d = mt; m = 10.;
    vec3 tq = q - vec3(0., 0., -4.3); float tl = uSt.w; tq.yz = mat2(cos(tl), sin(tl), -sin(tl), cos(tl))*tq.yz;
    float te = lattice(tq - vec3(0., 0., -1.3), 1.25, 57., 3.2, 0.2); if(te < d){ d = te; m = 11.; }
    if(k > 2.5){
      // the tower (80 m), with the crew access arm where crews board (kind 3: SLC-40; 39A, kind 2.75, lost its arm in 2026)
      vec3 cq = q - vec3(0., 0., -20.);
      float tw = lattice(cq, 5., 80., 8., 0.45); if(tw < d){ d = tw; m = 11.; }
      if(k > 2.9){ float arm = sdBox(q - vec3(0., 66., -9.5), vec3(1.4, 1.6, 7.5)); if(arm < d){ d = arm; m = 11.; } }
    }
  } else if(k < 4.5){
    // the droneship: a 91 x 52 m deck with walls along its long sides and a thruster pod at each corner
    float dk = sdBox(q - vec3(0., 1., 0.), vec3(45.5, 2., 26.)); d = dk; m = 14.;
    if(q.y > 2.8 && abs(length(q.xz) - 11.) < 0.8) m = 9.;   // (the landing ring painted on the deck)
    float wl = sdBox(vec3(q.x, q.y - 4., abs(q.z) - 25.5), vec3(44., 1.2, 0.5)); if(wl < d){ d = wl; m = 14.; }
    float th = sdBox(vec3(abs(q.x) - 42., q.y - 3.6, abs(q.z) - 22.), vec3(2.5, 1.2, 2.5)); if(th < d){ d = th; m = 14.; }
  } else {
    float lz = sdCylY(q, 42., -1., 0.25); d = lz; m = 10.;
  }
  return d;
}
float map(vec3 p, out float m){
  float d = 1e9, mm; m = 0.;
  if(uSt.x > 0.5){ d = site(p, mm); m = mm; }
  for(int i=ZI;i<4;i++){
    float ty = uPt[i].w; if(ty < 0.5) continue;
    vec3 q = toPart(p, i);
    float dp = ty < 5.5 ? core(q, uPb[i].w, uPc[i].w, ty > 3.5 ? 1. : 0., mm) : ty < 6.5 ? stage2(q, uPb[i].w, mm) : dragonSD(q, mm);
    if(dp < d){ d = dp; m = mm; }
  }
  return d;
}
`;
// the shared main(): march, shade (Sun, sky, the plume's own light, soft shadows), then plumes and clouds along the ray
const SX_MAIN = `
vec3 skyTint(vec3 r){ vec3 day = mix(vec3(0.3, 0.26, 0.2)*0.4, vec3(0.45, 0.62, 0.95), smoothstep(-0.05, 0.25, r.y)); return day*(0.04 + 0.5*uLt.w) + vec3(0.02, 0.025, 0.05); }
vec3 matCol(float m, vec3 p, vec3 q, out float ks, out float gl){
  ks = 0.2; gl = 16.;
  if(m > 19.5) m -= 20.;
  if(m < 1.5){ ks = 1.; gl = 40.; return vec3(0.78, 0.79, 0.8)*(0.9 + 0.1*noise(p*1.3)); }   // stainless steel
  if(m < 2.5){ ks = 0.25; gl = 20.; return vec3(0.045); }                                        // heat-shield tiles
  if(m < 3.5){ ks = 0.6; gl = 30.; return vec3(0.16, 0.15, 0.14); }                              // engines
  if(m < 4.5){ return vec3(0.1); }                                                                // hot-staging ring
  if(m < 5.5){ ks = 0.5; gl = 20.; return vec3(0.22, 0.22, 0.24); }                               // grid fins
  if(m < 6.5){ ks = 0.8; gl = 30.; return vec3(0.4, 0.41, 0.43); }                                // flaps
  if(m < 7.5){ float soot = smoothstep(0.35, 0.8, noise(p*0.35))*smoothstep(38., 8., p.y - uPt[0].y); return vec3(0.88, 0.88, 0.86)*mix(1., 0.55, soot*0.7); }   // white paint, sooty low down
  if(m < 8.5){ return vec3(0.05); }                                                               // black: interstage, legs, Dragon's nose
  if(m < 9.5){ ks = 0.35; return vec3(0.9, 0.9, 0.9); }                                           // Dragon, nosecones
  if(m < 10.5){ return vec3(0.34, 0.33, 0.31)*(0.85 + 0.3*noise(p*0.2)); }                        // concrete
  if(m < 11.5){ ks = 0.3; return vec3(0.42, 0.42, 0.43); }                                        // tower steel
  if(m < 12.5){ ks = 0.6; gl = 40.; return vec3(0.06, 0.07, 0.12); }                              // solar cells
  if(m < 13.5){ ks = 0.5; return vec3(0.5, 0.5, 0.52); }                                          // chopsticks
  return vec3(0.3, 0.3, 0.32);                                                                    // the droneship's deck
}
vec3 nrmAt(vec3 p, float e){
  vec3 n = vec3(0.); float m;
  for(int i=ZI;i<4;i++){ vec3 k = vec3((i == 3 || i == 0) ? 1. : -1., (i == 1 || i == 3) ? 1. : -1., (i == 2 || i == 3) ? 1. : -1.)*0.5773; n += k*map(p + k*e, m); }
  return normalize(n);
}
void main(){
  vec3 o, d; localRay(o, d);
  vec2 hb = sphIsect(o, d, vec3(0.), 1.);
  if(hb.y < 0.) discard;
  float R = uDim.x;
  vec3 ro = o*R, L = uLt.xyz;
  float t = max(hb.x, 0.)*R, tEnd = hb.y*R, m = 0., eps = 0.;
  bool hit = false;
  int steps = int(mix(70., 150., clamp(uLod, 0., 1.)));
  for(int i=ZI;i<200;i++){
    if(i >= steps) break;
    float h = map(ro + d*t, m); eps = max(0.02, t*uPix*0.7);
    if(h < eps){ hit = true; break; }
    t += h*0.92; if(t > tEnd) break;
  }
  vec3 col = vec3(0.); float a = 0., tHit = hit ? t : tEnd;
  if(hit){
    vec3 p = ro + d*t, n = nrmAt(p, max(eps*0.6, 0.015)); float ks, gl;
    vec3 base = matCol(m, p, p, ks, gl);
    // soft shadow toward the Sun (only when the Sun is up, and only on larger views)
    float sh = 1.;
    if(uLt.w > 0.02 && uLod > 0.45){ float st = 0.3, mm; for(int i=ZI;i<22;i++){ float h = map(p + n*0.1 + L*st, mm); sh = min(sh, 10.*h/st); st += clamp(h, 0.4, 12.); if(sh < 0.03 || st > 220.) break; } sh = clamp(sh, 0., 1.); }
    float dif = max(dot(n, L), 0.)*sh*smoothstep(-0.02, 0.08, L.y + 0.05);
    vec3 r = reflect(d, n);
    vec3 c = base*(dif*1.5 + 0.6*skyTint(n)) + ks*skyTint(r)*0.9;
    c += base*0.22*pow(1. - max(dot(n, -d), 0.), 3.)*(0.3 + 0.7*uLt.w);   // (a rim of light, so a stage stands out from the ground behind it)
    c += vec3(1., 0.95, 0.85)*pow(max(dot(r, L), 0.), gl)*ks*sh*1.2;
    // the plume lights the pad, the hull and the tower, fading with distance
    vec3 lv = uPl.xyz - p; float ld2 = dot(lv, lv);
    c += base*vec3(1., 0.62, 0.3)*uPl.w*max(dot(n, lv*inversesqrt(max(ld2, 1.))), 0.)*1800./(ld2 + 1800.);
    // floodlights: the pads are lit from the ground at night, so the rocket stands out white against the sky
    if(uSt.x > 0.5 && uSt.x < 3.5){ vec3 so = uSo.xyz;
      for(int k=ZI;k<3;k++){ float fk = float(k); vec3 lp = so + vec3(sin(fk*2.1 + 0.6)*110., 3., cos(fk*2.1 + 0.6)*110.), lv = lp - p; float l2 = dot(lv, lv);
        c += base*vec3(0.85, 0.9, 1.)*max(dot(n, lv*inversesqrt(l2)), 0.)*(1. - uLt.w)*1.6*30000./(l2 + 30000.); } }
    col = c; a = 1.;
  }
  vec4 cl = cloud(ro, d, tHit);
  col = col*cl.w + cl.xyz;
  vec4 vk = vcone(ro, d, tHit);
  col = col*vk.w + vk.xyz;
  col += plumes(ro, d, tHit)*mix(1., 0.6, 1. - cl.w);
  a = 1. - (1. - a)*cl.w*vk.w;
  // (the low cloud between the camera and what the ray met: a stage climbing through the deck fades into it; the ground and sky behind
  // already show the cloud)
  if(uWx0.x > 0.01){
    vec3 so = uCm*ro + uCo.xyz, sdir = uCm*d; float tcl = hit ? tHit : tEnd;
    float alt0 = so.y + uCo.w + dot(so.xz, so.xz)/12742000., ta = (uWx1.x - alt0)/(abs(sdir.y) > 1e-5 ? sdir.y : 1e-5), tb = (uWx1.y - alt0)/(abs(sdir.y) > 1e-5 ? sdir.y : 1e-5);
    float c0 = max(min(ta, tb), 0.), c1 = min(max(ta, tb), tcl);
    if(c1 > c0){ float Tc = 1., dc = (c1 - c0)/8.;
      for(int k=ZI;k<8;k++){ vec3 q = so + sdir*(c0 + dc*(float(k) + 0.5)); Tc *= exp(-cloudLowCheap(q, q.y + uCo.w + dot(q.xz, q.xz)/12742000.)*dc*0.012); }
      col *= Tc; a *= Tc; }
  }
  outCol(col, a);
}`;
P.sxStar = program(VS_RECT, FS_SX_STAR + SX_MAIN);
P.sxFal = program(VS_RECT, FS_SX_FAL + SX_MAIN);

// ---------------------------------------------------------------- the smoke column a flight leaves (0.9.9, owner: more smoke, as in a real launch)
// A chain of capsules along the stack's path from the pad up through the lower air (to about 14 km), each widening with its age and drifting
// with the wind (s3-spacex.js, smokeUpdate), filled with turbulence at the column's own scale, lit by the Sun through the smoke above each
// point, by the sky, and a little from the ground. White steam from Starship's methane, greyer from Falcon's kerosene. In metres, in the
// pad's frame round the volume's centre. uK[k] = centre, radius; uKd[k] = density, age (s), soot 0..1; uSm = count, 0, 0, ZI (0);
// uLtS = sun direction, daylight; uDimS = bounding radius (m), time (s)
const FS_SX_SMOKE = COMMON + `
uniform vec4 uK[16]; uniform vec4 uKd[16]; uniform vec4 uSm; uniform vec4 uLtS; uniform vec4 uDimS;
#define ZI int(uSm.w)
// the smoke at p: its density, the column's radius and soot there (out), and how far p lies outside the column (for skipping empty air)
float smokeAt(vec3 p, out float rad, out float soot, out float outside){
  float best = 0.; rad = 4.; soot = 0.; outside = 1e9;
  int n = int(uSm.x);
  for(int k=ZI;k<15;k++){
    if(k + 1 >= n) break;
    vec3 a = uK[k].xyz, ba = uK[k + 1].xyz - a; float h = clamp(dot(p - a, ba)/max(dot(ba, ba), 1e-6), 0., 1.);
    float r = mix(uK[k].w, uK[k + 1].w, h), q = length(p - a - ba*h);
    outside = min(outside, q - r);
    if(q >= r) continue;
    float dn = mix(uKd[k].x, uKd[k + 1].x, h)*smoothstep(1., 0.3, q/r);
    if(dn > best){ best = dn; rad = r; soot = mix(uKd[k].z, uKd[k + 1].z, h); }
  }
  return best;
}
void main(){
  vec3 o, d; localRay(o, d);
  vec2 hb = sphIsect(o, d, vec3(0.), 1.);
  if(hb.y < 0.) discard;
  float R = uDimS.x; vec3 ro = o*R; float t = max(hb.x, 0.)*R, tEnd = hb.y*R;
  vec3 L = uLtS.xyz; float day = uLtS.w;
  vec3 col = vec3(0.); float T = 1.;
  int steps = int(mix(28., 56., clamp(uLod, 0., 1.)));
  for(int i=ZI;i<56;i++){
    if(i >= steps || t > tEnd || T < 0.03) break;
    vec3 p = ro + d*t; float rad, soot, outside;
    float base = smokeAt(p, rad, soot, outside);
    if(base <= 0.){ t += max(outside, 1.5 + t*0.002); continue; }
    float st = max(rad*0.16, 1.2);
    // (turbulence at the column's own scale, rising slowly)
    vec3 q = p/(rad*0.85) + vec3(0., -uDimS.y*0.05, 0.);
    float dens = clamp((fbm3(q) - 0.42 + base*0.45)*2.4, 0., 1.)*base;
    if(dens > 0.002){
      float r2, s2, o2; float sh = smokeAt(p + L*rad*0.8, r2, s2, o2);
      float lit = exp(-sh*2.4)*smoothstep(-0.1, 0.15, L.y)*day;
      vec3 c = mix(vec3(0.96, 0.95, 0.92), vec3(0.4, 0.36, 0.32), soot);
      vec3 li = c*(lit*1.05 + day*0.26*vec3(0.78, 0.86, 1.) + 0.015);
      float a = 1. - exp(-dens*st*0.04);
      col += T*li*a; T *= 1. - a;
    }
    t += st;
  }
  outCol(col, 1. - T);
}`;
P.sxSmoke = program(VS_RECT, FS_SX_SMOKE);

/// ---------------------------------------------------------------- the ground and the sky round a launch site, seen from near the ground
// Drawn right after Earth (earth.drawAfter), over the whole screen, while the camera is within a few tens of kilometres of the surface:
// Earth's own shader is a planet seen from space, so close to the pad this takes over. In metres, in the frame of the site the camera is
// nearest (x east, y up, z south, the pad at the origin, the sea uP4.y below it), the ground follows the Earth's curve. Where the site's
// images are loaded (ED_GLSL, e3-earth-detail.js) it is the real ground: near the camera the heights (terrain and buildings from
// OpenStreetMap) are ray-marched, so hills, hangars and the Vehicle Assembly Building stand up and cast shadows; further off the images lie
// flat on the curve. Elsewhere, and without the images (offline, the artifact page), a sketch: land and sea split along a straight coastline.
// Colours are worked out as they should show on screen (after FS_CELL's tone map, which unTone undoes, as the planets do): the images a
// little richer in colour and contrast, so tidal flats, marsh, sand and roofs land on different characters. Water reflects the sky (more at
// a glancing angle), glints in the Sun and takes the plume's light; the open sea is one colour. Distant ground fades into the haze of the
// horizon. The sky: blue by day, darkening to black as the camera climbs, an orange band at twilight, the Sun.
// uP0 = camera (m), fade;  uP1 = sun direction, daylight;  uP2 = coast normal (x, z), coast distance (m), open sea (1);
// uP3 = plume light: position (m), strength;  uP4 = time, the height of the pad above the sea (m), 0, ZI (0)
const FS_SX_ENV = COMMON + '#define ED_GRAD\n' + ED_GLSL + CLOUD_GLSL + `
const float RE = 6371000.;
uniform vec4 uTwL[16]; uniform float uTwLN;   // (a city's tower lights: e9c-earth-cities.js)
// (a city's slender towers, too thin for its height images (the Eiffel Tower, Tokyo Tower, the Skytree...): uThin x y its foot in this frame
// (x, z), z the ground there (m above the sea), w its height; uThinB x the half-width of its foot, y 1 for a straight shaft, 0 a tapering
// lattice. THIN: whether the last height asked for was one of them)
uniform vec4 uThin[4]; uniform vec4 uThinB[4]; uniform float uThinN;
float THIN = 0.;
#ifdef CITY
// the traffic (0.14.0, e9t-earth-traffic.js), in the cities' copies of this shader only (P.sxEnvC, and Paris's P.sxEnvEf): the road maps
// (uRd0 near: 8 km round the camera; uRd1 far: the city, 48 km) and their numbers (uRdN: the near map's centre, m east and north of the
// city's centre, its half-size, the far map's half-size; uRdT: how busy 0..1 (-1: no maps), the side of the road (1 right, -1 left), the
// cars' clock (s))
uniform sampler2D uRd0; uniform sampler2D uRd1; uniform vec4 uRdN; uniform vec4 uRdT;
// the road at en (m east, north of the city's centre): x the direction of travel (radians), y the offset across from its centre line (m, +
// to the right of x), z lanes, w class*2 + one-way, + 16 on a bridge; y < -900: none. fp: the size of a pixel on the ground (m)
vec4 roadAt(vec2 en, float fp){
  if(uRdT.x < -0.5) return vec4(0., -999., 0., 0.);
  vec2 q0 = (en - uRdN.xy)/(2.*uRdN.z) + 0.5, q1 = en/(2.*uRdN.w) + 0.5, c; vec4 r; ivec2 i, s;
  float R = 40.;   // (the offset's range: 40 m on the near map, 100 m on the far one, whose roads are padded wider: e9t-earth-traffic.js)
  if(fp < 8. && q0 == clamp(q0, 0.001, 0.999)){ s = textureSize(uRd0, 0); i = ivec2(q0*vec2(s)); r = texelFetch(uRd0, i, 0); c = uRdN.xy + ((vec2(i) + 0.5)/vec2(s) - 0.5)*2.*uRdN.z; }
  else if(q1 == clamp(q1, 0.001, 0.999)){ s = textureSize(uRd1, 0); i = ivec2(q1*vec2(s)); r = texelFetch(uRd1, i, 0); c = ((vec2(i) + 0.5)/vec2(s) - 0.5)*2.*uRdN.w; R = 100.; }
  else return vec4(0., -999., 0., 0.);
  if(r.a < 0.3) return vec4(0., -999., 0., 0.);
  float th = r.r*6.2831853, b = floor(r.b*255. + 0.5); vec2 t = vec2(cos(th), sin(th));
  return vec4(th, (r.g - 0.5)*2.*R + dot(en - c, vec2(t.y, -t.x)), floor(b/16.), mod(b, 16.) + (r.a < 0.8 ? 16. : 0.));
}
// the cars on that road at en: rgb the light of their lamps (white coming toward the camera, red going away; dv: the view's direction on the
// ground), a how much of the pixel a car's body covers by day, its colour in body. Each lane's cars sit in cells of length L (shorter when
// busy), most cells with one car, moving at a speed for the road's class, slower on the big roads at rush hour; up close each is a dot, far
// off the lane's average light
vec4 cars(vec2 en, vec4 rd, float fp, vec2 dv, out vec3 body){
  body = vec3(0.5);
  float lanes = max(rd.z, 1.), w = mod(rd.w, 16.), cls = floor(w/2.), one = mod(w, 2.), hw = lanes*1.65, ac0 = rd.y;
  // (far off, the big roads (motorway, trunk, primary) carry streams of cars drawn larger than life, so the traffic shows from 15 km: the road
  // drawn at least a pixel and a half wide, the cars spaced about six pixels apart and moving as many pixels a second; owner's pick, 0.17.0)
  float far = smoothstep(2.5, 6., fp)*step(cls, 2.5), hwE = mix(hw, clamp(fp*0.8, hw, 90.), far);
  if(abs(ac0) > hwE + 0.6) return vec4(0.);
  float ac = ac0*hw/hwE;   // (the lane it falls in, as on the road at its real width)
  vec2 t = vec2(cos(rd.x), sin(rd.x));
  float sg = one > 0.5 ? 1. : (ac*uRdT.y > 0. ? 1. : -1.);
  float li = one > 0.5 ? floor((ac + hw)/3.3) : floor(abs(ac)/3.3), lc = one > 0.5 ? (li + 0.5)*3.3 - hw : sign(ac)*(li + 0.5)*3.3;
  float busy = uRdT.x, v = (cls < 0.5 ? 27. : cls < 1.5 ? 20. : cls < 2.5 ? 13. : 11.)*(1. - 0.55*smoothstep(0.75, 1., busy)*step(cls, 1.5));
  float L0 = mix(95., 15., busy)*(cls < 1.5 ? 0.85 : 1.15), L = mix(L0, max(L0, fp*6.), far);
  float u = dot(en, t) - sg*v*(L/L0)*uRdT.z, lineC = dot(en, vec2(t.y, -t.x)) - ac0;
  vec2 key = vec2(floor(rd.x*24.) + li*7.3 + sg*3.1, floor(lineC*0.5));
  float cell = floor(u/L), r = max(1.6, fp*0.9), da = (ac - lc)*mix(1., hwE/hw, far)*mix(1., 0.4, far), g = 0., hb = 0.;   // (at least a pixel across: smaller, most fell between the pixels)
  for(int j=0;j<3;j++){   // (three cars: this cell's and its neighbours'; ZI is declared further down)
    float cc = cell + float(j - 1), hh = hash12(key + cc*vec2(1.7, 3.1));
    if(fract(hh*13.7) < 0.85){ float du = u - (cc + 0.1 + 0.8*hh)*L, e = exp(-(du*du + 2.*da*da)/(r*r)); if(e > g){ g = e; hb = fract(hh*41.3); } }
  }
  body = hb < 0.3 ? vec3(0.92) : hb < 0.5 ? vec3(0.1) : hb < 0.75 ? vec3(0.7, 0.71, 0.73) : hb < 0.83 ? vec3(0.72, 0.1, 0.08) : hb < 0.92 ? vec3(0.15, 0.25, 0.55) : vec3(0.32);
  // (a lamp is a point of light: it stays bright as it shrinks to a pixel, then the lane's average light takes over)
  float k = smoothstep(0.35, 0.9, fp/L)*(1. - far), I = mix(mix(g*min(2.56/(r*r)*4., 1.), g*1.3, far), 0.85*3.8*32./(L*max(3.3, fp)), k);
  vec3 lamp = mix(vec3(1., 0.93, 0.8)*1.8, vec3(1., 0.12, 0.06)*1.3, smoothstep(-0.25, 0.25, dot(sg*t, dv)));
  body = mix(body, vec3(1., 0.92, 0.55), 0.35*far);   // (far off by day, brighter and warmer, so the moving dashes read against the dark road)
  return vec4(lamp*I, g*mix(min(6.25/(r*r), 1.), 1., far)*(1. - k)*0.85);
}
#endif
#ifdef LM
// the landmarks of the cities of 0.19.0 as models (owner's picks, 2026-10-07: the Golden Gate Bridge, the Sydney Opera House, the Colosseum and
// St Peter's, the Hollywood sign, Christ the Redeemer), each in the copy of this shader used near its city (P.sxEnvSF, P.sxEnvSyd,
// P.sxEnvRome, P.sxEnvLA, P.sxEnvRio, built in the background), as the Eiffel Tower and Tokyo's towers are. Real sizes, in their sources'
// comments; the finer shapes (the sails' curves, the arches, the letters' strokes, the statue's robe) are illustrative. uLm0 / uLm1: each
// landmark's foot (x, z in this frame), the ground there (m above the sea), the turn of its own frame (its x along the bridge, the sign or the
// building's axis, its z toward the front); uLm2: the lights (0..1), a clock (s), how many landmarks (1 or 2), 0. Each city's lmBounds(k)
// (half-length in x, y from, y to, half-width in z) and lmMap(p, k) (the distance, in m) and lmBase(q, n, k, px, glow) (the colour in full
// sunlight, and how much of its night lighting shows)
uniform vec4 uLm0; uniform vec4 uLm1; uniform vec4 uLm2;
// (0.22.0: Las Vegas has four, LM_N 4: uLm3, uLm4 the third and fourth. LMEM: what the landmark gives off itself, a screen or its lamps,
// set by lmBase; LMD, LMPX: the ray's direction in the landmark's frame and the size of a pixel where lmMap is asked, so a model can leave out
// what a pixel cannot show, such as a wheel's cables)
#ifndef LM_N
#define LM_N 2
#endif
#if LM_N > 2
uniform vec4 uLm3; uniform vec4 uLm4;
#endif
vec4 lmU(int j){
#if LM_N > 2
  return j == 0 ? uLm0 : j == 1 ? uLm1 : j == 2 ? uLm3 : uLm4;
#else
  return j == 0 ? uLm0 : uLm1;
#endif
}
vec3 LMEM = vec3(0.), LMD = vec3(0., -1., 0.); float LMPX = 1.;
float lmBox(vec3 p, vec3 c, vec3 b){ vec3 q = abs(p - c) - b; return length(max(q, 0.)) + min(max(q.x, max(q.y, q.z)), 0.); }
float lmCap(vec3 p, vec3 a, vec3 b, float r){ vec3 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba)/dot(ba, ba), 0., 1.); return length(pa - ba*h) - r; }
float lmSeg(vec2 p, vec2 a, vec2 b){ vec2 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba)/dot(ba, ba), 0., 1.); return length(pa - ba*h); }
vec3 lmRot(vec3 v, float a){ float c = cos(a), s = sin(a); return vec3(c*v.x + s*v.z, v.y, -s*v.x + c*v.z); }
#endif
#ifdef LM_SF
// the Golden Gate Bridge (Golden Gate Bridge, Highway and Transportation District): towers 227 m above the water and 1,280 m apart, the roadway
// 67 m up and 27 m wide, side spans of 343 m to the anchorages, the main cables sagging from the towers' tops to just above the roadway in the
// middle; x along the bridge from its middle, z across. International Orange, its towers floodlit at night
vec4 lmBounds(float k){ return vec4(1300., -2., 232., 26.); }
float ggCable(float x){ float ax = abs(x); if(ax < 640.){ float u = x/640.; return 72. + 155.*u*u; } float s = clamp((ax - 640.)/343., 0., 1.); return 227. - 152.*s - 34.*s*(1. - s); }
float lmMap(vec3 p, float k){
  float ax = abs(p.x), d = lmBox(p, vec3(0., 65., 0.), vec3(1290., 3., 13.7));   // (the roadway)
  vec3 q = vec3(ax - 640., p.y, abs(p.z) - 17.);
  d = min(d, lmBox(q, vec3(0., 113.5, 0.), vec3(mix(6.5, 4., clamp(p.y/227., 0., 1.)), 113.5, 4.5)));   // (each tower's two legs, tapering)
  float sy = p.y < 85. ? 40. : p.y < 128. ? 105. : p.y < 170. ? 150. : p.y < 206. ? 190. : 222.;   // (the nearest of the struts between them)
  d = min(d, lmBox(vec3(ax - 640., p.y, p.z), vec3(0., sy, 0.), vec3(3., 3.5, 17.)));
  if(ax < 990.){   // (the two main cables, about 0.9 m thick: the distance to each curve, its height difference eased by the slope)
    float sl = ax < 640. ? 0.484*ax/640. : 0.5;
    d = min(d, length(vec2((p.y - ggCable(p.x))/sqrt(1. + sl*sl), abs(p.z) - 15.)) - 0.6);
  }
  d = min(d, lmBox(vec3(ax, p.y, p.z), vec3(995., 34., 0.), vec3(18., 34., 22.)));   // (the anchorages)
  return d*0.9;
}
vec3 lmBase(vec3 q, vec3 n, float k, float px, out float glow){
  float deck = step(0.7, n.y)*step(abs(q.y - 68.), 1.5)*step(abs(q.z), 13.);
  glow = deck > 0.5 ? 0.12 : step(abs(abs(q.x) - 640.), 9.)*0.55 + 0.12;   // (the towers floodlit, the roadway's lamps)
  return deck > 0.5 ? vec3(0.3, 0.3, 0.32) : vec3(0.8, 0.28, 0.14);
}
#endif
#ifdef LM_SYD
// the Sydney Opera House (Sydney Opera House Trust): its sails rise to 67 m above the sea, two halls side by side and a pair over the restaurant,
// on a podium about 10 m high; x along its long axis toward the harbour, z across. The sails as curved shells over the halls (their tiles white,
// the glass of their mouths dark), floodlit at night
vec4 lmBounds(float k){ return vec4(100., -2., 70., 64.); }
float osSail(vec2 xz, vec4 a, vec2 b){   // a: the mouth's x, the hall's z, which way the mouth faces (+1 toward +x), the height above the podium; b: length, half-width
  float u = a.z*(xz.x - a.x)/b.x, zz = abs(xz.y - a.y)/(b.y*(0.8 + 0.4*clamp(u, 0., 1.)));
  if(u < -0.02 || u > 1. || zz > 1.) return 0.;
  return a.w*pow(max(1. - u, 0.), 0.7)*pow(max(1. - zz, 0.), 0.55);
}
float osH(vec2 xz){
  float H = osSail(xz, vec4( 40., -22.,  1., 42.), vec2(32., 21.));   // (the Concert Hall: two sails facing the harbour, two facing the steps)
  H = max(H, osSail(xz, vec4(  8., -22.,  1., 57.), vec2(42., 24.)));
  H = max(H, osSail(xz, vec4(-30., -22., -1., 44.), vec2(30., 22.)));
  H = max(H, osSail(xz, vec4(-58., -22., -1., 24.), vec2(16., 17.)));
  H = max(H, osSail(xz, vec4( 36.,  24.,  1., 36.), vec2(28., 18.)));   // (the Joan Sutherland Theatre)
  H = max(H, osSail(xz, vec4(  6.,  24.,  1., 50.), vec2(38., 21.)));
  H = max(H, osSail(xz, vec4(-28.,  24., -1., 38.), vec2(27., 19.)));
  H = max(H, osSail(xz, vec4(-54.,  24., -1., 20.), vec2(14., 15.)));
  H = max(H, osSail(xz, vec4(-80., -38., -1., 20.), vec2(14., 11.)));   // (the restaurant's pair)
  return max(H, osSail(xz, vec4(-68., -38.,  1., 16.), vec2(12., 9.)));
}
float lmMap(vec3 p, float k){
  float pod = lmBox(p, vec3(-12., 5., -4.), vec3(84., 5., 56.));
  return min(pod, max(max((p.y - 10. - osH(p.xz))*0.4, 10. - p.y), lmBox(p, vec3(-10., 40., -4.), vec3(90., 30., 60.))));
}
vec3 lmBase(vec3 q, vec3 n, float k, float px, out float glow){
  glow = q.y > 10.5 ? 0.6 : 0.1;
  if(q.y < 10.5) return vec3(0.74, 0.62, 0.54);   // (the podium's pink granite)
  if(abs(n.x) > 0.75 && n.y < 0.35) return vec3(0.28, 0.25, 0.22);   // (the glass in the sails' mouths)
  float tl = step(0.12, fract(q.y*0.9 + q.z*0.15));
  return mix(vec3(0.95, 0.94, 0.9), vec3(0.88, 0.86, 0.8), (1. - tl)*smoothstep(1.2, 0.3, px));   // (the white and cream tiles)
}
#endif
#ifdef LM_ROME
// the Colosseum (k 0): an oval 189 by 156 m, its outer wall 48 m high where it stands (the north side) and only the second ring, about 31 m,
// on the south; the seating sloping down to the arena; three tiers of 80 arches and the attic above. St Peter's Basilica (k 1): the nave,
// transept, apse and the facade (115 m wide, 46 m high), the drum and the dome, 136.6 m to the top of its cross (Fabbrica di San Pietro);
// x toward the facade (east), the dome at the origin. Travertine, the dome lead grey; both floodlit at night
vec4 lmBounds(float k){ return k < 0.5 ? vec4(99., -2., 50., 83.) : vec4(136., -2., 139., 74.); }
float lmMap(vec3 p, float k){
  if(k < 0.5){
    float r = length(vec2(p.x/94.5, p.z/78.)), sc = 78., hO = mix(31., 48., smoothstep(12., -22., p.z));
    float d = max(abs(r - 0.965)*sc - 2.8, p.y - hO);   // (the outer wall)
    d = min(d, max(abs(r - 0.865)*sc - 2.8, p.y - 31.));   // (the second ring)
    d = min(d, max(max(0.5 - r, r - 0.85)*sc, p.y - mix(4., 29., clamp((r - 0.5)/0.35, 0., 1.))));   // (the seating)
    d = min(d, max(abs(r - 0.485)*sc - 1., p.y - 4.));   // (the arena's wall)
    return max(d, -p.y - 1.)*0.8;
  }
  float d = lmBox(p, vec3(75., 22.5, 0.), vec3(48., 22.5, 30.));   // (the nave)
  d = min(d, lmBox(p, vec3(0., 22.5, 0.), vec3(30., 22.5, 68.)));   // (the transept)
  d = min(d, max(length(p.xz - vec2(-30., 0.)) - 30., abs(p.y - 22.5) - 22.5));   // (the apse)
  d = min(d, lmBox(p, vec3(126., 23., 0.), vec3(5., 23., 57.)));   // (the facade)
  d = min(d, max(length(p.xz) - 23., abs(p.y - 61.5) - 16.5));   // (the drum, 45 to 78 m)
  d = min(d, max((length((p - vec3(0., 78., 0.))/vec3(21., 32., 21.)) - 1.)*21., 78. - p.y));   // (the dome)
  d = min(d, max(length(p.xz) - 5., abs(p.y - 118.) - 9.));   // (the lantern)
  d = min(d, max(length(p.xz) - max(3.4 - (p.y - 127.)*0.6, 0.3), abs(p.y - 130.) - 3.));
  d = min(d, lmBox(p, vec3(0., 134.6, 0.), vec3(0.35, 2., 0.35)));   // (the cross)
  vec2 md = vec2(p.x - 36., abs(p.z) - 46.);   // (the two smaller domes)
  return min(d, max(length(vec3(md.x, (p.y - 52.)*0.8, md.y)) - 10., 44. - p.y))*0.9;
}
vec3 lmBase(vec3 q, vec3 n, float k, float px, out float glow){
  glow = 0.5;
  vec3 tr = vec3(0.86, 0.78, 0.62);
  if(k < 0.5){
    float r = length(vec2(q.x/94.5, q.z/78.)), th = atan(q.z/78., q.x/94.5), a = fract(th/6.2831853*80.), y = q.y;
    // (on the outer faces, three tiers of arches and the attic's small windows: dark where a pixel resolves them)
    float arch = step(0.2, a)*step(a, 0.8)*(step(1.5, y)*step(y, 8.5) + step(12., y)*step(y, 19.5) + step(23., y)*step(y, 30.) + step(37., y)*step(y, 39.)*step(0.4, a)*step(a, 0.6));
    float out_ = step(0.9, r)*step(abs(n.y), 0.5);
    if(n.y > 0.5 && r < 0.48) return vec3(0.5, 0.42, 0.34);   // (the arena's floor and the rooms under it)
    return mix(tr, vec3(0.28, 0.24, 0.2), arch*out_*smoothstep(4., 1.5, px));
  }
  if(q.y > 78. && q.y < 112. && length(q.xz) < 22.) return mix(vec3(0.42, 0.47, 0.53), vec3(0.9, 0.88, 0.84), step(0.88, fract(atan(q.z, q.x)/6.2831853*16.))*smoothstep(3., 1., px));   // (the dome's dark lead and its white ribs: in a pale grey it vanished into an overcast sky)
  return tr;
}
#endif
#ifdef LM_LA
// the Hollywood sign (Hollywood Sign Trust; OpenStreetMap maps each letter): nine white letters 13.7 m tall, each where OpenStreetMap puts
// it, at its own width and angle, standing on the ground under it. They are not in a straight row: they step along the slope of Mount Lee,
// up to 14 m apart front to back, the ground under them 25 m higher at the H than at the D. The frame is the OSM node's: x east, z south;
// SL: each letter's middle (x, z), the bearing it runs toward (radians) and its width (m); uLmY: the ground under each, m above the node's
// (from the drawn heights). Not lit at night. (0.19.0, round 2, owner: the sign was "messed up": one straight sign on the ground at its
// middle had the H buried in the hill and the D in the air)
uniform vec4 uLmY[3];
const vec4 SL[9] = vec4[9](vec4(-47.2, 7.7, 1.5656, 9.6), vec4(-34.4, 11.0, 1.6354, 8.6), vec4(-21.9, 8.6, 1.4416, 9.1), vec4(-12.6, 7.0, 1.4102, 8.5),
  vec4(-3.3, 5.7, 1.4155, 9.2), vec4(8.9, 0.9, 1.4085, 11.0), vec4(21.5, -0.7, 1.5202, 9.6), vec4(34.1, -2.7, 1.4783, 8.8), vec4(48.8, 1.7, 1.6057, 8.5));
vec4 lmBounds(float k){ return vec4(60., -28., 34., 16.); }
float hwGround(int i){ vec4 a = uLmY[i/4]; int r = i - (i/4)*4; return r == 0 ? a.x : r == 1 ? a.y : r == 2 ? a.z : a.w; }
// one letter's distance in its own frame (q.x across it from its middle, q.y up from its foot), its glyph g (0 H, 1 O, 2 L, 3 Y, 4 W, 5 D)
float hwGlyph(vec2 q, int g){
  float d;
  if(g == 0) d = min(min(lmSeg(q, vec2(-3.6, 0.), vec2(-3.6, 13.7)), lmSeg(q, vec2(3.6, 0.), vec2(3.6, 13.7))), lmSeg(q, vec2(-3.6, 6.9), vec2(3.6, 6.9)));
  else if(g == 1) d = abs(length((q - vec2(0., 6.85))/vec2(3.7, 5.75)) - 1.)*3.7;
  else if(g == 2) d = min(lmSeg(q, vec2(-3.4, 0.), vec2(-3.4, 13.7)), lmSeg(q, vec2(-3.4, 1.1), vec2(3.8, 1.1)));
  else if(g == 3) d = min(min(lmSeg(q, vec2(-4., 13.7), vec2(0., 6.4)), lmSeg(q, vec2(4., 13.7), vec2(0., 6.4))), lmSeg(q, vec2(0., 6.4), vec2(0., 0.)));
  else if(g == 4) d = min(min(lmSeg(q, vec2(-4.6, 13.7), vec2(-2.3, 0.)), lmSeg(q, vec2(-2.3, 0.), vec2(0., 9.))), min(lmSeg(q, vec2(0., 9.), vec2(2.3, 0.)), lmSeg(q, vec2(2.3, 0.), vec2(4.6, 13.7))));
  else d = min(lmSeg(q, vec2(-3.4, 0.), vec2(-3.4, 13.7)), q.x > -3.4 ? abs(length((q - vec2(-3.4, 6.85))/vec2(7., 5.75)) - 1.)*5.6 : 1e4);
  return d - 1.05;   // (strokes 2.1 m wide)
}
float lmMap(vec3 p, float k){
  float best = 1e9;
  for(int i=int(uLm2.w);i<9;i++){   // (uLm2.w is a 0 the compiler cannot see, so this stays a loop: ZI is declared further down)
    vec4 L = SL[i]; vec2 dd = p.xz - L.xy, u = vec2(sin(L.z), -cos(L.z)), n = vec2(cos(L.z), sin(L.z));
    float qx = dot(dd, u), qz = dot(dd, n), qy = p.y - hwGround(i), s = L.w/9.6;
    float bx = length(max(abs(vec3(qx, qy - 6.85, qz)) - vec3(L.w*0.5 + 1.2, 6.85 + 1.2, 0.4), 0.));   // (a bound first: only the near letters are drawn in full)
    if(bx > best) continue;
    int g = i == 0 ? 0 : i == 1 || i == 6 || i == 7 ? 1 : i < 4 ? 2 : i == 4 ? 3 : i == 5 ? 4 : 5;
    float d2 = hwGlyph(vec2(qx/s, qy), g)*min(s, 1.);
    d2 = min(d2, max(min(abs(qx - L.w*0.27), abs(qx + L.w*0.27)) - 0.2, max(qy, -qy - 5.)));   // (two posts under each letter, down into the slope)
    best = min(best, max(max(d2, abs(qz) - 0.3), max(qy - 13.7, -qy - 5.)));
  }
  return best;
}
vec3 lmBase(vec3 q, vec3 n, float k, float px, out float glow){ glow = 0.; return vec3(0.96, 0.96, 0.94); }
#endif
#ifdef LM_LV
// Las Vegas (0.22.0, owner: the city "how it is present day"). k 0: the centre of the Strip, four models each where OpenStreetMap maps it
// (uLmP[i]: x, z in this frame, its ground over this frame's foot, the turn of its own frame; uLmB: this group's half-size in x and z):
//   0 the Sphere (Sphere Entertainment: 112 m high, 157 m across, widest 33 m up; about 1.2 million LED pucks 20 cm apart on its outside),
//   1 the High Roller (Caesars, Arup: 167.6 m high, a wheel 158.5 m across, 28 cabins 6.7 m across outside its rim, its hub on a 35 m
//     spindle held by four inclined legs 2.8 m thick and a brace; x along its axle),
//   2 Hard Rock's guitar tower (201 m, 42 floors, topped out on 1 May 2026, opening late 2027: two guitar bodies back to back, 96 m wide and
//     25 m deep as OpenStreetMap maps it, its faces looking north and south; its outline illustrative, its glass hung, not lit yet).
// (Paris Las Vegas's half-scale Eiffel Tower, 164.6 m, is drawn as the slender towers are, a lattice tapering from its feet: a model of
// its own made this copy compile a third slower.) k 1: the Luxor's pyramid (109 m; black glass) and, 700 m to its north-east (uLmP[3]), the
// Athletics' ballpark as it stands in October 2026 (Mortenson-McCarthy, Thornton Tomasetti, the Review-Journal): the seating bowl's steel up,
// and two of the roof's seven truss arches, each nearly 213 m (700 ft) across the field from a buttress on the east side, the second
// reaching close to the roof's 88 m; the shapes simplified, the arches' direction across the field assumed. k 2: the STRAT's tower (350 m: three legs round its core, the pod at about 260 to 290 m,
// the mast; simplified). k 3: the Fremont Street Experience's canopy (a barrel vault 419 m long and 27 m high over the street, its
// underside a screen). uLmS: the Sphere's show (this one, the next, how far into the change) and the Luxor's beam (0..1)
uniform vec4 uLmP[4]; uniform vec4 uLmB; uniform vec4 uLmS;
const float LXB = 92., LXH = 109.;   // (the pyramid's half base and height: its outline in OpenStreetMap, Wikipedia's height)
vec4 lmBounds(float k){ return k < 0.5 ? vec4(uLmB.x, -6., 205., uLmB.y) : k < 1.5 ? vec4(max(LXB + 2., abs(uLmP[3].x) + 116.), -4., LXH + 1., max(LXB + 2., abs(uLmP[3].y) + 116.)) : k < 2.5 ? vec4(32., -4., 351., 32.) : vec4(212., -2., 29., 16.); }
// the ballpark (its own frame: x east, z south, y up from its ground): the bowl rising from the field's edge, lower toward the outfield in
// the west (its glass wall to face the Strip), two arches, the east buttress
float lvPark(vec3 q){
  float r = length(q.xz), lowW = smoothstep(0.3, 0.9, -q.x/max(r, 1.)), top = mix(42., 14., lowW), s = 4. + (top - 4.)*clamp((r - 60.)/46., 0., 1.);
  float d = max(max(60. - r, r - 108.), q.y - s)*0.7;
  float ax = clamp(q.x/106., -1., 1.), sl = 2.*ax/106.;
  d = min(d, max(length(vec2((q.y - 74.*(1. - ax*ax))/sqrt(1. + 74.*74.*sl*sl), q.z + 16.)) - 3.5, abs(q.x) - 108.));
  d = min(d, max(length(vec2((q.y - 80.*(1. - ax*ax))/sqrt(1. + 80.*80.*sl*sl), q.z - 16.)) - 3.5, abs(q.x) - 108.));
  d = min(d, lmBox(q, vec3(104., 15., 0.), vec3(6., 15., 30.)));
  return max(d, -q.y - 2.);
}
vec3 lmPart(vec3 p, int i){ vec4 P = uLmP[i]; return lmRot(p - vec3(P.x, P.z, P.y), P.w); }
// the guitar's half-width at a height: the lower bout about 92 m across at 50 m, the waist 62 m at 118 m, the upper bout 74 m at 160 m, the
// top rounded off at 201 m (illustrative)
float lvGtW(float y){ float w = 31. + 15.*exp(-pow((y - 50.)/45., 2.)) + 6.*exp(-pow((y - 160.)/26., 2.)); return y < 165. ? w : w*sqrt(max(1. - pow((y - 165.)/36., 2.), 0.)); }
float lmMap(vec3 p, float k){
  if(k < 0.5){
    // the Sphere
    vec3 q = lmPart(p, 0);
    float d = max(length(q - vec3(0., 33., 0.)) - 78.5, -q.y - 4.);
    // the High Roller: the rim, the cabins, the hub and spindle, the legs and the brace (the cables only where a pixel is under 1.5 m)
    q = lmPart(p, 1);
    float bw = length(max(abs(q - vec3(40., 84., 0.)) - vec3(58., 86., 88.), 0.));
    if(bw < d){
      vec3 c = q - vec3(0., 84.25, 0.);
      float r = length(c.yz), an = atan(c.z, c.y), st = 6.2831853/28., a = (floor(an/st + 0.5))*st;
      float dw = length(vec2(r - 76., c.x)) - 1.6;
      dw = min(dw, length(c - vec3(0., cos(a)*80., sin(a)*80.)) - 3.35);
      dw = min(dw, lmCap(c, vec3(-17.5, 0., 0.), vec3(17.5, 0., 0.), 2.6));
      vec3 cq = vec3(abs(c.x), c.y, abs(c.z));
      dw = min(dw, lmCap(cq, vec3(16., 0., 0.), vec3(24., -84.25, 30.), 1.4));
      dw = min(dw, lmCap(c, vec3(17., -1., 0.), vec3(96., -84.25, 0.), 1.4));
      if(LMPX < 1.5) dw = min(dw, lmCap(c, vec3(sign(c.x)*17., 0., 0.), vec3(0., cos(a)*76., sin(a)*76.), 0.12));
      d = min(d, dw);
    }
    // the guitar tower: its outline across its faces (x), 25 m deep (z), the edges rounded
    q = lmPart(p, 2);
    float bg = length(max(abs(q - vec3(0., 100., 0.)) - vec3(49., 102., 19.), 0.));
    if(bg < d){
      float dg = (abs(q.x) - lvGtW(clamp(q.y, 0., 201.)))*0.8;
      dg = length(max(vec2(dg, abs(q.z) - 9.5), 0.)) + min(max(dg, abs(q.z) - 9.5), 0.) - 3.;
      d = min(d, max(dg, max(-q.y - 3., q.y - 201.)));
    }
    return d;
  }
  if(k < 1.5){   // the Luxor's pyramid, and the ballpark
    float m = max(abs(p.x), abs(p.z));
    float d = max((m*LXH + p.y*LXB - LXB*LXH)/sqrt(LXH*LXH + LXB*LXB), -p.y - 3.);
    vec3 q = lmPart(p, 3); float bp = length(max(abs(q - vec3(0., 42., 0.)) - vec3(112., 44., 112.), 0.));
    return bp < d ? min(d, lvPark(q)) : d;
  }
  if(k < 2.5){   // the STRAT: three legs round the core, the pod, the mast
    float r = length(p.xz), an = atan(p.z, p.x), st = 2.0943951, a = floor(an/st + 0.5)*st;
    vec2 u = vec2(cos(a), sin(a)), lp = vec2(dot(p.xz, u), dot(p.xz, vec2(-u.y, u.x)));
    float y = p.y, ext = mix(27., 9., pow(clamp(y/250., 0., 1.), 0.55));
    float d = max(r - 8.5, abs(y - 128.) - 132.);
    d = min(d, max(max(lp.x - ext, -lp.x), max(abs(lp.y) - 2.6, abs(y - 125.) - 125.)));
    d = min(d, max(r - mix(10., 24., smoothstep(244., 259., y)), abs(y - 253.) - 9.));
    d = min(d, max(r - 24., abs(y - 272.) - 14.));
    d = min(d, max(r - 26.5, abs(abs(y - 274.) - 6.) - 0.9));
    d = min(d, max(r - mix(24., 12., smoothstep(286., 294., y)), abs(y - 290.) - 4.));
    d = min(d, max(r - mix(3., 1.2, clamp((y - 294.)/56., 0., 1.)), abs(y - 322.) - 28.));
    return d*0.85;
  }
  // the Fremont Street canopy: a barrel vault (its arc's centre 9.9 m up, 17.1 m across, so 27 m at its peak), and the columns under it
  float dc = max(abs(length(vec2(p.z, p.y - 9.9)) - 17.1) - 0.7, max(abs(p.x) - 209.5, 20.5 - p.y));
  vec2 cx = vec2(p.x - (floor(p.x/52.4 + 0.5))*52.4, abs(p.z) - 12.6);
  return min(dc, max(length(cx) - 0.7, max(p.y - 21., abs(p.x) - 210.)));
}
// what the Sphere shows (illustrative: its real shows change; here a few of the atlas's own worlds and the eye it is known for), on its
// unit normal n, the camera's way into it (v), one show (w) and the time (s)
// (noise read with textureLod: texture() in a branch needs gradients, and Direct3D's compiler then unrolled every call, doubling the time)
float lvN(vec3 p){ return textureLod(uNoise, p*(1./64.), 0.).r; }
float lvF(vec3 p){ return (lvN(p)*0.5 + lvN(p*2.03 + vec3(1.7, 9.2, 3.1))*0.25 + lvN(p*4.12 + vec3(4.4, 1.3, 7.7))*0.125)/0.875; }
vec3 lvShow(vec3 n, vec3 v, float w, float tm){
  float lat = asin(clamp(n.y, -1., 1.)), lon = atan(n.z, n.x);
  if(w < 0.5){   // an eye looking about, its lids blinking now and then
    vec3 ax = normalize(vec3(-v.x, -0.1, -v.z) + vec3(0.18*sin(tm*0.31), 0.06*sin(tm*0.53), 0.18*cos(tm*0.27)));
    vec3 sd = normalize(cross(vec3(0., 1., 0.), ax)), u2 = cross(ax, sd);
    float th = acos(clamp(dot(n, ax), -1., 1.)), ex = dot(n, sd), ey = dot(n, u2);
    float bl = smoothstep(0.92, 1., abs(sin(tm*0.52))), lid = mix(0.62, 0.03, bl);
    vec3 skin = vec3(0.86, 0.6, 0.48), c = vec3(0.97, 0.96, 0.94);
    float ir = smoothstep(0.42, 0.4, th), pu = smoothstep(0.17, 0.15, th);
    c = mix(c, mix(vec3(0.1, 0.42, 0.7), vec3(0.32, 0.62, 0.86), 0.5 + 0.5*sin(lon*28.)), ir);
    c = mix(c, vec3(0.02), pu);
    c += vec3(1.)*smoothstep(0.06, 0.03, length(vec2(ex - 0.13, ey - 0.13)));
    float open = step(abs(ey), lid*sqrt(max(1. - ex*ex/0.9, 0.)));
    return mix(skin*(0.6 + 0.4*n.y), c, open*step(abs(ex), 0.95));
  }
  if(w < 1.5){   // the Earth, turning: oceans, land, cloud
    float lo2 = lon + tm*0.05, h = lvF(vec3(cos(lat)*cos(lo2), sin(lat), cos(lat)*sin(lo2))*2.2);
    vec3 c = mix(vec3(0.06, 0.2, 0.52), mix(vec3(0.25, 0.42, 0.18), vec3(0.62, 0.52, 0.34), smoothstep(0.55, 0.7, h)), smoothstep(0.5, 0.52, h));
    c = mix(c, vec3(0.95), smoothstep(0.82, 0.9, abs(n.y)));
    float cl = lvF(vec3(cos(lat)*cos(lo2*1.3 + 1.), sin(lat)*1.6, cos(lat)*sin(lo2*1.3 + 1.))*3.1 + 7.);
    return mix(c, vec3(0.96), smoothstep(0.56, 0.7, cl)*0.85);
  }
  if(w < 2.5){   // the Moon: its seas and craters
    float h = lvF(n*2.6 + 3.), cr = lvF(n*9. + 11.);
    vec3 c = mix(vec3(0.72, 0.71, 0.68), vec3(0.36, 0.36, 0.38), smoothstep(0.5, 0.62, h));
    return c*(0.85 + 0.3*smoothstep(0.55, 0.75, cr));
  }
  // Jupiter: its bands and the Great Red Spot, turning
  float lo3 = lon + tm*0.08, b = sin(lat*13. + 0.6*lvF(vec3(lo3*2., lat*6., 1.)));
  vec3 c = mix(vec3(0.86, 0.78, 0.66), vec3(0.62, 0.42, 0.3), smoothstep(-0.2, 0.6, b));
  vec2 gs = vec2(mod(lo3 + 3.1416, 6.2832) - 3.1416 - 0.6, lat + 0.38)*vec2(1., 2.2);
  return mix(c, vec3(0.78, 0.32, 0.2), smoothstep(0.26, 0.2, length(gs)));
}
vec3 lmBase(vec3 q, vec3 n, float k, float px, out float glow){
  glow = 0.;
  if(k < 0.5){
    vec4 P0 = uLmP[0], P1 = uLmP[1], P3 = uLmP[2];
    vec3 q0 = lmRot(q - vec3(P0.x, P0.z, P0.y), P0.w);
    if(length(q0 - vec3(0., 33., 0.)) < 80.){   // the Sphere's screen: dark pucks by day where a pixel resolves them, its show
      vec3 sn = normalize(q0 - vec3(0., 33., 0.)), v = normalize(lmRot(LMD, P0.w));
      float tm = uLm2.y, f = uLmS.z;   // (one show at a time, the change a dip through dark: two shows a pixel doubled the compile time)
      vec3 sh = lvShow(sn, v, f < 0.5 ? uLmS.x : uLmS.y, tm)*(0.15 + 0.85*abs(1. - 2.*f));
      vec2 g = vec2(atan(sn.z, sn.x)*78.5*cos(asin(clamp(sn.y, -1., 1.))), asin(clamp(sn.y, -1., 1.))*78.5)/0.2;
      float pk = mix(1., 1.6*smoothstep(0.42, 0.28, length(fract(g) - 0.5)), smoothstep(0.3, 0.12, px));
      LMEM = sh*pk*mix(0.62, 0.8, uLm2.x);
      return vec3(0.16, 0.16, 0.17);
    }
    vec3 q1 = lmRot(q - vec3(P1.x, P1.z, P1.y), P1.w);
    if(abs(q1.x - 40.) < 60. && length(q1.yz - vec2(84.25, 0.)) < 86.5){   // the High Roller: white steel, the cabins' glass; its rim lit at night in colours that run round it
      vec3 c = q1 - vec3(0., 84.25, 0.); float r = length(c.yz), an = atan(c.z, c.y);
      if(r > 78.5 && abs(c.x) < 4.) return vec3(0.55, 0.62, 0.66);
      if(abs(r - 76.) < 2.5 && abs(c.x) < 3.){ float hu = an*2. + uLm2.y*0.4; LMEM = (0.5 + 0.5*cos(vec3(0., 2.1, 4.2) + hu))*0.75*uLm2.x; }
      return vec3(0.9, 0.9, 0.88);
    }
    // the guitar tower: dark blue-grey glass, a light band round each face's edge (the guitar's binding)
    vec3 q3 = lmRot(q - vec3(P3.x, P3.z, P3.y), P3.w);
    float ed = lvGtW(clamp(q3.y, 0., 201.)) - abs(q3.x);
    glow = 0.04;
    vec3 n3 = lmRot(n, P3.w);
    return abs(n3.z) > 0.7 && ed < 4. ? vec3(0.86, 0.85, 0.82) : abs(n3.z) > 0.7 ? vec3(0.26, 0.32, 0.38) : vec3(0.7, 0.71, 0.72);
  }
  if(k < 1.5){   // the Luxor's black glass; the ballpark's concrete and steel, a few work lights at night
    vec3 q4 = lmRot(q - vec3(uLmP[3].x, uLmP[3].z, uLmP[3].y), uLmP[3].w);
    // (pale concrete for the bowl, warm brown steel for the arches and the buttress: in greys they vanished into the city behind them)
    if(length(q4.xz) < 125.){ glow = 0.12; return q4.y > 44. || q4.x > 97. ? vec3(0.62, 0.44, 0.34) : vec3(0.86, 0.83, 0.76); }   // (the arches dark steel trusses about 7 m deep, the bowl pale concrete)
    return vec3(0.17, 0.17, 0.19);
  }
  if(k < 2.5){   // the STRAT: white concrete, the pod's glass bands lit at night
    if(q.y > 244. && q.y < 296.){ float bd = step(0.5, fract(q.y/4.)); glow = 0.9; LMEM = vec3(0.75, 0.85, 1.)*bd*0.5*uLm2.x; return mix(vec3(0.9), vec3(0.3, 0.38, 0.46), bd); }
    glow = 0.45; return vec3(0.9, 0.89, 0.86);
  }
  // the Fremont Street canopy: grey above; its underside a screen, lit at night, and its light showing through the open frame from above
  float hu = q.x*0.03 + uLm2.y*0.7; vec3 sc = 0.55 + 0.45*cos(vec3(0., 2.1, 4.2) + hu + q.z*0.2);
  if(n.y < -0.2 || length(vec2(q.z, q.y - 9.9)) < 16.6){ LMEM = sc*0.9*uLm2.x; return vec3(0.3); }
  LMEM = sc*0.3*uLm2.x;
  return vec3(0.72, 0.73, 0.74);
}
#endif
#ifdef LM_RIO
// Christ the Redeemer (Santuario Cristo Redentor): 30 m tall on an 8 m pedestal, its arms 28 m across, on the top of Corcovado; x along its
// arms, z the way it faces (east-northeast, over the city and the bay). Soapstone, floodlit at night
vec4 lmBounds(float k){ return vec4(15.5, -1., 38.5, 6.); }
float lmMap(vec3 p, float k){
  float d = lmBox(p, vec3(0., 4., 0.), vec3(4.5, 4., 4.5));   // (the pedestal)
  float y = clamp(p.y, 8., 31.), u = (y - 8.)/23., hw = mix(4.2, 2.8, u), hd = mix(3.1, 1.9, u);
  d = min(d, max((length(vec2(p.x/hw, p.z/hd)) - 1.)*min(hw, hd), max(8. - p.y, p.y - 32.)));   // (the robe)
  d = min(d, lmCap(p, vec3(-13.6, 31.4, 0.), vec3(13.6, 31.4, 0.), 1.1 + 1.1*smoothstep(9., 2., abs(p.x))));   // (the arms, the sleeves hanging near the body)
  d = min(d, length((p - vec3(0., 35.6, 0.25))/vec3(1., 1.3, 1.)) - 1.8);   // (the head)
  return d*0.85;
}
vec3 lmBase(vec3 q, vec3 n, float k, float px, out float glow){ glow = 0.85; return q.y < 8. ? vec3(0.62, 0.6, 0.56) : vec3(0.9, 0.9, 0.86); }
#endif
#ifdef TOKYO
// Tokyo Tower and the Tokyo Skytree as models (0.14.0, owner's pick), only in P.sxEnvTk, the copy used near Tokyo. Real sizes: Tokyo Tower
// 332.9 m, 80 m across at the ground, the Main Deck at 150 m and the Top Deck at 249.6 m (Wikipedia); the Skytree 634 m, a triangle 68 m a
// side at the ground whose section turns round by about 300 m, the Tembo Deck at 340 to 350 m and the Tembo Galleria at 445 to 451 m
// (tokyo-skytree.jp). The curves between, the lattices and Tokyo Tower's bands are illustrative. uTk0 / uTk1: each one's foot (x, z) in
// this frame, the ground there (m above the sea), the turn of its faces; uTk2: Tokyo Tower's lights (0..1), the Skytree's (0..1), the
// Skytree's style tonight (0 Iki, light blue; 1 Miyabi, purple), Tokyo Tower's (0 orange, its winter Landmark Light; 1 white, summer)
uniform vec4 uTk0; uniform vec4 uTk1; uniform vec4 uTk2;
float tkBox(vec3 p, vec3 c, vec3 b){ vec3 q = abs(p - c) - b; return length(max(q, 0.)) + min(max(q.x, max(q.y, q.z)), 0.); }
vec3 tkRot(vec3 v, float a){ float c = cos(a), s = sin(a); return vec3(c*v.x + s*v.z, v.y, -s*v.x + c*v.z); }
float ttW(float y){ return 3.5 + 36.5*exp(-y/100.); }   // (Tokyo Tower's half-width: 40 m at the ground, 11.6 at the Main Deck, 6.5 at the Top Deck)
float skRc(float y){ return y < 300. ? mix(25.5, 16.5, y/300.) : max(16.5 - (y - 300.)*0.018, 12.); }   // (the Skytree's mean radius)
// k 0: Tokyo Tower, 1: the Skytree; p in its own frame, m from its foot
float tkMap(vec3 p, float k){
  float y = p.y;
  if(k < 0.5){
    vec2 a = abs(p.xz); float w = ttW(clamp(y, 0., 252.)), m = max(a.x, a.y), n = min(a.x, a.y), wi = 27.*pow(max(1. - y/62., 0.), 1.2);
    float d = max(max(m - w, wi - n)*0.8, max(-y, y - 252.));
    d = min(d, tkBox(p, vec3(0., 148., 0.), vec3(15., 4.5, 15.)));
    d = min(d, tkBox(p, vec3(0., 249.6, 0.), vec3(7.5, 2.6, 7.5)));
    d = min(d, tkBox(p, vec3(0., 9., 0.), vec3(30., 9., 30.)));   // (FootTown, the building under its legs)
    d = min(d, max(max(a.x, a.y) - mix(3.2, 1.1, clamp((y - 252.)/68., 0., 1.)), abs(y - 286.) - 34.)*0.9);
    return min(d, max(length(p.xz) - 0.6, abs(y - 326.5) - 6.5));
  }
  // (the Skytree: a section blending from an equilateral triangle to a circle up to 300 m; the decks; the mast from 495 m)
  float rc = skRc(clamp(y, 0., 495.)), ri = rc/1.3;
  vec2 q = p.xz; float tri = max(max(q.y, dot(q, vec2(0.866, -0.5))), dot(q, vec2(-0.866, -0.5))) - ri;
  float d = max(mix(tri, length(q) - rc, smoothstep(0., 300., y))*0.85, max(-y, y - 495.));
  d = min(d, max(length(q) - 24., abs(y - 346.) - 11.));   // (the Tembo Deck)
  d = min(d, max(length(q) - 18.5, abs(y - 448.) - 6.));   // (the Tembo Galleria)
  d = min(d, max(length(q) - mix(6., 3., clamp((y - 495.)/130., 0., 1.)), abs(y - 560.) - 65.));
  return min(d, max(length(q) - 0.8, abs(y - 629.) - 5.));
}
// the lattice on a face (uu along it): 1 on a member, 0 in a gap; k how well a pixel resolves it
float tkLat(vec3 q, float uu, float px, float P, out float k){
  float l1 = abs(fract((uu + q.y)/P) - 0.5), l2 = abs(fract((uu - q.y)/P) - 0.5), l3 = abs(fract(q.y/(2.*P)) - 0.5);
  k = smoothstep(0.5, 0.2, px/P); return smoothstep(0.36, 0.48, max(max(l1, l2), l3));
}
#endif
#ifdef EIFFEL
// the Eiffel Tower as a model (0.13.0, owner: drawn from the heights it was "a random triangle"), only in P.sxEnvEf, the copy of this
// shader used near Paris (built in the background: the rest of the world never compiles it). Its real sizes (toureiffel.paris, Wikipedia):
// the legs at the corners of a 125 m square, the floors at 57.6, 115.7 and 276.1 m (70.7, 41 and 16.5 m across), 300 m to the top of the
// structure, 330 m with the antenna of 2022. The outer edge's curve is fitted through the floors (the half-width 2.9 + 59.6 e^(-y/94.8) m);
// the four legs part below about 120 m, with an arch on each face (35 m half-span, 39 m high) under the first floor. The lattice is a
// pattern of braces on the faces (illustrative). uEf0: its foot (x, z) in this frame, the ground there (m above the sea), the turn of its
// faces; uEf1: the gold lights (0..1), the sparkle (0..1), a clock for the sparkle (s)
uniform vec4 uEf0; uniform vec4 uEf1;
float efW(float y){ return 2.9 + 59.6*exp(-y/94.8); }
vec3 efLoc(vec3 v){ float c = cos(uEf0.w), s = sin(uEf0.w); return vec3(c*v.x + s*v.z, v.y, -s*v.x + c*v.z); }
vec3 efWor(vec3 v){ float c = cos(uEf0.w), s = sin(uEf0.w); return vec3(c*v.x - s*v.z, v.y, s*v.x + c*v.z); }
float efBox(vec3 p, vec3 c, vec3 b){ vec3 q = abs(p - c) - b; return length(max(q, 0.)) + min(max(q.x, max(q.y, q.z)), 0.); }
// (distances in metres from its foot, y up; the faces lean in, so the distances along them are scaled down for the march)
float efMap(vec3 p){
  vec2 a = abs(p.xz); float y = p.y, w = efW(clamp(y, 0., 300.)), m = max(a.x, a.y), n = min(a.x, a.y);
  float wi = 37.*pow(max(1. - y/122., 0.), 1.1);   // (the gap between the legs: 74 m at the ground, closed at about 120 m)
  float d = max(max(m - w, wi - n)*0.8, max(-y, y - 300.));
  float aY = 39.*sqrt(max(1. - (n/35.)*(n/35.), 0.));   // (the arch under the first floor, a 2 m skin on each face between the legs)
  d = min(d, max(max(abs(m - w + 1.) - 1., n - wi), max(aY - y, y - 57.))*0.8);
  d = min(d, efBox(p, vec3(0., 54.5, 0.), vec3(37.5, 4., 37.5)));   // (the floors)
  d = min(d, efBox(p, vec3(0., 115.5, 0.), vec3(21.5, 2.8, 21.5)));
  d = min(d, efBox(p, vec3(0., 276.3, 0.), vec3(8.4, 2.6, 8.4)));
  d = min(d, efBox(p, vec3(0., 288.5, 0.), vec3(3.6, 9.5, 3.6)));   // (the top and the antenna)
  return min(d, max(length(p.xz) - 1.1, abs(y - 315.) - 15.));
}
#endif
// (which city, 0.13.0: x 0 Paris, 1 New York, 2 Tokyo, 3 Dubai, 4 London, 5 to 10 the cities of 0.19.0 (CITY_KEYS in s3-spacex.js), -1 none; y the ground at its centre, m above the sea; z 1 at a
// famous place, 0.15.0: its water keeps the images' colours)
uniform vec4 uCity;
// a building's materials in a city, after each city's common ones and a little brighter than life so they read as characters (illustrative,
// owner, 0.13.0: "add colours to the buildings to mirror what it would realistically look like"): its walls by a hash of where it stands,
// its roof; towers over 120 m are glass
void cityMat(float k, float tall, float hsh, out vec3 wc, out vec3 rc){
  if(k < 0.5){        // Paris: cream limestone, a little brick, blue-grey zinc roofs
    wc = hsh < 0.8 ? vec3(0.88, 0.81, 0.66) : hsh < 0.9 ? vec3(0.94, 0.9, 0.8) : vec3(0.66, 0.45, 0.35); rc = vec3(0.56, 0.62, 0.7);
  } else if(k < 1.5){ // New York: brick, brownstone, limestone, concrete, glass
    wc = hsh < 0.3 ? vec3(0.66, 0.38, 0.28) : hsh < 0.45 ? vec3(0.52, 0.37, 0.3) : hsh < 0.7 ? vec3(0.84, 0.79, 0.68) : hsh < 0.85 ? vec3(0.7, 0.7, 0.7) : vec3(0.5, 0.63, 0.76); rc = vec3(0.46, 0.46, 0.48);
  } else if(k < 2.5){ // Tokyo: white and grey concrete, beige tile, glass
    wc = hsh < 0.4 ? vec3(0.9, 0.9, 0.88) : hsh < 0.7 ? vec3(0.74, 0.75, 0.76) : hsh < 0.85 ? vec3(0.82, 0.76, 0.66) : vec3(0.56, 0.68, 0.8); rc = vec3(0.72, 0.73, 0.74);
  } else if(k < 3.5){ // Dubai: sand, white, blue-silver glass
    wc = hsh < 0.5 ? vec3(0.9, 0.8, 0.62) : hsh < 0.75 ? vec3(0.94, 0.93, 0.9) : vec3(0.52, 0.68, 0.82); rc = vec3(0.86, 0.8, 0.68);
  } else if(k < 4.5){ // London: red-brown brick, yellow stock brick, Portland stone, glass; slate roofs
    wc = hsh < 0.35 ? vec3(0.68, 0.4, 0.3) : hsh < 0.5 ? vec3(0.8, 0.69, 0.5) : hsh < 0.8 ? vec3(0.9, 0.87, 0.78) : vec3(0.52, 0.64, 0.76); rc = vec3(0.47, 0.49, 0.54);
  } else if(k < 5.5){ // Hong Kong (0.19.0): white and grey concrete, pale tile, blue-green glass
    wc = hsh < 0.35 ? vec3(0.86, 0.86, 0.84) : hsh < 0.55 ? vec3(0.7, 0.71, 0.72) : hsh < 0.7 ? vec3(0.84, 0.76, 0.7) : vec3(0.5, 0.66, 0.7); rc = vec3(0.62, 0.63, 0.64);
  } else if(k < 6.5){ // San Francisco: pale stucco, painted wood in pastels, grey stone, glass
    wc = hsh < 0.35 ? vec3(0.9, 0.88, 0.82) : hsh < 0.5 ? vec3(0.78, 0.84, 0.86) : hsh < 0.62 ? vec3(0.88, 0.78, 0.74) : hsh < 0.8 ? vec3(0.74, 0.73, 0.71) : vec3(0.52, 0.64, 0.76); rc = vec3(0.6, 0.6, 0.62);
  } else if(k < 7.5){ // Sydney: golden sandstone, red-brown brick, white render, glass; terracotta tile roofs
    wc = hsh < 0.25 ? vec3(0.86, 0.72, 0.5) : hsh < 0.5 ? vec3(0.66, 0.42, 0.32) : hsh < 0.75 ? vec3(0.9, 0.88, 0.84) : vec3(0.52, 0.66, 0.76); rc = vec3(0.74, 0.46, 0.34);
  } else if(k < 8.5){ // Rome: ochre, terracotta and cream plaster, travertine; terracotta tile roofs
    wc = hsh < 0.3 ? vec3(0.86, 0.64, 0.4) : hsh < 0.55 ? vec3(0.78, 0.48, 0.34) : hsh < 0.8 ? vec3(0.9, 0.82, 0.66) : vec3(0.84, 0.78, 0.66); rc = vec3(0.76, 0.46, 0.33);
  } else if(k < 9.5){ // Los Angeles: white and beige stucco, pink and tan render, glass
    wc = hsh < 0.35 ? vec3(0.92, 0.9, 0.86) : hsh < 0.55 ? vec3(0.86, 0.78, 0.66) : hsh < 0.7 ? vec3(0.88, 0.74, 0.7) : vec3(0.54, 0.66, 0.78); rc = vec3(0.8, 0.79, 0.76);
  } else if(k < 10.5){ // Rio de Janeiro: white and pastel concrete, red brick of the hillside favelas, glass
    wc = hsh < 0.35 ? vec3(0.9, 0.9, 0.88) : hsh < 0.55 ? vec3(0.86, 0.8, 0.66) : hsh < 0.75 ? vec3(0.74, 0.46, 0.34) : vec3(0.54, 0.68, 0.76); rc = vec3(0.64, 0.64, 0.64);
  } else {            // Las Vegas (0.22.0): cream and white render, desert tan, glass; the resorts' towers in gold, bronze, white and blue glass
    wc = hsh < 0.35 ? vec3(0.92, 0.88, 0.8) : hsh < 0.6 ? vec3(0.84, 0.74, 0.6) : hsh < 0.8 ? vec3(0.94, 0.93, 0.9) : vec3(0.56, 0.68, 0.78); rc = vec3(0.82, 0.81, 0.78);
    if(tall > 0.5){ wc = hsh < 0.25 ? vec3(0.9, 0.74, 0.42) : hsh < 0.45 ? vec3(0.66, 0.46, 0.32) : hsh < 0.7 ? vec3(0.92, 0.91, 0.88) : vec3(0.5, 0.64, 0.8); return; }
  }
  if(tall > 0.5) wc = k > 2.5 && k < 3.5 ? vec3(0.55, 0.7, 0.84) : vec3(0.52, 0.65, 0.78);
}
int ZI = 0;   // (a 0 the compiler cannot see, set in main from a uniform, so the loops stay loops)
float CALT = 0., DIP = 0.;   // the height of the camera above the sea (m), and how far below level the horizon lies (radians, about)
vec3 unTone(vec3 c){ return -log(1. - clamp(c, 0., 0.985)); }
// where a ray meets the sea-level curve (y = -e - r^2/2R), or -1
float curveT(vec3 o, vec3 d, float e){
  o.y += e;
  float A = dot(d.xz, d.xz)/(2.*RE), B = d.y + dot(o.xz, d.xz)/RE, C = o.y + dot(o.xz, o.xz)/(2.*RE);
  float D = B*B - 4.*A*C; if(D < 0.) return -1.;
  float q = -0.5*(B + sign(B)*sqrt(D)); float t1 = A > 1e-18 ? q/A : -1., t2 = C/q;
  float t = 1e30; if(t1 > 0.) t = t1; if(t2 > 0.) t = min(t, t2);
  return t < 1e29 ? t : -1.;
}
// a point of the ground plane at (x, z): its place on the sea-level sphere, in the layers' frame
vec3 seaPt(vec2 xz){ return vec3(xz.x, -uP4.y - dot(xz, xz)/(2.*RE), xz.y); }
// the height of whatever is at (x, z), as a y in this frame
float groundY(vec2 xz, out float water, out float ok){ vec3 P = seaPt(xz); float h = edHeight(P, water, ok), y = P.y + max(h, 0.); THIN = 0.;
  for(int i=ZI;i<4;i++){
    if(float(i) >= uThinN) break;
#if defined(EIFFEL) || defined(TOKYO) || defined(LM)
    if(uThinB[i].z > 1.5) continue;
#endif
    vec4 a = uThin[i]; vec2 q = abs(xz - a.xy); float r = max(q.x, q.y), R = uThinB[i].x;
    if(r < R){ float th = uThinB[i].y > 0.5 ? a.w : min(a.w, a.w*log(R/max(r, 0.5))/log(R/1.5)), ty = P.y + a.z + th;
      if(ty > y){ y = ty; THIN = 1.; ok = 1.; water = 0.; } }
  }
  return y; }
#ifdef LM
// where the ray meets a landmark (-1: none before tMax), its normal in its own frame, which one (kk) and the point in its frame. The march and
// the normal's four samples share one loop, so lmMap is compiled once (as for the Eiffel Tower)
float lmHit(vec3 o, vec3 d, float tMax, out vec3 nl, out float kk, out vec3 ql){
  nl = vec3(0., 1., 0.); kk = 0.; ql = vec3(0.); float best = -1.;
  for(int j=ZI;j<LM_N;j++){
    if(float(j) >= uLm2.z) break;
    float k = float(j); vec4 U = lmU(j), bb = lmBounds(k);
    vec3 B = vec3(U.x, seaPt(U.xy).y + U.z, U.y), ol = lmRot(o - B, U.w), dl = lmRot(d, U.w);
    vec3 iv = 1./(dl + vec3(dl.x < 0. ? -1e-7 : 1e-7, dl.y < 0. ? -1e-7 : 1e-7, dl.z < 0. ? -1e-7 : 1e-7));
    vec3 t0 = (vec3(-bb.x, bb.y, -bb.w) - ol)*iv, t1 = (vec3(bb.x, bb.z, bb.w) - ol)*iv, tn = min(t0, t1), tf = max(t0, t1);
    float ta = max(max(tn.x, tn.y), max(tn.z, 0.)), tb = min(min(tf.x, tf.y), min(tf.z, best > 0. ? best : tMax));
    if(ta >= tb) continue;
    float t = ta; int hi = -1; vec3 ph = vec3(0.), n = vec3(0.); float ep = 0.; LMD = dl;
    for(int i=ZI;i<124;i++){
      int mm = hi < 0 ? -1 : i - hi - 1;
      vec3 kv = mm == 0 ? vec3(1., -1., -1.) : mm == 1 ? vec3(-1., -1., 1.) : mm == 2 ? vec3(-1., 1., -1.) : vec3(1.), p = mm < 0 ? ol + dl*t : ph + kv*ep;
      LMPX = t*uPix;
      float h = lmMap(p, k);
      if(mm >= 0){ n += kv*h; if(mm == 3) break; continue; }
      float pw = t*uPix*0.6;
      if(h < pw){ hi = i; ph = p; ep = max(0.06, t*uPix*0.5); continue; }
      t += max(h, pw*0.5); if(t > tb) break;
    }
    if(hi < 0) continue;
    best = t; nl = normalize(n + vec3(0., 1e-6, 0.)); kk = k; ql = ph;
  }
  LMPX = best*uPix;
  return best;
}
#endif
#ifdef TOKYO
// where the ray meets Tokyo Tower or the Skytree (-1: neither before tMax): the nearer of the two, its normal in its own frame, which (k),
// and the point in its frame. The lattices' gaps let the ray through where a pixel resolves them, as for the Eiffel Tower
float tkHit(vec3 o, vec3 d, float tMax, out vec3 nl, out float kk, out vec3 ql){
  nl = vec3(0., 1., 0.); kk = 0.; ql = vec3(0.); float best = -1.;
  for(int j=ZI;j<2;j++){
    float k = float(j); vec4 U = j == 0 ? uTk0 : uTk1; float H = k < 0.5 ? 334. : 635., W = k < 0.5 ? 42. : 41.;
    vec3 B = vec3(U.x, seaPt(U.xy).y + U.z, U.y), ol = tkRot(o - B, U.w), dl = tkRot(d, U.w);
    vec3 iv = 1./(dl + vec3(dl.x < 0. ? -1e-7 : 1e-7, dl.y < 0. ? -1e-7 : 1e-7, dl.z < 0. ? -1e-7 : 1e-7));
    vec3 t0 = (vec3(-W, -1., -W) - ol)*iv, t1 = (vec3(W, H, W) - ol)*iv, tn = min(t0, t1), tf = max(t0, t1);
    float ta = max(max(tn.x, tn.y), max(tn.z, 0.)), tb = min(min(tf.x, tf.y), min(tf.z, best > 0. ? best : tMax));
    if(ta >= tb) continue;
    float t = ta; int hi = -1; vec3 ph = vec3(0.), n = vec3(0.); float ep = 0.;
    for(int i=ZI;i<114;i++){
      int mm = hi < 0 ? -1 : i - hi - 1;
      vec3 kv = mm == 0 ? vec3(1., -1., -1.) : mm == 1 ? vec3(-1., -1., 1.) : mm == 2 ? vec3(-1., 1., -1.) : vec3(1.), p = mm < 0 ? ol + dl*t : ph + kv*ep;
      float h = tkMap(p, k);
      if(mm >= 0){ n += kv*h; if(mm == 3) break; continue; }
      float pw = t*uPix*0.6;
      if(h < pw){
        // (the lattice's gaps: on Tokyo Tower's legs and shaft; the Skytree's lattice is dense round its core, and from any distance it reads
        // as a solid pale tower: see-through, it came out as a few thin lines)
        float kL, ang = atan(p.z, p.x), P = k < 0.5 ? max(1.6, 0.17*ttW(clamp(p.y, 0., 252.))) : 7., uu = k < 0.5 ? (abs(p.x) > abs(p.z) ? p.z : p.x) : ang*skRc(clamp(p.y, 0., 495.));
        bool open = k < 0.5 && p.y > 19. && p.y < 250. && abs(p.y - 148.) > 5.;
        float lat = tkLat(p, uu, t*uPix, P, kL);
        if(open && kL > 0.6 && lat < 0.5){ t += max(pw*2., 0.6); continue; }
        hi = i; ph = p; ep = max(0.12, t*uPix*0.5); continue; }
      t += h*0.85; if(t > tb) break; }
    if(hi < 0) continue;
    best = t; nl = normalize(n + vec3(0., 1e-6, 0.)); kk = k; ql = ph;
  }
  return best;
}
#endif
#ifdef EIFFEL
// the lattice at q on a face (uu: along the face): braces crossing and a girder every panel, the panels smaller toward the top; 1 on a girder,
// 0 in a gap. k: how well a pixel resolves it (it fades to its average, 0.45, where a pixel covers half a panel or more)
float efLat(vec3 q, float uu, float px, out float k){
  float P = max(1.6, 0.17*efW(clamp(q.y, 0., 300.)));
  float l1 = abs(fract((uu + q.y)/P) - 0.5), l2 = abs(fract((uu - q.y)/P) - 0.5), l3 = abs(fract(q.y/(2.*P)) - 0.5);
  k = smoothstep(0.5, 0.2, px/P); return smoothstep(0.36, 0.48, max(max(l1, l2), l3));
}
// which way a point on a leg or the shaft runs along its face (the coordinate across the face it is nearest)
float efU(vec3 q){ vec2 a = abs(q.xz); float w = efW(clamp(q.y, 0., 300.)), wi = 37.*pow(max(1. - q.y/122., 0.), 1.1);
  return min(abs(a.x - w), abs(a.x - wi)) < min(abs(a.y - w), abs(a.y - wi)) ? q.z : q.x; }
// whether a point is on the lattice of the legs or the shaft (not a floor, the arch, the top or the antenna)
bool efOpen(vec3 q){ float y = q.y; vec2 a = abs(q.xz);
  return y > 1. && y < 272. && abs(y - 54.5) > 4.5 && abs(y - 115.5) > 3.2 && !(y < 58. && min(a.x, a.y) < 37.*pow(max(1. - y/122., 0.), 1.1) + 0.5); }
// where the ray meets it (-1 if nowhere before tMax), and its normal there in its own frame. Where the lattice's gaps are big enough to
// see, the ray goes on through them, to the girders behind or past the tower (the real tower is mostly air)
float efHit(vec3 o, vec3 d, float tMax, out vec3 nl){
  nl = vec3(0., 1., 0.);
  vec3 B = vec3(uEf0.x, seaPt(uEf0.xy).y + uEf0.z, uEf0.y), ol = efLoc(o - B), dl = efLoc(d);
  vec3 iv = 1./(dl + vec3(dl.x < 0. ? -1e-7 : 1e-7, dl.y < 0. ? -1e-7 : 1e-7, dl.z < 0. ? -1e-7 : 1e-7));
  vec3 t0 = (vec3(-64., -1., -64.) - ol)*iv, t1 = (vec3(64., 331., 64.) - ol)*iv, tn = min(t0, t1), tf = max(t0, t1);
  float ta = max(max(tn.x, tn.y), max(tn.z, 0.)), tb = min(min(tf.x, tf.y), min(tf.z, tMax));
  if(ta >= tb) return -1.;
  // (the march and, after a hit, the normal's four samples in one loop: efMap is compiled once; on Direct3D each place it is called from is
  // compiled on its own, and two took the Paris copy's compile from about 3 to 4 s)
  float t = ta; int hi = -1; vec3 ph = vec3(0.), n = vec3(0.); float ep = 0.;
  for(int i=ZI;i<100;i++){
    int m = hi < 0 ? -1 : i - hi - 1;
    vec3 kv = m == 0 ? vec3(1., -1., -1.) : m == 1 ? vec3(-1., -1., 1.) : m == 2 ? vec3(-1., 1., -1.) : vec3(1.), p = m < 0 ? ol + dl*t : ph + kv*ep;
    float h = efMap(p);
    if(m >= 0){ n += kv*h; if(m == 3) break; continue; }
    float pw = t*uPix*0.6;
    if(h < pw){ float k, l = efLat(p, efU(p), t*uPix, k); if(k > 0.6 && l < 0.5 && efOpen(p)){ t += max(pw*2., 0.6); continue; } hi = i; ph = p; ep = max(0.12, t*uPix*0.5); continue; }
    t += h*0.85; if(t > tb) break; }
  if(hi < 0) return -1.;
  nl = normalize(n + vec3(0., 1e-6, 0.)); return t;
}
#endif
// the sky as it shows in direction r (day 0..1): deep blue overhead, paler toward the horizon (whiter when the air is hazy), both fading as
// the air thins below the camera; gold round a low Sun and along that side of the horizon; at dusk and dawn, the Earth's grey-blue shadow
// low on the far side with the pink band above it (the Belt of Venus); the Sun, in a halo that grows with haze
vec3 skyCol(vec3 r, vec3 L, float day){
  float thin = exp(-CALT/8500.), el = r.y - DIP, mu = dot(r, L), mz = max(mu, 0.), sunE = L.y;
  float hazy = clamp(1. - uWx0.w/40000., 0., 0.8);
  float hb = exp(-max(el, 0.)*mix(22., mix(3.2, 2.3, hazy), thin));
  vec3 zen = vec3(0.08, 0.19, 0.46)*mix(0.03, 1., thin), hor = mix(vec3(0.42, 0.53, 0.67), vec3(0.62, 0.67, 0.72), hazy)*mix(0.4, 1., thin);
  vec3 c = mix(zen, hor, hb)*day;
  vec2 rh = normalize(r.xz + vec2(1e-5, 0.)), lh = normalize(L.xz + vec2(1e-5, 0.));
  float toward = pow(max(dot(rh, lh), 0.), 2.), away = pow(max(-dot(rh, lh), 0.), 1.5);
  float low = smoothstep(0.35, 0.02, sunE)*smoothstep(-0.18, 0., sunE);
  c += vec3(0.78, 0.4, 0.13)*low*hb*(0.15 + 0.85*toward)*0.85*thin;
  float dusk = smoothstep(0.12, 0., sunE)*smoothstep(-0.2, -0.02, sunE);
  c += vec3(0.55, 0.3, 0.38)*dusk*away*smoothstep(0., 0.04, el)*exp(-max(el - 0.04, 0.)*12.)*0.55*thin;
  c *= 1. - 0.35*dusk*away*smoothstep(0.03, 0., el);   // (the Earth's shadow)
  // (the Sun: a disc about 1.2 degrees across, twice the real one so it reads as more than a character)
  c += vec3(1., 0.93, 0.8)*(pow(mz, 16.)*(0.08 + 0.3*hazy)*(0.3 + 0.7*thin) + pow(mz, 300.)*0.22 + pow(mz, 12000.)*3.)*smoothstep(-0.04, 0.02, sunE);
  return c;
}
// ---------------------------------------------------------------- the clouds (CLOUD_GLSL) as this shader sees them
float altOf(vec3 p, float e){ return p.y + e + dot(p.xz, p.xz)/(2.*RE); }
// how much of the air's haze lies between the camera and a point t away (the real visibility, uWx0.w)
float hazeF(float t, float thin){ return (1. - exp(-t*0.7/max(uWx0.w, 3000.)*mix(0.35, 1., thin)))*0.92; }
// the low layer along a ray up to tMax: marched in 16 steps within the slab, the light that reaches each sample worked out from the cloud
// between it and the Sun (two coarse samples), bright edges toward the Sun (the silver lining), dark undersides, hazed with distance
vec4 layerLow(vec3 o, vec3 d, float e, float tMax, vec3 L, float lit, vec3 sunC, vec3 hz, float thin, out float tIn){
  tIn = 1e9; vec3 col = vec3(0.); float T = 1.;
  if(uWx0.x < 0.01) return vec4(col, T);
  float b = uWx1.x, tp = uWx1.y, tB = curveT(o, d, e - b), tT = curveT(o, d, e - tp), t0, t1;
  if(CALT < b){ t0 = tB; t1 = tT; } else if(CALT > tp){ t0 = tT; t1 = tB > 0. ? tB : t0 + 40000.; } else { t0 = 0.; t1 = min(tB > 0. ? tB : 1e9, tT > 0. ? tT : 1e9); }
  if(t0 < 0. || t0 > min(tMax, 90000.)) return vec4(col, T);
  if(t1 < 0.) t1 = t0 + 40000.;
  t1 = min(min(t1, tMax), t0 + 40000.);
  if(t1 <= t0) return vec4(col, T);
  tIn = t0;
  float dt = (t1 - t0)/16., ph = 0.6 + 1.3*pow(max(dot(d, L), 0.), 8.);
  for(int i=ZI;i<16;i++){
    float t = t0 + dt*(float(i) + 0.5); vec3 p = o + d*t; float al = altOf(p, e);
    // (a camera inside the layer flies in clear air between the clouds, as a camera plane would: no fog round it. Over a city or the ground
    // anywhere (uP4.z) the gap is a few kilometres wide, so the place below shows: London's overcast at 300 m put the Shard's view in fog)
    vec2 gap = uP4.z != 0. ? vec2(2500., 5000.) : vec2(150., 700.);
    float dn = cloudLow(p, al)*(CALT > b && CALT < tp ? smoothstep(gap.x, gap.y, t) : 1.); if(dn < 0.01) continue;
    // (the light through the cloud toward the Sun, gentler than physics would have it: in characters a cloud reads by its bright sunlit
    // side against the blue, and a physically deep cloud came out as a grey veil)
    float od = cloudLowC(p + L*140.)*0.8 + cloudLowC(p + L*450.)*1.0, hN = clamp((al - b)/max(tp - b, 50.), 0., 1.);
    vec3 cc = sunC*exp(-od*0.5)*ph + vec3(0.62, 0.68, 0.78)*(0.3 + 0.32*hN)*lit;
    cc *= mix(1., 0.55, clamp(uWx1.w*0.4, 0., 1.));   // (rain clouds are dark)
    cc += vec3(0.09, 0.055, 0.03)*(uP4.z < 0. ? 1. - smoothstep(-0.12, 0.05, L.y) : 0.)*(1. - 0.6*hN);   // (over a city at night, faintly lit orange from below by its lights; brighter, an overcast deck filled the sky with orange)
    cc = mix(cc, hz, hazeF(t, thin));
    float a = 1. - exp(-dn*dt*0.012);
    col += T*cc*a; T *= 1. - a; if(T < 0.03) break;
  }
  return vec4(col, T);
}
// a sheet (kind 0: the altocumulus at 4.5 km, 1: the cirrus at 9 km) where the ray crosses it, if nearer than tMax
vec4 sheet(vec3 o, vec3 d, float e, float H, float tMax, int kind, vec3 L, float lit, vec3 sunC, vec3 hz, float thin, out float tS){
  tS = curveT(o, d, e - H);
  if(tS <= 0. || tS > min(tMax, 150000.)){ tS = 1e9; return vec4(0., 0., 0., 1.); }
  vec3 p = o + d*tS; float dn = kind == 0 ? cloudMid(p.xz) : cloudHigh(p.xz);
  float a = dn*(kind == 0 ? 0.85 : 0.55)*(1. - smoothstep(70000., 150000., tS));
  vec3 cc = sunC*(kind == 0 ? 0.85 : 1.)*(0.7 + 0.5*pow(max(dot(d, L), 0.), 6.)) + vec3(0.55, 0.62, 0.74)*0.2*lit;
  cc = mix(cc, hz, hazeF(tS, thin)*0.8);
  return vec4(cc*a, 1. - a);
}
// the shadow the clouds cast on the ground at p: their big shapes where the Sun's ray crosses the low layer and the mid sheet
float cloudShadow(vec3 p, float e, vec3 L){
  if(L.y < 0.03) return 1.;
  float al = altOf(p, e), mid = 0.5*(uWx1.x + uWx1.y);
  float s = 1. - 0.62*cloudLowC(p + L*max(mid - al, 0.)/L.y)*smoothstep(0.02, 0.2, uWx0.x);
  return s*(1. - 0.3*cloudMid((p + L*max(4500. - al, 0.)/L.y).xz));
}
// the images as shown near the ground: a little more colour and contrast than the photo, so scrub, marsh, sand and concrete land on
// different characters
vec3 grade(vec3 c){ float l = dot(c, vec3(0.2126, 0.7152, 0.0722)); c = mix(vec3(l), c, 1.3); return clamp((c - 0.45)*1.2 + 0.45, 0., 1.); }
// and as Earth's own shader shows them from space (FS_EARTH: edLin, times the light of the Sun, through the tone map), for the handover
vec3 fromSpace(vec3 lin, float sunE){ return 1. - exp(-lin*1.25*max(sunE, 0.)); }
void main(){
  ZI = int(uP4.w);
  vec3 d = rayDir()*uRot, o = uP0.xyz, L = uP1.xyz;
  float day = uP1.w, fade = uP0.w, e = uP4.y, sunE = L.y;
  CALT = o.y + e + dot(o.xz, o.xz)/(2.*RE); DIP = -sqrt(2.*max(CALT, 0.)/RE);
  float thin = exp(-CALT/8500.);
  // (the haze's colour along the view, once a pixel: a model's shading, the ground's and the clouds' each worked it out, and Direct3D's
  // compiler copies a function at every call, 0.22.0)
  vec3 HZ = skyCol(normalize(vec3(d.x, DIP + 0.015, d.z)), L, day);
  float lit = 0.04 + 0.96*smoothstep(-0.1, 0.2, sunE);   // how bright the day is: full with the Sun 12 degrees up (a camera's exposure follows the light: at 20 degrees a dawn launch came out murky), dim at night
  float near = smoothstep(30000., 8000., CALT);   // (above 30 km the ground shows as Earth's shader shows it, below 8 km brighter and richer)
  // (a city (uP4.z < 0) at night: the eyes adjust, as they do in a city at night: the picture brightened about 2.6 times, so the buildings
  // show by moonlight and the glow of the streets; owner, 0.13.0: the cities were hard to see at night)
  // (and at dawn and dusk too, as the light gets low: owner, 0.13.0, Paris at 7:19 was a dark brown field)
  float nightK = 1. - smoothstep(-0.12, 0.05, sunE), cityK = uP4.z < 0. ? 1. : 0., expo = 1. + cityK*(0.12 + 1.48*nightK + 0.8*smoothstep(0.35, 0.02, sunE)*(1. - nightK));
  vec3 col; float a;
  // the ground: march the heights near the camera (then halve the last step a few times), else the sea-level curve
  float t = -1., water = 0., ok = 0.;
  bool det = uEdS.x > 0.5;
  // (the march starts where the ray comes down to the highest ground near the site: from a plane's height it skips most of the way)
  float hTop = uEdS.z - e + 5.;
  if(det && d.y < 0.3 && (o.y < hTop || d.y < 0.)){
    float tt = o.y > hTop ? (o.y - hTop)/max(-d.y, 1e-5) : 0., tp = tt, lo = 0., hi = 0.; int nb = -1;
    // (at a pad 40 km, finely; over the ground anywhere (uP4.z > 0) much farther, in longer steps: the mountains are far and the heights
    // coarse; over a city (uP4.z < 0) as far as -uP4.z, finely near, so its towers stand up, and in longer steps farther out)
    float tLim = uP4.z > 0. ? uP4.z : uP4.z < 0. ? -uP4.z : 40000., gA = uP4.z > 0. ? 100. : 25., gS = uP4.z > 0. ? 0.06 : uP4.z < 0. ? 0.05 : 0.04;
    for(int i=ZI;i<86;i++){
      float tm = nb < 0 ? tt : 0.5*(lo + hi), w, k;
      vec3 p = o + d*tm; float dh = p.y - groundY(p.xz, w, k);
      if(nb < 0){
        if(dh < 0.){ nb = 0; lo = tp; hi = tt; continue; }
        tp = tt; tt += clamp(dh*0.55, 0.25 + tt*0.003, gA + tt*gS);
        if(tt > tLim || (k < 0.5 && tt > 200.)) break;
      } else { if(dh < 0.) hi = tm; else lo = tm; nb++; if(nb >= 6) break; }
    }
    if(nb >= 0) t = hi;
  }
  float tc = curveT(o, d, e);
  if(t < 0. && tc > 0.) t = tc;
  // (the models' hit tests first, then the cloud shadow once, at whatever the ray meets first: each shading block called cloudShadow
  // itself, a copy each under Direct3D, 0.22.0)
  float tSh = t;
#ifdef EIFFEL
  vec3 nE; float tE = efHit(o, d, t > 0. ? t : 1e9, nE); if(tE > 0.) tSh = tE;
#endif
#ifdef LM
  vec3 nM, qM; float kM, tM = lmHit(o, d, t > 0. ? t : 1e9, nM, kM, qM); if(tM > 0.) tSh = tM;
#endif
#ifdef TOKYO
  vec3 nT, qT; float kT, tT = tkHit(o, d, t > 0. ? t : 1e9, nT, kT, qT); if(tT > 0.) tSh = tT;
#endif
  float CSH = tSh > 0. ? cloudShadow(o + d*tSh, e, L) : 1.;
#ifdef EIFFEL
  if(tE > 0.){
    vec3 B = vec3(uEf0.x, seaPt(uEf0.xy).y + uEf0.z, uEf0.y), q = efLoc(o + d*tE - B), nw = efWor(nE);
    // (the lattice: braces crossing on each face and a girder every panel, the panels smaller toward the top; it fades to its average
    // where a character covers more than a panel. By day the girders bronze and the gaps darker; at night the girders lit gold)
    float uu = abs(nE.x) > abs(nE.z) ? q.z : q.x, kL, lt = efLat(q, uu, tE*uPix, kL);
    lt = mix(0.45, lt, kL*(1. - smoothstep(0.7, 0.9, abs(nE.y))));
    float ov = smoothstep(0.5, 0.95, uWx0.x), fl = max(sunE, 0.)*(1. - 0.65*ov) + 0.6;
    float here = max(dot(nw, L), 0.)*CSH + 0.6*(0.85 + 0.15*nw.y);
    vec3 g = vec3(0.64, 0.5, 0.36)*mix(0.32, 1., lt)*lit*clamp(here/fl, 0.15, 1.6);
    g += vec3(1., 0.7, 0.32)*uEf1.x*(0.3 + 0.5*lt);
    g += vec3(1., 0.96, 0.88)*1.6*uEf1.y*step(0.975, hash12(floor(vec2(uu, q.y)/2.2) + floor(uEf1.z*7.)*vec2(3.1, 7.7)));
    col = mix(g, HZ, hazeF(tE, thin)*0.4); a = 1.; t = tE;
  } else
#endif
#ifdef LM
  if(tM > 0.){
    vec4 U = lmU(int(kM + 0.5)); vec3 nw = lmRot(nM, -U.w);
    float glow, ov = smoothstep(0.5, 0.95, uWx0.x), fl = max(sunE, 0.)*(1. - 0.65*ov) + 0.6;
    LMEM = vec3(0.); LMD = lmRot(d, U.w);
    vec3 base = lmBase(qM, nM, kM, tM*uPix, glow);
    float here = max(dot(nw, L), 0.)*CSH + 0.6*(0.85 + 0.15*nw.y);
    vec3 g = base*lit*clamp(here/fl, 0.15, 1.6) + vec3(1., 0.88, 0.7)*base*uLm2.x*glow + LMEM;
    col = mix(g, HZ, hazeF(tM, thin)*0.4); a = 1.; t = tM;
  } else
#endif
#ifdef TOKYO
  if(tT > 0.){
    vec3 nw = tkRot(nT, -(kT < 0.5 ? uTk0.w : uTk1.w));
    float ang = atan(qT.z, qT.x), P = kT < 0.5 ? max(1.6, 0.17*ttW(clamp(qT.y, 0., 252.))) : 7.;
    float uu = kT < 0.5 ? (abs(nT.x) > abs(nT.z) ? qT.z : qT.x) : ang*skRc(clamp(qT.y, 0., 495.)), kL, lt = tkLat(qT, uu, tT*uPix, P, kL);
    lt = mix(0.45, lt, kL*(1. - smoothstep(0.7, 0.9, abs(nT.y))));
    // (the decks: dark glass, lit windows at night)
    bool deck = kT < 0.5 ? abs(qT.y - 148.) < 4.6 || abs(qT.y - 249.6) < 2.7 || qT.y < 18.2 : abs(qT.y - 346.) < 11.1 || abs(qT.y - 448.) < 6.1;
    float ov = smoothstep(0.5, 0.95, uWx0.x), fl = max(sunE, 0.)*(1. - 0.65*ov) + 0.6;
    float here = max(dot(nw, L), 0.)*CSH + 0.6*(0.85 + 0.15*nw.y);
    // (Tokyo Tower's bands: international orange and white, eleven of them; the Skytree's "Skytree White", a faint blue)
    vec3 base = kT < 0.5 ? (mod(floor(qT.y/(333./11.)), 2.) < 0.5 ? vec3(0.95, 0.4, 0.14) : vec3(0.93, 0.92, 0.9)) : vec3(0.84, 0.88, 0.93);
    if(deck) base = vec3(0.3, 0.34, 0.38);
    vec3 g = base*mix(kT < 0.5 ? 0.32 : 0.7, 1., deck ? 1. : lt)*lit*clamp(here/fl, 0.15, 1.6);
    float on = kT < 0.5 ? uTk2.x : uTk2.y;
    vec3 lc = kT < 0.5 ? (uTk2.w > 0.5 ? vec3(1., 0.95, 0.85) : vec3(1., 0.55, 0.2)) : (uTk2.z > 0.5 ? vec3(0.62, 0.35, 1.) : vec3(0.4, 0.75, 1.));
    g += deck ? vec3(1., 0.85, 0.6)*on*0.35*step(0.4, fract(uu/3.)) : lc*on*(0.3 + 0.5*lt);
    col = mix(g, HZ, hazeF(tT, thin)*0.4); a = 1.; t = tT;
  } else
#endif
  if(t > 0.){
    vec3 p = o + d*t;
    float fp = max(t*uPix, 0.05), cov = 0., wall = 0., sh = 1.;
    vec3 n = vec3(0., 1., 0.), g;
    // (a pixel's footprint on the ground: stretched along the view by the glancing angle, up to 16 times)
    vec3 hd = normalize(vec3(d.x, 0., d.z) + vec3(1e-5, 0., 0.)), g1 = hd*fp/max(abs(d.y), 0.0625), g2 = vec3(-hd.z, 0., hd.x)*fp;
    vec3 img = det ? edColourG(seaPt(p.xz), g1, g2, cov).rgb : vec3(0.);
#ifdef CITY
    // (the road and its cars here, worked out once: called from the land and from the bridges, cars() was compiled twice)
    vec3 cBd = vec3(0.5); vec2 cEn = vec2(p.x, -p.z); vec4 cRd = roadAt(cEn, fp), cCr = vec4(0.);
    if(cRd.y > -900.) cCr = cars(cEn, cRd, fp, normalize(vec2(d.x, -d.z) + vec2(1e-5, 0.)), cBd)*smoothstep(uRdN.w, uRdN.w*0.65, max(abs(cEn.x), abs(cEn.y)));
#endif
    float gy = det ? groundY(p.xz, water, ok) : -e, thinHit = THIN;
    if(det && ok > 0.5 && water < 0.5){
      // the slope from the heights a little east and south (a wall where it changes by more than a storey in a pixel or two)
      float s = max(fp*1.5, 0.8), hx = gy, hz = gy;
      for(int j=ZI;j<2;j++){ float w1, k1, h = groundY(p.xz + (j == 0 ? vec2(s, 0.) : vec2(0., s)), w1, k1); if(j == 0) hx = h; else hz = h; }
      n = normalize(vec3(gy - hx, s, gy - hz)); wall = 1. - smoothstep(0.35, 0.75, n.y);
      // shadows of buildings and hills near the camera: march toward the Sun over the heights
      if(sunE > 0.02 && t < 5000.){
        float st = 1.5, w1, k1; vec3 q0 = vec3(p.x, gy, p.z) + n*0.4;
        for(int j=ZI;j<24;j++){ vec3 q = q0 + L*st; float hh = q.y - groundY(q.xz, w1, k1); sh = min(sh, clamp(6.*hh/st + 0.5, 0., 1.));
          st += max(hh*0.6, 1.5 + st*0.08); if(sh < 0.05 || st > 900. || hh > 400.) break; }
        sh = mix(1., sh, smoothstep(5000., 2500., t));
      }
    }
    float csh = CSH;
    // (outside the images: the sketch, sea past a straight coastline)
    float sd = dot(p.xz, uP2.xy) - uP2.z + 180.*(fbm3(vec3(p.xz*0.0004, 1.)) - 0.5);
    bool sea = cov > 0.5 ? water > 0.5 : (uP2.w > 0.5 || sd > 0.);
    vec3 haze = HZ;
    if(sea){
      vec2 wv = p.xz*0.02 + vec2(uP4.x*0.3, uP4.x*0.17);
      vec3 nw = normalize(vec3((noise(vec3(wv, 3.)) - 0.5)*0.3, 1., (noise(vec3(wv.yx, 7.)) - 0.5)*0.3));
      // (waves tilt the water: it mirrors a higher, darker part of the sky than a flat mirror would, and never all of it, so the sea stays
      // darker than the sky at the horizon)
      vec3 rr = reflect(d, nw); rr.y = max(abs(rr.y), 0.12); rr = normalize(rr);
      float F = min(0.02 + 0.98*pow(1. - max(-dot(d, nw), 0.), 5.), cityK > 0.5 ? 0.18 : 0.35);   // (a city's water mirrors less: it was as bright as the city, and the city vanished into it)
      // (the water's own colour: the photo's, turned bluer, so a murky coast still reads as sea and a dark lagoon never as a hole; one colour on the open sea.
      // At a famous place (uCity.z) the images' water shows everywhere, more of it: its reefs and lagoons are what it is about, and its wide layers
      // were cleaned of seams and haze over the open sea when they were made)
      float eg, op = cov > 0.5 ? edWide(seaPt(p.xz), eg).a*(1. - uCity.z) : 1.;
      vec3 deep = vec3(0.03, 0.1, 0.2), ocn = vec3(0.03, 0.12, 0.24), wi = mix(img*vec3(0.7, 0.85, 1.05), vec3(0.04, 0.13, 0.25), 0.55 - 0.3*uCity.z);
      vec3 wc = mix(fromSpace(mix(mix(ocn, edLin(img), 0.55*step(0.5, cov)), ocn, op), sunE), mix(cov > 0.5 ? wi : deep, deep, op)*lit, near);
      g = mix(wc*mix(0.72, 1., csh), skyCol(rr, L, day)*0.95, F);
      g += vec3(1., 0.9, 0.75)*pow(max(dot(rr, L), 0.), 80.)*smoothstep(-0.05, 0.05, sunE)*0.8*csh;
      vec3 lv = uP3.xyz - p; g += vec3(1., 0.55, 0.22)*uP3.w*pow(max(dot(rr, normalize(lv)), 0.), 20.)*0.3/(1. + dot(lv, lv)*2e-7);
#ifdef CITY
      // (a bridge: its deck over the water, and its traffic)
      if(cRd.y > -900. && cRd.w >= 16. && abs(cRd.y) < max(cRd.z, 1.)*1.65 + 1.5){
        float ln = 1. - smoothstep(-0.03, 0.08, sunE); g = mix(vec3(0.46, 0.45, 0.43)*lit, cBd*lit, cCr.a*(1. - ln)) + cCr.rgb*ln + vec3(1., 0.62, 0.3)*0.06*ln; }
#endif
    } else {
      vec3 base;
      // (near the ground a little darker than the rockets and towers, so they stand out; from a kilometre or more up, where the view is
      // about the land, brighter)
      // (over the ground anywhere (uP4.z) the image is Blue Marble at 2.4 km, darker and softer than a photo: as it is, a little lifted, or
      // its forests turned black)
      // (a city's images are in display terms since 0.17.0, its roofs painted in its materials (tools/city-style.mjs): shown as they are)
      if(cov > 0.5) base = mix(fromSpace(edLin(img), sunE), (uP4.z > 0. ? img*1.08 + 0.02 : uP4.z < 0. ? img*1.15 : grade(img))*(uP4.z < 0. ? 1. : mix(0.6, 0.9, smoothstep(300., 1500., CALT)))*lit, near);
      else {
        float h = fbm3(vec3(p.xz*0.004, 2.)), h2 = noise(vec3(p.xz*0.03, 5.));
        base = mix(vec3(0.5, 0.45, 0.33), vec3(0.3, 0.36, 0.2), smoothstep(0.4, 0.6, h))*(0.8 + 0.4*h2);
        if(sd > -120.) base = mix(base, vec3(0.75, 0.7, 0.58), smoothstep(-120., -40., sd));
        base = mix(base, vec3(0.5, 0.49, 0.47), smoothstep(90., 70., length(p.xz)))*lit;
      }
      // a city (uP4.z < 0): the photos are taken from above, so a wall gets a facade of its own, concrete and glass with floors 3.6 m high
      // and windows 2.6 m apart (illustrative), about a third of them lit at night; paved ground (grey and light in the photo) glows faintly
      // warm at night, as street lights do (illustrative)
      vec3 glowC = vec3(0.);
      if(uP4.z < 0. && cov > 0.5){
        // (the architectural-model style, 0.17.0, owner's pick: the roofs come painted, the ground keeps the photo, darker. How far this stands above
        // the lowest ground within 18 and 54 m tells a roof, even in the middle of a big building, from the street; the highest point within 18 m is
        // the roof of a wall's building, whose height picks the wall's material, one per building, and says how much a taller neighbour shades the
        // ground at its foot)
        float m = gy, mx = gy, w1, k1;
        for(int j=ZI;j<8;j++){ int q = j < 4 ? j : j - 4; vec2 o2 = (q == 0 ? vec2(1., 0.) : q == 1 ? vec2(-1., 0.) : q == 2 ? vec2(0., 1.) : vec2(0., -1.))*(j < 4 ? 18. : 54.);
          float hq = groundY(p.xz + o2, w1, k1); m = min(m, hq); if(j < 4) mx = max(mx, hq); }
        float roof = smoothstep(3., 12., gy - m)*(1. - thinHit), ao = (1. - roof)*smoothstep(6., 25., mx - gy);
        vec3 wc, rc;
        vec2 nH = normalize(n.xz + vec2(1e-5, 0.));
        cityMat(uCity.x, step(120., altOf(vec3(p.x, mx, p.z), e) - uCity.y), hash12(floor((p.xz - nH*5.)/32.) + vec2(uCity.x*7.1, 3.3)), wc, rc);
        base *= mix(0.6 - 0.2*ao, 1.15, roof);   // (the ground between the buildings dark, the roofs light: in characters the blocks stand out with an edge round each)
        glowC += vec3(0.04, 0.05, 0.08)*mix(0.5, 1., roof)*nightK;   // (moonlight and the city's skyglow on its roofs)
        float wl = smoothstep(0.3, 0.7, wall)*(1. - thinHit), hA = altOf(p, e), nt = 1. - smoothstep(-0.12, 0.05, sunE);
        vec2 tn = normalize(vec2(-n.z, n.x) + vec2(1e-5, 0.)); float wu = dot(p.xz, tn);
        vec2 cell = floor(vec2(wu/2.6, hA/3.6)), fw = fract(vec2(wu/2.6, hA/3.6));
        float win = mix(0.33, step(0.2, fw.x)*step(fw.x, 0.8)*step(0.3, fw.y)*step(fw.y, 0.85), smoothstep(1.6, 0.8, fp));   // (resolved only up close: farther they aliased into noise)
        base = mix(base, (uCity.x >= 0. ? wc : mix(vec3(0.42, 0.44, 0.47), img, 0.35))*(0.85 + 0.25*win)*lit, wl);
        glowC += vec3(1., 0.78, 0.45)*win*step(uCity.x > 10.5 ? 0.5 : 0.66, hash12(cell + floor(p.xz/40.)*7.31))*nt*wl*0.9;
        // (Las Vegas, 0.22.0: the resorts' fronts lit along the bottom of their walls, the signs and marquees, in a colour each; illustrative)
        if(uCity.x > 10.5){ float hb = hash12(floor(p.xz/60.) + 17.3), lh = p.y - m;   // (the height up the wall, from the lowest ground beside it)
          vec3 neon = hb < 0.25 ? vec3(1., 0.25, 0.75) : hb < 0.45 ? vec3(0.3, 0.85, 1.) : hb < 0.7 ? vec3(1., 0.78, 0.3) : hb < 0.85 ? vec3(1., 0.3, 0.2) : vec3(1.);
          glowC += neon*wl*nt*smoothstep(26., 12., lh)*smoothstep(1., 5., lh)*0.75; }
        float lum = dot(img, vec3(0.3, 0.59, 0.11)), sat = length(img - vec3(lum));
        float pav = 0.2;
#ifdef CITY
        pav = uRdT.x > -0.5 ? 0.07 : 0.2;   // (with the road maps the streets carry the night glow, below)
#endif
        glowC += vec3(1., 0.62, 0.3)*nt*(1. - wl)*smoothstep(0.18, 0.4, lum)*(1. - smoothstep(0.03, 0.12, sat))*pav*(1. - thinHit);
#ifdef CITY
        // (the traffic: its lamps from a little before sunset, the cars' bodies as specks by day)
        { vec3 bd = cBd; vec2 en = cEn; vec4 rd = cRd, cr = rd.y > -900. && wl < 0.5 && thinHit < 0.5 ? cCr : vec4(0.);
          float ln = 1. - smoothstep(-0.03, 0.08, sunE);
          if(rd.y > -900. && wl < 0.5 && roof < 0.5 && abs(rd.y) < max(rd.z, 1.)*1.65 + 1. + min(fp*0.4, 20.)*step(floor(mod(rd.w, 16.)/2.), 2.5)) base *= mix(0.72, 0.5, smoothstep(3., 10., fp));   // (the carriageway darker: the street plan reads; the big roads wider far off)
          glowC += cr.rgb*ln; base = mix(base, bd*lit, cr.a*(1. - ln));
          // (the street lights: orange on the carriageway and its pavements; far off, where a pixel is wider than a street, over the drawn width)
          // (fading out before the far map's edge, 24 km out: cut off there, the glow drew a bright line along the horizon)
          if(rd.y > -900. && wl < 0.5) glowC += vec3(1., 0.6, 0.28)*ln*(abs(rd.y) < max(rd.z, 1.)*1.65 + 3. ? 0.2 : abs(rd.y) < min(fp*0.7, 60.) ? 0.09*smoothstep(4., 20., fp) : 0.)*smoothstep(uRdN.w, uRdN.w*0.65, max(abs(en.x), abs(en.y)));
          if(uRdT.w > 0.5 && rd.y > -900.){ float hw = max(rd.z, 1.)*1.65; base = abs(rd.y) < hw ? (rd.y > 0. ? vec3(1., 0.2, 0.1) : vec3(0.1, 0.4, 1.)) : vec3(1., 1., 0.); } }   // (tests: the road maps)
#endif
        // (a slender tower: painted iron or concrete, and lit gold at night, as the Eiffel Tower is every evening)
        // (bronze in the Sun: in a darker brown the Eiffel Tower hid among the roofs)
        base = mix(base, vec3(0.64, 0.5, 0.36)*lit, thinHit); glowC += vec3(1., 0.72, 0.36)*thinHit*nt*0.45;
      }
      // (the photo already holds the light on flat ground; slopes, walls and shadows change it by their share of the light of the Sun)
      // (in a city twice the light from the sky and the facades round about, and walls lit by the street and the buildings opposite, so a
      // wall in shade keeps its colour: in characters a dark wall is an empty one, and Midtown seen against the afternoon Sun was a murk;
      // under an overcast sky the eyes adjust to its dimmer light, as they do; 0.13.0, owner: the cities looked camouflaged)
      float amb = mix(0.3, 0.38, cityK), ovc = cityK*smoothstep(0.5, 0.95, uWx0.x);   // (0.45 in a city since 0.17.0: sunlit and shaded walls further apart, as on a model)
      float fl = max(sunE, 0.)*(1. - 0.65*ovc) + amb, here = max(dot(n, L), 0.)*sh*csh + amb*mix(0.6 + 0.4*n.y, 0.85 + 0.15*n.y, cityK);
      g = base*clamp(here/fl, 0.15, 1.6)*mix(1., 0.8, wall*(1. - cityK)) + glowC;
      // lights round the site at night
      vec2 cl = floor(p.xz/35.); float hl = hash12(cl);
      if(hl > 0.93 && length(p.xz) < 1400. && uP4.z == 0.){ vec2 f = fract(p.xz/35.) - 0.5; g += vec3(1., 0.7, 0.35)*exp(-dot(f, f)*60.)*(1. - day)*0.5; }
      vec3 lv = uP3.xyz - p; g += base*vec3(1., 0.55, 0.22)*uP3.w*1.5*max(dot(n, normalize(lv)), 0.)/(1. + dot(lv, lv)*4e-6);
    }
    g = mix(g, haze, hazeF(t, thin)*(1. - mix(0.6, 0.85, cityK*(1. - smoothstep(4000., 15000., t)))*cityK));   // (less over a city: its skyline far off was washed out)
    col = g; a = 1.;
  } else {
    col = skyCol(d, L, day) + vec3(0.2, 0.12, 0.06)*nightK*cityK*exp(-max(d.y - DIP, 0.)*9.)*thin;   // (a city's glow low in the night sky)
    float tw = smoothstep(-0.18, 0.02, sunE)*smoothstep(0.25, 0.0, sunE);
    a = clamp((0.25 + 0.74*day)*mix(0.35, 1., thin) + 0.3*tw, 0., 0.99);
  }
  // the blinking lights on a city's tallest towers (uTwL: their tops in this frame, w how bright now), hidden by whatever the ray met first
  for(int i=ZI;i<16;i++){
    if(float(i) >= uTwLN) break;
    vec4 tw = uTwL[i]; if(tw.w < 0.01) continue;
    vec3 v = tw.xyz - o; float tl = dot(v, d); if(tl <= 0. || (t > 0. && tl > t + 8.)) continue;
    float r = length(v - d*tl), s = max(tl*uPix*1.4, 1.5);
    col += vec3(1., 0.16, 0.08)*tw.w*(exp(-r*r/(s*s))*2.2 + exp(-r/(s*6.))*0.12);
  }
#ifdef LM_LV
  // the Luxor's Sky Beam (0.22.0): 39 xenon lamps in the pyramid's tip, the strongest beam of light in the world, on from sunset for about
  // eight hours (Luxor; City Cast Las Vegas): straight up from the tip, its light scattered by the air, fading with height. Where the ray
  // passes nearest the beam's line, unless something nearer hides it
  if(uLmS.w > 0.01 && uLm2.z > 1.5){
    vec3 A = vec3(uLm1.x, seaPt(uLm1.xy).y + uLm1.z + LXH, uLm1.y);
    vec2 w = A.xz - o.xz, dx = d.xz; float dd = dot(dx, dx), sB = dd > 1e-10 ? dot(w, dx)/dd : 0.;
    if(sB > 0. && (t < 0. || sB < t + 3.)){
      vec3 pB = o + d*sB; float rB = length(pB.xz - A.xz), hB = pB.y - A.y;
      if(hB > 0.){
        float wv = max(2., sB*uPix*1.1), I = uLmS.w*smoothstep(0., 25., hB)*exp(-hB/9000.)*(exp(-rB*rB/(wv*wv))*1.8*min(1., 3./wv*4.) + exp(-rB/(wv*5.))*0.06);
        col += vec3(0.82, 0.88, 1.)*I; a = max(a, min(I, 1.));
      }
    }
  }
#endif
  // the clouds in front of what the ray met, in the order it meets them (the sunlight warm when the Sun is low)
  { vec3 sunC = mix(vec3(1., 0.97, 0.92), vec3(1., 0.62, 0.36), smoothstep(0.3, 0.02, sunE))*lit*smoothstep(-0.06, 0.04, sunE);
    vec3 hz = HZ;
    float tB = t > 0. ? t : 1e9, tL, tM, tH;
    vec4 A1 = layerLow(o, d, e, tB, L, lit, sunC, hz, thin, tL), A2 = sheet(o, d, e, 4500., tB, 0, L, lit, sunC, hz, thin, tM), A3 = sheet(o, d, e, 9000., tB, 1, L, lit, sunC, hz, thin, tH);
    vec4 X; float y;
    if(tM < tL){ X = A1; A1 = A2; A2 = X; y = tL; tL = tM; tM = y; }
    if(tH < tM){ X = A2; A2 = A3; A3 = X; y = tM; tM = tH; tH = y; }
    if(tM < tL){ X = A1; A1 = A2; A2 = X; }
    vec3 cc = A1.rgb + A1.a*(A2.rgb + A2.a*A3.rgb); float Tc = A1.a*A2.a*A3.a;
    col = col*Tc + cc; a = 1. - (1. - a)*Tc; }
  outCol(unTone(col)*expo*fade, a*fade);
}`;
P.sxEnv = program(VS_RECT, FS_SX_ENV);
P.sxEnvC = program(VS_RECT, FS_SX_ENV.replace('#version 300 es\n', '#version 300 es\n#define CITY\n'));   // (with the traffic: over a city, 0.14.0)
P.sxEnvEf = program(VS_RECT, FS_SX_ENV.replace('#version 300 es\n', '#version 300 es\n#define CITY\n#define EIFFEL\n'));   // (and the Eiffel Tower: near Paris)
P.sxEnvTk = program(VS_RECT, FS_SX_ENV.replace('#version 300 es\n', '#version 300 es\n#define CITY\n#define TOKYO\n'));   // (and Tokyo Tower and the Skytree: near Tokyo)
// (0.19.0: the landmarks of the new cities, each city's in its own copy)
P.sxEnvSF = program(VS_RECT, FS_SX_ENV.replace('#version 300 es\n', '#version 300 es\n#define CITY\n#define LM\n#define LM_SF\n'));
P.sxEnvSyd = program(VS_RECT, FS_SX_ENV.replace('#version 300 es\n', '#version 300 es\n#define CITY\n#define LM\n#define LM_SYD\n'));
P.sxEnvRome = program(VS_RECT, FS_SX_ENV.replace('#version 300 es\n', '#version 300 es\n#define CITY\n#define LM\n#define LM_ROME\n'));
P.sxEnvLA = program(VS_RECT, FS_SX_ENV.replace('#version 300 es\n', '#version 300 es\n#define CITY\n#define LM\n#define LM_LA\n'));
P.sxEnvRio = program(VS_RECT, FS_SX_ENV.replace('#version 300 es\n', '#version 300 es\n#define CITY\n#define LM\n#define LM_RIO\n'));
P.sxEnvLV = program(VS_RECT, FS_SX_ENV.replace('#version 300 es\n', '#version 300 es\n#define CITY\n#define LM\n#define LM_N 4\n#define LM_LV\n'));   // (0.22.0: Las Vegas, four landmarks)

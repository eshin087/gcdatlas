// ================================================================ content pack (0.8.1): comets and meteors
// Famous comets on their real orbits (JPL elements), each frozen at a moment when it was at its best: the readout says the date
// and where the comet is now. They only appear while you visit them, so the Solar System view keeps showing today's sky.
// Also: the comet that hit Jupiter (a replay), the sungrazers diving through the Sun's corona (a replay), and two meteor showers
// as the streams of comet dust that Earth crosses every year. What is replayed, frozen or illustrative says so (docs/ACCURACY.md).

// a private random sequence, so this pack does not shift the shared rnd() that other objects draw from
const cRnd = (() => { let s = 20260926; return () => { s = (s*1664525 + 1013904223) >>> 0; return s/4294967296; }; })();
const cRndn = () => { let u = 0; while (!u) u = cRnd(); return Math.sqrt(-2*Math.log(u))*Math.cos(6.2831853*cRnd()); };
const jdOf = (y, m, d) => Date.UTC(y, m - 1, 1)/86400000 + 2440587.5 + d - 1;   // Julian date (d may carry a fraction of a day)
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const fmtDay = jd => { const t = new Date((jd - 2440587.5)*86400000); return `${t.getUTCDate()} ${MONTHS[t.getUTCMonth()]} ${t.getUTCFullYear()}`; };
// what the camera is about: the destination of a flight, the tour stop, or the object you are locked on
const cFocus = () => flight ? flight.obj : tour.on ? OBJ[tour.obj] : orbit.lock >= 0 ? OBJ[orbit.lock] : null;
// objects that stand for a past moment (or a replay) are only drawn while you visit them: `present` eases between 0 and 1
function presence(o, own){
  const f = cFocus(), want = own.includes(f) ? 1 : 0, dt = clamp(GT - (o._pgt ?? GT), 0, 0.25); o._pgt = GT;
  o.present = (o.present ?? 0) + (want - (o.present ?? 0))*(1 - Math.exp(-dt*2.5));
  if (!want && o.present < 0.003) o.present = 0;
  return o.present;
}
// a point on an orbit at true anomaly nu (radians), heliocentric galactic, light-years
function orbitAtNu(el, nu){
  const p = el.a*(1 - el.e*el.e), r = p/(1 + el.e*Math.cos(nu)), I = el.i*DEG, Om = el.om*DEG, W = el.w*DEG + nu;
  const cw = Math.cos(W), sw = Math.sin(W), cO = Math.cos(Om), sO = Math.sin(Om), cI = Math.cos(I), sI = Math.sin(I);
  return V.mul(eclToGal([r*(cO*cw - sO*sw*cI), r*(sO*cw + cO*sw*cI), r*sw*sI]), AU_LY);
}

// ---------------------------------------------------------------- a comet's nucleus: two lumpy lobes of dark ice and dust, lit by the Sun, puffing jets from its sunlit side
// uP0: x activity, y jet strength, z terraces, w how smoothly the lobes merge   uP1: Sun direction (world), w: jet seed
// uP2: lobe A centre, w: surface roughness   uP3: lobe A radii   uP4: lobe B centre   uM0: [lobe B radii, lobe B tilt (x, y, z angles), tint]
const FS_NUC = COMMON + `
float sdEll(vec3 p, vec3 r){ float k0 = length(p/r), k1 = length(p/(r*r)); return k0*(k0 - 1.)/max(k1, 1e-5); }
float smin(float a, float b, float k){ float h = clamp(0.5 + 0.5*(b - a)/k, 0., 1.); return mix(b, a, h) - k*h*(1. - h); }
mat3 rotB(){ vec3 a = uM0[1]; float cx = cos(a.x), sx = sin(a.x), cy = cos(a.y), sy = sin(a.y), cz = cos(a.z), sz = sin(a.z);
  return mat3(1., 0., 0., 0., cx, sx, 0., -sx, cx)*mat3(cy, 0., -sy, 0., 1., 0., sy, 0., cy)*mat3(cz, sz, 0., -sz, cz, 0., 0., 0., 1.); }
float mapN(vec3 p, mat3 RB){
  float d = smin(sdEll(p - uP2.xyz, uP3.xyz), sdEll(RB*(p - uP4.xyz), uM0[0]), uP0.w);
  float n = fbm3(p*7.3 + uP1.w);
  d += (n - 0.5)*uP2.w + (noise(p*23. + uP1.w) - 0.5)*0.01;
  // pits where the ice has sublimated away, and scattered boulders
  d += smoothstep(0.6, 0.78, noise(p*8.5 + 4.1 + uP1.w))*0.022 - smoothstep(0.78, 0.92, noise(p*34. + uP1.w))*0.006;
  // layered ground: flat terraces and cliffs, as Rosetta saw on 67P
  if(uP0.z > 0.){ float h = p.y*11. + n*3.; d -= uP0.z*smoothstep(0.35, 0.65, fract(h))*0.012; }
  return d;
}
vec3 nrmN(vec3 p, mat3 RB){ vec2 e = vec2(0.002, 0.); return normalize(vec3(mapN(p + e.xyy, RB) - mapN(p - e.xyy, RB), mapN(p + e.yxy, RB) - mapN(p - e.yxy, RB), mapN(p + e.yyx, RB) - mapN(p - e.yyx, RB))); }
void main(){
  vec3 o, d; localRay(o, d);
  vec2 h = sphIsect(o, d, vec3(0.), 1.); if(h.y < 0.) discard;
  vec3 L = normalize(uP1.xyz*uRot);
  mat3 RB = rotB();
  vec3 col = vec3(0.); float alpha = 0.;
  // the lobes fill the inner 45% of the bounding sphere (the jets need the room around them)
  vec2 hb = sphIsect(o, d, vec3(0.), 0.47);
  if(hb.y > 0.){
    float t = max(hb.x, 0.); bool hit = false;
    int N = int(mix(60., 110., uLod));
    for(int i=0;i<110;i++){ if(i >= N) break; float s = mapN(o + d*t, RB); if(s < 0.0006){ hit = true; break; } t += s*0.8; if(t > hb.y) break; }
    if(hit){
      vec3 p = o + d*t, n = nrmN(p, RB);
      float dif = max(dot(n, L), 0.);
      // shadows cast by the lobes on each other (the head of 67P shades its neck)
      float sh = 1.;
      if(dif > 0.){ float ts = 0.02; for(int j=0;j<22;j++){ float s = mapN(p + L*ts, RB); if(s < 0.0004){ sh = 0.; break; } sh = min(sh, 6.*s/ts); ts += max(s, 0.01); if(ts > 1.2) break; } sh = clamp(sh, 0., 1.); }
      float ao = clamp(0.5 + 0.5*mapN(p + n*0.04, RB)/0.04, 0.3, 1.);
      // darker than coal (it reflects about 5% of sunlight), shown brightened so its landscape reads
      vec3 alb = uM0[2]*(0.55 + 0.9*fbm3(p*13.)*fbm3(p*31. + 2.));
      col = alb*(pow(dif, 0.8)*sh*1.4 + 0.035*ao);
      alpha = 1.;
    }
  }
  // jets of gas and dust from the sunlit side, and the faint haze they feed
  float act = uP0.x;
  // dust scatters sunlight mostly forward: jets and haze glow brightest seen against the Sun
  float fwd = 1. + 3.5*pow(max(dot(d, L), 0.), 3.);
  if(act > 0.01){
    for(int j=0;j<5;j++){
      float fj = float(j);
      vec3 jd = normalize(L*1.1 + 0.7*vec3(sin(fj*2.1 + uP1.w), cos(fj*1.7 + uP1.w*1.3), sin(fj*3.3 + uP1.w*0.7)));
      vec3 base = jd*0.19;
      float flick = 0.55 + 0.45*sin(uTime*0.5 + fj*1.9);
      col += jet(o - base, d, jd, 0.74, 0.004, 0.07, 0.8, uTime*0.5 + fj*1.3, vec3(1., 0.98, 0.95), vec3(0.6, 0.75, 1.))*act*uP0.y*flick*(1. - alpha*0.85)*2.6*fwd;
    }
    col += vec3(0.75, 0.85, 1.)*blob(o, d, L*0.15, 0.55)*act*0.05*fwd*(1. - alpha*0.6);
  }
  outCol(col*smoothstep(1., 0.8, length(o + d*max(-dot(o, d), 0.))), alpha);
}`;
P.nucleus = program(VS_RECT, FS_NUC);

// ---------------------------------------------------------------- the head of a comet: the coma, its sunward shells, and the start of both tails
// local frame: +x away from the Sun, +z behind the comet along its orbit (the dust tail bends that way), y completes it
// uP0: x activity, y shells, z ion tail, w dust tail   uP1: x dust bend
const FS_COMA = COMMON + `
void main(){
  vec3 o, d; localRay(o, d);
  vec2 h = sphIsect(o, d, vec3(0.), 1.); if(h.y < 0.) discard;
  float act = uP0.x; if(act < 0.005) discard;
  float tc = max(-dot(o, d), 0.); vec3 pc = o + d*tc; float b = length(pc);   // where the line of sight passes closest to the nucleus
  float sunward = clamp(-pc.x/max(b, 1e-4), -1., 1.);
  // gas and dust leaving in all directions: seen through, the coma's brightness falls off about as 1/distance, more on the sunward side
  float coma = (0.12/(b + 0.04))*exp(-b*b*3.5)*(1. + 0.5*sunward) + 1.5*exp(-b*b/0.0015);
  // shells: arcs of dust thrown off the sunward side as the nucleus turns (Hale-Bopp's were famous), slowly moving out
  float sh = pow(0.5 + 0.5*sin(b*55. - uTime*0.6), 5.)*smoothstep(0.015, 0.05, b)*exp(-b/0.16)*max(sunward + 0.25, 0.)*uP0.y;
  vec3 col = (vec3(0.72, 0.88, 1.)*coma + vec3(1., 0.95, 0.85)*sh*0.9)*act;
  // the start of the tails: a narrow straight blue ion tail, and a broad yellowish dust tail bending back along the orbit
  col += jet(o, d, vec3(1., 0., 0.), 0.98, 0.006, 0.05, 0.6, uTime*0.25, vec3(0.55, 0.75, 1.), vec3(0.3, 0.5, 1.))*act*uP0.z*1.6;
  col += jet(o, d, normalize(vec3(1., 0., uP1.x*0.5)), 0.98, 0.012, 0.2, 0., 0., vec3(1., 0.93, 0.8), vec3(1., 0.84, 0.6))*act*uP0.w;
  // the false nucleus: a star-like point where the coma is densest
  col += vec3(1., 0.97, 0.92)*(pblob(o, d, vec3(0.), 0.0025)*40. + pblob(o, d, vec3(0.), 0.02)*6.)*act;
  outCol(col*smoothstep(1., 0.72, b), 0.);
}`;
P.coma = program(VS_RECT, FS_COMA);

// ---------------------------------------------------------------- the tails: a narrow straight blue ion tail and a broad yellowish dust tail bending back along the orbit
// Each is a glowing tube whose light is added up along the line of sight, sampled where the ray passes the tube (smooth at any distance).
// local frame as the head; the bounding sphere sits in the middle of the tails.
// uP0: x activity, y ion, z dust, w dust bend   uP1: nucleus (local units), w ion length   uP2: direction along the orbit behind the comet, w its length
// uP3: x dust length, y old dust along the orbit, z width scale, w head radius   (lengths in local units)
const FS_TAILV = COMMON + `
vec3 tube(vec3 o, vec3 d, vec3 a, vec3 ax, float L, float u0, float u1, float W0, float W1, float fy, float kind){
  vec3 oa = o - a;
  float e = dot(d, ax), ao = dot(ax, oa), dd = dot(d, oa), sinT = sqrt(max(1. - e*e, 1e-6)), tc, R;
  if(sinT > 0.2){ tc = (e*ao - dd)/(sinT*sinT); float sc = clamp(ao + e*tc, 0., L); R = 3.4*mix(W0, W1, mix(u0, u1, sc/L))/sinT; }
  else { tc = (L*0.5 - ao)/e; R = L*0.55/abs(e); }
  float ta = max(tc - R, 0.), tb = max(tc + R, 0.);
  if(tb <= ta) return vec3(0.);
  float dt = (tb - ta)/12.; vec3 acc = vec3(0.);
  vec3 side = normalize(vec3(ax.z, 0., -ax.x) + 1e-5);
  for(int i=0;i<12;i++){
    float t = ta + (float(i) + 0.5)*dt;
    vec3 p = oa + d*t; float s = dot(p, ax);
    if(s < 0. || s > L) continue;
    float u = mix(u0, u1, s/L), w = mix(W0, W1, u);
    vec3 pp = p - ax*s; float py = pp.y/fy, pq = dot(pp, side);
    float g = exp(-(py*py + pq*pq)/(w*w))*(W0/w);
    // fade before the edge of the drawing area, and leave the first stretch to the head
    vec3 q = a + p; g *= smoothstep(1., 0.86, length(q))*smoothstep(0.4, 2., length(q - uP1.xyz)/uP3.w);
    if(kind < 0.5){
      // ion tail: streamers that flicker and kink as the solar wind gusts
      float n = noise(vec3(u*7. - uTime*0.35, pq/w*1.6 + sin(u*9. - uTime*0.3)*0.8, py/w*1.6));
      acc += mix(vec3(0.55, 0.75, 1.), vec3(0.3, 0.5, 1.), u)*g*(0.3 + 1.6*n*n)*smoothstep(0., 0.03, u)*pow(1. - u, 1.2);
    } else if(kind < 1.5){
      // dust tail: smooth and broad, with faint striae (bands of grains released together)
      float n = noise(vec3(u*3. - uTime*0.06, pq/w*0.9 + u*4., py/w*0.7));
      acc += mix(vec3(1., 0.93, 0.8), vec3(1., 0.8, 0.56), u)*g*(0.7 + 0.6*n)*smoothstep(0., 0.04, u)*pow(1. - u, 1.5);
    } else {
      acc += vec3(1., 0.86, 0.68)*g*smoothstep(0., 0.05, u)*(1. - u);
    }
  }
  return acc*dt;
}
void main(){
  vec3 o, d; localRay(o, d);
  vec2 h = sphIsect(o, d, vec3(0.), 1.); if(h.y < 0.) discard;
  float act = uP0.x; if(act < 0.005) discard;
  vec3 n0 = uP1.xyz; float Li = uP1.w, Ld = uP3.x, bend = uP0.w, ws = uP3.z;
  vec3 col = tube(o, d, n0, vec3(1., 0., 0.), Li*0.3, 0., 0.3, 0.003*ws, 0.03*ws, 1., 0.)*uP0.y*1.6;
  col += tube(o, d, n0 + vec3(Li*0.3, 0., 0.), vec3(1., 0., 0.), Li*0.7, 0.3, 1., 0.003*ws, 0.03*ws, 1., 0.)*uP0.y*1.6;
  // the dust tail curves (z = bend s^2 / Ld): three straight pieces
  for(int k=0;k<3;k++){
    float s0 = Ld*float(k)/3., s1 = Ld*float(k + 1)/3.;
    vec3 a = n0 + vec3(s0, 0., bend*s0*s0/Ld), b = n0 + vec3(s1, 0., bend*s1*s1/Ld), ab = b - a;
    col += tube(o, d, a, normalize(ab), length(ab), float(k)/3., float(k + 1)/3., 0.008*ws, 0.13*ws, 0.35, 1.)*uP0.z;
  }
  if(uP3.y > 0.) col += tube(o, d, n0, uP2.xyz, uP2.w, 0., 1., 0.006*ws, 0.02*ws, 0.2, 2.)*uP3.y;
  outCol(col*act*55., 0.);
}`;
P.tailv = program(VS_RECT, FS_TAILV);

// ---------------------------------------------------------------- a comet frozen at one moment: nucleus (pickable) + head and tails (drawn around it)
// def: key, name, label, type, fact, aka, readout, sortKey; el (orbital elements, JPL/Horizons), jd (the moment shown); R (nucleus radius, km)
// shape: { a:[centre], ra:[radii], b:[centre], rb:[radii], tilt:[x, y, z], k (merge), rough, terrace, tint }; spinH (hours), pole
// tail: { Rc (head radius, km), ion, dust (tail lengths, AU), bend, act, shells, jets, ionK, dustK, trail (old dust along the orbit), trailLen (AU) }; views(o, F) -> view list
const NUCF = 0.45;   // the nucleus fills this fraction of its bounding sphere
function addComet(def){
  const off = orbitTp(def.el, def.jd), vel = V.norm(V.sub(orbitTp(def.el, def.jd + 0.5), orbitTp(def.el, def.jd - 0.5)));
  const X = V.norm(off), back = V.mul(vel, -1), Z = V.norm(V.sub(back, V.mul(X, V.dot(back, X)))), Y = V.cross(Z, X);
  const TF = [...X, ...Y, ...Z], T = def.tail, Rn = def.R*KM, S = def.shape;
  // the camera frame: screen up is along the orbit (behind the comet), so a view from above the orbit shows the tails running across the screen, head on the right
  const CAMF = [...Y, ...Z, ...X], SPIN = def.pole ? poleFrame(def.pole[0], def.pole[1]) : M3.mul(CAMF, R0of(...(S.spinTilt || [0.5, 0.3, 0.2])));
  const L = Math.max(T.ion, T.dust)*AU_LY, Rc = T.Rc*KM;
  // world directions for the views: X away from the Sun, Y across the orbit, Z behind the comet
  const F = { X, Y, Z, off, dir:(x, y, z) => V.norm(V.add(V.add(V.mul(X, x), V.mul(Y, y)), V.mul(Z, z))), L, Rc, Rn,
    earth:() => V.norm(V.sub(planetPos(PLANET_EL.earth, def.jd), off)),
    // a direction around the spin axis: ang radians from the sunward side, up = elevation above the equator (radians)
    eq:(ang, up) => { const P0 = [SPIN[3], SPIN[4], SPIN[5]], sw = V.mul(X, -1), s0 = V.norm(V.sub(sw, V.mul(P0, V.dot(sw, P0)))), s1 = V.cross(P0, s0);
      return V.norm(V.add(V.add(V.mul(s0, Math.cos(ang)), V.mul(s1, Math.sin(ang))), V.mul(P0, Math.tan(up)))); } };
  let tail = null;
  const o = addObj({ key:def.key, name:def.name, label:def.label || def.name, type:def.type, group:'comets', layer:3, prog:P.nucleus, parent:sun, offset:off.slice(), pos:off.slice(), selfPos:true,
    rad:Rn/NUCF, sizeR:Rn, minZoom:1.1, pxMin:5, R0:CAMF, farColor:[0.75, 0.88, 1], farLum:0.55, labelRange:3*AU_LY,
    fact:def.fact, aka:def.aka, sortKey:def.sortKey, readout:def.readout, noWaypoint:true,
    inRange:() => o.present > 0.003,
    update(){
      presence(o, [o, tail]);
      this.rot = M3.mul(SPIN, M3.rotY((jdNow() - def.jd)*24/(def.spinH || 10)*2*Math.PI));
    },
    setU(pr){
      const L0 = sunDirFrom(this), k = NUCF/Math.max(...S.ra.map((r, i) => Math.abs(S.a[i]) + r), ...S.rb.map((r, i) => Math.abs(S.b[i]) + r));
      gl.uniform4f(pr.u.uP0, T.act, T.jets ?? 1, S.terrace || 0, (S.k ?? 0.1)*k);
      gl.uniform4f(pr.u.uP1, L0[0], L0[1], L0[2], S.seed || 0);
      gl.uniform4f(pr.u.uP2, S.a[0]*k, S.a[1]*k, S.a[2]*k, S.rough ?? 0.05);
      gl.uniform4f(pr.u.uP3, S.ra[0]*k, S.ra[1]*k, S.ra[2]*k, 0);
      gl.uniform4f(pr.u.uP4, S.b[0]*k, S.b[1]*k, S.b[2]*k, 0);
      gl.uniformMatrix3fv(pr.u.uM0, false, [S.rb[0]*k, S.rb[1]*k, S.rb[2]*k, ...(S.tilt || [0, 0, 0]), ...(S.tint || [0.55, 0.5, 0.46])]);
    } });
  Object.defineProperty(o, 'noPick', { get:() => !(o.present > 0.3) });
  o.views = def.views(o, F);
  // the tails' drawing sphere: centred between the head and the ends of the tails
  const Li = T.ion*AU_LY, Ld = T.dust*AU_LY, bend = T.bend, Lx = Math.max(Li, Ld);
  const cL = [Lx*0.5, 0, bend*Ld*0.35], ends = [[0, 0, 0], [Li, 0, 0], [Ld, 0, bend*Ld], [Ld*0.5, 0, bend*Ld*0.25]];
  const Rt = Math.max(...ends.map(q => Math.hypot(q[0] - cL[0], q[1] - cL[1], q[2] - cL[2])))*1.12 + 0.07*Lx;
  const cW = V.add(V.add(V.mul(X, cL[0]), V.mul(Y, cL[1])), V.mul(Z, cL[2]));
  const trailLocal = [V.dot(back, X), 0, V.dot(back, Z)];
  tail = addObj({ key:def.key + '-tail', name:def.name, label:'', type:'', layer:3, parent:o, offset:cW, rad:Rt, R0:TF, rot:TF,
    noPick:true, noLabel:true, atlas:false, noImpostor:true, noWaypoint:true, pxMin:1, minZoom:1e-6,
    inRange:() => o.present > 0.003,
    // the tails fade as the camera closes in on the head; the head fades when the camera is down at the nucleus (it would wash out the view of it)
    tailVis(rpx){ return smooth(2, 8, rpx)*o.present*smooth(0.4, 2.5, o.dist/Rc); },
    comaVis(){ return smooth(0.4, 1.5, Rc/Math.max(o.dist, 1e-30)*sceneH*0.5/tanY)*o.present*smooth(0.015, 0.07, o.dist/Rc); },
    visFn(rpx){ return Math.max(this.tailVis(rpx), this.comaVis()); },
    drawBefore(){
      const tv = this.tailVis(this.rpx), cv = this.comaVis();
      if (tv > 0.003) drawVolume(tail, P.tailv, tail.rel, Rt, pr => {
        const n0 = [-cL[0]/Rt, -cL[1]/Rt, -cL[2]/Rt];
        gl.uniform4f(pr.u.uP0, T.act, T.ionK ?? 1, T.dustK ?? 1, bend); gl.uniform4f(pr.u.uP1, n0[0], n0[1], n0[2], Li/Rt);
        gl.uniform4f(pr.u.uP2, trailLocal[0], trailLocal[1], trailLocal[2], (T.trailLen || 0)*AU_LY/Rt);
        gl.uniform4f(pr.u.uP3, Ld/Rt, T.trail || 0, Lx/Rt, Rc/Rt); }, TF, tv);
      if (cv > 0.003) drawVolume(tail, P.coma, o.rel, Rc, pr => {
        gl.uniform4f(pr.u.uP0, T.act, T.shells || 0, T.ionHead ?? 1, T.dustHead ?? 1); gl.uniform4f(pr.u.uP1, bend, 0, 0, 0); }, TF, cv);
    } });
  // its orbit, while you visit it
  o.particles.push({ ps:orbitTrace(def.el, 300, [0.5, 0.72, 0.95], def.from ?? 0, def.to ?? 1), prog:'lnBasic', lines:true, mode:3, sb:0.3, size:1, rad:1, rel:() => sun.rel, rot:() => I3,
    vis:() => o.present*smooth(0.02*AU_LY, 0.3*AU_LY, orbit.dist) });
  o.particleVis = () => 1;
  o.tail = tail; o.F = F; o.el = def.el; o.elNow = def.elNow || def.el; o.jd = def.jd;
  return o;
}
// where a comet is now (on the Solar System clock), for the readouts
const cometNow = o => V.len(orbitTp(o.elNow, jdNow()))/AU_LY;
const auTxt = r => r < 10 ? r.toFixed(2) : r < 100 ? r.toFixed(1) : Math.round(r).toLocaleString('en-US');

// ---------------------------------------------------------------- Comet Hale-Bopp (C/1995 O1), the great comet of 1997, at perihelion on 1 April 1997
const haleBopp = addComet({ key:'halebopp', name:'Comet Hale-Bopp', label:'Hale-Bopp', type:'the great comet of 1997 · C/1995 O1', sortKey:0.914,
  el:{ a:187.7713, e:0.99513147, i:89.43017, om:282.47060, w:130.58725, tp:2450539.6331 }, jd:2450539.63, R:30, spinH:11.3,
  shape:{ a:[-0.1, 0, 0], ra:[1, 0.85, 0.8], b:[0.55, 0.12, 0.1], rb:[0.6, 0.55, 0.5], k:0.25, rough:0.07, seed:3.1 },
  tail:{ Rc:1.6e6, ion:0.55, dust:0.42, bend:0.55, act:1, shells:1, jets:1.1 },
  fact:'One of the brightest comets of the last century: seen with the naked eye for about 18 months, a record. Its nucleus, about 60 km across, is several times bigger than most comets\'.',
  aka:'hale bopp c/1995 o1 great comet 1997',
  views:(o, F) => [
    { dirFn:() => F.dir(0.3, 0.85, -0.4), k:0.66*F.L/o.rad, off:() => M3.applyT(o.R0, V.mul(V.add(V.mul(F.X, 0.4*F.L), V.mul(F.Z, 0.14*F.L)), 1/o.rad)), hold:10, drift:0.01 },
    { dirFn:() => F.dir(-0.55, 0.7, 0.35), k:3.2*F.Rc/o.rad, hold:9, drift:0.02 },
    { dirFn:() => F.dir(-0.35, 0.6, 0.7), k:1.7, hold:9, drift:0.04 } ],
  readout:() => `shown as on 1 April 1997, at its closest to the Sun (0.91 AU)\nnow ${auTxt(cometNow(haleBopp))} AU out, dark and frozen · back in about 2,500 years` });

// ---------------------------------------------------------------- Comet NEOWISE (C/2020 F3), found by NASA's NEOWISE space telescope, at perihelion on 3 July 2020
const neowise = addComet({ key:'neowise', name:'Comet NEOWISE', label:'NEOWISE', type:'the bright comet of July 2020 · C/2020 F3', sortKey:0.295,
  el:{ a:358.5473, e:0.99917821, i:128.93750, om:61.01043, w:37.27865, tp:2459034.1789 }, jd:2459034.18, R:2.5, spinH:7.6,
  shape:{ a:[-0.2, 0, 0], ra:[1, 0.7, 0.75], b:[0.75, 0.1, -0.05], rb:[0.55, 0.5, 0.5], tilt:[0, 0, 0.4], k:0.2, rough:0.08, seed:7.7 },
  tail:{ Rc:4e5, ion:0.2, dust:0.16, bend:0.7, act:0.9, shells:0.5, jets:1 },
  fact:'Found by NASA\'s NEOWISE space telescope on 27 March 2020, it became a naked-eye comet with a long curved dust tail in July 2020. Its nucleus is about 5 km across.',
  aka:'neowise c/2020 f3 comet 2020',
  views:(o, F) => [
    { dirFn:() => F.dir(0.25, 0.85, -0.45), k:0.62*F.L/o.rad, off:() => M3.applyT(o.R0, V.mul(V.add(V.mul(F.X, 0.4*F.L), V.mul(F.Z, 0.18*F.L)), 1/o.rad)), hold:10, drift:0.01 },
    { dirFn:() => F.dir(-0.45, 0.35, 0.8), k:3*F.Rc/o.rad, hold:9, drift:0.02 },
    { dirFn:() => F.dir(-0.3, 0.55, 0.75), k:1.6, hold:9, drift:0.04 } ],
  readout:() => `shown as on 3 July 2020, at its closest to the Sun (0.29 AU)\nit passed Earth at 103 million km on 23 July · now ${auTxt(cometNow(neowise))} AU out\nback in about 6,800 years` });

// ---------------------------------------------------------------- Comet Tsuchinshan-ATLAS (C/2023 A3), as on 14 October 2024, when Earth crossed the plane of its orbit and saw a spike pointing at the Sun
const tsuchinshan = addComet({ key:'tsuchinshan', name:'Comet Tsuchinshan-ATLAS', label:'Tsuchinshan-ATLAS', type:'the bright comet of October 2024 · C/2023 A3', sortKey:0.391,
  el:{ a:-19384.24, e:1.00002019, i:139.11055, om:21.55946, w:308.49131, tp:2460581.2421 }, jd:2460597.5, R:2.5, spinH:9,
  shape:{ a:[0, 0, 0], ra:[1, 0.8, 0.7], b:[0.7, -0.15, 0.1], rb:[0.5, 0.45, 0.45], tilt:[0.3, 0, -0.3], k:0.2, rough:0.07, seed:12.3 },
  tail:{ Rc:4e5, ion:0.22, dust:0.17, bend:0.5, act:0.85, shells:0.3, jets:1, trail:1.4, trailLen:0.1 },
  fact:'Found by China\'s Purple Mountain Observatory in January 2023 and by the ATLAS survey a month later. In mid-October 2024 Earth passed through the plane of its orbit, and dust spread along that orbit showed as a thin spike pointing toward the Sun: an anti-tail.',
  aka:'tsuchinshan atlas c/2023 a3 comet 2024 anti-tail purple mountain',
  views:(o, F) => [
    { dirFn:() => F.dir(0.2, 0.9, -0.35), k:0.62*F.L/o.rad, off:() => M3.applyT(o.R0, V.mul(V.add(V.mul(F.X, 0.35*F.L), V.mul(F.Z, 0.12*F.L)), 1/o.rad)), hold:10, drift:0.01 },
    // looking from Earth's direction, nearly in the plane of the orbit: the anti-tail points toward the Sun
    { dirFn:F.earth, k:1.1*F.L/o.rad, off:() => M3.applyT(o.R0, V.mul(V.mul(F.X, 0.15*F.L), 1/o.rad)), hold:11, drift:0.002 },
    { dirFn:() => F.dir(-0.35, 0.5, 0.8), k:1.6, hold:9, drift:0.04 } ],
  readout:() => `shown as on 14 October 2024, two days after it passed Earth at 70 million km\nnow ${auTxt(cometNow(tsuchinshan))} AU out, on a path that may leave the Solar System` });

// ---------------------------------------------------------------- 3I/ATLAS (C/2025 N1), the third interstellar object, at perihelion on 29 October 2025
let off3i = null;
const atlas3i = addComet({ key:'3iatlas', name:'3I/ATLAS', label:'3I/ATLAS', type:'the third interstellar object · a comet from another star', sortKey:1.356,
  el:{ a:-0.26393561, e:6.13931342, i:175.11313, om:322.15552, w:128.00713, tp:2460977.9823 }, jd:2460977.98, R:1.3, spinH:16, from:0.46, to:0.54,
  shape:{ a:[0, 0, 0], ra:[1, 0.85, 0.8], b:[0.45, 0.2, 0], rb:[0.6, 0.55, 0.5], k:0.3, rough:0.08, seed:21.5, tint:[0.62, 0.5, 0.42] },
  tail:{ Rc:1.5e5, ion:0.05, dust:0.035, bend:0.35, act:0.55, shells:0, jets:0.8, ionK:0.8 },
  fact:'Found on 1 July 2025 by the ATLAS survey telescope in Chile: only the third object known to come from another star. It swept past the Sun just inside the orbit of Mars and is heading back into interstellar space; its speed hints that it may be older than the Solar System.',
  aka:'3i atlas c/2025 n1 interstellar comet 2025',
  views:(o, F) => [
    { dirFn:() => F.dir(0.2, 0.9, -0.35), k:0.65*F.L/o.rad, off:() => M3.applyT(o.R0, V.mul(V.mul(F.X, 0.35*F.L), 1/o.rad)), hold:9, drift:0.01 },
    // its path: a nearly straight line through the inner Solar System (the orbit is drawn)
    { dirFn:() => F.dir(0.05, 1, 0.05), k:2.6*AU_LY/o.rad, off:() => M3.applyT(o.R0, V.mul(off3i, -0.6/o.rad)), hold:10, drift:0.004 },
    { dirFn:() => F.dir(-0.4, 0.45, 0.8), k:1.6, hold:9, drift:0.04 } ],
  readout:() => `shown as on 29 October 2025, at its closest to the Sun (1.36 AU), moving at 68 km/s\nnow ${auTxt(cometNow(atlas3i))} AU out, leaving at about 58 km/s\nnucleus between 0.44 and 5.6 km across (Hubble)` });
off3i = atlas3i.offset;

// ---------------------------------------------------------------- 67P/Churyumov-Gerasimenko: Rosetta's comet, at perihelion on 13 August 2015
const c67p = addComet({ key:'67p', name:'Comet 67P/Churyumov-Gerasimenko', label:'67P', type:'Rosetta\'s comet · the rubber duck', sortKey:1.243,
  el:{ a:3.4619089, e:0.64087479, i:7.04032, om:50.13583, w:12.79601, tp:2457247.5862 }, jd:2457247.59,
  elNow:{ a:3.4589988, e:0.64948934, i:3.86611, om:36.28826, w:22.23737, tp:2461871.0459 }, R:2.5, spinH:12.4, pole:[69.3, 64.1],
  // two lobes, 4.1 x 3.3 x 1.8 km and 2.6 x 2.3 x 1.8 km, joined by a narrow neck
  shape:{ a:[-0.45, -0.45, 0], ra:[2.05, 0.9, 1.65], b:[1.25, 1.0, 0.1], rb:[1.3, 0.9, 1.15], tilt:[0, 0.2, 0.65], k:0.55, rough:0.05, seed:1.7, tint:[0.52, 0.5, 0.48] },
  tail:{ Rc:1.2e5, ion:0.03, dust:0.022, bend:0.4, act:0.75, shells:0, jets:1.3 },
  fact:'The comet ESA\'s Rosetta orbited from 2014 to 2016: two lobes, 4.1 and 2.6 km long, joined by a neck like a rubber duck. It is about half as dense as water. Rosetta\'s lander Philae touched down on it on 12 November 2014.',
  aka:'67p churyumov gerasimenko rosetta philae rubber duck comet esa',
  views:(o, F) => [
    { dirFn:() => F.eq(0.35, -0.55), k:1.6, hold:10, drift:0.03 },
    // on the night side, looking toward the Sun: the jets glow against the dark
    { dirFn:() => F.eq(2.7, 0.35), k:2.1, hold:9, drift:0.02 },
    { dirFn:() => F.dir(0.25, 0.85, -0.45), k:0.6*F.L/o.rad, off:() => M3.applyT(o.R0, V.mul(V.mul(F.X, 0.35*F.L), 1/o.rad)), hold:9, drift:0.01 } ],
  readout:() => `shown as on 13 August 2015, at its closest to the Sun (1.24 AU)\nthen losing up to 300 kg of water and 1,000 kg of dust a second\nnow ${auTxt(cometNow(c67p))} AU from the Sun · it circles it every 6.4 years` });

// ---------------------------------------------------------------- points that hide behind a planet or star: uQ0 = its centre (camera-relative, same units as uRel) and radius
// (points are not depth-tested against volumes, so anything behind the body is dropped here)
const PB_HIDDEN = `void body(out vec3 p, out float br, out vec3 col){
  p = aP.xyz; br = aP.w; col = aC.rgb;
  vec3 w = uRel + uRot*(p*uRad), c = uQ0.xyz; float lw = length(w);
  if(lw > 0.){ vec3 u = w/lw; float tc = dot(c, u), b2 = dot(c, c) - tc*tc; if(b2 < uQ0.w*uQ0.w && lw > tc - sqrt(uQ0.w*uQ0.w - b2)) br = 0.; }
}`;
P.ptHidden = program(particleVS(PB_HIDDEN), FS_POINT);

// ---------------------------------------------------------------- Shoemaker-Levy 9: the comet Jupiter tore apart, and the week its pieces hit (16 to 22 July 1994), replayed
// The fragments fall along one path onto one spot just past the limb (as seen from the first view); Jupiter's turning carries each
// fresh scar round into view. Plumes rise about 3,000 km, the height Hubble measured. Timing is compressed and loops.
// uP0: x planet radius (local units), y oblateness   uImp[k]: body-frame direction x size, w seconds since impact (negative: not yet)   uP1: Sun direction (world)
const FS_SL9 = COMMON + `
uniform vec4 uImp[21];
void main(){
  vec3 o, d; localRay(o, d);
  vec2 h = sphIsect(o, d, vec3(0.), 1.); if(h.y < 0.) discard;
  float Rp = uP0.x, sq = 1./(1. - uP0.y);
  vec3 os = o*vec3(1., sq, 1.), ds = normalize(d*vec3(1., sq, 1.));
  vec2 hp = sphIsect(os, ds, vec3(0.), Rp);
  bool hit = hp.x > 0.;
  float tHit = hit ? length((os + ds*hp.x - os)*vec3(1., 1./sq, 1.)) : 1e9;   // (distance along the unscaled ray)
  vec3 s = hit ? normalize(os + ds*hp.x) : vec3(0.);
  vec3 L = normalize(uP1.xyz*uRot);
  vec3 col = vec3(0.); float dark = 0.;
  for(int k=0;k<21;k++){
    vec4 im = uImp[k]; float sz = length(im.xyz), tau = im.w;
    if(sz < 0.01 || tau < 0.) continue;
    vec3 dir = im.xyz/sz;
    // the scar: a dark core and a thin dark ring, on the cloud tops, fading slowly
    if(hit && tau > 1.2){
      float a = acos(clamp(dot(s, dir), -1., 1.)), r = 0.07*sz;
      float scar = smoothstep(r, r*0.35, a) + 0.6*exp(-pow((a - r*1.6)/(r*0.25), 2.));
      dark = max(dark, clamp(scar, 0., 1.)*smoothstep(1.2, 3., tau)*0.92);
    }
    // the fireball, then a plume of hot gas rising about 3,000 km (4% of Jupiter's radius) and falling back
    if(tau < 6.){
      vec3 base = dir*Rp*vec3(1., 1./sq, 1.);
      float up = sin(clamp(tau/4., 0., 1.)*3.1416), hgt = 0.045*Rp*up*sz;
      vec3 pc = base + dir*hgt*0.6;
      float tc = dot(pc - o, d);
      float vis = tc < tHit ? 1. : 0.;
      float flash = exp(-tau*3.5);
      vec3 hot = mix(vec3(1., 0.95, 0.85), vec3(1., 0.55, 0.25), smoothstep(0., 2.5, tau));
      col += hot*(blob(o, d, base + dir*0.006*Rp, 0.012*Rp)*flash*260. + blob(o, d, pc, (0.01 + 0.018*up)*Rp)*up*120.*(1. - smoothstep(3., 6., tau)))*vis*sz;
    }
  }
  outCol(col, dark);
}`;
P.sl9 = program(VS_RECT, FS_SL9);
const sl9 = (() => {
  const RJ = 71492*KM, T = 40, N = 21, LET = 'ABCDEFGHJKLMNPQRSTUVW';
  // fragment sizes (relative): G, K and L left the biggest marks
  const SIZE = { G:1.5, K:1.35, L:1.3, H:1.1, Q:1.05, E:1, R:1 };
  const frag = [...LET].map((c, k) => ({ c, t:6 + k*0.85 + (cRnd() - 0.5)*0.4, sz:(SIZE[c] || 0.55 + 0.35*cRnd())*0.9, body:null }));
  const imp = new Float32Array(N*4), NT = 10, ps = makePS(N*(NT + 1) + 60);
  let V0 = null, P0 = null, A = null;   // view direction, impact point and approach direction (Jupiter's pole frame)
  const geom = () => {
    // look from the day side, 60 degrees from the Sun; the impact point is just past the limb that turns toward the view
    const R0 = jupiter.R0, S = M3.applyT(R0, sunDirFrom(jupiter)), phS = Math.atan2(S[0], S[2]), phV = phS + 1.05, y0 = Math.sin(-44*DEG), r = Math.cos(-44*DEG);
    V0 = V.norm([Math.sin(phV)*0.93, -0.36, Math.cos(phV)*0.93]);
    // the impact point: at 44 degrees south, 6 degrees behind the limb, on the side that turns toward the view
    const h = Math.hypot(V0[0], V0[2]), rhs = (-Math.sin(6*DEG) - y0*V0[1])/(r*h), phI = Math.atan2(V0[0], V0[2]) - Math.acos(clamp(rhs, -1, 1));
    P0 = [r*Math.sin(phI), y0, r*Math.cos(phI)];
    // they came in from the south, steeply
    A = V.norm(V.add(V.mul(P0, 0.55), [0, -0.8, 0]));
  };
  geom();
  const o = addObj({ key:'sl9', name:'Comet Shoemaker-Levy 9', label:'Shoemaker-Levy 9', type:'the comet that hit Jupiter in July 1994 · replayed', group:'comets', layer:3,
    parent:jupiter, offset:[0, 0, 0], rad:RJ*16, R0:jupiter.R0, sizeR:1*KM, pxMin:2, minZoom:0.02, farLum:0, noImpostor:true, noWaypoint:true, labelRange:0.05*AU_LY, sortKey:5.2,
    fact:'Jupiter\'s gravity tore this comet into 21 pieces in July 1992. Two years later, from 16 to 22 July 1994, they hit Jupiter one after another at 60 km/s: the first collision between two Solar System bodies ever watched.',
    aka:'shoemaker levy 9 sl9 d/1993 f2 jupiter impact 1994 string of pearls',
    inRange:() => o.present > 0.003, sim:true,
    visFn(){ return o.present; },
    update(dt){
      presence(o, [o]);
      if (!o.present) return;
      geom();
      const t = o.t % T, R0 = jupiter.R0, J = jupiter.rot, anti = V.mul(sunDirFrom(jupiter), -1);
      let k = 0;
      for (let i=0;i<N;i++){
        const f = frag[i], tau = t - f.t;
        // at impact: pin the spot to the turning planet (its body frame), so the scar is carried round
        if (tau >= 0 && !f.body) f.body = M3.applyT(J, M3.apply(R0, P0));
        if (tau < 0) f.body = null;
        const b = f.body || [0, 0, 0], fade = 1 - smooth(T - 3, T - 0.2, t);
        imp.set([b[0]*f.sz*fade, b[1]*f.sz*fade, b[2]*f.sz*fade, f.body ? tau : -1], i*4);
        // the fragment on its way in: a small bright head with a short dust tail pointing away from the Sun
        const fin = smooth(0, 1.5, t);
        if (tau < 0){
          const d = -tau*0.62, p = M3.apply(R0, V.mul(V.add(P0, V.mul(A, d)), 1/16)), br = f.sz*fin*smooth(0, 0.25, -tau);
          ps.a.set([...p, 1.4*br], k*4); ps.c.set([0.95, 0.97, 1, 0], k*4); k++;
          for (let j=1;j<=NT;j++){ const u = j/NT, q = V.add(p, V.mul(anti, u*0.03*f.sz)); ps.a.set([...q, 0.45*(1 - u)*br], k*4); ps.c.set([1, 0.9, 0.72, 0], k*4); k++; }
        }
      }
      ps.count = k; if (k) ps.upload('ac');
    },
    drawBefore(vis){
      drawVolume(o, P.sl9, jupiter.rel, jupiter.rad*1.08, pr => {
        const L0 = sunDirFrom(jupiter); gl.uniform4f(pr.u.uP0, 0.9/1.08, 0.0649, 0, 0); gl.uniform4f(pr.u.uP1, L0[0], L0[1], L0[2], 0); gl.uniform4fv(pr.u.uImp, imp); }, jupiter.rot, vis);
    },
    particleVis:() => o.present,
    particles:[{ ps, prog:'ptHidden', mode:3, sb:1.6, size:2.6, rot:() => I3, q0:() => [...jupiter.rel, RJ*0.96], show:() => ps.count > 0 },
      { ps, prog:'ptHidden', mode:3, sb:0.22, size:9, rot:() => I3, q0:() => [...jupiter.rel, RJ*0.96], show:() => ps.count > 0 }],
    readout:() => { const t = o.t % T, n = frag.filter(f => t >= f.t).length;
      return `a replay of July 1994, sped up · ${n} of 21 fragments have hit\nfragment G struck with the energy of about 6 million megatons of TNT\nplumes rose 3,000 km; the dark scars were about the size of Earth`; },
    views:[
      // the string of pearls falling in from the south
      { dirFn:() => M3.apply(jupiter.R0, V.norm(V.add(V0, [0, -0.25, 0]))), k:0.62, off:() => V.mul(V.add(P0, V.mul(A, 3.2)), 1/16), hold:11, drift:0.004 },
      // at the limb, where the plumes rise
      { dirFn:() => M3.apply(jupiter.R0, V0), k:0.035, off:() => V.mul(V.norm(V.add(P0, V.mul(V0, -V.dot(P0, V0)))), 0.98/16), hold:11, drift:0.002 },
      // the scars turning into view
      { dirFn:() => M3.apply(jupiter.R0, V.norm(V.add(V0, [0, -0.5, 0]))), k:0.2, hold:10, drift:0.01 } ] });
  o.dbg = { ps, imp, frag };
  return o;
})();

// ---------------------------------------------------------------- the Kreutz sungrazers: one comet family, pieces of a giant comet that broke up long ago, all on nearly the same orbit.
// They dive to about 1.2 Sun radii from its centre (130,000 km above the surface). Real parabolic motion around the real
// family orbit (the Great Comet of 1843's elements), replayed 15,000 times faster; most fragments boil away near the Sun.
const kreutz = (() => {
  const RS = RSUN*KM, SPEED = 15000, GM = 1.32712e11, NT = 36, MAX = 7, ps = makePS(MAX*(NT + 1));
  const base = { i:144.35, om:3.53, w:82.64, q:0.00553 };   // Great Comet of 1843
  const orbitFrame = (el) => { const I = el.i*DEG, Om = el.om*DEG, W = el.w*DEG, cw = Math.cos(W), sw = Math.sin(W), cO = Math.cos(Om), sO = Math.sin(Om), cI = Math.cos(I), sI = Math.sin(I);
    return { P:eclToGal([cO*cw - sO*sw*cI, sO*cw + cO*sw*cI, sw*sI]), Q:eclToGal([-cO*sw - sO*cw*cI, -sO*sw + cO*cw*cI, cw*sI]) }; };
  const F0 = orbitFrame(base), list = [];
  let next = 0.5, count = 0;
  // position on a parabola (Barker's equation) at time t seconds from perihelion, in Sun radii
  const para = (q, t) => { const qk = q*AU, k = Math.sqrt(GM/(2*qk*qk*qk)), W = 1.5*k*t, Y = Math.cbrt(W + Math.sqrt(W*W + 1)), D = Y - 1/Y, nu = 2*Math.atan(D), r = qk*(1 + D*D)/RSUN;
    return [r*Math.cos(nu), r*Math.sin(nu)]; };
  const tStart = (q, rMax) => { const qk = q*AU, D = Math.sqrt(rMax*RSUN/qk - 1); return -Math.sqrt(2*qk*qk*qk/GM)*(D + D*D*D/3); };
  const spawn = () => {
    count++;
    // every few comets a big one, like Lovejoy in 2011, that makes it round the Sun (for a while)
    const big = count % 5 === 3, el = { i:base.i + (cRnd() - 0.5)*3, om:base.om + (cRnd() - 0.5)*10, w:base.w + (cRnd() - 0.5)*12, q:base.q*(0.9 + 0.5*cRnd()) };
    list.push({ el, F:orbitFrame(el), t:tStart(el.q, 34), big, sz:big ? 1.4 : 0.45 + 0.4*cRnd(), life:1 });
  };
  const o = addObj({ key:'kreutz', name:'Kreutz sungrazers', label:'Kreutz sungrazers', type:'a family of comets that dive through the Sun\'s corona · replayed', group:'comets', layer:3,
    parent:sun, offset:V.mul(F0.P, -8*RS), rad:RS*24, sizeR:0.01*KM, R0:frameY(F0.Q, V.cross(F0.Q, F0.P)), pxMin:2, minZoom:0.05, farLum:0, noImpostor:true, noWaypoint:true,
    labelRange:0.5*AU_LY, sortKey:0.0055,
    fact:'Pieces of one giant comet that broke up centuries ago, still following nearly the same orbit, which passes about 130,000 km above the Sun\'s surface. The SOHO spacecraft has found over 4,000 of them; most are only metres to tens of metres across and boil away.',
    aka:'kreutz sungrazers sungrazing comets soho lovejoy ikeya-seki great comet 1843 1882',
    inRange:() => o.present > 0.003, sim:true, visFn(){ return o.present; },
    update(dt){
      presence(o, [o]);
      if (!o.present) return;
      next -= dt; if (next < 0 && list.length < MAX){ spawn(); next = 2.2 + 1.6*cRnd(); }
      let k = 0;
      for (let i=list.length - 1; i>=0; i--){
        const c = list[i]; c.t += dt*SPEED;
        const [x, y] = para(c.el.q, c.t), r = Math.hypot(x, y);
        // small ones fade out as they reach the Sun; the big one survives the passage and then fades too
        if (c.t > 0 && !c.big) c.life -= dt*1.5;
        if (c.big && c.t > 0) c.life -= dt*0.12;
        if (c.life <= 0 || r > 36){ list.splice(i, 1); continue; }
      }
      for (const c of list){
        const [x, y] = para(c.el.q, c.t), r = Math.hypot(x, y), p = V.add(V.mul(c.F.P, x), V.mul(c.F.Q, y)), anti = V.norm(p);
        const [x2, y2] = para(c.el.q, c.t + 600), vdir = V.norm(V.sub(V.add(V.mul(c.F.P, x2), V.mul(c.F.Q, y2)), p));
        const act = clamp(45/(r*r), 0.04, 3)*c.sz*clamp(c.life, 0, 1)*smooth(34, 28, r);
        ps.a.set([p[0], p[1], p[2], (0.9 + act*0.6)*clamp(c.life, 0, 1)*smooth(34, 30, r)], k*4); ps.c.set([1, 0.96, 0.9, 0], k*4); k++;
        // the tail points away from the Sun and curves back along the path; it grows as the comet nears the Sun
        const len = Math.min(0.8 + 2.6*act, 8)*c.sz;
        for (let j=1;j<=NT;j++){
          const u = j/NT, q = V.add(p, V.add(V.mul(anti, u*len), V.mul(vdir, -u*u*len*0.35)));
          ps.a.set([q[0], q[1], q[2], (act*0.55 + 0.05)*(1 - u)*(1 - u)], k*4); ps.c.set(j % 3 ? [1, 0.9, 0.75, 0] : [0.7, 0.8, 1, 0], k*4); k++;
        }
      }
      ps.count = k; if (k) ps.upload('ac');
    },
    particleVis:() => o.present,
    particles:[{ ps, prog:'ptHidden', mode:3, sb:1.2, size:2.2, rad:RS, rel:() => sun.rel, rot:() => I3, q0:() => [...sun.rel, RS*0.98], show:() => ps.count > 0 },
      { ps, prog:'ptHidden', mode:3, sb:0.18, size:8, rad:RS, rel:() => sun.rel, rot:() => I3, q0:() => [...sun.rel, RS*0.98], show:() => ps.count > 0 }],
    readout:() => 'a replay, 15,000 times faster than real · perihelion 1.2 Sun radii from its centre\nclosest to the Sun they move at over 500 km/s\nfamous members: the Great Comets of 1843 and 1882, Ikeya-Seki (1965), Lovejoy (2011)',
    views:[
      // the family's shared path seen face on: in from the lower right, round the Sun (left), out to the upper right
      { dirFn:() => V.cross(F0.Q, F0.P), k:1.15, off:() => M3.applyT(o.R0, V.mul(F0.P, 2/24)), hold:11, drift:0 },
      // close to the Sun, where they round it through the corona
      { dirFn:() => V.norm(V.add(V.add(V.mul(V.cross(F0.Q, F0.P), 0.9), V.mul(F0.P, -0.3)), V.mul(F0.Q, -0.25))), k:0.62, off:() => M3.applyT(o.R0, V.mul(F0.P, 4.5/24)), hold:11, drift:0.004 } ] });
  return o;
})();

// ---------------------------------------------------------------- meteor showers: the dust a comet sheds spreads along its orbit, and Earth runs through it on the same dates every year
// Grains are drawn along the comet's real orbit (JPL elements); how they are spread across and along it is illustrative.
// Near the crossing, a stream of grains flows along the orbit, shown about 200,000 times faster than it really moves.
// aP: x mean anomaly at the start, y z offsets across the orbit (AU), w brightness   aC: rgb, w: 1 = flows (near the crossing), 0 = static
// uQ0: a (AU), e, mean motion (rad per s of replay), window half-width (rad of mean anomaly)   uQ1: x mean anomaly of the crossing   uM: orbit axes (P, Q, W) as columns
const PB_STREAM = `
vec3 kep(float M, out vec3 tng){
  float a = uQ0.x, e = uQ0.y;
  float E = M + e*sin(M)/(1. - sin(M + e) + sin(M));
  for(int i=0;i<8;i++) E -= (E - e*sin(E) - M)/(1. - e*cos(E));
  float c = cos(E), s = sin(E), b = a*sqrt(1. - e*e);
  tng = normalize(uM[0]*(-a*s) + uM[1]*(b*c));
  return uM[0]*(a*(c - e)) + uM[1]*(b*s);
}
void body(out vec3 p, out float br, out vec3 col){
  float M = aP.x, fade = 1.;
  if(aC.w > 0.5){
    // flowing grains: they move along the orbit through a window around the crossing, and fade in and out at its ends
    float w = uQ0.w, u = fract((aP.x - uQ1.x + w + uT*uQ0.z)/(2.*w));
    M = uQ1.x - w + u*2.*w; fade = smoothstep(0., 0.15, u)*smoothstep(1., 0.85, u);
  }
  vec3 tng, q = kep(M, tng), side = normalize(cross(uM[2], tng));
  p = q + side*aP.y + uM[2]*aP.z;
  br = aP.w*fade*(0.75 + 0.25*sin(uT*1.7 + aP.x*977.));
  col = aC.rgb;
}`;
P.ptStream = program(particleVS(PB_STREAM), FS_POINT);
function addShower(def){
  const el = def.el, I = el.i*DEG, Om = el.om*DEG, W = el.w*DEG, cw = Math.cos(W), sw = Math.sin(W), cO = Math.cos(Om), sO = Math.sin(Om), cI = Math.cos(I), sI = Math.sin(I);
  const Pv = eclToGal([cO*cw - sO*sw*cI, sO*cw + cO*sw*cI, sw*sI]), Qv = eclToGal([-cO*sw - sO*cw*cI, -sO*sw + cO*cw*cI, cw*sI]), Wv = V.cross(Pv, Qv);
  // where the orbit crosses Earth's path: the node nearest 1 AU
  const nuN = [-el.w*DEG, Math.PI - el.w*DEG].map(nu => ({ nu, r:el.a*(1 - el.e*el.e)/(1 + el.e*Math.cos(nu)) })).sort((x, y) => Math.abs(x.r - 1) - Math.abs(y.r - 1))[0];
  const node = orbitAtNu(el, nuN.nu), E = 2*Math.atan(Math.sqrt((1 - el.e)/(1 + el.e))*Math.tan(nuN.nu/2)), Mnode = E - el.e*Math.sin(E);
  const nDay = 0.01720209895/Math.pow(el.a, 1.5), n = Math.round(def.n*QUALITY), ps = makePS(n), nFlow = Math.round(n*0.18), W0 = nDay*25;   // the flowing window: 25 days either side of the crossing
  for (let i=0;i<n;i++){
    const flow = i < nFlow, fr = cRnd();
    let M, spread;
    if (flow){ M = Mnode + (cRnd()*2 - 1)*W0; spread = def.width; }
    else if (def.clump && fr < def.clump){ M = def.clumpM + cRndn()*0.004; spread = def.width*0.4; }   // fresh trails close to the comet
    else if (fr < 0.55){ const nu = (cRnd()*2 - 1)*2.6, Ea = 2*Math.atan(Math.sqrt((1 - el.e)/(1 + el.e))*Math.tan(nu/2)); M = Ea - el.e*Math.sin(Ea); spread = def.width*(0.5 + cRnd()); }   // the inner orbit, where Earth meets it
    else { const Ea = cRnd()*2*Math.PI; M = Ea - el.e*Math.sin(Ea); spread = def.width*(0.4 + 1.6*cRnd()); }
    const c = V.lerp(def.col, [1, 1, 1], 0.3*cRnd());
    ps.a.set([M, cRndn()*spread, cRndn()*spread*0.35, (flow ? 0.8 : 0.6)*(0.5 + cRnd())], i*4); ps.c.set([c[0], c[1], c[2], flow ? 1 : 0], i*4);
  }
  ps.upload('ac');
  const nMean = nDay/86400*200000;   // mean motion, radians per second of replay (200,000 times real)
  const o = addObj({ key:def.key, name:def.name, label:def.label, type:def.type, group:'comets', layer:3, parent:sun, offset:node, pos:node.slice(), selfPos:true,
    rad:0.35*AU_LY, sizeR:def.width*AU_LY, R0:frameY(Wv, V.norm(node)), pxMin:2, minZoom:0.02, farLum:0, noImpostor:true, noWaypoint:true, labelRange:6*AU_LY,
    fact:def.fact, aka:def.aka, sortKey:def.sortKey,
    inRange:() => o.present > 0.003, visFn(){ return o.present; },
    update(){ presence(o, [o]); },
    particleVis:() => o.present,
    particles:[{ ps, prog:'ptStream', mode:3, sb:def.sb || 0.9, size:1.5, rad:AU_LY, rel:() => sun.rel, rot:() => I3,
      q0:() => [el.a, el.e, nMean, W0], q1:() => [Mnode, 0, 0, 0], mat:() => [...Pv, ...Qv, ...Wv] },
      // the parent comet, where it is now on the Solar System clock
      { ps:def.parentPS, prog:'ptBasic', mode:3, sb:1.2, size:3, rad:AU_LY, rel:() => sun.rel, rot:() => I3 }],
    readout:def.readout,
    views:def.views });
  o.el = el; o.node = node;
  // Earth reaches the crossing when its direction from the Sun lines up with the node's
  const eclN = eclToGal([0, 0, 1]);
  o.daysToCrossing = () => { const e = planetPos(PLANET_EL.earth, jdNow()); let ang = Math.atan2(V.dot(V.cross(e, node), eclN), V.dot(e, node)); if (ang < 0) ang += 2*Math.PI; return Math.round(ang/(2*Math.PI)*365.25); };
  return o;
}
const parentDot = (el, col) => { const ps = makePS(1); ps.c.set([...col, 0], 0); const upd = () => { const p = V.mul(orbitTp(el, jdNow()), 1/AU_LY); ps.a.set([p[0], p[1], p[2], 1], 0); ps.upload('ac'); }; upd(); ps.upd = upd; return ps; };
const swiftTuttleEl = { a:26.0920695, e:0.963225755, i:113.453817, om:139.3811921, w:152.9821676, tp:2448968.4998 };
const tempelTuttleEl = { a:10.3383382, e:0.905552721, i:162.4865754, om:235.2709891, w:172.5002737, tp:2450872.5977 };
const perseids = addShower({ key:'perseids', name:'the Perseids', label:'Perseids', type:'meteor shower in August · dust from Comet Swift-Tuttle', el:swiftTuttleEl, n:9000, width:0.05, col:[1, 0.86, 0.62], sortKey:1.01,
  parentPS:parentDot(swiftTuttleEl, [0.7, 0.85, 1]),
  fact:'Every August Earth runs through the dust shed by Comet Swift-Tuttle, whose nucleus is 26 km across. The grains, from sand to pebble size, hit the air at 59 km/s and burn up as shooting stars high above the ground.',
  aka:'perseids meteor shower august swift-tuttle 109p shooting stars',
  readout:() => `the dust stream along Comet Swift-Tuttle's orbit (spread drawn illustratively)\nEarth crosses it around 12 August: in ${perseids.daysToCrossing()} days · up to about 100 meteors an hour\nthe comet returns every 133 years, next in 2126`,
  views:[{ d:[0.2, 1, 0.35], k:7, hold:10, drift:0.004 }, { d:[0.35, 0.25, 1], k:1.6, hold:10, drift:0.01 }, { d:[0.05, 1, 0.08], k:150, hold:10, drift:0.002 }] });
const leonids = addShower({ key:'leonids', name:'the Leonids', label:'Leonids', type:'meteor shower in November · dust from Comet Tempel-Tuttle', el:tempelTuttleEl, n:9000, width:0.02, col:[0.85, 0.92, 1], sortKey:0.98,
  parentPS:parentDot(tempelTuttleEl, [0.7, 0.85, 1]), clump:0.3, clumpM:(() => { const n = 0.01720209895/Math.pow(tempelTuttleEl.a, 1.5); return n*(JD_NOW - tempelTuttleEl.tp) - 0.02; })(),
  fact:'Comet Tempel-Tuttle, 3.6 km across, passes the Sun every 33 years and leaves fresh trails of dust. When Earth hits one, the November Leonids become a storm: in 1966 people saw thousands of meteors a minute. At 71 km/s they are the fastest meteors of the year.',
  aka:'leonids meteor shower storm november tempel-tuttle 55p shooting stars 1833 1966',
  readout:() => `the dust stream along Comet Tempel-Tuttle's orbit (spread drawn illustratively)\nEarth crosses it around 17 November: in ${leonids.daysToCrossing()} days · about 15 meteors an hour in most years\nthe densest dust trails close to the comet bring the storms`,
  views:[{ d:[0.2, 1, 0.35], k:7, hold:10, drift:0.004 }, { d:[0.35, 0.25, 1], k:1.6, hold:10, drift:0.01 }, { d:[0.05, 1, 0.08], k:65, hold:10, drift:0.002 }] });
EXTRAS.push(() => { for (const s of [perseids, leonids]) if (s.present > 0.003) s.particles[1].ps.upd(); });

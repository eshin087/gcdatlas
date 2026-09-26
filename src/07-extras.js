
// ================================================================ travellers and transients: the Halo (a ring ship that folds space), comets, meteors, gamma-ray bursts
// ---------------------------------------------------------------- the Halo: a long-range cruiser with a star-heart reactor (local: bounding sphere 1, +y = forward)
const FS_SHIP = COMMON + `
// the Halo: an original long-range cruiser. Local frame: bounding sphere 1, forward +y (bow at +0.95), dorsal side -x, belly +x toward what it studies, wings along z.
// Mid-ship an open reactor bay shows its captured star-heart, a ball of plasma held by two counter-rotating containment rings inside a segmented
// halo ring (the ship's name); it throws arcs and light spikes whenever it surges. Three engines at the stern, a bridge tower forward, swept wings aft.
float sdBox(vec3 p, vec3 b){ vec3 q = abs(p) - b; return length(max(q, 0.)) + min(max(q.x, max(q.y, q.z)), 0.); }
float sdCap(vec3 p, vec3 a, vec3 b, float r){ vec3 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba)/dot(ba, ba), 0., 1.); return length(pa - ba*h) - r; }
float sdTorusY(vec3 p, float R, float r){ return length(vec2(length(p.xz) - R, p.y)) - r; }
float sdTorusX(vec3 p, float R, float r){ return length(vec2(length(p.yz) - R, p.x)) - r; }
const vec3 CORE = vec3(-0.01, -0.12, 0.);
float surge(float tm){ float k = floor(tm/2.3), f = fract(tm/2.3); float h = hash12(vec2(k, 7.3)); return h > 0.5 ? smoothstep(0., 0.05, f)*exp(-f*4.5)*(0.6 + 0.9*hash12(vec2(k, 1.1))) : 0.; }
mat3 rotA(vec3 a, float t){ a = normalize(a); float c = cos(t), s = sin(t), k = 1. - c; return mat3(c + a.x*a.x*k, a.y*a.x*k + a.z*s, a.z*a.x*k - a.y*s, a.x*a.y*k - a.z*s, c + a.y*a.y*k, a.z*a.y*k + a.x*s, a.x*a.z*k + a.y*s, a.y*a.z*k - a.x*s, c + a.z*a.z*k); }
float map(vec3 p, out float id){
  // hull: long and armoured, tapering to a sharp bow; the top of the bow is chamfered into a wedge
  float k = smoothstep(-0.8, 0.95, p.y);
  float hull = sdBox(p - vec3(0.005, 0.03, 0.), vec3(mix(0.1, 0.03, k), 0.9, mix(0.155, 0.04, k)))*0.8 - 0.01;
  hull = max(hull, dot(p - vec3(-0.02, 0.62, 0.), normalize(vec3(-0.55, 0.83, 0.))));
  float keel = sdBox(p - vec3(0.11, -0.05, 0.), vec3(0.02, 0.55, 0.03)) - 0.006;
  hull = min(hull, keel);
  // the reactor bay: an opening through the hull around the star-heart, ringed by a heavy collar
  hull = max(hull, -(length(p - CORE) - 0.14));
  float collar = sdTorusY(p - CORE, 0.2, 0.032);
  // bridge tower forward of the bay, with a wider command deck on top
  float tower = sdBox(p - vec3(-0.13, 0.33, 0.), vec3(0.045, 0.12, 0.03)) - 0.01;
  float deck = sdBox(p - vec3(-0.185, 0.36, 0.), vec3(0.016, 0.075, 0.07)) - 0.006;
  // swept wings aft, a dorsal fin at the stern, a sensor mast at the bow
  vec3 w = vec3(p.x, p.y, abs(p.z));
  float s = w.z - 0.13;
  float wing = max(max(abs(w.x - 0.015) - 0.011, s - 0.44), max(-s, max(w.y - (-0.06 - 0.85*s), (-0.6 - 0.33*s) - w.y)*0.75));
  float tip = sdCap(w, vec3(0.015, -0.46, 0.57), vec3(0.015, -0.78, 0.57), 0.018);
  float fin = max(sdBox(p - vec3(-0.19, -0.66, 0.), vec3(0.09, 0.13, 0.007)), dot(p - vec3(-0.28, -0.56, 0.), normalize(vec3(-0.8, 0.6, 0.))));
  float mast = sdCap(p, vec3(-0.02, 0.9, 0.), vec3(-0.02, 1.0, 0.), 0.006);
  // engines: a big central drive and two outboard nacelles
  float eng = min(sdCap(p, vec3(0.005, -0.66, 0.), vec3(0.005, -0.9, 0.), 0.062), sdCap(w, vec3(0.025, -0.55, 0.22), vec3(0.025, -0.86, 0.22), 0.045));
  // containment: two rings turning on different axes around the heart, inside a slowly turning segmented halo ring
  vec3 cp = p - CORE;
  float r1 = sdTorusX(rotA(vec3(1., 0.3, 0.), uTime*0.9)*cp, 0.085, 0.007);
  float r2 = sdTorusX(rotA(vec3(0.2, 1., 0.4), -uTime*0.63)*cp, 0.108, 0.006);
  float ha = atan(cp.z, cp.x) + uTime*0.25;
  float halo = max(sdTorusY(cp, 0.265, 0.004), (abs(fract(ha*16./6.2832) - 0.5) - 0.38)*0.2);
  float core = length(cp) - 0.048;
  float body = min(min(hull, collar), min(min(tower, deck), min(min(wing, tip), min(fin, mast))));
  float d = min(body, eng); id = 0.;
  if(wing < min(hull, collar) && wing <= body) id = 6.;
  if(min(tower, deck) <= body && min(tower, deck) < hull) id = 5.;
  if(eng < body) id = 1.;
  float rr = min(r1, r2); if(rr < d){ d = rr; id = 3.; }
  if(collar < d + 0.001 && collar <= body) id = 3.;
  if(halo < d){ d = halo; id = 4.; }
  if(core < d){ d = core; id = 2.; }
  return d;
}
vec3 nrm(vec3 p){ float id; vec2 e = vec2(0.0015, 0.); return normalize(vec3(map(p + e.xyy, id) - map(p - e.xyy, id), map(p + e.yxy, id) - map(p - e.yxy, id), map(p + e.yyx, id) - map(p - e.yyx, id))); }
// uP0: x fold-drive spool, y jump glow (light speed and folds), z scale (1; it shrinks to a point as it folds away and grows back on arrival)
// uP1: xyz light direction, w ram-scoop glow (uP3.rgb its colour)   uP2: glow of the scan array, tractor emitter, bow gun / drill, probe bay
void main(){
  vec3 o, d; localRay(o, d);
  o /= max(uP0.z, 0.01);
  vec2 hb = sphIsect(o, d, vec3(0.), 1.);
  if(hb.y < 0.) discard;
  float spool = uP0.x, jg = uP0.y, tm = uTime, S = surge(tm);
  float power = 1. + spool*1.6 + S*2.5;
  vec3 L = normalize(uP1.xyz*uRot);
  vec3 cyan = vec3(0.35, 0.85, 1.), gold = vec3(0.96, 0.72, 0.33), steel = vec3(0.6, 0.63, 0.7), fire = vec3(1., 0.45, 0.16), mag = vec3(0.95, 0.35, 1.);
  float t = max(hb.x, 0.), id = 0.; bool hit = false;
  for(int i=0;i<130;i++){ vec3 p = o + d*t; float h = map(p, id); if(h < 0.0006) { hit = true; break; } t += h*0.75; if(t > hb.y) break; }
  vec3 col = vec3(0.); float alpha = 0.;
  if(hit){
    vec3 p = o + d*t, n = nrm(p);
    float dif = max(dot(n, L), 0.), fill = 0.3 + 0.25*max(dot(n, -d), 0.), rim = pow(1. - max(dot(n, -d), 0.), 3.);
    float spec = pow(max(dot(n, normalize(L - d)), 0.), 40.);
    vec3 toC = CORE - p; float coreLit = max(dot(n, normalize(toC)), 0.)*0.6/(dot(toC, toC)*12. + 0.3);
    if(id > 5.5){
      // wings: gold with a leading-edge light line
      float lead = exp(-pow((p.y - (-0.06 - 0.85*(abs(p.z) - 0.13)))/0.02, 2.));
      float edge = smoothstep(0.03, 0., abs(abs(p.z) - 0.52)) + smoothstep(0.015, 0., abs(p.y - (-0.6 - 0.33*(abs(p.z) - 0.13))));
      vec3 wc = mix(mix(steel*1.2, gold, 0.4), gold*1.1, min(edge, 1.));
      col = wc*(dif*1.1 + fill) + gold*spec + cyan*lead*(0.5 + spool + S)*0.8 + wc*rim*0.3;
    } else if(id > 4.5){
      // the bridge: dark armour with a band of lit windows
      float win = step(0.5, fract(p.y*60.))*exp(-pow((p.x + 0.185)/0.008, 2.))*step(0.055, abs(p.z) + 0.02*step(p.x, -0.17));
      col = steel*0.55*(dif + fill) + vec3(1., 0.9, 0.6)*win*1.6 + cyan*exp(-pow((p.x + 0.2)/0.006, 2.))*0.8;
    } else if(id > 3.5){
      float ha = atan(p.z - CORE.z, p.x - CORE.x);
      col = mix(cyan, vec3(1.), 0.3)*(0.55 + 1.6*pow(0.5 + 0.5*sin(ha*9. - tm*3.), 6.))*(0.7 + 0.4*power);
    } else if(id > 2.5){
      // containment rings and the bay collar: dark metal with a white-hot edge facing the heart
      float inner = max(dot(n, normalize(CORE - p)), 0.);
      col = vec3(0.35, 0.33, 0.4)*(dif*0.9 + 0.15) + mix(cyan, vec3(1.), 0.5)*pow(inner, 3.)*1.8*power;
    } else if(id > 1.5){
      vec3 cp = p - CORE;
      float pl = fbm3(cp*60. + vec3(0., tm*1.5, 0.)), mu = max(dot(n, -d), 0.);
      col = mix(vec3(1., 0.55, 0.2), vec3(1., 0.97, 0.9), smoothstep(0.35, 0.75, pl)*0.7 + mu*0.4)*(4.5 + 2.5*pl)*power;
    } else if(id > 0.5){
      // engines: dark nacelles, glowing nozzles facing aft
      float noz = smoothstep(-0.84, -0.9, p.y)*max(dot(n, vec3(0., -1., 0.)), 0.);
      float band = exp(-pow((p.y + 0.7)/0.012, 2.));
      col = vec3(0.3, 0.32, 0.37)*(dif + 0.2) + cyan*(noz*3.5 + band*1.2)*(1. + spool + S);
    } else {
      // hull: steel plates with gold trim, rows of small lit ports along the flanks, circuit light running aft from the heart when it surges
      float plate = step(0.5, fract(p.y*7.)), seam = smoothstep(0.02, 0., abs(fract(p.y*7.) - 0.5) - 0.47);
      float trim = smoothstep(0.012, 0., abs(abs(p.z) - mix(0.155, 0.04, smoothstep(-0.8, 0.95, p.y))*0.92))*step(0.3, abs(n.z));
      vec3 base = mix(steel, steel*0.86, plate)*(1. - 0.45*seam);
      base = mix(base, gold, trim*0.8 + smoothstep(0.02, 0., abs(p.x + 0.02))*0.35);
      float port = step(0.72, abs(n.z))*step(0.6, fract(p.y*42.))*smoothstep(0.012, 0., abs(p.x - 0.025))*step(-0.6, p.y)*step(p.y, 0.75);
      float pulse = pow(0.5 + 0.5*sin(length(toC)*30. - tm*6.), 4.);
      float tr = smoothstep(0.03, 0., abs(fract(p.y*14. + step(0.5, fract(p.z*9.))*0.5) - 0.5) - 0.45)*step(abs(n.z), 0.5);
      col = base*1.3*(dif*1.1 + fill + 0.1) + gold*spec*1.2 + steel*rim*0.3 + vec3(1., 0.88, 0.6)*port*1.3 + mix(cyan, fire, 0.35*S)*coreLit*power + cyan*tr*(0.12 + pulse*(0.4 + 2.2*S));
    }
    // jumping: the hull flares white-blue; skimming: the bow glows with the gas it rams through
    col += vec3(0.72, 0.9, 1.)*jg*(0.4 + 2.4*rim);
    col += uP3.rgb*uP1.w*pow(max(n.y, 0.), 2.)*(1.2 + 0.8*noise(p*40. + tm*3.));
    alpha = 1.;
  }
  float front = hit ? t : 1e9;
  // the aura: fiery, slowly churning light around the heart (cyan close in, burning orange and violet further out)
  vec2 ha = sphIsect(o, d, CORE, 0.3);
  if(ha.y > 0.){
    float a0 = max(ha.x, 0.), a1 = min(ha.y, front), dt = (a1 - a0)/14.;
    vec3 acc = vec3(0.);
    for(int i=0;i<14;i++){
      vec3 q = o + d*(a0 + dt*(float(i) + 0.5)) - CORE; float r = length(q);
      float sw = fbm3(q*13. + vec3(tm*0.6, -tm*0.9, tm*0.4) + 3.*vec3(sin(r*28. - tm*2.)));
      float dens = exp(-r/(0.06 + 0.03*power))*(0.35 + 1.4*sw*sw)*smoothstep(0.3, 0.15, r);
      vec3 c = mix(mix(vec3(1., 0.95, 0.9), vec3(1., 0.75, 0.4), smoothstep(0.035, 0.07, r)), mix(fire, mag, sw*sw*1.4), smoothstep(0.06, 0.16, r));
      acc += c*dens;
    }
    col += acc*dt*9.*power;
  }
  // surge arcs from the heart to the collar, and four spikes of light
  if(S > 0.02){
    float k = floor(tm/2.3);
    for(int a=0;a<5;a++){
      float fa = float(a);
      vec3 dir = normalize(vec3(hash12(vec2(k, fa)) - 0.5, hash12(vec2(fa, k + 3.)) - 0.5, hash12(vec2(k + fa, 9.)) - 0.5)*2.);
      float len = 0.12 + 0.14*hash12(vec2(fa*3., k));
      for(int j=1;j<9;j++){
        float s = float(j)/9.;
        vec3 jit = vec3(noise(vec3(s*7., fa, tm*25.)), noise(vec3(s*7. + 3., fa, tm*25.)), noise(vec3(s*7. + 6., fa, tm*25.))) - 0.5;
        vec3 pp = CORE + dir*len*s + jit*0.05*sin(3.1416*s);
        col += mix(vec3(1.), mag, s*0.6)*pblob(o, d, pp, 0.003)*60.*S;
      }
    }
    for(int k2=0;k2<4;k2++){
      float an = float(k2)*1.5708 + floor(tm/2.3)*0.7;
      col += jet(o - CORE, d, normalize(vec3(cos(an), 0.15, sin(an))), 0.55, 0.002, 0.001, 0.5, tm*3., vec3(1.), cyan)*2.5*S;
    }
  }
  // engine plumes streaming aft, running lights on the wingtips, and the heart's glow
  float tk = 1. + spool + S;
  col += jet(o - vec3(0.005, -0.92, 0.), d, vec3(0., -1., 0.), 0.3, 0.03, 0.06, 1., tm*5., vec3(0.75, 0.95, 1.), vec3(0.2, 0.5, 1.))*(2.4 + 3.*spool + 7.*jg);
  for(int k=0;k<2;k++){
    float sg = k == 0 ? 1. : -1.;
    col += jet(o - vec3(0.025, -0.88, 0.22*sg), d, vec3(0., -1., 0.), 0.2, 0.02, 0.04, 1., tm*5. + sg, vec3(0.75, 0.95, 1.), vec3(0.2, 0.5, 1.))*(1.8 + 3.*spool + 5.*jg);
    col += (sg > 0. ? vec3(0.4, 1., 0.5) : vec3(1., 0.3, 0.25))*pblob(o, d, vec3(0.015, -0.47, 0.57*sg), 0.008)*30.*pow(0.5 + 0.5*sin(tm*2.7 + sg*1.3), 10.);
  }
  col += vec3(0.8, 0.95, 1.)*pblob(o, d, vec3(-0.02, 1.0, 0.), 0.006)*25.*pow(0.5 + 0.5*sin(tm*1.9), 12.);
  col += vec3(1., 0.9, 0.8)*(blob(o, d, CORE, 0.07)*2.2 + blob(o, d, CORE, 0.32)*0.22)*power*(1. - alpha*0.5);
  vec2 hf = sphIsect(o, d, vec3(0.), 0.96);
  if(hf.y > 0. && spool > 0.){ vec3 qn = normalize(o + d*max(hf.x, 0.)); col += vec3(0.5, 0.85, 1.)*pow(1. - abs(dot(qn, d)), 3.)*spool*1.3*(0.7 + 0.3*noise(qn*9. + tm)); }
  // the working lights on the belly: scan array, tractor emitter, bow gun (and drill), probe bay; the scoop's plasma sheath; the jump flare
  col += vec3(0.45, 0.9, 1.)*pblob(o, d, vec3(0.145, 0.18, 0.), 0.012)*45.*uP2.x;
  col += vec3(0.5, 1., 0.75)*pblob(o, d, vec3(0.145, -0.25, 0.), 0.014)*45.*uP2.y;
  col += vec3(1., 0.8, 0.55)*pblob(o, d, vec3(0.05, 0.93, 0.), 0.016)*55.*uP2.z;
  col += vec3(0.7, 1., 0.8)*pblob(o, d, vec3(0.145, -0.42, 0.), 0.01)*35.*uP2.w;
  if(uP1.w > 0.01) col += uP3.rgb*(blob(o, d, vec3(0.03, 0.82, 0.), 0.14)*5. + pblob(o, d, vec3(0.02, 0.96, 0.), 0.02)*30.)*uP1.w;
  if(jg > 0.01) col += vec3(0.75, 0.9, 1.)*blob(o, d, vec3(0.), 0.3)*jg*4.;
  outCol(col, alpha);
}`;

P.ship = program(VS_RECT, FS_SHIP);
const SHIP_TARGETS = ['earth', 'moon', 'jupiter', 'saturn', 'titan', 'sun', 'mars', 'sgra', 'betelgeuse', 'pillars', 'crab', 'etacar', 'catseye', 'hltau', 'omegacen', 'm87bh', 'andromeda',
  'm51', 'antennae', 'ton618', 'milkyway', 'antares', 'alphacen', 'trappist1', 'magnetar', 'sn1987a', 'galcentre', 'rsoph', 'europa', 'io', 'lmc', 'm104', '3c273', 'proxima', 'sirius', 'pleiades', 'casa', 'bubble', 'halley', 'ceres', 'southernring'];
// the ship itself. How it travels (light speed, folds) and what it does on each visit (scan, probe, weapons test, skim, tractor and drill) is in 07h-halo.js.
const shipOff = () => ship.viewOff || [0, 0, 0];
const ship = (() => {
  const RAD = 2.5*KM;
  // S: phase ('pass' | 'align' | 'light' | 'fold'), target (the body it is visiting: its parent), shader state (spool, jg jump glow, scale, scoop), em (belly lights)
  const S = { phase:'pass', t:0, target:null, spool:0, jg:0, scale:1, scoop:0, scoopC:[1, 0.6, 0.3], em:[0, 0, 0, 0], visits:0 };
  const o = addObj({ key:'halo', name:'the Halo', label:'Halo', labelClass:'ship', type:'long-range cruiser · a wandering starship that folds space', group:'travel', sortKey:0, layer:3,
    fact:'A long-range cruiser from a civilisation that learned to fold space. Its heart, seen through an open reactor bay mid-ship, is a captured sliver of star plasma held in spinning containment rings. It hops between the wonders of the universe: light speed for short hops, a fold through space for long ones. On each visit it does one job: a sensor scan, a probe launch, a weapons test, a skim through a gas giant or a star, or drilling a passing rock. (It is the only made-up thing in this atlas.)',
    // (seen from afar it is an engine glint; its hull fades in over a wide range of sizes, so flying up to it never pops it into view)
    pos:[0, 0, 0], rad:RAD, prog:P.ship, minZoom:1.2, pxMin:3, visFn:rpx => smooth(1.5, 12, rpx), noImpostor:false, farColor:[0.55, 0.8, 1], farLum:0.7, labelRange:1, selfPos:true, aka:'ship starship spaceship ring halo follow',
    // locked on, the camera always trails the ship (its frame turns with the ship: see the lock-follow in tick): from behind and above, lower and to one side, then pulled back
    // (camera frame, camFrame: +y is up from the deck, +z is behind the stern)
    // (off: while it works on something below its belly, the camera aims a little below the ship, so the job shows beneath it)
    views:[{d:[0, 0.32, 1], k:2.6, hold:10, drift:0, off:shipOff}, {d:[0.5, -0.08, 1], k:2.2, hold:9, drift:0, off:shipOff}, {d:[-0.4, 0.22, 1], k:4.2, hold:9, drift:0, off:shipOff}],
    setU(pr){ const L = S.target ? V.norm(V.sub(sun.rel, this.rel)) : [0, 1, 0], c = S.scoopC, e = S.em;
      gl.uniform4f(pr.u.uP0, S.spool, S.jg, S.scale, 0); gl.uniform4f(pr.u.uP1, L[0], L[1], L[2], S.scoop); gl.uniform4f(pr.u.uP2, e[0], e[1], e[2], e[3]); gl.uniform4f(pr.u.uP3, c[0], c[1], c[2], 0); },
    readout:() => haloReadout() });
  o.S = S;
  // the camera's frame for the ship: x = its starboard side, y = up from the deck (-x in the ship's own frame), z = behind the stern (-y).
  // It follows viewR, the ship's frame turned part of the way toward whatever the ship is working on, so a trailing camera keeps the job in the picture.
  const CAMQ = [0, 0, 1, -1, 0, 0, 0, -1, 0];
  o.camFrame = () => M3.mul(o.viewR || o.R0, CAMQ);
  return o;
})();

// ---------------------------------------------------------------- comets: new visitors dropping in from the Oort cloud, with an ion tail and a curved dust tail
const comets = (() => {
  const MAX = 3, NT = 420, list = [];
  const ps = makePS(MAX*(NT + 1));
  let next = 4;
  const spawn = () => {
    const q = 0.35 + 1.2*rnd(), inc = rnd()*Math.PI, node = rnd()*6.283, w = rnd()*6.283;
    const Rm = M3.mul(M3.rotY(node), M3.mul(M3.rotX(inc), M3.rotY(w)));
    const U = new Float32Array(NT), Ev = new Float32Array(NT*3); for (let j=0;j<NT;j++){ U[j] = rnd(); const e = V.mul(randDir(), rndn()); Ev.set(e, j*3); }
    list.push({ q, R:M3.mul(ECL, Rm), nu:-2.2, speed:0.9 + 0.4*rnd(), bright:0.6 + 0.8*rnd(), age:0, U, Ev });
  };
  const o = addObj({ key:'comets', name:'comets', label:'', type:'', layer:3, parent:sun, offset:[0, 0, 0], pos:[0, 0, 0], rad:3*AU_LY, noPick:true, noLabel:true, noImpostor:true, atlas:false,
    particleVis:() => 1,
    update(dt){
      next -= dt; if (next < 0 && list.length < MAX){ spawn(); next = 12 + rnd()*14; }
      let k = 0;
      for (let i=list.length - 1; i>=0; i--){
        const c = list[i]; c.age += dt;
        // parabolic orbit: r = 2q/(1 + cos nu), true anomaly advanced with a compressed clock
        const r = 2*c.q/(1 + Math.cos(c.nu)); c.nu += dt*c.speed*0.06*Math.pow(c.q/r, 1.5)*Math.sqrt(2)*3;
        if (c.nu > 2.3){ list.splice(i, 1); continue; }
      }
      for (const c of list){
        const r = 2*c.q/(1 + Math.cos(c.nu));
        const pl = M3.apply(c.R, [r*Math.cos(c.nu), 0, -r*Math.sin(c.nu)]), p = V.mul(pl, AU_LY);
        const vdir = V.norm(V.sub(M3.apply(c.R, [2*c.q/(1 + Math.cos(c.nu + 0.01))*Math.cos(c.nu + 0.01), 0, -2*c.q/(1 + Math.cos(c.nu + 0.01))*Math.sin(c.nu + 0.01)]), pl));
        const anti = V.norm(p), act = clamp(1.6/(r*r), 0, 3)*c.bright, len = Math.min(0.4*act + 0.04, 0.9)*AU_LY;
        ps.a.set([p[0], p[1], p[2], 1.5 + act], k*4); ps.c.set([0.85, 0.95, 1, 0], k*4); k++;
        for (let j=0;j<NT;j++){
          const u = (c.U[j] + c.age*0.08*(j % 2 ? 1 : 0.6)) % 1, ion = j % 3 === 0;
          let q;
          if (ion) q = V.add(p, V.mul(anti, u*len*1.3));
          else { const bend = u*u*0.45; q = V.add(p, V.add(V.mul(anti, u*len*0.8), V.mul(vdir, -bend*len))); }
          const sc = (ion ? 0.004 : 0.012)*len*(0.3 + u*2);
          q = [q[0] + c.Ev[j*3]*sc, q[1] + c.Ev[j*3 + 1]*sc, q[2] + c.Ev[j*3 + 2]*sc];
          const b = ((1 - u)*(ion ? 0.8 : 1)*act + 0.05)*0.9;
          ps.a.set([q[0], q[1], q[2], b], k*4); ps.c.set(ion ? [0.45, 0.7, 1, 0] : [1, 0.88, 0.62, 0], k*4); k++;
        }
      }
      ps.count = k; if (k) ps.upload('ac');
    },
    particles:[{ ps, prog:'ptBasic', mode:3, sb:0.6, size:1.6, rad:1, rot:() => I3, show:() => ps.count > 0, vis:() => smooth(2e-6, 2e-5, orbit.dist)*(1 - smooth(0.004, 0.03, orbit.dist)) }] });
  o.list = list;
  return o;
})();

// ---------------------------------------------------------------- the Sun seen from the planets: at its true size it is a small disc there (about 1% of the screen from Earth),
// so it gets a soft round glare: a tight bright glow hugging the disc and a much fainter, wider halo around it (no rays, so the
// Sun stays round). It fades as its disc grows large enough to speak for itself, and when a planet or moon moves in front of it
// (sun.occ, from updateSunOcc). The same glow marks Alpha Centauri B seen from beside A (the brightest star in A's sky).
const glowPS = makePS(1); glowPS.a.set([0, 0, 0, 1], 0); glowPS.c.set([1, 0.88, 0.68, 0], 0); glowPS.upload('ac');
function glare(o, a, k){
  if (a < 0.01) return;
  drawParticles(null, { ps:glowPS, prog:'ptBasic', mode:3, sb:a*1.8, size:9*k, rad:1, rel:() => o.rel, rot:() => I3 });
  drawParticles(null, { ps:glowPS, prog:'ptBasic', mode:3, sb:a*0.42, size:34*k, rad:1, rel:() => o.rel, rot:() => I3 });
}
EXTRAS.push(() => {
  if (SKYV.on) return;
  const S = sun, d = S.dist;
  if (!S.hidden && d > 0 && V.dot(S.rel, cam.fwd) > 0){
    const rpxS = coreOf(S)*magOf(S)/d*(sceneH*0.5/tanY);
    glare(S, (1 - smooth(12, 45, rpxS))*(1 - smooth(60*AU_LY, 600*AU_LY, d))*(1 - SYSMAG.k)*(S.occ ?? 1), 1);
  }
  const B = alphaCenB;
  if (orbit.lock === alphaCen.index && B.dist > 0 && V.dot(B.rel, cam.fwd) > 0 && B.dist < 60*AU_LY) glare(B, 0.8*(1 - smooth(8, 30, B.rpx || 0)), 0.7);
});

// ---------------------------------------------------------------- meteors burning up in Earth's atmosphere, and distant gamma-ray bursts
const meteorPS = makePS(12), grbPS = makePS(1), grbSp = makeSpikes([{ p:[0, 0, 0], w:1, c:[0.85, 0.9, 1] }]);
const transient = { meteors:[], mNext:2, grb:null, gNext:10 };
EXTRAS.push(() => {
  const dt = 1/60*timeScale, E = earth;
  // meteors: only worth drawing when Earth is close and large on screen
  transient.mNext -= dt;
  if (E.rpx > 60 && E.dist < E.rad*8){
    if (transient.mNext < 0){ transient.mNext = 1.5 + rnd()*3; const n = V.norm(randDir()), side = V.norm(V.cross(n, randDir())); transient.meteors.push({ n, side, t:0, dur:0.7 + 0.5*rnd() }); }
    let k = 0;
    for (let i=transient.meteors.length - 1; i>=0; i--){ const m = transient.meteors[i]; m.t += dt; if (m.t > m.dur){ transient.meteors.splice(i, 1); continue; }
      const u = m.t/m.dur, R = E.rad*0.893*(1.018 - 0.01*u), a = V.add(V.mul(m.n, R), V.mul(m.side, E.rad*0.05*u)), b = V.add(a, V.mul(m.side, -E.rad*0.02));
      meteorPS.a.set([a[0], a[1], a[2], 1], k*8); meteorPS.a.set([b[0], b[1], b[2], 0], k*8 + 4); meteorPS.c.set([1, 0.9, 0.7, 0], k*8); meteorPS.c.set([1, 0.6, 0.3, 0], k*8 + 4); k++; }
    if (k){ meteorPS.count = k*2; meteorPS.upload('ac'); drawParticles(null, { ps:meteorPS, prog:'lnBasic', lines:true, mode:3, sb:1.4, size:1, rad:1, rel:() => E.rel, rot:() => I3, count:() => k*2 }); }
  }
  // gamma-ray bursts: a star collapsing or neutron stars merging, billions of light-years away, visible for a moment
  transient.gNext -= dt;
  if (!transient.grb && transient.gNext < 0 && orbit.dist > 3e6){ const d = randDir(); transient.grb = { p:V.mul(d, 5e9 + 2e10*rnd()), t:0 }; }
  if (transient.grb){ const g = transient.grb; g.t += dt; const amp = g.t < 0.15 ? g.t/0.15 : Math.exp(-(g.t - 0.15)/0.9);
    if (g.t > 4){ transient.grb = null; transient.gNext = 12 + rnd()*20; }
    else { const rel = V.sub(V.sub(g.p, earth.pos), V.sub(cam.rel, frel(earth))); grbPS.a.set([0, 0, 0, 1], 0); grbPS.c.set([0.9, 0.93, 1, 0], 0); grbPS.upload('ac');
      if (V.dot(rel, cam.fwd) > 0){ drawParticles(null, { ps:grbPS, prog:'ptBasic', mode:3, sb:amp*2.2, size:4, rad:1, rel:() => rel, rot:() => I3 });
        drawParticles(null, { ps:grbSp, prog:'spike', lines:true, mode:1, sb:1, size:1, len:0.05, rad:1, rel:() => rel, rot:() => I3, q0:() => [amp*1.5, 0, 0, 0] }); } } }
});

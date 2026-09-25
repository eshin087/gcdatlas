
// ================================================================ travellers and transients: the Halo (a ring ship that folds space), comets, meteors, gamma-ray bursts
// ---------------------------------------------------------------- the Halo: a ring hull, three spokes and a star-bright core (local: bounding sphere 1, ring axis +y = forward)
const FS_SHIP = COMMON + `
// the Halo: an original crescent flagship. Local frame: bounding sphere 1, forward +y, wings along z, belly (+x) toward what it studies.
float sdCres(vec2 q){ return max(length(q - vec2(0., -0.05)) - 0.88, -(length(q - vec2(0., -0.28)) - 0.8)); }
float thick(float y){ return 0.008 + 0.06*smoothstep(-0.46, 0.7, y); }
float sdOct(vec3 p, float s){ p = abs(p); return (p.x + p.y + p.z - s)*0.57735027; }
const vec3 CORE = vec3(0., 0.08, 0.);
float map(vec3 p, out float id){
  vec2 q = p.zy;
  float c2 = sdCres(q), t = thick(p.y);
  vec2 w = vec2(c2, abs(p.x) - t);
  float hull = min(max(w.x, w.y), 0.) + length(max(w, 0.)) - 0.003;
  // a raised spine along the crest of the crescent, on the side facing away from the target
  float mid = length(q - vec2(0., -0.16)) - 0.84;
  float ridge = max(length(vec2(mid, p.x + t*0.8)) - 0.014, c2 + 0.004);
  // the bow spike
  vec3 bp = p - vec3(0., 0.83, 0.);
  float bow = max(length(bp.xz) - 0.03*(1. - clamp(bp.y/0.14, 0., 1.)), abs(bp.y - 0.07) - 0.07);
  // engine nacelles riding the swept wingtips
  vec3 ep = vec3(p.x, p.y + 0.36, abs(p.z) - 0.8);
  float eng = (length(ep/vec3(0.05, 0.12, 0.05)) - 1.)*0.05;
  float c = cos(uTime*0.7), s = sin(uTime*0.7);
  vec3 cp = p - CORE; cp = vec3(cp.x*c - cp.z*s, cp.y, cp.x*s + cp.z*c);
  float core = sdOct(cp, 0.1);
  float d = min(min(hull, ridge), min(bow, eng));
  id = core < d ? 2. : (eng < min(min(hull, ridge), bow) ? 1. : 0.);
  return min(d, core);
}
vec3 nrm(vec3 p){ float id; vec2 e = vec2(0.0015, 0.); return normalize(vec3(map(p + e.xyy, id) - map(p - e.xyy, id), map(p + e.yxy, id) - map(p - e.yxy, id), map(p + e.yyx, id) - map(p - e.yyx, id))); }
void main(){
  vec3 o, d; localRay(o, d);
  vec2 hb = sphIsect(o, d, vec3(0.), 1.);
  if(hb.y < 0.) discard;
  float spool = uP0.x, tm = uTime;
  vec3 L = normalize(uP1.xyz*uRot);
  vec3 cyan = vec3(0.35, 0.85, 1.), gold = vec3(0.96, 0.72, 0.33);
  float t = max(hb.x, 0.), id = 0.; bool hit = false;
  for(int i=0;i<96;i++){ vec3 p = o + d*t; float h = map(p, id); if(h < 0.0007) { hit = true; break; } t += h*0.9; if(t > hb.y) break; }
  vec3 col = vec3(0.); float alpha = 0.;
  if(hit){
    vec3 p = o + d*t, n = nrm(p);
    float dif = max(dot(n, L), 0.);
    if(id > 1.5){
      col = mix(vec3(0.55, 0.92, 1.), vec3(1.), 0.35)*(2.4 + 2.2*spool)*(0.85 + 0.15*sin(tm*5.));
    } else if(id > 0.5){
      // nacelle: bronze shell, a glowing intake band and a hot blue nozzle at the rear
      float band = exp(-pow((p.y + 0.36)/0.012, 2.)), noz = smoothstep(-0.42, -0.47, p.y);
      col = vec3(0.62, 0.45, 0.22)*(dif*1.1 + 0.2) + cyan*(band*1.4 + noz*2.2)*(1. + spool);
    } else {
      float ang = atan(p.z, p.y + 0.05);
      float plate = step(0.5, fract(ang*4.456));
      float seam = smoothstep(0.02, 0., abs(fract(ang*4.456) - 0.5) - 0.47);
      vec3 base = mix(gold, gold*vec3(0.86, 0.8, 0.72), plate)*(1. - 0.5*seam);
      vec3 h = normalize(L - d);
      float spec = pow(max(dot(n, h), 0.), 40.);
      vec3 toC = CORE - p; float coreLit = max(dot(n, normalize(toC)), 0.)*0.7/(dot(toC, toC)*5. + 0.35);
      // energy seams along both edges of the crescent, with light flowing toward the bow
      float e = -sdCres(p.zy), edge = exp(-e/0.006);
      float flow = 0.55 + 0.45*sin(ang*26. + tm*(2. + 5.*spool));
      // key light from the nearest star, plus a soft fill so the gold always reads, and a bright rim along the silhouette
      float fill = 0.36 + 0.25*max(dot(n, -d), 0.), rim = pow(1. - max(dot(n, -d), 0.), 3.);
      col = base*(dif*1.1 + fill) + gold*spec*1.3 + gold*rim*0.35 + cyan*coreLit*(1. + spool) + cyan*edge*flow*(0.6 + 1.6*spool);
    }
    alpha = 1.;
  }
  // the energy sail: a translucent membrane across the hollow of the crescent, rippling out from the core
  if(abs(d.x) > 1e-4){
    float ts = -o.x/d.x;
    if(ts > 0. && (!hit || ts < t)){
      vec3 q = o + d*ts;
      float inner = -(length(q.zy - vec2(0., -0.28)) - 0.8), chord = q.y + 0.44;
      if(inner > 0. && chord > 0.){
        float r = length(q - CORE);
        float ripple = pow(0.5 + 0.5*sin(r*36. - tm*(2.2 + 7.*spool)), 3.);
        float grain = fbm3(vec3(q.zy*8., tm*0.12));
        float ef = smoothstep(0., 0.05, inner)*smoothstep(0., 0.1, chord);
        float I = (0.07 + 0.4*ripple*exp(-r*1.8) + 0.3*grain*grain*grain)*ef*(0.55 + 1.8*spool);
        col = col*(1. - 0.15*ef) + mix(vec3(0.25, 0.65, 1.), vec3(0.7, 0.95, 1.), ripple*0.6)*I;
        alpha = max(alpha, 0.12*ef);
      }
    }
  }
  // tethers of light holding the core, engine plumes, wingtip beacons, core glow
  float tk = 1. + spool;
  col += jet(o - CORE, d, vec3(0., 1., 0.), 0.45, 0.005, 0.003, 0.6, tm*2., cyan, vec3(0.8, 0.95, 1.))*0.7*tk;
  for(int k=0;k<2;k++){
    float sg = k == 0 ? 1. : -1.;
    col += jet(o - CORE, d, normalize(vec3(0., -0.44, 0.7*sg)), 0.9, 0.005, 0.003, 0.6, tm*2. + sg, cyan, vec3(0.8, 0.95, 1.))*0.6*tk;
    col += jet(o - vec3(0., -0.48, 0.8*sg), d, vec3(0., -1., 0.), 0.16, 0.018, 0.04, 1., tm*5. + sg, vec3(0.75, 0.95, 1.), vec3(0.2, 0.5, 1.))*(2.2 + 3.*spool);
    col += vec3(0.75, 0.95, 1.)*pblob(o, d, vec3(0., -0.45, 0.78*sg), 0.01)*35.*pow(0.5 + 0.5*sin(tm*2.7 + sg*1.3), 10.);
  }
  col += vec3(0.6, 0.92, 1.)*(blob(o, d, CORE, 0.13)*1.5 + blob(o, d, CORE, 0.42)*0.2)*(1. + 2.*spool)*(1. - alpha*0.6);
  // the fold field wrapping the ship as the drive spools up
  vec2 hf = sphIsect(o, d, vec3(0.), 0.96);
  if(hf.y > 0. && spool > 0.){ vec3 qn = normalize(o + d*max(hf.x, 0.)); col += vec3(0.5, 0.85, 1.)*pow(1. - abs(dot(qn, d)), 3.)*spool*1.3*(0.7 + 0.3*noise(qn*9. + tm)); }
  outCol(col, alpha);
}`;
P.ship = program(VS_RECT, FS_SHIP);
const SHIP_TARGETS = ['earth', 'moon', 'jupiter', 'saturn', 'titan', 'sun', 'mars', 'sgra', 'betelgeuse', 'pillars', 'crab', 'etacar', 'catseye', 'hltau', 'omegacen', 'm87bh', 'andromeda',
  'm51', 'antennae', 'ton618', 'milkyway', 'antares', 'alphacen', 'trappist1', 'magnetar', 'sn1987a', 'galcentre', 'rsoph', 'europa', 'io', 'lmc', 'm104', '3c273', 'proxima', 'sirius'];
const folds = [];   // space-fold effects: { pos (world), t, kind: 0 departure / 1 arrival, size }
const ship = (() => {
  const RAD = 2.5*KM;
  const S = { state:'observe', t:0, T:26, target:null, basis:null, th0:0, dir:1, spool:0, visits:0, fromFold:null };
  const o = addObj({ key:'halo', name:'the Halo', label:'Halo', labelClass:'ship', type:'crescent flagship · a wandering starship that folds space', group:'travel', sortKey:0, layer:3,
    fact:'A crescent-winged flagship from a civilisation that learned to fold space. It hops between the wonders of the universe and sweeps around each one for a look. (It is the only made-up thing in this atlas.)',
    pos:[0, 0, 0], rad:RAD, prog:P.ship, minZoom:1.2, pxMin:3, noImpostor:true, labelRange:1, selfPos:true, aka:'ship starship spaceship ring halo follow',
    views:[{d:[-0.72, 0.3, 0.62], k:2.4, hold:10, drift:0.05}, {d:[-0.32, -0.9, 0.25], k:2.1, hold:9, drift:0.03}, {d:[0.8, 0.12, 0.55], k:3.4, hold:8, drift:0.04}],
    setU(pr){ const L = S.target ? V.norm(V.sub(sun.rel, this.rel)) : [0, 1, 0]; gl.uniform4f(pr.u.uP0, S.spool, 0, 0, this.t*0.15); gl.uniform4f(pr.u.uP1, L[0], L[1], L[2], 0); },
    readout:() => S.state === 'spool' ? 'fold drive spooling up · space ahead is about to fold' :
      (S.target ? `visiting ${S.target.name} · visit ${S.visits}\n~2.5 km wingtip to wingtip · a crystal core holds its energy sail` : 'between the stars') });
  o.S = S;
  const pathPos = (s) => {
    const tg = S.target, R = tg.rad*(tg.layer < 3 ? 1.5 : 3.1)*(1 - 0.42*Math.sin(Math.PI*s)), th = S.th0 + S.dir*2.6*s, el = 0.32*Math.sin(2*Math.PI*s);
    const [u, v, w] = S.basis;
    return V.add(V.mul(u, R*Math.cos(th)*Math.cos(el)), V.add(V.mul(w, R*Math.sin(th)*Math.cos(el)), V.mul(v, R*Math.sin(el))));
  };
  function place(){
    const s = clamp(S.t/S.T, 0, 1);
    const p = pathPos(s), p2 = pathPos(Math.min(s + 0.004, 1)), fwd = V.norm(V.sub(p2, p));
    o.parent = S.target; o.offset = p; o.pos = V.add(S.target.pos, p);
    const toT = V.norm(V.mul(p, -1));
    const R = frameY(fwd, toT);
    o.R0 = M3.mul(R, M3.rotY(Math.sin(S.t*0.35)*0.22)); o.rot = o.R0;
  }
  function pickTarget(){
    const cur = OBJ[tour.on ? tour.obj : (orbit.lock >= 0 ? orbit.lock : cam.focus)];
    let tg = null;
    if (cur && cur !== o && SHIP_TARGETS.includes(cur.key) && S.target !== cur && rnd() < 0.45) tg = cur;
    while (!tg || tg === S.target) tg = BYKEY[SHIP_TARGETS[Math.floor(rnd()*SHIP_TARGETS.length)]];
    return tg;
  }
  function arrive(tg){
    S.target = tg; S.t = 0; S.T = 24 + rnd()*10; S.dir = rnd() < 0.5 ? -1 : 1; S.th0 = rnd()*6.283; S.visits++;
    const u = V.norm(randDir()), v0 = V.norm(V.cross(u, randDir())), w = V.cross(u, v0);
    S.basis = [u, v0, w];
    place();
    o.labelRange = Math.max(tg.rad*40, RAD*1e4);
    folds.push({ pos:o.pos.slice(), parent:tg, off:o.offset.slice(), t:0, kind:1, size:Math.max(RAD*30, tg.rad*0.05) });
  }
  o.update = function(dt){
    if (!S.target) arrive(BYKEY.saturn);
    // hold position at the arrival point while a following camera is still flying in
    if (flight && flight.obj === o){ place(); return; }
    S.t += dt;
    if (S.state === 'observe'){ if (S.t > S.T - 2.5){ S.state = 'spool'; } }
    S.spool = S.state === 'spool' ? smooth(S.T - 2.5, S.T, S.t) : Math.max(0, S.spool - dt);
    if (S.t >= S.T){
      folds.push({ pos:o.pos.slice(), parent:S.target, off:o.offset.slice(), t:0, kind:0, size:Math.max(RAD*30, S.target.rad*0.05) });
      const following = !tour.on && (orbit.lock === o.index || (flight && flight.obj === o));
      if (following && flight) finishFlightHere();
      // re-anchor the camera on the old target so it stays put while the ship folds away
      if (cam.focus === o.index){ const D = frel(S.target); cam.rel = V.sub(cam.rel, D); orbit.target = V.sub(orbit.target, D); cam.focus = S.target.index; }
      S.state = 'observe'; S.spool = 0;
      arrive(pickTarget());
      if (following){ const vp = viewParams(o, 0); startFlight(o, vp, null); flight.dur = Math.max(flight.dur, 5); toast('following the Halo to ' + S.target.name); }
      return;
    }
    place();
  };
  return o;
})();
// fold effects, scan beams and the ship's beacon, drawn after everything else
const foldRing = ringPS(96, [0.55, 0.9, 1]), beaconPS = makePS(1), beamPS = makePS(16);
beaconPS.c.set([0.6, 0.95, 1, 0], 0); beaconPS.upload('c');
function camFacing(){ return [...cam.right, ...V.mul(cam.fwd, -1), ...cam.up]; }   // local xz plane faces the camera
EXTRAS.push(() => {
  const dt = 1/60;
  for (let i=folds.length - 1; i>=0; i--){
    const f = folds[i]; f.t += dt*timeScale;
    if (f.t > 3){ folds.splice(i, 1); continue; }
    const rel = V.sub(V.add(frel(f.parent), f.off), cam.rel), dist = V.len(rel);
    if (V.dot(rel, cam.fwd) <= 0) continue;
    const scale = Math.max(f.size, dist*0.03);
    // departure: space folds inward to a point; arrival: a flash and rings rippling outward
    for (let k=0;k<3;k++){
      const u = clamp(f.t/1.6 - k*0.18, 0, 1); if (u <= 0 || u >= 1) continue;
      const r = f.kind ? scale*(0.2 + 3.2*u) : scale*(3.2*(1 - u) + 0.05), b = (f.kind ? (1 - u) : u*(1 - u)*3)*(0.8 - k*0.2);
      drawParticles(null, { ps:foldRing, prog:'lnBasic', lines:true, mode:3, sb:b*1.2, size:1, rad:r, rel:() => rel, rot:camFacing });
    }
    const fl = f.kind ? Math.exp(-f.t*3) : smooth(0.9, 1.3, f.t)*Math.exp(-(f.t - 1.3)*4);
    if (fl > 0.01){ beaconPS.a.set([0, 0, 0, 1], 0); beaconPS.upload('a'); drawParticles(null, { ps:beaconPS, prog:'ptBasic', mode:3, sb:fl*3, size:6, rad:1, rel:() => rel, rot:() => I3 }); }
  }
  // the ship's beacon when it is too small to see, and its scanning beams toward what it is studying
  const S = ship.S;
  if (S.target && ship.dist < ship.labelRange && V.dot(ship.rel, cam.fwd) > 0){
    if (ship.rpx < 3){ beaconPS.a.set([0, 0, 0, 1], 0); beaconPS.upload('a'); drawParticles(null, { ps:beaconPS, prog:'ptBasic', mode:3, sb:0.7 + 0.3*Math.sin(ship.t*5), size:2.4, rad:1, rel:() => ship.rel, rot:() => I3 }); }
    const s = S.t/S.T;
    if (s > 0.35 && s < 0.7){
      const tr = S.target.rel, amp = Math.sin((s - 0.35)/0.35*Math.PI);
      for (let k=0;k<8;k++){
        const j = V.mul(V.norm([Math.sin(k*2.3 + ship.t), Math.cos(k*1.7 + ship.t*1.3), Math.sin(k*3.1)]), S.target.rad*(S.target.layer < 3 ? 0.35 : 0.7));
        const a = V.sub(ship.rel, ship.rel), b = V.sub(V.add(tr, j), ship.rel);
        beamPS.a.set([0, 0, 0, 1], k*8); beamPS.a.set([b[0], b[1], b[2], 0], k*8 + 4);
        beamPS.c.set([0.45, 0.9, 1, 0], k*8); beamPS.c.set([0.45, 0.9, 1, 0], k*8 + 4);
      }
      beamPS.upload('ac');
      drawParticles(null, { ps:beamPS, prog:'lnBasic', lines:true, mode:3, sb:0.35*amp*(0.6 + 0.4*Math.sin(ship.t*13)), size:1, rad:1, rel:() => ship.rel, rot:() => I3 });
    }
  }
});

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

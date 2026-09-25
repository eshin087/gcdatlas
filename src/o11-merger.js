
// ================================================================ 11 binary neutron star merger (GW170817-like)
const FS_NSMERGER = COMMON + `
void main(){
  vec3 o, d; localRay(o, d);
  float a = uP0.x, ph = uP0.y, flash = uP0.z, grb = uP0.w;
  float Rk = uP1.y, kb = uP1.z, kr = uP1.w;
  float fade = uP2.w, tm = uP3.x, torus = uP3.y;
  vec3 col = vec3(0.); float alpha = 0.;
  if(a > 0.){
    // two neutron stars, tidally stretched toward each other as they close in
    vec3 ax = vec3(cos(ph), 0., sin(ph)), s1 = 0.5*a*ax;
    float stretch = smoothstep(0.12, 0.05, a);
    for(int k=0;k<2;k++){
      vec3 c = k == 0 ? s1 : -s1;
      col += vec3(0.75, 0.85, 1.)*(pblob(o, d, c, 0.006)*900. + blob(o, d, c, 0.025)*5.);
      col += vec3(0.8, 0.88, 1.)*blob(o, d, c - sign(float(k) - 0.5)*ax*0.018*stretch, 0.012)*stretch*25.;
    }
    col += vec3(0.7, 0.8, 1.)*blob(o, d, vec3(0.), a*0.6)*smoothstep(0.1, 0.05, a)*6.;
  } else {
    col += vec3(0.8, 0.88, 1.)*blob(o, d, vec3(0.), 0.04 + 0.12*(1. - exp(-flash)))*flash;
    if(tm < 0.8){
      // hypermassive neutron star: a spinning bar that lives for a fraction of a second
      vec3 bx = vec3(cos(tm*40.), 0., sin(tm*40.));
      col += vec3(0.85, 0.9, 1.)*(blob(o, d, bx*0.012, 0.012) + blob(o, d, -bx*0.012, 0.012))*30.;
    } else {
      // collapse to a black hole wrapped in a hot torus
      vec2 hb = sphIsect(o, d, vec3(0.), 0.012);
      vec2 ht = sphIsect(o, d, vec3(0.), 0.08);
      vec3 tc = vec3(0.);
      if(ht.y > 0.){
        float t0 = max(ht.x, 0.), dt = (ht.y - t0)/18.;
        for(int i=0;i<18;i++){
          vec3 p = o + d*(t0 + (float(i) + 0.5)*dt);
          if(hb.x > 0. && t0 + (float(i) + 0.5)*dt > hb.x) break;
          float rho = length(p.xz);
          float dn = exp(-(pow(rho - 0.04, 2.) + p.y*p.y*2.)/0.00018)*(0.5 + 0.9*noise(vec3(rot2(tm*3./(rho*30. + 0.2))*p.xz*300., p.y*300.)));
          tc += blackbody(9000. + 30000.*exp(-rho/0.03))*dn*dt*90.;
        }
      }
      col += tc*torus;
      if(hb.x > 0.) alpha = 1.;
    }
    // gamma-ray burst jets drilling through the ejecta, and their hot cocoon
    col += jet(o, d, vec3(0., 1., 0.), 0.95, 0.003, 0.03, 1., uTime*2., vec3(1.), vec3(0.8, 0.85, 1.))*grb*1.6;
    col += jet(o, d, vec3(0., -1., 0.), 0.95, 0.003, 0.03, 1., uTime*2. + 1., vec3(1.), vec3(0.8, 0.85, 1.))*grb*1.6;
    col += vec3(0.9, 0.7, 1.)*(blob(o, d, vec3(0., 0.25*Rk, 0.), 0.18*Rk) + blob(o, d, vec3(0., -0.25*Rk, 0.), 0.18*Rk))*grb*0.4;
    // kilonova: fast blue polar ejecta fading first, slow red lanthanide-rich ejecta lingering
    col += vec3(0.35, 0.55, 1.)*(blob(o, d, vec3(0., 0.38*Rk, 0.), 0.55*Rk) + blob(o, d, vec3(0., -0.38*Rk, 0.), 0.55*Rk))*kb;
    col += vec3(1., 0.34, 0.16)*blob(o, d, vec3(0.), Rk*0.85)*kr;
  }
  outCol(col*fade, alpha*fade);
}`;
// warped spacetime: a grid in the orbital plane sagging into the potential well and rippling with the quadrupole wave pattern
const PB_GWGRID = `void body(out vec3 p, out float br, out vec3 col){
  p = vec3(aP.x, 0., aP.y);
  float r = length(p.xz), psi = atan(p.z, p.x);
  float tIn = uQ0.x, Tin = uQ0.y, w0 = uQ0.z, cv = uQ0.w;
  float h = 0., tret = tIn - r/cv;
  if(tret > 0. && tret < Tin){ float x = max(1. - tret/Tin, 1e-4); h = cos(2.*(psi - w0*Tin*1.6*(1. - pow(x, 0.625))))/pow(x, 0.25); }
  else if(tret >= Tin){ float s = tret - Tin; h = cos(2.*psi - s*45.)*exp(-s*2.5)*0.8; }
  float amp = 0.028/max(r, 0.15);
  p.y = -0.01/(r + 0.035) + clamp(h*amp, -0.09, 0.09)*smoothstep(1., 0.65, r);
  br = (0.35 + min(9.*abs(h)*amp, 1.4))*smoothstep(1., 0.7, r)*uQ1.x;
  col = h > 0. ? vec3(0.35, 0.58, 1.) : vec3(0.78, 0.38, 1.);
}`;
P.lnGrid = program(particleVS(PB_GWGRID), FS_LINE);

const merger = (() => {
  const Tin = 22, a0 = 0.34, w0 = 1.1, CYCLE = 44, TM = Tin - 0.06, CV = 0.3;
  const nEj = Math.round(2600*QUALITY), nTrail = 240, ej = makePS(nEj), tr = makePS(nTrail*2);
  const dirs = new Float32Array(nEj*3), spd = new Float32Array(nEj), blue = new Uint8Array(nEj);
  for (let i=0;i<nEj;i++){
    let d = randDir(); const polar = rnd() < 0.45;
    if (polar){ d[1] = Math.sign(d[1] || 1)*(0.6 + 0.4*Math.abs(d[1])); d = V.norm(d); } else { d[1] *= 0.35; d = V.norm(d); }
    dirs.set(d, i*3); blue[i] = polar ? 1 : 0; spd[i] = polar ? 0.8 + 0.5*rnd() : 0.4 + 0.45*rnd();
    const c = polar ? [0.45, 0.62, 1] : (rnd() < 0.5 ? [1, 0.38, 0.2] : [1, 0.62, 0.3]);
    ej.c.set([c[0], c[1], c[2], 0], i*4);
  }
  ej.upload('ac');
  for (let i=0;i<nTrail*2;i++) tr.c.set([0.55, 0.72, 1, 0], i*4);
  tr.upload('c');
  // grid lines
  const G = IS_SMALL ? 30 : 44, SEG = IS_SMALL ? 36 : 56, grid = makePS(2*(G + 1)*SEG*2); let gk = 0;
  for (let dir=0; dir<2; dir++) for (let i=0;i<=G;i++){ const u = -1 + 2*i/G;
    for (let s=0;s<SEG;s++){ for (const e of [s, s + 1]){ const v = -1 + 2*e/SEG; grid.a.set(dir ? [u, v, 0, 1] : [v, u, 0, 1], gk*4); grid.c.set([0, 0, 0, 0], gk*4); gk++; } } }
  grid.count = gk; grid.upload('ac');
  const hist = []; let lastSample = -1;
  const st = { t:0, a:a0, ph:0, flash:0, grb:0, Rk:0, kb:0, kr:0, fade:1, merged:false, tm:0, torus:0 };
  st.reset = (t=0) => { st.t = t; hist.length = 0; lastSample = -1; };
  st.update = dt => {
    st.t += dt; if (st.t > CYCLE) st.reset(0);
    const t = st.t;
    st.fade = smooth(0, 1, t)*(1 - smooth(CYCLE - 2, CYCLE, t));
    if (t < TM){
      const x = 1 - t/Tin; st.a = a0*Math.pow(x, 0.25); st.ph = w0*Tin*1.6*(1 - Math.pow(x, 0.625)); st.merged = false;
      st.flash = 0; st.grb = 0; st.Rk = 0; st.kb = 0; st.kr = 0; st.tm = 0; st.torus = 0;
      if (t - lastSample > 0.02){ lastSample = t; hist.push([t, st.a, st.ph]); if (hist.length > nTrail) hist.shift(); }
    } else {
      const tm = t - TM; st.merged = true; st.a = 0; st.tm = tm;
      st.flash = 10*Math.exp(-tm/0.3);
      st.grb = tm > 0.8 && tm < 7 ? 7*Math.exp(-(tm - 0.8)/1.1) : 0;
      st.torus = smooth(0.8, 1.2, tm)*Math.exp(-(tm - 0.8)/9);
      st.Rk = 0.04 + 0.72*(1 - Math.exp(-tm/7));
      st.kb = 2.2*Math.exp(-tm/3)*smooth(0, 0.6, tm);
      st.kr = 1.2*(1 - Math.exp(-tm/1.8))*Math.exp(-tm/14);
    }
    for (let k=0;k<nTrail;k++){
      const h = hist[hist.length - 1 - k];
      for (let s=0;s<2;s++){
        const i = (k*2 + s)*4;
        if (!h){ tr.a[i+3] = 0; continue; }
        const ang = h[2] + s*Math.PI, r = 0.5*h[1];
        tr.a[i] = r*Math.cos(ang); tr.a[i+1] = 0; tr.a[i+2] = r*Math.sin(ang);
        tr.a[i+3] = Math.exp(-(t - h[0])/1.6)*(st.merged ? Math.exp(-(t - TM)*2) : 1)*0.9*st.fade;
      }
    }
    tr.upload('a');
    const tm = Math.max(t - TM, 0), Rs = 0.75*(1 - Math.exp(-tm/7));
    for (let i=0;i<nEj;i++){
      const s = spd[i]*Rs, wob = 1 + 0.08*Math.sin(i*1.7 + tm*0.5);
      ej.a[i*4] = dirs[i*3]*s*wob; ej.a[i*4+1] = dirs[i*3+1]*s*wob; ej.a[i*4+2] = dirs[i*3+2]*s*wob;
      ej.a[i*4+3] = st.merged ? (blue[i] ? 1.6*Math.exp(-tm/3.2) : 1.1*(1 - Math.exp(-tm/1.8))*Math.exp(-tm/15))*st.fade : 0;
    }
    ej.upload('a');
  };
  const days = () => Math.pow(10, (st.t - TM)/(CYCLE - TM)*1.4) - 0.9;
  const hostPos = radec(hms(13,9,47.7), dms(-23,23,2), 130e6);
  const host = addGalaxy({ key:'ngc4993', name:'NGC 4993', label:'NGC 4993', type:'lenticular galaxy · host of GW170817', sortKey:130e6, atlas:false,
    fact:'An ordinary-looking galaxy where, 130 million years ago, two neutron stars collided. Its gravitational waves reached Earth on 17 August 2017.',
    pos:hostPos, rad:40000, incl:60, pa:0, g:{ arms:0, bulge:1.6, dust:0.8, H:0.03, sf:0.05, Rd:0.3, ring:0.35, irr:0.4, seed:61 }, readout:() => '130 million light-years' });
  const side = V.norm(V.cross(V.norm(hostPos), [0, 0, 1])), offset = V.mul(side, 6500);
  const o = addObj({ key:'gw170817', name:'GW170817', label:'GW170817', type:'neutron star merger · first seen in gravitational waves and light', group:'galaxies', sortKey:130e6 + 1,
    fact:'Two neutron stars spiral in, shaking spacetime with gravitational waves, collide, collapse to a black hole and fling out a kilonova that forged gold. Replayed on a loop.',
    parent:host, offset, rad:353*KM, R0:facingEarth(V.add(hostPos, offset), V.norm([0, 0.5, 1]), 0), prog:program(VS_RECT, FS_NSMERGER), minZoom:0.1, pxMin:6, noImpostor:true, labelRange:3e5, aka:'kilonova gravitational waves neutron star merger',
    views:[{d:[0,0.5,1],k:1.8,hold:8,drift:0.03},{d:[0.1,0.28,1],k:1.05,hold:8,drift:0.05},{d:[0.05,1,0.1],k:1.7,hold:8,drift:0.02},{d:[1,0.15,0.3],k:1.9,hold:8,drift:-0.03}],
    scaleKm:() => (st.merged ? Math.max(353, 0.2*3e5*Math.max(days(), 0.02)*86400/Math.max(0.75*(1 - Math.exp(-st.tm/7)), 0.05)) : 353)/(353*KM),
    sim:st, tourReset:()=>st.reset(4), update(dt){ st.update(dt); },
    setU(pr){ gl.uniform4f(pr.u.uP0, st.a, st.ph, st.flash, st.grb); gl.uniform4f(pr.u.uP1, st.t, st.Rk, st.kb, st.kr); gl.uniform4f(pr.u.uP2, a0, w0, Tin, st.fade); gl.uniform4f(pr.u.uP3, st.tm, st.torus, 0, 0); },
    particles:[
      {ps:grid, prog:'lnGrid', lines:true, mode:1, sb:2.4, size:1, q0:()=>[st.t, Tin, w0, CV], q1:()=>[st.fade, 0, 0, 0]},
      {ps:tr, prog:'ptBasic', mode:1, sb:5, size:2},
      {ps:ej, prog:'ptBasic', mode:1, sb:4, size:2.2},
    ],
    readout:() => {
      if (!st.merged){ const aKm = 120*(st.a/a0), aM = aKm*1000, fgw = 2*Math.sqrt(3.64e20/(aM*aM*aM))/(2*Math.PI);
        return `f_gw = ${fgw.toFixed(0)} Hz · separation ${aKm.toFixed(0)} km\nmerger in ${Math.max(TM - st.t, 0).toFixed(1)} s (sim) · spacetime ripples at light speed`; }
      if (st.tm < 0.8) return 'merger · hypermassive neutron star spinning ~1,000 times a second\nabout to collapse under its own weight';
      if (st.tm < 7) return 'collapsed to a black hole · gamma-ray burst jets\nlaunched through the debris (GRB 170817A came 1.7 s after the waves)';
      return `kilonova · day ${days().toFixed(1)}\nr-process ejecta forging gold and platinum, ~0.05 solar masses`;
    } });
  return o;
})();

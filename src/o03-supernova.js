
// ================================================================ 03 supernova (SN 1987A-like: blue supergiant, triple rings, light echo)
const FS_SUPERNOVA = COMMON + `
void main(){
  vec3 o, d; localRay(o, d);
  float tau = uP0.x, R = uP0.y, Rs = uP0.z, flash = uP0.w;
  float lineMix = uP1.x, bright = uP1.y, photT = uP1.z, fill = uP1.w;
  float fade = uP2.x, cv = uP2.y, echoA = uP2.z, ns = uP2.w;
  vec3 cdir = normalize(uP3.xyz);
  vec3 col = vec3(0.); float T = 1.;
  if(tau < 0.){
    // blue supergiant progenitor with a hot wind
    col += vec3(0.6, 0.75, 1.)*(blob(o, d, vec3(0.), Rs*2.2)*3. + blob(o, d, vec3(0.), Rs*7.)*0.4);
    vec2 h = sphIsect(o, d, vec3(0.), Rs);
    if(h.x > 0.){
      vec3 n = (o + d*h.x)/Rs; float mu = max(dot(n, -d), 0.);
      float gran = fbm3(n*9. + vec3(0., uTime*0.2, 0.));
      col = blackbody(15000. + 5000.*gran)*(0.35 + 0.65*mu)*(0.7 + 0.6*gran)*2.2;
      T = 0.;
    }
  } else {
    vec2 h = sphIsect(o, d, vec3(0.), R*1.4 + 0.01);
    if(h.y > 0.){
      int N = int(mix(40., 72., uLod));
      float t0 = max(h.x, 0.), dt = (h.y - t0)/float(N);
      float jit = hash12(gl_FragCoord.xy)*dt;
      float iR = 1./max(R, 0.02);
      for(int i=0;i<72;i++){
        if(i >= N) break;
        vec3 p = o + d*(t0 + jit + dt*float(i));
        float r = length(p); vec3 dir = p/max(r, 1e-4);
        float fing = ridge(dir*6.5 + 1.3);
        float disp = (fing - 0.4)*0.38*R;
        float sh = exp(-pow((r - R*0.8 - disp)/(mix(0.3, 0.055, lineMix)*R), 2.));
        float clump = ridge(p*iR*4.5 + 7.);
        float rr = r*iR;
        float inner = smoothstep(0.55, 0.08, rr*(1. + 0.5*abs(dir.y)))*(0.2 + 2.*pow(fbm3(p*iR*6. + 3.), 3.));
        float thick = fill*smoothstep(1.02, 0.3, rr + disp*iR*0.4)*(0.6 + 0.8*fbm3(dir*9. + tau*0.4));
        float dens = sh*(0.1 + 3.2*clump*clump) + thick + inner*lineMix*0.55;
        vec3 lines = mix(vec3(1., 0.74, 0.3), vec3(0.3, 0.95, 0.85), smoothstep(0.3, 0.6, rr));
        lines = mix(lines, vec3(1., 0.28, 0.3), smoothstep(0.66, 0.95, rr + (clump - 0.5)*0.35));
        col += T*mix(blackbody(photT), lines, lineMix)*dens*dt*bright*9.;
        T *= exp(-dens*dt*mix(10., 0.6, lineMix));
      }
    }
    col += vec3(0.8, 0.9, 1.)*(blob(o, d, vec3(0.), 0.03 + 0.1*min(tau, 1.))*flash + pblob(o, d, vec3(0.), 0.004)*flash*40.);
    col += vec3(0.65, 0.8, 1.)*(pblob(o, d, vec3(0.), 0.003)*60. + blob(o, d, vec3(0.), 0.02)*0.6)*ns;
  }
  // light echo: the flash reflecting off surrounding dust along the paraboloid |p| - p.c = c*t
  if(echoA > 0.002){
    vec2 h = sphIsect(o, d, vec3(0.), 1.);
    if(h.y > 0.){
      float t0 = max(h.x, 0.), dt = (h.y - t0)/30.;
      float jit = hash12(gl_FragCoord.xy + 5.)*dt;
      for(int i=0;i<30;i++){
        vec3 p = o + d*(t0 + jit + dt*float(i));
        float lp = length(p);
        float dustv = smoothstep(0.5, 0.78, fbm3(p*3.2 + 11.))*smoothstep(0.35, 0.55, lp);
        float e = lp - dot(p, cdir);
        float band = exp(-pow((e - cv*tau)/0.04, 2.));
        col += vec3(0.7, 0.8, 1.)*dustv*band*echoA*dt*7.;
      }
    }
  }
  outCol(col*fade, (1. - T)*fade);
}`;
const PB_SNRING = `void body(out vec3 p, out float br, out vec3 col){
  float id = aP.y, a = aP.x, rr = id < 0.5 ? 0.33 : 0.58;
  vec3 c0 = id < 0.5 ? vec3(0.) : (id < 1.5 ? vec3(0.05, 0.42, -0.03) : vec3(-0.05, -0.42, 0.03));
  p = c0 + vec3(cos(a)*(rr + aP.z), aP.w, sin(a)*(rr + aP.z));
  float tau = uQ0.x, s = tau - (length(p) - dot(p, normalize(uQ1.xyz)))/uQ0.z;
  float lit = s > 0. ? smoothstep(0., 1.2, s)*exp(-s/10.) : 0.;
  br = (id < 0.5 ? 0.4 : 0.2) + 2.6*lit;
  col = vec3(1., 0.32, 0.3);
  if(aC.w > 0.){ float pe = smoothstep(aC.w, aC.w + 2.5, tau)*(1. - 0.6*smoothstep(44., 54., tau)); br += 5.*pe; col = mix(col, vec3(1., 0.92, 0.75), min(pe*1.5, 1.)); }
  br *= uQ0.w;
}`;
const PB_SNDEB = `void body(out vec3 p, out float br, out vec3 col){
  float head = aC.w;
  p = aP.xyz*uQ0.x*aP.w*(head > 0.5 ? 1. : 0.84);
  br = uQ0.y*(head > 0.5 ? 1. : 0.12);
  col = mix(vec3(1., 0.95, 0.85), aC.rgb, uQ0.z);
}`;
P.ptSNRing = program(particleVS(PB_SNRING), FS_POINT);
P.lnSNDeb = program(particleVS(PB_SNDEB), FS_LINE);

const supernova = (() => {
  const CYCLE = 58, TC = 9, CV = 0.06;
  const nR = Math.round(2200*QUALITY), rings = makePS(nR);
  const pearlAng = Array.from({length:32}, () => [rnd()*6.2832, 16 + rnd()*9]);
  for (let i=0;i<nR;i++){
    const id = i < nR*0.46 ? 0 : (i < nR*0.73 ? 1 : 2);
    let a = rnd()*6.2832, hit = -1;
    if (id === 0 && rnd() < 0.18){ const pk = pearlAng[Math.floor(rnd()*pearlAng.length)]; a = pk[0] + rndn()*0.03; hit = pk[1]; }
    rings.a.set([a, id, rndn()*(id ? 0.008 : 0.005), rndn()*(id ? 0.006 : 0.004)], i*4);
    rings.c.set([1, 0.3, 0.3, hit], i*4);
  }
  rings.upload('ac');
  const nD = Math.round(1100*QUALITY), deb = makePS(nD*2);
  const pal = [[1,0.3,0.32],[0.3,0.95,0.85],[1,0.78,0.38],[1,0.55,0.35]];
  for (let i=0;i<nD;i++){ const d = randDir(), s = 0.7 + 0.55*Math.pow(rnd(), 0.5), c = pal[Math.floor(rnd()*4)];
    for (let k=0;k<2;k++){ deb.a.set([d[0], d[1], d[2], s], (i*2 + k)*4); deb.c.set([c[0], c[1], c[2], k], (i*2 + k)*4); } }
  deb.upload('ac');
  const st = { t:0, tau:-TC, R:0, Rs:0.035, flash:0, lineMix:0, bright:1, photT:15000, fill:0, fade:1, echo:0, ns:0 };
  st.update = dt => {
    st.t += dt; if (st.t > CYCLE) st.t -= CYCLE;
    const t = st.t, tau = t - TC; st.tau = tau;
    st.fade = smooth(0, 1.2, t)*(1 - smooth(CYCLE - 3, CYCLE, t));
    st.Rs = 0.035*(1 + 0.03*Math.sin(t*3.1));
    if (tau < 0){ st.R = 0; st.flash = 0; st.lineMix = 0; st.fill = 0; st.echo = 0; st.ns = 0; }
    else {
      st.R = tau < 17 ? 0.03 + 0.34*(1 - Math.exp(-tau/5.2))/(1 - Math.exp(-17/5.2)) : 0.37 + 0.24*(1 - Math.exp(-(tau - 17)/12));
      st.flash = 9*Math.exp(-tau/0.3) + 1.2*Math.exp(-tau/2.5);
      st.photT = 4500 + 18000*Math.exp(-tau/2);
      st.fill = Math.exp(-tau/1.8);
      st.lineMix = smooth(1, 6.5, tau);
      st.bright = (1 - Math.exp(-tau/0.35))*(0.5 + 1.5*Math.exp(-tau/4)) + 0.35*smooth(16, 22, tau);
      st.echo = smooth(0, 1, tau)*(1 - smooth(14, 24, tau));
      st.ns = smooth(22, 30, tau);
    }
  };
  const pos = radec(hms(5,35,28.03), dms(-69,16,11.8), 168000);
  const camLocal = () => V.norm(M3.applyT(o.rot, V.mul(o.rel, -1)));
  const o = addObj({ key:'sn1987a', name:'SN 1987A', label:'SN 1987A', type:'core-collapse supernova in the Large Magellanic Cloud', group:'stars', sortKey:168000,
    fact:'In 1987 a blue supergiant\'s core collapsed in under a second. The flash lit up rings the star shed 20,000 years earlier; then the blast hit them. Replayed on a loop.',
    pos, rad:1.9, R0:facingEarth(pos, V.norm([0.1, 0.72, 0.68]), 10), prog:program(VS_RECT, FS_SUPERNOVA), minZoom:0.3, pxMin:6, farColor:[1, 0.5, 0.45], farLum:0.5, labelRange:3e5, aka:'supernova sn 1987a',
    views:[{d:[0.1,0.72,0.68],k:2.3,hold:10,drift:0.03},{d:[0.85,0.28,0.45],k:1.25,hold:9,drift:0.05},{d:[-0.3,0.06,1],k:2.6,hold:9,drift:-0.03}],
    sim:st, tourReset:()=>{ st.t = 1.5; }, update(dt){ st.update(dt); },
    setU(pr){ const c = camLocal();
      gl.uniform4f(pr.u.uP0, st.tau, st.R, st.Rs, st.flash); gl.uniform4f(pr.u.uP1, st.lineMix, st.bright, st.photT, st.fill);
      gl.uniform4f(pr.u.uP2, st.fade, CV, st.echo, st.ns); gl.uniform4f(pr.u.uP3, c[0], c[1], c[2], 0); },
    particles:[
      {ps:rings, prog:'ptSNRing', mode:1, sb:4.5, size:2, q0:()=>[st.tau, 0, CV, st.fade], q1:()=>{ const c = camLocal(); return [c[0], c[1], c[2], 0]; }},
      {ps:deb, prog:'lnSNDeb', lines:true, mode:1, sb:2.2, size:1, q0:()=>[st.R, st.tau > 0.3 ? st.fade*(0.5 + 1.5*Math.exp(-st.tau/6))*(1 - smooth(30, 45, st.tau)) : 0, st.lineMix, 0]},
    ],
    readout:() => {
      const tau = st.tau;
      if (tau < -0.2) return `blue supergiant, ~20 solar masses · core collapse in ${(-tau).toFixed(1)} s (sim)\nthe rings are gas it shed ~20,000 years ago`;
      if (tau < 0.8) return `core collapse · neutrino burst · shock breakout\nthe core falls inward at a quarter of light speed`;
      if (tau < 17){ const days = Math.pow(10, 0.1 + tau/17*3.64); return `${days < 700 ? 'day ' + days.toFixed(0) : 'year ' + (days/365.25).toFixed(1)} · ejecta at ~10,000 km/s\n${st.echo > 0.2 ? 'light echo sweeping across surrounding dust' : 'flash-ionised rings glowing'}`; }
      const yr = 15 + (tau - 17)*1.1;
      return `year ${yr.toFixed(0)} · blast wave striking the inner ring\n${tau > 24 ? '"string of pearls" hot spots · neutron star revealed (JWST 2024)' : 'hot spots igniting one by one'}`;
    } });
  return o;
})();

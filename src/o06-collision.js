
// ================================================================ 06 colliding galaxies (restricted N-body with dynamical friction and triggered star formation)
const FS_COLLIDE = COMMON + `
void main(){
  vec3 o, d; localRay(o, d);
  vec3 c1 = uP0.xyz, c2 = uP1.xyz; float burst = uP0.w, fade = uP1.w, agn = uP2.x;
  vec3 col = blackbody(4600.)*(blob(o, d, c1, 0.018)*2.4 + blob(o, d, c2, 0.018)*2.4 + blob(o, d, c1, 0.07)*0.35 + blob(o, d, c2, 0.07)*0.35 + blob(o, d, c1, 0.2)*0.05 + blob(o, d, c2, 0.2)*0.05);
  vec3 mid = 0.5*(c1 + c2);
  float sep = length(c1 - c2);
  // starburst haze in the overlap region, clumped
  vec2 h = sphIsect(o, d, mid, 0.12 + 0.25*sep);
  if(h.y > 0. && burst > 0.01){
    float t0 = max(h.x, 0.), dt = (h.y - t0)/14.;
    for(int i=0;i<14;i++){
      vec3 p = o + d*(t0 + (float(i) + 0.5)*dt);
      float n = smoothstep(0.5, 0.8, fbm3(p*40. + uTime*0.05));
      float sh = exp(-dot(p - mid, p - mid)/pow(0.06 + 0.2*sep, 2.));
      col += vec3(1., 0.42, 0.72)*n*sh*burst*dt*6.;
    }
  }
  // merged nuclei ignite a quasar
  col += vec3(0.75, 0.85, 1.)*(pblob(o, d, mid, 0.002)*900. + blob(o, d, mid, 0.02)*2.)*agn;
  col += jet(o, d, vec3(0., 1., 0.), 0.35, 0.002, 0.02, 1., uTime, vec3(0.8, 0.9, 1.), vec3(0.6, 0.5, 1.))*agn*6.;
  col += jet(o, d, vec3(0., -1., 0.), 0.35, 0.002, 0.02, 1., uTime, vec3(0.8, 0.9, 1.), vec3(0.6, 0.5, 1.))*agn*6.;
  outCol(col*fade, 0.);
}`;
const collide = (() => {
  const nPer = Math.round(6500*QUALITY), N = nPer*2, EPS2 = 0.04, EPSC2 = 0.09, KDF = 0.2, RR = 1.5, H = 0.01, RATE = 0.6, TEND = 34, SC = 0.25;
  const ps = makePS(N);
  const pos = new Float32Array(N*3), vel = new Float32Array(N*3), wgt = new Float32Array(N), base = new Float32Array(N*3), gas = new Uint8Array(N), burst = new Float32Array(N);
  const core = [[0,0,0],[0,0,0]], cv = [[0,0,0],[0,0,0]];
  const st = { t:0, acc:0, sep:6, fade:0, burst:0, agn:0, mergedFor:0 };
  st.init = () => {
    st.t = 0; st.acc = 0; st.mergedFor = 0; st.agn = 0; burst.fill(0);
    const d0 = 6, rp = 1, M = 2, vrel = Math.sqrt(2*M/d0), hh = Math.sqrt(2*M*rp), vt = hh/d0, vr = -Math.sqrt(vrel*vrel - vt*vt);
    core[0] = [-d0/2,0,0]; core[1] = [d0/2,0,0]; cv[0] = [-vr/2,0,-vt/2]; cv[1] = [vr/2,0,vt/2];
    const normals = [V.norm([0.12,-1,0.08]), V.norm([0.85,-0.45,0.3])];
    for (let g=0; g<2; g++){
      const n = normals[g], e1 = V.norm(V.cross(n, Math.abs(n[0]) < 0.9 ? [1,0,0] : [0,0,1])), e2 = V.cross(n, e1);
      for (let k=0;k<nPer;k++){
        const i = g*nPer + k, bulge = k < nPer*0.12;
        let p, v;
        if (bulge){ const dd = randDir(), r = 0.02 + 0.18*Math.pow(rnd(), 1.5); p = V.add(core[g], V.mul(dd, r)); const vc = Math.sqrt(r*r/Math.pow(r*r + EPS2, 1.5)); v = V.add(cv[g], V.mul(V.norm(V.cross(dd, randDir())), vc)); }
        else {
          const r = 0.1 - 0.45*Math.log(1 - rnd()*0.95), armed = rnd() < 0.55, th = armed ? 2.4*Math.log(r + 0.1) + (rnd() < 0.5 ? 0 : Math.PI) + rndn()*0.3 : rnd()*6.2832, c = Math.cos(th), s = Math.sin(th);
          p = V.add(core[g], V.add(V.add(V.mul(e1, r*c), V.mul(e2, r*s)), V.mul(n, rndn()*0.015)));
          const vc = Math.sqrt(r*r/Math.pow(r*r + EPS2, 1.5));
          v = V.add(cv[g], V.mul(V.add(V.mul(e1,-s), V.mul(e2,c)), vc));
        }
        pos.set(p, i*3); vel.set(v, i*3);
        gas[i] = !bulge && rnd() < 0.35 ? 1 : 0;
        const q = rnd(), rr = V.len(V.sub(p, core[g])), young = !bulge && rnd() < smooth(0.25, 0.7, rr)*0.85;
        const col = young ? (g ? [0.5 + 0.15*q, 0.62 + 0.12*q, 1] : [0.4 + 0.15*q, 0.58 + 0.12*q, 1]) : (g ? [1, 0.66 + 0.1*q, 0.38 + 0.12*q] : [1, 0.74 + 0.1*q, 0.46 + 0.12*q]);
        base.set(col, i*3);
        wgt[i] = (bulge ? 1.6 : 1)*(0.5 + rnd());
      }
    }
  };
  function step(){
    const dx = core[1][0]-core[0][0], dy = core[1][1]-core[0][1], dz = core[1][2]-core[0][2];
    const r2 = dx*dx + dy*dy + dz*dz, f = 1/Math.pow(r2 + EPSC2, 1.5), df = KDF*Math.exp(-r2/RR);
    for (let g=0; g<2; g++){
      const sg = g ? -1 : 1;
      cv[g][0] += (sg*dx*f - df*cv[g][0])*H; cv[g][1] += (sg*dy*f - df*cv[g][1])*H; cv[g][2] += (sg*dz*f - df*cv[g][2])*H;
      core[g][0] += cv[g][0]*H; core[g][1] += cv[g][1]*H; core[g][2] += cv[g][2]*H;
    }
    const a0 = core[0], a1 = core[1], trig = st.t > 4.5, half = nPer;
    for (let i=0, j=0; i<N; i++, j+=3){
      const x = pos[j], y = pos[j+1], z = pos[j+2];
      let ex = a0[0]-x, ey = a0[1]-y, ez = a0[2]-z, q0 = ex*ex + ey*ey + ez*ez, q = q0 + EPS2, k = 1/(q*Math.sqrt(q));
      let ax = ex*k, ay = ey*k, az = ez*k;
      ex = a1[0]-x; ey = a1[1]-y; ez = a1[2]-z; const q1 = ex*ex + ey*ey + ez*ez; q = q1 + EPS2; k = 1/(q*Math.sqrt(q));
      ax += ex*k; ay += ey*k; az += ez*k;
      vel[j] += ax*H; vel[j+1] += ay*H; vel[j+2] += az*H;
      pos[j] += vel[j]*H; pos[j+1] += vel[j+1]*H; pos[j+2] += vel[j+2]*H;
      if (gas[i]){ const dOther = i < half ? q1 : q0; burst[i] = Math.max(burst[i]*0.9985, trig ? Math.exp(-dOther/0.35) : 0); }
    }
    st.t += H;
  }
  st.update = (dt) => {
    st.acc += dt*RATE; let n = 0;
    while (st.acc >= H && n < 8) { step(); st.acc -= H; n++; }
    if (n >= 8) st.acc = 0;
    if (st.t > TEND) st.init();
    st.sep = V.len(V.sub(core[0], core[1]));
    st.fade = smooth(0, 0.8, st.t)*(1 - smooth(TEND - 1.2, TEND, st.t));
    st.burst = Math.exp(-st.sep*st.sep/0.8)*smooth(4, 8, st.t);
    st.mergedFor = st.sep < 0.2 ? st.mergedFor + dt*RATE : Math.max(0, st.mergedFor - dt);
    st.agn = smooth(0.5, 2.5, st.mergedFor);
    for (let i=0; i<N; i++){
      const b = burst[i];
      ps.a[i*4] = pos[i*3]*SC; ps.a[i*4+1] = pos[i*3+1]*SC; ps.a[i*4+2] = pos[i*3+2]*SC; ps.a[i*4+3] = wgt[i]*st.fade*(1 + 6*b);
      const pink = (i & 1) ? 0 : 1;
      const bb = Math.min(b*1.4, 1);
      ps.c[i*4] = base[i*3] + ((pink ? 1 : 0.45) - base[i*3])*bb; ps.c[i*4+1] = base[i*3+1] + ((pink ? 0.28 : 0.6) - base[i*3+1])*bb; ps.c[i*4+2] = base[i*3+2] + ((pink ? 0.62 : 1) - base[i*3+2])*bb;
    }
    ps.upload('ac');
  };
  st.init();
  const wpos = radec(hms(12,1,53), dms(-18,52,10), 62e6);
  const o = addObj({ key:'antennae', name:'Antennae Galaxies', label:'Antennae', type:'colliding galaxies · NGC 4038/4039', group:'galaxies', sortKey:62e6,
    fact:'Two spirals in the middle of a collision. Tides fling stars into long tails and colliding gas ignites bursts of star formation. Replayed here: 600 million years in a minute.',
    pos:wpos, rad:130000, R0:facingEarth(wpos, V.norm([0, 0.75, 0.65]), 0), prog:program(VS_RECT, FS_COLLIDE), minZoom:0.12, pxMin:7, farColor:[0.9, 0.85, 1], farLum:0.8, labelRange:2e8, layer:2, aka:'ngc 4038 4039 merger collision',
    views:[{d:[0,0.75,0.65],k:2.2,hold:10,drift:0.03},{d:[0.15,1,0.1],k:2.8,hold:8,drift:0.03},{d:[1,0.3,-0.3],k:1.3,hold:8,drift:-0.04}],
    sim:st, tourReset:()=>{ st.init(); }, update(dt){ st.update(dt); },
    setU(pr){ const a = V.mul(core[0], SC), b = V.mul(core[1], SC); gl.uniform4f(pr.u.uP0, a[0], a[1], a[2], st.burst); gl.uniform4f(pr.u.uP1, b[0], b[1], b[2], st.fade); gl.uniform4f(pr.u.uP2, st.agn, 0, 0, 0); },
    particles:[{ps, prog:'ptBasic', mode:0, sb:0.55, size:1.4, cap:1}],
    readout:()=>`t = +${(st.t*47).toFixed(0)} Myr · nuclei ${(st.sep*32.6).toFixed(0)},000 light-years apart\n${st.agn > 0.3 ? 'merged: gas pours into the black holes, a quasar ignites' : st.burst > 0.2 ? 'tidal compression is triggering a starburst' : 'restricted N-body: ' + N.toLocaleString('en-US') + ' stars'}` });
  return o;
})();

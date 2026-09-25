
// ================================================================ SGR 1806-20: a magnetar, the strongest magnet known, and its 2004 giant flare
// twisted field lines: dipole loops sheared in azimuth, with charged particles streaming along them
const PB_TWIST = `void body(out vec3 p, out float br, out vec3 col){
  float u = fract(aP.y + uT*0.15*(0.5 + aC.w));
  float th0 = asin(sqrt(min(uQ0.x/aP.x, 1.)));
  float th = mix(th0, 3.14159265 - th0, u);
  float r = aP.x*sin(th)*sin(th);
  float phi = aP.z + uQ0.y*cos(th)*1.4;
  p = uM*vec3(r*sin(th)*cos(phi), r*cos(th), r*sin(th)*sin(phi));
  br = (0.35 + 0.65*sin(u*3.14159265))*(1. + 3.*uQ0.z);
  col = mix(aC.rgb, vec3(1.), uQ0.z*0.6);
}`;
P.ptTwist = program(particleVS(PB_TWIST), FS_POINT);
const magnetar = (() => {
  const RAD = 2000*KM, RN = 12/2000, CYCLE = 42;
  const nF = Math.round(4800*QUALITY), fld = makePS(nF), Ls = [0.06, 0.11, 0.18, 0.28, 0.42, 0.6];
  for (let i=0;i<nF;i++){ fld.a.set([Ls[i % 6]*(0.98 + 0.04*rnd()), rnd(), Math.floor(rnd()*9)*0.698 + rndn()*0.015, 0], i*4); const c = rnd() < 0.5 ? [0.55, 0.45, 1] : [0.35, 0.75, 1]; fld.c.set([...c, rnd()], i*4); }
  fld.upload('ac');
  const st = { t:8, flash:0, ball:0, twist:1.2 };
  const pos = radec(hms(18,8,39.3), dms(-20,24,40), 28000);
  const o = addObj({ key:'magnetar', name:'SGR 1806-20', label:'SGR 1806-20', type:'magnetar · the strongest magnetic field known', group:'stars', sortKey:28000,
    fact:'A neutron star with a magnetic field a thousand trillion times Earth\'s. On 27 December 2004 its crust cracked and released more energy in 0.2 s than the Sun does in 250,000 years. Replayed on a loop.',
    pos, rad:RAD, R0:facingEarth(pos, V.norm([0.3, 0.3, 1]), 0), prog:P.neutron, minZoom:0.02, pxMin:5, farColor:[0.7, 0.75, 1], farLum:0.35, labelRange:3e4, aka:'magnetar neutron star gamma ray flare',
    views:[{d:[0.4, 0.3, 1], k:1.6, hold:9, drift:0.04}, {d:[0.9, 0.5, 0.2], k:0.4, hold:9, drift:0.04}, {d:[0.2, 0.9, 0.3], k:0.9, hold:9, drift:0.03}],
    tourReset(){ st.t = CYCLE - 6; },
    update(dt){ st.t = (st.t + dt) % CYCLE; const f = st.t - (CYCLE - 4);
      st.flash = f > 0 ? (f < 0.25 ? f/0.25 : Math.exp(-(f - 0.25)/0.7))*1.5 : 0;
      st.ball = f > 0 ? Math.min(f*0.5, 2) : 0;
      st.twist = 1.3*(0.4 + 0.6*clamp(st.t/(CYCLE - 4), 0, 1))*(f > 0 ? Math.exp(-f*2) : 1);
      this.m = M3.apply(this.mag, [0, 1, 0]); },
    mag:M3.mul(M3.rotZ(0.3), M3.rotX(0.2)), m:[0, 1, 0],
    setU(pr){ gl.uniform4f(pr.u.uP0, this.m[0], this.m[1], this.m[2], 0); gl.uniform4f(pr.u.uP1, RN, 0.5, 3 + 20*st.flash, 0); gl.uniform4f(pr.u.uP2, st.flash, st.ball, 0, 0); },
    particleVis:rpx => smooth(4, 14, rpx),
    particles:[{ ps:fld, prog:'ptTwist', mode:1, sb:0.45, size:1.6, q0:() => [RN, st.twist, st.flash, 0], mat:() => o.mag },
      { ps:loopLines([0.06, 0.11, 0.18, 0.28, 0.42, 0.6], 9, 40, [0.45, 0.55, 1]), prog:'lnLoop', lines:true, mode:3, sb:0.7, size:1, q0:() => [RN, st.twist, st.flash, 0], mat:() => o.mag }],
    readout:() => st.flash > 0.05 ? 'GIANT FLARE: the crust fractures, the field snaps and reconnects\nthe 2004 flash briefly lit up Earth\'s upper atmosphere from 28,000 ly' :
      `field ~10^15 gauss: it would wipe credit cards from halfway to the Moon\nstress building in the twisted field · starquake in ${Math.max(0, CYCLE - 4 - st.t).toFixed(0)} s` });
  return o;
})();

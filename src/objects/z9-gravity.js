
// ================================================================ gravity made visible: the true shape of space around every black hole
// Flamm's paraboloid is the exact embedding of a Schwarzschild hole's curved space: a funnel whose depth grows as 2*sqrt(r_s*(r - r_s)).
// It is drawn a little below the hole in its local frame (units: the hole's bounding radius = 20 r_s), with rings at the event horizon,
// the photon sphere (1.5 r_s) and the innermost stable orbit (3 r_s), and slow pulses sliding down toward the horizon.
const PB_WELL = `void body(out vec3 p, out float br, out vec3 col){
  p = aP.xyz; float r = aP.w;
  float flow = pow(0.5 + 0.5*sin(log(r)*10. + uT*1.4), 8.);
  br = aC.a*(0.45 + 1.1*flow*smoothstep(1., 2.5, r));
  col = aC.rgb;
  // these lines are not lensed, so anything behind the hole's shadow is hidden instead of showing through it
  vec3 w = uRel + uRot*(p*uRad); float lw = length(w);
  if(lw > length(uRel) && length(cross(uRel, w/lw)) < uQ0.x*uRad) br = 0.;
}`;
P.lnWell = program(particleVS(PB_WELL), FS_LINE);
const WELL = (() => {
  const RS = 1/20, H = 2.5, RMAX = 22, W = r => 2*Math.sqrt(Math.max(r - 1, 0)), y = r => -(H + W(RMAX) - W(r))*RS;
  const rings = [[1.001, [1, 0.5, 0.25], 1], [1.5, [1, 0.8, 0.5], 0.85], [2, 0, 0], [3, [0.5, 0.82, 1], 0.75], [4, 0, 0], [5, 0, 0], [6.5, 0, 0], [8, 0, 0], [10, 0, 0], [12.5, 0, 0], [15, 0, 0], [18.5, 0, 0], [22, 0, 0]];
  const NR = 96, NS = 32, SEG = 40, ps = makePS(rings.length*NR*2 + NS*SEG*2); let k = 0;
  const put = (r, phi, c, b) => { ps.a.set([r*Math.cos(phi)*RS, y(r), r*Math.sin(phi)*RS, r], k*4); ps.c.set([c[0], c[1], c[2], b], k*4); k++; };
  const base = r => 0.36*(0.45 + 0.55*smooth(RMAX, 12, r));
  for (const [r, c, b] of rings) for (let i=0;i<NR;i++) for (const e of [i, i + 1]) put(r, e/NR*Math.PI*2, c || [0.36, 0.52, 0.95], b || base(r));
  for (let j=0;j<NS;j++){ const phi = j/NS*Math.PI*2;
    for (let i=0;i<SEG;i++) for (const e of [i, i + 1]){ const r = Math.exp(Math.log(1.001) + (Math.log(RMAX) - Math.log(1.001))*e/SEG); put(r, phi, [0.36, 0.52, 0.95], base(r)*0.8); } }
  ps.count = k; ps.upload('ac');
  return ps;
})();
function addGravityWell(o){
  o.particles = o.particles || [];
  o.particles.push({ ps:WELL, prog:'lnWell', lines:true, mode:3, sb:4.2, size:1, q0:() => [2.62/20, 0, 0, 0],
    vis:() => { if (!SET.gravity) return 0; const d = V.len(o.rel)/o.rad; return smooth(0.22, 0.6, d)*(1 - smooth(22, 60, d)); } });
}
for (const o of OBJ) if (o.prog === P.blackhole) addGravityWell(o);

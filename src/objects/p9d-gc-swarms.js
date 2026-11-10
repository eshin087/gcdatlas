// ---------------------------------------------------------------- globular cluster swarms round the smooth galaxies (0.27.10)
// (owner, 2026-11-10, from stills: the ellipticals all opened as the same fuzzy ball, and an elliptical really is a smooth ball of stars; what
// tells them apart in photos is the swarm of globular clusters round each, from none to thousands. Picked over leaving them as they were.)
// Each galaxy gets its published number of globular clusters (GC_SYS: the whole system, corrected for the faint end and the area not
// observed; the sources are beside each line), drawn as points. Where a cluster is, is made up: a sphere whose half-number radius is
// the published one where a paper gives it (a Hernquist sphere), else half the galaxy's drawn radius (a guess: Forbes 2017 finds the systems reach about four
// times their galaxy's half-light radius). Colours: the two populations every big system shows, metal-poor (bluer) and metal-rich (redder). Brightness: the
// clusters' luminosity function, a bell curve in magnitudes. Drawn at most MAXGC a galaxy (the brightest of them: the rest would be below a
// character). The two with a close companion open on both (`withNeighbour`): M60 with NGC 4647, M105 with NGC 3384.
// Its own generator (keyRnd, p9b-messier3.js), so the shared rnd() and everything made after it are left alone.
const MAXGC = Math.round(9000*QUALITY);
const GC_SYS = {
  // key: [clusters drawn in it, the whole count the readout gives, half-number radius in light-years or 0]. Counts: Harris, Harris & Alessi 2013
  // (ApJ 772, 82), the newer compilation; Peng et al. 2008 (ApJ 681, 197), the more uniform Virgo survey, gives M49 7,813, M60 4,745,
  // M86 2,660, M87 14,660, M89 984 and the rest the same. Radii: Hargis & Rhode 2014 (M49's system 58 kpc, M86's 28 kpc, at 16.7 Mpc),
  // Hudson & Robison 2018 (M87's 87 kpc, uncertain by 56). Fornax: 6, with Fornax 6 confirmed by Pace et al. 2021. Sagittarius: 6 confirmed
  // (Bellazzini et al. 2020), 4 in its main body (M54, Terzan 7, Terzan 8, Arp 2), drawn there; Pal 12 and Whiting 1 are out in its stream.
  // None known round M32, Sculptor, Leo I or Draco (0 in both catalogues): they keep their look.
  m49:[7000, 7000, 189000], m59:[803, 803, 0], m60:[4000, 4000, 0], m84:[4301, 4301, 0], m85:[1110, 1110, 0], m86:[2800, 2800, 91000],
  m89:[1100, 1100, 0], m105:[216, 216, 0], m87:[13000, 13000, 284000], m110:[11, 11, 0], fornaxd:[6, 6, 0], sgrdsph:[4, 6, 0],
};
function gcSwarm(o, n, rh){
  const R = keyRnd(o.key + ':gc'), m = Math.min(n, MAXGC), ps = makePS(m);
  const a = Math.max(rh, 1e-3)/2.414;   // (Hernquist: half the clusters within 2.414 a; a dense middle and a long tail, as the systems' own
  // Sersic profiles. A Plummer sphere of the published radius spread M49's and M87's thousands too thin to see)
  const gauss = () => Math.sqrt(-2*Math.log(Math.max(R(), 1e-9)))*Math.cos(6.2832*R());
  const blue = blackbodyJS(6600), red = blackbodyJS(4900);
  for (let i = 0; i < m; i++){
    let r; do { const q = Math.sqrt(R()); r = a*q/Math.max(1 - q, 1e-6); } while (r > 8*a);
    const z = 2*R() - 1, t = 6.2832*R(), s = Math.sqrt(1 - z*z), p = [r*s*Math.cos(t), r*z, r*s*Math.sin(t)];
    const c = R() < 0.6 ? blue : red, w = clamp(Math.exp(gauss()*0.55), 0.35, 2.4);
    ps.a.set([p[0], p[1], p[2], w], i*4); ps.c.set([c[0], c[1], c[2], 0], i*4);
  }
  ps.upload('ac');
  return ps;
}
for (const [key, [n, all, rhLy]] of Object.entries(GC_SYS)){
  const o = BYKEY[key]; if (!o || !n) continue;
  // (a giant's system reaches far beyond its drawn radius: the points stay within 6 a, and rad keeps the volume's bound)
  const rh = rhLy ? rhLy/o.rad : 0.5*((o.sizeR || o.rad)/o.rad);
  o.particles.push({ ps:gcSwarm(o, n, rh), prog:'ptBasic', mode:4, sb:n < 50 ? 6 : 1.7, size:n < 50 ? 2.6 : 1.8 });
  // (a rich swarm reaches past the galaxy's glow: the first angle stands back far enough to see it round the galaxy)
  if (n >= 200) o.views[0].k = Math.max(o.views[0].k, 2.4, 1.4*rh);
  o.gcCount = all;
  const r0 = o.readout;
  if (r0 && !/globular/.test(r0())) o.readout = () => r0() + '\n' + (all < 50 ? `${all} globular clusters of its own` + (all > n ? `, ${n} in its main body` : '') : `about ${all.toLocaleString('en-US')} globular clusters swarm round it`);
}
// the first angle shows a close neighbour too: from Earth's side, aimed between the two, far enough back for both
function withNeighbour(key, nKey){
  const o = BYKEY[key], b = BYKEY[nKey]; if (!o || !b) return;
  // (only the separation across our line of sight counts: an aim halfway in depth too puts one of them out of the picture)
  const toEarth = V.norm(V.mul(o.pos, -1)), dv = V.sub(b.pos, o.pos), perp = V.sub(dv, V.mul(toEarth, V.dot(dv, toEarth))), sep = V.len(perp)/o.rad;
  const half = () => M3.applyT(o.R0, V.mul(perp, 0.5/o.rad));
  o.views.unshift({ dirFn:() => toEarth, off:half, k:Math.max(2.2, 1.25*sep), hold:9, drift:0.02 });
}
// (not M84 with M86: on the atlas's distances M86 is about a million light-years nearer to us, so it stands behind any camera close
// enough to show M84. They only look close on our sky.)
withNeighbour('m60', 'ngc4647');
withNeighbour('m105', 'ngc3384');


// ================================================================ named stars you can fly to, with companions and planets; scale rings that drop our own orbits around giants
// Solar System orbits drawn to scale around an object (in its local xz plane), each with a quiet label
function addScaleRings(o, rings, col = [0.45, 0.62, 1], far = 1){
  rings.forEach(([r, label], i) => {
    const ps = ringPS(160, col);
    o.particles.push({ ps, prog:'lnBasic', lines:true, mode:3, sb:0.3, size:1, rad:r, rot:() => o.R0,
      vis:() => smooth(r*0.25, r*0.9, viewDist())*(1 - smooth(r*25*far, r*90*far, viewDist())) });
    const a = 0.7 + i*0.45;
    addObj({ key:o.key + '-ring' + i, name:label, label, type:'', layer:3, parent:o, offset:M3.apply(o.R0, [r*Math.cos(a), 0, -r*Math.sin(a)]), rad:r/400, marker:true, noPick:true, noImpostor:true, atlas:false,
      labelMin:r*0.35, labelRange:r*40*far, labelClass:'ring' });
  });
  // say what the rings are while they show (only the ones outside the star: the rest are hidden inside it)
  const out = rings.filter(([r]) => r > o.rad*(o.solid || 1)), r0 = o.readout;
  if (!out.length) return;
  const names = out.map(([, l]) => l.replace(/'s orbit$/, "'s")), list = names.length > 1 ? names.slice(0, -1).join(', ') + ' and ' + names[names.length - 1] : names[0];
  o.readout = () => (r0 ? r0() : '') + (smooth(out[0][0]*0.25, out[0][0]*0.9, viewDist()) > 0.5 && orbit.lock === o.index ? `\nthe blue ${out.length > 1 ? 'rings are' : 'ring is'} ${list} orbit${out.length > 1 ? 's' : ''} around the Sun, drawn to scale for size` : '');
}
const SS_RINGS = { earth:[AU_LY, "Earth's orbit"], mars:[1.524*AU_LY, "Mars's orbit"], jupiter:[5.2*AU_LY, "Jupiter's orbit"], saturn:[9.54*AU_LY, "Saturn's orbit"], neptune:[30.1*AU_LY, "Neptune's orbit"], voyager:[171*AU_LY, 'Voyager 1 today'], mercury:[0.387*AU_LY, "Mercury's orbit"] };
// a star at its catalogue position; `R` solar radii, `T` kelvin
function namedStar(key, name, ra, dec, dist, R, T, extra = {}){
  const pos = radec(ra, dec, dist);
  return addStar(Object.assign({ key, name, label:extra.label || name, pos, R, T, R0:extra.R0 || facingEarth(pos, V.norm([0.3, 0.5, 1]), 0), sortKey:dist,
    views:[{d:[0.3, 0.35, 1], k:1.25, hold:8, drift:0.04}, {d:[0.9, 0.5, 0.2], k:0.75, hold:7, drift:0.04}] }, extra));
}
// a companion (star or planet) on a circular orbit around a host, radius a (ly), period P (sim seconds)
function orbitAround(host, a, P, incl = 0, phase = 0){ return function(){ const th = phase + this.t*2*Math.PI/P; this.offset = M3.apply(host.R0, [a*Math.cos(th), a*Math.sin(th)*Math.sin(incl), -a*Math.sin(th)*Math.cos(incl)]); }; }
// a companion on an oval orbit round its host, in the host's frame: semi-major axis a (ly), eccentricity e, periastron w degrees past the node,
// period P (sim seconds); sets this.th, the companion's angle from the node
function orbitKepler(host, a, P, e, w, phase = 0){ return function(){
  const M = phase + this.t*2*Math.PI/P; let E = M; for (let k=0;k<6;k++) E -= (E - e*Math.sin(E) - M)/(1 - e*Math.cos(E));
  const r = a*(1 - e*Math.cos(E)), u = 2*Math.atan2(Math.sqrt(1 + e)*Math.sin(E/2), Math.sqrt(1 - e)*Math.cos(E/2)) + w*DEG;
  this.th = u; this.offset = M3.apply(host.R0, [r*Math.cos(u), 0, -r*Math.sin(u)]); }; }
// the frame of a binary's orbit as we see it from Earth, from its visual orbit: inclination i and the position angle of the ascending node Om
// (degrees; Om from north through east, the node where the companion moves away from us). Local y is the orbit's pole (the way it turns) and x
// the node, so orbitAround(host, a, P) with no tilt puts the companion th past the node, where the visual orbit has it (i over 90: it goes round
// clockwise on our sky). Both pairs below turn in step with their orbits, so it is each star's own frame too.
function binaryFrame(pos, i, Om){
  const s = V.norm(pos), ncp = eqToGal([0, 0, 1]);
  const N = V.norm(V.sub(ncp, V.mul(s, V.dot(ncp, s)))), E = V.norm(V.cross(ncp, s));
  const X = V.add(V.mul(N, Math.cos(Om*DEG)), V.mul(E, Math.sin(Om*DEG))), p = V.add(V.mul(N, -Math.sin(Om*DEG)), V.mul(E, Math.cos(Om*DEG)));
  const e2 = V.add(V.mul(p, Math.cos(i*DEG)), V.mul(s, Math.sin(i*DEG)));   // (the way the companion moves at the node)
  return [...X, ...V.cross(X, e2), ...V.mul(e2, -1)];
}

// ---------------------------------------------------------------- the nearest stars
const alphaCen = namedStar('alphacen', 'Alpha Centauri', hms(14,39,36.5), dms(-60,50,2), 4.37, 1.2234, 5790, { label:'α Centauri A',
  type:'nearest Sun-like star · a triple system', fact:'Two Sun-like stars circle each other every 80 years, 4.37 light-years away. The red dwarf Proxima, the closest star of all, orbits them far out.',
  star:{ cells:38, act:0.35 }, bound:40, farLum:1.3, noImpostor:false, labelRange:600, aka:'rigil kentaurus alpha centauri a',
  views:[{d:[0.35, 0.3, 1], k:0.3, hold:9, drift:0.03}, {d:[0.2, 0.3, 1], k:0.07, hold:8, drift:0.04}, // third angle: from just beyond A, looking back past it at B, the brightest star in its sky (23 AU away, so a sparkling point);
    // B's orbit is sped up (70 s a lap), so the camera keeps turning to follow it (track)
    { track:() => { const A = BYKEY.alphacen, B = BYKEY.alphacenb, u = V.norm(V.sub(B.pos, A.pos)), p = V.norm(V.cross(u, [0, 1, 0])); return V.norm(V.add(V.add(V.mul(u, -Math.cos(0.3)), V.mul(p, Math.sin(0.3))), [0, 0.08, 0])); }, k:0.3, hold:10, drift:0 }],
  readout:() => 'A and B are 11 to 35 AU apart (like Saturn to Neptune)\nfrom here our Sun is a bright star in Cassiopeia' });
// B's orbit around A, drawn when zoomed out far enough to see both stars as points (the third angle)
{ const n = 180, ps = makePS(n*2), inc = 0.3;
  for (let i=0;i<n;i++) for (let k=0;k<2;k++){ const th = (i + k)/n*Math.PI*2; ps.a.set([Math.cos(th), Math.sin(th)*Math.sin(inc), -Math.sin(th)*Math.cos(inc), 1], (i*2 + k)*4); ps.c.set([1, 0.82, 0.55, 0], (i*2 + k)*4); }
  ps.upload('ac');
  alphaCen.particleVis = () => 1;
  alphaCen.particles.push({ ps, prog:'lnBasic', lines:true, mode:3, sb:0.35, size:1, rad:23.5*AU_LY, rot:() => alphaCen.R0, vis:() => smooth(3*AU_LY, 15*AU_LY, viewDist())*(1 - smooth(3000*AU_LY, 20000*AU_LY, viewDist())) }); }
const alphaCenB = addStar({ key:'alphacenb', name:'Alpha Centauri B', label:'α Cen B', parent:alphaCen, offset:[0, 0, 0], R:0.8632, T:5260, star:{ cells:36, act:0.5 }, atlas:false, labelRange:0.05, labelMin:1e-5, noImpostor:false, farLum:0.8,
  update:orbitAround(alphaCen, 23.5*AU_LY, 70, 0.3, 1), fact:'The smaller, oranger partner of Alpha Centauri A.', type:'K1 dwarf star', readout:() => '0.9 solar masses · 5,260 K' });
const proxima = namedStar('proxima', 'Proxima Centauri', hms(14,29,43), dms(-62,40,46), 4.2465, 0.1542, 3042, { type:'red dwarf · the closest star to the Sun',
  fact:'A small, cool, flaring red dwarf 4.25 light-years away. Its planet Proxima b orbits in 11 days inside the zone where water could be liquid.',
  star:{ cells:30, act:1, prom:0.8 }, bound:4, farLum:0.3, labelRange:300, aka:'proxima centauri',
  views:[{d:[0.3, 0.3, 1], k:1.3, hold:8, drift:0.04}, {d:[0.5, 0.3, 1], k:60, hold:9, drift:0.01}],
  readout:() => '15% of the Sun\'s width, 0.2% of its light\nfrequent flares brighten it many times over' });
const proximaB = addBody({ key:'proximab', name:'Proxima b', type:'exoplanet · rocky, probably tidally locked', parent:proxima, R:6371*1.07, pole:[0, 90], kind:14, lightFrom:proxima, group:'worlds', atlas:true, sortKey:4.2466,
  offsetFn:null, labelRange:0.02, farLum:0.3,
  fact:'An Earth-mass planet 7.5 million km from its star, closer than Mercury is to the Sun, yet only warm because Proxima is so dim.',
  readout:() => 'orbit 11.2 days · 0.049 AU from Proxima\ntidally locked: one hemisphere always faces its star' });
proximaB.update = function(){ const th = this.t*2*Math.PI/40; this.offset = M3.apply(proxima.R0, [0.0485*AU_LY*Math.cos(th), 0, -0.0485*AU_LY*Math.sin(th)]); this.pos = V.add(proxima.pos, this.offset); this.rot = M3.mul(proxima.R0, M3.rotY(th)); };
proximaB.views = [{dirFn:() => sunSide(proximaB, 0.6, 0.2), k:3, hold:8, drift:0.03}, {dirFn:() => sunSide(proximaB, 2.4, 0.2), k:2.2, hold:7, drift:0.03}];
proximaB.update();
const sirius = namedStar('sirius', 'Sirius', hms(6,45,8.9), dms(-16,42,58), 8.60, 1.711, 9940, { type:'brightest star in the night sky · with a white dwarf companion',
  fact:'Twice the Sun\'s mass and 25 times as bright. Its faint partner Sirius B is a white dwarf: a Sun\'s worth of matter squeezed into a ball the size of Earth.',
  star:{ cells:70, act:0, corona:0.2, fine:0 }, bound:60, farLum:1, labelRange:900, aka:'dog star alpha canis majoris',
  views:[{d:[0.3, 0.45, 1], k:0.2, hold:8, drift:0.03}, {d:[0.2, 0.3, 1], k:0.05, hold:8, drift:0.04}],
  readout:() => '8.6 light-years · 25 times the Sun\'s luminosity\nSirius B: 12,000 km across, 1 solar mass' });
const siriusB = addStar({ key:'siriusb', name:'Sirius B', parent:sirius, offset:[0, 0, 0], R:0.0084, T:25000, star:{ cells:90, act:0, corona:0 }, atlas:true, group:'stars', labelRange:0.06, labelMin:1e-7, bound:6, sortKey:8.601,
  update:orbitAround(sirius, 19.8*AU_LY, 60, 0.4, 2), type:'white dwarf', fact:'The exposed core of a dead star, about the size of Earth but as massive as the Sun. A teaspoon of it would weigh several tonnes.',
  views:[{d:[0.3, 0.3, 1], k:1.4, hold:8, drift:0.04}, {d:[0.3, 0.3, 1], k:0.4, hold:6, drift:0.04}], readout:() => 'surface 25,000 K · slowly cooling for billions of years' });
namedStar('vega', 'Vega', hms(18,36,56.3), dms(38,47,1), 25.04, 2.6, 9602, { type:'fast-spinning A star seen pole-on',
  fact:'Spins so fast (once every 12.5 hours) it bulges at the equator and has a hot pole and a cooler waist. We happen to look straight down on its pole.',
  star:{ cells:70, act:0, obl:0.18, corona:0.2 }, farLum:0.9, R0:facingEarth(radec(hms(18,36,56.3), dms(38,47,1), 25), [0.1, 1, 0]), labelRange:900, spinDays:0.52, aka:'alpha lyrae',
  readout:() => '25 light-years · was the pole star 14,000 years ago' });
namedStar('polaris', 'Polaris', hms(2,31,49.1), dms(89,15,51), 433, 37.5, 6015, { type:'the North Star · a pulsating supergiant',
  fact:'A Cepheid supergiant that breathes in and out every 4 days. Earth\'s axis happens to point almost straight at it, so the whole northern sky turns around it.',
  star:{ cells:14, act:0.1, corona:0.3 }, farLum:0.8, labelRange:4000, aka:'north star alpha ursae minoris',
  readout:() => '433 light-years · 1,260 times the Sun\'s luminosity' });
const rigel = namedStar('rigel', 'Rigel', hms(5,14,32.3), dms(-8,12,6), 860, 78.9, 12100, { type:'blue supergiant in Orion',
  fact:'A blue-white supergiant about 120,000 times as luminous as the Sun. It is burning through its fuel so fast it will explode within a few million years.',
  star:{ cells:24, act:0, corona:0.35 }, farLum:1, labelRange:6000, readout:() => '860 light-years · 79 times the Sun\'s radius' });
const antares = namedStar('antares', 'Antares', hms(16,29,24.5), dms(-26,25,55), 550, 680, 3660, { type:'red supergiant · the heart of the Scorpion',
  fact:'So large that, placed where the Sun is, its surface would reach beyond the orbit of Mars. A hot blue companion orbits in its dusty wind.',
  star:{ cells:5, act:0, corona:0, speed:0.08, limb:0.75 }, bound:4, farLum:1, labelRange:6000, aka:'alpha scorpii',
  views:[{d:[0.3, 0.9, 0.6], k:1.6, hold:9, drift:0.02}, {d:[0.3, 0.35, 1], k:0.62, hold:8, drift:0.03}],
  readout:() => '680 times the Sun\'s radius (3.2 AU) · 550 light-years\nit will end as a supernova, maybe within 100,000 years' });
addScaleRings(antares, [SS_RINGS.earth, SS_RINGS.mars, SS_RINGS.jupiter]);
namedStar('deneb', 'Deneb', hms(20,41,25.9), dms(45,16,49), 2615, 203, 8525, { type:'white supergiant · one of the most luminous stars we can see',
  fact:'About 200,000 times as luminous as the Sun. From 2,600 light-years away it still shines as the tail of the Swan.', star:{ cells:18, act:0, corona:0.3 }, farLum:1, labelRange:2e4,
  readout:() => '~2,600 light-years (uncertain) · 203 solar radii' });
namedStar('arcturus', 'Arcturus', hms(14,15,39.7), dms(19,10,57), 36.7, 25.4, 4286, { type:'orange giant · brightest star of the northern sky',
  fact:'An old star that has run out of hydrogen in its core and swollen to 25 times the Sun\'s width: a preview of the Sun in about 5 billion years.', star:{ cells:14, act:0.05, corona:0.2 }, farLum:0.9, labelRange:900,
  readout:() => '36.7 light-years · moving fast through the Milky Way\'s disk' });
// (Canopus: Hipparcos 2007 distance; radius and temperature from VLTI/PIONIER, Domiciano de Souza et al. 2021)
namedStar('canopus', 'Canopus', hms(6,23,57.1), dms(-52,41,45), 310, 73.2, 7660, { type:'white bright giant · second-brightest star in the night sky',
  fact:'The second-brightest star in the night sky, a white giant 73 times the Sun\'s width and about 16,600 times as luminous. Since Mariner 4 in 1964, spacecraft have steered by it to keep themselves pointed the right way.',
  star:{ cells:22, act:0, corona:0.3 }, farLum:0.9, labelRange:4000, aka:'alpha carinae alf car hd 45348 hr 2326 hip 30438',
  readout:() => '310 light-years · 73 times the Sun\'s radius\nabout 16,600 times as luminous as the Sun, 7,660 K' });
namedStar('aldebaran', 'Aldebaran', hms(4,35,55.2), dms(16,30,33), 65.3, 45.1, 3910, { type:'orange giant · the eye of the Bull', fact:'An orange giant 44 times wider than the Sun. Pioneer 10 is heading its way and will pass it in about 2 million years.',
  star:{ cells:10, act:0, corona:0.2 }, farLum:0.9, labelRange:1500, readout:() => '65 light-years · 44 solar radii' });
namedStar('barnard', "Barnard's Star", hms(17,57,48.5), dms(4,41,36), 5.96, 0.187, 3134, { type:'red dwarf · fastest-moving star in our sky', fact:'An ancient red dwarf racing across the sky, the second-closest star system to the Sun. Four small planets were found around it in 2024-25.',
  star:{ cells:30, act:0.7, prom:0.5 }, bound:4, farLum:0.25, labelRange:300, readout:() => '5.96 light-years · about 10 billion years old' });
// (Tau Ceti: radius and temperature from CHARA/MIRC-X, Korolik et al. 2023)
namedStar('tauceti', 'Tau Ceti', hms(1,44,4.1), dms(-15,56,15), 11.9, 0.793, 5320, { type:'nearby Sun-like star',
  fact:'A Sun-like star 11.9 light-years away, older than the Sun and poorer in metals. In 1960 it was one of the first two stars searched for alien radio signals, and four planets a few times Earth\'s mass may orbit it.',
  star:{ cells:36, act:0.2 }, farLum:0.6, labelRange:500, aka:'tau cet 52 ceti hd 10700 hr 509 hip 8102 gj 71 gliese 71 project ozma',
  readout:() => '11.9 light-years · 79% of the Sun\'s width, 5,320 K\n4 candidate planets, each at least 1.7 Earth masses' });
const epsEri = namedStar('epseri', 'Epsilon Eridani', hms(3,32,55.8), dms(-9,27,30), 10.5, 0.735, 5084, { type:'young Sun-like star with debris belts', fact:'A young, active star about 500 million years old, ringed by belts of icy debris like a young Solar System.',
  star:{ cells:36, act:0.8 }, bound:3, farLum:0.6, labelRange:500, readout:() => '10.5 light-years · outer debris ring ~65 AU from the star' });
// (the belts are measured in units of the outer belt's radius, rad:RB: a point's brightness is spread over the size it is given, and over
// the star's own tiny radius the belts were far too faint to show)
{ const n = Math.round(2500*QUALITY), RB = 64*AU_LY, ps = makePS(n); for (let i=0;i<n;i++){ const a = rnd()*6.283, r = (rnd() < 0.8 ? 64 + rndn()*5 : 3 + rndn()*0.3)*AU_LY/RB; ps.a.set([r*Math.cos(a), rndn()*0.3*AU_LY/RB, r*Math.sin(a), 0.6 + rnd()], i*4); ps.c.set([0.8, 0.72, 0.62, 0], i*4); } ps.upload('ac');
  epsEri.particles.push({ ps, prog:'ptBasic', mode:0, sb:0.08, size:1.3, cap:0.5, rad:RB, vis:() => smooth(3*AU_LY, 20*AU_LY, viewDist()) });
  epsEri.particleVis = () => 1; epsEri.views = [{d:[0.3, 0.55, 1], k:1.3, hold:8, drift:0.04}, {d:[0.3, 0.9, 0.4], k:0.7*64*AU_LY/epsEri.rad*3, hold:9, drift:0.02}]; }
// Capella: two giants on their real orbit as we see it (Torres et al. 2015: P 104.02 days, a 0.7427 AU, i 137.156 deg, node 40.522 deg; circular),
// sped up to a lap in 30 s. Aa is the cooler, heavier one, a clump giant burning helium in its core; Ab, hotter and a little brighter to the eye,
// is crossing the Hertzsprung gap. (The papers give Aa's orbit round Ab: Ab round Aa has the same node and tilt, half a lap on.)
const capella = namedStar('capella', 'Capella', hms(5,16,41.4), dms(45,59,53), 42.9, 11.98, 4970, { label:'Capella Aa', type:'yellow giants · a pair circling every 104 days',
  R0:binaryFrame(radec(hms(5,16,41.4), dms(45,59,53), 42.9), 137.156, 40.522),
  fact:'Two giant stars, each about 2.5 times the Sun\'s mass, circling each other every 104 days, 0.74 AU apart. The cooler one, 12 times the Sun\'s width, is near the end of burning helium in its core; the hotter, 9 times the Sun\'s width, has left the main sequence and is still swelling toward the red giant stage.',
  star:{ cells:14, act:0.1, corona:0.2 }, farLum:0.9, labelRange:1500, noImpostor:false, aka:'alpha aurigae alf aur hd 34029 hr 1708 hip 24608',
  views:[{d:[0.3, 0.35, 1], k:1.25, hold:8, drift:0.04},
    // (the pair round their centre of mass, which the camera follows: from above their orbit, then as we see it from Earth)
    {d:[0.2, 1, 0.3], k:6, off:() => M3.applyT(capella.R0, V.mul(BYKEY.capellaab.offset, 0.4915/capella.rad)), hold:10, drift:0.02},
    {dirFn:() => V.norm(V.mul(capella.pos, -1)), k:6, off:() => M3.applyT(capella.R0, V.mul(BYKEY.capellaab.offset, 0.4915/capella.rad)), hold:10, drift:0}],
  readout:() => '42.9 light-years · two giants 0.74 AU apart, 4,970 K and 5,730 K\nsped up here: one lap in 30 s, really 104 days' });
const capellaAb = addStar({ key:'capellaab', name:'Capella Ab', label:'Capella Ab', parent:capella, offset:[0, 0, 0], R:8.83, T:5730, star:{ cells:16, act:0.2, corona:0.2 }, atlas:false,
  noImpostor:false, farLum:0.8, labelRange:0.003, labelMin:2e-6, update:orbitAround(capella, 0.7427*AU_LY, 30, 0, 0), type:'yellow giant · the hotter star of Capella',
  fact:'The hotter of Capella\'s two giants, 2.48 times the Sun\'s mass and 9 times its width. It has left the main sequence and is swelling toward the red giant stage, a short phase in which few stars are caught.', readout:() => '5,730 K · 73 times the Sun\'s luminosity\nspins in 8.5 days, 12 times faster than it orbits' });
capellaAb.update.call(capellaAb);
namedStar('altair', 'Altair', hms(19,50,47), dms(8,52,6), 16.7, 1.85, 7550, { type:'rapidly rotating A star', fact:'Spins once every 9 hours, so fast it is squashed 20% flatter at the poles. Interferometers have imaged its bright poles and dim equator.',
  star:{ cells:60, act:0, obl:0.25, corona:0.2 }, farLum:0.9, labelRange:700, spinDays:0.37, readout:() => '16.7 light-years · equator spins at 286 km/s' });
// Spica: two hot blue stars 0.131 AU apart on their real, slightly oval orbit (Tkachenko et al. 2016: P 4.0145 days, a 28.2 solar radii, e 0.133,
// i 63.1 deg; clockwise on our sky, so 116.9 deg as visual orbits count it; the line of nodes at 131.6 deg, Herbison-Evans et al. 1971), sped
// up to a lap in 8 s. Spica A spins about twice per orbit: it is drawn 6% flatter at the poles than across and 3% longer toward Spica B
// (7.1 and 7.54 solar radii, and toward B 7.5 at their mean distance, 7.9 at their closest; the Roche model of Tkachenko's fit), turning to
// keep its long axis on B. B is nearly round.
const spica = namedStar('spica', 'Spica', hms(13,25,11.6), dms(-11,9,41), 250, 7.54, 25300, { label:'Spica A', type:'hot blue stars · a pair circling every four days',
  R0:binaryFrame(radec(hms(13,25,11.6), dms(-11,9,41), 250), 116.9, 131.6),
  fact:'Two hot blue stars 0.13 AU apart, closer than Mercury is to the Sun, circling each other every four days. The bigger one, 11 times the Sun\'s mass, spins fast enough to bulge about 6% at its equator, and its partner\'s pull stretches it a few per cent more; it will probably end as a supernova.',
  star:{ cells:60, act:0, corona:0.3, obl:0.062, tide:0.03 }, bound:2.4, farLum:1, labelRange:4000, noImpostor:false, aka:'alpha virginis alf vir hd 116658 hr 5056 hip 65474',
  // (close on A from 35 degrees above the orbit, which B passes under; then the pair round their centre of mass from above, and as we see them)
  views:[{d:[0.3, 0.7, 1], k:1.5, hold:8, drift:0.04},
    {d:[0.2, 1, 0.3], k:3.5, off:() => M3.applyT(spica.R0, V.mul(BYKEY.spicab.offset, 0.387/spica.rad)), hold:10, drift:0.02},
    {dirFn:() => V.norm(V.mul(spica.pos, -1)), k:6, off:() => M3.applyT(spica.R0, V.mul(BYKEY.spicab.offset, 0.387/spica.rad)), hold:10, drift:0}],
  readout:() => '250 light-years · 25,300 K and 20,900 K\nsped up here: one lap in 8 s, really 4.01 days' });
const spicaB = addStar({ key:'spicab', name:'Spica B', label:'Spica B', parent:spica, offset:[0, 0, 0], R:3.74, T:20900, star:{ cells:60, act:0, corona:0.2 }, bound:2.4, atlas:false,
  noImpostor:false, farLum:0.7, labelRange:0.004, labelMin:1e-6, type:'hot blue star · the smaller of Spica\'s pair', fact:'The smaller of Spica\'s two stars: 7 times the Sun\'s mass, 3.7 times its width, and nearly round.', readout:() => '20,900 K · about 2,000 times the Sun\'s luminosity' });
{ const orb = orbitKepler(spica, 28.2*RSUN*KM, 8, 0.133, 136); spicaB.update = function(){ orb.call(this); spica.rot = M3.mul(spica.R0, M3.rotY(this.th)); this.rot = M3.mul(spica.R0, M3.rotY(this.th + Math.PI)); }; }
spicaB.update();
// TRAPPIST-1 and its seven Earth-sized planets (periods scaled: 1.5 days -> 6 s)
const trappist = namedStar('trappist1', 'TRAPPIST-1', hms(23,6,29), dms(-5,2,29), 40.7, 0.1192, 2566, { type:'ultracool dwarf with seven Earth-sized planets',
  fact:'A star barely larger than Jupiter with seven rocky planets packed inside an orbit smaller than Mercury\'s. Three sit where liquid water is possible.',
  star:{ cells:28, act:0.9, prom:0.5 }, bound:120, farLum:0.2, labelRange:600, aka:'trappist exoplanets',
  views:[{d:[0.3, 0.55, 1], k:0.62, hold:10, drift:0.03}, {d:[0.2, 0.12, 1], k:0.25, hold:8, drift:0.03}],
  readout:() => 'all seven planets fit within 0.062 AU of the star\nfrom one planet, the others look bigger than our Moon' });
// (e is drawn as a temperate world locked to its star, kind 20: sea under the star, ice beyond and on the night side; a guess, and its readout says so)
[['b', 1.116, 0.01154, 1.51, 14], ['c', 1.097, 0.0158, 2.42, 14], ['d', 0.788, 0.02227, 4.05, 15], ['e', 0.920, 0.02925, 6.10, 20], ['f', 1.045, 0.03849, 9.21, 13], ['g', 1.129, 0.04683, 12.35, 13], ['h', 0.755, 0.06189, 18.77, 13]].forEach(([l, r, a, P, kind], i) => {
  const b = addBody({ key:'trappist1' + l, name:'TRAPPIST-1' + l, type:'exoplanet', parent:trappist, R:6371*r, pole:[0, 90], kind, lightFrom:trappist, group:'worlds', atlas:l === 'e', sortKey:40.7 + i*1e-6,
    labelRange:0.004, farLum:0.25, fact:l === 'e' ? 'The most Earth-like of the seven: about Earth\'s size and density, in the zone where water could stay liquid. It probably keeps one side facing its star, as the Moon does with Earth.' : 'One of seven rocky planets circling TRAPPIST-1.',
    readout:() => `orbit ${P} days at ${a} AU` + (l === 'e' ? ' · 0.92 times Earth\'s width\nillustrative: the sea under its star and the ice around it are a guess; no one knows yet if it has air or water' : '') });
  b.update = function(){ const th = i*2.1 + this.t*2*Math.PI/(P*4); this.offset = M3.apply(trappist.R0, [a*AU_LY*Math.cos(th), 0, -a*AU_LY*Math.sin(th)]); this.pos = V.add(trappist.pos, this.offset); this.rot = M3.mul(trappist.R0, M3.rotY(th)); };
  b.views = [{dirFn:() => sunSide(b, 0.7, 0.2), k:3, hold:7, drift:0.03}];
  if (l === 'e') b.views.push({dirFn:() => sunSide(b, 1.2, 0.3), k:2.6, hold:7, drift:0.03});   // the line between its day and night sides
  b.update();
});

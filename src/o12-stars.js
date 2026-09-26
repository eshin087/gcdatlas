
// ================================================================ named stars you can fly to, with companions and planets; scale rings that drop our own orbits around giants
// Solar System orbits drawn to scale around an object (in its local xz plane), each with a quiet label
function addScaleRings(o, rings, col = [0.45, 0.62, 1], far = 1){
  rings.forEach(([r, label], i) => {
    const ps = ringPS(160, col);
    o.particles.push({ ps, prog:'lnBasic', lines:true, mode:3, sb:0.3, size:1, rad:r, rot:() => o.R0,
      vis:() => smooth(r*0.25, r*0.9, orbit.dist)*(1 - smooth(r*25*far, r*90*far, orbit.dist)) });
    const a = 0.7 + i*0.45;
    addObj({ key:o.key + '-ring' + i, name:label, label, type:'', layer:3, parent:o, offset:M3.apply(o.R0, [r*Math.cos(a), 0, -r*Math.sin(a)]), rad:r/400, marker:true, noPick:true, noImpostor:true, atlas:false,
      labelMin:r*0.35, labelRange:r*40*far, labelClass:'ring' });
  });
  // say what the rings are while they show (only the ones outside the star: the rest are hidden inside it)
  const out = rings.filter(([r]) => r > o.rad*(o.solid || 1)), r0 = o.readout;
  if (!out.length) return;
  const names = out.map(([, l]) => l.replace(/'s orbit$/, "'s")), list = names.length > 1 ? names.slice(0, -1).join(', ') + ' and ' + names[names.length - 1] : names[0];
  o.readout = () => (r0 ? r0() : '') + (smooth(out[0][0]*0.25, out[0][0]*0.9, orbit.dist) > 0.5 && orbit.lock === o.index ? `\nthe blue ${out.length > 1 ? 'rings are' : 'ring is'} ${list} orbit${out.length > 1 ? 's' : ''} around the Sun, drawn to scale for size` : '');
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

// ---------------------------------------------------------------- the nearest stars
const alphaCen = namedStar('alphacen', 'Alpha Centauri', hms(14,39,36.5), dms(-60,50,2), 4.37, 1.2234, 5790, { label:'α Centauri A',
  type:'nearest Sun-like star · a triple system', fact:'Two Sun-like stars circle each other every 80 years, 4.37 light-years away. The red dwarf Proxima, the closest star of all, orbits them far out.',
  star:{ cells:38, act:0.35 }, bound:40, farLum:1.3, noImpostor:false, labelRange:600, aka:'rigil kentaurus alpha centauri a',
  views:[{d:[0.35, 0.3, 1], k:0.3, hold:9, drift:0.03}, {d:[0.2, 0.3, 1], k:0.07, hold:8, drift:0.04}, {d:[0.35, 0.9, 0.25], k:300, hold:9, drift:0.02}],
  readout:() => 'A and B are 11 to 35 AU apart (like Saturn to Neptune)\nfrom here our Sun is a bright star in Cassiopeia' });
// B's orbit around A, drawn when zoomed out far enough to see both stars as points (the third angle)
{ const n = 180, ps = makePS(n*2), inc = 0.3;
  for (let i=0;i<n;i++) for (let k=0;k<2;k++){ const th = (i + k)/n*Math.PI*2; ps.a.set([Math.cos(th), Math.sin(th)*Math.sin(inc), -Math.sin(th)*Math.cos(inc), 1], (i*2 + k)*4); ps.c.set([1, 0.82, 0.55, 0], (i*2 + k)*4); }
  ps.upload('ac');
  alphaCen.particleVis = () => 1;
  alphaCen.particles.push({ ps, prog:'lnBasic', lines:true, mode:3, sb:0.35, size:1, rad:23.5*AU_LY, rot:() => alphaCen.R0, vis:() => smooth(3*AU_LY, 15*AU_LY, orbit.dist)*(1 - smooth(3000*AU_LY, 20000*AU_LY, orbit.dist)) }); }
const alphaCenB = addStar({ key:'alphacenb', name:'Alpha Centauri B', label:'α Cen B', parent:alphaCen, offset:[0, 0, 0], R:0.8632, T:5260, star:{ cells:36, act:0.5 }, atlas:false, labelRange:0.05, labelMin:1e-5, noImpostor:false, farLum:0.8,
  update:orbitAround(alphaCen, 23.5*AU_LY, 70, 0.3, 1), fact:'The smaller, oranger partner of Alpha Centauri A.', type:'K1 dwarf star', readout:() => '0.9 solar masses · 5,260 K' });
const proxima = namedStar('proxima', 'Proxima Centauri', hms(14,29,43), dms(-62,40,46), 4.2465, 0.1542, 3042, { type:'red dwarf · the closest star to the Sun',
  fact:'A small, cool, flaring red dwarf 4.25 light-years away. Its planet Proxima b orbits in 11 days inside the zone where water could be liquid.',
  star:{ cells:30, act:1, prom:0.8 }, bound:4, farLum:0.3, labelRange:300, aka:'proxima centauri',
  views:[{d:[0.3, 0.3, 1], k:1.3, hold:8, drift:0.04}, {d:[0.5, 0.3, 1], k:60, hold:9, drift:0.01}],
  readout:() => '15% of the Sun\'s width, 0.2% of its light\nfrequent flares brighten it many times over' });
const proximaB = addBody({ key:'proximab', name:'Proxima b', type:'exoplanet · rocky, probably tidally locked', parent:proxima, R:6371*1.07, pole:[0, 90], kind:14, lightFrom:proxima, group:'stars', atlas:true, sortKey:4.2466,
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
namedStar('canopus', 'Canopus', hms(6,23,57.1), dms(-52,41,45), 310, 71, 7400, { type:'bright giant · second-brightest star', fact:'The second-brightest star in the night sky, used by spacecraft to orient themselves.',
  star:{ cells:22, act:0, corona:0.3 }, farLum:0.9, labelRange:4000, atlas:false, readout:() => '310 light-years · 71 solar radii' });
namedStar('aldebaran', 'Aldebaran', hms(4,35,55.2), dms(16,30,33), 65.3, 45.1, 3910, { type:'orange giant · the eye of the Bull', fact:'An orange giant 44 times wider than the Sun. Pioneer 10 is heading its way and will pass it in about 2 million years.',
  star:{ cells:10, act:0, corona:0.2 }, farLum:0.9, labelRange:1500, readout:() => '65 light-years · 44 solar radii' });
namedStar('barnard', "Barnard's Star", hms(17,57,48.5), dms(4,41,36), 5.96, 0.187, 3134, { type:'red dwarf · fastest-moving star in our sky', fact:'An ancient red dwarf racing across the sky, the second-closest star system to the Sun. Four small planets were found around it in 2024-25.',
  star:{ cells:30, act:0.7, prom:0.5 }, bound:4, farLum:0.25, labelRange:300, readout:() => '5.96 light-years · about 10 billion years old' });
namedStar('tauceti', 'Tau Ceti', hms(1,44,4.1), dms(-15,56,15), 11.9, 0.793, 5344, { type:'nearby Sun-like star', fact:'A quiet, Sun-like star 12 light-years away, a favourite of science fiction and early searches for alien radio signals.',
  star:{ cells:36, act:0.2 }, farLum:0.6, labelRange:500, atlas:false, readout:() => '11.9 light-years · a little smaller and cooler than the Sun' });
const epsEri = namedStar('epseri', 'Epsilon Eridani', hms(3,32,55.8), dms(-9,27,30), 10.5, 0.735, 5084, { type:'young Sun-like star with debris belts', fact:'A young, active star about 500 million years old, ringed by belts of icy debris like a young Solar System.',
  star:{ cells:36, act:0.8 }, bound:3, farLum:0.6, labelRange:500, readout:() => '10.5 light-years · outer debris ring ~65 AU across' });
{ const n = Math.round(2500*QUALITY), ps = makePS(n); for (let i=0;i<n;i++){ const a = rnd()*6.283, r = (rnd() < 0.8 ? 64 + rndn()*5 : 3 + rndn()*0.3)*AU_LY/epsEri.rad; ps.a.set([r*Math.cos(a), rndn()*0.3*AU_LY/epsEri.rad, r*Math.sin(a), 0.6 + rnd()], i*4); ps.c.set([0.8, 0.72, 0.62, 0], i*4); } ps.upload('ac');
  epsEri.particles.push({ ps, prog:'ptBasic', mode:0, sb:0.08, size:1.3, cap:0.5, vis:() => smooth(3*AU_LY, 20*AU_LY, orbit.dist) });
  epsEri.particleVis = () => 1; epsEri.views = [{d:[0.3, 0.55, 1], k:1.3, hold:8, drift:0.04}, {d:[0.3, 0.9, 0.4], k:0.7*64*AU_LY/epsEri.rad*3, hold:9, drift:0.02}]; }
namedStar('capella', 'Capella', hms(5,16,41.4), dms(45,59,53), 42.9, 11.98, 4970, { type:'pair of yellow giants', fact:'Two giant stars, each about 2.5 times the Sun\'s mass, circling each other every 104 days.',
  star:{ cells:14, act:0.1, corona:0.2 }, farLum:0.9, labelRange:1500, atlas:false, readout:() => '42.9 light-years · two giants 0.74 AU apart' });
namedStar('altair', 'Altair', hms(19,50,47), dms(8,52,6), 16.7, 1.85, 7550, { type:'rapidly rotating A star', fact:'Spins once every 9 hours, so fast it is squashed 20% flatter at the poles. Interferometers have imaged its bright poles and dim equator.',
  star:{ cells:60, act:0, obl:0.25, corona:0.2 }, farLum:0.9, labelRange:700, spinDays:0.37, readout:() => '16.7 light-years · equator spins at 286 km/s' });
namedStar('spica', 'Spica', hms(13,25,11.6), dms(-11,9,41), 250, 7.47, 25300, { type:'hot blue binary', fact:'Two hot blue stars so close they are pulled into egg shapes, whirling around each other every four days.',
  star:{ cells:60, act:0, corona:0.4 }, farLum:1, labelRange:4000, atlas:false, readout:() => '250 light-years · 25,300 K' });
// TRAPPIST-1 and its seven Earth-sized planets (periods scaled: 1.5 days -> 6 s)
const trappist = namedStar('trappist1', 'TRAPPIST-1', hms(23,6,29), dms(-5,2,29), 40.7, 0.1192, 2566, { type:'ultracool dwarf with seven Earth-sized planets',
  fact:'A star barely larger than Jupiter with seven rocky planets packed inside an orbit smaller than Mercury\'s. Three sit where liquid water is possible.',
  star:{ cells:28, act:0.9, prom:0.5 }, bound:120, farLum:0.2, labelRange:600, aka:'trappist exoplanets',
  views:[{d:[0.3, 0.55, 1], k:0.62, hold:10, drift:0.03}, {d:[0.2, 0.12, 1], k:0.25, hold:8, drift:0.03}],
  readout:() => 'all seven planets fit within 0.062 AU of the star\nfrom one planet, the others look bigger than our Moon' });
[['b', 1.116, 0.01154, 1.51, 14], ['c', 1.097, 0.0158, 2.42, 14], ['d', 0.788, 0.02227, 4.05, 15], ['e', 0.920, 0.02925, 6.10, 15], ['f', 1.045, 0.03849, 9.21, 13], ['g', 1.129, 0.04683, 12.35, 13], ['h', 0.755, 0.06189, 18.77, 13]].forEach(([l, r, a, P, kind], i) => {
  const b = addBody({ key:'trappist1' + l, name:'TRAPPIST-1' + l, type:'exoplanet', parent:trappist, R:6371*r, pole:[0, 90], kind, lightFrom:trappist, group:'stars', atlas:l === 'e', sortKey:40.7 + i*1e-6,
    labelRange:0.004, farLum:0.25, fact:l === 'e' ? 'The most Earth-like of the seven: about Earth\'s size and density, in the zone where water could stay liquid.' : 'One of seven rocky planets circling TRAPPIST-1.',
    readout:() => `orbit ${P} days at ${a} AU` });
  b.update = function(){ const th = i*2.1 + this.t*2*Math.PI/(P*4); this.offset = M3.apply(trappist.R0, [a*AU_LY*Math.cos(th), 0, -a*AU_LY*Math.sin(th)]); this.pos = V.add(trappist.pos, this.offset); this.rot = M3.mul(trappist.R0, M3.rotY(th)); };
  b.views = [{dirFn:() => sunSide(b, 0.7, 0.2), k:3, hold:7, drift:0.03}];
  b.update();
});

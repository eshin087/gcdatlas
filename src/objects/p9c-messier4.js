// ================================================================ content pack (0.25.0): the last 28 Messier objects, and the Virgo Cluster
// With this pack all 110 of Messier's objects are in the atlas. Twenty galaxies (the Virgo Cluster's M49, M58, M59, M60, M61, M85, M88, M89,
// M90, M91, M98, M99, M100; M94, M95, M96, M105, M102, M108, M109), the last six open clusters (M18, M21, M26, M48, M50, M93), and M40 and
// M73, a few stars that only seem to belong together. Then the Virgo Cluster itself, as a place: its 16 Messier galaxies and a thousand
// more. Positions are SIMBAD's (degrees, J2000; the Harvard mirror on 2026-11-09, when CDS in Strasbourg could not be reached);
// distances and sizes are in each readout with their method.
// (this pack draws random numbers from the shared seeded rnd() for its galaxies' stars, as addGalaxy does, and then puts the seed back, so
// everything made after it, the Halo's route included, gets the same numbers as before; its own made-up numbers come from keyRnd)
const P9C_SEED = seed;

// ---------------------------------------------------------------- twenty galaxies (addGalaxy, 06g-galaxies.js), each at its real place, distance, size and tilt
// m: Messier number; ra, dec: SIMBAD (deg); ly: distance (method in r1); incl, pa: tilt (deg from face-on) and position angle of the major
// axis (deg, north through east; PHANGS where measured, else HyperLeda); across: HyperLeda's D25 at that distance (ly); g: the look
// (galaxyU's parameters); ell: drawn as a smooth galaxy, seen edge-on so that its flattening on our sky is all of it (an elliptical's
// true shape cannot be told from one direction). Seeds 101 on are this pack's (p8-messier.js's run to 97).
const GAL4 = [
  { m:49, ngc:4472, ra:187.44490, dec:8.00040, ly:54.5e6, incl:90, pa:155, across:162000, ell:true, g:{ ell:0.19, Rd:0.42, sf:0.05, gain:1.5 }, stars:6000,
    type:'giant elliptical galaxy · the brightest in the Virgo Cluster',
    fact:'The brightest galaxy of the Virgo Cluster in starlight, outshining even M87, and the first of its galaxies ever found: Messier saw it in 1771. In 2007 one of its 7,000 globular clusters gave the first strong sign of a black hole inside a globular cluster.',
    r1:'54.5 million light-years · about 160,000 light-years across', r2:'its black hole weighs about 2.5 billion Suns', aka:'ugc 7629 vcc 1226 arp 134 subcluster b' },
  { m:58, ngc:4579, ra:189.43166, dec:11.81809, ly:63.6e6, incl:40, pa:91, across:93000, g:{ arms:2, pitch:12, bulge:0.9, dust:1.2, bar:0.18, H:0.011, sf:0.4, Rd:0.27, barAng:40, ringR:0.3, ringW:0.03, ringGain:0.8, seed:101 },
    type:'barred spiral galaxy · Virgo Cluster',
    fact:'One of the brightest barred spirals in the Virgo Cluster, found by Messier in 1779 while he followed a comet. It has lost most of the hydrogen from its outer disc, probably stripped by the cluster\'s hot gas, so few new stars form there now. Two supernovae have been seen in it, in 1988 and 1989.',
    r1:'about 64 million light-years · about 93,000 light-years across', r2:'its distance is uncertain: other methods give 52 to 68 million', aka:'ugc 7796 vcc 1727' },
  { m:59, ngc:4621, ra:190.50941, dec:11.64692, ly:48.6e6, incl:90, pa:163, across:65000, ell:true, g:{ ell:0.32, Rd:0.4, sf:0.05, gain:1.4 }, stars:4500,
    type:'elliptical galaxy · Virgo Cluster',
    fact:'A flattened elliptical galaxy, found by Johann Gottfried Koehler in April 1779 while he followed a comet, the same night as its neighbour M60. At its very centre a core only about 160 light-years across spins the opposite way to the rest of the galaxy.',
    r1:'48.6 million light-years · about 65,000 light-years across', r2:'a few million light-years nearer than the cluster\'s middle', aka:'ugc 7858 vcc 1903' },
  { m:60, ngc:4649, ra:190.91655, dec:11.55269, ly:53.8e6, incl:90, pa:91, across:106000, ell:true, g:{ ell:0.16, Rd:0.42, sf:0.05, gain:1.5 }, stars:6000,
    type:'giant elliptical galaxy · Virgo Cluster',
    fact:'A giant elliptical with a central black hole of about 4.5 billion Suns. The spiral NGC 4647 lies beside it on our sky; whether the two really interact is not settled. Close by, the tiny galaxy M60-UCD1 holds a black hole of 21 million Suns, 15% of its whole mass.',
    r1:'53.8 million light-years · about 106,000 light-years across', r2:'about 4,000 globular clusters swarm round it', aka:'ugc 7898 vcc 1978 arp 116 m60-ucd1' },
  { m:61, ngc:4303, ra:185.47887, dec:4.47378, ly:55.4e6, incl:24, pa:132, across:112000, g:{ arms:2, pitch:18, bulge:0.5, dust:1.2, bar:0.12, H:0.011, sf:1.8, irr:0.25, Rd:0.3, barAng:10, armRef:0.32, seed:103 },
    type:'barred spiral galaxy · on the Virgo Cluster\'s southern edge',
    fact:'Eight supernovae have been seen in it since 1926, more than in any other Messier galaxy. Barnaba Oriani found it in 1779; Messier saw it the same night but took it for the comet he was following. Its arms are busy making new stars.',
    r1:'about 55 million light-years, uncertain by a fifth · about 112,000 light-years across', r2:'a ring of new stars about 1,600 light-years across circles its core', aka:'ugc 7420 vcc 508' },
  { m:85, ngc:4382, ra:186.35022, dec:18.19108, ly:58.4e6, incl:90, pa:12, across:117000, ell:true, g:{ ell:0.25, Rd:0.4, sf:0.06, gain:1.4 }, stars:5000,
    type:'lenticular galaxy · Virgo Cluster · in Coma Berenices',
    fact:'The northernmost of the Virgo Cluster\'s Messier galaxies. Faint shells and ripples round it, a double nucleus and a young-looking centre suggest that it merged with another galaxy not long ago. Its central black hole, if it has one, is smaller than expected for so bright a galaxy.',
    r1:'58.4 million light-years · about 117,000 light-years across', r2:'no black hole found: under 100 million Suns', aka:'ugc 7508 vcc 798' },
  { m:88, ngc:4501, ra:187.99647, dec:14.42032, ly:63.6e6, incl:62, pa:143, across:161000, g:{ arms:2, pitch:14, bulge:0.8, dust:1.4, H:0.011, sf:0.9, irr:0.25, Rd:0.27, seed:105 },
    type:'spiral galaxy · Virgo Cluster · in Coma Berenices',
    fact:'A regular spiral with many arms, among the brightest in the Virgo Cluster. It is ploughing through the cluster\'s hot gas toward M87, and the pressure has begun to strip hydrogen from the edge of its leading side.',
    r1:'about 64 million light-years, uncertain by a fifth · about 160,000 light-years across', r2:'moving away from us at 2,284 km/s', aka:'ugc 7675 vcc 1401' },
  // (M89's size is RC3's D25: HyperLeda's 8.1 arcminutes takes in its faint envelope)
  { m:89, ngc:4552, ra:188.91586, dec:12.55634, ly:52.2e6, incl:90, pa:132, across:78000, ell:true, g:{ ell:0.11, Rd:0.4, sf:0.04, gain:1.4 }, stars:4500,
    type:'elliptical galaxy · Virgo Cluster',
    fact:'Nearly round. Deep images show faint shells and long plumes of stars round it, the farthest about 190,000 light-years from its centre. In the early 1990s Hubble saw its core brighten several times over in ultraviolet light, probably gas falling into its black hole.',
    r1:'52.2 million light-years · about 78,000 light-years across', r2:'it races through the cluster\'s hot gas at about 1,700 km/s', aka:'ugc 7760 vcc 1632' },
  { m:90, ngc:4569, ra:189.20750, dec:13.16292, ly:57.1e6, incl:70, pa:18, across:151000, g:{ arms:2, pitch:10, bulge:1, dust:1.1, bar:0.1, H:0.011, sf:0.15, Rd:0.22, seed:107 },
    type:'spiral galaxy · Virgo Cluster',
    fact:'One of the few galaxies coming toward us. The cluster\'s hot gas has stripped away more than nine tenths of its hydrogen, so its outer arms are smooth and make no new stars, and tails of glowing gas reach up to 260,000 light-years from it.',
    r1:'about 57 million light-years · about 151,000 light-years across', r2:'coming toward us at 235 km/s', aka:'ugc 7786 vcc 1690 arp 76' },
  { m:91, ngc:4548, ra:188.86019, dec:14.49632, ly:52.8e6, incl:38, pa:138, across:84000, g:{ arms:2, pitch:12, bulge:0.6, dust:1, bar:0.21, H:0.011, sf:0.35, Rd:0.3, armRef:0.4, barAng:30, ringR:0.3, ringW:0.03, ringGain:0.6, seed:109 },
    type:'barred spiral galaxy · Virgo Cluster · in Coma Berenices',
    fact:'The missing Messier object. Messier wrote down a wrong position for it in 1781, and for almost two centuries no one could be sure which galaxy he meant. In 1969 William C. Williams, an amateur astronomer in Texas, showed that Messier had measured its position from M89 but worked it out as if from M58, and so found it: NGC 4548.',
    r1:'52.8 million light-years (Cepheids) · about 84,000 light-years across', r2:'it has lost most of its hydrogen; what is left lies in a ring round its bar', aka:'ugc 7753 vcc 1615 missing messier object' },
  { m:98, ngc:4192, ra:183.45121, dec:14.90054, ly:53.2e6, incl:76, pa:156, across:170000, g:{ arms:2, pitch:12, bulge:1, dust:1.5, bar:0.08, H:0.012, sf:0.45, Rd:0.27, seed:111 },
    type:'spiral galaxy seen nearly edge-on · Virgo Cluster · in Coma Berenices',
    fact:'A large spiral seen nearly edge-on, laced with dust. It is coming toward us at 142 km/s while the cluster as a whole moves away at about 1,100 km/s, so it is moving through the cluster toward us at more than 1,000 km/s.',
    r1:'about 53 million light-years · about 170,000 light-years across', r2:'coming toward us at 142 km/s', aka:'ugc 7231 vcc 92' },
  { m:99, ngc:4254, ra:184.70677, dec:14.41649, ly:46e6, incl:34, pa:68, across:67000, g:{ arms:3, pitch:20, bulge:0.35, dust:1, H:0.011, sf:1.5, irr:0.3, Rd:0.3, armRef:0.3, seed:113 },
    type:'lopsided spiral galaxy · Virgo Cluster · in Coma Berenices',
    fact:'A lopsided spiral with one arm much stronger than the others, thought to have been stirred by a fast pass of another galaxy that also drew out a tail of hydrogen some 700,000 light-years long. In 1846 Lord Rosse saw its spiral shape: only the Whirlpool\'s had been seen before.',
    r1:'about 46 million light-years, uncertain by a fifth · about 67,000 light-years across', r2:'moving away from us at 2,406 km/s, faster than any other Messier object', aka:'ugc 7345 vcc 307 coma pinwheel virgo cluster pinwheel virgohi 21' },
  { m:100, ngc:4321, ra:185.72887, dec:15.82230, ly:49.6e6, incl:38.5, pa:156, across:87000, g:{ arms:2, pitch:16, bulge:0.6, dust:1.2, bar:0.1, H:0.01, sf:1.3, irr:0.15, Rd:0.3, armRef:0.33, ringR:0.075, ringW:0.025, ringGain:2, seed:115 },
    type:'grand-design spiral galaxy · Virgo Cluster · in Coma Berenices',
    fact:'A grand-design spiral, one of the brightest in the Virgo Cluster. In 1994 its Cepheid stars gave the first distance to a Virgo galaxy measured with Hubble, and its core was the showcase picture after Hubble\'s first repair mission. Seven supernovae have been seen in it since 1901.',
    r1:'49.6 million light-years (Cepheids) · about 87,000 light-years across', r2:'a ring of young stars circles its centre', aka:'ugc 7450 vcc 596' },
  // (M94: its listed size is HyperLeda's D25, the bright inner disc; the drawing reaches further, to its faint outer arms, added below.
  // Its tilt is THINGS's (de Blok et al. 2008), from the motion of its gas: M94 is not in PHANGS)
  { m:94, ngc:4736, ra:192.72114, dec:41.12025, ly:14e6, incl:41, pa:116, across:31700, rad:26000, g:{ arms:2, pitch:9, bulge:1.6, dust:0.9, H:0.011, sf:0.5, Rd:0.15, ringR:0.12, ringW:0.02, ringGain:2.4, seed:117 },
    type:'spiral galaxy with a bright ring · in Canes Venatici',
    fact:'A very bright centre ringed by young star clusters, inside a smooth, bright oval disc. Far out, a faint ring about 45,000 light-years across circles it: long thought a closed ring of stars, it is really spiral arms in an outer disc that holds about a quarter of the galaxy\'s stars.',
    r1:'14 million light-years · its bright disc about 32,000 light-years across', r2:'its black hole weighs about 16 million Suns (JWST, 2025)', aka:'ugc 7996 croc\'s eye crocs eye galaxy canes venatici' },
  { m:95, ngc:3351, ra:160.99055, dec:11.70369, ly:31.8e6, incl:45, pa:13, across:67000, g:{ arms:2, pitch:12, bulge:0.5, dust:1, bar:0.22, H:0.011, sf:0.6, Rd:0.3, armRef:0.36, barAng:20, ringR:0.03, ringW:0.01, ringGain:3, seed:119 },
    type:'barred spiral galaxy · the Leo I group · in Leo',
    fact:'A barred spiral with a ring of new stars about 2,000 light-years across round its centre. In 2012 a star exploded in it: Hubble pictures taken years before show the star, a red supergiant, and pictures taken since show it gone.',
    r1:'31.8 million light-years · about 67,000 light-years across', r2:'its Cepheid stars helped measure how fast the universe expands', aka:'ugc 5850 leo i group sn 2012aw' },
  { m:96, ngc:3368, ra:161.69060, dec:11.81994, ly:34.1e6, incl:50, pa:172, across:82500, g:{ arms:2, pitch:12, bulge:1, dust:1.4, bar:0.1, H:0.011, sf:0.6, irr:0.35, Rd:0.26, seed:121 },
    type:'spiral galaxy · the Leo I group · in Leo',
    fact:'The brightest galaxy of the Leo I group, with weak, lopsided, dusty arms and a bar inside a bar at its centre. In 1998 a supernova flared in it, one of the nearest of its kind in modern times, and it helped measure how fast the universe expands.',
    r1:'34.1 million light-years · about 82,000 light-years across', r2:'its black hole weighs about 7.5 million Suns', aka:'ugc 5882 leo i group sn 1998bu' },
  { m:105, ngc:3379, ra:161.95667, dec:12.58163, ly:36e6, incl:90, pa:71, across:51300, ell:true, g:{ ell:0.11, Rd:0.4, sf:0.04, gain:1.4 }, stars:4500,
    type:'elliptical galaxy · the Leo I group · in Leo',
    fact:'A smooth, almost round elliptical galaxy. Méchain found it in 1781, but it joined Messier\'s list only in 1947, when Helen Sawyer Hogg found his letter about it. With its neighbour NGC 3384 it sits inside the Leo Ring, a ring of hydrogen about 650,000 light-years across that only radio telescopes see.',
    r1:'36 million light-years · about 51,000 light-years across', r2:'its black hole weighs 200 to 400 million Suns', aka:'ugc 5902 leo ring leo i group' },
  { m:102, ngc:5866, ra:226.62317, dec:55.76331, ly:48.8e6, incl:89, pa:127, across:89600, g:{ arms:0, bulge:2.6, dust:3, H:0.016, sf:0.05, Rd:0.22, ring:0.3, gain:0.35, seed:123 },
    // (the dust lane is thinner than a row of characters from afar: the second angle comes close along the disc)
    views:[{ dir:true, k:2 }, { d:[0.96, 0.1, 0.25], k:0.8 }, { d:[0.3, 0.8, 0.5], k:1.5 }],
    type:'lenticular galaxy seen edge-on · in Draco',
    fact:'Seen exactly edge-on, with a sharp, thin lane of dust along its disc. Whether it is really M102 is debated: Méchain later wrote that M102 was M101 counted twice, but his description and a position Messier pencilled into his own copy point here, and most modern lists agree.',
    r1:'48.8 million light-years · about 90,000 light-years across', r2:'wisps of dust rise up to 1,000 light-years out of its disc', aka:'ugc 9723 spindle galaxy fool\'s gold galaxy draco' },
  // (M108: its size is RC3's D25; HyperLeda's mean, 4 arcminutes, is pulled down by two stray measurements. Its only distance is from its
  // rotation, Tully-Fisher)
  { m:108, ngc:3556, ra:167.87903, dec:55.67412, ly:29.9e6, incl:80, pa:79, across:75800, g:{ arms:2, pitch:22, bulge:0.15, dust:1.8, bar:0.06, H:0.014, sf:1.1, irr:0.6, Rd:0.3, seed:125 },
    type:'barred spiral galaxy seen nearly edge-on · in Ursa Major',
    fact:'A spiral seen almost edge-on, with no bulge to speak of, mottled with dust and bright star-forming clouds. On our sky it lies less than a degree from the Owl Nebula, but it is about 11,000 times farther away. Three supernovae have been seen in it, two of them since 2023.',
    r1:'about 30 million light-years, uncertain by a fifth · about 76,000 light-years across', r2:'hot gas boils 13,000 light-years out of its disc', aka:'ugc 6225 surfboard galaxy ursa major' },
  // (M109: its group's distance, from nine galaxies' rotation (Cosmicflows-4); its own gives 82 million light-years. Tilt from the motion of
  // its gas: Bottema & Verheijen 2002)
  { m:109, ngc:3992, ra:179.39985, dec:53.37472, ly:68e6, incl:57, pa:68, across:140000, g:{ arms:2, pitch:15, bulge:0.6, dust:1, bar:0.28, H:0.011, sf:0.7, Rd:0.3, armRef:0.42, barAng:30, ringR:0.3, ringW:0.03, ringGain:0.7, seed:127 },
    type:'barred spiral galaxy · in Ursa Major',
    fact:'Probably the farthest of all the Messier objects. A strong bar runs across its middle and ends in a ring, and its hydrogen has a hole exactly where the bar is, swept inward by it. Three small spiral galaxies keep it company.',
    r1:'about 68 million light-years · about 140,000 light-years across', r2:'its distance is uncertain: 68 to 82 million light-years by different counts', aka:'ugc 6937 vacuum cleaner galaxy ursa major' },
];
for (const c of GAL4){
  const sizeR = Math.round(c.across/2), def = { key:'m' + c.m, name:c.name || 'M' + c.m, label:c.label || 'M' + c.m, type:c.type, ...galAt(c.ra, c.dec, c.ly, c.incl, c.pa),
    rad:c.rad || Math.round(sizeR*1.08), sizeR, g:c.g, fact:c.fact, aka:`m${c.m} messier ${c.m} ngc ${c.ngc}${c.aka ? ' ' + c.aka : ''}`,
    readout:() => c.r1 + '\n' + c.r2 };
  if (c.ell) Object.assign(def, { stars:c.stars || 5000, farLum:0.85, views:ellViews(c.incl) });
  // (views given in the table: { dir:true } is the view from Earth, the rest in the galaxy's own axes)
  if (c.views) def.views = c.views.map(v => Object.assign(v.dir ? { dirFn:() => V.norm(V.mul(def.pos, -1)) } : { d:v.d }, { k:v.k, hold:v.hold || 8, drift:v.drift || 0.03 }));
  addGalaxy(def);
}
// M94's faint outer arms (Trujillo et al. 2009: the outer ring is spiral arms in an outer disc, about 21,000 to 24,000 light-years out): two
// tightly wound arms of young stars beyond the bright disc, as points in the disc's plane (keyRnd, so the shared rnd() is left alone)
{
  const o = BYKEY.m94, u = keyRnd('m94-arms'), n = Math.round(1800*QUALITY), ps = makePS(n), tp = Math.tan(6*DEG);
  for (let i=0;i<n;i++){
    const arm = i & 1, th = 6.2832*u(), r = 0.8*Math.exp(th*tp/6.2832*2.4)*(1 + 0.03*(u() - 0.5)), a = th + arm*Math.PI + 0.06*(u() - 0.5);
    const c = u() < 0.12 ? [1, 0.45, 0.68] : [0.6 + 0.15*u(), 0.72 + 0.1*u(), 1];
    ps.a.set([r*Math.cos(a), (u() - 0.5)*0.01, r*Math.sin(a), 0.6 + 0.6*u()], i*4); ps.c.set([c[0], c[1], c[2], 0], i*4);
  }
  ps.upload('ac');
  o.particles.push({ ps, prog:'ptBasic', mode:0, sb:0.18, size:1.3, cap:0.5 });
}
// (two neighbours drawn so the pictures look right; on neither checklist, so left out of the atlas like NGC 3628 in the Leo Triplet)
// (NGC 4647 at M60's distance: its own is a rough Tully-Fisher 51 million light-years; HyperLeda's size and tilt)
addGalaxy({ key:'ngc4647', name:'NGC 4647', label:'NGC 4647', type:'spiral galaxy · beside M60, the pair Arp 116 · Virgo Cluster', ...galAt(190.88559, 11.58247, 53.8e6, 32, 139), atlas:false,
  fact:'A spiral beside M60 on our sky; together they are Arp 116. Its gas reaches toward M60 and it may be starting to feel M60\'s pull, but it shows no strong tidal features, and whether the two really interact is not settled.',
  rad:23000, sizeR:21500, g:{ arms:2, pitch:20, bulge:0.3, dust:1, bar:0.08, H:0.011, sf:1.2, irr:0.4, Rd:0.3, seed:129 }, farLum:0.5,
  aka:'ngc 4647 arp 116 ugc 7896 vcc 1972', readout:() => 'about 54 million light-years, taken to be M60\'s · about 43,000 light-years across\ntwo supernovae seen in it, in 1979 and 2022' });
addGalaxy({ key:'ngc3384', name:'NGC 3384', label:'NGC 3384', type:'lenticular galaxy · beside M105 · the Leo I group', ...galAt(162.07036, 12.62927, 36e6, 90, 53), atlas:false,
  fact:'A lenticular galaxy beside M105, seen at a slant. Shells of stars round it tell of a small galaxy it swallowed not long ago, and with M105 it sits inside the Leo Ring of hydrogen.',
  rad:30000, sizeR:27500, g:{ ell:0.54, Rd:0.35, sf:0.05, gain:1.3 }, stars:3500, farLum:0.6, views:ellViews(90),
  aka:'ngc 3384 ngc 3371 ugc 5911', readout:() => 'about 36 million light-years, taken to be M105\'s · about 55,000 light-years across\nits black hole weighs about 16 million Suns' });
// M32 and M110 (o17-andromeda.js), listed since 0.25.0: each turned to its real position angle, seen edge-on so that what we see of its
// flattening is all of it, with a smooth galaxy's angles (position angles: M32's isophotes and stars' motions, Joseph et al. 2001 and Bacon
// et al. 2001; M110's HyperLeda)
for (const [key, pa] of [['m32', 160], ['m110', 170]]){ const o = BYKEY[key]; o.R0 = o.rot = discR0(o.pos, 90, pa); o.views = ellViews(90); }

// ---------------------------------------------------------------- the last six open clusters, from their real stars (gaiaOpenCluster, p8-messier.js)
// (distances: Hunt & Reffert 2023, Gaia DR3; ages: published fits, or a range where they disagree; sizes: the spread of the members drawn)
gaiaOpenCluster('m18', { name:'M18', label:'M18', type:'open star cluster · in Sagittarius', labelRange:9e4,
  fact:'A small, loose cluster of young stars, found by Messier in 1764, between the Omega Nebula and the Sagittarius Star Cloud on our sky. Its brightest stars are hot blue giants.',
  aka:'m18 messier 18 ngc 6613 black swan cluster sagittarius',
  readout:() => '4,900 light-years (Gaia) · its stars spread over about 80 light-years\nabout 20 to 50 million years old · 173 of its stars as Gaia measured them' });
gaiaOpenCluster('m21', { name:'M21', label:'M21', type:'open star cluster · in Sagittarius', labelRange:8e4,
  fact:'One of the youngest clusters in Messier\'s list: its stars formed only 5 to 13 million years ago. On our sky it lies just beside the Trifid Nebula, but it is not part of it.',
  aka:'m21 messier 21 ngc 6531 webb\'s cross sagittarius',
  readout:() => '3,920 light-years (Gaia) · its stars spread over about 24 light-years\nabout 5 to 13 million years old · 212 of its stars as Gaia measured them' });
gaiaOpenCluster('m26', { name:'M26', label:'M26', type:'open star cluster · in Scutum', labelRange:1e5,
  fact:'A rich cluster in Scutum, found by Messier in 1764 and dimmed about five times over by the dust between us. Its brightest star is a blue-white giant.',
  aka:'m26 messier 26 ngc 6694 scutum',
  readout:() => '5,990 light-years (Gaia) · its stars spread over about 53 light-years\nabout 100 to 140 million years old · 470 of its stars as Gaia measured them' });
gaiaOpenCluster('m48', { name:'M48', label:'M48', type:'open star cluster · in Hydra', labelRange:6e4,
  fact:'A big, bright cluster that Messier recorded in 1771 with a wrong position, about four degrees too far north, so for a century and a half it was counted as lost. It was matched to NGC 2548 in 1934 and again in 1959.',
  aka:'m48 messier 48 ngc 2548 hydra',
  readout:() => '2,440 light-years (Gaia) · its stars spread over about 60 light-years\nabout 400 to 450 million years old · 489 of its stars as Gaia measured them' });
gaiaOpenCluster('m50', { name:'M50', label:'M50', type:'open star cluster · in Monoceros', labelRange:7e4,
  fact:'A rich cluster whose brightest star, an orange giant, shines just south of its middle. In 2025 Gaia\'s measurements showed it is really two clusters about 40 light-years apart, born together and probably slowly drifting apart.',
  aka:'m50 messier 50 ngc 2323 heart-shaped cluster monoceros',
  readout:() => '3,120 light-years (Gaia) · its stars spread over about 43 light-years\nabout 130 to 160 million years old · 600 of its stars as Gaia measured them' });
gaiaOpenCluster('m93', { name:'M93', label:'M93', type:'open star cluster · in Puppis', labelRange:7e4,
  fact:'One of the last objects Messier found himself, in March 1781. Its brightest stars form a wedge that reminded observers of a starfish or a butterfly, and several of them have swollen into red giants.',
  aka:'m93 messier 93 ngc 2447 puppis',
  readout:() => '3,170 light-years (Gaia) · its stars spread over about 41 light-years\nabout 400 to 700 million years old · 600 of its stars as Gaia measured them' });

// ---------------------------------------------------------------- M40 and M73: stars that line up only from where we stand
// Messier took both for clusters or nebulae. Each is a few stars at very different distances that happen to lie in nearly one direction
// from Earth. Every star is drawn where Gaia DR3 puts it: its position, its distance from its parallax (Bailer-Jones et al. 2021's
// geometric distance), its colour from BP-RP (the formula gaiaCluster uses; both lie well out of the Milky Way's dust) and its brightness
// from its absolute G magnitude. A faint dashed line is our line of sight through them, and each star's label gives its distance. From
// Earth M40's two stars are 53 arcseconds apart and M73's four lie within 1.5 arcminutes: far smaller than anything the atlas's view can
// show, so the first angle looks from close to our own direction and the second from the side.
function lineOfSight(def, stars){
  const W = stars.map(s => radec(s.ra/15, s.dec, s.ly)), lys = stars.map(s => s.ly);
  const near = Math.min(...lys), far = Math.max(...lys), mid = (near + far)/2;
  const pos = V.mul(V.norm(W.reduce((a, w) => V.add(a, V.norm(w)), [0, 0, 0])), mid), RAD = Math.round((far - near)*0.62);
  const R0 = facingEarth(pos, [0, 0, 1], 0);   // (local +z toward Earth: our line of sight is the local z axis)
  const ps = makePS(stars.length), sp = [];
  stars.forEach((s, i) => {
    const p = V.mul(M3.applyT(R0, V.sub(W[i], pos)), 1/RAD), C = s.bprp, Mg = s.g - 5*Math.log10(s.ly/32.616);
    const col = blackbodyJS(clamp(5040/(0.4929 + 0.5092*C - 0.0353*C*C), 3000, 25000)), w = clamp(0.6 + (6 - Mg)*0.2, 0.5, 2.4);
    ps.a.set([p[0], p[1], p[2], w], i*4); ps.c.set([col[0], col[1], col[2], 0], i*4); sp.push({ p, w, c:col });
    addMarker(def.key + '-' + (i + 1), s.label, W[i], RAD*0.04, RAD*14);
  });
  ps.upload('ac');
  // (the line of sight: dashes from a little nearer Earth than the nearest star to a little beyond the farthest)
  const z0 = (mid - near)/RAD + 0.32, z1 = -((far - mid)/RAD + 0.2), N = 40, ln = makePS(N*2);
  for (let i=0;i<N;i++) for (let e=0;e<2;e++){ const z = z0 + (z1 - z0)*(i + e*0.55)/N; ln.a.set([0, 0, z, 1], (i*2 + e)*4); ln.c.set([0.5, 0.6, 0.85, 0], (i*2 + e)*4); }
  ln.upload('ac');
  addMarker(def.key + '-earthward', 'toward Earth', V.add(pos, M3.apply(R0, [0, 0, z0*RAD])), RAD*0.04, RAD*14);
  const zN = (mid - near)/RAD;   // (the nearest star's place along the line, local units)
  return addObj(Object.assign({ group:'stars', pos, rad:RAD, R0, sizeR:Math.round((far - near)/2), sortKey:Math.round(near), minZoom:0.03, pxMin:3, noImpostor:true,
    labelDisc:0.01, labelRange:RAD*60,
    // (from the side, where the stars stand far apart along our line of sight; from three-quarters on our side, where they draw together;
    // close by the nearest star, looking along the line the way we do from Earth, the others behind it)
    views:[{ d:[1, 0.22, 0.08], k:1.8, hold:9, drift:0.02 }, { d:[0.45, 0.25, 1], k:1.6, hold:9, drift:0.02 }, { d:[0.22, 0.12, 1], k:0.3, off:[0, 0, zN], hold:8, drift:0.02 }],
    particleVis:() => 1,
    particles:[{ ps, prog:'ptBasic', mode:1, sb:1.5, size:2 }, { ps:makeSpikes(sp), prog:'spike', lines:true, mode:1, sb:2.2, size:1, len:0.035, q0:() => [1, 0, 0, 0] },
      { ps:ln, prog:'lnBasic', lines:true, mode:3, sb:0.35, size:1 }] }, def));
}
// (Gaia DR3 source ids: M40 A 1575047353068482688, B 1575047731026006528; M73 6888761925104124544, 6888763058975491840,
// 6888762676722911104, 6888762676722910720. Distances: Bailer-Jones et al. 2021, geometric, light-years)
lineOfSight({ key:'m40', name:'M40', label:'M40', type:'a chance pair of stars · Winnecke 4 · in Ursa Major', atlasDist:'470 and 1,010 ly', distEarth:'470 and 1,010 light-years',
  fact:'Messier went looking here in 1764 for a nebula that Johannes Hevelius had listed nearby, and found only two faint stars, which he listed anyway. They are not a pair: Gaia shows the brighter one is twice as far away, and since 1863 they have drifted from 49 to 53 arcseconds apart on our sky.',
  aka:'m40 messier 40 winnecke 4 wnc 4 double star ursa major big dipper hd 238107 hd 238108',
  readout:() => 'its two stars: about 470 and 1,010 light-years away (Gaia)\nthe nearer one has a white dwarf of its own, 720 AU from it' },
  [{ ra:185.55180, dec:58.08290, ly:1006, g:9.47, bprp:1.03, label:'1,010 ly' }, { ra:185.57893, dec:58.08651, ly:469, g:10.02, bprp:0.68, label:'470 ly' }]);
lineOfSight({ key:'m73', name:'M73', label:'M73', type:'four stars by chance · in Aquarius', atlasDist:'1,020 to 2,240 ly', distEarth:'1,020 to 2,240 light-years',
  fact:'Four stars that look like a tiny cluster: Messier listed them in 1780 as three or four small stars that at first look like a nebula. In 2000 astronomers argued over whether they were the remains of an old cluster; spectra in 2002 showed they are not, and Gaia now puts them at very different distances.',
  aka:'m73 messier 73 ngc 6994 asterism aquarius',
  readout:() => 'its four stars: about 1,020, 1,230, 2,140 and 2,240 light-years away (Gaia)\nthey move in different directions: not a cluster' },
  [{ ra:314.73658, dec:-12.64182, ly:2237, g:10.00, bprp:1.25, label:'2,240 ly' }, { ra:314.74009, dec:-12.62940, ly:1231, g:11.13, bprp:0.72, label:'1,230 ly' },
   { ra:314.72833, dec:-12.63447, ly:1019, g:11.48, bprp:0.86, label:'1,020 ly' }, { ra:314.72221, dec:-12.63181, ly:2137, g:12.05, bprp:1.15, label:'2,140 ly' }]);

// ---------------------------------------------------------------- the Virgo Cluster: the nearest big cluster of galaxies
// Its 16 Messier galaxies are objects of their own, each at its own measured distance (M87 in o18-m87.js, M84 and M86 in p8-messier.js, the
// rest above). The other 1,012 members by the Extended Virgo Cluster Catalog's infall model are points (VIRGO_MEMBERS, p0v-virgo-data.js,
// from tools/virgo-members.mjs): each at its real place on the sky, coloured by its type, as bright as its SDSS r magnitude says. 71 of
// them have distances measured from the graininess of their starlight (surface-brightness fluctuations, Mei et al. 2007); the others' places
// along our line of sight are made up (a bell curve round the middle, as deep as the cluster is wide at that distance from M87, never less
// than the measured ones' spread), from a generator seeded by the key, never the shared rnd().
// Its hot gas, seen in X-rays (invisible to the eye; pink, as the Bullet Cluster's and El Gordo's): a faint glow centred on M87, with
// smaller ones round M49 and M86, the three brightest peaks of the ROSAT maps (Böhringer et al. 1994). Each is a beta model, its
// light falling as (1 + r^2/rc^2)^-1.5 (light goes as the square of the density; beta about 1/2), whose sum along a ray has a closed
// form: rc^3/A^2 (1 + t/sqrt(A^2 + t^2)), A^2 = rc^2 + b^2, b the ray's closest pass and t how far ahead that is (so a camera inside a
// halo sees only the part in front of it). Divided by rc, every halo's middle is as bright as its weight. Nothing is marched: the glow
// is far smaller than the cluster, and steps across the whole cluster missed it. uP0..uP2: centres (local units) and weights; uP3: the
// three core radii and the gain
const FS_VIRGOGAS = COMMON + `
float halo(vec3 o, vec3 d, vec4 c, float rc){
  vec3 oc = c.xyz - o; float t = dot(oc, d), A2 = rc*rc + max(dot(oc, oc) - t*t, 0.);
  return c.w*rc*rc/A2*(1. + t/sqrt(A2 + t*t));
}
void main(){
  vec3 o, d; localRay(o, d);
  float g = halo(o, d, uP0, uP3.x) + halo(o, d, uP1, uP3.y) + halo(o, d, uP2, uP3.z);
  outCol(vec3(1., 0.42, 0.72)*g*uP3.w, 0.);
}`;
const virgoCluster = (() => {
  const C = VIRGO_MEMBERS, n = C.n, MPC = 3.2616e6, Dc = C.dMean*MPC, sig0 = 0.7*C.dSd*MPC;
  const bin = atob(C.s), dv = new DataView(Uint8Array.from(bin, ch => ch.charCodeAt(0)).buffer), u = keyRnd('virgocluster');
  const gauss = () => Math.sqrt(-2*Math.log(Math.max(u(), 1e-9)))*Math.cos(6.2832*u());
  const pos = radec(C.ra0/15, C.dec0, Dc), R0 = facingEarth(pos, [0, 0, 1], 0), dirC = V.norm(pos);
  const TYPE_C = [[1, 0.76, 0.52], [1, 0.82, 0.62], [1, 0.86, 0.7], [0.7, 0.8, 1], [0.6, 0.74, 1], [0.86, 0.86, 0.95]];
  const W = [];
  for (let i=0;i<n;i++){
    const ra = C.ra0 + dv.getInt16(i*8, true)/1000, dec = C.dec0 + dv.getInt16(i*8 + 2, true)/1000, rb = dv.getUint8(i*8 + 4), t = dv.getUint8(i*8 + 5), dm = dv.getUint16(i*8 + 6, true)/100;
    const dir = radecDir(ra/15, dec), rp = Math.acos(clamp(V.dot(dir, dirC), -1, 1))*Dc;
    const D = dm > 0 ? dm*MPC : Dc + gauss()*Math.max(sig0, 0.6*rp);
    const r = rb === 255 ? 18 : (rb + 50)/10, Mr = r - 5*Math.log10(D/32.616);
    W.push({ w:V.mul(dir, D), c:TYPE_C[t] || TYPE_C[5], b:clamp(0.3 + (-14 - Mr)*0.24, 0.25, 2.2) });
  }
  const rr = W.map(g => V.len(V.sub(g.w, pos))).sort((a, b) => a - b), RAD = Math.round(rr[Math.floor(0.97*(n - 1))]*1.05);
  const ps = makePS(n);
  W.forEach((g, i) => { const p = V.mul(M3.applyT(R0, V.sub(g.w, pos)), 1/RAD); ps.a.set([p[0], p[1], p[2], g.b], i*4); ps.c.set([g.c[0], g.c[1], g.c[2], 0], i*4); });
  ps.upload('ac');
  const loc = o => V.mul(M3.applyT(R0, V.sub(o.pos, pos)), 1/RAD), g87 = loc(m87), g49 = loc(BYKEY.m49), g86 = loc(BYKEY.m86);
  // (the radii are set by how far the glow reaches on the ROSAT maps, about 3 to 4 degrees round M87, not by the fits' small cores, which
  // would leave a speck at the cluster's scale)
  const rc = ly => ly/RAD;
  return addObj({ key:'virgocluster', name:'Virgo Cluster', label:'Virgo Cluster', type:'cluster of galaxies · the nearest big one · in Virgo and Coma Berenices', group:'cosmic', layer:1,
    // (its size: the main body out to the virial radii of its two big parts, about 11 degrees across our sky, 3 Mpc: Ferrarese et al. 2012;
    // the points reach further, into the region still falling in)
    sortKey:Math.round(Dc), pos, rad:RAD, R0, sizeR:5e6, minZoom:0.02, pxMin:3, noImpostor:true, labelDisc:0.01, labelRange:3e9, labelMin:3e6,
    prog:program(VS_RECT, FS_VIRGOGAS), visFn(){ return smooth(1.5e6, 5e6, viewDist()); },
    setU(pr){ gl.uniform4f(pr.u.uP0, ...g87, 1); gl.uniform4f(pr.u.uP1, ...g49, 0.35); gl.uniform4f(pr.u.uP2, ...g86, 0.3); gl.uniform4f(pr.u.uP3, rc(1.2e6), rc(5e5), rc(4e5), 0.2); },
    fact:'The nearest big cluster of galaxies: thousands of them, about 54 million light-years away, held together by some 600 trillion Suns\' worth of mass, most of it dark matter. Its pull draws the Milky Way and its neighbours toward it at about 185 km/s, though the expansion of the universe still carries us away from it.',
    aka:'virgo cluster virgo i cluster of galaxies galaxy cluster markarian\'s chain markarian chain evcc vcc',
    views:[{ dirFn:() => V.norm(V.mul(pos, -1)), k:1.45, hold:10, drift:0.015 }, { d:[1, 0.25, 0.1], k:1.4, hold:9, drift:0.02 }, { d:[0.35, 0.8, 0.5], k:0.75, hold:9, drift:0.02 }],
    particleVis:() => 1,
    particles:[{ ps, prog:'ptBasic', mode:1, sb:1.2, size:1.8, vis:() => smooth(1.5e6, 5e6, viewDist()) }],
    readout:() => 'about 54 million light-years · its main body about 10 million light-years across\nits 16 Messier galaxies and 1,012 more members, drawn as points' });
})();

seed = P9C_SEED;

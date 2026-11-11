// ================================================================ content pack (0.28.0): Caldwell's southern showpieces, part 1
// The first pack from Patrick Moore's Caldwell list (docs/CONTENT.md): five globular clusters and three open clusters of the southern sky.
// The globulars are made as Messier's are (glob3Stars, p9b-messier3.js): positions are SIMBAD's (degrees, J2000; the Harvard mirror on
// 2026-11-11, when CDS in Strasbourg could not be reached); distances and masses are Baumgardt & Vasiliev 2021 and Baumgardt's online
// catalogue; core and half-light radii, ellipticity and metallicity are Harris 2010's (mwgc.dat), the horizontal branch's colour (HBR)
// Harris 1996's (VizieR VII/202); the size across is SIMBAD's angular size at that distance. The stars are made up, shaped by those numbers,
// from a generator of each cluster's own (keyRnd): this pack never calls the shared rnd(). The open clusters are drawn from their Gaia DR3
// members (gaiaOpenCluster, p8-messier.js; tools/cluster-stars.mjs), as Messier's are. The Coalsack and the Running Chicken Nebula, the rest
// of the pack's list, need looks of their own and come next.
const CON_C1 = { Tuc:'Tucana', Col:'Columba', Vel:'Vela', Ara:'Ara', Pav:'Pavo' };
// c: Caldwell number; key; ngc; nm: its name, if it has one; ra, dec: SIMBAD (deg); ly: Baumgardt & Vasiliev 2021 (rounded to 100);
// mass: Baumgardt (Suns); rc, rh: core and half-light radius (arcmin), ell, feh: Harris 2010; hbr: Harris 1996; cc: core collapsed
// (Harris 2010); size: SIMBAD's angular size (arcmin), turned into light-years across at its distance
const GLOBC1 = [
  { c:106, key:'tuc47', ngc:104, nm:'47 Tucanae', con:'Tuc', ra:6.02233, dec:-72.08144, ly:14700, mass:853000, rc:0.36, rh:3.17, size:43.8, ell:0.09, feh:-0.72, hbr:-0.99,
    fact:'The second-brightest globular cluster in the sky, after Omega Centauri, and easy to see without a telescope beside the Small Magellanic Cloud, which is about 14 times farther away. Nicolas-Louis de Lacaille recorded it from the Cape of Good Hope in 1751-52.',
    aka:'47 tuc 47 tucanae forty-seven tucanae', r2:'about 850,000 times the Sun\'s mass · dozens of known millisecond pulsars' },
  { c:86, key:'ngc6397', ngc:6397, con:'Ara', ra:265.17538, dec:-53.67433, ly:8100, mass:82400, rc:0.05, rh:2.9, size:25.7, ell:0.07, feh:-2.02, hbr:0.98, cc:true,
    fact:'One of the two nearest globular clusters, with M4. Its core has collapsed into a tight knot of stars. The Hubble Space Telescope followed its white dwarfs down to the faintest and coolest to measure how old it is.',
    aka:'', r2:'about 82,000 times the Sun\'s mass · its core collapsed' },
  { c:93, key:'ngc6752', ngc:6752, con:'Pav', ra:287.71713, dec:-59.98456, ly:13400, mass:261000, rc:0.17, rh:1.91, size:20.4, ell:0.04, feh:-1.54, hbr:1, cc:true,
    fact:'The fourth-brightest globular cluster in the sky, after Omega Centauri, 47 Tucanae and M22. Its core has collapsed, and a millisecond pulsar orbits far out in its halo, perhaps thrown out of the core by a close encounter.',
    aka:'', r2:'about 261,000 times the Sun\'s mass · its core collapsed' },
  { c:79, key:'ngc3201', ngc:3201, con:'Vel', ra:154.40342, dec:-46.41247, ly:15500, mass:193000, rc:1.3, rh:3.1, size:18.2, ell:0.12, feh:-1.59, hbr:0.08,
    fact:'It orbits the Milky Way backwards, against the turning of the disc, and is moving away from us at about 494 km/s. In 2018 astronomers found a star in it circling an unseen black hole of at least four times the Sun\'s mass.',
    aka:'', r2:'about 193,000 times the Sun\'s mass · a loose core 1.3 arcminutes wide' },
  { c:73, key:'ngc1851', ngc:1851, con:'Col', ra:78.52817, dec:-40.04656, ly:39000, mass:283000, rc:0.09, rh:0.51, size:11, ell:0.05, feh:-1.18, hbr:-0.36,
    fact:'A dense globular cluster about 39,000 light-years away. Its stars fall into at least two groups with slightly different make-up: it may have made stars more than once, or formed when two clusters merged.',
    aka:'', r2:'about 283,000 times the Sun\'s mass · at least two groups of stars' },
];
for (const c of GLOBC1){
  const key = c.key, D = c.ly, pos = simbadPos(c.ra, c.dec, D), arc = D*Math.PI/10800;   // light-years per arcminute at its distance
  const across = Math.round(c.size*arc/5)*5, sizeR = across/2, rad = Math.round(sizeR*1.2);
  const aH = clamp(0.6*c.rh*arc/rad, 0.05, 0.35), aC = clamp(c.rc*arc/rad, 0.006, 0.08), core = clamp(1.5*c.rc*arc/rad, 0.012, 0.09), flat = 1 - c.ell;
  const glow = clamp(0.45 + 0.15*Math.log10(c.mass/2e5), 0.3, 0.7), n = Math.round(clamp(9000 + 0.025*c.mass, 8000, 20000)*QUALITY);
  const name = c.nm || 'NGC ' + c.ngc;
  let ps = null;
  addGlobular({ key, name, label:name, type:`globular cluster · C${c.c} · ${c.nm ? 'NGC ' + c.ngc + ' · ' : ''}in ${CON_C1[c.con]}`, sortKey:D, pos, rad, sizeR,
    labelRange:Math.max(1.2e5, sizeR*2800), fact:c.fact,
    aka:`c${c.c} caldwell ${c.c} ngc ${c.ngc} globular cluster ${CON_C1[c.con].toLowerCase()}${c.aka ? ' ' + c.aka : ''}`,
    setU(pr){ gl.uniform4f(pr.u.uP0, glow, core, 1/flat, 0); },
    particles:[{ get ps(){ return ps || (ps = glob3Stars(key, n, aH, aC, flat, c.feh, c.hbr)); }, prog:'ptBasic', mode:0, sb:0.4, size:1.3, cap:0.9 }],
    readout:() => `${D.toLocaleString('en-US')} light-years · about ${across} light-years across\n${c.r2}` });
  // (the lightest clusters are sparse inside: the angle from within stands back further)
  if (c.mass < 1e5) BYKEY[key].views[2].k = 0.25;
}

// ---------------------------------------------------------------- three open clusters, from their real stars (gaiaOpenCluster, p8-messier.js)
// (distances: Hunt & Reffert 2023, Gaia DR3; ages: published fits, or a range where they disagree; sizes: the spread of the members drawn)
gaiaOpenCluster('jewelbox', { name:'Jewel Box', label:'Jewel Box', type:'open star cluster · C94 · NGC 4755 · in Crux', labelRange:9e4,
  fact:'John Herschel, who studied it from the Cape in the 1830s, said it looked like "a superb piece of fancy jewellery": a red supergiant shines among its blue-white giants. It sits beside Beta Crucis, one of the stars of the Southern Cross.',
  aka:'c94 caldwell 94 ngc 4755 jewel box kappa crucis cluster crux southern cross',
  readout:() => '6,450 light-years (Gaia) · its stars spread over about 38 light-years\nabout 10 to 20 million years old · 600 of its stars as Gaia measured them' });
gaiaOpenCluster('southernpleiades', { name:'Southern Pleiades', label:'Southern Pleiades', type:'open star cluster · C102 · IC 2602 · in Carina', labelRange:4e4,
  fact:'One of the nearest open clusters, gathered round the blue star Theta Carinae and bright enough to see without a telescope. Like the Pleiades, its brightest stars are young, hot and blue.',
  aka:'c102 caldwell 102 ic 2602 southern pleiades theta carinae cluster carina',
  readout:() => '490 light-years (Gaia) · its stars spread over about 39 light-years\nabout 30 to 50 million years old · 314 of its stars as Gaia measured them' });
gaiaOpenCluster('wishingwell', { name:'Wishing Well Cluster', label:'Wishing Well', type:'open star cluster · C91 · NGC 3532 · in Carina', labelRange:6e4,
  fact:'A rich cluster of a few thousand stars. Part of it was the first thing the Hubble Space Telescope photographed, on 20 May 1990.',
  aka:'c91 caldwell 91 ngc 3532 wishing well cluster football cluster carina',
  readout:() => '1,540 light-years (Gaia) · its stars spread over about 42 light-years\nabout 300 to 400 million years old · 600 of its stars as Gaia measured them' });

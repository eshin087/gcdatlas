// ================================================================ content pack (0.21.0): the third pack from the checklists, Messier's other 25 globular clusters
// With M3, M4 and M22 (p8-messier.js) and M13 (p7-places.js), all 29 of Messier's globular clusters are in the atlas. Positions are SIMBAD's
// (degrees, J2000); distances and masses are Baumgardt & Vasiliev 2021 and Baumgardt's online catalogue; core and half-light radii,
// ellipticity and metallicity are Harris 2010's, the horizontal branch's colour (HBR) Harris 1996's; the size across is each cluster's size
// on the sky as SEDS gives it, at that distance. The stars are made up, as M3's are, but shaped by those numbers: a halo as wide as the half-light
// radius and a core as tight as the measured one (the core-collapsed clusters' are tiny), as flat as the ellipticity (its direction on
// the sky is not real), more blue horizontal-branch stars where HBR is high, redder giants where there is more metal. They are built the
// first time a cluster is drawn, from a generator of its own seeded by its key: start-up does no extra work, and this pack never calls the
// shared rnd(). Also the planetary nebula Pease 1 inside M15 (addRingPN, p1-nebulae.js), and the Local Group's dwarf galaxies of
// 06g-galaxies.js, listed since 0.21.0, drawn as what they are.
const CON_NAME = { Aqr:'Aquarius', Ser:'Serpens', Oph:'Ophiuchus', Peg:'Pegasus', Sgr:'Sagittarius', Cap:'Capricornus', Com:'Coma Berenices', Lyr:'Lyra',
  Hya:'Hydra', Sge:'Sagitta', Lep:'Lepus', Sco:'Scorpius', Her:'Hercules' };
// a generator of an object's own, seeded by its key (an FNV hash into mulberry32, as gaiaCluster's depths)
function keyRnd(key){
  let z = [...key].reduce((h, ch) => Math.imul(h ^ ch.charCodeAt(0), 16777619), 2166136261) >>> 0;
  return () => { z = (z + 0x6D2B79F5) >>> 0; let t = z; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0)/4294967296; };
}
// n stars in units of the drawn radius: a fifth in a core of Plummer radius aC, the rest in a halo of Plummer radius aH, squashed by flat
// along local y. Giants are redder with more metal ([Fe/H] -2.3 to -0.7), and Harris's HBR (-1 all red to +1 all blue) splits the
// horizontal branch between blue and yellow stars.
function glob3Stars(key, n, aH, aC, flat, feh, hbr){
  const u = keyRnd(key), ps = makePS(n), met = clamp((feh + 2.3)/1.6, 0, 1), hb = clamp((hbr + 1)/2, 0, 1);
  const gc = [1, 0.7 - 0.12*met, 0.44 - 0.12*met], fb = 0.02 + 0.08*hb, fr = 0.07*(1 - hb);
  for (let i=0;i<n;i++){
    const a = u() < 0.2 ? aC : aH;
    let r, k = 0; do { r = a/Math.sqrt(Math.pow(Math.max(u(), 1e-6), -2/3) - 1); } while (r > 1 && ++k < 40);   // Plummer sphere
    r = Math.min(r, 1);
    const z = 2*u() - 1, ph = 6.2831853*u(), s = Math.sqrt(1 - z*z), q = u();
    const c = q < 0.08 ? gc : (q < 0.08 + fb ? [0.62, 0.74, 1] : (q < 0.08 + fb + fr ? [1, 0.84, 0.6] : blackbodyJS(5300 + 1000*u() + 300*(1 - met))));
    const w = q < 0.08 ? 1.7 + u() : (q < 0.08 + fb + fr ? 1.3 : 0.5 + 0.5*u());
    ps.a.set([s*Math.cos(ph)*r, z*r*flat, s*Math.sin(ph)*r, w], i*4); ps.c.set([c[0], c[1], c[2], 0], i*4);
  }
  ps.upload('ac');
  return ps;
}
// m: Messier number; ra, dec: SIMBAD (deg); ly: Baumgardt & Vasiliev 2021; mass: Baumgardt (Suns); rc, rh: core and half-light radius
// (arcmin), ell, feh: Harris 2010; hbr: Harris 1996 (the 2010 edition dropped it; none for M19); cc: core collapsed (Harris);
// across: SEDS's size on the sky at that distance (ly). Ages are VandenBerg et al. 2013's; pulsar counts are Freire's list (March 2026)
const GLOB3 = [
  { m:2, ngc:7089, con:'Aqr', ra:323.36258, dec:-0.82325, ly:38000, mass:624000, rc:0.32, rh:1.06, across:175, ell:0.11, feh:-1.65, hbr:0.96,
    fact:'One of the more massive globulars, about 620,000 times the Sun\'s mass. Its stretched orbit swings from about 2,900 light-years from the Galactic centre out to 61,000 light-years.',
    r2:'10 known pulsars, all in binary systems' },
  { m:5, ngc:5904, con:'Ser', ra:229.63842, dec:2.08103, ly:24400, mass:392000, rc:0.44, rh:1.77, across:165, ell:0.14, feh:-1.29, hbr:0.31,
    fact:'Gottfried Kirch and Maria Margarethe Kirch first saw it in 1702 while watching a comet. William Herschel first made out its stars in 1791 and counted about 200.',
    r2:'over 120 RR Lyrae variable stars' },
  { m:9, ngc:6333, con:'Oph', ra:259.79908, dec:-18.51625, ly:27100, mass:308000, rc:0.45, rh:0.96, across:95, ell:0.04, feh:-1.77, hbr:0.87,
    fact:'One of the globulars nearest the Galactic centre, about 5,600 light-years from it. Dust in the dark cloud Barnard 64 dims its light.',
    r2:'moving away from us at about 310 km/s' },
  { m:10, ngc:6254, con:'Oph', ra:254.28771, dec:-4.10031, ly:16500, mass:189000, rc:0.77, rh:1.95, across:95, ell:0, feh:-1.56, hbr:0.98,
    fact:'M10 and its neighbour in the sky, M12, are only about 1,000 light-years apart in space. Both lie about 16,600 light-years from us.',
    r2:'about 12 billion years old' },
  { m:12, ngc:6218, con:'Oph', ra:251.80908, dec:-1.94853, ly:16700, mass:106000, rc:0.79, rh:1.77, across:80, ell:0.04, feh:-1.37, hbr:0.97,
    fact:'The Milky Way\'s pull has stripped M12 of about a million of its lightest stars, about four times as many stars as it still has.',
    r2:'may fall apart in about 4.5 billion years' },
  { m:14, ngc:6402, con:'Oph', ra:264.40062, dec:-3.24592, ly:29800, mass:595000, rc:0.79, rh:1.3, across:95, ell:0.11, feh:-1.28, hbr:0.65,
    fact:'A nova flared in M14 in 1938, but nobody noticed until 1964. Amelia Wehlau found it on old photographic plates taken by Helen Sawyer Hogg.',
    r2:'about 600,000 times the Sun\'s mass' },
  { m:15, ngc:7078, con:'Peg', ra:322.49304, dec:12.167, ly:35000, mass:518000, rc:0.14, rh:1, across:185, ell:0.05, feh:-2.37, hbr:0.67, cc:true,
    fact:'One of the densest globulars known, with a collapsed core. In 1928 Francis Pease found the planetary nebula Pease 1 in it, the first one found inside a globular cluster.',
    r2:'15 known pulsars' },
  { m:19, ngc:6273, con:'Oph', ra:255.65704, dec:-26.26794, ly:27200, mass:719000, rc:0.43, rh:1.32, across:135, ell:0.27, feh:-1.74, hbr:null,
    fact:'The most flattened globular in Harris\'s catalogue, with an ellipticity of 0.27. It lies only about 4,700 light-years from the Galactic centre.',
    r2:'about 720,000 times the Sun\'s mass' },
  { m:28, ngc:6626, con:'Sgr', ra:276.13704, dec:-24.86983, ly:17500, mass:270000, rc:0.24, rh:1.97, across:55, ell:0.16, feh:-1.32, hbr:0.9,
    fact:'In 1987 astronomers found a pulsar in M28 that spins about 330 times a second. It was the first pulsar ever found in a globular cluster.',
    r2:'14 known pulsars' },
  { m:30, ngc:7099, con:'Cap', ra:325.09217, dec:-23.17986, ly:27600, mass:121000, rc:0.06, rh:1.03, across:95, ell:0.01, feh:-2.27, hbr:0.89, cc:true,
    fact:'Its stars have crowded into a tiny collapsed core. At about 13 billion years, it is among the oldest globulars measured.',
    r2:'coming toward us at about 185 km/s' },
  { m:53, ngc:5024, con:'Com', ra:198.23021, dec:18.16817, ly:60500, mass:502000, rc:0.35, rh:1.31, across:230, ell:0.01, feh:-2.1, hbr:0.76,
    fact:'One of the farthest of Messier\'s globulars, about 60,500 light-years away. Its stars hold only about 1/125 of the Sun\'s share of iron.',
    r2:'the globular NGC 5053 lies 1 degree away' },
  { m:54, ngc:6715, con:'Sgr', ra:283.76387, dec:-30.47986, ly:85500, mass:1587000, rc:0.09, rh:0.82, across:300, ell:0.06, feh:-1.49, hbr:0.87,
    fact:'The heart of the Sagittarius Dwarf, a small galaxy the Milky Way is pulling apart. Messier found it in 1778, so it was the first globular cluster from another galaxy ever seen, though nobody knew that until the galaxy was found in 1994.',
    r2:'about 1.6 million times the Sun\'s mass' },
  { m:55, ngc:6809, con:'Sgr', ra:294.99879, dec:-30.96475, ly:17400, mass:197000, rc:1.8, rh:2.83, across:95, ell:0.02, feh:-1.94, hbr:0.87,
    fact:'A big, loose globular, grainy even in binoculars. Lacaille found it in 1752 while observing from South Africa.',
    r2:'about 13 billion years old' },
  { m:56, ngc:6779, con:'Lyr', ra:289.14821, dec:30.18347, ly:34000, mass:166000, rc:0.44, rh:1.1, across:85, ell:0.03, feh:-1.98, hbr:0.98,
    fact:'A faint, loose globular half-way between Albireo and Gamma Lyrae. Its orbit suggests it came from Gaia-Enceladus, a small galaxy the Milky Way swallowed.',
    r2:'about 12.8 billion years old' },
  { m:62, ngc:6266, con:'Oph', ra:255.3025, dec:-30.11236, ly:19700, mass:581000, rc:0.22, rh:0.92, across:85, ell:0.01, feh:-1.18, hbr:0.32,
    fact:'Chandra found 43 X-ray sources in its crowded inner part. Most such sources are pairs in which a white dwarf or neutron star pulls gas from a companion.',
    r2:'10 known pulsars, all in binary systems' },
  { m:68, ngc:4590, con:'Hya', ra:189.86658, dec:-26.74406, ly:34000, mass:128000, rc:0.58, rh:1.51, across:110, ell:0.05, feh:-2.23, hbr:0.17,
    fact:'Unlike most globulars, it lies in the half of the sky away from the Galactic centre. Its orbit suggests it came from a small galaxy the Milky Way swallowed, whose stars now form the Helmi streams.',
    r2:'orbit reaches 96,000 light-years from the centre' },
  { m:69, ngc:6637, con:'Sgr', ra:277.84625, dec:-32.34808, ly:29000, mass:138000, rc:0.33, rh:0.84, across:85, ell:0.01, feh:-0.64, hbr:-1,
    fact:'The most metal-rich globular in Messier\'s list, with about a quarter of the Sun\'s share of iron. M69 and M70 are only about 2,000 light-years apart.',
    r2:'about 11 billion years old' },
  { m:70, ngc:6681, con:'Sgr', ra:280.80317, dec:-32.29211, ly:30500, mass:105000, rc:0.03, rh:0.71, across:70, ell:0.01, feh:-1.62, hbr:0.96, cc:true,
    fact:'Comet Hale-Bopp was discovered beside M70 on 23 July 1995: Thomas Bopp found it while looking at the cluster. Its core has collapsed.',
    r2:'6 known pulsars' },
  { m:71, ngc:6838, con:'Sge', ra:298.44371, dec:18.77919, ly:13000, mass:38000, rc:0.63, rh:1.67, across:25, ell:0, feh:-0.78, hbr:-1,
    fact:'M71 is so loose that for many years astronomers thought it was an open cluster. In the 1970s they agreed it is a sparse globular.',
    r2:'about 11 billion years old' },
  { m:72, ngc:6981, con:'Aqr', ra:313.36542, dec:-12.53731, ly:54500, mass:81000, rc:0.46, rh:0.93, across:105, ell:0.02, feh:-1.42, hbr:0.14,
    fact:'One of the faintest and farthest of Messier\'s globulars: its light set out about 54,500 years ago.',
    r2:'coming toward us at about 330 km/s' },
  { m:75, ngc:6864, con:'Sgr', ra:301.52017, dec:-21.92226, ly:67000, mass:459000, rc:0.09, rh:0.46, across:130, ell:0.07, feh:-1.29, hbr:-0.42,
    fact:'A small, very compact globular about 67,000 light-years away, one of the farthest in Messier\'s list. Harlow Shapley put it in his densest class, I.',
    r2:'about 460,000 times the Sun\'s mass' },
  { m:79, ngc:1904, con:'Lep', ra:81.04413, dec:-24.52425, ly:42500, mass:181000, rc:0.16, rh:0.65, across:120, ell:0.01, feh:-1.6, hbr:0.89,
    fact:'M79 lies in the half of the sky away from the Galactic centre. Its orbit suggests it was born in a small galaxy that the Milky Way swallowed long ago.',
    r2:'orbit dips to about 1,000 light-years from the centre' },
  { m:80, ngc:6093, con:'Sco', ra:244.26004, dec:-22.97608, ly:33500, mass:321000, rc:0.15, rh:0.61, across:100, ell:0, feh:-1.75, hbr:0.93,
    fact:'One of the densest globulars. Hubble found more than twice as many blue stragglers there as in other clusters it surveyed: stars that look younger than the rest. A nova, T Scorpii, flared in it in 1860.',
    r2:'7 known pulsars, all in binary systems' },
  { m:92, ngc:6341, con:'Her', ra:259.28079, dec:43.13594, ly:27700, mass:273000, rc:0.26, rh:1.02, across:115, ell:0.1, feh:-2.31, hbr:0.91,
    fact:'One of the oldest and most metal-poor globulars. Age estimates run from about 12.8 billion years (2013) to 13.8 billion years (2023).',
    r2:'about 1/200 of the Sun\'s share of iron' },
  { m:107, ngc:6171, con:'Oph', ra:248.13275, dec:-13.05378, ly:18400, mass:61000, rc:0.56, rh:1.73, across:70, ell:0.02, feh:-1.02, hbr:-0.73,
    fact:'The last Messier object to be found. Pierre Méchain saw it in April 1782, but it joined the list only in 1947, when Helen Sawyer Hogg added it.',
    r2:'about 12 billion years old' },
];
// (search words beyond the names and numbers; never another object's catalogue number: Pease 1 keeps its own, M15 has none of it)
const GLOB3_AKA = { 2:'pulsars', 5:'rr lyrae variable stars kirch', 9:'barnard 64 galactic centre', 12:'stripped stars', 14:'nova 1938',
  15:'core collapse pulsars great pegasus cluster', 19:'flattened oblate galactic centre', 28:'pulsar', 30:'core collapse',
  53:'distant', 54:'sagittarius dwarf galaxy sgr dsph nucleus', 55:'lacaille', 56:'gaia-enceladus', 62:'x-ray sources pulsars chandra', 68:'helmi streams',
  69:'metal-rich', 70:'core collapse comet discovered', 71:'loose sparse', 72:'distant faint', 75:'distant dense compact', 79:'gaia-enceladus',
  80:'blue stragglers nova t scorpii', 92:'oldest metal-poor', 107:'last messier object hogg' };
const GLOB3_TYPE = { 54:'the heart of the Sagittarius Dwarf galaxy', 71:'loose, once thought an open cluster · in Sagitta', 15:'collapsed core · in Pegasus' };
for (const c of GLOB3){
  const key = 'm' + c.m, D = c.ly, pos = simbadPos(c.ra, c.dec, D), arc = D*Math.PI/10800;   // light-years per arcminute at its distance
  const sizeR = c.across/2, rad = Math.round(sizeR*1.2);
  const aH = clamp(0.6*c.rh*arc/rad, 0.05, 0.35), aC = clamp(c.rc*arc/rad, 0.006, 0.08), core = clamp(1.5*c.rc*arc/rad, 0.012, 0.09), flat = 1 - c.ell;
  const glow = clamp(0.45 + 0.15*Math.log10(c.mass/2e5), 0.3, 0.7), n = Math.round(clamp(9000 + 0.025*c.mass, 8000, 20000)*QUALITY);
  let ps = null;
  addGlobular({ key, name:'M' + c.m, label:'M' + c.m, type:'globular cluster · ' + (GLOB3_TYPE[c.m] || 'in ' + CON_NAME[c.con]), sortKey:D, pos, rad, sizeR,
    labelRange:Math.max(1.2e5, sizeR*2800), fact:c.fact,
    aka:`m${c.m} messier ${c.m} ngc ${c.ngc} globular cluster ${CON_NAME[c.con].toLowerCase()}${GLOB3_AKA[c.m] ? ' ' + GLOB3_AKA[c.m] : ''}`,
    setU(pr){ gl.uniform4f(pr.u.uP0, glow, core, 1/flat, 0); },
    particles:[{ get ps(){ return ps || (ps = glob3Stars(key, n, aH, aC, flat, c.feh, c.hbr ?? 0)); }, prog:'ptBasic', mode:0, sb:0.4, size:1.3, cap:0.9 }],
    readout:() => `${D.toLocaleString('en-US')} light-years · about ${c.across} light-years across\n${c.r2}` });
  // (the lightest clusters are sparse inside: the angle from within stands back further)
  if (c.mass < 1e5) BYKEY[key].views[2].k = 0.25;
}

// ---------------------------------------------------------------- Pease 1: the first planetary nebula found in a globular cluster (M15)
// (SIMBAD's position is Gaia's for its central star, 30 arcseconds from M15's centre; HST measured a shell 3.1 x 2.7 arcseconds, about half
// a light-year, inside a halo about 1.1 light-years across: Alves, Bond & Livio 2000. Central star 39,000 K: Rauch, Heber & Werner 2002)
{
  const D = 35000, pos = simbadPos(322.497489, 12.173965, D);
  addRingPN({ key:'pease1', name:'Pease 1', label:'Pease 1', type:'planetary nebula · inside the globular cluster M15', sortKey:D + 1, pos, rad:0.6, sizeR:0.25,
    farColor:[0.6, 0.95, 0.85], labelRange:600, minZoom:0.1,
    fact:'The first planetary nebula found inside a globular cluster: a shell of gas thrown off by a dying star among M15\'s ancient stars. Francis Pease found it in 1928, and only three more are known in globulars.',
    aka:'pease 1 ps 1 pn ps 1 k 648 ku 648 pn ku 648 pk 065-27 1 pn g065.0-27.3 planetary nebula globular cluster pegasus',
    hero:V.norm([0.1, 0.15, 1]), roll:32, u:[[0.42, 0.14, 0.3, 0.7], [0, 0, 0, 0.92], [0.12, 0, 0.2, 0]],
    // (the third angle stands back among M15's stars, its bright core about 5 light-years off to one side)
    views:[{ dirFn:() => V.norm(V.mul(pos, -1)), k:2.2, hold:9, drift:0.02 }, { d:[0.5, 0.3, 0.8], k:1.3, hold:8, drift:0.03 }, { dirFn:() => V.norm(V.mul(pos, -1)), k:10, hold:8, drift:0.02 }],
    tourViews:[0, 2],
    readout:() => '35,000 light-years · about half a light-year across\nits central star is about 39,000 K' });
}

// ---------------------------------------------------------------- the Local Group's dwarf galaxies (06g-galaxies.js), drawn as what they are
// Made in 06g-galaxies.js with the shared rnd() (left as it was there, so everything made after them keeps its numbers); here each is
// turned to its real position angle on the sky (discR0; McConnachie 2012 and its 2021 table) and given stars of its own. The dwarf spheroidals are old, faint
// and smooth: no bright middle, so their glow is the globular clusters' (a soft core as wide as the half-light radius) and their stars
// are red giants with a few blue horizontal-branch stars. The dwarf irregulars still make stars: the Small Magellanic Cloud's patchy
// look, with blue stars in clumps and a few pink clouds of glowing gas.
// key: rh, the half-light radius over the drawn radius (McConnachie's 2021 table; the irregulars' are uncertain by up to 4 times, so
// IC 1613's and WLM's are capped where the drawing still has an edge); ell: ellipticity; pa: position angle (deg); irr: a dwarf
// irregular (its tilt i from the axis ratio, for a disc a third as thick as it is wide); bar: NGC 6822's bar
const DWARF_LOOK = {
  sgrdsph:{ rh:0.25, ell:0.64, pa:102, glow:0.3 }, fornaxd:{ rh:0.27, ell:0.28, pa:46, glow:0.3 }, sculptord:{ rh:0.17, ell:0.37, pa:94 },
  leoi:{ rh:0.24, ell:0.3, pa:78 }, dracod:{ rh:0.21, ell:0.3, pa:87, glow:0.2 },
  ngc6822:{ rh:0.23, ell:0.24, pa:330, irr:true, bar:0.25, seed:41 }, ic1613:{ rh:0.4, ell:0.11, pa:50, irr:true, seed:43 }, wlm:{ rh:0.45, ell:0.55, pa:179, irr:true, seed:47 },
};
function dwarfStars(key, n, L){
  const u = keyRnd(key), ps = makePS(n), q = 1 - L.ell;
  const knots = Array.from({ length:L.irr ? 14 : 0 }, () => { const r = 1.3*L.rh*Math.sqrt(u()), a = 6.2832*u(); return [r*Math.cos(a), r*Math.sin(a)]; });
  for (let i=0;i<n;i++){
    let p, c, w;
    if (L.irr && u() < 0.35){   // young stars in clumps, in the disc
      const k = knots[Math.floor(u()*knots.length)], s = 0.05 + 0.05*u(), g1 = Math.sqrt(-2*Math.log(Math.max(u(), 1e-9))), g2 = 6.2832*u();
      p = [k[0] + s*g1*Math.cos(g2), (u() - 0.5)*0.06, k[1] + s*g1*Math.sin(g2)]; const pink = u() < 0.08;
      c = pink ? [1, 0.42, 0.65] : [0.55 + 0.15*u(), 0.68 + 0.12*u(), 1]; w = pink ? 1.5 : 1.1;
    } else {   // old stars: a Plummer ball as wide as the half-light radius, squashed along local y
      let r, k = 0; do { r = L.rh/Math.sqrt(Math.pow(Math.max(u(), 1e-6), -2/3) - 1); } while (r > 1 && ++k < 40); r = Math.min(r, 1);
      const z = 2*u() - 1, ph = 6.2832*u(), s = Math.sqrt(1 - z*z), t = u();
      p = [s*Math.cos(ph)*r, z*r*(L.irr ? 0.35 : q), s*Math.sin(ph)*r];
      c = t < 0.1 ? [0.62, 0.74, 1] : blackbodyJS(3900 + 1300*u()); w = t < 0.1 ? 1 : 0.7 + 0.4*u();
    }
    ps.a.set([p[0], p[1], p[2], w], i*4); ps.c.set([c[0], c[1], c[2], 0], i*4);
  }
  ps.upload('ac');
  return ps;
}
for (const [key, L] of Object.entries(DWARF_LOOK)){
  const o = BYKEY[key], q = 1 - L.ell, inc = L.irr ? Math.acos(Math.sqrt(clamp((q*q - 0.11)/0.89, 0, 1)))/DEG : 90;
  o.R0 = o.rot = discR0(o.pos, inc, L.pa);
  // (the atlas's size: the drawn radius is measured here, the King radius, so not the 0.6 of rad a galaxy's bounding sphere gets; an
  // irregular is drawn out to 1.5 R25 and listed at R25, as the other galaxies are by their D25: from Codex's review of #54)
  o.sizeR = L.irr ? Math.round(o.rad/1.5) : o.rad;
  if (L.irr){ o.setU = galaxyU({ arms:0, bulge:0.15, dust:0.25, bar:L.bar || 0, barAng:0, H:0.06, sf:1.1, irr:1, Rd:clamp(L.rh/1.68, 0.12, 0.3), seed:L.seed }); o.farColor = [0.8, 0.85, 1]; }
  else { o.prog = omegacen.prog; o.setU = pr => gl.uniform4f(pr.u.uP0, L.glow || 0.25, L.rh*0.7, 1/q, 0); }
  // (the stars 06g-galaxies.js drew for it are let go: they were made only to keep the shared random numbers as they were)
  const old = o.particles[0].ps; gl.deleteBuffer(old.b0); gl.deleteBuffer(old.b1); gl.deleteVertexArray(old.vao);
  let ps = null; const n = Math.round((L.irr ? 6000 : 4500)*QUALITY);
  o.particles[0] = { get ps(){ return ps || (ps = dwarfStars(key, n, L)); }, prog:'ptBasic', mode:0, sb:L.irr ? 0.3 : 0.22, size:1.3, cap:0.7 };
}

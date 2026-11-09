
// ================================================================ Andromeda (M31) and its satellites M32 and M110
const andromeda = addGalaxy({ key:'andromeda', name:'Andromeda Galaxy', label:'Andromeda', type:'giant spiral · our nearest big neighbour · M31', sortKey:2.537e6,
  fact:'A trillion stars 2.5 million light-years away, the most distant thing most people can see without a telescope. It is falling toward us at 110 km/s and will merge with the Milky Way in about 4.5 billion years.',
  pos:radec(hms(0,42,44.3), dms(41,16,9), 2.537e6), rad:110000, incl:77, pa:38, stars:16000, aka:'m31 messier 31 ngc 224 andromeda nebula',
  g:{ arms:2, pitch:7, bulge:1.4, dust:2.1, H:0.009, sf:1.2, Rd:0.2, ring:0.3, irr:0.25, seed:71, armRef:0.3, starGain:0.9, gain:1.3 },
  farLum:1.2, labelRange:3e8, views:[{dirFn:() => V.norm(V.mul(andromeda.pos, -1)), k:1.5, hold:9, drift:0.02}, {d:[0.2, 0.9, 0.35], k:1.25, hold:9, drift:0.02}, {d:[1, 0.08, 0.2], k:1.1, hold:8, drift:0.02}],
  readout:() => '2.5 million light-years: you see it as it was when our ancestors first made stone tools\n~220,000 light-years across, about twice the Milky Way' });
// (M32 and M110 are listed since 0.25.0, which completed the Messier list: their numbers moved here from Andromeda's aka. p9c-messier4.js
// turns them to their real position angles and gives them a smooth galaxy's angles; their stars are drawn here, with the shared rnd(), as
// before)
// (distances: RR Lyrae stars, Savino et al. 2022, the same scale as Andromeda's 2.537 million; sizes: RC3's D25)
addGalaxy({ key:'m32', name:'M32', label:'M32', type:'compact elliptical galaxy · satellite of Andromeda', sortKey:2.52e6,
  fact:'A small, dense galaxy close to Andromeda, and the first galaxy of the elliptical kind ever recorded: Guillaume Le Gentil saw it in 1749, long before anyone knew what galaxies were. It may be the stripped core of a big galaxy that Andromeda swallowed about 2 billion years ago.',
  pos:radec(hms(0,42,41.8), dms(40,51,55), 2.52e6), rad:4000, sizeR:3200, incl:30, g:{ ell:0.2, Rd:0.25 }, farLum:0.6, labelRange:2e6,
  aka:'m32 messier 32 ngc 221 le gentil arp 168 compact elliptical satellite of andromeda',
  readout:() => '2.52 million light-years · about 6,400 light-years across\nits black hole weighs about 2.5 million Suns' });
addGalaxy({ key:'m110', name:'M110', label:'M110', type:'dwarf elliptical galaxy · satellite of Andromeda', sortKey:2.73e6,
  fact:'A dwarf elliptical galaxy that orbits Andromeda. Messier saw it in 1773 and included it in his drawing of Andromeda but never listed it; Caroline Herschel found it on her own in 1783, and it was given the number 110 only in 1967. Unlike most of its kind it holds dust and young stars near its centre.',
  sizeR:8700, aka:'m110 messier 110 ngc 205 dwarf elliptical satellite of andromeda caroline herschel',
  pos:radec(hms(0,40,22.1), dms(41,41,7), 2.73e6), rad:9000, incl:60, g:{ ell:0.45, Rd:0.35 }, farLum:0.5, labelRange:3e6,
  readout:() => '2.73 million light-years · about 17,000 light-years across\nabout 130,000 to 190,000 light-years behind Andromeda' });


// ================================================================ Andromeda (M31) and its satellites M32 and M110
const andromeda = addGalaxy({ key:'andromeda', name:'Andromeda Galaxy', label:'Andromeda', type:'giant spiral · our nearest big neighbour · M31', sortKey:2.537e6,
  fact:'A trillion stars 2.5 million light-years away, the most distant thing most people can see without a telescope. It is falling toward us at 110 km/s and will merge with the Milky Way in about 4.5 billion years.',
  pos:radec(hms(0,42,44.3), dms(41,16,9), 2.537e6), rad:110000, incl:77, pa:38, stars:16000, aka:'m31 andromeda nebula',
  g:{ arms:2, pitch:7, bulge:1.4, dust:2.1, H:0.009, sf:1.2, Rd:0.2, ring:0.3, irr:0.25, seed:71, armRef:0.3, starGain:0.9, gain:1.3 },
  farLum:1.2, labelRange:3e8, views:[{dirFn:() => V.norm(V.mul(andromeda.pos, -1)), k:1.5, hold:9, drift:0.02}, {d:[0.2, 0.9, 0.35], k:1.25, hold:9, drift:0.02}, {d:[1, 0.08, 0.2], k:1.1, hold:8, drift:0.02}],
  readout:() => '2.5 million light-years: you see it as it was when our ancestors first made stone tools\n~220,000 light-years across, about twice the Milky Way' });
addGalaxy({ key:'m32', name:'M32', label:'M32', type:'compact elliptical · satellite of Andromeda', sortKey:2.49e6, atlas:false,
  fact:'A small, dense elliptical galaxy, probably the stripped core of a larger galaxy that Andromeda tore apart.',
  pos:radec(hms(0,42,41.8), dms(40,51,55), 2.49e6), rad:4000, incl:30, g:{ ell:0.2, Rd:0.25 }, farLum:0.6, labelRange:2e6, readout:() => '2.49 million light-years' });
addGalaxy({ key:'m110', name:'M110', label:'M110', type:'dwarf elliptical · satellite of Andromeda', sortKey:2.69e6, atlas:false,
  fact:'A dwarf elliptical galaxy orbiting Andromeda, with a few young stars and patches of dust near its centre.',
  pos:radec(hms(0,40,22.1), dms(41,41,7), 2.69e6), rad:9000, incl:60, g:{ ell:0.45, Rd:0.35 }, farLum:0.5, labelRange:3e6, readout:() => '2.69 million light-years' });

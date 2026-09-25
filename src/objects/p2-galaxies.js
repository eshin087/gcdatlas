
// ================================================================ content pack: galaxy gallery (Sculptor, Cartwheel, Hoag's Object, Stephan's Quintet, NGC 1275)
const MLY = 1e6;
const sculptor = addGalaxy({ key:'sculptor', name:'Sculptor Galaxy', label:'Sculptor Galaxy', type:'dusty starburst spiral · NGC 253', sortKey:11.4*MLY,
  fact:'One of the brightest galaxies in our sky and one of the dustiest. Its core is forming stars so fast that the explosions drive a wind of gas out of the galaxy.',
  pos:radec(hms(0,47,33.1), dms(-25,17,18), 11.4*MLY), rad:45000, incl:78, pa:52, stars:9000, aka:'ngc 253 silver coin starburst sculptor',
  g:{ arms:2, pitch:16, bulge:0.35, dust:2.2, H:0.012, sf:1.6, Rd:0.28, irr:0.2, seed:31, armRef:0.35, bar:0.08, barAng:15 }, farLum:0.9, labelRange:6e8,
  readout:() => '11.4 million light-years · about 90,000 light-years across\nits starburst core makes stars dozens of times faster than the Milky Way' });

const cartwheel = addGalaxy({ key:'cartwheel', name:'Cartwheel Galaxy', label:'Cartwheel', type:'ring galaxy · ESO 350-40', sortKey:500*MLY,
  fact:'A smaller galaxy punched straight through this one a few hundred million years ago. The collision sent a ripple outward like a stone dropped in a pond, and the expanding ring is lit up with new stars.',
  pos:radec(hms(0,37,41.1), dms(-33,42,59), 500*MLY), rad:75000, incl:48, pa:30, stars:9000, aka:'eso 350-40 ring galaxy collision cartwheel',
  g:{ arms:10, pitch:84, bulge:0.35, dust:0.6, H:0.012, sf:1.2, Rd:0.45, irr:0.1, seed:47, armRef:0.3, ringR:0.8, ringW:0.045, ringGain:5.5, ringStars:0.65, gain:0.32 }, farLum:0.8, labelRange:3e9,
  readout:() => '500 million light-years · 150,000 light-years across\nthe collision happened a few hundred million years ago' });
addGalaxy({ key:'cartwheel-g1', name:'Cartwheel companion', label:'', type:'companion galaxy', sortKey:500*MLY, atlas:false, noLabel:true, noSN:true,
  pos:V.add(cartwheel.pos, M3.apply(cartwheel.R0, [150000, 30000, 60000])), rad:12000, incl:30, g:{ arms:0, irr:0.9, bulge:0.2, sf:1.4, H:0.04, seed:48 }, farLum:0.3, stars:1500 });
addGalaxy({ key:'cartwheel-g2', name:'Cartwheel companion', label:'', type:'companion galaxy', sortKey:500*MLY, atlas:false, noLabel:true, noSN:true,
  pos:V.add(cartwheel.pos, M3.apply(cartwheel.R0, [175000, -20000, -40000])), rad:9000, incl:20, g:{ ell:0.15, Rd:0.3 }, farLum:0.3, stars:1200 });

const hoag = addGalaxy({ key:'hoag', name:"Hoag's Object", label:"Hoag's Object", type:'ring galaxy · a perfect ring around a yellow core', sortKey:612*MLY,
  fact:'A nearly perfect ring of young blue stars around a ball of old yellow ones, with an empty gap between them. Nobody is sure how it formed. Through the gap you can see another, far more distant ring galaxy.',
  pos:radec(hms(15,17,14.4), dms(21,35,8), 612*MLY), rad:65000, incl:18, pa:0, stars:7000, aka:'hoag ring galaxy pgc 54559',
  g:{ ell:0.04, Rd:0.12, ringR:0.8, ringW:0.07, ringGain:2.6, ringStars:0.6, seed:53 }, farLum:0.7, farColor:[0.9, 0.9, 1], labelRange:3e9,
  readout:() => '612 million light-years · the ring is about 120,000 light-years across\nits core is only 17,000 light-years wide' });

// Stephan's Quintet: four galaxies in a real group, colliding, plus one foreground galaxy that only lines up by chance
const quintet = (() => {
  const D = 290*MLY, at = (ra, dec, d = D) => radec(ra, dec, d);
  const members = [
    addGalaxy({ key:'ngc7317', name:'NGC 7317', label:'', type:'elliptical · Stephan\'s Quintet', sortKey:D, atlas:false, noLabel:true, pos:at(hms(22,35,51.9), dms(33,56,42)), rad:22000, incl:40, g:{ ell:0.12, Rd:0.28 }, farLum:0.4, stars:1500 }),
    addGalaxy({ key:'ngc7318a', name:'NGC 7318A', label:'', type:'elliptical · Stephan\'s Quintet', sortKey:D, atlas:false, noLabel:true, pos:at(hms(22,35,56.7), dms(33,57,56)), rad:26000, incl:30, g:{ ell:0.1, Rd:0.3 }, farLum:0.45, stars:1600 }),
    addGalaxy({ key:'ngc7318b', name:'NGC 7318B', label:'', type:'spiral crashing through the group', sortKey:D, atlas:false, noLabel:true, pos:at(hms(22,35,58.4), dms(33,57,57), D - 60000), rad:38000, incl:35, pa:20, g:{ arms:2, pitch:22, bulge:0.4, dust:0.8, sf:1.4, irr:0.35, seed:61, H:0.015 }, farLum:0.5, stars:3000 }),
    addGalaxy({ key:'ngc7319', name:'NGC 7319', label:'', type:'barred spiral with a tidal tail', sortKey:D, atlas:false, noLabel:true, pos:at(hms(22,36,3.5), dms(33,58,33)), rad:36000, incl:50, pa:140, g:{ arms:2, pitch:18, bulge:0.5, dust:1, bar:0.2, sf:0.6, irr:0.2, seed:67, H:0.013 }, farLum:0.5, stars:3000 }),
  ];
  addGalaxy({ key:'ngc7320', name:'NGC 7320', label:'NGC 7320', type:'foreground spiral · not really part of the Quintet', sortKey:40*MLY, atlas:false, pos:at(hms(22,36,3.4), dms(33,56,53), 40*MLY), rad:17000, incl:62, pa:130,
    fact:'It looks like the fifth member of Stephan\'s Quintet, but it is seven times closer: a chance alignment.', g:{ arms:2, pitch:20, bulge:0.2, dust:0.6, irr:0.6, sf:1, seed:71, H:0.02 }, farLum:0.4, stars:2500, labelRange:4e7 });
  const c = V.mul(members.reduce((a, m) => V.add(a, m.pos), [0, 0, 0]), 1/members.length);
  // the shock front: NGC 7318B hitting the group's gas at 3 million km/h, glowing in a long arc between the galaxies
  const n = Math.round(1800*QUALITY), ps = makePS(n), A = V.sub(members[2].pos, c), B = V.sub(members[3].pos, c), mid = V.mul(V.add(A, B), 0.5);
  const side = V.norm(V.cross(V.sub(B, A), V.norm(c)));
  for (let i=0;i<n;i++){ const u = rnd(), p = V.add(V.add(V.lerp(A, B, 0.2 + 0.6*u), V.mul(side, 25000*Math.sin(Math.PI*u) + rndn()*4000)), V.mul(randDir(), 3000*rnd())); ps.a.set([p[0], p[1], p[2], 0.5 + rnd()], i*4); ps.c.set(rnd() < 0.7 ? [0.35, 1, 0.6, 0] : [0.5, 0.8, 1, 0], i*4); }
  ps.upload('ac');
  const o = addObj({ key:'quintet', name:"Stephan's Quintet", label:"Stephan's Quintet", type:'compact galaxy group · four colliding galaxies (and one impostor)', group:'galaxies', sortKey:D, layer:2,
    fact:'Four galaxies caught in a slow-motion pile-up 290 million light-years away. One of them is ramming through the group so fast it has lit a shock wave bigger than the Milky Way. The fifth galaxy is a foreground impostor.',
    pos:c, rad:150000, R0:facingEarth(c, [0, 0, 1], 0), minZoom:0.1, pxMin:4, noImpostor:true, labelRange:4e9, labelMin:5e4, aka:'hickson compact group 92 ngc 7317 7318 7319 7320 shock',
    particleVis:rpx => smooth(3, 10, rpx),
    views:[{ dirFn:() => V.norm(V.mul(c, -1)), k:1.6, hold:10, drift:0.02 }, { d:[0.7, 0.4, 0.6], k:1.4, hold:8, drift:0.03 }, { d:[0, 0.9, 0.4], k:2, hold:8, drift:0.02 }],
    particles:[{ ps, prog:'ptBasic', mode:3, sb:0.35, size:1.4, rad:1, rot:() => I3 }],
    readout:() => '290 million light-years · the shock front is about 100,000 light-years long\nthe lone blue galaxy NGC 7320 is only 40 million light-years away' });
  return o;
})();

// NGC 1275: the giant galaxy at the heart of the Perseus Cluster, wrapped in filaments of cooling gas and blowing bubbles with its black hole
const ngc1275 = (() => {
  const pos = radec(hms(3,19,48.1), dms(41,30,42), 237*MLY);
  const n = Math.round(4200*QUALITY), ps = makePS(n*2); let k = 0;
  const strands = 60;
  for (let s=0; s<strands && k < n; s++){
    let p = V.mul(randDir(), 0.08), dir = V.norm(V.add(V.mul(p, 1), V.mul(randDir(), 0.4)));
    const len = 0.25 + 0.6*rnd(), steps = Math.floor(n/strands), c = rnd() < 0.8 ? [1, 0.3, 0.32] : [1, 0.55, 0.4];
    for (let i=0; i<steps && k < n; i++){
      const q = V.add(p, V.mul(dir, len/steps)); dir = V.norm(V.add(dir, V.mul(randDir(), 0.25))); if (q[1] < -0.3) dir[1] = Math.abs(dir[1]);
      const b = 0.7*(1 - i/steps) + 0.3;
      ps.a.set([p[0], p[1], p[2], b], k*8); ps.a.set([q[0], q[1], q[2], b], k*8 + 4); ps.c.set([...c, 0], k*8); ps.c.set([...c, 0], k*8 + 4); p = q; k++;
    }
  }
  ps.count = k*2; ps.upload('ac');
  return addGalaxy({ key:'ngc1275', name:'NGC 1275', label:'NGC 1275', type:'giant galaxy at the heart of the Perseus Cluster · Perseus A', sortKey:237*MLY,
    fact:'A monster galaxy at the centre of the Perseus Cluster. Its black hole blows bubbles in the surrounding hot gas, and long red filaments of cooling gas, some wider than the Milky Way, hang around it like seaweed.',
    pos, rad:120000, incl:20, stars:6000, aka:'perseus a 3c 84 perseus cluster filaments', g:{ ell:0.1, Rd:0.22, seed:83 }, farLum:0.9, labelRange:3e9,
    particles:[{ ps, prog:'lnBasic', lines:true, mode:3, sb:0.5, size:1, show:() => true }],
    readout:() => '237 million light-years · filaments up to 200,000 light-years long\nthe black hole in its core sings the lowest note known: a B flat 57 octaves below middle C' });
})();

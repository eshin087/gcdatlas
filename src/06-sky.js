
// ================================================================ the real sky: 1,982 naked-eye stars at their measured distances, the nearest stars, constellation figures
// flux unit: a star of magnitude 0 seen from 1 ly has luminosity 1 (flux x distance^2)
const magFlux = m => Math.pow(10, -0.4*m);
const NEARBY = [   // nearby faint stars missing from the naked-eye catalogue: name, RA (h), Dec (deg), distance (ly), V mag, B-V, proper motion RA*, Dec (mas/yr), radial velocity (km/s)
  ['Proxima Centauri', hms(14,29,43), dms(-62,40,46), 4.2465, 11.13, 1.82, -3781.3, 769.8, -22.2], ["Barnard's Star", hms(17,57,48.5), dms(4,41,36), 5.96, 9.51, 1.73, -802.8, 10362.5, -110.5],
  ['Wolf 359', hms(10,56,29), dms(7,0,53), 7.86, 13.5, 2.0, -3842, -2725, 19.6], ['Lalande 21185', hms(11,3,20), dms(35,58,12), 8.31, 7.52, 1.44, -580, -4765, -84.7],
  ['Luyten 726-8', hms(1,39,1), dms(-17,57,1), 8.79, 12.5, 1.85, 3321, 562, 29], ['Ross 154', hms(18,49,49), dms(-23,50,10), 9.7, 10.4, 1.76, 637, -192, -10.7],
  ['Ross 248', hms(23,41,55), dms(44,10,30), 10.3, 12.3, 1.9, 115, -1592, -77.7], ['Lacaille 9352', hms(23,5,52), dms(-35,51,11), 10.7, 7.34, 1.48, 6768, 1327, 8.8],
  ['Ross 128', hms(11,47,44), dms(0,48,16), 11.0, 11.1, 1.75, 605, -1226, -31], ['EZ Aquarii', hms(22,38,33), dms(-15,18,7), 11.1, 13.3, 1.9, 2314, 2295, -60],
  ['61 Cygni', hms(21,6,54), dms(38,44,58), 11.4, 5.2, 1.18, 4164, 3250, -65.9], ['Struve 2398', hms(18,42,47), dms(59,37,49), 11.5, 8.9, 1.54, -1318, 1854, 0.6],
  ['Groombridge 34', hms(0,18,23), dms(44,1,23), 11.6, 8.1, 1.56, 2891, 411, 11.6], ['TRAPPIST-1', hms(23,6,29), dms(-5,2,29), 40.7, 18.8, 2.5, 930.9, -479.4, -56.3],
];
// space velocity (ly per million years, galactic) from RA/Dec, distance, proper motion and radial velocity
function spaceVel(raH, decD, distLy, pmra, pmdec, rv){
  const a = raH*15*DEG, d = decD*DEG, K = 4.74047e-3*distLy/3.26156;
  const rh = [Math.cos(d)*Math.cos(a), Math.cos(d)*Math.sin(a), Math.sin(d)], ah = [-Math.sin(a), Math.cos(a), 0], dh = [-Math.sin(d)*Math.cos(a), -Math.sin(d)*Math.sin(a), Math.cos(d)];
  return V.mul(eqToGal([0, 1, 2].map(k => rv*rh[k] + pmra*K*ah[k] + pmdec*K*dh[k])), 3.3356);
}
const SD = 8;   // STAR_DATA stride: x, y, z, V, B-V, vx, vy, vz (ly per million years)
let DEEP = 0;   // deep-time offset in millions of years (the time machine drifts the stars by their measured motions)
const catalogStars = (() => {
  const n = STAR_DATA.length/SD, extra = NEARBY.length + 1, filler = Math.round(9000*QUALITY);
  const ps = makePS(n + extra + filler); let k = 0;
  const put = (p, flux, col) => { ps.a.set([p[0], p[1], p[2], flux], k*4); ps.c.set([col[0], col[1], col[2], 0], k*4); k++; };
  const starPos = [], starBase = [], starVel = [];
  for (let i=0;i<n;i++){
    const j = i*SD, p = [STAR_DATA[j], STAR_DATA[j+1], STAR_DATA[j+2]], d = V.len(p), m = STAR_DATA[j+3], bv = STAR_DATA[j+4];
    put(p, magFlux(m)*d*d, blackbodyJS(bvTemp(bv))); starPos.push(p); starBase.push(p.slice()); starVel.push([STAR_DATA[j+5], STAR_DATA[j+6], STAR_DATA[j+7]]);
  }
  put([0,0,0], magFlux(4.83)*32.6*32.6, blackbodyJS(5772));   // the Sun (absolute magnitude at 10 pc); it is the origin, so it never drifts
  for (const s of NEARBY){ const p = radec(s[1], s[2], s[3]); put(p, magFlux(s[4])*s[3]*s[3], blackbodyJS(bvTemp(s[5]))); starPos.push(p); starBase.push(p.slice()); starVel.push(spaceVel(s[1], s[2], s[3], s[6], s[7], s[8])); }
  // unseen neighbours: a statistical disk of fainter stars so flights through the neighbourhood have depth
  for (let i=0;i<filler;i++){
    const r = 25 + 1400*Math.pow(rnd(), 0.6), a = rnd()*6.283, z = rndn()*(120 + r*0.12);
    const Mabs = 1 + 9*Math.pow(rnd(), 0.6), bv = clamp(0.1 + (Mabs - 1)*0.16 + rndn()*0.15, -0.2, 1.9);
    put([r*Math.cos(a), r*Math.sin(a), z], magFlux(Mabs)*32.6*32.6*0.6, blackbodyJS(bvTemp(bv)));
  }
  ps.count = k; ps.upload('ac');
  // constellation figures, joining the real 3D positions (they distort as soon as you leave the Sun)
  const nl = CON_LINES.length, lines = makePS(nl);
  for (let i=0;i<nl;i++){ const p = starPos[CON_LINES[i]]; lines.a.set([p[0], p[1], p[2], 1], i*4); lines.c.set([0.35, 0.45, 0.75, 0], i*4); }
  lines.upload('ac');
  const o = addObj({ key:'sky', name:'the naked-eye stars', label:'', type:'1,982 stars at their measured distances', layer:1, pos:[0,0,0], rad:6000, noPick:true, noLabel:true, noImpostor:true, alwaysFull:true, atlas:false,
    particleVis:() => 1,
    particles:[
      {ps, prog:'catStar', mode:3, sb:1, size:1, q0:() => [1, 0.42, GT, twinkleAmt()], rad:1, rot:() => I3},
      {ps:lines, prog:'lnBasic', lines:true, mode:3, sb:0.2, size:1, rad:1, rot:() => I3, vis:() => labelsOn ? smooth(6, 30, orbit.dist)*(1 - smooth(900, 4000, orbit.dist))*(1 - smooth(1500, 5000, V.len(o.rel))) : 0},
    ] });
  o.starPos = starPos; o.starVel = starVel;
  // move every catalogue star (and the constellation figures) to where it will be DEEP million years from now
  o.setDeep = myr => {
    for (let i=0;i<starPos.length;i++){ const b = starBase[i], v = starVel[i], p = starPos[i], j = i < n ? i : i + 1;   // the Sun sits between the catalogue and the nearby stars
      p[0] = b[0] + v[0]*myr; p[1] = b[1] + v[1]*myr; p[2] = b[2] + v[2]*myr; ps.a[j*4] = p[0]; ps.a[j*4+1] = p[1]; ps.a[j*4+2] = p[2]; }
    ps.upload('a');
    for (let i=0;i<nl;i++){ const p = starPos[CON_LINES[i]]; lines.a[i*4] = p[0]; lines.a[i*4+1] = p[1]; lines.a[i*4+2] = p[2]; }
    lines.upload('a');
  };
  // velocity of the catalogue star at (or very near) a position, so named-star objects can drift with it
  o.velocityAt = pos => {
    const d = V.len(pos), u = V.mul(pos, 1/Math.max(d, 1e-9)); let best = -1, bc = Math.cos(0.4*DEG);
    for (let i=0;i<starBase.length;i++){ const b = starBase[i], db = V.len(b); if (Math.abs(db - d) > 0.35*d + 2) continue; const c = V.dot(b, u)/db; if (c > bc){ bc = c; best = i; } }
    return best >= 0 ? starVel[best] : null;
  };
  return o;
})();
// star name labels (drawn by the HUD when the view is at "nearby stars" scale)
const STAR_LABELS = STAR_NAMES.map(([i, name]) => ({ name, p:catalogStars.starPos[i], m:STAR_DATA[i*SD + 3] }));

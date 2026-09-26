// builds src/05-data.js: bright-star catalogue (3D), constellation lines, Milky Way sky texture, Earth textures
import fs from 'fs';
import sharp from 'sharp';
import { geoEquirectangular, geoPath } from 'd3-geo';
import * as topo from 'topojson-client';

const OUT = process.env.OUT ? process.env.OUT : new URL('../src/05-data.js', import.meta.url);
const D = Math.PI/180;
const EQ2GAL = [[-0.0548755604,-0.8734370902,-0.4838350155],[0.4941094279,-0.4448296300,0.7469822445],[-0.8676661490,-0.1980763734,0.4559837762]];
const galVec = (ra, dec) => { const a = ra*D, d = dec*D, e = [Math.cos(d)*Math.cos(a), Math.cos(d)*Math.sin(a), Math.sin(d)]; return EQ2GAL.map(r => r[0]*e[0] + r[1]*e[1] + r[2]*e[2]); };

// ---------------------------------------------------------------- stars
const stars = JSON.parse(fs.readFileSync('stars.json'));
const override = { betelgeuse:548 };
const PROPER = { hr_2326:'Canopus', hr_5459:'Alpha Centauri', hr_5267:'Hadar', hr_4853:'Mimosa', hr_4730:'Acrux', hr_2618:'Adhara', hr_6527:'Shaula',
  hr_1790:'Bellatrix', hr_1791:'Elnath', hr_3685:'Miaplacidus', hr_1903:'Alnilam', hr_8425:'Alnair', hr_4905:'Alioth', hr_1017:'Mirfak', hr_4301:'Dubhe',
  hr_2693:'Wezen', hr_6879:'Kaus Australis', hr_5191:'Alkaid', hr_424:'Polaris', hr_1948:'Alnitak', hr_1852:'Mintaka', hr_7121:'Nunki', hr_6556:'Rasalhague',
  hr_168:'Schedar', hr_21:'Caph', hr_15:'Alpheratz', hr_5054:'Mizar', hr_4295:'Merak', hr_8308:'Enif', hr_2891:'Castor', hr_2004:'Saiph', hr_4534:'Denebola',
  hr_5793:'Alphecca', hr_617:'Hamal', hr_3748:'Alphard', hr_1017b:'', hr_264:'Gamma Cassiopeiae', hr_1017c:'', hr_1165:'Alcyone', hr_1084:'Epsilon Eridani', hr_509:'Tau Ceti',
  hr_8387:'Epsilon Indi', hr_8086:'61 Cygni', hr_7001:'Vega' };
const packed = [], names = [];
for (const s of stars){
  let dist = 3261.56/s.plx;
  if (override[s.id]) dist = override[s.id];
  dist = Math.min(dist, 6000);
  const g = galVec(s.ra, s.dec).map(x => x*dist);
  let bv = isFinite(s.bv) ? s.bv : 0.6;
  // space velocity relative to the Sun, from proper motion (mas/yr, RA component includes cos dec) and radial velocity (km/s)
  const a = s.ra*D, dd = s.dec*D, pc = dist/3.26156, K = 4.74047e-3*pc;              // km/s per mas/yr at this distance
  const rh = [Math.cos(dd)*Math.cos(a), Math.cos(dd)*Math.sin(a), Math.sin(dd)], ah = [-Math.sin(a), Math.cos(a), 0], dh = [-Math.sin(dd)*Math.cos(a), -Math.sin(dd)*Math.sin(a), Math.cos(dd)];
  const veq = [0, 1, 2].map(k => (s.rv || 0)*rh[k] + (s.pmra || 0)*K*ah[k] + (s.pmdec || 0)*K*dh[k]);
  const vg = EQ2GAL.map(r => (r[0]*veq[0] + r[1]*veq[1] + r[2]*veq[2])*3.3356);   // km/s -> light-years per million years
  const i = packed.length/8;
  packed.push(+g[0].toFixed(dist < 30 ? 3 : 1), +g[1].toFixed(dist < 30 ? 3 : 1), +g[2].toFixed(dist < 30 ? 3 : 1), +s.mag.toFixed(2), +bv.toFixed(2), +vg[0].toFixed(3), +vg[1].toFixed(3), +vg[2].toFixed(3));
  const nm = PROPER[s.id] || (/^[A-Z][a-z]+$/.test(s.name) ? s.name : '');
  if (nm && s.mag < 3.6) names.push([i, nm]);
  s._i = i; s._v = galVec(s.ra, s.dec);
}
// ---------------------------------------------------------------- constellation lines (vertices matched to catalogue stars)
const cl = JSON.parse(fs.readFileSync('node_modules/d3-celestial/data/constellations.lines.json'));
const eqv = (ra, dec) => { const a = ra*D, d = dec*D; return [Math.cos(d)*Math.cos(a), Math.cos(d)*Math.sin(a), Math.sin(d)]; };
const sv = stars.map(s => eqv(s.ra, s.dec));
function match(ra, dec){
  const v = eqv(ra < 0 ? ra + 360 : ra, dec); let best = -1, bd = Math.cos(0.25*D);
  for (let i=0;i<sv.length;i++){ const c = v[0]*sv[i][0] + v[1]*sv[i][1] + v[2]*sv[i][2]; if (c > bd){ bd = c; best = i; } }
  return best < 0 ? -1 : stars[best]._i;
}
const seg = new Set(); let miss = 0, tot = 0;
for (const f of cl.features) for (const line of f.geometry.coordinates){
  let prev = -1;
  for (const [ra, dec] of line){ const k = match(ra, dec); tot++; if (k < 0) miss++;
    if (k >= 0 && prev >= 0 && k !== prev){ seg.add(Math.min(k, prev) + ',' + Math.max(k, prev)); }
    prev = k; }
}
const lines = [...seg].flatMap(s => s.split(',').map(Number));
console.log('stars', packed.length/8, 'named', names.length, 'segments', seg.size, 'missed vertices', miss, '/', tot);

// ---------------------------------------------------------------- Milky Way brightness in galactic equirectangular coordinates
async function rasterMW(W, H){
  const mw = JSON.parse(fs.readFileSync('node_modules/d3-celestial/data/milkyway.json'));
  const proj = geoEquirectangular().rotate([93.59500306844711, 28.936189411615487, -58.598745584487915]).scale(W/(2*Math.PI)).translate([W/2, H/2]).precision(0.05);
  const path = geoPath(proj);
  const acc = new Float32Array(W*H);
  for (const f of mw.features){
    const d = path(f);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect width="100%" height="100%" fill="black"/><path d="${d}" fill="white" fill-rule="evenodd"/></svg>`;
    const raw = await sharp(Buffer.from(svg)).greyscale().raw().toBuffer();
    for (let i=0;i<W*H;i++) acc[i] += raw[i]/255;
  }
  // d3 equirectangular: x grows with longitude. Store u = (l + 180)/360 with l increasing to the right, v = 0 at b = +90.
  const out = Buffer.alloc(W*H);
  let mx = 0; for (const v of acc) mx = Math.max(mx, v);
  for (let i=0;i<W*H;i++) out[i] = Math.round(255*Math.pow(acc[i]/mx, 0.9));
  return sharp(out, { raw:{ width:W, height:H, channels:1 } }).blur(1.2).png({ compressionLevel:9, palette:false }).toBuffer();
}
// ---------------------------------------------------------------- Earth: R land, G ice, B city glows (B is no longer used by the page since 0.7.9:
// night lights come from NASA's Black Marble via tools/earth-lights.mjs -> src/05l-lights.js)
const CITIES = [
  [35.68,139.69,37],[28.61,77.21,32],[31.23,121.47,28],[23.81,90.41,22],[-23.55,-46.63,22],[19.43,-99.13,22],[30.04,31.24,21],[39.90,116.41,21],[19.08,72.88,21],[34.69,135.50,19],
  [29.56,106.55,16],[24.86,67.01,16],[41.01,28.98,15],[-34.60,-58.38,15],[22.57,88.36,15],[40.71,-74.01,19],[6.52,3.38,15],[14.60,120.98,14],[-4.44,15.27,14],[39.34,117.36,13],
  [23.13,113.26,14],[22.54,114.06,13],[-22.91,-43.17,13],[55.76,37.62,12],[34.05,-118.24,13],[12.97,77.59,12],[48.86,2.35,11],[13.08,80.27,11],[-6.21,106.85,11],[51.51,-0.13,9],
  [-12.05,-77.04,11],[13.76,100.50,10],[37.57,126.98,10],[35.18,136.91,9],[4.71,-74.07,11],[17.39,78.49,10],[30.59,114.31,8],[23.02,72.57,8],[3.14,101.69,8],[10.82,106.63,9],
  [41.88,-87.63,9],[35.69,51.39,9],[33.31,44.36,7],[24.71,46.68,7],[43.65,-79.38,6],[-33.87,151.21,5],[-37.81,144.96,5],[25.20,55.27,3],[1.35,103.82,6],[52.52,13.40,4],
  [40.42,-3.70,6],[41.39,2.17,5],[45.46,9.19,4],[50.11,8.68,3],[53.55,9.99,3],[52.37,4.90,3],[50.85,4.35,2],[59.33,18.07,2],[48.21,16.37,2],[52.23,21.01,3],
  [50.45,30.52,3],[59.94,30.32,5],[29.76,-95.37,7],[32.78,-96.80,7],[25.76,-80.19,6],[33.75,-84.39,6],[38.91,-77.04,6],[42.36,-71.06,5],[37.77,-122.42,5],[47.61,-122.33,4],
  [39.74,-104.99,3],[33.45,-112.07,5],[45.50,-73.57,4],[49.28,-123.12,3],[-33.45,-70.67,7],[-26.20,28.05,6],[-1.29,36.82,5],[9.03,38.74,5],[5.60,-0.19,3],[14.72,-17.47,3],
  [36.75,3.06,3],[33.57,-7.59,4],[32.09,34.78,4],[21.49,39.19,4],[25.29,51.53,2],[-8.84,13.23,8],[15.50,32.56,6],[31.55,74.34,13],[26.85,80.95,4],[21.17,72.83,7],
  [18.52,73.86,7],[26.91,75.79,4],[27.72,85.32,3],[16.87,96.20,5],[21.03,105.85,5],[25.03,121.57,7],[-7.25,112.75,3],[-6.91,107.61,3],[45.76,126.66,5],[41.80,123.43,7],
  [34.26,108.94,9],[30.66,104.07,9],[36.07,120.38,6],[32.06,118.80,9],[-31.95,115.86,2],[-27.47,153.03,2],[-36.85,174.76,2],[21.31,-157.86,1],[61.22,-149.90,0.4],[64.15,-21.94,0.3],
];
async function rasterEarth(W, H){
  const land = topo.feature(JSON.parse(fs.readFileSync('node_modules/world-atlas/land-50m.json')), JSON.parse(fs.readFileSync('node_modules/world-atlas/land-50m.json')).objects.land);
  const proj = geoEquirectangular().scale(W/(2*Math.PI)).translate([W/2, H/2]).precision(0.05);
  const d = geoPath(proj)(land);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect width="100%" height="100%" fill="black"/><path d="${d}" fill="white"/></svg>`;
  const L = await sharp(Buffer.from(svg)).greyscale().raw().toBuffer();
  const out = Buffer.alloc(W*H*3);
  const lights = new Float32Array(W*H);
  for (const [la, lo, pop] of CITIES){
    const cx = (lo + 180)/360*W, cy = (90 - la)/180*H, r = (0.9 + 1.6*Math.sqrt(pop))*W/2048, sx = 1/Math.max(Math.cos(la*D), 0.2);
    for (let y = Math.floor(cy - r*4); y <= cy + r*4; y++) for (let x = Math.floor(cx - r*4*sx); x <= cx + r*4*sx; x++){
      if (y < 0 || y >= H) continue; const xx = ((x % W) + W) % W;
      const dx = (x - cx)/sx, dy = y - cy, q = (dx*dx + dy*dy)/(r*r);
      lights[y*W + xx] += Math.min(pop, 25)/25*Math.exp(-q)*1.4 + 0.25*Math.exp(-q*0.15)*Math.min(pop, 25)/25;
    }
  }
  for (let y=0;y<H;y++) for (let x=0;x<W;x++){
    const i = y*W + x, la = 90 - (y + 0.5)/H*180, lo = (x + 0.5)/W*360 - 180, l = L[i];
    const green = l > 100 && lo < -11 && ((la > 59 && lo > -58) || (la > 75.8 && lo > -72.5 && !(la > 80.5 && lo < -62)));   // Greenland ice sheet
    const ant = la < -60;
    out[i*3] = l; out[i*3 + 1] = (green || ant) ? l : 0; out[i*3 + 2] = Math.min(255, Math.round(255*Math.min(lights[i], 1)*(l > 60 ? 1 : 0.15)));
  }
  return sharp(out, { raw:{ width:W, height:H, channels:3 } }).png({ compressionLevel:9 }).toBuffer();
}
const mwPng = await rasterMW(1024, 512);
const earthPng = await rasterEarth(1024, 512);
// previews for checking: fs.writeFileSync('mw.png', mwPng); fs.writeFileSync('earth.png', earthPng);
console.log('mw', mwPng.length, 'earth', earthPng.length);
const js = `
// ================================================================ data: Hipparcos/Gaia bright stars (V <= 5) in galactic light-years, constellation figures, Milky Way sky map, Earth
// STAR_DATA (8 per star): x, y, z (ly, heliocentric galactic), V magnitude, B-V colour index, vx, vy, vz (ly per million years, relative to the Sun, from proper motion)
const STAR_DATA = ${JSON.stringify(packed)};
const STAR_NAMES = ${JSON.stringify(names)};
const CON_LINES = ${JSON.stringify(lines)};
const MW_PNG = 'data:image/png;base64,${mwPng.toString('base64')}';
const EARTH_PNG = 'data:image/png;base64,${earthPng.toString('base64')}';
`;
fs.writeFileSync(OUT, js);
console.log('wrote', js.length, 'bytes');

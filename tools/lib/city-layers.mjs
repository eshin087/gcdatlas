// One ground layer of a city, in the launch sites' format (tools/earth-detail.mjs): a square WebP, RGB the ground seen from above, alpha 1 water, else
// 2 + (height above sea level - base)/step, terrain plus buildings. Differences from the launch sites: the water comes from OpenStreetMap (the coastline, so
// reclaimed land such as Dubai's islands is land, and river and lake polygons, so the Seine and the Thames are water) besides the terrain model; the buildings
// are OpenStreetMap's (New York: the city's own footprints inside the five boroughs); `step` is a decimal, to use the 8 bits well (Dubai's finest layer spans 0 to 830 m).
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { OUT, CACHE, cached, get, UA, readGz, writeGz, frameAt, planeToLL, llToPlane, bboxLL, gridTiles, haversine, clampN, fillRings, assembleRings, photoSource, s2Source, terrainSource, writeHashed, PHOTO } from './city-common.mjs';
import { buildingsTile, waterTile, airportInfo, airportDetail } from './city-osm.mjs';
import { roadWaysIn } from './city-build.mjs';
import { styleRoofs } from './city-style.mjs';
import { fixHeights } from './city-terrain-fix.mjs';

export const CREDIT = {
  osm:'© OpenStreetMap contributors (ODbL)',
  s2:'Contains modified Copernicus Sentinel data',
  fpac:'USDA NAIP aerial photos',
  gsi:'GSI Japan (国土地理院) seamless aerial photographs, edited',
  ign:'IGN BD ORTHO (Licence Ouverte 2.0)',
  nsw:'NSW Imagery, © State of New South Wales and Spatial Services (CC BY)',
  nyc:'NYC Open Data, Building Footprints (NYC Office of Technology and Innovation)',
  bdtopo:'IGN BD TOPO (Licence Ouverte 2.0)',
  terrain:'Terrain: Mapzen Terrain Tiles on AWS (SRTM, USGS 3DEP and other sources)',
};

// ---------------------------------------------------------------- New York's own building footprints (Socrata, NYC Open Data): heights above the ground in feet
const SOC = 'https://data.cityofnewyork.us/resource/5zhs-2jue.json';
async function socrata(url){ return JSON.parse(await cached('soc_' + url.replace(/^https?:\/\//, '').replace(/[^a-z0-9]/gi, '_').slice(-180) + '_' + url.length + '.json', async () => { const b = await get(url, { timeout:300000 }); if (b[0] !== 91) throw new Error('Socrata answered: ' + b.toString('utf8', 0, 200)); return b; })); }
export async function nycTile(tile){
  const key = `nycf_${tile.key}_${tile.bb.join('_')}.json.gz`, hit = readGz(key);
  if (hit) return hit;
  const pad = 0.0006, [s, w, n, e] = tile.bb, out = [];
  for (let off=0; ; off+=40000){
    const q = `${SOC}?$select=the_geom,height_roof,bin&$where=${encodeURIComponent(`within_box(the_geom,${n + pad},${w - pad},${s - pad},${e + pad})`)}&$order=bin&$limit=40000&$offset=${off}`;
    const rows = await socrata(q);
    for (const r of rows){
      const g = r.the_geom; if (!g || !g.coordinates) continue;
      const polys = g.type === 'MultiPolygon' ? g.coordinates : [g.coordinates], hr = parseFloat(r.height_roof);
      const h = hr > 0 ? Math.max(hr*0.3048, 3) : 6;
      polys.forEach((rings, pi) => out.push({ i:'n' + r.bin + '_' + pi, h:Math.round(h*10)/10, k:'nyc', r:rings.map(ring => ring.flatMap(([lo, la]) => [la, lo])) }));
    }
    if (rows.length < 40000) break;
  }
  writeGz(key, out); return out;
}
// ---------------------------------------------------------------- Paris: IGN's BD TOPO buildings (Licence Ouverte 2.0), with their heights in metres (from the Lidar-based BD TOPO, `hauteur`)
export async function bdtopoTile(tile){
  const key = `bdtf_${tile.key}_${tile.bb.join('_')}.json.gz`, hit = readGz(key);
  if (hit) return hit;
  const pad = 0.0004, [s, w, n, e] = tile.bb, out = [];
  for (let off=0; ; off+=4000){
    const url = `https://data.geopf.fr/wfs/ows?SERVICE=WFS&VERSION=2.0.0&REQUEST=GetFeature&TYPENAMES=BDTOPO_V3:batiment&OUTPUTFORMAT=application/json&SRSNAME=EPSG:4326&COUNT=4000&STARTINDEX=${off}&SORTBY=cleabs&PROPERTYNAME=geometrie,hauteur,nombre_d_etages,etat_de_l_objet,construction_legere&BBOX=${w - pad},${s - pad},${e + pad},${n + pad},EPSG:4326`;
    const j = JSON.parse(await cached(`bdt_${tile.key}_${off}_${tile.bb.join('_')}.json`, async () => { const b = await get(url, { timeout:300000 }); if (b[0] !== 123) throw new Error('WFS answered: ' + b.toString('utf8', 0, 200)); return b; }));
    for (const f of j.features || []){
      const p = f.properties || {}, g = f.geometry; if (!g || (p.etat_de_l_objet && p.etat_de_l_objet !== 'En service')) continue;
      let h = +p.hauteur; if (!(h > 0)) h = +p.nombre_d_etages > 0 ? p.nombre_d_etages*3.1 + 1.5 : 8;
      if (h > 400) continue;
      const polys = g.type === 'MultiPolygon' ? g.coordinates : [g.coordinates];
      polys.forEach((rings, pi) => out.push({ i:'p' + f.id + '_' + pi, h:Math.round(h*10)/10, k:'bdtopo', r:rings.map(ring => ring.flatMap(([lo, la]) => [la, lo])) }));
    }
    if ((j.features || []).length < 4000) break;
  }
  writeGz(key, out); return out;
}
export async function nycBoroughs(){
  const key = 'nyc_boroughs.json.gz', hit = readGz(key);
  if (hit) return hit;
  const j = JSON.parse(await cached('nyc_boroughs_raw.json', () => get('https://data.cityofnewyork.us/resource/gthc-hcne.json?$limit=10', { timeout:300000 })));
  const out = [];
  for (const r of j){ const g = r.the_geom; if (!g) continue; for (const poly of (g.type === 'MultiPolygon' ? g.coordinates : [g.coordinates])) out.push(poly.map(ring => ring.flatMap(([lo, la]) => [la, lo]))); }
  writeGz(key, out); return out;
}

// ---------------------------------------------------------------- rasterising
function ringsToPixels(flat, F, half, m){
  const pts = []; for (let k=0;k<flat.length;k+=2){ const [x, y] = llToPlane(F, flat[k], flat[k + 1]); pts.push([(x + half)/m, (half - y)/m]); } return pts;
}
// features [{ i, h, r:[flat rings] }] into a height grid (max where they overlap). Returns the count drawn. With out ({ id: Int32Array, feats:[] }),
// also which building each pixel shows (1 + its index in out.feats, { h, k }), for the architectural-model style (city-style.mjs, 0.17.0)
function rasterFeatures(feats, seen, F, N, half, m, h, accept, out){
  let n = 0;
  for (const f of feats){
    if (seen.has(f.i)) continue; seen.add(f.i);
    const rings = f.r.map(fl => ringsToPixels(fl, F, half, m));
    if (accept && !accept(rings[0][0])) continue;
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const r of rings) for (const p of r){ if (p[0] < x0) x0 = p[0]; if (p[0] > x1) x1 = p[0]; if (p[1] < y0) y0 = p[1]; if (p[1] > y1) y1 = p[1]; }
    if (x1 < 0 || y1 < 0 || x0 >= N || y0 >= N) continue;
    const id = out ? out.feats.push({ h:f.h, k:f.k }) : 0;
    const any = fillRings(rings, N, (y, a, c) => { const o = y*N; for (let x=a;x<=c;x++) if (h[o + x] < f.h){ h[o + x] = f.h; if (out) out.id[o + x] = id; } });
    if (!any){ const cx = Math.floor((x0 + x1)/2), cy = Math.floor((y0 + y1)/2); if (cx >= 0 && cy >= 0 && cx < N && cy < N && h[cy*N + cx] < f.h){ h[cy*N + cx] = f.h; if (out) out.id[cy*N + cx] = id; } }   // (smaller than a pixel: one pixel)
    n++;
  }
  return n;
}
// (lattice and other slender towers, which a height map turns into solid blocks, are left out where the city's config says: the page draws them from the towers' list;
// an entry with an id leaves out that OpenStreetMap feature only, 'w' and its way's number, 0.20.0: by distance the Luxor's pyramid took its hotel towers with it)
const withoutThin = (city, feats) => city.thin ? feats.filter(f => !city.thin.some(t => t.id ? f.i === t.id : haversine(f.r[0][0], f.r[0][1], t.la, t.lo) < t.r)) : feats;
// (ids: also which building each pixel shows, { id, feats }, for the architectural-model style)
export async function rasterBuildings(city, L, F, ids){
  const N = L.px, half = L.size/2, m = L.size/N, h = new Float32Array(N*N), tiles = gridTiles(bboxLL(L, 150), city.bldKm || 3.2, city.la), seen = new Set();
  const out = ids ? { id:new Int32Array(N*N), feats:[] } : null;
  let n = 0;
  if (city.nyc){
    // inside the five boroughs: the city's own footprints; outside (New Jersey): OpenStreetMap
    const hn = new Float32Array(N*N), ho = new Float32Array(N*N), cover = new Uint8Array(N*N), seenN = new Set(), outN = ids ? { id:new Int32Array(N*N), feats:out.feats } : null, outO = ids ? { id:new Int32Array(N*N), feats:out.feats } : null;
    for (const poly of await nycBoroughs()){ const rings = poly.map(fl => ringsToPixels(fl, F, half, m)); fillRings(rings, N, (y, a, c) => cover.fill(1, y*N + a, y*N + c + 1)); }
    for (const t of tiles){ n += rasterFeatures(withoutThin(city, await nycTile(t)), seenN, F, N, half, m, hn, null, outN); process.stdout.write('c'); }
    // (a tile OpenStreetMap cannot answer is left out: it matters only west of the Hudson, where the city's own footprints end; only what stands outside the five boroughs is read)
    const outside = p => { const x = Math.floor(p[0]), y = Math.floor(p[1]); return x < 0 || y < 0 || x >= N || y >= N || !cover[y*N + x]; };
    for (const t of tiles){ try { n += rasterFeatures(withoutThin(city, await buildingsTile(t)), seen, F, N, half, m, ho, outside, outO); process.stdout.write('o'); } catch (e) { console.log(`\n  no OpenStreetMap buildings for tile ${t.key}: ${e.message.slice(0, 80)}`); } }
    for (let i=0;i<N*N;i++){ h[i] = cover[i] ? hn[i] : ho[i]; if (out) out.id[i] = cover[i] ? outN.id[i] : outO.id[i]; }
  } else if (city.bdtopo){
    // Paris: IGN's own buildings and heights
    for (const t of tiles){ n += rasterFeatures(withoutThin(city, await bdtopoTile(t)), seen, F, N, half, m, h, null, out); process.stdout.write('p'); }
  } else for (const t of tiles){ n += rasterFeatures(withoutThin(city, await buildingsTile(t)), seen, F, N, half, m, h, null, out); process.stdout.write('b'); }
  return out ? { h, n, id:out.id, feats:out.feats } : { h, n };
}
// water: OpenStreetMap river and lake polygons (water), and the coast (sea: 1 sea, 0 land, -1 a row the coast does not cross)
export async function rasterWater(city, L, F){
  const N = L.px, half = L.size/2, m = L.size/N, water = new Uint8Array(N*N), sea = new Int8Array(N*N).fill(-1), tiles = gridTiles(bboxLL(L, 400), 12.8, city.la), seenP = new Set(), seenC = new Set();
  const cross = Array.from({ length:N }, () => []);
  let nc = 0;
  for (const t of tiles){
    const w = await waterTile(t);
    for (const f of w.poly){
      if (seenP.has(f.i)) continue; seenP.add(f.i);
      const llr = f.r ? f.r : [...assembleRings(f.outerWays || []), ...assembleRings(f.innerWays || [])];
      if (!llr.length) continue;
      const rings = llr.map(r => ringsToPixels(r.flat(), F, half, m));
      fillRings(rings, N, (y, a, c) => water.fill(1, y*N + a, y*N + c + 1));
    }
    for (const c of w.coast){
      if (seenC.has(c.i)) continue; seenC.add(c.i); nc++;
      const p = ringsToPixels(c.p.flat(), F, half, m);
      for (let k=0;k + 1<p.length;k++){
        const [ax, ay] = p[k], [bx, by] = p[k + 1];
        const ya = Math.max(0, Math.ceil(Math.min(ay, by) - 0.5)), yb = Math.min(N - 1, Math.floor(Math.max(ay, by) - 0.5));
        for (let y=ya;y<=yb;y++){ const yc = y + 0.5; if ((ay > yc) === (by > yc)) continue; cross[y].push([ax + (yc - ay)/(by - ay)*(bx - ax), by < ay ? 1 : 0]); }   // (1: the segment runs north, the sea is on its east)
      }
    }
    process.stdout.write('w');
  }
  for (let y=0;y<N;y++){
    const c = cross[y]; if (!c.length) continue;
    c.sort((a, b) => a[0] - b[0]);
    let x = 0;
    const fill = (xa, xb, v) => { const a = Math.max(0, Math.ceil(xa - 0.5)), b = Math.min(N - 1, Math.floor(xb - 0.5)); if (b >= a) sea.fill(v, y*N + a, y*N + b + 1); };
    fill(-1e9, c[0][0], c[0][1] ? 0 : 1);   // (west of the first crossing: land if it runs north, else sea)
    for (let k=0;k<c.length;k++) fill(c[k][0], k + 1 < c.length ? c[k + 1][0] : 1e9, c[k][1] ? 1 : 0);
    void x;
  }
  return { water, sea, coasts:nc };
}

// ---------------------------------------------------------------- where there is no open aerial photo (London, Dubai): the Sentinel-2 colours (10 m) are painted over with what OpenStreetMap has
// at a finer scale: roads (motorway to tertiary) in asphalt grey, building footprints as roofs (by height, with a dark edge), and at an airport its runways, taxiways and aprons.
// The painting is illustrative: the shapes are real, the colours are not measured.
function stamp(rgb, N, x, y, r, col, a){
  const x0 = Math.max(0, Math.floor(x - r)), x1 = Math.min(N - 1, Math.ceil(x + r)), y0 = Math.max(0, Math.floor(y - r)), y1 = Math.min(N - 1, Math.ceil(y + r));
  for (let yy=y0;yy<=y1;yy++) for (let xx=x0;xx<=x1;xx++){ const dx = xx + 0.5 - x, dy = yy + 0.5 - y; if (dx*dx + dy*dy > r*r) continue; const o = (yy*N + xx)*3; for (let c=0;c<3;c++) rgb[o + c] = rgb[o + c]*(1 - a) + col[c]*a; }
}
function strokeLine(rgb, N, pts, r, col, a){
  for (let k=0;k + 1<pts.length;k++){ const [ax, ay] = pts[k], [bx, by] = pts[k + 1], n = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay)*2)); for (let i=0;i<=n;i++) stamp(rgb, N, ax + (bx - ax)*i/n, ay + (by - ay)*i/n, r, col, a); }
}
async function paintOsm(city, L, F, rgb, isWater, bh){
  const N = L.px, half = L.size/2, m = L.size/N, toPx = ll => ringsToPixels(ll.flat(), F, half, m);
  const before = Buffer.from(rgb);
  // airport: aprons, taxiways, runways
  if (L.airport){
    const info = readGz(`air_${L.airport}.json.gz`), det = info && await airportDetail(L.airport, info, L.airport === 'CDG' ? 6500 : 4500);
    if (det){
      for (const a of det.apron) if (a.p.length > 3){ fillRings([toPx(a.p)], N, (y, xa, xb) => { for (let x=xa;x<=xb;x++){ const o = (y*N + x)*3; rgb[o] = rgb[o]*0.3 + 140*0.7; rgb[o + 1] = rgb[o + 1]*0.3 + 140*0.7; rgb[o + 2] = rgb[o + 2]*0.3 + 144*0.7; } }); }
      for (const t of det.taxi) strokeLine(rgb, N, toPx(t.p), Math.max(0.8, (t.lane ? 5 : 8)/m), [112, 112, 116], 0.9);
      for (const r of det.runways) strokeLine(rgb, N, toPx(r.p), Math.max(1, (r.width || 45)/2/m), [64, 64, 68], 1);
      for (const r of det.runways) strokeLine(rgb, N, toPx(r.p), Math.max(0.5, 0.5/m), [200, 200, 196], 0.55);
    }
  }
  // roads
  const ways = await roadWaysIn(city, L, 100);
  for (const w of ways){
    if (w.tunnel) continue;
    const lanes = w.lanes || (w.oneway ? 1 : 2), wd = (w.oneway ? lanes : lanes)*3.3 + (w.cls <= 1 ? 6 : 3.5), col = w.cls <= 1 ? [78, 78, 84] : [96, 96, 100];
    strokeLine(rgb, N, toPx(w.p), Math.max(0.7, wd/2/m), col, 0.85);
  }
  // buildings: roofs by height, dark at the foot of a wall
  if (bh){
    for (let y=0;y<N;y++) for (let x=0;x<N;x++){
      const i = y*N + x, h = bh[i]; if (h <= 0.5) continue;
      const edge = (x > 0 && bh[i - 1] <= 0.5) || (x < N - 1 && bh[i + 1] <= 0.5) || (y > 0 && bh[i - N] <= 0.5) || (y < N - 1 && bh[i + N] <= 0.5);
      const hash = ((x >> 1)*73856093 ^ (y >> 1)*19349663) >>> 0, v = 0.9 + (hash % 100)/500;
      const roof = h < 12 ? [158, 148, 138] : h < 45 ? [170, 168, 164] : [158, 170, 186], k = edge ? 0.62 : v;
      for (let c=0;c<3;c++) rgb[i*3 + c] = clampN(rgb[i*3 + c]*0.3 + roof[c]*0.7*k, 0, 255);
    }
  }
  // (water stays as the satellite has it)
  for (let i=0;i<N*N;i++) if (isWater[i]){ rgb[i*3] = before[i*3]; rgb[i*3 + 1] = before[i*3 + 1]; rgb[i*3 + 2] = before[i*3 + 2]; }
}

// ---------------------------------------------------------------- colours: the aerial photos set the look; the satellite images are brightened to match (as tools/earth-detail.mjs)
export async function cityGain(city, ctx){
  if (city.photo === 's2') return null;
  const L = city.layers.find(l => l.id === 'r12'), F = frameAt(L.la, L.lo), N = L.px, m = L.size/N;
  const s2 = await ctx.s2For(L), photo = await ctx.photoFor(L, city.photo), terr = await terrainSource(L);
  const A = [0, 0, 0], B = [0, 0, 0]; let n = 0;
  for (let y=0;y<N;y+=8) for (let x=0;x<N;x+=8){ const [la, lo] = planeToLL(F, (x + 0.5)*m - L.size/2, L.size/2 - (y + 0.5)*m), a = photo(la, lo), b = s2(la, lo);
    if (a && b && terr(la, lo) > 0.3){ for (let k=0;k<3;k++){ A[k] += a[k]; B[k] += b[k]; } n++; } }
  if (n < 200) return null;
  const g = [0, 1, 2].map(k => clampN(A[k]/Math.max(B[k], 1), 0.6, 1.9));
  console.log(`${city.key}: satellite images x ${g.map(v => v.toFixed(2)).join(', ')} to match the aerial photos`);
  const knee = c => c < 200 ? c : 200 + 55*(1 - Math.exp(-(c - 200)/55));
  return v => v.map((c, k) => k < 3 ? knee(c*g[k]) : c);
}

// ---------------------------------------------------------------- one layer
export async function buildLayer(city, L, ctx){
  const cityF = frameAt(city.la, city.lo), F = frameAt(L.la, L.lo), N = L.px, m = L.size/N;
  process.stdout.write(`${city.key}-${L.id} (${(L.size/1000).toFixed(1)} km, ${m.toFixed(2)} m/px, ${L.photo}): `);
  const useAerial = L.photo !== 's2';
  const s2 = await ctx.s2For(L), photo = useAerial ? await ctx.photoFor(L, L.photo) : null, terr = await terrainSource(L);
  const bld = L.bld ? await rasterBuildings(city, L, F, L.size <= 13000) : null;
  const wat = await rasterWater(city, L, F);
  const gain = ctx.gain[city.key];
  const rgb = new Uint8Array(N*N*3), elev = new Float32Array(N*N), isWater = new Uint8Array(N*N), tArr = new Float32Array(N*N), wet = new Uint8Array(N*N);
  let photoN = 0, s2N = 0, wN = 0, recN = 0;
  for (let y=0;y<N;y++) for (let x=0;x<N;x++){
    const px = (x + 0.5)*m - L.size/2, py = L.size/2 - (y + 0.5)*m, [la, lo] = planeToLL(F, px, py), i = y*N + x;
    const t = terr(la, lo), sv = wat.sea[i]; tArr[i] = t;
    // wet: 2 the sea (the coast says so, or where it does not cross the row, the terrain model at or under the sea level), 1 a river or lake of OpenStreetMap
    wet[i] = sv === 1 || (sv === -1 && t <= 0.2) ? 2 : wat.water[i] === 1 ? 1 : 0;
    let v = photo ? photo(la, lo) : null;
    // (a site that changed after the aerial photos were taken, city.recent { la, lo, r m }: Sentinel-2's newer colours there, blended in over its last 25 m, 0.20.0)
    if (v && city.recent){ let k = 0; for (const q of city.recent) k = Math.max(k, clampN((q.r - haversine(la, lo, q.la, q.lo))/25, 0, 1));
      if (k > 0){ const w = s2(la, lo); if (w){ const g = gain ? gain(w) : w; v = v.map((c, j) => c*(1 - k) + g[j]*k); recN++; } } }
    if (v) photoN++; else { v = s2(la, lo); if (v){ s2N++; if (gain) v = gain(v); } }
    if (!v) v = wet[i] ? [14, 36, 58] : [96, 92, 78];
    rgb[i*3] = clampN(Math.round(v[0]), 0, 255); rgb[i*3 + 1] = clampN(Math.round(v[1]), 0, 255); rgb[i*3 + 2] = clampN(Math.round(v[2]), 0, 255);
  }
  // water is alpha 1, which the page draws at the sea level: so only water at the sea level can be alpha 1. A river that runs high above it (the Seine at 26 m) would be a deep canyon:
  // there the water stays land, at its own level (the lowest the terrain model has in 5 x 5 pixels of the water, so the quays do not count), with the photo's water colours
  for (let y=0;y<N;y++) for (let x=0;x<N;x++){
    const i = y*N + x, b = bld ? bld.h[i] : 0, t = Math.max(tArr[i], 0);
    let w = wet[i] > 0, ground = t;
    if (wet[i] === 1){
      let tw = tArr[i]; for (let dy=-2;dy<=2;dy++) for (let dx=-2;dx<=2;dx++){ const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= N || yy >= N) continue; const j = yy*N + xx; if (wet[j] && tArr[j] < tw) tw = tArr[j]; }
      if (tw > 5){ w = false; ground = Math.max(tw, 0); }
    }
    if (b > 0.5){ w = false; ground = t; }
    isWater[i] = w ? 1 : 0; if (w) wN++;
    elev[i] = ground + b;
  }
  let painted = false;
  if (!useAerial && L.id !== 'r51'){ await paintOsm(city, L, F, rgb, isWater, bld ? bld.h : null); painted = true; }
  let lo = Infinity, hi = -Infinity; for (let i=0;i<N*N;i++) if (!isWater[i]){ lo = Math.min(lo, elev[i]); hi = Math.max(hi, elev[i]); }
  if (!isFinite(lo)){ lo = 0; hi = 1; }
  const base = Math.floor(lo), step = Math.max(0.1, Math.ceil((hi - base)/253*10)/10);
  const rgba = Buffer.alloc(N*N*4);
  for (let i=0;i<N*N;i++){ rgba[i*4] = rgb[i*3]; rgba[i*4 + 1] = rgb[i*3 + 1]; rgba[i*4 + 2] = rgb[i*3 + 2]; rgba[i*4 + 3] = isWater[i] ? 1 : Math.min(255, 2 + Math.round((elev[i] - base)/step)); }
  // (the heights' fixes, 0.19.0: spikes out, summits the terrain tiles rounded down put back; city-terrain-fix.mjs)
  const fx = { px:N, size:L.size, la:L.la, lo:L.lo, base, step, top:Math.ceil(hi) };
  fixHeights(city, fx, rgba);
  // (the architectural-model style, 0.17.0, city-style.mjs: the unstyled layer is kept in the cache first, where tools/city-style.mjs restyles from)
  let styled = false;
  if (bld && bld.id){
    const uns = path.join(CACHE, 'unstyled'); fs.mkdirSync(uns, { recursive:true });
    fs.writeFileSync(path.join(uns, `${city.key}-${L.id}.webp`), await sharp(rgba, { raw:{ width:N, height:N, channels:4 } }).webp({ quality:ctx.quality || 70, alphaQuality:100, effort:6, smartSubsample:true }).toBuffer());
    styleRoofs(city.key, N, rgba, bld, m); styled = true;
  }
  const webp = await sharp(rgba, { raw:{ width:N, height:N, channels:4 } }).webp({ quality:styled ? 80 : ctx.quality || 70, alphaQuality:100, effort:6, smartSubsample:true }).toBuffer();
  const file = writeHashed(OUT, `${city.key}-${L.id}`, 'webp', webp);
  const [dx, dy] = llToPlane(cityF, L.la, L.lo);
  console.log(` ${(webp.length/1024).toFixed(0)} KB, ${Math.round(100*photoN/(N*N))}% aerial, ${Math.round(100*s2N/(N*N))}% Sentinel-2${recN ? ` (${Math.round(100*recN/(N*N))}% newer satellite colours where the place changed)` : ""}, ${Math.round(100*wN/(N*N))}% water${bld ? `, ${bld.n} buildings` : ''}, ground ${base} to ${hi.toFixed(0)} m in ${step} m steps`);
  const meta = { id:L.id, name:L.name, file, la:L.la, lo:L.lo, size:L.size, px:N, dx:Math.round(dx), dy:Math.round(dy), base:fx.base, step:fx.step, top:fx.top, src:[photoN ? (Array.isArray(L.photo) ? L.photo[L.photo.length - 1] : L.photo) : null, s2N ? 's2' : null].filter(Boolean), s2dates:s2N ? s2.dates : [], bld:bld ? bld.n : 0, bytes:webp.length };
  if (painted) meta.painted = true;
  if (styled) meta.styled = 'model';
  if (L.airport) meta.airport = L.airport;
  return meta;
}
export function makeCtx(){
  let s2c = {}, pc = {};
  return {
    gain:{}, quality:70,
    free(){ s2c = {}; pc = {}; },   // (the images of one layer are big: let go of them before the next)
    s2For: async L => { const k = `${L.la},${L.lo},${L.size}`; return s2c[k] || (s2c[k] = await s2Source(L)); },
    photoFor: async (L, key) => { const k = `${key},${L.la},${L.lo},${L.size},${L.px}`; return pc[k] || (pc[k] = await photoSource(L, key)); },
  };
}
void fs; void path; void CACHE; void UA; void PHOTO; void writeGz;

// The Moon's data sources for tools/moon-detail.mjs: NASA's LRO maps and heights, read straight from the archives in small byte ranges (a
// window of rows at a time), so a place takes tens of MB from files of many GB. Every window read is kept in the cache (MOON_CACHE, else
// tools/cache/moon), so a rerun downloads nothing.
//   - LROC WAC Hapke-normalized mosaic, 3 bands (689, 415, 321 nm), 400 m a pixel, 70 S to 70 N (Sato et al. 2017): the colour and albedo,
//     photometrically normalized (no shadows of their own, so the page can light them with the real Sun).
//   - LOLA albedo at 1064 nm, 10 pixels a degree: the albedo beyond 70 degrees of latitude.
//   - LOLA LDEM_16 (16 px/deg) and the 118 m global DEM; SLDEM2015 (LOLA and SELENE/Kaguya, 512 px/deg, 59 m, 60 S to 60 N; Barker et al. 2016):
//     the heights.
//   - LROC NAC controlled mosaics (NAC_ROI, high Sun) and NAC DTMs (2 m) with their orthophotos round the Apollo sites and on some craters.
// Heights are metres above the 1,737.4 km reference sphere; latitudes planetocentric, longitudes east.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { fromUrl } from 'geotiff';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const CACHE = process.env.MOON_CACHE ? path.resolve(process.env.MOON_CACHE) : path.join(ROOT, 'tools', 'cache', 'moon');
fs.mkdirSync(CACHE, { recursive:true });
export const RM = 1737400, D2R = Math.PI/180, clampN = (x, a, b) => Math.min(b, Math.max(a, x));
const UA = { 'User-Agent':'gcdatlas-moon-detail (https://gcdatlas.com; github eshin087/gcdatlas)' };
const sleep = ms => new Promise(r => setTimeout(r, ms));

// ---------------------------------------------------------------- fetching: byte ranges, retried, paced per host
// (NASA's imaging archive, pds.mcp.nasa.gov, answers 429 to a burst of small requests: there the reads are few, large and spaced out, and a
// 429 waits as long as the server asks, or a minute)
const HOSTS = new Map();
const hostOf = url => new URL(url).host;
const PACE = { 'pds.mcp.nasa.gov':{ conc:1, gap:3000 } };
async function slot(url){
  const h = hostOf(url), p = PACE[h] || { conc:16, gap:0 };
  let s = HOSTS.get(h); if (!s){ s = { busy:0, last:0, q:[] }; HOSTS.set(h, s); }
  while (s.busy >= p.conc || Date.now() - s.last < p.gap){ await sleep(Math.max(20, p.gap - (Date.now() - s.last))); }
  s.busy++; s.last = Date.now();
  return () => { s.busy--; };
}
async function fetchPaced(url, headers, k){
  const done = await slot(url);
  try {
    const r = await fetch(url, { headers:{ ...UA, ...headers }, signal:AbortSignal.timeout(600000) });
    if (r.status === 429 || r.status === 503){ const ra = +r.headers.get('retry-after'); await r.arrayBuffer().catch(() => {}); return { wait:(ra > 0 ? ra*1000 : 60000)*(1 + k*0.5), status:r.status }; }
    return { r, buf:Buffer.from(await r.arrayBuffer()) };
  } finally { done(); }
}
export async function getRange(url, a, b){
  for (let k=0;k<10;k++){
    try {
      const x = await fetchPaced(url, { Range:`bytes=${a}-${b - 1}` }, k);
      if (x.wait){ console.log(`    ${hostOf(url)} asks to wait (${x.status}): ${Math.round(x.wait/1000)} s`); await sleep(x.wait); continue; }
      if (x.r.status !== 206 && x.r.status !== 200) throw new Error(url + ' -> ' + x.r.status);
      if (x.r.status === 200 && x.buf.length !== b - a) throw new Error(url + ': the server sent the whole file');
      return x.buf;
    } catch (e) { if (k === 9) throw e; await sleep(2000*(k + 1)); }
  }
  throw new Error(url + ': gave up');
}
export async function getText(url){
  const f = path.join(CACHE, 'lbl-' + crypto.createHash('sha1').update(url).digest('hex').slice(0, 16) + '.txt');
  if (fs.existsSync(f)) return fs.readFileSync(f, 'utf8');
  for (let k=0;k<10;k++){
    try { const x = await fetchPaced(url, {}, k);
      if (x.wait){ await sleep(x.wait); continue; }
      if (!x.r.ok) throw new Error(url + ' -> ' + x.r.status);
      const t = x.buf.toString('utf8'); fs.writeFileSync(f, t); return t;
    } catch (e) { if (k === 9) throw e; await sleep(2000*(k + 1)); } }
}
export async function pool(items, n, fn){ const out = new Array(items.length); let i = 0; await Promise.all(Array.from({ length:Math.min(n, items.length) }, async () => { while (i < items.length){ const k = i++; out[k] = await fn(items[k], k); } })); return out; }

// ---------------------------------------------------------------- a raster in an archive: rows of W samples (spp a pixel, little or big endian),
// row r starting at rowOff(r); an equirectangular grid whose pixel (c, r) covers lon west + c/ppdX .. and lat north - r/ppdY ..
// kind: 'f32le' | 'f32be' | 'i16le' | 'u8'; scale, add: value = raw*scale + add; bad(raw): no data
export function grid(o){ return Object.assign({ spp:1, scale:1, add:0, bad:() => false, conc:12 }, o); }
const BPS = { f32le:4, f32be:4, i16le:2, u16le:2, i16be:2, u16be:2, u8:1 };
const RD = { f32le:(dv, i) => dv.getFloat32(i*4, true), f32be:(dv, i) => dv.getFloat32(i*4, false), i16le:(dv, i) => dv.getInt16(i*2, true), u16le:(dv, i) => dv.getUint16(i*2, true),
  i16be:(dv, i) => dv.getInt16(i*2, false), u16be:(dv, i) => dv.getUint16(i*2, false), u8:(dv, i) => dv.getUint8(i) };
function decodeRow(g, buf, n){
  const out = new Float32Array(n*g.spp), dv = new DataView(buf.buffer, buf.byteOffset, buf.length), rd = RD[g.kind];
  for (let i=0;i<n*g.spp;i++){ const v = rd(dv, i); out[i] = g.bad(v) ? NaN : v*g.scale + g.add; }
  return out;
}
// rows r0..r1-1 and columns c0..c1-1 (clipped to the grid), averaged over step x step blocks (NaN where a block has no data): { d, w, h, spp,
// r0, c0, step } in the grid's pixels. Kept in the cache by url, window and step
export async function readWindow(g, r0, r1, c0, c1, step = 1){
  r0 = Math.max(0, r0); c0 = Math.max(0, c0); r1 = Math.min(g.H, r1); c1 = Math.min(g.W, c1);
  const w = Math.max(0, Math.floor((c1 - c0)/step)), h = Math.max(0, Math.floor((r1 - r0)/step)), spp = g.spp;
  const key = crypto.createHash('sha1').update([g.url, r0, r1, c0, c1, step, g.kind, g.spp].join('|')).digest('hex').slice(0, 20);
  const f = path.join(CACHE, 'win-' + key + '.f32');
  if (fs.existsSync(f)){ const b = fs.readFileSync(f); return { d:new Float32Array(b.buffer, b.byteOffset, b.length/4), w, h, spp, r0, c0, step }; }
  const d = new Float32Array(w*h*spp).fill(0), n = new Float32Array(w*h*spp).fill(0), bps = BPS[g.kind]*spp, rowB = g.W*bps;
  const add = (r, v) => { const y = Math.floor((r - r0)/step);
    for (let x=0;x<w;x++) for (let s=0;s<step;s++) for (let k=0;k<spp;k++){ const q = v[(x*step + s)*spp + k]; if (q === q){ d[(y*w + x)*spp + k] += q; n[(y*w + x)*spp + k]++; } } };
  const nR = h*step, need = nR*w*step*bps;
  // (whole rows in a few large reads when the rows lie back to back and little of each is wasted, or on a host that wants few requests;
  // else one read a row)
  // (runs of rows that lie back to back: the WAC mosaic's first row sits at the end of its file, the rest in order)
  const runs = []; for (let r=r0;r<r0 + nR;r++){ const L = runs[runs.length - 1]; if (L && g.rowOff(r) === g.rowOff(L[1] - 1) + rowB) L[1] = r + 1; else runs.push([r, r + 1]); }
  const paced = !!PACE[hostOf(g.url)];
  if (runs.length <= 8 && (nR*rowB <= Math.max(48e6, need*3) || paced)){
    const per = Math.max(1, Math.floor((paced ? 64e6 : 24e6)/rowB)), blocks = [];
    for (const [a, b] of runs) for (let r=a;r<b;r+=per) blocks.push([r, Math.min(b, r + per)]);
    let done = 0;
    await pool(blocks, paced ? 2 : 6, async ([ra, rb]) => {
      const buf = await getRange(g.url, g.rowOff(ra), g.rowOff(ra) + (rb - ra)*rowB);
      for (let r=ra;r<rb;r++) add(r, decodeRow(g, buf.subarray((r - ra)*rowB + c0*bps, (r - ra)*rowB + (c0 + w*step)*bps), w*step));
      done += rb - ra; process.stdout.write(`    ${path.basename(g.url)}: ${done}/${nR} rows (${Math.round(nR*rowB/1e6)} MB)\r`);
    });
  } else {
    const rows = []; for (let r=r0;r<r0 + nR;r++) rows.push(r);
    let done = 0;
    await pool(rows, g.conc, async r => {
      const a = g.rowOff(r) + c0*bps; add(r, decodeRow(g, await getRange(g.url, a, a + w*step*bps), w*step));
      if (++done % 400 === 0) process.stdout.write(`    ${path.basename(g.url)}: ${done}/${rows.length} rows\r`);
    });
  }
  for (let i=0;i<d.length;i++) d[i] = n[i] ? d[i]/n[i] : NaN;
  fs.writeFileSync(f, Buffer.from(d.buffer));
  return { d, w, h, spp, r0, c0, step };
}
// the window of grid g that covers a box of latitudes and longitudes (degrees east, any range), at about mpp metres a pixel (never finer than
// the grid): a sampler (la, lo) -> value (bilinear; band k), or NaN outside it or where it has no data
export async function windowLL(g, box, mpp){
  const [la0, la1, lo0, lo1] = box;
  const srcM = RM*D2R/g.ppdY, step = Math.max(1, Math.floor(mpp/srcM*0.999));
  // (longitudes in the grid's own range: [west, west + W/ppdX))
  // (a grid round the whole Moon: its own range of longitudes; a regional one, a terrain model or a mosaic: the turn nearest its middle, so a
  // box reaching past its west edge is clipped there, not sent round the Moon)
  const span = g.W/g.ppdX, mid = g.west + span/2;
  const wrap = span >= 359.9 ? lo => { let x = lo; while (x < g.west) x += 360; while (x >= g.west + 360) x -= 360; return x; }
    : lo => { let x = lo; while (x < mid - 180) x += 360; while (x >= mid + 180) x -= 360; return x; };
  // (all the way round: the grid's whole width, as it is)
  const full = lo1 - lo0 >= 359.9, loA = full ? g.west : wrap(lo0), loB = full ? g.west + 360 : loA + (lo1 - lo0);
  const c0 = Math.floor((loA - g.west)*g.ppdX) - 2*step, c1 = Math.ceil((loB - g.west)*g.ppdX) + 2*step;
  const r0 = Math.floor((g.north - la1)*g.ppdY) - 2*step, r1 = Math.ceil((g.north - la0)*g.ppdY) + 2*step;
  const win = await readWindow(g, r0, r1, c0, c1, step);
  const at = (la, lo, k = 0) => {
    let x = wrap(lo); if (!full && x < loA - 1) x += 360;
    const fx = ((x - g.west)*g.ppdX - win.c0)/win.step - 0.5, fy = ((g.north - la)*g.ppdY - win.r0)/win.step - 0.5;
    if (fx < 0 || fy < 0 || fx > win.w - 1 || fy > win.h - 1) return NaN;
    const x0 = Math.floor(fx), y0 = Math.floor(fy), x1 = Math.min(x0 + 1, win.w - 1), y1 = Math.min(y0 + 1, win.h - 1), tx = fx - x0, ty = fy - y0, s = win.spp;
    const a = win.d[(y0*win.w + x0)*s + k], b = win.d[(y0*win.w + x1)*s + k], c = win.d[(y1*win.w + x0)*s + k], e = win.d[(y1*win.w + x1)*s + k];
    // (a corner without data: the others carry it, so the edge of a strip is not eaten away)
    let sum = 0, wt = 0;
    for (const [v, q] of [[a, (1 - tx)*(1 - ty)], [b, tx*(1 - ty)], [c, (1 - tx)*ty], [e, tx*ty]]) if (v === v){ sum += v*q; wt += q; }
    return wt > 0.3 ? sum/wt : NaN;
  };
  // (smooth: Catmull-Rom over 4 x 4 samples, for heights brought to a finer grid than their own: straight lines between the samples turned
  // into facets, and a low Sun lit them as bands. Bilinear where a sample is missing)
  const cr = (a, b, c, d, t) => b + 0.5*t*(c - a + t*(2*a - 5*b + 4*c - d + t*(3*(b - c) + d - a)));
  const atC = (la, lo, k = 0) => {
    let x = wrap(lo); if (!full && x < loA - 1) x += 360;
    const fx = ((x - g.west)*g.ppdX - win.c0)/win.step - 0.5, fy = ((g.north - la)*g.ppdY - win.r0)/win.step - 0.5;
    const x1 = Math.floor(fx), y1 = Math.floor(fy), s = win.spp;
    if (x1 < 1 || y1 < 1 || x1 + 2 > win.w - 1 || y1 + 2 > win.h - 1) return at(la, lo, k);
    const tx = fx - x1, ty = fy - y1, row = j => { const q = [0, 1, 2, 3].map(i => win.d[((y1 - 1 + j)*win.w + x1 - 1 + i)*s + k]); return q.every(v => v === v) ? cr(q[0], q[1], q[2], q[3], tx) : NaN; };
    const r = [0, 1, 2, 3].map(row); return r.every(v => v === v) ? cr(r[0], r[1], r[2], r[3], ty) : at(la, lo, k);
  };
  return { at, atC, step, win };
}
// several grids that tile one map (SLDEM2015's tiles, the WAC mosaic's): a sampler over all of them for the box
export async function mosaicLL(gs, box, mpp){
  const parts = [];
  for (const g of gs){
    const gLo0 = g.west, gLo1 = g.west + g.W/g.ppdX, gLa1 = g.north, gLa0 = g.north - g.H/g.ppdY;
    if (box[0] > gLa1 || box[1] < gLa0) continue;
    // (the box's longitudes against the tile's, either way round the Moon)
    let hit = false; for (const sh of [-360, 0, 360]) if (box[2] + sh < gLo1 && box[3] + sh > gLo0) hit = true;
    if (!hit) continue;
    const b = [Math.max(box[0], gLa0), Math.min(box[1], gLa1)];
    const ov = []; for (const sh of [-360, 0, 360]){ const a = Math.max(box[2] + sh, gLo0), c = Math.min(box[3] + sh, gLo1); if (a < c) ov.push([a - sh, c - sh]); }
    for (const [a, c] of ov) parts.push(await windowLL(g, [b[0], b[1], a, c], mpp));
  }
  return { at:(la, lo, k = 0) => { for (const p of parts){ const v = p.at(la, lo, k); if (v === v) return v; } return NaN; },
    atC:(la, lo, k = 0) => { for (const p of parts){ const v = p.atC(la, lo, k); if (v === v) return v; } return NaN; } };
}

// ---------------------------------------------------------------- cloud-optimized GeoTIFFs (USGS's copies of the global mosaics, with overviews): the window of a box at
// about mpp metres a pixel from the overview nearest that, as a sampler like windowLL's. west/north/ppd: the full image's grid
const COGS = new Map();
export async function cogLL(url, grid0, box, mpp, opt = {}){
  let t = COGS.get(url); if (!t){ t = await fromUrl(url, { cacheSize:256 }); COGS.set(url, t); }
  const n = await t.getImageCount(), W0 = (await t.getImage(0)).getWidth();
  let im = await t.getImage(0), k = 1;
  for (let i=1;i<n;i++){ const x = await t.getImage(i), kk = W0/x.getWidth(); if (RM*D2R/grid0.ppd*kk <= mpp*1.0001){ im = x; k = kk; } }
  const ppd = grid0.ppd/k, W = im.getWidth(), H = im.getHeight();
  const [la0, la1, lo0, lo1] = box;
  const c0 = Math.max(0, Math.floor((lo0 - grid0.west)*ppd) - 2), c1 = Math.min(W, Math.ceil((lo1 - grid0.west)*ppd) + 2);
  const r0 = Math.max(0, Math.floor((grid0.north - la1)*ppd) - 2), r1 = Math.min(H, Math.ceil((grid0.north - la0)*ppd) + 2);
  const key = crypto.createHash('sha1').update([url, k, r0, r1, c0, c1].join('|')).digest('hex').slice(0, 20), f = path.join(CACHE, 'cog-' + key + '.f32');
  let d; const w = c1 - c0, h = r1 - r0;
  if (fs.existsSync(f)){ const b = fs.readFileSync(f); d = new Float32Array(b.buffer, b.byteOffset, b.length/4); }
  else { const r = await im.readRasters({ window:[c0, r0, c1, r1], samples:[opt.band || 0] }); d = Float32Array.from(r[0]); fs.writeFileSync(f, Buffer.from(d.buffer)); }
  const bad = opt.bad || (v => false);
  return { k, ppd, at:(la, lo) => {
    let x = lo; while (x < grid0.west) x += 360; while (x >= grid0.west + 360) x -= 360;
    const fx = (x - grid0.west)*ppd - c0 - 0.5, fy = (grid0.north - la)*ppd - r0 - 0.5;
    if (fx < 0 || fy < 0 || fx > w - 1 || fy > h - 1) return NaN;
    const x0 = Math.floor(fx), y0 = Math.floor(fy), x1 = Math.min(x0 + 1, w - 1), y1 = Math.min(y0 + 1, h - 1), tx = fx - x0, ty = fy - y0;
    let s = 0, q = 0; for (const [v, wt] of [[d[y0*w + x0], (1 - tx)*(1 - ty)], [d[y0*w + x1], tx*(1 - ty)], [d[y1*w + x0], (1 - tx)*ty], [d[y1*w + x1], tx*ty]]) if (!bad(v)){ s += v*wt; q += wt; }
    return q > 0.3 ? s/q : NaN; } };
}
// ---------------------------------------------------------------- NASA's Moon Trek tiles (trek.nasa.gov, LROC's NAC mosaics of the landing sites as 256 px PNG tiles in the
// equirectangular grid: zoom z has 2^(z+1) by 2^z tiles of 180/2^z degrees). The finest zoom no finer than mpp needs; 0 = no data
const TREK = 'https://trek.nasa.gov/tiles/Moon/EQ/';
export async function trekLL(layer, box, mpp, zMax = 17){
  const sharp = (await import('sharp')).default;
  // (the coarsest zoom whose pixels are no bigger than the layer's)
  let z = 0; while (z < zMax && 180/(256*2**z)*RM*D2R > mpp*1.001) z++;
  const td = 180/2**z, [la0, la1, lo0, lo1] = box;
  const tx0 = Math.floor((lo0 + 180)/td), tx1 = Math.floor((lo1 + 180)/td), ty0 = Math.floor((90 - la1)/td), ty1 = Math.floor((90 - la0)/td);
  const W = (tx1 - tx0 + 1)*256, H = (ty1 - ty0 + 1)*256, d = new Float32Array(W*H).fill(NaN), jobs = [];
  for (let ty=ty0;ty<=ty1;ty++) for (let tx=tx0;tx<=tx1;tx++) jobs.push([tx, ty]);
  await pool(jobs, 4, async ([tx, ty]) => {
    const f = path.join(CACHE, `trek-${layer}-${z}-${ty}-${tx}.png`);
    let buf = fs.existsSync(f) ? fs.readFileSync(f) : null;
    if (!buf){
      for (let k=0;k<6;k++){ try { const r = await fetch(`${TREK}${layer}/1.0.0//default/default028mm/${z}/${ty}/${tx}.png`, { headers:UA, signal:AbortSignal.timeout(60000) });
        if (r.status === 404){ buf = Buffer.alloc(0); break; } if (!r.ok) throw new Error('trek ' + r.status); buf = Buffer.from(await r.arrayBuffer()); break; } catch (e) { if (k === 5) throw e; await sleep(2000*(k + 1)); } }
      fs.writeFileSync(f, buf);
    }
    if (!buf.length) return;
    const { data, info } = await sharp(buf).raw().toBuffer({ resolveWithObject:true }), ch = info.channels;
    for (let y=0;y<256;y++) for (let x=0;x<256;x++){ const i = (y*256 + x)*ch, a = ch === 4 ? data[i + 3] : ch === 2 ? data[i + 1] : 255, v = data[i];
      if (a > 0 && v > 0) d[((ty - ty0)*256 + y)*W + (tx - tx0)*256 + x] = v; }
  });
  const ppd = 256/td, west = tx0*td - 180, north = 90 - ty0*td;
  return { z, at:(la, lo) => {
    const fx = (lo - west)*ppd - 0.5, fy = (north - la)*ppd - 0.5; if (fx < 0 || fy < 0 || fx > W - 1 || fy > H - 1) return NaN;
    const x0 = Math.floor(fx), y0 = Math.floor(fy), x1 = Math.min(x0 + 1, W - 1), y1 = Math.min(y0 + 1, H - 1), u = fx - x0, v = fy - y0;
    let s = 0, q = 0; for (const [val, wt] of [[d[y0*W + x0], (1 - u)*(1 - v)], [d[y0*W + x1], u*(1 - v)], [d[y1*W + x0], (1 - u)*v], [d[y1*W + x1], u*v]]) if (val === val){ s += val*wt; q += wt; }
    return q > 0.3 ? s/q : NaN; } };
}
// the USGS copies (cloud-optimized, with overviews): Clementine's 750 nm albedo (118 m), LROC WAC's morphology mosaic (100 m)
export const CLEM_COG = { url:'https://asc-pds-services.s3.us-west-2.amazonaws.com/wms_basemaps3/Moon/Clem_UVVIS_Mosaic_Global_256ppd_v02_cog.tif', west:-180, north:90, ppd:256 };

// ---------------------------------------------------------------- the archives
const PDS_IMG = 'https://pds.mcp.nasa.gov/data/store/img/lunar_reconnaissance_orbiter/pds4/lroc/lro-l-lroc-5-rdr/LROLRC_2001/DATA/';
const GEO = 'https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/data/';
const USGS = 'https://asc-pds-services.s3.us-west-2.amazonaws.com/mosaic/';
// a striped, uncompressed TIFF read row by row: its rows' byte offsets come from its strip table
async function tiffGrid(url, o){
  const t = await fromUrl(url), im = await t.getImage(0), fd = im.fileDirectory, W = im.getWidth(), H = im.getHeight();
  if (fd.Compression !== 1 || im.isTiled) throw new Error(url + ': not a striped uncompressed TIFF');
  // (the strip table as it is: the WAC mosaic's first row sits at the end of its file)
  const so = fd.StripOffsets, spp = im.getSamplesPerPixel(), bps = fd.BitsPerSample[0]/8, rowBytes = W*spp*bps, rps = fd.RowsPerStrip || 1;
  if (!so || typeof so.length !== 'number' || so.length < Math.ceil(H/rps)) throw new Error(url + ': no strip table');
  return grid(Object.assign({ url, W, H, spp, rowOff:r => so[Math.floor(r/rps)] + (r % rps)*rowBytes }, o(im)));
}
// a classic little-endian TIFF's first image, from one read of its head (kept in the cache): size, samples, and where each strip starts.
// (geotiff.js reads a header in several small requests: on NASA's imaging archive a burst of them earns an hour's wait)
async function tiffHead(url){
  const f = path.join(CACHE, 'tif-' + crypto.createHash('sha1').update(url).digest('hex').slice(0, 16) + '.json');
  if (fs.existsSync(f)) return JSON.parse(fs.readFileSync(f, 'utf8'));
  let buf = await getRange(url, 0, 131072);
  const dv = () => new DataView(buf.buffer, buf.byteOffset, buf.length);
  if (buf[0] !== 0x49 || buf[1] !== 0x49) throw new Error(url + ': not a little-endian TIFF');
  const ifd = dv().getUint32(4, true), n = dv().getUint16(ifd, true), T = {};
  for (let i=0;i<n;i++){ const e = ifd + 2 + i*12, d = dv(), tag = d.getUint16(e, true), type = d.getUint16(e + 2, true), cnt = d.getUint32(e + 4, true);
    const size = { 1:1, 3:2, 4:4, 16:8 }[type] || 4, inl = size*cnt <= 4, at = inl ? e + 8 : d.getUint32(e + 8, true);
    T[tag] = { type, cnt, at, inl }; }
  const need = Math.max(...[273, 279].filter(k => T[k] && !T[k].inl).map(k => T[k].at + T[k].cnt*({ 3:2, 4:4, 16:8 }[T[k].type] || 4)));
  if (need > buf.length) buf = Buffer.concat([buf, await getRange(url, buf.length, need)]);
  const rd = (k, i = 0) => { const t = T[k], d = dv(), s = { 1:1, 3:2, 4:4, 16:8 }[t.type] || 4, p = t.at + i*s; return s === 1 ? d.getUint8(p) : s === 2 ? d.getUint16(p, true) : s === 8 ? Number(d.getBigUint64(p, true)) : d.getUint32(p, true); };
  const h = { W:rd(256), H:rd(257), bps:rd(258), comp:rd(259), spp:T[277] ? rd(277) : 1, rps:T[278] ? rd(278) : rd(257), so:[] };
  for (let i=0;i<T[273].cnt;i++) h.so.push(rd(273, i));
  if (h.comp !== 1) throw new Error(url + ': compressed TIFF');
  fs.writeFileSync(f, JSON.stringify(h));
  return h;
}
// the WAC Hapke-normalized 3-band mosaic, eight tiles of 90 by 70 degrees: R 689 nm, G 415 nm, B 321 nm (8-bit DN, 0 = no data)
export async function wacHapke(){
  const tiles = [];
  for (const ns of ['N', 'S']) for (const lo of ['0450', '1350', '2250', '3150']){
    const url = PDS_IMG + `MDR/WAC_HAPKE/WAC_HAPKE_3BAND_E350${ns}${lo}.TIF`, c = +lo/10, h = await tiffHead(url), rowB = h.W*h.spp*(h.bps/8);
    tiles.push(grid({ url, W:h.W, H:h.H, spp:h.spp, kind:'u8', bad:v => v === 0, west:c - 45, north:ns === 'N' ? 70.0131579 : 0, ppdX:76, ppdY:76, conc:1,
      rowOff:r => h.so[Math.floor(r/h.rps)] + (r % h.rps)*rowB }));
  }
  return tiles;
}
// LOLA albedo (1064 nm normal albedo x 1000? the label's units), 10 px/deg, the whole Moon (west edge at 0 E)
export async function lolaAlbedo(){
  return tiffGrid(USGS + 'Lunar_LRO_LOLA_Albedo_Global_10ppd.tif', () => ({ kind:'i16le', bad:v => v <= -32768 || v === 0, west:0, north:90, ppdX:10, ppdY:10, conc:8 }));
}
// LOLA LDEM_16: 16 px/deg, int16 x 0.5 m, west edge at 0 E
export const ldem16 = () => grid({ url:GEO + 'lola_gdr/cylindrical/img/ldem_16.img', W:5760, H:2880, kind:'i16le', scale:0.5, west:0, north:90, ppdX:16, ppdY:16, rowOff:r => r*5760*2, conc:16 });
// LOLA's 118 m global DEM (USGS): int16 x 0.5 m, -180 to 180
export async function lola118(){
  return tiffGrid(USGS + 'Lunar_LRO_LOLA_Global_LDEM_118m_Mar2014.tif', () => ({ kind:'i16le', scale:0.5, bad:v => v <= -32768, west:-180, north:90, ppdX:256, ppdY:256, conc:16 }));
}
// SLDEM2015, 512 px/deg, float km, in tiles of 30 by 45 degrees from 60 S to 60 N
export function sldem(){
  const tiles = [];
  for (const [la0, la1] of [[-60, -30], [-30, 0], [0, 30], [30, 60]]) for (let lo=0;lo<360;lo+=45){
    const tag = (la0 < 0 ? String(-la0).padStart(2, '0') + 's' : String(la0).padStart(2, '0') + 'n') + '_' + (la1 <= 0 ? String(-la1).padStart(2, '0') + 's' : String(la1).padStart(2, '0') + 'n');
    tiles.push(grid({ url:GEO + `sldem2015/tiles/float_img/sldem2015_512_${tag}_${String(lo).padStart(3, '0')}_${String(lo + 45).padStart(3, '0')}_float.img`,
      W:23040, H:15360, kind:'f32le', scale:1000, bad:v => !(v > -30 && v < 30), west:lo, north:la1, ppdX:512, ppdY:512, rowOff:r => r*23040*4, conc:16 }));
  }
  return tiles;
}
// a PDS4 image (NAC ROI mosaics, NAC DTMs and their orthophotos): its label gives the array's offset, size and type, and the equirectangular
// grid's bounding coordinates
export async function pds4(rel){
  const url = PDS_IMG + rel, x = await getText(url.replace(/\.IMG$/, '.xml'));
  const num = re => { const m = x.match(re); return m ? +m[1] : NaN; };
  const arr = x.slice(x.indexOf('<Array_2D_Image>'));
  const off = +arr.match(/<offset unit="byte">(\d+)</)[1], els = [...arr.matchAll(/<elements>(\d+)</g)].map(m => +m[1]), H = els[0], W = els[1];
  const dt = arr.match(/<data_type>(\w+)</)[1];
  const kind = { IEEE754LSBSingle:'f32le', IEEE754MSBSingle:'f32be', UnsignedByte:'u8', SignedLSB2:'i16le', UnsignedLSB2:'u16le', SignedMSB2:'i16be', UnsignedMSB2:'u16be' }[dt];
  if (!kind) throw new Error(rel + ': data type ' + dt);
  // (the special values that mean no data: hex for floats, numbers for integers)
  const sp = arr.slice(arr.indexOf('<Special_Constants>'), arr.indexOf('</Special_Constants>')), spec = new Set();
  for (const m of sp.matchAll(/<(?:missing|null|saturated|high_\w+|low_\w+)_?\w*>([^<]+)</g)){ const t = m[1].trim();
    spec.add(/^0x/i.test(t) ? (kind.startsWith('f32') ? new DataView(new Uint32Array([parseInt(t, 16)]).buffer).getFloat32(0, true) : parseInt(t, 16)) : +t); }
  const west = num(/west_bounding_coordinate unit="deg">([-\d.eE]+)</), east = num(/east_bounding_coordinate unit="deg">([-\d.eE]+)</);
  const north = num(/north_bounding_coordinate unit="deg">([-\d.eE]+)</), south = num(/south_bounding_coordinate unit="deg">([-\d.eE]+)</);
  const sc = num(/<scaling_factor>([-\d.eE]+)</), ad = num(/<value_offset>([-\d.eE]+)</);
  return grid({ url, W, H, kind, west, north, ppdX:W/(east - west), ppdY:H/(north - south), rowOff:r => off + r*W*BPS[kind], scale:sc === sc ? sc : 1, add:ad === ad ? ad : 0,
    bad:kind.startsWith('f32') ? v => !(v > -1e30) || v !== v : v => spec.has(v), conc:16, east, south, label:x });
}

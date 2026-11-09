// Builds the real Moon (0.27.0, the "surfaces" pack of docs/CONTENT.md): a map of the whole Moon for the globe, and nested square layers round
// each place (a landing site or a crater) for the ground drawn near it (FS_MOON_ENV). From NASA's Lunar Reconnaissance Orbiter and Clementine,
// all public domain (sources in tools/lib/moon-sources.mjs and docs/ACCURACY.md).
//   The whole Moon: assets/moon/global-color-<w>-<hash>.webp (RGB, the albedo in display terms, equirectangular, east longitude from -180,
//   north up) and global-height-<w>-<hash>.webp (lossless: R and G are the height's high and low bytes, metres = base + (R*256 + G) x step),
//   4096 and 2048 wide.
//   A place: per layer two WebP files, <site>-<id>-c-<hash>.webp (the colour, lossy) and <site>-<id>-h-<hash>.webp (the heights, lossless, as
//   above), a square <size> m across centred on <la, lo> in the orthographic projection of the 1,737.4 km sphere (x east, y north), as the
//   Earth's layers are (tools/earth-detail.mjs).
//   The manifest: src/objects/m0-moon-detail-data.js (MOON_DETAIL).
// The albedo is LROC's WAC mosaic normalized to one lighting (Hapke; with MOON_PDS=0, or until NASA's imaging archive lets us read it,
// Clementine's 750 nm mosaic): no shadows of its own, so the page lights it with the real Sun. Near the landing sites its fine detail comes
// from LROC's NAC mosaics (Moon Trek's tiles). The heights are LOLA's and SLDEM2015's, and LROC's NAC terrain models (2 m) at the landing sites.
//   node tools/moon-detail.mjs [global] [place ...]        (no arguments: everything; --manifest: rewrite the manifest from the cache only)
// Downloads go to MOON_CACHE (else tools/cache/moon): keep it outside a worktree, never linked into one.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import sharp from 'sharp';
import { ROOT, CACHE, RM, D2R, clampN, windowLL, mosaicLL, wacHapke, lolaAlbedo, ldem16, lola118, sldem, pds4, readWindow, cogLL, trekLL, CLEM_COG } from './lib/moon-sources.mjs';

const OUT = path.join(ROOT, 'assets', 'moon'), PREVIEW = path.join(CACHE, 'preview'), BUILT = path.join(CACHE, 'built');
for (const d of [OUT, PREVIEW, BUILT]) fs.mkdirSync(d, { recursive:true });
const PDS = process.env.MOON_PDS !== '0';   // (NASA's imaging archive: the WAC Hapke mosaic and the NAC terrain models)

// ---------------------------------------------------------------- geometry (Moon-centred, z north: only inside this tool)
const unit = (la, lo) => [Math.cos(la*D2R)*Math.cos(lo*D2R), Math.cos(la*D2R)*Math.sin(lo*D2R), Math.sin(la*D2R)];
function frameAt(la, lo){ const u = unit(la, lo), e = [-Math.sin(lo*D2R), Math.cos(lo*D2R), 0], n = [-Math.sin(la*D2R)*Math.cos(lo*D2R), -Math.sin(la*D2R)*Math.sin(lo*D2R), Math.cos(la*D2R)]; return { u, e, n }; }
// a point of a layer's plane (x east, y north, m) -> lat, lon (straight down onto the sphere)
function planeToLL(F, x, y){ const z = Math.sqrt(Math.max(RM*RM - x*x - y*y, 0)); const p = [0, 1, 2].map(k => F.e[k]*x + F.n[k]*y + F.u[k]*z); return [Math.asin(clampN(p[2]/RM, -1, 1))/D2R, Math.atan2(p[1], p[0])/D2R]; }
function bboxLL(L, pad = 0){ const F = frameAt(L.la, L.lo), h = L.size/2 + pad; let la0 = 90, la1 = -90, lo0 = 1e9, lo1 = -1e9;
  for (const [x, y] of [[-h, -h], [h, -h], [-h, h], [h, h], [0, h], [0, -h], [h, 0], [-h, 0]]){ const [la, lo0_] = planeToLL(F, x, y); let lo = lo0_; while (lo < L.lo - 180) lo += 360; while (lo > L.lo + 180) lo -= 360;
    la0 = Math.min(la0, la); la1 = Math.max(la1, la); lo0 = Math.min(lo0, lo); lo1 = Math.max(lo1, lo); }
  return [la0, la1, lo0, lo1]; }

// ---------------------------------------------------------------- the places
// la, lo: the place's middle (a lander's own spot at the landing sites: LROC's coordinates of 28 July 2016, Wagner et al. 2017, Icarus 283, 92). Each layer:
// id, size (m), px, its centre if not the place's, and its sources: trek (Moon Trek's NAC mosaics, finest first), dtm (NAC terrain models,
// 2 m, in NASA's archive under .../SDP/NAC_DTM/)
const DTM = p => 'SDP/NAC_DTM/' + p, ROI = p => 'BDR/NAC_ROI/' + p;
export const PLACES = [
  { key:'apollo11', name:'Tranquility Base', la:0.67416, lo:23.47314, layers:[
    { id:'r410', size:409600, px:1024 },
    { id:'r102', size:102400, px:1024 },
    { id:'l25', size:25600, px:1024, img:[ROI('APOLLO11HIA/NAC_ROI_APOLLO11HIA_E010N0234_20M.IMG')], trek:['A11_60x60km.eq'], dtm:[DTM('APOLLO11/NAC_DTM_APOLLO11_E008N0234.IMG')] },
    { id:'l4', size:4096, px:1024, lo:23.4419, img:[ROI('APOLLO11HIA/NAC_ROI_APOLLO11HIA_E010N0234_5M.IMG')], trek:['apollo11_26cm_mosaic_byte_geo_1_2_highContrast'], dtm:[DTM('APOLLO11/NAC_DTM_APOLLO11_E008N0234.IMG')] },
    { id:'l1', size:1024, px:1024, trek:['apollo11_26cm_mosaic_byte_geo_1_2_highContrast', 'LRO_NAC_Apollo11_Mosaic_p'], dtm:[DTM('APOLLO11/NAC_DTM_APOLLO11_E008N0234.IMG')] } ] },
  { key:'apollo12', name:'Apollo 12 landing site', la:-3.0128, lo:-23.4219, layers:[
    { id:'r410', size:409600, px:1024 },
    { id:'r102', size:102400, px:1024 },
    { id:'l25', size:25600, px:1024, img:[ROI('APOLLO12LOA/NAC_ROI_APOLLO12LOA_E024S3368_20M.IMG')], trek:['A12_60x60km.0_3.eq'], dtm:[DTM('APOLLO12/NAC_DTM_APOLLO12_E030S3365.IMG')] },
    { id:'l4', size:4096, px:1024, img:[ROI('APOLLO12LOA/NAC_ROI_APOLLO12LOA_E024S3368_5M.IMG')], trek:['LRO_NAC_Apollo12_Mosaic_p'], dtm:[DTM('APOLLO12/NAC_DTM_APOLLO12_E030S3365.IMG')] },
    { id:'l1', size:1024, px:1024, trek:['LRO_NAC_Apollo12_Mosaic_p'], dtm:[DTM('APOLLO12/NAC_DTM_APOLLO12_E030S3365.IMG')] } ] },
  { key:'apollo14', name:'Apollo 14 landing site', la:-3.64589, lo:-17.47194, layers:[
    { id:'r410', size:409600, px:1024 },
    { id:'r102', size:102400, px:1024 },
    { id:'l25', size:25600, px:1024, img:[ROI('APOLLO14LOA/NAC_ROI_APOLLO14LOA_E038S3426_20M.IMG')], trek:['A14_60x60km.0_3.eq'], dtm:[DTM('APOLLO14/NAC_DTM_APOLLO14_E034S3425.IMG')] },
    { id:'l4', size:4096, px:1024, lo:-17.462, img:[ROI('APOLLO14LOA/NAC_ROI_APOLLO14LOA_E038S3426_5M.IMG')], trek:['apollo14_28cm_mosaic_byte_geo_1_2_highContrast'], dtm:[DTM('APOLLO14/NAC_DTM_APOLLO14_E034S3425.IMG')] },
    { id:'l1', size:1024, px:1024, trek:['apollo14_28cm_mosaic_byte_geo_1_2_highContrast', 'LRO_NAC_Apollo14_Mosaic_p'], dtm:[DTM('APOLLO14/NAC_DTM_APOLLO14_E034S3425.IMG')] } ] },
  // (Hadley Rille is a place of its own drawn with this site's layers: rl6 follows the rille where it passes the landing site)
  { key:'apollo15', name:'Apollo 15 landing site', la:26.13239, lo:3.63330, layers:[
    { id:'r410', size:409600, px:1024 },
    { id:'r102', size:102400, px:1024 },
    { id:'l25', size:25600, px:1024, img:[ROI('APOLLO15HIA/NAC_ROI_APOLLO15HIA_E259N0036_20M.IMG')], trek:['A15_60x60km.0_2.eq'], dtm:[DTM('APOLLO15/NAC_DTM_APOLLO15_E261N0036.IMG')] },
    { id:'rl6', size:6400, px:1024, la:26.105, lo:3.585, img:[ROI('APOLLO15HIA/NAC_ROI_APOLLO15HIA_E259N0036_5M.IMG')], trek:['LRO_NAC_Mosaic_26N004E_50cmp'], dtm:[DTM('APOLLO15/NAC_DTM_APOLLO15_E261N0036.IMG')] },
    { id:'l4', size:4096, px:1024, img:[ROI('APOLLO15HIA/NAC_ROI_APOLLO15HIA_E259N0036_5M.IMG')], trek:['LRO_NAC_Mosaic_26N004E_50cmp'], dtm:[DTM('APOLLO15/NAC_DTM_APOLLO15_E261N0036.IMG')] },
    { id:'l1', size:1024, px:1024, trek:['LRO_NAC_Apollo15_Mosaic_p', 'LRO_NAC_Mosaic_26N004E_50cmp'], dtm:[DTM('APOLLO15/NAC_DTM_APOLLO15_E261N0036.IMG')] } ] },
  { key:'apollo16', name:'Apollo 16 landing site', la:-8.9734, lo:15.5011, layers:[
    { id:'r410', size:409600, px:1024 },
    { id:'r102', size:102400, px:1024 },
    { id:'l25', size:25600, px:1024, img:[ROI('APOLLO16HIA/NAC_ROI_APOLLO16HIA_E091S0152_20M.IMG')], trek:['A16_60x60km.eq'] },
    { id:'l4', size:4096, px:1024, img:[ROI('APOLLO16HIA/NAC_ROI_APOLLO16HIA_E091S0152_5M.IMG')], trek:['LRO_NAC_Mosaic_09S015E_50cmp'], dtm:[DTM('APOLLO16/NAC_DTM_APOLLO16_E091S0155.IMG')] },
    { id:'l1', size:1024, px:1024, trek:['LRO_NAC_Apollo16_Mosaic_p', 'LRO_NAC_Mosaic_09S015E_50cmp'], dtm:[DTM('APOLLO16/NAC_DTM_APOLLO16_E091S0155.IMG')] } ] },
  { key:'apollo17', name:'Apollo 17 landing site', la:20.1911, lo:30.7723, layers:[
    { id:'r410', size:409600, px:1024 },
    { id:'r102', size:102400, px:1024 },
    { id:'l25', size:25600, px:1024, img:[ROI('APOLLO17HIA/NAC_ROI_APOLLO17HIA_E201N0303_20M.IMG')], trek:['NAC_DTM_APOLLO17_MOSAIC_120CM'] },   // (not Moon Trek's A17_60x60km: stripes along its west edge)
    { id:'l4', size:4096, px:1024, img:[ROI('APOLLO17HIA/NAC_ROI_APOLLO17HIA_E201N0303_5M.IMG')], trek:['M129086118.nd.gcs', 'NAC_DTM_APOLLO17_MOSAIC_120CM'], dtm:[DTM('APOLLO17/NAC_DTM_APOLLO17_E203N0308.IMG')] },
    { id:'l1', size:1024, px:1024, trek:['M129086118.nd.gcs', 'NAC_DTM_APOLLO17_MOSAIC_120CM'], dtm:[DTM('APOLLO17/NAC_DTM_APOLLO17_E203N0308.IMG')] } ] },
  // (the craters: centred on the crater; their finest layers on the central peak, from the NAC terrain model of Tycho's peak)
  { key:'tycho', name:'Tycho', la:-43.31, lo:-11.36, layers:[
    { id:'r410', size:409600, px:1024 },
    { id:'r102', size:102400, px:1024, trek:['LRO_NAC_Mosaic_43S349E_50cmp'] },
    { id:'l25', size:25600, px:1024, la:-43.39, lo:-11.37, trek:['LRO_NAC_Mosaic_43S349E_50cmp'] },
    { id:'l6', size:6400, px:1024, la:-43.39, lo:-11.37, trek:['LRO_NAC_Mosaic_43S349E_50cmp'], dtm:[DTM('TYCHOPK/NAC_DTM_TYCHOPK_E434S3486.IMG')] } ] },
  { key:'copernicus', name:'Copernicus', la:9.62, lo:-20.08, layers:[
    { id:'r410', size:409600, px:1024 },
    { id:'r102', size:102400, px:1024, img:[ROI('COPERNICLOA/NAC_ROI_COPERNICLOA_E098N3401_20M.IMG')] },
    { id:'l25', size:25600, px:1024, img:[ROI('COPERNICLOA/NAC_ROI_COPERNICLOA_E098N3401_5M.IMG')] } ] },
];

// ---------------------------------------------------------------- the albedo, in display terms
// The broad albedo: the WAC Hapke mosaic's 689 nm band (and 415 nm against it for the colour: the titanium-rich seas are bluer), or
// Clementine's 750 nm albedo (grey). Shown in display terms: the source's 5th and 95th percentiles over the whole Moon (the seas and the
// highlands) land at 0.3 and 0.68, a stronger contrast than real so they read as characters (ACCURACY.md)
const STATE = { src:PDS ? 'hapke' : 'clem', lo:0, hi:1, tint:0 };
const TINT = { gain:2.2, max:0.18 };
const DETAIL = 0.1;   // (the spread of the fine detail's log brightness in every layer: about a tenth brighter or darker, two or three times what the seas really show)
function colourOf(L, ratio){
  const v = clampN(0.3 + 0.38*(L - STATE.lo)/(STATE.hi - STATE.lo), 0.03, 1)*255, t = ratio > 0 ? clampN((Math.log(ratio) - STATE.tint)*TINT.gain, -TINT.max, TINT.max) : 0;
  // (a warm grey, bluer where the 415 nm band is relatively bright, browner where it is not)
  return [v*1.0*(1 - 0.5*t), v*0.985*(1 - 0.05*t), v*0.95*(1 + 0.65*t)].map(c => clampN(Math.round(c), 0, 255));
}
let WAC = null;
const wac = async () => WAC || (WAC = await wacHapke());
// the broad albedo over a box: { at(la, lo) -> [L, 415/689 ratio or 0] }
async function broadOf(box, mpp){
  if (STATE.src === 'hapke'){ const m = await mosaicLL(await wac(), box, Math.max(mpp, 400));
    return { at:(la, lo) => { const R = m.at(la, lo, 0), G = m.at(la, lo, 1); return [R, R === R && G === G && G < 250 && R > 3 ? G/R : 0]; } }; }
  const c = await cogLL(CLEM_COG.url, CLEM_COG, box, Math.max(mpp, 118), { bad:v => !(v > 0) });
  return { at:(la, lo) => [c.at(la, lo), 0] };
}

// ---------------------------------------------------------------- encoding
// heights (m) -> the lossless WebP (R high byte, G low byte), base, step: never finer than a 50th of a pixel (a slope a degree off at most),
// never coarser than the range needs to fit 16 bits
async function encodeHeights(W, H, h, mpp){
  let lo = Infinity, hi = -Infinity; for (const v of h){ if (v < lo) lo = v; if (v > hi) hi = v; }
  const base = Math.floor(lo), step = Math.max(mpp/50, (hi - base)/65000, 0.005), raw = Buffer.alloc(W*H*3);
  for (let i=0;i<W*H;i++){ const q = clampN(Math.round((h[i] - base)/step), 0, 65535); raw[i*3] = q >> 8; raw[i*3 + 1] = q & 255; }
  const webp = await sharp(raw, { raw:{ width:W, height:H, channels:3 } }).webp({ lossless:true, effort:6 }).toBuffer();
  return { webp, base, step:+step.toFixed(6), top:Math.ceil(hi), low:Math.floor(lo) };
}
const encodeColour = (W, H, rgb) => sharp(rgb, { raw:{ width:W, height:H, channels:3 } }).webp({ quality:80, effort:6, smartSubsample:true }).toBuffer();
function save(prefix, webp){
  const hash = crypto.createHash('sha1').update(webp).digest('hex').slice(0, 8), file = `${prefix}-${hash}.webp`;
  for (const f of fs.readdirSync(OUT)) if (f.startsWith(prefix + '-') && f !== file && /^[0-9a-f]{8}\.webp$/.test(f.slice(prefix.length + 1))) fs.unlinkSync(path.join(OUT, f));
  fs.writeFileSync(path.join(OUT, file), webp);
  return file;
}
// colour x a hillshade of the heights, the light from the west (a look at what the page will read)
async function preview(N, rgb, h, mpp, size = 512){
  const out = Buffer.alloc(N*N*3), L = [-0.8, 0, 0.6];
  for (let y=0;y<N;y++) for (let x=0;x<N;x++){
    const i = y*N + x, xa = Math.max(0, x - 1), xb = Math.min(N - 1, x + 1), ya = Math.max(0, y - 1), yb = Math.min(N - 1, y + 1);
    const dx = (h[y*N + xb] - h[y*N + xa])/((xb - xa)*mpp), dy = (h[ya*N + x] - h[yb*N + x])/((yb - ya)*mpp);
    const nx = -dx, ny = -dy, nz = 1, nl = Math.hypot(nx, ny, nz), s = clampN((nx*L[0] + ny*L[1] + nz*L[2])/nl/L[2], 0, 2.2)*0.75 + 0.1;
    for (let k=0;k<3;k++) out[i*3 + k] = clampN(rgb[i*3 + k]*s, 0, 255);
  }
  return [await sharp(rgb, { raw:{ width:N, height:N, channels:3 } }).resize(size, size).png().toBuffer(), await sharp(out, { raw:{ width:N, height:N, channels:3 } }).resize(size, size).png().toBuffer()];
}
async function sheet(name, parts, size = 512){
  const comp = []; parts.forEach(([a, b], k) => { comp.push({ input:a, left:k*size, top:0 }); comp.push({ input:b, left:k*size, top:size }); });
  await sharp({ create:{ width:parts.length*size, height:size*2, channels:3, background:{ r:20, g:20, b:20 } } }).composite(comp).png().toFile(path.join(PREVIEW, name + '.png'));
}

// ---------------------------------------------------------------- the whole Moon
async function buildGlobal(){
  console.log('the whole Moon (' + STATE.src + ')');
  const W = 4096, H = 2048, ppd = W/360, mpp = RM*D2R/ppd;
  const A = new Float32Array(W*H).fill(NaN), Rt = new Float32Array(W*H).fill(0);
  if (STATE.src === 'hapke'){
    for (const g of await wac()){
      const step = Math.max(1, Math.floor(g.ppdY/ppd*0.999)), win = await readWindow(g, 0, g.H, 0, g.W, step);
      for (let y=0;y<H;y++){ const la = 90 - (y + 0.5)/ppd; if (la > g.north || la < g.north - g.H/g.ppdY) continue;
        for (let x=0;x<W;x++){ let lo = -180 + (x + 0.5)/ppd; if (lo < g.west) lo += 360; if (lo < g.west || lo >= g.west + g.W/g.ppdX) continue;
          const xi = clampN(Math.round(((lo - g.west)*g.ppdX)/step - 0.5), 0, win.w - 1), yi = clampN(Math.round(((g.north - la)*g.ppdY)/step - 0.5), 0, win.h - 1), q = (yi*win.w + xi)*3;
          const R = win.d[q], G = win.d[q + 1]; if (R === R){ A[y*W + x] = R; if (G === G && G < 250 && R > 3) Rt[y*W + x] = G/R; } } }
    }
    let s = 0, n = 0; for (const r of Rt) if (r > 0){ s += Math.log(r); n++; } STATE.tint = n ? s/n : 0;
  } else {
    const c = await cogLL(CLEM_COG.url, CLEM_COG, [-90, 90, -180, 180], mpp, { bad:v => !(v > 0) });
    for (let y=0;y<H;y++) for (let x=0;x<W;x++) A[y*W + x] = c.at(90 - (y + 0.5)/ppd, -180 + (x + 0.5)/ppd);
  }
  // LOLA's albedo toward the poles (beyond 66 degrees, where the mosaics have gaps and stripes), matched to the mosaic between 55 and 66
  const lw = await windowLL(await lolaAlbedo(), [-90, 90, -180, 180], mpp);
  let sx = 0, sy = 0, sxx = 0, sxy = 0, n = 0;
  for (let y=0;y<H;y++){ const lat = 90 - (y + 0.5)/ppd; if (Math.abs(lat) < 55 || Math.abs(lat) > 66) continue;
    for (let x=0;x<W;x+=3){ const a = A[y*W + x], b = lw.at(lat, -180 + (x + 0.5)/ppd); if (a === a && b === b){ sx += b; sy += a; sxx += b*b; sxy += a*b; n++; } } }
  const k = (n*sxy - sx*sy)/(n*sxx - sx*sx), c0 = (sy - k*sx)/n;
  console.log(`  LOLA albedo -> mosaic: x${k.toFixed(3)} + ${c0.toFixed(1)} (${n} pixels)`);
  for (let y=0;y<H;y++){ const lat = 90 - (y + 0.5)/ppd, wP = clampN((Math.abs(lat) - 62)/6, 0, 1);
    for (let x=0;x<W;x++){ const i = y*W + x, b = lw.at(lat, -180 + (x + 0.5)/ppd), lb = b === b ? k*b + c0 : NaN, a = A[i];
      A[i] = a === a ? (lb === lb ? a*(1 - wP) + lb*wP : a) : lb; if (wP > 0) Rt[i] *= 1 - wP; } }
  fillNaN(A, W, H);
  // (the display mapping from the whole Moon's 5th and 95th percentiles, kept for the places' layers)
  { const s = Array.from(A).filter(v => v === v).sort((a, b) => a - b); STATE.lo = s[Math.floor(s.length*0.05)]; STATE.hi = s[Math.floor(s.length*0.95)]; }
  const Rs = Rt.some(v => v > 0) ? blurMasked(Rt, Rt.map(v => v > 0 ? 1 : 0), W, H, 2) : Rt;
  const rgb = Buffer.alloc(W*H*3);
  for (let i=0;i<W*H;i++){ const c = colourOf(A[i], Rs[i] > 0 ? Rs[i] : 0); rgb[i*3] = c[0]; rgb[i*3 + 1] = c[1]; rgb[i*3 + 2] = c[2]; }
  // heights: LOLA's LDEM_16 (16 px/deg), at each pixel's middle
  const lw16 = await windowLL(ldem16(), [-90, 90, -180, 180], mpp), h = new Float32Array(W*H);
  for (let y=0;y<H;y++) for (let x=0;x<W;x++){ const v = lw16.at(90 - (y + 0.5)/ppd, -180 + (x + 0.5)/ppd); h[y*W + x] = v === v ? v : 0; }
  const out = { src:STATE.src, lo:STATE.lo, hi:STATE.hi, tint:STATE.tint, color:[], height:[] };
  for (const w of [4096, 2048]){
    const hh = w === W ? h : downH(h, W, H), cc = w === W ? rgb : await sharp(rgb, { raw:{ width:W, height:H, channels:3 } }).resize(w, w/2, { kernel:'lanczos3' }).raw().toBuffer();
    const col = await encodeColour(w, w/2, cc), eh = await encodeHeights(w, w/2, hh, RM*D2R*360/w);
    out.color.push({ w, file:save(`global-color-${w}`, col), bytes:col.length }); out.height.push({ w, file:save(`global-height-${w}`, eh.webp), bytes:eh.webp.length, base:eh.base, step:eh.step });
    console.log(`  ${w}: colour ${(col.length/1e6).toFixed(2)} MB, heights ${(eh.webp.length/1e6).toFixed(2)} MB`);
  }
  await sharp(rgb, { raw:{ width:W, height:H, channels:3 } }).resize(2048, 1024).png().toFile(path.join(PREVIEW, 'global-color.png'));
  fs.writeFileSync(path.join(BUILT, 'global.json'), JSON.stringify(out));
  return out;
}
const downH = (h, W, H) => { const w = W/2, out = new Float32Array(w*H/2); for (let y=0;y<H/2;y++) for (let x=0;x<w;x++) out[y*w + x] = (h[2*y*W + 2*x] + h[2*y*W + 2*x + 1] + h[(2*y + 1)*W + 2*x] + h[(2*y + 1)*W + 2*x + 1])/4; return out; };

// ---------------------------------------------------------------- a place's layers
async function buildLayer(P, L){
  const N = L.px, mpp = L.size/N, F = frameAt(L.la, L.lo), box = bboxLL(L, 2*mpp);
  console.log(`  ${P.key} ${L.id}: ${L.size/1000} km, ${mpp.toFixed(2)} m a pixel`);
  const LA = new Float64Array(N*N), LO = new Float64Array(N*N);
  for (let j=0;j<N;j++) for (let i=0;i<N;i++){ const [la, lo] = planeToLL(F, (i + 0.5 - N/2)*mpp, (N/2 - j - 0.5)*mpp); LA[j*N + i] = la; LO[j*N + i] = lo; }
  // the heights: LOLA's (118 m) for the widest, else SLDEM2015 (59 m)
  const hs = mpp >= 300 ? await windowLL(await lola118(), box, mpp) : await mosaicLL(sldem(), box, Math.max(mpp, 59)), src = [];
  const h = new Float32Array(N*N); for (let k=0;k<N*N;k++){ const v = hs.atC(LA[k], LO[k]); h[k] = v === v ? v : NaN; }
  fillNaN(h, N, N); src.push(mpp >= 300 ? 'lola' : 'sldem');
  // the NAC terrain models where they are (their own heights, eased into the wider ones over 300 m at their edges)
  if (L.dtm && PDS) for (const rel of L.dtm){
    const g = await pds4(rel), s = await windowLL(g, box, Math.max(mpp, 2)), d = new Float32Array(N*N).fill(NaN);
    for (let k=0;k<N*N;k++) d[k] = s.atC(LA[k], LO[k]);
    const w = edgeWeight(d, N, Math.max(2, Math.round(300/mpp)));
    // (a model is tied to LOLA within a couple of metres; a mean offset left over is taken out on the wide layers so the edge does not step)
    let so = 0, sn = 0; for (let k=0;k<N*N;k++) if (d[k] === d[k] && w[k] > 0.99){ so += d[k] - h[k]; sn++; }
    const off = sn > 50 && mpp >= 20 ? so/sn : 0;
    for (let k=0;k<N*N;k++) if (d[k] === d[k]) h[k] = h[k]*(1 - w[k]) + (d[k] - off)*w[k];
    console.log(`    DTM ${path.basename(rel)}: covers ${(100*w.reduce((a, b) => a + (b > 0 ? 1 : 0), 0)/(N*N)).toFixed(0)}%${off ? `, ${off.toFixed(1)} m off the wider heights` : ''}`);
    src.push('dtm');
  }
  // the broad albedo, then the NAC's fine detail over it: each mosaic's brightness against its own mean within about 400 m (two box blurs)
  const b = await broadOf(box, mpp), A = new Float32Array(N*N), Rt = new Float32Array(N*N);
  for (let k=0;k<N*N;k++){ const [v, r] = b.at(LA[k], LO[k]); A[k] = v; Rt[k] = r; }
  fillNaN(A, N, N); src.push(STATE.src);
  const got = new Uint8Array(N*N), Dm = new Float32Array(N*N).fill(1);
  const imgs = [...(PDS ? (L.img || []).map(rel => ({ rel })) : []), ...(L.trek || []).map(layer => ({ layer }))];
  for (const im of imgs){
    const t = im.rel ? await windowLL(await pds4(im.rel), box, mpp) : await trekLL(im.layer, box, mpp), layer = im.rel ? path.basename(im.rel) : im.layer, d = new Float32Array(N*N).fill(NaN);
    for (let k=0;k<N*N;k++) if (!got[k]) d[k] = t.at(LA[k], LO[k]);
    const cov = d.map(v => v === v ? 1 : 0), w = edgeWeight(d, N, Math.max(2, Math.round(Math.min(300, L.size*0.02)/mpp)));
    const r = Math.max(1, Math.round(400/mpp/2)), m = blurMasked(d, cov, N, N, r);
    let used = 0;
    // (stronger than the image's own contrast: in characters a tenth brighter or darker is lost; ACCURACY.md)
    // (the detail multiplies the colour as shown, after the albedo's own curve: on the dark seas it was squeezed into a few grey levels. Its
    // strength is set so its spread is the same in every layer and from every source (DETAIL: the spread of the log of the brightness): Moon
    // Trek's mosaics come stretched for contrast, the archive's not, and a layer's texture jumped at the next one's edge)
    let s1 = 0, s2 = 0, sn = 0; for (let k=0;k<N*N;k++) if (cov[k] && m[k] > 0 && w[k] > 0.99){ const q = Math.log(clampN(d[k]/m[k], 0.2, 5)); s1 += q; s2 += q*q; sn++; }
    const sd = sn > 100 ? Math.sqrt(Math.max(s2/sn - (s1/sn)**2, 1e-6)) : 0.1, gain = clampN(DETAIL/sd, 0.3, 2.6);
    for (let k=0;k<N*N;k++) if (cov[k] && m[k] > 0){ Dm[k] *= Math.pow(clampN(d[k]/m[k], 0.35, 2.4), gain*w[k]); got[k] = w[k] > 0.99 ? 1 : 0; used++; }
    console.log(`    NAC ${layer}${t.z != null ? ' (zoom ' + t.z + ')' : ''}: covers ${(100*used/(N*N)).toFixed(0)}%, spread ${sd.toFixed(3)}, x${gain.toFixed(2)}`);
    if (used) src.push('nac');
  }
  const Rs = Rt.some(v => v > 0) ? blurMasked(Rt, Rt.map(v => v > 0 ? 1 : 0), N, N, 2) : Rt, rgb = Buffer.alloc(N*N*3);
  for (let k=0;k<N*N;k++){ const c = colourOf(A[k], Rs[k] > 0 ? Rs[k] : 0), q = clampN(Dm[k], 0.3, 2.6); rgb[k*3] = clampN(Math.round(c[0]*q), 0, 255); rgb[k*3 + 1] = clampN(Math.round(c[1]*q), 0, 255); rgb[k*3 + 2] = clampN(Math.round(c[2]*q), 0, 255); }
  const col = await encodeColour(N, N, rgb), eh = await encodeHeights(N, N, h, mpp);
  const cf = save(`${P.key}-${L.id}-c`, col), hf = save(`${P.key}-${L.id}-h`, eh.webp);
  console.log(`    colour ${(col.length/1e6).toFixed(2)} MB, heights ${(eh.webp.length/1e6).toFixed(2)} MB, ${eh.low} to ${eh.top} m`);
  // (the height under the layer's middle, for the place itself)
  const hMid = h[(N/2)*N + N/2];
  return { rec:{ id:L.id, la:L.la, lo:L.lo, size:L.size, px:N, color:cf, height:hf, base:eh.base, step:eh.step, top:eh.top, low:eh.low, src:[...new Set(src)], bytes:col.length + eh.webp.length },
    hMid, prev:await preview(N, rgb, h, mpp) };
}
// NaN holes filled from their neighbours, wider and wider
function fillNaN(a, W, H){
  let left = 0; for (const v of a) if (v !== v) left++;
  for (let pass=0;pass<256 && left;pass++){ const b = a.slice();
    for (let j=0;j<H;j++) for (let i=0;i<W;i++){ const k = j*W + i; if (a[k] === a[k]) continue; let s = 0, n = 0;
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]){ const ii = (i + di + W) % W, jj = j + dj; if (jj < 0 || jj >= H) continue; const v = a[jj*W + ii]; if (v === v){ s += v; n++; } }
      if (n){ b[k] = s/n; left--; } }
    a.set(b); }
  if (left) for (let k=0;k<a.length;k++) if (a[k] !== a[k]) a[k] = 0;
}
// how far inside its data each pixel is, 0 at the edge to 1 at r pixels in
function edgeWeight(d, N, r){ const cov = new Float32Array(N*N); for (let k=0;k<N*N;k++) cov[k] = d[k] === d[k] ? 1 : 0;
  const b = blurMasked(cov, new Float32Array(N*N).fill(1), N, N, r); for (let k=0;k<N*N;k++) b[k] = cov[k] ? clampN((b[k] - 0.5)*2, 0, 1) : 0; return b; }
// the mean of a over a (2r+1) square, counting only where m is set (twice: softer)
function blurMasked(a, m, W, H, r){
  let v = new Float32Array(W*H), w = new Float32Array(W*H);
  for (let k=0;k<W*H;k++){ const ok = m[k] && a[k] === a[k]; v[k] = ok ? a[k] : 0; w[k] = ok ? 1 : 0; }
  for (let pass=0;pass<2;pass++) for (const horiz of [true, false]){
    const nv = new Float32Array(W*H), nw = new Float32Array(W*H), len = horiz ? W : H, lines = horiz ? H : W;
    for (let j=0;j<lines;j++){ let sv = 0, sw = 0; const at = i => horiz ? j*W + i : i*W + j;
      for (let i=-r;i<len + r;i++){
        if (i + r >= 0 && i + r < len){ const q = at(i + r); sv += v[q]; sw += w[q]; }
        if (i - r - 1 >= 0 && i - r - 1 < len){ const q = at(i - r - 1); sv -= v[q]; sw -= w[q]; }
        if (i >= 0 && i < len){ nv[at(i)] = sv; nw[at(i)] = sw; } } }
    v = nv; w = nw; }
  const out = new Float32Array(W*H); for (let k=0;k<W*H;k++) out[k] = w[k] > 1e-6 ? v[k]/w[k] : NaN; return out;
}
async function buildPlace(P){
  console.log(P.name);
  const layers = [], prev = []; let h0 = null;
  for (const L0 of P.layers){ const L = Object.assign({ la:P.la, lo:P.lo }, L0), b = await buildLayer(P, L); layers.push(b.rec); prev.push(b.prev); if (L.la === P.la && L.lo === P.lo) h0 = b.hMid; }
  await sheet(P.key, prev);
  const rec = { key:P.key, name:P.name, la:P.la, lo:P.lo, h0:h0 == null ? null : +h0.toFixed(1), top:Math.max(...layers.map(L => L.top)), layers };
  fs.writeFileSync(path.join(BUILT, P.key + '.json'), JSON.stringify(rec));
  return rec;
}

// ---------------------------------------------------------------- the manifest
async function writeManifest(){
  const g = fs.existsSync(path.join(BUILT, 'global.json')) ? JSON.parse(fs.readFileSync(path.join(BUILT, 'global.json'), 'utf8')) : null;
  const sites = PLACES.map(P => path.join(BUILT, P.key + '.json')).filter(f => fs.existsSync(f)).map(f => JSON.parse(fs.readFileSync(f, 'utf8')));
  // (how bright each layer's ground is: the mean of its middle half, as the colour files hold it; the ground's exposure aims at the layer
  // that holds the view, and a place's own is its 100 km layer's)
  for (const S of sites){ for (const L of S.layers){ const f = path.join(OUT, L.color); if (!fs.existsSync(f)) continue;
      const { data, info } = await sharp(f).removeAlpha().raw().toBuffer({ resolveWithObject:true }), N = info.width; let a = 0, n = 0;
      for (let j=N/4;j<N*3/4;j++) for (let i=N/4;i<N*3/4;i++){ const k = (j*N + i)*3; a += (0.2126*data[k] + 0.7152*data[k + 1] + 0.0722*data[k + 2])/255; n++; }
      L.alb = +(a/n).toFixed(3); }
    S.alb = (S.layers.find(l => l.id === 'r102') || S.layers[0]).alb; }
  const made = new Date().toISOString().slice(0, 10);
  const bytes = (g ? [...g.color, ...g.height].filter(x => x.w === 4096).reduce((a, x) => a + x.bytes, 0) : 0) + sites.reduce((a, S) => a + S.layers.reduce((b, L) => b + L.bytes, 0), 0);
  const js = `// generated by tools/moon-detail.mjs on ${made}: do not edit by hand. The real Moon (m1-moon-map.js, m3-moon-detail.js draw it): the whole Moon's map
// (equirectangular, east longitude from -180) and each place's layers, squares <size> m across centred on <la, lo> in the orthographic projection of
// the 1,737.4 km sphere. Colour files are the albedo in display terms; height files hold metres above that sphere as base + (R*256 + G) x step.
// About ${(bytes/1e6).toFixed(1)} MB in all (the 4096 map and every layer), loaded only near the Moon and near a place.
const MOON_DETAIL = ${JSON.stringify({ made, global:g, sites })};
`;
  fs.writeFileSync(path.join(ROOT, 'src', 'objects', 'm0-moon-detail-data.js'), js);
  console.log(`manifest: ${sites.length} places, ${(bytes/1e6).toFixed(1)} MB of images`);
}

// ---------------------------------------------------------------- run
const args = process.argv.slice(2);
if (args.includes('--manifest')){ await writeManifest(); process.exit(0); }
const want = args.filter(a => !a.startsWith('--'));
if (!want.length || want.includes('global')) await buildGlobal();
else if (fs.existsSync(path.join(BUILT, 'global.json'))){ const g = JSON.parse(fs.readFileSync(path.join(BUILT, 'global.json'), 'utf8')); Object.assign(STATE, { src:g.src, lo:g.lo, hi:g.hi, tint:g.tint }); }
for (const P of PLACES) if (!want.length || want.includes(P.key)) await buildPlace(P);
await writeManifest();

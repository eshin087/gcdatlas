// The link previews (og:image, 1200 x 630): what a shared link to gcdatlas shows in a chat or a post.
//   node tools/og-image.mjs [--at=sgra:1,helix:0] candidates into tests/out/og/ (+ a contact sheet)
//   node tools/og-image.mjs --pick=sgra:0        render one and write assets/og.jpg (the site's own card; build.mjs copies it to dist/og.jpg)
//   node tools/og-image.mjs --all                every place with a share page (dist/p/<key>, build.mjs): writes tools/data/share-meta.json,
//                                                draws assets/og/<key>.jpg for the pictures that are missing (--force draws them all again,
//                                                --only=a,b a few), prunes pictures of places that are gone, sheet in tests/out/og/all-sheet.jpg
//   node tools/og-image.mjs --meta               only refresh tools/data/share-meta.json (after a content pack, before the pictures)
//   --wait=6000                                  how long to let a view settle before the still
// Drawn on the real GPU (--use-angle=d3d11, as tools/lab-shots.mjs), with the interface hidden and the name and address set in the
// page's own type over a dark band at the bottom. dist/ is served over http because the Earth's tiles, the global maps and a famous
// place's layers only load over http(s); a famous place is shot at the day its flight would pick (plc.sunFor), once its layers are in.
import { chromium } from 'playwright';
import sharp from 'sharp';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist'), OUT = path.join(ROOT, 'tests', 'out', 'og'), OG = path.join(ROOT, 'assets', 'og');
const META = path.join(ROOT, 'tools', 'data', 'share-meta.json');
const arg = (k, d) => { const a = process.argv.find(a => a.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : d; };
const has = k => process.argv.includes(`--${k}`);
const pick = arg('pick', null), wait = +arg('wait', 6000), ALL = has('all'), METAONLY = has('meta'), FORCE = has('force');
const only = (arg('only', '') || '').split(',').filter(Boolean);
// the view each place's picture uses (0 unless another angle reads better; the site's own card is --pick's choice)
const HERO = { m87bh:2 };
const W = 1200, H = 630;
if (!fs.existsSync(path.join(DIST, 'index.html'))) throw new Error('build first: node build.mjs');
fs.mkdirSync(OUT, { recursive:true });

// dist over http (as tests/earth.mjs): a file:// page loads no Earth tiles, layers or global maps
const TYPES = { '.html':'text/html', '.js':'text/javascript', '.json':'application/json', '.webp':'image/webp', '.jpg':'image/jpeg', '.png':'image/png' };
const server = http.createServer((q, r) => {
  let p = decodeURIComponent(q.url.split('?')[0]); if (p === '/') p = '/index.html';
  const f = path.join(DIST, p); if (!f.startsWith(DIST) || !fs.existsSync(f) || fs.statSync(f).isDirectory()){ r.writeHead(404); r.end(); return; }
  r.writeHead(200, { 'Content-Type':TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r);
}).listen(0);

const browser = await chromium.launch({ args:['--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu'] });
const page = await (await browser.newContext({ viewport:{ width:W, height:H } })).newPage();
await page.addInitScript(() => { window.__noAdapt = true; window.__syncCompile = true;
  try { localStorage.setItem('gcdatlas.dailySeen', JSON.stringify(new Date().toISOString().slice(0, 10))); localStorage.setItem('gcdatlas.settings', JSON.stringify({ fadeUI:'off' })); } catch (e) {} });
await page.goto(`http://127.0.0.1:${server.address().port}/`);
await page.waitForFunction(() => window.__cosmos && window.__cosmos.OBJ, null, { timeout:60000 });
// only the characters: photo mode hides the interface, and its own bar goes too
await page.evaluate(() => { window.__cosmos.startPhoto(); const s = document.createElement('style'); s.textContent = '#photoBar,.toast,.hint{display:none!important}'; document.head.appendChild(s); });

const bx = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
// a long name takes the whole subtitle line, or it runs into the address on the right (Mount Everest and the Himalaya did)
const band = name => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#04050a" stop-opacity="0"/><stop offset="1" stop-color="#04050a" stop-opacity="0.92"/></linearGradient></defs>
  <rect x="0" y="${H - 190}" width="${W}" height="190" fill="url(#g)"/>
  <text x="56" y="${H - 86}" font-family="IBM Plex Mono, Consolas, monospace" font-size="54" font-weight="600" fill="#e2e8f5">gcdatlas</text>
  <text x="58" y="${H - 44}" font-family="IBM Plex Mono, Consolas, monospace" font-size="26" fill="#c3cbe0">${bx(name && name.length > 17 ? name : 'the real universe, drawn in ASCII' + (name ? ' · ' + name : ''))}</text>
  <text x="${W - 56}" y="${H - 44}" text-anchor="end" font-family="IBM Plex Mono, Consolas, monospace" font-size="26" fill="#ffb35c">gcdatlas.com</text>
</svg>`);

async function snap(k, v){
  const own = await page.evaluate(([k, v]) => { const c = window.__cosmos, o = c.BYKEY[k];
    c.setTour(false);
    if (o.own){ const d = c.plc.sunFor(o, +v); if (d != null) c.setDays(d); c.tick(0); }
    c.view(k, +v); return !!o.own; }, [k, v]);
  if (own){
    const pk = k.replace('earth-iconic-', '');
    await page.waitForFunction(pk => { const d = window.__cosmos.plc.dbg(), L = d.layers.find(s => s.startsWith(pk + ' '));
      const [a, b] = (L ? L.split(' ')[1] : '0/1').split('/'); return (d.env || '').includes(pk) || +a >= +b; }, pk, { timeout:25000 }).catch(() => {});
    await page.waitForTimeout(Math.max(wait, 5000));
  } else await page.waitForTimeout(wait);
  return page.screenshot();
}
// how much light the picture's middle holds (the band comes after): the empty sky's JPEG-black reads about 7
const central = async raw => { const s = await sharp(raw).extract({ left:300, top:115, width:600, height:400 }).stats(); return (s.channels[0].mean + s.channels[1].mean + s.channels[2].mean)/3; };

let targets, sheetAll = null;
if (ALL || METAONLY){
  // the list of share pages comes from the page itself (dbg.shareList: the atlas's places and the famous places on Earth), so the
  // pages, the share button and this tool can never disagree about who has one
  const list = await page.evaluate(() => window.__cosmos.dbg.shareList().map(e => ({ key:e.key, name:e.name, fact:(e.fact || '').replace(/\s+/g, ' ').trim(), views:(window.__cosmos.BYKEY[e.key].views || []).length })));
  fs.writeFileSync(META, JSON.stringify(list.map(({ key, name, fact }) => ({ key, name, fact })), null, 1));
  console.log(`tools/data/share-meta.json: ${list.length} places`);
  if (METAONLY){ await browser.close(); server.close(); process.exit(0); }
  fs.mkdirSync(OG, { recursive:true });
  for (const f of fs.readdirSync(OG)) if (f.endsWith('.jpg') && !list.some(e => e.key + '.jpg' === f)){ fs.rmSync(path.join(OG, f)); console.log('pruned ' + f); }
  targets = list.filter(e => !only.length || only.includes(e.key))
    .filter(e => FORCE || only.includes(e.key) || !fs.existsSync(path.join(OG, e.key + '.jpg')))
    .map(e => ({ key:e.key, view:HERO[e.key] || 0, views:e.views || 1, name:e.name, file:path.join(OG, e.key + '.jpg') }));
  sheetAll = list.map(e => path.join(OG, e.key + '.jpg'));
  console.log(`${targets.length} pictures to draw`);
} else {
  targets = (pick || arg('at', null) || 'sgra:0,m87bh:0,saturn:0,helix:0,milkyway:0,andromeda:1').split(',').map(s => s.split(':'))
    .map(([k, v = '0']) => ({ key:k, view:+v, file:path.join(OUT, `${k}_${v}.jpg`) }));
}

const bad = [], files = [];
for (let i = 0; i < targets.length; i++){
  const t = targets[i];
  const name = t.name || await page.evaluate(k => (window.__cosmos.BYKEY[k] || {}).name || k, t.key);
  try {
    let raw = await snap(t.key, t.view), used = t.view;
    // a card whose middle is nearly empty tries the place's other angles and keeps the lightest (Io's first angle faced the night side)
    if (ALL && (t.views || 1) > 1){
      let m = await central(raw);
      if (m < 8) for (let v = 0; v < Math.min(t.views, 4); v++){ if (v === t.view) continue;
        const r2 = await snap(t.key, v), m2 = await central(r2);
        if (m2 > m + 0.3){ raw = r2; m = m2; used = v; } }
    }
    await sharp(raw).composite([{ input:band(pick ? '' : name) }]).jpeg({ quality:86, mozjpeg:true }).toFile(t.file);
    files.push(t.file);
    console.log(`${t.key}:${used}${used !== t.view ? ' (lightest angle)' : ''} -> ${path.relative(ROOT, t.file)} (${(fs.statSync(t.file).size/1024).toFixed(0)} KB${ALL ? `, ${i + 1}/${targets.length}` : ''})`);
  } catch (e){ bad.push(t.key); console.error(`${t.key}: ${e.message.split('\n')[0]}`); }
}
await browser.close(); server.close();

if (pick){
  const dst = path.join(ROOT, 'assets', 'og.jpg'); fs.copyFileSync(files[0], dst);
  console.log(`wrote assets/og.jpg (${(fs.statSync(dst).size/1024).toFixed(0)} KB)`);
} else if (ALL){
  const have = sheetAll.filter(f => fs.existsSync(f));
  const cw = 300, ch = 158, cols = 4, rows = Math.ceil(have.length/cols);
  const tiles = await Promise.all(have.map(async (f, i) => ({ input:await sharp(f).resize(cw, ch).toBuffer(), left:(i % cols)*cw, top:Math.floor(i/cols)*ch })));
  await sharp({ create:{ width:cw*cols, height:ch*Math.max(rows, 1), channels:3, background:'#000' } }).composite(tiles).jpeg({ quality:80 }).toFile(path.join(OUT, 'all-sheet.jpg'));
  const mb = have.reduce((s, f) => s + fs.statSync(f).size, 0)/1048576;
  console.log(`contact sheet: tests/out/og/all-sheet.jpg · ${have.length} pictures, ${mb.toFixed(1)} MB in assets/og/`);
} else {
  const cw = 600, ch = 315, cols = 2, rows = Math.ceil(files.length/cols);
  const tiles = await Promise.all(files.map(async (f, i) => ({ input:await sharp(f).resize(cw, ch).toBuffer(), left:(i % cols)*cw, top:Math.floor(i/cols)*ch })));
  await sharp({ create:{ width:cw*cols, height:ch*rows, channels:3, background:'#000' } }).composite(tiles).jpeg({ quality:85 }).toFile(path.join(OUT, 'sheet.jpg'));
  console.log('contact sheet: tests/out/og/sheet.jpg');
}
if (bad.length){ console.error(`failed: ${bad.join(', ')}`); process.exit(1); }

// The link previews (og:image, 1200 x 630): what a shared link to gcdatlas shows in a chat or a post.
//   node tools/og-image.mjs [--at=sgra:1,helix:0] candidates into tests/out/og/ (+ a contact sheet)
//   node tools/og-image.mjs --pick=sgra:0        render one and write assets/og.jpg (the site's own card; build.mjs copies it to dist/og.jpg)
//   node tools/og-image.mjs --all                every place with a share page (dist/p/<key>, build.mjs): writes tools/data/share-meta.json,
//                                                draws assets/og/<key>.jpg for the pictures that are missing (--force draws them all again,
//                                                --only=a,b a few), prunes pictures of places that are gone, sheet in tests/out/og/all-sheet.jpg
//   node tools/og-image.mjs --meta               only refresh tools/data/share-meta.json (after a content pack, before the pictures)
//                                                share-meta.json also holds what each place's own page says (0.24.1: /places/<key>, build.mjs):
//                                                its kind, catalogue numbers, distance, size and the panel's numbers, read from the page
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

// ---------------------------------------------------------------- what each place's page says (0.24.1, /places/<key>, written by build.mjs)
// Read in the page, with the atlas's own formatters (dbg), so a page says what the info panel and the atlas list say. Runs in the page.
function placeText(MADE_UP){
  const c = window.__cosmos, d = c.dbg, B = c.BYKEY, LY = 9.4607e12;
  const KINDS = d.CATS.filter(([id]) => id !== 'all'), kindIds = new Set(KINDS.map(k => k[0]));
  const list = d.shareList(), keys = new Set(list.map(e => e.key));
  const objOf = p => typeof p === 'string' ? B[p] : p || null;
  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  const ly = s => s.replace(/\bly\b/g, 'light-years');
  const fmtCode = s => s.replace(/^(m|ngc|ic)(\d+)([a-z]?)$/, (x, p, n, l) => (p === 'm' ? 'M' : p.toUpperCase() + ' ') + n + l.toUpperCase());
  // catalogue numbers of things drawn but left out of the atlas (M32 and M110 with Andromeda, the Quintet's galaxies, NGC 6603 in M24) are
  // drawn with the place whose aka carries them, and so is the NGC or IC number written right after such a Messier number ("m32 ngc 221")
  const hidden = new Set();
  for (const o of c.OBJ) if (!o.marker && o.atlas === false && d.GROUPS.some(([g]) => g === o.group))
    for (const k of d.catSplit(o.key + ' ' + o.name + ' ' + (o.aka || '')).codes) hidden.add(k);
  const holeProg = B.sgra && B.sgra.prog;   // (the black holes' program: their size is the event horizon, as atlasSize has it)
  const places = list.map(e => {
    const o = B[e.key], own = !!o.own, made = MADE_UP.includes(o.key), par = objOf(o.parent);
    const raw = d.catSplit(o.aka || '').codes, seen = new Set(), codes = [], drawnWith = [];
    for (let i = 0; i < raw.length; i++){
      const k = raw[i]; if (seen.has(k)) continue; seen.add(k);
      if (!hidden.has(k)){ codes.push(fmtCode(k)); continue; }
      let s = fmtCode(k); const nx = raw[i + 1];
      if (/^m\d/.test(k) && nx && /^(ngc|ic)\d/.test(nx) && !hidden.has(nx) && !seen.has(nx)){ s += ' (' + fmtCode(nx) + ')'; seen.add(nx); i++; }
      drawnWith.push(s);
    }
    for (const m of new Set((o.aka || '').toLowerCase().match(/(?<![\w+\-\/.])c\d{1,3}(?![\w+\-])/g) || [])) codes.push('Caldwell ' + m.slice(1));
    // where it is: the line under the name in the info panel (syncWhere), and for the Solar System and the comets the atlas's number,
    // from the Sun or a moon from its planet (rowSun); "today" goes, since the page gives the day its numbers are from
    const de = (o.distEarth || '').replace(/ today$/, '').replace(/^here on Earth$/, 'on Earth');
    // (Earth has none: its type already says home, and its distance from the Sun is in the list of facts)
    const where = o.key === 'earth' ? null : ly(de ? de + (/away|here|around|from|edge|centre|inside|on Earth/.test(de) ? '' : ' away') : d.distFromEarth(o));
    let fromSun = null;
    if (d.FROM_SUN.includes(o.group) && o.key !== 'sun' && d.sunDist(o) > 1e-9){
      if (o.group === 'solar' && par && par !== B.sun && par.group === 'solar') fromSun = d.fmtDist(dist(o.pos, par.pos)) + ' from ' + par.name.replace(/^the /, '');
      else fromSun = / from the Sun$/.test(o.distEarth || '') ? o.distEarth : d.sunAU(d.sunDist(o)) + ' from the Sun';
      fromSun = ly(fromSun); if (where && where.includes(fromSun)) fromSun = null;
    }
    // its true size across, only where the atlas has it measured (a black hole's event horizon, a star's surface, a solid body, a cluster's
    // stars): elsewhere the atlas's number is the drawn extent, and the panel's own numbers say how big it is. Not for a comet or a meteor
    // stream (their size is how they are drawn) or an explosion or collision (a moment of a replay)
    const hole = !!holeProg && o.prog === holeProg, cats = d.catsOf(o);
    const r = own || made || o.group === 'comets' || cats.includes('events') ? 0 : hole ? o.rad/20 : (o.sizeR || (o.starR ? o.starR*o.rad : o.solid ? o.rad*o.solid : 0));
    let ro = ''; try { ro = o.readout ? String(o.readout()) : ''; } catch (err) {}
    // the order of the list of places: as the atlas lists them, near to far, from the Sun in the Solar System (a moon right after its planet)
    const rank = own ? 0 : d.FROM_SUN.includes(o.group) ? (o.group === 'solar' && par && par !== B.sun && par.group === 'solar' ? d.sunDist(par) + dist(o.pos, par.pos)*1e-6 : d.sunDist(o)) : d.earthDist(o);
    return { key:o.key, name:o.name, fact:(e.fact || '').replace(/\s+/g, ' ').trim(), type:(o.type || '').replace(/\s+/g, ' ').trim(),
      group:own ? 'earth' : o.group, kinds:own ? ['earth'] : cats.filter(k => kindIds.has(k)), madeUp:made || undefined,
      // (the made-up ship roams: where it is now says nothing on a page)
      codes, drawnWith, where:made ? null : where, fromSun, size:r > 0 ? ly(d.fmtLen(2*r*LY, 3)) + (hole ? ' across (event horizon)' : ' across') : null,
      readout:made ? ro.split('\n').filter(l => /made up/.test(l)).join('\n') : ro,
      parent:par && keys.has(par.key) && !made ? par.key : null,
      // (numbers that move with time: the Solar System's distances, the comets', the craft's)
      moving:!own && !made && (d.FROM_SUN.includes(o.group) || o.group === 'travel'),
      at:own && o.place ? [+o.place.la0.toFixed(4), +o.place.lo0.toFixed(4)] : undefined,
      rank, distLy:d.earthDist(o), views:(o.views || []).length };
  });
  return { groups:d.GROUPS, kinds:Object.fromEntries(KINDS.map(([id, , many, one, head]) => [id, [one, many, head]])), places };
}
// the panel's numbers on a page that stays as it is: what only the live atlas can say goes (a countdown or a simulation's clock, a visit
// counter, live data that did not load, what to click), and so does "in 9 days" before a date. Lines that say how the atlas draws or speeds
// up a place stay ("sped up here", "drawn as ..."): the page shows its picture, and its link opens the atlas
const LIVE = [/^(core collapse|next nova|starquake|merger) in [\d.]+ s\b/, /^t = [+-]?[\d.]+ Myr$/, /^\d+ of \d+ fragments have hit$/, /^visit \d+$/, /^roaming round /, /^typical orbit\b/, /^pick it to /, /^weather now\b/];
const TRIM = [[/\s*\(year [\d.]+\)/g, ''], [/: in \d+ days?\b/g, ''], [/\bin \d+ days?, on /g, 'on ']];
const liveFree = t => String(t || '').split('\n').map(line => { let s = line; for (const [a, b] of TRIM) s = s.replace(a, b);
  return s.split(' · ').map(x => x.trim()).filter(x => x && !LIVE.some(re => re.test(x))).join(' · '); }).filter(Boolean);
// the only made-up place (its fact and readout say so): no size, no parent (it roams), only the readout's line that says it is made up
const MADE_UP = ['halo'];

let targets, sheetAll = null;
if (ALL || METAONLY){
  // the list of share pages comes from the page itself (dbg.shareList: the atlas's places and the famous places on Earth), so the
  // pages, the share button and this tool can never disagree about who has one
  const data = await page.evaluate(placeText, MADE_UP);
  const list = data.places;
  for (const p of list) p.readout = liveFree(p.readout);
  const now = new Date(), made = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;   // (the day here)
  fs.writeFileSync(META, JSON.stringify({ made, groups:data.groups, kinds:data.kinds, places:list.map(({ views, ...p }) => p) }, null, 1));
  console.log(`tools/data/share-meta.json: ${list.length} places (their text as on ${made})`);
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

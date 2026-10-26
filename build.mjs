// gcdatlas build: concatenates src/ into one self-contained page.
//   dist/index.html     the website (Vercel serves this)
//   dist/artifact.html  the same page without the document wrapper (for a claude.ai artifact)
//   dist/preview.html   only the head's tags, for link-preview bots (vercel.json)
// Usage: node build.mjs            (no dependencies; Node 18+)
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(ROOT, 'src'), DIST = path.join(ROOT, 'dist');
const read = f => fs.readFileSync(path.join(SRC, f), 'utf8');

// Script order: core, shared GLSL, world + registry, data, context layers (06*), objects (o*), extras (07*), camera (08), render + UI (09).
// Objects in src/objects/ (optional subfolder) load after the o* files, in name order.
const rank = f => {
  if (f.startsWith('objects/')) return 55;
  if (/^o\d/.test(f)) return 50;
  const n = parseInt(f, 10);
  return n === 6 ? 40 : n === 7 ? 60 : n === 8 ? 70 : n === 9 ? 80 : n;
};
const list = fs.readdirSync(SRC).filter(f => f.endsWith('.js'));
if (fs.existsSync(path.join(SRC, 'objects'))) for (const f of fs.readdirSync(path.join(SRC, 'objects'))) if (f.endsWith('.js')) list.push('objects/' + f);
list.sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));

const js = list.map(f => `\n// ---- ${f}\n` + read(f)).join('');
try { new vm.Script(js, { filename: 'gcdatlas.js' }); }
catch (e) { console.error('Syntax error in the bundled script:\n' + e.stack.split('\n').slice(0, 6).join('\n')); process.exit(1); }
// every file shares one scope: two top-level functions with one name are not a syntax error, the later one silently replaces the first
// (the ride camera's shotPose once replaced the launch camera's, and the flight to a rocket came out as NaN)
{ const seen = new Map(), dup = [];
  for (const f of list) for (const m of read(f).matchAll(/^(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/gm)){ if (seen.has(m[1])) dup.push(`${m[1]} (${seen.get(m[1])} and ${f})`); else seen.set(m[1], f); }
  if (dup.length){ console.error('The same top-level function name in two places:\n  ' + dup.join('\n  ')); process.exit(1); } }

// the Earth's images (tools/earth-*.mjs) are served next to the page, never inside it: dist/earth/, folders and all (the tiles live in a
// folder named after their set, 0.12.0); whatever is no longer in assets/earth goes
function syncDir(src, dst){
  fs.mkdirSync(dst, { recursive:true });
  const want = new Map(fs.readdirSync(src, { withFileTypes:true }).map(e => [e.name, e.isDirectory()]));
  for (const e of fs.readdirSync(dst, { withFileTypes:true })) if (want.get(e.name) !== e.isDirectory()) fs.rmSync(path.join(dst, e.name), { recursive:true, force:true });
  for (const [f, dir] of want){ const a = path.join(src, f), b = path.join(dst, f);
    if (dir) syncDir(a, b); else if (!fs.existsSync(b) || fs.statSync(b).size !== fs.statSync(a).size) fs.copyFileSync(a, b); }
}
{ const src = path.join(ROOT, 'assets', 'earth'); if (fs.existsSync(src)) syncDir(src, path.join(DIST, 'earth')); }
// the link preview (og:image, 1200 x 630, made by tools/og-image.mjs): what a shared link shows in a chat or a post
fs.mkdirSync(DIST, { recursive: true });
fs.copyFileSync(path.join(ROOT, 'assets', 'og.jpg'), path.join(DIST, 'og.jpg'));
// every place's own picture (npm run og -- --all), served under /og/ for the share pages below
{ const src = path.join(ROOT, 'assets', 'og'); if (fs.existsSync(src)) syncDir(src, path.join(DIST, 'og')); }
const head = read('00-head.html');
// what's new: docs/PATCHNOTES.md ("## version · date · title", then "- " bullets) as the panel's HTML, newest first and open
const esc = t => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const notes = [];
for (const line of fs.readFileSync(path.join(ROOT, 'docs', 'PATCHNOTES.md'), 'utf8').replace(/<!--[\s\S]*?-->/g, '').split(/\r?\n/)){
  const h = line.match(/^## (\S+) · ([^·]+?) · (.+)$/), b = line.match(/^- (.+)$/);
  if (h) notes.push({ v:h[1], date:h[2].trim(), title:h[3].trim(), items:[] });
  else if (b && notes.length) notes[notes.length - 1].items.push(b[1].trim());
}
if (!notes.length){ console.error('docs/PATCHNOTES.md has no versions'); process.exit(1); }
const notesHtml = notes.map((n, i) => `<details data-v="${esc(n.v)}"${i ? '' : ' open'}><summary><span class="nv">${esc(n.v)}</span><span class="nd">${esc(n.date)}</span><span class="nt">${esc(n.title)}</span></summary><ul>${n.items.map(t => `<li>${esc(t)}</li>`).join('')}</ul></details>`).join('\n');
const body = read('01-body.html').replace('<!--PATCHNOTES-->', notesHtml);
const version = new Date().toISOString().slice(0, 10);
const script = `<script>\n/* gcdatlas ${version} */\n${js}\n</script>\n`;

const meta = `<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="description" content="An explorable universe drawn entirely in ASCII: real planets, stars, nebulae, black holes and galaxies at their true positions, with seamless zoom from Earth to the edge of the observable universe.">
<meta name="theme-color" content="#04050a">
<meta property="og:title" content="gcdatlas">
<meta property="og:site_name" content="gcdatlas">
<meta property="og:description" content="The real universe, drawn entirely in ASCII. Zoom from Earth to the edge of the observable universe.">
<meta property="og:type" content="website">
<meta property="og:url" content="https://gcdatlas.com/">
<meta property="og:image" content="https://gcdatlas.com/og.jpg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="M87*, a black hole with its glowing disc bent round its shadow, drawn in ASCII characters">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="gcdatlas">
<meta name="twitter:description" content="The real universe, drawn entirely in ASCII. Zoom from Earth to the edge of the observable universe.">
<meta name="twitter:image" content="https://gcdatlas.com/og.jpg">
<link rel="canonical" href="https://gcdatlas.com/">
<link rel="icon" href="data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="6" fill="#04050a"/><text x="16" y="23" font-family="monospace" font-size="22" font-weight="700" text-anchor="middle" fill="#ffb35c">*</text></svg>')}">
`;

// per-place share pages (0.24.0): /p/<key>, about 1.4 KB, served to everyone alike (no user-agent sniffing: the script sends people
// straight on into the atlas with whatever camera the query carries, and a preview bot only reads the tags). Made from
// tools/data/share-meta.json (`npm run og -- --all`; `--meta` refreshes the list alone after a content pack), with the place's own
// picture when assets/og/<key>.jpg exists, else the site's og.jpg. On a Vercel preview the tags carry the deployment's own address,
// so /p links pasted during review unfurl from the preview itself.
const HOST = process.env.VERCEL_ENV && process.env.VERCEL_ENV !== 'production' && process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://gcdatlas.com';
let shareKeys = [];
const metaFile = path.join(ROOT, 'tools', 'data', 'share-meta.json');
if (fs.existsSync(metaFile)){
  const places = JSON.parse(fs.readFileSync(metaFile, 'utf8'));
  const escA = s => esc(s).replace(/"/g, '&quot;');
  // a card shows about two sentences: cut a long fact at a sentence end (the Halo's runs to 640 characters)
  const short = s => { if (s.length <= 240) return s; const c = s.slice(0, 240), i = Math.max(c.lastIndexOf('. '), c.lastIndexOf('! ')); return i > 80 ? c.slice(0, i + 1) : c.slice(0, c.lastIndexOf(' ')); };
  const icon = meta.match(/<link rel="icon"[^>]*>/)[0];
  const pDir = path.join(DIST, 'p'); fs.mkdirSync(pDir, { recursive:true });
  for (const f of fs.readdirSync(pDir)) if (!places.some(e => e.key + '.html' === f)) fs.rmSync(path.join(pDir, f));
  for (const e of places){
    if (!/^[a-z0-9-]+$/.test(e.key)){ console.error('share-meta.json: a key that cannot be a path: ' + e.key); process.exit(1); }
    const name = escA(e.name), fact = escA(short(e.fact || 'The real universe, drawn entirely in ASCII.'));
    const img = HOST + (fs.existsSync(path.join(ROOT, 'assets', 'og', e.key + '.jpg')) ? `/og/${e.key}.jpg` : '/og.jpg');
    fs.writeFileSync(path.join(pDir, e.key + '.html'), `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${name} · gcdatlas</title>
<meta name="description" content="${fact}">
<meta name="theme-color" content="#04050a">
<meta property="og:title" content="${name}">
<meta property="og:site_name" content="gcdatlas">
<meta property="og:description" content="${fact}">
<meta property="og:type" content="website">
<meta property="og:url" content="${HOST}/p/${e.key}">
<meta property="og:image" content="${img}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="${name}, drawn in ASCII characters">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${name}">
<meta name="twitter:description" content="${fact}">
<meta name="twitter:image" content="${img}">
<link rel="canonical" href="${HOST}/p/${e.key}">
${icon}
<script>location.replace('/#' + (location.search.length > 1 ? 'o=${e.key}&' + location.search.slice(1) : 'o=${e.key}'))</script>
<noscript><meta http-equiv="refresh" content="0;url=/#o=${e.key}"></noscript>
</head>
<body>
<h1>${name}</h1>
<p>${fact}</p>
<p><a href="/#o=${e.key}">open ${name} in gcdatlas</a></p>
</body>
</html>
`);
  }
  shareKeys = places.map(e => e.key);
  console.log(`share pages: ${places.length} under dist/p/`);
} else console.warn('tools/data/share-meta.json is missing: no /p share pages (npm run og -- --all writes it)');
// the page learns which share pages exist (share() falls back to a #-link for the rest); the artifact build gets none, since it is
// served alone, away from dist/
const shareScript = `<script>window.__SHARE_PAGES=${JSON.stringify(shareKeys)};</script>\n`;

fs.mkdirSync(DIST, { recursive: true });
fs.writeFileSync(path.join(DIST, 'index.html'), `<!doctype html>\n<html lang="en">\n<head>\n${meta}${head}\n</head>\n<body>\n${body}\n${shareScript}${script}</body>\n</html>\n`);
fs.writeFileSync(path.join(DIST, 'artifact.html'), `${head}\n${body}\n${script}`);
// the lab (/lab): the same page, told before its script runs to open as a small stage for trying the Halo's looks (src/09l-lab.js); kept out of search
const labHead = head.replace(/<title>[^<]*<\/title>/, '<title>gcdatlas lab</title>');
fs.writeFileSync(path.join(DIST, 'lab.html'), `<!doctype html>\n<html lang="en">\n<head>\n${meta}<meta name="robots" content="noindex">\n${labHead}\n</head>\n<body>\n${body}\n<script>window.__LAB = 1;</script>\n${shareScript}${script}</body>\n</html>\n`);
// the song review page (/songs): the same page, told before its script runs to list every candidate song of the radio, to play
// and mark keep or drop (src/09s-songs.js); kept out of search
const songsHead = head.replace(/<title>[^<]*<\/title>/, '<title>gcdatlas songs</title>');
fs.writeFileSync(path.join(DIST, 'songs.html'), `<!doctype html>\n<html lang="en">\n<head>\n${meta}<meta name="robots" content="noindex">\n${songsHead}\n</head>\n<body>\n${body}\n<script>window.__SONGS = 1;</script>\n${shareScript}${script}</body>\n</html>\n`);
// the page link-preview bots get for / (vercel.json `routes`, 0.17.2): a server drawing a shared link's card reads only the tags in the
// head, so it gets the same tags in a page of about 2 KB instead of the whole 2.5 MB atlas (a Misskey server fetched the page about
// 3,000 times a day, 2.7 GB of the site's 4 GB). Made from `meta` and the page's own title, so the two never drift (tests/preview.mjs)
const ogDesc = meta.match(/property="og:description" content="([^"]*)"/)[1];
fs.writeFileSync(path.join(DIST, 'preview.html'), `<!doctype html>\n<html lang="en">\n<head>\n${meta}${head.match(/<title>[^<]*<\/title>/)[0]}\n</head>\n<body>\n<h1>gcdatlas</h1>\n<p>${ogDesc}</p>\n<p><a href="https://gcdatlas.com/">gcdatlas.com</a></p>\n</body>\n</html>\n`);
const kb = f => (fs.statSync(path.join(DIST, f)).size/1024).toFixed(0) + ' KB';
console.log(`built ${list.length} scripts -> dist/index.html (${kb('index.html')}), dist/artifact.html (${kb('artifact.html')})`);

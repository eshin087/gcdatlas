// gcdatlas build: concatenates src/ into one self-contained page.
//   dist/index.html     the website (Vercel serves this)
//   dist/artifact.html  the same page without the document wrapper (for a claude.ai artifact)
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

const head = read('00-head.html'), body = read('01-body.html');
const version = new Date().toISOString().slice(0, 10);
const script = `<script>\n/* gcdatlas ${version} */\n${js}\n</script>\n`;

const meta = `<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="description" content="An explorable universe drawn entirely in ASCII: real planets, stars, nebulae, black holes and galaxies at their true positions, with seamless zoom from Earth to the edge of the observable universe.">
<meta name="theme-color" content="#04050a">
<meta property="og:title" content="gcdatlas">
<meta property="og:description" content="The real universe, drawn entirely in ASCII. Zoom from Earth to the edge of the observable universe.">
<meta property="og:type" content="website">
<meta property="og:url" content="https://gcdatlas.vercel.app/">
<link rel="canonical" href="https://gcdatlas.vercel.app/">
<link rel="icon" href="data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="6" fill="#04050a"/><text x="16" y="23" font-family="monospace" font-size="22" font-weight="700" text-anchor="middle" fill="#ffb35c">*</text></svg>')}">
`;

fs.mkdirSync(DIST, { recursive: true });
fs.writeFileSync(path.join(DIST, 'index.html'), `<!doctype html>\n<html lang="en">\n<head>\n${meta}${head}\n</head>\n<body>\n${body}\n${script}</body>\n</html>\n`);
fs.writeFileSync(path.join(DIST, 'artifact.html'), `${head}\n${body}\n${script}`);
const kb = f => (fs.statSync(path.join(DIST, f)).size/1024).toFixed(0) + ' KB';
console.log(`built ${list.length} scripts -> dist/index.html (${kb('index.html')}), dist/artifact.html (${kb('artifact.html')})`);

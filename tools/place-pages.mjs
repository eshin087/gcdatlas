// The place pages (0.24.1, owner: findable in search): a page a person and a search engine can read for every place with a share page,
// /places/<key>, and a list of them all, /places. Written by build.mjs from tools/data/share-meta.json (npm run og -- --meta reads the
// text from the page itself: name, fact, kind, catalogue numbers, distance, size, the panel's numbers). The same page for every user agent,
// never one for crawlers: the share pages /p/<key> go on into the atlas at once, these stay put and link to it.
// Small and self-contained: inline CSS in the site's look (IBM Plex Mono from Google Fonts, fine without it), no scripts but the visit
// count (Vercel Web Analytics from our own domain, path only, as the atlas: src/09v-visits.js) and the schema.org JSON-LD.
import fs from 'node:fs';
import path from 'node:path';

const esc = t => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const escA = t => esc(t).replace(/"/g, '&quot;');
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
const json = o => JSON.stringify(o).replace(/</g, '\\u003c');
// a card or a search result shows about two sentences: a long fact is cut at a sentence end (as the share pages' description)
export const short = s => { if (s.length <= 240) return s; const c = s.slice(0, 240), i = Math.max(c.lastIndexOf('. '), c.lastIndexOf('! ')); return i > 80 ? c.slice(0, i + 1) : c.slice(0, c.lastIndexOf(' ')); };
const DAY = d => { const t = new Date(d + 'T12:00:00Z'); return isNaN(t) ? '' : t.toLocaleDateString('en-GB', { day:'numeric', month:'long', year:'numeric', timeZone:'UTC' }); };

// each kind's colour, as the atlas's cells and headings (src/00-head.html, [data-k])
const KC = { solar:'#ffd166', moons:'#c8cedc', comets:'#b9f0ff', stars:'#ff9b6b', worlds:'#b4e35f', nebulae:'#ff86c8', clusters:'#6fc6ff', bh:'#d48cff',
  galaxies:'#a59cff', cosmic:'#7b9dff', events:'#ff6b6b', human:'#7fe8a8', earth:'#3fd6c6' };
const CSS = `:root{color-scheme:dark;--void:#04050a;--ink:#e2e8f5;--soft:#c3cbe0;--dim:#8491ae;--line:rgba(140,160,210,.22);--flare:#ffb35c;--cyan:#7fdcff;
--mono:"IBM Plex Mono",ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;--disp:"Major Mono Display","IBM Plex Mono",ui-monospace,monospace}
*{box-sizing:border-box}html{background:var(--void)}
body{margin:0;background:var(--void);color:var(--ink);font:15px/1.6 var(--mono);-webkit-font-smoothing:antialiased;-webkit-text-size-adjust:100%;overflow-wrap:break-word}
a{color:var(--cyan);text-decoration:none}a:hover{text-decoration:underline}
.wrap{max-width:780px;margin:0 auto;padding:0 16px}
header{display:flex;flex-wrap:wrap;align-items:baseline;justify-content:space-between;gap:4px 16px;padding:18px 0 6px}
.brand{font-family:var(--disp);font-size:21px;letter-spacing:.08em;color:var(--ink)}
header nav{display:flex;gap:16px;font-size:13px}header nav a{color:var(--dim)}
.crumbs{font-size:12px;color:var(--dim);margin:12px 0 2px}.crumbs a{color:var(--dim)}
h1{font-weight:600;font-size:clamp(26px,6vw,36px);line-height:1.15;margin:4px 0 6px;text-wrap:balance}
.type{color:var(--dim);margin:0}.where{color:var(--soft);margin:2px 0 16px}
.pic{display:block;margin:0 0 16px;border:1px solid var(--line);border-radius:4px;overflow:hidden;background:#000;aspect-ratio:1200/630}
.pic img{display:block;width:100%;height:auto}
.fact{font-size:16px;margin:0 0 12px}
.readout{list-style:none;padding:0;margin:0;color:var(--flare)}.readout li{margin:2px 0}
.asof{font-size:12px;color:var(--dim);margin:6px 0 0}
.open{display:inline-block;margin:20px 0 4px;padding:9px 16px;border:1px solid var(--flare);border-radius:4px;color:var(--flare);background:rgba(255,179,92,.1)}
.open:hover{background:rgba(255,179,92,.2);text-decoration:none}
dl{display:grid;grid-template-columns:max-content 1fr;gap:6px 18px;margin:24px 0 0;padding:14px 0;border-top:1px solid var(--line);border-bottom:1px solid var(--line)}
dt{color:var(--dim)}dd{margin:0}
h2{font-size:15px;font-weight:600;margin:28px 0 8px;color:var(--soft)}h2 small{font-weight:400;color:var(--dim);margin-left:8px}
.list{list-style:none;padding:0;margin:0}.list li{margin:4px 0}.list span{color:var(--dim);font-size:13px}
.k{color:var(--kc,var(--soft))}${Object.entries(KC).map(([k, c]) => `[data-k="${k}"]{--kc:${c}}`).join('')}
h2[data-k]{color:var(--kc);border-bottom:1px solid color-mix(in srgb,var(--kc) 30%,transparent);padding-bottom:4px}
.lead{color:var(--soft)}.toc{font-size:13px;color:var(--dim);margin:14px 0 0}
footer{margin:40px 0 28px;padding-top:14px;border-top:1px solid var(--line);font-size:12px;color:var(--dim)}
@media (max-width:560px){body{font-size:14px}dl{grid-template-columns:1fr;gap:0}dt{margin-top:8px}}`;
// one view of the page's own path, as the atlas counts it (src/09v-visits.js, owner, 0.24.1): only on gcdatlas.com and Vercel, the path alone,
// no cookies, nothing stored, nothing at all with Global Privacy Control or Do Not Track, or with the atlas's analytics flag off
// (?flags=-analytics for one visit, or gcdatlas.flags in this browser)
export const VISIT = `(()=>{const h=location.hostname;if(h!=='gcdatlas.com'&&!h.endsWith('.gcdatlas.com')&&!h.endsWith('.vercel.app'))return;
if(navigator.globalPrivacyControl||navigator.doNotTrack==='1'||window.doNotTrack==='1')return;
let off=false;try{off=JSON.parse(localStorage.getItem('gcdatlas.flags')||'{}').analytics===false}catch(e){}
const q=new URLSearchParams(location.search).get('flags');if(q)for(const s of q.split(','))if(s.replace(/^[-+]/,'')==='analytics')off=s.startsWith('-');if(off)return;
window.va=window.va||function(){(window.vaq=window.vaq||[]).push(arguments)};window.va('beforeSend',e=>({...e,url:String(e.url).split(/[?#]/)[0]}));
const s=document.createElement('script');s.src='/_vercel/insights/script.js';document.head.appendChild(s)})();`;

const FONTS = `<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;600&family=Major+Mono+Display&display=swap">`;
const head = ({ title, desc, url, img, imgAlt, ogTitle, icon, ld }) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${escA(desc)}">
<meta name="theme-color" content="#04050a">
<meta name="robots" content="max-image-preview:large">
<link rel="canonical" href="${url}">
<meta property="og:title" content="${escA(ogTitle)}">
<meta property="og:site_name" content="gcdatlas">
<meta property="og:description" content="${escA(desc)}">
<meta property="og:type" content="website">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${img}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="${escA(imgAlt)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${escA(ogTitle)}">
<meta name="twitter:description" content="${escA(desc)}">
<meta name="twitter:image" content="${img}">
${icon}
${FONTS}
<style>${CSS}</style>
<script type="application/ld+json">${json(ld)}</script>
<script>${VISIT}</script>
</head>`;
const top = `<header><a class="brand" href="/">gcdatlas</a><nav><a href="/places">all places</a><a href="/">open the atlas</a></nav></header>`;
const foot = `<footer>gcdatlas draws the real universe in ASCII characters: real positions, distances and sizes, from Earth to the edge of the observable universe. <a href="/places">Every place</a> · <a href="/">gcdatlas.com</a></footer>`;

// SM: tools/data/share-meta.json ({ made, groups, kinds, places }; the bare list of places before 0.24.1 still builds, with less on each page)
// returns the paths written, for the sitemap
export function writePlacePages({ SM, DIST, ROOT, HOST, icon }){
  const places = SM.places, made = SM.made || '', when = made ? DAY(made) : '';
  const KIND = SM.kinds || {}, GROUPS = [...(SM.groups || []), ['earth', 'Places on Earth']];
  const groupTitle = g => (GROUPS.find(([id]) => id === g) || [g, 'Places'])[1];
  const byKey = new Map(places.map(p => [p.key, p]));
  const kids = new Map();
  for (const p of places) if (p.parent && byKey.has(p.parent)){ if (!kids.has(p.parent)) kids.set(p.parent, []); kids.get(p.parent).push(p); }
  const hasPic = k => fs.existsSync(path.join(ROOT, 'assets', 'og', k + '.jpg'));
  const page = k => `/places/${k}`;
  const link = p => `<a href="${page(p.key)}">${esc(p.name)}</a>`;
  const head1 = p => (p.type || '').split(' · ')[0];
  // how a place stands to its parent, and the parent's names for its children
  const orbits = p => ['solar', 'comets', 'worlds'].includes(p.group) || p.parent === 'sun';
  const rel = p => p.group === 'earth' ? ['on', 'on it'] : orbits(p) ? ['orbits', 'orbiting it'] : (p.kinds || []).includes('human') ? ['at', 'craft'] : ['with', 'with it'];
  // more of its kind: a moon among moons, a cluster among clusters, else its main kind; the nearest first (by ratio of the distance the atlas
  // lists it by: from the Sun in the Solar System and for comets, else from Earth; a famous place on Earth by the way round the globe)
  const relKind = p => (p.kinds || []).includes('moons') ? 'moons' : (p.kinds || []).includes('clusters') ? 'clusters' : (p.kinds || [])[0] || null;
  const arc = (a, b) => { const r = Math.PI/180, s = Math.sin((b[0] - a[0])*r/2)**2 + Math.cos(a[0]*r)*Math.cos(b[0]*r)*Math.sin((b[1] - a[1])*r/2)**2; return 2*Math.asin(Math.min(1, Math.sqrt(s))); };
  const lg = x => Math.log10(Math.max(x || 0, 1e-12));
  function more(p){
    const k = relKind(p); if (!k) return [[], k];
    const skip = new Set([p.key, p.parent, ...(kids.get(p.key) || []).map(q => q.key)]);
    const far = q => p.at && q.at ? arc(p.at, q.at) : Math.abs(lg(q.rank ?? q.distLy) - lg(p.rank ?? p.distLy));
    // (the same kind as it is compared by: the clusters listed under nebulae, or the moons in the Solar System, are not "more nebulae" or planets)
    return [places.filter(q => !skip.has(q.key) && relKind(q) === k).sort((a, b) => far(a) - far(b) || a.name.localeCompare(b.name)).slice(0, 8), k];
  }
  const dir = path.join(DIST, 'places'); fs.mkdirSync(dir, { recursive:true });
  for (const f of fs.readdirSync(dir)) if (!byKey.has(f.replace(/\.html$/, ''))) fs.rmSync(path.join(dir, f), { recursive:true, force:true });
  const written = [];
  for (const p of places){
    const url = HOST + page(p.key), name = p.name, Name = cap(name), pic = hasPic(p.key);
    const img = HOST + (pic ? `/og/${p.key}.jpg` : '/og.jpg'), alt = `${name}, drawn in ASCII characters`;
    const desc = short(p.fact || 'The real universe, drawn entirely in ASCII.');
    const t1 = head1(p), title = t1 && (Name + ': ' + t1).length <= 58 ? `${Name}: ${t1} · gcdatlas` : `${Name} · gcdatlas`;
    const kinds = (p.kinds || []).filter(k => KIND[k]);
    const ld = { '@context':'https://schema.org', '@type':'WebPage', '@id':url, url, name:title, description:desc, inLanguage:'en', ...(made ? { dateModified:made } : {}),
      isPartOf:{ '@type':'WebSite', name:'gcdatlas', url:HOST + '/' },
      ...(pic ? { primaryImageOfPage:{ '@type':'ImageObject', url:img, width:1200, height:630, caption:alt } } : {}),
      about:{ '@type':p.at ? 'Place' : 'Thing', name:Name, description:p.fact || '', ...((p.codes || []).length ? { alternateName:p.codes } : {}),
        ...(p.at ? { geo:{ '@type':'GeoCoordinates', latitude:p.at[0], longitude:p.at[1] } } : {}) },
      breadcrumb:{ '@type':'BreadcrumbList', itemListElement:[{ '@type':'ListItem', position:1, name:'gcdatlas', item:HOST + '/' },
        { '@type':'ListItem', position:2, name:'Places', item:HOST + '/places' }, { '@type':'ListItem', position:3, name:Name }] } };
    // the facts, as a list of terms
    const dl = [];
    if (kinds.length) dl.push(['kind', kinds.map(k => `<span class="k" data-k="${k}">${esc(KIND[k][0])}</span>`).join(' · ')]);
    else if (p.madeUp) dl.push(['kind', 'made up: not a real craft']);
    if ((p.codes || []).length) dl.push(['catalogue', esc(p.codes.join(' · '))]);
    if ((p.drawnWith || []).length) dl.push(['drawn with it', esc(p.drawnWith.join(' · '))]);
    if (p.fromSun) dl.push(['distance', esc(p.fromSun)]);
    if (p.size) dl.push(['size', esc(p.size)]);
    const par = p.parent && byKey.get(p.parent);
    if (par) dl.push([rel(p)[0], link(par)]);
    const ch = kids.get(p.key) || [], chBy = new Map();
    for (const q of ch){ const r = rel(q)[1]; if (!chBy.has(r)) chBy.set(r, []); chBy.get(r).push(q); }
    for (const [r, list] of chBy) dl.push([r, list.map(link).join(' · ')]);
    const [mo, mk] = more(p);
    const ro = (p.readout || []).filter(Boolean);
    const body = `<body>
<div class="wrap">
${top}
<main>
<nav class="crumbs" aria-label="breadcrumb"><a href="/">gcdatlas</a> › <a href="/places">places</a> › <a href="/places#${p.group}">${esc(groupTitle(p.group))}</a></nav>
<h1>${esc(Name)}</h1>
${p.type ? `<p class="type">${esc(p.type)}</p>\n` : ''}${p.where ? `<p class="where">${esc(p.where)}</p>\n` : ''}${pic ? `<a class="pic" href="/#o=${p.key}"><img src="/og/${p.key}.jpg" width="1200" height="630" alt="${escA(alt)}" fetchpriority="high"></a>\n` : ''}<p class="fact">${esc(p.fact || '')}</p>
${ro.length ? `<ul class="readout">${ro.map(l => `<li>${esc(l)}</li>`).join('')}</ul>\n` : ''}${p.moving && when ? `<p class="asof">Numbers that change with time are from ${when}.</p>\n` : ''}<a class="open" href="/#o=${p.key}">open ${esc(name)} in the atlas ›</a>
${dl.length ? `<dl>${dl.map(([t, d]) => `<dt>${t}</dt><dd>${d}</dd>`).join('')}</dl>\n` : ''}${mo.length ? `<section><h2>More ${esc((KIND[mk] || [, 'places'])[1])}</h2><ul class="list">${mo.map(q => `<li>${link(q)}${head1(q) ? ` <span>${esc(head1(q))}</span>` : ''}</li>`).join('')}</ul></section>\n` : ''}</main>
${foot}
</div>
</body>
</html>
`;
    fs.writeFileSync(path.join(dir, p.key + '.html'), head({ title, desc, url, img, imgAlt:alt, ogTitle:Name, icon, ld }) + '\n' + body);
    written.push(page(p.key));
  }
  // the list of them all, under the atlas's headings, as the atlas orders them (near to far; the Solar System from the Sun), places on Earth by name
  const sections = GROUPS.map(([g, t]) => [g, t, places.filter(p => p.group === g).sort((a, b) => g === 'earth' ? a.name.localeCompare(b.name) : (a.rank ?? 0) - (b.rank ?? 0))])
    .filter(([, , l]) => l.length);
  const lostGroup = places.filter(p => !GROUPS.some(([g]) => g === p.group));
  if (lostGroup.length) sections.push(['more', 'More places', lostGroup]);
  const url = HOST + '/places', title = 'Every place in gcdatlas', desc = `${places.length} places in the real universe, drawn in ASCII at their real positions: planets, moons, stars, nebulae, black holes, galaxies and famous places on Earth.`;
  const ld = { '@context':'https://schema.org', '@type':'CollectionPage', '@id':url, url, name:title, description:desc, inLanguage:'en', ...(made ? { dateModified:made } : {}),
    isPartOf:{ '@type':'WebSite', name:'gcdatlas', url:HOST + '/' } };
  const gk = g => KC[g] ? g : ({ travel:'human' })[g] || '';
  fs.writeFileSync(path.join(DIST, 'places.html'), head({ title:'Every place: planets, stars, nebulae, galaxies · gcdatlas', desc, url, img:HOST + '/og.jpg', imgAlt:'M87*, a black hole with its glowing disc bent round its shadow, drawn in ASCII characters', ogTitle:title, icon, ld }) + `
<body>
<div class="wrap">
${top}
<main>
<h1>${title}</h1>
<p class="lead">${places.length} places in the real universe, each drawn in ASCII characters at its real position and size, from the Sun and Earth to the edge of the observable universe. Pick one to read about it, or <a href="/">open the atlas</a> and fly there.</p>
<nav class="toc">${sections.map(([g, t]) => `<a href="#${g}">${esc(t)}</a>`).join(' · ')}</nav>
${sections.map(([g, t, list]) => `<section id="${g}"><h2${gk(g) ? ` data-k="${gk(g)}"` : ''}>${esc(t)}<small>${list.length}</small></h2><ul class="list">${list.map(p => `<li>${link(p)}${head1(p) ? ` <span>${esc(head1(p))}</span>` : ''}</li>`).join('')}</ul></section>`).join('\n')}
</main>
${foot}
</div>
</body>
</html>
`);
  return ['/places', ...written];
}

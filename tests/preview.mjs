// Link-preview bots (0.17.2): vercel.json sends them dist/preview.html for /, a page of about 2 KB with the same tags as the atlas.
// Checks the page against dist/index.html and the rule's user agents (the rule is PCRE on Vercel, plain JS here); then the share pages
// (0.24.0), the place pages, their list, the sitemap and robots.txt (0.24.1); last, in a browser, what the visit count sends from them.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const bad = [];
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const exists = f => fs.existsSync(path.join(ROOT, f));
const page = read('dist/index.html'), prev = read('dist/preview.html');
// the same title and preview tags, word for word, and nothing heavy
const tags = h => (h.match(/<meta (?:property|name)="(?:og|twitter):[^>]*>|<meta name="description"[^>]*>|<link rel="(?:canonical|icon)"[^>]*>|<title>[^<]*<\/title>/g) || []).sort();
const want = tags(page.slice(0, page.indexOf('</head>'))), got = tags(prev);
if (want.length < 15) bad.push(`only ${want.length} preview tags found in dist/index.html`);
for (const t of want) if (!got.includes(t)) bad.push('preview.html is missing ' + t.slice(0, 80));
for (const t of got) if (!want.includes(t)) bad.push('preview.html has a tag the page does not: ' + t.slice(0, 80));
if (prev.length > 4096) bad.push(`preview.html is ${prev.length} bytes`);
if (/<script|<style|<link rel="stylesheet"/.test(prev)) bad.push('preview.html loads something');
// the rule: / only, by user agent, never for a browser (every browser sends Sec-Fetch-Mode when it opens a page)
const routes = JSON.parse(read('vercel.json')).routes || [];
const r = routes.find(x => x.dest === '/preview');
if (!r) bad.push('vercel.json has no route to /preview');
else {
  if (r.src !== '^/$') bad.push('the route is not for / alone: ' + r.src);
  if (!(r.missing || []).some(m => m.type === 'header' && m.key === 'sec-fetch-mode' && m.value === undefined)) bad.push('the route does not skip requests with Sec-Fetch-Mode');
  const ua = (r.has || []).find(h => h.type === 'header' && h.key === 'user-agent'), re = ua && ua.value && new RegExp(ua.value.re);
  if (!re) bad.push('the route has no user-agent regex');
  else {
    const BOTS = [
      'SummalyBot/5.2.2',
      'http.rb/5.1.1 (Mastodon/4.2.10; +https://mastodon.social/)',
      'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
      'GoogleMessages/20.2 facebookexternalhit/1.1 Facebot Twitterbot/1.0',
      'Twitterbot/1.0',
      'Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)',
      'Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)',
      'TelegramBot (like TwitterBot)',
      'WhatsApp/2.23.20.0 A',
      'LinkedInBot/1.0 (compatible; Mozilla/5.0; Apache-HttpClient +http://www.linkedin.com)',
      'Mozilla/5.0 (compatible; Bluesky Cardyb/1.1; +mailto:support@bsky.app)',
      'Mozilla/5.0 (Windows NT 6.1; WOW64) SkypeUriPreview Preview/0.5',
    ];
    // browsers, apps' own browsers and search engines keep the whole page (Google ranks pages by what it is served: never a different one)
    const KEEP = [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36 Edg/154.0.0.0',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:140.0) Gecko/20100101 Firefox/140.0',
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1',
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 390.0.0.28.85',
      'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Mobile Safari/537.36 [FBAN/EMA;FBLC/en_US;FBAV/480.0.0]',
      'Mozilla/5.0 (Linux; Android 15) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Mobile Safari/537.36 Snapchat/13.50.0.40',
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Line/15.10.0',
      'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
      'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15 (Applebot/0.1; +http://www.apple.com/go/applebot)',
      'DuckDuckBot/1.1; (+http://duckduckgo.com/duckduckbot.html)',
      'got (https://github.com/sindresorhus/got)',
      'Mastodon/2025.1 CFNetwork/1568.100.1 Darwin/24.0.0',
    ];
    for (const s of BOTS) if (!re.test(s)) bad.push('a preview bot gets the whole page: ' + s);
    for (const s of KEEP) if (re.test(s)) bad.push('gets the small page: ' + s);
  }
}
// ---------------------------------------------------------------- the share pages (0.24.0): /p/<key> for every place in
// tools/data/share-meta.json, each tiny, with the place's own tags, picture and redirect, the same for every user agent
let shareN = 0, placeN = 0;
const metaFile = 'tools/data/share-meta.json';
// (0.24.1: { made, groups, kinds, places }; before, the bare list of places)
const SM = exists(metaFile) ? (x => Array.isArray(x) ? { places:x } : x)(JSON.parse(read(metaFile))) : null;
{
  if (!SM) bad.push(metaFile + ' is missing (npm run og -- --all, or --meta)');
  else {
    const places = SM.places, pDir = path.join(ROOT, 'dist', 'p');
    const have = fs.existsSync(pDir) ? fs.readdirSync(pDir) : [];
    if (places.length < 200) bad.push(`share-meta.json lists only ${places.length} places`);
    if (have.length !== places.length) bad.push(`dist/p has ${have.length} pages for ${places.length} places`);
    const escA = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    for (const e of places){
      if (!/^[a-z0-9-]+$/.test(e.key)){ bad.push('a key that cannot be a path: ' + e.key); continue; }
      if (!fs.existsSync(path.join(pDir, e.key + '.html'))){ bad.push('no page for ' + e.key); continue; }
      const t = read('dist/p/' + e.key + '.html');
      if (t.length > 3000) bad.push(`p/${e.key} is ${t.length} bytes`);
      if (!t.includes(`<meta property="og:title" content="${escA(e.name)}">`)) bad.push(`p/${e.key}: og:title is not its name`);
      if (!t.includes(`'o=${e.key}&'`) || !t.includes(`url=/#o=${e.key}`)) bad.push(`p/${e.key}: the redirect does not open the place`);
      const img = ((t.match(/property="og:image" content="([^"]+)"/) || [])[1] || '').replace(/^https?:\/\/[^/]+\//, '');
      if (!img || !fs.existsSync(path.join(ROOT, 'dist', img))) bad.push(`p/${e.key}: og:image /${img} is not in dist`);
      if (/<script src|<link rel="stylesheet"/.test(t)) bad.push(`p/${e.key}: loads something`);
      shareN++;
    }
    // the list baked into the page must match, so share() never copies a link to a page that is not there
    const inj = (page.match(/window\.__SHARE_PAGES=(\[[^\]]*\])/) || [])[1], keys = inj ? JSON.parse(inj) : null;
    if (!keys) bad.push('dist/index.html carries no __SHARE_PAGES list');
    else if (keys.length !== places.length || keys.some((k, i) => k !== places[i].key)) bad.push('__SHARE_PAGES does not match share-meta.json');
    if (/window\.__SHARE_PAGES=\[/.test(read('dist/artifact.html'))) bad.push('the artifact build carries __SHARE_PAGES (it is served without /p)');
  }
}
// ---------------------------------------------------------------- the place pages (0.24.1, owner: findable in search): /places/<key> for every
// place, a page to read that stays put (never a redirect), the same for every user agent; /places lists them all; the sitemap lists exactly
// those and the home page; robots.txt names it. Built locally, so every address is production's
const SITE = 'https://gcdatlas.com';
const escH = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
if (SM){
  const places = SM.places, keys = new Set(places.map(e => e.key));
  if (!SM.made || !SM.groups || !SM.kinds) bad.push(metaFile + ' has no page text (made, groups, kinds): npm run og -- --meta');
  const have = exists('dist/places') ? fs.readdirSync(path.join(ROOT, 'dist', 'places')) : [];
  if (have.length !== places.length) bad.push(`dist/places has ${have.length} pages for ${places.length} places`);
  for (const e of places){
    const f = `dist/places/${e.key}.html`, url = `${SITE}/places/${e.key}`, at = `places/${e.key}`;
    if (!exists(f)){ bad.push('no place page for ' + e.key); continue; }
    const t = read(f);
    if (t.length > 16000) bad.push(`${at} is ${t.length} bytes`);
    if (!t.includes(`<link rel="canonical" href="${url}">`)) bad.push(`${at}: its canonical link is not its own address`);
    if (!t.includes(`<meta property="og:url" content="${url}">`)) bad.push(`${at}: og:url is not its own address`);
    if (!t.includes(`<h1>${escH(cap(e.name))}</h1>`)) bad.push(`${at}: the heading is not its name`);
    if (!e.fact || !t.includes(`<p class="fact">${escH(e.fact)}</p>`)) bad.push(`${at}: its fact is missing`);
    if (!/<meta name="description" content="[^"]{40,}">/.test(t)) bad.push(`${at}: no description`);
    if (exists(`assets/og/${e.key}.jpg`)){
      const img = (t.match(/<img src="\/og\/([a-z0-9-]+)\.jpg" width="1200" height="630" alt="([^"]+)"/) || []);
      if (img[1] !== e.key || !(img[2] || '').includes(escH(e.name).replace(/"/g, '&quot;'))) bad.push(`${at}: no picture of it with its name as alt text`);
      if (!exists(`dist/og/${e.key}.jpg`)) bad.push(`${at}: /og/${e.key}.jpg is not in dist`);
    }
    for (const l of e.readout || []) if (!t.includes(`<li>${escH(l)}</li>`)) { bad.push(`${at}: a line of its numbers is missing: ${l.slice(0, 60)}`); break; }
    for (const [k, v] of [['type', e.type], ['where', e.where], ['size', e.size]]) if (v && !t.includes(escH(v))) bad.push(`${at}: its ${k} is missing`);
    if ((e.codes || []).length && !t.includes(escH(e.codes.join(' · ')))) bad.push(`${at}: its catalogue numbers are missing`);
    if (!t.includes(`<a class="open" href="/#o=${e.key}">`)) bad.push(`${at}: no link that opens it in the atlas`);
    // a page to read stays put: no redirect of any kind, and no script but the visit count and the JSON-LD (nothing loaded from elsewhere)
    if (/location\.(replace|assign)|location\.href\s*=|http-equiv="refresh"/i.test(t)) bad.push(`${at}: it forwards somewhere`);
    if (/<script[^>]+src=/.test(t) || (t.match(/<script/g) || []).length !== 2) bad.push(`${at}: scripts other than the visit count and the JSON-LD`);
    if (!/navigator\.globalPrivacyControl/.test(t) || !/doNotTrack/.test(t) || !/split\(\/\[\?#\]\/\)\[0\]/.test(t)) bad.push(`${at}: the visit count lacks its privacy checks (GPC, Do Not Track, path only)`);
    let ld = null; try { ld = JSON.parse((t.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/) || [])[1]); } catch (err) {}
    if (!ld || ld['@type'] !== 'WebPage' || ld.url !== url || !ld.about || ld.about.name !== cap(e.name)) bad.push(`${at}: its schema.org JSON-LD is missing or wrong`);
    for (const m of t.matchAll(/href="\/places\/([^"#]+)"/g)) if (!keys.has(m[1])) { bad.push(`${at}: a link to a place page that is not there: ${m[1]}`); break; }
    placeN++;
  }
  // the list: every place once
  const L = exists('dist/places.html') ? read('dist/places.html') : '';
  if (!L) bad.push('dist/places.html is missing');
  else {
    for (const e of places){ const n = L.split(`href="/places/${e.key}"`).length - 1; if (n !== 1){ bad.push(`/places lists ${e.key} ${n} times`); break; } }
    if (!L.includes(`<link rel="canonical" href="${SITE}/places">`)) bad.push('/places: its canonical link is not its own address');
  }
  // the sitemap: the home page, the list and exactly the place pages (the share pages /p/ go on into the atlas, so they are not listed)
  const sm = exists('dist/sitemap.xml') ? read('dist/sitemap.xml') : '';
  const locs = [...sm.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]), wantL = [`${SITE}/`, `${SITE}/places`, ...places.map(e => `${SITE}/places/${e.key}`)];
  if (!sm.startsWith('<?xml') || !sm.includes('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">')) bad.push('dist/sitemap.xml is missing or not a sitemap');
  if (locs.length !== wantL.length || new Set(locs).size !== locs.length || wantL.some(u => !locs.includes(u))) bad.push(`the sitemap lists ${locs.length} addresses, not the home page, /places and the ${places.length} place pages`);
  // robots.txt: names the sitemap, keeps the owner's two review pages and the data functions out, nothing else
  const rb = exists('dist/robots.txt') ? read('dist/robots.txt') : '';
  const dis = [...rb.matchAll(/^Disallow:\s*(\S*)\s*$/gm)].map(m => m[1]).sort();
  if (!rb.includes(`Sitemap: ${SITE}/sitemap.xml`)) bad.push('robots.txt does not name the sitemap');
  if (!/^User-agent: \*$/m.test(rb) || dis.join(' ') !== '/api/ /lab /songs') bad.push('robots.txt should keep out /lab, /songs and /api/ only: ' + dis.join(' '));
  // nothing in vercel.json catches these addresses: its one route is the preview bots' page for / (checked above)
  if ((JSON.parse(read('vercel.json')).routes || []).length !== 1) bad.push('vercel.json has a route besides the preview bots\' one: check /places, /sitemap.xml and /robots.txt still reach their files');
  // the home page tells search engines the site's name (schema.org WebSite), and only the home page carries it
  if (!/<script type="application\/ld\+json">\{"@context":"https:\/\/schema\.org","@type":"WebSite"/.test(page)) bad.push('dist/index.html has no schema.org WebSite');
}

// ---------------------------------------------------------------- what the visit count sends (owner, 0.24.1), in a browser, the site served as
// gcdatlas.com from dist/ and Vercel's script replaced by a stub that runs the page's beforeSend on a page view: a place page sends its own
// path alone; a visit through a shared link's page (/p/<key>) counts as that path; a plain visit to the atlas as /; nothing with GPC
let visitN = 0;
if (SM && !bad.length){
  const TYPES = { '.html':'text/html', '.js':'text/javascript', '.json':'application/json', '.webp':'image/webp', '.jpg':'image/jpeg', '.xml':'application/xml', '.txt':'text/plain' };
  const STUB = `(()=>{let bs=null;for(const a of window.vaq||[])if(a[0]==='beforeSend')bs=a[1];const e={type:'pageview',url:location.href};window.__sent=bs?bs(e):e;})();`;
  const browser = await chromium.launch({ args:['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const visit = async (url, gpc = false) => {
    const ctx = await browser.newContext(), pg = await ctx.newPage(); let script = 0;
    if (gpc) await pg.addInitScript(() => Object.defineProperty(Navigator.prototype, 'globalPrivacyControl', { get:() => true }));
    await pg.addInitScript(() => { window.__noAdapt = true; try { localStorage.setItem('gcdatlas.settings', JSON.stringify({ fadeUI:'off' })); } catch (e) {} });
    await ctx.route('**/*', r => {
      const u = new URL(r.request().url());
      if (u.hostname !== 'gcdatlas.com') return r.abort();
      if (u.pathname === '/_vercel/insights/script.js'){ script++; return r.fulfill({ status:200, contentType:'text/javascript', body:STUB }); }
      let f = path.join(ROOT, 'dist', u.pathname === '/' ? 'index.html' : decodeURIComponent(u.pathname));
      if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) f += '.html';   // (cleanUrls, as on Vercel)
      if (!f.startsWith(path.join(ROOT, 'dist')) || !fs.existsSync(f)) return r.fulfill({ status:404, body:'' });
      return r.fulfill({ status:200, contentType:TYPES[path.extname(f)] || 'application/octet-stream', body:fs.readFileSync(f) });
    });
    // (a share page goes on into the atlas while it loads: wait for the atlas)
    if (/\/p\//.test(url)) await Promise.all([pg.waitForURL(u => u.pathname === '/', { timeout:60000 }), pg.goto(url, { waitUntil:'commit' })]);
    else await pg.goto(url);
    const sent = gpc ? await pg.waitForTimeout(1500).then(() => pg.evaluate(() => window.__sent || null))
      : await pg.waitForFunction(() => window.__sent, null, { timeout:90000 }).then(h => h.jsonValue()).catch(() => null);
    await ctx.close(); return { sent, script };
  };
  try {
    const k = places => places.find(e => e.key === 'crab') ? 'crab' : places[0].key;
    const key = k(SM.places);
    for (const [url, want, gpc] of [[`${SITE}/places/${key}?c=1,2,3#x`, `${SITE}/places/${key}`], [`${SITE}/places`, `${SITE}/places`],
      [`${SITE}/places/${key}`, null, true], [`${SITE}/p/${key}?c=0.5,0.2,3`, `${SITE}/p/${key}`], [`${SITE}/#o=${key}`, `${SITE}/`]]){
      const { sent, script } = await visit(url, gpc);
      if (gpc){ if (script || sent) bad.push(`visit count: ${url} with Global Privacy Control still loaded the script or sent a view`); }
      else if (!sent || sent.url !== want) bad.push(`visit count: ${url} sent ${sent ? sent.url : 'nothing'}, not ${want}`);
      visitN++;
    }
  } finally { await browser.close(); }
}
console.log(bad.length ? 'preview: FAIL\n  ' + bad.join('\n  ') : `preview: ok (${prev.length} bytes, ${want.length} tags, ${shareN} share pages, ${placeN} place pages, sitemap, robots.txt, ${visitN} visit counts)`);
process.exit(bad.length ? 1 : 0);

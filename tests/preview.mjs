// Link-preview bots (0.17.2): vercel.json sends them dist/preview.html for /, a page of about 2 KB with the same tags as the atlas.
// No browser: checks the page against dist/index.html and the rule's user agents (the rule is PCRE on Vercel, plain JS here).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const bad = [];
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
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
let shareN = 0;
{
  const metaFile = 'tools/data/share-meta.json';
  if (!fs.existsSync(path.join(ROOT, metaFile))) bad.push(metaFile + ' is missing (npm run og -- --all, or --meta)');
  else {
    const places = JSON.parse(read(metaFile)), pDir = path.join(ROOT, 'dist', 'p');
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
console.log(bad.length ? 'preview: FAIL\n  ' + bad.join('\n  ') : `preview: ok (${prev.length} bytes, ${want.length} tags, ${shareN} share pages)`);
process.exit(bad.length ? 1 : 0);

// The site's two fonts, served from our own domain since 0.27.3 (assets/fonts, copied to dist/fonts by build.mjs). Until then the page
// asked Google Fonts for a stylesheet and the files: the only request to another host, and one the first paint waited for.
// The four files are the latin sets Google served for the page (every character the atlas writes that these fonts have is in them):
// IBM Plex Mono 400, 500 (the weight the ASCII is drawn in) and 600, and Major Mono Display 400 (the logo). A file's name carries the
// font's version: a new version is a new name, so /fonts/ is cached for a year (vercel.json).
export const FONT_FILES = [
  ['IBM Plex Mono', 400, 'ibm-plex-mono-400-v20.woff2'],
  ['IBM Plex Mono', 500, 'ibm-plex-mono-500-v20.woff2'],
  ['IBM Plex Mono', 600, 'ibm-plex-mono-600-v20.woff2'],
  ['Major Mono Display', 400, 'major-mono-display-400-v18.woff2'],
];
// base: where the files are from the page, 'fonts/' beside the atlas (which also works from a file, as the tests open it) or '/fonts/' from
// a page deeper down (the place pages); weights: the IBM Plex Mono weights a page uses.
// No <link rel="preload">: the page's own first words use the 400 and 500 weights, so the browser asks for them at the first layout anyway,
// and a font preload needs `crossorigin`, which a page opened from a file refuses with an error in the console (the tests count those).
export function fontHead(base, { weights = [400, 500, 600] } = {}){
  const use = FONT_FILES.filter(([fam, w]) => fam !== 'IBM Plex Mono' || weights.includes(w));
  const faces = use.map(([fam, w, f]) => `@font-face{font-family:"${fam}";font-style:normal;font-weight:${w};font-display:swap;src:url(${base}${f}) format("woff2")}`);
  return ['<style>', ...faces, '</style>'].join('\n');
}
// the artifact page is served alone, away from dist/, so it keeps Google's stylesheet (and still works without it)
export const GOOGLE_FONTS = `<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=Major+Mono+Display&display=swap">`;

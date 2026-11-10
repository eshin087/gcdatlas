# Security and privacy

## What the site does and does not do

- Static page plus six read-only serverless functions (`/api/sats`, `/api/launches`, `/api/weather`, and for the real Earth `/api/clouds`, `/api/quakes`, `/api/fires`), and the static images of the ground (`/earth/`). Since 0.24.1 also small static pages to read, one per place (`/places/<key>`, `/places`), with no script but the visit count and their schema.org data. The page calls its own `/api` only, by the bare path: no query, nothing about the visitor (the weather asks for fixed places, the clouds, quakes and fires for the whole globe). The functions take nothing from the request and fetch fixed URLs. The clouds function returns an image and forwards no upstream header (it sets its own `X-Clouds-*` ones).
- No accounts, no cookies, no ads, no tracking across sites.
- No request goes to any other host (since 0.27.3): the two fonts are our own files under `/fonts/` (`assets/fonts`, SIL Open Font License). Until then the page asked Google Fonts for a stylesheet and the font files. Only the artifact page (`dist/artifact.html`, served alone on claude.ai) still does.
- Visits are counted with Vercel Web Analytics (since 0.17.1, `src/09v-visits.js`, flag `analytics`). Its script comes from our own domain (`/_vercel/insights/script.js`), sets no cookies and stores nothing on the device. Each page load sends one page view: the path only (we cut the `?query` and the `#view` off in `beforeSend`), the referrer, and what Vercel reads from the request (country and region, browser, operating system, device type). Vercel tells visits apart by a hash of the request that it throws away after 24 hours; the IP address is not stored. Nothing is sent when the browser asks not to be tracked (Global Privacy Control or Do Not Track), from `/lab` or `/songs`, or anywhere but gcdatlas.com and `*.vercel.app`. See https://vercel.com/docs/analytics/privacy-policy.
- Since 0.24.1 the place pages (`/places/<key>` and `/places`) count their own path the same way, with the same checks (an inline loader in `tools/place-pages.mjs`; it also honours the atlas's analytics flag, `?flags=-analytics` or `gcdatlas.flags` in that browser). A visit that comes in through a shared link's page (`/p/<key>`, which forwards at once) is counted as that path instead of `/`: the atlas reads which page sent it (`document.referrer`, our own origin only) and nothing more. Still one page view per load, the path alone.
- Everything personal stays in the visitor's own browser (`localStorage`, keys `gcdatlas.*`): settings, collection log, daily streak, whether the first-visit hint has been used (`gcdatlas.hinted`), and the location used for *your sky*. Location is only requested when the visitor asks for *use my location*, and only a rounded latitude and longitude are kept.

## Threat model and mitigations

| Risk | Mitigation |
| --- | --- |
| Cross-site scripting | All visitor-visible text is set with `textContent`, never `innerHTML` with external data. Launch and satellite names and earthquake places from the APIs are length-limited on the server (a quake's place to 64 characters) and inserted as text. Keep it that way. |
| Server-side request forgery | The API functions fetch fixed URLs only; nothing from the request (query, headers, body) is used to build a URL. |
| Abuse of the API functions / upstream rate limits | Responses are cached at the Vercel edge (`s-maxage` 6 h for satellites, 1 h for launches, 30 min for the weather, 6 h for the clouds, 5 min for the earthquakes, 2 h for the fires) so upstream sees a few requests a day however much traffic arrives. The edge cache keys on the full URL, so any query string is refused with a 404 before anything is fetched (`api/_lib/guard.js`); otherwise `?x=1`, `?x=2`… would each run the function and hit the upstream. A warm function keeps its last good answer (2 h for satellites, 30 min for launches, 3 h for the clouds, 4 min for the earthquakes, 1 h for the fires), parallel requests share one fetch, and if the upstream fails the last good answer is served. Error replies do not repeat upstream details. Optional extra: a Vercel Firewall rate limit on `/api/*`. |
| Crafted share links | Values from the URL hash are checked: object keys are looked up in `BYKEY`, which has no prototype (`#o=constructor` finds nothing), and numbers (`jd`, `deep`, camera) must be finite and are clamped. `?flags=` applies to that visit only and is never saved, so a shared link cannot change a visitor's settings for good. |
| Clickjacking | `X-Frame-Options: DENY` (see `vercel.json`). The claude.ai artifact build is a separate page. |
| MIME sniffing, referrer leaks | `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`. |
| Powerful browser features | `Permissions-Policy` disables camera, microphone and payment; geolocation only for this origin, and only on request. |
| Secrets | There are none. No API keys are needed (CelesTrak, Launch Library 2, Open-Meteo, NASA GIBS, the USGS and NASA FIRMS are public). If one is ever needed, put it in Vercel environment variables, read it only in `api/`, never in `src/`. |
| Supply chain | The page has zero runtime dependencies (Vercel's analytics script is served by Vercel itself, from our domain, and only on the live site). Dev dependencies (Playwright, sharp) never ship. Tools in `tools/` run only at data-generation time. |

## Recommended next step: a Content Security Policy

Once the inline script is moved to a file (or hashed), add to `vercel.json`:

```
Content-Security-Policy: default-src 'self'; script-src 'self' 'sha256-…'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data: blob:; connect-src 'self'; frame-ancestors 'none'
```

`build.mjs` can compute the script hash at build time.

## Before adding social features

Comments, likes or listings mean storing visitor content. Plan in `docs/ROADMAP.md` → *Social*; at minimum: authentication or anonymous rate-limited tokens, server-side validation and length limits, moderation (a queue and a report button), escaping on display, a privacy note, and data deletion on request. Keep it behind the `social` flag until all of that exists.

## Reporting a problem

Open a GitHub issue. For anything sensitive, use GitHub's *Report a vulnerability* button on the repository's Security tab (private vulnerability reporting).

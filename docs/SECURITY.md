# Security and privacy

## What the site does and does not do

- Static page plus two read-only serverless functions (`/api/sats`, `/api/launches`).
- No accounts, no cookies, no analytics, no tracking, no ads.
- Everything personal stays in the visitor's own browser (`localStorage`, keys `gcdatlas.*`): settings, collection log, daily streak, and the location used for *your sky*. Location is only requested when the visitor asks for *use my location*, and only a rounded latitude and longitude are kept.

## Threat model and mitigations

| Risk | Mitigation |
| --- | --- |
| Cross-site scripting | All visitor-visible text is set with `textContent`, never `innerHTML` with external data. Launch and satellite names from the APIs are length-limited on the server and inserted as text. Keep it that way. |
| Server-side request forgery | The API functions fetch fixed URLs only; nothing from the request (query, headers, body) is used to build a URL. |
| Abuse of the API functions / upstream rate limits | Responses are cached at the Vercel edge (`s-maxage` 6 h for satellites, 1 h for launches) so upstream sees a few requests a day however much traffic arrives. Errors are cached briefly (5–10 min). |
| Clickjacking | `X-Frame-Options: DENY` (see `vercel.json`). The claude.ai artifact build is a separate page. |
| MIME sniffing, referrer leaks | `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`. |
| Powerful browser features | `Permissions-Policy` disables camera, microphone and payment; geolocation only for this origin, and only on request. |
| Secrets | There are none. No API keys are needed (CelesTrak and Launch Library 2 are public). If one is ever needed, put it in Vercel environment variables, read it only in `api/`, never in `src/`. |
| Supply chain | The page has zero runtime dependencies. Dev dependencies (Playwright, sharp) never ship. Tools in `tools/` run only at data-generation time. |

## Recommended next step: a Content Security Policy

Once the inline script is moved to a file (or hashed), add to `vercel.json`:

```
Content-Security-Policy: default-src 'self'; script-src 'self' 'sha256-…'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data: blob:; connect-src 'self'; frame-ancestors 'none'
```

`build.mjs` can compute the script hash at build time.

## Before adding social features

Comments, likes or listings mean storing visitor content. Plan in `docs/ROADMAP.md` → *Social*; at minimum: authentication or anonymous rate-limited tokens, server-side validation and length limits, moderation (a queue and a report button), escaping on display, a privacy note, and data deletion on request. Keep it behind the `social` flag until all of that exists.

## Reporting a problem

Open a GitHub issue (or contact the owner privately for anything sensitive).

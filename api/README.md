# api

Serverless functions deployed by Vercel next to the static page. Read-only, no secrets, fixed upstream URLs, cached at the edge.

| Endpoint | Source | Cache |
| --- | --- | --- |
| `/api/sats` | CelesTrak active satellites (OMM JSON), compacted by `_lib/orbits.js` | 6 h |
| `/api/launches` | The Space Devs Launch Library 2, next launches | 1 h |

Files in `_lib/` are shared helpers, not endpoints. See `docs/SECURITY.md`.

# Roadmap

Ideas are cheap to keep here; what gets built next is decided by moving items into *Next*. Anything experimental ships behind a flag (docs/FEATURE_FLAGS.md).

## Next

- **Content packs still open** (see docs/CONTENT.md): small worlds (Ceres, Vesta, Bennu, Arrokoth, Halley, 'Oumuamua), human spaceflight sites (Apollo landing sites, Perseverance, Curiosity, Parker Solar Probe), exoplanets (51 Pegasi b, HR 8799, K2-18 b, KELT-9 b, 55 Cancri e, Kepler-16 b), planet surfaces (Olympus Mons, Valles Marineris, Io's plumes).
- **ASCII Earth, phase 2**: zoom to city scale. Landmark models (pyramids, Eiffel Tower, Burj Khalifa…) as small SDF shaders appearing below ~50 km altitude; higher-resolution coastline tiles loaded on demand.
- **Live sky events, phase 2**: a "happening now" toast when an ISS pass or launch is minutes away; notifications opt-in.
- **Content Security Policy** (docs/SECURITY.md).

## Later

- **ASCII Earth, phase 3**: live aircraft (needs a data source with a suitable licence and quota), weather from a public feed, day/night terminator with real clouds.
- **Human story, phase 2**: ancient continents (plate reconstructions at a few key times: Pangaea, Rodinia) as textures in Earth's story.
- **More black hole physics**: spinning (Kerr) holes, relativistic jets from M87*.
- **Accessibility**: a text description mode for screen readers (what is on screen, as a sentence); high-contrast glyphs.
- **Localisation**: object facts in other languages.
- **Offline**: a service worker so the site works as an installable app and a true screensaver.

## Social (planned, not started; flag `social`)

What people asked for: comments, likes, a popularity listing. How to do it without risk:

1. Backend: a hosted database with row-level security (for example Supabase) or Vercel KV/Postgres. One table per feature: `likes(object_key, device_id, created_at)`, `comments(id, object_key, body, author_name, status, created_at)`.
2. Identity: start anonymous (a random device id, rate limited per IP at the edge). Add sign-in only if comments need names.
3. Moderation before display: comments go into a `pending` state; show only `approved`. A report button. Length limits and escaping on display.
4. UI: a heart on the info panel (count from a cached `/api/likes?key=`), a "most loved" sort in the atlas, comments in a side panel.
5. Legal: a privacy note, data deletion on request, terms for user content.
6. Ship to yourself with `?flags=social`, then to everyone.

## Done (recent)

See docs/CHANGELOG.md.

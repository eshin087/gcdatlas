# Live data for the living planet (phase 5, 0.15)

The back end for today's real clouds, earthquakes and wildfires (`docs/EARTH_PLAN.md`, phase 5). Three functions in `api/`, each a plain
`GET` of its bare path, cached at the edge, no keys, nothing about the visitor sent anywhere. The page uses all three: the clouds since 0.13.0
(`src/objects/e5c-earth-clouds.js`), the earthquakes and fires since 0.26.0 (`src/objects/e1q-earth-quakes.js`). This file says what they
return and how they were meant to be drawn; `docs/CHANGELOG.md` says how they are. Check them against the real upstreams with `node tools/check-live-api.mjs` (it also saves the clouds
picture and the answers to `tools/cache/live/`, which is not committed).

| Endpoint | Source | Size | Run time | Edge cache | Warm copy |
| --- | --- | --- | --- | --- | --- |
| `/api/quakes` | USGS, past 7 days, magnitude 2.5 and over | 21 KB (325 quakes) | 0.1 s | 5 min (+1 h stale) | 4 min |
| `/api/fires` | NASA FIRMS, VIIRS 375 m, last 24 h | 249 KB (12 612 cells) | 1.0 s | 2 h (+6 h stale) | 1 h |
| `/api/clouds` | NASA GIBS, VIIRS true colour, one complete day | 594 KB (JPEG, 2048 x 1024) | 1.8 s | 6 h (+24 h stale) | 3 h |

Sizes and times were measured on 2026-10-03 from a home connection, against the real upstreams. Every response is well under Vercel's 4.5 MB
limit, and each function gives up on its upstream after 8 to 9 s, so it stays inside the 10 s limit.

## `/api/quakes`

```json
{ "updated": "2026-10-04T03:33:15.352Z", "generated": 1791084752, "from": 1790479952, "minMag": 2.5, "n": 325,
  "quakes": [ [1791083317, 18.75, -64.45, 43.1, 2.9, "58 km NE of Cruz Bay, U.S. Virgin Islands"], ... ] }
```

- `quakes` rows: `[time, lat, lon, depth, mag, place]`. Time is seconds since 1970 (UTC). Latitude and longitude are degrees (north and east
  positive, two decimals, about 1 km). Depth is kilometres below the surface (one decimal, 0 to about 700). Magnitude has one decimal (the
  USGS's preferred magnitude, mixed types). The place is the USGS's own words, at most 64 characters, for a readout. Newest first.
- `generated` is the feed's own clock (seconds): "now" for the page's replay. `from` is `generated` minus 7 days. `updated` is when our
  function fetched it. `n` is the number of rows (at most 1500: a huge aftershock sequence keeps the biggest).
- Quarry blasts and explosions are left out. Coverage is uneven: in the United States the list is complete from magnitude 2.5; elsewhere it
  is mostly magnitude 4 and over. Say so in the readout ("magnitude 2.5 and over where measured").

What to draw: a ring on the surface at each quake, its radius growing with magnitude, brighter when new.

- Radius in km: `25 * 2^(mag - 2.5)` (magnitude 2.5: 25 km, 4.5: 100 km, 6: 280 km, 7: 560 km). This is far bigger than the real rupture, so
  the readout says "rings are magnified".
- Brightness by age: full for the first hour, fading to about 20% over a day, a faint small mark for the rest of the week. A ring that
  expands once in its first minutes (a ping) is the nicest touch. With the atlas clock set away from today, use the quake times against the
  clock (a time-lapse of the week) or hide them: they only mean something near now.
- Colour by depth: shallow (under 70 km, about 77% of them) warm, 70 to 300 km yellow-white, deeper than 300 km cool (rare, about 3%). (0.26.0 draws
  them red, violet and blue: warm and yellow-white marks were lost among the orange fires and city lights.)
- Readout when picked: `M 5.9, South Sandwich Islands region, 10 km deep, 3 h ago`.

## `/api/fires`

```json
{ "updated": "2026-10-04T03:33:16.365Z", "source": "VIIRS S-NPP", "from": 1790985480, "to": 1791071880, "cell": 0.1, "raw": 35526, "n": 12612,
  "fires": [ [-31.55, 115.95, 40, 2135], [-16.75, -60.25, 35, 1465], ... ] }
```

- `fires` rows: `[lat, lon, detections, frp]` for one cell of a 0.1 degree grid (about 11 km). Latitude and longitude are the cell's centre in
  degrees (two decimals, always ending in 5). `detections` is how many 375 m fire pixels the satellite saw in the cell. `frp` is their total
  fire radiative power in megawatts (one decimal under 10, whole numbers above). Sorted by `frp`, the strongest first (so a slow device can
  draw the first 3000 and stop). At most 20 000 cells; a typical day gives 10 000 to 15 000.
- `from` and `to` (seconds) are the 24 hours before the newest detection in the file. `source` names the satellite whose file was used
  (`VIIRS NOAA-20`, else `VIIRS NOAA-21`, else `VIIRS S-NPP` if the first fails or is more than 30 hours old; until 0.26.0 S-NPP came first,
  but its file has been empty since early November 2026). `raw` is the number of
  detections added up (those FIRMS rates low in confidence are left out). `updated` is when we fetched it.
- One satellite sees most places twice a day (about 1:30 pm and 1:30 am local time), so this is "what one satellite saw burning in the last
  day", not every fire and not a total over time. Do not add up `frp` over cells and call it the world's fire power.
- Every heat source counts: crop and forest fires, but also gas flares, volcanoes and some industrial furnaces. Call them "fires and heat
  sources" or "active fires", never "wildfires" or "forest fires" in a readout.

What to draw: a glowing point at each cell centre, on the real Earth.

- Brightness: `log2(1 + frp/5) / log2(1 + 2135/5)` (0 to 1; the strongest cell of the day is about 2000 MW, the median cell 7 MW, the 90th percentile 43 MW and the 99th 235 MW, so the median glows at 0.14 and the 99th at 0.64).
  Orange-red, with a small white-hot core for the top few percent. Size from `detections`, a few characters at most.
- By night they are plain lights (draw them next to the city lights, in orange not white). By day they should be dim or hidden unless the
  camera is close: sunlight hides real fires from the eye, and a bright dot in daylight reads as false.
- Readout: `Fire cell: 40 detections, 2135 MW, 24 hours to 3 Oct 23:58 UTC`.
- A smoke haze is not part of this data (it is visible in the clouds picture, the grey drifts).

## `/api/clouds`

A binary answer: the headers say what it is, the body is a JPEG.

```
Content-Type: image/jpeg
Cache-Control: public, s-maxage=21600, stale-while-revalidate=86400
X-Clouds-Date: 2026-10-02
X-Clouds-Layer: VIIRS_NOAA21_CorrectedReflectance_TrueColor
```

- The picture is 2048 x 1024, equirectangular: x runs from longitude -180 (left edge) to +180, y from latitude +90 (top) to -90 (bottom),
  like `assets/earth/global-color-*`. About 0.18 degrees (20 km at the equator) a pixel.
- It is the daily true-colour composite of NASA's VIIRS cameras (NOAA-21, or NOAA-20 when its file is fuller), the whole globe as seen at
  about 1:30 pm local solar time on the UTC day in `X-Clouds-Date`. It is a snapshot of that day, not a live view: each place was seen on
  one pass. The date is 1 to 2 days behind (GIBS finishes a day a few hours after it ends, so the function uses the last day that ended at
  least 9 hours ago).
- **Black pixels (RGB all under 10 of 255) mean no data**: the polar night at whichever pole has winter (in October the north, above about 70
  degrees), and, now and then, a sliver along the date line or at the bottom where the day's last orbits are still
  being added. Treat them as "no cloud information" (no cloud), never as dark cloud.
- The surface and clouds are both in the picture; the page has to take the clouds out. Tested on the October picture against the monthly
  colour map (`global-color-10`): `cloud = smoothstep(0.42, 0.85, min(r, g, b))`, with nodata forced to 0. Clouds come out white, thin cirrus
  grey, the Sahara, Australia, the forests and the sea come out dark, and the grey sun-glint streaks on the sea do not count as cloud.
  Subtracting the monthly map instead was worse (it kept the glint streaks and noise). Snow and ice (Antarctica, Greenland, the Arctic, the
  high Himalaya) are white too and so count as cloud: either let them (white on white), or fade the cloud where the monthly map is already
  white (`1 - smoothstep(0.75, 0.92, min(base))`).
- Do the extraction once on the CPU when the picture arrives (draw it to a canvas, read the pixels, keep `min(r, g, b)` as an 8-bit
  texture, 2 MB) rather than per pixel on the GPU. Wrap longitude (`REPEAT`) and clamp latitude. The picture's left and right edges are
  hours apart (the day begins and ends there), so a faint seam on the date line over the Pacific is real.
- Draw it as a thin shell over the real Earth (a little above the surface, its own shadow on the ground by day), turned by the same Earth
  rotation as the colour map. Caption it with its date: `Clouds of 2 Oct (NASA GIBS, VIIRS)`. Show these clouds only when the atlas
  clock is within about a day of the picture's date (by the atlas clock, `X-Clouds-Date` plus 0 to 2 days); other days keep the page's own
  clouds, or none, since the weather is not the same.
- At 2048 x 1024 the pixels are 20 km wide: fine from space, soft from low orbit. Add a little noise detail in the shader when close.

### Other ways to get clouds that were tried, and why not

- **Geostationary infrared and GeoColor** (GIBS has GOES-East, GOES-West and Himawari, every 10 minutes, really current): they cover only
  about two thirds of the globe, with nothing over the Indian Ocean, east Africa and Europe (no Meteosat on GIBS), and the infrared band is a
  false-colour picture that does not show low cloud. Not enough for a whole planet.
- **MODIS Terra or Aqua true colour**: the daily mosaic has swath gaps (black wedges, 5 to 19% of the mid-latitudes). VIIRS's wider swath
  has none.
- **Cloud fraction, clear-sky confidence, optical thickness** (MODIS and VIIRS): false-colour pictures, one palette per layer, and a
  cloud-or-not mask with no cloud shape. MODIS's cloud fraction also took 14 s on its first request. Not worth decoding a palette.
- **Stacking several sensors in one request to fill the gaps**: GIBS draws the top layer's black as opaque, so the lower layers never show
  (tested: the answer was byte for byte the top layer's). Merging pictures would need a JPEG decoder, and a function has none.
- **The day after midnight**: GIBS's picture for the day in progress is mostly empty (19 KB at 03:30 UTC), and a day that has just ended
  lacks its last orbits for some hours (2 to 11% of the mid-latitudes missing 3.5 hours after the day ended, 0 to 0.2% a day later). That is why the 9-hour lag; the
  function also skips a picture under 250 KB and then tries the day before.
- **Bigger or smaller**: 4096 x 2048 is 2.1 MB and took 5 s upstream (it fits Vercel's limit; change `W` and `H` in `api/clouds.js`, and
  keep `MIN` and the doc's numbers in step); 1024 x 512 is 163 KB.

## Credits and licences

All three are free to use. Put the short line in the readout while the layer shows, and the full text on the page's credits list
(`docs/ACCURACY.md`, the help, the repository's credits).

| Data | Licence | Short line (readout) | Full text |
| --- | --- | --- | --- |
| Earthquakes, USGS | US government work, public domain (no licence needed; the USGS asks to be named as the source) | `Earthquakes: USGS, past 7 days.` | "Earthquake data: U.S. Geological Survey, Earthquake Hazards Program." |
| Fires, NASA FIRMS | NASA open data, no restriction; provided as is | `Fires: NASA FIRMS, VIIRS, last 24 hours.` | "We acknowledge the use of data and/or imagery from NASA's Fire Information for Resource Management System (FIRMS) (https://earthdata.nasa.gov/firms), part of NASA's Land, Atmosphere Near real-time Capability for Earth observations (LANCE) and NASA's Earth Science Data and Information System (ESDIS)." (the text NASA gives) |
| Clouds, NASA GIBS | NASA open data, no restriction (EOSDIS: generally CC0; NASA "should be acknowledged as the source") | `Clouds: NASA GIBS, VIIRS, 2 Oct.` | "We acknowledge the use of imagery provided by services from NASA's Global Imagery Browse Services (GIBS), part of NASA's Earth Science Data and Information System (ESDIS)." (the text GIBS gives) |

The FIRMS and GIBS sentences are NASA's own, read from their pages on 2026-10-03. The USGS wording and its public-domain status are from
USGS's general policy for its own data (not re-read here: its credit page returned 404 on 2026-10-03, and its feeds page only said they are
updated every minute), so check them before the release.

## Accuracy notes (for `docs/ACCURACY.md`)

- Earthquakes are measured data (USGS, preferred magnitude and location, some still automatic and revised later). The rings are drawn
  far larger than the real rupture. Coverage outside the United States is mostly magnitude 4 and over.
- Fires are measured detections by one satellite, summed in 11 km cells. They include gas flares, volcanoes and industrial heat. The glow
  is a drawing of their power, not their size.
- Clouds are real, from the last complete day, one pass per place at about 1:30 pm local time, taken from a true-colour picture (so
  snow can pass for cloud). They are not live, and not the same moment everywhere.

## Failure modes

Each function keeps its last good answer in the warm instance, and Vercel's edge keeps its copy for the "stale" time in the table, so a
short upstream outage is invisible. Past that:

- **Upstream down or slow**: the function logs it (`console.error`, never sent to the visitor) and serves the last good answer. With no copy
  at all (a brand new instance during an outage) it answers `502 {"error":"... unavailable"}`, which the edge keeps for 10 minutes. The page
  must treat any non-200 as "no live layer" and keep working with what it has (the page's own clouds, no rings, no fires). Never block or
  retry in a loop; once per page load is enough, and again after the cache time if the page stays open (quakes 5 min, fires 2 h, clouds 6 h).
- **Offline, the artifact build (`dist/artifact.html`, no `/api`), or `file://`**: the fetch fails; same handling.
- **Query strings** get `404` and other methods `405` (see `api/_lib/guard.js`); the page must call the bare path.
- **Stale data**: quakes carry `generated`, fires `to`, clouds `X-Clouds-Date`. If a quake list is over an hour old or fires over 30 hours
  old, say how old in the readout; if clouds are over 3 days old, hide them.
- **A bad file from upstream**: the function refuses an empty list (quakes: none; fires: under 500 cells or a file whose newest detection is
  over 30 hours old, then it tries the next satellite; clouds: not a JPEG, under 250 KB or over 3.5 MB, then the day before). That falls
  back to the last good answer like any failure.
- **GIBS slow on a first request**: one false-colour layer took 14 s cold; the true-colour pictures took 1.4 to 5 s. The function gives up at
  9 s and serves the old picture.
- **FIRMS changes its columns**: the function finds columns by name and refuses a file without them.
- **Time**: all times are UTC. The warm copy and the edge's copy are not synchronised, so two visitors in the same minute can see answers a
  few minutes apart; it does not matter here.

## Changes wanted in shared files (made in 0.13.0 and 0.26.0)

- `docs/SECURITY.md`: "three read-only serverless functions" becomes six, naming `/api/quakes`, `/api/fires`, `/api/clouds`; the cache
  table row adds quakes 5 min, fires 2 h, clouds 6 h and the warm times (4 min, 1 h, 3 h); "No API keys are needed (CelesTrak, Launch
  Library 2 and Open-Meteo are public)" adds USGS, NASA FIRMS and NASA GIBS. Say once that these three take nothing from the request and
  fetch only fixed URLs (the SSRF row already says so for the others). Add a line that the clouds function returns an image and forwards no
  upstream header (it sets its own `X-Clouds-*` ones).
- `CLAUDE.md`, golden rule 6 (privacy): the list of network calls adds "our own `/api/quakes`, `/api/fires` and `/api/clouds` (0.15)".
  `docs/FEATURE_FLAGS.md`: a flag for the live layers (default false until the owner has seen it), since they touch the network.
- `vercel.json`: nothing is required. The functions need no packages (`installCommand` stays `echo no-install`) and no headers beyond the
  global ones (`nosniff` is right for the JPEG). If the owner wants headroom for a slow GIBS or FIRMS, add
  `"functions": { "api/fires.js": { "maxDuration": 15 }, "api/clouds.js": { "maxDuration": 15 } }` (the code itself gives up at 9 s, so
  it would also need `left` and the 9000 in those two files raised). If a Content Security Policy is added later (see `docs/SECURITY.md`),
  these are all same-origin (`connect-src 'self'`, and `img-src 'self' blob:` if the clouds go through a `blob:` URL).
- `api/_lib/guard.js` changed (backward compatible: the existing three endpoints are unchanged): `cachedHandler` takes an optional `type`
  (the content type, default JSON), and `load()` may return a Buffer or `{ body, headers }`.
- `tests/`: `npm test` does not touch `/api`. `node tools/check-live-api.mjs` is the check for these three (it needs the network).

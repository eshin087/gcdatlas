# The real Earth: plan

The owner's request (2026-10-03): draw the whole Earth in ASCII from real, public data (land, oceans, mountains, cities,
iconic places), with cities that look alive, without losing speed. It is too big for one session, so it ships in phases, one
release and one pull request each. This file is the plan; `docs/CHANGELOG.md` says what each release actually did.

## The owner's choices (2026-10-03)

- **Hosting:** the tiles live in the repo, curated. The whole planet goes down to about 2.4 km a pixel (about 60 MB). Fine
  detail only at chosen places and cities. The tile format must allow a move to bigger storage (Cloudflare R2 on a subdomain)
  later without rework.
- **First:** the real Earth from space (phase 1).
- **Look:** like the launch sites: real colours turned into characters by brightness, as everywhere else in the atlas.
- **Seasons:** Earth's colours follow the atlas clock's month (NASA's 12 monthly images).
- **Cities alive:** all four:
  - traffic and city lights by local time
  - 3D buildings
  - planes landing and taking off at the real airports, and ships
  - each city's own sun, clock and current weather
- **Iconic places:** all four groups:
  - mountains and canyons
  - deserts, rivers and forests
  - coasts, islands and ice
  - man-made wonders
- **Cities first:** New York, Tokyo, Dubai, London and Paris.
- **Live data:** yes, last (phase 5): today's clouds, earthquakes and wildfires, fetched by our own `/api`, cached, with
  nothing about the visitor sent.

## How it stays fast

- **Tiles made ahead of time.** Tools in `tools/` turn public data into WebP files (colour, height, depth, light), served from
  our own domain under `/earth/`. The page fetches nothing from anyone else.
- **Only what the camera needs.** A global level is fetched when the camera nears Earth. Finer tiles come only where the
  camera looks, within a fixed GPU budget, and the oldest go first. Phones get smaller files and a smaller budget.
- **One shader.** Earth's look stays one program, compiled in the background (like `P.earthEd`). Loops start from a hidden 0
  and noise calls stay few, as for every shader here: on Direct3D each unrolled copy costs compile time.
- **Cities only when seen.** A city's traffic, buildings and planes run only while it is on the screen, as GPU particles in
  one draw.

## Data (all public, free to reuse; credits in `docs/ACCURACY.md`)

| What | Source | Licence |
| --- | --- | --- |
| Colour, 12 months | NASA Blue Marble Next Generation (2004), with topography and bathymetry, 5400 x 2700 | public domain (NASA) |
| Land height, ocean depth | GEBCO 2008 grids from NASA, 21600 x 10800 | public domain (GEBCO / NASA) |
| Night lights | NASA Black Marble 2016 | public domain |
| Finer heights (phase 2+) | AWS Terrain Tiles (SRTM, ETOPO), Copernicus DEM | free with credit |
| Land types (phase 2+) | ESA WorldCover | CC BY 4.0 |
| Coasts, rivers, names | Natural Earth | public domain |
| Cities, peaks (search) | GeoNames | CC BY 4.0 |
| Buildings, roads, airports | OpenStreetMap | ODbL (credit) |
| Fine photos (phase 3+) | Sentinel-2 (everywhere), NAIP and NOAA (United States) | free with credit |
| Live (phase 5) | NASA GIBS daily images, USGS earthquakes, NASA FIRMS fires | free |

## Progress

- Phase 1: 0.11.0, merged (PR #42).
- Phase 2: 0.12.0, merged (PR #43). Tiles to 2.4 km a pixel (31 MB), the ground in 3D anywhere, places on Earth in the search.
- Phase 4, first part: 0.13.0. The five cities in 3D, tower lights, local time and weather; with it the real clouds (phase 5's back end, brought forward), Google Earth-like moves near surfaces, marks on the globe and a zoom that lands on places. The second part (traffic, planes, ships) is 0.14.0.
- Phase 4, second part: 0.14.0. Traffic on the real roads by local hour, simulated planes on the real runways into the real wind, boats on the ferry routes, Tokyo Tower and the Skytree as models.
- 0.20.0: Las Vegas as it is in October 2026, with the Sphere, the High Roller, the Luxor and its beam, the STRAT, the Fremont Street canopy, the Fountains of Bellagio, and Hard Rock's guitar tower and the Athletics' ballpark under construction.
- 0.19.0: six more cities (Hong Kong, San Francisco, Sydney, Rome, Los Angeles, Rio de Janeiro) with six landmark models.
- 0.17.0: the cities in an architectural-model style, their traffic and planes visible from afar (owner's review of 0.14.0 and 0.15.0).
- Phase 3: 0.15.0. 30 famous places in 3D (`e9p-earth-places.js`): their layers drawn near the ground like the cities', an object each with its framings, fact and credits, reached from the atlas's "on Earth" list (19 rows added, 7 of them in a new kind, "built by people"), the marks on the globe and the search, and a tour, wonders of Earth.
- Phases 3 to 5: their data was prepared in parallel on local branches. Each phase's release takes its branch in:
  - `data/earth-places`: the iconic places' layers (`tools/earth-places.mjs`);
  - `data/earth-cities`: the five cities' layers, roads, runways and towers (`tools/earth-cities.mjs`);
  - `data/earth-live`: `/api/quakes`, `/api/fires`, `/api/clouds` (`docs/LIVE_DATA.md`).

## Phases

1. **0.11, real Earth from space.**
   - Real colours by month, with relief and ocean depth, and sharper night lights.
   - Fetched when the camera nears Earth: about 1 MB a month, plus a 1 MB data map (2048 px on phones, 4096 px on a desk).
   - The old inline map stays until they arrive, and offline.
2. **0.12, fly down anywhere.**
   - A global tile pyramid to about 2.4 km a pixel, streamed by the camera.
   - Heights ray-marched near the ground, so mountain ranges stand up in oblique views (generalising the launch sites'
     `FS_SX_ENV` from 3 sites to any point).
   - Search for cities and peaks by name (GeoNames).
3. **0.13, iconic places.**
   - 20 to 40 places with nested fine layers like the launch sites (`tools/earth-detail.mjs` generalised), each an atlas
     entry with views and a tour.
   - Everest and the Himalaya, the Grand Canyon, the Alps, Kilimanjaro, Fuji.
   - The Sahara, the Amazon, the Nile delta, Uluru, the Okavango.
   - The Great Barrier Reef, Hawaii, Iceland, Antarctica's ice shelves, Greenland's glaciers.
   - The Palm islands, the Panama Canal, the Great Wall, Giza.
4. **0.14, cities alive.**
   - New York, Tokyo, Dubai, London and Paris.
   - OpenStreetMap buildings standing up, traffic as head and tail lights on the real roads (busier at rush hour, by local
     time), lights by night, blinking lights on towers.
   - Planes on the real runways (the air traffic already simulated), ships in the ports and along shipping lanes.
   - Each city's own weather through `/api/weather`, extended.
5. **0.15, living planet.** Today's real clouds (NASA GIBS), earthquakes (USGS), fires (FIRMS), through our own cached `/api`.

Each phase: build, screenshots of every new view on a desk and a phone, `npm test`, the D3D11 compile time of any changed
shader, a pull request with its Vercel preview, and a merge only when the owner says so.

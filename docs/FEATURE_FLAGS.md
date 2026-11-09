# Feature flags

Flags let a feature ship switched off, be tried by one person in production, and be removed later without hunting through the code.

## Where they are

`src/04-world.js`:

```js
const FLAGS = (() => {
  const f = { live:true, launches:true, planes:true, backyard:true, earthStory:true, social:false, spacex:true, realEarth:true, analytics:true, livePlanet:true, realMoon:true };
  ...
})();
```

| Flag | Default | Controls |
| --- | --- | --- |
| `live` | on | fetching `/api/sats` (real satellites, ISS and Hubble positions) |
| `launches` | on | fetching `/api/launches` (launch pads, next launches) |
| `planes` | on | illustrative air traffic near Earth |
| `backyard` | on | *your sky* (planetarium) |
| `earthStory` | on | *Earth's story* |
| `social` | off | reserved for comments / likes / listings (not built yet) |
| `realEarth` | on | Earth's real colours by month, its lit relief and sharper night lights from maps fetched under `/earth/` when Earth is near (`src/objects/e5-earth-global.js`); since 0.12.0 also the finer tiles (`e7-earth-tiles.js`), the ground anywhere (`e7g-earth-ground.js`) and places on Earth in the search (`e7s-earth-search.js`); since 0.13.0 the five cities in 3D (`e9c-earth-cities.js`); since 0.15.0 the famous places in 3D and their tour (`e9p-earth-places.js`), the places marked on the globe and, with `live`, the real clouds (`e5c-earth-clouds.js`, `/api/clouds`). Off: the painted map, and the search finds only the atlas. |
| `spacex` | on | SpaceX rockets on their pads, their flights (real, clicked and replays), the launch camera and the ground near a pad (`src/objects/s2-spacex-gl.js` to `s4-spacex-run.js`), and the real ground round the launch sites (`e2-earth-detail-data.js`, `e3-earth-detail.js`: our own images under `/earth/`), the weather over them (`/api/weather`), the launch's sound, shake and smoke |
| `livePlanet` | on | this week's earthquakes and the last day's fires on the real Earth (`src/objects/e1q-earth-quakes.js`, 0.26.0): fetches `/api/quakes` and `/api/fires` while Earth is near (it also needs `realEarth` and `live`). Visitors switch the drawing off in settings (show: quakes & fires, `SET.quakes`); the flag removes the feature, the switch included. |
| `realMoon` | on | The real Moon (0.27.0): NASA's map of the whole Moon on its globe (`src/objects/m1-moon-map.js`), the nine places on it in 3D with their landers, their tour and their marks on the globe (`m3-moon-detail.js`, `m4-moon-places.js`), from our own images under `/moon/`. Off: the painted Moon, and no places on it. |
| `analytics` | on | counting visits with Vercel Web Analytics (`src/09v-visits.js`, 0.17.1): one page view per page load, the path only, on gcdatlas.com and `*.vercel.app` only, never with Global Privacy Control or Do Not Track, never on `/lab` or `/songs`. Loads `/_vercel/insights/script.js` from our own domain. The place pages (`/places`, 0.24.1) read the same flag from the URL or `gcdatlas.flags`. |

## Turning a flag on or off for yourself

- In the address bar: `https://gcdatlas.vercel.app/?flags=social,-planes` (on: `name`, off: `-name`). This applies to that visit only (a shared link must not change anyone's settings for good).
- To keep a choice in this browser, set `gcdatlas.flags` in localStorage, e.g. `localStorage.setItem('gcdatlas.flags', JSON.stringify({ social:true }))`. Only known flag names with true/false values are read.

## Adding a flag

1. Add it with its default to the object in `src/04-world.js` and a row to the table above.
2. Check it at the edges of the feature: where its code is wired in (a button's visibility, a `fetch`, a particle system's `show`), not deep inside it.
3. Keep the feature's code in its own file where possible, so removing it later is deleting a file and the few lines that check the flag.

## Retiring a flag

When a feature has been on for everyone for a release or two and is staying, delete the flag and its checks. When it is scrapped, delete its files and checks. Note either in the changelog.

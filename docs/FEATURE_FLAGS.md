# Feature flags

Flags let a feature ship switched off, be tried by one person in production, and be removed later without hunting through the code.

## Where they are

`src/04-world.js`:

```js
const FLAGS = (() => {
  const f = { live:true, launches:true, planes:true, backyard:true, earthStory:true, social:false };
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

## Turning a flag on or off for yourself

- In the address bar: `https://gcdatlas.vercel.app/?flags=social,-planes` (on: `name`, off: `-name`). The choice is remembered in this browser.
- Reset: `?flags=` with the defaults you want, or clear `gcdatlas.flags` in the browser's storage.

## Adding a flag

1. Add it with its default to the object in `src/04-world.js` and a row to the table above.
2. Check it at the edges of the feature: where its code is wired in (a button's visibility, a `fetch`, a particle system's `show`), not deep inside it.
3. Keep the feature's code in its own file where possible, so removing it later is deleting a file and the few lines that check the flag.

## Retiring a flag

When a feature has been on for everyone for a release or two and is staying, delete the flag and its checks. When it is scrapped, delete its files and checks. Note either in the changelog.

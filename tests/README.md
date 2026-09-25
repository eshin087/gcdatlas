# tests

Playwright tests that drive the real page in headless Chromium. See `docs/TESTING.md`.

- `smoke.mjs`: loads, renders every object, opens the panels (`npm test`)
- `tour.mjs`: 1,000 simulated seconds of the grand tour, then manual controls (`npm run test:tour`)
- `mobile.mjs`: the phone layout upright and on its side: dock, info card, scale chip, atlas, idle fade (`npm run test:mobile`, also part of `npm test`)
- `shots.mjs`: screenshots of objects and views (`npm run shots -- sun:0,ton618:1`)
- `lib.mjs`: shared helpers

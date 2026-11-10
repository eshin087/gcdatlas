# tests

Playwright tests that drive the real page in headless Chromium. See `docs/TESTING.md`.

- `smoke.mjs`: loads, renders every object, opens the panels (`npm test`)
- `tour.mjs`: 1,000 simulated seconds of the grand tour, then manual controls (`npm run test:tour`)
- `mobile.mjs`: the phone layout upright and on its side: dock, info card, scale chip, atlas, idle fade (`npm run test:mobile`, also part of `npm test`)
- `motion.mjs`: the angle loop, play / pause, flights that land smoothly on a moving destination, riding along with the Halo and the Halo at work, the random tour, on a fixed clock and a fixed Halo route, with `Math.random` seeded and no launch replays, so every run prints the same report (`npm run test:motion`, also part of `npm test`; `HALO_SEED=n` for another route)
- `pipsmooth.mjs`: Pip and the cameras on the Halo without jumps: every tick of each of Pip's bits, its launches and ways home, a hurry, the jobs it helps with, whole stays and the Halo tour, riding along and locked on, desk and phone; fails on a teleport, a jerk or a camera cut (`node tests/pipsmooth.mjs`; `--only=name`, `--verbose`, `--dump=t0-t1`, `PIP_SEED=n` for other routes)
- `music.mjs`: every music style equally loud and never clipping, the shuffle rules, and a one-minute WAV of each style in `tests/out/music/` (`npm run test:music`)
- `shots.mjs`: screenshots of objects and views (`npm run shots -- sun:0,ton618:1`)
- `lib.mjs`: shared helpers

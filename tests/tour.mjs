// Tour regression: plays the grand tour for 1,000 simulated seconds, then locks on, zooms, orbits and flies.
import { openPage, report } from './lib.mjs';
const { browser, page, errors } = await openPage({ width:1000, height:700 });
const seen = new Set();
for (let k = 0; k < 200; k++){
  const s = await page.evaluate(() => { const c = window.__cosmos, r = c.simulate(5); c.render(); return { key:c.OBJ[r.obj].key, nan:!isFinite(c.cam.rel[0]) || !isFinite(c.orbit.dist) }; });
  seen.add(s.key); if (s.nan) errors.push('NaN camera at step ' + k);
}
const lock = await page.evaluate(() => { const c = window.__cosmos; c.lockOn(c.BYKEY.crab.index); c.simulate(14); return c.OBJ[c.orbit.lock].key; });
if (lock !== 'crab') errors.push('lockOn crab ended on ' + lock);
await page.mouse.move(500, 350); for (let i = 0; i < 30; i++){ await page.mouse.wheel(0, 600); await page.waitForTimeout(30); }
await page.mouse.down(); await page.mouse.move(600, 380, { steps:5 }); await page.mouse.up();
await page.keyboard.down('w'); await page.waitForTimeout(600); await page.keyboard.up('w');
report('tour', errors, `${seen.size} stops visited`);
await browser.close();

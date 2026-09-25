// Smoke test: the page loads, every object renders a frame from its first view, panels open, no errors or NaNs.
import { openPage, report } from './lib.mjs';
const { browser, page, errors } = await openPage();
const keys = await page.evaluate(() => window.__cosmos.OBJ.filter(o => !o.marker && o.views && o.views.length).map(o => o.key));
const bad = [];
for (let i = 0; i < keys.length; i += 8){
  const chunk = keys.slice(i, i + 8);
  const r = await page.evaluate(ks => { const c = window.__cosmos, out = [];
    for (const k of ks){ c.setTour(false); c.view(k, 0); c.tick(1/30); c.render();
      if (!isFinite(c.cam.rel[0]) || !isFinite(c.orbit.dist)) out.push(k + ': NaN camera'); }
    return out; }, chunk);
  bad.push(...r);
}
for (const id of ['#btnAtlas', '#btnTours', '#btnTime', '#btnSettings']){ await page.click(id); await page.waitForTimeout(150); await page.click(id); }
const ui = await page.evaluate(() => ({ rows:document.querySelectorAll('.arow').length, readout:document.querySelector('#readout').textContent.length }));
if (ui.rows < 50) bad.push('atlas has only ' + ui.rows + ' rows');
errors.push(...bad);
report('smoke', errors, `${keys.length} objects rendered, ${ui.rows} atlas rows`);
await browser.close();

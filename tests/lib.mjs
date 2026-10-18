// Shared helpers for the Playwright tests. Headless Chromium draws WebGL with SwiftShader (slow but correct).
import { chromium } from 'playwright';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const PAGE = 'file://' + path.join(ROOT, 'dist', 'index.html');
export const OUT = path.join(ROOT, 'tests', 'out');
// fade: let the interface fade when idle (off by default so clicks and screenshots are predictable)
// now: a fixed date and time for the page (ms since 1970), so the Solar System starts in the same place on every run
// freeze: the page's own animation loop draws nothing and moves nothing; only the test moves the simulation (__cosmos.tick), so no
// frames of real, machine-dependent length slip in between two steps of a test
// settings: saved settings to start with; init: a function run in the page before its scripts
export async function openPage({ width = 1280, height = 800, phone = false, fade = false, now = null, freeze = false, settings = null, init = null, url = null } = {}){
  if (!fs.existsSync(path.join(ROOT, 'dist', 'index.html'))) throw new Error('build first: node build.mjs');
  const browser = await chromium.launch({ args:['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const context = await browser.newContext(phone ? { viewport:{ width:390, height:844 }, deviceScaleFactor:2, isMobile:true, hasTouch:true } : { viewport:{ width, height } });
  const page = await context.newPage();
  if (now != null) await page.clock.setFixedTime(now);
  const errors = [];
  // (a script error before the page is up, such as addObj refusing a key already taken, stops the page: say so at once, not after a 60 s wait)
  let started = false, fail; const failed = new Promise((_, no) => { fail = no; }); failed.catch(() => {});
  page.on('pageerror', e => { errors.push('pageerror: ' + e.message); if (!started) fail(new Error('the page did not start: ' + e.message)); });
  page.on('console', m => { if (m.type() === 'error' && !/ERR_|Failed to load resource/.test(m.text())) errors.push('console: ' + m.text().slice(0, 300)); });
  // compile shaders synchronously and keep full quality, so screenshots are deterministic; skip the daily card
  await page.addInitScript(({ fade, freeze, day, settings }) => { window.__noAdapt = true; window.__syncCompile = true; if (freeze) window.__freeze = true; try { localStorage.setItem('gcdatlas.dailySeen', JSON.stringify(day)); if (!fade || settings) localStorage.setItem('gcdatlas.settings', JSON.stringify({ ...(fade ? {} : { fadeUI:'off' }), ...settings })); } catch (e) {} }, { fade, freeze, day:new Date(now ?? Date.now()).toISOString().slice(0, 10), settings });
  if (init) await page.addInitScript(init);
  await page.goto(url || PAGE);   // (url: over http, for what loads only there, such as the Earth's images: tests/earth.mjs)
  await Promise.race([page.waitForFunction(() => window.__cosmos && window.__cosmos.OBJ, null, { timeout:60000 }), failed]).catch(async e => { await browser.close(); throw e; });
  started = true;
  return { browser, page, errors };
}
export function report(name, errors, extra = ''){
  if (errors.length){ console.error(`FAIL ${name}\n` + errors.slice(0, 20).join('\n')); process.exitCode = 1; }
  else console.log(`ok ${name}${extra ? ' · ' + extra : ''}`);
}

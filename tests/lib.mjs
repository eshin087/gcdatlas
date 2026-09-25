// Shared helpers for the Playwright tests. Headless Chromium draws WebGL with SwiftShader (slow but correct).
import { chromium } from 'playwright';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const PAGE = 'file://' + path.join(ROOT, 'dist', 'index.html');
export const OUT = path.join(ROOT, 'tests', 'out');
// fade: let the interface fade when idle (off by default so clicks and screenshots are predictable)
export async function openPage({ width = 1280, height = 800, phone = false, fade = false } = {}){
  if (!fs.existsSync(path.join(ROOT, 'dist', 'index.html'))) throw new Error('build first: node build.mjs');
  const browser = await chromium.launch({ args:['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const context = await browser.newContext(phone ? { viewport:{ width:390, height:844 }, deviceScaleFactor:2, isMobile:true, hasTouch:true } : { viewport:{ width, height } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/ERR_|Failed to load resource/.test(m.text())) errors.push('console: ' + m.text().slice(0, 300)); });
  // compile shaders synchronously and keep full quality, so screenshots are deterministic; skip the daily card
  await page.addInitScript(fade => { window.__noAdapt = true; window.__syncCompile = true; try { localStorage.setItem('gcdatlas.dailySeen', JSON.stringify(new Date().toISOString().slice(0, 10))); if (!fade) localStorage.setItem('gcdatlas.settings', JSON.stringify({ fadeUI:'off' })); } catch (e) {} }, fade);
  await page.goto(PAGE);
  await page.waitForFunction(() => window.__cosmos && window.__cosmos.OBJ, null, { timeout:60000 });
  return { browser, page, errors };
}
export function report(name, errors, extra = ''){
  if (errors.length){ console.error(`FAIL ${name}\n` + errors.slice(0, 20).join('\n')); process.exitCode = 1; }
  else console.log(`ok ${name}${extra ? ' · ' + extra : ''}`);
}

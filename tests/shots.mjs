// Screenshots: npm run shots -- sun:0,ton618:1 [--phone] [--wait=2500]  ->  tests/out/<key>_<view>.png and tests/out/sheet.png
import { openPage, OUT, report } from './lib.mjs';
import fs from 'node:fs';
import path from 'node:path';
const args = process.argv.slice(2), phone = args.includes('--phone'), wait = +((args.find(a => a.startsWith('--wait=')) || '--wait=2500').slice(7));
const list = (args.find(a => !a.startsWith('--')) || 'earth:0').split(',').map(s => s.split(':'));
fs.mkdirSync(OUT, { recursive:true });
const { browser, page, errors } = await openPage({ phone });
const files = [];
for (const [k, v = '0'] of list){
  await page.evaluate(([k, v]) => { const c = window.__cosmos; c.setTour(false); c.view(k, +v); }, [k, v]);
  await page.waitForTimeout(wait);
  const f = path.join(OUT, `${k}_${v}${phone ? '_phone' : ''}.png`); await page.screenshot({ path:f }); files.push(f);
}
await browser.close();
try {
  const sharp = (await import('sharp')).default, W = 640, H = phone ? 1386 : 400, cols = phone ? 3 : 2, rows = Math.ceil(files.length/cols);
  const tiles = await Promise.all(files.map(async (f, i) => ({ input:await sharp(f).resize(W, H).toBuffer(), left:(i % cols)*W, top:Math.floor(i/cols)*H })));
  await sharp({ create:{ width:W*cols, height:H*rows, channels:3, background:'#000' } }).composite(tiles).png().toFile(path.join(OUT, 'sheet.png'));
} catch (e) { console.log('(install sharp for a contact sheet)'); }
report('shots', errors, files.length + ' files in tests/out');

// Phone layout regression: the dock fits, the info card sits above it and can be expanded, collapsed and hidden,
// the scale chip opens the ladder, the interface fades when idle and the first tap only brings it back.
// Screenshots of every state go to tests/out/mobile/. Usage: node tests/mobile.mjs
import { openPage, report, OUT } from './lib.mjs';
import path from 'node:path';
import fs from 'node:fs';

const dir = path.join(OUT, 'mobile'); fs.mkdirSync(dir, { recursive:true });
const { browser, page, errors } = await openPage({ phone:true, fade:true });
const shot = n => page.screenshot({ path:path.join(dir, n + '.png') });
const fail = m => errors.push('check: ' + m);
const rect = sel => page.evaluate(s => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return { top:r.top, bottom:r.bottom, left:r.left, right:r.right, w:r.width, h:r.height, shown:r.height > 0 && getComputedStyle(e).display !== 'none' && getComputedStyle(e).opacity !== '0' }; }, sel);
const has = cls => page.evaluate(c => document.body.classList.contains(c), cls);
const wake = () => page.evaluate(() => dispatchEvent(new PointerEvent('pointermove', { pointerType:'touch', bubbles:true })));

// fading is tested on its own below; keep the interface put while the buttons are checked
const fade = v => page.evaluate(v => __cosmos.setOpt('fadeUI', v, true), v);
await fade('off');
await page.waitForTimeout(1500);
await wake();
await shot('1-start');

// the dock: every button on screen, nothing wraps or overflows
const dock = await page.evaluate(() => {
  const c = document.querySelector('.controls'), r = c.getBoundingClientRect();
  const btns = [...c.querySelectorAll('.btn')].filter(b => getComputedStyle(b).display !== 'none');
  return { top:r.top, over:c.scrollWidth - c.clientWidth, n:btns.length, off:btns.filter(b => { const q = b.getBoundingClientRect(); return q.left < 0 || q.right > innerWidth || q.top < r.top - 1; }).map(b => b.id) };
});
if (dock.over > 1 || dock.off.length) fail('dock overflows: ' + JSON.stringify(dock));
if (dock.n < 5) fail('dock has only ' + dock.n + ' buttons');
const card = await rect('#info');
if (!card || card.bottom > dock.top + 1) fail('info card overlaps the dock: ' + JSON.stringify(card));
if (card && card.h > 200) fail('compact info card is too tall: ' + card.h + 'px');
const lad = await rect('#ladder');
if (lad && lad.shown) fail('the ladder should fold away on phones');

// more / less / hide
await page.tap('#infoMore'); await page.waitForTimeout(400); await shot('2-card-full');
const full = await rect('#info');
if (!(full.h > card.h + 40)) fail('"more" did not expand the card');
await page.tap('#infoMore'); await page.waitForTimeout(300);
await page.tap('#infoHide'); await page.waitForTimeout(400); await shot('3-card-hidden');
if (!(await has('info-hidden')) || !(await rect('#infoPill')).shown) fail('hide did not leave the pill');
await page.tap('#infoPill'); await page.waitForTimeout(300);
if (await has('info-hidden')) fail('the pill did not bring the card back');

// the scale chip opens the ladder; a tap elsewhere closes it without flying anywhere
await page.tap('#ladChip'); await page.waitForTimeout(400); await shot('4-ladder-open');
if (!(await rect('#ladder')).shown) fail('the chip did not open the ladder');
const lockBefore = await page.evaluate(() => __cosmos.orbit.lock);
await page.touchscreen.tap(60, 420); await page.waitForTimeout(400);
if (await has('lad-open')) fail('a tap outside did not close the ladder');

// the atlas opens above the dock and the object is re-framed into the space left
await page.tap('#btnAtlas'); await page.waitForTimeout(1200); await shot('5-atlas');
const atl = await rect('#atlas');
if (!atl || atl.bottom > dock.top + 1) fail('atlas overlaps the dock');
await page.tap('#atlasClose'); await page.waitForTimeout(300);

// idle: on a tour the interface fades after a few seconds; the first tap only brings it back and the tour keeps going
await page.evaluate(() => { __cosmos.startTour('grand'); });
await fade('quick'); await page.waitForTimeout(500); await wake();
await page.waitForFunction(() => document.body.classList.contains('ui-idle'), null, { timeout:15000 }).catch(() => fail('the interface did not fade on a tour'));
await page.waitForTimeout(1300); await shot('6-tour-idle');
await page.touchscreen.tap(195, 400); await page.waitForTimeout(500);
if (await has('ui-idle')) fail('a tap did not bring the interface back');
if (!(await page.evaluate(() => __cosmos.tour.on))) fail('the wake-up tap stopped the tour');
await shot('7-tour-awake');
void lockBefore;
await fade('off');

// dragging breaks the tour: the card offers "resume tour", which picks it up again
await page.mouse.move(120, 300); await page.mouse.down(); await page.mouse.move(210, 310, { steps:8 }); await page.mouse.up();
await page.waitForTimeout(500); await shot('7b-free-camera');
if (await page.evaluate(() => __cosmos.tour.on)) fail('dragging did not break the tour');
if (!(await rect('#btnResumeI')).shown) fail('no resume button in the card after breaking the tour');
else { await page.tap('#btnResumeI'); await page.waitForTimeout(400); if (!(await page.evaluate(() => __cosmos.tour.on))) fail('resume in the card did not resume the tour'); }

// on its side
await page.setViewportSize({ width:844, height:390 });
await page.waitForTimeout(1200); await wake(); await shot('8-landscape');
const ld = await page.evaluate(() => { const c = document.querySelector('.controls'), i = document.querySelector('#info'); const a = c.getBoundingClientRect(), b = i.getBoundingClientRect(); return { over:c.scrollWidth - c.clientWidth, dockTop:a.top, cardBottom:b.bottom, cardRight:b.right }; });
if (ld.over > 1) fail('landscape dock overflows');
if (ld.cardBottom > ld.dockTop + 1) fail('landscape card overlaps the dock');
await page.tap('#btnAtlas'); await page.waitForTimeout(800); await shot('9-landscape-atlas');

report('mobile', errors, 'screenshots in tests/out/mobile');
await browser.close();

// Phone layout regression: the dock fits, the info card sits above it and can be expanded, collapsed and hidden,
// the scale chip opens the ladder, the interface fades when idle and a first tap on the sky only brings it back
// (a first tap on a faded button works), the card's green "next stop" button, the tour name and the angle arrows, the random tour in the list of tours,
// the song list in the settings, and the atlas controls (all in the card, nothing sideways, upright at four sizes and on its side at two, at 90 to 160% menu text).
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
const first = await page.evaluate(() => { const b = [...document.querySelectorAll('.controls .btn')].filter(b => getComputedStyle(b).display !== 'none').sort((a, b) => a.getBoundingClientRect().left - b.getBoundingClientRect().left)[0]; return b && b.id + ' ' + b.textContent; });
if (first !== 'btnHome home') fail('home is not the first button in the dock: ' + first);
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

// the atlas opens above the dock and the object is re-framed into the space left. Every control is in the card and nothing is wider than its box
// (nothing scrolls sideways); targets are at least 32 px tall (28 on its side). Upright it is one scrolling column (.flow): the controls in sight
// when it opens, and once they scroll away the list has the card, also with a kind and "not seen yet" ticked. On its side the controls sit in their
// own pane, all of it in sight. Everywhere: no name cut short, no heading over its note, the sort row keeps its height whatever the sort,
// no row looks chosen by the keyboard when nothing is typed, and the badge tray is solid. Checked at several sizes and at 90 to 160% menu text.
const atlasCheck = (minH, minRows) => page.evaluate(async ([minH, minRows]) => {
  const $ = s => document.querySelector(s), a = $('#atlas'), bad = [], wait = () => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
  dispatchEvent(new Event('resize')); await wait();
  const flow = a.classList.contains('flow'), sc = flow ? $('#atlasBody') : $('#atlasList'), ar = a.getBoundingClientRect();
  sc.scrollTop = 0; await wait();
  for (const e of a.querySelectorAll('*')) if (e.clientWidth > 0 && !e.closest('.atlas-list') && !e.classList.contains('sr') && e !== $('#atlasBody') && e.scrollWidth > e.clientWidth + 1) bad.push('overflows: ' + (e.id || e.className));
  const pane = flow ? ar : $('#atlasTools').getBoundingClientRect();
  for (const b of a.querySelectorAll('#atlasTools button, #seenBtn, #atlasClose')){ const q = b.getBoundingClientRect(), id = b.id || b.dataset.cat || b.dataset.sort, box = b.closest('#atlasTools') ? pane : ar;
    if (q.left < ar.left - 1 || q.right > ar.right + 1 || q.top < box.top - 1 || (!flow && q.bottom > box.bottom + 1)) bad.push('outside its pane: ' + id);
    if (q.height < minH) bad.push(`under ${minH} px: ${id}`); }
  if (flow && $('#atlasTools').getBoundingClientRect().top > sc.getBoundingClientRect().top + 1) bad.push('the controls are not in sight when it opens');
  const cut = () => [...document.querySelectorAll('.arow:not([hidden])')].filter(x => { const n = x.querySelector('.an'), d = x.querySelector('.ad'), ch = 0.6*parseFloat(getComputedStyle(n).fontSize);
    return n.scrollWidth > n.clientWidth + 1 || d.scrollWidth > d.clientWidth + 1 || n.getBoundingClientRect().width < Math.min(5, n.textContent.length)*ch - 1; }).map(x => x.querySelector('.an').textContent);
  const over = () => [...document.querySelectorAll('.agroup:not([hidden])')].filter(g => { const t = g.firstChild.getBoundingClientRect(), n = g.lastChild.getBoundingClientRect();
    return n.width && t.right > n.left + 1 && t.bottom > n.top + 1 && n.bottom > t.top + 1; }).map(g => g.firstChild.textContent);
  const sortH = new Set();
  for (const s of ['distance', 'size', 'name', 'kind']){ $(`#atlasSort [data-sort="${s}"]`).click(); await wait(); sortH.add(Math.round($('.sort-row').getBoundingClientRect().height));
    const c = cut(); if (c.length) bad.push(`${c.length} names cut short sorted by ${s}: ${c.slice(0, 3).join(', ')}`); }
  if (sortH.size > 1) bad.push('the sort row changes height with the sort: ' + [...sortH].join(', '));
  const o = over(); if (o.length) bad.push('a heading runs into its note: ' + o.join(', '));
  if (document.querySelectorAll('.arow.kb').length) bad.push('a row looks chosen by the keyboard with nothing typed');
  if (!/^rgb\(/.test(getComputedStyle($('#badgeTray')).backgroundColor)) bad.push('the badge tray lets the rows show through: ' + getComputedStyle($('#badgeTray')).backgroundColor);
  // a kind and "not seen yet": the rows the list has room for once the controls are scrolled away (less the results line and a heading)
  $('#atlasCats [data-cat="galaxies"]').click(); if ($('#atlasUnseen').getAttribute('aria-checked') !== 'true') $('#atlasUnseen').click(); await wait();
  if (flow) sc.scrollTop = $('#atlasTools').offsetHeight;
  await wait();
  const s = sc.getBoundingClientRect(), row = [...document.querySelectorAll('.arow:not([hidden])')].map(x => x.getBoundingClientRect().height).sort((p, q) => p - q)[0];
  const rows = +((Math.min(s.bottom, $('#seenBtn').getBoundingClientRect().top) - $('.agroup:not([hidden])').getBoundingClientRect().bottom)/row).toFixed(1);
  if (rows < minRows) bad.push(`room for ${rows} rows with a kind and "not seen yet" (${minRows} wanted)`);
  const c = cut(); if (c.length) bad.push(`${c.length} names cut short with galaxies: ${c.slice(0, 3).join(', ')}`);
  $('#atlasReset').click(); sc.scrollTop = 0; await wait();
  return { bad, rows, flow, cols:getComputedStyle($('#atlasCats')).gridTemplateColumns.split(' ').length };
}, [minH, minRows]);
const menu = v => page.evaluate(v => __cosmos.setOpt('menuSize', v, true), v);
await page.tap('#btnAtlas'); await page.waitForTimeout(1200); await shot('5-atlas');
const atl = await rect('#atlas');
if (!atl || atl.bottom > dock.top + 1) fail('atlas overlaps the dock');
let af = await atlasCheck(32, 7);
if (af.bad.length) fail('the atlas at 390 x 844: ' + af.bad.join(', '));
if (!af.flow || af.cols !== 3) fail(`upright the atlas is not one scrolling column (${af.flow}) or the kinds are in ${af.cols} columns, not 3`);
// a kind, then "not seen yet" on top of it: the results line says what the list shows; the badge tray opens inside the card and Esc closes it first
await page.tap('#atlasCats [data-cat="galaxies"]'); await page.waitForTimeout(200);
await page.tap('#atlasUnseen'); await page.waitForTimeout(300); await shot('5b-atlas-galaxies-unseen');
const said = await page.evaluate(() => [document.querySelector('#atlasResult').hidden, document.querySelector('#atlasResultTxt').textContent, document.querySelector('#atlasCats [data-cat="galaxies"]').getAttribute('aria-checked'), document.querySelector('#atlasUnseen').textContent, document.querySelector('.agroup:not([hidden])').textContent]);
if (said[0] || !/^\d+ galaxies not seen yet$/.test(said[1]) || said[2] !== 'true' || said[3] !== '[x]not seen yet' || said[4] !== 'Galaxiesfrom Earth') fail('galaxies with "not seen yet": ' + JSON.stringify(said));
// scrolled: the results line and the heading stay at the top of the card
const stuck = await page.evaluate(() => { const b = document.querySelector('#atlasBody'); b.scrollTop = b.scrollHeight; const t = b.getBoundingClientRect().top, r = document.querySelector('#atlasResult').getBoundingClientRect(), h = document.querySelector('.agroup:not([hidden])').getBoundingClientRect();
  return [Math.round(r.top - t), Math.round(h.top - r.bottom)]; });
await shot('5b2-atlas-scrolled');
if (stuck.join() !== '0,0') fail('scrolled, the results line and the heading do not stay at the top of the card: ' + stuck);
await page.tap('#seenBtn'); await page.waitForTimeout(400); await shot('5c-atlas-badges');
const tray = await rect('#badgeTray');
if (!tray || !tray.shown || tray.bottom > atl.bottom + 1 || tray.top < atl.top) fail('the badge tray is not inside the card: ' + JSON.stringify(tray));
await page.keyboard.press('Escape'); await page.waitForTimeout(200);
if ((await rect('#badgeTray')).shown || !(await rect('#atlas')).shown) fail('Esc did not close the badge tray first');
await page.tap('#atlasReset'); await page.waitForTimeout(200);
// smaller phones, and smaller or bigger menu text: nothing sideways, and the list keeps its room once the controls scroll away
const upright = [];
for (const [w, h, rows] of [[390, 844, 7], [360, 780, 7], [375, 667, 7], [375, 553, 5]]){
  await page.setViewportSize({ width:w, height:h }); await page.waitForTimeout(300);
  for (const ms of [0.9, 1.15, 1.3, 1.6]){
    await menu(ms); af = await atlasCheck(32, rows);
    if (af.bad.length) fail(`the atlas at ${w} x ${h}, menu text ${Math.round(ms*100)}%: ` + af.bad.join(', '));
    if (ms === 1.15) upright.push(`${af.rows} at ${w} x ${h}`);
  }
  if (w === 375 && h === 667){ await menu(1.15); await shot('5d-atlas-375x667'); }
}
await menu(1.15);
await page.setViewportSize({ width:390, height:844 }); await page.waitForTimeout(700);
await page.tap('#atlasClose'); await page.waitForTimeout(300);

// idle: on a tour the interface fades after a few seconds; the first tap only brings it back and the tour keeps going
await page.evaluate(() => { __cosmos.startTour('grand'); });
await fade('quick'); await page.waitForTimeout(500); await wake();
await page.waitForFunction(() => document.body.classList.contains('ui-idle'), null, { timeout:15000 }).catch(() => fail('the interface did not fade on a tour'));
await page.waitForTimeout(1300); await shot('6-tour-idle');
// (0.28.2, owner: faded, the stop, the name and the angle line hung in the sky where the card stood, "randomly floating": they sit at the
// bottom now, where the dock was, and the dock's faded buttons still take a tap at their middles)
{ const z = await page.evaluate(() => { let bot = 0; for (const e of document.querySelectorAll('.info .stop, .info .title, .info .progress')){ if (!e.offsetHeight || e.matches('.hintish, .tip')) continue; bot = Math.max(bot, e.getBoundingClientRect().bottom); }
    const blocked = [...document.querySelectorAll('.controls .btn')].filter(b => b.offsetParent).map(b => { const r = b.getBoundingClientRect(), t = document.elementFromPoint(r.left + r.width/2, r.top + r.height/2); return b.contains(t) ? null : b.textContent.trim(); }).filter(Boolean);
    return { gap:Math.round(innerHeight - bot), blocked }; });
  if (!(z.gap >= 6 && z.gap <= 30)) fail(`faded on a tour, the card's last line is ${z.gap} px above the bottom (6 to 30 wanted)`);
  if (z.blocked.length) fail(`faded, the slid card covers the middle of the dock's ${z.blocked.join(', ')}`); }
await page.touchscreen.tap(195, 400); await page.waitForTimeout(500);
if (await has('ui-idle')) fail('a tap did not bring the interface back');
if (!(await page.evaluate(() => __cosmos.tour.on))) fail('the wake-up tap stopped the tour');
await shot('7-tour-awake');
void lockBefore;

// a wake-up tap that lands on an object's label does not fly there either
await page.waitForFunction(() => document.body.classList.contains('ui-idle'), null, { timeout:15000 }).catch(() => fail('the interface did not fade again'));
const lab = await page.evaluate(() => {
  const b = [...document.querySelectorAll('#labels .lab:not(.star)')].find(el => { const r = el.getBoundingClientRect(); return el.classList.contains('on') && r.width > 0 && r.top > 60 && r.bottom < innerHeight - 220; });
  if (!b) return null; const r = b.getBoundingClientRect(); return { x:r.left + r.width/2, y:r.top + r.height/2, t:b.textContent };
});
if (lab){
  await page.touchscreen.tap(lab.x, lab.y); await page.waitForTimeout(600);
  if (!(await page.evaluate(() => __cosmos.tour.on))) fail(`a wake-up tap on the label "${lab.t}" flew there and stopped the tour`);
  if (await has('ui-idle')) fail('a tap on a label did not bring the interface back');
}
// a faded button works on the first tap (it used to only bring the interface back): the green "next stop" button flies on
await page.evaluate(() => { const C = __cosmos; C.land(0.1); C.hud(); });
await page.waitForFunction(() => document.body.classList.contains('ui-idle'), null, { timeout:15000 }).catch(() => fail('the interface did not fade before the button tap'));
await page.waitForTimeout(1300);   // (the fade takes a second)
const gn = await page.evaluate(() => { const C = __cosmos, b = document.querySelector('#goNext'), r = b.getBoundingClientRect(), k = C.TOUR.indexOf(C.tour.obj);
  return { x:r.left + r.width/2, y:r.top + r.height/2, txt:b.textContent, next:C.OBJ[C.TOUR[(k + 1) % C.TOUR.length]].key, op:getComputedStyle(b).opacity }; });
await page.touchscreen.tap(gn.x, gn.y); await page.waitForTimeout(400);
const gnAfter = await page.evaluate(() => ({ to:__cosmos.stepTarget, tour:__cosmos.tour.on, obj:__cosmos.OBJ[__cosmos.tour.obj].key }));
if (!/^next stop · .+›$|^start again›$/.test(gn.txt)) fail('the green button does not say where it goes: "' + gn.txt + '"');
if (gn.op !== '0') fail('the green button did not fade with the interface (opacity ' + gn.op + ')');
if (!gnAfter.tour || gnAfter.obj !== gn.next) fail(`the first tap on the faded "${gn.txt}" did not fly on to ${gn.next}: ` + JSON.stringify(gnAfter));
if (await has('ui-idle')) fail('a tap on a faded button did not bring the interface back');
await page.evaluate(() => { __cosmos.land(0.1); __cosmos.hud(); });
await shot('7a-next-stop');
await fade('off');

// the card: "stop 3 / 31" and the tour's name, which opens the list of tours; the angle arrows sit on the angle line, and the angle line sits
// right under the name (0.9.9: it used to be the last line of the card), in both the short and the full card
const cardTxt = await page.evaluate(() => { const C = __cosmos; C.hud(); const k = C.TOUR.indexOf(C.tour.obj), p = document.querySelector('#progress');
  return { stop:document.querySelector('#stopInfo').textContent, want:'stop ' + (k + 1) + ' / ' + C.TOUR.length, name:document.querySelector('#modeTour').textContent, arrows:!!p.querySelector('#prevObj') && !!p.querySelector('#nextObj') && p.classList.contains('angles') }; });
if (cardTxt.stop !== cardTxt.want) fail('the card does not say which stop this is: "' + cardTxt.stop + '"');
if (cardTxt.name !== 'grand tour ▾') fail('the tour name is not "grand tour ▾": ' + cardTxt.name);
if (!cardTxt.arrows || !(await rect('#nextObj')).shown) fail('the angle arrows are not on the angle line');
const lineAt = () => page.evaluate(() => { const p = document.querySelector('#progress'), t = document.querySelector('#info .title').getBoundingClientRect(), r = p.getBoundingClientRect(), a = document.querySelector('#info .acts');
  return { after:p.previousElementSibling && p.previousElementSibling.classList.contains('title'), gap:Math.round(r.top - t.bottom), above:a.offsetHeight ? Math.round(a.getBoundingClientRect().top - r.bottom) : null }; });
const card0 = await page.evaluate(() => __cosmos.SET.infoM || 'full');
for (const s of ['compact', 'full', card0]){
  await page.evaluate(s => { __cosmos.SET.infoM = s; document.querySelector('#infoMore').click(); document.querySelector('#infoMore').click(); }, s);
  await page.waitForTimeout(250); const L = await lineAt();
  if (!L.after || L.gap < -2 || L.gap > 10 || (L.above != null && L.above < 0)) fail(`the angle line is not right under the name (${s} card): ` + JSON.stringify(L));
}
await page.tap('#modeTour'); await page.waitForTimeout(400);
if (!(await rect('#tours')).shown) fail('the tour name did not open the list of tours');
await shot('7c-tours-from-name');
await page.tap('#toursClose'); await page.waitForTimeout(300);

// the random tour: second in the list of tours from the dock, in full view; a tap closes the list and starts it ("stop 1 / 12")
// (rowInView: the whole row, its name and its line below, lies inside the panel and on screen, and nothing covers it; on a phone on its
// side too, where the list of tours comes before "time at each stop")
const rowInView = () => page.evaluate(() => { const b = document.querySelectorAll('#tourList .trow')[1], r = b.getBoundingClientRect(), p = document.querySelector('#tours').getBoundingClientRect();
  const e = document.elementFromPoint((r.left + r.right)/2, (r.top + r.bottom)/2);
  return { name:b.querySelector('b').textContent, shown:r.top >= p.top - 1 && r.bottom <= Math.min(p.bottom, innerHeight) + 1 && r.left >= p.left - 1 && r.right <= p.right + 1 && !!e && e.closest('.trow') === b }; });
const grandAt = await page.evaluate(() => { __cosmos.randomSeed(1); return __cosmos.tour.obj; });
await page.tap('#btnTours'); await page.waitForTimeout(500); await shot('7d-tours-random');
const rrow = await rowInView();
if (rrow.name !== 'random tour' || !rrow.shown) fail('the random tour is not second in view in the list of tours: ' + JSON.stringify(rrow));
else {
  await page.tap('#tourList .trow:nth-child(2)'); await page.waitForTimeout(500);
  const rs = await page.evaluate(() => { const C = __cosmos; C.land(0.1); C.hud(); const i = document.querySelector('#info').getBoundingClientRect(), g = document.querySelector('#goNext').getBoundingClientRect();
    return { open:!document.querySelector('#tours').hidden, id:C.tourId, name:document.querySelector('#modeTour').textContent, stop:document.querySelector('#stopInfo').textContent, go:document.querySelector('#goNext').textContent, goIn:g.width > 0 && g.left >= i.left - 1 && g.right <= i.right + 1 }; });
  await page.waitForTimeout(300); await shot('7e-random-tour');
  if (rs.open || rs.id !== 'random' || rs.name !== 'random tour ▾' || rs.stop !== 'stop 1 / 12' || !/^next stop · .+›$/.test(rs.go) || !rs.goIn) fail('tapping the random tour did not start it: ' + JSON.stringify(rs));
}

// back on the grand tour at the stop it was on, so the checks below do not depend on what a random deal holds
await page.evaluate(i => { const C = __cosmos; C.startTour('grand'); C.land(0.1); C.tourGo(i); C.land(0.1); }, grandAt);

// dragging breaks the tour: still on the same stop, the green button goes on to the next stop, and picks the tour up again
await page.evaluate(() => { __cosmos.land(0.1); });
await page.mouse.move(120, 300); await page.mouse.down(); await page.mouse.move(210, 310, { steps:8 }); await page.mouse.up();
await page.waitForTimeout(500); await page.evaluate(() => __cosmos.hud()); await shot('7b-free-camera');
if (await page.evaluate(() => __cosmos.tour.on)) fail('dragging did not break the tour');
const dg = await page.evaluate(() => { const C = __cosmos, k = C.TOUR.indexOf(C.tour.last), n = C.OBJ[C.TOUR[(k + 1) % C.TOUR.length]]; return { txt:document.querySelector('#goNext').textContent, want:k === C.TOUR.length - 1 ? 'start again›' : 'next stop · ' + (n.label || n.name) + '›', next:n.key }; });
if (!(await rect('#goNext')).shown || dg.txt !== dg.want) fail(`after breaking the tour the green button reads "${dg.txt}", not "${dg.want}"`);
else { await page.tap('#goNext'); await page.waitForTimeout(400); const r = await page.evaluate(() => ({ tour:__cosmos.tour.on, obj:__cosmos.OBJ[__cosmos.tour.obj].key })); if (!r.tour || r.obj !== dg.next) fail(`"${dg.txt}" in the card did not go on with the tour: ` + JSON.stringify(r)); }

// the song list in the settings: every song, by style, with its length, all on screen without sideways scrolling and easy
// to tap; a tap plays that song now and marks it, and so does Enter on a song picked with the keyboard
await page.evaluate(() => { const C = __cosmos; C.setOpt('sound', true, true); if (document.querySelector('#settings').hidden) document.querySelector('#btnSettings').click(); });
await page.waitForTimeout(300);
await page.evaluate(() => document.querySelector('#songsBtn').scrollIntoView({ block:'start' }));
await page.tap('#songsBtn'); await page.waitForTimeout(300);
const sl = await page.evaluate(() => { const p = document.querySelector('#settings'), l = document.querySelector('#songList'), pr = p.getBoundingClientRect(), rows = [...l.querySelectorAll('.song')];
  return { open:!l.hidden && document.querySelector('#songsBtn').getAttribute('aria-expanded') === 'true', n:rows.length, want:__cosmos.music.songs().length, groups:l.querySelectorAll('.sg-h').length,
    over:Math.max(p.scrollWidth - p.clientWidth, l.scrollWidth - l.clientWidth), small:rows.filter(b => b.getBoundingClientRect().height < 28).map(b => b.textContent),
    out:rows.filter(b => { const r = b.getBoundingClientRect(); return r.left < pr.left - 1 || r.right > pr.right + 1; }).map(b => b.textContent),
    cut:rows.filter(b => { const t = b.querySelector('.sn'); return t.scrollWidth > t.clientWidth + 1; }).map(b => b.textContent),
    len:rows.every(b => /^\d+:\d\d$/.test(b.querySelector('.sl').textContent)) }; });
if (!sl.open || sl.n !== sl.want || sl.n < 10 || sl.groups !== 6) fail('the song list did not open with every song by style: ' + JSON.stringify(sl));
if (sl.over > 1 || sl.out.length || sl.cut.length) fail('the song list does not fit the panel: ' + JSON.stringify(sl));
if (sl.small.length) fail('song rows under 28 px: ' + sl.small.join(', '));
if (!sl.len) fail('a song has no length');
const pickId = await page.evaluate(() => { const b = [...document.querySelectorAll('#songList .song')][10]; b.scrollIntoView({ block:'center' }); return b.dataset.id; });
await page.tap(`#songList .song[data-id="${pickId}"]`); await page.waitForTimeout(500);
await shot('13-songs');
const pk = await page.evaluate(() => { const m = __cosmos.music, t = m.track, cur = [...document.querySelectorAll('#songList .song[aria-current=true]')].map(b => b.dataset.id);
  return { song:t && t.song, bpm:t && t.bpm, cur, list:m.songs(), np:document.querySelector('#nowPlaying').textContent }; });
const pkSong = pk.list.find(x => x.id === pickId);
if (pk.song !== pickId || pk.cur.join() !== pickId || pk.bpm !== pkSong.bpm || !pk.np.startsWith(pkSong.title)) fail(`a tap on "${pkSong.title}" did not play and mark it: ` + JSON.stringify({ song:pk.song, cur:pk.cur, bpm:pk.bpm, np:pk.np }));
const kbId = await page.evaluate(() => { const b = document.querySelector('#songList .song'); b.focus(); return b.dataset.id; });
await page.keyboard.press('Enter'); await page.waitForTimeout(400);
const kb = await page.evaluate(() => ({ song:__cosmos.music.track && __cosmos.music.track.song, cur:document.querySelector('#songList .song[aria-current=true]')?.dataset.id }));
if (kb.song !== kbId || kb.cur !== kbId) fail('Enter on a song did not play it: ' + JSON.stringify(kb));
await page.evaluate(() => { __cosmos.setOpt('sound', false, true); if (!document.querySelector('#settings').hidden) document.querySelector('#btnSettings').click(); });

// two fingers (real touch events): a pinch zooms exactly as far as the fingers spread and stays on the object; moving both fingers together
// slides the object on a leash (still locked on, still on screen, clear of the card); lifting one finger does not turn the gesture into an
// orbit; a double-tap on the sky and play both bring the object back to the middle; while paused the card shows the gesture hint
const cdp = await page.context().newCDPSession(page);
const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints:pts.map(([x, y, id]) => ({ x, y, id })) });
const cam = () => page.evaluate(() => { const C = __cosmos, p = C.proj('earth'), i = document.querySelector('#info').getBoundingClientRect();
  return { lock:C.orbit.lock >= 0 ? C.OBJ[C.orbit.lock].key : null, distT:C.orbit.distT, yaw:C.orbit.yaw, pitch:C.orbit.pitch, leash:Math.abs(C.leash.x) + Math.abs(C.leash.y), x:p ? p.x : -1e9, y:p ? p.y : -1e9, cardTop:i.top,
    playing:!document.querySelector('#btnPlayM').classList.contains('paused'), hint:document.querySelector('#progLabel').textContent, hintShown:getComputedStyle(document.querySelector('#progress')).display !== 'none' }; });
await page.evaluate(() => { const C = __cosmos; C.setOpt('labels', false, true); C.setTour(false); C.view('earth', 0); C.tick(1/60); });
const g0 = await cam();
await touch('touchStart', [[145, 330, 0], [245, 330, 1]]);
for (let i = 1; i <= 10; i++) await touch('touchMove', [[145 - i*10, 330, 0], [245 + i*10, 330, 1]]);
await touch('touchEnd', []);
const g1 = await cam(), ratio = g0.distT/g1.distT;
if (Math.abs(ratio - 3) > 0.09) fail(`a pinch from 100 to 300 px apart zoomed x${ratio.toFixed(2)}, not x3`);
if (g1.lock !== 'earth') fail('a pinch let go of Earth');
await touch('touchStart', [[150, 300, 0], [240, 300, 1]]);
for (let i = 1; i <= 20; i++) await touch('touchMove', [[150 + i*30, 300 + i*35, 0], [240 + i*30, 300 + i*35, 1]]);
await touch('touchEnd', []);
await page.evaluate(() => { __cosmos.tick(1/60); __cosmos.hud(); });
const g2 = await cam(); await shot('10-two-finger-slide');
if (g2.lock !== 'earth') fail('a two-finger slide let go of Earth');
if (!(g2.leash > 0.1)) fail('a two-finger slide did not move Earth across the screen');
if (!(g2.x > 0 && g2.x < 390 && g2.y > 44 && g2.y < g2.cardTop)) fail(`a two-finger slide pushed Earth's centre off the free screen: ${Math.round(g2.x)}, ${Math.round(g2.y)} (card at ${Math.round(g2.cardTop)})`);
if (g2.hint !== 'drag to turn · pinch to zoom · double-tap to centre' || !g2.hintShown) fail('no gesture hint in the card while paused: "' + g2.hint + '"');
await touch('touchStart', [[150, 300, 0], [240, 300, 1]]);
await touch('touchMove', [[146, 300, 0], [244, 300, 1]]);
const g3 = await cam();
await touch('touchEnd', [[244, 300, 1]]);   // one finger lifts, the other carries on
for (let i = 1; i <= 8; i++) await touch('touchMove', [[146 + i*20, 300 + i*8, 0]]);
await touch('touchEnd', []);
const g4 = await cam();
if (Math.abs(g4.yaw - g3.yaw) + Math.abs(g4.pitch - g3.pitch) > 1e-6 || g4.distT !== g3.distT) fail('the view moved when one finger of two lifted');
// a double-tap somewhere on the sky with nothing to pick
const spot = await page.evaluate(() => { const C = __cosmos, top = document.querySelector('#info').getBoundingClientRect().top - 30, tanY = Math.tan(C.cam.fovY/2), pts = [];
  for (const o of C.OBJ){ if (o.noPick || o.marker || o.hidden) continue; const p = C.proj(o); if (!p) continue;
    const r = o.rad*(o.mag || 1)/(p.z*tanY)*innerHeight/2; if (r > innerHeight*0.8 || (o.layer < 3 && r > 60)) continue;   // (what a tap cannot pick, as in pick())
    pts.push([p.x, p.y, Math.max(r*0.8 + 20, 60)]); }
  for (let y = 90; y < top; y += 20) for (let x = 30; x < 360; x += 20) if (pts.every(([px, py, r]) => Math.hypot(x - px, y - py) > r)) return [x, y];
  return null; });
if (!spot) fail('no free patch of sky to double-tap');
else {
  await page.touchscreen.tap(spot[0], spot[1]); await page.waitForTimeout(90); await page.touchscreen.tap(spot[0] + 2, spot[1] + 1);
  await page.evaluate(() => { for (let i=0;i<150;i++) __cosmos.tick(1/60); });
  const g5 = await cam();
  if (g5.leash > 0.01 || g5.lock !== 'earth') fail('a double-tap on the sky did not bring Earth back to the middle: ' + JSON.stringify(g5));
}
await touch('touchStart', [[150, 300, 0], [240, 300, 1]]);
for (let i = 1; i <= 10; i++) await touch('touchMove', [[150 + i*12, 300 - i*8, 0], [240 + i*12, 300 - i*8, 1]]);
await touch('touchEnd', []);
// (a click, not a tap: in headless Chromium the first tap after a synthetic two-finger gesture never becomes a click, with or without this release)
await page.evaluate(() => { document.querySelector('#btnPlayM').click(); for (let i=0;i<150;i++) __cosmos.tick(1/60); });
const g6 = await cam();
if (!g6.playing || g6.leash > 0.01) fail('play did not bring Earth back to the middle: ' + JSON.stringify(g6));

// a pinch that starts on the card does not zoom the whole page (it used to, up to 5x), and one finger still scrolls the card
await page.evaluate(() => { __cosmos.setOpt('textSize', 1.6, true); const b = document.body.classList; if (b.contains('info-hidden')) document.querySelector('#infoPill').click(); if (b.contains('info-compact')) document.querySelector('#infoMore').click(); document.querySelector('#info').scrollTop = 0; });
await page.waitForTimeout(300);
const cr = await rect('#info'), cy = Math.round((cr.top + cr.bottom)/2);
await touch('touchStart', [[170, cy, 0], [220, cy + 10, 1]]);
for (let i = 1; i <= 12; i++) await touch('touchMove', [[170 - i*10, cy - i*6, 0], [220 + i*10, cy + 10 + i*6, 1]]);
await touch('touchEnd', []);
await touch('touchStart', [[195, cy + 60, 0]]);
for (let i = 1; i <= 10; i++) await touch('touchMove', [[195, cy + 60 - i*12, 0]]);
await touch('touchEnd', []);
await page.waitForTimeout(500);
const pz = await page.evaluate(() => ({ scale:visualViewport.scale, scroll:document.querySelector('#info').scrollTop, room:document.querySelector('#info').scrollHeight - document.querySelector('#info').clientHeight }));
if (pz.scale !== 1) fail('a pinch on the card zoomed the whole page x' + pz.scale);
if (pz.room > 2 && pz.scroll < 2) fail('one finger no longer scrolls the card: ' + JSON.stringify(pz));
await page.evaluate(() => { __cosmos.setOpt('textSize', 1, true); document.querySelector('#infoMore').click(); });

// the Halo on a phone (0.9.4): the dock's ship button opens a menu over the dock (ride along, cockpit, marker, and since 0.9.6 the Halo tour);
// riding, the button says so and the menu offers outside, cockpit and stop, the Halo tour and the camera (moving / still); a tap elsewhere closes it. The what's new button is not in the dock (it is in settings and help).
await page.evaluate(() => document.querySelector('#btnShip').click());
const sm = await page.evaluate(() => { const m = document.querySelector('#shipMenu'), d = document.querySelector('.controls').getBoundingClientRect(), r = m.getBoundingClientRect();
  // (0.9.9, owner review: its Halo tour item is a switch like the desk's, the words on the left and the pill on the right, inside the item)
  const t = m.querySelector('#smTour'), tb = t.getBoundingClientRect(), p = t.querySelector('.hsw-t'), pb = p && p.getBoundingClientRect(), w = t.querySelector('.sm-st').getBoundingClientRect();
  const tour = { pill:!!pb && pb.left >= w.right && pb.right <= tb.right - 4 && pb.width >= 34 && pb.height >= 18, name:t.querySelector('b').textContent, on:t.getAttribute('aria-checked'),
    fit:[...m.querySelectorAll('button')].filter(b => !b.hidden).every(b => b.scrollWidth <= b.clientWidth + 1) };
  return { open:!m.hidden, bottom:r.bottom, dockTop:d.top, left:r.left, right:r.right, vis:[...m.querySelectorAll('button')].filter(b => !b.hidden).map(b => b.id).join(), exp:document.querySelector('#btnShip').getAttribute('aria-expanded'), notes:getComputedStyle(document.querySelector('#btnNotes')).display, tour }; });
if (!sm.open || sm.bottom > sm.dockTop + 1 || sm.left < 0 || sm.right > 390 || sm.vis !== 'smChase,smCock,smMark,smTour' || sm.exp !== 'true') fail('the ship menu: ' + JSON.stringify(sm));
if (!sm.tour.pill || sm.tour.name !== 'Halo tour' || sm.tour.on !== 'false' || !sm.tour.fit) fail('the ship menu\'s Halo tour switch: ' + JSON.stringify(sm.tour));
if (sm.notes !== 'none') fail('the what\'s new button shows in the dock');
await shot('12-ship-menu');
await page.evaluate(() => document.querySelector('#smChase').click());
await page.waitForTimeout(300);
const rd = await page.evaluate(() => { __cosmos.hud(); const C = __cosmos; return { menu:!document.querySelector('#shipMenu').hidden, riding:C.shipCam.on || C.shipCam.pending, btn:document.querySelector('#btnShip').textContent }; });
if (rd.menu || !rd.riding || rd.btn !== 'riding') fail('ride along from the ship menu: ' + JSON.stringify(rd));
await page.evaluate(() => document.querySelector('#btnShip').click());
const sm2 = await page.evaluate(() => [...document.querySelectorAll('#shipMenu button')].filter(b => !b.hidden).map(b => b.id + (b.getAttribute('aria-checked') === 'true' ? '*' : '')).join());
if (sm2 !== 'smChase*,smCock,smStop,smTour,smStill') fail('the ship menu while riding: ' + sm2);
await page.mouse.click(195, 200);   // (a tap on the sky closes it)
if (await page.evaluate(() => !document.querySelector('#shipMenu').hidden)) fail('a tap elsewhere does not close the ship menu');
await page.evaluate(() => { document.querySelector('#btnShip').click(); document.querySelector('#smStop').click(); __cosmos.hud(); });
const sm3 = await page.evaluate(() => ({ riding:__cosmos.shipCam.on, btn:document.querySelector('#btnShip').textContent }));
if (sm3.riding || sm3.btn !== 'ship') fail('stop riding from the ship menu: ' + JSON.stringify(sm3));
// (0.9.6) the Halo tour from the menu rides along; the camera switch holds it still and back; stop riding ends the tour too.
// (0.9.9) The card shows the place, not the ship, with the blue line over its name and stop riding, and the list of tours says the Halo flies
// it; the dock has no Halo tour switch (the menu and the list of tours have it). While it plays, the menu's switch is on and names the tour,
// and the switch at the top of the list of tours is on too. After stop riding the card is the Halo's again.
await page.evaluate(() => { document.querySelector('#btnShip').click(); document.querySelector('#smTour').click(); });
await page.waitForTimeout(300);
const ht = await page.evaluate(() => { const C = __cosmos, $ = s => document.querySelector(s), r = { tour:C.HT.on, riding:C.shipCam.on || C.shipCam.pending };
  C.land(0.2); C.hud(); const pl = C.htPlace(), i = $('#info').getBoundingClientRect(), l = $('#htLine').getBoundingClientRect();
  r.card = { name:$('#objName').textContent, place:pl && pl.name, line:$('#htLine').textContent, lineIn:l.width > 0 && l.left >= i.left - 1 && l.right <= i.right + 1, stop:!$('#btnRideI').hidden, sw:getComputedStyle($('#btnHaloSw')).display };
  $('#btnTours').click(); r.card.note = $('#htNote').getBoundingClientRect().height > 0; r.card.tsw = [getComputedStyle($('#toursHaloSw')).display !== 'none', $('#toursHaloSw').getAttribute('aria-checked')]; $('#toursClose').click();
  $('#btnShip').click(); r.card.menu = [$('#smTour').getAttribute('aria-checked'), $('#smTour small').textContent]; $('#btnShip').click();
  document.querySelector('#btnShip').click(); document.querySelector('#smStill').click(); r.still = C.SET.rideCam;
  document.querySelector('#btnShip').click(); document.querySelector('#smStill').click(); r.moving = C.SET.rideCam;
  document.querySelector('#btnShip').click(); document.querySelector('#smStop').click(); r.after = C.HT.on || C.shipCam.on; C.hud(); r.back = $('#objName').textContent; return r; });
if (!ht.tour || !ht.riding || ht.still !== 'still' || ht.moving !== 'moving' || ht.after) fail('the Halo tour and the camera switch from the ship menu: ' + JSON.stringify(ht));
const hc = ht.card || {};
if (hc.name !== hc.place || hc.name === 'the Halo' || !/^(with the Halo · |→ )/.test(hc.line) || !hc.lineIn || !hc.stop || !hc.note || hc.sw !== 'none' || ht.back !== 'the Halo') fail('the card on the Halo tour: ' + JSON.stringify([hc, ht.back]));
if ((hc.tsw || []).join() !== 'true,true' || (hc.menu || []).join() !== 'true,grand tour') fail('the Halo tour switches are not on while it plays: ' + JSON.stringify([hc.tsw, hc.menu]));
// the switch at the top of the list of tours (0.9.9, owner review) starts the Halo tour with the tour picked and ends it; the list stays open,
// says the Halo flies it, and its head (title, switch, close) fits on one line inside the panel. Nothing in the head sticks out
await page.evaluate(() => document.querySelector('#btnTours').click()); await page.waitForTimeout(300);
const tsw = await page.evaluate(() => { const C = __cosmos, $ = s => document.querySelector(s), sw = $('#toursHaloSw'), r = {};
  sw.click(); r.on = [C.HT.on, sw.getAttribute('aria-checked'), $('#btnHaloSw').getAttribute('aria-checked'), !$('#tours').hidden, $('#htNote').getBoundingClientRect().height > 0];
  const p = $('#tours').getBoundingClientRect(), h = $('#tours .panel-head'), hb = h.getBoundingClientRect(), s = sw.getBoundingClientRect(), c = $('#toursClose').getBoundingClientRect();
  r.head = s.left >= p.left && c.right <= p.right + 1 && Math.abs(s.top - c.top) <= 4 && s.right <= c.left && hb.height < 60 && h.scrollWidth <= h.clientWidth + 1;
  return r; });
await page.waitForTimeout(400); await shot('12b-tours-halo-switch');
const tsw2 = await page.evaluate(() => { const C = __cosmos, $ = s => document.querySelector(s), r = {};
  $('#toursHaloSw').click(); r.off = [C.HT.on, $('#toursHaloSw').getAttribute('aria-checked')]; $('#toursClose').click(); C.land(0.2);
  $('#btnShip').click(); $('#smStop').click(); C.hud(); r.riding = C.shipCam.on || C.shipCam.pending; return r; });
if (tsw.on.join() !== 'true,true,true,true,true' || !tsw.head || tsw2.off.join() !== 'false,false' || tsw2.riding) fail('the Halo tour switch in the list of tours: ' + JSON.stringify([tsw, tsw2]));

// home: from a tour stop far away, the home button flies to Earth and pauses the tour, and the card offers to resume it
const hmAt = await page.evaluate(() => { const C = __cosmos; C.startTour('grand'); C.land(0.1); C.tourGo(C.BYKEY.crab.index, true); C.tick(1/60); return C.flight ? 'flying' : C.OBJ[C.orbit.lock].key; });
await page.evaluate(() => document.querySelector('#btnHome').click());
const hm = await page.evaluate(at => { const C = __cosmos; const r = { at, tour:C.tour.on, to:C.stepTarget }; C.land(0.3); r.lock = C.orbit.lock >= 0 ? C.OBJ[C.orbit.lock].key : null; return r; }, hmAt);
await page.waitForTimeout(400); await shot('11-home');
if (hm.at !== 'crab' || hm.tour || hm.to !== 'earth' || hm.lock !== 'earth') fail('home did not fly to Earth and pause the tour: ' + JSON.stringify(hm));
const hmBtn = await page.evaluate(() => { __cosmos.hud(); const b = document.querySelector('#goNext'); return { txt:b.textContent, back:b.classList.contains('back'), stop:document.querySelector('#stopInfo').textContent }; });
if (!(await rect('#goNext')).shown || hmBtn.txt !== 'back to the tour · Crab Nebula›' || !hmBtn.back) fail('no "back to the tour · Crab Nebula" in the card after going home: ' + JSON.stringify(hmBtn));
if (hmBtn.stop !== 'rocky planet') fail('off the tour the card does not say what Earth is: "' + hmBtn.stop + '"');
await page.evaluate(() => __cosmos.setOpt('labels', true, true));

// on its side
await page.setViewportSize({ width:844, height:390 });
await page.waitForTimeout(1200); await wake(); await shot('8-landscape');
const ld = await page.evaluate(() => { const c = document.querySelector('.controls'), i = document.querySelector('#info'); const a = c.getBoundingClientRect(), b = i.getBoundingClientRect(); return { over:c.scrollWidth - c.clientWidth, dockTop:a.top, cardBottom:b.bottom, cardRight:b.right }; });
if (ld.over > 1) fail('landscape dock overflows');
if (ld.cardBottom > ld.dockTop + 1) fail('landscape card overlaps the dock');
// the green button and the angle arrows stay inside the card, however long the name
const inCard = await page.evaluate(() => { const i = document.querySelector('#info').getBoundingClientRect(), out = [];
  for (const id of ['#goNext', '#prevObj', '#nextObj', '#modeTour', '#infoHide']){ const e = document.querySelector(id), r = e.getBoundingClientRect(); if (r.width && (r.left < i.left - 1 || r.right > i.right + 1)) out.push(id); }
  return out; });
if (inCard.length) fail('on its side these stick out of the card: ' + inCard.join(', '));
// (by clicks: the first tap after the synthetic two-finger gestures above never becomes a click, see the play button)
await page.evaluate(() => document.querySelector('#btnTours').click()); await page.waitForTimeout(500); await shot('8b-landscape-tours');
const lrow = await rowInView();
if (lrow.name !== 'random tour' || !lrow.shown) fail('on its side the random tour is not in view in the list of tours: ' + JSON.stringify(lrow));
await page.evaluate(() => document.querySelector('#toursClose').click()); await page.waitForTimeout(300);
// (opened by a click: after the raw two-finger touches above, the first tap here is sometimes lost in headless Chromium, before this test too)
await page.evaluate(() => document.querySelector('#btnAtlas').click()); await page.waitForTimeout(800); await shot('9-landscape-atlas');
// on its side the atlas has two panes, the controls beside the list (which runs from the top), above the dock; the info card, the logo and the
// chips step aside while it is open. At the default menu text on a 667 x 375 phone too; with very big menu text it may be one scrolling column
const la = await page.evaluate(() => { const r = s => document.querySelector(s).getBoundingClientRect(), op = s => getComputedStyle(document.querySelector(s)).opacity;
  return { tools:r('#atlasTools'), list:r('#atlasList'), atlas:r('#atlas'), dock:r('.controls'), hidden:[op('#info'), op('.topr'), op('.brand')] }; });
if (!(la.tools.right <= la.list.left + 1 && la.list.top <= la.tools.top + 1)) fail('on its side the atlas panes are not side by side: ' + JSON.stringify([la.tools, la.list]));
if (la.atlas.bottom > la.dock.top + 1) fail('on its side the atlas overlaps the dock');
if (la.hidden.join() !== '0,0,0') fail('the info card, the chips or the logo stay over the atlas on its side: ' + la.hidden);
const sideways = [];
for (const [w, h] of [[844, 390], [667, 375]]){
  await page.setViewportSize({ width:w, height:h }); await page.waitForTimeout(300);
  for (const ms of [0.9, 1.15, 1.3, 1.6]){
    await menu(ms); af = await atlasCheck(28, ms > 1.15 ? 3 : 5);   // (a phone on its side is short: bigger menu text leaves three or four rows)
    if (af.bad.length) fail(`the atlas on its side at ${w} x ${h}, menu text ${Math.round(ms*100)}%: ` + af.bad.join(', '));
    if (ms === 1.15){ sideways.push(`${af.rows} at ${w} x ${h}`); if (af.flow || af.cols !== 3) fail(`on its side at ${w} x ${h} the atlas is not two panes (${af.flow}) or the kinds are in ${af.cols} columns, not 3`); }
  }
  if (w === 667){ await menu(1.15); await shot('9b-landscape-atlas-667'); }
}
await menu(1.15);
await page.setViewportSize({ width:844, height:390 }); await page.waitForTimeout(500);
// on its side the card sits beside the object: a two-finger slide toward it stops with the object's centre on screen and off the card
await page.evaluate(() => { document.querySelector('#atlasClose').click(); const C = __cosmos; C.setTour(false); C.view('earth', 0); C.tick(1/60); });
await page.waitForTimeout(800);
await touch('touchStart', [[500, 200, 0], [590, 200, 1]]);
for (let i = 1; i <= 15; i++) await touch('touchMove', [[500 - i*40, 200 + i*30, 0], [590 - i*40, 200 + i*30, 1]]);
await touch('touchEnd', []);
const ls = await page.evaluate(() => { const C = __cosmos; C.tick(1/60); const p = C.proj('earth'), b = document.querySelector('#info').getBoundingClientRect();
  return { lock:C.orbit.lock >= 0 ? C.OBJ[C.orbit.lock].key : null, x:Math.round(p.x), y:Math.round(p.y), card:[b.left, b.top, b.right, b.bottom].map(Math.round) }; });
await shot('12-landscape-slide');
if (ls.lock !== 'earth' || !(ls.x > 0 && ls.x < 844 && ls.y > 0 && ls.y < 390) || (ls.x > ls.card[0] + 1 && ls.x < ls.card[2] - 1 && ls.y > ls.card[1] + 1 && ls.y < ls.card[3] - 1))
  fail('on its side a two-finger slide put Earth off screen or under the card: ' + JSON.stringify(ls));

// 0.27.3: bigger places to tap, the same look. Each small button's tap area is measured by walking out from its edges (an invisible margin
// reaches further than the button is drawn): pause, the scale chip and the angle arrows 42 px or more tall, the tour's name, more, hide and
// next stop 36 px or more (the card's rows are 5 px apart), and never over a neighbour's own shape (the walk stops where another element
// answers, so a margin that swallowed a neighbour would show up as that neighbour's area shrinking below its drawn size).
{ const t = await openPage({ phone:true });
  await t.page.waitForTimeout(800);
  const taps = await t.page.evaluate(() => { const out = {};
    for (const id of ['btnPlayM', 'ladChip', 'modeTour', 'infoMore', 'infoHide', 'goNext', 'prevObj', 'nextObj']){
      const el = document.getElementById(id), b = el.getBoundingClientRect(); if (!b.width){ out[id] = null; continue; }
      const hit = (x, y) => { const e = document.elementFromPoint(x, y); return !!e && (e === el || el.contains(e)); };
      const cx = (b.left + b.right)/2, cy = (b.top + b.bottom)/2; let up = 0, down = 0;
      while (up < 30 && hit(cx, b.top - up - 1)) up++; while (down < 30 && hit(cx, b.bottom + down)) down++;
      out[id] = { h:Math.round(b.height + up + down), drawn:Math.round(b.height), own:hit(cx, b.top + 1) && hit(cx, b.bottom - 1) }; }
    return out; });
  for (const [id, min] of [['btnPlayM', 42], ['ladChip', 42], ['prevObj', 42], ['nextObj', 42], ['modeTour', 36], ['infoMore', 36], ['infoHide', 36], ['goNext', 36]]){
    const v = taps[id];
    if (!v) fail('tap areas: #' + id + ' is not shown on a phone at the start');
    else if (v.h < min || !v.own) fail(`#${id} takes taps over ${v.h} px (drawn ${v.drawn}), wanted ${min} or more` + (v.own ? '' : ', and a neighbour\'s margin covers its own shape'));
  }
  errors.push(...t.errors); await t.browser.close();
}
report('mobile', errors, 'screenshots in tests/out/mobile' + ` · atlas fits at 90 to 160% menu text; rows with a kind and "not seen yet": upright ${upright.join(', ')}; on its side ${sideways.join(', ')}` + (lab ? ` · wake-up tap on "${lab.t}" checked` : '') + ` · pinch x${ratio.toFixed(2)} for fingers 3x apart · two-finger slide stays locked, Earth at ${Math.round(g2.x)}, ${Math.round(g2.y)} · home first in the dock · song list: ${sl.n} songs, a tap played ${pickId} · first tap on the faded "${gn.txt}" flew on to ${gn.next}`);
await browser.close();

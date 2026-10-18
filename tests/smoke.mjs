// Smoke test: the page loads, every object renders a frame from its first view, panels open, no errors or NaNs.
import { openPage, report, PAGE } from './lib.mjs';
const { browser, page, errors } = await openPage();
const keys = await page.evaluate(() => window.__cosmos.OBJ.filter(o => !o.marker && o.views && o.views.length).map(o => o.key));
const bad = [];
for (let i = 0; i < keys.length; i += 8){
  const chunk = keys.slice(i, i + 8);
  const r = await page.evaluate(ks => { const c = window.__cosmos, out = [];
    for (const k of ks){ c.setTour(false); c.view(k, 0); c.tick(1/30); c.render();
      if (!isFinite(c.cam.rel[0]) || !isFinite(c.orbit.dist)) out.push(k + ': NaN camera');
      // every object that could be on screen must have a real size and visibility (a field named like an engine property, e.g. `mag`, once made the Crab vanish)
      for (const o of c.OBJ) if ((o.vis !== undefined && !isFinite(o.vis)) || (o.mag !== undefined && typeof o.mag !== 'number')) out.push(`${o.key}: bad vis/mag while viewing ${k}`); }
    return out; }, chunk);
  bad.push(...r);
}
// the glyph table: faint levels keep their own glyph; the run of heavy glyphs at the top uses at most three of & 8 @, each with clearly more ink than the one before
bad.push(...await page.evaluate(() => { const a = window.__cosmos.dbg.atlas, d = a.lutData, HEAVY = '%#&8@$W', out = [], used = [];
  if (!d || d.length !== a.levels*a.sub*4) return ['glyph table missing'];
  let h0 = a.levels; while (h0 > 0 && HEAVY.includes(a.chars[h0])) h0--;
  for (let b = 0; b < d.length/4; b++){ const g = d[b*4], ch = a.chars[g], was = Math.floor(b/a.sub) + 1;
    if (!(d[b*4 + 1] > 0 && d[b*4 + 2] > 0 && d[b*4 + 3] > 0 && isFinite(d[b*4 + 1]))) out.push('bad glyph table entry ' + b);
    if (was <= h0){ if (g !== was) out.push(`faint glyph changed at entry ${b}: ${a.chars[was]} -> ${ch}`); continue; }
    if (!'&8@'.includes(ch)) out.push(`bright end uses ${ch} at entry ${b}`);
    if (used[used.length - 1] !== g){ const prev = used.length ? a.ink[used[used.length - 1]] : a.ink[h0];
      if (used.includes(g)) out.push('bright end goes back to ' + ch); else if (!(a.ink[g] > prev)) out.push(`ink does not rise at ${ch}`); used.push(g); } }
  if (used.length > 3) out.push('bright end uses ' + used.map(g => a.chars[g]).join(''));
  return out; }));
// volumes: a sphere beside the camera (reaching behind it) is not drawn; one partly in view gets only its part of the screen; no visible point is ever left out
bad.push(...await page.evaluate(() => { const c = window.__cosmos, cam = c.cam, sr = c.dbg.sphereRect, out = [];
  const at = (x, y, z) => cam.right.map((r, i) => r*x + cam.up[i]*y + cam.fwd[i]*z);
  if (sr(at(10, 0, 0.5), 1)) out.push('sphereRect: a sphere off to the side is drawn');
  const r = sr(at(2, 0, 0.5), 1); if (!r || !(r[0] > -0.9) || r[2] !== 1) out.push('sphereRect: a sphere at the edge gets ' + JSON.stringify(r));
  let seed = 3; const rnd = () => { seed = (seed*1664525 + 1013904223) >>> 0; return seed/4294967296; };
  const [tanX, tanY] = c.dbg.tan;
  for (let t = 0; t < 600 && out.length < 3; t++){
    const d = 1.06 + rnd()*rnd()*20, u = [rnd()*2 - 1, rnd()*2 - 1, rnd()*2 - 1], ul = Math.hypot(...u), C = u.map(x => x/ul*d), rect = sr(at(...C), 1);
    for (let s = 0; s < 300; s++){ const w = [rnd()*2 - 1, rnd()*2 - 1, rnd()*2 - 1], wl = Math.hypot(...w); if (wl > 1 || wl < 1e-6) continue;
      const p = C.map((x, i) => x + w[i]/wl); if (p[2] <= 1e-6) continue;
      const x = p[0]/(p[2]*tanX), y = p[1]/(p[2]*tanY); if (Math.abs(x) > 0.98 || Math.abs(y) > 0.98) continue;
      if (!rect || x < rect[0] || x > rect[2] || y < rect[1] || y > rect[3]){ out.push('sphereRect leaves out a visible point of a sphere at ' + C.map(v => v.toFixed(2))); break; } }
  }
  return out; }));
// the Large Magellanic Cloud is out of sight from the Sun's first view, so it is not ray-marched there (its sphere reaches behind the camera, which used to mean the whole screen)
bad.push(...await page.evaluate(() => { const c = window.__cosmos; c.setTour(false); c.view('sun', 0); c.tick(1/30); c.render();
  return c.BYKEY.lmc.onScreen ? ['the Large Magellanic Cloud is drawn in the Sun view, out of sight'] : []; }));
for (const id of ['#btnAtlas', '#btnTours', '#btnTime', '#btnSettings']){ await page.click(id); await page.waitForTimeout(150); await page.click(id); }
const ui = await page.evaluate(() => ({ rows:document.querySelectorAll('.arow').length, readout:document.querySelector('#readout').textContent.length }));
// help and what's new: ? opens help and fits a 1280 x 800 screen without scrolling; the newest patch notes match package.json and are open;
// Esc closes each; seeing the notes clears the button's dot
{ const pkg = JSON.parse((await import('node:fs')).readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  await page.keyboard.press('?');
  const h = await page.evaluate(() => { const c = document.querySelector('.help-card'); return { open:!document.querySelector('#help').hidden, over:c.scrollHeight - c.clientHeight }; });
  if (!h.open) bad.push('? does not open help'); else if (h.over > 2) bad.push(`help scrolls on a 1280 x 800 screen (${h.over} px more than fits)`);
  await page.keyboard.press('Escape');
  await page.evaluate(() => localStorage.removeItem('gcdatlas.notesSeen'));
  await page.click('#btnNotes');
  const n = await page.evaluate(() => { const d = [...document.querySelectorAll('#notesList details')]; return { open:!document.querySelector('#notes').hidden, n:d.length, v:d[0] && d[0].dataset.v, first:d[0] && d[0].open, rest:d.slice(1).some(x => x.open), items:d.every(x => x.querySelectorAll('li').length > 0), dot:document.querySelector('#btnNotes').classList.contains('has-new'), seen:localStorage.getItem('gcdatlas.notesSeen') }; });
  if (!n.open) bad.push("the new button does not open what's new");
  if (n.v !== pkg.version) bad.push(`the newest patch notes are ${n.v}, package.json says ${pkg.version} (docs/PATCHNOTES.md)`);
  if (!n.first || n.rest || !n.items || n.n < 20) bad.push('patch notes: ' + JSON.stringify(n));
  if (n.dot || n.seen !== pkg.version) bad.push("seeing what's new does not clear its dot");
  await page.keyboard.press('Escape');
  if (await page.evaluate(() => !document.querySelector('#notes').hidden)) bad.push("Esc does not close what's new");
}
if (ui.rows < 50) bad.push('atlas has only ' + ui.rows + ' rows');
// atlas categories: every chip has places; the made-up Halo is not human-made, every real craft is
bad.push(...await page.evaluate(() => { const c = window.__cosmos, d = c.dbg, out = [];
  const listed = c.OBJ.filter(o => o.atlas !== false && !o.marker && d.GROUPS.some(([g]) => g === o.group));
  for (const [id] of d.CATS) if (id !== 'all' && id !== 'earth' && !listed.some(o => d.catsOf(o).includes(id))) out.push('atlas chip ' + id + ' has no places');   // (on Earth: places on Earth, not objects)
  if (d.catsOf(c.BYKEY.halo).includes('human')) out.push('the Halo is in the human-made chip');
  for (const o of listed) if (o.group === 'travel' && o.key !== 'halo' && !d.catsOf(o).includes('human')) out.push(o.key + ' is not in the human-made chip');
  return out; }));
// the shared random seed once every object exists: packs that draw from rnd() put it back, so the Halo's route stays the same (value of 0.8.6)
const seedObjects = await page.evaluate(() => window.__cosmos.dbg.seedObjects);
if (seedObjects !== 3186211718) bad.push('the random seed after the objects changed (' + seedObjects + '): a pack that uses rnd() must put seed back');
// a planet whose angle follows its orbit (track): a flight to its day side lands on the day side, not where it was at take-off
bad.push(...await page.evaluate(() => { const c = window.__cosmos, out = [], n = v => { const l = Math.hypot(...v); return v.map(x => x/l); };
  for (const k of ['peg51b', 'hd189733b']){
    c.setTour(false); c.view('earth', 0); c.tick(1/30);
    const o = c.BYKEY[k]; c.lockOn(o.index, 0); c.land(0);
    const a = n(c.cam.rel), b = n(o.host.pos.map((x, i) => x - o.pos[i])), dot = a[0]*b[0] + a[1]*b[1] + a[2]*b[2];
    if (!(dot > 0.5)) out.push(`${k}: landed on the night side (camera toward the star ${dot.toFixed(2)})`);
  }
  return out; }));
errors.push(...bad);
// the atlas controls on a desk (1280 x 800): every choice on screen and inside the panel, nothing wider than its box at any menu text size
// (nothing scrolls sideways), targets of 28 px or more, the sort row one line whatever the sort, no name cut short, no heading over its note,
// room for about ten rows. Grouped, the Solar System and the comets measure from the Sun and climb, with the Moon under Earth; one kind chosen
// is one heading named after it (galaxies: only galaxies); one list by distance runs from Earth and puts the places we are inside last;
// a search looks through every kind; no row looks chosen by the keyboard with nothing typed; the arrow keys move through the kinds and reach "all";
// every badge does something (planet hopper shows the eight planets); a place seen while "not seen yet" is on changes every count at once;
// the badge tray is solid; Esc closes the badge tray before the atlas
const atl = await page.evaluate(() => {
  const C = window.__cosmos, $ = s => document.querySelector(s), out = [], r = {}, esc = () => dispatchEvent(new KeyboardEvent('keydown', { key:'Escape', bubbles:true }));
  const vis = () => [...document.querySelectorAll('.arow')].filter(b => !b.hidden);
  const cut = () => vis().filter(x => { const n = x.querySelector('.an'), d = x.querySelector('.ad'); return n.scrollWidth > n.clientWidth + 1 || d.scrollWidth > d.clientWidth + 1; }).map(x => x.querySelector('.an').textContent);
  const fit = () => { const a = $('#atlas'), ar = a.getBoundingClientRect(), bad = [];
    for (const e of a.querySelectorAll('*')) if (e.clientWidth > 0 && !e.closest('.atlas-list') && !e.classList.contains('sr') && e.scrollWidth > e.clientWidth + 1) bad.push('overflows: ' + (e.id || e.className));
    for (const b of a.querySelectorAll('#atlasTools button, #seenBtn, #atlasClose')){ const q = b.getBoundingClientRect(), id = b.id || b.dataset.cat || b.dataset.sort;
      if (q.left < ar.left - 1 || q.right > ar.right + 1 || q.top < ar.top - 1 || q.bottom > ar.bottom + 1) bad.push('outside the panel: ' + id); if (q.height < 28) bad.push('under 28 px: ' + id); }
    const h = new Set(); for (const s of ['distance', 'size', 'name', 'kind']){ $(`#atlasSort [data-sort="${s}"]`).click(); h.add(Math.round($('.sort-row').getBoundingClientRect().height)); const c = cut(); if (c.length) bad.push(`names cut short sorted by ${s}: ${c.slice(0, 3)}`); }
    if (h.size > 1 || Math.max(...h) > 2*$('#atlasDir').getBoundingClientRect().height) bad.push('the sort row takes two lines or changes height: ' + [...h]);
    for (const g of document.querySelectorAll('.agroup:not([hidden])')){ const t = g.firstChild.getBoundingClientRect(), n = g.lastChild.getBoundingClientRect(); if (n.width && t.right > n.left + 1 && t.bottom > n.top + 1 && n.bottom > t.top + 1) bad.push('a heading runs into its note: ' + g.firstChild.textContent); }
    return bad; };
  if ($('#atlas').hidden) $('#btnAtlas').click();
  for (const ms of [0.9, 1.15, 1.3, 1.6]){ C.setOpt('menuSize', ms, true); out.push(...fit().map(m => `menu text ${Math.round(ms*100)}%: ${m}`)); }
  C.setOpt('menuSize', 1.15, true);
  r.cells = document.querySelectorAll('#atlasCats .cell').length;
  r.rows = +($('#atlasList').clientHeight/$('.arow').getBoundingClientRect().height).toFixed(1);
  r.dflt = { sort:$('#atlasSort [aria-checked="true"]').dataset.sort, all:$('#atlasAll').getAttribute('aria-checked'), result:!$('#atlasResult').hidden, dir:$('#atlasDir').textContent, kb:document.querySelectorAll('.arow.kb').length, flow:$('#atlas').classList.contains('flow') };
  if (!/^rgb\(/.test(getComputedStyle($('#badgeTray')).backgroundColor)) out.push('the badge tray lets the rows show through');
  // grouped: what each heading measures, and the numbers climb
  const group = g => { const h = [...document.querySelectorAll('#atlasList .agroup')].find(x => x.firstChild.textContent === g), rows = [];
    for (let x = h && h.nextElementSibling; x && !x.classList.contains('agroup'); x = x.nextElementSibling) if (x.classList.contains('arow') && !x.hidden) rows.push({ name:x.querySelector('.an').textContent, d:x.querySelector('.ad').textContent, child:x.classList.contains('child') });
    return { note:h && h.lastChild.textContent, rows }; };
  const au = t => { const m = /([\d,.]+) AU$/.exec(t); return m ? +m[1].replace(/,/g, '') : null; };
  for (const g of ['Solar System', 'Comets & meteors']){ const G = group(g); if (G.note !== 'from the Sun') out.push(`the ${g} heading measures "${G.note}"`);
    const v = G.rows.filter(x => !x.child).map(x => au(x.d)).filter(x => x != null); if (v.some((x, i) => i && x < v[i - 1])) out.push(`${g}: the distances from the Sun do not climb (${v.join(', ')})`); }
  if (group('Stars & stellar remnants').note !== 'from Earth') out.push('the stars heading does not say "from Earth"');
  const ss = group('Solar System').rows, iE = ss.findIndex(x => x.name === 'Earth'), moon = ss[iE + 1];
  r.solar = ss.slice(0, 6).map(x => x.name + ' ' + x.d).join(' · ');
  if (ss[0].name !== 'the Solar System' || ss[1].name !== 'the Sun' || ss[ss.length - 1].name !== 'the Oort cloud') out.push('Solar System heading order: ' + ss.map(x => x.name).join(', '));
  if (!moon || moon.name !== 'the Moon' || !moon.child || !/ km from Earth$/.test(moon.d) || !/^home · 1\.0\d AU$/.test(ss[iE].d)) out.push('Earth and the Moon under it: ' + JSON.stringify(ss.slice(iE, iE + 2)));
  // one kind: one heading named after it, only that kind (the S-stars are stars, not a galaxy)
  $('#atlasCats [data-cat="galaxies"]').click();
  const G = group('Galaxies'); r.gal = { note:G.note, n:G.rows.length, first:G.rows.slice(0, 3).map(x => x.name).join(', '), heads:[...document.querySelectorAll('.agroup:not([hidden])')].length,
    stray:G.rows.filter(x => /S-stars|GW170817|Sagittarius A\*|M87\*/.test(x.name)).map(x => x.name) };
  $('#atlasAll').click();
  // one list by distance: near to far from Earth from the first row, the places we are inside last under their own heading, said in the results line
  $('#atlasSort [data-sort="distance"]').click();
  const kids = [...$('#atlasList').children].filter(e => !e.hidden && !e.classList.contains('aend'));
  r.flat = kids.slice(0, 2).concat(kids.slice(-5)).map(e => e.classList.contains('agroup') ? '#' + e.firstChild.textContent : e.querySelector('.an').textContent).join(', ');
  r.flatSays = [($('#atlasResultTxt').textContent + ' / ' + $('#atlasResultNote').textContent).replace(/[\s]+/g, ' '), $('#atlasDir').textContent, !$('#atlasResult').hidden];
  $('#atlasSort [data-sort="size"]').click(); r.size = [$('#atlasDir').textContent, $('.arow:not([hidden]) .an').textContent, $('.arow:not([hidden]) .ad').textContent, $('#atlasResultNote').textContent];
  $('#atlasSort [data-sort="kind"]').click();
  // a search looks through every kind (black holes chosen, Jupiter still found); "clear" empties it and keeps the kind
  $('#atlasCats [data-cat="bh"]').click();
  const s = $('#atlasSearch'); s.value = 'jupiter'; s.dispatchEvent(new Event('input', { bubbles:true }));
  r.search = { jupiter:vis().some(b => b.querySelector('.an').textContent === 'Jupiter'), found:$('#atlasResultTxt').textContent, btn:$('#atlasReset').textContent, dim:$('#atlasTools').classList.contains('searching'), kb:document.querySelectorAll('.arow.kb').length };
  $('#atlasReset').click(); r.cleared = { box:s.value, cat:C.dbg.ATL.cat, n:vis().length, kb:document.querySelectorAll('.arow.kb').length };
  // arrow keys: black holes → galaxies (right) → human-made (down); from the first kind, left goes to "all"; the camera does not get the keys
  const key = (e, k) => e.dispatchEvent(new KeyboardEvent('keydown', { key:k, bubbles:true, cancelable:true }));
  const cell = $('#atlasCats [data-cat="bh"]'); cell.focus();
  key(cell, 'ArrowRight'); r.kRight = C.dbg.ATL.cat;
  key(document.activeElement, 'ArrowDown'); r.kDown = [C.dbg.ATL.cat, document.activeElement.dataset.cat];
  $('#atlasCats [data-cat="solar"]').click(); $('#atlasCats [data-cat="solar"]').focus(); key(document.activeElement, 'ArrowLeft'); r.kAll = [C.dbg.ATL.cat, document.activeElement.id, $('#atlasAll').getAttribute('role'), $('#atlasAll').parentElement.id];
  // a place seen while "not seen yet" is on: the cell, the results line and the head count agree at once (the row stays, with its ✓)
  $('#atlasCats [data-cat="bh"]').click(); $('#atlasUnseen').click();
  const before = $('#atlasResultTxt').textContent; C.markSeen(C.BYKEY.m87bh);
  r.seenNow = [before, $('#atlasResultTxt').textContent, $('#atlasCats [data-cat="bh"] .n').textContent, $('#atlasCount').textContent, vis().some(b => b.querySelector('.an').textContent === 'M87*')];
  $('#atlasUnseen').click();
  // the badge tray: every badge is a button; black hole hunter shows the black holes left, planet hopper just the planets left; Esc closes the tray first, then the atlas
  $('#seenBtn').click(); r.tray = [!$('#badgeTray').hidden, $('#seenBtn').getAttribute('aria-expanded'), document.querySelectorAll('#badges .brow').length, document.querySelectorAll('#badges button.brow').length];
  const badge = n => [...document.querySelectorAll('#badges button.brow')].find(b => b.textContent.includes(n));
  badge('black hole hunter').click();
  r.badgeGo = [C.dbg.ATL.cat, C.dbg.ATL.unseen, !$('#badgeTray').hidden, $('#atlasResultTxt').textContent];
  $('#seenBtn').click(); badge('planet hopper').click();
  r.planets = [$('#atlasResultTxt').textContent, vis().map(b => b.querySelector('.an').textContent).sort().join(','), document.querySelectorAll('#atlasCats [aria-checked="true"]').length];
  $('#seenBtn').click(); esc(); r.escTray = [!$('#badgeTray').hidden, !$('#atlas').hidden]; esc(); r.escAtlas = !$('#atlas').hidden;
  $('#btnAtlas').click(); $('#atlasReset').click(); r.reset = [!$('#atlasResult').hidden, JSON.stringify(C.dbg.ATL)]; $('#atlasClose').click();
  r.out = out; return r;
});
errors.push(...atl.out);
// (how many places the atlas lists, counted from the page, so a content pack does not have to change these checks)
const NPL = await page.evaluate(() => { const C = window.__cosmos; return C.OBJ.filter(o => o.atlas !== false && !o.marker && C.dbg.GROUPS.some(([g]) => g === o.group)).length; });
if (atl.cells !== 14) errors.push('the atlas has ' + atl.cells + ' cells ("all", 12 kinds and "on Earth" expected)');
if (!(atl.rows >= 10)) errors.push('the atlas list has room for only ' + atl.rows + ' rows at 1280 x 800');
if (atl.dflt.sort !== 'kind' || atl.dflt.all !== 'true' || atl.dflt.result || atl.dflt.dir !== '⇅near → far' || atl.dflt.kb || atl.dflt.flow) errors.push('the atlas default view: ' + JSON.stringify(atl.dflt));
if (atl.gal.note !== 'from Earth' || atl.gal.heads !== 1 || atl.gal.stray.length || atl.gal.first !== 'the Milky Way, the Galactic Centre, Sagittarius Dwarf') errors.push('galaxies chosen: ' + JSON.stringify(atl.gal));
if (atl.flat !== 'Earth, Starship, #all around us, the Solar System, the Oort cloud, the cosmic web, the observable universe') errors.push('one list by distance: ' + atl.flat);
if (atl.flatSays.join('|') !== `${NPL} places · near → far / from Earth|⇅near → far|true`) errors.push('the results line for one list by distance: ' + JSON.stringify(atl.flatSays));
if (atl.size.join('|') !== '⇅big → small|the observable universe|93 billion ly|true size, across') errors.push('size does not start with the biggest, said short: ' + JSON.stringify(atl.size));
if (!atl.search.jupiter || !new RegExp(`^\\d+ found · searching all ${NPL}$`).test(atl.search.found) || atl.search.btn !== 'clear' || !atl.search.dim || atl.search.kb !== 1) errors.push('a search with black holes chosen: ' + JSON.stringify(atl.search));
if (atl.cleared.box || atl.cleared.cat !== 'bh' || atl.cleared.n !== 8 || atl.cleared.kb) errors.push('clearing the search: ' + JSON.stringify(atl.cleared));
if (atl.kRight !== 'galaxies' || atl.kDown.join() !== 'human,human' || atl.kAll.join() !== 'all,atlasAll,radio,atlasCats') errors.push('arrow keys in the kinds: ' + JSON.stringify([atl.kRight, atl.kDown, atl.kAll]));
if (!/^8 black holes not seen yet/.test(atl.seenNow[0]) || !/^7 black holes not seen yet/.test(atl.seenNow[1]) || atl.seenNow[2] !== '7' || atl.seenNow[3] !== `7 of ${NPL}` || !atl.seenNow[4]) errors.push('a place seen with "not seen yet" on: ' + JSON.stringify(atl.seenNow));
if (!atl.tray[0] || atl.tray[1] !== 'true' || atl.tray[2] !== 9 || atl.tray[3] !== 9) errors.push('the badge tray: ' + JSON.stringify(atl.tray));
if (atl.badgeGo[0] !== 'bh' || !atl.badgeGo[1] || atl.badgeGo[2] || !/^7 black holes not seen yet/.test(atl.badgeGo[3])) errors.push('black hole hunter does not show the black holes left: ' + JSON.stringify(atl.badgeGo));
const planetsLeft = atl.planets[1] ? atl.planets[1].split(',') : [], PL = ['Mercury', 'Venus', 'Earth', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune'];
if (atl.planets[0] !== planetsLeft.length + ' places not seen yet for planet hopper' || !planetsLeft.length || planetsLeft.some(n => !PL.includes(n)) || atl.planets[2]) errors.push('planet hopper does not show just the planets: ' + JSON.stringify(atl.planets));
if (atl.escTray.join() !== 'false,true' || atl.escAtlas) errors.push('Esc does not close the badge tray, then the atlas: ' + JSON.stringify([atl.escTray, atl.escAtlas]));
if (atl.reset[0] || atl.reset[1] !== '{"sort":"kind","dir":1,"cat":"all","unseen":false}') errors.push('reset: ' + JSON.stringify(atl.reset));
// catalogue numbers: both search boxes find a place by its Messier, NGC or IC number, whatever the spaces and case, and only by the whole
// number (M2 is not in the atlas: nothing, never M20, M22 or M27; M4 is M4, never M42, M44 or M45; M1 is the Crab, never WR 124's M1-67). The place whose own number it is comes
// first, with the keyboard on it, in every order of the list (M87 before its jet and M87*, the Eagle Nebula before the Pillars), and clearing
// the search puts the list back as it was
const CATQ = [['M31', 'Andromeda Galaxy'], ['NGC 1976', 'Orion Nebula'], ['NGC1952', 'Crab Nebula'], ['m 42', 'Orion Nebula'], ['Messier 42', 'Orion Nebula'],
  ['NGC 224', 'Andromeda Galaxy'], ['ngc 5194', 'Whirlpool Galaxy'], ['M110', 'Andromeda Galaxy'], ['IC 434', 'Horsehead Nebula'], ['M16', 'Eagle Nebula'], ['m87', 'M87'], ['M4', 'M4'], ['M44', 'Beehive Cluster'], ['NGC 6853', 'Dumbbell Nebula'], ['m 17', 'Omega Nebula']];
const cat = await page.evaluate(CATQ => {
  const $ = s => document.querySelector(s), out = [], names = () => [...document.querySelectorAll('.arow')].filter(b => !b.hidden).map(b => b.querySelector('.an').textContent);
  const find = (box, q) => { const s = $(box); s.value = q; s.dispatchEvent(new Event('input', { bubbles:true })); const kb = $('.arow.kb'); return { v:names(), kb:kb && kb.querySelector('.an').textContent }; };
  const codes = q => window.__cosmos.dbg.catSplit(q).codes.join(' ');
  for (const [q, want] of [['M4', 'm4'], ['m 4', 'm4'], ['Messier 4', 'm4'], ['NGC 6121', 'ngc6121'], ['ngc6121', 'ngc6121'], ['IC 434', 'ic434'], ['m31 ngc 224', 'm31 ngc224'], ['M87*', 'm87'], ['m1-67', ''], ['kic 8462852', ''], ['3c 273', '']])
    if (codes(q) !== want) out.push(`"${q}" reads as the catalogue numbers "${codes(q)}", not "${want}"`);
  if ($('#atlas').hidden) $('#btnAtlas').click();
  const order = () => [...$('#atlasList').children].filter(e => e.matches('.arow, .agroup')).map(e => e.querySelector('.an, .gt').textContent).join('|');
  for (const box of ['#search', '#atlasSearch']){
    for (const [q, name] of CATQ){ const r = find(box, q); if (r.v[0] !== name || r.kb !== name) out.push(`${box} "${q}": ${r.v.join(', ') || 'nothing'} (keyboard on ${r.kb})`); }
    // (numbers of nothing in the atlas find nothing; until 0.21.0 this was M2, now in the atlas, where "M2" must not find M27 or M29)
    for (const q of ['NGC 2', 'ngc2', 'IC 1', 'ic 1']){ const r = find(box, q); if (r.v.length) out.push(`${box} "${q}" finds ${r.v.join(', ')}`); }
    for (const [q, want] of [['M2', 'M2'], ['ngc 7089', 'M2'], ['M54', 'M54'], ['Pease 1', 'Pease 1']]){ const r = find(box, q).v[0]; if (r !== want) out.push(`${box} "${q}" finds ${r} first`); }
    const m2 = find(box, 'M2').v.join(', '); if (m2 !== 'M2') out.push(`${box} "M2" finds ${m2}`);
    const m1 = find(box, 'M1').v.join(', '); if (m1 !== 'Crab Nebula') out.push(`${box} "M1" finds ${m1}`);
    const m4 = find(box, 'M4').v.join(', '); if (m4 !== 'M4') out.push(`${box} "M4" finds ${m4}`);
    const m16 = find(box, 'm16').v.join(', '); if (m16 !== 'Eagle Nebula, Pillars of Creation') out.push(`${box} "m16" finds ${m16}`);
  }
  let moved = 0;
  for (const s of ['distance', 'size', 'name', 'kind']) for (const d of [0, 1]){
    $(`#atlasSort [data-sort="${s}"]`).click(); if (d) $('#atlasDir').click();
    if ($('#atlasSearch').value) $('#atlasReset').click();   // ("clear": the search only)
    const was = order(), r = find('#atlasSearch', 'M87'), now = order(), how = `sorted by ${s}${d ? ', reversed' : ''}`;
    if (r.v[0] !== 'M87' || r.kb !== 'M87' || r.v.length !== 3) out.push(`"M87" ${how}: ${r.v.join(', ')} (keyboard on ${r.kb})`);
    if (now !== was) moved++;
    $('#atlasReset').click(); if (order() !== was) out.push(`the list is not back in its order after "M87" ${how}`);
  }
  if (!moved) out.push('"M87" never had to move a row: the order check tested nothing');
  $('#atlasReset').click(); $('#atlasClose').click();
  return out; }, CATQ);
errors.push(...cat);
// no two places in the atlas claim one catalogue number in their aka (catClash in 09-render.js): one of them would be a duplicate. A reused
// key never gets this far: addObj throws and the page does not start
errors.push(...(await page.evaluate(() => window.__cosmos.dbg.catClash())).map(s => 'two places claim one catalogue number: ' + s));
// the Halo tour switch right of tours (0.9.9, owner review: "a typical toggle", in place of "☾ halo ○──"): the plain tours button, then one
// control with the words "Halo tour" and a pill (a round knob in a track 34 to 40 px by 18 to 20 px), role switch, named for what it does.
// On, the Halo tour starts with the tour picked, the knob slides right and the track lights up, the info panel shows the place (not the
// ship) and the list of tours says the Halo flies it; off, it ends and the panel shows the Halo again. Space and Enter flip it; the knob does
// not slide with reduced motion. The phone's copy at the top of the list of tours stays hidden on a desk. The top row keeps to one line at 1280 px
const knob = () => page.evaluate(() => { const t = document.querySelector('#btnHaloSw .hsw-t'), k = getComputedStyle(t, '::before');
  return { x:k.transform === 'none' ? 0 : new DOMMatrix(k.transform).m41, track:getComputedStyle(t).backgroundColor, dur:k.transitionDuration, on:window.__cosmos.HT.on }; });
const hsw = await page.evaluate(() => { const C = window.__cosmos, $ = s => document.querySelector(s), sw = $('#btnHaloSw'), t = $('#btnTours'), r = {};
  C.setTour(false); C.view('saturn', 0); C.tick(1/30);
  const a = t.getBoundingClientRect(), b = sw.getBoundingClientRect(), tr = sw.querySelector('.hsw-t'), tb = tr && tr.getBoundingClientRect(), lb = sw.querySelector('.hsw-l'), ts = getComputedStyle(t);
  r.plain = t.textContent === 'tours' && ts.borderTopRightRadius === ts.borderTopLeftRadius && ts.borderBottomRightRadius === ts.borderBottomLeftRadius;
  r.next = b.left - a.right > 0 && b.left - a.right <= 8 && Math.abs(a.top - b.top) <= 1 && Math.abs(a.height - b.height) <= 1;
  r.sw = sw.getAttribute('role') === 'switch' && /^Halo tour: /.test(sw.getAttribute('aria-label') || '') && !!lb && lb.textContent === 'Halo tour' && !!tb && lb.getBoundingClientRect().right <= tb.left;
  r.pill = tb ? [Math.round(tb.width), Math.round(tb.height), parseFloat(getComputedStyle(tr).borderTopLeftRadius) >= tb.height/2 - 1] : null;
  r.phoneCopy = getComputedStyle($('#toursHaloSw')).display;
  const top = [...document.querySelectorAll('.controls > *')].filter(e => e.offsetWidth && getComputedStyle(e).order === '0').map(e => Math.round(e.getBoundingClientRect().top));
  r.rows = new Set(top).size;
  r.old = !!$('#btnHaloTour') || !!document.querySelector('.halo-sw, .hs-k');
  r.before = [C.HT.on, sw.getAttribute('aria-checked')];
  return r; });
const k0 = await knob();
Object.assign(hsw, await page.evaluate(() => { const C = window.__cosmos, $ = s => document.querySelector(s), sw = $('#btnHaloSw'), t = $('#btnTours'), r = {};
  sw.click(); r.on = [C.HT.on, sw.getAttribute('aria-checked'), C.HT.tourId === C.tourId, $('#toursHaloSw').getAttribute('aria-checked')];
  // (and the panel shows the place the Halo visits or goes to, not the ship, with its blue line and the panel's ride buttons; back to the Halo after)
  C.hud(); const hl = $('#htLine'), pl = C.htPlace();
  r.place = [!!pl && pl !== C.BYKEY.halo && $('#objName').textContent === pl.name, !hl.hidden && /^(with the Halo · |→ )/.test(hl.textContent), !$('#btnRideI').hidden];
  t.click(); r.note = !$('#tours').hidden && !$('#htNote').hidden && $('#htNote').getBoundingClientRect().height > 0; t.click();
  return r; }));
await page.waitForTimeout(400);   // (the knob slides for 0.2 s)
const k1 = await knob();
Object.assign(hsw, await page.evaluate(() => { const C = window.__cosmos, $ = s => document.querySelector(s), sw = $('#btnHaloSw'), r = {};
  sw.click(); r.off = [C.HT.on, sw.getAttribute('aria-checked')]; C.hud();
  r.back = [$('#objName').textContent === C.BYKEY.halo.name, $('#htLine').hidden];
  return r; }));
// (the keyboard: Space turns it on, Enter off)
await page.focus('#btnHaloSw');
await page.keyboard.press(' '); const kSp = await page.evaluate(() => [window.__cosmos.HT.on, document.activeElement.id]);
await page.keyboard.press('Enter'); const kEn = await page.evaluate(() => [window.__cosmos.HT.on, document.activeElement.id]);
await page.emulateMedia({ reducedMotion:'reduce' }); const kRm = await knob(); await page.emulateMedia({ reducedMotion:null });
await page.evaluate(() => { const C = window.__cosmos; document.activeElement.blur(); C.lockOn(C.BYKEY.earth.index); C.land(0); C.setTour(false); });
if (!hsw.plain || !hsw.next || !hsw.sw || hsw.old) errors.push('the Halo tour switch is not a labelled switch right of a plain tours button (or the old one is still there): ' + JSON.stringify(hsw));
if (!hsw.pill || hsw.pill[0] < 34 || hsw.pill[0] > 40 || hsw.pill[1] < 18 || hsw.pill[1] > 20 || !hsw.pill[2]) errors.push('the Halo tour switch has no pill of 34 to 40 by 18 to 20 px: ' + JSON.stringify(hsw.pill));
if (hsw.phoneCopy !== 'none') errors.push('the phone\'s Halo tour switch shows in the list of tours on a desk');
if (hsw.rows !== 1) errors.push(`the top row of the bar takes ${hsw.rows} lines at 1280 px`);
if (hsw.before.join() !== 'false,false' || hsw.on.join() !== 'true,true,true,true' || hsw.off.join() !== 'false,false') errors.push('the Halo tour switch does not start and end the Halo tour: ' + JSON.stringify(hsw));
if (k0.x !== 0 || !(k1.x >= 14) || k0.track === k1.track || k0.on || !k1.on) errors.push('the Halo tour switch\'s knob does not slide right, or its track does not light up: ' + JSON.stringify([k0, k1]));
if (kSp.join() !== 'true,btnHaloSw' || kEn.join() !== 'false,btnHaloSw') errors.push('Space and Enter do not flip the Halo tour switch: ' + JSON.stringify([kSp, kEn]));
if (parseFloat(k1.dur) < 0.1 || parseFloat(kRm.dur) !== 0) errors.push('the Halo tour switch\'s knob: a slide of ' + k1.dur + ', with reduced motion ' + kRm.dur);
if (!hsw.note) errors.push('the list of tours does not say the Halo flies it while the Halo tour switch is on');
if (hsw.place.join() !== 'true,true,true' || hsw.back.join() !== 'true,true') errors.push('the Halo tour does not show the place in the info panel, or not the Halo after: ' + JSON.stringify([hsw.place, hsw.back]));
// saved choices keep working: 'travel' (the old spacecraft chip) opens human-made; the old "not seen yet" chip becomes all with the box ticked
// (sorted as it was); the old default ("distance, nearest first" over the headings) stays grouped; a saved flat list stays flat.
// With every black hole seen, "not seen yet" says so and its button shows them all again.
const bhKeys = await page.evaluate(() => { const c = window.__cosmos, d = c.dbg; return c.OBJ.filter(o => o.atlas !== false && !o.marker && d.GROUPS.some(([g]) => g === o.group) && d.catsOf(o).includes('bh')).map(o => o.key); });
const reload = async (saved, seen) => {
  await page.evaluate(([a, s]) => { localStorage.setItem('gcdatlas.atlas', JSON.stringify(a)); if (s) localStorage.setItem('gcdatlas.seen', JSON.stringify(s)); }, [saved, seen]);
  await page.goto('about:blank'); await page.goto(PAGE);
  await page.waitForFunction(() => window.__cosmos && window.__cosmos.OBJ, null, { timeout:60000 });
  return page.evaluate(() => { const A = window.__cosmos.dbg.ATL, b = document.querySelector('#atlasCats [aria-checked="true"]');
    return [A.sort, A.dir, b ? b.dataset.cat : 'all', document.querySelector('#atlasUnseen').getAttribute('aria-checked')].join(' '); });
};
for (const [saved, want] of [[{ cat:'travel' }, 'kind 1 human false'], [{ sort:'distance', dir:1, cat:'unseen' }, 'distance 1 all true'],
  [{ sort:'distance', dir:1, cat:'all' }, 'kind 1 all false'], [{ sort:'size', dir:-1, cat:'nebulae' }, 'size -1 nebulae false'], [{ v:2, sort:'distance', dir:1, cat:'all', unseen:false }, 'distance 1 all false']]){
  const got = await reload(saved);
  if (got !== want) errors.push(`a saved atlas ${JSON.stringify(saved)} opens as "${got}", not "${want}"`);
}
await reload({ v:2, sort:'kind', dir:1, cat:'bh', unseen:true }, bhKeys);
const allSeen = await page.evaluate(() => { const $ = s => document.querySelector(s); $('#btnAtlas').click();
  const e = $('.atlas-empty'), r = { empty:!e.hidden && e.textContent, done:$('#atlasCats [data-cat="bh"]').classList.contains('done'), n:$('#atlasCats [data-cat="bh"] .n').textContent };
  e.querySelector('button').click(); r.after = [window.__cosmos.dbg.ATL.unseen, document.querySelectorAll('.arow:not([hidden])').length]; return r; });
if (allSeen.empty !== 'you have seen all 8 black holes ✓show them all' || !allSeen.done || allSeen.n !== '✓' || allSeen.after.join() !== 'false,8') errors.push('every black hole seen, with "not seen yet": ' + JSON.stringify(allSeen));
await page.evaluate(() => { localStorage.removeItem('gcdatlas.atlas'); localStorage.removeItem('gcdatlas.seen'); });
// crafted share links must not stop the page from starting (they used to: #o=constructor, a non-numeric date)
for (const h of ['#o=constructor', '#o=__proto__', '#o=earth&jd=abc&deep=x&c=1,NaN,-5']){
  await page.goto('about:blank'); await page.goto(PAGE + h);   // (a real load: changing only the hash would not restart the page)
  const ok = await page.waitForFunction(() => window.__cosmos && window.__cosmos.OBJ && isFinite(window.__cosmos.cam.rel[0]) && window.__cosmos.BYKEY.earth.pos.every(isFinite), null, { timeout:60000 }).then(() => true, () => false);
  if (!ok) errors.push('share link ' + h + ' broke the page');
}
report('smoke', errors, `${keys.length} objects rendered, ${ui.rows} atlas rows · atlas controls fit at 90 to 160% menu text, room for ${atl.rows} rows at 1280 x 800 · ${atl.solar}`);
await browser.close();

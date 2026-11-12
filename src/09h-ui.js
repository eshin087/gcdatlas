// ================================================================ interface comfort: the info panel's states, the phone layout, and fading away when idle
// Phones (see COMPACT_MQ): a dock at the bottom, the info as a card above it (swipe or tap its grip), the scale ladder behind a chip.
// Everywhere: after a few quiet seconds the interface fades and leaves the object's name; any touch, key or mouse move brings it back.
const PORTRAIT_MQ = matchMedia('(max-width:680px)');
const rootStyle = document.documentElement.style, bodyCL = document.body.classList;
const infoGrip = $('#infoGrip'), infoMore = $('#infoMore'), infoHide = $('#infoHide'), pillName = $('#infoPillName'), ladChipTxt = $('#ladChipTxt');

// ---------------------------------------------------------------- the info panel: full, compact or hidden (remembered separately for phones and bigger screens)
const infoKey = () => isCompact() ? 'infoM' : 'infoD';
const infoState = () => { const s = SET[infoKey()]; return s === 'compact' || s === 'hidden' ? s : 'full'; };
function setInfoState(s){ SET[infoKey()] = s; saveSet(); applyInfoState(); wakeUI(); }
function applyInfoState(){
  const s = infoState(), c = isCompact();
  bodyCL.toggle('info-compact', s === 'compact'); bodyCL.toggle('info-hidden', s === 'hidden');
  infoPillEl.hidden = s !== 'hidden';
  // the card on a phone grows upward, the panel on a desk grows downward
  infoMore.textContent = s === 'full' ? (c ? '▾ less' : 'less') : (c ? '▴ more' : 'more');
  infoMore.setAttribute('aria-expanded', String(s === 'full'));
  infoMore.title = (s === 'full' ? 'Show less' : 'Show the facts, numbers and ruler') + ' (I)';
  infoGrip.setAttribute('aria-label', s === 'full' ? 'Show less' : 'Show more');
  syncLayout();
}
infoMore.addEventListener('click', () => setInfoState(infoState() === 'full' ? 'compact' : 'full'));
infoHide.addEventListener('click', () => { setInfoState('hidden'); toast(isCompact() ? 'info hidden · tap the i to bring it back' : 'info hidden · click the i or press I to bring it back'); });
infoPillEl.addEventListener('click', () => setInfoState(isCompact() ? 'compact' : 'full'));
infoGrip.addEventListener('click', () => setInfoState(infoState() === 'full' ? 'compact' : 'full'));
// swipe the card: up for more, down for less, down again to hide it
let swipe = null;
infoEl.addEventListener('touchstart', e => {
  swipe = isCompact() && e.touches.length === 1 ? { x:e.touches[0].clientX, y:e.touches[0].clientY, top:infoEl.scrollTop, t:performance.now() } : null;
}, { passive:true });
infoEl.addEventListener('touchend', e => {
  if (!swipe) return;
  const t = e.changedTouches[0], dx = t.clientX - swipe.x, dy = t.clientY - swipe.y, s0 = swipe; swipe = null;
  if (Math.abs(dy) < 36 || Math.abs(dy) < Math.abs(dx)*1.4 || performance.now() - s0.t > 800) return;
  const s = infoState();
  if (dy < 0){ if (s !== 'full') setInfoState('full'); }
  else if (s0.top <= 1) setInfoState(s === 'full' ? 'compact' : 'hidden');
}, { passive:true });
addEventListener('keydown', e => {
  if (e.target.closest && e.target.closest('input')) return;
  if (e.ctrlKey || e.metaKey || e.altKey || e.key.toLowerCase() !== 'i' || modalOpen()) return;
  const s = infoState(); setInfoState(s === 'full' ? 'compact' : s === 'compact' ? 'hidden' : 'full');
});

// ---------------------------------------------------------------- phones: the dock and the card set --dock-h and --sheet-h so captions, toasts and cards stack above them
function syncLayout(){
  const c = isCompact();
  const dock = c ? Math.max(0, innerHeight - controlsEl.getBoundingClientRect().top) : 0;
  let sheet = 0;
  if (c && PORTRAIT_MQ.matches){ const el = infoState() === 'hidden' ? infoPillEl : infoEl, r = el.getBoundingClientRect(); sheet = r.height ? r.height + 6 : 0; }
  rootStyle.setProperty('--dock-h', Math.round(dock) + 'px'); rootStyle.setProperty('--sheet-h', Math.round(sheet) + 'px');
  shiftT0 = 0;
}
if (typeof ResizeObserver !== 'undefined'){ const ro = new ResizeObserver(() => syncLayout()); [controlsEl, infoEl, infoPillEl].forEach(el => ro.observe(el)); }
COMPACT_MQ.addEventListener('change', () => { applyInfoState(); syncSettingsUI(); updateModeUI(); roLast = ''; if (!isCompact()) setLadOpen(false); });
PORTRAIT_MQ.addEventListener('change', syncLayout);
addEventListener('resize', syncLayout);
// picking or resuming a tour closes the panel so you can watch it (on a desk it used to stay open over the caption);
// on a phone the other choices close it too
$('#tours').addEventListener('click', e => {
  const t = e.target.closest('.trow, #btnTour, #btnFree'); if (!t) return;
  if (isCompact() || t.classList.contains('trow') || (t.id === 'btnTour' && tour.on)) setTimeout(() => togglePanel('tours', false), 120);
});

// ---------------------------------------------------------------- phones: the scale ladder opens from a chip, and folds away again by itself
let ladOpenAt = 0;
function setLadOpen(on){ bodyCL.toggle('lad-open', on); ladChipEl.setAttribute('aria-expanded', String(on)); ladOpenAt = performance.now(); if (on){ wakeUI(); ladTitles(); } }
ladChipEl.addEventListener('click', () => setLadOpen(!bodyCL.contains('lad-open')));
addEventListener('pointerdown', e => {
  if (!bodyCL.contains('lad-open')) return;
  if (e.target.closest && e.target.closest('#ladder, #ladChip')){ ladOpenAt = performance.now(); return; }
  setLadOpen(false); if (e.target === canvas) wakeTapAt = performance.now();   // the tap that closes it does not also fly somewhere
}, { capture:true });
ladderEl.addEventListener('click', e => { if (isCompact() && e.target.closest('.tick')) setTimeout(() => setLadOpen(false), 350); });
function updateLadChip(){
  if (!isCompact()) return;
  const t = tour.on && TOUR.length > 1 ? $('#ladCap').textContent : ladTxt.textContent.split(' · ').pop();
  if (ladChipTxt.textContent !== t) ladChipTxt.textContent = t;
  if (bodyCL.contains('lad-open') && !ladDrag && performance.now() - ladOpenAt > 7000) setLadOpen(false);
}

// ---------------------------------------------------------------- idle: fade the interface after a few quiet seconds (sooner on a tour), but never while you are using it
const IDLE = { at:performance.now() + 3000, on:false, hover:false, readUntil:0, obj:-1, eatClick:0 };
function wakeUI(){ IDLE.at = performance.now(); if (IDLE.on){ IDLE.on = false; bodyCL.remove('ui-idle'); } }
function idleAfter(){
  const m = SET.fadeUI; if (m === 'off') return Infinity;
  const base = m === 'slow' ? 8000 : 3500;
  return tour.on ? base*0.7 : base*1.4;
}
function idleBlocked(){
  return !atlasEl.hidden || !settingsEl.hidden || !$('#tours').hidden || !$('#timem').hidden || !$('#story').hidden || modalOpen() || !shipMenuEl.hidden
    || bodyCL.contains('photo') || bodyCL.contains('saver') || bodyCL.contains('sky') || bodyCL.contains('lad-open')
    || IDLE.hover || !!ladDrag || cmpPick || (document.activeElement && document.activeElement.tagName === 'INPUT');
}
addEventListener('pointermove', e => {
  if (e.pointerType === 'mouse'){
    // the info text lets the mouse through to the canvas, so check its box too: resting the mouse on what you read keeps it
    const ir = infoEl.getBoundingClientRect();
    IDLE.hover = !!(e.target.closest && e.target.closest('.controls, .info, .ladder, .lad-chip, .info-pill, .daily, .caption, .atlas, .panel'))
      || (!bodyCL.contains('info-hidden') && e.clientX >= ir.left && e.clientX <= ir.right && e.clientY >= ir.top && e.clientY <= ir.bottom);
    if (IDLE.on && Math.abs(e.movementX) + Math.abs(e.movementY) < 3) return;   // a nudged desk is not a person
  }
  wakeUI();
}, { capture:true, passive:true });
// on a touch screen the first tap after a fade on the sky only brings the interface back: it does not pick an object on the canvas,
// and its click does not reach a label (they stay on screen, part of the sky). A tap on a faded button works at once, and brings the rest back.
addEventListener('pointerdown', e => {
  if (IDLE.on && e.pointerType !== 'mouse' && (e.target === canvas || (e.target.closest && e.target.closest('#labels, #shipMark')))){ wakeTapAt = performance.now(); IDLE.eatClick = performance.now(); }
  wakeUI();
}, { capture:true, passive:true });
addEventListener('click', e => { if (IDLE.eatClick && performance.now() - IDLE.eatClick < 900){ IDLE.eatClick = 0; e.stopPropagation(); e.preventDefault(); } }, { capture:true });
for (const ev of ['wheel', 'keydown']) addEventListener(ev, () => wakeUI(), { capture:true, passive:true });
document.addEventListener('mouseleave', () => { IDLE.hover = false; });
function updateIdle(){
  const now = performance.now();
  // a new object gets time to be read before its facts fade (when the facts are showing)
  if (IDLE.obj !== infoObj){ IDLE.obj = infoObj; const o = OBJ[infoObj]; IDLE.readUntil = infoState() === 'full' ? now + 1500 + ((o.fact || '').length + 40)*28 : 0; }
  if (IDLE.on){ if (idleBlocked()) wakeUI(); return; }
  if (!idleBlocked() && now - IDLE.at > idleAfter() && now > IDLE.readUntil){ IDLE.on = true; bodyCL.add('ui-idle'); }
}
// phones: while idle, what stays of the card (the stop, the name, the angle line) slides down to sit at the bottom of the screen, where the
// faded dock was (owner, 2026-11-11: left where the card stood, it hung in the sky "randomly floating"). How far is measured four times a
// second, from the last line still shown (a long name wraps, the angle line comes and goes) to the screen's bottom less a margin; the
// lines shown and their transitions are CSS (00-head.html, phone block)
// Woken by a tap, the card stays down until the finger is off and 0.4 s more: sliding back under the finger, the tap's click went to nothing,
// and a faded button must work on the first tap (09-render.js's goNext)
const SLIDE = { y:0, at:0, off:0, down:false };
addEventListener('pointerdown', () => { SLIDE.down = true; }, { capture:true, passive:true });
for (const ev of ['pointerup', 'pointercancel']) addEventListener(ev, () => { SLIDE.down = false; SLIDE.off = performance.now() + 400; }, { capture:true, passive:true });
function idleSlide(now){
  if (!(IDLE.on && isCompact() && !bodyCL.contains('info-hidden'))){
    if (SLIDE.y && !SLIDE.down && now >= SLIDE.off){ SLIDE.y = 0; bodyCL.remove('slid'); infoEl.style.removeProperty('--idle-y'); }
    return;
  }
  if (now - SLIDE.at < 250) return;
  SLIDE.at = now;
  const ty = new DOMMatrixReadOnly(getComputedStyle(infoEl).transform).m42 || 0;
  let bot = -1;
  for (const e of infoEl.querySelectorAll('.stop, .htline, .title, .progress')){
    if (!e.offsetHeight || e.hidden || e.matches('.progress.hintish, .progress.tip')) continue;
    bot = Math.max(bot, e.getBoundingClientRect().bottom - ty);
  }
  if (bot < 0) return;
  const safe = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--safe-b')) || 0;
  const y = Math.max(0, Math.round(innerHeight - safe - 14 - bot));
  if (Math.abs(y - SLIDE.y) > 1){ SLIDE.y = y; infoEl.style.setProperty('--idle-y', y + 'px'); }
  bodyCL.toggle('slid', y > 0);
}

// ---------------------------------------------------------------- phones: frame the object in the space the interface leaves free, not behind the card or an open panel
let shiftT0 = 0, shiftTx = 0, shiftTy = 0;
function shiftTarget(){
  // the leash: the object slid by two fingers stays within 35% of the free space from its middle (the whole screen on a desk)
  leash.bx = 0.35*viewWcss; leash.by = 0.35*viewHcss; leash.avoid = null;
  if (!isCompact() || SKYV.on){ shiftTx = shiftTy = 0; return; }
  const W = innerWidth, H = innerHeight, top = 44;
  if (PORTRAIT_MQ.matches){
    // upright: everything sits at the bottom; centre the object between the top bar and the highest thing at the bottom
    let bottom = controlsEl.getBoundingClientRect().top;
    const els = [];
    if (!atlasEl.hidden) els.push(atlasEl);
    for (const id of ['#tours', '#timem', '#settings', '#story']) if (!$(id).hidden) els.push($(id));
    if (!els.length) els.push(infoState() === 'hidden' ? infoPillEl : infoEl);
    for (const el of els){ const r = el.getBoundingClientRect(); if (r.height > 0) bottom = Math.min(bottom, r.top); }
    const s = Math.max(0, (H - bottom - top)/2);
    shiftTx = 0; shiftTy = Math.atan(2*s/Math.max(viewHcss, 1)*tanY0);   // (for the view without a lens: setBasis scales it by LENS.k)
    leash.by = 0.35*Math.max(bottom - top, 0.2*viewHcss);   // (so it stays clear of the card and the dock)
  } else {
    // on its side: panels open on the right, the card sits on the left; move the object into the free middle
    let left = 0, right = W, bottom = controlsEl.getBoundingClientRect().top;
    const card = infoState() === 'hidden' ? null : infoEl.getBoundingClientRect();
    if (card && card.width && infoState() === 'full') left = card.right;
    const els = [atlasEl, $('#tours'), $('#timem'), $('#settings'), $('#story')].filter(el => !el.hidden);
    for (const el of els){ const r = el.getBoundingClientRect(); if (r.width) right = Math.min(right, r.left); }
    // a compact card that fills most of the free width pushes the object up instead
    if (card && card.width && infoState() !== 'full' && card.right - left > 0.5*(right - left)) bottom = Math.min(bottom, card.top);
    const sx = (left + right)/2 - W/2, sy = (H - bottom - top)/2;
    shiftTx = Math.atan(2*sx/Math.max(viewWcss, 1)*tanX0);
    shiftTy = Math.atan(2*Math.max(0, sy)/Math.max(viewHcss, 1)*tanY0);
    leash.bx = 0.35*Math.max(right - left, 0.2*viewWcss); leash.by = 0.35*Math.max(bottom - top, 0.2*viewHcss);
    if (card && card.width) leash.avoid = { left:card.left, top:card.top, right:card.right, bottom:card.bottom };   // (the card sits beside the free middle: never slide the object under it)
  }
}
// a pinch that starts on the card must not zoom the whole page (the CSS says so too; Safari also needs its gesture events stopped),
// while one finger still scrolls the card
for (const ev of ['gesturestart', 'gesturechange']) document.addEventListener(ev, e => e.preventDefault(), { passive:false });
infoEl.addEventListener('touchmove', e => { if (e.touches.length > 1 && e.cancelable) e.preventDefault(); }, { passive:false });
function updateShift(dt){
  shiftT0 -= dt; if (shiftT0 <= 0){ shiftT0 = 0.2; shiftTarget(); }
  const k = Math.min(1, dt*3.5);
  viewShift.x += (shiftTx - viewShift.x)*k; viewShift.y += (shiftTy - viewShift.y)*k;
  if (Math.abs(viewShift.x) < 1e-5 && !shiftTx) viewShift.x = 0;
  if (Math.abs(viewShift.y) < 1e-5 && !shiftTy) viewShift.y = 0;
}

{ const prev = updateHUD; updateHUD = function(dt){
  prev(dt);
  updateIdle(); idleSlide(performance.now()); updateLadChip(); updateShift(dt);
  const n = OBJ[infoObj].name; if (pillName.textContent !== n) pillName.textContent = n;
}; }
applyInfoState();


// ================================================================ engagement: screensaver, today's discovery, the collection log, photo mode
// Everything here is kept on the visitor's own device (localStorage). Nothing is sent anywhere.
const store = {
  get(k, d){ try { const v = localStorage.getItem('gcdatlas.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v){ try { localStorage.setItem('gcdatlas.' + k, JSON.stringify(v)); } catch (e) {} },
};
const dayKey = (d = new Date()) => d.toISOString().slice(0, 10);   // UTC, so everyone shares the same day
const fnv = s => { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; };

// ---------------------------------------------------------------- the collection log: objects you have seen, and badges
const BADGES = [
  { id:'planets', name:'planet hopper', keys:['mercury', 'venus', 'earth', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune'] },
  { id:'bh', name:'black hole hunter', test:o => o.prog === P.blackhole || o.isBH },
  { id:'nebulae', name:'nebula chaser', test:o => o.group === 'nebulae' },
  { id:'galaxies', name:'galaxy collector', test:o => o.group === 'galaxies' && !(o.prog === P.blackhole || o.isBH), need:12 },
  { id:'grand', name:'grand tourist', grand:true },
  { id:'edge', name:'edge of everything', keys:['universe'] },
  { id:'halo', name:'ship spotter', keys:['halo'] },
  { id:'half', name:'halfway there', frac:0.5 },
  { id:'all', name:'completionist', frac:1 },
];
const GRAND_KEYS = TOURS.find(t => t.id === 'grand').stops.map(([k]) => k).filter(k => BYKEY[k]);
const ATLAS_KEYS = atlasRows.map(r => r.o.key);
function badgeProgress(b){
  let pool;
  if (b.keys) pool = b.keys.filter(k => BYKEY[k]);
  else if (b.grand) pool = GRAND_KEYS;
  else if (b.test) pool = ATLAS_KEYS.filter(k => b.test(BYKEY[k]));
  else pool = ATLAS_KEYS;
  const have = pool.filter(k => SEEN.has(k)).length, need = b.frac ? Math.ceil(pool.length*b.frac) : Math.min(b.need || pool.length, pool.length);
  return { have:Math.min(have, need), need, done:need > 0 && have >= need };
}
const badgeEls = BADGES.map(b => { const e = document.createElement('span'); e.className = 'badge'; e.textContent = b.name; $('#badges').appendChild(e); return e; });
let earned = new Set(store.get('badges', []));
function syncCollection(){
  const n = ATLAS_KEYS.filter(k => SEEN.has(k)).length;
  $('#seenCount').textContent = `${n} of ${ATLAS_KEYS.length}`;
  BADGES.forEach((b, i) => { const p = badgeProgress(b); badgeEls[i].classList.toggle('got', p.done); badgeEls[i].title = p.done ? 'earned' : `${p.have} of ${p.need}`; });
}
function markSeen(o){
  if (!o || SEEN.has(o.key) || o.marker) return;
  SEEN.add(o.key); store.set('seen', [...SEEN]);
  const row = atlasRows.find(r => r.o === o); if (row) row.b.classList.add('seen');
  for (const b of BADGES){ if (earned.has(b.id)) continue; if (badgeProgress(b).done){ earned.add(b.id); store.set('badges', [...earned]); toast('badge earned · ' + b.name); } }
  syncCollection();
}
let seenClock = 0, seenIdx = -1;
function updateSeen(dt){
  const i = tour.on ? tour.obj : orbit.lock;
  if (i < 0 || flight){ seenClock = 0; return; }
  if (i !== seenIdx){ seenIdx = i; seenClock = 0; }
  seenClock += dt; if (seenClock > 3) markSeen(OBJ[i]);
}
// the atlas filter gets a "not seen yet" chip
{ const b = document.createElement('button'); b.className = 'chip'; b.dataset.cat = 'unseen'; b.textContent = 'not seen yet'; b.title = 'Objects you have not visited yet';
  b.addEventListener('click', () => { ATL.cat = 'unseen'; saveAtl(); renderAtlas(); }); $('#atlasCats').appendChild(b); catBtns.push(b); }
syncCollection(); renderAtlas();

// ---------------------------------------------------------------- today's discovery: one object a day, the same for everyone
const DAILY = (() => {
  const key = dayKey(), pool = atlasRows.map(r => r.o).filter(o => o.fact && o.group !== 'travel' && o.key !== 'earth');
  return { key, o:pool[fnv('gcdatlas:' + key) % pool.length] };
})();
function dailyStreak(){
  const log = new Set(store.get('dailyLog', [])); let n = 0; const d = new Date();
  for (;;){ if (!log.has(dayKey(d))) break; n++; d.setUTCDate(d.getUTCDate() - 1); }
  return n;
}
function showDaily(){
  const o = DAILY.o; $('#dailyName').textContent = o.name; $('#dailyType').textContent = o.type;
  const n = dailyStreak(); $('#dailyStreak').textContent = n > 1 ? `${n}-day streak` : '';
  $('#daily').hidden = false;
}
$('#dailyGo').addEventListener('click', () => {
  const log = store.get('dailyLog', []); if (!log.includes(DAILY.key)){ log.push(DAILY.key); store.set('dailyLog', log.slice(-400)); }
  store.set('dailySeen', DAILY.key); $('#daily').hidden = true; hideHint();
  goTo(DAILY.o.index); const n = dailyStreak(); toast(n > 1 ? `today's discovery · ${n} days in a row` : "today's discovery · come back tomorrow for another");
});
$('#dailyShare').addEventListener('click', () => {
  const url = location.origin + location.pathname + '#o=' + DAILY.o.key;
  (navigator.clipboard ? navigator.clipboard.writeText(`Today's discovery on gcdatlas: ${DAILY.o.name} ${url}`) : Promise.reject()).then(() => toast('link copied'), () => toast(url));
});
$('#dailyClose').addEventListener('click', () => { store.set('dailySeen', DAILY.key); $('#daily').hidden = true; });
// shown a few seconds in, once a day, unless someone arrived on a shared link
if (store.get('dailySeen', '') !== DAILY.key && !location.hash) setTimeout(() => { if (!SAVER.on && !document.body.classList.contains('photo')) showDaily(); }, 9000);

// ---------------------------------------------------------------- screensaver: full screen, the interface fades, an endless shuffled tour plays
const SAVER = { on:false, prevTravel:null, lastInput:performance.now(), startAt:0, x:0, y:0 };
TOURS.push({ id:'saver', name:'screensaver', blurb:'everything, shuffled', stops:[] });
function saverStops(){
  const keys = atlasRows.map(r => r.o).filter(o => o.views && o.views.length && o.group !== 'travel').map(o => o.key);
  for (let i = keys.length - 1; i > 0; i--){ const j = Math.floor(Math.random()*(i + 1)); [keys[i], keys[j]] = [keys[j], keys[i]]; }
  return keys.map(k => [k, '']);
}
function startSaver(){
  if (SAVER.on) return;
  SAVER.on = true; SAVER.startAt = performance.now();
  togglePanel(null, false); toggleAtlas(false); if (cmp) endCompare(false); $('#daily').hidden = true; if (!$('#help').hidden) toggleHelp(false);
  document.body.classList.add('saver'); $('#saverHud').hidden = false;
  try { if (document.fullscreenEnabled && !document.fullscreenElement) document.documentElement.requestFullscreen().catch(() => {}); } catch (e) {}
  SAVER.prevTravel = SET.travel; if (SET.travel === 'warp') SET.travel = 'quick';
  TOURS.find(t => t.id === 'saver').stops = saverStops();
  useTour('saver'); tween = null; flyMove = null; if (flight) finishFlightHere();
  tour.on = true; tourGo(TOUR[0]); updateModeUI();
  music.gesture();
}
function stopSaver(){
  if (!SAVER.on) return;
  SAVER.on = false; document.body.classList.remove('saver'); $('#saverHud').hidden = true;
  if (SAVER.prevTravel) SET.travel = SAVER.prevTravel;
  try { if (document.fullscreenElement) document.exitFullscreen().catch(() => {}); } catch (e) {}
  const here = tour.obj; stopTour(false); useTour('grand'); tour.last = TOUR.includes(here) ? here : null;
  $('#stopCount').textContent = String(TOUR.length).padStart(2, '0'); updateModeUI();
  toast('welcome back');
}
function saverInput(e){
  SAVER.lastInput = performance.now();
  if (!SAVER.on || performance.now() - SAVER.startAt < 1200) return;
  if (e.type === 'pointermove'){ if (Math.hypot(e.clientX - SAVER.x, e.clientY - SAVER.y) < 40){ return; } }
  if (e.type === 'keydown' && e.key !== 'Escape' && e.key.toLowerCase() !== 'z'){ e.stopImmediatePropagation(); e.preventDefault(); }
  stopSaver();
}
addEventListener('pointermove', e => { if (!SAVER.on){ SAVER.x = e.clientX; SAVER.y = e.clientY; } saverInput(e); }, { passive:true });
for (const ev of ['pointerdown', 'wheel', 'touchstart']) addEventListener(ev, saverInput, { capture:true, passive:true });
addEventListener('keydown', e => {
  if (SAVER.on){ saverInput(e); return; }
  SAVER.lastInput = performance.now();
  if (e.target.closest && e.target.closest('input')) return;
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const k = e.key.toLowerCase();
  if (k === 'z'){ e.preventDefault(); startSaver(); }
  else if (k === 'p'){ e.preventDefault(); document.body.classList.contains('photo') ? stopPhoto() : startPhoto(); }
}, { capture:true });
document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement && SAVER.on && performance.now() - SAVER.startAt > 1500) stopSaver(); });
$('#btnSaver').addEventListener('click', startSaver);
let saverT = 0;
function updateSaver(dt){
  saverT -= dt; if (saverT > 0) return; saverT = 0.5;
  const idleMin = +SET.saverIdle || 0;
  if (!SAVER.on && idleMin > 0 && performance.now() - SAVER.lastInput > idleMin*60000 && document.visibilityState === 'visible' && !document.body.classList.contains('photo')) startSaver();
  if (!SAVER.on) return;
  const d = new Date(); $('#svTime').textContent = d.toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' });
  const o = OBJ[tour.obj]; if ($('#svObj').textContent !== o.name){ $('#svObj').textContent = o.name; $('#svFact').textContent = o.fact || o.type; }
  const tr = music.track; $('#svNp').textContent = SET.sound && tr ? '♪ ' + tr.name : '';
}

// ---------------------------------------------------------------- photo mode: frame a shot, save it as a picture or copy the characters
let photoFrozen = false, photoPrevTime = 1;
function startPhoto(){
  if (SAVER.on) stopSaver();
  togglePanel(null, false); toggleAtlas(false); $('#daily').hidden = true;
  document.body.classList.add('photo'); $('#photoBar').hidden = false; hideHint();
  if (tour.on) stopTour(false);
}
function stopPhoto(){
  document.body.classList.remove('photo', 'photo-labels'); $('#photoBar').hidden = true;
  if (photoFrozen){ photoFrozen = false; timeScale = photoPrevTime; $('#phFreeze').setAttribute('aria-pressed', 'false'); }
}
function flash(){ const f = document.createElement('div'); f.className = 'photo-flash'; document.body.appendChild(f); requestAnimationFrame(() => { f.style.opacity = '0.35'; setTimeout(() => { f.style.opacity = '0'; setTimeout(() => f.remove(), 400); }, 90); }); }
function download(blob, name){ const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500); }
const shotName = ext => `gcdatlas-${OBJ[infoObj].key}-${dayKey()}.${ext}`;
$('#phSave').addEventListener('click', () => {
  afterFrame = () => {
    // the frame is still in the drawing buffer right after it is drawn: copy it, then add a small caption
    const c = document.createElement('canvas'); c.width = canvas.width; c.height = canvas.height;
    const x = c.getContext('2d'); x.drawImage(canvas, 0, 0);
    const s = Math.max(1, canvas.width/1400), pad = 18*s;
    x.font = `500 ${Math.round(15*s)}px "IBM Plex Mono", monospace`; x.fillStyle = 'rgba(226,232,245,0.85)'; x.textBaseline = 'bottom';
    x.fillText(OBJ[infoObj].name, pad, c.height - pad - 16*s);
    x.font = `${Math.round(11*s)}px "IBM Plex Mono", monospace`; x.fillStyle = 'rgba(255,179,92,0.8)';
    x.fillText('gcdatlas.vercel.app', pad, c.height - pad);
    c.toBlob(b => { if (b){ download(b, shotName('png')); toast('picture saved'); } else toast('could not save the picture'); }, 'image/png');
  };
  flash();
});
$('#phText').addEventListener('click', () => {
  afterFrame = () => {
    const buf = new Uint8Array(cols*rows*4);
    gl.bindFramebuffer(gl.FRAMEBUFFER, RT.cellFBO); gl.readPixels(0, 0, cols, rows, gl.RGBA, gl.UNSIGNED_BYTE, buf); gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    const lines = [];
    for (let y = rows - 1; y >= 0; y--){ let l = ''; for (let x = 0; x < cols; x++){ const gi = buf[(y*cols + x)*4 + 3]; l += gi === 255 ? ' ' : (atlas.chars[gi] || ' '); } lines.push(l.replace(/\s+$/, '')); }
    const txt = lines.join('\n').replace(/^\n+|\n+$/g, '') + `\n\n${OBJ[infoObj].name} · gcdatlas.vercel.app\n`;
    const fallback = () => { download(new Blob([txt], { type:'text/plain' }), shotName('txt')); toast('saved as a text file'); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(() => toast(`copied ${cols} x ${rows} characters · paste into any monospaced text`), fallback);
    else fallback();
  };
  flash();
});
$('#phFreeze').addEventListener('click', () => {
  photoFrozen = !photoFrozen; $('#phFreeze').setAttribute('aria-pressed', String(photoFrozen));
  if (photoFrozen){ photoPrevTime = timeScale || 1; timeScale = 0; } else timeScale = photoPrevTime;
});
$('#phLabels').addEventListener('click', () => { const on = !document.body.classList.contains('photo-labels'); document.body.classList.toggle('photo-labels', on); $('#phLabels').setAttribute('aria-pressed', String(on)); });
$('#phClose').addEventListener('click', stopPhoto);
$('#btnPhoto').addEventListener('click', startPhoto);

// ---------------------------------------------------------------- hooks into the main loop
{ const prev = updateHUD; updateHUD = function(dt){ prev(dt); updateSeen(dt); updateSaver(dt); }; }
Object.assign(window.__cosmos, { startSaver, stopSaver, startPhoto, stopPhoto, markSeen, DAILY, SEEN });

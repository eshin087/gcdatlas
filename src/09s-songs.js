// ================================================================ the song review page (/songs, or ?songs): every candidate song of the radio, to
// play one by one and mark keep, drop or not sure. It is the same page and music engine as the site: the universe is frozen and hidden
// (window.__freeze, the canvas not shown), the radio is off, and a song plays live through music.audition (from any bar, the same notes
// as from the start). Picks stay in this browser (gcdatlas.songReview); 'Copy my picks' gives them as plain text to paste back.
// build.mjs writes it as dist/songs.html (window.__SONGS set before the page's script). Kept out of search.
const REVIEW = { on:!!window.__SONGS || new URLSearchParams(location.search).has('songs'), key:'gcdatlas.songReview', picks:{}, els:{}, playing:null, raf:0 };
if (REVIEW.on){
  window.__freeze = true;   // (the site's own frame loop stands aside: nothing is drawn)
  stopTour(false); pauseShow(); tween = null; flyMove = null; flight = null; hideHint(true);
  music.set(false);         // (the radio stays off; a song plays only from its button)
  document.body.classList.add('song-review'); document.title = 'gcdatlas songs';
  const PICKS = [['keep', 'Keep'], ['drop', 'Drop'], ['unsure', 'Not sure']];
  const WORDS = { keep:'keep', drop:'drop', unsure:'not sure' };
  const mmss = s => { s = Math.max(0, Math.round(s)); return Math.floor(s/60) + ':' + String(s % 60).padStart(2, '0'); };
  try { const v = JSON.parse(localStorage.getItem(REVIEW.key) || 'null'); if (v && v.picks) REVIEW.picks = v.picks; } catch (e) {}
  const save = () => { try { localStorage.setItem(REVIEW.key, JSON.stringify({ v:1, picks:REVIEW.picks, at:Date.now() })); } catch (e) {} };
  const css = `
body.song-review>*:not(.rv){display:none!important}
.rv{position:fixed;inset:0;overflow-y:auto;overflow-x:hidden;-webkit-overflow-scrolling:touch;overscroll-behavior:contain;touch-action:pan-y;background:var(--void);color:var(--ink);font:15px/1.5 var(--mono)}
.rv *{box-sizing:border-box}
.rv-in{max-width:760px;margin:0 auto;padding:calc(20px + env(safe-area-inset-top,0px)) 16px calc(40px + env(safe-area-inset-bottom,0px))}
.rv h1{font:600 22px/1.2 var(--mono);letter-spacing:.02em;margin:0 0 8px}
.rv h1 a{color:var(--dim);text-decoration:none;font-weight:400;font-size:14px;margin-left:10px}
.rv h1 a:hover{color:var(--ink)}
.rv-lead{margin:0 0 14px;color:var(--soft);max-width:62ch}
.rv-bar{position:sticky;top:0;z-index:2;display:flex;flex-wrap:wrap;gap:8px 12px;align-items:center;justify-content:space-between;margin:0 -16px 6px;padding:10px 16px;background:var(--void);border-bottom:1px solid var(--line)}
.rv-count{display:flex;flex-wrap:wrap;gap:4px 12px;color:var(--soft);font-size:14px}
.rv-count b{font-weight:600;color:var(--ink)}
.rv-count .k b{color:#9be7a6}.rv-count .d b{color:var(--mute)}.rv-count .u b{color:var(--flare)}
.rv-tools{display:flex;gap:10px;align-items:center;flex-wrap:wrap}
.rv-vol{display:flex;gap:8px;align-items:center;color:var(--dim);font-size:13px}
.rv-vol input{width:110px;accent-color:var(--ship)}
.rv button{font:inherit;color:inherit;cursor:pointer;-webkit-tap-highlight-color:transparent}
.rv-copy{min-height:44px;padding:8px 14px;border-radius:8px;border:1px solid var(--ship);background:rgba(143,230,255,.12);color:var(--ship);font-weight:500}
.rv-copy:hover{background:rgba(143,230,255,.22)}
.rv-out{margin:8px 0 4px}
.rv-out p{margin:0 0 6px;color:var(--soft);font-size:13px}
.rv-out textarea{width:100%;min-height:120px;resize:vertical;padding:10px;border-radius:8px;border:1px solid var(--line);background:#0a0d18;color:var(--ink);font:13px/1.45 var(--mono)}
.rv-h{display:flex;flex-wrap:wrap;align-items:baseline;gap:4px 12px;margin:26px 0 10px;padding-bottom:6px;border-bottom:1px solid var(--line)}
.rv-h h2{margin:0;font:600 17px/1.3 var(--mono);text-transform:capitalize}
.rv-h span{color:var(--dim);font-size:13px}
.rv-song{border:1px solid var(--line);border-radius:10px;padding:12px;margin:0 0 10px;background:rgba(12,16,30,.55)}
.rv-song.on{border-color:var(--ship);background:rgba(143,230,255,.07)}
.rv-top{display:grid;grid-template-columns:48px 1fr;gap:12px;align-items:center}
.rv-play{width:48px;height:48px;border-radius:50%;border:1px solid var(--ship);background:none;color:var(--ship);font-size:17px;line-height:1;display:grid;place-items:center}
.rv-play:hover{background:rgba(143,230,255,.14)}
.rv-song.on .rv-play{background:var(--ship);color:var(--void)}
.rv-name{min-width:0}
.rv-name b{display:block;font-weight:600;font-size:16px;overflow-wrap:anywhere}
.rv-meta{display:flex;flex-wrap:wrap;gap:2px 10px;color:var(--dim);font-size:13px}
.rv-tag{display:inline-block;padding:0 7px;border-radius:9px;font-size:12px;border:1px solid var(--line);color:var(--soft)}
.rv-tag.new{border-color:rgba(255,179,92,.55);color:var(--flare)}
.rv-prog{display:flex;align-items:center;gap:10px;margin:10px 0 2px}
.rv-track{position:relative;flex:1;height:32px;cursor:pointer}
.rv-track::before{content:'';position:absolute;left:0;right:0;top:14px;height:4px;border-radius:2px;background:rgba(140,160,210,.25)}
.rv-fill{position:absolute;left:0;top:14px;height:4px;border-radius:2px;background:var(--ship);width:0}
.rv-track:focus-visible{outline:1px solid var(--flare);outline-offset:2px;border-radius:4px}
.rv-time{flex:0 0 auto;min-width:88px;text-align:right;color:var(--dim);font-size:13px;font-variant-numeric:tabular-nums}
.rv-picks{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:8px}
.rv-picks button{min-height:44px;padding:6px 4px;border-radius:8px;border:1px solid var(--line);background:none;color:var(--soft)}
.rv-picks button:hover{border-color:var(--dim);color:var(--ink)}
.rv-picks button[aria-pressed=true][data-pick=keep]{background:#9be7a6;border-color:#9be7a6;color:var(--void);font-weight:600}
.rv-picks button[aria-pressed=true][data-pick=drop]{background:var(--mute);border-color:var(--mute);color:var(--void);font-weight:600}
.rv-picks button[aria-pressed=true][data-pick=unsure]{background:var(--flare);border-color:var(--flare);color:var(--void);font-weight:600}
.rv button:focus-visible{outline:2px solid var(--flare);outline-offset:2px}
.rv-note{color:var(--dim);font-size:13px;margin:22px 0 0}
@media (max-width:480px){ .rv{font-size:14px} .rv h1{font-size:20px} .rv-time{min-width:78px} .rv-vol{display:none} .rv-bar{padding:8px 16px} }
`;
  const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
  const L = music.candidates(), styles = [...new Set(L.map(x => x.style))];
  const nNew = L.filter(x => !x.radio).length;
  const page = document.createElement('div'); page.className = 'rv';
  page.innerHTML = `<div class="rv-in">
    <h1>Song review<a href="./" title="back to the atlas">atlas ›</a></h1>
    <p class="rv-lead">${L.length} songs: the ${L.length - nNew} the radio plays now, with a softer bass, and ${nNew} new one${nNew === 1 ? '' : 's'}. Play a song, then keep it, drop it or mark it not sure. Your picks stay in this browser. When you are done, press Copy my picks and paste the text in the chat.</p>
    <div class="rv-bar"><div class="rv-count" aria-live="polite"></div>
      <div class="rv-tools"><label class="rv-vol">volume <input type="range" min="0" max="100" aria-label="volume"></label><button type="button" class="rv-copy">Copy my picks</button></div></div>
    <div class="rv-out" hidden><p></p><textarea readonly aria-label="your picks as text"></textarea></div>
    <div class="rv-list"></div>
    <p class="rv-note">Each song plays from the start, intro and all, as the radio plays it. Tap the bar under a song to jump. The id before each name (style and seed) tells us which song it is.</p>
  </div>`;
  document.body.appendChild(page);
  const $r = s => page.querySelector(s), list = $r('.rv-list');
  const noSound = !(window.AudioContext || window.webkitAudioContext);
  for (const sty of styles){
    const songs = L.filter(x => x.style === sty), moods = Object.keys(music.moods).filter(m => music.moods[m].includes(sty));
    const h = document.createElement('div'); h.className = 'rv-h';
    h.innerHTML = `<h2></h2><span></span>`;
    h.firstChild.textContent = songs[0].label; h.lastChild.textContent = `${songs.length} song${songs.length > 1 ? 's' : ''} · the radio plays it in ${moods.join(' and ')}`;
    list.appendChild(h);
    for (const x of songs){
      const el = document.createElement('article'); el.className = 'rv-song'; el.dataset.id = x.id;
      el.innerHTML = `<div class="rv-top"><button type="button" class="rv-play"></button><div class="rv-name"><b></b><div class="rv-meta"><span class="rv-info"></span><span class="rv-tag"></span></div></div></div>
        <div class="rv-prog"><div class="rv-track" role="slider" tabindex="0" aria-valuemin="0"><div class="rv-fill"></div></div><span class="rv-time"></span></div>
        <div class="rv-picks" role="group">${PICKS.map(([k, w]) => `<button type="button" data-pick="${k}" aria-pressed="false">${w}</button>`).join('')}</div>`;
      el.querySelector('b').textContent = x.title;
      el.querySelector('.rv-info').textContent = [x.id, mmss(x.sec), x.bpm + ' bpm', x.key].join(' · ');
      const tag = el.querySelector('.rv-tag'); tag.textContent = x.radio ? 'in the radio now' : 'new'; if (!x.radio) tag.classList.add('new');
      el.querySelector('.rv-picks').setAttribute('aria-label', 'your pick for ' + x.title);
      const tr = el.querySelector('.rv-track'); tr.setAttribute('aria-label', 'position in ' + x.title); tr.setAttribute('aria-valuemax', String(Math.round(x.sec)));
      REVIEW.els[x.id] = { el, x, play:el.querySelector('.rv-play'), fill:el.querySelector('.rv-fill'), time:el.querySelector('.rv-time'), track:tr };
      list.appendChild(el);
    }
  }
  // ---------------------------------------------------------------- playing
  function playAt(id, at){
    if (noSound) return;
    const ok = music.audition(id, at); if (!ok) return;
    REVIEW.playing = id; paint(); tickUI();
  }
  function stopPlay(){ music.stopSong(); REVIEW.playing = null; paint(); }
  // the play buttons, the highlighted card, the bars and times
  function paint(){
    const s = music.songState;
    for (const id in REVIEW.els){
      const E = REVIEW.els[id], on = REVIEW.playing === id && !(s && s.ended && s.id === id);
      E.el.classList.toggle('on', on);
      E.play.textContent = on ? '■' : '▶';
      E.play.setAttribute('aria-label', (on ? 'Stop ' : 'Play ') + E.x.title);
      const t = s && s.id === id ? s.t : 0, len = s && s.id === id ? s.len : E.x.sec;
      E.fill.style.width = (100*t/len).toFixed(2) + '%';
      E.time.textContent = mmss(t) + ' / ' + mmss(len);
      E.track.setAttribute('aria-valuenow', String(Math.round(t))); E.track.setAttribute('aria-valuetext', mmss(t) + ' of ' + mmss(len));
    }
  }
  function tickUI(){
    cancelAnimationFrame(REVIEW.raf);
    const s = music.songState;
    if (s && s.ended && REVIEW.playing === s.id) REVIEW.playing = null;
    paint();
    if (REVIEW.playing) REVIEW.raf = requestAnimationFrame(tickUI);
  }
  // ---------------------------------------------------------------- picks and the text to copy
  function counts(){
    const n = { keep:0, drop:0, unsure:0 }; for (const x of L){ const p = REVIEW.picks[x.id]; if (n[p] !== undefined) n[p]++; }
    const left = L.length - n.keep - n.drop - n.unsure;
    $r('.rv-count').innerHTML = `<span class="k"><b>${n.keep}</b> keep</span><span class="d"><b>${n.drop}</b> drop</span><span class="u"><b>${n.unsure}</b> not sure</span><span><b>${left}</b> to go</span>`;
    for (const id in REVIEW.els) for (const b of REVIEW.els[id].el.querySelectorAll('[data-pick]')) b.setAttribute('aria-pressed', String(REVIEW.picks[id] === b.dataset.pick));
  }
  function picksText(){
    const line = (w, xs) => `${w}: ${xs.length ? xs.map(x => x.id + ' ' + x.title).join(', ') : 'none'}`;
    const out = ['keep', 'drop', 'unsure'].map(k => line(WORDS[k], L.filter(x => REVIEW.picks[x.id] === k)));
    const rest = L.filter(x => !REVIEW.picks[x.id]); if (rest.length) out.push(line('not picked yet', rest));
    return out.join('\n');
  }
  async function copyPicks(){
    const txt = picksText(), box = $r('.rv-out'), ta = box.querySelector('textarea'), msg = box.querySelector('p');
    ta.value = txt; box.hidden = false;
    let ok = false;
    try { if (navigator.clipboard && window.isSecureContext){ await navigator.clipboard.writeText(txt); ok = true; } } catch (e) {}
    if (!ok){ try { ta.focus(); ta.select(); ok = document.execCommand('copy'); } catch (e) {} }
    msg.textContent = ok ? 'Copied. Paste it in the chat. The same text is here too:' : 'The browser did not let the page copy. Select the text below and copy it:';
    if (!ok){ ta.focus(); ta.select(); }
  }
  // ---------------------------------------------------------------- input
  page.addEventListener('click', e => {
    const card = e.target.closest('.rv-song'), id = card && card.dataset.id;
    if (e.target.closest('.rv-copy')) return copyPicks();
    if (!id) return;
    if (e.target.closest('.rv-play')){ if (REVIEW.playing === id) stopPlay(); else playAt(id, 0); return; }
    // a tap on the bar jumps there (and starts this song if another one was playing)
    const tr = e.target.closest('.rv-track');
    if (tr){ const r = tr.getBoundingClientRect(), f = Math.max(0, Math.min(1, (e.clientX - r.left)/r.width)), s = music.songState; playAt(id, f*(s && s.id === id ? s.len : REVIEW.els[id].x.sec)); return; }
    const pb = e.target.closest('[data-pick]');
    if (pb){ const k = pb.dataset.pick; if (REVIEW.picks[id] === k) delete REVIEW.picks[id]; else REVIEW.picks[id] = k; save(); counts(); if (!$r('.rv-out').hidden) $r('.rv-out textarea').value = picksText(); }
  });
  // arrows on a bar jump 10 s; the site's own keys stand aside (keys still type, tab and press buttons)
  addEventListener('keydown', e => { onKey(e); e.stopImmediatePropagation(); }, true);
  function onKey(e){
    const tr = e.target.closest && e.target.closest('.rv-track'); if (!tr) return;
    const id = tr.closest('.rv-song').dataset.id, s = music.songState, E = REVIEW.els[id], len = s && s.id === id ? s.len : E.x.sec, t = s && s.id === id ? s.t : 0;
    const to = e.key === 'ArrowRight' ? t + 10 : e.key === 'ArrowLeft' ? t - 10 : e.key === 'Home' ? 0 : e.key === 'End' ? len - 5 : null;
    if (to === null) return;
    e.preventDefault(); playAt(id, Math.max(0, Math.min(len - 1, to)));
  }
  const vol = $r('.rv-vol input'); vol.value = Math.round(SET.volume*100);
  vol.addEventListener('input', () => setOpt('volume', vol.value/100, true));
  if (noSound) $r('.rv-lead').textContent += ' This browser cannot play sound here.';
  counts(); paint();
}

// ================================================================ the Halo showcase (?showcase=halo): a scripted look at the ship, for reviewing its design.
// The camera circles the ship once (it holds still for that, which it never does on the site), then rides along while it roams: at Saturn a
// scan and a weapons test (the fold cannon), light speed to Jupiter (seen from the bridge), a skim and an outing by Pip, a fold to Sgr A* (the shield under the strongest pull) and
// Pip there, then a fold back to Saturn and round again. Its stays are shorter than on the site (STAY, against about two minutes).
// Buttons (keys 1 to 7) do any of it now, or as soon as the ship can (a queue of one: the last one pressed, lit while it waits): teleport,
// light speed, black hole, scan, Pip, weapons, skim (ship.demo in 07h-halo.js). A caption names each part. Taking the camera (a drag, the
// pause button, picking something) ends it and the site carries on as usual.
const SHOWCASE = { on:new URLSearchParams(location.search).get('showcase') === 'halo', t:0, turn:-1, fade:-1, fadeIn:false, visits:-1, wait:-1, loops:0, queue:null, bar:null };
if (SHOWCASE.on){
  const SC = SHOWCASE, D = Math.PI/180, TURN_T = 22, LIGHT = [-0.55, 0.35, 0.6], STAY = 75;   // (LIGHT: the light during the turn, in the ship's frame: above, ahead, starboard)
  // the round: after each stop, where next and how, and the jobs there (anywhere else a button took it, the site's own jobs, and back to Saturn)
  const ROUTE = { saturn:{ next:'jupiter', by:'light', jobs:['scan', 'weapons'] }, jupiter:{ next:'sgra', by:'fold', jobs:['skim', 'probe'] }, sgra:{ next:'saturn', by:'fold', jobs:['probe'] } };
  // (the weapons test says what each part of it is: the fold cannon forming, its three shots, breaking up; weapCap in 07k-cannon.js)
  const JOB = { scan:tg => 'hologram scan of ' + tg.name + ' · a ring sweeps it pole to pole; the numbers it finds are real',
    probe:() => "Pip, the ship's little drone, comes out to help round the ship",
    weapons:(tg, A) => 'weapons test (fictional), nothing is harmed · ' + (A && A.cap ? A.cap() : 'the fold cannon on ' + tg.name),
    skim:tg => 'skimming ' + tg.name + (tg === sun || tg.group === 'stars' ? "'s surface" : "'s cloud tops") + ' to refuel' };
  // the turn, in the ship's frame (ship radii): from straight above with the needle pointing right (like the concept art) down to the
  // starboard side, then once round (the front, the port side from below, the stern) and up into the chase camera's place.
  // On a tall, narrow screen it stands further back so the whole ship fits across.
  function turnPose(t){
    let phi = 90, el = 89.5, dist = 1.75, look = [0, 0, 0];
    if (t < 3.5) dist = 1.75 - 0.2*smooth(0, 3.5, t);
    else if (t < 7){ const u = smooth(3.5, 7, t); el = 89.5 - 74.5*u; dist = 1.55 + 0.1*u; }
    else if (t < 19){ phi = 90 + 270*smooth(7, 19, t);
      el = 15 + 5*smooth(90, 180, phi) - 48*smooth(180, 270, phi) + 53*smooth(270, 360, phi);
      dist = 1.65 + 0.35*smooth(90, 180, phi) - 0.25*smooth(180, 270, phi) + 0.2*smooth(270, 360, phi); }
    else { const u = smooth(19, TURN_T, t); phi = 360; el = 25 - 10*u; dist = 1.95 + 1.15*u; look = [-0.3*u, 1.5*u, 0]; }
    const fit = Math.max(1, 0.62/tanX), e = el*D, f = phi*D, dir = [-Math.sin(e), -Math.cos(e)*Math.cos(f), Math.cos(e)*Math.sin(f)];
    return { eye:V.mul(dir, dist*(t < 19 ? fit : 1 + (fit - 1)*(1 - smooth(19, TURN_T, t)))), look, up:V.norm(V.sub([-1, 0, 0], V.mul(dir, Math.sin(e)))) };
  }
  // (while the camera circles the ship the info panel steps back to its compact form, so it covers none of the ship; it comes back for the ride,
  // with its chase view / cockpit view button. Not saved: the visitor's own choice stays.)
  function startTurn(){ S_.hold = true; SC.turn = 0; SC.fadeIn = true; SC.fade = 0; shipCam.turn = turnPose(0); shipCam.mode = 'turn'; document.body.classList.add('info-compact'); syncLayout(); updateModeUI(); }
  function endTurn(){ S_.hold = false; SC.turn = -1; SC.fadeIn = false; SC.fade = 0; if (shipCam.mode === 'turn') shipCam.mode = 'chase'; applyInfoState(); updateModeUI(); }
  // a new stop: the round's jobs there and where next (a shorter stay than on the site)
  function onStay(){
    const r = ROUTE[S_.target.key], st = S_.stay; if (!st) return;
    st.dur = STAY;
    if (r){ st.jobs = r.jobs.slice(); st.jobAt = 1; S_.next = { tg:BYKEY[r.next], mode:r.by }; }
    else S_.next = { tg:BYKEY.saturn, mode:'fold' };
  }
  function begin(){
    document.body.classList.add('showcase'); hideHint(true);
    stopTour(false); pauseShow(); tween = null; flyMove = null; flight = null;
    foldVisit(BYKEY.saturn); onStay(); S_.t = 1; SC.visits = S_.visits;
    shipCam.on = true; shipCam.pending = false; shipCam.eye = null; shipCam.zoom = 1; motion.last = 'ship';
    startTurn(); SC.fade = -1; S_.light = LIGHT.slice();   // (the first time, the showcase light is on from the start)
    setInfo(ship.index); updateModeUI();
    makeBar();
  }
  function end(){
    SC.on = false; S_.hold = false; S_.light = null; SHOWCAP.txt = ''; SC.queue = null; document.body.classList.remove('showcase');
    if (SC.bar) SC.bar.hidden = true;
    // (the camera circling the ship is not left behind for when the visitor rides along again)
    if (shipCam.mode === 'turn') shipCam.mode = 'chase'; SC.turn = -1;
    updateModeUI(); applyInfoState();
    toast('showcase over · the camera is yours');
  }
  // ---------------------------------------------------------------- the buttons
  const BTN = [['fold', 'teleport'], ['light', 'light speed'], ['hole', 'black hole'], ['scan', 'scan'], ['probe', 'Pip'], ['weapons', 'weapons'], ['skim', 'skim']];
  const WORD = Object.assign(Object.fromEntries(BTN), { back:'a fold back to Saturn' });
  // (a teleport goes on round the showcase's stops when the next is a fold, otherwise somewhere far; light speed to the nearest stop in reach)
  const FAR = ['pillars', 'crab', 'andromeda', 'catseye', 'omegacen', 'etacar'];
  function foldTarget(){ const r = ROUTE[S_.target.key]; if (r && r.by === 'fold') return BYKEY[r.next]; const k = FAR.filter(k => BYKEY[k] && BYKEY[k] !== S_.target); return BYKEY[k[Math.floor(Math.random()*k.length)]]; }
  function lightTarget(){
    const A = S_.target, h = S_.h, r = ROUTE[A.key];
    if (r && r.by === 'light') return BYKEY[r.next];
    let best = null, bs = -9;
    for (const k of SHIP_TARGETS){ const B = BYKEY[k]; if (!B || B === A) continue; const d = V.sub(B.pos, A.pos), L = V.len(d); if (!(L > 0) || !(L < HALO.LS_NEAR)) continue; const s = V.dot(h, V.mul(d, 1/L)) - 0.3*Math.log10(Math.max(L/AU_LY, 1e-3)); if (s > bs){ bs = s; best = B; } }
    return best;
  }
  function tryAct(kind){
    const S = S_;
    if (S.hold || S.asm < FLK.A1 + 0.3 || (S.phase !== 'pass' && S.phase !== 'loop' && S.phase !== 'align')) return false;   // (on the move, or the hull still forming)
    if (kind === 'fold') return ship.demo.leaveNow(foldTarget(), 'fold');
    if (kind === 'back') return ship.demo.leaveNow(BYKEY.saturn, 'fold');
    if (kind === 'hole') return ship.demo.leaveNow(S.target === BYKEY.sgra ? BYKEY.m87bh : BYKEY.sgra, 'fold');
    if (kind === 'light'){ const B = lightTarget(); return B ? ship.demo.leaveNow(B, 'light') : ship.demo.leaveNow(BYKEY.saturn, 'fold'); }
    if (S.phase === 'align') return false;   // (a job waits for the next stop)
    return ship.demo.jobNow(kind);
  }
  function press(kind){
    if (!SC.on) return;
    if (kind === 'skim' && !SKIM.has(S_.target.key)){ toast('nothing to skim here · skims happen at Jupiter, the Sun and other stars'); return; }
    // (nothing the ship visits is within light speed's reach of some places, such as Sgr A*: it folds back to Saturn instead, and says so)
    if (kind === 'light' && !lightTarget()){ toast('no stop close enough for light speed here · a fold back to Saturn instead'); if (SC.turn >= 0) endTurn(); SC.queue = ship.demo.leaveNow(BYKEY.saturn, 'fold') ? null : { kind:'back', t:0 }; syncBar(); return; }
    if (SC.turn >= 0) endTurn();
    const done = tryAct(kind);
    SC.queue = done ? null : { kind, t:0 };
    toast(WORD[kind] + (done ? ' · now' : ' · as soon as the ship can'));
    syncBar();
  }
  function makeBar(){
    if (SC.bar){ SC.bar.hidden = false; return; }
    const bar = document.createElement('div'); bar.className = 'demo-bar'; bar.setAttribute('role', 'group'); bar.setAttribute('aria-label', 'Showcase: do it now');
    bar.innerHTML = '<b>now</b>' + BTN.map(([v, w], i) => `<button type="button" data-v="${v}"><span class="k">${i + 1}</span>${w}</button>`).join('');
    bar.addEventListener('click', e => { const b = e.target.closest('button'); if (b) press(b.dataset.v); });
    document.body.appendChild(bar); SC.bar = bar;
    addEventListener('keydown', e => { if (!SC.on || e.ctrlKey || e.metaKey || e.altKey || (e.target.closest && e.target.closest('input'))) return; const i = '1234567'.indexOf(e.key); if (i >= 0) press(BTN[i][0]); });
  }
  const syncBar = () => { if (!SC.bar) return; const q = SC.queue; for (const b of SC.bar.querySelectorAll('button')) b.classList.toggle('on', !!q && q.kind === b.dataset.v); };
  // ---------------------------------------------------------------- the caption
  function caption(){
    if (SC.turn >= 0) return SC.turn < 4 ? 'the Halo · seen from above, like the concept art' : 'the Halo · all angles (it holds still while the camera circles it; on the site it never stops)';
    const S = S_, tg = S.target, A = S.act, nx = S.next, bridge = shipCam.mode === 'cockpit' ? 'from the bridge · ' : '', fl = foldLine(), wait = SC.queue ? ' · ' + WORD[SC.queue.kind] + ' next' : '';
    if (fl) return fl + wait;
    if (S.phase === 'light') return bridge + 'light speed · to ' + S.leg.B.name + wait;
    if (S.phase === 'fold') return 'folding space · to ' + nx.tg.name;
    if (A && A.kind === 'probe' && A.tau > -0.8) return A.line() + wait;   // (Pip says what it is doing)
    if (A && A.tau > -0.8 && A.tau < ACTS[A.kind].T + (A.kind === 'weapons' ? 1.2 : 0.5)) return JOB[A.kind](tg, A) + wait;
    if (S.phase === 'align') return (nx.mode === 'fold' ? (S.spool > 0.05 ? 'the heart powers up for the fold · next stop: ' : 'setting course for ') + nx.tg.name : bridge + 'turning toward ' + nx.tg.name + ' · light speed next') + wait;
    return (bridge || 'riding along · ') + roamLine() + wait;
  }
  TICKS.push(dt => {
    if (!SC.on) return;
    if (!SC.started){ SC.started = true; begin(); }
    SC.t += dt;
    // taking the camera ends the showcase (switching to the chase view during the turn only ends the turn)
    if (!shipCam.on && !shipCam.pending){ end(); return; }
    if (SC.turn >= 0 && shipCam.mode !== 'turn') endTurn();
    if (SC.turn >= 0){ SC.turn += dt; shipCam.turn = turnPose(SC.turn); if (SC.turn >= TURN_T) endTurn(); }
    // the showcase light fades in for the turn and back to the Sun's after it
    if (SC.fade >= 0){
      SC.fade += dt; const k = smooth(0, SC.fadeIn ? 1 : 2, SC.fade), sunL = M3.applyT(ship.R0, V.norm(V.sub(sun.rel, ship.rel)));
      S_.light = SC.fadeIn ? V.lerp(sunL, LIGHT, k) : V.lerp(LIGHT, sunL, k);
      if (k >= 1){ if (!SC.fadeIn) S_.light = null; SC.fade = -1; }
    }
    // a new stop: its jobs and the next; back at Saturn by the round, circle the ship again (once the hull has formed)
    if (S_.visits !== SC.visits){
      SC.visits = S_.visits; onStay();
      if (S_.target === BYKEY.saturn && !SC.queue){ SC.loops++; SC.wait = FLK_END + 0.3; }
      if (shipCam.mode === 'cockpit'){ shipCam.mode = 'chase'; updateModeUI(); }
    }
    if (SC.wait >= 0 && (SC.wait -= dt) < 0){ SC.wait = -1; if (!SC.queue) startTurn(); }
    // a button waiting for the ship (given up after 30 s)
    if (SC.queue){ SC.queue.t += dt; if (tryAct(SC.queue.kind) || SC.queue.t > 30) SC.queue = null; }
    syncBar();
    // from the bridge for the light-speed jump from Saturn to Jupiter, until the ship drops out there
    if (SC.turn < 0 && S_.target === BYKEY.saturn && S_.phase === 'align' && S_.next.mode === 'light' && shipCam.mode === 'chase'){ shipCam.mode = 'cockpit'; updateModeUI(); }
    SHOWCAP.txt = caption();
  });
}

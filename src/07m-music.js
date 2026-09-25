
// ================================================================ soundtrack: gcd radio, a generative mix that never repeats
// Three styles take turns: lofi beats (dusty drums, Rhodes chords, vinyl crackle), chill house (soft four-on-the-floor,
// sidechained pads, plucked arpeggios) and ambient interludes (slow pads, drone, distant chimes). Every track gets its own
// key, tempo, chord progression, melody and arrangement (intro, verses, a breakdown, an outro), so nothing loops audibly.
// Everything is synthesised in the browser: no audio files. Browsers only allow sound after a click or key press.
const music = (() => {
  const AC = window.AudioContext || window.webkitAudioContext;
  let ctx = null, master = null, verbSend = null, drumBus = null, drumLP = null, musBus = null, duck = null, crackleG = null, droneG = null, wobble = null, noiseBuf = null;
  let wantOn = false, running = false, timer = 0;
  const hz = m => 440*Math.pow(2, (m - 69)/12);
  const R = Math.random, pick = a => a[Math.floor(R()*a.length)];
  // ---------------------------------------------------------------- harmony
  const TYPES = { maj9:[0, 4, 7, 11, 14], m9:[0, 3, 7, 10, 14], dom9:[0, 4, 10, 14, 21], m11:[0, 3, 10, 14, 17], sus:[0, 5, 7, 10, 14], maj7:[0, 4, 7, 11], m7:[0, 3, 7, 10] };
  const PROGS = {
    lofi:[[[2, 'm9'], [7, 'dom9'], [0, 'maj9'], [9, 'm9']], [[0, 'maj9'], [9, 'm9'], [5, 'maj9'], [7, 'dom9']], [[5, 'maj7'], [4, 'm7'], [2, 'm9'], [0, 'maj9']],
      [[9, 'm9'], [2, 'm11'], [7, 'dom9'], [0, 'maj9']], [[0, 'maj9'], [5, 'maj9']], [[4, 'm7'], [9, 'm9'], [2, 'm9'], [7, 'sus']]],
    house:[[[0, 'm9'], [8, 'maj9'], [3, 'maj9'], [10, 'dom9']], [[0, 'm9'], [5, 'm9']], [[0, 'm11'], [10, 'sus'], [8, 'maj9'], [7, 'm7']], [[9, 'm9'], [5, 'maj9'], [0, 'maj9'], [7, 'sus']]],
    ambient:[[[0, 'maj9'], [9, 'm9'], [5, 'maj9'], [2, 'm11']], [[0, 'sus'], [10, 'maj9'], [5, 'maj9']], [[2, 'm11'], [0, 'maj9'], [7, 'sus'], [9, 'm9']]],
  };
  const PENTA = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21];
  let lastVoicing = null;
  function voice(root, type, lo = 52, hi = 72){
    const v = TYPES[type].map(i => { let m = root + i; while (m < lo) m += 12; while (m > hi) m -= 12; return m; });
    return [...new Set(v)].sort((a, b) => a - b);
  }
  // ---------------------------------------------------------------- tracks
  const WORDS1 = ['Midnight', 'Slow', 'Blue', 'Quiet', 'Tidal', 'Amber', 'Lunar', 'Violet', 'Drifting', 'Distant', 'Soft', 'Golden', 'Faint', 'Warm', 'Silver', 'Late'];
  const WORDS2 = ['orbit', 'over Europa', 'shift', 'lock', 'nebula', 'transit', 'light-years', 'horizon', 'drift', 'aurora', 'redshift', 'perihelion', 'cassette', 'Lagrange point', 'dust lanes', 'eclipse', 'signal', 'parallax'];
  const MIX = ['lofi', 'house', 'lofi', 'ambient', 'house', 'lofi', 'house', 'ambient'];
  let mixIdx = Math.floor(R()*MIX.length), T = null, nextT = 0, step = 0;
  function newTrack(){
    const want = SET.musicStyle && SET.musicStyle !== 'mix' ? SET.musicStyle : MIX[mixIdx++ % MIX.length];
    const style = want;
    const key = 50 + Math.floor(R()*8);   // D3 .. A3
    const bpm = style === 'lofi' ? 70 + Math.floor(R()*16) : style === 'house' ? 110 + Math.floor(R()*9) : 60;
    const prog = pick(PROGS[style]).map(([deg, type]) => [key + deg, type]);
    const plan = style === 'lofi' ? [['intro', 4], ['A', 8], ['B', 8], ['break', 4], ['A', 8], ['B', 8], ['outro', 4]]
      : style === 'house' ? [['intro', 8], ['A', 16], ['B', 16], ['break', 8], ['drop', 16], ['outro', 8]]
      : [['A', 12 + 4*Math.floor(R()*3)]];
    const sections = []; plan.forEach(([n, b]) => { for (let i=0;i<b;i++) sections.push(n); });
    // a short motif from the pentatonic scale, reused and varied through the track
    const rhythm = pick([[0, 3, 6, 10], [2, 6, 8, 12, 14], [0, 4, 7, 10, 12], [0, 6, 8, 14], [3, 6, 10, 11, 14]]);
    const motif = rhythm.map(s => ({ s, n:key + 12 + pick(PENTA), d:pick([1, 2, 2, 3, 4]) }));
    const names = ['Rhodes', 'keys', 'pads'];
    T = { style, key, bpm, prog, sections, motif, swing:style === 'lofi' ? 0.14 + R()*0.08 : 0, barsPerChord:style === 'ambient' ? 4 : (prog.length <= 2 ? 2 : 1),
      kickPat:pick([[0, 7, 10], [0, 10], [0, 3, 10], [0, 8, 11]]), hatDensity:0.55 + R()*0.4, lead:R() < 0.8,
      title:pick(WORDS1) + ' ' + pick(WORDS2), label:(style === 'lofi' ? 'lofi' : style === 'house' ? 'chill house' : 'ambient') + ' · ' + bpm + ' bpm' };
    T.name = `${T.title} · ${T.label}`;
    step = 0;
    if (typeof onTrack === 'function') onTrack(T);
    // style-dependent textures
    const t = ctx.currentTime;
    crackleG.gain.setTargetAtTime(style === 'lofi' ? 0.022 : style === 'house' ? 0.005 : 0, t, 2);
    droneG.gain.setTargetAtTime(style === 'ambient' ? 0.05 : 0.012, t, 4);
  }
  let onTrack = null;
  // ---------------------------------------------------------------- synthesis
  function impulse(sec, decay){
    const n = Math.floor(ctx.sampleRate*sec), buf = ctx.createBuffer(2, n, ctx.sampleRate);
    for (let c=0;c<2;c++){ const d = buf.getChannelData(c); let lp = 0;
      for (let i=0;i<n;i++){ const t = i/ctx.sampleRate; lp += (R()*2 - 1 - lp)*(0.25 + 0.5*Math.exp(-t*1.5)); d[i] = lp*Math.exp(-t/decay); } }
    return buf;
  }
  function build(){
    ctx = new AC();
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 3.5; comp.attack.value = 0.01; comp.release.value = 0.4;
    const tone = ctx.createBiquadFilter(); tone.type = 'lowpass'; tone.frequency.value = 9000; tone.Q.value = 0.3;
    master = ctx.createGain(); master.gain.value = 0;
    master.connect(tone).connect(comp).connect(ctx.destination);
    const verb = ctx.createConvolver(); verb.buffer = impulse(4.5, 1.4);
    const verbOut = ctx.createGain(); verbOut.gain.value = 0.7; verb.connect(verbOut).connect(master);
    verbSend = ctx.createGain(); verbSend.connect(verb);
    drumLP = ctx.createBiquadFilter(); drumLP.type = 'lowpass'; drumLP.frequency.value = 12000; drumLP.Q.value = 0.5;
    drumBus = ctx.createGain(); drumBus.gain.value = 0.9; drumBus.connect(drumLP).connect(master);
    duck = ctx.createGain(); duck.gain.value = 1; duck.connect(master);
    musBus = ctx.createGain(); musBus.gain.value = 1; musBus.connect(duck);
    const mv = ctx.createGain(); mv.gain.value = 0.35; musBus.connect(mv).connect(verbSend);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate*2, ctx.sampleRate); const nd = noiseBuf.getChannelData(0); for (let i=0;i<nd.length;i++) nd[i] = R()*2 - 1;
    // vinyl crackle: sparse clicks over a whisper of hiss
    const cb = ctx.createBuffer(1, ctx.sampleRate*4, ctx.sampleRate), cd = cb.getChannelData(0);
    for (let i=0;i<cd.length;i++) cd[i] = (R()*2 - 1)*0.05 + (R() < 0.0009 ? (R()*2 - 1)*(0.4 + R()) : 0);
    const cs = ctx.createBufferSource(); cs.buffer = cb; cs.loop = true;
    const chp = ctx.createBiquadFilter(); chp.type = 'highpass'; chp.frequency.value = 900;
    crackleG = ctx.createGain(); crackleG.gain.value = 0; cs.connect(chp).connect(crackleG).connect(master); cs.start();
    // tape wobble shared by the keys
    wobble = ctx.createGain(); wobble.gain.value = 7; const wo = ctx.createOscillator(); wo.frequency.value = 0.35; wo.connect(wobble); wo.start();
    // a low drone that thickens in the ambient sections
    droneG = ctx.createGain(); droneG.gain.value = 0;
    const dl = ctx.createBiquadFilter(); dl.type = 'lowpass'; dl.frequency.value = 170; droneG.connect(dl).connect(master);
    for (const [m, g] of [[38, 0.6], [45, 0.35], [50, 0.18]]){ const o = ctx.createOscillator(); o.frequency.value = hz(m); const vg = ctx.createGain(); vg.gain.value = g; o.connect(vg).connect(droneG); o.start(); }
  }
  const tidy = (src, nodes) => { src.onended = () => { for (const n of nodes) try { n.disconnect(); } catch (e) {} }; };
  function noise(t, dur, v, type, f, q, out, send = 0){
    const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.playbackRate.value = 0.9 + R()*0.2;
    const fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q;
    const g = ctx.createGain(); g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(fl).connect(g).connect(out); if (send){ const sg = ctx.createGain(); sg.gain.value = send; g.connect(sg).connect(verbSend); }
    s.start(t, R()*1.5); s.stop(t + dur + 0.05); tidy(s, [s, fl, g]);
  }
  function kick(t, v){
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.setValueAtTime(115, t); o.frequency.exponentialRampToValueAtTime(44, t + 0.13);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.42);
    o.connect(g).connect(drumBus); o.start(t); o.stop(t + 0.45); tidy(o, [o, g]);
    noise(t, 0.012, v*0.25, 'highpass', 2500, 0.5, drumBus);
  }
  function snare(t, v, soft){
    noise(t, soft ? 0.16 : 0.2, v, 'bandpass', soft ? 1500 : 1900, 0.8, drumBus, 0.25);
    const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'triangle'; o.frequency.setValueAtTime(190, t); o.frequency.exponentialRampToValueAtTime(140, t + 0.08);
    g.gain.setValueAtTime(v*0.5, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.1); o.connect(g).connect(drumBus); o.start(t); o.stop(t + 0.12); tidy(o, [o, g]);
  }
  function clap(t, v){ for (let k=0;k<3;k++) noise(t + k*0.011, 0.07 + (k === 2 ? 0.12 : 0), v*(k === 2 ? 1 : 0.6), 'bandpass', 1300, 1.2, drumBus, 0.35); }
  function hat(t, v, open){ noise(t, open ? 0.28 : 0.045, v, 'highpass', open ? 6500 : 7800, 0.7, drumBus, open ? 0.15 : 0); }
  function rhodes(t, m, dur, v, pan = 0){
    const f = hz(m), car = ctx.createOscillator(), mod = ctx.createOscillator(), mg = ctx.createGain(), g = ctx.createGain(), p = ctx.createStereoPanner(), lp = ctx.createBiquadFilter();
    car.frequency.value = f; mod.frequency.value = f; mg.gain.setValueAtTime(f*1.6, t); mg.gain.exponentialRampToValueAtTime(f*0.12, t + 0.6);
    mod.connect(mg).connect(car.frequency); wobble.connect(car.detune);
    lp.type = 'lowpass'; lp.frequency.value = 2400;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + 0.006); g.gain.exponentialRampToValueAtTime(v*0.45, t + 0.5); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 1.1);
    p.pan.value = pan; car.connect(lp).connect(g).connect(p).connect(musBus);
    car.start(t); mod.start(t); car.stop(t + dur + 1.2); mod.stop(t + dur + 1.2);
    car.onended = () => { try { wobble.disconnect(car.detune); } catch (e) {} for (const n of [car, mod, mg, g, p, lp]) try { n.disconnect(); } catch (e) {} };
  }
  function bass(t, m, dur, v){
    const o = ctx.createOscillator(), o2 = ctx.createOscillator(), lp = ctx.createBiquadFilter(), g = ctx.createGain();
    o.type = 'sine'; o.frequency.value = hz(m); o2.type = 'triangle'; o2.frequency.value = hz(m); lp.type = 'lowpass'; lp.frequency.value = 420;
    const g2 = ctx.createGain(); g2.gain.value = 0.35; o2.connect(g2).connect(lp); o.connect(lp);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + 0.01); g.gain.setValueAtTime(v, t + Math.max(dur - 0.06, 0.02)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.08);
    lp.connect(g).connect(duck); o.start(t); o2.start(t); o.stop(t + dur + 0.1); o2.stop(t + dur + 0.1); tidy(o, [o, o2, g2, lp, g]);
  }
  function pad(t, notes, dur, v, cutoff = 900){
    notes.forEach((m, i) => {
      const f = hz(m), g = ctx.createGain(), flt = ctx.createBiquadFilter(), pan = ctx.createStereoPanner();
      flt.type = 'lowpass'; flt.frequency.value = cutoff*(0.8 + 0.4*R()); flt.Q.value = 0.5;
      pan.pan.value = (R()*2 - 1)*0.6;
      const oscs = [['sawtooth', -6 - R()*4], ['sawtooth', 6 + R()*4], ['sine', 0]].map(([type, det]) => { const o = ctx.createOscillator(); o.type = type; o.frequency.value = type === 'sine' ? f/2 : f; o.detune.value = det; o.connect(flt); return o; });
      flt.connect(g).connect(pan).connect(musBus);
      const att = Math.min(dur*0.3, 3 + R()*3), peak = v*(0.8 + 0.4*R());
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(peak, t + att); g.gain.setValueAtTime(peak, t + Math.max(dur - 1.5, att)); g.gain.linearRampToValueAtTime(0, t + dur + 1.5);
      for (const o of oscs){ o.start(t); o.stop(t + dur + 1.6); }
      tidy(oscs[0], [...oscs, flt, g, pan]);
    });
  }
  function pluck(t, m, v){
    const o = ctx.createOscillator(), lp = ctx.createBiquadFilter(), g = ctx.createGain(), p = ctx.createStereoPanner();
    o.type = 'sawtooth'; o.frequency.value = hz(m); lp.type = 'lowpass'; lp.Q.value = 4;
    lp.frequency.setValueAtTime(3200, t); lp.frequency.exponentialRampToValueAtTime(300, t + 0.22);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
    p.pan.value = (R()*2 - 1)*0.5; o.connect(lp).connect(g).connect(p).connect(musBus); const sg = ctx.createGain(); sg.gain.value = 0.5; p.connect(sg).connect(verbSend);
    o.start(t); o.stop(t + 0.4); tidy(o, [o, lp, g, p, sg]);
  }
  function lead(t, m, dur, v){
    const o = ctx.createOscillator(), o2 = ctx.createOscillator(), g = ctx.createGain(), vib = ctx.createOscillator(), vg = ctx.createGain(), p = ctx.createStereoPanner();
    o.type = 'triangle'; o2.type = 'sine'; o.frequency.value = hz(m); o2.frequency.value = hz(m + 12);
    vib.frequency.value = 5; vg.gain.value = 9; vib.connect(vg); vg.connect(o.detune); vg.connect(o2.detune);
    const g2 = ctx.createGain(); g2.gain.value = 0.25; o2.connect(g2).connect(g); o.connect(g);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + 0.04); g.gain.setValueAtTime(v, t + dur*0.7); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.3);
    p.pan.value = 0.25; g.connect(p).connect(musBus); const sg = ctx.createGain(); sg.gain.value = 0.7; p.connect(sg).connect(verbSend);
    for (const x of [o, o2, vib]){ x.start(t); x.stop(t + dur + 0.35); } tidy(o, [o, o2, vib, vg, g2, g, p, sg]);
  }
  function bell(t, m, amp){
    const f = hz(m), car = ctx.createOscillator(), mod = ctx.createOscillator(), mg = ctx.createGain(), g = ctx.createGain(), pan = ctx.createStereoPanner();
    car.frequency.value = f; mod.frequency.value = f*3.5; mg.gain.setValueAtTime(f*1.2, t); mg.gain.exponentialRampToValueAtTime(f*0.05, t + 2.5);
    mod.connect(mg).connect(car.frequency);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(amp, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + 5.5);
    pan.pan.value = (R()*2 - 1)*0.8; car.connect(g).connect(pan); pan.connect(verbSend);
    const dry = ctx.createGain(); dry.gain.value = 0.25; pan.connect(dry).connect(master);
    car.start(t); mod.start(t); car.stop(t + 6); mod.stop(t + 6); tidy(car, [car, mod, mg, g, pan, dry]);
  }
  // ---------------------------------------------------------------- the sequencer: sixteenth notes, scheduled a little ahead
  function play(t){
    if (!T || step >= T.sections.length*16){ newTrack(); }
    const sd = 60/T.bpm/4, s = step % 16, bar = Math.floor(step/16), sec = T.sections[bar], st = T.style;
    const swing = s % 2 ? sd*T.swing : 0, hum = () => (R() - 0.5)*0.008, tt = t + swing;
    const ci = Math.floor(bar/T.barsPerChord) % T.prog.length, [root, type] = T.prog[ci], chordStart = bar % T.barsPerChord === 0 && s === 0;
    const lastBar = bar === T.sections.length - 1;
    // the drum filter opens through the intro and closes for breakdowns and the outro
    if (s === 0){
      const target = sec === 'intro' ? 900 + 9000*Math.pow(bar/Math.max(T.sections.indexOf('A'), 1), 2) : sec === 'break' ? 700 : sec === 'outro' ? 1400 : 12000;
      drumLP.frequency.setTargetAtTime(Math.min(target, 12000), t, 0.6);
    }
    if (st === 'lofi'){
      if (chordStart){
        const v = voice(root, type, 52, 71), dur = sd*16*T.barsPerChord;
        v.forEach((m, i) => rhodes(t + i*0.012 + hum(), m, dur*0.9, 0.05 + 0.015*R(), (i/(v.length - 1) - 0.5)*0.5));
        if (sec !== 'intro') bass(t, root - 24 + (root - 24 < 33 ? 12 : 0), sd*6, 0.2);
      }
      if (s === 10 && sec !== 'break' && R() < 0.5){ voice(root, type, 55, 72).slice(1).forEach((m, i) => rhodes(tt + i*0.01, m, sd*5, 0.03, 0.2)); }
      if (s === 8 && sec !== 'intro' && sec !== 'break') bass(tt, root - 24 + (R() < 0.5 ? 7 : 12) + (root - 24 < 33 ? 12 : 0), sd*3, 0.14);
      if (sec !== 'break' && !(sec === 'outro' && bar > T.sections.length - 3)){
        if (T.kickPat.includes(s) || (s === 14 && R() < 0.15)) kick(t + hum(), s === 0 ? 0.75 : 0.55);
        if (s === 4 || s === 12) snare(tt + 0.01 + hum(), 0.32, true);
        if (s % 2 === 0 || R() < 0.25*T.hatDensity) hat(tt + hum(), (s % 4 === 2 ? 0.085 : 0.05)*(0.6 + 0.8*R()), false);
        if ((s === 7 || s === 15) && R() < 0.2) snare(tt, 0.07, true);   // ghost notes
      }
      if ((sec === 'B' || (sec === 'A' && bar % 8 >= 4 && T.lead)) && !lastBar){
        for (const n of T.motif) if (n.s === s && R() < 0.9){ const up = bar % 4 === 3 && R() < 0.4 ? 2 : 0; lead(tt + hum(), n.n + up, sd*n.d, 0.045); }
      }
    } else if (st === 'house'){
      if (chordStart){
        const v = voice(root, type, 55, 74), dur = sd*16*T.barsPerChord;
        pad(t, v, dur, sec === 'break' ? 0.035 : 0.022, sec === 'break' ? 1800 : 1100);
      }
      const drums = sec !== 'break' && !(sec === 'intro' && bar < 4);
      if (drums){
        if (s % 4 === 0){ kick(t, 0.8);
          // the sidechain pump: everything but the drums ducks on each kick
          duck.gain.cancelScheduledValues(t); duck.gain.setValueAtTime(0.3, t); duck.gain.linearRampToValueAtTime(1, t + sd*3.2); }
        if ((s === 4 || s === 12) && sec !== 'intro') clap(t + 0.004, 0.28);
        if (s % 4 === 2) hat(t, 0.09, true);
        else if (R() < 0.7) hat(t + hum(), 0.04*(0.5 + R()), false);
      }
      if (sec !== 'intro' && s % 4 === 2 && sec !== 'break') bass(t, root - 24 + (root - 24 < 33 ? 12 : 0) + (R() < 0.12 ? 12 : 0), sd*1.6, 0.22);
      if ((sec === 'B' || sec === 'drop') && (s % 2 === 0 || R() < 0.3)){
        const v = voice(root, type, 64, 88), idx = (Math.floor(step/2) + (sec === 'drop' ? bar : 0)) % v.length;
        pluck(t, v[s % 4 === 0 ? 0 : idx], 0.05*(s % 4 === 0 ? 1.2 : 0.8));
      }
      if (sec === 'break' && s % 8 === 0 && R() < 0.6) bell(t, voice(root, type, 72, 90)[Math.floor(R()*3)], 0.03);
    } else {
      if (bar % 4 === 0 && s === 0) pad(t, voice(root, type, 50, 74), sd*16*4 + 4, 0.04, 800);
      if (R() < 0.022) bell(t + R()*sd, voice(root, type, 74, 94)[Math.floor(R()*4)], 0.02 + R()*0.02);
    }
    step++;
    return sd;
  }
  function pump(){
    if (!ctx || !running) return;
    const ahead = document.hidden ? 1.6 : 0.25;
    while (nextT < ctx.currentTime + ahead) nextT += play(nextT);
  }
  function level(){ return 0.85*SET.volume; }
  function fadeTo(v, sec){ if (!master) return; const t = ctx.currentTime; master.gain.cancelScheduledValues(t); master.gain.setValueAtTime(master.gain.value, t); master.gain.linearRampToValueAtTime(v, t + sec); }
  function start(){
    if (!AC) return;
    if (!ctx){ try { build(); } catch (e) { console.warn('sound unavailable', e); return; } }
    running = true;
    if (ctx.state === 'suspended') ctx.resume();
    if (!T) newTrack();
    nextT = Math.max(nextT, ctx.currentTime + 0.1);
    clearInterval(timer); timer = setInterval(pump, 50); pump();
    fadeTo(level(), 3);
  }
  function stop(){
    running = false;
    if (!ctx) return;
    fadeTo(0, 1.2);
    setTimeout(() => { if (!running){ clearInterval(timer); if (ctx.state === 'running') ctx.suspend(); } }, 1400);
  }
  return {
    get on(){ return wantOn; },
    get track(){ return T; },
    get _dbg(){ return { ctx, master }; },   // for the level tests
    set onTrack(f){ onTrack = f; },
    gesture(){ if (wantOn && !running) start(); },
    set(on){ wantOn = on; if (on){ if (ctx || navigator.userActivation?.hasBeenActive) start(); } else stop(); },
    volume(){ if (running) fadeTo(level(), 0.3); },
    // move on to a new track now (the current one is cut at the next beat with a short fade)
    skip(){ if (!ctx || !running){ T = null; return; } const t = ctx.currentTime; musBus.gain.setValueAtTime(musBus.gain.value, t); musBus.gain.linearRampToValueAtTime(0, t + 0.4); musBus.gain.linearRampToValueAtTime(1, t + 1.2); T = null; newTrack(); },
    styleChanged(){ if (ctx && running) this.skip(); else T = null; },
    whoosh(dur){
      if (!running || !ctx) return;
      const t = ctx.currentTime, d = Math.max(dur, 0.8);
      const src = ctx.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 0.7;
      bp.frequency.setValueAtTime(180, t); bp.frequency.exponentialRampToValueAtTime(900, t + d*0.5); bp.frequency.exponentialRampToValueAtTime(220, t + d);
      const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.04, t + d*0.4); g.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.6);
      src.connect(bp).connect(g); g.connect(master); g.connect(verbSend);
      src.start(t); src.stop(t + d + 0.8); tidy(src, [src, bp, g]);
    },
  };
})();

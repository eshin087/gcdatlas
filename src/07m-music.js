
// ================================================================ soundtrack: "deep space drift", generated live so it never plays the same way twice
// Slow pad chords from a small modal palette drift from one to the next (a random walk, 20-40 s each, long crossfades)
// over a low drone, with rare distant chimes, a faint wash of space wind and a soft whoosh on flights.
// Browsers only allow sound after the first click or key press, so it starts then (if sound is on).
const music = (() => {
  const AC = window.AudioContext || window.webkitAudioContext;
  let ctx = null, master = null, tone = null, padBus = null, verbSend = null, shimmer = [], droneGain = null, wantOn = false, running = false;
  const hz = m => 440*Math.pow(2, (m - 69)/12);
  // voicings around D: D add9, B minor 9, G major 7, A add9 (with the bright G#), C major 7 (a gentle flat seven), E minor 11
  const CHORDS = [
    [38, 45, 52, 57, 61, 64], [35, 42, 50, 54, 57, 61], [31, 38, 47, 50, 54, 57],
    [33, 40, 47, 52, 56, 59], [36, 43, 50, 55, 59, 62], [40, 47, 54, 57, 62, 66],
  ];
  let chord = 0, chordTimer = 0, chimeTimer = 0;
  function impulse(sec, decay){
    const n = Math.floor(ctx.sampleRate*sec), buf = ctx.createBuffer(2, n, ctx.sampleRate);
    for (let c=0;c<2;c++){ const d = buf.getChannelData(c); let lp = 0;
      for (let i=0;i<n;i++){ const t = i/ctx.sampleRate; lp += (Math.random()*2 - 1 - lp)*(0.25 + 0.5*Math.exp(-t*1.5)); d[i] = lp*Math.exp(-t/decay); } }
    return buf;
  }
  function build(){
    ctx = new AC();
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -20; comp.ratio.value = 3; comp.attack.value = 0.05; comp.release.value = 0.8;
    tone = ctx.createBiquadFilter(); tone.type = 'lowpass'; tone.frequency.value = 7000; tone.Q.value = 0.2;
    master = ctx.createGain(); master.gain.value = 0;
    master.connect(tone).connect(comp).connect(ctx.destination);
    const verb = ctx.createConvolver(); verb.buffer = impulse(6.5, 1.9);
    const verbOut = ctx.createGain(); verbOut.gain.value = 0.9; verb.connect(verbOut).connect(master);
    verbSend = ctx.createGain(); verbSend.gain.value = 1; verbSend.connect(verb);
    padBus = ctx.createGain(); padBus.gain.value = 1;
    const padDry = ctx.createGain(); padDry.gain.value = 0.55; padBus.connect(padDry).connect(master);
    const padWet = ctx.createGain(); padWet.gain.value = 0.5; padBus.connect(padWet).connect(verbSend);
    // drone: a low D and its fifth, breathing very slowly
    droneGain = ctx.createGain(); droneGain.gain.value = 0.05;
    for (const [m, g] of [[26, 0.6], [33, 0.35], [38, 0.18]]){
      const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = hz(m);
      const vg = ctx.createGain(); vg.gain.value = g; o.connect(vg).connect(droneGain); o.start();
    }
    const breath = ctx.createOscillator(); breath.frequency.value = 0.013; const bg = ctx.createGain(); bg.gain.value = 0.025; breath.connect(bg).connect(droneGain.gain); breath.start();
    const droneLp = ctx.createBiquadFilter(); droneLp.type = 'lowpass'; droneLp.frequency.value = 160;
    droneGain.connect(droneLp).connect(master);
    // shimmer: two high partials of the current chord, almost inaudible, swelling in and out
    for (let k=0;k<2;k++){
      const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = hz(76 + k*7);
      const g = ctx.createGain(); g.gain.value = 0;
      const l = ctx.createOscillator(); l.frequency.value = 0.031 + k*0.017; const lg = ctx.createGain(); lg.gain.value = 0.0045;
      l.connect(lg).connect(g.gain); const off = ctx.createConstantSource ? ctx.createConstantSource() : null;
      if (off){ off.offset.value = 0.0045; off.connect(g.gain); off.start(); }
      const pan = ctx.createStereoPanner(); pan.pan.value = k ? 0.5 : -0.5;
      o.connect(g).connect(pan).connect(verbSend); o.start(); l.start(); shimmer.push(o);
    }
    // space wind: filtered noise sweeping slowly
    const nb = ctx.createBuffer(1, ctx.sampleRate*3, ctx.sampleRate), nd = nb.getChannelData(0);
    for (let i=0;i<nd.length;i++) nd[i] = Math.random()*2 - 1;
    const ns = ctx.createBufferSource(); ns.buffer = nb; ns.loop = true;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 500; bp.Q.value = 0.9;
    const sweep = ctx.createOscillator(); sweep.frequency.value = 0.021; const sg = ctx.createGain(); sg.gain.value = 260; sweep.connect(sg).connect(bp.frequency); sweep.start();
    const wg = ctx.createGain(); wg.gain.value = 0.014;
    ns.connect(bp).connect(wg); wg.connect(master); wg.connect(verbSend); ns.start();
  }
  function pad(t0, dur){
    const notes = CHORDS[chord].filter((_, i) => i < 2 || Math.random() < 0.8);
    notes.forEach((m, i) => {
      const f = hz(m), g = ctx.createGain(), flt = ctx.createBiquadFilter(), pan = ctx.createStereoPanner();
      flt.type = 'lowpass'; flt.frequency.value = 420 + Math.random()*380 + i*60; flt.Q.value = 0.4;
      const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 0.015 + Math.random()*0.04; lg.gain.value = 180 + Math.random()*180; lfo.connect(lg).connect(flt.frequency);
      pan.pan.value = (Math.random()*2 - 1)*0.65;
      const oscs = [['sawtooth', -5 - Math.random()*3], ['triangle', 4 + Math.random()*3], ['sine', 0]].map(([type, det]) => { const o = ctx.createOscillator(); o.type = type; o.frequency.value = type === 'sine' ? f/2 : f; o.detune.value = det; o.connect(flt); return o; });
      flt.connect(g).connect(pan).connect(padBus);
      const peak = (i < 2 ? 0.05 : 0.036)*(0.8 + 0.4*Math.random()), att = 7 + Math.random()*5, rel = 9 + Math.random()*4;
      g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(peak, t0 + att);
      g.gain.setValueAtTime(peak, t0 + Math.max(dur - rel, att)); g.gain.linearRampToValueAtTime(0, t0 + dur);
      const end = t0 + dur + 0.2;
      for (const o of [...oscs, lfo]){ o.start(t0); o.stop(end); }
      oscs[0].onended = () => { for (const n of [...oscs, lfo, lg, flt, g, pan]) try { n.disconnect(); } catch (e) {} };
    });
    shimmer.forEach((o, k) => o.frequency.setTargetAtTime(hz(CHORDS[chord][3 + k] + 24), t0, 6));
  }
  function nextChord(){
    if (!ctx) return;
    if (running){
      const opts = CHORDS.map((_, i) => i).filter(i => i !== chord);
      chord = opts[Math.floor(Math.random()*opts.length)];
      const dur = 26 + Math.random()*16;
      pad(ctx.currentTime + 0.1, dur + 10);
      chordTimer = setTimeout(nextChord, dur*1000);
    } else chordTimer = setTimeout(nextChord, 2000);
  }
  function bell(t, m, amp){
    const f = hz(m), car = ctx.createOscillator(), mod = ctx.createOscillator(), mg = ctx.createGain(), g = ctx.createGain(), pan = ctx.createStereoPanner();
    car.frequency.value = f; mod.frequency.value = f*3.5; mg.gain.setValueAtTime(f*1.2, t); mg.gain.exponentialRampToValueAtTime(f*0.05, t + 2.5);
    mod.connect(mg).connect(car.frequency);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(amp, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + 5.5);
    pan.pan.value = (Math.random()*2 - 1)*0.8;
    car.connect(g).connect(pan); pan.connect(verbSend);
    const dry = ctx.createGain(); dry.gain.value = 0.25; pan.connect(dry).connect(master);
    car.start(t); mod.start(t); car.stop(t + 6); mod.stop(t + 6);
    car.onended = () => { for (const n of [car, mod, mg, g, pan, dry]) try { n.disconnect(); } catch (e) {} };
  }
  function chime(){
    if (!ctx) return;
    if (running){
      const tones = CHORDS[chord].slice(2).map(m => m + 24), t = ctx.currentTime + 0.05;
      const n = Math.random() < 0.35 ? 2 + Math.floor(Math.random()*2) : 1;
      for (let i=0;i<n;i++) bell(t + i*(0.45 + Math.random()*0.6), tones[Math.floor(Math.random()*tones.length)], 0.028 + Math.random()*0.02);
    }
    chimeTimer = setTimeout(chime, (7 + Math.random()*16)*1000);
  }
  function level(){ return 0.9*SET.volume; }
  function fadeTo(v, sec){ if (!master) return; const t = ctx.currentTime; master.gain.cancelScheduledValues(t); master.gain.setValueAtTime(master.gain.value, t); master.gain.linearRampToValueAtTime(v, t + sec); }
  function start(){
    if (!AC) return;
    if (!ctx){ try { build(); } catch (e) { console.warn('sound unavailable', e); return; } chord = Math.floor(Math.random()*CHORDS.length); running = true; pad(ctx.currentTime + 0.1, 40); chordTimer = setTimeout(nextChord, 30000); chimeTimer = setTimeout(chime, 9000); }
    running = true;
    if (ctx.state === 'suspended') ctx.resume();
    fadeTo(level(), 5);
  }
  function stop(){
    running = false;
    if (!ctx) return;
    fadeTo(0, 1.2);
    setTimeout(() => { if (!running && ctx.state === 'running') ctx.suspend(); }, 1400);
  }
  return {
    get on(){ return wantOn; },
    // called on every user gesture: the first one is allowed to start audio
    gesture(){ if (wantOn && !running) start(); },
    set(on){ wantOn = on; if (on){ if (ctx || navigator.userActivation?.hasBeenActive) start(); } else stop(); },
    volume(){ if (running) fadeTo(level(), 0.3); },
    // a soft swell of air when the camera travels
    whoosh(dur){
      if (!running || !ctx) return;
      const t = ctx.currentTime, d = Math.max(dur, 0.8);
      const src = ctx.createBufferSource(), n = ctx.createBuffer(1, Math.ceil(ctx.sampleRate*(d + 1)), ctx.sampleRate), a = n.getChannelData(0);
      for (let i=0;i<a.length;i++) a[i] = Math.random()*2 - 1;
      src.buffer = n;
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 0.7;
      bp.frequency.setValueAtTime(180, t); bp.frequency.exponentialRampToValueAtTime(900, t + d*0.5); bp.frequency.exponentialRampToValueAtTime(220, t + d);
      const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.05, t + d*0.4); g.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.6);
      src.connect(bp).connect(g); g.connect(master); g.connect(verbSend);
      src.start(t); src.stop(t + d + 0.8);
      src.onended = () => { for (const x of [src, bp, g]) try { x.disconnect(); } catch (e) {} };
    },
  };
})();

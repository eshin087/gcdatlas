
// ================================================================ soundtrack: gcd radio, a catalogue of songs made live
// Six styles (STYLES): lofi beats, chill house, ambient, ambient piano, downtempo and soft synthwave. The radio plays a fixed
// list of songs (SONGS): each is a style and a seed, and a seed deals the same song every time (the owner picked them by ear
// from offline renders). A mood in the settings (MOODS) picks which styles play: the default mix plays all but chill house and
// synthwave, which play under 'groove'. The list is shuffled and every song of the mood plays once before any plays again;
// the settings list every song, and a picked song plays at once (the shuffle then carries on).
// A seed deals a song's palette within its style: key and mode, tempo, one or two chord progressions from a bank of a dozen
// or more, its instruments (keys, lead, bass, pad), drum kit and groove, its melodies, its arrangement, a quiet texture
// (vinyl, rain, wind or tape) and a name from a place in the atlas. The bass supports and never leads (0.9.4, owner: it was
// loud and unpleasant): each style sets its balance by part (mix), the calm styles have the lightest low end, and every
// style is about as loud as lofi on what a small speaker plays (above 200 Hz); tests/music.mjs checks the loudness and the
// bass balance of every song. Every instrument that can take another's place is about as loud as it.
// Everything is synthesised in the browser: no audio files. It tries to start on load; browsers that block that start it on the first
// click, tap or key press. The first track skips its intro so the groove is there at once. The review page (/songs) plays
// one candidate song at a time from any bar (audition).
const music = (() => {
  const AC = window.AudioContext || window.webkitAudioContext;
  let ctx = null, master = null, mixG = null, verbSend = null, drumBus = null, drumLP = null, musBus = null, musLP = null, duck = null, crackleG = null, rainG = null, windG = null;
  let droneG = null, drones = null, wobble = null, noiseBuf = null, WAVES = null, vibesBus = null, arpBus = null, echoIn = null, echoL = null, echoR = null;
  let wantOn = false, running = false, timer = 0, first = true, live = 0, offline = false, vel = 1;   // (vel: the track's level, applied as notes are made)
  const VMAX = 48;   // live notes; optional notes are skipped beyond this (phones)
  const busy = () => !offline && live > VMAX;
  const hz = m => 440*Math.pow(2, (m - 69)/12);
  let R = Math.random;   // (a song's seeded generator while it plays or renders; see gen)
  // a seeded generator (scrambled so nearby seeds give different songs)
  const gen = x => { let z = Math.imul(x ^ 0x9e3779b9, 2654435761) >>> 0; const f = () => { z = (z*1664525 + 1013904223) >>> 0; return z/4294967296; }; for (let i=0;i<4;i++) f(); return f; };
  const pick = a => a[Math.floor(R()*a.length)];
  // ---------------------------------------------------------------- harmony
  // (soft colours only: sevenths, ninths, sixths, elevenths, a lydian fourth and sus chords; no flat or sharp ninths)
  const TYPES = { maj9:[0, 4, 7, 11, 14], m9:[0, 3, 7, 10, 14], dom9:[0, 4, 10, 14, 21], m11:[0, 3, 10, 14, 17], sus:[0, 5, 7, 10, 14], maj7:[0, 4, 7, 11], m7:[0, 3, 7, 10],
    six9:[0, 4, 7, 9, 14], m6:[0, 3, 7, 9, 14], add9:[0, 4, 7, 14], madd9:[0, 3, 7, 14], lyd:[0, 4, 7, 11, 18], sus2:[0, 2, 7, 14] };
  function voice(root, type, lo = 52, hi = 72){
    const v = TYPES[type].map(i => { let m = root + i; while (m < lo) m += 12; while (m > hi) m -= 12; return m; });
    return [...new Set(v)].sort((a, b) => a - b);
  }
  // a voicing without the root (the bass plays it), as jazz players comp
  const voiceNR = (root, type, lo, hi) => voice(root, type, lo, hi).filter(m => (m - root) % 12 !== 0);
  // a bass note in a low range (A1 to A2 unless given)
  const low = (m, lo = 33, hi = 45) => { while (m > hi) m -= 12; while (m < lo) m += 12; return m; };
  // The chord under every bar of a song. A progression is [root, type, bars?] entries (bars defaults to the style's bars per
  // chord, times the song's slow: 0.5, 1 or 2). Section A (with the intro and outro) plays progression A, section B (with the
  // break and the drop) progression B, which is A again in some songs. It starts again at each new section.
  const progOf = sec => sec === 'B' || sec === 'drop' || sec === 'break' ? T.pB : T.pA;
  function chordPlan(sections){
    const out = []; let runStart = 0;
    for (let b = 0; b < sections.length; b++){
      if (b > 0 && sections[b] !== sections[b - 1]) runStart = b;
      const P = progOf(sections[b]), len = c => Math.max(1, Math.round((c[2] || P.bpc)*P.slow)), total = P.p.reduce((n, c) => n + len(c), 0);
      let p = (b - runStart) % total, i = 0;
      while (p >= len(P.p[i])){ p -= len(P.p[i]); i++; }
      out.push({ root:P.p[i][0], type:P.p[i][1], start:p === 0, k:b - runStart });   // (k: the bar within its section)
    }
    return out;
  }
  // seconds from this sixteenth to the next chord change (or the end of the track)
  function chordLeft(bar, s, sd){ let b = bar + 1; while (b < T.chords.length && !T.chords[b].start) b++; return ((b - bar)*16 - s)*sd; }
  // ---------------------------------------------------------------- melodies
  // A phrase is two bars: a rhythm (sixteenths 0..31) and a contour in scale steps (the song's pentatonic scale, five steps an
  // octave). Each note is then fitted to the chord under it: on beats 1 and 3 to a chord tone, elsewhere to a note that sits well
  // on that chord, so a melody never clashes. A section's tune is four phrases in a form: 'aAbB' is a phrase, its answer, a
  // second phrase and its answer; 'abaB', 'aaaB' and 'aAaB' repeat differently. A and B get tunes of their own.
  const SCALES = { major:[0, 2, 4, 7, 9], minor:[0, 3, 5, 7, 10] };
  const CTONES = { maj9:[0, 4, 7, 11], six9:[0, 4, 7, 9], maj7:[0, 4, 7, 11], m9:[0, 3, 7, 10], m11:[0, 3, 7, 10], m7:[0, 3, 7, 10], m6:[0, 3, 7, 9], dom9:[0, 4, 7, 10], sus:[0, 5, 7, 10],
    add9:[0, 4, 7], madd9:[0, 3, 7], lyd:[0, 4, 7, 11], sus2:[0, 2, 7] };
  const AVAIL = { maj9:[0, 2, 4, 7, 9, 11], six9:[0, 2, 4, 7, 9], maj7:[0, 2, 4, 7, 9, 11], m9:[0, 2, 3, 5, 7, 10], m11:[0, 2, 3, 5, 7, 10], m7:[0, 2, 3, 5, 7, 10],
    m6:[0, 2, 3, 5, 7, 9], dom9:[0, 2, 4, 7, 9, 10], sus:[0, 2, 5, 7, 10], add9:[0, 2, 4, 7, 9], madd9:[0, 2, 3, 5, 7], lyd:[0, 2, 4, 6, 7, 9, 11], sus2:[0, 2, 7, 9] };
  function fit(m, root, type, strong){
    const set = (strong ? CTONES : AVAIL)[type] || AVAIL.maj9;
    for (let d = 0; d <= 3; d++) for (const x of [m - d, m + d]) if (set.includes((((x - root) % 12) + 12) % 12)) return x;
    return m;
  }
  function phrase(cell, deg0){
    const shape = pick([1, -1, 0, 0]), n = cell.length;   // rising, falling or an arch
    let deg = deg0 + Math.floor(R()*3);
    return cell.map((s, i) => {
      if (i) deg += (shape ? shape : i < n/2 ? 1 : -1)*(R() < 0.65 ? 1 : 2)*(R() < 0.2 ? -1 : 1);
      deg = Math.max(2, Math.min(10, deg));
      return { s, d:Math.min((i < n - 1 ? cell[i + 1] : 32) - s, i === n - 1 ? 8 : 6), deg };
    });
  }
  // a repeat with a note or two moved a step; the answer: the same rhythm, coming down to the home note at the end
  const vary = p => p.map((x, i) => i && i < p.length - 1 && R() < 0.3 ? { ...x, deg:Math.max(2, Math.min(10, x.deg + (R() < 0.5 ? 1 : -1))) } : x);
  const answer = p => p.map((x, i) => i < p.length - 2 ? x : i === p.length - 2 ? { ...x, deg:Math.max(2, x.deg - 1) } : { ...x, deg:Math.max(5, 5*Math.round((x.deg - 1)/5)) });
  const FORMS = ['aAbB', 'abaB', 'aaaB', 'aAaB'];
  function tune(cells, deg0){
    const a = phrase(pick(cells), deg0), b = phrase(pick(cells), deg0 + (R() < 0.5 ? 1 : 0)), form = pick(FORMS);
    const out = [...form].map((f, i) => f === 'a' ? (i ? vary(a) : a) : f === 'A' ? answer(a) : f === 'b' ? b : answer(b));
    out.form = form; return out;
  }
  const melPitch = (n, base) => base + 12*Math.floor(n.deg/5) + SCALES[T.mode][n.deg % 5];
  // the notes of phrase ph on this sixteenth (bar2: first or second bar of the phrase)
  function eachNote(ph, bar2, s, fn){ if (ph) for (const n of ph) if (n.s === bar2*16 + s) fn(n); }
  // which phrase plays in bar k of a section: 'on' two bars, 'off' two bars, or all the way through
  function melAt(tn, k, always){ if (!always && k % 4 >= 2) return null; return tn[(always ? k >> 1 : k >> 2) % tn.length]; }
  // the chord's third or seventh nearest the last note: a slow counter-line that moves by small steps
  function guide(root, type, prev, lo, hi){
    const ct = CTONES[type] || CTONES.maj9, want = [ct[1], ct[ct.length - 1]]; let best = lo;
    for (let m = lo, d = 99; m <= hi; m++) if (want.includes(((m - root) % 12 + 12) % 12) && Math.abs(m - prev) < d){ d = Math.abs(m - prev); best = m; }
    return best;
  }
  // ---------------------------------------------------------------- per-song choices
  // A choice from a list (repeat an entry to make it likelier). It leaves out the choice the last song of the style made
  // (SH.memo); catalogue songs are dealt with a fresh SH, so for them this is idle and a seed always deals the same song.
  // (avoid: one more value to leave out, such as the last song's lead in any style; force: set by offline renders)
  function choose(name, list, avoid){
    const f = T.force ? T.force[name] : undefined;
    let x;
    if (f !== undefined) x = typeof f === 'number' && typeof list[0] !== 'number' ? list[f % list.length] : f;
    else { const last = T.mem[name], pool = list.filter(y => y !== last && y !== avoid); x = pick(pool.length ? pool : list); }
    T.chosen[name] = x;
    return x;
  }
  // A style's balance by part (STYLES[..].mix over MIX0), applied as each note is made, like the style's level: kick (its
  // body; the click is drums), bass (the bass line), root (the soft sine under the chord in ambient), keys (the chords on the
  // keys), pad, lead (the tune and anything on top), drums (all but the kick's body) and drone. Changing it draws nothing, so
  // every song stays the same song. _render(.., { mix }) can set it for one render (and level, times the style's).
  const MIX0 = { kick:1, bass:1, root:1, keys:1, pad:1, lead:1, drums:1, drone:1 };
  const mx = k => T && T.mix ? T.mix[k] : 1;
  // quiet textures: vinyl crackle, rain, wind or tape hiss (at their own levels, not the style's)
  const TEXTURES = { vinyl:{ crackle:0.022 }, dust:{ crackle:0.01 }, rain:{ rain:1, crackle:0.005 }, tape:{ hiss:0.004 }, wind:{ wind:1 }, none:{} };
  // ---------------------------------------------------------------- styles
  // Each style sets its tempo range, how often a song is in minor, its chord progressions (degrees above the key: the major
  // key's tonic, or the minor key's), its arrangements (plans), its level and balance (mix: since 0.9.4 the bass line and the
  // kick are much softer, and the tune a little louder), and deals its song's palette in setup(T). It plays one sixteenth
  // note at a time in step(c).
  const L_CELLS = [[0, 3, 6, 10, 16, 19, 22], [2, 6, 8, 12, 14, 24, 28], [0, 4, 7, 10, 12, 20], [0, 6, 8, 14, 18, 22, 24], [3, 6, 10, 11, 14, 22], [0, 8, 10, 16, 24, 26],
    [4, 6, 8, 20, 22, 24, 28], [0, 3, 8, 16, 19, 24]];
  const STYLES = {
    lofi:{ label:'lofi', bpm:[66, 88], minor:0.3, sameB:0.4, bpc:pr => pr.length <= 2 ? 2 : 1, slow:pr => pr.length >= 4 && R() < 0.2 ? 2 : 1, drone:0.012, level:1.56, mix:{ bass:0.3, kick:0.5, lead:1.4, keys:0.9 },
      progs:{ major:[
        [[2, 'm9'], [7, 'dom9'], [0, 'maj9'], [9, 'm9']], [[0, 'maj9'], [9, 'm9'], [5, 'maj9'], [7, 'dom9']], [[5, 'maj7'], [4, 'm7'], [2, 'm9'], [0, 'maj9']],
        [[9, 'm9'], [2, 'm11'], [7, 'dom9'], [0, 'maj9']], [[0, 'maj9'], [5, 'maj9']], [[4, 'm7'], [9, 'm9'], [2, 'm9'], [7, 'sus']],
        [[5, 'maj9'], [5, 'm6'], [0, 'maj9'], [0, 'six9']], [[0, 'maj9'], [4, 'm7'], [5, 'maj9'], [5, 'm6']], [[2, 'm9', 2], [7, 'sus'], [7, 'dom9'], [0, 'maj9', 2], [9, 'm9', 2]],
        [[0, 'maj9'], [10, 'maj7'], [5, 'maj9'], [0, 'six9']], [[5, 'maj9'], [7, 'sus'], [4, 'm7'], [9, 'm9']], [[9, 'm9'], [5, 'maj9'], [0, 'maj9'], [7, 'sus']],
        [[2, 'm9'], [5, 'm6'], [0, 'maj9', 2]], [[0, 'maj7'], [2, 'm7'], [4, 'm7'], [5, 'maj7']], [[0, 'six9'], [9, 'm9'], [2, 'm9'], [7, 'dom9']], [[2, 'm11'], [0, 'maj9']]],
        minor:[
        [[0, 'm9'], [5, 'm9'], [10, 'dom9'], [3, 'maj9']], [[0, 'm9'], [8, 'maj9'], [3, 'maj9'], [10, 'sus']], [[0, 'm11'], [5, 'dom9']],
        [[8, 'maj9'], [7, 'm7'], [5, 'm9'], [0, 'm9']], [[5, 'm9'], [7, 'm7'], [0, 'm9', 2]], [[0, 'm9'], [3, 'maj9'], [5, 'm9'], [10, 'sus']]] },
      plans:[
        [['intro', 4], ['A', 8], ['B', 8], ['break', 4], ['A', 8], ['B', 8], ['outro', 4]], [['intro', 2], ['A', 8], ['A', 8], ['B', 8], ['outro', 4]],
        [['intro', 4], ['A', 8], ['B', 8], ['B', 8], ['outro', 4]], [['A', 8], ['B', 8], ['break', 4], ['B', 8], ['A', 4], ['outro', 4]],
        [['intro', 4], ['A', 16], ['break', 4], ['B', 8], ['outro', 4]], [['intro', 4], ['A', 8], ['B', 8], ['A', 8], ['B', 8], ['outro', 2]]],
      setup:T => {
        T.keys = choose('keys', ['rhodes', 'rhodes', 'wurli', 'piano', 'guitar']);
        T.comp = choose('comp', T.keys === 'guitar' ? ['strum', 'strum', 'arp', 'pulse'] : T.keys === 'piano' ? ['held', 'push', 'arp'] : ['held', 'held', 'push', 'pulse', 'arp']);
        T.leadI = choose('lead', ['sine', 'flute', 'musicbox', 'vibes', 'kalimba', 'guitar', 'piano', 'ocarina', 'rhodes'].filter(x => x !== T.keys), SH.lastLead);
        T.bassI = choose('bass', ['round', 'round', 'upright', 'sub']);
        T.bassPat = choose('bassPat', ['root8', 'approach', 'sparse']);
        T.kit = choose('kit', ['dusty', 'dusty', 'soft', 'deep', 'tight']);
        T.snare = choose('snare', ['snare', 'snare', 'rim', 'brush', 'snap']);
        T.hats = choose('hats', ['eighths', 'eighths', 'sixteenths', 'shaker', 'quarters']);
        T.hatTone = pick(['bright', 'dark', 'tick']);
        T.kickPat = pick([[0, 7, 10], [0, 10], [0, 3, 10], [0, 8, 11], [0, 9], [0, 6, 10], [0, 2, 10], [0, 7, 9]]);
        T.half = T.bpm >= 78 && R() < 0.3;   // (a lazy half-time beat: the snare on 3 only)
        T.perc = pick(['none', 'none', 'conga', 'block']);
        T.openHat = R() < 0.35; T.late = R()*0.022; T.swing = 0.06 + R()*0.2; T.hatDensity = 0.55 + R()*0.4;
        T.tex = choose('tex', ['vinyl', 'vinyl', 'vinyl', 'rain', 'tape']);
        T.muffle = R() < 0.35;   // (the intro, and the break, sound as if from the next room)
        T.where = pick(['B', 'AB', 'AB']);   // (B: the lead plays in B and the second half of A; AB: A and B have their own tunes)
        T.counter = pick(['none', 'none', 'guide', 'answer']);   // (a held counter-line in B, or a second instrument answering the tune)
        T.counterI = pick((T.counter === 'guide' ? ['warm', 'warm', 'vibes', 'rhodes'] : ['vibes', 'rhodes', 'flute', 'kalimba']).filter(x => x !== T.leadI && x !== T.keys));
        T.mel = { A:tune(L_CELLS, 4), B:tune(L_CELLS, 5) };
      },
      step:lofiStep },
    house:{ label:'chill house', bpm:[108, 122], minor:0.7, sameB:0.35, bpc:pr => pr.length <= 2 ? 2 : 1, slow:pr => pr.length >= 4 && R() < 0.3 ? 2 : 1, drone:0.012, level:1.65, mix:{ bass:0.36, kick:0.32, lead:1.2 },
      progs:{ minor:[
        [[0, 'm9'], [8, 'maj9'], [3, 'maj9'], [10, 'dom9']], [[0, 'm9'], [5, 'm9']], [[0, 'm11'], [10, 'sus'], [8, 'maj9'], [7, 'm7']], [[0, 'm9'], [8, 'maj9'], [3, 'maj9'], [10, 'sus']],
        [[0, 'm9'], [10, 'six9']], [[0, 'm11'], [5, 'dom9']], [[0, 'm9'], [3, 'maj9'], [8, 'maj9'], [7, 'm7']], [[5, 'm9'], [0, 'm9']],
        [[0, 'm7'], [7, 'm7'], [8, 'maj7'], [10, 'sus']], [[8, 'maj9'], [10, 'sus'], [0, 'm9', 2]]],
        major:[[[0, 'maj9'], [5, 'maj9']], [[5, 'maj9'], [7, 'sus'], [4, 'm7'], [9, 'm9']], [[0, 'maj9'], [2, 'm9']], [[9, 'm9'], [5, 'maj9'], [0, 'maj9'], [7, 'sus']]] },
      plans:[
        [['intro', 8], ['A', 16], ['B', 16], ['break', 8], ['drop', 16], ['outro', 8]], [['intro', 8], ['A', 16], ['break', 8], ['B', 16], ['outro', 8]],
        [['intro', 4], ['A', 8], ['B', 16], ['break', 8], ['B', 16], ['outro', 8]], [['intro', 8], ['B', 16], ['break', 4], ['drop', 16], ['A', 8], ['outro', 8]]],
      setup:T => {
        T.keys = choose('keys', ['pad', 'pad', 'stab', 'keys', 'strings']);
        T.stabI = pick(['organ', 'organ', 'rhodes']); T.stab = pick([[0, 3, 6, 10], [2, 6, 10, 14], [0, 6, 12], [3, 6, 11, 14], [2, 10]]);
        T.top = choose('top', ['pluck', 'pluck', 'riff', 'choir']);
        T.riffI = pick(['marimba', 'kalimba', 'vibes']); T.riff = pick([[0, 3, 6, 8, 11, 14], [0, 2, 6, 8, 10, 14], [0, 3, 7, 10, 12], [2, 5, 8, 11, 14]]); T.riffOrd = pick([[0, 2, 1, 3], [0, 1, 2, 3], [2, 1, 0, 1], [0, 3, 1, 2]]);
        T.leadI = choose('lead', ['none', 'flute', 'vibes', 'sine', 'kalimba', 'ocarina'], SH.lastLead);
        T.bassI = pick(['round', 'round', 'sub']);
        T.bassPat = choose('bassPat', ['offbeat', 'offbeat', 'rolling', 'synco', 'long']);
        T.kit = choose('kit', ['dusty', 'soft', 'deep', 'tight']);
        T.snare = choose('snare', ['clap', 'clap', 'snare', 'rim', 'snap']);
        T.hats = choose('hats', ['open', 'open', 'shaker', 'closed']);
        T.hatTone = pick(['bright', 'dark', 'tick']);
        T.perc = pick(['none', 'conga', 'rim']); T.congaPat = pick([[3, 7, 10], [6, 11, 14], [3, 10, 13], [7, 14]]);
        T.pump = 0.25 + R()*0.3;   // (how far the music ducks on each kick)
        T.swing = R() < 0.4 ? 0.05 + R()*0.08 : 0;
        T.tex = choose('tex', ['none', 'none', 'dust']);
        T.breakI = pick(['bell', 'bell', 'choir', 'musicbox']);
        T.mel = { A:tune([[0, 3, 6, 8, 16, 19, 22], [2, 6, 10, 14, 18, 22], [0, 4, 6, 10, 16, 20], [0, 6, 12, 16, 22, 28]], 5), B:null };
        T.mel.B = T.mel.A;
      },
      step:houseStep },
    ambient:{ label:'ambient', bpm:[52, 72], minor:0.25, sameB:0.3, bpc:() => 4, slow:pr => pick(pr.length <= 2 ? [0.5, 1, 1] : [0.5, 1, 1, 2]), drone:0.02, level:0.78, mix:{ root:0.15, lead:1.6 },
      progs:{ major:[
        [[0, 'maj9'], [9, 'm9'], [5, 'maj9'], [2, 'm11']], [[0, 'sus'], [10, 'maj9'], [5, 'maj9']], [[2, 'm11'], [0, 'maj9'], [7, 'sus'], [9, 'm9']],
        [[0, 'lyd'], [2, 'add9']], [[0, 'maj9'], [4, 'm7'], [9, 'm9'], [5, 'lyd']], [[5, 'lyd'], [0, 'maj9']], [[0, 'six9'], [7, 'sus'], [9, 'm9'], [5, 'maj9']],
        [[0, 'sus2'], [5, 'add9'], [9, 'madd9'], [7, 'sus2']], [[0, 'maj9'], [0, 'lyd'], [9, 'm9'], [9, 'm11']], [[2, 'm9'], [5, 'maj9'], [0, 'maj9'], [0, 'six9']]],
        minor:[[[0, 'm9'], [8, 'lyd'], [3, 'maj9'], [10, 'sus']], [[0, 'm11'], [3, 'maj9']], [[0, 'm9'], [5, 'm9'], [8, 'maj9'], [7, 'sus']]] },
      // one long section, or two halves on two progressions: 1 min 20 s to 2 min 10 s
      plans:[T => [['A', ambBars(T)]], T => [['A', ambBars(T)]], T => { const n = ambBars(T), h = 4*Math.round(n/8); return [['A', h], ['B', n - h]]; }],
      setup:T => {
        T.padI = choose('pad', ['pad', 'pad', 'choir', 'glass', 'strings', 'warm']);
        T.spark = choose('spark', ['bell', 'bell', 'musicbox', 'kalimba', 'glock', 'piano', 'vibes'], SH.lastLead);
        T.sparkMode = choose('sparkMode', ['random', 'random', 'melody', 'arp']);
        T.arpEvery = pick([4, 6, 8]); T.arpUD = R() < 0.5;
        T.tex = choose('tex', ['none', 'wind', 'wind', 'rain']);
        T.leadI = T.spark;
        T.mel = { A:tune([[0, 8, 16, 24], [0, 12, 16], [4, 16, 20], [0, 6, 16, 28], [0, 16, 24]], 5) };
      },
      step:ambientStep },
    piano:{ label:'ambient piano', bpm:[56, 78], minor:0.35, sameB:0.35, bpc:() => 2, slow:pr => pr.length >= 8 ? 1 : pr.length >= 4 && R() < 0.25 ? 0.5 : 1, drone:0, level:7.2,
      progs:{ major:[
        [[0, 'maj9'], [7, 'sus'], [9, 'm9'], [5, 'maj9']], [[9, 'm9'], [5, 'maj9'], [0, 'maj9'], [7, 'sus']], [[0, 'maj9'], [4, 'm7'], [5, 'maj9'], [5, 'm6']],
        [[5, 'maj9'], [0, 'maj9'], [7, 'sus'], [9, 'm9']], [[0, 'add9'], [9, 'madd9'], [4, 'm7'], [5, 'maj7']], [[5, 'maj7'], [7, 'sus'], [4, 'm7'], [9, 'm9']],
        [[0, 'maj9'], [5, 'lyd']], [[2, 'm9'], [7, 'sus'], [0, 'maj9'], [0, 'six9']],
        [[0, 'maj9', 1], [7, 'sus', 1], [9, 'm9', 1], [4, 'm7', 1], [5, 'maj9', 1], [0, 'maj9', 1], [5, 'm6', 1], [7, 'sus', 1]]],
        minor:[[[0, 'm9'], [8, 'maj9'], [3, 'maj9'], [10, 'sus']], [[0, 'm9'], [5, 'm9'], [8, 'maj9'], [7, 'sus']], [[8, 'maj9'], [10, 'sus'], [0, 'm9'], [0, 'm6']],
        [[0, 'madd9'], [10, 'add9'], [8, 'maj7'], [10, 'sus']], [[0, 'm9'], [3, 'maj9'], [10, 'add9'], [5, 'm9']]] },
      plans:[
        [['intro', 2], ['A', 12], ['B', 12], ['A', 8], ['outro', 2]], [['intro', 2], ['A', 8], ['B', 8], ['A', 8], ['B', 8], ['outro', 2]],
        [['intro', 4], ['A', 16], ['B', 8], ['outro', 4]], [['intro', 2], ['A', 8], ['A', 8], ['B', 12], ['outro', 2]]],
      setup:T => {
        T.drift = 0.015; T.driftPh = R()*6;   // (the tempo breathes by about 1.5%)
        T.lh = choose('lh', ['root5', 'root5', 'octave', 'walk', 'block']);
        T.rh = choose('rh', ['eighths', 'eighths', 'dotted', 'sparse', 'hymn']);
        T.padI = choose('pad', ['warm', 'warm', 'strings', 'choir', 'none']);
        T.where = choose('where', ['B', 'B', 'AB', 'all']);
        T.color = choose('color', ['none', 'none', 'musicbox', 'cello']);
        T.tex = choose('tex', ['tape', 'tape', 'rain', 'vinyl', 'none']);
        T.leadI = 'piano';
        const cells = [[0, 8, 12, 16, 24], [0, 4, 8, 16, 20, 24], [4, 8, 16, 28], [0, 12, 16, 20], [0, 6, 8, 16, 22], [2, 8, 16, 18, 24], [0, 10, 16, 26]];
        T.mel = { A:tune(cells, 3), B:tune(cells, 5) };
      },
      step:pianoStep },
    downtempo:{ label:'downtempo', bpm:[80, 100], minor:0.8, sameB:0.35, bpc:() => 2, slow:pr => pr.length >= 4 && R() < 0.3 ? 0.5 : 1, drone:0, level:2.3, mix:{ bass:0.52, lead:1.25 },
      progs:{ minor:[
        [[0, 'm9'], [5, 'dom9']], [[0, 'm11'], [3, 'maj9'], [8, 'maj9'], [7, 'm7']], [[0, 'm9'], [10, 'sus'], [8, 'maj9'], [10, 'dom9']], [[0, 'm9'], [8, 'maj7']],
        [[0, 'm11'], [10, 'six9'], [8, 'maj9'], [5, 'm9']], [[5, 'm9'], [0, 'm9']], [[0, 'm9'], [3, 'maj9'], [5, 'm11'], [8, 'maj9']], [[0, 'm9', 4], [8, 'maj9'], [10, 'sus']],
        [[0, 'm9'], [7, 'm7'], [8, 'maj9'], [5, 'm9']]],
        major:[[[2, 'm9'], [7, 'dom9'], [0, 'maj9'], [0, 'six9']], [[5, 'maj9'], [4, 'm7'], [2, 'm9'], [0, 'maj9']], [[0, 'maj9'], [2, 'm9']]] },
      plans:[
        [['intro', 4], ['A', 12], ['B', 12], ['break', 4], ['A', 8], ['outro', 4]], [['intro', 4], ['A', 8], ['B', 8], ['A', 8], ['B', 8], ['outro', 4]],
        [['intro', 2], ['A', 16], ['break', 4], ['B', 12], ['outro', 4]], [['A', 8], ['B', 8], ['break', 4], ['B', 8], ['A', 8], ['outro', 2]]],
      setup:T => {
        T.keys = choose('keys', ['rhodes', 'rhodes', 'organ', 'wurli', 'guitar', 'piano']);
        T.comp = choose('comp', T.keys === 'guitar' ? ['strum', 'arp'] : ['bar', 'bar', 'held', 'pulse', 'arp']);
        T.leadI = choose('lead', ['vibes', 'vibes', 'flute', 'kalimba', 'ocarina', 'guitar', 'sine', 'hum', 'marimba'].filter(x => x !== T.keys), SH.lastLead);
        T.bassI = choose('bass', ['sub', 'sub', 'round', 'upright']);
        T.feel = choose('feel', ['half', 'half', 'broken', 'shuffle']);
        T.kit = choose('kit', ['soft', 'dusty', 'deep', 'tight']);
        T.snare = choose('snare', ['snare', 'snare', 'rim', 'clap', 'snap']);
        T.hats = choose('hats', ['sixteenths', 'sixteenths', 'eighths', 'shaker']);
        T.hatTone = pick(['bright', 'dark', 'tick']);
        T.perc = pick(['none', 'none', 'conga', 'block']);
        T.padI = choose('pad', ['choir', 'choir', 'strings', 'warm', 'none']);
        T.where = pick(['A', 'A', 'AB']);
        T.dub = R() < 0.35;   // (the snare on 3 echoes)
        T.swing = T.feel === 'shuffle' ? 0.16 + R()*0.08 : 0.06 + R()*0.08;
        T.tex = choose('tex', ['vinyl', 'vinyl', 'rain', 'tape', 'none']);
        T.muffle = R() < 0.25;
        const cells = [[0, 6, 10, 16], [4, 8, 14, 24], [0, 3, 8, 20], [2, 6, 18, 22], [0, 3, 6, 16, 19, 22], [8, 10, 14, 24, 28], [0, 10, 12, 16, 26]];
        T.mel = { A:tune(cells, 5), B:tune(cells, 6) };
      },
      step:downStep },
    synthwave:{ label:'synthwave', bpm:[80, 106], minor:0.6, sameB:0.35, bpc:() => 2, slow:pr => pr.length >= 4 && R() < 0.25 ? 0.5 : 1, drone:0, level:1.94, mix:{ bass:0.27, lead:1.2 },
      progs:{ minor:[
        [[0, 'm9'], [8, 'maj9'], [3, 'maj9'], [10, 'sus']], [[0, 'm9'], [10, 'dom9'], [8, 'maj9'], [10, 'dom9']], [[0, 'm9'], [8, 'maj9'], [5, 'm9'], [7, 'm7']],
        [[0, 'm7'], [5, 'm7'], [8, 'maj7'], [7, 'm7']], [[8, 'maj7'], [10, 'add9'], [0, 'm9', 4]], [[0, 'm9'], [3, 'maj9'], [10, 'add9'], [8, 'maj9']],
        [[0, 'madd9'], [8, 'add9'], [10, 'add9'], [10, 'sus']]],
        major:[[[9, 'm9'], [5, 'maj9'], [0, 'add9'], [7, 'sus']], [[0, 'add9'], [7, 'sus'], [9, 'm9'], [5, 'maj9']], [[5, 'maj9'], [7, 'add9'], [9, 'm9'], [9, 'm7']],
        [[0, 'maj9'], [4, 'm7'], [5, 'maj9'], [7, 'sus']], [[5, 'maj7'], [0, 'add9'], [7, 'sus'], [9, 'm9']]] },
      plans:[
        [['intro', 8], ['A', 16], ['B', 16], ['break', 8], ['B', 16], ['outro', 8]], [['intro', 4], ['A', 8], ['B', 16], ['A', 8], ['B', 16], ['outro', 8]],
        [['intro', 8], ['A', 16], ['break', 4], ['B', 16], ['outro', 8]], [['intro', 8], ['B', 16], ['A', 8], ['B', 16], ['outro', 8]]],
      setup:T => {
        T.padI = choose('pad', ['pad', 'pad', 'strings', 'brass', 'choir']);
        T.arp = choose('arp', ['up', 'updown', 'pattern', 'eighths', 'none']);
        T.arpW = pick(['square', 'square', 'triangle', 'sawtooth']); T.arpUD = T.arp === 'updown';
        T.bassI = pick(['round', 'synth']);
        T.bassPat = choose('bassPat', ['octave', 'octave', 'pulse', 'gallop', 'long']);
        T.leadI = choose('lead', ['sine', 'square', 'saw', 'ocarina', 'bell', 'glock'], SH.lastLead);
        if (T.arp === 'none' && T.leadI === 'bell') T.leadI = 'saw';
        T.kit = choose('kit', ['soft', 'deep', 'dusty', 'tight']);
        T.snare = choose('snare', ['snare', 'snare', 'clap']);
        T.hats = choose('hats', ['eighths', 'eighths', 'sixteenths', 'quarters']);
        T.toms = R() < 0.5;
        T.where = pick(['B', 'B', 'AB']);
        T.tex = choose('tex', ['none', 'none', 'tape', 'dust']);
        const cells = [[0, 4, 8, 12, 16, 20, 24], [0, 6, 8, 14, 16, 22, 24], [0, 8, 12, 16, 24, 28], [2, 4, 8, 14, 18, 20, 24], [0, 12, 16, 28], [0, 6, 12, 16, 22, 28]];
        T.mel = { A:tune(cells, 4), B:tune(cells, 5) };
      },
      step:waveStep },
  };
  // an ambient song's length in bars (a multiple of 4): 1 min 20 s to 2 min 10 s at its tempo
  const ambBars = T => 4*Math.max(4, Math.round((80 + R()*50)/(240/T.bpm)/4));
  // ---------------------------------------------------------------- the songs and the shuffle
  // The catalogue: every song the radio plays, as its style, its seed and its name. A seed deals the same song every time
  // (music._render(style, sec, { seed }) renders it, music._info says what it plays), so a new song is a seed that sounds
  // good: render a few, listen, and add the ones to keep. (the name is the one its seed deals; tests/music.mjs checks it)
  // The owner kept these 16 of 24 on 2026-09-28, and took out Lullaby for Proxima b the same day (15).
  const SONGS = [
    ['lofi', 20, 'Slow Orbit of Halley'],
    ['downtempo', 24, 'Soft Focus on Mars'], ['downtempo', 4, 'Low Tide on Orion'],
    ['ambient', 1, 'Slowly past Io'], ['ambient', 18, 'Slowly past Mars'], ['ambient', 14, 'Silence over Halley'], ['ambient', 6, 'Dust over Mars'],
    ['piano', 1, 'Lullaby for Io'],
    ['house', 1, 'Night Bus to Io'], ['house', 25, 'Warm Signal from Hale-Bopp'], ['house', 74, 'Sunrise over Halley'], ['house', 33, 'Golden Hour on Antares'],
    ['synthwave', 1, 'Tapes from Io'], ['synthwave', 40, 'Tapes from Rigel'], ['synthwave', 12, 'City Lights of Mars'],
  ].map(([style, seed, title]) => ({ id:style + '-' + seed, style, seed, title }));
  // The candidates on the review page (/songs, src/09s-songs.js): the radio's songs and new ones, picked from a few hundred
  // seeds of each style by measurement (bass balance, loudness, a tune that comes back, variety). The owner marks each one
  // keep or drop by ear; the keepers go in SONGS.
  // (2026-09-29: 16 new songs from about 2,400 seeds, mostly lofi and downtempo for the default mix)
  const CANDIDATES = [...SONGS, ...[
    ['lofi', 171, 'Tea on Neptune'], ['lofi', 352, 'Study Notes from Pluto'], ['lofi', 99, 'Cassette from Mercury'], ['lofi', 49, 'Rainy Day on the Sombrero'],
    ['lofi', 162, 'Centaurus A at 3 AM'],
    ['downtempo', 273, 'Slow Motion over Aldebaran'], ['downtempo', 259, 'Afternoon on Epsilon Eridani'], ['downtempo', 208, 'Half Light on Rigel'], ['downtempo', 50, 'Long Way to Orion'],
    ['ambient', 271, 'The Long Night of Omega Centauri'],
    ['piano', 396, 'Quiet Hours on HL Tauri'], ['piano', 241, 'Snow on Aldebaran'],
    ['house', 286, 'Nights under Pluto'], ['house', 30, 'Afterglow over the Veil'], ['house', 32, 'Dancing on the Crab'],
    ['synthwave', 15, 'Neon over Antares'],
  ].map(([style, seed, title]) => ({ id:style + '-' + seed, style, seed, title }))];
  // A mood picks the styles. The default mix plays the gentle ones: all but chill house and synthwave, which play under
  // groove. (calm is the mood of ambient and ambient piano, and CALM those two styles.)
  const MOODS = {
    mix:['ambient', 'piano', 'lofi', 'downtempo'],
    calm:['ambient', 'piano'],
    beats:['lofi', 'downtempo'],
    groove:['house', 'synthwave'],
  };
  const CALM = ['ambient', 'piano'];
  const moodOf = () => MOODS[SET.musicStyle] ? SET.musicStyle : 'mix';
  // The shuffle (its own state, Q, and Math.random, never a song's generator): the mood's songs in a random order, each once,
  // then a new order. Never the same song twice in a row (across two orders too), a new style each time when it can, and in
  // the mix a calm song (ambient or piano) at least every fifth song. A picked song (Q.next) plays next, whatever the mood.
  // SH: the dealing state of the song being dealt (fresh for every song, so a seed always deals the same song).
  const fresh = () => ({ sig:null, recent:[], memo:{}, lastLead:null });
  let SH = fresh(), Q = { mood:null, order:[], last:null, sinceCalm:0, next:null, recent:[] };
  function nextSong(){
    const mood = moodOf(), rnd = Math.random;
    let song = Q.next && SONGS.find(x => x.id === Q.next); Q.next = null;
    if (!song){
      if (Q.mood !== mood){ Q.mood = mood; Q.order = []; }
      if (!Q.order.length){
        Q.order = SONGS.filter(x => MOODS[mood].includes(x.style));
        for (let i = Q.order.length - 1; i > 0; i--){ const j = Math.floor(rnd()*(i + 1)); [Q.order[i], Q.order[j]] = [Q.order[j], Q.order[i]]; }
      }
      // (the first test that some song passes picks it: a song from the last half of the list is kept back when a new order starts)
      const last = Q.last || {}, calmDue = mood === 'mix' && Q.sinceCalm >= 4, n = SONGS.filter(x => MOODS[mood].includes(x.style)).length;
      const recent = Q.recent.slice(-Math.floor(n/2)), calm = x => !calmDue || CALM.includes(x.style), unheard = x => !recent.includes(x.id);
      const tests = [x => unheard(x) && x.style !== last.style && calm(x), x => unheard(x) && calm(x), x => x.id !== last.id && x.style !== last.style && calm(x), x => x.id !== last.id && calm(x), x => x.id !== last.id];
      let i = -1; for (const ok of tests){ i = Q.order.findIndex(ok); if (i >= 0) break; }
      song = Q.order.splice(Math.max(i, 0), 1)[0];
    } else Q.order = Q.order.filter(x => x !== song);
    Q.last = song; Q.sinceCalm = CALM.includes(song.style) ? 0 : Q.sinceCalm + 1;
    Q.recent.push(song.id); if (Q.recent.length > 20) Q.recent.shift();
    return song;
  }
  // a song's key: D3 .. A3 (sig: its key signature)
  function nextKey(minor){
    const key = 50 + Math.floor(R()*8);
    SH.sig = ((key + (minor ? 3 : 0)) % 12 + 12) % 12;
    return key;
  }
  // Song names are made from places in the atlas: 'Rain on Titan', 'Night Drive to Vega'. None repeats among the last 60.
  // A place goes after a word like 'on' or 'over', or at the start before 'at' ('The Moon at 3 AM').
  const PLACES = ['Europa', 'Titan', 'Io', 'Enceladus', 'the Moon', 'Ceres', 'Pluto', 'Mars', 'Venus', 'Saturn', 'Jupiter', 'Neptune', 'Mercury',
    'Vega', 'Sirius', 'Polaris', 'Rigel', 'Deneb', 'Altair', 'Arcturus', 'Aldebaran', 'Antares', 'Betelgeuse', 'the Pleiades', 'Andromeda', 'Orion',
    'Proxima b', 'Alpha Centauri', 'TRAPPIST-1', 'Omega Centauri', 'the Sombrero', 'the Whirlpool', 'Carina', 'the Helix', 'the Crab', 'Halley',
    'Arrokoth', 'the Oort cloud', 'Epsilon Eridani', 'Hale-Bopp', 'the Perseids', 'the Leonids', 'HL Tauri', 'Centaurus A', 'the Veil', 'the Horsehead'];
  const NAMES = {
    lofi:['Rainy Day on #', 'Study Notes from #', 'Cassette from #', 'Slow Orbit of #', '# at 3 AM', 'Midnight over #', 'Tea on #', 'Window Seat to #', 'Dusty Records from #'],
    house:['Sunrise over #', 'Deep over #', 'Dancing on #', 'Warm Signal from #', 'Afterglow over #', 'Nights under #', 'Night Bus to #', 'Golden Hour on #'],
    ambient:['Drifting past #', 'Above #', 'The Long Night of #', 'Far Light of #', 'Silence over #', 'Horizon of #', 'Slowly past #', 'Dust over #'],
    piano:['Rain on #', 'Letter from #', 'Snow on #', 'Morning over #', 'Quiet Hours on #', 'Notes from #', 'Lullaby for #', 'A Light over #'],
    downtempo:['Slow Motion over #', 'Haze over #', 'Low Tide on #', 'Half Light on #', 'Afternoon on #', 'Soft Focus on #', 'Balcony on #', 'Long Way to #'],
    synthwave:['Night Drive to #', 'Neon over #', 'Cruising past #', '# at Midnight', 'Coastline of #', 'Last Train to #', 'Tapes from #', 'City Lights of #'],
  };
  function makeTitle(style){
    let name = '';
    for (let i=0;i<20;i++){
      const tpl = pick(NAMES[style]), place = pick(PLACES);
      name = tpl.replace('#', place); name = name[0].toUpperCase() + name.slice(1);
      if (!SH.recent.includes(name)) break;
    }
    SH.recent.push(name); if (SH.recent.length > 60) SH.recent.shift();
    return name;
  }
  let T = null, nextT = 0, step = 0, forceStyle = null, forceWith = null, forceSong = null, mixWith = null, solo = null;
  // Deal a song: its palette, harmony, arrangement and tunes (T), drawn from R. (song: from the catalogue; its seed
  // is set here and R stays on it while it plays)
  function deal(style, song){
    if (song){ R = gen(song.seed); SH = fresh(); }
    const S = STYLES[style];
    const minor = R() < S.minor, key = nextKey(minor);
    const bpm = S.bpm[0] + Math.floor(R()*(S.bpm[1] - S.bpm[0] + 1)), title = makeTitle(style);
    T = { style, key, bpm, minor, mode:minor ? 'minor' : 'major', title:song && song.title ? song.title : title, song:song ? song.id : null, label:S.label + ' · ' + bpm + ' bpm', held:[], chosen:{}, mem:SH.memo[style] || {},
      force:forceWith, swing:0, subPrev:0, guidePrev:0, pushed:-1, mix:{ ...MIX0, ...S.mix, ...(mixWith || {}) } };
    // the song's harmony: progression A, and B (A again, or another in the same mode)
    const bank = S.progs[T.mode], a = choose('prog', bank), b = R() < S.sameB ? a : choose('progB', bank.filter(p => p !== a));
    const mk = p => ({ p:p.map(([d, ty, n]) => [key + d, ty, n]), bpc:S.bpc(p), slow:S.slow(p), at:bank.indexOf(p) });
    T.pA = mk(a); T.pB = b === a ? T.pA : mk(b);
    const plan = choose('plan', S.plans), P = typeof plan === 'function' ? plan(T) : plan, sections = [];
    P.forEach(([nm, n]) => { for (let i=0;i<n;i++) sections.push(nm); });
    T.sections = sections; T.plan = P; T.introEnd = Math.max(sections.findIndex(x => x !== 'intro'), 0);
    S.setup(T);
    T.chords = chordPlan(sections);
    // every song ends on its home chord
    const n = sections.length, home = T.minor ? 'm9' : 'maj9';
    T.chords[n - 2] = { root:key, type:home, start:true, k:T.chords[n - 2].k }; T.chords[n - 1] = { root:key, type:home, start:false, k:T.chords[n - 1].k };
    T.cur = [T.chords[0].root, T.chords[0].type];   // the chord playing now (for sounds that should stay in tune with the music)
    T.name = `${T.title} · ${T.label}`;
    SH.memo[style] = T.chosen; if (T.leadI && T.leadI !== 'none') SH.lastLead = T.leadI;
    return T;
  }
  // a song's length in seconds (the piano's breathing tempo included), and where each bar starts
  const barLen = (T, b) => 4*60/(T.drift ? T.bpm*(1 + T.drift*Math.sin(b*0.45 + T.driftPh)) : T.bpm);
  const lengthOf = T => { let s = 0; for (let b = 0; b < T.sections.length; b++) s += barLen(T, b); return s; };
  const barStarts = T => { const out = []; let s = 0; for (let b = 0; b < T.sections.length; b++){ out.push(s); s += barLen(T, b); } return out; };
  // (at: the time the track starts; a new track is made a little ahead of the music)
  function newTrack(at){
    const song = forceSong || (forceStyle ? null : nextSong()), style = song ? song.style : forceStyle, S = STYLES[style];
    deal(style, song);
    step = first ? T.introEnd*16 : 0; first = false;
    // (a render starts where the intro ends, so an intro draws from a generator of its own: after it the song goes on
    // exactly as it renders)
    if (song && step === 0 && T.introEnd){ T.mainR = R; R = gen(song.seed + 104729); }
    if (!offline && !solo && typeof onTrack === 'function') onTrack(T);
    // the style's level (set on each note as it is made, so the last song's tail keeps its own) and the song's texture
    vel = S.level*(mixWith && mixWith.level || 1);
    trackSound(at === undefined ? ctx.currentTime : at);
  }
  // the song's texture, drone, filter, tape hiss and echo from time t, for the rest of the song (from its step)
  function trackSound(t){
    const S = STYLES[T.style], { key, bpm, sections } = T;
    // (a song is dealt up to 0.25 s ahead, so a skip can land before the skipped song's settings: those are cancelled first)
    const X = TEXTURES[T.tex] || TEXTURES.none;
    for (const [g, v, tc] of [[crackleG, X.crackle || 0, 2], [rainG, X.rain ? 0.015 : 0, 3], [windG, X.wind ? 0.06 : 0, 4], [droneG, S.drone*vel*mx('drone'), 4]]){ g.gain.cancelScheduledValues(t); g.gain.setTargetAtTime(v, t, tc); }
    // the drone follows the key (a slow glide from the last one)
    const d = low(key, 36, 47); drones.forEach((o, i) => { o.frequency.cancelScheduledValues(t); o.frequency.setTargetAtTime(hz(d + [0, 7, 12][i]), t, 1.5); });
    musLP.frequency.cancelScheduledValues(t);
    if (T.muffle && step === 0 && T.introEnd) musLP.frequency.setTargetAtTime(600, t, 0.05); else musLP.frequency.setTargetAtTime(20000, t, 0.3);
    if (hissNow && hissNow.end > t + 1.2){
      const h = hissNow; h.g.gain.cancelScheduledValues(t);
      if (h.start >= t){ h.g.gain.setValueAtTime(0, t); h.s.stop(t); }   // (not started yet: it never plays)
      else { h.g.gain.setTargetAtTime(0, t, 0.3); h.s.stop(t + 1.2); }
    }
    hissNow = null;
    if (X.hiss) hiss(t, (sections.length*16 - step)*60/bpm/4, X.hiss);
    for (const e of [echoL, echoR]){ e.delayTime.cancelScheduledValues(t); e.delayTime.setTargetAtTime(3*60/bpm/4, t, 0.05); }   // a dotted eighth
  }
  let onTrack = null;
  // ---------------------------------------------------------------- synthesis
  function impulse(sec, decay){
    const n = Math.floor(ctx.sampleRate*sec), buf = ctx.createBuffer(2, n, ctx.sampleRate);
    for (let c=0;c<2;c++){ const d = buf.getChannelData(c); let lp = 0;
      for (let i=0;i<n;i++){ const t = i/ctx.sampleRate; lp += (R()*2 - 1 - lp)*(0.25 + 0.5*Math.exp(-t*1.5)); d[i] = lp*Math.exp(-t/decay); } }
    return buf;
  }
  // a wave from its harmonics (sines), made once per context
  const wave = h => ctx.createPeriodicWave(new Float32Array(h.length + 1), new Float32Array([0, ...h]));
  function build(c){
    ctx = c || new AC();
    const sr = ctx.sampleRate;
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 3.5; comp.attack.value = 0.01; comp.release.value = 0.4;
    const tone = ctx.createBiquadFilter(); tone.type = 'lowpass'; tone.frequency.value = 9000; tone.Q.value = 0.3;
    master = ctx.createGain(); master.gain.value = 0;
    master.connect(tone).connect(comp).connect(ctx.destination);
    mixG = ctx.createGain(); mixG.connect(master);   // the music (everything but the whooshes)
    const verb = ctx.createConvolver(); verb.buffer = impulse(4.5, 1.4);
    const verbOut = ctx.createGain(); verbOut.gain.value = 0.7; verb.connect(verbOut).connect(mixG);
    verbSend = ctx.createGain(); verbSend.connect(verb);
    drumLP = ctx.createBiquadFilter(); drumLP.type = 'lowpass'; drumLP.frequency.value = 12000; drumLP.Q.value = 0.5;
    drumBus = ctx.createGain(); drumBus.gain.value = 0.9; drumBus.connect(drumLP).connect(mixG);
    duck = ctx.createGain(); duck.gain.value = 1; duck.connect(mixG);
    // the keys, pads and leads go through musLP: a song can start muffled, as if from the next room (the bass does not)
    musBus = ctx.createGain(); musBus.gain.value = 1; musLP = ctx.createBiquadFilter(); musLP.type = 'lowpass'; musLP.frequency.value = 20000; musLP.Q.value = 0.5;
    musBus.connect(musLP).connect(duck);
    const mv = ctx.createGain(); mv.gain.value = 0.35; musLP.connect(mv).connect(verbSend);
    noiseBuf = ctx.createBuffer(1, sr*2, sr); const nd = noiseBuf.getChannelData(0); for (let i=0;i<nd.length;i++) nd[i] = R()*2 - 1;
    // vinyl crackle: sparse clicks over a whisper of hiss
    const cb = ctx.createBuffer(1, sr*4, sr), cd = cb.getChannelData(0);
    for (let i=0;i<cd.length;i++) cd[i] = (R()*2 - 1)*0.05 + (R() < 0.0009 ? (R()*2 - 1)*(0.4 + R()) : 0);
    const cs = ctx.createBufferSource(); cs.buffer = cb; cs.loop = true;
    const chp = ctx.createBiquadFilter(); chp.type = 'highpass'; chp.frequency.value = 900;
    crackleG = ctx.createGain(); crackleG.gain.value = 0; cs.connect(chp).connect(crackleG).connect(mixG); cs.start();
    // rain: a soft wash with drops in it
    const rb = ctx.createBuffer(2, sr*3, sr);
    for (let ch=0;ch<2;ch++){ const d = rb.getChannelData(ch); let lp = 0, drop = 0, dv = 0;
      for (let i=0;i<d.length;i++){ lp += ((R()*2 - 1) - lp)*0.3; if (R() < 0.0015){ drop = 0.3 + R()*0.5; dv = 0.6 + R()*0.35; } drop *= 0.992; d[i] = lp*0.55 + drop*(R()*2 - 1)*dv; } }
    const rs = ctx.createBufferSource(); rs.buffer = rb; rs.loop = true;
    const rhp = ctx.createBiquadFilter(), rlp = ctx.createBiquadFilter(); rhp.type = 'highpass'; rhp.frequency.value = 350; rlp.type = 'lowpass'; rlp.frequency.value = 5000;
    rainG = ctx.createGain(); rainG.gain.value = 0; rs.connect(rhp).connect(rlp).connect(rainG).connect(mixG); rs.start();
    // wind: noise through a band that wanders slowly, rising and falling
    const ws = ctx.createBufferSource(); ws.buffer = noiseBuf; ws.loop = true;
    const wb = ctx.createBiquadFilter(); wb.type = 'bandpass'; wb.frequency.value = 420; wb.Q.value = 2.2;
    const wl = ctx.createOscillator(), wlg = ctx.createGain(); wl.frequency.value = 0.06; wlg.gain.value = 220; wl.connect(wlg).connect(wb.frequency);
    const wamp = ctx.createGain(), wa = ctx.createOscillator(), wag = ctx.createGain(); wamp.gain.value = 0.7; wa.frequency.value = 0.09; wag.gain.value = 0.3; wa.connect(wag).connect(wamp.gain);
    windG = ctx.createGain(); windG.gain.value = 0; ws.connect(wb).connect(wamp).connect(windG).connect(mixG); ws.start(); wl.start(); wa.start();
    // tape wobble shared by the keys
    wobble = ctx.createGain(); wobble.gain.value = 7; const wo = ctx.createOscillator(); wo.frequency.value = 0.35; wo.connect(wobble); wo.start();
    // a low drone on the song's key that thickens in ambient
    droneG = ctx.createGain(); droneG.gain.value = 0;
    const dl = ctx.createBiquadFilter(); dl.type = 'lowpass'; dl.frequency.value = 170; droneG.connect(dl).connect(mixG);
    drones = [[38, 0.6], [45, 0.35], [50, 0.18]].map(([m, g]) => { const o = ctx.createOscillator(); o.frequency.value = hz(m); const vg = ctx.createGain(); vg.gain.value = g; o.connect(vg).connect(droneG); o.start(); return o; });
    // vibraphone bus with its slow motor tremolo (the Wurlitzer and the organ use it too)
    vibesBus = ctx.createGain(); vibesBus.gain.value = 0.85; vibesBus.connect(musBus);
    const vt = ctx.createOscillator(), vtg = ctx.createGain(); vt.frequency.value = 5.2; vtg.gain.value = 0.14; vt.connect(vtg).connect(vibesBus.gain); vt.start();
    // ping-pong echo, darker on every repeat (timed to the track: a dotted eighth)
    echoIn = ctx.createGain(); echoL = ctx.createDelay(1.5); echoR = ctx.createDelay(1.5); echoL.delayTime.value = echoR.delayTime.value = 0.4;
    const eLP = ctx.createBiquadFilter(), eLP2 = ctx.createBiquadFilter(), fbA = ctx.createGain(), fbB = ctx.createGain(), pl = ctx.createStereoPanner(), pr = ctx.createStereoPanner(), wet = ctx.createGain();
    eLP.type = eLP2.type = 'lowpass'; eLP.frequency.value = eLP2.frequency.value = 2500; fbA.gain.value = fbB.gain.value = 0.35; pl.pan.value = -0.75; pr.pan.value = 0.75; wet.gain.value = 0.8;
    echoIn.connect(echoL).connect(eLP).connect(pl).connect(wet); eLP.connect(fbA).connect(echoR).connect(eLP2).connect(pr).connect(wet); eLP2.connect(fbB).connect(echoL);
    wet.connect(musBus);
    // the synthwave arpeggio: one soft filter, and a send into the echo
    arpBus = ctx.createGain(); const al = ctx.createBiquadFilter(), ae = ctx.createGain(); al.type = 'lowpass'; al.frequency.value = 1500; al.Q.value = 1;
    arpBus.connect(al).connect(musBus); ae.gain.value = 0.5; al.connect(ae).connect(echoIn);
    // wave shapes, made once: a flute (breathy, few harmonics), an ocarina (almost a sine) and a drawbar organ
    WAVES = { flute:wave([1, 0.32, 0.1, 0.04]), ocarina:wave([1, 0.06, 0.02]), organ:wave([1, 0.62, 0.32, 0.22, 0, 0.1, 0, 0.06]) };
  }
  // (live counts the notes still sounding: optional notes are skipped when too many ring at once)
  const tidy = (src, nodes) => { const on = !offline; if (on) live++; src.onended = () => { if (on) live--; for (const n of nodes) try { n.disconnect(); } catch (e) {} }; };
  // The notes of the song being dealt that can ring on (chords, pads, the pedal, the choir, bass and low sines): a skip fades
  // them out, so the last song does not sound on under the next one in its old key. (g: the note's envelope; t, end: its start and stop)
  function held(g, t, end){
    if (offline || !T) return;
    T.held.push({ g, t, end });
    if (T.held.length > 96){ const now = ctx.currentTime; T.held = T.held.filter(h => h.end > now); }
  }
  function release(list, t){
    for (const h of list){
      if (h.end <= t) continue;
      const a = h.g.gain, v = h.t >= t ? 0 : a.value;   // (a note that has not started yet never sounds)
      a.cancelScheduledValues(t); a.setValueAtTime(v, t); a.setTargetAtTime(0, t, 0.1);
    }
  }
  function noise(t, dur, v, type, f, q, out, send = 0, att = 0){
    v *= vel*(out === drumBus ? mx('drums') : 1);
    const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.playbackRate.value = 0.9 + R()*0.2;
    const fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q;
    const g = ctx.createGain();
    if (att){ g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + att); } else g.gain.setValueAtTime(v, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(fl).connect(g).connect(out); if (send){ const sg = ctx.createGain(); sg.gain.value = send; g.connect(sg).connect(verbSend); }
    s.start(t, R()*1.5); s.stop(t + dur + 0.05); tidy(s, [s, fl, g]);
  }
  // ---------------------------------------------------------------- drums
  // kicks: [pitch from, pitch to (Hz), decay (s), click, level]; each about as loud as the others
  const KICKS = { dusty:[115, 44, 0.42, 0.25, 1], soft:[100, 48, 0.3, 0.12, 1.12], deep:[84, 41, 0.55, 0.15, 1], tight:[128, 52, 0.26, 0.3, 1.13] };
  function kick(t, v, K = KICKS.dusty){
    const [f0, f1, dec, click, gk] = K, o = ctx.createOscillator(), g = ctx.createGain(); v *= gk;
    o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + 0.13);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v*vel*mx('kick'), t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + dec);
    o.connect(g).connect(drumBus); o.start(t); o.stop(t + dec + 0.03); tidy(o, [o, g]);
    noise(t, 0.012, v*click, 'highpass', 2500, 0.5, drumBus);
  }
  function snare(t, v, soft){
    noise(t, soft ? 0.16 : 0.2, v, 'bandpass', soft ? 1500 : 1900, 0.8, drumBus, 0.25);
    const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'triangle'; o.frequency.setValueAtTime(190, t); o.frequency.exponentialRampToValueAtTime(140, t + 0.08);
    g.gain.setValueAtTime(v*0.5*vel*mx('drums'), t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.1); o.connect(g).connect(drumBus); o.start(t); o.stop(t + 0.12); tidy(o, [o, g]);
  }
  function clap(t, v){ for (let k=0;k<3;k++) noise(t + k*0.011, 0.07 + (k === 2 ? 0.12 : 0), v*(k === 2 ? 1 : 0.6), 'bandpass', 1300, 1.2, drumBus, 0.35); }
  // a cross-stick on the rim, a brush on the snare, a finger snap
  function rim(t, v){
    noise(t, 0.03, v*0.7, 'bandpass', 2300, 2.5, drumBus, 0.2);
    const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'triangle'; o.frequency.setValueAtTime(560, t); o.frequency.exponentialRampToValueAtTime(470, t + 0.03);
    g.gain.setValueAtTime(v*0.45*vel*mx('drums'), t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05); o.connect(g).connect(drumBus); o.start(t); o.stop(t + 0.06); tidy(o, [o, g]);
  }
  const brush = (t, v) => noise(t, 0.24, v, 'bandpass', 3000, 0.5, drumBus, 0.2, 0.012);
  const snap = (t, v) => noise(t, 0.08, v, 'bandpass', 2900, 1.6, drumBus, 0.4);
  // the backbeat on 2 and 4 (or on 3), in the song's sound
  function backbeat(t, v, kind){
    if (kind === 'rim') rim(t, v*1.8); else if (kind === 'brush') brush(t, v*0.56); else if (kind === 'snap') snap(t, v*1.5); else if (kind === 'clap') clap(t, v*1.45); else snare(t, v, true);
  }
  // hi-hats: [closed, open (Hz), closed decay (s), level]
  const HATS = { bright:[7800, 6500, 0.045, 1], dark:[5600, 5000, 0.06, 0.72], tick:[9800, 8000, 0.028, 1.66] };
  function hat(t, v, open, H = HATS.bright){ noise(t, open ? 0.28 : H[2], v*H[3], 'highpass', open ? H[1] : H[0], 0.7, drumBus, open ? 0.15 : 0); }
  const shaker = (t, v) => noise(t, 0.075, v, 'bandpass', 6000, 1.2, drumBus, 0, 0.02);
  // hand percussion: a conga (tuned in MIDI notes), a wood block, a soft tom for fills
  function drumTone(t, f0, f1, ft, dec, v, send = 0){
    const o = ctx.createOscillator(), g = ctx.createGain(); v *= mx('drums');
    o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + ft);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v*vel, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + dec);
    o.connect(g).connect(drumBus); const nodes = [o, g];
    if (send){ const sg = ctx.createGain(); sg.gain.value = send; g.connect(sg).connect(verbSend); nodes.push(sg); }
    o.start(t); o.stop(t + dec + 0.02); tidy(o, nodes);
  }
  const conga = (t, m, v) => { drumTone(t, hz(m)*1.25, hz(m), 0.03, 0.26, v, 0.15); noise(t, 0.015, v*0.3, 'bandpass', 3000, 1, drumBus); };
  const block = (t, v) => { drumTone(t, 1250, 1180, 0.02, 0.07, v*0.6, 0.2); noise(t, 0.012, v*0.4, 'bandpass', 2000, 3, drumBus); };
  const tom = (t, m, v) => drumTone(t, hz(m)*1.6, hz(m), 0.09, 0.5, v, 0.3);
  // ---------------------------------------------------------------- keys, basses and pads
  // FM electric pianos. rhodes: a round tine with a bright attack; wurli: reedier and shorter, through the vibes bus's tremolo
  const EP = { rhodes:{ i0:1.6, i1:0.12, it:0.6, lp:2400, sus:0.45, g:1 }, wurli:{ i0:2.4, i1:0.35, it:0.3, lp:1800, sus:0.3, g:1.35, trem:1 } };
  function ep(t, m, dur, v, pan = 0, E = EP.rhodes){
    v *= vel*E.g;
    const f = hz(m), car = ctx.createOscillator(), mod = ctx.createOscillator(), mg = ctx.createGain(), g = ctx.createGain(), p = ctx.createStereoPanner(), lp = ctx.createBiquadFilter();
    car.frequency.value = f; mod.frequency.value = f; mg.gain.setValueAtTime(f*E.i0, t); mg.gain.exponentialRampToValueAtTime(f*E.i1, t + E.it);
    mod.connect(mg).connect(car.frequency); wobble.connect(car.detune);
    lp.type = 'lowpass'; lp.frequency.value = E.lp;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + 0.006); g.gain.exponentialRampToValueAtTime(v*E.sus, t + 0.5); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 1.1);
    p.pan.value = pan; car.connect(lp).connect(g).connect(p).connect(E.trem ? vibesBus : musBus); held(g, t, t + dur + 1.2);
    car.start(t); mod.start(t); car.stop(t + dur + 1.2); mod.stop(t + dur + 1.2); const on = !offline; if (on) live++;
    car.onended = () => { if (on) live--; try { wobble.disconnect(car.detune); } catch (e) {} for (const n of [car, mod, mg, g, p, lp]) try { n.disconnect(); } catch (e) {} };
  }
  // a soft organ: one drawbar wave per note, through the same slow tremolo
  function organ(t, m, dur, v, pan = 0){
    v *= vel;
    const o = ctx.createOscillator(), g = ctx.createGain(), p = ctx.createStereoPanner(), end = t + Math.max(dur, 0.05);
    o.setPeriodicWave(WAVES.organ); o.frequency.value = hz(m);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + 0.03); g.gain.setValueAtTime(v, end); g.gain.linearRampToValueAtTime(0, end + 0.25);
    p.pan.value = pan; o.connect(g).connect(p).connect(vibesBus); o.start(t); o.stop(end + 0.3); tidy(o, [o, g, p]); held(g, t, end + 0.3);
  }
  function bass(t, m, dur, v){
    v *= vel;
    const o = ctx.createOscillator(), o2 = ctx.createOscillator(), lp = ctx.createBiquadFilter(), g = ctx.createGain();
    o.type = 'sine'; o.frequency.value = hz(m); o2.type = 'triangle'; o2.frequency.value = hz(m); lp.type = 'lowpass'; lp.frequency.value = 420;
    const g2 = ctx.createGain(); g2.gain.value = 0.35; o2.connect(g2).connect(lp); o.connect(lp);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + 0.01); g.gain.setValueAtTime(v, t + Math.max(dur - 0.06, 0.02)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.08);
    lp.connect(g).connect(duck); o.start(t); o2.start(t); o.stop(t + dur + 0.1); o2.stop(t + dur + 0.1); tidy(o, [o, o2, g2, lp, g]); held(g, t, t + dur + 0.1);
  }
  // a finger-plucked bass: it starts a little sharp and settles, and fades as it holds
  function upright(t, m, dur, v){
    v *= vel;
    const f = hz(m), o = ctx.createOscillator(), o2 = ctx.createOscillator(), g2 = ctx.createGain(), lp = ctx.createBiquadFilter(), g = ctx.createGain(), end = t + Math.max(dur, 0.12);
    o2.type = 'triangle'; g2.gain.value = 0.45; lp.type = 'lowpass'; lp.frequency.setValueAtTime(1000, t); lp.frequency.exponentialRampToValueAtTime(400, t + 0.3);
    for (const x of [o, o2]){ x.frequency.setValueAtTime(f*1.006, t); x.frequency.exponentialRampToValueAtTime(f, t + 0.05); }
    o.connect(lp); o2.connect(g2).connect(lp);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + 0.008); g.gain.setTargetAtTime(v*0.4, t + 0.008, 0.4); g.gain.setTargetAtTime(0, end, 0.05);
    lp.connect(g).connect(duck); for (const x of [o, o2]){ x.start(t); x.stop(end + 0.3); } tidy(o, [o, o2, g2, lp, g]); held(g, t, end + 0.3);
  }
  // a synth bass: a saw whose filter closes quickly, over a sine
  function synthBass(t, m, dur, v){
    v *= vel;
    const f = hz(m), o = ctx.createOscillator(), s = ctx.createOscillator(), lp = ctx.createBiquadFilter(), sg = ctx.createGain(), og = ctx.createGain(), g = ctx.createGain();
    o.type = 'sawtooth'; o.frequency.value = f; s.frequency.value = f; lp.type = 'lowpass'; lp.Q.value = 1.5; lp.frequency.setValueAtTime(1000, t); lp.frequency.exponentialRampToValueAtTime(240, t + 0.18);
    og.gain.value = 0.35; sg.gain.value = 0.8; o.connect(lp).connect(og).connect(g); s.connect(sg).connect(g);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + 0.008); g.gain.setValueAtTime(v, t + Math.max(dur - 0.05, 0.02)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.08);
    g.connect(duck); for (const x of [o, s]){ x.start(t); x.stop(t + dur + 0.1); } tidy(o, [o, s, lp, sg, og, g]); held(g, t, t + dur + 0.1);
  }
  // pad: saws (and a sine an octave down) through a soft filter, slow in and out. strings: no low sine and a quicker bow;
  // brass: the filter opens as the chord swells (synthwave)
  function pad(t, notes, dur, v, cutoff = 900, kind = ''){
    v *= vel;
    notes.forEach(m => {
      const f = hz(m), g = ctx.createGain(), flt = ctx.createBiquadFilter(), pan = ctx.createStereoPanner(), fc = cutoff*(0.8 + 0.4*R());
      flt.type = 'lowpass'; flt.Q.value = 0.5;
      if (kind === 'brass'){ flt.frequency.setValueAtTime(fc*0.35, t); flt.frequency.linearRampToValueAtTime(fc, t + Math.min(dur*0.5, 2.5)); } else flt.frequency.value = fc;
      pan.pan.value = (R()*2 - 1)*0.6;
      // (the sine an octave down fades out below about 160 Hz: under a low chord it only hummed)
      const sg = ctx.createGain(); sg.gain.value = Math.max(0.2, Math.min(1, Math.pow(f/320, 1.5)));
      const oscs = (kind ? [['sawtooth', -7 - R()*4], ['sawtooth', 7 + R()*4]] : [['sawtooth', -6 - R()*4], ['sawtooth', 6 + R()*4], ['sine', 0]])
        .map(([type, det]) => { const o = ctx.createOscillator(); o.type = type; o.frequency.value = type === 'sine' ? f/2 : f; o.detune.value = det; o.connect(type === 'sine' ? sg : flt); return o; });
      sg.connect(flt); flt.connect(g).connect(pan).connect(musBus);
      const att = kind === 'strings' ? Math.min(dur*0.3, 0.8 + R()*0.8) : Math.min(dur*0.3, 3 + R()*3), peak = v*(0.8 + 0.4*R());
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(peak, t + att); g.gain.setValueAtTime(peak, t + Math.max(dur - 1.5, att)); g.gain.linearRampToValueAtTime(0, t + dur + 1.5);
      for (const o of oscs){ o.start(t); o.stop(t + dur + 1.6); }
      tidy(oscs[0], [...oscs, sg, flt, g, pan]); held(g, t, t + dur + 1.6);
    });
  }
  // a warm pad: one soft triangle (or sine: 'glass') per note, slow in and out
  function warm(t, notes, dur, v, cutoff = 900, w = 'triangle'){
    v *= vel;
    for (const m of notes){
      const o = ctx.createOscillator(), lp = ctx.createBiquadFilter(), g = ctx.createGain(), p = ctx.createStereoPanner();
      o.type = w; o.frequency.value = hz(m); o.detune.value = (R() - 0.5)*8; lp.type = 'lowpass'; lp.frequency.value = cutoff; p.pan.value = (R()*2 - 1)*0.5;
      const att = Math.min(dur*0.35, 2);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + att); g.gain.setValueAtTime(v, t + Math.max(dur - 0.5, att)); g.gain.linearRampToValueAtTime(0, t + dur + 1.5);
      o.connect(lp).connect(g).connect(p).connect(musBus); o.start(t); o.stop(t + dur + 1.6); tidy(o, [o, lp, g, p]); held(g, t, t + dur + 1.6);
    }
  }
  // a soft "ooh" choir: two detuned saws and a triangle through the two formants of the vowel
  function choir(t, notes, dur, v){
    v *= vel;
    for (const m of notes){
      const f = hz(m), env = ctx.createGain(), p = ctx.createStereoPanner(), sg = ctx.createGain(), vib = ctx.createOscillator(), vg = ctx.createGain();
      const [f1, f2, lo] = [['bandpass', 330, 3.5], ['bandpass', 820, 5], ['lowpass', 480, 0.5]].map(([ty, fr, q]) => { const b = ctx.createBiquadFilter(); b.type = ty; b.frequency.value = fr; b.Q.value = q; return b; });
      const [g1, g2, g3] = [1, 0.35, 0.5].map(x => { const g = ctx.createGain(); g.gain.value = x; return g; });
      vib.frequency.value = 4.6 + R()*0.8; vg.gain.value = 7; vib.connect(vg);
      const oscs = [['sawtooth', -7], ['sawtooth', 7], ['triangle', 0]].map(([ty, d]) => { const o = ctx.createOscillator(); o.type = ty; o.frequency.value = f; o.detune.value = d + (R() - 0.5)*4; vg.connect(o.detune); o.connect(f1); o.connect(f2); o.connect(lo); return o; });
      f1.connect(g1).connect(env); f2.connect(g2).connect(env); lo.connect(g3).connect(env);
      const att = Math.min(1.6, dur*0.4);
      env.gain.setValueAtTime(0, t); env.gain.linearRampToValueAtTime(v, t + att); env.gain.setValueAtTime(v, t + Math.max(dur - 0.5, att)); env.gain.linearRampToValueAtTime(0, t + dur + 1.6);
      p.pan.value = (R()*2 - 1)*0.5; sg.gain.value = 0.6; env.connect(p).connect(musBus); p.connect(sg).connect(verbSend);
      for (const o of [...oscs, vib]){ o.start(t); o.stop(t + dur + 1.7); }
      tidy(oscs[0], [...oscs, vib, vg, f1, f2, lo, g1, g2, g3, env, p, sg]); held(env, t, t + dur + 1.7);
    }
  }
  // a pad chord in one of the pad sounds, each at about the saw pad's loudness for the same v
  function padChord(kind, t, notes, dur, v, cutoff){
    v *= mx('pad');
    if (kind === 'choir') choir(t, notes.slice(0, 4), dur, v*1.1);
    else if (kind === 'glass') warm(t, notes, dur, v*1.17, 2400, 'sine');
    else if (kind === 'warm') warm(t, notes, dur, v*1.31, cutoff);
    else if (kind === 'strings' || kind === 'brass') pad(t, notes, dur, v*(kind === 'brass' ? 1.25 : 1.22), cutoff*1.4, kind);
    else if (kind !== 'none') pad(t, notes, dur, v, cutoff);
  }
  // a soft sine under the chord's root (ambient): very slow in and out, so it is felt more than heard, dry and in the middle,
  // no random draws
  function subPad(t, m, dur, v){
    v *= vel*mx('root');
    const o = ctx.createOscillator(), g = ctx.createGain(), att = Math.min(4, dur*0.4); o.frequency.value = hz(m);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + att); g.gain.setValueAtTime(v, t + Math.max(dur - 2, att)); g.gain.linearRampToValueAtTime(0, t + dur + 3);
    o.connect(g).connect(duck); o.start(t); o.stop(t + dur + 3.1); tidy(o, [o, g]); held(g, t, t + dur + 3.1);
  }
  // a sine sub bass that can slide in from the last note (downtempo)
  function sub(t, m, dur, v, from){
    v *= vel;
    const o = ctx.createOscillator(), o2 = ctx.createOscillator(), lp = ctx.createBiquadFilter(), g2 = ctx.createGain(), g = ctx.createGain();
    o2.type = 'triangle'; lp.type = 'lowpass'; lp.frequency.value = 380; g2.gain.value = 0.25;
    for (const x of [o, o2]){ if (from){ x.frequency.setValueAtTime(hz(from), t); x.frequency.exponentialRampToValueAtTime(hz(m), t + 0.09); } else x.frequency.value = hz(m); }
    o.connect(lp); o2.connect(g2).connect(lp);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + 0.02); g.gain.setValueAtTime(v, t + Math.max(dur - 0.06, 0.03)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.12);
    lp.connect(g).connect(duck); o.start(t); o2.start(t); o.stop(t + dur + 0.15); o2.stop(t + dur + 0.15); tidy(o, [o, o2, lp, g2, g]); held(g, t, t + dur + 0.15);
  }
  // the song's bass sound, each about as strong as the round bass for the same v
  const BASSG = { round:1, upright:1.36, sub:1.08, synth:1.27 };
  function bassNote(t, m, dur, v, from){
    const k = T.bassI || 'round', vv = v*BASSG[k]*mx('bass');
    if (k === 'sub') sub(t, m, dur, vv, from); else if (k === 'upright') upright(t, m, dur, vv); else if (k === 'synth') synthBass(t, m, dur, vv); else bass(t, m, dur, vv);
  }
  // ---------------------------------------------------------------- leads
  // felt piano: slightly stretched partials that fade faster the higher they are, two strings beating slowly on the
  // fundamental, a soft attack and the thump of the felt. The pedal comes up after dur (at the chord change).
  const PIANO_AMP = [1, 0.42, 0.22, 0.12, 0.07, 0.045, 0.03, 0.02];
  function piano(t, m, dur, v, pan){
    const f = hz(m), g = ctx.createGain(), lp = ctx.createBiquadFilter(), p = ctx.createStereoPanner(), sg = ctx.createGain(), nodes = [g, lp, p, sg];
    const ring = 4.2*Math.min(1.5, Math.max(0.5, 1.5 - (m - 45)/40)), n = Math.min(IS_SMALL ? 4 : 8, Math.max(3, Math.floor(3200/f)));
    const end = t + Math.min(dur, ring); let src = null;
    for (let k = 1; k <= n; k++){
      const fk = k*f*Math.sqrt(1 + 0.0004*k*k), d = ring/Math.pow(k, 0.7), stop = Math.min(t + d, end + 0.4);
      for (const det of k === 1 ? [0, 1.1] : [0]){
        const o = ctx.createOscillator(), og = ctx.createGain(), a = PIANO_AMP[k - 1]*(det ? 0.5 : 1);
        o.frequency.value = fk; o.detune.value = det;
        og.gain.setValueAtTime(0, t); og.gain.linearRampToValueAtTime(a, t + 0.007 + 0.002*k); og.gain.exponentialRampToValueAtTime(0.0001, t + d);
        o.connect(og).connect(g); o.start(t); o.stop(stop); nodes.push(o, og); if (!src) src = o;
      }
    }
    lp.type = 'lowpass'; lp.Q.value = 0.3; lp.frequency.value = 1200 + 1800*Math.min(1, v/0.05);
    g.gain.setValueAtTime(v*0.45*vel, t); g.gain.setValueAtTime(v*0.45*vel, end); g.gain.exponentialRampToValueAtTime(0.0001, end + 0.35);
    p.pan.value = pan === undefined ? Math.max(-0.6, Math.min(0.6, (m - 62)/28)) : pan; sg.gain.value = 0.55;
    g.connect(lp).connect(p).connect(musBus); p.connect(sg).connect(verbSend);
    tidy(src, nodes); held(g, t, end + 0.4);
    noise(t, 0.03, v*0.12, 'lowpass', 420, 0.7, musBus);   // the felt
  }
  // soft leads: one or two oscillators, a gentle attack and vibrato. sine: a triangle with a sine an octave up; flute: breathy,
  // its vibrato comes in late; ocarina: almost a sine; square: a filtered square; saw: two detuned saws through a filter
  const LEADS = {
    sine:{ w:'triangle', o2:0.25, att:0.04, vib:9, vr:5, verb:0.7, g:1 },
    flute:{ w:'flute', att:0.07, vib:13, vr:4.8, vd:0.25, breath:0.35, verb:0.8, g:0.93 },
    ocarina:{ w:'ocarina', att:0.05, vib:5, vr:5.5, verb:0.8, g:0.85 },
    square:{ w:'square', lp:1400, att:0.02, vib:7, vr:5.5, verb:0.6, g:0.68 },
    saw:{ w:'sawtooth', det:7, lp:1700, att:0.03, vib:8, vr:5, vd:0.2, verb:0.6, g:1.6 },
  };
  function tone(t, m, dur, v, pan, L){
    const b = v*(L.breath || 0); v *= vel*L.g;
    const f = hz(m), g = ctx.createGain(), p = ctx.createStereoPanner(), sg = ctx.createGain(), vib = ctx.createOscillator(), vg = ctx.createGain(), nodes = [g, p, sg, vib, vg], stop = t + dur + 0.35;
    let into = g, src = null;
    if (L.lp){ const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = L.lp; lp.Q.value = 0.7; lp.connect(g); into = lp; nodes.push(lp); }
    vib.frequency.value = L.vr; vib.connect(vg);
    if (L.vd){ vg.gain.setValueAtTime(0, t); vg.gain.linearRampToValueAtTime(L.vib, t + L.vd + 0.35); } else vg.gain.value = L.vib;
    const add = (fr, det, a, w) => {
      const o = ctx.createOscillator(); if (WAVES[w]) o.setPeriodicWave(WAVES[w]); else o.type = w;
      o.frequency.value = fr; o.detune.value = det; vg.connect(o.detune);
      if (a === 1) o.connect(into); else { const og = ctx.createGain(); og.gain.value = a; o.connect(og).connect(into); nodes.push(og); }
      o.start(t); o.stop(stop); nodes.push(o); if (!src) src = o;
    };
    if (L.det){ add(f, -L.det, 0.5, L.w); add(f, L.det, 0.5, L.w); } else add(f, 0, 1, L.w);
    if (L.o2) add(2*f, 0, L.o2, 'sine');
    vib.start(t); vib.stop(stop);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + L.att); g.gain.setValueAtTime(v, t + Math.max(dur*0.7, L.att)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.3);
    p.pan.value = pan; sg.gain.value = L.verb; g.connect(p).connect(musBus); p.connect(sg).connect(verbSend);
    tidy(src, nodes); held(g, t, stop);
    if (b) noise(t, 0.12, b, 'bandpass', Math.min(7000, f*2.5), 1.2, musBus, 0, 0.03);   // the breath
  }
  // struck bars: [partial ratio, level, decay (s)]. vibes rings for the note's length through the tremolo; the others fade on
  // their own, the higher the sooner. (A comb tine's partial is far out of tune, as a free bar's is.)
  const MALLETS = {
    vibes:{ p:[[1, 1, 2.4], [4, 0.18, 0.5], [10, 0.04, 0.12]], hold:1, trem:1, verb:0.45, g:1 },
    marimba:{ p:[[1, 1, 0.8], [3.93, 0.22, 0.1]], verb:0.35, g:1.93 },
    musicbox:{ p:[[1, 1, 1.5], [6.27, 0.1, 0.2]], verb:0.55, g:1.46 },
    kalimba:{ p:[[1, 1, 1.2], [3.01, 0.05, 0.25], [6.27, 0.12, 0.05]], verb:0.45, g:1.57 },
    glock:{ p:[[1, 1, 2], [2.76, 0.22, 0.45], [5.4, 0.08, 0.15]], verb:0.55, g:1.27 },
  };
  function mallet(t, m, dur, v, pan = 0, echo = 0, M = MALLETS.vibes){
    v *= vel*M.g;
    const f = hz(m), g = ctx.createGain(), p = ctx.createStereoPanner(), sg = ctx.createGain(), nodes = [g, p, sg], sc = M.hold ? 1 : Math.min(1.5, Math.max(0.5, 1.4 - (m - 60)/40));
    let src = null, end = t + 0.1;
    for (const [r, a, d0] of M.p){
      if (f*r > 8500) continue;
      const d = d0*sc + (M.hold && r === 1 ? dur : 0), o = ctx.createOscillator(), og = ctx.createGain(); o.frequency.value = f*r;
      og.gain.setValueAtTime(0.0001, t); og.gain.exponentialRampToValueAtTime(a, t + 0.004); og.gain.exponentialRampToValueAtTime(0.0001, t + d);
      o.connect(og).connect(g); o.start(t); o.stop(t + d + 0.02); nodes.push(o, og); if (!src) src = o; end = Math.max(end, t + d + 0.02);
    }
    g.gain.value = v; p.pan.value = pan; sg.gain.value = M.verb; g.connect(p).connect(M.trem ? vibesBus : musBus); p.connect(sg).connect(verbSend);
    if (echo){ const eg = ctx.createGain(); eg.gain.value = echo; p.connect(eg).connect(echoIn); nodes.push(eg); }
    tidy(src, nodes); held(g, t, end);
  }
  const vibes = (t, m, dur, v, pan, echo) => mallet(t, m, dur, v, pan, echo, MALLETS.vibes);
  // plucked strings: a saw through a filter that closes. house: the bright chill house pluck; guitar: a muted electric guitar
  const PLUCKS = { house:{ w:'sawtooth', q:4, f0:3200, f1:300, ft:0.22, dec:0.35, verb:0.5, g:1 }, guitar:{ w:'sawtooth', q:0.8, k0:6, k1:1.5, ft:0.12, dec:0.9, verb:0.3, g:1 } };
  function pluck(t, m, v, P = PLUCKS.house, pan = null, dur = 0){
    v *= vel*P.g;
    const f = hz(m), o = ctx.createOscillator(), lp = ctx.createBiquadFilter(), g = ctx.createGain(), p = ctx.createStereoPanner(), sg = ctx.createGain();
    const end = t + (dur ? Math.min(Math.max(dur, 0.25), P.dec*2.4) : P.dec);
    o.type = P.w; o.frequency.value = f; lp.type = 'lowpass'; lp.Q.value = P.q;
    lp.frequency.setValueAtTime(P.k0 ? Math.min(9000, f*P.k0) : P.f0, t); lp.frequency.exponentialRampToValueAtTime(P.k1 ? f*P.k1 : P.f1, t + P.ft);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, end);
    p.pan.value = pan === null ? (R()*2 - 1)*0.5 : pan; o.connect(lp).connect(g).connect(p).connect(musBus); sg.gain.value = P.verb; p.connect(sg).connect(verbSend);
    o.start(t); o.stop(end + 0.05); tidy(o, [o, lp, g, p, sg]);
  }
  function bell(t, m, amp){
    amp *= vel;
    const f = hz(m), car = ctx.createOscillator(), mod = ctx.createOscillator(), mg = ctx.createGain(), g = ctx.createGain(), pan = ctx.createStereoPanner();
    car.frequency.value = f; mod.frequency.value = f*3.5; mg.gain.setValueAtTime(f*1.2, t); mg.gain.exponentialRampToValueAtTime(f*0.05, t + 2.5);
    mod.connect(mg).connect(car.frequency);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(amp, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + 5.5);
    pan.pan.value = (R()*2 - 1)*0.8; car.connect(g).connect(pan); pan.connect(verbSend);
    const dry = ctx.createGain(); dry.gain.value = 0.25; pan.connect(dry).connect(mixG);
    car.start(t); mod.start(t); car.stop(t + 6); mod.stop(t + 6); tidy(car, [car, mod, mg, g, pan, dry]); held(g, t, t + 6);
  }
  // synthwave: a soft arpeggio (square, triangle or saw) into the echo
  function arp(t, m, v, pan, w = 'square'){
    v *= vel*(w === 'triangle' ? 1.42 : w === 'sawtooth' ? 1.7 : 1);
    const o = ctx.createOscillator(), g = ctx.createGain(), p = ctx.createStereoPanner();
    o.type = w; o.frequency.value = hz(m);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + 0.003); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
    p.pan.value = pan; o.connect(g).connect(p).connect(arpBus);
    o.start(t); o.stop(t + 0.27); tidy(o, [o, g, p]);
  }
  // Every lead and counter instrument by name, at a level where each is about as loud as the sine lead for the same v.
  // REG: how far up it plays (a music box and a glockenspiel an octave above the tune).
  const LEAD = {
    sine:(t, m, d, v, p) => tone(t, m, d, v, p, LEADS.sine),
    flute:(t, m, d, v, p) => tone(t, m, d, v, p, LEADS.flute),
    ocarina:(t, m, d, v, p) => tone(t, m, d, v, p, LEADS.ocarina),
    square:(t, m, d, v, p) => tone(t, m, d, v, p, LEADS.square),
    saw:(t, m, d, v, p) => tone(t, m, d, v, p, LEADS.saw),
    vibes:(t, m, d, v, p) => mallet(t, m, d, v*1.25, p, 0.25, MALLETS.vibes),
    marimba:(t, m, d, v, p) => mallet(t, m, d, v, p, 0.15, MALLETS.marimba),
    musicbox:(t, m, d, v, p) => mallet(t, m, d, v, p, 0.2, MALLETS.musicbox),
    kalimba:(t, m, d, v, p) => mallet(t, m, d, v, p, 0.15, MALLETS.kalimba),
    glock:(t, m, d, v, p) => mallet(t, m, d, v, p, 0.2, MALLETS.glock),
    piano:(t, m, d, v, p) => piano(t, m, d + 1.2, v*1.36, p),
    rhodes:(t, m, d, v, p) => ep(t, m, d, v, p, EP.rhodes),
    guitar:(t, m, d, v, p) => pluck(t, m, v*3.3, PLUCKS.guitar, p, d),
    bell:(t, m, d, v, p) => bell(t, m, v*0.81),
    hum:(t, m, d, v, p) => choir(t, [m], d + 0.3, v*0.5),
    warm:(t, m, d, v, p) => warm(t, [m], d, v*0.5, 1400),
  };
  const REG = { musicbox:12, glock:12, bell:12 };
  const lead = (name, t, m, dur, v, pan = 0.2) => { if (LEAD[name]) LEAD[name](t, m + (REG[name] || 0), dur, v*mx('lead'), pan); };
  // tape hiss for one song (it fades out early if the next song starts sooner)
  let hissNow = null;
  function hiss(t, dur, v){
    const s = ctx.createBufferSource(), hp = ctx.createBiquadFilter(), lp = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = noiseBuf; s.loop = true; hp.type = 'highpass'; hp.frequency.value = 1800; lp.type = 'lowpass'; lp.frequency.value = 7000;
    g.gain.value = 0;   // (a gain starts at 1: if its events are cancelled before t, it must not come back to full noise)
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + 2); g.gain.setValueAtTime(v, t + Math.max(dur - 2, 2)); g.gain.linearRampToValueAtTime(0, t + dur + 1);
    s.connect(hp).connect(lp).connect(g).connect(mixG); s.start(t); s.stop(t + dur + 1.1); tidy(s, [s, hp, lp, g]);
    hissNow = { s, g, start:t, end:t + dur + 1.1 };
  }
  // ---------------------------------------------------------------- the sequencer: sixteenth notes, scheduled a little ahead
  function play(t){
    if (T && solo && step >= T.sections.length*16){ soloEnd(); return 3600; }   // (one song on its own ends with it)
    if (!T || step >= T.sections.length*16){ newTrack(t); }
    if (T.mainR && step === T.introEnd*16){ R = T.mainR; T.mainR = null; }
    const s = step % 16, bar = Math.floor(step/16), sec = T.sections[bar];
    const sd = 60/(T.drift ? T.bpm*(1 + T.drift*Math.sin(bar*0.45 + T.driftPh)) : T.bpm)/4;
    // swing: every odd sixteenth comes a little late
    const swing = s % 2 ? sd*T.swing : 0, hum = () => (R() - 0.5)*0.008, tt = t + swing;
    const ch = T.chords[bar], root = ch.root, type = ch.type, chordStart = ch.start && s === 0;
    if (chordStart) T.cur = [root, type];
    const lastBar = bar === T.sections.length - 1;
    // the drum filter opens through the intro and closes for breakdowns and the outro; a muffled song opens up the same way
    if (s === 0){
      const target = sec === 'intro' ? 900 + 9000*Math.pow(bar/Math.max(T.introEnd, 1), 2) : sec === 'break' ? 700 : sec === 'outro' ? 1400 : 12000;
      drumLP.frequency.setTargetAtTime(Math.min(target, 12000), t, 0.6);
      if (T.muffle) musLP.frequency.setTargetAtTime(sec === 'intro' ? 600*Math.pow(30, (bar + 1)/Math.max(T.introEnd, 1)) : sec === 'break' ? 1600 : 20000, t, 0.5);
    }
    STYLES[T.style].step({ t, tt, sd, s, bar, sec, root, type, chordStart, lastBar, hum, k:ch.k, left:chordLeft(bar, s, sd), n:T.sections.length });
    step++;
    return sd;
  }
  // ---------------------------------------------------------------- parts the styles share
  // a chord on the song's keys, each about as loud as the Rhodes for the same v (up: strummed from the top)
  const KEYG = { rhodes:1, wurli:1, piano:1.45, guitar:1.95, organ:0.52 };
  function hit(t, notes, dur, v, inst, up){
    const L = notes.length; v *= KEYG[inst]*mx('keys');
    for (let j = 0; j < L; j++){
      const i = up ? L - 1 - j : j, m = notes[i], pan = L > 1 ? (i/(L - 1) - 0.5)*0.5 : 0, vv = v*(0.85 + 0.3*R()), dt = (R() - 0.5)*0.008;
      if (inst === 'guitar') pluck(t + j*0.022, m, vv, PLUCKS.guitar, pan, dur);
      else if (inst === 'piano') piano(t + j*0.018 + dt, m, dur, vv, pan);
      else if (inst === 'organ') organ(t + j*0.004, m, dur, vv, pan);
      else ep(t + j*0.012 + dt, m, dur, vv, pan, EP[inst]);
    }
  }
  // the keys' rhythm. held: the chord on its bar, now and then a softer stab on the and of 3; push: the chord comes an eighth
  // early, on the and of 4; pulse: short chords on 1 and the and of 2; arp: the chord broken upward; strum (guitar): down on 1,
  // up on 3; bar: the chord on every bar, softer when it is not new (downtempo)
  function comp(c, lo, hi, v){
    const { t, tt, sd, s, bar, sec, root, type, chordStart, left } = c, inst = T.keys;
    switch (T.comp){
      case 'push': {
        const nx = T.chords[bar + 1];
        if (s === 14 && nx && nx.start){ hit(tt, voice(nx.root, nx.type, lo, hi), chordLeft(bar + 1, 0, sd)*0.9 + sd*2, v, inst); T.pushed = bar + 1; }
        else if (chordStart && T.pushed !== bar) hit(t, voice(root, type, lo, hi), left*0.9, v, inst);
        if (s === 8 && !chordStart && sec !== 'break' && !busy() && R() < 0.3) hit(tt, voice(root, type, lo + 3, hi + 1).slice(1), sd*3, v*0.55, inst);
        break;
      }
      case 'pulse':
        if (s === 0 || s === 6 || (s === 10 && R() < 0.4)) hit(s ? tt : t, voice(root, type, lo, hi), sd*(s ? 3 : 5), v*(s ? 0.7 : 0.9), inst);
        break;
      case 'arp':
        if (s === 0 || s === 3 || s === 6 || s === 10){ const vs = voice(root, type, lo, hi), i = [0, 3, 6, 10].indexOf(s); hit(s ? tt : t, [vs[(i + bar % 2) % vs.length]], Math.min(left, sd*12), v*1.1, inst); }
        break;
      case 'strum':
        if (s === 0) hit(t, voice(root, type, lo, hi), Math.min(left, sd*8), v, inst);
        else if (s === 8) hit(tt, voice(root, type, lo, hi).slice(-3), sd*6, v*0.6, inst, true);
        else if (s === 14 && R() < 0.3) hit(tt, voice(root, type, lo, hi).slice(-2), sd*2, v*0.4, inst, true);
        break;
      case 'bar':
        if (s === 0) hit(t, voice(root, type, lo, hi), Math.min(left, sd*16)*0.95, chordStart ? v : v*0.83, inst);
        if (s === 10 && (bar % 2) && sec !== 'break' && bar < T.sections.length - 2 && R() < 0.35) hit(tt, voiceNR(root, type, lo + 3, hi + 2), sd*4, v*0.6, inst);
        break;
      default:   // held
        if (chordStart) hit(t, voice(root, type, lo, hi), left*0.9, v, inst);
        if (s === 10 && sec !== 'break' && R() < 0.5) hit(tt, voice(root, type, lo + 3, hi + 1).slice(1), sd*5, v*0.6, inst);
    }
  }
  // hats: eighths (with now and then a sixteenth), sixteenths, a shaker or quarters (the offbeats)
  function hats(c, g){
    const { tt, s, hum } = c, H = HATS[T.hatTone] || HATS.bright;
    switch (T.hats){
      case 'sixteenths': hat(tt + hum(), (s % 4 === 2 ? 0.08 : s % 2 ? 0.035 : 0.052)*(0.7 + 0.6*R())*g, false, H); break;
      case 'shaker': if (s % 2 === 0 || R() < 0.3) shaker(tt + hum(), (s % 4 === 2 ? 0.068 : 0.041)*(0.7 + 0.6*R())*g); break;
      case 'quarters': if (s % 4 === 2 || (s % 4 === 0 && R() < 0.3)) hat(tt + hum(), 0.072*(0.7 + 0.6*R())*g, false, H); break;
      default: if (s % 2 === 0 || R() < 0.25*(T.hatDensity || 0.7)) hat(tt + hum(), (s % 4 === 2 ? 0.085 : 0.05)*(0.6 + 0.8*R())*g, false, H);
    }
  }
  // a counter-line under the tune: the chord's third or seventh, held (guide)
  function counterLine(c, v){
    if (!c.chordStart || busy()) return;
    const m = guide(c.root, c.type, T.guidePrev || T.key + 16, T.key + 8, T.key + 22); T.guidePrev = m;
    lead(T.counterI, c.t + 0.02, m, c.left*0.9, v, -0.25);
  }
  // ---------------------------------------------------------------- lofi: dusty drums, jazzy keys, a lead tune
  function lofiStep(c){
    const { t, tt, sd, s, bar, sec, root, type, chordStart, lastBar, hum, k, left, n } = c;
    comp(c, 52, 71, 0.065);
    // bass: the root, then the fifth or the octave on 3 (root8); a step into the next chord (approach); or long notes (sparse)
    if (sec !== 'intro'){
      const r = low(root, 33, 46), nx = T.chords[bar + 1];
      if (T.bassPat === 'sparse'){ if (s === 0) bassNote(t, r, Math.min(left, sd*14), chordStart ? 0.135 : 0.115); if (s === 10 && R() < 0.4) bassNote(tt, r + 12, sd*2, 0.108); }
      else {
        if (chordStart) bassNote(t, r, sd*(T.bassPat === 'approach' ? 7 : 6), 0.18);
        if (s === 8 && sec !== 'break') bassNote(tt, r + (R() < 0.5 ? 7 : 12), sd*3, 0.126);
        if (T.bassPat === 'approach' && s === 14 && nx && nx.start && sec !== 'break'){ const to = low(nx.root, 33, 46); bassNote(tt, to + (R() < 0.5 ? -1 : 2)*(to > 34 ? 1 : -1), sd*2, 0.108); }
      }
    }
    if (sec !== 'break' && !(sec === 'outro' && bar > n - 3)){
      if (T.kickPat.includes(s) || (s === 14 && R() < 0.12)) kick(t + hum(), s === 0 ? 0.7 : 0.51, KICKS[T.kit]);
      if (T.half ? s === 8 : s === 4 || s === 12) backbeat(tt + 0.01 + T.late + hum(), 0.32, T.snare);
      if ((s === 7 || s === 15) && R() < 0.2) snare(tt, 0.07, true);   // ghost notes
      hats(c, 1);
      if (T.openHat && s === 14 && bar % 2) hat(tt, 0.05, true, HATS[T.hatTone]);
      if (T.perc === 'conga' && (s === 6 || s === 11 || (s === 14 && R() < 0.3)) && !busy()) conga(tt + hum(), s === 11 ? 62 : 57, 0.12);
      if (T.perc === 'block' && (s === 7 || (s === 13 && R() < 0.5)) && !busy()) block(tt, 0.05);
    }
    // the tune: in B and the second half of A, or A and B each with their own; two bars on and two off, unless an answering
    // instrument takes the off bars (answer). A counter-line can sit under it (guide).
    const onA = sec === 'A' && (T.where === 'AB' || k % 8 >= 4);
    if ((sec === 'B' || onA) && !lastBar && !busy()){
      const tn = sec === 'B' ? T.mel.B : T.mel.A, both = T.counter === 'answer', ph = melAt(tn, k, both), by = both && (k >> 1) % 2 ? T.counterI : T.leadI;
      eachNote(ph, k % 2, s, nn => { if (R() < 0.92) lead(by, tt + hum(), fit(melPitch(nn, T.key), root, type, s % 8 === 0), sd*nn.d, 0.05, by === T.leadI ? 0.2 : -0.25); });
      if (T.counter === 'guide' && sec === 'B') counterLine(c, 0.03);
    }
  }
  // ---------------------------------------------------------------- chill house: soft four-on-the-floor, pads or stabs, plucks
  function houseStep(c){
    const { t, tt, sd, s, bar, sec, root, type, chordStart, hum, k, left, lastBar } = c;
    // chords: a sidechained pad or strings, organ or piano stabs over a faint pad, or Rhodes
    if (T.keys === 'stab'){
      if (chordStart) padChord('pad', t, voice(root, type, 55, 74), left, sec === 'break' ? 0.035 : 0.008, sec === 'break' ? 1800 : 900);
      if (T.stab.includes(s) && sec !== 'break' && sec !== 'intro') hit(s % 2 ? tt : t, voice(root, type, 57, 74), sd*1.5, 0.045, T.stabI);
    } else if (T.keys === 'keys'){
      if (chordStart) hit(t, voice(root, type, 55, 74), left*0.9, 0.05, 'rhodes');
      if ((s === 6 || s === 10) && sec !== 'break' && R() < 0.5) hit(tt, voice(root, type, 58, 75).slice(1), sd*3, 0.03, 'rhodes');
    } else if (chordStart) padChord(T.keys, t, voice(root, type, 55, 74), left, sec === 'break' ? 0.035 : 0.022, sec === 'break' ? 1800 : 1100);
    const drums = sec !== 'break' && !(sec === 'intro' && k < 4);
    if (drums){
      if (s % 4 === 0){ kick(t, 0.7, KICKS[T.kit]);
        // the sidechain pump: everything but the drums ducks on each kick
        duck.gain.cancelScheduledValues(t); duck.gain.setValueAtTime(1 - T.pump, t); duck.gain.linearRampToValueAtTime(1, t + sd*3.2); }
      if ((s === 4 || s === 12) && sec !== 'intro') backbeat(t + 0.004, 0.19, T.snare);
      const H = HATS[T.hatTone];
      if (T.hats === 'shaker'){ shaker(tt + hum(), (s % 4 === 2 ? 0.1 : 0.05)*(0.7 + 0.6*R())); if (s % 4 === 2 && s !== 2) hat(tt, 0.05, true, H); }
      else if (T.hats === 'closed') hat(tt + hum(), (s % 4 === 2 ? 0.08 : 0.035)*(0.7 + 0.6*R()), false, H);
      else if (s % 4 === 2) hat(tt, 0.09, true, H);
      else if (R() < 0.7) hat(tt + hum(), 0.04*(0.5 + R()), false, H);
      if (sec !== 'intro' && !busy()){
        if (T.perc === 'conga' && T.congaPat.includes(s)) conga(tt + hum(), s > 8 ? 60 : 64, 0.11);
        if (T.perc === 'rim' && (s === 3 || s === 10) && R() < 0.8) rim(tt, 0.1);
      }
    }
    // bass: on the offbeats, rolling, syncopated or long
    if (sec !== 'intro' && sec !== 'break'){
      const r = low(root, 33, 45);
      if (T.bassPat === 'rolling'){ if (s === 2 || s === 3 || s === 6 || s === 10 || s === 11 || s === 14) bassNote(tt, r + (s === 3 || s === 11 ? 12 : 0), sd*0.9, 0.242); }
      else if (T.bassPat === 'synco'){ if (s === 3 || s === 6 || s === 10 || s === 13) bassNote(tt, r + (s === 13 ? 7 : s === 6 && R() < 0.3 ? 12 : 0), sd*1.5, 0.242); }
      else if (T.bassPat === 'long'){ if (s === 2) bassNote(tt, r, sd*5, 0.22); if (s === 10) bassNote(tt, r, sd*2, 0.22); if (s === 14) bassNote(tt, r + 7, sd, 0.198); }
      else if (s % 4 === 2) bassNote(t, r + (R() < 0.12 ? 12 : 0), sd*1.6, 0.242);
    }
    // on top in B and the drop: plucks, a riff on a mallet, or a choir
    if (sec === 'B' || sec === 'drop'){
      if (T.top === 'pluck' && (s % 2 === 0 || R() < 0.3)){
        const v = voice(root, type, 64, 88), idx = (Math.floor(step/2) + (sec === 'drop' ? bar : 0)) % v.length;
        pluck(t, v[s % 4 === 0 ? 0 : idx], 0.05*(s % 4 === 0 ? 1.2 : 0.8));
      }
      else if (T.top === 'riff' && T.riff.includes(s) && !busy()){ const v = voice(root, type, 62, 79), i = T.riff.indexOf(s); lead(T.riffI, s % 2 ? tt : t, v[T.riffOrd[i % 4] % v.length], sd*2, 0.04, (i % 2 ? 0.3 : -0.3)); }
      else if (T.top === 'choir' && chordStart) choir(t, voiceNR(root, type, 57, 72).slice(0, 3), left, 0.012);
      // the tune, in the second half of each eight bars
      if (T.leadI !== 'none' && k % 8 >= 4 && !lastBar && !busy()) eachNote(melAt(T.mel.B, k, false), k % 2, s, nn => lead(T.leadI, tt + hum(), fit(melPitch(nn, T.key), root, type, s % 8 === 0), sd*nn.d, 0.04));
    }
    if (sec === 'break' && s % 8 === 0 && R() < 0.6){
      const vs = voice(root, type, 72, 90), m = vs[Math.floor(R()*Math.min(3, vs.length))];
      if (T.breakI === 'bell') bell(t, m, 0.03); else if (T.breakI === 'musicbox') lead('musicbox', t, m - 12, sd*8, 0.04, 0); else if (s === 0 && chordStart) choir(t, voiceNR(root, type, 57, 72).slice(0, 3), left, 0.012);
    }
  }
  // ---------------------------------------------------------------- ambient: slow pads over the drone and a faint low root, and a sparkle
  function ambientStep(c){
    const { t, sd, s, bar, root, type, chordStart, k, left } = c;
    if (chordStart){ padChord(T.padI, t, voice(root, type, 50, 74), left + 4, 0.04, 800); subPad(t, low(root, 36, 47), left + 2, 0.24); }
    // the sparkle: now and then a note at random, a slow tune (after the first four bars, two bars on and two off), or a slow
    // arpeggio into the echo
    const sp = T.spark;
    if (T.sparkMode === 'melody'){
      if (bar >= 4 && bar < T.sections.length - 2) eachNote(melAt(T.mel.A, k, false), k % 2, s, nn => lead(sp, t, fit(melPitch(nn, T.key), root, type, s % 8 === 0), sd*nn.d*1.5, 0.04, (R() - 0.5)*0.6));
    } else if (T.sparkMode === 'arp'){
      const pos = bar*16 + s;
      if (pos % T.arpEvery === 0 && bar >= 2 && bar < T.sections.length - 2 && R() < 0.85 && !busy()){
        const vs = voice(root, type, 62, 82), L = vs.length, i = pos/T.arpEvery, cyc = T.arpUD ? 2*L - 2 : L, j = i % cyc, idx = j < L ? j : cyc - j;
        lead(sp, t, vs[idx], sd*T.arpEvery, 0.026, (idx/L - 0.5)*0.8);
      }
    } else if (R() < 0.022){ const vs = voice(root, type, 62, 82); lead(sp, t + R()*sd, vs[Math.floor(R()*Math.min(4, vs.length))], sd*4, 0.03 + R()*0.025, (R() - 0.5)*1.2); }
  }
  // ---------------------------------------------------------------- ambient piano: felt piano, a left hand, a right hand, a slow tune
  function pianoStep(c){
    const { t, sd, s, bar, sec, root, type, chordStart, lastBar, k, left, n } = c, loose = () => (R() - 0.5)*0.03, r = low(root, 36, 47);
    // left hand: root and fifth, octaves, a walking root, fifth and tenth, or a low chord, under the pedal until the next chord
    // (it gives the low end: the soft sine that held the root under it until 0.9.4 made the bass boom)
    if (chordStart){
      if (T.lh === 'octave'){ piano(t + loose(), r, left, 0.04); piano(t + 0.03 + loose(), r + 12, left, 0.026); }
      else if (T.lh === 'block'){ piano(t + loose(), r, left, 0.036); piano(t + 0.02 + loose(), r + 7, left, 0.022); piano(t + 0.04 + loose(), r + 12 + (CTONES[type] || [0, 4])[1], left, 0.02); }
      else if (T.lh !== 'walk'){ piano(t + loose(), r, left, 0.042); piano(t + 0.05 + loose(), r + 7, left, 0.03); }
      if (sec !== 'intro') padChord(T.padI, t, voice(root, type, 52, 67), left + 0.5, 0.0024, 650);
    }
    if (T.lh === 'walk' && !busy()){
      if (s === 0) piano(t + loose(), r, left, chordStart ? 0.042 : 0.034);
      else if (s === 6) piano(t + loose(), r + 7, left, 0.026);
      else if (s === 10) piano(t + loose(), r + 12 + (CTONES[type] || [0, 4])[1], left, 0.022);
    }
    // right hand: broken chords in eighths, rising and falling over two bars; every third sixteenth, across the beat (dotted);
    // a few quarter notes (sparse); or soft chords on 1 and 3 (hymn). About a quarter of the notes are left out.
    if (sec !== 'outro' && !(sec === 'intro' && bar === 0) && !busy()){
      // (the busier patterns a little softer, so the tune stands out over them)
      const vs = voice(root, type, 57, 76), pos = (bar % 2)*16 + s, B = (sec === 'B' ? 0.8 : 1)*({ eighths:0.75, dotted:0.85, hymn:0.8 }[T.rh] || 1);
      if (T.rh === 'dotted'){ if (pos % 3 === 0 && pos < 30 && R() > 0.15){ const L = vs.length, cyc = 2*L - 2, j = (pos/3) % cyc; piano(t + loose(), vs[j < L ? j : cyc - j], left, (0.016 + 0.008*R())*B); } }
      else if (T.rh === 'sparse'){ if (s % 4 === 0 && R() < 0.6) piano(t + loose(), pick(vs), left, (0.018 + 0.008*R())*B); }
      else if (T.rh === 'hymn'){ if (s === 0 || s === 8) vs.slice(-3).forEach((m, i) => piano(t + i*0.02 + loose(), m, s === 0 ? Math.min(left, sd*8) : left, 0.02*B)); }
      else if (s % 2 === 0){ const i = pos/2, up = i < 8 ? i : 15 - i, idx = Math.min(vs.length - 1, Math.floor(up*vs.length/8)); if (R() > 0.25) piano(t + loose(), vs[idx], left, (0.017 + 0.01*R())*B); }
    }
    // the tune on top: in B, in A and B (each its own), or all through with the last A an octave up
    const on = T.where === 'all' ? sec === 'A' || sec === 'B' : T.where === 'AB' ? sec === 'A' || sec === 'B' : sec === 'B';
    if (on && !lastBar){
      const lastA = T.where === 'all' && sec === 'A' && bar > n/2;
      eachNote(melAt(sec === 'B' ? T.mel.B : T.mel.A, k, true), k % 2, s, nn => {
        const m = fit(melPitch(nn, T.key + 12), root, type, s % 8 === 0), d = Math.min(left, sd*nn.d + 1.5);
        piano(t + loose(), m, d, 0.036);
        if (lastA) piano(t + 0.012 + loose(), m + 12, d, 0.016);
        if (T.color === 'musicbox' && sec === 'B') lead('musicbox', t + 0.01, m - 12, sd*nn.d, 0.018, 0.3);   // (a music box on the tune, in its octave)
      });
    }
    // a low counter-line on strings (cello) in B
    if (T.color === 'cello' && sec === 'B' && chordStart && !busy()){ const m = guide(root, type, T.guidePrev || T.key, T.key - 12, T.key + 4); T.guidePrev = m; pad(t, [m], left + 0.3, 0.012, 900, 'strings'); }
    // the ending: the home chord, spread slowly upward and left to ring
    if (sec === 'outro' && bar === n - 2 && s % 4 === 0){ const vs = voice(root, type, 57, 79); if (vs[s/4] !== undefined) piano(t + loose(), vs[s/4], sd*28, 0.026); }
  }
  // ---------------------------------------------------------------- downtempo: slow drums, keys, a deep bass, a hook, a soft choir
  function downStep(c){
    const { t, tt, sd, s, bar, sec, root, type, chordStart, lastBar, hum, k, left, n } = c, end = bar >= n - 2;
    comp(c, 52, 70, 0.036);
    // bass: long notes that sometimes slide in from the last one, a second note on the and of 3 in most bars
    if (sec !== 'intro' && sec !== 'break' && !(end && bar === n - 1)){
      const r = low(root, 33, 45);
      if (s === 0){ T.subTwo = !end && R() < 0.7; bassNote(t, r, end ? sd*30 : T.subTwo ? sd*9 : sd*15, 0.075, T.subPrev && T.subPrev !== r && R() < 0.5 ? T.subPrev : 0); T.subPrev = r; }
      else if (s === 10 && T.subTwo){ const m = r + pick(CTONES[type].includes(10) ? [7, 12, 10] : [7, 12]); bassNote(tt, m, sd*5, 0.052, r); }   // (no flat seventh under a maj9)
    }
    // drums: half time (kick on 1 and the and of 3, snare on 3), broken (kick on 1, the a of 2 and the and of 3, snare on 2
    // and 4) or a shuffle
    if (!(sec === 'intro' && bar < 2) && sec !== 'break' && !end){
      const K = KICKS[T.kit];
      if (T.feel === 'broken'){ if (s === 0 || s === 7 || s === 10) kick(t + hum(), s === 0 ? 0.18 : 0.12, K); if (s === 4 || s === 12) backbeat(tt + 0.01, 0.16, T.snare); }
      else if (T.feel === 'shuffle'){ if (s === 0 || s === 11) kick(t + hum(), s === 0 ? 0.18 : 0.12, K); if (s === 8) backbeat(tt + 0.01, 0.18, T.snare); if (s === 14 && R() < 0.3) snare(tt, 0.04, true); }
      else { if (s === 0 || s === 10) kick(t + hum(), s === 0 ? 0.18 : 0.12, K); if (s === 8) backbeat(tt + 0.01, 0.18, T.snare); }
      if (T.dub && s === 8 && T.feel !== 'broken'){ snare(tt + sd*3 + 0.01, 0.05, true); snare(tt + sd*6 + 0.01, 0.025, true); }
      if (!busy()) hats(c, 0.6);
      if (T.perc === 'conga' && (s === 6 || s === 13) && !busy()) conga(tt + hum(), s === 13 ? 60 : 55, 0.05);
      if (T.perc === 'block' && s === 3 && R() < 0.6 && !busy()) block(tt, 0.022);
    }
    // the pad in B and in the break
    if (chordStart && (sec === 'B' || sec === 'break')) padChord(T.padI, t, voiceNR(root, type, 57, 72).slice(0, 3), left, 0.008, 900);
    // the hook: two bars on, two off, in A (or its own tune in B too), with a little echo
    if ((sec === 'A' || (T.where === 'AB' && sec === 'B')) && !lastBar)
      eachNote(melAt(sec === 'B' ? T.mel.B : T.mel.A, k, false), k % 2, s, nn => lead(T.leadI, tt + hum(), fit(melPitch(nn, T.key), root, type, s % 8 === 0), sd*nn.d, 0.045, -0.2));
  }
  // ---------------------------------------------------------------- soft synthwave: pads, an arpeggio in echo, bass, a lead
  function waveStep(c){
    const { t, tt, sd, s, bar, sec, root, type, chordStart, lastBar, k, left } = c, fadeOut = sec === 'outro' && k >= 4;
    if (chordStart) padChord(T.padI, t, voice(root, type, 55, 74), left, sec === 'break' ? 0.024 : 0.017, sec === 'break' ? 1500 : 1000);
    // the arpeggio: sixteenths up (or up and down) the chord, a pattern of root, fifth and ninth, or eighths
    if (T.arp !== 'none' && !(sec === 'intro' && k < 4) && !(fadeOut && k >= 6) && !busy()){
      const vs = voice(root, type, 62, 81), L = vs.length, g = sec === 'intro' || fadeOut ? 0.7 : 1, pan = s % 2 ? 0.3 : -0.3;
      if (T.arp === 'pattern'){ const P = [0, 2, 1, 3, 2, 1, 3, 2], j = P[s % 8]; if (s % 8 !== 7) arp(t, vs[j % L], (s % 4 === 0 ? 0.062 : 0.043)*g, pan, T.arpW); }
      else if (T.arp === 'eighths'){ if (s % 2 === 0){ const i = (step >> 1) % L; arp(t, vs[i], (s % 4 === 0 ? 0.066 : 0.05)*g, pan, T.arpW); } }
      else { const cyc = T.arpUD ? 2*L - 2 : L, i = step % cyc, idx = i < L ? i : cyc - i; arp(t, vs[idx], (s % 4 === 0 ? 0.062 : 0.043)*g, pan, T.arpW); }
    }
    const drums = sec === 'A' || sec === 'B' || (sec === 'outro' && k < 4);
    // bass: eighths jumping an octave, steady eighths on the root, a gallop, or long notes
    if (drums || (sec === 'intro' && k >= 4)){
      const r = low(root, 33, 45);
      if (T.bassPat === 'pulse'){ if (s % 2 === 0) bassNote(t, r, sd*1.5, s % 4 === 0 ? 0.195 : 0.159); }
      else if (T.bassPat === 'gallop'){ if (s % 4 === 0 || s % 4 === 2 || s % 4 === 3) bassNote(t, r + (s === 14 || s === 15 ? 12 : 0), sd*(s % 4 === 0 ? 1.8 : 0.9), s % 4 === 0 ? 0.207 : 0.134); }
      else if (T.bassPat === 'long'){ if (s === 0) bassNote(t, r, sd*6, 0.207); if (s === 6) bassNote(t, r, sd*2, 0.171); if (s === 10) bassNote(t, r + 12, sd*4, 0.159); }
      else if (s % 2 === 0) bassNote(t, r + (s % 4 === 2 ? 12 : 0), sd*1.5, s % 4 === 0 ? 0.207 : 0.139);
    }
    if (drums){
      if (s === 0 || s === 8){ kick(t, 0.32, KICKS[T.kit]);
        // a gentle pump: the music dips a little on each kick
        duck.gain.cancelScheduledValues(t); duck.gain.setValueAtTime(0.6, t); duck.gain.linearRampToValueAtTime(1, t + sd*3.5); }
      if (s === 4 || s === 12) backbeat(t + 0.005, 0.18, T.snare);
      if (T.hats === 'sixteenths') hat(t, s % 4 === 2 ? 0.05 : s % 2 ? 0.02 : 0.03, false);
      else if (T.hats === 'quarters'){ if (s % 4 === 2) hat(t, 0.065, false); }
      else if (s % 2 === 0) hat(t, s % 4 === 2 ? 0.06 : 0.034, false);
      // soft toms into the next section
      const nxt = T.sections[bar + 1];
      if (T.toms && nxt && nxt !== sec && (s === 10 || s === 12 || s === 14)) tom(t, s === 10 ? 50 : s === 12 ? 47 : 43, 0.12);
    }
    // the lead: two bars on, two off, in B (and its own tune in A)
    if ((sec === 'B' || (T.where === 'AB' && sec === 'A' && k >= 8)) && !lastBar)
      eachNote(melAt(sec === 'B' ? T.mel.B : T.mel.A, k, false), k % 2, s, nn => lead(T.leadI, tt, fit(melPitch(nn, T.key), root, type, s % 8 === 0), sd*nn.d, 0.047, 0.25));
  }
  function pump(){
    if (!ctx || !running) return;
    const ahead = document.hidden ? 1.6 : 0.25;
    while (nextT < ctx.currentTime + ahead) nextT += play(nextT);
  }
  const level1 = 0.95;   // the master level at full volume
  function level(){ return level1*SET.volume; }
  function fadeTo(v, sec){ if (!master) return; const t = ctx.currentTime; master.gain.cancelScheduledValues(t); master.gain.setValueAtTime(master.gain.value, t); master.gain.linearRampToValueAtTime(v, t + sec); }
  function start(){
    if (!AC) return;
    if (!ctx){ try { build(); } catch (e) { console.warn('sound unavailable', e); return; } }
    running = true;
    if (ctx.state === 'suspended') ctx.resume();
    if (!T) newTrack();
    nextT = Math.max(nextT, ctx.currentTime + 0.1);
    clearInterval(timer); timer = setInterval(pump, 50); pump();
    fadeTo(level(), ctx.currentTime < 1 ? 0.6 : 3);
  }
  function stop(){
    running = false;
    if (!ctx) return;
    fadeTo(0, 1.2);
    setTimeout(() => { if (!running){ clearInterval(timer); if (ctx.state === 'running') ctx.suspend(); } }, 1400);
  }
  // Offline render (tests/music.mjs: levels and listening clips): sec seconds of one style from a seed, at full volume,
  // on an OfflineAudioContext. Everything is scheduled at once and the live graph and track are put back before it renders.
  // (force: a song's choices set by name, such as { lead:'flute' }, for tests)
  let lastRender = '', lastInfo = null;
  // (intro: from the very start, as the radio plays a song that is not its first, instead of from the end of the intro;
  // mix: a style's balance set by part, such as { bass:0.5 }, for tuning)
  // The notes are scheduled a little at a time, CHUNK seconds ahead of the rendering (it stops at each step with suspend()),
  // as the live radio schedules them: the same calls in the same order, but a whole song scheduled at once kept thousands of
  // waiting notes in the graph and took minutes to render. Between steps the render keeps its graph and song in its own
  // state (G below), so the live radio and other renders are untouched.
  const CHUNK = 1;
  function render(style, sec, seed, rate, force, intro, mix){
    const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    if (!OAC || !STYLES[style]) return Promise.resolve(null);
    const G = () => [ctx, master, mixG, verbSend, drumBus, drumLP, musBus, musLP, duck, crackleG, rainG, windG, droneG, drones, wobble, noiseBuf, WAVES, vibesBus, arpBus, echoIn, echoL, echoR,
      R, T, nextT, step, first, forceStyle, forceWith, forceSong, mixWith, offline, vel, SH, hissNow, solo];
    const put = v => { [ctx, master, mixG, verbSend, drumBus, drumLP, musBus, musLP, duck, crackleG, rainG, windG, droneG, drones, wobble, noiseBuf, WAVES, vibesBus, arpBus, echoIn, echoL, echoR,
      R, T, nextT, step, first, forceStyle, forceWith, forceSong, mixWith, offline, vel, SH, hissNow, solo] = v; };
    let own = null, t = 0.1;
    // schedule everything that starts before `until` (in the render's own state)
    const more = until => { const keep = G(); try { put(own); while (t < Math.min(until, sec)) t += play(t); own = G(); } finally { put(keep); } };
    const keep = G();
    // (the noise and reverb buffers draw from a generator of their own, so a seed deals the same song at any sample rate)
    let oc = null;
    try {
      R = gen(seed + 7919); oc = new OAC(2, Math.ceil(sec*rate), rate); offline = true; build(oc);
      forceStyle = style; forceSong = { id:style + '-' + seed, style, seed }; forceWith = force || null; mixWith = mix || null; solo = null;
      first = !intro; T = null; hissNow = null; newTrack(0); lastRender = T.name;
      // (what the song chose: its key, tempo, progressions as degrees, arrangement and palette)
      const rel = P => P.p.map(([r, ty, b]) => [r - T.key, ty, Math.max(1, Math.round((b || P.bpc)*P.slow))]);
      lastInfo = { length:lengthOf(T), title:T.title, label:T.label, style, key:T.key, mode:T.mode, bpm:T.bpm, progA:rel(T.pA), progB:T.pB === T.pA ? null : rel(T.pB), progAt:[T.pA.at, T.pB.at],
        plan:T.plan.map(([a, b]) => a + ' ' + b).join(', '), bars:T.sections.length, forms:T.mel ? Object.keys(T.mel).map(k => T.mel[k] && k + ' ' + T.mel[k].form).filter(Boolean).join(', ') : '' };
      for (const k in T) if (['string', 'number', 'boolean'].includes(typeof T[k]) && !(k in lastInfo)) lastInfo[k] = T[k];
      master.gain.value = level1;
      own = G();
    } finally { put(keep); }
    more(2*CHUNK);
    for (let s = CHUNK; s < sec - CHUNK; s += CHUNK) oc.suspend(s).then(() => { more(s + 2*CHUNK); oc.resume(); });
    return oc.startRendering();
  }
  // ---------------------------------------------------------------- one song on its own (the review page, /songs)
  // audition(id, at) plays one song of CANDIDATES live, from the start of the bar at `at` seconds (0: from the very start,
  // intro and all) and stops at its end; the radio stays off meanwhile. Up to that bar the song is dealt and played on a
  // silent scratch graph, so every random draw happens as it does from the start and the song goes on exactly as it
  // plays (and renders) from the start.
  function audition(id, at = 0){
    const song = CANDIDATES.find(x => x.id === id), OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    if (!song || !AC || !OAC) return false;
    if (!ctx){ try { build(); } catch (e) { console.warn('sound unavailable', e); return false; } }
    if (ctx.state === 'suspended') ctx.resume();
    wantOn = false; running = false;
    const now = ctx.currentTime, t0 = now + 0.12;
    // (what still rings or is scheduled from the last song is cut: its long notes fade, and the music dips until t0)
    if (T) release(T.held, now);
    mixG.gain.cancelScheduledValues(now); mixG.gain.setValueAtTime(mixG.gain.value, now); mixG.gain.linearRampToValueAtTime(0, now + 0.06); mixG.gain.setValueAtTime(1, t0);
    const live = [ctx, master, mixG, verbSend, drumBus, drumLP, musBus, musLP, duck, crackleG, rainG, windG, droneG, drones, wobble, noiseBuf, WAVES, vibesBus, arpBus, echoIn, echoL, echoR, offline, hissNow];
    let bars = null, b = 0;
    try {
      R = gen(7919); offline = true; build(new OAC(2, 1, 48000));   // (the scratch graph's buffers draw from a generator of their own)
      solo = { id, ended:false }; forceSong = song; first = false; T = null; hissNow = null; newTrack(0);
      bars = barStarts(T); while (b + 1 < bars.length && bars[b + 1] <= at + 0.01) b++;
      let t = 0.1; while (step < b*16) t += play(t);   // (from 0.1 s, as a render: a note can come a little early)
    } finally {
      forceSong = null;
      [ctx, master, mixG, verbSend, drumBus, drumLP, musBus, musLP, duck, crackleG, rainG, windG, droneG, drones, wobble, noiseBuf, WAVES, vibesBus, arpBus, echoIn, echoL, echoR, offline, hissNow] = live;
    }
    trackSound(t0);
    Object.assign(solo, { t0, at:bars[b], len:lengthOf(T), bars });
    nextT = t0; running = true;
    clearInterval(timer); timer = setInterval(pump, 50); pump();
    fadeTo(level(), 0.1);
    return true;
  }
  // the song has ended: its last notes ring out, then the sound sleeps
  function soloEnd(){
    running = false; solo.ended = true;
    setTimeout(() => { if (!running){ clearInterval(timer); if (ctx.state === 'running') ctx.suspend(); } }, 6000);
  }
  function soloStop(){
    if (!solo) return;
    const was = solo; solo = null; running = false;
    if (!ctx) return;
    if (T) release(T.held, ctx.currentTime);
    T = null; fadeTo(0, 0.25);
    setTimeout(() => { if (!running){ clearInterval(timer); if (ctx.state === 'running') ctx.suspend(); } }, 600);
    return was;
  }
  // where the song on its own is (s), its length, and whether it plays
  function soloState(){
    if (!solo || !solo.len) return null;
    const t = Math.max(0, Math.min(solo.len, solo.at + (ctx.currentTime - solo.t0)));
    return { id:solo.id, t, len:solo.len, playing:!solo.ended || t < solo.len, ended:solo.ended && t >= solo.len };
  }
  // the catalogue with each song's tempo and length (dealt once, without a sound)
  let songList = null;
  function songs(){
    if (songList) return songList;
    const keep = [R, T, SH, forceWith];
    try { forceWith = null; songList = SONGS.map(x => { const t = deal(x.style, x); return { ...x, label:STYLES[x.style].label, bpm:t.bpm, sec:lengthOf(t) }; }); }
    finally { [R, T, SH, forceWith] = keep; }
    return songList;
  }
  // the candidates, the same way, with their key and whether the radio plays them now
  const KEYN = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
  let candList = null;
  function candidates(){
    if (candList) return candList;
    const keep = [R, T, SH, forceWith, mixWith];
    try { forceWith = mixWith = null; candList = CANDIDATES.map(x => { const t = deal(x.style, x); return { ...x, label:STYLES[x.style].label, bpm:t.bpm, sec:lengthOf(t), key:KEYN[t.key % 12] + ' ' + t.mode, radio:SONGS.some(y => y.id === x.id) }; }); }
    finally { [R, T, SH, forceWith, mixWith] = keep; }
    return candList;
  }
  // the next n songs a mood would play (for the tests), without playing anything
  function shuffle(mood, n){
    const keep = [Q, SET.musicStyle], out = [];
    try { Q = { mood:null, order:[], last:null, sinceCalm:0, next:null, recent:[] }; SET.musicStyle = mood; for (let i=0;i<n;i++) out.push(nextSong()); }
    finally { [Q, SET.musicStyle] = keep; }
    return out;
  }
  const moodText = m => { const L = (MOODS[m] || MOODS.mix).map(st => STYLES[st].label); return L.length > 1 ? L.slice(0, -1).join(', ') + ' and ' + L[L.length - 1] : L[0]; };
  // ---------------------------------------------------------------- a rocket's roar, driven once a frame by the launch director (s4-spacex-run.js) while a flight can be
  // heard: a rumble below 80 Hz, the roar (noise, low-passed more the farther away it is: the air takes the highs) and the crackle (the
  // popping of the shock waves in a big rocket's exhaust, loudest from a few hundred metres to a few kilometres). The music dips under it
  // (owner, 0.9.9). Its noise is dealt from a fixed seed, so it sounds the same every time; built on the live context only (never on a
  // render's), with the music's own gain captured, so a song render on the review page cannot take it over.
  let RK = null;
  function rocketGraph(c = ctx, dest = master, mus = mixG){
    if (!c || !dest) return null;
    const sr = c.sampleRate; let sd = 0x2545f491; const rr = () => (sd = (Math.imul(sd, 1664525) + 1013904223) >>> 0)/4294967296;
    // (the roar: white and brown noise, its level wandering a little, as a big rocket's does)
    const rb = c.createBuffer(2, sr*4, sr);
    for (let ch=0;ch<2;ch++){ const d = rb.getChannelData(ch); let b = 0, env = 1, ev = 0;
      for (let i=0;i<d.length;i++){ const w = rr()*2 - 1; b = b*0.985 + w*0.015; if (i % 64 === 0){ ev += (rr() - 0.5)*0.05; ev *= 0.97; env = 1 + ev; } d[i] = (w*0.3 + b*5)*env*0.6; } }
    // (the crackle: sparse, uneven pops, each a burst of a millisecond or two)
    const cb = c.createBuffer(2, sr*4, sr);
    for (let ch=0;ch<2;ch++){ const d = cb.getChannelData(ch);
      for (let i=0;i<d.length;i++){ if (rr() < 90/sr){ const A = rr() < 0.2 ? 0.7 + 0.3*rr() : 0.12 + 0.35*rr(), n = 20 + Math.floor(rr()*110);
        for (let k=0;k<n && i + k < d.length;k++) d[i + k] += A*(rr()*2 - 1)*Math.exp(-k/(n*0.25)); } } }
    const src = (buf, off) => { const s = c.createBufferSource(); s.buffer = buf; s.loop = true; s.start(0, off); return s; };
    const out = c.createGain(); out.gain.value = 1; out.connect(dest);
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2000; lp.Q.value = 0.3; lp.connect(out);
    const roar = c.createGain(); roar.gain.value = 0; src(rb, 0).connect(roar).connect(lp);
    const rumLP = c.createBiquadFilter(); rumLP.type = 'lowpass'; rumLP.frequency.value = 75; rumLP.Q.value = 1.1;
    const rumble = c.createGain(); rumble.gain.value = 0; src(rb, 1.7).connect(rumLP).connect(rumble).connect(out);
    const crHP = c.createBiquadFilter(); crHP.type = 'highpass'; crHP.frequency.value = 550;
    const crackle = c.createGain(); crackle.gain.value = 0; src(cb, 0).connect(crHP).connect(crackle).connect(lp);
    return { c, lp, roar, rumble, crackle, mus };
  }
  // one frame of what the camera hears: roar, rumble and crackle 0..1, lp the cut-off (Hz), duck 0..1 how far the music dips; null: silence
  function rocketSet(G, p, t){
    const k = 0.1, on = !!p;
    G.roar.gain.setTargetAtTime(on ? p.roar*0.32 : 0, t, k);
    G.rumble.gain.setTargetAtTime(on ? p.rumble*0.9 : 0, t, k);
    G.crackle.gain.setTargetAtTime(on ? p.crackle*0.22 : 0, t, k*0.5);
    G.lp.frequency.setTargetAtTime(on ? clamp(p.lp, 80, 12000) : 800, t, k);
    // (the music dips to about two thirds under the roar, never further: owner, 0.10.1, it should stay there through a launch)
    if (G.mus) G.mus.gain.setTargetAtTime(on ? 1 - 0.35*clamp(p.duck, 0, 1) : 1, t, 0.35);
  }
  return {
    get on(){ return wantOn; },
    // really playing: wanted, started and not held back by the browser (before the first click the context stays suspended)
    // (without Web Audio there is nothing to wait for, so the wish counts)
    get audible(){ return AC ? !!(wantOn && running && ctx && ctx.state === 'running') : wantOn; },
    get track(){ return T; },
    get _dbg(){ return { ctx, master, live, styles:Object.keys(STYLES) }; },
    // the moods of the settings panel, and what each one plays ('ambient, piano and lofi')
    moods:MOODS, moodText,
    _render:(style, sec = 30, { seed = 1, rate = 48000, force = null, intro = false, mix = null } = {}) => render(style, sec, seed, rate, force, intro, mix),   // for tests/music.mjs and the review page
    songs, calm:CALM, _shuffle:shuffle, _places:PLACES, _names:NAMES,
    // the review page: the candidates, one played on its own from a time (s), stopped, and where it is
    candidates, audition, stopSong:soloStop, get songState(){ return soloState(); },
    get _last(){ return lastRender; },
    get _info(){ return lastInfo; },
    set onTrack(f){ onTrack = f; },
    // a blocked context stays suspended, so every gesture retries until one is accepted (wheel and touchstart are not)
    gesture(){ if (!wantOn) return; if (!running) start(); else if (ctx.state === 'suspended'){ ctx.resume(); fadeTo(level(), 0.6); } },
    set(on){ wantOn = on; if (on) start(); else stop(); },
    // at start-up (0.27.2): the wish is known at once, the graph and the first song are made after the first frame is on the screen (warm).
    // Making them took about 80 ms before anything was drawn, and nothing can sound before the first click or key, which starts it anyway.
    wish(on){ wantOn = on; },
    warm(){ if (wantOn && !running) start(); },
    volume(){ if (running) fadeTo(level(), 0.3); },
    // move on to a new song now: the music dips for a moment and the last song's long notes fade out (release)
    skip(){
      if (!ctx || !running){ T = null; return; }
      const t = ctx.currentTime; if (T) release(T.held, t);
      musBus.gain.cancelScheduledValues(t); musBus.gain.setValueAtTime(musBus.gain.value, t); musBus.gain.linearRampToValueAtTime(0, t + 0.4); musBus.gain.linearRampToValueAtTime(1, t + 1.2); T = null; newTrack();
    },
    styleChanged(){ if (ctx && running) this.skip(); else T = null; },
    // play a song from the list now (id: 'style-seed'); the shuffle carries on after it
    play(id){ if (!SONGS.some(x => x.id === id)) return; Q.next = id; if (ctx && running) this.skip(); else T = null; },
    // the rocket's sound this frame (see rocketGraph); only while the music plays (sound on) and never during a song render
    rocket(p){
      if (!ctx || (typeof OfflineAudioContext !== 'undefined' && ctx instanceof OfflineAudioContext)) return;
      if (!running){ if (RK) rocketSet(RK, null, ctx.currentTime); return; }
      if (!p && !RK) return;
      if (!RK) RK = rocketGraph();
      if (RK) rocketSet(RK, p, ctx.currentTime);
    },
    // (a recording: the same sound rendered offline from a list of frames { t, p }, for the launch video; returns an AudioBuffer)
    async rocketRender(frames, sec, rate = 48000){
      const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext, c = new OAC(2, Math.ceil(sec*rate), rate);
      const comp = c.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 3.5; comp.attack.value = 0.01; comp.release.value = 0.4; comp.connect(c.destination);
      const G = rocketGraph(c, comp, null);
      for (const f of frames) rocketSet(G, f.p, f.t);
      return c.startRendering();
    },
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

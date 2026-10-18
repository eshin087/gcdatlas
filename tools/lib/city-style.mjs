// The architectural-model style of the five cities (0.17.0, owner's pick, 2026-10-04: "each building a clean block in one colour from the city's
// real materials ... crisp outlined edges, darker streets; the photo stays only for parks, water and the ground around"). Applied to a layer's
// RGBA (alpha untouched): every building's roof is painted one colour, the city roof material nearest the photo's own colour over that roof (so
// a red tile roof stays red tile, a zinc roof zinc), a little lighter or darker per building so neighbours part, with a dark outline one pixel
// wide round each building big enough to show one. The walls are coloured by the page (FS_SX_ENV's cityMat). Colours are in display terms
// (what the page shows in full sunlight; the page no longer grades a city's images).
// (each entry: r, g, b, and how much it is preferred: a city's most common roof wins a near tie, as the photos' grey roofs sit between zinc and
// pale flat roofs and Paris came out cream)
export const ROOF = {
  paris:   [[0.64, 0.69, 0.76, 0.7], [0.44, 0.47, 0.55, 1], [0.78, 0.50, 0.38, 1], [0.86, 0.82, 0.72, 1.05], [0.52, 0.70, 0.62, 1.2]],   // zinc, slate, terracotta, pale flat roofs, green copper
  newyork: [[0.38, 0.38, 0.41, 0.8], [0.78, 0.79, 0.80, 0.9], [0.68, 0.42, 0.34, 1], [0.46, 0.60, 0.42, 1.3], [0.74, 0.66, 0.54, 1]],   // tar, pale membrane, brick, green roof, tan
  tokyo:   [[0.80, 0.80, 0.79, 0.8], [0.58, 0.65, 0.73, 1], [0.43, 0.44, 0.47, 1], [0.50, 0.62, 0.56, 1.3], [0.70, 0.50, 0.40, 1.2]],   // concrete, blue-grey, dark grey, green, brick
  dubai:   [[0.88, 0.81, 0.68, 0.8], [0.94, 0.93, 0.90, 0.9], [0.68, 0.69, 0.68, 1], [0.78, 0.56, 0.42, 1.2]],                         // sand, white, grey, terracotta
  london:  [[0.46, 0.48, 0.54, 0.7], [0.72, 0.44, 0.35, 1], [0.78, 0.77, 0.74, 1], [0.60, 0.62, 0.65, 1.1], [0.50, 0.66, 0.58, 1.3]],   // slate, clay tile, pale flat roofs, lead, green copper
  // (0.19.0)
  hongkong:     [[0.62, 0.63, 0.64, 0.8], [0.42, 0.43, 0.45, 1], [0.80, 0.80, 0.78, 1], [0.48, 0.62, 0.52, 1.3], [0.56, 0.62, 0.68, 1]],   // concrete, dark grey, pale, green, blue-grey
  sanfrancisco: [[0.40, 0.40, 0.42, 0.9], [0.80, 0.80, 0.80, 0.9], [0.76, 0.68, 0.56, 1], [0.72, 0.44, 0.34, 1.1], [0.48, 0.62, 0.44, 1.3]],   // tar, white membrane, tan, red tile, green
  sydney:       [[0.74, 0.44, 0.32, 0.8], [0.56, 0.58, 0.60, 0.9], [0.82, 0.80, 0.75, 1], [0.42, 0.42, 0.44, 1], [0.48, 0.62, 0.48, 1.3]],   // terracotta tile, grey metal, pale, dark, green
  rome:         [[0.76, 0.46, 0.33, 0.6], [0.84, 0.78, 0.66, 1.1], [0.58, 0.57, 0.55, 1.1], [0.48, 0.60, 0.44, 1.3]],                         // terracotta tile, pale, grey, roof gardens
  losangeles:   [[0.82, 0.81, 0.78, 0.8], [0.58, 0.58, 0.58, 0.9], [0.74, 0.46, 0.36, 1], [0.76, 0.68, 0.56, 1], [0.48, 0.62, 0.44, 1.3]],   // white, grey, red tile, tan, green
  lasvegas:     [[0.86, 0.85, 0.82, 1.3], [0.6, 0.6, 0.6, 0.8], [0.78, 0.69, 0.55, 1], [0.74, 0.52, 0.42, 0.6], [0.5, 0.56, 0.62, 0.5]],   // white membrane, grey, desert tan, terracotta, blue-grey
  rio:          [[0.62, 0.62, 0.62, 0.9], [0.72, 0.45, 0.34, 1], [0.84, 0.82, 0.78, 0.9], [0.76, 0.48, 0.36, 1], [0.46, 0.60, 0.44, 1.3]],   // concrete, brick, pale, terracotta, green
};
const GLASS = [0.44, 0.52, 0.60];   // (towers over 120 m: glass and steel)
const lum = c => 0.3*c[0] + 0.59*c[1] + 0.11*c[2];
const hash = n => { let x = Math.sin(n*12.9898 + 4.1414)*43758.5453; return x - Math.floor(x); };
// the palette entry nearest a photo colour (0..1): hue and saturation count twice as much as brightness, as photos of roofs run dark or bright
function nearest(P, c){
  const lc = Math.max(lum(c), 0.02); let best = 0, bd = 1e9;
  for (let k=0;k<P.length;k++){
    const p = P[k], lp = lum(p), d = [0, 1, 2].reduce((s, j) => s + (c[j]/lc - p[j]/lp)**2, 0)*2 + (lc*1.6 - lp)**2;
    if (d*p[3] < bd){ bd = d*p[3]; best = k; }
  }
  return best;
}
// rgba: the layer (N x N, in place); bld: { id (Int32Array, 1 + index into feats), feats [{ h, k }] }; m: metres a pixel. Returns how many buildings it painted.
export function styleRoofs(key, N, rgba, bld, m){
  const P = ROOF[key]; if (!P) return 0;
  const nF = bld.feats.length, S = new Float64Array((nF + 1)*4), col = new Float32Array((nF + 1)*3);
  for (let i=0;i<N*N;i++){ const f = bld.id[i]; if (!f || rgba[i*4 + 3] < 2) continue; const o = f*4; S[o] += rgba[i*4]; S[o + 1] += rgba[i*4 + 1]; S[o + 2] += rgba[i*4 + 2]; S[o + 3]++; }
  let n = 0;
  for (let f=1;f<=nF;f++){
    const c = S[f*4 + 3]; if (!c) continue; n++;
    const ft = bld.feats[f - 1], ph = [S[f*4]/c/255, S[f*4 + 1]/c/255, S[f*4 + 2]/c/255];
    const base = ft.h > 120 ? GLASS : P[nearest(P, ph)], j = 0.93 + 0.14*hash(f + ft.h*7.3);
    for (let k=0;k<3;k++) col[f*3 + k] = Math.min(1, base[k]*j);
  }
  // (the outline: a building pixel next to another building or the ground, for buildings of 24 pixels or more; finer layers only, where a pixel is
  // under 5 m: on the 12.8 km layers a pixel is 8 m and an outline would swallow the smaller buildings)
  const outline = m < 5;
  for (let y=0;y<N;y++) for (let x=0;x<N;x++){
    const i = y*N + x, f = bld.id[i]; if (!f || rgba[i*4 + 3] < 2 || !S[f*4 + 3]) continue;
    let edge = false;
    if (outline && S[f*4 + 3] >= 24) edge = x === 0 || y === 0 || x === N - 1 || y === N - 1 || bld.id[i - 1] !== f || bld.id[i + 1] !== f || bld.id[i - N] !== f || bld.id[i + N] !== f;
    const k = edge ? 0.58 : 1;
    rgba[i*4] = Math.round(col[f*3]*k*255); rgba[i*4 + 1] = Math.round(col[f*3 + 1]*k*255); rgba[i*4 + 2] = Math.round(col[f*3 + 2]*k*255);
  }
  return n;
}

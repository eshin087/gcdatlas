(() => {
'use strict';
const $ = s => document.querySelector(s);
const canvas = $('#view');
const gl = canvas.getContext('webgl2', {antialias:false, alpha:false, depth:false, stencil:false, premultipliedAlpha:false, powerPreference:'high-performance'});
if (!gl) { $('#nogl').hidden = false; return; }
const HDR = !!gl.getExtension('EXT_color_buffer_float');
const OUT = HDR ? 1 : 0.125;
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---------------------------------------------------------------- math
const V = {
  add:(a,b)=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]],
  sub:(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]],
  mul:(a,s)=>[a[0]*s,a[1]*s,a[2]*s],
  dot:(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2],
  cross:(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],
  len:a=>Math.hypot(a[0],a[1],a[2]),
  norm:a=>{const l=Math.hypot(a[0],a[1],a[2])||1;return [a[0]/l,a[1]/l,a[2]/l];},
  lerp:(a,b,t)=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t],
};
// 3x3 matrices, column-major (GLSL layout)
const M3 = {
  I:()=>[1,0,0,0,1,0,0,0,1],
  rotX:t=>{const c=Math.cos(t),s=Math.sin(t);return [1,0,0, 0,c,s, 0,-s,c];},
  rotY:t=>{const c=Math.cos(t),s=Math.sin(t);return [c,0,-s, 0,1,0, s,0,c];},
  rotZ:t=>{const c=Math.cos(t),s=Math.sin(t);return [c,s,0, -s,c,0, 0,0,1];},
  mul:(a,b)=>{const r=new Array(9);for(let i=0;i<3;i++)for(let j=0;j<3;j++){let s=0;for(let k=0;k<3;k++)s+=a[k*3+i]*b[j*3+k];r[j*3+i]=s;}return r;},
  apply:(m,v)=>[m[0]*v[0]+m[3]*v[1]+m[6]*v[2], m[1]*v[0]+m[4]*v[1]+m[7]*v[2], m[2]*v[0]+m[5]*v[1]+m[8]*v[2]],
  applyT:(m,v)=>[m[0]*v[0]+m[1]*v[1]+m[2]*v[2], m[3]*v[0]+m[4]*v[1]+m[5]*v[2], m[6]*v[0]+m[7]*v[1]+m[8]*v[2]],
};
const clamp = (x,a,b)=>Math.min(b,Math.max(a,x));
const smooth = (a,b,x)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);};
const ease = t => t<.5 ? 4*t*t*t : 1-Math.pow(-2*t+2,3)/2;
let seed = 1234567;
const rnd = () => { seed = (seed*1664525 + 1013904223) >>> 0; return seed/4294967296; };
const rndn = () => { let u=0,v=0; while(!u) u=rnd(); v=rnd(); return Math.sqrt(-2*Math.log(u))*Math.cos(6.2831853*v); };
function randDir(){ const z=rnd()*2-1, a=rnd()*6.2831853, r=Math.sqrt(1-z*z); return [r*Math.cos(a), z, r*Math.sin(a)]; }
function blackbodyJS(t){
  t = clamp(t,1000,40000)/100; let r,g,b;
  r = t<=66 ? 1 : clamp(1.292936*Math.pow(t-60,-0.1332047),0,1);
  g = t<=66 ? clamp(0.3900816*Math.log(t)-0.6318414,0,1) : clamp(1.1298909*Math.pow(t-60,-0.0755148),0,1);
  b = t>=66 ? 1 : (t<=19 ? 0 : clamp(0.5432068*Math.log(t-10)-1.1962541,0,1));
  return [r,g,b];
}

// ---------------------------------------------------------------- GL helpers
function compile(type, src){
  const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(s);
    console.error(log + '\n' + src.split('\n').map((l,i)=>(i+1)+': '+l).join('\n'));
    throw new Error('shader compile failed: ' + log);
  }
  return s;
}
// Programs compile lazily: an object's shaders are built the first time it is about to be drawn (in the background
// where KHR_parallel_shader_compile exists), so the atlas can hold hundreds of objects without a long start-up.
const PAR = gl.getExtension('KHR_parallel_shader_compile');
const PROGS = [];
function program(vs, fs, eager){
  const pr = { vs, fs, p:null, u:{}, ready:false, started:false };
  PROGS.push(pr);
  if (eager) progReady(pr, true);
  return pr;
}
function progStart(pr){
  if (pr.started) return;
  pr.started = true;
  const p = gl.createProgram();
  const mk = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); gl.attachShader(p, s); return s; };
  pr.sv = mk(gl.VERTEX_SHADER, pr.vs); pr.sf = mk(gl.FRAGMENT_SHADER, pr.fs);
  gl.linkProgram(p); pr.p = p;
}
function progFinish(pr){
  const p = pr.p;
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)){
    for (const [s, src] of [[pr.sv, pr.vs], [pr.sf, pr.fs]]) if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)){
      const log = gl.getShaderInfoLog(s); console.error(log + '\n' + src.split('\n').map((l,i)=>(i+1)+': '+l).join('\n')); throw new Error('shader compile failed: ' + log); }
    throw new Error('link failed: ' + gl.getProgramInfoLog(p));
  }
  const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
  for (let i=0;i<n;i++){ const info = gl.getActiveUniform(p,i); pr.u[info.name.replace(/\[0\]$/,'')] = gl.getUniformLocation(p, info.name); }
  gl.deleteShader(pr.sv); gl.deleteShader(pr.sf); pr.sv = pr.sf = null;
  pr.ready = true;
}
// true when the program can be used now; with wait = true (or no parallel compile) it finishes synchronously
function progReady(pr, wait){
  if (pr.ready) return true;
  progStart(pr);
  if (!wait && PAR && !gl.getProgramParameter(pr.p, PAR.COMPLETION_STATUS_KHR)) return false;
  progFinish(pr); return true;
}
function useProg(pr){ progReady(pr, true); gl.useProgram(pr.p); }
// warm the cache: start compiling programs nobody has asked for yet, a few at a time, while the page idles
function progIdle(budget = 1){ if (!PAR) return; let k = 0; for (const pr of PROGS){ if (pr.started) continue; progStart(pr); if (++k >= budget) break; } }
function makeTex(w, h, internal, format, type, filter, data){
  const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
  gl.texImage2D(gl.TEXTURE_2D, 0, internal, w, h, 0, format, type, data || null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return t;
}
function makeFBO(tex){
  const f = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, f);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
  return f;
}

// fullscreen / rect quad
const quadVAO = gl.createVertexArray();
gl.bindVertexArray(quadVAO);
const quadBuf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf);
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0,0,1,0,0,1,1,1]), gl.STATIC_DRAW);
gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
gl.bindVertexArray(null);

// 3D value-noise texture (trilinear filtering does the interpolation for free)
const NOISE_N = 64;
const noiseTex = gl.createTexture();
(() => {
  const N = NOISE_N, n3 = N*N*N, raw = new Float32Array(n3), sm = new Float32Array(n3), d = new Uint8Array(n3);
  for (let i=0;i<n3;i++) raw[i] = rnd();
  const w = (x, y, z) => raw[((z & 63)*N + (y & 63))*N + (x & 63)];
  for (let z=0;z<N;z++) for (let y=0;y<N;y++) for (let x=0;x<N;x++)
    sm[(z*N + y)*N + x] = 0.4*w(x,y,z) + 0.1*(w(x+1,y,z) + w(x-1,y,z) + w(x,y+1,z) + w(x,y-1,z) + w(x,y,z+1) + w(x,y,z-1));
  const sorted = Float32Array.from(sm).sort();
  for (let i=0;i<n3;i++){ let lo = 0, hi = n3 - 1; const v = sm[i]; while (lo < hi){ const m = (lo + hi) >> 1; if (sorted[m] < v) lo = m + 1; else hi = m; } d[i] = Math.min(255, Math.floor(lo/n3*256)); }
  gl.bindTexture(gl.TEXTURE_3D, noiseTex);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
  gl.texImage3D(gl.TEXTURE_3D, 0, gl.R8, NOISE_N, NOISE_N, NOISE_N, 0, gl.RED, gl.UNSIGNED_BYTE, d);
  gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  for (const w of [gl.TEXTURE_WRAP_S, gl.TEXTURE_WRAP_T, gl.TEXTURE_WRAP_R]) gl.texParameteri(gl.TEXTURE_3D, w, gl.REPEAT);
})();

// particle buffers: aP (vec4) at location 0, aC (vec4) at location 1
function makePS(n){
  const ps = { n, count:n, a:new Float32Array(n*4), c:new Float32Array(n*4), vao:gl.createVertexArray(), b0:gl.createBuffer(), b1:gl.createBuffer() };
  gl.bindVertexArray(ps.vao);
  gl.bindBuffer(gl.ARRAY_BUFFER, ps.b0); gl.bufferData(gl.ARRAY_BUFFER, ps.a.byteLength, gl.DYNAMIC_DRAW);
  gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 4, gl.FLOAT, false, 0, 0);
  gl.bindBuffer(gl.ARRAY_BUFFER, ps.b1); gl.bufferData(gl.ARRAY_BUFFER, ps.c.byteLength, gl.DYNAMIC_DRAW);
  gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 0, 0);
  gl.bindVertexArray(null);
  ps.upload = (which='ac') => {
    if (which.includes('a')) { gl.bindBuffer(gl.ARRAY_BUFFER, ps.b0); gl.bufferSubData(gl.ARRAY_BUFFER, 0, ps.a); }
    if (which.includes('c')) { gl.bindBuffer(gl.ARRAY_BUFFER, ps.b1); gl.bufferSubData(gl.ARRAY_BUFFER, 0, ps.c); }
  };
  return ps;
}

// ---------------------------------------------------------------- glyph atlas (pure ASCII)
const RAMP_CANDIDATES = ".':;+*o%#&8@$W";
const DIR_CHARS = ['-', '/', '|', '\\'];
const atlas = { tex: gl.createTexture(), count: 0, levels: 0, dir0: 0, chars: '' };
function buildAtlas(cw, ch){
  const fontPx = cw / 0.6;
  const font = `500 ${fontPx}px "IBM Plex Mono", ui-monospace, Menlo, Consolas, monospace`;
  const mc = document.createElement('canvas'); mc.width = cw; mc.height = ch;
  const mx = mc.getContext('2d', {willReadFrequently:true});
  mx.font = font; mx.textAlign = 'center'; mx.textBaseline = 'middle'; mx.fillStyle = '#fff';
  const cov = [];
  for (const chr of new Set(RAMP_CANDIDATES)) {
    mx.clearRect(0,0,cw,ch); mx.fillText(chr, cw/2, ch/2 + fontPx*0.03);
    const d = mx.getImageData(0,0,cw,ch).data; let s = 0;
    for (let i=3;i<d.length;i+=4) s += d[i];
    cov.push([chr, s/(255*cw*ch)]);
  }
  cov.sort((a,b)=>a[1]-b[1]);
  // pick evenly spaced coverage levels
  const N = Math.min(18, cov.length), lo = cov[0][1], hi = cov[cov.length-1][1];
  const used = new Set(), ramp = [];
  for (let i=0;i<N;i++){
    const target = lo + (hi-lo)*Math.pow(i/(N-1), 1.15);
    let best = null, bd = 1e9;
    for (const e of cov) { if (used.has(e[0])) continue; const dd = Math.abs(e[1]-target); if (dd < bd) { bd = dd; best = e; } }
    used.add(best[0]); ramp.push(best);
  }
  ramp.sort((a,b)=>a[1]-b[1]);
  const chars = [' '].concat(ramp.map(e=>e[0]), DIR_CHARS);
  const ac = document.createElement('canvas'); ac.width = cw*chars.length; ac.height = ch;
  const ax = ac.getContext('2d');
  ax.font = font; ax.textAlign = 'center'; ax.textBaseline = 'middle'; ax.fillStyle = '#fff';
  chars.forEach((c,i)=>ax.fillText(c, i*cw + cw/2, ch/2 + fontPx*0.03));
  gl.bindTexture(gl.TEXTURE_2D, atlas.tex);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, ac);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  atlas.count = chars.length; atlas.levels = ramp.length; atlas.dir0 = ramp.length + 1; atlas.chars = chars.join('');
}

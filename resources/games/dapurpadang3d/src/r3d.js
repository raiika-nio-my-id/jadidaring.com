/* Dapur Padang Panik 3D: tiny inline WebGL renderer (no libraries). Lit primitives for the kitchen and chefs,
   camera-facing textured billboards for food (drawn from the 2D item art), and a 2D overlay canvas for labels.
   World: x = sim x, z = sim y, y = up; one tile = 1 unit; counters are 0.9 high. Exported as window.R3. */
(function (root) {
'use strict';
const D = root.DP, CH = 0.9;
/* ---------- math (column-major 4x4) ---------- */
function mul(a, b) { const o = new Float32Array(16); for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { let s = 0; for (let k = 0; k < 4; k++) s += a[k * 4 + j] * b[i * 4 + k]; o[i * 4 + j] = s; } return o; }
function persp(fov, asp, n, f) { const t = 1 / Math.tan(fov / 2), nf = 1 / (n - f); return new Float32Array([t / asp, 0, 0, 0, 0, t, 0, 0, 0, 0, (f + n) * nf, -1, 0, 0, 2 * f * n * nf, 0]); }
function lookAt(e, c) {
  let zx = e[0] - c[0], zy = e[1] - c[1], zz = e[2] - c[2], l = Math.hypot(zx, zy, zz) || 1; zx /= l; zy /= l; zz /= l;
  let xx = zz, xy = 0, xz = -zx; l = Math.hypot(xx, xz) || 1; xx /= l; xz /= l; // up = +y
  const yx = zy * xz - zz * xy, yy = zz * xx - zx * xz, yz = zx * xy - zy * xx;
  return new Float32Array([xx, yx, zx, 0, xy, yy, zy, 0, xz, yz, zz, 0, -(xx * e[0] + xy * e[1] + xz * e[2]), -(yx * e[0] + yy * e[1] + yz * e[2]), -(zx * e[0] + zy * e[1] + zz * e[2]), 1]);
}
const MM = new Float32Array(16);
function model(tx, ty, tz, ry, sx, sy, sz, rz) {
  const cy = Math.cos(ry || 0), syn = Math.sin(ry || 0), cz = Math.cos(rz || 0), szn = Math.sin(rz || 0);
  MM[0] = cy * cz * sx; MM[1] = szn * sx; MM[2] = -syn * cz * sx; MM[3] = 0;
  MM[4] = -cy * szn * sy; MM[5] = cz * sy; MM[6] = syn * szn * sy; MM[7] = 0;
  MM[8] = syn * sz; MM[9] = 0; MM[10] = cy * sz; MM[11] = 0;
  MM[12] = tx; MM[13] = ty; MM[14] = tz; MM[15] = 1; return MM;
}
const hex = h => { const n = parseInt(h.slice(1), 16); return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255]; };
const CC = {}; const col = h => CC[h] || (CC[h] = hex(h));
/* ---------- meshes ---------- */
function cube() { const p = [], n = []; const F = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
  for (const f of F) { const a = f.findIndex(v => v), s = f[a], u = [0, 0, 0], v = [0, 0, 0]; u[(a + 1) % 3] = 1; v[(a + 2) % 3] = 1;
    const c = (i, j) => [0, 1, 2].map(k => (k === a ? s * 0.5 : 0) + u[k] * i * 0.5 + v[k] * j * 0.5); const q = [c(-1, -1), c(1, -1), c(1, 1), c(-1, -1), c(1, 1), c(-1, 1)];
    if (s < 0) q.reverse(); for (const x of q) { p.push(...x); n.push(...f); } } return { p, n }; }
function cyl(N = 18, top = 0.5) { const p = [], n = [];
  for (let i = 0; i < N; i++) { const a0 = i / N * Math.PI * 2, a1 = (i + 1) / N * Math.PI * 2, c0 = Math.cos(a0), s0 = Math.sin(a0), c1 = Math.cos(a1), s1 = Math.sin(a1);
    const b0 = [c0 * 0.5, -0.5, s0 * 0.5], b1 = [c1 * 0.5, -0.5, s1 * 0.5], t0 = [c0 * top, 0.5, s0 * top], t1 = [c1 * top, 0.5, s1 * top];
    const sl = (0.5 - top), n0 = [c0, sl, s0], n1 = [c1, sl, s1];
    p.push(...b0, ...t1, ...b1, ...b0, ...t0, ...t1); n.push(...n0, ...n1, ...n1, ...n0, ...n0, ...n1);
    if (top > 0) { p.push(0, 0.5, 0, ...t1, ...t0); n.push(0, 1, 0, 0, 1, 0, 0, 1, 0); }
    p.push(0, -0.5, 0, ...b0, ...b1); n.push(0, -1, 0, 0, -1, 0, 0, -1, 0); } return { p, n }; }
function sph(A = 14, B = 9) { const p = [], n = [], v = (i, j) => { const t = j / B * Math.PI, f = i / A * Math.PI * 2; return [Math.sin(t) * Math.cos(f) * 0.5, Math.cos(t) * 0.5, Math.sin(t) * Math.sin(f) * 0.5]; };
  for (let j = 0; j < B; j++) for (let i = 0; i < A; i++) { const a = v(i, j), b = v(i + 1, j), c = v(i + 1, j + 1), d = v(i, j + 1); for (const x of [a, c, b, a, d, c]) { p.push(...x); n.push(x[0] * 2, x[1] * 2, x[2] * 2); } } return { p, n }; }
/* ---------- shaders ---------- */
const VS = 'attribute vec3 p;attribute vec3 n;uniform mat4 VP,M;varying vec3 vn,vw;void main(){vec4 w=M*vec4(p,1.0);vw=w.xyz;vn=(M*vec4(n,0.0)).xyz;gl_Position=VP*w;}';
const FS = 'precision mediump float;varying vec3 vn,vw;uniform vec3 col,emi,eye,fog;uniform float al,chk;void main(){vec3 N=normalize(vn);vec3 c=col;' +
  'if(chk>0.5){float k=mod(floor(vw.x)+floor(vw.z),2.0);c=mix(c,c*0.9,k);} if(chk>1.5){float g=step(0.96,fract(vw.x))+step(0.96,fract(vw.z));c*=1.0-0.12*min(g,1.0);}' +
  'float d=max(dot(N,normalize(vec3(0.35,1.0,0.45))),0.0);vec3 r=c*(0.48+0.55*d+0.08*N.y)+emi;float fd=length(vw-eye);r=mix(r,fog,smoothstep(14.0,30.0,fd));gl_FragColor=vec4(r,al);}';
const BVS = 'attribute vec2 q;uniform mat4 VP;uniform vec3 C,R,U;uniform vec2 S;varying vec2 uv;void main(){uv=vec2(q.x+0.5,0.5-q.y);gl_Position=VP*vec4(C+R*q.x*S.x+U*q.y*S.y,1.0);}';
const BFS = 'precision mediump float;varying vec2 uv;uniform sampler2D t;uniform float al;void main(){vec4 c=texture2D(t,uv);if(c.a<0.35)discard;gl_FragColor=vec4(c.rgb,c.a*al);}';
function prog(gl, vs, fs) { const mk = (t, s) => { const o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw Error(gl.getShaderInfoLog(o)); return o; };
  const p = gl.createProgram(); gl.attachShader(p, mk(gl.VERTEX_SHADER, vs)); gl.attachShader(p, mk(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(p); if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw Error(gl.getProgramInfoLog(p));
  const u = {}, n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS); for (let i = 0; i < n; i++) { const a = gl.getActiveUniform(p, i); u[a.name] = gl.getUniformLocation(p, a.name); }
  return { p, u, a: { p: gl.getAttribLocation(p, 'p'), n: gl.getAttribLocation(p, 'n'), q: gl.getAttribLocation(p, 'q') } }; }
const POT_COL = { ikanP: '#f0a99a', dagingP: '#8f2424', santan: '#fff8ea', bumbu: '#e0752b' };
function potColor(pot) {
  if (!pot.c.length) return null; if (pot.s === 3) return '#1a1110'; if (pot.s === 2) return pot.r === 'rendang' ? '#4a2512' : '#f0a020';
  if (pot.s === 1) { const p = Math.min(1, pot.t / (D.CFG.recipes[pot.r].cook * 1000)), a = pot.r === 'rendang' ? [200, 120, 70] : [250, 220, 170], b = pot.r === 'rendang' ? [74, 37, 18] : [240, 160, 32]; return '#' + a.map((v, i) => Math.round(v + (b[i] - v) * p).toString(16).padStart(2, '0')).join(''); }
  return POT_COL[pot.c[pot.c.length - 1]] || '#fff8ea';
}
const CRATE_FILL = { D: ['#a3262a', 'box'], I: ['#6f9fbe', 'fish'], H: ['#2f8f3a', 'chili'], M: ['#6b4226', 'ball'], B: ['#e0752b', 'ball'] };

/* =====================================================================
   create(canvas, overlay, art) -> renderer. art = { drawItem, bar, rr } from the 2D app (shared look).
   ===================================================================== */
function create(cv, ov, art) {
  const gl = cv.getContext('webgl', { antialias: true, alpha: false, preserveDrawingBuffer: false }) || cv.getContext('experimental-webgl');
  if (!gl) return null;
  const P = prog(gl, VS, FS), B = prog(gl, BVS, BFS);
  const buf = m => { const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(m.p.concat(m.n)), gl.STATIC_DRAW); return { b, n: m.p.length / 3, off: m.p.length * 4 }; };
  const ME = { box: buf(cube()), cyl: buf(cyl()), cone: buf(cyl(14, 0)), sph: buf(sph()), bowl: buf(cyl(18, 0.62)) };
  const qb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, qb); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-0.5, -0.5, 0.5, -0.5, 0.5, 0.5, -0.5, -0.5, 0.5, 0.5, -0.5, 0.5]), gl.STATIC_DRAW);
  const og = ov.getContext('2d'); const tex = {};
  let VP = null, V = null, PJ = null, eye = [0, 5, 5], W = 1, H = 1, dpr = 1, cur = null, alpha = 1, emi = [0, 0, 0];
  const FOG = hex('#2a170d');
  function bind(m) { if (cur === m) return; cur = m; gl.bindBuffer(gl.ARRAY_BUFFER, m.b); gl.enableVertexAttribArray(P.a.p); gl.vertexAttribPointer(P.a.p, 3, gl.FLOAT, false, 0, 0); gl.enableVertexAttribArray(P.a.n); gl.vertexAttribPointer(P.a.n, 3, gl.FLOAT, false, 0, m.off); }
  function draw(m, c, tx, ty, tz, ry, sx, sy, sz, rz) { bind(m); gl.uniformMatrix4fv(P.u.M, false, model(tx, ty, tz, ry, sx, sy, sz, rz)); const k = typeof c === 'string' ? col(c) : c; gl.uniform3f(P.u.col, k[0], k[1], k[2]); gl.drawArrays(gl.TRIANGLES, 0, m.n); }
  const setEmi = (r, g, b) => { if (emi[0] === r && emi[1] === g && emi[2] === b) return; emi = [r, g, b]; gl.uniform3f(P.u.emi, r, g, b); };
  const setAl = a => { if (a === alpha) return; alpha = a; gl.uniform1f(P.u.al, a); };
  /* textures (2D art -> GL), cached by key */
  function texture(key, paint, w = 128, h = 128) {
    if (tex[key]) return tex[key]; const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); paint(g, w, h);
    const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t); gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, c);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return (tex[key] = t);
  }
  const itemTex = it => texture('i:' + it, (g, w) => art.drawItem(g, it, w / 2, w / 2, w * 0.36));
  const signTex = it => texture('s:' + it, (g, w) => { g.fillStyle = '#fffaf0'; g.beginPath(); g.arc(w / 2, w / 2, w * 0.46, 0, 7); g.fill(); g.lineWidth = w * 0.05; g.strokeStyle = '#7a1f14'; g.stroke(); art.drawItem(g, it, w / 2, w / 2, w * 0.27); });
  const faceTex = f => texture('f:' + f, (g, w) => { g.font = Math.round(w * 0.8) + 'px system-ui,"Apple Color Emoji","Noto Color Emoji"'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(f, w / 2, w * 0.55); });
  const bannerTex = () => texture('banner', (g, w, h) => { g.fillStyle = '#7a1f14'; g.fillRect(0, 0, w, h); g.fillStyle = '#f2b705'; g.fillRect(0, 6, w, 6); g.fillRect(0, h - 12, w, 6);
    g.fillStyle = '#fff3d6'; g.font = '900 ' + Math.round(h * 0.42) + 'px system-ui'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('RUMAH MAKAN PADANG · DAPUR PANIK', w / 2, h * 0.53); }, 1024, 128);
  let bq = false; const bbs = [];
  function billboard(t, x, y, z, s, a = 1, sy) { bbs.push([t, x, y, z, s, sy || s, a]); }
  function flushBB() {
    if (!bbs.length) return; gl.useProgram(B.p); gl.uniformMatrix4fv(B.u.VP, false, VP); gl.uniform3f(B.u.R, V[0], V[4], V[8]); gl.uniform3f(B.u.U, V[1], V[5], V[9]);
    gl.bindBuffer(gl.ARRAY_BUFFER, qb); gl.disableVertexAttribArray(P.a.n); gl.enableVertexAttribArray(B.a.q); gl.vertexAttribPointer(B.a.q, 2, gl.FLOAT, false, 0, 0); gl.activeTexture(gl.TEXTURE0); gl.uniform1i(B.u.t, 0);
    for (const [t, x, y, z, s, sy, a] of bbs) { gl.bindTexture(gl.TEXTURE_2D, t); gl.uniform3f(B.u.C, x, y, z); gl.uniform2f(B.u.S, s, sy); gl.uniform1f(B.u.al, a); gl.drawArrays(gl.TRIANGLES, 0, 6); }
    bbs.length = 0; cur = null; gl.useProgram(P.p);
  }
  /* flat billboard (fixed orientation, for the wall banner) drawn as a textured "box face": reuse the billboard shader with custom axes */
  function wallTex(t, x, y, z, w, h) { gl.useProgram(B.p); gl.uniformMatrix4fv(B.u.VP, false, VP); gl.uniform3f(B.u.R, 1, 0, 0); gl.uniform3f(B.u.U, 0, 1, 0); gl.bindBuffer(gl.ARRAY_BUFFER, qb); gl.disableVertexAttribArray(P.a.n); gl.enableVertexAttribArray(B.a.q); gl.vertexAttribPointer(B.a.q, 2, gl.FLOAT, false, 0, 0); gl.bindTexture(gl.TEXTURE_2D, t); gl.uniform1i(B.u.t, 0); gl.uniform3f(B.u.C, x, y, z); gl.uniform2f(B.u.S, w, h); gl.uniform1f(B.u.al, 1); gl.drawArrays(gl.TRIANGLES, 0, 6); cur = null; gl.useProgram(P.p); }
  function project(x, y, z) { const m = VP, cx = m[0] * x + m[4] * y + m[8] * z + m[12], cy = m[1] * x + m[5] * y + m[9] * z + m[13], w = m[3] * x + m[7] * y + m[11] * z + m[15];
    if (w < 0.1) return { x: 0, y: 0, k: 0, on: false, w };
    const sx = (cx / w * 0.5 + 0.5) * W, sy = (1 - (cy / w * 0.5 + 0.5)) * H; return { x: sx, y: sy, k: H * 0.5 * PJ[5] / w, on: sx > -40 && sx < W + 40 && sy > -40 && sy < H + 40, w }; }
  function resize(w, h, r) { W = Math.max(1, w); H = Math.max(1, h); dpr = r; for (const c of [cv, ov]) { c.width = Math.round(W * r); c.height = Math.round(H * r); c.style.width = W + 'px'; c.style.height = H + 'px'; } }

  /* ---------- scene parts ---------- */
  function room(sim, now) {
    // outer floor + walls
    gl.uniform1f(P.u.chk, 2); draw(ME.box, '#6b4226', D.W / 2, -0.05, D.H / 2, 0, D.W + 12, 0.1, D.H + 12); gl.uniform1f(P.u.chk, 0);
    gl.uniform1f(P.u.chk, 1); draw(ME.box, '#fbecd2', D.W / 2, -0.03, D.H / 2, 0, D.W - 0.02, 0.1, D.H - 0.02); gl.uniform1f(P.u.chk, 0);
    const m = 5.2, wx0 = -m, wx1 = D.W + m, wz0 = -m, wz1 = D.H + m, WH = 3.2;
    for (const [x, z, sx, sz] of [[D.W / 2, wz0, D.W + 2 * m, 0.3], [D.W / 2, wz1, D.W + 2 * m, 0.3], [wx0, D.H / 2, 0.3, D.H + 2 * m], [wx1, D.H / 2, 0.3, D.H + 2 * m]]) {
      draw(ME.box, '#f3e2c4', x, WH / 2, z, 0, sx, WH, sz); draw(ME.box, '#8a5a32', x, 0.5, z, 0, sx + 0.06, 1, sz + 0.06); draw(ME.box, '#b3261e', x, 1.05, z, 0, sx + 0.08, 0.1, sz + 0.08); }
    // hanging lamps over the dining tables (kept out of the camera path)
    for (let i = 0; i < 4; i++) { const x = D.W + 2.4, z = 1.2 + i * 2.1; draw(ME.cyl, '#3b2416', x, 3.0, z, 0, 0.03, 0.9, 0.03); setEmi(0.5, 0.42, 0.2); draw(ME.cone, '#f2b705', x, 2.45, z, 0, 0.6, 0.35, 0.6); draw(ME.sph, '#fff3c0', x, 2.28, z, 0, 0.22, 0.22, 0.22); setEmi(0, 0, 0); }
    // dining area east of the window: tables + waiting customers (one per open order)
    for (let i = 0; i < 4; i++) { const z = 1.2 + i * 2.1, x = D.W + 2.4; draw(ME.cyl, '#8a5a32', x, 0.72, z, 0, 1.1, 0.06, 1.1); draw(ME.cyl, '#5a3622', x, 0.36, z, 0, 0.12, 0.72, 0.12); }
    const ords = sim.orders || [];
    ords.slice(0, 6).forEach((o, i) => {
      const r = Math.max(0, o.t / o.T), z = 0.8 + i * 1.45, x = D.W + 1.45, sh = r < 0.25 && !sim.tut ? Math.sin(now / 40 + i) * 0.04 : 0, hop = r < 0.25 && !sim.tut ? Math.abs(Math.sin(now / 120 + i)) * 0.08 : 0;
      const cc = ['#7e57c2', '#26a69a', '#ef6c00', '#5c6bc0', '#8d6e63', '#ec407a'][o.id % 6];
      draw(ME.cyl, cc, x + sh, 0.55 + hop, z, 0, 0.42, 0.62, 0.42); draw(ME.sph, '#e8b98f', x + sh, 1.05 + hop, z, 0, 0.36, 0.36, 0.36);
      draw(ME.cyl, '#2b1a10', x + sh, 1.2 + hop, z, 0, 0.3, 0.08, 0.3);
      billboard(faceTex(sim.tut ? '😋' : r > 0.55 ? '😋' : r > 0.25 ? '😐' : '😡'), x + sh, 1.62 + hop, z, 0.42);
    });
  }
  function counter(s, hl, tut, now) {
    const x = s.x + 0.5, z = s.y + 0.5, c = s.c;
    const body = c === 'L' ? '#7a1f14' : D.CRATE[c] ? '#6b4226' : '#8a5a32', top = c === 'K' ? '#3a3f45' : c === 'L' ? '#fff3d6' : '#e8c48f';
    draw(ME.box, body, x, (CH - 0.08) / 2, z, 0, 1, CH - 0.08, 1);
    if (tut) { const p = 0.35 + 0.3 * Math.sin(now / 150); setEmi(p, 0.05, 0.02); } else if (hl) { const p = 0.18 + 0.1 * Math.sin(now / 160); setEmi(p, p * 0.85, 0.05); }
    draw(ME.box, top, x, CH - 0.04, z, 0, 1.0, 0.08, 1.0); setEmi(0, 0, 0);
  }
  function station(sim, s, now, fx) {
    const x = s.x + 0.5, z = s.y + 0.5, c = s.c, y = CH;
    if (D.CRATE[c]) { draw(ME.box, '#a56a35', x, y + 0.16, z, 0, 0.84, 0.32, 0.84); draw(ME.box, '#6b4226', x, y + 0.3, z, 0, 0.7, 0.06, 0.7);
      const [fc, sh] = CRATE_FILL[c]; for (let k = 0; k < 5; k++) { const ox = ((k * 37) % 5 - 2) * 0.12, oz = ((k * 23) % 5 - 2) * 0.12;
        if (sh === 'box') draw(ME.box, fc, x + ox, y + 0.36, z + oz, k, 0.22, 0.1, 0.16); else if (sh === 'fish') draw(ME.sph, fc, x + ox, y + 0.36, z + oz, k * 0.8, 0.36, 0.1, 0.14); else if (sh === 'chili') draw(ME.cyl, fc, x + ox, y + 0.36, z + oz, k * 0.9, 0.06, 0.3, 0.06, Math.PI / 2); else draw(ME.sph, fc, x + ox, y + 0.38, z + oz, 0, 0.18, 0.18, 0.18); }
      draw(ME.cyl, '#5a3622', x, y + 0.6, z, 0, 0.04, 0.6, 0.04); billboard(signTex(D.CRATE[c]), x, y + 1.05, z, 0.5); }
    else if (c === 'N') { draw(ME.cyl, '#f4f4f4', x, y + 0.22, z, 0, 0.6, 0.44, 0.6); draw(ME.sph, '#e86a8a', x, y + 0.44, z, 0, 0.58, 0.2, 0.58); draw(ME.sph, '#5fc05f', x + 0.3, y + 0.2, z, 0, 0.06, 0.06, 0.06);
      if (fx && Math.random() < 0.02) fx.puff3(x, y + 0.6, z, '#ffffff', 0.4); }
    else if (c === 'P') { for (let k = 0; k < 4; k++) draw(ME.cyl, k % 2 ? '#e8edf2' : '#ffffff', x, y + 0.03 + k * 0.045, z, 0, 0.62, 0.04, 0.62); }
    else if (c === 'T') { draw(ME.box, '#d9a86b', x, y + 0.04, z, 0.15, 0.78, 0.06, 0.58); draw(ME.box, '#c0c7ce', x + 0.18, y + 0.09, z - 0.2, 0.15, 0.36, 0.02, 0.07); draw(ME.box, '#3b2416', x - 0.06, y + 0.09, z - 0.17, 0.15, 0.14, 0.04, 0.06); }
    else if (c === 'U') { draw(ME.bowl, '#5c5c5c', x, y + 0.08, z, 0, 0.74, 0.16, 0.74); draw(ME.cyl, '#3d3d3d', x, y + 0.165, z, 0, 0.5, 0.01, 0.5); draw(ME.cyl, '#777777', x + 0.12, y + 0.26, z - 0.08, 0.7, 0.1, 0.34, 0.1, 0.7); if (s.it === 'cabai' || s.it === 'sambal') draw(ME.cyl, s.it === 'sambal' ? '#4c9a2a' : '#2f8f3a', x, y + 0.17, z, 0, 0.42, 0.02, 0.42); }
    else if (c === 'K') stove(s, x, z, now, fx);
    else if (c === 'L') { for (let k = 0; k < 4; k++) draw(ME.box, k % 2 ? '#ffffff' : '#c62828', x + 0.25, y + 1.05, z - 0.375 + k * 0.25, 0, 0.5, 0.06, 0.25, -0.35); draw(ME.cyl, '#5a3622', x + 0.45, y + 0.5, z - 0.45, 0, 0.05, 1.0, 0.05); draw(ME.cyl, '#5a3622', x + 0.45, y + 0.5, z + 0.45, 0, 0.05, 1.0, 0.05);
      setEmi(0.15, 0.1, 0); draw(ME.sph, '#f2b705', x, y + 0.08, z, 0, 0.2, 0.16, 0.2); setEmi(0, 0, 0); draw(ME.cyl, '#7a5a00', x, y + 0.02, z, 0, 0.26, 0.03, 0.26); }
    else if (c === 'X') { draw(ME.cyl, '#7d8a93', x, y + 0.25, z, 0, 0.56, 0.5, 0.56); draw(ME.cyl, '#5c6870', x, y + 0.52, z, 0, 0.62, 0.06, 0.62); draw(ME.box, '#5c6870', x, y + 0.58, z, 0, 0.2, 0.05, 0.06); }
    if (s.it && is3food(s.it) && c !== 'U') food3(s.it, x, y + 0.01, z, 1.15, 0, now);
    else if (s.it && c !== 'U') { const bob = s.p > 0 ? Math.sin(now / 60) * 0.02 : 0; billboard(itemTex(s.it), x, y + (c === 'T' ? 0.32 : 0.3) + bob, z, D.isPlate(s.it) ? 0.62 : 0.5); }
    else if (s.it) billboard(itemTex(s.it), x, y + 0.52, z, 0.44);
  }
  function stove(s, x, z, now, fx) {
    const pot = s.pot, y = CH;
    for (const [dx, dz] of [[-0.42, -0.42], [0.42, -0.42], [-0.42, 0.42], [0.42, 0.42]]) draw(ME.box, '#22262a', x + dx * 0.9, y + 0.04, z + dz * 0.9, 0, 0.12, 0.08, 0.12);
    draw(ME.cyl, '#22262a', x, y + 0.03, z, 0, 0.5, 0.04, 0.5);
    if (pot.s === 1 || pot.s === 2) { setEmi(0.7, 0.35, 0); for (let k = 0; k < 7; k++) { const a = k / 7 * Math.PI * 2 + now / 300, fl = 0.7 + 0.3 * Math.sin(now / 60 + k * 2); draw(ME.cone, k % 2 ? '#ff9d2e' : '#ffd23f', x + Math.cos(a) * 0.22, y + 0.1 + fl * 0.05, z + Math.sin(a) * 0.22, 0, 0.1, 0.16 * fl, 0.1); } setEmi(0, 0, 0); }
    draw(ME.bowl, '#16181b', x, y + 0.2, z, 0, 0.78, 0.2, 0.78); // wok (tapered bowl)
    draw(ME.box, '#16181b', x + 0.48, y + 0.27, z, 0, 0.26, 0.05, 0.08);
    const pc = potColor(pot);
    if (pc) { if (pot.s === 3) setEmi(0, 0, 0); draw(ME.cyl, pc, x, y + 0.27, z, 0, 0.58, 0.02, 0.58); if (pot.s === 0) pot.c.forEach((it, i) => draw(ME.sph, POT_COL[it] || '#fff', x - 0.14 + i * 0.14, y + 0.3, z + ((i % 2) - 0.5) * 0.1, 0, 0.12, 0.08, 0.12));
      if (pot.s === 1 && fx && Math.random() < 0.08) fx.puff3(x, y + 0.45, z, '#ffffff', 0.45); if (pot.s === 2 && fx && Math.random() < 0.05) fx.puff3(x, y + 0.45, z, '#ffffff', 0.5); if (pot.s === 3 && fx && Math.random() < 0.18) fx.puff3(x, y + 0.45, z, '#333333', 0.8); }
  }

  /* 3D food: plates and ready-to-plate food are modelled (not billboards) with strong, unique looks:
     nasi = white dome, gulai = bright yellow curry bowl + pink fish, rendang = dark-brown glossy chunks, sambal ijo = green chunky mound */
  const FOOD3 = { nasi: 1, sambal: 1, rendang: 1, gulai: 1 };
  const is3food = it => D.isPlate(it) || FOOD3[it];
  function food(kind, x, y, z, k, now) {
    if (kind === 'nasi') { draw(ME.sph, '#ffffff', x, y + 0.06 * k, z, 0, 0.3 * k, 0.2 * k, 0.3 * k); draw(ME.sph, '#eef2f5', x + 0.05 * k, y + 0.12 * k, z - 0.03 * k, 0, 0.1 * k, 0.06 * k, 0.1 * k); }
    else if (kind === 'gulai') { draw(ME.bowl, '#f7f3ea', x, y + 0.05 * k, z, 0, 0.34 * k, 0.1 * k, 0.34 * k); setEmi(0.12, 0.07, 0); draw(ME.cyl, '#f5a40f', x, y + 0.095 * k, z, 0, 0.27 * k, 0.012 * k, 0.27 * k); setEmi(0, 0, 0);
      draw(ME.box, '#f2a093', x - 0.03 * k, y + 0.115 * k, z, 0.5, 0.13 * k, 0.04 * k, 0.08 * k); draw(ME.sph, '#c0392b', x + 0.07 * k, y + 0.11 * k, z + 0.05 * k, 0, 0.04 * k, 0.03 * k, 0.04 * k); draw(ME.sph, '#2e7d32', x + 0.08 * k, y + 0.11 * k, z - 0.06 * k, 0, 0.06 * k, 0.015 * k, 0.03 * k); }
    else if (kind === 'rendang') { for (const [dx, dz, r] of [[-0.06, -0.04, 0.4], [0.07, -0.02, 1.3], [0, 0.07, 2.2], [0.02, 0.0, 0.9]]) draw(ME.box, '#3d1d0b', x + dx * k, y + 0.05 * k + (r > 2 ? 0.04 * k : 0), z + dz * k, r, 0.12 * k, 0.08 * k, 0.1 * k);
      setEmi(0.08, 0.03, 0); draw(ME.sph, '#8a3b12', x, y + 0.03 * k, z, 0, 0.26 * k, 0.04 * k, 0.24 * k); setEmi(0, 0, 0); draw(ME.sph, '#e0752b', x - 0.05 * k, y + 0.1 * k, z + 0.06 * k, 0, 0.03 * k, 0.02 * k, 0.03 * k); }
    else if (kind === 'sambal') { draw(ME.sph, '#2f8a1c', x, y + 0.04 * k, z, 0, 0.22 * k, 0.12 * k, 0.22 * k); for (const [dx, dz] of [[-0.05, 0.02], [0.05, -0.03], [0.01, 0.05], [0.03, 0.02]]) draw(ME.sph, '#8fe060', x + dx * k, y + 0.08 * k, z + dz * k, 0, 0.04 * k, 0.03 * k, 0.04 * k); draw(ME.sph, '#c62828', x - 0.02 * k, y + 0.09 * k, z - 0.04 * k, 0, 0.025 * k, 0.02 * k, 0.025 * k); }
  }
  const SLOT = { 1: [[0, 0]], 2: [[-0.12, 0], [0.12, 0]], 3: [[-0.13, -0.07], [0.13, -0.07], [0, 0.12]] };
  function food3(it, x, y, z, k, ry, now) {
    if (!D.isPlate(it)) { if (it === 'nasi') { draw(ME.bowl, '#3b6ea5', x, y + 0.05 * k, z, 0, 0.36 * k, 0.1 * k, 0.36 * k); food('nasi', x, y + 0.07 * k, z, k * 0.85, now); } else if (it === 'sambal') { draw(ME.bowl, '#6d6d6d', x, y + 0.05 * k, z, 0, 0.36 * k, 0.1 * k, 0.36 * k); food('sambal', x, y + 0.08 * k, z, k * 0.9, now); } else { draw(ME.cyl, '#ffffff', x, y + 0.015 * k, z, 0, 0.6 * k, 0.03 * k, 0.6 * k); food(it, x, y + 0.03 * k, z, k * 1.1, now); } return; }
    draw(ME.cyl, '#d9dee3', x, y + 0.012 * k, z, 0, 0.66 * k, 0.025 * k, 0.66 * k); draw(ME.cyl, '#ffffff', x, y + 0.03 * k, z, 0, 0.56 * k, 0.012 * k, 0.56 * k);
    const a = D.plateOf(it), sl = SLOT[a.length] || [], c = Math.cos(-ry), sn = Math.sin(-ry);
    a.forEach((kd, i) => { const [lx, lz] = sl[i]; food(kd, x + (lx * c - lz * sn) * k, y + 0.035 * k, z + (lx * sn + lz * c) * k, k * (a.length > 1 ? 0.85 : 1.1), now); });
  }
  function chef(ch, d, now, o) {
    const x = d.x, z = d.y, f = d.f != null ? d.f : ch.f || 0, ry = -f, cf = Math.cos(f), sf = Math.sin(f), sp = Math.hypot(ch.vx || 0, ch.vy || 0), ph = now / 95, walk = sp > 0.3 ? Math.sin(ph) : 0, bob = sp > 0.3 ? Math.abs(Math.sin(ph)) * 0.05 : 0;
    const L = (lx, ly, lz) => [x + lx * cf - lz * sf, ly, z + lx * sf + lz * cf];
    const P3 = (m, c, lx, ly, lz, sx, sy, sz, rz) => { const p = L(lx, ly, lz); draw(m, c, p[0], p[1], p[2], ry, sx, sy, sz, rz); };
    const colr = D.COLORS[ch.c % 4];
    setAl(0.3); gl.enable(gl.BLEND); gl.depthMask(false); draw(ME.cyl, o.me ? '#ffe14d' : '#000000', x, 0.03, z, 0, o.me ? 0.86 : 0.7, 0.01, o.me ? 0.86 : 0.7); gl.depthMask(true); gl.disable(gl.BLEND); setAl(1);
    P3(ME.cyl, '#3b2416', walk * 0.12, 0.13, -0.1, 0.13, 0.26, 0.13); P3(ME.cyl, '#3b2416', -walk * 0.12, 0.13, 0.1, 0.13, 0.26, 0.13);
    P3(ME.cyl, colr, 0, 0.5 + bob, 0, 0.52, 0.5, 0.52); P3(ME.sph, colr, 0, 0.74 + bob, 0, 0.52, 0.2, 0.52);
    P3(ME.box, '#ffffff', 0.24, 0.45 + bob, 0, 0.06, 0.38, 0.34);
    P3(ME.sph, '#ffe0bd', 0, 0.95 + bob, 0, 0.42, 0.42, 0.42);
    P3(ME.sph, '#2b1a10', 0.19, 0.98 + bob, -0.075, 0.06, 0.07, 0.06); P3(ME.sph, '#2b1a10', 0.19, 0.98 + bob, 0.075, 0.06, 0.07, 0.06);
    P3(ME.sph, '#f0a58a', 0.21, 0.9 + bob, 0, 0.05, 0.04, 0.09);
    P3(ME.cyl, '#ffffff', 0, 1.16 + bob, 0, 0.36, 0.16, 0.36); P3(ME.sph, '#ffffff', 0, 1.3 + bob, 0, 0.5, 0.3, 0.5);
    const hold = !!ch.h, wk = o.work ? Math.sin(now / 45) * 0.12 : 0;
    P3(ME.sph, '#ffe0bd', hold ? 0.36 : 0.06 - walk * 0.1, hold ? 0.66 : 0.52 + bob, hold ? -0.17 : -0.3, 0.14, 0.14, 0.14); P3(ME.sph, '#ffe0bd', hold || o.work ? 0.36 : 0.06 + walk * 0.1, (hold ? 0.66 : 0.52) + bob + wk, hold ? 0.17 : 0.3, 0.14, 0.14, 0.14);
    if (o.work && !hold) { const p = L(0.5, 0.72 + wk, 0.16); draw(ME.box, '#c0c7ce', p[0], p[1], p[2], ry, 0.3, 0.03, 0.07, wk * 4); }
    if (hold && is3food(ch.h)) { const p = L(0.46, 0.68, 0); food3(ch.h, p[0], p[1] + bob, p[2], 0.95, ry, now); }
    else if (hold) { const p = L(0.44, 0.78, 0); billboard(itemTex(ch.h), p[0], p[1] + bob, p[2], 0.46); }
  }

  /* ---------- overlay (labels, bars, particles, tutorial arrows, minimap) ---------- */
  function label(t, p, k, gm, bg) { const g = og; g.font = '800 ' + Math.max(11, Math.min(16, k * 0.2)) + 'px system-ui'; const w = g.measureText(t + (gm ? ' (GM)' : '')).width; g.fillStyle = bg || 'rgba(0,0,0,.55)'; art.rr(g, p.x - w / 2 - 6, p.y - 18, w + 12, 20, 8); g.fill(); g.fillStyle = '#fff'; g.textAlign = 'left'; g.textBaseline = 'middle'; g.fillText(t, p.x - w / 2, p.y - 8); if (gm) { g.fillStyle = '#ff5a52'; g.fillText(' (GM)', p.x - w / 2 + g.measureText(t).width, p.y - 8); } }
  function bubble(t, p) { const g = og; g.font = '800 14px system-ui'; const w = Math.min(220, g.measureText(t).width + 16), h = 26; g.fillStyle = '#fff'; art.rr(g, p.x - w / 2, p.y - h - 8, w, h, 10); g.fill(); g.beginPath(); g.moveTo(p.x - 6, p.y - 8); g.lineTo(p.x + 6, p.y - 8); g.lineTo(p.x, p.y); g.fill(); g.fillStyle = '#2b1a10'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(t, p.x, p.y - h / 2 - 8, w - 8); }
  function arrowDown(x, y, s, colr) { const g = og; g.fillStyle = colr; g.strokeStyle = '#fff'; g.lineWidth = 2.5; g.beginPath(); g.moveTo(x, y); g.lineTo(x - s * 0.55, y - s * 0.55); g.lineTo(x - s * 0.22, y - s * 0.55); g.lineTo(x - s * 0.22, y - s * 1.1); g.lineTo(x + s * 0.22, y - s * 1.1); g.lineTo(x + s * 0.22, y - s * 0.55); g.lineTo(x + s * 0.55, y - s * 0.55); g.closePath(); g.fill(); g.stroke(); }
  function edgeArrow(p3, colr, top) { const g = og, c = project(p3[0], p3[1], p3[2]); let dx, dy;
    if (c.w < 0.1) { const m = VP, cx = m[0] * p3[0] + m[4] * p3[1] + m[8] * p3[2] + m[12]; dx = cx >= 0 ? -1 : 1; dx = -dx; dy = 0.6; } else { dx = c.x - W / 2; dy = c.y - H / 2; }
    const a = Math.atan2(dy, dx), mx = W / 2 - 34, my = H / 2 - 34, t = Math.min(Math.abs(mx / (Math.cos(a) || 1e-6)), Math.abs(my / (Math.sin(a) || 1e-6))), ex = W / 2 + Math.cos(a) * t, ey = H / 2 + Math.sin(a) * t + (top && Math.sin(a) < -0.5 ? 40 : 0);
    g.save(); g.translate(ex, ey); g.rotate(a); g.fillStyle = colr; g.strokeStyle = '#fff'; g.lineWidth = 3; g.beginPath(); g.moveTo(22, 0); g.lineTo(-10, -16); g.lineTo(-4, 0); g.lineTo(-10, 16); g.closePath(); g.fill(); g.stroke(); g.restore(); }
  const CHIP_COL = { nasi: '#ffffff', gulai: '#f5a40f', rendang: '#5a2a10', sambal: '#3f9a2a' };
  function heldChip(it, p) { // small "what am I holding" tag above the name: coloured dot per component
    const g = og, a = D.isPlate(it) ? D.plateOf(it) : [it], txt = (D.isPlate(it) ? '🍽 ' : '') + (a.length ? a.map(o2 => cname(o2)).join(' + ') : cname('plate'));
    g.font = '800 12px system-ui'; const w = g.measureText(txt).width + (a.length ? 14 : 0); const x0 = p.x - w / 2 - 6, y0 = p.y - 40;
    g.fillStyle = 'rgba(255,250,240,.92)'; art.rr(g, x0, y0, w + 12, 18, 9); g.fill(); g.strokeStyle = 'rgba(0,0,0,.25)'; g.lineWidth = 1; g.stroke();
    let cx = x0 + 6; if (a.length) { for (let i = 0; i < a.length; i++) { g.fillStyle = CHIP_COL[a[i]] || '#bbb'; g.beginPath(); g.arc(cx + 3 + i * 4, y0 + 9, 4, 0, 7); g.fill(); g.strokeStyle = '#555'; g.stroke(); } cx += 14; }
    g.fillStyle = '#2b1a10'; g.textAlign = 'left'; g.textBaseline = 'middle'; g.fillText(txt, cx, y0 + 9.5); }
  let cname = x => x;
  function overlay(sim, o) {
    const g = og, now = o.now, C = D.CFG; if (o.iname) cname = o.iname; g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
    // station status
    for (const s of sim.st) {
      const x = s.x + 0.5, z = s.y + 0.5;
      if (s.c === 'K') { const pot = s.pot, p = project(x, CH + 0.85, z); if (!p.on) continue; const k = p.k, bw = Math.max(34, k * 0.8), bh = Math.max(6, k * 0.12);
        if (pot.s === 1) art.bar(g, p.x, p.y, bw, bh, pot.t / (C.recipes[pot.r].cook * 1000), '#ffcc33');
        if (pot.s === 0 && pot.c.length) { const need = o.need(pot.c); need.forEach((it, i) => { const r = Math.max(10, k * 0.17), ix = p.x - (need.length - 1) * r * 1.1 + i * r * 2.2; g.fillStyle = 'rgba(255,255,255,.9)'; g.beginPath(); g.arc(ix, p.y, r, 0, 7); g.fill(); g.globalAlpha = 0.85; art.drawItem(g, it, ix, p.y, r * 0.7); g.globalAlpha = 1; }); }
        if (pot.s === 2) { const warn = pot.t > C.warnAfter * 1000, blink = warn && Math.floor(now / (pot.t > (C.burnAfter - 3) * 1000 ? 120 : 250)) % 2, r = Math.max(11, k * 0.18);
          g.fillStyle = warn ? (blink ? '#ff3b30' : '#ffcc00') : '#3ac25e'; g.beginPath(); g.arc(p.x, p.y, r, 0, 7); g.fill(); g.strokeStyle = '#fff'; g.lineWidth = 2; g.stroke(); g.fillStyle = '#fff'; g.font = '900 ' + Math.round(r * 1.3) + 'px system-ui'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(warn ? '!' : '✓', p.x, p.y + 1);
          if (warn) art.bar(g, p.x, p.y + r + 4, bw * 0.9, bh * 0.7, 1 - (pot.t - C.warnAfter * 1000) / ((C.burnAfter - C.warnAfter) * 1000), '#ff3b30'); }
        if (pot.s === 3) { g.font = '900 ' + Math.round(Math.max(16, k * 0.3)) + 'px system-ui'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#fff'; g.fillText('☠', p.x, p.y); if (s.p > 0) art.bar(g, p.x, p.y + 16, bw, bh, s.p, '#5bd16b'); }
      } else if (s.p > 0) { const p = project(x, CH + 0.75, z); if (p.on) art.bar(g, p.x, p.y, Math.max(34, p.k * 0.8), Math.max(6, p.k * 0.12), s.p, '#5bd16b'); }
    }
    // fx particles + floating text
    const fx = o.fx; if (fx) {
      for (const q of fx.P) { const p = project(q.x, q.h, q.z); if (!p.on) continue; g.globalAlpha = Math.max(0, q.life) * (q.k === 'puff' ? 0.45 : 1); g.fillStyle = q.col; g.beginPath(); g.arc(p.x, p.y, Math.max(1.5, (q.k === 'puff' ? q.s * (1.6 - q.life) * 0.5 : q.s) * p.k), 0, 7); g.fill(); }
      g.globalAlpha = 1;
      for (const f of fx.F) { let p = project(f.x, f.h, f.z); if (!p.on && f.big) p = { x: W / 2, y: H * 0.32 - (1 - f.life) * 40, k: 90, on: true }; if (!p.on) continue; const sz = Math.max(f.big ? 22 : 16, Math.min(f.big ? 40 : 28, p.k * (f.big ? 0.5 : 0.36)));
        g.globalAlpha = Math.min(1, f.life * 2.5); g.font = '900 ' + Math.round(sz) + 'px system-ui'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineWidth = 4; g.strokeStyle = 'rgba(40,15,5,.85)'; g.strokeText(f.t, p.x, p.y); g.fillStyle = f.col; g.fillText(f.t, p.x, p.y); }
      g.globalAlpha = 1;
    }
    // chef labels
    for (const ch of sim.chefs) { const d = (o.disp && o.disp[ch.id]) || ch, m = (o.meta && o.meta(ch)) || {}, p = project(d.x, 1.62, d.y); if (!p.on) continue;
      if (ch.h && o.iname) heldChip(ch.h, { x: p.x, y: p.y - (m.name ? 22 : 0) });
      if (m.name) label(m.name, p, p.k, m.gm); if (m.bubble) bubble(m.bubble, { x: p.x, y: p.y - (m.name ? 22 : 0) }); }
    // tutorial targets: bouncing arrow, or an edge arrow when off-screen
    for (const i of o.tut || []) { const s = sim.st[i]; if (!s) continue; const b = Math.sin(now / 180) * 6, p = project(s.x + 0.5, CH + 1.75, s.y + 0.5);
      if (p.on && p.x > 10 && p.x < W - 10 && p.y > 50 && p.y < H - 10) arrowDown(p.x, p.y - b, Math.max(26, Math.min(48, p.k * 0.5)), '#ff3b30'); else edgeArrow([s.x + 0.5, CH, s.y + 0.5], '#ff3b30', true); }
    if (o.tickets) o.tickets(g, W);
    if (o.mini) minimap(sim, o);
  }
  const MCOL = { '#': '#c99a63', K: '#3a3f45', L: '#c62828', P: '#ffffff', N: '#f4f4f4', T: '#d9a86b', U: '#5c5c5c', X: '#7d8a93', D: '#a3262a', I: '#6f9fbe', H: '#2f8f3a', M: '#6b4226', B: '#e0752b' };
  function minimap(sim, o) {
    const g = og, cs = Math.max(6, Math.min(9, Math.floor(W / 52))), mw = cs * D.W, mh = cs * D.H, x0 = W - mw - 10, y0 = (o.topY || 70) + 8, hlS = new Set(o.hl || []), tutS = new Set(o.tut || []);
    g.globalAlpha = 0.92; g.fillStyle = 'rgba(30,15,5,.75)'; art.rr(g, x0 - 4, y0 - 4, mw + 8, mh + 8, 6); g.fill(); g.fillStyle = '#fbecd2'; g.fillRect(x0, y0, mw, mh);
    for (const s of sim.st) { g.fillStyle = MCOL[s.c] || '#c99a63'; g.fillRect(x0 + s.x * cs + 0.5, y0 + s.y * cs + 0.5, cs - 1, cs - 1); if (tutS.has(s.i) && Math.floor(now() / 250) % 2) { g.strokeStyle = '#ff3b30'; g.lineWidth = 2; g.strokeRect(x0 + s.x * cs - 1, y0 + s.y * cs - 1, cs + 2, cs + 2); } else if (hlS.has(s.i)) { g.strokeStyle = '#ffe14d'; g.lineWidth = 1.5; g.strokeRect(x0 + s.x * cs, y0 + s.y * cs, cs, cs); } }
    for (const ch of sim.chefs) { const d = (o.disp && o.disp[ch.id]) || ch, px = x0 + d.x * cs, py = y0 + d.y * cs, f = ch.f || 0; g.fillStyle = D.COLORS[ch.c % 4]; g.beginPath(); g.arc(px, py, cs * 0.45, 0, 7); g.fill(); if (ch.id === o.meId) { g.strokeStyle = '#fff'; g.lineWidth = 1.5; g.stroke(); g.beginPath(); g.moveTo(px + Math.cos(o.yaw) * cs * 1.4, py + Math.sin(o.yaw) * cs * 1.4); g.lineTo(px + Math.cos(o.yaw + 2.5) * cs * 0.6, py + Math.sin(o.yaw + 2.5) * cs * 0.6); g.lineTo(px + Math.cos(o.yaw - 2.5) * cs * 0.6, py + Math.sin(o.yaw - 2.5) * cs * 0.6); g.closePath(); g.fillStyle = '#fff'; g.fill(); } }
    g.globalAlpha = 1;
  }
  const now = () => performance.now();

  /* ---------- frame ---------- */
  function render(sim, o) {
    const asp = W / H; PJ = persp(o.fov || 1.05, asp, 0.1, 60); eye = o.eye; V = lookAt(o.eye, o.at); VP = mul(PJ, V);
    gl.viewport(0, 0, cv.width, cv.height); gl.clearColor(FOG[0], FOG[1], FOG[2], 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT); gl.enable(gl.DEPTH_TEST); gl.enable(gl.CULL_FACE); gl.cullFace(gl.BACK); gl.frontFace(gl.CCW);
    gl.disable(gl.CULL_FACE); // meshes are built without strict winding; depth test is enough at this poly count
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.useProgram(P.p); cur = null; gl.uniformMatrix4fv(P.u.VP, false, VP); gl.uniform3f(P.u.eye, eye[0], eye[1], eye[2]); gl.uniform3f(P.u.fog, FOG[0], FOG[1], FOG[2]); gl.uniform1f(P.u.chk, 0); emi = [-1, 0, 0]; setEmi(0, 0, 0); alpha = -1; setAl(1);
    room(sim, o.now);
    wallTex(bannerTex(), D.W / 2, 2.35, -5.2 + 0.17, 9, 1.1);
    const hl = new Set(o.hl || []), tutS = new Set(o.tut || []);
    for (const s of sim.st) counter(s, hl.has(s.i), tutS.has(s.i), o.now);
    for (const s of sim.st) station(sim, s, o.now, o.fx);
    for (const ch of sim.chefs) chef(ch, (o.disp && o.disp[ch.id]) || ch, o.now, (o.meta && o.meta(ch)) || {});
    gl.enable(gl.BLEND); flushBB(); gl.disable(gl.BLEND);
    overlay(sim, o);
  }
  return { render, resize, project, gl, get size() { return [W, H]; } };
}
root.R3 = { create, CH };
})(window);

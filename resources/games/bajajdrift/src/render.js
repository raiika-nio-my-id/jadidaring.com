/* Bajaj Drift renderer: 2.5D oblique, painted Tree-of-Savior-like look (shaded solids, soft shadows, warm light), chase camera that follows the bajaj's heading. window.BR */
(function (root) {
'use strict';
const BD = root.BD, TAU = Math.PI * 2, K = 0.58, ZK = 0.81, clamp = BD.clamp, lerp = BD.lerp, angd = BD.angd;
const SUN = (() => { const v = [-0.45, -0.55, 0.7], l = Math.hypot(v[0], v[1], v[2]); return v.map(x => x / l); })(), SHX = 0.34, SHY = 0.42;
const RM = root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches;
function mul(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const HX = {}; const hex = c => HX[c] || (HX[c] = [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)]);
const CC = {}; function shade(c, f) { f = Math.round(f * 40) / 40; const k = c + f; if (CC[k]) return CC[k]; const h = hex(c); return (CC[k] = 'rgb(' + Math.min(255, h[0] * f | 0) + ',' + Math.min(255, h[1] * f | 0) + ',' + Math.min(255, h[2] * f | 0) + ')'); }
/* ---------- camera ---------- */
function P(c, x, y, z) { const dx = x - c.x, dy = y - c.y; return [c.W / 2 + (c.cs * dx - c.sn * dy) * c.S + c.ox, c.H * c.cy + ((c.sn * dx + c.cs * dy) * K - z * ZK) * c.S + c.oy]; }
const depth = (c, x, y) => c.sn * (x - c.x) + c.cs * (y - c.y);
function groundT(ctx, c) { const a = c.S * c.cs, b = c.S * K * c.sn, cc = -c.S * c.sn, d = c.S * K * c.cs, r = c.dpr; ctx.setTransform(a * r, b * r, cc * r, d * r, (c.W / 2 + c.ox - (a * c.x + cc * c.y)) * r, (c.H * c.cy + c.oy - (b * c.x + d * c.y)) * r); }
const screenT = (ctx, c) => ctx.setTransform(c.dpr, 0, 0, c.dpr, 0, 0);
/* ---------- solids: convex prism / frustum, back faces culled, sun shaded ---------- */
function solid(ctx, c, b, z0, t, z1, col, o) {
  o = o || {}; const n = b.length, V0 = c.sn * ZK, V1 = c.cs * ZK; let cx = 0, cy = 0; for (const p of b) { cx += p[0]; cy += p[1]; } cx /= n; cy /= n; const cz = (z0 + z1) / 2;
  const B = b.map(p => P(c, p[0], p[1], z0)), T = t.map(p => P(c, p[0], p[1], z1));
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n, q = [[b[i][0], b[i][1], z0], [b[j][0], b[j][1], z0], [t[j][0], t[j][1], z1], [t[i][0], t[i][1], z1]];
    let nx = 0, ny = 0, nz = 0, mx = 0, my = 0; for (let k = 0; k < 4; k++) { const u = q[k], v = q[(k + 1) % 4]; nx += (u[1] - v[1]) * (u[2] + v[2]); ny += (u[2] - v[2]) * (u[0] + v[0]); nz += (u[0] - v[0]) * (u[1] + v[1]); mx += u[0] / 4; my += u[1] / 4; }
    if (nx * (mx - cx) + ny * (my - cy) + nz * (-cz + (q[0][2] + q[2][2]) / 2) < 0) { nx = -nx; ny = -ny; nz = -nz; }
    const l = Math.hypot(nx, ny, nz); if (l < 1e-6 || (nx * V0 + ny * V1 + nz * K) / l <= 0.01) continue;
    const lit = 0.6 + 0.48 * Math.max(0, (nx * SUN[0] + ny * SUN[1] + nz * SUN[2]) / l);
    ctx.fillStyle = shade(o.side || col, lit); ctx.beginPath(); ctx.moveTo(B[i][0], B[i][1]); ctx.lineTo(B[j][0], B[j][1]); ctx.lineTo(T[j][0], T[j][1]); ctx.lineTo(T[i][0], T[i][1]); ctx.closePath(); ctx.fill();
    if (o.floors && Math.abs(nz) / l < 0.3) { ctx.strokeStyle = shade(o.win || col, lit * 0.78); ctx.lineWidth = Math.max(1, c.S * 0.35); ctx.beginPath(); for (let z = z0 + 1.6; z < z1 - 0.8; z += 3) { const u = (z - z0) / (z1 - z0), a = P(c, lerp(b[i][0], t[i][0], u), lerp(b[i][1], t[i][1], u), z), e = P(c, lerp(b[j][0], t[j][0], u), lerp(b[j][1], t[j][1], u), z); ctx.moveTo(lerp(a[0], e[0], 0.06), lerp(a[1], e[1], 0.06)); ctx.lineTo(lerp(a[0], e[0], 0.94), lerp(a[1], e[1], 0.94)); } ctx.stroke(); }
  }
  if (o.noTop) return; let ar = 0; for (let i = 0; i < n; i++) { const j = (i + 1) % n; ar += t[i][0] * t[j][1] - t[j][0] * t[i][1]; } if (Math.abs(ar) < 0.05) return;
  ctx.fillStyle = shade(o.top || col, 0.6 + 0.48 * SUN[2]); ctx.beginPath(); ctx.moveTo(T[0][0], T[0][1]); for (let i = 1; i < n; i++) ctx.lineTo(T[i][0], T[i][1]); ctx.closePath(); ctx.fill();
}
const rect = (x, y, a, hw, hd) => { const ca = Math.cos(a), sa = Math.sin(a); return [[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd]].map(p => [x + ca * p[0] - sa * p[1], y + sa * p[0] + ca * p[1]]); };
const scaleP = (pts, x, y, f) => pts.map(p => [x + (p[0] - x) * f, y + (p[1] - y) * f]);
function hull(pts) { pts = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]); const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]), lo = [], up = []; for (const p of pts) { while (lo.length > 1 && cr(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); } for (let i = pts.length - 1; i >= 0; i--) { const p = pts[i]; while (up.length > 1 && cr(up[up.length - 2], up[up.length - 1], pts[i]) <= 0) up.pop(); up.push(p); } return lo.slice(0, -1).concat(up.slice(0, -1)); }
function shadowPoly(path, b, t, z1) { const h = hull(b.concat(t.map(p => [p[0] + SHX * z1, p[1] + SHY * z1]))); path.moveTo(h[0][0], h[0][1]); for (let i = 1; i < h.length; i++) path.lineTo(h[i][0], h[i][1]); path.closePath(); }
/* ---------- textures ---------- */
const PAT = {};
function pat(ctx, key, base, dots, px, lines) {
  if (PAT[key]) return PAT[key]; const cv = document.createElement('canvas'); cv.width = cv.height = 64; const g = cv.getContext('2d'), r = mul(key.length * 97 + 3);
  g.fillStyle = base; g.fillRect(0, 0, 64, 64);
  for (let i = 0; i < 420; i++) { g.fillStyle = dots[i % dots.length]; const s = 1 + r() * 2.2; g.globalAlpha = 0.35 + r() * 0.5; g.fillRect(r() * 64, r() * 64, s, s * (lines === 'grass' ? 2.2 : 1)); }
  g.globalAlpha = 1; if (lines === 'tile') { g.strokeStyle = 'rgba(90,70,40,.22)'; g.lineWidth = 1.2; for (let i = 0; i <= 64; i += 16) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 64); g.moveTo(0, i); g.lineTo(64, i); g.stroke(); } }
  if (lines === 'block') { g.strokeStyle = 'rgba(40,36,30,.25)'; g.lineWidth = 1; for (let y = 0; y < 64; y += 8) { g.beginPath(); g.moveTo(0, y); g.lineTo(64, y); g.stroke(); for (let x = (y / 8) % 2 ? 0 : 8; x < 64; x += 16) { g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + 8); g.stroke(); } } }
  const p = ctx.createPattern(cv, 'repeat'); try { p.setTransform(new DOMMatrix().scale(1 / px)); } catch (e) { /* old */ } return (PAT[key] = p);
}
/* ---------- track geometry paths ---------- */
const GEO = {};
function offPath(T, o, ss) { const p = new Path2D(); for (let i = 0; i <= T.N; i += ss || 1) { const k = i % T.N, x = T.X[k] + T.NX[k] * o, y = T.Y[k] + T.NY[k] * o; if (i) p.lineTo(x, y); else p.moveTo(x, y); } p.closePath(); return p; }
function inside(T, x, y) { let c = false; for (let i = 0, j = T.N - 1; i < T.N; j = i++) { const yi = T.Y[i], yj = T.Y[j]; if ((yi > y) !== (yj > y) && x < (T.X[j] - T.X[i]) * (y - yi) / (yj - yi) + T.X[i]) c = !c; } return c; }
function geo(T) {
  if (GEO[T.id]) return GEO[T.id]; const G = { c: offPath(T, 0), eL: offPath(T, -T.w / 2 + 0.3), eR: offPath(T, T.w / 2 - 0.3), lim: [offPath(T, -T.lim), offPath(T, T.lim)] };
  const r = mul(T.id === 'monas' ? 71 : 23), it = [], free = (x, y, m) => Math.abs(BD.locate(T, x, y).d) > T.lim + m;
  const outerSide = s => { const p = BD.at(T, s), i = p.i, a = Math.hypot(T.X[i] + T.NX[i] * 5, T.Y[i] + T.NY[i] * 5), b = Math.hypot(T.X[i] - T.NX[i] * 5, T.Y[i] - T.NY[i] * 5); return a > b ? 1 : -1; };
  const offAt = (s, o) => { const p = BD.at(T, s); return [p.x + T.NX[p.i] * o, p.y + T.NY[p.i] * o, p.h]; };
  const tree = (x, y, big) => it.push({ k: 'tree', x, y, r: (big ? 2.2 : 1.6) + r() * 0.8, h: (big ? 5 : 3.6) + r() * 2, c: ['#4f8a3a', '#5b9440', '#3f7a3c', '#6c9a3a'][r() * 4 | 0], s: r() });
  const blds = [];
  if (T.id === 'monas') {
    it.push({ k: 'monas', x: 0, y: 0, r: 11, h: 62 });
    for (let s = 0; s < T.L; s += 6.5) for (const sd of [-1, 1]) { const p = offAt(s + r() * 2, sd * (T.lim + 2.4 + r() * 1.2)); if (free(p[0], p[1], 1.4)) tree(p[0], p[1], true); }
    for (let s = 3; s < T.L; s += 13) for (const sd of [-1, 1]) { const p = offAt(s, sd * (T.lim + 0.7)); if (free(p[0], p[1], 0.4)) it.push({ k: 'lamp', x: p[0], y: p[1], r: 0.5, h: 5.2 }); }
    for (let s = 0; s < T.L; s += 4) for (const sd of [-1, 1]) { const a = offAt(s, sd * (T.lim + 0.1)), b = offAt(s + 2, sd * (T.lim + 0.1)), e = offAt(s + 4, sd * (T.lim + 0.1)); if (free(a[0], a[1], -0.2) && free(e[0], e[1], -0.2) && free(b[0], b[1], -0.2)) it.push({ k: 'fence', x: b[0], y: b[1], r: 2.5, h: 1.2, p: [a, b, e] }); }
    for (let s = 0; s < T.L; s += 9) { const sd = outerSide(s); for (const row of [0, 1]) { const o = sd * (T.lim + 12 + row * 15 + r() * 3), p = offAt(s + r() * 4, o); if (!free(p[0], p[1], 8) || blds.some(q => Math.hypot(q[0] - p[0], q[1] - p[1]) < 11.5)) continue; blds.push(p); const tall = r(); it.push({ k: 'bld', x: p[0], y: p[1], a: p[2], w: 4.2 + r() * 1.6, d: 3.8 + r() * 1.2, r: 7, h: row ? 14 + tall * 30 : 7 + tall * 12, c: ['#e8dcc4', '#d9d3c7', '#c9d7d6', '#efe3cf', '#d6c2a3', '#a9c4cf'][r() * 6 | 0] }); } }
    for (let gx = -42; gx <= 42; gx += 7.5) for (let gy = -42; gy <= 42; gy += 7.5) { const x = gx + (r() - 0.5) * 4, y = gy + (r() - 0.5) * 4; if (Math.max(Math.abs(x), Math.abs(y)) < 17 || Math.abs(x) < 3.2 || Math.abs(y) < 3.2 || !inside(T, x, y) || !free(x, y, 2.5)) continue; tree(x, y, r() < 0.5); }
    const g0 = offAt(0, -(T.w / 2 + T.curb + 0.7)), g1 = offAt(0, T.w / 2 + T.curb + 0.7); it.push({ k: 'gate', x: (g0[0] + g1[0]) / 2, y: (g0[1] + g1[1]) / 2, a: g0, b: g1, r: T.w, h: 5.5, banner: 1 });
  } else {
    const houses = [];
    for (const sd of [-1, 1]) for (let s = 0; s < T.L;) { const w = 2.6 + r() * 1.1, d = 2.3 + r() * 0.6, p = offAt(s + w, sd * (T.lim + 0.35 + d)); s += w * 2 + 0.5;
      const box = rect(p[0], p[1], p[2], w, d); if (!box.every(q => free(q[0], q[1], 0.15)) || houses.some(q => Math.hypot(q[0] - p[0], q[1] - p[1]) < (q[2] + w) * 0.95)) continue; houses.push([p[0], p[1], w]);
      it.push({ k: 'house', x: p[0], y: p[1], a: p[2], w, d, r: w + 1, h: 2.6 + r() * 0.7, c: ['#f3e6c8', '#cfe7d6', '#f6d0c4', '#fbe7a1', '#cfe0ef', '#e9d5f0', '#f7f1e7'][r() * 7 | 0], roof: ['#b5552f', '#9d4a2c', '#c46a3a', '#6f7c86'][r() * 4 | 0] }); }
    for (let s = 5; s < T.L; s += 17) { const sd = (s / 17 | 0) % 2 ? 1 : -1, p = offAt(s, sd * (T.lim + 0.25)); if (free(p[0], p[1], -0.1)) it.push({ k: 'pole', x: p[0], y: p[1], r: 0.4, h: 6.4 }); }
    for (let s = 12; s < T.L - 10; s += 27) { const a = offAt(s, -(T.lim + 0.1)), b = offAt(s, T.lim + 0.1); it.push({ k: 'jem', x: (a[0] + b[0]) / 2, y: (a[1] + b[1]) / 2, a, b, r: T.lim, h: 3.8, cl: [0, 1, 2, 3, 4].map(() => ['#e94f4f', '#3f8be0', '#f6c445', '#f4f1ea', '#6cc07a', '#e77fb8'][r() * 6 | 0]) }); }
    for (let i = 0; i < 70; i++) { const x = (r() - 0.5) * 150, y = (r() - 0.5) * 150; if (free(x, y, 7) && !houses.some(q => Math.hypot(q[0] - x, q[1] - y) < q[2] + 2.5)) tree(x, y, false); }
    for (let s = 2; s < T.L; s += 9) { const sd = r() < 0.5 ? -1 : 1, p = offAt(s + r() * 5, sd * (T.lim - 0.35)); it.push({ k: 'pot', x: p[0], y: p[1], r: 0.5, h: 0.9, c: ['#d9534f', '#f0a33a', '#e86fb0'][r() * 3 | 0] }); }
    const g0 = offAt(T.L - 3, -(T.w / 2 + 0.9)), g1 = offAt(T.L - 3, T.w / 2 + 0.9); it.push({ k: 'gate', x: (g0[0] + g1[0]) / 2, y: (g0[1] + g1[1]) / 2, a: g0, b: g1, r: T.w, h: 4.6 });
  }
  G.items = it; G.box = T.box; return (GEO[T.id] = G);
}
/* ---------- bajaj model (local: +x forward, +y right) ---------- */
const LIV = { oranye: { body: '#f2661c', trim: '#ffd9a8' }, biru: { body: '#2f86d6', trim: '#d8ecff' }, ghost: { body: '#7fc4ff', trim: '#e6f4ff' } };
const R4 = (x0, x1, y0, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
const BODY = [[-1.35, -0.72], [0.45, -0.72], [1.0, -0.42], [1.42, -0.18], [1.42, 0.18], [1.0, 0.42], [0.45, 0.72], [-1.35, 0.72]];
function parts(l) { return [
  [R4(-1.15, -0.62, -0.84, -0.58), 0, null, 0.56, '#201d1b'], [R4(-1.15, -0.62, 0.58, 0.84), 0, null, 0.56, '#201d1b'], [R4(0.86, 1.3, -0.12, 0.12), 0, null, 0.52, '#201d1b'],
  [BODY, 0.3, null, 0.96, l.body], [R4(-1.36, -0.38, -0.72, 0.72), 0.96, null, 1.56, l.body, { top: '#3a2d26' }], [[[0.45, -0.68], [0.98, -0.42], [0.98, 0.42], [0.45, 0.68]], 0.96, null, 1.14, l.body],
  [R4(0.56, 0.7, -0.6, 0.6), 1.14, null, 1.56, '#bfe8ff', { a: 0.6 }], [R4(-1.46, 0.82, -0.79, 0.79), 1.56, null, 1.72, '#2a2320', { top: '#3a312c' }],
  [R4(-1.38, -1.3, -0.5, 0.5), 0.5, null, 0.62, l.trim]]; }
const PCACHE = {};
function bajaj(ctx, c, x, y, h, roll, hz, liv, alpha, brake) {
  const PT = PCACHE[liv] || (PCACHE[liv] = parts(LIV[liv] || LIV.oranye)), ch = Math.cos(h), sh = Math.sin(h);
  const W = (lx, ly, z) => { ly += roll * 0.1 * z; return [x + ch * lx - sh * ly, y + sh * lx + ch * ly]; };
  const list = PT.map(p => { const b = p[0].map(q => W(q[0], q[1], p[1])), t = p[0].map(q => W(q[0], q[1], p[3])); let mx = 0, my = 0; for (const q of b) { mx += q[0]; my += q[1]; } mx /= b.length; my /= b.length; return { p, b, t, key: depth(c, mx, my) * ZK + (p[1] + p[3]) / 2 * K }; });
  list.sort((a, b) => a.key - b.key); ctx.globalAlpha = alpha;
  const head = W(0.12, 0, 1.3), hp = P(c, head[0], head[1], 1.32 + hz), lt = W(1.43, 0, 0.72), lp = P(c, lt[0], lt[1], 0.72 + hz);
  for (const e of list) { if (e.p[0] === PT[6][0]) { const hr = 0.21 * c.S; ctx.fillStyle = '#f2c29a'; ctx.beginPath(); ctx.arc(hp[0], hp[1], hr, 0, TAU); ctx.fill(); ctx.fillStyle = '#1b1715'; ctx.beginPath(); ctx.arc(hp[0], hp[1] - hr * 0.35, hr * 0.9, Math.PI, TAU); ctx.fill(); }
    ctx.globalAlpha = alpha * (e.p[5] && e.p[5].a || 1); solid(ctx, c, e.b, e.p[1] + hz, e.t, e.p[3] + hz, e.p[4], e.p[5]); ctx.globalAlpha = alpha; }
  ctx.fillStyle = '#fff3b0'; ctx.beginPath(); ctx.arc(lp[0], lp[1], 0.15 * c.S, 0, TAU); ctx.fill();
  for (const sd of [-0.5, 0.5]) { const q = W(-1.37, sd, 0.82), s = P(c, q[0], q[1], 0.82 + hz); ctx.fillStyle = brake ? '#ff3b2f' : '#b3261e'; ctx.fillRect(s[0] - 0.12 * c.S, s[1] - 0.08 * c.S, 0.24 * c.S, 0.16 * c.S); }
  ctx.globalAlpha = 1;
}
/* ---------- props ---------- */
function drawItem(ctx, c, it, a, t) {
  ctx.globalAlpha = a;
  if (it.k === 'tree') { const base = P(c, it.x, it.y, 0), top = P(c, it.x, it.y, it.h * 0.62), R = it.r * c.S, sw = RM ? 0 : Math.sin(t * 1.3 + it.s * 9) * 0.05 * R;
    ctx.strokeStyle = '#6b4a2e'; ctx.lineWidth = Math.max(2, c.S * 0.42); ctx.beginPath(); ctx.moveTo(base[0], base[1]); ctx.lineTo(top[0], top[1]); ctx.stroke();
    ctx.fillStyle = shade(it.c, 0.72); ctx.beginPath(); ctx.arc(top[0] + sw, top[1], R, 0, TAU); ctx.fill();
    ctx.fillStyle = it.c; ctx.beginPath(); ctx.arc(top[0] - R * 0.18 + sw, top[1] - R * 0.28, R * 0.78, 0, TAU); ctx.fill();
    ctx.fillStyle = shade(it.c, 1.28); ctx.beginPath(); ctx.arc(top[0] - R * 0.34 + sw, top[1] - R * 0.5, R * 0.42, 0, TAU); ctx.fill();
    ctx.fillStyle = shade(it.c, 1.5); ctx.beginPath(); ctx.arc(top[0] - R * 0.42 + sw, top[1] - R * 0.62, R * 0.16, 0, TAU); ctx.fill(); }
  else if (it.k === 'lamp') { const b = P(c, it.x, it.y, 0), tp = P(c, it.x, it.y, it.h); ctx.strokeStyle = '#2f3a34'; ctx.lineWidth = Math.max(1.5, c.S * 0.16); ctx.beginPath(); ctx.moveTo(b[0], b[1]); ctx.lineTo(tp[0], tp[1]); ctx.stroke(); ctx.fillStyle = 'rgba(255,226,140,.25)'; ctx.beginPath(); ctx.arc(tp[0], tp[1], c.S * 0.9, 0, TAU); ctx.fill(); ctx.fillStyle = '#ffe9a8'; ctx.beginPath(); ctx.arc(tp[0], tp[1], c.S * 0.3, 0, TAU); ctx.fill(); }
  else if (it.k === 'fence') { const q = it.p.map(p => [P(c, p[0], p[1], 0), P(c, p[0], p[1], 0.55), P(c, p[0], p[1], 1.15)]); ctx.strokeStyle = '#2f5b43'; ctx.lineWidth = Math.max(1, c.S * 0.12);
    ctx.beginPath(); for (const L of [1, 2]) { ctx.moveTo(q[0][L][0], q[0][L][1]); ctx.lineTo(q[1][L][0], q[1][L][1]); ctx.lineTo(q[2][L][0], q[2][L][1]); } for (let k = 0; k < 3; k++) { ctx.moveTo(q[k][0][0], q[k][0][1]); ctx.lineTo(q[k][2][0], q[k][2][1]); } ctx.stroke(); ctx.fillStyle = '#d7b048'; for (let k = 0; k < 3; k++) ctx.fillRect(q[k][2][0] - 1.5, q[k][2][1] - 2, 3, 3); }
  else if (it.k === 'bld') { const b = rect(it.x, it.y, it.a, it.w, it.d); solid(ctx, c, b, 0, b, it.h, it.c, { floors: 1, win: '#6d8aa0' }); const ac = rect(it.x + 1, it.y - 0.5, it.a, 0.9, 0.7); solid(ctx, c, ac, it.h, ac, it.h + 0.8, '#bdb6aa'); }
  else if (it.k === 'house') { const b = rect(it.x, it.y, it.a, it.w, it.d); solid(ctx, c, b, 0, b, it.h, it.c, { noTop: 1 }); const e = rect(it.x, it.y, it.a, it.w + 0.3, it.d + 0.35), ca = Math.cos(it.a), sa = Math.sin(it.a), rx = it.w * 0.92;
    const r1 = [it.x - ca * rx, it.y - sa * rx], r2 = [it.x + ca * rx, it.y + sa * rx]; solid(ctx, c, e, it.h, [r1, r2, r2, r1], it.h + 1.6, it.roof); }
  else if (it.k === 'pole') { const b = P(c, it.x, it.y, 0), tp = P(c, it.x, it.y, it.h), cr = P(c, it.x, it.y, it.h - 0.6); ctx.strokeStyle = '#7d7468'; ctx.lineWidth = Math.max(2, c.S * 0.25); ctx.beginPath(); ctx.moveTo(b[0], b[1]); ctx.lineTo(tp[0], tp[1]); ctx.stroke(); ctx.lineWidth = Math.max(1.5, c.S * 0.14); ctx.beginPath(); ctx.moveTo(cr[0] - c.S * 0.8, cr[1]); ctx.lineTo(cr[0] + c.S * 0.8, cr[1]); ctx.stroke(); }
  else if (it.k === 'pot') { const b = rect(it.x, it.y, 0.3, 0.35, 0.35); solid(ctx, c, b, 0, scaleP(b, it.x, it.y, 1.25), 0.5, '#a5562f'); const tp = P(c, it.x, it.y, 0.9); ctx.fillStyle = '#4e9a46'; ctx.beginPath(); ctx.arc(tp[0], tp[1], c.S * 0.5, 0, TAU); ctx.fill(); ctx.fillStyle = it.c; ctx.beginPath(); ctx.arc(tp[0] - c.S * 0.15, tp[1] - c.S * 0.2, c.S * 0.18, 0, TAU); ctx.fill(); }
  else if (it.k === 'gate') { for (const e of [it.a, it.b]) { const b = rect(e[0], e[1], e[2], 0.4, 0.4); solid(ctx, c, b, 0, b, it.h, it.banner ? '#e9e4da' : '#d93a30', { top: '#f4efe6' }); } }
  else if (it.k === 'monas') monas(ctx, c, t);
  ctx.globalAlpha = 1;
}
function monas(ctx, c, t) {
  const sq = (s, a) => rect(0, 0, a || 0, s, s);
  solid(ctx, c, sq(10.5), 0, sq(10.5), 0.8, '#d8ccb4'); solid(ctx, c, sq(9.6), 0.8, sq(9.6), 2.2, '#cfc2a6');
  solid(ctx, c, sq(4.8), 2.2, sq(8.6), 7.6, '#ece5d4', { top: '#f6f0e2' });
  solid(ctx, c, sq(1.75), 7.6, sq(1.05), 52, '#f2ede1');
  solid(ctx, c, sq(1.9), 52, sq(1.9), 54.4, '#e6dfcf'); solid(ctx, c, sq(0.75), 54.4, sq(0.55), 56, '#c9a24a');
  const b = P(c, 0, 0, 55.8), tp = P(c, 0, 0, 63), f = RM ? 0 : Math.sin(t * 6) * 0.15, w = c.S * 1.25;
  const g = ctx.createLinearGradient(b[0], b[1], tp[0], tp[1]); g.addColorStop(0, '#b98a22'); g.addColorStop(0.5, '#f6cf55'); g.addColorStop(1, '#fff0a6'); ctx.fillStyle = g;
  ctx.beginPath(); ctx.moveTo(b[0] - w, b[1]); ctx.bezierCurveTo(b[0] - w * 1.4, b[1] - (b[1] - tp[1]) * 0.55, tp[0] - w * (0.4 + f), tp[1] + (b[1] - tp[1]) * 0.25, tp[0] + w * f, tp[1]); ctx.bezierCurveTo(tp[0] + w * 0.5, tp[1] + (b[1] - tp[1]) * 0.35, b[0] + w * 1.4, b[1] - (b[1] - tp[1]) * 0.45, b[0] + w, b[1]); ctx.closePath(); ctx.fill();
  ctx.fillStyle = 'rgba(255,240,170,.18)'; ctx.beginPath(); ctx.arc((b[0] + tp[0]) / 2, (b[1] + tp[1]) / 2, w * 3, 0, TAU); ctx.fill();
}
function itemShadow(path, it) {
  if (it.k === 'tree') { const ox = SHX * it.h * 0.62, oy = SHY * it.h * 0.62; path.moveTo(it.x + ox + it.r * 0.95, it.y + oy); path.ellipse(it.x + ox, it.y + oy, it.r * 0.95, it.r * 0.95, 0, 0, TAU); }
  else if (it.k === 'bld') { const b = rect(it.x, it.y, it.a, it.w, it.d); shadowPoly(path, b, b, it.h); }
  else if (it.k === 'house') { const b = rect(it.x, it.y, it.a, it.w + 0.3, it.d + 0.3); shadowPoly(path, b, b, it.h + 0.9); }
  else if (it.k === 'monas') { const s = rect(0, 0, 0, 9.6, 9.6); shadowPoly(path, s, rect(0, 0, 0, 8.6, 8.6), 7.6); shadowPoly(path, rect(0, 0, 0, 1.75, 1.75), rect(0, 0, 0, 1.2, 1.2), 54); }
  else if (it.k === 'lamp' || it.k === 'pole') { const b = rect(it.x, it.y, 0, 0.12, 0.12); shadowPoly(path, b, b, it.h); }
  else if (it.k === 'gate') for (const e of [it.a, it.b]) { const b = rect(e[0], e[1], e[2], 0.4, 0.4); shadowPoly(path, b, b, it.h); }
}
/* ---------- overlays drawn above sprites: gate banner, jemuran, wires ---------- */
function overlay(ctx, c, G, t, car) {
  for (const it of G.items) {
    if (it.k === 'gate') { const a = it.a, b = it.b, A0 = P(c, a[0], a[1], it.h - 1.1), A1 = P(c, a[0], a[1], it.h), B0 = P(c, b[0], b[1], it.h - 1.1), B1 = P(c, b[0], b[1], it.h);
      if (Math.max(A0[0], B0[0]) < -50 || Math.min(A0[0], B0[0]) > c.W + 50) continue; const n = 10;
      for (let i = 0; i < n; i++) { const u0 = i / n, u1 = (i + 1) / n; ctx.fillStyle = it.banner ? (i % 2 ? '#1d1b1a' : '#f7f3ea') : (i % 2 ? '#f4efe6' : '#d93a30'); ctx.beginPath(); ctx.moveTo(lerp(A0[0], B0[0], u0), lerp(A0[1], B0[1], u0)); ctx.lineTo(lerp(A0[0], B0[0], u1), lerp(A0[1], B0[1], u1)); ctx.lineTo(lerp(A1[0], B1[0], u1), lerp(A1[1], B1[1], u1)); ctx.lineTo(lerp(A1[0], B1[0], u0), lerp(A1[1], B1[1], u0)); ctx.closePath(); ctx.fill(); }
      if (it.banner) { ctx.fillStyle = '#f2661c'; const m0 = [lerp(A0[0], B0[0], 0.3), lerp(A0[1], B0[1], 0.3)], m1 = [lerp(A1[0], B1[0], 0.7), lerp(A1[1], B1[1], 0.7)]; ctx.save(); ctx.globalAlpha = 0.92; ctx.beginPath(); ctx.moveTo(m0[0], m0[1]); ctx.lineTo(lerp(A0[0], B0[0], 0.7), lerp(A0[1], B0[1], 0.7)); ctx.lineTo(m1[0], m1[1]); ctx.lineTo(lerp(A1[0], B1[0], 0.3), lerp(A1[1], B1[1], 0.3)); ctx.closePath(); ctx.fill(); ctx.restore(); }
      continue; }
    if (it.k === 'jem') { const A = P(c, it.a[0], it.a[1], it.h), B = P(c, it.b[0], it.b[1], it.h); if (Math.max(A[0], B[0]) < -40 || Math.min(A[0], B[0]) > c.W + 40 || Math.max(A[1], B[1]) < -40 || Math.min(A[1], B[1]) > c.H + 60) continue;
      const near = car && Math.hypot(car.x - it.x, car.y - it.y) < it.r + 2; ctx.globalAlpha = near ? 0.45 : 0.95; const sag = c.S * 0.6;
      ctx.strokeStyle = '#3b332c'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(A[0], A[1]); ctx.quadraticCurveTo((A[0] + B[0]) / 2, (A[1] + B[1]) / 2 + sag * 2, B[0], B[1]); ctx.stroke();
      it.cl.forEach((col, i) => { const u = 0.15 + i * 0.17, x = lerp(A[0], B[0], u), y = lerp(A[1], B[1], u) + sag * 4 * u * (1 - u) * 2 / 2, sw = RM ? 0 : Math.sin(t * 2.2 + i) * c.S * 0.12, w = c.S * 0.9, h = c.S * (0.9 + (i % 2) * 0.5);
        ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(x - w / 2, y); ctx.lineTo(x + w / 2, y); ctx.lineTo(x + w / 2 + sw, y + h); ctx.lineTo(x - w / 2 + sw, y + h); ctx.closePath(); ctx.fill(); ctx.fillStyle = 'rgba(0,0,0,.12)'; ctx.fillRect(x - w / 2, y, w, h * 0.18); });
      ctx.globalAlpha = 1; }
  }
  const poles = G.items.filter(i => i.k === 'pole'); if (poles.length > 1) { ctx.strokeStyle = 'rgba(30,28,26,.55)'; ctx.lineWidth = 1; ctx.beginPath(); for (let i = 0; i < poles.length; i++) { const p = poles[i], q = poles[(i + 1) % poles.length]; if (Math.hypot(p.x - q.x, p.y - q.y) > 34) continue; const A = P(c, p.x, p.y, p.h - 0.6), B = P(c, q.x, q.y, q.h - 0.6); if (Math.max(A[1], B[1]) < -20 || Math.min(A[1], B[1]) > c.H + 20) continue; for (const dy of [0, 4]) { ctx.moveTo(A[0], A[1] + dy); ctx.quadraticCurveTo((A[0] + B[0]) / 2, (A[1] + B[1]) / 2 + c.S * 1.2 + dy, B[0], B[1] + dy); } } ctx.stroke(); }
}
/* ---------- ground ---------- */
function ground(ctx, c, T, G, V) {
  groundT(ctx, c); const mon = T.id === 'monas', vw = (Math.max(c.W, c.H) / c.S) * 1.6;
  ctx.fillStyle = mon ? pat(ctx, 'g1', '#7fa650', ['#6c9443', '#94b95f', '#87ad55', '#a9c46a'], 7, 'grass') : pat(ctx, 'g2', '#93975e', ['#7f8650', '#a8a06c', '#8b8a57', '#b2a578'], 7, 'grass');
  ctx.fillRect(c.x - vw, c.y - vw, vw * 2, vw * 2);
  if (mon) { ctx.fillStyle = pat(ctx, 'pv', '#dccdab', ['#cdbd98', '#e8dcbf', '#c8b690'], 5, 'tile'); ctx.fillRect(-14, -14, 28, 28); ctx.fillRect(-2.6, -48, 5.2, 96); ctx.fillRect(-48, -2.6, 96, 5.2);
    ctx.strokeStyle = 'rgba(170,140,90,.5)'; ctx.lineWidth = 0.4; ctx.strokeRect(-14, -14, 28, 28); ctx.fillStyle = '#6f9d4a'; for (const s of [[-24, -24], [24, -24], [24, 24], [-24, 24]]) { ctx.beginPath(); ctx.arc(s[0], s[1], 4, 0, TAU); ctx.fill(); }
    ctx.fillStyle = '#e46b7b'; for (const s of [[-24, -24], [24, -24], [24, 24], [-24, 24]]) for (let k = 0; k < 8; k++) { ctx.beginPath(); ctx.arc(s[0] + Math.cos(k) * 2.6, s[1] + Math.sin(k * 1.3) * 2.6, 0.45, 0, TAU); ctx.fill(); } }
  ctx.lineJoin = 'round'; ctx.lineCap = 'butt';
  ctx.strokeStyle = mon ? pat(ctx, 'sw', '#cfc4ad', ['#bfb39a', '#ddd3bd', '#c6b99e'], 5, 'tile') : pat(ctx, 'cm', '#b9ae98', ['#a99e88', '#c7bda8'], 6, null); ctx.lineWidth = T.lim * 2; ctx.stroke(G.c);
  ctx.strokeStyle = mon ? '#9a8f7c' : '#4b4c45'; ctx.lineWidth = mon ? 0.35 : 0.7; ctx.stroke(G.lim[0]); ctx.stroke(G.lim[1]);
  const cw = (T.w / 2 + T.curb) * 2; ctx.strokeStyle = '#f2ede4'; ctx.lineWidth = cw; ctx.stroke(G.c); ctx.setLineDash([1.6, 1.6]); ctx.strokeStyle = '#d8433a'; ctx.stroke(G.c); ctx.setLineDash([]);
  ctx.strokeStyle = mon ? pat(ctx, 'as', '#4d4c52', ['#5a5960', '#424147', '#615f66', '#3b3a40'], 6, null) : pat(ctx, 'kb', '#8c8780', ['#7d7871', '#9a958d'], 6, 'block'); ctx.lineWidth = T.w; ctx.stroke(G.c);
  ctx.strokeStyle = 'rgba(245,242,235,.85)'; ctx.lineWidth = 0.2; ctx.stroke(G.eL); ctx.stroke(G.eR);
  if (mon) { ctx.setLineDash([2.2, 2.8]); ctx.strokeStyle = 'rgba(244,211,94,.8)'; ctx.lineWidth = 0.22; ctx.stroke(G.c); ctx.setLineDash([]); }
  // start grid
  const s0 = BD.at(T, 0), i0 = s0.i, nx = T.NX[i0], ny = T.NY[i0], tx = T.TX[i0], ty = T.TY[i0], n = Math.round(T.w / 0.75), q = T.w / n;
  for (let r = 0; r < 2; r++) for (let k = 0; k < n; k++) { ctx.fillStyle = (k + r) % 2 ? '#1e1d1f' : '#f5f2ea'; const o = -T.w / 2 + k * q, a = r * q; ctx.beginPath(); ctx.moveTo(s0.x + nx * o + tx * a, s0.y + ny * o + ty * a); ctx.lineTo(s0.x + nx * (o + q) + tx * a, s0.y + ny * (o + q) + ty * a); ctx.lineTo(s0.x + nx * (o + q) + tx * (a + q), s0.y + ny * (o + q) + ty * (a + q)); ctx.lineTo(s0.x + nx * o + tx * (a + q), s0.y + ny * o + ty * (a + q)); ctx.closePath(); ctx.fill(); }
  // skids
  if (V.sk.length) { ctx.strokeStyle = 'rgba(24,20,18,.32)'; ctx.lineWidth = 0.2; ctx.lineCap = 'round'; ctx.beginPath(); for (const s of V.sk) { ctx.moveTo(s[0], s[1]); ctx.lineTo(s[2], s[3]); } ctx.stroke(); }
}
/* ---------- view ---------- */
function view(cv, tid) {
  const V = { cv, ctx: cv.getContext('2d'), T: BD.track(tid), c: { x: 0, y: 0, th: 0, S: 10, W: 360, H: 640, cs: 1, sn: 0, ox: 0, oy: 0, cy: 0.62, dpr: 1 }, sk: [], fx: [], t: 0, shake: 0, clouds: [], init: false, lastSk: null, conf: 0 };
  V.G = geo(V.T); const r = mul(5); for (let i = 0; i < 4; i++) V.clouds.push({ x: (r() - 0.5) * 160, y: (r() - 0.5) * 160, rx: 14 + r() * 14, ry: 9 + r() * 8 }); return V;
}
function setTrack(V, tid) { V.T = BD.track(tid); V.G = geo(V.T); V.sk.length = 0; V.fx.length = 0; V.init = false; }
const TIERC = ['#ffffff', '#59c7ff', '#ff9b2f', '#d374ff'];
function emit(V, o) { if (V.fx.length < 260) V.fx.push(o); }
function fxStep(V, car, dt) {
  const g = car; if (!g) return; const ch = Math.cos(g.h), sh = Math.sin(g.h), rear = s => [g.x - ch * 1.0 - sh * s, g.y - sh * 1.0 + ch * s];
  const slip = Math.abs(angd(g.h, g.va)), skid = (g.drift && g.v > 6) || (slip > 0.25 && g.v > 8) || g.surf === 'grass';
  if (skid) { const a = rear(-0.72), b = rear(0.72), L = V.lastSk; if (L) { V.sk.push([L[0][0], L[0][1], a[0], a[1]], [L[1][0], L[1][1], b[0], b[1]]); if (V.sk.length > 700) V.sk.splice(0, 2); } V.lastSk = [a, b]; } else V.lastSk = null;
  if (!RM && g.v > 1 && Math.random() < dt * (g.boostT > 0 ? 40 : 14)) { const p = rear(-0.5); emit(V, { x: p[0], y: p[1], z: 0.5, vx: -ch * 1.5 + (Math.random() - 0.5), vy: -sh * 1.5 + (Math.random() - 0.5), vz: 0.9, l: 0, m: 0.9, s: 0.35, g: 1.5, c: g.boostT > 0 ? '#ffb36b' : '#b9c1c9', k: 'smoke' }); }
  if (g.drift && g.tier > 0) for (const sd of [-0.72, 0.72]) if (Math.random() < dt * 30) { const p = rear(sd); emit(V, { x: p[0], y: p[1], z: 0.1, vx: (Math.random() - 0.5) * 5 - ch * 2, vy: (Math.random() - 0.5) * 5 - sh * 2, vz: 2 + Math.random() * 3, l: 0, m: 0.35, s: 0.12, g: -12, c: TIERC[g.tier], k: 'spark' }); }
  if (g.surf !== 'road' && g.v > 6 && Math.random() < dt * 20) { const p = rear(Math.random() < 0.5 ? -0.7 : 0.7); emit(V, { x: p[0], y: p[1], z: 0.2, vx: (Math.random() - 0.5) * 2, vy: (Math.random() - 0.5) * 2, vz: 1, l: 0, m: 0.8, s: 0.45, g: 1.2, c: V.T.id === 'monas' ? '#c9b98f' : '#b09a74', k: 'smoke' }); }
  if (g.boostT > 0 && !RM) { const p = rear(0); emit(V, { x: p[0], y: p[1], z: 0.55, vx: -ch * 6, vy: -sh * 6, vz: 0, l: 0, m: 0.18, s: 0.45, g: 0, c: TIERC[Math.max(1, g.lastTier || 1)], k: 'flame' }); }
}
function burst(V, x, y, n, cols, k) { for (let i = 0; i < n; i++) { const a = Math.random() * TAU, sp = 2 + Math.random() * 6; emit(V, { x, y, z: 0.6, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, vz: 3 + Math.random() * 7, l: 0, m: k === 'conf' ? 2.4 : 0.6, s: k === 'conf' ? 0.3 : 0.5, g: k === 'conf' ? -6 : 1, c: cols[i % cols.length], k: k || 'smoke', r: Math.random() * 6 }); } }
function frame(V, dt, car, opts) {
  opts = opts || {}; const cv = V.cv, ctx = V.ctx, c = V.c, T = V.T, G = V.G; V.t += dt;
  const dpr = Math.min(2, root.devicePixelRatio || 1), W = cv.clientWidth || 360, H = cv.clientHeight || 640; if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
  c.W = W; c.H = H; c.dpr = dpr;
  // camera: chase, heading-follow, speed zoom, lead
  const g = car, base = clamp(Math.min(W, H * 0.9) / (opts.hero ? 30 : 34), 7, 22), sp = g ? clamp(g.v / BD.C.VMAX, 0, 1.4) : 0;
  const tS = base * (1 - 0.16 * sp) * (opts.zoom || 1), tth = g ? -Math.PI / 2 - (g.va + angd(g.h, g.va) * 0.35) : c.th;
  const lead = 4 + (g ? g.v * 0.28 : 0), tx = g ? g.x + Math.cos(g.va) * lead : 0, ty = g ? g.y + Math.sin(g.va) * lead : 0;
  if (!V.init) { c.x = tx; c.y = ty; c.th = tth; c.S = tS; V.init = true; }
  const k = 1 - Math.exp(-dt * 5); c.x += (tx - c.x) * k; c.y += (ty - c.y) * k; c.th += angd(tth, c.th) * (1 - Math.exp(-dt * (RM ? 2 : 3.2))); c.S += (tS - c.S) * (1 - Math.exp(-dt * 2));
  c.cs = Math.cos(c.th); c.sn = Math.sin(c.th); c.cy = opts.cy || (opts.hero ? 0.6 : 0.55); V.shake = Math.max(0, V.shake - dt * 3); c.ox = RM ? 0 : (Math.random() - 0.5) * V.shake * 10; c.oy = RM ? 0 : (Math.random() - 0.5) * V.shake * 10;
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = T.id === 'monas' ? '#7fa650' : '#93975e'; ctx.fillRect(0, 0, cv.width, cv.height);
  ground(ctx, c, T, G, V);
  // shadows (one union path)
  const vis = [], R = Math.max(W, H) / c.S * 0.9 + 12;
  for (const it of G.items) { const dx = it.x - c.x, dy = it.y - c.y; if (Math.abs(dx) > R + it.h && Math.abs(dy) > 0 || Math.hypot(dx, dy) > R + it.h * 0.9) continue; const s = P(c, it.x, it.y, 0); if (s[0] < -it.r * c.S - 20 || s[0] > W + it.r * c.S + 20 || s[1] < -20 || s[1] > H + (it.h * ZK + it.r) * c.S + 20) continue; vis.push(it); }
  const sh = new Path2D(); for (const it of vis) itemShadow(sh, it);
  const cars = []; if (opts.ghost) cars.push(Object.assign({ ghost: 1 }, opts.ghost)); if (g) cars.push({ x: g.x, y: g.y, h: g.h, me: 1 });
  for (const q of cars) { sh.moveTo(q.x + 1.6, q.y); sh.ellipse(q.x + 0.3, q.y + 0.35, 1.6, 1.2, q.h, 0, TAU); }
  for (const cl of V.clouds) { cl.x += dt * 1.2; if (cl.x > 90) cl.x = -90; }
  ctx.fillStyle = 'rgba(28,40,18,.26)'; ctx.fill(sh); ctx.fillStyle = 'rgba(20,30,40,.07)'; for (const cl of V.clouds) { ctx.beginPath(); ctx.ellipse(cl.x, cl.y, cl.rx, cl.ry, 0.4, 0, TAU); ctx.fill(); }
  screenT(ctx, c);
  // sprites (depth sorted) + occlusion fade
  const list = vis.map(it => ({ it, d: depth(c, it.x, it.y) })); for (const q of cars) list.push({ car: q, d: depth(c, q.x, q.y) }); list.sort((a, b) => a.d - b.d);
  const me = g ? P(c, g.x, g.y, 1) : null, md = g ? depth(c, g.x, g.y) : 0;
  for (const e of list) {
    if (e.car) { const q = e.car; if (q.ghost) { bajaj(ctx, c, q.x, q.y, q.h, 0, 0, 'ghost', 0.5); if (q.name) { const s = P(c, q.x, q.y, 2.5); ctx.font = '800 ' + Math.round(clamp(c.S * 1.05, 10, 14)) + 'px system-ui,sans-serif'; ctx.textAlign = 'center'; const tw = ctx.measureText(q.name).width + 12; ctx.fillStyle = 'rgba(20,60,110,.72)'; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(s[0] - tw / 2, s[1] - 16, tw, 18, 9) : ctx.rect(s[0] - tw / 2, s[1] - 16, tw, 18); ctx.fill(); ctx.fillStyle = '#e6f4ff'; ctx.fillText(q.name, s[0], s[1] - 3); } }
      else bajaj(ctx, c, g.x, g.y, g.h, g.roll, g.hopT > 0 ? Math.sin((g.hopT / 0.24) * Math.PI) * 0.45 : 0, opts.livery || 'oranye', 1, g.drift !== 0); continue; }
    const it = e.it; let a = 1;
    if (me && e.d > md && (it.h > 2.5 || it.k === 'tree')) { const b = P(c, it.x, it.y, 0), tp = P(c, it.x, it.y, it.k === 'tree' ? it.h * 0.62 : it.h), rr = (it.k === 'tree' ? it.r : it.r * 0.9) * c.S + 10; if (me[0] > b[0] - rr && me[0] < b[0] + rr && me[1] > tp[1] - rr && me[1] < b[1] + 8) a = it.k === 'monas' ? 0.3 : 0.38; }
    drawItem(ctx, c, it, a, V.t);
  }
  overlay(ctx, c, G, V.t, g);
  // particles
  for (let i = V.fx.length - 1; i >= 0; i--) { const p = V.fx[i]; p.l += dt; if (p.l >= p.m) { V.fx.splice(i, 1); continue; } p.x += p.vx * dt; p.y += p.vy * dt; p.z = Math.max(0, p.z + p.vz * dt); p.vz += p.g * dt; const u = p.l / p.m, s = P(c, p.x, p.y, p.z);
    if (p.k === 'smoke') { ctx.globalAlpha = 0.45 * (1 - u); ctx.fillStyle = p.c; ctx.beginPath(); ctx.arc(s[0], s[1], (p.s + u * 1.1) * c.S, 0, TAU); ctx.fill(); }
    else if (p.k === 'spark') { ctx.globalAlpha = 1 - u; ctx.strokeStyle = p.c; ctx.lineWidth = 2; const e2 = P(c, p.x - p.vx * 0.03, p.y - p.vy * 0.03, p.z - p.vz * 0.03); ctx.beginPath(); ctx.moveTo(s[0], s[1]); ctx.lineTo(e2[0], e2[1]); ctx.stroke(); }
    else if (p.k === 'flame') { ctx.globalAlpha = 0.8 * (1 - u); ctx.fillStyle = p.c; ctx.beginPath(); ctx.arc(s[0], s[1], p.s * c.S * (1 - u * 0.6), 0, TAU); ctx.fill(); ctx.fillStyle = '#fff6d8'; ctx.beginPath(); ctx.arc(s[0], s[1], p.s * c.S * 0.45 * (1 - u), 0, TAU); ctx.fill(); }
    else if (p.k === 'conf') { ctx.globalAlpha = 1 - u * u; ctx.fillStyle = p.c; ctx.save(); ctx.translate(s[0], s[1]); ctx.rotate(p.r + p.l * 8); ctx.fillRect(-c.S * 0.25, -c.S * 0.12, c.S * 0.5, c.S * 0.24); ctx.restore(); } }
  ctx.globalAlpha = 1;
  // speed lines on boost
  if (g && g.boostT > 0 && !RM) { ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 2; ctx.beginPath(); for (let i = 0; i < 14; i++) { const a = Math.random() * TAU, r0 = Math.min(W, H) * (0.38 + Math.random() * 0.1), r1 = r0 + 30 + Math.random() * 50; ctx.moveTo(W / 2 + Math.cos(a) * r0, H * 0.5 + Math.sin(a) * r0); ctx.lineTo(W / 2 + Math.cos(a) * r1, H * 0.5 + Math.sin(a) * r1); } ctx.stroke(); }
  // warm grade + vignette
  const lg = ctx.createLinearGradient(0, 0, 0, H); lg.addColorStop(0, 'rgba(255,196,120,.22)'); lg.addColorStop(0.45, 'rgba(255,220,160,0)'); lg.addColorStop(1, 'rgba(60,30,80,.12)'); ctx.fillStyle = lg; ctx.fillRect(0, 0, W, H);
  const rg = ctx.createRadialGradient(W / 2, H * 0.55, Math.min(W, H) * 0.35, W / 2, H * 0.55, Math.max(W, H) * 0.8); rg.addColorStop(0, 'rgba(0,0,0,0)'); rg.addColorStop(1, 'rgba(30,14,4,.38)'); ctx.fillStyle = rg; ctx.fillRect(0, 0, W, H);
}
function mini(cv, T, car, ghost) {
  const ctx = cv.getContext('2d'), W = cv.width, H = cv.height, b = T.box, s = Math.min((W - 10) / (b[2] - b[0]), (H - 10) / (b[3] - b[1])), ox = W / 2 - (b[0] + b[2]) / 2 * s, oy = H / 2 - (b[1] + b[3]) / 2 * s;
  ctx.clearRect(0, 0, W, H); ctx.fillStyle = 'rgba(24,16,8,.5)'; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(0, 0, W, H, 12) : ctx.rect(0, 0, W, H); ctx.fill();
  ctx.strokeStyle = 'rgba(255,246,226,.9)'; ctx.lineWidth = 3; ctx.lineJoin = 'round'; ctx.beginPath(); for (let i = 0; i <= T.N; i += 3) { const k = i % T.N, x = ox + T.X[k] * s, y = oy + T.Y[k] * s; if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); } ctx.closePath(); ctx.stroke();
  const p0 = BD.at(T, 0); ctx.fillStyle = '#fff'; ctx.fillRect(ox + p0.x * s - 2, oy + p0.y * s - 2, 4, 4);
  if (T.id === 'monas') { ctx.fillStyle = '#f6cf55'; ctx.beginPath(); ctx.arc(ox, oy, 2.5, 0, TAU); ctx.fill(); }
  if (ghost) { ctx.fillStyle = '#7fc4ff'; ctx.beginPath(); ctx.arc(ox + ghost.x * s, oy + ghost.y * s, 3.2, 0, TAU); ctx.fill(); }
  if (car) { ctx.fillStyle = '#f2661c'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(ox + car.x * s, oy + car.y * s, 4, 0, TAU); ctx.fill(); ctx.stroke(); }
}
root.BR = { view, setTrack, frame, fxStep, burst, mini, TIERC, P, solid, geo };
})(window);

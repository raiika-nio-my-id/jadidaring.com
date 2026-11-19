/* Rebut Bendera Kampung renderer (window.RR): 2.5D oblique-iso follow camera, painted ground texture on an affine plane,
   parallax far sawah plane + near bunting layer, depth-sorted standing sprites with soft shadows, minimap. */
(function () {
'use strict';
const B = window.RB, TAU = Math.PI * 2, KX = 0.8, KY = 0.46, M = 7, PX = 30;
let ctx, W, H, S = 40, CX = 0, CY = 0, CU = 12, CV = 7, FL = false;
const TEAM = [{ c: '#e2412f', d: '#a82418', l: '#ff8a72', n: 'Merah' }, { c: '#2f7fd8', d: '#1b4f96', l: '#8cc4ff', n: 'Biru' }];
const SKIN = ['#c68a5a', '#a86c43', '#d49a6a', '#8c5634'];
function hash(k) { let x = Math.imul(k ^ 0x9e3779b9, 0x85ebca6b); x ^= x >>> 13; x = Math.imul(x, 0xc2b2ae35); x ^= x >>> 16; return (x >>> 0) / 4294967296; }
const V = (u, v) => FL ? [B.W - u, B.H - v] : [u, v];
function Pv(a, b, z) { const du = a - CU, dv = b - CV; return [CX + (du - dv) * KX * S, CY + (du + dv) * KY * S - (z || 0) * S]; }
function P(u, v, z) { const q = V(u, v); return Pv(q[0], q[1], z); }
const depth = (u, v) => { const q = V(u, v); return q[0] + q[1]; };
function poly(pts, fill, stroke, lw) { ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.closePath(); if (fill) { ctx.fillStyle = fill; ctx.fill(); } if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw || 1; ctx.stroke(); } }
function shadow(x, y, rx, ry, a) { ctx.save(); ctx.translate(x, y); ctx.scale(1, ry / rx); const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx); g.addColorStop(0, 'rgba(40,24,8,' + (a || 0.4) + ')'); g.addColorStop(1, 'rgba(40,24,8,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, rx, 0, TAU); ctx.fill(); ctx.restore(); }
/* view-space box: rect given in world coords, converted, visible faces = +u' and +v' */
function vrect(r) { const a = V(r[0], r[1]), b = V(r[2], r[3]); return [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[0], b[0]), Math.max(a[1], b[1])]; }
function boxV(u0, v0, u1, v1, z0, z1, top, sv, su, line) { const L = line || 'rgba(50,25,10,.5)';
  poly([Pv(u0, v1, z0), Pv(u1, v1, z0), Pv(u1, v1, z1), Pv(u0, v1, z1)], sv, L, 1);
  poly([Pv(u1, v0, z0), Pv(u1, v1, z0), Pv(u1, v1, z1), Pv(u1, v0, z1)], su, L, 1);
  if (top) poly([Pv(u0, v0, z1), Pv(u1, v0, z1), Pv(u1, v1, z1), Pv(u0, v1, z1)], top, L, 1); }
function roofV(u0, v0, u1, v1, z, h, c1, c2, o) { o = o || 0.25; const a = [u0 - o, v0 - o], b = [u1 + o, v0 - o], c = [u1 + o, v1 + o], d = [u0 - o, v1 + o];
  const long = (u1 - u0) >= (v1 - v0), r0 = long ? [u0 + (v1 - v0) / 2, (v0 + v1) / 2] : [(u0 + u1) / 2, v0 + (u1 - u0) / 2], r1 = long ? [u1 - (v1 - v0) / 2, (v0 + v1) / 2] : [(u0 + u1) / 2, v1 - (u1 - u0) / 2];
  const R0 = Pv(r0[0], r0[1], z + h), R1 = Pv(r1[0], r1[1], z + h), A = Pv(a[0], a[1], z), Bq = Pv(b[0], b[1], z), C = Pv(c[0], c[1], z), D = Pv(d[0], d[1], z);
  if (long) { poly([A, Bq, R1, R0], c2); poly([D, C, R1, R0], c1, 'rgba(60,20,10,.5)'); poly([Bq, C, R1], c2, 'rgba(60,20,10,.5)'); }
  else { poly([A, D, R1, R0], c2); poly([Bq, C, R1, R0], c2, 'rgba(60,20,10,.5)'); poly([D, C, R1], c1, 'rgba(60,20,10,.5)'); }
  // tile lines
  ctx.strokeStyle = 'rgba(70,20,10,.25)'; ctx.lineWidth = 1; const n = 6; for (let i = 1; i < n; i++) { const k = i / n, p = [D[0] + (C[0] - D[0]) * k, D[1] + (C[1] - D[1]) * k], q = [R0[0] + (R1[0] - R0[0]) * k, R0[1] + (R1[1] - R0[1]) * k]; ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.lineTo(q[0], q[1]); ctx.stroke(); } }
/* ---------- ground texture (world space, painted once) ---------- */
let tex = null, far = null;
function blot(c, x, y, r, col, a) { const g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, col.replace(')', ',' + a + ')').replace('rgb', 'rgba')); g.addColorStop(1, col.replace(')', ',0)').replace('rgb', 'rgba')); c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2); }
function groundTex() {
  if (tex) return tex; const w = (B.W + 2 * M) * PX, h = (B.H + 2 * M) * PX; tex = document.createElement('canvas'); tex.width = w; tex.height = h; const c = tex.getContext('2d');
  const X = u => (u + M) * PX, Y = v => (v + M) * PX;
  // outer village ground fades to transparent so the far sawah plane shows through
  const og = c.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.62); og.addColorStop(0, 'rgba(118,132,62,1)'); og.addColorStop(0.75, 'rgba(104,120,58,.9)'); og.addColorStop(1, 'rgba(90,110,60,0)'); c.fillStyle = og; c.fillRect(0, 0, w, h);
  // field grass with painted blotches
  c.fillStyle = '#8fae52'; c.fillRect(X(0), Y(0), B.W * PX, B.H * PX);
  for (let i = 0; i < 260; i++) { const x = X(hash(i) * B.W), y = Y(hash(i * 7 + 3) * B.H), r = 10 + hash(i * 13) * 40; blot(c, x, y, r, hash(i * 5) > 0.5 ? 'rgb(170,190,90)' : 'rgb(96,130,60)', 0.35); }
  // half tints
  let g = c.createLinearGradient(X(0), 0, X(B.MID), 0); g.addColorStop(0, 'rgba(226,65,47,.16)'); g.addColorStop(1, 'rgba(226,65,47,0)'); c.fillStyle = g; c.fillRect(X(0), Y(0), B.MID * PX, B.H * PX);
  g = c.createLinearGradient(X(B.W), 0, X(B.MID), 0); g.addColorStop(0, 'rgba(47,127,216,.16)'); g.addColorStop(1, 'rgba(47,127,216,0)'); c.fillStyle = g; c.fillRect(X(B.MID), Y(0), B.MID * PX, B.H * PX);
  // worn dirt paths: base to base and around props
  c.lineCap = 'round'; c.lineJoin = 'round'; const path = (pts, wd, col) => { c.strokeStyle = col; c.lineWidth = wd; c.beginPath(); pts.forEach((p, i) => i ? c.lineTo(X(p[0]), Y(p[1])) : c.moveTo(X(p[0]), Y(p[1]))); c.stroke(); };
  for (const [wd, col] of [[46, 'rgba(176,140,90,.35)'], [30, 'rgba(196,160,104,.55)'], [14, 'rgba(214,182,128,.45)']]) { path([[1.8, 7], [4, 7], [8, 5.6], [12, 4.6], [16, 8.4], [20, 7], [22.2, 7]], wd, col); path([[8.1, 12.3], [8.4, 9], [12, 9.4], [15.6, 5], [15.9, 1.7]], wd * 0.8, col); }
  for (const j of B.JAIL) path([[j[0], j[1]], [j[0] + (j[0] < 12 ? 1.5 : -1.5), j[1] + (j[1] < 7 ? 2.5 : -2.5)]], 22, 'rgba(190,150,96,.4)');
  for (let i = 0; i < 400; i++) { const x = X(hash(i * 3 + 1) * B.W), y = Y(hash(i * 11 + 5) * B.H); c.fillStyle = hash(i) > 0.7 ? 'rgba(255,240,170,.5)' : 'rgba(50,80,30,.35)'; c.fillRect(x, y, 1.5, 3 + hash(i * 2) * 3); }
  for (let i = 0; i < 40; i++) { const x = X(hash(i * 17 + 9) * B.W), y = Y(hash(i * 19 + 4) * B.H); c.fillStyle = ['#fff6d0', '#ffd34d', '#ff7aa0'][i % 3]; c.beginPath(); c.arc(x, y, 2.4, 0, TAU); c.fill(); }
  // midline chalk
  c.strokeStyle = 'rgba(255,252,236,.85)'; c.lineWidth = 5; c.setLineDash([18, 12]); c.beginPath(); c.moveTo(X(B.MID), Y(0.2)); c.lineTo(X(B.MID), Y(B.H - 0.2)); c.stroke(); c.setLineDash([]);
  c.strokeStyle = 'rgba(255,252,236,.5)'; c.lineWidth = 3; c.strokeRect(X(0.15), Y(0.15), (B.W - 0.3) * PX, (B.H - 0.3) * PX);
  // bases, flag ring, jail squares, pos ronda floors
  B.FLAG.forEach((f, i) => { const T = TEAM[i]; c.fillStyle = T.c + '33'; c.beginPath(); c.arc(X(f[0]), Y(f[1]), 2.2 * PX, 0, TAU); c.fill(); c.strokeStyle = 'rgba(255,250,235,.8)'; c.lineWidth = 4; c.setLineDash([10, 8]); c.beginPath(); c.arc(X(f[0]), Y(f[1]), 1.05 * PX, 0, TAU); c.stroke(); c.setLineDash([]); c.fillStyle = 'rgba(160,110,60,.55)'; c.beginPath(); c.arc(X(f[0]), Y(f[1]), 0.55 * PX, 0, TAU); c.fill(); });
  B.JAIL.forEach((j, i) => { c.fillStyle = 'rgba(150,110,70,.45)'; c.fillRect(X(j[0] - 1.1), Y(j[1] - 0.9), 2.2 * PX, 1.8 * PX); c.strokeStyle = 'rgba(255,250,235,.85)'; c.lineWidth = 3; c.strokeRect(X(j[0] - 1.1), Y(j[1] - 0.9), 2.2 * PX, 1.8 * PX); c.save(); c.translate(X(j[0]), Y(j[1] + (i ? -1.25 : 1.25))); if (i) c.rotate(Math.PI); c.fillStyle = 'rgba(255,250,235,.8)'; c.font = '900 15px system-ui,sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('PENJARA ' + TEAM[i].n.toUpperCase(), 0, 0); c.restore(); });
  B.PR.forEach(p => { c.fillStyle = 'rgba(120,84,50,.6)'; c.beginPath(); c.ellipse(X(p[0]), Y(p[1]), 0.9 * PX, 0.9 * PX, 0, 0, TAU); c.fill(); });
  // jemuran shade + puddles
  B.JEM.forEach(r => { c.fillStyle = 'rgba(70,90,50,.28)'; c.fillRect(X(r[0]), Y(r[1]), (r[2] - r[0]) * PX, (r[3] - r[1]) * PX); });
  for (const [u, v] of [[10.5, 10.8], [13.5, 3.2]]) { c.fillStyle = 'rgba(120,150,170,.55)'; c.beginPath(); c.ellipse(X(u), Y(v), 22, 12, 0.4, 0, TAU); c.fill(); c.fillStyle = 'rgba(255,255,255,.35)'; c.beginPath(); c.ellipse(X(u) - 5, Y(v) - 3, 8, 3, 0.4, 0, TAU); c.fill(); }
  // obstacle footprints (dark soft contact shadow)
  for (const o of B.OBS) { c.fillStyle = 'rgba(50,40,20,.28)'; c.fillRect(X(o.r[0]) - 4, Y(o.r[1]) - 4, (o.r[2] - o.r[0]) * PX + 8, (o.r[3] - o.r[1]) * PX + 8); }
  return tex;
}
function farTex() { if (far) return far; far = document.createElement('canvas'); far.width = 512; far.height = 512; const c = far.getContext('2d');
  c.fillStyle = '#6f8f45'; c.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { const x = i * 128, y = j * 128; const g = c.createLinearGradient(x, y, x + 128, y + 128); const wet = hash(i * 4 + j) > 0.45; g.addColorStop(0, wet ? '#8fb7a8' : '#86a94a'); g.addColorStop(1, wet ? '#a9c79a' : '#9bbb55'); c.fillStyle = g; c.fillRect(x + 4, y + 4, 120, 120); if (wet) { c.strokeStyle = 'rgba(70,120,50,.6)'; c.lineWidth = 2; for (let k = 8; k < 120; k += 10) for (let m = 8; m < 120; m += 9) { c.beginPath(); c.moveTo(x + k, y + m + 4); c.lineTo(x + k + 1, y + m); c.stroke(); } } else { c.fillStyle = 'rgba(200,190,90,.35)'; for (let k = 0; k < 40; k++) c.fillRect(x + 6 + hash(k + i * 50 + j * 7) * 112, y + 6 + hash(k * 3 + i + j * 90) * 112, 2, 5); } }
  c.strokeStyle = '#5b4a2a'; c.lineWidth = 6; for (let i = 0; i <= 4; i++) { c.beginPath(); c.moveTo(i * 128, 0); c.lineTo(i * 128, 512); c.stroke(); c.beginPath(); c.moveTo(0, i * 128); c.lineTo(512, i * 128); c.stroke(); }
  return far; }
function plane(img, u0, v0, ppu, alpha) { // draw an image whose (0,0) is world (u0,v0) at ppu px per unit, through the iso affine
  const p0 = P(u0, v0, 0), pu = P(u0 + 1, v0, 0), pv = P(u0, v0 + 1, 0);
  ctx.save(); ctx.globalAlpha = alpha == null ? 1 : alpha; ctx.setTransform(ctx._dpr * (pu[0] - p0[0]) / ppu, ctx._dpr * (pu[1] - p0[1]) / ppu, ctx._dpr * (pv[0] - p0[0]) / ppu, ctx._dpr * (pv[1] - p0[1]) / ppu, ctx._dpr * p0[0], ctx._dpr * p0[1]); ctx.drawImage(img, 0, 0); ctx.restore(); }
/* ---------- props ---------- */
function house(o, k) { const r = vrect(o.r), z = o.k === 'rumah2' ? 1.25 : 1.4; const wall = o.k === 'rumah2' ? ['#cfe3c4', '#a7c39a', '#88a57c'] : ['#f1e6cf', '#d8c6a2', '#b9a37c'];
  boxV(r[0], r[1], r[2], r[3], 0, z, null, wall[1], wall[2]);
  boxV(r[0], r[1], r[2], r[3], 0, 0.32, null, '#b5654a', '#93503a');
  // door + windows on the visible +v' face
  const mu = (r[0] + r[2]) / 2, fv = r[3]; poly([Pv(mu - 0.25, fv, 0), Pv(mu + 0.25, fv, 0), Pv(mu + 0.25, fv, 0.95), Pv(mu - 0.25, fv, 0.95)], '#6b4426', 'rgba(40,20,10,.6)');
  for (const du of [-0.9, 0.9]) { const a = mu + du; if (a - 0.25 < r[0] || a + 0.25 > r[2]) continue; poly([Pv(a - 0.25, fv, 0.55), Pv(a + 0.25, fv, 0.55), Pv(a + 0.25, fv, 1.0), Pv(a - 0.25, fv, 1.0)], '#3b5a6a', '#6b4426', 2); }
  const mv = (r[1] + r[3]) / 2; poly([Pv(r[2], mv - 0.3, 0.55), Pv(r[2], mv + 0.3, 0.55), Pv(r[2], mv + 0.3, 1.0), Pv(r[2], mv - 0.3, 1.0)], '#34505e', '#6b4426', 2);
  roofV(r[0], r[1], r[2], r[3], z, 1.0, '#c4553a', '#9a3d28', 0.3);
  if (hash(k) > 0.4) { const a = Pv(r[2] - 0.5, r[1] + 0.5, z + 0.9), b = Pv(r[2] - 0.5, r[1] + 0.5, z + 2.0); ctx.strokeStyle = '#555'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.moveTo(b[0] - 10, b[1] + 4); ctx.lineTo(b[0] + 10, b[1] - 2); ctx.moveTo(b[0] - 7, b[1] + 9); ctx.lineTo(b[0] + 7, b[1] + 5); ctx.stroke(); } }
function warung(o, t) { const r = vrect(o.r); boxV(r[0], r[1], r[2], r[3], 0, 1.1, null, '#d9b27a', '#b88d55');
  const fv = r[3]; poly([Pv(r[0] + 0.15, fv, 0.45), Pv(r[2] - 0.15, fv, 0.45), Pv(r[2] - 0.15, fv, 1.0), Pv(r[0] + 0.15, fv, 1.0)], '#3a2416');
  for (let i = 0; i < 7; i++) { const p = Pv(r[0] + 0.3 + i * (r[2] - r[0] - 0.6) / 6, fv + 0.02, 0.7 + (i % 2) * 0.15); ctx.fillStyle = ['#ff5a4a', '#ffd34d', '#5ad1ff', '#7be07b'][i % 4]; ctx.fillRect(p[0] - 3, p[1] - 5, 6, 8); }
  const a = Pv(r[0] - 0.1, fv, 1.15), b = Pv(r[2] + 0.1, fv, 1.15), c = Pv(r[2] + 0.1, fv + 0.7, 0.85), d = Pv(r[0] - 0.1, fv + 0.7, 0.85); poly([a, b, c, d], '#f2f2f2'); ctx.save(); ctx.beginPath(); [a, b, c, d].forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.clip(); ctx.strokeStyle = '#2f9a5a'; ctx.lineWidth = 7; for (let i = 0; i < 12; i++) { const k = i / 11, x = a[0] + (b[0] - a[0]) * k; ctx.beginPath(); ctx.moveTo(x, a[1] + (b[1] - a[1]) * k - 4); ctx.lineTo(x - (a[0] - d[0]), a[1] + (b[1] - a[1]) * k + (d[1] - a[1]) + 4); ctx.stroke(); } ctx.restore();
  roofV(r[0], r[1], r[2], r[3], 1.1, 0.6, '#7a6a5a', '#5a4a3c', 0.2);
  const sg = Pv((r[0] + r[2]) / 2, fv, 1.75); ctx.fillStyle = '#ffde59'; ctx.fillRect(sg[0] - 26, sg[1] - 9, 52, 16); ctx.fillStyle = '#5a2a10'; ctx.font = '900 10px system-ui,sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('WARUNG', sg[0], sg[1]); }
function pagar(o) { const r = vrect(o.r), lu = r[2] - r[0] > r[3] - r[1]; const n = Math.max(2, Math.round((lu ? r[2] - r[0] : r[3] - r[1]) / 0.3)); const um = (r[0] + r[2]) / 2, vm = (r[1] + r[3]) / 2;
  ctx.strokeStyle = '#c9a45c'; ctx.lineWidth = Math.max(2, S * 0.07); for (let i = 0; i <= n; i++) { const k = i / n, u = lu ? r[0] + (r[2] - r[0]) * k : um, v = lu ? vm : r[1] + (r[3] - r[1]) * k, a = Pv(u, v, 0), b = Pv(u, v, 0.75 + (i % 2) * 0.08); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); }
  ctx.strokeStyle = '#a3803e'; for (const z of [0.3, 0.6]) { const a = lu ? Pv(r[0], vm, z) : Pv(um, r[1], z), b = lu ? Pv(r[2], vm, z) : Pv(um, r[3], z); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); } }
function sumur(o) { const r = vrect(o.r), u = (r[0] + r[2]) / 2, v = (r[1] + r[3]) / 2, c = Pv(u, v, 0), top = Pv(u, v, 0.55), rx = 0.45 * S * 1.1, ry = rx * 0.58;
  ctx.fillStyle = '#9a8f80'; ctx.beginPath(); ctx.ellipse(c[0], c[1], rx, ry, 0, 0, Math.PI); ctx.lineTo(top[0] - rx, top[1]); ctx.ellipse(top[0], top[1], rx, ry, 0, Math.PI, 0, true); ctx.closePath(); ctx.fill(); ctx.strokeStyle = 'rgba(40,30,20,.5)'; ctx.stroke();
  ctx.fillStyle = '#c9c0b0'; ctx.beginPath(); ctx.ellipse(top[0], top[1], rx, ry, 0, 0, TAU); ctx.fill(); ctx.fillStyle = '#24323a'; ctx.beginPath(); ctx.ellipse(top[0], top[1], rx * 0.72, ry * 0.72, 0, 0, TAU); ctx.fill();
  ctx.strokeStyle = '#6b4426'; ctx.lineWidth = 3; const l = Pv(u - 0.45, v, 1.5), rr = Pv(u + 0.45, v, 1.5); ctx.beginPath(); ctx.moveTo(top[0] - rx, top[1]); ctx.lineTo(l[0], l[1]); ctx.lineTo(rr[0], rr[1]); ctx.lineTo(top[0] + rx, top[1]); ctx.stroke(); ctx.strokeStyle = '#ddd'; ctx.lineWidth = 1; const m = Pv(u, v, 1.5); ctx.beginPath(); ctx.moveTo(m[0], m[1]); ctx.lineTo(m[0], m[1] + 0.6 * S); ctx.stroke(); ctx.fillStyle = '#3b8ad8'; ctx.fillRect(m[0] - 4, m[1] + 0.6 * S, 8, 7); }
function jemuran(r0, t) { const r = vrect(r0), lines = 3; const long = r0[2] - r0[0] > r0[3] - r0[1];
  for (let i = 0; i < lines; i++) { const k = (i + 0.5) / lines; let a, b; if (long) { const v = r0[1] + (r0[3] - r0[1]) * k; a = V(r0[0], v); b = V(r0[2], v); } else { const u = r0[0] + (r0[2] - r0[0]) * k; a = V(u, r0[1]); b = V(u, r0[3]); }
    for (const p of [a, b]) { const g = Pv(p[0], p[1], 0), tp = Pv(p[0], p[1], 1.75); shadow(g[0], g[1], 6, 2, 0.3); ctx.strokeStyle = '#8a6a3a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(g[0], g[1]); ctx.lineTo(tp[0], tp[1]); ctx.stroke(); }
    const A = Pv(a[0], a[1], 1.68), Bq = Pv(b[0], b[1], 1.68); ctx.strokeStyle = 'rgba(240,240,240,.8)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(A[0], A[1]); ctx.quadraticCurveTo((A[0] + Bq[0]) / 2, (A[1] + Bq[1]) / 2 + 6, Bq[0], Bq[1]); ctx.stroke();
    const n = 6; for (let j = 0; j < n; j++) { const q = (j + 0.6) / (n + 0.2), x = A[0] + (Bq[0] - A[0]) * q, y = A[1] + (Bq[1] - A[1]) * q + Math.sin(q * Math.PI) * 6, hh = hash(i * 31 + j + (r0[0] | 0)); const sw = Math.sin(t * 2 + j + i) * 2.5, cw = S * (0.28 + hh * 0.14), ch = S * (0.42 + hh * 0.3);
      const col = ['#f7f3e8', '#e94f37', '#3a8dde', '#f5c04a', '#7c4fb0', '#2bb39a', '#f28cb1'][Math.floor(hh * 7)];
      ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(x - cw / 2, y); ctx.lineTo(x + cw / 2, y); ctx.lineTo(x + cw / 2 + sw, y + ch); ctx.lineTo(x - cw / 2 + sw, y + ch); ctx.closePath(); ctx.fill(); ctx.strokeStyle = 'rgba(60,30,20,.35)'; ctx.stroke();
      if (hh > 0.55) { ctx.fillStyle = 'rgba(80,40,20,.35)'; for (let m = 0; m < 3; m++) ctx.fillRect(x - cw / 2 + 2 + sw * 0.5, y + 4 + m * ch / 3, cw - 4, 2); } } } }
function posRonda(p, t, ready) { const q = V(p[0], p[1]), u = q[0], v = q[1], s = 0.75;
  const g = Pv(u, v, 0); if (ready) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; const gl = ctx.createRadialGradient(g[0], g[1], 2, g[0], g[1], S * 1.1); gl.addColorStop(0, 'rgba(255,220,120,' + (0.35 + 0.15 * Math.sin(t * 4)) + ')'); gl.addColorStop(1, 'rgba(255,200,80,0)'); ctx.fillStyle = gl; ctx.beginPath(); ctx.ellipse(g[0], g[1], S * 1.1, S * 0.6, 0, 0, TAU); ctx.fill(); ctx.restore(); }
  for (const [du, dv] of [[-s, -s], [s, -s], [-s, s], [s, s]]) { const a = Pv(u + du, v + dv, 0), b = Pv(u + du, v + dv, 1.6); ctx.strokeStyle = '#6b4426'; ctx.lineWidth = Math.max(2, S * 0.08); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); }
  boxV(u - s, v - s, u + s, v + s, 0.38, 0.5, '#b88a52', '#93693a', '#7a5530');
  roofV(u - s, v - s, u + s, v + s, 1.6, 0.55, '#8b8f95', '#6c7076', 0.2);
  const k = Pv(u + s, v + s * 0.2, 1.3); ctx.fillStyle = '#7a4a22'; ctx.fillRect(k[0] - 3, k[1], 6, S * 0.5); ctx.fillStyle = '#2a160a'; ctx.fillRect(k[0] - 1, k[1] + 5, 2, S * 0.3);
  const sg = Pv(u, v + s, 1.6); ctx.fillStyle = '#fff3d6'; ctx.fillRect(sg[0] - 28, sg[1] - 2, 56, 13); ctx.fillStyle = '#3a2416'; ctx.font = '900 9px system-ui,sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('POS RONDA', sg[0], sg[1] + 4.5); }
function flagPole(f, team, t) { const g = P(f[0], f[1], 0); shadow(g[0], g[1], S * 0.5, S * 0.22, 0.5); const top = P(f[0], f[1], 2.6);
  ctx.strokeStyle = '#d7b46a'; ctx.lineWidth = Math.max(3, S * 0.09); ctx.beginPath(); ctx.moveTo(g[0], g[1]); ctx.lineTo(top[0], top[1]); ctx.stroke(); ctx.strokeStyle = 'rgba(120,80,30,.6)'; ctx.lineWidth = 1; for (let i = 1; i < 5; i++) { const y = g[1] + (top[1] - g[1]) * i / 5; ctx.beginPath(); ctx.moveTo(g[0] - 2, y); ctx.lineTo(g[0] + 2, y); ctx.stroke(); }
  if (!team.empty) cloth(top[0], top[1] + 2, S * 1.1, S * 0.68, TEAM[team.i], t); }
function cloth(x, y, w, h, T, t) { ctx.save(); ctx.beginPath(); const n = 8; for (let i = 0; i <= n; i++) { const k = i / n, yy = y + Math.sin(t * 6 + k * 4) * h * 0.12 * k; i ? ctx.lineTo(x + w * k, yy) : ctx.moveTo(x, yy); } for (let i = n; i >= 0; i--) { const k = i / n, yy = y + h + Math.sin(t * 6 + k * 4 + 0.6) * h * 0.12 * k; ctx.lineTo(x + w * k, yy); } ctx.closePath(); ctx.fillStyle = T.c; ctx.fill(); ctx.strokeStyle = T.d; ctx.lineWidth = 1.5; ctx.stroke(); ctx.clip(); ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.beginPath(); ctx.arc(x + w * 0.45, y + h * 0.5, h * 0.24, 0, TAU); ctx.fill(); ctx.fillStyle = T.c; ctx.beginPath(); ctx.arc(x + w * 0.45, y + h * 0.5, h * 0.12, 0, TAU); ctx.fill(); ctx.restore(); }
function jailCage(j, t) { const q = V(j[0], j[1]), u = q[0], v = q[1]; for (const [du, dv] of [[-1.1, -0.9], [1.1, -0.9], [-1.1, 0.9], [1.1, 0.9]]) { const a = Pv(u + du, v + dv, 0), b = Pv(u + du, v + dv, 1.1); ctx.strokeStyle = '#a07a3a'; ctx.lineWidth = Math.max(2, S * 0.08); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); }
  ctx.strokeStyle = 'rgba(230,210,160,.9)'; ctx.lineWidth = 1.5; const c = [[-1.1, -0.9], [1.1, -0.9], [1.1, 0.9], [-1.1, 0.9]].map(([a, b]) => Pv(u + a, v + b, 0.9)); ctx.beginPath(); c.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.closePath(); ctx.stroke(); }
function jailFront(j) { const q = V(j[0], j[1]), u = q[0], v = q[1]; ctx.strokeStyle = 'rgba(230,210,160,.9)'; ctx.lineWidth = 1.5; for (const z of [0.5, 0.9]) { const a = Pv(u - 1.1, v + 0.9, z), b = Pv(u + 1.1, v + 0.9, z), c = Pv(u + 1.1, v - 0.9, z); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.lineTo(c[0], c[1]); ctx.stroke(); } }
function tree(u, v, k, t, kind) { const b = P(u, v, 0); shadow(b[0] + S * 0.4, b[1] + S * 0.1, S * 1.1, S * 0.45, 0.42); const sw = Math.sin(t * 1.2 + k) * 2;
  if (kind === 'kelapa') { const top = P(u, v, 3.4); ctx.strokeStyle = '#7a5a3a'; ctx.lineWidth = Math.max(3, S * 0.12); ctx.beginPath(); ctx.moveTo(b[0], b[1]); ctx.quadraticCurveTo(b[0] + S * 0.4, (b[1] + top[1]) / 2, top[0] + sw, top[1]); ctx.stroke();
    for (let i = 0; i < 7; i++) { const a = i / 7 * TAU + k; ctx.strokeStyle = i % 2 ? '#3f7a35' : '#56923f'; ctx.lineWidth = Math.max(3, S * 0.1); ctx.beginPath(); ctx.moveTo(top[0] + sw, top[1]); ctx.quadraticCurveTo(top[0] + sw + Math.cos(a) * S * 0.9, top[1] - S * 0.35 + Math.sin(a) * S * 0.25, top[0] + sw + Math.cos(a) * S * 1.4, top[1] + S * 0.25 + Math.sin(a) * S * 0.45); ctx.stroke(); } return; }
  const top = P(u, v, 2.2); ctx.strokeStyle = '#5b3d24'; ctx.lineWidth = Math.max(4, S * 0.16); ctx.beginPath(); ctx.moveTo(b[0], b[1]); ctx.lineTo(top[0], top[1]); ctx.stroke();
  const cols = ['#3f6b2f', '#4f7f35', '#68963f', '#80ad4a']; for (let i = 0; i < 7; i++) { const a = i / 7 * TAU + k, rr = S * (0.55 + hash(k + i) * 0.25); ctx.fillStyle = cols[i % 4]; ctx.beginPath(); ctx.arc(top[0] + sw + Math.cos(a) * S * 0.55, top[1] - S * 0.3 + Math.sin(a) * S * 0.35, rr, 0, TAU); ctx.fill(); }
  ctx.fillStyle = 'rgba(255,240,170,.22)'; ctx.beginPath(); ctx.arc(top[0] + sw - S * 0.3, top[1] - S * 0.6, S * 0.45, 0, TAU); ctx.fill(); }
/* ---------- kids ---------- */
function kid(x, y, sc, o, t) { // feet at x,y; o: {team, skin, hair, walk, dir, carry, jail, alpha, me, cd, imm, name, num}
  const T = TEAM[o.team], h = 58 * sc, ph = o.walk || 0, sw = Math.sin(ph) * (o.moving ? 1 : 0); ctx.save(); ctx.globalAlpha = o.alpha == null ? 1 : o.alpha;
  shadow(x + 4 * sc, y + 1, 16 * sc, 5.5 * sc, 0.5);
  if (o.me) { ctx.strokeStyle = 'rgba(255,225,90,' + (0.7 + 0.3 * Math.sin(t * 5)) + ')'; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(x, y, 17 * sc, 7 * sc, 0, 0, TAU); ctx.stroke(); }
  ctx.translate(x, y - (o.moving ? Math.abs(Math.sin(ph)) * 3 * sc : 0)); const face = o.face || 1; ctx.scale(face, 1); ctx.lineCap = 'round'; ctx.lineJoin = 'round'; const ol = 'rgba(40,18,8,.85)';
  if (o.jail) { // sitting, hugging knees
    ctx.fillStyle = '#3b3b4a'; ctx.beginPath(); ctx.ellipse(0, -h * 0.12, 11 * sc, 6 * sc, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = T.c; ctx.beginPath(); ctx.ellipse(0, -h * 0.35, 9 * sc, 11 * sc, 0, 0, TAU); ctx.fill(); ctx.strokeStyle = ol; ctx.lineWidth = 1.2; ctx.stroke();
    ctx.fillStyle = o.skin; ctx.beginPath(); ctx.arc(0, -h * 0.62, 7.5 * sc, 0, TAU); ctx.fill(); ctx.stroke(); ctx.fillStyle = o.hair; ctx.beginPath(); ctx.arc(0, -h * 0.66, 7.6 * sc, Math.PI * 1.05, TAU * 0.98); ctx.fill();
    ctx.restore(); return; }
  // legs
  ctx.strokeStyle = o.skin; ctx.lineWidth = 4.5 * sc; ctx.beginPath(); ctx.moveTo(-3 * sc, -h * 0.34); ctx.lineTo(-3 * sc + sw * 5 * sc, -1); ctx.moveTo(3 * sc, -h * 0.34); ctx.lineTo(3 * sc - sw * 5 * sc, -1); ctx.stroke();
  ctx.fillStyle = '#2a2a2a'; ctx.fillRect(-6 * sc + sw * 5 * sc, -3 * sc, 6 * sc, 3 * sc); ctx.fillRect(0 - sw * 5 * sc, -3 * sc, 6 * sc, 3 * sc);
  // shorts
  ctx.fillStyle = '#2f3550'; ctx.beginPath(); ctx.moveTo(-8 * sc, -h * 0.5); ctx.lineTo(8 * sc, -h * 0.5); ctx.lineTo(9 * sc, -h * 0.32); ctx.lineTo(-9 * sc, -h * 0.32); ctx.closePath(); ctx.fill();
  // back arm
  ctx.strokeStyle = mixSkin(o.skin); ctx.lineWidth = 4 * sc; ctx.beginPath(); ctx.moveTo(-7 * sc, -h * 0.76); ctx.lineTo(-9 * sc - sw * 4 * sc, -h * 0.5); ctx.stroke();
  // shirt (kaos) with number
  const g = ctx.createLinearGradient(-9 * sc, 0, 9 * sc, 0); g.addColorStop(0, T.l); g.addColorStop(0.45, T.c); g.addColorStop(1, T.d);
  ctx.beginPath(); ctx.moveTo(-9 * sc, -h * 0.5); ctx.quadraticCurveTo(-10.5 * sc, -h * 0.8, -6 * sc, -h * 0.84); ctx.lineTo(6 * sc, -h * 0.84); ctx.quadraticCurveTo(10.5 * sc, -h * 0.8, 9 * sc, -h * 0.5); ctx.closePath(); ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = ol; ctx.lineWidth = 1.2; ctx.stroke();
  if (o.num) { ctx.fillStyle = 'rgba(255,255,255,.9)'; ctx.font = '900 ' + Math.round(9 * sc) + 'px system-ui,sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(o.num, 0, -h * 0.66); }
  // front arm (holding flag stick when carrying)
  ctx.strokeStyle = o.skin; ctx.lineWidth = 4 * sc; ctx.beginPath(); ctx.moveTo(7 * sc, -h * 0.76); if (o.carry != null) ctx.lineTo(11 * sc, -h * 0.98); else ctx.lineTo(9 * sc + sw * 4 * sc, -h * 0.5); ctx.stroke();
  // head, hair, ikat kepala
  ctx.fillStyle = o.skin; ctx.beginPath(); ctx.ellipse(0, -h * 0.94, 8 * sc, 8.5 * sc, 0, 0, TAU); ctx.fill(); ctx.strokeStyle = ol; ctx.stroke();
  ctx.fillStyle = o.hair; ctx.beginPath(); ctx.ellipse(-1 * sc, -h * 1.0, 8.4 * sc, 5.5 * sc, -0.15, Math.PI * 0.95, TAU * 1.02); ctx.fill();
  ctx.fillStyle = T.c; ctx.fillRect(-8.2 * sc, -h * 1.0, 16.4 * sc, 2.6 * sc); ctx.beginPath(); ctx.moveTo(-8 * sc, -h * 0.99); ctx.lineTo(-14 * sc, -h * 0.94 + Math.sin(t * 9) * 2); ctx.lineTo(-13 * sc, -h * 0.9); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#1d1208'; ctx.beginPath(); ctx.arc(4 * sc, -h * 0.93, 1.2 * sc, 0, TAU); ctx.fill();
  if (o.carry != null) { ctx.strokeStyle = '#d7b46a'; ctx.lineWidth = 2.2 * sc; ctx.beginPath(); ctx.moveTo(11 * sc, -h * 0.98); ctx.lineTo(4 * sc, -h * 1.75); ctx.stroke(); ctx.scale(face, 1); cloth(4 * sc * face, -h * 1.75, 22 * sc * face, 14 * sc, TEAM[o.carry], t); }
  ctx.restore();
  if (o.cd) { ctx.fillStyle = '#9fdcff'; ctx.beginPath(); ctx.ellipse(x + 10 * sc, y - h * 1.05 + Math.sin(t * 8) * 2, 2.5 * sc, 4 * sc, 0, 0, TAU); ctx.fill(); }
  if (o.imm && Math.sin(t * 18) > 0) { ctx.strokeStyle = 'rgba(255,255,255,.8)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(x, y - h * 0.55, 13 * sc, h * 0.62, 0, 0, TAU); ctx.stroke(); }
}
function mixSkin(c) { const n = parseInt(c.slice(1), 16), r = (n >> 16) * 0.82, g = ((n >> 8) & 255) * 0.82, b = (n & 255) * 0.82; return 'rgb(' + (r | 0) + ',' + (g | 0) + ',' + (b | 0) + ')'; }
function label(x, y, txt, T, me) { ctx.font = '800 ' + Math.max(10, Math.round(S * 0.27)) + 'px system-ui,sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom'; const w = ctx.measureText(txt).width + 10; ctx.fillStyle = me ? 'rgba(255,214,80,.95)' : 'rgba(30,18,10,.6)'; rr(x - w / 2, y - 15, w, 15, 7); ctx.fill(); ctx.fillStyle = me ? '#3a2208' : '#fff'; ctx.fillText(txt, x, y - 1.5); ctx.fillStyle = T.c; ctx.fillRect(x - w / 2 + 3, y - 3, w - 6, 2); }
function rr(x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
const PING = { serang: ['⚔️', '#ff6a4a', 'Serang!'], jaga: ['🛡️', '#58b4ff', 'Jaga!'], tolong: ['🆘', '#ffd34d', 'Tolong!'] };
function ping(g, t) { const p = P(g.x, g.y, 0), age = (g.age || 0) / 1000, k = PING[g.k] || PING.serang, a = Math.max(0, 1 - Math.max(0, age - 2.6) / 0.9);
  ctx.save(); ctx.globalAlpha = a; ctx.strokeStyle = k[1]; ctx.lineWidth = 3; for (let i = 0; i < 2; i++) { const e = ((age * 1.3 + i * 0.5) % 1); ctx.globalAlpha = a * (1 - e); ctx.beginPath(); ctx.ellipse(p[0], p[1], S * (0.3 + e * 0.9), S * (0.17 + e * 0.5), 0, 0, TAU); ctx.stroke(); }
  ctx.globalAlpha = a; const top = p[1] - S * 1.6 - Math.abs(Math.sin(age * 5)) * 6; const gr = ctx.createLinearGradient(0, top, 0, p[1]); gr.addColorStop(0, k[1]); gr.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = gr; ctx.fillRect(p[0] - 2, top, 4, p[1] - top);
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(p[0], top, 14, 0, TAU); ctx.fill(); ctx.strokeStyle = k[1]; ctx.lineWidth = 3; ctx.stroke(); ctx.font = '15px system-ui,sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(k[0], p[0], top + 1);
  ctx.font = '800 11px system-ui,sans-serif'; ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(20,10,5,.8)'; const tx = (g.n ? g.n + ': ' : '') + k[2]; ctx.strokeText(tx, p[0], top - 22); ctx.fillStyle = '#fff'; ctx.fillText(tx, p[0], top - 22); ctx.restore(); }
/* ---------- scene ---------- */
function occluded(r, dd, kids, ht) { if (!kids) return false; const cs = [P(r[0], r[1], 0), P(r[2], r[1], 0), P(r[0], r[3], 0), P(r[2], r[3], 0)]; let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9; for (const c of cs) { x0 = Math.min(x0, c[0]); x1 = Math.max(x1, c[0]); y0 = Math.min(y0, c[1]); y1 = Math.max(y1, c[1]); } y0 -= S * ht;
  for (const p of kids) { if (!(p.me || p.carry != null)) continue; const q = V(p.x, p.y); if (q[0] + q[1] >= dd) continue; const sp = P(p.x, p.y, 0); if (sp[0] > x0 && sp[0] < x1 && sp[1] - S * 0.7 > y0 && sp[1] - S * 0.7 < y1) return true; } return false; }
function scene(c, w, h, st, now) {
  ctx = c; c._dpr = c._dpr || 1; W = w; H = h; const t = now / 1000; S = st.S || Math.max(26, Math.min(52, Math.min(w / 9.2, h / 10.5)));
  FL = !!st.flip; const f = V(st.cam[0], st.cam[1]); CU = f[0]; CV = f[1]; CX = w / 2; CY = h * (st.cy || 0.55);
  // sky-free ground: far sawah plane (slower = lower), then the village plane on top
  c.fillStyle = '#5f7f3c'; c.fillRect(0, 0, w, h);
  const keep = [S, CU, CV]; S = S * 0.82; CU = CU * 0.72 + 3.4; CV = CV * 0.72 + 2; const ft = farTex(); for (let i = -2; i < 4; i++) for (let j = -2; j < 3; j++) plane(ft, -12 + i * 512 / 40, -10 + j * 512 / 40, 40, 1); S = keep[0]; CU = keep[1]; CV = keep[2];
  plane(groundTex(), -M, -M, PX, 1);
  // drifting cloud shadows (soft, on the ground plane)
  for (let i = 0; i < 3; i++) { const u = ((t * 0.35 + i * 13) % 44) - 10, v = 2 + i * 5, p = P(u, v, 0); shadow(p[0], p[1], S * 4.5, S * 2.2, 0.13); }
  // sprites
  const list = [], add = (u, v, fn, bias) => list.push({ d: depth(u, v) + (bias || 0), fn });
  for (let k = 0; k < B.OBS.length; k++) { const o = B.OBS[k], cu = (o.r[0] + o.r[2]) / 2, cv = (o.r[1] + o.r[3]) / 2, vr = vrect(o.r);
    const dd = vr[2] + vr[3] - (o.k === 'pagar' ? 0 : Math.min(vr[2] - vr[0], vr[3] - vr[1]) * 0.5); const occ = o.k === 'rumah' || o.k === 'rumah2' || o.k === 'warung' ? occluded(o.r, dd, st.kids, o.k === 'warung' ? 1.9 : 2.7) : false;
    list.push({ d: dd, fn: () => { if (occ) ctx.globalAlpha = 0.4; o.k === 'warung' ? warung(o, t) : o.k === 'pagar' ? pagar(o) : o.k === 'sumur' ? sumur(o) : house(o, k); ctx.globalAlpha = 1; } }); }
  B.JEM.forEach(r => { const vr = vrect(r); list.push({ d: vr[2] + vr[3] - 1.2, fn: () => jemuran(r, t) }); });
  B.PR.forEach((p, i) => add(p[0], p[1], () => posRonda(p, t, st.prReady), 0.2));
  B.JAIL.forEach(j => { const q = V(j[0], j[1]); list.push({ d: q[0] + q[1] - 1.9, fn: () => jailCage(j, t) }); list.push({ d: q[0] + q[1] + 2.05, fn: () => jailFront(j) }); });
  (st.flags || []).forEach((fl, i) => { if (fl.by < 0) add(fl.x, fl.y, () => flagPole([fl.x, fl.y], { i }, t)); else add(B.FLAG[i][0], B.FLAG[i][1], () => flagPole(B.FLAG[i], { i, empty: true }, t)); });
  TREES.forEach((tr, k) => add(tr[0], tr[1], () => tree(tr[0], tr[1], k, t, tr[2]), 0.3));
  for (const p of st.kids || []) add(p.x, p.y, () => { const sp = P(p.x, p.y, 0), q = V(p.x + Math.cos(p.dir || 0), p.y + Math.sin(p.dir || 0)), cq = V(p.x, p.y); const face = ((q[0] - cq[0]) - (q[1] - cq[1])) >= 0 ? 1 : -1; kid(sp[0], sp[1], S / 46, Object.assign({ face }, p), t); if (p.name && !p.jail && (p.alpha == null || p.alpha > 0.2)) label(sp[0], sp[1] - S * 1.48 - (p.carry != null ? S * 0.5 : 0), p.name, TEAM[p.team], p.me); }, 0.05);
  // own path dots + target ring (on the ground, under sprites)
  if (st.route && st.route.length) { c.fillStyle = 'rgba(255,240,170,.75)'; let a = st.route[0]; for (let i = 1; i < st.route.length; i++) { const b = st.route[i], L = Math.hypot(b[0] - a[0], b[1] - a[1]); for (let s = 0; s < L; s += 0.45) { const p = P(a[0] + (b[0] - a[0]) * s / L, a[1] + (b[1] - a[1]) * s / L, 0); c.beginPath(); c.ellipse(p[0], p[1], 2.6, 1.6, 0, 0, TAU); c.fill(); } a = b; } }
  if (st.tap) { const p = P(st.tap.x, st.tap.y, 0), e = Math.min(1, st.tap.age / 500); c.strokeStyle = 'rgba(255,230,120,' + (1 - e) + ')'; c.lineWidth = 3; c.beginPath(); c.ellipse(p[0], p[1], S * (0.2 + e * 0.5), S * (0.12 + e * 0.28), 0, 0, TAU); c.stroke(); }
  list.sort((a, b) => a.d - b.d); for (const it of list) it.fn();
  for (const g of st.pings || []) ping(g, t);
  // near parallax layer: bunting strings (move faster than the ground) + leaf silhouettes
  const off = ((CU - CV) * KX * S * 1.4) % 120; c.save(); for (let r = 0; r < 2; r++) { const y0 = 6 + r * 22, sag = 14; c.strokeStyle = 'rgba(80,50,30,.55)'; c.lineWidth = 1.2; c.beginPath(); for (let x = -140; x < w + 140; x += 6) { const xx = x - off * (1 + r * 0.3); const yy = y0 + Math.sin(((xx + 2000) % 240) / 240 * Math.PI) * sag; x === -140 ? c.moveTo(xx, yy) : c.lineTo(xx, yy); } c.stroke();
    for (let x = -140; x < w + 140; x += 20) { const xx = x - off * (1 + r * 0.3), yy = y0 + Math.sin(((xx + 2000) % 240) / 240 * Math.PI) * sag; c.fillStyle = ((x / 20 + r) & 1) ? '#e2412f' : '#f5efe0'; c.beginPath(); c.moveTo(xx - 6, yy); c.lineTo(xx + 6, yy); c.lineTo(xx, yy + 13 + Math.sin(t * 3 + x) * 1.5); c.closePath(); c.fill(); } }
  c.fillStyle = 'rgba(30,50,20,.55)'; const lo = ((CU + CV) * KY * S * 1.35) % 300; for (let i = -1; i < 3; i++) { const y = h - 20 + ((i * 300 - lo) % 600 + 600) % 600 - 300; c.beginPath(); c.ellipse(-10, y, 46, 22, 0.7, 0, TAU); c.fill(); c.beginPath(); c.ellipse(w + 10, y + 150, 46, 22, -0.7, 0, TAU); c.fill(); } c.restore();
  // warm late-afternoon grade + vignette (+ red edge when in enemy land)
  c.save(); c.globalCompositeOperation = 'soft-light'; c.fillStyle = 'rgba(255,170,80,.28)'; c.fillRect(0, 0, w, h); c.restore();
  const vg = c.createRadialGradient(w / 2, h * 0.52, Math.min(w, h) * 0.38, w / 2, h * 0.52, Math.max(w, h) * 0.78); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, st.danger ? 'rgba(150,20,10,' + (0.45 + 0.12 * Math.sin(t * 6)) + ')' : 'rgba(40,20,5,.42)'); c.fillStyle = vg; c.fillRect(0, 0, w, h);
}
const TREES = [[0.2 - 1.4, 2, 'mangga'], [-1.2, 12.4, 'kelapa'], [3.2, -1.3, 'kelapa'], [9, -1.5, 'mangga'], [14.6, -1.4, 'kelapa'], [20.6, -1.2, 'mangga'], [25.3, 1.6, 'kelapa'], [25.4, 11.8, 'mangga'], [21, 15.4, 'kelapa'], [15, 15.5, 'mangga'], [9.4, 15.4, 'kelapa'], [3, 15.3, 'mangga'], [-1.5, 7.5, 'mangga'], [25.5, 6.5, 'kelapa'], [11.4, 6.6, 'mangga']];
function minimap(c, x, y, w, h, st) { // top-down, own base at the bottom
  const flip = !!st.flip, mx = (u, v) => { const q = flip ? [B.W - u, B.H - v] : [u, v]; return [x + (B.H - q[1]) / B.H * w, y + q[0] / B.W * h]; };
  c.save(); c.globalAlpha = 0.92; c.fillStyle = 'rgba(70,96,40,.85)'; rrC(c, x - 3, y - 3, w + 6, h + 6, 8); c.fill(); c.strokeStyle = 'rgba(255,250,230,.6)'; c.lineWidth = 1.5; c.stroke();
  const a = mx(B.MID, 0), b = mx(B.MID, B.H); c.setLineDash([3, 3]); c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.stroke(); c.setLineDash([]);
  const rect = (r, col) => { const p = mx(r[0], r[1]), q = mx(r[2], r[3]); c.fillStyle = col; c.fillRect(Math.min(p[0], q[0]), Math.min(p[1], q[1]), Math.abs(q[0] - p[0]), Math.abs(q[1] - p[1])); };
  B.OBS.forEach(o => rect(o.r, 'rgba(120,60,40,.9)')); B.JEM.forEach(r => rect(r, 'rgba(255,255,255,.25)'));
  B.PR.forEach(p => { const q = mx(p[0], p[1]); c.fillStyle = '#ffd34d'; c.fillRect(q[0] - 2.5, q[1] - 2.5, 5, 5); });
  B.JAIL.forEach((j, i) => { const q = mx(j[0], j[1]); c.strokeStyle = TEAM[i].l; c.strokeRect(q[0] - 5, q[1] - 4, 10, 8); });
  (st.flags || []).forEach((f, i) => { const q = mx(f.x, f.y); c.fillStyle = TEAM[i].c; c.beginPath(); c.moveTo(q[0], q[1] - 6); c.lineTo(q[0] + 6, q[1] - 3.5); c.lineTo(q[0], q[1] - 1); c.fill(); c.fillStyle = '#fff'; c.fillRect(q[0] - 0.7, q[1] - 6, 1.4, 7); });
  for (const p of st.kids || []) { if (p.alpha != null && p.alpha < 0.2) continue; const q = mx(p.x, p.y); c.fillStyle = TEAM[p.team].c; c.beginPath(); c.arc(q[0], q[1], p.me ? 3.6 : 2.6, 0, TAU); c.fill(); if (p.me) { c.strokeStyle = '#ffe15a'; c.lineWidth = 1.5; c.stroke(); } }
  for (const g of st.pings || []) { const q = mx(g.x, g.y); c.strokeStyle = (PING[g.k] || PING.serang)[1]; c.lineWidth = 2; c.beginPath(); c.arc(q[0], q[1], 4 + (g.age % 600) / 120, 0, TAU); c.stroke(); }
  c.restore(); }
function rrC(c, x, y, w, h, r) { const o = ctx; ctx = c; rr(x, y, w, h, r); ctx = o; }
/* screen -> world (ground plane z=0), used for tap-to-move */
function unproject(sx, sy) { const a = (sx - CX) / (KX * S), b = (sy - CY) / (KY * S); const du = (a + b) / 2, dv = (b - a) / 2; const u = du + CU, v = dv + CV; return FL ? [B.W - u, B.H - v] : [u, v]; }
function caption(c, w, h, a, b, al, col) { c.save(); c.globalAlpha = al == null ? 1 : al; c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = '900 ' + Math.round(Math.min(34, w * 0.08)) + 'px system-ui,sans-serif'; c.lineWidth = 7; c.strokeStyle = 'rgba(40,16,6,.85)'; c.strokeText(a, w / 2, h * 0.3); c.fillStyle = col || '#ffe08a'; c.fillText(a, w / 2, h * 0.3); if (b) { c.font = '800 ' + Math.round(Math.min(17, w * 0.042)) + 'px system-ui,sans-serif'; c.lineWidth = 4; c.strokeText(b, w / 2, h * 0.3 + 34); c.fillStyle = '#fff'; c.fillText(b, w / 2, h * 0.3 + 34); } c.restore(); }
window.RR = { scene, minimap, unproject, project: (u, v, z) => P(u, v, z), scale: () => S, caption, TEAM, SKIN, PING, kid, setCtx: c => { ctx = c; } };
})();

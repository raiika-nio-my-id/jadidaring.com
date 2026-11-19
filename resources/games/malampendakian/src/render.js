/* Malam Pendakian renderer: cached ground chunks, pine forest, hikers, pocong & kuntilanak, darkness with flashlight cones,
   drifting fog, lamps, particles and screen-edge markers. Pure canvas, no assets. */
(function (root) {
'use strict';
const G = root.MPGame, CFG = G.CFG, COLORS = G.COLORS;
const TAU = Math.PI * 2;
function hash(x, y) { let h = (x * 374761393 + y * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177 | 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
function rr(g, x, y, w, h, r) { r = Math.min(r, w / 2, h / 2); g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
function ell(g, x, y, rx, ry) { g.beginPath(); g.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), 0, 0, TAU); }
function mk(w, h) { const c = (root.OffscreenCanvas && false) ? new OffscreenCanvas(w, h) : root.document.createElement('canvas'); c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h)); return c; }
function shade(hex, k) { const n = parseInt(hex.slice(1), 16); let r = n >> 16, g = (n >> 8) & 255, b = n & 255; r = Math.round(k < 0 ? r * (1 + k) : r + (255 - r) * k); g = Math.round(k < 0 ? g * (1 + k) : g + (255 - g) * k); b = Math.round(k < 0 ? b * (1 + k) : b + (255 - b) * k); return 'rgb(' + r + ',' + g + ',' + b + ')'; }

/* ---------- ground chunks (CSS-pixel resolution, cached per map + tile size) ---------- */
const CH = 12; let chunkKey = '', chunks = new Map();
function groundColor(m, y) { const k = G.clamp((m.camp.y - y) / (m.camp.y - m.shrine.y), 0, 1); const a = [20, 40, 30], b = [30, 36, 44]; return a.map((v, i) => Math.round(v + (b[i] - v) * k)); }
function drawChunk(m, ci, ts) {
  const W = m.W, c = mk(W * ts, CH * ts), g = c.getContext('2d'), y0 = ci * CH;
  for (let y = 0; y < CH; y++) { const col = groundColor(m, y0 + y); g.fillStyle = 'rgb(' + col.join(',') + ')'; g.fillRect(0, y * ts, W * ts, ts + 1); }
  // mottled moss / soil noise
  for (let y = 0; y < CH; y++) for (let x = 0; x < W; x++) { for (let k = 0; k < 3; k++) { const r = hash(x * 7 + k, (y0 + y) * 13 + k); g.fillStyle = r < 0.5 ? 'rgba(70,110,70,.10)' : 'rgba(0,0,0,.12)'; ell(g, (x + hash(x + k, y0 + y)) * ts, (y + hash(y0 + y + k, x)) * ts, ts * (0.25 + r * 0.4), ts * (0.15 + r * 0.25)); g.fill(); } }
  // trail: soft dirt band, lighter centre, stones, wooden steps
  const yy = j => (j - y0) * ts;
  for (const [w, col] of [[2.3, 'rgba(70,52,36,.55)'], [1.75, '#5c4632'], [1.0, '#6e5640'], [0.45, 'rgba(150,120,90,.35)']]) {
    g.strokeStyle = col; g.lineWidth = w * ts; g.lineCap = 'round'; g.lineJoin = 'round'; g.beginPath();
    for (let j = y0 - 1; j <= y0 + CH + 1; j++) { const jj = G.clamp(j, 0, m.H - 1); const X = m.tx[jj] * ts, Y = yy(j + 0.5); if (j === y0 - 1) g.moveTo(X, Y); else g.lineTo(X, Y); }
    g.stroke();
  }
  for (let j = y0; j < y0 + CH; j++) {
    const X = m.tx[G.clamp(j, 0, m.H - 1)] * ts, Y = yy(j + 0.5);
    for (let k = 0; k < 3; k++) { const r = hash(j, k + 3); g.fillStyle = r < 0.5 ? '#8a7a68' : '#5a4c3e'; ell(g, X + (r - 0.5) * ts * 1.4, Y + (hash(k, j) - 0.5) * ts, ts * 0.09, ts * 0.06); g.fill(); }
    if (j % 4 === 0 && j < m.bot - 2 && j > m.top + 4) { g.fillStyle = '#4a3322'; rr(g, X - ts * 0.62, Y - ts * 0.07, ts * 1.24, ts * 0.15, ts * 0.06); g.fill(); g.fillStyle = 'rgba(255,220,170,.12)'; g.fillRect(X - ts * 0.6, Y - ts * 0.07, ts * 1.2, ts * 0.04); }
    if (hash(j, 99) < 0.25) { g.strokeStyle = '#3b2a1c'; g.lineWidth = ts * 0.06; g.beginPath(); const s = hash(j, 5) < 0.5 ? -1 : 1; g.moveTo(X + s * ts * 1.1, Y - ts * 0.3); g.quadraticCurveTo(X + s * ts * 0.5, Y, X + s * ts * 0.1, Y + ts * 0.25); g.stroke(); }
  }
  // clearings: basecamp, pos, summit plateau
  const clear = (cx, cy, r, col) => { const gr = g.createRadialGradient(cx * ts, yy(cy), 0, cx * ts, yy(cy), r * ts); gr.addColorStop(0, col); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(cx * ts - r * ts, yy(cy) - r * ts, r * 2 * ts, r * 2 * ts); };
  clear(m.camp.x, m.camp.y, 5.5, 'rgba(110,90,60,.55)'); m.pos.forEach(p => clear(p.x, p.y, 2.8, 'rgba(110,90,60,.5)')); clear(m.shrine.x, m.shrine.y + 0.5, 4.6, 'rgba(120,120,130,.55)');
  if (Math.abs(m.shrine.y - (y0 + CH / 2)) < CH) { for (let k = 0; k < 14; k++) { const a = k / 14 * TAU, X = (m.shrine.x + Math.cos(a) * 2.2) * ts, Y = yy(m.shrine.y + 0.4 + Math.sin(a) * 1.5); g.fillStyle = k % 2 ? '#6d6f78' : '#5b5d66'; rr(g, X - ts * 0.3, Y - ts * 0.2, ts * 0.6, ts * 0.4, ts * 0.1); g.fill(); } }
  // ferns / grass tufts / rocks
  for (const f of m.ferns) { if (f.y < y0 - 1 || f.y > y0 + CH + 1) continue; const X = f.x * ts, Y = yy(f.y); g.strokeStyle = 'rgba(80,130,80,.55)'; g.lineWidth = Math.max(1, ts * 0.04); for (let k = 0; k < 5; k++) { const a = -Math.PI / 2 + (k - 2) * 0.45; g.beginPath(); g.moveTo(X, Y); g.quadraticCurveTo(X + Math.cos(a) * ts * 0.25 * f.s, Y + Math.sin(a) * ts * 0.35 * f.s, X + Math.cos(a) * ts * 0.45 * f.s, Y + Math.sin(a) * ts * 0.3 * f.s); g.stroke(); } }
  for (const r of m.rocks) { if (r.y < y0 - 1 || r.y > y0 + CH + 1) continue; const X = r.x * ts, Y = yy(r.y); g.fillStyle = 'rgba(0,0,0,.3)'; ell(g, X + ts * 0.05, Y + ts * 0.08, ts * 0.3 * r.s, ts * 0.16 * r.s); g.fill(); g.fillStyle = '#545a5c'; ell(g, X, Y, ts * 0.28 * r.s, ts * 0.18 * r.s); g.fill(); g.fillStyle = 'rgba(190,210,220,.25)'; ell(g, X - ts * 0.07 * r.s, Y - ts * 0.06 * r.s, ts * 0.13 * r.s, ts * 0.07 * r.s); g.fill(); g.fillStyle = 'rgba(90,140,80,.4)'; ell(g, X + ts * 0.1 * r.s, Y - ts * 0.08 * r.s, ts * 0.08 * r.s, ts * 0.05 * r.s); g.fill(); }
  return c;
}
function ground(m, ci, ts) {
  const key = m.seed + ':' + ts; if (key !== chunkKey) { chunkKey = key; chunks = new Map(); }
  let c = chunks.get(ci); if (!c) { c = drawChunk(m, ci, ts); chunks.set(ci, c); if (chunks.size > 6) chunks.delete(chunks.keys().next().value); }
  return c;
}

/* ---------- sprites ---------- */
let treeKey = '', treeSpr = [];
function treeSprites(ts) {
  if (treeKey === String(ts)) return treeSpr; treeKey = String(ts); const S = ts * 2.6;
  const pal = [['#10261c', '#1b3a2a', '#2a5440', '#4f8a6d'], ['#0e2219', '#183526', '#244c38', '#467f63'], ['#132a22', '#1f4233', '#2f5e4a', '#5c9a7c']];
  treeSpr = pal.map((p, v) => {
    const c = mk(S, S * 1.25), g = c.getContext('2d'), cx = S / 2, base = S * 1.05;
    g.fillStyle = 'rgba(0,0,0,.35)'; ell(g, cx + S * 0.08, base - S * 0.02, S * 0.34, S * 0.12); g.fill();
    g.fillStyle = '#3a2618'; g.fillRect(cx - S * 0.035, base - S * 0.2, S * 0.07, S * 0.2);
    const tiers = v === 2 ? 3 : 4;
    for (let i = 0; i < tiers; i++) {
      const k = i / tiers, w = S * (0.44 - k * 0.3), yb = base - S * 0.12 - k * S * 0.62, yt = yb - S * 0.38;
      g.fillStyle = p[Math.min(3, i)]; g.beginPath(); g.moveTo(cx - w, yb); for (let j = 1; j < 7; j++) { const t = j / 7; g.lineTo(cx - w + 2 * w * t, yb + (j % 2 ? S * 0.035 : -S * 0.01)); } g.lineTo(cx + w, yb); g.lineTo(cx, yt); g.closePath(); g.fill();
      g.fillStyle = 'rgba(160,200,230,.16)'; g.beginPath(); g.moveTo(cx - w * 0.9, yb - S * 0.01); g.lineTo(cx, yt); g.lineTo(cx - w * 0.25, yb - S * 0.02); g.closePath(); g.fill();
    }
    return { c, ox: cx, oy: base - S * 0.05 };
  });
  return treeSpr;
}

/* ---------- characters ---------- */
function drawHiker(g, x, y, ts, h, now, meta) {
  const col = COLORS[h.c % COLORS.length], s = ts * 0.5, face = Math.cos(h.f) >= 0 ? 1 : -1;
  if (h.dn) {
    g.save(); g.translate(x, y); g.rotate(Math.sin(now / 90) * 0.06); g.fillStyle = 'rgba(0,0,0,.35)'; ell(g, 0, s * 0.3, s * 1.05, s * 0.35); g.fill();
    g.fillStyle = shade(col, -0.35); rr(g, -s * 0.95, -s * 0.1, s * 0.5, s * 0.55, s * 0.15); g.fill();
    g.fillStyle = col; rr(g, -s * 0.55, -s * 0.2, s * 1.0, s * 0.6, s * 0.25); g.fill();
    g.fillStyle = '#e9c4a0'; ell(g, s * 0.6, s * 0.08, s * 0.3, s * 0.3); g.fill(); g.fillStyle = col; g.beginPath(); g.arc(s * 0.65, s * 0.02, s * 0.3, Math.PI * 1.1, Math.PI * 2.1); g.fill();
    g.restore();
    g.strokeStyle = 'rgba(190,110,255,.85)'; g.lineWidth = Math.max(1.5, ts * 0.05); for (let k = 0; k < 2; k++) { g.beginPath(); for (let a = 0; a < TAU * 1.6; a += 0.3) { const rr2 = s * 0.12 + a * s * 0.08, aa = a + now / 260 + k * Math.PI; const X = x + Math.cos(aa) * rr2, Y = y - s * 1.1 + Math.sin(aa) * rr2 * 0.5; if (a === 0) g.moveTo(X, Y); else g.lineTo(X, Y); } g.stroke(); }
    if (h.rvp > 0) { g.strokeStyle = 'rgba(0,0,0,.5)'; g.lineWidth = ts * 0.12; g.beginPath(); g.arc(x, y, s * 1.35, 0, TAU); g.stroke(); g.strokeStyle = '#ffe28a'; g.lineWidth = ts * 0.08; g.beginPath(); g.arc(x, y, s * 1.35, -Math.PI / 2, -Math.PI / 2 + TAU * Math.min(1, h.rvp)); g.stroke(); }
  } else {
    const wk = h.walk || 0, bob = Math.abs(Math.sin(wk)) * s * 0.12, step = Math.sin(wk) * s * 0.22;
    g.fillStyle = 'rgba(0,0,0,.38)'; ell(g, x, y + s * 0.62, s * 0.62, s * 0.24); g.fill();
    g.fillStyle = '#2b2a33'; ell(g, x - s * 0.22, y + s * 0.5 + step * 0.4, s * 0.15, s * 0.17); g.fill(); ell(g, x + s * 0.22, y + s * 0.5 - step * 0.4, s * 0.15, s * 0.17); g.fill();
    const yb = y - bob;
    // backpack (behind) + bedroll
    g.fillStyle = shade(col, -0.45); rr(g, x - s * 0.5 - face * s * 0.12, yb - s * 0.55, s * 1.0, s * 0.95, s * 0.28); g.fill();
    g.fillStyle = '#c9a06a'; rr(g, x - s * 0.55 - face * s * 0.12, yb - s * 0.75, s * 1.1, s * 0.26, s * 0.13); g.fill(); g.strokeStyle = 'rgba(0,0,0,.25)'; g.lineWidth = 1; g.stroke();
    // body / jacket
    g.fillStyle = col; rr(g, x - s * 0.42, yb - s * 0.35, s * 0.84, s * 0.8, s * 0.3); g.fill();
    g.fillStyle = 'rgba(255,255,255,.18)'; rr(g, x - s * 0.36, yb - s * 0.3, s * 0.3, s * 0.6, s * 0.15); g.fill();
    g.fillStyle = shade(col, -0.2); g.fillRect(x - s * 0.04, yb - s * 0.3, s * 0.08, s * 0.7);
    // head + kupluk (beanie) + headlamp
    g.fillStyle = '#e9c4a0'; ell(g, x + face * s * 0.05, yb - s * 0.62, s * 0.34, s * 0.32); g.fill();
    g.fillStyle = '#2a1d16'; ell(g, x + face * s * 0.17, yb - s * 0.6, s * 0.04, s * 0.06); g.fill();
    g.fillStyle = shade(col, 0.25); g.beginPath(); g.arc(x + face * s * 0.05, yb - s * 0.68, s * 0.35, Math.PI, TAU); g.fill();
    g.fillStyle = shade(col, -0.3); g.fillRect(x - s * 0.3 + face * s * 0.05, yb - s * 0.72, s * 0.6, s * 0.09);
    g.fillStyle = '#fff'; ell(g, x + face * s * 0.05, yb - s * 1.05, s * 0.1, s * 0.1); g.fill();
    if (meta.light) { const hx = x + Math.cos(h.f) * s * 0.3, hy = yb - s * 0.66 + Math.sin(h.f) * s * 0.15; g.fillStyle = '#fff6c2'; ell(g, hx, hy, s * 0.09, s * 0.09); g.fill(); }
    if (h.rv) { g.strokeStyle = 'rgba(255,226,138,.8)'; g.lineWidth = 2; g.beginPath(); g.arc(x, yb - s * 0.2, s * (0.9 + 0.1 * Math.sin(now / 120)), 0, TAU); g.stroke(); }
  }
}
function drawPocong(g, x, y, ts, e, now, alpha) {
  const s = ts * 0.55, hop = e.fr ? 0 : Math.max(0, Math.sin(((e.ph || 0) % 1) / 0.6 * Math.PI)) * (((e.ph || 0) % 1) < 0.6 ? 1 : 0), lift = hop * s * 0.55;
  const jx = e.fr ? (Math.random() - 0.5) * ts * 0.06 : 0, sq = 1 + (hop < 0.15 && !e.fr ? 0.08 : -0.04 * hop);
  g.save(); g.globalAlpha = alpha; g.fillStyle = 'rgba(0,0,0,.4)'; ell(g, x, y + s * 0.55, s * (0.5 - hop * 0.15), s * 0.16); g.fill();
  g.translate(x + jx, y - lift); g.scale(1 / sq, sq);
  const gr = g.createLinearGradient(-s * 0.4, 0, s * 0.4, 0); gr.addColorStop(0, '#d9d6cc'); gr.addColorStop(0.45, '#fbfaf3'); gr.addColorStop(1, '#bdb8aa');
  g.fillStyle = gr; g.beginPath(); g.moveTo(0, -s * 1.45); g.bezierCurveTo(s * 0.55, -s * 1.35, s * 0.5, s * 0.1, s * 0.3, s * 0.55); g.lineTo(-s * 0.3, s * 0.55); g.bezierCurveTo(-s * 0.5, s * 0.1, -s * 0.55, -s * 1.35, 0, -s * 1.45); g.fill();
  g.strokeStyle = 'rgba(120,110,95,.45)'; g.lineWidth = Math.max(1, ts * 0.025); for (let k = 0; k < 4; k++) { g.beginPath(); const yy = -s * 0.5 + k * s * 0.25; g.moveTo(-s * 0.38, yy); g.quadraticCurveTo(0, yy + s * 0.08, s * 0.38, yy - s * 0.04); g.stroke(); }
  g.strokeStyle = '#a49c88'; g.lineWidth = Math.max(1.2, ts * 0.04); g.beginPath(); g.moveTo(-s * 0.2, -s * 1.2); g.lineTo(s * 0.2, -s * 1.22); g.stroke(); g.beginPath(); g.moveTo(-s * 0.32, s * 0.25); g.lineTo(s * 0.32, s * 0.23); g.stroke();
  g.fillStyle = '#f4f1e6'; g.beginPath(); g.moveTo(-s * 0.12, -s * 1.42); g.quadraticCurveTo(-s * 0.32, -s * 1.85, -s * 0.05, -s * 1.7); g.lineTo(0, -s * 1.45); g.quadraticCurveTo(s * 0.3, -s * 1.85, s * 0.12, -s * 1.42); g.fill();
  g.fillStyle = '#6d6252'; ell(g, 0, -s * 0.9, s * 0.25, s * 0.26); g.fill();
  g.fillStyle = '#9a8f78'; ell(g, 0, -s * 0.85, s * 0.2, s * 0.2); g.fill();
  g.fillStyle = '#120c08'; ell(g, -s * 0.08, -s * 0.9, s * 0.055, s * 0.07); g.fill(); ell(g, s * 0.08, -s * 0.9, s * 0.055, s * 0.07); g.fill(); ell(g, 0, -s * 0.76, s * 0.05, s * 0.025); g.fill();
  g.restore();
}
function drawKunti(g, x, y, ts, e, now, alpha) {
  const s = ts * 0.6, bob = Math.sin(now / 420 + e.id) * s * 0.12, fl = 0.85 + 0.15 * Math.sin(now / 70 + e.id * 3);
  g.save(); g.globalAlpha = alpha * fl; g.translate(x, y - s * 0.5 + bob);
  g.fillStyle = 'rgba(0,0,0,.25)'; ell(g, 0, s * 1.3 - bob, s * 0.4, s * 0.12); g.fill();
  const gr = g.createLinearGradient(0, -s * 1.2, 0, s * 1.1); gr.addColorStop(0, 'rgba(250,250,255,.95)'); gr.addColorStop(0.7, 'rgba(225,230,245,.8)'); gr.addColorStop(1, 'rgba(225,230,245,0)');
  g.fillStyle = gr; g.beginPath(); g.moveTo(-s * 0.25, -s * 0.6); g.quadraticCurveTo(-s * 0.7, s * 0.3, -s * 0.62, s * 1.0);
  for (let k = 0; k <= 6; k++) { const t = k / 6; g.lineTo(-s * 0.62 + s * 1.24 * t, s * (k % 2 ? 0.85 : 1.08) + Math.sin(now / 160 + k) * s * 0.05); }
  g.quadraticCurveTo(s * 0.7, s * 0.3, s * 0.25, -s * 0.6); g.closePath(); g.fill();
  g.fillStyle = 'rgba(235,238,250,.9)'; g.beginPath(); g.moveTo(-s * 0.3, -s * 0.45); g.quadraticCurveTo(-s * 0.75, -s * 0.1, -s * 0.85 + Math.sin(now / 300) * s * 0.05, s * 0.2); g.lineTo(-s * 0.72, s * 0.24); g.quadraticCurveTo(-s * 0.55, -s * 0.05, -s * 0.22, -s * 0.25); g.fill();
  g.beginPath(); g.moveTo(s * 0.3, -s * 0.45); g.quadraticCurveTo(s * 0.75, -s * 0.1, s * 0.85 - Math.sin(now / 300) * s * 0.05, s * 0.2); g.lineTo(s * 0.72, s * 0.24); g.quadraticCurveTo(s * 0.55, -s * 0.05, s * 0.22, -s * 0.25); g.fill();
  g.fillStyle = '#d8d2c8'; ell(g, 0, -s * 0.85, s * 0.26, s * 0.3); g.fill();
  g.fillStyle = '#07060a'; g.beginPath(); g.moveTo(-s * 0.32, -s * 0.85); g.quadraticCurveTo(-s * 0.36, -s * 1.3, 0, -s * 1.25); g.quadraticCurveTo(s * 0.36, -s * 1.3, s * 0.32, -s * 0.85);
  g.lineTo(s * 0.42, s * 0.25 + Math.sin(now / 250) * s * 0.06); g.lineTo(s * 0.12, -s * 0.05); g.lineTo(s * 0.06, -s * 0.72); g.lineTo(-s * 0.06, -s * 0.72); g.lineTo(-s * 0.12, -s * 0.05); g.lineTo(-s * 0.42, s * 0.28 + Math.sin(now / 230) * s * 0.06); g.closePath(); g.fill();
  g.fillStyle = '#ff2a2a'; ell(g, -s * 0.03, -s * 0.86, s * 0.025, s * 0.03); g.fill(); ell(g, s * 0.035, -s * 0.86, s * 0.025, s * 0.03); g.fill();
  g.restore();
}
function banishRing(g, x, y, ts, p) { if (p <= 0) return; g.strokeStyle = 'rgba(0,0,0,.45)'; g.lineWidth = ts * 0.1; g.beginPath(); g.arc(x, y, ts * 0.62, 0, TAU); g.stroke(); g.strokeStyle = '#fff1a8'; g.lineWidth = ts * 0.06; g.beginPath(); g.arc(x, y, ts * 0.62, -Math.PI / 2, -Math.PI / 2 + TAU * Math.min(1, p)); g.stroke(); }

/* ---------- props ---------- */
function drawTent(g, x, y, ts, col) { const s = ts; g.fillStyle = 'rgba(0,0,0,.35)'; ell(g, x + s * 0.1, y + s * 0.45, s * 0.95, s * 0.3); g.fill(); g.fillStyle = shade(col, -0.3); g.beginPath(); g.moveTo(x - s * 0.9, y + s * 0.4); g.lineTo(x, y - s * 0.65); g.lineTo(x, y + s * 0.4); g.fill(); g.fillStyle = col; g.beginPath(); g.moveTo(x + s * 0.9, y + s * 0.4); g.lineTo(x, y - s * 0.65); g.lineTo(x, y + s * 0.4); g.fill(); g.fillStyle = '#1a120c'; g.beginPath(); g.moveTo(x - s * 0.18, y + s * 0.4); g.lineTo(x, y - s * 0.05); g.lineTo(x + s * 0.18, y + s * 0.4); g.fill(); }
function drawFire(g, x, y, ts, now) { const s = ts; for (let k = 0; k < 8; k++) { const a = k / 8 * TAU; g.fillStyle = k % 2 ? '#5f5c58' : '#77736d'; ell(g, x + Math.cos(a) * s * 0.42, y + Math.sin(a) * s * 0.26, s * 0.13, s * 0.09); g.fill(); } g.fillStyle = '#3b2414'; g.save(); g.translate(x, y); g.rotate(0.5); g.fillRect(-s * 0.3, -s * 0.05, s * 0.6, s * 0.1); g.rotate(-1); g.fillRect(-s * 0.3, -s * 0.05, s * 0.6, s * 0.1); g.restore(); for (let k = 0; k < 3; k++) { const f = 0.75 + 0.25 * Math.sin(now / (70 + k * 23) + k); g.fillStyle = ['#ff6a1a', '#ffb02e', '#fff0a0'][k]; g.beginPath(); const w = s * (0.3 - k * 0.08), hh = s * (0.75 - k * 0.18) * f; g.moveTo(x - w, y); g.quadraticCurveTo(x - w * 0.6, y - hh * 0.6, x + Math.sin(now / 130) * s * 0.05, y - hh); g.quadraticCurveTo(x + w * 0.6, y - hh * 0.6, x + w, y); g.fill(); } }
function drawSign(g, x, y, ts, text, col) { g.fillStyle = '#3d2a1b'; g.fillRect(x - ts * 0.04, y - ts * 0.2, ts * 0.08, ts * 0.55); g.font = '800 ' + Math.round(ts * 0.26) + 'px system-ui,sans-serif'; const w = g.measureText(text).width + ts * 0.3; g.fillStyle = col || '#7a5434'; rr(g, x - w / 2, y - ts * 0.55, w, ts * 0.38, ts * 0.06); g.fill(); g.strokeStyle = '#2a1b10'; g.lineWidth = 1.5; g.stroke(); g.fillStyle = '#ffe9c4'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, x, y - ts * 0.36); }
function drawPos(g, p, x, y, ts, lit, now, label) {
  const s = ts; g.fillStyle = 'rgba(0,0,0,.35)'; ell(g, x + s * 1.35, y + s * 0.15, s * 1.0, s * 0.35); g.fill();
  const rx = x + s * 1.3, ry = y - s * 0.55; g.fillStyle = '#3c2818'; [[-0.75, 0.55], [0.75, 0.55]].forEach(([a, b]) => g.fillRect(rx + a * s - s * 0.05, ry + b * s - s * 0.2, s * 0.1, s * 0.55));
  g.fillStyle = lit ? '#8b5a33' : '#5d4636'; g.beginPath(); g.moveTo(rx - s * 1.0, ry + s * 0.45); g.lineTo(rx, ry - s * 0.45); g.lineTo(rx + s * 1.0, ry + s * 0.45); g.closePath(); g.fill();
  g.strokeStyle = 'rgba(0,0,0,.3)'; g.lineWidth = 1; for (let k = 1; k < 5; k++) { g.beginPath(); g.moveTo(rx - s * 1.0 + k * s * 0.2, ry + s * 0.45 - k * s * 0.18); g.lineTo(rx + s * 1.0 - k * s * 0.2, ry + s * 0.45 - k * s * 0.18); g.stroke(); }
  drawSign(g, x - s * 1.25, y + s * 0.1, ts * 0.9, label, lit ? '#8a5a2b' : '#4e4136');
  g.fillStyle = '#2b2b2b'; g.fillRect(x - s * 0.04, y - s * 0.9, s * 0.08, s * 0.95);
  const f = lit ? 0.85 + 0.15 * Math.sin(now / 90 + p.i) : 0; g.fillStyle = lit ? 'rgba(255,214,120,' + (0.9 * f) + ')' : '#6b6b70'; ell(g, x, y - s * 1.0, s * 0.17, s * 0.2); g.fill(); g.strokeStyle = '#1e1e1e'; g.lineWidth = 1.5; g.stroke();
}
function drawShrine(g, x, y, ts, now, lit) {
  const s = ts; g.fillStyle = 'rgba(0,0,0,.35)'; ell(g, x + s * 0.15, y + s * 0.35, s * 0.9, s * 0.3); g.fill();
  g.fillStyle = '#6f7078'; rr(g, x - s * 0.75, y - s * 0.05, s * 1.5, s * 0.45, s * 0.08); g.fill(); g.fillStyle = '#8a8b93'; rr(g, x - s * 0.5, y - s * 0.35, s * 1.0, s * 0.4, s * 0.06); g.fill();
  g.fillStyle = '#9d9ea6'; g.beginPath(); g.moveTo(x - s * 0.28, y - s * 0.3); g.lineTo(x - s * 0.18, y - s * 1.55); g.lineTo(x + s * 0.18, y - s * 1.55); g.lineTo(x + s * 0.28, y - s * 0.3); g.fill(); g.fillStyle = 'rgba(255,255,255,.2)'; g.fillRect(x - s * 0.2, y - s * 1.5, s * 0.07, s * 1.15);
  g.fillStyle = '#b0b1b8'; g.beginPath(); g.moveTo(x - s * 0.2, y - s * 1.55); g.lineTo(x, y - s * 1.8); g.lineTo(x + s * 0.2, y - s * 1.55); g.fill();
  // merah putih flag
  const fx = x + s * 0.95, fy = y - s * 1.8; g.fillStyle = '#ddd'; g.fillRect(fx - s * 0.03, fy, s * 0.06, s * 2.0);
  for (let k = 0; k < 2; k++) { g.fillStyle = k ? '#f3f3f3' : '#d6281f'; g.beginPath(); for (let i = 0; i <= 8; i++) { const t = i / 8, X = fx + t * s * 0.8, Y = fy + k * s * 0.22 + Math.sin(now / 180 + t * 5) * s * 0.06 * t; if (!i) g.moveTo(X, Y); else g.lineTo(X, Y); } for (let i = 8; i >= 0; i--) { const t = i / 8, X = fx + t * s * 0.8, Y = fy + (k + 1) * s * 0.22 + Math.sin(now / 180 + t * 5) * s * 0.06 * t; g.lineTo(X, Y); } g.fill(); }
  // offerings + incense smoke
  g.fillStyle = '#d9a441'; ell(g, x - s * 0.35, y + s * 0.15, s * 0.12, s * 0.07); g.fill(); g.fillStyle = '#e04f6a'; ell(g, x + s * 0.32, y + s * 0.15, s * 0.1, s * 0.06); g.fill();
  g.strokeStyle = lit ? 'rgba(255,240,200,.55)' : 'rgba(220,220,230,.35)'; g.lineWidth = Math.max(1, s * 0.04); g.beginPath(); for (let i = 0; i < 12; i++) { const X = x + Math.sin(now / 400 + i * 0.6) * s * 0.12, Y = y - s * 0.4 - i * s * 0.12; if (!i) g.moveTo(X, Y); else g.lineTo(X, Y); } g.stroke();
}
function drawRibbon(g, x, y, ts, now, side) { const s = ts; g.strokeStyle = '#e8282b'; g.lineWidth = Math.max(2, s * 0.09); g.beginPath(); g.moveTo(x - s * 0.08, y - s * 0.55); g.lineTo(x + s * 0.08, y - s * 0.55); g.stroke(); g.lineWidth = Math.max(1.5, s * 0.07); g.beginPath(); g.moveTo(x, y - s * 0.55); g.quadraticCurveTo(x - side * s * 0.25, y - s * 0.35 + Math.sin(now / 200 + x) * s * 0.06, x - side * s * 0.4 + Math.sin(now / 160 + y) * s * 0.08, y - s * 0.2); g.stroke(); }
function drawBattery(g, x, y, ts, now) { const s = ts * 0.32, b = Math.sin(now / 260 + x) * s * 0.15; g.fillStyle = 'rgba(0,0,0,.35)'; ell(g, x, y + s * 0.7, s * 0.6, s * 0.2); g.fill(); g.save(); g.translate(x, y - s * 0.2 + b); g.rotate(-0.4); g.fillStyle = '#1f1f24'; rr(g, -s * 0.9, -s * 0.38, s * 1.8, s * 0.76, s * 0.18); g.fill(); g.fillStyle = '#f3c63c'; rr(g, -s * 0.9, -s * 0.38, s * 0.85, s * 0.76, s * 0.18); g.fill(); g.fillStyle = '#c9c9cf'; g.fillRect(s * 0.9, -s * 0.16, s * 0.18, s * 0.32); g.restore(); }

/* ---------- darkness / light ---------- */
let darkC = null;
function sparkle(g, x, y, r, a) { g.globalAlpha = a; g.fillStyle = '#fff6c8'; g.beginPath(); g.moveTo(x, y - r); g.lineTo(x + r * 0.25, y - r * 0.25); g.lineTo(x + r, y); g.lineTo(x + r * 0.25, y + r * 0.25); g.lineTo(x, y + r); g.lineTo(x - r * 0.25, y + r * 0.25); g.lineTo(x - r, y); g.lineTo(x - r * 0.25, y - r * 0.25); g.closePath(); g.fill(); g.globalAlpha = 1; }
let fogSpr = null;
function fogSprite() { if (fogSpr) return fogSpr; const c = mk(256, 256), g = c.getContext('2d'), gr = g.createRadialGradient(128, 128, 0, 128, 128, 128); gr.addColorStop(0, 'rgba(190,200,220,1)'); gr.addColorStop(0.5, 'rgba(170,182,205,.45)'); gr.addColorStop(1, 'rgba(160,170,200,0)'); g.fillStyle = gr; g.fillRect(0, 0, 256, 256); return (fogSpr = c); }

/* main world render. o: { cw, ch, dpr, ts, cam:{x,y}, now, me, fx, disp, meta(h)->{name,gm,bubble,me}, pings, demo, shake } */
function render(cv, sim, o) {
  const g = cv.getContext('2d'), m = sim.map, ts = o.ts, dpr = o.dpr, cw = o.cw, ch = o.ch, now = o.now;
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  const sh = o.shake || 0, ox = Math.round(cw / 2 - o.cam.x * ts + (sh ? (Math.random() - 0.5) * sh : 0)), oy = Math.round(ch / 2 - o.cam.y * ts + (sh ? (Math.random() - 0.5) * sh : 0));
  const X = x => ox + x * ts, Y = y => oy + y * ts, vis = (x, y, pad) => X(x) > -pad && X(x) < cw + pad && Y(y) > -pad && Y(y) < ch + pad;
  g.fillStyle = '#05070c'; g.fillRect(0, 0, cw, ch);
  const y0 = Math.floor((-oy) / ts) - 1, y1 = Math.ceil((ch - oy) / ts) + 1;
  for (let ci = Math.max(0, Math.floor(y0 / CH)); ci <= Math.min(Math.floor((m.H - 1) / CH), Math.floor(y1 / CH)); ci++) g.drawImage(ground(m, ci, ts), ox, oy + ci * CH * ts, m.W * ts, CH * ts);
  // props on the ground layer
  m.bat.forEach((b, i) => { if (!sim.bp.includes(i) && vis(b.x, b.y, ts)) drawBattery(g, X(b.x), Y(b.y), ts, now); });
  // depth-sorted: trees, hikers, entities, props
  const items = [], spr = treeSprites(ts), d = o.disp || {};
  for (const t of m.trees) if (t.y > y0 - 1 && t.y < y1 + 2 && vis(t.x, t.y, ts * 2)) items.push([t.y, 0, t]);
  for (const h of sim.hikers) { const p = d[h.id] || h; items.push([p.y, 1, h, p]); }
  for (const e of sim.ents) { const p = d['e' + e.id] || e; if (vis(p.x, p.y, ts * 2)) items.push([p.y + 0.01, 2, e, p]); }
  m.pos.forEach((p, i) => { if (vis(p.x, p.y, ts * 3)) items.push([p.y, 3, p, i]); });
  if (vis(m.camp.x, m.camp.y, ts * 6)) items.push([m.camp.y, 4]);
  if (vis(m.shrine.x, m.shrine.y, ts * 4)) items.push([m.shrine.y, 5]);
  m.rib.forEach(r => { if (vis(r.x, r.y, ts)) items.push([r.y + 0.02, 6, r]); });
  items.sort((a, b) => a[0] - b[0]);
  for (const it of items) {
    const k = it[1];
    if (k === 0) { const t = it[2], sp = spr[t.v], sw = Math.sin(now / 1400 + t.p) * 0.02; g.save(); g.translate(X(t.x), Y(t.y)); g.rotate(sw); g.scale(t.s, t.s); g.drawImage(sp.c, -sp.ox, -sp.oy); g.restore(); }
    else if (k === 1) { const h = it[2], p = it[3]; drawHiker(g, X(p.x), Y(p.y), ts, h, now, { light: sim.lightOn(h) }); }
    else if (k === 2) { const e = it[2], p = it[3], lit = (e.lt > 0.02 || e.fr) ? 1 : 0.9; if (e.k === 'p') drawPocong(g, X(p.x), Y(p.y), ts, e, now, lit); else drawKunti(g, X(p.x), Y(p.y), ts, e, now, lit); }
    else if (k === 3) { const p = it[2]; drawPos(g, p, X(p.x), Y(p.y), ts, sim.lit[it[3]], now, 'POS ' + (it[3] + 1)); }
    else if (k === 4) { const c = m.camp; drawTent(g, X(c.x - 3), Y(c.y - 0.6), ts, '#d9622b'); drawTent(g, X(c.x + 3.1), Y(c.y - 0.2), ts, '#2b78c2'); drawFire(g, X(c.x), Y(c.y + 0.9), ts, now); drawSign(g, X(c.x - 1.6), Y(c.y - 1.6), ts, 'BASECAMP', '#7a4a22'); }
    else if (k === 5) { drawShrine(g, X(m.shrine.x), Y(m.shrine.y), ts, now, sim.wt > 0 || sim.ph === 'win'); drawSign(g, X(m.shrine.x - 2.1), Y(m.shrine.y + 1.4), ts * 0.95, 'PUNCAK', '#6b3d1f'); }
    else if (k === 6) { const r = it[2]; drawRibbon(g, X(r.x), Y(r.y), ts, now, r.s); }
  }
  if (o.fx) o.fx.drawWorld(g, X, Y, ts, 'under');
  /* ----- darkness with light holes (half resolution) ----- */
  const q = 0.5, dw = Math.ceil(cw * q), dh = Math.ceil(ch * q); if (!darkC || darkC.width !== dw || darkC.height !== dh) darkC = mk(dw, dh);
  const dg = darkC.getContext('2d'); dg.globalCompositeOperation = 'source-over'; dg.clearRect(0, 0, dw, dh);
  const fogK = Math.min(1, sim.fog / CFG.fogTime);
  dg.fillStyle = 'rgba(3,6,16,' + (o.demo ? 0.86 : 0.94) + ')'; dg.fillRect(0, 0, dw, dh);
  dg.globalCompositeOperation = 'destination-out';
  const hole = (x, y, r, a) => { const gr = dg.createRadialGradient(x * q, y * q, 0, x * q, y * q, r * q); gr.addColorStop(0, 'rgba(0,0,0,' + a + ')'); gr.addColorStop(0.6, 'rgba(0,0,0,' + a * 0.6 + ')'); gr.addColorStop(1, 'rgba(0,0,0,0)'); dg.fillStyle = gr; dg.fillRect((x - r) * q, (y - r) * q, r * 2 * q, r * 2 * q); };
  const R = CFG.light.range * ts * (1 - fogK * 0.25);
  for (const h of sim.hikers) {
    const p = d[h.id] || h, hx = X(p.x), hy = Y(p.y);
    hole(hx, hy, CFG.amb * ts * (h.dn ? 0.8 : 1), 0.75);
    if (sim.lightOn(h)) {
      const flick = h.bat < 15 ? (Math.random() < 0.12 ? 0.25 : 0.9) : 1;
      dg.save(); dg.translate(hx * q, hy * q); dg.rotate(h.f); const gr = dg.createRadialGradient(0, 0, ts * 0.3 * q, 0, 0, R * q); gr.addColorStop(0, 'rgba(0,0,0,' + flick + ')'); gr.addColorStop(0.65, 'rgba(0,0,0,' + 0.85 * flick + ')'); gr.addColorStop(1, 'rgba(0,0,0,0)'); dg.fillStyle = gr;
      dg.beginPath(); dg.moveTo(0, 0); dg.arc(0, 0, R * q, -CFG.light.half, CFG.light.half); dg.closePath(); dg.fill(); dg.restore();
    }
  }
  for (const L of sim.lamps()) { const f = 0.92 + 0.08 * Math.sin(now / 110 + L.x); hole(X(L.x), Y(L.y - (L.k === 'pos' ? 0.8 : 0)), CFG.lampR * 1.3 * ts * f, 0.95); }
  if (o.pings) for (const pg of o.pings) hole(X(pg.x), Y(pg.y), ts * 1.4, 0.5);
  if (o.fx) o.fx.holes(hole, X, Y, ts);
  g.drawImage(darkC, 0, 0, cw, ch);
  /* warm light tint + lamp glow */
  g.globalCompositeOperation = 'lighter';
  for (const L of sim.lamps()) { const x = X(L.x), y = Y(L.y - (L.k === 'pos' ? 0.8 : 0)), r = CFG.lampR * ts * 1.2, gr = g.createRadialGradient(x, y, 0, x, y, r); const c = L.k === 'shrine' ? '255,240,200' : '255,150,60'; gr.addColorStop(0, 'rgba(' + c + ',.32)'); gr.addColorStop(1, 'rgba(' + c + ',0)'); g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); }
  for (const h of sim.hikers) { if (!sim.lightOn(h)) continue; const p = d[h.id] || h; g.save(); g.translate(X(p.x), Y(p.y)); g.rotate(h.f); const gr = g.createRadialGradient(0, 0, 0, 0, 0, R); gr.addColorStop(0, 'rgba(255,240,190,.16)'); gr.addColorStop(1, 'rgba(255,240,190,0)'); g.fillStyle = gr; g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, R, -CFG.light.half, CFG.light.half); g.closePath(); g.fill(); g.restore(); }
  g.globalCompositeOperation = 'source-over';
  /* things you can sense in the dark: glowing eyes, faint shrouds, battery glints, ribbons in lamp light */
  for (const e of sim.ents) { const p = d['e' + e.id] || e, x = X(p.x), y = Y(p.y); if (!vis(p.x, p.y, ts)) continue;
    if (e.k === 'k') { drawKunti(g, x, y, ts, e, now, 0.22 + 0.08 * Math.sin(now / 90)); const s = ts * 0.6, bob = Math.sin(now / 420 + e.id) * s * 0.12; g.fillStyle = 'rgba(255,40,40,.95)'; ell(g, x - s * 0.03, y - s * 0.5 + bob - s * 0.86, s * 0.035, s * 0.04); g.fill(); ell(g, x + s * 0.035, y - s * 0.5 + bob - s * 0.86, s * 0.035, s * 0.04); g.fill(); }
    else { drawPocong(g, x, y, ts, e, now, 0.16); }
    banishRing(g, x, y - ts * 0.3, ts, e.lt / (e.k === 'p' ? CFG.pocong.banish : CFG.kunti.banish));
  }
  m.bat.forEach((b, i) => { if (sim.bp.includes(i) || !vis(b.x, b.y, ts)) return; sparkle(g, X(b.x) + ts * 0.12, Y(b.y) - ts * 0.25, ts * 0.16 * (0.7 + 0.3 * Math.sin(now / 200 + i)), 0.55); });
  if (o.fx) o.fx.drawWorld(g, X, Y, ts, 'over');
  /* fog banks drifting across the mountain, thicker as the night goes on */
  const fs = fogSprite(), fa = 0.07 + fogK * 0.3; g.globalAlpha = fa;
  for (let i = 0; i < 9; i++) { const sx = ((i * 211 + now * (0.008 + i * 0.0015)) % (cw + 600)) - 300, sy = ((i * 137 - o.cam.y * ts * 0.4) % (ch + 400) + ch + 400) % (ch + 400) - 200, sz = 320 + (i % 3) * 140; g.drawImage(fs, sx - sz / 2, sy - sz / 2, sz, sz * 0.6); }
  g.globalAlpha = 1;
  /* names, bubbles, GM tags */
  g.textAlign = 'center'; g.textBaseline = 'middle';
  const placed = [], lh = ts * 0.46, order = sim.hikers.slice().sort((a, b) => (b.id === o.me) - (a.id === o.me) || ((d[b.id] || b).y - (d[a.id] || a).y));
  for (const h of order) {
    const p = d[h.id] || h, x = X(p.x), mt = o.meta ? o.meta(h) : {}; let y = Y(p.y) - ts * 0.95;
    { const hw = ts * 1.1; for (let k = 0; k < 4 && placed.some(q => Math.abs(q.x - x) < hw && Math.abs(q.y - y) < lh); k++) y -= lh; placed.push({ x, y }); }
    if (mt.name) { g.font = '700 ' + Math.max(10, Math.round(ts * 0.3)) + 'px system-ui,sans-serif'; const label = mt.name + (h.bot ? ' 🤖' : ''), w = g.measureText(label).width + 10 + (mt.gm ? 34 : 0); g.fillStyle = mt.me ? 'rgba(255,214,102,.92)' : 'rgba(10,14,24,.75)'; rr(g, x - w / 2, y - ts * 0.22, w, ts * 0.42, ts * 0.2); g.fill(); g.fillStyle = mt.me ? '#2a1a05' : '#fff'; g.fillText(label, x - (mt.gm ? 17 : 0), y); if (mt.gm) { g.fillStyle = '#ff4d4d'; g.fillText('(GM)', x + w / 2 - 20, y); } }
    if (h.dn) { g.font = '800 ' + Math.round(ts * 0.3) + 'px system-ui,sans-serif'; g.fillStyle = '#e6c2ff'; g.fillText(o.downLabel || 'Kesurupan!', x, y - ts * 0.45); }
    if (mt.bubble) { g.font = '700 ' + Math.max(11, Math.round(ts * 0.32)) + 'px system-ui,sans-serif'; const w = g.measureText(mt.bubble).width + 16, by = y - ts * (h.dn ? 1.05 : 0.7); g.fillStyle = '#fffdf3'; rr(g, x - w / 2, by - ts * 0.27, w, ts * 0.54, ts * 0.24); g.fill(); g.beginPath(); g.moveTo(x - 5, by + ts * 0.25); g.lineTo(x, by + ts * 0.4); g.lineTo(x + 5, by + ts * 0.25); g.fill(); g.fillStyle = '#1c1a17'; g.fillText(mt.bubble, x, by); }
  }
  /* ping markers + screen-edge arrows for teammates / pings / next goal */
  const edge = (wx, wy, col, label) => { const x = X(wx), y = Y(wy), pad = 34; if (x > pad && x < cw - pad && y > pad + 40 && y < ch - pad - 90) return false; const cx = cw / 2, cy = ch / 2, a = Math.atan2(y - cy, x - cx), ex = Math.max(pad, Math.min(cw - pad, x)), ey = Math.max(pad + 50, Math.min(ch - pad - 100, y)); g.save(); g.translate(ex, ey); g.fillStyle = col; g.beginPath(); g.arc(0, 0, 13, 0, TAU); g.fill(); g.rotate(a); g.beginPath(); g.moveTo(20, 0); g.lineTo(11, -7); g.lineTo(11, 7); g.fill(); g.restore(); g.font = '800 11px system-ui,sans-serif'; g.fillStyle = '#111'; g.fillText(label, ex, ey + 0.5); return true; };
  if (o.pings) for (const pg of o.pings) { const x = X(pg.x), y = Y(pg.y), a = 1 - (now - pg.at) / 4500; if (a <= 0) continue; g.strokeStyle = 'rgba(255,214,102,' + a + ')'; g.lineWidth = 3; g.beginPath(); g.arc(x, y, ts * (0.5 + ((now - pg.at) % 900) / 900 * 0.9), 0, TAU); g.stroke(); g.font = '700 ' + Math.round(ts * 0.42) + 'px system-ui'; g.fillText(pg.icon, x, y - ts * 0.9); edge(pg.x, pg.y, 'rgba(255,214,102,.95)', pg.icon); }
  if (!o.demo) {
    for (const h of sim.hikers) { if (h.id === o.me) continue; const p = d[h.id] || h; edge(p.x, p.y, h.dn ? '#d9a6ff' : COLORS[h.c % COLORS.length], h.dn ? '!' : (h.name || '?').slice(0, 1).toUpperCase()); }
    const me = sim.hiker(o.me); if (me && o.goal) edge(o.goal.x, o.goal.y, '#ffd166', '▲');
  }
  /* vignette + fear tint */
  const meH = sim.hiker(o.me), fear = meH ? meH.fear / 100 : 0;
  const vg = g.createRadialGradient(cw / 2, ch / 2, Math.min(cw, ch) * 0.3, cw / 2, ch / 2, Math.max(cw, ch) * 0.75); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, meH && meH.dn ? 'rgba(70,10,90,.75)' : 'rgba(' + Math.round(fear * 120) + ',0,' + Math.round(10 + fear * 10) + ',' + (0.5 + fear * 0.3 * (0.8 + 0.2 * Math.sin(now / (fear > 0.7 ? 140 : 400)))) + ')'); g.fillStyle = vg; g.fillRect(0, 0, cw, ch);
}

/* ---------- particles ---------- */
function makeFx() {
  const P = [], T = [];
  return {
    burst(x, y, cols, n, sp, opt = {}) { for (let i = 0; i < n; i++) { const a = Math.random() * TAU, v = (0.3 + Math.random()) * (sp || 2); P.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - (opt.up || 0), life: 0, max: opt.life || (0.5 + Math.random() * 0.6), c: cols[i % cols.length], r: opt.r || (0.05 + Math.random() * 0.07), glow: !!opt.glow, layer: opt.layer || 'over' }); } },
    text(x, y, s, col) { T.push({ x, y, s, c: col || '#fff', life: 0 }); },
    step(dt) { const s = dt / 1000; for (let i = P.length - 1; i >= 0; i--) { const p = P[i]; p.life += s; p.x += p.vx * s; p.y += p.vy * s; p.vx *= 0.96; p.vy *= 0.96; if (p.life > p.max) P.splice(i, 1); } for (let i = T.length - 1; i >= 0; i--) { T[i].life += s; T[i].y -= s * 0.8; if (T[i].life > 1.6) T.splice(i, 1); } if (P.length > 400) P.splice(0, P.length - 400); },
    drawWorld(g, X, Y, ts, layer) {
      for (const p of P) { if (p.layer !== layer) continue; const a = 1 - p.life / p.max; g.globalAlpha = Math.max(0, a); g.fillStyle = p.c; g.beginPath(); g.arc(X(p.x), Y(p.y), Math.max(1, p.r * ts * (p.glow ? 1 + a : 1)), 0, TAU); g.fill(); }
      g.globalAlpha = 1;
      if (layer === 'over') { g.textAlign = 'center'; g.textBaseline = 'middle'; for (const t of T) { g.globalAlpha = Math.max(0, 1 - t.life / 1.6); g.font = '900 ' + Math.round(ts * 0.42) + 'px system-ui,sans-serif'; g.lineWidth = 4; g.strokeStyle = 'rgba(0,0,0,.6)'; g.strokeText(t.s, X(t.x), Y(t.y)); g.fillStyle = t.c; g.fillText(t.s, X(t.x), Y(t.y)); } g.globalAlpha = 1; }
    },
    holes(hole, X, Y, ts) { for (const p of P) if (p.glow) hole(X(p.x), Y(p.y), ts * 0.5, 0.4 * (1 - p.life / p.max)); }
  };
}

root.MPRender = { render, makeFx, drawHiker, drawPocong, drawKunti, rr, ell, shade };
})(typeof window !== 'undefined' ? window : globalThis);

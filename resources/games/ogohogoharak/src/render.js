/* Ogoh-Ogoh Arak renderer: 2.5D isometric night street (oblique iso camera), depth-sorted props, soft shadows, parallax layers, painted ogoh-ogoh. window.OR */
(function () {
'use strict';
const TAU = Math.PI * 2, clamp = (v, a, b) => v < a ? a : v > b ? b : v, lerp = (a, b, t) => a + (b - a) * t;
const SPEED = 2; // world units per bar
function hx(c) { const n = parseInt(c.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; }
function mix(a, b, t) { const A = hx(a), B = hx(b); return 'rgb(' + A.map((x, i) => Math.round(lerp(x, B[i], t))).join(',') + ')'; }
function hash(k) { let x = Math.imul(k ^ 0x9e3779b9, 0x85ebca6b); x ^= x >>> 13; x = Math.imul(x, 0xc2b2ae35); x ^= x >>> 16; return (x >>> 0) / 4294967296; }
let ctx, W, H, S, AX, AY, CU = 0;
function P(u, v, z) { const du = u - CU; return [AX + (-du + v) * 0.866 * S, AY + ((du + v) * 0.5 - (z || 0)) * S]; }
function poly(pts, fill, stroke, lw) { ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.closePath(); if (fill) { ctx.fillStyle = fill; ctx.fill(); } if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw || 1; ctx.stroke(); } }
function shadow(x, y, rx, ry, a) { const g = ctx.createRadialGradient(x, y, 0, x, y, rx); g.addColorStop(0, 'rgba(8,2,10,' + (a || 0.45) + ')'); g.addColorStop(1, 'rgba(8,2,10,0)'); ctx.save(); ctx.translate(x, y); ctx.scale(1, ry / rx); ctx.translate(-x, -y); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, rx, 0, TAU); ctx.fill(); ctx.restore(); }
// iso box: u0..u1, v0..v1, z0..z1; visible faces: top, +v face, +u face
function box(u0, v0, u1, v1, z0, z1, top, sv, su, line) {
  const L = line || 'rgba(30,10,10,.55)';
  poly([P(u0, v1, z0), P(u1, v1, z0), P(u1, v1, z1), P(u0, v1, z1)], sv, L, 1);
  poly([P(u1, v0, z0), P(u1, v1, z0), P(u1, v1, z1), P(u1, v0, z1)], su, L, 1);
  poly([P(u0, v0, z1), P(u1, v0, z1), P(u1, v1, z1), P(u0, v1, z1)], top, L, 1);
}
function roof(u0, v0, u1, v1, z, h, c1, c2, o) { o = o || 0.25; const a = [u0 - o, v0 - o], b = [u1 + o, v0 - o], c = [u1 + o, v1 + o], d = [u0 - o, v1 + o], m = [(u0 + u1) / 2, (v0 + v1) / 2];
  const ap = P(m[0], m[1], z + h); poly([P(b[0], b[1], z), P(c[0], c[1], z), ap], c2, 'rgba(30,10,10,.6)', 1); poly([P(d[0], d[1], z), P(c[0], c[1], z), ap], c1, 'rgba(30,10,10,.6)', 1); }
/* ---------- characters ---------- */
function person(x, y, sc, o, t) {
  // standing figure, feet at (x,y); o: {shirt, cloth, skin, head (udeng color), arms:'up'|'side'|'cheer', bob}
  const h = 62 * sc, bob = (o.bob || 0) * 3 * sc; shadow(x, y + 1, 15 * sc, 5 * sc, 0.5);
  ctx.save(); ctx.translate(x, y - bob); ctx.lineJoin = 'round'; ctx.lineCap = 'round'; const ol = 'rgba(25,8,6,.8)';
  // legs
  ctx.strokeStyle = o.skin; ctx.lineWidth = 5 * sc; ctx.beginPath(); ctx.moveTo(-4 * sc, -h * 0.34); ctx.lineTo(-5 * sc, -1); ctx.moveTo(4 * sc, -h * 0.34); ctx.lineTo(5 * sc, -1); ctx.stroke();
  // kamen (checkered sarong)
  ctx.beginPath(); ctx.moveTo(-10 * sc, -h * 0.56); ctx.lineTo(10 * sc, -h * 0.56); ctx.lineTo(12 * sc, -h * 0.2); ctx.lineTo(-12 * sc, -h * 0.2); ctx.closePath(); ctx.fillStyle = o.cloth === 'poleng' ? '#f1ece2' : o.cloth; ctx.fill();
  if (o.cloth === 'poleng') { ctx.save(); ctx.clip(); ctx.fillStyle = '#1c1416'; for (let i = -3; i < 3; i++) for (let j = 0; j < 4; j++) if ((i + j) & 1) ctx.fillRect(i * 4.4 * sc, -h * 0.56 + j * 5 * sc, 4.4 * sc, 5 * sc); ctx.restore(); }
  ctx.strokeStyle = ol; ctx.lineWidth = 1.2; ctx.stroke();
  // torso
  const g = ctx.createLinearGradient(-9 * sc, 0, 9 * sc, 0); g.addColorStop(0, o.shirt); g.addColorStop(1, mix(o.shirt.length === 7 ? o.shirt : '#ffffff', '#2a1020', 0.35));
  ctx.beginPath(); ctx.moveTo(-9 * sc, -h * 0.55); ctx.quadraticCurveTo(-10 * sc, -h * 0.82, -6 * sc, -h * 0.84); ctx.lineTo(6 * sc, -h * 0.84); ctx.quadraticCurveTo(10 * sc, -h * 0.82, 9 * sc, -h * 0.55); ctx.closePath(); ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = ol; ctx.stroke();
  // arms
  ctx.strokeStyle = o.skin; ctx.lineWidth = 4 * sc; ctx.beginPath();
  if (o.arms === 'up') { ctx.moveTo(-8 * sc, -h * 0.8); ctx.lineTo(-9 * sc, -h * 1.02); ctx.moveTo(8 * sc, -h * 0.8); ctx.lineTo(9 * sc, -h * 1.02); }
  else if (o.arms === 'cheer') { const w = Math.sin(t * 9 + x) * 3 * sc; ctx.moveTo(-8 * sc, -h * 0.8); ctx.lineTo(-14 * sc, -h * 1.05 + w); ctx.moveTo(8 * sc, -h * 0.8); ctx.lineTo(12 * sc, -h * 0.6); }
  else { ctx.moveTo(-8 * sc, -h * 0.8); ctx.lineTo(-10 * sc, -h * 0.52); ctx.moveTo(8 * sc, -h * 0.8); ctx.lineTo(10 * sc, -h * 0.52); }
  ctx.stroke();
  // head + udeng
  ctx.beginPath(); ctx.ellipse(0, -h * 0.93, 7.5 * sc, 8 * sc, 0, 0, TAU); ctx.fillStyle = o.skin; ctx.fill(); ctx.strokeStyle = ol; ctx.lineWidth = 1.2; ctx.stroke();
  ctx.beginPath(); ctx.ellipse(0, -h * 0.99, 8 * sc, 4.5 * sc, 0, Math.PI, TAU); ctx.fillStyle = o.head; ctx.fill(); ctx.beginPath(); ctx.moveTo(-1 * sc, -h * 1.04); ctx.lineTo(3 * sc, -h * 1.12); ctx.lineTo(5 * sc, -h * 1.03); ctx.fill();
  if (o.phone && Math.sin(t * 3 + x * 0.1) > 0.6) { ctx.fillStyle = 'rgba(255,255,240,.95)'; ctx.fillRect(-15 * sc, -h * 1.08, 3 * sc, 5 * sc); }
  ctx.restore();
}
const CROWD = ['#2f6fb8', '#c0392b', '#f2c14e', '#6d3fa0', '#2e8b57', '#e67e22', '#ffffff', '#1f2a44', '#d65b8a'];
const SKIN = ['#c68a5a', '#a86c43', '#d49a6a', '#8c5634'];
/* ---------- ogoh-ogoh ---------- */
function ogoh(x, y, hgt, d, t, o) {
  o = o || {}; const burn = o.burn || 0, sk = mix(d.skin, '#1b0f0c', burn * 0.92), sk2 = mix(d.skin2, '#0a0505', burn * 0.9), hair = mix(d.hair, '#2a2220', burn * 0.8), gold = mix('#f2b62e', '#3a2a18', burn), ol = '#26090a';
  ctx.save(); ctx.translate(x, y); ctx.rotate(o.rot || 0); ctx.scale(o.sx == null ? 1 : o.sx, o.sy || 1); const k = hgt / 200; ctx.scale(k, k); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  const back = (o.sx || 1) < 0 && false; const sway = Math.sin(t * 2.2) * 3;
  const skinG = (x0, y0, r) => { const g = ctx.createRadialGradient(x0 - r * 0.35, y0 - r * 0.4, r * 0.1, x0, y0, r * 1.1); g.addColorStop(0, mix(d.skin, '#ffffff', 0.25 * (1 - burn))); g.addColorStop(0.55, sk); g.addColorStop(1, sk2); return g; };
  // legs (wide stance, bent)
  ctx.strokeStyle = ol; ctx.lineWidth = 3;
  for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(s * 14, -62); ctx.quadraticCurveTo(s * 34, -38, s * 26, -4); ctx.lineTo(s * 40, -2); ctx.lineTo(s * 38, 4); ctx.lineTo(s * 10, 4); ctx.quadraticCurveTo(s * 16, -30, s * 4, -58); ctx.closePath(); ctx.fillStyle = skinG(s * 22, -30, 30); ctx.fill(); ctx.stroke();
    ctx.fillStyle = gold; ctx.fillRect(s > 0 ? 18 : -32, -16, 14, 5); }
  // poleng / gold cloth skirt
  ctx.beginPath(); ctx.moveTo(-34, -96); ctx.lineTo(34, -96); ctx.lineTo(44, -52); ctx.quadraticCurveTo(0, -44, -44, -52); ctx.closePath();
  ctx.save(); ctx.clip(); if (d.cloth === 'poleng') { ctx.fillStyle = mix('#f3eee4', '#2a2220', burn); ctx.fillRect(-50, -100, 100, 60); ctx.fillStyle = '#17110f'; for (let i = -5; i < 5; i++) for (let j = 0; j < 6; j++) if ((i + j) & 1) ctx.fillRect(i * 10, -100 + j * 10, 10, 10); } else { const g = ctx.createLinearGradient(-40, 0, 40, 0); g.addColorStop(0, mix('#8a1f12', '#1a0c0a', burn)); g.addColorStop(0.5, mix('#c33b1f', '#1a0c0a', burn)); g.addColorStop(1, mix('#6d160c', '#1a0c0a', burn)); ctx.fillStyle = g; ctx.fillRect(-50, -100, 100, 60); ctx.fillStyle = gold; for (let i = -4; i <= 4; i++) { ctx.beginPath(); ctx.arc(i * 10, -60, 3, 0, TAU); ctx.fill(); } }
  ctx.restore(); ctx.strokeStyle = ol; ctx.lineWidth = 3; ctx.stroke(); ctx.fillStyle = gold; ctx.fillRect(-36, -100, 72, 7); ctx.strokeRect(-36, -100, 72, 7);
  // torso + belly
  ctx.beginPath(); ctx.moveTo(-38, -98); ctx.bezierCurveTo(-48, -130, -44, -158, -30, -166); ctx.lineTo(30, -166); ctx.bezierCurveTo(44, -158, 48, -130, 38, -98); ctx.closePath(); ctx.fillStyle = skinG(-6, -132, 46); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.ellipse(0, -118, 26, 18, 0, 0, Math.PI); ctx.strokeStyle = sk2; ctx.lineWidth = 2; ctx.stroke(); ctx.beginPath(); ctx.arc(0, -114, 2.5, 0, TAU); ctx.fillStyle = sk2; ctx.fill();
  ctx.strokeStyle = sk2; ctx.beginPath(); ctx.arc(-14, -146, 10, 0.2, 2.6); ctx.arc(14, -146, 10, 0.5, 2.9); ctx.stroke();
  // necklace
  ctx.strokeStyle = gold; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(0, -168, 22, 0.25 * Math.PI, 0.75 * Math.PI); ctx.stroke();
  // arms: left raised with claw, right out
  ctx.strokeStyle = ol; ctx.lineWidth = 3;
  const arm = (s, ex, ey, hx2, hy) => { ctx.beginPath(); ctx.moveTo(s * 28, -164); ctx.quadraticCurveTo(s * 50, -168, ex, ey); ctx.lineTo(hx2, hy); ctx.lineTo(hx2 - s * 12, hy + 6); ctx.quadraticCurveTo(s * 40, -150 + (ey + 160) * 0.3, s * 30, -140); ctx.closePath(); ctx.fillStyle = skinG(s * 46, -160, 30); ctx.fill(); ctx.stroke();
    ctx.fillStyle = gold; ctx.beginPath(); ctx.arc(ex, ey, 6, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = mix('#f4ead2', '#222', burn); ctx.lineWidth = 3; for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(hx2 + i * s * 3 - s * 4, hy); ctx.lineTo(hx2 + i * s * 4 - s * 2, hy - 12 + i); ctx.stroke(); } ctx.strokeStyle = ol; ctx.lineWidth = 3; };
  arm(-1, -62, -210 + sway, -66, -226 + sway); arm(1, 72, -150 - sway, 84, -160 - sway);
  // hair mane (behind head)
  const hy0 = -200;
  ctx.fillStyle = hair; ctx.strokeStyle = mix(d.hair, '#000000', 0.45); ctx.lineWidth = 2;
  for (let i = 0; i < 22; i++) { const a = -Math.PI * 1.05 + i / 21 * Math.PI * 1.1 + Math.sin(t * 3 + i) * 0.03, r1 = 34, r2 = 70 + (i % 3) * 12 + Math.sin(t * 2 + i * 1.7) * 3; ctx.beginPath(); ctx.moveTo(Math.cos(a - 0.12) * r1, hy0 + Math.sin(a - 0.12) * r1); ctx.lineTo(Math.cos(a) * r2, hy0 + 10 + Math.sin(a) * r2 * 0.9); ctx.lineTo(Math.cos(a + 0.12) * r1, hy0 + Math.sin(a + 0.12) * r1); ctx.closePath(); ctx.fill(); ctx.stroke(); }
  // head
  ctx.beginPath(); ctx.ellipse(0, hy0, 40, 44, 0, 0, TAU); ctx.fillStyle = skinG(-6, hy0 - 6, 44); ctx.fill(); ctx.strokeStyle = ol; ctx.lineWidth = 3; ctx.stroke();
  // crown (gelungan)
  ctx.fillStyle = gold; ctx.beginPath(); ctx.moveTo(-34, hy0 - 26); for (let i = 0; i <= 6; i++) { const xx = -34 + i * 68 / 6; ctx.lineTo(xx - 5.6, hy0 - 30); ctx.lineTo(xx, hy0 - 52 - (i === 3 ? 16 : i % 2 ? 4 : 8)); ctx.lineTo(xx + 5.6, hy0 - 30); } ctx.lineTo(34, hy0 - 26); ctx.quadraticCurveTo(0, hy0 - 34, -34, hy0 - 26); ctx.fill(); ctx.stroke();
  ctx.fillStyle = mix('#d6283a', '#200', burn); ctx.beginPath(); ctx.arc(0, hy0 - 44, 5, 0, TAU); ctx.fill();
  // brows, eyes
  ctx.fillStyle = mix('#1c0f0c', '#000', burn); ctx.beginPath(); ctx.moveTo(-34, hy0 - 16); ctx.quadraticCurveTo(-18, hy0 - 30, -4, hy0 - 14); ctx.lineTo(-8, hy0 - 10); ctx.quadraticCurveTo(-20, hy0 - 20, -32, hy0 - 10); ctx.fill(); ctx.beginPath(); ctx.moveTo(34, hy0 - 16); ctx.quadraticCurveTo(18, hy0 - 30, 4, hy0 - 14); ctx.lineTo(8, hy0 - 10); ctx.quadraticCurveTo(20, hy0 - 20, 32, hy0 - 10); ctx.fill();
  const look = Math.sin(t * 0.9) * 3;
  for (const s of [-1, 1]) { ctx.beginPath(); ctx.arc(s * 17, hy0 - 2, 12, 0, TAU); ctx.fillStyle = mix('#fffbe8', '#4a3a30', burn); ctx.fill(); ctx.strokeStyle = '#b01e1e'; ctx.lineWidth = 2.5; ctx.stroke(); ctx.beginPath(); ctx.arc(s * 17 + look, hy0 - 1, 6, 0, TAU); ctx.fillStyle = mix(d.eye, '#3a1a10', burn); ctx.fill(); ctx.beginPath(); ctx.arc(s * 17 + look, hy0 - 1, 2.6, 0, TAU); ctx.fillStyle = '#120808'; ctx.fill(); }
  // nose
  ctx.beginPath(); ctx.ellipse(0, hy0 + 14, 12, 8, 0, 0, TAU); ctx.fillStyle = skinG(0, hy0 + 12, 12); ctx.fill(); ctx.strokeStyle = ol; ctx.lineWidth = 2; ctx.stroke(); ctx.fillStyle = sk2; ctx.beginPath(); ctx.arc(-5, hy0 + 17, 2.5, 0, TAU); ctx.arc(5, hy0 + 17, 2.5, 0, TAU); ctx.fill();
  // mouth, tongue, fangs
  ctx.beginPath(); ctx.moveTo(-26, hy0 + 24); ctx.quadraticCurveTo(0, hy0 + 52, 26, hy0 + 24); ctx.quadraticCurveTo(0, hy0 + 32, -26, hy0 + 24); ctx.fillStyle = '#3a0808'; ctx.fill(); ctx.strokeStyle = ol; ctx.stroke();
  const tg = Math.sin(t * 1.7) * 2; ctx.beginPath(); ctx.moveTo(-9, hy0 + 34); ctx.quadraticCurveTo(-12 + tg, hy0 + 70, 0 + tg, hy0 + 82); ctx.quadraticCurveTo(12 + tg, hy0 + 70, 9, hy0 + 34); ctx.fillStyle = mix('#e0364a', '#2a0a0a', burn); ctx.fill(); ctx.stroke();
  ctx.fillStyle = mix('#fff8e4', '#3a3028', burn); for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(s * 20, hy0 + 26); ctx.quadraticCurveTo(s * 24, hy0 + 44, s * 14, hy0 + 52); ctx.lineTo(s * 13, hy0 + 30); ctx.fill(); ctx.stroke(); ctx.beginPath(); ctx.moveTo(s * 8, hy0 + 31); ctx.lineTo(s * 6, hy0 + 40); ctx.lineTo(s * 3, hy0 + 32); ctx.fill(); }
  // ears + earrings
  for (const s of [-1, 1]) { ctx.beginPath(); ctx.ellipse(s * 42, hy0 + 2, 7, 13, s * 0.3, 0, TAU); ctx.fillStyle = sk; ctx.fill(); ctx.strokeStyle = ol; ctx.stroke(); ctx.beginPath(); ctx.arc(s * 44, hy0 + 18, 6, 0, TAU); ctx.fillStyle = gold; ctx.fill(); }
  ctx.restore();
}
/* ---------- scene pieces ---------- */
function penjor(u, vb, t) { const b = P(u, vb, 0), c = P(u, vb * 1.05, 5.4), tip = P(u, vb * (vb > 0 ? 0.62 : 0.3), 4.7); const sw = Math.sin(t * 1.3 + u) * 4;
  shadow(b[0], b[1], 10, 4, 0.5); ctx.strokeStyle = '#6b4a1c'; ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(b[0], b[1]); ctx.quadraticCurveTo(c[0], c[1], tip[0] + sw, tip[1]); ctx.stroke();
  ctx.strokeStyle = '#d7b45a'; ctx.lineWidth = 2; ctx.stroke();
  for (let i = 1; i < 6; i++) { const q = i / 6, x = (1 - q) * (1 - q) * b[0] + 2 * (1 - q) * q * c[0] + q * q * (tip[0] + sw), y = (1 - q) * (1 - q) * b[1] + 2 * (1 - q) * q * c[1] + q * q * tip[1]; ctx.fillStyle = i % 2 ? '#f6e7a8' : '#e7b941'; ctx.beginPath(); ctx.ellipse(x, y, 5, 3, 0, 0, TAU); ctx.fill(); }
  ctx.fillStyle = '#f1dc8c'; ctx.beginPath(); ctx.moveTo(tip[0] + sw - 4, tip[1]); for (let i = 0; i < 6; i++) ctx.lineTo(tip[0] + sw + (i % 2 ? 6 : -6) + Math.sin(t * 2 + i) * 2, tip[1] + 6 + i * 7); ctx.lineTo(tip[0] + sw + 4, tip[1]); ctx.fill();
  ctx.fillStyle = '#c2852b'; ctx.beginPath(); ctx.arc(tip[0] + sw, tip[1], 5, 0, TAU); ctx.fill(); }
const glows = [];
function obor(u, v, t) { const b = P(u, v, 0), top = P(u, v, 2.1); shadow(b[0], b[1], 7, 3, 0.4); ctx.strokeStyle = '#7a5523'; ctx.lineWidth = 3.5; ctx.beginPath(); ctx.moveTo(b[0], b[1]); ctx.lineTo(top[0], top[1]); ctx.stroke();
  const f = 1 + Math.sin(t * 17 + u * 3) * 0.15; ctx.fillStyle = '#ff9a2c'; ctx.beginPath(); ctx.ellipse(top[0], top[1] - 6 * f, 5, 10 * f, 0, 0, TAU); ctx.fill(); ctx.fillStyle = '#ffe27a'; ctx.beginPath(); ctx.ellipse(top[0], top[1] - 4 * f, 2.5, 5 * f, 0, 0, TAU); ctx.fill(); glows.push([top[0], top[1] - 6, 60 * f]); }
function house(u, v0, kind, k) { const w = 1.15; const c = kind === 0 ? ['#d9c3a0', '#b49470', '#8d6c4f'] : ['#c9764f', '#a35a3a', '#7d4129'];
  box(u - w, v0 - 1.8, u + w, v0, 0, 1.3, c[0], c[1], c[2]);
  const dP = P(u, v0, 0); ctx.fillStyle = 'rgba(40,18,10,.85)'; const d2 = P(u + 0.3, v0, 0), d3 = P(u + 0.3, v0, 0.9), d4 = P(u - 0.3, v0, 0.9); poly([P(u - 0.3, v0, 0), d2, d3, d4], '#3a1c10');
  const win = P(u + 0.75, v0, 0.75); ctx.fillStyle = hash(k * 7) > 0.4 ? 'rgba(255,200,110,.85)' : 'rgba(60,40,40,.8)'; ctx.fillRect(win[0] - 5, win[1] - 6, 9, 7); if (hash(k * 7) > 0.4) glows.push([win[0], win[1], 34]);
  roof(u - w, v0 - 1.8, u + w, v0, 1.3, 1.25, kind === 0 ? '#6e5a3a' : '#8e2f22', kind === 0 ? '#54442a' : '#6a2016', 0.3); }
function gate(u, v0) { // angkul-angkul: brick gate with stepped roof
  box(u - 0.55, v0 - 0.5, u - 0.2, v0, 0, 2.0, '#d5c2a2', '#b5543a', '#8f3e2a'); box(u + 0.2, v0 - 0.5, u + 0.55, v0, 0, 2.0, '#d5c2a2', '#b5543a', '#8f3e2a');
  box(u - 0.7, v0 - 0.6, u + 0.7, v0 + 0.1, 2.0, 2.35, '#e3d2b1', '#c06045', '#984630'); box(u - 0.5, v0 - 0.45, u + 0.5, v0 - 0.05, 2.35, 2.65, '#e3d2b1', '#c06045', '#984630');
  roof(u - 0.4, v0 - 0.4, u + 0.4, v0 - 0.1, 2.65, 0.6, '#5a3020', '#40200f', 0.12); }
function meru(u, v0) { box(u - 0.7, v0 - 1.4, u + 0.7, v0, 0, 0.8, '#ccb998', '#a68a68', '#7f6649'); for (let i = 0; i < 4; i++) { const s = 1.2 - i * 0.22, z = 0.8 + i * 0.62; roof(u - s * 0.6, v0 - 0.7 - s * 0.6, u + s * 0.6, v0 - 0.7 + s * 0.6, z, 0.5, '#3a2a22', '#2a1c16', 0.15); } }
function tree(u, v, k, t) { const b = P(u, v, 0), top = P(u, v, 2.6); shadow(b[0], b[1], 26, 9, 0.4); ctx.strokeStyle = '#4b3424'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(b[0], b[1]); ctx.lineTo(top[0], top[1]); ctx.stroke();
  const cols = ['#24402e', '#2f5639', '#3c6b43']; for (let i = 0; i < 5; i++) { const a = i / 5 * TAU + k; ctx.fillStyle = cols[i % 3]; ctx.beginPath(); ctx.arc(top[0] + Math.cos(a) * 16, top[1] + Math.sin(a) * 9 - 6, 19, 0, TAU); ctx.fill(); }
  if (hash(k * 3) > 0.5) { ctx.fillStyle = '#fff4dc'; for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.arc(top[0] + (hash(k + i) - 0.5) * 44, top[1] - 6 + (hash(k * 2 + i) - 0.5) * 24, 2.2, 0, TAU); ctx.fill(); } } }
/* ---------- float ---------- */
function floatGroup(list, st, t) {
  const U = CU, th = st.spinA || 0, cs = Math.cos(th), sn = Math.sin(th), drop = st.drop || 0;
  const W2 = (a, b) => [U + a * cs - b * sn, a * sn + b * cs];
  const tiltZ = (a, b) => 1.05 + (st.bob || 0) * 0.08 - drop * (0.55 + b * 0.35) + (st.wobT || 0) * a * 0.05;
  const crew = st.crew || [];
  const slots = [[-1.35, -0.78], [-0.45, -0.78], [0.45, -0.78], [1.35, -0.78], [-1.35, 0.78], [-0.45, 0.78], [0.45, 0.78], [1.35, 0.78]];
  const order = [5, 1, 6, 2, 4, 0, 7, 3];
  order.forEach((si, i) => { const s = slots[si], wp = W2(s[0], s[1]), c = crew[i]; const off = st.away ? st.away * 2.2 * Math.sign(s[1]) : 0; const wq = W2(s[0] * (1 + (st.away || 0) * 0.6), s[1] + off);
    list.push({ d: (wq[0] - U) + wq[1], f: () => { const p = P(wq[0], wq[1], 0); person(p[0], p[1], 0.82 * S / 46, { shirt: c ? (c.me ? '#ffe08a' : c.bot ? '#d8d2c6' : '#ffffff') : '#cfc6b8', cloth: 'poleng', skin: SKIN[si % 4], head: c && c.me ? '#e8452c' : '#f2efe8', arms: st.away ? 'cheer' : 'up', bob: st.bob || 0 }, t);
      if (c && c.n && !st.away) { ctx.font = '800 ' + Math.round(11 * S / 46) + 'px system-ui,sans-serif'; ctx.textAlign = 'center'; const tw = ctx.measureText(c.n).width + 10, ly = p[1] + 14 * S / 46; ctx.fillStyle = c.me ? 'rgba(232,69,44,.9)' : 'rgba(20,10,24,.72)'; ctx.fillRect(p[0] - tw / 2, ly - 10, tw, 14); ctx.fillStyle = '#fff'; ctx.fillText(c.n, p[0], ly + 1); if (c.acc != null) { ctx.fillStyle = c.acc >= 0.8 ? '#35d07f' : c.acc >= 0.5 ? '#ffc93c' : '#ff4d4d'; ctx.fillRect(p[0] - tw / 2, ly + 4, tw * clamp(c.acc, 0.05, 1), 2.5); } } } }); });
  if (st.away) { list.push({ d: 0, f: () => platform() }); } else list.push({ d: 0, f: () => platform() });
  function platform() {
    const sh = P(U, 0, 0); shadow(sh[0], sh[1] + 4, 2.1 * S, 0.9 * S, 0.55);
    if (st.away) { const p0 = P(U, 0, 0); // pyre logs
      ctx.strokeStyle = '#4a2c14'; ctx.lineWidth = 7; for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.moveTo(p0[0] - 40 + i * 8, p0[1] + 4); ctx.lineTo(p0[0] + 20 - i * 12, p0[1] - 12); ctx.stroke(); } }
    else {
      const pole = (b) => { const a1 = W2(-1.75, b), a2 = W2(1.75, b); const p1 = P(a1[0], a1[1], tiltZ(-1.75, b)), p2 = P(a2[0], a2[1], tiltZ(1.75, b)); ctx.strokeStyle = '#6a4a1c'; ctx.lineWidth = 6 * S / 46; ctx.beginPath(); ctx.moveTo(p1[0], p1[1]); ctx.lineTo(p2[0], p2[1]); ctx.stroke(); ctx.strokeStyle = '#d6b264'; ctx.lineWidth = 2.5 * S / 46; ctx.stroke(); };
      pole(-0.78);
      const cr = [[-0.95, -0.7], [0.95, -0.7], [0.95, 0.7], [-0.95, 0.7]].map(q => { const w = W2(q[0], q[1]); return P(w[0], w[1], tiltZ(q[0], q[1]) + 0.12); });
      const crL = cr.map(p => [p[0], p[1] + 7 * S / 46]); poly(crL, '#6e4a1e'); poly(cr, '#c99a4e', '#5a3a14', 1.5);
      ctx.strokeStyle = 'rgba(90,58,20,.7)'; ctx.lineWidth = 1; for (let i = 1; i < 6; i++) { const q = i / 6; ctx.beginPath(); ctx.moveTo(lerp(cr[0][0], cr[3][0], q), lerp(cr[0][1], cr[3][1], q)); ctx.lineTo(lerp(cr[1][0], cr[2][0], q), lerp(cr[1][1], cr[2][1], q)); ctx.stroke(); }
      // fringe of cloth (kain prada) hanging
      ctx.fillStyle = 'rgba(222,170,40,.9)'; for (let i = 0; i < 2; i++) { const a = cr[i + 2], b = cr[(i + 3) % 4]; poly([a, b, [b[0], b[1] + 9 * S / 46], [a[0], a[1] + 9 * S / 46]], i ? '#c23a22' : '#e2a72b'); }
      pole(0.78);
    }
    // the ogoh-ogoh itself
    const base = P(U, 0, st.away ? 0.25 : tiltZ(0, 0) + 0.12), ds = st.design;
    const rot = (st.wobA || 0) + drop * 1.15 * (st.dropDir || 1) + (st.fall || 0);
    const sx = Math.cos(th) * (Math.abs(Math.cos(th)) < 0.08 ? 0 : 1) || 0.08;
    ogoh(base[0], base[1], 3.5 * S * (st.collapse ? 1 - st.collapse * 0.25 : 1), ds, t, { rot, sx: clamp(Math.abs(sx), 0.12, 1) * Math.sign(sx || 1), sy: st.collapse ? 1 - st.collapse * 0.6 : 1, burn: st.burn || 0 });
  }
}
/* ---------- main scene ---------- */
let sky = null;
function skyLayer() { if (sky && sky.width === W && sky.height === H) return sky; sky = document.createElement('canvas'); sky.width = W; sky.height = Math.round(H * 0.3); const c = sky.getContext('2d'); const g = c.createLinearGradient(0, 0, 0, sky.height); g.addColorStop(0, '#0b0820'); g.addColorStop(0.7, '#2b1640'); g.addColorStop(1, 'rgba(60,24,50,0)'); c.fillStyle = g; c.fillRect(0, 0, W, sky.height);
  for (let i = 0; i < 70; i++) { c.fillStyle = 'rgba(255,245,220,' + (0.3 + hash(i) * 0.6) + ')'; c.fillRect(hash(i * 3) * W, hash(i * 5) * sky.height * 0.7, 1.4, 1.4); }
  const mx = W * 0.8, my = sky.height * 0.25; const mg = c.createRadialGradient(mx, my, 4, mx, my, 50); mg.addColorStop(0, 'rgba(255,240,200,.5)'); mg.addColorStop(1, 'rgba(255,240,200,0)'); c.fillStyle = mg; c.fillRect(mx - 50, my - 50, 100, 100); c.fillStyle = '#fff1cc'; c.beginPath(); c.arc(mx, my, 13, 0, TAU); c.fill(); c.fillStyle = '#2b1640'; c.beginPath(); c.arc(mx + 5, my - 3, 11, 0, TAU); c.fill();
  return sky; }
function scene(c, w, h, st, now) {
  ctx = c; W = w; H = h; const t = now / 1000; S = Math.max(30, Math.min(w / 8.4, h / 14)); AX = w * 0.56; AY = h * (st.ay || 0.56) + Math.max(0, h * 0.04 - (w / h > 0.7 ? 0 : 99)); CU = st.u || 0; glows.length = 0;
  const types = st.types || [], uEnd = types.length ? types.length * SPEED : 1e9, corners = []; types.forEach((ty, i) => { if (ty === 'L' || ty === 'R') corners.push(i * SPEED + SPEED / 2); });
  const nearCorner = u => corners.some(cu => Math.abs(u - cu) < 2.3), field = u => u > uEnd - 1.5;
  // ground
  const gg = c.createRadialGradient(AX, AY, 20, AX, AY, Math.max(w, h) * 0.8); gg.addColorStop(0, '#4a3328'); gg.addColorStop(1, '#1d1218'); c.fillStyle = gg; c.fillRect(0, 0, w, h);
  // sky + far parallax silhouettes (moves slower than the street)
  c.drawImage(skyLayer(), 0, 0); const px = -(CU * S * 0.3) % (w * 1.5);
  c.fillStyle = '#1e1230'; c.beginPath(); c.moveTo(0, h * 0.2); for (let i = 0; i <= 12; i++) { const x = i / 12 * w; c.lineTo(x, h * 0.2 - Math.max(0, 50 - Math.abs(x - w * 0.3) * 0.35) - Math.sin(i * 1.7) * 4); } c.lineTo(w, h * 0.3); c.lineTo(0, h * 0.3); c.fill();
  c.fillStyle = '#170d24'; for (let i = -1; i < 9; i++) { const x = ((i * 90 + px) % (w * 1.5) + w * 1.5) % (w * 1.5) - 60, y = h * 0.26; if (i % 3 === 0) { for (let k = 0; k < 4; k++) { const s = 26 - k * 5; c.beginPath(); c.moveTo(x - s, y - k * 12); c.lineTo(x, y - k * 12 - 14); c.lineTo(x + s, y - k * 12); c.fill(); } } else { c.fillRect(x - 1.5, y - 52, 3, 52); for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI + Math.PI; c.beginPath(); c.ellipse(x + Math.cos(a) * 12, y - 52 + Math.sin(a) * 5 + 6, 14, 3, a, 0, TAU); c.fill(); } } }
  // street ground
  const R = 1.6, SW = 2.35, u0 = CU - 18, u1 = CU + 18;
  poly([P(u0, -7, 0), P(u1, -7, 0), P(u1, 7, 0), P(u0, 7, 0)], '#3b2a22');
  poly([P(u0, -SW, 0), P(u1, -SW, 0), P(u1, SW, 0), P(u0, SW, 0)], '#8b7a66');
  poly([P(u0, -R, 0), P(u1, -R, 0), P(u1, R, 0), P(u0, R, 0)], '#3d3a40');
  for (const cu of corners) if (Math.abs(cu - CU) < 22) { poly([P(cu - SW, -12, 0), P(cu + SW, -12, 0), P(cu + SW, 12, 0), P(cu - SW, 12, 0)], '#8b7a66'); poly([P(cu - R, -12, 0), P(cu + R, -12, 0), P(cu + R, 12, 0), P(cu - R, 12, 0)], '#3d3a40'); const m = P(cu, 0, 0); c.strokeStyle = 'rgba(255,230,160,.35)'; c.lineWidth = 2; c.setLineDash([6, 6]); c.beginPath(); c.ellipse(m[0], m[1], 1.2 * S * 0.866 * 1.4, 1.2 * S * 0.5 * 1.4, 0, 0, TAU); c.stroke(); c.setLineDash([]); }
  c.strokeStyle = 'rgba(255,255,255,.06)'; c.lineWidth = 1; for (let u = Math.floor(u0); u < u1; u++) { const a = P(u, -SW, 0), b = P(u, SW, 0); c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.stroke(); }
  c.strokeStyle = 'rgba(255,240,200,.28)'; c.lineWidth = 2; for (let u = Math.floor(u0); u < u1; u += 1) { if (nearCorner(u)) continue; const a = P(u, 0, 0), b = P(u + 0.45, 0, 0); c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.stroke(); }
  if (uEnd - CU < 24) { poly([P(uEnd - 1.5, -9, 0), P(uEnd + 30, -9, 0), P(uEnd + 30, 9, 0), P(uEnd - 1.5, 9, 0)], '#2f4a2a'); for (let i = 0; i < 60; i++) { const p = P(uEnd + hash(i) * 14 - 1, (hash(i * 7) - 0.5) * 14, 0); c.fillStyle = 'rgba(90,140,70,.35)'; c.fillRect(p[0], p[1], 2, 4); } }
  // props, depth-sorted
  const list = []; const add = (u, v, f) => list.push({ d: (u - CU) + v, f });
  for (let k = Math.floor(u0 / 3); k < u1 / 3; k++) { const u = k * 3 + 1.5; if (field(u + 1.5)) continue; const r = hash(k + 101);
    if (!nearCorner(u)) { if (r < 0.18) add(u, -3.2, () => gate(u, -2.6)); else if (r < 0.3) add(u, -4.2, () => meru(u, -3)); else add(u, -4.2, () => house(u, -2.9, r < 0.65 ? 0 : 1, k));
      add(u - 1.1, -6, () => tree(u - 1.1, -6, k, t)); }
    if (!nearCorner(u) && r > 0.18) add(u, -2.65, () => box(u - 1.5, -2.72, u + 1.5, -2.55, 0, 0.75, '#e0cfac', '#b85a3e', '#934530'));
    for (const side of [-1, 1]) for (let j = 0; j < 3; j++) { const uu = k * 3 + j + hash(k * 13 + j + side) * 0.6, vv = side * (1.95 + hash(k * 9 + j) * 0.35); if (nearCorner(uu) || field(uu)) continue; if (hash(k * 31 + j * 7 + side) < 0.25) continue;
      const q = hash(k * 17 + j * 3 + side * 5); add(uu, vv, () => { const p = P(uu, vv, 0); person(p[0], p[1], 0.7 * S / 46, { shirt: CROWD[Math.floor(q * 9)], cloth: q > 0.5 ? 'poleng' : '#3a2b4a', skin: SKIN[Math.floor(q * 40) % 4], head: q > 0.6 ? '#f2efe8' : '#1b1418', arms: st.hening ? 'side' : (q > 0.3 ? 'cheer' : 'side'), phone: q < 0.35, bob: st.hening ? 0 : (Math.sin(t * 7 + uu * 2) > 0 ? 0.6 : 0) }, t); }); }
    if (k % 2 === 0) for (const side of [-1, 1]) { const uu = k * 3 + (side > 0 ? 0.8 : 2.2), vv = side * 1.85; if (!nearCorner(uu) && !field(uu)) add(uu, vv, () => penjor(uu, vv, t)); }
    for (const side of [-1, 1]) { const uu = k * 3 + (side > 0 ? 2.1 : 0.4), vv = side * 1.7; if (!nearCorner(uu)) add(uu, vv, () => obor(uu, vv, t)); }
    if (Math.abs(u + 0.5 - CU) > 3.5) add(u + 0.5, 4.8, () => tree(u + 0.5, 5.2, k + 50, t));
  }
  if (st.showFloat !== false) floatGroup(list, st, t);
  list.sort((a, b) => a.d - b.d); for (const it of list) it.f();
  // fire
  if (st.fire) fire(st.fire, t);
  // torch glow (additive)
  c.save(); c.globalCompositeOperation = 'lighter'; for (const [x, y, r] of glows) { if (x < -r || x > w + r || y < -r || y > h + r) continue; const g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, 'rgba(255,150,60,.28)'); g.addColorStop(1, 'rgba(255,120,40,0)'); c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2); } c.restore();
  // near foreground parallax (faster than the street): hanging lamak / leaves at bottom-right
  const fx = ((-CU * S * 1.25) % 260 + 260) % 260; c.fillStyle = 'rgba(10,6,8,.75)'; for (let i = -1; i < 4; i++) { const x = w - 40 + ((i * 260 + fx) % (w + 260)) - w * 0.2; c.beginPath(); c.ellipse(x, h + 10, 70, 34, -0.4, 0, TAU); c.fill(); }
  if (st.hening) { c.fillStyle = 'rgba(20,30,70,' + 0.28 * st.hening + ')'; c.fillRect(0, 0, w, h); }
  const v = c.createRadialGradient(w / 2, h * 0.55, Math.min(w, h) * 0.35, w / 2, h * 0.55, Math.max(w, h) * 0.75); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(6,2,10,.6)'); c.fillStyle = v; c.fillRect(0, 0, w, h);
}
function fire(f, t) { const p = P(CU, 0, 0), hgt = 3.8 * S * clamp(f * 1.4, 0, 1.1); ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 46; i++) { const ph = (t * 0.9 + hash(i)) % 1, x = p[0] + (hash(i * 3) - 0.5) * 2.4 * S * (1 - ph * 0.6) + Math.sin(t * 5 + i) * 6, y = p[1] - ph * hgt, r = (1 - ph) * (18 + hash(i * 5) * 22) * S / 46 * (0.4 + f);
    const g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, 'rgba(255,230,140,.55)'); g.addColorStop(0.5, 'rgba(255,120,30,.35)'); g.addColorStop(1, 'rgba(200,40,10,0)'); ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2); }
  for (let i = 0; i < 30; i++) { const ph = (t * 0.35 + hash(i * 11)) % 1; ctx.fillStyle = 'rgba(255,200,90,' + (1 - ph) + ')'; ctx.fillRect(p[0] + (hash(i * 13) - 0.5) * 4 * S + Math.sin(t * 2 + i) * 20, p[1] - ph * 6 * S, 2.5, 2.5); }
  const g = ctx.createRadialGradient(p[0], p[1] - hgt * 0.4, 0, p[0], p[1] - hgt * 0.4, Math.max(W, H) * 0.6); g.addColorStop(0, 'rgba(255,120,40,' + 0.25 * f + ')'); g.addColorStop(1, 'rgba(255,80,20,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); ctx.restore(); }
/* ---------- beat cue overlay ---------- */
function cue(c, w, h, q, now) {
  // q: {ph, type, next, hits[4], beat, jt, jc, jAge, count, rel, types, BEAT}. t390u: note highway shows what is coming, side glow + 3-2-1 before every change
  ctx = c; const cx = w / 2, cy = h - Math.min(150, h * 0.2), R0 = Math.min(42, w * 0.105), BT = q.BEAT || 600, rel = q.rel || 0;
  const turn = q.type === 'L' || q.type === 'R', hen = q.type === 'h', nx = q.next, nTurn = nx === 'L' || nx === 'R', change = nx && nx !== q.type && !(nx === 'f' && q.type === 'j');
  const lastBeats = change && !q.count && q.beat >= 1, cd = 4 - q.beat; // 3,2,1 over the last three beats
  const pulse = Math.pow(1 - q.ph, 2);
  // side glow: where to tap (current turn bright, upcoming turn blinking)
  const side = (dir, a) => { const g = c.createLinearGradient(dir < 0 ? 0 : w, 0, dir < 0 ? w * 0.42 : w * 0.58, 0); g.addColorStop(0, 'rgba(255,201,60,' + a.toFixed(3) + ')'); g.addColorStop(1, 'rgba(255,201,60,0)'); c.fillStyle = g; c.fillRect(dir < 0 ? 0 : w * 0.5, 0, w * 0.5, h);
    c.save(); c.globalAlpha = Math.min(1, a * 2.4); c.fillStyle = '#ffe08a'; c.font = '900 ' + Math.round(Math.min(64, w * 0.15)) + 'px system-ui,sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(dir < 0 ? '⟲' : '⟳', dir < 0 ? w * 0.12 : w * 0.88, h * 0.52); c.restore(); };
  if (turn && !q.count) side(q.type === 'L' ? -1 : 1, 0.16 + pulse * 0.22);
  if (lastBeats && nTurn) side(nx === 'L' ? -1 : 1, (q.beat >= 2 ? 0.1 : 0.05) + pulse * 0.16);
  if (hen && !q.count) { c.fillStyle = 'rgba(40,80,140,.16)'; c.fillRect(0, 0, w, h); }
  // rings (cross-fade to the next type during the last beat)
  const miss = q.jt && q.jAge < 260 && /MELESET|SALAH|SAMPING|SSST/.test(q.jt), shakeX = miss ? Math.sin(q.jAge / 18) * 7 * (1 - q.jAge / 260) : 0;
  const ring = (x, y, act, label, col, al, sc) => { c.save(); c.globalAlpha = (act ? 1 : 0.45) * (al == null ? 1 : al); const r = R0 * (sc || 1) * (act ? 1 + pulse * 0.06 : 1); c.fillStyle = 'rgba(20,10,24,.8)'; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); c.lineWidth = 5; c.strokeStyle = col; c.stroke(); c.fillStyle = '#fff'; c.font = '900 ' + Math.round(r * 0.62) + 'px system-ui,sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(label, x, y + 2);
    if (act && !q.count) { const rr = r + (1 - q.ph) * r * 1.6; c.globalAlpha = (0.25 + q.ph * 0.75) * (al == null ? 1 : al); c.lineWidth = 4; c.strokeStyle = '#fff'; c.beginPath(); c.arc(x, y, rr, 0, TAU); c.stroke(); }
    if (act && q.jt && q.jAge < 320 && !miss) { const e = q.jAge / 320; c.globalAlpha = 1 - e; c.lineWidth = 7 * (1 - e) + 1; c.strokeStyle = q.jc || '#fff'; c.beginPath(); c.arc(x, y, r * (1 + e * 0.9), 0, TAU); c.stroke(); }
    c.restore(); };
  const drawSet = (ty, al, sc) => { const tr = ty === 'L' || ty === 'R';
    if (tr) { ring(cx - w * 0.27 + shakeX, cy, ty === 'L', '⟲', ty === 'L' ? '#ffc93c' : '#666', al, sc); ring(cx + w * 0.27 + shakeX, cy, ty === 'R', '⟳', ty === 'R' ? '#ffc93c' : '#666', al, sc); }
    else if (ty === 'h') ring(cx + shakeX, cy, false, '🤫', '#8fd3ff', al, sc); else ring(cx + shakeX, cy, true, '🥁', '#e8452c', al, sc); };
  const mix = change && q.beat === 3 ? Math.min(1, q.ph * 1.3) : 0;
  drawSet(q.type, 1 - mix * 0.85); if (mix > 0) drawSet(nx === 'f' ? 'j' : nx, mix, 0.7 + mix * 0.3);
  // note highway: every beat as a note sliding to the hit line, coloured by its bar type
  const HY = cy - R0 - 34, HX = Math.max(46, w * 0.2), SP = Math.min(70, w * 0.17), types = q.types || [];
  c.save(); c.fillStyle = 'rgba(20,10,24,.62)'; c.beginPath(); if (c.roundRect) c.roundRect(10, HY - 19, w - 20, 38, 19); else c.rect(10, HY - 19, w - 20, 38); c.fill();
  c.beginPath(); c.rect(12, HY - 19, w - 24, 38); c.clip();
  const b0 = Math.floor(rel / BT) - 1, n0 = Math.floor(rel / BT);
  for (let b = b0; b < b0 + 12; b++) { if (b < 0) continue; const bar = Math.floor(b / 4), ty = types[bar]; if (!ty) break; const x = HX + (b * BT - rel) / BT * SP; if (x > w + 20) break;
    if (b % 4 === 0) { const pv = types[bar - 1]; c.strokeStyle = 'rgba(255,255,255,.25)'; c.lineWidth = 2; c.beginPath(); c.moveTo(x - SP * 0.5, HY - 17); c.lineTo(x - SP * 0.5, HY + 17); c.stroke();
      if (ty !== pv && bar > 0 && x > HX - 10) { const lab = ty === 'L' ? '⟲ KIRI' : ty === 'R' ? '⟳ KANAN' : ty === 'h' ? '🤫 HENING' : ty === 'f' ? '🔥 FINIS' : '🥁 JALAN'; c.font = '900 11px system-ui,sans-serif'; c.textAlign = 'left'; c.textBaseline = 'middle'; c.fillStyle = ty === 'h' ? '#8fd3ff' : ty === 'j' || ty === 'f' ? '#ffb4a6' : '#ffc93c'; c.fillText(lab, x - SP * 0.5 + 4, HY - 11); } }
    const done = b < n0 || (b === n0 && q.ph > 0.5), hv = bar === Math.floor(n0 / 4) && q.hits ? q.hits[b % 4] : null;
    if (ty === 'h') { c.strokeStyle = 'rgba(143,211,255,.55)'; c.lineWidth = 2; c.beginPath(); c.arc(x, HY + 3, 7, 0, TAU); c.stroke(); continue; }
    const col = ty === 'L' || ty === 'R' ? '#ffc93c' : '#e8452c', rN = b === n0 + 1 ? 10 + pulse * 2 : 10;
    c.globalAlpha = done && hv == null ? 0.35 : 1; c.fillStyle = hv == null ? col : hv >= 0.95 ? '#35d07f' : hv >= 0.6 ? '#ffc93c' : hv > 0 ? '#ff9a3c' : '#ff4d4d'; c.beginPath(); c.arc(x, HY + 3, rN, 0, TAU); c.fill(); c.lineWidth = 2; c.strokeStyle = 'rgba(255,255,255,.8)'; c.stroke();
    if (ty === 'L' || ty === 'R') { c.fillStyle = '#2a1600'; c.font = '900 12px system-ui,sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(ty === 'L' ? '◀' : '▶', x, HY + 4); }
    c.globalAlpha = 1; }
  c.restore();
  c.save(); c.strokeStyle = '#fff'; c.lineWidth = 3; c.globalAlpha = 0.6 + pulse * 0.4; c.beginPath(); c.arc(HX, HY + 3, 14 + pulse * 3, 0, TAU); c.stroke(); c.restore();
  // banners
  c.textAlign = 'center'; c.textBaseline = 'middle';
  const banner = (txt, y, col, sz, bg) => { c.font = '900 ' + sz + 'px system-ui,sans-serif'; const tw = c.measureText(txt).width + 26; c.fillStyle = bg || 'rgba(20,10,24,.82)'; c.beginPath(); if (c.roundRect) c.roundRect(cx - tw / 2, y - sz * 0.8, tw, sz * 1.6, sz * 0.8); else c.rect(cx - tw / 2, y - sz * 0.8, tw, sz * 1.6); c.fill(); c.fillStyle = col; c.fillText(txt, cx, y + 1); };
  const by = HY - 40;
  if (q.count) banner(q.count, h * 0.42, '#ffc93c', 46);
  else if (lastBeats) { const nm = nx === 'L' ? 'PUTAR KIRI ⟲' : nx === 'R' ? 'PUTAR KANAN ⟳' : nx === 'h' ? 'HENING 🤫' : nx === 'f' ? 'FINIS 🔥' : 'JALAN LAGI 🥁', sz = 17 + (q.beat >= 2 ? pulse * 6 : 0);
    banner(nm + '  ·  ' + cd, by, nTurn ? '#ffc93c' : nx === 'h' ? '#8fd3ff' : '#fff', Math.round(sz), q.beat === 3 ? 'rgba(120,40,10,.9)' : null); }
  else if (turn) banner(q.type === 'L' ? 'PUTAR KIRI! ketuk sisi kiri ⟲' : 'PUTAR KANAN! ketuk sisi kanan ⟳', by, '#ffc93c', 17);
  else if (hen) banner('HENING… jangan ketuk', by, '#8fd3ff', 17);
  else if (change) banner('Birama berikut: ' + (nx === 'L' ? 'putar KIRI ⟲' : nx === 'R' ? 'putar KANAN ⟳' : nx === 'h' ? 'HENING 🤫' : 'jalan 🥁'), by, '#fff', 14);
  if (q.jt && q.jAge < 650) { const a = 1 - q.jAge / 650; c.save(); c.globalAlpha = a; c.font = '900 ' + Math.round(q.jAge < 90 ? 22 + q.jAge / 15 : 28) + 'px system-ui,sans-serif'; c.lineWidth = 6; c.strokeStyle = 'rgba(20,6,10,.8)'; const y = by - 38 - q.jAge * 0.03; c.strokeText(q.jt, q.jx || cx, y); c.fillStyle = q.jc || '#fff'; c.fillText(q.jt, q.jx || cx, y); c.restore(); }
}
function caption(c, w, h, a, b, al) { c.save(); c.globalAlpha = al == null ? 1 : al; c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = '900 ' + Math.round(Math.min(30, w * 0.07)) + 'px system-ui,sans-serif'; c.lineWidth = 6; c.strokeStyle = 'rgba(20,6,10,.85)'; c.strokeText(a, w / 2, h * 0.2); c.fillStyle = '#ffe3a0'; c.fillText(a, w / 2, h * 0.2); if (b) { c.font = '700 ' + Math.round(Math.min(17, w * 0.042)) + 'px system-ui,sans-serif'; c.lineWidth = 4; c.strokeText(b, w / 2, h * 0.2 + 32); c.fillStyle = '#fff'; c.fillText(b, w / 2, h * 0.2 + 32); } c.restore(); }
function ogIcon(cv, d) { const c = cv.getContext('2d'), w = cv.width, h = cv.height; const g = c.createRadialGradient(w / 2, h * 0.4, 4, w / 2, h / 2, w * 0.7); g.addColorStop(0, '#5a2a48'); g.addColorStop(1, '#1c1024'); c.fillStyle = g; c.fillRect(0, 0, w, h); ctx = c; ogoh(w / 2, h * 1.12, h * 1.05, d, 1.2, {}); }
window.OR = { scene, cue, caption, ogIcon, SPEED };
})();

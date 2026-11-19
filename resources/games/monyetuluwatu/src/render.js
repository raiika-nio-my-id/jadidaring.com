/* Monyet Uluwatu renderer (canvas 2D, design space 400x720). window.MR */
(function (root) {
'use strict';
const MU = root.MU, DW = 400, DH = 720, TAU = Math.PI * 2;
const mix = (a, b, p) => { const A = parseInt(a.slice(1), 16), B = parseInt(b.slice(1), 16), c = i => Math.round(((A >> i) & 255) + (((B >> i) & 255) - ((A >> i) & 255)) * p); return 'rgb(' + c(16) + ',' + c(8) + ',' + c(0) + ')'; };
const ramp = (stops, p) => { for (let i = 1; i < stops.length; i++) if (p <= stops[i][0]) { const a = stops[i - 1], b = stops[i], q = (p - a[0]) / (b[0] - a[0]); return mix(a[1], b[1], q); } return stops[stops.length - 1][1]; };
const SKY_T = [[0, '#6fb8e6'], [0.45, '#86a9d8'], [0.75, '#c46a7a'], [1, '#3c2463']], SKY_H = [[0, '#ffe7b8'], [0.45, '#ffc98a'], [0.75, '#ff9a55'], [1, '#ff6a45']];
const SKINS = ['#f2c9a0', '#d9a36f', '#b9784a', '#8a5532'], SHIRTS = ['#e84a5f', '#2a9d8f', '#f4a261', '#6c5ce7', '#ffffff', '#3d8bd9'];
const fx = []; let shake = 0;
const view = { s: 1, ox: 0, oy: 0, W: 400, H: 720 };
function toWorld(cx, cy) { return [(cx - view.ox) / view.s, (cy - view.oy) / view.s]; }
function addFx(f) { f.t = 0; fx.push(f); if (fx.length > 140) fx.shift(); }
function onEvent(g, e) {
  const R = Math.random;
  if (e.t === 'shoo') { for (let i = 0; i < 9; i++) addFx({ k: 'dust', x: e.x + (R() - 0.5) * 30, y: e.y - 6 + (R() - 0.5) * 14, vx: (R() - 0.5) * 90, vy: -R() * 50, life: 0.6 + R() * 0.3, r: 5 + R() * 7 }); addFx({ k: 'txt', x: e.x, y: e.y - 50, s: e.near ? 'NYARIS! +' + e.pts : '+' + e.pts + (e.mult > 1 ? ' x' + e.mult : ''), c: e.near ? '#ffd23f' : '#fff', life: 0.9 }); addFx({ k: 'hus', x: e.x, y: e.y - 34, life: 0.5 }); }
  else if (e.t === 'bonk') { addFx({ k: 'txt', x: e.x, y: e.y - 60, s: 'Bos! Sekali lagi!', c: '#ffb36b', life: 0.8 }); addFx({ k: 'hus', x: e.x, y: e.y - 40, life: 0.45 }); shake = 4; }
  else if (e.t === 'steal') { shake = 7; addFx({ k: 'txt', x: e.x, y: e.y - 92, s: (e.item === 'hp' ? 'HP' : e.item === 'kacamata' ? 'Kacamata' : 'Sandal') + ' dicuri!', c: '#ff6b5a', life: 1.1 }); }
  else if (e.t === 'fed') { for (let i = 0; i < 6; i++) addFx({ k: 'spark', x: e.x, y: e.y - 20, vx: (R() - 0.5) * 120, vy: -40 - R() * 80, life: 0.5, c: '#ffe066' }); }
  else if (e.t === 'recover') { addFx({ k: 'fly', x0: e.x, y0: e.y - 30, x1: e.tx, y1: e.ty - 60, item: e.item, life: 0.7 }); addFx({ k: 'txt', x: e.x, y: e.y - 60, s: (e.quick ? 'CEPAT! ' : '') + '+' + e.pts, c: '#7dffb0', life: 1 }); for (let i = 0; i < 12; i++) addFx({ k: 'spark', x: e.tx, y: e.ty - 60, vx: Math.cos(i / 12 * TAU) * 110, vy: Math.sin(i / 12 * TAU) * 110, life: 0.55, c: i % 2 ? '#ffd23f' : '#fff' }); }
  else if (e.t === 'escape') { shake = 9; addFx({ k: 'txt', x: Math.max(80, Math.min(320, e.x)), y: e.y - 40, s: 'Kabur! -1 ❤', c: '#ff5a5a', life: 1.2 }); }
  else if (e.t === 'basket') { addFx({ k: 'txt', x: e.x, y: e.y - 40, s: '+' + e.add + ' pisang', c: '#ffe066', life: 0.9 }); }
  else if (e.t === 'miss') addFx({ k: 'ring', x: e.x, y: e.y, life: 0.3 });
  else if (e.t === 'catch') addFx({ k: 'txt', x: e.x, y: e.y - 50, s: 'nyam', c: '#ffe066', life: 0.6 });
}
function sky(c, W, H, p) {
  const hy = view.oy + 240 * view.s, gr = c.createLinearGradient(0, 0, 0, hy);
  gr.addColorStop(0, ramp(SKY_T, p)); gr.addColorStop(1, ramp(SKY_H, p)); c.fillStyle = gr; c.fillRect(0, 0, W, hy + 2);
}
function cloud(c, x, y, s, a) { c.globalAlpha = a; c.beginPath(); c.arc(x, y, 14 * s, 0, TAU); c.arc(x + 16 * s, y - 6 * s, 18 * s, 0, TAU); c.arc(x + 36 * s, y, 13 * s, 0, TAU); c.rect(x, y, 36 * s, 12 * s); c.fill(); c.globalAlpha = 1; }
function world(c, g, now) {
  const p = g ? MU.pct(g) : 0.62, cam = Math.sin(now * 0.12) * 10; c.save(); c.translate(cam * 0.15, 0);
  // sun + glow
  const sy = 120 + p * 125, sx = 150;
  const glow = c.createRadialGradient(sx, sy, 6, sx, sy, 150); glow.addColorStop(0, 'rgba(255,236,170,.75)'); glow.addColorStop(1, 'rgba(255,200,120,0)'); c.fillStyle = glow; c.fillRect(0, 0, DW, 300);
  c.fillStyle = mix('#fff6d6', '#ff8a3c', p); c.beginPath(); c.arc(sx, sy, 24, 0, TAU); c.fill();
  c.fillStyle = mix('#ffffff', '#ffc0a0', p); for (let i = 0; i < 3; i++) cloud(c, ((now * 6 + i * 150) % 520) - 80, 60 + i * 34, 0.9 + i * 0.2, 0.35 + 0.1 * i);
  // birds
  c.strokeStyle = 'rgba(40,20,40,.55)'; c.lineWidth = 1.6; for (let i = 0; i < 3; i++) { const bx = (now * 22 + i * 90) % 480 - 40, by = 92 + i * 18 + Math.sin(now * 2 + i) * 4, f = Math.sin(now * 9 + i) * 3; c.beginPath(); c.moveTo(bx - 6, by - f); c.quadraticCurveTo(bx - 3, by - 3, bx, by); c.quadraticCurveTo(bx + 3, by - 3, bx + 6, by - f); c.stroke(); }
  c.restore(); c.save(); c.translate(cam * 0.3, 0);
  // sea
  const sea = c.createLinearGradient(0, 238, 0, 320); sea.addColorStop(0, mix('#3b8fc4', '#7a3a6a', p)); sea.addColorStop(1, mix('#1d5d8a', '#2b1b45', p)); c.fillStyle = sea; c.fillRect(-200, 238, DW + 400, 90);
  c.fillStyle = 'rgba(255,220,150,' + (0.25 + p * 0.35) + ')'; for (let i = 0; i < 9; i++) { const w = 46 - i * 4 + Math.sin(now * 2 + i) * 6; c.fillRect(sx - w / 2 + Math.sin(now * 1.3 + i * 2) * 5, 244 + i * 7, w, 2); }
  c.restore(); c.save(); c.translate(cam * 0.55, 0);
  // cliffs
  c.fillStyle = mix('#7a5a3a', '#3a2230', p); c.beginPath(); c.moveTo(-200, 250); c.lineTo(20, 236); c.lineTo(40, 262); c.lineTo(58, 300); c.lineTo(-200, 320); c.fill();
  c.beginPath(); c.moveTo(600, 200); c.lineTo(300, 205); c.lineTo(262, 222); c.lineTo(240, 270); c.lineTo(250, 310); c.lineTo(600, 320); c.fill();
  c.fillStyle = mix('#5f8a3a', '#2f2a30', p); c.beginPath(); c.ellipse(320, 204, 90, 9, 0, 0, TAU); c.fill(); c.beginPath(); c.ellipse(-10, 238, 50, 7, 0, 0, TAU); c.fill();
  // meru (tiered shrine) on the cliff
  const mc = mix('#3a2a2a', '#1c1020', p); c.fillStyle = mc; c.fillRect(326, 168, 22, 34);
  for (let i = 0; i < 5; i++) { const y = 170 - i * 11, w = 46 - i * 8; c.beginPath(); c.moveTo(337 - w / 2, y); c.lineTo(337 + w / 2, y); c.lineTo(337 + w / 2 - 6, y - 8); c.lineTo(337 - w / 2 + 6, y - 8); c.fill(); }
  c.fillRect(335, 106, 4, 14);
  c.restore(); c.save(); c.translate(cam * 0.8, 0);
  // wall + candi bentar gate
  const st = mix('#9a8a78', '#5a4650', p), st2 = mix('#7b6c5e', '#45343e', p);
  for (const sgn of [-1, 1]) { const gx = 200 + sgn * 34; c.fillStyle = st2; c.beginPath(); c.moveTo(gx, 342); c.lineTo(gx, 236); c.lineTo(gx + sgn * 8, 226); c.lineTo(gx + sgn * 12, 236); for (let i = 0; i < 6; i++) { c.lineTo(gx + sgn * (14 + i * 3), 252 + i * 15); c.lineTo(gx + sgn * (20 + i * 3), 254 + i * 15); } c.lineTo(gx + sgn * 40, 342); c.fill(); c.fillStyle = 'rgba(0,0,0,.22)'; c.fillRect(Math.min(gx, gx - sgn * 7), 236, 7, 106); }
  c.fillStyle = st; c.fillRect(-200, 320, DW + 400, 26); c.fillStyle = st2; c.fillRect(-200, 344, DW + 400, 6);
  c.fillStyle = 'rgba(0,0,0,.12)'; for (let x = -200; x < DW + 200; x += 26) for (let r = 0; r < 2; r++) c.fillRect(x + (r ? 13 : 0), 322 + r * 12, 1.5, 11);
  c.fillStyle = mix('#c8b8a2', '#76626a', p); c.beginPath(); c.moveTo(-200, 320); c.lineTo(DW + 200, 320); c.lineTo(DW + 190, 306); c.lineTo(-190, 306); c.fill(); c.fillStyle = 'rgba(255,230,190,.25)'; c.fillRect(-200, 306, DW + 400, 2);
  c.restore();
  // steps: 2.5D oblique stair (tread top faces + standing risers), foreshortened toward the gate
  stairs(c, p);
  c.fillStyle = 'rgba(70,110,50,.18)'; for (const [x, y, r] of [[30, 372, 18], [370, 408, 14], [150, 478, 10], [250, 590, 12], [20, 520, 16], [380, 690, 18], [330, 372, 9]]) { c.beginPath(); c.ellipse(x, y, r * 1.6, r * 0.5, 0, 0, TAU); c.fill(); }
  c.strokeStyle = 'rgba(60,40,30,.18)'; c.lineWidth = 1; for (const [x, y] of [[90, 390], [260, 470], [180, 610], [330, 520], [60, 680]]) { c.beginPath(); c.moveTo(x, y); c.lineTo(x + 8, y + 6); c.lineTo(x + 5, y + 12); c.stroke(); }
  for (const [x, y] of [[176, 380], [232, 486], [40, 452], [360, 596], [200, 704]]) canang(c, x, y);
  // frangipani bushes on the edges
  for (const [x, y] of [[-8, 410], [408, 470], [-12, 590], [410, 640], [-4, 720], [404, 360]]) { c.fillStyle = mix('#3f7a3a', '#25352c', p); c.beginPath(); c.arc(x, y, 34, 0, TAU); c.arc(x + (x < 200 ? 18 : -18), y - 20, 22, 0, TAU); c.fill(); for (let k = 0; k < 4; k++) { const fx2 = x + (x < 200 ? 6 + k * 7 : -6 - k * 7), fy = y - 26 + (k % 2) * 16; flower(c, fx2, fy); } }
}
// oblique ground plane: rows get deeper (taller) toward the camera, stair narrows toward the gate
const ROWS = (() => { const r = []; let y = 350; for (let i = 0; i < 12; i++) { const h = 22 + i * 2.6; r.push([y, h]); y += h; } return r; })();
const hw = y => 120 + (y - 350) * 0.42;
function stairs(c, p) {
  const tread = mix('#cdbb9f', '#7f676a', p), tread2 = mix('#c2b094', '#77605f', p), riser = mix('#8f7c66', '#4f3c45', p), side = mix('#7a6a58', '#3e2f38', p), top = mix('#b3a28b', '#665158', p);
  // ground beside the stair (grass + paving), darker = lower
  const gg = c.createLinearGradient(0, 350, 0, 760); gg.addColorStop(0, mix('#8a9a5a', '#4a4446', p)); gg.addColorStop(1, mix('#5f7a3a', '#2e2a30', p)); c.fillStyle = gg; c.fillRect(-200, 350, DW + 400, 420);
  for (let i = 0; i < ROWS.length; i++) { const [y, h] = ROWS[i], w0 = hw(y), w1 = hw(y + h), rh = h * 0.34;
    c.fillStyle = i % 2 ? tread : tread2; c.beginPath(); c.moveTo(200 - w0, y); c.lineTo(200 + w0, y); c.lineTo(200 + w1, y + h - rh); c.lineTo(200 - w1, y + h - rh); c.fill();
    c.fillStyle = riser; c.fillRect(200 - w1, y + h - rh, w1 * 2, rh);
    c.fillStyle = 'rgba(255,240,210,.18)'; c.fillRect(200 - w0, y, w0 * 2, 1.5);
    c.fillStyle = 'rgba(0,0,0,.10)'; for (let k = -3; k <= 3; k++) c.fillRect(200 + k * w1 / 3.5, y + h - rh, 1, rh);
  }
  // balustrade side walls with top faces (standing up out of the plane)
  for (const sg of [-1, 1]) { const yb = 760, xa = 200 + sg * hw(350), xb = 200 + sg * hw(yb), t = 26;
    c.fillStyle = side; c.beginPath(); c.moveTo(xa, 350); c.lineTo(xb, yb); c.lineTo(xb + sg * t * 1.4, yb); c.lineTo(xa + sg * t, 350); c.fill();
    c.fillStyle = top; c.beginPath(); c.moveTo(xa, 350); c.lineTo(xb, yb); c.lineTo(xb, yb - 30); c.lineTo(xa, 336); c.fill();
    c.fillStyle = 'rgba(0,0,0,.12)'; for (let y = 380; y < 760; y += 52) { const x = 200 + sg * hw(y); c.fillRect(x - 3, y - 18 - (y - 350) * 0.03, 6, 18); }
  }
}
function canang(c, x, y) { c.fillStyle = '#7fae4a'; c.fillRect(x - 8, y - 4, 16, 8); c.strokeStyle = '#557a2c'; c.lineWidth = 1; c.strokeRect(x - 8, y - 4, 16, 8); const cols = ['#ffffff', '#ff5a7a', '#ffd23f', '#a46bff']; for (let i = 0; i < 4; i++) { c.fillStyle = cols[i]; c.beginPath(); c.arc(x - 5 + i * 3.4, y - 3 - (i % 2), 2.6, 0, TAU); c.fill(); } c.strokeStyle = 'rgba(255,255,255,.5)'; c.beginPath(); c.moveTo(x + 6, y - 6); c.quadraticCurveTo(x + 9, y - 16, x + 5 + Math.sin(Date.now() / 600 + x) * 2, y - 24); c.stroke(); }
function flower(c, x, y) { c.fillStyle = '#fff6e8'; for (let i = 0; i < 5; i++) { c.beginPath(); c.ellipse(x + Math.cos(i / 5 * TAU) * 3, y + Math.sin(i / 5 * TAU) * 3, 3, 1.8, i / 5 * TAU, 0, TAU); c.fill(); } c.fillStyle = '#ffcf4a'; c.beginPath(); c.arc(x, y, 1.6, 0, TAU); c.fill(); }
function glasses(c, x, y, s, col) { c.save(); c.translate(x, y); c.scale(s, s); c.strokeStyle = '#111'; c.lineWidth = 2; c.fillStyle = col || '#1b1b2a'; c.beginPath(); c.ellipse(-5, 0, 4.6, 3.6, 0, 0, TAU); c.ellipse(5, 0, 4.6, 3.6, 0, 0, TAU); c.fill(); c.beginPath(); c.moveTo(-1, -1); c.lineTo(1, -1); c.stroke(); c.fillStyle = 'rgba(255,255,255,.5)'; c.fillRect(-7, -2, 2, 1.4); c.fillRect(3, -2, 2, 1.4); c.restore(); }
function phone(c, x, y, s) { c.save(); c.translate(x, y); c.scale(s, s); c.fillStyle = '#20222e'; rr(c, -4.5, -8, 9, 16, 2); c.fill(); c.fillStyle = '#7fd3ff'; rr(c, -3.4, -6.6, 6.8, 12, 1); c.fill(); c.fillStyle = 'rgba(255,255,255,.6)'; c.fillRect(-2.5, -5.5, 2, 4); c.restore(); }
function sandal(c, x, y, s) { c.save(); c.translate(x, y); c.scale(s, s); c.fillStyle = '#ff7a3c'; c.beginPath(); c.ellipse(0, 0, 9, 4, 0, 0, TAU); c.fill(); c.strokeStyle = '#2a9d8f'; c.lineWidth = 2.2; c.beginPath(); c.moveTo(-4, -1); c.quadraticCurveTo(0, -7, 4, -1); c.stroke(); c.restore(); }
function item(c, k, x, y, s) { if (k === 'hp') phone(c, x, y, s); else if (k === 'kacamata') glasses(c, x, y, s); else sandal(c, x, y, s); }
function rr(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
function banana(c, x, y, s, rot) { c.save(); c.translate(x, y); c.rotate(rot || 0); c.scale(s, s); c.fillStyle = '#ffd93b'; c.strokeStyle = '#a3741a'; c.lineWidth = 1.2; c.beginPath(); c.arc(0, -6, 9, 0.25 * Math.PI, 0.85 * Math.PI); c.arc(0, -10, 11, 0.8 * Math.PI, 0.2 * Math.PI, true); c.closePath(); c.fill(); c.stroke(); c.fillStyle = '#5a3d10'; c.fillRect(7, -1, 2.2, 2.2); c.restore(); }
function tourist(c, tr, now, g) {
  if (tr.state === 'empty') return; let x = tr.x, y = tr.y, a = 1;
  if (tr.state === 'arriving') { const q = Math.max(0, tr.t) / 0.8; y += q * 50; a = 1 - q; }
  if (tr.state === 'leaving') { const q = 1 - Math.max(0, tr.t) / 1.2; y += q * 60; a = 1 - q; }
  c.save(); c.globalAlpha = a; const skin = SKINS[tr.skin], shirt = SHIRTS[tr.shirt], f = tr.look, bob = Math.sin(now * 2 + tr.i) * 1.2, dd = MU.depth(y);
  shadow(c, x, y, 22 * dd); c.translate(x, y); c.scale(dd, dd); c.translate(-x, -y);
  c.fillStyle = '#2f3b5a'; c.fillRect(x - 9, y - 30, 7, 30); c.fillRect(x + 2, y - 30, 7, 30);
  if (tr.item === 'sandal' && tr.state !== 'robbed') { sandal(c, x - 6, y - 1, 0.75); sandal(c, x + 6, y - 1, 0.75); } else { c.fillStyle = skin; c.fillRect(x - 9, y - 4, 7, 4); c.fillRect(x + 2, y - 4, 7, 4); }
  c.fillStyle = shirt; rr(c, x - 13, y - 62 + bob, 26, 36, 8); c.fill(); c.fillStyle = 'rgba(0,0,0,.1)'; c.fillRect(x - 13, y - 34 + bob, 26, 6);
  // arms
  c.strokeStyle = skin; c.lineWidth = 6; c.lineCap = 'round'; c.beginPath();
  if (tr.item === 'hp' && tr.state !== 'robbed') { c.moveTo(x + f * 11, y - 54 + bob); c.lineTo(x + f * 22, y - 72 + bob); } else { c.moveTo(x + f * 11, y - 54 + bob); c.lineTo(x + f * 15, y - 34 + bob); }
  c.moveTo(x - f * 11, y - 54 + bob); c.lineTo(x - f * 15, y - 34 + bob); c.stroke();
  if (tr.item === 'hp' && tr.state !== 'robbed') phone(c, x + f * 23, y - 78 + bob, 1);
  // head
  const hy = y - 74 + bob; c.fillStyle = skin; c.beginPath(); c.arc(x, hy, 12, 0, TAU); c.fill();
  c.fillStyle = ['#2a1a10', '#5a3a20', '#d9b36a', '#1a1a1a'][tr.skin]; c.beginPath(); c.arc(x, hy - 3, 12.5, Math.PI * 1.05, Math.PI * 1.95); c.fill();
  if (tr.hat === 1) { c.fillStyle = '#e9d29a'; c.beginPath(); c.ellipse(x, hy - 8, 20, 5, 0, 0, TAU); c.fill(); c.beginPath(); c.arc(x, hy - 9, 10, Math.PI, TAU); c.fill(); c.fillStyle = '#e84a5f'; c.fillRect(x - 10, hy - 11, 20, 3); }
  else if (tr.hat === 2) { c.fillStyle = '#ff8c42'; c.beginPath(); c.arc(x, hy - 7, 12, Math.PI, TAU); c.fill(); c.fillRect(x + f * 2, hy - 8, f * 16, 4); }
  c.fillStyle = '#1a1a1a';
  if (tr.item === 'kacamata' && tr.state !== 'robbed') glasses(c, x + f * 2, hy + 1, 0.85);
  else { c.beginPath(); c.arc(x + f * 2 - 4, hy + 1, 1.6, 0, TAU); c.arc(x + f * 2 + 4, hy + 1, 1.6, 0, TAU); c.fill(); }
  c.strokeStyle = '#6a2a1a'; c.lineWidth = 1.6; c.beginPath(); if (tr.state === 'robbed' || tr.mood > 0.3) c.arc(x + f * 2, hy + 9, 3.4, Math.PI * 1.15, Math.PI * 1.85); else c.arc(x + f * 2, hy + 5, 3.4, 0.2, Math.PI - 0.2); c.stroke();
  if (tr.state === 'robbed') { bubble(c, x, hy - 30, now); c.globalAlpha = 0.5 * a; item(c, findItem(g, tr), x, hy - 31, 1.2); c.globalAlpha = a; c.fillStyle = '#e8453c'; c.font = '900 13px system-ui,sans-serif'; c.textAlign = 'center'; c.fillText('?!', x + 15, hy - 36); }
  else if (tr.mood > 0) { c.fillStyle = '#ffd23f'; c.font = '900 22px system-ui,sans-serif'; c.textAlign = 'center'; c.fillText('!', x + f * 18, hy - 16); }
  c.restore();
}
function shadow(c, x, y, r) { const gr = c.createRadialGradient(x, y, 1, x, y, r); gr.addColorStop(0, 'rgba(30,12,8,.38)'); gr.addColorStop(1, 'rgba(30,12,8,0)'); c.save(); c.translate(x, y); c.scale(1, 0.3); c.translate(-x, -y); c.fillStyle = gr; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); c.restore(); }
function findItem(g, tr) { const m = g && g.mons.find(o => o.tgt === tr.i && o.item); return m ? m.item : 'hp'; }
function bubble(c, x, y, now) { c.fillStyle = 'rgba(255,255,255,.92)'; c.beginPath(); c.arc(x, y, 15 + Math.sin(now * 6) * 1, 0, TAU); c.fill(); c.beginPath(); c.moveTo(x - 4, y + 12); c.lineTo(x + 2, y + 20); c.lineTo(x + 6, y + 11); c.fill(); }
function monkey(c, m, now, g) {
  const T = MU.TYPES[m.type], s = T.sc, f = m.face; let x = m.x, y = m.y;
  const walkish = m.st === 'walk' || m.st === 'carry' || m.st === 'flee' || m.st === 'escape' || m.st === 'hop', bob = walkish ? Math.abs(Math.sin(m.bob)) * 4 : Math.sin(now * 3 + m.id) * 0.8;
  const dd = MU.depth(y); shadow(c, x, y, 20 * s * dd);
  c.save(); c.translate(x, y - bob * dd); c.scale(s * f * dd, s * dd);
  const fur = m.type === 'bos' ? '#6e5236' : m.type === 'anak' ? '#a8865e' : '#8c6a46', fur2 = m.type === 'bos' ? '#9a7a56' : '#c2a27a', faceC = '#e9b9a2';
  // tail
  c.strokeStyle = fur; c.lineWidth = 4; c.lineCap = 'round'; c.beginPath(); c.moveTo(-12, -10); c.bezierCurveTo(-32, -10, -30, -40, -20 + Math.sin(now * 3 + m.id) * 4, -44); c.stroke();
  const sit = m.st === 'perch' || m.st === 'eat' || m.st === 'grab';
  c.fillStyle = fur;
  if (sit) { c.beginPath(); c.ellipse(0, -16, 14, 16, 0, 0, TAU); c.fill(); c.fillStyle = fur2; c.beginPath(); c.ellipse(2, -14, 8, 10, 0, 0, TAU); c.fill(); c.fillStyle = fur; c.beginPath(); c.ellipse(-8, -2, 7, 4, 0, 0, TAU); c.ellipse(8, -2, 7, 4, 0, 0, TAU); c.fill(); }
  else { c.beginPath(); c.ellipse(0, -16, 17, 10, -0.1, 0, TAU); c.fill(); const l = Math.sin(m.bob) * 5; c.strokeStyle = fur; c.lineWidth = 5; c.beginPath(); c.moveTo(-9, -10); c.lineTo(-11 - l, 0); c.moveTo(9, -10); c.lineTo(11 + l, 0); c.moveTo(-4, -10); c.lineTo(-3 + l, 0); c.moveTo(6, -10); c.lineTo(5 - l, 0); c.stroke(); }
  // head
  const hx = sit ? 2 : 15, hy = sit ? -36 : -24; c.fillStyle = fur; c.beginPath(); c.arc(hx, hy, 11, 0, TAU); c.fill();
  c.beginPath(); c.arc(hx - 9, hy - 2, 4, 0, TAU); c.arc(hx + 9, hy - 2, 4, 0, TAU); c.fill(); if (m.type === 'bos') { c.beginPath(); c.moveTo(hx - 10, hy - 6); c.lineTo(hx - 4, hy - 16); c.lineTo(hx + 1, hy - 9); c.lineTo(hx + 6, hy - 16); c.lineTo(hx + 10, hy - 6); c.fill(); }
  c.fillStyle = faceC; c.beginPath(); c.ellipse(hx + 1, hy + 1, 7.5, 7, 0, 0, TAU); c.fill(); c.beginPath(); c.ellipse(hx + 3, hy + 5, 5, 3.4, 0, 0, TAU); c.fill();
  c.fillStyle = '#1a0e08'; c.beginPath(); c.arc(hx - 1, hy - 1, 1.6, 0, TAU); c.arc(hx + 4, hy - 1, 1.6, 0, TAU); c.fill();
  c.strokeStyle = '#7a3a2a'; c.lineWidth = 1.3; c.beginPath(); if (m.st === 'flee' || m.st === 'shoved') { c.arc(hx + 3, hy + 6, 1.8, 0, TAU); } else c.arc(hx + 3, hy + 4, 2.4, 0.3, Math.PI - 0.3); c.stroke();
  if (m.st === 'eat') { c.save(); c.scale(1, 1); banana(c, hx + 8, hy + 8, 0.8, -0.6 + Math.sin(now * 10) * 0.2); c.restore(); }
  // item held over head
  if (m.item) { c.save(); c.scale(f, 1); item(c, m.item, (sit ? 2 : 10) * f, sit ? -56 : -44, 1.35); c.restore(); }
  if (m.st === 'grab') { c.strokeStyle = fur; c.lineWidth = 4; c.beginPath(); c.moveTo(8, -20); c.lineTo(22 + Math.sin(now * 30) * 3, -36); c.stroke(); }
  c.restore();
  if (m.st === 'perch') { // timer ring + needed bananas
    const q = Math.max(0, m.life / m.lifeMax), ry = y - 64 * s * dd; c.lineWidth = 4; c.strokeStyle = 'rgba(0,0,0,.35)'; c.beginPath(); c.arc(x, y - 18 * s * dd, 26 * s * dd, 0, TAU); c.stroke();
    c.strokeStyle = q > 0.5 ? '#7dffb0' : q > 0.25 ? '#ffd23f' : '#ff5a5a'; c.beginPath(); c.arc(x, y - 18 * s * dd, 26 * s * dd, -Math.PI / 2, -Math.PI / 2 + q * TAU); c.stroke();
    const left = m.need - m.fed; c.fillStyle = 'rgba(30,14,8,.78)'; rr(c, x - 6 - left * 9, ry - 30, 12 + left * 18, 20, 10); c.fill(); for (let i = 0; i < left; i++) banana(c, x - left * 9 + 9 + i * 18, ry - 16, 0.75, 0.2);
    if (q < 0.3 && Math.sin(now * 16) > 0) { c.strokeStyle = 'rgba(255,90,90,.6)'; c.lineWidth = 2; c.beginPath(); c.arc(x, y - 18 * s * dd, 31 * s * dd, 0, TAU); c.stroke(); }
  }
}
function basketDraw(c, b, now) {
  const pul = 1 + Math.sin(now * 6) * 0.05, q = b.life > 1e6 ? 1 : 1 - b.t / b.life; c.save(); c.translate(b.x, b.y); c.scale(pul, pul);
  c.strokeStyle = 'rgba(255,230,120,.8)'; c.lineWidth = 3; c.beginPath(); c.arc(0, -10, 30, -Math.PI / 2, -Math.PI / 2 + q * TAU); c.stroke();
  banana(c, -6, -14, 0.9, -0.4); banana(c, 4, -16, 0.9, 0.2); banana(c, 0, -12, 0.9, 0.7);
  c.fillStyle = '#b07a3a'; c.beginPath(); c.moveTo(-18, -10); c.lineTo(18, -10); c.lineTo(13, 6); c.lineTo(-13, 6); c.closePath(); c.fill(); c.strokeStyle = '#7a4f22'; c.lineWidth = 1.5; for (let i = -12; i <= 12; i += 6) { c.beginPath(); c.moveTo(i, -10); c.lineTo(i * 0.75, 6); c.stroke(); } c.beginPath(); c.moveTo(-17, -4); c.lineTo(17, -4); c.stroke();
  c.restore();
}
function draw(cv, g, now, opts) {
  opts = opts || {}; const { g: c, W, H } = root.JDK.fitCanvas(cv); const s = Math.min(W / DW, H / DH); view.s = s; view.ox = (W - DW * s) / 2; view.oy = (H - DH * s) / 2; view.W = W; view.H = H;
  const p = g ? MU.pct(g) : (opts.p != null ? opts.p : 0.62);
  sky(c, W, H, p);
  // fill below horizon (steps colour) for wide screens
  c.fillStyle = mix('#bba98d', '#6e575c', p); c.fillRect(0, view.oy + 350 * s, W, H);
  c.save(); let sx = 0, sy = 0; if (shake > 0.2 && !opts.still) { sx = (Math.random() - 0.5) * shake; sy = (Math.random() - 0.5) * shake; shake *= 0.86; } c.translate(view.ox + sx, view.oy + sy); c.scale(s, s);
  world(c, g, now);
  if (g) {
    const list = [...g.tour.filter(t => t.state !== 'empty').map(t => ({ y: t.y, d: () => tourist(c, t, now, g) })), ...g.mons.map(m => ({ y: m.y + (m.st === 'perch' || m.st === 'carry' ? -1000 : 0) + 2, d: () => monkey(c, m, now, g) })), ...g.baskets.map(b => ({ y: b.y, d: () => basketDraw(c, b, now) }))];
    list.sort((a, b) => a.y - b.y).forEach(o => o.d());
    for (const sh of g.shots) { const m = g.mons.find(o => o.id === sh.m); if (!m) continue; const q = Math.min(1, sh.t / sh.dur), tx = m.x, ty = m.y - 20; const x = sh.x0 + (tx - sh.x0) * q, y = sh.y0 + (ty - sh.y0) * q - Math.sin(q * Math.PI) * 120; banana(c, x, y, 1.2, q * 12); }
  }
  for (const f of fx) { f.t += 1 / 60; }
  for (let i = fx.length - 1; i >= 0; i--) { const f = fx[i], q = f.t / f.life; if (q >= 1) { fx.splice(i, 1); continue; }
    if (f.k === 'dust') { c.fillStyle = 'rgba(240,228,205,' + (0.7 * (1 - q)) + ')'; c.beginPath(); c.arc(f.x + f.vx * f.t, f.y + f.vy * f.t, f.r * (1 + q), 0, TAU); c.fill(); }
    else if (f.k === 'spark') { c.fillStyle = f.c; c.globalAlpha = 1 - q; c.fillRect(f.x + f.vx * f.t - 2, f.y + f.vy * f.t + 80 * f.t * f.t - 2, 4, 4); c.globalAlpha = 1; }
    else if (f.k === 'txt') { c.globalAlpha = Math.min(1, (1 - q) * 2); c.font = '900 ' + (19 + (q < 0.15 ? (0.15 - q) * 40 : 0)) + 'px system-ui,sans-serif'; c.textAlign = 'center'; c.lineWidth = 4; c.strokeStyle = 'rgba(40,16,8,.8)'; c.strokeText(f.s, f.x, f.y - q * 30); c.fillStyle = f.c; c.fillText(f.s, f.x, f.y - q * 30); c.globalAlpha = 1; }
    else if (f.k === 'hus') { c.save(); c.translate(f.x, f.y); c.rotate(-0.15); c.scale(1 + q * 0.6, 1 + q * 0.6); c.globalAlpha = 1 - q; c.font = 'italic 900 22px system-ui,sans-serif'; c.textAlign = 'center'; c.lineWidth = 5; c.strokeStyle = '#3a1a0a'; c.strokeText('HUS!', 0, 0); c.fillStyle = '#fff3c4'; c.fillText('HUS!', 0, 0); c.restore(); }
    else if (f.k === 'ring') { c.strokeStyle = 'rgba(255,255,255,' + (0.6 * (1 - q)) + ')'; c.lineWidth = 2; c.beginPath(); c.arc(f.x, f.y, 8 + q * 16, 0, TAU); c.stroke(); }
    else if (f.k === 'fly') { const x = f.x0 + (f.x1 - f.x0) * q, y = f.y0 + (f.y1 - f.y0) * q - Math.sin(q * Math.PI) * 60; item(c, f.item, x, y, 1.6); }
  }
  c.restore();
  // warm sunset grade + vignette
  c.fillStyle = 'rgba(255,110,60,' + (p * 0.12) + ')'; c.fillRect(0, 0, W, H);
  const v = c.createRadialGradient(W / 2, H * 0.45, Math.min(W, H) * 0.35, W / 2, H * 0.45, Math.max(W, H) * 0.75); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(30,8,20,.42)'); c.fillStyle = v; c.fillRect(0, 0, W, H);
}
function icon(cv, kind) { const r = 2, c = cv.getContext('2d'); cv.width = 40 * r; cv.height = 40 * r; c.setTransform(r, 0, 0, r, 0, 0); if (kind === 'pisang') banana(c, 20, 26, 1.6, 0.2); else if (kind === 'monyet') { monkey(c, { type: 'biasa', face: 1, x: 18, y: 38, st: 'idle', bob: 0, id: 1, item: null }, 0); } else item(c, kind, 20, 20, 2); }
root.MR = { draw, toWorld, onEvent, view, icon, banana, monkey, item, fx };
})(window);

/* Benteng Kampung: canvas renderer — map art, animated towers & monsters, projectiles, particles,
   damage numbers, cursors/bubbles, screen shake. Pure drawing (no game rules); everything is canvas-drawn. */
(function (root) {
'use strict';
const BK = root.BK, TAU = Math.PI * 2, R = Math.random;
const SEAT = ['#ef4444', '#3b82f6', '#22c55e', '#f59e0b'];
function rr(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
function circle(g, x, y, r, fill, stroke, lw) { g.beginPath(); g.arc(x, y, Math.max(0.1, r), 0, TAU); if (fill) { g.fillStyle = fill; g.fill(); } if (stroke) { g.lineWidth = lw || 1; g.strokeStyle = stroke; g.stroke(); } }
function ell(g, x, y, rx, ry, fill) { g.beginPath(); g.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), 0, 0, TAU); g.fillStyle = fill; g.fill(); }
function hash(n) { n = (n ^ 61) ^ (n >>> 16); n = n + (n << 3); n = n ^ (n >>> 4); n = Math.imul(n, 0x27d4eb2d); n = n ^ (n >>> 15); return (n >>> 0) / 4294967296; }
const lerpA = (a, b, k) => { let d = ((b - a + Math.PI) % TAU + TAU) % TAU - Math.PI; return a + d * k; };

/* ---------- towers (centred at x,y; s = art size). aim = radians, kick = recoil 0..1 ---------- */
function towerArt(g, k, x, y, s, lvl, now, aim, kick) {
  const u = s / 100, a = aim != null ? aim : -Math.PI / 2, kb = (kick || 0) * 7 * u;
  g.save(); g.translate(x, y);
  switch (k) {
    case 'ketapel': { // wooden Y slingshot that turns to aim
      ell(g, 0, 22 * u, 20 * u, 7 * u, 'rgba(0,0,0,.25)');
      g.save(); g.rotate(a + Math.PI / 2); g.translate(0, kb);
      g.lineCap = 'round'; g.strokeStyle = lvl > 1 ? '#5b3412' : '#7c4a1e'; g.lineWidth = 9 * u;
      g.beginPath(); g.moveTo(0, 24 * u); g.lineTo(0, 2 * u); g.lineTo(-17 * u, -24 * u); g.moveTo(0, 2 * u); g.lineTo(17 * u, -24 * u); g.stroke();
      g.strokeStyle = '#a16207'; g.lineWidth = 3.5 * u; g.beginPath(); g.moveTo(-2 * u, 20 * u); g.lineTo(-2 * u, 4 * u); g.stroke();
      if (lvl > 1) { g.strokeStyle = '#fbbf24'; g.lineWidth = 3 * u; for (const sx of [-1, 1]) { g.beginPath(); g.moveTo(sx * 13 * u, -17 * u); g.lineTo(sx * 16 * u, -22 * u); g.stroke(); } }
      const pull = (kick || 0) * 10 * u;
      g.strokeStyle = '#3f2a14'; g.lineWidth = 2.6 * u; g.beginPath(); g.moveTo(-17 * u, -22 * u); g.quadraticCurveTo(0, (-4 + pull / u) * u, 17 * u, -22 * u); g.stroke();
      circle(g, 0, -12 * u + pull * 0.5, 5 * u, '#9ca3af', '#4b5563', 1.5 * u);
      g.restore(); break;
    }
    case 'meriam': { // bamboo cannon on a log stand, barrel turns + recoils
      ell(g, 0, 20 * u, 28 * u, 9 * u, '#78350f'); ell(g, 0, 18 * u, 24 * u, 6 * u, '#92400e');
      g.save(); g.rotate(a + Math.PI / 2); g.translate(0, kb);
      const len = lvl > 1 ? 50 : lvl ? 46 : 42, wd = lvl > 1 ? 26 : 22;
      rr(g, -wd / 2 * u, -(len - 10) * u, wd * u, len * u, 7 * u); g.fillStyle = lvl > 1 ? '#8fa12e' : '#a3b13a'; g.fill(); g.lineWidth = 2 * u; g.strokeStyle = '#4d5a12'; g.stroke();
      g.strokeStyle = lvl > 1 ? '#fbbf24' : '#5b6b15'; g.lineWidth = 3 * u; for (const yy of [-20, -4, 8]) { g.beginPath(); g.moveTo(-wd / 2 * u, yy * u); g.lineTo(wd / 2 * u, yy * u); g.stroke(); }
      ell(g, 0, -(len - 10) * u, (wd / 2 - 2) * u, 4 * u, '#1f2a0a');
      g.restore();
      circle(g, 0, 6 * u, 8 * u, '#57311a'); break;
    }
    case 'sate': { // satay stall: striped roof, smoking grill
      g.fillStyle = '#7c4a1e'; g.fillRect(-26 * u, -8 * u, 5 * u, 36 * u); g.fillRect(21 * u, -8 * u, 5 * u, 36 * u);
      rr(g, -30 * u, 8 * u, 60 * u, 18 * u, 4 * u); g.fillStyle = '#b45309'; g.fill();
      g.fillStyle = '#1f2937'; g.fillRect(-22 * u, 3 * u, 44 * u, 7 * u);
      const glow = 0.5 + 0.5 * Math.sin(now / 120); g.fillStyle = 'rgba(251,146,60,' + (0.45 + glow * 0.4) + ')'; g.fillRect(-21 * u, 5 * u, 42 * u, 3 * u);
      for (let i = 0; i < 4; i++) { g.strokeStyle = '#78350f'; g.lineWidth = 2 * u; g.beginPath(); g.moveTo((-17 + i * 11) * u, 8 * u); g.lineTo((-12 + i * 11) * u, -4 * u); g.stroke(); circle(g, (-14 + i * 11) * u, 1 * u, 3.4 * u, '#92400e'); }
      g.beginPath(); g.moveTo(-34 * u, -6 * u); g.lineTo(0, -30 * u); g.lineTo(34 * u, -6 * u); g.closePath(); g.fillStyle = lvl > 1 ? '#b91c1c' : '#ef4444'; g.fill();
      g.save(); g.clip(); g.fillStyle = lvl > 1 ? '#fde047' : '#fff'; for (let i = -3; i <= 3; i += 2) { g.beginPath(); g.moveTo(i * 10 * u, -6 * u); g.lineTo(0, -30 * u); g.lineTo((i + 1) * 10 * u, -6 * u); g.closePath(); g.fill(); } g.restore();
      for (let j = 0; j < 2; j++) { const p = ((now / 1100) + j * 0.5) % 1; g.globalAlpha = 0.45 * (1 - p); circle(g, (4 + j * 6 + Math.sin(p * 6) * 3) * u, (-4 - p * 30) * u, (4 + p * 7) * u, '#e5e7eb'); } g.globalAlpha = 1;
      break;
    }
    case 'kentongan': { // hanging slit drum on a frame
      g.strokeStyle = lvl > 1 ? '#3f2a14' : '#57311a'; g.lineWidth = 6 * u; g.lineCap = 'round';
      g.beginPath(); g.moveTo(-20 * u, 30 * u); g.lineTo(-20 * u, -28 * u); g.lineTo(20 * u, -28 * u); g.lineTo(20 * u, 30 * u); g.stroke();
      if (lvl) { g.beginPath(); g.moveTo(-26 * u, -28 * u); g.lineTo(0, -40 * u); g.lineTo(26 * u, -28 * u); g.closePath(); g.fillStyle = lvl > 1 ? '#b45309' : '#78350f'; g.fill(); }
      const sw = Math.sin(now / 300) * 0.08; g.save(); g.translate(0, -28 * u); g.rotate(sw);
      g.strokeStyle = '#3f2a14'; g.lineWidth = 2 * u; g.beginPath(); g.moveTo(0, 0); g.lineTo(0, 10 * u); g.stroke();
      rr(g, -9 * u, 10 * u, 18 * u, 40 * u, 8 * u); g.fillStyle = lvl > 1 ? '#d4a017' : '#b7791f'; g.fill(); g.lineWidth = 2 * u; g.strokeStyle = '#78350f'; g.stroke();
      g.fillStyle = '#3f2a14'; rr(g, -2 * u, 18 * u, 4 * u, 24 * u, 2 * u); g.fill(); g.restore();
      const p = (now / 1200) % 1; g.globalAlpha = 0.6 * (1 - p); g.strokeStyle = '#fde68a'; g.lineWidth = 2 * u; for (const o of [0, Math.PI]) { g.beginPath(); g.arc(0, 0, (16 + p * 24) * u, o - 0.6, o + 0.6); g.stroke(); } g.globalAlpha = 1;
      break;
    }
    case 'petasan': { // firecracker rack that turns to aim
      ell(g, 0, 22 * u, 24 * u, 8 * u, '#57311a');
      g.save(); g.rotate((a + Math.PI / 2) * 0.35); g.translate(0, kb * 0.6);
      const n = lvl > 1 ? 2 : 1;
      for (let i = -n; i <= n; i++) { const h = 40 - Math.abs(i) * 6; rr(g, (i * (n > 1 ? 10 : 13) - 6) * u, (-18 + Math.abs(i) * 6) * u, 12 * u, h * u, 3 * u); g.fillStyle = i % 2 ? '#dc2626' : '#ef4444'; g.fill(); g.fillStyle = lvl ? '#fde047' : '#fbbf24'; g.fillRect((i * (n > 1 ? 10 : 13) - 6) * u, (-12 + Math.abs(i) * 6) * u, 12 * u, 4 * u); }
      g.strokeStyle = '#1f2937'; g.lineWidth = 2 * u; g.beginPath(); g.moveTo(0, -18 * u); g.quadraticCurveTo(8 * u, -28 * u, 2 * u, -34 * u); g.stroke();
      circle(g, 2 * u, -34 * u, (3 + Math.sin(now / 90) * 1.2) * u, '#fde047');
      g.restore(); break;
    }
    case 'barong': { // golden Barong mask
      const pulse = 0.5 + 0.5 * Math.sin(now / 500);
      const glow = g.createRadialGradient(0, 0, 4 * u, 0, 0, 52 * u); glow.addColorStop(0, 'rgba(253,224,71,' + (0.4 + pulse * 0.3) + ')'); glow.addColorStop(1, 'rgba(253,224,71,0)'); g.fillStyle = glow; g.fillRect(-52 * u, -52 * u, 104 * u, 104 * u);
      g.beginPath(); for (let i = 0; i < 14; i++) { const an = -Math.PI + i * Math.PI / 13, r = (i % 2 ? 38 : 30) * u; g.lineTo(Math.cos(an) * r, Math.sin(an) * r - 4 * u); } g.closePath(); g.fillStyle = '#b91c1c'; g.fill();
      rr(g, -26 * u, -24 * u, 52 * u, 50 * u, 18 * u); g.fillStyle = '#f59e0b'; g.fill(); g.lineWidth = 2.5 * u; g.strokeStyle = '#92400e'; g.stroke();
      circle(g, -11 * u, -6 * u, 8 * u, '#fff', '#92400e', 2 * u); circle(g, 11 * u, -6 * u, 8 * u, '#fff', '#92400e', 2 * u);
      const ex = Math.cos(a) * 2.5 * u, ey = Math.sin(a) * 2.5 * u; circle(g, -11 * u + ex, -6 * u + ey, 4 * u, '#dc2626'); circle(g, 11 * u + ex, -6 * u + ey, 4 * u, '#dc2626');
      rr(g, -16 * u, 8 * u, 32 * u, 12 * u, 5 * u); g.fillStyle = '#7f1d1d'; g.fill();
      g.fillStyle = '#fff'; for (let i = -2; i <= 2; i++) g.fillRect((i * 6 - 2) * u, 8 * u, 4 * u, 5 * u);
      g.fillStyle = '#16a34a'; for (const sx of [-1, 1]) { g.beginPath(); g.moveTo(sx * 20 * u, -24 * u); g.lineTo(sx * 30 * u, -40 * u); g.lineTo(sx * 10 * u, -26 * u); g.fill(); }
      break;
    }
  }
  g.restore();
}
/** platform under a tower: owner colour ring; looks richer per level (wood → stone + pennant → gold) */
function towerBase(g, x, y, cs, lvl, col, mine, now) {
  const r = cs * 0.43;
  ell(g, x, y + cs * 0.06, r, r * 0.92, 'rgba(0,0,0,.25)');
  circle(g, x, y, r * 0.98, lvl > 1 ? '#a8a29e' : lvl ? '#9ca3af' : '#8b5a2b');
  if (lvl) { g.strokeStyle = 'rgba(55,65,81,.55)'; g.lineWidth = Math.max(1, cs * 0.02); for (let i = 0; i < 6; i++) { const an = i / 6 * TAU; g.beginPath(); g.moveTo(x + Math.cos(an) * r * 0.62, y + Math.sin(an) * r * 0.62); g.lineTo(x + Math.cos(an) * r * 0.96, y + Math.sin(an) * r * 0.96); g.stroke(); } circle(g, x, y, r * 0.62, '#78716c'); }
  else { g.strokeStyle = 'rgba(60,35,15,.5)'; g.lineWidth = Math.max(1, cs * 0.02); for (let i = -1; i <= 1; i++) { g.beginPath(); g.moveTo(x - r * 0.8, y + i * r * 0.4); g.lineTo(x + r * 0.8, y + i * r * 0.4); g.stroke(); } }
  g.lineWidth = Math.max(2, cs * (mine ? 0.085 : 0.06)); g.strokeStyle = col; g.beginPath(); g.arc(x, y, r, 0, TAU); g.stroke();
  if (lvl > 1) { g.save(); g.globalAlpha = 0.5 + 0.3 * Math.sin(now / 400 + x); g.strokeStyle = '#fde047'; g.lineWidth = Math.max(1.5, cs * 0.035); g.beginPath(); g.arc(x, y, r + cs * 0.05, 0, TAU); g.stroke(); g.restore(); }
  if (lvl) { const fx = x + r * 0.72, fy = y - r * 0.7, wv = Math.sin(now / 220 + x) * cs * 0.03; g.strokeStyle = '#3f2a14'; g.lineWidth = Math.max(1, cs * 0.025); g.beginPath(); g.moveTo(fx, fy + cs * 0.22); g.lineTo(fx, fy - cs * 0.12); g.stroke(); g.beginPath(); g.moveTo(fx, fy - cs * 0.12); g.lineTo(fx + cs * 0.2, fy - cs * 0.07 + wv); g.lineTo(fx, fy - cs * 0.01); g.closePath(); g.fillStyle = col; g.fill(); }
}
/* ---------- monsters: animated (walk bob, pocong hops, kuntilanak floats), flip to face travel ---------- */
function monsterArt(g, k, x, y, s, now, st) {
  st = st || {}; const u = s / 100, id = st.id || 0, frozen = st.fz, t = frozen ? 0 : now;
  const walk = Math.sin(t / 110 + id), bob = Math.abs(walk) * 2.6 * u;
  g.save(); g.translate(x, y);
  if (k !== 'kuntilanak') ell(g, 0, 18 * u, 16 * u * (k === 'genderuwo' ? 1.6 : k === 'ratu' ? 1.8 : 1) * (k === 'pocong' ? 1 - (st.hop || 0) * 0.35 : 1), 5 * u, 'rgba(0,0,0,.3)');
  if (st.flip) g.scale(-1, 1);
  switch (k) {
    case 'tuyul': {
      g.translate(0, -bob); const sq = 1 + walk * 0.04; g.scale(1 / sq, sq);
      g.strokeStyle = '#7d9a7e'; g.lineWidth = 4 * u; g.lineCap = 'round'; g.beginPath(); g.moveTo(-5 * u, 14 * u); g.lineTo(-5 * u + walk * 4 * u, 21 * u); g.moveTo(5 * u, 14 * u); g.lineTo(5 * u - walk * 4 * u, 21 * u); g.stroke();
      ell(g, 0, 8 * u, 11 * u, 10 * u, '#9fb8a0'); circle(g, 0, -6 * u, 14 * u, '#b5ccb3', '#5f7a60', 1.5 * u);
      circle(g, -5 * u + 2 * u, -7 * u, 4 * u, '#fff'); circle(g, 5 * u + 2 * u, -7 * u, 4 * u, '#fff'); circle(g, -5 * u + 3 * u, -7 * u, 2 * u, '#111'); circle(g, 5 * u + 3 * u, -7 * u, 2 * u, '#111');
      g.strokeStyle = '#5f7a60'; g.lineWidth = 1.5 * u; g.beginPath(); g.arc(2 * u, 0, 5 * u, 0.2, Math.PI - 0.2); g.stroke();
      ell(g, -14 * u, -6 * u, 3 * u, 5 * u, '#b5ccb3'); ell(g, 14 * u, -6 * u, 3 * u, 5 * u, '#b5ccb3');
      ell(g, 10 * u, 10 * u, 5 * u, 4 * u, '#d4a017'); // sack of stolen coins
      break;
    }
    case 'pocong': {
      const h = (st.hop || 0) * 13 * u, sq = st.hop ? 1 + st.hop * 0.08 : 1 - Math.max(0, 0.08 - (st.land || 0) * 0.08); g.translate(0, -h); g.scale(1 / sq, sq);
      g.beginPath(); g.moveTo(-10 * u, -16 * u); g.quadraticCurveTo(-15 * u, 6 * u, -9 * u, 20 * u); g.lineTo(9 * u, 20 * u); g.quadraticCurveTo(15 * u, 6 * u, 10 * u, -16 * u); g.closePath(); g.fillStyle = '#f5f5f4'; g.fill(); g.lineWidth = 1.5 * u; g.strokeStyle = '#a8a29e'; g.stroke();
      circle(g, 0, -16 * u, 11 * u, '#f5f5f4', '#a8a29e', 1.5 * u); ell(g, 1.5 * u, -15 * u, 7 * u, 7.5 * u, '#3f3f46');
      circle(g, -1 * u, -16 * u, 1.6 * u, '#fde047'); circle(g, 4 * u, -16 * u, 1.6 * u, '#fde047');
      g.strokeStyle = '#a8a29e'; g.lineWidth = 2 * u; g.beginPath(); g.moveTo(-4 * u, -28 * u); g.lineTo(0, -25 * u); g.lineTo(4 * u, -28 * u); g.stroke(); g.beginPath(); g.moveTo(-8 * u, 12 * u); g.lineTo(8 * u, 12 * u); g.stroke();
      break;
    }
    case 'kuntilanak': {
      const fl = Math.sin(t / 420 + id) * 5 * u; g.translate(0, -12 * u + fl); ell(g, 0, 34 * u - fl, 12 * u, 4 * u, 'rgba(0,0,0,.18)');
      const sway = Math.sin(t / 260 + id) * 4 * u;
      g.beginPath(); g.moveTo(-8 * u, -8 * u); g.lineTo(-17 * u + sway, 20 * u); for (let i = 0; i < 5; i++) g.lineTo((-17 + i * 8.5 + 4) * u + sway, (24 - ((i + Math.floor(t / 150)) % 2) * 5) * u); g.lineTo(17 * u + sway, 20 * u); g.lineTo(8 * u, -8 * u); g.closePath(); g.fillStyle = 'rgba(248,250,252,.9)'; g.fill();
      g.fillStyle = '#111827'; g.beginPath(); g.moveTo(-11 * u, -14 * u); g.quadraticCurveTo(-17 * u + sway * 0.6, 6 * u, -13 * u + sway, 16 * u); g.lineTo(13 * u + sway, 16 * u); g.quadraticCurveTo(17 * u + sway * 0.6, 6 * u, 11 * u, -14 * u); g.closePath(); g.fill();
      circle(g, 0, -14 * u, 10 * u, '#111827'); ell(g, 1 * u, -11 * u, 6 * u, 7 * u, '#e7e5e4');
      circle(g, -1.5 * u, -12 * u, 1.5 * u, '#dc2626'); circle(g, 3.5 * u, -12 * u, 1.5 * u, '#dc2626');
      g.strokeStyle = '#e7e5e4'; g.lineWidth = 3 * u; g.lineCap = 'round'; g.beginPath(); g.moveTo(-9 * u, -2 * u); g.lineTo(-18 * u, 4 * u + sway * 0.5); g.moveTo(9 * u, -2 * u); g.lineTo(18 * u, 4 * u - sway * 0.5); g.stroke();
      break;
    }
    case 'genderuwo': {
      const stomp = Math.max(0, Math.sin(t / 220 + id)); g.translate(0, -stomp * 3 * u); g.rotate(Math.sin(t / 220 + id) * 0.05);
      ell(g, 0, 0, 22 * u, 22 * u, '#3b2a1d'); for (let i = 0; i < 12; i++) { const a = i / 12 * TAU + Math.sin(t / 400) * 0.05; ell(g, Math.cos(a) * 19 * u, Math.sin(a) * 19 * u, 6 * u, 6 * u, '#4a3526'); }
      circle(g, -5 * u, -6 * u, 4 * u, '#fca5a5'); circle(g, 9 * u, -6 * u, 4 * u, '#fca5a5'); circle(g, -4 * u, -6 * u, 2.2 * u, '#dc2626'); circle(g, 10 * u, -6 * u, 2.2 * u, '#dc2626');
      g.fillStyle = '#fff'; g.beginPath(); g.moveTo(-6 * u, 6 * u); g.lineTo(-3 * u, 12 * u); g.lineTo(0, 6 * u); g.moveTo(10 * u, 6 * u); g.lineTo(7 * u, 12 * u); g.lineTo(4 * u, 6 * u); g.fill();
      break;
    }
    case 'ratu': {
      g.translate(0, -bob * 0.6);
      const aura = g.createRadialGradient(0, 0, 6 * u, 0, 0, 44 * u); aura.addColorStop(0, 'rgba(16,185,129,.35)'); aura.addColorStop(1, 'rgba(16,185,129,0)'); g.fillStyle = aura; g.fillRect(-44 * u, -50 * u, 88 * u, 96 * u);
      const sw = Math.sin(t / 300 + id) * 3 * u;
      g.beginPath(); g.moveTo(-14 * u, -6 * u); g.lineTo(-30 * u + sw, 28 * u); g.lineTo(30 * u + sw, 28 * u); g.lineTo(14 * u, -6 * u); g.closePath(); g.fillStyle = '#065f46'; g.fill(); g.lineWidth = 2 * u; g.strokeStyle = '#fbbf24'; g.stroke();
      g.strokeStyle = '#fbbf24'; g.lineWidth = 2 * u; g.beginPath(); g.moveTo(-22 * u + sw * 0.5, 14 * u); g.lineTo(22 * u + sw * 0.5, 14 * u); g.stroke();
      circle(g, 0, -16 * u, 13 * u, '#fde7c8', '#92400e', 1.5 * u);
      g.fillStyle = '#111827'; g.beginPath(); g.arc(0, -18 * u, 14 * u, Math.PI, 0); g.lineTo(16 * u, 4 * u); g.lineTo(9 * u, -12 * u); g.lineTo(-9 * u, -12 * u); g.lineTo(-16 * u, 4 * u); g.closePath(); g.fill();
      circle(g, -3 * u, -15 * u, 2 * u, '#16a34a'); circle(g, 6 * u, -15 * u, 2 * u, '#16a34a');
      g.beginPath(); g.moveTo(-14 * u, -28 * u); g.lineTo(-14 * u, -40 * u); g.lineTo(-7 * u, -33 * u); g.lineTo(0, -44 * u); g.lineTo(7 * u, -33 * u); g.lineTo(14 * u, -40 * u); g.lineTo(14 * u, -28 * u); g.closePath(); g.fillStyle = '#fbbf24'; g.fill(); g.strokeStyle = '#92400e'; g.lineWidth = 1.5 * u; g.stroke();
      circle(g, 0, -35 * u, 2.5 * u, '#dc2626');
      break;
    }
  }
  g.restore();
  if (st.flash) { g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = st.flash * 0.8; ell(g, x, y - 4 * u - (k === 'kuntilanak' ? 12 * u : 0) - (k === 'pocong' ? (st.hop || 0) * 13 * u : 0), 17 * u * (k === 'genderuwo' ? 1.4 : 1), 22 * u, '#ffffff'); g.restore(); }
  if (frozen) { g.save(); g.globalAlpha = 0.55; ell(g, x, y - 2 * u, 20 * u, 24 * u, '#bae6fd'); g.globalAlpha = 0.9; g.strokeStyle = '#e0f2fe'; g.lineWidth = Math.max(1, 1.6 * u); for (let i = 0; i < 3; i++) { const a = i * Math.PI / 3; g.beginPath(); g.moveTo(x - Math.cos(a) * 10 * u, y - 20 * u - Math.sin(a) * 10 * u); g.lineTo(x + Math.cos(a) * 10 * u, y - 20 * u + Math.sin(a) * 10 * u); g.stroke(); } g.restore(); }
  else if (st.slow) { g.save(); g.globalAlpha = 0.7; g.strokeStyle = '#e5e7eb'; g.lineWidth = Math.max(1, 2 * u); g.setLineDash([3 * u, 3 * u]); g.lineDashOffset = -now / 40; g.beginPath(); g.ellipse(x, y + 16 * u, 18 * u, 6 * u, 0, 0, TAU); g.stroke(); g.restore(); }
}
const MON_SCALE = { tuyul: 0.42, pocong: 0.5, kuntilanak: 0.5, genderuwo: 0.6, ratu: 0.8 };
/* ---------- hero portraits ---------- */
const HERO_COL = { dukun: '#7c3aed', jawara: '#dc2626', juragan: '#d97706', pendekar: '#0f766e' };
function heroArt(g, h, x, y, s) {
  const u = s / 100; g.save(); g.translate(x, y);
  circle(g, 0, 0, 48 * u, HERO_COL[h] || '#555'); circle(g, 0, 0, 48 * u, null, 'rgba(255,255,255,.6)', 3 * u);
  g.save(); g.beginPath(); g.arc(0, 0, 46 * u, 0, TAU); g.clip();
  ell(g, 0, 52 * u, 34 * u, 26 * u, h === 'dukun' ? '#1f2937' : h === 'jawara' ? '#111827' : h === 'juragan' ? '#f8fafc' : '#1e293b'); // body
  circle(g, 0, 2 * u, 24 * u, '#d6a77a'); // face
  circle(g, -8 * u, 0, 3 * u, '#1f2937'); circle(g, 8 * u, 0, 3 * u, '#1f2937');
  switch (h) {
    case 'dukun': g.fillStyle = '#e5e7eb'; g.beginPath(); g.moveTo(-14 * u, 10 * u); g.quadraticCurveTo(0, 46 * u, 14 * u, 10 * u); g.quadraticCurveTo(0, 18 * u, -14 * u, 10 * u); g.fill(); rr(g, -26 * u, -26 * u, 52 * u, 16 * u, 6 * u); g.fillStyle = '#4c1d95'; g.fill(); g.fillStyle = '#a78bfa'; g.fillRect(-26 * u, -16 * u, 52 * u, 3 * u); circle(g, 26 * u, 26 * u, 6 * u, '#a5f3fc'); break;
    case 'jawara': g.fillStyle = '#dc2626'; g.fillRect(-26 * u, -16 * u, 52 * u, 9 * u); g.beginPath(); g.moveTo(22 * u, -14 * u); g.lineTo(38 * u, -22 * u); g.lineTo(36 * u, -8 * u); g.fill(); g.strokeStyle = '#111'; g.lineWidth = 4 * u; g.lineCap = 'round'; g.beginPath(); g.moveTo(-12 * u, 12 * u); g.quadraticCurveTo(0, 6 * u, 12 * u, 12 * u); g.stroke(); g.lineWidth = 3 * u; g.beginPath(); g.moveTo(-14 * u, -6 * u); g.lineTo(-4 * u, -3 * u); g.moveTo(14 * u, -6 * u); g.lineTo(4 * u, -3 * u); g.stroke(); break;
    case 'juragan': rr(g, -20 * u, -32 * u, 40 * u, 16 * u, 3 * u); g.fillStyle = '#111827'; g.fill(); g.strokeStyle = '#7c2d12'; g.lineWidth = 2.5 * u; g.beginPath(); g.arc(0, 10 * u, 8 * u, 0.2, Math.PI - 0.2); g.stroke(); circle(g, 24 * u, 28 * u, 10 * u, '#fbbf24', '#92400e', 2 * u); g.fillStyle = '#92400e'; g.font = '800 ' + 12 * u + 'px system-ui'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('$', 24 * u, 29 * u); break;
    case 'pendekar': g.fillStyle = '#111827'; g.beginPath(); g.arc(0, -4 * u, 26 * u, Math.PI, 0); g.fill(); g.fillStyle = '#0f766e'; g.fillRect(-26 * u, -10 * u, 52 * u, 6 * u); g.strokeStyle = '#111'; g.lineWidth = 3 * u; g.beginPath(); g.moveTo(-8 * u, 14 * u); g.lineTo(8 * u, 14 * u); g.stroke(); g.strokeStyle = '#e5e7eb'; g.lineWidth = 4 * u; g.beginPath(); g.moveTo(18 * u, 44 * u); g.lineTo(40 * u, 10 * u); g.stroke(); break;
  }
  g.restore(); g.restore();
}

/* ---------- map view ---------- */
class MapView {
  constructor(canvas, world) {
    this.c = canvas; this.g = canvas.getContext('2d'); this.world = world; this.cs = 0; this.dpr = 1; this.bg = null; this.colors = SEAT;
    this.proj = []; this.parts = []; this.texts = []; this.aim = new Map(); this.flash = new Map(); this.face = new Map(); this.shakeT = 0; this.shakeA = 0; this.bossT = 0; this.big = [];
    this.cap = 240; this.slowFrames = 0; this.lastNow = 0; this.ambient = [];
    this.reduced = !!(root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }
  resize(cs, n) {
    cs = Math.max(14, Math.floor(cs)); const dpr = Math.min(2.5, root.devicePixelRatio || 1);
    if (cs === this.cs && dpr === this.dpr && this.bg) return false;
    this.cs = cs; this.dpr = dpr; this.n = n; const W = this.world.W * cs, H = this.world.H * cs;
    this.c.width = Math.round(W * dpr); this.c.height = Math.round(H * dpr); this.c.style.width = W + 'px'; this.c.style.height = H + 'px';
    this.bg = this.paintStatic(); return true;
  }
  px(v) { return v * this.cs / BK.U; }
  cellPx(c) { const w = this.world; return [(c % w.W + 0.5) * this.cs, (Math.floor(c / w.W) + 0.5) * this.cs]; }
  cellAt(clientX, clientY) { const r = this.c.getBoundingClientRect(), x = Math.floor((clientX - r.left) / this.cs), y = Math.floor((clientY - r.top) / this.cs); return x >= 0 && y >= 0 && x < this.world.W && y < this.world.H ? y * this.world.W + x : -1; }
  /** reset transient effects (new game) */
  clear() { this.proj = []; this.parts = []; this.texts = []; this.aim.clear(); this.flash.clear(); this.big = []; this.shakeT = 0; this.c.style.transform = ''; }
  paintStatic() {
    const w = this.world, cs = this.cs, cv = document.createElement('canvas'); cv.width = this.c.width; cv.height = this.c.height;
    const g = cv.getContext('2d'); g.scale(this.dpr, this.dpr); const W = w.W * cs, H = w.H * cs;
    // grass: soft vertical light + per-cell variation + mottled patches
    const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#3f7d35'); gr.addColorStop(0.25, '#5a9a45'); gr.addColorStop(0.8, '#62a24b'); gr.addColorStop(1, '#558f40'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
    for (let y = 0; y < w.H; y++) for (let x = 0; x < w.W; x++) { const c = y * w.W + x; g.fillStyle = (x + y) % 2 ? 'rgba(0,0,0,.035)' : 'rgba(255,255,255,.03)'; g.fillRect(x * cs, y * cs, cs, cs); if (!w.pathCells.has(c) && !w.blocked.has(c)) { g.strokeStyle = 'rgba(255,255,255,.05)'; g.lineWidth = 1; g.strokeRect(x * cs + 0.5, y * cs + 0.5, cs - 1, cs - 1); } }
    for (let i = 0; i < 60; i++) { const x = hash(i * 3 + 1) * W, y = hash(i * 5 + 2) * H, r = cs * (0.3 + hash(i * 7) * 0.7); g.fillStyle = hash(i) < 0.5 ? 'rgba(120,180,80,.14)' : 'rgba(30,70,30,.12)'; g.beginPath(); g.ellipse(x, y, r, r * 0.6, hash(i * 9) * 3, 0, TAU); g.fill(); }
    for (let i = 0; i < w.W * w.H * 3; i++) {
      const c = Math.floor(hash(i * 7 + 3) * w.W * w.H); if (w.pathCells.has(c) || w.blocked.has(c)) continue;
      const x = (c % w.W + hash(i * 13) * 0.9 + 0.05) * cs, y = (Math.floor(c / w.W) + hash(i * 17) * 0.9 + 0.05) * cs, r = hash(i * 5);
      if (r < 0.08) { for (let p = 0; p < 5; p++) { const a = p / 5 * TAU; circle(g, x + Math.cos(a) * cs * 0.035, y + Math.sin(a) * cs * 0.035, cs * 0.028, hash(i) < 0.5 ? '#fde68a' : hash(i) < 0.75 ? '#fbcfe8' : '#ffffff'); } circle(g, x, y, cs * 0.02, '#f59e0b'); }
      else if (r < 0.13) { ell(g, x, y, cs * 0.05, cs * 0.035, '#9ca3af'); ell(g, x - cs * 0.01, y - cs * 0.01, cs * 0.03, cs * 0.018, '#d1d5db'); }
      else { g.strokeStyle = r < 0.5 ? 'rgba(30,70,30,.4)' : 'rgba(150,200,100,.35)'; g.lineWidth = Math.max(1, cs * 0.022); g.beginPath(); g.moveTo(x, y); g.lineTo(x - cs * 0.04, y - cs * 0.09); g.moveTo(x, y); g.lineTo(x, y - cs * 0.11); g.moveTo(x, y); g.lineTo(x + cs * 0.04, y - cs * 0.08); g.stroke(); }
    }
    // path: shadow, dark edge, packed dirt, wheel ruts, pebbles
    const L = w.segs[w.segs.length - 1], pts = w.segs.map(q => [this.px(q.x), this.px(q.y)]); pts.push([this.px(L.x + L.dx * L.len), this.px(L.y + L.dy * L.len)]);
    const line = (wd, col, dx, dy) => { g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(p[0] + (dx || 0), p[1] + (dy || 0)) : g.moveTo(p[0] + (dx || 0), p[1] + (dy || 0)))); g.lineWidth = wd; g.strokeStyle = col; g.lineJoin = 'round'; g.lineCap = 'butt'; g.stroke(); };
    line(cs * 1.0, 'rgba(0,0,0,.18)', 0, cs * 0.06); line(cs * 0.94, '#6b4a26'); line(cs * 0.84, '#c9a46a'); line(cs * 0.6, '#d8b77f');
    g.setLineDash([cs * 0.3, cs * 0.18]); line(cs * 0.05, 'rgba(120,85,45,.4)', cs * 0.18, 0); line(cs * 0.05, 'rgba(120,85,45,.4)', -cs * 0.18, 0); g.setLineDash([]);
    for (let i = 0; i < 160; i++) { const d = Math.floor(hash(i * 31 + 9) * w.len), [x, y] = BK.pos(w, d), o = (hash(i * 11) - 0.5) * 0.7 * BK.U; circle(g, this.px(x) + (i % 2 ? this.px(o) : 0), this.px(y) + (i % 2 ? 0 : this.px(o)), cs * (0.015 + hash(i) * 0.03), hash(i * 3) < 0.5 ? 'rgba(110,80,40,.45)' : 'rgba(240,220,180,.5)'); }
    // entrance: dark forest gradient, tall trees with hanging lanterns on the blocked cells
    const gx = pts[0][0];
    const grd = g.createLinearGradient(0, 0, 0, cs * 1.2); grd.addColorStop(0, 'rgba(8,18,12,.9)'); grd.addColorStop(1, 'rgba(8,18,12,0)'); g.fillStyle = grd; g.fillRect(gx - cs * 1.5, 0, cs * 3, cs * 1.2);
    const tree = (tx, ty, sc) => { g.fillStyle = '#4a2f17'; g.fillRect(tx - cs * 0.05 * sc, ty + cs * 0.15 * sc, cs * 0.1 * sc, cs * 0.3 * sc); for (let k = 0; k < 3; k++) { g.beginPath(); g.moveTo(tx - cs * (0.38 - k * 0.06) * sc, ty + cs * (0.25 - k * 0.2) * sc); g.lineTo(tx, ty - cs * (0.2 + k * 0.2) * sc); g.lineTo(tx + cs * (0.38 - k * 0.06) * sc, ty + cs * (0.25 - k * 0.2) * sc); g.closePath(); g.fillStyle = k % 2 ? '#2f6b2e' : '#24552a'; g.fill(); } };
    for (const c of w.blocked) { const x = (c % w.W + 0.5) * cs, y = Math.floor(c / w.W) * cs; if (y < H / 2) tree(x, y + cs * 0.45, 1.1); }
    for (let i = 0; i < w.W; i++) if (hash(i * 77) < 0.5) { const x = (i + 0.5) * cs, c = i; if (!w.pathCells.has(c) && !w.blocked.has(c)) { ell(g, x, cs * 0.06, cs * 0.3, cs * 0.14, 'rgba(25,60,25,.6)'); } }
    // fort at the exit: stone walls with crenellations on blocked cells, wooden gate
    for (const c of w.blocked) { const x = (c % w.W) * cs, y = Math.floor(c / w.W) * cs; if (y < H / 2) continue;
      g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(x + cs * 0.1, y + cs * 0.3, cs * 0.88, cs * 0.7);
      g.fillStyle = '#a8a29e'; g.fillRect(x + cs * 0.06, y + cs * 0.24, cs * 0.88, cs * 0.76); g.fillStyle = '#78716c'; for (let i = 0; i < 4; i++) g.fillRect(x + cs * (0.06 + i * 0.235), y + cs * 0.08, cs * 0.14, cs * 0.18);
      g.strokeStyle = 'rgba(68,64,60,.6)'; g.lineWidth = 1; for (let r = 0; r < 4; r++) { const yy = y + cs * (0.42 + r * 0.15); g.beginPath(); g.moveTo(x + cs * 0.06, yy); g.lineTo(x + cs * 0.94, yy); g.stroke(); for (let k = 0; k < 3; k++) { const xx = x + cs * (0.2 + k * 0.3 + (r % 2) * 0.15); g.beginPath(); g.moveTo(xx, yy); g.lineTo(xx, yy + cs * 0.15); g.stroke(); } }
    }
    const fx0 = gx, fy = (w.H - 1) * cs; g.fillStyle = '#57534e'; g.fillRect(fx0 - cs * 0.5, fy + cs * 0.12, cs, cs * 0.18); rr(g, fx0 - cs * 0.34, fy + cs * 0.3, cs * 0.68, cs * 0.7, cs * 0.12); g.fillStyle = '#7c2d12'; g.fill(); g.strokeStyle = '#451a03'; g.lineWidth = Math.max(1, cs * 0.03); g.beginPath(); g.moveTo(fx0, fy + cs * 0.3); g.lineTo(fx0, fy + cs); g.stroke(); circle(g, fx0 - cs * 0.08, fy + cs * 0.66, cs * 0.03, '#fbbf24'); circle(g, fx0 + cs * 0.08, fy + cs * 0.66, cs * 0.03, '#fbbf24');
    // vignette
    const vg = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.45, W / 2, H / 2, Math.max(W, H) * 0.75); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.28)'); g.fillStyle = vg; g.fillRect(0, 0, W, H);
    return cv;
  }
  /* ----- effects engine ----- */
  part(p) { if (this.parts.length >= this.cap) this.parts.shift(); p.born = this.lastNow; this.parts.push(p); }
  text(x, y, label, color, size, life) { if (this.texts.length > 36) this.texts.shift(); this.texts.push({ x, y, label, color, size: size || 1, born: this.lastNow, life: life || 800 }); }
  shake(a, ms) { if (this.reduced) return; if (a >= this.shakeA || this.lastNow > this.shakeT) { this.shakeA = a; this.shakeT = this.lastNow + ms; this.shakeMs = ms; } }
  burst(x, y, n, col, sp, life, size, grav) { n = Math.ceil(n * (this.cap < 200 ? 0.5 : 1)); for (let i = 0; i < n; i++) { const a = R() * TAU, v = sp * (0.4 + R() * 0.8); this.part({ k: 'dot', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - sp * 0.3, g: grav == null ? sp * 1.6 : grav, life: life * (0.6 + R() * 0.6), r: size * (0.6 + R() * 0.7), col: Array.isArray(col) ? col[i % col.length] : col }); } }
  smoke(x, y, n, size, col) { for (let i = 0; i < n; i++) this.part({ k: 'smoke', x: x + (R() - 0.5) * size, y: y + (R() - 0.5) * size * 0.6, vx: (R() - 0.5) * size * 0.6, vy: -size * (0.3 + R() * 0.5), g: 0, life: 700 + R() * 500, r: size * (0.4 + R() * 0.4), col: col || '#e5e7eb' }); }
  ring(x, y, r, col, life, lw) { this.part({ k: 'ring', x, y, r, col, life: life || 400, lw: lw || 3, vx: 0, vy: 0, g: 0 }); }
  /** feed sim fx events (already de-duplicated by the app); s = current state for lookups */
  fx(list, s, now) {
    this.lastNow = now; const cs = this.cs, w = this.world, P = v => this.px(v);
    for (const f of list) {
      switch (f.t) {
        case 'shot': {
          const [x0, y0] = f.from.map(P), [x1, y1] = f.to.map(P), dist = Math.hypot(x1 - x0, y1 - y0), ang = Math.atan2(y1 - y0, x1 - x0);
          this.kick(f.c, ang, now);
          const dur = f.k === 'barong' ? 140 : f.k === 'petasan' ? Math.min(320, 120 + dist / cs * 50) : Math.min(240, 70 + dist / cs * 45);
          if (this.proj.length < 90) this.proj.push({ k: f.k, x0, y0, x1, y1, born: now, dur, n: f.n, combo: f.combo, i: f.i, l: f.l, curve: (R() - 0.5) * cs * 0.8 });
          break;
        }
        case 'boom': { const [x0, y0] = f.from.map(P), x1 = P(f.x), y1 = P(f.y), dist = Math.hypot(x1 - x0, y1 - y0); this.kick(f.c, Math.atan2(y1 - y0, x1 - x0), now); if (this.proj.length < 90) this.proj.push({ k: 'meriam', x0, y0, x1, y1, born: now, dur: Math.min(520, 220 + dist / cs * 60), n: f.n, combo: f.combo, r: P(f.r * 10), i: f.i, l: f.l, h: cs * (0.5 + dist / cs * 0.18) }); break; }
        case 'smoke': if (R() < 0.6) { const x = P(f.x), y = P(f.y); for (let i = 0; i < 2; i++) { const a = R() * TAU, d = P(f.r * 10) * (0.3 + R() * 0.6); this.part({ k: 'smoke', x: x + Math.cos(a) * d * 0.3, y: y + Math.sin(a) * d * 0.3, vx: Math.cos(a) * d * 1.2, vy: Math.sin(a) * d * 1.2, g: 0, life: 900, r: cs * 0.28, col: '#f3f4f6' }); } } break;
        case 'kill': {
          const x = P(f.x), y = P(f.y); this.burst(x, y, f.boss ? 40 : 10, f.k === 'kuntilanak' ? ['#f8fafc', '#e2e8f0', '#a5b4fc'] : f.k === 'ratu' ? ['#fbbf24', '#10b981', '#fff'] : ['#f8fafc', '#d1d5db', '#a3e635'], cs * (f.boss ? 4 : 2.2), 550, cs * 0.06);
          this.smoke(x, y, f.boss ? 8 : 2, cs * 0.5, 'rgba(203,213,225,.9)');
          this.part({ k: 'coin', x, y, vx: (R() - 0.5) * cs * 0.8, vy: -cs * 3.2, g: cs * 6, life: 650, r: cs * 0.11, col: '#fbbf24' });
          this.text(x, y - cs * 0.3, '+' + (f.per / 100).toFixed(f.per % 100 ? 1 : 0).replace('.', ','), '#fde047', f.boss ? 1.6 : 1, 900);
          if (f.boss) { this.shake(cs * 0.22, 600); this.ring(x, y, cs * 3, '#fde047', 700, 5); }
          break;
        }
        case 'built': { const [x, y] = this.cellPx(f.c); this.ring(x, y, cs * 0.8, '#fde047', 500, 3); this.burst(x, y + cs * 0.25, 10, ['#a16207', '#d6b37a', '#fde68a'], cs * 1.8, 450, cs * 0.05); if (f.k === 'barong') { this.ring(x, y, cs * 3, '#fde047', 900, 6); this.shake(cs * 0.12, 400); } break; }
        case 'up': { const [x, y] = this.cellPx(f.c); this.ring(x, y, cs * 0.9, '#fde047', 600, 4); for (let i = 0; i < 12; i++) this.part({ k: 'star', x: x + (R() - 0.5) * cs * 0.8, y: y + cs * 0.3, vx: 0, vy: -cs * (1 + R() * 1.5), g: 0, life: 700, r: cs * 0.06, col: '#fde047' }); break; }
        case 'sold': { const [x, y] = this.cellPx(f.c); this.smoke(x, y, 5, cs * 0.6, '#d6d3d1'); break; }
        case 'leak': { this.big.push({ k: 'leak', born: now, life: 500 }); this.shake(cs * 0.08, 250); break; }
        case 'hit': { const x = P(f.x), y = P(f.y); this.flash.set(f.i, now); this.text(x, y - cs * 0.4, String(f.n), '#fb7185', 1.5, 900); break; }
        case 'skill': this.skillFx(f, s, now); break;
        case 'sgFire': {
          this.big.push({ k: 'flash', born: now, life: 450 }); this.shake(cs * 0.3, 700);
          const W = w.W * cs, H = w.H * cs; for (let i = 0; i < 16; i++) { const x1 = R() * W, y1 = R() * H; this.proj.push({ k: 'rain', x0: x1 + (R() - 0.5) * cs * 2, y0: -cs, x1, y1, born: now + i * 40, dur: 380, n: 0 }); }
          for (const en of (s ? s.en : [])) { const [ex, ey] = BK.pos(w, en.d); this.flash.set(en.i, now + 300); this.text(P(ex), P(ey) - cs * 0.5, String(f.n), '#fde047', 1.4, 1100); }
          break;
        }
        case 'boss': this.bossT = now; this.shake(cs * 0.2, 900); break;
        case 'wave': this.big.push({ k: 'wave', born: now, life: 900 }); break;
        case 'deal': break;
      }
    }
  }
  skillFx(f, s, now) {
    const cs = this.cs, w = this.world, H = w.HR[f.h] || {}, x = this.px(f.x), y = this.px(f.y), r = this.px((H.r || 0) * 10);
    switch (f.h) {
      case 'dukun': this.ring(x, y, r, '#7dd3fc', 700, 6); this.big.push({ k: 'ice', x, y, r, born: now, life: (H.freeze || 60) * 50 }); for (let i = 0; i < 26; i++) { const a = R() * TAU, d = R() * r; this.part({ k: 'snow', x: x + Math.cos(a) * d, y: y + Math.sin(a) * d - cs * 0.5, vx: (R() - 0.5) * cs * 0.4, vy: cs * 0.6, g: 0, life: 1300, r: cs * 0.07, col: '#e0f2fe' }); } break;
      case 'jawara': this.ring(x, y, r, '#f87171', 600, 6); for (const t of (s ? s.tw : [])) if (t.rg > 0) { const [tx, ty] = this.cellPx(t.c); this.burst(tx, ty, 8, ['#f97316', '#ef4444', '#fde047'], cs * 1.8, 500, cs * 0.06, -cs * 2); } break;
      case 'juragan': { const W = w.W * cs; for (let i = 0; i < 26; i++) this.part({ k: 'coin', x: R() * W, y: -cs * R(), vx: 0, vy: cs * (2 + R() * 2), g: cs * 3, life: 1200, r: cs * 0.11, col: '#fbbf24' }); break; }
      case 'pendekar': this.big.push({ k: 'slash', x, y, born: now, life: 380 }); this.shake(cs * 0.14, 300); this.ring(x, y, r, '#5eead4', 450, 5); this.burst(x, y, 14, ['#fff', '#5eead4', '#fde047'], cs * 3, 450, cs * 0.07); break;
    }
  }
  kick(c, ang, now) { if (c == null) return; const a = this.aim.get(c) || { a: ang, to: ang, kick: 0 }; a.to = ang; a.kick = now; this.aim.set(c, a); }
  impact(p, now) {
    const cs = this.cs, x = p.x1, y = p.y1;
    if (p.i != null) this.flash.set(p.i, now);
    switch (p.k) {
      case 'ketapel': this.burst(x, y, 4, ['#9ca3af', '#6b7280'], cs * 1.6, 300, cs * 0.04); break;
      case 'petasan': this.burst(x, y, 12, ['#ef4444', '#fde047', '#22d3ee', '#f472b6', '#a3e635'], cs * 2.6, 500, cs * 0.05, cs * 0.8); this.ring(x, y, cs * 0.6, '#fde047', 250, 2); break;
      case 'barong': this.burst(x, y, 8, ['#fde047', '#f59e0b', '#fff'], cs * 2.4, 400, cs * 0.06); break;
      case 'meriam': { this.big.push({ k: 'boom', x, y, r: p.r || cs, born: now, life: 420 }); this.smoke(x, y, 3, cs * 0.6, 'rgba(120,113,108,.85)'); this.burst(x, y, 10, ['#f97316', '#fbbf24', '#78350f'], cs * 3, 500, cs * 0.06); this.shake(cs * 0.04, 120); break; }
      case 'rain': this.burst(x, y, 10, ['#ef4444', '#fde047', '#22d3ee', '#f472b6'], cs * 3, 600, cs * 0.06, cs); this.ring(x, y, cs * 0.9, '#fff', 300, 3); return;
    }
    if (p.n) this.text(x + (R() - 0.5) * cs * 0.3, y - cs * 0.35, String(p.n), p.combo ? '#fde047' : '#ffffff', p.combo ? 1.15 : p.k === 'meriam' ? 1.1 : 0.9, 650);
    if (p.combo) this.text(x + cs * 0.3, y - cs * 0.6, '✦', '#fde047', 1, 500);
  }
  /* ----- frame ----- */
  draw(v) {
    const g = this.g, cs = this.cs, w = this.world, s = v.s, now = v.now; if (!this.bg) return;
    // adaptive quality: halve the particle cap when frames are slow
    const dt = now - (this.lastNow || now); this.lastNow = now;
    if (dt > 26) { if (++this.slowFrames > 40 && this.cap > 110) { this.cap = 110; } } else this.slowFrames = Math.max(0, this.slowFrames - 1);
    // screen shake via CSS transform (no repaint of the static layer)
    if (now < this.shakeT) { const k = (this.shakeT - now) / (this.shakeMs || 300), a = this.shakeA * k; this.c.style.transform = 'translate(' + ((R() - 0.5) * 2 * a).toFixed(1) + 'px,' + ((R() - 0.5) * 2 * a).toFixed(1) + 'px)'; this.shook = true; }
    else if (this.shook) { this.c.style.transform = ''; this.shook = false; }
    g.setTransform(1, 0, 0, 1, 0, 0); g.drawImage(this.bg, 0, 0); g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.ambientDraw(g, now);
    if (!s) return;
    const outline = (c, col, dash) => { if (c == null || c < 0) return; g.save(); if (dash) { g.setLineDash([cs * 0.12, cs * 0.08]); g.lineDashOffset = -now / 60; } g.strokeStyle = col; g.lineWidth = Math.max(2, cs * 0.06); rr(g, (c % w.W) * cs + 2, Math.floor(c / w.W) * cs + 2, cs - 4, cs - 4, cs * 0.14); g.stroke(); g.restore(); };
    if (v.hover != null && v.hover >= 0) { outline(v.hover, v.hoverOk ? 'rgba(255,255,255,.85)' : 'rgba(239,68,68,.85)', true); if (v.hoverOk) { g.fillStyle = 'rgba(255,255,255,.1)'; g.fillRect((v.hover % w.W) * cs, Math.floor(v.hover / w.W) * cs, cs, cs); } }
    const ring = (c, r, col) => { const [x, y] = BK.cellXY(w, c); g.beginPath(); g.arc(this.px(x), this.px(y), r / 100 * cs, 0, TAU); g.fillStyle = col + '22'; g.fill(); g.lineWidth = Math.max(1.5, cs * 0.04); g.strokeStyle = col + 'cc'; g.setLineDash([cs * 0.1, cs * 0.08]); g.stroke(); g.setLineDash([]); };
    if (v.preview) ring(v.preview.c, v.preview.r, '#ffffff');
    // lingering area effects under units
    for (const b of this.big) if (b.k === 'ice' && now - b.born < b.life) { const k = (now - b.born) / b.life; g.save(); g.globalAlpha = 0.28 * (1 - k * k); circle(g, b.x, b.y, b.r, '#bae6fd'); g.globalAlpha = 0.5 * (1 - k); g.strokeStyle = '#e0f2fe'; g.lineWidth = 2; g.setLineDash([cs * 0.1, cs * 0.1]); g.beginPath(); g.arc(b.x, b.y, b.r, 0, TAU); g.stroke(); g.restore(); }
    // foundations (Barong patungan)
    for (const f of s.fd) { const x = (f.c % w.W) * cs, y = Math.floor(f.c / w.W) * cs; g.save(); g.setLineDash([cs * 0.1, cs * 0.07]); g.lineDashOffset = -now / 50; g.strokeStyle = '#fde047'; g.lineWidth = Math.max(1.5, cs * 0.05); g.strokeRect(x + cs * 0.1, y + cs * 0.1, cs * 0.8, cs * 0.8); g.restore(); g.globalAlpha = 0.45 + 0.15 * Math.sin(now / 300); towerArt(g, 'barong', x + cs / 2, y + cs * 0.45, cs * 0.75, 0, now); g.globalAlpha = 1; const fr = Math.min(1, f.tot / w.eco.barongCost); g.fillStyle = 'rgba(0,0,0,.55)'; g.fillRect(x + cs * 0.12, y + cs * 0.78, cs * 0.76, cs * 0.12); g.fillStyle = '#fde047'; g.fillRect(x + cs * 0.12, y + cs * 0.78, cs * 0.76 * fr, cs * 0.12); }
    // monster positions (interpolated between ticks)
    const P = new Map(), prev = v.prev ? new Map(v.prev) : null;
    for (const e of s.en) { let d = e.d; if (prev && prev.has(e.i)) { const d0 = prev.get(e.i); d = d0 + (e.d - d0) * v.alpha; } P.set(e.i, [BK.pos(w, Math.max(0, d)), d]); }
    // towers: turn smoothly toward the last target (idle: gentle sway)
    for (const t of s.tw) {
      const [x, y] = this.cellPx(t.c), p = s.pl.find(q => q.id === t.o), col = p ? this.colors[p.s] : '#fff';
      towerBase(g, x, y, cs, t.l, col, v.me != null && t.o === v.me, now);
      if (t.rg > 0) { g.save(); g.globalAlpha = 0.35 + 0.25 * Math.sin(now / 80); circle(g, x, y, cs * 0.5, null, '#f97316', Math.max(2, cs * 0.08)); g.restore(); if (R() < 0.25) this.part({ k: 'dot', x: x + (R() - 0.5) * cs * 0.6, y: y + cs * 0.2, vx: 0, vy: -cs * 1.6, g: 0, life: 450, r: cs * 0.05, col: R() < 0.5 ? '#f97316' : '#fde047' }); }
      let a = this.aim.get(t.c), aimA = -Math.PI / 2 + Math.sin(now / 900 + t.c) * 0.25, kick = 0;
      if (a) { a.a = lerpA(a.a, a.to, Math.min(1, dt / 70)); aimA = a.a; kick = Math.max(0, 1 - (now - a.kick) / 160); if (now - a.kick > 2500) { a.to = lerpA(a.to, -Math.PI / 2, 0.02); } }
      const bob = this.reduced ? 0 : Math.sin(now / 520 + t.c * 1.7) * cs * 0.018, breathe = 1 + (this.reduced ? 0 : Math.sin(now / 700 + t.c) * 0.015);
      towerArt(g, t.k, x, y - cs * 0.04 + bob, (t.k === 'barong' ? cs * 0.95 : cs * 0.8) * (1 + t.l * 0.06) * breathe, t.l, now, aimA, kick);
      if (!this.reduced && this.parts.length < this.cap * 0.6) {
        if (t.k === 'sate' && R() < 0.02) this.part({ k: 'smoke', x: x + (R() - 0.5) * cs * 0.3, y: y - cs * 0.2, vx: 0, vy: -cs * 0.5, g: 0, life: 900, r: cs * 0.07, col: 'rgba(250,250,249,.7)' });
        else if (t.k === 'petasan' && R() < 0.025) this.part({ k: 'dot', x: x + cs * 0.12, y: y - cs * 0.34, vx: (R() - 0.5) * cs, vy: -cs * 0.8, g: cs * 2, life: 300, r: cs * 0.03, col: R() < 0.5 ? '#fde047' : '#fb923c' });
        else if (t.k === 'kentongan' && (Math.floor(now / 1700) + t.c) % 3 === 0 && (now % 1700) < dt) this.ring(x, y, cs * 1.4, 'rgba(253,224,71,.8)', 800, 2);
      }
      if (t.l > 0) for (let i = 0; i < t.l; i++) { const px = x - cs * 0.36 + i * cs * 0.16, py = y + cs * 0.36; g.beginPath(); for (let j = 0; j < 10; j++) { const an = -Math.PI / 2 + j * Math.PI / 5, r = j % 2 ? cs * 0.035 : cs * 0.075; g.lineTo(px + Math.cos(an) * r, py + Math.sin(an) * r); } g.closePath(); g.fillStyle = '#fde047'; g.fill(); g.lineWidth = Math.max(1, cs * 0.015); g.strokeStyle = '#a16207'; g.stroke(); }
    }
    if (v.selTower) { const t = s.tw.find(x => x.i === v.selTower); if (t) { ring(t.c, BK.range(w, s, t.k, t.l), '#fde047'); outline(t.c, '#fde047'); } }
    if (v.sel != null && v.sel >= 0) outline(v.sel, '#ffffff');
    if (v.skillAim) { const sa = v.skillAim; if (sa.c >= 0) { const [x, y] = this.cellPx(sa.c); g.save(); g.globalAlpha = 0.25 + 0.1 * Math.sin(now / 120); circle(g, x, y, this.px(sa.r * 10), sa.color); g.globalAlpha = 0.9; g.strokeStyle = sa.color; g.lineWidth = 3; g.setLineDash([cs * 0.15, cs * 0.1]); g.lineDashOffset = -now / 30; g.beginPath(); g.arc(x, y, this.px(sa.r * 10), 0, TAU); g.stroke(); g.restore(); } }
    // monsters (depth-sorted)
    const list = s.en.map(e => ({ e, p: P.get(e.i)[0], d: P.get(e.i)[1] })).sort((a, b) => a.p[1] - b.p[1]);
    for (const { e, p, d } of list) {
      const x = this.px(p[0]), y = this.px(p[1]), sc = cs * (MON_SCALE[e.k] || 0.5) * 2, M = w.M[e.k];
      const [dx] = BK.dirAt(w, d); let flip = this.face.get(e.i); if (dx) { flip = dx < 0; this.face.set(e.i, flip); }
      let hop = 0, land = 0; if (M.hop && !e.fz) { const ph = ((s.t + (v.alpha || 0) + e.i * 3) % 10); if (ph < 6) hop = Math.sin(ph / 6 * Math.PI); else land = 1 - (ph - 6) / 4; }
      const fl = this.flash.get(e.i), flash = fl != null && now >= fl && now - fl < 110 ? 1 - (now - fl) / 110 : 0;
      monsterArt(g, e.k, x, y - flash * cs * 0.05, sc * (1 + flash * 0.14), now, { id: e.i, flip, hop, land, flash, fz: e.fz > 0, slow: e.sl > 0 });
      if (M.fly && R() < 0.08 && this.parts.length < this.cap * 0.7) this.part({ k: 'smoke', x: x + (R() - 0.5) * sc * 0.3, y: y + sc * 0.1, vx: 0, vy: cs * 0.2, g: 0, life: 600, r: sc * 0.12, col: 'rgba(241,245,249,.6)' });
      if (e.hp < e.mx) { const bw = Math.max(cs * 0.55, sc * 0.6), f = Math.max(0, e.hp / e.mx), bh = Math.max(3, cs * 0.07), by = y - sc * 0.55 - (e.k === 'kuntilanak' ? sc * 0.1 : 0); g.fillStyle = 'rgba(0,0,0,.65)'; g.fillRect(x - bw / 2 - 1, by - 1, bw + 2, bh + 2); g.fillStyle = f > 0.5 ? '#22c55e' : f > 0.25 ? '#facc15' : '#ef4444'; g.fillRect(x - bw / 2, by, bw * f, bh); }
    }
    if (this.flash.size > 200) for (const [k, t0] of this.flash) if (now - t0 > 500) this.flash.delete(k);
    if (this.face.size > 300) this.face.clear();
    // projectiles
    this.proj = this.proj.filter(p => {
      const k = (now - p.born) / p.dur; if (k < 0) return true; if (k >= 1) { this.impact(p, now); return false; }
      let x = p.x0 + (p.x1 - p.x0) * k, y = p.y0 + (p.y1 - p.y0) * k;
      switch (p.k) {
        case 'ketapel': circle(g, x, y, cs * (0.055 + p.l * 0.01), '#9ca3af', '#374151', 1); g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = cs * 0.04; g.beginPath(); g.moveTo(x, y); g.lineTo(x - (p.x1 - p.x0) * 0.12, y - (p.y1 - p.y0) * 0.12); g.stroke(); break;
        case 'meriam': { const h = Math.sin(k * Math.PI) * p.h; ell(g, x, y, cs * 0.08, cs * 0.04, 'rgba(0,0,0,.3)'); circle(g, x, y - h, cs * (0.1 + p.l * 0.015), '#3f3f46', '#a3b13a', Math.max(1, cs * 0.03)); if (R() < 0.5) this.part({ k: 'smoke', x, y: y - h, vx: 0, vy: -cs * 0.2, g: 0, life: 350, r: cs * 0.08, col: 'rgba(214,211,209,.8)' }); break; }
        case 'petasan': { const off = Math.sin(k * Math.PI) * p.curve, nx = -(p.y1 - p.y0), ny = p.x1 - p.x0, nl = Math.hypot(nx, ny) || 1; x += nx / nl * off; y += ny / nl * off; circle(g, x, y, cs * 0.06, '#ef4444'); if (R() < 0.8) this.part({ k: 'dot', x, y, vx: (R() - 0.5) * cs, vy: (R() - 0.5) * cs, g: 0, life: 220, r: cs * 0.035, col: R() < 0.5 ? '#fde047' : '#fb923c' }); break; }
        case 'barong': { g.save(); g.globalCompositeOperation = 'lighter'; g.strokeStyle = 'rgba(253,224,71,.85)'; g.lineWidth = Math.max(2, cs * 0.1); g.lineCap = 'round'; g.beginPath(); g.moveTo(p.x0 + (p.x1 - p.x0) * Math.max(0, k - 0.5), p.y0 + (p.y1 - p.y0) * Math.max(0, k - 0.5)); g.lineTo(x, y); g.stroke(); circle(g, x, y, cs * 0.13, 'rgba(255,237,160,.9)'); g.restore(); break; }
        case 'rain': { g.strokeStyle = '#fde047'; g.lineWidth = Math.max(2, cs * 0.06); g.beginPath(); g.moveTo(x, y); g.lineTo(x - (p.x1 - p.x0) * 0.1, y - cs * 0.6); g.stroke(); circle(g, x, y, cs * 0.08, '#fff'); break; }
      }
      return true;
    });
    // particles
    const dts = Math.min(50, dt) / 1000;
    this.parts = this.parts.filter(p => {
      const k = (now - p.born) / p.life; if (k >= 1) return false;
      p.vy += p.g * dts; p.x += p.vx * dts; p.y += p.vy * dts; if (p.k === 'smoke') { p.vx *= 0.96; p.vy *= 0.96; }
      g.globalAlpha = p.k === 'smoke' ? 0.55 * (1 - k) : 1 - k * k;
      switch (p.k) {
        case 'dot': circle(g, p.x, p.y, p.r * (1 - k * 0.5), p.col); break;
        case 'smoke': circle(g, p.x, p.y, p.r * (0.6 + k * 0.9), p.col); break;
        case 'ring': g.strokeStyle = p.col; g.lineWidth = p.lw * (1 - k) + 0.5; g.beginPath(); g.arc(p.x, p.y, p.r * (0.2 + k * 0.8), 0, TAU); g.stroke(); break;
        case 'coin': { const sx = Math.abs(Math.cos(now / 70 + p.x)); ell(g, p.x, p.y, p.r * Math.max(0.25, sx), p.r, p.col); g.strokeStyle = '#92400e'; g.lineWidth = 1; g.beginPath(); g.ellipse(p.x, p.y, p.r * Math.max(0.25, sx), p.r, 0, 0, TAU); g.stroke(); break; }
        case 'star': { g.fillStyle = p.col; g.beginPath(); for (let j = 0; j < 8; j++) { const an = j * Math.PI / 4, r = j % 2 ? p.r * 0.4 : p.r; g.lineTo(p.x + Math.cos(an) * r, p.y + Math.sin(an) * r); } g.fill(); break; }
        case 'snow': { g.strokeStyle = p.col; g.lineWidth = 1.5; for (let j = 0; j < 3; j++) { const an = j * Math.PI / 3 + k * 2; g.beginPath(); g.moveTo(p.x - Math.cos(an) * p.r, p.y - Math.sin(an) * p.r); g.lineTo(p.x + Math.cos(an) * p.r, p.y + Math.sin(an) * p.r); g.stroke(); } break; }
      }
      return true;
    });
    g.globalAlpha = 1;
    // big one-off effects
    this.big = this.big.filter(b => {
      const k = (now - b.born) / b.life; if (k >= 1) return false; if (k < 0) return true;
      if (b.k === 'boom') { const r = b.r * (0.35 + k * 0.75); g.save(); g.globalAlpha = 1 - k; const gr = g.createRadialGradient(b.x, b.y, 0, b.x, b.y, r); gr.addColorStop(0, 'rgba(255,251,235,.95)'); gr.addColorStop(0.35, 'rgba(251,191,36,.8)'); gr.addColorStop(0.75, 'rgba(234,88,12,.45)'); gr.addColorStop(1, 'rgba(234,88,12,0)'); g.fillStyle = gr; g.beginPath(); g.arc(b.x, b.y, r, 0, TAU); g.fill(); g.restore(); }
      else if (b.k === 'leak') { g.fillStyle = 'rgba(239,68,68,' + 0.35 * (1 - k) + ')'; g.fillRect(0, (w.H - 2) * cs, w.W * cs, 2 * cs); }
      else if (b.k === 'flash') { g.fillStyle = 'rgba(255,250,220,' + 0.55 * (1 - k) + ')'; g.fillRect(0, 0, w.W * cs, w.H * cs); }
      else if (b.k === 'slash') { g.save(); g.globalAlpha = 1 - k; g.strokeStyle = '#fff'; g.lineCap = 'round'; g.lineWidth = Math.max(3, cs * 0.12) * (1 - k); const L = cs * 1.2; for (const sg of [-1, 1]) { g.beginPath(); g.moveTo(b.x - L, b.y + sg * L * 0.6 * (1 - k * 0.3)); g.lineTo(b.x + L, b.y - sg * L * 0.6 * (1 - k * 0.3)); g.stroke(); } g.restore(); }
      else if (b.k === 'wave') { g.fillStyle = 'rgba(0,0,0,' + 0.18 * Math.sin(k * Math.PI) + ')'; g.fillRect(0, 0, w.W * cs, cs * 1.5); }
      return true;
    });
    // boss arrival: red pulsing vignette for 2.5 s
    if (now - this.bossT < 2500) { const k = (now - this.bossT) / 2500, W = w.W * cs, H = w.H * cs; g.save(); g.globalAlpha = (1 - k) * (0.5 + 0.5 * Math.sin(now / 90)); const vg = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.7); vg.addColorStop(0, 'rgba(220,38,38,0)'); vg.addColorStop(1, 'rgba(220,38,38,.55)'); g.fillStyle = vg; g.fillRect(0, 0, W, H); g.restore(); }
    // tutorial guide: animated chevrons along the path, pulsing target cells with a bouncing arrow
    const gd = v.guide;
    if (gd) {
      if (gd.path) { g.save(); g.fillStyle = 'rgba(253,224,71,.95)'; g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 1.5; const step = BK.U * 0.9, off = (now / 1000 * BK.U * 2.2) % step;
        for (let d = off; d < w.len; d += step) { const [px, py] = BK.pos(w, d), [dx, dy] = BK.dirAt(w, d), X = this.px(px), Y = this.px(py), a = Math.atan2(dy, dx), r = cs * 0.2, fade = Math.min(1, d / (BK.U * 2), (w.len - d) / (BK.U * 2)); if (fade <= 0) continue; g.globalAlpha = 0.9 * fade; g.beginPath(); g.moveTo(X + Math.cos(a) * r, Y + Math.sin(a) * r); g.lineTo(X + Math.cos(a + 2.4) * r, Y + Math.sin(a + 2.4) * r); g.lineTo(X + Math.cos(a) * r * 0.1, Y + Math.sin(a) * r * 0.1); g.lineTo(X + Math.cos(a - 2.4) * r, Y + Math.sin(a - 2.4) * r); g.closePath(); g.fill(); g.stroke(); }
        g.restore(); }
      for (const c of gd.cells || []) { if (c == null || c < 0) continue; const x = (c % w.W) * cs, y = Math.floor(c / w.W) * cs, p = 0.5 + 0.5 * Math.sin(now / 180); g.save(); g.fillStyle = 'rgba(253,224,71,' + (0.18 + 0.22 * p) + ')'; g.fillRect(x, y, cs, cs); g.strokeStyle = '#fde047'; g.lineWidth = Math.max(2, cs * 0.08); g.setLineDash([cs * 0.14, cs * 0.08]); g.lineDashOffset = -now / 40; rr(g, x + 2, y + 2, cs - 4, cs - 4, cs * 0.16); g.stroke(); g.restore();
        const ay = y - cs * 0.15 - Math.abs(Math.sin(now / 220)) * cs * 0.35; g.save(); g.fillStyle = '#fde047'; g.strokeStyle = '#78350f'; g.lineWidth = 2; g.beginPath(); g.moveTo(x + cs / 2, ay); g.lineTo(x + cs * 0.22, ay - cs * 0.32); g.lineTo(x + cs * 0.4, ay - cs * 0.32); g.lineTo(x + cs * 0.4, ay - cs * 0.62); g.lineTo(x + cs * 0.6, ay - cs * 0.62); g.lineTo(x + cs * 0.6, ay - cs * 0.32); g.lineTo(x + cs * 0.78, ay - cs * 0.32); g.closePath(); g.fill(); g.stroke(); g.restore(); }
    }
    // drag & drop ghost: snapped cell (green ok / red no), range preview, the tower floating under the pointer
    const gh = v.ghost;
    if (gh) {
      const col = gh.ok ? '#22c55e' : '#ef4444';
      if (gh.c >= 0) { const x = (gh.c % w.W) * cs, y = Math.floor(gh.c / w.W) * cs; g.fillStyle = gh.ok ? 'rgba(34,197,94,.3)' : 'rgba(239,68,68,.3)'; g.fillRect(x, y, cs, cs); outline(gh.c, col, false); if (gh.r) ring(gh.c, gh.r, col); }
      g.save(); g.globalAlpha = 0.85; ell(g, gh.x, gh.y + cs * 0.32, cs * 0.3, cs * 0.1, 'rgba(0,0,0,.3)'); towerArt(g, gh.k, gh.x, gh.y, cs * 0.85, 0, now, -Math.PI / 2, 0); g.restore();
    }
    // floating numbers
    g.textAlign = 'center'; g.textBaseline = 'middle';
    this.texts = this.texts.filter(tx => {
      const k = (now - tx.born) / tx.life; if (k >= 1) return false;
      const sz = Math.max(10, Math.round(cs * 0.3 * tx.size * (k < 0.15 ? 0.7 + k * 2 : 1))), y = tx.y - k * cs * 0.8;
      g.globalAlpha = k > 0.6 ? (1 - k) / 0.4 : 1; g.font = '900 ' + sz + 'px system-ui,sans-serif'; g.lineWidth = Math.max(2, sz * 0.22); g.strokeStyle = 'rgba(0,0,0,.6)'; g.strokeText(tx.label, tx.x, y); g.fillStyle = tx.color; g.fillText(tx.label, tx.x, y);
      return true;
    });
    g.globalAlpha = 1;
    // pings
    for (const f of v.pings || []) {
      const age = now - f.born, k = age / f.life; if (k >= 1) continue;
      const [x, y] = this.cellPx(f.c), pulse = (age % 900) / 900; g.strokeStyle = f.color; g.lineWidth = 3; g.globalAlpha = (1 - pulse) * (1 - k * 0.6); g.beginPath(); g.arc(x, y, cs * (0.35 + pulse * 0.6), 0, TAU); g.stroke(); g.globalAlpha = 1;
      const by = y - cs * 0.74 - Math.abs(Math.sin(age / 200)) * cs * 0.12; rr(g, x - cs * 0.34, by - cs * 0.31, cs * 0.68, cs * 0.6, cs * 0.18); g.fillStyle = f.color; g.fill(); g.font = Math.round(cs * 0.4) + 'px system-ui,sans-serif'; g.fillStyle = '#fff'; g.fillText(f.icon, x, by);
    }
    // teammates' cursors (corner brackets + name tag) and their speech bubbles
    for (const cu of v.cursors || []) {
      if (cu.c == null || cu.c < 0) continue; const x = (cu.c % w.W) * cs, y = Math.floor(cu.c / w.W) * cs, L = cs * 0.28, b = Math.sin(now / 250) * cs * 0.03;
      g.strokeStyle = cu.color; g.lineWidth = Math.max(2, cs * 0.07); g.lineCap = 'round'; g.globalAlpha = cu.alpha == null ? 1 : cu.alpha;
      for (const [cx, cy, sx, sy] of [[x - b, y - b, 1, 1], [x + cs + b, y - b, -1, 1], [x - b, y + cs + b, 1, -1], [x + cs + b, y + cs + b, -1, -1]]) { g.beginPath(); g.moveTo(cx, cy + sy * L); g.lineTo(cx, cy); g.lineTo(cx + sx * L, cy); g.stroke(); }
      g.font = '800 ' + Math.max(9, Math.round(cs * 0.24)) + 'px system-ui,sans-serif'; const label = cu.label, tw = g.measureText(label).width + cs * 0.24, ty = y + cs + cs * 0.16;
      rr(g, x + cs / 2 - tw / 2, ty - cs * 0.15, tw, cs * 0.3, cs * 0.12); g.fillStyle = cu.color; g.fill(); g.fillStyle = '#fff'; g.fillText(label, x + cs / 2, ty + 1);
      g.globalAlpha = 1;
    }
    for (const bu of v.bubbles || []) {
      if (bu.c == null || bu.c < 0) continue; const age = now - bu.born, k = age / bu.life; if (k >= 1) continue;
      const [x, y0] = this.cellPx(bu.c), pop = age < 160 ? 0.6 + age / 400 : 1, y = y0 - cs * 0.62 - Math.min(1, age / 200) * cs * 0.15;
      g.save(); g.globalAlpha = k > 0.8 ? (1 - k) / 0.2 : 1; g.translate(x, y); g.scale(pop, pop);
      g.font = '800 ' + Math.max(11, Math.round(cs * 0.3)) + 'px system-ui,sans-serif'; const tw = Math.min(w.W * cs * 0.8, g.measureText(bu.text).width + cs * 0.4), hh = cs * 0.48;
      let bx = -tw / 2; const left = x + bx * pop, right = x - bx * pop, Wd = w.W * cs; if (left < 2) bx += (2 - left) / pop; if (right > Wd - 2) bx -= (right - Wd + 2) / pop;
      g.fillStyle = 'rgba(0,0,0,.25)'; rr(g, bx + 2, -hh + 3, tw, hh, hh / 2.2); g.fill();
      g.fillStyle = '#fff'; rr(g, bx, -hh, tw, hh, hh / 2.2); g.fill(); g.lineWidth = Math.max(2, cs * 0.06); g.strokeStyle = bu.color; g.stroke();
      g.beginPath(); g.moveTo(-cs * 0.1, -1); g.lineTo(0, cs * 0.16); g.lineTo(cs * 0.1, -1); g.closePath(); g.fillStyle = '#fff'; g.fill();
      g.fillStyle = '#1f2937'; g.fillText(bu.text, bx + tw / 2, -hh / 2 + 1, tw - cs * 0.2);
      g.restore();
    }
    g.textAlign = 'start'; g.textBaseline = 'alphabetic';
  }
  ambientDraw(g, now) {
    if (this.cap < 200 || this.reduced) return; const cs = this.cs, w = this.world, W = w.W * cs, H = w.H * cs;
    if (!this.ambient.length) for (let i = 0; i < 9; i++) this.ambient.push({ x: hash(i * 91) * W, y: hash(i * 37) * H, p: hash(i * 13) * 10 });
    g.save(); g.globalCompositeOperation = 'lighter';
    for (const a of this.ambient) { const x = (a.x + Math.sin(now / 2300 + a.p) * cs * 0.8 + W) % W, y = (a.y + Math.cos(now / 3100 + a.p) * cs * 0.6 + H) % H, k = 0.5 + 0.5 * Math.sin(now / 500 + a.p * 3); g.globalAlpha = 0.35 * k; circle(g, x, y, cs * 0.09, '#fef9c3'); g.globalAlpha = 0.8 * k; circle(g, x, y, cs * 0.025, '#fffbeb'); }
    g.restore();
    // eyes blinking in the forest at the entrance
    const gx = this.px(w.segs[0].x), blink = (now % 4200) < 160; if (!blink) { g.fillStyle = 'rgba(250,204,21,.85)'; for (const [ox, oy] of [[-1.25, 0.25], [1.3, 0.35]]) { circle(g, gx + ox * cs - cs * 0.06, oy * cs, cs * 0.03, null); g.fill(); circle(g, gx + ox * cs + cs * 0.06, oy * cs, cs * 0.03, null); g.fill(); } }
    // fort flag
    const fx = gx + cs * 0.42, fy = (w.H - 1) * cs; g.strokeStyle = '#d6d3d1'; g.lineWidth = Math.max(1, cs * 0.03); g.beginPath(); g.moveTo(fx, fy + cs * 0.16); g.lineTo(fx, fy - cs * 0.34); g.stroke();
    const wv = t => Math.sin(now / 180 + t * 3) * cs * 0.04; g.fillStyle = '#ef4444'; g.beginPath(); g.moveTo(fx, fy - cs * 0.34); for (let t = 0; t <= 1.001; t += 0.25) g.lineTo(fx + t * cs * 0.34, fy - cs * 0.34 + wv(t) * t); for (let t = 1; t >= -0.001; t -= 0.25) g.lineTo(fx + t * cs * 0.34, fy - cs * 0.22 + wv(t) * t); g.closePath(); g.fill();
    g.fillStyle = '#fff'; g.beginPath(); g.moveTo(fx, fy - cs * 0.22); for (let t = 0; t <= 1.001; t += 0.25) g.lineTo(fx + t * cs * 0.34, fy - cs * 0.22 + wv(t) * t); for (let t = 1; t >= -0.001; t -= 0.25) g.lineTo(fx + t * cs * 0.34, fy - cs * 0.1 + wv(t) * t); g.closePath(); g.fill();
  }
}
/** small icon (data URL) for a tower ('t'), monster ('m') or hero ('h'), cached */
const iconCache = new Map();
function icon(kind, k, size) {
  const key = kind + k + size + (root.devicePixelRatio || 1); if (iconCache.has(key)) return iconCache.get(key);
  const dpr = Math.min(3, root.devicePixelRatio || 1), cv = document.createElement('canvas'); cv.width = cv.height = Math.round(size * dpr); const g = cv.getContext('2d'); g.scale(dpr, dpr);
  if (kind === 't') towerArt(g, k, size / 2, size / 2, size * (k === 'barong' ? 0.95 : 0.92), 0, 300, -Math.PI / 3);
  else if (kind === 'h') heroArt(g, k, size / 2, size / 2, size * 0.98);
  else monsterArt(g, k, size / 2, size * 0.56, size * (k === 'ratu' ? 1.05 : 1.15), 0, {});
  let url = ''; try { url = cv.toDataURL('image/png'); } catch (e) { url = ''; }
  iconCache.set(key, url); return url;
}
root.BKRender = { MapView, towerArt, towerBase, monsterArt, heroArt, icon, SEAT, HERO_COL };
})(typeof window !== 'undefined' ? window : globalThis);

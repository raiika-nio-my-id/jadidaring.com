/* Anomali Mini Market renderer: 2.5D ~45° oblique shop floor (ToS-like), depth-sorted props, soft shadows. window.AR */
(function (root) {
'use strict';
const TAU = Math.PI * 2, clamp = (v, a, b) => v < a ? a : v > b ? b : v, lerp = (a, b, t) => a + (b - a) * t;
function hx(c) { const n = parseInt(c.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; }
/* trousers: always a dark solid cloth (never shirt-derived → white/yellow shirts no longer read as bare legs) */
const PANTS = ['#2a2438', '#3e3850', '#1c2436', '#2e2a26', '#33283e'];
function pantsOf(shirt, isP) { let k = isP ? 1 : 0; for (const ch of String(shirt || '')) k += ch.charCodeAt(0); let p = PANTS[k % PANTS.length]; if (p === shirt) p = PANTS[(k + 1) % PANTS.length]; return p; }
function mix(a, b, t) { const A = hx(a), B = hx(b); return 'rgb(' + A.map((x, i) => Math.round(lerp(x, B[i], t))).join(',') + ')'; }
function hash(k) { let x = Math.imul(k ^ 0x9e3779b9, 0x85ebca6b); x ^= x >>> 13; x = Math.imul(x, 0xc2b2ae35); x ^= x >>> 16; return (x >>> 0) / 4294967296; }

let ctx, W, H, S, AX, AY, CU = 3.5, CV = 4.5;
/* Classic dimetric ~45°: x' = (u - v) * cos30, y' = (u + v) * sin30 - z */
function P(u, v, z) {
  const du = u - CU, dv = v - CV;
  return [AX + (du - dv) * 0.866 * S, AY + (du + dv) * 0.5 * S - (z || 0) * S];
}
function depth(u, v) { return u + v; }
function poly(pts, fill, stroke, lw) {
  ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.closePath();
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw || 1; ctx.stroke(); }
}
function shadow(x, y, rx, ry, a) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, rx);
  g.addColorStop(0, 'rgba(8,4,12,' + (a == null ? 0.42 : a) + ')'); g.addColorStop(1, 'rgba(8,4,12,0)');
  ctx.save(); ctx.translate(x, y); ctx.scale(1, (ry || rx * 0.35) / rx); ctx.translate(-x, -y);
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, rx, 0, TAU); ctx.fill(); ctx.restore();
}
function box(u0, v0, u1, v1, z0, z1, top, sv, su, line) {
  const L = line || 'rgba(20,8,16,.45)';
  poly([P(u0, v1, z0), P(u1, v1, z0), P(u1, v1, z1), P(u0, v1, z1)], sv, L, 1);
  poly([P(u1, v0, z0), P(u1, v1, z0), P(u1, v1, z1), P(u1, v0, z1)], su, L, 1);
  poly([P(u0, v0, z1), P(u1, v0, z1), P(u1, v1, z1), P(u0, v1, z1)], top, L, 1);
}

/* ---------- faces: shared by world sprite, inspect portrait and KTP photo ---------- */
const GREY = '#9a9590';
function hairCol(tr) { return tr.face && tr.face.band === 'tua' && !tr.wrong ? mix(tr.hair, GREY, 0.55) : tr.hair; }
function hijabCol(tr) { return tr.wrong ? '#18c8d0' : (tr.face ? tr.face.hijabCol : '#5a3a5a'); }
/* c: ctx, (x,y) head centre, r: head radius px, tr: traits {skin,hair,shirt,gender,face}, o: {redEyes, side (-1..1), back} */
function drawFace(c, x, y, r, tr, o) {
  o = o || {};
  const f = tr.face || {}, hc = hairCol(tr), side = o.side || 0, small = r < 11, ol = 'rgba(30,14,10,.55)';
  const hs = f.cut || f.hair, hij = hs === 'hijab', gl = f.glasses === true ? 'bulat' : f.glasses || 'none';
  c.save(); c.lineCap = 'round'; c.lineJoin = 'round';
  // back layer: long hair / hijab drape (fig draws it behind the torso first: o.layer 'back' then 'front')
  if (o.layer === 'front') ;
  else if (hij) { c.fillStyle = hijabCol(tr); c.beginPath(); c.moveTo(x - r * 1.35, y + r * 1.5); c.quadraticCurveTo(x - r * 1.45, y - r * 1.3, x, y - r * 1.32); c.quadraticCurveTo(x + r * 1.45, y - r * 1.3, x + r * 1.35, y + r * 1.5); c.closePath(); c.fill(); }
  else if (hs === 'panjang') { c.fillStyle = hc; c.beginPath(); c.ellipse(x, y + r * 0.35, r * 1.18, r * 1.55, 0, 0, TAU); c.fill(); }
  else if (hs === 'bob') { c.fillStyle = hc; c.beginPath(); c.ellipse(x, y + r * 0.05, r * 1.2, r * 1.15, 0, 0, TAU); c.fill(); }
  else if (hs === 'gondrong') { c.fillStyle = hc; c.beginPath(); c.ellipse(x, y + r * 0.2, r * 1.12, r * 1.3, 0, 0, TAU); c.fill(); }
  else if (hs === 'ikal' && tr.gender === 'P') { c.fillStyle = hc; c.beginPath(); for (let i = 0; i < 9; i++) { const a = i / 9 * TAU; c.moveTo(x + Math.cos(a) * r * 1.05 + r * 0.42, y + r * 0.2 + Math.sin(a) * r * 1.1); c.arc(x + Math.cos(a) * r * 1.05, y + r * 0.2 + Math.sin(a) * r * 1.1, r * 0.42, 0, TAU); } c.fill(); }
  else if (hs === 'kuncir') { c.fillStyle = hc; c.beginPath(); c.ellipse(x - side * r * 0.2 + r * 0.95, y - r * 0.2, r * 0.38, r * 0.75, 0.5, 0, TAU); c.fill(); }
  if (o.layer === 'back') { c.restore(); return; }
  if (o.back) { // seen from behind: hair/hijab covers the head
    c.fillStyle = hij ? hijabCol(tr) : (hs === 'botak' ? tr.skin : hc);
    c.beginPath(); c.ellipse(x, y, r * 1.02, r * 1.08, 0, 0, TAU); c.fill(); c.strokeStyle = ol; c.lineWidth = 1; c.stroke();
    c.restore(); return;
  }
  // head (age: rounder for muda, longer for tua)
  const hw = r * (f.band === 'muda' ? 1.0 : 0.94) * (f.wide ? 0.95 + (f.wide - 1) * 0.5 : 1), hh = r * (f.band === 'tua' ? 1.1 : 1.04);
  if (!hij) { c.fillStyle = tr.skin; c.beginPath(); c.ellipse(x - hw * 0.98, y + r * 0.05, r * 0.2, r * 0.28, 0, 0, TAU); c.ellipse(x + hw * 0.98, y + r * 0.05, r * 0.2, r * 0.28, 0, 0, TAU); c.fill(); }
  c.fillStyle = tr.skin; c.beginPath(); c.ellipse(x, y, hw, hh, 0, 0, TAU); c.fill(); c.strokeStyle = ol; c.lineWidth = small ? 0.8 : 1.2; c.stroke();
  // shading under cheek
  const sh = c.createLinearGradient(x - hw, 0, x + hw, 0); sh.addColorStop(0, 'rgba(0,0,0,0)'); sh.addColorStop(1, 'rgba(60,20,10,.18)');
  c.fillStyle = sh; c.beginPath(); c.ellipse(x, y, hw, hh, 0, 0, TAU); c.fill();
  // hair front / hijab frame
  if (hij) {
    c.fillStyle = hijabCol(tr); c.beginPath(); c.ellipse(x, y - hh * 0.38, hw * 1.12, hh * 0.78, 0, Math.PI, TAU); c.quadraticCurveTo(x, y - hh * 0.62, x - hw * 1.12, y - hh * 0.38); c.fill();
    c.beginPath(); c.moveTo(x - hw * 1.12, y - hh * 0.38); c.quadraticCurveTo(x - hw * 1.2, y + hh * 0.4, x - hw * 0.92, y + hh * 0.85); c.lineTo(x - hw * 0.86, y + hh * 0.2); c.quadraticCurveTo(x - hw * 0.95, y - hh * 0.2, x - hw * 0.8, y - hh * 0.45); c.fill();
    c.beginPath(); c.moveTo(x + hw * 1.12, y - hh * 0.38); c.quadraticCurveTo(x + hw * 1.2, y + hh * 0.4, x + hw * 0.92, y + hh * 0.85); c.lineTo(x + hw * 0.86, y + hh * 0.2); c.quadraticCurveTo(x + hw * 0.95, y - hh * 0.2, x + hw * 0.8, y - hh * 0.45); c.fill();
    c.fillStyle = hijabCol(tr); c.beginPath(); c.moveTo(x - hw * 1.1, y + hh * 0.75); c.quadraticCurveTo(x, y + hh * 1.55, x + hw * 1.1, y + hh * 0.75); c.lineTo(x + hw * 0.7, y + hh * 0.95); c.quadraticCurveTo(x, y + hh * 1.2, x - hw * 0.7, y + hh * 0.95); c.fill();
  } else if (f.hair !== 'botak') {
    c.fillStyle = hc; c.beginPath();
    if (hs === 'jabrik') { c.moveTo(x - hw * 1.02, y - hh * 0.15); for (let i = 0; i <= 6; i++) { const a = Math.PI + i / 6 * Math.PI; c.lineTo(x + Math.cos(a) * hw * (i % 2 ? 1.25 : 1.02), y - hh * 0.2 + Math.sin(a) * hh * (i % 2 ? 1.22 : 0.95)); } }
    else if (hs === 'belah') { c.ellipse(x, y - hh * 0.25, hw * 1.05, hh * 0.85, 0, Math.PI, TAU); c.lineTo(x + hw * 0.2, y - hh * 0.5); c.quadraticCurveTo(x - hw * 0.3, y - hh * 0.25, x - hw * 1.05, y - hh * 0.2); }
    else if (hs === 'ikal') { for (let i = 0; i < 7; i++) { const a = Math.PI + i / 6 * Math.PI; c.moveTo(x + Math.cos(a) * hw * 0.9, y - hh * 0.25 + Math.sin(a) * hh * 0.8); c.arc(x + Math.cos(a) * hw * 0.9, y - hh * 0.25 + Math.sin(a) * hh * 0.8, r * 0.34, 0, TAU); } }
    else { c.ellipse(x, y - hh * 0.3, hw * 1.04, hh * 0.78, 0, Math.PI, TAU); if (hs === 'panjang' || hs === 'bob' || hs === 'kuncir' || hs === 'gondrong') { c.lineTo(x + hw * 1.04, y + hh * 0.1); c.lineTo(x + hw * 0.8, y - hh * 0.3); c.lineTo(x - hw * 0.8, y - hh * 0.3); c.lineTo(x - hw * 1.04, y + hh * 0.1); } }
    c.fill();
    if (hs === 'panjang' || hs === 'gondrong') { c.beginPath(); for (const sx of [-1, 1]) c.ellipse(x + sx * hw * 0.98, y + hh * (hs === 'panjang' ? 0.75 : 0.45), r * 0.3, hh * (hs === 'panjang' ? 0.95 : 0.6), sx * 0.12, 0, TAU); c.fill(); }
  }
  if (o.hat && !hij) { c.fillStyle = '#c0392b'; c.beginPath(); c.ellipse(x, y - hh * 0.55, hw * 1.08, hh * 0.5, 0, Math.PI, TAU); c.fill(); c.fillRect(x - hw * 0.2 + side * hw * 0.6, y - hh * 0.62, hw * 1.3 * (side < 0 ? -1 : 1), r * 0.18); }
  const ex = side * r * 0.22, eo = r * 0.4, ey = y - r * 0.05;
  // brows
  c.strokeStyle = f.band === 'tua' ? mix(tr.hair, GREY, 0.6) : tr.hair; c.lineWidth = Math.max(0.8, r * 0.08 * (f.brow || 2) / 2);
  c.beginPath(); c.moveTo(x + ex - eo - r * 0.2, ey - r * 0.32); c.lineTo(x + ex - eo + r * 0.18, ey - r * 0.36); c.moveTo(x + ex + eo - r * 0.18, ey - r * 0.36); c.lineTo(x + ex + eo + r * 0.2, ey - r * 0.32); c.stroke();
  // eyes
  const ew = r * (f.eye === 'lebar' ? 0.22 : f.eye === 'sipit' ? 0.2 : 0.17), eh = r * (f.eye === 'sipit' ? 0.07 : f.eye === 'lebar' ? 0.15 : 0.13);
  for (const sx of [-1, 1]) {
    const cx = x + ex + sx * eo;
    if (!small) { c.fillStyle = '#fff'; c.beginPath(); c.ellipse(cx, ey, ew, Math.max(eh, 1), 0, 0, TAU); c.fill(); }
    c.fillStyle = o.redEyes ? '#ff2a2a' : '#2a1608';
    c.beginPath(); c.arc(cx + side * ew * 0.3, ey, Math.max(small ? 0.9 : 1.2, Math.min(eh, ew) * (o.redEyes ? 1.3 : 0.95)), 0, TAU); c.fill();
    if (o.redEyes) { c.fillStyle = 'rgba(255,40,40,.35)'; c.beginPath(); c.arc(cx, ey, ew * 2, 0, TAU); c.fill(); }
  }
  if (!small) {
    // nose
    c.strokeStyle = mix(tr.skin, '#3a1a10', 0.45); c.lineWidth = Math.max(1, r * 0.06);
    const nw = f.nose === 'lebar' ? 0.2 : f.nose === 'mancung' ? 0.1 : 0.12, nl = f.nose === 'mancung' ? 0.42 : 0.3;
    c.beginPath(); c.moveTo(x + ex * 1.3, y + r * 0.02); c.lineTo(x + ex * 1.5 + r * 0.04, y + r * nl); c.moveTo(x + ex * 1.5 - r * nw, y + r * (nl + 0.04)); c.quadraticCurveTo(x + ex * 1.5, y + r * (nl + 0.1), x + ex * 1.5 + r * nw, y + r * (nl + 0.04)); c.stroke();
    // mouth
    const my = y + r * 0.62, mw = r * (f.mouth === 'tebal' ? 0.3 : 0.26);
    c.strokeStyle = '#7a2a28'; c.lineWidth = Math.max(1, r * (f.mouth === 'tebal' ? 0.11 : 0.07));
    c.beginPath(); c.moveTo(x + ex - mw, my); if (f.mouth === 'senyum') c.quadraticCurveTo(x + ex, my + r * 0.16, x + ex + mw, my); else c.lineTo(x + ex + mw, my + (f.mouth === 'tebal' ? r * 0.02 : 0)); c.stroke();
    if (f.blush) { c.fillStyle = 'rgba(230,90,90,.22)'; c.beginPath(); c.arc(x - r * 0.55 + ex, y + r * 0.32, r * 0.17, 0, TAU); c.arc(x + r * 0.55 + ex, y + r * 0.32, r * 0.17, 0, TAU); c.fill(); }
    if (f.band === 'tua') { c.strokeStyle = 'rgba(80,40,20,.35)'; c.lineWidth = 1; c.beginPath(); c.moveTo(x - r * 0.3, y - r * 0.55); c.lineTo(x + r * 0.3, y - r * 0.55); c.moveTo(x - r * 0.42, y + r * 0.35); c.quadraticCurveTo(x - r * 0.38, y + r * 0.6, x - r * 0.3, y + r * 0.7); c.moveTo(x + r * 0.42, y + r * 0.35); c.quadraticCurveTo(x + r * 0.38, y + r * 0.6, x + r * 0.3, y + r * 0.7); c.stroke(); }
  } else {
    c.strokeStyle = '#7a2a28'; c.lineWidth = 0.9; c.beginPath(); c.moveTo(x + ex - r * 0.22, y + r * 0.55); c.lineTo(x + ex + r * 0.22, y + r * 0.55); c.stroke();
  }
  if (f.stache) { c.fillStyle = hc; c.beginPath(); c.ellipse(x + ex - r * 0.15, y + r * 0.48, r * 0.19, r * 0.07, 0.2, 0, TAU); c.ellipse(x + ex + r * 0.15, y + r * 0.48, r * 0.19, r * 0.07, -0.2, 0, TAU); c.fill(); }
  if (f.mask === 'on') { // surgical mask: covers nose + mouth, ear loops
    const mw = hw * 0.92, mt = y + r * 0.12, mb = y + r * 0.86;
    c.strokeStyle = '#e8eef0'; c.lineWidth = Math.max(0.7, r * 0.05); c.beginPath(); c.moveTo(x - mw, mt + r * 0.1); c.lineTo(x - hw, y); c.moveTo(x + mw, mt + r * 0.1); c.lineTo(x + hw, y); c.stroke();
    c.fillStyle = '#a9d6e5'; c.beginPath(); c.moveTo(x - mw, mt); c.quadraticCurveTo(x + ex, mt - r * 0.14, x + mw, mt); c.lineTo(x + mw * 0.8, mb - r * 0.1); c.quadraticCurveTo(x + ex, mb + r * 0.1, x - mw * 0.8, mb - r * 0.1); c.closePath(); c.fill();
    c.strokeStyle = 'rgba(40,80,100,.45)'; c.lineWidth = Math.max(0.6, r * 0.035); c.stroke(); if (!small) { c.beginPath(); for (const k of [0.38, 0.58]) { c.moveTo(x - mw * 0.85, lerp(mt, mb, k)); c.lineTo(x + mw * 0.85, lerp(mt, mb, k)); } c.stroke(); }
  }
  if (gl !== 'none') { // hitam (sunglasses) · kotak (square) · bulat (round)
    const lw = ew * 1.55, lh = gl === 'bulat' ? lw : ew * (gl === 'hitam' ? 1.2 : 1.1);
    c.strokeStyle = '#1a1a1a'; c.lineWidth = Math.max(0.8, r * (gl === 'kotak' ? 0.08 : 0.06)); c.beginPath();
    for (const sx of [-1, 1]) { const cx = x + ex + sx * eo; if (gl === 'bulat') { c.moveTo(cx + lw, ey); c.arc(cx, ey, lw, 0, TAU); } else c.rect(cx - lw, ey - lh, lw * 2, lh * 2); }
    c.moveTo(x + ex - eo + lw, ey); c.lineTo(x + ex + eo - lw, ey);
    if (gl === 'hitam') { c.fillStyle = 'rgba(16,16,24,.92)'; c.fill(); }
    c.stroke();
    if (gl === 'hitam') for (const sx of [-1, 1]) { const cx = x + ex + sx * eo; if (o.redEyes) { c.fillStyle = '#ff2a2a'; c.beginPath(); c.arc(cx, ey, Math.max(1.2, ew * 0.55), 0, TAU); c.fill(); } else { c.fillStyle = 'rgba(255,255,255,.35)'; c.fillRect(cx - lw * 0.7, ey - lh * 0.7, lw * 0.5, lh * 0.35); } }
  }
  c.restore();
}

/* world sprite with gait: o.moving / o.walk (phase) / o.facing (world angle) / o.reach (browse) */
function person(u, v, sc, o, t) {
  const p = P(u, v, 0), x = p[0], y = p[1];
  const floatY = o.float ? -10 * sc - Math.sin(t * 3 + u) * 3 * sc : 0;
  const big = o.lk === 'besar' ? 1.6 : 1;
  if (!o.noShadow) shadow(x, y + 2, 14 * sc * big, 5 * sc * big, o.cold || big > 1 ? 0.6 : 0.4);
  // facing → screen: sx>0 right, sy<0 = walking away from camera (show back)
  const fa = o.facing == null ? Math.PI / 4 : o.facing, ssx = (Math.cos(fa) - Math.sin(fa)) * 0.866, ssy = (Math.cos(fa) + Math.sin(fa)) * 0.5;
  const ph = o.moving ? (o.walk || 0) : 0, bob = o.lk === 'pocong' ? Math.abs(Math.sin(t * 5 + u)) * (o.moving ? 6 : 2.5) * sc : o.moving ? Math.abs(Math.cos(ph)) * 1.6 * sc : Math.sin(t * 2 + u) * 0.4 * sc; // pocong hops
  ctx.save(); ctx.translate(x, y + floatY - bob);
  fig(sc, o, t, clamp(ssx * 1.3, -1, 1), ssy < -0.2);
  ctx.restore();
}
const POLISI = '#8a6a3e', JEANS = '#2c3f66', SKIRT = ['#7a2a3a', '#2f4f7a', '#5a3a6a', '#3a5a3a'];
/* layered wardrobe body at the ctx origin (feet): shoes → legs/bottom → top → arms → face. Same call for world, inspect and KTP. */
function fig(sc, o, t, side, back) {
  if (o.lk === 'tuyul') sc *= 0.68; // folklore tells: ONE feature each (size / wrap / hair veil); face stays human
  const c = ctx, f = o.face || {}, gk = o.lk === 'besar' ? 1.24 : 1, h = 58 * sc * (f.tall || 1) * gk, bw = 9 * sc * (f.wide || 1) * gk, ol = 'rgba(20,8,10,.75)';
  const top = f.top || 'kemeja', bot = f.bottom || (o.gender === 'P' ? 'rok' : 'jeans'), foot = f.foot || 'sneaker';
  const sw = o.moving && o.lk !== 'pocong' ? Math.sin(o.walk || 0) : 0, st = sw * 5 * sc, lift = o.float ? -6 * sc : -1;
  const shirt = top === 'polisi' && !o.wrong ? POLISI : o.shirt, dark = mix(shirt, '#1a1020', 0.35);
  const pants = o.pants || (bot === 'jeans' ? JEANS : pantsOf(o.shirt, o.gender === 'P')); // pant bottoms: always solid dark cloth
  const ft = { skin: o.skin, hair: o.hair, shirt: o.shirt, gender: o.gender, face: f, wrong: o.wrong }, fo = { redEyes: o.redEyes, side, back, hat: o.hat, layer: 'back' };
  if (!back) drawFace(c, side * 1.2 * sc, -h * 0.92, 7.4 * sc, ft, fo);
  c.lineJoin = 'round'; c.lineCap = 'round';
  const hip = -h * 0.38, L = [[-4 * sc, -4.5 * sc + st, lift - (sw > 0 ? sw * 2 * sc : 0)], [4 * sc, 4.5 * sc - st, lift - (sw < 0 ? -sw * 2 * sc : 0)]];
  const seg = (k0, k1, col, w) => { c.beginPath(); for (const [hx, fx, fy] of L) { c.moveTo(lerp(hx, fx, k0), lerp(hip, fy, k0)); c.lineTo(lerp(hx, fx, k1), lerp(hip, fy, k1)); } c.strokeStyle = ol; c.lineWidth = w + 1.4 * sc; c.stroke(); c.strokeStyle = col; c.lineWidth = w; c.stroke(); };
  // legs: shorts = 3/4 dark cloth + shin; rok = dark leggings; others full-length trousers
  seg(0, 1, bot === 'pendek' ? o.skin : pants, 5 * sc);
  if (bot === 'pendek') { c.lineCap = 'butt'; seg(0, 0.64, pants, 5.6 * sc); seg(0.6, 0.64, mix(pants, '#ffffff', 0.3), 5.6 * sc); c.lineCap = 'round'; }
  if (bot === 'olahraga') { c.strokeStyle = 'rgba(255,255,255,.8)'; c.lineWidth = 0.9 * sc; c.beginPath(); for (const [hx, fx, fy] of L) { const d = hx < 0 ? -2 * sc : 2 * sc; c.moveTo(hx + d, hip); c.lineTo(fx + d, fy - 1.5 * sc); } c.stroke(); }
  if (bot === 'jeans') { c.strokeStyle = 'rgba(160,190,230,.35)'; c.lineWidth = 0.7 * sc; c.beginPath(); for (const [hx, fx, fy] of L) { c.moveTo(hx, hip); c.lineTo(fx, fy - 2 * sc); } c.stroke(); }
  // footwear
  for (const [, fx, fy] of L) {
    const x0 = fx + side * 1.5 * sc;
    if (foot === 'boots') { c.fillStyle = '#3a2416'; c.strokeStyle = ol; c.lineWidth = 1; c.beginPath(); c.rect(x0 - 2.9 * sc, fy - 8 * sc, 5.8 * sc, 8 * sc); c.ellipse(x0 + side * sc, fy, 3.6 * sc, 1.9 * sc, 0, 0, TAU); c.fill(); c.stroke(); c.fillStyle = '#6a4426'; c.fillRect(x0 - 2.9 * sc, fy - 8 * sc, 5.8 * sc, 1.2 * sc); }
    else if (foot === 'sandal') { c.fillStyle = '#2a7ac0'; c.beginPath(); c.ellipse(x0, fy + 0.6 * sc, 3.4 * sc, 1.2 * sc, 0, 0, TAU); c.fill(); c.fillStyle = o.skin; c.beginPath(); c.ellipse(x0, fy - 0.2 * sc, 2.6 * sc, 1.3 * sc, 0, 0, TAU); c.fill(); c.strokeStyle = '#f2c14e'; c.lineWidth = 0.9 * sc; c.beginPath(); c.moveTo(x0 - 2 * sc, fy - 0.3 * sc); c.lineTo(x0 + side * sc, fy - 1.4 * sc); c.lineTo(x0 + 2 * sc, fy - 0.3 * sc); c.stroke(); }
    else { c.fillStyle = '#f4f4f0'; c.strokeStyle = ol; c.lineWidth = 1; c.beginPath(); c.ellipse(x0 + side * 0.8 * sc, fy, 3.5 * sc, 2 * sc, 0, 0, TAU); c.fill(); c.stroke(); c.fillStyle = '#d0402a'; c.fillRect(x0 - 2 * sc, fy - 0.6 * sc, 4 * sc, 0.9 * sc); c.fillStyle = '#9a9a9a'; c.fillRect(x0 - 3.3 * sc, fy + 1 * sc, 6.6 * sc, 0.7 * sc); }
  }
  if (o.float) { c.fillStyle = 'rgba(180,220,255,.25)'; c.beginPath(); c.ellipse(0, 2, 12 * sc, 4 * sc, 0, 0, TAU); c.fill(); }
  const sh = -h * 0.82, wa = -h * 0.42;
  const torso = (y0, y1, w0, w1) => { c.beginPath(); c.moveTo(-w1, y1); c.quadraticCurveTo(-w0 * 1.12, (y0 + y1) / 2, -w0 * 0.82, y0); c.lineTo(w0 * 0.82, y0); c.quadraticCurveTo(w0 * 1.12, (y0 + y1) / 2, w1, y1); c.closePath(); };
  // hips/bottom: waistband (pants) or flared rok
  if (bot === 'rok') { c.fillStyle = SKIRT[f.skirt || 0]; c.beginPath(); c.moveTo(-bw * 0.95, wa); c.lineTo(bw * 0.95, wa); c.lineTo(bw * 1.5, -h * 0.17); c.quadraticCurveTo(0, -h * 0.13, -bw * 1.5, -h * 0.17); c.closePath(); c.fill(); c.strokeStyle = ol; c.lineWidth = 1.1; c.stroke(); c.strokeStyle = 'rgba(0,0,0,.22)'; c.beginPath(); c.moveTo(-bw * 0.4, wa); c.lineTo(-bw * 0.6, -h * 0.16); c.moveTo(bw * 0.4, wa); c.lineTo(bw * 0.6, -h * 0.16); c.stroke(); }
  else { c.fillStyle = pants; torso(wa - h * 0.04, hip + h * 0.02, bw * 0.98, bw * 1.02); c.fill(); c.strokeStyle = ol; c.lineWidth = 1; c.stroke(); }
  // arms (behind the sleeve layer): skin, then a sleeve for clothed tops
  const reach = o.reach ? (Math.sin(t * 2.6) > 0.2 ? 1 : 0.4) : 0;
  const A = [[-bw * 0.9, -bw * 1.2 - sw * 3 * sc, -h * 0.48], [bw * 0.9, bw * 1.3 + (reach ? side * 6 * sc * reach : sw * 3 * sc), reach ? -h * (0.78 + 0.12 * reach) : -h * 0.55]];
  const arm = (k, col, w) => { c.beginPath(); for (const [sx, hx, hy] of A) { c.moveTo(sx, -h * 0.78); c.lineTo(lerp(sx, hx, k), lerp(-h * 0.78, hy, k)); } c.strokeStyle = col; c.lineWidth = w; c.stroke(); };
  arm(1, o.skin, 4 * sc);
  // tops
  const g = c.createLinearGradient(-bw, 0, bw, 0); g.addColorStop(0, shirt); g.addColorStop(1, dark);
  if (top === 'bikini') { // sporty two-piece: tankette + shoulders/midriff, never explicit
    c.fillStyle = o.skin; torso(sh, wa, bw * 0.95, bw * 0.92); c.fill(); c.strokeStyle = ol; c.lineWidth = 1; c.stroke();
    c.fillStyle = g; torso(-h * 0.76, -h * 0.5, bw * 1.0, bw * 0.94); c.fill(); c.stroke();
    c.strokeStyle = shirt; c.lineWidth = 1.2 * sc; c.beginPath(); c.moveTo(-bw * 0.5, -h * 0.76); c.lineTo(-bw * 0.35, sh); c.moveTo(bw * 0.5, -h * 0.76); c.lineTo(bw * 0.35, sh); c.stroke();
    c.fillStyle = 'rgba(255,255,255,.7)'; for (let i = 0; i < 4; i++) { c.beginPath(); c.arc(-bw * 0.6 + i * bw * 0.4, -h * (0.64 + (i % 2) * 0.06), 0.8 * sc, 0, TAU); c.fill(); }
  } else {
    c.fillStyle = g; torso(sh, wa - h * 0.02, bw * 1.0, bw * (top === 'polisi' ? 1.0 : 1.04)); c.fill(); c.strokeStyle = ol; c.lineWidth = 1.2; c.stroke();
    arm(0.42, shirt, 5 * sc);
    if (top === 'olahraga') { c.fillStyle = 'rgba(255,255,255,.85)'; c.fillRect(-bw * 0.98, -h * 0.75, bw * 0.22, h * 0.3); c.fillRect(bw * 0.76, -h * 0.75, bw * 0.22, h * 0.3); if (!back) { c.fillRect(-bw * 0.6, -h * 0.66, bw * 1.2, h * 0.05); c.strokeStyle = 'rgba(255,255,255,.9)'; c.lineWidth = 1.1 * sc; c.beginPath(); c.moveTo(-bw * 0.3, sh); c.lineTo(0, -h * 0.74); c.lineTo(bw * 0.3, sh); c.stroke(); } }
    else if (top === 'polisi') { c.fillStyle = '#3a2a18'; c.fillRect(-bw * 1.0, sh, bw * 0.45, 1.4 * sc); c.fillRect(bw * 0.55, sh, bw * 0.45, 1.4 * sc); c.fillStyle = '#1a1410'; c.fillRect(-bw * 1.02, wa - h * 0.05, bw * 2.04, 1.6 * sc);
      if (!back) { c.fillStyle = '#6a4e2c'; c.fillRect(-bw * 0.75, -h * 0.74, bw * 0.5, h * 0.07); c.fillRect(bw * 0.25, -h * 0.74, bw * 0.5, h * 0.07); c.fillStyle = '#f2c14e'; c.beginPath(); c.arc(-bw * 0.5, -h * 0.64, 1.1 * sc, 0, TAU); c.fill(); c.fillStyle = '#1a1410'; c.fillRect(bw * 0.3, -h * 0.63, bw * 0.4, 0.8 * sc); } }
    else if (!back) { c.fillStyle = mix(shirt, '#ffffff', 0.4); c.beginPath(); c.moveTo(-bw * 0.55, sh); c.lineTo(0, -h * 0.74); c.lineTo(-bw * 0.1, sh - 1); c.moveTo(bw * 0.55, sh); c.lineTo(0, -h * 0.74); c.lineTo(bw * 0.1, sh - 1); c.fill();
      c.fillStyle = 'rgba(255,255,255,.75)'; for (let i = 0; i < 3; i++) { c.beginPath(); c.arc(0, -h * (0.7 - i * 0.08), 0.6 * sc, 0, TAU); c.fill(); } c.strokeStyle = 'rgba(0,0,0,.25)'; c.lineWidth = 0.8; c.strokeRect(bw * 0.25, -h * 0.72, bw * 0.4, h * 0.07); }
  }
  if (o.apron) { c.fillStyle = 'rgba(30,60,120,.85)'; c.fillRect(-bw * 0.6, -h * 0.7, bw * 1.2, h * 0.32); }
  if (o.basket) {
    const bx = reach ? -bw * 1.9 : bw * 1.1;
    c.fillStyle = '#c03a3a'; c.fillRect(bx, -h * 0.6, 10 * sc, 7 * sc);
    c.strokeStyle = ol; c.lineWidth = 1; c.strokeRect(bx, -h * 0.6, 10 * sc, 7 * sc);
    if (o.items) for (let i = 0; i < o.items; i++) { c.fillStyle = ['#f2c14e', '#3a8ad0', '#e07a2a'][i % 3]; c.fillRect(bx + 1 + i * 3 * sc, -h * 0.6 - 3 * sc, 2.4 * sc, 4 * sc); }
  }
  if (o.lk === 'pocong') { // kain kafan over the clothes: pale wrap + ties at chest / knees
    c.globalAlpha *= 0.82; c.fillStyle = '#ece6d6'; torso(sh, -h * 0.04, bw * 1.08, bw * 0.78); c.fill(); c.globalAlpha /= 0.82;
    c.strokeStyle = '#b8ae98'; c.lineWidth = 1.2 * sc; c.beginPath(); for (const k of [0.66, 0.2]) { c.moveTo(-bw, -h * k); c.lineTo(bw, -h * k + 1.5 * sc); } c.stroke(); }
  if (o.wet) { c.fillStyle = 'rgba(120,190,255,.85)'; for (let i = 0; i < 2; i++) { const q = ((t || 0) * 1.4 + i * 0.5) % 1; c.beginPath(); c.arc(bw * 1.3 + i * 2 * sc, -h * 0.52 + q * h * 0.45, 1.3 * sc, 0, TAU); c.fill(); } }
  c.fillStyle = o.skin; c.fillRect(-1.8 * sc + side * sc, -h * 0.86, 3.6 * sc, h * 0.06);
  fo.layer = back ? '' : 'front'; drawFace(c, side * 1.2 * sc, -h * 0.92, 7.4 * sc, ft, fo);
  const hr = 7.4 * sc, hx0 = side * 1.2 * sc, hy0 = -h * 0.92;
  if (o.lk === 'pocong') { c.fillStyle = '#ece6d6'; c.beginPath(); c.ellipse(hx0, hy0 - hr * 1.05, hr * 0.32, hr * 0.42, 0, 0, TAU); c.fill(); c.strokeStyle = '#b8ae98'; c.lineWidth = sc; c.stroke(); }
  if (o.lk === 'kunti' && !back) { c.fillStyle = o.hair || '#111'; c.globalAlpha *= 0.92; c.beginPath(); c.ellipse(hx0, hy0 - hr * 0.1, hr * 1.05, hr * 0.9, 0, Math.PI * 0.95, TAU * 1.02); c.fill(); // veil of hair over eyes, strands down the face
    c.strokeStyle = o.hair || '#111'; c.lineWidth = 1.6 * sc; c.beginPath(); for (let i = -3; i <= 3; i++) { c.moveTo(hx0 + i * hr * 0.26, hy0 - hr * 0.2); c.lineTo(hx0 + i * hr * 0.3, hy0 + hr * (0.55 + (i & 1) * 0.3)); } c.stroke(); c.globalAlpha /= 0.92; }
}

const SKU = { // generic packs (no brand marks)
  indomie: (x, y, k) => { ctx.fillStyle = '#f2c14e'; ctx.fillRect(x - 6 * k, y - 8 * k, 12 * k, 8 * k); ctx.fillStyle = '#c0392b'; ctx.fillRect(x - 6 * k, y - 5 * k, 12 * k, 2.4 * k); },
  tehbotol: (x, y, k) => bottle(x, y, k, '#8a4a1a', '#e8d070'),
  air: (x, y, k) => bottle(x, y, k, 'rgba(160,210,240,.9)', '#3a8ad0'),
  susu: (x, y, k) => { ctx.fillStyle = '#f4f4f4'; ctx.fillRect(x - 4 * k, y - 10 * k, 8 * k, 10 * k); ctx.fillStyle = '#3a8ad0'; ctx.fillRect(x - 4 * k, y - 6 * k, 8 * k, 3 * k); },
  chitato: (x, y, k) => { ctx.fillStyle = '#e8b030'; ctx.beginPath(); ctx.ellipse(x, y - 5 * k, 6 * k, 5.5 * k, 0, 0, TAU); ctx.fill(); ctx.fillStyle = '#c03a2a'; ctx.fillRect(x - 6 * k, y - 10.5 * k, 12 * k, 2 * k); },
  beras: (x, y, k) => { ctx.fillStyle = '#efe6d0'; ctx.beginPath(); ctx.moveTo(x - 6 * k, y); ctx.lineTo(x - 5 * k, y - 11 * k); ctx.lineTo(x + 5 * k, y - 11 * k); ctx.lineTo(x + 6 * k, y); ctx.fill(); ctx.fillStyle = '#2e8b57'; ctx.fillRect(x - 4 * k, y - 7 * k, 8 * k, 3 * k); },
  sabun: (x, y, k) => { ctx.fillStyle = '#e88ab0'; ctx.fillRect(x - 5 * k, y - 6 * k, 10 * k, 6 * k); ctx.fillStyle = '#fff'; ctx.fillRect(x - 3 * k, y - 4 * k, 6 * k, 2 * k); },
  rokok: (x, y, k) => { ctx.fillStyle = '#f4f0e8'; ctx.fillRect(x - 3.5 * k, y - 8 * k, 7 * k, 8 * k); ctx.fillStyle = '#b02020'; ctx.fillRect(x - 3.5 * k, y - 8 * k, 7 * k, 3 * k); }
};
function bottle(x, y, k, body, cap) { ctx.fillStyle = body; ctx.fillRect(x - 2.6 * k, y - 9 * k, 5.2 * k, 9 * k); ctx.fillRect(x - 1.2 * k, y - 12 * k, 2.4 * k, 3 * k); ctx.fillStyle = cap; ctx.fillRect(x - 1.4 * k, y - 13 * k, 2.8 * k, 1.6 * k); }

function drawFridge(u, v) {
  box(u, v, u + 0.9, v + 0.7, 0, 1.85, '#e4eef4', '#6a8494', '#8aa2b2');
  const k = S / 46;
  // two glass doors on the front face (v1), bottles inside on 3 racks
  for (let d = 0; d < 2; d++) {
    const u0 = u + 0.06 + d * 0.42, u1 = u0 + 0.38;
    const a = P(u0, v + 0.7, 0.12), b = P(u1, v + 0.7, 0.12), c = P(u1, v + 0.7, 1.75), e = P(u0, v + 0.7, 1.75);
    poly([a, b, c, e], '#1c2a34', '#b8c8d4', 2);
    for (let r = 0; r < 3; r++) for (let i = 0; i < 2; i++) {
      const q = P(u0 + 0.1 + i * 0.18, v + 0.7, 0.25 + r * 0.52);
      bottle(q[0], q[1], k * 0.8, ['#3a8ad0', '#e07a2a', '#2e8b57', '#c0392b'][(r + i + d) % 4], '#ddd');
    }
    poly([a, b, c, e], 'rgba(170,220,240,.28)');
    const gl = P(u0 + 0.06, v + 0.7, 1.6), gl2 = P(u0 + 0.16, v + 0.7, 0.4);
    ctx.strokeStyle = 'rgba(255,255,255,.45)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(gl[0], gl[1]); ctx.lineTo(gl2[0], gl2[1]); ctx.stroke();
    const hd = P(u1 - 0.04, v + 0.7, 0.9); ctx.fillStyle = '#ccd'; ctx.fillRect(hd[0] - 1, hd[1] - 8 * k, 2, 16 * k);
  }
  // frost edge + glow header
  const h0 = P(u, v + 0.7, 1.78), h1 = P(u + 0.9, v + 0.7, 1.78), h2 = P(u + 0.9, v + 0.7, 1.85), h3 = P(u, v + 0.7, 1.85);
  poly([h0, h1, h2, h3], '#7ad0ff');
}

/* gondola: metal uprights, 2 shelf planes with depth, pegboard back, SKU silhouettes + price tags; empty = bare plane */
function drawShelfUnit(u, v, slots, start) {
  const u1 = u + 1.6, v1 = v + 0.55, k = S / 46;
  // pegboard back panel
  poly([P(u, v, 0), P(u1, v, 0), P(u1, v, 1.6), P(u, v, 1.6)], '#4a5262', 'rgba(20,8,16,.5)', 1);
  poly([P(u1, v, 0), P(u1, v1, 0), P(u1, v1, 1.6), P(u1, v, 1.6)], '#3a4050', 'rgba(20,8,16,.5)', 1);
  const hd = [P(u, v1, 1.45), P(u1, v1, 1.45), P(u1, v1, 1.6), P(u, v1, 1.6)]; poly(hd, '#c0392b');
  // layered per level: deck → back facings (shaded) → front facings → front lip over their feet → price tag
  const decks = [[0, 0.16], [0.51, 0.55], [1.06, 1.1]];
  box(u, v, u1, v1, decks[0][0], decks[0][1], '#b8b0a2', '#5a5a62', '#6a6a72');
  for (let row = 0; row < 3; row++) {
    if (row) box(u, v, u1, v1, decks[row][0], decks[row][1], '#b8bcc6', '#6a6e78', '#7a7e88');
    const z = decks[row][1];
    for (let col = 0; col < 2 && row < 2; col++) {
      const s = slots[start + row * 2 + col]; if (!s) continue;
      const su = u + 0.12 + col * 0.76;
      if (!s.empty) {
        const fn = SKU[s.product.id] || SKU.sabun, dz = s.fx > 0 ? s.fx * 0.6 : 0; // just placed: facings drop onto the lip
        for (const [dv, shade] of [[0.36, 0.42], [0.2, 0]]) for (let n = 0; n < 3; n++) {
          const q = P(su + 0.1 + n * 0.21, v1 - dv, z + dz);
          shadow(q[0], q[1], 7 * k, 2.2 * k, 0.35);
          fn(q[0], q[1], k * 1.25);
          if (shade) { ctx.fillStyle = 'rgba(16,12,24,' + shade + ')'; ctx.fillRect(q[0] - 7 * k, q[1] - 14 * k, 14 * k, 14 * k); }
        }
      } else { // bare deck: dust mark only
        const q = P(su + 0.32, v1 - 0.25, z); ctx.fillStyle = 'rgba(60,50,40,.18)'; ctx.fillRect(q[0] - 14 * k, q[1] - 3 * k, 28 * k, 3 * k);
      }
    }
    // front lip (metal C-channel) hides the bottoms of the facings
    poly([P(u, v1, z - 0.02), P(u1, v1, z - 0.02), P(u1, v1, z + 0.07), P(u, v1, z + 0.07)], '#9aa0ac', 'rgba(20,20,30,.5)', 0.8);
    for (let col = 0; col < 2 && row < 2; col++) {
      const s = slots[start + row * 2 + col]; if (!s) continue;
      const t = P(u + 0.42 + col * 0.76, v1, z + 0.025);
      ctx.fillStyle = s.empty ? '#f6e08a' : '#fff'; ctx.fillRect(t[0] - 10 * k, t[1] - 3 * k, 20 * k, 6 * k);
      ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = 0.6; ctx.strokeRect(t[0] - 10 * k, t[1] - 3 * k, 20 * k, 6 * k);
      ctx.fillStyle = '#c0392b'; ctx.font = '700 ' + Math.max(5, 5.5 * k) + 'px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(s.empty ? 'KOSONG' : (s.product.price / 1000).toLocaleString('id-ID') + 'rb', t[0], t[1] + 0.2 * k);
      if (s.fx > 0) { ctx.fillStyle = 'rgba(255,224,110,' + Math.min(0.8, s.fx * 1.4) + ')'; ctx.fillRect(t[0] - 22 * k, t[1] - 5 * k, 44 * k, 10 * k); }
    }
  }
  const hp = P(u + 0.8, v1, 0.8); hits.push({ unit: start / 4, x: hp[0], y: hp[1] }); // tap a rak → walk there & restok
  // uprights
  for (const uu of [u, u1]) { poly([P(uu, v1, 0), P(uu, v1, 1.6), P(uu + 0.05, v1, 1.6), P(uu + 0.05, v1, 0)], '#5a5a66'); }
  ctx.textBaseline = 'alphabetic';
}

/* kasir: counter + POS (monitor, keypad, receipt printer, cash drawer) + EDC terminal with status LED */
function drawCounter(u, v, G) {
  const k = S / 46, u1 = u + 2.2, v1 = v + 0.9;
  box(u, v, u1, v1, 0, 0.95, '#f0e6d4', '#7a5a40', '#9a7a55');
  // front kick + laminate stripe
  poly([P(u, v1, 0.62), P(u1, v1, 0.62), P(u1, v1, 0.7), P(u, v1, 0.7)], '#c0392b');
  // cash drawer (slides out on a cash payment)
  const dr = G && G.drawer > 0 ? Math.min(1, G.drawer * 3) * 0.22 : 0;
  box(u + 1.3, v + 0.15 + dr, u + 2.05, v + 0.72 + dr, 0.95, 1.07, '#3a3a44', '#22222a', '#2a2a32');
  if (dr) { for (let i = 0; i < 4; i++) { const q = P(u + 1.4 + i * 0.16, v + 0.72 + dr, 1.07); ctx.fillStyle = ['#7a4a9a', '#3a8a4a', '#3a6ab0', '#b03a3a'][i]; ctx.fillRect(q[0] - 4 * k, q[1] - 2 * k, 8 * k, 2 * k); } }
  const dh = P(u + 1.68, v + 0.72 + dr, 1.01); ctx.fillStyle = '#999'; ctx.fillRect(dh[0] - 6 * k, dh[1] - 1, 12 * k, 2);
  // keypad block
  box(u + 1.35, v + 0.45, u + 1.75, v + 0.7, 1.07, 1.13, '#2c2c34', '#1a1a20', '#202028');
  for (let r = 0; r < 3; r++) for (let c2 = 0; c2 < 4; c2++) { const q = P(u + 1.4 + c2 * 0.085, v + 0.5 + r * 0.065, 1.13); ctx.fillStyle = r === 2 && c2 === 3 ? '#3ecf8e' : '#d8d8e0'; ctx.fillRect(q[0] - 1.5 * k, q[1] - 1 * k, 3 * k, 2 * k); }
  // monitor on a stand (customer-facing screen)
  const st0 = P(u + 1.85, v + 0.35, 1.07), st1 = P(u + 1.85, v + 0.35, 1.32); ctx.strokeStyle = '#333'; ctx.lineWidth = 3 * k; ctx.beginPath(); ctx.moveTo(st0[0], st0[1]); ctx.lineTo(st1[0], st1[1]); ctx.stroke();
  const m = [P(u + 1.55, v + 0.4, 1.3), P(u + 2.1, v + 0.4, 1.3), P(u + 2.1, v + 0.4, 1.72), P(u + 1.55, v + 0.4, 1.72)];
  poly(m, '#1a1a22', '#444', 1.5);
  const sc2 = [P(u + 1.59, v + 0.4, 1.34), P(u + 2.06, v + 0.4, 1.34), P(u + 2.06, v + 0.4, 1.68), P(u + 1.59, v + 0.4, 1.68)];
  poly(sc2, '#1f4a6a');
  const tx = P(u + 1.82, v + 0.4, 1.52); ctx.fillStyle = '#bfe8ff'; ctx.font = '700 ' + Math.max(6, 7 * k) + 'px system-ui'; ctx.textAlign = 'center';
  ctx.fillText(G && G.current ? 'Rp' + (G.current.total || 0).toLocaleString('id-ID') : 'KASIR 1', tx[0], tx[1]);
  // receipt printer + paper stub
  box(u + 1.05, v + 0.2, u + 1.3, v + 0.45, 0.95, 1.1, '#e8e8ec', '#9a9aa4', '#b0b0ba');
  poly([P(u + 1.1, v + 0.45, 1.1), P(u + 1.25, v + 0.45, 1.1), P(u + 1.25, v + 0.52, 1.24), P(u + 1.1, v + 0.52, 1.24)], '#fff', '#ccc', 0.6);
  // EDC terminal (QRIS) on a small mount + status LED
  box(u + 0.55, v + 0.3, u + 0.8, v + 0.62, 0.95, 1.0, '#555', '#333', '#444');
  box(u + 0.58, v + 0.33, u + 0.78, v + 0.6, 1.0, 1.12, '#24242c', '#14141a', '#1a1a22');
  const es = [P(u + 0.6, v + 0.36, 1.12), P(u + 0.76, v + 0.36, 1.12), P(u + 0.76, v + 0.46, 1.12), P(u + 0.6, v + 0.46, 1.12)];
  const qg = G && (G.current ? G.current.qg : G.active.some(q => q.qg && q.state === 'queue' && !q.qi)) && Math.sin(Date.now() / 90) > 0, est = qg ? 'bad' : G && G.edc ? G.edc.s : 'idle'; // qris_ghost: LED blinks red
  poly(es, est === 'ok' ? '#3ecf8e' : est === 'bad' ? '#e85a5a' : est === 'wait' ? '#e8d070' : '#8ab0a0');
  for (let r = 0; r < 2; r++) for (let c2 = 0; c2 < 3; c2++) { const q = P(u + 0.62 + c2 * 0.05, v + 0.5 + r * 0.04, 1.12); ctx.fillStyle = '#ccc'; ctx.fillRect(q[0] - 1, q[1] - 0.6, 2, 1.4); }
  const led = P(u + 0.77, v + 0.34, 1.13);
  ctx.fillStyle = est === 'ok' ? '#3eff8e' : est === 'bad' ? '#ff4040' : est === 'wait' ? '#ffd040' : '#40a0ff';
  ctx.beginPath(); ctx.arc(led[0], led[1], 2.2 * k, 0, TAU); ctx.fill();
  if (est !== 'idle') { ctx.fillStyle = est === 'ok' ? 'rgba(62,255,142,.3)' : est === 'bad' ? 'rgba(255,64,64,.3)' : 'rgba(255,208,64,.3)'; ctx.beginPath(); ctx.arc(led[0], led[1], 6 * k, 0, TAU); ctx.fill(); }
  // QRIS standee
  const qs = [P(u + 0.15, v + 0.4, 0.95), P(u + 0.4, v + 0.4, 0.95), P(u + 0.4, v + 0.4, 1.3), P(u + 0.15, v + 0.4, 1.3)];
  poly(qs, '#fff', '#c0392b', 1.2);
  const qc = P(u + 0.275, v + 0.4, 1.12); ctx.fillStyle = '#111';
  for (let i = 0; i < 16; i++) if (hash(i * 7 + 3) > 0.45) ctx.fillRect(qc[0] - 5 * k + (i % 4) * 2.5 * k, qc[1] - 5 * k + ((i / 4) | 0) * 2.5 * k, 2.2 * k, 2.2 * k);
}

function drawFloor() {
  for (let u = 0; u < 8; u++) for (let v = 0; v < 9; v++) {
    const top = ((u + v) & 1) ? '#d8c8b0' : '#cbb89e';
    poly([P(u, v, 0), P(u + 1, v, 0), P(u + 1, v + 1, 0), P(u, v + 1, 0)], top, 'rgba(90,70,50,.15)', 1);
  }
  // door mat at the entrance
  poly([P(0, 4.05, 0), P(0.7, 4.05, 0), P(0.7, 5.15, 0), P(0, 5.15, 0)], '#5a4030', 'rgba(0,0,0,.3)', 1);
}

const WALL_H = 2.6;
function drawWalls() {
  for (let u = 0; u < 8; u++) poly([P(u, 0, 0), P(u + 1, 0, 0), P(u + 1, 0, WALL_H), P(u, 0, WALL_H)], mix('#6a3a55', '#3a2038', u / 8), 'rgba(0,0,0,.2)', 1);
  glassWall(drawWalls.t || 0);
  // pintu kaca (front door) on the side wall
  poly([P(0, 3.95, 0), P(0, 5.25, 0), P(0, 5.25, 2.0), P(0, 3.95, 2.0)], '#9a9aa8');
  poly([P(0, 4.05, 0.02), P(0, 5.15, 0.02), P(0, 5.15, 1.92), P(0, 4.05, 1.92)], 'rgba(40,70,90,.85)');
  poly([P(0, 4.6, 0), P(0, 4.64, 0), P(0, 4.64, 1.92), P(0, 4.6, 1.92)], '#9a9aa8');
  const st = P(0, 4.35, 1.1), k = S / 46; ctx.fillStyle = '#e8b84a'; ctx.font = '800 ' + Math.max(6, 6 * k) + 'px system-ui'; ctx.textAlign = 'center'; ctx.fillText('DORONG', st[0], st[1]);
  // wall sign: plaque flush on the back wall plane (v=0) with drop shadow + 4 screws, text skewed to the wall
  const su0 = 2.4, su1 = 4.8, z0 = 1.75, z1 = 2.3;
  poly([P(su0 + 0.05, 0.001, z0 - 0.06), P(su1 + 0.05, 0.001, z0 - 0.06), P(su1 + 0.05, 0.001, z1 - 0.06), P(su0 + 0.05, 0.001, z1 - 0.06)], 'rgba(0,0,0,.35)');
  poly([P(su0, 0.002, z0), P(su1, 0.002, z0), P(su1, 0.002, z1), P(su0, 0.002, z1)], '#c0392b', '#7a1a14', 1.5);
  poly([P(su0 + 0.06, 0.002, z0 + 0.05), P(su1 - 0.06, 0.002, z0 + 0.05), P(su1 - 0.06, 0.002, z1 - 0.05), P(su0 + 0.06, 0.002, z1 - 0.05)], null, 'rgba(255,230,180,.6)', 1);
  for (const [uu, zz] of [[su0 + 0.08, z0 + 0.08], [su1 - 0.08, z0 + 0.08], [su0 + 0.08, z1 - 0.08], [su1 - 0.08, z1 - 0.08]]) { const q = P(uu, 0.002, zz); ctx.fillStyle = '#ddd'; ctx.beginPath(); ctx.arc(q[0], q[1], 1.4 * k, 0, TAU); ctx.fill(); }
  const c0 = P((su0 + su1) / 2, 0.002, (z0 + z1) / 2 - 0.08);
  ctx.save(); ctx.translate(c0[0], c0[1]); ctx.transform(1, 0.5 / 0.866, 0, 1, 0, 0);
  ctx.fillStyle = '#fff3c0'; ctx.font = '900 ' + Math.round(11 * k) + 'px system-ui'; ctx.textAlign = 'center'; ctx.fillText('MINI MARKET 24 JAM', 0, 0);
  ctx.restore();
}

/* ---------- Art-P0.9 storefront: street seen through the side-wall glass. Pure visual: no hits, no nameplates. ---------- */
const amb = { list: [], next: { car: 2, ped: 1, ghost: 30 }, n: 0 };
const AMB = { latihan: [7, 6, 0], tut: [9, 8, 0], biasa: [5, 4, 150], malam: [4, 5, 45] }; // [car gap s, pedestrian gap s, ghost gap s (0 = off)]
function ambStep(mode, dt) {
  const cfg = AMB[mode] || AMB.biasa, rnd = () => hash(++amb.n * 7919);
  for (const k of ['car', 'ped', 'ghost']) {
    amb.next[k] -= dt;
    if (amb.next[k] > 0) continue;
    const gap = cfg[k === 'car' ? 0 : k === 'ped' ? 1 : 2];
    if (!gap) { amb.next[k] = 999; continue; }
    amb.next[k] = gap * (0.6 + rnd() * 0.9);
    const dir = rnd() < 0.5 ? 1 : -1, moto = k === 'car' && rnd() < 0.45;
    amb.list.push({ k, dir, moto, v: dir > 0 ? -3 : 12, u: k === 'car' ? (dir > 0 ? -2.6 : -1.9) : k === 'ghost' ? -1.45 : -0.95 - rnd() * 0.3,
      sp: k === 'car' ? (moto ? 4.2 : 3.2) : k === 'ghost' ? 0.7 : 0.9 + rnd() * 0.3, col: ['#c0392b', '#e8e8e8', '#2f6fb8', '#333', '#e8b84a'][(rnd() * 5) | 0],
      tr: { skin: ['#c68a5a', '#a86c43', '#e0b090'][(rnd() * 3) | 0], hair: '#1a1210', shirt: ['#2f6fb8', '#2e8b57', '#6d3fa0', '#e67e22'][(rnd() * 4) | 0], gender: rnd() < 0.5 ? 'L' : 'P', face: { band: 'dewasa', hair: rnd() < 0.5 ? 'cepak' : 'panjang' } }, ph: 0 });
  }
  for (const a of amb.list) { a.v += a.dir * a.sp * dt; a.ph += a.sp * dt * 9; }
  amb.list = amb.list.filter(a => a.v > -4 && a.v < 13);
}
function drawStreet(t) {
  // road + kerb + sidewalk outside the glass wall (u < 0)
  poly([P(-3.4, -3, 0), P(-1.5, -3, 0), P(-1.5, 13, 0), P(-3.4, 13, 0)], '#15141c');
  for (let v = -3; v < 13; v += 1.4) poly([P(-2.3, v, 0), P(-2.2, v, 0), P(-2.2, v + 0.6, 0), P(-2.3, v + 0.6, 0)], '#6a6a5a');
  poly([P(-1.5, -3, 0), P(0, -3, 0), P(0, 13, 0), P(-1.5, 13, 0)], '#3a3442');
  poly([P(-1.55, -3, 0), P(-1.45, -3, 0), P(-1.45, 13, 0), P(-1.55, 13, 0)], '#8a8490');
  // street lamp pool
  const l = P(-1.3, 6.5, 0), g = ctx.createRadialGradient(l[0], l[1], 0, l[0], l[1], S * 2.2);
  g.addColorStop(0, 'rgba(255,200,120,.28)'); g.addColorStop(1, 'rgba(255,200,120,0)'); ctx.fillStyle = g; ctx.fillRect(l[0] - S * 2.2, l[1] - S * 2.2, S * 4.4, S * 4.4);
  const sorted = amb.list.slice().sort((a, b) => (a.u + a.v) - (b.u + b.v));
  for (const a of sorted) {
    if (a.k === 'car') {
      const v0 = a.v, len = a.moto ? 0.6 : 1.5, w = a.moto ? 0.18 : 0.65, u0 = a.u - w / 2;
      box(u0, v0, u0 + w, v0 + len, 0.12, a.moto ? 0.45 : 0.5, a.col, mix(a.col, '#000000', 0.4), mix(a.col, '#000000', 0.25));
      if (!a.moto) box(u0 + 0.06, v0 + 0.35, u0 + w - 0.06, v0 + len - 0.3, 0.5, 0.78, '#2a3a4a', '#1a2430', '#22303c');
      else { const r = P(a.u, v0 + 0.3, 0.5); person(a.u, v0 + 0.3, 0.6, { skin: a.tr.skin, hair: '#111', shirt: a.tr.shirt, hat: true, face: a.tr.face }, t); void r; }
      const hl = P(a.u, a.dir > 0 ? v0 + len : v0, 0.3), hg = ctx.createRadialGradient(hl[0], hl[1], 0, hl[0], hl[1], S * 0.9);
      hg.addColorStop(0, 'rgba(255,250,210,.55)'); hg.addColorStop(1, 'rgba(255,250,210,0)'); ctx.fillStyle = hg; ctx.fillRect(hl[0] - S, hl[1] - S, S * 2, S * 2);
      const tl = P(a.u, a.dir > 0 ? v0 : v0 + len, 0.3); ctx.fillStyle = '#ff3030'; ctx.fillRect(tl[0] - 2, tl[1] - 1, 4, 2);
    } else if (a.k === 'ped') {
      person(a.u, a.v, 0.85, { skin: a.tr.skin, hair: a.tr.hair, shirt: a.tr.shirt, gender: a.tr.gender, face: a.tr.face, moving: true, walk: a.ph, facing: a.dir > 0 ? Math.PI / 2 : -Math.PI / 2 }, t);
    } else { // rare hantu walk-by: translucent pocong silhouette hopping, no nameplate, never interactive
      const p = P(a.u, a.v, 0), hop = Math.abs(Math.sin(a.ph * 0.5)) * 8;
      ctx.save(); ctx.globalAlpha = 0.38; ctx.fillStyle = '#f4f0e8';
      ctx.beginPath(); ctx.ellipse(p[0], p[1] - 26 - hop, 8, 24, 0, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.arc(p[0], p[1] - 52 - hop, 3, 0, TAU); ctx.fill(); ctx.restore();
    }
  }
  // dim the outside a little (night through glass)
}
/* side wall = glass storefront: kick + header opaque, glass bands translucent with glare and mullions */
function glassWall(t) {
  const segs = [[3.0, 3.9], [5.35, 9]];
  for (let v = 0; v < 9; v++) {
    const col = mix('#4a3050', '#2a1830', v / 9), open = segs.find(s => v + 0.5 > s[0] && v + 0.5 < s[1]);
    if (!open && !(v >= 3.95 && v < 5.25)) { poly([P(0, v, 0), P(0, v + 1, 0), P(0, v + 1, WALL_H), P(0, v, WALL_H)], col, 'rgba(0,0,0,.2)', 1); continue; }
    poly([P(0, v, 0), P(0, v + 1, 0), P(0, v + 1, 0.4), P(0, v, 0.4)], col, 'rgba(0,0,0,.2)', 1);
    poly([P(0, v, 2.05), P(0, v + 1, 2.05), P(0, v + 1, WALL_H), P(0, v, WALL_H)], col, 'rgba(0,0,0,.2)', 1);
  }
  for (const s of segs) {
    const a = P(0, s[0], 0.4), b = P(0, s[1], 0.4), c = P(0, s[1], 2.05), d = P(0, s[0], 2.05);
    const g = ctx.createLinearGradient(d[0], d[1], b[0], b[1]); g.addColorStop(0, 'rgba(150,200,235,.22)'); g.addColorStop(1, 'rgba(60,90,130,.18)');
    poly([a, b, c, d], g, '#9a9aa8', 2);
    for (let m = s[0] + 1.1; m < s[1] - 0.2; m += 1.1) poly([P(0, m, 0.4), P(0, m + 0.04, 0.4), P(0, m + 0.04, 2.05), P(0, m, 2.05)], '#8a8a98');
    const gx = (t * 0.25) % 1, q0 = P(0, s[0] + (s[1] - s[0]) * gx, 1.95), q1 = P(0, s[0] + (s[1] - s[0]) * gx + 0.5, 0.5);
    ctx.strokeStyle = 'rgba(255,255,255,.16)'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(q0[0], q0[1]); ctx.lineTo(q1[0], q1[1]); ctx.stroke();
  }
  // window sticker
  const st = P(0, 6.2, 1.5), k = S / 46; ctx.fillStyle = 'rgba(232,184,74,.8)'; ctx.font = '800 ' + Math.max(6, 7 * k) + 'px system-ui'; ctx.textAlign = 'center'; ctx.fillText('BUKA 24 JAM', st[0], st[1]);
}

const hits = [];
let debugSolids = false;
const order = []; // last frame's draw order (tests: person vs prop occlusion)
function setDebugSolids(on) { debugSolids = !!on; }
const PLAYER_FACE = { band: 'muda', hair: 'lurus', cut: 'cepak', top: 'kemeja', bottom: 'jeans', foot: 'sneaker', glasses: 'none', mask: 'off', eye: 'bulat', brow: 2.2, nose: 'kecil', mouth: 'senyum', tall: 1, wide: 1 };
function frame(c, w, h, G, t, dt) {
  ctx = c; W = w; H = h; hits.length = 0;
  S = Math.min(W, H) / 9.2;
  CU = lerp(CU, G.px, 0.08); CV = lerp(CV, G.py - 0.8, 0.08);
  AX = W * 0.5; AY = H * 0.38;
  // keep the wall sign below the HUD band (top ~22% of the screen)
  const signTop = P(3.6, 0, 2.3)[1], minY = H * 0.24;
  if (signTop < minY) AY += Math.min(minY - signTop, H * 0.22);
  const shake = G.shake > 0 ? (Math.sin(t * 40) * 4 * G.shake) : 0;
  ctx.save();
  ctx.translate(shake, shake * 0.6);
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#1a1028'); bg.addColorStop(1, '#0e0a14');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

  ambStep(G.mode, dt || 0.016); drawStreet(t);
  drawWalls.t = t; drawWalls();
  drawFloor();

  /* Depth: props are boxes, people are points. A single key per prop mis-sorts long props (a 1.6-wide gondola put
     the cashier in the aisle in front of it), so draw order comes from a box-vs-point topological sort below. */
  const PROPS = [
    { b: [0.3, 1.0, 1.2, 1.7], f: () => drawFridge(0.3, 1.0) },
    { b: [0.3, 2.0, 1.2, 2.7], f: () => drawFridge(0.3, 2.0) },
    { b: [5.2, 0.8, 6.8, 1.35], f: () => drawShelfUnit(5.2, 0.8, G.shelf, 0) },
    { b: [5.2, 2.0, 6.8, 2.55], f: () => drawShelfUnit(5.2, 2.0, G.shelf, 4) },
    { b: [1.4, 6.2, 3.6, 7.1], f: () => drawCounter(1.4, 6.2, G) }
  ];
  for (let i = 0; i < 3; i++) {
    const p = P(2 + i * 2, 4, 2.5);
    const g = ctx.createRadialGradient(p[0], p[1], 0, p[0], p[1], 80);
    g.addColorStop(0, 'rgba(255,230,180,.12)'); g.addColorStop(1, 'rgba(255,230,180,0)');
    ctx.fillStyle = g; ctx.fillRect(p[0] - 80, p[1] - 40, 160, 120);
  }
  const PK = S / 40.8; // people scale with the shop (phones ≈ 1)
  const people = [];
  order.length = 0;
  people.push({ id: 'player', u: G.px, v: G.py, f: () => {
    person(G.px, G.py, 0.95 * PK, { skin: '#d49a6a', hair: '#2a1810', shirt: '#e8b84a', pants: '#1c2436', hat: true, apron: true, face: PLAYER_FACE, gender: 'L',
      moving: G.pMoving, walk: G.pWalk, facing: G.pFacing }, t);
  }});
  const tags = [];
  for (const cust of G.active) {
    if (cust.served) continue;
    people.push({ id: 'c' + cust.id, u: cust.u, v: cust.v, f: () => {
      const fade = clamp((cust.u + 0.75) / 0.9, 0, 1); // walking in through the glass door
      const sc = 0.9 * PK, sh = 58 * sc * ((cust.traits.face && cust.traits.face.tall) || 1);
      ctx.globalAlpha = fade;
      person(cust.u, cust.v, sc, {
        skin: cust.traits.skin, hair: cust.traits.hair, shirt: cust.traits.shirt, hat: cust.traits.hat, gender: cust.traits.gender, face: cust.traits.face,
        float: cust.floatFeet, noShadow: cust.noShadow, redEyes: cust.redEyes, cold: cust.cold, basket: true, lk: cust.lk, wet: cust.wet,
        moving: cust.moving, walk: cust.walkPh, facing: cust.facing, reach: cust.state === 'browse',
        items: cust.browsed || cust.state === 'queue' ? Math.min(3, cust.basket.length) : 0
      }, t);
      ctx.globalAlpha = 1;
      if (fade < 1) return;
      // name tag tied to this sprite's own feet anchor every frame (same P() as the body)
      const feet = P(cust.u, cust.v, 0), lift = cust.floatFeet ? 10 * sc : 0;
      const tag = { c: cust, x: feet[0], y: feet[1] - sh - lift - 12 * PK, fx: feet[0], fy: feet[1], h: sh };
      hits.push({ c: cust, x: feet[0], y: feet[1] - sh * 0.5, tag, z: hits.length, b: [feet[0] - 15 * sc, feet[1] - sh - lift, feet[0] + 15 * sc, feet[1] + 4] }); // b = body box; z = draw order (higher = in front)
      tags.push(tag);
      if (cust === G.current) { ctx.strokeStyle = '#e8b84a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(feet[0], feet[1], 18 * PK, 0, TAU); ctx.stroke(); }
    }});
  }
  for (const cust of G.exiting || []) { // served / angry customers walk back out (no tag, no hit)
    people.push({ id: 'x' + cust.id, u: cust.u, v: cust.v, f: () => {
      ctx.globalAlpha = clamp((cust.u + 0.75) / 0.9, 0, 1);
      person(cust.u, cust.v, 0.9 * PK, { skin: cust.traits.skin, hair: cust.traits.hair, shirt: cust.traits.shirt, hat: cust.traits.hat, gender: cust.traits.gender, face: cust.traits.face,
        float: cust.floatFeet, noShadow: cust.noShadow, redEyes: cust.redEyes, basket: true, lk: cust.lk, wet: cust.wet, moving: true, walk: cust.walkPh, facing: cust.facing, items: Math.min(3, cust.basket.length) }, t);
      ctx.globalAlpha = 1;
    }});
  }
  const reflect = G.active.filter(c => !c.served && !c.noReflect && Math.hypot(c.u - 0.7, c.v - 2.6) < 2.0);
  // nodes: props (boxes) + people (points). Box B is behind point p if B.u1<=p.u or B.v1<=p.v; p is behind B if p.u<=B.u0 or p.v<=B.v0.
  // Only an unambiguous relation becomes an edge; the rest falls back to the u+v key. Kahn topo sort (n ≈ 20).
  const nodes = PROPS.map((p, i) => ({ id: 'prop' + i, box: p.b, d: (p.b[0] + p.b[2]) / 2 + (p.b[1] + p.b[3]) / 2, f: i === 1 ? () => { p.f(); for (const cust of reflect) { const q = P(0.55, 2.7, 1.0); ctx.globalAlpha = 0.35; ctx.fillStyle = cust.traits.skin; ctx.beginPath(); ctx.ellipse(q[0], q[1], 5, 7, 0, 0, TAU); ctx.fill(); ctx.globalAlpha = 1; } } : p.f }))
    .concat(people.map(p => ({ id: p.id, u: p.u, v: p.v, d: p.u + p.v, f: p.f })));
  const before = (a, b) => { // true if a must be drawn before b
    if (a.box && b.box) return a.d < b.d;
    if (a.box || b.box) {
      const B = a.box ? a : b, q = a.box ? b : a, bb = B.box;
      const boxBehind = bb[2] <= q.u + 0.02 || bb[3] <= q.v + 0.02, ptBehind = q.u <= bb[0] + 0.02 || q.v <= bb[1] + 0.02;
      if (boxBehind !== ptBehind) return a.box ? boxBehind : ptBehind;
      return null;
    }
    return null;
  };
  const indeg = nodes.map(() => 0), out = nodes.map(() => []);
  for (let i = 0; i < nodes.length; i++) for (let j = 0; j < nodes.length; j++) if (i !== j && before(nodes[i], nodes[j]) === true) { out[i].push(j); indeg[j]++; }
  const done = new Array(nodes.length).fill(false);
  for (let n = 0; n < nodes.length; n++) {
    let pick = -1;
    for (let i = 0; i < nodes.length; i++) if (!done[i] && indeg[i] === 0 && (pick < 0 || nodes[i].d < nodes[pick].d)) pick = i;
    if (pick < 0) for (let i = 0; i < nodes.length; i++) if (!done[i] && (pick < 0 || nodes[i].d < nodes[pick].d)) pick = i; // cycle guard
    done[pick] = true; for (const j of out[pick]) indeg[j]--;
    order.push(nodes[pick].id); nodes[pick].f();
  }
  // name tags last, so a prop drawn later never hides them (each still sits on its own sprite)
  ctx.font = 'bold ' + Math.round(10 * Math.max(1, PK * 0.9)) + 'px system-ui'; ctx.textAlign = 'center';
  for (const tg of tags) {
    const txt = (tg.c.state === 'browse' ? '🛒 ' : '') + tg.c.spoken, w = Math.max(48, ctx.measureText(txt).width + 14), hh = 16 * Math.max(1, PK * 0.9);
    ctx.fillStyle = 'rgba(10,8,14,.72)'; ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(tg.x - w / 2, tg.y - hh / 2, w, hh, 6) : ctx.rect(tg.x - w / 2, tg.y - hh / 2, w, hh); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.fillText(txt, tg.x, tg.y + hh * 0.22);
    tg.r = [tg.x - w / 2 - hh, tg.y - hh / 2 - 2, tg.x + w / 2 + 2, tg.y + hh / 2 + 2]; // tappable tag rect (incl. patience ring)
    const c = tg.c;
    if (c.pat != null && c.patMax && c !== G.current) { // patience ring: full = calm, drains to red; at 0 they leave (ghost vanishes)
      const f = clamp(c.pat / c.patMax, 0, 1), rx = tg.x - w / 2 - hh * 0.55, ry = tg.y, rr = hh * 0.5;
      ctx.fillStyle = 'rgba(10,8,14,.8)'; ctx.beginPath(); ctx.arc(rx, ry, rr + 2, 0, TAU); ctx.fill();
      ctx.strokeStyle = f > 0.5 ? '#6fe08a' : f > 0.25 ? '#f2c14e' : '#ff5050'; ctx.lineWidth = Math.max(2.5, rr * 0.45);
      ctx.beginPath(); ctx.arc(rx, ry, rr, -Math.PI / 2, -Math.PI / 2 + TAU * f); ctx.stroke();
      if (f <= 0.25 && ((t * 4) | 0) % 2) { ctx.fillStyle = '#ff5050'; ctx.beginPath(); ctx.arc(rx, ry, rr * 0.35, 0, TAU); ctx.fill(); }
    }
  }
  if (debugSolids && root.AM) { // ?debug=solids · #debugsolids · localStorage anomaliminimarket.debugSolids=1
    ctx.lineWidth = 1.5;
    for (const b of root.AM.SOLIDS) {
      const r = root.AM.PR || 0.22;
      poly([P(b[0] - r, b[1] - r, 0), P(b[2] + r, b[1] - r, 0), P(b[2] + r, b[3] + r, 0), P(b[0] - r, b[3] + r, 0)], 'rgba(255,200,0,.12)', 'rgba(255,200,0,.8)', 1);
      poly([P(b[0], b[1], 0), P(b[2], b[1], 0), P(b[2], b[3], 0), P(b[0], b[3], 0)], 'rgba(255,40,80,.28)', '#ff2850', 1.5);
      for (const q of [[b[0], b[3]], [b[2], b[3]], [b[2], b[1]]]) { const a = P(q[0], q[1], 0), c2 = P(q[0], q[1], 1.6); ctx.strokeStyle = 'rgba(255,40,80,.6)'; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(c2[0], c2[1]); ctx.stroke(); }
    }
    const pp = P(G.px, G.py, 0); ctx.strokeStyle = '#00e0ff'; ctx.beginPath(); ctx.ellipse(pp[0], pp[1], (root.AM.PR || 0.22) * S * 1.22, (root.AM.PR || 0.22) * S * 0.7, 0, 0, TAU); ctx.stroke();
    ctx.fillStyle = '#ff2850'; ctx.font = 'bold 11px system-ui'; ctx.textAlign = 'left'; ctx.fillText('DEBUG SOLIDS', 8, H - 8);
  }

  if (G.active.some(c => c.cold && !c.served)) {
    const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.2, W / 2, H / 2, H * 0.75);
    g.addColorStop(0, 'rgba(120,180,255,0)'); g.addColorStop(1, 'rgba(40,80,140,.22)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }
  if (G.clockSkew) { ctx.fillStyle = 'rgba(180,40,40,.12)'; ctx.fillRect(0, 0, W, H); }
  // ≤0.4s edge flash: catch = cyan/violet, pay = gold (canvas only → always under sheets)
  if (G.flash > 0) {
    const a = clamp(G.flash / 0.35, 0, 1) * 0.5, col = G.flashKind === 'catch' ? '120,200,255' : '255,210,90';
    const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.8);
    g.addColorStop(0, 'rgba(' + col + ',0)'); g.addColorStop(1, 'rgba(' + col + ',' + a + ')');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }
  ctx.restore();
}

function hero(c, w, h, t) {
  ctx = c; W = w; H = h; S = Math.min(W, H) / 7; CU = 3; CV = 3.5; AX = W * 0.5; AY = H * 0.55;
  ctx.fillStyle = '#1a1028'; ctx.fillRect(0, 0, W, H);
  drawFloor();
  drawCounter(1.5, 4.5, null);
  person(3.2, 3.2, 1.1, { skin: '#d49a6a', hair: '#1a1010', shirt: '#e8b84a', pants: '#1c2436', hat: true, apron: true, face: PLAYER_FACE, moving: true, walk: t * 6, facing: 0 }, t);
  person(4.4, 3.6, 1.0, { skin: '#a86c43', hair: '#0d0d0d', shirt: '#6d3fa0', gender: 'P', face: { band: 'dewasa', hair: 'panjang', eye: 'lebar', nose: 'kecil', mouth: 'datar', tall: 1.05 }, float: true, noShadow: true, redEyes: true, basket: true }, t);
  ctx.fillStyle = 'rgba(10,6,16,.35)'; ctx.fillRect(0, 0, W, H);
}

/* KTP pas-foto: blue/red studio backdrop, head + shoulders */
function drawKtpFace(cv, traits) {
  const c = cv.getContext('2d'); const w = cv.width, h = cv.height;
  const bg = c.createLinearGradient(0, 0, 0, h); bg.addColorStop(0, '#c0392b'); bg.addColorStop(1, '#a02a20');
  c.fillStyle = traits.gender === 'P' ? '#2f6fb8' : bg; c.fillRect(0, 0, w, h);
  // same layered figure as the world sprite, framed head + shoulders (top/hair/glasses/mask match)
  const sc = w * 0.25 / 7.4, fh = 58 * sc * ((traits.face && traits.face.tall) || 1);
  ctx = c; c.save(); c.translate(w / 2, h * 0.44 + fh * 0.92); fig(sc, Object.assign({}, traits, { hat: false }), 0, 0, false); c.restore();
  if (traits.glitch) for (let i = 0; i < 5; i++) { c.fillStyle = i & 1 ? 'rgba(0,255,230,.55)' : 'rgba(255,0,170,.5)'; const y = h * (0.12 + i * 0.19 + Math.random() * 0.05); c.fillRect(Math.random() * 6 - 3, y, w, 2 + i % 3); c.drawImage(c.canvas, 0, y, w, 6, 4 + i, y, w, 6); }
  c.strokeStyle = 'rgba(0,0,0,.25)'; c.strokeRect(0.5, 0.5, w - 1, h - 1);
}

function drawCustomerPortrait(cv, cust, t) {
  const c = cv.getContext('2d'); const w = cv.width, h = cv.height;
  ctx = c;
  const bg = c.createLinearGradient(0, 0, 0, h); bg.addColorStop(0, '#3a2a40'); bg.addColorStop(1, '#1f1826');
  c.fillStyle = bg; c.fillRect(0, 0, w, h);
  // fridge glass strip (reflection check)
  c.fillStyle = 'rgba(160,210,230,.25)'; c.fillRect(w - 36, 10, 28, h - 20);
  c.strokeStyle = 'rgba(255,255,255,.3)'; c.strokeRect(w - 36, 10, 28, h - 20);
  if (!cust.noReflect) { c.globalAlpha = 0.45; c.fillStyle = cust.traits.skin; c.beginPath(); c.ellipse(w - 22, 70, 8, 11, 0, 0, TAU); c.fill(); c.fillStyle = cust.traits.shirt; c.fillRect(w - 30, 82, 16, 22); c.globalAlpha = 1; }
  else { c.fillStyle = 'rgba(255,80,80,.6)'; c.font = 'bold 12px system-ui'; c.fillText('?', w - 26, 74); }
  const x = w * 0.56, y = h * 0.95;
  if (!cust.noShadow) { c.fillStyle = 'rgba(0,0,0,.4)'; c.beginPath(); c.ellipse(x, y + 2, 34, 9, 0, 0, TAU); c.fill(); }
  c.save(); c.translate(x, y + (cust.floatFeet ? -16 - Math.sin(t * 3) * 4 : 0));
  fig(2.5, Object.assign({}, cust.traits, { redEyes: cust.redEyes, float: cust.floatFeet, basket: true, lk: cust.lk, wet: cust.wet, items: Math.min(3, cust.basket.length) }), t, 0, false);
  c.restore();
  // close-up face inset (readable at phone scale)
  c.save(); c.beginPath(); c.arc(44, 46, 38, 0, TAU); c.fillStyle = '#e8dcc8'; c.fill(); c.lineWidth = 3; c.strokeStyle = '#e8b84a'; c.stroke(); c.clip();
  const isc = 24 / 7.4; c.translate(44, 42 + 58 * isc * ((cust.traits.face && cust.traits.face.tall) || 1) * 0.92); fig(isc, Object.assign({}, cust.traits, { redEyes: cust.redEyes, lk: cust.lk === 'tuyul' ? '' : cust.lk }), t, 0, false);
  c.restore();
}

root.AR = { pantsOf, figure: (c, x, y, sc, o, t) => { ctx = c; c.save(); c.translate(x, y); fig(sc, o, t || 0, 0, false); c.restore(); }, frame, hero, drawKtpFace, drawCustomerPortrait, drawFace, P, hits, order, setDebugSolids, get debugSolids() { return debugSolids; } };
})(typeof window !== 'undefined' ? window : global);

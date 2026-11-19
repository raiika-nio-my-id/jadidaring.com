/* Ikan Rakus renderer (canvas 2D). window.IRRender */
(function (root) {
'use strict';
const S = root.IRSim, TAU = Math.PI * 2;
const LOOK = {
  teri:     { L: 2.9, H: 0.78, back: '#7d9fb4', belly: '#eef6fa', fin: '#b9d3e0', stripe: '#d8e9f2' },
  badut:    { L: 2.2, H: 1.2, back: '#ff7a1a', belly: '#ffa24d', fin: '#ff8c2e', bands: '#ffffff', edge: '#1b1b1b' },
  kembung:  { L: 2.6, H: 0.95, back: '#2f7aa6', belly: '#dbe9ef', fin: '#e6c14a', dots: '#123b56' },
  baronang: { L: 2.05, H: 1.6, back: '#a88a2e', belly: '#f1dc8c', fin: '#d8b84a', spots: '#6d5615' },
  kakap:    { L: 2.4, H: 1.25, back: '#d8344f', belly: '#ff9aa6', fin: '#e8546b' },
  kerapu:   { L: 2.35, H: 1.35, back: '#7a5a3a', belly: '#c9a67a', fin: '#5e4128', spots: '#3e2a17', bigMouth: true },
  barakuda: { L: 3.6, H: 0.62, back: '#566b7d', belly: '#dfe7ee', fin: '#3b4b58', bars: '#2c3a46', jaw: true },
  hiu:      { L: 3.1, H: 0.82, back: '#6f8597', belly: '#eef2f5', fin: '#5b6f80', shark: true },
  macan:    { L: 3.2, H: 0.86, back: '#5b6a55', belly: '#e9ecdf', fin: '#465440', shark: true, bars: '#2f3a2a' },
  pshark:   { L: 3.0, H: 0.95, back: '#a9c4d6', belly: '#ffffff', fin: '#7f9fb5', shark: true, player: true, noCheek: true },
  player:   { L: 2.25, H: 1.3, back: '#10b6c9', belly: '#c9fbff', fin: '#ffcf3a', player: true }
};
function rr(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
/** draw a fish centred at 0,0 facing +x, radius r (body half-height ~ r*H/2) */
function fish(c, key, r, t, o) {
  o = o || {}; const lk = LOOK[key], L = r * lk.L, H = r * lk.H, hl = L / 2, wag = Math.sin(t * (o.fast ? 16 : 9)) * 0.28;
  c.save();
  if (o.dead) { c.scale(1, -1); c.globalAlpha *= 0.7; }
  // tail
  c.save(); c.translate(-hl * 0.86, 0); c.rotate(wag); c.fillStyle = lk.fin; c.beginPath();
  if (lk.shark) { c.moveTo(0, 0); c.lineTo(-r * 0.95, -H * 0.95); c.quadraticCurveTo(-r * 0.55, 0, -r * 0.8, H * 0.6); c.closePath(); }
  else { c.moveTo(r * 0.1, 0); c.quadraticCurveTo(-r * 0.5, -H * 0.2, -r * 0.8, -H * 0.62); c.quadraticCurveTo(-r * 0.55, 0, -r * 0.8, H * 0.62); c.quadraticCurveTo(-r * 0.5, H * 0.2, r * 0.1, 0); }
  c.fill(); c.restore();
  // dorsal fin
  c.fillStyle = lk.fin; c.beginPath();
  if (lk.shark) { c.moveTo(-hl * 0.15, -H * 0.42); c.lineTo(-hl * 0.02 - r * 0.15, -H * 1.25); c.lineTo(hl * 0.25, -H * 0.4); }
  else { c.moveTo(-hl * 0.45, -H * 0.38); c.quadraticCurveTo(-hl * 0.05, -H * (lk.H > 1.4 ? 0.95 : 0.85), hl * 0.3, -H * 0.42); }
  c.fill();
  // body
  const g = c.createLinearGradient(0, -H / 2, 0, H / 2); g.addColorStop(0, lk.back); g.addColorStop(0.55, lk.back); g.addColorStop(0.62, lk.belly); g.addColorStop(1, lk.belly);
  c.fillStyle = o.tint || g; c.beginPath();
  if (lk.shark || lk.jaw) { c.moveTo(hl, H * 0.02); c.quadraticCurveTo(hl * 0.55, -H * 0.62, -hl * 0.2, -H * 0.5); c.quadraticCurveTo(-hl * 0.85, -H * 0.3, -hl * 0.95, 0); c.quadraticCurveTo(-hl * 0.85, H * 0.3, -hl * 0.2, H * 0.48); c.quadraticCurveTo(hl * 0.6, H * 0.5, hl, H * 0.02); }
  else c.ellipse(0, 0, hl, H / 2, 0, 0, TAU);
  c.fill();
  // patterns (clipped to body)
  c.save(); c.clip();
  if (lk.bands) { for (const bx of [hl * 0.42, -hl * 0.05, -hl * 0.55]) { c.fillStyle = lk.edge; c.fillRect(bx - r * 0.2, -H, r * 0.4, H * 2); c.fillStyle = lk.bands; c.fillRect(bx - r * 0.14, -H, r * 0.28, H * 2); } }
  if (lk.stripe) { c.fillStyle = lk.stripe; c.fillRect(-hl, -H * 0.06, L, H * 0.16); }
  if (lk.dots) { c.fillStyle = lk.dots; for (let i = 0; i < 6; i++) { c.beginPath(); c.arc(-hl * 0.6 + i * hl * 0.22, -H * 0.18 + (i % 2) * H * 0.1, r * 0.07, 0, TAU); c.fill(); } }
  if (lk.spots) { c.fillStyle = lk.spots; for (let i = 0; i < 14; i++) { const a = i * 2.39996, d = Math.sqrt(i / 14); c.beginPath(); c.arc(Math.cos(a) * hl * 0.75 * d - hl * 0.05, Math.sin(a) * H * 0.4 * d, r * 0.075, 0, TAU); c.fill(); } }
  if (lk.bars) { c.fillStyle = lk.bars; for (let i = 0; i < 7; i++) c.fillRect(-hl * 0.7 + i * hl * 0.2, -H * 0.5, r * 0.06, H * 0.45); }
  if (lk.player) { c.fillStyle = 'rgba(255,255,255,.25)'; if (lk.noCheek) { c.beginPath(); c.ellipse(hl * 0.1, -H * 0.22, hl * 0.55, H * 0.1, -0.08, 0, TAU); c.fill(); } else { c.beginPath(); c.ellipse(hl * 0.1, -H * 0.22, hl * 0.55, H * 0.12, -0.08, 0, TAU); c.fill(); c.fillStyle = '#ff7ad1'; c.beginPath(); c.ellipse(hl * 0.42, H * 0.12, r * 0.14, r * 0.09, 0, 0, TAU); c.fill(); } }
  c.restore();
  if (lk.shark) { c.strokeStyle = 'rgba(40,50,60,.5)'; c.lineWidth = Math.max(1, r * 0.04); for (let i = 0; i < 3; i++) { c.beginPath(); c.moveTo(hl * 0.3 - i * r * 0.14, -H * 0.12); c.lineTo(hl * 0.26 - i * r * 0.14, H * 0.16); c.stroke(); } }
  // pectoral fin
  c.fillStyle = lk.fin; c.globalAlpha *= 0.9; c.beginPath(); c.ellipse(hl * 0.05, H * 0.16, r * 0.32, r * 0.13, 0.5 + wag * 0.6, 0, TAU); c.fill(); c.globalAlpha /= 0.9;
  // eye
  const ex = hl * (lk.shark ? 0.6 : lk.jaw ? 0.62 : 0.52), ey = -H * (lk.shark ? 0.12 : 0.14), er = r * (lk.player ? (lk.shark ? 0.2 : 0.3) : lk.shark ? 0.09 : 0.17);
  if (o.dead) { c.strokeStyle = '#111'; c.lineWidth = Math.max(1.5, r * 0.06); c.beginPath(); c.moveTo(ex - er, ey - er); c.lineTo(ex + er, ey + er); c.moveTo(ex + er, ey - er); c.lineTo(ex - er, ey + er); c.stroke(); }
  else {
    c.fillStyle = '#fff'; c.beginPath(); c.arc(ex, ey, er, 0, TAU); c.fill();
    c.fillStyle = o.angry ? '#c1121f' : '#111'; c.beginPath(); c.arc(ex + er * 0.22, ey, er * (lk.player ? 0.55 : 0.58), 0, TAU); c.fill();
    c.fillStyle = '#fff'; c.beginPath(); c.arc(ex + er * 0.4, ey - er * 0.3, er * 0.22, 0, TAU); c.fill();
    if (o.angry) { c.strokeStyle = '#111'; c.lineWidth = Math.max(1.5, r * 0.06); c.beginPath(); c.moveTo(ex - er * 1.2, ey - er * 1.5); c.lineTo(ex + er * 1.1, ey - er * 0.8); c.stroke(); }
  }
  // mouth
  const mo = o.mouth || 0;
  if (mo > 0) { c.fillStyle = '#3a0b16'; c.beginPath(); c.moveTo(hl * 1.02, 0); c.lineTo(hl * 0.55, -H * 0.05); c.lineTo(hl * 1.02, -H * 0.38 * mo); c.moveTo(hl * 1.02, 0); c.lineTo(hl * 0.55, H * 0.02); c.lineTo(hl * 1.02, H * 0.34 * mo); c.fill(); }
  else { c.strokeStyle = 'rgba(0,0,0,.45)'; c.lineWidth = Math.max(1, r * 0.05); c.beginPath(); c.moveTo(hl * 0.98, H * 0.06); c.quadraticCurveTo(hl * 0.86, H * (lk.bigMouth ? 0.2 : 0.12), hl * (lk.bigMouth ? 0.66 : 0.78), H * 0.1); c.stroke(); }
  if (lk.jaw || lk.shark) { c.fillStyle = '#fff'; for (let i = 0; i < 4; i++) { c.beginPath(); c.moveTo(hl * (0.92 - i * 0.07), H * 0.08); c.lineTo(hl * (0.89 - i * 0.07), H * 0.18); c.lineTo(hl * (0.86 - i * 0.07), H * 0.08); c.fill(); } }
  c.restore();
}

/* ---------- scene decor (seeded per level) ---------- */
function decor(seed, sea) {
  let s = seed || 7; const R = () => (s = (s * 16807) % 2147483647) / 2147483647; const d = { corals: [], weeds: [], rocks: [], far: [] };
  for (let x = 20; x < S.WW; x += 34 + R() * 60) { const k = R(); if (k < 0.42) d.corals.push({ x, t: Math.floor(R() * 3), h: 30 + R() * 60, c: sea.coral[Math.floor(R() * sea.coral.length)], ph: R() * 6 }); else if (k < 0.8) d.weeds.push({ x, h: 50 + R() * 90, ph: R() * 6 }); else d.rocks.push({ x, w: 40 + R() * 80, h: 18 + R() * 30 }); }
  for (let x = -200; x < S.WW + 400; x += 120 + R() * 160) d.far.push({ x, h: 80 + R() * 200, w: 90 + R() * 160 });
  d.bub = []; for (let i = 0; i < 40; i++) d.bub.push({ x: R() * S.WW, y: R() * S.WH, r: 1.5 + R() * 3.5, v: 18 + R() * 30 });
  d.boat = []; return d;
}
function scene(c, w, cam, vw, vh, t, d) {
  const sea = S.SEAS[w.L.sea], sc = cam.s, X = x => (x - cam.x) * sc + vw / 2, Y = y => (y - cam.y) * sc + vh / 2;
  // water column
  const g = c.createLinearGradient(0, Y(0), 0, Y(S.WH)); g.addColorStop(0, sea.top); g.addColorStop(0.45, sea.mid); g.addColorStop(1, sea.deep);
  c.fillStyle = g; c.fillRect(0, 0, vw, vh);
  // sky above surface
  if (Y(S.SURF) > 0) { const sg = c.createLinearGradient(0, Y(-200), 0, Y(S.SURF)); sg.addColorStop(0, '#9be7ff'); sg.addColorStop(1, '#e6fbff'); c.fillStyle = sg; c.fillRect(0, 0, vw, Y(S.SURF)); }
  // light rays
  c.save(); c.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 7; i++) { const bx = X(i * 330 + Math.sin(t * 0.2 + i) * 40 - 100), a = 0.05 + 0.03 * Math.sin(t * 0.7 + i * 1.7); c.fillStyle = 'rgba(255,255,255,' + a.toFixed(3) + ')'; c.beginPath(); c.moveTo(bx, Y(S.SURF)); c.lineTo(bx + 90 * sc, Y(S.SURF)); c.lineTo(bx + 260 * sc, Y(S.FLOOR)); c.lineTo(bx + 60 * sc, Y(S.FLOOR)); c.fill(); }
  c.restore();
  // far reef silhouettes (parallax)
  c.fillStyle = 'rgba(4,30,60,.28)';
  for (const f of d.far) { const px = (f.x - cam.x) * sc * 0.55 + vw / 2, by = Y(S.FLOOR) + 10; c.beginPath(); c.ellipse(px, by, f.w * sc * 0.6, f.h * sc * 0.6, 0, Math.PI, 0); c.fill(); }
  // surface wave
  c.fillStyle = 'rgba(255,255,255,.35)'; c.beginPath(); c.moveTo(0, Y(S.SURF));
  for (let x = 0; x <= vw + 20; x += 20) { const wx = (x - vw / 2) / sc + cam.x; c.lineTo(x, Y(S.SURF + Math.sin(wx * 0.02 + t * 1.6) * 5)); }
  c.lineTo(vw, Y(S.SURF + 14)); c.lineTo(0, Y(S.SURF + 14)); c.fill();
  // boats
  for (const b of d.boat) { const bx = X(b.x), by = Y(S.SURF) - 2, k = Math.min(1, b.t, b.life - b.t); if (k <= 0) continue; c.save(); c.globalAlpha = Math.max(0, k); c.translate(bx, by + Math.sin(t * 2) * 2); c.scale(sc, sc); c.fillStyle = '#7a3e1d'; c.beginPath(); c.moveTo(-70, -10); c.lineTo(70, -10); c.lineTo(52, 14); c.lineTo(-52, 14); c.fill(); c.fillStyle = '#e63946'; c.fillRect(-70, -14, 140, 6); c.fillStyle = '#f1faee'; c.fillRect(-10, -50, 4, 40); c.beginPath(); c.moveTo(-6, -50); c.lineTo(30, -22); c.lineTo(-6, -22); c.fill(); c.restore(); }
  // bubbles
  c.strokeStyle = 'rgba(255,255,255,.4)'; c.lineWidth = 1;
  for (const b of d.bub) { const y = ((b.y - t * b.v) % (S.FLOOR - S.SURF) + (S.FLOOR - S.SURF)) % (S.FLOOR - S.SURF) + S.SURF, x = b.x + Math.sin(t + b.y) * 6, sx = X(x), sy = Y(y); if (sx < -10 || sx > vw + 10 || sy < -10 || sy > vh + 10) continue; c.beginPath(); c.arc(sx, sy, b.r * sc, 0, TAU); c.stroke(); }
}
function floor(c, w, cam, vw, vh, t, d) {
  const sea = S.SEAS[w.L.sea], sc = cam.s, X = x => (x - cam.x) * sc + vw / 2, Y = y => (y - cam.y) * sc + vh / 2, fy = Y(S.FLOOR);
  for (const wd of d.weeds) { const x = X(wd.x); if (x < -60 || x > vw + 60) continue; c.strokeStyle = '#2f9e5a'; c.lineWidth = 5 * sc; c.lineCap = 'round'; c.beginPath(); c.moveTo(x, fy + 6); for (let i = 1; i <= 5; i++) c.lineTo(x + Math.sin(t * 1.4 + wd.ph + i * 0.7) * 9 * sc * i / 5, fy + 6 - wd.h * sc * i / 5); c.stroke(); }
  for (const k of d.corals) {
    const x = X(k.x); if (x < -80 || x > vw + 80) continue; c.fillStyle = k.c; c.strokeStyle = k.c; c.lineCap = 'round';
    if (k.t === 0) { c.lineWidth = 7 * sc; const br = (x0, y0, a, len, dep) => { const x1 = x0 + Math.cos(a) * len, y1 = y0 + Math.sin(a) * len; c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke(); if (dep > 0) { br(x1, y1, a - 0.45, len * 0.7, dep - 1); br(x1, y1, a + 0.45, len * 0.7, dep - 1); } }; br(x, fy + 4, -Math.PI / 2 + Math.sin(t * 0.6 + k.ph) * 0.03, k.h * sc * 0.42, 2); }
    else if (k.t === 1) { c.beginPath(); c.ellipse(x, fy, k.h * sc * 0.45, k.h * sc * 0.42, 0, Math.PI, 0); c.fill(); c.fillStyle = 'rgba(0,0,0,.15)'; for (let i = -2; i <= 2; i++) { c.beginPath(); c.arc(x + i * k.h * sc * 0.15, fy - k.h * sc * 0.18 - Math.abs(i) * -2, 2.5 * sc, 0, TAU); c.fill(); } }
    else { c.globalAlpha = 0.85; c.beginPath(); c.moveTo(x, fy); for (let i = 0; i <= 8; i++) { const a = Math.PI + i * Math.PI / 8; c.lineTo(x + Math.cos(a) * k.h * sc * 0.5, fy + Math.sin(a) * k.h * sc * 0.65); } c.fill(); c.globalAlpha = 1; }
  }
  c.fillStyle = 'rgba(70,60,50,.55)'; for (const r of d.rocks) { const x = X(r.x); if (x < -100 || x > vw + 100) continue; c.beginPath(); c.ellipse(x, fy + 6, r.w * sc / 2, r.h * sc, 0, Math.PI, 0); c.fill(); }
  const sg = c.createLinearGradient(0, fy, 0, Y(S.WH)); sg.addColorStop(0, sea.sand); sg.addColorStop(1, '#8a7a55'); c.fillStyle = sg; c.beginPath(); c.moveTo(0, fy + 10);
  for (let x = 0; x <= vw + 30; x += 30) { const wx = (x - vw / 2) / sc + cam.x; c.lineTo(x, fy + 4 + Math.sin(wx * 0.013) * 6 * sc); } c.lineTo(vw, vh + 10); c.lineTo(0, vh + 10); c.fill();
}
function hazards(c, w, cam, vw, vh, t) {
  const sc = cam.s, X = x => (x - cam.x) * sc + vw / 2, Y = y => (y - cam.y) * sc + vh / 2;
  for (const h of w.haz) {
    if (h.k === 'ubur') {
      const x = X(h.x), y = Y(h.y), s = sc * (1 + Math.sin(h.t * 3) * 0.06); c.save(); c.translate(x, y); c.scale(s, s);
      c.strokeStyle = 'rgba(255,170,230,.75)'; c.lineWidth = 2.2; for (let i = -2; i <= 2; i++) { c.beginPath(); c.moveTo(i * 7, 6); for (let k = 1; k <= 6; k++) c.lineTo(i * 7 + Math.sin(h.t * 4 + k + i) * 4, 6 + k * 8); c.stroke(); }
      const g = c.createRadialGradient(0, -4, 2, 0, 0, 26); g.addColorStop(0, 'rgba(255,230,250,.95)'); g.addColorStop(1, 'rgba(240,120,210,.7)'); c.fillStyle = g; c.beginPath(); c.ellipse(0, 0, 24, 18, 0, Math.PI, 0); c.quadraticCurveTo(12, 10, 0, 6); c.quadraticCurveTo(-12, 10, -24, 0); c.fill();
      c.fillStyle = '#ffe14d'; c.font = 'bold 14px system-ui'; c.textAlign = 'center'; c.fillText('⚡', 0, -4); c.restore();
    } else if (h.k === 'plastik') {
      const x = X(h.x), y = Y(h.y); c.save(); c.translate(x, y); c.scale(sc, sc); c.rotate(Math.sin(h.t * 1.5 + h.ph) * 0.25);
      c.fillStyle = 'rgba(245,250,255,.72)'; c.strokeStyle = 'rgba(120,140,160,.8)'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(-14, -10); c.lineTo(14, -10); c.quadraticCurveTo(18 + Math.sin(h.t * 3) * 3, 10, 10, 22); c.lineTo(-10, 22); c.quadraticCurveTo(-18, 10, -14, -10); c.fill(); c.stroke();
      c.beginPath(); c.arc(-7, -12, 5, Math.PI, 0); c.moveTo(12, -12); c.arc(7, -12, 5, 0, Math.PI, true); c.stroke(); c.fillStyle = 'rgba(30,60,90,.5)'; c.font = 'bold 9px system-ui'; c.textAlign = 'center'; c.fillText('kresek', 0, 9); c.restore();
    } else if (h.k === 'jaring') {
      const l = X(h.x - h.wdt / 2), r = X(h.x + h.wdt / 2), top = Y(S.SURF), bot = Y(h.cur || S.SURF);
      if (h.st === 'warn') { const a = 0.25 + 0.2 * Math.sin(h.t * 10); c.fillStyle = 'rgba(255,220,80,' + a.toFixed(2) + ')'; c.fillRect(l, top, r - l, Y(h.depth) - top); c.strokeStyle = 'rgba(255,230,120,.9)'; c.setLineDash([8, 8]); c.lineWidth = 2; c.strokeRect(l, top, r - l, Y(h.depth) - top); c.setLineDash([]); c.fillStyle = '#fff'; c.font = 'bold ' + Math.round(16 * Math.max(0.8, sc)) + 'px system-ui'; c.textAlign = 'center'; c.fillText('⚠ JARING!', (l + r) / 2, top + 30); continue; }
      c.strokeStyle = 'rgba(240,240,220,.8)'; c.lineWidth = 1.4; const step = 18 * sc;
      for (let x = l; x <= r + 0.1; x += step) { c.beginPath(); c.moveTo(x, top); c.lineTo(x + Math.sin(t * 2 + x) * 3, bot); c.stroke(); }
      for (let y = top; y <= bot; y += step) { c.beginPath(); c.moveTo(l, y); c.lineTo(r, y); c.stroke(); }
      c.strokeStyle = '#c8a26a'; c.lineWidth = 4; c.beginPath(); c.moveTo(l, bot); c.lineTo(r, bot); c.stroke(); c.fillStyle = '#f4a261'; for (let x = l; x <= r; x += step * 2) { c.beginPath(); c.arc(x, bot, 4, 0, TAU); c.fill(); }
    } else if (h.k === 'bom') {
      const x = X(h.x), y = Y(h.st === 'sink' ? h.yy : h.y);
      if (h.st === 'tick') { const p = h.t / 2.3, pul = 0.5 + 0.5 * Math.sin(h.t * (8 + p * 18)); c.fillStyle = 'rgba(255,40,40,' + (0.08 + pul * 0.14).toFixed(3) + ')'; c.beginPath(); c.arc(x, y, h.rad * sc, 0, TAU); c.fill(); c.strokeStyle = 'rgba(255,80,80,.9)'; c.lineWidth = 3; c.setLineDash([10, 8]); c.beginPath(); c.arc(x, y, h.rad * sc, 0, TAU); c.stroke(); c.setLineDash([]); c.strokeStyle = 'rgba(255,255,255,.8)'; c.lineWidth = 4; c.beginPath(); c.arc(x, y, h.rad * sc * 0.25, -Math.PI / 2, -Math.PI / 2 + TAU * (1 - p)); c.stroke(); }
      if (h.st === 'boom') { const p = h.t / 0.8; c.fillStyle = 'rgba(255,240,200,' + (1 - p).toFixed(2) + ')'; c.beginPath(); c.arc(x, y, h.rad * sc * (0.4 + p * 0.8), 0, TAU); c.fill(); c.strokeStyle = 'rgba(255,255,255,' + (1 - p).toFixed(2) + ')'; c.lineWidth = 6; c.beginPath(); c.arc(x, y, h.rad * sc * (0.6 + p), 0, TAU); c.stroke(); continue; }
      c.save(); c.translate(x, y); c.scale(sc, sc); c.fillStyle = '#3d5a40'; rr(c, -8, -14, 16, 26, 5); c.fill(); c.fillStyle = '#2b2b2b'; c.fillRect(-4, -20, 8, 7); c.strokeStyle = '#c9a227'; c.lineWidth = 2; c.beginPath(); c.moveTo(0, -20); c.quadraticCurveTo(6, -28, 2, -32); c.stroke();
      c.fillStyle = Math.sin(t * 30) > 0 ? '#ffd23f' : '#ff6b35'; c.beginPath(); c.arc(2, -33, 3.2, 0, TAU); c.fill(); c.fillStyle = '#fff'; c.font = 'bold 8px system-ui'; c.textAlign = 'center'; c.fillText('BOM', 0, 2); c.restore();
    }
  }
  for (const o of w.fx) {
    const x = X(o.x), y = Y(o.y); c.save(); c.translate(x, y); c.scale(sc, sc);
    if (o.k === 'pearl') { const op = 0.5 + 0.5 * Math.sin(o.t * 2); c.fillStyle = '#c9a0dc'; c.beginPath(); c.ellipse(0, 4, 18, 9, 0, 0, Math.PI); c.fill(); c.save(); c.translate(0, 4); c.rotate(-0.6 * op); c.beginPath(); c.ellipse(0, 0, 18, 9, 0, Math.PI, TAU); c.fill(); c.restore(); const g = c.createRadialGradient(-2, -1, 1, 0, 0, 7); g.addColorStop(0, '#fff'); g.addColorStop(1, '#f2d7ee'); c.fillStyle = g; c.beginPath(); c.arc(0, 0, 6, 0, TAU); c.fill(); }
    else { c.strokeStyle = 'rgba(180,240,255,.95)'; c.lineWidth = 2.5; c.fillStyle = 'rgba(120,220,255,.25)'; c.beginPath(); c.arc(0, 0, 15 + Math.sin(o.t * 4) * 1.5, 0, TAU); c.fill(); c.stroke(); c.fillStyle = '#fff'; c.font = '14px system-ui'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('🛡️', 0, 1); }
    c.restore();
  }
}
function draw(c, w, cam, vw, vh, t, d, ui) {
  scene(c, w, cam, vw, vh, t, d);
  const sc = cam.s, X = x => (x - cam.x) * sc + vw / 2, Y = y => (y - cam.y) * sc + vh / 2, p = w.p, pr = S.pr(w);
  hazards(c, w, cam, vw, vh, t);
  for (const f of w.fish) {
    const s = S.SP[f.sp], x = X(f.x), y = Y(f.y), r = s.r * sc; if (x < -r * 3 || x > vw + r * 3 || y < -r * 3 || y > vh + r * 3) continue;
    const dang = S.danger(w, f);
    c.save(); c.translate(x, y); c.scale(f.dir, 1); c.rotate(Math.max(-0.5, Math.min(0.5, (f.vy || 0) / 260)) * f.dir);
    fish(c, f.sp, r, t + f.ph, { fast: f.chase > 0 || f.flee > 0, angry: f.chase > 0, mouth: f.chase > 0 ? 0.6 + 0.4 * Math.sin(t * 14) : 0 });
    c.restore();
    if (ui.hint && !dang && S.edible(w, f) && Math.hypot(f.x - p.x, f.y - p.y) < 380) { c.strokeStyle = 'rgba(120,255,160,.55)'; c.lineWidth = 2; c.beginPath(); c.arc(x, y, r * 1.35 + 3, 0, TAU); c.stroke(); }
    if (f.chase > 0) { c.fillStyle = '#ff3b3b'; c.strokeStyle = '#fff'; c.lineWidth = 3; const by = y - r * 1.3 - 18; c.beginPath(); c.arc(x, by, 12, 0, TAU); c.fill(); c.stroke(); c.fillStyle = '#fff'; c.font = 'bold 16px system-ui'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('!', x, by + 1); }
  }
  // player
  if (!ui.noPlayer && (!w.done || w.done === 'win')) {
    const x = X(p.x), y = Y(p.y), r = pr * sc; c.save();
    const dying = p.dying > 0, dropping = p.drop > 0;
    if (p.inv > 0 && !dying && !dropping && Math.floor(t * 12) % 2) c.globalAlpha = 0.45;
    if (dying) c.globalAlpha = Math.max(0.25, Math.min(1, p.dying / 0.5));
    if (w.frenzy > 0) { const g = c.createRadialGradient(x, y, r * 0.5, x, y, r * 2.4); g.addColorStop(0, 'rgba(255,220,80,.55)'); g.addColorStop(1, 'rgba(255,220,80,0)'); c.fillStyle = g; c.beginPath(); c.arc(x, y, r * 2.4, 0, TAU); c.fill(); }
    c.translate(x, y); c.scale(p.dir, 1);
    if (dropping) { const k = 1 - p.drop / S.DROP_T; c.rotate((k < 0.38 ? 1.15 : 1.15 * Math.max(0, 1 - (k - 0.38) / 0.5)) + Math.sin(t * 20) * 0.05); }
    else if (dying) c.rotate(Math.sin(t * 3) * 0.12);
    else c.rotate(Math.max(-0.45, Math.min(0.45, p.vy / 400)) * p.dir);
    if (p.stun > 0) c.rotate(Math.sin(t * 40) * 0.15);
    if (p.dash > 0) { c.save(); c.globalAlpha = 0.35; c.fillStyle = '#e8fbff'; for (let i = 1; i <= 3; i++) { c.beginPath(); c.ellipse(-r * (0.9 + i * 0.7), 0, r * (0.9 - i * 0.18), r * (0.45 - i * 0.08), 0, 0, TAU); c.fill(); } c.restore(); }
    if (w.L.shark) { c.shadowColor = 'rgba(255,240,170,.9)'; c.shadowBlur = 10; }
    fish(c, w.L.shark ? 'pshark' : 'player', r, dying ? 0 : t, { dead: dying, fast: dropping || Math.hypot(p.vx, p.vy) > 60, mouth: dying ? 0 : p.chomp > 0 ? Math.sin(p.chomp / 0.22 * Math.PI) : ui.near ? 0.35 : 0 });
    c.restore();
    if (p.shield > 0) { c.strokeStyle = 'rgba(160,235,255,' + (0.6 + 0.3 * Math.sin(t * 6)).toFixed(2) + ')'; c.lineWidth = 3; c.beginPath(); c.arc(x, y, r * 1.7, 0, TAU); c.stroke(); }
    if (p.stun > 0) { c.fillStyle = '#ffe14d'; c.font = 'bold ' + Math.round(18) + 'px system-ui'; c.textAlign = 'center'; c.fillText('⚡ ⚡', x, y - r * 1.5); }
    if (p.trapped) { c.fillStyle = 'rgba(0,0,0,.55)'; rr(c, x - 70, y - r - 54, 140, 34, 17); c.fill(); c.fillStyle = '#fff'; c.font = 'bold 15px system-ui'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('TAP CEPAT! ' + p.taps + '/7', x, y - r - 37); }
  }
  // t365u: splash where the fish plunged in + 'falling' shadow marker while in the air
  if (w.splash) { const k = w.splash.t / 1.2, sx = X(w.splash.x), sy = Y(S.SURF); c.save();
    for (let i = 0; i < 3; i++) { const q = Math.max(0, k - i * 0.12); if (q <= 0) continue; c.globalAlpha = Math.max(0, 0.8 * (1 - q)); c.strokeStyle = '#ffffff'; c.lineWidth = 3 - i * 0.7; c.beginPath(); c.ellipse(sx, sy + 4, (30 + q * 170) * sc, (7 + q * 26) * sc, 0, 0, TAU); c.stroke(); }
    c.fillStyle = '#e8fbff'; for (let i = 0; i < 14; i++) { const a = Math.PI * (0.12 + 0.76 * (i / 13)), v = (220 + (i * 37) % 120) * sc, tt = w.splash.t, dx = Math.cos(a) * v * tt, dy = -Math.sin(a) * v * tt + 520 * sc * tt * tt; if (dy > 6 * sc) continue; c.globalAlpha = Math.max(0, 1 - k * 1.2); c.beginPath(); c.arc(sx + dx, sy + dy, (3 + (i % 3)) * sc, 0, TAU); c.fill(); }
    c.restore(); }
  if (p.drop > 0 && p.y < S.SURF && !ui.noPlayer) { const sx = X(p.x), sy = Y(S.SURF), k = (p.y - (S.SURF - 230)) / 230; c.save(); c.globalAlpha = 0.25 + 0.5 * k; c.fillStyle = 'rgba(3,28,56,.6)'; c.beginPath(); c.ellipse(sx, sy + 6, pr * sc * (0.6 + k * 0.8), 5 * sc, 0, 0, TAU); c.fill(); c.restore(); }
  // coach arrow to nearest edible fish
  if (ui.coach) { const f = ui.coach, fx = X(f.x), fy = Y(f.y), px = X(p.x), py = Y(p.y), a = Math.atan2(fy - py, fx - px), dd = Math.hypot(fx - px, fy - py), b = 0.5 + 0.5 * Math.sin(t * 6);
    c.save(); c.strokeStyle = 'rgba(120,255,160,.95)'; c.lineWidth = 3; c.beginPath(); c.arc(fx, fy, S.SP[f.sp].r * sc * 1.6 + 6 + b * 4, 0, TAU); c.stroke();
    if (dd > 70) { const ax = px + Math.cos(a) * (pr * sc + 26), ay = py + Math.sin(a) * (pr * sc + 26); c.translate(ax, ay); c.rotate(a); c.fillStyle = '#7dffa8'; c.strokeStyle = '#063152'; c.lineWidth = 2; c.beginPath(); c.moveTo(14, 0); c.lineTo(-6, -10); c.lineTo(-2, 0); c.lineTo(-6, 10); c.closePath(); c.fill(); c.stroke(); }
    c.restore(); c.save(); c.font = '800 14px system-ui'; c.textAlign = 'center'; c.lineWidth = 4; c.strokeStyle = 'rgba(3,28,56,.8)'; c.fillStyle = '#7dffa8'; c.strokeText('MAKAN INI!', fx, fy - S.SP[f.sp].r * sc - 18); c.fillText('MAKAN INI!', fx, fy - S.SP[f.sp].r * sc - 18); c.restore(); }
  // popups & particles
  for (const q of ui.pops) { const k = q.t / q.life; c.globalAlpha = Math.max(0, 1 - k); c.fillStyle = q.col || '#fff'; c.strokeStyle = 'rgba(0,0,0,.5)'; c.lineWidth = 3; c.font = '800 ' + Math.round(q.size || 16) + 'px system-ui'; c.textAlign = 'center'; c.textBaseline = 'middle'; const yy = Y(q.y) - k * 40; c.strokeText(q.txt, X(q.x), yy); c.fillText(q.txt, X(q.x), yy); }
  c.globalAlpha = 1;
  for (const b of ui.parts) { c.strokeStyle = 'rgba(255,255,255,' + Math.max(0, 1 - b.t / b.life).toFixed(2) + ')'; c.lineWidth = 1.5; c.beginPath(); c.arc(X(b.x), Y(b.y), b.r * sc, 0, TAU); c.stroke(); }
  // offscreen predator arrows
  for (const f of w.fish) if (f.chase > 0) { const x = X(f.x), y = Y(f.y); if (x > 0 && x < vw && y > 0 && y < vh) continue; const ax = Math.max(18, Math.min(vw - 18, x)), ay = Math.max(70, Math.min(vh - 18, y)), a = Math.atan2(y - vh / 2, x - vw / 2); c.save(); c.translate(ax, ay); c.rotate(a); c.fillStyle = '#ff3b3b'; c.beginPath(); c.moveTo(12, 0); c.lineTo(-8, -9); c.lineTo(-8, 9); c.fill(); c.restore(); }
}
/** small icon of a species for the HUD (returns dataURL) */
function icon(key, size) {
  const w = size, h = Math.round(size * 0.7), cv = document.createElement('canvas'), dpr = 2; cv.width = w * dpr; cv.height = h * dpr; const c = cv.getContext('2d'); c.scale(dpr, dpr);
  const lk = LOOK[key], r = Math.min((w - 4) / (lk.L + 0.85), (h - 4) / (lk.H * (lk.shark ? 1.9 : 1.45))); c.translate(w / 2 + r * 0.38, h / 2 + (lk.shark ? r * lk.H * 0.3 : r * 0.08)); fish(c, key, r, 0.4, {}); return cv.toDataURL();
}
root.IRRender = { fish, draw, decor, icon, LOOK };
})(window);

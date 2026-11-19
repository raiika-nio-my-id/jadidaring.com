/* Tamiya Lintasan renderer (global TLR): warm "lomba Tamiya 17-an" floor, 3-lane plastic circuit with lane-changer bridge,
   corner timing gates, top-down mini 4WD cars with rollers, sparks/confetti fx, course-out flips and chat bubbles. */
(function (root) {
'use strict';
const T = root.TL;
const HALF_X = T.A / 2 + T.RC + T.LW * 1.5 + 1.0, HALF_Y = T.B / 2 + T.RC + T.LW * 1.5 + 1.0;
const PATHS = {};
function path(off) { if (PATHS[off]) return PATHS[off]; const p = new Path2D(); const n = Math.ceil(T.LAP / 0.2); for (let i = 0; i <= n; i++) { const q = T.pos(i * T.LAP / n, off); if (i) p.lineTo(q.x, q.y); else p.moveTo(q.x, q.y); } p.closePath(); return (PATHS[off] = p); }
function view(W, H, top, bottom, pad) {
  pad = pad == null ? 8 : pad; const aw = W - pad * 2, ah = H - top - bottom - pad * 2, rot = ah > aw * 1.08 ? 1 : 0;
  const k = rot ? Math.min(aw / (HALF_Y * 2), ah / (HALF_X * 2)) : Math.min(aw / (HALF_X * 2), ah / (HALF_Y * 2));
  const cx = W / 2, cy = top + pad + ah / 2;
  return { k, rot, cx, cy, W, H, scr: (x, y) => rot ? { x: cx - y * k, y: cy + x * k } : { x: cx + x * k, y: cy + y * k } };
}
function setW(g, v, r) { if (v.rot) g.setTransform(0, v.k * r, -v.k * r, 0, v.cx * r, v.cy * r); else g.setTransform(v.k * r, 0, 0, v.k * r, v.cx * r, v.cy * r); }
// ---------- floor & decorations (screen space) ----------
let floorCache = null;
function floor(g, W, H, r) {
  const key = W + 'x' + H + 'x' + r;
  if (!floorCache || floorCache.key !== key) {
    const c = document.createElement('canvas'); c.width = Math.max(1, W * r); c.height = Math.max(1, H * r); const f = c.getContext('2d'); f.scale(r, r);
    const gr = f.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#f6d7a7'); gr.addColorStop(1, '#e9b77e'); f.fillStyle = gr; f.fillRect(0, 0, W, H);
    const s = 34; f.strokeStyle = 'rgba(140,80,30,.13)'; f.lineWidth = 1.2; // keramik tiles
    for (let x = -H; x < W + H; x += s) { f.beginPath(); f.moveTo(x, 0); f.lineTo(x + H * 0.5, H); f.stroke(); }
    for (let y = 0; y < H + s; y += s * 0.86) { f.beginPath(); f.moveTo(0, y); f.lineTo(W, y); f.stroke(); }
    f.fillStyle = 'rgba(255,255,255,.08)'; for (let i = 0; i < 40; i++) { const x = (i * 97) % W, y = (i * 53) % H; f.fillRect(x, y, s * 0.4, 2); }
    const vg = f.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.75); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(70,25,0,.32)'); f.fillStyle = vg; f.fillRect(0, 0, W, H);
    floorCache = { key, c };
  }
  g.setTransform(1, 0, 0, 1, 0, 0); g.drawImage(floorCache.c, 0, 0);
}
function bunting(g, W, y, now, r) { // merah-putih umbul-umbul string
  g.setTransform(r, 0, 0, r, 0, 0); g.strokeStyle = 'rgba(90,50,20,.55)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(-4, y);
  for (let x = 0; x <= W + 8; x += 8) g.lineTo(x, y + Math.sin(x / W * Math.PI) * 10); g.stroke();
  for (let x = 6, i = 0; x < W; x += 22, i++) { const yy = y + Math.sin(x / W * Math.PI) * 10, sw = Math.sin(now / 420 + i) * 2; g.fillStyle = i % 2 ? '#fff' : '#e1262c'; g.beginPath(); g.moveTo(x - 7, yy); g.lineTo(x + 7, yy); g.lineTo(x + sw, yy + 15); g.closePath(); g.fill(); }
}
function crowd(g, v, now, r, n) { // kids cheering along the long sides
  g.setTransform(r, 0, 0, r, 0, 0); const pal = ['#2f7de1', '#e23b3b', '#19a974', '#ff8a1f', '#8f3bd6', '#f5b301'], skin = ['#8a5a3c', '#a86f4c', '#c58c63', '#6e452c'];
  for (let i = 0; i < n; i++) {
    const side = i % 2, f = ((i * 0.618) % 1) * 0.86 + 0.07, wx = (f - 0.5) * 2 * (T.A / 2 + T.RC), wy = (side ? 1 : -1) * (HALF_Y + 0.35), p = v.scr(wx, wy);
    if (p.x < 10 || p.x > v.W - 10 || p.y < 14 || p.y > v.H - 10) continue;
    const bob = Math.abs(Math.sin(now / 260 + i * 1.7)) * 3, sz = Math.max(5, v.k * 0.42);
    g.fillStyle = 'rgba(0,0,0,.18)'; g.beginPath(); g.ellipse(p.x, p.y + sz * 1.1, sz * 1.1, sz * 0.4, 0, 0, 7); g.fill();
    g.fillStyle = pal[i % pal.length]; g.beginPath(); g.ellipse(p.x, p.y + sz * 0.3 - bob * 0.4, sz * 0.95, sz * 0.75, 0, 0, 7); g.fill();
    g.fillStyle = skin[i % skin.length]; g.beginPath(); g.arc(p.x, p.y - sz * 0.6 - bob, sz * 0.6, 0, 7); g.fill();
    g.fillStyle = '#2a1a10'; g.beginPath(); g.arc(p.x, p.y - sz * 0.8 - bob, sz * 0.56, Math.PI, 0); g.fill();
    if (i % 3 === 0) { g.strokeStyle = skin[i % skin.length]; g.lineWidth = sz * 0.28; g.lineCap = 'round'; g.beginPath(); g.moveTo(p.x - sz * 0.7, p.y - sz * 0.1 - bob); g.lineTo(p.x - sz * 1.1, p.y - sz * 1.2 - bob * 1.6); g.moveTo(p.x + sz * 0.7, p.y - sz * 0.1 - bob); g.lineTo(p.x + sz * 1.1, p.y - sz * 1.2 - bob * 1.6); g.stroke(); }
  }
}
// ---------- track (world space) ----------
const TC = { wall: '#f4f1ea', wallTop: '#d93a2f', lane: ['#2a4c9e', '#2e57b3', '#2a4c9e'], sep: '#e9eef8', shadow: 'rgba(60,25,0,.28)' };
function track(g, v, r, tr, opt) {
  opt = opt || {}; setW(g, v, r); const W3 = T.LW * 3, L = T.LW;
  g.lineJoin = 'round';
  g.save(); g.translate(0.25, 0.4); g.strokeStyle = TC.shadow; g.lineWidth = W3 + 0.7; g.stroke(path(0)); g.restore();
  g.strokeStyle = TC.wallTop; g.lineWidth = W3 + 0.62; g.stroke(path(0));
  g.strokeStyle = TC.wall; g.lineWidth = W3 + 0.42; g.stroke(path(0));
  for (let i = 0; i < 3; i++) { g.strokeStyle = TC.lane[i]; g.lineWidth = L * 0.92; g.stroke(path((i - 1) * L)); }
  g.strokeStyle = 'rgba(255,255,255,.07)'; g.lineWidth = L * 0.3; for (let i = 0; i < 3; i++) g.stroke(path((i - 1) * L - L * 0.15));
  g.strokeStyle = TC.sep; g.lineWidth = 0.1; g.stroke(path(-L / 2)); g.stroke(path(L / 2));
  // infield carpet + banner
  g.fillStyle = '#2f8f4e'; rr(g, -T.A / 2 - T.RC + 1.3, -T.B / 2 - T.RC + 1.3, T.A + 2 * T.RC - 2.6, T.B + 2 * T.RC - 2.6, 2.4); g.fill();
  g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 0.08; g.setLineDash([0.4, 0.3]); rr(g, -T.A / 2 - T.RC + 1.8, -T.B / 2 - T.RC + 1.8, T.A + 2 * T.RC - 3.6, T.B + 2 * T.RC - 3.6, 2); g.stroke(); g.setLineDash([]);
  g.save(); if (v.rot) g.rotate(-Math.PI / 2); g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillStyle = 'rgba(0,0,0,.18)'; g.font = '900 2.05px system-ui,sans-serif'; g.fillText('TAMIYA', 0.08, -0.62); g.fillStyle = '#ffd23f'; g.fillText('TAMIYA', 0, -0.7);
  g.fillStyle = '#fff'; g.font = '800 1.05px system-ui,sans-serif'; g.fillText('L I N T A S A N', 0, 0.75);
  g.fillStyle = 'rgba(255,255,255,.75)'; g.font = '700 0.62px system-ui,sans-serif'; g.fillText((tr ? tr.e + ' ' + tr.n : '').toUpperCase(), 0, 1.75); g.restore();
  // zones
  if (tr) for (const z of tr.z) {
    for (let s = z.a; s < z.b; s += z.t === 'wave' ? 0.45 : 0.9) {
      const a = T.pos(s, -W3 / 2 + 0.05), b = T.pos(s, W3 / 2 - 0.05);
      if (z.t === 'wave') { g.strokeStyle = 'rgba(255,255,255,.42)'; g.lineWidth = 0.13; g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke(); }
      else { const m = T.pos(s, 0); g.save(); g.translate(m.x, m.y); g.rotate(m.a); g.fillStyle = z.t === 'up' ? 'rgba(255,210,63,.55)' : 'rgba(120,220,255,.5)'; g.beginPath(); const d = z.t === 'up' ? 1 : -1; g.moveTo(0.35 * d, 0); g.lineTo(-0.25 * d, -0.42); g.lineTo(-0.25 * d, 0.42); g.closePath(); g.fill(); g.restore(); }
    }
  }
  // lane changer bridge (clear cover from outer lane up and over to inner)
  { const n = 18; g.beginPath(); for (let i = 0; i <= n; i++) { const s = T.LC.a + (T.LC.b - T.LC.a) * i / n, f = i / n, o = T.LW - 2 * T.LW * (f * f * (3 - 2 * f)), q = T.pos(s, o - 0.62); i ? g.lineTo(q.x, q.y) : g.moveTo(q.x, q.y); }
    for (let i = n; i >= 0; i--) { const s = T.LC.a + (T.LC.b - T.LC.a) * i / n, f = i / n, o = T.LW - 2 * T.LW * (f * f * (3 - 2 * f)), q = T.pos(s, o + 0.62); g.lineTo(q.x, q.y); }
    g.closePath(); g.save(); g.translate(0.2, 0.35); g.fillStyle = 'rgba(0,0,0,.25)'; g.fill(); g.restore(); g.fillStyle = 'rgba(205,235,255,.55)'; g.fill(); g.strokeStyle = 'rgba(255,255,255,.9)'; g.lineWidth = 0.1; g.stroke(); }
  // start/finish checker
  { const p = T.pos(0, 0); g.save(); g.translate(p.x, p.y); g.rotate(p.a); const n = 6, hgt = W3 + 0.4; for (let i = 0; i < n; i++) for (let j = 0; j < 2; j++) { g.fillStyle = (i + j) % 2 ? '#111' : '#fff'; g.fillRect(-0.3 + j * 0.3, -hgt / 2 + i * hgt / n, 0.3, hgt / n); } g.restore(); }
  // corner timing gates
  for (let c = 0; c < 4; c++) {
    const s = T.CORNERS[c] - T.TGT, hot = opt.hot === c, a = T.pos(s, -W3 / 2 - 0.3), b = T.pos(s, W3 / 2 + 0.3);
    g.strokeStyle = hot ? '#ffd23f' : 'rgba(255,210,63,.55)'; g.lineWidth = hot ? 0.24 : 0.13; g.setLineDash(hot ? [] : [0.3, 0.2]); g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke(); g.setLineDash([]);
    const m = T.pos(T.CORNERS[c] + T.ARC / 2, W3 / 2 + 0.95); g.save(); g.translate(m.x, m.y); if (v.rot) g.rotate(-Math.PI / 2); g.fillStyle = hot ? '#ffd23f' : 'rgba(255,255,255,.85)'; g.beginPath(); g.arc(0, 0, 0.5, 0, 7); g.fill(); g.fillStyle = '#7a2b00'; g.font = '900 0.6px system-ui,sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(c + 1), 0, 0.03); g.restore();
  }
}
function rr(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
// ---------- car (local coords: +x forward, length ~1.5) ----------
function carShape(g, ch) {
  g.beginPath();
  if (ch === 'garuda') { g.moveTo(0.82, 0); g.lineTo(0.1, -0.36); g.lineTo(-0.55, -0.42); g.lineTo(-0.72, -0.3); g.lineTo(-0.72, 0.3); g.lineTo(-0.55, 0.42); g.lineTo(0.1, 0.36); }
  else if (ch === 'banteng') { g.moveTo(0.7, -0.3); g.lineTo(0.7, 0.3); g.lineTo(-0.7, 0.36); g.lineTo(-0.7, -0.36); }
  else if (ch === 'cendra') { g.ellipse(0, 0, 0.74, 0.36, 0, 0, Math.PI * 2); }
  else { g.moveTo(0.8, -0.1); g.lineTo(0.8, 0.1); g.lineTo(0.2, 0.34); g.lineTo(-0.7, 0.34); g.lineTo(-0.7, -0.34); g.lineTo(0.2, -0.34); }
  g.closePath();
}
function car(g, c, t) {
  // wheels
  g.fillStyle = '#151515'; for (const [x, y] of [[0.45, -0.4], [0.45, 0.4], [-0.45, -0.4], [-0.45, 0.4]]) { g.fillRect(x - 0.17, y - 0.1, 0.34, 0.2); g.fillStyle = 'rgba(255,255,255,.25)'; g.fillRect(x - 0.17 + ((t * 0.02) % 0.3), y - 0.1, 0.04, 0.2); g.fillStyle = '#151515'; }
  // rollers (signature mini 4WD bits)
  g.fillStyle = c.rol === 'karet' ? '#ff8a1f' : c.rol === 'plastik' ? '#f2f2f2' : '#c9ced8'; g.strokeStyle = '#555'; g.lineWidth = 0.03;
  for (const [x, y] of [[0.78, -0.42], [0.78, 0.42], [-0.74, -0.44], [-0.74, 0.44]]) { g.beginPath(); g.arc(x, y, 0.11, 0, 7); g.fill(); g.stroke(); }
  g.strokeStyle = '#888'; g.lineWidth = 0.07; g.beginPath(); g.moveTo(0.78, -0.42); g.lineTo(0.78, 0.42); g.moveTo(-0.74, -0.44); g.lineTo(-0.74, 0.44); g.stroke();
  // body
  carShape(g, c.ch); g.fillStyle = c.col; g.fill(); g.strokeStyle = 'rgba(0,0,0,.45)'; g.lineWidth = 0.05; g.stroke();
  g.save(); carShape(g, c.ch); g.clip(); g.fillStyle = c.col2; g.fillRect(-0.8, -0.09, 1.7, 0.18); g.fillStyle = 'rgba(255,255,255,.22)'; g.fillRect(-0.8, -0.4, 1.7, 0.14); g.restore();
  g.fillStyle = 'rgba(20,30,50,.75)'; g.beginPath(); g.ellipse(0.12, 0, 0.2, 0.15, 0, 0, 7); g.fill(); g.fillStyle = 'rgba(255,255,255,.5)'; g.beginPath(); g.ellipse(0.16, -0.05, 0.07, 0.04, 0, 0, 7); g.fill();
  g.fillStyle = c.col2; g.fillRect(-0.78, -0.38, 0.12, 0.76); // wing
  if (c.num) { g.save(); g.translate(-0.38, 0); g.rotate(Math.PI / 2); g.fillStyle = '#fff'; g.beginPath(); g.arc(0, 0, 0.16, 0, 7); g.fill(); g.fillStyle = '#111'; g.font = '900 0.22px system-ui,sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(c.num, 0, 0.01); g.restore(); }
}
// draw a car on the track: c = {s, L0, col, col2, ch, rol, num, name, me, coLeft, coAt, wob, v, lane4}
function placeCar(g, c, now, tr) {
  let s = c.s, lo = T.laneOff(s, c.L0), off = lo.off + (c.lane4 || 0), up = lo.up, p = T.pos(s, off), ang = p.a, sc = 1 + up * 0.22, alpha = 1, shad = 0.18 + up * 0.25;
  if (c.wob > 0) { off += Math.sin(now / 28) * 0.28 * c.wob; p = T.pos(s, off); ang += Math.sin(now / 40) * 0.5 * c.wob; }
  if (c.bump) p = { x: p.x + (Math.random() - 0.5) * 0.06, y: p.y + (Math.random() - 0.5) * 0.06, a: p.a };
  if (c.coLeft > 0) { // course out: fly outward, spin, land and fade
    const f = 1 - c.coLeft / 1500, at = T.pos(c.coAt, off), n = { x: -Math.sin(at.a), y: Math.cos(at.a) };
    const fwd = { x: Math.cos(at.a), y: Math.sin(at.a) }, d = Math.min(1, f * 1.6);
    p = { x: at.x + fwd.x * d * 2.2 - n.x * d * 4.2, y: at.y + fwd.y * d * 2.2 - n.y * d * 4.2 }; ang = at.a + f * 11; sc = 1 + Math.sin(Math.min(1, f * 1.6) * Math.PI) * 0.9; shad = 0.35 * sc; alpha = f > 0.8 ? (1 - f) * 5 : 1;
  }
  g.save(); g.globalAlpha = alpha; g.translate(p.x, p.y);
  g.fillStyle = 'rgba(0,0,0,' + Math.min(0.5, 0.25) + ')'; g.beginPath(); g.ellipse(shad, shad * 1.2, 0.8 * sc, 0.45 * sc, ang, 0, 7); g.fill();
  if (c.v > 9 && !(c.coLeft > 0)) { g.strokeStyle = 'rgba(255,255,255,' + Math.min(0.5, (c.v - 9) / 10) + ')'; g.lineWidth = 0.06; g.beginPath(); for (const y of [-0.25, 0.25]) { g.moveTo(-Math.cos(ang) * 0.8 - Math.sin(ang) * y, -Math.sin(ang) * 0.8 + Math.cos(ang) * y); g.lineTo(-Math.cos(ang) * (0.8 + c.v * 0.12) - Math.sin(ang) * y, -Math.sin(ang) * (0.8 + c.v * 0.12) + Math.cos(ang) * y); } g.stroke(); }
  g.rotate(ang); g.scale(sc * 0.95, sc * 0.95); car(g, c, now); g.restore();
  return p;
}
function makeFx() { const ps = []; return { ps, add(x, y, o) { o = o || {}; const n = o.n || 10; for (let i = 0; i < n; i++) { const a = Math.random() * 6.28, sp = (o.sp || 4) * (0.4 + Math.random()); ps.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: o.life || 0.5, t: 0, c: o.c || '#ffd23f', sz: o.sz || 0.12, conf: !!o.conf }); } }, step(dt) { for (let i = ps.length - 1; i >= 0; i--) { const p = ps[i]; p.t += dt; if (p.t > p.life) { ps.splice(i, 1); continue; } p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.94; p.vy *= 0.94; } }, draw(g) { for (const p of ps) { g.globalAlpha = 1 - p.t / p.life; g.fillStyle = p.c; if (p.conf) { g.save(); g.translate(p.x, p.y); g.rotate(p.t * 12); g.fillRect(-p.sz, -p.sz / 2, p.sz * 2, p.sz); g.restore(); } else { g.beginPath(); g.arc(p.x, p.y, p.sz, 0, 7); g.fill(); } } g.globalAlpha = 1; } }; }
// full scene; o = {W,H,r,top,bottom,track,cars,now,fx,hot,deco}
function scene(g, o) {
  const v = view(o.W, o.H, o.top || 0, o.bottom || 0, o.pad), r = o.r || 1;
  floor(g, o.W, o.H, r); if (o.deco !== false) { crowd(g, v, o.now, r, 18); bunting(g, o.W, (o.top || 0) + 4, o.now, r); }
  track(g, v, r, o.track, { hot: o.hot });
  setW(g, v, r); const shown = [];
  const cars = (o.cars || []).slice().sort((a, b) => (a.me ? 1 : 0) - (b.me ? 1 : 0));
  for (const c of cars) { const p = placeCar(g, c, o.now, o.track); shown.push([c, p]); if (c.me && o.halo) { g.strokeStyle = 'rgba(255,210,63,' + (0.5 + Math.sin(o.now / 150) * 0.3) + ')'; g.lineWidth = 0.1; g.beginPath(); g.arc(p.x, p.y, 1.05, 0, 7); g.stroke(); } }
  if (o.fx) o.fx.draw(g);
  // tags + bubbles in screen space
  g.setTransform(r, 0, 0, r, 0, 0); g.textAlign = 'center'; g.textBaseline = 'middle';
  for (const [c, p] of shown) {
    if (!p) continue; const s = v.scr(p.x, p.y);
    if (o.tags !== false && (c.me || c.name)) { const t = c.me ? 'KAMU' : String(c.name).slice(0, 9); g.font = '800 10px system-ui,sans-serif'; const w = g.measureText(t).width + 8; g.fillStyle = c.me ? '#ffd23f' : 'rgba(20,20,30,.72)'; rr(g, s.x - w / 2, s.y - v.k * 0.95 - 16, w, 14, 7); g.fill(); g.fillStyle = c.me ? '#3a1d00' : '#fff'; g.fillText(t, s.x, s.y - v.k * 0.95 - 9); }
    if (c.bubble) { const t = c.bubble.length > 26 ? c.bubble.slice(0, 25) + '…' : c.bubble; g.font = '700 12px system-ui,sans-serif'; const w = g.measureText(t).width + 14, bx = Math.max(4, Math.min(o.W - w - 4, s.x - w / 2)), by = s.y - v.k * 0.95 - 44; g.fillStyle = '#fff'; rr(g, bx, by, w, 22, 11); g.fill(); g.beginPath(); g.moveTo(s.x - 5, by + 21); g.lineTo(s.x + 5, by + 21); g.lineTo(s.x, by + 28); g.fill(); g.fillStyle = '#2a1a10'; g.fillText(t, bx + w / 2, by + 11.5); }
  }
  return v;
}
function grid(g, W, H, r, cars, now) { // lobby: starting grid on a 3-lane straight, big cars, name tags + chat bubbles
  floor(g, W, H, r); g.setTransform(r, 0, 0, r, 0, 0); bunting(g, W, 4, now, r);
  const y0 = 30, y1 = H - 10, lh = (y1 - y0 - 12) / 3, k = lh * 0.78, sx = W * 0.74;
  g.fillStyle = '#c8202a'; g.fillRect(0, y0, W, y1 - y0); g.fillStyle = '#fff'; for (let x = 0; x < W; x += 28) { g.fillRect(x, y0, 14, 6); g.fillRect(x + 14, y1 - 6, 14, 6); }
  g.fillStyle = '#2348b8'; g.fillRect(0, y0 + 6, W, y1 - y0 - 12);
  for (let i = 0; i < 3; i++) { g.fillStyle = i % 2 ? '#2a55c9' : '#2348b8'; g.fillRect(0, y0 + 6 + i * lh, W, lh); }
  g.strokeStyle = 'rgba(255,255,255,.75)'; g.lineWidth = 2; g.setLineDash([10, 8]); for (let i = 1; i < 3; i++) { g.beginPath(); g.moveTo(0, y0 + 6 + i * lh); g.lineTo(W, y0 + 6 + i * lh); g.stroke(); } g.setLineDash([]);
  const cs = 7; for (let y = y0 + 6, j = 0; y < y1 - 6; y += cs, j++) for (let c = 0; c < 2; c++) { g.fillStyle = (j + c) % 2 ? '#111' : '#fff'; g.fillRect(sx + c * cs, y, cs, Math.min(cs, y1 - 6 - y)); }
  g.font = '900 11px system-ui,sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = 'rgba(255,255,255,.35)'; g.save(); g.translate(sx + 26, (y0 + y1) / 2); g.rotate(-Math.PI / 2); g.fillText('S T A R T', 0, 0); g.restore();
  const LN = [0, 2, 1, 1], pos = cars.map((c, i) => ({ c, x: sx - k * 1.15 - (i >= 3 ? k * 3.7 : 0) - (i === 2 ? k * 0.45 : 0) - (i === 1 ? k * 0.2 : 0), y: y0 + 6 + (LN[i] + 0.5) * lh }));
  for (const q of pos) { const j = Math.sin(now / 33 + q.x) * 0.6; g.save(); g.translate(q.x + j, q.y); g.fillStyle = 'rgba(0,0,0,.28)'; g.beginPath(); g.ellipse(3, 4, k * 0.85, k * 0.45, 0, 0, 7); g.fill(); g.scale(k, k); car(g, q.c, 0); g.restore();
    if (q.c.me) { g.strokeStyle = 'rgba(255,210,63,' + (0.55 + Math.sin(now / 150) * 0.3) + ')'; g.lineWidth = 2.5; g.beginPath(); g.ellipse(q.x, q.y, k * 1.05, k * 0.62, 0, 0, 7); g.stroke(); } }
  for (const q of pos) { const t = q.c.me ? 'KAMU' : String(q.c.name || '').slice(0, 10); if (!t) continue; g.font = '800 10px system-ui,sans-serif'; const w = g.measureText(t).width + 8, x = Math.max(2, q.x - k * 0.95 - w); g.fillStyle = q.c.me ? '#ffd23f' : 'rgba(20,20,30,.75)'; rr(g, x, q.y - 7, w, 14, 7); g.fill(); g.fillStyle = q.c.me ? '#3a1d00' : '#fff'; g.textAlign = 'center'; g.fillText(t, x + w / 2, q.y); }
  for (const q of pos) { if (!q.c.bubble) continue; const t = q.c.bubble.length > 24 ? q.c.bubble.slice(0, 23) + '…' : q.c.bubble; g.font = '700 12px system-ui,sans-serif'; const w = g.measureText(t).width + 14, bx = Math.max(4, Math.min(W - w - 4, q.x + k * 0.5)), by = q.y - k * 0.6 - 24;
    g.fillStyle = '#fff'; g.shadowColor = 'rgba(0,0,0,.25)'; g.shadowBlur = 6; rr(g, bx, by, w, 22, 11); g.fill(); g.shadowBlur = 0; g.beginPath(); g.moveTo(q.x + k * 0.3, by + 21); g.lineTo(q.x + k * 0.55 + 8, by + 21); g.lineTo(q.x + k * 0.3, by + 30); g.fill(); g.fillStyle = '#2a1a10'; g.textAlign = 'center'; g.fillText(t, bx + w / 2, by + 11.5); }
}
function preview(g, W, H, r, c, now) { // garage turntable
  g.setTransform(r, 0, 0, r, 0, 0); g.clearRect(0, 0, W, H);
  const gr = g.createRadialGradient(W / 2, H * 0.6, 10, W / 2, H * 0.6, W * 0.6); gr.addColorStop(0, '#ffe7b8'); gr.addColorStop(1, '#f0b46a'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
  g.fillStyle = 'rgba(120,60,10,.18)'; g.beginPath(); g.ellipse(W / 2, H * 0.58, W * 0.36, H * 0.22, 0, 0, 7); g.fill();
  const k = Math.min(W, H) * 0.42; g.translate(W / 2, H * 0.55); g.fillStyle = 'rgba(0,0,0,.25)'; g.beginPath(); g.ellipse(6, 10, k * 0.8, k * 0.42, now / 1400, 0, 7); g.fill(); g.rotate(now / 1400); g.scale(k, k); car(g, c, now); g.setTransform(1, 0, 0, 1, 0, 0);
}
root.TLR = { view, scene, makeFx, preview, grid, placeCar, HALF_X, HALF_Y };
})(window);

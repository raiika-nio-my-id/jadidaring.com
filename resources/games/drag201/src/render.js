/* Drag 201: canvas renderer (night circuit, side view). R.scene(ctx, opts) draws one frame. */
(function (root) {
'use strict';
const D = root.D201;
const TAU = Math.PI * 2;
function rr(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
function hash(n) { n = Math.sin(n * 127.1 + 311.7) * 43758.5453; return n - Math.floor(n); }
/* ---------- particles ---------- */
function makeFx() {
  const P = [];
  return {
    P,
    add(p) { if (P.length < 260) P.push(p); },
    smoke(x, y, n, s) { for (let i = 0; i < n; i++) this.add({ k: 's', x: x + (Math.random() - 0.5) * 6, y: y - Math.random() * 4, vx: -20 - Math.random() * 50, vy: -8 - Math.random() * 18, r: (4 + Math.random() * 6) * (s || 1), a: 0.55, life: 0.9 + Math.random() * 0.6, t: 0 }); },
    flame(x, y, big) { for (let i = 0; i < (big ? 10 : 5); i++) this.add({ k: 'f', x, y, vx: -60 - Math.random() * 90, vy: (Math.random() - 0.5) * 24, r: 3 + Math.random() * (big ? 6 : 3), a: 1, life: 0.18 + Math.random() * 0.16, t: 0 }); },
    spark(x, y, cols, n) { for (let i = 0; i < n; i++) { const a = Math.random() * TAU, v = 60 + Math.random() * 160; this.add({ k: 'p', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 60, r: 2 + Math.random() * 3, a: 1, life: 0.7 + Math.random() * 0.6, t: 0, c: cols[i % cols.length] }); } },
    step(dt) { for (let i = P.length - 1; i >= 0; i--) { const p = P[i]; p.t += dt; if (p.t >= p.life) { P.splice(i, 1); continue; } p.x += p.vx * dt; p.y += p.vy * dt; if (p.k === 'p') p.vy += 260 * dt; if (p.k === 's') { p.r += 18 * dt; p.vx *= 0.97; } } },
    draw(g, ox) {
      for (const p of P) {
        const k = 1 - p.t / p.life, x = p.x - (p.world ? ox : 0);
        if (p.k === 's') { g.fillStyle = 'rgba(210,214,226,' + (p.a * k * 0.6) + ')'; g.beginPath(); g.arc(x, p.y, p.r, 0, TAU); g.fill(); }
        else if (p.k === 'f') { g.fillStyle = k > 0.5 ? 'rgba(255,236,140,' + k + ')' : 'rgba(255,120,40,' + k + ')'; g.beginPath(); g.arc(x, p.y, p.r * (0.5 + k), 0, TAU); g.fill(); }
        else { g.fillStyle = p.c; g.globalAlpha = k; g.fillRect(x - p.r / 2, p.y - p.r / 2, p.r, p.r * 1.6); g.globalAlpha = 1; }
      }
    }
  };
}
/* ---------- the bike (side view, facing right). (x,y) = rear wheel contact point, s = scale (1 = 64px wheelbase) ---------- */
function bike(g, x, y, s, o) {
  const col = o.col || '#e8463a', col2 = o.col2 || '#fff', ang = -(o.wheelie || 0) * 0.42, spin = o.spin || 0, lean = o.lean || 0;
  g.save(); g.translate(x, y); g.scale(s, s); g.rotate(ang);
  const R = o.matic ? 11 : 13, wb = 64;
  // shadow
  g.save(); g.rotate(-ang); g.fillStyle = 'rgba(0,0,0,.35)'; g.beginPath(); g.ellipse(wb / 2, 2, 46, 5, 0, 0, TAU); g.fill(); g.restore();
  const wheel = (cx) => {
    g.save(); g.translate(cx, -R);
    g.fillStyle = '#111'; g.beginPath(); g.arc(0, 0, R, 0, TAU); g.fill();
    g.strokeStyle = '#2a2a2a'; g.lineWidth = 2; g.beginPath(); g.arc(0, 0, R - 1.5, 0, TAU); g.stroke();
    g.fillStyle = '#9aa3b5'; g.beginPath(); g.arc(0, 0, R - 4.5, 0, TAU); g.fill();
    g.fillStyle = '#1b1e26'; g.beginPath(); g.arc(0, 0, R - 6.5, 0, TAU); g.fill();
    g.rotate(spin); g.strokeStyle = '#cfd6e4'; g.lineWidth = 1.4;
    for (let i = 0; i < 6; i++) { g.rotate(TAU / 6); g.beginPath(); g.moveTo(0, 0); g.lineTo(R - 5, 0); g.stroke(); }
    g.fillStyle = '#e9edf5'; g.beginPath(); g.arc(0, 0, 2.2, 0, TAU); g.fill(); g.restore();
  };
  wheel(0); wheel(wb);
  // swingarm + fork
  g.strokeStyle = '#3b3f4b'; g.lineWidth = 4; g.lineCap = 'round';
  g.beginPath(); g.moveTo(0, -R); g.lineTo(24, -R - 7); g.stroke();
  g.strokeStyle = '#c9ced8'; g.lineWidth = 3.2; g.beginPath(); g.moveTo(wb, -R); g.lineTo(wb - 9, -R - 25); g.stroke();
  if (o.matic) {
    // scooter (matic): CVT case + small muffler, curved body cowl, floorboard, front apron
    g.fillStyle = '#3a3e49'; rr(g, -2, -R - 9, 26, 8, 4); g.fill(); g.fillStyle = '#6b707c'; rr(g, -12, -R - 12, 12, 6, 3); g.fill();
    g.fillStyle = col; g.beginPath(); g.moveTo(-8, -R - 14); g.quadraticCurveTo(-6, -R - 27, 10, -R - 27); g.lineTo(30, -R - 25); g.quadraticCurveTo(34, -R - 14, 28, -R - 9); g.lineTo(4, -R - 8); g.closePath(); g.fill();
    g.fillStyle = col2; g.beginPath(); g.moveTo(0, -R - 19); g.quadraticCurveTo(10, -R - 24, 26, -R - 21); g.lineTo(25, -R - 18); g.quadraticCurveTo(10, -R - 20, 1, -R - 16); g.closePath(); g.fill();
    g.fillStyle = '#20232b'; rr(g, 26, -R - 9, 22, 4, 2); g.fill();
    g.fillStyle = col; g.beginPath(); g.moveTo(44, -R - 6); g.quadraticCurveTo(52, -R - 22, 52, -R - 40); g.lineTo(60, -R - 40); g.quadraticCurveTo(62, -R - 22, 56, -R - 5); g.closePath(); g.fill();
    g.fillStyle = col; g.beginPath(); g.arc(wb, -R, R + 3, Math.PI * 1.05, Math.PI * 1.75); g.lineTo(wb, -R); g.fill();
  } else {
  // exhaust (expansion chamber for 2T look)
    g.fillStyle = '#5b5f6b'; g.beginPath(); g.moveTo(-6, -R - 4); g.quadraticCurveTo(8, -R + 4, 28, -R - 2); g.lineTo(28, -R - 7); g.quadraticCurveTo(10, -R - 4, -6, -R - 10); g.closePath(); g.fill();
    g.fillStyle = '#8d929e'; g.fillRect(-10, -R - 9.5, 6, 5);
    // engine block
    g.fillStyle = '#2b2e37'; rr(g, 20, -R - 15, 18, 13, 3); g.fill(); g.fillStyle = '#4a4e5a'; for (let i = 0; i < 3; i++) g.fillRect(22 + i * 5, -R - 14, 3, 11);
    // body
    g.fillStyle = col; g.beginPath(); g.moveTo(10, -R - 16); g.lineTo(22, -R - 26); g.lineTo(46, -R - 30); g.lineTo(wb - 6, -R - 34); g.lineTo(wb - 2, -R - 26); g.lineTo(40, -R - 16); g.closePath(); g.fill();
    g.fillStyle = col2; g.beginPath(); g.moveTo(26, -R - 25); g.lineTo(46, -R - 28.5); g.lineTo(44, -R - 24); g.lineTo(28, -R - 21.5); g.closePath(); g.fill();
  }
  // seat + tail
  g.fillStyle = '#16181e'; rr(g, 4, -R - 23, 22, 6, 3); g.fill(); g.fillStyle = col; g.beginPath(); g.moveTo(-4, -R - 20); g.lineTo(8, -R - 24); g.lineTo(10, -R - 17); g.closePath(); g.fill();
  // headlight + number plate
  g.fillStyle = '#fff7d1'; g.beginPath(); g.arc(wb - 3, -R - 30, 3, 0, TAU); g.fill();
  g.fillStyle = '#f4f4f4'; rr(g, wb - 14, -R - 41, 12, 9, 2); g.fill(); g.fillStyle = '#111'; g.font = 'bold 7px system-ui'; g.textAlign = 'center'; g.fillText(o.num || '1', wb - 8, -R - 34);
  // rider (crouched)
  g.save(); g.translate(18, -R - 24); g.rotate(-0.12 - lean * 0.25);
  g.fillStyle = o.suit || '#1d2233'; g.beginPath(); g.moveTo(-6, 0); g.quadraticCurveTo(4, -20, 26, -18); g.lineTo(30, -10); g.quadraticCurveTo(12, -8, 6, 4); g.closePath(); g.fill();
  g.strokeStyle = o.suit || '#1d2233'; g.lineWidth = 6; g.beginPath(); g.moveTo(2, 2); g.lineTo(12, 10); g.lineTo(18, 6); g.stroke();
  g.lineWidth = 4.5; g.beginPath(); g.moveTo(22, -14); g.lineTo(34, -6); g.stroke();
  g.fillStyle = col2 === '#111' ? '#f2f2f2' : col2; g.beginPath(); g.arc(31, -22, 7.5, 0, TAU); g.fill();
  g.fillStyle = col; g.beginPath(); g.arc(31, -22, 7.5, Math.PI * 1.05, Math.PI * 1.75); g.lineTo(31, -22); g.fill();
  g.fillStyle = 'rgba(20,24,40,.85)'; g.beginPath(); g.ellipse(35, -21, 3.6, 2.6, 0.2, 0, TAU); g.fill();
  g.restore();
  g.restore();
}
/* ---------- the circuit ---------- */
function backdrop(g, W, H, cam, now, horizon, day) {
  const T = day ? { s0: '#5fb4ff', s1: '#9fd6ff', s2: '#ffd9a0', city: '#7d93b8', win: 'rgba(255,255,255,.35)', pole: '#56607a', box: '#6b7591', stand: '#5a6a8f', rail: '#6d7fa6', head: '#3b2a20' } : { s0: '#0b0f2a', s1: '#26184a', s2: '#5a2a58', city: '#1b1636', win: 'rgba(255,214,120,.35)', pole: '#2a2547', box: '#3a3460', stand: '#2d2350', rail: '#3a2d66', head: '#120f22' };
  const sky = g.createLinearGradient(0, 0, 0, horizon); sky.addColorStop(0, T.s0); sky.addColorStop(0.6, T.s1); sky.addColorStop(1, T.s2); g.fillStyle = sky; g.fillRect(0, 0, W, horizon + 2);
  if (day) { // morning sun + soft clouds (Sunmori pagi)
    const sx = W * 0.78 - cam * 0.01 % W, sy = horizon * 0.32, sg = g.createRadialGradient(sx, sy, 4, sx, sy, 70); sg.addColorStop(0, 'rgba(255,248,214,1)'); sg.addColorStop(0.35, 'rgba(255,226,150,.55)'); sg.addColorStop(1, 'rgba(255,226,150,0)'); g.fillStyle = sg; g.beginPath(); g.arc(sx, sy, 70, 0, TAU); g.fill();
    g.fillStyle = 'rgba(255,255,255,.75)'; for (let i = 0; i < 6; i++) { const cx = ((hash(i + 40) * W * 1.4 - cam * 0.05) % (W + 160) + W + 160) % (W + 160) - 80, cy = horizon * (0.12 + hash(i + 50) * 0.3); g.beginPath(); g.ellipse(cx, cy, 34, 9, 0, 0, TAU); g.ellipse(cx + 18, cy - 6, 20, 9, 0, 0, TAU); g.fill(); }
  } else for (let i = 0; i < 40; i++) { const x = (hash(i) * W * 1.3 - cam * 0.02) % (W + 20), y = hash(i + 9) * horizon * 0.55; g.fillStyle = 'rgba(255,255,255,' + (0.25 + 0.5 * hash(i + 3) * (0.6 + 0.4 * Math.sin(now / 700 + i))) + ')'; g.fillRect((x + W + 20) % (W + 20) - 10, y, 1.6, 1.6); }
  // far city
  const p1 = cam * 0.12; g.fillStyle = T.city;
  for (let i = -1; i < W / 38 + 2; i++) { const k = Math.floor(p1 / 38) + i, h = 30 + hash(k) * 60, x = k * 38 - p1; g.fillRect(x, horizon - h - 26, 34, h + 26); g.fillStyle = T.win; for (let j = 0; j < 5; j++) if (hash(k * 7 + j) > 0.55) g.fillRect(x + 5 + (j % 3) * 9, horizon - h - 16 + Math.floor(j / 3) * 12, 4, 5); g.fillStyle = T.city; }
  // floodlight towers
  const p2 = cam * 0.35, step = 260;
  for (let i = -1; i < W / step + 2; i++) {
    const k = Math.floor(p2 / step) + i, x = k * step - p2 + 60;
    g.fillStyle = T.pole; g.fillRect(x - 2, horizon - 150, 4, 150);
    g.fillStyle = T.box; rr(g, x - 20, horizon - 165, 40, 16, 3); g.fill(); if (day) { g.fillStyle = '#dfe6f2'; for (let j = 0; j < 4; j++) g.fillRect(x - 16 + j * 9, horizon - 161, 6, 8); continue; }
    const gl = g.createRadialGradient(x, horizon - 157, 2, x, horizon - 157, 90); gl.addColorStop(0, 'rgba(255,250,220,.75)'); gl.addColorStop(0.2, 'rgba(255,240,190,.22)'); gl.addColorStop(1, 'rgba(255,240,190,0)'); g.fillStyle = gl; g.beginPath(); g.arc(x, horizon - 157, 90, 0, TAU); g.fill();
    for (let j = 0; j < 4; j++) { g.fillStyle = '#fffbe6'; g.fillRect(x - 16 + j * 9, horizon - 161, 6, 8); }
  }
  // grandstand + crowd
  const p3 = cam * 0.6, gy = horizon - 46; g.fillStyle = T.stand; g.fillRect(0, gy, W, 46);
  g.fillStyle = T.rail; for (let r = 0; r < 4; r++) g.fillRect(0, gy + 4 + r * 11, W, 2);
  for (let i = -1; i < W / 9 + 2; i++) {
    const k = Math.floor(p3 / 9) + i, x = k * 9 - p3, row = Math.floor(hash(k) * 4), y = gy + 10 + row * 11, bob = Math.sin(now / 180 + k) * (hash(k + 2) > 0.7 ? 2.2 : 0.6);
    const c = ['#ff6b6b', '#ffd23f', '#4ecdc4', '#f7f1e3', '#a29bfe', '#ff9f43'][Math.floor(hash(k + 5) * 6)];
    g.fillStyle = T.head; g.beginPath(); g.arc(x, y - 5 + bob, 3, 0, TAU); g.fill(); g.fillStyle = c; g.fillRect(x - 3, y - 2 + bob, 6, 6);
    if (hash(k + 11) > 0.93) { g.fillStyle = c; g.fillRect(x + 2, y - 14 + bob, 1.5, 10); g.fillRect(x + 3, y - 14 + bob, 8, 5); }
  }
  // sponsor wall (generic)
  const p4 = cam * 0.85, wy = horizon - 20, bw = 220, texts = ['GAS DI SIRKUIT', 'TERTIB DI JALAN', 'DRAG 201 M', 'JADIDARING', 'BALAP RESMI', 'PAKAI HELM'];
  for (let i = -1; i < W / bw + 2; i++) { const k = Math.floor(p4 / bw) + i, x = k * bw - p4, cols = [['#ffd23f', '#1a1a1a'], ['#e8463a', '#fff'], ['#2f7de1', '#fff'], ['#1fa35b', '#fff']][((k % 4) + 4) % 4];
    g.fillStyle = cols[0]; g.fillRect(x, wy, bw - 4, 20); g.fillStyle = cols[1]; g.font = '900 12px system-ui,sans-serif'; g.textAlign = 'center'; g.fillText(texts[((k % texts.length) + texts.length) % texts.length], x + bw / 2 - 2, wy + 14.5); }
}
/** draw a full race frame. o: { W, H, lanes:[{run, name, col, col2, me, num, bot}], camD (meters at screen anchor), now, fx, shake, tut } */
function scene(g, o) {
  const W = o.W, H = o.H, bot = o.bottom || 0, ppm = Math.max(10, Math.min(22, W / 34)), horizon = Math.round(o.hz ? H * o.hz : Math.min(H * 0.42, (H - bot) * 0.5)), camPx = o.camD * ppm, ax = W * (o.ax || 0.3);
  g.save(); if (o.shake) g.translate((Math.random() - 0.5) * o.shake, (Math.random() - 0.5) * o.shake);
  backdrop(g, W, H, camPx, o.now, horizon, o.day);
  // track
  const ty = horizon + 18, th = H - ty; const tg = g.createLinearGradient(0, ty, 0, H); tg.addColorStop(0, o.day ? '#55565f' : '#34343e'); tg.addColorStop(1, o.day ? '#3a3b44' : '#22222a'); g.fillStyle = tg; g.fillRect(0, ty, W, th);
  g.fillStyle = '#c9c9c9'; g.fillRect(0, ty, W, 3); g.fillStyle = '#7a1f1f'; for (let x = -((camPx) % 40); x < W; x += 40) g.fillRect(x, ty + 3, 20, 4);
  g.fillStyle = '#1d6b3a'; g.fillRect(0, horizon + 2, W, 16);
  const n = Math.max(1, o.lanes.length), laneH = Math.min(120, (H - bot - ty - 10) / n);
  // asphalt grain
  g.fillStyle = 'rgba(255,255,255,.035)'; for (let i = 0; i < 70; i++) { const x = ((hash(i) * 2000 - camPx) % 2000 + 2000) % 2000 * (W / 2000), y = ty + 10 + hash(i + 50) * (th - 10); g.fillRect(x, y, 2, 1); }
  // lane lines + marks
  for (let i = 1; i < n; i++) { const y = ty + 8 + i * laneH; g.fillStyle = 'rgba(255,255,255,.75)'; for (let x = -((camPx) % 34); x < W; x += 34) g.fillRect(x, y - 1.5, 18, 3); }
  const mk = m => ax + (m - o.camD) * ppm;
  // start line + staging gantry
  const sx = mk(0); if (sx > -60 && sx < W + 60) { g.fillStyle = '#fff'; g.fillRect(sx - 2, ty + 6, 4, th - 6); g.fillStyle = '#ddd'; g.font = '800 11px system-ui'; g.textAlign = 'center'; g.fillText('START', sx, ty + 20); }
  // distance boards
  for (const m of [50, 100, 150]) { const x = mk(m); if (x < -40 || x > W + 40) continue; g.fillStyle = '#f2f2f2'; g.fillRect(x - 1, ty - 34, 2, 34); rr(g, x - 18, ty - 50, 36, 18, 3); g.fill(); g.fillStyle = '#111'; g.font = '900 12px system-ui'; g.fillText(m + ' m', x, ty - 37); }
  // finish
  const fx = mk(D.DIST); if (fx > -80 && fx < W + 80) {
    for (let r = 0; r < Math.ceil((th - 6) / 10); r++) for (let c = 0; c < 2; c++) { g.fillStyle = (r + c) % 2 ? '#111' : '#fff'; g.fillRect(fx - 10 + c * 10, ty + 6 + r * 10, 10, 10); }
    g.fillStyle = '#2b2b33'; g.fillRect(fx - 40, ty - 96, 6, 96 + 8); g.fillRect(fx + 34, ty - 96, 6, 96 + 8);
    g.fillStyle = '#e8463a'; rr(g, fx - 46, ty - 120, 92, 28, 5); g.fill(); g.fillStyle = '#fff'; g.font = '900 16px system-ui'; g.fillText('FINISH 201', fx, ty - 100);
  }
  // bikes (far lane first)
  o.lanes.forEach((L, i) => {
    const r = L.run, y = ty + 8 + (i + 1) * laneH - laneH * 0.2, s = Math.max(0.5, Math.min(1.25, laneH / 56)), x = mk(r.d) - 64 * s;
    if (x < -120 || x > W + 60) return;
    if (L.me) { g.fillStyle = 'rgba(255,210,63,.09)'; g.fillRect(0, y - laneH * 0.8, W, laneH * 0.95); }
    bike(g, x, y, s, { matic: !!((L.spec && L.spec.cvt) || (L.run.sp && L.run.sp.cvt)), col: L.col, col2: L.col2, wheelie: r.wheelie, spin: (r.d / 0.0817) % TAU, num: L.num, lean: r.launched && r.fin === null ? 1 : 0 });
    if (r.nosT > 0) { o.fx.add({ k: 'f', x: x - 8 * s, y: y - 20 * s, vx: -140, vy: (Math.random() - 0.5) * 20, r: 5 * s, a: 1, life: 0.16, t: 0 }); }
    g.font = '800 ' + Math.round(11 + s * 2) + 'px system-ui'; g.textAlign = 'center'; const label = L.name + (L.bot ? ' 🤖' : '');
    const tw = g.measureText(label).width + 12; g.fillStyle = L.me ? 'rgba(255,210,63,.95)' : 'rgba(10,12,24,.72)'; rr(g, x + 32 * s - tw / 2, y - 70 * s - 18, tw, 18, 9); g.fill();
    g.fillStyle = L.me ? '#1a1300' : '#fff'; g.fillText(label, x + 32 * s, y - 70 * s - 5);
    L.sx = x; L.sy = y; L.s = s;
  });
  o.fx.draw(g, 0);
  // speed lines
  const me = o.lanes.find(L => L.me); if (me && me.run.v > 22) { const k = (me.run.v - 22) / 25; g.strokeStyle = 'rgba(255,255,255,' + Math.min(0.35, k * 0.35) + ')'; g.lineWidth = 1.5; for (let i = 0; i < 14; i++) { const y = hash(i + Math.floor(o.now / 60)) * H, x = hash(i * 3 + Math.floor(o.now / 60)) * W; g.beginPath(); g.moveTo(x, y); g.lineTo(x - 60 - k * 80, y); g.stroke(); } }
  // vignette
  const vg = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, o.day ? 'rgba(0,0,0,.22)' : 'rgba(0,0,0,.45)'); g.fillStyle = vg; g.fillRect(0, 0, W, H);
  g.restore();
  return { ppm, ax, ty, laneH };
}
/* ---------- tachometer (own canvas) ---------- */
function tach(g, S, run, o) {
  const cx = S / 2, cy = S / 2 + S * 0.06, R = S * 0.44, a0 = Math.PI * 0.8, a1 = Math.PI * 2.2, A = x => a0 + (a1 - a0) * x;
  g.clearRect(0, 0, S, S);
  g.fillStyle = 'rgba(8,10,22,.82)'; g.beginPath(); g.arc(cx, cy, R + S * 0.05, 0, TAU); g.fill();
  g.lineWidth = S * 0.07; g.lineCap = 'butt';
  const band = (x0, x1, c) => { g.strokeStyle = c; g.beginPath(); g.arc(cx, cy, R - S * 0.04, A(x0), A(x1)); g.stroke(); };
  band(0, 1, 'rgba(255,255,255,.12)');
  if (!run.launched) { const b = D.launchBand(o.grip || 0); band(b[0], b[1], '#3ddc84'); }
  else if (run.sp.cvt) band(0.86, 0.97, 'rgba(255,95,162,.75)');
  else { band(D.SHIFT.good[0], D.SHIFT.perfect[0], 'rgba(255,210,63,.7)'); band(D.SHIFT.perfect[0], D.SHIFT.perfect[1], '#3ddc84'); band(0.975, 1, '#ff4d4d'); }
  g.strokeStyle = 'rgba(255,255,255,.6)'; g.lineWidth = 2;
  for (let i = 0; i <= 13; i++) { const a = A(i / 13); g.beginPath(); g.moveTo(cx + Math.cos(a) * (R - S * 0.09), cy + Math.sin(a) * (R - S * 0.09)); g.lineTo(cx + Math.cos(a) * (R - S * 0.13), cy + Math.sin(a) * (R - S * 0.13)); g.stroke(); }
  const x = Math.max(0, Math.min(1.02, run.rpm)), a = A(x), hot = run.launched && !run.sp.cvt ? x >= D.SHIFT.perfect[0] : false;
  g.strokeStyle = hot ? '#3ddc84' : '#ff7a3d'; g.lineWidth = S * 0.025; g.lineCap = 'round'; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(a) * (R - S * 0.06), cy + Math.sin(a) * (R - S * 0.06)); g.stroke();
  g.fillStyle = '#e9edf5'; g.beginPath(); g.arc(cx, cy, S * 0.04, 0, TAU); g.fill();
  g.fillStyle = '#fff'; g.textAlign = 'center'; g.font = '900 ' + Math.round(S * 0.2) + 'px system-ui'; g.fillText(run.launched ? (run.sp.cvt ? 'D' : String(run.g + 1)) : 'N', cx, cy + S * 0.27);
  g.font = '800 ' + Math.round(S * 0.085) + 'px system-ui'; g.fillStyle = 'rgba(255,255,255,.75)'; g.fillText(Math.round(run.v * 3.6) + ' km/j', cx, cy + S * 0.4);
  g.fillStyle = 'rgba(255,255,255,.55)'; g.font = '700 ' + Math.round(S * 0.06) + 'px system-ui'; g.fillText('x1000 rpm', cx, cy - S * 0.16);
  // shift light
  if (run.launched && hot && run.fin === null) { g.fillStyle = 'rgba(61,220,132,' + (0.55 + 0.45 * Math.sin(o.now / 40)) + ')'; g.beginPath(); g.arc(cx, cy - R * 0.55, S * 0.045, 0, TAU); g.fill(); }
}
root.D201R = { scene, tach, bike, backdrop, makeFx, rr };
})(typeof window !== 'undefined' ? window : globalThis);

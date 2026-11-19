// Kopi Senja - canvas renderer: dusk cafe (window sky + jam pulang kantor traffic), pendant lamps, customers in queue, wooden counter,
// espresso machine, layered glass / ceramic cup, steam, latte-art top view, particles (coins, stars, splash), confetti, shake.
(function (G) {
  'use strict';
  var R = { L: {} }, cv, cx, CFG, parts = [], conf = [], shakeT = 0, T = 0, cars = [], stars = [];
  function lerp(a, b, t) { return a + (b - a) * t; }
  function hex(h) { h = h.replace('#', ''); if (h.length === 3) h = h.split('').map(function (c) { return c + c; }).join(''); var n = parseInt(h, 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
  function mix(a, b, t) { var x = hex(a), y = hex(b); return 'rgb(' + Math.round(lerp(x[0], y[0], t)) + ',' + Math.round(lerp(x[1], y[1], t)) + ',' + Math.round(lerp(x[2], y[2], t)) + ')'; }
  function rr(x, y, w, h, r) { cx.beginPath(); cx.moveTo(x + r, y); cx.arcTo(x + w, y, x + w, y + h, r); cx.arcTo(x + w, y + h, x, y + h, r); cx.arcTo(x, y + h, x, y, r); cx.arcTo(x, y, x + w, y, r); cx.closePath(); }
  R.init = function (canvas, cfg) {
    cv = canvas; cx = cv.getContext('2d'); CFG = cfg;
    for (var i = 0; i < 14; i++) cars.push({ x: Math.random(), lane: i % 2, sp: 0.01 + Math.random() * 0.02, c: Math.random() < 0.5 ? 0 : 1 });
    for (i = 0; i < 26; i++) stars.push({ x: Math.random(), y: Math.random() * 0.5, s: Math.random() });
  };
  R.layout = function (w, h, dpr, ins) {
    cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); cv.style.width = w + 'px'; cv.style.height = h + 'px';
    var L = R.L; L.w = w; L.h = h; L.dpr = dpr; L.top = ins.top; L.bottom = ins.bottom;
    var avail = h - ins.top - ins.bottom; L.k = Math.max(0.7, Math.min(1.8, Math.min(w / 390, avail / 340)));
    L.counterY = h - ins.bottom - Math.max(46 * L.k, avail * 0.13); L.cx = w / 2;
    L.winTop = Math.max(0, ins.top - 70); L.winBot = L.counterY - Math.min(avail * 0.2, 90 * L.k);
    var cw = Math.min(w, 760); L.colL = (w - cw) / 2; L.colW = cw;
    L.cupX = w / 2 + Math.min(cw * 0.22, 120 * L.k); L.cupY = L.counterY + 6 * L.k;
    L.custX = w / 2 - Math.min(cw * (cw < 500 ? 0.1 : 0.16), 90 * L.k);
    var ar = Math.min(w * 0.4, (h - ins.top - 150) * 0.36, 230); L.art = { x: w / 2, y: ins.top + (h - ins.top - 150) / 2 + 20, r: ar };
  };
  // ---------- background ----------
  function sky(prog) {
    var L = R.L, y0 = L.winTop, y1 = L.winBot, g = cx.createLinearGradient(0, y0, 0, y1);
    g.addColorStop(0, mix('#3a6fb0', '#2a1b4d', prog)); g.addColorStop(0.45, mix('#f7a76a', '#b34d6d', prog)); g.addColorStop(0.8, mix('#ffd38a', '#f08a4b', prog)); g.addColorStop(1, mix('#ffe2a8', '#ffb36b', prog));
    cx.fillStyle = g; cx.fillRect(0, y0, L.w, y1 - y0);
    // stars come out later
    if (prog > 0.45) { cx.fillStyle = 'rgba(255,255,255,' + ((prog - 0.45) * 1.4).toFixed(2) + ')'; stars.forEach(function (s) { var tw = 0.6 + 0.4 * Math.sin(T * 2 + s.s * 9); cx.globalAlpha = Math.min(1, (prog - 0.45) * 1.6) * tw; cx.fillRect(s.x * L.w, y0 + s.y * (y1 - y0) * 0.6, 1.6, 1.6); }); cx.globalAlpha = 1; }
    // sun sinking
    var sy = lerp(y0 + (y1 - y0) * 0.45, y1 + 10, prog), sr = 30 * L.k;
    var sg = cx.createRadialGradient(L.w * 0.7, sy, 2, L.w * 0.7, sy, sr * 3); sg.addColorStop(0, 'rgba(255,240,190,.95)'); sg.addColorStop(0.3, 'rgba(255,190,110,.55)'); sg.addColorStop(1, 'rgba(255,150,90,0)');
    cx.fillStyle = sg; cx.beginPath(); cx.arc(L.w * 0.7, sy, sr * 3, 0, 7); cx.fill(); cx.fillStyle = '#fff1c4'; cx.beginPath(); cx.arc(L.w * 0.7, sy, sr, 0, 7); cx.fill();
    // skyline
    var base = y1 - 26 * L.k, bw = 34 * L.k, x = -10, i = 0;
    cx.fillStyle = mix('#5b3d5e', '#22183a', prog);
    while (x < L.w + 40) { var hh = (40 + ((i * 37) % 70)) * L.k * (i % 5 === 2 ? 1.8 : 1); cx.fillRect(x, base - hh, bw - 4, hh + 30); if (i % 5 === 2) { cx.fillRect(x + bw / 2 - 3, base - hh - 14 * L.k, 2, 14 * L.k); }
      // lit windows
      if (prog > 0.25) { cx.fillStyle = 'rgba(255,214,120,' + Math.min(0.9, (prog - 0.2) * 1.5).toFixed(2) + ')'; for (var wy = base - hh + 6; wy < base - 4; wy += 9 * L.k) for (var wx = x + 4; wx < x + bw - 8; wx += 8 * L.k) if (((wx * 7 + wy * 3 + i) | 0) % 3 === 0) cx.fillRect(wx, wy, 3 * L.k, 4 * L.k); cx.fillStyle = mix('#5b3d5e', '#22183a', prog); }
      x += bw + ((i * 13) % 9); i++; }
    // road with jam pulang kantor traffic
    cx.fillStyle = '#2b2430'; cx.fillRect(0, base, L.w, y1 - base); cx.fillStyle = 'rgba(255,255,255,.25)'; for (var d = (T * 20) % 30; d < L.w; d += 30) cx.fillRect(d, base + (y1 - base) / 2 - 1, 12, 2);
    var rush = R.rush ? 0.4 : 1;
    cars.forEach(function (c) { c.x += c.sp * 0.016 * rush * (c.lane ? -1 : 1); if (c.x > 1.1) c.x = -0.1; if (c.x < -0.1) c.x = 1.1;
      var yy = base + (c.lane ? (y1 - base) * 0.72 : (y1 - base) * 0.28), xx = c.x * L.w, w = 18 * L.k;
      cx.fillStyle = c.c ? '#e8c547' : '#d9dce3'; rr(xx - w / 2, yy - 4 * L.k, w, 7 * L.k, 2); cx.fill();
      cx.fillStyle = c.lane ? 'rgba(255,240,180,.9)' : 'rgba(255,60,60,.95)'; cx.beginPath(); cx.arc(c.lane ? xx - w / 2 : xx + w / 2, yy, 2 * L.k, 0, 7); cx.fill();
      cx.fillStyle = c.lane ? 'rgba(255,240,180,.12)' : 'rgba(255,60,60,.18)'; cx.beginPath(); cx.arc(c.lane ? xx - w / 2 : xx + w / 2, yy, 7 * L.k, 0, 7); cx.fill(); });
  }
  function wall(prog) {
    var L = R.L, g = cx.createLinearGradient(0, 0, 0, L.h);
    g.addColorStop(0, '#5a3427'); g.addColorStop(1, '#2c1912'); cx.fillStyle = g; cx.fillRect(0, 0, L.w, L.h);
    // brick pattern
    cx.fillStyle = 'rgba(0,0,0,.12)'; var bh = 14 * L.k, bw = 34 * L.k;
    for (var y = 0, r = 0; y < L.counterY; y += bh, r++) for (var x = (r % 2) * bw / 2 - bw; x < L.w; x += bw) { cx.fillRect(x, y, bw - 2, 1.5); cx.fillRect(x, y, 1.5, bh); }
    // window
    sky(prog);
    var fy0 = L.winTop, fy1 = L.winBot; cx.fillStyle = '#6b3f22'; cx.fillRect(0, fy1, L.w, 10 * L.k); cx.fillStyle = '#8a5530'; cx.fillRect(0, fy1, L.w, 3 * L.k);
    cx.fillStyle = '#4a2a17'; for (var m = 0; m <= 4; m++) { var mx = L.colL + L.colW * m / 4; cx.fillRect(mx - 4 * L.k, fy0, 8 * L.k, fy1 - fy0); }
    cx.fillRect(0, fy0 + (fy1 - fy0) * 0.38, L.w, 5 * L.k);
    // glass reflection
    cx.fillStyle = 'rgba(255,255,255,.06)'; cx.beginPath(); cx.moveTo(L.w * 0.1, fy0); cx.lineTo(L.w * 0.22, fy0); cx.lineTo(L.w * 0.08, fy1); cx.lineTo(L.w * -0.04, fy1); cx.fill();
    // neon sign
    var nx = L.colL + 16 * L.k, ny = fy0 + (fy1 - fy0) * 0.6, fl = Math.sin(T * 13) > 0.97 ? 0.5 : 1;
    cx.save(); cx.font = '900 ' + Math.round(17 * L.k) + 'px system-ui,sans-serif'; cx.textBaseline = 'middle'; cx.shadowColor = '#ff9a5a'; cx.shadowBlur = 16 * fl; cx.fillStyle = 'rgba(255,214,170,' + fl + ')'; cx.fillText('KOPI', nx, ny); cx.shadowColor = '#ff5aa0'; cx.fillStyle = 'rgba(255,190,220,' + fl + ')'; cx.fillText('SENJA', nx, ny + 19 * L.k); cx.restore();
    // pendant lamps
    for (var p = 0; p < 3; p++) {
      var lx = L.colL + L.colW * (0.2 + p * 0.3), ly = Math.max(26, fy0 + 18 * L.k) + Math.sin(T * 0.8 + p) * 2, sw = Math.sin(T * 0.8 + p) * 3;
      var lg = cx.createRadialGradient(lx, ly + 16 * L.k, 4, lx, ly + 16 * L.k, 120 * L.k); lg.addColorStop(0, 'rgba(255,200,120,.35)'); lg.addColorStop(1, 'rgba(255,200,120,0)'); cx.fillStyle = lg; cx.beginPath(); cx.arc(lx, ly + 16 * L.k, 120 * L.k, 0, 7); cx.fill();
      cx.strokeStyle = '#1b0f0a'; cx.lineWidth = 1.5; cx.beginPath(); cx.moveTo(lx, 0); cx.lineTo(lx + sw, ly); cx.stroke();
      cx.fillStyle = '#c8783a'; cx.beginPath(); cx.moveTo(lx + sw - 6 * L.k, ly); cx.lineTo(lx + sw + 6 * L.k, ly); cx.lineTo(lx + sw + 15 * L.k, ly + 14 * L.k); cx.lineTo(lx + sw - 15 * L.k, ly + 14 * L.k); cx.fill();
      cx.fillStyle = '#ffe7b0'; cx.beginPath(); cx.ellipse(lx + sw, ly + 15 * L.k, 9 * L.k, 3.5 * L.k, 0, 0, 7); cx.fill();
    }
    // plants on the sill
    plant(L.colL + L.colW - 26 * L.k, fy1 + 2);
  }
  function plant(x, y) {
    var k = R.L.k; cx.fillStyle = '#b5532f'; rr(x - 10 * k, y - 16 * k, 20 * k, 16 * k, 3 * k); cx.fill();
    cx.fillStyle = '#4c8a3c'; for (var i = 0; i < 5; i++) { var a = -Math.PI / 2 + (i - 2) * 0.45 + Math.sin(T * 1.3 + i) * 0.05; cx.beginPath(); cx.ellipse(x + Math.cos(a) * 12 * k, y - 16 * k + Math.sin(a) * 12 * k, 4 * k, 10 * k, a + Math.PI / 2, 0, 7); cx.fill(); }
  }
  // ---------- characters ----------
  function person(c, x, y, s, mood, bob, alpha, talk) {
    var k = R.L.k * s; cx.save(); cx.globalAlpha = alpha == null ? 1 : alpha; cx.translate(x, y + Math.sin(bob) * 2 * k);
    // shadow on wall
    cx.fillStyle = 'rgba(0,0,0,.18)'; cx.beginPath(); cx.ellipse(6 * k, 4 * k, 46 * k, 10 * k, 0, 0, 7); cx.fill();
    // torso
    cx.fillStyle = c.shirt; rr(-38 * k, -60 * k, 76 * k, 80 * k, 26 * k); cx.fill();
    cx.fillStyle = 'rgba(255,255,255,.12)'; rr(-30 * k, -54 * k, 22 * k, 50 * k, 11 * k); cx.fill();
    if (c.hat === 'helm') { cx.fillStyle = 'rgba(0,0,0,.25)'; cx.fillRect(-38 * k, -22 * k, 76 * k, 6 * k); }
    // neck + head
    cx.fillStyle = c.skin; cx.fillRect(-8 * k, -70 * k, 16 * k, 14 * k);
    if (c.hat === 'hijab') { cx.fillStyle = c.hijab; cx.beginPath(); cx.ellipse(0, -92 * k, 33 * k, 38 * k, 0, 0, 7); cx.fill(); cx.beginPath(); cx.moveTo(-34 * k, -86 * k); cx.lineTo(34 * k, -86 * k); cx.lineTo(28 * k, -54 * k); cx.lineTo(-28 * k, -54 * k); cx.fill(); }
    cx.fillStyle = c.skin; cx.beginPath(); cx.arc(0, -94 * k, 26 * k, 0, 7); cx.fill();
    if (c.hat !== 'hijab') { cx.fillStyle = c.hair; cx.beginPath(); cx.arc(0, -98 * k, 27 * k, Math.PI * 1.02, Math.PI * 1.98); cx.fill(); cx.fillRect(-27 * k, -100 * k, 7 * k, 12 * k); cx.fillRect(20 * k, -100 * k, 7 * k, 12 * k); }
    if (c.hat === 'peci') { cx.fillStyle = '#141414'; rr(-22 * k, -126 * k, 44 * k, 18 * k, 4 * k); cx.fill(); cx.fillStyle = 'rgba(255,255,255,.15)'; cx.fillRect(-20 * k, -124 * k, 40 * k, 2 * k); }
    if (c.hat === 'cap') { cx.fillStyle = '#c0392b'; cx.beginPath(); cx.arc(0, -104 * k, 26 * k, Math.PI, 0); cx.fill(); rr(-4 * k, -108 * k, 40 * k, 7 * k, 3 * k); cx.fill(); }
    if (c.hat === 'helm') { cx.fillStyle = '#2fae4f'; cx.beginPath(); cx.arc(0, -100 * k, 31 * k, Math.PI * 0.95, Math.PI * 2.05); cx.fill(); cx.fillStyle = '#e9f5ec'; cx.fillRect(-31 * k, -102 * k, 62 * k, 5 * k); cx.fillStyle = 'rgba(30,40,60,.35)'; rr(-24 * k, -112 * k, 48 * k, 8 * k, 4 * k); cx.fill(); }
    // face
    var blink = (Math.sin(T * 1.7 + x) > 0.985) ? 0.15 : 1;
    cx.fillStyle = '#20140e'; cx.beginPath(); cx.ellipse(-9 * k, -95 * k, 3 * k, 3.4 * k * blink, 0, 0, 7); cx.ellipse(9 * k, -95 * k, 3 * k, 3.4 * k * blink, 0, 0, 7); cx.fill();
    if (mood < -0.4) { cx.strokeStyle = '#20140e'; cx.lineWidth = 2.2 * k; cx.beginPath(); cx.moveTo(-14 * k, -104 * k); cx.lineTo(-5 * k, -101 * k); cx.moveTo(14 * k, -104 * k); cx.lineTo(5 * k, -101 * k); cx.stroke(); }
    cx.fillStyle = 'rgba(230,110,110,.35)'; cx.beginPath(); cx.arc(-15 * k, -86 * k, 4.5 * k, 0, 7); cx.arc(15 * k, -86 * k, 4.5 * k, 0, 7); cx.fill();
    cx.strokeStyle = '#5a2a1a'; cx.lineWidth = 2.4 * k; cx.lineCap = 'round'; cx.beginPath();
    if (talk) { cx.fillStyle = '#5a2a1a'; cx.ellipse(0, -82 * k, 5 * k, (2 + Math.abs(Math.sin(T * 14)) * 3) * k, 0, 0, 7); cx.fill(); }
    else if (mood > 0.3) cx.arc(0, -86 * k, 8 * k, 0.2, Math.PI - 0.2);
    else if (mood < -0.2) cx.arc(0, -76 * k, 7 * k, Math.PI + 0.35, -0.35);
    else { cx.moveTo(-6 * k, -82 * k); cx.lineTo(6 * k, -82 * k); }
    cx.stroke();
    if (mood < -0.5) { cx.fillStyle = '#7cc7ff'; cx.beginPath(); cx.moveTo(24 * k, -112 * k); cx.quadraticCurveTo(30 * k, -100 * k, 24 * k, -98 * k); cx.quadraticCurveTo(18 * k, -100 * k, 24 * k, -112 * k); cx.fill(); }
    cx.restore();
  }
  // ---------- counter + machine ----------
  function counter() {
    var L = R.L, k = L.k, y = L.counterY;
    // espresso machine (left)
    var mx = L.colL + Math.max(8, L.colW * 0.04), mw = (L.colW < 500 ? 78 : 96) * k, mh = (L.colW < 500 ? 72 : 84) * k;
    cx.fillStyle = '#9aa3ad'; rr(mx, y - mh, mw, mh, 10 * k); cx.fill();
    var mg = cx.createLinearGradient(mx, 0, mx + mw, 0); mg.addColorStop(0, 'rgba(255,255,255,.0)'); mg.addColorStop(0.3, 'rgba(255,255,255,.45)'); mg.addColorStop(0.5, 'rgba(255,255,255,.0)'); cx.fillStyle = mg; rr(mx, y - mh, mw, mh, 10 * k); cx.fill();
    cx.fillStyle = '#b8402e'; rr(mx + 6 * k, y - mh + 6 * k, mw - 12 * k, 18 * k, 5 * k); cx.fill(); cx.fillStyle = '#ffe1c4'; cx.font = '800 ' + Math.round(9 * k) + 'px system-ui'; cx.textAlign = 'center'; cx.fillText('ESPRESSO', mx + mw / 2, y - mh + 18 * k); cx.textAlign = 'left';
    cx.fillStyle = '#f4f4f4'; cx.beginPath(); cx.arc(mx + mw * 0.3, y - mh * 0.5, 9 * k, 0, 7); cx.fill(); cx.strokeStyle = '#c0392b'; cx.lineWidth = 1.5; cx.beginPath(); cx.moveTo(mx + mw * 0.3, y - mh * 0.5); cx.lineTo(mx + mw * 0.3 + Math.cos(-1 + Math.sin(T) * 0.3) * 7 * k, y - mh * 0.5 + Math.sin(-1 + Math.sin(T) * 0.3) * 7 * k); cx.stroke();
    cx.fillStyle = '#2a2a2a'; rr(mx + mw * 0.55, y - mh * 0.55, 30 * k, 8 * k, 3 * k); cx.fill(); cx.fillRect(mx + mw * 0.55 + 12 * k, y - mh * 0.48, 6 * k, 10 * k);
    if (R.steam > 0) { for (var s = 0; s < 3; s++) { var sy = (T * 40 + s * 12) % 36; cx.fillStyle = 'rgba(255,255,255,' + (0.35 * (1 - sy / 36) * Math.min(1, R.steam)).toFixed(2) + ')'; cx.beginPath(); cx.arc(mx + mw * 0.85 + Math.sin(T * 3 + s) * 4, y - mh - sy * k, (5 + sy * 0.2) * k, 0, 7); cx.fill(); } }
    // jars (right)
    var jx = L.colL + L.colW - Math.max(14, L.colW * 0.04) - 70 * k;
    [['#7a3f12', 'AREN'], ['#3b1d0e', 'BIJI'], ['#f4ead8', 'GULA']].forEach(function (j, i) {
      var x = jx + i * 24 * k, h = (40 + (i % 2) * 8) * k; cx.fillStyle = 'rgba(255,255,255,.25)'; rr(x, y - h, 20 * k, h, 5 * k); cx.fill(); cx.fillStyle = j[0]; rr(x + 2 * k, y - h * 0.7, 16 * k, h * 0.7 - 2 * k, 4 * k); cx.fill(); cx.fillStyle = '#8a5530'; rr(x - 1 * k, y - h - 5 * k, 22 * k, 6 * k, 2 * k); cx.fill();
    });
    // counter top + front
    var top = cx.createLinearGradient(0, y, 0, y + 16 * k); top.addColorStop(0, '#c98a52'); top.addColorStop(1, '#8e5530'); cx.fillStyle = top; cx.fillRect(0, y, L.w, 16 * k);
    cx.fillStyle = 'rgba(255,230,190,.35)'; cx.fillRect(0, y, L.w, 2);
    var fr = cx.createLinearGradient(0, y + 16 * k, 0, L.h); fr.addColorStop(0, '#6e3d22'); fr.addColorStop(1, '#3b2014'); cx.fillStyle = fr; cx.fillRect(0, y + 16 * k, L.w, L.h - y);
    cx.fillStyle = 'rgba(0,0,0,.18)'; for (var px = 0; px < L.w; px += 46 * k) cx.fillRect(px, y + 16 * k, 2, L.h);
    cx.fillStyle = 'rgba(0,0,0,.35)'; cx.fillRect(0, y + 16 * k, L.w, 5 * k);
  }
  // ---------- cups ----------
  function glassCup(x, y, s, C, fill) {
    var k = R.L.k * s, w = 58 * k, h = 96 * k, bx = x - w / 2, by = y - h;
    cx.fillStyle = 'rgba(0,0,0,.25)'; cx.beginPath(); cx.ellipse(x, y + 2, w * 0.62, 6 * k, 0, 0, 7); cx.fill();
    cx.save(); cx.beginPath(); cx.moveTo(bx, by); cx.lineTo(bx + w, by); cx.lineTo(bx + w * 0.9, y); cx.lineTo(bx + w * 0.1, y); cx.closePath(); cx.clip();
    cx.fillStyle = 'rgba(220,240,255,.14)'; cx.fillRect(bx, by, w, h);
    var layers = (C && C.added) || [], n = layers.length, total = C ? C.d.steps.length : 1, lvl = 0, iceOn = false;
    for (var i = 0; i < n; i++) {
      var ing = layers[i], frac = (i === n - 1 ? fill : 1), lh = (h * 0.86 / total) * frac, col = colorOf(ing);
      if (ing === 'es') { iceOn = true; lh *= 0.35; }
      var ly = y - lvl - lh; cx.fillStyle = col; cx.fillRect(bx, ly, w, lh + 1);
      if (ing === 'shot' && i > 0) { var gg = cx.createLinearGradient(0, ly, 0, ly + lh * 2.2); gg.addColorStop(0, 'rgba(59,29,14,1)'); gg.addColorStop(1, 'rgba(120,70,40,0)'); cx.fillStyle = gg; cx.fillRect(bx, ly, w, lh * 2.2); }
      lvl += lh;
    }
    if (iceOn) { for (var c = 0; c < 5; c++) { var ix = bx + 8 * k + (c % 3) * 16 * k + Math.sin(T * 1.5 + c) * 1.5, iy = y - lvl + 4 * k + Math.floor(c / 3) * 16 * k; cx.fillStyle = 'rgba(235,250,255,.55)'; cx.save(); cx.translate(ix + 7 * k, iy + 7 * k); cx.rotate(c * 0.5); rr(-7 * k, -7 * k, 14 * k, 14 * k, 3 * k); cx.fill(); cx.strokeStyle = 'rgba(255,255,255,.8)'; cx.lineWidth = 1; cx.stroke(); cx.restore(); } }
    cx.restore();
    cx.strokeStyle = 'rgba(255,255,255,.7)'; cx.lineWidth = 2; cx.beginPath(); cx.moveTo(bx, by); cx.lineTo(bx + w * 0.1, y); cx.lineTo(bx + w * 0.9, y); cx.lineTo(bx + w, by); cx.stroke();
    cx.fillStyle = 'rgba(255,255,255,.28)'; cx.fillRect(bx + 6 * k, by + 8 * k, 4 * k, h * 0.7);
    cx.strokeStyle = 'rgba(255,255,255,.55)'; cx.beginPath(); cx.ellipse(x, by, w / 2, 4 * k, 0, 0, 7); cx.stroke();
    // straw when complete
    if (C && C.phase !== 'mix') { cx.strokeStyle = '#2d8a5c'; cx.lineWidth = 5 * k; cx.beginPath(); cx.moveTo(x + 8 * k, y - 20 * k); cx.lineTo(x + 18 * k, by - 22 * k); cx.stroke(); }
    // brand sticker
    cx.fillStyle = '#f2a65a'; cx.beginPath(); cx.arc(x, y - h * 0.45, 9 * k, 0, 7); cx.fill(); cx.fillStyle = '#4a2214'; cx.font = '900 ' + Math.round(9 * k) + 'px system-ui'; cx.textAlign = 'center'; cx.textBaseline = 'middle'; cx.fillText('KS', x, y - h * 0.45 + 0.5); cx.textAlign = 'left'; cx.textBaseline = 'alphabetic';
  }
  function hotCup(x, y, s, C, fill) {
    var k = R.L.k * s, w = 70 * k, h = 54 * k, top = y - h - 6 * k;
    cx.fillStyle = 'rgba(0,0,0,.25)'; cx.beginPath(); cx.ellipse(x, y + 3, w * 0.8, 7 * k, 0, 0, 7); cx.fill();
    cx.fillStyle = '#f3ece2'; cx.beginPath(); cx.ellipse(x, y, w * 0.75, 8 * k, 0, 0, 7); cx.fill(); cx.fillStyle = '#d9cfc2'; cx.beginPath(); cx.ellipse(x, y - 1, w * 0.5, 4 * k, 0, 0, 7); cx.fill();
    cx.strokeStyle = '#f3ece2'; cx.lineWidth = 7 * k; cx.beginPath(); cx.arc(x + w / 2 + 2 * k, top + h * 0.45, 13 * k, -1.2, 1.2); cx.stroke();
    var g = cx.createLinearGradient(x - w / 2, 0, x + w / 2, 0); g.addColorStop(0, '#e9e0d3'); g.addColorStop(0.35, '#ffffff'); g.addColorStop(1, '#d6cab9');
    cx.fillStyle = g; cx.beginPath(); cx.moveTo(x - w / 2, top); cx.lineTo(x + w / 2, top); cx.quadraticCurveTo(x + w / 2, y - 4 * k, x, y - 4 * k); cx.quadraticCurveTo(x - w / 2, y - 4 * k, x - w / 2, top); cx.fill();
    cx.fillStyle = '#c75f3a'; cx.fillRect(x - w / 2 + 3 * k, top + h * 0.35, w - 6 * k, 5 * k);
    // liquid surface seen from above
    var n = C ? C.added.length : 0, tot = C ? C.d.steps.length : 1, lv = n ? Math.min(1, (n - 1 + fill) / tot) : 0, last = n ? C.added[n - 1] : null;
    cx.fillStyle = '#efe6d8'; cx.beginPath(); cx.ellipse(x, top, w / 2, 9 * k, 0, 0, 7); cx.fill();
    if (n) { var col = last === 'foam' ? '#f6e9d4' : last === 'air' && C.d.id === 'matcha' ? '#8bbf4a' : last === 'air' && C.d.id === 'tubruk' ? '#2a160b' : colorOf(last); if (C.d.id === 'matcha' && last !== 'foam') col = '#86b748'; cx.fillStyle = col; cx.beginPath(); cx.ellipse(x, top + (1 - lv) * 3 * k, w / 2 - 4 * k * (1 - lv * 0.6), 7 * k * (0.4 + lv * 0.6), 0, 0, 7); cx.fill(); if (last === 'foam') { cx.fillStyle = C.d.id === 'matcha' ? 'rgba(134,183,72,.6)' : 'rgba(150,90,50,.55)'; cx.beginPath(); cx.ellipse(x, top + 1, w / 2 - 6 * k, 5 * k, 0, 0, 7); cx.lineWidth = 3 * k; cx.strokeStyle = cx.fillStyle; cx.stroke(); } }
    if (C && C.artDone && C.art && C.art.length) miniArt(x, top, w / 2 - 8 * k, 6 * k, C.art);
    cx.strokeStyle = 'rgba(255,255,255,.9)'; cx.lineWidth = 2; cx.beginPath(); cx.ellipse(x, top, w / 2, 9 * k, 0, 0, 7); cx.stroke();
    if (n) steam(x, top - 4 * k, k);
  }
  function miniArt(x, y, rx, ry, art) { cx.save(); cx.strokeStyle = 'rgba(255,255,255,.95)'; cx.lineWidth = 1.6; cx.lineCap = 'round'; art.forEach(function (p) { cx.beginPath(); p.forEach(function (q, i) { var px = x + q[0] * rx, py = y + q[1] * ry; if (i) cx.lineTo(px, py); else cx.moveTo(px, py); }); cx.stroke(); }); cx.restore(); }
  function steam(x, y, k) { cx.save(); cx.strokeStyle = 'rgba(255,255,255,.35)'; cx.lineWidth = 3 * k; cx.lineCap = 'round'; for (var i = -1; i <= 1; i++) { cx.beginPath(); for (var j = 0; j < 10; j++) { var py = y - j * 4 * k, px = x + i * 14 * k + Math.sin(T * 3 + j * 0.6 + i) * 4 * k; if (j) cx.lineTo(px, py); else cx.moveTo(px, py); } cx.globalAlpha = 0.5 + 0.3 * Math.sin(T * 2 + i); cx.stroke(); } cx.restore(); }
  function colorOf(id) { for (var i = 0; i < CFG.ingredients.length; i++) if (CFG.ingredients[i].id === id) return CFG.ingredients[i].color; return '#888'; }
  R.drawCup = function (x, y, s, C, fill) { if (C && C.d.iced) glassCup(x, y, s, C, fill); else hotCup(x, y, s, C, fill); };
  // ---------- latte art top view ----------
  function artView(st) {
    var L = R.L, A = L.art, a = st.art;
    cx.fillStyle = 'rgba(20,10,8,.62)'; cx.fillRect(0, 0, L.w, L.h);
    var x = A.x, y = A.y, r = A.r;
    cx.fillStyle = 'rgba(0,0,0,.35)'; cx.beginPath(); cx.arc(x + 6, y + 10, r * 1.38, 0, 7); cx.fill();
    cx.fillStyle = '#f3ece2'; cx.beginPath(); cx.arc(x, y, r * 1.38, 0, 7); cx.fill(); cx.fillStyle = '#e4d9ca'; cx.beginPath(); cx.arc(x, y, r * 1.24, 0, 7); cx.fill();
    cx.fillStyle = '#fbf7f1'; cx.beginPath(); cx.arc(x, y, r * 1.12, 0, 7); cx.fill();
    var cg = cx.createRadialGradient(x, y, r * 0.2, x, y, r); var matcha = a.drink === 'matcha';
    cg.addColorStop(0, matcha ? '#a8cf6a' : '#b77a45'); cg.addColorStop(0.75, matcha ? '#7fae3e' : '#8a4b23'); cg.addColorStop(1, matcha ? '#5d8a2a' : '#5a2d17');
    cx.fillStyle = cg; cx.beginPath(); cx.arc(x, y, r, 0, 7); cx.fill();
    // crema speckles
    cx.fillStyle = 'rgba(255,230,190,.12)'; for (var i = 0; i < 40; i++) { var ang = i * 2.4, d = (i * 37 % 100) / 100 * r * 0.95; cx.beginPath(); cx.arc(x + Math.cos(ang) * d, y + Math.sin(ang) * d, 2, 0, 7); cx.fill(); }
    // ghost target
    cx.save(); cx.setLineDash([r * 0.06, r * 0.05]); cx.lineDashOffset = -T * 20; cx.strokeStyle = 'rgba(255,248,235,.55)'; cx.lineWidth = r * 0.08; cx.lineCap = 'round'; cx.lineJoin = 'round';
    KS.artPaths(a.kind).forEach(function (p) { cx.beginPath(); p.forEach(function (q, i) { if (i) cx.lineTo(x + q[0] * r, y + q[1] * r); else cx.moveTo(x + q[0] * r, y + q[1] * r); }); cx.stroke(); }); cx.restore();
    // milk strokes
    cx.save(); cx.lineCap = 'round'; cx.lineJoin = 'round'; cx.shadowColor = 'rgba(80,40,20,.45)'; cx.shadowBlur = r * 0.05;
    cx.strokeStyle = '#fffaf2'; cx.lineWidth = r * 0.11;
    a.strokes.forEach(function (p) { if (!p.length) return; cx.beginPath(); p.forEach(function (q, i) { if (i) cx.lineTo(x + q[0] * r, y + q[1] * r); else cx.moveTo(x + q[0] * r, y + q[1] * r); }); if (p.length === 1) cx.lineTo(x + p[0][0] * r + 0.1, y + p[0][1] * r); cx.stroke(); });
    cx.restore();
    // pitcher following the finger
    if (a.pen) { var px = x + a.pen[0] * r, py = y + a.pen[1] * r; cx.save(); cx.translate(px + r * 0.12, py - r * 0.22); cx.rotate(-0.5); cx.fillStyle = '#d8dde3'; rr(-r * 0.09, -r * 0.2, r * 0.18, r * 0.26, r * 0.04); cx.fill(); cx.fillStyle = 'rgba(255,255,255,.6)'; cx.fillRect(-r * 0.06, -r * 0.18, r * 0.03, r * 0.2); cx.restore(); }
    cx.strokeStyle = 'rgba(255,255,255,.85)'; cx.lineWidth = 3; cx.beginPath(); cx.arc(x, y, r * 1.12, 0, 7); cx.stroke();
  }
  // ---------- particles ----------
  R.burst = function (x, y, kind, n) {
    n = n || 12; for (var i = 0; i < n; i++) { var a = Math.random() * Math.PI * 2, s = 80 + Math.random() * 180;
      parts.push({ x: x, y: y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 120, t: 0, life: 0.8 + Math.random() * 0.5, kind: kind, r: 3 + Math.random() * 4, rot: Math.random() * 6 }); }
  };
  R.confetti = function () { var L = R.L, cols = ['#f2a65a', '#ff6b8b', '#ffd23f', '#7fd18b', '#7cc7ff', '#fff']; for (var i = 0; i < 120; i++) conf.push({ x: Math.random() * L.w, y: -20 - Math.random() * L.h * 0.5, vy: 120 + Math.random() * 160, vx: (Math.random() - 0.5) * 60, r: Math.random() * 6, c: cols[i % cols.length], s: 4 + Math.random() * 5 }); };
  R.shake = function (s) { shakeT = s || 0.3; };
  function drawParts(dt) {
    parts = parts.filter(function (p) { p.t += dt; return p.t < p.life; });
    parts.forEach(function (p) { p.vy += 420 * dt; p.x += p.vx * dt; p.y += p.vy * dt; var a = 1 - p.t / p.life; cx.globalAlpha = a;
      if (p.kind === 'coin') { cx.fillStyle = '#ffd23f'; cx.beginPath(); cx.ellipse(p.x, p.y, p.r + 2, (p.r + 2) * Math.abs(Math.cos(p.t * 10 + p.rot)), 0, 0, 7); cx.fill(); cx.strokeStyle = '#c98a1a'; cx.lineWidth = 1; cx.stroke(); }
      else if (p.kind === 'star') { cx.fillStyle = '#ffe066'; star(p.x, p.y, p.r + 3, p.t * 5); }
      else if (p.kind === 'drop') { cx.fillStyle = p.c || '#9fd3ff'; cx.beginPath(); cx.arc(p.x, p.y, p.r * 0.7, 0, 7); cx.fill(); }
      else { cx.fillStyle = 'rgba(255,255,255,.8)'; cx.beginPath(); cx.arc(p.x, p.y, p.r, 0, 7); cx.fill(); } });
    cx.globalAlpha = 1;
    conf = conf.filter(function (c) { return c.y < R.L.h + 20; }); conf.forEach(function (c) { c.y += c.vy * dt; c.x += c.vx * dt + Math.sin(T * 3 + c.r) * 0.6; c.r += dt * 4; cx.save(); cx.translate(c.x, c.y); cx.rotate(c.r); cx.fillStyle = c.c; cx.fillRect(-c.s / 2, -c.s / 4, c.s, c.s / 2); cx.restore(); });
  }
  function star(x, y, r, rot) { cx.beginPath(); for (var i = 0; i < 10; i++) { var a = rot + i * Math.PI / 5, rr2 = i % 2 ? r * 0.45 : r; cx.lineTo(x + Math.cos(a) * rr2, y + Math.sin(a) * rr2); } cx.closePath(); cx.fill(); }
  R.dropColor = colorOf;
  // ---------- frame ----------
  R.frame = function (st, dt) {
    T += dt; var L = R.L; cx.setTransform(L.dpr, 0, 0, L.dpr, 0, 0);
    var sx = 0, sy = 0; if (shakeT > 0) { shakeT -= dt; sx = (Math.random() - 0.5) * 10 * shakeT * 3; sy = (Math.random() - 0.5) * 6 * shakeT * 3; }
    cx.save(); cx.translate(sx, sy);
    wall(st.prog || 0);
    // queue (behind), then active customer
    var q = st.queue || [];
    for (var i = q.length - 1; i >= 0; i--) { var qx = L.custX + (118 + i * 66) * L.k * (L.colW < 500 ? 0.95 : 1.2); if (qx > L.colL + L.colW + 30) continue; person(CFG.customers[q[i]], qx, L.counterY - 8 * L.k, 0.85, st.queueMood || 0, T * 2 + i, 0.92); }
    if (st.cust) person(CFG.customers[st.cust.c], L.custX + st.cust.dx * L.w, L.counterY + 6 * L.k, 1.22, st.cust.mood, T * 2.2, 1, st.cust.talk > 0);
    counter();
    if (st.C && st.showCup) R.drawCup(L.cupX + (st.cupDx || 0) * L.w, L.cupY, 1.2, st.C, st.fill == null ? 1 : st.fill);
    if (st.pour) { var px = L.cupX, top = L.cupY - (st.C && st.C.d.iced ? 125 : 80) * L.k; cx.strokeStyle = st.pour; cx.lineWidth = 5 * L.k; cx.globalAlpha = 0.9; cx.beginPath(); cx.moveTo(px - 4 * L.k, top - 70 * L.k); cx.quadraticCurveTo(px - 2 * L.k, top - 30 * L.k, px, top + 8 * L.k); cx.stroke(); cx.globalAlpha = 1; }
    drawParts(dt);
    cx.restore();
    if (st.art) artView(st);
  };
  G.KSR = R;
})(window);

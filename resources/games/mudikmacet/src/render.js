// Mudik Macet - canvas drawing: sunset kampung scenery, asphalt toll plaza board, top-down vehicles, particles.
(function (G) {
  'use strict';
  var cv, cx, W = 0, H = 0, DPR = 1, scene = null, L = { bx: 0, by: 0, cs: 60 }, parts = [], conf = [], CFG = null, reduce = false;
  var TAU = Math.PI * 2, TXF = { flip: false, vert: false };
  function rr(c, x, y, w, h, r) { r = Math.min(r, w / 2, h / 2); c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
  function shade(hex, f) { // f -1..1 darken/lighten
    var n = parseInt(hex.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255, t = f < 0 ? 0 : 255, p = Math.abs(f);
    r = Math.round((t - r) * p + r); g = Math.round((t - g) * p + g); b = Math.round((t - b) * p + b);
    return 'rgb(' + r + ',' + g + ',' + b + ')';
  }
  function hsh(s) { var h = 7; for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h; }
  function init(canvas, cfg) { cv = canvas; cx = cv.getContext('2d'); CFG = cfg; try { reduce = matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {} }
  function resize(mode, extraTop) {
    DPR = Math.min(2, G.devicePixelRatio || 1); W = G.innerWidth; H = G.innerHeight;
    cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
    layout(mode, extraTop); buildScene();
  }
  function layout(mode, extraTop) {
    var cs, bx, by;
    if (mode === 'home' && W >= 960) {
      cs = Math.min((W - 520) / 7.4, (H - 140) / 7.2, 90); bx = 500 + (W - 500 - 6 * cs) / 2 - cs * 0.35; by = (H - 6 * cs) / 2 + cs * 0.35;
    } else {
      var top = 78 + (extraTop || 0), bot = 92, avail = H - top - bot;
      cs = Math.floor(Math.min((W - 20) / 6.85, (avail - 10) / 6.9, 96)); bx = Math.round((W - 6 * cs) / 2 - cs * 0.22); by = Math.round(top + (avail - 6 * cs) / 2 + cs * 0.28);
    }
    L = { bx: bx, by: by, cs: cs, mode: mode };
  }
  // ---------- static scenery ----------
  function buildScene() {
    scene = document.createElement('canvas'); scene.width = cv.width; scene.height = cv.height;
    var c = scene.getContext('2d'); c.setTransform(DPR, 0, 0, DPR, 0, 0);
    var cs = L.cs, bx = L.bx, by = L.by, bw = 6 * cs, hor = Math.max(60, H * 0.2, by - cs * 1.25);
    // sky
    var g = c.createLinearGradient(0, 0, 0, hor + 10); g.addColorStop(0, '#6fb7e8'); g.addColorStop(0.45, '#ffc48a'); g.addColorStop(1, '#ff8f62');
    c.fillStyle = g; c.fillRect(0, 0, W, hor + 10);
    // sun
    var sx = W * 0.22, sy = hor - 8, sg = c.createRadialGradient(sx, sy, 4, sx, sy, 120); sg.addColorStop(0, 'rgba(255,245,200,1)'); sg.addColorStop(0.25, 'rgba(255,220,140,.9)'); sg.addColorStop(1, 'rgba(255,170,100,0)');
    c.fillStyle = sg; c.fillRect(sx - 130, sy - 130, 260, 260); c.fillStyle = '#fff1c4'; c.beginPath(); c.arc(sx, sy, 26, 0, TAU); c.fill();
    // clouds
    c.fillStyle = 'rgba(255,240,225,.8)'; [[0.12, 0.25, 1], [0.6, 0.15, 1.3], [0.85, 0.35, 0.9]].forEach(function (k) { var x = W * k[0], y = hor * k[1], s = 18 * k[2]; c.beginPath(); c.arc(x, y, s, 0, TAU); c.arc(x + s, y - s * 0.4, s * 1.2, 0, TAU); c.arc(x + s * 2.2, y, s * 0.9, 0, TAU); c.rect(x, y - 2, s * 2.2, s * 0.9); c.fill(); });
    // hills
    function hill(col, base, amp, f, ph) { c.fillStyle = col; c.beginPath(); c.moveTo(0, hor + 12); for (var x = 0; x <= W + 10; x += 10) c.lineTo(x, base - amp * (0.6 + 0.4 * Math.sin(x * f + ph)) * (0.7 + 0.3 * Math.sin(x * f * 2.7 + ph * 2))); c.lineTo(W, hor + 12); c.closePath(); c.fill(); }
    hill('#c9837a', hor - 18, 46, 0.006, 1); hill('#a8696a', hor - 6, 30, 0.011, 4);
    // kampung silhouette: houses, mosque, palms
    c.fillStyle = '#6f3f4a';
    for (var x = -20; x < W + 40; x += 46) { var hh = 14 + (hsh('h' + x) % 10); c.fillRect(x, hor - hh, 30, hh + 4); c.beginPath(); c.moveTo(x - 4, hor - hh); c.lineTo(x + 15, hor - hh - 12); c.lineTo(x + 34, hor - hh); c.fill(); }
    var mx = W * 0.72; c.beginPath(); c.arc(mx, hor - 30, 20, Math.PI, 0); c.fill(); c.fillRect(mx - 22, hor - 31, 44, 32); c.fillRect(mx + 30, hor - 70, 7, 72); c.beginPath(); c.moveTo(mx + 28, hor - 70); c.lineTo(mx + 33.5, hor - 84); c.lineTo(mx + 39, hor - 70); c.fill();
    c.beginPath(); c.moveTo(mx, hor - 58); c.lineTo(mx, hor - 50); c.lineWidth = 2; c.strokeStyle = '#6f3f4a'; c.stroke(); c.beginPath(); c.arc(mx + 2, hor - 60, 4, 0.6, 5.6); c.stroke();
    [W * 0.08, W * 0.44, W * 0.93].forEach(function (px, i) { var ph = 34 + i * 6; c.strokeStyle = '#5b3140'; c.lineWidth = 4; c.beginPath(); c.moveTo(px, hor + 2); c.quadraticCurveTo(px + 6, hor - ph / 2, px + 2, hor - ph); c.stroke(); c.fillStyle = '#5b3140'; for (var a = 0; a < 6; a++) { var an = -Math.PI / 2 + (a - 2.5) * 0.55; c.beginPath(); c.ellipse(px + 2 + Math.cos(an) * 12, hor - ph + Math.sin(an) * 7 + 4, 14, 4, an, 0, TAU); c.fill(); } });
    // ground: sawah
    var gg = c.createLinearGradient(0, hor, 0, H); gg.addColorStop(0, '#9ccf4f'); gg.addColorStop(1, '#4f9a3a'); c.fillStyle = gg; c.fillRect(0, hor, W, H - hor);
    c.strokeStyle = 'rgba(40,90,20,.25)'; c.lineWidth = 1.5; for (var yy = hor + 8, k2 = 1; yy < H; yy += 6 + k2 * 2.2, k2++) { c.beginPath(); c.moveTo(0, yy); c.lineTo(W, yy); c.stroke(); }
    // plaza apron (wider asphalt under board) + exit road to the right edge
    var ap = cs * 0.55, ey = by + 2 * cs;
    c.fillStyle = '#d8c7a6'; rr(c, bx - ap - 6, by - ap - 6, bw + 2 * ap + 12, bw + 2 * ap + 12, cs * 0.5); c.fill(); // concrete shoulder
    asphalt(c, bx - ap, by - ap, bw + 2 * ap, bw + 2 * ap, cs * 0.42);
    asphalt(c, bx + bw, ey - cs * 0.08, W - bx - bw + 4, cs * 1.16, 0);
    c.fillStyle = 'rgba(255,255,255,.85)'; for (var ex = bx + bw + cs * 0.7; ex < W; ex += cs * 0.9) { c.fillRect(ex, ey - cs * 0.06, cs * 0.45, cs * 0.05); c.fillRect(ex, ey + cs * 1.01, cs * 0.45, cs * 0.05); }
    // chevrons on the exit lane
    c.fillStyle = '#ffd23f'; for (var cxp = bx + bw + cs * 0.45; cxp < Math.min(W - 10, bx + bw + cs * 2.6); cxp += cs * 0.62) { c.beginPath(); c.moveTo(cxp, ey + cs * 0.3); c.lineTo(cxp + cs * 0.22, ey + cs * 0.5); c.lineTo(cxp, ey + cs * 0.7); c.lineTo(cxp + cs * 0.1, ey + cs * 0.5); c.closePath(); c.fill(); }
    // board surface: tiles + lane paint
    asphalt(c, bx, by, bw, bw, cs * 0.12, true);
    c.strokeStyle = 'rgba(255,255,255,.09)'; c.lineWidth = 1; for (var i = 1; i < 6; i++) { c.beginPath(); c.moveTo(bx + i * cs, by + 4); c.lineTo(bx + i * cs, by + bw - 4); c.moveTo(bx + 4, by + i * cs); c.lineTo(bx + bw - 4, by + i * cs); c.stroke(); }
    c.setLineDash([cs * 0.28, cs * 0.24]); c.strokeStyle = 'rgba(255,255,255,.32)'; c.lineWidth = Math.max(2, cs * 0.04);
    [1, 3, 4].forEach(function (r) { c.beginPath(); c.moveTo(bx + cs * 0.2, by + r * cs); c.lineTo(bx + bw - cs * 0.2, by + r * cs); c.stroke(); });
    c.setLineDash([]); c.strokeStyle = 'rgba(255,210,63,.75)'; c.lineWidth = Math.max(2, cs * 0.05);
    c.beginPath(); c.moveTo(bx + cs * 0.08, ey + cs * 0.06); c.lineTo(bx + bw, ey + cs * 0.06); c.moveTo(bx + cs * 0.08, ey + cs * 0.94); c.lineTo(bx + bw, ey + cs * 0.94); c.stroke();
    // kerbs (red / white) around the board, gap on the exit row
    kerb(c, bx - cs * 0.2, by - cs * 0.2, bw + cs * 0.4, cs * 0.2, true); kerb(c, bx - cs * 0.2, by + bw, bw + cs * 0.4, cs * 0.2, true);
    kerb(c, bx - cs * 0.2, by, cs * 0.2, bw, false);
    kerb(c, bx + bw, by, cs * 0.2, 2 * cs, false); kerb(c, bx + bw, ey + cs, cs * 0.2, 3 * cs, false);
    // traffic cones at corners
    [[bx - cs * 0.45, by + bw + cs * 0.3], [bx - cs * 0.45, by - cs * 0.42], [bx + bw + cs * 0.42, by + bw + cs * 0.3]].forEach(function (p) { cone(c, p[0], p[1], cs * 0.26); });
    // exit gantry sign
    var sgx = bx + bw + cs * 0.12, sgy = ey - cs * 1.05, sw = Math.min(cs * 1.9, W - sgx - 6); if (sw > cs * 0.9) {
      c.fillStyle = '#7d8790'; c.fillRect(sgx + sw * 0.15, sgy + cs * 0.5, 4, cs * 0.5); c.fillRect(sgx + sw * 0.8, sgy + cs * 0.5, 4, cs * 0.5);
      c.fillStyle = '#0c7a43'; rr(c, sgx, sgy, sw, cs * 0.62, 6); c.fill(); c.strokeStyle = '#fff'; c.lineWidth = 2; rr(c, sgx + 3, sgy + 3, sw - 6, cs * 0.62 - 6, 4); c.stroke();
      c.fillStyle = '#fff'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = '900 ' + Math.round(cs * 0.22) + 'px system-ui,sans-serif'; c.fillText(T('exit') + ' →', sgx + sw / 2, sgy + cs * 0.22);
      c.font = '700 ' + Math.round(cs * 0.16) + 'px system-ui,sans-serif'; c.fillText(T('exitSub'), sgx + sw / 2, sgy + cs * 0.45);
    }
    // toll banner over the top kerb
    var tw = Math.min(bw * 0.7, cs * 3.6), tx = bx + (bw - tw) / 2, ty = by - cs * 0.62;
    c.fillStyle = '#1d5c3a'; rr(c, tx, ty, tw, cs * 0.36, 8); c.fill(); c.fillStyle = '#ffd23f'; c.fillRect(tx + 6, ty + cs * 0.3, tw - 12, 3);
    c.fillStyle = '#fff'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = '900 ' + Math.round(cs * 0.19) + 'px system-ui,sans-serif'; c.fillText(T('gate'), tx + tw / 2, ty + cs * 0.17);
  }
  function T(k) { return (CFG && CFG.text[k]) || k; }
  function asphalt(c, x, y, w, h, r, fine) {
    c.save(); rr(c, x, y, w, h, r); c.clip();
    var g = c.createLinearGradient(x, y, x + w * 0.3, y + h); g.addColorStop(0, fine ? '#55504c' : '#4a4643'); g.addColorStop(1, fine ? '#3e3a37' : '#36322f'); c.fillStyle = g; c.fillRect(x, y, w, h);
    var n = Math.min(2600, (w * h) / 60), s = hsh('a' + Math.round(x) + Math.round(y));
    for (var i = 0; i < n; i++) { s = (s * 1103515245 + 12345) >>> 0; var px = x + (s % 10000) / 10000 * w; s = (s * 1103515245 + 12345) >>> 0; var py = y + (s % 10000) / 10000 * h; c.fillStyle = (s & 1) ? 'rgba(255,240,220,.07)' : 'rgba(0,0,0,.12)'; c.fillRect(px, py, 1.6, 1.6); }
    if (fine) { c.strokeStyle = 'rgba(0,0,0,.18)'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(x + w * 0.7, y + h * 0.1); c.lineTo(x + w * 0.74, y + h * 0.22); c.lineTo(x + w * 0.71, y + h * 0.3); c.moveTo(x + w * 0.15, y + h * 0.8); c.lineTo(x + w * 0.22, y + h * 0.86); c.stroke(); }
    var v = c.createRadialGradient(x + w / 2, y + h / 2, w * 0.3, x + w / 2, y + h / 2, w * 0.75); v.addColorStop(0, 'rgba(255,190,120,.06)'); v.addColorStop(1, 'rgba(0,0,0,.22)'); c.fillStyle = v; c.fillRect(x, y, w, h);
    c.restore();
  }
  function kerb(c, x, y, w, h, horiz) {
    var seg = Math.max(10, L.cs * 0.36), len = horiz ? w : h; c.fillStyle = '#f4efe6'; c.fillRect(x, y, w, h);
    c.fillStyle = '#e8433f'; for (var i = 0; i < len; i += seg * 2) { if (horiz) c.fillRect(x + i, y, Math.min(seg, len - i), h); else c.fillRect(x, y + i, w, Math.min(seg, len - i)); }
    c.fillStyle = 'rgba(0,0,0,.18)'; if (horiz) c.fillRect(x, y + h - 2, w, 2); else c.fillRect(x + w - 2, y, 2, h);
  }
  function cone(c, x, y, s) {
    c.fillStyle = 'rgba(0,0,0,.25)'; c.beginPath(); c.ellipse(x + 2, y + s * 0.95, s * 0.6, s * 0.2, 0, 0, TAU); c.fill();
    c.fillStyle = '#ff7a1a'; c.beginPath(); c.moveTo(x - s * 0.45, y + s * 0.9); c.lineTo(x, y - s * 0.8); c.lineTo(x + s * 0.45, y + s * 0.9); c.closePath(); c.fill();
    c.fillStyle = '#fff'; c.beginPath(); c.moveTo(x - s * 0.27, y + s * 0.25); c.lineTo(x + s * 0.27, y + s * 0.25); c.lineTo(x + s * 0.18, y); c.lineTo(x - s * 0.18, y); c.closePath(); c.fill();
    c.fillStyle = '#c4520a'; c.fillRect(x - s * 0.55, y + s * 0.85, s * 1.1, s * 0.14);
  }
  // ---------- vehicles (local frame: length along +x, width 1 cell, front at +x) ----------
  function glass(c, x, y, w, h, r) { var g = c.createLinearGradient(x, y, x + w, y + h); g.addColorStop(0, '#2b4a6b'); g.addColorStop(0.5, '#4f7fa8'); g.addColorStop(1, '#203a55'); c.fillStyle = g; rr(c, x, y, w, h, r); c.fill(); c.fillStyle = 'rgba(255,255,255,.35)'; c.fillRect(x + w * 0.2, y + h * 0.15, w * 0.12, h * 0.7); }
  function body(c, x, y, w, h, r, col) {
    var g = c.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, shade(col, 0.35)); g.addColorStop(0.45, col); g.addColorStop(1, shade(col, -0.3));
    c.fillStyle = g; rr(c, x, y, w, h, r); c.fill(); c.strokeStyle = shade(col, -0.5); c.lineWidth = 1.5 / 60 * L.cs / L.cs; c.lineWidth = 0.02; c.stroke();
  }
  function wheels(c, xs, y0, y1) { c.fillStyle = '#1c1a19'; xs.forEach(function (x) { rr(c, x, y0 - 0.04, 0.24, 0.1, 0.03); c.fill(); rr(c, x, y1 - 0.06, 0.24, 0.1, 0.03); c.fill(); }); }
  function lights(c, Lx, y0, y1, on) { c.fillStyle = on ? '#fff6b0' : '#ffe9a0'; c.beginPath(); c.ellipse(Lx - 0.05, y0 + 0.1, 0.035, 0.07, 0, 0, TAU); c.ellipse(Lx - 0.05, y1 - 0.1, 0.035, 0.07, 0, 0, TAU); c.fill(); }
  function tails(c, x0, y0, y1) { c.fillStyle = '#e02a2a'; c.fillRect(x0 + 0.01, y0 + 0.06, 0.04, 0.1); c.fillRect(x0 + 0.01, y1 - 0.16, 0.04, 0.1); }
  function drawMudik(c, len, t) {
    var x0 = 0.08, x1 = len - 0.08, y0 = 0.14, y1 = 0.86;
    wheels(c, [0.3, len - 0.55], y0, y1);
    body(c, x0, y0, x1 - x0, y1 - y0, 0.2, '#ffad1f');
    c.fillStyle = 'rgba(255,255,255,.25)'; rr(c, x0 + 0.1, y0 + 0.05, x1 - x0 - 0.2, 0.06, 0.03); c.fill();
    c.fillStyle = '#e0621a'; c.fillRect(x0 + 0.05, 0.47, x1 - x0 - 0.1, 0.06); // racing stripe
    glass(c, x1 - 0.62, y0 + 0.08, 0.2, y1 - y0 - 0.16, 0.06); glass(c, x0 + 0.18, y0 + 0.1, 0.12, y1 - y0 - 0.2, 0.05);
    c.fillStyle = shade('#ffad1f', 0.18); rr(c, x0 + 0.32, y0 + 0.06, x1 - x0 - 0.94, y1 - y0 - 0.12, 0.08); c.fill();
    // luggage on the roof rack: kardus + koper, roped
    var rx = x0 + 0.36, rw = x1 - x0 - 1.02;
    c.fillStyle = '#c8955a'; rr(c, rx, 0.24, rw * 0.55, 0.3, 0.03); c.fill(); c.fillStyle = '#e6c08a'; c.fillRect(rx + rw * 0.25, 0.24, 0.04, 0.3);
    c.fillStyle = '#3a6fd8'; rr(c, rx + rw * 0.05, 0.56, rw * 0.7, 0.2, 0.04); c.fill(); c.fillStyle = '#89aef5'; c.fillRect(rx + rw * 0.1, 0.6, rw * 0.6, 0.03);
    c.fillStyle = '#e8433f'; rr(c, rx + rw * 0.62, 0.26, rw * 0.36, 0.24, 0.04); c.fill();
    c.strokeStyle = '#6b3e1a'; c.lineWidth = 0.025; c.beginPath(); c.moveTo(rx - 0.02, 0.2); c.lineTo(rx + rw, 0.8); c.moveTo(rx + rw, 0.2); c.lineTo(rx - 0.02, 0.8); c.stroke();
    lights(c, x1, y0, y1, true); tails(c, x0, y0, y1);
    // mini merah-putih flag on the antenna
    var wv = Math.sin(t * 8) * 0.03; c.strokeStyle = '#333'; c.lineWidth = 0.015; c.beginPath(); c.moveTo(x0 + 0.12, y0 + 0.05); c.lineTo(x0 + 0.02, y0 - 0.12); c.stroke();
    c.fillStyle = '#e8433f'; c.fillRect(x0 - 0.15, y0 - 0.12 + wv, 0.17, 0.05); c.fillStyle = '#fff'; c.fillRect(x0 - 0.15, y0 - 0.07 + wv, 0.17, 0.05);
    c.fillStyle = '#ffad1f'; c.beginPath(); c.ellipse(x1 - 0.66, y0 - 0.02, 0.05, 0.035, 0, 0, TAU); c.ellipse(x1 - 0.66, y1 + 0.02, 0.05, 0.035, 0, 0, TAU); c.fill();
  }
  function drawAngkot(c, len, col, id) {
    var x0 = 0.08, x1 = len - 0.08, y0 = 0.12, y1 = 0.88;
    wheels(c, [0.28, len - 0.55], y0, y1);
    body(c, x0, y0, x1 - x0, y1 - y0, 0.1, col);
    c.fillStyle = '#fff'; c.fillRect(x0 + 0.04, y0 + 0.02, x1 - x0 - 0.08, 0.05); c.fillRect(x0 + 0.04, y1 - 0.07, x1 - x0 - 0.08, 0.05);
    glass(c, x1 - 0.36, y0 + 0.08, 0.14, y1 - y0 - 0.16, 0.04);
    c.fillStyle = shade(col, 0.22); rr(c, x0 + 0.1, y0 + 0.1, x1 - x0 - 0.5, y1 - y0 - 0.2, 0.05); c.fill();
    c.strokeStyle = 'rgba(40,40,40,.55)'; c.lineWidth = 0.025; c.beginPath(); c.moveTo(x0 + 0.16, y0 + 0.2); c.lineTo(x1 - 0.48, y0 + 0.2); c.moveTo(x0 + 0.16, y1 - 0.2); c.lineTo(x1 - 0.48, y1 - 0.2); c.stroke();
    c.fillStyle = '#fff'; rr(c, x0 + 0.42, 0.37, 0.4, 0.26, 0.04); c.fill(); c.save(); c.scale(0.01, 0.01); c.fillStyle = '#222'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = '900 20px system-ui,sans-serif';
    c.translate((x0 + 0.62) * 100, 51); if (TXF.flip) c.scale(-1, 1); if (TXF.vert) c.rotate(TXF.flip ? Math.PI / 2 : -Math.PI / 2); c.fillText(('0' + (1 + hsh(id) % 19)).slice(-2), 0, 1); c.restore();
    lights(c, x1, y0, y1, false); tails(c, x0, y0, y1);
  }
  function drawBus(c, len, col, acc) {
    var x0 = 0.06, x1 = len - 0.06, y0 = 0.08, y1 = 0.92;
    wheels(c, [0.3, 0.6, len - 0.6], y0 + 0.02, y1 - 0.02);
    body(c, x0, y0, x1 - x0, y1 - y0, 0.12, col);
    c.fillStyle = 'rgba(20,30,40,.55)'; for (var wx = x0 + 0.22; wx < x1 - 0.5; wx += 0.33) { c.fillRect(wx, y0 + 0.01, 0.26, 0.06); c.fillRect(wx, y1 - 0.07, 0.26, 0.06); }
    c.fillStyle = acc; c.beginPath(); c.moveTo(x0 + 0.1, y1 - 0.12); c.bezierCurveTo(len * 0.35, y1 - 0.12, len * 0.5, y0 + 0.2, x1 - 0.4, y0 + 0.16); c.lineTo(x1 - 0.4, y0 + 0.28); c.bezierCurveTo(len * 0.5, y0 + 0.32, len * 0.38, y1 - 0.04, x0 + 0.1, y1 - 0.02); c.closePath(); c.globalAlpha = 0.9; c.fill(); c.globalAlpha = 1;
    glass(c, x1 - 0.26, y0 + 0.08, 0.14, y1 - y0 - 0.16, 0.05);
    c.fillStyle = '#d9dde2'; rr(c, x0 + 0.5, 0.3, 0.45, 0.4, 0.06); c.fill(); rr(c, x0 + 1.3, 0.3, 0.45, 0.4, 0.06); c.fill();
    c.strokeStyle = '#9aa3ad'; c.lineWidth = 0.02; for (var k = 0; k < 4; k++) { c.beginPath(); c.moveTo(x0 + 0.56 + k * 0.1, 0.36); c.lineTo(x0 + 0.56 + k * 0.1, 0.64); c.moveTo(x0 + 1.36 + k * 0.1, 0.36); c.lineTo(x0 + 1.36 + k * 0.1, 0.64); c.stroke(); }
    c.fillStyle = 'rgba(0,0,0,.25)'; rr(c, x0 + 2.05, 0.38, 0.22, 0.24, 0.03); c.fill();
    lights(c, x1, y0, y1, false); tails(c, x0, y0, y1);
  }
  function drawMotor(c, col, id, t) {
    var h = hsh(id);
    c.fillStyle = '#1c1a19'; rr(c, 0.1, 0.45, 0.22, 0.1, 0.04); c.fill(); rr(c, 0.68, 0.45, 0.22, 0.1, 0.04); c.fill();
    body(c, 0.24, 0.36, 0.5, 0.28, 0.12, col);
    if (h & 1) { c.fillStyle = '#d8b77a'; rr(c, 0.04, 0.3, 0.26, 0.4, 0.06); c.fill(); c.strokeStyle = '#8a6a36'; c.lineWidth = 0.02; c.strokeRect(0.08, 0.36, 0.18, 0.28); }
    c.strokeStyle = '#333'; c.lineWidth = 0.04; c.beginPath(); c.moveTo(0.7, 0.26); c.lineTo(0.7, 0.74); c.stroke();
    c.fillStyle = ['#3a6fd8', '#21b36b', '#8e5bd6', '#f6c419'][h % 4]; c.beginPath(); c.ellipse(0.5, 0.5, 0.12, 0.2, 0, 0, TAU); c.fill();
    c.fillStyle = (h & 2) ? '#fff' : '#e8433f'; c.beginPath(); c.arc(0.54, 0.5, 0.11, 0, TAU); c.fill(); c.fillStyle = '#223'; c.beginPath(); c.arc(0.58, 0.5, 0.075, -0.9, 0.9); c.fill();
    c.fillStyle = '#ffe9a0'; c.beginPath(); c.arc(0.9, 0.5, 0.035, 0, TAU); c.fill();
  }
  function drawPolisi(c, t) {
    cone(c, 0.16, 0.2, 0.12); cone(c, 0.84, 0.78, 0.12);
    c.fillStyle = 'rgba(0,0,0,.25)'; c.beginPath(); c.ellipse(0.53, 0.55, 0.34, 0.3, 0, 0, TAU); c.fill();
    c.fillStyle = '#ffd23f'; c.beginPath(); c.arc(0.5, 0.5, 0.36, 0, TAU); c.fill(); c.save(); c.beginPath(); c.arc(0.5, 0.5, 0.36, 0, TAU); c.clip();
    c.fillStyle = '#222'; for (var i = -4; i < 6; i++) { c.beginPath(); c.moveTo(i * 0.14, 0); c.lineTo(i * 0.14 + 0.07, 0); c.lineTo(i * 0.14 + 0.07 + 1, 1); c.lineTo(i * 0.14 + 1, 1); c.fill(); } c.restore();
    c.fillStyle = '#fff'; c.beginPath(); c.arc(0.5, 0.5, 0.27, 0, TAU); c.fill();
    var wave = Math.sin(t * 5) * 0.35;
    c.save(); c.translate(0.5, 0.5); c.rotate(wave); c.fillStyle = '#7a5532'; rr(c, 0, -0.04, 0.32, 0.08, 0.04); c.fill(); c.fillStyle = '#fff'; c.beginPath(); c.arc(0.34, 0, 0.05, 0, TAU); c.fill(); c.restore();
    c.fillStyle = '#7a5532'; c.beginPath(); c.ellipse(0.5, 0.5, 0.15, 0.23, 0, 0, TAU); c.fill();
    c.fillStyle = '#c6f432'; c.fillRect(0.4, 0.38, 0.2, 0.04); c.fillRect(0.4, 0.58, 0.2, 0.04);
    c.fillStyle = '#f4f4f4'; c.beginPath(); c.arc(0.5, 0.5, 0.1, 0, TAU); c.fill(); c.fillStyle = '#1b1b1b'; c.beginPath(); c.arc(0.5, 0.5, 0.1, -0.7, 0.7); c.lineTo(0.5, 0.5); c.fill();
    c.fillStyle = '#c9a227'; c.beginPath(); c.arc(0.48, 0.5, 0.03, 0, TAU); c.fill();
  }
  function color(p, i) {
    var pal = CFG.palette, h = hsh(p.id + i);
    if (p.col != null) { if (p.type === 'bus') return pal.bus[p.col % pal.bus.length]; if (p.type === 'angkot') return [pal.angkot[p.col % pal.angkot.length]]; }
    if (p.type === 'angkot') return [pal.angkot[h % pal.angkot.length]];
    if (p.type === 'bus') return pal.bus[h % pal.bus.length];
    if (p.type === 'motor') return [pal.motor[h % pal.motor.length]];
    return ['#ffad1f'];
  }
  function drawPiece(c, p, i, vx, vy, t, o) {
    var cs = L.cs, x = L.bx + vx * cs, y = L.by + vy * cs, len = p.len, h = hsh(p.id), facing = p.type === 'mudik' ? 1 : (h & 4 ? 1 : -1);
    var bob = reduce ? 0 : Math.sin(t * 3.1 + (h % 100)) * cs * 0.012, lift = o.lift || 0;
    c.save();
    if (p.dir === 'h') c.translate(x, y + bob - lift); else { c.translate(x + cs, y + bob * 0.5 - lift); c.rotate(Math.PI / 2); }
    if (o.shake) c.translate(Math.sin(t * 60) * cs * 0.03, 0);
    c.scale(cs, cs);
    if (facing < 0 && p.type !== 'polisi') { c.translate(len, 0); c.scale(-1, 1); }
    if (p.type !== 'polisi') { var sh = p.type === 'motor' ? [0.1, 0.36, 0.8, 0.34, 0.15] : [0.1, 0.18, len - 0.2, 0.7, 0.18]; c.fillStyle = 'rgba(10,5,0,' + (0.32 + lift / cs) + ')'; rr(c, sh[0] + 0.05 + lift / cs * 0.6 * facing, sh[1] + 0.07 + lift / cs, sh[2], sh[3], sh[4]); c.fill(); }
    if (o.glow) { c.shadowColor = o.glow; c.shadowBlur = 18 * (G.devicePixelRatio || 1); }
    var col = color(p, i); TXF = { flip: facing < 0, vert: p.dir === 'v' };
    if (p.type === 'mudik') drawMudik(c, len, t); else if (p.type === 'angkot') drawAngkot(c, len, col[0], p.id); else if (p.type === 'bus') drawBus(c, len, col[0], col[1]); else if (p.type === 'motor') drawMotor(c, col[0], p.id, t); else drawPolisi(c, t);
    c.restore();
  }
  // ---------- particles ----------
  function puff(x, y, vx, vy, kind) { if (parts.length > 220) parts.shift(); parts.push({ x: x, y: y, vx: vx, vy: vy, life: 0, max: kind === 'dust' ? 0.5 : 0.9, r: kind === 'dust' ? 3 : 5, kind: kind }); }
  function exhaust(p, dirSign) { // puffs behind the piece after a slide
    var cs = L.cs, cx0, cy0, back = -dirSign;
    if (p.dir === 'h') { cx0 = L.bx + (back < 0 ? p.x : p.x + p.len) * cs; cy0 = L.by + (p.y + 0.5) * cs; for (var i = 0; i < 6; i++) puff(cx0, cy0 + (Math.random() - 0.5) * cs * 0.5, back * (20 + Math.random() * 40), -10 - Math.random() * 20, i % 2 ? 'dust' : 'smoke'); }
    else { cx0 = L.bx + (p.x + 0.5) * cs; cy0 = L.by + (back < 0 ? p.y : p.y + p.len) * cs; for (var j = 0; j < 6; j++) puff(cx0 + (Math.random() - 0.5) * cs * 0.5, cy0, (Math.random() - 0.5) * 30, back * (20 + Math.random() * 40), j % 2 ? 'dust' : 'smoke'); }
  }
  function clearFx() { parts.length = 0; conf.length = 0; }
  function confetti(n) { var cols = ['#ffd23f', '#e8433f', '#21b36b', '#1e88e5', '#ff5fa2', '#fff']; for (var i = 0; i < (n || 140); i++) conf.push({ x: W / 2 + (Math.random() - 0.5) * W * 0.3, y: H * 0.35, vx: (Math.random() - 0.5) * 900, vy: -300 - Math.random() * 700, r: Math.random() * TAU, vr: (Math.random() - 0.5) * 12, c: cols[i % cols.length], s: 5 + Math.random() * 6, ket: i % 9 === 0, life: 0 }); }
  function stepFx(dt) {
    for (var i = parts.length - 1; i >= 0; i--) { var q = parts[i]; q.life += dt; q.x += q.vx * dt; q.y += q.vy * dt; q.vx *= 0.94; q.vy *= 0.94; if (q.life > q.max) parts.splice(i, 1); }
    for (var j = conf.length - 1; j >= 0; j--) { var f = conf[j]; f.life += dt; f.vy += 900 * dt; f.vx *= 0.985; f.x += f.vx * dt; f.y += f.vy * dt; f.r += f.vr * dt; if (f.y > H + 40 || f.life > 5) conf.splice(j, 1); }
  }
  function drawFx(c) {
    parts.forEach(function (q) { var k = q.life / q.max; c.fillStyle = q.kind === 'dust' ? 'rgba(196,160,110,' + (0.55 * (1 - k)) + ')' : 'rgba(235,235,235,' + (0.6 * (1 - k)) + ')'; c.beginPath(); c.arc(q.x, q.y, q.r * (1 + k * 2.5) * L.cs / 60, 0, TAU); c.fill(); });
    conf.forEach(function (f) { c.save(); c.translate(f.x, f.y); c.rotate(f.r); if (f.ket) { c.fillStyle = '#2f9e44'; c.fillRect(-f.s, -f.s, f.s * 2, f.s * 2); c.fillStyle = '#c8e06a'; c.fillRect(-f.s * 0.4, -f.s, f.s * 0.8, f.s * 2); } else { c.fillStyle = f.c; c.fillRect(-f.s / 2, -f.s / 4, f.s, f.s / 2); } c.restore(); });
  }
  function bunting(c, t) { // ketupat string over the top kerb
    var cs = L.cs, x0 = L.bx - cs * 0.15, x1 = L.bx + 6 * cs + cs * 0.15, y = L.by - cs * 0.22, n = 9;
    c.strokeStyle = 'rgba(80,40,10,.7)'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(x0, y); c.quadraticCurveTo((x0 + x1) / 2, y + cs * 0.25, x1, y); c.stroke();
    for (var i = 1; i < n; i++) { var u = i / n, px = x0 + (x1 - x0) * u, py = y + cs * 0.25 * 2 * u * (1 - u) * 1, sw = reduce ? 0 : Math.sin(t * 2 + i) * 0.25, s = cs * 0.1;
      c.save(); c.translate(px, py); c.rotate(sw); c.fillStyle = i % 2 ? '#2f9e44' : '#ffd23f'; c.beginPath(); c.moveTo(0, 0); c.lineTo(s, s * 1.2); c.lineTo(0, s * 2.4); c.lineTo(-s, s * 1.2); c.closePath(); c.fill(); c.strokeStyle = i % 2 ? '#c8e06a' : '#e09b00'; c.lineWidth = 1; c.beginPath(); c.moveTo(-s * 0.5, s * 0.6); c.lineTo(s * 0.5, s * 1.8); c.moveTo(s * 0.5, s * 0.6); c.lineTo(-s * 0.5, s * 1.8); c.stroke(); c.restore(); }
  }
  // ---------- frame ----------
  // st: {pieces, vis:[{x,y}], drag:{k,min,max}, hint:{k,d}, carOut, hand:{k,dir}, glowK, shakeK, dim}
  function frame(st, t, dt) {
    stepFx(dt); var c = cx; c.setTransform(1, 0, 0, 1, 0, 0); c.drawImage(scene, 0, 0); c.setTransform(DPR, 0, 0, DPR, 0, 0);
    var cs = L.cs; bunting(c, t);
    if (!st || !st.pieces) { drawFx(c); return; }
    var ps = st.pieces;
    if (st.drag) { var p = ps[st.drag.k], v = st.vis[st.drag.k]; c.fillStyle = 'rgba(255,230,140,.16)'; c.strokeStyle = 'rgba(255,230,140,.6)'; c.lineWidth = 2; c.setLineDash([6, 6]);
      if (p.dir === 'h') rr(c, L.bx + (p.x + st.drag.min) * cs + 3, L.by + p.y * cs + 3, (p.len + st.drag.max - st.drag.min) * cs - 6, cs - 6, cs * 0.2); else rr(c, L.bx + p.x * cs + 3, L.by + (p.y + st.drag.min) * cs + 3, cs - 6, (p.len + st.drag.max - st.drag.min) * cs - 6, cs * 0.2);
      c.fill(); c.stroke(); c.setLineDash([]); }
    if (st.hint) { var hp = ps[st.hint.k], pulse = 0.5 + 0.5 * Math.sin(t * 6), gx = hp.dir === 'h' ? hp.x + st.hint.d : hp.x, gy = hp.dir === 'v' ? hp.y + st.hint.d : hp.y;
      c.save(); c.globalAlpha = 0.35 + 0.2 * pulse; drawPiece(c, hp, st.hint.k, gx, gy, t, {}); c.restore();
      c.strokeStyle = 'rgba(255,210,63,' + (0.6 + 0.4 * pulse) + ')'; c.lineWidth = 4; c.setLineDash([]); var w = hp.dir === 'h' ? hp.len : 1, h = hp.dir === 'v' ? hp.len : 1; rr(c, L.bx + gx * cs + 3, L.by + gy * cs + 3, w * cs - 6, h * cs - 6, cs * 0.2); c.stroke(); }
    // draw order: polisi, others, lifted (dragged) piece last
    var order = ps.map(function (_, i) { return i; }).sort(function (a, b) { return (st.drag && a === st.drag.k) - (st.drag && b === st.drag.k) || (ps[a].type !== 'polisi') - (ps[b].type !== 'polisi'); });
    order.forEach(function (i) { var v = st.vis[i], ox = (i === 0 && st.carOut) ? st.carOut : 0;
      drawPiece(c, ps[i], i, v.x + ox, v.y, t, { lift: st.drag && st.drag.k === i ? cs * 0.06 : 0, glow: (st.glowK === i) ? 'rgba(255,220,80,.95)' : (i === 0 ? 'rgba(255,180,40,.55)' : null), shake: st.shakeK === i }); });
    if (st.hand) { var q = ps[st.hand.k], ph = (t * 0.8) % 1, e = ph < 0.7 ? ph / 0.7 : 1, a = ph < 0.85 ? 1 : (1 - (ph - 0.85) / 0.15), dist = st.hand.dist || 1;
      var hx = L.bx + (q.x + (q.dir === 'h' ? q.len / 2 : 0.5)) * cs + (q.dir === 'h' ? st.hand.dir * e * dist * cs : 0), hy = L.by + (q.y + (q.dir === 'v' ? q.len / 2 : 0.5)) * cs + (q.dir === 'v' ? st.hand.dir * e * dist * cs : 0);
      c.globalAlpha = a; c.fillStyle = 'rgba(255,255,255,.5)'; c.beginPath(); c.arc(hx, hy, cs * 0.22, 0, TAU); c.fill(); c.font = Math.round(cs * 0.55) + 'px system-ui,sans-serif'; c.textAlign = 'center'; c.textBaseline = 'top'; c.fillText('👆', hx + cs * 0.06, hy - cs * 0.08); c.globalAlpha = 1; }
    drawFx(c);
  }
  function hit(px, py) { var gx = (px - L.bx) / L.cs, gy = (py - L.by) / L.cs; return { x: gx, y: gy, inside: gx >= 0 && gy >= 0 && gx < 6 && gy < 6 }; }
  G.MMR = { init: init, resize: resize, frame: frame, hit: hit, exhaust: exhaust, confetti: confetti, clearFx: clearFx, puff: puff, layout: function () { return L; }, size: function () { return { w: W, h: H }; } };
})(typeof globalThis !== 'undefined' ? globalThis : this);

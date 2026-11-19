// Whoosh Atur Rel renderer: canvas, schematic top-down rail yard. Landscape = flow left->right; portrait = transposed (top->bottom).
var WRR = (function () {
  'use strict';
  var cv, cx, W = 0, H = 0, DPR = 1, cs = 40, ox = 0, oy = 0, rot = false, map = null, theme = 'kampung', bg = null, stKey = '';
  var TH = {
    kampung: { base: '#a6d46f', base2: '#93c75f', ballast: '#c9b99b', wood: '#7a5133', rail: '#5f6b78', field: '#bde27f', row: '#9cc95c' },
    kota: { base: '#cfc8b8', base2: '#c2baa8', ballast: '#b7ab97', wood: '#6b4a32', rail: '#56616d', field: '#d9d3c4', row: '#bfb7a6' },
    koridor: { base: '#9fd07a', base2: '#86bd64', ballast: '#c7b89c', wood: '#74502f', rail: '#5a6673', field: '#c2e48a', row: '#a3cf68' }
  };
  function init(c) { cv = c; cx = c.getContext('2d'); }
  function resize() {
    DPR = Math.min(2, window.devicePixelRatio || 1);
    var r = cv.getBoundingClientRect(); W = Math.max(50, r.width); H = Math.max(50, r.height);
    cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
    layout(); bg = null;
  }
  // world bounds: x -1.1..18.5 (exit signs on the right), y -0.45..9.45
  var X0 = -1.1, X1 = 18.5, Y0 = -0.45, Y1 = 9.45, padT = 0, padB = 0;
  function setPad(t, b) { if (t === padT && b === padB) return; padT = t; padB = b; layout(); bg = null; }
  function layout() {
    rot = H > W * 1.05; var Hh = H - padT - padB;
    var wx = X1 - X0, wy = Y1 - Y0;
    if (rot) wx += 0.5; // portrait: room for the station cards under the exits
    cs = rot ? Math.min(W / wy, Hh / wx) : Math.min(W / wx, Hh / wy);
    if (rot) { ox = (W - wy * cs) / 2 - Y0 * cs; oy = padT + (Hh - wx * cs) / 2 - X0 * cs; }
    else { ox = (W - wx * cs) / 2 - X0 * cs; oy = padT + (Hh - wy * cs) / 2 - Y0 * cs; }
  }
  function S(x, y) { return rot ? [ox + y * cs, oy + x * cs] : [ox + x * cs, oy + y * cs]; }
  function toW(sx, sy) { return rot ? { x: (sy - oy) / cs, y: (sx - ox) / cs } : { x: (sx - ox) / cs, y: (sy - oy) / cs }; }
  function ang(a) { return rot ? Math.PI / 2 - a : a; }
  var tint = null;
  function setLevel(m, th, tn) { map = m; theme = th || 'kampung'; tint = tn || null; bg = null; }

  // ---------- static layer ----------
  function distToTrack(x, y) {
    var best = 99;
    map.edges.forEach(function (e) { for (var i = 1; i < e.pts.length; i++) { var a = e.pts[i - 1], b = e.pts[i], dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy, t = l2 ? Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / l2)) : 0; best = Math.min(best, Math.hypot(x - a[0] - dx * t, y - a[1] - dy * t)); } });
    return best;
  }
  function rect(c, x, y, w, h) { var p = S(x, y), q = S(x + w, y + h); c.rect(Math.min(p[0], q[0]), Math.min(p[1], q[1]), Math.abs(q[0] - p[0]), Math.abs(q[1] - p[1])); }
  function rrect(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
  function polyPath(c, pts, off) {
    c.beginPath();
    for (var i = 0; i < pts.length; i++) {
      var p = pts[i], q;
      if (off) { var a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1; q = S(p[0] - dy / l * off, p[1] + dx / l * off); }
      else q = S(p[0], p[1]);
      if (i) c.lineTo(q[0], q[1]); else c.moveTo(q[0], q[1]);
    }
  }
  function extPts(e) { // exits/entries run past the border into the portal
    var p = e.pts.slice(), A = map.nodes[e.from], B = map.nodes[e.to];
    if (!A.inn.length) p.unshift([p[0][0] - 1.4, p[0][1]]);
    if (!B.out.length) p.push([p[p.length - 1][0] + 0.9, p[p.length - 1][1]]);
    return p;
  }
  function buildBg() {
    var T = TH[theme], c = document.createElement('canvas'); c.width = cv.width; c.height = cv.height;
    var g = c.getContext('2d'); g.setTransform(DPR, 0, 0, DPR, 0, 0);
    // ground
    var gr = g.createLinearGradient(0, 0, W, H); gr.addColorStop(0, T.base); gr.addColorStop(1, T.base2); g.fillStyle = gr; g.fillRect(0, 0, W, H);
    var R = WR.rng(WR.hash(map.def.id + theme));
    // subtle grass/concrete speckle
    for (var i = 0; i < 260; i++) { var p = S(X0 + R() * (X1 - X0), Y0 + R() * (Y1 - Y0)); g.fillStyle = 'rgba(255,255,255,' + (0.05 + R() * 0.07) + ')'; g.fillRect(p[0], p[1], cs * 0.08, cs * 0.08); g.fillStyle = 'rgba(0,0,0,' + (0.03 + R() * 0.05) + ')'; g.fillRect(p[0] + cs * 0.3, p[1] + cs * 0.2, cs * 0.06, cs * 0.06); }
    decor(g, T, R);
    // map frame
    g.save(); g.strokeStyle = 'rgba(60,40,20,.18)'; g.lineWidth = cs * 0.06; g.setLineDash([cs * 0.25, cs * 0.18]); g.beginPath(); rect(g, 0, -0.2, 16, 9.4); g.stroke(); g.restore();
    // tracks: shadow, ballast, sleepers, rails
    var E = map.edges.map(extPts);
    g.lineCap = 'round'; g.lineJoin = 'round';
    E.forEach(function (p) { g.strokeStyle = 'rgba(40,30,10,.18)'; g.lineWidth = cs * 0.62; polyPath(g, p.map(function (q) { return [q[0] + 0.05, q[1] + 0.07]; })); g.stroke(); });
    E.forEach(function (p) { g.strokeStyle = T.ballast; g.lineWidth = cs * 0.56; polyPath(g, p); g.stroke(); });
    E.forEach(function (p) { g.strokeStyle = 'rgba(255,255,255,.18)'; g.lineWidth = cs * 0.42; polyPath(g, p); g.stroke(); });
    g.lineCap = 'butt';
    E.forEach(function (p) { g.strokeStyle = T.wood; g.lineWidth = cs * 0.4; g.setLineDash([cs * 0.07, cs * 0.15]); polyPath(g, p); g.stroke(); });
    g.setLineDash([]); g.lineCap = 'round';
    E.forEach(function (p) { [-0.1, 0.1].forEach(function (o) { g.strokeStyle = T.rail; g.lineWidth = cs * 0.055; polyPath(g, p, o); g.stroke(); g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = cs * 0.02; polyPath(g, p, o - 0.012); g.stroke(); }); });
    // entry portals (tunnel mouths)
    map.entries.forEach(function (id) { portal(g, map.nodes[id], true); });
    map.exits.forEach(function (id) { station(g, map.nodes[id], WR_DATA.stations[map.def.exits[id]]); });
    // vignette + optional dusk tint
    var vg = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(20,20,40,.28)'); g.fillStyle = vg; g.fillRect(0, 0, W, H);
    if (tint === 'senja') { var tg = g.createLinearGradient(0, 0, 0, H); tg.addColorStop(0, 'rgba(255,140,60,.22)'); tg.addColorStop(1, 'rgba(120,60,160,.18)'); g.fillStyle = tg; g.fillRect(0, 0, W, H); }
    return c;
  }
  function portal(g, n, entry) {
    var p = S(n.x - 1.05, n.y), r = cs * 0.48;
    g.save(); g.translate(p[0], p[1]); if (rot) g.rotate(Math.PI / 2);
    g.fillStyle = '#7d6a55'; rrect(g, -r * 0.9, -r * 1.25, r * 1.5, r * 2.5, r * 0.35); g.fill();
    g.fillStyle = '#2b2420'; rrect(g, -r * 0.5, -r * 0.8, r * 1.2, r * 1.6, r * 0.6); g.fill();
    g.strokeStyle = '#a89379'; g.lineWidth = 2; rrect(g, -r * 0.9, -r * 1.25, r * 1.5, r * 2.5, r * 0.35); g.stroke();
    g.restore();
    var lb = map.def.entries && map.def.entries[n.id];
    if (lb) { var q = rot ? S(n.x - 1.1, n.y + 0.55) : S(n.x - 0.15, n.y - 0.98); label(g, 'dari ' + lb, q[0], q[1], 'rgba(30,30,40,.72)', '#fff', Math.max(9, cs * 0.24), 'left'); }
  }
  function label(g, txt, x, y, bgc, fg, fs, align) {
    g.save(); g.font = '700 ' + fs + 'px system-ui,-apple-system,Segoe UI,Roboto,sans-serif'; var w = g.measureText(txt).width + fs * 0.9, h = fs * 1.55;
    var lx = align === 'left' ? x : x - w / 2; lx = Math.max(4, Math.min(W - w - 4, lx));
    g.fillStyle = bgc; rrect(g, lx, y - h / 2, w, h, h / 2); g.fill(); g.fillStyle = fg; g.textBaseline = 'middle'; g.textAlign = 'left'; g.fillText(txt, lx + fs * 0.45, y + 0.5); g.restore();
  }
  function exGap() { var ys = map.exits.map(function (id) { return map.nodes[id].y; }).sort(function (a, b) { return a - b; }), m = 9; for (var i = 1; i < ys.length; i++) m = Math.min(m, ys[i] - ys[i - 1]); return m; }
  function station(g, n, sd) {
    if (rot) {
      var c0 = S(16.25, n.y), rr = cs, bw = Math.min(1.9, exGap() - 0.12) * rr, bh = 1.25 * rr, x0 = c0[0] - bw / 2, y0 = c0[1];
      g.fillStyle = 'rgba(0,0,0,.18)'; rrect(g, x0 + 2, y0 + 3, bw, bh, 0.16 * rr); g.fill();
      g.fillStyle = '#fff8ec'; rrect(g, x0, y0, bw, bh, 0.16 * rr); g.fill();
      g.fillStyle = sd.c; rrect(g, x0, y0, bw, 0.55 * rr, 0.16 * rr); g.fill(); g.fillRect(x0, y0 + 0.35 * rr, bw, 0.2 * rr);
      g.fillStyle = '#fff'; g.font = '900 ' + (0.4 * rr) + 'px system-ui,sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(sd.ch, c0[0], y0 + 0.29 * rr);
      var f2 = Math.max(8, Math.min(0.26 * rr, 13)), nm2 = sd.n; g.font = '800 ' + f2 + 'px system-ui,sans-serif'; g.fillStyle = '#2b2b33';
      while (g.measureText(nm2).width > bw - 4 && f2 > 7) { f2 -= 0.5; g.font = '800 ' + f2 + 'px system-ui,sans-serif'; }
      while (g.measureText(nm2).width > bw - 4 && nm2.length > 4) nm2 = nm2.slice(0, -2) + '.';
      g.fillText(nm2, c0[0], y0 + 0.78 * rr); g.font = '700 ' + (f2 * 0.75) + 'px system-ui,sans-serif'; g.fillStyle = '#7b6f63'; g.fillText(sd.ty[0] === 'kcic' ? 'Whoosh' : sd.ty[0] === 'krl' ? 'KRL' : 'Barang', c0[0], y0 + 1.03 * rr);
      return;
    }
    // platform canopy beyond the border, colour stripe + name
    var p = S(16.15, n.y), r = cs;
    g.save(); g.translate(p[0], p[1]); if (rot) g.rotate(Math.PI / 2);
    g.fillStyle = 'rgba(0,0,0,.18)'; rrect(g, 0.06 * r, -0.36 * r + 0.08 * r, 2.2 * r, 0.72 * r, 0.16 * r); g.fill();
    g.fillStyle = '#fff8ec'; rrect(g, 0, -0.36 * r, 2.2 * r, 0.72 * r, 0.16 * r); g.fill();
    g.fillStyle = sd.c; rrect(g, 0, -0.36 * r, 0.62 * r, 0.72 * r, 0.16 * r); g.fill(); g.fillRect(0.4 * r, -0.36 * r, 0.22 * r, 0.72 * r);
    g.fillStyle = '#fff'; g.font = '900 ' + (0.42 * r) + 'px system-ui,sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(sd.ch, 0.31 * r, 0.02 * r);
    var fs = Math.max(7.5, Math.min(0.27 * r, 15)); g.font = '800 ' + fs + 'px system-ui,sans-serif'; g.fillStyle = '#2b2b33'; g.textAlign = 'left';
    var nm = sd.n; while (g.measureText(nm).width > 1.48 * r && fs > 7.5) { fs -= 0.5; g.font = '800 ' + fs + 'px system-ui,sans-serif'; }
    while (g.measureText(nm).width > 1.5 * r && nm.length > 4) nm = nm.slice(0, -2) + '.';
    g.fillText(nm, 0.7 * r, -0.07 * r);
    g.font = '700 ' + (fs * 0.72) + 'px system-ui,sans-serif'; g.fillStyle = '#7b6f63'; g.fillText(sd.ty[0] === 'kcic' ? 'Whoosh' : sd.ty[0] === 'krl' ? 'KRL' : 'Barang', 0.7 * r, 0.2 * r);
    g.restore();
  }
  function decor(g, T, R) {
    var items = [];
    function free(x, y, rad) { if (distToTrack(x, y) < rad + 0.55) return false; return !items.some(function (o) { return Math.hypot(o[0] - x, o[1] - y) < o[2] + rad; }); }
    var nF = theme === 'kota' ? 0 : 14, nH = theme === 'kota' ? 26 : 9, nT = theme === 'kota' ? 14 : 34;
    for (var i = 0; i < 300 && nF; i++) { // fields
      var x = R() * 15.4 + 0.3, y = R() * 8.6 + 0.2, w = 1.1 + R() * 1.4, h = 0.8 + R() * 0.9;
      if (!free(x + w / 2, y + h / 2, Math.max(w, h) / 2 + 0.1)) continue;
      items.push([x + w / 2, y + h / 2, Math.max(w, h) / 2]); nF--;
      g.fillStyle = T.field; g.beginPath(); rect(g, x, y, w, h); g.fill();
      g.strokeStyle = T.row; g.lineWidth = Math.max(1, cs * 0.035);
      for (var k = 0.15; k < w; k += 0.22) { g.beginPath(); var a = S(x + k, y + 0.08), b = S(x + k, y + h - 0.08); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke(); }
      g.strokeStyle = 'rgba(120,90,50,.35)'; g.lineWidth = Math.max(1, cs * 0.05); g.beginPath(); rect(g, x, y, w, h); g.stroke();
    }
    if (theme === 'koridor') for (var j = 0; j < 4; j++) { var hx = R() * 16, hy = R() * 9; if (distToTrack(hx, hy) < 1.6) continue; var p = S(hx, hy); var rg = g.createRadialGradient(p[0], p[1], 0, p[0], p[1], cs * 1.6); rg.addColorStop(0, 'rgba(60,110,50,.35)'); rg.addColorStop(1, 'rgba(60,110,50,0)'); g.fillStyle = rg; g.beginPath(); g.arc(p[0], p[1], cs * 1.6, 0, 7); g.fill(); }
    var roofs = theme === 'kota' ? ['#e9ecef', '#ced4da', '#ffd8a8', '#a5d8ff', '#f8f9fa', '#ffc9c9'] : ['#c0392b', '#d35400', '#a84300', '#b03a2e'];
    for (var i2 = 0; i2 < 600 && nH; i2++) { // houses / buildings
      var bw = theme === 'kota' ? 0.7 + R() * 0.9 : 0.5 + R() * 0.35, bh = theme === 'kota' ? 0.6 + R() * 0.8 : 0.42 + R() * 0.25, bx = R() * 15.6 + 0.2, by = R() * 8.7 + 0.15;
      if (!free(bx + bw / 2, by + bh / 2, Math.max(bw, bh) / 2 + 0.05)) continue;
      items.push([bx + bw / 2, by + bh / 2, Math.max(bw, bh) / 2]); nH--;
      g.fillStyle = 'rgba(0,0,0,.22)'; g.beginPath(); rect(g, bx + 0.08, by + 0.1, bw, bh); g.fill();
      var rc = roofs[Math.floor(R() * roofs.length)]; g.fillStyle = rc; g.beginPath(); rect(g, bx, by, bw, bh); g.fill();
      if (theme === 'kota') { g.fillStyle = 'rgba(0,0,0,.08)'; g.beginPath(); rect(g, bx + bw * 0.12, by + bh * 0.12, bw * 0.76, bh * 0.76); g.fill(); g.fillStyle = 'rgba(80,90,100,.35)'; g.beginPath(); rect(g, bx + bw * 0.2, by + bh * 0.2, bw * 0.2, bh * 0.2); g.fill(); }
      else { g.strokeStyle = 'rgba(0,0,0,.25)'; g.lineWidth = Math.max(1, cs * 0.04); g.beginPath(); var a1 = S(bx, by + bh / 2), b1 = S(bx + bw, by + bh / 2); g.moveTo(a1[0], a1[1]); g.lineTo(b1[0], b1[1]); g.stroke(); g.fillStyle = 'rgba(255,255,255,.15)'; g.beginPath(); rect(g, bx, by, bw, bh / 2); g.fill(); }
    }
    for (var i3 = 0; i3 < 400 && nT; i3++) { // trees / palms
      var tx = R() * 16, ty = R() * 9, tr = 0.22 + R() * 0.2;
      if (!free(tx, ty, tr)) continue; items.push([tx, ty, tr]); nT--;
      var p2 = S(tx, ty);
      g.fillStyle = 'rgba(0,0,0,.2)'; g.beginPath(); g.arc(p2[0] + cs * 0.07, p2[1] + cs * 0.09, tr * cs, 0, 7); g.fill();
      var col = ['#4f8a3a', '#3f7d32', '#5a9a40', '#2f6b2a'][Math.floor(R() * 4)];
      if (R() < 0.45 && theme !== 'kota') { g.strokeStyle = col; g.lineWidth = cs * 0.07; g.lineCap = 'round'; for (var k2 = 0; k2 < 6; k2++) { var an = k2 / 6 * Math.PI * 2 + R(); g.beginPath(); g.moveTo(p2[0], p2[1]); g.lineTo(p2[0] + Math.cos(an) * tr * cs * 1.3, p2[1] + Math.sin(an) * tr * cs * 1.3); g.stroke(); } g.fillStyle = '#8b5a2b'; g.beginPath(); g.arc(p2[0], p2[1], cs * 0.06, 0, 7); g.fill(); }
      else { g.fillStyle = col; g.beginPath(); g.arc(p2[0], p2[1], tr * cs, 0, 7); g.fill(); g.fillStyle = 'rgba(255,255,255,.16)'; g.beginPath(); g.arc(p2[0] - tr * cs * 0.3, p2[1] - tr * cs * 0.3, tr * cs * 0.5, 0, 7); g.fill(); }
    }
    if (theme === 'kampung') for (var i4 = 0; i4 < 200; i4++) { var px = R() * 15 + 0.5, py = R() * 8 + 0.5; if (!free(px, py, 0.55)) continue; items.push([px, py, 0.55]); var p3 = S(px, py); g.fillStyle = '#6cc0e5'; g.beginPath(); g.ellipse(p3[0], p3[1], cs * 0.55, cs * 0.36, 0, 0, 7); g.fill(); g.strokeStyle = 'rgba(255,255,255,.5)'; g.lineWidth = 1.5; g.beginPath(); g.ellipse(p3[0] - cs * 0.1, p3[1] - cs * 0.06, cs * 0.25, cs * 0.1, 0, 0, 7); g.stroke(); break; }
  }

  // ---------- dynamic ----------
  var CARS = {
    kcic: [0.62, 0.55, 0.55], krl: [0.47, 0.47, 0.47, 0.47], barang: [0.55, 0.44, 0.44, 0.44, 0.44, 0.44]
  };
  var CONT = ['#c92a2a', '#2b8a3e', '#e67700', '#1864ab', '#868e96', '#5f3dc4'];
  function carShape(c, type, i, len, wd, tr) {
    var L = len * cs, w = wd * cs, h = L / 2, hw = w / 2;
    if (type === 'kcic') {
      c.fillStyle = '#f4f6f8';
      if (i === 0) { c.beginPath(); c.moveTo(h, 0); c.quadraticCurveTo(h * 0.2, -hw * 1.05, -h, -hw); c.lineTo(-h, hw); c.quadraticCurveTo(h * 0.2, hw * 1.05, h, 0); c.fill(); }
      else { rrect(c, -h, -hw, L, w, w * 0.3); c.fill(); }
      c.fillStyle = '#d62839'; c.fillRect(-h + 1, -hw * 0.18, L * (i === 0 ? 0.62 : 1) - 2, hw * 0.36);
      c.fillStyle = '#26364a'; if (i === 0) { c.beginPath(); c.ellipse(h * 0.25, 0, h * 0.28, hw * 0.55, 0, 0, 7); c.fill(); }
      else c.fillRect(-h * 0.8, -hw * 0.75, L * 0.8, hw * 0.22);
    } else if (type === 'krl') {
      c.fillStyle = '#f1f3f5'; rrect(c, -h, -hw, L, w, w * 0.22); c.fill();
      c.fillStyle = '#e03131'; c.fillRect(-h, -hw * 0.45, L, hw * 0.9);
      c.fillStyle = '#ffd43b'; c.fillRect(-h, hw * 0.45, L, hw * 0.16);
      if (i === 0) { c.fillStyle = '#212529'; c.fillRect(h - L * 0.2, -hw * 0.7, L * 0.14, hw * 1.4); }
      if (i === tr) { c.fillStyle = '#212529'; c.fillRect(-h + L * 0.06, -hw * 0.7, L * 0.12, hw * 1.4); }
    } else {
      if (i === 0) { c.fillStyle = '#1c4e8a'; rrect(c, -h, -hw, L, w, w * 0.2); c.fill(); c.fillStyle = '#f08c00'; c.fillRect(h - L * 0.28, -hw, L * 0.28, w); c.fillStyle = '#e9ecef'; c.fillRect(-h + L * 0.15, -hw * 0.5, L * 0.38, hw); }
      else { c.fillStyle = '#5c4a3a'; c.fillRect(-h, -hw * 0.82, L, hw * 1.64); c.fillStyle = CONT[(tr * 7 + i * 3) % CONT.length]; rrect(c, -h + L * 0.05, -hw * 0.92, L * 0.9, w * 0.92, 2); c.fill(); c.strokeStyle = 'rgba(0,0,0,.22)'; c.lineWidth = 1; for (var k = 1; k < 5; k++) { c.beginPath(); c.moveTo(-h + L * k / 5, -hw * 0.85); c.lineTo(-h + L * k / 5, hw * 0.85); c.stroke(); } }
    }
  }
  function drawTrain(c, st, tr, now, ui) {
    var cars = CARS[tr.type], d = 0, wd = tr.type === 'barang' ? 0.36 : 0.32, crash = tr.st === 'crash', ct = crash ? now - tr.ct : 0, head = null;
    var R = crash ? WR.rng(tr.id * 31) : null;
    for (var i = 0; i < cars.length; i++) {
      var f = WR.trainPoint(map, tr, d), b = WR.trainPoint(map, tr, d + cars[i]);
      var pf = S(f.x, f.y), pb = S(b.x, b.y), a = Math.atan2(pf[1] - pb[1], pf[0] - pb[0]), mx = (pf[0] + pb[0]) / 2, my = (pf[1] + pb[1]) / 2;
      if (crash) { var k = Math.min(1, ct * 3); a += (R() - 0.5) * 1.4 * k; mx += (R() - 0.5) * cs * 0.6 * k; my += (R() - 0.5) * cs * 0.6 * k; }
      if (!i) head = { x: pf[0], y: pf[1], a: a, mx: mx, my: my };
      c.save(); c.translate(mx + cs * 0.06, my + cs * 0.08); c.rotate(a); c.fillStyle = 'rgba(0,0,0,.25)'; rrect(c, -cars[i] * cs / 2, -wd * cs / 2, cars[i] * cs, wd * cs, 3); c.fill(); c.restore();
      c.save(); c.translate(mx, my); c.rotate(a); if (crash) c.globalAlpha = Math.max(0.25, 1 - ct * 0.5);
      carShape(c, tr.type, i, cars[i] - 0.04, wd, tr.type === 'krl' ? cars.length - 1 : tr.id);
      if (ui.warn && ui.warn[tr.id] && !crash) { c.strokeStyle = 'rgba(255,40,40,' + (0.55 + 0.45 * Math.sin(now * 18)) + ')'; c.lineWidth = 3; rrect(c, -cars[i] * cs / 2, -wd * cs / 2, cars[i] * cs, wd * cs, 4); c.stroke(); }
      c.restore();
      d += cars[i] + 0.04;
    }
    if (!head || crash) return head;
    // headlight
    if (tr.type !== 'barang' || true) { c.save(); c.translate(head.x, head.y); c.rotate(head.a); var lg = c.createRadialGradient(0, 0, 0, cs * 0.5, 0, cs * 0.6); lg.addColorStop(0, 'rgba(255,245,180,.55)'); lg.addColorStop(1, 'rgba(255,245,180,0)'); c.fillStyle = lg; c.beginPath(); c.moveTo(0, 0); c.lineTo(cs * 1.0, -cs * 0.32); c.lineTo(cs * 1.0, cs * 0.32); c.fill(); c.restore(); }
    // destination badge (+ route check)
    var sd = WR_DATA.stations[map.def.exits[tr.dest]], br = Math.max(7, cs * 0.2), bp = WR.trainPoint(map, tr, cars[0] * 0.55), q = S(bp.x, bp.y);
    var stopped = tr.st === 'run' && tr.v < 0.05, sp = WR.SPEC[tr.type];
    if (tr.st === 'run' && tr.lost > 0.05) { var fr = Math.min(1, tr.lost / (sp.tol * 2 / (st.k || 1))); c.strokeStyle = fr >= 1 ? '#e03131' : fr > 0.6 ? '#f76707' : '#fab005'; c.lineWidth = Math.max(2.5, cs * 0.07); c.beginPath(); c.arc(q[0], q[1], br + 3, -Math.PI / 2, -Math.PI / 2 + fr * Math.PI * 2); c.stroke(); }
    c.fillStyle = '#fff'; c.beginPath(); c.arc(q[0], q[1], br + 1.5, 0, 7); c.fill();
    c.fillStyle = sd.c; c.beginPath(); c.arc(q[0], q[1], br, 0, 7); c.fill();
    c.fillStyle = '#fff'; c.font = '900 ' + Math.round(br * 1.2) + 'px system-ui,sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(sd.ch, q[0], q[1] + 0.5);
    if (tr.st === 'run') {
      var ex = WR.routeExit(st, tr), good = ex === tr.dest, mr = br * 0.62, mx2 = q[0] + br * 0.95, my2 = q[1] - br * 0.95;
      c.fillStyle = good ? '#2f9e44' : '#e03131'; c.beginPath(); c.arc(mx2, my2, mr, 0, 7); c.fill(); c.strokeStyle = '#fff'; c.lineWidth = Math.max(1.5, mr * 0.32); c.beginPath();
      if (good) { c.moveTo(mx2 - mr * 0.45, my2); c.lineTo(mx2 - mr * 0.1, my2 + mr * 0.38); c.lineTo(mx2 + mr * 0.5, my2 - mr * 0.38); } else { c.moveTo(mx2 - mr * 0.4, my2 - mr * 0.4); c.lineTo(mx2 + mr * 0.4, my2 + mr * 0.4); c.moveTo(mx2 + mr * 0.4, my2 - mr * 0.4); c.lineTo(mx2 - mr * 0.4, my2 + mr * 0.4); }
      c.stroke();
      if (stopped && tr.type === 'kcic') { c.font = '800 ' + Math.max(9, cs * 0.22) + 'px system-ui,sans-serif'; c.fillStyle = '#c92a2a'; c.fillText('⏱', q[0] - br * 1.3, q[1] - br * 1.1); }
    }
    if (tr.type === 'barang' && tr.st === 'run' && tr.v > 0.3 && ui.fx && Math.random() < 0.06) ui.fx.push({ k: 'smoke', x: bp.x, y: bp.y, t: now, life: 1.4 });
    return head;
  }
  function drawSwitch(c, st, id, now, ui) {
    var n = map.nodes[id], act = map.edges[n.out[st.sw[id]]], ina = map.edges[n.out[1 - st.sw[id]]], p = S(n.x, n.y);
    // active branch glow
    c.save(); c.lineCap = 'round';
    c.strokeStyle = 'rgba(255,214,10,.9)'; c.lineWidth = cs * 0.14; c.beginPath();
    for (var s = 0; s <= 1.3; s += 0.1) { var q = WR.pos(map, act.id, s), sq = S(q.x, q.y); if (s) c.lineTo(sq[0], sq[1]); else c.moveTo(sq[0], sq[1]); }
    c.stroke();
    var e1 = WR.pos(map, ina.id, 0.55), se = S(e1.x, e1.y); c.strokeStyle = '#e03131'; c.lineWidth = cs * 0.08;
    c.beginPath(); c.moveTo(se[0] - cs * 0.13, se[1] - cs * 0.13); c.lineTo(se[0] + cs * 0.13, se[1] + cs * 0.13); c.moveTo(se[0] + cs * 0.13, se[1] - cs * 0.13); c.lineTo(se[0] - cs * 0.13, se[1] + cs * 0.13); c.stroke();
    // button
    var r = Math.max(13, cs * 0.36), lk = WR.locked(st, id), pend = st.pend[id] !== undefined, sel = ui.sel && ui.sel.k === 'w' && ui.sel.id === id;
    var bump = ui.bump && ui.bump[id] ? Math.max(0, 1 - (now - ui.bump[id]) * 4) : 0;
    r *= 1 + bump * 0.25;
    c.fillStyle = 'rgba(0,0,0,.25)'; c.beginPath(); c.arc(p[0] + 2, p[1] + 3, r, 0, 7); c.fill();
    c.fillStyle = lk ? 'rgba(90,90,100,.85)' : 'rgba(255,196,0,.95)'; c.beginPath(); c.arc(p[0], p[1], r, 0, 7); c.fill();
    c.strokeStyle = '#fff'; c.lineWidth = Math.max(2, r * 0.16); c.stroke();
    var tq = WR.pos(map, act.id, 1.0), tqs = S(tq.x, tq.y), aa = Math.atan2(tqs[1] - p[1], tqs[0] - p[0]);
    c.save(); c.translate(p[0], p[1]); c.rotate(aa); c.fillStyle = lk ? '#ddd' : '#3d2b00'; c.beginPath(); c.moveTo(r * 0.62, 0); c.lineTo(-r * 0.25, -r * 0.45); c.lineTo(-r * 0.05, 0); c.lineTo(-r * 0.25, r * 0.45); c.closePath(); c.fill(); c.restore();
    if (pend) { c.strokeStyle = 'rgba(255,255,255,' + (0.5 + 0.5 * Math.sin(now * 10)) + ')'; c.lineWidth = 3; c.setLineDash([4, 4]); c.beginPath(); c.arc(p[0], p[1], r + 5, 0, 7); c.stroke(); c.setLineDash([]); }
    if (sel) { c.strokeStyle = '#1c7ed6'; c.lineWidth = 3; c.beginPath(); c.arc(p[0], p[1], r + 8 + Math.sin(now * 6) * 2, 0, 7); c.stroke(); }
    c.restore();
    return p;
  }
  function sigGeom(ei) {
    var e = map.edges[ei], s = WR.sigS(map, ei), q = WR.pos(map, ei, s), to = map.nodes[e.to], fr = map.nodes[e.from];
    var other = map.edges[to.inn[0] === ei ? to.inn[1] : to.inn[0]], oy = map.nodes[other.from].y, side = fr.y < oy ? -1 : fr.y > oy ? 1 : (e.loop ? 1 : -1);
    if (e.loop) side = map.edges[ei].pts[1][1] < to.y ? -1 : 1;
    var nx = -Math.sin(q.a), ny = Math.cos(q.a), sgn = (ny * side >= 0) ? 1 : -1;
    return { q: q, lx: q.x + nx * 0.55 * sgn, ly: q.y + ny * 0.55 * sgn };
  }
  function drawSignal(c, st, ei, now, ui) {
    var g = sigGeom(ei), on = st.sig[ei], tp = S(g.q.x, g.q.y), lp = S(g.lx, g.ly), r = Math.max(11, cs * 0.27), sel = ui.sel && ui.sel.k === 's' && ui.sel.id === ei;
    c.save();
    if (!on) { c.strokeStyle = '#e03131'; c.lineWidth = cs * 0.09; c.lineCap = 'round'; var aa = ang(g.q.a) + Math.PI / 2; c.beginPath(); c.moveTo(tp[0] + Math.cos(aa) * cs * 0.3, tp[1] + Math.sin(aa) * cs * 0.3); c.lineTo(tp[0] - Math.cos(aa) * cs * 0.3, tp[1] - Math.sin(aa) * cs * 0.3); c.stroke(); }
    c.strokeStyle = '#495057'; c.lineWidth = Math.max(2, cs * 0.06); c.beginPath(); c.moveTo(tp[0], tp[1]); c.lineTo(lp[0], lp[1]); c.stroke();
    c.fillStyle = 'rgba(0,0,0,.28)'; rrect(c, lp[0] - r + 2, lp[1] - r + 3, r * 2, r * 2, r * 0.5); c.fill();
    c.fillStyle = '#212529'; rrect(c, lp[0] - r, lp[1] - r, r * 2, r * 2, r * 0.5); c.fill();
    var col = on ? '#40c057' : '#fa5252', gl = c.createRadialGradient(lp[0], lp[1], 0, lp[0], lp[1], r * 2.2);
    gl.addColorStop(0, on ? 'rgba(64,192,87,.55)' : 'rgba(250,82,82,.6)'); gl.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = gl; c.beginPath(); c.arc(lp[0], lp[1], r * 2.2, 0, 7); c.fill();
    c.fillStyle = col; c.beginPath(); c.arc(lp[0], lp[1], r * 0.62, 0, 7); c.fill();
    c.fillStyle = 'rgba(255,255,255,.6)'; c.beginPath(); c.arc(lp[0] - r * 0.2, lp[1] - r * 0.22, r * 0.2, 0, 7); c.fill();
    if (sel) { c.strokeStyle = '#1c7ed6'; c.lineWidth = 3; c.beginPath(); c.arc(lp[0], lp[1], r + 7 + Math.sin(now * 6) * 2, 0, 7); c.stroke(); }
    c.restore();
    return lp;
  }
  function upcoming(c, st, now) {
    var seen = {};
    st.queue.forEach(function (q) {
      if (seen[q[1]]) return; seen[q[1]] = 1;
      var dt = q[0] - st.t; if (dt > 4) return;
      var n = map.nodes[q[1]], p = S(n.x - 0.35, n.y), r = Math.max(10, cs * 0.26), sd = WR_DATA.stations[map.def.exits[q[3]]];
      var blink = 0.55 + 0.45 * Math.sin(now * 9);
      c.save(); c.globalAlpha = Math.min(1, (4 - dt) / 1.2);
      c.fillStyle = 'rgba(20,24,32,.8)'; c.beginPath(); c.arc(p[0], p[1], r * 1.35, 0, 7); c.fill();
      c.strokeStyle = '#ffd43b'; c.lineWidth = 3; c.beginPath(); c.arc(p[0], p[1], r * 1.35, -Math.PI / 2, -Math.PI / 2 + Math.max(0, Math.min(1, 1 - dt / 4)) * Math.PI * 2); c.stroke();
      c.fillStyle = sd.c; c.beginPath(); c.arc(p[0], p[1], r * 0.95, 0, 7); c.fill();
      c.fillStyle = '#fff'; c.font = '900 ' + Math.round(r * 1.05) + 'px system-ui,sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(sd.ch, p[0], p[1] + 0.5);
      var tl = q[2] === 'kcic' ? 'WHOOSH' : q[2] === 'krl' ? 'KRL' : 'BARANG', fs = Math.max(9, cs * 0.21);
      var lp = S(n.x - 0.35, n.y + 0.75); label(c, tl, lp[0], lp[1], q[2] === 'kcic' ? 'rgba(214,40,57,' + blink + ')' : 'rgba(20,24,32,.78)', '#fff', fs, 'center');
      c.restore();
    });
  }
  function draw(st, ui) {
    var now = ui.now; if (!map) return;
    if (!bg) bg = buildBg();
    var c = cx; c.setTransform(1, 0, 0, 1, 0, 0); c.drawImage(bg, 0, 0);
    c.setTransform(DPR, 0, 0, DPR, 0, 0);
    if (ui.shake && now < ui.shake) { var k = (ui.shake - now) * 14; c.translate((Math.random() - 0.5) * k, (Math.random() - 0.5) * k); }
    for (var ci = 0; ci < 3; ci++) { var cx0 = ((now * (0.012 + ci * 0.004) + ci * 0.37) % 1.4 - 0.2) * W, cy0 = H * (0.2 + ci * 0.3), cr = Math.max(W, H) * 0.16; var cg = c.createRadialGradient(cx0, cy0, 0, cx0, cy0, cr); cg.addColorStop(0, 'rgba(20,30,50,.10)'); cg.addColorStop(1, 'rgba(20,30,50,0)'); c.fillStyle = cg; c.beginPath(); c.ellipse(cx0, cy0, cr * 1.4, cr, 0, 0, 7); c.fill(); }
    if (!st) return;
    st.trains.forEach(function (tr) { if (tr.type !== 'kcic' || tr.v < 1.6 || tr.st === 'crash') return; var L = WR.SPEC.kcic.L; for (var k = 0; k < 3; k++) { var a = WR.trainPoint(map, tr, L + 0.1 + k * 0.05), b = WR.trainPoint(map, tr, L + 0.9 + k * 0.35), pa = S(a.x, a.y), pb = S(b.x, b.y), off = (k - 1) * cs * 0.12, ax = -(pb[1] - pa[1]), ay = pb[0] - pa[0], al = Math.hypot(ax, ay) || 1; ax = ax / al * off; ay = ay / al * off; var lg = c.createLinearGradient(pa[0], pa[1], pb[0], pb[1]); lg.addColorStop(0, 'rgba(255,255,255,.75)'); lg.addColorStop(1, 'rgba(255,255,255,0)'); c.strokeStyle = lg; c.lineWidth = 2; c.beginPath(); c.moveTo(pa[0] + ax, pa[1] + ay); c.lineTo(pb[0] + ax, pb[1] + ay); c.stroke(); } });
    map.switches.forEach(function (id) { drawSwitch(c, st, id, now, ui); });
    st.trains.forEach(function (tr) { drawTrain(c, st, tr, now, ui); });
    map.signals.forEach(function (ei) { drawSignal(c, st, ei, now, ui); });
    // switch buttons again (outline over trains) so they stay tappable/visible
    map.switches.forEach(function (id) { var n = map.nodes[id], p = S(n.x, n.y); c.strokeStyle = 'rgba(255,255,255,.75)'; c.lineWidth = 2; c.beginPath(); c.arc(p[0], p[1], Math.max(13, cs * 0.36), 0, 7); c.stroke(); });
    var want = {}; st.trains.forEach(function (tr) { if (tr.st === 'run' && WR.routeExit(st, tr) === tr.dest) want[tr.dest] = 1; });
    map.exits.forEach(function (id) { if (!want[id]) return; var n = map.nodes[id], p = S(16, n.y), sd = WR_DATA.stations[map.def.exits[id]]; c.globalAlpha = 0.35 + 0.25 * Math.sin(now * 5); c.fillStyle = sd.c; c.beginPath(); c.arc(p[0], p[1], cs * 0.32, 0, 7); c.fill(); c.globalAlpha = 1; });
    upcoming(c, st, now);
    if (ui.pred) { var pp = S(ui.pred.x, ui.pred.y), pr = cs * (0.55 + 0.15 * Math.sin(now * 14)); c.strokeStyle = 'rgba(255,30,30,.9)'; c.lineWidth = 4; c.beginPath(); c.arc(pp[0], pp[1], pr, 0, 7); c.stroke(); c.fillStyle = 'rgba(255,30,30,.2)'; c.fill(); c.fillStyle = '#fff'; label(c, '! AWAS' + (ui.pred.t > 0.6 ? ' ' + Math.ceil(ui.pred.t) + ' dtk' : ''), pp[0], pp[1] - pr - cs * 0.25, 'rgba(224,49,49,.95)', '#fff', Math.max(10, cs * 0.24), 'center'); }
    if (ui.showKeys) map.controls.forEach(function (ct, i) { if (i > 8) return; var p = ct.k === 'w' ? S(ct.x, ct.y) : (function () { var g = sigGeom(ct.id); return S(g.lx, g.ly); })(); label(c, String(i + 1), p[0] + cs * 0.42, p[1] + cs * 0.42, 'rgba(28,126,214,.92)', '#fff', Math.max(9, cs * 0.2), 'center'); });
    fx(c, ui, now);
    if (ui.coach) pointer(c, ui.coach, now);
  }
  function fx(c, ui, now) {
    if (!ui.fx) return;
    ui.fx = ui.fx.filter(function (f) { return now - f.t < f.life; });
    ui.fx.forEach(function (f) {
      var k = (now - f.t) / f.life, p = S(f.x, f.y);
      if (f.k === 'smoke') { c.fillStyle = 'rgba(90,90,90,' + (0.35 * (1 - k)) + ')'; c.beginPath(); c.arc(p[0] + k * cs * 0.3, p[1] - k * cs * 0.5, cs * (0.1 + k * 0.25), 0, 7); c.fill(); }
      else if (f.k === 'boom') {
        c.fillStyle = 'rgba(255,240,200,' + (0.8 * (1 - k * 3)) + ')'; if (k < 0.33) { c.beginPath(); c.arc(p[0], p[1], cs * (0.5 + k * 6), 0, 7); c.fill(); }
        f.parts.forEach(function (q) { c.fillStyle = q[4]; c.globalAlpha = 1 - k; c.beginPath(); c.arc(p[0] + q[0] * k * cs * 2.2, p[1] + q[1] * k * cs * 2.2 + k * k * cs, cs * q[2] * (1 - k * 0.5), 0, 7); c.fill(); c.globalAlpha = 1; });
      } else if (f.k === 'txt') {
        var y = p[1] - k * cs * 1.1; c.globalAlpha = Math.min(1, (1 - k) * 2); label(c, f.s, p[0], y, f.bg, '#fff', Math.max(11, cs * 0.3), 'center'); c.globalAlpha = 1;
      } else if (f.k === 'ring') { c.strokeStyle = f.col; c.globalAlpha = 1 - k; c.lineWidth = 4; c.beginPath(); c.arc(p[0], p[1], cs * (0.3 + k * 1.2), 0, 7); c.stroke(); c.globalAlpha = 1; }
      else if (f.k === 'conf') { f.parts.forEach(function (q) { c.fillStyle = q[4]; c.save(); c.translate(p[0] + q[0] * k * cs * 3, p[1] + q[1] * k * cs * 3 + k * k * cs * 3); c.rotate(k * 10 * q[2]); c.fillRect(-4, -2, 8, 4); c.restore(); }); }
    });
  }
  function pointer(c, co, now) {
    var p = co.sig !== undefined ? (function () { var g = sigGeom(co.sig); return S(g.lx, g.ly); })() : S(co.x, co.y), b = Math.sin(now * 6) * cs * 0.15;
    c.save(); c.strokeStyle = 'rgba(255,255,255,.95)'; c.lineWidth = 4; c.beginPath(); c.arc(p[0], p[1], cs * 0.7 + Math.sin(now * 6) * 4, 0, 7); c.stroke();
    c.font = Math.round(cs * 0.75) + 'px system-ui,sans-serif'; c.textAlign = 'center'; c.textBaseline = 'top'; c.fillText('👆', p[0] + cs * 0.25, p[1] + cs * 0.3 + b); c.restore();
  }
  function boom(ui, x, y, now) { var parts = []; for (var i = 0; i < 26; i++) { var a = Math.random() * 7, v = 0.3 + Math.random(); parts.push([Math.cos(a) * v, Math.sin(a) * v, 0.06 + Math.random() * 0.12, 0, ['#ff922b', '#ffd43b', '#fa5252', '#868e96', '#495057'][i % 5]]); } ui.fx.push({ k: 'boom', x: x, y: y, t: now, life: 1.1, parts: parts }); }
  function confetti(ui, x, y, now) { var parts = []; for (var i = 0; i < 40; i++) { var a = Math.random() * 7, v = 0.3 + Math.random(); parts.push([Math.cos(a) * v, Math.sin(a) * v - 0.6, Math.random() - 0.5, 0, ['#ff6b6b', '#ffd43b', '#51cf66', '#339af0', '#cc5de8', '#fff'][i % 6]]); } ui.fx.push({ k: 'conf', x: x, y: y, t: now, life: 1.6, parts: parts }); }
  // tap -> nearest control
  function pick(sx, sy, st) {
    var best = null, bd = Math.max(30, cs * 0.85);
    map.controls.forEach(function (ct) {
      var ps = [];
      if (ct.k === 'w') { var n = map.nodes[ct.id]; ps.push(S(n.x, n.y)); }
      else { var g = sigGeom(ct.id); ps.push(S(g.lx, g.ly)); ps.push(S(g.q.x, g.q.y)); }
      ps.forEach(function (p) { var d = Math.hypot(p[0] - sx, p[1] - sy) * (ct.k === 's' ? 0.92 : 1); if (d < bd) { bd = d; best = ct; } });
    });
    return best;
  }
  function screenOf(x, y) { return S(x, y); }
  function sigPoint(ei) { var g = sigGeom(ei); return { x: g.lx, y: g.ly }; }
  return { setPad: setPad, init: init, resize: resize, setLevel: setLevel, draw: draw, pick: pick, boom: boom, confetti: confetti, screenOf: screenOf, sigPoint: sigPoint, cell: function () { return cs; }, isRot: function () { return rot; } };
})();

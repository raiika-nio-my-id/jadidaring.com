// Cukur Kekinian - canvas renderer: barbershop backdrop (wood, chrome mirror, neon, barber pole), customer, hair strands, guide chalk line, fx.
(function (G) {
  'use strict';
  var CK = G.CK, cv, c, CFG, PAL, W = 0, H = 0, DPR = 1, bg = null, L = { cx: 0, cy: 0, k: 100 }, T0 = 0;
  var parts = [], dust = [], fx = [], conf = [], trail = [], cursor = null, shake = 0, flash = 0;
  function init(canvas, cfg) { cv = canvas; c = cv.getContext('2d'); CFG = cfg; PAL = cfg.palette; }
  function layout(w, h, dpr, ins) {
    W = w; H = h; DPR = dpr; cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
    var top = ins && ins.top || 110, bot = ins && ins.bottom || 160, avail = Math.max(200, H - top - bot);
    var k = Math.max(60, Math.min(W * 0.26, avail / 3.1, 210)), extra = Math.max(0, avail - 3.1 * k);
    L = { cx: W / 2, cy: top + 2.05 * k + extra * 0.35, k: k, top: top, bot: bot }; bg = null;
  }
  function fx_(x) { return L.cx + x * L.k; } function fy_(y) { return L.cy + y * L.k; }
  function toHead(px, py) { return { x: (px - L.cx) / L.k, y: (py - L.cy) / L.k }; }
  function rr(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
  function shade(hex, f) { var n = parseInt(hex.slice(1), 16), r = n >> 16, g = n >> 8 & 255, b = n & 255; r = Math.round(f < 0 ? r * (1 + f) : r + (255 - r) * f); g = Math.round(f < 0 ? g * (1 + f) : g + (255 - g) * f); b = Math.round(f < 0 ? b * (1 + f) : b + (255 - b) * f); return 'rgb(' + r + ',' + g + ',' + b + ')'; }
  // ---------- static backdrop (cached) ----------
  function buildBg() {
    var o = document.createElement('canvas'); o.width = cv.width; o.height = cv.height; var g = o.getContext('2d'); g.setTransform(DPR, 0, 0, DPR, 0, 0);
    var wallG = g.createLinearGradient(0, 0, 0, H); wallG.addColorStop(0, '#1d3f4e'); wallG.addColorStop(1, '#10252f'); g.fillStyle = wallG; g.fillRect(0, 0, W, H);
    // wallpaper: barbershop diamond pattern
    g.strokeStyle = 'rgba(255,230,180,.055)'; g.lineWidth = 1; var s = 34;
    for (var x = -H; x < W + H; x += s) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x + H, H); g.moveTo(x, 0); g.lineTo(x - H, H); g.stroke(); }
    for (x = 0; x < W + s; x += s) for (var y = 0; y < H * 0.62; y += s) { g.fillStyle = 'rgba(255,214,140,.07)'; g.beginPath(); g.arc(x + ((y / s) % 2 ? s / 2 : 0), y, 1.6, 0, 7); g.fill(); }
    // warm wall lamps
    [[0.12, 0.2], [0.88, 0.2]].forEach(function (p) { var lx = W * p[0], ly = H * p[1], rg = g.createRadialGradient(lx, ly, 2, lx, ly, W * 0.35); rg.addColorStop(0, 'rgba(255,196,110,.42)'); rg.addColorStop(1, 'rgba(255,196,110,0)'); g.fillStyle = rg; g.fillRect(0, 0, W, H); g.fillStyle = '#ffe2a8'; g.beginPath(); g.arc(lx, ly, 6, 0, 7); g.fill(); g.fillStyle = '#6b4a2a'; g.fillRect(lx - 9, ly - 14, 18, 6); });
    // wood wainscot
    var wy = H * 0.6; var woodG = g.createLinearGradient(0, wy, 0, H); woodG.addColorStop(0, '#9b5d31'); woodG.addColorStop(1, '#5e3319'); g.fillStyle = woodG; g.fillRect(0, wy, W, H - wy);
    for (x = 0; x < W; x += 46) { g.fillStyle = 'rgba(40,18,6,.35)'; g.fillRect(x, wy, 2, H - wy); g.fillStyle = 'rgba(255,200,140,.08)'; g.fillRect(x + 3, wy, 6, H - wy); for (var q = 0; q < 3; q++) { g.strokeStyle = 'rgba(60,25,8,.18)'; g.beginPath(); var gx = x + 12 + q * 10; g.moveTo(gx, wy); g.bezierCurveTo(gx + 6, wy + 60, gx - 6, wy + 120, gx + 3, H); g.stroke(); } }
    g.fillStyle = '#c98a52'; g.fillRect(0, wy - 8, W, 10); g.fillStyle = '#7a4320'; g.fillRect(0, wy + 2, W, 4); g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(0, wy + 6, W, 8);
    // checker floor
    var fy = H - Math.min(120, H * 0.13); g.fillStyle = '#1a1a1e'; g.fillRect(0, fy, W, H - fy);
    for (var r = 0; r < 5; r++) { var y0 = fy + (H - fy) * Math.pow(r / 5, 1.3), y1 = fy + (H - fy) * Math.pow((r + 1) / 5, 1.3), ts = 26 + r * 10; for (x = -ts * 2, q = 0; x < W + ts; x += ts, q++) if ((q + r) % 2) { g.fillStyle = '#efe6d2'; g.beginPath(); var sk = (x - W / 2) * 0.08; g.moveTo(x + sk * r / 5, y0); g.lineTo(x + ts + sk * r / 5, y0); g.lineTo(x + ts + sk * (r + 1) / 5, y1); g.lineTo(x + sk * (r + 1) / 5, y1); g.fill(); } }
    g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(0, fy, W, 6);
    // shelf with pomade, tonic and spray on the left (and a plant on the right on wider screens)
    var shy = H * 0.57, shw = Math.min(W * 0.28, 210);
    g.fillStyle = '#6b3a1a'; g.fillRect(6, shy, shw, 8); g.fillStyle = 'rgba(0,0,0,.3)'; g.fillRect(6, shy + 8, shw, 5);
    var bx = 12, cols = ['#3df5ff', '#ff4fa3', '#ffe066', '#7cf29a', '#ff8a3d', '#b48cff'];
    for (var i = 0; bx < shw - 6; i++) { var bw = 12 + (i * 7) % 10, bh = 18 + (i * 13) % 26, col = cols[i % cols.length]; var bgr = g.createLinearGradient(bx, 0, bx + bw, 0); bgr.addColorStop(0, shade(col, -0.35)); bgr.addColorStop(0.5, col); bgr.addColorStop(1, shade(col, -0.5)); g.fillStyle = bgr; if (i % 3 === 1) { rr(g, bx, shy - 10, bw + 6, 10, 3); g.fill(); g.fillStyle = '#eee'; g.fillRect(bx, shy - 13, bw + 6, 3); bx += bw + 12; continue; } rr(g, bx, shy - bh, bw, bh, 3); g.fill(); g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(bx + 2, shy - bh + 3, 2, bh - 6); g.fillStyle = '#d8dde0'; g.fillRect(bx + bw / 2 - 2, shy - bh - 6, 4, 6); bx += bw + 6; }
    // big chrome mirror behind the chair
    var mw = Math.min(W - 24, L.k * 3.7), mh = L.k * 3.6, mx = L.cx - mw / 2, my = L.cy - L.k * 2.4;
    g.save(); g.shadowColor = 'rgba(0,0,0,.45)'; g.shadowBlur = 24; g.shadowOffsetY = 10; rr(g, mx - 9, my - 9, mw + 18, mh + 18, 28); var fr = g.createLinearGradient(mx, my, mx + mw, my + mh); fr.addColorStop(0, '#f4f7f9'); fr.addColorStop(0.35, '#8f9ca5'); fr.addColorStop(0.6, '#e8eef2'); fr.addColorStop(1, '#6f7d86'); g.fillStyle = fr; g.fill(); g.restore();
    rr(g, mx, my, mw, mh, 20); var gl = g.createLinearGradient(mx, my, mx + mw, my + mh); gl.addColorStop(0, '#2f6475'); gl.addColorStop(1, '#173643'); g.fillStyle = gl; g.fill();
    g.save(); rr(g, mx, my, mw, mh, 20); g.clip(); g.fillStyle = 'rgba(255,255,255,.07)'; for (i = 0; i < 3; i++) { g.beginPath(); var sx = mx + mw * (0.1 + i * 0.32); g.moveTo(sx, my); g.lineTo(sx + 40 + i * 14, my); g.lineTo(sx - 80 + i * 14, my + mh); g.lineTo(sx - 120, my + mh); g.fill(); }
    var rg2 = g.createRadialGradient(mx + mw * 0.8, my + 30, 4, mx + mw * 0.8, my + 30, mw * 0.5); rg2.addColorStop(0, 'rgba(255,220,160,.18)'); rg2.addColorStop(1, 'rgba(255,220,160,0)'); g.fillStyle = rg2; g.fillRect(mx, my, mw, mh); g.restore();
    // chrome screws
    [[mx + 10, my + 10], [mx + mw - 10, my + 10], [mx + 10, my + mh - 10], [mx + mw - 10, my + mh - 10]].forEach(function (p) { g.fillStyle = '#dfe6ea'; g.beginPath(); g.arc(p[0], p[1], 4, 0, 7); g.fill(); g.strokeStyle = '#7b8891'; g.beginPath(); g.moveTo(p[0] - 2, p[1] - 2); g.lineTo(p[0] + 2, p[1] + 2); g.stroke(); });
    // vignette
    var vg = g.createRadialGradient(W / 2, H * 0.45, Math.min(W, H) * 0.3, W / 2, H * 0.5, Math.max(W, H) * 0.8); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.5)'); g.fillStyle = vg; g.fillRect(0, 0, W, H);
    bg = o; L.mirror = { x: mx, y: my, w: mw, h: mh };
  }
  function neon(t) {
    var m = L.mirror, x = W - Math.max(26, W * 0.06), y = H * 0.36, fl = (Math.sin(t * 13) > 0.97 || Math.sin(t * 2.3 + 1) > 0.995) ? 0.35 : 1;
    // barber pole
    var ph = Math.min(H * 0.2, 170), pw = 16; c.save(); rr(c, x - pw / 2, y, pw, ph, 8); c.clip(); c.fillStyle = '#f5f5f5'; c.fillRect(x - pw / 2, y, pw, ph);
    var off = (t * 26) % 24; c.lineWidth = 6; for (var i = -4; i < ph / 12 + 4; i++) { c.strokeStyle = i % 2 ? '#e2343a' : '#2a5fd8'; c.beginPath(); c.moveTo(x - pw, y + i * 12 + off); c.lineTo(x + pw, y + i * 12 + off - 14); c.stroke(); }
    var sh = c.createLinearGradient(x - pw / 2, 0, x + pw / 2, 0); sh.addColorStop(0, 'rgba(0,0,0,.3)'); sh.addColorStop(0.4, 'rgba(255,255,255,.35)'); sh.addColorStop(1, 'rgba(0,0,0,.35)'); c.fillStyle = sh; c.fillRect(x - pw / 2, y, pw, ph); c.restore();
    c.fillStyle = '#cfd8dc'; rr(c, x - pw / 2 - 3, y - 8, pw + 6, 9, 4); c.fill(); rr(c, x - pw / 2 - 3, y + ph - 1, pw + 6, 9, 4); c.fill();
    // neon sign on the mirror top
    var fs = Math.max(16, Math.min(34, L.k * 0.26)), ny = m.y + fs * 1.1 + 6; if (ny < L.top - 4) ny = Math.max(ny, 0);
    c.save(); c.font = '900 ' + fs + 'px system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    var nx = m.x + m.w / 2, txt = 'CUKUR \u2702 KEKINIAN';
    c.globalAlpha = 0.9 * fl; c.shadowColor = PAL.neon[0]; c.shadowBlur = 18; c.strokeStyle = PAL.neon[0]; c.lineWidth = 3; c.strokeText(txt, nx, ny); c.fillStyle = '#ffd1ea'; c.fillText(txt, nx, ny);
    c.restore();
  }
  // ---------- customer + hair ----------
  function hairCol(who) { return PAL.hair[who && who.hair || 0]; }
  function skinCol(who) { return PAL.skin[who && who.skin != null ? who.skin : 1]; }
  function paths(strands, part, useT) { return strands.map(function (sd) { return CK.path(sd, useT ? sd.T : sd.L, part); }); }
  function strokeStrand(g, pts, k, ox, oy, w) {
    var n = pts.length / 2; if (n < 2) return; g.beginPath(); g.moveTo(ox + pts[0] * k, oy + pts[1] * k);
    for (var i = 1; i < n; i++) g.lineTo(ox + pts[i * 2] * k, oy + pts[i * 2 + 1] * k); g.lineWidth = w; g.stroke();
  }
  function massPath(g, list, ps, k, ox, oy) { // filled silhouette: scalp roots -> smooth curve through the tips -> back along the scalp
    if (list.length < 2) return false; var tips = list.map(function (i) { var p = ps[i].pts; return [ox + p[p.length - 2] * k, oy + p[p.length - 1] * k]; });
    var rts = list.map(function (i) { var p = ps[i].pts; return [ox + p[0] * 0.95 * k, oy + p[1] * 0.95 * k]; });
    g.beginPath(); g.moveTo(rts[0][0], rts[0][1]); g.lineTo(tips[0][0], tips[0][1]);
    for (var j = 1; j < tips.length; j++) { var mx = (tips[j - 1][0] + tips[j][0]) / 2, my = (tips[j - 1][1] + tips[j][1]) / 2; g.quadraticCurveTo(tips[j - 1][0], tips[j - 1][1], mx, my); }
    g.lineTo(tips[tips.length - 1][0], tips[tips.length - 1][1]); for (j = rts.length - 1; j >= 0; j--) g.lineTo(rts[j][0], rts[j][1]); g.closePath(); return true;
  }
  function hairPass(g, list, ps, k, ox, oy, col, wide, groups) {
    var w = k * 0.12, ol = shade(col[0], -0.4); g.lineCap = 'round'; g.lineJoin = 'round';
    groups = groups || [list];
    // dark outline, then base mass (fill + fat strokes), then fine strand texture and highlights
    g.strokeStyle = ol; list.forEach(function (i) { strokeStrand(g, ps[i].pts, k, ox, oy, w + Math.max(3, k * 0.035)); });
    groups.forEach(function (gr) { if (massPath(g, gr, ps, k, ox, oy)) { g.lineWidth = Math.max(3, k * 0.035); g.strokeStyle = ol; g.stroke(); } });
    g.fillStyle = col[0]; g.strokeStyle = col[0];
    groups.forEach(function (gr) { if (massPath(g, gr, ps, k, ox, oy)) g.fill(); });
    list.forEach(function (i) { strokeStrand(g, ps[i].pts, k, ox, oy, w); });
    var tw = Math.max(1, k * 0.022);
    g.strokeStyle = ol; g.globalAlpha = 0.45; list.forEach(function (i) { var p = ps[i].pts; if (p.length < 6) return; strokeStrand(g, p, k, ox + k * 0.03, oy + k * 0.01, tw); }); g.globalAlpha = 1;
    g.strokeStyle = col[1]; g.globalAlpha = 0.85; list.forEach(function (i) { var p = ps[i].pts, n = p.length / 2; if (n < 3) return; strokeStrand(g, p.slice(0, Math.max(4, Math.ceil(n * 0.75) * 2)), k, ox - k * 0.012, oy - k * 0.012, tw * 1.5); }); g.globalAlpha = 1;
    if (wide) { g.strokeStyle = col[2]; g.globalAlpha = 0.55; list.forEach(function (i, j) { if (j % 2) return; var p = ps[i].pts, n = p.length / 2; if (n < 4) return; strokeStrand(g, p.slice(2, Math.floor(n * 0.55) * 2), k, ox - k * 0.02, oy - k * 0.025, tw); }); g.globalAlpha = 1; }
  }
  function drawPerson(g, ox, oy, k, strands, o) {
    o = o || {}; var who = o.who, sk = skinCol(who), hc = hairCol(who), part = o.part, ps = paths(strands, part, o.useT), t = o.t || 0, mood = o.mood || 0;
    var front = [], nape = []; strands.forEach(function (sd, i) { (sd.z === 'nape' ? nape : front).push(i); });
    var X = function (x) { return ox + x * k; }, Y = function (y) { return oy + y * k; };
    if (!o.card) {
      // chair headrest + cape
      g.fillStyle = '#5a1418'; rr(g, X(-1.25), Y(0.95), 2.5 * k, 1.8 * k, 0.4 * k); g.fill(); g.fillStyle = '#7d1e24'; rr(g, X(-1.15), Y(1.0), 2.3 * k, 1.6 * k, 0.35 * k); g.fill();
      g.strokeStyle = 'rgba(255,255,255,.12)'; g.lineWidth = 2; for (var b = 0; b < 3; b++) { g.beginPath(); g.moveTo(X(-0.9 + b * 0.9), Y(1.1)); g.lineTo(X(-0.9 + b * 0.9), Y(2.4)); g.stroke(); }
    }
    var capeTop = o.card ? 1.22 : 1.12;
    g.beginPath(); g.moveTo(X(-0.3), Y(capeTop - 0.05)); g.bezierCurveTo(X(-1.2), Y(capeTop + 0.1), X(-1.75), Y(capeTop + 0.5), X(-1.9), Y(4)); g.lineTo(X(1.9), Y(4)); g.bezierCurveTo(X(1.75), Y(capeTop + 0.5), X(1.2), Y(capeTop + 0.1), X(0.3), Y(capeTop - 0.05)); g.closePath();
    var cg = g.createLinearGradient(X(-1.8), 0, X(1.8), 0); cg.addColorStop(0, '#162029'); cg.addColorStop(0.5, '#2a3a46'); cg.addColorStop(1, '#141c24'); g.fillStyle = o.card ? '#2a3a46' : cg; g.fill();
    if (!o.card) { g.save(); g.clip(); g.strokeStyle = 'rgba(61,245,255,.13)'; g.lineWidth = 2; for (b = -6; b <= 6; b++) { g.beginPath(); g.moveTo(X(b * 0.3), Y(capeTop)); g.quadraticCurveTo(X(b * 0.36), Y(2.4), X(b * 0.5), Y(4)); g.stroke(); } g.restore(); }
    // nape hair lies on the cape, behind the neck
    hairPass(g, nape, ps, k, ox, oy, hc, !o.card, [nape.filter(function (i) { return strands[i].th < 0; }), nape.filter(function (i) { return strands[i].th > 0; })]);
    // neck
    var ng = g.createLinearGradient(X(-0.35), 0, X(0.35), 0); ng.addColorStop(0, sk[1]); ng.addColorStop(0.5, sk[0]); ng.addColorStop(1, sk[1]); g.fillStyle = ng; g.fillRect(X(-0.34), Y(0.6), 0.68 * k, (capeTop + 0.05 - 0.6) * k);
    g.fillStyle = 'rgba(0,0,0,.12)'; g.fillRect(X(-0.34), Y(0.82), 0.68 * k, 0.12 * k);
    g.fillStyle = '#f4f1ea'; g.beginPath(); g.ellipse(X(0), Y(capeTop), 0.45 * k, 0.11 * k, 0, 0, 7); g.fill(); g.strokeStyle = 'rgba(0,0,0,.15)'; g.lineWidth = 1; g.stroke();
    // ears
    [-1, 1].forEach(function (s) { g.fillStyle = sk[1]; g.beginPath(); g.ellipse(X(s * 0.86), Y(0.16), 0.13 * k, 0.21 * k, s * 0.15, 0, 7); g.fill(); g.fillStyle = shade(sk[1], -0.18); g.beginPath(); g.ellipse(X(s * 0.88), Y(0.17), 0.06 * k, 0.12 * k, s * 0.15, 0, 7); g.fill(); });
    // head
    var hg = g.createRadialGradient(X(-0.25), Y(-0.3), 0.1 * k, X(0), Y(0.1), 1.1 * k); hg.addColorStop(0, shade(sk[0], 0.12)); hg.addColorStop(0.7, sk[0]); hg.addColorStop(1, sk[1]); g.fillStyle = hg;
    g.beginPath(); g.ellipse(X(0), Y(0), CK.RX * k, CK.RY * k, 0, 0, 7); g.fill();
    // stubble shadow on scalp where hair is short, shine when bald
    var sumL = 0; front.forEach(function (i) { sumL += o.useT ? strands[i].T : strands[i].L; });
    g.lineCap = 'round';
    front.forEach(function (i) { var sd = strands[i], Lh = o.useT ? sd.T : sd.L; if (Lh > 0.7) return; var r0 = CK.root(sd.th), r1 = CK.root(sd.th + 5); if (sd.th >= 100) return; g.strokeStyle = hc[0]; g.globalAlpha = 0.12 + Math.min(1, Lh / 0.7) * 0.6; g.lineWidth = k * (0.07 + Lh * 0.12); g.beginPath(); g.moveTo(X(r0.x * 0.985), Y(r0.y * 0.985)); g.lineTo(X(r1.x * 0.985), Y(r1.y * 0.985)); g.stroke(); });
    g.globalAlpha = 1;
    if (sumL / front.length < 0.25) { g.fillStyle = 'rgba(255,255,255,' + (0.35 - sumL) + ')'; g.beginPath(); g.ellipse(X(-0.28), Y(-0.68), 0.22 * k, 0.1 * k, -0.5, 0, 7); g.fill(); if (!o.card && o.shine) { var tw = (Math.sin(t * 5) + 1) / 2; star4(g, X(-0.38), Y(-0.74), k * 0.1 * tw, '#fff'); star4(g, X(0.3), Y(-0.85), k * 0.07 * (1 - tw), '#fff'); } }
    face(g, X, Y, k, sk, hc, who, mood, o);
    // front hair (base under, highlight over)
    hairPass(g, front, ps, k, ox, oy, hc, !o.card);
    if (o.hits) { g.strokeStyle = 'rgba(255,255,255,.7)'; front.concat(nape).forEach(function (i) { if (strands[i].hit > 0.05) { g.globalAlpha = strands[i].hit * 0.8; strokeStrand(g, ps[i].pts, k, ox, oy, k * 0.05); } }); g.globalAlpha = 1; }
    return ps;
  }
  function face(g, X, Y, k, sk, hc, who, mood, o) {
    var t = o.t || 0, blink = o.card ? 1 : (Math.sin(t * 1.3 + (who && who.name ? who.name.length : 0)) > 0.985 ? 0.1 : 1), shock = o.react === 'shock', look = o.look || { x: 0, y: 0 };
    // cheeks
    if (mood > 0.3 || o.card) { g.fillStyle = 'rgba(255,110,110,' + (o.card ? 0.25 : 0.12 + mood * 0.2) + ')'; [-1, 1].forEach(function (s) { g.beginPath(); g.ellipse(X(s * 0.5), Y(0.42), 0.13 * k, 0.08 * k, 0, 0, 7); g.fill(); }); }
    // eyes
    [-1, 1].forEach(function (s) {
      var ex = X(s * 0.32), ey = Y(0.14); g.fillStyle = '#fff'; g.beginPath(); g.ellipse(ex, ey, 0.13 * k, (shock ? 0.13 : 0.095) * k * blink, 0, 0, 7); g.fill();
      if (blink > 0.5) { var lx = Math.max(-1, Math.min(1, look.x)) * 0.05 * k, ly = Math.max(-1, Math.min(1, look.y)) * 0.03 * k; g.fillStyle = '#2a1a12'; g.beginPath(); g.arc(ex + lx, ey + ly, (shock ? 0.045 : 0.06) * k, 0, 7); g.fill(); g.fillStyle = '#fff'; g.beginPath(); g.arc(ex + lx + 0.02 * k, ey + ly - 0.02 * k, 0.018 * k, 0, 7); g.fill(); }
      // brows
      var lift = shock ? -0.08 : mood < -0.3 ? 0.03 : 0, tilt = mood < -0.3 ? 0.06 : mood > 0.5 ? -0.02 : 0;
      g.strokeStyle = hc[0]; g.lineWidth = 0.055 * k; g.lineCap = 'round'; g.beginPath(); g.moveTo(X(s * 0.18), Y(-0.04 + lift + tilt)); g.quadraticCurveTo(X(s * 0.32), Y(-0.1 + lift), X(s * 0.46), Y(-0.03 + lift - tilt * 0.5)); g.stroke();
    });
    // nose
    g.strokeStyle = shade(sk[1], -0.15); g.lineWidth = 0.035 * k; g.beginPath(); g.moveTo(X(0.02), Y(0.22)); g.quadraticCurveTo(X(0.1), Y(0.38), X(-0.03), Y(0.4)); g.stroke();
    // mustache
    if (who && who.stache) { g.fillStyle = hc[0]; g.beginPath(); g.moveTo(X(-0.25), Y(0.55)); g.quadraticCurveTo(X(0), Y(0.43), X(0.25), Y(0.55)); g.quadraticCurveTo(X(0), Y(0.5), X(-0.25), Y(0.55)); g.fill(); }
    // mouth
    var my = Y(0.62); g.strokeStyle = '#7a2e22'; g.lineWidth = 0.04 * k;
    if (shock) { g.fillStyle = '#5a1a14'; g.beginPath(); g.ellipse(X(0), my + 0.02 * k, 0.08 * k, 0.1 * k, 0, 0, 7); g.fill(); }
    else if (mood > 0.75 || o.card) { g.fillStyle = '#5a1a14'; g.beginPath(); g.moveTo(X(-0.22), my - 0.02 * k); g.quadraticCurveTo(X(0), my + 0.24 * k, X(0.22), my - 0.02 * k); g.closePath(); g.fill(); g.fillStyle = '#fff'; g.fillRect(X(-0.16), my - 0.01 * k, 0.32 * k, 0.05 * k); }
    else { var cur = Math.max(-1, Math.min(1, mood)) * 0.12; g.beginPath(); g.moveTo(X(-0.17), my - cur * 0.3 * k); g.quadraticCurveTo(X(0), my + cur * k, X(0.17), my - cur * 0.3 * k); g.stroke(); }
    if (o.sweat) { var sy = Y(-0.2 + ((t * 0.6) % 1) * 0.4); g.fillStyle = 'rgba(120,200,255,.9)'; g.beginPath(); g.moveTo(X(0.66), sy - 0.08 * k); g.quadraticCurveTo(X(0.72), sy + 0.02 * k, X(0.66), sy + 0.04 * k); g.quadraticCurveTo(X(0.6), sy + 0.02 * k, X(0.66), sy - 0.08 * k); g.fill(); }
  }
  function star4(g, x, y, r, col) { if (r <= 0.5) return; g.fillStyle = col; g.beginPath(); g.moveTo(x, y - r); g.quadraticCurveTo(x, y, x + r, y); g.quadraticCurveTo(x, y, x, y + r); g.quadraticCurveTo(x, y, x - r, y); g.quadraticCurveTo(x, y, x, y - r); g.fill(); }
  function guide(S, t) {
    var k = L.k, ox = L.cx, oy = L.cy, part = S.style.part, ends = { f: [], l: [], r: [] };
    S.strands.forEach(function (sd) { var p = CK.path(sd, sd.T, part).pts, e = [ox + p[p.length - 2] * k, oy + p[p.length - 1] * k]; (sd.z !== 'nape' ? ends.f : sd.th < 0 ? ends.l : ends.r).push(e); });
    ends.l.reverse(); var lines = [ends.l.concat(ends.f.length ? [ends.f[0]] : []), ends.f, (ends.f.length ? [ends.f[ends.f.length - 1]] : []).concat(ends.r)];
    c.save(); c.lineCap = 'round'; c.lineJoin = 'round';
    lines.forEach(function (ln) { if (ln.length < 2) return; c.beginPath(); c.moveTo(ln[0][0], ln[0][1]); for (var i = 1; i < ln.length; i++) c.lineTo(ln[i][0], ln[i][1]); c.setLineDash([]); c.strokeStyle = 'rgba(10,20,30,.45)'; c.lineWidth = 5; c.stroke(); c.setLineDash([7, 7]); c.lineDashOffset = -t * 18; c.strokeStyle = 'rgba(255,255,255,.92)'; c.lineWidth = 2.5; c.stroke(); });
    c.restore();
  }
  // ---------- fx ----------
  function event(S, e, who) {
    if (e.e === 'cut') {
      var sd = S.strands[e.i], p = CK.path(sd, e.from, S.style.part), q = p.pts, k0 = p.step ? Math.floor(e.to / p.step) : 0, piece = q.slice(k0 * 2);
      if (piece.length >= 4 && (e.tool === 'scissors' || Math.random() < 0.35)) {
        var mx = piece[0], my = piece[1], rel = []; for (var i = 0; i < piece.length; i += 2) rel.push(piece[i] - mx, piece[i + 1] - my);
        parts.push({ x: L.cx + mx * L.k, y: L.cy + my * L.k, vx: (Math.random() - 0.5) * 60 + (sd.th > 0 ? 30 : -30), vy: -30 - Math.random() * 40, a: 0, va: (Math.random() - 0.5) * 4, rel: rel, life: 3, col: hairCol(who)[0] });
        if (parts.length > 120) parts.shift();
      }
      if (e.tool === 'clipper') for (i = 0; i < 2; i++) dust.push({ x: L.cx + q[q.length - 2] * L.k + (Math.random() - 0.5) * 10, y: L.cy + q[q.length - 1] * L.k, vx: (Math.random() - 0.5) * 140, vy: -Math.random() * 90, life: 0.7 + Math.random() * 0.5, col: hairCol(who)[0] });
      if (dust.length > 260) dust.splice(0, dust.length - 260);
    }
    if (e.e === 'over') { shake = 0.35; }
  }
  function burst(x, y, n, cols, sp) { for (var i = 0; i < n; i++) { var a = Math.random() * 6.283, v = (sp || 160) * (0.4 + Math.random()); fx.push({ x: x, y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 40, life: 0.8 + Math.random() * 0.5, r: 2 + Math.random() * 3, col: cols[i % cols.length] }); } }
  function confetti(n) { var cols = ['#ff4fa3', '#3df5ff', '#ffe066', '#7cf29a', '#ff8a3d', '#ffffff']; for (var i = 0; i < (n || 140); i++) conf.push({ x: Math.random() * W, y: -20 - Math.random() * H * 0.4, vx: (Math.random() - 0.5) * 60, vy: 80 + Math.random() * 120, a: Math.random() * 6, va: (Math.random() - 0.5) * 9, w: 6 + Math.random() * 6, h: 3 + Math.random() * 5, col: cols[i % cols.length], life: 5 }); }
  function sparkle() { burst(L.cx, L.cy - L.k * 0.6, 26, ['#ffffff', '#ffe066', '#3df5ff'], 220); }
  function setCursor(cu) { cursor = cu; }
  function addTrail(x, y) { trail.push({ x: x, y: y, life: 0.35 }); if (trail.length > 30) trail.shift(); }
  function flashOn() { flash = 1; }
  function clear() { parts.length = 0; dust.length = 0; fx.length = 0; trail.length = 0; }
  function drawScissors(x, y, open, ang) {
    c.save(); c.translate(x, y); c.rotate(ang); var s = Math.max(0.8, L.k / 110), a = open * 0.35;
    [-1, 1].forEach(function (d) { c.save(); c.rotate(d * a); var bl = c.createLinearGradient(0, -4 * s, 0, 4 * s); bl.addColorStop(0, '#ffffff'); bl.addColorStop(1, '#8c9aa3'); c.fillStyle = bl; c.strokeStyle = '#3a4650'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(0, 0); c.lineTo(-46 * s, -d * 3 * s); c.lineTo(-48 * s, 0); c.lineTo(0, d * 4 * s); c.closePath(); c.fill(); c.stroke(); c.strokeStyle = d > 0 ? '#ff4fa3' : '#3df5ff'; c.lineWidth = 5 * s; c.beginPath(); c.ellipse(16 * s, d * 9 * s, 9 * s, 6 * s, 0, 0, 7); c.stroke(); c.restore(); });
    c.fillStyle = '#3a4650'; c.beginPath(); c.arc(0, 0, 3 * s, 0, 7); c.fill(); c.restore();
  }
  function drawClipper(x, y, on, t) {
    var s = Math.max(0.8, L.k / 110), j = on ? Math.sin(t * 90) * 1.2 : 0; c.save(); c.translate(x + j, y - 6 * s);
    var bd = c.createLinearGradient(-14 * s, 0, 14 * s, 0); bd.addColorStop(0, '#1f2a33'); bd.addColorStop(0.5, '#3d4d59'); bd.addColorStop(1, '#141c22'); c.fillStyle = bd; rr(c, -13 * s, -6 * s, 26 * s, 58 * s, 9 * s); c.fill();
    c.fillStyle = '#ffe066'; rr(c, -9 * s, 10 * s, 18 * s, 6 * s, 3 * s); c.fill(); c.fillStyle = on ? '#7cf29a' : '#556'; c.beginPath(); c.arc(0, 26 * s, 3 * s, 0, 7); c.fill();
    var ch = c.createLinearGradient(-15 * s, 0, 15 * s, 0); ch.addColorStop(0, '#9aa7b0'); ch.addColorStop(0.5, '#f4f7f9'); ch.addColorStop(1, '#7d8a93'); c.fillStyle = ch; rr(c, -15 * s, -14 * s, 30 * s, 10 * s, 3 * s); c.fill();
    c.fillStyle = '#5b6770'; for (var i = 0; i < 7; i++) c.fillRect(-13 * s + i * 4 * s, -18 * s, 2 * s, 5 * s); c.restore();
  }
  // ---------- frame ----------
  function draw(S, ui, dt) {
    var t = (T0 += dt); if (!bg) buildBg(); c.setTransform(1, 0, 0, 1, 0, 0); c.drawImage(bg, 0, 0); c.setTransform(DPR, 0, 0, DPR, 0, 0);
    neon(t);
    if (!S) return; var sx = 0, sy = 0; if (shake > 0) { shake -= dt; sx = (Math.random() - 0.5) * 8 * shake / 0.35; sy = (Math.random() - 0.5) * 6 * shake / 0.35; }
    var bob = Math.sin(t * 1.6) * L.k * 0.008; c.save(); c.translate(sx, sy + bob);
    var who = ui.who, look = cursor ? { x: (cursor.x - L.cx) / (L.k * 1.5), y: (cursor.y - L.cy) / (L.k * 1.5) } : { x: Math.sin(t * 0.7) * 0.4, y: 0 };
    var sc = ui.enter < 1 ? 0.9 + 0.1 * ui.enter : 1; if (sc !== 1) { c.translate(L.cx, L.cy + L.k); c.scale(sc, sc); c.translate(-L.cx, -L.cy - L.k); c.globalAlpha = Math.max(0, ui.enter); }
    drawPerson(c, L.cx, L.cy, L.k, S.strands, { who: who, part: S.style.part, t: t, mood: ui.mood, react: ui.react, look: look, sweat: ui.sweat, hits: true, shine: S.style.id === 'botak' && ui.pct > 80 });
    c.globalAlpha = 1;
    if (ui.guide) guide(S, t);
    c.restore();
    // falling hair pieces, clipper dust, bursts
    var floor = H - Math.min(120, H * 0.13) + 10; c.lineCap = 'round';
    for (var i = parts.length - 1; i >= 0; i--) { var p = parts[i]; p.vy += 260 * dt; p.vx *= 0.99; if (p.y > floor + Math.random() * 30) { p.vy = 0; p.vx *= 0.8; p.va = 0; } else { p.a += p.va * dt; } p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt; if (p.life <= 0) { parts.splice(i, 1); continue; }
      c.save(); c.globalAlpha = Math.min(1, p.life); c.translate(p.x, p.y); c.rotate(p.a); c.strokeStyle = p.col; c.lineWidth = L.k * 0.07; c.beginPath(); c.moveTo(0, 0); for (var j = 2; j < p.rel.length; j += 2) c.lineTo(p.rel[j] * L.k, p.rel[j + 1] * L.k); c.stroke(); c.restore(); }
    for (i = dust.length - 1; i >= 0; i--) { var d = dust[i]; d.vy += 300 * dt; d.x += d.vx * dt; d.y += d.vy * dt; d.life -= dt; if (d.life <= 0) { dust.splice(i, 1); continue; } c.globalAlpha = Math.min(1, d.life * 2); c.fillStyle = d.col; c.fillRect(d.x, d.y, 2.5, 2.5); }
    for (i = fx.length - 1; i >= 0; i--) { var f = fx[i]; f.vy += 200 * dt; f.x += f.vx * dt; f.y += f.vy * dt; f.life -= dt; if (f.life <= 0) { fx.splice(i, 1); continue; } c.globalAlpha = Math.min(1, f.life * 1.5); star4(c, f.x, f.y, f.r * 2, f.col); }
    c.globalAlpha = 1;
    // scissors swipe trail
    for (i = trail.length - 1; i >= 0; i--) { trail[i].life -= dt; if (trail[i].life <= 0) trail.splice(i, 1); }
    if (trail.length > 1) { c.strokeStyle = 'rgba(255,255,255,.75)'; c.lineWidth = 3; c.beginPath(); c.moveTo(trail[0].x, trail[0].y); for (i = 1; i < trail.length; i++) c.lineTo(trail[i].x, trail[i].y); c.stroke(); }
    // tool cursor
    if (cursor) {
      if (cursor.tool === 'clipper') { var br = CK.BRUSH * L.k; c.strokeStyle = cursor.scalp ? 'rgba(124,242,154,.9)' : 'rgba(255,255,255,.5)'; c.setLineDash([5, 5]); c.lineWidth = 2.5; c.beginPath(); c.arc(cursor.x, cursor.y, br, 0, 7); c.stroke(); c.setLineDash([]); drawClipper(cursor.x, cursor.y, cursor.down, t); }
      else drawScissors(cursor.x + 6, cursor.y - 6, cursor.snap > 0 ? 0.1 : 1, -0.6);
      if (cursor.snap > 0) cursor.snap -= dt;
    }
    for (i = conf.length - 1; i >= 0; i--) { var q = conf[i]; q.x += q.vx * dt + Math.sin(t * 3 + i) * 0.6; q.y += q.vy * dt; q.a += q.va * dt; q.life -= dt; if (q.life <= 0 || q.y > H + 20) { conf.splice(i, 1); continue; } c.save(); c.translate(q.x, q.y); c.rotate(q.a); c.fillStyle = q.col; c.fillRect(-q.w / 2, -q.h / 2, q.w, q.h * Math.abs(Math.cos(q.a * 1.3))); c.restore(); }
    if (flash > 0) { c.fillStyle = 'rgba(255,255,255,' + flash * 0.8 + ')'; c.fillRect(0, 0, W, H); flash -= dt * 2.2; }
  }
  // the customer's style photo (polaroid) on a little canvas
  function drawCard(cvs, style, who) {
    var g = cvs.getContext('2d'), w = cvs.width, h = cvs.height; g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, w, h);
    var bgG = g.createLinearGradient(0, 0, w, h); bgG.addColorStop(0, '#ffb3d6'); bgG.addColorStop(1, '#7fe7f2'); g.fillStyle = bgG; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(255,255,255,.25)'; for (var i = 0; i < 6; i++) { g.beginPath(); g.arc(w * (i / 5), h * 0.2 + (i % 2) * 10, w * 0.18, 0, 7); g.fill(); }
    var fake = CK.create({ cfg: CFG, style: style, seed: 'card' }).strands; var k = Math.min(w / 4.2, h / 4.3);
    g.save(); g.beginPath(); g.rect(0, 0, w, h); g.clip(); drawPerson(g, w / 2, h * 0.46, k, fake, { who: who, part: style.part, useT: true, card: true, mood: 1 }); g.restore();
  }
  G.CKR = { init: init, layout: layout, draw: draw, toHead: toHead, event: event, burst: burst, confetti: confetti, sparkle: sparkle, setCursor: setCursor, addTrail: addTrail, flash: flashOn, clear: clear, drawCard: drawCard, get L() { return L; }, fx: fx_, fy: fy_ };
})(window);

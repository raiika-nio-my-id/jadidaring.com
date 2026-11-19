// Pawang Hujan - canvas renderer: horizon sky, aerial forest/peat map, fire + smoke, clouds + rain, rainbow, lightning, pawang foreground.
(function (G) {
  'use strict';
  var cv, ctx, CFG, PAL, L = { w: 1, h: 1, dpr: 1, ox: 0, oy: 0, ts: 40, top: 0, bot: 0 }, terrain = null, mapKey = null;
  var parts = [], drops = [], bolts = [], pops = [], flash = 0, shake = 0, rbT = 0, sprites = {}, lastRainbowMult = 1, T = 0;
  var ELEV = 0.62; // cloud body height above its ground shadow, in tiles
  function mk(w, h) { var c = document.createElement('canvas'); c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h)); return c; }
  function hash(x, y, s) { var h = (x * 374761393 + y * 668265263 + (s || 0) * 982451653) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
  function blob(col) {
    if (sprites['b' + col]) return sprites['b' + col];
    var c = mk(64, 64), g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, col); gr.addColorStop(0.55, col.replace(/,[\d.]+\)$/, ',0.55)')); gr.addColorStop(1, col.replace(/,[\d.]+\)$/, ',0)'));
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return (sprites['b' + col] = c);
  }
  function glowSprite() {
    if (sprites.glow) return sprites.glow; var c = mk(128, 128), g = c.getContext('2d'), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, 'rgba(255,230,140,0.95)'); gr.addColorStop(0.25, 'rgba(255,150,40,0.7)'); gr.addColorStop(0.6, 'rgba(255,70,20,0.25)'); gr.addColorStop(1, 'rgba(255,40,0,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128); return (sprites.glow = c);
  }
  // Puffy cartoon cloud sprite; tone: light (empty), rain (blue-grey), storm (slate purple)
  function cloudSprite(tone) {
    if (sprites['c' + tone]) return sprites['c' + tone];
    var W = 240, H = 170, c = mk(W, H), g = c.getContext('2d');
    var top = { light: '#ffffff', rain: '#eef4fb', storm: '#8d8fb8' }[tone], mid = { light: '#f1f5fa', rain: '#b9c8da', storm: '#5d5f8c' }[tone], bot = { light: '#d4dde8', rain: '#7f93ad', storm: '#3a3a63' }[tone];
    var puffs = [[60, 100, 42], [100, 76, 52], [150, 72, 48], [188, 100, 40], [124, 110, 50], [80, 120, 34], [168, 122, 34]];
    g.save(); g.shadowColor = 'rgba(0,0,0,0.18)'; g.shadowBlur = 10; g.shadowOffsetY = 6;
    puffs.forEach(function (p) { g.beginPath(); g.arc(p[0], p[1], p[2], 0, Math.PI * 2); g.fillStyle = bot; g.fill(); });
    g.restore();
    puffs.forEach(function (p) { var gr = g.createLinearGradient(0, p[1] - p[2], 0, p[1] + p[2]); gr.addColorStop(0, top); gr.addColorStop(0.55, mid); gr.addColorStop(1, bot); g.beginPath(); g.arc(p[0], p[1] - 3, p[2] - 3, 0, Math.PI * 2); g.fillStyle = gr; g.fill(); });
    g.globalAlpha = tone === 'storm' ? 0.25 : 0.7; g.fillStyle = '#fff';
    [[92, 62, 22], [146, 56, 18], [62, 88, 12]].forEach(function (p) { g.beginPath(); g.ellipse(p[0], p[1], p[2], p[2] * 0.6, -0.4, 0, Math.PI * 2); g.fill(); });
    return (sprites['c' + tone] = c);
  }
  function layout(w, h, dpr) {
    var safeT = 0, safeB = 0; L.w = w; L.h = h; L.dpr = dpr;
    var top = 104 + safeT, bot = 120 + safeB, availW = w - 12, availH = h - top - bot;
    var W = PH.D.W, H = PH.D.H, ts = Math.max(20, Math.min(availW / W, availH / H, 92));
    L.ts = ts; L.ox = Math.round((w - ts * W) / 2); L.oy = Math.round(top + (availH - ts * H) / 2 + 4); L.top = top; L.bot = bot;
    cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); mapKey = null;
  }
  function fx(x) { return L.ox + x * L.ts; } function fy(y) { return L.oy + y * L.ts; }
  function toField(px, py) { return { x: (px - L.ox) / L.ts, y: (py - L.oy) / L.ts }; }
  // ---------- terrain prerender ----------
  function tileKind(s, gx, gy) {
    var W = s.P.W, H = s.P.H; if (gx >= 0 && gy >= 0 && gx < W && gy < H) return s.t[gy * W + gx].k;
    var cy = Math.max(0, Math.min(H - 1, gy)), row = s.t.slice(cy * W, cy * W + W), rx = -1; row.forEach(function (c) { if (c.k === 'r') rx = c.x; });
    if (gx === rx && (gy < 0 || gy >= H)) return 'r';
    return hash(gx, gy, 7) < 0.45 ? 'p' : 'f';
  }
  function buildTerrain(s) {
    var dpr = L.dpr, c = mk(L.w * dpr, L.h * dpr), g = c.getContext('2d'), ts = L.ts; g.scale(dpr, dpr);
    var gx0 = Math.floor(-L.ox / ts) - 1, gx1 = Math.ceil((L.w - L.ox) / ts) + 1, gy0 = Math.floor((L.top - 40 - L.oy) / ts) - 1, gy1 = Math.ceil((L.h - L.oy) / ts) + 1;
    var crowns = [], river = {};
    for (var gy = gy0; gy <= gy1; gy++) for (var gx = gx0; gx <= gx1; gx++) {
      var k = tileKind(s, gx, gy), x = fx(gx), y = fy(gy), i;
      g.fillStyle = k === 'f' ? '#2b6e35' : k === 'p' ? '#6a5530' : k === 'r' ? '#c9b27a' : '#7fbf5a'; g.fillRect(x - 0.5, y - 0.5, ts + 1, ts + 1);
      for (i = 0; i < 5; i++) { var bx = x + hash(gx, gy, i) * ts, by = y + hash(gy, gx, i + 3) * ts; g.globalAlpha = 0.18; g.fillStyle = k === 'p' ? '#4f3f22' : k === 'f' ? '#1f5a2a' : '#a9d27a'; g.beginPath(); g.arc(bx, by, ts * (0.12 + hash(gx, gy, i + 9) * 0.2), 0, 6.3); g.fill(); g.globalAlpha = 1; }
      if (k === 'f') for (i = 0; i < 6; i++) crowns.push([x + (0.12 + hash(gx, gy, i + 20) * 0.76) * ts, y + (0.12 + hash(gx, gy, i + 40) * 0.76) * ts, ts * (0.2 + hash(gx, gy, i + 60) * 0.13), PAL.forest[Math.floor(hash(gx, gy, i + 80) * PAL.forest.length)]]);
      if (k === 'p') {
        g.strokeStyle = 'rgba(40,30,15,0.55)'; g.lineWidth = Math.max(1.5, ts * 0.05);
        if (hash(gx, gy, 5) < 0.5) { g.beginPath(); g.moveTo(x, y + ts * (0.3 + hash(gx, gy, 6) * 0.4)); g.lineTo(x + ts, y + ts * (0.3 + hash(gx, gy, 6) * 0.4)); g.stroke(); g.strokeStyle = 'rgba(90,130,150,0.35)'; g.lineWidth *= 0.4; g.stroke(); }
        for (i = 0; i < 9; i++) { var tx = x + hash(gx, gy, i + 100) * ts, ty = y + hash(gx, gy, i + 120) * ts; g.strokeStyle = i % 2 ? '#8a7a3a' : '#9c9447'; g.lineWidth = 1.4; g.beginPath(); g.moveTo(tx, ty); g.lineTo(tx - 2, ty - ts * 0.08); g.moveTo(tx, ty); g.lineTo(tx + 2, ty - ts * 0.09); g.stroke(); }
        for (i = 0; i < 2; i++) crowns.push([x + hash(gx, gy, i + 140) * ts, y + hash(gx, gy, i + 150) * ts, ts * 0.11, '#5b7a35']);
      }
      if (k === 'r') river[gx + ',' + gy] = [x + ts / 2, y + ts / 2];
      if (k === 'v') {
        g.fillStyle = '#d8c48f'; g.fillRect(x + ts * 0.45, y, ts * 0.1, ts);
        [[0.12, 0.14, 0.32, 0.26], [0.58, 0.2, 0.3, 0.24], [0.16, 0.58, 0.28, 0.24], [0.6, 0.6, 0.3, 0.26]].forEach(function (h, j) {
          var hx = x + h[0] * ts, hy = y + h[1] * ts, hw = h[2] * ts, hh = h[3] * ts;
          g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(hx + 3, hy + 4, hw, hh);
          var gr = g.createLinearGradient(hx, hy, hx, hy + hh); gr.addColorStop(0, PAL.roof[j % 3]); gr.addColorStop(0.5, PAL.roof[(j + 1) % 3]); gr.addColorStop(0.51, '#8f3a1e'); gr.addColorStop(1, PAL.roof[j % 3]);
          g.fillStyle = gr; g.fillRect(hx, hy, hw, hh); g.strokeStyle = 'rgba(255,230,190,0.6)'; g.lineWidth = 1; g.beginPath(); g.moveTo(hx, hy + hh / 2); g.lineTo(hx + hw, hy + hh / 2); g.stroke();
        });
        crowns.push([x + ts * 0.86, y + ts * 0.46, ts * 0.12, '#4fa852']);
      }
    }
    // river as one winding ribbon
    var cols = {}; Object.keys(river).forEach(function (k) { var p = k.split(','); cols[+p[1]] = river[k]; });
    var rows = Object.keys(cols).map(Number).sort(function (a, b) { return a - b; });
    if (rows.length) {
      var path = function () { g.beginPath(); g.moveTo(cols[rows[0]][0], cols[rows[0]][1] - ts); for (var r = 0; r < rows.length; r++) { var p = cols[rows[r]], q = cols[rows[r + 1]]; if (q) g.quadraticCurveTo(p[0], p[1], (p[0] + q[0]) / 2, (p[1] + q[1]) / 2); else g.lineTo(p[0], p[1] + ts); } };
      g.lineCap = 'round'; g.lineJoin = 'round';
      path(); g.strokeStyle = '#d8c48f'; g.lineWidth = ts * 0.78; g.stroke();
      path(); g.strokeStyle = PAL.river[0]; g.lineWidth = ts * 0.58; g.stroke();
      path(); g.strokeStyle = PAL.river[1]; g.lineWidth = ts * 0.26; g.globalAlpha = 0.55; g.stroke(); g.globalAlpha = 1;
    }
    crowns.sort(function (a, b) { return a[1] - b[1]; }).forEach(function (cr) {
      g.fillStyle = 'rgba(10,30,12,0.35)'; g.beginPath(); g.ellipse(cr[0] + cr[2] * 0.25, cr[1] + cr[2] * 0.35, cr[2], cr[2] * 0.85, 0, 0, 6.3); g.fill();
      var gr = g.createRadialGradient(cr[0] - cr[2] * 0.35, cr[1] - cr[2] * 0.4, cr[2] * 0.1, cr[0], cr[1], cr[2]); gr.addColorStop(0, '#9ad66a'); gr.addColorStop(0.35, cr[3]); gr.addColorStop(1, '#1d4f25');
      g.fillStyle = gr; g.beginPath(); g.arc(cr[0], cr[1], cr[2], 0, 6.3); g.fill();
    });
    // darken the decorative surroundings, soft frame around the playable land
    g.save(); g.fillStyle = 'rgba(8,24,16,0.42)'; g.beginPath(); g.rect(0, 0, L.w, L.h); g.rect(fx(0), fy(0), ts * s.P.W, ts * s.P.H); g.fill('evenodd'); g.restore();
    g.strokeStyle = 'rgba(255,240,200,0.35)'; g.lineWidth = 2; g.setLineDash([6, 6]); g.strokeRect(fx(0) - 1, fy(0) - 1, ts * s.P.W + 2, ts * s.P.H + 2); g.setLineDash([]);
    return c;
  }
  // ---------- particles ----------
  function add(p) { if (parts.length < 520) parts.push(p); }
  function burst(x, y, n, o) { for (var i = 0; i < n; i++) { var a = Math.random() * 6.28, v = (o.v || 40) * (0.4 + Math.random()); add({ k: o.k, x: x, y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v + (o.vy || 0), life: o.life || 1, t: 0, s: o.s || 6, col: o.col, g: o.g || 0 }); } }
  function popText(x, y, txt, col) { pops.push({ x: x, y: y, txt: txt, col: col || '#fff', t: 0 }); if (pops.length > 24) pops.shift(); }
  function event(s, e) {
    var ts = L.ts, cx = e.x != null ? fx(e.x + (e.id ? 0 : 0.5)) : 0, cy = e.y != null ? fy(e.y + (e.id ? 0 : 0.5)) : 0, mult = s.mult;
    if (e.e === 'out') { burst(cx, cy, 16, { k: 'steam', v: 30, vy: -30, life: 1.4, s: ts * 0.22 }); burst(cx, cy, 10, { k: 'spark', v: 70, life: 0.5, s: 3, col: '#bfe6ff' }); popText(cx, cy - ts * 0.3, '+' + 50 * mult, '#d8f1ff'); }
    else if (e.e === 'thunder') { var bx = fx(e.x), by = fy(e.y - ELEV); bolts.push({ pts: zig(bx + (Math.random() - 0.5) * 60, -10, bx, by), t: 0 }); bolts.push({ pts: zig(bx, by, bx + (Math.random() - 0.5) * ts, fy(e.y)), t: 0 }); flash = 1; shake = 10; }
    else if (e.e === 'rainbow') { rbT = 6; burst(L.w / 2, fy(s.P.H / 2), 40, { k: 'spark', v: 160, life: 1.2, s: 4, col: 'rainbow' }); }
    else if (e.e === 'merge') { burst(cx, fy(e.y - ELEV), 18, { k: 'puff', v: 60, life: 0.8, s: ts * 0.25 }); popText(cx, fy(e.y - ELEV) - ts * 0.5, '+20', '#fff'); }
    else if (e.e === 'summon') { burst(cx, fy(e.y - ELEV), 30, { k: 'spark', v: 120, life: 1, s: 4, col: '#ffe066' }); }
    else if (e.e === 'ignite' || e.e === 'spread' || e.e === 'reignite') { burst(cx, cy, e.e === 'spread' ? 5 : 10, { k: 'spark', v: 50, vy: -30, life: 0.7, s: 2.5, col: '#ffb347' }); }
    else if (e.e === 'scorched') { burst(cx, cy, 14, { k: 'smoke', v: 20, vy: -20, life: 2.5, s: ts * 0.35 }); }
    else if (e.e === 'soaked') { burst(cx, cy, 8, { k: 'spark', v: 40, life: 0.8, s: 3, col: '#9be7ff' }); }
  }
  function zig(x0, y0, x1, y1) { var pts = [[x0, y0]], n = 7; for (var i = 1; i < n; i++) { var t = i / n; pts.push([x0 + (x1 - x0) * t + (Math.random() - 0.5) * 26, y0 + (y1 - y0) * t]); } pts.push([x1, y1]); return pts; }
  // ---------- frame ----------
  function frame(s, dt, ui) {
    T += dt; var g = ctx, ts = L.ts, P = s.P, i, c;
    if (!terrain || mapKey !== s.t) { terrain = buildTerrain(s); mapKey = s.t; }
    g.setTransform(L.dpr, 0, 0, L.dpr, 0, 0);
    var sx = 0, sy = 0; if (shake > 0) { sx = (Math.random() - 0.5) * shake; sy = (Math.random() - 0.5) * shake; shake = Math.max(0, shake - dt * 40); }
    g.translate(sx, sy);
    g.drawImage(terrain, 0, 0, L.w, L.h);
    sky(g, s);
    // wet / burnt / ember overlays (soft blobs, no tile edges)
    var wetB = blob('rgba(40,120,190,1)'), charB = blob('rgba(28,22,18,1)'), greenB = blob('rgba(120,200,90,1)');
    s.t.forEach(function (tl) {
      var x = fx(tl.x + 0.5), y = fy(tl.y + 0.5), R = ts * 0.85;
      if (tl.burnt > 0.02) { g.globalAlpha = Math.min(0.92, tl.burnt * 1.1); g.drawImage(charB, x - R, y - R, R * 2, R * 2); }
      if (tl.wet > 0.05) { g.globalAlpha = tl.wet * 0.34; g.drawImage(wetB, x - R, y - R, R * 2, R * 2); }
      if (tl.burnt > 0.02 && tl.fire <= 0 && tl.wet > 0.45 && tl.calm > 3) { // regrowth sprouts (hopeful)
        g.globalAlpha = 0.5 + 0.3 * Math.sin(T * 2 + tl.x); g.drawImage(greenB, x - R * 0.4, y - R * 0.4, R * 0.8, R * 0.8);
      }
      if (tl.ember > 0 && tl.fire <= 0) { g.globalAlpha = 1; for (var k = 0; k < 4; k++) { var ex = x + (hash(tl.x, tl.y, k) - 0.5) * ts * 0.7, ey = y + (hash(tl.y, tl.x, k) - 0.5) * ts * 0.7, pulse = 0.5 + 0.5 * Math.sin(T * 5 + k * 2); g.fillStyle = 'rgba(255,' + (90 + pulse * 80 | 0) + ',30,' + (0.35 + pulse * 0.5) * tl.ember + ')'; g.beginPath(); g.arc(ex, ey, 2 + pulse * 2, 0, 6.3); g.fill(); } }
    });
    g.globalAlpha = 1;
    // fires
    var glow = glowSprite(); g.globalCompositeOperation = 'lighter';
    s.t.forEach(function (tl) { if (tl.fire <= 0) return; var x = fx(tl.x + 0.5), y = fy(tl.y + 0.5), R = ts * (0.7 + tl.fire * 0.8) * (1 + 0.06 * Math.sin(T * 9 + tl.x * 3)); g.globalAlpha = 0.55 + tl.fire * 0.45; g.drawImage(glow, x - R, y - R, R * 2, R * 2); });
    g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
    var bed = blob('rgba(150,30,10,1)');
    s.t.forEach(function (tl) { if (tl.fire <= 0) return; var x = fx(tl.x + 0.5), y = fy(tl.y + 0.5), R = ts * 0.62; g.globalAlpha = 0.5 + tl.fire * 0.4; g.drawImage(bed, x - R, y - R * 0.8, R * 2, R * 1.6); });
    g.globalAlpha = 1;
    s.t.forEach(function (tl) {
      if (tl.fire <= 0) return; var x = fx(tl.x + 0.5), y = fy(tl.y + 0.5), n = 2 + Math.round(tl.fire * 3);
      for (var k = 0; k < n; k++) flame(g, x + (hash(tl.x, tl.y, k + 5) - 0.5) * ts * 0.62, y + (hash(tl.y, tl.x, k + 9) - 0.3) * ts * 0.5, ts * (0.3 + tl.fire * 0.42) * (0.75 + 0.25 * Math.sin(T * 11 + k * 1.7 + tl.x)), s.wind.x);
      if (Math.random() < tl.fire * dt * 7) add({ k: 'smoke', x: x + (Math.random() - 0.5) * ts * 0.4, y: y - ts * 0.2, vx: s.wind.x * ts * 0.8, vy: -ts * 0.45 + s.wind.y * ts * 0.5, life: 2.6, t: 0, s: ts * (0.25 + Math.random() * 0.2) });
    });
    // particles under the clouds (smoke, steam, sparks)
    drawParts(g, dt, s, false);
    // ground rings where a held cloud will rain
    s.clouds.forEach(function (c) {
      var x = fx(c.x), y = fy(c.y), R = c.r * ts * (c.storm > 0 ? 1.3 : 1);
      g.fillStyle = 'rgba(10,30,40,' + (0.16 + Math.min(1, c.w) * 0.14) + ')'; g.beginPath(); g.ellipse(x + ts * 0.12, y + ts * 0.1, R * 0.82, R * 0.62, 0, 0, 6.3); g.fill();
      if (c.held || (ui && ui.hint === c.id)) { g.strokeStyle = 'rgba(190,235,255,0.85)'; g.lineWidth = 2.5; g.setLineDash([7, 6]); g.lineDashOffset = -T * 30; g.beginPath(); g.arc(x, y, R, 0, 6.3); g.stroke(); g.setLineDash([]); }
    });
    // rain drops
    s.clouds.forEach(function (c) { if (c.w <= 0) return; var R = c.r * (c.storm > 0 ? 1.3 : 1), n = (c.storm > 0 ? 90 : 46) * Math.min(1, c.w + 0.2) * R * R * dt; while (n > 0 && drops.length < 900) { if (n < 1 && Math.random() > n) break; n--; var a = Math.random() * 6.28, rr = Math.sqrt(Math.random()) * R * 0.85; drops.push({ x: c.x + Math.cos(a) * rr, y: c.y + Math.sin(a) * rr * 0.8, z: 0.75 + Math.random() * 0.25, st: c.storm > 0 }); } });
    var el = ELEV * ts;
    g.lineCap = 'round';
    for (i = drops.length - 1; i >= 0; i--) {
      var d = drops[i]; d.z -= dt * 2.6; var gx = fx(d.x), gy = fy(d.y);
      if (d.z <= 0) { if (Math.random() < 0.5) add({ k: 'ring', x: gx, y: gy, life: 0.35, t: 0, s: 3 + Math.random() * 3 }); drops.splice(i, 1); continue; }
      var yy = gy - el * d.z, lean = s.wind.x * 14; g.strokeStyle = d.st ? 'rgba(200,210,255,0.75)' : 'rgba(170,215,255,0.7)'; g.lineWidth = d.st ? 2 : 1.5; g.beginPath(); g.moveTo(gx - lean * 0.3, yy - 9); g.lineTo(gx + lean * 0.1, yy + 3); g.stroke();
    }
    // clouds
    s.clouds.forEach(function (c) {
      var R = c.r * ts * 1.02 * (c.storm > 0 ? 1.18 : 1), w = R * 2.1, h = w * 170 / 240, x = fx(c.x), y = fy(c.y) - el + Math.sin(T * 1.4 + c.id) * 2.5 - (c.held ? 6 : 0);
      var age = Math.min(1, (s.time - c.born) / 0.6 + (s.time < c.born ? 1 : 0)), fade = c.w > 0 ? 1 : Math.max(0.25, 1 - c.dry / 7);
      g.globalAlpha = Math.max(0, Math.min(1, age)) * fade;
      var sc = c.w > 0 ? 1 : 0.85 - Math.min(0.25, c.dry * 0.04); w *= sc; h *= sc;
      g.drawImage(cloudSprite('light'), x - w / 2, y - h / 2, w, h);
      if (c.w > 0) { g.globalAlpha *= Math.min(1, c.w); g.drawImage(cloudSprite(c.storm > 0 ? 'storm' : 'rain'), x - w / 2, y - h / 2, w, h); }
      g.globalAlpha = 1;
      if (c.storm > 0 && Math.random() < dt * 2.5) { bolts.push({ pts: zig(x + (Math.random() - 0.5) * w * 0.4, y + h * 0.2, x + (Math.random() - 0.5) * w * 0.5, fy(c.y)), t: 0, small: true }); }
      // water gauge droplet
      if (c.w > 0 || c.held) { var bw = Math.max(26, w * 0.34), bx = x - bw / 2, by = y + h * 0.36; g.fillStyle = 'rgba(10,30,50,0.55)'; rr(g, bx - 1, by - 1, bw + 2, 7, 4); g.fill(); g.fillStyle = c.w > 0.3 ? '#5fc3ff' : '#ffb347'; rr(g, bx, by, bw * Math.min(1, c.w), 5, 3); g.fill(); }
      if (c.storm > 0) { g.font = '900 ' + Math.round(ts * 0.34) + 'px system-ui,sans-serif'; g.textAlign = 'center'; g.fillText('⚡', x, y - h * 0.18); }
    });
    // steam / puffs / sparks above clouds
    drawParts(g, dt, s, true);
    if (ui && ui.guide) guide(g, ui.guide);
    // lightning
    for (i = bolts.length - 1; i >= 0; i--) { var b = bolts[i]; b.t += dt; var life = b.small ? 0.18 : 0.45; if (b.t > life) { bolts.splice(i, 1); continue; } var a = 1 - b.t / life; g.strokeStyle = 'rgba(255,250,200,' + a + ')'; g.shadowColor = '#c9b8ff'; g.shadowBlur = 16; g.lineWidth = b.small ? 1.8 : 4; g.beginPath(); b.pts.forEach(function (p, j) { j ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]); }); g.stroke(); g.lineWidth = b.small ? 0.8 : 1.6; g.strokeStyle = 'rgba(255,255,255,' + a + ')'; g.stroke(); g.shadowBlur = 0; }
    // rainbow
    if (rbT > 0) rbT -= dt; var rba = rbT > 0 ? Math.min(1, rbT / 1.5) * 0.55 : (s.mult > 1 ? 0.22 : 0);
    if (rba > 0.01) rainbow(g, rba);
    // haze overlay
    var hz = s.haze; g.fillStyle = 'rgba(196,128,62,' + (0.05 + hz * 0.42) + ')'; g.fillRect(-20, -20, L.w + 40, L.h + 40);
    if (hz > 0.55) { var vg = g.createRadialGradient(L.w / 2, L.h / 2, Math.min(L.w, L.h) * 0.3, L.w / 2, L.h / 2, Math.max(L.w, L.h) * 0.75); vg.addColorStop(0, 'rgba(90,50,20,0)'); vg.addColorStop(1, 'rgba(90,45,15,' + (hz - 0.55) * 1.3 + ')'); g.fillStyle = vg; g.fillRect(-20, -20, L.w + 40, L.h + 40); }
    // floating score texts
    g.textAlign = 'center'; g.font = '900 ' + Math.round(Math.max(14, ts * 0.32)) + 'px system-ui,sans-serif';
    for (i = pops.length - 1; i >= 0; i--) { var p = pops[i]; p.t += dt; if (p.t > 1.1) { pops.splice(i, 1); continue; } g.globalAlpha = 1 - p.t / 1.1; g.lineWidth = 4; g.strokeStyle = 'rgba(10,30,40,0.8)'; g.strokeText(p.txt, p.x, p.y - p.t * 30); g.fillStyle = p.col; g.fillText(p.txt, p.x, p.y - p.t * 30); }
    g.globalAlpha = 1;
    foreground(g, s, ui);
    if (flash > 0) { g.fillStyle = 'rgba(255,255,245,' + flash * 0.55 + ')'; g.fillRect(-20, -20, L.w + 40, L.h + 40); flash = Math.max(0, flash - dt * 3.5); }
    if (s.dry.on) { g.fillStyle = 'rgba(255,190,80,' + (0.08 + 0.04 * Math.sin(T * 3)) + ')'; g.fillRect(-20, -20, L.w + 40, L.h + 40); }
  }
  function guide(g, gd) {
    var x0 = fx(gd.x0), y0 = fy(gd.y0) - ELEV * L.ts * 0.5, x1 = fx(gd.x1), y1 = fy(gd.y1), mx = (x0 + x1) / 2, my = Math.min(y0, y1) - L.ts * 1.2;
    g.save(); g.strokeStyle = 'rgba(255,240,170,0.95)'; g.lineWidth = 4; g.setLineDash([10, 9]); g.lineDashOffset = -T * 40; g.shadowColor = 'rgba(0,0,0,0.5)'; g.shadowBlur = 6;
    g.beginPath(); g.moveTo(x0, y0); g.quadraticCurveTo(mx, my, x1, y1); g.stroke(); g.setLineDash([]);
    var a = Math.atan2(y1 - my, x1 - mx); g.fillStyle = 'rgba(255,240,170,0.95)'; g.beginPath(); g.moveTo(x1, y1); g.lineTo(x1 - 16 * Math.cos(a - 0.45), y1 - 16 * Math.sin(a - 0.45)); g.lineTo(x1 - 16 * Math.cos(a + 0.45), y1 - 16 * Math.sin(a + 0.45)); g.closePath(); g.fill();
    var u = (T * 0.6) % 1, hx = (1 - u) * (1 - u) * x0 + 2 * u * (1 - u) * mx + u * u * x1, hy = (1 - u) * (1 - u) * y0 + 2 * u * (1 - u) * my + u * u * y1;
    g.shadowBlur = 0; g.font = Math.round(L.ts * 0.6) + 'px system-ui,sans-serif'; g.textAlign = 'center'; g.globalAlpha = u < 0.85 ? 1 : (1 - u) / 0.15; g.fillText('👆', hx + 6, hy + L.ts * 0.45);
    g.restore();
  }
  function rr(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
  function flame(g, x, y, h, wind) {
    var w = h * 0.55, lean = wind * h * 1.2;
    var gr = g.createLinearGradient(x, y - h, x, y); gr.addColorStop(0, '#fff3a0'); gr.addColorStop(0.35, '#ffb627'); gr.addColorStop(0.75, '#ff5a1f'); gr.addColorStop(1, '#c2261a');
    g.fillStyle = gr; g.beginPath(); g.moveTo(x + lean, y - h); g.bezierCurveTo(x + w * 0.9, y - h * 0.45, x + w * 0.7, y, x, y); g.bezierCurveTo(x - w * 0.7, y, x - w * 0.9, y - h * 0.45, x + lean, y - h); g.fill();
    g.fillStyle = 'rgba(255,250,210,0.85)'; g.beginPath(); g.ellipse(x + lean * 0.3, y - h * 0.25, w * 0.22, h * 0.22, 0, 0, 6.3); g.fill();
  }
  function rainbow(g, a) {
    var cx = L.w / 2, cy = fy(PH.D.H) + L.ts * 0.5, R = Math.min(L.w * 0.62, L.ts * PH.D.W * 0.8), bands = ['#ff5f5f', '#ff9f43', '#ffe066', '#5ee07a', '#3fb6ff', '#6b7bff', '#b07bff'], bw = Math.max(5, L.ts * 0.13);
    g.save(); g.globalAlpha = a; g.lineWidth = bw;
    bands.forEach(function (col, i) { g.strokeStyle = col; g.beginPath(); g.arc(cx, cy, R - i * bw, Math.PI * 1.05, Math.PI * 1.95); g.stroke(); });
    g.restore();
  }
  function drawParts(g, dt, s, top) {
    var smokeB = blob('rgba(120,110,100,1)'), steamB = blob('rgba(255,255,255,1)');
    for (var i = parts.length - 1; i >= 0; i--) {
      var p = parts[i], isTop = p.k === 'steam' || p.k === 'puff' || p.k === 'spark';
      if (isTop !== top) continue;
      p.t += dt; if (p.t >= p.life) { parts.splice(i, 1); continue; }
      var f = p.t / p.life; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += (p.g || 0) * dt;
      if (p.k === 'smoke') { var sz = p.s * (1 + f * 2.2); g.globalAlpha = (1 - f) * 0.5 * (f < 0.15 ? f / 0.15 : 1); g.drawImage(smokeB, p.x - sz, p.y - sz, sz * 2, sz * 2); }
      else if (p.k === 'steam' || p.k === 'puff') { var sz2 = p.s * (1 + f * 1.5); p.vx *= 0.96; p.vy *= 0.96; g.globalAlpha = (1 - f) * 0.8; g.drawImage(steamB, p.x - sz2, p.y - sz2, sz2 * 2, sz2 * 2); }
      else if (p.k === 'spark') { g.globalAlpha = 1 - f; g.fillStyle = p.col === 'rainbow' ? 'hsl(' + ((i * 47) % 360) + ',90%,65%)' : p.col; g.beginPath(); g.arc(p.x, p.y, p.s * (1 - f * 0.5), 0, 6.3); g.fill(); }
      else if (p.k === 'ring') { g.globalAlpha = (1 - f) * 0.8; g.strokeStyle = '#d6efff'; g.lineWidth = 1.2; g.beginPath(); g.ellipse(p.x, p.y, p.s * (0.4 + f), p.s * (0.4 + f) * 0.5, 0, 0, 6.3); g.stroke(); }
    }
    g.globalAlpha = 1;
  }
  // horizon band behind the top HUD: sky clears with rain, turns orange with haze
  function sky(g, s) {
    var h = Math.max(L.top - 6, fy(0) - 4), hz = s.haze;
    var gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, mix('#4aa8f0', '#c77a3a', hz)); gr.addColorStop(0.7, mix('#9fd8ff', '#f0b070', hz)); gr.addColorStop(1, mix('#d9f0ff', '#f6c890', hz));
    g.fillStyle = gr; g.fillRect(-20, -20, L.w + 40, h + 20);
    var sunx = L.w * 0.8, suny = h * 0.42; g.fillStyle = hz > 0.4 ? 'rgba(255,120,60,0.9)' : 'rgba(255,240,170,0.95)'; g.beginPath(); g.arc(sunx, suny, 16, 0, 6.3); g.fill();
    g.globalAlpha = 0.35; g.drawImage(glowSprite(), sunx - 60, suny - 60, 120, 120); g.globalAlpha = 1;
    g.fillStyle = mix('#3f7ea3', '#8a6040', hz); hills(g, h, 0.55, 18, 1); g.fillStyle = mix('#2f6b4a', '#6b4a2a', hz); hills(g, h, 0.35, 12, 2);
    var fade = g.createLinearGradient(0, h - 10, 0, h + 8); fade.addColorStop(0, 'rgba(0,0,0,0)'); fade.addColorStop(1, 'rgba(8,24,16,0.35)'); g.fillStyle = fade; g.fillRect(0, h - 10, L.w, 18);
  }
  function hills(g, base, amp, n, seed) { g.beginPath(); g.moveTo(-10, base); for (var x = -10; x <= L.w + 10; x += 12) g.lineTo(x, base - 10 - amp * 30 * (0.5 + 0.5 * Math.sin(x / (40 + seed * 17) + seed) * Math.cos(x / 23 + seed * 2))); g.lineTo(L.w + 10, base + 2); g.lineTo(-10, base + 2); g.closePath(); g.fill(); }
  function mix(a, b, t) { t = Math.max(0, Math.min(1, t)); var pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16); var r = (pa >> 16) + (((pb >> 16) - (pa >> 16)) * t), gg = ((pa >> 8) & 255) + ((((pb >> 8) & 255) - ((pa >> 8) & 255)) * t), bb = (pa & 255) + (((pb & 255) - (pa & 255)) * t); return 'rgb(' + (r | 0) + ',' + (gg | 0) + ',' + (bb | 0) + ')'; }
  // foreground ridge with the pawang silhouette next to the ritual bowl
  function foreground(g, s, ui) {
    var H = L.h, top = H - L.bot + 18, w = L.w, ch = ui ? ui.charge : 0;
    var gr = g.createLinearGradient(0, top - 20, 0, H); gr.addColorStop(0, '#173826'); gr.addColorStop(1, '#0a1c13'); g.fillStyle = gr;
    g.beginPath(); g.moveTo(-10, H + 10); g.lineTo(-10, top + 20); g.quadraticCurveTo(w * 0.25, top - 18, w * 0.5, top + 4); g.quadraticCurveTo(w * 0.78, top + 22, w + 10, top - 6); g.lineTo(w + 10, H + 10); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(255,200,110,0.35)'; g.lineWidth = 2; g.beginPath(); g.moveTo(-10, top + 20); g.quadraticCurveTo(w * 0.25, top - 18, w * 0.5, top + 4); g.quadraticCurveTo(w * 0.78, top + 22, w + 10, top - 6); g.stroke();
    // grass tufts
    g.strokeStyle = '#0f2a1b'; g.lineWidth = 2; for (var x = 6; x < w; x += 17) { var yb = top + 26 + Math.sin(x * 0.7) * 6 + 8; g.beginPath(); g.moveTo(x, yb); g.lineTo(x - 3, yb - 9); g.moveTo(x, yb); g.lineTo(x + 4, yb - 11); g.stroke(); }
    // pawang: seated, arms rise with the ritual charge
    var px = w / 2 - 92, py = H - 34, sc = Math.min(1.15, Math.max(0.8, w / 400)), lift = Math.min(1, ch) * 1, bob = Math.sin(T * 2) * 1.5;
    g.save(); g.translate(px, py + bob); g.scale(sc, sc);
    g.fillStyle = '#0a1a12';
    g.beginPath(); g.ellipse(0, 6, 30, 10, 0, 0, 6.3); g.fill(); // crossed legs
    g.beginPath(); g.moveTo(-17, 4); g.quadraticCurveTo(-18, -30, 0, -36); g.quadraticCurveTo(18, -30, 17, 4); g.closePath(); g.fill(); // body
    g.beginPath(); g.arc(0, -46, 11, 0, 6.3); g.fill(); // head
    g.fillStyle = '#8a2c1a'; g.beginPath(); g.ellipse(0, -53, 12.5, 6, 0, Math.PI, 0); g.fill(); g.beginPath(); g.moveTo(-11, -52); g.lineTo(-20 - Math.sin(T * 3) * 2, -44); g.lineTo(-10, -48); g.fill(); // udeng
    g.strokeStyle = '#0a1a12'; g.lineWidth = 7; g.lineCap = 'round';
    var ax = 34, ay = -14 - lift * 34; g.beginPath(); g.moveTo(12, -26); g.quadraticCurveTo(24, -20 - lift * 18, ax, ay); g.stroke(); g.beginPath(); g.moveTo(-12, -26); g.quadraticCurveTo(-24, -18 - lift * 20, -26 + lift * 8, ay + 4); g.stroke();
    g.strokeStyle = 'rgba(255,200,110,0.55)'; g.lineWidth = 1.5; g.beginPath(); g.arc(0, -46, 11, -2.6, -0.6); g.stroke(); g.beginPath(); g.moveTo(15, -2); g.quadraticCurveTo(17, -28, 2, -36); g.stroke(); // rim light
    // sarong pattern
    g.strokeStyle = 'rgba(200,150,60,0.5)'; g.lineWidth = 1.2; for (var k = -24; k <= 24; k += 8) { g.beginPath(); g.moveTo(k, 2); g.lineTo(k + 4, 12); g.stroke(); }
    g.restore();
    // incense smoke from the bowl area (center)
    var bx = w / 2, byy = H - 66;
    for (var j = 0; j < 3; j++) { g.strokeStyle = 'rgba(255,240,220,' + (0.18 + ch * 0.3) + ')'; g.lineWidth = 2; g.beginPath(); for (var q = 0; q < 14; q++) { var yy = byy - 46 - q * 6, xx = bx + (j - 1) * 14 + Math.sin(T * 2 + q * 0.5 + j) * (4 + q * 0.6); q ? g.lineTo(xx, yy) : g.moveTo(xx, yy); } g.stroke(); }
    if (ch > 0) { g.globalCompositeOperation = 'lighter'; g.globalAlpha = Math.min(1, ch) * 0.8; var R = 70 + ch * 50; g.drawImage(glowSprite(), bx - R, byy - R, R * 2, R * 2); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; }
  }
  function clear() { parts.length = 0; drops.length = 0; bolts.length = 0; pops.length = 0; rbT = 0; flash = 0; }
  G.PHR = { init: function (canvas, cfg) { cv = canvas; ctx = cv.getContext('2d'); CFG = cfg; PAL = cfg.palette; }, layout: layout, frame: frame, event: event, toField: toField, clear: clear, ELEV: ELEV, L: L, fx: fx, fy: fy, burst: burst };
})(window);

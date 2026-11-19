// Bumerang Sakti canvas drawing: cartoon, bloodless, cheerful. Pure drawing helpers on a 2D context.
(function (B) {
  'use strict';
  var TAU = Math.PI * 2;
  function rr(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
  var SKIES = [['#7fd4ff', '#d9f4ff'], ['#6ec3ff', '#ffe9b8'], ['#ff9fb5', '#ffe0a3'], ['#7a5cff', '#ff9fd0'], ['#2b2370', '#c0418f']];

  function background(c, W, H, t, tier, beat, ground) {
    var s = SKIES[tier] || SKIES[0], g = c.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, s[0]); g.addColorStop(1, s[1]); c.fillStyle = g; c.fillRect(0, 0, W, H);
    // sun / moon pulsing on the beat
    var pulse = 1 + 0.06 * Math.max(0, 1 - beat * 3);
    c.fillStyle = tier >= 4 ? 'rgba(255,250,220,.9)' : 'rgba(255,236,120,.95)';
    c.beginPath(); c.arc(W * 0.82, H * 0.12, Math.min(W, H) * 0.06 * pulse, 0, TAU); c.fill();
    if (tier >= 3) { c.fillStyle = 'rgba(255,255,255,.7)'; for (var i = 0; i < 24; i++) { var sx = (i * 97 % 100) / 100 * W, sy = (i * 53 % 60) / 100 * H; c.globalAlpha = 0.3 + 0.5 * Math.abs(Math.sin(t * 2 + i)); c.fillRect(sx, sy, 2, 2); } c.globalAlpha = 1; }
    // clouds
    c.fillStyle = 'rgba(255,255,255,.75)';
    for (var k = 0; k < 4; k++) { var cx = ((t * (8 + k * 4) + k * 260) % (W + 200)) - 100, cy = H * (0.08 + k * 0.09); cloud(c, cx, cy, 22 + k * 5); }
    // hills
    c.fillStyle = tier >= 4 ? '#3b2f7a' : '#8fd16a';
    c.beginPath(); c.moveTo(0, ground); for (var x = 0; x <= W; x += 20) c.lineTo(x, ground - 30 - Math.sin(x / W * 5 + 1) * 22); c.lineTo(W, H); c.lineTo(0, H); c.fill();
    c.fillStyle = tier >= 4 ? '#2c2360' : '#5fb84a'; c.fillRect(0, ground, W, H - ground);
    c.fillStyle = tier >= 4 ? '#3e3482' : '#73c95a'; for (var gx = 0; gx < W; gx += 26) c.fillRect(gx, ground, 13, 5);
    // merah-putih bunting from combo tier 2 (festive 17-an vibe)
    if (tier >= 2) {
      var y0 = H * 0.035, n = Math.ceil(W / 30); c.strokeStyle = 'rgba(80,50,30,.6)'; c.lineWidth = 1.5; c.beginPath();
      for (var b = 0; b <= n; b++) { var bx = b * 30, by = y0 + Math.sin(b / n * Math.PI) * 10; b ? c.lineTo(bx, by) : c.moveTo(bx, by); } c.stroke();
      for (var f = 0; f < n; f++) { var fx = f * 30 + 4, fy = y0 + Math.sin((f + 0.5) / n * Math.PI) * 10, sw = Math.sin(t * 4 + f) * 2;
        c.fillStyle = f % 2 ? '#fff' : '#e63946'; c.beginPath(); c.moveTo(fx, fy); c.lineTo(fx + 22, fy); c.lineTo(fx + 11 + sw, fy + 16); c.fill(); }
    }
  }
  function cloud(c, x, y, r) { c.beginPath(); c.arc(x, y, r, 0, TAU); c.arc(x + r, y + 4, r * 0.8, 0, TAU); c.arc(x - r, y + 6, r * 0.7, 0, TAU); c.fill(); }

  // Player kid: cap + shirt in skin colours, name tag so it's clearly "you".
  function player(c, x, y, s, t, walking, aiming, skin, name, shield, hurt) {
    c.save(); c.translate(x, y);
    var step = walking ? Math.sin(t * 12) : 0, bob = walking ? Math.abs(step) * 2 : Math.sin(t * 3) * 1.2;
    if (hurt > 0 && Math.floor(t * 20) % 2) c.globalAlpha = 0.45;
    c.fillStyle = 'rgba(0,0,0,.18)'; c.beginPath(); c.ellipse(0, 4 * s, 22 * s, 6 * s, 0, 0, TAU); c.fill();
    c.translate(0, -bob);
    c.strokeStyle = '#3b2a20'; c.lineWidth = 6 * s; c.lineCap = 'round';
    c.beginPath(); c.moveTo(-7 * s, -14 * s); c.lineTo(-7 * s + step * 5 * s, 2 * s); c.moveTo(7 * s, -14 * s); c.lineTo(7 * s - step * 5 * s, 2 * s); c.stroke();
    c.fillStyle = skin.a; rr(c, -15 * s, -42 * s, 30 * s, 30 * s, 10 * s); c.fill();
    c.fillStyle = skin.b; c.fillRect(-15 * s, -26 * s, 30 * s, 5 * s);
    c.strokeStyle = '#f2b98a'; c.lineWidth = 6 * s;
    c.beginPath(); c.moveTo(-14 * s, -36 * s); c.lineTo(-22 * s, aiming ? -52 * s : -22 * s); c.moveTo(14 * s, -36 * s); c.lineTo(aiming ? 24 * s : 22 * s, aiming ? -50 * s : -22 * s); c.stroke();
    c.fillStyle = '#f7c79a'; c.beginPath(); c.arc(0, -56 * s, 16 * s, 0, TAU); c.fill();
    c.fillStyle = skin.b; c.beginPath(); c.arc(0, -60 * s, 16.5 * s, Math.PI, TAU); c.fill(); c.fillStyle = skin.a; c.fillRect(0, -62 * s, 22 * s, 5 * s);
    c.fillStyle = '#2b1d14'; c.beginPath(); c.arc(-6 * s, -55 * s, 2.4 * s, 0, TAU); c.arc(6 * s, -55 * s, 2.4 * s, 0, TAU); c.fill();
    c.strokeStyle = '#2b1d14'; c.lineWidth = 2 * s; c.beginPath(); c.arc(0, -50 * s, 5 * s, 0.15 * Math.PI, 0.85 * Math.PI); c.stroke();
    c.fillStyle = 'rgba(255,120,120,.45)'; c.beginPath(); c.arc(-11 * s, -50 * s, 3 * s, 0, TAU); c.arc(11 * s, -50 * s, 3 * s, 0, TAU); c.fill();
    if (shield) { c.strokeStyle = 'rgba(90,200,255,' + (0.6 + 0.3 * Math.sin(t * 6)) + ')'; c.lineWidth = 4 * s; c.beginPath(); c.arc(0, -34 * s, 40 * s, 0, TAU); c.stroke(); c.fillStyle = 'rgba(120,210,255,.12)'; c.fill(); }
    if (name) { c.font = '800 ' + Math.round(12 * s) + 'px system-ui,sans-serif'; var w = c.measureText(name).width + 14 * s; c.fillStyle = 'rgba(30,20,60,.78)'; rr(c, -w / 2, -96 * s, w, 18 * s, 9 * s); c.fill(); c.fillStyle = '#fff'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(name, 0, -87 * s); c.beginPath(); c.fillStyle = 'rgba(30,20,60,.78)'; c.moveTo(-5 * s, -78 * s); c.lineTo(5 * s, -78 * s); c.lineTo(0, -73 * s); c.fill(); }
    c.restore();
  }

  function face(c, r, dizzy, t, happy) {
    c.fillStyle = '#fff'; c.beginPath(); c.arc(-r * 0.35, -r * 0.12, r * 0.3, 0, TAU); c.arc(r * 0.35, -r * 0.12, r * 0.3, 0, TAU); c.fill();
    c.strokeStyle = c.fillStyle = '#2b1d3a';
    if (dizzy) { c.lineWidth = r * 0.08; [-1, 1].forEach(function (sx) { c.beginPath(); for (var a = 0; a < 9; a += 0.4) { var rad = a / 9 * r * 0.24; c.lineTo(sx * r * 0.35 + Math.cos(a + t * 8) * rad, -r * 0.12 + Math.sin(a + t * 8) * rad); } c.stroke(); }); }
    else { c.beginPath(); c.arc(-r * 0.3, -r * 0.08, r * 0.13, 0, TAU); c.arc(r * 0.4, -r * 0.08, r * 0.13, 0, TAU); c.fill(); }
    c.lineWidth = r * 0.09; c.beginPath();
    if (happy) c.arc(0, r * 0.22, r * 0.22, 0.1 * Math.PI, 0.9 * Math.PI); else { c.moveTo(-r * 0.15, r * 0.35); c.quadraticCurveTo(0, r * 0.25, r * 0.15, r * 0.35); }
    c.stroke();
  }
  // Entity kinds: mon (pink), big (2 HP), tnt (good, brown crate), bomb (bad), time, shield.
  function entity(c, e, t, beat) {
    var pop = Math.min(1, (t - e.born) * 4), sc = pop < 1 ? easeBack(pop) : 1, pulse = 1 + 0.07 * Math.max(0, 1 - beat * 4);
    if (e.leaving) sc *= Math.max(0, 1 - e.leaving * 1.5);
    c.save(); c.translate(e.x, e.y); c.scale(sc * pulse, sc * pulse);
    var r = e.r;
    if (e.flash > 0) { c.shadowColor = '#fff'; c.shadowBlur = 20; }
    if (e.kind === 'mon' || e.kind === 'big') {
      var big = e.kind === 'big', sq = 1 + Math.sin(t * 5 + e.seed) * 0.05;
      c.scale(sq, 2 - sq);
      c.fillStyle = big ? (e.hp < 2 ? '#ff9ad5' : '#d94ba6') : '#ff6fb5';
      c.beginPath(); c.arc(0, 0, r, 0, TAU); c.fill();
      if (big) { c.strokeStyle = '#7a1f5c'; c.lineWidth = r * 0.12; c.stroke(); }
      c.fillStyle = big ? '#b8358a' : '#ff4f9f';
      c.beginPath(); c.moveTo(-r * 0.6, -r * 0.7); c.lineTo(-r * 0.4, -r * 1.25); c.lineTo(-r * 0.15, -r * 0.85); c.fill();
      c.beginPath(); c.moveTo(r * 0.6, -r * 0.7); c.lineTo(r * 0.4, -r * 1.25); c.lineTo(r * 0.15, -r * 0.85); c.fill();
      c.fillStyle = 'rgba(255,255,255,.35)'; c.beginPath(); c.ellipse(-r * 0.45, -r * 0.5, r * 0.22, r * 0.12, -0.6, 0, TAU); c.fill();
      face(c, r, big && e.hp < 2, t, !big);
      if (big) { for (var h = 0; h < 2; h++) { c.fillStyle = h < e.hp ? '#ffe14d' : 'rgba(0,0,0,.25)'; c.beginPath(); c.arc((h - 0.5) * r * 0.5, r * 1.2, r * 0.16, 0, TAU); c.fill(); } }
    } else if (e.kind === 'boss') {
      var hurtK = 1 - e.hp / (e.maxHp || 10), wob = Math.sin(t * 3 + e.seed) * 0.06;
      c.rotate(wob);
      glow(c, r * 1.05, 'rgba(255,214,63,.55)');
      var bg = c.createRadialGradient(-r * 0.3, -r * 0.4, r * 0.2, 0, 0, r);
      bg.addColorStop(0, '#c58bff'); bg.addColorStop(1, hurtK > 0.6 ? '#ff6fb5' : '#7b3fe4');
      c.fillStyle = bg; c.beginPath();
      for (var k = 0; k < 16; k++) { var aa = k / 16 * TAU, rr2 = r * (k % 2 ? 0.92 : 1.04); c.lineTo(Math.cos(aa) * rr2, Math.sin(aa) * rr2 * 0.95); }
      c.closePath(); c.fill(); c.strokeStyle = '#3a1a7a'; c.lineWidth = r * 0.06; c.stroke();
      // crown
      c.fillStyle = '#ffd23f'; c.strokeStyle = '#b07a00'; c.lineWidth = r * 0.04; c.beginPath();
      c.moveTo(-r * 0.5, -r * 0.78); c.lineTo(-r * 0.55, -r * 1.25); c.lineTo(-r * 0.25, -r * 1.0); c.lineTo(0, -r * 1.35); c.lineTo(r * 0.25, -r * 1.0); c.lineTo(r * 0.55, -r * 1.25); c.lineTo(r * 0.5, -r * 0.78); c.closePath(); c.fill(); c.stroke();
      c.fillStyle = '#ff4f9f'; c.beginPath(); c.arc(0, -r * 1.02, r * 0.08, 0, TAU); c.fill();
      // belly star
      star(c, 0, r * 0.45, r * 0.26, '#ffe14d');
      // eyes + brows (cute-grumpy)
      c.save(); c.translate(0, -r * 0.1); c.scale(0.8, 0.8); face(c, r, hurtK > 0.7, t, false); c.restore();
      c.strokeStyle = '#2b1d3a'; c.lineWidth = r * 0.07; c.lineCap = 'round';
      c.beginPath(); c.moveTo(-r * 0.5, -r * 0.48); c.lineTo(-r * 0.15, -r * 0.36); c.moveTo(r * 0.5, -r * 0.48); c.lineTo(r * 0.15, -r * 0.36); c.stroke();
      c.rotate(-wob);
      // HP bar
      var bw = r * 1.9, bh = Math.max(8, r * 0.16), by = -r * 1.65, mh = e.maxHp || 10;
      c.fillStyle = 'rgba(30,20,60,.75)'; rr(c, -bw / 2 - 3, by - 3, bw + 6, bh + 6, bh / 2 + 3); c.fill();
      for (var hh = 0; hh < mh; hh++) { c.fillStyle = hh < e.hp ? (e.hp <= 3 ? '#ff6b6b' : '#ffd23f') : 'rgba(255,255,255,.18)'; c.fillRect(-bw / 2 + hh * bw / mh + 1, by, bw / mh - 2, bh); }
    } else if (e.kind === 'tnt') {
      c.rotate(Math.sin(t * 3 + e.seed) * 0.12);
      c.fillStyle = '#9b5a2a'; rr(c, -r, -r, r * 2, r * 2, r * 0.25); c.fill();
      c.strokeStyle = '#6b3a17'; c.lineWidth = r * 0.12; c.strokeRect(-r * 0.8, -r * 0.8, r * 1.6, r * 1.6);
      c.fillStyle = '#ffd23f'; c.fillRect(-r, -r * 0.28, r * 2, r * 0.56);
      c.fillStyle = '#6b1a0a'; c.font = '900 ' + Math.round(r * 0.5) + 'px system-ui,sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('TNT', 0, r * 0.03);
    } else if (e.kind === 'bomb') {
      c.fillStyle = '#2a2438'; c.beginPath(); c.arc(0, r * 0.1, r, 0, TAU); c.fill();
      c.fillStyle = '#4a4260'; c.fillRect(-r * 0.3, -r * 1.05, r * 0.6, r * 0.35);
      c.strokeStyle = '#a07040'; c.lineWidth = r * 0.12; c.beginPath(); c.moveTo(0, -r * 1.05); c.quadraticCurveTo(r * 0.4, -r * 1.5, r * 0.6, -r * 1.3); c.stroke();
      var sp = 0.6 + 0.4 * Math.sin(t * 25); c.fillStyle = 'rgba(255,' + Math.round(160 + 80 * sp) + ',40,1)'; c.beginPath(); c.arc(r * 0.62, -r * 1.32, r * 0.2 * (0.8 + sp * 0.5), 0, TAU); c.fill();
      c.fillStyle = '#ff4d4d'; c.beginPath(); c.arc(0, r * 0.1, r * 0.42, 0, TAU); c.fill();
      c.fillStyle = '#fff'; c.font = '900 ' + Math.round(r * 0.6) + 'px system-ui,sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('!', 0, r * 0.14);
      c.fillStyle = 'rgba(255,255,255,.3)'; c.beginPath(); c.arc(-r * 0.4, -r * 0.3, r * 0.2, 0, TAU); c.fill();
    } else if (e.kind === 'time') {
      c.rotate(Math.sin(t * 4) * 0.2);
      glow(c, r, '#7dffb0'); c.fillStyle = '#2ecc71'; c.beginPath(); c.arc(0, 0, r, 0, TAU); c.fill();
      c.fillStyle = '#fff'; c.beginPath(); c.arc(0, 0, r * 0.72, 0, TAU); c.fill();
      c.strokeStyle = '#1e8b4c'; c.lineWidth = r * 0.14; c.lineCap = 'round'; c.beginPath(); c.moveTo(0, 0); c.lineTo(0, -r * 0.5); c.moveTo(0, 0); c.lineTo(r * 0.35, r * 0.1); c.stroke();
      c.fillStyle = '#1e8b4c'; c.font = '900 ' + Math.round(r * 0.55) + 'px system-ui,sans-serif'; c.textAlign = 'center'; c.fillText('+', -r * 0.95, -r * 0.6);
    } else if (e.kind === 'shield') {
      c.rotate(Math.sin(t * 4) * 0.2);
      glow(c, r, '#8fdcff'); c.fillStyle = '#2f9bff';
      c.beginPath(); c.moveTo(0, -r); c.lineTo(r * 0.85, -r * 0.6); c.quadraticCurveTo(r * 0.8, r * 0.5, 0, r); c.quadraticCurveTo(-r * 0.8, r * 0.5, -r * 0.85, -r * 0.6); c.closePath(); c.fill();
      c.fillStyle = '#fff'; c.beginPath(); c.moveTo(0, -r * 0.6); c.lineTo(r * 0.5, -r * 0.35); c.quadraticCurveTo(r * 0.45, r * 0.3, 0, r * 0.6); c.closePath(); c.fill();
    }
    c.restore();
  }
  function glow(c, r, col) { var g = c.createRadialGradient(0, 0, r * 0.5, 0, 0, r * 1.7); g.addColorStop(0, col); g.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g; c.beginPath(); c.arc(0, 0, r * 1.7, 0, TAU); c.fill(); }
  function easeBack(k) { var s = 1.7; k -= 1; return k * k * ((s + 1) * k + s) + 1; }

  function boomerang(c, x, y, ang, r, skin, t) {
    c.save(); c.translate(x, y); c.rotate(ang);
    var a = skin.a, b = skin.b;
    if (skin.rainbow) { a = 'hsl(' + (t * 300 % 360) + ',90%,62%)'; b = 'hsl(' + ((t * 300 + 120) % 360) + ',90%,55%)'; }
    c.lineCap = 'round'; c.lineJoin = 'round';
    c.strokeStyle = 'rgba(0,0,0,.25)'; c.lineWidth = r * 0.62; c.beginPath(); c.moveTo(-r, r * 0.55); c.quadraticCurveTo(0, -r * 0.9, r, r * 0.55); c.stroke();
    c.strokeStyle = b; c.lineWidth = r * 0.5; c.beginPath(); c.moveTo(-r, r * 0.5); c.quadraticCurveTo(0, -r * 0.95, r, r * 0.5); c.stroke();
    c.strokeStyle = a; c.lineWidth = r * 0.28; c.beginPath(); c.moveTo(-r * 0.92, r * 0.42); c.quadraticCurveTo(0, -r * 0.9, r * 0.92, r * 0.42); c.stroke();
    if (skin.stripe) { c.strokeStyle = b; c.lineWidth = 2; for (var i = -2; i <= 2; i++) { c.beginPath(); c.arc(i * r * 0.35, -r * 0.1 + Math.abs(i) * r * 0.18, 2, 0, TAU); c.stroke(); } }
    if (skin.shine) { c.fillStyle = 'rgba(255,255,255,' + (0.5 + 0.5 * Math.sin(t * 10)) + ')'; c.beginPath(); c.arc(0, -r * 0.2, r * 0.12, 0, TAU); c.fill(); }
    c.restore();
  }
  // Trail: list of {x,y,t}. Types: plain, star, bubble, rainbow, fire, heart.
  function trail(c, pts, now, type, skin) {
    if (pts.length < 2) return;
    c.save(); c.lineCap = 'round'; c.lineJoin = 'round';
    for (var i = 1; i < pts.length; i++) {
      var p = pts[i], q = pts[i - 1], age = now - p.t, k = Math.max(0, 1 - age / 0.35);
      if (k <= 0) continue;
      var col = type === 'rainbow' ? 'hsla(' + ((i * 14 + now * 200) % 360) + ',95%,60%,' + k + ')' : type === 'fire' ? 'rgba(255,' + Math.round(120 + 110 * k) + ',40,' + k + ')' : type === 'heart' ? 'rgba(255,110,170,' + k + ')' : 'rgba(255,255,255,' + k * 0.8 + ')';
      c.strokeStyle = col; c.lineWidth = (type === 'fire' ? 16 : type === 'rainbow' ? 12 : 8) * k + 1;
      c.beginPath(); c.moveTo(q.x, q.y); c.lineTo(p.x, p.y); c.stroke();
      if (i % 4 === 0) {
        if (type === 'star') star(c, p.x + Math.sin(i) * 8, p.y + Math.cos(i) * 8, 6 * k, '#ffe14d');
        else if (type === 'bubble') { c.strokeStyle = 'rgba(160,230,255,' + k + ')'; c.lineWidth = 2; c.beginPath(); c.arc(p.x + Math.sin(i * 3) * 10, p.y + Math.cos(i * 2) * 10 - age * 30, 5 + 4 * (1 - k), 0, TAU); c.stroke(); }
        else if (type === 'heart') heart(c, p.x + Math.sin(i) * 9, p.y - age * 40, 7 * k, '#ff4f9f');
        else if (type === 'fire') { c.fillStyle = 'rgba(255,230,80,' + k + ')'; c.beginPath(); c.arc(p.x, p.y - age * 50, 5 * k, 0, TAU); c.fill(); }
      }
    }
    c.restore();
  }
  function star(c, x, y, r, col) { c.fillStyle = col; c.beginPath(); for (var i = 0; i < 10; i++) { var a = i / 10 * TAU - Math.PI / 2, rad = i % 2 ? r * 0.45 : r; c.lineTo(x + Math.cos(a) * rad, y + Math.sin(a) * rad); } c.fill(); }
  function heart(c, x, y, r, col) { c.fillStyle = col; c.beginPath(); c.moveTo(x, y + r * 0.9); c.bezierCurveTo(x - r * 1.6, y - r * 0.2, x - r * 0.6, y - r * 1.3, x, y - r * 0.4); c.bezierCurveTo(x + r * 0.6, y - r * 1.3, x + r * 1.6, y - r * 0.2, x, y + r * 0.9); c.fill(); }

  // Aim path being drawn (dotted, catch ring at the player).
  function aim(c, pts, px, py, R, t, okEnd) {
    c.save();
    c.strokeStyle = okEnd ? 'rgba(80,255,150,.9)' : 'rgba(255,255,255,.85)'; c.lineWidth = 3 + Math.sin(t * 10); c.setLineDash([10, 9]); c.lineDashOffset = -t * 60; c.lineCap = 'round';
    c.beginPath(); pts.forEach(function (p, i) { i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y); }); c.stroke();
    c.setLineDash([]); ring(c, px, py, R, t, okEnd ? '#50ff96' : '#ffffff');
    c.restore();
  }
  function ring(c, x, y, R, t, col) {
    c.save(); c.strokeStyle = col; c.globalAlpha = 0.55 + 0.35 * Math.sin(t * 6); c.lineWidth = 3; c.setLineDash([6, 6]); c.lineDashOffset = t * 30;
    c.beginPath(); c.arc(x, y, R, 0, TAU); c.stroke(); c.restore();
  }
  // Coach hand tracing a demo loop (tutorial).
  function coach(c, loop, t, px, py, R) {
    if (!loop || loop.length < 2) return;
    var L = B.pathLength(loop), per = 2.6, k = (t % per) / per, d = Math.min(1, k * 1.2) * L;
    c.save(); c.strokeStyle = 'rgba(255,255,255,.55)'; c.lineWidth = 4; c.setLineDash([4, 10]); c.lineCap = 'round';
    c.beginPath(); loop.forEach(function (p, i) { i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y); }); c.stroke(); c.setLineDash([]);
    // arrow heads along the loop
    for (var a = 0.15; a < 1; a += 0.2) { var q = B.pointAt(loop, a * L); c.save(); c.translate(q.x, q.y); c.rotate(q.ang); c.fillStyle = 'rgba(255,255,255,.8)'; c.beginPath(); c.moveTo(8, 0); c.lineTo(-5, -6); c.lineTo(-5, 6); c.fill(); c.restore(); }
    ring(c, px, py, R, t, '#ffe14d');
    var p = B.pointAt(loop, d); hand(c, p.x, p.y, k > 0.85 ? 1 : 0);
    c.restore();
  }
  function hand(c, x, y, lift) {
    c.save(); c.translate(x + 6, y + 10 - lift * 6); c.rotate(-0.35);
    c.fillStyle = '#fff'; c.strokeStyle = '#2b1d3a'; c.lineWidth = 2.5;
    c.beginPath(); rr(c, -6, -22, 12, 30, 6); c.fill(); c.stroke();
    c.beginPath(); rr(c, -12, 0, 26, 22, 9); c.fill(); c.stroke();
    c.restore();
    c.fillStyle = 'rgba(255,225,77,.6)'; c.beginPath(); c.arc(x, y, 9 + Math.sin(Date.now() / 120) * 2, 0, TAU); c.fill();
  }

  // Particles: {x,y,vx,vy,life,max,size,col,shape,rot}
  function particles(c, list) {
    list.forEach(function (p) {
      var k = p.life / p.max; c.globalAlpha = Math.min(1, k * 1.5);
      if (p.shape === 'star') star(c, p.x, p.y, p.size, p.col);
      else if (p.shape === 'ring') { c.strokeStyle = p.col; c.lineWidth = 4 * k + 1; c.beginPath(); c.arc(p.x, p.y, p.size * (1.6 - k), 0, TAU); c.stroke(); }
      else if (p.shape === 'conf') { c.save(); c.translate(p.x, p.y); c.rotate(p.rot); c.fillStyle = p.col; c.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2); c.restore(); }
      else if (p.shape === 'smoke') { c.fillStyle = p.col; c.beginPath(); c.arc(p.x, p.y, p.size * (1.8 - k), 0, TAU); c.fill(); }
      else if (p.shape === 'slash') { c.strokeStyle = p.col; c.lineWidth = 5 * k; c.lineCap = 'round'; c.beginPath(); c.moveTo(p.x - Math.cos(p.rot) * p.size, p.y - Math.sin(p.rot) * p.size); c.lineTo(p.x + Math.cos(p.rot) * p.size, p.y + Math.sin(p.rot) * p.size); c.stroke(); }
      else { c.fillStyle = p.col; c.beginPath(); c.arc(p.x, p.y, p.size * k + 0.5, 0, TAU); c.fill(); }
    });
    c.globalAlpha = 1;
  }
  // Floating text popups: {x,y,txt,life,max,size,col}
  function popups(c, list) {
    c.textAlign = 'center'; c.textBaseline = 'middle';
    list.forEach(function (p) {
      var k = p.life / p.max, s = p.size * (k > 0.8 ? 1 + (k - 0.8) * 2.5 : 1);
      c.globalAlpha = Math.min(1, k * 2.5); c.font = '900 ' + Math.round(s) + 'px system-ui,"Segoe UI",sans-serif';
      c.lineWidth = Math.max(3, s * 0.18); c.strokeStyle = 'rgba(40,20,70,.85)'; c.strokeText(p.txt, p.x, p.y); c.fillStyle = p.col; c.fillText(p.txt, p.x, p.y);
    });
    c.globalAlpha = 1;
  }
  B.R = { background: background, player: player, entity: entity, boomerang: boomerang, trail: trail, aim: aim, ring: ring, coach: coach, particles: particles, popups: popups, star: star, heart: heart };
})(globalThis.BS = globalThis.BS || {});

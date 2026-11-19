/* Gasing Arena renderer: tilted tampah (woven tray) arena, wooden gasing with painted bands, spin blur, shadows, sparks */
(function (root) {
  'use strict';
  const TAU = Math.PI * 2, TILT = 0.58;
  const WOOD = [['#9a5b2a', '#5e3315'], ['#b77a3d', '#6b3d18'], ['#8a4f24', '#4f2a10'], ['#c08a4e', '#76461d'], ['#7d4a26', '#45240f'], ['#a8683a', '#5c3216']];
  function shade(hex, k) {
    const n = parseInt(hex.slice(1), 16); let r = n >> 16, g = (n >> 8) & 255, b = n & 255;
    if (k >= 0) { r += (255 - r) * k; g += (255 - g) * k; b += (255 - b) * k; } else { r *= 1 + k; g *= 1 + k; b *= 1 + k; }
    return 'rgb(' + (r | 0) + ',' + (g | 0) + ',' + (b | 0) + ')';
  }
  function rgba(hex, a) { const n = parseInt(hex.slice(1), 16); return 'rgba(' + (n >> 16) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')'; }

  /* ---------- static floor, pre-rendered per size ---------- */
  function layout(w, h) {
    const R = Math.min(w * (w < 600 ? 0.475 : 0.45), h / 1.8);
    return { w, h, R, cx: w / 2, cy: (h - 1.77 * R) / 2 + 1.03 * R };
  }
  function buildFloor(L, dpr) {
    const c = document.createElement('canvas'); c.width = Math.round(L.w * dpr); c.height = Math.round(L.h * dpr);
    const g = c.getContext('2d'); g.scale(dpr, dpr);
    const { cx, cy, R, w, h } = L, ry = R * TILT, depth = R * 0.085;
    // ground: warm earth with soft vignette + leaf/batik dots
    const bg = g.createRadialGradient(cx, cy, R * 0.2, cx, cy, Math.max(w, h) * 0.75);
    bg.addColorStop(0, '#6d8a3e'); bg.addColorStop(0.55, '#4f6b2c'); bg.addColorStop(1, '#2c3d18');
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 260; i++) { const x = rnd() * w, y = rnd() * h; g.fillStyle = 'rgba(' + (rnd() < 0.5 ? '255,240,180,' : '20,40,10,') + (0.05 + rnd() * 0.08) + ')'; g.beginPath(); g.ellipse(x, y, 2 + rnd() * 5, 1 + rnd() * 2.5, rnd() * 3, 0, TAU); g.fill(); }
    // drop shadow of the tray
    g.save(); g.fillStyle = 'rgba(0,0,0,.38)'; g.filter = 'blur(' + Math.round(R * 0.05) + 'px)'; g.beginPath(); g.ellipse(cx, cy + depth * 1.6, R * 1.1, ry * 1.12, 0, 0, TAU); g.fill(); g.restore();
    // rim side (thickness)
    const side = g.createLinearGradient(cx - R, 0, cx + R, 0);
    side.addColorStop(0, '#5a3413'); side.addColorStop(0.5, '#8a5524'); side.addColorStop(1, '#4a2a0f');
    g.fillStyle = side; g.beginPath(); g.ellipse(cx, cy + depth, R * 1.08, ry * 1.08, 0, 0, Math.PI); g.lineTo(cx - R * 1.08, cy); g.ellipse(cx, cy, R * 1.08, ry * 1.08, 0, Math.PI, 0, true); g.closePath(); g.fill();
    // rim top: rattan ring with red/gold painted segments
    g.beginPath(); g.ellipse(cx, cy, R * 1.08, ry * 1.08, 0, 0, TAU); g.ellipse(cx, cy, R, ry, 0, 0, TAU, true);
    const rimG = g.createLinearGradient(0, cy - ry, 0, cy + ry); rimG.addColorStop(0, '#d9a45e'); rimG.addColorStop(1, '#a8702f');
    g.fillStyle = rimG; g.fill('evenodd');
    for (let i = 0; i < 48; i++) {
      const a0 = (i / 48) * TAU, a1 = a0 + TAU / 48 * 0.5; if (i % 2) continue;
      g.beginPath(); g.ellipse(cx, cy, R * 1.075, ry * 1.075, 0, a0, a1); g.ellipse(cx, cy, R * 1.005, ry * 1.005, 0, a1, a0, true); g.closePath();
      g.fillStyle = i % 4 ? 'rgba(193,39,45,.78)' : 'rgba(240,180,41,.85)'; g.fill();
    }
    g.strokeStyle = 'rgba(60,30,8,.55)'; g.lineWidth = 1.5; g.beginPath(); g.ellipse(cx, cy, R * 1.08, ry * 1.08, 0, 0, TAU); g.stroke();
    // woven floor
    g.save(); g.beginPath(); g.ellipse(cx, cy, R, ry, 0, 0, TAU); g.clip();
    const fl = g.createRadialGradient(cx, cy - ry * 0.25, R * 0.05, cx, cy, R);
    fl.addColorStop(0, '#f3d79c'); fl.addColorStop(0.6, '#dcb46e'); fl.addColorStop(1, '#a87438');
    g.fillStyle = fl; g.fillRect(cx - R, cy - ry, R * 2, ry * 2);
    g.translate(cx, cy); g.scale(1, TILT);
    // concentric weave rings
    for (let r = R * 0.08; r < R; r += R * 0.045) { g.strokeStyle = 'rgba(120,70,20,' + (0.10 + 0.08 * (r / R)) + ')'; g.lineWidth = R * 0.012; g.beginPath(); g.arc(0, 0, r, 0, TAU); g.stroke(); }
    // radial bamboo strips (alternating weave)
    for (let i = 0; i < 72; i++) { const a = i / 72 * TAU; g.strokeStyle = i % 2 ? 'rgba(255,245,210,.10)' : 'rgba(110,60,15,.10)'; g.lineWidth = R * 0.02; g.beginPath(); g.moveTo(Math.cos(a) * R * 0.1, Math.sin(a) * R * 0.1); g.lineTo(Math.cos(a) * R, Math.sin(a) * R); g.stroke(); }
    // kawung (batik) centre motif
    g.fillStyle = 'rgba(150,40,30,.20)'; g.strokeStyle = 'rgba(120,30,20,.35)'; g.lineWidth = 2;
    for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + Math.PI / 4; g.beginPath(); g.ellipse(Math.cos(a) * R * 0.11, Math.sin(a) * R * 0.11, R * 0.1, R * 0.05, a, 0, TAU); g.fill(); g.stroke(); }
    g.beginPath(); g.arc(0, 0, R * 0.03, 0, TAU); g.fillStyle = 'rgba(120,30,20,.5)'; g.fill();
    g.beginPath(); g.arc(0, 0, R * 0.32, 0, TAU); g.setLineDash([R * 0.03, R * 0.025]); g.strokeStyle = 'rgba(150,40,30,.25)'; g.lineWidth = 3; g.stroke(); g.setLineDash([]);
    g.restore();
    // bowl inner shadow near the rim
    g.save(); g.beginPath(); g.ellipse(cx, cy, R, ry, 0, 0, TAU); g.clip();
    g.translate(cx, cy); g.scale(1, TILT);
    const ish = g.createRadialGradient(0, 0, R * 0.62, 0, 0, R * 1.01); ish.addColorStop(0, 'rgba(0,0,0,0)'); ish.addColorStop(1, 'rgba(70,30,0,.5)');
    g.fillStyle = ish; g.fillRect(-R, -R, R * 2, R * 2);
    g.restore();
    return c;
  }

  /* ---------- the gasing ---------- */
  // x,y = contact point on the floor (screen), s = body half-width (px)
  function drawGasing(g, x, y, s, top, t, opt) {
    opt = opt || {};
    const color = top.color || '#d63a2f', wood = WOOD[(top.design | 0) % WOOD.length], spin = Math.max(0, top.spin || 0);
    const ang = top.angle || 0, fast = Math.min(1, spin / 14), wob = top.wobble || 0, faded = opt.alpha == null ? 1 : opt.alpha;
    g.save(); g.globalAlpha = faded;
    // shadow
    const sh = g.createRadialGradient(x + s * 0.25, y + s * 0.08, 0, x + s * 0.25, y + s * 0.08, s * 1.25);
    sh.addColorStop(0, 'rgba(30,12,0,.45)'); sh.addColorStop(1, 'rgba(30,12,0,0)');
    g.fillStyle = sh; g.beginPath(); g.ellipse(x + s * 0.25, y + s * 0.08, s * 1.3, s * 0.55, 0, 0, TAU); g.fill();
    // floor spin ring
    if (spin > 3 && top.thrown) { g.strokeStyle = rgba(color, 0.25 + 0.35 * fast); g.lineWidth = 2 + fast * 2; g.beginPath(); g.ellipse(x, y, s * (0.7 + 0.25 * Math.sin(t * 20)), s * 0.3, 0, 0, TAU); g.stroke(); }
    g.translate(x, y);
    const lean = top.out === 'fall' ? 1.25 : wob * 0.32 * Math.sin(t * (6 + wob * 4) + (top.design | 0));
    g.rotate(lean);
    const h1 = s * 0.95, band = s * 0.34, dome = s * 0.42, H = h1 + band + dome;
    // metal tip
    g.fillStyle = '#5b5f66'; g.beginPath(); g.moveTo(0, 2); g.lineTo(s * 0.16, -s * 0.28); g.lineTo(-s * 0.16, -s * 0.28); g.closePath(); g.fill();
    // lower cone (wood)
    const lg = g.createLinearGradient(-s, 0, s, 0); lg.addColorStop(0, wood[1]); lg.addColorStop(0.35, shade(wood[0], 0.25)); lg.addColorStop(0.6, wood[0]); lg.addColorStop(1, shade(wood[1], -0.3));
    g.fillStyle = lg; g.beginPath(); g.moveTo(-s * 0.14, -s * 0.24); g.quadraticCurveTo(-s * 0.7, -h1 * 0.55, -s, -h1); g.lineTo(s, -h1); g.quadraticCurveTo(s * 0.7, -h1 * 0.55, s * 0.14, -s * 0.24); g.closePath(); g.fill();
    // wood grain rings on the cone that slide with rotation
    g.save(); g.clip();
    for (let i = 0; i < 4; i++) { const yy = -h1 * (0.35 + i * 0.17); g.strokeStyle = 'rgba(40,18,4,.25)'; g.lineWidth = 1; g.beginPath(); g.ellipse(0, yy, s * (0.45 + i * 0.16), s * 0.08, 0, 0, Math.PI); g.stroke(); }
    g.restore();
    // painted band (rim) with rotating stripes
    const bg = g.createLinearGradient(-s, 0, s, 0); bg.addColorStop(0, shade(color, -0.45)); bg.addColorStop(0.3, shade(color, 0.3)); bg.addColorStop(0.55, color); bg.addColorStop(1, shade(color, -0.5));
    g.fillStyle = bg; g.beginPath(); g.moveTo(-s, -h1); g.lineTo(-s * 1.02, -h1 - band * 0.5); g.lineTo(-s, -h1 - band); g.lineTo(s, -h1 - band); g.lineTo(s * 1.02, -h1 - band * 0.5); g.lineTo(s, -h1); g.closePath(); g.fill();
    g.save(); g.clip();
    const n = 6, accent = (top.design | 0) % 2 ? '#f6e7c1' : '#2b1a0e';
    if (fast < 0.85) {
      for (let i = 0; i < n; i++) { const a = ang + i / n * TAU, c = Math.cos(a); if (Math.sin(a) < 0) continue; const xx = c * s; g.fillStyle = rgba(accent === '#2b1a0e' ? '#2b1a0e' : '#f6e7c1', 0.75 * (1 - fast)); g.fillRect(xx - s * 0.09 * Math.sin(a), -h1 - band, s * 0.18 * Math.sin(a), band); }
    }
    if (fast > 0.25) { g.fillStyle = rgba(accent === '#2b1a0e' ? '#2b1a0e' : '#f6e7c1', 0.28 * fast); g.fillRect(-s, -h1 - band * 0.62, s * 2, band * 0.22); }
    g.restore();
    g.strokeStyle = 'rgba(20,8,0,.55)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(-s, -h1); g.lineTo(s, -h1); g.moveTo(-s, -h1 - band); g.lineTo(s, -h1 - band); g.stroke();
    // upper dome
    const dg = g.createLinearGradient(-s, 0, s, 0); dg.addColorStop(0, wood[1]); dg.addColorStop(0.35, shade(wood[0], 0.35)); dg.addColorStop(1, shade(wood[1], -0.25));
    g.fillStyle = dg; g.beginPath(); g.moveTo(-s, -h1 - band); g.quadraticCurveTo(-s * 0.85, -H + s * 0.05, -s * 0.3, -H); g.lineTo(s * 0.3, -H); g.quadraticCurveTo(s * 0.85, -H + s * 0.05, s, -h1 - band); g.closePath(); g.fill();
    // top face (ellipse) with a painted spiral that turns -> shows the spin clearly
    const fx = s * 0.62, fy = s * 0.62 * TILT * 0.75, fyc = -h1 - band - dome * 0.42;
    g.save(); g.beginPath(); g.ellipse(0, fyc, fx, fy, 0, 0, TAU); g.clip();
    g.fillStyle = shade(wood[0], 0.18); g.fillRect(-fx, fyc - fy, fx * 2, fy * 2);
    const copies = fast > 0.4 ? 5 : 1;
    for (let k = 0; k < copies; k++) {
      const a0 = ang - k * 0.35 * fast; g.globalAlpha = faded * (copies > 1 ? 0.28 : 0.9);
      for (let i = 0; i < 3; i++) { const a = a0 + i * TAU / 3; g.fillStyle = i ? (i === 1 ? '#f0b429' : color) : shade(color, -0.3); g.beginPath(); g.moveTo(0, fyc); g.ellipse(0, fyc, fx, fy, 0, a, a + 0.9); g.closePath(); g.fill(); }
    }
    g.globalAlpha = faded;
    g.restore();
    g.strokeStyle = 'rgba(20,8,0,.5)'; g.lineWidth = 1; g.beginPath(); g.ellipse(0, fyc, fx, fy, 0, 0, TAU); g.stroke();
    // knob (pasak) on top
    const kg = g.createLinearGradient(-s * 0.14, 0, s * 0.14, 0); kg.addColorStop(0, '#3b2210'); kg.addColorStop(0.4, '#c9a06a'); kg.addColorStop(1, '#3b2210');
    g.fillStyle = kg; g.beginPath(); g.roundRect ? g.roundRect(-s * 0.13, -H - s * 0.42, s * 0.26, s * 0.5, s * 0.08) : g.rect(-s * 0.13, -H - s * 0.42, s * 0.26, s * 0.5); g.fill();
    g.fillStyle = '#e8cfa0'; g.beginPath(); g.ellipse(0, -H - s * 0.42, s * 0.13, s * 0.05, 0, 0, TAU); g.fill();
    // highlight sheen
    g.fillStyle = 'rgba(255,255,255,.18)'; g.beginPath(); g.ellipse(-s * 0.45, -h1 - band * 0.5, s * 0.12, band * 0.35, 0, 0, TAU); g.fill();
    // spin blur haze
    if (fast > 0.5) { const hz = g.createLinearGradient(-s * 1.2, 0, s * 1.2, 0); hz.addColorStop(0, 'rgba(255,255,255,0)'); hz.addColorStop(0.5, 'rgba(255,255,255,' + (0.12 * fast) + ')'); hz.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = hz; g.fillRect(-s * 1.2, -H, s * 2.4, H); }
    // power auras
    if (top.shield > 0) { g.strokeStyle = 'rgba(120,210,255,.85)'; g.fillStyle = 'rgba(120,210,255,.14)'; g.lineWidth = 2.5; g.beginPath(); g.ellipse(0, -H * 0.5, s * 1.45, H * 0.78, 0, 0, TAU); g.fill(); g.stroke(); }
    if (top.heavy > 0) { g.strokeStyle = 'rgba(200,200,210,.9)'; g.lineWidth = 3; g.setLineDash([4, 4]); g.beginPath(); g.ellipse(0, -h1 - band * 0.5, s * 1.12, s * 0.3, 0, 0, TAU); g.stroke(); g.setLineDash([]); }
    if (top.boost > 0) { for (let i = 0; i < 3; i++) { const a = t * 14 + i * 2.1; g.strokeStyle = 'rgba(255,200,60,.8)'; g.lineWidth = 2; g.beginPath(); g.ellipse(0, -h1 - band * 0.5, s * (1.15 + i * 0.12), s * 0.32, 0, a, a + 1.1); g.stroke(); } }
    g.restore();
    return H;
  }

  function drawPower(g, x, y, s, type, t, life) {
    const bob = Math.sin(t * 4 + x) * s * 0.25, blink = life < 90 && Math.floor(t * 8) % 2 ? 0.45 : 1;
    g.save(); g.globalAlpha = blink;
    g.fillStyle = 'rgba(30,12,0,.3)'; g.beginPath(); g.ellipse(x, y, s * 0.8, s * 0.3, 0, 0, TAU); g.fill();
    const col = type === 'boost' ? '#f0b429' : type === 'shield' ? '#46b3e6' : '#9aa0a6';
    const gg = g.createRadialGradient(x - s * 0.3, y - s * 1.3 + bob, 1, x, y - s * 1.1 + bob, s);
    gg.addColorStop(0, '#fff'); gg.addColorStop(0.35, col); gg.addColorStop(1, shade(col, -0.45));
    g.fillStyle = gg; g.beginPath(); g.arc(x, y - s * 1.1 + bob, s * 0.85, 0, TAU); g.fill();
    g.strokeStyle = 'rgba(255,255,255,.8)'; g.lineWidth = 2; g.stroke();
    g.font = Math.round(s * 1.05) + 'px system-ui,"Apple Color Emoji","Segoe UI Emoji",sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(type === 'boost' ? '⚡' : type === 'shield' ? '🛡️' : '🪨', x, y - s * 1.08 + bob);
    g.restore();
  }

  function pill(g, x, y, text, bg, fg, fs) {
    g.font = '700 ' + fs + 'px system-ui,-apple-system,"Segoe UI",sans-serif'; const w = g.measureText(text).width + fs * 1.1, h = fs * 1.6;
    g.fillStyle = bg; g.beginPath(); g.roundRect ? g.roundRect(x - w / 2, y - h / 2, w, h, h / 2) : g.rect(x - w / 2, y - h / 2, w, h); g.fill();
    g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, x, y + 0.5); return w;
  }

  function Renderer(canvas, opts) {
    opts = opts || {};
    const g = canvas.getContext('2d'); let L = null, floor = null, dpr = 1, key = '';
    const fx = { floats: [], shake: 0, sparks: [], rings: [], dust: [], flash: 0, flashCol: '255,214,90' };
    function fit() {
      const r = canvas.getBoundingClientRect(); const w = Math.max(100, Math.round(r.width)), h = Math.max(100, Math.round(r.height));
      dpr = Math.min(2, root.devicePixelRatio || 1); const k = w + 'x' + h + '@' + dpr;
      if (k === key) return; key = k; canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      L = opts.layout ? opts.layout(w, h) : layout(w, h); L.w = w; L.h = h; floor = buildFloor(L, dpr);
    }
    // view rotation: the local player's seat is always drawn at the BOTTOM of the arena (opponents toward the top)
    let rc = 1, rs = 0, rot = 0;
    function setView(m, localId) {
      let a = 0; const i = m && localId != null ? m.tops.findIndex(q => q.id === localId) : -1;
      if (i >= 0) a = Math.PI / 2 - (Math.PI / 2 + (i / Math.max(1, m.tops.length)) * TAU);
      if (a !== rot) { rot = a; rc = Math.cos(a); rs = Math.sin(a); }
    }
    const P = (x, y) => [L.cx + (x * rc - y * rs) * L.R, L.cy + (x * rs + y * rc) * L.R * TILT];
    const unrot = (x, y) => [x * rc + y * rs, -x * rs + y * rc];
    function toWorld(sx, sy) { return unrot((sx - L.cx) / L.R, (sy - L.cy) / (L.R * TILT)); }
    function toWorldDir(dx, dy) { return unrot(dx, dy); }
    function float(x, y, text, color, scale, droop) { fx.floats.push({ x, y, text, color, life: 1, k: scale || 1, droop: !!droop }); }
    function ring(x, y, col, size, delay) { fx.rings.push({ x, y, col, size: size || 1, life: 1 + (delay || 0) }); }
    function flash(col) { fx.flash = 1; fx.flashCol = col || '255,214,90'; }
    function dust(x, y, n) { for (let i = 0; i < n; i++) { const a = Math.PI + Math.random() * Math.PI, v = 0.3 + Math.random() * 0.9; fx.dust.push({ x: x + (Math.random() - 0.5) * 10, y, vx: Math.cos(a) * v * 1.4, vy: Math.sin(a) * v * 0.5, r: 4 + Math.random() * 6, life: 1 }); } }
    function burst(x, y, n, col) { for (let i = 0; i < n; i++) { const a = Math.random() * TAU, v = 0.3 + Math.random() * 1.2; fx.sparks.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 1, col }); } }
    function draw(m, o) {
      fit(); o = o || {}; const t = performance.now() / 1000, dt = 1 / 60;
      setView(m, o.localId);
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      let sx = 0, sy = 0; if (fx.shake > 0) { sx = (Math.random() - 0.5) * fx.shake; sy = (Math.random() - 0.5) * fx.shake; fx.shake *= 0.86; if (fx.shake < 0.3) fx.shake = 0; }
      g.translate(sx, sy);
      g.drawImage(floor, 0, 0, L.w, L.h);
      if (!m) return;
      const s = L.R * 0.1;
      // centre glow in fight
      for (const p of m.powers || []) { const [px, py] = P(p.x, p.y); drawPower(g, px, py, s * 0.75, p.type, t, p.life); }
      // aim helpers
      const me = o.localId != null ? m.tops.find(q => q.id === o.localId) : null;
      const items = m.tops.map(top => ({ top, p: P(top.x, top.y) })).sort((a, b) => a.p[1] - b.p[1]);
      if (m.phase === 'aim' && me && me.alive && !me.thrown) {
        const [mx, my] = P(me.x, me.y), pulse = 1 + Math.sin(t * 5) * 0.12;
        g.strokeStyle = 'rgba(255,255,255,.9)'; g.lineWidth = 3; g.setLineDash([8, 6]); g.beginPath(); g.ellipse(mx, my, s * 1.9 * pulse, s * 0.8 * pulse, 0, 0, TAU); g.stroke(); g.setLineDash([]);
        const aim = o.aim; const dir = aim ? [aim.dx, aim.dy] : [me.ax, me.ay], pw = aim ? (aim.locked ? 0.75 + 0.1 * Math.sin(t * 10) : 0.7) : 0.35;
        const L2 = Math.hypot(dir[0], dir[1]) || 1, ux = dir[0] / L2, uy = dir[1] / L2;
        const steps = 10, reach = 0.25 + pw * 0.9;
        for (let i = 1; i <= steps; i++) { const k = i / steps; const [qx, qy] = P(me.x + ux * reach * k, me.y + uy * reach * k); g.fillStyle = aim ? (aim.locked ? 'rgba(255,210,63,' + (1 - k * 0.5) + ')' : 'rgba(255,240,200,' + (1 - k * 0.6) + ')') : 'rgba(255,255,255,' + (0.5 - k * 0.35) + ')'; g.beginPath(); g.arc(qx, qy, 3 + (1 - k) * 3, 0, TAU); g.fill(); }
        const [hx, hy] = P(me.x + ux * reach, me.y + uy * reach); g.fillStyle = aim ? '#ffd23f' : 'rgba(255,255,255,.6)'; g.beginPath(); const an = Math.atan2(hy - my, hx - mx); g.moveTo(hx + Math.cos(an) * 12, hy + Math.sin(an) * 12); g.lineTo(hx + Math.cos(an + 2.5) * 10, hy + Math.sin(an + 2.5) * 10); g.lineTo(hx + Math.cos(an - 2.5) * 10, hy + Math.sin(an - 2.5) * 10); g.closePath(); g.fill();
        if (aim && aim.locked) { g.strokeStyle = 'rgba(255,210,63,.7)'; g.lineWidth = 3; g.beginPath(); g.ellipse(mx, my, s * 2.3, s * 1, 0, 0, TAU); g.stroke(); }
      }
      for (const { top, p } of items) {
        const out = !top.alive; if (out && top.out === 'ring') continue;
        if (!out && top.thrown) {
          const early = m.phase === 'aim' || (m.phase === 'fight' && m.tick < 75), sp = Math.hypot(top.vx, top.vy);
          if (top.tq === 3 && early) {
            // Perfect: golden aura + afterimage trail
            const gl = g.createRadialGradient(p[0], p[1] - s, 2, p[0], p[1] - s, s * 2.6); gl.addColorStop(0, 'rgba(255,214,90,.55)'); gl.addColorStop(1, 'rgba(255,214,90,0)');
            g.fillStyle = gl; g.beginPath(); g.ellipse(p[0], p[1] - s, s * 2.6, s * 2.2, 0, 0, TAU); g.fill();
            if (m.phase === 'fight' && sp > 0.05) for (let k = 4; k >= 1; k--) { const [qx, qy] = P(top.x - top.vx * 0.035 * k, top.y - top.vy * 0.035 * k); drawGasing(g, qx, qy, s * (1 - k * 0.05), Object.assign({}, top, { shield: 0, heavy: 0, boost: 0 }), t, { alpha: 0.22 - k * 0.04 }); }
          } else if (top.tq === 0 && early && Math.random() < 0.25) dust(p[0], p[1], 1);
        }
        const H = drawGasing(g, p[0], p[1], s, top, t, { alpha: out ? 0.55 : 1 });
        if (opts.labels === false) continue;
        const mine = me && top.id === me.id, ny = p[1] - H - s * 1.05;
        pill(g, p[0], ny, (mine ? '★ ' : '') + top.name.slice(0, 12), mine ? '#ffd23f' : 'rgba(25,14,6,.72)', mine ? '#2b1a0e' : '#fff', Math.max(10, Math.round(s * 0.5)));
        if (top.thrown && top.alive) { const bw = s * 1.6, frac = Math.max(0, Math.min(1, top.spin / (top.spin0 || 1))); g.fillStyle = 'rgba(0,0,0,.45)'; g.fillRect(p[0] - bw / 2, ny + s * 0.5, bw, 4); g.fillStyle = frac > 0.5 ? '#7bd36b' : frac > 0.25 ? '#ffd23f' : '#ff5a3c'; g.fillRect(p[0] - bw / 2, ny + s * 0.5, bw * frac, 4); }
      }
      for (const sp of m.sparks || []) { const [px, py] = P(sp.x, sp.y); const a = Math.min(1, sp.life / 14); g.fillStyle = sp.k === 2 ? 'rgba(140,220,255,' + a + ')' : sp.k === 1 ? 'rgba(255,120,60,' + a + ')' : 'rgba(255,230,140,' + a + ')'; g.beginPath(); g.arc(px, py - s * 0.9, 2 + a * 2, 0, TAU); g.fill(); }
      fx.sparks = fx.sparks.filter(q => { q.life -= dt * 1.8; q.x += q.vx * 3; q.y += q.vy * 3 - 0.5; q.vy += 0.05; if (q.life <= 0) return false; g.fillStyle = q.col || '#ffd23f'; g.globalAlpha = q.life; g.fillRect(q.x, q.y, 4, 4); g.globalAlpha = 1; return true; });
      fx.rings = fx.rings.filter(r => { r.life -= dt * 1.6; if (r.life <= 0) return false; if (r.life > 1) return true; const k = 1 - r.life; g.globalAlpha = r.life; g.strokeStyle = r.col; g.lineWidth = 2 + 6 * r.life; g.beginPath(); g.ellipse(r.x, r.y, s * (0.6 + 4.5 * k) * r.size, s * (0.25 + 2 * k) * r.size, 0, 0, TAU); g.stroke(); g.globalAlpha = 1; return true; });
      fx.dust = fx.dust.filter(d => { d.life -= dt * 1.3; if (d.life <= 0) return false; d.x += d.vx; d.y += d.vy; d.vx *= 0.94; d.vy *= 0.94; d.r += 0.25; g.fillStyle = 'rgba(150,130,105,' + (0.45 * d.life) + ')'; g.beginPath(); g.arc(d.x, d.y, d.r, 0, TAU); g.fill(); return true; });
      fx.floats = fx.floats.filter(f => { f.life -= dt * 0.7; if (f.life <= 0) return false; const pop = f.droop ? 1 : 1 + Math.max(0, f.life - 0.8) * 2.5; g.globalAlpha = Math.min(1, f.life * 2); g.font = '900 ' + Math.round(s * 0.9 * f.k * pop) + 'px system-ui,sans-serif'; g.textAlign = 'center'; g.lineWidth = 5; g.strokeStyle = 'rgba(40,15,0,.85)'; const yy = f.droop ? f.y + (1 - f.life) * 22 : f.y - (1 - f.life) * 50; g.save(); g.translate(f.x, yy); if (f.droop) g.rotate(-0.12 + Math.sin((1 - f.life) * 9) * 0.06); g.strokeText(f.text, 0, 0); g.fillStyle = f.color || '#fff'; g.fillText(f.text, 0, 0); g.restore(); g.globalAlpha = 1; return true; });
      if (fx.flash > 0) { g.fillStyle = 'rgba(' + fx.flashCol + ',' + (0.38 * fx.flash) + ')'; g.fillRect(-20, -20, L.w + 40, L.h + 40); fx.flash -= dt * 2.6; }
    }
    return { draw, fit, toWorld, toWorldDir, setView, get rotation() { return rot; }, P: (x, y) => { fit(); return P(x, y); }, float, burst, ring, flash, dust, shake: v => { fx.shake = Math.max(fx.shake, v); }, get layout() { fit(); return L; } };
  }

  root.GARender = { Renderer, drawGasing, TILT };
})(typeof window !== 'undefined' ? window : globalThis);

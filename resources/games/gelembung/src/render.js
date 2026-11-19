/* Duel Gelembung: canvas renderer (glossy ball sprites with colour-blind symbols, particles, shake, fog, banners). */
(function (root) {
'use strict';
const D = root.DG;
let PAL = ['#0072B2', '#E69F00', '#009E73', '#F0E442', '#CC79A7', '#56B4E9'], INK = [];
const LOSE_Y = (D.LOSE - 1) * D.RH + 1;
const rgb = h => { const n = parseInt(h.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
const lum = h => { const c = rgb(h).map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
const contrast = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
const mixc = (h, t, k) => { const a = rgb(h), b = rgb(t); return 'rgb(' + a.map((v, i) => Math.round(v + (b[i] - v) * k)).join(',') + ')'; };
/** symbol ink per colour: whichever of white / deep ink contrasts more with the ball colour */
function setPalette(list) { if (Array.isArray(list) && list.length >= 6) PAL = list.slice(0, 6).map(c => (c && c.hex) || c); INK = PAL.map(c => contrast(c, '#ffffff') >= contrast(c, '#1b1640') ? '#ffffff' : '#1b1640'); cache.clear(); }
const cache = new Map();
function shapePath(g, s, r) {
  g.beginPath();
  if (s === 0) { g.arc(0, 0, r * 0.78, 0, Math.PI * 2); g.moveTo(r * 0.38, 0); g.arc(0, 0, r * 0.38, 0, Math.PI * 2, true); }
  else if (s === 1) { g.moveTo(0, -r * 0.86); g.lineTo(r * 0.84, r * 0.6); g.lineTo(-r * 0.84, r * 0.6); g.closePath(); }
  else if (s === 2) { const a = r * 0.68; g.rect(-a, -a, a * 2, a * 2); }
  else if (s === 3) { for (let i = 0; i < 10; i++) { const rr = i % 2 ? r * 0.4 : r * 0.92, an = -Math.PI / 2 + i * Math.PI / 5; g.lineTo(Math.cos(an) * rr, Math.sin(an) * rr); } g.closePath(); }
  else if (s === 4) { g.moveTo(0, r * 0.82); g.bezierCurveTo(-r * 1.1, r * 0.05, -r * 0.62, -r * 0.95, 0, -r * 0.38); g.bezierCurveTo(r * 0.62, -r * 0.95, r * 1.1, r * 0.05, 0, r * 0.82); g.closePath(); }
  else { g.moveTo(0, -r * 0.95); g.lineTo(r * 0.72, 0); g.lineTo(0, r * 0.95); g.lineTo(-r * 0.72, 0); g.closePath(); }
}
function symbol(g, c, r, alpha) {
  g.save(); g.globalAlpha = alpha == null ? 1 : alpha; shapePath(g, c, r * 0.5);
  g.fillStyle = INK[c] || '#fff'; g.fill('evenodd'); g.lineWidth = Math.max(1, r * 0.07); g.strokeStyle = INK[c] === '#ffffff' ? 'rgba(0,0,0,.35)' : 'rgba(255,255,255,.35)'; g.stroke(); g.restore();
}
function gloss(g, r, k) {
  g.save(); g.globalAlpha = k == null ? 0.55 : k; g.fillStyle = '#fff'; g.beginPath(); g.ellipse(-r * 0.32, -r * 0.42, r * 0.34, r * 0.2, -0.6, 0, Math.PI * 2); g.fill();
  g.globalAlpha *= 0.9; g.beginPath(); g.arc(r * 0.38, r * 0.34, r * 0.07, 0, Math.PI * 2); g.fill(); g.restore();
}
function orb(g, r, base, rimDark) {
  const gr = g.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.1, 0, 0, r);
  gr.addColorStop(0, mixc(base, '#ffffff', 0.45)); gr.addColorStop(0.55, base); gr.addColorStop(1, mixc(base, '#000000', rimDark == null ? 0.38 : rimDark));
  g.fillStyle = gr; g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2); g.fill();
  g.lineWidth = Math.max(1, r * 0.06); g.strokeStyle = 'rgba(0,0,0,.35)'; g.stroke();
}
/** ball sprite (px = diameter in device pixels), cached */
function sprite(k, c, px) {
  const key = k + (c | 0) + '@' + px; let cv = cache.get(key); if (cv) return cv;
  cv = document.createElement('canvas'); cv.width = cv.height = px + 2; const g = cv.getContext('2d'), r = px / 2; g.translate(r + 1, r + 1);
  const col = PAL[c] || PAL[0], sym = px >= 11;
  if (k === 'x') {
    orb(g, r, '#80858f', 0.5); g.strokeStyle = 'rgba(30,30,40,.55)'; g.lineWidth = Math.max(1, r * 0.08); g.beginPath(); g.moveTo(-r * 0.5, -r * 0.1); g.lineTo(-r * 0.1, r * 0.05); g.lineTo(r * 0.05, r * 0.45); g.moveTo(-r * 0.1, r * 0.05); g.lineTo(r * 0.45, -r * 0.2); g.stroke();
    g.fillStyle = 'rgba(255,255,255,.25)'; [[-.4, .4], [.35, .45], [.1, -.5]].forEach(([x, y]) => { g.beginPath(); g.arc(x * r, y * r, r * 0.07, 0, 7); g.fill(); }); gloss(g, r, 0.25);
  } else if (k === 'h') {
    orb(g, r, '#3d3656', 0.5); g.fillStyle = '#e9e4ff'; g.font = '800 ' + Math.round(r * 1.1) + 'px system-ui,sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('?', 0, r * 0.06); gloss(g, r, 0.3);
  } else if (k === 'r') {
    const cg = g.createConicGradient ? g.createConicGradient(0, 0, 0) : null;
    if (cg) { PAL.concat([PAL[0]]).forEach((p, i) => cg.addColorStop(i / 6, p)); g.fillStyle = cg; } else g.fillStyle = PAL[3];
    g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2); g.fill(); g.lineWidth = Math.max(1, r * 0.06); g.strokeStyle = 'rgba(0,0,0,.35)'; g.stroke();
    g.fillStyle = '#fff'; shapePath(g, 3, r * 0.55); g.fill(); g.strokeStyle = 'rgba(0,0,0,.4)'; g.stroke(); gloss(g, r);
  } else if (k === 'b') {
    orb(g, r * 0.92, '#2b2b36', 0.6); g.fillStyle = '#9a9aa8'; g.fillRect(-r * 0.18, -r * 1.02, r * 0.36, r * 0.24);
    g.strokeStyle = '#ffcf5a'; g.lineWidth = Math.max(1, r * 0.09); g.beginPath(); g.moveTo(0, -r * 0.95); g.quadraticCurveTo(r * 0.3, -r * 1.15, r * 0.45, -r * 0.95); g.stroke();
    g.fillStyle = '#ff5a36'; g.font = '900 ' + Math.round(r * 0.8) + 'px system-ui,sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('✸', 0, r * 0.12); gloss(g, r * 0.9, 0.35);
  } else {
    orb(g, r, col); if (sym) symbol(g, c, r, k === 'e' ? 0.7 : 1); gloss(g, r, k === 'e' ? 0.25 : 0.55);
    if (k === 'e') {
      g.fillStyle = 'rgba(215,245,255,.5)'; g.beginPath(); g.arc(0, 0, r * 0.98, 0, 7); g.fill(); g.strokeStyle = '#f2fdff'; g.lineWidth = Math.max(1.2, r * 0.12); g.stroke();
      g.strokeStyle = 'rgba(255,255,255,.85)'; g.lineWidth = Math.max(1, r * 0.06); g.beginPath(); g.moveTo(-r * 0.6, -r * 0.2); g.lineTo(-r * 0.2, -r * 0.6); g.moveTo(r * 0.1, r * 0.7); g.lineTo(r * 0.6, r * 0.25); g.moveTo(-r * 0.5, r * 0.4); g.lineTo(-r * 0.25, r * 0.6); g.stroke();
      if (sym) symbol(g, c, r, 0.45);
    } else if (k === 'g') {
      g.fillStyle = 'rgba(20,16,40,.28)'; g.beginPath(); g.arc(0, 0, r, 0, 7); g.fill();
      const s = r * 0.62, x = r * 0.3, y = r * 0.32; g.strokeStyle = '#d9d9e3'; g.lineWidth = Math.max(1.5, s * 0.22); g.beginPath(); g.arc(x, y - s * 0.35, s * 0.36, Math.PI, 0); g.stroke();
      g.fillStyle = '#f5c542'; g.strokeStyle = '#5b4300'; g.lineWidth = Math.max(1, s * 0.1); g.beginPath(); g.rect(x - s * 0.52, y - s * 0.38, s * 1.04, s * 0.82); g.fill(); g.stroke();
      g.fillStyle = '#5b4300'; g.beginPath(); g.arc(x, y, s * 0.12, 0, 7); g.fill();
    } else if (k === 'w') {
      g.strokeStyle = '#1b1640'; g.lineWidth = Math.max(2, r * 0.22); g.beginPath(); g.arc(0, 0, r * 0.66, 0, 7); g.stroke();
      g.fillStyle = 'rgba(27,22,64,.82)'; g.beginPath(); g.arc(0, 0, r * 0.55, 0, 7); g.fill();
    }
  }
  cache.set(key, cv); return cv;
}
/* ---------------- board view ---------------- */
const rand = Math.random;
class BoardView {
  constructor(canvas, { mini = false } = {}) { this.cv = canvas; this.g = canvas.getContext('2d'); this.mini = mini; this.parts = []; this.texts = []; this.banner = null; this.big = null; this.hitF = null; this.shake = 0; this.cs = 20; this.dpr = 1; this.last = 0; this.flashes = []; this.reduced = false; }
  get cap() { return this.mini ? 40 : this.reduced ? 70 : 320; }
  resize(w, h) {
    const dpr = Math.min(2, root.devicePixelRatio || 1), cs = Math.max(4, Math.floor(Math.min(w / D.W, h / D.H) * 4) / 4);
    if (cs === this.cs && dpr === this.dpr && this.cv.width) return; this.cs = cs; this.dpr = dpr;
    const pw = Math.round(cs * D.W), ph = Math.round(cs * D.H); this.cv.width = Math.round(pw * dpr); this.cv.height = Math.round(ph * dpr); this.cv.style.width = pw + 'px'; this.cv.style.height = ph + 'px';
  }
  /** canvas px → board units */
  toBoard(clientX, clientY) { const r = this.cv.getBoundingClientRect(); return [(clientX - r.left) / this.cs, (clientY - r.top) / this.cs]; }
  kick(n) { if (!this.reduced) this.shake = Math.min(1.2, this.shake + n); }
  /** confetti from the top / a point; n is capped by the particle budget */
  confetti(n, x, y) {
    if (this.reduced) n = Math.min(n, 6); if (this.mini) n = Math.min(n, 8);
    for (let i = 0; i < n && this.parts.length < this.cap; i++) { const fromTop = x == null, a = fromTop ? Math.PI / 2 + (rand() - 0.5) * 0.8 : -Math.PI / 2 + (rand() - 0.5) * 2.2, sp = fromTop ? 1 + rand() * 2 : 5 + rand() * 6;
      this.parts.push({ t: 'conf', x: fromTop ? rand() * D.W : x, y: fromTop ? -0.3 - rand() * 1.5 : y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, rot: rand() * 6, vr: (rand() - 0.5) * 14, age: 0, life: 1.6 + rand() * 1.1, col: PAL[(rand() * 6) | 0], w: 0.16 + rand() * 0.12, h: 0.08 + rand() * 0.05 }); }
  }
  /** DOUBLE / TRIPLE: flash + rays + bouncing label */
  bigBanner(s, n, color) { this.big = { s, n, color: color || (n >= 3 ? '#F0E442' : '#56B4E9'), born: this.last }; this.kick(0.35 + 0.2 * n); this.confetti(18 * n); }
  /** victim reaction: tinted flash + shake scaled by the stack */
  hitFx(n, color) { this.hitF = { n: n || 1, color: color || '#ff6b6b', born: this.last }; this.kick(0.35 + 0.25 * (n || 1)); }
  text(x, y, s, o) { this.texts.push(Object.assign({ x, y, s, born: this.last, life: 1100, size: 0.5, color: '#fff' }, o || {})); }
  setBanner(s, color, icon) { this.banner = { s, color: color || '#F0E442', icon: icon || '', born: this.last }; }
  burst(x, y, c, n, kind) {
    const col = c >= 0 ? PAL[c] : '#dfe6f5', cap = Math.min(this.mini ? 4 : (this.reduced ? 4 : n), this.cap - this.parts.length);
    for (let i = 0; i < cap; i++) { const a = rand() * Math.PI * 2, sp = 2 + rand() * 4; this.parts.push({ t: kind || 'dot', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 1, life: 0.45 + rand() * 0.35, age: 0, col, r: 0.07 + rand() * 0.08 }); }
  }
  /** sim fx → particles / floating text / shake; returns nothing (sound handled by the app) */
  feed(fx, b) {
    for (const e of fx) {
      if (e.k === 'pop') { this.burst(e.x, e.y, e.t === 'n' || e.t === 'w' || e.t === 'h' ? e.c : -1, 12); this.burst(e.x, e.y, -1, 3, 'star'); this.parts.push({ t: 'ring', x: e.x, y: e.y, age: 0, life: 0.4, col: PAL[e.c] || '#fff', r: 0.55, w: 0.14 }); }
      else if (e.k === 'drop') this.parts.push({ t: 'ball', k: e.t, c: e.c, x: e.x, y: e.y, vx: (rand() - 0.5) * 3 + (e.x - D.W / 2) * 0.5, vy: -2 - rand() * 3, rot: 0, vr: (rand() - 0.5) * 10, age: 0, life: 3.2 });
      else if (e.k === 'boom') { this.parts.push({ t: 'ring', x: e.x, y: e.y, age: 0, life: 0.5, col: '#ffcf5a', r: e.r + 0.5, w: 0.25 }); this.burst(e.x, e.y, -1, 18, 'spark'); this.kick(0.55); }
      else if (e.k === 'crack') { this.burst(e.x, e.y, -1, 8, 'shard'); }
      else if (e.k === 'unlock') { this.text(e.x, e.y - 0.2, '🔓', { size: 0.6, life: 800 }); this.burst(e.x, e.y, -1, 6, 'spark'); }
      else if (e.k === 'reveal') { this.parts.push({ t: 'ring', x: e.x, y: e.y, age: 0, life: 0.4, col: '#e9e4ff', r: 0.6 }); }
      else if (e.k === 'row') { this.kick(0.3); for (let i = 0; i < D.W; i++) this.parts.push({ t: 'dot', x: i + 0.5, y: 0.1, vx: (rand() - 0.5), vy: 1 + rand() * 2, life: 0.5, age: 0, col: '#cfc8ff', r: 0.06 }); }
      else if (e.k === 'fuse') { this.kick(0.5); this.burst(e.x, e.y, -1, 14, 'spark'); this.setBanner('+1', '#ff7a59', '⏱️'); }
      else if (e.k === 'score' && !this.mini) {
        const size = e.pops + e.drops, pts = e.pops * 10 + e.drops * 20 + (e.drops >= 6 ? 100 : 0);
        if (pts) this.text(e.x, e.y, '+' + Math.round(pts * (1 + 0.5 * Math.min(4, e.combo - 1))), { size: 0.45 + Math.min(0.35, size * 0.02) });
        if (e.gain) this.text(e.x + 0.9, e.y + 0.6, '⚡+' + e.gain, { size: 0.42, color: '#F0E442', life: 1000 });
        this.kick(Math.min(0.9, 0.08 + size * 0.045));
        if (e.combo >= 2) this.text(D.W / 2, 4.6, (root.DGR.comboLabel || 'COMBO ×{n}!').replace('{n}', e.combo), { size: 0.7 + Math.min(0.5, e.combo * 0.08), color: COMBO_COL[Math.min(COMBO_COL.length - 1, e.combo - 2)], life: 1200, big: 1, pop: 1 });
        if (e.huge) { this.confetti(34); this.parts.push({ t: 'ring', x: e.x, y: e.y, age: 0, life: 0.6, col: '#F0E442', r: 1.2, w: 0.3 }); }
        else if (e.big) this.confetti(14);
      }

      else if (e.k === 'clear' && !this.mini) { this.text(D.W / 2, 3, 'Papan bersih! +500', { size: 0.8, color: '#F0E442', life: 1800, big: 1 }); }
      else if (e.k === 'hard') { this.flashes.push({ x: e.x, y: e.y, t: e.t, age: 0 }); }
      else if (e.k === 'hit') this.kick(0.3 + 0.2 * (e.n || 1));
      else if (e.k === 'out') this.kick(0.8);
      else if (e.k === 'landed' && e.bounces && !this.mini) this.parts.push({ t: 'ring', x: 0, y: 0, age: 0, life: 0.01, col: '#fff', r: 0 });
    }
  }
  step(dt) {
    const s = dt / 1000;
    for (const p of this.parts) {
      p.age += s; if (p.t === 'ring') continue;
      if (p.t === 'conf') { p.vy += 6 * s; p.vx *= 1 - 1.6 * s; p.vy *= 1 - 1.2 * s; p.vx += Math.sin(p.age * 7 + p.rot) * 2 * s; }
      else p.vy += (p.t === 'ball' ? 26 : p.t === 'star' ? 4 : 9) * s;
      p.x += p.vx * s; p.y += p.vy * s; if (p.rot !== undefined) p.rot += p.vr * s;
      if (p.t === 'ball') { // falling bubbles bounce on the floor once and pinball off the walls before leaving
        if (p.x < 0.5 || p.x > D.W - 0.5) { p.vx = -p.vx * 0.8; p.x = Math.max(0.5, Math.min(D.W - 0.5, p.x)); }
        if (!p.bn && p.y > LOSE_Y + 0.5) { p.bn = 1; p.vy = -Math.abs(p.vy) * 0.55 - 2; p.vx = p.vx * 1.4 + (p.x < D.W / 2 ? -2 : 2); this.parts.push({ t: 'ring', x: p.x, y: p.y, age: 0, life: 0.25, col: PAL[p.c] || '#fff', r: 0.3 }); }
      }
    }
    this.parts = this.parts.filter(p => p.age < p.life && p.y < D.H + 1.5); if (this.parts.length > this.cap) this.parts.splice(0, this.parts.length - this.cap);
    this.texts = this.texts.filter(x => this.last - x.born < x.life); for (const f of this.flashes) f.age += s; this.flashes = this.flashes.filter(f => f.age < 0.9);
    this.shake = Math.max(0, this.shake - s * 1.8);
  }
  /**
   * o: { now, aim: angle|null, aimLen, showNext: 1|2, fog: bool, wob: bool, me: bool, color, label, dim, warn, target }
   */
  draw(b, o) {
    o = o || {}; const now = o.now || 0, dt = this.last ? Math.min(80, now - this.last) : 16; this.last = now; this.step(dt);
    const g = this.g, cs = this.cs, dpr = this.dpr, W = D.W, H = D.H;
    g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W * cs, H * cs);
    const warn = o.warn && !this.reduced, j = (this.shake * this.shake * 0.35 + (warn ? 0.035 : 0)) * cs, sx = (rand() - 0.5) * j * 2, sy = (rand() - 0.5) * j * 2;
    // panel
    const bg = g.createLinearGradient(0, 0, 0, H * cs); bg.addColorStop(0, '#2a2160'); bg.addColorStop(1, '#130f2e'); g.fillStyle = bg; g.fillRect(0, 0, W * cs, H * cs);
    if (o.target) { g.strokeStyle = '#F0E442'; g.lineWidth = Math.max(2, cs * 0.12); g.strokeRect(1, 1, W * cs - 2, H * cs - 2); }
    g.save(); g.translate(sx, sy);
    // danger glow when the stack nears the line
    const low = b && b.g ? D.lowest(b) : -1;
    if (low >= D.LOSE - 3 && !b.out) { const k = (low - (D.LOSE - 4)) / 3, pulse = 0.5 + 0.5 * Math.sin(now / 160); const dg = g.createLinearGradient(0, LOSE_Y * cs - cs * 3, 0, LOSE_Y * cs); dg.addColorStop(0, 'rgba(255,60,60,0)'); dg.addColorStop(1, 'rgba(255,60,60,' + (0.12 + 0.18 * pulse) * k + ')'); g.fillStyle = dg; g.fillRect(0, LOSE_Y * cs - cs * 3, W * cs, cs * 3); }
    // lose line
    g.strokeStyle = 'rgba(255,107,107,.9)'; g.lineWidth = Math.max(1, cs * 0.06); g.setLineDash([cs * 0.25, cs * 0.18]); g.beginPath(); g.moveTo(0, LOSE_Y * cs); g.lineTo(W * cs, LOSE_Y * cs); g.stroke(); g.setLineDash([]);
    // ceiling plate
    g.fillStyle = warn ? (Math.floor(now / 120) % 2 ? '#ff6b6b' : '#8d7dff') : '#5d50b8'; g.fillRect(0, 0, W * cs, Math.max(2, cs * 0.1));
    if (b && b.g) {
      const px = Math.round(cs * 0.98 * dpr) / dpr, half = px / 2, dp = Math.round(px * dpr);
      for (let r = 0; r < b.g.length; r++) { const row = b.g[r]; for (let c = 0; c < row.length; c++) { const v = row[c]; if (!v) continue; const x = D.cx(b, r, c) * cs, y = D.cy(r) * cs;
        g.drawImage(sprite(v.k, v.c, dp), x - half - 1 / dpr, y - half - 1 / dpr, px + 2 / dpr, px + 2 / dpr);
        if (v.k === 'w') { g.fillStyle = '#fff'; g.font = '800 ' + Math.round(px * 0.42) + 'px system-ui,sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(Math.max(0, Math.ceil((v.tm || 0) / 1000))), x, y + px * 0.03); }
        if (v.k === 'b') { const sp = 0.6 + 0.4 * Math.sin(now / 60 + r + c); g.fillStyle = 'rgba(255,220,90,' + sp + ')'; g.beginPath(); g.arc(x + px * 0.24, y - px * 0.5, px * 0.08, 0, 7); g.fill(); }
      } }
      // skill placement flashes
      for (const f of this.flashes) { const k = 1 - f.age / 0.9; g.strokeStyle = 'rgba(240,228,66,' + k + ')'; g.lineWidth = Math.max(2, cs * 0.12); g.beginPath(); g.arc(f.x * cs, f.y * cs, cs * (0.5 + f.age * 0.9), 0, 7); g.stroke(); }
      // fog over the top rows (4, more when stacked)
      if (o.fog) { const fh = ((o.fogR || 4) * D.RH + 0.6) * cs; const fgd = g.createLinearGradient(0, 0, 0, fh + cs * 0.6); fgd.addColorStop(0, 'rgba(200,205,220,.97)'); fgd.addColorStop(0.82, 'rgba(185,190,210,.95)'); fgd.addColorStop(1, 'rgba(185,190,210,0)'); g.fillStyle = fgd; g.fillRect(0, 0, W * cs, fh + cs * 0.6);
        g.fillStyle = 'rgba(255,255,255,.35)'; for (let i = 0; i < 6; i++) { const x = ((i * 1.7 + now / 900) % (W + 2)) - 1, y = 0.8 + (i % 3) * 1.1; g.beginPath(); g.ellipse(x * cs, y * cs, cs * 1.3, cs * 0.5, 0, 0, 7); g.fill(); } }
      // aim line (dotted, bounces) + landing ghost
      if (o.aim != null && !b.out && b.cur) {
        const tr = D.trace(b, o.aim), len = o.aimLen || 9, col = b.cur.k === 'n' ? PAL[b.cur.c] : '#ffffff'; let d = 0, acc = 0;
        g.fillStyle = col; for (let i = 1; i < tr.pts.length && d < len; i++) { const a = tr.pts[i - 1], z = tr.pts[i], l = Math.hypot(z[0] - a[0], z[1] - a[1]); for (let u = acc; u < l && d + u - acc < len; u += 0.42) { const k = u / l, x = a[0] + (z[0] - a[0]) * k, y = a[1] + (z[1] - a[1]) * k; g.globalAlpha = 0.9 - 0.6 * (d + u - acc) / len; g.beginPath(); g.arc(x * cs, y * cs, cs * 0.085, 0, 7); g.fill(); } d += l; acc = 0; } g.globalAlpha = 1;
        let total = 0; for (let i = 1; i < tr.pts.length; i++) total += Math.hypot(tr.pts[i][0] - tr.pts[i - 1][0], tr.pts[i][1] - tr.pts[i - 1][1]);
        if (tr.cell && total <= len + 0.5) { const x = D.cx(b, tr.cell[0], tr.cell[1]) * cs, y = D.cy(tr.cell[0]) * cs; g.strokeStyle = 'rgba(255,255,255,.75)'; g.lineWidth = Math.max(1, cs * 0.06); g.setLineDash([cs * 0.12, cs * 0.1]); g.beginPath(); g.arc(x, y, cs * 0.44, 0, 7); g.stroke(); g.setLineDash([]); }
      }
      // cannon
      const ccx = W / 2 * cs, ccy = D.CY * cs, ang = o.aim != null ? o.aim : (b.lastAng || Math.PI / 2);
      g.save(); g.translate(ccx, ccy + cs * 0.15); g.rotate(-ang + Math.PI / 2);
      g.fillStyle = '#8d7dff'; g.strokeStyle = '#1b1640'; g.lineWidth = Math.max(1, cs * 0.06); g.beginPath(); g.roundRect ? g.roundRect(-cs * 0.2, -cs * 1.05, cs * 0.4, cs * 0.8, cs * 0.1) : g.rect(-cs * 0.2, -cs * 1.05, cs * 0.4, cs * 0.8); g.fill(); g.stroke(); g.restore();
      g.fillStyle = o.color || '#5d50b8'; g.beginPath(); g.arc(ccx, ccy + cs * 0.55, cs * 0.75, Math.PI, 0); g.fill(); g.strokeStyle = '#1b1640'; g.stroke();
      if (b.cur && !b.out) { const px2 = Math.round(cs * 0.96 * dpr); g.drawImage(sprite(b.cur.k, b.cur.c, px2), ccx - px2 / dpr / 2, ccy - px2 / dpr / 2, px2 / dpr, px2 / dpr); }
      if (!this.mini && b.next && !b.out) {
        const n = Math.min(o.showNext || 1, b.next.length);
        for (let i = 0; i < n; i++) { const pxn = Math.round(cs * (i ? 0.55 : 0.72) * dpr), x = cs * (1.05 + i * 0.95), y = ccy + cs * 0.25; g.drawImage(sprite(b.next[i].k, b.next[i].c, pxn), x - pxn / dpr / 2, y - pxn / dpr / 2, pxn / dpr, pxn / dpr); }
        g.fillStyle = 'rgba(255,255,255,.8)'; g.font = '700 ' + Math.max(9, Math.round(cs * 0.3)) + 'px system-ui,sans-serif'; g.textAlign = 'center'; g.textBaseline = 'top'; g.fillText(o.swapLabel || '', cs * 1.05, ccy + cs * 0.68);
      }
      // flying ball
      if (b.fly) { const p = D.flyPos(b.fly), pxf = Math.round(cs * 0.96 * dpr); g.drawImage(sprite(b.fly.v.k, b.fly.v.c, pxf), p[0] * cs - pxf / dpr / 2, p[1] * cs - pxf / dpr / 2, pxf / dpr, pxf / dpr); }
      // wind swirl while aim wobbles
      if (o.wob) { g.strokeStyle = 'rgba(160,255,220,.55)'; g.lineWidth = Math.max(1, cs * 0.07); for (let i = 0; i < 4; i++) { const y = (2 + i * 2.3) * cs, ph = now / 220 + i; g.beginPath(); for (let x = 0; x <= W * cs; x += cs * 0.4) g.lineTo(x, y + Math.sin(x / cs + ph) * cs * 0.25); g.stroke(); } }
    }
    // particles
    const pxp = Math.round(cs * 0.96 * dpr);
    for (const p of this.parts) {
      const k = 1 - p.age / p.life;
      if (p.t === 'ring') { g.strokeStyle = p.col; g.globalAlpha = Math.max(0, k); g.lineWidth = cs * (p.w || 0.1); g.beginPath(); g.arc(p.x * cs, p.y * cs, cs * p.r * (1 + (1 - k) * 0.8), 0, 7); g.stroke(); g.globalAlpha = 1; }
      else if (p.t === 'ball') { g.save(); g.translate(p.x * cs, p.y * cs); g.rotate(p.rot); g.globalAlpha = Math.min(1, k * 3); g.drawImage(sprite(p.k, p.c, pxp), -pxp / dpr / 2, -pxp / dpr / 2, pxp / dpr, pxp / dpr); g.restore(); g.globalAlpha = 1; }
      else if (p.t === 'conf') { g.save(); g.translate(p.x * cs, p.y * cs); g.rotate(p.rot); g.globalAlpha = Math.min(1, k * 2.5); g.fillStyle = p.col; g.fillRect(-p.w * cs / 2, -p.h * cs / 2 * Math.abs(Math.cos(p.age * 9 + p.rot)), p.w * cs, Math.max(1, p.h * cs * Math.abs(Math.cos(p.age * 9 + p.rot)))); g.restore(); g.globalAlpha = 1; }
      else if (p.t === 'star') { g.save(); g.translate(p.x * cs, p.y * cs); g.rotate(p.age * 6); g.globalAlpha = Math.max(0, k); g.fillStyle = '#fff6b0'; shapePath(g, 3, cs * 0.22 * (0.6 + k)); g.fill(); g.restore(); g.globalAlpha = 1; }
      else { g.fillStyle = p.t === 'spark' ? '#ffd166' : p.t === 'shard' ? '#e8fbff' : p.col; g.globalAlpha = Math.max(0, k); g.beginPath(); if (p.t === 'shard') { g.rect(p.x * cs, p.y * cs, cs * 0.12, cs * 0.05); } else g.arc(p.x * cs, p.y * cs, cs * p.r, 0, 7); g.fill(); g.globalAlpha = 1; }
    }
    // floating texts
    g.textAlign = 'center'; g.textBaseline = 'middle';
    for (const x of this.texts) { const k = (this.last - x.born) / x.life, rise = x.big ? 0.4 : 1.1, sc = x.pop ? 1 + 0.9 * Math.max(0, 1 - k * 6) : x.big ? 1 + 0.25 * Math.max(0, 1 - k * 4) : 1;
      g.globalAlpha = Math.max(0, Math.min(1, (1 - k) * 2.5)); g.font = '900 ' + Math.round(cs * x.size * sc) + 'px system-ui,sans-serif'; g.lineWidth = Math.max(2, cs * 0.12); g.strokeStyle = '#1b1640'; g.strokeText(x.s, x.x * cs, (x.y - k * rise) * cs); g.fillStyle = x.color; g.fillText(x.s, x.x * cs, (x.y - k * rise) * cs); }
    g.globalAlpha = 1;
    g.restore();
    // victim flash: tinted vignette pulses (one pulse per stacked charge)
    if (this.hitF) { const k = (now - this.hitF.born) / (500 + 220 * this.hitF.n); if (k > 1) this.hitF = null; else { const pulse = Math.abs(Math.sin(k * Math.PI * this.hitF.n)), a = (this.reduced ? 0.25 : 0.5) * (1 - k) * (0.4 + 0.6 * pulse);
      const vg = g.createRadialGradient(W * cs / 2, H * cs / 2, cs * 1.5, W * cs / 2, H * cs / 2, H * cs * 0.75); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, this.hitF.color); g.globalAlpha = a; g.fillStyle = vg; g.fillRect(0, 0, W * cs, H * cs); g.globalAlpha = 1; } }
    // DOUBLE / TRIPLE
    if (this.big) { const k = (now - this.big.born) / 1600; if (k > 1) this.big = null; else {
      const cx0 = W * cs / 2, cy0 = H * cs * 0.36, n = this.big.n;
      if (!this.reduced && k < 0.25) { g.globalAlpha = (0.25 - k) * 2.6; g.fillStyle = '#fff'; g.fillRect(0, 0, W * cs, H * cs); g.globalAlpha = 1; }
      if (!this.reduced) { g.save(); g.translate(cx0, cy0); g.rotate(now / 900); g.globalAlpha = 0.28 * Math.min(1, (1 - k) * 3); g.fillStyle = this.big.color; for (let i = 0; i < 12; i++) { g.rotate(Math.PI / 6); g.beginPath(); g.moveTo(0, 0); g.lineTo(-cs * 0.45, -H * cs); g.lineTo(cs * 0.45, -H * cs); g.closePath(); g.fill(); } g.restore(); g.globalAlpha = 1; }
      const sc = this.reduced ? 1 : k < 0.18 ? 2.4 - 1.6 * (k / 0.18) : 1 + 0.06 * Math.sin((k - 0.18) * 30) * Math.max(0, 1 - k * 2);
      g.globalAlpha = Math.min(1, (1 - k) * 4); g.textAlign = 'center'; g.textBaseline = 'middle';
      let fs = Math.round(cs * 1.5 * sc); g.font = '900 ' + fs + 'px system-ui,sans-serif'; const tw = g.measureText(this.big.s).width; if (tw > W * cs * 0.94) { fs = Math.floor(fs * W * cs * 0.94 / tw); g.font = '900 ' + fs + 'px system-ui,sans-serif'; }
      g.lineWidth = Math.max(3, cs * 0.22); g.strokeStyle = '#1b1640'; g.strokeText(this.big.s, cx0, cy0); g.fillStyle = this.big.color; g.fillText(this.big.s, cx0, cy0);
      g.font = '900 ' + Math.round(cs * 1.0) + 'px system-ui,sans-serif'; g.fillText('⚡'.repeat(n), cx0, cy0 + cs * 1.45); g.globalAlpha = 1; } }
    // banner (skill hit)
    if (this.banner) { const k = (now - this.banner.born) / 1700; if (k > 1) this.banner = null; else { const a = Math.min(1, (1 - k) * 3), y = H * cs * 0.4, s = this.mini ? 0.9 : 0.7;
      g.globalAlpha = a; g.fillStyle = 'rgba(15,11,36,.78)'; g.fillRect(0, y - cs * s, W * cs, cs * s * 2); const txt = (this.banner.icon ? this.banner.icon + ' ' : '') + this.banner.s; let fs = Math.round(cs * s * 0.95); g.font = '900 ' + fs + 'px system-ui,sans-serif'; const tw = g.measureText(txt).width; if (tw > W * cs * 0.92) { fs = Math.floor(fs * W * cs * 0.92 / tw); g.font = '900 ' + fs + 'px system-ui,sans-serif'; } g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = this.banner.color; g.fillText(txt, W * cs / 2, y + cs * 0.03); g.globalAlpha = 1; } }
    if (b && b.out) { g.fillStyle = 'rgba(10,8,26,.62)'; g.fillRect(0, 0, W * cs, H * cs); g.fillStyle = '#ff9b9b'; g.font = '900 ' + Math.round(cs * (this.mini ? 1.1 : 0.8)) + 'px system-ui,sans-serif'; g.fillText(o.outLabel || 'OUT', W * cs / 2, H * cs * 0.45); }
    if (o.dim) { g.fillStyle = 'rgba(10,8,26,.45)'; g.fillRect(0, 0, W * cs, H * cs); }
  }
}
/* ---------------- full-screen fx layer: projectiles with trails between boards, impact sparks, screen confetti ---------------- */
class FxLayer {
  constructor(cv) { this.cv = cv; this.g = cv.getContext('2d'); this.shots = []; this.parts = []; this.reduced = false; this.w = 0; this.h = 0; this.dpr = 1; this.dirty = false; }
  fit() { const dpr = Math.min(2, root.devicePixelRatio || 1), w = root.innerWidth, h = root.innerHeight; if (w !== this.w || h !== this.h || dpr !== this.dpr) { this.w = w; this.h = h; this.dpr = dpr; this.cv.width = Math.round(w * dpr); this.cv.height = Math.round(h * dpr); } }
  get busy() { return this.shots.length > 0 || this.parts.length > 0; }
  /** n orbs fly a → z (CSS px) along bent arcs; onHit fires when the first one lands */
  shoot(a, z, o) {
    o = o || {}; const n = Math.max(1, Math.min(3, o.n || 1)), dur = this.reduced ? 380 : (o.dur || 600); let hit = false;
    for (let i = 0; i < n; i++) this.shots.push({ ax: a.x, ay: a.y, zx: z.x, zy: z.y, icon: o.icon || '⚡', col: o.color || '#F0E442', t0: (o.now || 0) + (o.delay || 0) + i * 110, dur, bend: (i - (n - 1) / 2) * 70 + (o.bend || 0), trail: [], first: i === 0, onHit: i === 0 ? () => { if (!hit) { hit = true; if (o.onHit) o.onHit(); } } : null, size: 18 + 4 * n });
  }
  spark(x, y, col, n) { const cap = this.reduced ? 20 : 220; for (let i = 0; i < n && this.parts.length < cap; i++) { const a = rand() * Math.PI * 2, sp = 120 + rand() * 260; this.parts.push({ t: rand() < 0.5 ? 'dot' : 'conf', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 80, age: 0, life: 0.5 + rand() * 0.5, col: rand() < 0.5 ? col : PAL[(rand() * 6) | 0], r: 2 + rand() * 3, rot: rand() * 6 }); } this.parts.push({ t: 'ring', x, y, age: 0, life: 0.45, col, r: 14 }); }
  confetti(n) { if (this.reduced) return; for (let i = 0; i < n && this.parts.length < 220; i++) this.parts.push({ t: 'conf', x: rand() * this.w, y: -10 - rand() * 80, vx: (rand() - 0.5) * 80, vy: 60 + rand() * 120, age: 0, life: 2.2 + rand(), col: PAL[(rand() * 6) | 0], r: 4 + rand() * 3, rot: rand() * 6 }); }
  draw(now, dt) {
    const g = this.g; if (!this.busy) { if (this.dirty) { g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, this.cv.width, this.cv.height); this.dirty = false; } return; }
    this.fit(); this.dirty = true; const s = Math.min(0.08, dt / 1000);
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0); g.clearRect(0, 0, this.w, this.h);
    for (const p of this.parts) { p.age += s; if (p.t === 'ring') continue; p.vy += (p.t === 'conf' ? 160 : 420) * s; if (p.t === 'conf') { p.vx *= 1 - 1.5 * s; p.vx += Math.sin(p.age * 6 + p.rot) * 40 * s; } p.x += p.vx * s; p.y += p.vy * s; p.rot = (p.rot || 0) + 8 * s; }
    this.parts = this.parts.filter(p => p.age < p.life && p.y < this.h + 20);
    for (const p of this.parts) { const k = 1 - p.age / p.life; g.globalAlpha = Math.max(0, Math.min(1, k * 2));
      if (p.t === 'ring') { g.strokeStyle = p.col; g.lineWidth = 4 * k; g.beginPath(); g.arc(p.x, p.y, p.r + (1 - k) * 46, 0, 7); g.stroke(); }
      else if (p.t === 'conf') { g.save(); g.translate(p.x, p.y); g.rotate(p.rot); g.fillStyle = p.col; g.fillRect(-p.r, -p.r * 0.5 * Math.abs(Math.cos(p.age * 9)), p.r * 2, Math.max(1, p.r * Math.abs(Math.cos(p.age * 9)))); g.restore(); }
      else { g.fillStyle = p.col; g.beginPath(); g.arc(p.x, p.y, p.r * k + 0.5, 0, 7); g.fill(); } }
    g.globalAlpha = 1;
    const keep = [];
    for (const sh of this.shots) {
      const u = (now - sh.t0) / sh.dur; if (u < 0) { keep.push(sh); continue; }
      if (u >= 1) { this.spark(sh.zx, sh.zy, sh.col, sh.first ? 26 : 12); if (sh.onHit) sh.onHit(); continue; }
      const e = u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2, mx = (sh.ax + sh.zx) / 2 + sh.bend, my = Math.min(sh.ay, sh.zy) - 90 - Math.abs(sh.bend) * 0.5;
      const x = (1 - e) * (1 - e) * sh.ax + 2 * (1 - e) * e * mx + e * e * sh.zx, y = (1 - e) * (1 - e) * sh.ay + 2 * (1 - e) * e * my + e * e * sh.zy;
      sh.trail.push([x, y]); if (sh.trail.length > (this.reduced ? 3 : 16)) sh.trail.shift();
      for (let i = 0; i < sh.trail.length; i++) { const q = sh.trail[i], k = (i + 1) / sh.trail.length; g.globalAlpha = k * 0.6; g.fillStyle = i % 2 ? '#fff' : sh.col; g.beginPath(); g.arc(q[0], q[1], sh.size * 0.45 * k, 0, 7); g.fill(); }
      g.globalAlpha = 1; const gr = g.createRadialGradient(x, y, 2, x, y, sh.size); gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.45, sh.col); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.beginPath(); g.arc(x, y, sh.size, 0, 7); g.fill();
      g.font = Math.round(sh.size * 1.05) + 'px system-ui,sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(sh.icon, x, y + 1);
      keep.push(sh);
    }
    this.shots = keep;
  }
}
const COMBO_COL = ['#F0E442', '#ffb347', '#ff7a59', '#ff5fa2', '#c38bff', '#56B4E9'];
root.DGR = { setPalette, sprite, shapePath, symbol, BoardView, FxLayer, LOSE_Y, comboLabel: '', contrast, get PAL() { return PAL; }, get INK() { return INK; } };
setPalette(PAL);
})(typeof window !== 'undefined' ? window : globalThis);

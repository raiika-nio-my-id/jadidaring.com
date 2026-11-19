/* Pedang Sihir Perisai: skill icons (inline SVG, also drawn on the canvas) + the clash FX layer (particles, slashes, orbs, barriers). */
(function (root) {
'use strict';
const INK = '#221836';
let KC = ['#ff8a1f', '#b45cff', '#3ea0ff'];
const STAR = 'M50 6 C55 35 65 45 94 50 C65 55 55 65 50 94 C45 65 35 55 6 50 C35 45 45 35 50 6 Z';
const SHIELD = 'M50 5 L89 17 V45 C89 70 73 86 50 96 C27 86 11 70 11 45 V17 Z';
/** standalone SVG markup for kind k (0 pedang, 1 sihir, 2 perisai) */
function iconSVG(k, c) {
  c = c || KC[k];
  const s = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" aria-hidden="true" focusable="false">';
  if (k === 0) return s + '<g transform="rotate(45 50 50)" stroke="' + INK + '" stroke-width="4" stroke-linejoin="round"><path d="M50 2 L59 15 L59 62 L41 62 L41 15 Z" fill="#eef3ff"/><path d="M50 9 V60" stroke="#aab6d6" stroke-width="3"/><rect x="27" y="61" width="46" height="9" rx="4.5" fill="' + c + '"/><rect x="44.5" y="70" width="11" height="17" fill="#7a4a2a"/><circle cx="50" cy="91" r="6.5" fill="' + c + '"/></g></svg>';
  if (k === 1) return s + '<path d="' + STAR + '" fill="' + c + '" stroke="' + INK + '" stroke-width="4" stroke-linejoin="round"/><path d="' + STAR + '" transform="translate(50 50) scale(.42) translate(-50 -50)" fill="#fff" opacity=".9"/><circle cx="82" cy="18" r="5" fill="#fff" stroke="' + INK + '" stroke-width="2.5"/><circle cx="18" cy="82" r="3.5" fill="#fff" stroke="' + INK + '" stroke-width="2"/></svg>';
  return s + '<path d="' + SHIELD + '" fill="' + c + '" stroke="' + INK + '" stroke-width="4" stroke-linejoin="round"/><path d="M50 15 L80 24 V45 C80 64 68 77 50 85 Z" fill="#fff" opacity=".28"/><path d="M50 30 L62 44 L50 70 L38 44 Z" fill="#fff" stroke="' + INK + '" stroke-width="3" stroke-linejoin="round"/></svg>';
}
const imgs = [];
function setColors(list) { if (Array.isArray(list) && list.length === 3) KC = list.slice(); imgs.length = 0; for (let k = 0; k < 3; k++) img(k); }
function img(k) { if (!imgs[k] && root.Image) { const i = new Image(); i.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(iconSVG(k)); imgs[k] = i; } return imgs[k]; }
const ease = { out: t => 1 - Math.pow(1 - t, 3), inOut: t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2), back: t => { const c = 1.9; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); } };
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (a, b) => a + Math.random() * (b - a);

class FX {
  constructor(cv) { this.cv = cv; this.ctx = cv ? cv.getContext('2d') : null; this.items = []; this.reduced = false; this.shakeA = 0; this.shakeUntil = 0; this.shakeEl = null; this.last = 0; this.w = 0; this.h = 0; }
  resize() { if (!this.cv) return; const d = Math.min(2, root.devicePixelRatio || 1), w = root.innerWidth, h = root.innerHeight; if (w === this.w && h === this.h && d === this.d) return; this.w = w; this.h = h; this.d = d; this.cv.width = Math.round(w * d); this.cv.height = Math.round(h * d); }
  clear() { this.items = []; this.shakeUntil = 0; if (this.shakeEl) this.shakeEl.style.transform = ''; if (this.ctx) this.ctx.clearRect(0, 0, this.cv.width, this.cv.height); }
  busy() { return this.items.length > 0; }
  add(o, delay) { o.t0 = performance.now() + (delay || 0); o.age = 0; this.items.push(o); return o; }
  at(delay, fn) { return this.add({ kind: 'call', fn, life: 0 }, delay); }
  shake(a, ms) { if (this.reduced) return; this.shakeA = Math.max(this.shakeA * (performance.now() < this.shakeUntil ? 1 : 0), a); this.shakeUntil = performance.now() + (ms || 380); }
  /* ---- primitives ---- */
  sparks(x, y, c, n, sp, delay, o) { n = this.reduced ? Math.ceil(n / 3) : n; for (let i = 0; i < n; i++) { const a = rand(0, Math.PI * 2), v = rand(0.3, 1) * (sp || 6); this.add(Object.assign({ kind: 'spark', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: 0.12, r: rand(2, 5), c: Array.isArray(c) ? c[i % c.length] : c, life: rand(420, 820) }, o || {}), delay); } }
  ring(x, y, c, r0, r1, ms, lw, delay) { this.add({ kind: 'ring', x, y, c, r0, r1, life: ms || 500, lw: lw || 6 }, delay); }
  text(x, y, s, c, size, delay, life) { this.add({ kind: 'text', x, y, s, c, size: size || 34, life: life || 1100 }, delay); }
  shards(x, y, c, n, delay) { n = this.reduced ? 4 : n; for (let i = 0; i < n; i++) { const a = rand(0, Math.PI * 2), v = rand(2, 7); this.add({ kind: 'shard', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 2, g: 0.22, rot: rand(0, 6), vr: rand(-0.3, 0.3), s: rand(6, 14), c, life: rand(700, 1100) }, delay); } }
  confetti(x, y, n, delay) { const cs = KC.concat(['#ffe14d', '#3be8b0', '#ff5d8f']); n = this.reduced ? 12 : n; for (let i = 0; i < n; i++) { const a = rand(-Math.PI, 0), v = rand(4, 11); this.add({ kind: 'conf', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: 0.18, rot: rand(0, 6), vr: rand(-0.4, 0.4), s: rand(5, 9), c: cs[i % cs.length], life: rand(1200, 2000) }, delay); } }
  boom(x, y, c, scale, delay) { const s = scale || 1; this.ring(x, y, '#fff', 6, 70 * s, 360, 10, delay); this.ring(x, y, c, 10, 120 * s, 620, 7, (delay || 0) + 60); this.sparks(x, y, [c, '#fff', '#ffe14d'], Math.round(26 * s), 9 * s, delay); this.add({ kind: 'glow', x, y, c, r: 90 * s, life: 420 }, delay); }
  /** icon k moves from a → b (scale s0 → s1), stays until hold, then fades; returns the item (move it later with .to) */
  icon(k, a, b, size, ms, hold, delay) { return this.add({ kind: 'icon', k, ax: a.x, ay: a.y, bx: b.x, by: b.y, size, mv: this.reduced ? 1 : ms, life: hold, spin: 0 }, delay); }
  slash(x, y, ang, c, size, delay) { this.add({ kind: 'slash', x, y, ang, c, size: size || 70, life: 320 }, delay); }
  orb(a, b, c, ms, delay) { this.add({ kind: 'orb', ax: a.x, ay: a.y, bx: b.x, by: b.y, c, life: ms, trail: [] }, delay); }
  hex(x, y, r, c, ms, delay) { this.add({ kind: 'hex', x, y, r, c, life: ms || 600 }, delay); }
  /** the icon breaks in two halves that fly apart (+ kind-coloured shards) */
  breakIcon(k, x, y, size, delay) { this.add({ kind: 'half', k, x, y, size, side: -1, vx: -3.2, vy: -3, vr: -0.12, g: 0.3, life: 900 }, delay); this.add({ kind: 'half', k, x, y, size, side: 1, vx: 3.2, vy: -2.4, vr: 0.14, g: 0.3, life: 900 }, delay); this.shards(x, y, KC[k], 12, delay); }
  /**
   * One clash. spec = { c: {x, y}, R, size, res, wk, lk, f: [{ id, x, y, k (-1 none, -2 hidden), lose, ko }] }
   * → { hit: ms until the damage lands, end: ms until the scene is over }. Every client plays it the same way.
   */
  clash(spec) {
    const c = spec.c, R = spec.R, size = spec.size, F = spec.f, red = this.reduced;
    const FLY = red ? 60 : 520, slot = f => { const dx = f.x - c.x, dy = f.y - c.y, d = Math.hypot(dx, dy) || 1; return { x: c.x + dx / d * R, y: c.y + dy / d * R }; };
    let hit = FLY + 300; const end = 2100;
    const shown = F.filter(f => f.k >= 0), win = shown.filter(f => !f.lose), lose = shown.filter(f => f.lose);
    for (const f of F) { f.s = slot(f); if (f.k < 0) this.add({ kind: 'clock', x: f.s.x, y: f.s.y, size: size * 0.7, life: end - 300, hidden: f.k === -2 }, FLY - 120); }
    const items = new Map(); for (const f of shown) items.set(f, this.icon(f.k, { x: f.x, y: f.y }, f.s, size, FLY, end - 300, 0));
    if (spec.res === 'win') {
      if (spec.wk === 0) { // Pedang cuts through Perisai
        hit = FLY + 330;
        for (const w of win) { const it = items.get(w), tg = lose[0] || w; it.dash = { x: lerp(w.s.x, tg.s.x, 0.55), y: lerp(w.s.y, tg.s.y, 0.55), at: performance.now() + FLY, ms: 220 }; }
        for (const l of lose) { const a = Math.atan2(l.s.y - c.y, l.s.x - c.x); this.slash(l.s.x, l.s.y, a + 0.9, '#fff3c4', size * 1.2, FLY + 200); this.slash(l.s.x, l.s.y, a - 0.8, KC[0], size * 1.1, FLY + 290); }
      } else if (spec.wk === 1) { // Sihir blasts Pedang
        hit = FLY + 380;
        for (const w of win) for (const l of lose) this.orb(w.s, l.s, KC[1], 360, FLY);
        for (const l of lose) { this.ring(l.s.x, l.s.y, KC[1], 8, size * 1.6, 520, 8, FLY + 360); this.ring(l.s.x, l.s.y, '#fff', 4, size * 1.1, 360, 5, FLY + 390); }
      } else { // Perisai reflects Sihir
        hit = FLY + 640;
        for (const l of lose) for (const w of win) { this.orb(l.s, w.s, KC[1], 300, FLY); this.orb(w.s, l.s, '#7fd0ff', 300, FLY + 330); }
        for (const w of win) this.hex(w.s.x, w.s.y, size * 0.85, KC[2], 700, FLY + 220);
      }
      for (const l of lose) { const it = items.get(l); this.at(hit, () => { it.life = 0; }); this.breakIcon(l.k, l.s.x, l.s.y, size, hit); this.boom(l.s.x, l.s.y, KC[spec.wk], 0.7, hit); }
      for (const w of win) { this.ring(w.s.x, w.s.y, KC[w.k], size * 0.4, size * 1.2, 520, 5, hit + 40); const it = items.get(w); it.pop = performance.now() + hit; }
    } else if (shown.length) { // seri: everyone crashes in the middle and bounces back
      hit = FLY + 220;
      for (const f of shown) { const it = items.get(f); it.dash = { x: lerp(f.s.x, c.x, 0.7), y: lerp(f.s.y, c.y, 0.7), at: performance.now() + FLY, ms: 220 }; }
      this.ring(c.x, c.y, '#fff', 10, size * 2.2, 600, 8, hit); this.sparks(c.x, c.y, ['#fff', '#ffe14d'].concat(KC), 30, 8, hit);
    }
    for (const f of F) if (f.k < 0 && f.lose) this.add({ kind: 'zap', x: f.s.x, y: f.s.y, life: 380 }, hit - 120);
    if (!red && spec.res === 'win') this.at(hit, () => this.shake(lose.some(l => l.ko) ? 16 : 9, 420));
    return { hit, end };
  }
  /* ---- loop ---- */
  frame(now) {
    const ctx = this.ctx; if (!ctx) return; this.resize();
    const dt = Math.min(50, now - (this.last || now)); this.last = now; const k = dt / 16.7;
    ctx.setTransform(this.d, 0, 0, this.d, 0, 0); ctx.clearRect(0, 0, this.w, this.h);
    const keep = [];
    for (const o of this.items) {
      if (now < o.t0) { keep.push(o); continue; }
      o.age = now - o.t0;
      if (o.kind === 'call') { try { o.fn(); } catch (e) { /* ignore */ } continue; }
      if (o.age > o.life) continue;
      keep.push(o); const p = o.age / o.life;
      ctx.save();
      switch (o.kind) {
        case 'spark': o.vy += o.g * k; o.x += o.vx * k; o.y += o.vy * k; o.vx *= 0.98; ctx.globalAlpha = 1 - p; ctx.fillStyle = o.c; ctx.beginPath(); ctx.arc(o.x, o.y, o.r * (1 - p * 0.6), 0, 7); ctx.fill(); break;
        case 'shard': case 'conf': o.vy += o.g * k; o.x += o.vx * k; o.y += o.vy * k; o.rot += o.vr * k; ctx.globalAlpha = o.kind === 'conf' ? Math.min(1, 3 - 3 * p) : 1 - p; ctx.translate(o.x, o.y); ctx.rotate(o.rot); ctx.fillStyle = o.c; ctx.strokeStyle = INK; ctx.lineWidth = 1.5; ctx.beginPath();
          if (o.kind === 'conf') ctx.rect(-o.s / 2, -o.s / 4, o.s, o.s / 2); else { ctx.moveTo(0, -o.s); ctx.lineTo(o.s * 0.7, o.s * 0.5); ctx.lineTo(-o.s * 0.6, o.s * 0.6); ctx.closePath(); }
          ctx.fill(); if (o.kind === 'shard') ctx.stroke(); break;
        case 'ring': ctx.globalAlpha = 1 - p; ctx.strokeStyle = o.c; ctx.lineWidth = o.lw * (1 - p) + 1; ctx.beginPath(); ctx.arc(o.x, o.y, lerp(o.r0, o.r1, ease.out(p)), 0, 7); ctx.stroke(); break;
        case 'glow': { const g = ctx.createRadialGradient(o.x, o.y, 0, o.x, o.y, o.r); g.addColorStop(0, 'rgba(255,255,255,' + (0.9 * (1 - p)) + ')'); g.addColorStop(0.4, o.c); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.globalAlpha = 1 - p; ctx.fillStyle = g; ctx.beginPath(); ctx.arc(o.x, o.y, o.r, 0, 7); ctx.fill(); break; }
        case 'text': { const y = o.y - 46 * ease.out(Math.min(1, p * 1.6)), sc = p < 0.15 ? ease.back(p / 0.15) : 1; ctx.globalAlpha = p > 0.75 ? (1 - p) / 0.25 : 1; ctx.translate(o.x, y); ctx.scale(sc, sc); ctx.font = '900 ' + o.size + 'px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineWidth = 7; ctx.strokeStyle = INK; ctx.strokeText(o.s, 0, 0); ctx.fillStyle = o.c; ctx.fillText(o.s, 0, 0); break; }
        case 'icon': {
          const t = Math.min(1, o.age / o.mv); let x = lerp(o.ax, o.bx, ease.out(t)), y = lerp(o.ay, o.by, ease.out(t)), sc = lerp(0.45, 1, ease.back(t));
          if (o.dash) { const q = (now - o.dash.at) / o.dash.ms; if (q > 0) { const e = q < 1 ? Math.sin(q * Math.PI) : 0; x = lerp(x, o.dash.x, e); y = lerp(y, o.dash.y, e); } }
          if (o.pop && now > o.pop) { const q = (now - o.pop) / 300; if (q < 1) sc *= 1 + 0.35 * Math.sin(q * Math.PI); }
          const fade = o.life - o.age < 300 ? (o.life - o.age) / 300 : 1; ctx.globalAlpha = fade; ctx.translate(x, y); ctx.rotate(Math.sin(o.age / 160) * 0.06);
          ctx.shadowColor = KC[o.k]; ctx.shadowBlur = 22; const im = img(o.k), s = o.size * sc;
          if (im && im.complete && im.naturalWidth) ctx.drawImage(im, -s / 2, -s / 2, s, s); else { ctx.fillStyle = KC[o.k]; ctx.beginPath(); ctx.arc(0, 0, s / 2.4, 0, 7); ctx.fill(); }
          break; }
        case 'half': { o.vy += o.g * k; o.x += o.vx * k; o.y += o.vy * k; o.rot = (o.rot || 0) + o.vr * k; ctx.globalAlpha = 1 - p; ctx.translate(o.x, o.y); ctx.rotate(o.rot); const s = o.size, im = img(o.k); ctx.beginPath(); ctx.rect(o.side < 0 ? -s / 2 : 0, -s / 2, s / 2, s); ctx.clip(); if (im && im.complete && im.naturalWidth) ctx.drawImage(im, -s / 2, -s / 2, s, s); break; }
        case 'slash': { const e = ease.out(Math.min(1, p * 1.8)); ctx.globalAlpha = 1 - p * p; ctx.translate(o.x, o.y); ctx.rotate(o.ang); ctx.strokeStyle = o.c; ctx.lineCap = 'round'; ctx.shadowColor = o.c; ctx.shadowBlur = 18; ctx.lineWidth = 10 * (1 - p) + 2; ctx.beginPath(); ctx.arc(0, o.size * 0.6, o.size, -Math.PI / 2 - 1.1 * e, -Math.PI / 2 + 1.1 * e); ctx.stroke(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.stroke(); break; }
        case 'orb': { const e = ease.inOut(p), x = lerp(o.ax, o.bx, e), y = lerp(o.ay, o.by, e) - Math.sin(p * Math.PI) * 30; o.trail.push([x, y]); if (o.trail.length > 10) o.trail.shift();
          o.trail.forEach((q, i) => { ctx.globalAlpha = i / o.trail.length * 0.6; ctx.fillStyle = o.c; ctx.beginPath(); ctx.arc(q[0], q[1], 4 + i, 0, 7); ctx.fill(); });
          ctx.globalAlpha = 1; ctx.shadowColor = o.c; ctx.shadowBlur = 24; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x, y, 9, 0, 7); ctx.fill(); ctx.fillStyle = o.c; ctx.beginPath(); ctx.arc(x, y, 6, 0, 7); ctx.fill(); break; }
        case 'hex': { const e = p < 0.2 ? ease.back(p / 0.2) : 1; ctx.globalAlpha = p > 0.7 ? (1 - p) / 0.3 : 0.95; ctx.translate(o.x, o.y); ctx.scale(e, e); ctx.strokeStyle = '#bfe7ff'; ctx.fillStyle = 'rgba(62,160,255,.28)'; ctx.lineWidth = 4; ctx.shadowColor = o.c; ctx.shadowBlur = 20; ctx.beginPath(); for (let i = 0; i < 6; i++) { const a = Math.PI / 6 + i * Math.PI / 3; ctx.lineTo(Math.cos(a) * o.r, Math.sin(a) * o.r); } ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.lineWidth = 1.5; for (let i = 0; i < 3; i++) { const a = Math.PI / 6 + i * Math.PI / 3; ctx.beginPath(); ctx.moveTo(Math.cos(a) * o.r, Math.sin(a) * o.r); ctx.lineTo(-Math.cos(a) * o.r, -Math.sin(a) * o.r); ctx.stroke(); } break; }
        case 'clock': { const fade = o.life - o.age < 300 ? (o.life - o.age) / 300 : Math.min(1, o.age / 200); ctx.globalAlpha = fade; ctx.translate(o.x, o.y); ctx.font = Math.round(o.size) + 'px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(o.hidden ? '🙈' : '⌛', 0, 0); break; }
        case 'zap': { ctx.globalAlpha = 1 - p; ctx.strokeStyle = '#ffe14d'; ctx.lineWidth = 5; ctx.shadowColor = '#ffe14d'; ctx.shadowBlur = 16; ctx.beginPath(); let y = o.y - 90; ctx.moveTo(o.x, y); for (let i = 0; i < 5; i++) { y += 18; ctx.lineTo(o.x + (i % 2 ? 12 : -12), y); } ctx.stroke(); break; }
      }
      ctx.restore();
    }
    this.items = keep;
    if (this.shakeEl) { if (now < this.shakeUntil) { const a = this.shakeA * ((this.shakeUntil - now) / 420); this.shakeEl.style.transform = 'translate(' + (rand(-a, a)).toFixed(1) + 'px,' + (rand(-a, a)).toFixed(1) + 'px)'; this.shaking = true; } else if (this.shaking) { this.shaking = false; this.shakeEl.style.transform = ''; } }
  }
}
root.PSR = { iconSVG, setColors, img, FX, get KC() { return KC; } };
})(typeof window !== 'undefined' ? window : globalThis);

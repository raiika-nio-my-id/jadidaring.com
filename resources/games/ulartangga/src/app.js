(function () {
'use strict';
const U = window.UT, $ = id => document.getElementById(id);
let CFG; try { CFG = JSON.parse($('website-config').textContent); } catch (e) { CFG = {}; }
CFG.game = CFG.game || {}; CFG.text = CFG.text || {}; CFG.cards = CFG.cards || {}; CFG.players = CFG.players || {};
const G = CFG.game, R = U.makeRules(G), B = U.makeBoard(CFG.board), CARDS = CFG.cards;
const COLORS = CFG.players.colors || ['#ef4444', '#3b82f6', '#22c55e', '#f59e0b'];
const BOTS = CFG.players.botNames || ['Bot 1', 'Bot 2', 'Bot 3'];
const local = { get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* private mode */ } } };
let session = null; try { session = window.sessionStorage; } catch (e) { session = null; }
const reduced = window.matchMedia ? matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
function t(key, vars) { let s = CFG.text[key]; if (s === undefined) s = key; if (vars) s = String(s).replace(/\{(\w+)\}/g, (m, n) => (vars[n] !== undefined ? vars[n] : m)); return s; }
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const cfgPath = p => p.split('.').reduce((o, k) => (o ? o[k] : undefined), CFG);
const cardName = c => (CARDS[c] ? CARDS[c].name : c);
const cardIcon = c => (CARDS[c] ? CARDS[c].icon : '');
let toastTimer;
function toast(msg) { const el = $('toast'); el.textContent = msg; el.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => { el.hidden = true; }, 3600); }
function errMsg(e) {
  if (!e) return '';
  if (e.code === 'busy' || e.status === 429) return t('errBusy', { n: e.wait || 10 });
  if (e.code === 'few') return t('errFew');
  if (e.code === 'target') return t('errTarget');
  if (e.code === 'network' || e.code === 'offline') return t('errNetwork');
  if (e.status === 404) return t('errNotFound');
  if (e.status === 409) return t('errFull');
  if (e.status === 403) return t('errMember');
  return t('errGeneric', { m: e.server || e.message || e.code || '?' });
}
function setHTML(el, html) { if (el._h !== html) { el._h = html; el.innerHTML = html; } }

/* ================= BOARD (canvas) ================= */
const SNAKE_COLORS = ['#16a34a', '#dc2626', '#7c3aed', '#ea580c', '#0891b2', '#db2777', '#65a30d', '#9333ea'];
const ROW_HUES = [45, 140, 200, 0, 265, 28, 170, 220, 330, 95];
class BoardView {
  constructor(canvas) { this.c = canvas; this.g = canvas.getContext('2d'); this.size = 0; this.dpr = 1; this.bg = null; this.snakes = {}; }
  resize(css) {
    css = Math.max(200, Math.floor(css)); const dpr = Math.min(3, window.devicePixelRatio || 1);
    if (css === this.size && dpr === this.dpr && this.bg) return false;
    this.size = css; this.dpr = dpr; this.cell = css / 10; this.c.width = this.c.height = Math.round(css * dpr); this.c.style.width = this.c.style.height = css + 'px';
    this.bg = this.paintStatic(); return true;
  }
  center(n) { n = Math.max(1, Math.min(100, n || 1)); const i = n - 1, row = Math.floor(i / 10), col = row % 2 === 0 ? i % 10 : 9 - (i % 10), c = this.cell; return [(col + 0.5) * c, (9 - row + 0.5) * c]; }
  tileXY(n) { const i = n - 1, row = Math.floor(i / 10), col = row % 2 === 0 ? i % 10 : 9 - (i % 10); return [col * this.cell, (9 - row) * this.cell]; }
  snakePath(head, tail, k) {
    const [hx, hy] = this.center(head), [tx, ty] = this.center(tail), dx = tx - hx, dy = ty - hy, len = Math.hypot(dx, dy), nx = -dy / len, ny = dx / len;
    const waves = Math.max(1.5, Math.round(len / this.cell / 1.6) + 0.5), amp = this.cell * 0.32 * (k % 2 ? 1 : -1), pts = [];
    for (let i = 0; i <= 48; i++) { const f = i / 48, env = Math.sin(f * Math.PI) * 0.9 + 0.1, o = Math.sin(f * Math.PI * waves) * amp * env; pts.push([hx + dx * f + nx * o, hy + dy * f + ny * o]); }
    return pts;
  }
  paintStatic() {
    const cv = document.createElement('canvas'); cv.width = this.c.width; cv.height = this.c.height;
    const g = cv.getContext('2d'), c = this.cell; g.scale(this.dpr, this.dpr);
    for (let n = 1; n <= 100; n++) {
      const [x, y] = this.tileXY(n), row = Math.floor((n - 1) / 10), col = (n - 1) % 10;
      g.fillStyle = 'hsl(' + ROW_HUES[row] + ' 75% ' + ((row + col) % 2 ? 90 : 81) + '%)'; g.fillRect(x, y, c + 0.5, c + 0.5);
      if (B.power.has(n)) { g.fillStyle = 'rgba(255,214,10,.35)'; g.fillRect(x, y, c, c); star(g, x + c * 0.5, y + c * 0.56, c * 0.3, c * 0.13); }
    }
    g.strokeStyle = 'rgba(15,61,46,.18)'; g.lineWidth = 1; for (let i = 1; i < 10; i++) { g.beginPath(); g.moveTo(i * c, 0); g.lineTo(i * c, this.size); g.moveTo(0, i * c); g.lineTo(this.size, i * c); g.stroke(); }
    // finish & start marks
    const [fx, fy] = this.tileXY(100); g.fillStyle = 'rgba(250,204,21,.55)'; g.fillRect(fx, fy, c, c); crown(g, fx + c * 0.5, fy + c * 0.6, c * 0.5);
    g.fillStyle = '#0f3d2e'; g.font = '900 ' + Math.max(7, Math.round(c * 0.16)) + 'px system-ui,sans-serif'; g.textAlign = 'center'; g.textBaseline = 'alphabetic';
    const [sx, sy] = this.tileXY(1); g.fillText('MULAI', sx + c * 0.5, sy + c * 0.93);
    // ladders
    for (const [f, to] of Object.entries(B.ladders)) this.ladder(g, Number(f), to);
    // snakes
    this.snakes = {}; Object.entries(B.snakes).forEach(([h, tl], k) => { const pts = this.snakePath(Number(h), tl, k); this.snakes[h] = pts; this.snake(g, pts, SNAKE_COLORS[k % SNAKE_COLORS.length]); });
    // tile numbers last, with a light halo so they stay readable over snakes and ladders
    g.font = '800 ' + Math.max(9, Math.round(c * 0.27)) + 'px system-ui,-apple-system,"Segoe UI",Roboto,sans-serif'; g.textBaseline = 'top'; g.textAlign = 'left'; g.lineJoin = 'round';
    g.lineWidth = Math.max(2, c * 0.07); g.strokeStyle = 'rgba(255,255,255,.85)'; g.fillStyle = '#1e293b';
    for (let n = 1; n <= 100; n++) { const [x, y] = this.tileXY(n); g.strokeText(String(n), x + c * 0.08, y + c * 0.06); g.fillText(String(n), x + c * 0.08, y + c * 0.06); }
    return cv;
  }
  ladder(g, from, to) {
    const c = this.cell, [ax, ay] = this.center(from), [bx, by] = this.center(to), dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy), nx = -dy / len * c * 0.17, ny = dx / len * c * 0.17;
    g.lineCap = 'round';
    const rail = (ox, oy) => { g.beginPath(); g.moveTo(ax + ox, ay + oy); g.lineTo(bx + ox, by + oy); g.stroke(); };
    g.strokeStyle = 'rgba(0,0,0,.25)'; g.lineWidth = c * 0.1; rail(nx + 2, ny + 2); rail(-nx + 2, -ny + 2);
    const rungs = Math.max(2, Math.floor(len / (c * 0.34)));
    g.strokeStyle = '#a16207'; g.lineWidth = c * 0.065;
    for (let i = 1; i < rungs; i++) { const f = i / rungs, x = ax + dx * f, y = ay + dy * f; g.beginPath(); g.moveTo(x + nx, y + ny); g.lineTo(x - nx, y - ny); g.stroke(); }
    g.strokeStyle = '#78350f'; g.lineWidth = c * 0.085; rail(nx, ny); rail(-nx, -ny);
    g.strokeStyle = '#d97706'; g.lineWidth = c * 0.03; rail(nx * 0.8, ny * 0.8); rail(-nx * 1.2, -ny * 1.2);
  }
  snake(g, pts, color) {
    const c = this.cell, n = pts.length - 1; g.lineCap = 'round'; g.lineJoin = 'round';
    const pass = (extra, style) => { for (let i = 0; i < n; i++) { const w = c * (0.26 - 0.17 * i / n) + extra; g.strokeStyle = style; g.lineWidth = w; g.beginPath(); g.moveTo(pts[i][0], pts[i][1]); g.lineTo(pts[i + 1][0], pts[i + 1][1]); g.stroke(); } };
    g.save(); g.translate(2, 2); pass(0, 'rgba(0,0,0,.22)'); g.restore();
    pass(3, '#0b2017'); pass(0, color);
    g.fillStyle = 'rgba(255,255,255,.55)'; for (let i = 4; i < n - 2; i += 5) { const r = c * (0.26 - 0.17 * i / n) * 0.22; g.beginPath(); g.arc(pts[i][0], pts[i][1], r, 0, 7); g.fill(); }
    const [hx, hy] = pts[0], [qx, qy] = pts[2], a = Math.atan2(hy - qy, hx - qx);
    g.save(); g.translate(hx, hy); g.rotate(a);
    g.fillStyle = '#e11d48'; g.fillRect(c * 0.17, -c * 0.015, c * 0.14, c * 0.03);
    g.fillStyle = '#0b2017'; g.beginPath(); g.ellipse(0, 0, c * 0.23, c * 0.19, 0, 0, 7); g.fill();
    g.fillStyle = color; g.beginPath(); g.ellipse(0, 0, c * 0.2, c * 0.16, 0, 0, 7); g.fill();
    g.fillStyle = '#fff'; for (const s of [-1, 1]) { g.beginPath(); g.arc(c * 0.06, s * c * 0.075, c * 0.05, 0, 7); g.fill(); }
    g.fillStyle = '#111'; for (const s of [-1, 1]) { g.beginPath(); g.arc(c * 0.075, s * c * 0.075, c * 0.025, 0, 7); g.fill(); }
    g.restore();
  }
  draw(tokens, pulse) {
    const g = this.g; g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, this.c.width, this.c.height); if (this.bg) g.drawImage(this.bg, 0, 0);
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    const c = this.cell;
    for (const tk of tokens) {
      const r = c * (tk.small ? 0.21 : 0.29), x = tk.x, y = tk.y - (tk.lift || 0);
      g.fillStyle = 'rgba(0,0,0,.28)'; g.beginPath(); g.ellipse(tk.x, tk.y + r * 0.75, r * 0.9, r * 0.35, 0, 0, 7); g.fill();
      if (tk.active) { g.strokeStyle = 'rgba(255,255,255,' + (0.5 + 0.5 * Math.sin(pulse / 220)) + ')'; g.lineWidth = Math.max(2, c * 0.06); g.beginPath(); g.arc(x, y, r + c * 0.07, 0, 7); g.stroke(); }
      g.fillStyle = tk.color; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
      g.lineWidth = Math.max(1.5, c * 0.045); g.strokeStyle = '#fff'; g.stroke();
      g.fillStyle = 'rgba(255,255,255,.35)'; g.beginPath(); g.arc(x - r * 0.3, y - r * 0.35, r * 0.35, 0, 7); g.fill();
      g.fillStyle = '#fff'; g.font = '900 ' + Math.round(r * 1.05) + 'px system-ui,sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(tk.label, x, y + r * 0.05);
    }
  }
}
function star(g, x, y, R1, r) { g.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r : R1; g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } g.closePath(); g.fillStyle = '#facc15'; g.fill(); g.lineWidth = Math.max(1, R1 * 0.14); g.strokeStyle = '#b45309'; g.stroke(); }
function crown(g, x, y, w) { const h = w * 0.55; g.beginPath(); g.moveTo(x - w / 2, y + h / 2); g.lineTo(x - w / 2, y - h / 3); g.lineTo(x - w / 4, y); g.lineTo(x, y - h / 2); g.lineTo(x + w / 4, y); g.lineTo(x + w / 2, y - h / 3); g.lineTo(x + w / 2, y + h / 2); g.closePath(); g.fillStyle = '#f59e0b'; g.fill(); g.lineWidth = Math.max(1, w * 0.06); g.strokeStyle = '#92400e'; g.stroke(); }

const board = new BoardView($('board'));

/* ================= ANIMATION (dice, walking, ladders, snakes, swaps) ================= */
const PIPS = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };
function setDie(el, v, rolling) { const key = v + (rolling ? 'r' : ''); if (el._v === key) return; el._v = key; el.classList.toggle('rolling', !!rolling); el.innerHTML = Array.from({ length: 9 }, (_, i) => '<i' + (PIPS[v] && PIPS[v].includes(i) ? ' class="on"' : '') + '></i>').join(''); el.setAttribute('data-v', v); }
const anim = { key: null, seq: null, items: [], i: 0, t0: 0, shown: {}, final: {}, busy: false, dice: [1], rolling: false, banner: '' };
const speed = () => (reduced.matches ? 0.35 : 1);
function bannerFor(st, name) {
  switch (st.t) {
    case 'ladder': return t('bannerLadder'); case 'snake': return t('bannerSnake'); case 'shield': return '🛡️ ' + t('bannerShield');
    case 'card': return cardIcon(st.c) + ' ' + t('bannerCard', { card: cardName(st.c) }); case 'full': return t('bannerFull'); case 'bonus': return '🎲 ' + t('bannerBonus');
    case 'swap': return '🔄 ' + t('bannerSwap'); case 'win': return '🏆 ' + t('bannerWin', { name: name(st.p) }); case 'skip': return t('bannerSkip', { name: name(st.p) });
    case 'use': return cardIcon(st.c) + ' ' + (st.q ? t('logUseOn', { name: name(st.p), card: cardName(st.c), target: name(st.q) }) : t('logUse', { name: name(st.p), card: cardName(st.c) }));
    default: return '';
  }
}
function buildItems(last, name) {
  const k = speed(), out = [];
  if (last.dice && last.dice.length) out.push({ k: 'dice', dur: 700 * k, dice: last.dice });
  for (const st of last.steps || []) {
    if (st.t === 'walk') { if (st.back) out.push({ k: 'banner', text: '⏪ ' + t('bannerPush', { name: name(st.p) }), dur: 500 * k }); if (st.path && st.path.length) out.push({ k: 'walk', p: st.p, path: st.path, dur: (st.path.length * 175 + 60) * k }); }
    else if (st.t === 'ladder') out.push({ k: 'slide', p: st.p, from: st.from, to: st.to, dur: 650 * k, text: bannerFor(st, name) });
    else if (st.t === 'snake') out.push({ k: 'snake', p: st.p, from: st.from, to: st.to, dur: 900 * k, text: bannerFor(st, name) });
    else if (st.t === 'swap') out.push({ k: 'swap', p: st.p, q: st.q, a: st.a, b: st.b, dur: 750 * k, text: bannerFor(st, name) });
    else out.push({ k: 'banner', text: bannerFor(st, name), dur: (st.t === 'win' ? 1200 : st.t === 'use' ? 800 : 950) * k });
  }
  return out;
}
let curName = id => String(id);
function animSync(s, key) {
  if (!s || !s.pos) return;
  const last = s.last, seq = last ? last.seq : -1;
  if (anim.key !== key) { anim.key = key; anim.seq = seq; anim.items = []; anim.busy = false; anim.shown = U.copy(s.pos); anim.final = U.copy(s.pos); if (last && last.dice) anim.dice = last.dice.slice(); return; }
  if (seq === anim.seq) { if (!anim.busy) anim.shown = U.copy(s.pos); anim.final = U.copy(s.pos); return; }
  anim.seq = seq; anim.final = U.copy(s.pos); anim.rolling = false;
  const items = last ? buildItems(last, curName) : [];
  if (!items.length) { anim.items = []; anim.busy = false; anim.shown = U.copy(s.pos); return; }
  anim.shown = Object.assign({}, U.copy(s.pos), U.copy(last.before || {})); anim.items = items; anim.i = 0; anim.t0 = performance.now(); anim.busy = true; startItem(items[0]);
}
function startItem(it) {
  if (it.text) showBanner(it.text);
  if (it.k === 'dice') { anim.dice = it.dice.slice(); }
}
let bannerTimer = 0;
function showBanner(text) { const b = $('banner'); b.textContent = text; b.classList.remove('show'); void b.offsetWidth; b.classList.add('show'); clearTimeout(bannerTimer); bannerTimer = setTimeout(() => b.classList.remove('show'), reduced.matches ? 900 : 1300); }
function endItem(it) {
  if (it.k === 'walk') anim.shown[it.p] = it.path[it.path.length - 1];
  else if (it.k === 'slide' || it.k === 'snake') anim.shown[it.p] = it.to;
  else if (it.k === 'swap') { anim.shown[it.p] = it.b; anim.shown[it.q] = it.a; }
}
const ease = f => (f < 0.5 ? 2 * f * f : 1 - Math.pow(-2 * f + 2, 2) / 2);
const lerp = (a, b, f) => [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
function startXY(id, order) { const p = board.center(1), i = order.indexOf(Number(id)); return [p[0] + (i % 2 ? 0.22 : -0.22) * board.cell, p[1] + (i < 2 ? -0.2 : 0.18) * board.cell]; }
function restXY(id, tile, order, group) {
  if (!tile) return { xy: startXY(id, order), small: true };
  const c = board.center(tile); if (group.length < 2) return { xy: c, small: false };
  const i = group.indexOf(Number(id)), off = [[-0.2, -0.17], [0.2, -0.17], [-0.2, 0.2], [0.2, 0.2]][i % 4];
  return { xy: [c[0] + off[0] * board.cell, c[1] + off[1] * board.cell], small: true };
}
function animPosition(id, order, groups) {
  const it = anim.busy ? anim.items[anim.i] : null, now = performance.now();
  const f = it ? Math.min(1, (now - anim.t0) / Math.max(1, it.dur)) : 0, from = anim.shown[id] || 0;
  if (it && it.k === 'walk' && Number(it.p) === Number(id)) {
    const n = it.path.length, x = Math.min(n - 1e-6, f * n), idx = Math.floor(x), fr = x - idx;
    const a = idx === 0 ? from : it.path[idx - 1], b = it.path[idx];
    const A = a ? board.center(a) : startXY(id, order), Bp = board.center(b);
    return { xy: lerp(A, Bp, ease(fr)), lift: Math.sin(fr * Math.PI) * board.cell * 0.32 };
  }
  if (it && it.k === 'slide' && Number(it.p) === Number(id)) return { xy: lerp(board.center(it.from), board.center(it.to), ease(f)), lift: Math.sin(f * Math.PI) * board.cell * 0.15 };
  if (it && it.k === 'snake' && Number(it.p) === Number(id)) { const pts = board.snakes[it.from]; if (pts) { const x = ease(f) * (pts.length - 1), i = Math.floor(x); return { xy: lerp(pts[i], pts[Math.min(pts.length - 1, i + 1)], x - i) }; } return { xy: lerp(board.center(it.from), board.center(it.to), f) }; }
  if (it && it.k === 'swap' && (Number(it.p) === Number(id) || Number(it.q) === Number(id))) { const mine = Number(it.p) === Number(id), a = mine ? it.a : it.b, b = mine ? it.b : it.a; const A = a ? board.center(a) : startXY(id, order), Bp = b ? board.center(b) : startXY(id, order); return { xy: lerp(A, Bp, ease(f)), lift: Math.sin(f * Math.PI) * board.cell * 0.5 }; }
  const tile = anim.shown[id] || 0, r = restXY(id, tile, order, groups[tile] || []);
  return { xy: r.xy, small: r.small };
}
function stepAnim(now) {
  if (!anim.busy) return;
  let guard = 0;
  while (anim.busy && now - anim.t0 >= anim.items[anim.i].dur && guard++ < 50) {
    endItem(anim.items[anim.i]); anim.t0 += anim.items[anim.i].dur; anim.i++;
    if (anim.i >= anim.items.length) { anim.busy = false; anim.shown = U.copy(anim.final); requestRender(); }
    else startItem(anim.items[anim.i]);
  }
}

/* ================= RENDER LOOP ================= */
let mode = null, raf = 0, lastPaint = 0, picking = null, pickTurn = null;
function requestRender() { if (!raf) raf = requestAnimationFrame(() => { raf = 0; render(); }); }
function frame(now) {
  if (!mode) return;
  stepAnim(now);
  const s = mode.state();
  if (anim.busy || now - lastPaint > 66) { lastPaint = now; paintBoard(s, now); paintDice(now); }
  requestAnimationFrame(frame);
}
function paintBoard(s, now) {
  const order = (s && s.order) || [], tokens = [], groups = {};
  if (s && s.phase !== 'lobby') {
    for (const id of order) { const tl = anim.shown[id] || 0; (groups[tl] = groups[tl] || []).push(Number(id)); }
    const active = s.turn ? Number(s.turn.p) : null, moving = anim.busy && anim.items[anim.i] ? [anim.items[anim.i].p, anim.items[anim.i].q].map(Number) : [];
    const list = order.map((id, i) => { const p = animPosition(id, order, groups); return { id, x: p.xy[0], y: p.xy[1], lift: p.lift || 0, small: p.small, color: COLORS[i % COLORS.length], label: initial(s.names[id]), active: !anim.busy && active === Number(id) }; });
    list.sort((a, b) => (moving.includes(Number(a.id)) - moving.includes(Number(b.id))) || a.y - b.y);
    tokens.push(...list);
  }
  board.draw(tokens, now);
}
function paintDice(now) {
  const it = anim.busy ? anim.items[anim.i] : null, rolling = (it && it.k === 'dice') || anim.rolling, d = anim.dice || [1];
  const two = d.length === 2 || (anim.rolling && anim.rollCount === 2);
  $('die2').hidden = !two;
  if (rolling) { const v = 1 + Math.floor(now / 90) % 6; setDie($('die1'), v, true); if (two) setDie($('die2'), 1 + Math.floor(now / 110 + 3) % 6, true); }
  else { setDie($('die1'), d[0] || 1, false); if (two) setDie($('die2'), d[1] || 1, false); }
}
const initial = n => { const ch = Array.from(String(n || '?').trim().replace(/^bot\s+/i, ''))[0]; return ch ? ch.toUpperCase() : '?'; };
function fitBoard() {
  if ($('game').hidden) return;
  const body = document.querySelector('.g-body'), wide = window.innerWidth >= 900, top = body.getBoundingClientRect().top + window.scrollY;
  let size;
  if (wide) size = Math.min(body.clientWidth - 320 - 16, window.innerHeight - top - 16, 900);
  else size = Math.min(body.clientWidth, 720);
  body.style.setProperty('--bs', Math.floor(size) + 'px');
  if (board.resize(size)) lastPaint = 0;
}
window.addEventListener('resize', () => { fitBoard(); requestRender(); });

function logText(e, name) {
  const dice = d => (d || []).join(' + ');
  switch (e.t) {
    case 'start': return t('logStart');
    case 'roll': { const d = dice(e.d) + (e.m === 'lompat' ? ' + ' + R.plus : ''); return t(e.b ? 'logRollBounce' : 'logRoll', { name: name(e.p), dice: d, to: e.to }); }
    case 'ladder': return '🪜 ' + t('logLadder', { name: name(e.p), from: e.f, to: e.to });
    case 'snake': return '🐍 ' + t('logSnake', { name: name(e.p), from: e.f, to: e.to });
    case 'shield': return '🛡️ ' + t('logShield', { name: name(e.p), from: e.f });
    case 'card': return '★ ' + t('logCard', { name: name(e.p), card: cardName(e.c) });
    case 'full': return t('logFull', { name: name(e.p) });
    case 'use': return cardIcon(e.c) + ' ' + (e.q ? t('logUseOn', { name: name(e.p), card: cardName(e.c), target: name(e.q) }) : t('logUse', { name: name(e.p), card: cardName(e.c) }));
    case 'bonus': return '🎲 ' + t('logBonus', { name: name(e.p) });
    case 'skip': return t('logSkipLeft', { name: name(e.p) });
    case 'over': return e.p ? '🏆 ' + t('logOver', { name: name(e.p) }) : t('logOverLeft');
    default: return '';
  }
}
function colorOf(s, id) { const i = (s.order || []).indexOf(Number(id)); return COLORS[(i < 0 ? 0 : i) % COLORS.length]; }
function render() {
  if (!mode) return;
  const s = mode.state(), v = mode.view(s);
  curName = v.name;
  $('gameTitle').textContent = v.title; $('gameSub').textContent = v.sub || '';
  if (s) animSync(s, mode.key);
  const playing = !!s && s.phase === 'playing', cur = playing ? Number(s.turn.p) : null, idle = !anim.busy;
  if (pickTurn !== (playing ? s.seq : null)) { picking = null; pickTurn = playing ? s.seq : null; }
  // turn line
  let turn = '';
  if (playing) {
    const who = v.name(cur), col = colorOf(s, cur);
    const text = v.controls(cur) ? (v.multiHuman ? t('turnPass', { name: who }) : t('turnYou')) : (v.isBot && v.isBot(cur) ? t('botThinking', { name: who }) : t('turnOf', { name: who }));
    turn = '<span class="dot" style="background:' + col + '"></span><b>' + esc(text) + '</b>' + (s.turn.mod ? ' <span class="tag">' + esc(t('activeMod', { card: cardName(s.turn.mod) })) + '</span>' : '');
  } else if (s && s.phase === 'over') turn = '<b>' + esc(t('overTitle')) + '</b>';
  else turn = '<b>' + esc(t('lobbyTitle')) + '</b>';
  setHTML($('turn'), turn);
  const canRoll = playing && v.controls(cur) && idle && !v.pending;
  const rb = $('rollBtn');
  rb.textContent = v.pending ? t('rolling') : !playing || !v.controls(cur) ? t('waitTurn') : s.turn.mod === 'ganda' ? t('roll2') : s.turn.mod === 'lompat' ? t('rollPlus', { n: R.plus }) : t('roll');
  rb.disabled = !canRoll; rb.classList.toggle('pulse', canRoll);
  $('act').hidden = !s || s.phase !== 'playing';
  // timer (online)
  const tm = $('timer');
  if (v.timer && playing) { tm.hidden = false; const f = Math.max(0, Math.min(1, v.timer.left / v.timer.total)); tm.firstChild.style.width = (f * 100).toFixed(1) + '%'; tm.classList.toggle('low', v.timer.left < 8000); tm.title = t('timeLeft', { n: Math.max(0, Math.ceil(v.timer.left / 1000)) }); }
  else tm.hidden = true;
  // hand
  setHTML($('hand'), s && s.phase !== 'lobby' ? handHTML(s, v, canRoll) : '');
  // players
  setHTML($('plist'), playersHTML(s, v));
  // log
  $('log').parentElement.hidden = !(s && s.log && s.log.length);
  setHTML($('log'), s && s.log ? s.log.slice().reverse().slice(0, 12).map(e => '<li>' + esc(logText(e, v.name)) + '</li>').join('') : '');
  // stage overlay (results wait for the last animation)
  const stage = $('stage'), html = v.stage && (!v.stageAfterAnim || idle) ? v.stage : '';
  stage.hidden = !html; setHTML(stage, html);
  fitBoard();
}
function handHTML(s, v, canRoll) {
  const owner = v.handOwner(s); if (owner === null || owner === undefined) return '';
  const name = v.name(owner);
  let html = '<h3>' + esc(t('handTitle', { name })) + '</h3>';
  if (s.settings.powerups === false) return html + '<p class="muted">' + esc(t('handOff')) + '</p>';
  const h = (s.hand && s.hand[owner]) || [], mine = canRoll && s.turn && Number(s.turn.p) === Number(owner);
  if (picking && mine) {
    const opp = s.order.filter(id => Number(id) !== Number(owner));
    html += '<p class="pick-q">' + esc(t('pickTarget', { card: cardName(picking) })) + '</p><div class="targets">' + opp.map(id => { const ok = !U.cardBlock(s, owner, picking, id, v.present ? v.present() : null); return '<button type="button" class="btn small target" data-act="target" data-id="' + id + '"' + (ok ? '' : ' disabled') + '><span class="dot" style="background:' + colorOf(s, id) + '"></span>' + esc(v.name(id)) + ' · ' + esc(s.pos[id] ? t('tile', { n: s.pos[id] }) : t('tileStart')) + '</button>'; }).join('') + '<button type="button" class="btn small ghost" data-act="cancel">' + esc(t('cancel')) + '</button></div>';
    return html;
  }
  if (!h.length) return html + '<p class="muted">' + esc(t('handEmpty')) + '</p>';
  html += '<ul class="pcards">' + h.map((c, i) => {
    let btn;
    if (c === 'perisai') btn = '<span class="tag">' + esc(t('auto')) + '</span>';
    else {
      const why = U.cardBlock(s, owner, c, undefined, null), possible = mine && (!why || (why === 'target' && s.order.some(id => Number(id) !== Number(owner) && !U.cardBlock(s, owner, c, id, v.present ? v.present() : null))));
      btn = '<button type="button" class="btn small primary" data-act="card" data-c="' + esc(c) + '"' + (possible ? '' : ' disabled') + ' aria-label="' + esc(t('use') + ' ' + cardName(c)) + '">' + esc(t('use')) + '</button>';
    }
    return '<li class="pcard c-' + esc(c) + '"><span class="pi" aria-hidden="true">' + esc(cardIcon(c)) + '</span><span class="pt"><b>' + esc(cardName(c)) + '</b><small>' + esc(CARDS[c] ? CARDS[c].short : '') + '</small></span>' + btn + '</li>';
  }).join('') + '</ul>';
  if (s.turn && Number(s.turn.p) === Number(owner) && s.turn.used) html += '<p class="muted small">' + esc(t('usedThisTurn')) + '</p>';
  return html;
}
function playersHTML(s, v) {
  const rows = v.roster(s);
  return rows.map(r => '<li class="pl' + (r.active ? ' active' : '') + (r.gone ? ' gone' : '') + '"><span class="tok" style="background:' + r.color + '">' + esc(initial(r.name)) + '</span><span class="pn"><b>' + esc(r.name) + '</b>' + r.badges.map(b => '<em>' + esc(b) + '</em>').join('') + '<small>' + esc(r.where) + '</small></span><span class="ph" aria-label="' + esc((r.hand || []).map(cardName).join(', ')) + '">' + (r.hand || []).map(c => '<i title="' + esc(cardName(c)) + '">' + esc(cardIcon(c)) + '</i>').join('') + '</span></li>').join('') + (v.extra ? '<li class="muted small">' + esc(v.extra) + '</li>' : '');
}
function rosterFromState(s, v, extra) {
  return (s.order || []).map((id, i) => ({ id, name: v.name(id), color: COLORS[i % COLORS.length], active: s.phase === 'playing' && Number(s.turn.p) === Number(id), where: (anim.final[id] || s.pos[id]) ? t('tile', { n: s.pos[id] }) : t('tileStart'), hand: s.hand[id] || [], badges: extra(id), gone: false }));
}
function podiumHTML(s, v) {
  const rows = U.ranking(s);
  return '<ol class="podium">' + rows.map((r, i) => '<li' + (r.win ? ' class="win"' : '') + '><span class="place">' + (r.win ? '🏆' : i + 1) + '</span><span class="dot" style="background:' + colorOf(s, r.id) + '"></span><b>' + esc(v.name(r.id)) + '</b><small>' + esc(r.pos ? t('tile', { n: r.pos }) : t('tileStart')) + '</small></li>').join('') + '</ol>';
}
function showGame(m) {
  mode = m; picking = null; anim.key = null; $('home').hidden = true; $('game').hidden = false; document.body.classList.add('in-game');
  if (location.hash) history.replaceState(null, '', location.pathname + location.search);
  window.scrollTo(0, 0); fitBoard(); render(); requestAnimationFrame(frame);
  const h = $('gameTitle'); h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true });
}
function showHome() { mode = null; $('game').hidden = true; $('home').hidden = false; document.body.classList.remove('in-game'); scheduleRooms(); }

$('game').addEventListener('click', e => {
  const b = e.target.closest('[data-act]'); if (!b || !mode || b.disabled) return;
  const a = b.dataset.act, s = mode.state();
  if (a === 'card') { const c = b.dataset.c; if (U.TARGET_CARDS.includes(c)) { picking = c; render(); } else mode.card(c); }
  else if (a === 'target') { const c = picking; picking = null; mode.card(c, Number(b.dataset.id)); }
  else if (a === 'cancel') { picking = null; render(); }
  else if (mode.act) mode.act(a, b, s);
});
$('rollBtn').addEventListener('click', () => { if (mode && !$('rollBtn').disabled) mode.roll(); });
$('exitBtn').addEventListener('click', () => { if (mode) mode.exit(); });
document.addEventListener('keydown', e => { if (!mode || e.target.closest('input,textarea,select')) return; if ((e.key === ' ' || e.key === 'Enter') && document.activeElement === document.body && !$('rollBtn').disabled) { e.preventDefault(); mode.roll(); } });

/* ================= LOCAL GAMES: practice vs bots & pass-and-play ================= */
let localKey = 0;
class LocalMode {
  constructor(kind, players, powerups) {
    this.kind = kind; this.players = players; this.powerups = powerups; this.key = 'local' + (++localKey); this.botAt = 0;
    this.s = U.startGame(U.newState({ powerups }), players.map(p => ({ id: p.id, name: p.name })), Date.now(), R);
    this.byId = {}; for (const p of players) this.byId[p.id] = p;
  }
  ctx() { return { now: Date.now(), R, B, present: null }; }
  state() { return this.s; }
  isBot(id) { return !!(this.byId[id] && this.byId[id].bot); }
  set(s) { this.s = s; render(); }
  roll() { const s = this.s; if (s.phase !== 'playing' || anim.busy || this.isBot(s.turn.p)) return; this.doRoll(); }
  doRoll() { const s = this.s, dice = Array.from({ length: U.diceNeeded(s) }, U.die); this.set(U.rollMove(s, s.turn.p, dice, this.ctx())); }
  card(c, target) { const s = this.s; if (s.phase !== 'playing' || anim.busy) return; try { this.set(U.useCard(s, s.turn.p, c, target, this.ctx())); } catch (e) { toast(errMsg(e)); } }
  tick() {
    const s = this.s; if (s.phase !== 'playing' || anim.busy || !this.isBot(s.turn.p)) { this.botAt = 0; return; }
    const now = Date.now(); if (!this.botAt) { this.botAt = now + (G.botDelayMs || 700) * speed(); render(); return; }
    if (now < this.botAt) return; this.botAt = 0;
    const plan = U.botPlan(s, s.turn.p, R);
    if (plan) { try { this.set(U.useCard(s, s.turn.p, plan.card, plan.target, this.ctx())); return; } catch (e) { /* fall through to roll */ } }
    this.doRoll();
  }
  exit() { if (this.s.phase === 'playing' && !confirm(t('exitConfirm'))) return; showHome(); }
  act(a) { if (a === 'again') showGame(new LocalMode(this.kind, this.players, this.powerups)); else if (a === 'home') showHome(); }
  view(s) {
    const humans = this.players.filter(p => !p.bot);
    const v = { title: this.kind === 'practice' ? t('practiceHeader') : t('partyHeader'), sub: '', name: id => (s.names[id] || '—'), controls: id => !this.isBot(id), isBot: id => this.isBot(id), multiHuman: humans.length > 1, stageAfterAnim: true };
    v.handOwner = st => (st.phase === 'playing' && !this.isBot(st.turn.p) ? st.turn.p : humans[0].id);
    v.roster = st => rosterFromState(st, v, id => (this.isBot(id) ? [t('botBadge')] : humans.length === 1 ? [t('youBadge')] : []));
    if (s.phase === 'over') v.stage = '<div class="stage-card"><h3>' + esc(t('overTitle')) + '</h3><p class="big">' + esc(t('overWinner', { name: v.name(s.winner) })) + '</p>' + podiumHTML(s, v) + '<div class="stage-actions"><button type="button" class="btn primary" data-act="again">' + esc(t('playAgain')) + '</button><button type="button" class="btn ghost" data-act="home">' + esc(t('backHome')) + '</button></div></div>';
    return v;
  }
}
function startPractice() {
  const n = Math.max(1, Math.min(3, Number($('botsSelect').value) || 3)), me = ($('nameInput').value.replace(/\s+/g, ' ').trim() || t('youName')).slice(0, 20);
  const players = [{ id: 1, name: me, bot: false }].concat(BOTS.slice(0, n).map((b, i) => ({ id: i + 2, name: b, bot: true })));
  showGame(new LocalMode('practice', players, $('practicePower').checked));
}
$('practiceStart').addEventListener('click', startPractice);
let partyNames = ['', ''];
function renderPartyNames() {
  $('partyNames').innerHTML = partyNames.map((n, i) => '<li><span class="dot" style="background:' + COLORS[i] + '" aria-hidden="true"></span><label class="sr-only" for="pn' + i + '">' + esc(t('partyDefault', { n: i + 1 })) + '</label><input type="text" id="pn' + i + '" maxlength="20" value="' + esc(n) + '" placeholder="' + esc(t('partyDefault', { n: i + 1 })) + '" data-i="' + i + '"><button type="button" class="icon-btn" data-rm="' + i + '" aria-label="' + esc(t('partyRemove', { name: n || t('partyDefault', { n: i + 1 }) })) + '"' + (partyNames.length <= 2 ? ' disabled' : '') + '>×</button></li>').join('');
  $('partyAdd').disabled = partyNames.length >= 4;
}
$('partyNames').addEventListener('input', e => { const i = e.target.dataset.i; if (i !== undefined) partyNames[Number(i)] = e.target.value; });
$('partyNames').addEventListener('click', e => { const b = e.target.closest('[data-rm]'); if (!b || partyNames.length <= 2) return; partyNames.splice(Number(b.dataset.rm), 1); renderPartyNames(); });
$('partyAdd').addEventListener('click', () => { if (partyNames.length < 4) { partyNames.push(''); renderPartyNames(); const last = $('pn' + (partyNames.length - 1)); if (last) last.focus(); } });
$('partyForm').addEventListener('submit', e => {
  e.preventDefault();
  const players = partyNames.map((n, i) => ({ id: i + 1, name: (n.replace(/\s+/g, ' ').trim() || t('partyDefault', { n: i + 1 })).slice(0, 20), bot: false }));
  showGame(new LocalMode('party', players, $('partyPower').checked));
});

/* ================= ONLINE ================= */
const RT = Object.assign({ mode: 'socket', reconnectMaxSeconds: 15 }, CFG.realtime || {});
const net = new U.Connection({ storage: session, reconnectMaxMs: RT.reconnectMaxSeconds * 1000, onWake: () => { if (mode && mode.kind === 'online') mode.wake(); }, onSocket: () => { updateConn(); requestRender(); }, lobbyWake: () => scheduleRooms() });
function onlineError(e) {
  if (!e) return;
  if (e.status === 403 || e.status === 404) { if (mode && mode.kind === 'online') { toast(t('errMember')); net.forget(); showHome(); } return; }
  if (e.code === 'busy' || e.status === 409) return;
  if (e.code === 'network') { updateConn(); return; }
  toast(errMsg(e));
}
async function copyInvite(code) {
  const url = location.origin + location.pathname + '?room=' + encodeURIComponent(code);
  try { await navigator.clipboard.writeText(url); toast(t('copied')); } catch (e) { toast(t('copyFail', { code })); }
}
class OnlineMode {
  constructor(game) { this.kind = 'online'; this.game = game; this.key = 'online'; this.pending = false; }
  state() { const s = this.game.s; return U.supported(s) ? s : null; }
  wake() { this.game.refresh().catch(onlineError); }
  tick() { this.game.tick(); } // writes only (host duties); reads come from Reverb wakeups, never a timer
  roll() { if (this.pending || anim.busy) return; this.pending = true; anim.rolling = true; anim.rollCount = U.diceNeeded(this.game.s); render(); this.game.roll().catch(e => toast(errMsg(e))).finally(() => { this.pending = false; anim.rolling = false; render(); }); }
  card(c, target) { if (anim.busy) return; this.game.useCard(c, target).catch(e => toast(errMsg(e))); }
  async exit() { if (!confirm(t('exitConfirm'))) return; try { await this.game.leave(); } catch (e) { /* ignore */ } showHome(); }
  act(a, el) {
    const g = this.game;
    if (a === 'start') g.start().catch(e => toast(errMsg(e)));
    else if (a === 'rematch') g.rematch().catch(e => toast(errMsg(e)));
    else if (a === 'copy') copyInvite(g.data.code);
    else if (a === 'power') g.settings({ powerups: el.checked }).catch(e => toast(errMsg(e)));
    else if (a === 'home') g.leave().finally(showHome);
  }
  view(s) {
    const g = this.game, d = g.data, me = g.me;
    const nameOf = id => { const p = g.players().find(x => Number(x.id) === Number(id)); return p ? p.displayName : (s && s.names && s.names[id]) || '—'; };
    const v = { title: d ? t('roomTitle', { code: d.code }) : '…', sub: '', name: nameOf, controls: id => !!d && !d.spectator && Number(id) === Number(me), multiHuman: false, pending: this.pending, stageAfterAnim: true, present: () => new Set(U.seated(g.players()).map(p => p.id)) };
    if (!d) return Object.assign(v, { handOwner: () => null, roster: () => [] });
    if (d.spectator) v.sub = t('spectatorBadge');
    if (net.state === 'reconnecting') v.sub += (v.sub ? ' · ' : '') + '⚠ ' + t('connReconnecting');
    const seatedList = U.seated(d.players), specs = d.players.filter(p => p.spectator).length, here = new Set(seatedList.map(p => p.id));
    v.extra = specs ? t('spectatorsCount', { n: specs }) : '';
    v.handOwner = st => (d.spectator ? (st.phase === 'playing' ? st.turn.p : null) : me);
    const badges = id => [Number(id) === Number(me) ? t('youBadge') : null, s && s.hostId === Number(id) ? t('hostBadge') : null, !here.has(Number(id)) ? t('goneBadge') : null].filter(Boolean);
    v.roster = st => {
      if (!st || st.phase === 'lobby') return seatedList.map((p, i) => ({ id: p.id, name: p.displayName, color: COLORS[i % COLORS.length], active: false, where: '', hand: [], badges: badges(p.id) }));
      return rosterFromState(st, v, badges).map(r => Object.assign(r, { gone: !here.has(Number(r.id)) }));
    };
    if (s && s.phase === 'playing') v.timer = { left: s.turn.until - g.now(), total: R.turnSeconds * 1000 };
    if (d.status === 'closed') v.stage = '<div class="stage-card"><h3>' + esc(t('closedTitle')) + '</h3><p class="muted">' + esc(t('closedText')) + '</p><div class="stage-actions"><button type="button" class="btn primary" data-act="home">' + esc(t('backHome')) + '</button></div></div>';
    else if (!s || s.phase === 'lobby') v.stage = this.lobbyStage(d, s, seatedList);
    else if (s.phase === 'over') v.stage = '<div class="stage-card"><h3>' + esc(t('overTitle')) + '</h3><p class="big">' + esc(s.winner ? t('overWinner', { name: nameOf(s.winner) }) : t('overLeft')) + '</p>' + podiumHTML(s, v) + '<div class="stage-actions">' + (g.isHost() ? '<button type="button" class="btn primary" data-act="rematch">' + esc(t('rematch')) + '</button>' : '<p class="muted">' + esc(t('rematchWait')) + '</p>') + '<button type="button" class="btn ghost" data-act="home">' + esc(t('exit')) + '</button></div></div>';
    return v;
  }
  lobbyStage(d, s, seatedList) {
    const g = this.game, need = Math.max(0, 2 - seatedList.length), power = !s || s.settings.powerups !== false;
    let html = '<h3>' + esc(t('lobbyTitle')) + '</h3><p class="muted">' + esc(t('lobbyInvite')) + '</p><div class="code">' + esc(d.code) + '</div>';
    html += '<p class="muted">' + esc(t('lobbyCount', { n: seatedList.length, max: d.maxPlayers })) + '</p>';
    html += '<ul class="lobby-list">' + seatedList.map((p, i) => '<li><span class="dot" style="background:' + COLORS[i % COLORS.length] + '"></span>' + esc(p.displayName) + (p.id === g.me ? ' <em>' + esc(t('youBadge')) + '</em>' : '') + (s && s.hostId === p.id ? ' <em>' + esc(t('hostBadge')) + '</em>' : '') + '</li>').join('') + '</ul>';
    if (g.isHost()) html += '<label class="check"><input type="checkbox" data-act="power"' + (power ? ' checked' : '') + '> ' + esc(t('powerupsLabel')) + '</label>';
    else html += '<p class="muted small">' + esc(t('powerupsLabel') + ': ' + (power ? t('on') : t('off'))) + '</p>';
    html += '<div class="stage-actions"><button type="button" class="btn small ghost" data-act="copy">' + esc(t('copyInvite')) + '</button>' + (g.isHost() ? '<button type="button" class="btn primary" data-act="start"' + (need ? ' disabled' : '') + '>' + esc(t('start')) + '</button>' : '') + '</div>';
    html += '<p class="muted small">' + esc(need ? t('lobbyNeed', { n: need }) : (g.isHost() ? '' : t('lobbyWaitHost'))) + '</p>';
    return '<div class="stage-card">' + html + '</div>';
  }
}
let onlineState = 'off', roomsTimer = 0, roomsAt = 0, roomList = [];
function setOnline(state, msg, isErr) { onlineState = state; document.querySelectorAll('.online-btn').forEach(b => { b.disabled = state !== 'ready'; }); note(msg || '', isErr); updateConn(); }
function note(msg, isErr) { const n = $('onlineNote'); n.textContent = msg; n.classList.toggle('err', !!isErr); }
function updateConn() {
  const c = $('conn'); let st = 'offline', label = t('connOffline');
  if (net.config && !net.stopped) { if (net.state === 'online') { st = 'online'; label = t('connOnline'); } else if (net.state === 'reconnecting') { st = 'reconnecting'; label = t('connReconnecting'); } else { st = 'reconnecting'; label = t('connConnecting'); } }
  c.dataset.state = st; c.textContent = label;
}
function scheduleRooms() { if ($('home').hidden) return; clearTimeout(roomsTimer); roomsTimer = setTimeout(loadRooms, Math.max(0, 1500 - (Date.now() - roomsAt))); }
async function loadRooms() {
  if (onlineState !== 'ready' || $('home').hidden) { renderRooms(); return; }
  roomsAt = Date.now();
  try { const r = await net.rooms(); roomList = (r && Array.isArray(r.rooms)) ? r.rooms : []; } catch (e) { if (e.code !== 'busy') roomList = []; }
  renderRooms();
}
function renderRooms() {
  const el = $('rooms');
  if (onlineState !== 'ready') { el.innerHTML = ''; return; }
  if (!roomList.length) { el.innerHTML = '<li class="muted">' + esc(t('roomsEmpty')) + '</li>'; return; }
  el.innerHTML = roomList.map(r => { const open = r.status === 'waiting' && r.seated < r.maxPlayers; return '<li class="room"><span><b>' + esc(r.code) + '</b><small>' + esc((r.status === 'waiting' ? t('roomWaiting') : t('roomPlaying')) + ' · ' + t('roomSeats', { n: r.seated, max: r.maxPlayers }) + (r.spectators ? ' · ' + t('roomSpectators', { n: r.spectators }) : '')) + '</small></span><button type="button" class="btn small ' + (open ? 'teal' : 'ghost') + '" data-room="' + esc(r.code) + '" data-kind="' + (open ? 'join' : 'watch') + '">' + esc(open ? t('join') : t('watch')) + '</button></li>'; }).join('');
}
$('rooms').addEventListener('click', e => { const b = e.target.closest('[data-room]'); if (!b) return; $('codeInput').value = b.dataset.room; go(b.dataset.kind, b.dataset.room); });
function newGame() { return new U.OnlineGame(net, CFG, { onChange: () => requestRender(), onNotice: onlineError }); }
let entering = false;
// result for the invite gate: {ok} | {ok:false, missing|retry, message}
function joinFail(e) { return { ok: false, missing: e.status === 404 || e.status === 422, retry: e.code === 'network' || e.code === 'busy' || e.status === 429, message: errMsg(e) }; }
async function go(kind, code) {
  if (entering || onlineState !== 'ready') return { ok: false, retry: true };
  const name = $('nameInput').value.replace(/\s+/g, ' ').trim().slice(0, 24);
  if (!name) { note(t('errName'), true); $('nameInput').focus(); return { ok: false, retry: true, message: t('errName') }; }
  if ((kind === 'join' || kind === 'watch') && !/^[A-Z2-9]{6}$/.test(code || '')) { note(t('errCode'), true); $('codeInput').focus(); return { ok: false, missing: true }; }
  local.set('ut.name', name); entering = true; document.querySelectorAll('.online-btn').forEach(b => { b.disabled = true; });
  const g = newGame(), opts = { displayName: name, code, maxPlayers: Math.max(2, Math.min(4, Number($('maxSelect').value) || 4)), settings: { powerups: true } };
  try { await g.enter(kind, opts); note(''); showGame(new OnlineMode(g)); return { ok: true }; }
  catch (e) {
    if (kind === 'join' && e.status === 409 && /not open/i.test(e.server || '')) {
      try { await g.enter('watch', opts); toast(t('nowWatching')); showGame(new OnlineMode(g)); return { ok: true }; } catch (e2) { note(errMsg(e2), true); return joinFail(e2); }
    } else { note(errMsg(e), true); return joinFail(e); }
  } finally { entering = false; if (onlineState === 'ready') document.querySelectorAll('.online-btn').forEach(b => { b.disabled = false; }); }
}
$('createPrivate').addEventListener('click', () => go('private'));
$('createPublic').addEventListener('click', () => go('public'));
$('quickMatch').addEventListener('click', () => go('match'));
$('joinForm').addEventListener('submit', e => { e.preventDefault(); go('join', $('codeInput').value.trim().toUpperCase()); });
$('watchBtn').addEventListener('click', () => go('watch', $('codeInput').value.trim().toUpperCase()));
$('refreshRooms').addEventListener('click', loadRooms);
$('codeInput').addEventListener('input', e => { const el = e.target, v = el.value.toUpperCase().replace(/[^A-Z2-9]/g, '').slice(0, 6); if (v !== el.value) el.value = v; });

/* ================= static content ================= */
function applyText() {
  document.querySelectorAll('[data-t]').forEach(el => { el.textContent = t(el.dataset.t); });
  document.querySelectorAll('[data-t-ph]').forEach(el => { el.placeholder = t(el.dataset.tPh); });
  document.querySelectorAll('[data-t-aria]').forEach(el => { el.setAttribute('aria-label', t(el.dataset.tAria)); });
  document.querySelectorAll('[data-c]').forEach(el => { el.textContent = cfgPath(el.dataset.c) || ''; });
  const h1 = $('heroTitle'), title = t('heroTitle'), cut = title.indexOf(', ');
  if (cut > 0) { h1.textContent = ''; h1.append(title.slice(0, cut + 2)); const m = document.createElement('span'); m.className = 'mark'; m.textContent = title.slice(cut + 2); h1.append(m); }
  $('steps').innerHTML = (CFG.rules || []).map(r => '<li><h3>' + esc(r.title) + '</h3><p>' + esc(r.text) + '</p></li>').join('');
  $('cardsList').innerHTML = U.CARDS.filter(c => CARDS[c]).map(c => '<li class="c-' + c + '"><span class="pi" aria-hidden="true">' + esc(cardIcon(c)) + '</span><div><h4>' + esc(cardName(c)) + '</h4><p>' + esc(CARDS[c].text) + '</p></div></li>').join('');
  if (CFG.site && CFG.site.themeColor) { const tc = document.querySelector('meta[name=theme-color]'); if (tc) tc.setAttribute('content', CFG.site.themeColor); }
  renderPartyNames(); updateConn();
}
function heroBoard() { const cv = $('heroBoard'), v = new BoardView(cv); v.resize(Math.min(420, cv.parentElement.clientWidth || 360)); v.draw([], 0); }
$('brandLink').addEventListener('click', e => { if (mode) { e.preventDefault(); mode.exit(); } });
function route() { const h = location.hash.toLowerCase(); if ((h === '#practice' || h === '#latihan') && !mode) startPractice(); }
window.addEventListener('hashchange', route);

/* ---------------- boot ---------------- */
$('nameInput').value = local.get('ut.name') || '';
applyText(); heroBoard(); window.addEventListener('resize', () => { if (!mode) heroBoard(); });
setInterval(() => { if (mode) { mode.tick(); if (mode.kind === 'online') requestRender(); } }, 250);
// invite link (?room=CODE): handled by the JRInvite gate below (name prompt only, or back to the menu with a notice)
const invite = window.JRInvite ? JRInvite.code('room') : '';
route();
async function resumeSaved() { const g = newGame(); try { await g.resume(); if (!mode) showGame(new OnlineMode(g)); } catch (e) { if (e.status === 403 || e.status === 404) net.forget(); } }
const onlineReady = (async function initOnline() {
  if (!net.allowed) { setOnline('off', t('errOffline')); return 'offline'; }
  setOnline('checking', t('onlineChecking'));
  try {
    await net.start(); setOnline('ready', t('onlineReady')); loadRooms();
    if (net.code && net.token && !mode && (!invite || invite === net.code)) await resumeSaved();
    return 'ready';
  } catch (e) { const key = e.code === 'disabled' ? 'errDisabled' : e.code === 'mismatch' ? 'errMismatch' : 'errNetwork'; setOnline('off', t(key), true); return t(key); }
})();
if (invite) JRInvite.run({
  code: invite, lang: 'id', gameName: (CFG.site && CFG.site.name) || '', nameKey: 'ut.name', nameMax: 24,
  check: async c => { const st = await onlineReady; if (st === 'offline') return 'offline'; if (st !== 'ready') return { fallback: st }; if (mode && mode.kind === 'online' && net.code === c) return 'session'; return JRInvite.probe(c); },
  join: name => { $('nameInput').value = name; $('codeInput').value = invite; return go('join', invite); },
  fallback: msg => { $('codeInput').value = ''; if (msg) note(msg, true); if (!mode) { const p = $('play'); if (p) p.scrollIntoView({ block: 'start' }); if (net.code && net.token && onlineState === 'ready') resumeSaved(); } }
});
window.addEventListener('online', () => { if (onlineState === 'ready') net.visible(); });
// one catch-up read when the tab comes back (browsers may have throttled or dropped the socket meanwhile)
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && onlineState === 'ready') net.visible(); });
})();

/* Duel Gelembung: UI, practice vs bots, tutorial, online versus, chat, SFX. */
(function () {
'use strict';
const D = window.DG, N = window.DGNet, R = window.DGR, $ = id => document.getElementById(id);
let CFG; try { CFG = JSON.parse($('website-config').textContent); } catch (e) { CFG = {}; }
CFG.text = CFG.text || {}; CFG.chars = CFG.chars || {}; CFG.balls = CFG.balls || {};
R.setPalette(CFG.colors);
const COLORS = (CFG.colors || []).map(c => c.hex), SHAPES = (CFG.colors || []).map(c => c.shape);
const CHAT = CFG.chat || [], EMOJIS = CFG.emojis || [];
const SEAT = ['#F0E442', '#56B4E9', '#E69F00', '#CC79A7'];
const local = { get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* private mode */ } } };
let session = null; try { session = window.sessionStorage; } catch (e) { session = null; }
const reduced = window.matchMedia ? matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
function t(key, vars) { let s = CFG.text[key]; if (s === undefined) s = key; if (vars) s = String(s).replace(/\{(\w+)\}/g, (m, n) => (vars[n] !== undefined ? vars[n] : m)); return s; }
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const cfgPath = p => p.split('.').reduce((o, k) => (o ? o[k] : undefined), CFG);
const ch = k => CFG.chars[k] || { name: k, icon: '●', color: '#888', skill: k, skillText: '', perk: '' };
const mmss = ms => { const s = Math.max(0, Math.floor(ms / 1000)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
function setHTML(el, html) { if (el._h !== html) { el._h = html; el.innerHTML = html; } }
let toastTimer;
function toast(msg) { const el = $('toast'); el.textContent = msg; el.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => { el.hidden = true; }, 3200); }
function errMsg(e) {
  if (!e) return '';
  if (e.code === 'busy' || e.status === 429) return t('errBusy', { n: e.wait || 10 });
  const map = { few: 'errFew', budget: 'errBudget', slow: 'errSlow', taken: 'errTaken', network: 'errNetwork', offline: 'errOffline', mismatch: 'errMismatch', disabled: 'errDisabled' };
  if (map[e.code]) return t(map[e.code]);
  if (e.status === 404 || e.status === 422) return t('errNoRoom');
  if (e.status === 409 && /full|not open/i.test(e.server || '')) return t('errFull');
  return t('errGeneric');
}
/* ---------------- sound (WebAudio synth, no files) ---------------- */
const SFX = (() => {
  let ctx = null, master = null, nbuf = null, muted = local.get('gelembung.mute') === '1';
  const last = {}, GAP = { pop: 45, bounce: 60, drop: 70, tick: 200, chat: 150, land: 50, chain: 40, burst: 120 };
  function init() { if (ctx) return; const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return; try { ctx = new AC(); master = ctx.createGain(); master.gain.value = 0.22; master.connect(ctx.destination); } catch (e) { ctx = null; } }
  function noise() { if (!nbuf) { const n = Math.floor(ctx.sampleRate * 0.6); nbuf = ctx.createBuffer(1, n, ctx.sampleRate); const d = nbuf.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1; } return nbuf; }
  function tone(type, f0, f1, dur, vol, at) {
    const t0 = ctx.currentTime + (at || 0), o = ctx.createOscillator(), g = ctx.createGain(); o.type = type; o.frequency.setValueAtTime(f0, t0); if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol, t0 + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur); o.connect(g); g.connect(master); o.start(t0); o.stop(t0 + dur + 0.03);
  }
  function hiss(dur, vol, type, freq, at, q) {
    const t0 = ctx.currentTime + (at || 0), src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain(); src.buffer = noise(); f.type = type; f.frequency.value = freq; f.Q.value = q || 0.8;
    g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur); src.connect(f); f.connect(g); g.connect(master); src.start(t0, Math.random() * 0.3); src.stop(t0 + dur + 0.03);
  }
  const S = {
    shoot: () => { tone('triangle', 420, 760, 0.08, 0.12); hiss(0.06, 0.08, 'highpass', 2200); },
    bounce: () => tone('square', 300, 260, 0.04, 0.05),
    land: () => tone('sine', 220, 160, 0.06, 0.12),
    pop: n => { const f = 520 * Math.pow(1.12, Math.min(8, n || 0)); tone('sine', f, f * 1.9, 0.09, 0.14); },
    drop: () => tone('triangle', 700, 260, 0.18, 0.08),
    boom: () => { hiss(0.4, 0.4, 'lowpass', 500); tone('sine', 140, 40, 0.35, 0.35); },
    crack: () => { hiss(0.08, 0.25, 'highpass', 3800); tone('square', 1800, 900, 0.05, 0.04); },
    unlock: () => [880, 1320].forEach((f, i) => tone('square', f, f, 0.05, 0.05, i * 0.05)),
    row: () => { tone('sawtooth', 110, 70, 0.22, 0.14); hiss(0.18, 0.15, 'lowpass', 300); },
    warn: () => [0, 0.16].forEach(a => tone('square', 880, 880, 0.07, 0.07, a)),
    full: n => { for (let k = 0; k < (n || 1); k++) [523, 659, 784, 1047].forEach((f, i) => { const g = f * Math.pow(1.26, k); tone('triangle', g, g, 0.12, 0.12, k * 0.2 + i * 0.05); }); },
    /** chain: one rising note per popped ball (semitones), start pitch climbs with the combo; then falling plinks for drops */
    chain: a => { const pops = Math.min(14, a[0] || 0), combo = Math.max(1, a[1] || 1), drops = Math.min(8, a[2] || 0), base = Math.min(10, (combo - 1) * 2);
      for (let i = 0; i < pops; i++) { const f = 440 * Math.pow(2, Math.min(24, base + i) / 12); tone('sine', f, f * 1.5, 0.09, 0.11, i * 0.035); }
      for (let i = 0; i < drops; i++) tone('triangle', 1200 - i * 90, 380, 0.14, 0.06, pops * 0.035 + 0.04 + i * 0.045);
      if (pops + drops >= 8) { hiss(0.35, 0.18, 'highpass', 5000, (pops + drops) * 0.035); [784, 988, 1175, 1568].forEach((f, i) => tone('square', f, f, 0.09, 0.05, (pops + drops) * 0.035 + i * 0.06)); } },
    /** auto-attack launch; x2 / x3 get a fanfare + boom */
    burst: n => { n = n || 1; hiss(0.35, 0.25, 'bandpass', 1200, 0, 1.2); tone('sawtooth', 220, 880, 0.3, 0.08);
      if (n >= 2) { [523, 784, 1047, 1319, 1568].slice(0, n + 2).forEach((f, i) => tone('square', f, f * 1.01, 0.14, 0.08, 0.08 + i * 0.07)); tone('sine', 120, 40, 0.5, 0.35, 0.05); hiss(0.5, 0.3, 'lowpass', 700, 0.05); }
      if (n >= 3) [1047, 1319, 1568, 2093].forEach((f, i) => tone('triangle', f, f, 0.22, 0.1, 0.5 + i * 0.08)); },
    skill: () => { hiss(0.35, 0.25, 'bandpass', 1200, 0, 1.2); tone('sawtooth', 220, 880, 0.3, 0.08); },
    hit: n => { for (let k = 0; k < (n || 1); k++) { hiss(0.2, 0.35, 'lowpass', 900, k * 0.12); tone('square', 240 - k * 40, 70, 0.2, 0.14, k * 0.12); } },
    block: () => [1200, 1500].forEach((f, i) => tone('sine', f, f, 0.1, 0.08, i * 0.07)),
    out: () => [523, 440, 349, 262].forEach((f, i) => tone('triangle', f, f * 0.98, 0.16, 0.12, i * 0.13)),
    win: () => [523, 659, 784, 1047, 1319].forEach((f, i) => tone('triangle', f, f, 0.16, 0.13, i * 0.1)),
    tick: () => tone('sine', 1000, 1000, 0.05, 0.08),
    go: () => tone('square', 660, 1320, 0.18, 0.09),
    chat: () => tone('sine', 1320, 1760, 0.07, 0.06),
    swap: () => tone('triangle', 600, 900, 0.06, 0.07),
    click: () => tone('square', 900, 900, 0.03, 0.04),
    fuse: () => { hiss(0.3, 0.3, 'bandpass', 2400, 0, 2); tone('sawtooth', 200, 90, 0.3, 0.1); },
  };
  return {
    get muted() { return muted; },
    toggle() { muted = !muted; local.set('gelembung.mute', muted ? '1' : '0'); if (!muted) { init(); if (ctx && ctx.state === 'suspended') ctx.resume(); } return muted; },
    unlock() { if (muted) return; init(); if (ctx && ctx.state === 'suspended') ctx.resume(); },
    play(k, n) { if (muted || !S[k]) return; init(); if (!ctx || ctx.state !== 'running') return; const now = performance.now(); if (now - (last[k] || 0) < (GAP[k] || 30)) return; last[k] = now; try { S[k](n); } catch (e) { /* ignore */ } },
  };
})();
['pointerdown', 'keydown'].forEach(ev => window.addEventListener(ev, () => SFX.unlock(), { passive: true }));
/* ---------------- local stats (this device only) ---------------- */
const STATS_KEY = 'gelembung.stats';
function stats() { try { const s = JSON.parse(local.get(STATS_KEY) || '{}'); return { games: s.games | 0, wins: s.wins | 0, best: s.best | 0, online: s.online | 0, onlineWins: s.onlineWins | 0 }; } catch (e) { return { games: 0, wins: 0, best: 0, online: 0, onlineWins: 0 }; } }
function record(won, score, online) { const s = stats(); s.games++; if (won) s.wins++; s.best = Math.max(s.best, score | 0); if (online) { s.online++; if (won) s.onlineWins++; } local.set(STATS_KEY, JSON.stringify(s)); renderStats(); }
function renderStats() { const s = stats(); $('stats').innerHTML = '<h4>' + esc(t('statsTitle')) + '</h4>' + (s.games ? '<ul><li><b>' + s.games + '</b>' + esc(t('statsGames')) + '</li><li><b>' + s.wins + '</b>' + esc(t('statsWins')) + '</li><li><b>' + s.best.toLocaleString('id-ID') + '</b>' + esc(t('statsBest')) + '</li></ul>' : '<p class="muted small">' + esc(t('statsNone')) + '</p>'); }
/* ---------------- sprites as images (for DOM lists) ---------------- */
const imgCache = new Map();
function ballImg(k, c, size) { const key = k + c + '@' + size; if (!imgCache.has(key)) { const cv = R.sprite(k, c, size * 2); imgCache.set(key, cv.toDataURL()); } return '<img class="ball-img" src="' + imgCache.get(key) + '" width="' + size + '" height="' + size + '" alt="">'; }
const face = (k, size) => '<span class="pf" style="--c:' + esc(ch(k).color) + ';--s:' + (size || 40) + 'px" aria-hidden="true">' + esc(ch(k).icon) + '</span>';
/* ---------------- static content ---------------- */
let pickedChar = D.CHARS.includes(local.get('gelembung.char')) ? local.get('gelembung.char') : 'batu';
function charPicker(el, chosen, taken, takenName) {
  el.innerHTML = D.CHARS.map(k => { const c = ch(k), tk = taken && taken.has(k); return '<button type="button" role="radio" class="cp' + (k === chosen ? ' on' : '') + '" data-ch="' + k + '" aria-checked="' + (k === chosen) + '"' + (tk ? ' disabled' : '') + ' style="--c:' + esc(c.color) + '">' + face(k, 34) + '<b>' + esc(c.name) + '</b><small>' + esc(tk ? t('takenBy', { name: takenName(k) }) : '⚡ ' + c.skill) + '</small></button>'; }).join('');
  const info = el.id === 'practiceChars' && $('charInfo'); if (info) { const c = ch(chosen); info.innerHTML = face(chosen, 30) + '<span><b>⚡ ' + esc(c.skill) + '</b> <em class="auto-tag">' + esc(t('autoTag')) + '</em><br>' + esc(c.skillText) + '<br><b>⚡⚡⚡</b> ' + esc(c.stack || '') + '</span>'; }
}
function applyText() {
  document.querySelectorAll('[data-t]').forEach(el => { el.textContent = t(el.dataset.t); });
  document.querySelectorAll('[data-t-ph]').forEach(el => { el.placeholder = t(el.dataset.tPh); });
  document.querySelectorAll('[data-t-aria]').forEach(el => { el.setAttribute('aria-label', t(el.dataset.tAria)); });
  document.querySelectorAll('[data-c]').forEach(el => { el.textContent = cfgPath(el.dataset.c) || ''; });
  document.querySelector('.brand-mark').innerHTML = ballImg('n', 0, 26);
  $('steps').innerHTML = (CFG.rules || []).map(r => '<li><h3>' + esc(r.title) + '</h3><p>' + esc(r.text) + '</p></li>').join('');
  $('charList').innerHTML = D.CHARS.map(k => { const c = ch(k); return '<li style="--c:' + esc(c.color) + '">' + face(k, 56) + '<div><h3>' + esc(c.name) + '</h3><p><b>⚡ ' + esc(c.skill) + '</b> <em class="auto-tag">' + esc(t('autoTag')) + '</em> ' + esc(c.skillText) + '</p><p><b>⚡⚡⚡</b> ' + esc(c.stack || '') + '</p><p><b>' + esc(t('perkLabel')) + '</b> ' + esc(c.perk) + '</p></div></li>'; }).join('');
  $('ballList').innerHTML = ['x', 'e', 'g', 'w', 'h', 'r', 'b'].map(k => { const b = CFG.balls[k] || {}; return '<li>' + ballImg(k, 1, 40) + '<div><h4>' + esc(b.name || k) + '</h4><p>' + esc(b.tip || '') + '</p></div></li>'; }).join('');
  $('colorList').innerHTML = COLORS.map((hex, i) => '<li>' + ballImg('n', i, 36) + '<span><b>' + esc(CFG.colors[i].name) + '</b><small>' + esc(SHAPES[i]) + (i === 5 ? ' · ' + esc(t('color6Note')) : '') + '</small></span></li>').join('');
  charPicker($('practiceChars'), pickedChar);
  $('emoBar').innerHTML = EMOJIS.map(e => '<button type="button" class="emo" data-emo="' + esc(e.k) + '" aria-label="' + esc(e.k) + '">' + esc(e.icon) + '</button>').join('');
  $('chatQuick').innerHTML = CHAT.map(c => '<button type="button" class="chip" data-say="' + esc(c.text) + '">' + esc(c.text) + '</button>').join('') + EMOJIS.map(e => '<button type="button" class="chip emo-chip" data-emo="' + esc(e.k) + '" aria-label="' + esc(e.k) + '">' + esc(e.icon) + '</button>').join('');
  if (CFG.site && CFG.site.themeColor) { const tc = document.querySelector('meta[name=theme-color]'); if (tc) tc.setAttribute('content', CFG.site.themeColor); }
  $('muteBtn').textContent = SFX.muted ? '🔇' : '🔊'; $('muteBtn').setAttribute('aria-label', t(SFX.muted ? 'unmute' : 'mute'));
  renderStats();
}
$('practiceChars').addEventListener('click', e => { const b = e.target.closest('[data-ch]'); if (!b) return; pickedChar = b.dataset.ch; local.set('gelembung.char', pickedChar); charPicker($('practiceChars'), pickedChar); SFX.play('click'); });
/** hero illustration: a real board mid-game, drawn once (no animation loop on the home page) */
function heroArt() {
  const cv = $('heroArt'); if (!cv || $('home').hidden) return;
  const box = cv.parentElement, w = Math.min(box.clientWidth || 300, 360), v = new R.BoardView(cv); v.resize(w, w * D.H / D.W);
  const b = D.create(20261023, { rows: 7, ch: 'kabut' }); b.g[2][3] = D.ball('x'); b.g[3][5] = D.ball('e', 2); b.g[1][6] = D.ball('g', 4); b.g[4][2] = D.ball('w', 1, { tm: 7000 }); b.g[0][1] = D.ball('h', 3);
  v.text(D.W / 2, 8.6, t('heroCombo'), { size: 0.8, color: '#F0E442', life: 1e9, big: 1, born: 0 });
  v.last = 1; v.draw(b, { now: 2, aim: 1.25, aimLen: 9, showNext: 2, color: ch('kabut').color, swapLabel: t('swapShort') });
}
/* ================= match engine (shared by practice, tutorial, demo and online) ================= */
const SEEN_KEY = 'gelembung.seen', TUT_KEY = 'gelembung.tut';
const seenTips = new Set(String(local.get(SEEN_KEY) || '').split(',').filter(Boolean));
let mode = null;
const AIM_SHORT = 7.5, AIM_LONG = 40, FLY_MS = 600, HIT_GAP = 110;
/** full-screen fx canvas: projectiles between boards, impact sparks, screen confetti */
const FX = new R.FxLayer($('fxLayer')); FX.reduced = reduced.matches; R.comboLabel = t('combo');
function flash(color) { if (reduced.matches) return; const el = $('flash'); el.style.setProperty('--fc', color || '#fff'); el.classList.remove('on'); void el.offsetWidth; el.classList.add('on'); }
function buzz(p) { if (navigator.vibrate && !reduced.matches) try { navigator.vibrate(p); } catch (e) { /* ignore */ } }
function replay(el, cls) { if (!el) return; el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); }
/** one seat in a match: p.board is a sim board (mine / bots) or a view rebuilt from snapshots (online opponents) */
function seat(o) { return Object.assign({ id: 0, name: '', ch: 'batu', board: null, view: null, cv: null, el: null, out: false, sc: 0, m: 0, imUntil: 0, bubble: null, me: false, bot: false, seat: 0, inbound: 0 }, o); }
class Match {
  constructor() { this.seats = []; this.meId = null; this.aim = null; this.dragging = false; this.lastFrame = 0; this.spect = null; this.chatN = 0; this.ended = false; this.t0 = performance.now(); this.firstWarned = new Set(); }
  get mine() { return this.seats.find(s => s.me) || null; }
  get myBoard() { const m = this.mine; return m && m.board && !m.view ? m.board : null; }
  opps() { return this.seats.filter(s => !s.me); }
  alive() { return this.seats.filter(s => !s.out); }
  seatOf(id) { return this.seats.find(s => s.id === id) || null; }
  /** board shown big: mine, or the spectated player once I am out */
  focus() { const m = this.mine; if (m && !(m.out && this.spectating())) return m; const s = this.seatOf(this.spect); if (s && !s.out) return s; const a = this.opps().filter(x => !x.out).sort((x, y) => y.sc - x.sc)[0]; if (a) this.spect = a.id; return a || m; }
  spectating() { const m = this.mine; return !m || (m.out && this.outAt && performance.now() - this.outAt > 1800); }
  /* ----- DOM ----- */
  build() {
    const opps = $('opps'); opps.innerHTML = '';
    for (const s of this.opps()) {
      const el = document.createElement('div'); el.className = 'opp'; el.setAttribute('aria-label', s.name); el.dataset.id = s.id; el.style.setProperty('--c', SEAT[s.seat % 4]);
      el.innerHTML = '<span class="opp-head">' + face(s.ch, 18) + '<b class="nm"></b><span class="sc">0</span></span><span class="opp-cv"><canvas></canvas><span class="bub" hidden></span><span class="shield" hidden>🛡️</span><span class="opips" aria-hidden="true"><i></i><i></i><i></i></span><span class="conn" hidden></span></span><i class="mbar"><s></s></i>';
      el.querySelector('.nm').textContent = s.name; s.el = el; s.cv = el.querySelector('canvas'); s.rv = new R.BoardView(s.cv, { mini: true }); s.rv.reduced = reduced.matches; opps.appendChild(el);
    }
    this.mainView = new R.BoardView($('board')); this.mainView.reduced = reduced.matches; this.mainFor = null;
    const m = this.mine; if (m) { m.rv = this.mainView; const c = ch(m.ch); $('face').textContent = c.icon; $('portrait').style.setProperty('--c', c.color); $('skillName').textContent = c.skill; $('skillText').textContent = c.skillText; }
    $('portrait').hidden = !m; $('meKamu').textContent = t('youTag'); this.tagFor = undefined; this.layout();
  }
  layout() {
    const arena = $('arena'), W = arena.clientWidth, H = arena.clientHeight, n = this.opps().length, wide = W >= 900 && W > H * 1.15;
    arena.classList.toggle('wide', wide); arena.dataset.n = n;
    if (!n) { $('opps').hidden = true; } else $('opps').hidden = false;
    // desktop: own board is the single big centred board; small dimmed previews in a slim column beside it
    const tag = $('meTag'), bottom = document.querySelector('.g-bottom'), por = $('portrait'), sk = document.querySelector('.g-skill');
    if (wide && por.parentElement !== tag) { tag.appendChild(por); tag.appendChild(sk); }
    else if (!wide && por.parentElement !== bottom) { bottom.insertBefore(sk, bottom.firstChild); bottom.insertBefore(por, sk); }
    if (wide) {
      const side = Math.round(Math.max(140, Math.min(240, W * 0.18))), avail = H - 12;
      const mineW = Math.min(avail * D.W / D.H, W - 2 * side - 70);
      arena.style.setProperty('--side', side + 'px'); $('opps').style.height = '';
      this.mainView.resize(mineW, avail);
      const cardH = n ? Math.min(230, (avail - (n - 1) * 10) / n) : 0, cw = Math.max(56, Math.min(120, this.mainView.cs * D.W * 0.26, (cardH - 34) * D.W / D.H));
      for (const s of this.opps()) { s.rv.resize(cw, cardH - 34); s.el.style.flex = ''; s.el.style.width = (parseFloat(s.cv.style.width) + 10) + 'px'; }
    } else {
      arena.style.removeProperty('--side'); for (const s of this.opps()) s.el.style.width = '';
      const oh = n ? Math.max(84, Math.min(150, Math.round(H * 0.2))) : 0, cw = n ? (W - 8 - (n - 1) * 6) / n : 0;
      $('opps').style.height = oh + 'px';
      for (const s of this.opps()) { s.rv.resize(Math.min(cw - 6, 150), oh - 26); if (W >= 600) { s.el.style.width = (parseFloat(s.cv.style.width) + 10) + 'px'; s.el.style.flex = 'none'; } else s.el.style.flex = ''; }
      this.mainView.resize(W - 8, H - oh - 10);
    }
    this.cs = this.mainView.cs;
  }
  /* ----- input: drag to aim, release to fire; tap the spare ball to swap ----- */
  pointer(kind, e) {
    const b = this.myBoard, f = this.focus(); if (!b || f !== this.mine || b.out || !this.live()) return;
    const [x, y] = this.mainView.toBoard(e.clientX, e.clientY);
    if (kind === 'down') { if (x < 2.1 && y > D.CY - 0.7) { this.swap(); this.swapTap = true; return; } this.swapTap = false; this.dragging = true; this.setAim(x, y); }
    else if (kind === 'move') { if (this.dragging) this.setAim(x, y); }
    else if (kind === 'up') { if (this.dragging) { this.dragging = false; this.setAim(x, y); this.fire(); } }
    else if (kind === 'cancel') { this.dragging = false; this.aim = null; }
  }
  setAim(x, y) { const dy = D.CY - y, dx = x - D.W / 2; this.aim = D.clampAng(dy < 0.25 ? (dx < 0 ? Math.PI : 0) : Math.atan2(dy, dx)); }
  fire() {
    const b = this.myBoard; if (!b || b.out || b.fly || this.aim == null || !this.live()) return;
    D.fire(b, this.aim); b.lastAng = this.aim; this.changed(); if (this.onShot) this.onShot();
  }
  swap() { const b = this.myBoard; if (!b || !this.live()) return; if (D.swap(b)) { SFX.play('swap'); this.changed(); } else { toast(t('swapWait', { n: b.swapCd })); } }
  key(e) {
    const b = this.myBoard; if (!b || !this.live()) return false;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { const a = this.aim ?? b.lastAng ?? Math.PI / 2; this.aim = D.clampAng(a + (e.key === 'ArrowLeft' ? 0.05 : -0.05)); return true; }
    if (e.key === ' ' || e.key === 'Enter' || e.key === 'ArrowUp') { if (this.aim == null) this.aim = b.lastAng || Math.PI / 2; this.fire(); return true; }
    if (e.key === 's' || e.key === 'S' || e.key === 'ArrowDown') { this.swap(); return true; }
    return false;
  }
  live() { return !this.ended; }
  changed(urgent) { if (this.onChange) this.onChange(urgent); }
  /* ----- passive attacks: a full meter fires by itself at the leader(s); 2–3 charges = DOUBLE / TRIPLE at once ----- */
  autoFire(s, now, silent) {
    const b = s.board; if (!b || b.out || !b.q || s.out || !this.live()) return false;
    const plan = D.spread(b.q, this.seats.filter(x => x !== s).map(x => ({ id: x.id, sc: x.sc, out: x.out, free: x.imUntil <= now && x.inbound <= now })));
    if (!plan.length) return false; // every opponent is immune → the charges wait (pips glow)
    const n = D.takeCharges(b); plan.forEach(([id], i) => { const tg = this.seatOf(id); if (tg) tg.inbound = now + FLY_MS + i * HIT_GAP + 300; });
    if (!silent) this.burstFx(s, plan, n);
    this.launch(s, plan, n, now, silent); this.changed(true); return true;
  }
  launch() {}
  /** caster side: banner, flash, sound, one projectile stream per target */
  burstFx(s, plan, n) {
    const c = ch(s.ch), col = c.color === '#9aa5b8' ? '#e6e9f2' : c.color;
    if (s.rv) { if (n >= 2) s.rv.bigBanner(t(n >= 3 ? 'burst3' : 'burst2'), n); else s.rv.text(D.W / 2, D.CY - 2.4, c.icon + ' ⚡', { size: 1, life: 900, big: 1, pop: 1 }); }
    if (s.me) { SFX.play('burst', n); replay($('portrait'), 'fired'); if (n >= 2) { flash(n >= 3 ? '#F0E442' : '#56B4E9'); FX.confetti(n >= 3 ? 70 : 30); buzz(n >= 3 ? [40, 30, 40, 30, 80] : [40, 30, 60]); } }
    else replay(s.el, 'fire');
    const t0 = performance.now(); plan.forEach(([id, k], i) => this.shootFx(s, this.seatOf(id), k, i * HIT_GAP, col, c.icon, t0));
  }
  shootFx(from, to, n, delay, color, icon, t0) { const a = this.ptOf(from, true), z = this.ptOf(to); if (!a || !z) return; FX.shoot(a, z, { n, icon, color, now: t0 || performance.now(), delay, dur: FLY_MS }); }
  /** screen point of a seat: my cannon / board, or the opponent's mini board */
  ptOf(s, src) {
    if (!s) return null;
    if (s.me && this.focus() === s) { const r = $('board').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height * (src ? Math.min(0.92, D.CY / D.H) : 0.35) }; }
    const el = s.el ? s.el.querySelector('canvas') : $('portrait'); if (!el) return null; const r = el.getBoundingClientRect(); if (!r.width) return null; return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }
  /** a stacked hit (n charges) landed on seat `tg` (res from D.applySkill); everyone sees the same animation */
  skillFx(from, tg, sk, res, n) {
    n = n || (res && res.n) || 1; const view = tg.rv, c = ch(sk), col = c.color === '#9aa5b8' ? '#e6e9f2' : c.color; if (!view) return;
    if (res && res.blocked) { view.setBanner(t('immune'), '#56B4E9', '🛡️'); if (tg.me) SFX.play('block'); return; }
    view.setBanner((n > 1 ? '×' + n + ' ' : '') + c.skill, col, c.icon); view.hitFx(n, col);
    if (tg.el) { tg.el.style.setProperty('--hc', col); replay(tg.el, 'hit'); }
    if (tg.me) { SFX.play('hit', n); if (n >= 2) flash(col); if (from) toast(t('hitBy', { name: from.name, skill: (n > 1 ? '×' + n + ' ' : '') + c.skill })); buzz(n > 1 ? [60, 40, 60, 40, 90].slice(0, 2 * n - 1) : 60); }
  }
  /* ----- fx → sound + particles + first-seen tips ----- */
  consume(s) {
    const b = s.board; if (!b || !b.fx.length) return; const fx = b.fx; b.fx = [];
    if (s.rv) s.rv.feed(fx, b);
    if (!s.me) return;
    let pops = 0, chained = false;
    for (const e of fx) {
      if (e.k === 'pop') pops++;
      else if (e.k === 'shoot') SFX.play('shoot'); else if (e.k === 'bounce') SFX.play('bounce'); else if (e.k === 'land') SFX.play('land');
      else if (e.k === 'drop') SFX.play('drop'); else if (e.k === 'boom') SFX.play('boom'); else if (e.k === 'crack') SFX.play('crack');
      else if (e.k === 'unlock' || e.k === 'reveal') SFX.play('unlock'); else if (e.k === 'row') SFX.play('row'); else if (e.k === 'warn') SFX.play('warn');
      else if (e.k === 'fuse') SFX.play('fuse'); else if (e.k === 'full') { SFX.play('full', e.n); }
      else if (e.k === 'first') this.firstTip(e.t);
      else if (e.k === 'color6') toast(t('color6', { name: (CFG.colors[5] || {}).name || '' }));
      else if (e.k === 'score' && e.pops) { chained = true; SFX.play('chain', [e.pops, e.combo, e.drops]); if (e.huge) FX.confetti(45); }
    }
    if (pops && !chained) SFX.play('pop', 0);
    if (fx.some(e => ['land', 'row', 'fuse', 'hit', 'score'].includes(e.k))) this.changed(fx.some(e => e.k === 'hit' || e.k === 'row'));
  }
  firstTip(k) {
    if (seenTips.has(k) || this.tutorial && k !== 'x') return; const b = CFG.balls[k]; if (!b) return;
    seenTips.add(k); local.set(SEEN_KEY, [...seenTips].join(','));
    const el = $('firstTip'); el.innerHTML = ballImg(k, 1, 22) + '<span>' + esc(b.tip) + '</span>'; el.hidden = false; clearTimeout(this.tipTimer); this.tipTimer = setTimeout(() => { el.hidden = true; }, 4200);
  }
  /* ----- per-frame ----- */
  frame(now) {
    const dt = this.lastFrame ? now - this.lastFrame : 16; this.lastFrame = now;
    this.update(Math.min(dt, 60000), now);
    for (const s of this.seats) this.consume(s);
    this.draw(now); this.hud(now); FX.draw(now, dt);
  }
  update() {}
  draw(now) {
    const f = this.focus(), mv = this.mainView;
    if (f && this.mainFor !== f.id) { this.mainFor = f.id; if (!f.me) { f.rvMini = f.rvMini || f.rv; } }
    if (f) { const b = f.board, me = f.me && !f.view, isOut = f.out;
      mv.draw(b, { now, aim: me && !isOut && this.live() && (this.aim != null) ? this.aim : null, aimLen: f.ch === 'es' ? AIM_LONG : AIM_SHORT, showNext: f.ch === 'kabut' ? 2 : 1, fog: b && b.fog > b.t, fogR: b && b.fogR, wob: b && b.wob > b.t, color: ch(f.ch).color, warn: b && !b.paused && !isOut && b.cd <= 2000 && this.live(), swapLabel: me ? (D.canSwap(b) ? t('swapShort') : '') : '', outLabel: t('outShort') }); }
    for (const s of this.opps()) { if (!s.rv || !s.cv) continue; const b = s.board; s.rv.draw(b, { now, fog: b && b.fog > b.t, fogR: b && b.fogR, color: ch(s.ch).color, warn: b && !s.out && b.cd <= 2000 && this.live() && !s.view, outLabel: t('outShort'), dim: f === s }); }
  }
  hud(now) {
    const m = this.mine, b = this.myBoard, f = this.focus();
    const other = f && f !== m ? f : null; if (this.tagFor !== other) { this.tagFor = other;
      const wt = $('watchTag'); wt.hidden = !other; if (other) wt.textContent = t('watchLabel', { name: other.name });
      $('meTag').classList.toggle('watch', !!other); $('meKamu').textContent = other ? t('watchTag') : t('youTag'); $('meName').textContent = other ? ch(other.ch).icon + ' ' + other.name : (m && m.name.toLowerCase() !== t('you').toLowerCase() ? m.name : ''); }
    const ceilEl = $('ceil'); if (ceilEl.hidden === !!b) ceilEl.hidden = !b;
    if (!b && this.kind === 'online') { const d = this.room.data; $('gSub').textContent = d ? (this.spectator() ? t('watchingHint') : t('lobbyCount', { n: N.seated(d.players).length, max: d.maxPlayers })) : ''; }
    for (const s of this.opps()) { if (!s.el) continue; const sc = s.el.querySelector('.sc'), txt = s.sc.toLocaleString('id-ID'); if (sc.textContent !== txt) sc.textContent = txt; s.el.querySelector('.mbar s').style.transform = 'scaleX(' + Math.min(1, s.m / D.METER) + ')'; s.el.classList.toggle('out', s.out); s.el.classList.toggle('watching', f === s && (!m || m.out)); s.el.classList.toggle('pick', !m || !!m.out);
      const oq = s.board ? s.board.q | 0 : 0; if (s.oq !== oq) { s.oq = oq; s.el.querySelectorAll('.opips i').forEach((e, i) => e.classList.toggle('on', i < oq)); }
      const pr = s.out ? 'ok' : this.connOf(s); if (s.pr !== pr) { s.pr = pr; const c = s.el.querySelector('.conn'); c.hidden = pr === 'ok'; c.textContent = pr === 'away' ? t('connAway') : t('connLost'); s.el.classList.toggle('lost', pr === 'lost' || pr === 'gone'); }
      s.el.querySelector('.shield').hidden = !(s.imUntil > now) || s.out; const bub = s.el.querySelector('.bub'); if (s.bubble && now > s.bubble.until) { s.bubble = null; bub.hidden = true; } }
    if (b) {
      const q = b.q | 0; $('ring').style.setProperty('--m', q >= D.MAX_CHARGES ? 1 : Math.min(1, b.m / D.METER)); $('portrait').classList.toggle('wait', q > 0 && !b.out && this.live());
      if (this.pipQ !== q) { this.pipQ = q; $('pips').querySelectorAll('i').forEach((el, i) => el.classList.toggle('on', i < q)); $('portrait').title = q ? t('chargeWait') : ''; }
      const secs = Math.max(0, Math.ceil(b.cd / 1000)); $('ceilN').textContent = b.paused ? '—' : secs; $('ceil').classList.toggle('warn', !b.paused && b.cd <= 2000 && !b.out);
      $('ceilBar').style.transform = 'scaleX(' + (b.paused ? 1 : Math.max(0, Math.min(1, b.cd / (D.interval(b.t) + (b.ch === 'angin' ? 1000 : 0))))) + ')';
      $('gSub').textContent = mmss(b.t) + ' · ' + b.sc.toLocaleString('id-ID') + ' ' + t('pts') + (m.out ? ' · ' + t('outShort') : '') + (m.out && f && f !== m ? ' · ' + t('watchingName', { name: f.name }) : '');
    }
  }
  /* ----- talk ----- */
  showTalk(s, x, text) {
    if (!s) return; const isEmo = x === 'emo', icon = isEmo ? ((EMOJIS.find(e => e.k === text) || {}).icon || '') : '';
    if (isEmo && !icon) return; const shown = isEmo ? icon : text;
    this.log(s, shown, isEmo);
    if (s.el) { const bub = s.el.querySelector('.bub'); bub.textContent = shown; bub.classList.toggle('big', isEmo); bub.hidden = false; s.bubble = { until: performance.now() + (isEmo ? 2600 : 4200) }; }
    else if (s.me && s.rv) s.rv.text(D.W / 2, D.CY - 2.2, shown, { size: isEmo ? 1.3 : 0.5, life: 1800, big: 1 });
    if (!s.me) SFX.play('chat');
  }
  log(s, text, isEmo) {
    const li = document.createElement('li'); li.innerHTML = '<b style="color:' + SEAT[s.seat % 4] + '"></b> <span></span>'; li.firstChild.textContent = s.name + ':'; li.lastChild.textContent = text; if (isEmo) li.classList.add('emo-line');
    const log = $('chatLog'); log.appendChild(li); while (log.children.length > 60) log.firstChild.remove(); log.scrollTop = log.scrollHeight;
    if ($('chat').hidden && !s.me) { this.chatN++; $('chatBadge').textContent = this.chatN; $('chatBadge').hidden = false; }
  }
  meSeat() { return this.mine || { id: 0, name: myName(), seat: 0, me: true }; }
  say(text) { const m = this.meSeat(); this.talk('say', text).then(ok => { if (ok !== false) this.showTalk(m, 'say', N.cleanText(text)); }).catch(e => toast(errMsg(e))); }
  emo(k) { const m = this.meSeat(); this.talk('emo', k).then(ok => { if (ok !== false) this.showTalk(m, 'emo', k); }).catch(e => toast(errMsg(e))); }
  talk() { return Promise.resolve(true); }
  overlay() { return ''; }
  overlayAct() {}
  tick() {}
  stop() { FX.shots = []; FX.parts = []; FX.draw(0, 16); }
  /** connection badge of an opponent: 'ok' | 'away' | 'lost' | 'gone' (online only) */
  connOf() { return 'ok'; }
}
/* ================= practice vs bots (+ guided tutorial, + #demo) ================= */
const BOT_GAP = [2300, 1700, 1250];
function myName() { return ($('nameInput').value || local.get('gelembung.name') || '').replace(/\s+/g, ' ').trim().slice(0, 24) || t('you'); }
function stepBoard(b, dt) { let left = dt; while (left > 0 && !b.out) { const d = Math.min(50, left); D.step(b, d); left -= d; } }
const TUT = [
  { key: 'tut1', rows: ['bbccddee', 'bccddeb', '...aa...'], need: r => r.pops >= 3 },
  { key: 'tut2', rows: ['bbccddee', 'bccddeb', 'aa......'], need: r => r.pops >= 3 && r.bounces > 0, retry: 'tut2b' },
  { key: 'tut3', rows: ['...aa...', '...e...', '...cc...'], need: r => r.drops > 0 },
  { key: 'tut4', rows: ['bbccddee', 'bccddeb', '...aa...'], meter: D.METER - 3, need: r => r.burst >= 1 },
  { key: 'tut4b', rows: ['...bb...', 'cc.a.cc', 'aaaaaaaa', 'aaaaaaa'], meter: 0, need: r => r.burst >= 3, retry: 'tut4c', retryAny: true },
  { key: 'tut5', free: true },
];
class PracticeMatch extends Match {
  constructor(o) {
    super(); o = o || {}; this.kind = 'practice'; this.opts = o; this.level = o.demo ? 1 : Math.max(0, Math.min(2, o.level | 0)); this.tutorial = !!o.tutorial; this.demo = !!o.demo;
    const seed = o.demo ? 20261023 : 1 + Math.floor(Math.random() * 2147483000), rng = D.rng(seed ^ 0x5bd1e995), char = o.char || 'batu';
    const pool = D.CHARS.filter(k => k !== char); for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
    const bots = this.tutorial ? 1 : Math.max(1, Math.min(3, o.bots | 0 || 2));
    this.seats.push(seat({ id: 1, name: o.demo ? t('demoMe') : myName(), ch: char, me: true, seat: 0, board: D.create(seed, { ch: char }), bot: this.demo, rng: D.rng(seed + 99), next: 900 }));
    for (let i = 0; i < bots; i++) { const k = pool[i]; this.seats.push(seat({ id: 2 + i, name: ch(k).name, ch: k, bot: true, seat: i + 1, board: D.create(seed, { ch: k }), rng: D.rng(seed + i * 7 + 1), next: 1200 + i * 450 })); }
    this.rng = rng; this.order = []; this.pend = []; this.startAt = performance.now() + (this.demo || this.tutorial ? 0 : 3200); this.lastCount = 4;
    if (this.demo) this.presim(16000);
    if (this.tutorial) this.tutGo(0);
  }
  presim(ms) { for (let tt = 0; tt < ms; tt += 50) this.update(50, this.startAt + tt, true); for (const s of this.seats) { s.board.fx = []; s.board.fog = 0; s.board.wob = 0; } this.lastFrame = 0; }
  live() { return !this.ended && performance.now() >= this.startAt; }
  update(dt, now, silent) {
    if (now < this.startAt) { const n = Math.ceil((this.startAt - now) / 1000); if (n !== this.lastCount && !silent) { this.lastCount = n; SFX.play('tick'); } return; }
    if (this.lastCount && !silent && !this.demo && !this.tutorial) { this.lastCount = 0; SFX.play('go'); }
    const tutRes = this.tutorial ? { pops: 0, drops: 0, bounces: 0, landed: false, burst: 0 } : null;
    if (this.pend.length) this.pend = this.pend.filter(p => { if (now < p.at) return true; this.hit(p, now, silent); return false; });
    for (const s of this.seats) {
      const b = s.board; if (s.out) continue;
      stepBoard(b, dt);
      if (tutRes && s.me) for (const e of b.fx) { if (e.k === 'landed') { tutRes.landed = true; tutRes.bounces = e.bounces; } if (e.k === 'score') { tutRes.pops += e.pops; tutRes.drops += e.drops; } if (e.k === 'full') tutRes.burst = Math.max(tutRes.burst, e.n | 0); }
      if (s.bot && !(b.paused && this.tutorial)) {
        s.next -= dt; if (!b.fly && s.next <= 0) { D.fire(b, D.botAim(b, s.me ? 2 : this.level, s.rng)); s.next = BOT_GAP[s.me ? 2 : this.level] * (0.8 + 0.4 * s.rng()); }
      }
      s.sc = b.sc; s.m = b.m; s.imUntil = now + Math.max(0, b.imm - b.t);
      if (b.out && !s.out) { s.out = true; this.order.push(s.id); if (s.me && !silent) { this.outAt = now; SFX.play('out'); this.outCard = !this.demo; } else if (!silent && this.mine.out === false && s.bot) this.botEmo(s, 'scared', 0.6); }
    }
    // passive attacks: everyone's full meter fires at once (tutorial: mine from the ⚡ step, bots only in free play)
    const st = this.tutorial ? TUT[Math.floor(this.tutStep)] : null;
    for (const s of this.seats) if (!s.out && (!st || (s.me ? this.tutStep >= 3 : st.free))) this.autoFire(s, now, silent);
    if (tutRes && tutRes.landed) this.tutCheck(tutRes);
    if (!this.ended && this.alive().length <= 1 && !this.tutorial) this.finish(silent);
    if (this.tutorial && st && st.free && !this.ended && (this.mine.out || this.seats[1].out)) { this.tutorial = false; this.finish(silent); }
  }
  /** practice: hits are queued to land when the projectile arrives (deterministic, works in the silent pre-sim too) */
  launch(s, plan, n, now) { plan.forEach(([id, k], i) => this.pend.push({ at: now + FLY_MS + i * HIT_GAP, from: s.id, to: id, n: k, sk: s.ch, seed: 1 + Math.floor((s.rng || Math.random)() * 2147483000) })); }
  hit(p, now, silent) {
    const from = this.seatOf(p.from), tg = this.seatOf(p.to); if (!tg || tg.out) return;
    const res = D.applySkill(tg.board, p.sk, p.seed, p.n); tg.imUntil = now + Math.max(0, tg.board.imm - tg.board.t); if (res.ok) this.landed = (this.landed || 0) + p.n;
    if (!silent) { this.skillFx(from, tg, p.sk, res, p.n); if (from && from.bot && !from.me && !res.blocked) this.botEmo(from, 'laugh', 0.35); }
  }
  botEmo(s, k, p) { if (s.rng() < p) this.showTalk(s, 'emo', k); }
  finish(silent) {
    this.ended = true; const left = this.alive().map(s => s.id); this.standings = left.concat(this.order.slice().reverse()).map(id => this.seatOf(id));
    const me = this.mine, won = !me.out; this.won = won;
    if (!silent && !this.demo) { SFX.play(won ? 'win' : 'out'); if (!this.wasTutorial) record(won, me.board.sc, false); }
  }
  /* ----- tutorial ----- */
  tutGo(i) {
    this.tutStep = i; const st = TUT[i], b = this.mine.board, bot = this.seats[1]; this.wasTutorial = true;
    if (st.rows) { D.load(b, st.rows); b.po = 0; b.fly = null; b.cur = D.ball('n', 0); b.paused = true; bot.board.paused = true; }
    if (st.meter != null) { b.m = st.meter; b.q = 0; bot.board.imm = bot.board.t; bot.imUntil = 0; bot.inbound = 0; }
    if (st.free) { b.paused = false; bot.board.paused = false; b.cd = 12000; bot.board.cd = 12000; local.set(TUT_KEY, '1'); this.tutDoneAt = performance.now() + 9000; }
    this.coach(t(st.key));
  }
  tutCheck(r) {
    const st = TUT[this.tutStep]; if (!st || !st.need) return;
    if (st.need(r)) { SFX.play('full'); this.mine.rv.text(D.W / 2, r.burst >= 2 ? D.CY - 3.6 : 6, t('tutGood'), { size: 0.8, color: '#F0E442', life: 1200, big: 1 }); const next = Math.floor(this.tutStep) + 1; this.tutStep += 0.5; $('coach').hidden = true; setTimeout(() => { if (mode === this && this.tutorial) this.tutGo(next); }, r.burst >= 2 ? 1700 : 900); return; }
    const b = this.mine.board; if (st.retry && (r.pops >= 3 || st.retryAny)) this.coach(t(st.retry));
    setTimeout(() => { if (mode !== this || !this.tutorial || TUT[this.tutStep] !== st) return; D.load(b, st.rows); b.po = 0; b.cur = D.ball('n', 0); if (st.meter != null) { b.m = st.meter; b.q = 0; } this.seats[1].board.imm = this.seats[1].board.t; }, 600);
  }
  coach(text) { $('coachText').textContent = text; $('coach').hidden = !text; }
  skipTutorial() { local.set(TUT_KEY, '1'); this.tutorial = false; this.coach(''); for (const s of this.seats) s.board.paused = false; }
  tick() { if (this.tutDoneAt && performance.now() > this.tutDoneAt) { this.tutDoneAt = 0; this.tutorial = false; this.coach(t('tutDone')); setTimeout(() => { if (mode === this) this.coach(''); }, 6000); } }
  overlay() {
    const now = performance.now();
    if (now < this.startAt) { const m = this.mine, c = ch(m.ch); return '<div class="ov-card count"><p>' + esc(t('startingIn')) + '</p><b>' + Math.ceil((this.startAt - now) / 1000) + '</b>' + face(m.ch, 56) + '<p><b>' + esc(c.name) + ' · ' + esc(c.skill) + '</b></p><p class="muted small">' + esc(t('startHint')) + '</p></div>'; }
    if (this.demo) return '';
    if (this.ended) return resultHTML(this.standings, this.mine.id, this.won, '<button type="button" class="btn primary" data-act="again">' + esc(t('playAgain')) + '</button><button type="button" class="btn ghost" data-act="home">' + esc(t('backHome')) + '</button>', id => this.seatOf(id));
    if (this.outCard) return outHTML(this.alive().length + 1, '<button type="button" class="btn primary" data-act="watch">' + esc(t('watchRest')) + '</button><button type="button" class="btn ghost" data-act="again">' + esc(t('playAgain')) + '</button>');
    return '';
  }
  overlayAct(a) { if (a === 'again') startPractice(this.opts.tutorial ? { bots: 2, level: 1, char: this.opts.char } : this.opts, true); else if (a === 'home') showHome(); else if (a === 'watch') this.outCard = false; }
  exit() { if (this.demo || this.ended || this.mine.out || this.tutorial || performance.now() - this.t0 < 4000 || confirm(t('exitConfirmPractice'))) showHome(); }
}
function resultHTML(list, meId, won, actions) {
  const rows = list.map((s, i) => '<li class="' + (s.id === meId ? 'me' : '') + '"><span class="pl">' + (i + 1) + '</span>' + face(s.ch, 26) + '<b></b>' + (s.gone ? '<em class="gone-tag">' + esc(t('goneTag')) + '</em>' : '') + '<span>' + (s.sc | 0).toLocaleString('id-ID') + '</span></li>').join('');
  const html = '<div class="ov-card result"><div class="trophy" aria-hidden="true">' + (won ? '🏆' : '💥') + '</div><h2>' + esc(won ? t('winTitle') : t('loseTitle')) + '</h2><p class="muted">' + esc(t('winnerIs', { name: list[0] ? list[0].name : '—' })) + '</p><ol class="standings">' + rows + '</ol><div class="ov-actions">' + actions + '</div></div>';
  // names are inserted as text afterwards (see renderOverlay)
  return { html, names: list.map(s => s.name) };
}
function outHTML(place, actions) { return '<div class="ov-card small out-card"><h2>' + esc(t('outTitle')) + '</h2><p>' + esc(t('outPlace', { n: place })) + '</p><div class="ov-actions">' + actions + '</div></div>'; }
function renderOverlay() {
  const ov = $('ov'); let o = mode ? mode.overlay() : ''; let names = null;
  if (o && typeof o === 'object') { names = o.names; o = o.html; }
  if (!o) { if (!ov.hidden) { ov.hidden = true; ov._h = ''; ov.innerHTML = ''; } return; }
  ov.hidden = false; const key = o + (names ? names.join('|') : '');
  if (ov._h !== key) { ov._h = key; ov.innerHTML = o; if (names) ov.querySelectorAll('.standings b').forEach((b, i) => { b.textContent = names[i]; }); }
}
/* ================= screens ================= */
let raf = 0;
function loop(now) { if (!mode) { raf = 0; return; } try { mode.frame(now); } catch (e) { console.error(e); } renderOverlay(); raf = requestAnimationFrame(loop); }
function showGame(m) {
  if (mode && mode !== m && mode.stop) mode.stop(); mode = m;
  $('home').hidden = true; $('game').hidden = false; document.body.classList.add('in-game'); document.documentElement.classList.add('jr-hub-off');
  $('chatLog').innerHTML = ''; $('chat').hidden = true; m.chatN = 0; $('chatBadge').hidden = true; $('coach').hidden = true; $('firstTip').hidden = true;
  $('gTitle').textContent = m.title ? m.title() : t(m.demo ? 'demoTitle' : m.tutorial ? 'tutTitle' : 'practiceGameTitle', { n: m.opps().length });
  m.build(); if (m.tutorial && m.tutStep != null) m.coach(t(TUT[m.tutStep].key));
  if (!raf) raf = requestAnimationFrame(loop);
  setTimeout(() => { if (mode === m) m.layout(); }, 50);
}
function showHome() {
  if (mode && mode.stop) mode.stop(); mode = null; $('game').hidden = true; $('home').hidden = false; document.body.classList.remove('in-game'); document.documentElement.classList.remove('jr-hub-off');
  $('ov').hidden = true; $('ov')._h = '';
  if (/^#(practice|latihan|demo)$/i.test(location.hash)) history.replaceState(history.state, '', location.pathname + location.search);
  heroArt(); renderStats(); scheduleRooms();
}
function startPractice(o, keepTut) {
  o = Object.assign({ bots: Number($('botsSelect').value) || 2, level: Number($('levelSelect').value) || 0, char: pickedChar }, o || {});
  if (!o.demo && !o.tutorial && !keepTut && !local.get(TUT_KEY)) o.tutorial = true;
  showGame(new PracticeMatch(o));
}
/* ================= input bindings ================= */
const boardEl = $('board');
boardEl.addEventListener('pointerdown', e => { if (!mode) return; e.preventDefault(); try { boardEl.setPointerCapture(e.pointerId); } catch (x) { /* ignore */ } mode.pointer('down', e); });
boardEl.addEventListener('pointermove', e => { if (mode) mode.pointer('move', e); });
boardEl.addEventListener('pointerup', e => { if (mode) mode.pointer('up', e); });
boardEl.addEventListener('pointercancel', e => { if (mode) mode.pointer('cancel', e); });
boardEl.addEventListener('contextmenu', e => e.preventDefault());
document.addEventListener('keydown', e => {
  if (!mode || $('game').hidden) return; const tag = (e.target && e.target.tagName) || '';
  if (e.key === 'Escape') { if (!$('chat').hidden) { $('chat').hidden = true; return; } }
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (tag === 'BUTTON' && (e.key === 'Enter' || e.key === ' '))) return;
  if (mode.key(e)) e.preventDefault();
});
$('opps').addEventListener('click', e => { const el = e.target.closest('.opp'); if (!el || !mode) return; const id = Number(el.dataset.id); if (mode.mine && mode.mine.out || !mode.mine) { mode.spect = id; mode.outAt = mode.outAt || 1; } });
$('exitBtn').addEventListener('click', () => { if (mode) mode.exit(); });
$('muteBtn').addEventListener('click', () => { const m = SFX.toggle(); $('muteBtn').textContent = m ? '🔇' : '🔊'; $('muteBtn').setAttribute('aria-label', t(m ? 'unmute' : 'mute')); });
$('chatBtn').addEventListener('click', () => { const c = $('chat'); c.hidden = !c.hidden; if (!c.hidden) { if (mode) mode.chatN = 0; $('chatBadge').hidden = true; $('chatLog').scrollTop = 1e9; } });
$('chatClose').addEventListener('click', () => { $('chat').hidden = true; });
$('chatForm').addEventListener('submit', e => { e.preventDefault(); const v = $('chatInput').value; if (!mode || !N.cleanText(v)) return; mode.say(v); $('chatInput').value = ''; });
$('chatQuick').addEventListener('click', e => { const b = e.target.closest('button'); if (!b || !mode) return; if (b.dataset.say) mode.say(b.dataset.say); else if (b.dataset.emo) mode.emo(b.dataset.emo); });
$('emoBar').addEventListener('click', e => { const b = e.target.closest('[data-emo]'); if (b && mode) mode.emo(b.dataset.emo); });
$('ov').addEventListener('click', e => { const b = e.target.closest('[data-act]'); if (!b || !mode || b.disabled) return; SFX.play('click'); mode.overlayAct(b.dataset.act, b); });
$('tutSkip').addEventListener('click', () => { if (mode && mode.skipTutorial) mode.skipTutorial(); else $('coach').hidden = true; });
window.addEventListener('resize', () => { if (mode) mode.layout(); else heroArt(); });
/* ================= online ================= */
const RT = Object.assign({ reconnectMaxSeconds: 15 }, CFG.realtime || {});
const net = new N.Connection({ storage: session, reconnectMaxMs: RT.reconnectMaxSeconds * 1000, onWake: () => { if (mode && mode.kind === 'online') mode.wake(); }, onSocket: () => updateConn(), lobbyWake: () => scheduleRooms() });
function onlineError(e) {
  if (!e) return;
  if (e.status === 403 || e.status === 404) { if (mode && mode.kind === 'online') { toast(t('errMember')); net.forget(); showHome(); } return; }
  if (e.code === 'busy' || e.status === 409 || e.code === 'budget') return;
  if (e.code === 'network') { updateConn(); return; }
  toast(errMsg(e));
}
const inviteUrl = code => location.origin + location.pathname + '?room=' + encodeURIComponent(code);
async function copyInvite(code) {
  const url = inviteUrl(code);
  try { if (navigator.share && matchMedia('(pointer: coarse)').matches) { await navigator.share({ title: (CFG.site && CFG.site.name) || '', text: t('shareText'), url }); return; } } catch (e) { if (e && e.name === 'AbortError') return; }
  try { await navigator.clipboard.writeText(url); toast(t('copied')); } catch (e) { toast(t('copyFail', { code })); }
}
/** local clock ↔ server clock */
const toLocal = (room, serverT) => performance.now() + (serverT - room.now());
class OnlineMatch extends Match {
  constructor() {
    super(); this.kind = 'online'; this.startAt = 0; this.round = null; this.recorded = null;
    this.room = new N.VersusRoom(net, CFG, {
      onChange: () => this.changedRoom(), onNotice: onlineError, onTalk: ev => this.onTalk(ev),
      onSnap: (id, v) => this.onSnap(id, v), onSkill: k => this.onSkill(k), onOut: (id, gone) => this.onOut(id, gone), onRound: st => this.onRound(st),
    });
    this.room.snapper = () => { const b = this.myBoard; return b && { b: D.encode(b), sc: b.sc, m: b.m, q: b.q, im: Math.max(0, b.imm - b.t), out: b.out ? 1 : 0, n: b.shots, cd: Math.max(0, Math.round(b.cd)) }; };
    this.room.scoreOf = id => { const s = this.seatOf(id); return s ? s.sc : 0; };
    this.onChange = u => this.room.dirty(u);
  }
  get me() { return this.room.me; }
  spectator() { return !!(this.room.data && this.room.data.spectator); }
  title() { const d = this.room.data; return d ? t('roomTitle', { code: d.code }) : t('onlineTitle'); }
  phase() { const r = this.room, d = r.data; if (!d) return 'loading'; if (d.status === 'closed') return 'closed'; if (!N.supported(r.s)) return 'lobby'; if (!r.inRound()) return 'lobby'; if (r.s.phase === 'over') return 'over'; if (performance.now() < this.startAt) return 'starting'; return 'playing'; }
  live() { return this.phase() === 'playing'; }
  onRound(st) {
    this.round = st; this.ended = false; this.outAt = 0; this.outCard = false; this.recorded = null; this.spect = null;
    if (!st) { this.seats = []; if (mode === this) this.build(); return; }
    const me = this.me, imIn = st.ids.includes(me) && !this.spectator();
    this.seats = st.ids.map((id, i) => { const k = st.chars[i], mine = imIn && id === me, b = D.create(st.seed, { ch: k }); return seat({ id, name: st.names[i], ch: k, seat: i, me: mine, board: b, view: !mine }); });
    this.startAt = toLocal(this.room, st.at);
    const late = this.room.now() > st.at + 3000;
    if (imIn && late) { const m = this.mine; m.board.out = true; m.out = true; this.outAt = performance.now() - 5000; this.room.eliminate().catch(onlineError); toast(t('resumeOut')); }
    if (mode === this) { this.build(); $('gTitle').textContent = this.title(); }
  }
  changedRoom() {
    const r = this.room, s = r.s;
    if (s.phase === 'over' && r.inRound() && !this.ended) {
      this.ended = true; const res = s.result || {}, order = res.order || r.standings();
      this.final = order.map((id, i) => { const st = this.seatOf(id); return { id, gone: (r.s.outs || []).some(o => o[0] === id && o[2]), name: st ? st.name : r.nameOf(id), ch: st ? st.ch : (r.charOf(id) || 'batu'), sc: (res.scores && res.scores[i] != null) ? res.scores[i] : (st ? st.sc : 0) }; });
      const won = res.win === this.me; if (this.mine && this.recorded !== this.round) { this.recorded = this.round; record(won, this.mine.board.sc, true); }
      SFX.play(won ? 'win' : 'out'); this.won = won;
    }
    if (mode === this) $('gTitle').textContent = this.title();
    updateConn();
  }
  onSnap(id, v) {
    const s = this.seatOf(id); if (!s || s.me) return;
    const old = s.board, nb = D.view(v.b); nb.ch = s.ch;
    nb.t = old.t; nb.fog = old.fog; nb.wob = old.wob; nb.imm = old.imm; nb.seen = old.seen || {};
    // what vanished since the previous snapshot pops on the mini board
    let n = 0; for (let r = 0; r < old.g.length && n < 24; r++) for (let c = 0; c < D.rowLen(old, r); c++) { const a = old.g[r][c]; if (a && !D.present(nb, r + (nb.g.length > old.g.length && nb.po !== old.po ? 1 : 0), c)) { nb.fx.push({ k: 'pop', x: D.cx(old, r, c), y: D.cy(r), c: a.c, t: a.k }); if (++n >= 24) break; } }
    if (v.sc > s.sc + 0 && n >= 6) nb.fx.push({ k: 'score', pops: n, drops: 0, combo: 1, big: 1, x: D.W / 2, y: 5 });
    s.board = nb; s.sc = v.sc; s.m = v.m; nb.q = v.q | 0; s.imUntil = toLocal(this.room, v.imUntil || 0); nb.cd = v.cd;
  }
  /** gb.k fan-out: one event per stacked hit; it lands when its projectile arrives */
  onSkill(k) {
    const from = this.seatOf(k.from), to = this.seatOf(k.to); if (!from || !to || to.out) return;
    const round = this.round, now = performance.now(), i = k.i | 0;
    let at;
    if (k.own && this.launchAt) at = this.launchAt + FLY_MS + i * HIT_GAP; // my projectile is already flying
    else { if (i === 0) this.burstFx(from, [[to.id, k.n]].concat([]), k.x || k.n); else this.shootFx(from, to, k.n, i * HIT_GAP, ch(k.sk).color, ch(k.sk).icon); at = now + FLY_MS + i * HIT_GAP; }
    if (!to.me) to.imUntil = Math.max(to.imUntil, at + D.IMMUNE); to.inbound = Math.max(to.inbound, at + 300);
    setTimeout(() => { if (mode === this && this.round === round) this.landSkill(k, from, to); }, Math.max(0, at - now));
  }
  landSkill(k, from, to) {
    if (to.out) return;
    if (to.me) { if (!to.board || to.board.out) return; const res = D.applySkill(to.board, k.sk, k.seed, k.n); this.room.dirty(true); this.skillFx(from, to, k.sk, res, k.n); return; }
    const res = D.applySkill(to.board, k.sk, k.seed, k.n); to.board.fx = to.board.fx.filter(e => e.k !== 'first'); this.skillFx(from, to, k.sk, res, k.n);
    if (!res.blocked) to.imUntil = performance.now() + D.IMMUNE;
  }
  onOut(id, gone) {
    const s = this.seatOf(id); if (!s || s.out && s.me) return; s.out = true; if (s.board) s.board.out = true;
    if (s.me) { if (!this.outAt) { this.outAt = performance.now(); this.outCard = this.room.alive().length > 1; SFX.play('out'); } }
    else { toast(t(gone ? 'playerGone' : 'playerOut', { name: s.name })); if (s.rv) s.rv.kick(0.6); }
    if (this.spect === id) this.spect = null;
  }
  onTalk(ev) {
    if (ev.playerId === this.me) return; const fresh = Date.now() - (Date.parse(ev.createdAt) || Date.now()) < 20000; if (!fresh) return;
    const P = ev.payload || {}; let s = this.seatOf(ev.playerId);
    if (!s) { const idx = this.room.players().findIndex(p => p.id === ev.playerId); s = { id: ev.playerId, name: this.room.nameOf(ev.playerId), seat: Math.max(0, idx), me: false }; }
    if (P.x === 'say') { const m = N.cleanText(P.m); if (m) this.showTalk(s, 'say', m); } else if (P.x === 'emo') this.showTalk(s, 'emo', String(P.k || ''));
  }
  update(dt, now) {
    if (!this.round || now < this.startAt) { if (this.round && now < this.startAt) { const n = Math.ceil((this.startAt - now) / 1000); if (n !== this.lastCount) { this.lastCount = n; SFX.play('tick'); } } return; }
    if (this.lastCount) { this.lastCount = 0; SFX.play('go'); }
    const playing = this.room.s.phase === 'playing';
    for (const s of this.seats) {
      const b = s.board; if (!b) continue;
      if (s.me) {
        if (playing && !b.out) stepBoard(b, dt);
        s.sc = b.sc; s.m = b.m; s.imUntil = now + Math.max(0, b.imm - b.t);
        if (playing && !b.out && b.q && !this.sending) this.autoFire(s, now);
        if (b.out && !this.reported) { this.reported = this.round; this.room.dirty(true); this.room.eliminate().catch(onlineError); if (!this.outAt) { this.outAt = now; SFX.play('out'); this.outCard = this.room.alive().length > 2; } s.out = true; }
      } else if (playing && !s.out) { b.t += dt; for (const row of b.g) for (const v of row) if (v && v.k === 'w' && v.tm > 0) v.tm = Math.max(0, v.tm - dt); }
    }
  }
  /** one gb.k event carries the whole burst: hits [[targetId, charges], …]; on failure the charges are refunded */
  launch(s, plan, n) {
    const b = s.board; this.launchAt = performance.now(); this.sending = true;
    const refund = msg => { if (b && !b.out) b.q = Math.min(D.MAX_CHARGES, (b.q | 0) + n); toast(msg); };
    this.room.skill(plan, s.ch).then(seed => { if (seed == null) refund(t('skillFail')); }).catch(e => refund(errMsg(e))).then(() => { this.sending = false; });
  }
  meSeat() { if (this.mine) return this.mine; const r = this.room, i = r.players().findIndex(p => p.id === r.me); return { id: r.me, name: r.nameOf(r.me), seat: Math.max(0, i), me: true }; }
  talk(x, v) { return this.room.talk(x, x === 'say' ? { m: v } : { k: v }).then(() => true); }
  wake() { this.room.refresh().catch(onlineError); }
  connOf(s) { return this.room.presence(s.id); }
  tick() {
    const r = this.room, m = this.mine, live = this.phase() === 'playing' && m && !m.out && r.amIn();
    if (live && document.hidden) {
      // a background tab freezes my board: after STALE_MS hidden I count as left ('Keluar'), the others don't have to wait
      if (!this.hiddenAt) this.hiddenAt = performance.now();
      if (performance.now() - this.hiddenAt > N.STALE_MS - 3000 && !m.board.out) { m.board.out = true; m.out = true; this.reported = this.round; this.outAt = performance.now(); this.outCard = r.alive().length > 2; this.awayOut = true; r.eliminate(true).catch(onlineError); }
    } else this.hiddenAt = 0;
    if (live) r.notice(document.hidden); else if (r.awayNote && !document.hidden) r.notice(false);
    if (this.awayOut && !document.hidden) { this.awayOut = false; toast(t('awayOut')); }
    r.tick();
  }
  lobbyHTML(d) {
    const r = this.room, s = r.s, list = N.seated(d.players), need = Math.max(0, 2 - list.length), specs = d.players.filter(p => p.spectator).length;
    const picks = (s.chars || []).filter(x => list.some(p => p.id === x[0])), charOf = id => (picks.find(x => x[0] === id) || [])[1], mine = charOf(r.me);
    let html = '<div class="ov-card lobby"><h2>' + esc(t('lobbyTitle')) + '</h2><p class="muted">' + esc(t('lobbyInvite')) + '</p><div class="code">' + esc(d.code) + '</div><div class="ov-actions"><button type="button" class="btn small yellow" data-act="copy">' + esc(t('copyInvite')) + '</button><button type="button" class="btn small ghost" data-act="chatToggle">' + esc(t('chatOpen')) + '</button></div>';
    html += '<ul class="lobby-list">' + list.map((p, i) => { const k = charOf(p.id); return '<li style="--c:' + SEAT[i % 4] + '">' + (k ? face(k, 26) : '<i class="pf empty"></i>') + '<span class="pn">' + esc(p.displayName) + (p.id === r.me ? ' <em>' + esc(t('youBadge')) + '</em>' : '') + (s.hostId === p.id ? ' <em>' + esc(t('hostBadge')) + '</em>' : '') + '</span><small>' + esc(k ? ch(k).name : t('choosing')) + '</small></li>'; }).join('') + '</ul>';
    if (!d.spectator) {
      const taken = new Set(picks.filter(x => x[0] !== r.me).map(x => x[1])), box = document.createElement('div');
      charPicker(box, mine, taken, k => { const x = picks.find(q => q[1] === k); return x ? r.nameOf(x[0]) : ''; });
      html += '<p class="muted small">' + esc(t('pickCharLobby')) + '</p><div class="char-pick lobby-pick" role="radiogroup">' + box.innerHTML.replace(/data-ch=/g, 'data-act="char" data-ch=') + '</div>';
    }
    html += '<p class="muted small">' + esc(t('lobbyCount', { n: list.length, max: d.maxPlayers }) + (specs ? ' · ' + t('spectatorsCount', { n: specs }) : '')) + '</p>';
    html += '<div class="ov-actions">' + (r.isHost() ? '<button type="button" class="btn primary" data-act="start"' + (need ? ' disabled' : '') + '>' + esc(t('start')) + '</button>' : '') + '<button type="button" class="btn ghost" data-act="leave">' + esc(t('exit')) + '</button></div>';
    html += '<p class="muted small">' + esc(need ? t('lobbyNeed', { n: need }) : (r.isHost() ? t('lobbyHostHint') : t('lobbyWaitHost'))) + '</p></div>';
    return html;
  }
  overlay() {
    const d = this.room.data, ph = this.phase(), now = performance.now();
    if (ph === 'loading') return '<div class="ov-card small"><p>' + esc(t('loading')) + '</p></div>';
    if (ph === 'closed') return '<div class="ov-card small"><h2>' + esc(t('closedTitle')) + '</h2><p>' + esc(t('closedText')) + '</p><div class="ov-actions"><button type="button" class="btn primary" data-act="home">' + esc(t('backHome')) + '</button></div></div>';
    if (ph === 'lobby') return this.lobbyHTML(d);
    if (ph === 'starting') { const m = this.mine; return '<div class="ov-card count"><p>' + esc(t('startingIn')) + '</p><b>' + Math.max(1, Math.ceil((this.startAt - now) / 1000)) + '</b>' + (m ? face(m.ch, 56) + '<p><b>' + esc(ch(m.ch).name + ' · ' + ch(m.ch).skill) + '</b></p><p class="muted small">' + esc(t('startHint')) + '</p>' : '<p class="muted small">' + esc(t('watchingHint')) + '</p>') + '</div>'; }
    if (ph === 'over' && this.final) {
      const host = this.room.isHost();
      return resultHTML(this.final, this.me, this.won, (host ? '<button type="button" class="btn primary" data-act="rematch">' + esc(t('rematch')) + '</button>' : '<p class="muted small">' + esc(t('rematchWait')) + '</p>') + '<button type="button" class="btn ghost" data-act="leave">' + esc(t('exit')) + '</button>');
    }
    if (this.outCard && ph === 'playing') return outHTML(this.room.alive().length + 1, '<button type="button" class="btn primary" data-act="watch">' + esc(t('watchRest')) + '</button><button type="button" class="btn ghost" data-act="leave">' + esc(t('exit')) + '</button>');
    return '';
  }
  overlayAct(a, b) {
    const r = this.room;
    if (a === 'start') r.start().catch(e => toast(errMsg(e)));
    else if (a === 'char') { const k = b.dataset.ch; pickedChar = k; local.set('gelembung.char', k); r.pickChar(k).catch(e => toast(errMsg(e))); }
    else if (a === 'rematch') r.rematch().catch(e => toast(errMsg(e)));
    else if (a === 'copy') copyInvite(r.data.code);
    else if (a === 'chatToggle') $('chatBtn').click();
    else if (a === 'watch') this.outCard = false;
    else if (a === 'leave' || a === 'home') r.leave().finally(showHome);
  }
  async exit() { const ph = this.phase(); if ((ph === 'playing' || ph === 'starting') && this.mine && !this.mine.out && !confirm(t('exitConfirm'))) return; try { await this.room.leave(); } catch (e) { /* ignore */ } showHome(); }
  stop() { super.stop(); }
}
/* ----- home: online card ----- */
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
  el.innerHTML = roomList.map(r => { const open = r.status === 'waiting' && r.seated < r.maxPlayers; return '<li class="room"><span><b>' + esc(r.code) + '</b><small>' + esc((r.status === 'waiting' ? t('roomWaiting') : t('roomPlaying')) + ' · ' + t('roomSeats', { n: r.seated, max: r.maxPlayers })) + '</small></span><button type="button" class="btn small ' + (open ? 'teal' : 'ghost') + '" data-room="' + esc(r.code) + '" data-kind="' + (open ? 'join' : 'watch') + '">' + esc(open ? t('join') : t('watch')) + '</button></li>'; }).join('');
}
$('rooms').addEventListener('click', e => { const b = e.target.closest('[data-room]'); if (!b) return; $('codeInput').value = b.dataset.room; go(b.dataset.kind, b.dataset.room); });
let entering = false;
function joinFail(e) { return { ok: false, missing: e.status === 404 || e.status === 422, retry: e.code === 'network' || e.code === 'busy' || e.status === 429, message: errMsg(e) }; }
async function go(kind, code) {
  if (entering || onlineState !== 'ready') return { ok: false, retry: true };
  const name = $('nameInput').value.replace(/\s+/g, ' ').trim().slice(0, 24);
  if (!name) { note(t('errName'), true); $('nameInput').focus(); return { ok: false, retry: true, message: t('errName') }; }
  if ((kind === 'join' || kind === 'watch') && !/^[A-Z2-9]{6}$/.test(code || '')) { note(t('errCode'), true); $('codeInput').focus(); return { ok: false, missing: true }; }
  local.set('gelembung.name', name); entering = true; document.querySelectorAll('.online-btn').forEach(b => { b.disabled = true; });
  const m = new OnlineMatch(), opts = { displayName: name, code, maxPlayers: Math.max(2, Math.min(4, Number($('maxSelect').value) || 4)), settings: {} };
  const afterEnter = () => { note(''); showGame(m); if (!m.spectator() && m.room.s.phase !== 'playing') m.room.pickChar(pickedChar).catch(() => { /* taken: pick in the lobby */ }); };
  try { await m.room.enter(kind, opts); afterEnter(); return { ok: true }; }
  catch (e) {
    if (kind === 'join' && e.status === 409 && /not open/i.test(e.server || '')) {
      try { await m.room.enter('watch', opts); toast(t('nowWatching')); afterEnter(); return { ok: true }; } catch (e2) { note(errMsg(e2), true); return joinFail(e2); }
    } else { note(errMsg(e), true); return joinFail(e); }
  } finally { entering = false; if (onlineState === 'ready') document.querySelectorAll('.online-btn').forEach(b => { b.disabled = false; }); }
}
$('createPrivate').addEventListener('click', () => go('private'));
$('quickMatch').addEventListener('click', () => go('match'));
$('joinForm').addEventListener('submit', e => { e.preventDefault(); go('join', $('codeInput').value.trim().toUpperCase()); });
$('watchBtn').addEventListener('click', () => go('watch', $('codeInput').value.trim().toUpperCase()));
$('refreshRooms').addEventListener('click', loadRooms);
$('codeInput').addEventListener('input', e => { const el = e.target, v = el.value.toUpperCase().replace(/[^A-Z2-9]/g, '').slice(0, 6); if (v !== el.value) el.value = v; });
const saveName = () => { const n = $('nameInput').value.replace(/\s+/g, ' ').trim().slice(0, 24); if (n) local.set('gelembung.name', n); };
$('practiceStart').addEventListener('click', () => { saveName(); startPractice(); });
$('tutorialStart').addEventListener('click', () => { saveName(); startPractice({ tutorial: true }); });
$('brandLink').addEventListener('click', e => { if (mode) { e.preventDefault(); mode.exit(); } });
document.addEventListener('pointerdown', () => SFX.unlock(), { capture: true });
function route() { const h = location.hash.toLowerCase(); if (mode) return; if (h === '#practice' || h === '#latihan') startPractice(); else if (h === '#demo') startPractice({ demo: true, bots: 3 }); }
window.addEventListener('hashchange', route);
/* ---------------- boot ---------------- */
$('nameInput').value = local.get('gelembung.name') || '';
applyText(); heroArt();
setInterval(() => { if (mode) mode.tick(); }, 250);
const invite = window.JRInvite ? JRInvite.code('room') : '';
route();
async function resumeSaved() { const m = new OnlineMatch(); try { await m.room.resume(); if (!mode) showGame(m); } catch (e) { if (e.status === 403 || e.status === 404) net.forget(); } }
const onlineReady = (async function initOnline() {
  if (!net.allowed) { setOnline('off', t('errOffline')); return 'offline'; }
  setOnline('checking', t('onlineChecking'));
  try {
    await net.start(); setOnline('ready', t('onlineReady')); loadRooms();
    if (net.code && net.token && !mode && (!invite || invite === net.code)) await resumeSaved();
    return 'ready';
  } catch (e) { const key = e.code === 'disabled' ? 'errDisabled' : e.code === 'mismatch' ? 'errMismatch' : 'errNetwork'; setOnline('off', t(key), true); return t(key); }
})();
// invite link (?room=CODE): the room exists → only ask for a name and join; missing → main menu with a short notice
if (invite) JRInvite.run({
  code: invite, lang: 'id', gameName: (CFG.site && CFG.site.name) || '', nameKey: 'gelembung.name', nameMax: 24, accent: '#56B4E9',
  check: async c => { const st = await onlineReady; if (st === 'offline') return 'offline'; if (st !== 'ready') return { fallback: st }; if (mode && mode.kind === 'online' && net.code === c) return 'session'; return net.probe(c); },
  join: name => { $('nameInput').value = name; $('codeInput').value = invite; return go('join', invite); },
  fallback: msg => { $('codeInput').value = ''; if (msg) note(msg, true); if (!mode) { const p = $('play'); if (p) p.scrollIntoView({ block: 'start' }); if (net.code && net.token && onlineState === 'ready') resumeSaved(); } }
});
window.addEventListener('online', () => { if (onlineState === 'ready') net.visible(); });
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && onlineState === 'ready') net.visible(); if (mode && mode.kind === 'online') mode.tick(); });
/* closing the tab / navigating away (back, Game Hub, reload): best-effort keepalive leave. The server drops me from the
   player list, so the others eliminate me at once ('Keluar') or free my lobby seat + character. If that request is lost,
   the quiet/frozen-board rules still end the round. A page restored from the back/forward cache goes to the menu. */
let leftByPagehide = false;
window.addEventListener('pagehide', () => { if (mode && mode.kind === 'online' && mode.room.data && mode.room.data.status !== 'closed') { leftByPagehide = mode.room.leaveNow(); } });
window.addEventListener('pageshow', e => { if (e.persisted && leftByPagehide) { leftByPagehide = false; if (mode && mode.kind === 'online') { showHome(); toast(t('leftRoom')); } } });
window.DGApp = { get mode() { return mode; }, net, startPractice, showHome, SFX, TUT };
})();

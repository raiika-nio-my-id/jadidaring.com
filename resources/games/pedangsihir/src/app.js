/* Pedang Sihir Perisai: UI, local modes (tutorial, CPU ladder, CPU party, demo) and the online room screen. */
(function () {
'use strict';
const P = window.PS, N = window.PSNet, R = window.PSR, $ = id => document.getElementById(id);
let CFG; try { CFG = JSON.parse($('website-config').textContent); } catch (e) { CFG = {}; }
CFG.text = CFG.text || {};
const KINDS = (CFG.kinds && CFG.kinds.length === 3) ? CFG.kinds : [{ name: 'Pedang', color: '#ff8a1f' }, { name: 'Sihir', color: '#b45cff' }, { name: 'Perisai', color: '#3ea0ff' }];
R.setColors(KINDS.map(k => k.color));
const KC = KINDS.map(k => k.color), KN = KINDS.map(k => k.name);
const AVS = CFG.avatars && CFG.avatars.length ? CFG.avatars : ['🦁', '🐯', '🐼', '🐸', '🐵', '🐲', '🦉', '🐻'];
const CHAT = CFG.chat || [], EMOJIS = CFG.emojis || [];
const SEAT = ['#ffd23f', '#3be8b0', '#ff5d8f', '#7fd0ff'];
const RULES = Object.assign({ pickSeconds: 10, clashMs: 3600, koExtraMs: 1300, maxClashes: 40, countdownMs: 3500 }, CFG.rules || {});
const DMG = Object.assign({ lose: 1, timeout: 1, noReveal: 2 }, CFG.damage || {});
const LADDER = Object.assign({ healPerWin: 1, nextMs: 2600, cpuMinMs: 700, cpuMaxMs: 3600 }, CFG.ladder || {});
const local = { get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* private mode */ } } };
let session = null; try { session = window.sessionStorage; } catch (e) { session = null; }
const reduced = window.matchMedia ? matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
function t(key, vars) { let s = CFG.text[key]; if (s === undefined) s = key; if (vars) s = String(s).replace(/\{(\w+)\}/g, (m, n) => (vars[n] !== undefined ? vars[n] : m)); return s; }
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const cfgPath = p => p.split('.').reduce((o, k) => (o ? o[k] : undefined), CFG);
function setHTML(el, html) { if (el && el._h !== html) { el._h = html; el.innerHTML = html; } }
const icon = (k, cls) => '<span class="ki ' + (cls || '') + '" style="--k:' + KC[k] + '">' + R.iconSVG(k) + '</span>';
let toastTimer;
function toast(msg) { const el = $('toast'); el.textContent = msg; el.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => { el.hidden = true; }, 3200); }
function errMsg(e) {
  if (!e) return '';
  if (e.code === 'busy' || e.status === 429) return t('errBusy', { n: e.wait || 10 });
  const map = { few: 'errFew', budget: 'errBudget', slow: 'errSlow', network: 'errNetwork', offline: 'errOffline', mismatch: 'errMismatch', disabled: 'errDisabled' };
  if (map[e.code]) return t(map[e.code]);
  if (e.status === 404 || e.status === 422) return t('errNoRoom');
  if (e.status === 409 && /full|not open/i.test(e.server || '')) return t('errFull');
  return t('errGeneric');
}
/* ---------------- sound (WebAudio synth, no files) ---------------- */
const SFX = (() => {
  let ctx = null, master = null, nbuf = null, muted = local.get('pedangsihir.mute') === '1';
  const last = {}, GAP = { tick: 150, chat: 150, ready: 90, hit: 60 };
  function init() { if (ctx) return; const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return; try { ctx = new AC(); master = ctx.createGain(); master.gain.value = 0.24; master.connect(ctx.destination); } catch (e) { ctx = null; } }
  function noise() { if (!nbuf) { const n = Math.floor(ctx.sampleRate * 0.8); nbuf = ctx.createBuffer(1, n, ctx.sampleRate); const d = nbuf.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1; } return nbuf; }
  function tone(type, f0, f1, dur, vol, at) {
    const t0 = ctx.currentTime + (at || 0), o = ctx.createOscillator(), g = ctx.createGain(); o.type = type; o.frequency.setValueAtTime(f0, t0); if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol, t0 + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur); o.connect(g); g.connect(master); o.start(t0); o.stop(t0 + dur + 0.03);
  }
  function hiss(dur, vol, type, freq, at, q, f1) {
    const t0 = ctx.currentTime + (at || 0), src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain(); src.buffer = noise(); f.type = type; f.frequency.setValueAtTime(freq, t0); if (f1) f.frequency.exponentialRampToValueAtTime(f1, t0 + dur); f.Q.value = q || 0.8;
    g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur); src.connect(f); f.connect(g); g.connect(master); src.start(t0, Math.random() * 0.3); src.stop(t0 + dur + 0.03);
  }
  const S = {
    tick: () => tone('square', 880, 880, 0.05, 0.06),
    urgent: () => { tone('square', 1320, 1320, 0.06, 0.09); tone('square', 1320, 1320, 0.05, 0.06, 0.09); },
    go: () => [523, 784, 1047].forEach((f, i) => tone('triangle', f, f, 0.14, 0.13, i * 0.06)),
    lock: () => { tone('square', 660, 990, 0.07, 0.09); tone('sine', 1480, 1480, 0.08, 0.06, 0.05); },
    ready: () => tone('sine', 740, 900, 0.06, 0.05),
    whoosh: () => hiss(0.4, 0.22, 'bandpass', 500, 0, 1.4, 2600),
    slash: () => { hiss(0.2, 0.35, 'highpass', 2600, 0, 0.8, 6000); tone('sawtooth', 1400, 300, 0.16, 0.08); tone('triangle', 2600, 2400, 0.3, 0.05, 0.06); },
    magic: () => { [660, 880, 1175, 1568].forEach((f, i) => tone('sine', f, f * 1.03, 0.18, 0.07, i * 0.04)); tone('sine', 190, 45, 0.5, 0.32, 0.22); hiss(0.45, 0.3, 'lowpass', 800, 0.22); },
    shield: () => { tone('sine', 523, 523, 0.55, 0.13); tone('sine', 1046, 1040, 0.45, 0.06); tone('square', 300, 1500, 0.2, 0.06, 0.3); },
    shatter: () => { for (let i = 0; i < 4; i++) hiss(0.09, 0.22, 'highpass', 4000 + i * 900, i * 0.045); tone('triangle', 1800, 600, 0.22, 0.06); },
    hit: () => { tone('sine', 160, 55, 0.28, 0.38); hiss(0.16, 0.28, 'lowpass', 420); },
    clang: () => { tone('square', 880, 860, 0.28, 0.07); tone('square', 1318, 1300, 0.32, 0.05); hiss(0.14, 0.22, 'highpass', 2500); },
    ko: () => { hiss(0.8, 0.5, 'lowpass', 400, 0, 0.8, 90); tone('sine', 120, 28, 0.8, 0.45); tone('sawtooth', 220, 55, 0.55, 0.1); },
    announce: () => { [392, 523, 659, 784].forEach((f, i) => tone('sawtooth', f, f, 0.15, 0.07, i * 0.07)); tone('square', 1047, 1047, 0.45, 0.08, 0.3); tone('triangle', 523, 523, 0.5, 0.1, 0.3); },
    timeout: () => [0, 0.14].forEach(a => tone('sawtooth', 180, 160, 0.12, 0.12, a)),
    win: () => [523, 659, 784, 1047, 1319, 1568].forEach((f, i) => tone('triangle', f, f, 0.18, 0.13, i * 0.09)),
    lose: () => [523, 440, 349, 262].forEach((f, i) => tone('triangle', f, f * 0.98, 0.18, 0.12, i * 0.14)),
    chat: () => tone('sine', 1320, 1760, 0.07, 0.06),
    click: () => tone('square', 900, 900, 0.03, 0.04),
    heal: () => [784, 988, 1319].forEach((f, i) => tone('sine', f, f, 0.12, 0.08, i * 0.06)),
  };
  return {
    get muted() { return muted; },
    toggle() { muted = !muted; local.set('pedangsihir.mute', muted ? '1' : '0'); if (!muted) { init(); if (ctx && ctx.state === 'suspended') ctx.resume(); } return muted; },
    unlock() { if (muted) return; init(); if (ctx && ctx.state === 'suspended') ctx.resume(); },
    play(k, n) { if (muted || !S[k]) return; init(); if (!ctx || ctx.state !== 'running') return; const now = performance.now(); if (now - (last[k] || 0) < (GAP[k] || 30)) return; last[k] = now; try { S[k](n); } catch (e) { /* ignore */ } },
  };
})();
['pointerdown', 'keydown'].forEach(ev => window.addEventListener(ev, () => SFX.unlock(), { passive: true }));
function buzz(p) { if (navigator.vibrate && !reduced.matches) try { navigator.vibrate(p); } catch (e) { /* ignore */ } }
function replay(el, cls) { if (!el) return; el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); }
function flash(color) { if (reduced.matches) return; const el = $('flash'); el.style.setProperty('--fc', color || '#fff'); replay(el, 'on'); }
/* ---------------- local leaderboard + stats (this device only: the platform has no shared score storage) ---------------- */
const LB_KEY = 'pedangsihir.lb', STATS_KEY = 'pedangsihir.stats', TUT_KEY = 'pedangsihir.tut';
function board() { try { const a = JSON.parse(local.get(LB_KEY) || '[]'); return Array.isArray(a) ? a.filter(x => x && x.s > 0).slice(0, 10) : []; } catch (e) { return []; } }
/** add a run; returns its rank (1-based) or 0 */
function addRun(name, s, hp) { if (!(s > 0)) return 0; const a = board(), e = { n: String(name || t('you')).slice(0, 24), s: s | 0, hp: hp | 0, at: Date.now() }; a.push(e); a.sort((x, y) => y.s - x.s || x.at - y.at); const top = a.slice(0, 10); local.set(LB_KEY, JSON.stringify(top)); renderBoard(); return top.indexOf(e) + 1; }
function best() { const a = board(); return a.length ? a[0].s : 0; }
function stats() { try { const s = JSON.parse(local.get(STATS_KEY) || '{}'); return { runs: s.runs | 0, kos: s.kos | 0, online: s.online | 0, onlineWins: s.onlineWins | 0 }; } catch (e) { return { runs: 0, kos: 0, online: 0, onlineWins: 0 }; } }
function bump(f) { const s = stats(); f(s); local.set(STATS_KEY, JSON.stringify(s)); renderBoard(); }
function renderBoard() {
  const a = board(), el = $('lbList'); if (!el) return;
  el.innerHTML = a.length ? a.map((x, i) => '<li' + (i < 3 ? ' class="top' + (i + 1) + '"' : '') + '><span class="rk">' + (i < 3 ? ['🥇', '🥈', '🥉'][i] : i + 1) + '</span><b></b><span class="ws">🔥 ' + x.s + '</span><small>' + esc(t('lbHp', { n: x.hp || '?' })) + '</small></li>').join('') : '<li class="muted empty">' + esc(t('lbEmpty')) + '</li>';
  el.querySelectorAll('li b').forEach((b, i) => { b.textContent = a[i].n; });
  const s = stats(); $('statLine').textContent = s.runs || s.online ? t('statsLine', { runs: s.runs, kos: s.kos, online: s.online, wins: s.onlineWins }) : '';
}
/* ---------------- static UI ---------------- */
const heart = on => '<i class="hp' + (on ? ' on' : '') + '"><svg viewBox="0 0 24 22" aria-hidden="true"><path d="M12 21 C5 15 1 11.5 1 7 C1 3.5 3.6 1 6.8 1 C9 1 10.8 2.2 12 4 C13.2 2.2 15 1 17.2 1 C20.4 1 23 3.5 23 7 C23 11.5 19 15 12 21 Z"/></svg></i>';
const hearts = (hp, max) => { let h = ''; for (let i = 0; i < max; i++) h += heart(i < hp); return h; };
/** the triangle: Pedang (top) ➜ Perisai (bottom right) ➜ Sihir (bottom left) ➜ Pedang; arrows point winner → loser */
function triangleSVG(big, idp) {
  const sx = idp || (big ? 'b' : '');
  const pos = [[50, 13], [14, 79], [86, 79]], arc = (a, b) => { const A = pos[a], B = pos[b], mx = (A[0] + B[0]) / 2, my = (A[1] + B[1]) / 2, cx = 50 + (mx - 50) * 1.35, cy = 57 + (my - 57) * 1.35, dx = B[0] - A[0], dy = B[1] - A[1], d = Math.hypot(dx, dy), s = 15 / d; return 'M' + (A[0] + dx * s).toFixed(1) + ' ' + (A[1] + dy * s).toFixed(1) + ' Q' + cx.toFixed(1) + ' ' + cy.toFixed(1) + ' ' + (B[0] - dx * s).toFixed(1) + ' ' + (B[1] - dy * s).toFixed(1); };
  let s = '<svg class="tri-svg" viewBox="0 0 100 100" aria-hidden="true"><defs>' + [0, 1, 2].map(k => '<marker id="ah' + k + sx + '" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="4.5" markerHeight="4.5" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 Z" fill="' + KC[k] + '"/></marker>').join('') + '</defs>';
  for (let k = 0; k < 3; k++) s += '<path class="arr a' + k + '" d="' + arc(k, P.preyOf(k)) + '" stroke="' + KC[k] + '" marker-end="url(#ah' + k + sx + ')"/>';
  return s + '</svg>' + [0, 1, 2].map(k => '<span class="tri-node n' + k + '" style="left:' + pos[k][0] + '%;top:' + pos[k][1] + '%;--k:' + KC[k] + '">' + R.iconSVG(k) + '</span>').join('');
}
function cpuInfo(c) { const x = (CFG.cpus || {})[c.key] || {}; return { name: (x.name || c.key) + (c.lap ? ' ' + ['', 'II', 'III', 'IV', 'V'][Math.min(4, c.lap)] : ''), av: x.av || '🤖', hint: x.hint || '' }; }
let myAv = AVS.includes(local.get('pedangsihir.av')) ? local.get('pedangsihir.av') : AVS[0];
function avPicker(el, chosen, act) { el.innerHTML = AVS.map(a => '<button type="button" class="av-btn' + (a === chosen ? ' on' : '') + '" role="radio" aria-checked="' + (a === chosen) + '" data-' + (act || 'av') + '="' + esc(a) + '"' + (act ? ' data-act="av"' : '') + '>' + esc(a) + '</button>').join(''); }
function hpPicker(el, chosen, act) { el.innerHTML = P.HP_CHOICES.map(h => '<button type="button" class="hp-btn' + (h === chosen ? ' on' : '') + '" role="radio" aria-checked="' + (h === chosen) + '" data-hp="' + h + '"' + (act ? ' data-act="hp"' : '') + '><b>' + h + '</b> ' + heart(true) + '</button>').join(''); }
let pickedHp = P.cleanHp(local.get('pedangsihir.hp') || 5);
function applyText() {
  document.querySelectorAll('[data-t]').forEach(el => { el.textContent = t(el.dataset.t); });
  document.querySelectorAll('[data-t-ph]').forEach(el => { el.placeholder = t(el.dataset.tPh); });
  document.querySelectorAll('[data-t-aria]').forEach(el => { el.setAttribute('aria-label', t(el.dataset.tAria)); });
  document.querySelectorAll('[data-c]').forEach(el => { el.textContent = cfgPath(el.dataset.c) || ''; });
  document.querySelector('.brand-mark').innerHTML = R.iconSVG(1);
  $('heroTri').innerHTML = triangleSVG(true, 'h'); $('rulesTri').innerHTML = triangleSVG(true, 'r'); $('tri').innerHTML = triangleSVG(false);
  $('steps').innerHTML = (CFG.steps || []).map(r => '<li><h3>' + esc(r.title) + '</h3><p>' + esc(r.text) + '</p></li>').join('');
  $('beatList').innerHTML = [0, 1, 2].map(k => '<li style="--k:' + KC[k] + '">' + icon(k, 'big') + '<span class="beats-arrow" aria-hidden="true">➜</span>' + icon(P.preyOf(k), 'mid') + '<p><b>' + esc(KN[k]) + '</b> ' + esc(KINDS[k].beatsText || '') + '</p></li>').join('');
  $('cpuList').innerHTML = P.CPUS.map(k => { const c = cpuInfo({ key: k, lap: 0 }); return '<li><span class="av" aria-hidden="true">' + esc(c.av) + '</span><span><b>' + esc(c.name) + '</b><small>' + esc(c.hint) + '</small></span></li>'; }).join('');
  $('skills').innerHTML = [0, 1, 2].map(k => '<button type="button" class="sk" data-k="' + k + '" style="--k:' + KC[k] + '" aria-label="' + esc(t('pickAria', { name: KN[k], prey: KN[P.preyOf(k)] })) + '"><span class="sk-ic">' + R.iconSVG(k) + '</span><b>' + esc(KN[k]) + '</b><small class="sk-hint" aria-hidden="true">' + icon(k, 'mini') + '➜' + icon(P.preyOf(k), 'mini') + '</small><kbd aria-hidden="true">' + (k + 1) + '</kbd></button>').join('');
  $('emoBar').innerHTML = EMOJIS.map(e => '<button type="button" class="emo" data-emo="' + esc(e.k) + '" aria-label="' + esc(e.k) + '">' + esc(e.icon) + '</button>').join('') + '<button type="button" class="emo chat-open" id="chatBtn" aria-expanded="false" data-t-aria="chatOpen" aria-label="' + esc(t('chatOpen')) + '">💬</button>';
  $('chatQuick').innerHTML = CHAT.map(c => '<button type="button" class="chip" data-say="' + esc(c.text) + '">' + esc(c.text) + '</button>').join('');
  if (CFG.site && CFG.site.themeColor) { const tc = document.querySelector('meta[name=theme-color]'); if (tc) tc.setAttribute('content', CFG.site.themeColor); }
  $('muteBtn').textContent = SFX.muted ? '🔇' : '🔊'; $('muteBtn').setAttribute('aria-label', t(SFX.muted ? 'unmute' : 'mute'));
  avPicker($('avPick'), myAv); hpPicker($('hpPick'), pickedHp);
  renderBoard();
}
$('avPick').addEventListener('click', e => { const b = e.target.closest('[data-av]'); if (!b) return; myAv = b.dataset.av; local.set('pedangsihir.av', myAv); avPicker($('avPick'), myAv); SFX.play('click'); });
$('hpPick').addEventListener('click', e => { const b = e.target.closest('[data-hp]'); if (!b) return; pickedHp = P.cleanHp(b.dataset.hp); local.set('pedangsihir.hp', String(pickedHp)); hpPicker($('hpPick'), pickedHp); SFX.play('click'); });
/* ================= match screen (shared by every mode) ================= */
let mode = null;
const FXL = new R.FX($('fx')); FXL.reduced = reduced.matches; FXL.shakeEl = $('arena');
function banner(text, cls, sub, ms) {
  const b = document.createElement('div'); b.className = 'ban ' + (cls || ''); b.innerHTML = '<b></b>' + (sub ? '<small></small>' : '');
  b.querySelector('b').textContent = text; if (sub) b.querySelector('small').textContent = sub;
  const box = $('banners'); while (box.children.length > 2) box.firstChild.remove(); box.appendChild(b); setTimeout(() => b.remove(), ms || 1700); return b;
}
const WORD = { firstblood: 'annFirstBlood', kill: 'annKill', double: 'annDouble', triple: 'annTriple', quad: 'annQuad', ko: 'annKo', maniac: 'annManiac', savage: 'annSavage', legend: 'annLegend' };
class Match {
  constructor() { this.hpShown = new Map(); this.koPending = new Set(); this.revealed = new Map(); this.revealN = -1; this.key = ''; this.lastSec = 0; this.bubbleT = new Map(); this.hintK = null; this.lastPh = ''; }
  seatList() { return []; }
  stageInfo() { return { ph: 'wait', msg: '' }; }
  canPick() { return false; }
  myPick() { return -1; }
  overlay() { return ''; }
  tick() {}
  title() { return ''; }
  build() {
    const list = this.seatList(), me = list.find(s => s.me), opps = list.filter(s => !s.me);
    this.key = list.map(s => s.id + ':' + s.av).join(',');
    $('opps').className = 'opps n' + opps.length;
    $('opps').innerHTML = opps.map(s => this.seatHTML(s)).join('');
    $('meSeat').innerHTML = me ? this.seatHTML(me) : '<div class="watch-tag">👀 ' + esc(t('watching')) + '</div>';
    $('game').classList.toggle('spect', !me);
    for (const s of list) { const el = this.seatEl(s.id); if (el) { el.querySelector('.nm b').textContent = s.name; const tg = el.querySelector('.tag'); if (tg) tg.textContent = s.tag; } }
    $('gTitle').textContent = this.title(); $('gSub').textContent = this.sub ? this.sub() : '';
  }
  seatHTML(s) { return '<div class="seat' + (s.me ? ' me' : '') + '" data-id="' + s.id + '" style="--c:' + s.color + '"><div class="bubble" hidden></div><div class="tok"><span class="face" aria-hidden="true">' + esc(s.av) + '</span><span class="pickb" hidden></span><span class="think" hidden></span></div><div class="nm"><b></b>' + (s.me ? '<em class="kamu">' + esc(t('youTag')) + '</em>' : '') + '</div>' + (s.tag ? '<small class="tag"></small>' : '') + '<div class="hearts" role="img"></div><div class="st"></div></div>'; }
  seatEl(id) { return document.querySelector('#game .seat[data-id="' + id + '"]'); }
  frame(now) {
    if (this.update) this.update(now);
    const list = this.seatList(), key = list.map(s => s.id + ':' + s.av).join(','); if (key !== this.key) this.build();
    const si = this.stageInfo(now);
    if (si.ph === 'pick' && si.n !== this.revealN) { this.revealN = si.n; this.revealed = new Map(); SFX.play('go'); replay($('skills'), 'pulse'); }
    if (si.ph !== this.lastPh) { this.lastPh = si.ph; $('game').dataset.ph = si.ph; }
    for (const s of list) {
      const el = this.seatEl(s.id); if (!el) continue;
      const hp = this.hpShown.has(s.id) ? this.hpShown.get(s.id) : s.hp, out = s.out && !this.koPending.has(s.id), hb = el.querySelector('.hearts');
      if (setHTMLc(hb, hearts(hp, s.max))) hb.setAttribute('aria-label', t('hpAria', { n: hp, max: s.max }));
      el.classList.toggle('ko', out); el.classList.toggle('ready', !out && s.status === 'ready'); el.classList.toggle('picking', !out && s.status === 'pick'); el.classList.toggle('lost', !out && s.conn === 'lost'); el.classList.toggle('low', !out && hp === 1);
      const st = out ? t(s.gone ? 'goneTag' : 'koTag') : s.conn === 'lost' ? t('lostTag') : s.status === 'ready' ? t('readyTag') : s.status === 'pick' ? t('pickingTag') : '', stEl = el.querySelector('.st');
      if (stEl.textContent !== st) stEl.textContent = st;
      const rk = this.revealed.get(s.id), pb = el.querySelector('.pickb'), want = rk == null ? '' : rk >= 0 ? icon(rk) : rk === -1 ? '⌛' : '🙈';
      setHTML(pb, want); pb.hidden = !want;
      const th = el.querySelector('.think'); setHTML(th, s.think != null ? icon(s.think) : ''); th.hidden = s.think == null;
    }
    // timer ring + stage text
    const tm = $('timer'), fg = tm.querySelector('.ring-fg'), num = $('timerN');
    let txt = si.big || '', frac = 0;
    if (si.endsAt && si.total) { const rem = Math.max(0, si.endsAt - now); frac = rem / si.total; const sec = Math.ceil(rem / 1000); txt = String(sec); if (si.ph === 'pick' && sec !== this.lastSec) { this.lastSec = sec; if (sec <= 3 && sec > 0 && this.myPick() < 0 && this.canPick()) SFX.play('urgent'); } if (si.ph === 'count' && sec !== this.lastSec) { this.lastSec = sec; SFX.play('tick'); } }
    fg.style.strokeDashoffset = String(276.5 * (1 - frac)); tm.classList.toggle('low', si.ph === 'pick' && frac > 0 && frac < 0.3); tm.classList.toggle('idle', !si.endsAt);
    if (num.textContent !== txt) num.textContent = txt;
    const msg = $('stageMsg'); if (msg.textContent !== (si.msg || '')) msg.textContent = si.msg || '';
    // skill buttons
    const can = this.canPick(), mine = this.myPick();
    $('skills').classList.toggle('locked', mine >= 0); $('skills').classList.toggle('off', !can && mine < 0);
    document.querySelectorAll('#skills .sk').forEach(b => { const k = Number(b.dataset.k); b.disabled = !can; b.classList.toggle('sel', mine === k); b.classList.toggle('dim', mine >= 0 && mine !== k); b.classList.toggle('hint', this.hintK === k && can); });
    FXL.frame(now);
  }
  pick(k) { if (!this.canPick()) return; SFX.play('lock'); buzz(15); this.doPick(k); }
  /** c = { picks [[id, k]], r (PS.resolve), ko [ids], fb, final, word?, sub? } → plays the whole scene; returns ms until the damage lands */
  runClash(c) {
    const list = this.seatList(), box = $('tri').getBoundingClientRect(), cx = box.left + box.width / 2, cy = box.top + box.height * 0.56;
    const R0 = Math.max(52, Math.min(box.width, box.height) * 0.3), size = Math.max(52, Math.min(112, R0 * 0.85)), dm = new Map(c.r.dmg);
    for (const [id, d] of c.r.dmg) { const s = list.find(x => x.id === id); if (s) this.hpShown.set(id, Math.min(s.max, (this.hpShown.has(id) ? this.hpShown.get(id) : s.hp) + d)); }
    for (const id of c.ko) this.koPending.add(id);
    const f = c.picks.map(([id, k]) => { const el = this.seatEl(id), tok = el && el.querySelector('.tok'), b = tok ? tok.getBoundingClientRect() : { left: cx, top: cy, width: 0, height: 0 }; return { id, k, x: b.left + b.width / 2, y: b.top + b.height / 2, lose: dm.has(id), ko: c.ko.includes(id) }; });
    this.revealed = new Map(c.picks); this.revealN = -2;
    f.forEach(x => { const el = this.seatEl(x.id); if (el && x.k >= 0) replay(el, 'atk'); });
    SFX.play('whoosh');
    const tm = FXL.clash({ c: { x: cx, y: cy }, R: R0, size, res: c.r.res, wk: c.r.wk, lk: c.r.lk, f });
    const kind = c.r.res === 'win' ? ['slash', 'magic', 'shield'][c.r.wk] : c.r.res === 'none' ? 'timeout' : 'clang';
    setTimeout(() => { if (mode === this) SFX.play(kind); }, Math.max(0, tm.hit - (c.r.wk === 2 && c.r.res === 'win' ? 560 : 200)));
    $('tri').classList.remove('w0', 'w1', 'w2'); if (c.r.res === 'win') replay($('tri'), 'w' + c.r.wk);
    const meId = this.meId;
    setTimeout(() => {
      if (mode !== this) return;
      for (const id of dm.keys()) this.hpShown.delete(id);
      if (c.r.res === 'win') { SFX.play(c.r.wk === 0 ? 'shatter' : 'hit'); banner(t('winKind', { name: KN[c.r.wk].toUpperCase() }), 'small k' + c.r.wk, t('beatsKind', { a: KN[c.r.wk], b: KN[c.r.lk] }), 1500); flash(KC[c.r.wk]); }
      else if (c.r.res === 'none') banner(t('allLate'), 'small draw', '', 1400);
      else banner(t('drawBan'), 'small draw', t(c.r.res === 'draw3' ? 'draw3Sub' : 'sameSub'), 1400);
      for (const x of f) {
        const d = dm.get(x.id), el = this.seatEl(x.id); if (!d || !el) continue;
        FXL.text(x.x, x.y - 34, '-' + d, x.k < 0 ? '#ffe14d' : '#ff4d6d', x.id === meId ? 46 : 38); replay(el, 'hit');
        if (x.id === meId) { buzz([30, 40, 30]); flash('#ff2d55'); }
      }
      for (const x of f) if (!dm.has(x.id) && x.k >= 0 && c.r.res === 'win') { const el = this.seatEl(x.id); if (el) replay(el, 'cheer'); }
      if (c.ko.length) setTimeout(() => {
        if (mode !== this) return;
        for (const id of c.ko) { this.koPending.delete(id); const x = f.find(q => q.id === id); if (x) { FXL.boom(x.x, x.y, '#ff5d3a', 1.3); FXL.confetti(x.x, x.y, 40); } }
        SFX.play('ko'); FXL.shake(20, 520); flash('#fff');
        const w = c.word || (c.ko.length > 1 ? P.killWord(c.ko.length) : c.final ? 'ko' : c.fb ? 'firstblood' : 'kill');
        setTimeout(() => { if (mode === this) { SFX.play('announce'); banner(t(WORD[w] || 'annKill'), 'ann ' + w, c.sub || '', 1900); } }, 250);
      }, 420);
      if (this.afterHit) this.afterHit(c);
    }, tm.hit);
    return tm.hit;
  }
  showTalk(id, kind, text) {
    const el = this.seatEl(id); if (!el || !text) return; const b = el.querySelector('.bubble');
    if (kind === 'emo') { const e = EMOJIS.find(x => x.k === text); if (!e) return; b.textContent = e.icon; b.classList.add('emo'); } else { b.textContent = text; b.classList.remove('emo'); }
    b.hidden = false; replay(b, 'pop'); SFX.play('chat'); clearTimeout(this.bubbleT.get(id)); this.bubbleT.set(id, setTimeout(() => { b.hidden = true; }, 3400));
  }
  say(text) { const m = N.cleanText(text); if (!m) return; Promise.resolve(this.talk('say', m)).then(ok => { if (ok !== false) this.showTalk(this.meId, 'say', m); }).catch(e => toast(errMsg(e))); }
  emo(k) { Promise.resolve(this.talk('emo', k)).then(ok => { if (ok !== false) this.showTalk(this.meId, 'emo', k); }).catch(e => toast(errMsg(e))); }
  talk() { return true; }
  stop() { FXL.clear(); }
  coach(text, skip) { const c = $('coach'); if (!text) { c.hidden = true; return; } $('coachText').textContent = text; $('tutSkip').hidden = !skip; c.hidden = false; replay(c, 'pop'); }
}
function setHTMLc(el, html) { if (el._h === html) return false; el._h = html; el.innerHTML = html; return true; }
/* ================= local modes: CPU ladder, CPU party, tutorial, demo ================= */
const ME = 1;
const TUT = [{ show: 1, want: 2, key: 'tut1' }, { show: 0, want: 1, key: 'tut2' }, { show: 2, want: 0, key: 'tut3' }, { show: 1, want: 1, key: 'tut4' }, { key: 'tut5' }];
function myName() { return ($('nameInput').value || local.get('pedangsihir.name') || '').replace(/\s+/g, ' ').trim().slice(0, 24) || t('you'); }
class LocalMatch extends Match {
  /** o = { kind: 'ladder' | 'party' | 'tut' | 'demo', hp, bots } */
  constructor(o) {
    super(); this.o = o; this.kind = o.kind; this.meId = ME; this.hp = P.cleanHp(o.hp); this.rng = P.rng((Date.now() ^ (Math.random() * 1e9)) >>> 0);
    this.ps = [{ id: ME, name: o.kind === 'demo' ? 'JadiDaring' : myName(), av: o.kind === 'demo' ? '🦁' : myAv, hp: this.hp, max: this.hp, out: false, me: true, seat: 0, hist: [] }];
    this.n = 0; this.ph = 'count'; this.at = performance.now() + (o.kind === 'tut' ? 900 : RULES.countdownMs); this.dl = 0; this.streak = 0; this.level = 0; this.kos = 0; this.mine = -1; this.cpuHist = new Map();
    if (o.kind === 'ladder') this.spawn();
    else if (o.kind === 'tut') { this.ps[0].hp = this.ps[0].max = 5; this.ps.push({ id: 2, name: t('dummyName'), av: '🪆', hp: 4, max: 4, out: false, seat: 1, cpu: null }); this.step = 0; }
    else { const n = Math.max(1, Math.min(3, o.bots | 0 || 3)), keys = P.CPUS.slice(1).sort(() => this.rng() - 0.5); for (let i = 0; i < n; i++) { const c = P.cpuFor(P.CPUS.indexOf(keys[i])); c.level = 2 + Math.floor(this.rng() * 6); const info = cpuInfo(c); this.ps.push({ id: 10 + i, name: info.name, av: info.av, tag: info.hint, hp: this.hp, max: this.hp, out: false, seat: i + 1, cpu: c }); } }
  }
  title() { return t(this.kind === 'ladder' ? 'ladderTitle' : this.kind === 'tut' ? 'tutTitle' : this.kind === 'demo' ? 'demoTitle' : 'partyTitle'); }
  sub() { return this.kind === 'ladder' ? t('ladderSub', { n: this.streak, best: best() }) : this.kind === 'party' ? t('partySub', { n: this.ps.length }) : ''; }
  spawn() {
    const c = P.cpuFor(this.level), info = cpuInfo(c);
    this.ps = this.ps.filter(p => p.me).concat([{ id: 100 + this.level, name: info.name, av: info.av, tag: info.hint, hp: this.hp, max: this.hp, out: false, seat: 1, cpu: c }]);
    this.cpuHist = new Map();
  }
  me() { return this.ps[0]; }
  seatList() { return this.ps.map(p => ({ id: p.id, name: p.name, av: p.av, color: SEAT[p.seat % 4], hp: p.hp, max: p.max, out: p.out, me: !!p.me, tag: p.tag, think: this.ph === 'pick' && p.think != null ? p.think : null, status: this.ph !== 'pick' || p.out ? '' : p.me ? (this.mine >= 0 ? 'ready' : 'pick') : (performance.now() >= p.readyAt ? 'ready' : 'pick'), conn: 'ok' })); }
  alive() { return this.ps.filter(p => !p.out); }
  stageInfo(now) {
    if (this.ph === 'count') return { ph: 'count', endsAt: this.at, total: RULES.countdownMs, msg: t('getReady') };
    if (this.ph === 'pick') { const guided = this.kind === 'tut' && this.step < 4; return { ph: 'pick', n: this.n, endsAt: guided ? 0 : this.dl, total: this.pickMs, big: guided ? '!' : '', msg: this.mine >= 0 ? t('waitOthers') : t('pickNow') }; }
    if (this.ph === 'next') return { ph: 'next', msg: t('nextFoe'), big: '🔥' };
    if (this.ph === 'over') return { ph: 'over', msg: '' };
    return { ph: 'clash', n: this.n, msg: t('roundN', { n: this.n }), big: '⚔' };
  }
  canPick() { return this.ph === 'pick' && this.mine < 0 && !this.me().out && this.kind !== 'demo'; }
  myPick() { return this.ph === 'pick' ? this.mine : -1; }
  doPick(k) { this.mine = k; this.hintK = null; if (this.alive().every(p => p.me || performance.now() >= p.readyAt)) this.revealAt = performance.now() + 350; }
  startRound(now) {
    this.n++; this.ph = 'pick'; this.mine = -1; this.revealAt = 0; this.hintK = null;
    const guided = this.kind === 'tut' && this.step < 4, fast = Math.max(0.45, 1 - this.level * 0.05);
    this.pickMs = this.kind === 'tut' ? 15000 : RULES.pickSeconds * 1000; this.dl = guided ? Infinity : now + this.pickMs;
    for (const p of this.ps) {
      p.think = null; if (p.me || p.out) continue;
      if (this.kind === 'tut') { const st = TUT[this.step]; p.k = st.show != null ? st.show : P.pickOf(this.rng, 3); if (st.show != null) p.think = st.show; p.readyAt = now + 500; continue; }
      p.k = P.cpuPick(p.cpu, this.cpuHist.get(p.id) || [], this.rng); // decided now, before I pick: the CPU never sees my pick
      p.readyAt = now + (LADDER.cpuMinMs + this.rng() * (LADDER.cpuMaxMs - LADDER.cpuMinMs)) * (this.kind === 'demo' ? 0.4 : fast);
    }
    if (this.kind === 'tut') { const st = TUT[this.step]; this.hintK = st.want != null ? st.want : null; this.coach(t(this.retry ? 'tutRetry' : st.key, { a: KN[st.show], b: KN[st.want] }), true); }
    if (this.kind === 'demo') this.demoPick = now + 600 + this.rng() * 1200;
  }
  update(now) {
    if (this.ph === 'count' && now >= this.at) this.startRound(now);
    else if (this.ph === 'pick') {
      if (this.kind === 'demo' && this.mine < 0 && now >= this.demoPick) this.doPick(P.pickOf(this.rng, 3));
      if (this.mine >= 0 && !this.revealAt && this.alive().every(p => p.me || now >= p.readyAt)) this.revealAt = now + 300;
      if ((this.revealAt && now >= this.revealAt) || now >= this.dl) this.reveal(now);
    } else if (this.ph === 'clash' && now >= this.at) this.afterClash(now);
    else if (this.ph === 'next' && now >= this.at) { this.ph = 'count'; this.at = now + 1600; this.spawn(); this.build(); }
  }
  reveal(now) {
    const alive = this.alive(), picks = alive.map(p => [p.id, p.me ? this.mine : p.k]);
    const res = P.resolve(picks, DMG), hp = this.ps.map(p => [p.id, p.hp]), ap = P.applyDamage(hp, res);
    if (this.kind === 'tut') { const m = ap.hp.find(x => x[0] === ME); if (m[1] < 1) { m[1] = 1; ap.ko = ap.ko.filter(id => id !== ME); } }
    for (const p of this.ps) { const x = ap.hp.find(h => h[0] === p.id); p.hp = x[1]; if (ap.ko.includes(p.id)) p.out = true; p.think = null; }
    // the CPUs learn from what they saw (my pick and theirs)
    for (const p of alive) if (!p.me) { const h = this.cpuHist.get(p.id) || [], r = res.dmg.find(d => d[0] === ME) ? 'lose' : res.dmg.find(d => d[0] === p.id) ? 'win' : 'draw'; h.push({ me: this.mine, cpu: p.k, res: r }); this.cpuHist.set(p.id, h.slice(-30)); }
    const final = this.kind === 'ladder' ? ap.ko.includes(ME) : this.kind === 'tut' ? ap.ko.length > 0 : this.alive().length <= 1 || this.n >= RULES.maxClashes;
    let word = null, sub = '';
    if (ap.ko.length && this.kind === 'ladder' && !ap.ko.includes(ME)) { this.kos++; word = this.kos === 1 ? 'firstblood' : ['firstblood', 'double', 'triple', 'maniac', 'savage'][this.kos - 1] || 'legend'; sub = t('streakSub', { n: this.kos }); }
    else if (ap.ko.length && this.kind === 'tut') word = 'ko';
    const fb = ap.ko.length && !this.fbDone ? 1 : 0; if (ap.ko.length) this.fbDone = true;
    this.lastRes = res; this.lastKo = ap.ko;
    this.ph = 'clash'; const hit = this.runClash({ picks, r: res, ko: ap.ko, fb, final: final && !word, word, sub });
    this.at = now + Math.max(RULES.clashMs * (this.kind === 'demo' ? 0.8 : 1), hit + 1200) + (ap.ko.length ? RULES.koExtraMs : 0);
    if (this.kind !== 'tut') this.botBanter(res, ap.ko, hit);
  }
  botBanter(res, ko, hit) {
    for (const p of this.ps) { if (p.me || !p.cpu) continue; const lost = res.dmg.some(d => d[0] === p.id), r = this.rng(); if (r > 0.33) continue; const k = ko.includes(p.id) ? 'nangis' : lost ? (r < 0.15 ? 'marah' : 'kaget') : res.res === 'win' ? (r < 0.15 ? 'keren' : 'ketawa') : ''; if (k) setTimeout(() => { if (mode === this) this.showTalk(p.id, 'emo', k); }, hit + 700 + this.rng() * 700); }
  }
  afterClash(now) {
    const me = this.me(), ko = this.lastKo || [];
    if (this.kind === 'tut') {
      const st = TUT[this.step], res = this.lastRes, good = st.want == null || this.mine === st.want;
      if (ko.length) { this.ph = 'over'; local.set(TUT_KEY, '1'); this.coach(''); SFX.play('win'); return; }
      this.retry = !good; if (good) this.step = Math.min(4, this.step + 1); if (res && st.want == null) this.retry = false;
      this.startRound(now); return;
    }
    if (this.kind === 'ladder') {
      if (me.out) { this.ph = 'over'; this.rank = addRun(me.name, this.streak, this.hp); bump(s => { s.runs++; s.kos += this.streak; }); SFX.play('lose'); return; }
      const foe = this.ps.find(p => !p.me); if (foe && foe.out) { this.streak++; this.level++; const heal = Math.min(me.max - me.hp, LADDER.healPerWin | 0); if (heal > 0) { me.hp += heal; SFX.play('heal'); setTimeout(() => { const el = this.seatEl(ME); if (el) { replay(el, 'healfx'); const b = el.querySelector('.tok').getBoundingClientRect(); FXL.text(b.left + b.width / 2, b.top, '+' + heal + ' ❤', '#3be8b0', 34); } }, 60); } this.ph = 'next'; this.at = now + LADDER.nextMs; $('gSub').textContent = this.sub(); return; }
      this.startRound(now); return;
    }
    if (this.alive().length <= 1 || this.n >= RULES.maxClashes) {
      this.ph = 'over'; const left = this.alive().sort((a, b) => b.hp - a.hp); this.winner = left.length === 1 || (left.length > 1 && left[0].hp > left[1].hp) ? left[0] : null;
      if (this.kind === 'demo') { this.at = now + 2500; return; }
      SFX.play(this.winner && this.winner.me ? 'win' : 'lose'); if (this.winner && this.winner.me) setTimeout(() => { if (mode === this) { banner(t('annWinner'), 'ann win', '', 2200); FXL.confetti(innerWidth / 2, innerHeight * 0.4, 120); } }, 200);
      return;
    }
    this.startRound(now);
  }
  overlay() {
    if (this.ph === 'next') { const c = cpuInfo(P.cpuFor(this.level)); return '<div class="ov-card small next-card"><p class="streak">🔥 ' + esc(t('streakN', { n: this.streak })) + '</p><p class="muted">' + esc(t('nextFoe')) + '</p><div class="foe"><span class="av">' + esc(c.av) + '</span><span><b>' + esc(c.name) + '</b><small>' + esc(c.hint) + '</small></span></div><p class="muted small">' + esc(t('healNote')) + '</p></div>'; }
    if (this.ph !== 'over') return '';
    if (this.kind === 'demo') return '';
    if (this.kind === 'tut') return '<div class="ov-card small"><div class="trophy" aria-hidden="true">🎉</div><h2>' + esc(t('tutDoneTitle')) + '</h2><p>' + esc(t('tutDoneText')) + '</p><div class="ov-actions"><button type="button" class="btn primary" data-act="ladder">' + esc(t('ladderStart')) + '</button><button type="button" class="btn ghost" data-act="home">' + esc(t('backHome')) + '</button></div></div>';
    if (this.kind === 'ladder') {
      const lb = board().slice(0, 5).map((x, i) => '<li' + (this.rank === i + 1 ? ' class="me"' : '') + '><span class="pl">' + (i + 1) + '</span><b></b><span>🔥 ' + x.s + '</span></li>').join('');
      return { html: '<div class="ov-card result"><div class="trophy" aria-hidden="true">' + (this.rank === 1 && this.streak ? '🏆' : '💥') + '</div><h2>' + esc(t('ladderOver')) + '</h2><p class="big-num">🔥 ' + this.streak + '</p><p class="muted">' + esc(this.rank === 1 && this.streak ? t('newBest') : this.rank ? t('rankN', { n: this.rank }) : t('ladderNoRank')) + '</p>' + (lb ? '<ol class="standings">' + lb + '</ol><p class="muted small">' + esc(t('lbLocal')) + '</p>' : '') + '<div class="ov-actions"><button type="button" class="btn primary" data-act="ladder">' + esc(t('again')) + '</button><button type="button" class="btn ghost" data-act="home">' + esc(t('backHome')) + '</button></div></div>', names: board().slice(0, 5).map(x => x.n) };
    }
    const order = this.ps.slice().sort((a, b) => (a.out - b.out) || b.hp - a.hp), won = this.winner && this.winner.me;
    return { html: '<div class="ov-card result"><div class="trophy" aria-hidden="true">' + (won ? '🏆' : this.winner ? '💥' : '🤝') + '</div><h2>' + esc(won ? t('winTitle') : this.winner ? t('loseTitle') : t('drawTitle')) + '</h2><ol class="standings">' + order.map((p, i) => '<li class="' + (p.me ? 'me' : '') + '"><span class="pl">' + (i + 1) + '</span><span class="av">' + esc(p.av) + '</span><b></b><span>' + hearts(p.hp, p.max) + '</span></li>').join('') + '</ol><div class="ov-actions"><button type="button" class="btn primary" data-act="party">' + esc(t('again')) + '</button><button type="button" class="btn ghost" data-act="home">' + esc(t('backHome')) + '</button></div></div>', names: order.map(p => p.name) };
  }
  overlayAct(a) { if (a === 'ladder') startLocal({ kind: 'ladder' }, true); else if (a === 'party') startLocal({ kind: 'party', bots: this.o.bots }); else if (a === 'home') showHome(); }
  tick() { if (this.kind === 'demo' && this.ph === 'over' && performance.now() > this.at) startLocal(this.o); }
  exit() { if (this.kind === 'ladder' && this.ph !== 'over' && this.streak > 0 && !confirm(t('exitLadder'))) return; if (this.kind === 'ladder' && this.ph !== 'over' && this.streak > 0) { addRun(this.me().name, this.streak, this.hp); bump(s => { s.runs++; s.kos += this.streak; }); } showHome(); }
  skipTut() { local.set(TUT_KEY, '1'); startLocal({ kind: 'ladder' }, true); }
}
/* ================= overlay + screens ================= */
function renderOverlay() {
  const ov = $('ov'); let o = mode ? mode.overlay() : ''; let names = null, sel = null;
  if (o && typeof o === 'object') { names = o.names; sel = o.sel; o = o.html; }
  if (!o) { if (!ov.hidden) { ov.hidden = true; ov._h = ''; ov.innerHTML = ''; } return; }
  ov.hidden = false; const key = o + (names ? names.join('|') : '');
  if (ov._h !== key) { ov._h = key; ov.innerHTML = o; if (names) ov.querySelectorAll(sel || '.standings b').forEach((b, i) => { b.textContent = names[i] || ''; }); }
}
let raf = 0;
function loop(now) { if (!mode) { raf = 0; return; } try { mode.frame(now); } catch (e) { console.error(e); } renderOverlay(); raf = requestAnimationFrame(loop); }
function showGame(m) {
  if (mode && mode !== m && mode.stop) mode.stop(); mode = m; FXL.clear();
  $('home').hidden = true; $('game').hidden = false; document.body.classList.add('in-game'); document.documentElement.classList.add('jr-hub-off');
  $('chat').hidden = true; $('coach').hidden = true; $('banners').innerHTML = ''; $('game').classList.toggle('demo', m.kind === 'demo');
  m.build(); if (!raf) raf = requestAnimationFrame(loop);
  window.scrollTo(0, 0);
}
function showHome() {
  if (mode && mode.stop) mode.stop(); mode = null; $('game').hidden = true; $('home').hidden = false; document.body.classList.remove('in-game'); document.documentElement.classList.remove('jr-hub-off');
  $('ov').hidden = true; $('ov')._h = ''; $('coach').hidden = true;
  if (/^#(latihan|cpu|demo)$/i.test(location.hash)) history.replaceState(history.state, '', location.pathname + location.search);
  renderBoard(); scheduleRooms();
}
function startLocal(o, keepTut) {
  o = Object.assign({ hp: pickedHp, bots: Number($('botsSelect').value) || 2 }, o || {});
  if (o.kind === 'ladder' && !keepTut && !local.get(TUT_KEY)) o = Object.assign({}, o, { kind: 'tut' });
  showGame(new LocalMatch(o));
}
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
const toLocal = (room, serverT) => performance.now() + (serverT - room.now());
class OnlineMatch extends Match {
  constructor() {
    super(); this.kind = 'online'; this.ended = false; this.resultAt = 0; this.recorded = null; this.outCard = false;
    this.room = new N.DuelRoom(net, CFG, { onChange: () => this.changed(), onNotice: onlineError, onTalk: ev => this.onTalk(ev), onOut: (id, gone) => this.onOut(id, gone), onRound: st => this.onRound(st), onClash: (l, s) => this.onClash(l, s) });
  }
  get meId() { return this.room.me; }
  spectator() { return !!(this.room.data && this.room.data.spectator); }
  title() { const d = this.room.data; return d ? t('roomTitle', { code: d.code }) : t('onlineTitle'); }
  sub() { const s = this.room.s; return s && s.settings ? t('roomSub', { hp: (s.start && this.room.inRound() ? s.start.hp : s.settings.hp) }) : ''; }
  phase() { const r = this.room, d = r.data; if (!d) return 'loading'; if (d.status === 'closed') return 'closed'; if (!N.supported(r.s) || !r.inRound()) return 'lobby'; return r.s.phase === 'over' ? 'over' : 'playing'; }
  seatList() {
    const r = this.room, s = r.s; if (!r.inRound()) return [];
    const st = s.start, imIn = r.amIn(), rd = s.rd, now = r.now();
    return st.ids.map((id, i) => { const o = (s.outs || []).find(x => x[0] === id), status = s.phase !== 'playing' || !rd || now < rd.at || o ? '' : r.locked(id) ? 'ready' : (rd.open || now > rd.dl ? '' : 'pick');
      return { id, name: st.names[i], av: st.avs[i] || AVS[i % AVS.length], color: SEAT[i % 4], hp: r.hpOf(id), max: st.hp, out: !!o, gone: !!(o && o[2]), me: imIn && id === r.me, status, conn: !o && r.presence(id) === 'lost' ? 'lost' : 'ok' }; });
  }
  stageInfo(now) {
    const r = this.room, s = r.s, rd = s.rd; if (!r.inRound()) return { ph: 'lobby', msg: '' }; if (s.phase === 'over' || !rd) return { ph: 'over', msg: '' };
    const at = toLocal(r, rd.at), dl = toLocal(r, rd.dl);
    if (now < at) return rd.n === 1 ? { ph: 'count', endsAt: at, total: RULES.countdownMs, msg: t('getReady') } : { ph: 'clash', n: rd.n - 1, msg: t('roundN', { n: rd.n - 1 }), big: '⚔' };
    if (!rd.open && now <= dl) return { ph: 'pick', n: rd.n, endsAt: dl, total: Math.max(1, dl - at), msg: !r.amAlive() ? t('watchPick') : r.myPick() >= 0 ? t('waitOthers') : t('pickNow') };
    return { ph: 'reveal', n: rd.n, msg: t('revealing'), big: '…' };
  }
  canPick() { return !this.sending && this.room.canPick(); }
  myPick() { const r = this.room; return r.s.rd && r.amAlive() ? r.myPick() : -1; }
  doPick(k) { this.sending = true; this.room.pick(k).then(res => { if (!res && this.room.myPick() < 0) toast(t('pickFail')); }).catch(e => toast(errMsg(e))).then(() => { this.sending = false; }); }
  onRound(st) { this.hpShown = new Map(); this.koPending = new Set(); this.revealed = new Map(); this.revealN = -1; this.ended = false; this.resultAt = 0; this.outCard = false; if (mode === this) { this.build(); FXL.clear(); } }
  onClash(last, s) {
    if (mode !== this) return;
    if (this.room.now() - last.at > 4500 || document.hidden) { this.revealed = new Map(last.picks); return; }
    const koNames = last.ko.map(id => this.room.nameOf(id)).join(', '), final = s.phase === 'over';
    const hit = this.runClash({ picks: last.picks, r: last.r, ko: last.ko, fb: last.fb, final, sub: last.ko.length ? t('koSub', { names: koNames }) : '' });
    if (final) this.resultAt = performance.now() + hit + 2400;
  }
  changed() {
    const r = this.room, s = r.s;
    if (s.phase === 'over' && r.inRound() && !this.ended) {
      this.ended = true; if (!this.resultAt) this.resultAt = performance.now() + 600;
      const res = s.result || {}, won = res.win === r.me && r.amIn();
      if (r.amIn() && this.recorded !== r.key) { this.recorded = r.key; bump(x => { x.online++; if (won) x.onlineWins++; }); }
      setTimeout(() => { if (mode !== this) return; SFX.play(won ? 'win' : 'lose'); if (res.win != null) { banner(won ? t('annWinner') : t('winnerIs', { name: r.nameOf(res.win) }), 'ann win', '', 2400); FXL.confetti(innerWidth / 2, innerHeight * 0.35, won ? 140 : 60); } }, Math.max(0, this.resultAt - performance.now() - 1800));
    }
    if (mode === this) { $('gTitle').textContent = this.title(); $('gSub').textContent = this.sub(); }
    updateConn();
  }
  onOut(id, gone) {
    if (id === this.room.me) { if (this.room.alive().length > 1) this.outCard = true; return; }
    if (gone) toast(t('playerGone', { name: this.room.nameOf(id) }));
  }
  onTalk(ev) {
    if (ev.playerId === this.room.me) return; const fresh = Date.now() - (Date.parse(ev.createdAt) || Date.now()) < 20000; if (!fresh) return;
    const p = ev.payload || {}; if (p.x === 'say') { const m = N.cleanText(p.m); if (m) this.showTalk(ev.playerId, 'say', m); } else if (p.x === 'emo') this.showTalk(ev.playerId, 'emo', String(p.k || ''));
  }
  talk(x, v) { return this.room.talk(x, x === 'say' ? { m: v } : { k: v }).then(() => true); }
  wake() { this.room.refresh().catch(onlineError); }
  tick() { const r = this.room; if (r.amAlive()) r.notice(document.hidden); else if (r.awayNote && !document.hidden) r.notice(false); r.tick(); }
  lobbyHTML(d) {
    const r = this.room, s = r.s, list = N.seated(d.players), need = Math.max(0, 2 - list.length), specs = d.players.filter(p => p.spectator).length, host = r.isHost(), hp = s.settings ? s.settings.hp : 5;
    const avOf = id => (s.avs.find(x => x[0] === id) || [])[1], mine = avOf(r.me);
    let html = '<div class="ov-card lobby"><h2>' + esc(t('lobbyTitle')) + '</h2><div class="code-row"><div class="code">' + esc(d.code) + '</div><button type="button" class="btn small yellow" data-act="copy">' + esc(t('copyInvite')) + '</button></div>';
    html += '<ul class="lobby-list">' + list.map((p, i) => '<li style="--c:' + SEAT[i % 4] + '"><span class="av">' + esc(avOf(p.id) || '❔') + '</span><span class="pn"><b></b>' + (p.id === r.me ? ' <em>' + esc(t('youBadge')) + '</em>' : '') + (s.hostId === p.id ? ' <em>' + esc(t('hostBadge')) + '</em>' : '') + '</span></li>').join('') + '</ul>';
    if (!d.spectator) { const box = document.createElement('div'); avPicker(box, mine, 'av'); html += '<p class="muted small">' + esc(t('pickAv')) + '</p><div class="av-pick" role="radiogroup">' + box.innerHTML + '</div>'; }
    const hb = document.createElement('div'); hpPicker(hb, hp, host ? 'hp' : '');
    html += '<p class="muted small">' + esc(t(host ? 'hpHost' : 'hpGuest')) + '</p><div class="hp-pick' + (host ? '' : ' ro') + '" role="radiogroup">' + (host ? hb.innerHTML : hb.innerHTML.replace(/<button /g, '<button disabled ')) + '</div>';
    html += '<p class="muted small">' + esc(t('lobbyCount', { n: list.length, max: d.maxPlayers }) + (specs ? ' · ' + t('spectatorsCount', { n: specs }) : '')) + '</p>';
    html += '<div class="ov-actions">' + (host ? '<button type="button" class="btn primary" data-act="start"' + (need ? ' disabled' : '') + '>' + esc(t('start')) + '</button>' : '') + '<button type="button" class="btn ghost" data-act="leave">' + esc(t('exit')) + '</button></div>';
    html += '<p class="muted small">' + esc(need ? t('lobbyNeed', { n: need }) : (host ? t('lobbyHostHint') : t('lobbyWaitHost'))) + '</p></div>';
    return { html, names: list.map(p => String(p.displayName || '')) , sel: '.lobby-list b' };
  }
  overlay() {
    const d = this.room.data, ph = this.phase();
    if (ph === 'loading') return '<div class="ov-card small"><p>' + esc(t('loading')) + '</p></div>';
    if (ph === 'closed') return '<div class="ov-card small"><h2>' + esc(t('closedTitle')) + '</h2><p>' + esc(t('closedText')) + '</p><div class="ov-actions"><button type="button" class="btn primary" data-act="home">' + esc(t('backHome')) + '</button></div></div>';
    if (ph === 'lobby') return this.lobbyHTML(d);
    if (ph === 'over' && performance.now() >= this.resultAt) {
      const r = this.room, s = r.s, res = s.result || {}, order = (res.order && res.order.length ? res.order : r.standings()), st = s.start, won = res.win === r.me && r.amIn();
      const rows = order.map((id, i) => { const j = st.ids.indexOf(id), o = (s.outs || []).find(x => x[0] === id); return '<li class="' + (id === r.me ? 'me' : '') + '"><span class="pl">' + (i + 1) + '</span><span class="av">' + esc(st.avs[j] || '') + '</span><b></b>' + (o && o[2] ? '<em class="gone-tag">' + esc(t('goneTag')) + '</em>' : '') + '<span>' + hearts(r.hpOf(id), st.hp) + '</span></li>'; }).join('');
      const head = res.win == null ? t('drawTitle') : won ? t('winTitle') : t('loseTitle'), host = r.isHost();
      return { html: '<div class="ov-card result"><div class="trophy" aria-hidden="true">' + (res.win == null ? '🤝' : won ? '🏆' : '💥') + '</div><h2>' + esc(head) + '</h2>' + (res.cap ? '<p class="muted small">' + esc(t('capNote')) + '</p>' : '') + '<ol class="standings">' + rows + '</ol><div class="ov-actions">' + (host ? '<button type="button" class="btn primary" data-act="rematch">' + esc(t('rematch')) + '</button>' : '<p class="muted small">' + esc(t('rematchWait')) + '</p>') + '<button type="button" class="btn ghost" data-act="leave">' + esc(t('exit')) + '</button></div></div>', names: order.map(id => r.nameOf(id)) };
    }
    if (ph === 'playing' && this.outCard) return '<div class="ov-card small out-card"><h2>' + esc(t('outTitle')) + '</h2><p>' + esc(t('outText')) + '</p><div class="ov-actions"><button type="button" class="btn primary" data-act="watch">' + esc(t('watchRest')) + '</button><button type="button" class="btn ghost" data-act="leave">' + esc(t('exit')) + '</button></div></div>';
    return '';
  }
  overlayAct(a, b) {
    const r = this.room;
    if (a === 'start') r.start(AVS).catch(e => toast(errMsg(e)));
    else if (a === 'av') { myAv = b.dataset.av; local.set('pedangsihir.av', myAv); r.pickAv(myAv).catch(e => toast(errMsg(e))); }
    else if (a === 'hp') { pickedHp = P.cleanHp(b.dataset.hp); local.set('pedangsihir.hp', String(pickedHp)); r.setHp(pickedHp).catch(e => toast(errMsg(e))); }
    else if (a === 'rematch') r.rematch().catch(e => toast(errMsg(e)));
    else if (a === 'copy') copyInvite(r.data.code);
    else if (a === 'watch') this.outCard = false;
    else if (a === 'leave' || a === 'home') r.leave().finally(showHome);
  }
  async exit() { if (this.room.amAlive() && !confirm(t('exitConfirm'))) return; try { await this.room.leave(); } catch (e) { /* ignore */ } showHome(); }
}
/* ----- home: online card ----- */
let onlineState = 'off', roomsTimer = 0, roomsAt = 0, roomList = [];
const ROOM_STALE_MS = 90000;
function setOnline(state, msg, isErr) { onlineState = state; document.querySelectorAll('.online-btn').forEach(b => { b.disabled = state !== 'ready'; }); note(msg || '', isErr); updateConn(); }
function note(msg, isErr) { const n = $('onlineNote'); n.textContent = msg; n.classList.toggle('err', !!isErr); }
function updateConn() {
  const c = $('conn'); let st = 'offline', label = t('connOffline');
  if (net.config && !net.stopped) { if (net.state === 'online') { st = 'online'; label = t('connOnline'); } else if (net.state === 'reconnecting') { st = 'reconnecting'; label = t('connReconnecting'); } else { st = 'reconnecting'; label = t('connConnecting'); } }
  c.dataset.state = st; c.textContent = label;
  const g = $('gConn'), show = !!(mode && mode.kind === 'online') && st !== 'online'; g.hidden = !show; if (show) g.textContent = st === 'offline' ? t('connOffline') : t('connLost');
}
function scheduleRooms() { if ($('home').hidden) return; clearTimeout(roomsTimer); roomsTimer = setTimeout(loadRooms, Math.max(0, 1500 - (Date.now() - roomsAt))); }
async function loadRooms() {
  if (onlineState !== 'ready' || $('home').hidden) { renderRooms(); return; }
  roomsAt = Date.now();
  try { const r = await net.rooms(); roomList = (r && Array.isArray(r.rooms)) ? r.rooms : []; } catch (e) { if (e.code !== 'busy') roomList = []; }
  renderRooms();
}
/** rooms nobody has touched for a while (host gone, tab frozen) are hidden: live rooms write at least every 10 s */
const freshRoom = r => { const u = Date.parse(r.updatedAt || ''); return !Number.isFinite(u) || net.serverNow() - u < ROOM_STALE_MS; };
function renderRooms() {
  const el = $('rooms');
  if (onlineState !== 'ready') { el.innerHTML = ''; return; }
  const list = roomList.filter(freshRoom);
  if (!list.length) { el.innerHTML = '<li class="muted">' + esc(t('roomsEmpty')) + '</li>'; return; }
  el.innerHTML = list.map(r => { const open = r.status === 'waiting' && r.seated < r.maxPlayers; return '<li class="room"><span><b>' + esc(r.code) + '</b><small>' + esc((r.status === 'waiting' ? t('roomWaiting') : t('roomPlaying')) + ' · ' + t('roomSeats', { n: r.seated, max: r.maxPlayers })) + '</small></span><button type="button" class="btn small ' + (open ? 'teal' : 'ghost') + '" data-room="' + esc(r.code) + '" data-kind="' + (open ? 'join' : 'watch') + '">' + esc(open ? t('join') : t('watch')) + '</button></li>'; }).join('');
}
$('rooms').addEventListener('click', e => { const b = e.target.closest('[data-room]'); if (!b) return; $('codeInput').value = b.dataset.room; go(b.dataset.kind, b.dataset.room); });
let entering = false;
function joinFail(e) { return { ok: false, missing: e.status === 404 || e.status === 422, retry: e.code === 'network' || e.code === 'busy' || e.status === 429, message: errMsg(e) }; }
async function go(kind, code) {
  if (entering || onlineState !== 'ready') return { ok: false, retry: true };
  const name = $('nameInput').value.replace(/\s+/g, ' ').trim().slice(0, 24);
  if (!name) { note(t('errName'), true); $('nameInput').focus(); return { ok: false, retry: true, message: t('errName') }; }
  if ((kind === 'join' || kind === 'watch') && !/^[A-Z2-9]{6}$/.test(code || '')) { note(t('errCode'), true); $('codeInput').focus(); return { ok: false, missing: true }; }
  local.set('pedangsihir.name', name); entering = true; document.querySelectorAll('.online-btn').forEach(b => { b.disabled = true; });
  const m = new OnlineMatch(), opts = { displayName: name, code, maxPlayers: Math.max(2, Math.min(4, Number($('maxSelect').value) || 4)), settings: { hp: pickedHp } };
  const afterEnter = () => { note(''); showGame(m); if (!m.spectator() && m.room.s.phase !== 'playing') m.room.pickAv(myAv).catch(() => { /* pick again in the lobby */ }); };
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
const saveName = () => { const n = $('nameInput').value.replace(/\s+/g, ' ').trim().slice(0, 24); if (n) local.set('pedangsihir.name', n); };
$('ladderStart').addEventListener('click', () => { saveName(); startLocal({ kind: 'ladder' }); });
$('partyStart').addEventListener('click', () => { saveName(); startLocal({ kind: 'party' }); });
$('tutorialStart').addEventListener('click', () => { saveName(); startLocal({ kind: 'tut' }); });
/* ----- game screen input ----- */
$('skills').addEventListener('click', e => { const b = e.target.closest('.sk'); if (b && mode) mode.pick(Number(b.dataset.k)); });
document.addEventListener('keydown', e => { if (!mode || e.ctrlKey || e.metaKey || e.altKey || /input|textarea|select/i.test((e.target && e.target.tagName) || '')) return; const k = '123'.indexOf(e.key); if (k >= 0) { mode.pick(k); e.preventDefault(); } else if (e.key === 'Escape' && !$('chat').hidden) $('chat').hidden = true; });
$('emoBar').addEventListener('click', e => { const b = e.target.closest('button'); if (!b || !mode) return; if (b.id === 'chatBtn') { const c = $('chat'); c.hidden = !c.hidden; b.setAttribute('aria-expanded', String(!c.hidden)); if (!c.hidden && matchMedia('(pointer: fine)').matches) $('chatInput').focus(); return; } if (b.dataset.emo) mode.emo(b.dataset.emo); });
$('chatQuick').addEventListener('click', e => { const b = e.target.closest('[data-say]'); if (!b || !mode) return; mode.say(b.dataset.say); $('chat').hidden = true; });
$('chatForm').addEventListener('submit', e => { e.preventDefault(); const v = $('chatInput').value; if (!mode || !N.cleanText(v)) return; mode.say(v); $('chatInput').value = ''; $('chat').hidden = true; });
$('chatClose').addEventListener('click', () => { $('chat').hidden = true; });
$('exitBtn').addEventListener('click', () => { if (mode) mode.exit(); });
$('muteBtn').addEventListener('click', () => { const m = SFX.toggle(); $('muteBtn').textContent = m ? '🔇' : '🔊'; $('muteBtn').setAttribute('aria-label', t(m ? 'unmute' : 'mute')); });
$('tutSkip').addEventListener('click', () => { if (mode && mode.skipTut) mode.skipTut(); });
$('ov').addEventListener('click', e => { const b = e.target.closest('[data-act]'); if (!b || !mode || b.disabled) return; SFX.play('click'); mode.overlayAct(b.dataset.act, b); });
$('brandLink').addEventListener('click', e => { if (mode) { e.preventDefault(); mode.exit(); } });
function route() { const h = location.hash.toLowerCase(); if (mode) return; if (h === '#latihan' || h === '#cpu') startLocal({ kind: 'ladder' }); else if (h === '#demo') startLocal({ kind: 'demo', bots: 3, hp: 5 }); }
window.addEventListener('hashchange', route);
/* ---------------- boot ---------------- */
$('nameInput').value = local.get('pedangsihir.name') || '';
applyText();
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
  code: invite, lang: 'id', gameName: (CFG.site && CFG.site.name) || '', nameKey: 'pedangsihir.name', nameMax: 24, accent: '#b45cff',
  check: async c => { const st = await onlineReady; if (st === 'offline') return 'offline'; if (st !== 'ready') return { fallback: st }; if (mode && mode.kind === 'online' && net.code === c) return 'session'; return net.probe(c); },
  join: name => { $('nameInput').value = name; $('codeInput').value = invite; return go('join', invite); },
  fallback: msg => { $('codeInput').value = ''; if (msg) note(msg, true); if (!mode) { const p = $('play'); if (p) p.scrollIntoView({ block: 'start' }); if (net.code && net.token && onlineState === 'ready') resumeSaved(); } }
});
window.addEventListener('online', () => { if (onlineState === 'ready') net.visible(); });
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && onlineState === 'ready') net.visible(); if (mode && mode.kind === 'online') mode.tick(); });
/* closing the tab / navigating away (back, Game Hub, reload): best-effort keepalive leave. The server drops me from the
   player list, so the others eliminate me at once ('Keluar') or free my lobby seat. If that request is lost, the
   quiet-player rule (16 s) still ends my part of the match. A page restored from the back/forward cache goes to the menu. */
let leftByPagehide = false;
window.addEventListener('pagehide', () => { if (mode && mode.kind === 'online' && mode.room.data && mode.room.data.status !== 'closed') { leftByPagehide = mode.room.leaveNow(); } });
window.addEventListener('pageshow', e => { if (e.persisted && leftByPagehide) { leftByPagehide = false; if (mode && mode.kind === 'online') { showHome(); toast(t('leftRoom')); } } });
window.PSApp = { get mode() { return mode; }, net, startLocal, showHome, SFX, FX: FXL, board, addRun, TUT };
})();

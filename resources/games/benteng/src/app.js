(function () {
'use strict';
const BK = window.BK, N = window.BKNet, RD = window.BKRender, $ = id => document.getElementById(id);
let CFG; try { CFG = JSON.parse($('website-config').textContent); } catch (e) { CFG = {}; }
CFG.text = CFG.text || {}; CFG.towers = CFG.towers || {}; CFG.monsters = CFG.monsters || {}; CFG.players = CFG.players || {};
const world = BK.makeWorld(CFG.game), E = world.eco, COLORS = CFG.players.colors || RD.SEAT;
const TOWERS = ['ketapel', 'meriam', 'sate', 'kentongan', 'petasan', 'barong'], MONSTERS = ['tuyul', 'pocong', 'kuntilanak', 'genderuwo', 'ratu'];
const PINGS = CFG.pings || [{ k: 'tolong', icon: '🆘' }, { k: 'sini', icon: '📍' }, { k: 'awas', icon: '⚠️' }];
const local = { get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* private mode */ } } };
let session = null; try { session = window.sessionStorage; } catch (e) { session = null; }
const reduced = window.matchMedia ? matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
function t(key, vars) { let s = CFG.text[key]; if (s === undefined) s = key; if (vars) s = String(s).replace(/\{(\w+)\}/g, (m, n) => (vars[n] !== undefined ? vars[n] : m)); return s; }
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const cfgPath = p => p.split('.').reduce((o, k) => (o ? o[k] : undefined), CFG);
const tName = k => (CFG.towers[k] && CFG.towers[k].name) || k, mName = k => (CFG.monsters[k] && CFG.monsters[k].name) || k;
const coins = c => Math.floor(c / 100);
const mmss = ticks => { const s = Math.max(0, Math.ceil(ticks / BK.TPS)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
function setHTML(el, html) { if (el._h !== html) { el._h = html; el.innerHTML = html; } }
let toastTimer;
function toast(msg) { const el = $('toast'); el.textContent = msg; el.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => { el.hidden = true; }, 3200); }
function errMsg(e) {
  if (!e) return '';
  if (e.code === 'busy' || e.status === 429) return t('errBusy', { n: e.wait || 10 });
  if (e.code === 'few') return t('errFew');
  if (e.code === 'late') return t('errLate');
  if (e.code === 'budget') return t('errBudget');
  if (e.code === 'slow') return t('errSlow');
  if (CFG.text['why_' + e.code]) return t('why_' + e.code);
  if (e.code === 'network' || e.code === 'offline') return t('errNetwork');
  if (e.status === 404) return t('errNotFound');
  if (e.status === 409) return /full/i.test(e.server || '') ? t('errFull') : t('errNotOpen');
  if (e.status === 403) return t('errMember');
  return t('errGeneric', { m: e.server || e.message || e.code || '?' });
}

/* ================= leaderboard (this device only: the platform has no cross-room storage) ================= */
const LB_KEY = 'benteng.lb';
function lbLoad() { try { const v = JSON.parse(local.get(LB_KEY) || '{}'); return v && typeof v === 'object' ? v : {}; } catch (e) { return {}; } }
function lbAdd(n, entry) {
  const all = lbLoad(), list = Array.isArray(all[n]) ? all[n] : [];
  if (list.some(x => x.id === entry.id)) return list.findIndex(x => x.id === entry.id);
  list.push(entry); list.sort((a, b) => b.score - a.score || b.wave - a.wave || a.at - b.at); all[n] = list.slice(0, 10); local.set(LB_KEY, JSON.stringify(all));
  return all[n].findIndex(x => x.id === entry.id);
}
/** endless board: highest wave first (then score), separate per player count */
const LBX_KEY = 'benteng.lbx';
function lbxLoad() { try { const v = JSON.parse(local.get(LBX_KEY) || '{}'); return v && typeof v === 'object' ? v : {}; } catch (e) { return {}; } }
function lbxAdd(n, entry) {
  const all = lbxLoad(), list = Array.isArray(all[n]) ? all[n] : [];
  if (!list.some(x => x.id === entry.id)) { list.push(entry); list.sort((a, b) => b.wave - a.wave || b.score - a.score || a.at - b.at); all[n] = list.slice(0, 10); local.set(LBX_KEY, JSON.stringify(all)); }
  return (all[n] || []).findIndex(x => x.id === entry.id);
}
let lbTab = 1, lbMode = 0;
const lbDate = x => new Date(x.at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
function renderLB() {
  const list = ((lbMode ? lbxLoad() : lbLoad())[lbTab] || []);
  document.querySelectorAll('#lbTabs button').forEach(b => b.setAttribute('aria-selected', String(Number(b.dataset.n) === lbTab)));
  document.querySelectorAll('#lbModes button').forEach(b => b.setAttribute('aria-selected', String(Number(b.dataset.m) === lbMode)));
  $('lbList').innerHTML = list.length ? list.map((x, i) => '<li><span class="rk">' + (i + 1) + '</span><span class="who">' + esc(x.names.join(', ')) + '<small>' + esc(lbDate(x) + ' · ' + (lbMode ? x.score.toLocaleString('id-ID') + ' ★' : x.win ? t('lbWin') : t('lbWave', { w: x.wave }))) + '</small></span><b>' + (lbMode ? '♾️ ' + x.wave : x.score.toLocaleString('id-ID')) + '</b></li>').join('') : '<li class="muted">' + esc(t('lbEmpty')) + '</li>';
}

/* ================= v2 data ================= */
const HEROES = BK.HEROES, HC = CFG.heroes || {}, BCARDS = CFG.berkah || {}, CHAT = CFG.chat || [], EMOJI = CFG.emojis || [], CB = CFG.combined || {};
const hName = h => (HC[h] && HC[h].name) || h, hSkill = h => (HC[h] && HC[h].skill) || h, hText = h => (HC[h] && HC[h].text) || '', hColor = h => RD.HERO_COL[h] || '#555';
const bName = k => (BCARDS[k] && BCARDS[k].name) || k, bIcon = k => (BCARDS[k] && BCARDS[k].icon) || '✨', bText = k => (BCARDS[k] && BCARDS[k].text) || '';

/* ================= sound: tiny WebAudio synth, no files ================= */
/* ---------- chat room: plain text only, capped, profanity masked (ID/EN, light leetspeak) ---------- */
const SAY_MAX = N.SAY_MAX || 120, cleanText = N.cleanText || (v => String(v || '').trim().slice(0, 120));
const BAD = ['anjing', 'anjir', 'anjrit', 'bangsat', 'bajingan', 'babi', 'kontol', 'memek', 'ngentot', 'entot', 'jancok', 'jancuk', 'cok', 'asu', 'goblok', 'goblog', 'tolol', 'kampret', 'tai', 'taik', 'keparat', 'pepek', 'lonte', 'pelacur', 'perek', 'bego', 'idiot', 'fuck', 'fucker', 'shit', 'bitch', 'asshole', 'dick', 'cunt', 'bastard', 'pussy', 'motherfucker', 'wtf'];
const LEET = { a: 'a4@', i: 'i1!', o: 'o0', e: 'e3', s: 's5$', u: 'uv', t: 't7' };
const BAD_RE = new RegExp('(^|[^a-z0-9])(' + BAD.map(w => w.split('').map(c => '[' + (LEET[c] || c) + ']+').join('') + (w.length >= 5 ? '[a-z]*' : '')).join('|') + ')(?![a-z0-9])', 'gi');
function mask(v) { return String(v).replace(BAD_RE, (m, pre, w) => pre + w[0] + '*'.repeat(w.length - 1)); }
const SFX = (() => {
  let ctx = null, master = null, nbuf = null, muted = local.get('benteng.mute') === '1';
  const last = {}, GAP = { ketapel: 70, petasan: 90, barong: 110, meriam: 110, kill: 70, coin: 100, hit: 80, tap: 60, chat: 150 };
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
    ketapel: () => tone('triangle', 560, 240, 0.07, 0.1),
    meriam: () => { hiss(0.3, 0.32, 'lowpass', 420); tone('sine', 150, 45, 0.28, 0.35); },
    petasan: () => { hiss(0.07, 0.16, 'highpass', 2600); hiss(0.05, 0.12, 'highpass', 3400, 0.06); },
    barong: () => tone('sawtooth', 240, 180, 0.08, 0.05),
    hit: () => { hiss(0.12, 0.3, 'lowpass', 900); tone('square', 200, 70, 0.14, 0.12); },
    kill: () => tone('square', 620, 940, 0.05, 0.05),
    coin: () => { tone('triangle', 988, 988, 0.05, 0.08); tone('triangle', 1319, 1319, 0.1, 0.08, 0.05); },
    build: () => { hiss(0.09, 0.2, 'lowpass', 700); tone('triangle', 392, 523, 0.12, 0.14, 0.04); },
    up: () => [523, 659, 784].forEach((f, i) => tone('triangle', f, f, 0.1, 0.13, i * 0.07)),
    wave: () => [0, 0.2].forEach(a => { tone('sine', 820, 700, 0.14, 0.28, a); hiss(0.05, 0.18, 'bandpass', 1800, a, 4); }),
    boss: () => { tone('sawtooth', 110, 80, 1.1, 0.16); tone('sawtooth', 166, 120, 1.1, 0.09); hiss(1, 0.12, 'lowpass', 300); },
    dukun: () => [1568, 2093, 2637, 3136].forEach((f, i) => tone('sine', f, f, 0.3, 0.07, i * 0.05)),
    jawara: () => { tone('sawtooth', 180, 420, 0.3, 0.12); hiss(0.3, 0.12, 'bandpass', 900, 0, 1.5); },
    juragan: () => [1047, 1319, 1568, 2093].forEach((f, i) => tone('triangle', f, f, 0.12, 0.1, i * 0.06)),
    pendekar: () => { hiss(0.16, 0.25, 'bandpass', 1400, 0, 1); tone('square', 260, 60, 0.2, 0.16, 0.04); },
    open: () => [440, 660, 880].forEach((f, i) => tone('square', f, f, 0.08, 0.06, i * 0.06)),
    join: () => tone('square', 660, 990, 0.1, 0.07),
    gab: () => { [262, 330, 392, 523].forEach(f => tone('sawtooth', f, f * 1.02, 0.7, 0.06)); hiss(0.7, 0.3, 'lowpass', 900, 0.1); tone('sine', 120, 40, 0.6, 0.35, 0.1); },
    fizzle: () => tone('triangle', 400, 180, 0.3, 0.1),
    deal: () => [0, 0.08, 0.16].forEach(a => hiss(0.05, 0.12, 'bandpass', 2400, a, 3)),
    vote: () => tone('triangle', 700, 940, 0.08, 0.1),
    berkah: () => [659, 880, 1175].forEach((f, i) => tone('triangle', f, f, 0.16, 0.12, i * 0.08)),
    chat: () => tone('sine', 880, 1180, 0.07, 0.08),
    ask: () => { tone('square', 740, 740, 0.08, 0.06); tone('square', 988, 988, 0.1, 0.06, 0.1); },
    leak: () => tone('sawtooth', 170, 90, 0.25, 0.12),
    win: () => [523, 659, 784, 1047].forEach((f, i) => tone('triangle', f, f, 0.28, 0.15, i * 0.13)),
    lose: () => [392, 330, 262, 196].forEach((f, i) => tone('triangle', f, f * 0.97, 0.32, 0.13, i * 0.18)),
    tap: () => tone('sine', 620, 620, 0.03, 0.04)
  };
  return {
    get muted() { return muted; },
    toggle() { muted = !muted; local.set('benteng.mute', muted ? '1' : '0'); if (!muted) { init(); if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {}); } },
    unlock() { if (muted) return; init(); if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {}); },
    play(k) { if (muted || !ctx || ctx.state !== 'running' || document.hidden || !S[k]) return; const now = performance.now(); if (now - (last[k] || 0) < (GAP[k] || 40)) return; last[k] = now; try { S[k](); } catch (e) { /* audio is optional */ } }
  };
})();
document.addEventListener('pointerdown', () => SFX.unlock(), true);

/* ================= game screen ================= */
const map = new RD.MapView($('map'), world);
let mode = null, raf = 0, lastHud = 0, sel = { kind: null }, hover = -1, banner = { text: '', until: 0 };
const ui = { lastWave: 0, lastPh: '', overShown: false, recorded: null, overSfx: null, voteMin: null, myCell: -1 };
/** team talk shown on the map: chat log, bubbles, pings, teammates' cursors, coin requests */
const talk = { log: [], bubbles: [], pings: [], cursors: new Map(), ask: null, room: [], unread: 0 };
function resetTalk() { talk.log = []; talk.bubbles = []; talk.pings = []; talk.cursors.clear(); talk.ask = null; talk.room = []; talk.unread = 0; }
function mySeat(s) { const p = s && mode ? BK.player(s, mode.me) : null; return p ? p.s : null; }
function nameOf(id) { return mode ? mode.name(id) : '—'; }
function colorOf(s, id) { const p = s ? BK.player(s, id) : null; if (p) return COLORS[p.s]; const d = mode && mode.game && mode.game.data; if (d) { const i = N.seated(d.players).findIndex(x => Number(x.id) === Number(id)); if (i >= 0) return COLORS[i % 4]; } return '#999'; }
function fit() {
  if (!mode) return;
  const wrap = $('stageWrap'), w = wrap.clientWidth, h = wrap.clientHeight;
  if (!w || !h) return;
  const cs = Math.max(14, Math.floor(Math.min(w / world.W, h / world.H))), s = mode.state(), n = s ? s.n : 1;
  if (map.cs !== cs || map.n !== n) map.resize(cs, n);
}
const multiOf = s => !!s && BK.present(s).length > 1;
/** where a player "is": their last cursor / action cell, else a corner by seat (so bubbles always have a home) */
function avatarCell(s, id) {
  if (mode && id === mode.me && ui.myCell >= 0) return ui.myCell;
  const cu = talk.cursors.get(id); if (cu && cu.c >= 0) return cu.c;
  const p = s && BK.player(s, id), seat = p ? p.s : 0, W = world.W, H = world.H;
  return [W + 1, W + W - 2, (H - 2) * W + 1, (H - 2) * W + W - 2][seat % 4];
}
function seen(id, c) { if (!mode || id === mode.me || !BK.onMap(world, c)) return; talk.cursors.set(id, { c, at: performance.now() }); }
function logLine(id, text) { talk.log.push({ id, text, at: performance.now() }); if (talk.log.length > 6) talk.log.shift(); renderChatLog(true); }
/** the chat room list (lobby + game); unread counts while the drawer is closed */
function roomAdd(s, id, text) {
  talk.room.push({ id, text, name: nameOf(id), color: colorOf(s, id), at: performance.now() }); if (talk.room.length > 40) talk.room.shift();
  if (!chatShown() && mode && id !== mode.me) talk.unread++;
  renderChat();
}
function say(s, id, text, c) {
  const cell = BK.onMap(world, c) ? c : avatarCell(s, id), short = text.length > 34 ? text.slice(0, 32).trim() + '…' : text;
  talk.bubbles = talk.bubbles.filter(b => b.id !== id); talk.bubbles.push({ id, c: cell, text: short, color: colorOf(s, id), born: performance.now(), life: 2600 + Math.min(4000, text.length * 60) });
  logLine(id, short); roomAdd(s, id, text);
}
/** a talk event (ours echoed locally, theirs from the socket); payload is untrusted: whitelist everything */
function handleTalk(s, id, x, P) {
  if (!s) { // lobby: no map yet, only the chat room
    const text = x === 'say' ? mask(cleanText(P.m)) : x === 'chat' ? ((CHAT.find(q => q.k === P.k) || {}).text || '') : x === 'emo' ? (EMOJI[P.n] || '') : '';
    if (text) { roomAdd(null, id, text); if (mode && id !== mode.me) SFX.play('chat'); }
    return;
  }
  const me = mode && mode.me, c = Number.isInteger(P.c) && BK.onMap(world, P.c) ? P.c : null, now = performance.now();
  if (c != null) seen(id, c);
  switch (x) {
    case 'cur': return;
    case 'ping': { const p = PINGS.find(q => q.k === P.k) || PINGS[0]; if (c == null) return; talk.pings.push({ c, icon: p.icon, color: colorOf(s, id), born: now, life: 4500 }); if (talk.pings.length > 8) talk.pings.shift(); logLine(id, p.icon + ' ' + t('ping_' + p.k)); if (id !== me) { vibrate(20); SFX.play('chat'); } return; }
    case 'chat': { const it = CHAT.find(q => q.k === P.k); if (!it) return; say(s, id, it.text, c); SFX.play('chat'); if (id !== me) vibrate(12); return; }
    case 'say': { const m = mask(cleanText(P.m)); if (!m) return; say(s, id, m, c); SFX.play('chat'); if (id !== me) vibrate(12); return; }
    case 'emo': { const e = EMOJI[P.n]; if (e === undefined) return; say(s, id, e, c); SFX.play('chat'); return; }
    case 'ask': if (id === me) { toast(t('askSent')); logLine(id, t('askLog')); } else { talk.ask = { from: id, at: now }; logLine(id, t('askLog')); SFX.play('ask'); vibrate(30); } return;
  }
}
function sendTalk(x, fields) {
  const m = mode; if (!m) return; const s = m.state();
  m.talk(x, fields).then(r => { if (r !== null) handleTalk(m.state(), m.me, x, fields || {}); tipDone('chat'); }).catch(e => { if (e && e.code === 'slow') toast(t('errSlowTalk')); else if (e && e.code !== 'busy') toast(errMsg(e)); });
}
function addFx(list, s) {
  const now = performance.now(), me = mode ? mode.me : null;
  map.fx(list, s, now);
  for (const f of list) {
    switch (f.t) {
      case 'shot': SFX.play(f.k === 'petasan' ? 'petasan' : f.k === 'barong' ? 'barong' : 'ketapel'); break;
      case 'boom': SFX.play('meriam'); break;
      case 'hit': SFX.play('hit'); break;
      case 'kill': SFX.play('kill'); SFX.play('coin'); break;
      case 'built': seen(f.p, f.c); if (f.p === me) { SFX.play('build'); tipDone('build'); } if (f.k === 'barong') showBanner(t('bannerBarong')); break;
      case 'up': seen(f.p, f.c); if (f.p === me) SFX.play('up'); break;
      case 'leak': if (f.stolen) toast(t('toastStolen', { n: (f.stolen / 100).toFixed(0) })); vibrate(30); SFX.play('leak'); break;
      case 'wave': { const plan = BK.wavePlan(world, s, f.w), boss = plan.some(g => g.k === 'ratu'), mul = s && s.x ? (s.em / 10000).toFixed(1).replace('.', ',') : '';
        showBanner(s && s.x ? t(boss ? 'bannerEndlessBoss' : 'bannerEndless', { w: f.w, m: mul }) : boss ? t('bannerBoss', { w: f.w }) : t('bannerWave', { w: f.w }), monIcons(plan, 24)); SFX.play('wave'); break; }
      case 'won': SFX.play('win'); vibrate(60); break;
      case 'endless': showBanner(t('bannerEndlessStart')); SFX.play('berkah'); vibrate(40); break;
      case 'exVote': if (f.p !== me) SFX.play('vote'); break;
      case 'boss': showBanner(t('bannerBossCome')); SFX.play('boss'); vibrate(60); break;
      case 'waveEnd': if (f.w !== world.waves.length) showBanner(t(f.clean ? 'bannerClean' : 'bannerWaveEnd', { n: (f.per / 100).toFixed(0) })); break;
      case 'early': toast(t('toastEarly', { n: Math.floor(f.per / 100) })); break;
      case 'give': if (f.to === me) { toast(t('toastGot', { name: nameOf(f.p), n: f.n })); SFX.play('coin'); } else if (f.p === me) toast(t('toastGave', { name: nameOf(f.to), n: f.n })); if (talk.ask && f.p === me && f.to === talk.ask.from) talk.ask = null; break;
      case 'chip': seen(f.p, f.c); if (f.p !== me) toast(t('toastChip', { name: nameOf(f.p), n: f.n })); break;
      case 'found': seen(f.p, f.c); if (f.p !== me) toast(t('toastFound', { name: nameOf(f.p) })); break;
      case 'gone': toast(f.p === me ? t('toastYouGone') : t('toastGone', { name: nameOf(f.p) })); break;
      case 'back': toast(t('toastBack', { name: nameOf(f.p) })); break;
      case 'deny': if (f.p === me) toast(t('why_' + f.why)); break;
      case 'skill': { if (f.c != null) seen(f.p, f.c); SFX.play(f.h); if (f.p === me) tipDone('skill'); else if (s && s.n > 1) logLine(f.p, '⚡ ' + hSkill(f.h) + '!'); break; }
      case 'sgOpen': if (f.p !== me) { showBanner(t('gabOpen', { name: nameOf(f.p) })); vibrate(40); } SFX.play('open'); break;
      case 'sgJoin': SFX.play('join'); if (f.p === me) tipDone('gab'); break;
      case 'sgFire': showBanner(t('gabFire', { n: f.ps.length })); SFX.play('gab'); vibrate(80); break;
      case 'sgFizzle': if (f.ps.includes(me)) toast(t('gabFizzle')); SFX.play('fizzle'); break;
      case 'deal': SFX.play('deal'); break;
      case 'vote': if (f.p === me) tipDone('vote'); else SFX.play('vote'); break;
      case 'berkah': showBanner(t(f.tie ? 'voteTie' : 'voteWon', { name: bIcon(f.k) + ' ' + bName(f.k) })); SFX.play('berkah'); break;
    }
  }
}
function vibrate(ms) { try { if (navigator.vibrate && !reduced.matches && navigator.userActivation && navigator.userActivation.hasBeenActive) navigator.vibrate(ms); } catch (e) { /* ignore */ } }
/** banner: a line of text, optionally with the incoming monsters (icon × count) */
function showBanner(text, icons) { banner = { text, until: performance.now() + 2200 }; const b = $('banner'); b.innerHTML = '<span>' + esc(text) + '</span>' + (icons ? '<span class="bm">' + icons + '</span>' : ''); b.classList.toggle('wide', !!icons); b.classList.remove('show'); void b.offsetWidth; b.classList.add('show'); }
function monCount(groups) { const cnt = {}; for (const g of groups) cnt[g.k] = (cnt[g.k] || 0) + (g.n || 1); return cnt; }
function monIcons(groups, size) { const cnt = monCount(groups); return Object.keys(cnt).map(k => '<span class="mw" title="' + esc(mName(k)) + '">' + img('m', k, size) + '×' + cnt[k] + '</span>').join(''); }
function selCell(s) {
  if (sel.kind === 'build' || sel.kind === 'ping' || sel.kind === 'found') return sel.c;
  if (sel.kind === 'tower') { const tw = s.tw.find(x => x.i === sel.i); return tw ? tw.c : -1; }
  if (sel.kind === 'fd') return sel.c;
  return -1;
}
function loop(now) {
  raf = 0; if (!mode) return;
  const fx = [], s = mode.update(fx);
  if (fx.length) addFx(fx, s);
  if (s) {
    const me = BK.player(s, mode.me), selTower = sel.kind === 'tower' ? sel.i : null, preview = sel.kind === 'build' && sel.k ? { c: sel.c, r: BK.range(world, s, sel.k, 0) } : null;
    const dg = drag && drag.on ? drag : null;
    const hc = dg ? -1 : mode.canAct() ? hover : -1;
    let hoverOk = false; if (hc >= 0) hoverOk = sel.kind === 'skill' || sel.kind === 'pingMode' || (BK.isBuildable(world, hc) && !BK.occupied(s, hc));
    let skillAim = null; if (sel.kind === 'skill' && me) { const H = world.HR[me.h] || {}; skillAim = { c: hc >= 0 ? hc : (sel.c != null ? sel.c : -1), r: H.r || 100, color: hColor(me.h) }; }
    const sc = selCell(s); if (sc >= 0 && sc !== ui.myCell) { ui.myCell = sc; if (mode.cursor) mode.cursor(sc); }
    talk.pings = talk.pings.filter(p => now - p.born < p.life); talk.bubbles = talk.bubbles.filter(b => now - b.born < b.life);
    const cursors = []; for (const [id, cu] of talk.cursors) { const age = now - cu.at, p = BK.player(s, id); if (!p || p.g || age > 60000) continue; cursors.push({ c: cu.c, color: COLORS[p.s], label: nameOf(id), alpha: age < 12000 ? 1 : 0.4 }); }
    let ghost = null; if (dg) { const r = $('map').getBoundingClientRect(); ghost = { k: dg.k, c: dg.c, ok: dg.ok, r: BK.range(world, s, dg.k, 0), x: dg.x - r.left, y: dg.y - dg.off - r.top }; }
    const guide = tut.on && mode.kind === 'practice' ? tutTick(s) : null;
    checkMonsters(s);
    map.draw({ s, prev: mode.prev(), alpha: mode.alpha(), now, me: mode.me, sel: sc >= 0 && sel.kind !== 'tower' ? sc : null, selTower, preview, hover: hc, hoverOk, skillAim, pings: talk.pings, cursors, bubbles: talk.bubbles, ghost, guide });
    if (sel.kind === 'tower' && !s.tw.some(x => x.i === sel.i)) sel = { kind: null };
    if (sel.kind === 'fd' && !s.fd.some(x => x.i === sel.i)) { const b = s.tw.find(x => x.c === sel.c && x.k === 'barong'); sel = b ? { kind: 'tower', i: b.i } : { kind: null }; }
    if (BK.over(s)) { const id = mode.gameId(); if (ui.overSfx !== id) { ui.overSfx = id; SFX.play(s.ph === 'win' ? 'win' : 'lose'); } }
  }
  if (now - lastHud > 120) { lastHud = now; renderHud(s); }
  raf = requestAnimationFrame(loop);
}
function start() { if (!raf) raf = requestAnimationFrame(loop); }

/* ---------- HUD + panel ---------- */
const img = (kind, k, size) => '<img alt="" src="' + RD.icon(kind, k, size) + '" width="' + size + '" height="' + size + '">';
function renderHud(s) {
  const m = mode; if (!m) return;
  const ph = m.phase(), me = s ? BK.player(s, m.me) : null;
  fit();
  $('game').dataset.phase = ph;
  let wave = '', timer = '';
  if (s) { const wn = Math.max(1, s.w + (s.ph === 'prep' || s.ph === 'break' ? 1 : 0)); wave = s.x ? t('hudEndless', { w: wn }) : t('hudWave', { w: Math.min(wn, world.waves.length), n: world.waves.length }); if (s.ph === 'prep' || s.ph === 'break') timer = mmss(s.tm); }
  setHTML($('hudStats'), s ? '<span class="st lives' + (s.lives <= 5 ? ' low' : '') + '" title="' + esc(t('hudLives')) + '">❤️ <b>' + s.lives + '</b></span><span class="st wave' + (s.x ? ' endless' : '') + '">' + (s.x ? '♾️' : '🌊') + ' <b>' + esc(wave) + '</b></span>' + (timer ? '<span class="st timer">⏱ <b>' + timer + '</b></span>' : '') + '<span class="st score" title="' + esc(t('hudScore')) + '">★ <b>' + s.sc.toLocaleString('id-ID') + '</b></span>' + (me ? '<span class="st coins" title="' + esc(t('hudCoins')) + '">🪙 <b>' + coins(me.c) + '</b></span>' : '') : '');
  const snd = '<button type="button" class="hbtn" data-act="mute" aria-pressed="' + SFX.muted + '" aria-label="' + esc(SFX.muted ? t('soundOff') : t('soundOn')) + '">' + (SFX.muted ? '🔇' : '🔊') + '</button>';
  setHTML($('hudTools'), (m.kind === 'practice' ? '<button type="button" class="hbtn" data-act="pause" aria-label="' + esc(m.paused ? t('resume') : t('pause')) + '">' + (m.paused ? '▶' : '⏸') + '</button><button type="button" class="hbtn" data-act="speed" aria-label="' + esc(t('speed')) + '">' + m.speed + '×</button>' : '<span class="netdot" data-state="' + esc(m.netState()) + '" title="' + esc(m.netLabel()) + '"></span>') + snd + '<button type="button" class="hbtn" data-act="exit" aria-label="' + esc(t('exit')) + '">✕</button>');
  const team = s && s.n > 1 ? s.pl.map(p => { const mine = p.id === m.me, can = !mine && !p.g && me && !me.g && m.canAct(); return '<button type="button" class="chip' + (p.g ? ' gone' : '') + (mine ? ' me' : '') + '" style="--c:' + COLORS[p.s] + '"' + (can ? ' data-act="give" data-to="' + p.id + '"' : ' disabled') + ' aria-label="' + esc((can ? t('giveTo', { name: nameOf(p.id) }) : nameOf(p.id)) + ' · ' + hName(p.h)) + '">' + img('h', p.h, 18) + '<span class="nm">' + esc(nameOf(p.id)) + (mine ? ' ' + esc(t('youShort')) : '') + '</span><span class="cn">' + (p.g ? esc(t('goneShort')) : '🪙' + coins(p.c)) + '</span>' + ((s.ph === 'prep' || s.ph === 'break') && p.r ? '<span class="rd">✓</span>' : '') + '</button>'; }).join('') : '';
  setHTML($('team'), team); $('team').hidden = !team;
  renderBar(s); renderPanel(s); renderOverlay(s); renderVote(s); renderAsk(s); renderChatLog(false); renderTip(s); renderChat(); renderDragCard(s);
  fit(); // again: HUD/side content just changed size
}
/** action bar: hero skill, Skill Gabungan, ping, ask for coins, chat. Built once per layout; live bits patched in place so taps never land on a replaced node */
function renderBar(s) {
  const m = mode, el = $('bar'), me = s && m ? BK.player(s, m.me) : null;
  if (!me || m.spectator() || m.phase() !== 'playing' && m.phase() !== 'over') { setHTML(el, ''); el.hidden = true; return; }
  el.hidden = false;
  const multi = multiOf(s), can = m.canAct() && !me.g && !BK.over(s), H = world.HR[me.h] || {};
  const key = [me.h, multi, can].join('|');
  if (el._k !== key) {
    el._k = key;
    let h = '<button type="button" class="ab skill" data-act="skill" style="--hc:' + hColor(me.h) + '"><i class="cd"></i>' + img('h', me.h, 30) + '<span><b class="sk">' + esc(hSkill(me.h)) + '</b><small class="st"></small></span></button>';
    if (multi) h += '<button type="button" class="ab gab" data-act="join"><span class="ic">🤝</span><span><b class="gl">' + esc(t('gabBtn')) + '</b><small class="gs"></small></span><i class="cd"></i></button>' +
      '<button type="button" class="ab" data-act="pingMode" aria-label="' + esc(t('pingTitle')) + '"><span class="ic">📍</span><span>' + esc(t('pingBtn')) + '</span></button>' +
      '<button type="button" class="ab" data-act="ask" aria-label="' + esc(t('askBtn')) + '"><span class="ic">🪙</span><span>' + esc(t('askBtn')) + '</span></button>' +
      (m.kind === 'online' ? '<button type="button" class="ab chatb" data-act="chatToggle" aria-label="' + esc(t('chatRoom')) + '"><span class="ic">💬</span><span>' + esc(t('chatBtn')) + '</span><i class="badge chat-n" hidden></i></button>' : '');
    el.innerHTML = h; el._h = null;
  }
  const sk = el.querySelector('.skill'), cdMax = Math.max(1, BK.skillCd(world, s, me.h)), ready = can && me.k === 0 && s.ph === 'wave';
  sk.classList.toggle('ready', ready); sk.classList.toggle('on', sel.kind === 'skill'); sk.setAttribute('aria-disabled', String(!ready)); sk.disabled = !can;
  sk.querySelector('.cd').style.setProperty('--p', me.k > 0 ? Math.min(1, me.k / cdMax).toFixed(3) : '0');
  const st = me.k > 0 ? Math.ceil(me.k / BK.TPS) + ' dtk' : s.ph === 'wave' ? t('skillReady') : t('skillWaitWave');
  const sst = sk.querySelector('.st'); if (sst.textContent !== st) sst.textContent = st;
  sk.setAttribute('aria-label', hSkill(me.h) + ' · ' + st + (H.target ? '' : ''));
  const gb = el.querySelector('.gab');
  if (gb) {
    const sg = s.sg, joined = sg && sg.ps.includes(me.id), np = BK.present(s).length, cdTot = (world.CB.cd || 1);
    let lab = t('gabBtn'), sub = '';
    if (sg) { lab = joined ? '⏳ ' + sg.ps.length + '/' + np : t('gabJoin', { n: sg.ps.length, m: np }); sub = Math.max(0, Math.ceil((sg.e - s.t) / BK.TPS)) + ' dtk'; }
    else if (s.sgc > 0) sub = Math.ceil(s.sgc / BK.TPS) + ' dtk';
    else sub = s.ph === 'wave' ? t('skillReady') : t('skillWaitWave');
    const ok = can && s.ph === 'wave' && s.sgc === 0 && !joined;
    gb.classList.toggle('open', !!sg && !joined); gb.setAttribute('aria-disabled', String(!ok)); gb.disabled = !can;
    gb.querySelector('.cd').style.setProperty('--p', s.sgc > 0 ? Math.min(1, s.sgc / cdTot).toFixed(3) : '0');
    const gl = gb.querySelector('.gl'), gs = gb.querySelector('.gs'); if (gl.textContent !== lab) gl.textContent = lab; if (gs.textContent !== sub) gs.textContent = sub;
    gb.setAttribute('aria-label', (CB.name || lab) + ' · ' + lab + ' · ' + sub);
    el.querySelector('[data-act=pingMode]').classList.toggle('on', sel.kind === 'pingMode');
    for (const b of el.querySelectorAll('[data-act=pingMode],[data-act=ask]')) b.disabled = !can;
    const cb = el.querySelector('.chatb'); if (cb) cb.classList.toggle('on', ui.chatOpen);
  }
}
function towerStats(k, l) {
  const T = world.T[k], parts = [t('stRange', { n: (T.range[l] / 100).toFixed(1).replace('.', ',') })];
  if (T.dmg) parts.push(t('stDmg', { n: T.dmg[l] }) + (T.airMulPct ? ' ' + t('stAir', { n: T.airMulPct / 100 }) : ''));
  if (T.cd) parts.push(t('stRate', { n: (BK.TPS / T.cd[l]).toFixed(1).replace('.', ',') }));
  if (T.slow) parts.push(t('stSlow', { n: T.slow[l] }));
  if (T.buff) parts.push(t('stBuff', { n: T.buff[l] }));
  if (T.splash) parts.push(t('stSplash'));
  if (T.air && !T.airMulPct && T.ground) parts.push(t('stBoth'));
  if (!T.air && (T.dmg || T.slow)) parts.push(t('stGround'));
  return parts.join(' · ');
}
const num1 = v => (Math.round(v * 10) / 10).toString().replace('.', ',');
/** compact icon card: stats (with →next level), special tags, one-line role */
function towerCard(k, l, o) {
  o = o || {}; const T = world.T[k], C = CFG.towers[k] || {}, nx = o.up && l < 2 ? l + 1 : -1, multi = o.multi;
  const sv = (ic, lab, a, b) => '<span class="sv" title="' + esc(lab) + '"><i aria-hidden="true">' + ic + '</i><b>' + a + '</b>' + (b != null && b !== a ? '<em>→' + b + '</em>' : '') + '</span>';
  const st = [];
  if (T.dmg) st.push(sv('⚔️', t('stDmgL'), T.dmg[l], nx >= 0 ? T.dmg[nx] : null));
  if (T.cd) st.push(sv('⚡', t('stRateL'), num1(BK.TPS / T.cd[l]), nx >= 0 ? num1(BK.TPS / T.cd[nx]) : null));
  st.push(sv('🎯', t('stRngL'), num1(T.range[l] / 100), nx >= 0 ? num1(T.range[nx] / 100) : null));
  if (T.slow) st.push(sv('🐌', t('stSlowL'), '−' + T.slow[l] + '%', nx >= 0 ? '−' + T.slow[nx] + '%' : null));
  if (T.buff) st.push(sv('📯', t('stBuffL'), '+' + T.buff[l] + '%', nx >= 0 ? '+' + T.buff[nx] + '%' : null));
  const tg = [];
  if (T.splash) tg.push('💥 ' + t('spSplash'));
  if (T.airMulPct) tg.push('🪽 ' + t('spAir', { n: T.airMulPct / 100 }));
  else if (T.air && T.ground) tg.push('🪽 ' + t('spBoth'));
  else if (T.dmg || T.slow) tg.push('🚫🪽 ' + t('spGround'));
  if (!T.dmg && !T.slow) tg.push(t('spNoShot'));
  if (T.shared && multi) tg.push('🤝 ' + t('spShared'));
  return '<div class="tcard' + (o.cls ? ' ' + o.cls : '') + '"><div class="tc-h">' + img('t', k, o.big ? 34 : 28) + '<span class="tc-n"><b>' + esc(tName(k)) + (o.lvl ? ' · ' + esc(t('lvl', { n: l + 1 })) : '') + '</b><small>' + esc(C.role || '') + '</small></span>' + (o.right || '') + '</div><div class="tc-s">' + st.join('') + tg.map(x => '<span class="tag">' + esc(x) + '</span>').join('') + '</div>' + (o.foot || '') + '</div>';
}
/** can I put tower k on cell c right now? null = yes, otherwise a why-code */
function placeWhy(s, k, c) {
  const m = mode; if (!s || !m || c < 0) return 'cell';
  if (world.T[k].shared && multiOf(s)) { const me = BK.player(s, m.me); if (!BK.isBuildable(world, c)) return 'cell'; if (BK.occupied(s, c)) return 'taken'; return me && coins(me.c) >= E.barongMinChip ? null : 'coins'; }
  return BK.check(world, s, m.me, { k: 'build', t: k, c });
}
function trayPrice(s, k) { const shared = world.T[k].shared && multiOf(s); return { shared, n: shared ? E.barongMinChip : BK.cost(world, s, k) }; }
function trayHTML(s, money, active) {
  return '<div class="tray" role="group" aria-label="' + esc(t('trayTitle')) + '">' + TOWERS.map((k, i) => {
    const p = trayPrice(s, k), poor = money < p.n;
    return '<button type="button" class="tt' + (poor ? ' poor' : '') + (active === k ? ' on' : '') + '" data-act="trayTap" data-k="' + k + '" aria-label="' + esc(tName(k) + ' · 🪙' + p.n + (poor ? ' · ' + t('why_coins') : '')) + '" aria-pressed="' + (active === k) + '"><kbd>' + (i + 1) + '</kbd>' + img('t', k, 30) + '<span class="pr">' + (p.shared ? '🤝' : '🪙') + p.n + '</span></button>';
  }).join('') + '</div>';
}
function nextWaveHTML(s) {
  const w = s.ph === 'wave' ? s.w : s.w + 1, cnt = monCount(BK.wavePlan(world, s, w));
  return '<span class="nextw">' + esc(t(s.ph === 'wave' ? 'thisWave' : 'nextWave')) + ' ' + Object.keys(cnt).map(k => '<span class="mw" title="' + esc(mName(k)) + '">' + img('m', k, 22) + '×' + cnt[k] + '</span>').join('') + '</span>';
}
function chatChips(big) {
  return '<div class="chats' + (big ? ' big' : '') + '" role="group" aria-label="' + esc(t('chatTitle')) + '">' + CHAT.map(c => '<button type="button" class="cc" data-act="chat" data-k="' + esc(c.k) + '">' + esc(c.text) + '</button>').join('') + EMOJI.map((e, i) => '<button type="button" class="cc emo" data-act="emo" data-n="' + i + '" aria-label="' + esc(e) + '">' + e + '</button>').join('') + '</div>';
}
function berkahLine(s) {
  if (!s.bh || !s.bh.length) return '';
  const cnt = {}; for (const k of s.bh) cnt[k] = (cnt[k] || 0) + 1;
  return '<span class="berk" title="' + esc(t('berkahActive')) + '">' + Object.keys(cnt).map(k => '<span title="' + esc(bName(k) + ': ' + bText(k)) + '">' + bIcon(k) + (cnt[k] > 1 ? '×' + cnt[k] : '') + '</span>').join('') + '</span>';
}
function renderPanel(s) {
  const m = mode, el = $('panel'); if (!s || !m) { setHTML(el, ''); return; }
  const me = BK.player(s, m.me), can = m.canAct() && me && !me.g && !BK.over(s), money = me ? coins(me.c) : 0, multi = multiOf(s);
  let html = '';
  const close = '<button type="button" class="x" data-act="desel" aria-label="' + esc(t('close')) + '">✕</button>';
  if (sel.kind === 'build' && can) {
    const headK = sel.k ? '<div class="ph-head"><b>' + esc(tName(sel.k)) + '</b><span class="hint">' + esc(t('buildHint')) + '</span><button type="button" class="btn small primary" data-act="build"' + (BK.check(world, s, m.me, { k: 'build', t: sel.k, c: sel.c }) ? ' disabled' : '') + '>' + esc(t('buildBtn', { n: BK.cost(world, s, sel.k) })) + '</button>' + close + '</div>'
      : '<div class="ph-head"><b>' + esc(t('buildTitle')) + '</b><span class="hint">' + esc(t('buildHint')) + '</span>' + close + '</div>';
    html = headK + '<div class="palette">' + TOWERS.map(k => {
      const T = world.T[k], shared = T.shared && multi, a = shared ? null : { k: 'build', t: k, c: sel.c }, why = shared ? (money >= E.barongMinChip ? null : 'coins') : BK.check(world, s, m.me, a);
      const price = shared ? t('patungan') : String(BK.cost(world, s, k));
      return '<button type="button" class="tw' + (sel.k === k ? ' on' : '') + '" data-act="' + (shared ? 'foundPick' : 'pick') + '" data-k="' + k + '"' + (why ? ' aria-disabled="true"' : '') + '>' + img('t', k, 30) + '<span class="nm">' + esc(tName(k)) + '</span><span class="pr">' + (shared ? '' : '🪙') + esc(price) + '</span></button>';
    }).join('') + '</div>';
  } else if (sel.kind === 'found' && can) {
    const opts = [100, 150, 200, 300].filter(n => n <= E.barongMaxSharePerPlayer);
    html = '<div class="ph-head"><b>' + esc(t('foundTitle')) + '</b>' + close + '</div><p class="hint">' + esc(t('foundText', { n: E.barongCost })) + '</p><div class="ph-row amounts">' + opts.map(n => '<button type="button" class="btn small ' + (money >= n ? 'yellow' : 'ghost') + '" data-act="found" data-n="' + n + '"' + (money >= n ? '' : ' disabled') + '>🪙' + n + '</button>').join('') + '</div>';
  } else if (sel.kind === 'tower') {
    const tw = s.tw.find(x => x.i === sel.i); if (!tw) { sel = { kind: null }; return renderPanel(s); }
    const mine = tw.o === m.me, upA = { k: 'up', i: tw.i }, upWhy = can ? BK.check(world, s, m.me, upA) : 'view', sellWhy = can ? BK.check(world, s, m.me, { k: 'sell', i: tw.i }) : 'view';
    const refund = Math.floor(tw.by.reduce((a, x) => a + x[1], 0) * E.sellRefundPct / 100), upCost = tw.l < 2 ? BK.upCost(world, tw.k, tw.l) : 0;
    const owners = tw.by.map(x => nameOf(x[0])).join(' + ');
    html = towerCard(tw.k, tw.l, { up: true, lvl: true, multi, cls: 'inpanel', right: '<span class="owner" style="--c:' + colorOf(s, tw.o) + '">' + esc(s.n > 1 ? owners : '') + '</span>' + close }) +
      '<div class="ph-row">' + (tw.l < 2 ? '<button type="button" class="btn small primary" data-act="up"' + (upWhy ? ' disabled' : '') + '>' + esc(t('upBtn', { n: upCost })) + '</button>' : '<span class="muted small">' + esc(t('maxLvl')) + '</span>') + '<button type="button" class="btn small ghost" data-act="sell"' + (sellWhy ? ' disabled' : '') + '>' + esc(t('sellBtn', { n: refund })) + '</button>' + (!mine && can && s.n > 1 ? '<span class="muted small">' + esc(t('notYours')) + '</span>' : '') + '</div>';
  } else if (sel.kind === 'fd') {
    const f = s.fd.find(x => x.i === sel.i); if (!f) { sel = { kind: null }; return renderPanel(s); }
    const mineIn = f.pd.filter(x => x[0] === m.me).reduce((a, x) => a + x[1], 0), left = E.barongCost - f.tot, cap = Math.min(left, E.barongMaxSharePerPlayer - mineIn, Math.floor(money / E.giveStep) * E.giveStep);
    const needOther = f.pd.length < 2 && f.pd.every(x => x[0] === m.me);
    const opts = [10, 50, 100].filter(n => n < cap); if (cap >= E.barongMinChip) opts.push(cap);
    html = '<div class="ph-head">' + img('t', 'barong', 30) + '<b>' + esc(t('fdTitle')) + '</b><span class="prog"><i style="width:' + Math.round(f.tot / E.barongCost * 100) + '%"></i><em>' + f.tot + '/' + E.barongCost + '</em></span>' + close + '</div>' +
      '<p class="desc">' + esc(t('fdBy', { list: f.pd.map(x => nameOf(x[0]) + ' ' + x[1]).join(', ') })) + (needOther ? ' · ' + esc(t('fdNeedOther')) : '') + '</p>' +
      '<div class="ph-row amounts">' + (can ? [...new Set(opts)].map(n => '<button type="button" class="btn small yellow" data-act="chip" data-n="' + n + '"' + (BK.check(world, s, m.me, { k: 'chip', i: f.i, n }) ? ' disabled' : '') + '>+' + n + (n === cap ? ' ' + esc(t('max')) : '') + '</button>').join('') : '') + (can && !BK.check(world, s, m.me, { k: 'unfound', i: f.i }) ? '<button type="button" class="btn small ghost" data-act="unfound">' + esc(t('unfound')) + '</button>' : '') + '</div>';
  } else if (sel.kind === 'give' && can) {
    const to = BK.player(s, sel.to);
    if (!to || to.g) { sel = { kind: null }; return renderPanel(s); }
    html = '<div class="ph-head"><b>' + esc(t('giveTitle', { name: nameOf(to.id) })) + '</b>' + close + '</div><p class="hint">' + esc(t('giveText')) + '</p><div class="ph-row amounts">' + [10, 20, 50, 100].map(n => '<button type="button" class="btn small yellow" data-act="sendGive" data-n="' + n + '"' + (money >= n ? '' : ' disabled') + '>🪙' + n + '</button>').join('') + '</div>';
  } else if (sel.kind === 'ping') {
    html = '<div class="ph-head"><b>' + esc(t('pingTitle')) + '</b>' + close + '</div><div class="ph-row amounts">' + PINGS.map(p => '<button type="button" class="btn small ghost" data-act="sendPing" data-k="' + esc(p.k) + '">' + p.icon + ' ' + esc(t('ping_' + p.k)) + '</button>').join('') + '</div>';
  } else if (sel.kind === 'pingMode' && can) {
    html = '<div class="ph-head"><b>📍 ' + esc(t('pingTitle')) + '</b><span class="hint">' + esc(t('pingPickHint')) + '</span>' + close + '</div><div class="ph-row amounts">' + PINGS.map(p => '<button type="button" class="btn small ' + (sel.k === p.k ? 'yellow' : 'ghost') + '" data-act="pingKind" data-k="' + esc(p.k) + '" aria-pressed="' + (sel.k === p.k) + '">' + p.icon + ' ' + esc(t('ping_' + p.k)) + '</button>').join('') + '</div>';
  } else if (sel.kind === 'place' && can) {
    html = '<div class="ph-head"><b>' + esc(t('placeTitle', { name: tName(sel.k) })) + '</b><span class="hint">' + esc(t('placeHint')) + '</span>' + close + '</div>' + trayHTML(s, money, sel.k);
  } else if (sel.kind === 'skill' && can && me) {
    html = '<div class="ph-head">' + img('h', me.h, 30) + '<b>' + esc(t('skillAim', { skill: hSkill(me.h) })) + '</b>' + close + '</div><p class="desc">' + esc(hText(me.h)) + '</p><p class="hint">' + esc(t('skillAimHint')) + '</p>';
  } else {
    sel = { kind: null };
    const ready = BK.present(s).filter(p => p.r).length, np = BK.present(s).length;
    let line = '';
    if (m.spectator()) line = '<p class="hint">' + esc(t('spectating')) + '</p>';
    else if (me && me.g) line = '<p class="hint warn">' + esc(t('youGone')) + '</p>';
    const extra = line || (can ? trayHTML(s, money, null) : '');
    if (s.ph === 'prep' || s.ph === 'break') {
      html = '<div class="ph-row status"><span><b>' + esc(t(s.ph === 'prep' ? 'prepTitle' : 'breakTitle', { t: mmss(s.tm) })) + '</b>' + nextWaveHTML(s) + '</span>' + berkahLine(s) + (can ? '<button type="button" class="btn ' + (me.r ? 'ghost' : 'primary') + ' ready" data-act="ready"' + (me.r ? ' disabled' : '') + '>' + esc(np > 1 ? t(me.r ? 'readyDone' : 'readyBtn', { a: ready, b: np }) : t('startNow', { n: Math.floor(s.tm / BK.TPS) * E.earlyStartCoinsPerSecond })) + '</button>' : '') + '</div>' + extra;
    } else if (s.ph === 'wave') {
      html = '<div class="ph-row status"><span><b>' + esc(t('waveTitle', { w: s.w, n: s.en.length + s.q.length })) + '</b>' + nextWaveHTML(s) + '</span>' + berkahLine(s) + '</div>' + extra;
    } else html = line;
  }
  if (drag && drag.on) return; // never swap the tray out from under a drag
  setHTML(el, html);
  el.querySelectorAll('.tray').forEach(x => x.classList.toggle('nudge', !!(ui.nudge === 'build')));
}
function renderDragCard(s) {
  const el = $('dragcard'), m = mode; let k = null, line = '', cls = '';
  if (s && m && drag && drag.on) { k = drag.k; if (drag.c < 0) line = t('cardOff'); else if (drag.ok) { line = '✅ ' + t('cardDrop'); cls = 'ok'; } else { line = '⛔ ' + t('cardBad', { why: t('why_' + drag.why) }); cls = 'bad'; } }
  else if (s && sel.kind === 'place') { k = sel.k; line = t('placeHint'); }
  else if (s && sel.kind === 'build' && sel.k) k = sel.k;
  if (!k) { if (!el.hidden) { el.hidden = true; setHTML(el, ''); } return; }
  const p = trayPrice(s, k), me = BK.player(s, m.me), poor = me && coins(me.c) < p.n;
  el.hidden = false; el.className = 'dragcard ' + cls + (drag && drag.on && drag.low ? ' low' : '');
  setHTML(el, towerCard(k, 0, { multi: multiOf(s), big: true, right: '<span class="cost' + (poor ? ' poor' : '') + '">' + (p.shared ? '🤝' : '🪙') + p.n + '</span>', foot: line ? '<p class="tc-f">' + esc(line) + '</p>' : '' }));
}
/* ---------- drag & drop build: only the final drop sends an action ---------- */
let drag = null, dragEndAt = 0;
function dragStart(e, b) {
  const m = mode, s = m && m.state(); if (!s || !m.canAct() || e.button > 0) return;
  drag = { k: b.dataset.k, id: e.pointerId, sx: e.clientX, sy: e.clientY, x: e.clientX, y: e.clientY, on: false, c: -1, ok: false, why: 'cell', off: 0, touch: e.pointerType !== 'mouse', low: false };
}
function dragMove(e) {
  if (!drag || e.pointerId !== drag.id) return;
  drag.x = e.clientX; drag.y = e.clientY;
  if (!drag.on) { if (Math.hypot(drag.x - drag.sx, drag.y - drag.sy) < 8) return; drag.on = true; document.body.classList.add('dragging'); sel = { kind: null }; SFX.play('tap'); vibrate(8); }
  e.preventDefault();
  const r = $('map').getBoundingClientRect(), cs = r.width / world.W, s = mode && mode.state();
  drag.off = drag.touch ? cs * 0.9 : 0;
  const c = map.cellAt(drag.x, drag.y - drag.off); drag.c = c; drag.why = s ? placeWhy(s, drag.k, c) : 'cell'; drag.ok = !drag.why;
  drag.low = drag.y < r.top + r.height * 0.45; lastHud = 0;
}
function dragEnd(e, cancel) {
  if (!drag || (e && e.pointerId !== drag.id)) return;
  const d = drag; drag = null; document.body.classList.remove('dragging');
  if (!d.on) return; // a plain tap: the click handler opens the place flow
  dragEndAt = performance.now(); lastHud = 0;
  const s = mode && mode.state(); if (cancel || !s || d.c < 0) return;
  if (!d.ok) { toast(t('why_' + d.why)); SFX.play('fizzle'); return; }
  if (world.T[d.k].shared && multiOf(s)) sel = { kind: 'found', c: d.c };
  else doAct({ k: 'build', t: d.k, c: d.c });
}
$('panel').addEventListener('pointerdown', e => { const b = e.target.closest('.tt'); if (b) dragStart(e, b); });
window.addEventListener('pointermove', dragMove, { passive: false });
window.addEventListener('pointerup', e => dragEnd(e, false));
window.addEventListener('pointercancel', e => dragEnd(e, true));
function trayTap(k) {
  const m = mode, s = m && m.state(); if (!s || !m.canAct() || performance.now() - dragEndAt < 350) return;
  if (sel.kind === 'place' && sel.k === k) { sel = { kind: null }; return; }
  sel = { kind: 'place', k }; SFX.play('tap');
  const me = BK.player(s, m.me), p = trayPrice(s, k); if (me && coins(me.c) < p.n) toast(t('why_coins'));
}
/* ---------- chat room drawer ---------- */
const deskMQ = window.matchMedia ? matchMedia('(min-width: 900px) and (min-height: 560px)') : { matches: true };
ui.chatOpen = deskMQ.matches && innerHeight >= 760;
function chatOn() { return !!(mode && mode.kind === 'online' && !mode.demo); }
function chatShown() { return chatOn() && ui.chatOpen && !document.hidden; }
function renderChat() {
  const el = $('chat'), on = chatOn();
  if (el.hidden !== !on) el.hidden = !on;
  $('game').classList.toggle('chat-open', on && ui.chatOpen);
  if (!on) return;
  el.classList.toggle('open', ui.chatOpen);
  if (ui.chatOpen) talk.unread = 0;
  const n = talk.unread, badge = $('chatBadge'), txt = n > 9 ? '9+' : String(n);
  badge.hidden = !n; if (badge.textContent !== txt) badge.textContent = txt;
  document.querySelectorAll('.chat-n').forEach(b => { b.hidden = !n; if (b.textContent !== txt) b.textContent = txt; });
  if (ui.chatOpen) setHTML($('chatList'), talk.room.length ? talk.room.slice(-14).map(x => '<p style="--c:' + x.color + '"' + (x.id === mode.me ? ' class="me"' : '') + '><b>' + esc(x.name) + '</b> ' + esc(x.text) + '</p>').join('') : '<p class="muted">' + esc(t('chatEmpty')) + '</p>');
  const q = $('chatQuick'); if (!q._b) { q._b = 1; q.innerHTML = chatChips(false); }
  const inp = $('chatInput'), spec = mode.spectator(); if (inp.disabled !== spec) { inp.disabled = spec; inp.placeholder = spec ? t('chatSpectator') : t('chatPh'); }
  q.hidden = spec;
}
function chatToggle(open) {
  ui.chatOpen = open == null ? !ui.chatOpen : open; talk.unread = 0; renderChat(); lastHud = 0;
  if (ui.chatOpen && !deskMQ.matches) setTimeout(() => { try { $('chatInput').focus({ preventScroll: true }); } catch (e) { /* ignore */ } }, 30);
}
$('chatForm').addEventListener('submit', e => {
  e.preventDefault(); const inp = $('chatInput'), text = cleanText(inp.value), m = mode; if (!text || !m) return;
  m.talk('say', { m: text, c: ui.myCell >= 0 ? ui.myCell : undefined }).then(r => { if (r !== null) handleTalk(m.state(), m.me, 'say', { m: text, c: ui.myCell >= 0 ? ui.myCell : null }); }).catch(er => { if (er && er.code === 'slow') toast(t('errSlowSay')); else if (er && er.code !== 'busy') toast(errMsg(er)); });
  inp.value = ''; $('chatCnt').textContent = '';
});
$('chatInput').addEventListener('input', e => { const n = e.target.value.length; $('chatCnt').textContent = n > 80 ? String(SAY_MAX - n) : ''; });
if (window.visualViewport) { const vv = window.visualViewport, kb = () => document.documentElement.style.setProperty('--kb', Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop)) + 'px'); vv.addEventListener('resize', kb); vv.addEventListener('scroll', kb); }
/* ---------- first sighting of each monster: one-line toast ---------- */
const SEEN_KEY = 'benteng.seenM';
let seenM; try { seenM = new Set(JSON.parse(local.get(SEEN_KEY) || '[]')); } catch (e) { seenM = new Set(); }
const mq = { list: [], until: 0, at: 0 };
function checkMonsters(s) {
  const now = performance.now(), el = $('mtoast');
  if (s && mode && !mode.demo && s.ph === 'wave' && now - mq.at > 250) { mq.at = now; for (const e of s.en) if (!seenM.has(e.k)) { seenM.add(e.k); local.set(SEEN_KEY, JSON.stringify([...seenM])); mq.list.push(e.k); } }
  if (now < mq.until) return;
  if (!mq.list.length) { if (!el.hidden) el.hidden = true; return; }
  const k = mq.list.shift(), M = CFG.monsters[k] || {}; mq.until = now + 3800;
  el.innerHTML = img('m', k, 34) + '<span><b>' + esc(t('newMonster')) + ' ' + esc(mName(k)) + '</b><small>' + esc(M.tip || M.text || '') + '</small></span>';
  el.hidden = false; el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
}
/* ---------- guided first wave (practice): each step waits for the player to do it ---------- */
const TUT_KEY = 'benteng.tut';
const tut = { on: false, step: 0, cell: -1, tw: null, hold: false, slow: 1 };
function tutStart() { tut.on = true; tut.step = 0; tut.cell = demoCells(1)[0]; tut.tw = null; tut.hold = true; tut.slow = 1; }
function tutStop() { tut.on = false; tut.hold = false; tut.slow = 1; $('coach').hidden = true; $('tutArrow').hidden = true; $('tutHand').hidden = true; }
function tutEnd() { tut.on = false; tut.hold = false; tut.slow = 1; local.set(TUT_KEY, '1'); $('coach').hidden = true; $('tutArrow').hidden = true; $('tutHand').hidden = true; document.querySelectorAll('.tut-hi').forEach(x => x.classList.remove('tut-hi')); lastHud = 0; }
function tutTarget(sel2) { document.querySelectorAll('.tut-hi').forEach(x => { if (!sel2 || !x.matches(sel2)) x.classList.remove('tut-hi'); }); const el = sel2 ? document.querySelector(sel2) : null; if (el) el.classList.add('tut-hi'); return el; }
function tutTick(s) {
  const m = mode, me = BK.player(s, m.me); if (!me || m.picking) return null;
  if (BK.over(s) || s.ph === 'won') { tutEnd(); return null; }
  const mine = s.tw.filter(x => x.o === m.me);
  // advance
  if (tut.step === 0 && mine.length) { tut.step = 1; tut.tw = mine[0].i; SFX.play('pick'); }
  if (tut.step === 1 && (me.r || s.ph === 'wave')) { tut.step = 2; }
  if (tut.step === 2) { const tw = s.tw.find(x => x.i === tut.tw) || mine[0]; if (!tw || tw.l > 0 || BK.check(world, s, m.me, { k: 'up', i: tw.i })) tut.step = 3; else tut.tw = tw.i; }
  if (tut.step === 3 && (me.k > 0 || (s.ph === 'wave' && BK.check(world, s, m.me, { k: 'skill', c: 0 }) && BK.check(world, s, m.me, { k: 'skill', c: 0 }) !== 'cooldown'))) tut.step = 4;
  const tw = s.tw.find(x => x.i === tut.tw);
  let text = '', sub = '', target = null, cells = [], path = false, hand = false;
  tut.hold = tut.step <= 1; tut.slow = 1;
  if (tut.step === 0) { text = t('tut1'); sub = t('tut1b'); target = '.tray .tt[data-k=ketapel]'; cells = [tut.cell]; hand = !(drag && drag.on) && sel.kind !== 'place'; }
  else if (tut.step === 1) { text = t('tut2'); target = '[data-act=ready]'; path = true; }
  else if (tut.step === 2) { tut.slow = 0.35; if (sel.kind === 'tower' && sel.i === tut.tw) { text = t('tut3b'); target = '#panel [data-act=up]'; } else { text = t('tut3a'); cells = tw ? [tw.c] : []; } }
  else if (tut.step === 3) { if (s.ph === 'wave') { tut.slow = 0.35; if (sel.kind === 'skill') { text = t('tut4b'); const lead = s.en.length ? s.en.reduce((a, b) => (b.d > a.d ? b : a)) : null; if (lead) { const [x, y] = BK.pos(world, lead.d); cells = [Math.floor(y / BK.U) * world.W + Math.floor(x / BK.U)]; } } else { text = t('tut4a'); target = '#bar .skill'; } } }
  const el = $('coach');
  if (tut.step === 4) { tut.slow = 1; setHTML(el, '<span class="cs">🎓</span><p><b>' + esc(t('tut5')) + '</b></p><button type="button" class="btn small primary" data-act="tutEnd">' + esc(t('tutOk')) + '</button>'); el.hidden = false; tutTarget(null); $('tutArrow').hidden = true; $('tutHand').hidden = true; return null; }
  el.hidden = !text;
  if (text) setHTML(el, '<span class="cs">' + esc(t('tutStep', { a: tut.step + 1, b: 4 })) + '</span><p><b>' + esc(text) + '</b>' + (sub ? '<small>' + esc(sub) + '</small>' : '') + '</p><button type="button" class="btn small ghost" data-act="tutSkip">' + esc(t('tutSkip')) + '</button>');
  const tgt = text ? tutTarget(target) : tutTarget(null), ar = $('tutArrow');
  if (tgt && tgt.offsetParent) { const r = tgt.getBoundingClientRect(); ar.hidden = false; ar.style.left = Math.round(r.left + r.width / 2) + 'px'; ar.style.top = Math.round(r.top) + 'px'; } else ar.hidden = true;
  const hd = $('tutHand');
  if (hand && tgt && tut.cell >= 0) { const r = tgt.getBoundingClientRect(), mr = $('map').getBoundingClientRect(), cs = mr.width / world.W; hd.hidden = false; hd.style.setProperty('--x0', Math.round(r.left + r.width / 2) + 'px'); hd.style.setProperty('--y0', Math.round(r.top + r.height / 2) + 'px'); hd.style.setProperty('--x1', Math.round(mr.left + (tut.cell % world.W + 0.5) * cs) + 'px'); hd.style.setProperty('--y1', Math.round(mr.top + (Math.floor(tut.cell / world.W) + 0.5) * cs) + 'px'); }
  else hd.hidden = true;
  return text || path ? { cells, path } : null;
}
/* ---------- endless offer after wave 15 ---------- */
function endlessHTML(s) {
  const m = mode, ex = s.ex, solo = !multiOf(s), mine = (ex.v.find(x => x[0] === m.me) || [])[1], left = Math.max(0, Math.ceil((ex.e - s.t) / BK.TPS)), can = m.canAct() && !m.spectator();
  const dots = y => solo ? '' : '<span class="dots">' + ex.v.filter(x => !!x[1] === !!y).map(x => '<i style="--c:' + colorOf(s, x[0]) + '" title="' + esc(nameOf(x[0])) + '"></i>').join('') + '</span>';
  return '<div class="ov-card endless"><h2>🏆 ' + esc(t('endlessTitle')) + '</h2><p class="lead">' + esc(t('endlessText')) + '</p>' +
    '<div class="res"><span><b>' + s.sc.toLocaleString('id-ID') + '</b>' + esc(t('resScore')) + '</span><span><b>' + s.lives + '</b>' + esc(t('resLives')) + '</span><span><b>' + s.kills + '</b>' + esc(t('resKills')) + '</span></div>' +
    '<div class="ov-actions"><button type="button" class="btn yellow' + (mine === 1 ? ' on' : '') + '" data-act="exYes"' + (can ? '' : ' disabled') + ' aria-pressed="' + (mine === 1) + '">' + esc(t('endlessGo')) + dots(1) + '</button><button type="button" class="btn ghost' + (mine === 0 ? ' on' : '') + '" data-act="exNo"' + (can ? '' : ' disabled') + ' aria-pressed="' + (mine === 0) + '">' + esc(t('endlessStop')) + dots(0) + '</button></div>' +
    '<p class="muted small">' + esc(solo ? t('endlessAuto', { t: left }) : t('endlessVoteHint', { t: left })) + '</p></div>';
}
/** Kartu Berkah vote strip: 3 seeded cards, live counts, my pick highlighted */
function renderVote(s) {
  const el = $('vote'), m = mode, vt = s && s.vt;
  if (!vt || !m || BK.over(s) || $('overlay').hidden === false) { if (!el.hidden) { el.hidden = true; setHTML(el, ''); } return; }
  const me = m.me, solo = !multiOf(s), cnt = vt.c.map(() => []);
  for (const [pid, n] of vt.v) if (cnt[n]) cnt[n].push(pid);
  const mine = (vt.v.find(x => x[0] === me) || [])[1], top = Math.max(...cnt.map(x => x.length)), min = ui.voteMin === vt.e;
  const canVote = m.canAct() && !m.spectator();
  const html = '<div class="vh"><b>✨ ' + esc(t('voteTitle')) + '</b><small>' + esc(solo ? t('voteHintSolo') : t('voteHint')) + '</small>' + (solo ? '' : '<button type="button" class="x" data-act="voteMin" aria-label="' + esc(min ? 'Buka' : 'Kecilkan') + '">' + (min ? '▾' : '▴') + '</button>') + '</div><div class="tbar"><i></i></div><div class="vcards">' +
    vt.c.map((k, i) => '<button type="button" class="vc' + (mine === i ? ' mine' : '') + (top > 0 && cnt[i].length === top ? ' lead' : '') + '" data-act="vote" data-n="' + i + '"' + (canVote ? '' : ' disabled') + ' aria-pressed="' + (mine === i) + '">' + (solo ? '' : '<span class="n">' + cnt[i].length + '</span>') + '<span class="vi">' + bIcon(k) + '</span><b>' + esc(bName(k)) + '</b><span>' + esc(bText(k)) + '</span>' + (solo ? '' : '<span class="dots">' + cnt[i].map(pid => '<i style="--c:' + colorOf(s, pid) + '" title="' + esc(nameOf(pid)) + '"></i>').join('') + '</span>') + '</button>').join('') + '</div>';
  el.hidden = false; el.classList.toggle('min', min); setHTML(el, html);
  const bar = el.querySelector('.tbar i'); if (bar) bar.style.transform = 'scaleX(' + Math.max(0, Math.min(1, (vt.e - s.t) / world.voteTicks)).toFixed(3) + ')';
}
function renderAsk(s) {
  const el = $('askpop'), a = talk.ask, m = mode;
  if (a && performance.now() - a.at > 12000) talk.ask = null;
  const me = s && m ? BK.player(s, m.me) : null, from = a && s ? BK.player(s, a.from) : null;
  if (!talk.ask || !me || !from || from.g || !m.canAct() || $('overlay').hidden === false) { if (!el.hidden) { el.hidden = true; setHTML(el, ''); } return; }
  const money = coins(me.c);
  el.hidden = false; el.style.setProperty('--c', COLORS[from.s]);
  setHTML(el, '<span>🪙 <b>' + esc(t('askFrom', { name: nameOf(from.id) })) + '</b></span>' + [20, 50].map(n => '<button type="button" class="btn small yellow" data-act="askGive" data-n="' + n + '"' + (money >= n ? '' : ' disabled') + '>' + esc(t('askSend', { n })) + '</button>').join('') + '<button type="button" class="x" data-act="askClose" aria-label="' + esc(t('close')) + '">✕</button>');
}
function renderChatLog(force) {
  const el = $('chatlog'), now = performance.now(), list = talk.log.filter(x => now - x.at < 9000).slice(-3);
  const s = mode && mode.state();
  setHTML(el, list.map(x => '<p class="' + (now - x.at > 7500 ? 'old' : '') + '" style="--c:' + colorOf(s, x.id) + '"><b>' + esc(nameOf(x.id)) + ':</b> ' + esc(x.text) + '</p>').join(''));
  void force;
}
/* ---------- first-play hints (one at a time, remembered on this device) ---------- */
const TIPS_KEY = 'benteng.tips';
let tipsDone; try { tipsDone = new Set(JSON.parse(local.get(TIPS_KEY) || '[]')); } catch (e) { tipsDone = new Set(); }
function tipDone(k) { if (tipsDone.has(k)) return; tipsDone.add(k); local.set(TIPS_KEY, JSON.stringify([...tipsDone])); }
function currentTip(s) {
  const m = mode; if (!s || !m || !m.canAct() || BK.over(s) || m.demo || tut.on || s.ph === 'won') return null;
  const me = BK.player(s, m.me); if (!me || me.g) return null;
  const multi = multiOf(s), list = [];
  if ((s.ph === 'prep' || s.ph === 'break') && !s.tw.some(x => x.o === m.me)) list.push(['build', t('tipBuild')]);
  if (s.ph === 'wave' && me.k === 0) list.push(['skill', t('tipSkill', { skill: hSkill(me.h) })]);
  if (multi && s.ph === 'wave' && !s.sg && s.sgc === 0 && s.w >= 2) list.push(['gab', t('tipGab')]);
  if (multi && (s.ph === 'prep' || s.ph === 'break') && s.tw.some(x => x.o === m.me)) list.push(['chat', t('tipChat')]);
  return list.find(x => !tipsDone.has(x[0])) || null;
}
function renderTip(s) {
  const el = $('tip'), tip = $('overlay').hidden && !(s && s.vt) && $('askpop').hidden ? currentTip(s) : null;
  ui.nudge = tip ? tip[0] : null; const sk = document.querySelector('#bar .skill'); if (sk) sk.classList.toggle('nudge', ui.nudge === 'skill');
  if (!tip) { if (!el.hidden) { el.hidden = true; setHTML(el, ''); } return; }
  el.hidden = false; setHTML(el, '<span>💡 ' + esc(tip[1]) + '</span><button type="button" data-act="tipOk" data-k="' + tip[0] + '">' + esc(t('tipOk')) + '</button>');
}
function renderOverlay(s) {
  const m = mode, el = $('overlay'), html = m.overlay(s);
  el.hidden = !html; setHTML(el, html || '');
  if (s && ((BK.over(s) && m.phase() === 'over') || s.ph === 'won')) recordScore(s);
}
function recordScore(s) {
  const id = mode.gameId(); if (!id || mode.spectator() || mode.demo) return;
  const names = s.pl.map(p => nameOf(p.id)).slice(0, 4);
  if (ui.recorded !== id && (s.ph === 'won' || !s.x)) { ui.recorded = id; ui.rank = lbAdd(s.n, { id, score: s.sc, wave: Math.min(s.w, world.waves.length), win: s.ph === 'win' || s.ph === 'won', names, at: Date.now() }); }
  if (s.x && BK.over(s) && ui.recordedX !== id) { ui.recordedX = id; ui.rank = lbxAdd(s.n, { id, score: s.sc, wave: s.w, names, at: Date.now() }); }
}
function overHTML(s, actions) {
  if (s.x) { const list = (lbxLoad()[s.n] || []).slice(0, 5), id = mode.gameId(), solo = s.n === 1;
    return '<div class="ov-card over endless"><h2>♾️ ' + esc(t('endlessOverTitle')) + '</h2><p class="lead">' + esc(t(solo ? 'endlessOverSolo' : 'endlessOverText', { w: s.w })) + '</p>' +
      '<div class="res"><span><b>' + s.w + '</b>' + esc(t('resBest')) + '</span><span><b>' + s.sc.toLocaleString('id-ID') + '</b>' + esc(t('resScore')) + '</span><span><b>' + s.kills + '</b>' + esc(t('resKills')) + '</span></div>' +
      '<h3>' + esc(t('lbTitleX', { n: solo ? t('lbSolo') : t('lbN', { n: s.n }) })) + '</h3><ol class="lb mini">' + list.map((x, i) => '<li class="' + (x.id === id ? 'me' : '') + '"><span class="rk">' + (i + 1) + '</span><span class="who">' + esc(x.names.join(', ')) + '</span><b>♾️ ' + x.wave + '</b></li>').join('') + '</ol><p class="muted small">' + esc(t('lbLocal')) + '</p><div class="ov-actions">' + actions + '</div></div>'; }
  const win = s.ph === 'win', list = (lbLoad()[s.n] || []).slice(0, 5), id = mode.gameId();
  return '<div class="ov-card over ' + (win ? 'win' : 'lose') + '"><h2>' + esc(win ? t('winTitle') : t('loseTitle')) + '</h2><p class="lead">' + esc(win ? t('winText', { lives: s.lives }) : t('loseText', { w: s.w })) + '</p>' +
    '<div class="res"><span><b>' + s.sc.toLocaleString('id-ID') + '</b>' + esc(t('resScore')) + '</span><span><b>' + Math.min(s.w, world.waves.length) + '/' + world.waves.length + '</b>' + esc(t('resWave')) + '</span><span><b>' + s.kills + '</b>' + esc(t('resKills')) + '</span><span><b>' + s.lives + '</b>' + esc(t('resLives')) + '</span></div>' +
    '<h3>' + esc(t('lbTitleN', { n: s.n === 1 ? t('lbSolo') : t('lbN', { n: s.n }) })) + '</h3><ol class="lb mini">' + list.map((x, i) => '<li class="' + (x.id === id ? 'me' : '') + '"><span class="rk">' + (i + 1) + '</span><span class="who">' + esc(x.names.join(', ')) + '</span><b>' + x.score.toLocaleString('id-ID') + '</b></li>').join('') + '</ol><p class="muted small">' + esc(t('lbLocal')) + '</p>' +
    '<div class="ov-actions">' + actions + '</div></div>';
}
/** hero cards (lobby + practice): picks = [[playerId, hero]] */
function heroPicker(mine, picks, solo) {
  return '<h3>' + esc(solo ? t('heroPickSolo') : t('heroPick')) + '</h3><p class="muted small">' + esc(t('heroPickText')) + '</p><div class="heroes">' + HEROES.map(h => {
    const who = picks.filter(x => x[1] === h).map(x => nameOf(x[0]));
    return '<button type="button" class="hc' + (mine === h ? ' mine' : '') + '" data-act="hero" data-h="' + h + '" style="--hc:' + hColor(h) + '" aria-pressed="' + (mine === h) + '">' + img('h', h, 40) + '<span class="hfx hfx-' + h + '" aria-hidden="true"><i></i><i></i><i></i></span><span><b>' + esc(hName(h)) + '</b><em>' + esc(hSkill(h)) + '</em><strong class="hl">' + esc((CFG.heroes && CFG.heroes[h] && CFG.heroes[h].line) || '') + '</strong><small>' + esc(hText(h)) + '</small>' + (who.length && !solo ? '<span class="who">' + esc(t('heroTaken', { names: who.join(', ') })) + '</span>' : '') + '</span></button>';
  }).join('') + '</div>';
}

/* ---------- input ---------- */
let press = null;
const LONG_MS = 450;
function cellTap(c) {
  const m = mode, s = m && m.state(); if (!s || c < 0) return;
  if (sel.kind === 'skill') { if (m.canAct()) { doAct({ k: 'skill', c }); } sel = { kind: null }; return; }
  if (sel.kind === 'pingMode') { if (m.canPing()) sendTalk('ping', { c, k: sel.k || 'sini' }); sel = { kind: null }; return; }
  if (sel.kind === 'place' && m.canAct()) { const k = sel.k, why = placeWhy(s, k, c); if (!why) { if (world.T[k].shared && multiOf(s)) sel = { kind: 'found', c }; else { doAct({ k: 'build', t: k, c }); sel = { kind: null }; } return; } if (why !== 'taken') { toast(t('why_' + why)); return; } }
  const tw = s.tw.find(x => x.c === c), fd = s.fd.find(x => x.c === c);
  if (tw) { sel = { kind: 'tower', i: tw.i }; return; }
  if (fd) { sel = { kind: 'fd', i: fd.i, c }; return; }
  if (!m.canAct()) { sel = { kind: null }; return; }
  const me = BK.player(s, m.me); if (!me || me.g || BK.over(s)) return;
  if (!BK.isBuildable(world, c)) { sel = { kind: null }; if (!world.pathCells.has(c)) toast(t('why_cell')); return; }
  sel = sel.kind === 'build' && sel.c === c ? { kind: null } : { kind: 'build', c, k: sel.kind === 'build' ? sel.k : null };
  SFX.play('tap');
}
function doAct(a) { const m = mode; if (!m) return; m.act(a).catch(e => toast(errMsg(e))); vibrate(10); }
function pressSkill() {
  const m = mode, s = m && m.state(), me = s && BK.player(s, m.me); if (!me) return;
  const why = BK.check(world, s, m.me, { k: 'skill', c: 0 }); if (why) { toast(why === 'cooldown' ? t('why_cooldown') + ' (' + Math.ceil(me.k / BK.TPS) + ' dtk)' : t('why_' + why)); return; }
  const H = world.HR[me.h] || {};
  if (!H.target) { doAct({ k: 'skill' }); sel = { kind: null }; return; }
  sel = sel.kind === 'skill' ? { kind: null } : { kind: 'skill' };
}
$('map').addEventListener('pointerdown', e => {
  if (!mode) return; const c = map.cellAt(e.clientX, e.clientY);
  if (e.pointerType !== 'mouse') hover = sel.kind === 'skill' ? c : -1;
  press = { c, x: e.clientX, y: e.clientY, long: false, timer: setTimeout(() => { if (!press) return; press.long = true; if (mode && mode.canPing()) { sel = { kind: 'ping', c }; vibrate(25); lastHud = 0; } }, LONG_MS) };
});
$('map').addEventListener('pointermove', e => { if (!mode) return; if (e.pointerType === 'mouse' || (press && sel.kind === 'skill')) hover = map.cellAt(e.clientX, e.clientY); if (press && sel.kind !== 'skill' && Math.hypot(e.clientX - press.x, e.clientY - press.y) > 12) { clearTimeout(press.timer); press = null; } });
$('map').addEventListener('pointerleave', () => { hover = -1; });
$('map').addEventListener('pointerup', e => { if (!press) return; clearTimeout(press.timer); const p = press; press = null; if (!p.long) cellTap(sel.kind === 'skill' ? map.cellAt(e.clientX, e.clientY) : p.c); if (e.pointerType !== 'mouse') hover = -1; lastHud = 0; });
$('map').addEventListener('pointercancel', () => { if (press) clearTimeout(press.timer); press = null; });
$('map').addEventListener('contextmenu', e => { e.preventDefault(); if (mode && mode.canPing()) { sel = { kind: 'ping', c: map.cellAt(e.clientX, e.clientY) }; lastHud = 0; } });
$('game').addEventListener('click', e => {
  const b = e.target.closest('[data-act]'); if (!b || !mode || b.disabled) return;
  const m = mode, s = m.state(), a = b.dataset.act;
  if (b.getAttribute('aria-disabled') === 'true' && a === 'pick') { const k = b.dataset.k, why = s ? BK.check(world, s, m.me, { k: 'build', t: k, c: sel.c }) : null; toast(why ? t('why_' + why) : ''); sel.k = k; lastHud = 0; return; }
  switch (a) {
    case 'exit': m.exit(); break;
    case 'mute': SFX.toggle(); break;
    case 'pause': m.paused = !m.paused; break;
    case 'speed': m.speed = m.speed === 1 ? 2 : 1; break;
    case 'desel': sel = { kind: null }; break;
    case 'pick': if (sel.k === b.dataset.k) { doAct({ k: 'build', t: sel.k, c: sel.c }); sel = { kind: null }; } else sel.k = b.dataset.k; break;
    case 'build': doAct({ k: 'build', t: sel.k, c: sel.c }); sel = { kind: null }; break;
    case 'foundPick': sel = { kind: 'found', c: sel.c }; break;
    case 'found': doAct({ k: 'found', c: sel.c, n: Number(b.dataset.n) }); sel = { kind: null }; break;
    case 'chip': doAct({ k: 'chip', i: sel.i, n: Number(b.dataset.n) }); break;
    case 'unfound': doAct({ k: 'unfound', i: sel.i }); sel = { kind: null }; break;
    case 'up': doAct({ k: 'up', i: sel.i }); break;
    case 'sell': doAct({ k: 'sell', i: sel.i }); sel = { kind: null }; break;
    case 'ready': doAct({ k: 'ready' }); break;
    case 'give': sel = { kind: 'give', to: Number(b.dataset.to) }; break;
    case 'sendGive': doAct({ k: 'give', to: sel.to, n: Number(b.dataset.n) }); sel = { kind: null }; break;
    case 'sendPing': sendTalk('ping', { c: sel.c, k: b.dataset.k }); sel = { kind: null }; break;
    case 'skill': pressSkill(); break;
    case 'join': { const why = s ? BK.check(world, s, m.me, { k: 'join' }) : 'bad'; if (why) toast(t('why_' + why)); else doAct({ k: 'join' }); break; }
    case 'pingMode': sel = sel.kind === 'pingMode' ? { kind: null } : { kind: 'pingMode', k: (sel.k && sel.kind === 'pingMode') ? sel.k : 'sini' }; break;
    case 'pingKind': sel.k = b.dataset.k; break;
    case 'ask': sendTalk('ask', {}); break;
    case 'chat': sendTalk('chat', { k: b.dataset.k, c: ui.myCell >= 0 ? ui.myCell : undefined }); break;
    case 'emo': sendTalk('emo', { n: Number(b.dataset.n), c: ui.myCell >= 0 ? ui.myCell : undefined }); break;
    case 'askGive': if (talk.ask) { doAct({ k: 'give', to: talk.ask.from, n: Number(b.dataset.n) }); talk.ask = null; } break;
    case 'askClose': talk.ask = null; break;
    case 'vote': doAct({ k: 'vote', n: Number(b.dataset.n) }); SFX.play('vote'); break;
    case 'voteMin': if (s && s.vt) ui.voteMin = ui.voteMin === s.vt.e ? null : s.vt.e; break;
    case 'tipOk': tipDone(b.dataset.k); break;
    case 'trayTap': trayTap(b.dataset.k); break;
    case 'chatToggle': chatToggle(); break;
    case 'exYes': doAct({ k: 'endless', y: 1 }); SFX.play('vote'); break;
    case 'exNo': doAct({ k: 'endless', y: 0 }); SFX.play('vote'); break;
    case 'tutSkip': case 'tutEnd': tutEnd(); break;
    default: if (m.overlayAct) m.overlayAct(a, b);
  }
  lastHud = 0;
});
document.addEventListener('keydown', e => {
  if (!mode) return;
  if (e.target.closest('input,select,textarea')) { if (e.key === 'Escape' && e.target.id === 'chatInput') { e.target.blur(); if (!deskMQ.matches) chatToggle(false); } return; }
  if (e.key === 'Escape' && drag) { dragEnd(null, true); return; }
  const s = mode.state(); if (!s) return;
  if (e.key === 'Escape') { sel = { kind: null }; lastHud = 0; return; }
  if (sel.kind === 'build' && /^[1-6]$/.test(e.key)) { const k = TOWERS[Number(e.key) - 1]; if (world.T[k].shared && BK.present(s).length > 1) sel = { kind: 'found', c: sel.c }; else if (sel.k === k) { doAct({ k: 'build', t: k, c: sel.c }); sel = { kind: null }; } else sel.k = k; lastHud = 0; return; }
  if ((sel.kind === null || sel.kind === 'place') && /^[1-6]$/.test(e.key) && mode.canAct()) { trayTap(TOWERS[Number(e.key) - 1]); lastHud = 0; return; }
  if (e.key === 'Enter' && chatOn() && !mode.spectator()) { e.preventDefault(); chatToggle(true); $('chatInput').focus(); return; }
  if (sel.kind === 'tower' && (e.key === 'u' || e.key === 'U')) { doAct({ k: 'up', i: sel.i }); lastHud = 0; return; }
  if ((e.key === 'q' || e.key === 'Q') && mode.canAct()) { pressSkill(); lastHud = 0; return; }
  if ((e.key === 'g' || e.key === 'G') && mode.canAct() && multiOf(s)) { if (!BK.check(world, s, mode.me, { k: 'join' })) doAct({ k: 'join' }); lastHud = 0; return; }
  if (s.vt && /^[1-3]$/.test(e.key) && mode.canAct() && sel.kind !== 'build') { doAct({ k: 'vote', n: Number(e.key) - 1 }); lastHud = 0; return; }
  if (e.key === ' ' && (s.ph === 'prep' || s.ph === 'break') && mode.canAct()) { e.preventDefault(); doAct({ k: 'ready' }); }
});
window.addEventListener('resize', () => { fit(); if (!mode) heroArt(); });
if (window.ResizeObserver) new ResizeObserver(() => fit()).observe($('stageWrap'));

/* ================= modes ================= */
function showGame(m) {
  if (mode && mode !== m && mode.stop) mode.stop();
  tutStop(); drag = null; ui.chatOpen = deskMQ.matches && innerHeight >= 760; ui.recordedX = null; $('chatInput').value = '';
  mode = m; sel = { kind: null }; ui.recorded = null; ui.myCell = -1; ui.overSfx = null; hover = -1; resetTalk(); map.clear(); $('bar')._k = null;
  $('home').hidden = true; $('game').hidden = false; document.body.classList.add('in-game'); document.documentElement.classList.add('jr-hub-off');
  window.scrollTo(0, 0); fit(); lastHud = 0; start();
}
function showHome() {
  tutStop(); if (mode && mode.stop) mode.stop(); mode = null; $('game').hidden = true; $('home').hidden = false; document.body.classList.remove('in-game'); document.documentElement.classList.remove('jr-hub-off');
  if (/^#(practice|latihan|demo)$/i.test(location.hash)) history.replaceState(history.state, '', location.pathname + location.search);
  renderLB(); scheduleRooms(); heroArt();
}
/** best build cells for the demo: most path cells in reach, spaced out (deterministic) */
function demoCells(n) {
  const W = world.W, H = world.H, score = [];
  for (let c = 0; c < W * H; c++) { if (!BK.isBuildable(world, c)) continue; const x = c % W, y = Math.floor(c / W); let k = 0; for (const p of world.pathCells) { const dx = p % W - x, dy = Math.floor(p / W) - y; if (dx * dx + dy * dy <= 5) k++; } score.push([k, c]); }
  score.sort((a, b) => b[0] - a[0] || a[1] - b[1]);
  const out = []; for (const [, c] of score) { if (out.length >= n) break; if (out.some(o => Math.abs(o % W - c % W) + Math.abs(Math.floor(o / W) - Math.floor(c / W)) < 2)) continue; out.push(c); }
  return out;
}
/** demo bots: vote, cast skills on the lead monster, press Gabungan together (all through the normal rules) */
function demoActs(s) {
  const acts = [];
  if (s.vt) for (const p of s.pl) if (!s.vt.v.some(x => x[0] === p.id)) acts.push({ p: p.id, a: { k: 'vote', n: p.s % s.vt.c.length } });
  if (s.ph === 'wave' && s.en.length >= 3) {
    const lead = s.en.reduce((a, b) => (b.d > a.d ? b : a)), [x, y] = BK.pos(world, lead.d), c = Math.floor(y / BK.U) * world.W + Math.floor(x / BK.U);
    for (const p of s.pl) if (p.k === 0 && (s.t + p.s * 37) % 60 === 0) acts.push({ p: p.id, a: p.h === 'jawara' ? { k: 'skill', c: s.tw.length ? s.tw[(s.t / 60 | 0) % s.tw.length].c : c } : { k: 'skill', c } });
    if (s.en.length >= 8 && s.sgc === 0) for (const p of s.pl) if (!(s.sg && s.sg.ps.includes(p.id)) && (s.sg || p.s === 0)) { acts.push({ p: p.id, a: { k: 'join' } }); break; }
  }
  if ((s.ph === 'prep' || s.ph === 'break') && !s.vt) for (const p of s.pl) if (!p.r) acts.push({ p: p.id, a: { k: 'ready' } });
  return acts.filter(x => !BK.check(world, s, x.p, x.a));
}
function demoState(seed) {
  const ids = [1, 2, 3], s = BK.create(world, seed, ids, ['dukun', 'jawara', 'pendekar']); let fx = [];
  for (const p of s.pl) p.c = 5000 * 100;
  const kinds = ['meriam', 'petasan', 'ketapel', 'sate', 'petasan', 'meriam', 'ketapel', 'kentongan', 'petasan', 'ketapel', 'sate', 'meriam'], cells = demoCells(kinds.length + 1);
  const acts = kinds.map((k, i) => ({ p: ids[i % 3], a: { k: 'build', t: k, c: cells[i] } }));
  acts.push({ p: 1, a: { k: 'found', c: cells[kinds.length], n: 200 } });
  BK.step(world, s, acts, fx);
  const f = s.fd[0]; if (f) BK.step(world, s, [{ p: 2, a: { k: 'chip', i: f.i, n: 200 } }], fx);
  for (const tw of s.tw) if (tw.i % 3 !== 0) BK.step(world, s, [{ p: tw.o, a: { k: 'up', i: tw.i } }], fx);
  for (const tw of s.tw) if (tw.i % 2 === 0 && tw.l === 1) BK.step(world, s, [{ p: tw.o, a: { k: 'up', i: tw.i } }], fx);
  for (let i = 0; i < 20000 && !(s.w >= 6 && s.ph === 'wave' && s.en.length >= 10) && !BK.over(s); i++) { BK.step(world, s, demoActs(s), fx); fx.length = 0; if (s.lives < 10) s.lives = 20; }
  return s;
}
class PracticeMode {
  constructor(opts) {
    this.kind = 'practice'; this.me = 1; this.demo = !!(opts && opts.demo); this.tutorial = !!(opts && opts.tutorial);
    const saved = local.get('benteng.hero'); this.hero = HEROES.includes(saved) ? saved : null; this.picking = !this.demo;
    this.reset();
  }
  reset() {
    this.seed = 1 + Math.floor(Math.random() * 2147483646);
    const sim = this.demo ? demoState(this.seed) : BK.create(world, this.seed, [1], [this.hero || HEROES[0]]);
    this.tl = new BK.Timeline(world, { v: 0, sim }); this.ms = sim.t * BK.TICK_MS; this.last = performance.now(); this.v = 0; this.paused = false; this.speed = 1;
    this.demoAt = 0;
  }
  state() { return this.tl.cur; }
  update(fx) {
    const now = performance.now(), dt = Math.min(250, now - this.last); this.last = now;
    if (!this.paused && !this.picking && !document.hidden && !BK.over(this.tl.cur) && !(tut.on && tut.hold)) this.ms += dt * this.speed * (tut.on ? tut.slow : 1);
    if (this.demo) { const s = this.tl.cur; for (const x of demoActs(s)) this.tl.add({ v: ++this.v, t: s.t, p: x.p, a: x.a }); if (s.lives < 8) s.lives = 20; this.demoTalk(now); }
    this.tl.advance(Math.floor(this.ms / BK.TICK_MS), fx); return this.tl.cur;
  }
  /** demo only: show what team talk looks like (local, never sent) */
  demoTalk(now) {
    if (now - this.demoAt < 2600) return; this.demoAt = now; const s = this.tl.cur, k = Math.floor(now / 2600) % 4;
    const tw = s.tw[(k * 5) % Math.max(1, s.tw.length)], c = tw ? tw.c : 0;
    if (k === 0) handleTalk(s, 2, 'chat', { k: 'bos', c });
    else if (k === 1) handleTalk(s, 3, 'emo', { n: 3, c });
    else if (k === 2) handleTalk(s, 2, 'ping', { k: 'awas', c: s.en.length ? (() => { const [x, y] = BK.pos(world, s.en[0].d); return Math.floor(y / BK.U) * world.W + Math.floor(x / BK.U); })() : c });
    else handleTalk(s, 3, 'chat', { k: 'bantu', c });
    talk.cursors.set(2, { c: s.tw[1] ? s.tw[1].c : 0, at: now }); talk.cursors.set(3, { c: s.tw[6] ? s.tw[6].c : 0, at: now });
  }
  prev() { return this.tl.prev; }
  alpha() { return this.paused || this.picking ? 1 : Math.min(1, (this.ms % BK.TICK_MS) / BK.TICK_MS); }
  phase() { return BK.over(this.tl.cur) ? 'over' : 'playing'; }
  name(id) { if (this.demo) return id === 1 ? t('youName') : id === 2 ? 'Sari' : 'Budi'; return local.get('benteng.name') || t('youName'); }
  canAct() { return !this.picking; } canPing() { return false; } spectator() { return false; }
  netState() { return 'online'; } netLabel() { return ''; }
  gameId() { return 'p' + this.seed; }
  act(a) { const why = BK.check(world, this.tl.cur, 1, a); if (why) return Promise.reject(Object.assign(Error(why), { code: why })); this.tl.add({ v: ++this.v, t: this.tl.cur.t, p: 1, a }); if (tut.on && tut.hold) this.ms = Math.max(this.ms, (this.tl.cur.t + 2) * BK.TICK_MS); return Promise.resolve(true); }
  talk() { return Promise.resolve(null); } cursor() {} ping() { return Promise.resolve(null); }
  overlay(s) {
    if (this.picking) return '<div class="ov-card hero-pick">' + heroPicker(this.hero, this.hero ? [[1, this.hero]] : [], true) + '<div class="ov-actions"><button type="button" class="btn primary" data-act="heroGo"' + (this.hero ? '' : ' disabled') + '>' + esc(t('start')) + '</button><button type="button" class="btn ghost" data-act="home">' + esc(t('backHome')) + '</button></div></div>';
    if (BK.over(s)) return overHTML(s, '<button type="button" class="btn primary" data-act="again">' + esc(t('playAgain')) + '</button>' + (this.demo ? '' : '<button type="button" class="btn ghost" data-act="heroChange">' + esc(t('heroChange')) + '</button>') + '<button type="button" class="btn ghost" data-act="home">' + esc(t('backHome')) + '</button>');
    if (s.ph === 'won' && s.ex) return endlessHTML(s);
    if (this.paused) return '<div class="ov-card small"><h2>' + esc(t('paused')) + '</h2><div class="ov-actions"><button type="button" class="btn primary" data-act="pause">' + esc(t('resume')) + '</button><button type="button" class="btn ghost" data-act="home">' + esc(t('backHome')) + '</button></div></div>';
    return '';
  }
  overlayAct(a, b) {
    if (a === 'hero') { this.hero = b.dataset.h; local.set('benteng.hero', this.hero); SFX.play('vote'); }
    else if (a === 'heroGo') { if (!this.hero) return; this.picking = false; this.reset(); map.clear(); fit(); SFX.play('pick'); if (this.tutorial || !local.get(TUT_KEY)) tutStart(); }
    else if (a === 'heroChange') { this.picking = true; }
    else if (a === 'again') { tutStop(); this.reset(); map.clear(); resetTalk(); ui.recorded = null; ui.recordedX = null; fit(); }
    else if (a === 'home') showHome();
  }
  exit() { if (this.demo || this.picking || BK.over(this.tl.cur) || this.tl.cur.t < 20 || confirm(t('exitConfirmPractice'))) showHome(); }
  tick() {}
}
function startPractice(opts) { showGame(new PracticeMode(opts)); }

/* ---------- online ---------- */
const RT = Object.assign({ reconnectMaxSeconds: 15 }, CFG.realtime || {});
const net = new N.Connection({ storage: session, reconnectMaxMs: RT.reconnectMaxSeconds * 1000, onWake: () => { if (mode && mode.kind === 'online') mode.wake(); }, onSocket: () => { updateConn(); lastHud = 0; }, lobbyWake: () => scheduleRooms() });
function onlineError(e) {
  if (!e) return;
  if (e.status === 403 || e.status === 404) { if (mode && mode.kind === 'online') { toast(t('errMember')); net.forget(); showHome(); } return; }
  if (e.code === 'busy' || e.status === 409 || e.code === 'budget') return;
  if (e.code === 'late') { toast(t('errLate')); return; }
  if (e.code === 'network') { updateConn(); return; }
  toast(errMsg(e));
}
const inviteUrl = code => location.origin + location.pathname + '?room=' + encodeURIComponent(code);
async function copyInvite(code) {
  const url = inviteUrl(code);
  try { if (navigator.share && matchMedia('(pointer: coarse)').matches) { await navigator.share({ title: (CFG.site && CFG.site.name) || '', text: t('shareText'), url }); return; } } catch (e) { if (e && e.name === 'AbortError') return; }
  try { await navigator.clipboard.writeText(url); toast(t('copied')); } catch (e) { toast(t('copyFail', { code })); }
}
class OnlineMode {
  constructor(game) { this.kind = 'online'; this.game = game; this.speed = 1; this.paused = false; }
  get me() { return this.game.me; }
  state() { const g = this.game; return g.tl ? g.tl.cur : null; }
  update(fx) { const g = this.game; if (!g.tl) return null; g.frame(fx); return g.tl.cur; }
  prev() { return this.game.tl ? this.game.tl.prev : null; }
  alpha() { const k = this.game.clockTick(); return k > 0 ? Math.min(1, k - Math.floor(k)) : 1; }
  phase() { const g = this.game, s = g.s, d = g.data; if (!d) return 'lobby'; if (d.status === 'closed') return 'closed'; if (!N.supported(s)) return 'lobby'; if (s.phase === 'playing' && g.clockTick() < 0) return 'starting'; if (s.phase === 'playing' && g.tl && BK.over(g.tl.cur)) return 'over'; return s.phase || 'lobby'; }
  name(id) { const g = this.game, st = g.s.start; if (st) { const i = st.ids.indexOf(Number(id)); if (i >= 0) return st.names[i]; } const p = g.players().find(x => Number(x.id) === Number(id)); return p ? p.displayName : '—'; }
  spectator() { return !!(this.game.data && this.game.data.spectator); }
  canAct() { const ph = this.phase(); return !this.spectator() && (ph === 'playing') && !!this.game.tl && !!BK.player(this.game.tl.cur, this.me); }
  canPing() { return this.canAct(); }
  netState() { return net.state === 'online' ? (this.game.stale ? 'syncing' : 'online') : 'reconnecting'; }
  netLabel() { return net.state === 'online' ? (this.game.stale ? t('connSyncing') : t('connOnline')) : t('connReconnecting'); }
  gameId() { const st = this.game.s.start; return st ? 'o' + st.seed + ':' + st.v : null; }
  wake() { this.game.refresh().catch(onlineError); }
  tick() { this.game.tick(); }
  act(a) { return this.game.act(a); }
  talk(x, f) { return this.game.talk(x, f); }
  cursor(c) { this.game.cursor(c); }
  ping(c, k) { return this.game.ping(c, k); }
  onPing(ev) {
    const g = this.game, s = g.tl && g.tl.cur;
    const fresh = Date.now() - (Date.parse(ev.createdAt) || Date.now()) < 15000; if (!fresh) return;
    const id = Number(ev.playerId); if (id === this.me) return; // ours were shown when sent
    const P = (ev.payload && typeof ev.payload === 'object') ? ev.payload : {}, x = ['ping', 'chat', 'emo', 'ask', 'cur', 'say'].includes(P.x) ? P.x : (P.x == null ? 'ping' : null); if (!x) return;
    if (!s && !['chat', 'emo', 'say'].includes(x)) return;
    handleTalk(s, id, x, { c: Number.isInteger(P.c) ? P.c : null, k: typeof P.k === 'string' ? P.k : null, n: Number.isInteger(P.n) ? P.n : null, m: typeof P.m === 'string' ? P.m : '' });
    lastHud = 0;
  }
  overlay(s) {
    const g = this.game, d = g.data, ph = this.phase();
    if (!d) return '<div class="ov-card small"><p>' + esc(t('loading')) + '</p></div>';
    if (ph === 'closed') return '<div class="ov-card small"><h2>' + esc(t('closedTitle')) + '</h2><p>' + esc(t('closedText')) + '</p><div class="ov-actions"><button type="button" class="btn primary" data-act="home">' + esc(t('backHome')) + '</button></div></div>';
    if (ph === 'lobby') return this.lobby(d);
    if (ph === 'starting') return '<div class="ov-card count"><p>' + esc(t('startingIn')) + '</p><b>' + Math.max(1, Math.ceil(-g.clockTick() / BK.TPS)) + '</b>' + (s && BK.player(s, this.me) ? '<p>' + img('h', BK.player(s, this.me).h, 40) + '</p><p><b>' + esc(hName(BK.player(s, this.me).h) + ' · ' + hSkill(BK.player(s, this.me).h)) + '</b></p>' : '') + '<p class="muted small">' + esc(t(s && s.n > 1 ? 'startingHint' : 'hintSolo')) + '</p></div>';
    if (ph === 'playing' && s && s.ph === 'won' && s.ex) return endlessHTML(s);
    if (ph === 'over' && s) {
      const host = g.isHost(), final = g.s.phase === 'over';
      return overHTML(s, (host && final ? '<button type="button" class="btn primary" data-act="rematch">' + esc(t('rematch')) + '</button>' : '<p class="muted small">' + esc(final ? t('rematchWait') : t('finalising')) + '</p>') + '<button type="button" class="btn ghost" data-act="leave">' + esc(t('exit')) + '</button>');
    }
    return '';
  }
  lobby(d) {
    const g = this.game, s = g.s, list = N.seated(d.players), need = Math.max(0, 2 - list.length), specs = d.players.filter(p => p.spectator).length;
    const picks = (s.heroes || []).filter(x => list.some(p => p.id === x[0])), heroOf = id => (picks.find(x => x[0] === id) || [])[1], mine = heroOf(g.me);
    let html = '<div class="ov-card lobby"><h2>' + esc(t('lobbyTitle')) + '</h2><p class="muted">' + esc(t('lobbyInvite')) + '</p><div class="code">' + esc(d.code) + '</div><div class="ov-actions"><button type="button" class="btn small yellow" data-act="copy">' + esc(t('copyInvite')) + '</button><button type="button" class="btn small ghost lobby-chat" data-act="chatToggle">' + esc(t('chatOpenBtn')) + ' <i class="badge chat-n" hidden></i></button></div>';
    html += '<ul class="lobby-list">' + list.map((p, i) => { const h = heroOf(p.id); return '<li style="--c:' + COLORS[i % 4] + '">' + (h ? img('h', h, 20) : '<i></i>') + esc(p.displayName) + (p.id === g.me ? ' <em>' + esc(t('youBadge')) + '</em>' : '') + (s.hostId === p.id ? ' <em>' + esc(t('hostBadge')) + '</em>' : '') + '<small>' + esc(h ? hName(h) : '…') + '</small></li>'; }).join('') + '</ul>';
    if (!d.spectator) html += heroPicker(mine, picks, false);
    html += '<p class="muted small">' + esc(t('lobbyCount', { n: list.length, max: d.maxPlayers }) + (specs ? ' · ' + t('spectatorsCount', { n: specs }) : '')) + '</p>';
    html += '<div class="ov-actions">' + (g.isHost() ? '<button type="button" class="btn primary" data-act="start"' + (need ? ' disabled' : '') + '>' + esc(t('start')) + '</button>' : '') + '<button type="button" class="btn ghost" data-act="leave">' + esc(t('exit')) + '</button></div>';
    html += '<p class="muted small">' + esc(need ? t('lobbyNeed', { n: need }) : (g.isHost() ? '' : t('lobbyWaitHost'))) + '</p></div>';
    return html;
  }
  overlayAct(a, b) {
    const g = this.game;
    if (a === 'start') g.start().catch(e => toast(errMsg(e)));
    else if (a === 'hero') { const h = b.dataset.h; local.set('benteng.hero', h); g.pickHero(h).catch(e => toast(errMsg(e))); SFX.play('vote'); }
    else if (a === 'rematch') g.rematch().catch(e => toast(errMsg(e)));
    else if (a === 'copy') copyInvite(g.data.code);
    else if (a === 'leave' || a === 'home') g.leave().finally(showHome);
  }
  async exit() { const ph = this.phase(); if (ph === 'playing' && !this.spectator() && !confirm(t('exitConfirm'))) return; try { await this.game.leave(); } catch (e) { /* ignore */ } showHome(); }
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
  el.innerHTML = roomList.map(r => { const open = r.status === 'waiting' && r.seated < r.maxPlayers; return '<li class="room"><span><b>' + esc(r.code) + '</b><small>' + esc((r.status === 'waiting' ? t('roomWaiting') : t('roomPlaying')) + ' · ' + t('roomSeats', { n: r.seated, max: r.maxPlayers })) + '</small></span><button type="button" class="btn small ' + (open ? 'teal' : 'ghost') + '" data-room="' + esc(r.code) + '" data-kind="' + (open ? 'join' : 'watch') + '">' + esc(open ? t('join') : t('watch')) + '</button></li>'; }).join('');
}
$('rooms').addEventListener('click', e => { const b = e.target.closest('[data-room]'); if (!b) return; $('codeInput').value = b.dataset.room; go(b.dataset.kind, b.dataset.room); });
function newGame() { let om = null; const g = new N.LockstepGame(net, CFG, world, { onChange: () => { lastHud = 0; }, onNotice: onlineError, onPing: ev => { if (om) om.onPing(ev); } }); g.bind = m => { om = m; }; return g; }
function online(g) { const m = new OnlineMode(g); g.bind(m); return m; }
let entering = false;
function joinFail(e) { return { ok: false, missing: e.status === 404 || e.status === 422, retry: e.code === 'network' || e.code === 'busy' || e.status === 429, message: errMsg(e) }; }
async function go(kind, code) {
  if (entering || onlineState !== 'ready') return { ok: false, retry: true };
  const name = $('nameInput').value.replace(/\s+/g, ' ').trim().slice(0, 24);
  if (!name) { note(t('errName'), true); $('nameInput').focus(); return { ok: false, retry: true, message: t('errName') }; }
  if ((kind === 'join' || kind === 'watch') && !/^[A-Z2-9]{6}$/.test(code || '')) { note(t('errCode'), true); $('codeInput').focus(); return { ok: false, missing: true }; }
  local.set('benteng.name', name); entering = true; document.querySelectorAll('.online-btn').forEach(b => { b.disabled = true; });
  const g = newGame(), opts = { displayName: name, code, maxPlayers: Math.max(2, Math.min(4, Number($('maxSelect').value) || 4)), settings: {} };
  try { await g.enter(kind, opts); note(''); showGame(online(g)); return { ok: true }; }
  catch (e) {
    if (kind === 'join' && e.status === 409 && /not open/i.test(e.server || '')) {
      try { await g.enter('watch', opts); toast(t('nowWatching')); showGame(online(g)); return { ok: true }; } catch (e2) { note(errMsg(e2), true); return joinFail(e2); }
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
$('practiceStart').addEventListener('click', () => { const n = $('nameInput').value.replace(/\s+/g, ' ').trim().slice(0, 24); if (n) local.set('benteng.name', n); startPractice(); });
$('tutorialStart').addEventListener('click', () => { const n = $('nameInput').value.replace(/\s+/g, ' ').trim().slice(0, 24); if (n) local.set('benteng.name', n); startPractice({ tutorial: true }); });
$('lbModes').addEventListener('click', e => { const b = e.target.closest('button[data-m]'); if (!b) return; lbMode = Number(b.dataset.m); renderLB(); });
$('lbTabs').addEventListener('click', e => { const b = e.target.closest('button[data-n]'); if (!b) return; lbTab = Number(b.dataset.n); renderLB(); });

/* ================= static content ================= */
function applyText() {
  document.querySelectorAll('[data-t]').forEach(el => { el.textContent = t(el.dataset.t); });
  document.querySelectorAll('[data-t-ph]').forEach(el => { el.placeholder = t(el.dataset.tPh); });
  document.querySelectorAll('[data-t-aria]').forEach(el => { el.setAttribute('aria-label', t(el.dataset.tAria)); });
  document.querySelectorAll('[data-c]').forEach(el => { el.textContent = cfgPath(el.dataset.c) || ''; });
  const h1 = $('heroTitle'), title = t('heroTitle'), cut = title.indexOf(', ');
  if (cut > 0) { h1.textContent = ''; h1.append(title.slice(0, cut + 2)); const m = document.createElement('span'); m.className = 'mark'; m.textContent = title.slice(cut + 2); h1.append(m); }
  $('steps').innerHTML = (CFG.rules || []).map(r => '<li><h3>' + esc(r.title) + '</h3><p>' + esc(r.text) + '</p></li>').join('');
  $('towerList').innerHTML = TOWERS.map(k => { const T = world.T[k], c = CFG.towers[k] || {}; return '<li>' + img('t', k, 48) + '<div><h4>' + esc(tName(k)) + ' <span class="cost">' + esc(T.shared ? t('costShared', { n: T.cost }) : '🪙' + T.cost) + '</span></h4><p>' + esc(c.text || '') + '</p><p class="muted small">' + esc(towerStats(k, 0)) + '</p></div></li>'; }).join('');
  $('monsterList').innerHTML = MONSTERS.map(k => { const M = world.M[k], c = CFG.monsters[k] || {}; return '<li>' + img('m', k, 48) + '<div><h4>' + esc(mName(k)) + (M.boss ? ' <span class="boss">' + esc(t('bossTag')) + '</span>' : '') + '</h4><p>' + esc(c.text || '') + '</p><p class="muted small">' + esc(t('monStats', { hp: M.hp, r: M.reward, l: M.leak })) + '</p></div></li>'; }).join('');
  $('econTable').innerHTML = '<thead><tr><th>' + esc(t('econPlayers')) + '</th><th>' + esc(t('econCoins')) + '</th><th>' + esc(t('econTeam')) + '</th><th>' + esc(t('econHp')) + '</th></tr></thead><tbody>' + [1, 2, 3, 4].map(n => '<tr><td>' + (n === 1 ? esc(t('lbSolo')) : n) + '</td><td>' + E.coinSharePct[n - 1] + '%</td><td>' + (E.coinSharePct[n - 1] * n) + '%</td><td>' + E.monsterHpPct[n - 1] + '%</td></tr>').join('') + '</tbody>';
  if (CFG.site && CFG.site.themeColor) { const tc = document.querySelector('meta[name=theme-color]'); if (tc) tc.setAttribute('content', CFG.site.themeColor); }
  updateConn(); renderLB();
}
/** illustrative hero scene (decoration only: a few towers and monsters on the real map) */
function heroArt() {
  const cv = $('heroMap'); if (!cv || $('home').hidden) return;
  const box = cv.parentElement, cs = Math.max(16, Math.floor(Math.min((box.clientWidth || 300) / world.W, 34)));
  const v = new RD.MapView(cv, world); v.resize(cs, 2);
  const s = BK.create(world, 7, [1, 2]); s.ph = 'wave'; s.w = 3;
  const put = (k, x, y, o, l) => s.tw.push({ i: s.tw.length + 1, k, c: y * world.W + x, o, l, cd: 0, inv: 0, by: [[o, 1]] });
  put('ketapel', 3, 2, 1, 1); put('sate', 5, 3, 1, 0); put('meriam', 2, 5, 1, 2); put('petasan', 6, 8, 2, 0); put('kentongan', 3, 9, 2, 0); put('barong', 5, 11, 2, 0); put('ketapel', 8, 9, 2, 0);
  const en = (k, d, hp) => s.en.push({ i: s.en.length + 1, k, hp: hp || 10, mx: 10, d, sl: k === 'pocong' ? 5 : 0, sp: 0, so: 0, bt: 0, m: 0 });
  en('tuyul', 5200, 7); en('pocong', 9600); en('kuntilanak', 14200, 6); en('genderuwo', 21500); en('tuyul', 26800, 4);
  v.draw({ s, prev: null, alpha: 1, now: 400, me: null, sel: null, selTower: null, preview: null, hover: -1, cursors: [{ c: 4 * world.W + 4, color: COLORS[1], label: t('heroP2'), alpha: 1 }], bubbles: [{ c: 2 * world.W + 3, text: (CHAT[0] || {}).text || '', color: COLORS[0], born: 399, life: 1e9 }] });
}
$('brandLink').addEventListener('click', e => { if (mode) { e.preventDefault(); mode.exit(); } });
function route() { const h = location.hash.toLowerCase(); if (mode) return; if (h === '#practice' || h === '#latihan') startPractice(); else if (h === '#demo') startPractice({ demo: true }); }
window.addEventListener('hashchange', route);

/* ---------------- boot ---------------- */
$('nameInput').value = local.get('benteng.name') || '';
applyText(); heroArt();
setInterval(() => { if (mode) mode.tick(); }, 250);
const invite = window.JRInvite ? JRInvite.code('room') : '';
route();
async function resumeSaved() { const g = newGame(); try { await g.resume(); if (!mode) showGame(online(g)); } catch (e) { if (e.status === 403 || e.status === 404) net.forget(); } }
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
  code: invite, lang: 'id', gameName: (CFG.site && CFG.site.name) || '', nameKey: 'benteng.name', nameMax: 24, accent: '#ea580c',
  check: async c => { const st = await onlineReady; if (st === 'offline') return 'offline'; if (st !== 'ready') return { fallback: st }; if (mode && mode.kind === 'online' && net.code === c) return 'session'; return net.probe(c); },
  join: name => { $('nameInput').value = name; $('codeInput').value = invite; return go('join', invite); },
  fallback: msg => { $('codeInput').value = ''; if (msg) note(msg, true); if (!mode) { const p = $('play'); if (p) p.scrollIntoView({ block: 'start' }); if (net.code && net.token && onlineState === 'ready') resumeSaved(); } }
});
window.addEventListener('online', () => { if (onlineState === 'ready') net.visible(); });
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && onlineState === 'ready') net.visible(); });
window.BKApp = { get mode() { return mode; }, net, world, startPractice, showHome, talk, SFX, get sel() { return sel; }, tutCell: () => tut.cell, mask };
})();

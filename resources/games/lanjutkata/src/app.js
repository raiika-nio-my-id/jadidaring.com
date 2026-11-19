/* Lanjut Kata: UI, host loop, bots, animations. */
(function (root) {
'use strict';
const doc = document, $ = id => doc.getElementById(id), LK = root.LK, N = root.LKNet;
const CFG = JSON.parse($('website-config').textContent);
LK.loadWords(JSON.parse($('lk-words').textContent));
const getLS = k => { try { return localStorage.getItem(k) || ''; } catch (e) { return ''; } };
const setLS = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* private mode */ } };
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = (s, v) => String(s).replace(/\{(\w+)\}/g, (m, k) => v && v[k] !== undefined ? v[k] : m);
const NAME_KEY = 'lanjutkata.name', LANG_KEY = 'lanjutkata.lang', AV_KEY = 'lanjutkata.av', SET_KEY = 'lanjutkata.set', MUTE_KEY = 'lanjutkata.mute', BOTS_KEY = 'lanjutkata.bots';
let lang = getLS(LANG_KEY) === 'en' ? 'en' : 'id';
const T = (k, v) => { const a = CFG.text[lang] || CFG.text.id; return fmt(a[k] !== undefined ? a[k] : (CFG.text.id[k] !== undefined ? CFG.text.id[k] : k), v); };
const TA = k => (CFG.text[lang] && CFG.text[lang][k]) || CFG.text.id[k] || [];
let myAv = Math.min(CFG.avatars.length - 1, Math.max(0, parseInt(getLS(AV_KEY), 10) || 0));
let botN = Math.min(3, Math.max(1, parseInt(getLS(BOTS_KEY), 10) || 2));
let muted = getLS(MUTE_KEY) === '1';
let savedSet = {}; try { savedSet = JSON.parse(getLS(SET_KEY) || '{}') || {}; } catch (e) { savedSet = {}; }

/* ---------- connection ---------- */
let room = null, lastEvN = -1, lastPh = '', botFor = 0, toFor = 0, pruneAt = 0, onlineOk = false;
let ss = null; try { ss = root.sessionStorage; } catch (e) { ss = null; }
const conn = new N.Connection({ storage: ss, onWake: () => { if (room && !room.local) room.refresh(); }, onSocket: () => connBadge() });
function connBadge() {
  const el = $('conn'); if (!el) return;
  if (!room || room.local) { el.textContent = ''; return; }
  const st = conn.state; el.textContent = st === 'online' ? T('conn_online') : st === 'reconnecting' ? T('conn_reconnecting') : T('conn_connecting'); el.classList.toggle('off', st !== 'online');
}

/* ---------- sound ---------- */
let ac = null;
function beep(seq) {
  if (muted) return; try { ac = ac || new (root.AudioContext || root.webkitAudioContext)(); } catch (e) { return; }
  if (ac.state === 'suspended') ac.resume().catch(() => {});
  let t = ac.currentTime;
  for (const [f, d, type, vol] of seq) {
    const o = ac.createOscillator(), g = ac.createGain(); o.type = type || 'sine'; o.frequency.value = f; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol || 0.18, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(g); g.connect(ac.destination); o.start(t); o.stop(t + d + 0.02); t += d * 0.8;
  }
}
const SFX = {
  ok: () => beep([[660, 0.09, 'triangle'], [880, 0.09, 'triangle'], [1320, 0.16, 'triangle']]),
  bad: () => beep([[180, 0.18, 'square', 0.08], [140, 0.22, 'square', 0.08]]),
  tick: () => beep([[1000, 0.04, 'square', 0.05]]),
  turn: () => beep([[523, 0.1, 'sine'], [784, 0.18, 'sine']]),
  other: () => beep([[440, 0.07, 'triangle', 0.1], [550, 0.1, 'triangle', 0.1]]),
  miss: () => beep([[300, 0.12, 'sawtooth', 0.06], [220, 0.2, 'sawtooth', 0.06]]),
  win: () => beep([[523, 0.12], [659, 0.12], [784, 0.12], [1047, 0.3]]),
  go: () => beep([[392, 0.08, 'square', 0.08], [784, 0.22, 'square', 0.08]])
};

/* ---------- toasts / confetti ---------- */
function toast(msg, cls, ms) {
  const box = $('toasts'), el = doc.createElement('div'); el.className = 'toast ' + (cls || ''); el.textContent = msg; box.appendChild(el);
  while (box.children.length > 3) box.firstChild.remove();
  setTimeout(() => el.remove(), ms || 2600);
}
function flash(ok) { const f = doc.createElement('div'); f.className = 'flash' + (ok ? ' ok' : ''); doc.body.appendChild(f); setTimeout(() => f.remove(), 500); }
const reduce = root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches;
let confT = 0;
function confetti(n) {
  if (reduce) return; const cv = $('fx'), cx = cv.getContext('2d'), dpr = Math.min(2, root.devicePixelRatio || 1);
  cv.width = innerWidth * dpr; cv.height = innerHeight * dpr; cx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const cols = ['#ffd23f', '#ff4f8b', '#13b5a6', '#6b2fbf', '#ff7a59', '#fff'], P = [];
  for (let i = 0; i < (n || 160); i++) P.push({ x: innerWidth / 2 + (Math.random() - 0.5) * 120, y: innerHeight * 0.35, vx: (Math.random() - 0.5) * 14, vy: -Math.random() * 14 - 4, r: Math.random() * 6 + 4, c: cols[i % cols.length], a: Math.random() * 6, va: (Math.random() - 0.5) * 0.4 });
  const t0 = performance.now(); cancelAnimationFrame(confT);
  const wipe = () => { cx.setTransform(1, 0, 0, 1, 0, 0); cx.clearRect(0, 0, cv.width, cv.height); cx.setTransform(dpr, 0, 0, dpr, 0, 0); };
  const step = t => { wipe(); let alive = 0; for (const p of P) { p.vy += 0.35; p.vx *= 0.99; p.x += p.vx; p.y += p.vy; p.a += p.va; if (p.y < innerHeight + 20) alive++; cx.save(); cx.translate(p.x, p.y); cx.rotate(p.a); cx.fillStyle = p.c; cx.fillRect(-p.r / 2, -p.r / 4, p.r, p.r / 2); cx.restore(); } if (alive && t - t0 < 5000) confT = requestAnimationFrame(step); else { wipe(); cv.width = cv.height = 0; } };
  confT = requestAnimationFrame(step);
}

/* ---------- i18n ---------- */
function applyLang() {
  doc.documentElement.lang = lang;
  doc.querySelectorAll('[data-t]').forEach(el => { el.textContent = T(el.dataset.t); });
  doc.querySelectorAll('[data-th]').forEach(el => { el.innerHTML = T(el.dataset.th); });
  doc.querySelectorAll('[data-tp]').forEach(el => { el.placeholder = T(el.dataset.tp); });
  doc.querySelectorAll('.lb').forEach(b => { b.classList.toggle('on', b.dataset.lang === lang); b.setAttribute('aria-pressed', b.dataset.lang === lang); });
  const term = doc.querySelector('.site-footer a[href="/syarat-ketentuan"]'); if (term) term.textContent = T('terms');
  $('howList').innerHTML = TA('how').map(s => '<li>' + s + '</li>').join('');
  $('scoreList').innerHTML = TA('scoring').map(s => '<li>' + esc(s) + '</li>').join('');
  $('facts').innerHTML = TA('facts').map(s => '<li>' + esc(s) + '</li>').join('');
  const hub = $('jr-hub'); if (hub) { hub.setAttribute('aria-label', lang === 'en' ? 'Back to JaRing Game Hub' : 'Kembali ke JaRing Game Hub'); }
  $('muteBtn').setAttribute('aria-label', T('mute'));
  onlineNote(); render();
}
function heroTiles() {
  const word = lang === 'en' ? 'WORD CHAIN' : 'LANJUT KATA';
  $('heroTiles').innerHTML = [...word].map((c, i) => c === ' ' ? '<span class="sp"></span>' : '<span class="tile" style="animation-delay:' + (i * 0.06) + 's">' + c + '</span>').join('');
}

/* ---------- names / avatars ---------- */
function nameOf(id, s) { s = s || (room && room.s); if (id < 0) { const b = s && s.bots.find(x => x.id === id); return b ? b.n : 'Bot'; } const p = room && room.players().find(q => q.id === id); return p ? String(p.displayName || '') : (lang === 'en' ? 'Player' : 'Pemain'); }
function avOf(id, s) {
  s = s || (room && room.s);
  if (id < 0) { const b = s && s.bots.find(x => x.id === id); return b ? b.av : '🤖'; }
  const a = s && s.av.find(x => x[0] === id); return CFG.avatars[a ? a[1] % CFG.avatars.length : Math.abs(id) % CFG.avatars.length];
}
function participants(s) { // lobby: seated humans then bots
  const hum = room ? room.seated().map(p => p.id) : [];
  return hum.concat(s.bots.map(b => b.id)).slice(0, LK.MAX_SEATS);
}
function myName() { return $('nameInput').value.replace(/\s+/g, ' ').trim().slice(0, 24); }

/* ---------- screens ---------- */
function show(id) {
  for (const s of ['home', 'lobby', 'play']) $(s).hidden = s !== id;
  doc.documentElement.classList.toggle('in-room', id !== 'home');
  doc.documentElement.classList.toggle('jr-hub-off', id !== 'home');
  if (id !== 'play') $('results').hidden = true;
}
function render() {
  if (!room || !room.data) return;
  const s = room.s;
  if (room.gone) { toast(T('roomGone'), 'warn'); exitToMenu(true); return; }
  if (s.ph === 'lobby') { if (lastPh !== 'lobby') { show('lobby'); } renderLobby(s); }
  else { if (lastPh !== 'play' && lastPh !== 'end') { show('play'); } renderPlay(s); }
  if (s.ph === 'end') renderResults(s); else $('results').hidden = true;
  lastPh = s.ph; connBadge();
}

/* ---------- lobby ---------- */
function renderLobby(s) {
  const host = room.isHost(), ids = participants(s), me = room.me;
  $('roomCode').textContent = room.local ? T('practiceRoom') : room.code;
  $('inviteBtn').hidden = room.local;
  $('pCount').textContent = ids.length + '/' + LK.MAX_SEATS;
  const hostId = room.local ? me : (room.players().find(p => p.host) || {}).id;
  $('plist').innerHTML = ids.map(id => '<li data-id="' + id + '"><span class="av">' + avOf(id, s) + '</span><span class="nm">' + esc(nameOf(id, s)) + (id === me ? ' <small>(' + esc(T('you')) + ')</small>' : '') + '</span>' +
    (id === hostId ? '<span class="tag">' + esc(T('host')) + '</span>' : id < 0 ? '<span class="tag">' + esc(T('bot')) + '</span>' : '') +
    (host && id < 0 ? '<button type="button" class="rm" data-rm="' + id + '" aria-label="' + esc(T('removeBot')) + '">×</button>' : '') + '</li>').join('');
  $('addBot').hidden = !host || ids.length >= LK.MAX_SEATS;
  doc.querySelectorAll('#lobby .seg').forEach(seg => {
    const k = seg.dataset.k; seg.classList.toggle('ro', !host);
    seg.querySelectorAll('button').forEach(b => { const on = String(s.set[k]) === b.dataset.v; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); b.disabled = !host && !on; });
  });
  const inf = doc.querySelector('[data-k="turns"] [data-v="0"]'); if (inf) { inf.setAttribute('aria-label', T('turnsInfLabel')); inf.title = T('turnsInfLabel'); }
  $('turnsNote').hidden = !LK.unlimited(s);
  const can = host && ids.length >= 2;
  $('startBtn').hidden = !host; $('startBtn').disabled = !can;
  const spec = room.players().filter(p => p.spectator).length;
  $('lobbyNote').textContent = !host ? T('waitingHost') : ids.length < 2 ? T('needTwo') : (spec ? T('spectators', { n: spec }) : '');
}
async function hostEdit(type, fn) { if (!room || !room.isHost()) return; try { await room.edit(type, fn); } catch (e) { toast(errMsg(e), 'warn'); } }
function onSeg(e) {
  const b = e.target.closest('button'); if (!b || !room || !room.isHost()) return;
  const k = b.parentElement.dataset.k, v = b.dataset.v;
  hostEdit('set', s => { if (s.ph !== 'lobby') return null; s.set = LK.cleanSet(Object.assign({}, s.set, { [k]: k === 'mode' || k === 'lang' ? v : Number(v) })); savedSet = s.set; setLS(SET_KEY, JSON.stringify(s.set)); });
}
function addBot(s) {
  const ids = participants(s); if (ids.length >= LK.MAX_SEATS) return false;
  const used = new Set(s.bots.map(b => b.n)), id = Math.min(-1, ...s.bots.map(b => b.id - 1)), n = LK.BOT_NAMES.find(x => !used.has(x)) || ('Bot ' + (-id));
  s.bots.push({ id, n, av: CFG.botAvatars[(-id - 1) % CFG.botAvatars.length] }); return true;
}
function startMatch() {
  hostEdit('start', s => {
    if (s.ph === 'play') return null;
    const ids = participants(s); if (ids.length < 2) return null;
    LK.start(s, ids, room.now()); return { status: 'playing' };
  });
}

/* ---------- play ---------- */
let reqKey = '', ringLast = -1, curKey = '';
function renderPlay(s) {
  const me = room.me, cur = LK.curId(s), mine = cur === me && s.ph === 'play' && !room.spectator, unl = LK.unlimited(s);
  // players strip
  const strip = $('pstrip'), have = new Map([...strip.children].map(li => [Number(li.dataset.id), li]));
  const keep = new Set(s.ord.concat(s.pl.map(x => x.id)));
  for (const [id, li] of have) if (!keep.has(id)) li.remove();
  s.ord.forEach((id, i) => {
    let li = have.get(id); const pl = LK.plOf(s, id) || { s: 0, t: 0 };
    if (!li) { li = doc.createElement('li'); li.className = 'pc'; li.dataset.id = id; li.innerHTML = '<span class="av"></span><span class="meta"><span class="nm"></span><b class="sc"></b></span><span class="dots"></span>'; }
    if (strip.children[i] !== li) strip.insertBefore(li, strip.children[i] || null);
    li.querySelector('.av').textContent = avOf(id, s); li.querySelector('.nm').textContent = nameOf(id, s); li.querySelector('.sc').textContent = pl.s;
    li.querySelector('.dots').textContent = pl.o ? T('outTag') : pl.t + '/' + (unl ? '∞' : s.set.turns);
    li.classList.toggle('on', id === cur && s.ph === 'play'); li.classList.toggle('me', id === me); li.classList.toggle('out', !!pl.o);
  });
  // ribbon
  const rib = $('ribbon'), chain = s.ch.slice(-8), html = [];
  chain.forEach((c, i) => {
    const last = i === chain.length - 1, w = c.w;
    let inner = '';
    const tailAt = last && s.req ? w.lastIndexOf(s.req) : -1;
    [...w].forEach((ch, j) => { const cls = tailAt >= 0 && j >= tailAt && j < tailAt + s.req.length ? 'l h2' : 'l'; inner += '<span class="' + cls + '" style="animation-delay:' + (j * 0.03) + 's">' + esc(ch) + '</span>'; });
    html.push((i ? '<span class="arrow" aria-hidden="true">›</span>' : '') + '<li class="chip' + (c.by === 0 ? ' seed' : '') + '" data-k="' + esc(w) + '"><span class="by">' + (c.by === 0 ? '✨' : avOf(c.by, s)) + '</span>' + inner + '</li>');
  });
  const key = chain.map(c => c.w).join(',') + '|' + s.req;
  if (rib.dataset.key !== key) {
    const before = rib.dataset.key ? rib.dataset.key.split('|')[0].split(',') : []; rib.innerHTML = html.join(''); rib.dataset.key = key;
    const lastLi = rib.lastElementChild; if (lastLi && chain.length && !before.includes(chain[chain.length - 1].w)) lastLi.classList.add('new');
  }
  // required prefix
  const rk = s.req + '|' + s.n;
  if (reqKey !== rk) {
    const box = $('reqTiles'); box.innerHTML = [...(s.req || '')].map((c, i) => '<span class="tile" style="animation-delay:' + (i * 0.07) + 's">' + esc(c) + '</span>').join('') + '<span class="tile dots">…</span>';
    box.classList.remove('anim'); void box.offsetWidth; box.classList.add('anim'); reqKey = rk;
  }
  $('relaxedTag').hidden = !s.rel;
  $('prePart').textContent = s.req;
  // labels
  const cap = unl ? Infinity : s.set.turns, myPl = LK.plOf(s, me), turnNo = myPl && !myPl.o ? Math.min(cap, myPl.t + (mine ? 1 : 0)) : Math.min(cap, Math.max(0, ...s.pl.map(x => x.t)) + 1);
  $('roundPill').textContent = unl ? T('roundInf', { t: Math.max(1, turnNo) }) + ' · ' + T('aliveN', { n: LK.alive(s).length }) : T('roundN', { t: Math.max(1, turnNo), T: s.set.turns });
  $('passBtn').textContent = unl ? T('giveUp') : T('pass');
  $('usedPill').textContent = T('usedN', { n: s.used.length });
  $('codePill').textContent = room.local ? T('practiceRoom') : room.code;
  const tl = $('turnLabel'); tl.textContent = s.ph !== 'play' ? '' : mine ? T('yourTurn') : avOf(cur, s) + ' ' + T('turnOf', { name: nameOf(cur, s) }); tl.classList.toggle('mine', mine);
  // dock
  const inp = $('wordInput'), dock = $('wordForm'), ck = s.n + ':' + cur;
  dock.classList.toggle('mine', mine);
  inp.disabled = !mine; $('sendBtn').disabled = !mine; $('passBtn').disabled = !mine;
  inp.placeholder = room.spectator ? T('watchPh') : mine ? T('typePh') : T('waitPh');
  if (curKey !== ck) {
    curKey = ck; setMsg('');
    if (mine) { inp.value = ''; setTimeout(() => { try { inp.focus({ preventScroll: true }); } catch (e) { inp.focus(); } }, 60); if (lastEvN >= 0) { SFX.turn(); if (navigator.vibrate) try { navigator.vibrate(30); } catch (e) { /* ignore */ } } }
    else { if (doc.activeElement === inp) inp.blur(); inp.value = ''; }
  }
  // events → animations
  if (s.ev && s.ev.n !== lastEvN) { const first = lastEvN < 0; lastEvN = s.ev.n; if (!first) onEvent(s.ev, s); }
  tickUi();
}
function setMsg(t, info) { const m = $('msg'); m.textContent = t || ''; m.classList.toggle('info', !!info); }
function pop(id, text, zero) {
  const li = $('pstrip').querySelector('[data-id="' + id + '"]'); if (!li) return;
  const p = doc.createElement('span'); p.className = 'pop' + (zero ? ' zero' : ''); p.textContent = text; li.appendChild(p); setTimeout(() => p.remove(), 1300);
  if (zero) { li.classList.remove('shake'); void li.offsetWidth; li.classList.add('shake'); }
}
function flyWord(w, fromEl) {
  if (reduce) return; const rib = $('ribbon'), target = rib.lastElementChild; if (!fromEl || !target) return;
  const a = fromEl.getBoundingClientRect(), b = target.getBoundingClientRect(), f = doc.createElement('div'); f.className = 'fly'; f.textContent = w; $('flyer').appendChild(f);
  const fx = a.left + a.width / 2, fy = a.top + a.height / 2, tx = b.left + b.width / 2, ty = b.top + b.height / 2;
  const anim = f.animate([{ transform: 'translate(' + fx + 'px,' + fy + 'px) translate(-50%,-50%) scale(1.2)', opacity: 1 }, { transform: 'translate(' + ((fx + tx) / 2) + 'px,' + (Math.min(fy, ty) - 60) + 'px) translate(-50%,-50%) scale(1.1) rotate(-8deg)', opacity: 1, offset: 0.5 }, { transform: 'translate(' + tx + 'px,' + ty + 'px) translate(-50%,-50%) scale(.8)', opacity: 0.2 }], { duration: 650, easing: 'cubic-bezier(.4,0,.2,1)' });
  anim.onfinish = () => f.remove(); setTimeout(() => f.remove(), 900);
}
function onEvent(ev, s) {
  const me = room.me, who = nameOf(ev.by, s);
  if (ev.k === 'start') { SFX.go(); $('ribbon').dataset.key = ''; return; }
  if (ev.k === 'ok') {
    const src = ev.by === me ? $('wordInput') : $('pstrip').querySelector('[data-id="' + ev.by + '"]');
    flyWord(ev.w, src); pop(ev.by, '+' + ev.p);
    const rc = $('reqCard'); rc.classList.remove('okfx', 'badfx'); void rc.offsetWidth; rc.classList.add('okfx');
    if (ev.by === me) { SFX.ok(); flash(true); const br = LK.arr(ev.br), bits = []; if (br[1]) bits.push(T('streak') + ' +' + br[1]); if (br[2]) bits.push(T('speed') + ' +' + br[2]); if (bits.length) toast('✨ ' + bits.join(' · '), 'good', 1800); }
    else SFX.other();
    if (ev.habis) setTimeout(() => toast(T('habis'), 'warn', 3600), 300);
  } else if (ev.k === 'timeout' || ev.k === 'pass' || ev.k === 'bad') {
    pop(ev.by, '0', true); SFX.miss();
    const ex = LK.examples(ev.req || '', s.set.lang, s.used, 3);
    const key = ev.out ? 'out_' + ev.k : ev.k === 'timeout' ? 'timeout' : ev.k === 'bad' ? 'badPass' : 'passed';
    toast(T(key, { name: who }) + (ex.length ? ' · ' + T('example', { list: ex.join(', ') }) : ''), 'warn', 3200);
  } else if (ev.k === 'left') toast(T('left', { name: who }), 'warn');
  if (ev.seed) setTimeout(() => toast(T('seed', { w: ev.seed.toUpperCase() }), '', 2600), 400);
}
function reject(r) {
  const s = room.s; setMsg(T('why_' + r.why, { req: (s.req || '').toUpperCase(), w: r.w || '' }));
  const d = $('wordForm'); d.classList.remove('bad'); void d.offsetWidth; d.classList.add('bad'); setTimeout(() => d.classList.remove('bad'), 450);
  const rc = $('reqCard'); rc.classList.remove('okfx', 'badfx'); void rc.offsetWidth; rc.classList.add('badfx'); flash(false); SFX.bad();
}
let sending = false;
async function sendWord(e) {
  if (e) e.preventDefault(); if (!room || sending) return;
  const s = room.s, inp = $('wordInput'), raw = inp.value, me = room.me;
  if (LK.curId(s) !== me || s.ph !== 'play') return;
  if (room.now() < s.t0) { reject({ why: 'early' }); return; }
  const c = LK.check(s, raw);
  if (!c.ok) {
    reject(c);
    if (s.set.strict && ['prefix', 'used', 'plaus', 'same', 'dict'].includes(c.why)) { const n = s.n; inp.value = ''; room.edit('bad', st => { if (st.n !== n || !LK.skip(st, me, 'bad', room.now(), null, c.w)) return null; return endStatus(st); }).catch(err => toast(errMsg(err), 'warn')); }
    return;
  }
  sending = true; $('sendBtn').disabled = true; let res = null;
  try {
    await room.edit('word', st => { res = LK.submit(st, me, raw, room.now()); if (!res.ok) return null; return endStatus(st); });
    if (res && !res.ok) reject(res); else if (res) inp.value = '';
  } catch (err) { toast(errMsg(err), 'warn'); }
  finally { sending = false; render(); }
}
function passTurn() {
  if (!room) return; const s = room.s, me = room.me, n = s.n; if (LK.curId(s) !== me || s.ph !== 'play') return;
  room.edit('pass', st => { if (st.n !== n || !LK.skip(st, me, 'pass', room.now())) return null; return endStatus(st); }).catch(err => toast(errMsg(err), 'warn'));
}
function endStatus(st) { return { status: st.ph === 'play' ? 'playing' : 'waiting' }; }

/* ---------- timer ring + host loop ---------- */
function tickUi() {
  if (!room || $('play').hidden) return;
  const s = room.s, now = room.now(), arc = $('ringArc'), ring = arc.closest('.ring');
  const total = s.set.timer * 1000, left = s.ph === 'play' ? Math.max(0, Math.min(total, s.ddl - Math.max(now, s.t0))) : 0;
  arc.style.strokeDashoffset = String(276.46 * (1 - left / total));
  const sec = Math.ceil(left / 1000); $('ringNum').textContent = sec;
  ring.classList.toggle('warn', left <= total * 0.5 && left > 3000); ring.classList.toggle('hot', left <= 3000 && s.ph === 'play');
  if (sec !== ringLast) { if (sec <= 3 && sec > 0 && s.ph === 'play' && now >= s.t0 && LK.curId(s) === room.me) SFX.tick(); ringLast = sec; }
  const co = $('countOv'), pre = s.ph === 'play' ? s.t0 - now : -1;
  if (pre > 0) { co.hidden = false; const n = Math.ceil(pre / 1000); const b = $('countNum'); if (b.textContent !== String(n)) { b.textContent = n; } }
  else if (!co.hidden) { co.hidden = true; }
}
function loop() {
  if (!room || !room.data) return;
  room.tick(); tickUi();
  const s = room.s, now = room.now();
  if (s.ph !== 'play') return;
  const cur = LK.curId(s), host = room.isHost(), n = s.n;
  if (host && cur < 0 && now >= s.t0 && botFor !== n) {
    botFor = n; const w = LK.botWord(s), delay = w ? LK.botDelay() + Math.min(900, w.length * 60) : 2500 + Math.random() * 2000;
    setTimeout(() => {
      if (!room || room.s.n !== n) return;
      room.edit('bot', st => {
        if (st.n !== n || st.ph !== 'play' || LK.curId(st) !== cur) return null; const t = room.now();
        if (w) { const r = LK.submit(st, cur, w, t); if (!r.ok && !LK.skip(st, cur, 'pass', t)) return null; }
        else if (!LK.skip(st, cur, 'pass', t)) return null;
        return endStatus(st);
      }).catch(() => { botFor = 0; });
    }, delay);
  }
  const lateBy = host ? 300 : N.STALE_MS;
  if (now > s.ddl + lateBy && toFor !== n) {
    toFor = n;
    room.edit('timeout', st => { if (st.n !== n || st.ph !== 'play') return null; if (!LK.skip(st, LK.curId(st), 'timeout', room.now())) return null; return endStatus(st); }).catch(() => { toFor = 0; });
  }
  // host: drop players who left mid-match
  if (host && !room.local && Date.now() - pruneAt > 1500) {
    pruneAt = Date.now(); const seatedIds = new Set(room.seated().map(p => p.id)), gone = s.ord.filter(id => id > 0 && !seatedIds.has(id));
    if (gone.length) room.edit('prune', st => { let ch = false; for (const id of gone) if (LK.drop(st, id, room.now())) ch = true; return ch ? endStatus(st) : null; }).catch(() => {});
  }
}

/* ---------- results ---------- */
let resKey = '';
function renderResults(s) {
  const ov = $('results'), rk = s.game + ':' + s.n;
  ov.hidden = false;
  const host = room.isHost(); $('rematchBtn').hidden = !host; $('resNote').textContent = host ? '' : T('waitRematch');
  if (resKey === rk) return; resKey = rk;
  const r = LK.ranking(s), me = room.me, top = r[0];
  const unl = LK.unlimited(s), tie = r.length > 1 && r[1].s === top.s && r[1].w === top.w && !r[1].o === !top.o && (!unl || !top.o);
  const solo = unl && top && !top.o && r.filter(p => !p.o).length === 1;
  $('resWin').textContent = !top ? '' : solo ? T('survivor', { name: nameOf(top.id, s) }) : tie ? T('tie') : T('winner', { name: nameOf(top.id, s) });
  const pod = [r[1], r[0], r[2]].map((p, i) => p ? '<div class="pod p' + [2, 1, 3][i] + '"><span class="av">' + avOf(p.id, s) + '</span><span class="nm">' + esc(nameOf(p.id, s)) + '</span><div class="col">' + p.s + '</div></div>' : '').join('');
  $('podium').innerHTML = pod;
  $('rankList').innerHTML = r.map((p, i) => '<li class="' + (p.id === me ? 'me' : '') + '"><span class="n">' + (i + 1) + '</span><span>' + avOf(p.id, s) + '</span><span class="nm">' + esc(nameOf(p.id, s)) + (p.o ? '<span class="out-tag">' + esc(T('outTag')) + '</span>' : '') + ' <small>· ' + p.w + ' ' + esc(T('words')) + '</small></span><b class="sc">' + p.s + ' <small>' + esc(T('pts')) + '</small></b></li>').join('');
  $('bestLine').textContent = (s.ev && s.ev.habis ? T('habis') + ' ' : '') + (s.best ? T('bestWord') + ': ' + s.best.w.toUpperCase() + ' (' + nameOf(s.best.by, s) + ')' : '');
  if (lastEvN >= 0) { SFX.win(); confetti(); }
}
function rematch() { hostEdit('lobby', s => { if (s.ph !== 'end') return null; LK.backToLobby(s); return { status: 'waiting' }; }); }

/* ---------- entering / leaving ---------- */
function attach(r) { room = r; lastEvN = -1; lastPh = ''; resKey = ''; reqKey = ''; curKey = ''; botFor = 0; toFor = 0; $('ribbon').dataset.key = ''; $('pstrip').innerHTML = ''; render(); }
function makeRoom(link) { return new N.Room(link, { onChange: () => render() }); }
async function startPractice() {
  const name = myName() || (lang === 'en' ? 'You' : 'Kamu'); setLS(NAME_KEY, name);
  const r = makeRoom(new N.LocalLink()); await r.enter('practice', { displayName: name, av: myAv, set: savedSet });
  await r.edit('bots', s => { for (let i = 0; i < botN; i++) addBot(s); });
  attach(r);
}
function errMsg(e) {
  if (!e) return T('errNet'); if (e.code === 'busy') return T('errBusy', { s: e.wait || 10 }); if (e.code === 'network') return T('errNet');
  if (e.status === 404) return T('errMissing'); return T('errGeneric', { msg: e.server || e.message || '' });
}
async function enterOnline(mode, opts) {
  const r = makeRoom(conn); await r.enter(mode, Object.assign({ set: savedSet, av: myAv }, opts)); attach(r); return r;
}
async function onlineAction(mode) {
  const name = myName(); if (!name) { toast(T('errName'), 'warn'); $('nameInput').focus(); return; }
  setLS(NAME_KEY, name); const code = $('codeInput').value.trim().toUpperCase();
  if (mode === 'join' && !/^[A-Z2-9]{6}$/.test(code)) { toast(T('errMissing'), 'warn'); return; }
  doc.querySelectorAll('.online-btn').forEach(b => { b.disabled = true; });
  try { await enterOnline(mode, { displayName: name, code }); }
  catch (e) {
    if (mode === 'join' && e.status === 409) { try { await enterOnline('watch', { displayName: name, code }); toast(T('errFull'), 'warn', 4000); return; } catch (e2) { toast(errMsg(e2), 'warn'); } }
    else toast(errMsg(e), 'warn', 4000);
  } finally { doc.querySelectorAll('.online-btn').forEach(b => { b.disabled = !onlineOk; }); }
}
async function exitToMenu(silent) {
  const r = room; room = null; show('home'); lastPh = '';
  if (r && !silent) await r.leave(); else if (r && !r.local && conn.forget) conn.forget();
  connBadge();
}
function confirmExit() { if (!room) return; if (room.s.ph === 'play' && !root.confirm(T('exitConfirm'))) return; exitToMenu(false); }
function invite() {
  if (!room || room.local) return; const url = location.origin + location.pathname + '?room=' + room.code;
  const done = () => toast(T('copied'), 'good');
  if (navigator.share && /Mobi|Android/i.test(navigator.userAgent)) navigator.share({ title: CFG.site.name, text: CFG.site.name + ' · ' + room.code, url }).catch(() => {});
  else if (navigator.clipboard) navigator.clipboard.writeText(url).then(done, () => toast(url, '', 6000));
  else toast(url, '', 6000);
}
function onlineNote() {
  const el = $('onlineNote'); if (!el) return;
  el.textContent = !conn.allowed ? T('onlineOff') : onlineOk ? T('onlineReady') : conn.config === null && !conn.failed ? T('onlineChecking') : T('onlineDisabled');
}

/* ---------- boot ---------- */
function fitVh() { const h = root.visualViewport ? root.visualViewport.height : innerHeight; doc.documentElement.style.setProperty('--vh', Math.round(h) + 'px'); if (!$('play').hidden) root.scrollTo(0, 0); }
async function boot() {
  applyLang(); heroTiles();
  $('nameInput').value = getLS(NAME_KEY);
  $('avPick').innerHTML = CFG.avatars.map((a, i) => '<button type="button" role="radio" data-i="' + i + '" aria-label="Avatar ' + (i + 1) + '">' + a + '</button>').join('');
  const paintAv = () => $('avPick').querySelectorAll('button').forEach(b => { const on = Number(b.dataset.i) === myAv; b.classList.toggle('on', on); b.setAttribute('aria-checked', on); });
  paintAv();
  $('avPick').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; myAv = Number(b.dataset.i); setLS(AV_KEY, String(myAv)); paintAv(); if (room) room.hello(myAv).catch(() => {}); });
  const paintBots = () => $('botCount').querySelectorAll('button').forEach(b => { const on = Number(b.dataset.v) === botN; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); });
  paintBots(); $('botCount').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; botN = Number(b.dataset.v); setLS(BOTS_KEY, String(botN)); paintBots(); });
  doc.querySelectorAll('.lb').forEach(b => b.addEventListener('click', () => { lang = b.dataset.lang; setLS(LANG_KEY, lang); heroTiles(); applyLang(); }));
  $('practiceBtn').addEventListener('click', () => startPractice().catch(e => toast(errMsg(e), 'warn')));
  $('createPrivate').addEventListener('click', () => onlineAction('private'));
  $('quickMatch').addEventListener('click', () => onlineAction('match'));
  $('joinForm').addEventListener('submit', e => { e.preventDefault(); onlineAction('join'); });
  $('codeInput').addEventListener('input', e => { e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''); });
  doc.querySelectorAll('#lobby .seg').forEach(seg => seg.addEventListener('click', onSeg));
  $('plist').addEventListener('click', e => { const b = e.target.closest('[data-rm]'); if (!b) return; const id = Number(b.dataset.rm); hostEdit('botDel', s => { if (s.ph !== 'lobby') return null; s.bots = s.bots.filter(x => x.id !== id); }); });
  $('addBot').addEventListener('click', () => hostEdit('botAdd', s => s.ph === 'lobby' && addBot(s) ? {} : null));
  $('startBtn').addEventListener('click', startMatch);
  $('inviteBtn').addEventListener('click', invite);
  $('lobbyExit').addEventListener('click', () => exitToMenu(false));
  $('playExit').addEventListener('click', confirmExit);
  $('wordForm').addEventListener('submit', sendWord);
  $('passBtn').addEventListener('click', passTurn);
  $('wordInput').addEventListener('input', () => { if ($('msg').textContent) setMsg(''); });
  $('rematchBtn').addEventListener('click', rematch);
  $('resMenu').addEventListener('click', () => exitToMenu(false));
  const paintMute = () => { $('muteBtn').textContent = muted ? '🔇' : '🔊'; }; paintMute();
  $('muteBtn').addEventListener('click', () => { muted = !muted; setLS(MUTE_KEY, muted ? '1' : '0'); paintMute(); });
  root.addEventListener('resize', fitVh); if (root.visualViewport) root.visualViewport.addEventListener('resize', fitVh); fitVh();
  root.addEventListener('pagehide', () => { if (room && !room.local) conn.leaveBeacon(); });
  doc.addEventListener('visibilitychange', () => { if (doc.visibilityState === 'visible' && conn.config) conn.visible(); });
  setInterval(loop, 200);
  if (conn.allowed) {
    onlineNote();
    try { await conn.start(); onlineOk = true; } catch (e) { conn.failed = true; onlineOk = false; }
    doc.querySelectorAll('.online-btn').forEach(b => { b.disabled = !onlineOk; }); onlineNote();
  } else onlineNote();
  // a stale session from a previous tab load is dropped (pagehide already left the seat)
  if (conn.code && conn.token) { try { await conn.leave(); } catch (e) { conn.forget(); } }
  const JR = root.JRInvite, invCode = JR && JR.code ? JR.code('room') : '';
  if (invCode && JR.run) {
    JR.run({ code: invCode, lang, gameName: CFG.site.name, nameKey: NAME_KEY, nameMax: 24, accent: '#ff4f8b',
      check: async code => { if (!conn.allowed) return 'offline'; if (!onlineOk) return { fallback: T('onlineDisabled') }; return conn.probe(code); },
      join: async name => {
        $('nameInput').value = name; setLS(NAME_KEY, name);
        try { await enterOnline('join', { displayName: name, code: invCode }); return { ok: true }; }
        catch (e) {
          if (e.status === 409) { try { await enterOnline('watch', { displayName: name, code: invCode }); toast(T('errFull'), 'warn', 4000); return { ok: true }; } catch (e2) { /* fall through */ } }
          if (e.status === 404 || e.status === 422) return { ok: false, missing: true };
          return { ok: false, retry: true, message: errMsg(e) };
        }
      },
      fallback: () => { const p = $('mainkan'); if (p) p.scrollIntoView({ block: 'start' }); }
    });
  }
}
if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', boot); else boot();
root.LKApp = { get room() { return room; }, conn, render, loop };
})(window);

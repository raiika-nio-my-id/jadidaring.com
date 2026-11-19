/* Skala Teman: UI, i18n (9 languages), host loop (bots / timeouts / leavers), reveal + host-only Next, GM view. */
(function (root) {
'use strict';
const doc = document, $ = id => doc.getElementById(id), SL = root.SL, N = root.SLNet;
const CFG = JSON.parse($('website-config').textContent);
const getLS = k => { try { return localStorage.getItem(k) || ''; } catch (e) { return ''; } };
const setLS = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* private mode */ } };
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = (s, v) => String(s).replace(/\{(\w+)\}/g, (m, k) => v && v[k] !== undefined ? v[k] : m);
const NAME_KEY = 'skalateman.name', LANG_KEY = 'skalateman.lang', AV_KEY = 'skalateman.av', SET_KEY = 'skalateman.set2', MUTE_KEY = 'skalateman.mute', BOTS_KEY = 'skalateman.bots';

const LANGS = CFG.langs;
function detectLang() {
  const saved = getLS(LANG_KEY); if (LANGS.includes(saved)) return saved;
  const list = (navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || '']).map(x => String(x).toLowerCase());
  for (const l of list) { const p = l.split('-')[0]; if (p === 'in') return 'id'; if (p === 'nb' || p === 'no') continue; if (LANGS.includes(p)) return p; }
  return 'id';
}
let lang = detectLang();
const T = (k, v) => { const a = CFG.text[lang] || CFG.text.id; const x = a[k] !== undefined ? a[k] : (CFG.text.en[k] !== undefined ? CFG.text.en[k] : (CFG.text.id[k] !== undefined ? CFG.text.id[k] : k)); return fmt(x, v); };
const TA = k => (CFG.text[lang] && CFG.text[lang][k]) || CFG.text.id[k] || [];
// Prompt language is client-side: room state only stores the shared index; each client renders it from its own bank.
// Banks are index-aligned (same i = same topic); matches deal only from 0..QN-1, which every language has.
const QN = Math.min(...LANGS.map(l => (CFG.q[l] || []).length));
const Q = (i, name) => String((CFG.q[lang] && CFG.q[lang][i]) || (CFG.q.en[i]) || '').split('{name}').join(name || 'JadiDaring');
let myAv = Math.min(CFG.avatars.length - 1, Math.max(0, parseInt(getLS(AV_KEY), 10) || 0));
let botN = [1, 2, 3, 5, 7].includes(parseInt(getLS(BOTS_KEY), 10)) ? parseInt(getLS(BOTS_KEY), 10) : 3;
let muted = getLS(MUTE_KEY) === '1';
let savedSet = {}; try { savedSet = JSON.parse(getLS(SET_KEY) || '{}') || {}; } catch (e) { savedSet = {}; }
const reduce = root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches;
const AFK_ROUNDS = 3;

/* ---------- connection ---------- */
let room = null, onlineOk = false, screen = '';
let ss = null; try { ss = root.sessionStorage; } catch (e) { ss = null; }
const conn = new N.Connection({ storage: ss, onWake: () => { if (room && !room.local) room.refresh(); }, onSocket: () => connBadge(), lobbyWake: () => gmWake() });
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
    const o = ac.createOscillator(), g = ac.createGain(); o.type = type || 'sine'; o.frequency.value = f; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol || 0.16, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(g); g.connect(ac.destination); o.start(t); o.stop(t + d + 0.02); t += d * 0.8;
  }
}
const SFX = {
  pick: () => beep([[700, 0.06, 'triangle', 0.12], [1050, 0.1, 'triangle', 0.12]]),
  tick: () => beep([[1100, 0.04, 'square', 0.04]]),
  round: () => beep([[392, 0.08, 'square', 0.06], [523, 0.08, 'square', 0.06], [659, 0.18, 'square', 0.06]]),
  drum: () => beep([[160, 0.07, 'sawtooth', 0.08], [180, 0.07, 'sawtooth', 0.08], [200, 0.07, 'sawtooth', 0.08], [240, 0.12, 'sawtooth', 0.09]]),
  good: () => beep([[659, 0.1], [784, 0.1], [1047, 0.22]]),
  bad: () => beep([[300, 0.14, 'sawtooth', 0.07], [220, 0.24, 'sawtooth', 0.07]]),
  pop: () => beep([[900 + Math.random() * 300, 0.05, 'sine', 0.08]]),
  win: () => beep([[523, 0.12], [659, 0.12], [784, 0.12], [1047, 0.34]])
};

/* ---------- toasts / confetti / floaters ---------- */
function toast(msg, cls, ms) {
  const box = $('toasts'), el = doc.createElement('div'); el.className = 'toast ' + (cls || ''); el.textContent = msg; box.appendChild(el);
  while (box.children.length > 3) box.firstChild.remove();
  setTimeout(() => el.remove(), ms || 2600);
}
let confT = 0;
function confetti(n, y) {
  if (reduce) return; const cv = $('fx'), cx = cv.getContext('2d'), dpr = Math.min(2, root.devicePixelRatio || 1);
  cv.width = innerWidth * dpr; cv.height = innerHeight * dpr; cx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const cols = ['#ff4f9a', '#ffd23f', '#5ce1e6', '#9b6bff', '#7cf29c', '#ff8a3d'], P = [];
  for (let i = 0; i < (n || 140); i++) P.push({ x: innerWidth / 2 + (Math.random() - 0.5) * 200, y: innerHeight * (y || 0.35), vx: (Math.random() - 0.5) * 15, vy: -Math.random() * 13 - 4, r: Math.random() * 7 + 4, c: cols[i % cols.length], a: Math.random() * 6, va: (Math.random() - 0.5) * 0.4 });
  const t0 = performance.now(); cancelAnimationFrame(confT);
  const wipe = () => { cx.setTransform(1, 0, 0, 1, 0, 0); cx.clearRect(0, 0, cv.width, cv.height); cx.setTransform(dpr, 0, 0, dpr, 0, 0); };
  const step = t => { wipe(); let alive = 0; for (const p of P) { p.vy += 0.35; p.vx *= 0.99; p.x += p.vx; p.y += p.vy; p.a += p.va; if (p.y < innerHeight + 20) alive++; cx.save(); cx.translate(p.x, p.y); cx.rotate(p.a); cx.fillStyle = p.c; cx.fillRect(-p.r / 2, -p.r / 4, p.r, p.r / 2); cx.restore(); } if (alive && t - t0 < 5000) confT = requestAnimationFrame(step); else { wipe(); cv.width = cv.height = 0; } };
  confT = requestAnimationFrame(step);
}
function floater(html, cls, x, y) {
  const box = $('floaters'); if (!box) return; const el = doc.createElement('div'); el.className = 'floater ' + (cls || ''); el.innerHTML = html;
  el.style.left = (x === undefined ? 50 : x) + '%'; el.style.top = (y === undefined ? 50 : y) + '%'; box.appendChild(el);
  while (box.children.length > 14) box.firstChild.remove(); setTimeout(() => el.remove(), 2600);
}

/* ---------- i18n ---------- */
function applyLang() {
  doc.documentElement.lang = lang === 'zh' ? 'zh-Hans' : lang;
  doc.querySelectorAll('[data-t]').forEach(el => { el.textContent = T(el.dataset.t); });
  doc.querySelectorAll('[data-tp]').forEach(el => { el.placeholder = T(el.dataset.tp); });
  doc.querySelectorAll('[data-ta]').forEach(el => { el.setAttribute('aria-label', T(el.dataset.ta)); el.title = T(el.dataset.ta); });
  doc.querySelectorAll('select.lang-pick').forEach(el => { el.value = lang; });
  $('brandName').textContent = T('title');
  const term = doc.querySelector('.site-footer a[href="/syarat-ketentuan"]'); if (term) term.textContent = T('terms');
  $('footName').textContent = T('title');
  $('scoreRules').innerHTML = TA('scoreRules').map(s => '<li>' + esc(s) + '</li>').join('');
  $('howList').innerHTML = TA('how').map(s => '<li>' + esc(s) + '</li>').join('');
  $('facts').innerHTML = TA('facts').map(s => '<li>' + esc(s) + '</li>').join('');
  heroQ(); renderGm();
  const hub = $('jr-hub'); if (hub) { hub.setAttribute('aria-label', T('hub')); hub.title = T('hub'); }
  paintMute(); onlineNote(); keys.play = ''; keys.end = ''; chatKey = ''; render();
}
let heroI = 0;
function heroQ() { const el = $('heroQ'); if (!el) return; const list = CFG.q[lang] || CFG.q.en; el.textContent = String(list[heroI % list.length]).split('{name}').join('JadiDaring'); }

/* ---------- names / avatars ---------- */
const exOf = (id, s) => { s = s || (room && room.s); return s ? s.ex.find(x => x.id === id) : null; };
const playerOf = id => room && room.players().find(q => q.id === id);
function nameOf(id, s) { const x = exOf(id, s); if (x) return x.n; const p = playerOf(id); if (p) return String(p.displayName || ''); s = s || (room && room.s); const nm = s && s.nm && s.nm['p' + id]; return nm || T('player'); }
function avOf(id, s) {
  s = s || (room && room.s); const x = exOf(id, s); if (x) return x.av;
  const a = s && s.av.find(q => q[0] === id); return CFG.avatars[a ? a[1] % CFG.avatars.length : Math.abs(id) % CFG.avatars.length];
}
const isBot = (id, s) => { const x = exOf(id, s); return !!(x && x.b); };
const gmTag = (id, s) => s.gm['p' + id] ? ' <em class="gm-tag">(GM)</em>' : '';
function participants(s) { const hum = room ? room.seated().map(p => p.id) : []; return hum.concat(s.ex.map(b => b.id)).slice(0, SL.MAX_SEATS); }
function myName() { return $('nameInput').value.replace(/\s+/g, ' ').trim().slice(0, 24); }
const statusOf = st => ({ status: st.ph === 'play' ? 'playing' : 'waiting' });
const meId = () => (room && !room.spectator ? room.me : null);

/* ---------- screens ---------- */
function show(id) {
  if (screen === id) return; screen = id;
  for (const s of ['home', 'lobby', 'play', 'end']) $(s).hidden = s !== id;
  doc.documentElement.classList.toggle('in-room', id !== 'home');
  doc.documentElement.classList.toggle('jr-hub-off', id !== 'home');
  doc.documentElement.classList.toggle('in-play', id === 'play');
  root.scrollTo(0, 0);
}
const keys = { play: '', end: '', ev: -1, rx: new Set() };
function render() {
  gmMeSync();
  if (!room || !room.data) return;
  if (room.gone) { toast(T('roomGone'), 'warn'); exitToMenu(true); return; }
  const s = room.s;
  if (s.ph === 'lobby') { show('lobby'); renderLobby(s); }
  else if (s.ph === 'play') { show('play'); renderPlay(s); paintChat(s); }
  else { show('end'); renderEnd(s); }
  if (s.ev.n !== keys.ev) { const first = keys.ev < 0; keys.ev = s.ev.n; if (!first) onEvent(s.ev, s); }
  renderRx(s); connBadge();
}
function onEvent(ev) { if (ev.k === 'start' || ev.k === 'round') SFX.round(); else if (ev.k === 'end') { SFX.win(); confetti(180); } }

/* ---------- lobby ---------- */
function renderLobby(s) {
  const host = room.isHost(), ids = participants(s), me = room.me;
  $('roomCode').textContent = room.local ? T('practiceRoom') : room.code;
  $('inviteBtn').hidden = room.local;
  const vis = room.local ? '' : (room.data.visibility === 'public' ? '🌍 ' + T('pub') : '🔒 ' + T('priv'));
  $('visBadge').textContent = vis; $('visBadge').hidden = !vis;
  $('pCount').textContent = ids.length + '/' + SL.MAX_SEATS;
  const hostId = room.local ? me : (room.players().find(p => p.host) || {}).id;
  $('plist').innerHTML = ids.map((id, i) => { const x = exOf(id, s); return '<li style="--i:' + i + '"><span class="av">' + avOf(id, s) + '</span><span class="nm">' + esc(nameOf(id, s)) + (s.gm['p' + id] ? ' <em class="gm-tag">(GM)</em>' : id === me ? ' <em class="gm-badge">(GM)</em>' : '') + (id === me ? ' <small>' + esc(T('youTag')) + '</small>' : '') + '</span>' +
    (id === hostId ? '<span class="tag">' + esc(T('host')) + '</span>' : x ? '<span class="tag bot">' + esc(T('bot')) + '</span>' : '') +
    (host && x ? '<button type="button" class="rm" data-rm="' + id + '" aria-label="' + esc(T('remove')) + '">×</button>' : '') + '</li>'; }).join('');
  $('addBot').hidden = !host || ids.length >= SL.MAX_SEATS;
  doc.querySelectorAll('#lobby .seg').forEach(seg => {
    const k = seg.dataset.k; seg.classList.toggle('ro', !host);
    seg.querySelectorAll('button').forEach(b => { const on = String(s.set[k]) === b.dataset.v; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); b.disabled = !host && !on; });
  });
  const can = host && ids.length >= SL.MIN_SEATS;
  $('startBtn').hidden = !host; $('startBtn').disabled = !can;
  const spec = room.players().filter(p => p.spectator).length;
  $('lobbyNote').textContent = !host ? T('waitingHost') : ids.length < 2 ? T('needTwo') : (spec ? T('spectators', { n: spec }) : '');
}
async function hostEdit(type, fn) { if (!room || !room.isHost()) return; try { await room.edit(type, fn); } catch (e) { toast(errMsg(e), 'warn'); } }
function onSeg(e) {
  const b = e.target.closest('button'); if (!b || !room || !room.isHost()) return;
  const k = b.closest('.seg').dataset.k, v = b.dataset.v;
  hostEdit('set', s => { if (s.ph !== 'lobby') return null; s.set = SL.cleanSet(Object.assign({}, s.set, { [k]: Number(v) })); savedSet = s.set; setLS(SET_KEY, JSON.stringify(s.set)); });
}
function addBot(s) {
  if (participants(s).length >= SL.MAX_SEATS) return false;
  const used = new Set(s.ex.map(b => b.n)), id = Math.min(-1, ...s.ex.map(b => b.id - 1)), n = SL.BOT_NAMES.find(x => !used.has(x)) || ('Bot ' + (-id));
  s.ex.push({ id, n, av: CFG.botAvatars[(-id - 1) % CFG.botAvatars.length], b: 1 }); return true;
}
function startMatch() {
  hostEdit('start', s => {
    if (s.ph === 'play') return null; const ids = participants(s); if (ids.length < SL.MIN_SEATS) return null;
    s.nm = {}; for (const id of ids) if (id > 0) s.nm['p' + id] = nameOf(id, s).slice(0, 24); // names survive a leaver
    return SL.start(s, ids, room.now(), QN, (Math.random() * 4294967296) >>> 0) ? { status: 'playing' } : null;
  });
}

/* ---------- play ---------- */
const lastHist = s => s.hi[s.hi.length - 1] || null;
function myGain(s, h) { const id = meId(); return h && id !== null ? (h.gn['p' + id] || 0) : 0; }
const hotChip = (id, s) => '<span class="tgt"><span class="av">' + avOf(id, s) + '</span><span>🔥 ' + esc(T('hotSeat')) + ': <b>' + esc(nameOf(id, s)) + '</b>' + gmTag(id, s) + '</span></span>';
function upcoming(s) { const c = { ord: s.ord, gone: s.gone, tg: s.tg }; return SL.nextTarget(c); }
function renderPlay(s) {
  const me = meId(), act = SL.active(s), reveal = s.sub === 'reveal', h = reveal ? lastHist(s) : null;
  $('roundPill').textContent = T('round', { r: Math.min(s.r + 1, s.qs.length), n: s.qs.length });
  $('hotPill').textContent = '🔥 ' + nameOf(s.tg, s);
  $('codePill').textContent = room.local ? T('practiceRoom') : room.code;
  const q = Q(s.qs[s.r], nameOf(s.tg, s)), host = room.isHost();
  const key = [s.g, s.r, s.sub, lang, Object.keys(s.pk).sort().join(','), s.gone.join(','), act.length, Object.keys(s.gm).join(','), host].join('|');
  if (key !== keys.play) {
    const fresh = !keys.play.startsWith(s.g + '|' + s.r + '|' + s.sub + '|'); keys.play = key;
    $('qhead').innerHTML = hotChip(s.tg, s);
    $('qtext').textContent = q;
    if (fresh) { const c = $('qcard'); c.classList.remove('in'); void c.offsetWidth; c.classList.add('in'); }
    const mine = me !== null && s.pk['p' + me] ? s.pk['p' + me][0] : null;
    if (!$('pad').children.length || fresh) $('pad').innerHTML = [...Array(SL.HI)].map((_, i) => '<button type="button" class="num" data-v="' + (i + 1) + '" style="--i:' + i + ';--h:' + Math.round(200 - i * 20) + '">' + (i + 1) + '</button>').join('');
    $('pad').querySelectorAll('.num').forEach(b => b.classList.toggle('mine', Number(b.dataset.v) === mine));
    $('padLo').textContent = '1 = ' + T('scaleLo'); $('padHi').textContent = '10 = ' + T('scaleHi');
    $('padWrap').hidden = reveal;
    $('who').hidden = reveal;
    $('who').innerHTML = act.map((id, i) => '<li style="--i:' + i + '" class="' + (id === s.tg ? 'hot' : '') + (s.pk['p' + id] ? ' in' : '') + (id === me ? ' me' : '') + '"><span class="av">' + avOf(id, s) + '</span><span class="nm">' + esc(nameOf(id, s)) + gmTag(id, s) + '</span>' + (id === s.tg ? '<span class="fl">🔥</span>' : '') + (s.pk['p' + id] ? '<span class="lock" title="' + esc(T('picked')) + '">✓</span>' : '') + '</li>').join('');
    renderVerdict(s, h, fresh, host);
    renderBoard(s, h);
  }
  tickUi();
}
function renderVerdict(s, h, fresh, host) {
  const bar = $('revealBar'); bar.hidden = s.sub !== 'reveal' || !h; if (bar.hidden) return;
  const me = meId(), g = myGain(s, h), tn = esc(nameOf(h.tg, s));
  let head, cls = '', mineLine = '';
  if (h.vd) head = '<span class="vh">' + esc(T('voidHot', { name: nameOf(h.tg, s) })) + '</span>';
  else head = '<span class="vh">' + esc(T('revealAns', { name: nameOf(h.tg, s) })) + '</span><span class="big-ans"><b>' + h.ans + '</b><small>/10</small></span>';
  if (me !== null && !h.vd) {
    const p = h.pk['p' + me];
    if (me === h.tg) { if (g > 0) { mineLine = '+' + g + ' ' + T('hotBonus'); cls = 'good'; } }
    else if (p === undefined) { if (s.ord.includes(me)) { mineLine = T('noPick'); cls = 'bad'; } }
    else { const d = Math.abs(p - h.ans); mineLine = T('yourGuess', { v: p }) + ' · ' + (d === 0 ? T('exact') : T('off', { d })) + (g > 0 ? ' · +' + g + ' ' + T('pts') : ''); cls = g > 0 ? 'good' : 'bad'; }
  }
  $('verdict').innerHTML = head + (mineLine ? '<span class="vm ' + cls + '">' + esc(mineLine) + '</span>' : '');
  // 1-10 scale with the truth and every guess
  const at = {}; for (const [k, v] of Object.entries(h.pk)) { const id = Number(k.slice(1)); if (id !== h.tg) (at[v] = at[v] || []).push(id); }
  let order = 0;
  $('scale').innerHTML = h.vd ? '' : [...Array(SL.HI)].map((_, i) => { const v = i + 1, ids = at[v] || [];
    return '<div class="cell' + (v === h.ans ? ' truth' : '') + '"><span class="stack">' + ids.map(id => '<span class="vchip' + (h.best.includes(id) ? ' ok' : '') + '" style="--d:' + (order++) + '" title="' + esc(nameOf(id, s)) + '">' + avOf(id, s) + '</span>').join('') + '</span>' + (v === h.ans ? '<span class="flag">' + avOf(h.tg, s) + '</span>' : '') + '<b>' + v + '</b></div>'; }).join('');
  const guessers = Object.keys(h.pk).map(k => Number(k.slice(1))).filter(id => id !== h.tg);
  const rows = h.vd ? [] : guessers.sort((a, b) => Math.abs(h.pk['p' + a] - h.ans) - Math.abs(h.pk['p' + b] - h.ans) || ((h.gn['p' + b] || 0) - (h.gn['p' + a] || 0)));
  let html = rows.map((id, i) => { const v = h.pk['p' + id], d = Math.abs(v - h.ans), gn = h.gn['p' + id] || 0, best = h.best.includes(id);
    return '<li class="' + (best ? 'best' : '') + (id === me ? ' me' : '') + '" style="--i:' + i + '"><span class="av">' + avOf(id, s) + '</span><span class="nm">' + esc(nameOf(id, s)) + gmTag(id, s) + (best ? ' <em class="crown-tag">👑 ' + esc(T('closest')) + '</em>' : '') + '</span><span class="gv">' + v + '</span><span class="dd">' + esc(d === 0 ? T('exact') : T('off', { d })) + '</span><b class="gp">' + (gn ? '+' + gn : '0') + '</b></li>'; }).join('');
  if (!h.vd && (h.gn['p' + h.tg] || 0) > 0) html += '<li class="hotb" style="--i:' + rows.length + '"><span class="av">' + avOf(h.tg, s) + '</span><span class="nm">' + tn + gmTag(h.tg, s) + ' <em class="crown-tag">🔥 ' + esc(T('hotBonus')) + '</em></span><b class="gp">+' + h.gn['p' + h.tg] + '</b></li>';
  if (!h.vd && !rows.length) html = '<li class="muted">' + esc(T('noGuess')) + '</li>';
  $('rows').innerHTML = html;
  $('talk').textContent = h.vd ? '' : '💬 ' + T('talkTip');
  // host-only Next (never automatic)
  const last = s.r + 1 >= s.qs.length, nx = upcoming(s);
  const nb = $('nextBtn'); nb.hidden = !host; nb.disabled = false; nb.textContent = last ? T('endBtn') : T('nextBtn', { name: nameOf(nx, s) });
  $('endEarly').hidden = !host || last;
  $('waitNext').textContent = host ? T('hostHint') : T('waitNext') + (last ? '' : ' · ' + T('nextUp', { name: nameOf(nx, s) }));
  if (!$('reacts').children.length) $('reacts').innerHTML = CFG.react.map(e => '<button type="button" data-e="' + e + '" aria-label="' + esc(T('react')) + ' ' + e + '">' + e + '</button>').join('');
  if (fresh) {
    SFX.drum(); setTimeout(() => { if (cls === 'good') { SFX.good(); if (g >= 100) confetti(90, 0.45); floater('+' + g, 'pts', 50, 40); } else if (cls === 'bad') SFX.bad(); else SFX.pop(); }, reduce ? 0 : 900);
  }
}
function renderBoard(s, h) {
  const rk = SL.ranking(s), me = meId();
  $('slist').innerHTML = rk.map((r, i) => { const g = h ? (h.gn['p' + r.id] || 0) : 0; return '<li class="' + (r.out ? 'out' : '') + (r.id === me ? ' me' : '') + '"><span class="rk">' + (i + 1) + '</span><span class="av">' + avOf(r.id, s) + '</span><span class="nm">' + esc(nameOf(r.id, s)) + gmTag(r.id, s) + (r.out ? ' <small class="outtag">' + esc(T('out')) + '</small>' : '') + '</span>' + (g ? '<span class="gain">+' + g + '</span>' : '') + '<b class="sc">' + r.sc + '</b></li>'; }).join('');
}
let lastTick = -1;
function tickUi() {
  if (!room || screen !== 'play') return; const s = room.s; if (s.ph !== 'play') return;
  const now = room.now(), me = meId(), act = SL.active(s), pick = s.sub === 'pick';
  const intro = pick && now < s.t0;
  const sp = $('splash'); if (sp.hidden !== !intro) sp.hidden = !intro; { if (intro) { $('splashRound').textContent = T('round', { r: s.r + 1, n: s.qs.length }); $('splashText').textContent = Q(s.qs[s.r], nameOf(s.tg, s)); $('splashWho').innerHTML = '<span class="av">' + avOf(s.tg, s) + '</span> 🔥 ' + esc(T('hotSeat')) + ': ' + esc(nameOf(s.tg, s)); } }
  const total = s.set.t * 1000, left = pick ? Math.max(0, s.ddl - Math.max(now, s.t0)) : total;
  $('timerBar').style.width = (pick ? Math.min(1, left / total) * 100 : 100).toFixed(1) + '%';
  const secs = Math.ceil(left / 1000); $('timerNum').textContent = pick ? secs : '💬';
  $('timer').classList.toggle('low', pick && secs <= 5); $('timer').classList.toggle('rev', !pick);
  if (pick && !intro && secs <= 5 && secs !== lastTick && secs > 0) { lastTick = secs; SFX.tick(); }
  const iCan = pick && !intro && me !== null && act.includes(me) && !s.pk['p' + me];
  $('pad').classList.toggle('can', iCan); $('pad').classList.toggle('hotpad', me === s.tg);
  doc.querySelectorAll('#pad .num').forEach(b => { b.disabled = !iCan; });
  const pend = SL.pending(s).length;
  let st = '';
  if (pick) {
    const ask = me === s.tg ? T('hotYou') : T('hotAsk', { name: nameOf(s.tg, s) });
    if (me === null || !act.includes(me)) st = T('watching') + ' · ' + T('locked', { n: act.length - pend, m: act.length });
    else if (s.pk['p' + me]) st = T('picked') + ' · ' + (pend ? T('waitOthers', { n: pend }) : T('allIn'));
    else st = ask;
    if (me !== s.tg && !s.pk['p' + s.tg] && !intro) st += ' · ' + T('hotWait', { name: nameOf(s.tg, s) });
    $('qsub').textContent = ask;
  } else { st = ''; $('qsub').textContent = ''; }
  $('status').textContent = st;
}
async function choose(v) {
  if (!room) return; const s = room.s, me = meId(), now = room.now();
  if (me === null || s.sub !== 'pick' || now < s.t0 || s.pk['p' + me]) return;
  const g = s.g, r = s.r; SFX.pick();
  const btn = doc.querySelector('#pad .num[data-v="' + v + '"]'); if (btn) btn.classList.add('mine', 'tap');
  doc.querySelectorAll('#pad .num').forEach(b => { b.disabled = true; });
  try { await room.edit('pick', st => { if (st.g !== g || st.r !== r || st.sub !== 'pick') return null; const res = SL.pick(st, me, v, room.now()); if (!res.ok) return null; if (SL.due(st, room.now()) === 'reveal' && room.isHost()) SL.reveal(st, room.now(), room.local ? 0 : AFK_ROUNDS); return statusOf(st); }); }
  catch (e) { toast(errMsg(e), 'warn'); keys.play = ''; render(); }
}
/** host only: Next = next prompt for the next hot seat (the reveal never moves on by itself) */
async function hostNext(end) {
  if (!room || !room.isHost()) return; const s = room.s; if (s.ph !== 'play' || s.sub !== 'reveal') return;
  if (end && !root.confirm(T('endConfirm'))) return;
  const g = s.g, r = s.r; $('nextBtn').disabled = true;
  try { await room.edit(end ? 'end' : 'next', st => { if (st.g !== g || st.r !== r || st.sub !== 'reveal') return null; return (end ? SL.endNow(st) : SL.next(st, room.now())) ? statusOf(st) : null; }); }
  catch (e) { toast(errMsg(e), 'warn'); $('nextBtn').disabled = false; }
}

/* ---------- open chat (always open during play; everyone incl. host + spectators; shared via state.cm) ---------- */
let chatKey = '', chatAt = 0;
const localHumans = s => participants(s).filter(id => id > 0);
function chatSenders(s) { if (!room) return []; if (room.local) return localHumans(s); return room.me !== null && room.me !== undefined ? [room.me] : []; }
function paintChat(s) {
  const list = s.cm || [], senders = chatSenders(s), who = $('chatWho'), ml = room.local && senders.length > 1;
  const wk = senders.join(','); if (who.dataset.k !== wk) { who.dataset.k = wk; const cur = who.value; who.innerHTML = senders.map(id => '<option value="' + id + '">' + avOf(id, s) + ' ' + esc(nameOf(id, s)) + '</option>').join(''); if (cur && senders.includes(Number(cur))) who.value = cur; }
  who.hidden = !ml; $('chatForm').hidden = !senders.length;
  const key = lang + ':' + s.g + ':' + list.map(m => m.i).join(','); if (key === chatKey) return; chatKey = key;
  const box = $('chatList'), stick = box.scrollHeight - box.scrollTop - box.clientHeight < 40;
  box.innerHTML = list.length ? list.map(m => '<li class="' + (m.by === room.me ? 'me' : '') + '"><span class="av">' + avOf(m.by, s) + '</span><div><b>' + esc(m.n || nameOf(m.by, s)) + gmTag(m.by, s) + '</b><p>' + esc(m.t) + '</p></div></li>').join('') : '<li class="empty">' + esc(T('chatEmpty')) + '</li>';
  if (stick || (list.length && list[list.length - 1].by === room.me)) box.scrollTop = box.scrollHeight;
}
async function sendChat() {
  if (!room) return; const s = room.s, el = $('chatInput'), t = SL.cleanText(el.value, SL.LIM.chatMax); if (!t || s.ph !== 'play') return;
  if (Date.now() - chatAt < SL.LIM.chatGap) { toast(T('chatSlow'), 'warn'); return; }
  const senders = chatSenders(s); let by = room.local && senders.length > 1 ? Number($('chatWho').value) : room.me; if (!senders.includes(by)) by = senders[0]; if (by === undefined || by === null) return;
  const name = nameOf(by, s); chatAt = Date.now(); el.value = '';
  try { await room.edit('chat', x => SL.chat(x, by, name, t) ? statusOf(x) : null); }
  catch (e) { el.value = t; toast(errMsg(e), 'warn'); }
  render();
}

/* ---------- reactions ---------- */
let rxAt = 0;
function sendReact(e) {
  if (!room || Date.now() - rxAt < 900) return; const me = meId(); if (me === null) return; rxAt = Date.now();
  floater(e, 'emo mine', 30 + Math.random() * 40, 78);
  room.edit('rx', s => SL.react(s, me, e, (Math.random() * 1e9) | 0) ? statusOf(s) : null).catch(() => {});
}
function renderRx(s) {
  const fresh = []; const seen = new Set();
  for (const r of s.rx) { const k = r.join(':'); seen.add(k); if (!keys.rx.has(k)) fresh.push(r); }
  const first = keys.rx.size === 0 && keys.rxInit !== true; keys.rx = seen; keys.rxInit = true; if (first) return;
  for (const r of fresh) { if (r[0] === meId()) continue; floater(esc(r[1]) + '<small>' + esc(nameOf(r[0], s)) + '</small>', 'emo', 15 + Math.random() * 70, 80); }
}

/* ---------- end ---------- */
function renderEnd(s) {
  const key = [s.g, lang, s.ev.n, Object.keys(s.gm).join(',')].join('|'); const host = room.isHost();
  $('rematchBtn').hidden = !host; $('endNote').textContent = host ? '' : T('waitingHost');
  if (key === keys.end) return; keys.end = key;
  const rk = SL.ranking(s), top = rk.filter(r => !r.out), best = top.length ? top[0].sc : 0, winners = top.filter(r => r.sc === best);
  $('winLine').textContent = winners.length > 1 ? T('tie') + ' ' + winners.map(r => nameOf(r.id, s)).join(' & ') : winners.length ? T('winner', { name: nameOf(winners[0].id, s) }) : '';
  const pod = [rk[1], rk[0], rk[2]].filter(Boolean);
  $('podium').innerHTML = pod.map(r => { const place = rk.indexOf(r) + 1; return '<div class="pod p' + place + (r.out ? ' out' : '') + '"><span class="av big">' + avOf(r.id, s) + '</span><b>' + esc(nameOf(r.id, s)) + gmTag(r.id, s) + '</b><span class="sc">' + r.sc + '</span><span class="step">' + (place === 1 ? '🏆' : place) + '</span></div>'; }).join('');
  $('endList').innerHTML = rk.map((r, i) => '<li class="' + (r.out ? 'out' : '') + (r.id === meId() ? ' me' : '') + '"><span class="rk">' + (i + 1) + '</span><span class="av">' + avOf(r.id, s) + '</span><span class="nm">' + esc(nameOf(r.id, s)) + gmTag(r.id, s) + (r.out ? ' <small class="outtag">' + esc(T('out')) + '</small>' : '') + '</span><b class="sc">' + r.sc + '</b></li>').join('');
  const cl = Object.entries(SL.close(s)).sort((a, b) => b[1] - a[1]);
  $('closeList').innerHTML = cl.length ? cl.map(([id, n]) => '<li><span class="av">' + avOf(Number(id), s) + '</span> ' + esc(T('closeLine', { name: nameOf(Number(id), s), n })) + '</li>').join('') : '<li class="muted">' + esc(T('noClose')) + '</li>';
  $('recapList').innerHTML = s.hi.filter(h => !h.vd).map(h => '<li><span class="av">' + avOf(h.tg, s) + '</span><span class="rq"><b>' + esc(nameOf(h.tg, s)) + '</b><small>' + esc(Q(h.q, nameOf(h.tg, s))) + '</small></span><b class="ra">' + h.ans + '<small>/10</small></b></li>').join('') || '<li class="muted">—</li>';
}
function rematch() { hostEdit('lobby', s => { if (s.ph !== 'end') return null; SL.backToLobby(s); return { status: 'waiting' }; }); }

/* ---------- host loop: bots, timeouts, leavers (any seated player takes over a stale host) ---------- */
function hash(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0) / 4294967296; }
function botDue(s, id) { return s.t0 + 1200 + hash(s.g + ':' + s.r + ':' + id) * Math.min(s.set.t * 550, 9000); }
let busy = false, pruneAt = 0;
function loop() {
  tickUi();
  if (!room || !room.data || busy) return; room.tick();
  const s = room.s; if (s.ph !== 'play') return;
  const now = room.now(), host = room.isHost(), seat = !room.spectator, stale = seat && s.sub === 'pick' && now > s.ddl + N.STALE_MS; // the reveal has no deadline: only the host's Next moves on
  if (!host && !stale) return;
  const g = s.g, r = s.r, sub = s.sub, afk = room.local ? 0 : AFK_ROUNDS;
  if (!room.local && Date.now() - pruneAt > 1500) {
    pruneAt = Date.now(); const live = new Set(room.seated().map(p => p.id)), gone = s.ord.filter(id => id > 0 && !live.has(id) && !s.gone.includes(id));
    if (gone.length) { busy = true; room.edit('drop', st => { let ch = false; for (const id of gone) if (SL.drop(st, id, room.now())) ch = true; return ch ? statusOf(st) : null; }).then(() => { for (const id of gone) toast(T('left', { name: nameOf(id, s) }), 'warn'); }).catch(() => {}).then(() => { busy = false; }); return; }
  }
  if (host && sub === 'pick') {
    const due = SL.pending(s).filter(id => isBot(id, s) && now >= botDue(s, id));
    if (due.length) { busy = true; room.edit('bot', st => { if (st.g !== g || st.r !== r || st.sub !== 'pick') return null; let ch = false; for (const id of due) if (SL.pick(st, id, SL.botPick(st, id, st.g * 31 + id), room.now()).ok) ch = true; if (!ch) return null; if (SL.due(st, room.now()) === 'reveal') SL.reveal(st, room.now(), afk); return statusOf(st); }).catch(() => {}).then(() => { busy = false; }); return; }
  }
  if (SL.due(s, now)) { busy = true; room.edit('step', st => { if (st.g !== g || st.r !== r || st.sub !== sub) return null; return SL.advance(st, room.now(), afk) ? statusOf(st) : null; }).catch(() => {}).then(() => { busy = false; }); }
}

/* ---------- entering / leaving ---------- */
function attach(r) { room = r; chatKey = ''; chatAt = 0; keys.ev = -1; keys.play = ''; keys.end = ''; keys.rx = new Set(); keys.rxInit = false; screen = ''; $('reacts').innerHTML = ''; render(); }
function makeRoom(link) { return new N.Room(link, { onChange: () => render() }); }
function setDefaults() { return Object.assign({}, savedSet); }
async function startPractice() {
  const name = myName() || T('you_'); setLS(NAME_KEY, name);
  const r = makeRoom(new N.LocalLink()); await r.enter('practice', { displayName: name, av: myAv, set: setDefaults() });
  await r.edit('bots', s => { for (let i = 0; i < botN; i++) addBot(s); });
  attach(r);
}
function errMsg(e) {
  if (!e) return T('errNet'); if (e.code === 'busy') return T('errBusy', { s: e.wait || 10 }); if (e.code === 'network') return T('errNet');
  if (e.code === 'toolarge') return T('errTooLarge');
  if (e.status === 404) return T('errMissing'); return T('errGeneric', { msg: e.server || e.message || '' });
}
async function enterOnline(mode, opts) { const r = makeRoom(conn); await r.enter(mode, Object.assign({ set: setDefaults(), av: myAv }, opts)); attach(r); return r; }
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
  const r = room; room = null; gmMeSync(); chatKey = ''; show('home'); if (gm) setTimeout(gmLoad, 400);
  $('splash').hidden = true; $('floaters').innerHTML = '';
  if (r && !silent) await r.leave(); else if (r && !r.local && conn.forget) conn.forget();
  connBadge();
}
function confirmExit() { if (!room) return; if (room.s.ph === 'play' && !room.spectator && !root.confirm(T('exitConfirm'))) return; exitToMenu(false); }
function invite() {
  if (!room || room.local) return; const url = location.origin + location.pathname + '?room=' + room.code;
  const done = () => toast(T('copied'), 'good');
  if (navigator.share && /Mobi|Android/i.test(navigator.userAgent)) navigator.share({ title: T('title'), text: T('title') + ' · ' + room.code, url }).catch(() => {});
  else if (navigator.clipboard) navigator.clipboard.writeText(url).then(done, () => toast(url, '', 6000));
  else toast(url, '', 6000);
}
function onlineNote() {
  const el = $('onlineNote'); if (!el) return;
  el.textContent = !conn.allowed ? T('onlineOff') : onlineOk ? T('onlineReady') : conn.config === null && !conn.failed ? T('onlineChecking') : T('onlineDisabled');
}
/* ---------- #gamemaster: every lobby incl. private (GET rooms?gm=gamemaster) + (GM) tag via state.gm ---------- */
let gm = false, gmRooms = null, gmErr = '', gmBusy = false, gmAt = 0, gmWakeT = 0;
const gmHash = () => (location.hash || '').toLowerCase() === '#' + N.GM_KEY;
let gmUI = null;
function gmMeSync() { doc.documentElement.classList.toggle('gm-on', !!room && !room.local && room.isGamemaster()); if (gmUI) gmUI.sync(); }
/* ---------- typed gamemaster claim (BE: POST rooms/{code}/gamemaster {code}; badge = players[].gamemaster) ----------
   No visible chip: a ?gmjd query param (short trigger, not the secret) auto-opens a password-style prompt once in an online room.
   The typed code is never put in the URL or storage. ?gmjd alone grants nothing. */
function gmClaimUI({ canClaim, claim, onDone, listKey }) {
  const d = document, w = window;
  const m = d.createElement('div'); m.id = 'gmClaim'; m.setAttribute('role', 'dialog'); m.setAttribute('aria-modal', 'true'); m.setAttribute('aria-label', 'Kode gamemaster');
  m.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.45);display:none;align-items:center;justify-content:center';
  m.innerHTML = '<form id="gmClaimForm" style="background:#fff;color:#222;padding:16px;border-radius:14px;width:260px;max-width:86vw;font:14px system-ui,sans-serif;box-shadow:0 8px 30px rgba(0,0,0,.3)">'
    + '<b style="display:block;margin-bottom:8px">Kode gamemaster</b>'
    + '<input id="gmClaimInput" type="password" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Masukkan kode" maxlength="128" style="width:100%;box-sizing:border-box;padding:8px;border:1px solid #bbb;border-radius:8px;font:inherit;color:#222;background:#fff">'
    + '<p id="gmClaimErr" role="alert" style="color:#c0392b;min-height:1.2em;margin:6px 0;font-size:13px"></p>'
    + '<div style="display:flex;gap:8px;justify-content:flex-end"><button type="button" id="gmClaimCancel" style="padding:6px 12px;border-radius:8px;border:1px solid #bbb;background:#f3f3f3;color:#222;font:inherit">Batal</button>'
    + '<button type="submit" id="gmClaimOk" style="padding:6px 12px;border-radius:8px;border:0;background:#c0392b;color:#fff;font:600 14px system-ui,sans-serif">Masuk</button></div></form>';
  d.body.appendChild(m);
  const inp = m.querySelector('#gmClaimInput'), er = m.querySelector('#gmClaimErr'), ok = m.querySelector('#gmClaimOk');
  // no visible chip: only a ?gmjd query param (not the secret; value ignored) arms the prompt; intent survives the home/gate screen until a room is entered
  const trig = () => /[?&]gmjd(=|&|$)/i.test(w.location.search || '');
  let busy = false, want = trig(), asked = false;
  const close = () => { m.style.display = 'none'; inp.value = ''; er.textContent = ''; };
  const open = () => { if (!canClaim()) return; er.textContent = ''; inp.value = ''; m.style.display = 'flex'; setTimeout(() => inp.focus(), 20); };
  m.addEventListener('click', e => { if (e.target === m) close(); });
  m.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Escape') close(); });
  m.addEventListener('keyup', e => e.stopPropagation());
  m.querySelector('#gmClaimCancel').addEventListener('click', close);
  m.querySelector('#gmClaimForm').addEventListener('submit', async e => {
    e.preventDefault(); e.stopPropagation(); const code = inp.value.trim(); if (!code || busy) { inp.focus(); return; }
    busy = true; ok.disabled = true; er.textContent = '';
    try {
      await claim(code); want = false; close();
      // strip ?gmjd so a refresh doesn't re-prompt (other params like ?room= are kept)
      if (trig() && w.history && w.history.replaceState) { const u = new URL(w.location.href); for (const k of [...u.searchParams.keys()]) if (k.toLowerCase() === 'gmjd') u.searchParams.delete(k); w.history.replaceState(w.history.state, '', u.pathname + u.search + u.hash); }
      sync(); if (onDone) onDone();
    }
    catch (x) { inp.value = ''; er.textContent = x && x.status === 403 ? 'Kode salah.' : 'Gagal, coba lagi.'; inp.focus(); }
    finally { busy = false; ok.disabled = false; }
  });
  function sync() {
    const on = !!canClaim();
    if (!on) { asked = false; if (m.style.display !== 'none' && !busy) close(); return; }
    if (want && !asked) { asked = true; open(); }
  }
  return { sync, open, close };
}
function gmSync() {
  const on = gmHash(); if (on === gm) return; gm = on; gmRooms = null; gmErr = '';
  const box = $('gmRooms'); if (box) box.hidden = !gm; if (gm) gmLoad(); else renderGm();
}
async function gmLoad() {
  if (!gm || gmBusy) return; if (!onlineOk) { renderGm(); return; }
  gmBusy = true; gmAt = Date.now(); renderGm();
  try { const d = await conn.rooms({ gm: true }); gmRooms = Array.isArray(d && d.rooms) ? d.rooms : []; gmErr = ''; }
  catch (e) { gmErr = errMsg(e); }
  finally { gmBusy = false; renderGm(); }
}
function gmWake() { if (!gm || room) return; clearTimeout(gmWakeT); gmWakeT = setTimeout(gmLoad, 1200); }
function renderGm() {
  const box = $('gmRooms'); if (!box) return; box.hidden = !gm; if (!gm) return;
  const list = gmRooms || [];
  $('gmNote').textContent = !conn.allowed ? T('onlineOff') : !onlineOk ? (conn.config === null && !conn.failed ? T('onlineChecking') : T('onlineDisabled'))
    : gmErr ? T('gmErr', { msg: gmErr }) : gmRooms === null ? T('gmLoading') : list.length ? T('gmCount', { n: list.length }) : T('gmEmpty');
  $('gmRefresh').disabled = !onlineOk || gmBusy;
  $('gmList').innerHTML = list.map(r => {
    const code = esc(r.code), priv = r.visibility === 'private', playing = r.status === 'playing';
    return '<li data-code="' + code + '"><b class="code">' + code + '</b><span class="gm-meta"><span class="badge' + (priv ? ' priv">' + esc(T('gmPrivate')) : '">' + esc(T('gmPublic'))) + '</span> <span class="badge st">' + esc(T(playing ? 'gmPlaying' : 'gmWaiting')) + '</span><br><small class="muted">'
      + esc(T('gmPlayers', { n: Number(r.seated) || 0, max: Number(r.maxPlayers) || 0, w: Number(r.spectators) || 0 })) + '</small></span><span class="gm-act">'
      + (playing ? '' : '<button type="button" class="btn pink small online-btn" data-gm="join" data-code="' + code + '">' + esc(T('gmJoin')) + '</button>')
      + '<button type="button" class="btn ghost small online-btn" data-gm="watch" data-code="' + code + '">' + esc(T('gmWatch')) + '</button></span></li>';
  }).join('');
}
async function gmEnter(mode, code) {
  if (!/^[A-Z2-9]{6}$/.test(code || '')) return; $('codeInput').value = code;
  if (mode === 'join') return onlineAction('join');
  const name = myName(); if (!name) { toast(T('errName'), 'warn'); $('nameInput').focus(); return; }
  setLS(NAME_KEY, name); try { await enterOnline('watch', { displayName: name, code }); } catch (e) { toast(errMsg(e), 'warn', 4000); }
}
function paintMute() { const b = $('muteBtn'); if (b) b.textContent = muted ? '🔇' : '🔊'; }

/* ---------- boot ---------- */
function fitVh() { const h = root.visualViewport ? root.visualViewport.height : innerHeight; doc.documentElement.style.setProperty('--vh', Math.round(h) + 'px'); }
async function boot() {
  const langOpts = LANGS.map(l => '<option value="' + l + '">' + esc(CFG.text[l].langName) + '</option>').join('');
  doc.querySelectorAll('select.lang-pick').forEach(el => { el.innerHTML = langOpts; });
  applyLang();
  $('nameInput').value = getLS(NAME_KEY);
  $('avPick').innerHTML = CFG.avatars.map((a, i) => '<button type="button" role="radio" data-i="' + i + '" aria-label="Avatar ' + (i + 1) + '">' + a + '</button>').join('');
  const paintAv = () => $('avPick').querySelectorAll('button').forEach(b => { const on = Number(b.dataset.i) === myAv; b.classList.toggle('on', on); b.setAttribute('aria-checked', on); });
  paintAv();
  $('avPick').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; myAv = Number(b.dataset.i); setLS(AV_KEY, String(myAv)); paintAv(); if (room) room.hello(myAv, null).catch(() => {}); });
  const paintBots = () => $('botCount').querySelectorAll('button').forEach(b => { const on = Number(b.dataset.v) === botN; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); });
  paintBots(); $('botCount').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; botN = Number(b.dataset.v); setLS(BOTS_KEY, String(botN)); paintBots(); });
  // per-client language: works on home, lobby, play, reveal and end; re-renders the current prompt from this client's bank
  doc.querySelectorAll('select.lang-pick').forEach(el => el.addEventListener('change', e => { if (!LANGS.includes(e.target.value)) return; lang = e.target.value; setLS(LANG_KEY, lang); applyLang(); }));
  $('practiceBtn').addEventListener('click', () => startPractice().catch(e => toast(errMsg(e), 'warn')));
  $('createPrivate').addEventListener('click', () => onlineAction('private'));
  $('createPublic').addEventListener('click', () => onlineAction('public'));
  $('quickMatch').addEventListener('click', () => onlineAction('match'));
  $('joinForm').addEventListener('submit', e => { e.preventDefault(); onlineAction('join'); });
  $('codeInput').addEventListener('input', e => { e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''); });
  doc.querySelectorAll('#lobby .seg').forEach(seg => seg.addEventListener('click', onSeg));
  $('plist').addEventListener('click', e => { const b = e.target.closest('[data-rm]'); if (!b) return; const id = Number(b.dataset.rm); hostEdit('exDel', s => { if (s.ph !== 'lobby') return null; s.ex = s.ex.filter(x => x.id !== id); }); });
  $('addBot').addEventListener('click', () => hostEdit('botAdd', s => s.ph === 'lobby' && addBot(s) ? {} : null));
  $('startBtn').addEventListener('click', startMatch);
  $('inviteBtn').addEventListener('click', invite);
  $('lobbyExit').addEventListener('click', () => exitToMenu(false));
  $('playExit').addEventListener('click', confirmExit);
  $('endExit').addEventListener('click', () => exitToMenu(false));
  $('endMenu').addEventListener('click', () => exitToMenu(false));
  $('rematchBtn').addEventListener('click', rematch);
  $('pad').addEventListener('click', e => { const b = e.target.closest('.num'); if (b && !b.disabled) choose(Number(b.dataset.v)); });
  $('nextBtn').addEventListener('click', () => hostNext(false));
  $('endEarly').addEventListener('click', () => hostNext(true));
  $('chatForm').addEventListener('submit', e => { e.preventDefault(); sendChat(); });
  $('reacts').addEventListener('click', e => { const b = e.target.closest('[data-e]'); if (b) sendReact(b.dataset.e); });
  $('gmRefresh').addEventListener('click', gmLoad);
  $('gmList').addEventListener('click', e => { const b = e.target.closest('[data-gm]'); if (b) gmEnter(b.dataset.gm, b.dataset.code); });
  root.addEventListener('hashchange', gmSync); setInterval(() => { if (gm && !room && doc.visibilityState === 'visible' && Date.now() - gmAt > 10000) gmLoad(); }, 2000);
  $('muteBtn').addEventListener('click', () => { muted = !muted; setLS(MUTE_KEY, muted ? '1' : '0'); paintMute(); });
  root.addEventListener('resize', fitVh); if (root.visualViewport) root.visualViewport.addEventListener('resize', fitVh); fitVh();
  root.addEventListener('pagehide', () => { if (room && !room.local) conn.leaveBeacon(); });
  doc.addEventListener('visibilitychange', () => { if (doc.visibilityState === 'visible' && conn.config) conn.visible(); });
  setInterval(loop, 200);
  gmUI = gmClaimUI({ listKey: N.GM_KEY, canClaim: () => !!room && !!room.data && !room.local && !room.isGamemaster(), claim: code => room.claimGamemaster(code), onDone: () => { toast('Mode gamemaster aktif'); render(); } });
  if (!reduce) setInterval(() => { if (screen === 'home' || screen === '') { heroI++; heroQ(); } }, 3800);
  gmSync();
  if (conn.allowed) {
    onlineNote();
    try { await conn.start(); onlineOk = true; } catch (e) { conn.failed = true; onlineOk = false; }
    doc.querySelectorAll('.online-btn').forEach(b => { b.disabled = !onlineOk; }); onlineNote();
  } else onlineNote();
  gmSync(); if (gm && gmRooms === null) gmLoad();
  if (conn.code && conn.token) { try { await conn.leave(); } catch (e) { conn.forget(); } }
  const JR = root.JRInvite, invCode = JR && JR.code ? JR.code('room') : '';
  if (invCode && JR.run) {
    JR.run({ code: invCode, lang: lang === 'id' || lang === 'ms' ? 'id' : 'en', gameName: T('title'), nameKey: NAME_KEY, nameMax: 24, accent: '#ff4f9a',
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
root.SLApp = { get room() { return room; }, get gm() { return gm; }, get lang() { return lang; }, gmLoad, conn, render, loop };
})(window);

/* Sambung Coret: UI, drawing board, host loop (bots / timeouts / stand-ins), pass-and-play, slideshow. */
(function (root) {
'use strict';
const doc = document, $ = id => doc.getElementById(id), SC = root.SC, N = root.SCNet;
const CFG = JSON.parse($('website-config').textContent);
const PAL = CFG.palette, SIZES = [2, 4, 7, 12, 20];
const getLS = k => { try { return localStorage.getItem(k) || ''; } catch (e) { return ''; } };
const setLS = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* private mode */ } };
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = (s, v) => String(s).replace(/\{(\w+)\}/g, (m, k) => v && v[k] !== undefined ? v[k] : m);
const NAME_KEY = 'sambungcoret.name', LANG_KEY = 'sambungcoret.lang', AV_KEY = 'sambungcoret.av', SET_KEY = 'sambungcoret.set', MUTE_KEY = 'sambungcoret.mute', BOTS_KEY = 'sambungcoret.bots';
let lang = getLS(LANG_KEY) === 'en' ? 'en' : 'id';
const T = (k, v) => { const a = CFG.text[lang] || CFG.text.id; return fmt(a[k] !== undefined ? a[k] : (CFG.text.id[k] !== undefined ? CFG.text.id[k] : k), v); };
const TA = k => (CFG.text[lang] && CFG.text[lang][k]) || CFG.text.id[k] || [];
let myAv = Math.min(CFG.avatars.length - 1, Math.max(0, parseInt(getLS(AV_KEY), 10) || 0));
let botN = [0, 1, 2, 3, 5, 7].includes(parseInt(getLS(BOTS_KEY), 10)) ? parseInt(getLS(BOTS_KEY), 10) : 3;
let muted = getLS(MUTE_KEY) === '1';
let savedSet = {}; try { savedSet = JSON.parse(getLS(SET_KEY) || '{}') || {}; } catch (e) { savedSet = {}; }
const reduce = root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches;

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
  ok: () => beep([[660, 0.08, 'triangle'], [990, 0.14, 'triangle']]),
  tick: () => beep([[1000, 0.04, 'square', 0.05]]),
  go: () => beep([[392, 0.08, 'square', 0.07], [587, 0.08, 'square', 0.07], [784, 0.2, 'square', 0.07]]),
  page: () => beep([[520, 0.05, 'triangle', 0.08], [700, 0.07, 'triangle', 0.08]]),
  win: () => beep([[523, 0.12], [659, 0.12], [784, 0.12], [1047, 0.3]])
};

/* ---------- toasts / confetti ---------- */
function toast(msg, cls, ms) {
  const box = $('toasts'), el = doc.createElement('div'); el.className = 'toast ' + (cls || ''); el.textContent = msg; box.appendChild(el);
  while (box.children.length > 3) box.firstChild.remove();
  setTimeout(() => el.remove(), ms || 2600);
}
let confT = 0;
function confetti(n) {
  if (reduce) return; const cv = $('fx'), cx = cv.getContext('2d'), dpr = Math.min(2, root.devicePixelRatio || 1);
  cv.width = innerWidth * dpr; cv.height = innerHeight * dpr; cx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const cols = ['#e8553b', '#1aa39a', '#ffd23f', '#3d7dd8', '#f25f8b', '#2b2118'], P = [];
  for (let i = 0; i < (n || 140); i++) P.push({ x: innerWidth / 2 + (Math.random() - 0.5) * 160, y: innerHeight * 0.3, vx: (Math.random() - 0.5) * 14, vy: -Math.random() * 13 - 4, r: Math.random() * 6 + 4, c: cols[i % cols.length], a: Math.random() * 6, va: (Math.random() - 0.5) * 0.4 });
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
  doc.querySelectorAll('[data-ta]').forEach(el => { el.setAttribute('aria-label', T(el.dataset.ta)); el.title = T(el.dataset.ta); });
  doc.querySelectorAll('.lb').forEach(b => { b.classList.toggle('on', b.dataset.lang === lang); b.setAttribute('aria-pressed', b.dataset.lang === lang); });
  const term = doc.querySelector('.site-footer a[href="/syarat-ketentuan"]'); if (term) term.textContent = T('terms');
  $('howList').innerHTML = TA('how').map(s => '<li>' + s + '</li>').join('');
  $('lenList').innerHTML = TA('lenHow').map(s => '<li>' + s + '</li>').join('');
  $('facts').innerHTML = TA('facts').map(s => '<li>' + esc(s) + '</li>').join('');
  renderGm();
  const hub = $('jr-hub'); if (hub) { const l = lang === 'en' ? 'Back to JaRing Game Hub' : 'Kembali ke JaRing Game Hub'; hub.setAttribute('aria-label', l); hub.title = l; }
  paintMute(); onlineNote(); showKey = ''; playKey = ''; chatKey = ''; render();
}

/* ---------- names / avatars ---------- */
const exOf = (id, s) => { s = s || (room && room.s); return s ? s.ex.find(x => x.id === id) : null; };
function nameOf(id, s) { const x = exOf(id, s); if (x) return x.n; const p = room && room.players().find(q => q.id === id); return p ? String(p.displayName || '') : T('player'); }
function avOf(id, s) {
  s = s || (room && room.s); const x = exOf(id, s); if (x) return x.av;
  const a = s && s.av.find(q => q[0] === id); return CFG.avatars[a ? a[1] % CFG.avatars.length : Math.abs(id) % CFG.avatars.length];
}
const isBot = (id, s) => { const x = exOf(id, s); return !!(x && x.b); };
function participants(s) { const hum = room ? room.seated().map(p => p.id) : []; return hum.concat(s.ex.map(b => b.id)).slice(0, SC.MAX_SEATS); }
function localHumans(s) { if (!room) return []; if (!room.local) return room.spectator ? [] : [room.me]; return [room.me].concat(s.ex.filter(x => !x.b).map(x => x.id)); }
const multiLocal = s => room && room.local && localHumans(s).length > 1;
function myName() { return $('nameInput').value.replace(/\s+/g, ' ').trim().slice(0, 24); }
const statusOf = st => ({ status: st.ph === 'play' ? 'playing' : 'waiting' });

/* ---------- screens ---------- */
function show(id) {
  if (screen === id) return; screen = id;
  for (const s of ['home', 'lobby', 'play', 'show']) $(s).hidden = s !== id;
  doc.documentElement.classList.toggle('in-room', id !== 'home');
  doc.documentElement.classList.toggle('jr-hub-off', id !== 'home');
  doc.documentElement.classList.toggle('in-play', id === 'play');
  root.scrollTo(0, 0);
}
function render() {
  gmMeSync();
  if (!room || !room.data) return;
  if (room.gone) { toast(T('roomGone'), 'warn'); exitToMenu(true); return; }
  const s = room.s;
  if (s.ph === 'lobby') { show('lobby'); renderLobby(s); }
  else if (s.ph === 'play') { show('play'); renderPlay(s); }
  else { show('show'); renderShow(s); }
  if (s.ev.n !== lastEv) { const first = lastEv < 0; lastEv = s.ev.n; if (!first) onEvent(s.ev, s); }
  connBadge();
}
let lastEv = -1;
function onEvent(ev) { if (ev.k === 'start' || ev.k === 'step') SFX.go(); else if (ev.k === 'end') { SFX.win(); confetti(); } }

/* ---------- lobby ---------- */
function renderLobby(s) {
  const host = room.isHost(), ids = participants(s), me = room.me;
  $('roomCode').textContent = room.local ? T('practiceRoom') : room.code;
  $('inviteBtn').hidden = room.local;
  $('pCount').textContent = ids.length + '/' + SC.MAX_SEATS;
  const hostId = room.local ? me : (room.players().find(p => p.host) || {}).id;
  $('plist').innerHTML = ids.map(id => { const x = exOf(id, s); return '<li><span class="av">' + avOf(id, s) + '</span><span class="nm">' + esc(nameOf(id, s)) + (s.gm['p' + id] ? ' <em class="gm-tag">(GM)</em>' : id === me ? ' <em class="gm-badge">(GM)</em>' : '') + (id === me ? ' <small>(' + esc(T('you')) + ')</small>' : '') + '</span>' +
    (id === hostId ? '<span class="tag">' + esc(T('host')) + '</span>' : x ? '<span class="tag' + (x.b ? '' : ' loc') + '">' + esc(T(x.b ? 'bot' : 'localTag')) + '</span>' : '') +
    (host && x ? '<button type="button" class="rm" data-rm="' + id + '" aria-label="' + esc(T('remove')) + '">×</button>' : '') + '</li>'; }).join('');
  const full = ids.length >= SC.MAX_SEATS;
  $('addBot').hidden = !host || full; $('localForm').hidden = !room.local || full; $('localNote').hidden = !room.local;
  doc.querySelectorAll('#lobby .seg').forEach(seg => {
    const k = seg.dataset.k; seg.classList.toggle('ro', !host);
    seg.querySelectorAll('button').forEach(b => { const on = String(s.set[k]) === b.dataset.v; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); b.disabled = !host && !on; });
  });
  $('dtRow').hidden = s.set.mode !== 'gambar';
  const n = Math.max(2, ids.length), L = SC.lenSteps(s.set, n);
  $('lenNote').textContent = T(s.set.mode === 'gambar' ? 'lenNoteG' : 'lenNoteC', { n, L, S: SC.totalSteps(s.set, n) });
  const can = host && ids.length >= SC.MIN_SEATS;
  $('startBtn').hidden = !host; $('startBtn').disabled = !can;
  const spec = room.players().filter(p => p.spectator).length;
  $('lobbyNote').textContent = !host ? T('waitingHost') : ids.length < 2 ? T('needTwo') : (spec ? T('spectators', { n: spec }) : '');
}
async function hostEdit(type, fn) { if (!room || !room.isHost()) return; try { await room.edit(type, fn); } catch (e) { toast(errMsg(e), 'warn'); } }
function onSeg(e) {
  const b = e.target.closest('button'); if (!b || !room || !room.isHost()) return;
  const k = b.parentElement.dataset.k, v = b.dataset.v;
  hostEdit('set', s => { if (s.ph !== 'lobby') return null; s.set = SC.cleanSet(Object.assign({}, s.set, { [k]: k === 'mode' || k === 'len' ? v : Number(v) })); savedSet = s.set; setLS(SET_KEY, JSON.stringify(s.set)); });
}
function addExtra(s, bot, name) {
  if (participants(s).length >= SC.MAX_SEATS) return false;
  if (bot) {
    const used = new Set(s.ex.map(b => b.n)), id = Math.min(-1, ...s.ex.filter(x => x.id < 0).map(b => b.id - 1)), n = SC.BOT_NAMES.find(x => !used.has(x)) || ('Bot ' + (-id));
    s.ex.push({ id, n, av: CFG.botAvatars[(-id - 1) % CFG.botAvatars.length], b: 1 });
  } else {
    const id = Math.max(100, ...s.ex.map(x => x.id)) + 1, used = new Set(s.av.map(a => a[1]).concat(s.ex.map(x => CFG.avatars.indexOf(x.av))));
    const ai = Math.max(0, CFG.avatars.findIndex((a, i) => !used.has(i)));
    s.ex.push({ id, n: name || (T('player') + ' ' + (id - 99)), av: CFG.avatars[ai], b: 0 });
  }
  return true;
}
function startMatch() {
  hostEdit('start', s => {
    if (s.ph === 'play') return null; const ids = participants(s); if (ids.length < SC.MIN_SEATS) return null;
    s.set.bl = lang; SC.start(s, ids, room.now()); return { status: 'playing' };
  });
}

/* ---------- drawing board ---------- */
function hexRgb(h) { const m = /^#?([0-9a-f]{6})$/i.exec(h || ''); const n = m ? parseInt(m[1], 16) : 0; return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
class Board {
  constructor(cv, interactive) {
    this.cv = cv; this.ctx = cv.getContext('2d', { willReadFrequently: true }); this.k = cv.width / SC.W;
    this.base = doc.createElement('canvas'); this.base.width = cv.width; this.base.height = cv.height; this.bctx = this.base.getContext('2d', { willReadFrequently: true });
    this.mine = []; this.ink = 0; this.tool = 'brush'; this.color = 1; this.size = 1; this.enabled = false; this.cur = null; this.onInk = () => {}; this.onEmpty = () => {};
    this.paper(this.bctx); this.redraw();
    if (interactive) {
      cv.addEventListener('pointerdown', e => this.down(e));
      cv.addEventListener('pointermove', e => this.move(e));
      ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(n => cv.addEventListener(n, e => this.up(e)));
    }
  }
  paper(c) { c.setTransform(1, 0, 0, 1, 0, 0); c.fillStyle = PAL[0]; c.fillRect(0, 0, this.cv.width, this.cv.height); }
  stroke(c, op, from) {
    const p = op.pts, col = PAL[op.c] || PAL[1], w = SIZES[op.z] || 4; c.setTransform(this.k, 0, 0, this.k, 0, 0);
    c.lineCap = 'round'; c.lineJoin = 'round'; c.strokeStyle = col; c.fillStyle = col; c.lineWidth = w;
    if (p.length === 1 || (from === 0 && p.length === 1)) { c.beginPath(); c.arc(p[0][0], p[0][1], w / 2, 0, Math.PI * 2); c.fill(); return; }
    const s = Math.max(1, from || 0); if (s >= p.length) return;
    c.beginPath(); c.moveTo(p[s - 1][0], p[s - 1][1]); for (let i = s; i < p.length; i++) c.lineTo(p[i][0], p[i][1]); c.stroke();
  }
  flood(c, lx, ly, hex) {
    c.setTransform(1, 0, 0, 1, 0, 0); const Wp = this.cv.width, Hp = this.cv.height, x = Math.min(Wp - 1, Math.floor(lx * this.k)), y = Math.min(Hp - 1, Math.floor(ly * this.k));
    const img = c.getImageData(0, 0, Wp, Hp), d = img.data, n = Wp * Hp, rgb = hexRgb(hex), i0 = (y * Wp + x) * 4, tr = d[i0], tg = d[i0 + 1], tb = d[i0 + 2];
    if (Math.abs(tr - rgb[0]) + Math.abs(tg - rgb[1]) + Math.abs(tb - rgb[2]) < 10) return;
    const seen = new Uint8Array(n), stack = [y * Wp + x]; seen[y * Wp + x] = 1;
    const match = p => { const j = p * 4; return Math.abs(d[j] - tr) + Math.abs(d[j + 1] - tg) + Math.abs(d[j + 2] - tb) <= 110; };
    const visit = q => { if (!seen[q]) { if (match(q)) { seen[q] = 1; stack.push(q); } else seen[q] = 2; } };
    while (stack.length) { const p = stack.pop(), px = p % Wp; if (px > 0) visit(p - 1); if (px < Wp - 1) visit(p + 1); if (p >= Wp) visit(p - Wp); if (p < n - Wp) visit(p + Wp); }
    for (let p = 0; p < n; p++) if (seen[p]) { const j = p * 4; d[j] = rgb[0]; d[j + 1] = rgb[1]; d[j + 2] = rgb[2]; d[j + 3] = 255; }
    c.putImageData(img, 0, 0);
  }
  apply(c, str, from) { const op = SC.decodeOp(str); if (!op) return; if (op.t === 's') this.stroke(c, op, from || 0); else this.flood(c, op.x, op.y, PAL[op.c] || PAL[1]); }
  setBase(ops) { this.paper(this.bctx); for (const o of ops) this.apply(this.bctx, o); this.mine = []; this.redraw(); }
  redraw() { const c = this.ctx; c.setTransform(1, 0, 0, 1, 0, 0); c.drawImage(this.base, 0, 0); for (const o of this.mine) this.apply(c, o); this.onInk(); }
  used() { return SC.opsLen(this.mine); }
  left() { return this.ink ? Math.max(0, this.ink - this.used()) : Infinity; }
  pos(e) { const r = this.cv.getBoundingClientRect(); return [SC.clamp((e.clientX - r.left) / r.width * SC.W, 0, SC.W - 1), SC.clamp((e.clientY - r.top) / r.height * SC.H, 0, SC.H - 1)]; }
  down(e) {
    if (!this.enabled || (e.button !== undefined && e.button > 0)) return; e.preventDefault();
    if (this.left() < 12) { this.onEmpty(); return; }
    const p = this.pos(e);
    if (this.tool === 'fill') { const op = SC.encodeFill(this.color, Math.round(p[0]), Math.round(p[1])); this.mine.push(op); this.apply(this.ctx, op); this.onInk(); return; }
    try { this.cv.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    this.cur = { c: this.tool === 'eraser' ? 0 : this.color, z: this.size, pts: [p], id: e.pointerId };
    this.stroke(this.ctx, { c: this.cur.c, z: this.cur.z, pts: [p] }, 0);
  }
  move(e) {
    if (!this.cur || e.pointerId !== this.cur.id) return; e.preventDefault();
    const list = e.getCoalescedEvents ? e.getCoalescedEvents() : []; const evs = list.length ? list : [e];
    for (const ev of evs) {
      const q = this.pos(ev), pts = this.cur.pts, l = pts[pts.length - 1];
      if (Math.hypot(q[0] - l[0], q[1] - l[1]) < 1.6) continue;
      pts.push(q); this.stroke(this.ctx, { c: this.cur.c, z: this.cur.z, pts }, pts.length - 1);
      if (pts.length >= 1500) { const keep = { c: this.cur.c, z: this.cur.z, id: this.cur.id }; this.finish(); this.cur = Object.assign(keep, { pts: [q] }); }
    }
  }
  up(e) { if (!this.cur || (e.pointerId !== undefined && e.pointerId !== this.cur.id)) return; this.finish(); }
  finish() {
    const cur = this.cur; this.cur = null; if (!cur) return;
    let pts = SC.simplify(cur.pts, 0.7), op = SC.encodeStroke(cur.c, cur.z, pts); const room_ = this.left();
    if (op.length + 3 > room_) { while (pts.length > 1 && op.length + 3 > room_) { pts = pts.slice(0, Math.max(1, Math.floor(pts.length * 0.8))); op = SC.encodeStroke(cur.c, cur.z, pts); } if (op.length + 3 > room_) op = ''; this.onEmpty(); }
    if (op) this.mine.push(op); this.redraw();
  }
  cancel() { if (this.cur) { this.cur = null; this.redraw(); } }
  undo() { if (this.mine.length) { this.mine.pop(); this.redraw(); } }
  clear() { this.mine = []; this.redraw(); }
  ops() { if (this.cur) this.finish(); return this.mine.slice(); }
}
const board = new Board($('board'), true), showBoard = new Board($('showBoard'), false);

/* ---------- play ---------- */
let actor = null, actorDdl = 0, playKey = '', sentKey = '', tickLast = -1, inkWarned = false;
function myId(s) { if (!room || room.spectator) return null; if (!room.local) return room.me; return multiLocal(s) ? actor : room.me; }
function deadline(s) { return multiLocal(s) ? actorDdl : s.ddl; }
function renderPlay(s) {
  const now = room.now(), kind = SC.kindAt(s), me = myId(s);
  $('stepPill').textContent = T('stepN', { k: Math.min(s.S, s.k + 1), S: s.S });
  $('kindPill').textContent = T('kind_' + kind);
  $('codePill').textContent = room.local ? T('practiceRoom') : room.code;
  // progress strip: who already submitted this step
  $('dstrip').innerHTML = s.ord.map(id => { const i = SC.albumFor(s, id), done = SC.isDone(s, i), gone = s.gone.includes(id); return '<li class="' + (done ? 'done' : '') + (gone ? ' gone' : '') + (id === me ? ' me' : '') + '" title="' + esc(nameOf(id, s)) + '"><span class="av">' + avOf(id, s) + '</span><span class="nm">' + esc(nameOf(id, s)) + '</span><i>' + (done ? '✓' : '…') + '</i></li>'; }).join('');
  // pass-and-play hand-off
  const ml = multiLocal(s), pendLocal = ml ? SC.pending(s).filter(id => localHumans(s).includes(id)) : [];
  if (ml && actor !== null && !pendLocal.includes(actor)) actor = null;
  const hand = ml && actor === null && pendLocal.length > 0 && now >= s.t0;
  $('handoff').hidden = !hand; if (hand) { $('handName').textContent = avOf(pendLocal[0], s) + ' ' + nameOf(pendLocal[0], s); $('handGo').dataset.id = pendLocal[0]; }
  // which task
  const i = me === null ? -1 : SC.albumFor(s, me), mine = i >= 0 && !SC.isDone(s, i) && !s.gone.includes(me);
  const task = mine ? kind : 'wait', key = s.g + ':' + s.k + ':' + me + ':' + task;
  ['taskSent', 'taskTitle', 'taskDraw', 'taskWait'].forEach(t => { $(t).hidden = t !== { sent: 'taskSent', title: 'taskTitle', draw: 'taskDraw', wait: 'taskWait' }[task]; });
  $('stage').dataset.task = task;
  if (key !== playKey) { playKey = key; setupTask(s, task, i, me); }
  if (task === 'wait') {
    const left = SC.pending(s).length, watching = me === null && !ml;
    $('waitEmoji').textContent = watching ? '👀' : ml && actor === null ? '🤝' : '✅';
    $('waitHead').textContent = watching ? T('watching') : ml && actor === null ? T('passWait') : T('sentWait');
    $('waitSub').textContent = left ? T('waitLeft', { n: left }) : T('nextSoon');
  }
  tickUi();
}
function setupTask(s, task, i, me) {
  sentKey = ''; inkWarned = false; board.enabled = false; board.cancel();
  if (task === 'sent') {
    const a = s.al[i], k = s.k, last = k === s.S - 1;
    $('sentHead').textContent = k === 0 ? T('storyStart') : T('storyLastOnly');
    $('storySoFar').innerHTML = k === 0 ? '<li class="empty">' + esc(T('storyEmpty')) + '</li>' : '<li class="last">' + esc(a.e[a.e.length - 1].t) + '</li>';
    $('sentLabel').textContent = k === 0 ? T('sentFirst') : last ? T('sentLast') : T('sentNext');
    $('sentInput').value = ''; updCnt('sent'); focusSoon($('sentInput'));
    const box = $('storySoFar'); box.scrollTop = box.scrollHeight;
  } else if (task === 'title') { $('titleInput').value = ''; updCnt('title'); focusSoon($('titleInput')); }
  else if (task === 'draw') {
    board.ink = s.ink; board.setBase(SC.canvasOps(s, i, s.k)); board.enabled = true;
    $('drawTitle').textContent = SC.titleOf(s, i) || '…'; $('drawWho').textContent = T('drawStep', { j: s.k, L: s.S - 1 }) + (s.k === s.S - 1 ? ' · ' + T('drawLast') : '');
  }
}
function focusSoon(el) { if (matchMedia('(pointer:coarse)').matches) return; setTimeout(() => { try { el.focus({ preventScroll: true }); } catch (e) { el.focus(); } }, 80); }
function updCnt(w) { const el = $(w + 'Input'); $(w + 'Cnt').textContent = el.value.length + '/' + el.maxLength; }
async function submit(content, auto) {
  if (!room) return; const s = room.s, me = myId(s), k = s.k, g = s.g, key = playKey; if (me === null || sentKey === key) return;
  sentKey = key; board.enabled = false; let res = null;
  try {
    await room.edit('put', st => { if (st.g !== g || st.k !== k || st.ph !== 'play') return null; res = SC.put(st, me, content, room.now(), auto); return res.ok ? statusOf(st) : null; });
    if (res && res.ok) { SFX.ok(); if (multiLocal(room.s) && actor === me) actor = null; }
    else if (res && res.why === 'empty') { sentKey = ''; board.enabled = true; toast(T('errEmpty'), 'warn'); }
  } catch (e) { sentKey = ''; board.enabled = true; toast(errMsg(e), 'warn'); }
  render();
}
function sendText(w) { const v = SC.cleanText($(w + 'Input').value, w === 'title' ? SC.LIM.titleMax : SC.LIM.textMax); if (!v) { toast(T('errEmpty'), 'warn'); return; } submit(v, 0); }
function idea(w) {
  const s = room && room.s; if (!s) return; const el = $(w + 'Input');
  el.value = w === 'title' ? SC.botTitle(lang) : SC.botSentence(lang, s.k, s.k === s.S - 1); updCnt(w); el.focus();
}
/** auto-submit my draft at the deadline (empty text becomes a marked filler) */
function autoSubmit(s, now) {
  const me = myId(s); if (me === null || !playKey || sentKey === playKey) return; const i = SC.albumFor(s, me); if (i < 0 || SC.isDone(s, i)) return;
  if (now < deadline(s) - 350 || now < s.t0) return; const kind = SC.kindAt(s);
  if (kind === 'draw') { submit(board.ops(), 0); return; }
  const v = SC.cleanText($(kind === 'title' ? 'titleInput' : 'sentInput').value, kind === 'title' ? SC.LIM.titleMax : SC.LIM.textMax);
  if (v) submit(v, 0); else submit(SC.botContent(kind, s, i), 1);
}
function tickUi() {
  if (!room || screen !== 'play') return;
  const s = room.s, now = room.now(), ml = multiLocal(s);
  const total = SC.stepMs(s), dl = ml ? (actor !== null ? actorDdl : now + total) : s.ddl, left = s.ph === 'play' ? Math.max(0, Math.min(total, dl - Math.max(now, s.t0))) : 0;
  $('timerBar').style.width = (100 * left / total).toFixed(1) + '%'; const sec = Math.ceil(left / 1000); $('timerNum').textContent = sec;
  $('timer').classList.toggle('hot', left <= 10000 && s.ph === 'play'); $('timer').classList.toggle('idle', ml && actor === null);
  if (sec !== tickLast) { const mine = myId(s) !== null && playKey.endsWith(SC.kindAt(s)); if (sec <= 5 && sec > 0 && mine && now >= s.t0) SFX.tick(); tickLast = sec; }
  const pre = s.ph === 'play' ? s.t0 - now : -1, sp = $('splash');
  if (pre > 0) { sp.hidden = false; $('splashStep').textContent = T('stepN', { k: s.k + 1, S: s.S }); $('splashText').textContent = T('splash_' + SC.kindAt(s) + (s.k === 0 && SC.kindAt(s) === 'sent' ? '0' : '')); $('splashNum').textContent = Math.ceil(pre / 1000); }
  else if (!sp.hidden) sp.hidden = true;
  if (!$('handoff').hidden && pre > 0) $('handoff').hidden = true;
}
function inkUi() { const p = board.ink ? Math.max(0, 1 - board.used() / board.ink) : 1; const b = $('inkBar'); b.style.width = (p * 100).toFixed(1) + '%'; b.parentElement.classList.toggle('low', p < 0.2); }
board.onInk = inkUi;
board.onEmpty = () => { if (!inkWarned) { inkWarned = true; toast(T('inkEmpty'), 'warn'); } };

/* ---------- host loop: bots, stand-ins for leavers, timeouts ---------- */
let busy = false, pruneAt = 0, toFor = '';
function hash(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0) / 4294967296; }
function botDue(s, id) { const ms = SC.stepMs(s), f = hash(s.g + ':' + s.k + ':' + id), lo = SC.kindAt(s) === 'draw' ? 5000 : 3500, hi = Math.min(ms * 0.6, SC.kindAt(s) === 'draw' ? 16000 : 11000); return s.t0 + lo + f * Math.max(0, hi - lo); }
function loop() {
  if (!room || !room.data) return;
  room.tick(); tickUi(); const s = room.s, now = room.now();
  if (s.ph === 'end') { showTick(); return; }
  if (s.ph !== 'play') return;
  autoSubmit(s, now);
  const host = room.isHost(), g = s.g, k = s.k;
  if (host && !busy) {
    const pend = SC.pending(s), due = pend.filter(id => (isBot(id, s) && now >= botDue(s, id)) || s.gone.includes(id));
    if (due.length) { busy = true; room.edit('auto', st => st.g === g && st.k === k && SC.fillMissing(st, room.now(), (kind, x, i) => SC.botContent(kind, x, i), due) ? statusOf(st) : null).catch(() => {}).then(() => { busy = false; }); return; }
    if (!room.local && Date.now() - pruneAt > 1500) {
      pruneAt = Date.now(); const seatedIds = new Set(room.seated().map(p => p.id)), gone = s.ord.filter(id => id > 0 && !seatedIds.has(id) && !s.gone.includes(id));
      if (gone.length) { busy = true; room.edit('prune', st => { let ch = false; for (const id of gone) if (SC.drop(st, id)) ch = true; return ch ? statusOf(st) : null; }).catch(() => {}).then(() => { busy = false; }); return; }
    }
  }
  const late = host ? 2500 : N.STALE_MS + 2500, tk = g + ':' + k;
  if (!multiLocal(s) && now > s.ddl + late && toFor !== tk && !busy) {
    toFor = tk; busy = true;
    room.edit('timeout', st => st.g === g && st.k === k && SC.fillMissing(st, room.now(), (kind, x, i) => SC.botContent(kind, x, i)) ? statusOf(st) : null).catch(() => { toFor = ''; }).then(() => { busy = false; });
  }
}

/* ---------- slideshow ----------
   Only the presenter (online host, or the local device offline) controls it. Steps inside one album may autoplay,
   but the show never moves to the next player's album on its own: once an album is fully revealed a Next button
   appears and only the presenter's press advances. The presenter writes the cursor to s.sh {a, st, n}; everyone
   else always follows it (no local navigation). */
const view = { a: 0, st: 1, auto: false, at: 0, shN: -1, g: -1 };
let showKey = '', anim = null;
function maxSt(s, a) { return s.al[a] ? s.al[a].e.length : 0; }
function presenter() { return !!room && (room.local || room.isHost()); }
function albumDone(s) { return view.st >= maxSt(s, view.a); }
function setView(a, st, user) {
  if (!presenter()) return; const s = room.s; a = SC.clamp(a, 0, s.al.length - 1); st = SC.clamp(st, 1, Math.max(1, maxSt(s, a)));
  view.a = a; view.st = st; view.at = Date.now();
  syncShow(); renderShow(s);
}
function showCtrl(s) {
  const pres = presenter(), done = albumDone(s), last = view.a >= s.al.length - 1;
  ['prevAlbum', 'prevStep', 'playBtn', 'nextStep', 'allBtn'].forEach(id => { $(id).hidden = !pres; });
  $('nextAlbum').hidden = true; // advancing to the next player only through the Next button below
  $('albumTabs').classList.toggle('ro', !pres);
  $('albumTabs').querySelectorAll('button').forEach(b => { b.disabled = !pres && !b.classList.contains('on'); });
  $('prevStep').disabled = view.st <= 1 && view.a === 0; $('nextStep').disabled = done; $('allBtn').disabled = done;
  $('prevAlbum').disabled = view.a === 0;
  $('playBtn').textContent = view.auto ? T('pause') : T('autoplay'); $('playBtn').disabled = done;
  const nb = $('nextPlayer'), nx = s.al[view.a + 1];
  nb.hidden = !(pres && done && !last); if (nx) nb.textContent = T('nextPlayer', { name: avOf(nx.st, s) + ' ' + nameOf(nx.st, s) });
  $('showHint').textContent = done && last ? T('allDoneShow') : pres ? (done ? T('nextHint') : '') : (done ? T('waitHostNext') : T('hostOnly'));
  $('showNextRow').classList.toggle('empty', !$('showHint').textContent && nb.hidden);
}
function renderShow(s) {
  if (view.g !== s.g) { view.g = s.g; const n = Math.max(0, s.al.length - 1); view.a = SC.clamp(s.sh.a, 0, n); view.st = Math.max(1, s.sh.st); view.auto = presenter() && s.sh.n === 0; view.at = Date.now(); view.shN = s.sh.n; }
  if (!presenter() && s.sh.n !== view.shN) { view.shN = s.sh.n; view.a = SC.clamp(s.sh.a, 0, Math.max(0, s.al.length - 1)); view.st = SC.clamp(s.sh.st, 1, Math.max(1, maxSt(s, view.a))); view.auto = false; }
  view.st = SC.clamp(view.st, 1, Math.max(1, maxSt(s, view.a)));
  const host = room.isHost(), a = s.al[view.a], gambar = s.set.mode === 'gambar';
  $('rematchBtn').hidden = !host; $('showNote').textContent = host ? '' : T('waitRematch');
  $('followBtn').hidden = true;
  $('showSub').textContent = T('showSub', { n: s.al.length, mode: T(gambar ? 'modeGambar' : 'modeCerita') });
  $('albumTabs').innerHTML = s.al.map((x, i) => '<button type="button" role="tab" data-a="' + i + '" class="' + (i === view.a ? 'on' : '') + '" aria-selected="' + (i === view.a) + '"><span>' + avOf(x.st, s) + '</span>' + esc(nameOf(x.st, s)) + '</button>').join('');
  $('saveBtn').textContent = gambar ? T('savePng') : T('copyStory');
  renderChat(s);
  if (!a) return;
  showCtrl(s);
  const key = s.g + ':' + view.a + ':' + view.st + ':' + lang, prev = showKey; if (key === showKey) return; showKey = key;
  $('showOwner').textContent = avOf(a.st, s) + ' ' + T('albumOf', { name: nameOf(a.st, s) });
  $('showAlbumTitle').textContent = gambar ? '“' + (SC.titleOf(s, view.a) || '…') + '”' : T('albumN', { i: view.a + 1, n: s.al.length });
  $('showStory').hidden = gambar; $('showDraw').hidden = !gambar;
  const by = e => '<span class="by"><span class="av">' + avOf(e.by, s) + '</span>' + esc(nameOf(e.by, s)) + (e.a && !isBot(e.by, s) ? ' <em>' + esc(T('autoTag')) + '</em>' : '') + '</span>';
  if (!gambar) {
    $('showStory').innerHTML = a.e.slice(0, view.st).map((e, j) => '<li class="' + (j === view.st - 1 ? 'new' : '') + '">' + by(e) + '<p>' + esc(e.t) + '</p></li>').join('');
    const last = $('showStory').lastElementChild; if (last && last.scrollIntoView && !reduce) last.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    return;
  }
  // gambar: st=1 title only, st=j+1 shows drawing layers 1..j (animate the newest one when stepping forward)
  const j = view.st - 1, e = a.e[j], pk = prev.split(':'), forward = pk[0] === String(s.g) && pk[1] === String(view.a) && Number(pk[2]) === view.st - 1;
  stopAnim();
  const below = []; a.e.slice(1, j).forEach(x => { if (x.d) below.push(...x.d); });
  showBoard.setBase(below);
  if (j >= 1 && e && e.d) { if (forward && !reduce) replay(e.d); else { showBoard.mine = e.d.slice(); showBoard.redraw(); } }
  $('showCaption').innerHTML = j === 0 ? T('capTitle', { who: by(a.e[0]) }) : T(e && e.d && e.d.length ? 'capDraw' : 'capBlank', { j, L: a.e.length - 1, who: by(e) });
}
function stopAnim() { if (anim) { cancelAnimationFrame(anim.raf); anim = null; } }
function replay(ops) {
  const dec = ops.map(o => SC.decodeOp(o)).filter(Boolean), total = dec.reduce((n, o) => n + (o.t === 's' ? o.pts.length : 8), 0), dur = SC.clamp(total * 6, 600, 2400), t0 = performance.now();
  let oi = 0, pi = 0, drawn = 0; const c = showBoard.ctx;
  const step = t => {
    const want = Math.min(total, Math.ceil(total * (t - t0) / dur));
    while (drawn < want && oi < dec.length) {
      const o = dec[oi];
      if (o.t === 'f') { showBoard.flood(c, o.x, o.y, PAL[o.c] || PAL[1]); drawn += 8; oi++; pi = 0; continue; }
      const to = Math.min(o.pts.length, pi + (want - drawn)); if (pi === 0) showBoard.stroke(c, { c: o.c, z: o.z, pts: o.pts.slice(0, 1) }, 0);
      showBoard.stroke(c, { c: o.c, z: o.z, pts: o.pts.slice(0, to) }, Math.max(1, pi)); drawn += to - pi; pi = to; if (pi >= o.pts.length) { oi++; pi = 0; }
    }
    if (oi < dec.length && anim) anim.raf = requestAnimationFrame(step); else { anim = null; showBoard.mine = ops.slice(); }
  };
  anim = { raf: requestAnimationFrame(step), end: t0 + dur };
}
/** autoplay reveals the steps of the current album only; it stops at the album's end (Next is manual) */
function showTick() {
  if (!view.auto || screen !== 'show' || !presenter()) return; const s = room.s, gambar = s.set.mode === 'gambar';
  if (anim || Date.now() - view.at < (gambar ? 3000 : 2600)) return;
  if (view.st < maxSt(s, view.a)) { SFX.page(); setView(view.a, view.st + 1); }
}
function syncShow() { if (presenter() && !room.local) { const sh = { a: view.a, st: view.st }; room.edit('show', x => { if (x.ph !== 'end') return null; x.sh = { a: sh.a, st: sh.st, n: x.sh.n + 1 }; return { status: 'waiting' }; }).catch(() => {}); } }
function nav(d) {
  if (!presenter()) return; const s = room.s; view.auto = false;
  if (d > 0) { if (view.st < maxSt(s, view.a)) setView(view.a, view.st + 1); }
  else { if (view.st > 1) setView(view.a, view.st - 1); else if (view.a > 0) setView(view.a - 1, maxSt(s, view.a - 1)); }
}
function nextPlayer() {
  if (!presenter()) return; const s = room.s; if (!albumDone(s) || view.a >= s.al.length - 1) return;
  SFX.page(); setView(view.a + 1, 1); // keeps autoplay on if it was on, but it will stop again at that album's end
}

/* ---------- slideshow chat (everyone, host included; separate from slideshow control) ---------- */
let chatKey = '', chatAt = 0;
function chatSenders(s) { if (!room) return []; if (room.local) return localHumans(s); return room.me !== null && room.me !== undefined ? [room.me] : []; }
function renderChat(s) {
  const list = s.cm || [], senders = chatSenders(s), who = $('chatWho'), ml = room.local && senders.length > 1;
  const wk = senders.join(','); if (who.dataset.k !== wk) { who.dataset.k = wk; const cur = who.value; who.innerHTML = senders.map(id => '<option value="' + id + '">' + avOf(id, s) + ' ' + esc(nameOf(id, s)) + '</option>').join(''); if (cur && senders.includes(Number(cur))) who.value = cur; }
  who.hidden = !ml; $('chatForm').hidden = !senders.length;
  const key = lang + ':' + list.map(m => m.i).join(','); if (key === chatKey) return; chatKey = key;
  const box = $('chatList'), stick = box.scrollHeight - box.scrollTop - box.clientHeight < 40;
  box.innerHTML = list.length ? list.map(m => '<li class="' + (m.by === room.me ? 'me' : '') + '"><span class="av">' + avOf(m.by, s) + '</span><div><b>' + esc(m.n || nameOf(m.by, s)) + '</b><p>' + esc(m.t) + '</p></div></li>').join('') : '<li class="empty">' + esc(T('chatEmpty')) + '</li>';
  if (stick || list.length && list[list.length - 1].by === room.me) box.scrollTop = box.scrollHeight;
}
async function sendChat() {
  if (!room) return; const s = room.s, el = $('chatInput'), t = SC.cleanText(el.value, SC.LIM.chatMax); if (!t) return;
  if (Date.now() - chatAt < 1200) { toast(T('chatSlow'), 'warn'); return; }
  const senders = chatSenders(s); let by = room.local && senders.length > 1 ? Number($('chatWho').value) : room.me; if (!senders.includes(by)) by = senders[0]; if (by === undefined || by === null) return;
  const name = nameOf(by, s); chatAt = Date.now(); el.value = '';
  try { await room.edit('chat', x => SC.chat(x, by, name, t) ? { status: 'waiting' } : null); }
  catch (e) { el.value = t; toast(errMsg(e), 'warn'); }
  render();
}
function saveResult() {
  const s = room.s, a = s.al[view.a]; if (!a) return;
  if (s.set.mode === 'gambar') {
    stopAnim(); showBoard.setBase(SC.canvasOps(s, view.a, a.e.length)); const cv = doc.createElement('canvas'); cv.width = 960; cv.height = 800; const c = cv.getContext('2d');
    c.fillStyle = '#f6efe0'; c.fillRect(0, 0, 960, 800); c.drawImage(showBoard.cv, 0, 80); c.fillStyle = '#2b2118'; c.font = '800 38px system-ui, sans-serif'; c.textAlign = 'center'; c.fillText((SC.titleOf(s, view.a) || '').slice(0, 40), 480, 54);
    const link = doc.createElement('a'); link.download = 'sambungcoret-' + (view.a + 1) + '.png'; link.href = cv.toDataURL('image/png'); doc.body.appendChild(link); link.click(); link.remove();
    showKey = ''; renderShow(s);
  } else {
    const text = T('albumOf', { name: nameOf(a.st, s) }) + '\n\n' + a.e.map(e => e.t + ' (' + nameOf(e.by, s) + ')').join('\n');
    if (navigator.clipboard) navigator.clipboard.writeText(text).then(() => toast(T('copiedStory'), 'good'), () => toast(T('copyFail'), 'warn')); else toast(T('copyFail'), 'warn');
  }
}
function rematch() { hostEdit('lobby', s => { if (s.ph !== 'end') return null; SC.backToLobby(s); return { status: 'waiting' }; }); }

/* ---------- entering / leaving ---------- */
function attach(r) { room = r; lastEv = -1; screen = ''; playKey = ''; showKey = ''; chatKey = ''; actor = null; view.g = -1; render(); }
function makeRoom(link) { return new N.Room(link, { onChange: () => render() }); }
async function startPractice() {
  const name = myName() || T('you_'); setLS(NAME_KEY, name);
  const r = makeRoom(new N.LocalLink()); await r.enter('practice', { displayName: name, av: myAv, set: savedSet });
  await r.edit('bots', s => { for (let i = 0; i < botN; i++) addExtra(s, true); });
  attach(r);
}
function errMsg(e) {
  if (!e) return T('errNet'); if (e.code === 'busy') return T('errBusy', { s: e.wait || 10 }); if (e.code === 'network') return T('errNet');
  if (e.code === 'toolarge') return T('errTooLarge');
  if (e.status === 404) return T('errMissing'); return T('errGeneric', { msg: e.server || e.message || '' });
}
async function enterOnline(mode, opts) { const r = makeRoom(conn); await r.enter(mode, Object.assign({ set: savedSet, av: myAv }, opts)); attach(r); return r; }
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
  const r = room; room = null; gmMeSync(); stopAnim(); show('home'); if (gm) setTimeout(gmLoad, 400);
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
/* ---------- #gamemaster: every lobby incl. private (server honours GET rooms?gm=gamemaster) ---------- */
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
      + (playing ? '' : '<button type="button" class="btn primary small online-btn" data-gm="join" data-code="' + code + '">' + esc(T('gmJoin')) + '</button>')
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
function buildTools() {
  $('pal').innerHTML = PAL.slice(1).map((c, i) => '<button type="button" data-c="' + (i + 1) + '" style="--c:' + c + '" class="' + (i === 0 ? 'on' : '') + '" aria-label="' + esc(T('color')) + ' ' + (i + 1) + '"></button>').join('');
  $('sizes').innerHTML = SIZES.map((z, i) => '<button type="button" data-z="' + i + '" class="' + (i === 1 ? 'on' : '') + '" aria-label="' + esc(T('size')) + ' ' + (i + 1) + '"><i style="width:' + (4 + z * 0.9) + 'px;height:' + (4 + z * 0.9) + 'px"></i></button>').join('');
  const one = (box, sel, fn) => box.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; box.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b)); fn(b); });
  one($('pal'), 'c', b => { board.color = Number(b.dataset.c); if (board.tool === 'eraser') setTool('brush'); });
  one($('sizes'), 'z', b => { board.size = Number(b.dataset.z); });
  const setTool = t => { board.tool = t; doc.querySelectorAll('.tools-k button').forEach(x => x.classList.toggle('on', x.dataset.tool === t)); };
  doc.querySelector('.tools-k').addEventListener('click', e => { const b = e.target.closest('button'); if (b) setTool(b.dataset.tool); });
  $('undoBtn').addEventListener('click', () => board.undo());
  $('clearBtn').addEventListener('click', () => board.clear());
  $('drawSend').addEventListener('click', () => submit(board.ops(), 0));
  doc.addEventListener('keydown', e => { if ((e.ctrlKey || e.metaKey) && e.key === 'z' && screen === 'play' && board.enabled) { e.preventDefault(); board.undo(); } });
}
function fitVh() { const h = root.visualViewport ? root.visualViewport.height : innerHeight; doc.documentElement.style.setProperty('--vh', Math.round(h) + 'px'); }
async function boot() {
  buildTools(); applyLang();
  $('nameInput').value = getLS(NAME_KEY);
  $('avPick').innerHTML = CFG.avatars.map((a, i) => '<button type="button" role="radio" data-i="' + i + '" aria-label="Avatar ' + (i + 1) + '">' + a + '</button>').join('');
  const paintAv = () => $('avPick').querySelectorAll('button').forEach(b => { const on = Number(b.dataset.i) === myAv; b.classList.toggle('on', on); b.setAttribute('aria-checked', on); });
  paintAv();
  $('avPick').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; myAv = Number(b.dataset.i); setLS(AV_KEY, String(myAv)); paintAv(); if (room) room.hello(myAv, null).catch(() => {}); });
  const paintBots = () => $('botCount').querySelectorAll('button').forEach(b => { const on = Number(b.dataset.v) === botN; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); });
  paintBots(); $('botCount').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; botN = Number(b.dataset.v); setLS(BOTS_KEY, String(botN)); paintBots(); });
  doc.querySelectorAll('.lb').forEach(b => b.addEventListener('click', () => { lang = b.dataset.lang; setLS(LANG_KEY, lang); applyLang(); }));
  $('practiceBtn').addEventListener('click', () => startPractice().catch(e => toast(errMsg(e), 'warn')));
  $('createPrivate').addEventListener('click', () => onlineAction('private'));
  $('quickMatch').addEventListener('click', () => onlineAction('match'));
  $('joinForm').addEventListener('submit', e => { e.preventDefault(); onlineAction('join'); });
  $('codeInput').addEventListener('input', e => { e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''); });
  doc.querySelectorAll('#lobby .seg').forEach(seg => seg.addEventListener('click', onSeg));
  $('plist').addEventListener('click', e => { const b = e.target.closest('[data-rm]'); if (!b) return; const id = Number(b.dataset.rm); hostEdit('exDel', s => { if (s.ph !== 'lobby') return null; s.ex = s.ex.filter(x => x.id !== id); }); });
  $('addBot').addEventListener('click', () => hostEdit('botAdd', s => s.ph === 'lobby' && addExtra(s, true) ? {} : null));
  $('localForm').addEventListener('submit', e => { e.preventDefault(); const n = $('localName').value.replace(/\s+/g, ' ').trim().slice(0, 24); hostEdit('localAdd', s => s.ph === 'lobby' && addExtra(s, false, n) ? {} : null); $('localName').value = ''; });
  $('startBtn').addEventListener('click', startMatch);
  $('inviteBtn').addEventListener('click', invite);
  $('lobbyExit').addEventListener('click', () => exitToMenu(false));
  $('playExit').addEventListener('click', confirmExit);
  $('showExit').addEventListener('click', () => exitToMenu(false));
  $('sentForm').addEventListener('submit', e => { e.preventDefault(); sendText('sent'); });
  $('sentInput').addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendText('sent'); } });
  $('titleForm').addEventListener('submit', e => { e.preventDefault(); sendText('title'); });
  $('sentInput').addEventListener('input', () => updCnt('sent')); $('titleInput').addEventListener('input', () => updCnt('title'));
  $('sentIdea').addEventListener('click', () => idea('sent')); $('titleIdea').addEventListener('click', () => idea('title'));
  $('handGo').addEventListener('click', () => { const id = Number($('handGo').dataset.id); if (!room) return; actor = id; actorDdl = room.now() + SC.stepMs(room.s); playKey = ''; render(); });
  $('albumTabs').addEventListener('click', e => { const b = e.target.closest('[data-a]'); if (b && presenter()) { view.auto = false; setView(Number(b.dataset.a), 1); } });
  $('prevStep').addEventListener('click', () => nav(-1)); $('nextStep').addEventListener('click', () => nav(1));
  $('prevAlbum').addEventListener('click', () => { if (!presenter()) return; view.auto = false; setView(view.a - 1, 1); });
  $('nextAlbum').addEventListener('click', nextPlayer);
  $('nextPlayer').addEventListener('click', nextPlayer);
  $('allBtn').addEventListener('click', () => { if (!presenter()) return; view.auto = false; setView(view.a, maxSt(room.s, view.a)); });
  $('playBtn').addEventListener('click', () => { if (!presenter()) return; view.auto = !view.auto; view.at = 0; renderShow(room.s); });
  $('chatForm').addEventListener('submit', e => { e.preventDefault(); sendChat(); });
  $('saveBtn').addEventListener('click', saveResult);
  $('rematchBtn').addEventListener('click', rematch);
  $('showMenu').addEventListener('click', () => exitToMenu(false));
  $('gmRefresh').addEventListener('click', gmLoad);
  $('gmList').addEventListener('click', e => { const b = e.target.closest('[data-gm]'); if (b) gmEnter(b.dataset.gm, b.dataset.code); });
  root.addEventListener('hashchange', gmSync); setInterval(() => { if (gm && !room && doc.visibilityState === 'visible' && Date.now() - gmAt > 10000) gmLoad(); }, 2000);
  $('muteBtn').addEventListener('click', () => { muted = !muted; setLS(MUTE_KEY, muted ? '1' : '0'); paintMute(); });
  root.addEventListener('resize', fitVh); if (root.visualViewport) root.visualViewport.addEventListener('resize', fitVh); fitVh();
  root.addEventListener('pagehide', () => { if (room && !room.local) conn.leaveBeacon(); });
  doc.addEventListener('visibilitychange', () => { if (doc.visibilityState === 'visible' && conn.config) conn.visible(); });
  setInterval(loop, 200);
  gmUI = gmClaimUI({ listKey: N.GM_KEY, canClaim: () => !!room && !!room.data && !room.local && !room.isGamemaster(), claim: code => room.claimGamemaster(code), onDone: () => { toast('Mode gamemaster aktif'); render(); } });
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
    JR.run({ code: invCode, lang, gameName: CFG.site.name, nameKey: NAME_KEY, nameMax: 24, accent: '#e8553b',
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
root.SCApp = { get room() { return room; }, get gm() { return gm; }, gmLoad, conn, render, loop, board, view, nextPlayer, get actor() { return actor; } };
})(window);

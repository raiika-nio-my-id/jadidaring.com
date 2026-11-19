/* Ular Tangga Sakti: pure rules + platform transport (/api/game + Reverb, socket-only). No libraries. */
(function (root) {
'use strict';
const GAME = 'jadidaring-ulartangga', SCHEMA = 1;
const LIMITS = { stateMax: 200000, privateMax: 100000, logKeep: 30, nameMax: 24 };
const CARDS = ['perisai', 'ganda', 'lompat', 'mundur', 'tukar'];
const TARGET_CARDS = ['mundur', 'tukar'];
const copy = v => JSON.parse(JSON.stringify(v));
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const bytes = v => new TextEncoder().encode(JSON.stringify(v)).length;
const A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
function rnd(n) { if (root.crypto && root.crypto.getRandomValues) { const a = new Uint32Array(1); root.crypto.getRandomValues(a); return Math.floor(a[0] / 4294967296 * n); } return Math.floor(Math.random() * n); }
const rand01 = () => rnd(1e9) / 1e9;
function rid(len = 8) { let s = ''; for (let i = 0; i < len; i++) s += A[rnd(62)]; return s; }
function shuffle(list) { const a = list.slice(); for (let i = a.length - 1; i > 0; i--) { const j = rnd(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; }
const die = () => 1 + rnd(6);
const err = (code) => { const e = Error(code); e.code = code; return e; };

/* ---------- board & rules from the website-config JSON ---------- */
function makeBoard(b) {
  const num = o => { const r = {}; for (const k of Object.keys(o || {})) r[Number(k)] = Number(o[k]); return r; };
  return { size: 100, ladders: num(b && b.ladders), snakes: num(b && b.snakes), power: new Set(((b && b.powerTiles) || []).map(Number)) };
}
/** returns a list of problems (empty = valid board) */
function validateBoard(B) {
  const out = [], used = new Map(), mark = (n, what) => { if (used.has(n)) out.push('tile ' + n + ' used by ' + used.get(n) + ' and ' + what); else used.set(n, what); };
  for (const [f, t] of Object.entries(B.ladders)) { const a = Number(f); if (!(t > a)) out.push('ladder ' + a + ' must go up'); if (a < 2 || t > 100) out.push('ladder ' + a + ' out of range'); mark(a, 'ladder ' + a); mark(t, 'ladder ' + a + ' top'); }
  for (const [f, t] of Object.entries(B.snakes)) { const a = Number(f); if (!(t < a)) out.push('snake ' + a + ' must go down'); if (a >= 100 || t < 1) out.push('snake ' + a + ' out of range'); mark(a, 'snake ' + a); mark(t, 'snake ' + a + ' tail'); }
  for (const p of B.power) { if (p < 2 || p > 99) out.push('power tile ' + p + ' out of range'); mark(p, 'power ' + p); }
  return out;
}
function makeRules(g) {
  g = g || {};
  return { handMax: g.handMax ?? 2, sixBonus: g.sixBonus !== false, push: g.pushBack ?? 3, plus: g.jumpPlus ?? 3, turnSeconds: g.turnSeconds ?? 30,
    weights: Object.assign({ perisai: 3, ganda: 2, lompat: 3, mundur: 2, tukar: 1 }, g.cardWeights || {}) };
}
function drawCard(rand, weights) {
  const list = CARDS.filter(c => (weights[c] || 0) > 0), total = list.reduce((a, c) => a + weights[c], 0);
  let r = (rand || rand01)() * total;
  for (const c of list) { r -= weights[c]; if (r < 0) return c; }
  return list[list.length - 1];
}

/* ---------- state (Laravel stores JSON via PHP arrays: {} comes back as [], normalise on read) ---------- */
const obj = v => (v && typeof v === 'object') ? (Array.isArray(v) ? Object.assign({}, v) : v) : {};
const arr = v => Array.isArray(v) ? v : (v && typeof v === 'object' ? Object.values(v) : []);
function normalizeState(raw) {
  const s = obj(raw); if (!s.game) return s;
  s.settings = obj(s.settings); s.order = arr(s.order).map(Number); s.names = obj(s.names); s.pos = obj(s.pos); s.log = arr(s.log);
  const h = obj(s.hand); s.hand = {}; for (const k of Object.keys(h)) s.hand[k] = arr(h[k]);
  s.turn = s.turn && typeof s.turn === 'object' ? obj(s.turn) : null;
  if (s.last && typeof s.last === 'object') { s.last = obj(s.last); s.last.steps = arr(s.last.steps).map(obj); s.last.before = obj(s.last.before); s.last.dice = s.last.dice ? arr(s.last.dice) : null; for (const st of s.last.steps) if (st.path) st.path = arr(st.path); } else s.last = null;
  return s;
}
function normalizeRoom(d) { if (d && !d.unchanged && d.code) { d.state = normalizeState(d.state); d.private = obj(d.private); d.players = arr(d.players); d.events = arr(d.events); } return d; }
function seated(players) { return (players || []).filter(p => !p.spectator).sort((a, b) => (a.seat ?? 0) - (b.seat ?? 0)); }
function newState(settings) {
  return { game: GAME, schema: SCHEMA, phase: 'lobby', hostId: null, hostSeenAt: 0, settings: Object.assign({ powerups: true }, settings || {}),
    order: [], names: {}, pos: {}, hand: {}, turn: null, last: null, seq: 0, log: [], winner: null, reason: null, games: 0 };
}
function supported(s) { return !!s && s.game === GAME && s.schema === SCHEMA; }
function pushLog(s, entry) { s.log = (s.log || []).concat([entry]).slice(-LIMITS.logKeep); }
function beginTurn(s, p, now, R) { s.turn = { p, n: s.turn ? (s.turn.n || 0) + 1 : 1, used: null, mod: null, bonus: false, startedAt: now, until: now + R.turnSeconds * 1000 }; }
/** players: [{id, name}] in seat order */
function startGame(state, players, now, R) {
  const s = copy(state); s.phase = 'playing'; s.order = players.map(p => Number(p.id)); s.names = {}; s.pos = {}; s.hand = {};
  for (const p of players) { s.names[p.id] = String(p.name || '').slice(0, LIMITS.nameMax); s.pos[p.id] = 0; s.hand[p.id] = []; }
  s.winner = null; s.reason = null; s.log = []; s.games = (s.games || 0) + 1; s.turn = null;
  s.seq = (s.seq || 0) + 1; s.last = { seq: s.seq, p: null, dice: null, mod: null, steps: [], before: copy(s.pos) };
  pushLog(s, { t: 'start' }); beginTurn(s, s.order[0], now, R); return s;
}
function finish(s, winner, reason) { s.phase = 'over'; s.winner = winner ?? null; s.reason = reason; s.turn = null; }
/** next present player in order; ends the game when fewer than two remain */
function advance(s, ctx) {
  const present = ctx.present, order = s.order, alive = order.filter(id => !present || present.has(id));
  if (alive.length < 2) { finish(s, alive.length === 1 ? alive[0] : null, 'left'); pushLog(s, { t: 'over', p: s.winner, r: 'left' }); return; }
  const i = order.indexOf(s.turn ? s.turn.p : order[0]);
  for (let k = 1; k <= order.length; k++) { const c = order[(i + k) % order.length]; if (!present || present.has(c)) { beginTurn(s, c, ctx.now, ctx.R); return; } }
}
/** ladders / snakes (Perisai blocks a snake) and power tiles at the resting tile */
function landing(s, p, steps, ctx, giveCard) {
  const B = ctx.B, R = ctx.R, h = s.hand[p] || (s.hand[p] = []); let at = s.pos[p];
  if (B.ladders[at]) { steps.push({ t: 'ladder', p, from: at, to: B.ladders[at] }); pushLog(s, { t: 'ladder', p, f: at, to: B.ladders[at] }); at = B.ladders[at]; }
  else if (B.snakes[at]) {
    const i = h.indexOf('perisai');
    if (i >= 0) { h.splice(i, 1); steps.push({ t: 'shield', p, at }); pushLog(s, { t: 'shield', p, f: at }); }
    else { steps.push({ t: 'snake', p, from: at, to: B.snakes[at] }); pushLog(s, { t: 'snake', p, f: at, to: B.snakes[at] }); at = B.snakes[at]; }
  }
  s.pos[p] = at;
  if (giveCard && s.settings.powerups !== false && B.power.has(at)) {
    if (h.length < R.handMax) { const c = drawCard(ctx.rand, R.weights); h.push(c); steps.push({ t: 'card', p, c }); pushLog(s, { t: 'card', p, c }); }
    else { steps.push({ t: 'full', p }); pushLog(s, { t: 'full', p }); }
  }
}
function walkPath(from, total) { const path = []; let cur = from, dir = 1, bounced = false; for (let k = 0; k < total; k++) { if (cur + dir > 100) { dir = -1; bounced = true; } cur += dir; path.push(cur); } return { path, to: cur, bounced }; }
function diceNeeded(s) { return s.turn && s.turn.mod === 'ganda' ? 2 : 1; }
function canAct(s, pid) { return !!s && s.phase === 'playing' && !!s.turn && Number(s.turn.p) === Number(pid); }
function rollMove(state, pid, dice, ctx) {
  if (!canAct(state, pid)) throw err('turn');
  if (!Array.isArray(dice) || dice.length !== diceNeeded(state) || !dice.every(d => Number.isInteger(d) && d >= 1 && d <= 6)) throw err('dice');
  const s = copy(state), t = s.turn, before = copy(s.pos), steps = [], from = s.pos[pid] || 0, mod = t.mod;
  const plus = t.mod === 'lompat' ? ctx.R.plus : 0, total = dice.reduce((a, b) => a + b, 0) + plus;
  const w = walkPath(from, total); steps.push({ t: 'walk', p: pid, path: w.path, bounce: w.bounced }); s.pos[pid] = w.to;
  pushLog(s, { t: 'roll', p: pid, d: dice, m: t.mod, f: from, to: w.to, b: w.bounced ? 1 : 0 });
  landing(s, pid, steps, ctx, true);
  if (s.pos[pid] === 100) { steps.push({ t: 'win', p: pid }); finish(s, pid, 'win'); pushLog(s, { t: 'over', p: pid, r: 'win' }); }
  else if (ctx.R.sixBonus && dice.length === 1 && dice[0] === 6 && !t.bonus) { t.bonus = true; t.mod = null; t.startedAt = ctx.now; t.until = ctx.now + ctx.R.turnSeconds * 1000; steps.push({ t: 'bonus', p: pid }); pushLog(s, { t: 'bonus', p: pid }); }
  else advance(s, ctx);
  s.seq = (s.seq || 0) + 1; s.last = { seq: s.seq, p: pid, dice, mod, plus, steps, before };
  return s;
}
/** why a card can't be played right now (null = allowed) */
function cardBlock(s, pid, card, target, present) {
  if (!canAct(s, pid)) return 'turn';
  if (s.settings.powerups === false) return 'off';
  if (!CARDS.includes(card)) return 'card';
  if (card === 'perisai') return 'passive';
  if (s.turn.used) return 'once';
  if (!(s.hand[pid] || []).includes(card)) return 'nocard';
  if (TARGET_CARDS.includes(card)) {
    target = Number(target);
    if (!s.order.includes(target) || target === Number(pid)) return 'target';
    if (card === 'mundur' && !((s.pos[target] || 0) > 0)) return 'target';
    if (card === 'tukar' && (s.pos[target] || 0) === (s.pos[pid] || 0)) return 'target';
    if (present && !present.has(target)) return 'target';
  }
  return null;
}
function useCard(state, pid, card, target, ctx) {
  const why = cardBlock(state, pid, card, target, ctx.present);
  if (why) throw err(why);
  target = target === undefined || target === null ? null : Number(target);
  const s = copy(state), t = s.turn, before = copy(s.pos), steps = [], h = s.hand[pid];
  h.splice(h.indexOf(card), 1); t.used = card; steps.push({ t: 'use', p: pid, c: card, q: target }); pushLog(s, { t: 'use', p: pid, c: card, q: target });
  if (card === 'ganda' || card === 'lompat') t.mod = card;
  else if (card === 'mundur') {
    const from = s.pos[target], to = Math.max(0, from - ctx.R.push), path = []; for (let k = from - 1; k >= to; k--) path.push(k);
    steps.push({ t: 'walk', p: target, path, back: true }); s.pos[target] = to;
    if (to > 0) landing(s, target, steps, ctx, false);
  } else if (card === 'tukar') {
    const a = s.pos[pid], b = s.pos[target]; s.pos[pid] = b; s.pos[target] = a; steps.push({ t: 'swap', p: pid, q: target, a, b });
    advance(s, ctx); // swapping uses up the turn (no roll)
  }
  s.seq = (s.seq || 0) + 1; s.last = { seq: s.seq, p: pid, dice: null, mod: null, steps, before };
  return s;
}
/** host-side: skip an absent player or auto-roll for an idle one */
function skipTurn(state, ctx, reason) {
  const s = copy(state), before = copy(s.pos), p = s.turn.p; pushLog(s, { t: 'skip', p, r: reason });
  advance(s, ctx); s.seq = (s.seq || 0) + 1; s.last = { seq: s.seq, p, dice: null, mod: null, steps: [{ t: 'skip', p, r: reason }], before }; return s;
}
function autoRoll(state, ctx) { const p = state.turn.p, dice = Array.from({ length: diceNeeded(state) }, () => ctx.die ? ctx.die() : die()); const s = rollMove(state, p, dice, ctx); s.last.auto = true; return s; }
function endForLeft(state, present) { const s = copy(state); const alive = s.order.filter(id => present.has(id)); finish(s, alive.length === 1 ? alive[0] : null, 'left'); pushLog(s, { t: 'over', p: s.winner, r: 'left' }); s.seq = (s.seq || 0) + 1; s.last = { seq: s.seq, p: null, dice: null, mod: null, steps: [], before: copy(s.pos) }; return s; }
function ranking(s) { return s.order.slice().sort((a, b) => (b === s.winner) - (a === s.winner) || (s.pos[b] || 0) - (s.pos[a] || 0)).map((id, i) => ({ id, name: s.names[id] || '—', pos: s.pos[id] || 0, win: id === s.winner })); }
function resetToLobby(state) { const s = copy(state); Object.assign(s, { phase: 'lobby', order: [], pos: {}, hand: {}, turn: null, winner: null, reason: null, log: [] }); s.seq = (s.seq || 0) + 1; s.last = null; return s; }

/* ---------- simple bot: decides whether to play a card before rolling ---------- */
function botPlan(s, pid, R) {
  if (!canAct(s, pid) || s.turn.used || s.settings.powerups === false) return null;
  const hand = s.hand[pid] || [], me = s.pos[pid] || 0, others = s.order.filter(id => id !== pid);
  const leader = others.slice().sort((a, b) => (s.pos[b] || 0) - (s.pos[a] || 0))[0], lp = s.pos[leader] || 0;
  if (hand.includes('tukar') && lp - me >= 15) return { card: 'tukar', target: leader };
  if (hand.includes('mundur') && lp > 0 && lp >= me) return { card: 'mundur', target: leader };
  if (hand.includes('ganda') && me <= 82) return { card: 'ganda' };
  if (hand.includes('lompat') && me <= 88) return { card: 'lompat' };
  return null;
}

/* ---------- Platform transport (/api/game + Reverb, no library) ---------- */
function gameSubdomain(hostname) { const m = /^([a-z0-9-]+)\.jadidaring\.(?:com|test)$/i.exec(String(hostname || '')); return m ? m[1].toLowerCase() : null; }
const SESSION_KEY = 'ulartangga.session';
class Connection {
  constructor({ location = root.location, fetch = root.fetch, Socket = root.WebSocket, storage = null, now = () => Date.now(), onWake = () => {}, onSocket = () => {}, lobbyWake = () => {}, timers = null, random = Math.random, reconnectMaxMs = 15000 } = {}) {
    this.location = location; this.fetchFn = typeof fetch === 'function' ? fetch.bind(root) : null; this.Socket = Socket; this.storage = storage; this.now = now; this.onWake = onWake; this.onSocket = onSocket; this.lobbyWake = lobbyWake;
    this.timers = timers || { setTimeout: (f, ms) => root.setTimeout(f, ms), clearTimeout: id => root.clearTimeout(id), setInterval: (f, ms) => root.setInterval(f, ms), clearInterval: id => root.clearInterval(id) };
    this.random = random; this.reconnectMaxMs = reconnectMaxMs; this.attempts = 0; this.state = 'idle'; this.lastError = null; this.stats = { sockets: 0, catchUps: 0, wakeups: 0, errors: 0 };
    this.allowed = !!location && /^https?:$/.test(location.protocol) && !!gameSubdomain(location.hostname);
    this.config = null; this.code = null; this.token = null; this.version = null; this.latest = null; this.socket = null; this.channel = null; this.ready = false; this.subscribed = false; this.stopped = false; this.backoffUntil = 0;
    this.lo = -Infinity; this.hi = Infinity; this.offset = 0;
    try { const s = JSON.parse((storage && storage.getItem(SESSION_KEY)) || 'null'); if (s && s.origin === location.origin && /^[A-Z2-9]{6}$/.test(s.code) && typeof s.token === 'string') { this.code = s.code; this.token = s.token; } } catch (e) { /* ignore */ }
  }
  serverNow() { return this.now() + this.offset; }
  clock(dateHeader, sent, received) {
    const d = Date.parse(dateHeader || ''); if (!Number.isFinite(d)) return;
    const lo = d - received, hi = d + 1000 - sent;
    if (Math.max(lo, this.lo) > Math.min(hi, this.hi)) { this.lo = lo; this.hi = hi; } else { this.lo = Math.max(lo, this.lo); this.hi = Math.min(hi, this.hi); }
    this.offset = Math.round((this.lo + this.hi) / 2);
  }
  save() { try { if (!this.storage) return; if (this.code && this.token) this.storage.setItem(SESSION_KEY, JSON.stringify({ origin: this.location.origin, code: this.code, token: this.token })); else this.storage.removeItem(SESSION_KEY); } catch (e) { /* ignore */ } }
  async request(path, { body, auth = true } = {}) {
    if (!this.allowed) throw err('offline');
    if (this.now() < this.backoffUntil) { const e = err('busy'); e.status = 429; e.wait = Math.ceil((this.backoffUntil - this.now()) / 1000); throw e; }
    const headers = { 'Accept': 'application/json', 'Content-Type': 'application/json' };
    if (auth && this.token) headers.Authorization = 'Bearer ' + this.token;
    const sent = this.now(); let res;
    try {
      const opts = { method: body === undefined ? 'GET' : 'POST', headers, credentials: 'same-origin', cache: 'no-store' };
      if (body !== undefined) opts.body = JSON.stringify(body);
      if (root.AbortSignal && AbortSignal.timeout) opts.signal = AbortSignal.timeout(20000);
      res = await this.fetchFn('/api/game/' + path, opts);
    } catch (e) { throw err('network'); }
    this.clock(res.headers && res.headers.get && res.headers.get('Date'), sent, this.now());
    let data = {}; try { data = await res.json(); } catch (e) { data = {}; }
    if (!res.ok) {
      const e = Error(data.error || data.message || ('HTTP ' + res.status)); e.status = res.status; e.server = data.error || data.message || '';
      if (res.status === 429) { this.backoffUntil = this.now() + Math.max(1, Number(res.headers && res.headers.get && res.headers.get('Retry-After')) || 10) * 1000 + rnd(1000); e.code = 'busy'; }
      throw e;
    }
    return data;
  }
  async start() {
    if (this.config) { if (this.stopped) { this.stopped = false; this.openSocket(); } return this.config; }
    if (this.starting) return this.starting;
    this.starting = (async () => {
      const c = await this.request('config', { auth: false }), w = c.websocket, sub = gameSubdomain(this.location.hostname), prefix = 'game.' + sub;
      if (c.game !== sub || !c.database || c.database.shared !== true || c.database.isolatedBy !== 'subdomain' || !w || w.channelPrefix !== prefix || w.lobbyChannel !== prefix || w.roomChannel !== prefix + '.{code}') throw err('mismatch');
      if (!w.enabled || !w.url) throw err('disabled');
      const url = new URL(w.url); if (!['ws:', 'wss:'].includes(url.protocol) || (this.location.protocol === 'https:' && url.protocol !== 'wss:')) throw err('mismatch');
      this.config = c; this.stopped = false; this.openSocket(); return c;
    })();
    try { return await this.starting; } finally { this.starting = null; }
  }
  desiredChannel() { const w = this.config.websocket; return this.code ? w.channelPrefix + '.' + this.code : w.lobbyChannel; }
  /* Realtime is socket-only: there is no HTTP polling loop. Reads happen on join, on room.updated wakeups,
     once after every (re)subscribe (catch-up), when the tab becomes visible, and after a 409. */
  setState(st) { if (this.state !== st) { this.state = st; this.onSocket(st === 'online', st); } }
  subscribe() {
    if (!this.ready || !this.socket || this.socket.readyState !== 1) return; const next = this.desiredChannel(); if (next === this.channel) return;
    if (this.channel) this.socket.send(JSON.stringify({ event: 'pusher:unsubscribe', data: { channel: this.channel } }));
    this.channel = next; this.subscribed = false; this.setState('subscribing'); this.socket.send(JSON.stringify({ event: 'pusher:subscribe', data: { channel: next } }));
  }
  /** exponential backoff 1s→2s→4s→8s… capped (15 s), ±25% jitter */
  backoffDelay(hint) {
    const base = hint === 'now' ? 1000 : hint === 'max' ? this.reconnectMaxMs : Math.min(this.reconnectMaxMs, 1000 * Math.pow(2, this.attempts));
    return Math.round(base * (0.75 + this.random() * 0.5));
  }
  scheduleReconnect(hint) {
    if (this.stopped || this.reconnectTimer) return;
    const delay = this.backoffDelay(hint); this.attempts++; this.nextRetryAt = this.now() + delay; this.setState('reconnecting');
    this.reconnectTimer = this.timers.setTimeout(() => { this.reconnectTimer = null; this.openSocket(); }, delay);
  }
  openSocket() {
    if (this.stopped || !this.config || !this.Socket) return;
    if (this.reconnectTimer) { this.timers.clearTimeout(this.reconnectTimer); this.reconnectTimer = null; }
    let ws; try { ws = this.socket = new this.Socket(this.config.websocket.url); } catch (e) { this.socket = null; this.scheduleReconnect(); return; }
    this.stats.sockets++; this.ready = false; this.channel = null; this.subscribed = false; this.setState(this.attempts ? 'reconnecting' : 'connecting'); this.errorHint = null;
    ws.onmessage = ev => {
      if (ws !== this.socket) return; this.lastMessage = this.now(); let frame, data;
      try { frame = JSON.parse(ev.data); data = typeof frame.data === 'string' ? JSON.parse(frame.data) : frame.data; } catch (e) { return; }
      if (frame.event === 'pusher:connection_established') {
        this.ready = true; this.subscribe();
        this.timers.clearInterval(this.heartbeat);
        const activity = Math.max(10, Math.min(120, Number(data && data.activity_timeout) || 30)) * 1000;
        this.heartbeat = this.timers.setInterval(() => { if (this.now() - this.lastMessage > activity * 2) { ws.close(); return; } if (ws.readyState === 1) ws.send(JSON.stringify({ event: 'pusher:ping', data: {} })); }, activity);
      }
      else if (frame.event === 'pusher:ping') { if (ws.readyState === 1) ws.send(JSON.stringify({ event: 'pusher:pong', data: {} })); }
      else if (frame.event === 'pusher:error') {
        // Pusher protocol: 4000–4099 do not retry unchanged (back off to max), 4100–4199 retry with backoff, 4200–4299 retry soon.
        const code = Number(data && data.code); this.stats.errors++; this.lastError = { code: code || null, message: String((data && data.message) || '') };
        this.errorHint = code >= 4000 && code < 4100 ? 'max' : code >= 4200 && code < 4300 ? 'now' : null;
        if (code >= 4000 && code < 4300 && ws.readyState < 2) ws.close();
      }
      else if (frame.event === 'pusher_internal:subscription_succeeded' && frame.channel === this.channel) {
        this.subscribed = true; this.attempts = 0; this.setState('online'); this.stats.catchUps++;
        if (this.code) this.onWake({ catchUp: true }); else this.lobbyWake({ catchUp: true });
      }
      else if (frame.event === this.config.websocket.event && frame.channel === this.channel) {
        if (this.code) { if (data && data.code === this.code && Number(data.version) > (this.version ?? -1)) { this.stats.wakeups++; this.onWake(data); } }
        else this.lobbyWake(data);
      }
    };
    ws.onerror = () => { if (ws.readyState < 2) ws.close(); };
    ws.onclose = () => {
      if (ws !== this.socket) return; this.socket = null; this.ready = false; this.subscribed = false; this.channel = null; this.timers.clearInterval(this.heartbeat);
      if (!this.stopped) this.scheduleReconnect(this.errorHint); else this.setState('idle');
    };
  }
  /** one catch-up read when the tab becomes visible again (no-op without a room) */
  visible() { if (!this.config || this.stopped) return; if (!this.socket && !this.reconnectTimer) this.openSocket(); else if (this.reconnectTimer && this.state === 'reconnecting') { this.timers.clearTimeout(this.reconnectTimer); this.reconnectTimer = null; this.openSocket(); } if (this.code) this.onWake({ visible: true }); else this.lobbyWake({ visible: true }); }
  adopt(data) { normalizeRoom(data); if (data && !data.unchanged && data.code && (!this.latest || this.latest.code !== data.code || data.version >= this.latest.version)) { this.latest = data; this.version = data.version; } return data; }
  async enter(mode, { displayName, code, maxPlayers, state } = {}) {
    await this.start();
    if (this.code && this.token) { try { await this.leave(); } catch (e) { this.forget(); } }
    const common = { displayName: String(displayName || 'Tamu').slice(0, 40) }, create = Object.assign({}, common, { maxPlayers, state, private: {} });
    let data;
    if (mode === 'private' || mode === 'public') data = await this.request('rooms', { body: Object.assign({}, create, { visibility: mode }), auth: false });
    else if (mode === 'match') data = await this.request('rooms/match', { body: create, auth: false });
    else if (mode === 'watch') data = await this.request('rooms/' + encodeURIComponent(code) + '/watch', { body: common, auth: false });
    else data = await this.request('rooms/join', { body: Object.assign({}, common, { code, private: {} }), auth: false });
    if (typeof data.playerToken !== 'string' || !/^[A-Z2-9]{6}$/.test(data.code)) throw Error('no-session');
    this.code = data.code; this.token = data.playerToken; this.latest = null; this.version = null; this.adopt(data); this.save(); this.subscribe(); return data;
  }
  async rooms() { return this.request('rooms', { auth: false }); }
  async read({ full = false } = {}) { const code = this.code; if (!code) return null; const data = await this.request('rooms/' + code + (full || this.version === null ? '' : '?since=' + this.version)); if (code === this.code) this.adopt(data); return data; }
  /** build(latest) returns {state?, private?, status?, payload?} or null. A 409 refetches and retries once. */
  async write(type, build) {
    for (let attempt = 0; attempt < 2; attempt++) {
      const latest = this.latest || await this.read({ full: true });
      const body = await build(latest); if (!body) return null;
      const req = Object.assign({ payload: {} }, body, { type, expectedVersion: latest.version });
      if (req.state && bytes(req.state) > LIMITS.stateMax) throw err('toolarge');
      try { return this.adopt(await this.request('rooms/' + this.code + '/actions', { body: req })); }
      catch (e) { if (e.status !== 409 || attempt) throw e; this.latest = null; await this.read({ full: true }); }
    }
    return null;
  }
  async leave() { if (this.code && this.token) await this.request('rooms/' + this.code + '/leave', { body: {} }); this.forget(); }
  forget() { this.latest = null; this.code = null; this.token = null; this.version = null; this.save(); this.subscribe(); }
  stop() { this.stopped = true; if (this.reconnectTimer) this.timers.clearTimeout(this.reconnectTimer); this.reconnectTimer = null; this.timers.clearInterval(this.heartbeat); if (this.socket) this.socket.close(); this.setState('idle'); }
}

/* ---------- Online coordinator: the player whose turn it is writes their own move; the host keeps the game moving ---------- */
class OnlineGame {
  constructor(net, cfg, { onChange = () => {}, onNotice = () => {}, die: dieFn = die } = {}) {
    this.net = net; this.cfg = cfg; this.R = makeRules(cfg.game); this.B = makeBoard(cfg.board); this.die = dieFn;
    this.rt = Object.assign({ mode: 'socket', hostHeartbeatSeconds: 10, hostStaleSeconds: 30 }, cfg.realtime || {}); this.onChange = onChange; this.onNotice = onNotice;
    this.tail = Promise.resolve(); this.data = null; this.lastWrite = 0; this.writes = []; this.reading = false; this.readAgain = false; this.pending = null;
  }
  serial(work) { const next = this.tail.then(work); this.tail = next.catch(() => {}); return next; }
  get me() { return this.data ? this.data.playerId : null; }
  get s() { return (this.data && this.data.state) || {}; }
  now() { return this.net.serverNow(); }
  players() { return (this.data && this.data.players) || []; }
  isHost() { return !!this.data && this.s.hostId === this.me && !this.data.spectator; }
  myTurn() { return !!this.data && !this.data.spectator && canAct(this.s, this.me); }
  ctx(d, extra) { return Object.assign({ now: this.now(), R: this.R, B: this.B, rand: rand01, die: this.die, present: new Set(seated(d.players).map(p => p.id)) }, extra || {}); }
  receive(data) {
    if (!data || data.unchanged || !data.code) return; normalizeRoom(data);
    if (this.data && this.data.code === data.code && data.version < this.data.version) return;
    this.data = data; this.onChange(this);
  }
  async enter(mode, opts) { const st = newState(opts.settings); const data = await this.net.enter(mode, Object.assign({}, opts, { state: st })); this.data = null; this.receive(data); if (data && data.state && supported(data.state) && !data.state.hostId && !data.spectator) await this.serial(() => this.claimHost()); return data; }
  async resume() { const data = await this.net.read({ full: true }); this.receive(data); return data; }
  /** Event-driven read (wakeup / catch-up / visibility / user action). Coalesced: one read in flight, one queued. */
  async refresh(full) {
    if (this.reading) { this.readAgain = true; return; }
    this.reading = true;
    try { do { this.readAgain = false; this.reads = (this.reads || 0) + 1; const d = await this.net.read({ full: !!full }); this.receive(d); full = false; } while (this.readAgain); }
    catch (e) {
      // 429: retry exactly once when Retry-After expires (one-shot, not a polling loop)
      if (e.status === 429 && !this.busyRetry) { const wait = Math.max(0, (this.net.backoffUntil || 0) - this.net.now()) + 50; this.busyRetry = this.net.timers.setTimeout(() => { this.busyRetry = null; this.refresh().catch(() => {}); }, wait); }
      throw e;
    }
    finally { this.reading = false; }
  }
  budgetOk(essential) { const t = this.net.now(); this.writes = this.writes.filter(x => t - x < 60000); return this.writes.length < (essential ? 110 : 90); }
  async send(type, build, essential) {
    if (!this.budgetOk(essential)) return null;
    this.writes.push(this.net.now()); this.lastWrite = this.net.now();
    const res = await this.net.write(type, build); if (res) this.receive(res); return res;
  }
  claimHost() { return this.send('ut.host', d => { if (!supported(d.state) || d.state.hostId || d.spectator) return null; const s = copy(d.state); s.hostId = d.playerId; s.hostSeenAt = this.now(); return { state: s }; }, true); }
  /* ----- periodic duties (call every ~250 ms; writes only, never reads) ----- */
  tick() { return this.serial(() => this.duties().catch(e => { if (e.status !== 409 && e.code !== 'busy') this.onNotice(e); })); }
  async duties() {
    if (!this.data || this.data.spectator || this.data.status === 'closed' || !supported(this.s)) return;
    if (await this.takeover()) return;
    if (this.net.now() - this.lastWrite < 600) return;
    if (this.isHost()) await this.hostDuty(this.now());
  }
  hostCandidate(s, players) {
    const list = seated(players), present = list.some(p => p.id === s.hostId), stale = s.hostId && this.now() - (s.hostSeenAt || 0) > this.rt.hostStaleSeconds * 1000;
    if (s.hostId && present && !stale) return null;
    const pool = list.filter(p => p.id !== s.hostId || !stale);
    return pool.length ? pool[0].id : null;
  }
  async takeover() {
    // only judge staleness from a live socket view; a stale local copy could misread a healthy host (a 409 would also stop it)
    if (this.net.Socket && this.net.state !== 'online') return false;
    if (this.hostCandidate(this.s, this.players()) !== this.me) return false;
    await this.send('ut.host', d => { if (!supported(d.state) || this.hostCandidate(d.state, d.players) !== d.playerId) return null; const s = copy(d.state); s.hostId = d.playerId; s.hostSeenAt = this.now(); return { state: s }; }, true);
    return true;
  }
  hostReason(s, players, now) {
    const present = new Set(seated(players).map(p => p.id));
    if (s.phase === 'playing') {
      if (s.order.filter(id => present.has(id)).length < 2) return 'over';
      if (!present.has(s.turn.p)) return 'skip';
      if (now > s.turn.until + 1500) return 'auto';
    }
    if (now - (s.hostSeenAt || 0) > this.rt.hostHeartbeatSeconds * 1000) return 'beat';
    return null;
  }
  async hostDuty(now) {
    const reason = this.hostReason(this.s, this.players(), now); if (!reason) return false;
    await this.send('ut.' + reason, d => {
      if (!supported(d.state) || d.state.hostId !== d.playerId) return null;
      const r = this.hostReason(d.state, d.players, this.now()); if (r !== reason) return null;
      const c = this.ctx(d); let x;
      if (r === 'over') x = endForLeft(d.state, c.present);
      else if (r === 'skip') x = skipTurn(d.state, c, 'left');
      else if (r === 'auto') x = autoRoll(d.state, c);
      else x = copy(d.state);
      x.hostSeenAt = this.now();
      return { state: x };
    }, reason !== 'beat');
    return true;
  }
  /* ----- player actions ----- */
  roll() { const pair = [this.die(), this.die()]; return this.serial(() => this.send('ut.roll', d => {
    if (!supported(d.state) || d.spectator || !canAct(d.state, d.playerId)) return null;
    const dice = pair.slice(0, diceNeeded(d.state)); // same throw if a 409 forces a retry
    const s = rollMove(d.state, d.playerId, dice, this.ctx(d)); if (s.hostId === d.playerId) s.hostSeenAt = this.now();
    return { state: s, payload: { dice } };
  }, true)); }
  useCard(card, target) { return this.serial(() => this.send('ut.card', d => {
    if (!supported(d.state) || d.spectator) return null;
    const c = this.ctx(d), why = cardBlock(d.state, d.playerId, card, target, c.present); if (why) throw err(why);
    const s = useCard(d.state, d.playerId, card, target, c); if (s.hostId === d.playerId) s.hostSeenAt = this.now();
    return { state: s, payload: { card } };
  }, true)); }
  start() { return this.serial(() => this.send('ut.start', d => {
    if (!supported(d.state) || d.state.hostId !== d.playerId || !['lobby', 'over'].includes(d.state.phase)) return null;
    const list = seated(d.players); if (list.length < 2) throw err('few');
    const s = startGame(d.state, list.slice(0, 4).map(p => ({ id: p.id, name: p.displayName })), this.now(), this.R); s.hostSeenAt = this.now(); return { state: s, status: 'playing' };
  }, true)); }
  settings(patch) { return this.serial(() => this.send('ut.settings', d => {
    if (!supported(d.state) || d.state.hostId !== d.playerId || d.state.phase !== 'lobby') return null;
    const s = copy(d.state); if (patch.powerups !== undefined) s.settings.powerups = !!patch.powerups; s.hostSeenAt = this.now(); return { state: s };
  }, true)); }
  rematch() { return this.serial(() => this.send('ut.lobby', d => { if (!supported(d.state) || d.state.hostId !== d.playerId || d.state.phase !== 'over') return null; const s = resetToLobby(d.state); s.hostSeenAt = this.now(); return { state: s, status: 'waiting' }; }, true)); }
  leave() { return this.serial(async () => {
    try {
      if (this.data && !this.data.spectator && supported(this.s) && this.data.status !== 'closed') {
        await this.net.write('ut.leave', d => {
          let s = copy(d.state); const others = seated(d.players).filter(p => p.id !== d.playerId); let changed = false;
          if (s.hostId === d.playerId && others.length) { s.hostId = others[0].id; s.hostSeenAt = this.now(); changed = true; }
          if (s.phase === 'playing') {
            const present = new Set(others.map(p => p.id)), c = this.ctx(d, { present });
            if (s.order.filter(id => present.has(id)).length < 2) { s = endForLeft(s, present); changed = true; }
            else if (s.turn && s.turn.p === d.playerId) { s = skipTurn(s, c, 'left'); changed = true; }
          }
          return changed ? { state: s } : null;
        });
      }
    } catch (e) { /* leaving anyway */ }
    try { await this.net.leave(); } catch (e) { this.net.forget(); }
    this.data = null;
  }); }
}

root.UT = { GAME, SCHEMA, LIMITS, CARDS, TARGET_CARDS, copy, clamp, bytes, rnd, rid, shuffle, die, makeBoard, validateBoard, makeRules, drawCard, obj, arr, normalizeState, normalizeRoom, seated, newState, supported, startGame, beginTurn, advance, landing, walkPath, diceNeeded, canAct, rollMove, cardBlock, useCard, skipTurn, autoRoll, endForLeft, ranking, resetToLobby, botPlan, gameSubdomain, Connection, OnlineGame };
})(typeof window !== 'undefined' ? window : globalThis);

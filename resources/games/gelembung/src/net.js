/* Duel Gelembung: platform transport (/api/game + Reverb, socket-only, no polling) + versus coordinator. */
(function (root) {
'use strict';
const DG = root.DG;
const GAME = 'gelembung', SCHEMA = 1;
const LIMITS = { stateMax: 200000, nameMax: 24 };
/* Presence (the room channel is a public Reverb channel: no member_added/removed, so presence = room events).
   Every seated player writes at least every BEAT_MS while a round is live (snapshots, skills or a gb.beat).
   LOST_MS quiet → 'terputus…' badge; DROP_MS quiet (≈10 s grace after the badge) → out as 'Keluar'.
   gb.away (tab hidden) + AWAY_MS quiet → out. A board without a snapshot for STALE_MS (frozen/background tab) → out.
   A player missing from the server's player list (POST leave, incl. the pagehide keepalive) → out at once. */
const BEAT_MS = 4000, LOST_MS = 6000, DROP_MS = 16000, AWAY_MS = 10000, STALE_MS = 45000;
const copy = v => JSON.parse(JSON.stringify(v));
const bytes = v => new TextEncoder().encode(JSON.stringify(v)).length;
function rnd(n) { if (root.crypto && root.crypto.getRandomValues) { const a = new Uint32Array(1); root.crypto.getRandomValues(a); return Math.floor(a[0] / 4294967296 * n); } return Math.floor(Math.random() * n); }
const err = (code) => { const e = Error(code); e.code = code; return e; };
const obj = v => (v && typeof v === 'object') ? (Array.isArray(v) ? Object.assign({}, v) : v) : {};
const arr = v => Array.isArray(v) ? v : (v && typeof v === 'object' ? Object.values(v) : []);
const int = (v, lo, hi) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : lo; };
/** seed for the i-th target of one burst (i = 0 keeps the event seed) */
const hitSeed = (seed, i) => i ? 1 + ((seed + i * 104729) % 2147483646) : seed;
/** validated [[to, n], ...] from a gb.k payload: known, distinct targets, not the caster, total ≤ MAX_CHARGES; legacy {to} = 1 charge */
function cleanHits(p, from, ids) {
  const raw = Array.isArray(p.hits) ? p.hits.slice(0, 4) : (p.to != null ? [[p.to, 1]] : []), out = []; let total = 0;
  for (const h of raw) {
    if (!Array.isArray(h)) continue; const to = Number(h[0]), n = int(h[1], 1, DG.MAX_CHARGES);
    if (!ids.includes(to) || to === from || out.some(o => o[0] === to) || total + n > DG.MAX_CHARGES) continue;
    out.push([to, n]); total += n;
  }
  return out;
}
/** minimum ms between talk writes of each kind (msg = any chat/emoji) */
const TALK_GAP = { say: 1500, emo: 1200, msg: 1200 };
/** free-text chat: at most SAY_BURST messages per SAY_WINDOW ms, SAY_MAX characters each */
const SAY_MAX = 120, SAY_BURST = 6, SAY_WINDOW = 30000;
const cleanText = v => String(v == null ? '' : v).replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2066-\u2069]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, SAY_MAX);
const BOARD_RE = /^[01]:[.a-zA-Z?\/]{0,240}$/;
function normalizeState(raw) {
  const s = obj(raw); if (!s.game) return s;
  s.settings = obj(s.settings);
  if (s.start && typeof s.start === 'object') { s.start = obj(s.start); s.start.ids = arr(s.start.ids).map(Number); s.start.names = arr(s.start.names).map(String); s.start.chars = arr(s.start.chars).map(String); } else s.start = null;
  s.result = s.result && typeof s.result === 'object' ? obj(s.result) : null;
  if (s.result) { s.result.order = arr(s.result.order).map(Number); s.result.scores = arr(s.result.scores).map(Number); }
  s.chars = arr(s.chars).map(x => arr(x)).filter(x => x.length === 2).map(x => [Number(x[0]), String(x[1])]);
  s.outs = arr(s.outs).map(x => arr(x)).filter(x => x.length >= 2).map(x => [Number(x[0]), Number(x[1]) || 0, x[2] ? 1 : 0]);
  return s;
}
function normalizeRoom(d) { if (d && !d.unchanged && d.code) { d.state = normalizeState(d.state); d.private = obj(d.private); d.players = arr(d.players); d.events = arr(d.events).map(e => { const x = obj(e); x.payload = obj(x.payload); return x; }); } return d; }
function seated(players) { return (players || []).filter(p => !p.spectator).sort((a, b) => (a.seat ?? 0) - (b.seat ?? 0)); }
function newState(settings) { return { game: GAME, schema: SCHEMA, phase: 'lobby', hostId: null, hostSeenAt: 0, settings: Object.assign({}, settings || {}), chars: [], start: null, outs: [], result: null, games: 0 }; }
function supported(s) { return !!s && s.game === GAME && s.schema === SCHEMA; }
/** a snapshot event payload → safe view */
function cleanView(p) { const b = typeof p.b === 'string' && BOARD_RE.test(p.b) ? p.b : null; return { b, sc: int(p.sc, 0, 1e9), m: int(p.m, 0, DG.METER), q: int(p.q, 0, DG.MAX_CHARGES), im: int(p.im, 0, DG.IMMUNE), out: p.out ? 1 : 0, n: int(p.n, 0, 1e6), cd: int(p.cd, 0, 20000) }; }
/** who is still in: start ids minus outs */
function alive(s) { const st = s.start; if (!st) return []; const out = new Set((s.outs || []).map(o => o[0])); return st.ids.filter(id => !out.has(id)); }
/** final standings: survivor first, then latest eliminated → earliest */
function standings(s) { const st = s.start; if (!st) return []; const left = alive(s); return left.concat((s.outs || []).slice().reverse().map(o => o[0]).filter(id => st.ids.includes(id) && !left.includes(id))); }

/* ---------- Platform transport ---------- */
function gameSubdomain(hostname) { const m = /^([a-z0-9-]+)\.jadidaring\.(?:com|test)$/i.exec(String(hostname || '')); return m ? m[1].toLowerCase() : null; }
const SESSION_KEY = 'gelembung.session';
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
  async request(path, { body, auth = true, bearer = null } = {}) {
    if (!this.allowed) throw err('offline');
    if (this.now() < this.backoffUntil) { const e = err('busy'); e.status = 429; e.wait = Math.ceil((this.backoffUntil - this.now()) / 1000); throw e; }
    const headers = { 'Accept': 'application/json', 'Content-Type': 'application/json' };
    if (bearer) headers.Authorization = 'Bearer ' + bearer; else if (auth && this.token) headers.Authorization = 'Bearer ' + this.token;
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
        this.subscribed = true; this.attempts = 0; this.onlineSince = this.now(); this.setState('online'); this.stats.catchUps++;
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
  /** Does an invite code exist? Asks GET rooms/{code} with a throw-away bearer: 403 = the room exists (we are just not a member), 404/422 = no such room. */
  async probe(code) {
    if (!/^[A-Z2-9]{6}$/.test(code || '')) return 'missing';
    try { await this.request('rooms/' + code, { auth: false, bearer: 'invite-check' }); return 'exists'; }
    catch (e) { if (e.status === 403 || e.status === 401) return 'exists'; if (e.status === 404 || e.status === 422) return 'missing'; return 'unknown'; }
  }
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
  /** best-effort leave while the page is going away (pagehide): keepalive POST, no await, then forget the session */
  leaveBeacon() {
    if (!this.allowed || !this.code || !this.token || !this.fetchFn) return false;
    try { const p = this.fetchFn('/api/game/rooms/' + this.code + '/leave', { method: 'POST', keepalive: true, credentials: 'same-origin', headers: { 'Accept': 'application/json', 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + this.token }, body: '{}' }); if (p && p.catch) p.catch(() => {}); } catch (e) { /* page is going away */ }
    this.forget(); return true;
  }
  forget() { this.latest = null; this.code = null; this.token = null; this.version = null; this.save(); this.subscribe(); }
  stop() { this.stopped = true; if (this.reconnectTimer) this.timers.clearTimeout(this.reconnectTimer); this.reconnectTimer = null; this.timers.clearInterval(this.heartbeat); if (this.socket) this.socket.close(); this.setState('idle'); }
}
/* ---------- Versus coordinator ----------
   Every client simulates its own board authoritatively. The room state only carries the lobby (character
   picks), the start block {seed, at, ids, names, chars, v}, the elimination list `outs` and the result.
   Room events: gb.s board snapshot {b, sc, m, im, out, n, cd} (trailing-throttled, only when the board changed),
   gb.k skill {to, sk, seed} (the target applies it with the seed: deterministic placement on every screen),
   gb.o elimination (writes outs; whoever leaves one survivor also writes the result), gb.p chat/emoji. */
class VersusRoom {
  constructor(net, cfg, { onChange = () => {}, onNotice = () => {}, onTalk = () => {}, onSnap = () => {}, onSkill = () => {}, onOut = () => {}, onRound = () => {} } = {}) {
    this.net = net; this.cfg = cfg; this.onChange = onChange; this.onNotice = onNotice; this.onTalk = onTalk; this.onSnap = onSnap; this.onSkill = onSkill; this.onOut = onOut; this.onRound = onRound;
    this.rt = Object.assign({ hostHeartbeatSeconds: 10, hostStaleSeconds: 30 }, cfg.realtime || {});
    this.tail = Promise.resolve(); this.data = null; this.lastWrite = 0; this.writes = []; this.reading = false; this.readAgain = false;
    this.key = null; this.seenV = -1; this.talkSeen = -1; this.views = new Map(); this.lastSeen = new Map(); this.awayAt = new Map(); this.boardAt = new Map(); this.rxAt = 0; this.goneSent = new Map(); this.outSeen = new Set(); this.talkAt = {}; this.sayLog = [];
    this.snapper = null; this.dirtyAt = 0; this.urgent = false; this.lastSnap = 0; this.snaps = 0; this.scoreOf = () => 0;
  }
  serial(work) { const next = this.tail.then(work); this.tail = next.catch(() => {}); return next; }
  get me() { return this.data ? this.data.playerId : null; }
  get s() { return (this.data && this.data.state) || {}; }
  now() { return this.net.serverNow(); }
  players() { return (this.data && this.data.players) || []; }
  isHost() { return !!this.data && this.s.hostId === this.me && !this.data.spectator; }
  inRound() { const s = this.s; return supported(s) && !!s.start && (s.phase === 'playing' || s.phase === 'over'); }
  amIn() { return this.inRound() && this.s.start.ids.includes(this.me) && !this.data.spectator; }
  alive() { return alive(this.s); }
  standings() { return standings(this.s); }
  charOf(id) { const st = this.s.start; if (st && this.inRound()) { const i = st.ids.indexOf(id); if (i >= 0) return st.chars[i]; } const x = (this.s.chars || []).find(c => c[0] === id); return x ? x[1] : null; }
  nameOf(id) { const st = this.s.start; if (st) { const i = st.ids.indexOf(id); if (i >= 0) return st.names[i]; } const p = this.players().find(q => q.id === id); return p ? String(p.displayName || 'Pemain') : 'Pemain'; }
  receive(data) {
    if (!data || data.unchanged || !data.code) return; normalizeRoom(data);
    if (this.data && this.data.code === data.code && data.version < this.data.version) return;
    this.data = data; this.rxAt = this.net.now();
    try { this.ingest(data); } catch (e) { this.onNotice(e); }
    this.onChange(this);
  }
  ingest(d) {
    const s = d.state, t = this.net.now(), ts = this.now(); if (!supported(s)) return;
    const st = s.start, live = this.inRound();
    if (live) {
      const key = st.seed + ':' + st.v;
      if (this.key !== key) { this.key = key; this.views = new Map(); this.lastSeen = new Map(st.ids.map(id => [id, ts])); this.awayAt = new Map(); this.boardAt = new Map(); this.goneSent = new Map(); this.outSeen = new Set(); this.lastSnap = 0; this.dirtyAt = 0; this.onRound(st); }
    } else if (s.phase === 'lobby' && this.key) { this.key = null; this.views = new Map(); this.onRound(null); }
    for (const ev of d.events) {
      if (ev.version <= this.seenV) continue;
      const p = ev.payload || {}, id = ev.playerId;
      if (id != null) { const c = Date.parse(ev.createdAt || ''), at = Number.isFinite(c) ? Math.min(ts, c + (/\.\d/.test(ev.createdAt) ? 0 : 500)) : ts; if (at > (this.lastSeen.get(id) || 0)) this.lastSeen.set(id, at);
        if (ev.type === 'gb.away') this.awayAt.set(id, at); else if (ev.type === 'gb.back' || ev.type === 'gb.s') this.awayAt.delete(id);
        if (ev.type === 'gb.s' && at > (this.boardAt.get(id) || 0)) this.boardAt.set(id, at); }
      if (ev.type === 'gb.p') { if (ev.version > this.talkSeen) { this.talkSeen = ev.version; this.onTalk(ev); } continue; }
      if (!live || ev.version <= st.v || !st.ids.includes(ev.playerId)) continue;
      if (ev.type === 'gb.s') { const v = cleanView(p); if (!v.b) continue; v.imUntil = t + v.im; v.at = t; v.v = ev.version; const old = this.views.get(ev.playerId); if (old && old.v > ev.version) continue; this.views.set(ev.playerId, v); this.onSnap(ev.playerId, v); }
      else if (ev.type === 'gb.k') {
        const sk = String(p.sk || ''), from = ev.playerId, seed = int(p.seed, 1, 2147483646), hits = cleanHits(p, from, st.ids);
        if (!DG.CHARS.includes(sk) || this.charOf(from) !== sk || !hits.length) continue;
        const x = hits.reduce((a, h) => a + h[1], 0);
        hits.forEach(([to, n], i) => {
          const v = this.views.get(to); if (v && t >= (v.imUntil || 0)) v.imUntil = t + DG.IMMUNE;
          this.onSkill({ from, to, sk, n, x, i, seed: hitSeed(seed, i), v: ev.version, mine: to === this.me, own: from === this.me });
        });
      }
    }
    if (d.events.length) this.seenV = Math.max(this.seenV, d.events[d.events.length - 1].version);
    if (live) for (const o of s.outs) if (!this.outSeen.has(o[0])) { this.outSeen.add(o[0]); this.onOut(o[0], !!o[2]); }
  }
  async enter(mode, opts) { const data = await this.net.enter(mode, Object.assign({}, opts, { state: newState(opts.settings) })); this.data = null; this.key = null; this.seenV = -1; this.receive(data); if (data && data.state && supported(data.state) && !data.state.hostId && !data.spectator) await this.serial(() => this.claimHost()); return data; }
  async resume() { const data = await this.net.read({ full: true }); this.receive(data); return data; }
  /** Event-driven read (wakeup / catch-up / visibility). Coalesced: one in flight, one queued. */
  async refresh(full) {
    if (this.reading) { this.readAgain = true; return; }
    this.reading = true;
    try { do { this.readAgain = false; this.reads = (this.reads || 0) + 1; const d = await this.net.read({ full: !!full }); this.receive(d); full = false; } while (this.readAgain); }
    catch (e) {
      if (e.status === 429 && !this.busyRetry) { const wait = Math.max(0, (this.net.backoffUntil || 0) - this.net.now()) + 50; this.busyRetry = this.net.timers.setTimeout(() => { this.busyRetry = null; this.refresh().catch(() => {}); }, wait); }
      throw e;
    }
    finally { this.reading = false; }
  }
  budgetOk(essential) { const t = this.net.now(); this.writes = this.writes.filter(x => t - x < 60000); return this.writes.length < (essential ? 110 : 95); }
  async send(type, build, essential) {
    for (let i = 0; i < 4; i++) {
      if (!this.budgetOk(essential)) throw err('budget');
      this.writes.push(this.net.now()); this.lastWrite = this.net.now();
      try { const res = await this.net.write(type, d => { if (d) this.receive(d); return build(d); }); if (res) this.receive(res); return res; }
      catch (e) { if (e.status !== 409 || i === 3) throw e; this.net.latest = null; }
    }
    return null;
  }
  claimHost() { return this.send('gb.host', d => { if (!supported(d.state) || d.state.hostId || d.spectator) return null; const s = copy(d.state); s.hostId = d.playerId; s.hostSeenAt = this.now(); return { state: s }; }, true); }
  /** character pick in the lobby, unique per room ([playerId, char] pairs: PHP keeps lists as lists) */
  pickChar(ch) {
    if (!DG.CHARS.includes(ch)) return Promise.reject(err('bad'));
    return this.serial(() => this.send('gb.char', d => {
      if (!supported(d.state) || d.spectator || !['lobby', 'over'].includes(d.state.phase)) return null;
      const seatedIds = new Set(seated(d.players).map(p => p.id));
      if (d.state.chars.some(x => x[1] === ch && x[0] !== d.playerId && seatedIds.has(x[0]))) throw err('taken');
      const s = copy(d.state); s.chars = s.chars.filter(x => x[0] !== d.playerId && seatedIds.has(x[0])).concat([[d.playerId, ch]]); return { state: s };
    }, false));
  }
  start() { return this.serial(() => this.send('gb.start', d => {
    if (!supported(d.state) || d.state.hostId !== d.playerId || !['lobby', 'over'].includes(d.state.phase)) return null;
    const list = seated(d.players).slice(0, 4); if (list.length < 2) throw err('few');
    const s = copy(d.state); s.phase = 'playing'; s.result = null; s.outs = []; s.games = (s.games || 0) + 1; s.hostSeenAt = this.now();
    const cs = list.map(p => { const x = s.chars.find(h => h[0] === p.id); return x ? x[1] : null; }), taken = new Set();
    cs.forEach((c, i) => { if (c && taken.has(c)) cs[i] = null; else if (c) taken.add(c); });
    cs.forEach((c, i) => { if (!c) { const f = DG.CHARS.find(k => !taken.has(k)); cs[i] = f; taken.add(f); } });
    s.start = { seed: 1 + rnd(2147483646), at: this.now() + 4000, ids: list.map(p => p.id), names: list.map(p => String(p.displayName || 'Pemain').slice(0, LIMITS.nameMax)), chars: cs, v: d.version + 1 };
    return { state: s, status: 'playing' };
  }, true)); }
  rematch() { return this.serial(() => this.send('gb.lobby', d => { if (!supported(d.state) || d.state.hostId !== d.playerId || d.state.phase !== 'over') return null; const s = copy(d.state); s.phase = 'lobby'; s.start = null; s.outs = []; s.hostSeenAt = this.now(); return { state: s, status: 'waiting' }; }, true)); }
  /* ----- match ----- */
  /** snapper() → {b, sc, m, im, out, n, cd}; call dirty() whenever the board changed (urgent: right after a hit / a skill) */
  dirty(urgent) { if (!this.dirtyAt) this.dirtyAt = this.net.now(); if (urgent) this.urgent = true; }
  snapGap() { const n = this.s.start ? this.s.start.ids.length : 2; return 900 + 400 * n; }
  /** one burst event: hits = [[to, n], ...] (or a single target id); total charges ≤ MAX_CHARGES */
  skill(hits, sk) {
    if (!this.amIn() || this.s.phase !== 'playing') return Promise.resolve(null);
    if (!Array.isArray(hits)) hits = [[hits, 1]];
    const seed = 1 + rnd(2147483646);
    return this.serial(() => this.send('gb.k', d => {
      if (!supported(d.state) || d.state.phase !== 'playing' || !alive(d.state).includes(d.playerId)) return null;
      const ok = hits.filter(h => alive(d.state).includes(h[0])); if (!ok.length) return null;
      return { payload: { hits: ok, sk, seed } };
    }, true)).then(r => r ? seed : null);
  }
  /** mark a player out; the write that leaves ≤ 1 survivor also ends the round */
  outBody(d, id, gone) {
    if (!supported(d.state) || d.state.phase !== 'playing' || !d.state.start) return null;
    const ids = (Array.isArray(id) ? id : [id]).filter((x, i, a) => d.state.start.ids.includes(x) && !d.state.outs.some(o => o[0] === x) && a.indexOf(x) === i); if (!ids.length) return null;
    const s = copy(d.state), at = this.now(); for (const x of ids) s.outs.push([x, at, gone ? 1 : 0]);
    const left = alive(s), body = { state: s, payload: { p: ids[0], ps: ids, gone: gone ? 1 : 0 } };
    if (left.length <= 1) { s.phase = 'over'; const order = standings(s); s.result = { win: left.length ? left[0] : null, order, scores: order.map(x => this.scoreOf(x) | 0), at: this.now() }; }
    return body;
  }
  eliminate(gone) { if (!this.amIn()) return Promise.resolve(null); return this.serial(() => this.send('gb.o', d => this.outBody(d, d.playerId, !!gone), true)); }
  /** tab hidden / visible again while my board is live (presence hint for the others; beats continue while timers run) */
  notice(away) {
    if (!this.amIn() || this.s.phase !== 'playing' || !alive(this.s).includes(this.me) || this.awayNote === !!away) return Promise.resolve(null);
    this.awayNote = !!away; return this.serial(() => this.send(away ? 'gb.away' : 'gb.back', d => (supported(d.state) && d.state.phase === 'playing' ? { payload: {} } : null), false)).catch(() => null);
  }
  /** my view of the room is fresh enough to judge others (socket up for a moment, data received recently) */
  canJudge() { const n = this.net, t = n.now(); if (n.Socket && (n.state !== 'online' || t - (n.onlineSince || 0) < 2500)) return false; return t - this.rxAt < 8000; }
  /** 'ok' | 'away' (tab hidden, still connected) | 'lost' (quiet: badge) | 'gone' (to be eliminated) for a player of the live round */
  presence(id) {
    const s = this.s; if (!this.inRound() || s.phase !== 'playing' || id === this.me || !s.start.ids.includes(id)) return 'ok';
    if (!seated(this.players()).some(p => p.id === id)) return 'gone';
    const t = this.now(), start = s.start.at; if (t < start) return 'ok';
    const quiet = t - Math.max(start, this.lastSeen.get(id) || 0), away = this.awayAt.has(id);
    if (quiet > DROP_MS || (away && quiet > AWAY_MS)) return 'gone';
    if (t - Math.max(start, this.boardAt.get(id) || 0) > STALE_MS) return 'gone';
    if (quiet > LOST_MS || (away && quiet > 2500)) return 'lost';
    return away ? 'away' : 'ok';
  }
  /** chat (say) or emoji taunt (emo); throttled so 4 chatty players stay well below the platform budget */
  talk(x, fields) {
    if (!this.data || this.data.spectator) return Promise.resolve(null);
    const gap = TALK_GAP[x]; if (!gap || x === 'msg') return Promise.reject(err('bad'));
    const now = this.net.now(); if (now - (this.talkAt[x] || 0) < gap || now - (this.talkAt.msg || 0) < TALK_GAP.msg) return Promise.reject(err('slow'));
    const f = fields || {}, payload = { x };
    if (x === 'say') { this.sayLog = this.sayLog.filter(q => now - q < SAY_WINDOW); if (this.sayLog.length >= SAY_BURST) return Promise.reject(err('slow')); payload.m = cleanText(f.m); if (!payload.m) return Promise.reject(err('bad')); this.sayLog.push(now); }
    else payload.k = String(f.k || '').slice(0, 16);
    this.talkAt[x] = now; this.talkAt.msg = now;
    return this.serial(() => this.send('gb.p', () => ({ payload }), false));
  }
  leave() { return this.serial(async () => {
    try {
      if (this.data && !this.data.spectator && supported(this.s) && this.data.status !== 'closed') {
        const others = seated(this.players()).filter(p => p.id !== this.me);
        if (this.s.phase === 'playing' && alive(this.s).includes(this.me)) await this.net.write('gb.o', d => this.outBody(d, d.playerId, true));
        if (this.s.hostId === this.me && others.length) await this.net.write('gb.host', d => { if (d.state.hostId !== d.playerId) return null; const s = copy(d.state); s.hostId = others[0].id; s.hostSeenAt = this.now(); return { state: s }; });
      }
    } catch (e) { /* leaving anyway */ }
    try { await this.net.leave(); } catch (e) { this.net.forget(); }
    this.data = null; this.key = null; this.views = new Map();
  }); }
  /** the page is going away: keepalive leave (the server drops me from the player list → the others eliminate me at once) */
  leaveNow() { const ok = this.net.leaveBeacon(); this.data = null; this.key = null; this.views = new Map(); return ok; }
  /* ----- periodic duties (call every ~250 ms; writes only, never reads) ----- */
  tick() { return this.serial(() => this.duties().catch(e => { if (e.status !== 409 && e.code !== 'busy' && e.code !== 'budget') this.onNotice(e); })); }
  async duties() {
    if (!this.data || this.data.spectator || this.data.status === 'closed' || !supported(this.s)) return;
    if (await this.takeover()) return;
    if (await this.snapDuty()) return;
    if (this.isHost()) { if (await this.hostDuty()) return; }
    else if (this.s.phase === 'playing' && this.amIn() && this.net.now() - this.lastWrite > BEAT_MS) await this.send('gb.beat', () => ({ payload: {} }), false);
  }
  async snapDuty() {
    if (!this.snapper || !this.dirtyAt || !this.amIn() || this.s.phase !== 'playing') return false;
    const t = this.net.now(), since = t - this.lastSnap, gap = this.urgent ? 450 : this.snapGap();
    if (since < gap || t < this.s.start.at || !this.budgetOk(this.urgent)) return false;
    const payload = this.snapper(); if (!payload) { this.dirtyAt = 0; return false; }
    this.dirtyAt = 0; this.urgent = false; this.lastSnap = t; this.snaps++;
    await this.send('gb.s', d => (supported(d.state) && d.state.phase === 'playing' ? { payload } : null), false);
    return true;
  }
  hostCandidate(s, players) {
    const list = seated(players), present = list.some(p => p.id === s.hostId), stale = s.hostId && this.now() - (s.hostSeenAt || 0) > this.rt.hostStaleSeconds * 1000;
    // during a live round a host that dropped (quiet / frozen board / gone from the list) is replaced right away
    const judge = s.phase === 'playing' && this.inRound() && this.canJudge(), bad = id => judge && id !== this.me && this.presence(id) === 'gone';
    const dead = s.hostId && (!present || bad(s.hostId));
    if (s.hostId && !dead && !stale) return null;
    const pool = list.filter(p => (p.id !== s.hostId || (!stale && !dead)) && !bad(p.id));
    return pool.length ? pool[0].id : null;
  }
  async takeover() {
    if (this.net.Socket && this.net.state !== 'online') return false;
    if (this.hostCandidate(this.s, this.players()) !== this.me) return false;
    await this.send('gb.host', d => { if (!supported(d.state) || this.hostCandidate(d.state, d.players) !== d.playerId) return null; const s = copy(d.state); s.hostId = d.playerId; s.hostSeenAt = this.now(); return { state: s }; }, true);
    return true;
  }
  async hostDuty() {
    const s = this.s, t = this.now();
    if (s.phase === 'playing' && s.start && t > s.start.at) {
      // players who left the room, dropped (after the grace period) or froze are eliminated together in one write,
      // so the round can always finish; the write that leaves ≤ 1 survivor also writes the result
      const judge = this.canJudge(), gone = alive(s).filter(id => id !== this.me && t - (this.goneSent.get(id) || 0) >= 6000 && (judge ? this.presence(id) === 'gone' : !seated(this.players()).some(p => p.id === id)));
      if (gone.length) { gone.forEach(id => this.goneSent.set(id, t)); await this.send('gb.o', d => this.outBody(d, gone.filter(id => this.presence(id) === 'gone'), true), true); return true; }
    }
    if ((s.phase === 'lobby' || s.phase === 'over') && (s.chars || []).length) {
      // a player who left before the start frees their character
      const here = new Set(seated(this.players()).map(p => p.id));
      if (s.chars.some(x => !here.has(x[0]))) { await this.send('gb.char', d => { if (!supported(d.state) || d.state.hostId !== d.playerId) return null; const ids = new Set(seated(d.players).map(p => p.id)); if (!d.state.chars.some(x => !ids.has(x[0]))) return null; const x = copy(d.state); x.chars = x.chars.filter(c => ids.has(c[0])); return { state: x }; }, false); return true; }
    }
    if (t - (s.hostSeenAt || 0) > this.rt.hostHeartbeatSeconds * 1000) {
      await this.send('gb.beat', d => { if (!supported(d.state) || d.state.hostId !== d.playerId) return null; const x = copy(d.state); x.hostSeenAt = this.now(); return { state: x }; }, false);
      return true;
    }
    return false;
  }
}

root.DGNet = { BEAT_MS, LOST_MS, DROP_MS, AWAY_MS, STALE_MS, GAME, SCHEMA, TALK_GAP, SAY_MAX, SAY_BURST, cleanText, cleanHits, hitSeed, LIMITS, copy, bytes, rnd, obj, arr, normalizeState, normalizeRoom, seated, newState, supported, cleanView, alive, standings, gameSubdomain, Connection, VersusRoom };
})(typeof window !== 'undefined' ? window : globalThis);

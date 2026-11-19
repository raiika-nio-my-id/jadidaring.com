/* Benteng Kampung: platform transport (/api/game + Reverb, socket-only, no polling) + lockstep coordinator. */
(function (root) {
'use strict';
const BK = root.BK;
const LIMITS = { stateMax: 200000, nameMax: 24 };
const LEAD = 6, FINAL_LAG = 40, SNAP_EVERY = 200, SNAP_EVENTS = 20, BEAT_MS = 15000, GONE_MS = 45000;
const copy = v => JSON.parse(JSON.stringify(v));
const bytes = v => new TextEncoder().encode(JSON.stringify(v)).length;
function rnd(n) { if (root.crypto && root.crypto.getRandomValues) { const a = new Uint32Array(1); root.crypto.getRandomValues(a); return Math.floor(a[0] / 4294967296 * n); } return Math.floor(Math.random() * n); }
const err = (code) => { const e = Error(code); e.code = code; return e; };
const obj = v => (v && typeof v === 'object') ? (Array.isArray(v) ? Object.assign({}, v) : v) : {};
const arr = v => Array.isArray(v) ? v : (v && typeof v === 'object' ? Object.values(v) : []);
/** minimum ms between team-talk writes of each kind (msg = any chat/emoji) */
const TALK_GAP = { ping: 1500, chat: 1200, emo: 1200, say: 1500, msg: 1200, ask: 8000, cur: 2500 };
/** free-text chat: at most SAY_BURST messages per SAY_WINDOW ms, SAY_MAX characters each */
const SAY_MAX = 120, SAY_BURST = 6, SAY_WINDOW = 30000;
/** printable text only: no control / bidi-override characters, collapsed spaces, hard length cap */
const cleanText = v => String(v == null ? '' : v).replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2066-\u2069]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, SAY_MAX);
function normalizeState(raw) {
  const s = obj(raw); if (!s.game) return s;
  s.settings = obj(s.settings);
  if (s.start && typeof s.start === 'object') { s.start = obj(s.start); s.start.ids = arr(s.start.ids).map(Number); s.start.names = arr(s.start.names).map(String); s.start.heroes = arr(s.start.heroes).map(String); } else s.start = null;
  if (s.snap && typeof s.snap === 'object') { s.snap = obj(s.snap); s.snap.pend = arr(s.snap.pend).map(a => { const x = obj(a); x.a = obj(x.a); return x; }); } else s.snap = null;
  s.result = s.result && typeof s.result === 'object' ? obj(s.result) : null;
  s.heroes = arr(s.heroes).map(x => arr(x)).filter(x => x.length === 2).map(x => [Number(x[0]), String(x[1])]);
  return s;
}
function normalizeRoom(d) { if (d && !d.unchanged && d.code) { d.state = normalizeState(d.state); d.private = obj(d.private); d.players = arr(d.players); d.events = arr(d.events).map(e => { const x = obj(e); x.payload = obj(x.payload); if (x.payload.a) x.payload.a = obj(x.payload.a); return x; }); } return d; }
function seated(players) { return (players || []).filter(p => !p.spectator).sort((a, b) => (a.seat ?? 0) - (b.seat ?? 0)); }
function newState(settings) { return { game: BK.GAME, schema: BK.SCHEMA, phase: 'lobby', hostId: null, hostSeenAt: 0, settings: Object.assign({}, settings || {}), start: null, snap: null, result: null, games: 0, heroes: [] }; }
function supported(s) { return !!s && s.game === BK.GAME && s.schema === BK.SCHEMA; }

/* ---------- Platform transport ---------- */
function gameSubdomain(hostname) { const m = /^([a-z0-9-]+)\.jadidaring\.(?:com|test)$/i.exec(String(hostname || '')); return m ? m[1].toLowerCase() : null; }
const SESSION_KEY = 'benteng.session';
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
  forget() { this.latest = null; this.code = null; this.token = null; this.version = null; this.save(); this.subscribe(); }
  stop() { this.stopped = true; if (this.reconnectTimer) this.timers.clearTimeout(this.reconnectTimer); this.reconnectTimer = null; this.timers.clearInterval(this.heartbeat); if (this.socket) this.socket.close(); this.setState('idle'); }
}

/* ---------- Lockstep coordinator ----------
   Room state only carries the lobby, the start block {seed, at, ids, names, v} and the host's latest
   snapshot {v, tick, sum, sim, pend}. Every player action is a room event `bk.a` {t: applyTick, a}.
   All clients replay the same ordered action list (by t, then event version) through the same integer sim.
   A late action (arrives after its tick was simulated) rewinds and replays. The host finalises history
   with a snapshot (wave end / every 10 s / after 20 events); actions newer than the snapshot but aimed
   before its tick are void for everyone. Clients compare checksums at the snapshot tick and rebase on it. */
class LockstepGame {
  constructor(net, cfg, world, { onChange = () => {}, onNotice = () => {}, onPing = () => {}, onFx = () => {} } = {}) {
    this.net = net; this.cfg = cfg; this.world = world; this.onChange = onChange; this.onNotice = onNotice; this.onPing = onPing; this.onFx = onFx;
    this.rt = Object.assign({ hostHeartbeatSeconds: 10, hostStaleSeconds: 30 }, cfg.realtime || {});
    this.tail = Promise.resolve(); this.data = null; this.lastWrite = 0; this.writes = []; this.reading = false; this.readAgain = false;
    this.tl = null; this.key = null; this.seenV = -1; this.gapUntil = null; this.lastSeen = new Map(); this.goneSent = new Map(); this.pingSeen = -1; this.evTimes = []; this.talkAt = {}; this.curWant = null; this.curTimer = null; this.curSent = null;
    this.stats = { sums: 0, mismatches: 0, resyncs: 0, late: 0, snaps: 0, rejected: 0 };
  }
  serial(work) { const next = this.tail.then(work); this.tail = next.catch(() => {}); return next; }
  get me() { return this.data ? this.data.playerId : null; }
  get s() { return (this.data && this.data.state) || {}; }
  now() { return this.net.serverNow(); }
  players() { return (this.data && this.data.players) || []; }
  isHost() { return !!this.data && this.s.hostId === this.me && !this.data.spectator; }
  playing() { return !!this.tl && (this.s.phase === 'playing' || this.s.phase === 'over'); }
  get stale() { return this.gapUntil !== null; }
  /** fractional tick on the shared clock */
  clockTick() { const st = this.s.start; return st ? (this.now() - st.at) / (1000 / BK.TPS) : 0; }
  /** advance the local simulation to the shared clock; returns the current state */
  frame(fx) { if (!this.tl) return null; const target = Math.max(0, Math.floor(this.clockTick())); this.tl.advance(target, fx); return this.tl.cur; }
  receive(data) {
    if (!data || data.unchanged || !data.code) return; normalizeRoom(data);
    if (this.data && this.data.code === data.code && data.version < this.data.version) return;
    this.data = data;
    try { this.ingest(data); } catch (e) { this.onNotice(e); }
    this.onChange(this);
  }
  ingest(d) {
    const s = d.state, t = this.net.now();
    if (!supported(s) || !s.start || !(s.phase === 'playing' || s.phase === 'over')) { if (s.phase === 'lobby') { this.tl = null; this.key = null; } if (supported(s)) this.talkEvents(d); return; }
    const st = s.start, key = st.seed + ':' + st.v;
    if (this.key !== key || !this.tl) {
      const base = s.snap && s.snap.v >= st.v ? { v: s.snap.v, sim: JSON.parse(s.snap.sim) } : { v: st.v, sim: BK.create(this.world, st.seed, st.ids, st.heroes) };
      this.tl = new BK.Timeline(this.world, base); if (s.snap && s.snap.v >= st.v) this.tl.rebase(base, s.snap.pend);
      this.key = key; this.seenV = base.v; this.gapUntil = null; this.lastSeen = new Map(st.ids.map(id => [id, t])); this.goneSent = new Map();
      const first = d.events[0]; if (first && first.version > base.v + 1 && d.version > base.v) this.gapUntil = first.version - 1;
    } else if (s.snap && s.snap.v > this.tl.base.v) {
      const sn = s.snap;
      const voided = this.tl.acts.some(a => a.v > sn.v && a.t < sn.tick);
      if (this.tl.cur.t >= sn.tick && sn.tick >= this.tl.base.tick && !voided && !this.stale) {
        this.stats.sums++; if (BK.checksum(this.tl.stateAt(sn.tick)) !== sn.sum) { this.stats.mismatches++; this.stats.resyncs++; }
      } else this.stats.resyncs++;
      const sim = JSON.parse(sn.sim), keep = this.tl.acts.filter(a => a.v > sn.v && a.t >= sn.tick);
      this.tl.rebase({ v: sn.v, sim }, sn.pend.concat(keep));
      if (this.gapUntil !== null && sn.v >= this.gapUntil) this.gapUntil = null;
      this.stats.snaps++;
    }
    const first = d.events[0];
    if (first && first.version > this.seenV + 1 && first.version > this.tl.base.v + 1 && !this.isHost()) this.gapUntil = Math.max(this.gapUntil || 0, first.version - 1);
    for (const ev of d.events) {
      if (ev.version <= this.seenV) continue;
      if (ev.playerId != null) this.lastSeen.set(ev.playerId, t);
      this.evTimes.push(t);
      if (ev.type === 'bk.a' && ev.playerId != null && ev.version > this.tl.base.v) {
        const ok = this.tl.add({ v: ev.version, t: Number(ev.payload.t) | 0, p: ev.playerId, a: ev.payload.a || {} });
        if (!ok) { this.stats.rejected++; if (ev.playerId === this.me) this.onNotice(err('late')); }
      } else if (ev.type === 'bk.p' && ev.version > this.pingSeen) { this.pingSeen = ev.version; this.onPing(ev); }
    }
    if (d.events.length) this.seenV = Math.max(this.seenV, d.events[d.events.length - 1].version);
  }
  /** lobby: only team talk matters (chat before the game starts) */
  talkEvents(d) { for (const ev of d.events) if (ev.type === 'bk.p' && ev.version > this.pingSeen) { this.pingSeen = ev.version; this.onPing(ev); } }
  async enter(mode, opts) { const st = newState(opts.settings); const data = await this.net.enter(mode, Object.assign({}, opts, { state: st })); this.data = null; this.tl = null; this.key = null; this.receive(data); if (data && data.state && supported(data.state) && !data.state.hostId && !data.spectator) await this.serial(() => this.claimHost()); return data; }
  async resume() { const data = await this.net.read({ full: true }); this.receive(data); return data; }
  /** Event-driven read (wakeup / catch-up / visibility / after a write). Coalesced: one in flight, one queued. */
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
  /** write with a few jittered retries on 409 (every attempt rebuilds the body from the freshest room) */
  async send(type, build, essential) {
    for (let i = 0; i < 4; i++) {
      if (!this.budgetOk(essential)) throw err('budget');
      this.writes.push(this.net.now()); this.lastWrite = this.net.now();
      try { const res = await this.net.write(type, d => { if (d) this.receive(d); return build(d); }); if (res) this.receive(res); return res; }
      catch (e) { if (e.status !== 409 || i === 3) throw e; this.net.latest = null; } // net.write already refetched once; rebuild from the freshest room
    }
    return null;
  }
  claimHost() { return this.send('bk.host', d => { if (!supported(d.state) || d.state.hostId || d.spectator) return null; const s = copy(d.state); s.hostId = d.playerId; s.hostSeenAt = this.now(); return { state: s }; }, true); }
  /* ----- player input ----- */
  act(a) {
    if (!this.tl || !this.data || this.data.spectator) return Promise.resolve(null);
    const why = BK.check(this.world, this.tl.cur, this.me, a); if (why) return Promise.reject(err(why));
    return this.serial(() => this.send('bk.a', d => {
      if (!supported(d.state) || d.spectator || d.state.phase !== 'playing') return null;
      return { payload: { t: Math.max(Math.floor(this.clockTick()) + LEAD, this.tl ? this.tl.base.tick : 0), a } };
    }, true));
  }
  /** hero pick in the lobby (stored as [playerId, hero] pairs: PHP keeps lists as lists) */
  pickHero(h) {
    if (!BK.HEROES.includes(h)) return Promise.reject(err('bad'));
    return this.serial(() => this.send('bk.hero', d => {
      if (!supported(d.state) || d.spectator || !['lobby', 'over'].includes(d.state.phase)) return null;
      const s = copy(d.state); s.heroes = (s.heroes || []).filter(x => x[0] !== d.playerId).concat([[d.playerId, h]]); return { state: s };
    }, false));
  }
  /** events per minute seen in this room (all players) — the read budget is shared by everyone's writes */
  roomRate() { const t = this.net.now(); this.evTimes = this.evTimes.filter(x => t - x < 60000); return this.evTimes.length; }
  /**
   * Non-sim team talk, delivered like pings (socket wakeup → one read): x = 'ping' | 'chat' | 'emo' | 'ask' | 'cur'.
   * Throttled per kind so 4 chatty players stay far below the platform's 120 writes / 240 reads per minute.
   */
  talk(x, fields) {
    if (!this.data || this.data.spectator) return Promise.resolve(null);
    const gap = TALK_GAP[x]; if (!gap) return Promise.reject(err('bad'));
    const now = this.net.now(), msg = x === 'chat' || x === 'emo' || x === 'say'; if (now - (this.talkAt[x] || 0) < gap || msg && now - (this.talkAt.msg || 0) < TALK_GAP.msg) return Promise.reject(err('slow'));
    if (x === 'say') { this.sayLog = (this.sayLog || []).filter(q => now - q < SAY_WINDOW); if (this.sayLog.length >= SAY_BURST) return Promise.reject(err('slow')); if (!cleanText(fields && fields.m)) return Promise.reject(err('bad')); this.sayLog.push(now); }
    if (x === 'cur' && (this.roomRate() > 100 || !this.budgetOk(false) || this.writes.length > 60)) return Promise.reject(err('busy'));
    this.talkAt[x] = now; if (msg) this.talkAt.msg = now;
    const f = fields || {}, payload = { x }; if (Number.isInteger(f.c)) payload.c = f.c; if (f.k != null) payload.k = String(f.k).slice(0, 16); if (Number.isInteger(f.n)) payload.n = f.n; if (x === 'say') payload.m = cleanText(f.m);
    return this.serial(() => this.send('bk.p', () => ({ payload }), false));
  }
  ping(c, k) { return this.talk('ping', { c: c | 0, k }); }
  /** share where I'm looking: trailing-throttled, only after the selection settles, dropped when the room is busy */
  cursor(c) {
    if (!this.data || this.data.spectator || !this.tl) return;
    this.curWant = Number.isInteger(c) ? c : -1;
    if (this.curTimer) return;
    const go = () => { this.curTimer = null; const want = this.curWant; if (want === this.curSent) return;
      const wait = TALK_GAP.cur - (this.net.now() - (this.talkAt.cur || 0)); if (wait > 0) { this.curTimer = this.net.timers.setTimeout(go, wait); return; }
      this.curSent = want; this.talk('cur', { c: want }).catch(() => { this.curSent = null; }); };
    this.curTimer = this.net.timers.setTimeout(go, 450);
  }
  start() { return this.serial(() => this.send('bk.start', d => {
    if (!supported(d.state) || d.state.hostId !== d.playerId || !['lobby', 'over'].includes(d.state.phase)) return null;
    const list = seated(d.players).slice(0, 4); if (list.length < 2) throw err('few');
    const s = copy(d.state); s.phase = 'playing'; s.result = null; s.snap = null; s.games = (s.games || 0) + 1; s.hostSeenAt = this.now();
    const hs = list.map(p => { const x = (s.heroes || []).find(h => h[0] === p.id); return x ? x[1] : null; }), taken = new Set(hs.filter(Boolean));
    hs.forEach((h, i) => { if (!h) { const f = BK.HEROES.find(k => !taken.has(k)) || BK.HEROES[i % 4]; hs[i] = f; taken.add(f); } });
    s.start = { seed: 1 + rnd(2147483646), at: this.now() + 4000, ids: list.map(p => p.id), names: list.map(p => String(p.displayName || 'Pemain').slice(0, LIMITS.nameMax)), heroes: hs, v: d.version + 1 };
    return { state: s, status: 'playing' };
  }, true)); }
  rematch() { return this.serial(() => this.send('bk.lobby', d => { if (!supported(d.state) || d.state.hostId !== d.playerId || d.state.phase !== 'over') return null; const s = copy(d.state); s.phase = 'lobby'; s.start = null; s.snap = null; s.hostSeenAt = this.now(); return { state: s, status: 'waiting' }; }, true)); }
  leave() { return this.serial(async () => {
    try {
      if (this.data && !this.data.spectator && supported(this.s) && this.data.status !== 'closed') {
        const live = this.tl && this.s.phase === 'playing' && !BK.over(this.tl.cur), others = seated(this.players()).filter(p => p.id !== this.me);
        if (live && others.length && !BK.check(this.world, this.tl.cur, this.me, { k: 'gone', p: this.me })) await this.net.write('bk.a', () => ({ payload: { t: Math.floor(this.clockTick()) + LEAD, a: { k: 'gone', p: this.me } } }));
        if (this.s.hostId === this.me && others.length) await this.net.write('bk.host', d => { if (d.state.hostId !== d.playerId) return null; const s = copy(d.state); s.hostId = others[0].id; s.hostSeenAt = 0; return { state: s }; });
      }
    } catch (e) { /* leaving anyway */ }
    try { await this.net.leave(); } catch (e) { this.net.forget(); }
    this.data = null; this.tl = null; this.key = null;
  }); }
  /* ----- periodic duties (call every ~250 ms; writes only, never reads) ----- */
  tick() { return this.serial(() => this.duties().catch(e => { if (e.status !== 409 && e.code !== 'busy' && e.code !== 'budget') this.onNotice(e); })); }
  async duties() {
    if (!this.data || this.data.spectator || this.data.status === 'closed' || !supported(this.s)) return;
    if (await this.takeover()) return;
    if (this.isHost()) { if (await this.hostDuty()) return; }
    else if (this.s.phase === 'playing' && this.net.now() - this.lastWrite > (this.tl && (BK.player(this.tl.cur, this.me) || {}).g ? 3000 : BEAT_MS)) await this.send('bk.beat', () => ({ payload: {} }), false);
  }
  hostCandidate(s, players) {
    const list = seated(players), present = list.some(p => p.id === s.hostId), stale = s.hostId && this.now() - (s.hostSeenAt || 0) > this.rt.hostStaleSeconds * 1000;
    if (s.hostId && present && !stale) return null;
    const pool = list.filter(p => p.id !== s.hostId || !stale);
    return pool.length ? pool[0].id : null;
  }
  async takeover() {
    if (this.net.Socket && this.net.state !== 'online') return false;
    if (this.hostCandidate(this.s, this.players()) !== this.me) return false;
    await this.send('bk.host', d => { if (!supported(d.state) || this.hostCandidate(d.state, d.players) !== d.playerId) return null; const s = copy(d.state); s.hostId = d.playerId; s.hostSeenAt = this.now(); return { state: s }; }, true);
    return true;
  }
  /** which tick (if any) the host should finalise now */
  snapTick() {
    const tl = this.tl; if (!tl || this.s.phase !== 'playing') return null;
    const lim = tl.cur.t - FINAL_LAG, last = tl.base.tick;
    const mark = tl.marks.find(m => m > last && m <= tl.cur.t - 2); if (mark !== undefined) return mark; // wave end / game over: exact tick
    if (lim <= last) return null;
    if (lim - last >= SNAP_EVERY || (this.data.version - tl.base.v >= SNAP_EVENTS)) return lim;
    return null;
  }
  async hostDuty() {
    const s = this.s, t = this.now();
    if (s.phase === 'playing' && this.tl) {
      this.frame(null);
      const cur = this.tl.cur, present = new Set(seated(this.players()).map(p => p.id));
      // disconnect handling: players who left the room or went silent are marked gone (their coins/zone are shared out)
      for (const p of cur.pl) {
        const seen = this.lastSeen.get(p.id) || 0, sentAt = this.goneSent.get(p.id) || 0;
        if (t - sentAt < 6000) continue;
        if (!p.g && (!present.has(p.id) || t - seen > GONE_MS) && !BK.check(this.world, cur, this.me, { k: 'gone', p: p.id })) { this.goneSent.set(p.id, t); await this.send('bk.a', () => ({ payload: { t: Math.floor(this.clockTick()) + LEAD, a: { k: 'gone', p: p.id } } }), true); return true; }
        if (p.g && present.has(p.id) && t - seen < 8000 && !BK.check(this.world, cur, this.me, { k: 'back', p: p.id })) { this.goneSent.set(p.id, t); await this.send('bk.a', () => ({ payload: { t: Math.floor(this.clockTick()) + LEAD, a: { k: 'back', p: p.id } } }), true); return true; }
      }
      const F = this.snapTick();
      if (F !== null) {
        await this.send('bk.snap', d => {
          if (!supported(d.state) || d.state.hostId !== d.playerId || d.state.phase !== 'playing' || !this.tl) return null;
          const tick = Math.min(F, this.tl.cur.t); if (tick <= this.tl.base.tick) return null;
          const sim = this.tl.stateAt(tick), x = copy(d.state);
          x.snap = { v: d.version + 1, tick, sum: BK.checksum(sim), sim: JSON.stringify(sim), pend: this.tl.pending(tick).filter(a => a.v <= d.version) };
          x.hostSeenAt = this.now();
          const end = BK.over(sim); let status;
          if (end) { x.phase = 'over'; x.result = { win: sim.ph === 'win' || !!sim.x, endless: sim.x ? 1 : 0, wave: sim.w, score: sim.sc, lives: sim.lives, n: sim.n, kills: sim.kills, at: this.now() }; status = 'playing'; }
          return status ? { state: x, status } : { state: x };
        }, true);
        return true;
      }
    }
    if (t - (s.hostSeenAt || 0) > this.rt.hostHeartbeatSeconds * 1000) {
      await this.send('bk.beat', d => { if (!supported(d.state) || d.state.hostId !== d.playerId) return null; const x = copy(d.state); x.hostSeenAt = this.now(); return { state: x }; }, false);
      return true;
    }
    return false;
  }
}

root.BKNet = { TALK_GAP, SAY_MAX, cleanText, LIMITS, LEAD, FINAL_LAG, copy, bytes, rnd, obj, arr, normalizeState, normalizeRoom, seated, newState, supported, gameSubdomain, Connection, LockstepGame };
})(typeof window !== 'undefined' ? window : globalThis);

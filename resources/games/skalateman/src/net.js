/* Skala Teman: platform transport (/api/game + raw Reverb websocket wake-ups; Connection is the shared
   pattern from duitbersama / gelembung), an offline LocalLink for practice, and a small Room coordinator. */
(function (root) {
'use strict';
const GM_KEY = 'gamemaster'; // #gamemaster → GET rooms?gm=gamemaster (all lobbies, incl. private)
const SC = root.SL;
const LIMITS = { stateMax: 200000, nameMax: 24 };
const copy = v => JSON.parse(JSON.stringify(v));
const bytes = v => new TextEncoder().encode(JSON.stringify(v)).length;
function rnd(n) { return Math.floor(Math.random() * n); }
const err = (code) => { const e = Error(code); e.code = code; return e; };
const arr = SC.arr, obj = SC.obj;
function normalizeRoom(d) { if (d && !d.unchanged && d.code) { d.state = SC.normalize(d.state); d.private = obj(d.private); d.players = arr(d.players); d.events = arr(d.events).map(e => { const x = obj(e); x.payload = obj(x.payload); return x; }); gmFromServer(d); } return d; }
/** (GM) tag is server-owned (players[].gamemaster after a typed claim); state.gm is just a derived view of it for rendering */
function gmFromServer(d) { const g = {}; for (const p of d.players) if (p && p.gamemaster) g['p' + p.id] = 1; if (d.state && typeof d.state === 'object') d.state.gm = g; }
function seated(players) { return (players || []).filter(p => !p.spectator).sort((a, b) => (a.seat ?? 0) - (b.seat ?? 0)); }

/* ---------- Platform transport (from gelembung net.js) ---------- */
function gameSubdomain(hostname) { const m = /^([a-z0-9-]+)\.jadidaring\.(?:com|test)$/i.exec(String(hostname || '')); return m ? m[1].toLowerCase() : null; }
const SESSION_KEY = 'skalateman.session';
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
  setState(st) { if (this.state !== st) { this.state = st; try { this.onSocket(st === 'online', st); } catch (e) { /* a UI error must never break the socket */ } } }
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
    const common = { displayName: String(displayName || 'Tamu').slice(0, 24) }, create = Object.assign({}, common, { maxPlayers, state, private: {} });
    let data;
    if (mode === 'private' || mode === 'public') data = await this.request('rooms', { body: Object.assign({}, create, { visibility: mode }), auth: false });
    else if (mode === 'match') data = await this.request('rooms/match', { body: create, auth: false });
    else if (mode === 'watch') data = await this.request('rooms/' + encodeURIComponent(code) + '/watch', { body: common, auth: false });
    else data = await this.request('rooms/join', { body: Object.assign({}, common, { code, private: {} }), auth: false });
    if (typeof data.playerToken !== 'string' || !/^[A-Z2-9]{6}$/.test(data.code)) throw Error('no-session');
    this.code = data.code; this.token = data.playerToken; this.latest = null; this.version = null; this.adopt(data); this.save(); this.subscribe(); return data;
  }
  /** Lobby list. Public only by default; `{ gm: true }` (the #gamemaster hash) asks the platform for every lobby incl. private ones. */
  async rooms({ gm = false } = {}) { return this.request('rooms' + (gm ? '?gm=' + GM_KEY : ''), { auth: false }); }
  /** typed GM claim: POST rooms/{code}/gamemaster {code} (seated or spectator). 200 = room payload with gamemaster: true; wrong code = 403 */
  async gamemaster(code) { if (!this.code || !this.token) throw err('noroom'); return this.adopt(await this.request('rooms/' + this.code + '/gamemaster', { body: { code: String(code || '') } })); }
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

/* ---------- Offline practice link: same write(build) contract, applied locally (not saved) ---------- */
class LocalLink {
  constructor() { this.local = true; this.state = 'online'; this.code = null; this.latest = null; this.version = null; this.allowed = false; }
  now() { return Date.now(); }
  serverNow() { return Date.now(); }
  async enter(mode, { displayName, state } = {}) {
    this.code = 'LATIHAN'; this.version = 1;
    this.latest = normalizeRoom({ code: 'LATIHAN', version: 1, status: 'waiting', visibility: 'private', maxPlayers: 8, playerId: 1, host: true, spectator: false, state: copy(state), private: {}, players: [{ id: 1, displayName: String(displayName || 'Kamu').slice(0, 24), seat: 0, host: true, spectator: false }], events: [] });
    return copy(this.latest);
  }
  async read() { return copy(this.latest); }
  async write(type, build) {
    if (!this.latest) return null; const body = await build(copy(this.latest)); if (!body) return null;
    const d = copy(this.latest); if (body.state) d.state = body.state; if (body.status) d.status = body.status; d.version += 1; this.version = d.version;
    d.events = [{ version: d.version, type, payload: body.payload || {}, playerId: 1, createdAt: new Date().toISOString() }];
    this.latest = normalizeRoom(d); return copy(this.latest);
  }
  async leave() { this.latest = null; this.code = null; }
  leaveBeacon() { return true; }
  forget() { this.latest = null; this.code = null; }
  visible() {}
}

/* ---------- Room coordinator ----------
   Every write is read-modify-write with expectedVersion (Connection.write retries a 409 once; edit() up to 6x with
   jitter, because all players submit the same step at about the same time). Each player writes their own
   contribution; the host writes start / bots / timeouts / stand-ins / rematch / slideshow; any seated player may
   apply a timeout that the host left hanging for STALE_MS. */
const POLL_MS = 1200, STALE_MS = 5000;
class Room {
  constructor(link, { onChange = () => {} } = {}) { this.net = link; this.onChange = onChange; this.data = null; this.tail = Promise.resolve(); this.reading = false; this.again = false; }
  get local() { return !!this.net.local; }
  get me() { return this.data ? this.data.playerId : null; }
  get s() { return (this.data && this.data.state) || SC.newState(); }
  get spectator() { return !!(this.data && this.data.spectator); }
  get code() { return this.data ? this.data.code : ''; }
  now() { return this.net.serverNow(); }
  players() { return (this.data && this.data.players) || []; }
  /** server-owned GM flag (game_players.is_gamemaster) */
  isGamemaster(id) { const d = this.data; if (!d || this.local) return false; if (id == null) id = d.playerId; const p = (d.players || []).find(q => q.id === id); return !!(p ? p.gamemaster : (id === d.playerId && d.gamemaster)); }
  claimGamemaster(code) { if (this.local || !this.net.gamemaster) return Promise.reject(err('offline')); return this.serial(async () => { const d = await this.net.gamemaster(code); this.receive(d); return d; }); }
  seated() { return seated(this.players()); }
  isHost() { const d = this.data; if (!d || d.spectator) return false; if (this.local) return true; const p = d.players.find(q => q.id === d.playerId); return !!(p ? p.host : d.host); }
  receive(data) {
    if (!data || data.unchanged || !data.code) return; normalizeRoom(data);
    if (this.data && this.data.code === data.code && data.version < this.data.version) return;
    this.data = data; this.rxAt = Date.now(); this.onChange(this);
  }
  serial(work) { const next = this.tail.then(work); this.tail = next.catch(() => {}); return next; }
  /** fn(s, d) mutates a normalized copy of state; return false/null to cancel, or {status} to also set the room status */
  edit(type, fn) {
    return this.serial(async () => {
      for (let i = 0; i < 6; i++) {
        try {
          const res = await this.net.write(type, d => {
            if (d) this.receive(d); if (!d || !SC.supported(d.state)) return null;
            const s = SC.normalize(copy(d.state)), out = fn(s, d); if (out === null || out === false) return null;
            return Object.assign({ state: s }, typeof out === 'object' ? out : {});
          });
          if (res) this.receive(res); return res;
        } catch (e) { if (e.status !== 409 || i === 5) throw e; this.net.latest = null; await new Promise(r => setTimeout(r, 60 + Math.random() * 240 * (i + 1))); }
      }
      return null;
    });
  }
  async enter(mode, opts) {
    const state = SC.newState(opts.set || {});
    const data = await this.net.enter(mode, Object.assign({}, opts, { state, maxPlayers: SC.MAX_SEATS }));
    this.data = null; this.receive(data);
    if (!this.spectator) await this.hello(opts.av | 0, null).catch(() => {});
    return this.data;
  }
  /** avatar + (GM) tag announce. gm: true/false = set/clear my mark in state.gm (seated only), null = leave it.
      Also drops (GM) marks of players who are no longer seated. */
  hello(av, gm = null) {
    const me = this.me, key = 'p' + me;
    return this.edit('hello', (s, d) => {
      const live = new Set(seated(d.players).map(p => 'p' + p.id)); let ch = false;
      if (!this.local) for (const k of Object.keys(s.gm)) if (!live.has(k)) { delete s.gm[k]; ch = true; }
      if (gm !== null && live.has(key) && !!s.gm[key] !== !!gm) { if (gm) s.gm[key] = 1; else delete s.gm[key]; ch = true; }
      const i = s.av.findIndex(x => x[0] === me); if (i >= 0 && s.av[i][1] === av) return ch ? undefined : null;
      if (i >= 0) s.av[i] = [me, av]; else s.av.push([me, av]); s.av = s.av.slice(-24);
    });
  }
  async resume() { const d = await this.net.read({ full: true }); this.receive(d); return d; }
  async refresh(full) {
    if (this.local) return;
    if (this.reading) { this.again = true; return; }
    this.reading = true;
    try { const d = await this.net.read({ full }); this.receive(d); }
    catch (e) { if (e.status === 403 || e.status === 404) { this.gone = true; this.onChange(this); } }
    finally { this.reading = false; if (this.again) { this.again = false; this.refresh(); } }
  }
  /** poll only while the websocket is down */
  tick() { if (this.local || this.net.state === 'online') return; const t = Date.now(); if (t - (this.lastPoll || 0) >= POLL_MS) { this.lastPoll = t; this.refresh(); } }
  async leave() { try { await this.net.leave(); } catch (e) { if (this.net.forget) this.net.forget(); } }
}

root.SLNet = { Connection, LocalLink, Room, normalizeRoom, seated, gameSubdomain, LIMITS, STALE_MS, GM_KEY };
})(typeof window !== 'undefined' ? window : globalThis);

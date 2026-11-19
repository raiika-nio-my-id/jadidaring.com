/* Dapur Padang Panik: pure kitchen simulation (no DOM). Same code runs the host (authoritative), solo practice,
   and the online client's local prediction copy. Exported as window.DP. */
(function (root) {
'use strict';
/* ---------- kitchen map ----------
   # counter   . floor   D daging  I ikan  H cabai hijau  M santan  B bumbu  (crates)
   N magic com (nasi)   P piring   T talenan   U cobek   K kompor + kuali   L loket (serve)   X tempat sampah */
const MAP = [
  '#DIHMB#KKKK##',
  '#...........#',
  'T...........L',
  'T...#U#U#...L',
  '#...#####...#',
  '#...........P',
  '#...........P',
  '#...........X',
  '##NN##TT#####'
];
const W = MAP[0].length, H = MAP.length;
const SPAWNS = [[2.5, 4.5], [10.5, 5.5], [2.5, 6.5], [10.5, 1.5]];
const COLORS = ['#e4572e', '#2e86de', '#3aa857', '#f2b705'];
const CRATE = { D: 'daging', I: 'ikan', H: 'cabai', M: 'santan', B: 'bumbu' };
const WORK = { T: { daging: 'dagingP', ikan: 'ikanP' }, U: { cabai: 'sambal' } };
const POTABLE = { dagingP: 1, ikanP: 1, santan: 1, bumbu: 1 };
const PLATEABLE = { nasi: 1, sambal: 1, rendang: 1, gulai: 1 };
const MAINS = { rendang: 1, gulai: 1 };
const PLATE_ORDER = ['nasi', 'rendang', 'gulai', 'sambal'];
/* defaults; the page's JSON config (#website-config "game") may override numbers */
const CFG = {
  speed: 4.3, radius: 0.31, reach: 1.32,
  recipes: { gulai: { c: ['ikanP', 'santan'], cook: 9 }, rendang: { c: ['dagingP', 'santan', 'bumbu'], cook: 14 } },
  burnAfter: 11, warnAfter: 5, workTime: { T: 2.0, U: 2.4, K: 1.6 },
  menu: {
    gulai: { p: ['nasi', 'gulai'], pts: 20, life: 75 },
    sambal: { p: ['nasi', 'sambal'], pts: 14, life: 55 },
    rendang: { p: ['nasi', 'rendang'], pts: 30, life: 95 },
    komplit: { p: ['nasi', 'rendang', 'sambal'], pts: 42, life: 110 },
    gulaiS: { p: ['nasi', 'gulai', 'sambal'], pts: 34, life: 100 }
  },
  shifts: [
    { key: 'pagi', dur: 150, menu: ['gulai', 'sambal'], gap: 17, stars: [40, 100, 160] },
    { key: 'siang', dur: 180, menu: ['gulai', 'sambal', 'rendang'], gap: 16, stars: [60, 140, 220] },
    { key: 'malam', dur: 210, menu: ['gulai', 'sambal', 'rendang', 'komplit', 'gulaiS'], gap: 14, stars: [80, 180, 290] }
  ],
  expirePenalty: 8, burnPenalty: 10, tipFrac: 0.5, maxOrders: [3, 4, 4, 5]
};
function mulberry(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const isPlate = h => typeof h === 'string' && h.slice(0, 2) === 'P:';
const plateOf = h => (isPlate(h) && h.length > 2 ? h.slice(2).split('+') : []);
const mkPlate = a => 'P:' + a.slice().sort((x, y) => PLATE_ORDER.indexOf(x) - PLATE_ORDER.indexOf(y)).join('+');
/** add one component to a plate string; null if not allowed (dup, two mains, full) */
function addToPlate(h, x) {
  const a = plateOf(h); if (!PLATEABLE[x] || a.includes(x) || a.length >= 3) return null;
  if (MAINS[x] && a.some(y => MAINS[y])) return null; a.push(x); return mkPlate(a);
}
const sameSet = (a, b) => a.length === b.length && a.every(x => b.includes(x));
function recipeFor(c) { for (const k in CFG.recipes) if (sameSet(c, CFG.recipes[k].c)) return k; return null; }
function potOk(c) { return Object.values(CFG.recipes).some(r => c.every(x => r.c.includes(x)) && new Set(c).size === c.length); }
const SOLID = ch => ch !== '.';

class Sim {
  /** players [{id,name}], shift index (or 'tut'), seed */
  constructor({ players = [], shift = 0, seed = (Math.random() * 1e9) | 0, pred = false } = {}) {
    this.W = W; this.H = H; this.pred = pred;
    this.st = []; this.grid = new Array(W * H).fill(-1);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const c = MAP[y][x]; if (!SOLID(c)) continue; const i = this.st.length; this.grid[y * W + x] = i; this.st.push({ i, x, y, c, it: null, p: 0, pot: c === 'K' ? { c: [], s: 0, t: 0, r: null } : null }); }
    this.tut = shift === 'tut'; this.shift = this.tut ? 0 : Math.max(0, Math.min(CFG.shifts.length - 1, shift | 0));
    const sh = CFG.shifts[this.shift];
    this.dur = this.tut ? 0 : sh.dur * 1000; this.left = this.dur; this.t = 0; this.over = false;
    this.seed = seed | 0; this.rs = this.seed; this.rng = mulberry(this.rs);
    this.chefs = players.slice(0, 4).map((p, k) => ({ id: p.id, name: String(p.name || '').slice(0, 24), c: k, x: SPAWNS[k][0], y: SPAWNS[k][1], f: 0, h: null, w: -1, a: 0, sv: 0, vx: 0, vy: 0 }));
    this.orders = []; this.oid = 1; this.spawnIn = 1200;
    this.score = 0; this.served = 0; this.expired = 0; this.burned = 0; this.tips = 0; this.streak = 0; this.best = 0;
    this.ev = []; this.en = 0; this.hs = []; this.cm = [];
    if (this.tut) { this.addOrder('gulai'); this.tutQ = ['sambal']; }
  }
  get n() { return Math.max(1, this.chefs.length); }
  rand() { const v = this.rng(); this.rs = (this.rs + 0x6D2B79F5) | 0; return v; }
  chef(id) { return this.chefs.find(c => c.id === id) || null; }
  emit(k, i, pid, x) { this.en++; this.ev.push([this.en, k, i == null ? -1 : i, pid == null ? 0 : pid, x == null ? 0 : x]); if (this.ev.length > 16) this.ev.shift(); }
  solidAt(x, y) { if (x < 0 || y < 0 || x >= W || y >= H) return true; return this.grid[y * W + x] >= 0; }
  stAt(x, y) { if (x < 0 || y < 0 || x >= W || y >= H) return null; const i = this.grid[y * W + x]; return i >= 0 ? this.st[i] : null; }
  addOrder(m) {
    const def = CFG.menu[m]; if (!def) return;
    const life = Math.round(def.life * 1000 * (this.n === 1 ? 1.2 : 1));
    this.orders.push({ id: this.oid++, m, t: life, T: life }); this.emit('new', -1, 0, this.oid - 1);
  }
  gap() { const sh = CFG.shifts[this.shift]; return sh.gap * 1000 / (1 + 0.38 * (this.n - 1)); }
  maxOrders() { return CFG.maxOrders[Math.min(3, this.n - 1)]; }
  /* ---------- movement ---------- */
  move(ch, vx, vy, dt, others) {
    const sp = CFG.speed, r = CFG.radius, s = dt / 1000;
    const m = Math.hypot(vx, vy); if (m > 1) { vx /= m; vy /= m; }
    if (m * sp * s > 0.25) { const k = Math.ceil(m * sp * s / 0.25), x0 = ch.x, y0 = ch.y; for (let i = 0; i < k; i++) this.move(ch, vx, vy, dt / k, others); ch.vx = (ch.x - x0) / Math.max(s, 1e-3); ch.vy = (ch.y - y0) / Math.max(s, 1e-3); return; }
    if (m > 0.08) ch.f = Math.atan2(vy, vx);
    let x = ch.x + vx * sp * s, y = ch.y + vy * sp * s;
    for (let it = 0; it < 3; it++) {
      const cx = Math.floor(x), cy = Math.floor(y);
      for (let ty = cy - 1; ty <= cy + 1; ty++) for (let tx = cx - 1; tx <= cx + 1; tx++) {
        if (!this.solidAt(tx, ty)) continue;
        const px = Math.max(tx, Math.min(x, tx + 1)), py = Math.max(ty, Math.min(y, ty + 1)), dx = x - px, dy = y - py, d = Math.hypot(dx, dy);
        if (d < r) { if (d > 1e-6) { x += dx / d * (r - d); y += dy / d * (r - d); } else { const ex = x - (tx + 0.5), ey = y - (ty + 0.5); if (Math.abs(ex) > Math.abs(ey)) x = ex > 0 ? tx + 1 + r : tx - r; else y = ey > 0 ? ty + 1 + r : ty - r; } }
      }
      for (const o of others || []) { if (o === ch) continue; const dx = x - o.x, dy = y - o.y, d = Math.hypot(dx, dy), mn = r * 1.9; if (d < mn && d > 1e-6) { x += dx / d * (mn - d) * 0.6; y += dy / d * (mn - d) * 0.6; } }
    }
    x = Math.max(1 + r, Math.min(W - 1 - r, x)); y = Math.max(1 + r, Math.min(H - 1 - r, y));
    ch.vx = (x - ch.x) / Math.max(s, 1e-3); ch.vy = (y - ch.y) / Math.max(s, 1e-3); ch.x = x; ch.y = y;
  }
  /** remote / reported position (host trusts co-op clients, but keeps them on the floor) */
  place(ch, x, y, f) { if (!Number.isFinite(x) || !Number.isFinite(y)) return; ch.x = Math.max(1.1, Math.min(W - 1.1, x)); ch.y = Math.max(1.1, Math.min(H - 1.1, y)); if (Number.isFinite(f)) ch.f = f; }
  /** station the chef faces: nearest solid tile within reach, weighted toward the facing direction */
  target(ch) {
    const fx = Math.cos(ch.f), fy = Math.sin(ch.f), cx = Math.floor(ch.x), cy = Math.floor(ch.y); let best = null, bs = 1e9;
    for (let ty = cy - 1; ty <= cy + 1; ty++) for (let tx = cx - 1; tx <= cx + 1; tx++) {
      const s = this.stAt(tx, ty); if (!s) continue;
      const px = Math.max(tx, Math.min(ch.x, tx + 1)), py = Math.max(ty, Math.min(ch.y, ty + 1));
      const dx = tx + 0.5 - ch.x, dy = ty + 0.5 - ch.y, d = Math.hypot(dx, dy), edge = Math.hypot(ch.x - px, ch.y - py);
      if (edge > 0.62 || d > CFG.reach + 0.2) continue; const dot = (dx * fx + dy * fy) / (d || 1); if (dot < -0.15) continue;
      const sc = d - dot * 0.95; if (sc < bs) { bs = sc; best = s; }
    }
    return best;
  }
  inReach(ch, s) { const px = Math.max(s.x, Math.min(ch.x, s.x + 1)), py = Math.max(s.y, Math.min(ch.y, s.y + 1)); return Math.hypot(ch.x - px, ch.y - py) < 0.75; }
  /* ---------- actions ---------- */
  /** op 'g' (grab / put / combine) or 'w' (process); returns a result code for hints + SFX */
  apply(pid, op, si) {
    const ch = this.chef(pid), s = this.st[si]; if (!ch || !s || this.over) return 'nop';
    if (!this.inReach(ch, s)) return 'far';
    return op === 'w' ? this.work(ch, s) : this.grab(ch, s);
  }
  grab(ch, s) {
    const h = ch.h, c = s.c;
    if (CRATE[c]) { const src = CRATE[c]; if (!h) { ch.h = src; return 'pick'; } if (h === src) { ch.h = null; return 'back'; } return 'full'; }
    if (c === 'N') { if (!h) { ch.h = 'nasi'; return 'pick'; } if (h === 'nasi') { ch.h = null; return 'back'; } if (isPlate(h)) { const p = addToPlate(h, 'nasi'); if (!p) return 'plateNo'; ch.h = p; return 'plate'; } return 'full'; }
    if (c === 'P') { if (!h) { ch.h = 'P:'; return 'pick'; } if (h === 'P:') { ch.h = null; return 'back'; } if (PLATEABLE[h]) { ch.h = mkPlate([h]); this.emit('dish', s.i, ch.id, 0); return 'plate'; } return 'full'; } // holding lauk/nasi: grab a plate and put it on, in one press
    if (c === 'K') {
      const pot = s.pot;
      if (!h) return pot.s === 3 ? 'burnt' : pot.s === 2 ? 'needPlate' : pot.s === 1 ? 'cooking' : 'nop';
      if (isPlate(h)) {
        if (pot.s === 2) { const p = addToPlate(h, pot.r); if (!p) return 'plateNo'; ch.h = p; this.emit('dish', s.i, ch.id, 0); pot.c = []; pot.s = 0; pot.t = 0; pot.r = null; return 'plate'; }
        return pot.s === 1 ? 'notYet' : pot.s === 3 ? 'burnt' : 'nop';
      }
      if (POTABLE[h]) {
        if (pot.s === 3) return 'burnt'; if (pot.s !== 0) return 'potBusy';
        const nc = pot.c.concat([h]); if (!potOk(nc)) return 'noMatch';
        pot.c = nc; ch.h = null; const r = recipeFor(nc); this.emit('pot', s.i, ch.id, 0);
        if (r) { pot.s = 1; pot.r = r; pot.t = 0; return 'cook'; } return 'potAdd';
      }
      if (h === 'daging' || h === 'ikan') return 'raw'; if (h === 'cabai') return 'rawC'; return 'noPot';
    }
    if (c === 'L') {
      if (!h) return 'nop'; if (!isPlate(h)) return 'needPlate'; if (h === 'P:') return 'empty';
      this.lastServe = s.i; return this.serve(ch, plateOf(h));
    }
    if (c === 'X') { if (!h) return 'nop'; ch.h = isPlate(h) ? (h === 'P:' ? null : 'P:') : null; this.emit('trash', s.i, ch.id, 0); return 'trash'; }
    // plain counter, talenan, cobek
    const it = s.it;
    if (!h && it) { ch.h = it; s.it = null; s.p = 0; return 'pick'; }
    if (h && !it) { s.it = h; ch.h = null; s.p = 0; ch.w = -1; return 'drop'; }
    if (h && it) {
      if (isPlate(h) && PLATEABLE[it]) { const p = addToPlate(h, it); if (!p) return 'plateNo'; ch.h = p; s.it = null; s.p = 0; return 'plate'; }
      if (isPlate(it) && PLATEABLE[h]) { const p = addToPlate(it, h); if (!p) return 'plateNo'; ch.h = p; s.it = null; s.p = 0; return 'plate'; } // lauk onto the plate and the plate comes to your hand
      return 'full';
    }
    return 'nop';
  }
  work(ch, s) {
    if (WORK[s.c]) {
      const it = s.it; if (!it) return 'nothing';
      if (WORK[s.c][it]) { ch.w = s.i; return 'work'; }
      const other = s.c === 'T' ? 'U' : 'T'; if (WORK[other][it]) return s.c === 'T' ? 'useCobek' : 'useTalenan';
      return 'noWork';
    }
    if (s.c === 'K' && s.pot.s === 3) { ch.w = s.i; return 'clean'; }
    if (s.c === 'K') return s.pot.s === 1 ? 'cooking' : 'nop';
    if (CRATE[s.c] === 'daging' || CRATE[s.c] === 'ikan' || CRATE[s.c] === 'cabai') return 'workHint';
    return 'nop';
  }
  serve(ch, set) {
    let best = null;
    for (const o of this.orders) { const def = CFG.menu[o.m]; if (def && sameSet(def.p, set) && (!best || o.t < best.t)) best = o; }
    if (!best) return 'wrong';
    const def = CFG.menu[best.m], first = this.orders[0] === best;
    this.streak = first ? this.streak + 1 : 1; this.best = Math.max(this.best, this.streak);
    const mult = Math.min(3, 1 + 0.5 * (this.streak - 1));
    const tip = Math.round(def.pts * CFG.tipFrac * Math.max(0, best.t) / best.T * mult);
    this.score += def.pts + tip; this.tips += tip; this.served++; ch.sv++; ch.h = null;
    this.orders.splice(this.orders.indexOf(best), 1);
    this.emit('serve', this.lastServe == null ? -1 : this.lastServe, ch.id, def.pts + tip);
    if (this.tut && !this.orders.length) { if (this.tutQ.length) { this.addOrder(this.tutQ.shift()); } else { this.over = true; this.emit('end', -1, 0, 0); } }
    return 'serve';
  }
  /* ---------- time ---------- */
  step(dt) {
    if (this.over) return; this.t += dt;
    if (!this.tut) { this.left -= dt; if (this.left <= 0 && !this.pred) { this.left = 0; this.over = true; this.emit('end', -1, 0, 0); return; } }
    if (!this.tut) for (const o of this.orders.slice()) {
      o.t -= dt;
      if (o.t <= 0 && !this.pred) { this.orders.splice(this.orders.indexOf(o), 1); this.expired++; this.streak = 0; this.score = Math.max(0, this.score - CFG.expirePenalty); this.emit('exp', -1, 0, o.id); }
    }
    if (!this.tut && !this.pred) {
      this.spawnIn -= dt; if (!this.orders.length) this.spawnIn = Math.min(this.spawnIn, 1500);
      if (this.spawnIn <= 0) {
        if (this.orders.length < this.maxOrders()) { const m = CFG.shifts[this.shift].menu; this.addOrder(m[Math.floor(this.rand() * m.length)]); }
        this.spawnIn = this.gap() * (0.8 + this.rand() * 0.4);
      }
    }
    for (const s of this.st) {
      const pot = s.pot; if (!pot) continue;
      if (pot.s === 1) { pot.t += dt; if (pot.t >= CFG.recipes[pot.r].cook * 1000) { pot.s = 2; pot.t = 0; this.emit('done', s.i, 0, 0); } }
      else if (pot.s === 2 && !this.tut) { pot.t += dt; if (pot.t >= CFG.burnAfter * 1000 && !this.pred) { pot.s = 3; pot.t = 0; this.burned++; this.score = Math.max(0, this.score - CFG.burnPenalty); this.emit('burn', s.i, 0, 0); } }
    }
    for (const ch of this.chefs) {
      if (ch.w < 0) continue; const s = this.st[ch.w];
      if (!s || !this.inReach(ch, s)) { ch.w = -1; continue; }
      let ok = false, tm = CFG.workTime[s.c] || 2;
      if (WORK[s.c] && s.it && WORK[s.c][s.it]) ok = true; else if (s.c === 'K' && s.pot.s === 3) ok = true;
      if (!ok) { ch.w = -1; continue; }
      s.p += dt / (tm * 1000);
      if (s.p >= 1) {
        s.p = 0; this.chefs.forEach(o => { if (o.w === s.i) o.w = -1; });
        if (s.c === 'K') { s.pot.c = []; s.pot.s = 0; s.pot.t = 0; s.pot.r = null; this.emit('clean', s.i, ch.id, 0); }
        else { s.it = WORK[s.c][s.it]; this.emit('chop', s.i, ch.id, 0); }
      }
    }
  }
  stars() { const sh = CFG.shifts[this.shift], f = 1 + 0.45 * (this.n - 1); return sh.stars.filter(v => this.score >= Math.round(v * f)).length; }
  starNeed() { const sh = CFG.shifts[this.shift], f = 1 + 0.45 * (this.n - 1); return sh.stars.map(v => Math.round(v * f)); }
  result() { return { sc: this.score, sv: this.served, ex: this.expired, bn: this.burned, tp: this.tips, bs: this.best, st: this.stars(), need: this.starNeed(), sh: this.shift, ch: this.chefs.map(c => ({ i: c.id, n: c.name, c: c.c, sv: c.sv })) }; }
  /* ---------- wire ---------- */
  snap() {
    const k = {};
    for (const s of this.st) { if (s.it || s.p > 0 || (s.pot && (s.pot.c.length || s.pot.s))) { const o = {}; if (s.it) o.i = s.it; if (s.p > 0) o.p = Math.round(s.p * 1000) / 1000; if (s.pot && (s.pot.c.length || s.pot.s)) { o.c = s.pot.c.slice(); o.s = s.pot.s; o.t = Math.round(s.pot.t); if (s.pot.r) o.r = s.pot.r; } k['s' + s.i] = o; } }
    return {
      t: Math.round(this.t), sh: this.tut ? 'tut' : this.shift, l: Math.round(this.left), d: this.dur, ov: this.over ? 1 : 0, sd: this.seed, rs: this.rs,
      sc: this.score, sv: this.served, ex: this.expired, bn: this.burned, tp: this.tips, sk: this.streak, bs: this.best, sp: Math.round(this.spawnIn), oi: this.oid,
      o: this.orders.map(o => [o.id, o.m, Math.round(o.t), o.T]),
      k, c: this.chefs.map(c => ({ i: c.id, n: c.name, c: c.c, x: Math.round(c.x * 100) / 100, y: Math.round(c.y * 100) / 100, f: Math.round(c.f * 100) / 100, h: c.h, w: c.w, a: c.a, sv: c.sv })),
      ev: this.ev.slice(), en: this.en, hs: this.hs.slice(-8), tq: this.tut ? this.tutQ.slice() : undefined
    };
  }
  static fromSnap(sn, pred) {
    sn = sn || {}; const s = new Sim({ players: [], shift: sn.sh === 'tut' ? 'tut' : sn.sh | 0, seed: sn.sd | 0, pred: !!pred });
    s.orders = []; s.t = +sn.t || 0; s.left = +sn.l || 0; s.dur = +sn.d || 0; s.over = !!sn.ov; s.rs = sn.rs | 0; s.rng = mulberry(s.rs);
    s.score = sn.sc | 0; s.served = sn.sv | 0; s.expired = sn.ex | 0; s.burned = sn.bn | 0; s.tips = sn.tp | 0; s.streak = sn.sk | 0; s.best = sn.bs | 0; s.spawnIn = +sn.sp || 0; s.oid = sn.oi | 0 || 1;
    for (const o of (Array.isArray(sn.o) ? sn.o : [])) if (Array.isArray(o) && CFG.menu[o[1]]) s.orders.push({ id: o[0], m: o[1], t: +o[2], T: +o[3] || 1 });
    const k = sn.k && typeof sn.k === 'object' ? sn.k : {};
    for (const st of s.st) { const o = k['s' + st.i]; if (!o) continue; st.it = typeof o.i === 'string' ? o.i : null; st.p = +o.p || 0; if (st.pot && (o.c || o.s)) { st.pot.c = Array.isArray(o.c) ? o.c.slice() : []; st.pot.s = o.s | 0; st.pot.t = +o.t || 0; st.pot.r = o.r || recipeFor(st.pot.c); } }
    s.chefs = (Array.isArray(sn.c) ? sn.c : []).map(c => ({ id: c.i, name: String(c.n || ''), c: c.c | 0, x: +c.x || 2, y: +c.y || 2, f: +c.f || 0, h: typeof c.h === 'string' ? c.h : null, w: Number.isFinite(+c.w) ? +c.w : -1, a: c.a | 0, sv: c.sv | 0, vx: 0, vy: 0 }));
    s.ev = Array.isArray(sn.ev) ? sn.ev.slice() : []; s.en = sn.en | 0; s.hs = Array.isArray(sn.hs) ? sn.hs.slice() : [];
    if (s.tut) s.tutQ = Array.isArray(sn.tq) ? sn.tq.slice() : [];
    return s;
  }
}
/* context hint for the action buttons (teach by playing) */
function hint(sim, ch) {
  const s = ch ? sim.target(ch) : null; if (!s) return { s: null, g: '', w: '' };
  const h = ch.h, c = s.c; let g = '', w = '';
  if (CRATE[c]) g = !h ? 'take:' + CRATE[c] : h === CRATE[c] ? 'putBack' : '';
  else if (c === 'N') g = !h ? 'take:nasi' : isPlate(h) && addToPlate(h, 'nasi') ? 'addNasi' : h === 'nasi' ? 'putBack' : '';
  else if (c === 'P') g = !h ? 'take:plate' : h === 'P:' ? 'putBack' : PLATEABLE[h] ? 'toPlate' : '';
  else if (c === 'K') { const p = s.pot; if (h && POTABLE[h] && p.s === 0 && potOk(p.c.concat([h]))) g = 'toPot'; else if (isPlate(h) && p.s === 2) g = 'scoop'; if (p.s === 3) w = 'clean'; }
  else if (c === 'L') g = isPlate(h) && h !== 'P:' ? 'serve' : '';
  else if (c === 'X') g = h ? 'trash' : '';
  else { if (!h && s.it) g = 'pick'; else if (h && !s.it) g = 'drop'; else if (h && s.it && ((isPlate(h) && addToPlate(h, s.it)) || (isPlate(s.it) && addToPlate(s.it, h)))) g = 'plate'; if (WORK[c] && s.it && WORK[c][s.it]) w = c === 'T' ? 'chop' : 'grind'; }
  return { s, g, w };
}
root.DP = { Sim, MAP, W, H, CFG, COLORS, CRATE, WORK, POTABLE, PLATEABLE, isPlate, plateOf, mkPlate, addToPlate, recipeFor, potOk, hint, mulberry };
})(typeof window !== 'undefined' ? window : globalThis);

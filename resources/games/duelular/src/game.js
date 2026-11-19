/* Duel Ular: pure, deterministic cozy snake simulation (host-authoritative). No DOM. Exposes root.UN.
   Grid 30x30. Each snake advances exactly 1 cell per tick of its own clock (CFG.base ms, shorter with sprint / speed-up);
   moves inside one sim frame are resolved simultaneously so head-on collisions are symmetric.
   Wall grace (Zenless Zone Zero style): a snake about to enter a wall / edge / active obstacle freezes in place for
   CFG.grace ms; a turn to an open direction inside that window saves it, otherwise it is out.
   Own body and another snake's body get the same grace (freeze, turn to survive, else out with why self / body).
   Head-on (two heads entering the same cell, or swapping cells) = both out at once: nobody can turn out of it fairly.
   No match timer by default (dur 0 = unlimited): a round ends when one snake is left (or every human is out in practice).
   Move clock is a 0..1 progress per snake (acc += dt / interval), so changing speed (sprint on/off) never triggers an
   extra step or a visual jump: spamming sprint can never go faster than the sprint interval. */
(function (root) {
'use strict';
const W = 30, H = 30;
const DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]]; // 0 up, 1 right, 2 down, 3 left
const COLORS = ['#5f9e57', '#e07a5f', '#4f8fb0', '#d9a03a', '#9b6fb0', '#d16b8f', '#3f9c94', '#8a6b4f']; // moss, terracotta, sky, honey, plum, rose, teal, cocoa
const CFG = {
  base: 150, fast: 115, slow: 210,           // N = ms per cell (one tick = one cell); speed-up power-up / slowed
  sprintMul: 0.65, minIv: 70,                // sprint (hold): interval x0.65 (150 -> 98 ms), never below 70 ms
  stamina: 2500, staminaRegen: 0.5, tiredUntil: 800, regenDelay: 400, // regen starts 400 ms after release (no free refills by tapping); sprint fuel (ms of sprint), refills at 0.5x real time; when empty it only works again from 800
  grace: 350, graceNet: 250,                 // M = wall grace (ms frozen before out); online clients' snakes get +250 ms for the turn's uplink
  startLen: 5,
  small: 1, big: 3,                          // growth per food
  pw: { s: 7000, l: 6000, m: 8000 },         // speed up (self), turtle slow (self), magnet (self)
  bigEvery: [5000, 9000],                    // food and power-ups never despawn: they stay until eaten (caps: 2 big, 2 pw)
  pwEvery: [9000, 14000],
  obEvery: [6000, 10000], obWarn: 1600, obLife: [10000, 16000], obMax: 5,
  magnetR: 2, countdown: 3000, maxPlayers: 8,
  ahead: 10,                                 // online: a turn the sender saw up to 10 moves ahead of the host waits for that move
  rewind: 6                                  // online lag compensation: a late turn may be applied up to 6 moves back
};
const SHAPES = [[[0, 0]], [[0, 0], [1, 0]], [[0, 0], [0, 1]], [[0, 0], [1, 0], [0, 1], [1, 1]], [[0, 0], [1, 0], [2, 0]], [[0, 0], [0, 1], [0, 2]], [[0, 0], [1, 0], [1, 1]]];
// 8 start spots: top row heading down (cols 4/11/18/25), bottom row heading up (cols 22/8/15/28): no shared column, so
// nobody starts on a head-on course (the old spots paired up in the same columns -> head-on after ~1 s without steering)
const SPOTS = [[4, 7, 2], [22, 22, 0], [18, 7, 2], [8, 22, 0], [11, 7, 2], [15, 22, 0], [25, 7, 2], [28, 22, 0]];
const SOLO_SPOT = [15, 20, 0];
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const cx = c => c % W, cy = c => (c / W) | 0, cell = (x, y) => y * W + x, inside = (x, y) => x >= 0 && y >= 0 && x < W && y < H;
const enc = list => list.map(c => (c | 0).toString(36).padStart(2, '0')).join('');
const dec = s => { const o = []; s = String(s || ''); for (let i = 0; i + 1 < s.length; i += 2) { const v = parseInt(s.substr(i, 2), 36); if (v >= 0 && v < W * H) o.push(v); } return o; };
const dist = (a, b) => Math.abs(cx(a) - cx(b)) + Math.abs(cy(a) - cy(b));
const cheb = (a, b) => Math.max(Math.abs(cx(a) - cx(b)), Math.abs(cy(a) - cy(b)));
/** ms per cell from the effect flags (shared by the sim and the client's dead reckoning) */
const ivOf = (fast, slow, sprint) => { const v = fast && !slow ? CFG.fast : slow && !fast ? CFG.slow : CFG.base; return sprint ? Math.max(CFG.minIv, Math.round(v * CFG.sprintMul)) : v; };

class Sim {
  /** o = { players: [{id, name, bot?}], dur (ms), seed } */
  constructor(o = {}) {
    this.r = rng(o.seed || (Date.now() ^ 0x5eed)); this.dur = o.dur > 0 ? o.dur : 0; this.t = -CFG.countdown; this.over = false;
    this.food = []; this.pw = []; this.ob = []; this.ev = []; this.evn = 0; this.tickN = 0;
    const ps = (o.players || []).slice(0, CFG.maxPlayers), solo = ps.length === 1;
    this.snakes = ps.map((p, i) => {
      const [x, y, d] = solo ? SOLO_SPOT : SPOTS[i], back = DIRS[(d + 2) % 4], b = [];
      for (let k = 0; k < CFG.startLen; k++) b.push(cell(x + back[0] * k, y + back[1] * k));
      return { id: p.id, name: String(p.name || '?').slice(0, 24), c: p.c ?? i, bot: !!p.bot, b, d, q: [], g: 0, al: true, acc: 0, fx: { s: 0, l: 0, m: 0 }, eat: 0, best: b.length, die: 0, why: '', mv: 0, tr: [], ack: 0, n: 0, hs: [], sp: false, st: CFG.stamina, tired: false, gr: 0, grWhy: '', rm: !!p.rm, lg: false, spOff: -1e9 };
    });
    this.n0 = this.snakes.length;
    this.nextBig = this.span(CFG.bigEvery); this.nextPw = this.span(CFG.pwEvery); this.nextOb = this.span(CFG.obEvery);
    for (let i = 0; i < this.foodTarget(); i++) this.addFood(0);
  }
  span([a, b]) { return a + Math.floor(this.r() * (b - a)); }
  foodTarget() { return 3 + Math.max(1, this.snakes.filter(s => s.al).length); }
  snake(id) { return this.snakes.find(s => s.id === id); }
  alive() { return this.snakes.filter(s => s.al); }
  emit(k, c, id) { this.evn++; this.ev.push([this.evn, k, c | 0, id ?? 0]); if (this.ev.length > 16) this.ev.shift(); }
  /** queue a turn (max 3 pending, no reversal, no duplicate) */
  turn(id, d) {
    const s = this.snake(id); if (!s || !s.al || !(d >= 0 && d < 4)) return false;
    const last = s.q.length ? s.q[s.q.length - 1] : s.d; if (d === last || d === (last + 2) % 4 || s.q.length >= 3) return false;
    s.q.push(d); return true;
  }
  /** online lag compensation: the client saw its head `at` moves in and asked to turn there. If the snake has since moved
      r = n - at cells (1..CFG.rewind) without eating, getting hit or grabbing an item, re-route those r moves along the new
      direction when that path is clear (walls, active obstacles, snakes, items). Otherwise it is a normal queued turn. */
  turnAt(id, d, at) {
    const s = this.snake(id); if (!s || !s.al || !(d >= 0 && d < 4)) return false;
    const r = s.n - (at | 0);
    if (s.gr) return this.turn(id, d);
    /* the sender saw its head BEHIND where the host is about to be (r <= 0: its view runs ahead of the host): schedule the
       turn for move `at` instead of turning now, else the corner lands cells behind what the player saw (t294u blink). */
    if (r <= 0 && -r <= CFG.ahead) { (s.sq || (s.sq = [])).push({ at: at | 0, d }); s.sq.sort((x, y) => x.at - y.at); return true; }
    if (!(r >= 1 && r <= CFG.rewind && r <= s.hs.length) || s.q.length || (s.sq && s.sq.length)) return this.turn(id, d);
    const hist = s.hs.slice(-r), pd = hist[0].p;
    if (hist.some(e => e.x) || d === pd || d === (pd + 2) % 4) return this.turn(id, d);
    const b = s.b.slice(r); let g = s.g;
    for (let i = hist.length - 1; i >= 0; i--) { if (hist[i].tl >= 0) b.push(hist[i].tl); else g++; }
    const t = this.t, bad = new Set();
    for (const o of this.ob) if (o.a <= t) for (const c of o.c) bad.add(c);
    for (const o of this.snakes) if (o.al && o !== s) for (const c of o.b) bad.add(c);
    for (const f of this.food) bad.add(f.p); for (const p of this.pw) bad.add(p.p);
    const nh = [];
    for (let i = 0; i < r; i++) {
      const h = b[0], x = cx(h) + DIRS[d][0], y = cy(h) + DIRS[d][1], c = cell(x, y);
      if (!inside(x, y) || bad.has(c)) return this.turn(id, d);
      const own = b.indexOf(c); if (own >= 0 && !(own === b.length - 1 && g === 0)) return this.turn(id, d);
      b.unshift(c); let tl = -1; if (g > 0) g--; else tl = b.pop();
      nh.push({ p: i ? d : pd, d, tl, x: 0 });
    }
    s.b = b; s.g = g; s.d = d; s.q = []; s.hs.splice(s.hs.length - r, r, ...nh); s.tr = []; s.lt = null; s.mv = 0; s.rw = (s.rw || 0) + 1; return true;
  }
  blocked() { // every taken cell (snakes, items, obstacles incl. warnings)
    const m = new Set(); for (const s of this.snakes) if (s.al) for (const c of s.b) m.add(c);
    for (const f of this.food) m.add(f.p); for (const p of this.pw) m.add(p.p); for (const o of this.ob) for (const c of o.c) m.add(c); return m;
  }
  emptyCell(extra) {
    const m = this.blocked(), heads = this.alive().map(s => s.b[0]);
    for (let k = 0; k < 300; k++) { const c = Math.floor(this.r() * W * H); if (m.has(c)) continue; if (extra && !extra(c, heads, m)) continue; return c; }
    return -1;
  }
  addFood(k, at) { const c = at ?? this.emptyCell(); if (c < 0) return; this.food.push({ p: c, k, e: 0 }); }
  addPw() { const c = this.emptyCell((c, heads) => heads.every(h => dist(h, c) >= 3)); if (c < 0) return; const k = 'slm'[Math.floor(this.r() * 3)]; this.pw.push({ p: c, k, e: 0 }); }
  addOb() {
    if (this.ob.length >= CFG.obMax) return;
    for (let k = 0; k < 40; k++) {
      const sh = SHAPES[Math.floor(this.r() * SHAPES.length)], x = 1 + Math.floor(this.r() * (W - 4)), y = 1 + Math.floor(this.r() * (H - 4));
      const cells = sh.map(([dx, dy]) => cell(x + dx, y + dy)), m = this.blocked(), heads = this.alive().map(s => s.b[0]);
      if (cells.some(c => m.has(c) || heads.some(h => dist(h, c) < 5))) continue;
      this.ob.push({ c: cells, a: this.t + CFG.obWarn, e: this.t + CFG.obWarn + this.span(CFG.obLife) }); this.emit('ob', cells[0]); return;
    }
  }
  /** sprint intent (hold): host applies it; stamina keeps it a short burst */
  sprint(id, on) { const s = this.snake(id); if (!s || !s.al) return false; on = !!on; if (s.sp && !on) s.spOff = this.t; s.sp = on; return true; }
  sprinting(s) { return s.sp && !s.tired && s.st > 0; }
  interval(s) { return ivOf(s.fx.s > this.t, s.fx.l > this.t, this.sprinting(s)); }
  graceMs(s) { return CFG.grace + (s.rm ? CFG.graceNet : 0); }
  /** what is in the cell ahead: 'wall' (edge), 'obs' (active obstacle) or '' */
  ahead(s, obs, oth) {
    const h = s.b[0], x = cx(h) + DIRS[s.d][0], y = cy(h) + DIRS[s.d][1]; if (!inside(x, y)) return 'wall'; const c = cell(x, y);
    if (obs.has(c)) return 'obs';
    if (oth && oth.has(c)) return 'body'; // only while frozen: another snake's body still in the way
    const k = s.b.indexOf(c); if (k >= 0 && !(k === s.b.length - 1 && s.g === 0 && s.b.length > 1)) return 'self'; // own body: same grace as a wall (the tail that leaves this move is free)
    return '';
  }
  /** cells of every other live snake (used while frozen in grace: is the way still blocked?) */
  otherCells(s) { const m = new Set(); for (const o of this.snakes) if (o.al && o !== s) for (const c of o.b) m.add(c); return m; }
  activeObs() { const o = new Set(), t = this.t; for (const b of this.ob) if (b.a <= t) for (const c of b.c) o.add(c); return o; }
  stam(s, dt) {
    if (this.sprinting(s) && !s.gr) { s.st = Math.max(0, s.st - dt); if (!s.st) s.tired = true; }
    else if (s.tired || (!s.sp && this.t - s.spOff >= CFG.regenDelay)) { s.st = Math.min(CFG.stamina, s.st + dt * CFG.staminaRegen); if (s.tired && s.st >= CFG.tiredUntil) s.tired = false; }
  }
  step(dt) {
    if (this.over) return; this.t += dt; if (this.t < 0) return;
    const t = this.t; this.tickN++;
    // spawns / expiries
    if (t >= this.nextBig) { this.nextBig = t + this.span(CFG.bigEvery); if (this.food.filter(f => f.k).length < 2) { this.addFood(1); this.emit('big', this.food[this.food.length - 1]?.p); } }
    if (t >= this.nextPw) { this.nextPw = t + this.span(CFG.pwEvery); if (this.pw.length < 2) this.addPw(); }
    if (t >= this.nextOb) { this.nextOb = t + this.span(CFG.obEvery); this.addOb(); }
    this.ob = this.ob.filter(o => { if (o.e > t) return true; this.emit('obx', o.c[0]); return false; });
    while (this.food.filter(f => !f.k).length < this.foodTarget()) { const n = this.food.length; this.addFood(0); if (this.food.length === n) break; }
    const M = []; let obs = null;
    for (const s of this.snakes) {
      if (!s.al) continue; this.stam(s, dt);
      while (s.sq && s.sq.length && (s.gr || s.n >= s.sq[0].at)) this.turn(s.id, s.sq.shift().d); // scheduled online turns (turnAt ahead)
      if (s.gr) { // frozen at a wall / body: a turn to an open cell moves at once, else out when the window closes
        obs = obs || this.activeObs(); if (s.bot) this.think(s);
        const pd = s.d; while (s.q.length) { const nd = s.q.shift(); if (nd !== s.d && nd !== (s.d + 2) % 4) { s.d = nd; break; } }
        if (!this.ahead(s, obs, this.otherCells(s))) { s.pd = pd; s.gr = 0; s.gx = true; s.acc = 0; M.push(s); this.emit('grok', s.b[0], s.id); }
        else if (t >= s.gr) this.kill(s, s.grWhy || 'wall');
        continue;
      }
      s.acc += dt / this.interval(s); if (s.acc >= 1 - 1e-9) { s.acc = Math.max(0, Math.min(s.acc - 1, 0.999)); M.push(s); } // progress 0..1: a speed change only changes the rate
    }
    if (M.length) this.moveRound(M);
    for (const s of this.snakes) if (s.al && s.fx.m > t) this.magnet(s);
    const alive = this.alive().length;
    const hum = this.snakes.filter(s => !s.bot), humOut = hum.length > 0 && hum.length < this.n0 && !hum.some(s => s.al);
    if ((this.n0 >= 2 && alive <= 1) || (this.n0 < 2 && alive === 0) || humOut || (this.dur > 0 && t >= this.dur)) { this.over = true; this.emit('end', 0); }
  }
  moveRound(M) {
    const t = this.t, occ = new Map(), obs = this.activeObs();
    for (const s of M) {
      if (s.gx) { s.gx = false; } // released from grace: direction already chosen
      else {
        if (s.bot) this.think(s);
        s.pd = s.d; while (s.q.length) { const nd = s.q.shift(); if (nd !== s.d && nd !== (s.d + 2) % 4) { s.d = nd; break; } }
      }
      s.hit = false; const why = this.ahead(s, obs);
      if (why) { s.gr = t + this.graceMs(s); s.grWhy = why; s.acc = 0; s.nh = -1; this.emit('gr', s.b[0], s.id); continue; } // freeze, no death yet
      const h = s.b[0]; s.nh = cell(cx(h) + DIRS[s.d][0], cy(h) + DIRS[s.d][1]);
    }
    const live = M.filter(s => s.al && s.nh >= 0), moving = new Set(live);
    // occupied cells after this round's tails move away (a moving, non-growing snake frees its tail cell)
    for (const s of this.snakes) { if (!s.al) continue; for (let k = 0; k < s.b.length; k++) { if (k === s.b.length - 1 && moving.has(s) && s.g === 0 && s.b.length > 1) continue; if (!occ.has(s.b[k])) occ.set(s.b[k], s); } }
    for (let i = 0; i < live.length; i++) for (let j = i + 1; j < live.length; j++) {
      const a = live[i], b = live[j];
      if (a.nh === b.nh || (a.nh === b.b[0] && b.nh === a.b[0])) { a.hit = b.hit = 'head'; }
    }
    for (const s of live) { if (s.hit) continue; const o = occ.get(s.nh); if (o) s.hit = o === s ? 'self' : 'body'; }
    for (const s of live) {
      if (s.hit === 'head') this.kill(s, 'head');
      else if (s.hit) { s.gr = t + this.graceMs(s); s.grWhy = s.hit; s.acc = 0; s.nh = -1; this.emit('gr', s.b[0], s.id); } // body (other / own tail cell): freeze like a wall
      else this.moveSnake(s);
    }
  }
  moveSnake(s) {
    const t = this.t, nh = s.nh; s.b.unshift(nh); s.mv++; s.n++; let tl = -1;
    s.lg = s.g > 0; // grew on this move: the tail stays where it is
    if (s.g > 0) s.g--; else { tl = s.b.pop(); s.lt = tl; s.tr.unshift(tl); if (s.tr.length > 16) s.tr.length = 16; }
    const hx = this.food.some(f => f.p === nh) || this.pw.some(p => p.p === nh) || s.fx.m > t ? 1 : 0;
    s.hs.push({ p: s.pd ?? s.d, d: s.d, tl, x: hx }); if (s.hs.length > CFG.rewind) s.hs.shift();
    const fi = this.food.findIndex(f => f.p === nh);
    if (fi >= 0) this.eatFood(s, fi, '');
    const pi = this.pw.findIndex(p => p.p === nh);
    if (pi >= 0) {
      const p = this.pw[pi]; this.pw.splice(pi, 1);
      s.fx[p.k] = t + CFG.pw[p.k]; // all three are self buffs (turtle slows only the snake that took it)
      this.emit('pw' + p.k, nh, s.id);
    }
    if (s.fx.m > t) this.magnet(s);
    s.best = Math.max(s.best, s.b.length + s.g);
  }
  eatFood(s, fi, how) { const f = this.food[fi]; this.food.splice(fi, 1); const n = f.k ? CFG.big : CFG.small; s.g += n; s.eat += n; s.best = Math.max(s.best, s.b.length + s.g); this.emit((f.k ? 'eatB' : 'eat') + how, f.p, s.id); }
  /** magnet active: any food within CFG.magnetR cells of the head (Chebyshev, so diagonals count) is pulled in and eaten at once */
  magnet(s) {
    const h = s.b[0]; if (h == null) return;
    for (let i = this.food.length - 1; i >= 0; i--) if (cheb(h, this.food[i].p) <= CFG.magnetR) this.eatFood(s, i, 'M');
  }
  kill(s, why) {
    if (!s.al) return; s.al = false; s.die = this.t; s.why = why; s.q = []; s.gr = 0; s.sp = false; this.emit('die', s.b[0], s.id);
    const obs = new Set(); for (const o of this.ob) for (const c of o.c) obs.add(c);
    for (let k = 1; k < s.b.length && this.food.length < 50; k += 2) if (!obs.has(s.b[k]) && !this.food.some(f => f.p === s.b[k])) this.addFood(0, s.b[k]);
    s.last = s.b.slice(0, 40); s.b = []; s.tr = []; s.hs = [];
  }
  /** rank: alive first (longest first), then the dead (later death first, then longer) */
  ranking() {
    return this.snakes.slice().sort((a, b) => (b.al - a.al) || (a.al ? (b.b.length - a.b.length) || (b.eat - a.eat) : (b.die - a.die) || (b.best - a.best)))
      .map((s, i) => ({ i: s.id, n: s.name, c: s.c, r: i + 1, a: s.al ? 1 : 0, l: s.al ? s.b.length : 0, w: s.best, e: s.eat, y: s.why || '' }));
  }
  /* --- simple bot: avoid death, prefer open space, go for food --- */
  think(s) {
    const t = this.t, h = s.b[0], m = new Set(), danger = new Set();
    for (const o of this.snakes) if (o.al) o.b.forEach((c, k) => { if (!(o === s && k === o.b.length - 1)) m.add(c); });
    for (const o of this.ob) if (o.a <= t + 900) for (const c of o.c) danger.add(c);
    for (const o of this.snakes) if (o.al && o !== s) for (const d of DIRS) { const x = cx(o.b[0]) + d[0], y = cy(o.b[0]) + d[1]; if (inside(x, y)) m.add(cell(x, y)); }
    const targets = this.food.map(f => ({ p: f.p, w: f.k ? 3 : 1 })).concat(this.pw.filter(p => p.k !== 'l').map(p => ({ p: p.p, w: 1.5 }))); // bots skip the turtle (it slows the taker)
    let best = s.d, bestV = -Infinity;
    for (let d = 0; d < 4; d++) {
      if (d === (s.d + 2) % 4) continue; const x = cx(h) + DIRS[d][0], y = cy(h) + DIRS[d][1];
      if (!inside(x, y)) continue; const c = cell(x, y); if (danger.has(c)) continue;
      let v = 0; if (m.has(c)) v -= 500;
      v += Math.min(this.space(c, m, danger), 40) * 3;
      let near = 99; for (const tg of targets) near = Math.min(near, dist(c, tg.p) / tg.w); v -= near * 2;
      if (d === s.d) v += 1; v += this.r() * 4;
      if (v > bestV) { bestV = v; best = d; }
    }
    s.q = [best];
  }
  space(start, m, danger) {
    const seen = new Set([start]), st = [start]; let n = 0;
    while (st.length && n < 40) { const c = st.pop(); n++; for (const d of DIRS) { const x = cx(c) + d[0], y = cy(c) + d[1]; if (!inside(x, y)) continue; const k = cell(x, y); if (seen.has(k) || m.has(k) || danger.has(k)) continue; seen.add(k); st.push(k); } }
    return n;
  }
  /* --- wire snapshot (what the host writes into room state.s) --- */
  snap() {
    const t = this.t, ds = v => Math.max(0, Math.ceil((v - t) / 100));
    this.mark = this.snakes.map(s => [s.mv, s.tr.length]);
    return {
      t: Math.round(t), du: this.dur, ov: this.over ? 1 : 0, n0: this.n0,
      sn: this.snakes.map(s => ({ i: s.id, n: s.name, c: s.c, a: s.al ? 1 : 0, b: enc(s.al ? s.b : (s.last || [])), h: enc(s.tr), m: s.mv, d: s.d, k: s.n, u: Math.max(0, Math.min(9, Math.floor(10 * s.acc))), g: Math.min(9, s.g), q: s.ack, x: [ds(s.fx.s), ds(s.fx.l), ds(s.fx.m), s.gr ? Math.max(1, ds(s.gr)) : 0], r: this.sprinting(s) ? 1 : 0, j: Math.round(10 * s.st / CFG.stamina), e: s.eat, w: s.best, z: Math.round(s.die), y: s.why || '', l: s.lg ? 1 : 0 })),
      f: enc(this.food.filter(f => !f.k).map(f => f.p)), F: enc(this.food.filter(f => f.k).map(f => f.p)),
      p: this.pw.map(p => p.k + enc([p.p])).join(''), o: this.ob.map(o => (o.a <= t ? 'A' : 'W') + enc(o.c)).join('.'),
      ev: this.ev.slice(-12)
    };
  }
  /** after a snapshot write succeeded: forget the moves/trail it carried (later moves stay for the next one) */
  commit() { if (!this.mark) return; this.snakes.forEach((s, k) => { const [mv, tr] = this.mark[k] || [0, 0]; s.mv = Math.max(0, s.mv - mv); if (s.tr.length > 8) s.tr.length = 8; }); this.mark = null; } // t296u: keep the newest freed tail cells (guest rewinds / 1-move-behind remote heads need them)
  /** a new host resumes from the last snapshot written by the old one */
  static fromSnap(w, o = {}) {
    const sim = new Sim({ players: [], dur: w.du, seed: o.seed }); sim.t = w.t; sim.n0 = w.n0 || (w.sn || []).length; sim.over = !!w.ov;
    sim.snakes = (w.sn || []).map(z => { const b = dec(z.b), x = z.x || []; return { id: z.i, name: z.n, c: z.c, bot: false, b: z.a ? b : [], last: z.a ? null : b, d: z.d | 0, q: [], g: z.g | 0, al: !!z.a, acc: 0, fx: { s: w.t + (x[0] | 0) * 100, l: w.t + (x[1] | 0) * 100, m: w.t + (x[2] | 0) * 100 }, eat: z.e | 0, best: z.w | 0, die: z.z | 0, why: z.y || '', mv: 0, tr: [], ack: z.q | 0, n: z.k | 0, hs: [], sp: !!z.r, st: z.j == null ? CFG.stamina : (z.j | 0) * CFG.stamina / 10, tired: false, gr: x[3] ? w.t + (x[3] | 0) * 100 : 0, grWhy: 'wall', rm: false, lg: false, spOff: -1e9 }; });
    sim.food = dec(w.f).map(p => ({ p, k: 0, e: 0 })).concat(dec(w.F).map(p => ({ p, k: 1, e: 0 })));
    const ps = String(w.p || ''); for (let i = 0; i + 2 < ps.length; i += 3) sim.pw.push({ k: ps[i], p: dec(ps.substr(i + 1, 2))[0], e: 0 });
    sim.ob = String(w.o || '').split('.').filter(Boolean).map(s => ({ c: dec(s.slice(1)), a: s[0] === 'A' ? w.t : w.t + CFG.obWarn, e: w.t + 8000 }));
    sim.ev = (w.ev || []).slice(); sim.evn = sim.ev.length ? sim.ev[sim.ev.length - 1][0] : 0;
    sim.nextBig = w.t + 6000; sim.nextPw = w.t + 6000; sim.nextOb = w.t + 5000; return sim;
  }
}
/** decode a wire snapshot for rendering */
function view(w) {
  const sn = (w.sn || []).map(z => ({ id: z.i, name: z.n, c: z.c | 0, al: !!z.a, b: dec(z.b), h: dec(z.h), m: z.m | 0, d: z.d | 0, k: z.k | 0, u: (z.u | 0) / 10, g: z.g | 0, ack: z.q | 0, x: z.x || [0, 0, 0, 0], sp: !!z.r, st: z.j == null ? 10 : z.j | 0, eat: z.e | 0, best: z.w | 0, die: z.z | 0, why: z.y || '', lg: !!z.l }));
  const ps = String(w.p || ''), pw = []; for (let i = 0; i + 2 < ps.length; i += 3) pw.push({ k: ps[i], p: dec(ps.substr(i + 1, 2))[0] });
  return { t: w.t | 0, dur: w.du | 0, over: !!w.ov, n0: w.n0 | 0, sn, food: dec(w.f), big: dec(w.F), pw, ob: String(w.o || '').split('.').filter(Boolean).map(s => ({ on: s[0] === 'A', c: dec(s.slice(1)) })), ev: Array.isArray(w.ev) ? w.ev : [] };
}
function rankView(v) {
  return v.sn.slice().sort((a, b) => (b.al - a.al) || (a.al ? (b.b.length - a.b.length) || (b.eat - a.eat) : (b.die - a.die) || (b.best - a.best)))
    .map((s, i) => ({ i: s.id, n: s.name, c: s.c, r: i + 1, a: s.al ? 1 : 0, l: s.al ? s.b.length : 0, w: s.best, e: s.eat, y: s.why }));
}
root.DU = root.UN = { W, H, DIRS, COLORS, CFG, Sim, view, rankView, enc, dec, cx, cy, cell, rng, ivOf, cheb };
})(typeof window !== 'undefined' ? window : globalThis);

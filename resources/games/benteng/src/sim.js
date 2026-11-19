/* Benteng Kampung: deterministic tower-defense simulation (integer math only, seeded PRNG, 20 ticks/s)
   + Timeline (rollback/replay of time-stamped player actions). Pure: no DOM, no clock. */
(function (root) {
'use strict';
const GAME = 'jadidaring-benteng', SCHEMA = 3, U = 1000, TPS = 20, TICK_MS = 50;
const KINDS = ['ketapel', 'meriam', 'sate', 'kentongan', 'petasan', 'barong'];
const copy = v => JSON.parse(JSON.stringify(v));
const fl = Math.floor;

/* ---------- PRNG (mulberry32, integer-only, identical on every JS engine) ---------- */
function rnd(s, n) {
  let a = (s.rng + 0x6D2B79F5) | 0; s.rng = a;
  let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) % n;
}
/* ---------- FNV-1a checksum of the canonical JSON ---------- */
function checksum(s) { const str = typeof s === 'string' ? s : JSON.stringify(s); let h = 0x811c9dc5; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193); } return (h >>> 0).toString(16).padStart(8, '0'); }

/* ---------- static world from the website-config JSON ---------- */
const HEROES = ['dukun', 'jawara', 'juragan', 'pendekar'];
function makeWorld(g) {
  const m = g.map, W = m.cols, H = m.rows, segs = [], pathCells = new Set(), blocked = new Set();
  const cx = c => c * U + U / 2;
  let d0 = 0;
  for (let i = 0; i + 1 < m.path.length; i++) {
    const [ax, ay] = m.path[i], [bx, by] = m.path[i + 1];
    if (ax !== bx && ay !== by) throw Error('path must be axis-aligned at ' + i);
    const len = (Math.abs(bx - ax) + Math.abs(by - ay)) * U;
    segs.push({ x: cx(ax), y: cx(ay), dx: Math.sign(bx - ax), dy: Math.sign(by - ay), len, d0 }); d0 += len;
    const n = Math.abs(bx - ax) + Math.abs(by - ay);
    for (let k = 0; k <= n; k++) { const x = ax + Math.sign(bx - ax) * k, y = ay + Math.sign(by - ay) * k; if (x >= 0 && x < W && y >= 0 && y < H) pathCells.add(y * W + x); }
  }
  for (const [x, y] of m.blocked || []) blocked.add(y * W + x);
  const T = {}; for (const k of KINDS) if (g.towers[k]) T[k] = g.towers[k];
  return { W, H, segs, len: d0, pathCells, blocked, T, M: g.monsters, waves: g.waves, eco: g.economy, HR: g.heroes || {}, CB: g.combined || {}, BC: (g.berkah || {}).cards || {}, voteTicks: (g.berkah || {}).voteTicks || 240, EX: g.endless || {} };
}
function pos(world, d) {
  const sg = world.segs; let s = sg[sg.length - 1];
  for (let i = 0; i < sg.length; i++) if (d < sg[i].d0 + sg[i].len) { s = sg[i]; break; }
  const k = Math.max(0, Math.min(s.len, d - s.d0));
  return [s.x + s.dx * k, s.y + s.dy * k];
}
/** direction of travel at distance d: [dx, dy] */
function dirAt(world, d) { const sg = world.segs; for (let i = 0; i < sg.length; i++) if (d < sg[i].d0 + sg[i].len) return [sg[i].dx, sg[i].dy]; const L = sg[sg.length - 1]; return [L.dx, L.dy]; }
const cellXY = (world, c) => [(c % world.W) * U + U / 2, fl(c / world.W) * U + U / 2];
const isBuildable = (world, c) => Number.isInteger(c) && c >= 0 && c < world.W * world.H && !world.pathCells.has(c) && !world.blocked.has(c);
const onMap = (world, c) => Number.isInteger(c) && c >= 0 && c < world.W * world.H;

/* ---------- state ---------- */
const BONUS0 = () => ({ rate: 0, dmg: 0, rng: 0, disc: 0, cdr: 0, slow: 0, combo: 0, gold: 0 });
/** heroes: optional list of hero keys aligned with ids (missing/unknown → one per seat) */
function create(world, seed, ids, heroes) {
  const n = Math.max(1, Math.min(4, ids.length)), e = world.eco;
  return { game: GAME, schema: SCHEMA, t: 0, rng: seed | 0, n, sh: e.coinSharePct[n - 1], hp: e.monsterHpPct[n - 1],
    pl: ids.slice(0, 4).map((id, i) => ({ id: Number(id), s: i, c: e.startCoins * 100, g: 0, r: 0, sp: 0, h: heroes && HEROES.includes(heroes[i]) ? heroes[i] : HEROES[i % 4], k: 0 })),
    lives: e.lives, w: 0, ph: 'prep', tm: e.prepSeconds * TPS, lost: 0, wt: 0, q: [], en: [], tw: [], fd: [], nid: 1, sc: 0, kills: 0, leaks: 0,
    b: BONUS0(), bh: [], vt: null, sg: null, sgc: 0, gb: 0, fires: 0, x: 0, ex: null, em: 10000 };
}
const player = (s, id) => s.pl.find(p => p.id === Number(id));
const present = s => s.pl.filter(p => !p.g);
/** per-player amount in hundredths for a "solo" coin value (× pct/100): equal split, team total = share × n */
function perPlayer(s, coins, pct) { const np = present(s).length || 1; return fl(coins * (pct || 100) * s.sh * s.n / (np * 100)); }
function pay(s, coins, pct) { const per = perPlayer(s, coins, pct); for (const p of present(s)) p.c += per; return per; }
function take(s, coins) { const per = perPlayer(s, coins); for (const p of present(s)) p.c = Math.max(0, p.c - per); return per; }
function occupied(s, c) { return s.tw.some(t => t.c === c) || s.fd.some(f => f.c === c); }
const upCost = (world, k, lvl) => fl(world.T[k].cost * world.eco.upgradeCostPct[lvl] / 100);
/** build price after the Diskon Pasar berkah */
const cost = (world, s, k) => fl(world.T[k].cost * (100 - ((s && s.b && s.b.disc) || 0)) / 100);
const range = (world, s, k, l) => fl(world.T[k].range[l] * (100 + s.b.rng) / 100);
/** cooldown (ticks) of a hero skill after the Ronda Malam berkah */
const skillCd = (world, s, h) => fl(world.HR[h].cd * (100 - s.b.cdr) / 100);
/** reason an action is refused (null = allowed). Shared by the UI and the sim. */
function check(world, s, pid, a) {
  const p = player(s, pid); if (!p) return 'player'; if (!a || typeof a !== 'object') return 'bad';
  if (s.ph === 'win' || s.ph === 'lose') return 'over';
  if (p.g && a.k !== 'back') return 'gone';
  const e = world.eco, money = n => (p.c >= n * 100 ? null : 'coins');
  switch (a.k) {
    case 'build': {
      const T = world.T[a.t]; if (!T) return 'bad';
      if (!isBuildable(world, a.c)) return 'cell'; if (occupied(s, a.c)) return 'taken';
      if (T.shared && present(s).length > 1) return 'shared';
      return money(cost(world, s, a.t));
    }
    case 'up': { const t = s.tw.find(x => x.i === a.i); if (!t) return 'bad'; if (t.l >= 2) return 'max'; return money(upCost(world, t.k, t.l)); }
    case 'sell': { const t = s.tw.find(x => x.i === a.i); if (!t) return 'bad'; if (t.o !== p.id && !(player(s, t.o) || {}).g) return 'owner'; return null; }
    case 'found': {
      if (present(s).length < 2) return 'solo'; const amt = a.n | 0;
      if (!isBuildable(world, a.c)) return 'cell'; if (occupied(s, a.c)) return 'taken';
      if (amt < e.barongMinChip || amt % e.giveStep || amt > e.barongMaxSharePerPlayer) return 'amount';
      return money(amt);
    }
    case 'chip': {
      const f = s.fd.find(x => x.i === a.i), amt = a.n | 0; if (!f) return 'bad';
      if (amt < e.barongMinChip || amt % e.giveStep) return 'amount';
      const mine = f.pd.filter(x => x[0] === p.id).reduce((m, x) => m + x[1], 0);
      if (amt > e.barongCost - f.tot || mine + amt > e.barongMaxSharePerPlayer) return 'amount';
      return money(amt);
    }
    case 'unfound': { const f = s.fd.find(x => x.i === a.i); if (!f) return 'bad'; return f.o === p.id || (player(s, f.o) || {}).g ? null : 'owner'; }
    case 'give': {
      const q = player(s, a.to), amt = a.n | 0; if (!q || q.g || q.id === p.id) return 'target';
      if (amt < e.giveStep || amt % e.giveStep) return 'amount'; return money(amt);
    }
    case 'ready': return s.ph === 'prep' || s.ph === 'break' ? null : 'phase';
    case 'skill': { const H = world.HR[p.h]; if (!H) return 'bad'; if (s.ph !== 'wave') return 'wave'; if (p.k > 0) return 'cooldown'; if (H.target && !onMap(world, a.c)) return 'bad'; return null; }
    case 'join': { if (present(s).length < 2) return 'solo'; if (s.ph !== 'wave') return 'wave'; if (s.sgc > 0) return 'cooldown'; if (s.sg && s.sg.ps.includes(p.id)) return 'joined'; return null; }
    case 'endless': return s.ph === 'won' && s.ex ? (a.y === 0 || a.y === 1 ? null : 'bad') : 'phase';
    case 'vote': { if (!s.vt) return 'novote'; const n = a.n; return Number.isInteger(n) && n >= 0 && n < s.vt.c.length ? null : 'bad'; }
    case 'gone': { const q = player(s, a.p); return q && !q.g && present(s).length > 1 ? null : 'target'; }
    case 'back': { const q = player(s, a.p); return q && q.g ? null : 'target'; }
    default: return 'bad';
  }
}
function placeTower(s, k, c, o, inv, by) { const t = { i: s.nid++, k, c, o, l: 0, cd: 0, inv, by, rg: 0 }; s.tw.push(t); s.tw.sort((x, y) => x.i - y.i); return t; }
function apply(world, s, pid, a, fx) {
  const why = check(world, s, pid, a);
  if (why) { if (fx) fx.push({ t: 'deny', p: Number(pid), why, k: a && a.k }); return false; }
  const p = player(s, pid), e = world.eco;
  switch (a.k) {
    case 'build': { const price = cost(world, s, a.t); p.c -= price * 100; p.sp += price; const t = placeTower(s, a.t, a.c, p.id, price, [[p.id, price]]); if (fx) fx.push({ t: 'built', p: p.id, c: a.c, k: a.t, i: t.i }); break; }
    case 'up': { const t = s.tw.find(x => x.i === a.i), c2 = upCost(world, t.k, t.l); p.c -= c2 * 100; p.sp += c2; t.l++; t.inv += c2; const b = t.by.find(x => x[0] === p.id); if (b) b[1] += c2; else t.by.push([p.id, c2]); if (fx) fx.push({ t: 'up', p: p.id, c: t.c, l: t.l, k: t.k, o: t.o }); break; }
    case 'sell': {
      const t = s.tw.find(x => x.i === a.i), total = t.by.reduce((m, x) => m + x[1], 0) || 1;
      for (const [id, amt] of t.by) { const q = player(s, id); const back = fl(amt * 100 * e.sellRefundPct / 100); if (q && !q.g) q.c += back; else p.c += back; }
      s.tw = s.tw.filter(x => x !== t); if (fx) fx.push({ t: 'sold', p: p.id, c: t.c, total }); break;
    }
    case 'found': { const amt = a.n | 0; p.c -= amt * 100; p.sp += amt; s.fd.push({ i: s.nid++, c: a.c, o: p.id, pd: [[p.id, amt]], tot: amt }); if (fx) fx.push({ t: 'found', p: p.id, c: a.c }); break; }
    case 'chip': {
      const f = s.fd.find(x => x.i === a.i), amt = a.n | 0; p.c -= amt * 100; p.sp += amt; f.tot += amt;
      const b = f.pd.find(x => x[0] === p.id); if (b) b[1] += amt; else f.pd.push([p.id, amt]);
      if (fx) fx.push({ t: 'chip', p: p.id, c: f.c, n: amt });
      if (f.tot >= e.barongCost && f.pd.length >= 2) { s.fd = s.fd.filter(x => x !== f); placeTower(s, 'barong', f.c, f.o, f.tot, f.pd); if (fx) fx.push({ t: 'built', p: f.o, c: f.c, k: 'barong' }); }
      break;
    }
    case 'unfound': { const f = s.fd.find(x => x.i === a.i); for (const [id, amt] of f.pd) { const q = player(s, id); if (q && !q.g) q.c += amt * 100; else p.c += amt * 100; } s.fd = s.fd.filter(x => x !== f); if (fx) fx.push({ t: 'unfound', p: p.id, c: f.c }); break; }
    case 'give': { const q = player(s, a.to), amt = a.n | 0; p.c -= amt * 100; q.c += amt * 100; if (fx) fx.push({ t: 'give', p: p.id, to: q.id, n: amt }); break; }
    case 'ready': p.r = 1; if (fx) fx.push({ t: 'ready', p: p.id }); if (present(s).every(x => x.r)) startWave(world, s, true, fx); break;
    case 'skill': castSkill(world, s, p, a, fx); break;
    case 'join': {
      if (!s.sg) { s.sg = { e: s.t + (world.CB.window || 60), ps: [p.id] }; if (fx) fx.push({ t: 'sgOpen', p: p.id }); }
      else { s.sg.ps.push(p.id); if (fx) fx.push({ t: 'sgJoin', p: p.id, n: s.sg.ps.length }); }
      if (s.sg.ps.length >= present(s).length) fireCombined(world, s, fx); // everyone is in: no need to wait
      break;
    }
    case 'vote': {
      const v = s.vt.v.find(x => x[0] === p.id); if (v) v[1] = a.n; else s.vt.v.push([p.id, a.n]);
      if (fx) fx.push({ t: 'vote', p: p.id, n: a.n });
      if (present(s).every(q => s.vt.v.some(x => x[0] === q.id))) resolveVote(world, s, fx);
      break;
    }
    case 'gone': {
      const q = player(s, a.p), others = present(s).filter(x => x !== q), per = fl(q.c / others.length);
      others.forEach((x, i) => { x.c += per + (i === 0 ? q.c - per * others.length : 0); }); q.c = 0; q.g = 1; q.r = 0;
      if (s.vt) s.vt.v = s.vt.v.filter(x => x[0] !== q.id);
      if (s.sg) s.sg.ps = s.sg.ps.filter(x => x !== q.id);
      if (fx) fx.push({ t: 'gone', p: q.id });
      if (s.vt && s.vt.v.length && present(s).every(x => s.vt.v.some(y => y[0] === x.id))) resolveVote(world, s, fx);
      if ((s.ph === 'prep' || s.ph === 'break') && present(s).every(x => x.r)) startWave(world, s, true, fx);
      if (s.ex) resolveEndless(world, s, false, fx);
      break;
    }
    case 'endless': {
      const v = s.ex.v.find(x => x[0] === p.id); if (v) v[1] = a.y; else s.ex.v.push([p.id, a.y]);
      if (fx) fx.push({ t: 'exVote', p: p.id, y: a.y });
      resolveEndless(world, s, false, fx);
      break;
    }
    case 'back': { const q = player(s, a.p); q.g = 0; q.c = 0; q.r = 0; q.k = 0; if (fx) fx.push({ t: 'back', p: q.id }); break; }
  }
  return true;
}
/* ---------- hero skills ---------- */
function enemiesNear(world, s, x, y, r) { const out = []; for (const en of s.en) { const [ex, ey] = pos(world, en.d), dx = ex - x, dy = ey - y; if (dx * dx + dy * dy <= r * r * 100) out.push(en); } return out; }
function castSkill(world, s, p, a, fx) {
  const H = world.HR[p.h], w = Math.max(1, s.w); p.k = skillCd(world, s, p.h);
  const [x, y] = H.target ? cellXY(world, a.c) : [0, 0]; let n = 0;
  switch (p.h) {
    case 'dukun': for (const en of enemiesNear(world, s, x, y, H.r)) { en.fz = Math.max(en.fz || 0, world.M[en.k].boss ? fl(H.freeze * H.bossFreezePct / 100) : H.freeze); n++; } break;
    case 'jawara': for (const t of s.tw) { const [tx, ty] = cellXY(world, t.c); if ((tx - x) ** 2 + (ty - y) ** 2 <= H.r * H.r * 100) { t.rg = H.rage; n++; } } break;
    case 'juragan': { const per = pay(s, H.coins + H.coinsPerWave * w); s.gb = H.gold; n = per; break; }
    case 'pendekar': {
      const near = enemiesNear(world, s, x, y, H.r).sort((m, k) => k.hp - m.hp || m.i - k.i), dmg = fl((H.dmg + H.dmgPerWave * w) * s.hp / 100);
      if (near.length) { const tg = near[0], [tx, ty] = pos(world, tg.d); tg.hp -= dmg; n = 1; for (const en of enemiesNear(world, s, tx, ty, H.splash)) if (en !== tg) { en.hp -= fl(dmg * H.splashPct / 100); n++; } if (fx) fx.push({ t: 'hit', x: tx, y: ty, n: dmg, i: tg.i, big: 1 }); }
      break;
    }
  }
  s.sc += 5;
  if (fx) fx.push({ t: 'skill', p: p.id, h: p.h, c: H.target ? a.c : -1, x, y, n });
}
function fireCombined(world, s, fx) {
  const C = world.CB, cnt = s.sg.ps.length, ps = s.sg.ps.slice(); s.sg = null;
  if (cnt < (C.min || 2)) { if (fx) fx.push({ t: 'sgFizzle', ps }); return; }
  const dmg = fl((C.dmg + C.dmgPerWave * Math.max(1, s.w)) * cnt * s.hp / 100);
  for (const en of s.en) { en.hp -= dmg; if (!world.M[en.k].fly) { en.sl = Math.max(en.sl, C.slowTicks); en.sp = Math.max(en.sp, C.slow); en.so = 0; } }
  s.sgc = C.cd; s.fires++; s.sc += 50 * cnt;
  if (fx) fx.push({ t: 'sgFire', ps, n: dmg, hits: s.en.length });
}
/* ---------- berkah cards (vote after each wave) ---------- */
function dealCards(world, s, fx) {
  const keys = Object.keys(world.BC).filter(k => s.bh.filter(x => x === k).length < (world.BC[k].max || 99)), c = [];
  while (c.length < 3 && keys.length) c.push(keys.splice(rnd(s, keys.length), 1)[0]);
  if (!c.length) return;
  s.vt = { c, v: [], e: s.t + world.voteTicks };
  if (fx) fx.push({ t: 'deal', c });
}
function resolveVote(world, s, fx) {
  const vt = s.vt; if (!vt) return; s.vt = null;
  const cnt = vt.c.map((_, i) => vt.v.filter(x => x[1] === i && !(player(s, x[0]) || {}).g).length), top = Math.max(...cnt);
  const tied = cnt.map((n, i) => (n === top ? i : -1)).filter(i => i >= 0), pick = tied.length === 1 ? tied[0] : tied[rnd(s, tied.length)];
  const k = vt.c[pick], C = world.BC[k]; s.bh.push(k);
  for (const st of ['rate', 'dmg', 'rng', 'disc', 'cdr', 'slow', 'combo', 'gold']) if (C[st]) s.b[st] += C[st];
  if (C.coins) pay(s, C.coins);
  if (C.lives) s.lives = Math.min(world.eco.maxLives || 30, s.lives + C.lives);
  if (fx) fx.push({ t: 'berkah', k, cnt, tie: tied.length > 1 });
}
/* ---------- endless (after winning wave 15): no berkah, monster HP compounds every wave ---------- */
/** endless offer: majority yes → continue; a yes-majority is impossible → final win; timeout → yes > no among cast votes */
function resolveEndless(world, s, timeout, fx) {
  const ex = s.ex; if (!ex) return; const np = present(s).length || 1, live = ex.v.filter(x => !(player(s, x[0]) || {}).g);
  const yes = live.filter(x => x[1] === 1).length, no = live.length - yes;
  let go = null; if (yes * 2 > np) go = true; else if (no * 2 >= np && np > 0 && (np > 1 || no > 0)) go = false; else if (timeout) go = yes > no;
  if (go === null) return;
  s.ex = null;
  if (!go) { s.ph = 'win'; if (fx) fx.push({ t: 'win', yes, no }); return; }
  const X = world.EX, cap = X.bonusCap || {}; s.x = 1; s.em = 10000; s.ph = 'break'; s.tm = world.eco.breakSeconds * TPS; for (const p of s.pl) p.r = 0;
  for (const k of Object.keys(cap)) if (s.b[k] > cap[k]) s.b[k] = cap[k]; // keep earlier berkah, but capped, so the end always comes
  if (fx) fx.push({ t: 'endless', yes, no });
}
/** monster groups of wave w (1-based): the authored list for 1..15, then generated endless waves (deterministic, no rng) */
function wavePlan(world, s, w) {
  const N = world.waves.length; if (w <= N) return world.waves[w - 1] || [];
  const X = world.EX, ek = w - N, T = X.templates || [11, 12, 13, 14], tpl = world.waves[T[(ek - 1) % T.length] - 1] || [];
  const mul = Math.min(X.countMaxPct || 250, 100 + (X.countPct || 6) * ek), out = [];
  for (const g of tpl) if (!world.M[g.k].boss) out.push({ k: g.k, n: Math.max(1, fl((g.n || 1) * mul / 100)), gap: Math.max(4, fl((g.gap || 10) * 100 / mul)), delay: g.delay || 0 });
  if (ek % (X.bossEvery || 3) === 0) out.unshift({ k: 'ratu', n: 1 + fl(ek / ((X.bossEvery || 3) * 3)), gap: 160, delay: 40 });
  return out;
}
function monsterHp(world, s, k, w) { const base = Math.max(1, fl(fl(world.M[k].hp * s.hp / 100) * (100 + world.eco.waveHpGrowthPct * (w - 1)) / 100)); return s.x ? Math.max(1, fl(base * (s.em / 100) / 100)) : base; }
function spawn(world, s, k, d, minion, fx) {
  const M = world.M[k], hp = monsterHp(world, s, k, Math.max(1, s.w));
  s.en.push({ i: s.nid++, k, hp, mx: hp, d: d || 0, sl: 0, sp: 0, so: 0, bt: M.boss ? M.summonTicks : 0, m: minion ? 1 : 0, fz: 0 });
  if (M.boss && !minion && fx) fx.push({ t: 'boss', k });
}
function startWave(world, s, early, fx) {
  if (s.vt) resolveVote(world, s, fx);
  if (early && s.tm > 0) { const bonus = fl(s.tm / TPS) * world.eco.earlyStartCoinsPerSecond; if (bonus > 0) { const per = pay(s, bonus); if (fx) fx.push({ t: 'early', per }); } }
  s.w++; s.ph = 'wave'; s.wt = 0; s.lost = 0; s.tm = 0; for (const p of s.pl) p.r = 0;
  if (s.x) s.em = fl(s.em * (100 + (world.EX.hpPct || 16)) / 100);
  const groups = wavePlan(world, s, s.w), q = [];
  groups.forEach((g, gi) => { for (let i = 0; i < (g.n || 1); i++) q.push([(g.delay || 0) + i * (g.gap || 0), g.k, gi * 1000 + i]); });
  // small seeded jitter so waves don't feel mechanical (deterministic for everyone)
  for (const it of q) it[0] += rnd(s, 5);
  q.sort((a, b) => a[0] - b[0] || a[2] - b[2]); s.q = q.map(x => [x[0], x[1]]);
  if (fx) fx.push({ t: 'wave', w: s.w });
}
function endWave(world, s, fx) {
  const e = world.eco, base = e.waveBonusBase + e.waveBonusPerWave * s.w, bonus = s.lost ? base : fl(base * (100 + e.noLeakBonusPct) / 100);
  const per = pay(s, bonus); s.sc += 100 * s.w + (s.lost ? 0 : 50);
  if (s.sg) fireCombined(world, s, fx);
  if (fx) fx.push({ t: 'waveEnd', w: s.w, per, clean: !s.lost });
  if (s.x) { s.ph = 'break'; s.tm = e.breakSeconds * TPS; } // endless: no berkah cards
  else if (s.w >= world.waves.length) { s.sc += s.lives * 100; s.ph = 'won'; s.ex = { v: [], e: s.t + (world.EX.offerTicks || 400) }; if (fx) fx.push({ t: 'won' }); }
  else { s.ph = 'break'; s.tm = e.breakSeconds * TPS; dealCards(world, s, fx); }
}
function buffOf(world, s, t) {
  let b = 0; const [x, y] = cellXY(world, t.c);
  for (const k of s.tw) if (k.k === 'kentongan' && k !== t) { const K = world.T.kentongan, r = range(world, s, 'kentongan', k.l), [kx, ky] = cellXY(world, k.c); if ((kx - x) * (kx - x) + (ky - y) * (ky - y) <= r * r * 100) b = Math.max(b, K.buff[k.l]); }
  return b;
}
function hit(world, s, t, en, base, area) {
  const M = world.M[en.k]; let pct = 100 + s.b.dmg;
  const combo = en.sl > 0 && en.so && en.so !== t.o && s.n > 1;
  if (combo) pct += world.eco.comboBonusPct + s.b.combo;
  let dmg = fl(base * pct / 100);
  if (area && M.areaResistPct) dmg = fl(dmg * (100 - M.areaResistPct) / 100);
  en.hp -= dmg; return [combo, dmg];
}
function rateOf(world, s, t) { const T = world.T[t.k]; return fl(T.cd[t.l] * 100 / (100 + buffOf(world, s, t) + s.b.rate + (t.rg > 0 ? (world.HR.jawara || {}).ratePct || 100 : 0))); }
function waveTick(world, s, fx) {
  s.wt++;
  while (s.q.length && s.q[0][0] <= s.wt) spawn(world, s, s.q.shift()[1], 0, false, fx);
  for (const en of s.en.slice()) {
    const M = world.M[en.k]; let v = fl(M.speed * U / 100 / TPS);
    if (M.hop) v = (s.t + en.i * 3) % 10 < 6 ? fl(v * 10 / 6) : 0;
    if (en.sl > 0) { v = fl(v * (100 - en.sp) / 100); en.sl--; if (!en.sl) { en.sp = 0; en.so = 0; } }
    if (en.fz > 0) { en.fz--; v = 0; }
    en.d += v;
    if (M.boss && --en.bt <= 0) { en.bt = M.summonTicks; spawn(world, s, M.summon, Math.max(0, en.d - 300), true, null); if (fx) fx.push({ t: 'summon', d: en.d }); }
  }
  // leaks
  for (const en of s.en.filter(x => x.d >= world.len)) {
    const M = world.M[en.k]; s.lives = Math.max(0, s.lives - M.leak); s.lost += M.leak; s.leaks++;
    let stolen = 0; if (M.steal && !en.m) stolen = take(s, M.steal);
    if (fx) fx.push({ t: 'leak', k: en.k, n: M.leak, stolen });
  }
  s.en = s.en.filter(x => x.d < world.len);
  if (s.lives <= 0) { s.ph = 'lose'; if (fx) fx.push({ t: 'lose' }); return; }
  const P = s.en.map(en => pos(world, en.d));
  const inRange = (x, y, r, i) => { const dx = P[i][0] - x, dy = P[i][1] - y; return dx * dx + dy * dy <= r * r * 100; };
  for (const t of s.tw) {
    const T = world.T[t.k]; if (t.rg > 0) t.rg--;
    if (t.k === 'kentongan') continue;
    if (t.cd > 0) { t.cd--; continue; }
    const [x, y] = cellXY(world, t.c), r = range(world, s, t.k, t.l);
    if (t.k === 'sate') {
      let any = false; const slow = Math.min(80, T.slow[t.l] + s.b.slow);
      s.en.forEach((en, i) => { if (!world.M[en.k].fly && inRange(x, y, r, i)) { any = true; if (slow >= en.sp || en.sl < 5) { en.sp = slow; en.so = t.o; } en.sl = T.slowTicks; } });
      if (any) { t.cd = rateOf(world, s, t); if (fx) fx.push({ t: 'smoke', x, y, r, c: t.c }); }
      continue;
    }
    // target: furthest along the path among reachable enemies; flyers first for anti-air towers
    let best = -1;
    s.en.forEach((en, i) => {
      const fly = !!world.M[en.k].fly; if (fly ? !T.air : !T.ground) return; if (en.hp <= 0 || !inRange(x, y, r, i)) return;
      if (best < 0) { best = i; return; }
      const bf = !!world.M[s.en[best].k].fly;
      if (T.airMulPct && fly !== bf) { if (fly) best = i; return; }
      if (en.d > s.en[best].d) best = i;
    });
    if (best < 0) continue;
    const tg = s.en[best], fly = !!world.M[tg.k].fly, dmg = fl(T.dmg[t.l] * (fly && T.airMulPct ? T.airMulPct : 100) / 100);
    if (T.splash) {
      const [tx, ty] = P[best]; let combo = false, tot = 0;
      s.en.forEach((en, i) => { if (world.M[en.k].fly || en.hp <= 0) return; const dx = P[i][0] - tx, dy = P[i][1] - ty; if (dx * dx + dy * dy <= T.splash * T.splash * 100) { const [cb, d] = hit(world, s, t, en, dmg, true); combo = combo || cb; tot += d; } });
      if (fx) fx.push({ t: 'boom', x: tx, y: ty, r: T.splash, from: [x, y], k: t.k, c: t.c, l: t.l, n: tot, combo, i: tg.i });
    } else { const [combo, d] = hit(world, s, t, tg, dmg, false); if (fx) fx.push({ t: 'shot', from: [x, y], to: P[best], k: t.k, combo, c: t.c, l: t.l, n: d, i: tg.i, fly }); }
    t.cd = rateOf(world, s, t);
  }
  // deaths: reward split equally among present players, no matter who landed the hit
  const dead = s.en.filter(x => x.hp <= 0);
  const goldPct = 100 + s.b.gold + (s.gb > 0 ? (world.HR.juragan || {}).goldPct || 0 : 0);
  for (const en of dead) { const M = world.M[en.k], reward = en.m ? 1 : M.reward, per = pay(s, reward, goldPct); s.kills++; s.sc += reward * 10; if (fx) { const [x, y] = pos(world, en.d); fx.push({ t: 'kill', k: en.k, x, y, per, i: en.i, boss: M.boss ? 1 : 0 }); } }
  if (dead.length) s.en = s.en.filter(x => x.hp > 0);
  if (!s.q.length && !s.en.length) endWave(world, s, fx);
}
/** advance one tick: actions scheduled for tick s.t first (in log order), then the world */
function step(world, s, acts, fx) {
  if (acts) for (const a of acts) apply(world, s, a.p, a.a, fx);
  for (const p of s.pl) if (p.k > 0) p.k--;
  if (s.sgc > 0) s.sgc--; if (s.gb > 0) s.gb--;
  if (s.sg && s.t >= s.sg.e) fireCombined(world, s, fx);
  if (s.vt && s.t >= s.vt.e) resolveVote(world, s, fx);
  if (s.ex && s.t >= s.ex.e) resolveEndless(world, s, true, fx);
  if (s.ph === 'prep' || s.ph === 'break') { if (--s.tm <= 0) { s.tm = 0; startWave(world, s, false, fx); } }
  else if (s.ph === 'wave') waveTick(world, s, fx);
  s.t++;
  return s;
}
const over = s => s.ph === 'win' || s.ph === 'lose';

/* ---------- Timeline: base snapshot + ordered action log, cached states every 20 ticks, rollback on late input ---------- */
class Timeline {
  constructor(world, base) { this.world = world; this.rollbacks = 0; this.replayed = 0; this.rebase(base, []); }
  /** base = { tick, v, sim } (sim may be a JSON string, as stored in room state) */
  rebase(base, pend) {
    const sim = typeof base.sim === 'string' ? JSON.parse(base.sim) : copy(base.sim);
    this.base = { tick: sim.t, v: base.v | 0, json: JSON.stringify(sim) };
    const keep = (this.acts || []).filter(a => a.v > this.base.v && a.t >= this.base.tick);
    const all = new Map(); for (const a of (pend || []).concat(keep)) if (a.t >= this.base.tick) all.set(a.v, a);
    this.acts = [...all.values()].sort((a, b) => a.t - b.t || a.v - b.v);
    this.cur = JSON.parse(this.base.json); this.prev = null; this.cache = new Map([[this.cur.t, this.base.json]]);
    this.live = Math.max(this.live || 0, this.cur.t); this.marks = (this.marks || []).filter(m => m > this.cur.t);
  }
  /** add a logged action {v, t, p, a}. Returns false when it is too late (before the base) or a duplicate. */
  add(act) {
    if (act.t < this.base.tick || act.v <= this.base.v || this.acts.some(a => a.v === act.v)) return false;
    let i = this.acts.length; while (i > 0 && (this.acts[i - 1].t > act.t || (this.acts[i - 1].t === act.t && this.acts[i - 1].v > act.v))) i--;
    this.acts.splice(i, 0, act);
    if (act.t < this.cur.t) this.rewind(act.t);
    return true;
  }
  rewind(t) {
    let best = -1; for (const k of this.cache.keys()) if (k <= t && k > best) best = k;
    for (const k of [...this.cache.keys()]) if (k > best) this.cache.delete(k);
    this.rollbacks++; this.cur = JSON.parse(this.cache.get(best)); this.prev = null; this.marks = this.marks.filter(m => m <= best);
  }
  actsAt(t) { const out = []; for (const a of this.acts) { if (a.t === t) out.push(a); else if (a.t > t) break; } return out; }
  /** simulate up to tick `target`; fx are collected only for ticks never shown before */
  advance(target, fx, maxSteps = 4000) {
    let n = 0;
    while (this.cur.t < target && n++ < maxSteps) {
      if (this.cur.t % 20 === 0 && !this.cache.has(this.cur.t)) this.cache.set(this.cur.t, JSON.stringify(this.cur));
      const fresh = this.cur.t >= this.live; if (!fresh) this.replayed++;
      if (this.cur.t === target - 1) this.prev = this.cur.en.map(e => [e.i, e.d]);
      const ph0 = this.cur.ph;
      step(this.world, this.cur, this.actsAt(this.cur.t), fresh ? fx : null);
      if (fresh) this.live = this.cur.t;
      if (ph0 !== this.cur.ph && (ph0 === 'wave' || over(this.cur)) && !this.marks.includes(this.cur.t)) this.marks.push(this.cur.t); // wave end / game over
    }
    if (this.cache.size > 60) { const keys = [...this.cache.keys()].sort((a, b) => a - b); for (const k of keys.slice(0, keys.length - 60)) if (k !== this.base.tick) this.cache.delete(k); }
    return this.cur;
  }
  /** state at an earlier (or current) tick without disturbing the live state */
  stateAt(t) {
    if (t === this.cur.t) return copy(this.cur);
    let best = -1; for (const k of this.cache.keys()) if (k <= t && k > best) best = k;
    const s = best >= 0 ? JSON.parse(this.cache.get(best)) : JSON.parse(this.base.json);
    while (s.t < t) step(this.world, s, this.actsAt(s.t), null);
    return s;
  }
  pending(fromTick) { return this.acts.filter(a => a.t >= fromTick); }
}

root.BK = { GAME, SCHEMA, U, TPS, TICK_MS, KINDS, HEROES, copy, rnd, checksum, makeWorld, pos, dirAt, cellXY, isBuildable, onMap, create, wavePlan, player, present, perPlayer, occupied, upCost, cost, range, skillCd, check, apply, step, over, monsterHp, Timeline };
})(typeof window !== 'undefined' ? window : globalThis);

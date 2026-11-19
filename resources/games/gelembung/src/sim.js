/* Duel Gelembung: board simulation (pure, no DOM). Every client runs its own board authoritatively;
   rows, shot colours and skill placements come from seeded RNGs, so the same inputs give the same board. */
(function (root) {
'use strict';
const W = 8, LOSE = 12, RH = Math.sqrt(3) / 2, HIT = 0.84, SPEED = 24;
const CY = LOSE * RH + 1.75, H = CY + 0.95;            // cannon centre y and board height (cell units)
/* v2: passive attacks. Gain fills the meter; every full METER is one charge, carried over up to MAX_CHARGES
   that all fire together the moment the shot lands. Immunity is per hit, but a stacked hit (n charges) lands whole. */
const METER = 15, MAX_CHARGES = 3, POP = 1, DROP = 3, BIG_SIZE = 5, BIG_BONUS = 5, HUGE_SIZE = 8, HUGE_BONUS = 12, COMBO_MAX = 4, IMMUNE = 3500;
/** meter gain for one shot: pop +1, drop +3, a 5+ ball shot +5, an 8+ ball shot +12 more, combo streak +1 per step (max +4) */
function gainOf(pops, drops, combo) { if (!pops) return 0; const n = pops + drops; return pops * POP + drops * DROP + (n >= BIG_SIZE ? BIG_BONUS : 0) + (n >= HUGE_SIZE ? HUGE_BONUS : 0) + Math.min(COMBO_MAX, Math.max(0, combo - 1)); }
const CHARS = ['batu', 'es', 'kabut', 'mercon', 'gembok', 'angin'];
const SKILL = { batu: 'batu', es: 'es', kabut: 'kabut', mercon: 'mercon', gembok: 'gembok', angin: 'angin' };
const HARD = ['x', 'e', 'g', 'w', 'h'];               // batu, es, gembok, bom waktu, bayangan
/** ceiling interval by elapsed match time: 12 s → 9 → 7 → 5 → 4 */
function interval(t) { return t < 60000 ? 12000 : t < 120000 ? 9000 : t < 180000 ? 7000 : t < 240000 ? 5000 : 4000; }
/* ---------- RNG (mulberry32, state kept on the board so it serialises) ---------- */
function mix(a) { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return [a, ((t ^ (t >>> 14)) >>> 0) / 4294967296]; }
function rng(seed) { let s = seed | 0; return () => { const r = mix(s); s = r[0]; return r[1]; }; }
function draw(b) { const r = mix(b.rs); b.rs = r[0]; return r[1]; }
function hash(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h | 0; }
/* ---------- geometry ---------- */
const shifted = (b, r) => ((r + b.po) & 1) === 1;
const rowLen = (b, r) => shifted(b, r) ? W - 1 : W;
const cx = (b, r, c) => c + 0.5 + (shifted(b, r) ? 0.5 : 0);
const cy = r => r * RH + 0.5;
const at = (b, r, c) => (r >= 0 && r < b.g.length && c >= 0 && c < rowLen(b, r)) ? b.g[r][c] : null;
function nb(b, r, c) {
  const s = shifted(b, r), o = [[r, c - 1], [r, c + 1]], a = s ? [c, c + 1] : [c - 1, c];
  for (const rr of [r - 1, r + 1]) for (const cc of a) o.push([rr, cc]);
  return o.filter(([rr, cc]) => rr >= 0 && cc >= 0 && cc < rowLen(b, rr));
}
function ensureRows(b, n) { while (b.g.length < n) b.g.push(new Array(W).fill(null)); }
/* ---------- balls ---------- */
// k: n normal · x batu · e es (iced) · g gembok (locked) · w bom waktu (tm ms) · h bayangan (hidden colour) · r pelangi (wild) · b bom
const ball = (k, c, extra) => Object.assign({ k, c: c == null ? -1 : c }, extra || {});
const coloured = v => v && v.k !== 'x' && v.k !== 'b' && v.c >= 0;
/** can v join a match group of colour col? iced and locked balls cannot until they are freed */
const matches = (v, col) => !!v && (v.k === 'r' || ((v.k === 'n' || v.k === 'w' || v.k === 'h') && v.c === col));
function present(b) { const s = new Set(); for (const row of b.g) for (const v of row) if (coloured(v) && v.k !== 'r') s.add(v.c); return [...s].filter(c => c < b.colors).sort(); }
function genColor(b) { const p = present(b); const pool = p.length ? p : Array.from({ length: b.colors }, (_, i) => i); return pool[Math.floor(draw(b) * pool.length)]; }
function genBall(b) {
  b.made = (b.made || 0) + 1;
  if (b.ch === 'batu' && b.made % 15 === 0) return ball('r');
  if (b.ch === 'mercon' && b.made % 15 === 0) return ball('b');
  return ball('n', genColor(b));
}
function newRow(b, rowIdx) {
  const row = new Array(W).fill(null), n = rowLen(b, rowIdx), shade = b.t >= 90000;
  for (let c = 0; c < n; c++) { const col = Math.floor(draw(b) * b.colors); row[c] = shade && draw(b) < 0.1 ? ball('h', col) : ball('n', col); }
  return row;
}
/* ---------- board ---------- */
function create(seed, opts) {
  const o = opts || {};
  const b = { seed: seed | 0, rs: (seed | 0) ^ 0x5bd1e995, g: [], po: 0, t: 0, colors: 5, cd: interval(0), shots: 0, sc: 0, m: 0, q: 0, bursts: [0, 0, 0, 0], combo: 0, out: false, outAt: 0,
    ch: o.ch || 'batu', imm: 0, fog: 0, wob: 0, swapCd: 0, fly: null, made: 0, fx: [], seen: {}, best: 0, pops: 0, drops: 0, paused: false };
  if (CHARS.indexOf(b.ch) < 0) b.ch = 'batu';
  if (o.layout) { load(b, o.layout); }
  else { const rows = o.rows == null ? 5 : o.rows; for (let r = 0; r < rows; r++) b.g.push(newRow(b, r)); }
  b.cur = o.cur ? Object.assign({}, o.cur) : genBall(b); b.next = [genBall(b), genBall(b)];
  if (b.ch === 'angin') b.cd += 1000;
  return b;
}
/** layout: rows of chars (see encode); used by tests and the tutorial */
function load(b, rows) { b.g = rows.map((line, r) => { const row = new Array(W).fill(null); for (let c = 0; c < Math.min(line.length, W); c++) row[c] = decodeCell(line[c]); return row; }); }
const clone = b => { const x = Object.assign({}, b); x.g = b.g.map(row => row.map(v => v && Object.assign({}, v))); x.fx = []; x.next = b.next.map(v => Object.assign({}, v)); x.cur = Object.assign({}, b.cur); x.fly = null; x.seen = Object.assign({}, b.seen); return x; };
/* ---------- shot tracing ---------- */
const MIN_A = 0.14, MAX_A = Math.PI - 0.14;
function clampAng(a) { return Math.max(MIN_A, Math.min(MAX_A, a)); }
/** angle measured from the +x axis, pointing up (π/2 = straight up) */
function trace(b, ang) {
  ang = clampAng(ang);
  let x = W / 2, y = CY, vx = Math.cos(ang), vy = -Math.sin(ang); const pts = [[x, y]], st = 0.06; let bounces = 0;
  for (let i = 0; i < 1600; i++) {
    x += vx * st; y += vy * st;
    if (x < 0.5) { x = 1 - x; vx = -vx; bounces++; pts.push([0.5, y]); }
    else if (x > W - 0.5) { x = 2 * (W - 0.5) - x; vx = -vx; bounces++; pts.push([W - 0.5, y]); }
    if (y <= 0.5) { y = 0.5; break; }
    const r0 = Math.floor((y - 0.5) / RH); let hit = false;
    for (let r = Math.max(0, r0 - 1); r <= r0 + 1 && !hit; r++) for (let c = 0; c < rowLen(b, r); c++) { const v = at(b, r, c); if (v && (x - cx(b, r, c)) ** 2 + (y - cy(r)) ** 2 < HIT * HIT) { hit = true; break; } }
    if (hit) break;
  }
  pts.push([x, y]);
  return { pts, bounces, cell: snap(b, x, y), x, y };
}
function attached(b, r, c) { return r === 0 || nb(b, r, c).some(([rr, cc]) => at(b, rr, cc)); }
function snap(b, x, y) {
  const r0 = Math.max(0, Math.round((y - 0.5) / RH)); let best = null, bd = Infinity;
  for (let r = Math.max(0, r0 - 1); r <= r0 + 1; r++) for (let c = 0; c < rowLen(b, r); c++) {
    if (r < b.g.length && b.g[r][c]) continue; if (!attached(b, r, c)) continue;
    const d = (x - cx(b, r, c)) ** 2 + (y - cy(r)) ** 2; if (d < bd) { bd = d; best = [r, c]; }
  }
  if (!best) { for (let c = 0; c < rowLen(b, 0); c++) if (!at(b, 0, c)) { const d = Math.abs(x - cx(b, 0, c)); if (d < bd) { bd = d; best = [0, c]; } } }
  return best;
}
/* ---------- resolving a landed ball ---------- */
function flood(b, r, c, col) {
  const seen = new Set([r + ',' + c]), out = [[r, c]], q = [[r, c]];
  while (q.length) { const [rr, cc] = q.pop(); for (const [nr, nc] of nb(b, rr, cc)) { const k = nr + ',' + nc; if (seen.has(k)) continue; seen.add(k); if (matches(at(b, nr, nc), col)) { out.push([nr, nc]); q.push([nr, nc]); } } }
  return out;
}
function orphans(b) {
  const seen = new Set(), q = [];
  for (let c = 0; c < rowLen(b, 0); c++) if (at(b, 0, c)) { seen.add('0,' + c); q.push([0, c]); }
  while (q.length) { const [r, c] = q.pop(); for (const [nr, nc] of nb(b, r, c)) { const k = nr + ',' + nc; if (!seen.has(k) && at(b, nr, nc)) { seen.add(k); q.push([nr, nc]); } } }
  const out = []; for (let r = 0; r < b.g.length; r++) for (let c = 0; c < rowLen(b, r); c++) if (at(b, r, c) && !seen.has(r + ',' + c)) out.push([r, c]);
  return out;
}
function fxp(b, e) { if (b.fx.length < 400) b.fx.push(e); }
function remove(b, cells, kind) { for (const [r, c] of cells) { const v = b.g[r][c]; if (!v) continue; fxp(b, { k: kind, x: cx(b, r, c), y: cy(r), c: v.c, t: v.k }); b.g[r][c] = null; } }
/** freeing rules around popped cells: gembok unlocks, bayangan reveals, es cracks */
function freeAround(b, cells) {
  const done = new Set();
  for (const [r, c] of cells) for (const [nr, nc] of nb(b, r, c)) {
    const k = nr + ',' + nc, v = at(b, nr, nc); if (!v || done.has(k)) continue;
    if (v.k === 'g' || v.k === 'h' || v.k === 'e') { done.add(k); fxp(b, { k: v.k === 'g' ? 'unlock' : v.k === 'h' ? 'reveal' : 'crack', x: cx(b, nr, nc), y: cy(nr), c: v.c }); b.g[nr][nc] = ball('n', v.c); }
  }
}
function trim(b) { while (b.g.length && b.g[b.g.length - 1].every(v => !v)) b.g.pop(); }
function lowest(b) { for (let r = b.g.length - 1; r >= 0; r--) if (b.g[r].some(v => v)) return r; return -1; }
/** put ball v at (r,c) and resolve pops, drops, score and meter. Returns {pops, drops} */
function place(b, r, c, v) {
  ensureRows(b, r + 1); b.g[r][c] = v; let popped = [];
  fxp(b, { k: 'land', x: cx(b, r, c), y: cy(r), c: v.c, t: v.k });
  // es: a ball landing next to it cracks the ice (first hit); after that it matches normally (second hit)
  const cracks = nb(b, r, c).filter(([nr, nc]) => { const u = at(b, nr, nc); return u && u.k === 'e'; });
  if (v.k === 'b') {
    const rad = b.ch === 'mercon' ? 2.05 : 1.05, x0 = cx(b, r, c), y0 = cy(r);
    for (let rr = 0; rr < b.g.length; rr++) for (let cc = 0; cc < rowLen(b, rr); cc++) if (at(b, rr, cc) && Math.hypot(cx(b, rr, cc) - x0, cy(rr) - y0) <= rad) popped.push([rr, cc]);
    fxp(b, { k: 'boom', x: x0, y: y0, r: rad });
  } else if (v.k === 'r') {
    const cols = new Set(); for (const [nr, nc] of nb(b, r, c)) { const u = at(b, nr, nc); if (matches(u, u ? u.c : -1) && u.k !== 'r') cols.add(u.c); }
    const set = new Map(); for (const col of cols) { const g = flood(b, r, c, col); if (g.length >= 3) for (const p of g) set.set(p[0] + ',' + p[1], p); }
    popped = [...set.values()];
  } else if (v.k === 'n') { const g = flood(b, r, c, v.c); if (g.length >= 3) popped = g; }
  for (const [nr, nc] of cracks) { const u = at(b, nr, nc); if (u && u.k === 'e') { fxp(b, { k: 'crack', x: cx(b, nr, nc), y: cy(nr), c: u.c }); b.g[nr][nc] = ball('n', u.c); } }
  let pops = 0, drops = 0;
  if (popped.length) { remove(b, popped, 'pop'); pops = popped.length; freeAround(b, popped); const o = orphans(b); drops = o.length; remove(b, o, 'drop'); }
  trim(b);
  if (pops) { b.combo++; const mult = 1 + 0.5 * Math.min(4, b.combo - 1); b.sc += Math.round((pops * 10 + drops * 20 + (drops >= 6 ? 100 : 0)) * mult); }
  else b.combo = 0;
  const gain = gainOf(pops, drops, b.combo), got = charge(b, gain); b.pops += pops; b.drops += drops; b.best = Math.max(b.best, pops + drops);
  if (pops) fxp(b, { k: 'score', pops, drops, combo: b.combo, big: pops + drops >= BIG_SIZE, huge: pops + drops >= HUGE_SIZE, gain, x: cx(b, r, c), y: cy(r) });
  if (got) fxp(b, { k: 'full', n: got, q: b.q });
  if (lowest(b) < 0) { for (let i = 0; i < 4; i++) pushRow(b, true); b.sc += 500; fxp(b, { k: 'clear' }); }
  check(b);
  return { pops, drops };
}
function check(b) { if (!b.out && lowest(b) >= LOSE) { b.out = true; b.outAt = b.t; b.fly = null; fxp(b, { k: 'out' }); } return b.out; }
/** the stack is pushed down one row and a new seeded row appears under the ceiling */
function pushRow(b, quiet) {
  b.po ^= 1; b.g.unshift(newRow(b, 0));
  if (!quiet) fxp(b, { k: 'row' });
  seenScan(b); check(b);
}
function seenScan(b) { for (const row of b.g) for (const v of row) if (v && HARD.concat(['r', 'b']).indexOf(v.k) >= 0 && !b.seen[v.k]) { b.seen[v.k] = 1; fxp(b, { k: 'first', t: v.k }); } }
/* ---------- player input ---------- */
const wobble = b => b.t < b.wob ? (Math.sin(b.t / 170) * 0.16 + Math.sin(b.t / 61) * 0.05) * (b.wobA || 1) : 0;
function fire(b, ang) {
  if (b.out || b.fly || b.paused === 'all') return null;
  const a = clampAng(ang + wobble(b)), tr = trace(b, a);
  if (!tr.cell) return null;
  b.fly = { pts: tr.pts, d: 0, len: pathLen(tr.pts), v: b.cur, bounces: tr.bounces, ang: a };
  b.shots++; if (b.swapCd > 0) b.swapCd--;
  b.cur = b.next.shift(); b.next.push(genBall(b));
  fxp(b, { k: 'shoot', c: b.fly.v.c, t: b.fly.v.k });
  return tr;
}
function pathLen(p) { let s = 0; for (let i = 1; i < p.length; i++) s += Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]); return s; }
function flyPos(f) { let d = f.d; for (let i = 1; i < f.pts.length; i++) { const a = f.pts[i - 1], z = f.pts[i], l = Math.hypot(z[0] - a[0], z[1] - a[1]); if (d <= l || i === f.pts.length - 1) { const k = l ? Math.min(1, d / l) : 1; return [a[0] + (z[0] - a[0]) * k, a[1] + (z[1] - a[1]) * k, i]; } d -= l; } return f.pts[f.pts.length - 1].concat([0]); }
function canSwap(b) { return !b.out && (b.ch === 'gembok' || b.swapCd === 0); }
function swap(b) { if (!canSwap(b)) return false; const t = b.cur; b.cur = b.next[0]; b.next[0] = t; if (b.ch !== 'gembok') b.swapCd = 2; fxp(b, { k: 'swap' }); return true; }
/* ---------- time ---------- */
function step(b, dt) {
  if (b.out) return;
  if (b.fly) {
    const f = b.fly, seg0 = flyPos(f)[2]; f.d += SPEED * dt / 1000; const seg1 = flyPos(f)[2];
    if (seg1 > seg0 && seg1 < f.pts.length - 1) fxp(b, { k: 'bounce' });
    if (f.d >= f.len) { b.fly = null; const e = f.pts[f.pts.length - 1]; let cell = snap(b, e[0], e[1]); if (cell) { place(b, cell[0], cell[1], f.v); seenScan(b); } fxp(b, { k: 'landed', bounces: f.bounces }); }
  }
  if (b.paused) return;
  b.t += dt; const cols = b.t >= 120000 ? 6 : 5; if (cols !== b.colors) { b.colors = cols; fxp(b, { k: 'color6' }); }
  const was = b.cd; b.cd -= dt;
  if (was > 2000 && b.cd <= 2000) fxp(b, { k: 'warn' });
  if (b.cd <= 0) { pushRow(b); b.cd += interval(b.t) + (b.ch === 'angin' ? 1000 : 0); }
  for (let r = 0; r < b.g.length; r++) for (let c = 0; c < rowLen(b, r); c++) { const v = b.g[r][c]; if (v && v.k === 'w') { v.tm -= dt; if (v.tm <= 0) { b.g[r][c] = ball('n', v.c); fxp(b, { k: 'fuse', x: cx(b, r, c), y: cy(r) }); pushRow(b); if (b.out) return; } } }
}
/* ---------- skills (deterministic: same board + same seed → same placement) ---------- */
function candidates(b) { const out = []; for (let r = 0; r < b.g.length; r++) for (let c = 0; c < rowLen(b, r); c++) { const v = b.g[r][c]; if (v && v.k === 'n') out.push([r, c]); } return out; }
function pick(list, n, rand) { const a = list.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; } return a.slice(0, n); }
function emptySpots(b) { const out = []; for (let r = 0; r < Math.min(LOSE - 1, b.g.length + 1); r++) for (let c = 0; c < rowLen(b, r); c++) if (!at(b, r, c) && attached(b, r, c)) out.push([r, c]); return out; }
/** returns {ok, cells} or {blocked:true} when the board is still immune */
function applySkill(b, sk, seed, n) {
  n = Math.max(1, Math.min(MAX_CHARGES, n | 0 || 1));
  if (b.out) return { ok: false, out: true };
  if (b.t < b.imm) { fxp(b, { k: 'blocked', sk }); return { ok: false, blocked: true }; }
  const rand = rng(hash(sk + ':' + seed)), cells = [];
  const conv = (n, make) => { let list = pick(candidates(b), n, rand); for (const [r, c] of list) { b.g[r][c] = make(b.g[r][c]); cells.push([r, c]); }
    if (list.length < n) for (const [r, c] of pick(emptySpots(b), n - list.length, rand)) { ensureRows(b, r + 1); b.g[r][c] = make(ball('n', Math.floor(rand() * b.colors))); cells.push([r, c]); } };
  if (sk === 'batu') conv(3 * n, () => ball('x'));
  else if (sk === 'es') conv(5 * n, v => ball('e', v.c));
  else if (sk === 'gembok') conv(4 * n, v => ball('g', v.c));
  else if (sk === 'mercon') conv(n, v => ball('w', v.c, { tm: 10000 }));
  else if (sk === 'kabut') { b.fog = b.t + 6000 + 3000 * (n - 1); b.fogR = 3 + n; }
  else if (sk === 'angin') { b.wob = b.t + 5000 + 2500 * (n - 1); b.wobA = 1 + 0.4 * (n - 1); }
  else return { ok: false };
  b.imm = b.t + IMMUNE; seenScan(b);
  for (const [r, c] of cells) fxp(b, { k: 'hard', x: cx(b, r, c), y: cy(r), t: b.g[r][c].k });
  fxp(b, { k: 'hit', sk, n }); check(b);
  return { ok: true, cells, n };
}
/** add gain to the meter; whole METERs become queued charges (max MAX_CHARGES). Returns charges gained. */
function charge(b, gain) {
  if (b.out || gain <= 0) return 0;
  b.m += gain; let got = 0;
  while (b.m >= METER && b.q < MAX_CHARGES) { b.m -= METER; b.q++; got++; }
  if (b.q >= MAX_CHARGES) b.m = Math.min(b.m, METER - 1);
  return got;
}
/** take every queued charge at once (auto-fire). Returns how many fired (0..3). */
function takeCharges(b) { if (b.out || !b.q) return 0; const n = b.q; b.q = 0; b.bursts[n]++; return n; }
/** legacy single use (tests / tutorial helpers) */
function useMeter(b) { if (b.out || (b.q < 1 && b.m < METER)) return false; if (b.q) b.q--; else b.m -= METER; return true; }
/** spread n charges over targets ([{id, sc, free}] sorted by the caller or here): leader first, one each while
   there are free targets, extra charges stack on the leader → [[id, count], ...] */
function spread(n, targets) {
  const live = targets.filter(t => !t.out), free = live.filter(t => t.free !== false);
  const list = (free.length ? free : []).slice().sort((a, b) => (b.sc - a.sc) || (a.id - b.id));
  if (!list.length || n <= 0) return [];
  const m = new Map(); for (let i = 0; i < n; i++) { const t = list[i < list.length ? i : 0]; m.set(t.id, (m.get(t.id) || 0) + 1); }
  return [...m.entries()];
}
/* ---------- compact snapshot (≈110 chars) for opponents' mini boards ---------- */
// '.' empty · a–f normal · A–F es · g–l gembok · m–r bom waktu · s–x bayangan · X batu · R pelangi · Z bom
function encodeCell(v, hide) {
  if (!v) return '.'; const c = Math.max(0, v.c);
  switch (v.k) { case 'n': return 'abcdef'[c]; case 'e': return 'ABCDEF'[c]; case 'g': return 'ghijkl'[c]; case 'w': return 'mnopqr'[c]; case 'h': return hide ? '?' : 'stuvwx'[c]; case 'x': return 'X'; case 'r': return 'R'; case 'b': return 'Z'; }
  return '.';
}
function decodeCell(ch) {
  if (!ch || ch === '.' || ch === ' ') return null; const i = s => s.indexOf(ch);
  if (i('abcdef') >= 0) return ball('n', i('abcdef')); if (i('ABCDEF') >= 0) return ball('e', i('ABCDEF')); if (i('ghijkl') >= 0) return ball('g', i('ghijkl'));
  if (i('mnopqr') >= 0) return ball('w', i('mnopqr'), { tm: 10000 }); if (i('stuvwx') >= 0) return ball('h', i('stuvwx')); if (ch === '?') return ball('h', 0);
  if (ch === 'X') return ball('x'); if (ch === 'R') return ball('r'); if (ch === 'Z') return ball('b'); return null;
}
function encode(b) { return b.po + ':' + b.g.map((row, r) => row.slice(0, rowLen(b, r)).map(v => encodeCell(v, true)).join('')).join('/'); }
function decode(s) { const m = /^([01]):(.*)$/.exec(String(s || '')); const b = { po: m ? +m[1] : 0, g: [] }; if (m && m[2]) b.g = m[2].split('/').slice(0, LOSE + 2).map(line => { const row = new Array(W).fill(null); for (let c = 0; c < Math.min(W, line.length); c++) row[c] = decodeCell(line[c]); return row; }); return b; }
/** a playable board object rebuilt from a snapshot string (opponent views / spectators / skill previews) */
function view(enc) { const d = decode(enc), b = create(1, { rows: 0 }); b.po = d.po; b.g = d.g.length ? d.g : []; b.cur = ball('n', 0); b.next = []; b.fx = []; return b; }
/* ---------- bot ---------- */
/** best angle by sampling: maximise pops + 2×drops, prefer low risk; level 0..2 controls sampling + aim error */
function botAim(b, level, rand) {
  const n = [18, 32, 52][level] || 32; let best = null;
  for (let i = 0; i < n; i++) {
    const a = MIN_A + (MAX_A - MIN_A) * (i + 0.5) / n, tr = trace(b, a); if (!tr.cell) continue;
    const x = clone(b); const res = place(x, tr.cell[0], tr.cell[1], Object.assign({}, b.cur));
    let score = res.pops * 3 + res.drops * 5 - (x.out ? 100 : 0) - tr.cell[0] * 0.15 - tr.bounces * 0.3 + rand() * 0.8;
    if (!res.pops && b.cur.k === 'n') { const same = nb(x, tr.cell[0], tr.cell[1]).filter(([r, c]) => matches(at(x, r, c), b.cur.c)).length; score += same * 1.2; }
    if (!best || score > best.score) best = { a, score };
  }
  const err = [0.09, 0.045, 0.015][level] || 0.04;
  return best ? best.a + (rand() - 0.5) * 2 * err : Math.PI / 2;
}
const API = { W, LOSE, RH, CY, H, HIT, METER, MAX_CHARGES, POP, DROP, BIG_SIZE, BIG_BONUS, HUGE_SIZE, HUGE_BONUS, COMBO_MAX, IMMUNE, gainOf, charge, takeCharges, spread, CHARS, SKILL, HARD, interval, rng, hash, mix, create, load, clone, trace, snap, flood, orphans, place, pushRow, fire, flyPos, swap, canSwap, step,
  applySkill, useMeter, encode, decode, view, encodeCell, decodeCell, nb, at, cx, cy, rowLen, shifted, lowest, present, wobble, botAim, ball, matches, clampAng };
root.DG = API;
if (typeof module !== 'undefined') module.exports = API;
})(typeof window !== 'undefined' ? window : globalThis);

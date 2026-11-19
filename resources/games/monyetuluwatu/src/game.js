/* Monyet Uluwatu: pure game logic (node-testable). window.MU */
(function (root) {
'use strict';
const W = 400, H = 720, DUR = 150;
const ITEMS = { kacamata: { label: 'kacamata', need: 1, pts: 30 }, sandal: { label: 'sandal', need: 1, pts: 20 }, hp: { label: 'HP', need: 2, pts: 60 } };
const KINDS = ['kacamata', 'hp', 'sandal'];
const SPOTS = [{ x: 108, y: 432 }, { x: 292, y: 432 }, { x: 62, y: 548 }, { x: 338, y: 548 }, { x: 200, y: 548 }, { x: 122, y: 656 }, { x: 278, y: 656 }];
const PERCH = [{ x: 52, y: 318 }, { x: 126, y: 318 }, { x: 200, y: 318 }, { x: 274, y: 318 }, { x: 348, y: 318 }];
const TYPES = { biasa: { sp: 1, hp: 1, r: 40, need: 0, sc: 1.25 }, anak: { sp: 1.5, hp: 1, r: 35, need: 0, sc: 1 }, bos: { sp: 0.78, hp: 2, r: 48, need: 1, sc: 1.55 } };
const depth = y => 0.8 + 0.36 * clamp((y - 318) / 340, 0, 1); // 2.5D: nearer (lower) = bigger
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const lerp = (a, b, p) => a + (b - a) * p, clamp = (v, a, b) => v < a ? a : v > b ? b : v, dist = (a, b, x, y) => Math.hypot(a - x, b - y);
const NAMES = ['Mbak Sari', 'Om Bule', 'Kak Dewi', 'Pak Made', 'Tante Rina', 'Mas Joko', 'Ms. Emma', 'Bli Komang', 'Kak Tiara', 'Mr. Kenji'];

function create(seed, opts) {
  opts = opts || {};
  const g = { seed: seed >>> 0, R: rng(seed || 1), t: 0, dur: opts.dur || DUR, mode: opts.mode || 'main', over: false, won: false, score: 0, lives: 3, bananas: opts.tut ? 0 : 4, maxBan: 9,
    mons: [], tour: [], shots: [], baskets: [], ev: [], id: 1, spawnT: 1.6, basketT: 12, combo: 0, lastShoo: -9, mult: 1, streak: 0, wave: 0,
    stats: { shoo: 0, saved: 0, recov: 0, lost: 0, near: 0, ban: 0, best: 0 }, tut: opts.tut ? { stage: 0, t: 0 } : null };
  for (let i = 0; i < SPOTS.length; i++) g.tour.push({ i, x: SPOTS[i].x, y: SPOTS[i].y, item: null, state: 'empty', t: 0, look: 0, name: '', skin: 0, shirt: 0, hat: 0, mood: 0 });
  const first = opts.tut ? [0, 1] : [0, 1, 2, 3];
  first.forEach((i, k) => arrive(g, g.tour[i], opts.tut ? (k ? 'hp' : 'kacamata') : null, true));
  return g;
}
function active(g) { const p = g.t / g.dur; return p < 0.22 ? 4 : p < 0.45 ? 5 : p < 0.68 ? 6 : 7; }
function arrive(g, tr, kind, now) {
  tr.item = kind || KINDS[Math.floor(g.R() * 3)]; tr.state = now ? 'ok' : 'arriving'; tr.t = now ? 0 : 0.8; tr.mood = 0;
  tr.name = NAMES[Math.floor(g.R() * NAMES.length)]; tr.skin = Math.floor(g.R() * 4); tr.shirt = Math.floor(g.R() * 6); tr.hat = g.R() < 0.4 ? 1 + Math.floor(g.R() * 2) : 0; tr.look = g.R() < 0.5 ? -1 : 1;
}
const pct = g => clamp(g.t / g.dur, 0, 1);
function emit(g, e) { g.ev.push(e); }
function targets(g) { const busy = new Set(g.mons.filter(m => m.tgt != null && (m.st === 'walk' || m.st === 'grab')).map(m => m.tgt)); return g.tour.filter(t => t.state === 'ok' && t.item && !busy.has(t.i)); }
function freePerch(g) { const used = new Set(g.mons.filter(m => m.slot != null && (m.st === 'carry' || m.st === 'perch' || m.st === 'eat')).map(m => m.slot)); const f = PERCH.map((p, i) => i).filter(i => !used.has(i)); return f; }
function spawn(g, o) {
  o = o || {}; const p = pct(g), R = g.R; const tg = o.tgt != null ? g.tour[o.tgt] : (() => { const ts = targets(g); return ts.length ? ts[Math.floor(R() * ts.length)] : null; })();
  if (!tg) return null;
  let type = o.type || 'biasa';
  if (!o.type) { const r = R(); if (p > 0.3 && r < lerp(0.1, 0.22, p)) type = 'bos'; else if (p > 0.12 && r > 1 - lerp(0.18, 0.3, p)) type = 'anak'; }
  const side = R() < 0.5 ? -1 : 1, from = o.from || (R() < 0.3 ? 'wall' : 'side');
  let x, y; if (from === 'wall') { x = clamp(tg.x + (R() - 0.5) * 160, 30, 370); y = 300; } else { x = side < 0 ? -34 : W + 34; y = tg.y + (R() - 0.5) * 40; }
  const T = TYPES[type], m = { id: g.id++, type, x, y, vx: 0, vy: 0, st: from === 'wall' ? 'hop' : 'walk', t: 0, tgt: tg.i, hp: T.hp, item: null, slot: null, fed: 0, pend: 0, need: 0, life: 0, lifeMax: 0, face: x < tg.x ? 1 : -1, bob: R() * 6, sp: (o.sp || lerp(52, 92, p)) * T.sp, tame: !!o.tame };
  g.mons.push(m); emit(g, { t: 'spawn', id: m.id, x, y, type }); return m;
}
function step(g, dt) {
  if (g.over) return;
  dt = Math.min(dt, 0.05); g.t += dt; const p = pct(g), R = g.R;
  const w = Math.floor(g.t / 30); if (w > g.wave && !g.tut) { g.wave = w; emit(g, { t: 'wave', n: w + 1 }); }
  if (g.tut) tutStep(g, dt);
  else {
    // tourists keep coming
    const n = active(g); for (const tr of g.tour) { if (tr.i < n && tr.state === 'empty') { tr.t -= dt; if (tr.t <= -1.2) arrive(g, tr); } }
    g.spawnT -= dt;
    const walkers = g.mons.filter(m => m.st === 'walk' || m.st === 'hop' || m.st === 'grab').length, cap = 2 + Math.floor(p * 5);
    if (g.spawnT <= 0 && walkers < cap) {
      spawn(g); g.spawnT = lerp(2.7, 0.95, p) * (0.75 + R() * 0.5);
      if (p > 0.5 && R() < lerp(0.05, 0.35, p)) spawn(g); // pair
    }
    g.basketT -= dt; if (g.basketT <= 0) { g.basketT = lerp(13, 9, p) + R() * 4; const s = SPOTS[Math.floor(R() * SPOTS.length)]; g.baskets.push({ id: g.id++, x: clamp(s.x + (R() < 0.5 ? -46 : 46), 30, 370), y: s.y + 14, t: 0, life: 6.5 }); emit(g, { t: 'basketIn' }); }
  }
  for (const tr of g.tour) {
    if (tr.state === 'arriving') { tr.t -= dt; if (tr.t <= 0) { tr.state = 'ok'; tr.t = 0; } }
    else if (tr.state === 'leaving') { tr.t -= dt; if (tr.t <= 0) { tr.state = 'empty'; tr.item = null; tr.t = 0; } }
    tr.mood = Math.max(0, tr.mood - dt);
  }
  for (const b of g.baskets) b.t += dt; g.baskets = g.baskets.filter(b => b.t < b.life);
  for (const m of g.mons) monStep(g, m, dt, p);
  g.mons = g.mons.filter(m => !m.dead);
  for (const s of g.shots) { s.t += dt; if (!s.done && s.t >= s.dur) { s.done = true; land(g, s); } }
  g.shots = g.shots.filter(s => s.t < s.dur + 0.05);
  if (g.combo && g.t - g.lastShoo > 1.8) { g.combo = 0; g.mult = 1; }
  if (!g.tut && g.lives <= 0) end(g, false);
  else if (!g.tut && g.t >= g.dur) end(g, true);
}
function monStep(g, m, dt, p) {
  m.t += dt; m.bob += dt * (m.st === 'walk' ? 11 : 3);
  if (m.st === 'hop') { // drop from the wall
    const tg = g.tour[m.tgt]; m.y += dt * 260; m.x += (tg.x - m.x) * dt * 0.8; if (m.y >= Math.min(tg.y - 30, 380)) { m.st = 'walk'; m.t = 0; } return;
  }
  if (m.st === 'walk') {
    const tg = g.tour[m.tgt]; if (!tg || tg.state !== 'ok' || !tg.item) { const ts = targets(g); if (ts.length) { m.tgt = ts[0].i; return; } m.st = 'flee'; m.t = 0; m.vx = m.x < 200 ? -260 : 260; m.vy = -40; return; }
    const dx = tg.x + (m.x < tg.x ? -24 : 24) - m.x, dy = tg.y - 4 - m.y, d = Math.hypot(dx, dy); m.face = dx >= 0 ? 1 : -1;
    if (d < 6) { m.st = 'grab'; m.t = 0; tg.mood = 0.6; emit(g, { t: 'grabbing', id: m.id, x: tg.x, y: tg.y }); return; }
    const v = Math.min(d, m.sp * dt); m.x += dx / d * v; m.y += dy / d * v; return;
  }
  if (m.st === 'grab') {
    const tg = g.tour[m.tgt]; if (m.t >= (m.type === 'anak' ? 0.42 : 0.55)) {
      if (!tg.item) { m.st = 'flee'; m.t = 0; m.vx = m.face * -240; m.vy = -30; return; }
      m.item = tg.item; tg.item = null; tg.state = 'robbed'; tg.mood = 3; g.stats.lost++; g.combo = 0; g.mult = 1; g.streak = 0;
      const f = freePerch(g); emit(g, { t: 'steal', id: m.id, x: tg.x, y: tg.y, item: m.item, who: tg.name });
      if (!f.length) { escape(g, m); return; }
      m.slot = f.sort((a, b) => Math.abs(PERCH[a].x - m.x) - Math.abs(PERCH[b].x - m.x))[0]; m.st = 'carry'; m.t = 0;
    } return;
  }
  if (m.st === 'carry') {
    const P = PERCH[m.slot], dx = P.x - m.x, dy = P.y - m.y, d = Math.hypot(dx, dy); m.face = dx >= 0 ? 1 : -1;
    if (d < 5) { m.st = 'perch'; m.t = 0; m.x = P.x; m.y = P.y; m.need = ITEMS[m.item].need + TYPES[m.type].need; m.lifeMax = m.life = g.tut ? 999 : lerp(9, 6.2, p); emit(g, { t: 'perch', id: m.id, need: m.need, item: m.item }); return; }
    const v = Math.min(d, 300 * dt); m.x += dx / d * v; m.y += dy / d * v; return;
  }
  if (m.st === 'perch') {
    m.life -= dt; if (m.life <= 0 && m.fed + m.pend < m.need) escape(g, m); return;
  }
  if (m.st === 'eat') { if (m.t > 1.6) { m.st = 'flee'; m.t = 0; m.vx = (m.x < 200 ? -1 : 1) * 150; m.vy = -120; } return; }
  if (m.st === 'flee' || m.st === 'escape') { m.x += m.vx * dt; m.y += m.vy * dt; m.vy += 60 * dt; if (m.x < -60 || m.x > W + 60 || m.y < -60 || m.t > 3) m.dead = true; return; }
  if (m.st === 'shoved') { m.x += m.vx * dt; m.vx *= Math.pow(0.02, dt); if (m.t > 0.35) { m.st = 'walk'; m.t = 0; } }
}
function escape(g, m) {
  const tr = g.tour[m.tgt]; m.st = 'escape'; m.t = 0; m.vx = (m.x < 200 ? -1 : 1) * 210; m.vy = -150; m.slot = null;
  if (!g.tut) g.lives--; g.stats.ban += 0; emit(g, { t: 'escape', id: m.id, item: m.item, x: m.x, y: m.y, who: tr && tr.name, lives: g.lives });
  if (tr && tr.state === 'robbed') { tr.state = 'leaving'; tr.t = 1.2; }
}
function shoo(g, m) {
  m.hp--; const near = m.st === 'grab';
  if (m.hp > 0) { m.st = 'shoved'; m.t = 0; m.vx = -m.face * 170; emit(g, { t: 'bonk', id: m.id, x: m.x, y: m.y }); return 'bonk'; }
  g.combo = g.t - g.lastShoo < 1.8 ? g.combo + 1 : 1; g.lastShoo = g.t; g.mult = Math.min(4, 1 + Math.floor((g.combo - 1) / 3));
  const pts = (m.type === 'bos' ? 25 : m.type === 'anak' ? 15 : 10) * g.mult + (near ? 15 : 0); g.score += pts; g.stats.shoo++; if (near) g.stats.near++;
  g.streak++; g.stats.best = Math.max(g.stats.best, g.combo);
  m.st = 'flee'; m.t = 0; m.vx = (m.x < 200 ? -1 : 1) * 280; m.vy = -60;
  if (near) { const tg = g.tour[m.tgt]; if (tg) tg.mood = 0; }
  emit(g, { t: 'shoo', id: m.id, x: m.x, y: m.y, pts, mult: g.mult, near, type: m.type });
  if (g.streak % 5 === 0 && g.bananas < g.maxBan) { g.bananas++; emit(g, { t: 'streak', n: g.streak }); }
  return 'shoo';
}
function throwBanana(g, m) {
  if (g.bananas <= 0) { emit(g, { t: 'nopisang' }); return 'none'; }
  if (m.fed + m.pend >= m.need) return 'enough';
  g.bananas--; g.stats.ban++; m.pend++; const s = { id: g.id++, m: m.id, x0: 200, y0: H - 30, t: 0, dur: 0.42 }; g.shots.push(s); emit(g, { t: 'throw', id: m.id }); return 'throw';
}
function land(g, s) {
  const m = g.mons.find(o => o.id === s.m); if (!m) return; m.pend = Math.max(0, m.pend - 1);
  if (m.st !== 'perch') { emit(g, { t: 'catch', id: m.id, x: m.x, y: m.y }); return; }
  m.fed++; emit(g, { t: 'fed', id: m.id, x: m.x, y: m.y, fed: m.fed, need: m.need });
  if (m.fed >= m.need) {
    const tr = g.tour[m.tgt], quick = m.life / m.lifeMax > 0.5, pts = Math.round(ITEMS[m.item].pts * (quick ? 1.5 : 1) * (m.type === 'bos' ? 1.5 : 1));
    g.score += pts; g.stats.recov++; emit(g, { t: 'recover', id: m.id, x: m.x, y: m.y, tx: tr.x, ty: tr.y, item: m.item, pts, quick, who: tr.name });
    if (tr.state === 'robbed') { tr.item = m.item; tr.state = 'ok'; tr.mood = 0; tr.t = 0; }
    m.item = null; m.st = 'eat'; m.t = 0; m.slot = null;
  }
}
// tap in design coords. returns what happened
function tap(g, x, y) {
  if (g.over) return 'over';
  let best = null, bd = 1e9;
  for (const m of g.mons) { if (!(m.st === 'walk' || m.st === 'grab' || m.st === 'hop' || m.st === 'shoved') || m.tame) continue; const k = depth(m.y), d = dist(m.x, m.y - 14 * TYPES[m.type].sc * k, x, y); if (d < (TYPES[m.type].r + 6) * k && d < bd) { bd = d; best = m; } }
  if (best) return shoo(g, best);
  for (const m of g.mons) { if (m.st !== 'perch') continue; const d = dist(m.x, m.y - 14, x, y); if (d < 44 && d < bd) { bd = d; best = m; } }
  if (best) return throwBanana(g, best);
  for (const b of g.baskets) if (dist(b.x, b.y - 10, x, y) < 42) { const add = Math.min(3, g.maxBan - g.bananas); g.bananas += add; b.life = 0; g.baskets = g.baskets.filter(o => o !== b); emit(g, { t: 'basket', x: b.x, y: b.y, add }); if (g.tut && g.tut.stage === 4) g.tut.stage = 5; return 'basket'; }
  emit(g, { t: 'miss', x, y }); return 'miss';
}
function end(g, won) {
  if (g.over) return; g.over = true; g.won = won; let bonus = 0;
  if (won) { bonus = 200 + g.lives * 100 + g.bananas * 10; g.score += bonus; }
  g.bonus = bonus; emit(g, { t: 'end', won, score: g.score, bonus });
}
// scripted tutorial. stages: 0 shoo slow monkey; 1 thief grabs HP; 2 thief on wall, feed it; 3 done feeding; 4 tap basket; 5 finished
function tutStep(g, dt) {
  const T = g.tut; T.t += dt;
  if (T.stage === 0 && !T.a) { T.a = spawn(g, { tgt: 0, type: 'biasa', sp: 24, from: 'side' }); }
  if (T.stage === 0 && T.a && T.a.st === 'flee') { T.stage = 1; T.t = 0; }
  if (T.stage === 1 && !T.b && T.t > 1.2) { T.b = spawn(g, { tgt: 1, type: 'biasa', sp: 120, from: 'side', tame: true }); g.bananas = 2; }
  if (T.stage === 1 && T.b && T.b.st === 'perch') { T.stage = 2; T.t = 0; }
  if (T.stage === 2 && T.b && (T.b.st === 'eat' || T.b.st === 'flee')) { T.stage = 3; T.t = 0; }
  if (T.stage === 3 && T.t > 1.2) { T.stage = 4; T.t = 0; g.baskets.push({ id: g.id++, x: 200, y: 600, t: 0, life: 1e9 }); }
  if (T.stage === 5) { T.t2 = (T.t2 || 0) + dt; if (T.t2 > 1.6) { T.stage = 6; g.over = true; g.won = true; emit(g, { t: 'tutdone' }); } }
  // keep the escaping/stealing fair in tutorial
  for (const m of g.mons) if (m.st === 'walk' && m.tgt === 0 && T.stage === 0) m.sp = 24;
}
// simple auto player for #demo and sim tests: returns [x,y] or null. skill 0..1
function bot(g, skill) {
  skill = skill == null ? 0.8 : skill;
  const walk = g.mons.filter(m => (m.st === 'walk' || m.st === 'grab' || m.st === 'shoved') && m.x > 0 && m.x < W && !m.tame);
  if (walk.length) {
    walk.sort((a, b) => (a.st === 'grab' ? -1 : 0) - (b.st === 'grab' ? -1 : 0) || dist(a.x, a.y, g.tour[a.tgt].x, g.tour[a.tgt].y) - dist(b.x, b.y, g.tour[b.tgt].x, g.tour[b.tgt].y));
    const m = walk[0], d = dist(m.x, m.y, g.tour[m.tgt].x, g.tour[m.tgt].y);
    if (m.st === 'grab' || d < lerp(40, 160, skill)) return [m.x + (g.R() - 0.5) * 10 * (1.4 - skill), m.y - 14];
  }
  const per = g.mons.filter(m => m.st === 'perch' && m.fed + m.pend < m.need).sort((a, b) => a.life - b.life || ITEMS[b.item].pts - ITEMS[a.item].pts);
  if (per.length && g.bananas > 0) { const m = per[0]; return [m.x, m.y - 14]; }
  if (g.baskets.length && g.bananas < 7) { const b = g.baskets[0]; return [b.x, b.y - 10]; }
  return null;
}
function clock(g) { const min = 16 * 60 + 30 + Math.floor(pct(g) * 120); return String(Math.floor(min / 60)).padStart(2, '0') + ':' + String(min % 60).padStart(2, '0'); }
const API = { depth, W, H, DUR, ITEMS, KINDS, SPOTS, PERCH, TYPES, rng, create, step, tap, bot, clock, pct, spawn, shoo, throwBanana, end };
root.MU = API; if (typeof module !== 'undefined') module.exports = API;
})(typeof window !== 'undefined' ? window : globalThis);

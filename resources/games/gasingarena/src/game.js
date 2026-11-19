/* Gasing Arena — top-spin physics in a bowl arena (host runs, clients predict + render) */
(function (root) {
  'use strict';
  const TAU = Math.PI * 2;
  const ARENA_R = 1, TOP_R = 0.075, RIM = ARENA_R - TOP_R;
  const COLORS = ['#d63a2f', '#2d7dd2', '#2f9e55', '#f0b429', '#8e44ad', '#e8772e'];
  const POWER_TYPES = ['boost', 'shield', 'heavy'];
  const AIM_LIMIT = 900; // 15 s at 60 Hz, then a top is thrown automatically (no stalls)

  function mulberry32(a) {
    return function () {
      let t = (a += 0x6d2b79f5);
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const len = (x, y) => Math.hypot(x, y);
  function norm(x, y) { const L = len(x, y) || 1; return [x / L, y / L]; }

  function makeTop(id, name, color, bot, design) {
    return {
      id, name: String(name || 'Pemain').slice(0, 24), color, bot: !!bot, design: design | 0,
      x: 0, y: 0, vx: 0, vy: 0, spin: 0, spin0: 1, angle: 0,
      alive: true, inArena: false, thrown: false, out: '', ax: 0, ay: 0, tq: -1, tw: 0,
      shield: 0, heavy: 0, boost: 0, wobble: 0, score: 0, wins: 0, botAt: 0
    };
  }
  // seat 0 spawns at the BOTTOM (player side, +y is down on screen)
  function spawnAngle(i, n) { return Math.PI / 2 + (i / Math.max(1, n)) * TAU; }

  function createMatch({ seed, players, rounds, target }) {
    const rnd = mulberry32((seed >>> 0) || 1);
    const tops = (players || []).slice(0, 6).map((p, i) => makeTop(p.id, p.name, COLORS[i % COLORS.length], p.bot, i));
    return { seed: seed >>> 0, rnd, phase: 'aim', round: 1, target: Math.max(1, (target || rounds || 3) | 0), maxRounds: Math.max(1, (target || rounds || 3) | 0), tick: 0, tops, powers: [], sparks: [], winnerId: null, hits: 0, tip: 0 };
  }

  function resetRound(m) {
    const n = m.tops.length;
    m.tops.forEach((t, i) => {
      const a = spawnAngle(i, n);
      t.x = Math.cos(a) * 0.74; t.y = Math.sin(a) * 0.74;
      t.vx = 0; t.vy = 0; t.spin = 0; t.spin0 = 1; t.angle = m.rnd() * TAU;
      t.alive = true; t.inArena = false; t.thrown = false; t.out = ''; t.tq = -1; t.tw = 0;
      // aim hint: toward the centre
      t.ax = -Math.cos(a); t.ay = -Math.sin(a);
      t.shield = 0; t.heavy = 0; t.boost = 0; t.wobble = 0;
      t.botAt = 45 + ((m.rnd() * 70) | 0);
    });
    m.powers = []; m.sparks = []; m.phase = 'aim'; m.tick = 0; m.winnerId = null;
  }

  // pull quality from the timing meter: 3 Perfect, 2 Great, 1 Good, 0 Bad (-1 = legacy analog power)
  const QUALITY = [
    { power: 0.42, spin: 15, wobble: 110, jitter: 0.28 }, // Bad: weak, wobbly, a bit off-line
    { power: 0.6, spin: 19, wobble: 35, jitter: 0.1 },    // Good: okay, slight wobble
    { power: 0.8, spin: 25, wobble: 0, jitter: 0 },       // Great: solid
    { power: 1.0, spin: 30, wobble: 0, jitter: 0 }        // Perfect: max speed + max spin
  ];
  const Q_PERFECT = 3;
  // timing meter: position 0..1..0 ping-pong; sweet spot at 0.5. Half-widths (distance from centre):
  // Perfect ±0.025 (5% of bar, ~31 ms), Great ±0.075 (15%), Good ±0.2 (40%), Bad = the rest (edges)
  const METER = { period: 1.25, perfect: 0.025, great: 0.075, good: 0.2 };
  function meterPos(sec) { const ph = ((sec / METER.period) % 1 + 1) % 1; return ph < 0.5 ? ph * 2 : 2 - ph * 2; }
  function judge(pos) { const d = Math.abs(pos - 0.5); return d <= METER.perfect ? 3 : d <= METER.great ? 2 : d <= METER.good ? 1 : 0; }

  function throwTop(m, id, dx, dy, power, quality, nojit) {
    const t = m.tops.find(q => q.id === id);
    if (!t || !t.alive || t.thrown || m.phase !== 'aim') return false;
    if (!(Math.abs(dx) + Math.abs(dy) > 1e-6) || !isFinite(dx) || !isFinite(dy)) { dx = -t.x; dy = -t.y; }
    let [nx, ny] = norm(dx, dy);
    const q = quality === 0 || quality === 1 || quality === 2 || quality === 3 ? quality : -1;
    let p, spin;
    if (q >= 0) {
      const Q = QUALITY[q]; p = Q.power; spin = Q.spin;
      if (Q.jitter && !nojit) { const j = (m.rnd() - 0.5) * 2 * Q.jitter, c = Math.cos(j), s = Math.sin(j); [nx, ny] = [nx * c - ny * s, nx * s + ny * c]; }
      t.tw = Q.wobble;
    } else { p = clamp(+power || 0, 0.15, 1); spin = 13 + p * 13; t.tw = 0; }
    const speed = 0.6 + p * 1.1;
    t.vx = nx * speed; t.vy = ny * speed; t.ax = nx; t.ay = ny;
    t.spin = spin; t.spin0 = q >= 0 ? QUALITY[Q_PERFECT].spin : t.spin; t.thrown = true; t.inArena = true; t.tq = q;
    return true;
  }
  function allThrown(m) { return m.tops.every(t => !t.alive || t.thrown); }

  function botAim(m, t) {
    let tx = -t.x, ty = -t.y, best = 1e9;
    for (const o of m.tops) {
      if (o === t || !o.alive) continue;
      const d = len(o.x - t.x, o.y - t.y);
      if (d < best) { best = d; tx = o.x - t.x; ty = o.y - t.y; }
    }
    const jitter = (m.rnd() - 0.5) * 0.5, c = Math.cos(jitter), s = Math.sin(jitter);
    const r = m.rnd(), q = r < 0.06 ? 3 : r < 0.3 ? 2 : r < 0.7 ? 1 : 0; // bots: 6% Perfect, 24% Great, 40% Good, 30% Bad
    throwTop(m, t.id, tx * c - ty * s, tx * s + ty * c, 0, q);
  }

  function spawnPower(m) {
    if (m.powers.length >= 2) return;
    const a = m.rnd() * TAU, r = 0.2 + m.rnd() * 0.5;
    m.powers.push({ id: 'p' + m.tick, type: POWER_TYPES[(m.rnd() * POWER_TYPES.length) | 0], x: Math.cos(a) * r, y: Math.sin(a) * r, life: 420 });
  }
  function addSpark(m, x, y, n, k) {
    for (let i = 0; i < n; i++) {
      const a = m.rnd() * TAU, sp = 0.4 + m.rnd() * 1.4;
      m.sparks.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 14 + ((m.rnd() * 12) | 0), k: k || 0 });
    }
    if (m.sparks.length > 80) m.sparks.splice(0, m.sparks.length - 80);
  }
  function knockOut(m, t, why) {
    t.alive = false; t.out = why; t.spin = Math.max(0, t.spin * 0.3);
    if (why === 'ring') { const [nx, ny] = norm(t.x, t.y); t.x = nx * (ARENA_R + 0.12); t.y = ny * (ARENA_R + 0.12); }
    t.vx = t.vy = 0; addSpark(m, t.x, t.y, 12, 1);
  }

  function step(m, dt) {
    dt = dt || 1 / 60;
    if (m.phase === 'matchend' || m.phase === 'roundend') return m;
    m.tick++;
    if (m.phase === 'aim') {
      for (const t of m.tops) {
        if (!t.alive || t.thrown) continue;
        if (m.client) { /* online guest prediction: bots + auto-throw are decided by the host only */ }
        else if (t.bot && m.tick > t.botAt) botAim(m, t);
        else if (m.tick > AIM_LIMIT) throwTop(m, t.id, -t.x, -t.y, 0, 0);
        t.angle += 0.02;
      }
      if (allThrown(m)) { m.phase = 'fight'; m.tick = 0; if (m.tip < 2) m.tip = 2; }
      return m;
    }
    if (m.tick % 200 === 90 && !m.client) spawnPower(m);
    for (const t of m.tops) {
      if (!t.alive) continue;
      // bowl: gentle pull to the centre, rolling friction, spin decay
      t.vx -= t.x * 0.85 * dt; t.vy -= t.y * 0.85 * dt;
      const fr = t.heavy > 0 ? 0.991 : 0.988; t.vx *= fr; t.vy *= fr;
      t.spin *= t.heavy > 0 ? 0.9985 : 0.9973;
      if (t.boost > 0) { t.boost--; t.spin += 0.02; }
      if (t.shield > 0) t.shield--; if (t.heavy > 0) t.heavy--;
      // precession: a spinning top drifts sideways a little
      const sp = len(t.vx, t.vy);
      if (sp > 0.05) { const k = 0.0009 * Math.min(1, t.spin / 10); const vx = t.vx; t.vx -= t.vy * k * 60 * dt; t.vy += vx * k * 60 * dt; }
      t.wobble = t.spin < 7 ? clamp((7 - t.spin) / 6, 0, 1) : 0;
      if (t.tw > 0) { t.wobble = Math.max(t.wobble, 0.85 * t.tw / 110); t.tw--; }
      if (t.wobble > 0) { t.vx += Math.sin(m.tick * 0.31 + t.design) * 0.012 * t.wobble; t.vy += Math.cos(m.tick * 0.27 + t.design) * 0.012 * t.wobble; }
      t.x += t.vx * dt; t.y += t.vy * dt; t.angle += t.spin * dt;
      const r = len(t.x, t.y);
      if (r > RIM) {
        const nx = t.x / r, ny = t.y / r, vr = t.vx * nx + t.vy * ny;
        if (vr > 1.05 && t.shield <= 0) knockOut(m, t, 'ring');
        else {
          t.x = nx * RIM; t.y = ny * RIM;
          if (vr > 0) { t.vx -= (1.55) * vr * nx; t.vy -= (1.55) * vr * ny; t.spin -= 0.5 + vr; addSpark(m, t.x, t.y, 4, 0); m.hits++; }
        }
      }
    }
    const falling = m.tops.filter(t => t.alive && t.spin < 1.6);
    if (falling.length) {
      const alive = m.tops.filter(t => t.alive).length;
      if (falling.length === alive) falling.sort((a, b) => b.spin - a.spin).shift();
      for (const t of falling) knockOut(m, t, 'fall');
    }
    // collisions
    const minD = TOP_R * 2;
    for (let i = 0; i < m.tops.length; i++) for (let j = i + 1; j < m.tops.length; j++) {
      const a = m.tops[i], b = m.tops[j];
      if (!a.alive || !b.alive) continue;
      const dx = b.x - a.x, dy = b.y - a.y, d = len(dx, dy);
      if (!(d > 0 && d < minD)) continue;
      const nx = dx / d, ny = dy / d, ov = (minD - d) / 2;
      a.x -= nx * ov; a.y -= ny * ov; b.x += nx * ov; b.y += ny * ov;
      const vn = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
      const ma = a.heavy > 0 ? 1.8 : 1, mb = b.heavy > 0 ? 1.8 : 1;
      // spinning tops repel each other: base kick + relative velocity
      let J = Math.max(0, vn) * 1.1 + 0.25 + (a.spin + b.spin) * 0.01;
      if (a.shield > 0 || b.shield > 0) J *= 0.6;
      const sa = J * mb / (ma + mb) * 2, sb = J * ma / (ma + mb) * 2;
      a.vx -= sa * nx; a.vy -= sa * ny; b.vx += sb * nx; b.vy += sb * ny;
      // the slower spinner loses more spin
      const tot = a.spin + b.spin + 0.01, loss = 0.8 + J * 2.2;
      const as0 = a.spin, bs0 = b.spin;
      a.spin -= loss * (bs0 / tot) * (a.shield > 0 ? 0.3 : 1) / ma;
      b.spin -= loss * (as0 / tot) * (b.shield > 0 ? 0.3 : 1) / mb;
      if (a.shield > 0) a.shield = Math.min(a.shield, 20); if (b.shield > 0) b.shield = Math.min(b.shield, 20);
      addSpark(m, (a.x + b.x) / 2, (a.y + b.y) / 2, 9, 0); m.hits++;
    }
    for (const p of m.powers) {
      p.life--;
      for (const t of m.tops) {
        if (!t.alive || p.life <= 0) continue;
        if (len(t.x - p.x, t.y - p.y) < TOP_R + 0.06) {
          if (p.type === 'boost') { t.spin = Math.min(t.spin0 * 1.15, t.spin + 7); t.boost = 120; t.vx *= 1.3; t.vy *= 1.3; }
          else if (p.type === 'shield') t.shield = 240;
          else t.heavy = 260;
          p.life = 0; addSpark(m, p.x, p.y, 12, 2);
        }
      }
    }
    m.powers = m.powers.filter(p => p.life > 0);
    m.sparks = m.sparks.filter(s => { s.life--; s.x += s.vx * 0.016; s.y += s.vy * 0.016; s.vx *= 0.9; s.vy *= 0.9; return s.life > 0; });
    const live = m.tops.filter(t => t.alive);
    if (m.client) return m; // guests never end a round locally; the host snapshot decides
    if (live.length <= 1 && m.tops.length > 1) {
      const w = live[0];
      if (w) { w.wins++; w.score += 1; m.winnerId = w.id; } else m.winnerId = null;
      m.phase = 'roundend';
      // race to score: first gasing to reach `target` round wins takes the match (draw rounds give nobody a point)
      if ((w && w.wins >= m.target) || m.round >= MAX_ROUNDS) m.phase = 'matchend';
    } else if (live.length === 0) { m.phase = 'matchend'; }
    return m;
  }

  const MAX_ROUNDS = 60; // safety cap only (endless draws)
  function matchWinner(m) { let best = null; for (const t of m.tops) if (!best || t.wins > best.wins) best = t; return best && best.wins > 0 ? best : null; }

  const f4 = v => Math.round(v * 1e4) / 1e4;
  function snapshot(m) {
    return {
      seed: m.seed, phase: m.phase, round: m.round, maxRounds: m.target, target: m.target, tick: m.tick, tip: m.tip, winnerId: m.winnerId, hits: m.hits,
      tops: m.tops.map(t => ({ id: t.id, name: t.name, color: t.color, bot: t.bot, design: t.design,
        x: f4(t.x), y: f4(t.y), vx: f4(t.vx), vy: f4(t.vy), spin: f4(t.spin), spin0: f4(t.spin0), angle: f4(t.angle % TAU), ax: f4(t.ax), ay: f4(t.ay), tq: t.tq | 0, tw: t.tw | 0,
        alive: t.alive, inArena: t.inArena, thrown: t.thrown, out: t.out, shield: t.shield | 0, heavy: t.heavy | 0, boost: t.boost | 0, wobble: f4(t.wobble), wins: t.wins | 0, score: t.score | 0, botAt: t.botAt | 0 })),
      powers: m.powers.map(p => ({ id: p.id, type: p.type, x: f4(p.x), y: f4(p.y), life: p.life | 0 }))
    };
  }
  function restore(snap) {
    if (!snap || !Array.isArray(snap.tops)) return null;
    const m = createMatch({ seed: (snap.seed + snap.tick * 7919) >>> 0, players: [], target: snap.target || snap.maxRounds });
    m.seed = snap.seed; m.phase = snap.phase; m.round = snap.round; m.tick = snap.tick; m.tip = snap.tip || 0; m.winnerId = snap.winnerId; m.hits = snap.hits || 0;
    m.tops = snap.tops.map(t => Object.assign(makeTop(t.id, t.name, t.color, t.bot, t.design), t));
    m.powers = (Array.isArray(snap.powers) ? snap.powers : []).map(p => Object.assign({}, p));
    m.sparks = [];
    return m;
  }
  function nextRound(m) { if (m.phase === 'matchend') return m; m.round++; resetRound(m); return m; }

  root.GAGame = { QUALITY, METER, meterPos, judge, spawnAngle, createMatch, resetRound, throwTop, step, snapshot, restore, nextRound, matchWinner, ARENA_R, TOP_R, COLORS, POWER_TYPES, AIM_LIMIT };
})(typeof globalThis !== 'undefined' ? globalThis : window);

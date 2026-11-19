// Balance probe: bot matches with v2 auto-fire (spread over free opponents), reports length + burst mix.
'use strict';
const D = require(process.env.SIM || '../src/sim.js');
function match(seed, n, levels) {
  const boards = Array.from({ length: n }, (_, i) => D.create(seed, { ch: D.CHARS[(i + seed) % 6] })), r = D.rng(seed), next = boards.map(() => 0);
  const gap = [2300, 1700, 1250], pend = []; let t = 0, hits = 0, blocked = 0;
  for (; t < 900000 && boards.filter(b => !b.out).length > 1; t += 50) {
    boards.forEach((b, i) => {
      if (b.out) return; next[i] -= 50;
      if (!b.fly && next[i] <= 0) { D.fire(b, D.botAim(b, levels[i], r)); next[i] = gap[levels[i]] * (0.8 + 0.4 * r()); }
      D.step(b, 50);
      if (b.q) { const plan = D.spread(b.q, boards.map((x, j) => ({ id: j, sc: x.sc, out: x.out || j === i, free: x.t >= x.imm }))); if (plan.length) { D.takeCharges(b); plan.forEach(([j, k], h) => pend.push({ at: t + 520, j, k, sk: b.ch, seed: seed + t + h })); } }
    });
    for (let p = pend.length - 1; p >= 0; p--) if (pend[p].at <= t) { const e = pend.splice(p, 1)[0]; const res = D.applySkill(boards[e.j], e.sk, e.seed, e.k); if (res.ok) hits++; else if (res.blocked) blocked++; }
  }
  const bursts = [0, 0, 0, 0]; boards.forEach(b => b.bursts.forEach((v, k) => bursts[k] += v));
  return { t, bursts, hits, blocked };
}
const N = +process.argv[2] || 40;
for (const n of [2, 3, 4]) {
  const ts = [], tot = [0, 0, 0, 0]; let hits = 0, bl = 0;
  for (let s = 1; s <= N; s++) { const lv = Array.from({ length: n }, (_, i) => (s + i) % 3); const m = match(s * 7919, n, lv); ts.push(m.t / 1000); m.bursts.forEach((v, k) => tot[k] += v); hits += m.hits; bl += m.blocked; }
  ts.sort((a, b) => a - b); const all = tot[1] + tot[2] + tot[3];
  console.log(n + 'p: median ' + ts[ts.length >> 1].toFixed(0) + 's, p10 ' + ts[Math.floor(ts.length * .1)].toFixed(0) + 's, p90 ' + ts[Math.floor(ts.length * .9)].toFixed(0) + 's | bursts/match ' + (all / N).toFixed(1) + ' (x1 ' + (100 * tot[1] / all).toFixed(0) + '% x2 ' + (100 * tot[2] / all).toFixed(0) + '% x3 ' + (100 * tot[3] / all).toFixed(0) + '%) | blocked ' + bl + '/' + (hits + bl));
}

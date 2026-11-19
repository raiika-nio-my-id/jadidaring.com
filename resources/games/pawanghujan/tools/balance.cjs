// Balance probe: idle survival and a greedy bot (cloud speed tiles/s as argv[2]).
require('../src/sim.js'); const P = globalThis.PH, sp = +(process.argv[2] || 3);
for (const seed of ['a', 'b', 'c', 'd']) { const s = P.create({ seed }); let t = 0; while (!s.over && t < 600) { P.step(s, 0.05); P.events(s); t += 0.05; } console.log('idle', seed, t.toFixed(1)); }
for (const seed of ['a', 'b', 'c', 'd']) {
  const s = P.create({ seed }); let t = 0;
  while (!s.over && t < 1200) {
    const fs = P.fires(s).sort((a, b) => b.fire - a.fire);
    s.clouds.forEach((c, i) => { const f = fs[i % Math.max(1, fs.length)]; if (f && c.w > 0) { const dx = f.x + .5 - c.x, dy = f.y + .5 - c.y, d = Math.hypot(dx, dy); if (d > .05) { const m = Math.min(d, sp * 0.05); c.x += dx / d * m; c.y += dy / d * m; } } });
    if (s.ritual.cool <= 0 && !s.ritual.holding && s.clouds.filter(c => c.w > 0.2).length < 2) P.ritualHold(s);
    if (s.ritual.holding && s.ritual.charge >= 0.9) P.ritualRelease(s);
    if (s.thunder && fs.length > 3 && s.clouds[0]) P.thunder(s, s.clouds[0].id);
    P.step(s, 0.05); P.events(s); t += 0.05;
  }
  console.log('bot', seed, t.toFixed(1), 'lv', s.level, 'out', s.out, 'score', P.finalScore(s), 'rb', s.rainbows);
}

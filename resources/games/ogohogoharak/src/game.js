/* Ogoh-Ogoh Arak: deterministic co-op rhythm logic (node-testable). window.OG */
(function (root) {
'use strict';
const BPM = 96, BEAT = Math.round(60000 / BPM), BAR = BEAT * 4, LEAD = 3600, NBARS = 24, MAXP = 6;
const WIN = { perfect: 100, good: 180, ok: 270 }; // t390u: wider, friendlier windows
const DESIGNS = [{ id: 0, name: 'Bhuta Merah', skin: '#d8432c', skin2: '#8e1f14', hair: '#f4efe6', cloth: 'poleng', eye: '#ffd23f' }, { id: 1, name: 'Raksasa Hijau', skin: '#3f9a4f', skin2: '#1d5a2a', hair: '#1a1410', cloth: 'emas', eye: '#ff5a3c' }, { id: 2, name: 'Naga Biru', skin: '#3a6fd8', skin2: '#1b3a86', hair: '#ffcf4a', cloth: 'poleng', eye: '#fff36a' }];
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
// bar types: j = jalan (tap 4 beats), L/R = putar di perempatan (tap that side on beats), h = hening (do not tap), f = finish (tap)
function route(seed, opts) {
  opts = opts || {}; const n = opts.bars || NBARS, R = rng(seed ^ 0x0A0A), t = new Array(n).fill('j');
  let k = 6 + Math.floor(R() * 2); // slower ramp: first turn later, turns spaced wider
  while (k < n - 2) { t[k] = R() < 0.5 ? 'L' : 'R'; k += 5 + Math.floor(R() * 3); }
  const free = t.map((x, i) => i).filter(i => i > 9 && i < n - 2 && t[i] === 'j' && t[i - 1] === 'j' && t[i + 1] === 'j');
  for (let q = 0; q < (opts.hening == null ? 2 : opts.hening) && free.length; q++) { const i = free.splice(Math.floor(R() * free.length), 1)[0]; t[i] = 'h'; for (let z = free.length - 1; z >= 0; z--) if (Math.abs(free[z] - i) < 3) free.splice(z, 1); }
  t[n - 1] = 'f'; return t;
}
// one player's taps → accuracy for bar n. taps: [{t (ms rel. to t0), d: -1|0|1}]
function judge(taps, n, type) {
  const b0 = n * BAR, beats = [0, 1, 2, 3].map(k => b0 + k * BEAT), want = type === 'L' ? -1 : type === 'R' ? 1 : 0;
  const mine = taps.filter(x => x.t >= b0 - WIN.ok && x.t < b0 + BAR - WIN.ok);
  if (type === 'h') return { acc: mine.length ? Math.max(0, 1 - mine.length * 0.25) : 1, hits: [], extra: mine.length };
  const used = new Set(), hits = [];
  for (const bt of beats) { let best = -1, bd = 1e9; mine.forEach((x, i) => { if (used.has(i)) return; const d = Math.abs(x.t - bt); if (d < bd) { bd = d; best = i; } });
    let v = 0; if (best >= 0 && bd <= WIN.ok) { used.add(best); v = bd <= WIN.perfect ? 1 : bd <= WIN.good ? 0.7 : 0.35; if (want && mine[best].d !== want) v = mine[best].d === 0 ? v * 0.6 : v * 0.3; } hits.push(v); }
  const extra = mine.length - used.size, acc = clamp(hits.reduce((a, b) => a + b, 0) / 4 - extra * 0.06, 0, 1);
  return { acc, hits, extra };
}
function botAcc(seed, n, b, skill) { const R = rng((seed ^ (n * 7919 + b * 104729 + 13)) >>> 0); R(); return clamp((skill == null ? 0.7 : skill) + (R() - 0.5) * 0.36 + (R() < 0.06 ? -0.35 : 0), 0, 1); }
// team accuracy for a bar: humans weight 2, bots 1; desync (spread) is punished
function team(hum, bots) {
  const xs = [], ws = []; for (const h of hum) { xs.push(h); ws.push(2); } for (const b of bots) { xs.push(b); ws.push(1); }
  if (!xs.length) return 0; const W = ws.reduce((a, b) => a + b, 0), m = xs.reduce((a, x, i) => a + x * ws[i], 0) / W, sd = Math.sqrt(xs.reduce((a, x, i) => a + ws[i] * (x - m) * (x - m), 0) / W);
  return clamp(m - 0.2 * sd, 0, 1);
}
// replay sealed bars → float state
function sim(sealed, types, opts) {
  opts = opts || {}; let bal = 1, drops = 0, score = 0, sum = 0, n = 0, perfect = 0, turnsOk = 0, lastDrop = -9; const ev = [];
  for (let i = 0; i < sealed.length; i++) { let a = sealed[i]; if (a == null) break; if (i < 2) a = Math.max(a, 0.6); /* warm-up bars never hurt */ const ty = types[i] || 'j';
    const w = ty === 'L' || ty === 'R' ? 0.6 : 0.5; bal = clamp(bal + (a - 0.55) * (a < 0.55 ? w * 2.6 : w), 0, 1); sum += a; n++; score += Math.round(a * 100 * (ty === 'f' ? 2 : 1)); if (a >= 0.85) perfect++;
    if ((ty === 'L' || ty === 'R') && a >= 0.55) turnsOk++;
    if (bal <= 0 && !opts.noDrop) { drops++; bal = 0.7; lastDrop = i; ev.push({ t: 'drop', bar: i }); }
    if (drops >= 3) return { bal, drops, score, avg: sum / n, bars: n, perfect, turnsOk, lastDrop, over: true, win: false, ev };
  }
  const over = n >= types.length, avg = n ? sum / n : 0;
  return { bal, drops, score: over ? score + (3 - drops) * 150 : score, avg, bars: n, perfect, turnsOk, lastDrop, over, win: over, stars: over ? (avg >= 0.8 ? 3 : avg >= 0.66 ? 2 : 1) : 0, ev };
}
const barAt = ms => Math.floor(ms / BAR), beatAt = ms => Math.floor(ms / BEAT);
const API = { BPM, BEAT, BAR, LEAD, NBARS, MAXP, WIN, DESIGNS, rng, route, judge, botAcc, team, sim, barAt, beatAt, clamp };
root.OG = API; if (typeof module !== 'undefined') module.exports = API;
})(typeof window !== 'undefined' ? window : globalThis);

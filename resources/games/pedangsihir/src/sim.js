/* Pedang Sihir Perisai: pure rules (deterministic), CPU ladder brains, SHA-256 for the hidden-pick commit/reveal. */
(function (root) {
'use strict';
/* 0 = Pedang (sword), 1 = Sihir (magic), 2 = Perisai (barrier).  Perisai > Sihir, Sihir > Pedang, Pedang > Perisai. */
const KINDS = ['pedang', 'sihir', 'perisai'];
const beats = (a, b) => b === (a + 2) % 3;
const preyOf = a => (a + 2) % 3;      // the kind that a beats
const counterOf = b => (b + 1) % 3;   // the kind that beats b
const HP_CHOICES = [3, 5, 7];
const cleanHp = v => (HP_CHOICES.includes(Number(v)) ? Number(v) : 5);
/**
 * One clash. picks = [[id, k]] with k = 0..2, or -1 = no pick in time.
 * Exactly 2 kinds picked → everyone on the losing kind takes dmg.lose. 1 or 3 kinds → draw.
 * No pick in time → dmg.timeout for that player, even when nobody picked (never better than picking: stalling can't pay);
 * a hidden pick that is never revealed costs dmg.noReveal (more than losing: withholding to spoil a clash can't pay).
 */
function resolve(picks, dmg) {
  const D = Object.assign({ lose: 1, timeout: 1, noReveal: 2 }, dmg || {});
  const chosen = picks.filter(p => p[1] >= 0 && p[1] <= 2), kinds = [...new Set(chosen.map(p => p[1]))].sort();
  const out = { res: 'none', wk: -1, lk: -1, dmg: [], late: picks.filter(p => !(p[1] >= 0 && p[1] <= 2)).map(p => p[0]) };
  for (const p of picks) if (out.late.includes(p[0])) out.dmg.push([p[0], Math.max(0, (p[1] === -2 ? D.noReveal : D.timeout) | 0)]);
  if (!chosen.length) out.res = 'none';
  else if (kinds.length === 2) {
    const [a, b] = kinds, w = beats(a, b) ? a : b, l = w === a ? b : a;
    out.res = 'win'; out.wk = w; out.lk = l;
    for (const p of chosen) if (p[1] === l) out.dmg.push([p[0], Math.max(0, D.lose | 0)]);
  } else out.res = kinds.length === 3 ? 'draw3' : 'same';
  out.dmg = out.dmg.filter(x => x[1] > 0);
  return out;
}
/** apply a resolution to hp pairs [[id, hp]] → {hp, ko: ids that reached 0 now} */
function applyDamage(hp, r) {
  const next = hp.map(x => [x[0], x[1]]), ko = [];
  for (const [id, d] of r.dmg) { const e = next.find(x => x[0] === id); if (!e || e[1] <= 0) continue; e[1] = Math.max(0, e[1] - d); if (e[1] === 0) ko.push(id); }
  return { hp: next, ko };
}
/** announcer line for n eliminated in one clash */
const killWord = n => (n >= 4 ? 'quad' : n === 3 ? 'triple' : n === 2 ? 'double' : n === 1 ? 'kill' : '');
/* ---------- deterministic rng ---------- */
function rng(seed) { let a = seed >>> 0 || 1; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const pickOf = (r, n) => Math.floor(r() * n) % n;
/* ---------- CPU ladder ----------
   Every opponent has a habit (a readable "tell"), plus a share of pattern-reading that grows each opponent, plus noise.
   history = [{ me: k|-1, cpu: k, res: 'win'|'lose'|'draw' }] seen from the human; res is the human's result. */
const CPUS = ['kroco', 'besi', 'peniru', 'kabut', 'pembalas', 'tembok', 'putar', 'licik', 'cermin', 'raja'];
const HABIT = { kroco: 'random', besi: 'fav0', peniru: 'copy', kabut: 'fav1', pembalas: 'counter', tembok: 'fav2', putar: 'cycle', licik: 'double', cermin: 'winstay', raja: 'read' };
function cpuFor(i) { const key = CPUS[i % CPUS.length]; return { key, habit: HABIT[key], level: i, lap: Math.floor(i / CPUS.length) }; }
function mix(level, habit) {
  if (habit === 'random') return { habit: 0, read: 0 };
  if (habit === 'read') return { habit: 0, read: Math.min(0.62, 0.42 + 0.02 * level) };
  return { habit: Math.max(0.34, 0.74 - 0.035 * level), read: Math.min(0.4, 0.05 * level) };
}
/** predict the human's next pick from their history (order-1 transitions, else overall frequency); -1 = no idea */
function predict(history) {
  const mine = history.map(h => h.me).filter(k => k >= 0); if (mine.length < 2) return mine.length ? mine[0] : -1;
  const last = mine[mine.length - 1], next = [0, 0, 0], freq = [0, 0, 0];
  for (let i = 0; i < mine.length; i++) { freq[mine[i]] += 1 + i / mine.length; if (i && mine[i - 1] === last) next[mine[i]] += 1 + i / mine.length; }
  const pool = next.some(Boolean) ? next : freq, top = Math.max(...pool);
  return pool.indexOf(top);
}
function habitPick(habit, history, r) {
  const last = history[history.length - 1];
  switch (habit) {
    case 'fav0': return 0; case 'fav1': return 1; case 'fav2': return 2;
    case 'copy': return last && last.me >= 0 ? last.me : pickOf(r, 3);
    case 'counter': return last && last.me >= 0 ? counterOf(last.me) : pickOf(r, 3);
    case 'cycle': return last ? (last.cpu + 1) % 3 : pickOf(r, 3);
    case 'double': return last ? counterOf(counterOf(last.cpu)) : pickOf(r, 3); // expects you to counter its last pick, and counters that
    case 'winstay': return !last ? pickOf(r, 3) : last.res === 'lose' ? last.cpu : last.me >= 0 ? counterOf(last.me) : last.cpu;
    default: return pickOf(r, 3);
  }
}
function cpuPick(cpu, history, r) {
  const m = mix(cpu.level, cpu.habit), x = r();
  if (x < m.read) { const p = predict(history); if (p >= 0) return counterOf(p); }
  if (x < m.read + m.habit) return habitPick(cpu.habit, history, r);
  return pickOf(r, 3);
}
/* ---------- SHA-256 (sync, tiny) for commit = H(round:id:kind:salt) ---------- */
const K256 = new Uint32Array([0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2]);
function sha256(str) {
  const msg = new TextEncoder().encode(String(str)), l = msg.length, n = ((l + 9 + 63) >> 6) << 6, b = new Uint8Array(n); b.set(msg); b[l] = 0x80;
  const dv = new DataView(b.buffer); dv.setUint32(n - 4, (l * 8) >>> 0); dv.setUint32(n - 8, Math.floor(l / 0x20000000));
  const H = new Uint32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]), W = new Uint32Array(64);
  const rr = (x, k) => (x >>> k) | (x << (32 - k));
  for (let o = 0; o < n; o += 64) {
    for (let i = 0; i < 16; i++) W[i] = dv.getUint32(o + i * 4);
    for (let i = 16; i < 64; i++) { const s0 = rr(W[i - 15], 7) ^ rr(W[i - 15], 18) ^ (W[i - 15] >>> 3), s1 = rr(W[i - 2], 17) ^ rr(W[i - 2], 19) ^ (W[i - 2] >>> 10); W[i] = (W[i - 16] + s0 + W[i - 7] + s1) >>> 0; }
    let [a, bb, c, d, e, f, g, h] = H;
    for (let i = 0; i < 64; i++) {
      const t1 = (h + (rr(e, 6) ^ rr(e, 11) ^ rr(e, 25)) + ((e & f) ^ (~e & g)) + K256[i] + W[i]) >>> 0, t2 = ((rr(a, 2) ^ rr(a, 13) ^ rr(a, 22)) + ((a & bb) ^ (a & c) ^ (bb & c))) >>> 0;
      h = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = bb; bb = a; a = (t1 + t2) >>> 0;
    }
    H[0] += a; H[1] += bb; H[2] += c; H[3] += d; H[4] += e; H[5] += f; H[6] += g; H[7] += h;
  }
  return Array.from(H, x => x.toString(16).padStart(8, '0')).join('');
}
const commitOf = (n, id, k, salt) => sha256(n + ':' + id + ':' + k + ':' + salt).slice(0, 32);

root.PS = { KINDS, beats, preyOf, counterOf, HP_CHOICES, cleanHp, resolve, applyDamage, killWord, rng, pickOf, CPUS, HABIT, cpuFor, mix, predict, habitPick, cpuPick, sha256, commitOf };
})(typeof window !== 'undefined' ? window : globalThis);

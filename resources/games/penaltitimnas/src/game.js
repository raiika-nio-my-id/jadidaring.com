/* Penalti Timnas rules (pure, deterministic): shot = {x, y, p} aim on goal plane (x -1..1 posts, y 0..1 bar) + power 0..1.3,
   dive = {x, y} keeper guess. resolve() -> outcome. Match = 5 kicks each alternating, then sudden death (max 10 rounds), early finish when decided. */
(function (root) {
'use strict';
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const gauss = r => { let u = 0, v = 0; while (!u) u = r(); while (!v) v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
const POST = 0.045; // post thickness in goal units
const KITS = [
  { id: 'merah', n: 'Garuda Merah', a: '#d7192a', b: '#ffffff', c: '#fff' },
  { id: 'putih', n: 'Putih Away', a: '#f5f5f0', b: '#d7192a', c: '#d7192a' },
  { id: 'biru', n: 'Biru Samudra', a: '#1d4fb8', b: '#ffd23f', c: '#fff' },
  { id: 'hijau', n: 'Hijau Kampung', a: '#13915a', b: '#ffffff', c: '#fff' },
];
const kitOf = id => KITS.find(k => k.id === id) || KITS[0];
const BOTS = [
  { n: 'Ucup FC', skill: 0.35, read: 0.15, kit: 'hijau' }, { n: 'Persikampung', skill: 0.5, read: 0.3, kit: 'biru' },
  { n: 'Gajah Putih', skill: 0.65, read: 0.45, kit: 'putih' }, { n: 'Badai Timur', skill: 0.78, read: 0.55, kit: 'biru' },
];
/** shot + dive -> outcome. seed adds the scatter (power overshoot / mishit). */
function resolve(shot, dive, seed) {
  const r = rng(seed || 1), p = clamp(+shot.p || 0, 0, 1.4);
  const sig = 0.035 + 0.16 * Math.max(0, p - 0.88) + 0.05 * Math.max(0, 0.3 - p);
  let x = clamp(+shot.x || 0, -1.8, 1.8) + gauss(r) * sig, y = clamp(+shot.y || 0, -0.1, 1.8) + gauss(r) * sig * 0.8 + Math.max(0, p - 0.95) * 1.4;
  y = Math.max(0.02, y);
  const kx = clamp(+dive.x || 0, -1, 1), ky = clamp(+dive.y || 0.3, 0, 1);
  const speed = 0.55 + 0.6 * Math.min(p, 1.1); // goal units per 0.1 s-ish (only for anim + reach)
  let out;
  const ax = Math.abs(x);
  if (ax > 1 + POST || y > 1 + POST) out = y > 1 + POST && ax <= 1.15 ? 'over' : ax > 1 + POST && y <= 1.1 ? 'wide' : 'over';
  else if (ax > 1 - POST * 0.2 || y > 1 - POST * 0.2) out = y > 1 - POST * 0.2 && ax < 1 - POST ? 'bar' : 'post';
  else out = 'in';
  let saved = false, reach = 0, dist = 0;
  if (out === 'in') {
    const corner = ax > 0.72 && (y > 0.66 || y < 0.16);
    reach = (0.43 + 0.3 * clamp(1 - p, 0, 0.8)) * (corner ? 0.72 : 1) * (Math.abs(kx) < 0.25 ? 0.85 : 1);
    dist = Math.hypot(x - kx, (y - ky) * 1.25);
    if (dist < reach) saved = true;
    else if (Math.abs(kx) < 0.25 && Math.abs(x) < 0.3 && y < 0.7) saved = true; // blasted straight at a keeper who stayed
    out = saved ? 'save' : 'goal';
  }
  return { out, goal: out === 'goal', x, y, kx, ky, p, speed, reach, dist };
}
const LABEL = { goal: 'GOOOL!', save: 'DITEPIS!', post: 'TIANG!', bar: 'MISTAR!', wide: 'MELEBAR!', over: 'MELAMBUNG!' };
/** match state from results: res = [bool goal per kick], kick n: side n%2 kicks */
function tally(res) {
  const a = [], b = []; res.forEach((g, i) => (i % 2 ? b : a).push(!!g));
  const sa = a.filter(Boolean).length, sb = b.filter(Boolean).length, n = res.length;
  let done = false, win = -1;
  if (n <= 10) {
    const leftA = 5 - a.length, leftB = 5 - b.length;
    if (sa > sb + leftB || sb > sa + leftA) done = true;
    if (n === 10 && sa !== sb) done = true;
  } else if (n % 2 === 0 && sa !== sb) done = true;
  if (n >= 20 && n % 2 === 0 && !done) done = true; // safety: 10 rounds -> by last kick (coin)
  if (done) win = sa > sb ? 0 : sb > sa ? 1 : (res[n - 1] ? 1 : 0);
  return { a, b, sa, sb, done, win, round: Math.floor(n / 2), sudden: n >= 10 };
}
/** bot picks */
function botShot(skill, r) {
  const zx = [-0.82, -0.5, 0, 0.5, 0.82][Math.floor(r() * 5)], zy = [0.18, 0.5, 0.82][Math.floor(r() * 3)];
  const wob = (1 - skill) * 0.35;
  return { x: zx + gauss(r) * wob, y: zy + gauss(r) * wob * 0.7, p: clamp(0.62 + skill * 0.2 + gauss(r) * (0.18 - skill * 0.12), 0.3, 1.2) };
}
function botDive(read, history, r) {
  // reads the kicker: leans to the side the human used most
  if (history && history.length >= 2 && r() < read) { const mx = history.reduce((s, h) => s + h.x, 0) / history.length, my = history.reduce((s, h) => s + h.y, 0) / history.length; const side = history.reduce((s, h) => s + Math.sign(h.x), 0); return { x: clamp((side ? Math.sign(side) * 0.66 : mx) + (r() - 0.5) * 0.3, -1, 1), y: clamp(my, 0.1, 0.9) }; }
  const opts = [{ x: -0.7, y: 0.25 }, { x: -0.7, y: 0.7 }, { x: 0, y: 0.35 }, { x: 0.7, y: 0.25 }, { x: 0.7, y: 0.7 }, { x: -0.4, y: 0.5 }, { x: 0.4, y: 0.5 }];
  return opts[Math.floor(r() * opts.length)];
}
root.PT = { rng, resolve, tally, botShot, botDive, KITS, kitOf, BOTS, LABEL, clamp, POST };
if (typeof module !== 'undefined') module.exports = root.PT;
})(typeof window !== 'undefined' ? window : globalThis);

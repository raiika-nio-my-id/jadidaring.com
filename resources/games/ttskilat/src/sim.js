/* TTS Kilat: crossword generator + puzzle state (pure logic, no DOM). window.TTSSim */
(function (root) {
'use strict';
const BANK = root.TTSBank;
function rng(seed) { let s = (seed >>> 0) || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
function hash(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h >>> 0; }
const PACKS = [
  { id: 'campur', n: 'Campur Sari', cats: '', icon: '🎲', d: 'Semua tema dicampur' },
  { id: 'kuliner', n: 'Kuliner Nusantara', cats: 'M', icon: '🍛', d: 'Makanan, buah, rempah' },
  { id: 'fauna', n: 'Fauna', cats: 'H', icon: '🐘', d: 'Hewan Indonesia & dunia' },
  { id: 'alam', n: 'Alam & Geografi', cats: 'G', icon: '🌋', d: 'Gunung, pulau, kota, langit' },
  { id: 'budaya', n: 'Budaya Indonesia', cats: 'K', icon: '🎭', d: 'Tari, musik, kain, hari raya' },
  { id: 'sekolah', n: 'Sekolah & Sains', cats: 'ST', icon: '🔬', d: 'IPA, matematika, tubuh' },
  { id: 'harian', n: 'Sehari-hari', cats: 'BUXO', icon: '🏠', d: 'Rumah, keluarga, kendaraan, olahraga' }
];
const PER_PACK = 15;
function levelSpec(pi, li) {
  const P = PACKS[pi];
  return { seed: hash('pack:' + P.id + ':' + li), cats: P.cats, count: 6 + Math.floor(li / 2), maxDiff: li < 4 ? 1 : li < 8 ? 2 : 3, maxW: li < 6 ? 9 : 10, maxH: li < 6 ? 9 : 11 };
}
function dailySpec(dateKey) { return { seed: hash('harian:' + dateKey), cats: '', count: 10, maxDiff: 2, maxW: 10, maxH: 11 }; }

/** core generator: freeform crossword from a word list [[ans, clue], ...] */
function build(list, o) {
  const R = rng(o.seed), maxW = o.maxW || 10, maxH = o.maxH || 11, target = o.count || 10;
  let best = null;
  for (let attempt = 0; attempt < (o.tries || 24); attempt++) {
    const pool = list.slice(); for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
    const grid = new Map(), dirAt = new Map(), placed = []; let bx0 = 0, by0 = 0, bx1 = -1, by1 = -1;
    const key = (x, y) => x + ',' + y;
    const put = (w, x, y, d) => { const dx = d ? 0 : 1, dy = d ? 1 : 0; for (let k = 0; k < w[0].length; k++) { const kk = key(x + k * dx, y + k * dy); grid.set(kk, w[0][k]); dirAt.set(kk, (dirAt.get(kk) || 0) | (d ? 2 : 1)); } placed.push({ ans: w[0], clue: w[1], x, y, dir: d }); bx0 = Math.min(bx0, x); by0 = Math.min(by0, y); bx1 = Math.max(bx1, x + dx * (w[0].length - 1)); by1 = Math.max(by1, y + dy * (w[0].length - 1)); };
    // first word: a mid-length one, across
    let fi = pool.findIndex(w => w[0].length >= 5 && w[0].length <= Math.min(8, maxW)); if (fi < 0) fi = 0;
    const first = pool.splice(fi, 1)[0]; bx1 = -1; put(first, 0, 0, attempt % 3 === 2 ? 1 : 0);
    if (placed[0].dir === 1 && first[0].length > maxH) continue;
    let progress = true;
    while (placed.length < target && progress) {
      progress = false; let cand = null;
      for (let pi = 0; pi < pool.length && pi < 160; pi++) {
        const w = pool[pi], a = w[0], L = a.length;
        if (placed.some(p => p.ans === a)) continue;
        for (const [kk, ch] of grid) {
          for (let i = 0; i < L; i++) {
            if (a[i] !== ch) continue; const [cx, cy] = kk.split(',').map(Number), used = dirAt.get(kk);
            for (const d of [0, 1]) {
              if (used & (d ? 2 : 1)) continue; const dx = d ? 0 : 1, dy = d ? 1 : 0, sx = cx - i * dx, sy = cy - i * dy, ex = sx + dx * (L - 1), ey = sy + dy * (L - 1);
              const nx0 = Math.min(bx0, sx), ny0 = Math.min(by0, sy), nx1 = Math.max(bx1, ex), ny1 = Math.max(by1, ey);
              if (nx1 - nx0 + 1 > maxW || ny1 - ny0 + 1 > maxH) continue;
              if (grid.has(key(sx - dx, sy - dy)) || grid.has(key(ex + dx, ey + dy))) continue;
              let ok = true, cross = 0;
              for (let k = 0; k < L && ok; k++) {
                const x = sx + k * dx, y = sy + k * dy, g = grid.get(key(x, y));
                if (g) { if (g !== a[k] || (dirAt.get(key(x, y)) & (d ? 2 : 1))) ok = false; else cross++; }
                else if (grid.has(key(x + dy, y + dx)) || grid.has(key(x - dy, y - dx))) ok = false;
              }
              if (!ok || !cross) continue;
              const area = (nx1 - nx0 + 1) * (ny1 - ny0 + 1), sc = cross * 30 - area * 0.35 + L * 2 + R() * 12;
              if (!cand || sc > cand.sc) cand = { w, sx, sy, d, sc, pi };
            }
          }
        }
        if (cand && pi > 40) break;
      }
      if (cand) { put(cand.w, cand.sx, cand.sy, cand.d); pool.splice(cand.pi, 1); progress = true; }
    }
    let crosses = 0; for (const v of dirAt.values()) if (v === 3) crosses++;
    const q = placed.length * 100 + crosses * 8 - (bx1 - bx0 + 1) * (by1 - by0 + 1) * 0.2;
    if (!best || q > best.q) best = { q, placed: placed.map(p => Object.assign({}, p)), bx0, by0, bx1, by1 };
    if (placed.length >= target && attempt >= 3) break;
  }
  const W = best.bx1 - best.bx0 + 1, H = best.by1 - best.by0 + 1, sol = new Array(W * H).fill(null);
  for (const p of best.placed) { p.x -= best.bx0; p.y -= best.by0; for (let k = 0; k < p.ans.length; k++) sol[(p.y + (p.dir ? k : 0)) * W + p.x + (p.dir ? 0 : k)] = p.ans[k]; }
  // numbering in reading order
  const starts = [...new Set(best.placed.map(p => p.y * W + p.x))].sort((a, b) => a - b), num = new Map(starts.map((s, i) => [s, i + 1]));
  const words = best.placed.map(p => ({ num: num.get(p.y * W + p.x), dir: p.dir, x: p.x, y: p.y, ans: p.ans, clue: p.clue, cells: Array.from(p.ans, (_, k) => (p.y + (p.dir ? k : 0)) * W + p.x + (p.dir ? 0 : k)) }));
  words.sort((a, b) => a.dir - b.dir || a.num - b.num);
  const nums = new Array(W * H).fill(0); for (const [s, n] of num) nums[s] = n;
  return { w: W, h: H, sol, nums, words, seed: o.seed };
}
function pickList(o) {
  return BANK.filter(b => (!o.cats || o.cats.includes(b[2])) && b[3] <= (o.maxDiff || 3)).map(b => [b[0], b[1]]);
}
function generate(o) { return build(pickList(o), o); }

/* ---------- play state ---------- */
function start(pz) { return { pz, fill: pz.sol.map(c => c ? '' : null), rev: pz.sol.map(() => 0), bad: pz.sol.map(() => 0), hints: 0, checks: 0, t: 0, done: false, wordsDone: new Set() }; }
function wordsAt(pz, idx) { return pz.words.filter(w => w.cells.includes(idx)); }
function isWordFilled(st, w) { return w.cells.every(c => st.fill[c] === st.pz.sol[c]); }
function setLetter(st, idx, ch) { if (st.done || st.pz.sol[idx] == null || st.rev[idx]) return false; st.fill[idx] = ch; st.bad[idx] = 0; return true; }
function newlySolved(st) { const out = []; for (let i = 0; i < st.pz.words.length; i++) if (!st.wordsDone.has(i) && isWordFilled(st, st.pz.words[i])) { st.wordsDone.add(i); out.push(i); } return out; }
function solved(st) { return st.pz.sol.every((c, i) => c == null || st.fill[i] === c); }
function revealCell(st, idx) { if (st.pz.sol[idx] == null || st.rev[idx] || st.fill[idx] === st.pz.sol[idx]) return false; st.fill[idx] = st.pz.sol[idx]; st.rev[idx] = 1; st.bad[idx] = 0; st.hints++; return true; }
function revealWord(st, w) { let n = 0; for (const c of w.cells) if (st.fill[c] !== st.pz.sol[c]) { st.fill[c] = st.pz.sol[c]; st.rev[c] = 1; st.bad[c] = 0; n++; } if (n) st.hints += Math.max(2, Math.ceil(n * 0.75)); return n; }
function check(st) { let wrong = 0; st.pz.sol.forEach((c, i) => { if (c && st.fill[i] && st.fill[i] !== c) { st.bad[i] = 1; wrong++; } }); st.checks++; return wrong; }
function stars(st) { return st.hints === 0 && st.checks === 0 ? 3 : st.hints <= 3 ? 2 : 1; }
function points(st) { const letters = st.pz.sol.filter(Boolean).length, base = letters * 10, speed = Math.max(0, Math.round((letters * 9 - st.t) * 3)); return Math.max(letters * 2, base + speed - st.hints * 25 - st.checks * 10); }

root.TTSSim = { PACKS, PER_PACK, levelSpec, dailySpec, generate, build, pickList, hash, rng, start, wordsAt, isWordFilled, setLetter, newlySolved, solved, revealCell, revealWord, check, stars, points };
})(typeof window !== 'undefined' ? window : globalThis);

/* Lanjut Kata: pure game rules (no DOM). Works in the browser (window.LK) and in node (globalThis.LK).
   State lives in the room `state` (public). Everything here is deterministic given (state, input, now, rnd). */
(function (root) {
'use strict';
const VERSION = 1;
const MAX_SEATS = 8, CHAIN_KEEP = 12, MIN_LEN = 3, MAX_LEN = 24, START_MS = 3000;
const TIMERS = [10, 15, 20], TURNS = [3, 5, 7, 10, 0], MODES = ['huruf', 'suku'], LANGS = ['id', 'en', 'mix'];
const DEFAULT_SET = { mode: 'huruf', timer: 15, turns: 5, lang: 'id', strict: 0 };
const VOW = 'aeiou';
/* turns 0 = unlimited ("Tak terbatas"): no turn cap; a timeout / Lewati / wrong word (giliran lewat) knocks the player out,
   the last player standing wins. The match also ends when no unused dictionary word can continue the chain. */
const unlimited = s => !!s && !!s.set && s.set.turns === 0;

/* ---------- dictionary ---------- */
let DICT = null;
function loadWords(w) {
  const mk = (l) => { const x = w[l] || {}, bot = String(x.bot || '').split(' ').filter(Boolean), more = String(x.more || '').split(' ').filter(Boolean).concat(unfc(x.fc)); return { bot, all: new Set(bot.concat(more)) }; };
  const id = mk('id'), en = mk('en');
  DICT = { id, en, mix: { bot: Array.from(new Set(id.bot.concat(en.bot))), all: new Set([...id.all, ...en.all]) } };
  return DICT;
}
/** front-coded sorted list: each entry = chr(48 + shared prefix length) + rest of the word (lowercase) */
function unfc(str) { const out = []; str = String(str || ''); let prev = '', i = 0; while (i < str.length) { const k = str.charCodeAt(i) - 48; let j = i + 1; while (j < str.length && str[j] >= 'a' && str[j] <= 'z') j++; prev = prev.slice(0, k) + str.slice(i + 1, j); out.push(prev); i = j; } return out; }
function dict(lang) { if (!DICT) loadWords(root.LK_WORDS || {}); return DICT[lang] || DICT.id; }
function inDict(w, lang) { return dict(lang).all.has(w); }

/* ---------- text helpers ---------- */
function norm(raw) { return String(raw == null ? '' : raw).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z]/g, ''); }
function isV(w, i) {
  const c = w[i]; if (VOW.includes(c)) return true;
  if (c === 'y') { const p = w[i - 1], n = w[i + 1]; return i > 0 && !!p && !VOW.includes(p) && p !== 'y' && !(n && VOW.includes(n)); }
  return false;
}
/** letters-only, ≥3, has a vowel, no aaa-style spam, ≥2 distinct letters, no 6+ consonant run */
function plausible(w) {
  if (!w || w.length < MIN_LEN || w.length > MAX_LEN) return false;
  if (!/[aeiouy]/.test(w) || /(.)\1\1/.test(w) || new Set(w).size < 2 || /[^aeiouy]{6,}/.test(w)) return false;
  if (/^(.{1,3})\1{2,}$/.test(w)) return false; // hahaha, lololo
  return true;
}

/* ---------- syllables (practical heuristic) ----------
   1. Nuclei = vowel groups (a e i o u, plus y when it sits between consonants / at the end).
      Indonesian splits vowel pairs except the diphthongs ai au oi ei (bu-ah, di-a, pan-tai). English keeps a group (rea-dy).
      English: a final silent "e" (ma-ke → make) and "-ed" not after t/d are not nuclei.
   2. Consonants between two nuclei: one → goes to the next syllable (ma-kan); two or more → the last one goes
      to the next syllable, unless the last two form an onset (ng ny kh sy + tr pr kr br gr dr pl bl kl fl;
      English also ch sh th ph wh st sp sk sc sl sm sn sw cl cr fr gl tw) → those two move together (ba-ngun, ka-ntor→kan-tor).
   The last syllable is everything from the onset of the last nucleus to the end (ma-kan → "kan"). */
const DIPH_ID = ['ai', 'au', 'oi', 'ei'];
const ONSET_ID = ['ng', 'ny', 'kh', 'sy', 'tr', 'pr', 'kr', 'br', 'gr', 'dr', 'pl', 'bl', 'kl', 'fl'];
const ONSET_EN = ['ch', 'sh', 'th', 'ph', 'wh', 'tr', 'pr', 'kr', 'br', 'gr', 'dr', 'pl', 'bl', 'kl', 'fl', 'st', 'sp', 'sk', 'sc', 'sl', 'sm', 'sn', 'sw', 'cl', 'cr', 'fr', 'gl', 'tw', 'qu'];
function nuclei(w, en) {
  const out = []; let i = 0;
  while (i < w.length) {
    if (!isV(w, i)) { i++; continue; }
    let j = i + 1;
    if (en) { while (j < w.length && isV(w, j)) j++; }
    else if (j < w.length && isV(w, j) && DIPH_ID.includes(w.slice(i, j + 1)) && !(j + 1 < w.length && isV(w, j + 1))) j++;
    out.push([i, j]); i = j;
  }
  if (en && out.length > 1) {
    const L = out[out.length - 1], n = w.length;
    if (L[0] === n - 1 && w[n - 1] === 'e' && L[1] === n && !isV(w, n - 2) && !/[^aeiou]le$/.test(w)) out.pop();
    else if (L[0] === n - 2 && w.slice(n - 2) === 'ed' && !/[td]ed$/.test(w)) out.pop();
    else if (L[0] === n - 2 && w.slice(n - 2) === 'es' && !/(s|x|z|ch|sh|ge|ce)es$/.test(w) && !isV(w, n - 3)) out.pop();
  }
  return out;
}
function langOf(w, lang) { if (lang === 'en') return 'en'; if (lang === 'id') return 'id'; return inDict(w, 'en') && !inDict(w, 'id') ? 'en' : 'id'; }
function syllables(raw, lang) {
  const w = norm(raw); if (!w) return [];
  const en = langOf(w, lang || 'id') === 'en', nu = nuclei(w, en), onsets = ONSET_ID.concat(en ? ONSET_EN : []);
  if (!nu.length) return [w];
  const starts = [0];
  for (let k = 1; k < nu.length; k++) {
    const a = nu[k - 1][1], b = nu[k][0], c = w.slice(a, b);
    let s;
    if (c.length <= 1) s = a;
    else if (onsets.includes(c.slice(-2))) s = b - 2;
    else s = b - 1;
    starts.push(s);
  }
  return starts.map((s, i) => w.slice(s, i + 1 < starts.length ? starts[i + 1] : w.length));
}
function lastSyllable(raw, lang) { const s = syllables(raw, lang); return s[s.length - 1] || ''; }
/** onset + nucleus of a syllable ("kan" → "ka", "pur" → "pu", "ngan" → "nga") */
function openPart(syl, lang) { const nu = nuclei(syl, lang === 'en'); return nu.length ? syl.slice(0, nu[0][1]) : syl; }

/* ---------- required prefix ----------
   The rule is computed once (by whoever accepts a word) and stored in state.req, so every client agrees.
   When the strict prefix is (almost) impossible with the common-word list, it is relaxed step by step
   so the chain never dead-ends: huruf → last letter, then the one before; suku → last syllable (capped at 3 letters),
   onset+vowel, first 2 letters, first letter. */
function countStart(p, lang, used) { let n = 0; const bot = dict(lang).bot; for (const w of bot) if (w.length > p.length && w.startsWith(p) && !used.has(w)) { n++; if (n >= 3) break; } return n; }
function anyStart(p, lang, used) { for (const w of dict(lang).all) if (w.length > p.length && w.length >= MIN_LEN && w.startsWith(p) && !used.has(w)) return true; return false; }
function candidates(word, mode, lang) {
  const w = norm(word); if (!w) return ['a'];
  if (mode === 'suku') {
    const s = lastSyllable(w, lang), o = openPart(s, lang);
    return [s.slice(0, 3), o, s.slice(0, 2), s[0]].filter(Boolean); // long syllables are capped at 3 letters (make → mak, ngan → nga)
  }
  const c = []; for (let i = w.length - 1; i >= 0 && c.length < 4; i--) c.push(w[i]);
  return c;
}
function required(word, mode, lang, used) {
  const u = used instanceof Set ? used : new Set(used || []), seen = new Set();
  const cand = candidates(word, mode, lang);
  for (const p of cand) { if (seen.has(p)) continue; seen.add(p); if (countStart(p, lang, u) >= 2) return { req: p, relaxed: p !== cand[0] }; }
  // strict dictionary: any unused accepted word still keeps the chain alive
  for (const p of cand) if (anyStart(p, lang, u)) return { req: p, relaxed: p !== cand[0] };
  return { req: '', relaxed: true, dead: true }; // kata habis: nothing in the dictionary can continue
}

/* ---------- checking a word ---------- */
/** Strict dictionary: a word is accepted only if it is in the word list of the chosen language (Campuran = either list),
    follows the chain, has ≥3 letters (letters only) and was not used yet in this match.
    why: chars | oneword | short | prefix | same | used | dict (not in the dictionary) | plaus (not in the dictionary and gibberish) */
function check(s, raw) {
  const r = String(raw == null ? '' : raw).trim();
  if (/\s/.test(r)) return { ok: false, why: 'oneword' };
  if (/[0-9]/.test(r)) return { ok: false, why: 'chars' };
  const w = norm(r);
  if (w.length < MIN_LEN) return { ok: false, why: 'short', w };
  if (w.length > MAX_LEN) return { ok: false, why: 'plaus', w };
  if (!w.startsWith(s.req)) return { ok: false, why: 'prefix', w };
  if (w === s.req) return { ok: false, why: 'same', w };
  if (s.used.includes(w)) return { ok: false, why: 'used', w };
  if (!inDict(w, s.set.lang)) return { ok: false, why: plausible(w) ? 'dict' : 'plaus', w };
  return { ok: true, w, hit: true };
}

/* ---------- scoring ----------
   base = word length (max 15) · streak +1 per consecutive success after the first (max +5)
   · speed +2 when answered within the first 40% of the timer. Timeout / pass / wrong word = 0.
   (The old +2 dictionary bonus is gone: with the strict dictionary every accepted word is a dictionary word.) */
function scoreOf(w, streakBefore, usedMs, timerMs) {
  const base = Math.min(15, w.length), streak = Math.min(5, streakBefore), speed = usedMs <= timerMs * 0.4 ? 2 : 0;
  return { base, streak, speed, total: base + streak + speed };
}

/* ---------- state ---------- */
const arr = v => Array.isArray(v) ? v : (v && typeof v === 'object' ? Object.values(v) : []);
const obj = v => v && typeof v === 'object' && !Array.isArray(v) ? v : {};
const pick = (v, list, d) => list.includes(v) ? v : d;
function cleanSet(x) { x = obj(x); return { mode: pick(x.mode, MODES, 'huruf'), timer: pick(Number(x.timer), TIMERS, 15), turns: x.turns === 0 || x.turns === '0' ? 0 : pick(Number(x.turns), TURNS.filter(Boolean), 5), lang: pick(x.lang, LANGS, 'id'), strict: x.strict ? 1 : 0 }; }
function newState(set) {
  return { v: VERSION, ph: 'lobby', set: cleanSet(Object.assign({}, DEFAULT_SET, set || {})), bots: [], av: [], ord: [], pl: [], cur: 0, req: '', last: '', ch: [], used: [], ddl: 0, t0: 0, tAt: 0, n: 0, skips: 0, game: 0, ev: null, best: null };
}
/** PHP json round trip turns {} into [] and drops nothing else; fill defaults after every read */
function normalize(s) {
  s = obj(s); const d = newState();
  if (s.v !== VERSION) return d;
  const o = Object.assign(d, s);
  o.set = cleanSet(o.set); o.bots = arr(o.bots).map(obj).filter(b => typeof b.id === 'number'); o.av = arr(o.av).map(arr);
  o.ord = arr(o.ord).map(Number); o.pl = arr(o.pl).map(obj); o.ch = arr(o.ch).map(obj); o.used = arr(o.used).map(String);
  o.ev = s.ev && typeof s.ev === 'object' && !Array.isArray(s.ev) ? s.ev : null; o.best = s.best && typeof s.best === 'object' && !Array.isArray(s.best) ? s.best : null;
  if (!['lobby', 'play', 'end'].includes(o.ph)) o.ph = 'lobby';
  return o;
}
function supported(s) { return !!s && s.v === VERSION; }
function plOf(s, id) { return s.pl.find(p => p.id === id) || null; }
function curId(s) { return s.ord[s.cur]; }
function rndPick(list, rnd) { return list[Math.floor((rnd || Math.random)() * list.length)]; }
function seedWord(s, rnd) {
  const used = new Set(s.used), lang = s.set.lang, bot = dict(lang).bot.slice(0, 1500);
  let list = bot.filter(w => w.length >= 4 && w.length <= 7 && !used.has(w));
  for (let tries = 0; tries < 30; tries++) { const w = rndPick(list, rnd); const r = required(w, s.set.mode, lang, used); if (!r.relaxed) return w; }
  return rndPick(list, rnd) || 'kata';
}
/** returns true when the chain is dead (no unused dictionary word can follow) */
function setChainWord(s, w, by, pts) {
  s.used.push(w); s.last = w; s.ch.push({ w, by, p: pts }); if (s.ch.length > CHAIN_KEEP) s.ch = s.ch.slice(-CHAIN_KEEP);
  const r = required(w, s.set.mode, s.set.lang, s.used); s.req = r.req; s.rel = r.relaxed ? 1 : 0;
  return !!r.dead;
}
function plantSeed(s, rnd) { const w = seedWord(s, rnd); setChainWord(s, w, 0, 0); s.skips = 0; return w; }
/** host: start (or restart) a match. order = seat order of player ids (bots have negative ids) */
function start(s, order, now, rnd) {
  s.ord = order.slice(0, MAX_SEATS); s.pl = s.ord.map(id => ({ id, s: 0, k: 0, t: 0, h: 0, w: 0 }));
  s.ch = []; s.used = []; s.cur = 0; s.n = 1; s.game = (s.game | 0) + 1; s.best = null; s.ph = 'play';
  const w = plantSeed(s, rnd);
  s.t0 = now + START_MS; s.tAt = s.t0; s.ddl = s.t0 + s.set.timer * 1000;
  s.ev = { n: s.n, k: 'start', w, by: 0, g: s.game };
  return s;
}
/** still in the match: not knocked out (unlimited) and turns left (limited) */
function eligible(s, q) { return !!q && !q.o && (unlimited(s) || q.t < s.set.turns); }
function alive(s) { return s.pl.filter(p => !p.o); }
function finished(s) {
  if (!s.pl.length) return false;
  if (!unlimited(s)) return s.pl.every(p => p.t >= s.set.turns);
  const a = alive(s);
  if (a.length <= (s.pl.length > 1 ? 1 : 0)) return true;           // last player standing
  return s.pl.some(p => p.id > 0) && !a.some(p => p.id > 0);          // every human is out: bots only left
}
/** next eligible seat index starting at `from` (inclusive), or -1 */
function seek(s, from) { for (let i = 0; i < s.ord.length; i++) { const c = (from + i) % s.ord.length; if (eligible(s, plOf(s, s.ord[c]))) return c; } return -1; }
function endNow(s) { s.ph = 'end'; s.ddl = 0; return s; }
function advance(s, now) {
  const p = plOf(s, curId(s)); if (p) p.t++;
  if (finished(s) || !s.ord.length) return endNow(s);
  const c = seek(s, s.cur + 1); if (c < 0) return endNow(s);
  s.cur = c; s.n++; s.tAt = now; s.ddl = now + s.set.timer * 1000; return s;
}
/** a player's word. Returns {ok:false, why} or {ok:true, pts, w} and mutates s. */
function submit(s, by, raw, now) {
  if (s.ph !== 'play') return { ok: false, why: 'phase' };
  if (curId(s) !== by) return { ok: false, why: 'turn' };
  if (now < s.t0) return { ok: false, why: 'early' };
  if (now > s.ddl + 1500) return { ok: false, why: 'late' };
  const c = check(s, raw); if (!c.ok) return c;
  const p = plOf(s, by), prevReq = s.req, sc = scoreOf(c.w, p.k, Math.max(0, now - s.tAt), s.set.timer * 1000);
  p.s += sc.total; p.k++; p.h++; p.w++;
  if (!s.best || c.w.length > s.best.w.length) s.best = { w: c.w, by };
  const dead = setChainWord(s, c.w, by, sc.total); s.skips = 0;
  s.ev = { n: s.n + 1, k: 'ok', by, w: c.w, p: sc.total, br: [sc.base, sc.streak, sc.speed], req: prevReq };
  if (dead && unlimited(s)) { s.n++; endNow(s); s.ev.end = 1; s.ev.habis = 1; return { ok: true, w: c.w, pts: sc.total, br: sc, habis: true }; }
  if (dead) s.ev.seed = plantSeed(s, null); // limited mode: words ran out for this chain → fresh seed word
  advance(s, now); if (s.ph === 'end') s.ev.end = 1;
  return { ok: true, w: c.w, pts: sc.total, br: sc };
}
/** timeout / pass / wrong word ("giliran lewat"). 0 points, streak resets. Limited turns: the turn just passes.
    Unlimited: the player is knocked out (p.o = knock-out order, 1 = first out). After a full lap of misses
    (min(players still in, 3) in a row) a fresh seed word is planted so nobody stays stuck. */
function skip(s, by, why, now, rnd, word) {
  if (s.ph !== 'play' || curId(s) !== by) return false;
  if (why === 'timeout' && now < s.ddl) return false;
  const p = plOf(s, by), inCount = unlimited(s) ? alive(s).length : s.ord.length; if (p) p.k = 0;
  const prevReq = s.req; s.skips++;
  let out = 0; if (p && unlimited(s)) { out = 1 + Math.max(0, ...s.pl.map(q => q.o | 0)); p.o = out; }
  let seed = null; if (s.skips >= Math.min(inCount, 3) && !(unlimited(s) && finished(s))) seed = plantSeed(s, rnd);
  s.ev = { n: s.n + 1, k: why, by, req: prevReq, seed, w: word ? String(word).slice(0, 30) : '' }; if (out) s.ev.out = 1;
  advance(s, now); if (s.ph === 'end') s.ev.end = 1;
  return true;
}
/** remove a player who left mid-match (keeps their score row out of the ranking) */
function drop(s, id, now) {
  const i = s.ord.indexOf(id); if (i < 0) return false;
  const wasCur = i === s.cur; s.ord.splice(i, 1); s.pl = s.pl.filter(p => p.id !== id);
  if (s.ph !== 'play') return true;
  if (s.ord.length < 2) { s.ph = 'end'; s.ddl = 0; s.ev = { n: (s.n | 0) + 1, k: 'left', by: id, end: 1 }; s.n++; return true; }
  if (i < s.cur) s.cur--;
  if (s.cur >= s.ord.length) s.cur = 0;
  if (finished(s)) { s.n = (s.n | 0) + 1; endNow(s); s.ev = { n: s.n, k: 'left', by: id, end: 1 }; return true; }
  if (wasCur) { const c = seek(s, s.cur); if (c < 0) { s.n++; endNow(s); s.ev = { n: s.n, k: 'left', by: id, end: 1 }; return true; } s.cur = c; s.n++; s.tAt = now; s.ddl = now + s.set.timer * 1000; s.ev = { n: s.n, k: 'left', by: id }; }
  return true;
}
/** limited: by score. Unlimited: players still in first (by score), then knocked-out players, last one out first. */
function ranking(s) { const u = unlimited(s); return s.pl.slice().sort((a, b) => (u ? (!!a.o - !!b.o) || ((b.o | 0) - (a.o | 0)) : 0) || b.s - a.s || b.w - a.w || s.ord.indexOf(a.id) - s.ord.indexOf(b.id)); }
function backToLobby(s) { s.ph = 'lobby'; s.ord = []; s.pl = []; s.ch = []; s.used = []; s.req = ''; s.last = ''; s.ddl = 0; s.ev = { n: (s.n | 0) + 1, k: 'lobby' }; s.n = (s.n | 0) + 1; return s; }

/* ---------- bots ---------- */
const BOT_NAMES = ['Bot Ayu', 'Bot Bima', 'Bot Citra', 'Bot Dodi', 'Bot Eka', 'Bot Fajar', 'Bot Gita'];
/** dictionary words that start with req (not used), medium length preferred; ~7% chance the bot "blanks" */
function botWord(s, rnd) {
  rnd = rnd || Math.random; if (rnd() < 0.07) return null;
  const used = new Set(s.used), lang = s.set.lang, all = dict(lang).bot.filter(w => w.length > s.req.length && w.startsWith(s.req) && !used.has(w) && plausible(w));
  if (!all.length) { const rest = Array.from(dict(lang).all).filter(w => w.length > s.req.length && w.length >= MIN_LEN && w.startsWith(s.req) && !used.has(w)); return rest.length ? rndPick(rest.slice(0, 60), rnd) : null; }
  const mid = all.filter(w => w.length >= 4 && w.length <= 8), pool = (mid.length ? mid : all).slice(0, 60);
  return rndPick(pool, rnd);
}
function botDelay(rnd) { return 600 + Math.floor((rnd || Math.random)() * 1200); }
/** a few example words for a prefix (shown after a timeout, and as hints) */
function examples(req, lang, used, n) {
  const u = new Set(used || []), f = w => w.length > req.length && w.length >= MIN_LEN && w.startsWith(req) && !u.has(w), out = dict(lang).bot.filter(f).slice(0, n || 3);
  if (out.length < (n || 3)) for (const w of dict(lang).all) { if (out.length >= (n || 3)) break; if (f(w) && !out.includes(w)) out.push(w); }
  return out;
}

root.LK = { VERSION, MAX_SEATS, MIN_LEN, START_MS, unlimited, alive, eligible, TIMERS, TURNS, MODES, LANGS, DEFAULT_SET, BOT_NAMES,
  loadWords, dict, inDict, norm, plausible, syllables, lastSyllable, openPart, required, candidates, check, scoreOf,
  newState, normalize, supported, cleanSet, start, submit, skip, advance, drop, finished, ranking, backToLobby, curId, plOf,
  botWord, botDelay, examples, seedWord, arr, obj };
})(typeof window !== 'undefined' ? window : globalThis);

/* ===== Corat-Coret core: pure game rules, drawing codec, platform transport, online coordinator (no DOM) ===== */
(function (root) {
'use strict';
const GAME = 'jadidaring-drawguess', SCHEMA = 1;
const W = 800, H = 600;
const LIMITS = { stateMax: 200000, privateMax: 100000, payloadMax: 20000, drawBudget: 110000, chatKeep: 40, inboxMax: 24, inboxPerPlayer: 3, textMax: 60, nameMax: 24, usedKeep: 600 };
const A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
const AI = {}; for (let i = 0; i < 64; i++) AI[A[i]] = i;
const copy = v => JSON.parse(JSON.stringify(v));
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const bytes = v => new TextEncoder().encode(JSON.stringify(v)).length;

function rnd(n) { if (root.crypto && root.crypto.getRandomValues) { const a = new Uint32Array(1); root.crypto.getRandomValues(a); return Math.floor(a[0] / 4294967296 * n); } return Math.floor(Math.random() * n); }
function rid(len = 8) { let s = ''; for (let i = 0; i < len; i++) s += A[rnd(62)]; return s; }
function shuffle(list) { const a = list.slice(); for (let i = a.length - 1; i > 0; i--) { const j = rnd(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; }

/* ---------- Drawing codec: each op is a compact base64url string, safe inside JSON ---------- */
const enc2 = n => { n = clamp(Math.round(n), 0, 4095); return A[n >> 6] + A[n & 63]; };
const dec2 = (s, i) => (AI[s[i]] << 6) | AI[s[i + 1]];
function encodeStroke(color, size, pts) { let s = 's' + A[color & 63] + A[size & 63]; for (const p of pts) s += enc2(clamp(p[0], 0, W - 1)) + enc2(clamp(p[1], 0, H - 1)); return s; }
function encodeFill(color, x, y) { return 'f' + A[color & 63] + enc2(clamp(x, 0, W - 1)) + enc2(clamp(y, 0, H - 1)); }
function decodeOp(op) {
  if (typeof op !== 'string' || op.length < 3 || op.length > 60000 || !/^[sf][A-Za-z0-9_-]+$/.test(op)) return null;
  if (op[0] === 's') {
    if ((op.length - 3) % 4 !== 0 || op.length < 7) return null;
    const pts = []; for (let i = 3; i < op.length; i += 4) pts.push([Math.min(W - 1, dec2(op, i)), Math.min(H - 1, dec2(op, i + 2))]);
    return { t: 's', c: AI[op[1]], z: AI[op[2]], pts };
  }
  if (op.length !== 6) return null;
  return { t: 'f', c: AI[op[1]], x: Math.min(W - 1, dec2(op, 2)), y: Math.min(H - 1, dec2(op, 4)) };
}
function opsBytes(ops) { return JSON.stringify(ops || []).length; }
function cleanOps(ops) { return Array.isArray(ops) ? ops.filter(o => decodeOp(o)) : []; }

/* ---------- Words, hints, judging ---------- */
/* Text matching is script-aware: Latin (id/en/ms/vi) compares case/diacritic-free (vi "con meo" == "con mèo"),
   Chinese and Thai are written without spaces and compare per character / grapheme cluster. */
const DENSE = /[\u0E00-\u0E7F\u3400-\u9FFF\uF900-\uFAFF]/; // Thai, CJK ideographs
const THAI = /[\u0E00-\u0E7F]/;
const TH_MARKS = /[\u0E31\u0E34-\u0E3A\u0E47-\u0E4E]+/g, TH_TONES = /[\u0E48-\u0E4B]/g;
const thRank = c => (c >= '\u0E48' && c <= '\u0E4B' ? 2 : c >= '\u0E4C' ? 3 : 1);
/** Thai: decomposed sara am, combining marks in one fixed order without duplicates (typing order differs between keyboards). */
function thaiFix(s) { return s.replace(/\u0E33/g, '\u0E4D\u0E32').replace(TH_MARKS, m => Array.from(new Set(m)).sort((a, b) => thRank(a) - thRank(b) || (a < b ? -1 : 1)).join('')); }
let T2S = null; // traditional -> simplified for the characters used in the zh word list (filled from cfg.t2s)
function setT2S(pairs) { T2S = new Map(); const a = Array.from(String(pairs || '')); for (let i = 0; i + 1 < a.length; i += 2) T2S.set(a[i], a[i + 1]); }
function norm(s) {
  s = String(s || '').normalize('NFKC').toLowerCase();
  if (T2S && T2S.size) s = s.replace(/[\u3400-\u9FFF\uF900-\uFAFF]/g, c => T2S.get(c) || c);
  if (THAI.test(s)) s = thaiFix(s);
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\u0111/g, 'd').replace(/[^\p{L}\p{N}\p{M}]+/gu, ' ').trim();
}
function compact(s) { return norm(s).replace(/ /g, ''); }
/** Grapheme clusters (base + combining marks; Thai sara am extends). Deterministic, so the drawer's hint and every
    client's parsing agree; for the scripts used here it matches Intl.Segmenter (checked in tests). */
const CLUSTER = /[^\p{M}\u0E33][\p{M}\u0E33]*|[\p{M}\u0E33]+/gsu;
function units(s) { return String(s || '').match(CLUSTER) || []; }
function lev(a, b) {
  if (a === b) return 0; if (!a.length) return b.length; if (!b.length) return a.length;
  if (Math.abs(a.length - b.length) > 3) return 9;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) { const cur = [i]; for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); prev = cur; }
  return prev[b.length];
}
/** 'ok' | 'close' | 'no' */
function judge(guess, word) {
  const g = compact(guess), w = compact(word);
  if (!g || !w) return 'no';
  if (g === w) return diaOK(guess, word) ? 'ok' : 'close';
  if (DENSE.test(w)) { // zh / th: exact characters only (no "word inside a sentence" match), close = 1–2 clusters off
    const gu = units(g), wu = units(w), d = lev(gu, wu);
    if (wu.length >= 2 && d <= (wu.length > 4 ? 2 : 1)) return 'close';
    if (THAI.test(w) && g.replace(TH_TONES, '') === w.replace(TH_TONES, '')) return 'close'; // only tone marks differ
    return 'no';
  }
  if ((' ' + norm(guess) + ' ').includes(' ' + norm(word) + ' ')) return 'ok';
  const d = lev(g, w);
  if (d <= (w.length > 6 ? 2 : 1) && w.length >= 3) return 'close';
  if (idNear(g, w) || norm(guess).split(' ').some(t => t !== g && idNear(t, w))) return 'close';
  return 'no';
}
/* Indonesian/Malay affix-aware "almost": berpelukan ~ pelukan ~ peluk, menulis ~ tulis, makanan ~ makan.
   Every possible stem (prefix/suffix peeled, meN-/peN- nasal restored, X-X reduplication folded) of both sides;
   close when they share a stem of 4+ letters, or the shorter (4+) sits inside the longer and is >= 70% of it. */
const ID_SUF = ['nya', 'lah', 'kah', 'pun', 'kan', 'an', 'i'], ID_PRE = ['ber', 'bel', 'be', 'ter', 'per', 'di', 'ke', 'se'];
function idStems(s) {
  const out = new Set(), add = x => { if (x.length >= 4 && !out.has(x)) { out.add(x); go(x); } };
  const go = x => {
    const h = x.length >> 1; if (x.length % 2 === 0 && x.slice(0, h) === x.slice(h)) add(x.slice(0, h));
    for (const f of ID_SUF) if (x.endsWith(f)) add(x.slice(0, -f.length));
    for (const f of ID_PRE) if (x.startsWith(f)) {
      const r = x.slice(f.length); if (f.length === 2 && f !== 'di' && !r.endsWith('an')) continue; // ke-/se- only as ke-an/se-an (kemeja is not ke+meja)
      add(r); if (f[2] === 'r' && /^[aiueo]/.test(r)) add('r' + r); // berenang = ber+renang
    }
    const p = x.match(/^([mp]e)(ng|ny|m|n)?(.+)$/);
    if (p) {
      const n = p[2] || '', r = p[3];
      if (n) add(n + r), add(r); else if (/^[lrwy][aiueo]/.test(r)) add(r); // plain me-/pe- only before l r w y (melukis, merawat)
      if (/^[aiueo]/.test(r)) add((n === 'm' ? 'p' : n === 'n' ? 't' : n === 'ny' ? 's' : n === 'ng' ? 'k' : '') + r); // memukul, menulis, menyapu, mengupas
      if (n === 'ng' && r[0] === 'e') add(r.slice(1)); // menge-/penge- before one-syllable stems
    }
  };
  out.add(s); go(s); return out;
}
function idNear(a, b) {
  if (!a || !b || a === b || !/^[a-z]+$/.test(a + b)) return false;
  const [s, l] = a.length <= b.length ? [a, b] : [b, a];
  if (s.length >= 4 && l.includes(s) && s.length >= 0.7 * l.length) return true;
  const A = idStems(a); for (const x of idStems(b)) if (A.has(x)) return true;
  return false;
}
/** Vietnamese: a guess may leave diacritics out, but a diacritic that IS typed must match (chó ≠ chợ). */
function diaOK(guess, word) {
  const strip = c => c.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\u0111/g, 'd');
  const flat = x => Array.from(String(x || '').normalize('NFC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ''));
  const a = flat(guess), b = flat(word); if (a.length !== b.length) return true;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i] && strip(a[i]) !== a[i]) return false;
  return true;
}
function leaksWord(text, word) { const v = judge(text, word), w = compact(word); return v !== 'no' || (units(w).length >= (DENSE.test(w) ? 1 : 3) && compact(text).includes(w)); }
const isLetter = ch => /^[\p{L}\p{N}]/u.test(ch);
function maskOf(word) { return units(word).map(ch => isLetter(ch) ? '_' : ch).join(''); }
function letterCount(word) { return units(word).filter(isLetter).length; }
function revealedCount(hint) { return units(hint).filter(ch => ch !== '_' && isLetter(ch)).length; }
function hintTarget(frac, word, hintAt) { const cap = Math.floor((letterCount(word) - 1) / 2); let n = 0; for (const f of hintAt || []) if (frac >= f) n++; return clamp(n, 0, Math.max(0, cap)); }
function revealOne(word, hint) {
  const w = units(word), h = units(hint);
  if (w.length !== h.length) return hint;
  const hidden = []; h.forEach((ch, i) => { if (ch === '_' && isLetter(w[i])) hidden.push(i); });
  if (!hidden.length) return hint; const i = hidden[rnd(hidden.length)]; h[i] = w[i]; return h.join('');
}
function sanitizeWord(s) { return units(String(s || '').normalize('NFC').replace(/[^\p{L}\p{M}\p{N} -]/gu, '').replace(/\s+/g, ' ').trim()).slice(0, 24).join('').trim(); }
/* ----- word specs: a secret is a string, or { id, en, ms, vi, th, zh (shown/hinted), x: [accepted alternatives] } ----- */
const LANGS = ['id', 'en', 'ms', 'vi', 'th', 'zh'];
const isSpec = w => !!w && typeof w === 'object';
const specLangs = w => isSpec(w) ? LANGS.filter(l => typeof w[l] === 'string' && w[l]) : [];
const isMulti = w => specLangs(w).length > 1;
function variants(w) { if (!isSpec(w)) return w ? [String(w)] : []; return specLangs(w).map(l => w[l]).concat(arr(w.x).map(String)); }
/** The word as shown to someone reading `lang` (falls back to English, then any language). */
function wordFor(w, lang) { if (!isSpec(w)) return w ? String(w) : ''; const ls = specLangs(w); return w[lang] || w.en || (ls[0] ? w[ls[0]] : ''); }
/** Best verdict over every accepted form (each judged with its own script rules). */
function judgeAny(text, w) { let best = 'no'; for (const v of variants(w)) { const r = judge(text, v); if (r === 'ok') return 'ok'; if (r === 'close') best = 'close'; } return best; }
function leaksAny(text, w) { return variants(w).some(v => leaksWord(text, v)); }
/** The key stored in s.used (never repeats a concept within a room). */
const wordKey = w => isMulti(w) ? String(w.en || wordFor(w, 'en')) : wordFor(w, specLangs(w)[0] || 'id');
/** Grow the letter hint(s) to the target for this point of the turn. Multilingual: one hint per language. Returns true if changed. */
function growHints(t, w, frac, hintAt) {
  let changed = false;
  const grow = (word, hint) => { while (hintTarget(frac, word, hintAt) > revealedCount(hint)) { const n = revealOne(word, hint); if (n === hint) break; hint = n; changed = true; } return hint; };
  if (isMulti(w)) { t.hints = obj(t.hints); for (const l of specLangs(w)) t.hints[l] = grow(w[l], t.hints[l] || maskOf(w[l])); t.hint = t.hints.en || t.hint; }
  else t.hint = grow(wordFor(w, specLangs(w)[0]), t.hint || maskOf(wordFor(w, specLangs(w)[0])));
  return changed;
}
function hintsDue(t, w, frac, hintAt) { return growHints(copy({ hint: t.hint, hints: t.hints }), w, frac, hintAt); }
/** Mask(s) at the start of a drawing turn. */
function startHints(w) { if (!isMulti(w)) return { hint: maskOf(wordFor(w, specLangs(w)[0])), hints: null }; const h = {}; for (const l of specLangs(w)) h[l] = maskOf(w[l]); return { hint: h.en || maskOf(wordFor(w, 'en')), hints: h }; }
/** The hint a viewer reading `lang` should see. */
function hintFor(t, lang) { const h = t && t.hints && obj(t.hints); return (h && (h[lang] || h.en)) || (t && t.hint) || ''; }
/* ----- language pack (zh/th/vi/ms, shipped deflate-compressed): concept rows + per-language extras ----- */
/** Parse "#Category" + "en;id;ms;vi;th;zh" rows ('/' separates accepted alternatives; the first one is shown). */
function parseConcepts(text) {
  const out = []; let cat = '';
  for (const raw of String(text || '').split('\n')) {
    const line = raw.trim(); if (!line) continue;
    if (line[0] === '#') { cat = line.slice(1).trim(); continue; }
    const cells = line.split(';'); if (cells.length !== 6) continue;
    const w = { x: [] }, a = {}, order = ['en', 'id', 'ms', 'vi', 'th', 'zh'];
    cells.forEach((c, i) => { const alts = c.split('/').map(v => v.trim()).filter(Boolean); if (!alts.length) return; w[order[i]] = alts[0]; if (alts.length > 1) { a[order[i]] = alts.slice(1); w.x.push(...a[order[i]]); } });
    if (!w.x.length) delete w.x;
    out.push({ cat, w, a });
  }
  return out;
}
/** Merge a decoded pack into cfg: i18n/doodles for the new languages, cfg.words[lang] (concept column + extras),
    cfg.concepts (multilingual pool) and cfg.alts[lang] (alternatives per shown word). Also loads the T2S map. */
function mergePack(cfg, pack) {
  if (!pack) return cfg;
  cfg.i18n = cfg.i18n || {}; cfg.words = cfg.words || {}; cfg.alts = cfg.alts || {}; cfg.doodles = cfg.doodles || {};
  for (const l of Object.keys(pack.i18n || {})) cfg.i18n[l] = pack.i18n[l];
  for (const l of Object.keys(pack.doodles || {})) for (const id of Object.keys(pack.doodles[l])) if (cfg.doodles[id]) cfg.doodles[id][l] = pack.doodles[l][id];
  const rows = parseConcepts(pack.concepts); cfg.concepts = rows;
  for (const l of pack.langs || []) {
    const bank = {}, alts = {}, own = (pack.extras || {})[l] || {};
    for (const r of rows) {
      const shown = r.w[l]; if (!shown) continue; (bank[r.cat] = bank[r.cat] || []).push(shown);
      if (r.a[l]) alts[compact(shown)] = r.a[l];
    }
    for (const cat of Object.keys(own)) (bank[cat] = bank[cat] || []).push(...String(own[cat]).split(/[|]| (?=[\u3400-\u9FFF])/).map(v => v.trim()).filter(Boolean));
    if (!cfg.words[l]) { const out = {}; for (const cat of Object.keys(bank)) out[cat] = bank[cat].join('|'); cfg.words[l] = out; }
    cfg.alts[l] = alts;
  }
  if (pack.t2s) { cfg.t2s = pack.t2s; setT2S(pack.t2s); }
  return cfg;
}
/** Small raw-DEFLATE decoder: fallback for browsers without DecompressionStream('deflate-raw'). */
function inflateRaw(src) {
  let pos = 0, bit = 0, cnt = 0; const out = [];
  const bits = n => { let v = 0; for (let i = 0; i < n; i++) { if (!cnt) { bit = src[pos++]; cnt = 8; } v |= (bit & 1) << i; bit >>= 1; cnt--; } return v; };
  const build = lens => { const count = new Uint16Array(16), offs = new Uint16Array(16), sym = new Uint16Array(lens.length); for (const l of lens) count[l]++; count[0] = 0; for (let i = 1; i < 16; i++) offs[i] = offs[i - 1] + count[i - 1]; lens.forEach((l, i) => { if (l) sym[offs[l]++] = i; }); return { count, sym }; };
  const decode = h => { let code = 0, first = 0, idx = 0; for (let len = 1; len < 16; len++) { code |= bits(1); const c = h.count[len]; if (code - c < first) return h.sym[idx + code - first]; idx += c; first = (first + c) << 1; code <<= 1; } throw Error('inflate'); };
  const LB = [], LE = [], DB = [], DE = [];
  for (let i = 0, b = 3; i < 28; i++) { LE[i] = i < 8 ? 0 : (i >> 2) - 1; LB[i] = b; b += 1 << LE[i]; } LB[28] = 258; LE[28] = 0;
  for (let i = 0, b = 1; i < 30; i++) { DE[i] = i < 4 ? 0 : (i >> 1) - 1; DB[i] = b; b += 1 << DE[i]; }
  let final;
  do {
    final = bits(1); const type = bits(2);
    if (type === 0) { cnt = 0; const len = src[pos] | (src[pos + 1] << 8); pos += 4; for (let i = 0; i < len; i++) out.push(src[pos++]); continue; }
    let lit, dist;
    if (type === 1) { const l = []; for (let i = 0; i < 288; i++) l.push(i < 144 ? 8 : i < 256 ? 9 : i < 280 ? 7 : 8); lit = build(l); dist = build(new Array(30).fill(5)); }
    else {
      const hl = bits(5) + 257, hd = bits(5) + 1, hc = bits(4) + 4, ord = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15], cl = new Array(19).fill(0);
      for (let i = 0; i < hc; i++) cl[ord[i]] = bits(3);
      const ch = build(cl), lens = [];
      while (lens.length < hl + hd) { const sy = decode(ch); if (sy < 16) lens.push(sy); else { let rep, v = 0; if (sy === 16) { v = lens[lens.length - 1]; rep = 3 + bits(2); } else rep = sy === 17 ? 3 + bits(3) : 11 + bits(7); while (rep--) lens.push(v); } }
      lit = build(lens.slice(0, hl)); dist = build(lens.slice(hl));
    }
    for (;;) { let sy = decode(lit); if (sy < 256) out.push(sy); else if (sy === 256) break; else { sy -= 257; const len = LB[sy] + bits(LE[sy]), ds = decode(dist), d = DB[ds] + bits(DE[ds]); for (let i = 0; i < len; i++) out.push(out[out.length - d]); } }
  } while (!final);
  return Uint8Array.from(out);
}
const conceptIndex = new WeakMap();
/** Concept by its English key (multilingual rooms store the English word in s.used / the drawer's choices). */
function conceptOf(cfg, key) {
  if (!cfg || !cfg.concepts) return null; let m = conceptIndex.get(cfg.concepts);
  if (!m) { m = new Map(); for (const r of cfg.concepts) m.set(compact(r.w.en), r.w); conceptIndex.set(cfg.concepts, m); }
  return m.get(compact(key)) || null;
}
/** Turn a picked word into the secret stored in the drawer's private data. */
function secretFor(cfg, lang, word) {
  if (lang === 'multi') { const c = conceptOf(cfg, word); return c ? copy(c) : word; }
  const x = cfg && cfg.alts && cfg.alts[lang] && cfg.alts[lang][compact(word)];
  return x && x.length ? { [lang]: word, x: x.slice() } : word;
}
const hasLang = (cfg, l) => !!(cfg && cfg.words && (l === 'multi' ? cfg.concepts && cfg.concepts.length : cfg.words[l]));
function guessPoints(remainMs, totalMs, g) { const f = clamp(totalMs > 0 ? remainMs / totalMs : 0, 0, 1); return Math.round((g.guessMinPoints + (g.guessMaxPoints - g.guessMinPoints) * f) / 5) * 5; }
/**
 * Drawer score for one turn (anti-sandbagging): round5(average of the correct guessers' points × correct ÷ eligible),
 * i.e. round5(sum ÷ eligible), plus drawerAllBonus when every eligible guesser got it. Nobody correct -> 0.
 * guessPts: points of this turn's correct guessers; eligible: guessers who could have guessed (see eligibleGuessers).
 */
function drawerPoints(guessPts, eligible, g) {
  const pts = (guessPts || []).map(n => Math.max(0, Number(n) || 0)), c = pts.length, e = Math.max(Math.floor(Number(eligible) || 0), c);
  if (!c || !e) return { base: 0, bonus: 0, total: 0, all: false };
  const base = Math.round(pts.reduce((a, b) => a + b, 0) / e / 5) * 5, all = c >= e, bonus = all ? Math.max(0, Number((g || {}).drawerAllBonus ?? 50) || 0) : 0;
  return { base, bonus, total: base + bonus, all };
}
/**
 * Eligible guessers of an online turn: the non-drawer players seated when the drawing started (t.elig), minus anyone who
 * left before the turn ended without guessing (a leaver who already guessed still counts). Mid-game joiners who arrive
 * after the drawing started are not in t.elig: they never lower the drawer's share or block the +50 all-guessed bonus,
 * and only count (numerator and denominator) if they guess correctly. Old rooms without t.elig: the non-drawer players
 * present now plus anyone who guessed.
 */
/** Guessers that must all be correct for the turn to end early / for the +50 bonus (elig still present, else all present). */
function requiredGuessers(t, players) {
  const present = seated(players).map(p => String(p.id)).filter(id => id !== String(t && t.drawer)), here = new Set(present);
  const start = arr(t && t.elig).map(String).filter(id => id !== String(t && t.drawer) && here.has(id));
  return start.length ? start : present;
}
function turnDone(t, players) { const req = requiredGuessers(t, players), g = obj(t && t.guessed); return req.length > 0 && req.every(id => g[id]); }
/**
 * Mid-game join: seated players missing from the draw order are appended to the END of the order (so they draw later
 * in this round, or next round if this one already passed them), start at 0 points and get a "baru gabung" mark.
 * Returns true when the state changed. Lobby / over: nothing to do (startGame seats everyone).
 */
function seatLate(s, players, now) {
  if (!['choosing', 'drawing', 'reveal'].includes(s.phase)) return false;
  const order = arr(s.order).map(String); let changed = false;
  s.joined = obj(s.joined); s.scores = obj(s.scores); s.names = obj(s.names);
  for (const p of seated(players)) {
    if (order.includes(String(p.id))) continue;
    s.order = arr(s.order).concat([p.id]); order.push(String(p.id));
    if (s.scores[p.id] === undefined) s.scores[p.id] = 0;
    s.names[p.id] = String(p.displayName || '').slice(0, LIMITS.nameMax); s.joined[p.id] = now;
    pushChat(s, { k: 'sys', m: 'joined', p: p.id }); changed = true;
  }
  // forget "joined" marks of players who are no longer in the order
  for (const id of Object.keys(s.joined)) if (!order.includes(String(id))) delete s.joined[id];
  return changed;
}
/** Rounds actually played: big rooms are capped so a game stays ~<= maxTurns drawing turns (everyone still draws once). */
function roundsFor(n, rounds, g) { const cap = Math.max(1, Math.floor((Number(g && g.maxTurns) || 24) / Math.max(1, n))); return Math.max(1, Math.min(Number(rounds) || 1, cap)); }
function eligibleGuessers(t, players) {
  const guessed = Object.keys(obj(t && t.guessed)).map(String);
  return new Set(requiredGuessers(t, players).concat(guessed)).size;
}
/* Word bank: cfg.words[lang] is either a flat list or { category: "w1|w2|…" } (pipe strings keep the page small). */
function wordBank(cfg, lang) {
  if (lang === 'multi' && cfg.concepts && cfg.concepts.length) return cfg.concepts.map(r => [r.w.en, r.cat]);
  const src = (cfg.words && (cfg.words[lang] || cfg.words.id)) || [], out = [];
  const add = (list, cat) => { for (const w of (typeof list === 'string' ? list.split('|') : arr(list))) out.push([w, cat]); };
  if (Array.isArray(src) || typeof src === 'string') add(src, ''); else for (const cat of Object.keys(src)) add(src[cat], cat);
  return out;
}
/** Deduped word list (by normalised form); the array carries .cat = Map(compact word -> category) for category spreading. */
function wordPool(cfg, lang, custom) {
  const seen = new Map(), list = [];
  const push = (w, cat) => { w = sanitizeWord(w); const k = compact(w); if (!w || !k || seen.has(k)) return; seen.set(k, cat); list.push(w); };
  for (const [w, cat] of wordBank(cfg, lang)) push(w, cat);
  for (const w of (custom || [])) push(w, '*');
  list.cat = seen; return list;
}
/**
 * n choices: never a word already used in this room/session (until the pool runs dry), each from a different category,
 * preferring categories that did not appear among the last few used words.
 */
function pickChoices(pool, used, n) {
  const usedArr = (used || []).map(compact), usedSet = new Set(usedArr), cat = pool.cat || new Map(), catOf = w => cat.get(compact(w)) || '';
  let fresh = pool.filter(w => !usedSet.has(compact(w))); if (fresh.length < n) fresh = pool.slice();
  const recent = new Set(usedArr.slice(-4).map(k => cat.get(k) || '').filter(Boolean)), picks = [], cats = new Set();
  const order = shuffle(fresh);
  for (const pass of [0, 1, 2]) for (const w of order) {
    if (picks.length >= n) break; if (picks.includes(w)) continue;
    const c = catOf(w);
    if (pass < 2 && c && cats.has(c)) continue; if (pass === 0 && c && recent.has(c)) continue;
    picks.push(w); if (c) cats.add(c);
  }
  return picks.slice(0, n);
}

/* Laravel stores JSON through PHP arrays: an empty object returns as [] and {"0":x} as [x]. Normalise on read. */
const obj = v => (v && typeof v === 'object') ? (Array.isArray(v) ? Object.assign({}, v) : v) : {};
const arr = v => Array.isArray(v) ? v : (v && typeof v === 'object' ? Object.values(v) : []);
function normalizeState(raw) {
  const s = obj(raw); if (!s.game) return s;
  s.settings = obj(s.settings); s.settings.custom = arr(s.settings.custom); s.scores = obj(s.scores); s.names = obj(s.names);
  s.order = arr(s.order); s.joined = obj(s.joined); s.draw = arr(s.draw); s.chat = arr(s.chat); s.inbox = arr(s.inbox); s.used = arr(s.used);
  if (s.turn && typeof s.turn === 'object') {
    const t = s.turn = obj(s.turn); t.guessed = obj(t.guessed); t.elig = arr(t.elig);
    // rooms started before the drawer-score change: fill the new fields so the reveal and duties never see undefined
    t.drawerPts = Number(t.drawerPts) || 0; if (t.drawerBase === undefined) t.drawerBase = t.drawerPts; t.drawerBonus = Number(t.drawerBonus) || 0;
    t.drew = !!t.drew; t.emptyAt = Number(t.emptyAt) || 0;
  } else s.turn = null;
  return s;
}
function normalizeRoom(d) { if (d && !d.unchanged && d.code) { d.state = normalizeState(d.state); d.private = obj(d.private); if (d.private.turn) d.private.turn = obj(d.private.turn); d.players = arr(d.players); d.events = arr(d.events); } return d; }

/* ---------- Shared room state (public; never holds the secret word until the reveal) ---------- */
function seated(players) { return (players || []).filter(p => !p.spectator).sort((a, b) => (a.seat ?? 0) - (b.seat ?? 0)); }
/** Presence: s.seen[id] = server ms of that player's last write (every write stamps it; idle clients ping). A seated
 *  player with no stamp/activity for goneMs counts as gone (closed tab / lost connection): not host, not drawer, not a
 *  required guesser, not counted for "fewer than 2 -> game over". fallback(id) adds locally observed activity. */
function liveSeated(s, players, now, goneMs, fallback) {
  const seen = obj(s && s.seen);
  return seated(players).filter(p => now - Math.max(Number(seen[p.id]) || 0, fallback ? Number(fallback(p.id)) || 0 : 0) <= goneMs);
}
/** Last sign of life of anyone except `me` in a room (state stamps, host beat, other players' events). */
function lastLife(d, me) {
  const s = obj(d && d.state), seen = obj(s.seen); let t = Number(s.hostSeenAt) || 0;
  for (const id of Object.keys(seen)) if (String(id) !== String(me)) t = Math.max(t, Number(seen[id]) || 0);
  for (const ev of arr(d && d.events)) if (ev && ev.playerId !== me && ev.type !== 'join') { const c = Date.parse(ev.createdAt || ''); if (Number.isFinite(c)) t = Math.max(t, c); }
  return t;
}
function newState(settings) {
  return { game: GAME, schema: SCHEMA, hostId: null, hostSeenAt: 0, phase: 'lobby', settings: Object.assign({ rounds: 3, drawTime: 80, lang: 'id', custom: [] }, settings || {}),
    order: [], round: 0, turnIdx: 0, turn: null, scores: {}, names: {}, draw: [], chat: [], inbox: [], used: [] };
}
function supported(s) { return !!s && s.game === GAME && s.schema === SCHEMA; }
// shared (GM) tag: state.gm = { p<playerId>: 1 }; the p prefix keeps it an object through PHP
const gmKey = id => 'p' + id;
function isGm(s, id) { return id != null && !!(s && s.gm && typeof s.gm === 'object' && s.gm[gmKey(id)]); }
/** t240u: lobby-only host hand-off to another live seated player; null = not allowed (race-safe: rebuilt on the fresh server state) */
function handHost(s, by, to, players, now) {
  if (!supported(s) || s.hostId !== by || (s.phase || 'lobby') !== 'lobby' || to == null || String(to) === String(by)) return null;
  const p = seated(players).find(q => String(q.id) === String(to)); if (!p) return null;
  const x = copy(s); x.hostId = p.id; x.hostSeenAt = x.hostSince = now; pushChat(x, { k: 'sys', m: 'host', p: p.id }); return x;
}
function pushChat(s, entry) { s.chat = (s.chat || []).concat([Object.assign({ i: rid(6) }, entry)]).slice(-LIMITS.chatKeep); }
function nameMap(players, prev) { const m = Object.assign({}, prev || {}); for (const p of seated(players)) m[p.id] = String(p.displayName || '').slice(0, LIMITS.nameMax); return m; }
function beginTurn(s, drawer, now, g) {
  s.phase = 'choosing'; s.draw = []; s.inbox = [];
  s.turn = { id: rid(8), drawer, until: now + g.chooseSeconds * 1000, startedAt: 0, total: 0, pk: null, secure: false, hint: '', hints: null, guessed: {}, word: null, words: null, reason: null, drawerPts: 0, drawerBase: 0, drawerBonus: 0, elig: [], drew: false, emptyAt: 0, seen: now, revealUntil: 0 };
  pushChat(s, { k: 'sys', m: 'choosing', p: drawer });
}
function startGame(state, players, now, g) {
  const s = copy(state), list = seated(players);
  s.order = list.map(p => p.id); s.round = 1; s.turnIdx = 0; s.used = arr(s.used).slice(-LIMITS.usedKeep); /* words stay "used" across rematches in the same room */ s.chat = arr(s.chat).slice(-LIMITS.chatKeep); /* t362u: chat history survives rematch (keep names of people still quoted in it) */ const talk = new Set(s.chat.map(c => c && c.p).filter(Boolean)), oldNames = {}; for (const k of Object.keys(obj(s.names))) if (talk.has(Number(k)) || talk.has(k)) oldNames[k] = s.names[k]; s.names = nameMap(players, oldNames);
  s.scores = {}; for (const id of s.order) s.scores[id] = 0; s.joined = {}; s.rounds = roundsFor(s.order.length, s.settings.rounds, g);
  pushChat(s, { k: 'sys', m: 'start' });
  beginTurn(s, s.order[0], now, g);
  return s;
}
function finishTurn(s, now, g, word, reason, players) {
  const t = s.turn; if (!t) return s;
  const guessed = obj(t.guessed), pts = Object.keys(guessed).map(id => (guessed[id] && guessed[id].pts) || 0);
  const r = word && reason !== 'empty' ? drawerPoints(pts, eligibleGuessers(t, players), g) : { base: 0, bonus: 0, total: 0 };
  const multi = isMulti(word); t.words = multi ? Object.fromEntries(specLangs(word).map(l => [l, word[l]])) : null;
  t.word = word ? wordFor(word, multi ? 'en' : specLangs(word)[0]) : null; t.reason = reason || null; t.drawerPts = r.total; t.drawerBase = r.base; t.drawerBonus = r.bonus;
  if (t.drawerPts) s.scores[t.drawer] = (s.scores[t.drawer] || 0) + t.drawerPts;
  if (word) s.used = (s.used || []).concat([wordKey(word)]).slice(-LIMITS.usedKeep);
  s.phase = 'reveal'; s.inbox = []; t.revealUntil = now + (word && reason !== 'empty' ? g.revealSeconds : reason === 'empty' ? 4 : 3) * 1000; t.pk = null;
  pushChat(s, Object.assign({ k: 'sys', m: reason === 'empty' ? 'empty' : word ? 'reveal' : (reason || 'skip'), p: t.drawer, t: t.word || '' }, multi && reason !== 'empty' ? { w: t.words } : {}));
  return s;
}
/** Host: move from the reveal to the next drawer, or finish the game. */
function advance(state, players, now, g) {
  const s = copy(state), present = new Set(seated(players).map(p => p.id));
  if (present.size < 2) { s.phase = 'over'; s.turn = null; s.inbox = []; pushChat(s, { k: 'sys', m: 'over' }); return s; }
  let idx = s.turnIdx, round = s.round;
  for (let guard = 0; guard < s.order.length * (g.maxRounds || 10) + 2; guard++) {
    idx++; if (idx >= s.order.length) { idx = 0; round++; }
    const last = Number(s.rounds) || s.settings.rounds;
    if (round > last) { s.phase = 'over'; s.turn = null; s.inbox = []; s.round = last; pushChat(s, { k: 'sys', m: 'over' }); return s; }
    if (present.has(s.order[idx])) { s.turnIdx = idx; s.round = round; beginTurn(s, s.order[idx], now, g); return s; }
  }
  s.phase = 'over'; s.turn = null; return s;
}
function resetToLobby(state) { const s = copy(state); Object.assign(s, { phase: 'lobby', order: [], round: 0, turnIdx: 0, turn: null, scores: {}, joined: {}, rounds: 0, draw: [], inbox: [] }); pushChat(s, { k: 'sys', m: 'lobby' }); return s; }
function ranking(s, players) {
  const names = Object.assign({}, s.names || {}); for (const p of players || []) names[p.id] = p.displayName;
  const ids = Object.keys(s.scores || {});
  const rows = ids.map(id => ({ id: Number(id), name: names[id] || '—', score: s.scores[id] || 0, present: (players || []).some(p => String(p.id) === String(id)) })).sort((a, b) => b.score - a.score);
  let place = 0, last = null; rows.forEach((r, i) => { if (r.score !== last) { place = i + 1; last = r.score; } r.place = place; });
  return rows;
}

/* ---------- Private guess channel: ECDH P-256 + AES-GCM (same approach as the Exploding Kitten table) ---------- */
const subtle = () => root.crypto && root.crypto.subtle;
const toB64 = buf => { const b = new Uint8Array(buf); let s = ''; for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]); return btoa(s); };
const fromB64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
const EC = { name: 'ECDH', namedCurve: 'P-256' };
async function turnKeys() {
  if (!subtle()) return null;
  const pair = await subtle().generateKey(EC, true, ['deriveKey']);
  return { pub: toB64(await subtle().exportKey('raw', pair.publicKey)), jwk: await subtle().exportKey('jwk', pair.privateKey) };
}
async function seal(pubB64, value, aad) {
  const eph = await subtle().generateKey(EC, true, ['deriveKey']);
  const theirs = await subtle().importKey('raw', fromB64(pubB64), EC, false, []);
  const key = await subtle().deriveKey({ name: 'ECDH', public: theirs }, eph.privateKey, { name: 'AES-GCM', length: 256 }, false, ['encrypt']);
  const iv = root.crypto.getRandomValues(new Uint8Array(12));
  const c = await subtle().encrypt({ name: 'AES-GCM', iv, additionalData: new TextEncoder().encode(aad) }, key, new TextEncoder().encode(JSON.stringify(value)));
  return { e: toB64(await subtle().exportKey('raw', eph.publicKey)), iv: toB64(iv), c: toB64(c) };
}
async function unseal(jwk, box, aad) {
  const mine = await subtle().importKey('jwk', jwk, EC, false, ['deriveKey']);
  const theirs = await subtle().importKey('raw', fromB64(box.e), EC, false, []);
  const key = await subtle().deriveKey({ name: 'ECDH', public: theirs }, mine, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
  const plain = await subtle().decrypt({ name: 'AES-GCM', iv: fromB64(box.iv), additionalData: new TextEncoder().encode(aad) }, key, fromB64(box.c));
  return JSON.parse(new TextDecoder().decode(plain));
}

/* ---------- Platform transport (/api/game + Reverb, no library) ---------- */
function gameSubdomain(hostname) { const m = /^([a-z0-9-]+)\.jadidaring\.(?:com|test)$/i.exec(String(hostname || '')); return m ? m[1].toLowerCase() : null; }
class Connection {
  constructor({ location = root.location, fetch = root.fetch, Socket = root.WebSocket, storage = null, now = () => Date.now(), onWake = () => {}, onSocket = () => {}, lobbyWake = () => {}, timers = null, random = Math.random, reconnectMaxMs = 15000 } = {}) {
    this.location = location; this.fetchFn = typeof fetch === "function" ? fetch.bind(root) : null; this.Socket = Socket; this.storage = storage; this.now = now; this.onWake = onWake; this.onSocket = onSocket; this.lobbyWake = lobbyWake;
    this.timers = timers || { setTimeout: (f, ms) => root.setTimeout(f, ms), clearTimeout: id => root.clearTimeout(id), setInterval: (f, ms) => root.setInterval(f, ms), clearInterval: id => root.clearInterval(id) };
    this.random = random; this.reconnectMaxMs = reconnectMaxMs; this.attempts = 0; this.state = 'idle'; this.lastError = null; this.stats = { sockets: 0, catchUps: 0, wakeups: 0, errors: 0 };
    this.allowed = !!location && /^https?:$/.test(location.protocol) && !!gameSubdomain(location.hostname);
    this.config = null; this.code = null; this.token = null; this.version = null; this.latest = null; this.socket = null; this.channel = null; this.ready = false; this.subscribed = false; this.stopped = false; this.retry = 1000; this.backoffUntil = 0;
    this.lo = -Infinity; this.hi = Infinity; this.offset = 0;
    try { const s = JSON.parse((storage && storage.getItem('drawguess.session')) || 'null'); if (s && s.origin === location.origin && /^[A-Z2-9]{6}$/.test(s.code) && typeof s.token === 'string') { this.code = s.code; this.token = s.token; } } catch (e) { /* ignore */ }
  }
  serverNow() { return this.now() + this.offset; }
  clock(dateHeader, sent, received) {
    const d = Date.parse(dateHeader || ''); if (!Number.isFinite(d)) return;
    const lo = d - received, hi = d + 1000 - sent;
    if (Math.max(lo, this.lo) > Math.min(hi, this.hi)) { this.lo = lo; this.hi = hi; } else { this.lo = Math.max(lo, this.lo); this.hi = Math.min(hi, this.hi); }
    this.offset = Math.round((this.lo + this.hi) / 2);
  }
  save() { try { if (!this.storage) return; if (this.code && this.token) this.storage.setItem('drawguess.session', JSON.stringify({ origin: this.location.origin, code: this.code, token: this.token })); else this.storage.removeItem('drawguess.session'); } catch (e) { /* ignore */ } }
  async request(path, { body, auth = true } = {}) {
    if (!this.allowed) { const e = Error('offline'); e.code = 'offline'; throw e; }
    if (this.now() < this.backoffUntil) { const e = Error('busy'); e.status = 429; e.code = 'busy'; e.wait = Math.ceil((this.backoffUntil - this.now()) / 1000); throw e; }
    const headers = { 'Accept': 'application/json', 'Content-Type': 'application/json' };
    if (auth && this.token) headers.Authorization = 'Bearer ' + this.token;
    const sent = this.now(); let res;
    try {
      const opts = { method: body === undefined ? 'GET' : 'POST', headers, credentials: 'same-origin', cache: 'no-store' };
      if (body !== undefined) opts.body = JSON.stringify(body);
      if (root.AbortSignal && AbortSignal.timeout) opts.signal = AbortSignal.timeout(20000);
      res = await this.fetchFn('/api/game/' + path, opts);
    } catch (e) { const err = Error('network'); err.code = 'network'; throw err; }
    this.clock(res.headers && res.headers.get && res.headers.get('Date'), sent, this.now());
    let data = {}; try { data = await res.json(); } catch (e) { data = {}; }
    if (!res.ok) {
      const err = Error(data.error || data.message || ('HTTP ' + res.status)); err.status = res.status; err.server = data.error || data.message || '';
      if (res.status === 429) { this.backoffUntil = this.now() + Math.max(1, Number(res.headers && res.headers.get && res.headers.get('Retry-After')) || 10) * 1000 + rnd(1000); err.code = 'busy'; }
      throw err;
    }
    return data;
  }
  async start() {
    if (this.config) { if (this.stopped) { this.stopped = false; this.openSocket(); } return this.config; }
    if (this.starting) return this.starting;
    this.starting = (async () => {
      const c = await this.request('config', { auth: false }), w = c.websocket, sub = gameSubdomain(this.location.hostname), prefix = 'game.' + sub;
      if (c.game !== sub || !c.database || c.database.shared !== true || c.database.isolatedBy !== 'subdomain' || !w || w.channelPrefix !== prefix || w.lobbyChannel !== prefix || w.roomChannel !== prefix + '.{code}') { const e = Error('mismatch'); e.code = 'mismatch'; throw e; }
      if (!w.enabled || !w.url) { const e = Error('disabled'); e.code = 'disabled'; throw e; }
      const url = new URL(w.url); if (!['ws:', 'wss:'].includes(url.protocol) || (this.location.protocol === 'https:' && url.protocol !== 'wss:')) { const e = Error('badsocket'); e.code = 'mismatch'; throw e; }
      this.config = c; this.stopped = false; this.openSocket(); return c;
    })();
    try { return await this.starting; } finally { this.starting = null; }
  }
  desiredChannel() { const w = this.config.websocket; return this.code ? w.channelPrefix + '.' + this.code : w.lobbyChannel; }
  /* Realtime is socket-only: there is no HTTP polling loop. Reads happen on join, on room.updated wakeups,
     once after every (re)subscribe (catch-up), when the tab becomes visible, and after a 409. */
  setState(st) { if (this.state !== st) { this.state = st; this.onSocket(st === 'online', st); } }
  subscribe() {
    if (!this.ready || !this.socket || this.socket.readyState !== 1) return; const next = this.desiredChannel(); if (next === this.channel) return;
    if (this.channel) this.socket.send(JSON.stringify({ event: 'pusher:unsubscribe', data: { channel: this.channel } }));
    this.channel = next; this.subscribed = false; this.setState('subscribing'); this.socket.send(JSON.stringify({ event: 'pusher:subscribe', data: { channel: next } }));
  }
  /** exponential backoff 1s→2s→4s… capped, ±25% jitter */
  backoffDelay(hint) {
    const base = hint === 'now' ? 1000 : hint === 'max' ? this.reconnectMaxMs : Math.min(this.reconnectMaxMs, 1000 * Math.pow(2, this.attempts));
    return Math.round(base * (0.75 + this.random() * 0.5));
  }
  scheduleReconnect(hint) {
    if (this.stopped || this.reconnectTimer) return;
    const delay = this.backoffDelay(hint); this.attempts++; this.nextRetryAt = this.now() + delay; this.setState('reconnecting');
    this.reconnectTimer = this.timers.setTimeout(() => { this.reconnectTimer = null; this.openSocket(); }, delay);
  }
  openSocket() {
    if (this.stopped || !this.config || !this.Socket) return;
    if (this.reconnectTimer) { this.timers.clearTimeout(this.reconnectTimer); this.reconnectTimer = null; }
    let ws; try { ws = this.socket = new this.Socket(this.config.websocket.url); } catch (e) { this.socket = null; this.scheduleReconnect(); return; }
    this.stats.sockets++; this.ready = false; this.channel = null; this.subscribed = false; this.setState(this.attempts ? 'reconnecting' : 'connecting'); this.errorHint = null;
    ws.onmessage = ev => {
      if (ws !== this.socket) return; this.lastMessage = this.now(); let frame, data;
      try { frame = JSON.parse(ev.data); data = typeof frame.data === 'string' ? JSON.parse(frame.data) : frame.data; } catch (e) { return; }
      if (frame.event === 'pusher:connection_established') {
        this.ready = true; this.subscribe();
        this.timers.clearInterval(this.heartbeat);
        const activity = Math.max(10, Math.min(120, Number(data && data.activity_timeout) || 30)) * 1000;
        this.heartbeat = this.timers.setInterval(() => { if (this.now() - this.lastMessage > activity * 2) { ws.close(); return; } if (ws.readyState === 1) ws.send(JSON.stringify({ event: 'pusher:ping', data: {} })); }, activity);
      }
      else if (frame.event === 'pusher:ping') { if (ws.readyState === 1) ws.send(JSON.stringify({ event: 'pusher:pong', data: {} })); }
      else if (frame.event === 'pusher:error') {
        // Pusher protocol: 4000–4099 do not retry unchanged (back off to max), 4100–4199 retry with backoff, 4200–4299 retry soon.
        const code = Number(data && data.code); this.stats.errors++; this.lastError = { code: code || null, message: String((data && data.message) || '') };
        this.errorHint = code >= 4000 && code < 4100 ? 'max' : code >= 4200 && code < 4300 ? 'now' : null;
        if (code >= 4000 && code < 4300 && ws.readyState < 2) ws.close();
      }
      else if (frame.event === 'pusher_internal:subscription_succeeded' && frame.channel === this.channel) {
        this.subscribed = true; this.attempts = 0; this.setState('online'); this.stats.catchUps++;
        if (this.code) this.onWake({ catchUp: true }); else this.lobbyWake({ catchUp: true });
      }
      else if (frame.event === this.config.websocket.event && frame.channel === this.channel) {
        if (this.code) { if (data && data.code === this.code && Number(data.version) > (this.version ?? -1)) { this.stats.wakeups++; this.onWake(data); } }
        else this.lobbyWake(data);
      }
    };
    ws.onerror = () => { if (ws.readyState < 2) ws.close(); };
    ws.onclose = () => {
      if (ws !== this.socket) return; this.socket = null; this.ready = false; this.subscribed = false; this.channel = null; this.timers.clearInterval(this.heartbeat);
      if (!this.stopped) this.scheduleReconnect(this.errorHint); else this.setState('idle');
    };
  }
  /** one catch-up read when the tab becomes visible again (no-op without a room) */
  visible() { if (!this.config || this.stopped) return; if (!this.socket && !this.reconnectTimer) this.openSocket(); else if (this.reconnectTimer && this.state === 'reconnecting') { this.timers.clearTimeout(this.reconnectTimer); this.reconnectTimer = null; this.openSocket(); } if (this.code) this.onWake({ visible: true }); else this.lobbyWake({ visible: true }); }
  adopt(data) { normalizeRoom(data); if (data && !data.unchanged && data.code && (!this.latest || this.latest.code !== data.code || data.version >= this.latest.version)) { this.latest = data; this.version = data.version; } return data; }
  async enter(mode, { displayName, code, maxPlayers, state } = {}) {
    await this.start();
    if (this.code && this.token) { try { await this.leave(); } catch (e) { this.forget(); } }
    const common = { displayName: String(displayName || 'Tamu').slice(0, 40) }, create = Object.assign({}, common, { maxPlayers, state, private: {} });
    let data;
    if (mode === 'private' || mode === 'public') data = await this.request('rooms', { body: Object.assign({}, create, { visibility: mode }), auth: false });
    else if (mode === 'match') data = await this.request('rooms/match', { body: create, auth: false });
    else if (mode === 'watch') data = await this.request('rooms/' + encodeURIComponent(code) + '/watch', { body: common, auth: false });
    else data = await this.request('rooms/join', { body: Object.assign({}, common, { code, private: {} }), auth: false });
    if (typeof data.playerToken !== 'string' || !/^[A-Z2-9]{6}$/.test(data.code)) throw Error('no-session');
    this.code = data.code; this.token = data.playerToken; this.latest = null; this.version = null; this.adopt(data); this.save(); this.subscribe(); return data;
  }
  async rooms(gm) { return this.request('rooms' + (gm ? '?gm=' + encodeURIComponent(gm) : ''), { auth: false }); } /* gm: GM key -> public + private */
  /** typed GM claim (403 = wrong code) */
  async gamemaster(code) { if (!this.code || !this.token) { const e = Error('no-room'); e.code = 'noroom'; throw e; } return this.adopt(await this.request('rooms/' + this.code + '/gamemaster', { body: { code: String(code || '') } })); }
  async read({ full = false } = {}) { const code = this.code; if (!code) return null; const data = await this.request('rooms/' + code + (full || this.version === null ? '' : '?since=' + this.version)); if (code === this.code) this.adopt(data); return data; }
  /** build(latest) returns {state?, private?, status?, payload?} or null. A 409 refetches and retries once. */
  async write(type, build) {
    for (let attempt = 0; attempt < 2; attempt++) {
      const latest = this.latest || await this.read({ full: true });
      const body = await build(latest); if (!body) return null;
      // rooms started by older builds are 'playing' (closed to rooms/join); reopen them on the next state write
      if (body.state && latest.status === 'playing' && body.status === undefined) body.status = 'waiting';
      const req = Object.assign({ payload: {} }, body, { type, expectedVersion: latest.version });
      if (req.state && bytes(req.state) > LIMITS.stateMax) { const e = Error('state-too-large'); e.code = 'toolarge'; throw e; }
      if (req.private && bytes(req.private) > LIMITS.privateMax) { const e = Error('private-too-large'); e.code = 'toolarge'; throw e; }
      try { return this.adopt(await this.request('rooms/' + this.code + '/actions', { body: req })); }
      catch (e) { if (e.status !== 409 || attempt) throw e; this.latest = null; await this.read({ full: true }); }
    }
    return null;
  }
  async leave() { if (this.code && this.token) await this.request('rooms/' + this.code + '/leave', { body: {} }); this.forget(); }
  leaveBeacon() {
    if (!this.allowed || !this.code || !this.token || !this.fetchFn) return false;
    try { const p = this.fetchFn('/api/game/rooms/' + this.code + '/leave', { method: 'POST', keepalive: true, credentials: 'same-origin', headers: { 'Accept': 'application/json', 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + this.token }, body: '{}' }); if (p && p.catch) p.catch(() => {}); } catch (e) { /* page is going away */ }
    this.forget(); return true;
  }
  forget() { this.latest = null; this.code = null; this.token = null; this.version = null; this.save(); this.subscribe(); }
  stop() { this.stopped = true; if (this.reconnectTimer) this.timers.clearTimeout(this.reconnectTimer); this.reconnectTimer = null; this.timers.clearInterval(this.heartbeat); if (this.socket) this.socket.close(); this.setState('idle'); }
}

/* ---------- Online coordinator: host runs round flow, the drawer judges guesses with the secret word ---------- */
class OnlineGame {
  constructor(net, cfg, { onChange = () => {}, onNotice = () => {} } = {}) {
    this.net = net; this.cfg = cfg; this.g = cfg.game; this.rt = Object.assign({ mode: 'socket', hostHeartbeatSeconds: 10, hostStaleSeconds: 30, presenceSeconds: 20, goneSeconds: 60, staleRoomSeconds: 120 }, cfg.realtime || {}); this.onChange = onChange; this.onNotice = onNotice;
    this.tail = Promise.resolve(); this.data = null; this.localOps = []; this.live = null; this.opsRev = 0; this.sentRev = -1; this.opsTurn = null;
    this.lastWrite = 0; this.writes = []; this.authors = new Map(); this.unverified = new Map(); this.choices = null; this.choicesFor = null; this.myGuesses = new Map(); this.outbox = []; this.opened = new Map(); this.full = false; this.reading = false; this.readAgain = false; this.lastRead = 0;
  }
  serial(work) { const next = this.tail.then(work); this.tail = next.catch(() => {}); return next; }
  get me() { return this.data ? this.data.playerId : null; }
  get s() { return (this.data && this.data.state) || {}; }
  now() { return this.net.serverNow(); }
  players() { return (this.data && this.data.players) || []; }
  isHost() { return !!this.data && this.s.hostId === this.me && !this.data.spectator; }
  isDrawer() { return !!this.s.turn && this.s.turn.drawer === this.me && !this.data.spectator; }
  receive(data) {
    if (!data || data.unchanged || !data.code) return; normalizeRoom(data);
    if (this.data && this.data.code === data.code && data.version < this.data.version) return;
    this.data = data; this.noteEvents(data);
    const s = data.state || {};
    if (s.phase === 'drawing' && s.turn && s.turn.drawer === this.me && this.opsTurn !== s.turn.id) { this.opsTurn = s.turn.id; this.localOps = cleanOps(s.draw); this.live = null; this.opsRev++; this.sentRev = this.opsRev; this.full = false; }
    if (!s.turn || s.phase !== 'drawing') { if (this.outbox.length) this.outbox = []; }
    this.onChange(this);
  }
  noteEvents(d) { this.acts = this.acts || new Map(); for (const ev of (d && d.events) || []) { if (!ev) continue; const c = Date.parse(ev.createdAt || ''); if (ev.playerId != null && Number.isFinite(c) && c > (this.acts.get(ev.playerId) || 0)) this.acts.set(ev.playerId, c); if (ev.type === 'dg.guess' && ev.payload && typeof ev.payload.i === 'string') this.authors.set(ev.payload.i, ev.playerId); } if (this.authors.size > 600) this.authors.delete(this.authors.keys().next().value); }
  /** server-owned GM flag */
  isGamemaster(id) { const d = this.data; if (!d) return false; if (id == null) id = d.playerId; const p = (d.players || []).find(q => q.id === id); return !!(p ? p.gamemaster : (id === d.playerId && d.gamemaster)); }
  claimGamemaster(code) { if (!this.net.gamemaster) return Promise.reject(Error('offline')); return this.serial(async () => { const d = await this.net.gamemaster(code); this.receive(d); return d; }); }
  async enter(mode, opts) { const data = await this.net.enter(mode, Object.assign({}, opts, { state: newState(opts.settings) })); this.data = null; this.receive(data); return data; }
  async resume() { const data = await this.net.read({ full: true }); this.receive(data); return data; }
  /** Event-driven read (wakeup / catch-up / visibility / user action). Coalesced: one read in flight, one queued. */
  async refresh(full) {
    if (this.reading) { this.readAgain = true; return; }
    this.reading = true;
    try { do { this.readAgain = false; this.reads = (this.reads || 0) + 1; const d = await this.net.read({ full: !!full }); this.receive(d); full = false; } while (this.readAgain); }
    catch (e) {
      // 429: retry exactly once when Retry-After expires (one-shot, not a polling loop)
      if (e.status === 429 && !this.busyRetry) { const wait = Math.max(0, (this.net.backoffUntil || 0) - this.net.now()) + 50; this.busyRetry = this.net.timers.setTimeout(() => { this.busyRetry = null; this.refresh().catch(() => {}); }, wait); }
      throw e;
    }
    finally { this.reading = false; }
  }
  budgetOk(essential) { const t = this.net.now(); this.writes = this.writes.filter(x => t - x < 60000); return this.writes.length < (essential ? 115 : 95); }
  async send(type, build, essential) {
    if (!this.budgetOk(essential)) return null;
    this.writes.push(this.net.now()); this.lastWrite = this.net.now();
    const res = await this.net.write(type, async d => { const r = await build(d); return r ? this.stamp(d, r) : r; }); if (res) this.receive(res); return res;
  }
  /** every write by a seated player refreshes its presence stamp (and drops stamps of players no longer in the room) */
  stamp(d, r) {
    if (!r.state || !supported(r.state) || d.spectator) return r;
    const ids = new Set(seated(d.players).map(p => String(p.id))), seen = {};
    for (const [id, t] of Object.entries(obj(r.state.seen))) if (ids.has(String(id))) seen[id] = t;
    seen[d.playerId] = this.now(); r.state.seen = seen; return r;
  }
  /** seated players that are still alive (see liveSeated); this client always counts itself */
  liveSeated(d) {
    d = d || this.data; if (!d) return [];
    const me = d.playerId, gone = this.rt.goneSeconds * 1000, now = this.now(), blind = !this.lastDuty || now - this.lastDuty > 5000 ? now : 0; /* not watching lately -> no verdicts */
    return liveSeated(d.state, d.players, now, gone, id => id === me ? Infinity : Math.max(this.firstSeen(id), (this.acts && this.acts.get(id)) || 0, this.resumedAt || 0, blind));
  }
  /** players list without the gone seats (spectators kept), for the pure rule functions */
  livePlayers(d) { d = d || this.data; if (!d) return []; const ids = new Set(this.liveSeated(d).map(p => p.id)); return arr(d.players).filter(p => p.spectator || ids.has(p.id)); }
  /** a quick-match landed us in a room nobody else has touched for staleRoomSeconds (closed tabs never call leave) */
  abandoned(d) {
    d = d || this.data; if (!d || d.spectator || !supported(d.state)) return false;
    const others = seated(d.players).filter(p => p.id !== d.playerId);
    return others.length > 0 && this.now() - lastLife(d, d.playerId) > this.rt.staleRoomSeconds * 1000;
  }
  /** close such a room (any seated player may set status) and leave it, so it drops out of the list and quick match */
  async closeAbandoned() {
    try { await this.send('dg.close', d => this.abandoned(d) ? { state: copy(d.state), status: 'closed' } : null, true); } catch (e) { /* best effort */ }
    try { await this.net.leave(); } catch (e) { this.net.forget(); }
    this.data = null;
  }
  /* ----- periodic duties (call every ~250 ms) ----- */
  tick() { return this.serial(() => this.duties().catch(e => { if (e.status !== 409 && e.code !== 'busy') this.onNotice(e); })); }
  async duties() {
    if (!this.data || this.data.spectator || this.data.status === 'closed' || !supported(this.s)) return;
    const now = this.now(), gap = this.net.now() - this.lastWrite;
    /* this client was asleep (frozen tab, laptop lid): others' stamps look old only because we did not watch -> give them a fresh grace window */
    if (this.lastDuty && now - this.lastDuty > 5000) this.resumedAt = now; this.lastDuty = now;
    if (await this.takeover(now)) return;
    if (gap < 450) return;
    if (this.unseated(this.s, this.players()).includes(this.me) && await this.seatSelf()) return;
    if (this.isDrawer() && await this.drawerDuty(now)) return;
    if (this.outbox.length && gap >= 500 && await this.flushGuess()) return;
    if (this.isHost() && await this.hostDuty(now)) return;
    if (now - (Number(obj(this.s.seen)[this.me]) || 0) > this.rt.presenceSeconds * 1000 && gap >= this.rt.presenceSeconds * 500) await this.send('dg.here', d => supported(d.state) ? { state: copy(d.state) } : null, true);
  }
  /** Seated players missing from a running game's draw order (mid-game joiners not registered yet). */
  unseated(s, players) { if (!['choosing', 'drawing', 'reveal'].includes(s.phase)) return []; const order = new Set(arr(s.order).map(String)); return seated(players).map(p => p.id).filter(id => !order.has(String(id))); }
  /** Mid-game joiner registers itself (the host's duty is the backstop if this client is gone or keeps losing races). */
  async seatSelf() {
    if (this.seatTry && this.net.now() - this.seatTry < 1500) return false; this.seatTry = this.net.now();
    await this.send('dg.join', d => { if (!supported(d.state)) return null; const s = copy(d.state); return seatLate(s, this.livePlayers(d), this.now()) ? { state: s } : null; }, true);
    return true;
  }
  /** watchdog: the host still heartbeats but the turn is long overdue (host tab stuck / old build) -> others may take over */
  stalled(s, now) {
    const t = s.turn, slack = this.rt.hostStaleSeconds * 1000; if (!t) return false;
    if (now - (Number(s.hostSince) || 0) <= slack) return false; /* a fresh host gets its own grace before it can be judged */
    return (s.phase === 'reveal' && now > t.revealUntil + slack) || (s.phase === 'choosing' && now > t.until + 6000 + slack) || (s.phase === 'drawing' && now > t.until + 8000 + slack);
  }
  hostCandidate(s, players) {
    const list = seated(players), present = list.some(p => p.id === s.hostId), stale = s.hostId && (this.now() - (s.hostSeenAt || 0) > this.rt.hostStaleSeconds * 1000 || this.stalled(s, this.now()));
    if (s.hostId && present && !stale) return null;
    const pool = list.filter(p => p.id !== s.hostId || !stale);
    return pool.length ? pool[0].id : null;
  }
  async takeover(now) {
    // only judge staleness from a live socket view; a stale local copy could misread a healthy host (a 409 would also stop it)
    if (this.net.Socket && this.net.state !== 'online') return false;
    if (this.hostCandidate(this.s, this.livePlayers()) !== this.me) return false;
    await this.send('dg.host', d => { if (!supported(d.state) || this.hostCandidate(d.state, this.livePlayers(d)) !== d.playerId) return null; const s = copy(d.state); s.hostId = d.playerId; s.hostSeenAt = s.hostSince = this.now(); return { state: s }; }, true);
    return true;
  }
  async hostDuty(now) {
    const s = this.s, players = this.livePlayers(), present = new Set(seated(players).map(p => p.id));
    const playing = ['choosing', 'drawing', 'reveal'].includes(s.phase);
    let reason = null;
    if (playing && present.size < 2) reason = 'over';
    else if (s.phase === 'reveal' && now >= s.turn.revealUntil) reason = 'advance';
    else if (s.phase === 'choosing' && (!present.has(s.turn.drawer) || now > s.turn.until + 6000)) reason = 'skip';
    else if (s.phase === 'drawing' && (!present.has(s.turn.drawer) || now > s.turn.until + 8000 || now - (s.turn.seen || 0) > 25000 || this.emptyOverdue(s, now))) reason = 'skip';
    else if (this.unseated(s, players).some(id => id !== this.me && now - (this.firstSeen(id) || now) > 2500)) reason = 'join';
    else if (now - (s.hostSeenAt || 0) > this.rt.hostHeartbeatSeconds * 1000) reason = 'beat';
    if (!reason) return false;
    await this.send('dg.' + reason, d => {
      if (!supported(d.state) || d.state.hostId !== d.playerId) return null;
      const lp = this.livePlayers(d); let x = copy(d.state), acted = true; const t = this.now(), here = new Set(seated(lp).map(p => p.id)), on = ['choosing', 'drawing', 'reveal'].includes(x.phase);
      if (on && here.size < 2) { x.phase = 'over'; x.turn = null; x.inbox = []; pushChat(x, { k: 'sys', m: 'over' }); }
      else if (x.phase === 'reveal' && t >= x.turn.revealUntil) x = advance(x, lp, t, this.g);
      else if (x.phase === 'choosing' && (!here.has(x.turn.drawer) || t > x.turn.until + 6000)) finishTurn(x, t, this.g, null, here.has(x.turn.drawer) ? 'timeout' : 'left', lp);
      else if (x.phase === 'drawing' && (!here.has(x.turn.drawer) || t > x.turn.until + 8000 || t - (x.turn.seen || 0) > 25000)) finishTurn(x, t, this.g, null, here.has(x.turn.drawer) ? 'timeout' : 'left', lp);
      else if (x.phase === 'drawing' && this.emptyOverdue(x, t)) finishTurn(x, t, this.g, null, 'empty', lp);
      else if (reason !== 'beat' && reason !== 'join') return null;
      else acted = false;
      const seatedNow = seatLate(x, lp, t); /* every host write also registers mid-game joiners */
      if (!acted && reason === 'join' && !seatedNow) return null;
      x.hostSeenAt = t;
      return { state: x };
    }, reason !== 'beat');
    return true;
  }
  /* ----- drawer ----- */
  ensureChoices() {
    const s = this.s; if (s.phase !== 'choosing' || !this.isDrawer()) return null;
    if (this.choicesFor !== s.turn.id) { this.choicesFor = s.turn.id; this.choices = pickChoices(wordPool(this.cfg, s.settings.lang, s.settings.custom), s.used, this.g.wordChoices); }
    return this.choices;
  }
  async drawerDuty(now) {
    const s = this.s, t = s.turn;
    if (s.phase === 'choosing') { if (now >= t.until && this.ensureChoices()) { await this.pickNow(rnd(this.choices.length)); return true; } return false; }
    if (s.phase !== 'drawing') return false;
    const secret = this.data.private && this.data.private.turn;
    if (!secret || secret.id !== t.id) return false;
    const frac = t.total ? (now - t.startedAt) / t.total : 0;
    const need = (this.opsRev !== this.sentRev) || (s.inbox && s.inbox.length) || hintsDue(t, secret.word, frac, this.g.hintAt) || now >= t.until || now - (t.seen || 0) > 6000 || this.allGuessed(s, this.livePlayers()) || this.emptyDue(t, now);
    if (!need || this.net.now() - this.lastWrite < 700) return false;
    await this.flushDrawer();
    return true;
  }
  /** Host backstop for the empty-canvas skip (the drawer's own client normally ends it at emptyAt; +4 s grace for its flush). */
  emptyOverdue(s, now) { const t = s.turn; return !!(t && s.phase === 'drawing' && t.emptyAt && !t.drew && !(s.draw && s.draw.length) && now >= t.emptyAt + 4000); }
  /** Drawer: nothing drawn yet this turn and the empty-canvas deadline has passed. */
  emptyDue(t, now) { return !!(t && t.emptyAt && !t.drew && this.drewFor !== t.id && !this.drawOps().length && now >= t.emptyAt); }
  allGuessed(s, players) { return turnDone(s.turn, players); }
  firstSeen(id) { this.seenAt = this.seenAt || new Map(); if (!this.seenAt.has(id)) this.seenAt.set(id, this.now()); return this.seenAt.get(id); }
  drawOps() { const ops = this.localOps.slice(); if (this.live) ops.push(this.live); return ops; }
  async openItem(item, secret, code) {
    if (this.opened.has(item.i)) return this.opened.get(item.i);
    let text = null;
    try {
      if (typeof item.t === 'string') text = item.t;
      else if (secret.jwk && item.e && item.iv && item.c) { const v = await unseal(secret.jwk, item, code + '|' + secret.id + '|' + item.p + '|' + item.i); text = typeof v.t === 'string' ? v.t : null; }
    } catch (e) { text = null; }
    if (text !== null) text = String(text).slice(0, LIMITS.textMax);
    this.opened.set(item.i, text); if (this.opened.size > 400) this.opened.delete(this.opened.keys().next().value);
    return text;
  }
  async flushDrawer() {
    const rev = this.opsRev, ops = this.drawOps();
    const res = await this.send('dg.draw', async d => {
      const s = copy(d.state), t = s.turn, secret = d.private && d.private.turn;
      if (!supported(s) || s.phase !== 'drawing' || !t || t.drawer !== d.playerId || !secret || secret.id !== t.id) return null;
      this.noteEvents(d); const keep = [];
      const now = this.now(), word = secret.word, others = seated(d.players).filter(p => p.id !== d.playerId).map(p => p.id), lp = this.livePlayers(d);
      if (opsBytes(ops) <= LIMITS.drawBudget) s.draw = ops;
      if (ops.length || this.drewFor === t.id) t.drew = true;
      for (const item of (s.inbox || [])) {
        if (!item || !others.includes(item.p)) continue;
        if (this.authors.get(item.i) !== item.p) { const n = (this.unverified.get(item.i) || 0) + 1; this.unverified.set(item.i, n); if (n < 4 && !this.authors.has(item.i)) keep.push(item); continue; }
        const text = await this.openItem(item, secret, d.code); if (text === null || !text.trim()) continue;
        if (t.guessed[item.p]) { if (!leaksAny(text, word)) pushChat(s, { k: 'gc', p: item.p, t: text, r: item.i }); continue; }
        const v = judgeAny(text, word);
        if (v === 'ok') { const pts = guessPoints(t.until - now, t.total, this.g); t.guessed[item.p] = { pts, ms: Math.max(0, now - t.startedAt) }; s.scores[item.p] = (s.scores[item.p] || 0) + pts; pushChat(s, { k: 'ok', p: item.p, r: item.i, n: pts }); }
        else if (v === 'close') pushChat(s, { k: 'close', p: item.p, r: item.i });
        else pushChat(s, { k: 'g', p: item.p, t: text, r: item.i });
      }
      s.inbox = keep;
      const frac = t.total ? (now - t.startedAt) / t.total : 0;
      growHints(t, word, frac, this.g.hintAt);
      t.seen = now;
      const done = turnDone(t, lp);
      if (done || now >= t.until) finishTurn(s, now, this.g, word, done ? 'all' : 'time', lp);
      else if (this.emptyDue(t, now)) finishTurn(s, now, this.g, word, 'empty', lp);
      if (s.hostId === d.playerId) s.hostSeenAt = now;
      return { state: s };
    }, true);
    if (res) { this.sentRev = rev; if (opsBytes(ops) > LIMITS.drawBudget) this.full = true; }
  }
  async pickNow(index) {
    const choices = this.ensureChoices(); if (!choices || !choices[index]) return null;
    const word = secretFor(this.cfg, this.s.settings.lang, choices[index]), keys = await turnKeys();
    this.localOps = []; this.live = null; this.opsRev++;
    return this.send('dg.pick', d => {
      const s = copy(d.state), t = s.turn;
      if (!supported(s) || s.phase !== 'choosing' || !t || t.drawer !== d.playerId || t.id !== this.choicesFor) return null;
      const now = this.now(), total = s.settings.drawTime * 1000;
      const skipMs = Number(this.g.emptySkipMs) || 0, elig = this.liveSeated(d).filter(p => p.id !== d.playerId).map(p => p.id);
      Object.assign(t, { startedAt: now, total, until: now + total, pk: keys ? keys.pub : null, secure: !!keys, ...startHints(word), guessed: {}, seen: now, elig, drew: false, emptyAt: skipMs > 0 ? now + skipMs : 0 });
      s.phase = 'drawing'; s.draw = []; s.inbox = []; this.opsTurn = t.id; this.sentRev = this.opsRev;
      pushChat(s, { k: 'sys', m: 'drawing', p: d.playerId });
      const priv = Object.assign({}, d.private || {}, { turn: { id: t.id, word, jwk: keys ? keys.jwk : null } });
      return { state: s, private: priv };
    }, true);
  }
  pick(index) { return this.serial(() => this.pickNow(index)); }
  /* drawing input from the board (drawer only, local until the next flush) */
  canDraw() { return this.isDrawer() && this.s.phase === 'drawing' && !!(this.data.private && this.data.private.turn && this.data.private.turn.id === this.s.turn.id); }
  commit(op) { if (!this.canDraw()) return false; const next = this.localOps.concat([op]); if (opsBytes(next) > LIMITS.drawBudget) { this.full = true; return false; } this.localOps = next; this.live = null; this.drewFor = this.s.turn.id; this.opsRev++; return true; }
  setLive(op) { if (!this.canDraw()) return; this.live = op; this.drewFor = this.s.turn.id; if (opsBytes(this.drawOps()) <= LIMITS.drawBudget) this.opsRev++; }
  undo() { if (!this.canDraw() || !this.localOps.length) return; this.localOps = this.localOps.slice(0, -1); this.full = false; this.opsRev++; }
  clearDrawing() { if (!this.canDraw()) return; this.localOps = []; this.live = null; this.full = false; this.opsRev++; }
  /* ----- chat & guesses ----- */
  chatMode() {
    const s = this.s; if (!this.data) return 'off';
    if (s.phase === 'drawing') { if (this.data.spectator || this.isDrawer()) return 'off'; return s.turn.guessed && s.turn.guessed[this.me] ? 'guessed' : 'guess'; }
    return this.data.spectator && s.phase !== 'lobby' && s.phase !== 'over' ? 'off' : 'chat';
  }
  async say(text) {
    text = String(text || '').replace(/\s+/g, ' ').trim().slice(0, LIMITS.textMax); if (!text) return null;
    const mode = this.chatMode();
    if (mode === 'off') return null;
    if (mode === 'chat') return this.serial(() => this.send('dg.chat', d => { const s = copy(d.state); if (s.phase === 'drawing') return null; pushChat(s, { k: 'm', p: d.playerId, t: text }); return { state: s }; }, true));
    const t = this.s.turn, i = rid(8), aad = this.data.code + '|' + t.id + '|' + this.me + '|' + i;
    if (this.outbox.length >= 3) { const e = Error('slow'); e.code = 'slow'; throw e; }
    const item = t.pk && subtle() ? Object.assign({ i, p: this.me }, await seal(t.pk, { t: text }, aad)) : { i, p: this.me, t: text };
    this.myGuesses.set(i, text); if (this.myGuesses.size > 200) this.myGuesses.delete(this.myGuesses.keys().next().value);
    this.outbox.push({ turn: t.id, item }); this.onChange(this);
    return this.serial(() => this.flushGuess());
  }
  async flushGuess() {
    const job = this.outbox[0]; if (!job) return false;
    try {
      await this.send('dg.guess', d => {
        const s = copy(d.state);
        if (!supported(s) || s.phase !== 'drawing' || !s.turn || s.turn.id !== job.turn) return null;
        const inbox = s.inbox || [];
        if (inbox.some(x => x.i === job.item.i) || (s.chat || []).some(c => c.r === job.item.i)) return null;
        if (inbox.length >= LIMITS.inboxMax || inbox.filter(x => x.p === d.playerId).length >= LIMITS.inboxPerPlayer) return null;
        s.inbox = inbox.concat([job.item]); return { state: s, payload: { i: job.item.i } };
      }, true);
    } catch (e) { if (e.status !== 409 && e.code !== 'busy') { this.outbox = this.outbox.filter(j => j !== job); throw e; } }
    const s = this.s, delivered = (s.inbox || []).some(x => x.i === job.item.i) || (s.chat || []).some(c => c.r === job.item.i);
    if (delivered || s.phase !== 'drawing' || !s.turn || s.turn.id !== job.turn) this.outbox = this.outbox.filter(j => j !== job);
    return true;
  }
  pendingGuesses() { const seen = new Set((this.s.chat || []).map(c => c.r).filter(Boolean)); return this.outbox.map(j => j.item.i).concat((this.s.inbox || []).filter(x => x.p === this.me).map(x => x.i)).filter((v, i, a) => a.indexOf(v) === i && !seen.has(v)).map(i => ({ i, t: this.myGuesses.get(i) || '' })); }
  /* ----- host actions ----- */
  start() { return this.serial(() => this.send('dg.start', d => {
    if (!supported(d.state) || d.state.hostId !== d.playerId || !['lobby', 'over'].includes(d.state.phase)) return null;
    const lp = this.livePlayers(d); if (seated(lp).length < this.g.minPlayers) { const e = Error('few'); e.code = 'few'; throw e; }
    const s = startGame(d.state, lp, this.now(), this.g); s.hostSeenAt = this.now(); return { state: s, status: 'waiting' }; /* stays 'waiting' so the API keeps accepting mid-game joins (rooms/join rejects any other status) */
  }, true)); }
  settings(patch) { return this.serial(() => this.send('dg.settings', d => {
    if (!supported(d.state) || d.state.hostId !== d.playerId || d.state.phase !== 'lobby') return null;
    const s = copy(d.state), g = this.g, st = s.settings;
    if (patch.rounds !== undefined && g.roundsOptions.includes(Number(patch.rounds))) st.rounds = Number(patch.rounds);
    if (patch.drawTime !== undefined && g.drawTimeOptions.includes(Number(patch.drawTime))) st.drawTime = Number(patch.drawTime);
    if (patch.lang !== undefined && hasLang(this.cfg, patch.lang)) st.lang = patch.lang;
    if (patch.custom !== undefined) st.custom = Array.from(new Set(String(patch.custom).split(/[,\n]/).map(sanitizeWord).filter(w => w.length >= 2))).slice(0, g.customWordsMax);
    s.hostSeenAt = this.now(); return { state: s };
  }, true)); }
  rematch() { return this.serial(() => this.send('dg.lobby', d => { if (!supported(d.state) || d.state.hostId !== d.playerId || d.state.phase !== 'over') return null; const s = resetToLobby(d.state); s.hostSeenAt = this.now(); return { state: s, status: 'waiting' }; }, true)); }
  transferHost(to) { return this.serial(() => this.send('dg.transferHost', d => { const s = handHost(d.state, d.playerId, to, this.livePlayers(d), this.now()); return s ? { state: s } : null; }, true)); }
  /** pagehide: free a closed tab's seat (else it lingers as an empty player); lobby/over/spectators only, not when alone */
  leaveOnHide() {
    const d = this.data; if (!d || !d.code || d.status === 'closed' || !this.net.code) return null;
    if (d.spectator) return this.net.leaveBeacon() ? { code: d.code, kind: 'watch' } : null;
    if (!supported(d.state) || !['lobby', 'over'].includes(d.state.phase || 'lobby')) return null;
    if (!seated(this.livePlayers(d)).some(p => p.id !== d.playerId)) return null;
    return this.net.leaveBeacon() ? { code: d.code, kind: 'join' } : null;
  }
  leave() { return this.serial(async () => {
    try {
      if (this.data && !this.data.spectator && supported(this.s) && this.data.status !== 'closed') {
        await this.net.write('dg.leave', d => {
          const s = copy(d.state), lp = this.livePlayers(d).filter(p => p.id !== d.playerId), others = seated(lp); let changed = false;
          if (s.hostId === d.playerId && others.length) { s.hostId = others[0].id; s.hostSeenAt = this.now(); changed = true; }
          /* last live player out: the server would hand the room to a gone seat and keep it listed forever -> close it */
          if (!others.length) { if (s.seen) delete obj(s.seen)[d.playerId]; return { state: s, status: 'closed' }; }
          if (s.turn && s.turn.drawer === d.playerId && (s.phase === 'drawing' || s.phase === 'choosing')) { const secret = d.private && d.private.turn; finishTurn(s, this.now(), this.g, secret && secret.id === s.turn.id && s.phase === 'drawing' ? secret.word : null, 'left', lp); changed = true; }
          return changed ? { state: s } : null;
        });
      }
    } catch (e) { /* leaving anyway */ }
    try { await this.net.leave(); } catch (e) { this.net.forget(); }
    this.data = null; this.outbox = []; this.myGuesses.clear(); this.opened.clear(); this.localOps = []; this.live = null; this.opsTurn = null; this.choicesFor = null;
  }); }
}

root.DG = { obj, arr, normalizeState, normalizeRoom, GAME, SCHEMA, W, H, LIMITS, A, rid, rnd, shuffle, copy, clamp, bytes, encodeStroke, encodeFill, decodeOp, opsBytes, cleanOps, norm, compact, units, setT2S, thaiFix, lev, judge, idNear, idStems, diaOK, leaksWord, LANGS, isSpec, isMulti, specLangs, variants, wordFor, judgeAny, leaksAny, wordKey, growHints, hintsDue, startHints, hintFor, parseConcepts, mergePack, inflateRaw, conceptOf, secretFor, hasLang, maskOf, letterCount, revealedCount, hintTarget, revealOne, sanitizeWord, guessPoints, drawerPoints, eligibleGuessers, requiredGuessers, turnDone, seatLate, roundsFor, liveSeated, lastLife, wordBank, wordPool, pickChoices, seated, newState, supported, pushChat, gmKey, isGm, beginTurn, startGame, finishTurn, advance, resetToLobby, ranking, turnKeys, seal, unseal, gameSubdomain, Connection, OnlineGame, handHost };
})(typeof window !== 'undefined' ? window : globalThis);

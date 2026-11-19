/* Skala Teman: pure game rules (no DOM). State lives in the shared room state.
   Loop: the hot seat rotates every round. The hot seat secretly rates a prompt 1-10 (their true score);
   everyone else guesses that number. Closest guess(es) win, distance-based points. The reveal STAYS on screen
   until the host presses Next (no auto-advance), so the room can chat and joke about it. */
(function (root) {
'use strict';
const MIN_SEATS = 2, MAX_SEATS = 8, LO = 1, HI = 10;
const LANGS = ['id', 'en', 'zh', 'ja', 'ko', 'ms', 'es', 'pt', 'th'];
const ROUNDS = [5, 8, 10, 15, 20], TIMERS = [15, 20, 30, 45, 60];
const INTRO_MS = 2400;
/** points by distance |guess - true|: 0 → 100, 1 → 60, 2 → 30, 3 → 10, else 0 */
const DIST_PTS = [100, 60, 30, 10], CLOSEST = 50, HOT_BONUS = 40, HIST = 20;
/** open chat during play: max message length, messages kept, client-side gap between sends (ms) */
const LIM = { chatMax: 120, chatKeep: 40, chatGap: 1200, nameMax: 24 };
const BOT_NAMES = ['Bot Ayu', 'Bot Bima', 'Bot Citra', 'Bot Dodo', 'Bot Eka', 'Bot Fajar', 'Bot Gita'];
const arr = v => Array.isArray(v) ? v : (v && typeof v === 'object' ? Object.values(v) : []);
const obj = v => v && typeof v === 'object' && !Array.isArray(v) ? v : {};
const num = (v, d) => Number.isFinite(Number(v)) ? Number(v) : d;
const K = id => 'p' + id;
const okVal = v => Number.isInteger(v) && v >= LO && v <= HI;
function cleanSet(x) {
  x = obj(x); const r = Number(x.r), t = Number(x.t);
  return { r: ROUNDS.includes(r) ? r : 10, t: TIMERS.includes(t) ? t : 30 }; // no prompt language: it is per client
}
function newState(set) {
  return { v: 2, ph: 'lobby', set: cleanSet(set), av: [], ex: [], gm: {}, ord: [], g: 0, r: 0, qs: [], tg: 0, sub: '', t0: 0, ddl: 0, pk: {}, sc: {}, hi: [], gone: [], miss: {}, nm: {}, ev: { n: 0, k: '' }, rx: [], cm: [] };
}
function supported(s) { return !s || (typeof s === 'object' && (s.v === undefined || s.v === 2)); }
function normalize(s) {
  s = obj(s); const d = newState(s.set);
  if (s.v !== 2) return d;
  const o = Object.assign(d, {
    ph: ['lobby', 'play', 'end'].includes(s.ph) ? s.ph : 'lobby',
    av: arr(s.av).filter(a => Array.isArray(a) && a.length === 2).map(a => [num(a[0], 0), num(a[1], 0)]),
    ex: arr(s.ex).map(obj).filter(x => Number.isInteger(x.id)).map(x => ({ id: x.id, n: String(x.n || 'Bot').slice(0, 24), av: String(x.av || '🤖'), b: x.b ? 1 : 0 })),
    gm: obj(s.gm), ord: arr(s.ord).map(Number).filter(Number.isInteger), g: num(s.g, 0), r: num(s.r, 0), qs: arr(s.qs).map(Number),
    tg: num(s.tg, 0), sub: ['pick', 'reveal'].includes(s.sub) ? s.sub : '', t0: num(s.t0, 0), ddl: num(s.ddl, 0),
    pk: {}, sc: {}, hi: arr(s.hi).map(obj), gone: arr(s.gone).map(Number), ev: { n: num(obj(s.ev).n, 0), k: String(obj(s.ev).k || '') }, rx: arr(s.rx).filter(Array.isArray).slice(-12)
  });
  o.cm = arr(s.cm).map(obj).map(m => ({ i: num(m.i, 0), by: num(m.by, 0), n: String(m.n || '').slice(0, LIM.nameMax), t: String(m.t == null ? '' : m.t).slice(0, LIM.chatMax) })).filter(m => m.t).slice(-LIM.chatKeep);
  for (const [k, v] of Object.entries(obj(s.pk))) if (Array.isArray(v)) o.pk[k] = [num(v[0], 0), num(v[1], 0)];
  for (const [k, v] of Object.entries(obj(s.sc))) o.sc[k] = num(v, 0);
  for (const [k, v] of Object.entries(obj(s.miss))) o.miss[k] = num(v, 0);
  for (const [k, v] of Object.entries(obj(s.nm))) o.nm[k] = String(v).slice(0, 24);
  o.hi = o.hi.map(h => { const pk = {}, gn = {}; for (const [k, v] of Object.entries(obj(h.pk))) pk[k] = num(v, 0); for (const [k, v] of Object.entries(obj(h.gn))) gn[k] = num(v, 0);
    return { q: num(h.q, 0), tg: num(h.tg, 0), ans: num(h.ans, 0), pk, gn, best: arr(h.best).map(Number), d: num(h.d, -1), vd: h.vd ? 1 : 0 }; });
  return o;
}
/** deterministic PRNG (mulberry32) */
function prng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function shuffle(list, rnd) { const a = list.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
const active = s => s.ord.filter(id => !s.gone.includes(id));
function bump(s, k) { s.ev = { n: s.ev.n + 1, k }; }
/** start a match: ids = participants (humans + bots), nq = number of index-aligned prompts shared by every language bank */
function start(s, ids, now, nq, seed) {
  ids = ids.slice(0, MAX_SEATS); if (ids.length < MIN_SEATS || !(nq > 0)) return false;
  const rnd = prng(seed === undefined ? (now ^ 0x5eed) : seed), R = s.set.r;
  let qs = []; while (qs.length < R) qs = qs.concat(shuffle([...Array(nq).keys()], rnd));
  s.ph = 'play'; s.ord = shuffle(ids, rnd); s.g += 1; s.r = 0; s.qs = qs.slice(0, R); s.sc = {}; for (const id of ids) s.sc[K(id)] = 0;
  s.hi = []; s.gone = []; s.miss = {}; s.rx = []; s.cm = []; s.tg = 0; begin(s, now, 'start'); return true;
}
/** next hot seat: the next still-active player in seat order after the current one (first round: ord[0]) */
function nextTarget(s) {
  const a = active(s); if (!a.length) return 0;
  if (!s.tg || !s.ord.includes(s.tg)) return a[0];
  const i = s.ord.indexOf(s.tg);
  for (let k = 1; k <= s.ord.length; k++) { const id = s.ord[(i + k) % s.ord.length]; if (!s.gone.includes(id)) return id; }
  return a[0];
}
function begin(s, now, k) { s.sub = 'pick'; s.pk = {}; s.tg = nextTarget(s); s.t0 = now + INTRO_MS; s.ddl = s.t0 + s.set.t * 1000; bump(s, k || 'round'); }
/** who still has to answer (hot seat) or guess (everyone else) */
function pending(s) { if (s.ph !== 'play' || s.sub !== 'pick') return []; return active(s).filter(id => !s.pk[K(id)]); }
function pick(s, id, value, now) {
  if (s.ph !== 'play' || s.sub !== 'pick') return { ok: false, why: 'phase' };
  if (!active(s).includes(id)) return { ok: false, why: 'out' };
  if (!okVal(value)) return { ok: false, why: 'value' };
  if (s.pk[K(id)]) return { ok: false, why: 'dup' };
  if (now < s.t0 - 500) return { ok: false, why: 'intro' };
  const left = Math.max(0, Math.min(s.set.t * 10, Math.round((s.ddl - Math.max(now, s.t0)) / 100)));
  s.pk[K(id)] = [value, left]; return { ok: true };
}
const distPts = d => d >= 0 && d < DIST_PTS.length ? DIST_PTS[d] : 0;
/** score the round (pure): {ans, pk:{key:value}, gn, best:[ids], d, vd} */
function score(s) {
  const a = active(s), gn = {}, pk = {}; for (const id of a) gn[K(id)] = 0;
  for (const [k, v] of Object.entries(s.pk)) pk[k] = v[0];
  const t = s.pk[K(s.tg)];
  if (!t || !a.includes(s.tg)) return { ans: 0, pk, gn, best: [], d: -1, vd: 1 };
  const ans = t[0], guessers = a.filter(id => id !== s.tg && s.pk[K(id)]);
  if (!guessers.length) return { ans, pk, gn, best: [], d: -1, vd: 0 };
  const dist = id => Math.abs(s.pk[K(id)][0] - ans), d = Math.min(...guessers.map(dist));
  const best = guessers.filter(id => dist(id) === d);
  for (const id of guessers) gn[K(id)] += distPts(dist(id)) + (best.includes(id) ? CLOSEST : 0);
  if (d <= 1) gn[K(s.tg)] += HOT_BONUS;
  return { ans, pk, gn, best, d, vd: 0 };
}
/** afk: drop a human after this many rounds in a row without answering (0 = never; online uses 3) */
function reveal(s, now, afk) {
  if (s.ph !== 'play' || s.sub !== 'pick') return false;
  const r = score(s);
  for (const id of active(s)) { const k = K(id); if (s.pk[k]) delete s.miss[k]; else s.miss[k] = (s.miss[k] || 0) + 1; }
  if (afk) for (const id of active(s)) if (id > 0 && (s.miss[K(id)] || 0) >= afk && !s.gone.includes(id)) s.gone.push(id);
  for (const [k, v] of Object.entries(r.gn)) s.sc[k] = (s.sc[k] || 0) + v;
  s.hi.push({ q: s.qs[s.r], tg: s.tg, ans: r.ans, pk: r.pk, gn: r.gn, best: r.best, d: r.d, vd: r.vd }); if (s.hi.length > HIST) s.hi = s.hi.slice(-HIST);
  s.sub = 'reveal'; s.t0 = now; s.ddl = 0; bump(s, 'reveal');
  if (active(s).length < MIN_SEATS) finish(s);
  return true;
}
/** host pressed Next: next prompt for the next hot seat (or the results after the last round). Never automatic. */
function next(s, now) {
  if (s.ph !== 'play' || s.sub !== 'reveal') return false;
  s.r += 1; if (s.r >= s.qs.length || active(s).length < MIN_SEATS) { finish(s); return true; }
  begin(s, now, 'round'); return true;
}
/** host ends the match early (from a reveal) */
function endNow(s) { if (s.ph !== 'play' || s.sub !== 'reveal') return false; finish(s); return true; }
function finish(s) { s.ph = 'end'; s.sub = ''; s.pk = {}; bump(s, 'end'); }
/** a player left / disconnected: out for the rest of the match. Ends the match if fewer than 2 remain. */
function drop(s, id, now) {
  if (s.ph !== 'play' || !s.ord.includes(id) || s.gone.includes(id)) return false;
  s.gone.push(id); delete s.pk[K(id)];
  if (active(s).length < MIN_SEATS) { finish(s); return true; }
  if (s.sub === 'pick' && s.tg === id) reveal(s, now); // hot seat left: round void, reveal waits for Next
  return true;
}
/** host / stand-in tick: only the answering phase can time out. The reveal NEVER advances by itself. */
function due(s, now) {
  if (s.ph !== 'play' || s.sub !== 'pick') return null;
  return (now >= s.ddl || (now >= s.t0 && !pending(s).length)) ? 'reveal' : null;
}
function advance(s, now, afk) { return due(s, now) === 'reveal' ? reveal(s, now, afk) : false; }
function ranking(s) {
  return s.ord.map(id => ({ id, sc: s.sc[K(id)] || 0, out: s.gone.includes(id) })).sort((a, b) => (a.out - b.out) || (b.sc - a.sc) || (s.ord.indexOf(a.id) - s.ord.indexOf(b.id)));
}
/** "who knows whom": guesses within 1 of the truth per player */
function close(s) { const c = {}; for (const h of s.hi) { if (h.vd) continue; for (const [k, v] of Object.entries(h.pk)) { const id = Number(k.slice(1)); if (id !== h.tg && Math.abs(v - h.ans) <= 1) c[id] = (c[id] || 0) + 1; } } return c; }
function backToLobby(s) { const d = newState(s.set); d.av = s.av; d.ex = s.ex; d.gm = s.gm; d.g = s.g; d.ev = s.ev; bump(d, 'lobby'); Object.assign(s, d); }
function cleanText(t, max) { return String(t == null ? '' : t).replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max || LIM.chatMax); }
/** open chat: anyone in the room appends a short message while playing (pick + reveal).
    Kept through every round of the match; cleared by start() and backToLobby(). Never touches the round state. */
function chat(s, by, name, text) {
  if (s.ph !== 'play') return false; const t = cleanText(text, LIM.chatMax); if (!t) return false;
  const i = (s.cm.length ? s.cm[s.cm.length - 1].i : 0) + 1;
  s.cm.push({ i, by: num(by, 0), n: String(name || '').slice(0, LIM.nameMax), t }); s.cm = s.cm.slice(-LIM.chatKeep); return true;
}
function react(s, id, e, tag) { s.rx.push([id, String(e).slice(0, 4), s.ev.n, Number(tag) || 0]); s.rx = s.rx.slice(-10); return true; }
/** bot value: deterministic per round. Hot seat answers anything 1-10; guessers sometimes "read" the hot seat. */
function botPick(s, id, seed) {
  const rnd = prng((seed >>> 0) ^ (s.g * 7919) ^ (s.r * 104729) ^ (id * 2654435761));
  const t = s.pk[K(s.tg)];
  if (id !== s.tg && t && rnd() < 0.45) return Math.max(LO, Math.min(HI, t[0] + Math.round((rnd() - 0.5) * 4)));
  return LO + Math.floor(rnd() * (HI - LO + 1));
}
root.SL = { MIN_SEATS, MAX_SEATS, LO, HI, LANGS, ROUNDS, TIMERS, INTRO_MS, DIST_PTS, CLOSEST, HOT_BONUS, BOT_NAMES, arr, obj, K,
  cleanSet, newState, supported, normalize, prng, shuffle, active, start, begin, nextTarget, pending, pick, distPts, score, reveal, next, endNow, finish, drop, due, advance, ranking, close, backToLobby, react, botPick, LIM, cleanText, chat };
})(typeof window !== 'undefined' ? window : globalThis);

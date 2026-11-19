/* Sambung Coret: pure rules (no DOM). Albums, rotation, steps, drawing codec, ink budget, bot content.
   Album i is started by ord[i]. At step k every seated player works on exactly one album:
   writer(i, k) = ord[(i + k) % N]  (so step 0 is always the album's own starter).
   Cerita : S = L steps, each step = 1 sentence.
   Gambar : S = 1 + L steps; step 0 = title by the starter, steps 1..L = drawing on the same canvas.
   L = putaran x N (unit "p") or a fixed number of giliran (unit "g"). With 1 putaran in Gambar the starter
   writes the title, the next N-1 players draw, and the starter adds the closing touch on step N. */
(function (root) {
'use strict';
const GAME = 'sambungcoret', V = 1, MAX_SEATS = 8, MIN_SEATS = 2;
const W = 480, H = 360;
const LIM = { textMax: 160, titleMax: 48, nameMax: 24, drawBudget: 150000, inkMin: 700, inkMax: 6000, stepsMax: 24, gapMs: 2600, startMs: 3200, chatMax: 120, chatKeep: 40 };
const LENS = ['p1', 'p2', 'p3', 'g3', 'g5', 'g8', 'g12'];
const TT = [45, 60, 90], DT = [60, 80, 120];
const DEF = { mode: 'cerita', len: 'p1', tt: 60, dt: 80, bl: 'id' };
const A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
const AI = {}; for (let i = 0; i < 64; i++) AI[A[i]] = i;
const arr = v => Array.isArray(v) ? v : (v && typeof v === 'object' ? Object.values(v) : []);
const obj = v => (v && typeof v === 'object' && !Array.isArray(v)) ? v : {};
const int = (v, d) => { const n = Number(v); return Number.isFinite(n) ? Math.round(n) : d; };
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const copy = v => JSON.parse(JSON.stringify(v));

/* ---------- settings ---------- */
function cleanSet(x) {
  x = obj(x); const s = Object.assign({}, DEF);
  if (x.mode === 'gambar' || x.mode === 'cerita') s.mode = x.mode;
  if (LENS.includes(x.len)) s.len = x.len;
  if (TT.includes(int(x.tt))) s.tt = int(x.tt);
  if (DT.includes(int(x.dt))) s.dt = int(x.dt);
  if (x.bl === 'en' || x.bl === 'id') s.bl = x.bl;
  return s;
}
/** number of contribution steps after the title: putaran x players, or fixed giliran */
function lenSteps(set, n) { const u = set.len[0], c = int(set.len.slice(1), 1); return clamp(u === 'p' ? c * n : c, 2, LIM.stepsMax); }
function totalSteps(set, n) { return lenSteps(set, n) + (set.mode === 'gambar' ? 1 : 0); }
function drawSteps(s) { return s.set.mode === 'gambar' ? s.S - 1 : 0; }

/* ---------- state ---------- */
function newState(set) { return { v: V, game: GAME, ph: 'lobby', set: cleanSet(set), av: [], ex: [], g: 0, ord: [], k: 0, S: 0, t0: 0, ddl: 0, al: [], gone: [], ink: 0, sh: { a: 0, st: 0, n: 0 }, cm: [], ev: { n: 0, k: '' } }; }
function supported(s) { s = obj(s); return !s.game || (s.game === GAME && int(s.v, 0) <= V); }
function normalize(s) {
  s = obj(s); const d = newState(s.set);
  d.ph = ['lobby', 'play', 'end'].includes(s.ph) ? s.ph : 'lobby';
  d.av = arr(s.av).map(arr).filter(x => x.length === 2).map(x => [int(x[0], 0), int(x[1], 0)]);
  d.ex = arr(s.ex).map(obj).filter(x => Number.isFinite(Number(x.id))).map(x => ({ id: int(x.id, 0), n: String(x.n || '').slice(0, LIM.nameMax), av: String(x.av || ''), b: x.b ? 1 : 0 }));
  d.g = int(s.g, 0); d.ord = arr(s.ord).map(x => int(x, 0)); d.k = int(s.k, 0); d.S = int(s.S, 0); d.t0 = Number(s.t0) || 0; d.ddl = Number(s.ddl) || 0; d.ink = int(s.ink, 0);
  d.al = arr(s.al).map(obj).map(a => ({ st: int(a.st, 0), e: arr(a.e).map(obj).map(e => { const o = { by: int(e.by, 0) }; if ('d' in e) o.d = arr(e.d).filter(op => typeof op === 'string'); else o.t = String(e.t == null ? '' : e.t); if (e.a) o.a = 1; return o; }) }));
  d.gone = arr(s.gone).map(x => int(x, 0));
  const sh = obj(s.sh); d.sh = { a: int(sh.a, 0), st: int(sh.st, 0), n: int(sh.n, 0) };
  d.cm = arr(s.cm).map(obj).map(m => ({ i: int(m.i, 0), by: int(m.by, 0), n: String(m.n || '').slice(0, LIM.nameMax), t: String(m.t == null ? '' : m.t).slice(0, LIM.chatMax) })).filter(m => m.t).slice(-LIM.chatKeep);
  const ev = obj(s.ev); d.ev = { n: int(ev.n, 0), k: String(ev.k || ''), by: int(ev.by, 0) };
  // shared (GM) tags { p<playerId>: 1 } (p prefix keeps it an object through PHP); kept across lobby / play / end
  const gm = obj(s.gm); d.gm = {}; for (const k in gm) if (gm[k] && /^p-?\d+$/.test(k)) d.gm[k] = 1;
  return d;
}
function bump(s, k, by) { s.ev = { n: (s.ev.n || 0) + 1, k, by: by || 0 }; }

/* ---------- rotation ---------- */
const N = s => s.ord.length;
const mod = (a, n) => ((a % n) + n) % n;
function writerOf(s, i, k) { return s.ord[mod(i + k, N(s))]; }
function albumFor(s, id, k) { if (k === undefined) k = s.k; const idx = s.ord.indexOf(id); return idx < 0 ? -1 : mod(idx - k, N(s)); }
function kindAt(s, k) { if (k === undefined) k = s.k; return s.set.mode === 'gambar' ? (k === 0 ? 'title' : 'draw') : 'sent'; }
function stepMs(s, k) { return (kindAt(s, k) === 'draw' ? s.set.dt : s.set.tt) * 1000; }
function isDone(s, i, k) { if (k === undefined) k = s.k; return !!s.al[i] && s.al[i].e.length > k; }
function pending(s) { if (s.ph !== 'play') return []; return s.al.map((a, i) => isDone(s, i) ? null : writerOf(s, i, s.k)).filter(x => x !== null); }
function doneCount(s) { return s.al.filter((a, i) => isDone(s, i)).length; }
function inkFor(n, draws) { return draws ? clamp(Math.floor(LIM.drawBudget / (n * draws)), LIM.inkMin, LIM.inkMax) : 0; }
/** all drawing ops on album i before step k (the shared canvas the writer sees) */
function canvasOps(s, i, k) { if (k === undefined) k = s.k; const a = s.al[i]; if (!a) return []; const out = []; a.e.slice(0, k).forEach(e => { if (e.d) out.push(...e.d); }); return out; }
function titleOf(s, i) { const a = s.al[i]; if (!a || s.set.mode !== 'gambar' || !a.e[0]) return ''; return a.e[0].t || ''; }

function start(s, ids, now, rnd) {
  rnd = rnd || Math.random; const ord = ids.slice(0, MAX_SEATS);
  for (let i = ord.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [ord[i], ord[j]] = [ord[j], ord[i]]; }
  s.ord = ord; s.S = totalSteps(s.set, ord.length); s.k = 0; s.al = ord.map(id => ({ st: id, e: [] })); s.g = (s.g || 0) + 1; s.gone = [];
  s.ink = inkFor(ord.length, drawSteps(s)); s.ph = 'play'; s.t0 = now + LIM.startMs; s.ddl = s.t0 + stepMs(s, 0); s.sh = { a: 0, st: 0, n: 0 }; s.cm = []; bump(s, 'start');
  return s;
}

/* ---------- contributions ---------- */
function cleanText(t, max) { return String(t == null ? '' : t).replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max); }
/** content: string (sentence / title) or array of ops (draw). auto=1 marks a filler (timeout, left, bot stand-in). */
function put(s, id, content, now, auto) {
  if (s.ph !== 'play') return { ok: false, why: 'phase' };
  const i = albumFor(s, id); if (i < 0) return { ok: false, why: 'seat' };
  if (isDone(s, i)) return { ok: false, why: 'done' };
  const kind = kindAt(s), e = { by: id };
  if (kind === 'draw') { e.d = fitInk(cleanOps(Array.isArray(content) ? content : []), s.ink); }
  else { e.t = cleanText(content, kind === 'title' ? LIM.titleMax : LIM.textMax); if (!e.t) return { ok: false, why: 'empty' }; }
  if (auto) e.a = 1;
  s.al[i].e.push(e);
  if (!pending(s).length) advance(s, now);
  return { ok: true, i };
}
function advance(s, now) {
  s.k++;
  if (s.k >= s.S) { s.ph = 'end'; s.k = s.S; s.t0 = now; s.ddl = now; s.sh = { a: 0, st: 0, n: 0 }; bump(s, 'end'); return; }
  s.t0 = now + LIM.gapMs; s.ddl = s.t0 + stepMs(s); bump(s, 'step');
}
/** fill every missing slot of the current step (timeout / stand-in) using filler(kind, s, i, id) and advance */
function fillMissing(s, now, filler, only) {
  if (s.ph !== 'play') return false; const k = s.k; let n = 0;
  s.al.forEach((a, i) => {
    if (isDone(s, i)) return; const id = writerOf(s, i, k); if (only && !only.includes(id)) return;
    const kind = kindAt(s); let c = filler(kind, s, i, id);
    if (kind !== 'draw' && !cleanText(c, LIM.textMax)) c = '…';
    const e = { by: id, a: 1 }; if (kind === 'draw') e.d = fitInk(cleanOps(c || []), s.ink); else e.t = cleanText(c, kind === 'title' ? LIM.titleMax : LIM.textMax);
    a.e.push(e); n++;
  });
  if (s.k === k && !pending(s).length) advance(s, now);
  return n > 0;
}
/** slideshow chat: append a short message (results screen only); never touches s.sh */
function chat(s, by, name, text) {
  if (s.ph !== 'end') return false; const t = cleanText(text, LIM.chatMax); if (!t) return false;
  const i = (s.cm.length ? s.cm[s.cm.length - 1].i : 0) + 1; s.cm.push({ i, by: int(by, 0), n: String(name || '').slice(0, LIM.nameMax), t }); s.cm = s.cm.slice(-LIM.chatKeep); return true;
}
function drop(s, id) { if (s.ord.includes(id) && !s.gone.includes(id)) { s.gone.push(id); return true; } return false; }
function backToLobby(s) { s.ph = 'lobby'; s.ord = []; s.al = []; s.k = 0; s.S = 0; s.t0 = 0; s.ddl = 0; s.gone = []; s.ink = 0; s.sh = { a: 0, st: 0, n: 0 }; s.cm = []; bump(s, 'lobby'); return s; }

/* ---------- drawing codec (compact strings, safe in JSON) ----------
   stroke: 's' + color + size + x0(2) + y0(2) + n x (dx,dy) one char each in -31..31 (A[d+32])
   fill  : 'f' + color + x(2) + y(2) */
const enc2 = n => { n = clamp(Math.round(n), 0, 4095); return A[n >> 6] + A[n & 63]; };
const dec2 = (s, i) => (AI[s[i]] << 6) | AI[s[i + 1]];
function encodeStroke(c, z, pts) {
  if (!pts.length) return ''; let x = clamp(Math.round(pts[0][0]), 0, W - 1), y = clamp(Math.round(pts[0][1]), 0, H - 1);
  let o = 's' + A[c & 63] + A[z & 63] + enc2(x) + enc2(y);
  for (let j = 1; j < pts.length; j++) {
    const tx = clamp(Math.round(pts[j][0]), 0, W - 1), ty = clamp(Math.round(pts[j][1]), 0, H - 1);
    const n = Math.ceil(Math.max(Math.abs(tx - x), Math.abs(ty - y)) / 31), sx = x, sy = y;
    for (let q = 1; q <= n; q++) { const nx = Math.round(sx + (tx - sx) * q / n), ny = Math.round(sy + (ty - sy) * q / n); o += A[nx - x + 32] + A[ny - y + 32]; x = nx; y = ny; }
  }
  return o;
}
function encodeFill(c, x, y) { return 'f' + A[c & 63] + enc2(clamp(x, 0, W - 1)) + enc2(clamp(y, 0, H - 1)); }
function decodeOp(op) {
  if (typeof op !== 'string' || op.length < 6 || op.length > 8000 || !/^[sf][A-Za-z0-9_-]+$/.test(op)) return null;
  if (op[0] === 'f') { if (op.length !== 6) return null; return { t: 'f', c: AI[op[1]], x: Math.min(W - 1, dec2(op, 2)), y: Math.min(H - 1, dec2(op, 4)) }; }
  if (op.length < 7 || (op.length - 7) % 2) return null;
  let x = dec2(op, 3), y = dec2(op, 5); if (x >= W || y >= H) return null; const pts = [[x, y]];
  for (let j = 7; j < op.length; j += 2) { x = clamp(x + AI[op[j]] - 32, 0, W - 1); y = clamp(y + AI[op[j + 1]] - 32, 0, H - 1); pts.push([x, y]); }
  return { t: 's', c: AI[op[1]], z: AI[op[2]], pts };
}
function cleanOps(ops) { return arr(ops).filter(o => decodeOp(o)); }
function opsLen(ops) { let n = 0; for (const o of ops) n += o.length + 3; return n; }
function fitInk(ops, ink) { if (!ink) return ops; const out = []; let n = 0; for (const o of ops) { if (n + o.length + 3 > ink) break; out.push(o); n += o.length + 3; } return out; }
/** Ramer-Douglas-Peucker simplification for freehand points */
function simplify(pts, eps) {
  if (pts.length < 3) return pts.slice(); eps = eps || 1;
  const keep = new Uint8Array(pts.length); keep[0] = keep[pts.length - 1] = 1; const st = [[0, pts.length - 1]];
  while (st.length) {
    const [a, b] = st.pop(); let md = 0, mi = -1; const [x1, y1] = pts[a], [x2, y2] = pts[b], dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy) || 1;
    for (let i = a + 1; i < b; i++) { const d = Math.abs(dy * pts[i][0] - dx * pts[i][1] + x2 * y1 - y2 * x1) / L; if (d > md) { md = d; mi = i; } }
    if (md > eps && mi > 0) { keep[mi] = 1; st.push([a, mi], [mi, b]); }
  }
  return pts.filter((p, i) => keep[i]);
}

/* ---------- bots (silly but readable) ---------- */
const BOT_NAMES = ['Bot Ucup', 'Bot Sari', 'Bot Jono', 'Bot Mimi', 'Bot Dodi', 'Bot Lala', 'Bot Bima'];
const TXT = {
  id: {
    open: ['Pada suatu pagi, {s} bangun dan menemukan {o} di bawah bantal.', 'Di sebuah kampung kecil, hiduplah {s} yang bercita-cita menjadi {j}.', 'Semua berawal ketika {s} salah naik angkot dan nyasar ke {p}.', 'Konon, di {p} ada {o} yang bisa bicara.', 'Hari itu {s} bertekad memenangkan lomba makan kerupuk.'],
    mid: ['Tiba-tiba {s} datang sambil membawa {o}.', 'Tanpa pikir panjang, semuanya lari ke {p}.', 'Ternyata {o} itu milik {s} yang sedang menyamar.', 'Lalu turun hujan {o} selama tiga hari tiga malam.', 'Untungnya, {s} ingat pesan neneknya: jangan lupa bawa {o}.', 'Semua orang terdiam, lalu tertawa terbahak-bahak.', 'Sayangnya, rencana itu gagal karena {s} ketiduran.', 'Dari kejauhan terdengar suara {s} menyanyikan lagu dangdut.', 'Mereka pun sepakat menukar {o} dengan sebungkus martabak.', 'Di {p}, mereka bertemu {s} yang sedang joget.'],
    s: ['seekor kucing oren', 'Pak RT', 'tukang bakso', 'seekor bebek', 'nenek sakti', 'alien kecil', 'kambing tetangga', 'seorang ninja', 'robot pemalu', 'ayam jago'],
    o: ['sendal jepit ajaib', 'gerobak cilok', 'peta harta karun', 'payung bocor', 'semangkuk mi ayam', 'remote TV', 'balon raksasa', 'durian emas', 'kerupuk sakti'],
    p: ['pasar malam', 'bulan', 'warung kopi', 'hutan bambu', 'kolam renang', 'atap rumah', 'Kota Tua'],
    j: ['astronot', 'chef', 'penyanyi', 'pilot', 'detektif', 'youtuber'],
    title: ['Kucing Naik Motor', 'Gajah di Kolam Renang', 'Alien Jualan Cilok', 'Robot Main Layangan', 'Bebek Pakai Kacamata', 'Ninja di Pasar Malam', 'Ikan Terbang ke Bulan', 'Nenek Main Skateboard', 'Rumah di Atas Awan', 'Pizza Rasa Rendang', 'Monster Takut Gelap', 'Sapi Jadi Superhero'],
    end: 'Dan sejak hari itu, semuanya hidup bahagia (katanya).'
  },
  en: {
    open: ['One morning, {s} woke up and found {o} under the pillow.', 'In a tiny village lived {s} who dreamed of becoming {j}.', 'It all started when {s} took the wrong bus and ended up at {p}.', 'Legend says that at {p} there is {o} that can talk.', 'That day {s} swore to win the pancake-eating contest.'],
    mid: ['Suddenly {s} showed up carrying {o}.', 'Without thinking, everyone ran to {p}.', 'It turned out {o} belonged to {s} in disguise.', 'Then it rained {o} for three days and three nights.', 'Luckily, {s} remembered grandma\'s advice: always bring {o}.', 'Everyone went quiet, then burst out laughing.', 'Sadly, the plan failed because {s} fell asleep.', 'From far away, {s} could be heard singing karaoke.', 'They agreed to trade {o} for a box of donuts.', 'At {p}, they met {s} who was dancing.'],
    s: ['an orange cat', 'the mayor', 'a noodle seller', 'a duck', 'a magic grandma', 'a tiny alien', 'the neighbour\'s goat', 'a ninja', 'a shy robot', 'a rooster'],
    o: ['magic flip-flops', 'a snack cart', 'a treasure map', 'a leaky umbrella', 'a bowl of noodles', 'the TV remote', 'a giant balloon', 'a golden durian', 'a lucky cracker'],
    p: ['the night market', 'the moon', 'the coffee shop', 'a bamboo forest', 'the swimming pool', 'the roof', 'the old town'],
    j: ['an astronaut', 'a chef', 'a singer', 'a pilot', 'a detective', 'a streamer'],
    title: ['Cat Riding a Scooter', 'Elephant in a Pool', 'Alien Selling Snacks', 'Robot Flying a Kite', 'Duck Wearing Glasses', 'Ninja at the Night Market', 'Fish Flying to the Moon', 'Grandma on a Skateboard', 'House Above the Clouds', 'Monster Afraid of the Dark', 'Cow Becomes a Superhero'],
    end: 'And from that day on, everyone lived happily ever after (supposedly).'
  }
};
const pick = (a, rnd) => a[Math.floor((rnd || Math.random)() * a.length)];
function botSentence(lang, k, last, rnd) {
  const L = TXT[lang] || TXT.id; const tpl = k === 0 ? pick(L.open, rnd) : last ? L.end : pick(L.mid, rnd);
  const out = tpl.replace(/\{(\w)\}/g, (m, c) => pick(L[c], rnd)); return out.charAt(0).toUpperCase() + out.slice(1);
}
function botTitle(lang, rnd) { return pick((TXT[lang] || TXT.id).title, rnd); }
/** simple doodles: a shape at a random spot, within ink */
function botDoodle(ink, rnd) {
  rnd = rnd || Math.random; const R = (a, b) => a + rnd() * (b - a), ops = [];
  const cx = R(90, W - 90), cy = R(80, H - 80), r = R(25, 60), col = 2 + Math.floor(rnd() * 12), z = 1 + Math.floor(rnd() * 2);
  const circ = (x, y, rr, n) => { const p = []; for (let i = 0; i <= (n || 24); i++) { const a = i / (n || 24) * Math.PI * 2; p.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr]); } return p; };
  const kind = Math.floor(rnd() * 6);
  if (kind === 0) { ops.push(encodeStroke(col, z, circ(cx, cy, r))); for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; ops.push(encodeStroke(col, z, [[cx + Math.cos(a) * r * 1.3, cy + Math.sin(a) * r * 1.3], [cx + Math.cos(a) * r * 1.8, cy + Math.sin(a) * r * 1.8]])); } }
  else if (kind === 1) { const p = []; for (let i = 0; i <= 10; i++) { const rr = i % 2 ? r * 0.45 : r, a = -Math.PI / 2 + i * Math.PI / 5; p.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]); } ops.push(encodeStroke(col, z, p)); }
  else if (kind === 2) { ops.push(encodeStroke(1, z, circ(cx, cy, r))); ops.push(encodeStroke(1, 3, [[cx - r * 0.35, cy - r * 0.2]])); ops.push(encodeStroke(1, 3, [[cx + r * 0.35, cy - r * 0.2]])); const m = []; for (let i = 0; i <= 10; i++) { const a = 0.2 * Math.PI + i / 10 * 0.6 * Math.PI; m.push([cx + Math.cos(a) * r * 0.55, cy + Math.sin(a) * r * 0.55]); } ops.push(encodeStroke(1, z, m)); }
  else if (kind === 3) { const p = []; for (let i = 0; i <= 40; i++) p.push([cx - r * 1.5 + i * r * 3 / 40, cy + Math.sin(i / 40 * Math.PI * 4) * r * 0.35]); ops.push(encodeStroke(col, z + 1, p)); }
  else if (kind === 4) { ops.push(encodeStroke(col, z, [[cx - r, cy], [cx - r, cy + r], [cx + r, cy + r], [cx + r, cy], [cx - r, cy]])); ops.push(encodeStroke(col, z, [[cx - r * 1.2, cy + 2], [cx, cy - r], [cx + r * 1.2, cy + 2]])); }
  else { const p = []; for (let i = 0; i <= 48; i++) { const a = i / 48 * Math.PI * 2, x = 16 * Math.pow(Math.sin(a), 3), y = 13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a); p.push([cx + x * r / 18, cy - y * r / 18]); } ops.push(encodeStroke(4, z + 1, p)); }
  return fitInk(ops, ink);
}
/** filler used by bots, timeouts and stand-ins for players who left */
function botContent(kind, s, i, rnd) {
  const lang = s.set.bl;
  if (kind === 'title') return botTitle(lang, rnd);
  if (kind === 'draw') return botDoodle(s.ink, rnd);
  return botSentence(lang, s.k, s.k === s.S - 1, rnd);
}

root.SC = { GAME, V, MAX_SEATS, MIN_SEATS, W, H, LIM, LENS, TT, DT, DEF, A, arr, obj, copy, clamp, cleanSet, lenSteps, totalSteps, drawSteps, newState, supported, normalize, bump,
  writerOf, albumFor, kindAt, stepMs, isDone, pending, doneCount, inkFor, canvasOps, titleOf, start, cleanText, put, advance, fillMissing, drop, backToLobby, chat,
  encodeStroke, encodeFill, decodeOp, cleanOps, opsLen, fitInk, simplify, BOT_NAMES, TXT, botSentence, botTitle, botDoodle, botContent };
})(typeof window !== 'undefined' ? window : globalThis);

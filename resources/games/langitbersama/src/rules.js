/* Langit Bersama: pure shared-sky rules (fork of Drawquarium) (no DOM). The room state is the whole game:
   cr = creatures in the tank, cm = open chat, gm = (GM) marks, pr = presence pings, del = recently deleted ids.
   A creature drawing is one compact string: strokes separated by ';', each stroke = colour(1 hex) + width(1) +
   mode(p pen | e eraser | b paint-bucket at one absolute point | f legacy fill-silhouette) + delta-encoded points (see codec below). */
(function (root) {
'use strict';
const MAX_SEATS = 500, SPEC_MAX = 500; // t351u: Core gives drawquarium + langitbersama 500 seats + 500 spectators per room (one shared world)
/** max creatures in the tank (more looks crowded); when full the oldest non-immortal one is culled */
const MAX_CREATURES = 24;
/** board size (both kinds draw on the same 480x360 board) */
const BOARD = { w: 480, h: 360 };
const LIM = { chatMax: 120, chatKeep: 40, chatGap: 1200, nameMax: 24, critterName: 20, drawMax: 6500, strokesMax: 400, delKeep: 60, stateBudget: 190000, pinMax: 200, presenceMs: 150000, presenceDrop: 600000 };
const KINDS = ['kite', 'bird', 'balloon', 'plane', 'cloud'];
const KIND_NAME = { kite: 'Layangan', bird: 'Burung', balloon: 'Balon', plane: 'Pesawat Kertas', cloud: 'Awan' };
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
const WIDTHS = [3, 6, 10, 16, 26];
const arr = v => Array.isArray(v) ? v : (v && typeof v === 'object' ? Object.values(v) : []);
const obj = v => v && typeof v === 'object' && !Array.isArray(v) ? v : {};
const num = (v, d) => Number.isFinite(Number(v)) ? Number(v) : d;
const K = id => 'p' + id;
const enc = typeof TextEncoder !== 'undefined' ? new TextEncoder() : null;
const bytes = v => { const t = JSON.stringify(v); return enc ? enc.encode(t).length : t.length * 2; };
function cleanText(t, max) { return String(t == null ? '' : t).replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max || LIM.chatMax); }

function newState() { return { v: 1, cr: [], cm: [], gm: {}, pr: {}, del: [], sd: 0, n: 0, ci: 0 }; }
function supported(s) { return !s || (typeof s === 'object' && (s.v === undefined || s.v === 1)); }
const STROKE = '[0-9a-f][1-5](?:f|b[A-Za-z0-9_-]{4}|[pe](?:[A-Za-z0-9_-]{4}(?:[A-Za-z0-9_-]{2}|\\.[A-Za-z0-9_-]{4})*)?)';
const DRAW_RE = new RegExp('^' + STROKE + '(?:;' + STROKE + ')*$');
function validDrawing(d) { return typeof d === 'string' && d.length > 0 && d.length <= LIM.drawMax && DRAW_RE.test(d) && d.split(';').length <= LIM.strokesMax; }
/** attachment pins (board coords, ints): kite/balloon [x, y] = string/tail knot; bird [lx, ly, rx, ry] = wing hinge (only ink above the line between them flaps) */
const PIN_N = { kite: 2, balloon: 2, bird: 4 };
function cleanPins(k, pn) {
  const n = PIN_N[k]; if (!n || !Array.isArray(pn) || pn.length !== n) return null;
  const v = pn.map((q, i) => Number.isFinite(+q) ? Math.round(Math.max(0, Math.min(i % 2 ? BOARD.h : BOARD.w, +q))) : NaN);
  return v.some(Number.isNaN) ? null : v;
}
function cleanCreature(c) {
  c = obj(c);
  const x = { id: String(c.id || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 16), k: KINDS.includes(c.k) ? c.k : 'kite', nm: cleanText(c.nm, LIM.critterName), bn: cleanText(c.bn, LIM.nameMax), bp: num(c.bp, 0), u: String(c.u || '').replace(/[^A-Za-z0-9]/g, '').slice(0, 12), at: num(c.at, 0), im: c.im ? 1 : 0, d: typeof c.d === 'string' ? c.d : '' }; if (SIZES.includes(+c.sz)) x.sz = +c.sz;
  const pn = cleanPins(x.k, c.pn); if (pn) x.pn = pn;
  if (!x.id || !validDrawing(x.d) || !x.at) return null;
  if (!x.nm) x.nm = KIND_NAME[x.k];
  if (!x.bn) x.bn = '?';
  return x;
}
function normalize(s) {
  s = obj(s); const d = newState();
  if (s.v !== 1) return d;
  const seen = new Set();
  { const all = arr(s.cr).map(cleanCreature).filter(c => c && !seen.has(c.id) && seen.add(c.id)), keep = new Set(all.filter(c => !c.im).slice(-MAX_CREATURES));
    d.cr = all.filter(c => c.im || keep.has(c)).slice(-LIM.pinMax - MAX_CREATURES); }
  d.cm = arr(s.cm).map(obj).map(m => ({ i: num(m.i, 0), by: num(m.by, 0), n: String(m.n || '').slice(0, LIM.nameMax), t: String(m.t == null ? '' : m.t).slice(0, LIM.chatMax), k: ['add', 'gone', 'del'].includes(m.k) ? m.k : '', at: num(m.at, 0) })).filter(m => m.t).slice(-LIM.chatKeep);
  const gm = obj(s.gm); for (const k of Object.keys(gm)) if (/^p\d+$/.test(k) && gm[k]) d.gm[k] = 1;
  const pr = obj(s.pr); for (const k of Object.keys(pr)) { const p = obj(pr[k]); if (/^p\d+$/.test(k)) { const e = { n: cleanText(p.n, LIM.nameMax), a: num(p.a, 0) | 0, t: num(p.t, 0) }; if (p.w) e.w = 1; /* t314u: w = a ?wallpaper screen, not a person */ d.pr[k] = e; } }
  d.del = arr(s.del).map(x => String(x)).filter(Boolean).slice(-LIM.delKeep);
  d.sd = s.sd ? 1 : 0; d.n = num(s.n, 0); d.ci = num(s.ci, 0);
  return d;
}

/* ---------- drawing codec ----------
   point unit = 1 board px. First point of a stroke: absolute x,y (2+2 base64url chars). Next points: a delta pair
   (dx,dy each -32..31 → 1 char each) or '.' + absolute 4 chars when the jump is bigger. */
const q1 = v => Math.max(0, Math.min(4095, Math.round(v)));
function abs4(x, y) { return B64[x >> 6] + B64[x & 63] + B64[y >> 6] + B64[y & 63]; }
function encPts(p) {
  let out = '', px = 0, py = 0;
  p.forEach((q, i) => { const x = q1(q[0]), y = q1(q[1]); if (i === 0) out += abs4(x, y); else { const dx = x - px, dy = y - py; if (dx === 0 && dy === 0) return; out += (dx >= -32 && dx < 32 && dy >= -32 && dy < 32) ? B64[dx + 32] + B64[dy + 32] : '.' + abs4(x, y); } px = x; py = y; });
  return out;
}
/** strokes: [{c:0-15, w:1-5, m:'p'|'e'|'b'|'f', p:[[x,y],...]}] → string. 'b' (bucket) keeps exactly one point (the flood seed). */
function encode(strokes) {
  const md = m => m === 'e' || m === 'f' || m === 'b' ? m : 'p';
  return strokes.filter(st => st && (st.m === 'f' || (st.p && st.p.length))).map(st => (st.c & 15).toString(16) + (st.m === 'b' ? 1 : Math.max(1, Math.min(5, st.w | 0))) + md(st.m) + (st.m === 'f' ? '' : st.m === 'b' ? abs4(q1(st.p[0][0]), q1(st.p[0][1])) : encPts(st.p))).join(';');
}
function decode(d) {
  if (!d) return [];
  const v = ch => B64.indexOf(ch);
  return String(d).split(';').filter(Boolean).map(t => {
    const st = { c: parseInt(t[0], 16) || 0, w: Math.max(1, Math.min(5, Number(t[1]) || 2)), m: t[2] === 'e' || t[2] === 'f' || t[2] === 'b' ? t[2] : 'p', p: [] };
    let i = 3, x = 0, y = 0;
    if (t.length >= 7) { x = v(t[3]) * 64 + v(t[4]); y = v(t[5]) * 64 + v(t[6]); st.p.push([x, y]); i = 7; }
    while (i < t.length) {
      if (t[i] === '.') { if (i + 5 > t.length) break; x = v(t[i + 1]) * 64 + v(t[i + 2]); y = v(t[i + 3]) * 64 + v(t[i + 4]); i += 5; }
      else { if (i + 2 > t.length) break; x += v(t[i]) - 32; y += v(t[i + 1]) - 32; i += 2; }
      st.p.push([x, y]);
    }
    return st;
  });
}
/** Ramer–Douglas–Peucker on one polyline */
function rdp(pts, eps) {
  if (pts.length < 3 || eps <= 0) return pts.slice();
  const keep = new Uint8Array(pts.length); keep[0] = keep[pts.length - 1] = 1; const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop(); let best = -1, bi = -1; const [x1, y1] = pts[a], [x2, y2] = pts[b], dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy) || 1;
    const closed = Math.hypot(dx, dy) < 1e-6; // t275u: closed loops (start == end) used to collapse to one dot
    for (let i = a + 1; i < b; i++) { const dd = closed ? Math.hypot(pts[i][0] - x1, pts[i][1] - y1) : Math.abs(dy * pts[i][0] - dx * pts[i][1] + x2 * y1 - y2 * x1) / L; if (dd > best) { best = dd; bi = i; } }
    if (best > eps) { keep[bi] = 1; stack.push([a, bi], [bi, b]); }
  }
  return pts.filter((p, i) => keep[i]);
}
/** compress strokes until the encoded string fits LIM.drawMax; returns '' if it cannot */
function pack(strokes) {
  const clamp = p => [Math.max(0, Math.min(BOARD.w, p[0])), Math.max(0, Math.min(BOARD.h, p[1]))];
  const base = strokes.filter(st => st.m === 'f' || (st.p && st.p.length)).slice(-LIM.strokesMax).map(st => Object.assign({}, st, { p: (st.p || []).map(clamp) }));
  for (const eps of [0.5, 0.9, 1.4, 2, 3, 4.5, 6.5, 9, 12]) {
    const d = encode(base.map(st => Object.assign({}, st, { p: st.m === 'f' ? [] : st.m === 'b' ? st.p.slice(0, 1) : rdp(st.p, eps) })));
    if (d.length <= LIM.drawMax) return d;
  }
  return '';
}

/* ---------- tank ops ---------- */
/** shared creature size: stored as c.sz in room state; legacy creatures get a stable size hashed from their id (same on every screen) */
const SIZES = [0.7, 0.85, 1, 1.2, 1.4], SIZE_W = [1, 2, 3, 2, 1];
function pickSize(rand) { rand = rand || Math.random; let r = rand() * SIZE_W.reduce((a, b) => a + b, 0); for (let i = 0; i < SIZES.length; i++) { r -= SIZE_W[i]; if (r < 0) return SIZES[i]; } return 1; }
function sizeOf(c) { if (c && SIZES.includes(+c.sz)) return +c.sz; let h = 2166136261; for (const ch of String(c && c.id || '')) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return pickSize(() => (h >>> 0) / 4294967296); }
function rid(rand) { rand = rand || Math.random; let s = ''; for (let i = 0; i < 10; i++) s += B64[Math.floor(rand() * 64)]; return s; }
/** pinned (im) creatures sit outside the cap: MAX_CREATURES applies to unpinned ones only */
const unpinned = s => s.cr.filter(y => !y.im);
/** cull the oldest unpinned creatures until at most `max` unpinned remain (never touches pinned; `keep` id is culled last) */
function enforceCap(s, max, keep) {
  const out = [];
  while (unpinned(s).length > max) {
    const list = unpinned(s).sort((a, b) => (a.id === keep) - (b.id === keep) || a.at - b.at);
    s.cr = s.cr.filter(y => y !== list[0]); out.push(list[0]);
  }
  return out;
}
/** add a creature. Unpinned: when 24 unpinned already swim, the oldest unpinned leaves. Pinned: no cap, only the state budget.
    Returns {ok, c, culled?} or {err:'bad'|'dup'|'deleted'|'space'} */
function addCreature(s, c, now) {
  const x = cleanCreature(c); if (!x) return { err: 'bad' };
  if (s.cr.some(y => y.id === x.id)) return { err: 'dup' };
  if (s.del.includes(x.id)) return { err: 'deleted' };
  if (x.im && bytes(s) + bytes(x) + 64 > LIM.stateBudget) return { err: 'space' };
  let culled = null;
  if (!x.im) { const gone = enforceCap(s, MAX_CREATURES - 1); culled = gone[gone.length - 1] || null; }
  s.cr.push(x); s.n = (s.n || 0) + 1;
  return { ok: true, culled, c: x };
}
/** GM pins / unpins any creature. Pinned = never removed by cull/fit and excluded from the 24 cap.
    Unpinning may push the unpinned count over the cap: the oldest other unpinned leave. Returns {ok, c, culled:[]} or false */
function pinCreature(s, id, on, viewer) {
  viewer = viewer || {}; if (!viewer.gm) return false;
  const c = s.cr.find(y => y.id === id); if (!c) return false;
  if (!!c.im === !!on) return { ok: true, c, culled: [] };
  if (on && bytes(s) + 64 > LIM.stateBudget) return false;
  c.im = on ? 1 : 0;
  return { ok: true, c, culled: on ? [] : enforceCap(s, MAX_CREATURES, c.id) };
}
/** who may delete: the GM deletes anything (pinned included); a creator deletes their own unpinned one (same browser uid) */
function canDelete(c, viewer) { viewer = viewer || {}; if (!c) return false; if (c.im) return !!viewer.gm; return !!viewer.u && c.u === viewer.u || !!viewer.gm; }
function deleteCreature(s, id, viewer) {
  const c = s.cr.find(y => y.id === id); if (!c || !canDelete(c, viewer)) return false;
  s.cr = s.cr.filter(y => y.id !== id); s.del = s.del.filter(x => x !== id).concat(id).slice(-LIM.delKeep); return c;
}
/** t214u: GM renames a creature (same cleaning as a new name); returns the new name or false */
function renameCreature(s, id, nm, viewer) { viewer = viewer || {}; if (!viewer.gm) return false; const c = s.cr.find(y => y.id === id), n = cleanText(nm, LIM.critterName); if (!c || !n || c.nm === n) return false; c.nm = n; return n; }
function sysChat(s, k, by, name, text, now) { const i = nextChatId(s); s.cm.push({ i, by: num(by, 0), n: String(name || '').slice(0, LIM.nameMax), t: cleanText(text, LIM.chatMax), k, at: num(now, 0) }); s.cm = s.cm.slice(-LIM.chatKeep); }
/** t304u: chat ids never go backwards after a GM delete (ci = highest id ever handed out) */
function nextChatId(s) { return Math.max(s.cm.length ? s.cm[s.cm.length - 1].i : 0, num(s.ci, 0)) + 1; }
function chatKey(m) { return m.i + '.' + m.at; }
/** t304u: GM removes chat lines by key ('i.at'), or the whole chat when keys == null; returns how many went */
function deleteChat(s, keys, viewer) {
  viewer = viewer || {}; if (!viewer.gm) return 0;
  const top = s.cm.reduce((a, m) => Math.max(a, m.i), num(s.ci, 0)), set = keys == null ? null : new Set(arr(keys).map(String)), before = s.cm.length;
  s.cm = set ? s.cm.filter(m => !set.has(chatKey(m))) : []; const n = before - s.cm.length; if (n) s.ci = top; return n;
}
/** open chat: anyone in the room appends a short message */
function chat(s, by, name, text, now) {
  const t = cleanText(text, LIM.chatMax); if (!t) return false;
  const i = nextChatId(s);
  s.cm.push({ i, by: num(by, 0), n: cleanText(name, LIM.nameMax), t, k: '', at: num(now, 0) }); s.cm = s.cm.slice(-LIM.chatKeep); return true;
}
/** presence ping: name + avatar + time; drops entries of players that are gone or silent for a long time */
function ping(s, pid, name, av, now, livePids) {
  const live = livePids ? new Set(livePids.map(K)) : null;
  for (const k of Object.keys(s.pr)) if ((live && !live.has(k)) || now - s.pr[k].t > LIM.presenceDrop) delete s.pr[k];
  for (const k of Object.keys(s.gm)) if (live && !live.has(k)) delete s.gm[k];
  if (pid) s.pr[K(pid)] = Object.assign({}, s.pr[K(pid)] || {}, { n: cleanText(name, LIM.nameMax) || '?', a: av | 0, t: now });
}
function present(s, players, now) { return (players || []).filter(p => { const r = s.pr[K(p.id)]; return r && now - r.t < LIM.presenceMs; }); }
/** keep the state under the platform limit: trim chat first, then cull the oldest unpinned creatures; pinned ones go only as a last resort */
function fit(s) {
  let guard = 0;
  while (bytes(s) > LIM.stateBudget && guard++ < 200) {
    if (s.cm.length > 10) { s.cm = s.cm.slice(-Math.max(10, s.cm.length - 10)); continue; }
    const mortal = s.cr.filter(y => !y.im).sort((a, b) => a.at - b.at)[0];
    if (mortal) { s.cr = s.cr.filter(y => y !== mortal); continue; }
    if (s.cm.length) { s.cm = []; continue; }
    s.cr.shift();
  }
  return s;
}
/** merge creatures from a local cache (seeding a fresh room / GM rehydrate); skips deleted and duplicate ids */
function merge(s, list, now) {
  let added = 0;
  for (const c of arr(list).slice().sort((a, b) => num(a.at, 0) - num(b.at, 0))) {
    const x = cleanCreature(c); if (!x || s.del.includes(x.id) || s.cr.some(y => y.id === x.id)) continue;
    if (!x.im && unpinned(s).length >= MAX_CREATURES) continue;
    if (x.im && bytes(s) + bytes(x) + 64 > LIM.stateBudget) continue;
    s.cr.push(x); added++;
  }
  return added;
}
/** age in coarse units for the info card */
function age(ms) {
  ms = Math.max(0, ms); const m = Math.floor(ms / 60000), h = Math.floor(m / 60), d = Math.floor(h / 24);
  if (m < 1) return { u: 'now', n: 0 }; if (h < 1) return { u: 'min', n: m }; if (d < 1) return { u: 'hour', n: h }; return { u: 'day', n: d };
}

root.DQ = { SPEC_MAX, cleanPins, PIN_N, KIND_NAME, renameCreature, SIZES, pickSize, sizeOf, MAX_SEATS, MAX_CREATURES, BOARD, LIM, KINDS, WIDTHS, arr, obj, num, K, bytes, newState, supported, normalize, cleanText, cleanCreature, validDrawing, encode, decode, rdp, pack, rid, unpinned, enforceCap, addCreature, pinCreature, canDelete, deleteCreature, sysChat, chat, chatKey, deleteChat, nextChatId, ping, present, fit, merge, age };
})(typeof window !== 'undefined' ? window : globalThis);

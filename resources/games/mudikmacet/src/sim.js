// Mudik Macet - pure puzzle rules (no DOM). Exposed as globalThis.MM.
(function (G) {
  'use strict';
  var W = 6, H = 6, EXIT_ROW = 2;
  // Level grid: 6 strings x 6 chars. 'A' = mobil mudik (horizontal, exit row),
  // 'B'..'W' = angkot (length 2) or bus (length 3), orientation from shape,
  // 'a'..'w' = motor (1 cell; horizontal unless listed in def.v), 'x' = polisi (fixed), '.' = empty.
  function parse(def) {
    var g = def.g, seen = {}, pieces = [];
    if (!g || g.length !== H) throw Error('grid must have ' + H + ' rows');
    for (var y = 0; y < H; y++) {
      if (g[y].length !== W) throw Error('row ' + y + ' must have ' + W + ' cols');
      for (var x = 0; x < W; x++) {
        var c = g[y][x]; if (c === '.') continue;
        if (c === 'x') { pieces.push({ id: 'x' + x + y, type: 'polisi', x: x, y: y, len: 1, dir: 'h', fixed: true }); continue; }
        if (seen[c]) continue; seen[c] = 1;
        var len = 1, dir = 'h';
        if (c >= 'a' && c <= 'w') { dir = (def.v || '').indexOf(c) >= 0 ? 'v' : 'h'; }
        else if (x + 1 < W && g[y][x + 1] === c) { dir = 'h'; while (x + len < W && g[y][x + len] === c) len++; }
        else { dir = 'v'; while (y + len < H && g[y + len][x] === c) len++; }
        if (/[A-W]/.test(c) && len < 2) throw Error('vehicle ' + c + ' too short');
        var type = c === 'A' ? 'mudik' : (c >= 'a' && c <= 'w') ? 'motor' : len >= 3 ? 'bus' : 'angkot';
        var pc = { id: c, type: type, x: x, y: y, len: len, dir: dir, fixed: false }; if (def.c && def.c[c] != null) pc.col = def.c[c]; pieces.push(pc);
      }
    }
    var car = pieces.filter(function (p) { return p.type === 'mudik'; })[0];
    if (!car || car.dir !== 'h' || car.y !== EXIT_ROW || car.len !== 2) throw Error('mobil mudik A must be 2 long, horizontal, on row ' + EXIT_ROW);
    // put the car first so index 0 is always the car
    pieces.sort(function (a, b) { return (b.type === 'mudik') - (a.type === 'mudik'); });
    if (!validPlacement(pieces)) throw Error('pieces overlap or leave the board');
    return pieces;
  }
  function cells(p) { var r = []; for (var i = 0; i < p.len; i++) r.push(p.dir === 'h' ? [p.x + i, p.y] : [p.x, p.y + i]); return r; }
  function grid(pieces, skip) {
    var o = new Array(W * H); for (var i = 0; i < o.length; i++) o[i] = -1;
    pieces.forEach(function (p, k) { if (k === skip) return; cells(p).forEach(function (c) { o[c[1] * W + c[0]] = k; }); });
    return o;
  }
  function validPlacement(pieces) {
    var o = {}, ok = true;
    pieces.forEach(function (p) { cells(p).forEach(function (c) { if (c[0] < 0 || c[1] < 0 || c[0] >= W || c[1] >= H) ok = false; var k = c[1] * W + c[0]; if (o[k]) ok = false; o[k] = 1; }); });
    return ok;
  }
  // how far piece k can slide: {min: <=0, max: >=0} cells along its axis
  function limits(pieces, k, occ) {
    var p = pieces[k]; if (p.fixed) return { min: 0, max: 0 };
    occ = occ || grid(pieces); var mn = 0, mx = 0, x, y;
    if (p.dir === 'h') {
      for (x = p.x - 1; x >= 0 && occ[p.y * W + x] < 0; x--) mn--;
      for (x = p.x + p.len; x < W && occ[p.y * W + x] < 0; x++) mx++;
    } else {
      for (y = p.y - 1; y >= 0 && occ[y * W + p.x] < 0; y--) mn--;
      for (y = p.y + p.len; y < H && occ[y * W + p.x] < 0; y++) mx++;
    }
    return { min: mn, max: mx };
  }
  function clone(pieces) { return pieces.map(function (p) { var o = { id: p.id, type: p.type, x: p.x, y: p.y, len: p.len, dir: p.dir, fixed: p.fixed }; if (p.col != null) o.col = p.col; return o; }); }
  // returns new pieces array, or null when the slide is illegal (blocked, off-axis, fixed, zero)
  function move(pieces, k, delta) {
    if (!delta || !pieces[k] || pieces[k].fixed || delta !== Math.round(delta)) return null;
    var l = limits(pieces, k); if (delta < l.min || delta > l.max) return null;
    var n = clone(pieces); if (n[k].dir === 'h') n[k].x += delta; else n[k].y += delta; return n;
  }
  function isWin(pieces) { var c = pieces[0]; return c.type === 'mudik' && c.y === EXIT_ROW && c.x + c.len === W; }
  function key(pieces) { var s = ''; for (var i = 0; i < pieces.length; i++) s += String.fromCharCode(48 + (pieces[i].dir === 'h' ? pieces[i].x : pieces[i].y)); return s; }
  // BFS: fewest moves (a slide of any distance = 1 move) until the car reaches the exit.
  // Compact state: one byte per piece = its position along its own axis.
  function solve(pieces, maxStates) {
    maxStates = maxStates || 200000;
    var n = pieces.length, dir = [], len = [], fix = [], other = [], i;
    var st0 = new Array(n);
    for (i = 0; i < n; i++) { var p = pieces[i]; dir[i] = p.dir === 'h' ? 1 : 0; len[i] = p.len; fix[i] = p.fixed ? 1 : 0; other[i] = dir[i] ? p.y : p.x; st0[i] = dir[i] ? p.x : p.y; }
    var carTarget = W - len[0];
    if (st0[0] === carTarget) return { moves: 0, path: [] };
    var occ = new Int8Array(W * H), k0 = String.fromCharCode.apply(null, st0.map(function (v) { return v + 48; }));
    var prev = new Map(); prev.set(k0, null);
    var q = [k0], qi = 0, codes = new Array(n);
    while (qi < q.length) {
      var ck = q[qi++];
      for (i = 0; i < W * H; i++) occ[i] = 0;
      for (i = 0; i < n; i++) {
        codes[i] = ck.charCodeAt(i); var v = codes[i] - 48;
        for (var j = 0; j < len[i]; j++) occ[dir[i] ? other[i] * W + v + j : (v + j) * W + other[i]] = 1;
      }
      for (var k = 0; k < n; k++) {
        if (fix[k]) continue; var pos = codes[k] - 48, d, c;
        for (var s2 = -1; s2 <= 1; s2 += 2) {
          for (d = s2; ; d += s2) {
            var np = pos + d, edge = s2 < 0 ? np : np + len[k] - 1;
            if (edge < 0 || edge >= (dir[k] ? W : H)) break;
            c = dir[k] ? other[k] * W + edge : edge * W + other[k];
            if (occ[c]) break;
            var nk = ck.substring(0, k) + String.fromCharCode(np + 48) + ck.substring(k + 1);
            if (prev.has(nk)) continue; prev.set(nk, [ck, k, d]);
            if (k === 0 && np === carTarget) { var path = [], z = nk; while (prev.get(z)) { var e = prev.get(z); path.unshift([e[1], e[2]]); z = e[0]; } return { moves: path.length, path: path, states: prev.size }; }
            if (prev.size > maxStates) return null;
            q.push(nk);
          }
        }
      }
    }
    return { moves: -1, path: [], states: prev.size }; // unsolvable
  }
  // car can drive straight out once every cell to its right on the exit row is free
  function exitClear(pieces) { var occ = grid(pieces, 0), c = pieces[0]; for (var x = c.x + c.len; x < W; x++) if (occ[c.y * W + x] >= 0) return false; return true; }
  // stars: 3 = par or better, 2 = within slack, 1 = solved. Using a hint caps at 2.
  function stars(moves, par, hinted, cfg) {
    cfg = cfg || { slack: 0.5, minSlack: 2 };
    var s = moves <= par ? 3 : moves <= par + Math.max(cfg.minSlack, Math.ceil(par * cfg.slack)) ? 2 : 1;
    return hinted ? Math.min(2, s) : s;
  }
  // ---- calendar + seeded RNG (daily level) ----
  function dateKey(ms, offsetMin) { // calendar date in a fixed zone, default Asia/Makassar (UTC+8)
    var d = new Date((ms == null ? Date.now() : ms) + (offsetMin == null ? 480 : offsetMin) * 60000);
    return d.getUTCFullYear() + '-' + ('0' + (d.getUTCMonth() + 1)).slice(-2) + '-' + ('0' + d.getUTCDate()).slice(-2);
  }
  function hash(s) { var h = 2166136261 >>> 0; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h >>> 0; }
  function rng(seed) { var a = seed >>> 0; return function () { a = (a + 0x6D2B79F5) >>> 0; var t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function toGrid(pieces) {
    var rows = []; for (var y = 0; y < H; y++) rows.push('......'.split(''));
    var v = ''; pieces.forEach(function (p) { cells(p).forEach(function (c) { rows[c[1]][c[0]] = p.type === 'polisi' ? 'x' : p.id; }); if (p.type === 'motor' && p.dir === 'v') v += p.id; });
    return { g: rows.map(function (r) { return r.join(''); }), v: v };
  }
  function randomPiece(R, ps, shape) {
    var up = 'BCDEFGHIJKLMNOPQRSTUVW', lo = 'abcdefghijklmnopqrstuvw', used = {}, pol = 0;
    ps.forEach(function (q) { used[q.id] = 1; if (q.type === 'polisi') pol++; });
    for (var t = 0; t < 30; t++) {
      var r = R(), p;
      if (r < shape.pPolisi && pol < shape.maxPolisi) p = { type: 'polisi', len: 1, dir: 'h', fixed: true };
      else if (r < shape.pPolisi + shape.pMotor) p = { type: 'motor', len: 1, dir: R() < 0.5 ? 'h' : 'v', fixed: false };
      else { var bus = R() < shape.pBus; p = { type: bus ? 'bus' : 'angkot', len: bus ? 3 : 2, dir: R() < 0.6 ? 'v' : 'h', fixed: false }; }
      p.x = Math.floor(R() * (W - (p.dir === 'h' ? p.len - 1 : 0))); p.y = Math.floor(R() * (H - (p.dir === 'v' ? p.len - 1 : 0)));
      if (p.y === EXIT_ROW && (p.dir === 'h' || p.type === 'polisi')) continue; // would block the exit forever
      if (!validPlacement(ps.concat([p]))) continue;
      if (p.type === 'polisi') p.id = 'x' + p.x + p.y;
      else { var pool = p.type === 'motor' ? lo : up; for (var i = 0; i < pool.length; i++) if (!used[pool[i]]) { p.id = pool[i]; break; } if (!p.id) return null; }
      return p;
    }
    return null;
  }
  // deterministic generator: random start, then hill-climb towards longer optimal solutions (bounded steps).
  function generate(seedStr, opt) {
    opt = opt || {}; var lo = opt.minMoves || 8, hi = opt.maxMoves || 22, steps = opt.steps || 260, cap = opt.cap || 15000;
    var R = rng(hash(seedStr)), shape = { pPolisi: 0.07, pMotor: 0.15, pBus: 0.3, maxPolisi: 1 };
    var cur = null, curM = 0, best = null;
    for (var t = 0; t < steps; t++) {
      var ps;
      if (!cur) { ps = [{ id: 'A', type: 'mudik', x: Math.floor(R() * 2), y: EXIT_ROW, len: 2, dir: 'h', fixed: false }]; for (var i = 0; i < 9; i++) { var np = randomPiece(R, ps, shape); if (np) ps.push(np); } }
      else {
        ps = clone(cur); var r = R(), j = 1 + Math.floor(R() * (ps.length - 1));
        if (r < 0.45 || ps.length < 6) { var a = randomPiece(R, ps, shape); if (a) ps.push(a); }
        else if (r < 0.7 && ps.length > 6) ps.splice(j, 1);
        else { var rm = ps.splice(j, 1)[0], b = randomPiece(R, ps, shape); if (b) ps.push(b); else ps.splice(j, 0, rm); }
        if (ps.length > 14) continue;
      }
      if (exitClear(ps)) continue;
      var s = solve(ps, cap); if (!s || s.moves < 1 || s.moves > hi) continue;
      if (!cur || s.moves >= curM) { cur = ps; curM = s.moves; }
      if (curM >= lo && (!best || curM > best.par)) best = { pieces: clone(cur), par: curM };
      if (best && best.par >= hi) break;
    }
    if (!best && cur) best = { pieces: cur, par: curM };
    if (!best) { var f = parse({ g: ['..B...', '..B..C', 'AAB..C', '.....C', '......', '......'] }); best = { pieces: f, par: solve(f).moves }; }
    best.pieces.forEach(function (p) { if (p.type === 'polisi') p.id = 'x' + p.x + p.y; });
    var tg = toGrid(best.pieces); return { g: tg.g, v: tg.v, par: best.par, seed: seedStr };
  }
  function daily(dk) { return generate('mudikmacet|' + dk, { minMoves: 10, maxMoves: 22, steps: 220 }); }
  // ---- records ----
  function mergeBest(rec, id, moves, st) {
    rec = rec || {}; var o = rec[id], isNew = !o || moves < o.moves;
    var n = { moves: o ? Math.min(o.moves, moves) : moves, stars: Math.max(o ? o.stars : 0, st), plays: (o ? o.plays : 0) + 1 };
    var r = {}; for (var k in rec) r[k] = rec[k]; r[id] = n; return { rec: r, isNew: isNew };
  }
  function tutDone(store) { try { return store.getItem('mudikmacet.tut') === '1'; } catch (e) { return false; } }
  function setTut(store, v) { try { if (v) store.setItem('mudikmacet.tut', '1'); else store.removeItem('mudikmacet.tut'); } catch (e) {} }
  G.MM = { W: W, H: H, EXIT_ROW: EXIT_ROW, parse: parse, cells: cells, grid: grid, limits: limits, move: move, isWin: isWin, solve: solve, exitClear: exitClear,
    stars: stars, dateKey: dateKey, hash: hash, rng: rng, generate: generate, daily: daily, toGrid: toGrid, clone: clone, validPlacement: validPlacement,
    mergeBest: mergeBest, tutDone: tutDone, setTut: setTut };
})(typeof globalThis !== 'undefined' ? globalThis : this);

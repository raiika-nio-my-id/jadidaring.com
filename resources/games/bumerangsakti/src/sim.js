// Bumerang Sakti rules engine: pure functions (no DOM, no audio) so tests can run them in node.
(function (B) {
  'use strict';
  var NAME_RE = /^[A-Za-z0-9 ._'-]{1,16}$/;
  function cleanName(s) { return String(s == null ? '' : s).replace(/\s+/g, ' ').trim(); }
  function validName(s) { s = cleanName(s); return s.length >= 1 && s.length <= 16 && NAME_RE.test(s); }
  function clampScore(n) { n = Math.floor(+n || 0); return Math.max(0, Math.min(1e9, n)); }

  function rng(seed) { var a = seed >>> 0; return function () { a = (a + 0x6D2B79F5) >>> 0; var t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

  function tierFor(combo, tiers) { var t = 0; for (var i = 0; i < tiers.length; i++) if (combo >= tiers[i]) t = i; return t; }
  // Multiplier grows 0.5 every 5 combo, capped at x5.
  function multFor(combo) { return Math.min(5, 1 + Math.floor(combo / 5) * 0.5); }
  function killScore(kind, combo, base) { return Math.round((base[kind] || 10) * multFor(combo)); }
  // Bonus for several kills in one throw: 3+ kills.
  function multiBonus(kills, combo) { return kills >= 3 ? Math.round(kills * kills * 5 * multFor(combo)) : 0; }
  function coinsFor(score, div) { return Math.floor(clampScore(score) / (div || 50)); }

  function dist(ax, ay, bx, by) { var dx = ax - bx, dy = ay - by; return Math.sqrt(dx * dx + dy * dy); }
  function pathLength(pts) { var L = 0; for (var i = 1; i < pts.length; i++) L += dist(pts[i - 1].x, pts[i - 1].y, pts[i].x, pts[i].y); return L; }
  // Throw rule: path starts AND ends within r of the player; long enough to be a real throw.
  function checkThrow(pts, px, py, r, minLen) {
    if (!pts || pts.length < 3) return 'short';
    if (dist(pts[0].x, pts[0].y, px, py) > r) return 'start';
    if (pathLength(pts) < (minLen || 100)) return 'short';
    var e = pts[pts.length - 1];
    if (dist(e.x, e.y, px, py) > r) return 'end';
    return 'ok';
  }
  // Point at distance d along the polyline.
  function pointAt(pts, d) {
    for (var i = 1; i < pts.length; i++) {
      var a = pts[i - 1], b = pts[i], l = dist(a.x, a.y, b.x, b.y);
      if (d <= l || i === pts.length - 1) { var k = l ? Math.min(1, d / l) : 1; return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, ang: Math.atan2(b.y - a.y, b.x - a.x) }; }
      d -= l;
    }
    var p = pts[pts.length - 1]; return { x: p.x, y: p.y, ang: 0 };
  }
  // Distance from point c to segment ab, used for swept boomerang hits.
  function segDist(ax, ay, bx, by, cx, cy) {
    var dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy, t = l2 ? ((cx - ax) * dx + (cy - ay) * dy) / l2 : 0;
    t = Math.max(0, Math.min(1, t)); return dist(ax + dx * t, ay + dy * t, cx, cy);
  }

  // ---- Formations (relative coords: x 0..1 across field, y 0..1 down the sky area) ----
  function shapes(n, kind, R) {
    var out = [], i;
    if (kind === 'line') for (i = 0; i < n; i++) out.push({ x: 0.2 + 0.6 * (n === 1 ? 0.5 : i / (n - 1)), y: 0.45 + (R() - 0.5) * 0.2 });
    else if (kind === 'arc') for (i = 0; i < n; i++) { var a = Math.PI * (0.15 + 0.7 * (n === 1 ? 0.5 : i / (n - 1))); out.push({ x: 0.5 - Math.cos(a) * 0.36, y: 0.72 - Math.sin(a) * 0.5 }); }
    else if (kind === 'vee') for (i = 0; i < n; i++) { var k = n === 1 ? 0.5 : i / (n - 1); out.push({ x: 0.16 + 0.68 * k, y: 0.2 + Math.abs(k - 0.5) * 1.1 }); }
    else if (kind === 'ring') for (i = 0; i < n; i++) { var b = i / n * Math.PI * 2; out.push({ x: 0.5 + Math.cos(b) * 0.3, y: 0.45 + Math.sin(b) * 0.3 }); }
    else if (kind === 'grid') { var cols = Math.ceil(n / 2); for (i = 0; i < n; i++) out.push({ x: 0.2 + 0.6 * (cols === 1 ? 0.5 : (i % cols) / (cols - 1)), y: 0.3 + Math.floor(i / cols) * 0.32 }); }
    else if (kind === 'zig') for (i = 0; i < n; i++) out.push({ x: 0.14 + 0.72 * (n === 1 ? 0.5 : i / (n - 1)), y: i % 2 ? 0.62 : 0.3 });
    else for (i = 0; i < n; i++) out.push({ x: 0.15 + R() * 0.7, y: 0.15 + R() * 0.7 }); // scatter
    return out;
  }
  var KINDS_BY_TIER = [['line', 'arc'], ['line', 'arc', 'vee'], ['arc', 'vee', 'ring', 'grid'], ['ring', 'grid', 'zig', 'vee', 'scatter'], ['ring', 'grid', 'zig', 'scatter', 'vee']];
  // Build one wave. ctx: { tier, wave, timeLeft, hasShield }. Returns { shape, move, items:[{kind,x,y}] }.
  function makeWave(R, ctx) {
    var tier = Math.max(0, Math.min(4, ctx.tier | 0)), wave = ctx.wave | 0;
    var n = [3, 4, 6, 8, 10][tier] + Math.floor(R() * (tier + 1)), pool = KINDS_BY_TIER[tier];
    if (wave < 2) n = 3;
    var shape = pool[Math.floor(R() * pool.length)], pts = shapes(n, shape, R), items = [];
    var bigs = tier === 0 ? (wave > 3 && R() < 0.3 ? 1 : 0) : Math.min(3, Math.floor(R() * (tier + 1)));
    var bombs = wave < 2 ? 0 : tier === 0 ? (R() < 0.35 ? 1 : 0) : Math.min(3, 1 + Math.floor(R() * tier * 0.8));
    var tnt = wave < 1 ? 0 : (R() < 0.2 + tier * 0.12 ? 1 : 0) + (tier >= 3 && R() < 0.4 ? 1 : 0);
    pts.forEach(function (p) { items.push({ kind: 'mon', x: p.x, y: p.y }); });
    // TNT goes in the middle of a cluster (ring centre is perfect), big monsters on random slots.
    if (tnt) { if (shape === 'ring') items.push({ kind: 'tnt', x: 0.5, y: 0.45 }); else items[Math.floor(items.length / 2)].kind = 'tnt'; if (tnt > 1) items[0].kind = 'tnt'; }
    for (var b = 0; b < bigs; b++) { var m = items.filter(function (it) { return it.kind === 'mon'; }); if (m.length > 2) m[Math.floor(R() * m.length)].kind = 'big'; }
    // Bombs sit between/around the formation, never on top of it.
    for (var j = 0; j < bombs; j++) items.push(freeSpot(R, items, 'bomb'));
    var pTime = ctx.timeLeft < 25 ? 0.45 : 0.16, pShield = ctx.hasShield ? 0 : 0.1 + tier * 0.03;
    if (wave >= 1 && R() < pTime) items.push(freeSpot(R, items, 'time'));
    if (wave >= 2 && R() < pShield) items.push(freeSpot(R, items, 'shield'));
    var moves = tier === 0 ? ['bob'] : tier === 1 ? ['bob', 'sway'] : ['sway', 'drift', 'spin', 'bob'];
    var move = moves[Math.floor(R() * moves.length)];
    if (move === 'spin' && shape !== 'ring') move = 'sway';
    return { shape: shape, move: move, items: items };
  }
  function freeSpot(R, items, kind) {
    var best = null, bd = -1;
    for (var t = 0; t < 14; t++) {
      var p = { kind: kind, x: 0.08 + R() * 0.84, y: 0.05 + R() * 0.85 }, d = 9;
      items.forEach(function (it) { d = Math.min(d, dist(it.x, it.y, p.x, p.y)); });
      if (d > bd) { bd = d; best = p; }
      if (d > 0.2) break;
    }
    return best;
  }


  // Boss stage after every `every` normal waves (normalCount = normal waves spawned so far).
  function bossDue(normalCount, every, lastBossAt) { return every > 0 && normalCount > 0 && normalCount % every === 0 && lastBossAt !== normalCount; }
  function bossWave(R) {
    var items = [{ kind: 'boss', x: 0.5, y: 0.42 }, { kind: 'mon', x: 0.12, y: 0.25 }, { kind: 'mon', x: 0.88, y: 0.25 }];
    if (R() < 0.5) items.push({ kind: 'time', x: 0.12 + R() * 0.76, y: 0.9 });
    return { shape: 'boss', move: 'sway', boss: true, items: items };
  }
  function mergeLocal(list, entry, max) {
    list = (list || []).slice(); list.push(entry);
    list.sort(function (a, b) { return b.score - a.score || (a.at || 0) - (b.at || 0); });
    return list.slice(0, max || 20);
  }
  function parseBoard(j) {
    var arr = Array.isArray(j) ? j : j && (j.scores || j.data || j.items) || [];
    if (!Array.isArray(arr) && arr && Array.isArray(arr.data)) arr = arr.data;
    return (Array.isArray(arr) ? arr : []).map(function (r) { return { name: String(r.name || r.player_name || '?').slice(0, 16), score: clampScore(r.score) }; })
      .sort(function (a, b) { return b.score - a.score; });
  }

  B.cleanName = cleanName; B.validName = validName; B.clampScore = clampScore; B.rng = rng;
  B.tierFor = tierFor; B.multFor = multFor; B.killScore = killScore; B.multiBonus = multiBonus; B.coinsFor = coinsFor;
  B.dist = dist; B.pathLength = pathLength; B.checkThrow = checkThrow; B.pointAt = pointAt; B.segDist = segDist;
  B.makeWave = makeWave; B.bossDue = bossDue; B.bossWave = bossWave; B.shapes = shapes; B.mergeLocal = mergeLocal; B.parseBoard = parseBoard;
})(globalThis.BS = globalThis.BS || {});

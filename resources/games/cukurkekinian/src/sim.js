// Cukur Kekinian - pure rules: head + hair strands, style targets, scissors/clipper cuts, scoring, shift, records. No DOM.
(function (G) {
  'use strict';
  var U = 0.25, RX = 0.86, RY = 1.0, BRUSH = 0.22, CLIP_RATE = 9, SNIP_MIN = 0.15, HEAD_PAD = 1.035;
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function rng(seed) {
    var s = String(seed), h = 1779033703 ^ s.length;
    for (var i = 0; i < s.length; i++) { h = Math.imul(h ^ s.charCodeAt(i), 3432918353); h = h << 13 | h >>> 19; }
    return function () { h = Math.imul(h ^ h >>> 16, 2246822507); h = Math.imul(h ^ h >>> 13, 3266489909); h ^= h >>> 16; return (h >>> 0) / 4294967296; };
  }
  // strand roots: front scalp from left ear (-100deg) over the crown to right ear (+100deg), plus nape hair behind the neck
  var ANG = [];
  for (var a = -100; a <= 100; a += 5) ANG.push(a);
  [105, 111, 117, 123, 129, 135].forEach(function (n) { ANG.unshift(-n); ANG.push(n); });
  ANG.sort(function (x, y) { return x - y; });
  function zone(th) { var a = Math.abs(th); return a > 102 ? 'nape' : a <= 42 ? 'top' : 'side'; }
  function target(st, th) {
    var a = Math.abs(th); if (a > 102) return st.nape;
    var tw = st.topW == null ? 45 : st.topW, bl = st.blend || 10, side = st.side;
    if (st.fade != null) { var f = clamp((100 - a) / Math.max(1, 100 - (tw + bl)), 0, 1); side = st.fade + (st.side - st.fade) * f; }
    if (a <= tw) return st.top;
    if (a >= tw + bl) return side;
    var k = (a - tw) / bl; k = k * k * (3 - 2 * k); return st.top + (side - st.top) * k;
  }
  function root(th) { var r = th * Math.PI / 180; return { x: RX * Math.sin(r), y: -RY * Math.cos(r) }; }
  function inHead(x, y, pad) { var u = x / RX, v = y / RY; return u * u + v * v < pad * pad; }
  // polyline of a strand in head units (head radius ~1). Returns {pts:[x0,y0,x1,y1...], step: cm per segment}
  function path(sd, L, part) {
    L = L == null ? sd.L : L; var r0 = root(sd.th), x = r0.x, y = r0.y, nx = x / (RX * RX), ny = y / (RY * RY), d = Math.hypot(nx, ny); nx /= d; ny /= d;
    var pts = [x, y]; if (L <= 0.001) return { pts: pts, step: 0 };
    var n = Math.max(1, Math.ceil(L / 0.25)), c = L / n, side = sd.th > 0 ? 1 : sd.th < 0 ? -1 : (sd.i % 2 ? 1 : -1), a = Math.abs(sd.th);
    var push = a < 30 ? (part ? 0.9 : 0.35) * (1 - a / 30) : 0, dx = nx, dy = ny, s = 0;
    for (var k = 0; k < n; k++) {
      s += c; dy += (0.16 + 0.11 * s) * c; dx += side * push * c; if (a > 102) dy += 0.35 * c;
      d = Math.hypot(dx, dy); dx /= d; dy /= d; x += dx * c * U; y += dy * c * U;
      if (a <= 102 && inHead(x, y, HEAD_PAD)) { var u = x / RX, v = y / RY, m = Math.hypot(u, v) || 1; x = x / m * HEAD_PAD; y = y / m * HEAD_PAD; }
      pts.push(x, y);
    }
    return { pts: pts, step: c };
  }
  function segX(ax, ay, bx, by, cx, cy, dx, dy) { // intersection of AB and CD -> t on CD or -1
    var rx = bx - ax, ry = by - ay, sx = dx - cx, sy = dy - cy, den = rx * sy - ry * sx; if (Math.abs(den) < 1e-9) return -1;
    var qx = cx - ax, qy = cy - ay, t = (qx * sy - qy * sx) / den, u = (qx * ry - qy * rx) / den;
    return t >= 0 && t <= 1 && u >= 0 && u <= 1 ? u : -1;
  }
  function styleById(cfg, id) { for (var i = 0; i < cfg.styles.length; i++) if (cfg.styles[i].id === id) return cfg.styles[i]; return cfg.styles[0]; }
  function create(o) {
    var cfg = o.cfg, st = typeof o.style === 'string' ? styleById(cfg, o.style) : o.style, r = rng(o.seed || 'x');
    var S = { cfg: cfg, style: st, seed: o.seed, strands: [], time: 0, limit: o.limit == null ? cfg.game.patience : o.limit, done: false, ev: [], snips: 0, clipT: 0, overs: 0, guard: 1, tool: 'scissors' };
    ANG.forEach(function (th, i) {
      var T = target(st, th), z = zone(th), base = z === 'nape' ? 2.1 + r() * 0.5 : 2.8 + r() * 0.6, L = Math.max(base, T + 0.7 + r() * 0.3);
      S.strands.push({ i: i, th: th, z: z, T: T, L: L, L0: L, ov: false, hit: 0 });
    });
    return S;
  }
  function evt(S, e) { S.ev.push(e); }
  function events(S) { var e = S.ev; S.ev = []; return e; }
  function checkOver(S, sd) { if (!sd.ov && sd.L < sd.T - 0.35) { sd.ov = true; S.overs++; evt(S, { e: 'over', i: sd.i }); } }
  // scissors: a swipe segment (head units) cuts every strand it crosses, exactly at the crossing
  function snip(S, ax, ay, bx, by) {
    if (S.done) return 0; var n = 0;
    S.strands.forEach(function (sd) {
      if (sd.L <= SNIP_MIN + 0.05) return; var p = path(sd, sd.L, S.style.part), q = p.pts, best = -1;
      for (var k = 0; k + 3 < q.length; k += 2) { var u = segX(ax, ay, bx, by, q[k], q[k + 1], q[k + 2], q[k + 3]); if (u >= 0) { best = (k / 2 + u) * p.step; break; } }
      if (best < 0) return; var nl = Math.max(SNIP_MIN, best); if (nl > sd.L - 0.08) return;
      var from = sd.L; sd.L = nl; sd.hit = 1; n++; evt(S, { e: 'cut', i: sd.i, from: from, to: nl, tool: 'scissors' }); checkOver(S, sd);
    });
    if (n) { S.snips++; evt(S, { e: 'snip', n: n }); }
    return n;
  }
  // clipper: rub the scalp, strands whose root is under the head trim down to the guard length
  function clip(S, px, py, dt, guard, brush) {
    if (S.done) return 0; var g = guard == null ? S.cfg.game.guards[S.guard] : guard, amt = 0, br = brush || BRUSH;
    S.strands.forEach(function (sd) {
      var r0 = root(sd.th); if (Math.hypot(r0.x - px, r0.y - py) > br || sd.L <= g + 0.001) return;
      var d = Math.min(sd.L - g, CLIP_RATE * dt), from = sd.L; sd.L -= d; if (sd.L - g < 0.002) sd.L = g; amt += d; sd.hit = 1;
      evt(S, { e: 'cut', i: sd.i, from: from, to: sd.L, tool: 'clipper' }); checkOver(S, sd);
    });
    if (amt) S.clipT += dt; return amt;
  }
  function onScalp(px, py) { return inHead(px, py, 1 + BRUSH) && py < 0.62; }
  function acc(sd) { var e = sd.L - sd.T, tol = 0.45 + 0.1 * sd.T; if (e < 0) tol *= 0.85; return Math.max(0, 1 - (e / tol) * (e / tol)); }
  function match(S) { var s = 0; S.strands.forEach(function (sd) { s += acc(sd); }); return Math.round(100 * s / S.strands.length); }
  function zoneMatch(S, z) { var s = 0, n = 0; S.strands.forEach(function (sd) { if (sd.z === z || (z === 'side' && sd.z === 'nape')) { s += acc(sd); n++; } }); return n ? s / n : 1; }
  function stars(cfg, pct) { var a = cfg.game.starAt, n = 1; for (var i = 0; i < a.length; i++) if (pct >= a[i]) n = i + 2; return n; }
  function tip(st, left) { return st * 2000 + (st >= 3 ? Math.floor(Math.max(0, left)) * 100 : 0); }
  function finish(S) {
    if (S.done) return S.result; S.done = true; var pct = match(S), st = stars(S.cfg, pct), left = S.limit ? Math.max(0, S.limit - S.time) : 0;
    S.result = { pct: pct, stars: st, react: st - 1, tip: tip(st, left), left: left, overs: S.overs, style: S.style.id };
    evt(S, { e: 'finish', r: S.result }); return S.result;
  }
  function step(S, dt) {
    if (S.done) return; S.time += dt; S.strands.forEach(function (sd) { if (sd.hit) sd.hit = Math.max(0, sd.hit - dt * 3); });
    if (S.limit && S.time >= S.limit) { evt(S, { e: 'timeout' }); finish(S); }
  }
  // a shift: N customers, first one an easy style, no style repeats, everyone different
  function shift(cfg, seed, n) {
    var r = rng(seed), n0 = n || cfg.game.shiftSize, easy = cfg.styles.filter(function (s) { return s.easy; }), first = easy[Math.floor(r() * easy.length)];
    var rest = cfg.styles.filter(function (s) { return s !== first; }), cs = cfg.customers.slice(), out = [];
    for (var i = rest.length - 1; i > 0; i--) { var j = Math.floor(r() * (i + 1)), t = rest[i]; rest[i] = rest[j]; rest[j] = t; }
    for (i = cs.length - 1; i > 0; i--) { j = Math.floor(r() * (i + 1)); t = cs[i]; cs[i] = cs[j]; cs[j] = t; }
    var styles = [first].concat(rest);
    for (i = 0; i < n0; i++) out.push({ style: styles[i % styles.length].id, who: cs[i % cs.length], seed: seed + ':' + i });
    return out;
  }
  function needTut(v) { return !(v === 1 || v === '1' || v === true); }
  function record(rec, sum) { // sum: {stars, tips, perfects}
    rec = rec && typeof rec === 'object' ? rec : {}; var o = { best: rec.best || 0, bestTip: rec.bestTip || 0, shifts: (rec.shifts || 0) + 1, perfects: (rec.perfects || 0) + (sum.perfects || 0) };
    var nb = sum.stars > o.best || (sum.stars === o.best && sum.tips > o.bestTip && o.best > 0);
    if (sum.stars > o.best) o.best = sum.stars; if (sum.tips > o.bestTip) o.bestTip = sum.tips; o.newBest = nb && sum.stars > 0; return o;
  }
  // autoplay barber (home background, #demo, balance tests): one action per call
  function bot(S, dt) {
    if (S.done) return null; var g = S.cfg.game.guards, worst = null, wv = 0.12;
    S.strands.forEach(function (sd) { var e = sd.L - sd.T; if (e > wv) { wv = e; worst = sd; } });
    if (!worst) return null; var T = worst.T, gi = -1;
    for (var i = 0; i < g.length; i++) if (Math.abs(g[i] - T) < 0.06) gi = i;
    if (gi < 0 && T < SNIP_MIN + 0.03) gi = 0;
    var r0 = root(worst.th);
    if (gi >= 0) { S.guard = gi; S.tool = 'clipper'; var jx = r0.x * 0.98, jy = r0.y * 0.98; clip(S, jx, jy, dt, g[gi], 0.05); return { tool: 'clipper', x: jx, y: jy }; }
    S.tool = 'scissors'; var p = path(worst, worst.L, S.style.part), q = p.pts, k = Math.min(q.length / 2 - 2, Math.floor(T / (p.step || 1)));
    var u = p.step ? (T - k * p.step) / p.step : 0, x = q[k * 2] + (q[k * 2 + 2] - q[k * 2]) * u, y = q[k * 2 + 1] + (q[k * 2 + 3] - q[k * 2 + 1]) * u;
    var tx = q[k * 2 + 2] - q[k * 2], ty = q[k * 2 + 3] - q[k * 2 + 1], tl = Math.hypot(tx, ty) || 1, nx = -ty / tl * 0.02, ny = tx / tl * 0.02;
    // a precise snip on this one strand only (long hair overlaps, a real swipe could catch neighbours)
    var from = worst.L; worst.L = Math.max(T, SNIP_MIN); worst.hit = 1; S.snips++; evt(S, { e: 'cut', i: worst.i, from: from, to: worst.L, tool: 'scissors' }); evt(S, { e: 'snip', n: 1 });
    return { tool: 'scissors', x: x, y: y };
  }
  G.CK = { U: U, RX: RX, RY: RY, BRUSH: BRUSH, SNIP_MIN: SNIP_MIN, ANG: ANG, rng: rng, zone: zone, target: target, root: root, path: path, inHead: inHead, onScalp: onScalp, styleById: styleById,
    create: create, events: events, snip: snip, clip: clip, acc: acc, match: match, zoneMatch: zoneMatch, stars: stars, tip: tip, finish: finish, step: step, shift: shift, needTut: needTut, record: record, bot: bot };
})(typeof window !== 'undefined' ? window : globalThis);

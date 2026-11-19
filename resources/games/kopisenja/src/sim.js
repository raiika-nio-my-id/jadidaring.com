// Kopi Senja - pure rules (no DOM): seeded orders, recipe steps, mistakes, patience, latte-art scoring, stars/tips/combo, shift summary, records, bot.
(function (G) {
  'use strict';
  function hash(s) { s = String(s); var h = 1779033703 ^ s.length; for (var i = 0; i < s.length; i++) { h = Math.imul(h ^ s.charCodeAt(i), 3432918353); h = h << 13 | h >>> 19; } return h >>> 0; }
  function rng(seed) { var a = hash(seed) || 1; return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function waDay(d) { var x = new Date((d ? +d : Date.now()) + 8 * 3600e3); return x.toISOString().slice(0, 10); }
  function drinkById(cfg, id) { for (var i = 0; i < cfg.drinks.length; i++) if (cfg.drinks[i].id === id) return cfg.drinks[i]; return null; }
  function ingById(cfg, id) { for (var i = 0; i < cfg.ingredients.length; i++) if (cfg.ingredients[i].id === id) return cfg.ingredients[i]; return null; }
  function wpick(r, list, avoid) {
    var tot = 0, i, c = list.filter(function (d) { return avoid.indexOf(d.id) < 0; }); if (!c.length) c = list;
    for (i = 0; i < c.length; i++) tot += c[i].w || 1; var x = r() * tot;
    for (i = 0; i < c.length; i++) { x -= c[i].w || 1; if (x < 0) return c[i]; } return c[c.length - 1];
  }
  // ---------- shift ----------
  function shift(o) {
    var cfg = o.cfg, mode = o.mode || 'biasa', M = cfg.game.modes[mode], r = rng(o.seed || (mode + Date.now())), orders = [], lastC = -1;
    var fixed = o.drinks || null, n = fixed ? fixed.length : M.orders;
    for (var i = 0; i < n; i++) {
      var d;
      if (fixed) d = drinkById(cfg, fixed[i]);
      else if (i === 0 && mode !== 'harian') d = drinkById(cfg, 'aren');
      else { var avoid = []; if (orders.length >= 1) avoid.push(orders[orders.length - 1].drink); if (orders.length >= 2 && orders[orders.length - 2].drink === orders[orders.length - 1].drink) avoid.push(orders[orders.length - 1].drink); d = wpick(r, cfg.drinks, orders.length ? [orders[orders.length - 1].drink] : []); }
      var c; do { c = Math.floor(r() * cfg.customers.length); } while (c === lastC && cfg.customers.length > 1); lastC = c;
      orders.push({ drink: d.id, cust: c, line: Math.floor(r() * 1000) });
    }
    return { cfg: cfg, mode: mode, M: M, orders: orders, i: 0, res: [], streak: 0, bestCombo: 0, money: 0, tips: 0, score: 0, done: false };
  }
  function cup(S, patienceMul) {
    var o = S.orders[S.i], d = drinkById(S.cfg, o.drink);
    return { o: o, d: d, step: 0, added: [], mistakes: 0, time: 0, pat: S.M.patience * (patienceMul || 1) * (1 + 0.12 * (d.steps.length - 3)), phase: 'mix', art: null, artScore: null, wrong: [] };
  }
  function expect(C) { return C.phase === 'mix' ? C.d.steps[C.step] : null; }
  function add(C, ing) {
    if (C.phase !== 'mix') return { ok: false, ignored: true };
    var want = C.d.steps[C.step];
    if (ing !== want) { C.mistakes++; C.wrong.push(ing); return { ok: false, expect: want }; }
    C.added.push(ing); C.step++;
    if (C.step >= C.d.steps.length) C.phase = C.d.art ? 'art' : 'done';
    return { ok: true, done: C.phase !== 'mix', art: C.phase === 'art' };
  }
  function tick(C, dt) { if (C.phase === 'mix' || C.phase === 'art') C.time += dt; return C.phase !== 'done' && C.phase !== 'gone' && C.time >= C.pat ? 'leave' : null; }
  function patFrac(C) { return Math.max(0, 1 - C.time / C.pat); }
  // ---------- latte art ----------
  var ARTN = 32, artCache = {};
  function artPaths(kind) {
    var P = [], i, t, a;
    if (kind === 'heart') { a = []; for (i = 0; i <= 60; i++) { t = i / 60 * Math.PI * 2; var x = 16 * Math.pow(Math.sin(t), 3), y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t); a.push([x / 17 * 0.62, -y / 17 * 0.62 - 0.04]); } P.push(a); }
    else if (kind === 'leaf') {
      P.push([[0, -0.66], [0, 0.66]]);
      for (var k = 0; k < 5; k++) { var y0 = -0.42 + k * 0.22, w = 0.24 + k * 0.08; a = []; for (i = 0; i <= 12; i++) { t = i / 12 * 2 - 1; a.push([t * w, y0 + 0.16 * (1 - t * t) - 0.02]); } P.push(a); }
    } else { a = []; for (i = 0; i <= 90; i++) { t = i / 90; var ang = t * Math.PI * 2 * 2.6, rr = 0.06 + 0.58 * t; a.push([Math.cos(ang) * rr, Math.sin(ang) * rr]); } P.push(a); }
    return P;
  }
  function rasterize(paths, N, rad) {
    var g = new Uint8Array(N * N), cell = 2 / N;
    function stamp(x, y) { var cx = (x + 1) / cell, cy = (y + 1) / cell, r = rad; for (var j = Math.floor(cy - r); j <= Math.ceil(cy + r); j++) for (var i = Math.floor(cx - r); i <= Math.ceil(cx + r); i++) { if (i < 0 || j < 0 || i >= N || j >= N) continue; var dx = i + 0.5 - cx, dy = j + 0.5 - cy; if (dx * dx + dy * dy <= r * r) g[j * N + i] = 1; } }
    paths.forEach(function (p) {
      for (var k = 0; k < p.length; k++) {
        if (k === 0) { stamp(p[0][0], p[0][1]); continue; }
        var ax = p[k - 1][0], ay = p[k - 1][1], bx = p[k][0], by = p[k][1], L = Math.hypot(bx - ax, by - ay), n = Math.max(1, Math.ceil(L / (cell * 0.5)));
        for (var s = 1; s <= n; s++) stamp(ax + (bx - ax) * s / n, ay + (by - ay) * s / n);
      }
    });
    return g;
  }
  function artTarget(kind) { if (!artCache[kind]) artCache[kind] = rasterize(artPaths(kind), ARTN, 1.2); return artCache[kind]; }
  // strokes: array of arrays of [x,y] in cup units (-1..1, y down). Score 0..1 = F1 of user cells vs target cells (target dilated for precision).
  function artScore(kind, strokes) {
    var T = artTarget(kind), Tw = artCache[kind + ':w'] || (artCache[kind + ':w'] = rasterize(artPaths(kind), ARTN, 1.9));
    var U = rasterize((strokes || []).filter(function (s) { return s && s.length; }), ARTN, 1.2), u = 0, uin = 0, t = 0, tc = 0;
    for (var i = 0; i < T.length; i++) { if (U[i]) { u++; if (Tw[i]) uin++; } if (T[i]) { t++; if (U[i]) tc++; } }
    if (!u) return 0;
    var P = uin / u, R = tc / t; if (P + R === 0) return 0;
    return Math.round(Math.min(1, Math.pow(2 * P * R / (P + R), 1.9) * 1.3) * 100) / 100;
  }
  function setArt(C, strokes) { if (C.phase !== 'art') return null; C.art = strokes; C.artScore = artScore(C.d.art, strokes); C.phase = 'done'; return C.artScore; }
  function skipArt(C) { if (C.phase !== 'art') return; C.art = []; C.artScore = 0; C.phase = 'done'; }
  // ---------- scoring ----------
  function rate(S, C) {
    var g = S.cfg.game, pf = patFrac(C), stars = 5 - Math.min(3, C.mistakes) - (pf < g.lowPatience ? 1 : 0);
    if (C.d.art) { if (C.artScore == null || C.artScore < g.artBad) stars--; }
    stars = Math.max(1, Math.min(5, stars));
    var combo = 1 + g.comboStep * Math.min(S.streak + (stars >= 4 ? 1 : 0), g.comboMax) * (stars >= 4 ? 1 : 0);
    var tip = stars >= 3 ? stars * g.tipPerStar + (stars >= 4 ? Math.round(pf * g.speedTip / 500) * 500 : 0) : 0;
    tip = Math.round(tip * S.M.tipMul * combo / 500) * 500;
    var artBonus = C.d.art && C.artScore >= g.artGood ? 30 : 0;
    return { stars: stars, tip: tip, price: C.d.price, pf: Math.round(pf * 100) / 100, mistakes: C.mistakes, art: C.artScore, combo: combo, score: Math.round((C.d.price + tip) / 100) + stars * 20 + artBonus };
  }
  function serve(S, C) {
    if (S.done) return null; var r = rate(S, C);
    S.streak = r.stars >= 4 ? S.streak + 1 : 0; r.streak = S.streak; S.bestCombo = Math.max(S.bestCombo, S.streak);
    S.money += r.price + r.tip; S.tips += r.tip; S.score += r.score; S.res.push({ drink: C.d.id, cust: C.o.cust, r: r });
    C.phase = 'served'; S.i++; if (S.i >= S.orders.length) S.done = true; return r;
  }
  function leave(S, C) {
    if (S.done) return null; var r = { stars: 0, tip: 0, price: 0, pf: 0, mistakes: C.mistakes, art: null, combo: 1, score: 0, left: true, streak: 0 };
    S.streak = 0; S.res.push({ drink: C.d.id, cust: C.o.cust, r: r }); C.phase = 'gone'; S.i++; if (S.i >= S.orders.length) S.done = true; return r;
  }
  function summary(S) {
    var st = 0, perf = 0, served = 0; S.res.forEach(function (x) { st += x.r.stars; if (x.r.stars === 5) perf++; if (!x.r.left) served++; });
    return { served: served, total: S.orders.length, stars: st, avg: S.res.length ? Math.round(st / S.res.length * 10) / 10 : 0, money: S.money, tips: S.tips, perfect: perf, bestCombo: S.bestCombo, score: S.score, mode: S.mode };
  }
  function record(rec, sum, day) {
    rec = rec && typeof rec === 'object' ? JSON.parse(JSON.stringify(rec)) : {};
    rec.best = rec.best || {}; rec.daily = rec.daily || {};
    var isBest = !(rec.best[sum.mode] >= sum.score); if (isBest) rec.best[sum.mode] = sum.score;
    rec.shifts = (rec.shifts || 0) + 1; rec.cups = (rec.cups || 0) + sum.served; rec.perfect = (rec.perfect || 0) + sum.perfect;
    if (sum.mode === 'harian' && day) { if (!(rec.daily[day] >= sum.score)) rec.daily[day] = sum.score; var ks = Object.keys(rec.daily).sort(); while (ks.length > 14) delete rec.daily[ks.shift()]; }
    return { rec: rec, isBest: isBest };
  }
  function clock(S, cfg) { var g = (cfg || S.cfg).game, f = S.orders.length ? S.i / S.orders.length : 0; return Math.round(g.clockStart + (g.clockEnd - g.clockStart) * Math.min(1, f)); }
  function fmtClock(m) { var h = Math.floor(m / 60), mm = m % 60; return (h < 10 ? '0' : '') + h + ':' + (mm < 10 ? '0' : '') + mm; }
  // bot: next ingredient; skill 0..1 (chance of picking right)
  function bot(C, r, skill) { var w = expect(C); if (!w) return null; if (r && r() > (skill == null ? 1 : skill)) { var o = C.d.steps.filter(function (x) { return x !== w; }); return o[0] || 'air'; } return w; }
  function botArt(kind, r, noise) { r = r || Math.random; noise = noise == null ? 0.02 : noise; return artPaths(kind).map(function (p) { return p.map(function (q) { return [q[0] + (r() - 0.5) * noise, q[1] + (r() - 0.5) * noise]; }); }); }
  G.KS = { hash: hash, rng: rng, waDay: waDay, drinkById: drinkById, ingById: ingById, shift: shift, cup: cup, expect: expect, add: add, tick: tick, patFrac: patFrac,
    ARTN: ARTN, artPaths: artPaths, artTarget: artTarget, artScore: artScore, setArt: setArt, skipArt: skipArt, rate: rate, serve: serve, leave: leave, summary: summary, record: record, clock: clock, fmtClock: fmtClock, bot: bot, botArt: botArt };
})(typeof window !== 'undefined' ? window : globalThis);

// Whoosh Atur Rel simulation: track graph, trains, switches (wesel), signals, collisions, scoring, prediction and a look-ahead bot.
// Pure logic (no DOM) so node tests and the in-page demo share it.
var WR = (function () {
  'use strict';
  var SPEC = {
    kcic: { name: 'Whoosh', v: 2.7, L: 1.75, cars: 3, tol: 2.5, pts: 150, w: 3 },
    krl: { name: 'KRL', v: 1.6, L: 2.0, cars: 4, tol: 5, pts: 100, w: 1.5 },
    barang: { name: 'Kereta Barang', v: 0.95, L: 2.9, cars: 6, tol: 12, pts: 120, w: 0.6 }
  };
  var Z = 0.9, SIG = 1.15, GAP = 1.2, ZL = 0.5, ACC = 2.4, TAN = 1 / Math.tan(35 * Math.PI / 180);

  function rng(seed) { var s = (seed >>> 0) || 1; return function () { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
  function hash(str) { var h = 2166136261; for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

  // ---------- map ----------
  function round(pts) { // rounded corners on interior points
    if (pts.length < 3) return pts;
    var out = [pts[0]];
    for (var i = 1; i < pts.length - 1; i++) {
      var p = pts[i], a = pts[i - 1], b = pts[i + 1];
      var la = Math.hypot(p[0] - a[0], p[1] - a[1]), lb = Math.hypot(b[0] - p[0], b[1] - p[1]);
      var r = Math.min(0.8, la / 2, lb / 2);
      var p0 = [p[0] + (a[0] - p[0]) / la * r, p[1] + (a[1] - p[1]) / la * r], p1 = [p[0] + (b[0] - p[0]) / lb * r, p[1] + (b[1] - p[1]) / lb * r];
      for (var k = 0; k <= 8; k++) { var t = k / 8, u = 1 - t; out.push([u * u * p0[0] + 2 * u * t * p[0] + t * t * p1[0], u * u * p0[1] + 2 * u * t * p[1] + t * t * p1[1]]); }
    }
    out.push(pts[pts.length - 1]);
    return out.filter(function (q, i) { return !i || Math.hypot(q[0] - out[i - 1][0], q[1] - out[i - 1][1]) > 1e-6; });
  }
  function build(def) {
    var nodes = {}, edges = [];
    Object.keys(def.nodes).forEach(function (id) { var n = def.nodes[id]; nodes[id] = { id: id, x: n[0], y: n[1], inn: [], out: [] }; });
    def.edges.forEach(function (e, i) { nodes[e[0]].out.push(i); nodes[e[1]].inn.push(i); });
    def.edges.forEach(function (e, i) {
      var A = nodes[e[0]], B = nodes[e[1]], dy = B.y - A.y, divA = A.out.length > 1, mrgB = B.inn.length > 1, pts;
      if (e.length > 2) { var ly = e[2]; pts = [[A.x, A.y], [A.x + Math.abs(ly - A.y) * TAN, ly], [B.x - Math.abs(ly - B.y) * TAN, ly], [B.x, B.y]]; }
      else if (Math.abs(dy) < 1e-6 || (divA && mrgB)) pts = [[A.x, A.y], [B.x, B.y]];
      else if (mrgB) pts = [[A.x, A.y], [B.x - Math.abs(dy) * TAN, A.y], [B.x, B.y]];
      else pts = [[A.x, A.y], [A.x + Math.abs(dy) * TAN, B.y], [B.x, B.y]];
      pts = round(pts.filter(function (q, k) { return !k || Math.hypot(q[0] - pts[k - 1][0], q[1] - pts[k - 1][1]) > 1e-6; }));
      var cum = [0]; for (var k = 1; k < pts.length; k++) cum.push(cum[k - 1] + Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]));
      edges.push({ id: i, from: e[0], to: e[1], pts: pts, cum: cum, len: cum[cum.length - 1], loop: e.length > 2 });
    });
    var sw = [], sig = [], entries = [], exits = [];
    Object.keys(nodes).forEach(function (id) {
      var n = nodes[id];
      if (n.out.length === 2) sw.push(id);
      if (n.inn.length === 2) n.inn.forEach(function (ei) { sig.push(ei); });
      if (!n.inn.length) entries.push(id);
      if (!n.out.length) exits.push(id);
    });
    var map = { def: def, nodes: nodes, edges: edges, switches: sw, signals: sig, entries: entries, exits: exits, sigOn: {} };
    sig.forEach(function (ei) { map.sigOn[ei] = true; });
    // controls in reading order (x, then y) for keyboard cycling
    map.controls = sw.map(function (id) { return { k: 'w', id: id, x: nodes[id].x, y: nodes[id].y }; })
      .concat(sig.map(function (ei) { var p = pos(map, ei, sigS(map, ei)); return { k: 's', id: ei, x: p.x, y: p.y }; }))
      .sort(function (a, b) { return a.x - b.x || a.y - b.y; });
    map.dist = {}; // shortest path length entry -> exit
    entries.forEach(function (en) { exits.forEach(function (ex) { var d = sp(map, en, ex); if (d < Infinity) map.dist[en + '>' + ex] = d; }); });
    return map;
  }
  function sp(map, a, b) {
    var best = {}, st = [[a, 0]];
    while (st.length) { var c = st.pop(); if (best[c[0]] !== undefined && best[c[0]] <= c[1]) continue; best[c[0]] = c[1]; map.nodes[c[0]].out.forEach(function (ei) { st.push([map.edges[ei].to, c[1] + map.edges[ei].len]); }); }
    return best[b] === undefined ? Infinity : best[b];
  }
  function sigS(map, ei) { return map.edges[ei].len - SIG; }
  function pos(map, ei, s) {
    var e = map.edges[ei], p = e.pts, c = e.cum, n = p.length;
    if (s <= 0) { var dx = p[1][0] - p[0][0], dy = p[1][1] - p[0][1], l = Math.hypot(dx, dy); return { x: p[0][0] + dx / l * s, y: p[0][1] + dy / l * s, a: Math.atan2(dy, dx) }; }
    if (s >= e.len) { var dx2 = p[n - 1][0] - p[n - 2][0], dy2 = p[n - 1][1] - p[n - 2][1], l2 = Math.hypot(dx2, dy2), o = s - e.len; return { x: p[n - 1][0] + dx2 / l2 * o, y: p[n - 1][1] + dy2 / l2 * o, a: Math.atan2(dy2, dx2) }; }
    var lo = 0, hi = n - 1; while (hi - lo > 1) { var m = (lo + hi) >> 1; if (c[m] <= s) lo = m; else hi = m; }
    var t = (s - c[lo]) / (c[hi] - c[lo] || 1);
    return { x: p[lo][0] + (p[hi][0] - p[lo][0]) * t, y: p[lo][1] + (p[hi][1] - p[lo][1]) * t, a: Math.atan2(p[hi][1] - p[lo][1], p[hi][0] - p[lo][0]) };
  }
  // point at distance d behind the head of train tr
  function trainPoint(map, tr, d) {
    var k = tr.edges.length - 1, s = tr.s - d;
    while (s < 0 && k > 0) { k--; s += map.edges[tr.edges[k]].len; }
    return pos(map, tr.edges[k], s);
  }

  // ---------- schedule ----------
  function reach(map, entry, type) {
    return map.exits.filter(function (ex) { return map.dist[entry + '>' + ex] !== undefined && WR_DATA.stations[map.def.exits[ex]].ty.indexOf(type) >= 0; });
  }
  function schedule(map, seed, n, gap, mix, t0) {
    var R = rng(seed), out = [], last = {}, types = Object.keys(mix), tot = 0;
    types.forEach(function (k) { tot += mix[k]; });
    var t = t0 === undefined ? 1.5 : t0;
    for (var i = 0; i < n; i++) {
      var opts = [];
      map.entries.forEach(function (en) { types.forEach(function (ty) { var ex = reach(map, en, ty); if (ex.length) opts.push([en, ty, ex, mix[ty] / tot]); }); });
      var r = R() * opts.reduce(function (a, o) { return a + o[3]; }, 0), o = opts[0];
      for (var j = 0; j < opts.length; j++) { r -= opts[j][3]; if (r <= 0) { o = opts[j]; break; } }
      var dest = o[2][Math.floor(R() * o[2].length)], tt = Math.max(t, (last[o[0]] || -99));
      out.push([Math.round(tt * 10) / 10, o[0], o[1], dest]);
      last[o[0]] = tt + SPEC[o[1]].L / SPEC[o[1]].v + 1.2;
      t += gap * (0.7 + R() * 0.6);
    }
    return out.sort(function (a, b) { return a[0] - b[0]; });
  }

  // ---------- state ----------
  function newGame(map, opts) {
    opts = opts || {};
    // t366u: pace k < 1 = slow motion (trains slower AND timetable stretched by 1/k) -> more reaction time everywhere
    var def = map.def, k = opts.pace || (opts.endless ? 0.8 : def.pace) || 1, H = opts.endless ? 5 : (def.hearts || 3);
    var st = { map: map, t: 0, trains: [], sw: {}, sig: {}, queue: [], hearts: H, maxH: H, k: k, wrongN: 0, score: 0, pend: {}, nextId: 1,
      ok: 0, late: 0, wrong: 0, crash: 0, lost: 0, total: 0, events: [], over: null, lostAcc: 0, endless: !!opts.endless, wreck: [] };
    map.switches.forEach(function (id) { st.sw[id] = (def.sw0 && def.sw0[id]) || 0; });
    map.signals.forEach(function (ei) { st.sig[ei] = 1; });
    if (opts.endless) { st.gen = { seed: opts.seed >>> 0, i: 0, next: 1.5 }; st.total = Infinity; }
    else {
      st.queue = (def.trains ? def.trains.map(function (q) { return q.slice(); }) : schedule(map, def.gen.seed * 7919 + 13, def.gen.n, def.gen.gap, def.gen.mix, def.gen.first))
        .map(function (q) { q[0] = Math.round(q[0] / k * 10) / 10; return q; });
      st.total = st.queue.length;
    }
    return st;
  }
  function endlessNext(st) {
    var g = st.gen, gap = Math.max(2.3, 5.0 - g.i * 0.045) / (st.k || 1); // t366u: gentler ramp
    var q = schedule(st.map, g.seed + g.i * 977, 1, gap, { kcic: 3, krl: 3, barang: 2 }, g.next)[0];
    g.i++; g.next = q[0] + gap * (0.75 + rng(g.seed + g.i)() * 0.5);
    st.queue.push(q);
  }
  function nextEdge(st, ei) { var n = st.map.nodes[st.map.edges[ei].to]; if (!n.out.length) return null; return n.out.length === 2 ? n.out[st.sw[n.id]] : n.out[0]; }
  function occ(map, tr) { // [[edge, lo, hi], ...] from head backwards
    var r = [], rem = SPEC[tr.type].L, k = tr.edges.length - 1, hi = tr.s;
    while (true) {
      var lo = hi - rem;
      if (lo < 0 && k > 0) { r.push([tr.edges[k], 0, hi]); rem = -lo; k--; hi = map.edges[tr.edges[k]].len; continue; }
      r.push([tr.edges[k], lo, hi]); break;
    }
    return r;
  }
  function live(tr) { return tr.st === 'run' || tr.st === 'leave'; }
  function locked(st, nodeId) { // interlocking: a switch cannot move while a train is over it
    var map = st.map, n = map.nodes[nodeId];
    return st.trains.some(function (tr) {
      if (!live(tr)) return false;
      return occ(map, tr).some(function (o) {
        if (n.inn.indexOf(o[0]) >= 0 && o[2] > map.edges[o[0]].len - 0.15) return true;
        return n.out.indexOf(o[0]) >= 0 && o[1] < ZL;
      });
    });
  }
  function toggle(st, c) {
    if (st.over) return false;
    if (c.k === 'w') {
      if (locked(st, c.id)) { // queue the flip until the train has passed
        if (st.pend[c.id] !== undefined) delete st.pend[c.id]; else st.pend[c.id] = 1 - st.sw[c.id];
        st.events.push({ e: 'locked', id: c.id, pend: st.pend[c.id] !== undefined }); return false;
      }
      delete st.pend[c.id]; st.sw[c.id] = 1 - st.sw[c.id]; st.events.push({ e: 'switch', id: c.id }); return true;
    }
    st.sig[c.id] = st.sig[c.id] ? 0 : 1; st.events.push({ e: 'signal', id: c.id, on: st.sig[c.id] }); return true;
  }
  function pending(st) {
    for (var id in st.pend) if (!locked(st, id)) { if (st.sw[id] !== st.pend[id]) { st.sw[id] = st.pend[id]; st.events.push({ e: 'switch', id: id, auto: 1 }); } delete st.pend[id]; }
  }
  function spawn(st) {
    if (st.gen) while (st.gen.next <= st.t + 6) endlessNext(st);
    var used = {};
    for (var i = 0; i < st.queue.length; i++) {
      var q = st.queue[i];
      if (q[0] > st.t) break;
      if (used[q[1]]) continue;
      used[q[1]] = 1;
      var e0 = st.map.nodes[q[1]].out[0], blocked = st.trains.some(function (tr) {
        return live(tr) && occ(st.map, tr).some(function (o) { return o[0] === e0 && o[1] < GAP + 0.15; });
      });
      if (blocked) continue;
      var sp = SPEC[q[2]];
      st.trains.push({ id: st.nextId++, type: q[2], dest: q[3], entry: q[1], edges: [e0], s: 0, v: sp.v * st.k, t0: q[0], ideal: st.map.dist[q[1] + '>' + q[3]] / (sp.v * st.k), lost: 0, st: 'run', warn: 0 });
      st.events.push({ e: 'spawn', id: st.nextId - 1, type: q[2] });
      st.queue.splice(i, 1); i--;
    }
  }
  function leaderLimit(st, tr) {
    var map = st.map, e = tr.edges[tr.edges.length - 1], lim = Infinity;
    if (tr.st === 'run' && map.sigOn[e] && !st.sig[e] && tr.s <= sigS(map, e) + 1e-6) lim = sigS(map, e) - tr.s;
    var nx = tr.st === 'run' ? nextEdge(st, e) : null, el = map.edges[e].len;
    for (var i = 0; i < st.trains.length; i++) {
      var o = st.trains[i]; if (o === tr || !live(o)) continue;
      var oc = occ(map, o);
      for (var j = 0; j < oc.length; j++) {
        var q = oc[j];
        if (q[0] === e && q[1] > tr.s - 0.05) lim = Math.min(lim, q[1] - tr.s - GAP);
        else if (nx !== null && q[0] === nx && el - tr.s < 4) {
          var k = o.edges.indexOf(nx); if (k > 0 && o.edges[k - 1] === e) lim = Math.min(lim, el - tr.s + q[1] - GAP);
        }
      }
    }
    return lim;
  }
  function arrive(st, tr, exitId) {
    var sp = SPEC[tr.type], ok = exitId === tr.dest, delay = st.t - tr.t0 - tr.ideal, on = ok && delay <= sp.tol * 2 / st.k + 0.05, pts = 0; // t366u: 2x (and pace-scaled) on-time window
    if (ok && on) { st.ok++; pts = sp.pts; } else if (ok) { st.late++; pts = Math.round(sp.pts * 0.6); } else { st.wrong++; if (st.gen && ++st.wrongN % 2 === 0) st.hearts--; } // endless/daily: every 2nd wrong destination costs a heart
    st.score += pts; tr.st = 'leave'; tr.res = ok ? (on ? 'ok' : 'late') : 'wrong';
    st.events.push({ e: 'arrive', id: tr.id, type: tr.type, res: tr.res, pts: pts, exit: exitId, delay: delay });
  }
  function step(st, dt) {
    if (st.over) return;
    var map = st.map; st.t += dt; spawn(st); pending(st);
    var lims = st.trains.map(function (tr) { return live(tr) ? leaderLimit(st, tr) : 0; });
    for (var i = 0; i < st.trains.length; i++) {
      var tr = st.trains[i]; if (!live(tr)) continue;
      var sp = SPEC[tr.type];
      var vmax = sp.v * st.k; tr.v = Math.min(vmax, tr.v + ACC * st.k * dt);
      var ds = tr.v * dt;
      if (ds > lims[i]) { ds = Math.max(0, lims[i]); tr.v = Math.min(tr.v, ds / dt); }
      var lost = dt * (1 - ds / dt / vmax); tr.lost += lost; st.lostAcc += lost * sp.w;
      tr.s += ds;
      var e = tr.edges[tr.edges.length - 1];
      while (tr.st === 'run' && tr.s > map.edges[e].len) {
        var nx = nextEdge(st, e);
        if (nx === null) { arrive(st, tr, map.edges[e].to); break; }
        tr.s -= map.edges[e].len; tr.edges.push(nx); e = nx;
      }
      if (tr.st === 'leave' && tr.s - sp.L > map.edges[e].len + 0.2) tr.st = 'gone';
      // trim history
      var need = sp.L + 0.5, acc = tr.s, k = tr.edges.length - 1;
      while (k > 0 && acc < need) { k--; acc += map.edges[tr.edges[k]].len; }
      if (k > 1) { tr.edges.splice(0, k - 1); }
    }
    collide(st);
    st.trains = st.trains.filter(function (tr) { return tr.st !== 'gone' && !(tr.st === 'crash' && st.t - tr.ct > 1.6); });
    if (st.hearts <= 0) { st.over = 'fail'; st.events.push({ e: 'over', res: 'fail' }); }
    else if (!st.gen && !st.queue.length && !st.trains.some(function (tr) { return tr.st === 'run' || tr.st === 'leave'; })) { st.over = 'win'; st.events.push({ e: 'over', res: 'win' }); }
  }
  function collide(st) {
    var map = st.map, L = st.trains.filter(live), oc = L.map(function (tr) { return occ(map, tr); });
    var hit = null;
    for (var a = 0; a < L.length && !hit; a++) for (var b = a + 1; b < L.length && !hit; b++) {
      for (var i = 0; i < oc[a].length && !hit; i++) for (var j = 0; j < oc[b].length && !hit; j++) {
        var p = oc[a][i], q = oc[b][j];
        if (p[0] === q[0] && p[1] < q[2] - 0.02 && q[1] < p[2] - 0.02) hit = [a, b, p[0], Math.max(p[1], q[1])];
      }
      if (!hit) { var z = zoneHit(map, L[a], oc[a], L[b], oc[b]); if (z) hit = [a, b, z[0], z[1]]; }
    }
    if (!hit) return;
    var A = L[hit[0]], B = L[hit[1]], p = pos(map, hit[2], Math.min(Math.max(hit[3], 0), map.edges[hit[2]].len));
    [A, B].forEach(function (tr) { tr.st = 'crash'; tr.ct = st.t; });
    st.crash++; st.hearts--; st.score = Math.max(0, st.score - 50);
    st.events.push({ e: 'crash', ids: [A.id, B.id], x: p.x, y: p.y });
    if (!st.pred) collide(st);
  }
  function zoneLabels(map, tr, oc) { // merge-node fouling zones: node -> inbound edge used
    var r = {};
    oc.forEach(function (o) {
      var e = map.edges[o[0]], to = map.nodes[e.to], fr = map.nodes[e.from];
      if (to.inn.length === 2 && o[2] > e.len - Z) r[to.id] = o[0];
      if (fr.inn.length === 2 && o[1] < Z) { var k = tr.edges.indexOf(o[0]); r[fr.id] = k > 0 ? tr.edges[k - 1] : -1; }
    });
    return r;
  }
  function zoneHit(map, A, oa, B, ob) {
    var za = zoneLabels(map, A, oa), zb = zoneLabels(map, B, ob);
    for (var n in za) if (n in zb && za[n] !== zb[n]) { var ei = map.nodes[n].out[0]; return [ei, 0]; }
    return null;
  }
  function routeExit(st, tr) {
    var e = tr.edges[tr.edges.length - 1];
    for (var i = 0; i < 40; i++) { var nx = nextEdge(st, e); if (nx === null) return st.map.edges[e].to; e = nx; }
    return null;
  }
  function clone(st) {
    var c = {}; for (var k in st) c[k] = st[k];
    c.trains = st.trains.map(function (tr) { var t = {}; for (var k2 in tr) t[k2] = tr[k2]; t.edges = tr.edges.slice(); return t; });
    c.sw = Object.assign({}, st.sw); c.pend = Object.assign({}, st.pend); c.sig = Object.assign({}, st.sig); c.queue = st.queue.slice(); c.events = [];
    if (st.gen) c.gen = Object.assign({}, st.gen);
    c.pred = true; return c;
  }
  // look ahead with current controls: first crash (point + trains) within T seconds
  function predict(st, T) {
    var c = clone(st), dt = 0.05;
    for (var t = 0; t < (T || 3); t += dt) {
      step(c, dt);
      for (var i = 0; i < c.events.length; i++) if (c.events[i].e === 'crash') { var ev = c.events[i]; return { t: t, x: ev.x, y: ev.y, ids: ev.ids }; }
      c.events.length = 0; if (c.over) break;
    }
    return null;
  }
  // ---------- bot ----------
  // distance from each running train to switch nodes along its current route (first 4 edges)
  function approach(st) {
    var map = st.map, r = {};
    st.trains.forEach(function (tr) {
      if (tr.st !== 'run') return;
      var e = tr.edges[tr.edges.length - 1], d = map.edges[e].len - tr.s;
      for (var i = 0; i < 4; i++) {
        var to = map.edges[e].to;
        if (map.nodes[to].out.length === 2 && (!r[to] || r[to].d > d)) r[to] = { d: d, tr: tr };
        e = nextEdge(st, e); if (e === null) break; d += map.edges[e].len;
      }
    });
    return r;
  }
  var NEAR = 2.6;
  function autoSwitch(st) { // future decisions in a rollout: far switches point the next train towards its destination
    var map = st.map, ap = approach(st);
    for (var id in ap) {
      if (ap[id].d < NEAR) continue;
      var tr = ap[id].tr, n = map.nodes[id], best = -1, bd = Infinity;
      n.out.forEach(function (ei, k) { var d = sp(map, map.edges[ei].to, tr.dest); if (d < bd) { bd = d; best = k; } });
      if (best >= 0 && st.sw[id] !== best) { if (locked(st, id)) st.pend[id] = best; else st.sw[id] = best; }
    }
  }
  function relevant(st) {
    var ap = approach(st);
    return st.map.controls.filter(function (c) { return c.k === 's' || (ap[c.id] && ap[c.id].d < NEAR + 0.4); });
  }
  function rollout(st, acts, T) {
    var c = clone(st), dt = 0.08, cost = 0, base = st.lostAcc;
    acts.forEach(function (a) { toggle(c, a); cost += 0.4; });
    for (var t = 0; t < T; t += dt) {
      autoSwitch(c); step(c, dt);
      var w = 1 - 0.5 * t / T;
      for (var i = 0; i < c.events.length; i++) {
        var ev = c.events[i];
        if (ev.e === 'crash') cost += 1000 * w;
        else if (ev.e === 'arrive') cost += ev.res === 'wrong' ? 500 * w : ev.res === 'late' ? -20 : -60;
      }
      for (var qi = 0; qi < c.queue.length && c.queue[qi][0] < c.t; qi++) cost += dt * SPEC[c.queue[qi][2]].w * 12;
      c.events.length = 0; if (c.over) break;
    }
    c.trains.forEach(function (tr) { // commitment: where would each train end up with these settings?
      if (tr.st !== 'run') return;
      var e = tr.edges[tr.edges.length - 1], sws = 0, ex = null;
      for (var i = 0; i < 40; i++) { var n = c.map.nodes[c.map.edges[e].to]; if (!n.out.length) { ex = n.id; break; } if (n.out.length === 2) sws++; e = nextEdge(c, e); }
      var good = ex === tr.dest;
      cost += sws ? (good ? -10 : 60 / sws) : (good ? -20 : 400);
    });
    return cost + (c.lostAcc - base) * 12;
  }
  function bot(st, T) {
    var rel = relevant(st), cands = [[]];
    rel.forEach(function (c, i) { cands.push([c]); for (var j = i + 1; j < rel.length; j++) if (rel[j].k !== c.k || c.k === 'w') cands.push([c, rel[j]]); });
    var best = null, bc = Infinity;
    cands.forEach(function (a) { var v = rollout(st, a, T || 8); if (v < bc - 1e-6) { bc = v; best = a; } });
    return best || [];
  }
  function stars(st) {
    if (st.over === 'fail') return 0;
    var n = st.total, good = st.ok + st.late;
    // t366u: easier thresholds; late arrivals count as good
    if (!st.crash && st.wrong <= 1 && good >= Math.ceil(n * 0.85) && st.ok >= Math.ceil(n * 0.5)) return 3;
    if (st.crash <= 2 && good >= Math.ceil(n * 0.55)) return 2;
    return 1;
  }
  return { _rollout: rollout, _auto: autoSwitch, SPEC: SPEC, Z: Z, SIG: SIG, build: build, pos: pos, trainPoint: trainPoint, newGame: newGame, step: step, toggle: toggle, locked: locked,
    nextEdge: nextEdge, routeExit: routeExit, predict: predict, bot: bot, stars: stars, clone: clone, schedule: schedule, sigS: sigS, rng: rng, hash: hash, occ: occ, reach: reach };
})();
if (typeof module !== 'undefined') module.exports = WR;

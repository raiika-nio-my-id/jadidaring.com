// Pawang Hujan - pure rules (no DOM). Field in tile units: W x H tiles, clouds float above.
// Tiles: f = hutan, p = gambut (bara tersembunyi, bisa menyala lagi), r = sungai, v = kampung (tidak terbakar).
(function (G) {
  'use strict';
  function rng(seed) { var a = 0; for (var i = 0; i < String(seed).length; i++) a = (Math.imul(a ^ String(seed).charCodeAt(i), 2654435761) + 1) | 0; return function () { a = (a + 0x6D2B79F5) | 0; var t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  var clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };
  var D = {
    W: 6, H: 8, maxClouds: 5, cloudR: 1.35, cloudRMax: 2.1,
    grow: 0.16, burnRate: 0.022, douse: 0.62, wetRate: 0.55, dry: 0.05, dryMult: 2.6,
    spread: 0.075, igniteWet: 0.22, drain: 0.042, hazeRate: 0.0105, hazeClear: 0.03, hazeRainClear: 0.006,
    spawnEvery: 6.5, igniteEvery: 7.5, igniteMin: 2.4, levelEvery: 30,
    streakNeed: 12, streakGrace: 1.4, maxMult: 5, thunderEvery: 3, maxThunder: 3, stormT: 6,
    ritualRise: 1.35, ritualOk: 0.4, ritualPerfect: [0.8, 1.0], ritualCool: 3.5, ritualSpillCool: 2,
    drySpellFrom: 3, drySpellLen: 9, drySpellWarn: 3, drySpellGap: 45
  };
  // Deterministic map: river winding down, kampung pockets, peat lowlands, forest elsewhere.
  function makeMap(r, P) {
    var t = [], W = P.W, H = P.H, rx = 1 + Math.floor(r() * (W - 2));
    for (var y = 0; y < H; y++) {
      if (y > 0 && r() < 0.45) rx = clamp(rx + (r() < 0.5 ? -1 : 1), 0, W - 1);
      for (var x = 0; x < W; x++) {
        var k = x === rx ? 'r' : (r() < 0.42 + (y > H / 2 ? 0.12 : 0) ? 'p' : 'f');
        t.push({ x: x, y: y, k: k, fire: 0, wet: 0.1, burnt: 0, ember: 0, calm: 0 });
      }
    }
    // two kampung spots next to the river
    var placed = 0, tries = 0;
    while (placed < 2 && tries++ < 80) {
      var i = Math.floor(r() * t.length), c = t[i];
      if (c.k === 'r' || c.k === 'v') continue;
      var nearRiver = neigh(t, c, P).some(function (n) { return n.k === 'r'; });
      if (nearRiver && (placed === 0 ? c.y < H / 2 : c.y >= H / 2)) { c.k = 'v'; placed++; }
    }
    return t;
  }
  function tile(t, x, y, P) { return x < 0 || y < 0 || x >= P.W || y >= P.H ? null : t[y * P.W + x]; }
  function neigh(t, c, P) { return [[1, 0], [-1, 0], [0, 1], [0, -1]].map(function (d) { return tile(t, c.x + d[0], c.y + d[1], P); }).filter(Boolean); }
  function burnable(c) { return c.k === 'f' || c.k === 'p'; }
  function create(o) {
    o = o || {}; var P = {}, k; for (k in D) P[k] = D[k]; if (o.params) for (k in o.params) P[k] = o.params[k];
    var r = rng(o.seed == null ? 'pawang' : o.seed);
    var s = { P: P, r: r, t: makeMap(r, P), clouds: [], nid: 1, time: 0, level: 1, score: 0, haze: 0.06, mult: 1, streak: 0, gap: 0, rainbows: 0,
      out: 0, thunder: 0, thunderProg: 0, ritual: { charge: 0, holding: false, cool: 0 }, wind: { x: 0.18, y: 0.04, t: 14 },
      spawnT: 2, igniteT: P.igniteEvery, dry: { on: false, t: P.drySpellGap, warn: false }, over: false, ev: [], tut: !!o.tutorial, rainingNow: false, storms: 0, merges: 0 };
    if (s.tut) { s.wind = { x: 0, y: 0, t: 1e9 }; s.haze = 0.05; }
    if (!o.empty) {
      var n = s.tut ? 1 : 2; for (var i = 0; i < n; i++) ignite(s, s.tut ? pick(s, 4, 6) : null);
      if (s.tut) { pick(s, 4, 6).fire = 0.9; addCloud(s, 1.3, 3.2, 1, P.cloudR); }
      else { addCloud(s, 1.5, 1.6, 1, P.cloudR); addCloud(s, 4.5, 2.2, 1, P.cloudR); }
    }
    return s;
  }
  function pick(s, x, y) { var b = null, bd = 1e9; s.t.forEach(function (c) { var d = Math.hypot(c.x - x, c.y - y); if (burnable(c) && d < bd) { bd = d; b = c; } }); return b; }
  function ignite(s, c) {
    if (!c) {
      var cand = s.t.filter(function (q) { return burnable(q) && q.fire <= 0 && q.burnt < 0.85 && q.wet < s.P.igniteWet; });
      if (!cand.length) return null; c = cand[Math.floor(s.r() * cand.length)];
    }
    c.fire = Math.max(c.fire, 0.35); c.calm = 0; s.ev.push({ e: 'ignite', x: c.x, y: c.y }); return c;
  }
  function addCloud(s, x, y, w, r) {
    var c = { id: s.nid++, x: x, y: y, r: r || s.P.cloudR, w: w == null ? 1 : w, storm: 0, held: false, dry: 0, born: s.time, vx: 0, vy: 0 };
    s.clouds.push(c); return c;
  }
  function spawnUpwind(s, w, r) {
    var P = s.P, wx = s.wind.x, wy = s.wind.y, x, y;
    if (Math.abs(wx) >= Math.abs(wy)) { x = wx >= 0 ? -0.6 : P.W + 0.6; y = 0.8 + s.r() * (P.H - 1.6); }
    else { y = wy >= 0 ? -0.6 : P.H + 0.6; x = 0.8 + s.r() * (P.W - 1.6); }
    var c = addCloud(s, x, y, w, r); s.ev.push({ e: 'spawn', id: c.id }); return c;
  }
  function cover(c, tl) { var dx = tl.x + 0.5 - c.x, dy = tl.y + 0.5 - c.y, d = Math.sqrt(dx * dx + dy * dy), R = c.r * (c.storm > 0 ? 1.3 : 1); return d >= R ? 0 : 1 - (d / R) * 0.6; }
  function cloudAt(s, x, y, pad) {
    var best = null, bd = 1e9; s.clouds.forEach(function (c) { var d = Math.hypot(c.x - x, c.y - y); if (d < c.r * 0.95 + (pad || 0) && d < bd) { bd = d; best = c; } }); return best;
  }
  function byId(s, id) { for (var i = 0; i < s.clouds.length; i++) if (s.clouds[i].id === id) return s.clouds[i]; return null; }
  function grab(s, id) { var c = byId(s, id); if (c) c.held = true; return c; }
  function drag(s, id, x, y) { var c = byId(s, id); if (!c) return; c.x = clamp(x, -0.2, s.P.W + 0.2); c.y = clamp(y, -0.2, s.P.H + 0.2); }
  function drop(s, id) {
    var c = byId(s, id); if (!c) return null; c.held = false;
    for (var i = 0; i < s.clouds.length; i++) {
      var o = s.clouds[i]; if (o === c) continue;
      if (Math.hypot(o.x - c.x, o.y - c.y) < (o.r + c.r) * 0.55) {
        o.w = Math.min(1.6, o.w + c.w); o.r = Math.min(s.P.cloudRMax, Math.sqrt(o.r * o.r + c.r * c.r * 0.6)); o.storm = Math.max(o.storm, c.storm);
        o.x = (o.x + c.x) / 2; o.y = (o.y + c.y) / 2; o.dry = 0;
        s.clouds.splice(s.clouds.indexOf(c), 1); s.merges++; addScore(s, 20); s.ev.push({ e: 'merge', id: o.id, x: o.x, y: o.y }); return o;
      }
    }
    return c;
  }
  function addScore(s, n) { s.score += Math.round(n * s.mult); }
  function thunder(s, id) {
    var c = byId(s, id); if (!c || s.thunder < 1) return false;
    s.thunder--; c.storm = s.P.stormT; c.w = Math.min(1.6, c.w + 0.5); c.dry = 0; s.storms++;
    s.ev.push({ e: 'thunder', id: c.id, x: c.x, y: c.y }); addScore(s, 30); return true;
  }
  function ritualHold(s) { if (s.ritual.cool > 0 || s.over) return false; s.ritual.holding = true; s.ritual.charge = 0; return true; }
  // Release the mangkuk: golden zone = refill all + big cloud over the worst fire; ok = small refill; too early/late = nothing.
  function ritualRelease(s) {
    var R = s.ritual, P = s.P; if (!R.holding) return null; R.holding = false; var c = R.charge, res;
    if (c > P.ritualPerfect[1]) { res = 'spill'; R.cool = P.ritualSpillCool; }
    else if (c >= P.ritualPerfect[0]) {
      res = 'perfect'; R.cool = P.ritualCool;
      s.clouds.forEach(function (q) { q.w = Math.max(q.w, 1); q.dry = 0; });
      var hot = hottest(s), nc = addCloud(s, hot ? hot.x + 0.5 : P.W / 2, hot ? hot.y + 0.5 : P.H / 2, 1.2, P.cloudR * 1.15);
      if (s.clouds.length > P.maxClouds + 1) s.clouds.splice(0, 1);
      s.ev.push({ e: 'summon', id: nc.id, x: nc.x, y: nc.y }); addScore(s, 60);
    } else if (c >= P.ritualOk) {
      res = 'ok'; R.cool = P.ritualCool; s.clouds.forEach(function (q) { q.w = Math.min(1.2, q.w + c * 0.55); q.dry = 0; });
      if (s.clouds.length < 2) spawnUpwind(s, 0.8);
      addScore(s, 15);
    } else { res = 'fizzle'; R.cool = 0.6; }
    R.charge = 0; s.ev.push({ e: 'ritual', res: res, c: c }); return res;
  }
  function hottest(s) { var b = null; s.t.forEach(function (c) { if (c.fire > 0 && (!b || c.fire > b.fire)) b = c; }); return b; }
  function fires(s) { return s.t.filter(function (c) { return c.fire > 0; }); }
  function step(s, dt) {
    if (s.over) return s; var P = s.P; dt = Math.min(dt, 0.1); s.time += dt;
    var lv = s.tut ? 1 : 1 + Math.floor(s.time / P.levelEvery);
    if (lv !== s.level) { s.level = lv; s.ev.push({ e: 'level', level: lv }); }
    var R = s.ritual; if (R.cool > 0) R.cool = Math.max(0, R.cool - dt);
    if (R.holding) R.charge += dt / P.ritualRise;
    if (R.holding && R.charge > 1.25) { R.holding = false; R.charge = 0; R.cool = P.ritualSpillCool; s.ev.push({ e: 'ritual', res: 'spill', c: 1.25 }); }
    // wind + dry spell schedule
    if (!s.tut) {
      s.wind.t -= dt;
      if (s.wind.t <= 0) {
        var a = s.r() * Math.PI * 2, m = 0.12 + Math.min(0.5, (s.level - 1) * 0.07) + s.r() * 0.08;
        s.wind = { x: Math.cos(a) * m, y: Math.sin(a) * m * 0.7, t: 14 + s.r() * 8 }; s.ev.push({ e: 'wind', x: s.wind.x, y: s.wind.y });
      }
      var Dd = s.dry; Dd.t -= dt;
      if (!Dd.on && s.level >= P.drySpellFrom && !Dd.warn && Dd.t <= P.drySpellWarn) { Dd.warn = true; s.ev.push({ e: 'drywarn' }); }
      if (!Dd.on && Dd.t <= 0) { if (s.level >= P.drySpellFrom) { Dd.on = true; Dd.t = P.drySpellLen; Dd.warn = false; s.ev.push({ e: 'dry' }); } else Dd.t = P.drySpellGap; }
      else if (Dd.on && Dd.t <= 0) { Dd.on = false; Dd.t = P.drySpellGap - s.level * 2; s.ev.push({ e: 'dryend' }); }
    }
    var dryM = s.dry.on ? P.dryMult : 1;
    // clouds: drift, rain, drain
    var raining = false;
    for (var i = s.clouds.length - 1; i >= 0; i--) {
      var c = s.clouds[i];
      if (c.storm > 0) c.storm = Math.max(0, c.storm - dt);
      if (!c.held) { c.x += s.wind.x * dt * (c.w > 0 ? 1 : 1.6); c.y += s.wind.y * dt * (c.w > 0 ? 1 : 1.6); }
      if (c.w > 0) { c.w = Math.max(0, c.w - P.drain * (1 + (s.level - 1) * 0.06) * dt * (c.storm > 0 ? 1.8 : 1) * (s.dry.on ? 1.4 : 1)); if (c.w === 0) s.ev.push({ e: 'empty', id: c.id }); }
      else c.dry += dt;
      var gone = c.x < -c.r - 0.3 || c.x > P.W + c.r + 0.3 || c.y < -c.r - 0.3 || c.y > P.H + c.r + 0.3;
      if (!c.held && (gone || c.dry > 7)) { s.clouds.splice(i, 1); s.ev.push({ e: gone ? 'lost' : 'fade', id: c.id }); continue; }
      if (c.w > 0 && c.x > -0.3 && c.x < P.W + 0.3 && c.y > -0.3 && c.y < P.H + 0.3) raining = true;
    }
    // tiles
    var sumFire = 0, wetSum = 0;
    s.t.forEach(function (tl) {
      var rain = 0, storm = 1;
      s.clouds.forEach(function (c) { if (c.w <= 0) return; var f = cover(c, tl); if (f > 0) { rain += f; if (c.storm > 0) storm = 2.2; } });
      if (rain > 0) tl.wet = Math.min(1, tl.wet + P.wetRate * rain * dt);
      else tl.wet = Math.max(0, tl.wet - P.dry * dryM * dt);
      wetSum += tl.wet;
      if (!burnable(tl)) return;
      if (tl.fire > 0) {
        tl.fire = Math.min(1, tl.fire + P.grow * (1 + (s.level - 1) * 0.08) * dt * Math.max(0, 1 - tl.wet * 1.6) * (s.tut ? 0 : 1) - P.douse * rain * storm * dt);
        tl.burnt = Math.min(1, tl.burnt + Math.max(0, tl.fire) * P.burnRate * dt * (s.tut ? 0 : 1));
        if (tl.burnt >= 1) { tl.fire = 0; tl.ember = 0; s.haze = Math.min(1, s.haze + 0.04); s.ev.push({ e: 'scorched', x: tl.x, y: tl.y }); }
        else if (tl.fire <= 0) {
          tl.fire = 0; tl.calm = 0; tl.ember = tl.k === 'p' ? 1 : 0; s.out++; addScore(s, 50);
          if (++s.thunderProg >= P.thunderEvery) { s.thunderProg = 0; if (s.thunder < P.maxThunder) { s.thunder++; s.ev.push({ e: 'charge' }); } }
          s.ev.push({ e: 'out', x: tl.x, y: tl.y, peat: tl.k === 'p' });
        } else sumFire += tl.fire;
      } else {
        tl.calm += dt;
        if (tl.ember > 0) {
          if (tl.wet > 0.5) tl.ember = Math.max(0, tl.ember - 0.16 * dt);
          if (tl.ember === 0) s.ev.push({ e: 'soaked', x: tl.x, y: tl.y });
          else if (tl.wet < 0.04 && !s.tut) { tl.fire = 0.3; tl.ember = 0; s.ev.push({ e: 'reignite', x: tl.x, y: tl.y }); }
        }
        if (tl.burnt > 0 && tl.wet > 0.45 && tl.calm > 3) tl.burnt = Math.max(0, tl.burnt - 0.025 * dt);
      }
    });
    // spread (wind biased)
    if (!s.tut) s.t.forEach(function (tl) {
      if (tl.fire < 0.5) return;
      neigh(s.t, tl, P).forEach(function (n) {
        if (!burnable(n) || n.fire > 0 || n.burnt > 0.85 || n.wet >= P.igniteWet * (s.dry.on ? 1.5 : 1)) return;
        var dx = n.x - tl.x, dy = n.y - tl.y, bias = 1 + 2.2 * (dx * s.wind.x + dy * s.wind.y) / 0.5;
        if (s.r() < P.spread * tl.fire * Math.max(0.25, bias) * (n.k === 'p' ? 1.25 : 1) * dryM * (1 + (s.level - 1) * 0.12) * dt) { n.fire = 0.3; n.calm = 0; s.ev.push({ e: 'spread', x: n.x, y: n.y }); }
      });
    });
    // new hotspots + cloud supply
    if (!s.tut) {
      s.igniteT -= dt * dryM;
      if (s.igniteT <= 0) { for (var q = 0; q < 1 + Math.floor((s.level - 1) / 3); q++) ignite(s); s.igniteT = Math.max(P.igniteMin, P.igniteEvery - (s.level - 1) * 0.9) * (0.8 + s.r() * 0.4); }
      s.spawnT -= dt;
      var live = s.clouds.filter(function (c) { return c.w > 0; }).length;
      if (s.spawnT <= 0 && !s.dry.on && s.clouds.length < P.maxClouds) { spawnUpwind(s, 1); s.spawnT = P.spawnEvery + (s.level - 1) * 0.45; }
      else if (live === 0 && !s.dry.on && s.spawnT > 2.5) s.spawnT = 2.5;
    }
    // continuous rain streak -> pelangi + multiplier
    s.rainingNow = raining;
    if (raining) { s.gap = 0; s.streak += dt; addScore(s, 5 * dt); if (s.streak >= P.streakNeed) { s.streak -= P.streakNeed; s.rainbows++; s.mult = Math.min(P.maxMult, s.mult + 1); s.haze = Math.max(0, s.haze - 0.08); s.ev.push({ e: 'rainbow', mult: s.mult }); addScore(s, 200); } }
    else { s.gap += dt; if (s.gap > P.streakGrace && (s.streak > 0 || s.mult > 1)) { if (s.mult > 1 || s.streak > 3) s.ev.push({ e: 'streakLost' }); s.streak = 0; s.mult = 1; } }
    // haze: smoke from fire, cleared by rain
    var clear = P.hazeClear * (sumFire < 0.01 ? 1 : 0.35) + (raining ? P.hazeRainClear * s.clouds.length : 0);
    if (!s.tut) s.haze = clamp(s.haze + (sumFire * P.hazeRate * (1 + (s.level - 1) * 0.1) - clear) * dt, 0, 1);
    s.fireSum = sumFire; s.wetAvg = wetSum / s.t.length;
    if (s.haze >= 1) { s.over = true; s.ev.push({ e: 'over' }); }
    return s;
  }
  function events(s) { var e = s.ev; s.ev = []; return e; }
  function finalScore(s) { return Math.round(s.score + Math.floor(s.time) * 2); }
  function record(prev, s) {
    prev = prev || {}; var sc = finalScore(s);
    return { best: Math.max(prev.best || 0, sc), bestTime: Math.max(prev.bestTime || 0, Math.floor(s.time)), runs: (prev.runs || 0) + 1, out: (prev.out || 0) + s.out, isBest: sc > (prev.best || 0) };
  }
  G.PH = { D: D, rng: rng, create: create, step: step, events: events, cloudAt: cloudAt, grab: grab, drag: drag, drop: drop, thunder: thunder,
    ritualHold: ritualHold, ritualRelease: ritualRelease, ignite: ignite, addCloud: addCloud, fires: fires, tile: tile, cover: cover, byId: byId, finalScore: finalScore, record: record, burnable: burnable };
})(typeof window !== 'undefined' ? window : globalThis);

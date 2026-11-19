/* Bajaj Drift: pure sim (node-testable). window.BD */
(function (root) {
'use strict';
const TAU = Math.PI * 2;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v, lerp = (a, b, p) => a + (b - a) * p;
const angd = (a, b) => { let d = (a - b) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; };
const C = { VMAX: 25, ACC: 15, OFF_VMAX: 11.5, TURN: 2.5, TURN_D: 2.6, GRIP: 11, GRIP_D: 5.5, DT: 1 / 60, TIERS: [0.5, 1.1, 1.8], BOOST: [[0.8, 6], [1.2, 8.5], [1.7, 11]], KMH: 2.7, LAPS: 3, MAXMS: 300000 };
const TRACKS = {
  monas: { id: 'monas', name: 'Putaran Monas', short: 'Monas', w: 9, curb: 1.1, wall: 6.5, laps: 3, board: true, start: 7,
    pts: [[-30, -52], [20, -52], [46, -52], [56, -49], [59, -40], [59, -4], [53, 10], [62, 26], [59, 44], [56, 54], [46, 57], [6, 57], [-12, 47], [-30, 57], [-48, 57], [-57, 54], [-60, 45], [-60, 4], [-53, -10], [-60, -26], [-60, -42], [-57, -50], [-48, -52]] },
  gang: { id: 'gang', name: 'Gang Senen', short: 'Gang', w: 7.4, curb: 0.6, wall: 1.1, laps: 3, board: false, start: 6,
    pts: [[-49, -46], [-8, -49], [11, -32], [38, -40], [59, -24], [51, 0], [32, 11], [43, 30], [22, 51], [-8, 43], [-24, 59], [-54, 51], [-62, 24], [-43, 5], [-65, -19]] }
};
function cr(p0, p1, p2, p3, t) { const t2 = t * t, t3 = t2 * t; return [0.5 * (2 * p1[0] + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3), 0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3)]; }
const cache = {};
function track(id) {
  if (cache[id]) return cache[id];
  const T = Object.assign({}, TRACKS[id]), P = T.pts, n = P.length, raw = [];
  for (let i = 0; i < n; i++) { const p0 = P[(i - 1 + n) % n], p1 = P[i], p2 = P[(i + 1) % n], p3 = P[(i + 2) % n], m = Math.max(6, Math.ceil(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) * 3)); for (let k = 0; k < m; k++) raw.push(cr(p0, p1, p2, p3, k / m)); }
  const cl = [0]; for (let i = 1; i <= raw.length; i++) { const a = raw[i - 1], b = raw[i % raw.length]; cl.push(cl[i - 1] + Math.hypot(b[0] - a[0], b[1] - a[1])); }
  const L = cl[raw.length], N = Math.round(L), ds = L / N; T.L = L; T.N = N; T.ds = ds;
  const X = new Float64Array(N), Y = new Float64Array(N); let j = 0;
  for (let i = 0; i < N; i++) { const s = i * ds; while (cl[j + 1] < s) j++; const f = (s - cl[j]) / ((cl[j + 1] - cl[j]) || 1), a = raw[j], b = raw[(j + 1) % raw.length]; X[i] = lerp(a[0], b[0], f); Y[i] = lerp(a[1], b[1], f); }
  T.X = X; T.Y = Y; geo(T, X, Y, 'A', 'TX', 'TY', 'NX', 'NY', 'K');
  // racing line: iterative smoothing of a lateral offset, limited to the road
  const lim = T.w / 2 - 1.1, o = new Float64Array(N), RX = new Float64Array(N), RY = new Float64Array(N);
  for (let it = 0; it < 260; it++) {
    for (let i = 0; i < N; i++) { RX[i] = X[i] + T.NX[i] * o[i]; RY[i] = Y[i] + T.NY[i] * o[i]; }
    for (let i = 0; i < N; i++) { const a = (i - 1 + N) % N, b = (i + 1) % N, mx = (RX[a] + RX[b]) / 2, my = (RY[a] + RY[b]) / 2; o[i] = clamp(lerp(o[i], (mx - X[i]) * T.NX[i] + (my - Y[i]) * T.NY[i], 0.8), -lim, lim); }
  }
  for (let i = 0; i < N; i++) { RX[i] = X[i] + T.NX[i] * o[i]; RY[i] = Y[i] + T.NY[i] * o[i]; }
  T.RX = RX; T.RY = RY; T.RO = o; geo(T, RX, RY, 'RA', 'RTX', 'RTY', null, null, 'RK');
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; for (let i = 0; i < N; i++) { x0 = Math.min(x0, X[i]); y0 = Math.min(y0, Y[i]); x1 = Math.max(x1, X[i]); y1 = Math.max(y1, Y[i]); } T.box = [x0, y0, x1, y1];
  T.lim = T.w / 2 + T.curb + T.wall;
  return (cache[id] = T);
}
function geo(T, X, Y, a, tx, ty, nx, ny, k) {
  const N = X.length, A = new Float64Array(N), TX = new Float64Array(N), TY = new Float64Array(N), KK = new Float64Array(N);
  for (let i = 0; i < N; i++) { const p = (i - 1 + N) % N, q = (i + 1) % N, dx = X[q] - X[p], dy = Y[q] - Y[p], l = Math.hypot(dx, dy) || 1; TX[i] = dx / l; TY[i] = dy / l; A[i] = Math.atan2(dy, dx); }
  for (let i = 0; i < N; i++) KK[i] = angd(A[(i + 1) % N], A[(i - 1 + N) % N]) / (2 * T.ds);
  T[a] = A; T[tx] = TX; T[ty] = TY; T[k] = KK; if (nx) { const NX = new Float64Array(N), NY = new Float64Array(N); for (let i = 0; i < N; i++) { NX[i] = -TY[i]; NY[i] = TX[i]; } T[nx] = NX; T[ny] = NY; }
}
function locate(T, x, y, hint) {
  const N = T.N; let bi = -1, bd = 1e18;
  const scan = (a, b) => { for (let k = a; k <= b; k++) { const i = ((k % N) + N) % N, dx = x - T.X[i], dy = y - T.Y[i], d = dx * dx + dy * dy; if (d < bd) { bd = d; bi = i; } } };
  if (hint == null) scan(0, N - 1); else { scan(hint - 40, hint + 40); if (bd > 400) scan(0, N - 1); }
  const dx = x - T.X[bi], dy = y - T.Y[bi], along = dx * T.TX[bi] + dy * T.TY[bi];
  return { i: bi, d: dx * T.NX[bi] + dy * T.NY[bi], s: ((bi * T.ds + along) % T.L + T.L) % T.L };
}
function at(T, s, line) { // point + heading at arc length s (centerline or racing line)
  s = ((s % T.L) + T.L) % T.L; const f = s / T.ds, i = Math.floor(f) % T.N, j = (i + 1) % T.N, u = f - Math.floor(f);
  const X = line ? T.RX : T.X, Y = line ? T.RY : T.Y, A = line ? T.RA : T.A;
  return { x: lerp(X[i], X[j], u), y: lerp(Y[i], Y[j], u), h: A[i] + angd(A[j], A[i]) * u, i };
}
function create(id, o) {
  o = o || {}; const T = track(id), d0 = -T.start, p = at(T, d0);
  const g = { T, id, x: p.x, y: p.y, h: p.h, va: p.h, v: 0, steer: 0, drift: 0, held: false, hopT: 0, charge: 0, tier: 0, boostT: 0, boostV: 0, boostMax: 0,
    dist: d0, maxDist: d0, lap: 0, laps: o.laps || T.laps, free: !!o.free, t: o.noCountdown ? 0 : -3, lapT: [], lapStart: 0, over: false, time: 0, si: p.i, d: 0, s: 0, surf: 'road',
    bumpT: 0, wrongT: 0, wrong: false, dp: 0, roll: 0, stats: { drifts: 0, boosts: [0, 0, 0], bumps: 0, driftPts: 0, offT: 0, maxKmh: 0, bestDp: 0 }, ev: [], rec: [], recT: 0, inp: { steer: 0, drift: false } };
  const L = locate(T, g.x, g.y, g.si); g.si = L.i; g.s = L.s; return g;
}
function release(g, ok) {
  if (ok && g.tier > 0) { const b = C.BOOST[g.tier - 1]; g.boostT = b[0]; g.boostMax = b[0]; g.boostV = b[1]; g.stats.boosts[g.tier - 1]++; g.ev.push({ t: 'boost', tier: g.tier }); }
  else if (g.drift && !ok) g.ev.push({ t: 'driftLost' });
  const pts = Math.round(g.dp); if (g.drift && ok) { g.stats.driftPts += pts; g.stats.bestDp = Math.max(g.stats.bestDp, pts); if (pts > 0) g.ev.push({ t: 'driftEnd', pts }); }
  g.drift = 0; g.charge = 0; g.tier = 0; g.dp = 0;
}
function step(g, dt) {
  const T = g.T, inp = g.inp; g.ev.length = g.ev.length > 40 ? 0 : g.ev.length;
  if (g.t < 0) { const t0 = g.t; g.t += dt; for (const k of [-2, -1]) if (t0 < k && g.t >= k) g.ev.push({ t: 'cd', n: -k }); if (g.t >= 0) { g.ev.push({ t: 'go' }); g.t = 0; } g.steer = 0; return g; }
  if (!g.over) g.t += dt;
  g.steer += clamp(inp.steer - g.steer, -dt * 9, dt * 9);
  const half = T.w / 2, ad = Math.abs(g.d); g.surf = ad <= half ? 'road' : ad <= half + T.curb ? 'curb' : 'grass';
  if (g.over) { g.v *= 1 - Math.min(1, dt * 1.6); if (g.drift) release(g, false); }
  else {
    const cap = (g.surf === 'grass' ? C.OFF_VMAX : g.surf === 'curb' ? C.VMAX - 3 : C.VMAX) + (g.boostT > 0 ? g.boostV : 0);
    if (g.v < cap) g.v = Math.min(cap, g.v + (g.boostT > 0 ? 34 : C.ACC * (1 - 0.55 * g.v / C.VMAX)) * dt);
    else g.v = Math.max(cap, g.v - (g.surf === 'grass' ? 26 : 9) * dt);
    if (inp.drift) {
      if (!g.drift) {
        if (!g.held) { g.hopT = 0.24; g.ev.push({ t: 'hop' }); }
        g.held = true;
        if (Math.abs(g.steer) > 0.25 && g.v > 9 && g.surf !== 'grass') { g.drift = g.steer > 0 ? 1 : -1; g.charge = 0; g.tier = 0; g.dp = 0; g.stats.drifts++; g.ev.push({ t: 'drift', dir: g.drift }); }
      }
    } else { if (g.drift) release(g, true); g.held = false; }
    if (g.drift && (g.v < 6 || g.surf === 'grass')) release(g, false);
  }
  const f = clamp(g.v / 7, 0, 1);
  if (!g.drift) { g.h += g.steer * C.TURN * f * (1 - 0.3 * Math.min(1, g.v / C.VMAX)) * dt; if (g.v > 12 && !g.over) g.v -= Math.abs(g.steer) * f * 9 * dt; g.va += angd(g.h, g.va) * Math.min(1, (g.surf === 'grass' ? 6 : C.GRIP) * dt); g.roll = lerp(g.roll, -g.steer * f * 0.35, Math.min(1, dt * 8)); }
  else {
    const m = 0.55 + 0.5 * clamp(g.steer * g.drift, -1, 1);
    g.h += g.drift * C.TURN_D * m * f * dt; g.va += angd(g.h, g.va) * Math.min(1, C.GRIP_D * dt);
    const slip = Math.abs(angd(g.h, g.va)); g.charge += dt * (0.55 + Math.min(1, slip / 0.5) * 0.6); g.v *= 1 - dt * 0.03; g.dp += dt * g.v * slip * 8;
    const tier = g.charge >= C.TIERS[2] ? 3 : g.charge >= C.TIERS[1] ? 2 : g.charge >= C.TIERS[0] ? 1 : 0; if (tier > g.tier) { g.tier = tier; g.ev.push({ t: 'tier', tier }); }
    g.roll = lerp(g.roll, -g.drift * 0.9, Math.min(1, dt * 6));
  }
  g.x += Math.cos(g.va) * g.v * dt; g.y += Math.sin(g.va) * g.v * dt;
  let L = locate(T, g.x, g.y, g.si);
  if (Math.abs(L.d) > T.lim) {
    const sg = L.d > 0 ? 1 : -1, over = Math.abs(L.d) - T.lim; g.x -= T.NX[L.i] * over * sg; g.y -= T.NY[L.i] * over * sg;
    if (g.bumpT <= 0 && g.v > 5) { g.ev.push({ t: 'bump', v: g.v }); g.stats.bumps++; g.v *= 0.55; }
    g.bumpT = 0.35; const ta = T.A[L.i] + (Math.cos(angd(g.va, T.A[L.i])) < 0 ? Math.PI : 0); g.va = ta + angd(g.va, ta) * 0.2; g.h = g.va + angd(g.h, g.va) * 0.4;
    if (g.drift) release(g, false); L = locate(T, g.x, g.y, L.i);
  }
  let dS = L.s - g.s; if (dS < -T.L / 2) dS += T.L; if (dS > T.L / 2) dS -= T.L;
  g.si = L.i; g.d = L.d; g.s = L.s; g.dist += dS;
  if (g.dist > g.maxDist && !g.over) {
    g.maxDist = g.dist; const lc = Math.floor(g.maxDist / T.L);
    if (lc > g.lap) { g.lapT.push(g.t - g.lapStart); g.lapStart = g.t; g.lap = lc; if (!g.free && g.lap >= g.laps) { g.over = true; g.time = g.t; g.ev.push({ t: 'finish', time: g.t }); release(g, false); } else g.ev.push({ t: 'lap', lap: g.lap, final: !g.free && g.lap === g.laps - 1 }); }
  }
  const fw = Math.cos(angd(g.va, T.A[L.i]));
  if (!g.over && fw < -0.2 && g.v > 4) g.wrongT += dt; else g.wrongT = Math.max(0, g.wrongT - dt * 2);
  const wr = g.wrongT > 0.9; if (wr !== g.wrong) { g.wrong = wr; if (wr) g.ev.push({ t: 'wrong' }); }
  if (g.surf === 'grass' && !g.over) g.stats.offT += dt;
  g.stats.maxKmh = Math.max(g.stats.maxKmh, Math.round(g.v * C.KMH));
  g.boostT -= dt; g.hopT -= dt; g.bumpT -= dt;
  if (!g.over) { g.recT += dt; if (g.recT >= 0.1) { g.recT -= 0.1; g.rec.push(Math.round(g.x * 10), Math.round(g.y * 10), Math.round(g.h * 100), Math.round(g.maxDist * 10)); } }
  return g;
}
/* autopilot (demo, hero, tests). skill 0..1 */
function bot(g, skill) {
  const T = g.T, N = T.N, sk = skill == null ? 1 : skill, look = 5 + g.v * 0.42, i = (g.si + Math.round(look / T.ds)) % N;
  const tx = T.RX[i], ty = T.RY[i], want = Math.atan2(ty - g.y, tx - g.x);
  let k = 0; for (let j = 6; j <= 30; j += 2) k += T.RK[(g.si + j) % N]; k /= 13;
  const o = { steer: 0, drift: false };
  if (!g.drift) { g.botDT = 0; const e = angd(want, g.h); o.steer = clamp(e * 2.6, -1, 1); o.drift = sk > 0.3 && Math.abs(k) > 0.04 && g.v > 15 && Math.sign(k) === Math.sign(e) && g.d * Math.sign(k) > -T.w / 2 + 1.2 && Math.abs(g.d) < T.w / 2; }
  else { const e = angd(want, g.h) + (g.BOTSL == null ? 0.25 : g.BOTSL) * g.drift, r = e * 4, m = clamp(r * g.drift / (C.TURN_D * Math.max(0.3, 1)), 0.05, 1.05); o.steer = g.drift * clamp((m - 0.55) / 0.5, -1, 1); g.botDT = (g.botDT || 0) + 1 / 60; o.drift = !((((Math.abs(k) < 0.02 && g.tier >= 1) || e * g.drift < -0.25) && g.botDT > 0.35) || Math.abs(g.d) > T.w / 2 + 0.4); }
  if (sk < 1) o.steer = clamp(o.steer * (0.8 + 0.2 * sk), -1, 1);
  return o;
}
/* pace ghost: ideal racing line with a curvature speed profile, timed to a target total time */
const paceCache = {};
function pace(id, laps) {
  const key = id + laps; if (paceCache[key]) return paceCache[key];
  const T = track(id), N = T.N, ds = T.ds, v = new Float64Array(N), A = 32, VM = C.VMAX + 4, DEC = 24;
  for (let i = 0; i < N; i++) v[i] = Math.min(VM, Math.sqrt(A / Math.max(1e-4, Math.abs(T.RK[i]))));
  for (let r = 0; r < 2; r++) { for (let i = 1; i <= N; i++) v[i % N] = Math.min(v[i % N], Math.sqrt(v[i - 1] ** 2 + 2 * C.ACC * ds)); for (let i = N - 1; i >= 0; i--) v[i] = Math.min(v[i], Math.sqrt(v[(i + 1) % N] ** 2 + 2 * DEC * ds)); }
  const d0 = -T.start, D1 = laps * T.L, M = Math.ceil((D1 - d0) / ds) + 1, tm = new Float64Array(M); let cur = 0.5;
  for (let m = 1; m < M; m++) { const d = d0 + m * ds, i = Math.floor((((d % T.L) + T.L) % T.L) / ds) % N, nv = Math.min(v[i], Math.sqrt(cur * cur + 2 * C.ACC * ds)); tm[m] = tm[m - 1] + ds / ((cur + nv) / 2); cur = nv; }
  return (paceCache[key] = { id, d0, ds, tm, total: tm[M - 1], laps });
}
function paceAt(P, scale, t) { // -> {x,y,h,dist}
  const T = track(P.id), tm = P.tm, tt = t / scale; let lo = 0, hi = tm.length - 1; if (tt >= tm[hi]) lo = hi; else { while (hi - lo > 1) { const m = (lo + hi) >> 1; if (tm[m] <= tt) lo = m; else hi = m; } }
  const u = lo < tm.length - 1 ? (tt - tm[lo]) / ((tm[lo + 1] - tm[lo]) || 1) : 0, dist = P.d0 + (lo + clamp(u, 0, 1)) * P.ds, p = at(T, dist, true); p.dist = dist; return p;
}
function paceTimeAt(P, scale, dist) { const m = clamp((dist - P.d0) / P.ds, 0, P.tm.length - 1), i = Math.floor(m), j = Math.min(P.tm.length - 1, i + 1); return lerp(P.tm[i], P.tm[j], m - i) * scale; }
function recAt(rec, t) { const n = rec.length / 4; if (!n) return null; const f = clamp(t / 0.1 - 1, 0, n - 1), i = Math.floor(f), j = Math.min(n - 1, i + 1), u = f - i, a = i * 4, b = j * 4; return { x: lerp(rec[a], rec[b], u) / 10, y: lerp(rec[a + 1], rec[b + 1], u) / 10, h: lerp(rec[a + 2], rec[b + 2], u) / 100, dist: lerp(rec[a + 3], rec[b + 3], u) / 10 }; }
function recTimeAt(rec, dist) { const n = rec.length / 4, D = dist * 10; let lo = 0, hi = n - 1; if (!n || rec[hi * 4 + 3] < D) return null; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (rec[m * 4 + 3] < D) lo = m; else hi = m; } return (hi + 1) * 0.1; }
const enc = ms => Math.max(1, C.MAXMS - Math.round(ms)), dec = sc => C.MAXMS - sc;
const fmt = (s, dp) => { if (!(s >= 0)) return '-:--.--'; const m = Math.floor(s / 60), r = s - m * 60; return m + ':' + (r < 10 ? '0' : '') + r.toFixed(dp == null ? 2 : dp); };
const API = { C, TRACKS, track, locate, at, create, step, bot, release, pace, paceAt, paceTimeAt, recAt, recTimeAt, enc, dec, fmt, angd, clamp, lerp };
root.BD = API; if (typeof module !== 'undefined') module.exports = API;
})(typeof window !== 'undefined' ? window : globalThis);

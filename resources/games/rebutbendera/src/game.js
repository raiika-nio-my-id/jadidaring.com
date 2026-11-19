/* Rebut Bendera Kampung sim (window.RB): map, grid A*, movement, tags/jail/rescue/flags, bots. Host-authoritative; guests reuse move() for prediction. */
(function () {
'use strict';
const W = 24, H = 14, MID = 12, CELL = 0.5, GW = W / CELL, GH = H / CELL;
const SPD = 3.1, CARRY = 0.94, JEMB = 1.15, TAGR = 0.78, GRAB = 0.8, RESC = 1.0, IMM = 1600, RIMM = 2600, JAUTO = 15000, TPCD = 8000, TPR = 0.6, FLAGR = 1.05, DT = 50, CDT = 1400;
const mir = r => [W - r[2], H - r[3], W - r[0], H - r[1]];
const L_OBS = [{ r: [4.6, 0, 7.4, 3.5], k: 'rumah' }, { r: [4.8, 10.2, 7.0, 14], k: 'rumah2' }, { r: [9.0, 6.0, 10.4, 8.4], k: 'warung' }, { r: [2.5, 10.7, 4.1, 11.1], k: 'pagar' }, { r: [7.8, 4.7, 8.6, 5.5], k: 'sumur' }, { r: [2.6, 3.0, 3.9, 3.4], k: 'pagar' }];
const OBS = L_OBS.concat(L_OBS.map(o => ({ r: mir(o.r), k: o.k, m: 1 })));
const JEM = [[8.6, 0.6, 11.3, 3.8], mir([8.6, 0.6, 11.3, 3.8])];
const PR = [[8.1, 12.3], [W - 8.1, H - 12.3]];
const FLAG = [[1.8, 7], [W - 1.8, 7]], JAIL = [[2.0, 1.7], [W - 2.0, H - 1.7]];
const SPAWN = [[[3.6, 5.8], [3.6, 8.2], [4.4, 7]], [[W - 3.6, H - 5.8], [W - 3.6, H - 8.2], [W - 4.4, 7]]];
const side = x => x < MID ? 0 : 1; // whose territory
const inR = (r, x, y, m) => x > r[0] - m && x < r[2] + m && y > r[1] - m && y < r[3] + m;
const d2 = (a, b, x, y) => (a - x) * (a - x) + (b - y) * (b - y);
function rng(seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
/* grids: g[team][cy*GW+cx] = 1 passable (team cannot enter its own flag ring) */
const GRID = [0, 1].map(t => { const g = new Uint8Array(GW * GH); for (let cy = 0; cy < GH; cy++) for (let cx = 0; cx < GW; cx++) { const x = (cx + 0.5) * CELL, y = (cy + 0.5) * CELL; let ok = x > 0.3 && x < W - 0.3 && y > 0.3 && y < H - 0.3; for (const o of OBS) if (ok && inR(o.r, x, y, 0.28)) ok = false; if (ok && d2(x, y, FLAG[t][0], FLAG[t][1]) < FLAGR * FLAGR) ok = false; g[cy * GW + cx] = ok ? 1 : 0; } return g; });
const cOf = v => Math.max(0, Math.min(GW - 1, Math.floor(v / CELL)));
const rOf = v => Math.max(0, Math.min(GH - 1, Math.floor(v / CELL)));
const free = (t, x, y) => x > 0 && y > 0 && x < W && y < H && GRID[t][rOf(y) * GW + cOf(x)] === 1;
function nearestFree(t, x, y) { if (free(t, x, y)) return [x, y]; const cx = cOf(x), cy = rOf(y); for (let r = 1; r < 12; r++) { let best = null, bd = 1e9; for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) { if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue; const X = cx + dx, Y = cy + dy; if (X < 0 || Y < 0 || X >= GW || Y >= GH || !GRID[t][Y * GW + X]) continue; const px = (X + 0.5) * CELL, py = (Y + 0.5) * CELL, dd = d2(px, py, x, y); if (dd < bd) { bd = dd; best = [px, py]; } } if (best) return best; } return [x, y]; }
function los(t, ax, ay, bx, by) { const n = Math.ceil(Math.hypot(bx - ax, by - ay) / 0.2); for (let i = 1; i < n; i++) { const k = i / n; if (!free(t, ax + (bx - ax) * k, ay + (by - ay) * k)) return false; } return true; }
function path(t, ax, ay, bx, by) {
  const B = nearestFree(t, bx, by); bx = B[0]; by = B[1];
  if (los(t, ax, ay, bx, by)) return [[bx, by]];
  const A0 = nearestFree(t, ax, ay), s = rOf(A0[1]) * GW + cOf(A0[0]), e = rOf(by) * GW + cOf(bx), g = GRID[t];
  const N = GW * GH, cost = new Float32Array(N).fill(1e9), from = new Int32Array(N).fill(-1), done = new Uint8Array(N), open = [s]; cost[s] = 0;
  const hh = i => Math.hypot((i % GW) - (e % GW), ((i / GW) | 0) - ((e / GW) | 0));
  let it = 0;
  while (open.length && it++ < 4000) {
    let bi = 0, bf = 1e9; for (let i = 0; i < open.length; i++) { const f = cost[open[i]] + hh(open[i]); if (f < bf) { bf = f; bi = i; } }
    const c = open[bi]; open[bi] = open[open.length - 1]; open.pop(); if (c === e) break; if (done[c]) continue; done[c] = 1;
    const cx = c % GW, cy = (c / GW) | 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { if (!dx && !dy) continue; const X = cx + dx, Y = cy + dy; if (X < 0 || Y < 0 || X >= GW || Y >= GH) continue; const n = Y * GW + X; if (!g[n] || done[n]) continue; if (dx && dy && (!g[cy * GW + X] || !g[Y * GW + cx])) continue; const nc = cost[c] + (dx && dy ? 1.4142 : 1); if (nc < cost[n]) { cost[n] = nc; from[n] = c; open.push(n); } }
  }
  if (from[e] < 0 && e !== s) return [[bx, by]];
  const cells = []; for (let c = e; c !== s && c >= 0; c = from[c]) cells.push(c); cells.reverse();
  const pts = cells.map(c => [((c % GW) + 0.5) * CELL, (((c / GW) | 0) + 0.5) * CELL]); pts[pts.length - 1] = [bx, by];
  const out = []; let px = ax, py = ay, i = 0;
  while (i < pts.length) { let j = pts.length - 1; while (j > i && !los(t, px, py, pts[j][0], pts[j][1])) j--; out.push(pts[j]); px = pts[j][0]; py = pts[j][1]; i = j + 1; }
  return out;
}
const inJem = (x, y) => JEM.some(r => inR(r, x, y, 0));
function speed(p, t) { return SPD * (p.carry >= 0 ? CARRY : 1) * (inJem(p.x, p.y) ? JEMB : 1) * (p.bot ? p.sk || 0.95 : 1) * (t < p.cd ? 0.45 : 1); }
function setTarget(p, x, y) { x = Math.max(0.4, Math.min(W - 0.4, x)); y = Math.max(0.4, Math.min(H - 0.4, y)); p.tx = x; p.ty = y; p.path = p.st ? [] : path(p.team, p.x, p.y, x, y); }
function move(p, dt) {
  if (p.st) return; let left = speed(p, p.now || 0) * dt / 1000; p.mv = 0;
  while (left > 0 && p.path && p.path.length) { const w = p.path[0], dx = w[0] - p.x, dy = w[1] - p.y, d = Math.hypot(dx, dy); if (d <= left) { p.x = w[0]; p.y = w[1]; left -= d; p.path.shift(); p.mv = 1; } else { p.x += dx / d * left; p.y += dy / d * left; p.dir = Math.atan2(dy, dx); left = 0; p.mv = 1; } }
  if (!free(p.team, p.x, p.y)) { const f = nearestFree(p.team, p.x, p.y); p.x = f[0]; p.y = f[1]; }
}
function newMatch(o) {
  // o: {seed, size, dur, cap, players:[{id,name,team,bot,sk}]}
  const S = { t: 0, dur: o.dur || 180000, cap: o.cap || 3, sc: [0, 0], P: [], F: FLAG.map((f, i) => ({ team: i, x: f[0], y: f[1], by: -1 })), ev: [], seq: 0, over: false, win: -1, rnd: rng(o.seed || 1), pings: [] };
  const n = [0, 0];
  for (const q of o.players) { const t = q.team, k = n[t]++, sp = SPAWN[t][k % 3]; S.P.push({ i: S.P.length, id: q.id, name: q.name, team: t, bot: !!q.bot, sk: q.sk || 0.95, x: sp[0], y: sp[1], tx: sp[0], ty: sp[1], path: [], st: 0, jt: 0, imm: 0, tp: 0, carry: -1, dir: t ? Math.PI : 0, tags: 0, caps: 0, frees: 0, think: k * 120 + t * 60, cd: 0, now: 0, role: k % 2 ? 'def' : 'att', hid: 0 }); }
  return S;
}
function ev(S, k, a, b) { S.ev.push({ n: ++S.seq, k, a, b, t: S.t }); if (S.ev.length > 12) S.ev.shift(); }
function jail(S, p, by) { if (p.carry >= 0) { const f = S.F[p.carry]; f.by = -1; f.x = FLAG[f.team][0]; f.y = FLAG[f.team][1]; p.carry = -1; ev(S, 'ret', p.i, f.team); } p.st = 1; p.jt = S.t; p.path = []; const jt = 1 - p.team, k = S.P.filter(q => q.st && q.team === p.team && q !== p).length; p.x = JAIL[jt][0] + (k - 1) * 0.55 * (jt ? -1 : 1); p.y = JAIL[jt][1] + (jt ? -0.15 : 0.15); p.tx = p.x; p.ty = p.y; if (by) { by.tags++; by.cd = S.t + CDT; } ev(S, 'tag', by ? by.i : -1, p.i); }
function release(S, p, imm) { const sp = SPAWN[p.team][p.i % 3]; p.st = 0; p.x = sp[0]; p.y = sp[1]; p.tx = p.x; p.ty = p.y; p.path = []; p.imm = S.t + imm; p.cd = 0; }
/* one authoritative tick */
function step(S, dt) {
  if (S.over) return; S.t += dt;
  for (const p of S.P) { p.now = S.t; if (p.bot && S.t >= p.think) { p.think = S.t + 330 + Math.floor(S.rnd() * 120); bot(S, p); } move(p, dt); p.hid = inJem(p.x, p.y) ? 1 : 0; }
  for (const p of S.P) { if (p.st || S.t < p.tp) continue; for (let k = 0; k < 2; k++) if (d2(p.x, p.y, PR[k][0], PR[k][1]) < TPR * TPR) { const o = PR[1 - k]; p.x = o[0] + (k ? 0.7 : -0.7) * 0; p.y = o[1] + (o[1] > 7 ? -0.75 : 0.75); p.tp = S.t + TPCD; p.path = p.bot ? [] : path(p.team, p.x, p.y, p.tx, p.ty); if (!p.bot && Math.hypot(p.tx - PR[k][0], p.ty - PR[k][1]) < 1.2) { p.tx = p.x; p.ty = p.y; p.path = []; } ev(S, 'tp', p.i, k); break; } }
  for (const f of S.F) if (f.by >= 0) { const c = S.P[f.by]; f.x = c.x; f.y = c.y; }
  // grabs + captures
  for (const p of S.P) { if (p.st) continue; const ef = S.F[1 - p.team]; if (p.carry < 0 && ef.by < 0 && d2(p.x, p.y, ef.x, ef.y) < GRAB * GRAB) { ef.by = p.i; p.carry = ef.team; ev(S, 'grab', p.i, ef.team); }
    if (p.carry >= 0 && side(p.x) === p.team) { const f = S.F[p.carry]; f.by = -1; f.x = FLAG[f.team][0]; f.y = FLAG[f.team][1]; p.carry = -1; p.caps++; S.sc[p.team]++; ev(S, 'cap', p.i, p.team); if (S.sc[p.team] >= S.cap) { S.over = true; S.win = p.team; ev(S, 'end', p.team, 0); return; } } }
  // tags
  for (const a of S.P) for (const b of S.P) { if (a.team === b.team || a.st || b.st) continue; if (side(b.x) !== a.team || S.t < b.imm || S.t < a.cd) continue; if (d2(a.x, a.y, b.x, b.y) < TAGR * TAGR) jail(S, b, a); }
  // rescue + auto release
  for (const p of S.P) { if (p.st || side(p.x) === p.team) continue; const jt = 1 - p.team; if (d2(p.x, p.y, JAIL[jt][0], JAIL[jt][1]) < RESC * RESC * 1.6) { const pr = S.P.filter(q => q.st && q.team === p.team); if (pr.length) { pr.forEach(q => release(S, q, IMM)); p.imm = S.t + RIMM; p.frees += pr.length; ev(S, 'free', p.i, pr.length); } } }
  for (const p of S.P) if (p.st && S.t - p.jt >= JAUTO) { release(S, p, IMM); ev(S, 'auto', p.i, 0); }
  S.pings = S.pings.filter(g => S.t - g.t < 3500);
  if (S.t >= S.dur) { S.over = true; S.win = S.sc[0] > S.sc[1] ? 0 : S.sc[1] > S.sc[0] ? 1 : 2; ev(S, 'end', S.win, 1); }
}
/* bots: simple roles; carrier runs home, attackers go for the flag / rescue, defenders chase intruders */
function bot(S, p) {
  if (p.st) return; const me = p.team, foe = 1 - me, mates = S.P.filter(q => q.team === me), foes = S.P.filter(q => q.team === foe && !q.st);
  const near = (x, y, list) => { let b = null, bd = 1e9; for (const q of list) { const d = d2(x, y, q.x, q.y); if (d < bd) { bd = d; b = q; } } return [b, Math.sqrt(bd)]; };
  const jit = () => (S.rnd() - 0.5) * 1.2, homeX = me ? MID + 1.2 : MID - 1.2;
  if (p.carry >= 0) { const pr = PR[foe], dm = Math.abs(p.x - homeX), dp = Math.hypot(p.x - pr[0], p.y - pr[1]); if (S.t >= p.tp && dp < dm * 0.8) { setTarget(p, pr[0], pr[1]); return; } const [q, dq] = near(p.x, p.y, foes); let ty = p.y + jit(); if (q && dq < 3) ty = p.y + (p.y > q.y ? 2 : -2); setTarget(p, homeX, Math.max(1, Math.min(H - 1, ty))); return; }
  const help = S.pings.filter(g => g.team === me && g.k === 'tolong').pop();
  const intr = foes.filter(q => side(q.x) === me && !(q.hid && S.rnd() < 0.6)), jailed = mates.filter(q => q.st).length;
  const myDef = mates.filter(q => !q.st && q.role === 'def');
  let role = p.role; if (role === 'att' && intr.some(q => q.carry >= 0) && side(p.x) === me) role = 'def'; if (!myDef.length && intr.length) role = 'def';
  if (help && d2(p.x, p.y, help.x, help.y) < 64 && role === 'def') { setTarget(p, help.x + jit(), help.y + jit()); return; }
  if (role === 'def' && jailed && !intr.length && !mates.some(q => !q.st && q !== p && q.role === 'att')) role = 'att';
  if (role === 'def') {
    const intr2 = intr.filter(q => q.carry >= 0 || (Math.hypot(q.x - p.x, q.y - p.y) < 5.5 && Math.hypot(q.x - FLAG[me][0], q.y - FLAG[me][1]) < 7.5)); if (intr2.length && S.rnd() < 0.8) { const c = intr2.find(q => q.carry >= 0) || near(p.x, p.y, intr2)[0]; const lead = 0.6; setTarget(p, c.x + Math.cos(c.dir || 0) * lead * (c.mv ? 1 : 0), c.y + Math.sin(c.dir || 0) * lead * (c.mv ? 1 : 0)); return; }
    const f = FLAG[me], gx = f[0] + (me ? -3.6 : 3.6), wob = Math.sin(S.t / 1700 + p.i) * 3.2; setTarget(p, gx + jit() * 0.5, f[1] + wob); return;
  }
  // attacker
  if (jailed && S.rnd() < 0.75) { const j = JAIL[foe]; tryGo(S, p, j[0], j[1], foes); return; }
  const ef = S.F[foe]; if (ef.by >= 0) { const c = S.P[ef.by]; setTarget(p, c.x + jit(), c.y + jit()); return; }
  tryGo(S, p, ef.x, ef.y, foes);
}
function tryGo(S, p, x, y, foes) {
  const inFoe = side(p.x) !== p.team; let threat = null, td = 1e9; for (const q of foes) { if (side(q.x) === p.team) continue; const d = Math.hypot(q.x - p.x, q.y - p.y); if (d < td) { td = d; threat = q; } }
  if (threat && td < (inFoe ? 2.6 : 1.6) && S.t >= p.imm) { const ax = p.x - threat.x, ay = p.y - threat.y, n = Math.hypot(ax, ay) || 1; const back = p.team ? 1 : -1; let ex = p.x + ax / n * 2 + back * 1.2, ey = p.y + ay / n * 2.4; if (S.rnd() < 0.3) { const jm = JEM[p.team ? 0 : 1]; ex = (jm[0] + jm[2]) / 2; ey = (jm[1] + jm[3]) / 2; } setTarget(p, ex, ey); return; }
  if (x === S.F[1 - p.team].x && y === S.F[1 - p.team].y) { const dA = Math.hypot(p.x - x, p.y - y), g2 = foes.filter(q => side(q.x) !== p.team); let dD = 1e9, gq = null; for (const q of g2) { const d = Math.hypot(q.x - x, q.y - y) + Math.hypot(q.x - p.x, q.y - p.y) * 0.25; if (d < dD) { dD = d; gq = q; } }
    if (gq && dA > 3 && dD + 1.4 < dA && S.t - (p.wait || 0) < 5000) { if (!p.wait) p.wait = S.t; const hx = p.team ? MID + 0.8 : MID - 0.8; setTarget(p, hx, gq.y > 7 ? 2 + S.rnd() * 3 : 9 + S.rnd() * 3); return; } if (dD + 1.4 >= dA || S.t - (p.wait || 0) >= 5000) p.wait = 0; }
  let lane = Math.sin(S.t / 2200 + p.i * 2) * 1.6; const g = foes.filter(q => side(q.x) !== p.team); if (g.length) { const gy = g.reduce((a, q) => a + q.y, 0) / g.length; lane = gy > y ? -3 : 3; }
  const far = Math.abs(p.x - x) > 3.2; setTarget(p, far ? x + (p.team ? 1.8 : -1.8) * 0 + (x < MID ? 1.2 : -1.2) : x, far ? Math.max(0.8, Math.min(H - 0.8, y + lane)) : y);
}
/* compact snapshot for the wire */
const R2 = v => Math.round(v * 100);
function snap(S) { return { t: Math.round(S.t), sc: S.sc.slice(), P: S.P.map(p => [R2(p.x), R2(p.y), R2(p.tx), R2(p.ty), p.st, p.carry, Math.max(0, Math.round(p.imm - S.t)), Math.max(0, Math.round(p.tp - S.t)), p.tags, p.caps, p.frees, p.st ? Math.round(S.t - p.jt) : 0, Math.max(0, Math.round((p.cd || 0) - S.t))]), F: S.F.map(f => f.by), ev: S.ev.slice(-6), seq: S.seq, over: S.over ? 1 : 0, win: S.win }; }
function applySnap(S, n, own) {
  S.t = n.t; S.sc = n.sc.slice(); S.over = !!n.over; S.win = n.win; S.seq = Math.max(S.seq, n.seq || 0);
  n.P.forEach((a, i) => { const p = S.P[i]; if (!p) return; const mine = own != null && i === own; p.st = a[4]; p.carry = a[5]; p.imm = S.t + a[6]; p.tp = S.t + a[7]; p.tags = a[8]; p.caps = a[9]; p.frees = a[10]; p.jt = S.t - (a[11] || 0); p.cd = S.t + (a[12] || 0);
    const x = a[0] / 100, y = a[1] / 100; p.ex = x - p.x; p.ey = y - p.y; p.x = x; p.y = y;
    if (!mine) { const tx = a[2] / 100, ty = a[3] / 100; p.tx = tx; p.ty = ty; p.path = p.st ? [] : path(p.team, x, y, tx, ty); } else p.path = p.st ? [] : path(p.team, x, y, p.tx, p.ty); });
  n.F.forEach((by, i) => { const f = S.F[i]; f.by = by; if (by >= 0) { f.x = S.P[by].x; f.y = S.P[by].y; } else { f.x = FLAG[i][0]; f.y = FLAG[i][1]; } });
}
window.RB = { W, H, MID, OBS, JEM, PR, FLAG, JAIL, SPAWN, SPD, TAGR, DT, side, free, path, los, nearestFree, setTarget, move, newMatch, step, bot, snap, applySnap, rng, inJem, speed, jail, release };
})();

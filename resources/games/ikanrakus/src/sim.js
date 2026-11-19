/* Ikan Rakus simulation: pure logic (no DOM). window.IRSim */
(function (root) {
'use strict';
const SP = {
  teri:     { n: 'Teri',        r: 8,  pts: 1,  spd: 78, school: true },
  badut:    { n: 'Ikan Badut',  r: 11, pts: 2,  spd: 62 },
  kembung:  { n: 'Kembung',     r: 12, pts: 2,  spd: 84 },
  baronang: { n: 'Baronang',    r: 19, pts: 3,  spd: 70 },
  kakap:    { n: 'Kakap Merah', r: 27, pts: 5,  spd: 76, hunter: true },
  kerapu:   { n: 'Kerapu',      r: 35, pts: 7,  spd: 60, hunter: true },
  barakuda: { n: 'Barakuda',    r: 45, pts: 10, spd: 96, hunter: true },
  hiu:      { n: 'Hiu Karang',  r: 54, pts: 14, spd: 86, hunter: true },
  macan:    { n: 'Hiu Macan',   r: 82, pts: 20, spd: 84, hunter: true }
};
const ORDER = ['teri', 'badut', 'kembung', 'baronang', 'kakap', 'kerapu', 'barakuda', 'hiu', 'macan'];
const PR = [14, 23, 38, 58];        // player radius per stage
const PSPD = [205, 212, 220, 232];  // player max speed per stage (world units/s)
const SEAS = [
  { id: 'seribu', n: 'Kepulauan Seribu', top: '#5fd0e6', mid: '#1e8fb8', deep: '#0b4f7a', sand: '#e9d29c', coral: ['#ff7a8a', '#ffb347', '#c86bfa', '#57d39b'] },
  { id: 'bunaken', n: 'Bunaken', top: '#46b9e8', mid: '#176fb0', deep: '#0a3567', sand: '#d9c28c', coral: ['#ff5f7e', '#ffd166', '#06d6a0', '#ef8cff'] },
  { id: 'rajaampat', n: 'Raja Ampat', top: '#3fe0d0', mid: '#118a9e', deep: '#062f4f', sand: '#cfe0b0', coral: ['#ff9f1c', '#ff4d6d', '#9b5de5', '#00f5d4'] },
  { id: 'lepas', n: 'Laut Lepas', top: '#3aa6e0', mid: '#13558f', deep: '#05193a', sand: '#b9b08a', coral: ['#f15bb5', '#fee440', '#00bbf9', '#00f5d4'] }
];
const LEVELS = [
  { sea: 0, n: 'Pantai Pulau Pramuka', goal: [10, 26, 44], mix: { teri: 5, badut: 2, kembung: 3, baronang: 1.4, kakap: 0.5 }, haz: [], par: 75 },
  { sea: 0, n: 'Terumbu Pulau Tidung', goal: [12, 28, 48], mix: { teri: 4, badut: 2, kembung: 3, baronang: 1.6, kakap: 0.8 }, haz: ['ubur'], par: 85 },
  { sea: 0, n: 'Dermaga Nelayan', goal: [12, 30, 52], mix: { teri: 4, badut: 1.5, kembung: 3, baronang: 1.8, kakap: 1, kerapu: 0.3 }, haz: ['ubur', 'jaring'], par: 100 },
  { sea: 1, n: 'Dinding Karang Bunaken', goal: [14, 34, 60], mix: { teri: 3.5, badut: 2, kembung: 2.5, baronang: 2, kakap: 1.2, kerapu: 0.7 }, haz: ['plastik'], par: 110 },
  { sea: 1, n: 'Arus Biru Siladen', goal: [14, 36, 64], mix: { teri: 3.5, badut: 1.5, kembung: 2.5, baronang: 2, kakap: 1.3, kerapu: 0.8, barakuda: 0.3 }, haz: ['ubur', 'plastik', 'jaring'], par: 125 },
  { sea: 1, n: 'Teluk Manado', goal: [16, 38, 68], mix: { teri: 3, badut: 1.5, kembung: 2.5, baronang: 2, kakap: 1.4, kerapu: 1, barakuda: 0.4 }, haz: ['bom', 'plastik'], par: 125 },
  { sea: 2, n: 'Laguna Kabui', goal: [14, 34, 60, 96], mix: { teri: 3, badut: 1.5, kembung: 2.5, baronang: 2, kakap: 1.4, kerapu: 1.1, barakuda: 0.6, hiu: 0.3 }, haz: ['ubur', 'jaring'], par: 165 },
  { sea: 2, n: 'Gugusan Misool', goal: [16, 36, 64, 104], mix: { teri: 3, badut: 1.2, kembung: 2.5, baronang: 2, kakap: 1.5, kerapu: 1.2, barakuda: 0.7, hiu: 0.4 }, haz: ['ubur', 'plastik', 'bom'], par: 185 },
  { sea: 2, n: 'Puncak Piaynemo', goal: [16, 38, 68, 112], mix: { teri: 3, badut: 1.2, kembung: 2.4, baronang: 2, kakap: 1.6, kerapu: 1.3, barakuda: 0.8, hiu: 0.6 }, haz: ['ubur', 'plastik', 'jaring', 'bom'], par: 190 }
];
const ENDLESS = { sea: 3, n: 'Laut Lepas', goal: [14, 34, 62, 100], mix: { teri: 3, badut: 1.3, kembung: 2.5, baronang: 2, kakap: 1.5, kerapu: 1.2, barakuda: 0.8, hiu: 0.6, macan: 0.7 }, haz: ['ubur', 'plastik', 'jaring', 'bom'], endless: true };
const HIU = { sea: 3, n: 'Hiu Lapar', goal: [14, 34, 62, 100], mix: { teri: 3.4, badut: 1.4, kembung: 2.8, baronang: 2.2, kakap: 1.5, kerapu: 1.2, barakuda: 0.8, hiu: 0.5, macan: 0.8 }, haz: ['plastik', 'jaring', 'bom'], endless: true, shark: true };
const DASH = { t: 0.34, cd: 2.0, cdShark: 1.3, mul: 2.15 };
const WW = 1500, WH = 960, SURF = 60, FLOOR = WH - 90;
/* t365u: death beat (belly-up float, world keeps swimming) then the fish plunges in from above the surface (nyemplung) */
const DIE_T = 1.25, DROP_T = 1.05, DROP_FROM = SURF - 230, DROP_AIR = 0.38;

function rng(seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const dist2 = (ax, ay, bx, by) => (ax - bx) * (ax - bx) + (ay - by) * (ay - by);

function create(lv, opts) {
  opts = opts || {};
  const L = lv === 'endless' ? ENDLESS : lv === 'hiu' ? HIU : LEVELS[lv];
  const R = rng(opts.seed || (Date.now() & 0xffffff));
  const w = {
    lv, L, R, t: 0, fish: [], haz: [], fx: [], ev: [], id: 1,
    p: { x: WW / 2, y: WH * 0.42, vx: 0, vy: 0, dir: 1, stage: 0, inv: 2, stun: 0, slow: 0, shield: 0, chomp: 0, trapped: null, taps: 0, dead: 0, dash: 0, dashCd: 0 },
    grow: 0, score: 0, lives: 3, deaths: 0, combo: 0, comboT: 0, frenzy: 0, rakus: 0, eaten: {}, best: 0,
    hunger: 1, dashes: 0, done: null, hazT: 6, pearlT: 14, shieldT: 30, diff: 0, tips: {}
  };
  plunge(w, WW / 2, WH * 0.42);
  w.maxStage = L.goal.length - 1;
  for (let i = 0; i < 15; i++) spawn(w, true);
  return w;
}
const pr = w => PR[w.p.stage];
const edible = (w, f) => SP[f.sp].r < pr(w) * 0.95;
const danger = (w, f) => SP[f.sp].r > pr(w) * 1.0;

function pickSp(w, wantEdible) {
  const mix = w.L.mix; let tot = 0; const c = [];
  for (const k in mix) { const ok = wantEdible ? SP[k].r < pr(w) * 0.95 : true; if (!ok) continue; let wt = mix[k]; if (w.L.endless && SP[k].r > 20) wt *= k === 'macan' ? w.diff / 3 : Math.min(1.6, 0.2 + w.diff * 0.2); c.push([k, wt]); tot += wt; }
  if (!c.length) return 'teri';
  let x = w.R() * tot; for (const [k, wt] of c) { if ((x -= wt) <= 0) return k; } return c[c.length - 1][0];
}
function spawn(w, anywhere, sp) {
  const R = w.R; let edCount = 0; for (const f of w.fish) if (edible(w, f)) edCount++;
  sp = sp || pickSp(w, edCount < 7);
  const s = SP[sp], dir = R() < 0.5 ? 1 : -1;
  let x = anywhere ? 80 + R() * (WW - 160) : (dir > 0 ? -60 : WW + 60);
  if (anywhere && Math.abs(x - w.p.x) < 220) x = (x + WW / 2) % WW;
  const y = SURF + 40 + s.r + R() * (FLOOR - SURF - 80 - s.r * 2);
  const n = s.school ? 4 + Math.floor(R() * 4) : 1;
  for (let i = 0; i < n; i++) {
    w.fish.push({ id: w.id++, sp, x: x - dir * i * 18 + (R() - 0.5) * 20, y: clamp(y + (R() - 0.5) * 50, SURF + 20, FLOOR - 10), dir, v: s.spd * (0.6 + R() * 0.4), ph: R() * 6.28, vy: 0, chase: 0, cool: R() * 3, flee: 0, dead: 0 });
  }
}
function addHaz(w) {
  const R = w.R, kinds = w.L.haz; if (!kinds.length) return;
  const k = kinds[Math.floor(R() * kinds.length)], px = w.p.x;
  if (k === 'ubur') w.haz.push({ k, x: R() < 0.5 ? -40 : WW + 40, y: SURF + 120 + R() * 600, ph: R() * 6, vx: (R() < 0.5 ? 1 : -1) * 0 + 0, t: 0 }), (w.haz[w.haz.length - 1].vx = w.haz[w.haz.length - 1].x < 0 ? 38 : -38);
  else if (k === 'plastik') w.haz.push({ k, x: clamp(px + (R() - 0.5) * 700, 100, WW - 100), y: SURF - 10, vx: (R() - 0.5) * 30, ph: R() * 6, t: 0 });
  else if (k === 'jaring') { const x = clamp(px + (R() - 0.5) * 160, 180, WW - 180); w.haz.push({ k, x, wdt: 300 + w.diff * 20, depth: clamp(w.p.y + 140, 420, FLOOR - 40), t: 0, st: 'warn', trapped: [] }); w.ev.push({ e: 'boat', x }); }
  else if (k === 'bom') { const x = clamp(px + (R() - 0.5) * 220, 150, WW - 150), y = clamp(w.p.y + (R() - 0.5) * 160, SURF + 140, FLOOR - 60); w.haz.push({ k, x, y, yy: SURF, rad: 150, t: 0, st: 'sink' }); w.ev.push({ e: 'boat', x }); }
  if (!w.tips[k]) { w.tips[k] = 1; w.ev.push({ e: 'tip', k }); }
}
function inNet(h, x, y) { const top = SURF, bot = h.cur; return x > h.x - h.wdt / 2 && x < h.x + h.wdt / 2 && y > top && y < bot; }

function plunge(w, x, y1) {
  const p = w.p; p.x = x; p.y = DROP_FROM; p.dropY1 = y1; p.drop = DROP_T; p.vx = 0; p.vy = 0; p.dir = p.dir || 1; p.dying = 0; p.splashed = 0;
  p.inv = Math.max(p.inv, DROP_T + 2); p.stun = 0; p.slow = 0; p.dash = 0; w.ev.push({ e: 'plunge' });
  // the landing spot is cleared of predators
  for (const f of w.fish) if (danger(w, f) && dist2(f.x, f.y, x, y1) < 320 * 320) f.x = f.x < x ? f.x - 420 : f.x + 420;
}
/** drop / death animation; returns true while the player has no control */
function busyStep(w, dt) {
  const p = w.p;
  if (p.dying > 0) {
    p.dying -= dt; p.vx *= Math.exp(-dt * 3); p.x = clamp(p.x + p.vx * dt, 40, WW - 40); p.y = Math.max(SURF + 24, p.y - dt * 46);
    if (p.dying <= 0) { p.dying = 0; if (w.pendLose) { w.done = 'lose'; w.ev.push({ e: 'lose' }); return true; } plunge(w, WW / 2, SURF + 170); }
    return true;
  }
  if (p.drop > 0) {
    p.drop = Math.max(0, p.drop - dt); const k = 1 - p.drop / DROP_T;
    if (k < DROP_AIR) { const q = k / DROP_AIR; p.y = DROP_FROM + (SURF - DROP_FROM) * q * q; p.vy = 600; }
    else { if (!p.splashed) { p.splashed = 1; w.splash = { x: p.x, t: 0 }; w.ev.push({ e: 'splash', x: p.x }); } const q = (k - DROP_AIR) / (1 - DROP_AIR), e = 1 - (1 - q) * (1 - q); p.y = SURF + (p.dropY1 - SURF) * e; p.vy = (1 - q) * 380; }
    if (p.drop <= 0) { p.vy = 0; p.y = p.dropY1; w.ev.push({ e: 'landed' }); }
    return true;
  }
  return false;
}
function hurt(w, why) {
  const p = w.p; if (p.inv > 0 || w.done) return;
  if (p.shield > 0) { p.shield = 0; p.inv = 1.2; w.ev.push({ e: 'shieldpop' }); return; }
  w.lives--; w.deaths++; w.combo = 0; w.frenzy = 0; w.ev.push({ e: 'die', why, x: p.x, y: p.y, last: w.lives <= 0 ? 1 : 0 });
  p.trapped = null;
  // no instant cut: a death beat first (fish goes belly-up and floats), then game over or a plunge-in respawn
  p.dying = DIE_T; p.dash = 0; p.stun = 0; p.slow = 0; p.inv = DIE_T + DROP_T + 2.5; p.vy = 0;
  if (w.lives <= 0) w.pendLose = 1;
}
const L_shark = w => !!w.L.shark;
function dash(w) { const p = w.p; if (w.done || p.dashCd > 0 || p.stun > 0 || p.trapped || p.dead || p.dying > 0 || p.drop > 0) return false; p.dash = DASH.t; p.dashCd = w.L.shark ? DASH.cdShark : DASH.cd; w.dashes++; w.ev.push({ e: 'dash' }); return true; }
function eat(w, f) {
  const s = SP[f.sp], p = w.p; f.dead = 1; p.chomp = 0.22;
  w.combo = w.comboT > 0 ? w.combo + 1 : 1; w.comboT = 1.4;
  const mult = (w.combo >= 6 ? 3 : w.combo >= 3 ? 2 : 1) * (w.frenzy > 0 ? 2 : 1);
  const gain = s.pts * 10 * mult; w.score += gain; w.eaten[f.sp] = (w.eaten[f.sp] || 0) + 1;
  if (L_shark(w)) w.hunger = Math.min(1, w.hunger + 0.05 + s.pts * 0.03);
  w.grow += s.pts; w.rakus = Math.min(1, w.rakus + 0.06 + s.pts * 0.02);
  if (w.rakus >= 1 && w.frenzy <= 0) { w.frenzy = 6; w.rakus = 0; w.ev.push({ e: 'frenzy' }); }
  w.ev.push({ e: 'eat', sp: f.sp, x: f.x, y: f.y, gain, combo: w.combo });
  const g = w.L.goal;
  while (p.stage < w.maxStage && w.grow >= g[p.stage]) { p.stage++; w.ev.push({ e: 'grow', stage: p.stage }); }
  if (!w.L.endless && w.grow >= g[g.length - 1]) { w.done = 'win'; w.ev.push({ e: 'win' }); }
}

/** step(w, dt, input) input: {ax, ay} desired direction (-1..1, magnitude = throttle) */
function step(w, dt, inp) {
  if (w.done) { w.t += dt; return; }
  dt = Math.min(dt, 0.05); w.t += dt; const p = w.p, R = w.R;
  if (w.L.endless) w.diff = Math.min(10, w.t / 32);
  p.inv = Math.max(0, p.inv - dt); p.stun = Math.max(0, p.stun - dt); p.slow = Math.max(0, p.slow - dt); p.shield = Math.max(0, p.shield - dt); p.chomp = Math.max(0, p.chomp - dt); p.dash = Math.max(0, p.dash - dt); p.dashCd = Math.max(0, p.dashCd - dt);
  if (w.splash) { w.splash.t += dt; if (w.splash.t > 1.2) w.splash = null; }
  const busy = busyStep(w, dt); if (w.done) return;
  if (inp.dash && !busy) dash(w);
  if (w.L.shark && !p.trapped && !busy) { w.hunger -= dt * (0.03 + p.stage * 0.012 + w.diff * 0.002); if (w.hunger <= 0) { w.hunger = 0.6; w.ev.push({ e: 'starve' }); hurt(w, 'lapar'); if (w.done) return; } if (w.hunger < 0.25 && !w._lowTold) { w._lowTold = 1; w.ev.push({ e: 'hungry' }); } if (w.hunger > 0.45) w._lowTold = 0;
    w.mercyT = (w.mercyT || 0) - dt; if (w.hunger < 0.3 && w.mercyT <= 0) { w.mercyT = 6; const n0 = w.fish.length; spawn(w, true, 'teri'); for (let i = n0; i < w.fish.length; i++) { const f = w.fish[i], side = R() < 0.5 ? -1 : 1; f.x = clamp(p.x + side * (260 + i * 6 - n0 * 6), 40, WW - 40); f.y = clamp(p.y + (R() - 0.5) * 120, SURF + 30, FLOOR - 20); f.dir = -side; } w.ev.push({ e: 'school' }); } }
  w.comboT -= dt; if (w.comboT <= 0) w.combo = 0; w.frenzy = Math.max(0, w.frenzy - dt);
  // player
  const ms = PSPD[p.stage] * (w.L.shark ? 1.06 : 1) * (w.frenzy > 0 ? 1.25 : 1) * (p.slow > 0 ? 0.55 : 1) * (p.dash > 0 ? DASH.mul : 1);
  let ax = busy ? 0 : inp.ax || 0, ay = busy ? 0 : inp.ay || 0; const m = Math.hypot(ax, ay); if (m > 1) { ax /= m; ay /= m; }
  if (!busy) {
  if (p.stun > 0 || p.trapped) { ax = 0; ay = 0; }
  if (p.dash > 0 && Math.hypot(ax, ay) < 0.2) { const vm = Math.hypot(p.vx, p.vy); if (vm > 10) { ax = p.vx / vm; ay = p.vy / vm; } else { ax = p.dir; ay = 0; } }
  const k = 1 - Math.exp(-dt * (p.dash > 0 ? 14 : 7));
  p.vx += (ax * ms - p.vx) * k; p.vy += (ay * ms - p.vy) * k;
  if (p.trapped) { p.vx *= 0.8; p.vy *= 0.8; }
  p.x = clamp(p.x + p.vx * dt, pr(w), WW - pr(w)); p.y = clamp(p.y + p.vy * dt, SURF + pr(w) * 0.6, FLOOR - pr(w) * 0.5);
  if (Math.abs(p.vx) > 12) p.dir = p.vx > 0 ? 1 : -1;
  }
  const r = pr(w), mx = busy ? -1e5 : p.x + p.dir * r * 0.75, my = busy ? -1e5 : p.y;
  // fish
  for (const f of w.fish) {
    if (f.dead) continue; const s = SP[f.sp], fr = s.r;
    f.ph += dt * 2; f.cool -= dt;
    const d2 = dist2(f.x, f.y, p.x, p.y), isDanger = danger(w, f), isEd = edible(w, f);
    if (f.trap) continue;
    if (isDanger && s.hunter && f.chase <= 0 && f.cool <= 0 && d2 < 270 * 270 && p.inv <= 0) { f.chase = 2.6 + w.diff * 0.2; w.ev.push({ e: 'hunt', id: f.id }); }
    if (isEd && d2 < 150 * 150 && f.flee <= 0 && R() < dt * 3) f.flee = 0.9;
    let tx = f.dir * f.v, ty = Math.sin(f.ph) * 14;
    if (f.chase > 0) {
      f.chase -= dt; if (f.chase <= 0 || !isDanger) { f.chase = 0; f.cool = 4; }
      const a = Math.atan2(p.y - f.y, p.x - f.x), cs = Math.min(s.spd * 1.4, PSPD[p.stage] * (0.74 + w.diff * 0.012));
      tx = Math.cos(a) * cs; ty = Math.sin(a) * cs; f.dir = tx >= 0 ? 1 : -1;
    } else if (f.flee > 0) {
      f.flee -= dt; const a = Math.atan2(f.y - p.y, f.x - p.x); tx = Math.cos(a) * s.spd * 1.35; ty = Math.sin(a) * s.spd * 1.35; if (Math.abs(tx) > 5) f.dir = tx > 0 ? 1 : -1;
    }
    const kk = 1 - Math.exp(-dt * 3);
    f.vx = (f.vx || tx) + (tx - (f.vx || tx)) * kk; f.vy += (ty - f.vy) * kk;
    f.x += f.vx * dt; f.y = clamp(f.y + f.vy * dt, SURF + fr * 0.6, FLOOR - fr * 0.4);
    if (f.x < -120 || f.x > WW + 120) { f.dead = 2; continue; }
    // interactions
    if (p.dead || p.trapped || busy) continue;
    if (isEd) { if (dist2(f.x, f.y, mx, my) < (r * 0.78 + fr * 0.55) ** 2) eat(w, f); }
    else if (isDanger) {
      const fmx = f.x + f.dir * fr * 0.8;
      if (dist2(fmx, f.y, p.x, p.y) < (fr * 0.55 + r * 0.6) ** 2 && p.inv <= 0) { f.chase = 0; f.cool = 3; w.ev.push({ e: 'bite', sp: f.sp }); hurt(w, f.sp); }
    } else if (d2 < (fr + r) * (fr + r) * 0.5) { const a = Math.atan2(p.y - f.y, p.x - f.x); p.vx += Math.cos(a) * 80; p.vy += Math.sin(a) * 80; }
    if (w.done) break;
  }
  w.fish = w.fish.filter(f => !f.dead);
  const target = 22 + Math.floor(w.diff * 1.2); let edN = 0; for (const f of w.fish) if (edible(w, f)) edN++;
  if ((w.fish.length < target && R() < dt * 4) || (edN < 6 && R() < dt * 6)) spawn(w, false, edN < 6 ? pickSp(w, true) : null);
  // hazards
  if (w.L.haz.length) { w.hazT -= dt; if (w.hazT <= 0) { addHaz(w); w.hazT = Math.max(4.5, 11 - w.diff - (w.L.endless ? 0 : w.lv * 0.35)) + R() * 3; } }
  for (const h of w.haz) {
    h.t += dt;
    if (h.k === 'ubur') {
      h.x += h.vx * dt; h.y += Math.sin(h.t * 1.3 + h.ph) * 22 * dt;
      if (h.x < -80 || h.x > WW + 80) h.gone = 1;
      if (!p.trapped && p.stun <= 0 && p.inv <= 0 && dist2(h.x, h.y + 12, p.x, p.y) < (24 + r * 0.6) ** 2) { p.stun = 0.9; p.slow = 1.6; p.vx = -p.vx; p.vy = -p.vy; w.ev.push({ e: 'sting' }); w.combo = 0; }
    } else if (h.k === 'plastik') {
      h.y += (h.y < 300 ? 30 : 12) * dt; h.x += (h.vx + Math.sin(h.t + h.ph) * 16) * dt;
      if (h.y > FLOOR - 10 || h.t > 40) h.gone = 1;
      if (!h.hit && dist2(h.x, h.y, mx, my) < (18 + r * 0.6) ** 2) { h.hit = 1; h.gone = 1; w.grow = Math.max(p.stage ? w.L.goal[p.stage - 1] : 0, w.grow - 3); p.slow = 2.2; w.combo = 0; w.score = Math.max(0, w.score - 50); w.ev.push({ e: 'plastic', x: h.x, y: h.y }); }
    } else if (h.k === 'jaring') {
      const T1 = 2.2, T2 = T1 + 1.0, T3 = T2 + 2.6, T4 = T3 + 1.4;
      if (h.t < T1) { h.st = 'warn'; h.cur = SURF; }
      else if (h.t < T2) { h.st = 'drop'; h.cur = SURF + (h.depth - SURF) * ((h.t - T1) / (T2 - T1)); }
      else if (h.t < T3) { h.st = 'hold'; h.cur = h.depth; if (!h.closed) { h.closed = 1; for (const f of w.fish) if (inNet(h, f.x, f.y)) { f.trap = h; h.trapped.push(f); } if (inNet(h, p.x, p.y) && p.inv <= 0 && !p.trapped) { p.trapped = h; p.taps = 0; w.ev.push({ e: 'trapped' }); } } }
      else if (h.t < T4) { h.st = 'lift'; const q = (h.t - T3) / (T4 - T3); h.cur = h.depth - (h.depth - SURF + 40) * q; for (const f of h.trapped) f.y = Math.min(f.y, h.cur - 6); if (p.trapped === h) { p.y = Math.min(p.y, h.cur - 4); if (q > 0.85) hurt(w, 'jaring'); } }
      else { h.gone = 1; for (const f of h.trapped) f.dead = 1; }
      if (p.trapped === h && h.st !== 'lift' && h.st !== 'hold') p.trapped = null;
    } else if (h.k === 'bom') {
      if (h.st === 'sink') { h.yy += 260 * dt; if (h.yy >= h.y) { h.yy = h.y; h.st = 'tick'; h.t = 0; } }
      else if (h.st === 'tick' && h.t > 2.3) {
        h.st = 'boom'; h.t = 0; let killed = 0;
        for (const f of w.fish) if (dist2(f.x, f.y, h.x, h.y) < h.rad * h.rad) { f.dead = 1; killed++; }
        w.ev.push({ e: 'boom', x: h.x, y: h.y, killed });
        if (dist2(p.x, p.y, h.x, h.y) < (h.rad + r * 0.3) ** 2) hurt(w, 'bom');
      } else if (h.st === 'boom' && h.t > 0.8) h.gone = 1;
    }
  }
  w.haz = w.haz.filter(h => !h.gone);
  w.fish = w.fish.filter(f => !f.dead);
  // pickups: pearl & shield bubble
  w.pearlT -= dt; w.shieldT -= dt;
  if (w.pearlT <= 0) { w.pearlT = 18 + R() * 8; w.fx.push({ k: 'pearl', x: 120 + R() * (WW - 240), y: FLOOR - 14, t: 0 }); }
  if (w.shieldT <= 0) { w.shieldT = 34 + R() * 12; w.fx.push({ k: 'shield', x: 120 + R() * (WW - 240), y: FLOOR - 20, t: 0 }); }
  for (const o of w.fx) {
    o.t += dt; if (o.k === 'shield') o.y -= 26 * dt;
    if (o.t > 16 || o.y < SURF) o.gone = 1;
    if (!p.trapped && !busy && dist2(o.x, o.y, p.x, p.y) < (r + 16) ** 2) {
      o.gone = 1;
      if (o.k === 'pearl') { const g = 250 * (w.frenzy > 0 ? 2 : 1); w.score += g; w.ev.push({ e: 'pearl', x: o.x, y: o.y, gain: g }); }
      else { p.shield = 10; w.ev.push({ e: 'shield' }); }
    }
  }
  w.fx = w.fx.filter(o => !o.gone);
  if (w.L.endless) { w.score += 0; }
}
function tapEscape(w) { const p = w.p; if (!p.trapped) return false; p.taps++; if (p.taps >= 7) { const h = p.trapped; p.trapped = null; p.inv = 1.2; p.y = Math.max(SURF + 20, h.cur + 40); p.vy = 220; w.ev.push({ e: 'escape' }); w.score += 30; } return true; }
function stars(w) { if (w.done !== 'win') return 0; const L = w.L; return w.deaths === 0 && w.t <= L.par ? 3 : w.deaths <= 1 ? 2 : 1; }
function progress(w) { const g = w.L.goal, st = w.p.stage, lo = st ? g[st - 1] : 0, hi = g[st]; return { st, lo, hi, cur: w.grow, f: hi ? clamp((w.grow - lo) / (hi - lo), 0, 1) : 1, total: clamp(w.grow / g[g.length - 1], 0, 1) }; }

root.IRSim = { DIE_T, DROP_T, plunge, SP, ORDER, PR, PSPD, SEAS, LEVELS, ENDLESS, WW, WH, SURF, FLOOR, create, step, tapEscape, dash, DASH, HIU, edible, danger, stars, progress, pr, spawn, addHaz, hurt };
})(typeof window !== 'undefined' ? window : globalThis);

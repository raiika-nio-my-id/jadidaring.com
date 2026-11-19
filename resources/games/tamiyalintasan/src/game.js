/* Tamiya Lintasan: rules + deterministic sim (global TL). Track = rounded-rectangle 3-lane circuit; every corner has a
   timing window. Tap in the window = PAS (keeps speed), near it = OKE, missed/early = TERPENTAL (big slowdown) and,
   when the car is faster than its stability limit, COURSE OUT (flies off, back after 1.5 s). Fixed 60 Hz steps. */
(function (root) {
'use strict';
const DT = 1 / 60, LAPS = 3;
// centerline geometry (world units): long straight A, short straight B, corner radius RC; lane spacing LW
const A = 16, B = 5, RC = 4, LW = 1.25, ARC = Math.PI / 2 * RC;
const LAP = 2 * A + 2 * B + 4 * ARC;
const SEG = []; // {s0, len, k:'S'|'C', ...geometry}
(function build() {
  let s = 0; const add = o => { o.s0 = s; s += o.len; SEG.push(o); };
  const hy = B / 2 + RC, hx = A / 2 + RC;
  add({ k: 'S', len: A / 2, x0: 0, y0: -hy, dx: 1, dy: 0 });
  add({ k: 'C', len: ARC, cx: A / 2, cy: -B / 2, a0: -Math.PI / 2, n: 0 });
  add({ k: 'S', len: B, x0: hx, y0: -B / 2, dx: 0, dy: 1 });
  add({ k: 'C', len: ARC, cx: A / 2, cy: B / 2, a0: 0, n: 1 });
  add({ k: 'S', len: A, x0: A / 2, y0: hy, dx: -1, dy: 0, lc: 1 });
  add({ k: 'C', len: ARC, cx: -A / 2, cy: B / 2, a0: Math.PI / 2, n: 2 });
  add({ k: 'S', len: B, x0: -hx, y0: B / 2, dx: 0, dy: -1 });
  add({ k: 'C', len: ARC, cx: -A / 2, cy: -B / 2, a0: Math.PI, n: 3 });
  add({ k: 'S', len: A / 2, x0: -A / 2, y0: -hy, dx: 1, dy: 0 });
})();
const CORNERS = SEG.filter(g => g.k === 'C').map(g => g.s0);
const LC = (() => { const g = SEG.find(x => x.lc); return { a: g.s0 + A / 2 - 3.5, b: g.s0 + A / 2 + 3.5 }; })(); // lane changer bridge
const TGT = 0.35; // perfect tap point = this far before the corner entry
const TRACKS = [
  { id: 'datar', n: 'Sirkuit Datar', e: '🏁', sub: 'Mulus, lurus panjang. Kecepatan raja.', z: [] },
  { id: 'gelombang', n: 'Sirkuit Gelombang', e: '🌊', sub: 'Jalur bergelombang di sisi pendek. Ban spons paling stabil.', z: [{ a: SEG[2].s0 + 0.6, b: SEG[2].s0 + B - 0.6, t: 'wave' }, { a: SEG[6].s0 + 0.6, b: SEG[6].s0 + B - 0.6, t: 'wave' }, { a: SEG[0].s0 + 1.5, b: SEG[0].s0 + 5.5, t: 'wave' }] },
  { id: 'tanjakan', n: 'Sirkuit Tanjakan', e: '⛰️', sub: 'Jembatan lane changer jadi tanjakan curam. Dinamo torsi kuat nanjak.', z: [{ a: LC.a - 2.5, b: (LC.a + LC.b) / 2, t: 'up' }, { a: (LC.a + LC.b) / 2, b: LC.b + 1.5, t: 'down' }, { a: SEG[8].s0 + 1, b: SEG[8].s0 + 4, t: 'up' }, { a: SEG[8].s0 + 4, b: SEG[8].s0 + 7, t: 'down' }] },
];
const DINAMO = [
  { id: 'torsi', n: 'Dinamo Torsi', e: '💪', vmax: 11.6, acc: 10.5, w: 1.05, sub: 'Bangkit cepat, top speed sedang' },
  { id: 'atomik', n: 'Dinamo Atomik', e: '⚛️', vmax: 12.6, acc: 7.8, w: 1.0, sub: 'Seimbang, cocok semua lintasan' },
  { id: 'rev', n: 'Dinamo Rev', e: '🌀', vmax: 13.6, acc: 6.0, w: 0.94, sub: 'Ngacir di lurus, lambat bangkit' },
  { id: 'hyper', n: 'Dinamo Hyper', e: '⚡', vmax: 14.6, acc: 5.8, w: 0.8, sub: 'Paling kencang, tikungan galak' },
];
const ROLLER = [
  { id: 'plastik', n: 'Roller Plastik', e: '⚪', w: 0.95, ck: 0.98, co: 0.97, sub: 'Licin di tikungan, jendela sempit' },
  { id: 'bearing', n: 'Roller Bearing', e: '⚙️', w: 1.0, ck: 0.92, co: 1.0, sub: 'Seimbang' },
  { id: 'karet', n: 'Roller Karet', e: '🟠', w: 1.15, ck: 0.83, co: 1.08, sub: 'Nempel dinding, jendela lebar, agak ngerem' },
];
const BAN = [
  { id: 'slick', n: 'Ban Karet Slick', e: '⚫', v: 1.0, wave: 0.8, up: 1.0, w: 1.0, co: 1.0, sub: 'Juara di lintasan datar' },
  { id: 'spons', n: 'Ban Spons', e: '🧽', v: 0.97, wave: 0.99, up: 1.1, w: 1.0, co: 1.03, sub: 'Redam gelombang, cengkeram tanjakan' },
  { id: 'low', n: 'Ban Low-Friction', e: '🔷', v: 1.05, wave: 0.74, up: 0.82, w: 0.92, co: 0.95, sub: 'Paling licin & kencang, gampang terpental' },
];
const CHASSIS = [
  { id: 'kilat', n: 'Kilat Biru', col: '#2f7de1', col2: '#ffd23f' },
  { id: 'garuda', n: 'Garuda Merah', col: '#e23b3b', col2: '#ffffff' },
  { id: 'banteng', n: 'Banteng Kuning', col: '#f5b301', col2: '#1d1d1d' },
  { id: 'cendra', n: 'Cendrawasih', col: '#19a974', col2: '#ff8a1f' },
];
const byId = (L, id, d) => L.find(x => x.id === id) || L[d || 0];
const CO_BASE = 11.6, WIN_BASE = 3.4;
function spec(cfg) {
  cfg = cfg || {}; const d = byId(DINAMO, cfg.din, 1), r = byId(ROLLER, cfg.rol, 1), b = byId(BAN, cfg.ban, 0);
  return { din: d.id, rol: r.id, ban: b.id, vmax: d.vmax * b.v, acc: d.acc, win: WIN_BASE * d.w * r.w * b.w, ck: r.ck, coV: CO_BASE * r.co * b.co, wave: b.wave, up: b.up };
}
function trackOf(id) { return byId(TRACKS, id, 0); }
function zoneAt(tr, s) { const q = ((s % LAP) + LAP) % LAP; for (const z of tr.z) if (q >= z.a && q < z.b) return z.t; return null; }
// stat bars 0..1 for the garage
function stats(cfg, trackId) {
  const sp = spec(cfg), tr = trackOf(trackId), ideal = simIdeal(sp, tr.id).tot;
  return { top: (sp.vmax - 10.5) / 5, acc: (sp.acc - 5) / 6, win: (sp.win - 2) / 2.6, stab: (sp.coV - 10.8) / 4, ideal };
}
function rng(seed) { let a = seed >>> 0 || 1; return () => { a ^= a << 13; a >>>= 0; a ^= a >> 17; a ^= a << 5; a >>>= 0; return a / 4294967296; }; }

class Run {
  constructor(sp, trackId, opts) {
    opts = opts || {}; this.sp = sp; this.tr = trackOf(trackId); this.laps = opts.laps || LAPS; this.total = this.laps * LAP;
    this.t = -3000; this.s = 0; this.v = 0; this.on = null; this.foul = false; this.ci = 0; this.tap = null; this.res = []; this.pend = null;
    this.co = 0; this.coS = 0; this.lapT = []; this.fin = null; this.ev = []; this.cnt = { p: 0, g: 0, m: 0, co: 0 }; this.top = 0; this.bump = 0; this.boost = 0;
  }
  target(i) { return Math.floor(i / 4) * LAP + CORNERS[i % 4] - TGT; }
  nCorners() { return this.laps * 4; }
  press() { // returns a verdict string or null; sim applies at next step
    if (this.fin !== null) return null;
    if (this.on === null) { if (this.t < 0) { this.foul = true; this.on = 1000; this.ev.push(['foul', this.t]); return 'foul'; } this.on = this.t; this.v = this.t < 260 ? 3.2 : 0; this.ev.push([this.t < 260 ? 'jet' : 'go', this.t]); return this.t < 260 ? 'jet' : 'go'; }
    if (this.co > 0 || this.ci >= this.nCorners() || this.pend) return null;
    const tg = this.target(this.ci), d = this.s - tg, hw = this.sp.win / 2;
    if (d < -hw - 2.6) return null; // nowhere near a corner: ignore
    let g; if (Math.abs(d) <= hw * 0.36) g = 'p'; else if (Math.abs(d) <= hw) g = 'g'; else g = 'm';
    this.pend = g; this.ev.push([g === 'm' ? 'early' : g, this.t, this.ci]); return g === 'm' ? 'early' : g;
  }
  step(dt) {
    const ms = dt * 1000; this.t += ms; if (this.fin !== null) return;
    if (this.on === null && this.t >= 1300) { this.on = this.t; this.ev.push(['late', this.t]); }
    if (this.on === null || this.t < this.on) return;
    if (this.co > 0) { this.co -= ms; if (this.co <= 0) { this.co = 0; this.s = this.coS; this.v = 0; this.ev.push(['back', this.t]); } return; }
    const sp = this.sp, z = zoneAt(this.tr, this.s); let vm = sp.vmax * (1 + this.boost);
    if (z === 'wave') { vm *= sp.wave; this.bump = 1; } else this.bump = 0;
    let a = sp.acc * (1 - this.v / vm);
    if (z === 'up') a -= 6.5 / sp.up; else if (z === 'down') a += 4;
    // corner: drift toward the corner speed cap
    const q = ((this.s % LAP) + LAP) % LAP, inC = SEG.some(g => g.k === 'C' && q >= g.s0 && q < g.s0 + g.len);
    if (inC) { const cap = vm * (sp.ck + (this.lastG === 'p' ? 0.05 : 0)); if (this.v > cap) a = Math.min(a, -(this.v - cap) * 3.5); }
    this.v = Math.max(z === 'up' ? Math.min(this.v, 2.2) : 0, Math.min(vm * (z === 'down' ? 1.12 : 1.02), this.v + a * dt)); if (this.boost > 0) this.boost = Math.max(0, this.boost - dt * 0.08);
    this.top = Math.max(this.top, this.v);
    const ps = this.s; this.s += this.v * dt;
    // corner judge: once the car passes the window end (or reaches it with a pending verdict)
    while (this.ci < this.nCorners()) {
      const tg = this.target(this.ci), hw = this.sp.win / 2;
      const due = this.pend === 'm' ? this.s >= tg + TGT : this.pend ? true : this.s > tg + hw;
      if (!due) break;
      this.judge(this.pend || 'm'); if (this.co > 0) break;
    }
    // laps
    const lp = Math.floor(ps / LAP), ln = Math.floor(this.s / LAP);
    if (ln > lp && ln <= this.laps) { this.lapT.push(this.t - (this.lapT.length ? this.lapT.reduce((x, y) => x + y, 0) : 0)); }
    if (this.s >= this.total) { this.s = this.total; this.fin = this.t; this.ev.push(['fin', this.t]); }
  }
  judge(g) {
    const i = this.ci; this.ci++; this.pend = null; this.lastG = g; this.res.push(g);
    if (g === 'p') { this.cnt.p++; this.boost = Math.min(0.06, this.boost + 0.03); this.ev.push(['P', this.t, i]); return; }
    if (g === 'g') { this.cnt.g++; this.v *= 0.9; this.ev.push(['G', this.t, i]); return; }
    this.boost = 0;
    if (this.v > this.sp.coV) { this.cnt.co++; this.co = 1500; this.coS = Math.floor(i / 4) * LAP + CORNERS[i % 4] + 0.5; this.coAt = this.s; this.ev.push(['CO', this.t, i, this.s]); this.v = 0; return; }
    this.cnt.m++; this.v *= 0.42; this.ev.push(['M', this.t, i]);
  }
  lane0() { return 0; }
  summary() { const tot = this.fin; let best = null; for (const x of this.lapT) if (best === null || x < best) best = x; return { tot, laps: this.lapT.slice(), best, foul: this.foul, top: this.top, cnt: Object.assign({}, this.cnt) }; }
}
// bot brain: per-corner tap error from a seeded rng; skill 0..1
function botBrain(skill, seed) {
  const r = rng(seed), err = [], start = 120 + r() * 380 * (1.2 - skill);
  for (let i = 0; i < 64; i++) { const u = r() + r() + r() - 1.5; const blunder = r() < 0.07 * (1 - skill); err.push(blunder ? (r() < 0.5 ? 9999 : -330 - r() * 200) : u * (0.06 + (1 - skill) * 0.34) * 1000); }
  return { skill, start, err };
}
function driveBot(run, br) {
  if (run.on === null) { if (run.t >= br.start) run.press(); return; }
  if (run.pend || run.co > 0 || run.ci >= run.nCorners()) return;
  const e = br.err[run.ci % br.err.length]; if (e > 5000) return; // blunder: never taps
  if (run.s >= run.target(run.ci) + e / 1000 * Math.max(run.v, 4)) run.press();
}
function simBot(sp, trackId, skill, seed, laps) { const run = new Run(sp, trackId, { laps }), br = botBrain(skill, seed); while (run.fin === null && run.t < 90000) { driveBot(run, br); run.step(DT); } return run; }
function simIdeal(sp, trackId, laps) { const run = new Run(sp, trackId, { laps }); while (run.fin === null && run.t < 90000) { if (run.on === null) { if (run.t >= 100) run.press(); } else if (!run.pend && run.ci < run.nCorners() && run.s >= run.target(run.ci)) run.press(); run.step(DT); } return { tot: run.fin, run }; }
const BOTS = [
  { n: 'Ucup Dinamo', cfg: { din: 'torsi', rol: 'karet', ban: 'spons', ch: 'banteng' }, skill: 0.45 },
  { n: 'Mbak Sri', cfg: { din: 'atomik', rol: 'bearing', ban: 'slick', ch: 'cendra' }, skill: 0.6 },
  { n: 'Koh Ahong', cfg: { din: 'rev', rol: 'bearing', ban: 'slick', ch: 'kilat' }, skill: 0.7 },
  { n: 'Bang Jago', cfg: { din: 'hyper', rol: 'karet', ban: 'spons', ch: 'garuda' }, skill: 0.78 },
  { n: 'Dek Rara', cfg: { din: 'atomik', rol: 'karet', ban: 'spons', ch: 'cendra' }, skill: 0.55 },
  { n: 'Pak RT', cfg: { din: 'torsi', rol: 'bearing', ban: 'slick', ch: 'banteng' }, skill: 0.5 },
  { n: 'Raja Lintasan', cfg: { din: 'hyper', rol: 'bearing', ban: 'low', ch: 'kilat' }, skill: 0.88 },
];
// position on centerline for distance s, lateral offset off (outward +); returns x,y,ang (radians)
function pos(s, off) {
  const q = ((s % LAP) + LAP) % LAP; let g = SEG[SEG.length - 1];
  for (const x of SEG) if (q < x.s0 + x.len) { g = x; break; }
  const u = q - g.s0;
  if (g.k === 'S') { const nx = g.dy * -1, ny = g.dx; return { x: g.x0 + g.dx * u - nx * off, y: g.y0 + g.dy * u - ny * off, a: Math.atan2(g.dy, g.dx) }; }
  const a = g.a0 + u / RC, r = RC + off; return { x: g.cx + Math.cos(a) * r, y: g.cy + Math.sin(a) * r, a: a + Math.PI / 2 };
}
// lane at distance s for a car that started in lane L0 (0 inner .. 2 outer); the bridge rotates lanes once per lap
function laneOff(s, L0) {
  const lapN = Math.floor(s / LAP), q = s - lapN * LAP, k = lapN + (q >= LC.b ? 1 : 0), cur = (L0 + k) % 3;
  const offOf = l => (l - 1) * LW;
  if (q >= LC.a && q < LC.b) { const prev = (L0 + lapN) % 3, nxt = (prev + 1) % 3, f = (q - LC.a) / (LC.b - LC.a), e = f * f * (3 - 2 * f); return { off: offOf(prev) + (offOf(nxt) - offOf(prev)) * e, up: Math.sin(f * Math.PI) * (prev === 2 ? 1 : 0.25) }; }
  return { off: offOf(cur), up: 0 };
}
const rank = (a, b) => (a.tot == null) - (b.tot == null) || (a.tot || 0) - (b.tot || 0);
const kmh = v => Math.round(v * 4.3);
root.TL = { DT, LAPS, LAP, A, B, RC, LW, ARC, SEG, CORNERS, LC, TGT, TRACKS, DINAMO, ROLLER, BAN, CHASSIS, BOTS, spec, stats, trackOf, zoneAt, Run, botBrain, driveBot, simBot, simIdeal, pos, laneOff, rank, kmh, rng, byId };
if (typeof module !== 'undefined') module.exports = root.TL;
})(typeof window !== 'undefined' ? window : globalThis);

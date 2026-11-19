/* Drag 201: pure race sim (no DOM). One Run = one bike on a 201 m strip.
   Time t is ms since the GREEN light (negative while staging). Same code drives the player, bots and replays. */
(function (root) {
'use strict';
const DIST = 201, DT = 10;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
/* Bikes: vg = gear top speeds (m/s at redline), k = thrust constant, red = redline rpm. Generic classes, no brands. */
const BIKES = [
  { id: 'bebek4', name: 'Bebek 4T 130', cls: 'Bebek 4 Tak', price: 0, red: 11000, vg: [13, 20, 26.5, 32], k: 118, cd: 0.0021, col: '#e8463a', col2: '#f7f1e3' },
  { id: 'matic', name: 'Matic 125 CVT', cls: 'Matic', price: 350, red: 9500, vg: [12, 16.5, 21, 25.5, 30], k: 112, cd: 0.0022, col: '#ff5fa2', col2: '#f7f1e3', cvt: 1 },
  { id: 'bebek2', name: 'Bebek 2T 125', cls: 'Bebek 2 Tak', price: 900, red: 12500, vg: [14, 21.5, 28, 34.5], k: 132, cd: 0.002, col: '#2f7de1', col2: '#ffd23f' },
  { id: 'sport', name: 'Sport 150 2T', cls: 'Sport 150', price: 2600, red: 13000, vg: [13.5, 19.5, 25, 30.5, 35.5, 40], k: 150, cd: 0.0019, col: '#1fa35b', col2: '#111' },
  { id: 'camp', name: 'Campuran 250 2T', cls: 'Campuran 250', price: 6000, red: 12000, vg: [15, 22, 28.5, 34, 39.5, 44.5], k: 176, cd: 0.0018, col: '#8f3bd6', col2: '#ff8a1f' }
];
/* Tuning parts, level 0..5 each (per bike) */
const PARTS = [
  { id: 'mesin', icon: '⚙️', cost: [120, 220, 350, 500, 700] },   // +3.2% thrust / lvl
  { id: 'knalpot', icon: '💨', cost: [100, 190, 300, 430, 600] }, // +1.8% thrust, +1.5% top / lvl
  { id: 'gir', icon: '🔩', cost: [90, 170, 260, 380, 520] },     // shorter low gears: +2.5% thrust in 1-2
  { id: 'ban', icon: '🛞', cost: [80, 150, 240, 350, 480] }       // launch grip: wider sweet band, less spin
];
function spec(bikeId, tune) {
  const b = BIKES.find(x => x.id === bikeId) || BIKES[0], t = Object.assign({ mesin: 0, knalpot: 0, gir: 0, ban: 0 }, tune || {});
  const top = 1 + 0.015 * t.knalpot, k = b.k * (1 + 0.032 * t.mesin + 0.018 * t.knalpot);
  return { id: b.id, name: b.name, red: b.red, vg: b.vg.map(v => v * top), k, cd: b.cd, low: 1 + 0.025 * t.gir, grip: t.ban | 0, col: b.col, col2: b.col2, cvt: b.cvt ? 1 : 0 };
}
/* torque curve, x = rpm / redline */
function torque(x) { if (x < 0.25) return 0.3 + x * 1.4; if (x < 0.78) return 0.65 + (x - 0.25) / 0.53 * 0.35; return 1 - (x - 0.78) * 1.25; }
/* shift windows (rpm ratio at the moment of shifting) */
const SHIFT = { perfect: [0.9, 0.975], good: [0.8, 0.9] };
const LAUNCH = { sweet: [0.55, 0.72] };
function launchBand(grip) { return [LAUNCH.sweet[0] - grip * 0.012, LAUNCH.sweet[1] + grip * 0.016]; }

class Run {
  constructor(sp) {
    this.sp = sp; this.t = -4000; this.d = 0; this.v = 0; this.g = 0; this.rpm = 0.12; this.gas = false; this.launched = false; this.rt = null;
    this.foul = false; this.fin = null; this.shiftT = 0; this.slip = 0; this.spin = 0; this.wheelie = 0; this.lim = 0; this.boost = 0;
    this.ev = []; this.marks = []; this.topV = 0; this.nos = 1; this.nosT = 0; this.perf = 0; this.shifts = 0;
  }
  ratio() { return this.sp.vg[this.g]; }
  /** hold/release gas during staging */
  setGas(on) { this.gas = !!on; }
  /** tap: launch (staging) or shift up */
  tap() {
    if (this.fin !== null) return null;
    if (!this.launched) return this.launch();
    return this.shift();
  }
  launch() {
    this.launched = true; this.rt = this.t; if (this.t < 0) this.foul = true;
    const band = launchBand(this.sp.grip), r = this.rpm; let q;
    if (r >= band[0] && r <= band[1]) { q = 'perfect'; this.slip = 0.45; this.perf++; }
    else if (r > band[1]) { q = r > 0.86 ? 'spin' : 'good'; this.spin = q === 'spin' ? 0.75 - this.sp.grip * 0.06 : 0.25; this.wheelie = q === 'spin' ? 1 : 0.4; }
    else { q = r < 0.38 ? 'bog' : 'good'; }
    this.lq = q; this.launchRpm = r; this.ev.push(['launch', this.t, q]); return q;
  }
  /** engine speed the road allows (ignores wheelspin flare) */
  road() { return clamp(this.v / this.ratio(), 0, 1); }
  shift() {
    if (this.shiftT > 0 || this.sp.cvt) return null;
    const x = Math.min(this.rpm, this.slip > 0 || this.spin > 0 ? this.road() + 0.04 : 1), last = this.g >= this.sp.vg.length - 1; if (last) return null;
    let q = x >= SHIFT.perfect[0] && x <= SHIFT.perfect[1] ? 'perfect' : x > SHIFT.perfect[1] ? 'late' : x >= SHIFT.good[0] ? 'good' : 'early';
    if (q === 'late' && this.lim < 120) q = 'good';
    this.g++; this.shifts++; this.shiftT = q === 'perfect' ? 90 : q === 'good' ? 140 : 190;
    if (q === 'perfect') { this.boost = 380; this.perf++; }
    this.lim = 0; this.ev.push(['shift', this.t, q, this.g]); this.marks.push(q); return q;
  }
  useNos() { if (!this.launched || this.fin !== null || this.nos <= 0 || this.nosT > 0) return false; this.nos--; this.nosT = 1400; this.ev.push(['nos', this.t]); return true; }
  step(ms) {
    for (let left = ms; left > 0; left -= DT) this.tick(Math.min(DT, left) / 1000);
  }
  tick(dt) {
    const sp = this.sp; this.t += dt * 1000;
    if (this.foul) { this.v = Math.max(0, this.v - 30 * dt); this.d = Math.min(this.d + this.v * dt, 1.5); this.rpm = Math.max(0.12, this.rpm - dt * 1.2); this.wheelie = 0; return; } // t365u: jump start = DQ, bike stays on the line
    if (this.fin !== null) { this.v = Math.max(0, this.v - 9 * dt); this.d += this.v * dt; this.rpm = Math.max(0.15, this.rpm - dt * 0.8); return; }
    if (!this.launched) {
      const target = this.gas ? 1.02 : 0.12; this.rpm += (target - this.rpm) * dt * (this.gas ? 1.6 : 3.2);
      if (this.rpm > 1) this.rpm = 0.96 + Math.random() * 0.04;
      return;
    }
    const vg = this.ratio();
    let rpm = clamp(this.v / vg, 0, 1.0);
    if (this.slip > 0) { this.slip -= dt; rpm = Math.max(rpm, this.launchRpm * 0.95); }
    if (this.shiftT > 0) { this.shiftT -= dt * 1000; this.rpm += (Math.max(rpm, 0.2) - this.rpm) * dt * 14; }
    else this.rpm = Math.max(rpm, this.rpm > rpm && this.spin > 0 ? this.rpm : rpm);
    if (this.rpm < 0.18 && this.g === 0) this.rpm = Math.max(this.rpm, (this.launchRpm || 0.3) * 0.7);
    // CVT (matic): the belt changes ratio by itself, no shift skill (and no PERFECT bonus)
    if (sp.cvt && this.shiftT <= 0 && this.slip <= 0 && this.g < sp.vg.length - 1 && this.rpm >= 0.93) { this.g++; this.shiftT = 45; }
    let thrust = 0;
    if (this.shiftT <= 0) {
      const x = clamp(this.rpm, 0, 1); thrust = sp.k * torque(x) / vg;
      if (this.g < 2) thrust *= sp.low;
      if (this.rpm >= 0.995) { thrust = 0; this.lim += dt * 1000; }
      if (this.spin > 0) { this.spin -= dt; thrust *= 0.6; }
      if (this.boost > 0) { this.boost -= dt * 1000; thrust *= 1.06; }
      if (this.nosT > 0) { this.nosT -= dt * 1000; thrust *= 1.22; }
      if (this.lq === 'bog' && this.t - this.rt < 600) thrust *= 0.7;
    }
    const a = thrust - sp.cd * this.v * this.v - 0.25;
    this.v = Math.max(0, this.v + a * dt); this.d += this.v * dt; this.topV = Math.max(this.topV, this.v);
    this.wheelie = Math.max(0, this.wheelie - dt * (this.spin > 0 ? 0.6 : 2.2)); if (this.g === 0 && this.t - this.rt < 500 && this.lq === 'perfect') this.wheelie = Math.max(this.wheelie, 0.25);
    if (this.d >= DIST) { this.fin = this.t; this.et = this.t - this.rt; this.ev.push(['fin', this.t]); }
  }
  /** total time from green to the line (what decides the race); fouls lose */
  total() { return this.fin === null ? null : this.fin; }
  summary() { return { rt: Math.round(this.rt), et: this.fin === null ? null : Math.round(this.fin - this.rt), tot: this.fin === null ? null : Math.round(this.fin), top: Math.round(this.topV * 3.6), foul: this.foul ? 1 : 0, perf: this.perf, lq: this.lq || '', marks: this.marks.slice() }; }
}

/* Deterministic bot driver (same on every device for a given seed) */
function botBrain(skill, seed) {
  const r = rng(seed); skill = clamp(skill, 0, 1);
  const rt = 90 + (1 - skill) * 300 + r() * 120 * (1.2 - skill);
  const launch = 0.6 + (r() - 0.5) * (0.4 - skill * 0.3);
  const shifts = Array.from({ length: 6 }, () => 0.935 + (r() - 0.55) * (0.22 - skill * 0.17));
  const nosAt = skill > 0.45 ? 1 + Math.floor(r() * 3) : -1;
  return { rt, launch, shifts, nosAt };
}
function driveBot(run, brain) {
  if (!run.launched) { run.setGas(run.rpm < brain.launch); if (run.t >= brain.rt) run.launch(); return; }
  if (run.fin !== null) return;
  if (run.shiftT <= 0 && run.g < run.sp.vg.length - 1 && run.rpm >= Math.min(0.985, brain.shifts[run.g])) run.shift();
  if (brain.nosAt >= 0 && run.g === brain.nosAt && run.nos > 0) run.useNos();
}
/** simulate a bot to the line (used for previews / tests) */
function simBot(sp, skill, seed) { const r = new Run(sp), b = botBrain(skill, seed); while (r.fin === null && r.t < 30000) { driveBot(r, b); r.step(DT); } return r; }
/** perfect-ish reference run for a spec (launch in band, all shifts at 0.94) */
function simIdeal(sp) { const r = new Run(sp); const b = { rt: 150, launch: (launchBand(sp.grip)[0] + launchBand(sp.grip)[1]) / 2, shifts: [0.94, 0.94, 0.94, 0.94, 0.94, 0.94], nosAt: 2 }; while (r.fin === null && r.t < 30000) { driveBot(r, b); r.step(DT); } return r; }

/* Career: 10 rivals on the official circuit */
const RIVALS = [
  { n: 'Ucup Karbu', bike: 'bebek4', tune: {}, skill: 0.15, pay: 120 },
  { n: 'Mbak Rara', bike: 'bebek4', tune: { mesin: 1, ban: 1 }, skill: 0.35, pay: 150 },
  { n: 'Bang Jali', bike: 'bebek2', tune: { mesin: 1 }, skill: 0.3, pay: 180 },
  { n: 'Koh Ahong', bike: 'bebek2', tune: { mesin: 2, knalpot: 2, ban: 1 }, skill: 0.5, pay: 220 },
  { n: 'Teh Euis', bike: 'bebek2', tune: { mesin: 3, knalpot: 3, gir: 2, ban: 2 }, skill: 0.6, pay: 260 },
  { n: 'Mas Bowo', bike: 'sport', tune: { mesin: 1, knalpot: 1 }, skill: 0.5, pay: 320 },
  { n: 'Daeng Rudi', bike: 'sport', tune: { mesin: 3, knalpot: 2, gir: 2, ban: 2 }, skill: 0.65, pay: 380 },
  { n: 'Uda Fikri', bike: 'sport', tune: { mesin: 5, knalpot: 4, gir: 3, ban: 3 }, skill: 0.75, pay: 450 },
  { n: 'Bli Komang', bike: 'camp', tune: { mesin: 3, knalpot: 3, gir: 3, ban: 3 }, skill: 0.8, pay: 600 },
  { n: 'Raja Sirkuit', bike: 'camp', tune: { mesin: 5, knalpot: 5, gir: 5, ban: 5 }, skill: 0.86, pay: 1000 }
];
const BOT_NAMES = ['Ucup', 'Rara', 'Jali', 'Euis', 'Bowo', 'Komang'];
root.D201 = { DIST, DT, BIKES, PARTS, RIVALS, BOT_NAMES, SHIFT, LAUNCH, launchBand, spec, torque, Run, botBrain, driveBot, simBot, simIdeal, rng, clamp };
})(typeof window !== 'undefined' ? window : globalThis);

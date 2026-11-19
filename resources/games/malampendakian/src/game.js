/* Malam Pendakian: deterministic mountain-night sim (map from seed, hikers, folklore entities, director, bots, snapshots).
   Shared by solo, the online host (authoritative), online clients (pred = movement-only) and the node tests. */
(function (root) {
'use strict';
const CFG = {
  W: 30, H: 330, speed: 2.2, r: 0.3, batMax: 100, drain: 0.95, batPick: 40, give: 25, lampCharge: 7,
  light: { range: 6.6, half: 0.5 }, amb: 1.8, lampR: 3.6,
  fear: { dark: 3.4, lit: 0.7, team: -4.2, lamp: -16, pocong: 9, kunti: 7, touch: 34, swoop: 38 },
  reviveT: 2.4, selfMul: 0.4, allDownLose: 12, fogTime: 450, posBonus: 40, botWait: 8,
  pocong: { speed: 1.35, banish: 2.3, aura: 4, life: 70 }, kunti: { stay: 5, banish: 1.2, aura: 5 },
  grace: 20, gap: [10, 5.5], winR: 3.2, winHold: 2, stars: [0.62, 0.8]
};
const COLORS = ['#e8573c', '#2f9fd8', '#f2b632', '#59b85a', '#b46ad9', '#e7779f'];
function mulberry(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const r2 = v => Math.round(v * 100) / 100;
const angDiff = (a, b) => { let d = a - b; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; };
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

/* ---------- map ---------- */
const mapCache = new Map();
function genMap(seed) {
  seed = seed >>> 0; if (mapCache.has(seed)) return mapCache.get(seed);
  const R = mulberry(seed), W = CFG.W, H = CFG.H, top = 5, bot = H - 8, mid = W / 2;
  const p1 = R() * 6.28, p2 = R() * 6.28, p3 = R() * 6.28, f1 = 0.06 + R() * 0.02, f2 = 0.15 + R() * 0.05;
  const tx = new Float32Array(H);
  for (let y = 0; y < H; y++) {
    let x = mid + 8.2 * Math.sin(y * f1 + p1) + 2.4 * Math.sin(y * f2 + p2) + 0.8 * Math.sin(y * 0.41 + p3);
    const blend = y > bot - 6 ? clamp((y - (bot - 6)) / 6, 0, 1) : y < top + 6 ? clamp((top + 6 - y) / 6, 0, 1) : 0;
    tx[y] = clamp(x * (1 - blend) + mid * blend, 4.2, W - 4.2);
  }
  const bl = new Uint8Array(W * H), at = (x, y) => y * W + x;
  const fy = f => Math.round(bot - (bot - top) * f);
  const camp = { x: mid, y: bot + 2 }, shrine = { x: mid, y: top + 0.5 };
  const pos = [0.25, 0.5, 0.75].map((f, i) => { const y = fy(f); return { i, x: tx[y], y: y + 0.5, f }; });
  const clearAt = (x, y) => Math.abs(x + 0.5 - tx[y]) < 2.0 || (y >= bot - 2 && Math.abs(x + 0.5 - mid) < 5.5) || (y <= top + 3 && Math.abs(x + 0.5 - mid) < 4.5) || pos.some(p => Math.hypot(x + 0.5 - p.x, y + 0.5 - p.y) < 2.8);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (x === 0 || x === W - 1 || y < 1 || y > H - 2) { bl[at(x, y)] = 1; continue; }
    if (clearAt(x, y)) continue;
    const d = Math.abs(x + 0.5 - tx[y]); if (R() < (d < 3 ? 0.3 : 0.5)) bl[at(x, y)] = 1;
  }
  const trees = [], rocks = [], ferns = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (bl[at(x, y)]) trees.push({ x: x + 0.5 + (R() - 0.5) * 0.3, y: y + 0.5 + (R() - 0.5) * 0.3, v: (R() * 3) | 0, s: 0.85 + R() * 0.4, p: R() * 6.28 });
  for (let i = 0; i < 380; i++) { const y = 2 + R() * (H - 4), x = 1 + R() * (W - 2); if (!bl[at(x | 0, y | 0)]) (R() < 0.45 ? rocks : ferns).push({ x, y, s: 0.5 + R() * 0.6, p: R() * 6.28 }); }
  const rib = [];
  for (let y = bot - 5; y > top + 3; y -= 7) {
    const side = R() < 0.5 ? -1 : 1; let best = null;
    for (const sd of [side, -side]) { for (let k = 2; k < 5 && !best; k++) { const cx = Math.floor(tx[y] + sd * k); if (cx > 0 && cx < W - 1 && bl[at(cx, y)]) best = { x: cx + 0.5 - sd * 0.42, y: y + 0.5, s: sd }; } if (best) break; }
    rib.push(best || { x: tx[y] + side * 1.6, y: y + 0.5, s: side });
  }
  const bat = [];
  for (let k = 0; k < 24; k++) {
    const y = Math.round(bot - 8 - (bot - top - 14) * (k + R() * 0.6) / 24); let ok = null;
    for (let tries = 0; tries < 10 && !ok; tries++) { const x = tx[y] + (R() < 0.5 ? -1 : 1) * (0.9 + R() * 1.6); if (x > 1.5 && x < W - 1.5 && !bl[at(x | 0, y)]) ok = { x: r2(x), y: y + 0.5 }; }
    bat.push(ok || { x: r2(tx[y]), y: y + 0.5 });
  }
  const m = { seed, W, H, top, bot, tx, bl, camp, shrine, pos, rib, bat, trees, rocks, ferns };
  if (mapCache.size > 6) mapCache.clear(); mapCache.set(seed, m); return m;
}
function solidCell(m, cx, cy) { if (cx < 0 || cy < 0 || cx >= m.W || cy >= m.H) return true; return !!m.bl[cy * m.W + cx]; }
function collides(m, x, y, r) {
  if (x < 0.6 || x > m.W - 0.6 || y < 1.2 || y > m.H - 1.2) return true;
  const cx = Math.floor(x), cy = Math.floor(y);
  for (let j = cy - 1; j <= cy + 1; j++) for (let i = cx - 1; i <= cx + 1; i++) if (solidCell(m, i, j) && Math.hypot(x - (i + 0.5), y - (j + 0.5)) < 0.4 + r) return true;
  return false;
}
function trailX(m, y) { const a = clamp(Math.floor(y), 0, m.H - 1), b = clamp(a + 1, 0, m.H - 1), k = y - Math.floor(y); return m.tx[a] * (1 - k) + m.tx[b] * k; }

/* ---------- sim ---------- */
class Sim {
  constructor(o = {}) {
    this.seed = (o.seed >>> 0) || 1; this.map = genMap(this.seed); this.pred = !!o.pred;
    this.t = 0; this.fog = 0; this.ph = 'run'; this.why = ''; this.lit = [0, 0, 0]; this.bp = []; this.ents = []; this.eid = 1;
    this.ev = []; this.evN = 0; this.hs = []; this.st = { ban: 0, downs: 0, give: 0, picks: 0 }; this.calm = !!o.calm; this.next = CFG.grace; this.wt = 0; this.adT = 0;
    this.R = mulberry(this.seed ^ 0x9e3779b9); this.hikers = [];
    const c = this.map.camp; (o.players || []).forEach((p, i) => this.addHiker(p, i));
    this.hikers.forEach((h, i) => { h.x = c.x - 1.5 + (i % 3) * 1.5; h.y = c.y - 0.5 + Math.floor(i / 3) * 1.1; });
  }
  addHiker(p, i) { const h = { id: p.id, name: String(p.name || '?').slice(0, 24), c: p.c != null ? p.c : i % COLORS.length, x: this.map.camp.x, y: this.map.camp.y, f: -Math.PI / 2, on: 1, bat: CFG.batMax, fear: 0, dn: 0, dnT: 0, rv: 0, rvp: 0, bot: !!p.bot, a: 0, walk: 0, mv: 0 }; this.hikers.push(h); return h; }
  hiker(id) { return this.hikers.find(h => h.id === id) || null; }
  lightOn(h) { return !!(h.on && h.bat > 0 && !h.dn); }
  progress(h) { const m = this.map; return clamp((m.camp.y - h.y) / (m.camp.y - m.shrine.y), 0, 1); }
  teamProgress() { return this.hikers.length ? Math.max(...this.hikers.map(h => this.progress(h))) : 0; }
  push(type, x, y, id, extra) { this.evN++; this.ev.push([this.evN, type, r2(x), r2(y), id == null ? 0 : id, extra == null ? 0 : extra]); if (this.ev.length > 30) this.ev.shift(); }
  move(h, vx, vy, dt) {
    if (h.dn || this.ph !== 'run') return false; const m = this.map, sp = CFG.speed * (dt / 1000); let moved = false;
    const nx = h.x + vx * sp, ny = h.y + vy * sp;
    if (!collides(m, nx, h.y, CFG.r)) { h.x = nx; moved = true; }
    if (!collides(m, h.x, ny, CFG.r)) { h.y = ny; moved = true; }
    if (vx || vy) { h.walk += dt / 1000 * 9; h.mv = 1; } return moved;
  }
  place(h, x, y, f) { if (!h || h.dn || !Number.isFinite(x) || !Number.isFinite(y)) return; const m = this.map; h.x = clamp(x, 0.6, m.W - 0.6); h.y = clamp(y, 1.2, m.H - 1.2); if (Number.isFinite(f)) h.f = f; }
  /** is entity e inside a flashlight cone (or a lit lamp)? */
  litBy(e) {
    for (const h of this.hikers) {
      if (!this.lightOn(h)) continue; const dx = e.x - h.x, dy = e.y - h.y, d = Math.hypot(dx, dy);
      if (d < 0.9 || (d < CFG.light.range && Math.abs(angDiff(Math.atan2(dy, dx), h.f)) < CFG.light.half + 0.25 / Math.max(1, d))) return h;
    }
    for (const L of this.lamps()) if (Math.hypot(e.x - L.x, e.y - L.y) < CFG.lampR) return L;
    return null;
  }
  lamps() { const m = this.map, out = [{ x: m.camp.x, y: m.camp.y, k: 'camp' }]; m.pos.forEach((p, i) => { if (this.lit[i]) out.push({ x: p.x, y: p.y, k: 'pos' }); }); if (this.wt > 0 || this.ph === 'win') out.push({ x: m.shrine.x, y: m.shrine.y, k: 'shrine' }); return out; }
  spawn(k, near, opts = {}) {
    const m = this.map, R = this.R; let x, y;
    if (opts.x != null) { x = opts.x; y = opts.y; }
    else if (k === 'p') { for (let i = 0; i < 12; i++) { const a = (near.f || 0) + Math.PI * (0.55 + R() * 0.9) * (R() < 0.5 ? 1 : -1), d = 7 + R() * 2; x = clamp(near.x + Math.cos(a) * d, 1.5, m.W - 1.5); y = clamp(near.y + Math.sin(a) * d, m.top + 2, m.bot); if (!this.hikers.some(h => Math.hypot(h.x - x, h.y - y) < 5.5)) break; } }
    else { for (let i = 0; i < 16; i++) { const a = R() * 6.283, d = 3.4 + R() * 1.6, cx = Math.floor(near.x + Math.cos(a) * d), cy = Math.floor(near.y + Math.sin(a) * d); if (solidCell(m, cx, cy) && cx > 0 && cx < m.W - 1 && cy > 2 && cy < m.H - 3) { x = cx + 0.5; y = cy + 0.9; break; } } if (x == null) { x = clamp(near.x + 3.5, 1.5, m.W - 1.5); y = near.y - 1; } }
    const e = { id: this.eid++, k, x, y, lt: 0, t: 0, tg: near ? near.id : 0, ph: R() };
    this.ents.push(e); this.push(k === 'p' ? 'spP' : 'spK', x, y, e.tg); return e;
  }
  step(dt) {
    if (this.ph !== 'run') return; const s = dt / 1000, m = this.map, F = CFG.fear; this.t += dt;
    for (const h of this.hikers) { if (!h.mv) h.walk = 0; h.mv = 0; }
    /* entities (movement runs in pred mode too) */
    for (let i = this.ents.length - 1; i >= 0; i--) {
      const e = this.ents[i]; e.t += s; const L = this.litBy(e);
      if (e.k === 'p') {
        if (L) { e.lt += s; e.fr = 1; } else { e.fr = 0; e.lt = Math.max(0, e.lt - 0.25 * s); let tg = null, bd = 1e9; for (const h of this.hikers) { if (h.dn) continue; const d = dist(e, h); if (d < bd) { bd = d; tg = h; } } if (tg) { e.ph += s / 0.55; const hop = (e.ph % 1) < 0.6 ? 1.65 : 0.05, k = CFG.pocong.speed * hop * s / Math.max(0.001, bd); e.x += (tg.x - e.x) * Math.min(1, k); e.y += (tg.y - e.y) * Math.min(1, k); } }
        if (this.pred) continue;
        if (e.lt >= CFG.pocong.banish) { this.ents.splice(i, 1); this.st.ban++; this.push('ban', e.x, e.y, L && L.id, 'p'); continue; }
        const hit = this.hikers.find(h => !h.dn && dist(e, h) < 0.62);
        if (hit) { hit.fear = Math.min(100, hit.fear + F.touch); this.ents.splice(i, 1); this.push('jump', hit.x, hit.y, hit.id, 'p'); continue; }
        if (e.t > CFG.pocong.life) { this.ents.splice(i, 1); this.push('fade', e.x, e.y, 0, 'p'); continue; }
      } else {
        if (L) e.lt += s; if (this.pred) continue;
        if (e.lt >= CFG.kunti.banish) { this.ents.splice(i, 1); this.st.ban++; this.push('ban', e.x, e.y, L && L.id, 'k'); continue; }
        if (e.t >= CFG.kunti.stay) { const h = this.hiker(e.tg) || this.hikers[0]; this.ents.splice(i, 1); if (h && !h.dn) { h.fear = Math.min(100, h.fear + F.swoop); this.push('swoop', h.x, h.y, h.id, 'k'); } continue; }
      }
    }
    if (this.pred) { for (const h of this.hikers) if (this.lightOn(h)) h.bat = Math.max(0, h.bat - CFG.drain * s); return; }
    this.fog += s * (this.calm ? 0.3 : 1);
    const lamps = this.lamps();
    for (const h of this.hikers) {
      if (this.lightOn(h)) h.bat = Math.max(0, h.bat - CFG.drain * s);
      if (!h.dn) {
        m.bat.forEach((b, i) => { if (!this.bp.includes(i) && Math.hypot(h.x - b.x, h.y - b.y) < 0.85) { this.bp.push(i); h.bat = Math.min(CFG.batMax, h.bat + CFG.batPick); this.st.picks++; this.push('bat', b.x, b.y, h.id); } });
        m.pos.forEach((p, i) => { if (!this.lit[i] && Math.hypot(h.x - p.x, h.y - p.y) < 1.9) { this.lit[i] = 1; this.fog = Math.max(0, this.fog - CFG.posBonus); this.push('pos', p.x, p.y, h.id, i); } });
      }
      let df = this.lightOn(h) ? F.lit : F.dark; const nearLamp = lamps.some(L => Math.hypot(h.x - L.x, h.y - L.y) < CFG.lampR);
      if (nearLamp) { df += F.lamp; h.bat = Math.min(CFG.batMax, h.bat + CFG.lampCharge * s); }
      if (this.hikers.some(o => o !== h && !o.dn && Math.hypot(o.x - h.x, o.y - h.y) < 3)) df += F.team;
      for (const e of this.ents) { const d = dist(e, h), A = e.k === 'p' ? CFG.pocong.aura : CFG.kunti.aura; if (d < A) df += (e.k === 'p' ? F.pocong : F.kunti) * (1 - d / A) * (e.fr ? 0.4 : 1); }
      if (!h.dn) h.fear = clamp(h.fear + df * s, 0, 100);
      if (!h.dn && h.fear >= 100) { h.dn = 1; h.dnT = 0; h.rvp = 0; this.st.downs++; this.push('down', h.x, h.y, h.id); }
      if (h.dn) h.dnT += s;
    }
    /* revive: a teammate holding 🙏 next to a downed hiker; a downed hiker holding 🙏 alone recovers slowly */
    const helped = new Set();
    for (const h of this.hikers) {
      if (!h.rv) continue;
      if (h.dn) { h.rvp += s * CFG.selfMul / CFG.reviveT; helped.add(h); continue; }
      const tg = this.hikers.find(o => o.dn && o !== h && Math.hypot(o.x - h.x, o.y - h.y) < 1.7);
      if (tg && !helped.has(tg)) { tg.rvp += s / CFG.reviveT; helped.add(tg); tg.helper = h.id; }
    }
    for (const h of this.hikers) {
      if (!h.dn) continue; if (!helped.has(h)) h.rvp = Math.max(0, h.rvp - 0.3 * s);
      if (h.rvp >= 1) { h.dn = 0; h.fear = 45; h.rvp = 0; this.push('rev', h.x, h.y, h.id, h.helper || 0); h.helper = 0; }
    }
    if (this.hikers.length && this.hikers.every(h => h.dn)) { this.adT += s; if (this.adT >= CFG.allDownLose) return this.finish('lose', 'down'); } else this.adT = 0;
    if (this.fog >= CFG.fogTime) return this.finish('lose', 'fog');
    /* director */
    if (!this.calm) {
      this.next -= s;
      if (this.next <= 0) {
        const prog = this.teamProgress(), hum = Math.max(1, this.hikers.filter(h => !h.bot).length), R = this.R;
        this.next = (CFG.gap[0] + (CFG.gap[1] - CFG.gap[0]) * prog) * (0.8 + R() * 0.4) / (1 + 0.15 * (hum - 1));
        const alive = this.hikers.filter(h => !h.dn && this.progress(h) > 0.04 && !lamps.some(L => Math.hypot(h.x - L.x, h.y - L.y) < CFG.lampR + 1));
        if (alive.length) {
          const pc = this.ents.filter(e => e.k === 'p').length, kc = this.ents.filter(e => e.k === 'k').length;
          const dark = alive.filter(h => !this.lightOn(h)), capP = 1 + Math.floor(prog * 2.6) + (this.hikers.length > 2 ? 1 : 0), capK = prog > 0.4 ? 2 : 1;
          const wantK = kc < capK && (dark.length ? R() < 0.7 : R() < 0.36);
          if (wantK) this.spawn('k', (dark.length ? dark : alive)[(R() * (dark.length || alive.length)) | 0]);
          else if (pc < capP) this.spawn('p', alive[(R() * alive.length) | 0]);
        }
      }
    }
    for (const h of this.hikers) if (h.bot) botStep(this, h, dt);
    /* win: everybody standing together at the summit shrine */
    const sh = m.shrine, all = this.hikers.length && this.hikers.every(h => !h.dn && Math.hypot(h.x - sh.x, h.y - sh.y) < CFG.winR);
    if (all) { this.wt += s; if (this.wt >= CFG.winHold) return this.finish('win', 'top'); } else this.wt = Math.max(0, this.wt - s);
  }
  finish(ph, why) { this.ph = ph; this.why = why; this.push(ph, this.map.shrine.x, this.map.shrine.y, 0, why); }
  stars() { if (this.ph !== 'win') return 0; const f = this.fog / CFG.fogTime; return f < (1 - CFG.stars[1]) && this.st.downs <= 1 ? 3 : f < (1 - CFG.stars[0]) + 0.2 ? 2 : 1; }
  result() { return { w: this.ph === 'win' ? 1 : 0, why: this.why, t: Math.round(this.t / 1000), fog: Math.round(this.fog / CFG.fogTime * 100), s: this.stars(), ban: this.st.ban, dn: this.st.downs, gv: this.st.give, pk: this.st.picks, lit: this.lit.reduce((a, b) => a + b, 0), n: this.hikers.map(h => [h.name, h.c, h.bot ? 1 : 0]) }; }
  /* client op from input: 'b' = give battery to the nearest teammate */
  apply(id, op) {
    const h = this.hiker(id); if (!h || h.dn || this.ph !== 'run') return null;
    if (op === 'b') {
      if (h.bat < CFG.give + 5) return 'low';
      let tg = null, bd = 1.9; for (const o of this.hikers) { if (o === h || o.dn) continue; const d = Math.hypot(o.x - h.x, o.y - h.y); if (d < bd && o.bat < CFG.batMax - 10) { bd = d; tg = o; } }
      if (!tg) return 'none'; h.bat -= CFG.give; tg.bat = Math.min(CFG.batMax, tg.bat + CFG.give); this.st.give++; this.push('give', tg.x, tg.y, h.id, tg.id); return 'ok';
    }
    return null;
  }
  shout(id, idx) { const h = this.hiker(id); if (!h) return; this.hs.push([this.evN * 100 + this.hs.length % 100 + Math.round(this.t) * 1000, id, idx, r2(h.x), r2(h.y)]); if (this.hs.length > 12) this.hs.shift(); for (const b of this.hikers) if (b.bot) { if (idx === 3) b.hold = this.t + 7000; if (idx === 0) { b.come = { x: h.x, y: h.y, until: this.t + 9000 }; b.hold = 0; } } }
  snap() {
    return { v: 1, t: Math.round(this.t), seed: this.seed, fog: Math.round(this.fog * 10), ph: this.ph, why: this.why, lit: this.lit.slice(), bp: this.bp.slice(), calm: this.calm ? 1 : 0, wt: r2(this.wt), next: r2(this.next), eid: this.eid, evN: this.evN, adT: r2(this.adT),
      h: this.hikers.map(h => [h.id, h.name, h.c, r2(h.x), r2(h.y), r2(h.f), h.on ? 1 : 0, Math.round(h.bat * 10) / 10, Math.round(h.fear * 10) / 10, h.dn, Math.round(h.rvp * 100), h.bot ? 1 : 0, h.a, h.rv ? 1 : 0]),
      e: this.ents.map(e => [e.id, e.k, r2(e.x), r2(e.y), Math.round(e.lt * 100), Math.round(e.t * 100), e.tg || 0, e.fr ? 1 : 0]), ev: this.ev.slice(-16), hs: this.hs.slice(-12), st: Object.assign({}, this.st) };
  }
  static fromSnap(sn, pred) {
    const s = new Sim({ seed: sn.seed, pred }); s.t = sn.t | 0; s.fog = (sn.fog || 0) / 10; s.ph = sn.ph || 'run'; s.why = sn.why || ''; s.lit = (sn.lit || [0, 0, 0]).map(Number); s.bp = (sn.bp || []).map(Number); s.calm = !!sn.calm; s.wt = +sn.wt || 0; s.next = +sn.next || 0; s.eid = sn.eid | 0 || 1; s.evN = sn.evN | 0; s.adT = +sn.adT || 0;
    s.hikers = (sn.h || []).map(a => ({ id: a[0], name: String(a[1] || '?'), c: a[2] | 0, x: +a[3], y: +a[4], f: +a[5], on: a[6] ? 1 : 0, bat: +a[7], fear: +a[8], dn: a[9] ? 1 : 0, dnT: 0, rvp: (a[10] || 0) / 100, bot: !!a[11], a: a[12] | 0, rv: a[13] ? 1 : 0, walk: 0, mv: 0 }));
    s.ents = (sn.e || []).map(a => ({ id: a[0], k: a[1] === 'k' ? 'k' : 'p', x: +a[2], y: +a[3], lt: (a[4] || 0) / 100, t: (a[5] || 0) / 100, tg: a[6] || 0, fr: a[7] ? 1 : 0, ph: (a[0] * 0.37) % 1 }));
    s.ev = Array.isArray(sn.ev) ? sn.ev.slice() : []; s.hs = Array.isArray(sn.hs) ? sn.hs.slice() : []; s.st = Object.assign({ ban: 0, downs: 0, give: 0, picks: 0 }, sn.st || {}); return s;
  }
}

/* ---------- bots (host / solo only) ---------- */
function steer(sim, h, tx, ty, dt, slow) {
  const dx = tx - h.x, dy = ty - h.y, d = Math.hypot(dx, dy); if (d < 0.35) return false;
  let vx = dx / d, vy = dy / d; if (slow) { vx *= slow; vy *= slow; }
  const bx = h.x, by = h.y; sim.move(h, vx, vy, dt);
  if (Math.hypot(h.x - bx, h.y - by) < 0.004 * dt / 16) { h.stuck = (h.stuck || 0) + dt; if (h.stuck > 300) { const side = (h.id & 1) ? 1 : -1; sim.move(h, -vy * side, vx * side, dt); sim.move(h, (trailX(sim.map, h.y) - h.x) > 0 ? 1 : -1, 0, dt); } } else h.stuck = 0;
  h.fw = Math.atan2(vy, vx); return true;
}
function botStep(sim, h, dt) {
  const s = dt / 1000, m = sim.map; h.rv = 0;
  if (h.dn) { if (sim.tutHold) return; if (sim.hikers.every(o => o.dn)) { h.rv = 1; return; } const humanNear = sim.hikers.some(o => !o.bot && !o.dn && Math.hypot(o.x - h.x, o.y - h.y) < 14); if (h.dnT > (humanNear ? CFG.botWait * 1.6 : CFG.botWait)) h.rv = 1; return; }
  let threat = null, td = 8; for (const e of sim.ents) { if (e.t < 0.9) continue; const d = dist(e, h); if (d < td) { td = d; threat = e; } }
  const downed = sim.hikers.filter(o => o.dn && o !== h).sort((a, b) => dist(a, h) - dist(b, h))[0];
  const humans = sim.hikers.filter(o => !o.bot), idx = sim.hikers.filter(o => o.bot).indexOf(h), lane = [-0.8, 0.8, 0, -1.2, 1.2][idx % 5];
  let gx = null, gy = null, slow = 1;
  if (downed && dist(downed, h) < 13) { gx = downed.x; gy = downed.y + 0.4; if (dist(downed, h) < 1.3) { h.rv = 1; gx = null; } }
  else if (h.come && h.come.until > sim.t) { gx = h.come.x + lane * 0.6; gy = h.come.y + 0.6; if (Math.hypot(gx - h.x, gy - h.y) < 1) h.come = null; }
  else if (h.hold && h.hold > sim.t) { gx = null; }
  else {
    const sh = m.shrine; let goal;
    const anchor = humans.length ? humans.filter(o => !o.dn).sort((a, b) => b.y - a.y)[0] || humans[0] : null;
    if (anchor) {
      const lead = Math.min(...humans.map(o => o.y));
      goal = Math.min(anchor.y - 1.2, lead - 0.6) - idx * 0.7; if (goal > h.y + 4) slow = 1; else if (h.y < anchor.y - 5) goal = h.y;
      if (dist(anchor, h) > 9) goal = anchor.y - 0.8;
    } else {
      const slowest = Math.max(...sim.hikers.filter(o => !o.dn).map(o => o.y));
      goal = h.y > slowest - 3 || idx === 0 && h.y - 0.1 > slowest - 4 ? h.y - 2.5 : h.y; if (h.y - slowest < -4) goal = h.y + 0.2;
    }
    goal = clamp(goal, sh.y + 0.6, m.camp.y);
    let bt = null; if (h.bat < 72) { let bd = 3.8; m.bat.forEach((b, i) => { if (sim.bp.includes(i)) return; const d = Math.hypot(b.x - h.x, b.y - h.y); if (d < bd && b.y < h.y + 2) { bd = d; bt = b; } }); }
    if (bt) { gx = bt.x; gy = bt.y; }
    else if (h.y < sh.y + 5) { gx = sh.x + lane * 1.2; gy = sh.y + 1.2 + (idx % 2) * 0.6; }
    else { gy = goal; gx = trailX(m, Math.max(gy, h.y - 1.5)) + lane; if (Math.abs(gy - h.y) < 0.3) gx = trailX(m, h.y) + lane; }
    if (threat && threat.k === 'p' && td < 2.4) { gx = h.x + (h.x - threat.x); gy = h.y + (h.y - threat.y); slow = 0.8; }
  }
  if (gx != null) steer(sim, h, gx, gy, dt, slow);
  /* aim: threats first, else the walking direction */
  const want = threat ? Math.atan2(threat.y - h.y, threat.x - h.x) : (h.fw != null ? h.fw : -Math.PI / 2);
  const d = angDiff(want, h.f), turn = (threat ? 3.2 : 4) * s; h.f += Math.abs(d) < turn ? d : Math.sign(d) * turn;
  const teamLit = sim.hikers.some(o => o !== h && sim.lightOn(o) && Math.hypot(o.x - h.x, o.y - h.y) < 2.5);
  h.on = threat || h.bat > 30 || !teamLit ? 1 : 0; if (h.bat <= 0) h.on = 0;
  h.giveCd = (h.giveCd || 0) - s;
  if (h.giveCd <= 0 && h.bat > 55) { const low = sim.hikers.find(o => o !== h && !o.bot && !o.dn && o.bat < 22 && Math.hypot(o.x - h.x, o.y - h.y) < 1.8); if (low) { sim.apply(h.id, 'b'); h.giveCd = 9; } }
  h.sayCd = (h.sayCd || 0) - s;
  if (h.sayCd <= 0) { if (threat && threat.k === 'k' && threat.t < 1.6) { sim.shout(h.id, 1); h.sayCd = 6; } else if (h.bat < 12) { sim.shout(h.id, 2); h.sayCd = 14; } }
}

root.MPGame = { CFG, COLORS, Sim, genMap, collides, trailX, botStep, mulberry, angDiff, clamp };
if (typeof module !== 'undefined') module.exports = root.MPGame;
})(typeof window !== 'undefined' ? window : globalThis);

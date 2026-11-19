/* ---------- t323u: a living tank ----------
   Shared clock (same as Langit Bersama): 1 real minute = 1 tank hour, derived from the synced server clock (room.now()), so every
   screen (phone, desktop, ?wallpaper) shows the same light, feeding time, filter surge, snail and shrimp.
   ?jam=21.5 pins the hour for screenshots, &jalan lets a pinned clock run at 60x.
   Layers: day/night lights (dim + soft neon at night), sleepy fish at night, air-stone bubble curtain + filter outflow whose
   strength drifts, feeding time at 08.00 / 18.30 (+ rarer random sprinkles, pellets, surface ripples), an occasional snail /
   cherry shrimp / bubble ring, cloud + leaf shadows from "outside the glass", glass sheen, and gentle fade in/out of creatures.
   Rollback: restore the t323u backup listed in README (src/ + index.deploy.html), rebuild and deploy. */
const TQS = (() => { try { return new URLSearchParams(root.location.search); } catch (e) { return new URLSearchParams(''); } })();
let tankPin = (() => { const n = parseFloat(TQS.get('jam')); return Number.isFinite(n) ? { h: ((n % 24) + 24) % 24, t0: performance.now(), run: TQS.has('jalan') } : null; })();
/* t325u: the synced server clock re-centres its offset as Date headers arrive (steps of up to ~0.5 s) → cloud shadows / snail / shrimp
   twitched sideways. The tank follows it through a slewed offset (eases in over ~2 s, snaps only for jumps > 5 s). */
const TMS = { off: null };
function tankRaw() { try { return nowMs(); } catch (e) { return Date.now(); } }
function tankSlew() { const p = performance.now(), tg = tankRaw() - p; if (TMS.off == null || Math.abs(tg - TMS.off) > 5000) TMS.off = tg; else TMS.off += (tg - TMS.off) * 0.03; }
function tankMs() { if (TMS.off == null) tankSlew(); return performance.now() + TMS.off; }
function tankHours() { if (tankPin) return tankPin.h + (tankPin.run ? (performance.now() - tankPin.t0) / 60000 : 0); return tankMs() / 60000; }
const smoothst = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const lightAt = h => (h < 13 ? smoothst(6.2, 8.2, h) : 1 - smoothst(18.2, 20.4, h));
const warmAt = h => clamp(Math.max(0, 1 - Math.abs(h - 7.1) / 1.2) + Math.max(0, 1 - Math.abs(h - 19.3) / 1.3), 0, 1);
function filterAt(ms) { const t = ms / 1000, P = Math.PI * 2; return clamp(0.58 + 0.26 * Math.sin(P * t / 173 + 0.9) + 0.16 * Math.sin(P * t / 59 + 2.1), 0.12, 1); }
const FEED_AT = [8, 18.5], FEED_LEN = 0.35;
const TL = { S: 0, h: 12, L: 1, N: 0, W: 0, I: 0.6, feed: false, fed: new Set(), pillAt: 0 };
const hrng = key => bgRng('dq-t323u-' + key);
function tlUpdate() {
  tankSlew();
  const S = tankHours(), h = ((S % 24) + 24) % 24; TL.S = S; TL.h = h; TL.L = lightAt(h); TL.N = 1 - TL.L; TL.W = warmAt(h); TL.I = filterAt(tankMs()) * (0.45 + 0.55 * TL.L);
  TL.feed = false; for (const f of FEED_AT) if (h >= f && h < f + FEED_LEN) { TL.feed = true; const key = Math.floor(S / 24) + ':' + f; if (!TL.fed.has(key)) { TL.fed.add(key); if (TL.fed.size > 20) TL.fed.clear(), TL.fed.add(key); feedingTime(); } }
}
/* feeding time: a big sprinkle in two spots, every fish comes over */
function feedingTime() { const a = rand(0.38, 0.5), b = rand(0.52, 0.64); dropFood({ cx: a, n: 7, all: true, pellets: 0.35 }); setTimeout(() => dropFood({ cx: b, n: 6, all: true, pellets: 0.5 }), 900); }

/* ---- sand line + cached overlays (rebuilt with the background) ---- */
let sandPts = [], nightFx = null, cloudFx = null, leafFx = null, glassFx = null, glowDot = null;
const sandAt = x => { if (!sandPts.length) return TH * 0.87; const i = clamp(x / 8, 0, sandPts.length - 1.001), j = Math.floor(i); return sandPts[j] + (sandPts[j + 1] - sandPts[j]) * (i - j); };
const mobileTank = () => root.innerWidth <= 900 && TW > root.innerWidth * 1.5;
const AIR = { x: 0.47 }, FILT = { x: 0.88 };
function tlBuild(midH) {
  sandPts = []; for (let x = 0; x <= TW + 16; x += 8) sandPts.push(midH(x));
  FILT.x = mobileTank() ? 0.37 : 0.88; AIR.x = mobileTank() ? 0.47 : 0.44;
  const Q = 0.5, mk = (w, h) => { const c = doc.createElement('canvas'); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return c; };
  // night: LED bar along the lid + soft cones + fluorescent reef glows (drawn with 'lighter')
  nightFx = mk(TW * Q, TH * Q); { const c = nightFx.getContext('2d'); c.scale(Q, Q); const R = hrng('night'), PI2 = Math.PI * 2;
    const bar = c.createLinearGradient(0, 0, TW, 0); [[0, '#38d6ff'], [0.33, '#8f7bff'], [0.66, '#ff6fd0'], [1, '#38d6ff']].forEach(s => bar.addColorStop(s[0], s[1]));
    c.globalAlpha = 0.55; c.fillStyle = bar; c.fillRect(0, 0, TW, 3);
    const dn = c.createLinearGradient(0, 0, 0, TH * 0.42); dn.addColorStop(0, 'rgba(80,140,255,.30)'); dn.addColorStop(1, 'rgba(80,140,255,0)'); c.globalAlpha = 1; c.fillStyle = dn; c.fillRect(0, 0, TW, TH * 0.42);
    for (let i = 0, n = Math.max(3, Math.round(TW / 300)); i < n; i++) { const x = (i + 0.5) / n * TW + (R() - 0.5) * 80, w0 = 40 + R() * 40, sl = (R() - 0.5) * 80, g = c.createLinearGradient(0, 0, 0, TH * 0.9); g.addColorStop(0, 'rgba(120,170,255,.075)'); g.addColorStop(1, 'rgba(120,170,255,0)'); c.fillStyle = g; c.beginPath(); c.moveTo(x - w0 / 2, 0); c.lineTo(x + w0 / 2, 0); c.lineTo(x + w0 * 1.6 + sl, TH * 0.9); c.lineTo(x - w0 * 1.6 + sl, TH * 0.9); c.closePath(); c.fill(); }
    const COL = ['rgba(64,255,214,', 'rgba(255,92,214,', 'rgba(150,120,255,', 'rgba(110,255,140,', 'rgba(70,200,255,'];
    for (let i = 0, n = Math.max(5, Math.round(TW / 150)); i < n; i++) { const x = (i + R()) / n * TW, y = sandAt(x) - 6 - R() * 30, r = 34 + R() * 50, col = COL[Math.floor(R() * COL.length)], g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, col + '.42)'); g.addColorStop(0.4, col + '.16)'); g.addColorStop(1, col + '0)'); c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2); }
    { const x = chestAt.x * TW, y = chestAt.y * TH, r = 46, g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, 'rgba(255,200,90,.45)'); g.addColorStop(1, 'rgba(255,200,90,0)'); c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2); }
    const sg = c.createLinearGradient(0, TH * 0.82, 0, TH); sg.addColorStop(0, 'rgba(90,120,255,0)'); sg.addColorStop(1, 'rgba(120,90,255,.12)'); c.fillStyle = sg; c.fillRect(0, TH * 0.82, TW, TH * 0.18); }
  // one soft cloud shadow blob
  cloudFx = mk(256, 128); { const c = cloudFx.getContext('2d'), R = hrng('cloud'); for (let i = 0; i < 7; i++) { const x = 50 + R() * 156, y = 40 + R() * 48, r = 34 + R() * 30, g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, 'rgba(8,30,50,.32)'); g.addColorStop(1, 'rgba(8,30,50,0)'); c.fillStyle = g; c.fillRect(0, 0, 256, 128); } }
  // dappled leaf shadow (a plant outside the glass), drawn small then scaled up = soft edges
  leafFx = mk(140, 90); { const c = leafFx.getContext('2d'), R = hrng('leaf'); c.fillStyle = 'rgba(10,40,35,.22)';
    for (let i = 0; i < 26; i++) { const a = R() * Math.PI * 2, d = R() * 52, x = 70 + Math.cos(a) * d * 1.3, y = 20 + Math.abs(Math.sin(a)) * d * 0.9, rl = 6 + R() * 9; c.save(); c.translate(x, y); c.rotate(a + R()); c.beginPath(); c.ellipse(0, 0, rl, rl * 0.42, 0, 0, Math.PI * 2); c.fill(); c.restore(); }
    c.strokeStyle = 'rgba(10,40,35,.18)'; c.lineWidth = 1.4; c.beginPath(); c.moveTo(70, -4); c.quadraticCurveTo(60, 30, 80, 70); c.stroke(); }
  // glass sheen (front glass reflection)
  glassFx = mk(TW * Q, TH * Q); { const c = glassFx.getContext('2d'); c.scale(Q, Q);
    const band = (x, w, a) => { const g = c.createLinearGradient(x, 0, x + w, 0); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, 'rgba(255,255,255,' + a + ')'); g.addColorStop(1, 'rgba(255,255,255,0)'); c.save(); c.transform(1, 0, -0.35, 1, TH * 0.35, 0); c.fillStyle = g; c.fillRect(x, 0, w, TH); c.restore(); };
    const n = Math.max(1, Math.round(TW / 700)); for (let i = 0; i < n; i++) { const x0 = (i + 0.12) / n * TW; band(x0, 70, 0.07); band(x0 + 90, 26, 0.05); }
    const tg = c.createLinearGradient(0, 0, 0, 10); tg.addColorStop(0, 'rgba(255,255,255,.16)'); tg.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = tg; c.fillRect(0, 0, TW, 10); }
  glowDot = mk(24, 24); { const c = glowDot.getContext('2d'), g = c.createRadialGradient(12, 12, 0, 12, 12, 12); g.addColorStop(0, 'rgba(190,255,250,1)'); g.addColorStop(0.3, 'rgba(110,240,255,.55)'); g.addColorStop(1, 'rgba(110,240,255,0)'); c.fillStyle = g; c.fillRect(0, 0, 24, 24); }
}

/* ---- air stone bubble curtain + filter outflow (strength = TL.I) ---- */
const airB = [], filtB = [], rings = [], pops = [], plankton = Array.from({ length: 40 }, () => ({ x: Math.random(), y: rand(0.05, 0.85), ph: rand(0, 6), sp: rand(0.6, 1.4), dx: rand(-0.004, 0.004) }));
let airAcc = 0, filtAcc = 0, ringKey = '';
function drawEquipment(ctx, dt, t) {
  const U = clamp(TH / 450, 0.7, 1.4), I = TL.I, ax = AIR.x * TW, ay = sandAt(ax) + 2 * U, fx = FILT.x * TW, cap = REDUCED ? 0.5 : 1;
  // airline tube + stone
  ctx.save(); ctx.strokeStyle = 'rgba(230,250,255,.22)'; ctx.lineWidth = 2.2 * U; ctx.beginPath(); ctx.moveTo(ax - 9 * U, ay - 3 * U); ctx.bezierCurveTo(ax - 40 * U, ay - 20 * U, ax - 60 * U, TH * 0.5, ax - 52 * U, -4); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,.12)'; ctx.lineWidth = 0.8 * U; ctx.stroke();
  const sg = ctx.createLinearGradient(0, ay - 9 * U, 0, ay); sg.addColorStop(0, '#9fb4bd'); sg.addColorStop(1, '#5d7380'); ctx.fillStyle = sg; rrPath(ctx, ax - 15 * U, ay - 8 * U, 30 * U, 8 * U, 4 * U); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.28)'; for (let i = 0; i < 9; i++) { ctx.beginPath(); ctx.arc(ax - 11 * U + i * 2.7 * U, ay - 6 * U + (i % 3) * 1.6 * U, 0.7 * U, 0, Math.PI * 2); ctx.fill(); }
  ctx.fillStyle = 'rgba(40,60,60,.22)'; ctx.beginPath(); ctx.ellipse(ax, ay + 1, 18 * U, 2.6 * U, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  // curtain bubbles
  airAcc += dt * (5 + 17 * I) * cap; while (airAcc >= 1 && airB.length < 90) { airAcc -= 1; airB.push({ x: ax + rand(-11, 11) * U, y: ay - 8 * U, r: rand(0.8, 2.1) * (0.8 + 0.4 * I) * U, vy: rand(55, 95) * (0.7 + 0.5 * I), ph: rand(0, 6), sp: rand(-6, 6) }); } if (airAcc > 3) airAcc = 0;
  // filter outflow microbubbles: jet down from the lip, slow, then float up
  filtAcc += dt * (14 + 60 * I) * cap; while (filtAcc >= 1 && filtB.length < 170) { filtAcc -= 1; filtB.push({ x: fx + rand(-22, 22) * U, y: 9 * U, vx: rand(-18, 18), vy: rand(90, 200) * (0.5 + 0.7 * I), r: rand(0.5, 1.4) * U, life: 1 }); } if (filtAcc > 3) filtAcc = 0;
  ctx.save(); ctx.beginPath();
  for (let i = airB.length - 1; i >= 0; i--) { const b = airB[i]; b.y -= b.vy * dt; b.vy += dt * 6; b.r += dt * 0.25; b.x += (Math.sin(t * 5 + b.ph) * 9 + b.sp) * dt; if (b.y < 3) { airB.splice(i, 1); if (pops.length < 24 && Math.random() < 0.35) pops.push({ x: b.x, a: 1 }); continue; } ctx.moveTo(b.x + b.r, b.y); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); }
  ctx.fillStyle = 'rgba(255,255,255,.14)'; ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,.45)'; ctx.lineWidth = 0.8; ctx.stroke();
  ctx.beginPath(); for (let i = filtB.length - 1; i >= 0; i--) { const b = filtB[i]; b.vy += (-26 - b.vy) * Math.min(1, dt * 1.6); b.vx *= 1 - Math.min(1, dt * 1.2); b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt * 0.22; if (b.y < 2 || b.life <= 0) { filtB.splice(i, 1); continue; } ctx.moveTo(b.x + b.r, b.y); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); }
  ctx.fillStyle = 'rgba(255,255,255,' + (0.35 + 0.3 * I).toFixed(2) + ')'; ctx.fill();
  // outflow current haze + the filter lip peeking over the rim
  { const h = TH * (0.12 + 0.2 * I), g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, 'rgba(255,255,255,' + (0.18 * I + 0.05).toFixed(3) + ')'); g.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(fx - 24 * U, 0); ctx.lineTo(fx + 24 * U, 0); ctx.lineTo(fx + 40 * U, h); ctx.lineTo(fx - 40 * U, h); ctx.closePath(); ctx.fill(); }
  { const lg = ctx.createLinearGradient(0, 0, 0, 11 * U); lg.addColorStop(0, '#2c3d46'); lg.addColorStop(1, '#46606c'); ctx.fillStyle = lg; rrPath(ctx, fx - 30 * U, -6, 60 * U, 6 + 11 * U, 3 * U); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,.22)'; ctx.fillRect(fx - 27 * U, 8 * U, 54 * U, 1.2 * U);
    ctx.strokeStyle = 'rgba(255,255,255,' + (0.25 + 0.4 * I).toFixed(2) + ')'; ctx.lineWidth = 1.2; for (let i = 0; i < 5; i++) { const xx = fx - 22 * U + i * 11 * U, w = Math.sin(t * 9 + i * 1.7) * 2 * I; ctx.beginPath(); ctx.moveTo(xx, 11 * U); ctx.quadraticCurveTo(xx + w, 16 * U, xx + w * 0.4, (18 + 10 * I) * U); ctx.stroke(); } }
  // surface: agitation above the curtain + popping bubbles
  ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 1.2; for (let i = 0; i < 4; i++) { const w = (12 + 18 * I) * U, xx = ax + Math.sin(t * 1.7 + i * 2.1) * 16 * U; ctx.globalAlpha = 0.35 + 0.4 * I; ctx.beginPath(); ctx.ellipse(xx, 4 + i * 1.5, w * (0.6 + 0.4 * Math.abs(Math.sin(t * 2 + i))), 1.6, 0, 0, Math.PI * 2); ctx.stroke(); }
  ctx.globalAlpha = 1; for (let i = pops.length - 1; i >= 0; i--) { const p = pops[i]; p.a -= dt * 2.4; if (p.a <= 0) { pops.splice(i, 1); continue; } ctx.globalAlpha = p.a * 0.6; ctx.beginPath(); ctx.ellipse(p.x, 4, (1 - p.a) * 8 + 1.5, 1.4, 0, 0, Math.PI * 2); ctx.stroke(); }
  ctx.restore();
  // shared schedule: a bubble ring every ~75 s slot (55 %), a surface ripple ring for every food entry is in drawRipples
  const ms = tankMs(), SL = 75000, k = Math.floor(ms / SL), r = hrng('ring' + k); if (r() < 0.55) { const at = k * SL + r() * (SL - 8000), key = 'r' + k; if (ms >= at && ms - at < 4000 && ringKey !== key) { ringKey = key; rings.push({ x: ax, y: ay - 10 * U, t: 0, U }); rings.push({ x: ax + rand(-4, 4), y: ay - 10 * U, t: -0.9, U }); } }
  for (let i = rings.length - 1; i >= 0; i--) { const g = rings[i]; g.t += dt; if (g.t < 0) continue; const y = g.y - g.t * 42 * g.U, R0 = (7 + g.t * 3.2) * g.U, wob = Math.sin(g.t * 4) * 0.08; if (y < 8) { rings.splice(i, 1); continue; }
    ctx.save(); ctx.globalAlpha = clamp(Math.min(g.t * 2, y / (TH * 0.2)), 0, 0.85); ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = 2.2 * g.U; ctx.beginPath(); ctx.ellipse(g.x + Math.sin(g.t * 1.3) * 6, y, R0, R0 * (0.32 + wob), 0, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(g.x + Math.sin(g.t * 1.3) * 6, y - 1.5 * g.U, R0 * 0.8, R0 * 0.2, 0, Math.PI, 0); ctx.stroke(); ctx.restore(); }
}

/* ---- outside the glass: drifting cloud shadows + a swaying leaf shadow (daytime only) ---- */
function drawOutside(ctx, t) {
  const L = TL.L; if (L < 0.03 || !cloudFx) return; const ts = tankMs() / 1000;
  ctx.save(); for (let i = 0; i < 3; i++) { const w = Math.max(420, TW * (0.5 + i * 0.12)), h = TH * (0.8 + i * 0.1), sp = 7 + i * 3.5, span = TW + w * 2, x = ((ts * sp + i * 977) % span) - w, y = TH * (-0.1 + i * 0.12);
    ctx.globalAlpha = L * (0.55 + 0.25 * Math.sin(ts / 40 + i)); ctx.drawImage(cloudFx, x, y, w, h); }
  if (leafFx) { const sx = Math.sin(t * 0.45) * 7 + Math.sin(t * 1.3) * 2.5, sy = Math.sin(t * 0.6 + 1) * 3; ctx.globalAlpha = L * 0.9;
    const lw = clamp(TW * 0.22, 220, 320), lh = lw * 0.64; ctx.drawImage(leafFx, TW * (mobileTank() ? 0.6 : 0.74) + sx, -lh * 0.2 + sy, lw, lh); if (TW > 900) ctx.drawImage(leafFx, TW * 0.08 - sx * 0.6, -lh * 0.32, lw * 0.8, lh * 0.8); }
  ctx.restore();
}

/* ---- night: dark-blue dim, warm dawn/dusk tint, neon LEDs and glowing plankton ---- */
function drawNight(ctx, dt, t) {
  const N = TL.N, W = TL.W;
  if (W > 0.02) { ctx.save(); ctx.globalAlpha = W * 0.16; ctx.fillStyle = TL.h < 12 ? '#ffb08a' : '#ff9a62'; ctx.fillRect(0, 0, TW, TH); ctx.restore(); }
  if (N < 0.02) return;
  ctx.save(); ctx.globalAlpha = N * 0.64; ctx.fillStyle = '#071334'; ctx.fillRect(0, 0, TW, TH);
  ctx.globalCompositeOperation = 'lighter'; if (nightFx) { ctx.globalAlpha = N * 0.9; ctx.drawImage(nightFx, 0, 0, TW, TH); }
  if (glowDot && !REDUCED) { for (const p of plankton) { p.x = (p.x + p.dx * dt + 1) % 1; p.y += Math.sin(t * 0.3 + p.ph) * 0.002 * dt; const tw = 0.5 + 0.5 * Math.sin(t * p.sp * 1.7 + p.ph); ctx.globalAlpha = N * (0.15 + 0.6 * tw * tw); const s = 7 + 5 * tw; ctx.drawImage(glowDot, p.x * TW - s / 2, p.y * TH - s / 2, s, s); } }
  ctx.restore();
}
function drawNightLift(ctx) { if (TL.N < 0.02) return; ctx.save(); ctx.globalAlpha = TL.N * 0.14; ctx.fillStyle = '#071334'; ctx.fillRect(0, 0, TW, TH); ctx.restore(); }
function drawGlass(ctx) { if (glassFx) ctx.drawImage(glassFx, 0, 0, TW, TH); }

/* ---- critters on a shared schedule: a snail (5-min slots) and a cherry shrimp (2.5-min slots) ---- */
const crCache = new Map();
function snailAt(ms) {
  const SL = 300000, k = Math.floor(ms / SL); let p = crCache.get('s' + k);
  if (p === undefined) { const r = hrng('snail' + k); p = r() < 0.6 ? { st: k * SL + r() * 50000, dur: 190000 + r() * 50000, x0: r() < 0.6 ? 0.32 + r() * 0.36 : 0.08 + r() * 0.84, dir: r() < 0.5 ? -1 : 1, sp: 2.4 + r() * 1.4, ph: r() * 6 } : null; crCache.set('s' + k, p); if (crCache.size > 40) crCache.clear(); }
  if (!p) return null; const el = (ms - p.st) / 1000; if (el < 0 || el > p.dur / 1000) return null;
  const span = TW * 0.92, raw = p.x0 * TW - TW * 0.04 + p.dir * (p.sp * el + 1.4 * Math.sin(el * 1.7 + p.ph)), m = ((raw % (span * 2)) + span * 2) % (span * 2), x = TW * 0.04 + (m < span ? m : span * 2 - m), dir = (m < span ? 1 : -1) * p.dir;
  return { x, dir, a: clamp(Math.min(el / 6, (p.dur / 1000 - el) / 6), 0, 1), str: Math.sin(el * 1.7 + p.ph), el };
}
function shrimpAt(ms) {
  const SL = 150000, k = Math.floor(ms / SL); let p = crCache.get('h' + k);
  if (p === undefined) { const r = hrng('shrimp' + k); if (r() < 0.5) { const st = k * SL + r() * 30000, dur = 70000 + r() * 40000, SEG = 2.5, n = Math.ceil(dur / 1000 / SEG) + 1; let x = (r() < 0.6 ? 0.34 + r() * 0.32 : 0.06 + r() * 0.88), dir = r() < 0.5 ? -1 : 1; const segs = [];
      for (let i = 0; i < n; i++) { const q = r(); let type = q < 0.47 ? 'w' : q < 0.86 ? 'p' : 'f', dx = 0; if (r() < 0.18) dir = -dir; if (type === 'w') dx = dir * (0.012 + r() * 0.02); else if (type === 'f') dx = -dir * (0.04 + r() * 0.04); if (x + dx < 0.04 || x + dx > 0.96) { dx = -dx; if (type === 'w') dir = -dir; } segs.push({ x0: x, x1: x + dx, type, dir }); x += dx; }
      p = { st, dur, SEG, segs }; } else p = null; crCache.set('h' + k, p); }
  if (!p) return null; const el = (ms - p.st) / 1000; if (el < 0 || el > p.dur / 1000) return null;
  const i = Math.min(p.segs.length - 1, Math.floor(el / p.SEG)), s = p.segs[i], f = (el - i * p.SEG) / p.SEG; let x, lift = 0, walk = 0, peck = 0;
  if (s.type === 'w') { x = s.x0 + (s.x1 - s.x0) * smoothst(0, 1, f); walk = 1; }
  else if (s.type === 'f') { const e = clamp(f / 0.16, 0, 1), k2 = 1 - Math.pow(1 - e, 3); x = s.x0 + (s.x1 - s.x0) * k2; lift = Math.sin(Math.PI * clamp(f / 0.4, 0, 1)) * 16; }
  else { x = s.x0; peck = Math.max(0, Math.sin(el * 5.5)) * (f > 0.15 && f < 0.85 ? 1 : 0); }
  return { x: x * TW, dir: s.dir, lift, walk, peck, el, flick: s.type === 'f' && f < 0.3, a: clamp(Math.min(el / 3, (p.dur / 1000 - el) / 3), 0, 1) };
}
function drawSnail(ctx, s, t) {
  const U = clamp(TH / 450, 0.75, 1.3) * 0.95, y = sandAt(s.x) + 3 * U, st = 1 + 0.07 * s.str;
  ctx.save(); ctx.globalAlpha = s.a; ctx.translate(s.x, y); ctx.scale(s.dir * U, U);
  ctx.fillStyle = 'rgba(60,40,20,.22)'; ctx.beginPath(); ctx.ellipse(0, 1, 17 * st, 2.6, 0, 0, Math.PI * 2); ctx.fill();
  const bg = ctx.createLinearGradient(0, -7, 0, 1); bg.addColorStop(0, '#e9dcc4'); bg.addColorStop(1, '#b49c7c'); ctx.fillStyle = bg;
  ctx.beginPath(); ctx.moveTo(-17 * st, 0); ctx.quadraticCurveTo(-8, -5, 6 * st, -5.5); ctx.quadraticCurveTo(14 * st, -6.5, 15 * st, -1.5); ctx.quadraticCurveTo(15 * st, 0.8, 11 * st, 0.8); ctx.lineTo(-17 * st, 0.6); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#b49c7c'; ctx.lineWidth = 1.3; ctx.lineCap = 'round'; const w1 = Math.sin(t * 2.1) * 0.18, w2 = Math.sin(t * 1.7 + 1) * 0.2;
  for (const [a, L, w] of [[-1.05, 10, w1], [-0.7, 9, w2]]) { const ex = 12 * st + Math.cos(a + w) * L, ey = -5 + Math.sin(a + w) * L; ctx.beginPath(); ctx.moveTo(12 * st, -5); ctx.quadraticCurveTo(13 * st, -9, ex, ey); ctx.stroke(); ctx.fillStyle = '#3b2a1a'; ctx.beginPath(); ctx.arc(ex, ey, 1.3, 0, Math.PI * 2); ctx.fill(); }
  const cx = -4, cy = -10, R = 9.5, sg = ctx.createRadialGradient(cx - 3, cy - 4, 1, cx, cy, R); sg.addColorStop(0, '#ffd08a'); sg.addColorStop(0.55, '#d27a3a'); sg.addColorStop(1, '#8a4320'); ctx.fillStyle = sg; ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(90,38,14,.6)'; ctx.lineWidth = 1.3; ctx.beginPath(); for (let a = 0; a < Math.PI * 5; a += 0.2) { const rr = R * 0.9 * (1 - a / (Math.PI * 5.4)), px = cx + Math.cos(-a) * rr, py = cy + Math.sin(-a) * rr; a ? ctx.lineTo(px, py) : ctx.moveTo(px, py); } ctx.stroke();
  ctx.strokeStyle = 'rgba(255,240,210,.5)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(cx, cy, R - 1.5, Math.PI * 1.1, Math.PI * 1.5); ctx.stroke(); ctx.restore();
}
function drawShrimp(ctx, s, t) {
  const U = clamp(TH / 450, 0.75, 1.3), y = sandAt(s.x) - 2 * U - s.lift * U, tilt = s.peck * 0.22 - (s.lift ? 0.25 : 0);
  ctx.save(); ctx.globalAlpha = s.a; ctx.fillStyle = 'rgba(60,40,20,.2)'; ctx.beginPath(); ctx.ellipse(s.x, sandAt(s.x) + 1, 12 * U * (1 - s.lift / 40), 2 * U, 0, 0, Math.PI * 2); ctx.fill();
  ctx.translate(s.x, y); ctx.scale(s.dir * U, U); ctx.rotate(tilt);
  const leg = s.walk ? t * 14 : s.peck ? t * 6 : 0; ctx.strokeStyle = 'rgba(214,72,56,.75)'; ctx.lineWidth = 0.9; ctx.lineCap = 'round';
  for (let i = 0; i < 5; i++) { const lx = 7 - i * 3.2, ph = Math.sin(leg + i * 1.2) * (s.walk ? 1.8 : 0.6); ctx.beginPath(); ctx.moveTo(lx, -3); ctx.lineTo(lx + ph, 2.5); ctx.stroke(); }
  const body = ctx.createLinearGradient(0, -12, 0, 0); body.addColorStop(0, 'rgba(255,120,96,.95)'); body.addColorStop(1, 'rgba(200,40,36,.92)'); ctx.fillStyle = body;
  const tailC = s.flick ? 0.9 : 0.15 + 0.05 * Math.sin(t * 2);
  ctx.beginPath(); ctx.ellipse(5, -6, 7.5, 4.6, -0.08, 0, Math.PI * 2); ctx.fill();
  const seg = [[-2, -6.6, 3.9], [-6.6, -6.1 + tailC * 1.2, 3.5], [-10.6, -4.6 + tailC * 2.6, 3], [-13.6, -2.4 + tailC * 4, 2.4]]; for (const [x, yy, r] of seg) { ctx.beginPath(); ctx.ellipse(x, yy, r * 1.1, r, 0, 0, Math.PI * 2); ctx.fill(); }
  ctx.save(); ctx.translate(-16, -0.6 + tailC * 5); ctx.rotate(0.5 + tailC * 0.6); ctx.fillStyle = 'rgba(230,70,56,.85)'; for (const a of [-0.5, 0, 0.5]) { ctx.beginPath(); ctx.ellipse(-2.6 * Math.cos(a), 2.6 * Math.sin(a), 3, 1.3, a, 0, Math.PI * 2); ctx.fill(); } ctx.restore();
  ctx.strokeStyle = 'rgba(255,220,200,.55)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(10, -9.5); ctx.quadraticCurveTo(0, -11.5, -8, -9 + tailC); ctx.stroke();
  ctx.fillStyle = '#1b0d0a'; ctx.beginPath(); ctx.arc(10.5, -8, 1.3, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = 'rgba(220,70,56,.9)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(11, -6.5); ctx.lineTo(15.5, -8); ctx.stroke();
  ctx.strokeStyle = 'rgba(236,104,86,.75)'; ctx.lineWidth = 0.7; for (const [k, L] of [[0, 24], [1.3, 19]]) { const sw = Math.sin(t * 2.6 + k) * 0.25 + (s.peck ? 0.2 : 0); ctx.beginPath(); ctx.moveTo(12, -8.5); ctx.bezierCurveTo(18, -12 - k * 2, 24, -14 + sw * 10, 12 + L * Math.cos(-0.5 + sw), -8.5 + L * Math.sin(-0.5 + sw)); ctx.stroke(); }
  ctx.restore();
}
function drawCritters(ctx, t) { const ms = tankMs(), fc = TL.forceCrit, sn = fc ? { x: fc[0] * TW, dir: 1, a: 1, str: Math.sin(t * 1.7), el: t } : snailAt(ms), sh = fc ? { x: fc[1] * TW, dir: -1, lift: 0, walk: 0, peck: Math.max(0, Math.sin(t * 5.5)), el: t, flick: false, a: 1 } : shrimpAt(ms); /* forceCrit = [snailX, shrimpX] for tests/screenshots */ if (sn) drawSnail(ctx, sn, t); if (sh) drawShrimp(ctx, sh, t); TL.crit = { snail: !!sn, shrimp: !!sh }; }

/* ---- food entry ripples ---- */
const ripples = [];
function drawRipples(ctx, dt) { if (!ripples.length) return; ctx.save(); ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 1.2; for (let i = ripples.length - 1; i >= 0; i--) { const r = ripples[i]; r.t += dt; if (r.t > 1.4) { ripples.splice(i, 1); continue; } if (r.t < 0) continue; const k = r.t / 1.4; ctx.globalAlpha = (1 - k) * 0.8; ctx.beginPath(); ctx.ellipse(r.x * TW, 5, 4 + k * 26, 1.5 + k * 3, 0, 0, Math.PI * 2); ctx.stroke(); } ctx.restore(); }

/* ---- creatures leaving fade out (cull / delete) instead of vanishing ---- */
const goneFx = [];
function drawGone(ctx, dt) {
  for (let i = goneFx.length - 1; i >= 0; i--) { const g = goneFx[i]; if (!g.s) { goneFx.splice(i, 1); continue; }
    if (g.dir) { stepLeave(g, dt); const sc0 = scaleFor(g.c, g.s), hw = (g.s.box[2] - g.s.box[0]) * sc0 / 2 / TW; if (g.m.x < -0.02 - hw || g.m.x > 1.02 + hw || g.t > 9) g.a -= dt / 0.4; } else g.a -= dt / 1.6; // t331u: swim off the side, gone once fully past the glass
    if (g.a <= 0) { goneFx.splice(i, 1); continue; }
    if (!g.dir) { if (g.c.k === 'jelly') stepJelly(g.m, dt); else stepFish(g.m, dt); }
    const sc = g.dir ? scaleFor(g.c, g.s) : scaleFor(g.c, g.s) * (0.8 + 0.2 * g.a); ctx.save(); ctx.globalAlpha = g.dir ? g.a : g.a * g.a; if (g.c.k === 'jelly') drawJelly(ctx, g.c, g.m, g.s, sc); else drawFish(ctx, g.c, g.m, g.s, sc); ctx.restore();
    if (g.dir && g.t < 3.5) { const [x0, y0, x1, y1] = g.s.box; label(ctx, (g.dir < 0 ? '👋 ' : '') + g.c.nm + (g.dir > 0 ? ' 👋' : ''), g.m.x * TW, g.m.y * TH + (y1 - y0) * sc / 2 + 16, { size: 11, free: true, alpha: g.a * Math.min(1, (3.5 - g.t) / 0.8) }); } }
}
/* tank clock pill (tank bar; hidden in wallpaper with the rest of the chrome) */
function tlPill(now) {
  if (now - TL.pillAt < 1000) return; TL.pillAt = now; const el = $('todPill'); if (!el) return;
  const h = TL.h, hh = Math.floor(h), mm = Math.floor((h - hh) * 60), ic = TL.feed ? '🍽️' : TL.N > 0.6 ? '🌙' : TL.W > 0.35 ? '🌅' : '☀️', sep = lang === 'id' || lang === 'ms' ? '.' : ':';
  el.textContent = ic + ' ' + String(hh).padStart(2, '0') + sep + String(mm).padStart(2, '0'); const tip = T(TL.feed ? 'tankFeed' : 'tankClock'); el.title = tip; el.setAttribute('aria-label', tip);
  doc.documentElement.classList.toggle('dq-night', TL.N > 0.6);
}
root.DQTank = { TL, at: (h, run) => { tankPin = { h, t0: performance.now(), run: !!run }; tlUpdate(); }, live: () => { tankPin = null; tlUpdate(); }, snailAt, shrimpAt, airB, filtB, rings, goneFx, feed: feedingTime, filterAt, lightAt };

/* t330u: a new creature gets a shared 3-2-1 countdown (timed from c.at + 3 s in room time, so every device counts together),
   then it is thrown in from above the water line with a spin, splashes in (foam ring, droplets, ripples, bubble trail)
   and sinks/settles before it starts swimming normally. Late arrivals skip straight to the throw. */
const DROP = { cd: 3000, fall: 0.8, sink: 1.2 }, splashFx = [];
function dropPlan(c, m) {
  let rem = (+c.at || 0) + DROP.cd - nowMs(); if (rem < -1500) return false; if (!(rem < DROP.cd + 1200)) rem = DROP.cd; // clock skew guard
  const r = hrng('drop' + c.id); m.lx = 0.4 + r() * 0.2; m.dir = r() < 0.5 ? -1 : 1;
  m.drop = { t0: performance.now() + Math.max(0, rem), n: 0, ent: 0, ph: 0, whoosh: 0 }; m.fa = 1; m.fin = 0; m.splash = 0; m.x = m.lx; m.y = -0.4; m.rot = 0; m.c = 0;
  m.face = m.faceS = m.dir; return true;
}
function dropSplash(m) {
  const x = m.lx * TW, U = clamp(TH / 450, 0.8, 1.6);
  for (let i = 0; i < 16; i++) { const a = rand(-Math.PI * 0.95, -Math.PI * 0.05); splashFx.push({ x: x + rand(-10, 10) * U, y: 12 * U, vx: Math.cos(a) * rand(40, 150) * U, vy: Math.sin(a) * rand(20, 120) * U + 40 * U, r: rand(1.6, 3.6) * U, t: 0, life: rand(0.5, 0.9) }); }
  splashFx.push({ ring: 1, x, y: 9 * U, t: 0, life: 0.9, U }); splashFx.push({ ring: 1, x, y: 9 * U, t: -0.18, life: 0.9, U, w: 1 });
  ripples.push({ x: m.lx, t: 0 }, { x: m.lx - 0.015, t: -0.2 }, { x: m.lx + 0.015, t: -0.35 });
  for (let i = 0; i < 14; i++) bursts.push({ x: m.lx + rand(-0.02, 0.02), y: rand(0.06, 0.2), d: i * 0.05, r: rand(1.2, 3.4), s: rand(0.06, 0.14), w: rand(0, 6) });
  SFX.splash(); if (root.DQDrop) root.DQDrop.splashes++;
}
function stepDrop(m, dt) {
  const d = m.drop; if (!d) return false; const el = (performance.now() - d.t0) / 1000;
  if (el < 0) { d.ph = 0; const n = Math.min(3, Math.ceil(-el)); if (n !== d.n) { d.n = n; SFX.tick(n); } return true; }
  const hh = 80 / TH;
  if (el < DROP.fall) { // thrown in: short arc from the throw side, spinning, accelerating down
    d.ph = 1; if (!d.whoosh) { d.whoosh = 1; SFX.whoosh(); }
    const k = el / DROP.fall; m.x = m.lx - m.dir * 0.06 * (1 - k) * (1 - k); m.y = -hh - 0.04 + (hh + 0.1) * k * k;
    m.rot = REDUCED ? 0 : m.dir * (1 - k) * 2 * Math.PI * 1.15; m.amp = 14; m.freq = 15; m.phase += m.freq * dt; m.c = 0.6 + 0.4 * Math.sin(el * 20); return true;
  }
  if (!d.ent) { d.ent = 1; dropSplash(m); }
  const e = (el - DROP.fall) / DROP.sink;
  if (e < 1) { // splashed in: sink with drag, wobble settles, a few trailing bubbles
    d.ph = 2; const ease = 1 - (1 - e) * (1 - e) * (1 - e); m.y = 0.06 + 0.2 * ease; m.x = m.lx + m.dir * 0.03 * ease;
    m.rot = REDUCED ? 0 : m.dir * 0.45 * (1 - e) * Math.sin(e * 13); m.amp = 10 * (1 - e) + 4; m.freq = 10; m.phase += m.freq * dt; m.c = 0;
    if (Math.random() < dt * 9 && bursts.length < 60) bursts.push({ x: m.x + rand(-0.008, 0.008), y: m.y, d: 0, r: rand(1, 2.4), s: rand(0.05, 0.1), w: rand(0, 6) });
    return true;
  }
  m.drop = null; m.rot = 0; m.vx = m.dir * 0.04; m.vy = 0.008; m.mode = 1; m.modeT = rand(2, 4); newTarget(m); return false;
}
/* countdown cue above the landing spot: dashed drop line + target ring on the surface + popping number badge + name */
function drawDropCue(ctx, m) {
  const d = m.drop, el = (performance.now() - d.t0) / 1000, n = Math.min(3, Math.max(1, Math.ceil(-el))), f = 1 - ((-el) % 1 || 1), U = clamp(TH / 450, 0.85, 1.6), x = m.lx * TW, by = 46 * U;
  const pop = REDUCED ? 1 : 1 + 0.45 * Math.max(0, 1 - f * 5) - 0.06 * Math.max(0, f - 0.85) / 0.15, now = performance.now() / 1000;
  ctx.save();
  ctx.globalAlpha = 0.55 + 0.25 * Math.sin(now * 8); ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 1.6 * U; ctx.setLineDash([5 * U, 6 * U]); ctx.lineDashOffset = -now * 30;
  ctx.beginPath(); ctx.moveTo(x, by + 26 * U); ctx.lineTo(x, TH * 0.24); ctx.stroke(); ctx.setLineDash([]);
  const rr = (1 - f) * 18 * U + 8 * U; ctx.globalAlpha = 0.35 + 0.5 * f; ctx.beginPath(); ctx.ellipse(x, TH * 0.24, rr * 1.6, rr * 0.45, 0, 0, Math.PI * 2); ctx.stroke();
  ctx.globalAlpha = 1; const R = 21 * U * pop; ctx.shadowColor = 'rgba(0,40,70,.35)'; ctx.shadowBlur = 8 * U; ctx.shadowOffsetY = 2 * U;
  ctx.fillStyle = n === 1 ? '#ff7a6b' : '#ffffff'; ctx.beginPath(); ctx.arc(x, by, R, 0, Math.PI * 2); ctx.fill(); ctx.shadowColor = 'transparent';
  ctx.lineWidth = 3 * U; ctx.strokeStyle = n === 1 ? '#fff' : '#ff9a3c'; ctx.stroke();
  ctx.lineWidth = 3 * U; ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.beginPath(); ctx.arc(x, by, R + 6 * U, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - f)); ctx.stroke();
  ctx.fillStyle = n === 1 ? '#fff' : '#e8601c'; ctx.font = '800 ' + Math.round(24 * U * pop) + 'px system-ui,-apple-system,"Segoe UI",Roboto,sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(String(n), x, by + 1);
  ctx.restore();
  label(ctx, (m.k === 'jelly' ? '🪼 ' : '🐟 ') + (m.cr ? m.cr.nm : ''), x, by + R + 16 * U, { size: Math.round(11 * U), free: true });
}
function drawSplash(ctx, dt) {
  if (!splashFx.length) return; ctx.save();
  for (let i = splashFx.length - 1; i >= 0; i--) { const p = splashFx[i]; p.t += dt; if (p.t > p.life) { splashFx.splice(i, 1); continue; } if (p.t < 0) continue; const k = p.t / p.life;
    if (p.ring) { ctx.globalAlpha = (1 - k) * 0.85; ctx.strokeStyle = '#fff'; ctx.lineWidth = (p.w ? 1.4 : 2.6) * p.U * (1 - k * 0.6); ctx.beginPath(); ctx.ellipse(p.x, p.y, (12 + k * (p.w ? 70 : 48)) * p.U, (4 + k * (p.w ? 12 : 9)) * p.U, 0, 0, Math.PI * 2); ctx.stroke();
      if (!p.w && k < 0.4) { const g = ctx.createRadialGradient(p.x, p.y + 8 * p.U, 0, p.x, p.y + 8 * p.U, 46 * p.U); g.addColorStop(0, 'rgba(255,255,255,' + (0.55 * (1 - k / 0.4)).toFixed(3) + ')'); g.addColorStop(1, 'rgba(255,255,255,0)'); ctx.globalAlpha = 1; ctx.fillStyle = g; ctx.fillRect(p.x - 46 * p.U, p.y - 38 * p.U, 92 * p.U, 92 * p.U); } continue; }
    p.vy += 260 * dt; p.vx *= 1 - dt * 1.5; p.x += p.vx * dt; p.y += p.vy * dt; ctx.globalAlpha = 1 - k; ctx.fillStyle = 'rgba(235,250,255,.95)'; ctx.beginPath(); ctx.arc(p.x, p.y, p.r * (1 - 0.4 * k), 0, Math.PI * 2); ctx.fill(); }
  ctx.restore();
}
/* t331u: leavers (culled / deleted) swim off to the nearer side edge instead of fading on the spot, waving their name tag */
function leaveFx(m, c, s) {
  if (!m || !c || !s || goneFx.length >= 12 || m.drop && m.drop.ph === 0) return false; if (m.fa != null && m.fa <= 0.3) return false;
  const dir = m.x < 0.5 ? -1 : 1; m.follow = null; m.feed = null; m.drop = null; m.rot = 0; m.fin = 0;
  goneFx.push({ m, c, s, a: 1, t: 0, dir }); return true;
}
function stepLeave(g, dt) {
  const m = g.m, dir = g.dir; g.t += dt; const sp = Math.min(0.32, 0.07 + g.t * 0.16), k = Math.min(1, dt * 2.5);
  if (g.c.k === 'jelly') { stepJelly(m, dt); m.drift = 0; m.x += dir * sp * 0.55 * dt; return; }
  m.face = dir; m.faceS += (dir - m.faceS) * Math.min(1, dt * 6); m.vx += (dir * sp - m.vx) * k; m.vy += ((clamp(m.y, 0.15, 0.7) - m.y) * 0.3 - m.vy) * k;
  m.x += m.vx * dt; m.y += m.vy * dt * TW / TH; m.amp += (16 - m.amp) * Math.min(1, dt * 4); m.freq += (13 - m.freq) * Math.min(1, dt * 4); m.phase += m.freq * dt; m.tilt = 0;
}
root.DQDrop = { DROP, splashFx, splashes: 0, leaves: 0 };

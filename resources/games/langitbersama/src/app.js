/* Langit Bersama: UI, i18n (id/en), shared sky + hill walkway animation, global wind, drawing board, open chat, presence, GM persistence. */
(function (root) {
'use strict';
const doc = document, $ = id => doc.getElementById(id), DQ = root.DQ, N = root.DQNet;
const CFG = JSON.parse($('website-config').textContent);
const getLS = k => { try { return localStorage.getItem(k) || ''; } catch (e) { return ''; } };
const setLS = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* private mode / quota */ } };
const fmt = (s, v) => String(s).replace(/\{(\w+)\}/g, (m, k) => v && v[k] !== undefined ? v[k] : m);
const REDUCED = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
/* t243u: ?wallpaper (key presence, case-insensitive, value ignored — like ?gmjd) = aquarium-only TV/fullscreen mode: no chrome, no gate, no click targets */
const WP = (() => { try { return [...new URLSearchParams(root.location.search).keys()].some(k => k.toLowerCase() === 'wallpaper'); } catch (e) { return false; } })();
if (WP) doc.documentElement.classList.add('wp', 'jr-hub-off');
const KEYS = { name: 'langitbersama.name', av: 'langitbersama.av', lang: 'langitbersama.lang', uid: 'langitbersama.uid', gm: 'langitbersama.gm', tank: 'langitbersama.tank' };
const PAL = CFG.palette, B = DQ.BOARD, W8 = DQ.WIDTHS;
const reduce = !!(root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches);
const LANGS = CFG.langs;
function detectLang() {
  const saved = getLS(KEYS.lang); if (LANGS.includes(saved)) return saved;
  const list = (navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || '']).map(x => String(x).toLowerCase());
  for (const l of list) { const p = l.split('-')[0]; if (p === 'in') return 'id'; if (LANGS.includes(p)) return p; }
  return 'id';
}
let lang = detectLang();
const T = (k, v) => { const a = CFG.text[lang] || CFG.text.id; const x = a[k] !== undefined ? a[k] : (CFG.text.id[k] !== undefined ? CFG.text.id[k] : k); return fmt(x, v); };
/* GM is server-owned: typed code → POST rooms/{code}/gamemaster; the #gamemaster hash alone grants nothing */
let isGM = false, gmUI = null;
let uid = getLS(KEYS.uid); if (!/^[A-Za-z0-9]{10}$/.test(uid)) { uid = DQ.rid().replace(/[^A-Za-z0-9]/g, 'x'); setLS(KEYS.uid, uid); }
let myName = DQ.cleanText(getLS(KEYS.name), DQ.LIM.nameMax);
let myAv = Math.max(0, Math.min(CFG.avatars.length - 1, parseInt(getLS(KEYS.av), 10) || 0));
const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const hashStr = s => { let h = 2166136261; for (const ch of String(s)) { h ^= ch.codePointAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };

/* ---------- toasts ---------- */
/* ---------- soft WebAudio SFX (no assets) ---------- */
let muted = getLS('langitbersama.mute') === '1', actx = null, lastSfx = {};
function ac() { if (muted) return null; try { if (!actx) { const A = root.AudioContext || root.webkitAudioContext; if (!A) return null; actx = new A(); } if (actx.state === 'suspended') actx.resume(); return actx; } catch (e) { return null; } }
function tone(f0, f1, dur, vol, type, delay) {
  const a = ac(); if (!a) return; const t = a.currentTime + (delay || 0), o = a.createOscillator(), g = a.createGain();
  o.type = type || 'sine'; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.015); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(a.destination); o.start(t); o.stop(t + dur + 0.05);
}
const SFX = {
  ok(k, gap) { const n = Date.now(); if (muted || doc.visibilityState === 'hidden' || n - (lastSfx[k] || 0) < gap) return false; lastSfx[k] = n; return true; },
  splash() { if (!this.ok('splash', 600)) return; const a = ac(); if (!a) return; const len = 0.6, b = a.createBuffer(1, Math.floor(a.sampleRate * len), a.sampleRate), d = b.getChannelData(0); for (let i = 0; i < d.length; i++) { const k = i / d.length; d[i] = (Math.random() * 2 - 1) * Math.sin(Math.PI * k) * (1 - k); } const src = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain(); f.type = 'bandpass'; f.Q.value = 0.8; f.frequency.setValueAtTime(400, a.currentTime); f.frequency.exponentialRampToValueAtTime(1800, a.currentTime + len); g.gain.value = 0.08; src.buffer = b; src.connect(f); f.connect(g); g.connect(a.destination); src.start(); tone(1046, 1050, 0.3, 0.03, 'sine', 0.25); tone(1568, 1570, 0.35, 0.025, 'sine', 0.34); },
  ping() { if (!this.ok('ping', 1500)) return; tone(880, 1320, 0.12, 0.04); tone(1320, 1500, 0.1, 0.03, 'sine', 0.09); },
  tap() { if (!this.ok('tap', 80)) return; tone(700, 900, 0.05, 0.025, 'triangle'); },
  tick(n) { if (!this.ok('tick' + n, 300)) return; const f = n === 1 ? 1318 : 988; tone(f, f * 1.003, 0.14, 0.03, 'sine'); tone(f * 2, f * 2, 0.08, 0.008, 'sine', 0.004); }, // t346u incoming countdown (wind-chime tick)
};
/* ---------- Langit Bersama soundscape (pure Web Audio, no files): "afternoon on a breezy hill".
   Bed: soft wind (pink noise → bandpass whose level + centre follow the SHARED wind strength) + low air rumble (brown → LP 160 Hz).
   Events (AMB.ev): bird chirps by day (2–3 sine sweeps 2.2–4.4 kHz, panned), crickets at night, leaf rustle on gusts, whoosh when a creation arrives.
   All through AMB.bus (fades with mute/visibility); every voice enveloped (no clicks). */
const AMB = { vol: 0.6, on: false, target: 0, bus: null, timer: 0, tr: 0, gest: false, susp: 0, wn: null, wind: null, windF: null };
function nbuf(a, sec, brown, ch) {
  const sr = a.sampleRate, len = Math.floor(sr * sec), fade = Math.floor(sr * 0.5), b = a.createBuffer(ch || 1, len, sr);
  for (let c = 0; c < (ch || 1); c++) { const d = b.getChannelData(c); let v = 0, p0 = 0, p1 = 0, p2 = 0;
    for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; if (brown) { v = (v + 0.02 * w) / 1.02; d[i] = v * 3.2; } else { p0 = 0.997 * p0 + w * 0.029; p1 = 0.985 * p1 + w * 0.032; p2 = 0.95 * p2 + w * 0.048; d[i] = (p0 + p1 + p2 + w * 0.02) * 2.2; } }
    for (let i = 0; i < fade; i++) { const k = i / fade; d[i] = d[i] * k + d[len - fade + i] * (1 - k); } } // seamless loop
  return { b, end: (len - fade) / sr };
}
function loopSrc(a, nb, off) { const s = a.createBufferSource(); s.buffer = nb.b; s.loop = true; s.loopEnd = nb.end; s.start(a.currentTime, off || 0); return s; }
function filt(a, type, f, q) { const x = a.createBiquadFilter(); x.type = type; x.frequency.value = f; if (q != null) x.Q.value = q; return x; }
function lfo(a, hz, depth, param) { const o = a.createOscillator(), g = a.createGain(); o.frequency.value = hz; g.gain.value = depth; o.connect(g); g.connect(param); o.start(); }
function ambBuild(a) {
  const bus = a.createGain(); bus.gain.value = 0; bus.connect(a.destination); AMB.bus = bus;
  AMB.ev = a.createGain(); AMB.ev.gain.value = 2.2; AMB.ev.connect(bus);
  const brown = nbuf(a, 7, true, 2), pink = nbuf(a, 6, false, 2); AMB.wn = nbuf(a, 1, false, 1).b;
  { const s = loopSrc(a, brown, 0), lp = filt(a, 'lowpass', 160, 0.3), hp = filt(a, 'highpass', 35, 0.5), g = a.createGain(); g.gain.value = 0.05; s.connect(lp); lp.connect(hp); hp.connect(g); g.connect(bus); lfo(a, 0.07, 0.015, g.gain); }
  { const s = loopSrc(a, pink, 1.7), bp = filt(a, 'bandpass', 520, 0.7), lp = filt(a, 'lowpass', 2400, 0.3), g = a.createGain(); g.gain.value = 0.02;
    s.connect(bp); bp.connect(lp); lp.connect(g); g.connect(bus); lfo(a, 0.13, 0.006, g.gain); lfo(a, 0.051, 90, bp.frequency); AMB.wind = g; AMB.windF = bp; }
  { const s = loopSrc(a, pink, 3.1), hp = filt(a, 'highpass', 900, 0.5), lp = filt(a, 'lowpass', 5200, 0.4), g = a.createGain(); g.gain.value = 0; s.connect(hp); hp.connect(lp); lp.connect(g); g.connect(bus); AMB.rain = g; } // t309u: soft rain hiss bed, follows RAIN.k
}
const ambLive = () => !!(AMB.on && actx && AMB.bus && actx.state === 'running');
function panOut(a, node, pan) { if (!a.createStereoPanner) return node; const p = a.createStereoPanner(); p.pan.value = clamp(pan, -0.9, 0.9); node.connect(p); return p; }
function env(g, t, v, att, dec) { g.gain.value = 0; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, v), t + att); g.gain.exponentialRampToValueAtTime(0.0001, t + att + dec); }
function grain(a, t, f, q, v, att, dec, pan, type) {
  const s = a.createBufferSource(), bf = filt(a, type || 'bandpass', f, q), g = a.createGain(); s.buffer = AMB.wn; env(g, t, v, att, dec);
  s.connect(bf); bf.connect(g); panOut(a, g, pan).connect(AMB.ev); s.start(t, Math.random() * 0.8, att + dec + 0.05);
}
function chirpNote(a, t, f0, f1, d, v, pan) { const o = a.createOscillator(), g = a.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + d); env(g, t, v, 0.006, d); o.connect(g); panOut(a, g, pan).connect(AMB.ev); o.start(t); o.stop(t + d + 0.05); }
/** called every ~1 s from the frame loop: wind bed follows the shared wind */
function ambWind(w) { if (!ambLive() || !AMB.wind) return; const t = actx.currentTime, k = Math.abs(w); AMB.wind.gain.setTargetAtTime(0.012 + 0.05 * k * k, t, 1.2); AMB.windF.frequency.setTargetAtTime(380 + 520 * k, t, 1.5); if (AMB.rain) AMB.rain.gain.setTargetAtTime(0.06 * RAIN.k, t, 1.5); }
function ambTick() {
  clearTimeout(AMB.timer); if (!AMB.on) return;
  if (ambLive()) { const a = actx, t0 = a.currentTime + 0.02, pan = rand(-0.75, 0.75);
    if (RAIN.k > 0.35) {} // birds shelter from the rain
    else if (TOD.night < 0.5) { const n = 2 + (Math.random() * 3 | 0), base = rand(2200, 3600); for (let i = 0; i < n; i++) { const f = base * rand(0.85, 1.25); chirpNote(a, t0 + i * rand(0.09, 0.16), f, f * rand(1.15, 1.5), rand(0.05, 0.09), rand(0.004, 0.009), pan); } }
    else { for (let i = 0; i < 3; i++) chirpNote(a, t0 + i * 0.07, 4600, 4500, 0.035, 0.003, pan); } }
  AMB.timer = setTimeout(ambTick, rand(2600, 8000));
}
const xPan = x => (clamp(x, 0, 1) - 0.5) * 1.5;
const LIFE = {
  last: {}, ok(k, gap) { const n = Date.now(); if (!ambLive() || n - (this.last[k] || 0) < gap) return false; this.last[k] = n; return true; },
  rustle(x, k) { if (!this.ok('rustle', 1800)) return; const a = actx, t = a.currentTime + 0.02, p = xPan(x); for (let i = 0; i < 9; i++) grain(a, t + i * rand(0.04, 0.12), rand(2600, 6000), 0.8, rand(0.004, 0.01) * (0.5 + k), 0.01, rand(0.04, 0.1), p + rand(-0.3, 0.3), 'highpass'); },
  whoosh(x) { if (!this.ok('whoosh', 600)) return; const a = actx, t = a.currentTime + 0.01; grain(a, t, 900, 0.6, 0.03, 0.12, 0.45, xPan(x)); },
  sparkle(x) { if (!this.ok('sparkle', 1500)) return; const a = actx, t = a.currentTime + 0.01; [1568, 2093, 2637].forEach((f, i) => chirpNote(a, t + i * 0.06, f, f * 1.01, 0.25, 0.004, xPan(x))); },
};
function ambSync() {
  const want = !muted && AMB.gest && doc.visibilityState !== 'hidden';
  if (want) { const a = ac(); if (!a) return; try { if (!AMB.bus) ambBuild(a); } catch (e) { return; } clearTimeout(AMB.susp); }
  if (!actx || !AMB.bus) { AMB.on = false; AMB.target = 0; return; }
  const a = actx, t = a.currentTime, g = AMB.bus.gain; AMB.target = want ? AMB.vol : 0;
  g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.linearRampToValueAtTime(AMB.target, t + (want ? 1 : 0.6));
  if (want && !AMB.on) { AMB.on = true; AMB.timer = setTimeout(ambTick, 1800); }
  if (!want) { AMB.on = false; clearTimeout(AMB.timer); clearTimeout(AMB.susp); AMB.susp = setTimeout(() => { if (!AMB.on && actx && actx.state === 'running') actx.suspend().catch(() => {}); }, 900); }
}
function ambGesture() { if (AMB.gest) return; AMB.gest = true; ambSync(); }
['pointerdown', 'keydown', 'touchstart'].forEach(ev => doc.addEventListener(ev, ambGesture, { capture: true, passive: true }));
doc.addEventListener('visibilitychange', ambSync);
root.DQAmb = { state: () => ({ on: AMB.on, target: AMB.target, built: !!AMB.bus, gest: AMB.gest, ctx: actx ? actx.state : 'none' }), sync: ambSync };
function toast(msg, warn) {
  const el = doc.createElement('div'); el.className = 'toast' + (warn ? ' warn' : ''); el.textContent = msg; $('toasts').appendChild(el);
  setTimeout(() => el.remove(), warn ? 4800 : 3200);
}

/* ---------- silhouettes (board coords 480x360; birds + planes face right) ---------- */
const P2 = () => new Path2D();
const KITE = (() => {
  const d = P2(); d.moveTo(240, 26); d.lineTo(398, 150); d.lineTo(240, 302); d.lineTo(82, 150); d.closePath();
  const v = P2(); v.moveTo(240, 26); v.lineTo(240, 302); const h = P2(); h.moveTo(82, 150); h.lineTo(398, 150);
  const bow = P2(); bow.moveTo(240, 302); bow.quadraticCurveTo(225, 330, 248, 346);
  return { fill: [d], guide: [v, h, bow], box: [82, 26, 398, 302] };
})();
const BIRD = (() => {
  const body = P2(); body.ellipse(250, 214, 104, 56, -0.08, 0, Math.PI * 2);
  const head = P2(); head.arc(348, 168, 44, 0, Math.PI * 2);
  const beak = P2(); beak.moveTo(386, 156); beak.lineTo(432, 170); beak.lineTo(386, 184); beak.closePath();
  const wing = P2(); wing.moveTo(196, 196); wing.bezierCurveTo(150, 120, 150, 70, 168, 48); wing.bezierCurveTo(236, 84, 286, 140, 300, 196); wing.closePath();
  const tail = P2(); tail.moveTo(156, 204); tail.lineTo(70, 168); tail.lineTo(88, 214); tail.lineTo(70, 258); tail.closePath();
  const eye = P2(); eye.arc(360, 158, 8, 0, Math.PI * 2);
  return { fill: [tail, body, head, beak, wing], guide: [eye], box: [70, 48, 432, 270], wingY: 198 };
})();
const BALLOON = (() => {
  const b = P2(); b.moveTo(240, 278); b.bezierCurveTo(150, 236, 128, 170, 132, 132); b.bezierCurveTo(138, 62, 190, 26, 240, 26); b.bezierCurveTo(290, 26, 342, 62, 348, 132); b.bezierCurveTo(352, 170, 330, 236, 240, 278); b.closePath();
  const knot = P2(); knot.moveTo(228, 292); knot.lineTo(240, 274); knot.lineTo(252, 292); knot.closePath();
  const shine = P2(); shine.moveTo(178, 92); shine.quadraticCurveTo(190, 64, 218, 56);
  return { fill: [b, knot], guide: [shine], box: [128, 26, 352, 292] };
})();
const PLANE = (() => {
  const top = P2(); top.moveTo(40, 96); top.lineTo(440, 172); top.lineTo(176, 192); top.closePath();
  const low = P2(); low.moveTo(176, 192); low.lineTo(440, 172); low.lineTo(120, 280); low.closePath();
  const keel = P2(); keel.moveTo(176, 192); keel.lineTo(150, 236); keel.lineTo(300, 184);
  return { fill: [top, low], guide: [keel], box: [40, 96, 440, 280] };
})();
const CLOUD = (() => {
  const c = P2(); for (const [x, y, r] of [[148, 214, 70], [236, 168, 92], [334, 196, 80], [398, 238, 50], [92, 248, 44]]) { c.moveTo(x + r, y); c.arc(x, y, r, 0, Math.PI * 2); }
  c.moveTo(92, 292); c.lineTo(92, 236); c.lineTo(404, 236); c.lineTo(404, 288); c.quadraticCurveTo(404, 294, 396, 294); c.lineTo(98, 294); c.closePath();
  return { fill: [c], guide: [], box: [48, 76, 448, 294] };
})();
const SHAPES = { kite: KITE, bird: BIRD, balloon: BALLOON, plane: PLANE, cloud: CLOUD };
const SHAPE = k => SHAPES[k] || KITE;
const EMO = { kite: '🪁', bird: '🐦', balloon: '🎈', plane: '✈️', cloud: '☁️' };
function drawGuide(ctx, kind, strong) {
  const S = SHAPE(kind); ctx.save(); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  ctx.fillStyle = strong ? 'rgba(110,150,200,.24)' : 'rgba(110,150,200,.18)'; for (const p of S.fill) ctx.fill(p, 'nonzero');
  ctx.setLineDash([9, 8]); ctx.lineWidth = 3; ctx.strokeStyle = '#7aa6d6'; for (const p of S.fill) ctx.stroke(p); for (const p of S.guide) ctx.stroke(p);
  ctx.restore();
}
/* ---------- paint bucket (flood fill on the target canvas pixels) ----------
   The seed is in board coords; it is mapped through the ctx transform, so the same op replays on the 2x board,
   the 0.8x tank sprite and the previews. Region = connected pixels of similar colour (transparent counts as a colour,
   so erased holes behave like blank paper) that are on the same side of the dashed silhouette as the seed.
   So an empty fish fills its whole body, a closed doodle fills just inside the lines, and an open region outside the
   silhouette that leaks to the board edge is refused (it would paint the sprite as a rectangle). */
const hexRgb = h => { h = String(h).replace('#', ''); if (h.length === 3) h = h.replace(/./g, c => c + c); const n = parseInt(h, 16) || 0; return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
let floodLeak = false; // kept for API compat; fills never leak-refuse now
/** plain canvas flood fill: contiguous similar pixels only; the fish/jelly silhouette is just a visual guide and never takes part. returns filled pixel count (0 = nothing to do) */
function flood(ctx, kind, bx, by, hex) {
  const cv = ctx.canvas, W = cv.width, H = cv.height; if (!W || !H) return 0;
  const m = ctx.getTransform ? ctx.getTransform() : { a: W / B.w, b: 0, c: 0, d: H / B.h, e: 0, f: 0 };
  const x = clamp(Math.floor(m.a * bx + m.c * by + m.e), 0, W - 1), y = clamp(Math.floor(m.b * bx + m.d * by + m.f), 0, H - 1);
  const img = ctx.getImageData(0, 0, W, H), d = img.data, n = W * H, rgb = hexRgb(hex), s0 = y * W + x;
  const ck = j => { const a = d[j + 3] / 255; return [d[j] * a + 255 * (1 - a), d[j + 1] * a + 255 * (1 - a), d[j + 2] * a + 255 * (1 - a), d[j + 3]]; };
  const t = ck(s0 * 4);
  if (t[3] > 200 && Math.abs(t[0] - rgb[0]) + Math.abs(t[1] - rgb[1]) + Math.abs(t[2] - rgb[2]) < 10) return 0;
  const match = q => { const j = q * 4, a = d[j + 3] / 255; return Math.abs(d[j] * a + 255 * (1 - a) - t[0]) + Math.abs(d[j + 1] * a + 255 * (1 - a) - t[1]) + Math.abs(d[j + 2] * a + 255 * (1 - a) - t[2]) + Math.abs(d[j + 3] - t[3]) <= 110; };
  const seen = new Uint8Array(n), stack = [s0]; seen[s0] = 1; let cnt = 1;
  const visit = q => { if (!seen[q]) { if (match(q)) { seen[q] = 1; stack.push(q); cnt++; } else seen[q] = 2; } };
  while (stack.length) { const p = stack.pop(), px = p % W; if (px > 0) visit(p - 1); if (px < W - 1) visit(p + 1); if (p >= W) visit(p - W); if (p < n - W) visit(p + W); }
  for (let p = 0; p < n; p++) if (seen[p]) { const j = p * 4; d[j] = rgb[0]; d[j + 1] = rgb[1]; d[j + 2] = rgb[2]; d[j + 3] = 255; } // boundary pixels too: hides anti-alias halos
  ctx.putImageData(img, 0, 0); return cnt;
}
/** paint decoded strokes onto ctx (board coords); returns the pixel count of the last bucket op (0 = it did nothing) */
function paint(ctx, strokes, kind) {
  const S = SHAPE(kind); let lastFill = -1;
  for (const st of strokes) {
    ctx.globalCompositeOperation = st.m === 'e' ? 'destination-out' : 'source-over';
    const col = PAL[st.c] || PAL[0];
    if (st.m === 'f') { ctx.fillStyle = col; for (const p of S.fill) ctx.fill(p); continue; }
    if (st.m === 'b') { if (st.p.length) lastFill = flood(ctx, kind, st.p[0][0], st.p[0][1], col); continue; }
    const w = W8[st.w - 1] || 6, p = st.p; if (!p.length) continue;
    ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    if (p.length === 1) { ctx.beginPath(); ctx.arc(p[0][0], p[0][1], w / 2, 0, Math.PI * 2); ctx.fill(); continue; }
    ctx.beginPath(); ctx.moveTo(p[0][0], p[0][1]);
    for (let i = 1; i < p.length - 1; i++) { const mx = (p[i][0] + p[i + 1][0]) / 2, my = (p[i][1] + p[i + 1][1]) / 2; ctx.quadraticCurveTo(p[i][0], p[i][1], mx, my); }
    ctx.lineTo(p[p.length - 1][0], p[p.length - 1][1]); ctx.stroke();
  }
  ctx.globalCompositeOperation = 'source-over';
  return lastFill;
}
function alphaBox(cv, q) {
  const W = cv.width, H = cv.height, d = cv.getContext('2d').getImageData(0, 0, W, H).data; let x0 = W, y0 = H, x1 = -1, y1 = -1;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (d[(y * W + x) * 4 + 3] > 8) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  if (x1 < 0) return [0, 0, B.w, B.h]; return [Math.max(0, Math.floor(x0 / q)), Math.max(0, Math.floor(y0 / q)), Math.min(B.w, Math.ceil((x1 + 1) / q)), Math.min(B.h, Math.ceil((y1 + 1) / q))];
}
/** t275u: where the ink really is (alpha scan, board coords) + the x of the lowest ink, so strings/tails hang from the drawing, not the canvas */
function inkScan(cv, q) {
  const W = cv.width, H = cv.height, d = cv.getContext('2d').getImageData(0, 0, W, H).data; let x0 = W, y0 = H, x1 = -1, y1 = -1;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (d[(y * W + x) * 4 + 3] > 40) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  if (x1 < 0) return null;
  const band = Math.max(2, Math.round((y1 - y0) * 0.04)); let sx = 0, n = 0;
  for (let y = y1 - band; y <= y1; y++) for (let x = x0; x <= x1; x++) if (d[(y * W + x) * 4 + 3] > 40) { sx += x; n++; }
  return { box: [x0 / q, y0 / q, (x1 + 1) / q, (y1 + 1) / q], bx: n ? sx / n / q : (x0 + x1) / 2 / q };
}
/** default pins from ink: string/tail at the bottom of the ink; bird wing hinge across the mid-height, left/right of centre (birds face right, so the head stays out) */
function defPins(kind, ink) {
  if (!ink || !DQ.PIN_N[kind]) return null; const [x0, y0, x1, y1] = ink.box, w = x1 - x0, h = y1 - y0, R = Math.round;
  if (kind === 'bird') { const hy = R(y0 + h * 0.5); return [R(x0 + w * 0.2), hy, R(x0 + w * 0.66), hy]; }
  return [R(ink.bx), R(Math.min(B.h, y1 - 1))];
}
function pinsOf(c, s) { if (c.pn && c.pn.length === DQ.PIN_N[c.k]) return c.pn; if (s.dp === undefined) s.dp = defPins(c.k, inkScan(s.cv, SPR_Q)); return s.dp || defPins(c.k, { box: s.box, bx: (s.box[0] + s.box[2]) / 2 }); }
function bboxOf(strokes, kind) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const st of strokes) {
    if (st.m === 'e') continue;
    if (st.m === 'f' || st.m === 'b') { const b = SHAPE(kind).box; x0 = Math.min(x0, b[0]); y0 = Math.min(y0, b[1]); x1 = Math.max(x1, b[2]); y1 = Math.max(y1, b[3]); continue; }
    const r = (W8[st.w - 1] || 6) / 2 + 1;
    for (const q of st.p) { x0 = Math.min(x0, q[0] - r); y0 = Math.min(y0, q[1] - r); x1 = Math.max(x1, q[0] + r); y1 = Math.max(y1, q[1] + r); }
  }
  if (!(x1 > x0)) return [0, 0, B.w, B.h];
  return [Math.max(0, Math.floor(x0)), Math.max(0, Math.floor(y0)), Math.min(B.w, Math.ceil(x1)), Math.min(B.h, Math.ceil(y1))];
}
const SPR_Q = 0.8, sprites = new Map();
function sprite(c) {
  let s = sprites.get(c.id); if (s && s.d === c.d) return s;
  const strokes = DQ.decode(c.d), cv = doc.createElement('canvas'); cv.width = Math.ceil(B.w * SPR_Q); cv.height = Math.ceil(B.h * SPR_Q);
  const ctx = cv.getContext('2d', { willReadFrequently: /;?[0-9a-f]1b/.test(c.d) }); ctx.scale(SPR_Q, SPR_Q); paint(ctx, strokes, c.k);
  s = { cv, d: c.d, box: strokes.some(st => st.m === 'b') ? alphaBox(cv, SPR_Q) : bboxOf(strokes, c.k) }; sprites.set(c.id, s); return s;
}
function drawStill(canvas, c) {
  const ctx = canvas.getContext('2d'), s = sprite(c), [x0, y0, x1, y1] = s.box, bw = x1 - x0, bh = y1 - y0;
  ctx.clearRect(0, 0, canvas.width, canvas.height); const sc = Math.min((canvas.width - 20) / bw, (canvas.height - 20) / bh, 1.2);
  ctx.drawImage(s.cv, x0 * SPR_Q, y0 * SPR_Q, bw * SPR_Q, bh * SPR_Q, (canvas.width - bw * sc) / 2, (canvas.height - bh * sc) / 2, bw * sc, bh * sc);
}
/* ---------- sky simulation (client-side; positions are not synced — wind and time of day are) ---------- */
const tank = $('tank'), tctx = tank.getContext('2d'), walk = $('walk'), wctx = walk.getContext('2d');
let TW = 800, TH = 450, WW = 800, WH = 120, DPR = 1, WDPR = 1, bgCanvas = null, bgPrev = null, bgFade = 0, bgAt = 0, bgDirty = false;
/* t307u perf: quality governor. Level 0 = full; each level lowers the tank pixel budget (DPR), particle counts and (lvl 3) caps at 30 fps.
   Steps down only when frames are really slow (long frames + main-thread work), never oscillates up within a session; ?perf=N forces a level. */
const COARSE = (() => { try { return root.matchMedia('(pointer:coarse)').matches || root.innerWidth <= 900; } catch (e) { return false; } })();
const PERF = { lvl: 0, forced: false, win: [], work: [], t0: performance.now(), lastDraw: 0, modal: false, tankVis: true, walkVis: true, vx0: 0, vx1: 1e9, cull: false, scrollAt: 0, bfxDirty: true, balDirty: true, changes: [] };
{ const q = parseInt(SKYQ0('perf'), 10); if (Number.isFinite(q)) { PERF.lvl = Math.max(0, Math.min(3, q)); PERF.forced = true; } else { let st = 0; try { st = parseInt(root.sessionStorage.getItem('langitbersama.perf') || '0', 10) || 0; } catch (e) {} PERF.lvl = Math.max(0, Math.min(3, st - 1)); } }
const PX_BUDGET = COARSE ? [1.9e6, 1.35e6, 0.95e6, 0.7e6] : [4.2e6, 3e6, 2.1e6, 1.5e6];
const PQ = () => [1, 0.75, 0.55, 0.45][PERF.lvl] * (COARSE ? 0.8 : 1);
function SKYQ0(k) { try { return new URLSearchParams(root.location.search).get(k); } catch (e) { return null; } }
const sim = new Map(); // id -> motion
/* fly area is a bit larger than the visible sky (the canvas clips), so creations use the edges too */
const SWIM = { x0: -0.06, x1: 1.06, y0: 0.02, y1: 0.78, tx0: -0.03, tx1: 1.03, ty0: 0.05, ty1: 0.72 };
const GROUND = 0.9; // where kite strings meet the hill (fraction of TH)
/* ---- shared global wind: a pure function of the synced server clock, so every visitor feels the same breeze ---- */
function windAt(ms) { const t = ms / 1000, P = Math.PI * 2; return clamp(0.58 * Math.sin(P * t / 420 + 0.7) + 0.3 * Math.sin(P * t / 137 + 1.3) + 0.12 * Math.sin(P * t / 41 + 0.4), -1, 1); }
let WIND = 0, windT = 0; // -1..1 (negative = blowing left)
const windKmh = w => Math.round(3 + Math.abs(w) * 27);
/* ---- t292u: accelerated SHARED sky clock — 60x: 1 real minute = 1 sky hour, a whole day/night = 24 real minutes.
   Derived from the synced server clock (room.now()), so every visitor sees the same sun, moon phase and eclipse.
   ?jam=18.5 pins the hour (screenshots), &hari=N picks the sky day (default 1), &jalan lets a pinned sky keep running at 60x. ---- */
const SKY_SPEED = 60, SKYQ = (() => { try { return new URLSearchParams(root.location.search); } catch (e) { return new URLSearchParams(''); } })();
const JAM = (() => { const n = parseFloat(SKYQ.get('jam')); return Number.isFinite(n) ? ((n % 24) + 24) % 24 : null; })();
let skyPin = JAM != null ? { S: (Number.isFinite(parseInt(SKYQ.get('hari'), 10)) ? parseInt(SKYQ.get('hari'), 10) : 1) * 24 + JAM, t0: performance.now(), run: SKYQ.has('jalan') } : null;
function skyHours() { if (skyPin) return skyPin.S + (skyPin.run ? (performance.now() - skyPin.t0) / 3600000 * SKY_SPEED : 0); let ms; try { ms = nowMs(); } catch (e) { ms = Date.now(); } return ms / 3600000 * SKY_SPEED; }
const hourNow = () => { const S = skyHours(); return ((S % 24) + 24) % 24; };
/* sky calendar (pure function of sky hours S): 6-night lunar cycle (= 2.4 real hours)
   night j: 0 bulan baru (+ hujan meteor), 1 sabit (+ Bintang Kejora at dusk), 2 separuh, 3 purnama (alternating: gerhana bulan merah / supermoon), 4 separuh susut, 5 sabit tua (+ Kejora at dawn)
   the day right after the new moon has a solar eclipse around noon (alternating total / cincin); a pelangi afternoon after the full moon */
const MOON_P = [0, 0.12, 0.25, 0.5, 0.75, 0.88], MOON_E = ['🌑', '🌒', '🌓', '🌕', '🌗', '🌘'], MOON_N = ['mBaru', 'mSabit', 'mParuh', 'mPurnama', 'mParuh', 'mSabitTua'];
const md = (a, b) => ((a % b) + b) % b;
function skyCal(S, noRain) {
  const k = Math.floor(S / 24), h = S - k * 24, n = Math.floor((S + 12) / 24), j = md(n, 6), cyc = Math.floor(n / 6), kd = md(k, 6), kc = Math.floor(k / 6), night = h >= 18.4 || h < 5.9, hn = h >= 12 ? h - 24 : h;
  const c = { S, k, h, n, j, moonP: MOON_P[j], ev: null, s: 0, id: '', rain: 0 };
  if (kd === 0 && h > 10.6 && h < 13.4) { c.ev = kc % 2 ? 'cincin' : 'total'; c.s = (h - 12) / 1.4; c.id = c.ev + k; }
  else if (j === 3 && night) { if (cyc % 2 === 0 && hn > -2.4 && hn < 2.4) { c.ev = 'merah'; c.s = hn / 2.4; } else if (cyc % 2 === 1) c.ev = 'super'; c.id = c.ev ? c.ev + n : ''; }
  else if (j === 0 && (h >= 19.4 || h < 4.9)) { c.ev = 'meteor'; c.id = 'meteor' + n; }
  else if ((j === 1 && h >= 18.3 && h < 21.6) || (j === 5 && h >= 3.6 && h < 6.3)) { c.ev = 'kejora'; c.id = 'kejora' + n + (h < 12 ? 'a' : 'b'); }
  else if (kd === 3 && h >= 13.4 && h < 16.6) { c.ev = 'pelangi'; c.id = 'pelangi' + k; }
  if (!c.ev && !noRain) { const w = rainWin(k); if (w && h >= w[0] && h < w[1]) { c.ev = w[2] ? 'hujan' : 'gerimis'; c.id = c.ev + k; c.rain = clamp(Math.min(h - w[0], w[1] - h) / 0.3, 0, 1) * (w[2] ? 1 : 0.45); } }
  return c;
}
/* t309u: kadang hujan — at most one shower per sky day (24 real min), picked by a hash of the day → every visitor gets the same rain.
   The day before the pelangi afternoon (kd 3) always rains 11.8-13.4 so the rainbow follows a shower. ~60% of the other days get one
   1-2.4 sky-hour shower (= 1-2.4 real minutes), light (gerimis) or heavier (hujan); skipped when it would overlap an eclipse / meteor / Kejora / pelangi. */
const rainC = new Map();
function rainWin(k) { if (rainC.has(k)) return rainC.get(k); const kd = md(k, 6), fr = x => x - Math.floor(x); let w = null;
  if (kd === 3) w = [11.8, 13.4, 1];
  else { let x = hashStr('lb-rain-' + k); x ^= x >>> 16; x = Math.imul(x, 0x85ebca6b); x ^= x >>> 13; x = Math.imul(x, 0xc2b2ae35); x ^= x >>> 16; const r = (x >>> 0) / 4294967296; /* fmix32: FNV alone barely moves its high bits between consecutive days */ if (r < 0.6) { const dur = 1 + fr(r * 7.31) * 1.4, st = 0.3 + fr(r * 13.7) * (23.4 - dur); w = [st, st + dur, fr(r * 31.1) > 0.55 ? 1 : 0];
    for (let i = 0; i <= 6 && w; i++) if (skyCal(k * 24 + w[0] + (w[1] - w[0]) * i / 6, true).ev) w = null; } }
  if (rainC.size > 64) rainC.clear(); rainC.set(k, w); return w; }
/* solar eclipse geometry in sun radii: d = moon offset (holds centred for a while so totality is readable), rm = moon radius, cov 0..1, dk = sky darkening */
function eclGeo(c) { if (c.ev !== 'total' && c.ev !== 'cincin') return null; const a = Math.abs(c.s), ds = Math.sign(c.s) * Math.max(0, a - 0.17) / 0.83, d = ds * 2.3, rm = c.ev === 'total' ? 1.07 : 0.86, cov = clamp((1 + rm - Math.abs(d)) / 2, 0, 1);
  const dk = c.ev === 'total' ? Math.pow(clamp((cov - 0.72) / 0.28, 0, 1), 1.6) : cov * 0.28; return { ev: c.ev, d, rm, cov, dk, tot: c.ev === 'total' && Math.abs(d) <= rm - 1 }; }
/* lunar eclipse: umbra (radius 1.5 moon radii) slides across; red = how deep in the umbra */
function lunGeo(c) { if (c.ev !== 'merah') return null; const a = Math.abs(c.s), ds = Math.sign(c.s) * Math.max(0, a - 0.22) / 0.78, d = ds * 2.6; return { d, red: clamp((2.5 - Math.abs(d)) / 2, 0, 1) }; }
let SKYC = skyCal(skyHours());
const SKY_KEYS = [ // hour, top, mid, horizon, night 0..1, warm 0..1 (t273u richer palette)
  [0, '#070f2e', '#16245a', '#2e3d78', 1, 0], [4.6, '#0f1846', '#2d2f70', '#5e4f8c', 0.9, 0.1], [5.8, '#2f4f9c', '#c48aa8', '#ffb98a', 0.35, 0.95], [6.6, '#3f74c4', '#e7a8b0', '#ffd8a0', 0.12, 0.8],
  [8, '#3b8fe6', '#93cdf4', '#fbe9c8', 0, 0.3], [10.5, '#2f8ae8', '#7dc2f4', '#d6f0ff', 0, 0], [15, '#3289e0', '#86c6f2', '#e2f3ff', 0, 0.05], [16.1, '#3482d8', '#b4cfe6', '#fde2ae', 0, 0.32],
  [17, '#3f78cc', '#f0c08e', '#ffd88a', 0, 0.7], [18.1, '#2d377f', '#d9688a', '#ff9a52', 0.15, 1], [18.9, '#1f2463', '#7a4c8c', '#e27a6c', 0.45, 0.75], [19.7, '#121a4c', '#3a3a7c', '#7a5a8a', 0.8, 0.3], [24, '#070f2e', '#16245a', '#2e3d78', 1, 0]];
const mixHex = (a, b, k) => { const A = hexRgb(a), Bc = hexRgb(b); return '#' + A.map((v, i) => Math.round(v + (Bc[i] - v) * k).toString(16).padStart(2, '0')).join(''); };
const TOD = { h: 12, top: '#3f9ef0', mid: '#86c9f6', hor: '#d8f0ff', night: 0, warm: 0, key: '' };
function todUpdate() {
  const h = hourNow(); let i = 0; while (i < SKY_KEYS.length - 2 && SKY_KEYS[i + 1][0] <= h) i++;
  const a = SKY_KEYS[i], b = SKY_KEYS[i + 1], k = clamp((h - a[0]) / (b[0] - a[0]), 0, 1);
  Object.assign(TOD, { h, top: mixHex(a[1], b[1], k), mid: mixHex(a[2], b[2], k), hor: mixHex(a[3], b[3], k), night: a[4] + (b[4] - a[4]) * k, warm: a[5] + (b[5] - a[5]) * k });
  // t292u: a solar eclipse darkens the day sky (totality: deep blue zenith, stars out, a 360° sunset glow on the horizon)
  SKYC = skyCal(skyHours()); const eg = eclGeo(SKYC); TOD.ecl = eg ? Math.round(eg.dk * 20) / 20 : 0;
  if (TOD.ecl > 0) { const q = TOD.ecl; Object.assign(TOD, { top: mixHex(TOD.top, '#0c1240', q * 0.92), mid: mixHex(TOD.mid, '#2c2f6c', q * 0.85), hor: mixHex(TOD.hor, '#f0a66c', q * 0.8), night: Math.max(TOD.night, q * 0.82), warm: Math.max(TOD.warm, q * 0.45) }); }
  const key = TOD.top + TOD.mid + TOD.hor; if (key !== TOD.key) { TOD.key = key; return true; } return false;
}
todUpdate();
const todSnap = () => Object.assign({}, TOD);
/* t340u: TOD for an arbitrary sky hour, without eclipse darkening (wallpaper keyframes; the eclipse is a live overlay there) */
function todAt(h) { h = ((h % 24) + 24) % 24; let i = 0; while (i < SKY_KEYS.length - 2 && SKY_KEYS[i + 1][0] <= h) i++; const a = SKY_KEYS[i], b = SKY_KEYS[i + 1], k = clamp((h - a[0]) / (b[0] - a[0]), 0, 1);
  return { h, top: mixHex(a[1], b[1], k), mid: mixHex(a[2], b[2], k), hor: mixHex(a[3], b[3], k), night: a[4] + (b[4] - a[4]) * k, warm: a[5] + (b[5] - a[5]) * k, ecl: 0, key: '' }; }
function spawn(c, fresh) {
  const m = { id: c.id, k: c.k, x: rand(0.04, 0.96), y: rand(0.08, 0.6), vx: 0, vy: 0, tx: 0.5, ty: 0.4, mode: 1, modeT: rand(1, 4), targetT: 0, face: Math.random() < 0.5 ? -1 : 1, faceS: 1, phase: rand(0, 6), seed: rand(0, 10), born: performance.now(), alpha: 1, flap: 1 };
  m.faceS = m.face;
  if (c.k === 'kite') { m.ax = rand(0.08, 0.92); m.y = rand(0.1, 0.42); m.x = m.ax; m.hy = m.y; m.ang = 0; }
  if (c.k === 'balloon') { m.vy = -0.01; m.y = rand(0.15, 0.62); }
  if (c.k === 'plane') { m.a = Math.random() < 0.5 ? 0 : Math.PI; m.turn = 0; m.turnT = 0; m.loop = 0; m.y = rand(0.12, 0.55); }
  if (c.k === 'cloud') { m.y = rand(0.06, 0.42); m.sp = rand(0.6, 1.2); m.x = rand(-0.05, 1.05); }
  if (fresh) {
    m.fresh = 1;
    if (c.k === 'kite') { m.x = m.ax; m.y = 0.85; } // rises from the hill on its string
    else if (c.k === 'balloon') { m.x = rand(0.3, 0.7); m.y = 0.92; m.vy = -0.08; }
    else if (c.k === 'cloud') { m.alpha = 0; m.x = rand(0.25, 0.75); }
    else { const left = Math.random() < 0.5; m.x = left ? -0.06 : 1.06; m.y = rand(0.15, 0.45); m.face = m.faceS = left ? 1 : -1; if (c.k === 'plane') m.a = left ? -0.15 : Math.PI + 0.15; }
    arrivePlan(c, m); // t346u: shared 3-2-1 "incoming" cue, then a scripted entrance (late arrivals keep the plain entrance above)
  }
  newTarget(m); sim.set(c.id, m); return m;
}
function newTarget(m) {
  const r = Math.random();
  if (r < 0.3) { m.tx = Math.random() < 0.5 ? rand(SWIM.tx0, 0.12) : rand(0.88, SWIM.tx1); m.ty = Math.random() < 0.5 ? rand(SWIM.ty0, 0.18) : rand(0.5, SWIM.ty1); }
  else if (r < 0.55) { m.tx = Math.random() < 0.5 ? rand(SWIM.tx0, 0.1) : rand(0.9, SWIM.tx1); m.ty = rand(SWIM.ty0, SWIM.ty1); }
  else { m.tx = rand(SWIM.tx0, SWIM.tx1); m.ty = rand(SWIM.ty0, SWIM.ty1 * 0.85); }
  m.targetT = rand(5, 12);
}
const BIRD_SPEED = [0.035, 0.07, 0.15];
function pickMode(m) { if (Math.random() < 0.25) { const others = [...sim.values()].filter(o => o !== m && o.k === 'bird'); if (others.length) { const o = others[Math.floor(Math.random() * others.length)]; m.follow = o.id; m.mode = 1; m.modeT = rand(4, 8); return; } } m.follow = null; const r = Math.random(); m.mode = r < 0.35 ? 0 : r < 0.85 ? 1 : 2; m.modeT = m.mode === 2 ? rand(1.2, 2.6) : rand(3, 6); if (m.mode === 2) newTarget(m); }
function stepBird(m, dt) {
  m.modeT -= dt; if (m.modeT <= 0) pickMode(m);
  if (m.follow) { const o = sim.get(m.follow); if (!o) m.follow = null; else { m.tx = clamp(o.x - (o.face || 1) * 0.07, SWIM.x0, SWIM.x1); m.ty = clamp(o.y + 0.05, SWIM.y0, SWIM.y1); m.targetT = 1; } }
  m.targetT -= dt; const dx = m.tx - m.x, dy = (m.ty - m.y) * TH / TW, dist = Math.hypot(dx, dy);
  if (!m.follow && (dist < 0.03 || m.targetT <= 0)) newTarget(m);
  const sp = BIRD_SPEED[m.mode], k = Math.min(1, dt * 1.3);
  m.vx += ((dx / (dist || 1)) * sp + WIND * 0.02 - m.vx) * k; m.vy += ((dy / (dist || 1)) * sp * 0.6 - m.vy) * k;
  m.x += m.vx * dt; m.y += m.vy * dt * TW / TH;
  if (m.x < SWIM.x0) { m.x = SWIM.x0; m.vx = Math.abs(m.vx); } if (m.x > SWIM.x1) { m.x = SWIM.x1; m.vx = -Math.abs(m.vx); }
  m.y = clamp(m.y, SWIM.y0, SWIM.y1);
  if (m.vx > 0.006) m.face = 1; else if (m.vx < -0.006) m.face = -1;
  m.faceS += (m.face - m.faceS) * Math.min(1, dt * 5);
  const speed = Math.hypot(m.vx, m.vy), climbing = m.vy < -0.01, glide = m.mode === 0 && !climbing;
  m.phase += dt * (glide ? 0 : 7 + speed * 40); const target = glide ? 0.35 : Math.cos(m.phase); m.flap += (target - m.flap) * Math.min(1, dt * (glide ? 4 : 30));
  m.tilt = clamp((m.vy / (speed || 1)) * 0.35, -0.35, 0.35) * Math.sign(m.faceS || 1);
}
function stepKite(m, dt, t) {
  const w = WIND, strong = Math.abs(w);
  m.ax += rand(-0.004, 0.004) * dt; m.ax = clamp(m.ax, 0.05, 0.95);
  if (Math.random() < dt * 0.05) m.hy = rand(0.08, 0.42); // the flyer tugs / lets out string now and then
  const tx = clamp(m.ax + w * 0.22 + Math.sin(t * 0.37 + m.seed) * 0.05, -0.04, 1.04), ty = m.hy + (1 - strong) * 0.12 + Math.sin(t * 0.8 + m.seed * 2) * 0.025;
  m.x += (tx - m.x) * Math.min(1, dt * 0.6); m.y += (ty - m.y) * Math.min(1, dt * (m.fresh ? 0.5 : 0.8)); if (m.fresh && m.y < m.hy + 0.15) m.fresh = 0;
  /* t288u: rotation flicker fix. The sway used sin(t * (1.6 + |wind|)) with t = page seconds, and WIND stepped once a second,
     so every wind update jumped the phase by t * delta-freq (radians, growing with uptime) -> the kite snapped angle each second.
     Now: phases accumulate (freq change never jumps), and the angle follows its target through a damped spring. */
  if (m.ph1 == null) { m.ph1 = m.seed; m.ph2 = m.seed * 1.7; m.av = 0; }
  m.ph1 += dt * (1.6 + strong); m.ph2 += dt * (2.3 + strong * 0.8);
  const target = clamp(w * 0.35 + Math.sin(m.ph1) * (0.06 + strong * 0.1) + Math.sin(m.ph2) * 0.025 * strong, -0.6, 0.6);
  const K = 26, D = 2 * Math.sqrt(K) * 0.85; // slightly under-damped: soft, kite-like follow without jitter
  m.av += ((target - m.ang) * K - m.av * D) * dt; m.ang = clamp(m.ang + m.av * dt, -0.7, 0.7);
}
function stepBalloon(m, dt, t) {
  m.vy += ((m.y < 0.12 ? 0.012 : m.y > 0.66 ? -0.02 : -0.004 + Math.sin(t * 0.21 + m.seed) * 0.012) - m.vy) * Math.min(1, dt * (m.fresh ? 0.25 : 0.6));
  if (m.fresh && m.y < 0.6) m.fresh = 0;
  m.vx += (WIND * 0.035 + Math.sin(t * 0.17 + m.seed * 3) * 0.01 - m.vx) * Math.min(1, dt * 0.5);
  m.x += m.vx * dt; m.y += m.vy * dt;
  if (m.x < -0.1) m.x = 1.1; if (m.x > 1.1) m.x = -0.1; m.y = clamp(m.y, 0.04, 0.95);
  const bt = clamp(-m.vx * 4 + Math.sin(t * 1.1 + m.seed) * 0.05, -0.3, 0.3); m.ang = m.ang == null ? bt : m.ang + (bt - m.ang) * Math.min(1, dt * 4);
}
function stepPlane(m, dt, t) {
  const sp = 0.1 + Math.max(0, Math.cos(m.a) * WIND) * 0.04;
  m.turnT -= dt;
  // t288u: loop direction is fixed when the loop starts (was re-read from cos(a) every frame -> at the vertical it flipped back and forth = flicker)
  if (m.loop > 0) { const d = Math.min(m.loop, dt * 3.2); m.a -= d * (m.loopDir || 1); m.loop -= d; if (m.loop <= 0) m.a = Math.atan2(Math.sin(m.a), Math.cos(m.a)); }
  else {
    if (m.turnT <= 0) { m.turnT = rand(1.5, 4); m.turn = rand(-0.5, 0.5); if (!REDUCED && Math.random() < 0.12) { m.loop = Math.PI * 2; m.loopDir = Math.sign(Math.cos(m.a)) || 1; m.fl = Math.cos(m.a) < 0; } }
    if (m.y < 0.1) m.turn = Math.cos(m.a) > 0 ? 0.6 : -0.6; if (m.y > 0.66) m.turn = Math.cos(m.a) > 0 ? -0.6 : 0.6;
    m.a += m.turn * dt; const c = Math.cos(m.a); if (Math.abs(Math.sin(m.a)) > 0.55) m.a = Math.atan2(clamp(Math.sin(m.a), -0.55, 0.55), c); }
  m.x += Math.cos(m.a) * sp * dt; m.y += Math.sin(m.a) * sp * dt * TW / TH * 0.6;
  if (m.x > 1.14) { m.x = -0.12; m.y = rand(0.12, 0.6); } if (m.x < -0.14) { m.x = 1.12; m.y = rand(0.12, 0.6); }
  m.y = clamp(m.y, 0.03, 0.78);
}
function stepCloud(m, dt, t) {
  m.alpha = Math.min(1, m.alpha + dt * 0.5);
  m.x += (0.004 + WIND * 0.018) * m.sp * dt; if (m.x > 1.25) m.x = -0.25; if (m.x < -0.25) m.x = 1.25;
  m.y += Math.sin(t * 0.13 + m.seed) * 0.0008 * dt;
}
/* the mobile sky is wider (pans), but creations keep their on-screen size so the extra width is real sky */
const sizeW = () => (root.innerWidth <= 900 ? Math.min(TW, 860) : TW);
const TARGET = { kite: [0.07, 40, 74, 'h'], bird: [0.07, 36, 70, 'w'], balloon: [0.06, 38, 66, 'h'], plane: [0.075, 40, 74, 'w'], cloud: [0.15, 80, 150, 'w'] };
function scaleFor(c, s) { return DQ.sizeOf(c) * baseScale(c, s); }
function baseScale(c, s) { const [x0, y0, x1, y1] = s.box, T0 = TARGET[c.k] || TARGET.kite, px = clamp(sizeW() * T0[0], T0[1], T0[2]); return px / Math.max(T0[3] === 'h' ? y1 - y0 : x1 - x0, 190); }
function blit(ctx, s, sx0, sy0, sw, sh, dx, dy, dw, dh) { const q = SPR_Q; if (sw > 0 && sh > 0) ctx.drawImage(s.cv, sx0 * q, sy0 * q, sw * q, sh * q, dx, dy, dw, dh); }
function drawPlain(ctx, m, s, sc, rot, fx) {
  const [x0, y0, x1, y1] = s.box, cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  ctx.save(); ctx.translate(m.x * TW, m.y * TH); if (rot) ctx.rotate(rot); ctx.scale(sc * (fx || 1), sc); blit(ctx, s, x0, y0, x1 - x0, y1 - y0, x0 - cx, y0 - cy, x1 - x0, y1 - y0); ctx.restore();
}
/* t275u: only the ink above the wing hinge (between the two wing pins) flaps; head, tail and body stay put */
function drawBird(ctx, c, m, s, sc) {
  const [x0, y0, x1, y1] = s.box, cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, pn = pinsOf(c, s), f = clamp(m.flap, -0.6, 1);
  let wl = clamp(Math.min(pn[0], pn[2]), x0, x1), wr = clamp(Math.max(pn[0], pn[2]), x0, x1); const wy = clamp((pn[1] + pn[3]) / 2, y0, y1);
  if (wr - wl < 6) { wl = x0; wr = x1; }
  ctx.save(); ctx.translate(m.x * TW, m.y * TH + Math.sin(m.phase * 0.5) * 1.5); ctx.rotate(m.tilt || 0); ctx.scale(m.faceS * sc, sc);
  blit(ctx, s, x0, y0, wl - x0, y1 - y0, x0 - cx, y0 - cy, wl - x0, y1 - y0); // behind the wing (tail side)
  blit(ctx, s, wr, y0, x1 - wr, y1 - y0, wr - cx, y0 - cy, x1 - wr, y1 - y0); // in front of the wing (head side)
  blit(ctx, s, wl, wy, wr - wl, y1 - wy, wl - cx, wy - cy, wr - wl, y1 - wy); // body under the hinge
  if (wy > y0) { ctx.save(); ctx.translate(0, wy - cy); ctx.scale(1, Math.abs(f) < 0.08 ? 0.08 * Math.sign(f || 1) : f); blit(ctx, s, wl, y0, wr - wl, wy - y0 + 0.5, wl - cx, y0 - wy, wr - wl, wy - y0 + 0.5); ctx.restore(); }
  ctx.restore();
}
function kiteTail(ctx, c, m, s, sc, t) {
  const [x0, y0, x1, y1] = s.box, pn = pinsOf(c, s), bx = pn[0], by = pn[1], cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, ca = Math.cos(m.ang), sa = Math.sin(m.ang);
  const px = m.x * TW + ((bx - cx) * ca - (by - cy) * sa) * sc, py = m.y * TH + ((bx - cx) * sa + (by - cy) * ca) * sc;
  // string: gentle catenary from the kite's bridle down to the flyer on the hill
  const gx = m.ax * TW, gy = GROUND * TH, mx = (px + gx) / 2 - WIND * 30, my = (py + gy) / 2 + 26 + (1 - Math.abs(WIND)) * 18;
  ctx.save(); ctx.strokeStyle = TOD.night > 0.5 ? 'rgba(230,230,255,.55)' : 'rgba(60,60,70,.55)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(px, py); ctx.quadraticCurveTo(mx, my, gx, gy); ctx.stroke();
  // tail ribbon with bows, waving opposite the wind
  const col = PAL[hashStr(c.id) % 10 + 2] || '#ff5d5d', n = 8, L = Math.max(44, (y1 - y0) * sc * 1.25); let lx = px, ly = py;
  ctx.strokeStyle = col; ctx.lineWidth = Math.max(1.5, 2.2 * sc * 4); ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(lx, ly);
  const pts = [];
  for (let i = 1; i <= n; i++) { const f = i / n, wav = Math.sin(t * 5 + m.seed - i * 0.9) * (5 + 9 * f), nx = px - WIND * L * f * 1.2 + wav * 0.6, ny = py + L * f * (1 - Math.abs(WIND) * 0.45) + wav * 0.25; ctx.lineTo(nx, ny); pts.push([nx, ny]); }
  ctx.stroke(); ctx.fillStyle = col;
  for (const [i, p] of pts.entries()) if (i % 2) { const r = Math.max(3.5, 14 * sc); ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.lineTo(p[0] - r, p[1] - r * 0.6); ctx.lineTo(p[0] - r, p[1] + r * 0.6); ctx.closePath(); ctx.moveTo(p[0], p[1]); ctx.lineTo(p[0] + r, p[1] - r * 0.6); ctx.lineTo(p[0] + r, p[1] + r * 0.6); ctx.closePath(); ctx.fill(); }
  ctx.restore();
}
function balloonString(ctx, c, m, s, sc, t) {
  const [x0, y0, x1, y1] = s.box, pn = pinsOf(c, s), cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, ca = Math.cos(m.ang), sa = Math.sin(m.ang), dx = (pn[0] - cx) * sc, dy = (pn[1] - cy) * sc;
  const px = m.x * TW + dx * ca - dy * sa, py = m.y * TH + dx * sa + dy * ca, L = Math.max(30, 110 * sc * 1.6);
  ctx.save(); ctx.strokeStyle = TOD.night > 0.5 ? 'rgba(235,235,255,.6)' : 'rgba(80,80,90,.6)'; ctx.lineWidth = 1.1; ctx.beginPath(); ctx.moveTo(px, py);
  for (let i = 1; i <= 8; i++) { const f = i / 8; ctx.lineTo(px - m.vx * 400 * f * f + Math.sin(t * 2.4 + m.seed + f * 5) * 4 * f, py + L * f); } ctx.stroke(); ctx.restore();
}
/* t307u: name pills are cached bitmaps (was font + measureText + roundRect + fillText for every creature and visitor, every frame) */
const lblC = new Map();
function label(ctx, text, x, y, opt) {
  opt = opt || {}; if (!REDUCED) y += Math.sin(performance.now() / 600 + x * 0.05) * 1.2; const a = opt.alpha == null ? 1 : opt.alpha; if (a <= 0.01) return;
  const size = opt.size || 12, bg = opt.bg || 'rgba(255,255,255,.85)', fg = opt.fg || '#1d4f86', q = ctx === tctx ? DPR : WDPR, key = text + '\u0001' + size + bg + fg + q;
  let L = lblC.get(key);
  if (!L) { if (lblC.size > 160) lblC.clear(); const cv = doc.createElement('canvas'), c = cv.getContext('2d'), font = '600 ' + size + 'px system-ui,-apple-system,"Segoe UI",Roboto,sans-serif'; c.font = font;
    const w = c.measureText(text).width + 14, h = size + 8; cv.width = Math.ceil((w + 2) * q); cv.height = Math.ceil((h + 2) * q); c.scale(q, q); c.font = font; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillStyle = bg; c.beginPath(); if (c.roundRect) c.roundRect(1, 1, w, h, h / 2); else c.rect(1, 1, w, h); c.fill(); c.fillStyle = fg; c.fillText(text, 1 + w / 2, 1 + h / 2 + 0.5); L = { cv, w, h, W: cv.width / q, H: cv.height / q }; lblC.set(key, L); }
  const cw = ctx.canvas.width / q; if (!opt.free && cw > L.w + 4) x = clamp(x, L.w / 2 + 2, cw - L.w / 2 - 2);
  ctx.globalAlpha = a; ctx.drawImage(L.cv, Math.round((x - L.w / 2 - 1) * q) / q, Math.round((y - L.h / 2 - 1) * q) / q, L.W, L.H); ctx.globalAlpha = 1;
}
/* t307u: cached soft-glow sprites (motes, fireflies, volcano smoke) instead of a new radial gradient per particle per frame */
const glowC = new Map();
function glow(rgb, mid, sz) { sz = sz || 64; const k = rgb + '|' + (mid || '') + '|' + sz; let cv = glowC.get(k); if (cv) return cv; cv = doc.createElement('canvas'); cv.width = cv.height = sz; const c = cv.getContext('2d'), h = sz / 2, g = c.createRadialGradient(h, h, 0, h, h, h);
  g.addColorStop(0, 'rgba(' + rgb + ',1)'); if (mid) g.addColorStop(mid[0], 'rgba(' + rgb + ',' + mid[1] + ')'); g.addColorStop(1, 'rgba(' + rgb + ',0)'); c.fillStyle = g; c.fillRect(0, 0, sz, sz); glowC.set(k, cv); return cv; }
/* t307u: sun-ray fan pre-rendered (half res) in two ray-width phases that cross-fade = the same slow breathing without 14 gradient triangles per frame */
let rayCv = null, rayKey = '';
function raySprites(rc, L) { const key = rc + '|' + Math.round(L); if (key === rayKey) return rayCv; const q = 0.5, S = Math.ceil(L * 2 * q), mk = ph => { const cv = doc.createElement('canvas'); cv.width = cv.height = S; const c = cv.getContext('2d'); c.scale(q, q); c.translate(L, L);
    const rg = c.createRadialGradient(0, 0, 10, 0, 0, L); rg.addColorStop(0, 'rgba(' + rc + ',0.14)'); rg.addColorStop(1, 'rgba(' + rc + ',0)'); c.fillStyle = rg;
    for (let i = 0; i < 14; i++) { c.rotate(Math.PI / 7); const wd = 0.04 + 0.04 * Math.sin(i * 2.3 + ph); c.beginPath(); c.moveTo(0, 0); c.lineTo(L, -L * wd); c.lineTo(L, L * wd); c.closePath(); c.fill(); } return cv; };
  rayKey = key; rayCv = [mk(0), mk(Math.PI)]; return rayCv; }
/* ---------- painterly sky backdrop (seeded; rebuilt on resize and when the time-of-day colours change) ----------
   gradient sky + sun/moon glow + stars, far blue volcano range, rolling green hills with rice terraces, a little kampung (red-tile roofs,
   coconut palms), and the front hill where kite flyers stand. Night/sunset tint everything. */
let skyClouds = [], sunAt = { x: 0.8, y: 0.2, up: 1 }, stars = [], fireflies = [], smokeAt = null, mistCv = null, mistPv = null, rbCv = null, rbR = 0, lightX = null, mistX = 0, rbK = 0, rbForce = false;
const motes = Array.from({ length: 28 }, () => ({ x: Math.random(), y: rand(0.12, 0.8), ph: rand(0, 6), sp: rand(0.3, 0.8), r: rand(0.8, 1.9) }));
function bgRng(key) { let a = hashStr(key) || 1; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function rrPath(c, x, y, w, h, r) { r = Math.min(r, w / 2, h / 2); c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
const shade = (hex, nightK, warmK) => { let c = hex; if (warmK > 0) c = mixHex(c, '#ff9a5a', warmK * 0.22); if (nightK > 0) c = mixHex(c, '#141c3e', nightK * 0.72); return c; };
const rgbaH = (hex, a) => { const [r, g, b] = hexRgb(hex); return 'rgba(' + r + ',' + g + ',' + b + ',' + (+a).toFixed(3) + ')'; };
/* t273u design pass: layered sky — gradient + horizon glow, milky way, cirrus, lit volcanoes w/ smoke, forest ridge, rice terraces w/ sky glints, kampung, rim-lit front hill, dawn fog, grade + vignette */
/* t307u: the backdrop is built by a generator, a few layers per frame (bgPump, ~4 ms budget) into a pooled offscreen canvas and committed
   atomically at the end → no more 60-150 ms main-thread freeze every few seconds on phones. buildBg() still runs it synchronously (first paint, tests). */
let bgJob = null, bgJobCv = null; const bgPool = [];
/* t308u: 2D canvas draws are recorded and only rasterised when the canvas is first used as an image. The sliced build therefore still paid the whole
   raster (~0.3 s desktop, >1 s on a throttled phone) in ONE frame at the commit = the stutter every ~5 s. bgFlush() samples the canvas into a 1x1
   scratch after every slice, so the raster work is spread over the slices too. */
/* t308u: cirrus + stratus used ctx.filter=blur on the full-res backdrop = one full-canvas blur layer PER stroke (~0.3 s per layer on phones).
   Now drawn sharp into a half-res scratch, blurred once there, then scaled up (soft anyway). */
/* t333u: every hitch path of the rebuild ran on the GPU (accelerated 2D): full-res recording + ctx.filter blur + 1x1 flush readbacks of a GPU canvas
   (= a sync readback that waits for ALL queued GPU work) + ~50 new accelerated cloud-sprite canvases with blur filters per rebuild. On some GPU stacks
   (Mesa D3D12 / WSL, OBS capture) that landed as a 100-200 ms stall every rebuild. Now the whole backdrop is rasterised on the CPU into software
   canvases (willReadFrequently), slice by slice (cost visible to JS + bgPump budget), and the result is uploaded into the GPU backdrop in strips
   (putImageData, one strip per slice). Sprites/mist are pre-uploaded a few per frame (bgWarm) before the commit. Blur = 4-tap average, no ctx.filter. */
const SWO = { willReadFrequently: true }, swCtx = cv => cv.getContext('2d', SWO);
const SOFTQ = 0.5; let softA = null, softB = null;
function softBeg() { const w = Math.max(2, Math.round(TW * SOFTQ)), h = Math.max(2, Math.round(TH * SOFTQ)); for (const k of ['A', 'B']) { let cv = k === 'A' ? softA : softB; if (!cv) { cv = doc.createElement('canvas'); swCtx(cv); if (k === 'A') softA = cv; else softB = cv; } if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; } const x = swCtx(cv); x.setTransform(1, 0, 0, 1, 0, 0); x.globalAlpha = 1; x.globalCompositeOperation = 'source-over'; x.clearRect(0, 0, w, h); }
  const a = swCtx(softA); a.setTransform(SOFTQ, 0, 0, SOFTQ, 0, 0); return a; }
// 4-tap diamond average ('lighter' at 1/4 each = exact mean of premultiplied pixels) ~ the old blur(r) look, CPU-only, no filter layer
function* softEndG(c, blurPx) { bgFlush(softA); yield; const b = swCtx(softB), d = Math.max(0.35, blurPx * SOFTQ * 0.75); b.globalCompositeOperation = 'lighter'; b.globalAlpha = 0.25;
  for (const [ox, oy] of [[-d, 0], [d, 0], [0, -d], [0, d]]) b.drawImage(softA, ox, oy); b.globalAlpha = 1; b.globalCompositeOperation = 'source-over'; bgFlush(softB); yield;
  const hY = Math.round(TH * DPR / 2) / DPR; for (const [y0, y1] of [[0, hY], [hY, TH]]) { c.save(); c.beginPath(); c.rect(0, y0, TW, y1 - y0); c.clip(); c.imageSmoothingEnabled = true; c.drawImage(softB, 0, 0, TW, TH); c.restore(); if (y0 === 0) yield; } }
let bgSoft = null; function bgScratch(w, h) { if (!bgSoft) { bgSoft = doc.createElement('canvas'); swCtx(bgSoft); } if (bgSoft.width !== w || bgSoft.height !== h) { bgSoft.width = w; bgSoft.height = h; }
  const c = swCtx(bgSoft); c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = 1; c.globalCompositeOperation = 'source-over'; try { c.filter = 'none'; } catch (e) {} c.clearRect(0, 0, w, h); return bgSoft; }
/* t333u: pre-upload queue — new software sprites are drawn 1x1 into the tank (under the backdrop, invisible) a few per frame so their GPU upload is
   spread out instead of all landing in the commit frame */
const bgWarmQ = []; let bgSync = false;
function bgWarm(ctx, x) { for (let i = 0; i < 4 && bgWarmQ.length; i++) { const cv = bgWarmQ.shift(); try { ctx.drawImage(cv, x, 0, 1, 1); } catch (e) {} } }
const BGIV = (() => { try { const v = +new URLSearchParams(root.location.search).get('bgiv'); return v > 0 ? v * 1000 : 0; } catch (e) { return 0; } })();
// rebuild cadence: interactive keeps 4 s (6 s phone / lower tier); wallpaper / stream screens 12 s with a longer cross-fade (the sky clock still
// glides: sun/moon/stars/clouds are live, only the colour-graded backdrop steps). ?bgiv=<s> overrides for testing.
const bgIv = () => BGIV || (TOD.ecl > 0 && TOD.ecl < 1 ? (WP ? 3000 : 1500) : WP ? 12000 : COARSE || PERF.lvl ? 6000 : 4000);
const bgFadeS = () => TOD.ecl > 0 && TOD.ecl < 1 ? (WP ? 2.4 : 1.2) : WP ? 5 : PERF.lvl >= 2 ? 1.6 : 2.6;
let flushC = null; function bgFlush(cv) { if (!cv) return; try { if (!flushC) { const f = doc.createElement('canvas'); f.width = f.height = 1; flushC = f.getContext('2d'); } flushC.drawImage(cv, 0, 0, 1, 1); } catch (e) {} }
function bgTarget() { /* t333u: GPU backdrop (final, pooled); filled from bgSoft in strips */ const w = Math.round(TW * DPR), h = Math.round(TH * DPR); let cv = null; while (bgPool.length && !cv) { const p = bgPool.pop(); if (p.width === w && p.height === h && p !== bgCanvas && p !== bgPrev) cv = p; }
  if (!cv) { cv = doc.createElement('canvas'); cv.width = w; cv.height = h; } const c = cv.getContext('2d'); c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = 1; c.globalCompositeOperation = 'source-over'; try { c.filter = 'none'; } catch (e) {} c.clearRect(0, 0, w, h); return cv; }
function buildBg() { bgAt = performance.now(); bgJob = null; bgSync = true; const g = bgGen(); let r; try { do r = g.next(); while (!r.done); } finally { bgSync = false; } bgWarmQ.length = 0; if (r.value) poolBg(r.value); if (bgPrev) poolBg(bgPrev); bgPrev = null; bgFade = 0; mistPv = null; for (const cl of skyClouds) cl.pv = null; }
function poolBg(cv) { if (cv && cv !== bgCanvas && bgPool.length < 2 && !bgPool.includes(cv)) bgPool.push(cv); }
function bgRequest(restart) { if (bgJob && !restart) return; bgAt = performance.now(); bgJob = bgGen(); }
let bgStepI = 0, bgSteps = []; function bgPump(budget) { if (!bgJob) return; const t0 = performance.now(); let sd0 = 0; do { const s0 = performance.now(), r = bgJob.next(); if (!r.done) bgFlush(bgJobCv); { const sd = performance.now() - s0; sd0 = sd; bgSteps[bgStepI] = Math.max(bgSteps[bgStepI] || 0, sd); bgStepI = r.done ? 0 : bgStepI + 1; } if (r.done) { bgJob = null; if (r.value) { bgPrev = r.value; bgFade = 1; } break; } if (r.value === 'f') break; /* t333u: one GPU strip / wait per frame */ if (performance.now() - t0 + sd0 > budget) break; } while (true); } // t333u: no second slice that would overrun the frame
/* t340u: WALLPAPER = NO PERIODIC REBUILD. The backdrop only depends on the time-of-day colours (SKY_KEYS, linear between keys) + where the
   sun sits. So the wallpaper bakes every SKY_KEYS hour (+ midday) ONCE at start (sliced, nearest hours first) and from then on just
   cross-fades the two keyframes around the live sky hour every frame (2 drawImage) — the same linear colour lerp the rebuilds approximated
   in 12 s steps, but continuous and with zero GPU spikes. Cloud body/rim sprites + valley mist are baked per keyframe and blended the same
   way; sun/moon/stars/rain/rainbow/smoke were already live; solar-eclipse darkening is a live gradient overlay. A resize / DPR change
   re-bakes once. Interactive keeps the sliced 4 s rebuild. ?kf=0 disables (old 12 s rebuild), ?kf=1 forces it on outside wallpaper.
   Too many pixels for 13 GPU canvases (> ~170 MB, e.g. 1440p+ at DPR 2) → falls back to the 12 s sliced rebuild. */
const KF_H = [0, 4.6, 5.8, 6.6, 8, 10.5, 12.75, 15, 16.1, 17, 18.1, 18.9, 19.7];
const KFQ = (() => { try { const v = new URLSearchParams(root.location.search).get('kf'); return v == null ? null : v !== '0'; } catch (e) { return null; } })();
const KF = { on: false, list: [], job: null, ji: -1, a: -1, b: -1, w: 0, xf: 0, inK: 1, bakeMs: 0, t0: 0, done: 0 };
const kfFits = () => Math.round(TW * DPR) * Math.round(TH * DPR) * 4 * KF_H.length < 170e6;
const kfMode = () => (KFQ != null ? KFQ : WP) && kfFits();
function kfReset() { KF.t0 = 0; KF.on = false; KF.list = []; KF.job = null; KF.ji = -1; KF.done = 0; KF.inK = 1; }
function kfBr(h) { let i = KF_H.length - 1; for (let j = 0; j < KF_H.length; j++) if (KF_H[j] <= h) i = j; const j = (i + 1) % KF_H.length, ha = KF_H[i], hb = j ? KF_H[j] : 24; return [i, j, clamp((h - ha) / (hb - ha), 0, 1)]; }
function kfNext() { const [a] = kfBr(TOD.h); let best = -1, bd = 1e9; for (let i = 0; i < KF_H.length; i++) { if (KF.list[i]) continue; const d = (i - a + KF_H.length) % KF_H.length; if (d < bd) { bd = d; best = i; } } return best; }
function kfPump(budget) { if (!kfMode() || bgJob || KF.done >= KF_H.length) return; if (!KF.job) { const i = kfNext(); if (i < 0) return; if (!KF.t0) KF.t0 = performance.now(); KF.ji = i; KF.job = bgGen(todAt(KF_H[i]), true); }
  const t0 = performance.now(); let sd0 = 0; do { const s0 = performance.now(), r = KF.job.next(); if (!r.done) bgFlush(bgJobCv); sd0 = performance.now() - s0; bgSteps[bgStepI] = Math.max(bgSteps[bgStepI] || 0, sd0); bgStepI = r.done ? 0 : bgStepI + 1;
    if (r.done) { KF.job = null; if (r.value) { const v = r.value; KF.list[KF.ji] = v; KF.done = KF.list.filter(Boolean).length; if (v.stars.length && !stars.length) stars = v.stars; if (v.smk) smokeAt = v.smk; if (v.clip) skyClip = v.clip; if (KF.done >= KF_H.length) KF.bakeMs = Math.round(performance.now() - KF.t0); kfTry(); } break; }
    if (r.value === 'f') break; if (performance.now() - t0 + sd0 > budget) break; } while (true); }
function kfTry() { if (KF.on) return; const [a, b] = kfBr(TOD.h); if (!KF.list[a] || !KF.list[b]) return; KF.on = true; KF.inK = bgCanvas ? 0 : 1; if (bgPrev) { poolBg(bgPrev); bgPrev = null; bgFade = 0; } }
const kfEclG = { q: -1, h: 0, g: null };
function kfDraw(ctx, dt) { const [a, b, w] = kfBr(TOD.h); let A = KF.list[a], B = KF.list[b], wb = w; if (!A && !B) { if (bgCanvas) ctx.drawImage(bgCanvas, 0, 0, TW, TH); KF.xf = 0; return; } if (!A) { A = B; wb = 1; } if (!B) { B = A; wb = 0; }
  KF.a = a; KF.b = b; KF.w = wb; if (wb >= 0.998) ctx.drawImage(B.cv, 0, 0, TW, TH); else { ctx.drawImage(A.cv, 0, 0, TW, TH); if (wb > 0.002) { ctx.globalAlpha = wb; ctx.drawImage(B.cv, 0, 0, TW, TH); ctx.globalAlpha = 1; } }
  if (KF.inK < 1 && bgCanvas) { ctx.globalAlpha = 1 - KF.inK; ctx.drawImage(bgCanvas, 0, 0, TW, TH); ctx.globalAlpha = 1; KF.inK = Math.min(1, KF.inK + dt / 3); } // one-off hand-over from the boot backdrop
  // solar eclipse darkening (TOD.ecl, stepped 0.05) — cached gradient, rebuilt only when q / size changes
  const q = TOD.ecl || 0; if (q > 0) { if (kfEclG.q !== q || kfEclG.h !== TH) { const g = ctx.createLinearGradient(0, 0, 0, TH); g.addColorStop(0, 'rgba(12,18,64,' + (q * 0.86).toFixed(3) + ')'); g.addColorStop(0.45, 'rgba(36,40,100,' + (q * 0.74).toFixed(3) + ')'); g.addColorStop(0.66, 'rgba(240,150,100,' + (q * 0.38).toFixed(3) + ')'); g.addColorStop(0.8, 'rgba(18,22,58,' + (q * 0.5).toFixed(3) + ')'); g.addColorStop(1, 'rgba(10,14,40,' + (q * 0.6).toFixed(3) + ')'); kfEclG.q = q; kfEclG.h = TH; kfEclG.g = g; } ctx.fillStyle = kfEclG.g; ctx.fillRect(0, 0, TW, TH); }
  // cloud + mist sprites of the two keyframes (xd: new = B, old = A at weight 1-w)
  KF.xf = A === B ? 0 : 1 - wb; const n = Math.min(skyClouds.length, A.cl.length, B.cl.length); for (let i = 0; i < n; i++) { const cl = skyClouds[i], sB = B.cl[i], sA = A.cl[i]; cl.cv = sB.cv; cl.rl = sB.rl; cl.rr = sB.rr; cl.pv = A === B ? null : sA; }
  mistCv = B.mist; mistPv = A === B ? null : A.mist; }
function* bgGen(T0, kf) {
  const TOD = T0 || todSnap(); // t340u: one TOD snapshot per build (keyframe bakes pass their own hour)
  const cvB = bgTarget(), cvS = bgScratch(cvB.width, cvB.height); bgJobCv = cvS; let c = swCtx(cvS); const DPRb = DPR, TWb = TW, THb = TH; c.scale(DPR, DPR); let st2 = [], smk = null, clip2 = null, mist2 = null;
  let R = bgRng('lb-bg-v3'); const rr = (a, b) => a + R() * (b - a), PI = Math.PI, PI2 = PI * 2, U = clamp(TH / 450, 0.7, 1.5), N = TOD.night, Wm = TOD.warm, h = TOD.h;
  const day = h >= 5.8 && h <= 18.6, f = day ? (h - 5.8) / 12.8 : ((h + 24 - 18.6) % 24) / 11.2;
  const sb = sunPos(h); void f; // t292u: the sun/moon disc itself is drawn live (drawOrbs); the backdrop only uses its position for lighting
  const sx = sb.x * TW, sy = sb.y * TH, sunCol = day ? (Wm > 0.4 ? mixHex('#ffd27a', '#ff8a4a', (Wm - 0.4) / 0.6) : '#fff3c4') : '#dfe6ff';
  // 1) sky: 5-stop gradient (zenith → horizon) — deeper zenith, luminous horizon
  const g = c.createLinearGradient(0, 0, 0, TH);
  g.addColorStop(0, mixHex(TOD.top, '#05082a', 0.18 + N * 0.15)); g.addColorStop(0.3, TOD.top); g.addColorStop(0.58, TOD.mid); g.addColorStop(0.8, TOD.hor); g.addColorStop(1, mixHex(TOD.hor, '#ffffff', 0.15 * (1 - N)));
  // t333u: CPU raster is sliced → full-canvas fills are split into halves (opaque overlap / pixel-aligned clip = no seam)
  const hY = Math.round(TH * DPR / 2) / DPR; c.fillStyle = g; c.fillRect(0, 0, TW, hY + 1); yield; c.fillStyle = g; c.fillRect(0, hY, TW, TH - hY);
  // horizon glow around where the sun sits (huge at sunrise/sunset)
  { const gx = day ? sx : TW * 0.5, gy = TH * 0.74, gr = TW * (0.45 + Wm * 0.5), hg = c.createRadialGradient(gx, gy, 0, gx, gy, gr);
    const gc = N > 0.6 ? '#6a5aa8' : Wm > 0.3 ? '#ffb070' : '#ffffff'; hg.addColorStop(0, rgbaH(gc, 0.22 + Wm * 0.35)); hg.addColorStop(0.5, rgbaH(gc, 0.08 + Wm * 0.12)); hg.addColorStop(1, rgbaH(gc, 0));
    for (const [y0, y1] of [[-1, hY], [hY, TH + 1]]) { yield; c.save(); c.beginPath(); c.rect(-1, y0, TW + 2, y1 - y0); c.clip(); c.translate(gx, gy); c.scale(1, 0.55); c.translate(-gx, -gy); c.fillStyle = hg; c.beginPath(); c.arc(gx, gy, gr, 0, PI2); c.fill(); c.restore(); } }
  // 2) night: milky way band + coloured stars (+ Bintang Pari / Southern Cross)
  yield; R = bgRng('lb-stars');
  if (N > 0.05) {
    const ax = 0, ay = TH * 0.08, bx = TW, by = TH * 0.5, ang = Math.atan2(by - ay, bx - ax), len = Math.hypot(bx - ax, by - ay);
    c.save(); c.translate(ax, ay); c.rotate(ang);
    for (let i = 0; i < 14; i++) { const x = rr(0, len), w = rr(len * 0.08, len * 0.2), hh = rr(TH * 0.05, TH * 0.11), mg = c.createRadialGradient(x, 0, 0, x, 0, w); mg.addColorStop(0, 'rgba(190,180,255,' + (0.09 * N).toFixed(3) + ')'); mg.addColorStop(1, 'rgba(190,180,255,0)'); c.save(); c.scale(1, hh / w); c.fillStyle = mg; c.beginPath(); c.arc(x, 0, w, 0, PI2); c.fill(); c.restore(); }
    for (let i = 0, n = Math.round(len * 0.9); i < n; i++) { const x = rr(0, len), y = (R() + R() + R() - 1.5) * TH * 0.07; c.fillStyle = 'rgba(235,235,255,' + (N * rr(0.15, 0.6)).toFixed(3) + ')'; c.fillRect(x, y, rr(0.5, 1.2), rr(0.5, 1.2)); }
    c.restore();
    yield; const SC = ['#ffffff', '#ffffff', '#cfe0ff', '#fff1c9', '#ffd6e6'];
    for (let i = 0, n = Math.round(TW * TH / 2300); i < n; i++) { const x = rr(0, TW), y = rr(0, TH * 0.7), r = rr(0.35, 1.6), col = SC[i % 5]; c.fillStyle = rgbaH(col, N * rr(0.25, 0.95) * (1 - y / TH * 0.6)); c.beginPath(); c.arc(x, y, r, 0, PI2); c.fill(); if (r > 1.15 && y < TH * 0.48) st2.push({ x, y, r, ph: rr(0, 6), col }); }
    { const cx = TW * 0.17, cy = TH * 0.2, k = U * 1.15; for (const [dx, dy, r, col] of [[0, -24, 1.9, '#dfe8ff'], [3, 24, 2.1, '#cfe0ff'], [-17, -2, 1.7, '#dfe8ff'], [15, -6, 1.6, '#fff1c9'], [7, 7, 1.2, '#ffffff'], [-58, 12, 2.2, '#fff1c9'], [-40, 19, 1.9, '#dfe8ff']]) { const x = cx + dx * k, y = cy + dy * k, gl = c.createRadialGradient(x, y, 0, x, y, r * 6 * k); gl.addColorStop(0, rgbaH(col, 0.35 * N)); gl.addColorStop(1, rgbaH(col, 0)); c.fillStyle = gl; c.fillRect(x - r * 6 * k, y - r * 6 * k, r * 12 * k, r * 12 * k); c.fillStyle = rgbaH(col, N); c.beginPath(); c.arc(x, y, r * 0.8, 0, PI2); c.fill(); st2.push({ x, y, r: r + 0.2, ph: rr(0, 6), col }); } }
  }
  yield; R = bgRng('lb-cirrus');
  // 3) high cirrus wisps (catch pink light at dawn/dusk)
  { const cc = N > 0.6 ? '#7c82b8' : Wm > 0.3 ? mixHex('#ffffff', '#ff9fb0', Wm) : '#ffffff', a = (0.32 + Wm * 0.25) * (1 - N * 0.6);
    const cO = c; c = softBeg(); c.save(); c.lineCap = 'round';
    for (let i = 0, n = 3 + Math.round(TW / 380); i < n; i++) { const x0 = rr(-0.1, 1) * TW, y0 = rr(0.06, 0.34) * TH, L = rr(0.12, 0.3) * TW, bend = rr(-14, 14) * U;
      for (let j = 0; j < 3; j++) { c.strokeStyle = rgbaH(cc, a * rr(0.2, 0.5)); c.lineWidth = rr(2.5, 6) * U; const oy = j * rr(3, 6) * U, ox = j * rr(-10, 16);
        c.beginPath(); c.moveTo(x0 + ox, y0 + oy); c.quadraticCurveTo(x0 + ox + L * 0.5, y0 + oy + bend, x0 + ox + L * rr(0.6, 1), y0 + oy - bend * 0.3); c.stroke(); } }
    c.restore(); c = cO; yield* softEndG(c, 1.6 * U); }
  // 4) sun / moon: drawn live every frame by drawOrbs() (t292u) so they glide at 60x instead of stepping per rebuild
  // 4b) t289u: long stratus streaks low in the sky, under-lit by the sun at dawn/dusk, silver under the moon
  yield; R = bgRng('lb-stratus');
  { const top = mixHex(mixHex(mixHex(TOD.mid, '#8fa3cf', 0.4), '#6d4f8a', Wm * 0.6), '#2a3168', N * 0.6), lit = mixHex(mixHex('#ffffff', '#ffc27a', Wm), '#b9c3f0', N), a = (0.22 + Wm * 0.4) * (1 - N * 0.45);
    const cO = c; c = softBeg(); c.save();
    for (let i = 0, n = 4 + Math.round(TW / 260); i < n; i++) { const x = rr(-0.1, 1.1) * TW, y = rr(0.42, 0.6) * TH, w = rr(0.12, 0.34) * TW, hh = rr(2.5, 6) * U, la = a * rr(0.5, 1) * (0.55 + 0.45 * clamp(1 - Math.abs(x - (day ? sx : TW / 2)) / TW, 0, 1));
      c.fillStyle = rgbaH(top, la * 0.8); c.beginPath(); c.ellipse(x, y - hh * 0.4, w, hh, 0, 0, PI2); c.fill();
      c.fillStyle = rgbaH(lit, la); c.beginPath(); c.ellipse(x + rr(-10, 10), y + hh * 0.45, w * 0.86, hh * 0.5, 0, 0, PI2); c.fill(); }
    c.restore(); c = cO; yield* softEndG(c, 2.2 * U); }
  yield; R = bgRng('lb-bank');
  // 5) distant cloud bank sitting on the horizon (behind the volcanoes)
  { const bank = N > 0.6 ? '#4a5490' : Wm > 0.3 ? mixHex('#ffe0c8', '#f29a8a', Wm * 0.6) : mixHex(TOD.hor, '#ffffff', 0.6), sh = N > 0.6 ? '#323a72' : Wm > 0.3 ? '#c9849a' : mixHex(TOD.mid, '#9fb9dc', 0.5);
    const by0 = TH * 0.62; c.save();
    for (let x = -20; x < TW + 40; x += rr(26, 48) * U) { const r = rr(18, 40) * U, y = by0 + rr(-6, 10) * U, cg = c.createLinearGradient(0, y - r, 0, y + r); cg.addColorStop(0, rgbaH(bank, 0.85 - N * 0.3)); cg.addColorStop(1, rgbaH(sh, 0.6 - N * 0.2)); c.fillStyle = cg; c.beginPath(); c.arc(x, y, r, 0, PI2); c.fill(); }
    c.restore(); }
  yield; R = bgRng('lb-volc');
  // 6) far volcanoes — gradient body, sun-side light, gullies, smoke plume
  /* t306u: natural ridgelines — midpoint-displacement noise (jagged, seeded per layer) + stratovolcano peaks with concave flanks
     (steep near the summit, spreading out at the foot), a small notched crater, asymmetric slopes and shoulders; no round domes */
  const mdArr = (n, rough) => { const a = new Float32Array(n + 1); a[0] = a[n] = rr(-1, 1); /* periodic: no seam where the lookup wraps */ for (let st = n, sc = 1; st > 1; st >>= 1, sc *= rough) for (let i = 0; i < n; i += st) a[i + st / 2] = (a[i] + a[i + st]) / 2 + rr(-1, 1) * sc; let m = 0; for (const v of a) m = Math.max(m, Math.abs(v)); for (let i = 0; i <= n; i++) a[i] /= m || 1; return a; };
  const noiseFn = (rough, span) => { const n = 256, a = mdArr(n, rough), x0 = -40, w = TW + 100; return x => { const f = clamp((x - x0) / w, 0, 1) * n * (span || 1) % n, i = Math.floor(f), t = f - i; return a[i] + (a[Math.min(n, i + 1)] - a[i]) * t; }; };
  const rl = []; const ridge = (base, amp, fr, peaks, jag) => { const p = [rr(0, 6), rr(0, 6)], j = jag || 0, nz = noiseFn(0.56, 1), nz2 = noiseFn(0.62, 3),
      hh0 = x => base - amp * (0.45 + 0.3 * Math.sin(x * fr + p[0]) + 0.15 * Math.sin(x * fr * 2.7 + p[1])) - j * (nz(x) * 0.75 + nz2(x) * 0.25);
    const prof = (pk, x) => { const sk = pk[3] || 1, dx = x - pk[0], d = Math.abs(dx) / (pk[2] * (dx < 0 ? 1 : sk)); if (d >= 1) return 0; const cw = pk[4] == null ? 0.035 : pk[4];
      const ex = pk[5] || 1.5; let f = Math.pow(1 - Math.max(d, cw), ex) / Math.pow(1 - cw, ex); if (d < cw) f -= 0.012 * (1 - d / cw); return f; };
    const hh = x => { let y = hh0(x); for (const pk of peaks) { const f = prof(pk, x); if (f > 0) { const b = hh0(x), fl = j * 1.1 * nz2(x * 1.7) * f * (1 - f) * 4; y = Math.min(y, b - (b - pk[1]) * f + fl); } } return y; };
    const path = () => { c.beginPath(); c.moveTo(0, TH); for (let x = 0; x <= TW + 8; x += 4) c.lineTo(x, hh(x)); c.lineTo(TW, TH); c.closePath(); }; rl.push(hh); return { hh, path }; };
  const haze = (y0, y1, a) => { const hz = c.createLinearGradient(0, y0, 0, y1); hz.addColorStop(0, rgbaH(TOD.hor, 0)); hz.addColorStop(1, rgbaH(TOD.hor, a)); c.fillStyle = hz; c.fillRect(0, y0, TW, TH - y0); };
  { const ff = ridge(TH * 0.705, TH * 0.07, 0.0031, [[TW * 0.55, TH * 0.585, TW * 0.16, 1.4, 0.1], [TW * 0.12, TH * 0.615, TW * 0.12, 0.8, 0.12]], TH * 0.035), fc = shade(mixHex(TOD.hor, '#93a9d8', 0.38), N * 0.55, Wm * 0.45); ff.path(); const fg = c.createLinearGradient(0, TH * 0.58, 0, TH * 0.74); fg.addColorStop(0, rgbaH(fc, 0.62)); fg.addColorStop(1, rgbaH(TOD.hor, 0.2)); c.fillStyle = fg; c.fill(); haze(TH * 0.6, TH * 0.74, 0.35 - N * 0.15); }
  // [x, summit y, left half-width, right width factor (asymmetry), crater width] — main cone, second volcano, parasitic cone + shoulders
  yield; const asp = clamp(TW / TH / 1.5, 0.45, 1), pY = v => TH * 0.745 - (TH * 0.745 - TH * v) * (0.35 + 0.65 * asp), pW = v => TW * v / (0.55 + 0.45 * asp); // portrait: lower + wider cones (no needles)
  const pks = [[TW * 0.28, pY(0.46), pW(0.23), 1.3, 0.045, 1.55], [TW * 0.79, pY(0.535), pW(0.17), 0.85, 0.06, 1.4], [TW * 0.45, pY(0.625), pW(0.1), 1.3, 0.02, 1.15], [TW * 0.635, pY(0.615), pW(0.11), 0.9, 0.03, 1.2], [TW * 0.97, pY(0.625), pW(0.1), 1, 0.02, 1.1]];
  { const far = ridge(TH * 0.745, TH * 0.06, 0.004, pks, TH * 0.03), fc = mixHex(TOD.hor, '#5f78b4', 0.5 + N * 0.25), top = shade(mixHex(fc, '#3d4f86', 0.35), N * 0.45, Wm * 0.5), bot = shade(mixHex(fc, TOD.hor, 0.55), N * 0.4, Wm * 0.4);
    far.path(); const vg = c.createLinearGradient(0, TH * 0.47, 0, TH * 0.78); vg.addColorStop(0, top); vg.addColorStop(1, bot); c.fillStyle = vg; c.fill();
    c.save(); far.path(); c.clip();
    for (const pk of pks.slice(0, 2)) { const dir = (day ? sx : TW * 0.5) > pk[0] ? 1 : -1, lg = c.createLinearGradient(pk[0] - pk[2] * dir, 0, pk[0] + pk[2] * dir, 0), sa = (0.16 + N * 0.1).toFixed(3);
      lg.addColorStop(0, 'rgba(10,20,60,0)'); lg.addColorStop(0.28, 'rgba(10,20,60,' + sa + ')'); lg.addColorStop(0.49, 'rgba(10,20,60,0)'); lg.addColorStop(0.51, rgbaH(sunCol, 0)); lg.addColorStop(0.72, rgbaH(sunCol, (0.22 + Wm * 0.18) * (1 - N * 0.7))); lg.addColorStop(1, rgbaH(sunCol, 0)); c.fillStyle = lg; c.fillRect(pk[0] - pk[2], pk[1] - 10, pk[2] * 2, TH);
      c.strokeStyle = 'rgba(20,30,70,' + (0.13 + N * 0.05).toFixed(3) + ')'; c.lineWidth = 1.3 * U; for (let j = -4; j <= 4; j++) { if (!j) continue; const sp = j < 0 ? pk[2] : pk[2] * (pk[3] || 1), q = Math.abs(j) / 4.6 * (j < 0 ? -1 : 1) + rr(-0.05, 0.05), x1 = pk[0] + q * sp * 0.92, y1 = far.hh(x1) + rr(2, 8) * U; c.lineWidth = rr(0.8, 1.6) * U; c.beginPath(); c.moveTo(pk[0] + q * 6 * U, far.hh(pk[0] + q * 6 * U) + 2 * U); c.quadraticCurveTo(pk[0] + q * sp * 0.3 + rr(-5, 5) * U, far.hh(pk[0] + q * sp * 0.3) + TH * 0.03, x1, Math.max(y1, pk[1] + TH * 0.1)); c.stroke(); } }
    c.restore();
    // crater rim + soft smoke plume (animated wisps drift from smokeAt in drawTank)
    const [px, py] = pks[0]; { const cw = pks[0][2] * 0.03; c.fillStyle = shade('#3a3f5e', N * 0.5, Wm * 0.4); c.globalAlpha = 0.55; c.beginPath(); c.moveTo(px - cw, far.hh(px - cw) + 0.5); c.lineTo(px + cw, far.hh(px + cw) + 0.5); c.lineTo(px + cw * 0.6, far.hh(px) + 2.2 * U); c.lineTo(px - cw * 0.6, far.hh(px) + 2.2 * U); c.closePath(); c.fill(); c.globalAlpha = 1; }
    smk = { x: px / TW, y: (far.hh(px) - 2) / TH };
    haze(TH * 0.5, TH * 0.8, 0.45 - N * 0.2); }
  yield; R = bgRng('lb-mid');
  // 7) mid ridge with a bumpy forest treeline
  const midR = ridge(TH * 0.8, TH * 0.05, 0.009, [], TH * 0.012), mcol = shade(mixHex(TOD.hor, '#4f8f78', 0.62), N, Wm);
  { c.fillStyle = mcol; midR.path(); c.fill(); const tc = shade(mixHex(TOD.hor, '#3f7f62', 0.68), N, Wm);
    for (let x = -6; x < TW + 10; x += rr(4, 8) * U) { const r = rr(4, 9) * U; c.fillStyle = R() < 0.5 ? tc : mcol; c.beginPath(); c.arc(x, midR.hh(x) + r * 0.5, r, 0, PI2); c.fill(); }
    { const cx = TW * 0.62, by = midR.hh(TW * 0.62) + 5 * U, k = U * 1.05, col = shade(mixHex(TOD.hor, '#3f5a64', 0.72), N, Wm), lt = rgbaH(N > 0.5 ? '#aab4ff' : sunCol, 0.35 * (1 - N * 0.5)); c.fillStyle = col;
      for (let j = 0; j < 4; j++) { const w = (40 - j * 8) * k; c.fillRect(cx - w / 2, by - (j + 1) * 4.2 * k, w, 4.7 * k); for (let q = -1; q <= 1; q += 2) { c.beginPath(); c.arc(cx + q * (w / 2 - 2.5 * k), by - (j + 1) * 4.2 * k - 1.2 * k, 1.7 * k, PI, 0); c.fill(); } }
      const top = by - 16.8 * k; c.beginPath(); c.moveTo(cx - 8 * k, top + 0.5); c.quadraticCurveTo(cx - 8 * k, top - 9 * k, cx, top - 10 * k); c.quadraticCurveTo(cx + 8 * k, top - 9 * k, cx + 8 * k, top + 0.5); c.closePath(); c.fill(); c.fillRect(cx - 1.1 * k, top - 18 * k, 2.2 * k, 9 * k);
      c.fillStyle = lt; c.fillRect(cx + ((day ? sx : TW / 2) > cx ? 1 : -1) * 6 * k - 0.6 * k, top - 6 * k, 1.2 * k, 6 * k); }
    haze(TH * 0.72, TH * 0.86, 0.32 - N * 0.15); }
  yield; R = bgRng('lb-rice');
  // 8) rolling rice-terrace hill: banded tint + sky glints in the flooded terraces
  const hill = (base, amp, fr, top, bot) => { const p0 = rr(0, 6), hh = x => base - amp * (0.5 + 0.5 * Math.sin(x * fr + p0)) - amp * 0.3 * Math.sin(x * fr * 2.2 + p0 * 2);
    const hg = c.createLinearGradient(0, base - amp * 1.4, 0, TH); hg.addColorStop(0, shade(top, N, Wm)); hg.addColorStop(1, shade(bot, N, Wm)); c.fillStyle = hg; c.beginPath(); c.moveTo(0, TH); for (let x = 0; x <= TW + 6; x += 6) c.lineTo(x, hh(x)); c.lineTo(TW, TH); c.closePath(); c.fill(); return hh; };
  const h1 = hill(TH * 0.86, TH * 0.06, 0.007, '#93d56e', '#5aa24c');
  c.save(); c.lineWidth = 1.3 * U;
  for (let j = 1; j < 8; j++) { const band = x => h1(x) + j * 6.5 * U + Math.sin(x * 0.02 + j) * 2;
    c.strokeStyle = shade(j % 2 ? '#c4eca2' : '#4f9442', N, Wm); c.globalAlpha = j % 2 ? 0.6 : 0.35; c.beginPath(); for (let x = 0; x <= TW; x += 8) { const y = band(x); x ? c.lineTo(x, y) : c.moveTo(x, y); } c.stroke();
    if (j % 2 === 0) { c.globalAlpha = 0.38 * (1 - N * 0.5); c.strokeStyle = N > 0.5 ? '#9aa6e0' : Wm > 0.4 ? '#ffd2a0' : '#dff3ff'; for (let x = rr(0, 40); x < TW; x += rr(30, 90)) { const L = rr(6, 18) * U; c.beginPath(); c.moveTo(x, band(x) + 2); c.lineTo(x + L, band(x + L) + 2); c.stroke(); } c.strokeStyle = shade('#4f9442', N, Wm); } }
  c.restore();
  yield; // kampung: houses (shaded roofs, glowing windows at night) + coconut palms
  const house = (x, y, k) => { const w = 22 * k, hh2 = 14 * k; c.fillStyle = shade('#f6ecd4', N, Wm); c.fillRect(x - w / 2, y - hh2, w, hh2); c.fillStyle = shade('#d9cdb0', N, Wm); c.fillRect(x + w * 0.1, y - hh2, w * 0.4, hh2);
    c.fillStyle = shade('#d0583e', N, Wm); c.beginPath(); c.moveTo(x - w * 0.65, y - hh2); c.lineTo(x, y - hh2 - 11 * k); c.lineTo(x + w * 0.65, y - hh2); c.closePath(); c.fill();
    c.fillStyle = shade('#9e3a2a', N, Wm); c.beginPath(); c.moveTo(x, y - hh2 - 11 * k); c.lineTo(x + w * 0.65, y - hh2); c.lineTo(x, y - hh2); c.closePath(); c.fill();
    if (N > 0.4) { const wg = c.createRadialGradient(x - 1, y - hh2 * 0.4, 0, x - 1, y - hh2 * 0.4, 16 * k); wg.addColorStop(0, 'rgba(255,200,110,' + (0.55 * N).toFixed(3) + ')'); wg.addColorStop(1, 'rgba(255,200,110,0)'); c.fillStyle = wg; c.fillRect(x - 18 * k, y - hh2 - 16 * k, 36 * k, 34 * k); }
    c.fillStyle = N > 0.4 ? 'rgba(255,216,125,.97)' : shade('#6b4a32', N, 0); c.fillRect(x - 6 * k, y - hh2 * 0.66, 4 * k, 5 * k); c.fillRect(x + 2 * k, y - hh2 * 0.66, 4 * k, 5 * k); };
  const palm = (x, y, k) => { c.strokeStyle = shade('#7a5a3a', N, Wm); c.lineWidth = 2.4 * k; c.lineCap = 'round'; c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + 5 * k, y - 18 * k, x + 2 * k, y - 34 * k); c.stroke();
    for (let pass = 0; pass < 2; pass++) { c.strokeStyle = shade(pass ? '#56a85a' : '#2f7a3e', N, Wm); c.lineWidth = (pass ? 1.6 : 2.8) * k; for (let i = 0; i < 7; i++) { const a = -PI / 2 + (i - 3) * 0.5; c.beginPath(); c.moveTo(x + 2 * k, y - 34 * k); c.quadraticCurveTo(x + 2 * k + Math.cos(a) * 10 * k, y - 34 * k + Math.sin(a) * 10 * k - 4 * k, x + 2 * k + Math.cos(a) * 19 * k, y - 34 * k + Math.sin(a) * 9 * k + 7 * k); c.stroke(); } }
    c.fillStyle = shade('#6b4a2a', N, Wm); c.beginPath(); c.arc(x + 2 * k, y - 32 * k, 2.2 * k, 0, PI2); c.fill(); };
  for (let i = 0, n = Math.max(3, Math.round(TW / 240)); i < n; i++) { const x = (i + rr(0.15, 0.85)) / n * TW, k = rr(0.7, 1) * U; const y = midR.hh(x) + 7 * U; if (R() < 0.6) { house(x, y, k); if (R() < 0.6) house(x + 26 * k, y + 2, k * 0.85); } if (R() < 0.75) palm(x + rr(-30, 30), y + 2, k * rr(0.8, 1.1)); }
  yield; R = bgRng('lb-front');
  // 9) front hill (kite flyers stand here) with sun rim-light, grass + flowers
  const front = hill(TH * 0.95, TH * 0.04, 0.011, '#aee286', '#69b453');
  c.save(); c.strokeStyle = rgbaH(N > 0.5 ? '#9fb0ff' : sunCol, (0.5 + Wm * 0.3) * (1 - N * 0.5)); c.lineWidth = 2.2 * U; c.beginPath(); for (let x = 0; x <= TW; x += 6) { const y = front(x) + 1; x ? c.lineTo(x, y) : c.moveTo(x, y); } c.stroke(); c.restore();
  c.save(); for (let i = 0, n = Math.round(TW / 5); i < n; i++) { const x = rr(0, TW), y = front(x) + rr(1, 12); c.strokeStyle = shade(R() < 0.5 ? '#5aa548' : '#97d872', N, Wm); c.lineWidth = 1.2; c.beginPath(); c.moveTo(x, y + 4); c.quadraticCurveTo(x + rr(-2, 2), y - 3 * U, x + rr(-4, 4), y - rr(3, 9) * U); c.stroke(); }
  yield; for (let i = 0, n = Math.round(TW / 34); i < n; i++) { const x = rr(0, TW), y = front(x) + rr(4, 14), col = ['#fff4a8', '#ffffff', '#ffb3c8', '#ffd36b', '#c9b6ff'][i % 5], r = rr(1.4, 2.6) * U; c.fillStyle = shade(col, N, 0); for (let p = 0; p < 5; p++) { const a = p / 5 * PI2; c.beginPath(); c.arc(x + Math.cos(a) * r * 0.8, y + Math.sin(a) * r * 0.8, r * 0.6, 0, PI2); c.fill(); } c.fillStyle = shade('#ffb02e', N, 0); c.beginPath(); c.arc(x, y, r * 0.4, 0, PI2); c.fill(); } c.restore();
  yield; R = bgRng('lb-fog');
  // 10) dawn/dusk ground fog in the valleys
  { const fogK = clamp(1 - Math.abs(h - 6.6) / 1.8, 0, 1) * 0.6 + clamp(1 - Math.abs(h - 19.3) / 1.2, 0, 1) * 0.25 + N * 0.12;
    if (fogK > 0.02) { const fc = N > 0.5 ? '#8a93c8' : Wm > 0.3 ? '#ffd9c4' : '#f4f8ff'; for (let i = 0; i < 9; i++) { const x = rr(0, TW), y = rr(0.76, 0.9) * TH, w = rr(0.18, 0.4) * TW, fg = c.createRadialGradient(x, y, 0, x, y, w); fg.addColorStop(0, rgbaH(fc, 0.5 * fogK)); fg.addColorStop(1, rgbaH(fc, 0)); c.save(); c.scale(1, 0.18); c.fillStyle = fg; c.beginPath(); c.arc(x, y / 0.18, w, 0, PI2); c.fill(); c.restore(); } } }
  yield; // 11) colour grade (warm at golden/sunset) + rounded vignette
  if (Wm > 0.05) { c.save(); c.globalCompositeOperation = 'soft-light'; c.fillStyle = 'rgba(255,140,70,' + (Wm * 0.35).toFixed(3) + ')'; c.fillRect(0, 0, TW, TH); c.restore(); }
  yield; { R = bgRng('lb-grain'); const gc = doc.createElement('canvas'); gc.width = gc.height = 96; const gx = swCtx(gc), id = gx.createImageData(96, 96); for (let i = 0; i < id.data.length; i += 4) { const v = R() < 0.5 ? 0 : 255; id.data[i] = id.data[i + 1] = id.data[i + 2] = v; id.data[i + 3] = 4 + (R() * 8 | 0); } gx.putImageData(id, 0, 0); c.save(); c.globalAlpha = 0.3; c.fillStyle = c.createPattern(gc, 'repeat'); c.fillRect(0, 0, TW, TH * 0.75); c.restore(); }
  { const vg = c.createRadialGradient(TW / 2, TH * 0.45, Math.min(TW, TH) * 0.35, TW / 2, TH * 0.45, Math.hypot(TW, TH) * 0.62); vg.addColorStop(0, 'rgba(10,20,60,0)'); vg.addColorStop(1, 'rgba(10,20,60,' + (0.22 + N * 0.12).toFixed(3) + ')'); c.fillStyle = vg; c.fillRect(0, 0, TW, TH); }
  // t292u: sky-above-the-mountains clip so the live sun/moon set BEHIND the ridges
  { const P = new Path2D(); P.moveTo(-4, -4); P.lineTo(TW + 4, -4); for (let x = TW + 6; x >= -6; x -= 6) { let y = TH; for (const f2 of rl) y = Math.min(y, f2(x)); P.lineTo(x, y + 1.5); } P.closePath(); clip2 = P; }
  yield; const cl2 = yield* skyCloudsGen(U, TOD); // t289u: clouds keep their drifted positions across rebuilds (positions copied at commit)
  if (!fireflies.length) fireflies = Array.from({ length: Math.round(14 + TW / 50) }, () => ({ x: Math.random(), y: rand(0.72, 0.97), ph: rand(0, 6), sp: rand(0.4, 1), r: rand(1.1, 2.3), c: ['230,255,140', '255,236,150', '190,255,200'][Math.random() * 3 | 0] }));
  // drifting valley mist tile (seamless, scrolled in drawTank)
  yield; { const mw = Math.round(TW), mh = Math.max(8, Math.round(TH * 0.16)), q = Math.min(DPR, 1.5), mc = doc.createElement('canvas'); mc.width = Math.round(mw * q); mc.height = Math.round(mh * q); const m = swCtx(mc); m.scale(q, q);
    const M = bgRng('lb-mist'), col = mixHex(mixHex(mixHex(TOD.hor, '#ffffff', 0.55), '#ffd0b0', Wm * 0.5), '#7d86bd', N * 0.8);
    for (let i = 0; i < 18; i++) { const x = M() * mw, y = mh * (0.35 + M() * 0.35), w = (0.07 + M() * 0.15) * mw, hh = mh * (0.1 + M() * 0.2); for (const ox of [-mw, 0, mw]) { const X = x + ox, g = m.createRadialGradient(X, y, 0, X, y, w); g.addColorStop(0, rgbaH(col, 0.5)); g.addColorStop(1, rgbaH(col, 0)); m.save(); m.translate(X, y); m.scale(1, hh / w); m.translate(-X, -y); m.fillStyle = g; m.beginPath(); m.arc(X, y, w, 0, PI2); m.fill(); m.restore(); } }
    mist2 = mc; bgFlush(mc); bgWarmQ.push(mc); }
  // rainbow (pelangi) sprite — shown now and then by day, opposite the sun
  { const R0 = Math.round(Math.min(TW * 0.42, TH * 0.62)); if (!rbCv || rbR !== R0) { rbR = R0; const cv = doc.createElement('canvas'), w = R0 * 2 + 40, hh = R0 + 20; cv.width = w; cv.height = hh; const r = swCtx(cv), bw = R0 * 0.016; try { r.filter = 'blur(2px)'; } catch (e) {}
      ['#ff5a5a', '#ffa24a', '#ffe45a', '#6be36b', '#5ab4ff', '#6a6aff', '#b56aff'].forEach((col, i) => { r.strokeStyle = rgbaH(col, 0.5); r.lineWidth = bw * 1.25; r.beginPath(); r.arc(w / 2, R0 + 10, R0 - i * bw, PI, PI2); r.stroke(); });
      r.filter = 'none'; r.globalCompositeOperation = 'destination-out'; const yt = TH * 0.8 - R0 - 10, fg = r.createLinearGradient(0, TH * 0.46 - yt, 0, TH * 0.63 - yt); fg.addColorStop(0, 'rgba(0,0,0,0)'); fg.addColorStop(1, 'rgba(0,0,0,1)'); r.fillStyle = fg; r.fillRect(0, 0, w, hh); rbCv = cv; bgFlush(cv); bgWarmQ.push(cv); } }
  // t333u: CPU raster done → upload into the GPU backdrop in strips (one per slice; no readback of the GPU canvas: bgJobCv = null)
  bgJobCv = null; { const gB = cvB.getContext('2d'), sS = swCtx(cvS), W2 = cvS.width, H2 = cvS.height, SH = bgSync ? H2 : Math.max(32, Math.ceil(H2 / Math.max(4, Math.ceil(W2 * H2 / 260000))));
    try { for (let y = 0; y < H2; y += SH) { if (cvS.width !== W2 || cvS.height !== H2) break; const hh = Math.min(SH, H2 - y); gB.putImageData(sS.getImageData(0, y, W2, hh), 0, y); if (!bgSync) yield 'f'; } }
    catch (e) { gB.setTransform(1, 0, 0, 1, 0, 0); gB.drawImage(cvS, 0, 0); } }
  for (let i = 0; i < 40 && bgWarmQ.length && !bgSync; i++) yield 'f'; // let the sprite pre-upload finish (bounded)
  // commit (geometry changed mid-build → throw it away, a fresh job is already queued by resize)
  if (TWb !== TW || THb !== TH || DPRb !== DPR) { if (!kf) bgPool.push(cvB); return null; }
  if (kf) { bgJobCv = null; return { h: TOD.h, cv: cvB, stars: st2, smk, clip: clip2, mist: mist2, cl: cl2.map(o => ({ cv: o.cv, rl: o.rl, rr: o.rr })) }; } // t340u: keyframe bake = no commit
  const prev = bgCanvas; bgCanvas = cvB; stars = st2; smokeAt = smk; skyClip = clip2; mistPv = mistCv; mistCv = mist2; bgJobCv = null;
  if (skyClouds.length === cl2.length) cl2.forEach((cl, i) => { const o = skyClouds[i]; cl.x = o.x; if (o.cv) cl.pv = { cv: o.cv, rl: o.rl, rr: o.rr }; }); skyClouds = cl2; // t308u: old sprites kept for the cross-fade (cloud tint no longer pops at commit)
  return prev;
}
/* t289u cloud system: 4 depths of cumulus (two puff rows, flat base), each with a body sprite + left/right rim-light sprites crossfaded by where the sun/moon is → lighting glides instead of popping */
function* skyCloudsGen(U, T0) {
  const K = bgRng('lb-clouds-v3'), n = Math.max(8, Math.round(TW / 115)), keep = skyClouds.length === n ? skyClouds : null, out = [];
  for (let i = 0; i < n; i++) { const d = i % 4, kx = K(), np = 5 + (K() * 4 | 0), W = 44 + K() * 42, H = 15 + K() * 16, puffs = [];
    for (let j = 0; j < np; j++) { const u = (j + 0.5) / np, dome = Math.sin(u * Math.PI); puffs.push([(u - 0.5) * W * 2, -dome * H * (0.6 + K() * 0.5), 11 + dome * 13 + K() * 6]); }
    for (let j = 0; j < np - 2; j++) { const u = (j + 1) / (np - 1), dome = Math.sin(u * Math.PI); puffs.push([(u - 0.5) * W * 1.25 + K() * 8 - 4, -dome * H * 1.3 - 6, 8 + dome * 10 + K() * 4]); }
    const old = keep && keep[i], cl = { x: old ? old.x : kx * 1.3 - 0.15, y: 0.06 + K() * 0.34 + d * 0.035, s: (0.8 + K() * 0.55) * (1 - d * 0.17) * U, d, sp: 1.15 - d * 0.24, ph: K() * 6, puffs };
    Object.assign(cl, cloudSprite(cl, T0)); bgFlush(cl.cv); bgFlush(cl.rl); bgFlush(cl.rr); bgWarmQ.push(cl.cv, cl.rl, cl.rr); out.push(cl); yield; }
  return out;
}
function cloudSprite(cl, T0) {
  const TOD = T0 || todSnap();
  const s = cl.s * DPR, PI2 = Math.PI * 2; let x0 = 1e9, x1 = -1e9, y0 = 1e9; for (const [dx, dy, r] of cl.puffs) { x0 = Math.min(x0, dx - r); x1 = Math.max(x1, dx + r); y0 = Math.min(y0, dy - r); }
  const base = 9, pad = 9, W = x1 - x0 + pad * 2, H = base - y0 + pad * 2;
  const mk = () => { const cv = doc.createElement('canvas'); cv.width = Math.ceil(W * s); cv.height = Math.ceil(H * s); const c = swCtx(cv); c.scale(s, s); c.translate(pad - x0, pad - y0); return [cv, c]; };
  const N = TOD.night, Wm = TOD.warm, far = cl.d / 3, m3 = (dd, w, n) => mixHex(mixHex(dd, w, Wm), n, N);
  const lit = m3('#ffffff', '#ffe4c4', '#e2e6fa'), body = mixHex(m3('#eef4fc', '#f2cbc0', '#959ec9'), TOD.mid, far * 0.5), dark = m3('#a5bbdb', '#a76f90', '#4a5385'), under = m3('#d6e4f5', '#ff9a6e', '#676ca4'), rim = m3('#ffffff', '#ffc684', '#d2daff');
  const blob = (c, ox, oy) => { c.beginPath(); for (const [dx, dy, r] of cl.puffs) { c.moveTo(dx + ox + r, dy + oy); c.arc(dx + ox, dy + oy, r, 0, PI2); } c.fill(); };
  const clip = c => { c.beginPath(); c.rect(x0 - pad, y0 - pad, W, base - y0 + pad); c.clip(); };
  const [cv, c] = mk(); c.save(); clip(c); try { c.filter = 'blur(2.5px)'; } catch (e) {} c.fillStyle = rgbaH(body, 0.45); blob(c, 0, 1); c.filter = 'none'; c.fillStyle = body; blob(c, 0, 0); c.globalCompositeOperation = 'source-atop';
  const g = c.createLinearGradient(0, y0, 0, base); g.addColorStop(0, rgbaH(lit, 0.8)); g.addColorStop(0.42, rgbaH(body, 0)); g.addColorStop(0.78, rgbaH(dark, 0.5 - far * 0.2)); g.addColorStop(1, rgbaH(under, 0.45 + Wm * 0.4)); c.fillStyle = g; c.fillRect(x0 - pad, y0 - pad, W, H);
  for (const [dx, dy, r] of cl.puffs) { const rg = c.createRadialGradient(dx, dy - r * 0.35, r * 0.15, dx, dy, r); rg.addColorStop(0, rgbaH(lit, 0.32 - far * 0.15)); rg.addColorStop(1, rgbaH(lit, 0)); c.fillStyle = rg; c.beginPath(); c.arc(dx, dy, r, 0, PI2); c.fill(); }
  c.restore();
  const rimS = side => { const [rv, r2] = mk(); r2.save(); clip(r2); r2.fillStyle = rgbaH(rim, 0.8); blob(r2, 0, 0); r2.globalCompositeOperation = 'destination-out'; try { r2.filter = 'blur(1.5px)'; } catch (e) {} r2.fillStyle = '#000'; blob(r2, -side * 4.5, 3.5); r2.restore(); return rv; };
  return { cv, rl: rimS(-1), rr: rimS(1), ox: (x0 - pad) * cl.s, oy: (y0 - pad) * cl.s, w: cv.width / DPR, h: cv.height / DPR };
}
function softCloud(ctx, x, y, s, puffs, alpha) {
  ctx.save(); ctx.globalAlpha = alpha; const top = TOD.night > 0.5 ? '#c8cde6' : TOD.warm > 0.5 ? '#ffe9d6' : '#ffffff', bot = TOD.night > 0.5 ? '#8c94bd' : TOD.warm > 0.5 ? '#f1b8a0' : '#dbe9f7';
  const g = ctx.createLinearGradient(0, y - 34 * s, 0, y + 14 * s); g.addColorStop(0, top); g.addColorStop(1, bot); ctx.fillStyle = g; ctx.beginPath();
  for (const [dx, dy, r] of puffs) { ctx.moveTo(x + dx * s + r * s, y + dy * s); ctx.arc(x + dx * s, y + dy * s, r * s, 0, Math.PI * 2); }
  ctx.fill(); ctx.restore();
}
/* ---------- sky life: distant flocks, blown leaves/petals on gusts, shooting stars at night ---------- */
const flocks = [], leaves = [], shoots = [], LIFE_T = { flock: rand(6, 14), gust: rand(8, 16), shoot: rand(5, 12) };
function spawnFlock() { const dir = Math.random() < 0.5 ? 1 : -1, n = 3 + (Math.random() * 5 | 0); flocks.push({ x: dir > 0 ? -0.08 : 1.08, y: rand(0.12, 0.45), dir, n, sp: rand(0.04, 0.07), ph: rand(0, 6), s: rand(0.7, 1.2) }); }
function spawnGust() { const k = Math.abs(WIND), n = Math.round((6 + k * 12) * PQ()), from = WIND >= 0 ? -0.05 : 1.05; for (let i = 0; i < n; i++) leaves.push({ x: from + rand(-0.05, 0.05), y: rand(0.35, 0.85), vx: (WIND >= 0 ? 1 : -1) * rand(0.12, 0.22) * (0.6 + k), vy: rand(-0.03, 0.02), r: rand(3, 5.5), rot: rand(0, 6), vr: rand(-4, 4), col: ['#7cc35a', '#f2c14e', '#ff9bb3', '#e07a3e', '#a7d96b'][i % 5], d: i * rand(0.03, 0.12), life: 1 }); LIFE.rustle(WIND >= 0 ? 0.1 : 0.9, k); }
function spawnShoot(shower) { if (shower) { const a = rand(0.25, 2.9), sp = rand(0.4, 0.7), o = rand(0.03, 0.22); shoots.push({ x: 0.7 + Math.cos(a) * o, y: 0.1 + Math.sin(a) * o * 0.8, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.6, life: rand(0.7, 1) }); if (Math.random() < 0.2) LIFE.sparkle(0.3); return; } shoots.push({ x: rand(0.1, 0.8), y: rand(0.05, 0.3), vx: rand(0.35, 0.55) * (Math.random() < 0.5 ? 1 : -1), vy: rand(0.12, 0.2), life: 1 }); LIFE.sparkle(0.5); }
function drawLife(ctx, dt, t) {
  LIFE_T.flock -= dt; if (LIFE_T.flock <= 0) { LIFE_T.flock = rand(18, 40); if (flocks.length < 3 && TOD.night < 0.6) spawnFlock(); }
  LIFE_T.gust -= dt; if (LIFE_T.gust <= 0) { LIFE_T.gust = rand(14, 30) * (1.3 - Math.abs(WIND) * 0.6); if (leaves.length < 60) spawnGust(); }
  LIFE_T.shoot -= dt; if (LIFE_T.shoot <= 0) { const ms = SKYC.ev === 'meteor'; LIFE_T.shoot = ms ? rand(0.25, 1.1) : rand(10, 25); if (TOD.night > 0.55 && shoots.length < (ms ? 7 : 2)) spawnShoot(ms); } // t292u: hujan meteor on new-moon nights
  ctx.save(); ctx.strokeStyle = TOD.night > 0.5 ? 'rgba(220,225,255,.6)' : 'rgba(40,50,70,.55)'; ctx.lineCap = 'round'; ctx.lineWidth = 1.4;
  for (let i = flocks.length - 1; i >= 0; i--) { const f = flocks[i]; f.x += f.dir * f.sp * dt; if (f.x < -0.15 || f.x > 1.15) { flocks.splice(i, 1); continue; }
    for (let j = 0; j < f.n; j++) { const row = Math.ceil(j / 2), side = j % 2 ? 1 : -1, x = (f.x - f.dir * row * 0.018) * TW, y = f.y * TH + side * row * 9 * f.s + Math.sin(t * 2 + j) * 2, w = 5 * f.s, fl = Math.sin(t * 9 + f.ph + j) * 3 * f.s;
      ctx.beginPath(); ctx.moveTo(x - w, y - fl); ctx.quadraticCurveTo(x - w * 0.4, y - 2, x, y); ctx.quadraticCurveTo(x + w * 0.4, y - 2, x + w, y - fl); ctx.stroke(); } }
  ctx.restore();
  for (let i = leaves.length - 1; i >= 0; i--) { const l = leaves[i]; if (l.d > 0) { l.d -= dt; continue; } l.x += l.vx * dt; l.y += (l.vy + Math.sin(t * 2 + l.rot) * 0.02) * dt; l.rot += l.vr * dt; if (l.x < -0.1 || l.x > 1.1) { leaves.splice(i, 1); continue; }
    ctx.save(); ctx.translate(l.x * TW, l.y * TH); ctx.rotate(l.rot); ctx.scale(1, 0.45 + 0.55 * Math.abs(Math.sin(l.rot))); ctx.fillStyle = l.col; ctx.beginPath(); ctx.ellipse(0, 0, l.r * 1.4, l.r * 0.7, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore(); }
  for (let i = shoots.length - 1; i >= 0; i--) { const s = shoots[i]; s.x += s.vx * dt; s.y += s.vy * dt; s.life -= dt * 0.9; if (s.life <= 0) { shoots.splice(i, 1); continue; }
    const x = s.x * TW, y = s.y * TH, g = ctx.createLinearGradient(x, y, x - s.vx * 160, y - s.vy * 160); g.addColorStop(0, 'rgba(255,255,255,' + s.life + ')'); g.addColorStop(1, 'rgba(255,255,255,0)'); ctx.strokeStyle = g; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - s.vx * 160, y - s.vy * 160); ctx.stroke(); }
}
root.DQSky = { bgMode: () => ({ wp: WP, kf: kfMode(), iv: kfMode() ? 0 : bgIv(), fade: bgFadeS(), soft: true, warmQ: bgWarmQ.length }), kf: () => ({ mode: kfMode(), on: KF.on, done: KF.done, n: KF_H.length, baking: !!KF.job, a: KF.a, b: KF.b, w: +KF.w.toFixed(3), inK: KF.inK, bakeMs: KF.bakeMs, hours: KF_H.slice() }), rain: v => { rbForceRain = v == null ? null : +v; }, rainK: () => RAIN.k, rainN: () => RAIN.drops.length, rainWin, steps: () => bgSteps.map(x => +x.toFixed(1)), cal: () => Object.assign({}, SKYC), hours: skyHours, orb: () => Object.assign({}, ORB, { sun: sunAt }), at: (S, run) => { skyPin = { S, t0: performance.now(), run: !!run }; todUpdate(); bgDirty = true; bgAt = -1e9; windT = 0; }, live: () => { skyPin = null; bgDirty = true; bgAt = -1e9; windT = 0; }, buildMs: () => { const t0 = performance.now(); buildBg(); return performance.now() - t0; }, clouds: () => skyClouds, motes, rainbow: on => { rbForce = !!on; }, rbK: () => rbK, bgAt: () => bgAt, fade: () => bgFade, rebuild: () => { bgDirty = true; bgAt = -1e9; windT = 0; } };
root.DQLife = { flocks, leaves, shoots, flock: spawnFlock, gust: spawnGust, shoot: spawnShoot, timers: LIFE_T, wind: () => WIND, windAt, tod: () => Object.assign({}, TOD) };
/* ---------- t292u live sun & moon: continuous 60x arc, clipped behind the mountains, 6 moon phases, solar (total / cincin) + lunar (bulan merah) eclipses, supermoon, Bintang Kejora ---------- */
let skyClip = null, haloCv = null, haloKey = '', moonCv = null, moonKey = '', ORB = { cov: 0, mx: 0, my: 0, mr: 0 }, evCap = { id: '', t: 0 };
function sunPos(h) { const day = h >= 5.8 && h <= 18.6, f = day ? (h - 5.8) / 12.8 : ((h + 24 - 18.6) % 24) / 11.2; return { x: 0.1 + f * 0.8, y: 0.72 - Math.sin(f * Math.PI) * 0.58, up: day ? 1 : 0, f }; }
function haloSprite(col, r, k) { const key = col + '|' + Math.round(r) + '|' + k.toFixed(2); if (haloKey === key) return haloCv; const q = 0.5, R = r * 9 * k, cv = doc.createElement('canvas'), w = Math.ceil(R * 2 * q); cv.width = cv.height = w; const c = cv.getContext('2d'); c.scale(q, q);
  for (const [kk, a] of [[9, 0.18], [4.5, 0.28], [2.2, 0.42]]) { const gl = c.createRadialGradient(R, R, r * 0.6, R, R, r * kk * k); gl.addColorStop(0, rgbaH(col, a)); gl.addColorStop(1, rgbaH(col, 0)); c.fillStyle = gl; c.fillRect(0, 0, R * 2, R * 2); }
  haloKey = key; haloCv = cv; return cv; }
function moonSprite(r, p, col) { const key = p + '|' + Math.round(r * 2) + '|' + col; if (moonKey === key) return moonCv; const q = Math.min(DPR, 2), S = Math.ceil((r + 3) * 2), cv = doc.createElement('canvas'); cv.width = cv.height = Math.ceil(S * q); const c = cv.getContext('2d'), PI2 = Math.PI * 2; c.scale(q, q); c.translate(S / 2, S / 2);
  // earthshine: the dark limb is faintly visible
  if (p > 0.01) { const waning = p > 0.5, k = Math.cos(2 * Math.PI * p), ang = waning ? Math.PI - 0.55 : 0.55; c.save(); c.rotate(ang); if (waning) c.scale(1, -1);
    c.beginPath(); c.arc(0, 0, r, -Math.PI / 2, Math.PI / 2, false); if (Math.abs(k) > 0.995) { if (k < 0) c.arc(0, 0, r, Math.PI / 2, Math.PI * 1.5, false); } else c.ellipse(0, 0, r * Math.abs(k), r, 0, Math.PI / 2, -Math.PI / 2, k > 0); c.closePath(); c.clip();
    const mg = c.createRadialGradient(-r * 0.3, -r * 0.35, r * 0.1, 0, 0, r); mg.addColorStop(0, mixHex(col, '#ffffff', 0.6)); mg.addColorStop(1, mixHex(col, '#b8b39c', 0.35)); c.fillStyle = mg; c.fillRect(-r - 2, -r - 2, r * 2 + 4, r * 2 + 4);
    c.fillStyle = 'rgba(160,156,134,.3)'; for (const [dx, dy, r2] of [[-0.27, -0.18, 0.23], [0.32, 0.22, 0.18], [-0.09, 0.4, 0.14], [0.18, -0.4, 0.11], [-0.4, 0.27, 0.09], [0.05, 0.02, 0.08]]) { c.beginPath(); c.arc(dx * r, dy * r, r2 * r, 0, PI2); c.fill(); }
    c.restore(); }
  moonKey = key; moonCv = cv; return cv; }
function drawOrbs(ctx, t) {
  SKYC = skyCal(skyHours()); const h = SKYC.h, sp = sunPos(h), U = clamp(TH / 450, 0.7, 1.5), c = SKYC, Wm = TOD.warm, PI2 = Math.PI * 2; sunAt = sp;
  const eg = eclGeo(c), x = sp.x * TW, y = sp.y * TH, low = clamp((sp.y - 0.42) / 0.3, 0, 1); ORB.cov = eg ? eg.cov : 0;
  const mp = sunPos(md(h - c.moonP * 24, 24)), moonUp = mp.up && c.moonP > 0.01 && !eg;
  ctx.save(); if (skyClip) ctx.clip(skyClip);
  // moon: rides the same arc but lags the sun by phase x 24 h (sabit sets soon after the sun, purnama rises at sunset, separuh susut rises at midnight) — pale by day, bright at night; rising moon golden + bigger; supermoon ~1.3x
  if (moonUp) {
    const x = mp.x * TW, y = mp.y * TH, low = clamp((mp.y - 0.42) / 0.3, 0, 1), sup = c.ev === 'super', r = 22 * U * (sup ? 1.32 : 1) * (1 + low * 0.1), p = c.moonP, col = mixHex(sup ? '#fff1d2' : '#fffbea', '#ffcf8e', Math.round(low * 20) / 20 * (sup ? 0.9 : 0.55)), lg = lunGeo(c), nk = clamp((TOD.night - 0.12) / 0.35, 0, 1), vis = 0.42 + 0.58 * nk;
    ORB.mx = x; ORB.my = y; ORB.mr = r; if (!sp.up) sunAt = { x: mp.x, y: mp.y, up: 0, f: mp.f };
    if (vis > 0.01) { const illum = (1 - Math.cos(2 * Math.PI * p)) / 2, red = lg ? lg.red : 0, hcol = red > 0.3 ? '#ff7a52' : sup ? '#ffe7b0' : '#dfe6ff';
      for (const [kk, a] of [[5, 0.16], [2.4, 0.3]]) { const R = r * kk * (sup ? 1.2 : 1), gl = ctx.createRadialGradient(x, y, r * 0.6, x, y, R); gl.addColorStop(0, rgbaH(hcol, a * nk * (0.25 + illum * 0.75) * (red > 0 ? 0.6 + red * 0.4 : 1))); gl.addColorStop(1, rgbaH(hcol, 0)); ctx.fillStyle = gl; ctx.fillRect(x - R, y - R, R * 2, R * 2); }
      const mv = moonSprite(r, p, col), S = mv.width / Math.min(DPR, 2); if (nk > 0.02) { ctx.fillStyle = 'rgba(70,82,140,' + (0.24 * nk).toFixed(3) + ')'; ctx.beginPath(); ctx.arc(x, y, r, 0, PI2); ctx.fill(); } /* earthshine only at night */ ctx.globalAlpha = vis; ctx.drawImage(mv, x - S / 2, y - S / 2, S, S);
      if (lg) { ctx.save(); ctx.beginPath(); ctx.arc(x, y, r + 0.5, 0, PI2); ctx.clip(); const ux2 = x + lg.d * r * 0.92, uy2 = y + lg.d * r * 0.3, ug = ctx.createRadialGradient(ux2, uy2, r * 1.1, ux2, uy2, r * 1.6);
        ug.addColorStop(0, 'rgba(150,40,18,' + (0.86).toFixed(3) + ')'); ug.addColorStop(0.85, 'rgba(110,26,12,0.9)'); ug.addColorStop(1, 'rgba(60,12,8,0.55)'); ctx.fillStyle = ug; ctx.globalCompositeOperation = 'source-atop'; ctx.beginPath(); ctx.arc(ux2, uy2, r * 1.6, 0, PI2); ctx.fill();
        if (red > 0.5) { ctx.globalCompositeOperation = 'source-over'; ctx.fillStyle = 'rgba(255,120,70,' + ((red - 0.5) * 0.3).toFixed(3) + ')'; ctx.beginPath(); ctx.arc(x - r * 0.25, y - r * 0.3, r * 0.55, 0, PI2); ctx.fill(); } ctx.restore(); }
      ctx.globalAlpha = 1; }
  }
  if (sp.up) {
    const r = 30 * U * (1 + low * 0.14), col = Wm > 0.4 ? mixHex('#ffd27a', '#ff8a4a', clamp((Wm - 0.4) / 0.6, 0, 1)) : '#fff3c4', hk = 1 + Math.round(Wm * 8) / 20;
    const hv = haloSprite(col, 30 * U, hk), hw = hv.width * 2, haloA = eg ? (eg.tot ? 0 : 1 - Math.pow(eg.cov, 3) * 0.9) : 1;
    if (haloA > 0.01) { ctx.globalAlpha = haloA; ctx.drawImage(hv, x - hw / 2, y - hw / 2, hw, hw); ctx.globalAlpha = 1; }
    const ux = 0.94, uy = 0.34, mx = eg ? x + eg.d * r * ux : 0, my = eg ? y + eg.d * r * uy : 0;
    if (eg && eg.ev !== 'cincin' && eg.cov > 0.9) { // corona + streamers around totality
      const ck = clamp((eg.cov - 0.9) / 0.1, 0, 1) * (eg.tot ? 1 : 0.55); ctx.save(); ctx.translate(x, y); ctx.rotate(t * 0.01);
      const cg = ctx.createRadialGradient(0, 0, r * 0.95, 0, 0, r * 3.4); cg.addColorStop(0, 'rgba(235,240,255,' + (0.85 * ck).toFixed(3) + ')'); cg.addColorStop(0.25, 'rgba(200,215,255,' + (0.35 * ck).toFixed(3) + ')'); cg.addColorStop(1, 'rgba(180,200,255,0)'); ctx.fillStyle = cg; ctx.beginPath(); ctx.arc(0, 0, r * 3.4, 0, PI2); ctx.fill();
      ctx.fillStyle = 'rgba(225,232,255,' + (0.28 * ck).toFixed(3) + ')'; for (let i = 0; i < 9; i++) { const a = i / 9 * PI2 + Math.sin(i * 3.1) * 0.3, L = r * (2.2 + 1.6 * Math.abs(Math.sin(i * 1.7))), wd = 0.11 + 0.06 * Math.sin(i * 2.3); ctx.beginPath(); ctx.moveTo(Math.cos(a - wd) * r, Math.sin(a - wd) * r); ctx.quadraticCurveTo(Math.cos(a) * L * 0.6, Math.sin(a) * L * 0.6, Math.cos(a) * L, Math.sin(a) * L); ctx.quadraticCurveTo(Math.cos(a) * L * 0.6, Math.sin(a) * L * 0.6, Math.cos(a + wd) * r, Math.sin(a + wd) * r); ctx.fill(); }
      ctx.restore(); }
    const sg = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r); sg.addColorStop(0, '#fffdf0'); sg.addColorStop(0.7, Wm > 0.4 ? '#ffcf73' : '#fff0a0'); sg.addColorStop(1, Wm > 0.4 ? '#ff9a4a' : '#ffd95e'); ctx.fillStyle = sg; ctx.beginPath(); ctx.arc(x, y, r, 0, PI2); ctx.fill();
    if (eg && eg.cov > 0.001) {
      if (eg.ev === 'cincin' && eg.cov > 0.8) { const rk = clamp((eg.cov - 0.8) / 0.13, 0, 1), rg = ctx.createRadialGradient(x, y, r * 0.8, x, y, r * 1.9); rg.addColorStop(0, 'rgba(255,170,70,' + (0.75 * rk).toFixed(3) + ')'); rg.addColorStop(1, 'rgba(255,120,40,0)'); ctx.fillStyle = rg; ctx.beginPath(); ctx.arc(x, y, r * 1.9, 0, PI2); ctx.fill(); }
      const md2 = ctx.createRadialGradient(mx - r * 0.2, my - r * 0.2, 0, mx, my, r * eg.rm); md2.addColorStop(0, '#1c2246'); md2.addColorStop(1, '#0b0f26'); ctx.fillStyle = md2; ctx.beginPath(); ctx.arc(mx, my, r * eg.rm, 0, PI2); ctx.fill();
      if (eg.ev === 'total') { const gap = Math.abs(eg.d) - (eg.rm - 1); if (gap > -0.02 && gap < 0.22) { const dk = 1 - clamp(gap / 0.22, 0, 1), sx = x - Math.sign(eg.d || 1) * ux * r, sy = y - Math.sign(eg.d || 1) * uy * r, dg = ctx.createRadialGradient(sx, sy, 0, sx, sy, r * 1.6); // diamond ring
        dg.addColorStop(0, 'rgba(255,255,255,' + (0.95 * dk).toFixed(3) + ')'); dg.addColorStop(0.15, 'rgba(255,250,225,' + (0.5 * dk).toFixed(3) + ')'); dg.addColorStop(1, 'rgba(255,240,200,0)'); ctx.fillStyle = dg; ctx.beginPath(); ctx.arc(sx, sy, r * 1.6, 0, PI2); ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,' + (0.7 * dk).toFixed(3) + ')'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(sx - r * 1.3, sy); ctx.lineTo(sx + r * 1.3, sy); ctx.moveTo(sx, sy - r); ctx.lineTo(sx, sy + r); ctx.stroke(); } } }
  }
  ctx.restore();
  // Bintang Kejora (Venus): brilliant point low in the west at dusk / east at dawn
  if (c.ev === 'kejora') { const dusk = c.h > 12, kx = (dusk ? 0.86 : 0.14) * TW, ky = TH * (dusk ? 0.4 : 0.38), win = dusk ? clamp((c.h - 18.3) / 0.4, 0, 1) * clamp((21.6 - c.h) / 0.5, 0, 1) : clamp((c.h - 3.6) / 0.4, 0, 1) * clamp((6.3 - c.h) / 0.5, 0, 1), a = win * clamp(TOD.night / 0.3 + 0.25, 0, 1) * (0.85 + 0.15 * Math.sin(t * 2.1));
    if (a > 0.02) { const g = ctx.createRadialGradient(kx, ky, 0, kx, ky, 16 * U); g.addColorStop(0, 'rgba(255,250,225,' + (0.9 * a).toFixed(3) + ')'); g.addColorStop(0.3, 'rgba(255,240,200,' + (0.3 * a).toFixed(3) + ')'); g.addColorStop(1, 'rgba(255,240,200,0)'); ctx.fillStyle = g; ctx.fillRect(kx - 16 * U, ky - 16 * U, 32 * U, 32 * U);
      ctx.strokeStyle = 'rgba(255,252,235,' + (0.7 * a).toFixed(3) + ')'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(kx - 11 * U, ky); ctx.lineTo(kx + 11 * U, ky); ctx.moveTo(kx, ky - 11 * U); ctx.lineTo(kx, ky + 11 * U); ctx.stroke(); ctx.fillStyle = 'rgba(255,255,245,' + a.toFixed(3) + ')'; ctx.beginPath(); ctx.arc(kx, ky, 2.3 * U, 0, PI2); ctx.fill(); } }
}
/* t346u: "gambar baru datang" — a new drawing gets a shared 3-2-1 countdown (timed from c.at + 3 s in room time, like Drawquarium t330u,
   so every device and the ?wallpaper stream count together) at a shared landing spot (seeded by the creation id): soft glow + converging
   dashed portal rings + number badge with a progress arc, a headline above and the kind + name below, plus a dotted trail from where it
   will come in (kite: up from the hill on its string, balloon: up from below, bird/plane: in from the side, cloud: condenses in place).
   Then a scripted entrance along that trail (scale pop, flaps / swoop / wobble) and a sparkle burst on arrival before normal flight.
   Late arrivals (> 1.5 s past the countdown) keep the plain entrance. Pure canvas; no backdrop rebuild (wallpaper keyframes untouched). */
const ARR_PI2 = Math.PI * 2, ARR = { cd: 3000, dur: { kite: 1.9, balloon: 2.1, bird: 1.5, plane: 1.35, cloud: 1.5 } }, arrFx = [], arrCues = [];
const ARR_COL = ['#fff6c8', '#ffd36b', '#ff9bb3', '#9fd8ff', '#c9f29b'];
function seeded(str) { let h = hashStr(str) || 1; return () => { h ^= h << 13; h >>>= 0; h ^= h >>> 17; h ^= h << 5; h >>>= 0; return h / 4294967296; }; }
function arrivePlan(c, m) {
  let rem = (+c.at || 0) + ARR.cd - nowMs(); if (rem < -1500) return false; if (!(rem < ARR.cd + 1200)) rem = ARR.cd; // clock skew guard
  const r = seeded('arr' + c.id), k = c.k, lx = 0.2 + r() * 0.6; let ly, sx, sy, cx, cy, dir = 1;
  if (k === 'kite') { ly = 0.14 + r() * 0.22; sx = lx; sy = GROUND - 0.03; cx = lx + (r() - 0.5) * 0.08; cy = (sy + ly) / 2; m.ax = lx; m.hy = ly; m.ang = 0; m.av = 0; }
  else if (k === 'balloon') { ly = 0.3 + r() * 0.22; sx = lx + (r() - 0.5) * 0.12; sy = 1.06; cx = (sx + lx) / 2 + (r() - 0.5) * 0.06; cy = (sy + ly) / 2; }
  else if (k === 'cloud') { ly = 0.12 + r() * 0.22; sx = cx = lx; sy = cy = ly; }
  else { ly = 0.16 + r() * 0.26; const left = r() < 0.5; dir = left ? 1 : -1; sx = left ? Math.max(-0.1, lx - 0.45) : Math.min(1.1, lx + 0.45); sy = ly + (k === 'plane' ? 0.12 : -0.06); cx = (sx + lx) / 2; cy = k === 'plane' ? ly + 0.2 : ly - 0.14; m.face = m.faceS = dir; }
  m.arr = { t0: performance.now() + Math.max(0, rem), n: 0, ph: 0, lx, ly, sx, sy, cx, cy, dir }; m.fa = 1; m.fresh = 0; m.es = 1; m.ea = 0; m.x = sx; m.y = sy;
  if (k === 'cloud') m.alpha = 0; if (k === 'plane') { m.loop = 0; m.turnT = 2; m.turn = 0; }
  if (root.DQArr) root.DQArr.planned++; return true;
}
const bez = (a, b, c, t) => (1 - t) * (1 - t) * a + 2 * (1 - t) * t * b + t * t * c, bezD = (a, b, c, t) => 2 * (1 - t) * (b - a) + 2 * t * (c - b);
function stepArrive(m, dt) {
  const a = m.arr; if (!a) return false; const el = (performance.now() - a.t0) / 1000;
  if (el < 0) { a.ph = 0; const n = Math.min(3, Math.ceil(-el)); if (n !== a.n) { a.n = n; SFX.tick(n); } return true; }
  const D = ARR.dur[m.k] || 1.5, k = Math.min(1, el / D);
  if (a.ph === 0) { a.ph = 1; LIFE.whoosh(a.sx); if (m.k !== 'cloud') arrBurst(a.sx, Math.min(a.sy, 0.97), 0.45); }
  if (k < 1) {
    const e = m.k === 'balloon' || m.k === 'kite' ? 1 - Math.pow(1 - k, 2.4) : 1 - Math.pow(1 - k, 3), ob = REDUCED ? 1 : 1 + 2.2 * Math.pow(k - 1, 3) + 1.2 * Math.pow(k - 1, 2); // easeOutBack-ish
    m.es = REDUCED ? 1 : 0.5 + 0.5 * ob; m.ea = m.k === 'kite' || m.k === 'balloon' ? Math.min(1, k / 0.08) : Math.min(1, k / 0.22);
    m.x = bez(a.sx, a.cx, a.lx, e); m.y = bez(a.sy, a.cy, a.ly, e); const dx = bezD(a.sx, a.cx, a.lx, e) * TW, dy = bezD(a.sy, a.cy, a.ly, e) * TH;
    if (m.k === 'kite') { m.ang = REDUCED ? 0 : Math.sin(el * 7) * 0.28 * (1 - k); m.av = 0; }
    else if (m.k === 'balloon') m.ang = REDUCED ? 0 : Math.sin(el * 3.2) * 0.14 * (1 - k);
    else if (m.k === 'bird') { m.face = m.faceS = a.dir; m.phase += dt * 17; m.flap = Math.cos(m.phase); m.tilt = clamp(Math.atan2(dy, Math.abs(dx) || 1) * 0.45, -0.4, 0.4) * a.dir; }
    else if (m.k === 'plane') { m.a = Math.atan2(dy, dx); m.fl = Math.cos(m.a) < 0; }
    else { m.alpha = e; m.es = REDUCED ? 1 : 0.7 + 0.3 * e; }
    a.e = e; if (!REDUCED && m.k !== 'cloud' && Math.random() < dt * 26 && arrFx.length < 90) arrFx.push({ x: m.x + rand(-0.006, 0.006), y: m.y + rand(-0.01, 0.01), vx: rand(-14, 14), vy: rand(-6, 16), r: rand(1.8, 3.4), t: 0, life: rand(0.5, 0.9), col: ARR_COL[(Math.random() * ARR_COL.length) | 0], rot: rand(0, 6) }); // sparkle wake
    return true;
  }
  m.arr = null; m.es = 1; m.ea = 1; m.x = a.lx; m.y = a.ly; arrBurst(a.lx, a.ly, 1, m.k === 'cloud'); SFX.splash(); if (root.DQArr) root.DQArr.landed++;
  if (m.k === 'kite') { m.ax = a.lx; m.hy = a.ly; m.ang = 0; m.av = 0; }
  else if (m.k === 'bird') { m.vx = a.dir * 0.07; m.vy = 0; m.mode = 1; m.modeT = rand(2, 4); newTarget(m); }
  else if (m.k === 'plane') { m.a = Math.atan2(clamp(Math.sin(m.a), -0.5, 0.5), Math.cos(m.a)); m.turnT = rand(1.5, 3); }
  else if (m.k === 'balloon') { m.vy = -0.004; m.vx = 0; }
  else m.alpha = 1;
  return false;
}
/* arrival sparkle burst: expanding ring + 4-point twinkles radiating out (cloud: soft white puffs) */
function arrBurst(x, y, s, puff) {
  if (arrFx.length > 90) return; const n = Math.round((puff ? 9 : 16) * s * (REDUCED ? 0.5 : 1));
  arrFx.push({ ring: 1, x, y, t: 0, life: 0.85, s });
  for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2 + rand(-0.2, 0.2), v = rand(60, 150) * s; arrFx.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.8 - 20 * s, r: (puff ? rand(6, 12) : rand(2.4, 4.6)) * s, t: 0, life: rand(0.6, 1.1), col: puff ? '#ffffff' : ARR_COL[i % ARR_COL.length], puff, rot: rand(0, 6) }); }
}
function drawArrFx(ctx, dt) {
  if (!arrFx.length) return; const U = clamp(TH / 450, 0.8, 1.6); ctx.save();
  for (let i = arrFx.length - 1; i >= 0; i--) { const p = arrFx[i]; p.t += dt; if (p.t > p.life) { arrFx.splice(i, 1); continue; } const k = p.t / p.life, x = p.x * TW, y = p.y * TH;
    if (p.ring) { ctx.globalAlpha = (1 - k) * 0.8; ctx.strokeStyle = '#fff8dc'; ctx.lineWidth = 2.4 * U * (1 - k * 0.6); ctx.beginPath(); ctx.arc(x, y, (14 + k * 62 * p.s) * U, 0, ARR_PI2); ctx.stroke();
      if (k < 0.45) { const r = 70 * U * p.s; ctx.globalAlpha = 0.55 * (1 - k / 0.45); ctx.drawImage(glow('255,246,214', [0.4, 0.35]), x - r, y - r, r * 2, r * 2); } continue; }
    p.vx *= 1 - dt * 2.2; p.vy = p.vy * (1 - dt * 2.2) + 14 * dt; p.x += p.vx * U * dt / TW; p.y += p.vy * U * dt / TH; p.rot += dt * 3;
    const r = p.r * U * (p.puff ? 1 + k * 0.8 : 1 - 0.5 * k); ctx.globalAlpha = (1 - k) * (p.puff ? 0.55 : 0.95);
    if (p.puff) { ctx.drawImage(glow('255,255,255', [0.5, 0.5]), x - r, y - r, r * 2, r * 2); continue; }
    ctx.fillStyle = p.col; ctx.save(); ctx.translate(x, y); ctx.rotate(p.rot); ctx.beginPath(); for (let j = 0; j < 8; j++) { const rr = j % 2 ? r * 0.32 : r, aa = j * Math.PI / 4; ctx.lineTo(Math.cos(aa) * rr, Math.sin(aa) * rr); } ctx.closePath(); ctx.fill(); ctx.restore(); }
  ctx.restore();
}
/* while entering: the rest of the dotted trail (ahead of the creature) stays and fades out */
function drawArrTrail(ctx, m) {
  const a = m.arr, e = a.e || 0, U = clamp(TH / 450, 0.85, 1.6), now = performance.now() / 1000; if (m.k === 'cloud' || e >= 0.98) return;
  ctx.save(); ctx.globalAlpha = 0.6 * (1 - e) * (1 - e); ctx.strokeStyle = TOD.night > 0.5 ? 'rgba(255,246,214,.95)' : 'rgba(255,255,255,.95)'; ctx.lineWidth = 3 * U; ctx.lineCap = 'round'; ctx.setLineDash([0.1, 11 * U]); ctx.lineDashOffset = -now * 34 * U;
  ctx.beginPath(); ctx.moveTo(m.x * TW, m.y * TH); for (let i = 1; i <= 12; i++) { const t = e + (1 - e) * i / 12; ctx.lineTo(bez(a.sx, a.cx, a.lx, t) * TW, bez(a.sy, a.cy, a.ly, t) * TH); } ctx.stroke(); ctx.restore();
}
function drawArrCue(ctx, m) {
  const a = m.arr, el = (performance.now() - a.t0) / 1000, n = Math.min(3, Math.max(1, Math.ceil(-el))), f = 1 - ((-el) % 1 || 1), U = clamp(TH / 450, 0.85, 1.6), now = performance.now() / 1000;
  const x = a.lx * TW, y = Math.max(a.ly * TH, 60 * U), night = TOD.night > 0.5, gold = n === 1, lead = clamp((ARR.cd / 1000 + el) / 0.4, 0, 1); // lead: fade the cue in over 0.4 s
  const pop = REDUCED ? 1 : 1 + 0.4 * Math.max(0, 1 - f * 5) - 0.06 * Math.max(0, f - 0.85) / 0.15, spin = REDUCED ? 0 : now;
  ctx.save(); ctx.globalAlpha = lead;
  // soft spotlight on the landing spot
  { const r = (64 + 10 * Math.sin(now * 3)) * U; ctx.globalAlpha = lead * (night ? 0.5 : 0.7); ctx.drawImage(glow(gold ? '255,214,140' : '255,248,220', [0.35, 0.3], 128), x - r, y - r, r * 2, r * 2); }
  // dotted trail from the entry point, dots flowing towards the spot
  if (m.k !== 'cloud') { ctx.globalAlpha = lead * (0.5 + 0.25 * Math.sin(now * 6)); ctx.strokeStyle = night ? 'rgba(255,246,214,.95)' : 'rgba(255,255,255,.95)'; ctx.lineWidth = 3 * U; ctx.lineCap = 'round'; ctx.setLineDash([0.1, 11 * U]); ctx.lineDashOffset = -now * 34 * U;
    ctx.beginPath(); ctx.moveTo(a.sx * TW, a.sy * TH); ctx.quadraticCurveTo(a.cx * TW, a.cy * TH, x, a.ly * TH); ctx.stroke(); ctx.setLineDash([]); }
  else { for (let i = 0; i < 6; i++) { const k = ((now * 0.6 + i / 6) % 1), aa = i * 1.05 + spin * 0.3, rr = (70 - 52 * k) * U, r = (10 + 6 * (1 - k)) * U; ctx.globalAlpha = lead * 0.5 * Math.sin(k * Math.PI); ctx.drawImage(glow('255,255,255', [0.5, 0.5]), x + Math.cos(aa) * rr * 1.3 - r, y + Math.sin(aa) * rr * 0.6 - r, r * 2, r * 2); } }
  // converging portal rings (each second one ring closes in on the badge)
  const R = 21 * U * pop; ctx.lineWidth = 1.8 * U; ctx.strokeStyle = gold ? 'rgba(255,214,120,.95)' : 'rgba(255,255,255,.9)';
  ctx.setLineDash([6 * U, 7 * U]); ctx.lineDashOffset = -spin * 20; ctx.globalAlpha = lead * (0.3 + 0.6 * f); ctx.beginPath(); ctx.arc(x, y, R + (1 - f) * 30 * U + 8 * U, 0, ARR_PI2); ctx.stroke();
  ctx.lineDashOffset = spin * 14; ctx.globalAlpha = lead * 0.35; ctx.beginPath(); ctx.arc(x, y, R + 18 * U + 4 * U * Math.sin(now * 4), 0, ARR_PI2); ctx.stroke(); ctx.setLineDash([]);
  // twinkles orbiting the ring
  ctx.fillStyle = '#fffbe6'; for (let i = 0; i < 4; i++) { const aa = spin * 1.4 + i * Math.PI / 2, rr = R + 14 * U, sx = x + Math.cos(aa) * rr, sy = y + Math.sin(aa) * rr, s = (2 + 1.2 * Math.sin(now * 7 + i)) * U; ctx.globalAlpha = lead * 0.9; ctx.beginPath(); ctx.moveTo(sx, sy - s * 2); ctx.lineTo(sx + s * 0.5, sy); ctx.lineTo(sx, sy + s * 2); ctx.lineTo(sx - s * 0.5, sy); ctx.closePath(); ctx.moveTo(sx - s * 2, sy); ctx.lineTo(sx, sy + s * 0.5); ctx.lineTo(sx + s * 2, sy); ctx.lineTo(sx, sy - s * 0.5); ctx.closePath(); ctx.fill(); }
  // number badge + progress arc
  ctx.globalAlpha = lead; ctx.shadowColor = 'rgba(10,20,60,.35)'; ctx.shadowBlur = 10 * U; ctx.shadowOffsetY = 2 * U;
  const g = ctx.createLinearGradient(x, y - R, x, y + R); if (gold) { g.addColorStop(0, '#ffc15a'); g.addColorStop(1, '#ff7f4f'); } else { g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#e4f1ff'); }
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, R, 0, ARR_PI2); ctx.fill(); ctx.shadowColor = 'transparent';
  ctx.lineWidth = 2.6 * U; ctx.strokeStyle = gold ? '#fff3d6' : '#5aa8f0'; ctx.stroke();
  ctx.lineWidth = 3 * U; ctx.lineCap = 'round'; ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.beginPath(); ctx.arc(x, y, R + 5 * U, -Math.PI / 2, -Math.PI / 2 + ARR_PI2 * (1 - f)); ctx.stroke();
  ctx.fillStyle = gold ? '#fff' : '#2f78d0'; ctx.font = '800 ' + Math.round(23 * U * pop) + 'px system-ui,-apple-system,"Segoe UI",Roboto,sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(String(n), x, y + 1);
  ctx.restore();
  // headline above (below the name when the spot is high, so it never sits under the top pills); labels stay inside the visible window
  const c = m.cr || {}, nm = c.nm || '', who = c.bn && !nm.includes(c.bn) ? ' · ' + c.bn : '', dk = { bg: 'rgba(14,22,58,.86)', fg: '#fff6dc' };
  const pan = PERF.cull, vw = pan ? (PERF.vx1 - PERF.vx0) / 1.8 : TW, vl = pan ? PERF.vx0 + vw * 0.4 : 0, vr = vl + vw, lxC = clamp(x, vl + 100 * U, Math.max(vl + 100 * U, vr - 100 * U)), hiY = y - R - 30 * U < 58 * U;
  label(ctx, '✨ ' + T('incoming'), lxC, hiY ? y + R + 58 * U : y - R - 30 * U, Object.assign({ size: Math.round(12 * U), free: true, alpha: lead }, dk));
  label(ctx, (EMO[m.k] || '') + ' ' + nm + who, lxC, y + R + 30 * U, { size: Math.round(11 * U), free: true, alpha: lead, bg: 'rgba(255,255,255,.92)' });
  // phone sky pans (3x wide): when the spot is outside the visible window, a chip on that edge points to it
  if (pan) {
    if (x < vl + 10 || x > vr - 10) { const left = x < vl, ex = left ? vl + 42 * U : vr - 42 * U; label(ctx, (left ? '← ' : '') + (EMO[m.k] || '') + ' ' + n + (left ? '' : ' →'), ex, y, { size: Math.round(14 * U), free: true, alpha: lead, bg: gold ? 'rgba(255,140,70,.92)' : 'rgba(14,22,58,.8)', fg: '#fff' }); } }
}
root.DQArr = { ARR, arrFx, planned: 0, landed: 0, cues: () => arrCues.length, plan: id => { const m = sim.get(id); return m && m.arr ? Object.assign({}, m.arr, { el: (performance.now() - m.arr.t0) / 1000 }) : null; } };
/* event caption: a soft badge at the top of the sky for ~9 s when a celestial event begins (works in ?wallpaper too) */
function drawEvCap(ctx, dt) {
  const c = SKYC; if (c.id && c.id !== evCap.id) { evCap = { id: c.id, t: 9, txt: EV_E[c.ev] + ' ' + T('ev_' + c.ev) }; }
  if (evCap.t <= 0) return; evCap.t -= dt; const a = clamp(Math.min(9 - evCap.t, evCap.t) / 0.8, 0, 1); if (a <= 0.01) return;
  const fs = TW < 560 ? 14 : 16; ctx.save(); ctx.font = '700 ' + fs + 'px system-ui,-apple-system,"Segoe UI",Roboto,sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; const w = ctx.measureText(evCap.txt).width + 28, hh = fs + 16, x = TW / 2, y = 22 + hh / 2 - (1 - a) * 8;
  ctx.globalAlpha = a; ctx.fillStyle = 'rgba(14,22,58,.72)'; ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(x - w / 2, y - hh / 2, w, hh, hh / 2); else ctx.rect(x - w / 2, y - hh / 2, w, hh); ctx.fill(); ctx.strokeStyle = 'rgba(255,226,160,.55)'; ctx.lineWidth = 1; ctx.stroke(); ctx.fillStyle = '#fff6dc'; ctx.fillText(evCap.txt, x, y + 0.5); ctx.restore();
}
const EV_E = { total: '🌑', cincin: '💍', merah: '🔴', super: '🌕', meteor: '☄️', kejora: '✨', pelangi: '🌈', gerimis: '🌦️', hujan: '🌧️' }, PH_E = { night: '🌙', fajar: '🌄', terbit: '🌅', pagi: '🌤️', siang: '☀️', sore: '🌇', terbenam: '🌅', senja: '🌆' };
const skyPhase = h => h < 4.6 ? 'night' : h < 5.8 ? 'fajar' : h < 7 ? 'terbit' : h < 10.5 ? 'pagi' : h < 15 ? 'siang' : h < 17.2 ? 'sore' : h < 18.6 ? 'terbenam' : h < 19.7 ? 'senja' : 'night';
function paintSky() { const el = $('skyPill'); if (!el) return; const c = SKYC, h = c.h, ph = skyPhase(h), hh = Math.floor(h), mm = Math.floor((h - hh) * 60), clock = String(hh).padStart(2, '0') + ':' + String(mm - mm % 5).padStart(2, '0');
  let e, name; if (c.ev && c.ev !== 'kejora') { e = EV_E[c.ev]; name = T('ev_' + c.ev); } else if (ph === 'night') { e = MOON_E[c.j]; name = T(MOON_N[c.j]); } else { e = PH_E[ph]; name = T('ph_' + ph); }
  const txt = e + ' ' + name + ' · ' + clock; if (el.textContent !== txt) el.textContent = txt; const tone = c.ev === 'total' || c.ev === 'merah' ? 'ecl' : ph; if (el.dataset.ph !== tone) el.dataset.ph = tone; const tip = T('skyTip'); if (el.title !== tip) el.title = tip; }
/* t309u: rain — grey-blue veil + slanted streaks, all drops in ONE path/stroke (cheap); count follows intensity x quality level (PQ),
   only the visible window on the pannable phone sky gets drops, nothing is drawn when the sky is offscreen (stepOnly) */
const RAIN = { k: 0, drops: [], max: 170 };
function drawRain(ctx, dt, cx0, cx1, PQk) {
  const want = rbForceRain != null ? rbForceRain : (SKYC.rain || 0); RAIN.k += (want - RAIN.k) * Math.min(1, dt * 0.6); const k = RAIN.k; if (k < 0.01) { if (RAIN.drops.length && k < 0.002) RAIN.drops.length = 0; return; }
  const x0 = Math.max(-30, cx0 - 30), x1 = Math.min(TW + 30, cx1 + 30), U = clamp(TH / 450, 0.7, 1.5), N = TOD.night;
  ctx.fillStyle = 'rgba(' + (N > 0.5 ? '30,36,70' : '78,92,118') + ',' + (0.24 * k * (1 - N * 0.4)).toFixed(3) + ')'; ctx.fillRect(Math.max(0, x0), 0, Math.min(TW, x1) - Math.max(0, x0), TH);
  const n = Math.round(RAIN.max * k * PQk * (REDUCED ? 0.4 : 1)), D = RAIN.drops, vx = (WIND * 0.28 + 0.06);
  while (D.length < n) D.push({ x: rand(x0, x1), y: rand(-TH * 0.1, TH * 0.9), sp: rand(480, 720) * U, l: rand(9, 17) * U, a: rand(0.5, 1) });
  if (D.length > n) D.length = n;
  ctx.save(); ctx.lineCap = 'round'; ctx.lineWidth = Math.max(0.8, 1.05 * U); ctx.strokeStyle = N > 0.5 ? 'rgba(170,185,230,' + (0.42 * Math.min(1, k * 1.6)).toFixed(3) + ')' : 'rgba(225,235,250,' + (0.5 * Math.min(1, k * 1.6)).toFixed(3) + ')'; ctx.beginPath();
  const sp0 = REDUCED ? 0.45 : 1, gy = TH * 0.9;
  for (const d of D) { d.y += d.sp * dt * sp0; d.x += d.sp * vx * dt * sp0; if (d.y > gy + rand(-TH * 0.2, 0) || d.x > x1 + 20 || d.x < x0 - 20) { d.y = rand(-30, -4); d.x = rand(x0 - TH * vx * 0.6, x1); }
    ctx.moveTo(d.x, d.y); ctx.lineTo(d.x - vx * d.l, d.y - d.l); }
  ctx.stroke(); ctx.restore(); }
let rbForceRain = null;
const streaks = Array.from({ length: 14 }, () => ({ x: Math.random(), y: rand(0.05, 0.8), l: rand(0.05, 0.12), ph: rand(0, 6) }));
function drawTank(dt, now, stepOnly) {
  const ctx = tctx; ctx.setTransform(DPR, 0, 0, DPR, 0, 0); const PQk = PQ();
  const t = now / 1000; { const wt = windAt(nowMs()); WIND = windT === 0 && !WIND ? wt : WIND + (wt - WIND) * Math.min(1, dt * 2); } // t288u: smooth per-frame wind (was stepped once a second -> kites/strings snapped)
  windT -= dt; if (windT <= 0) { windT = 1; ambWind(WIND); paintWind(); paintSky(); if (todUpdate()) bgDirty = true; if (bgDirty && !bgJob && !bgPrev && !kfMode() && performance.now() - bgAt > bgIv()) { bgDirty = false; bgRequest(false); } } // t307u: sliced + pooled (was a synchronous full rebuild)
  if (stepOnly) { const t2 = now / 1000; for (const c of creatures()) { let m = sim.get(c.id); if (!m) { sprite(c); m = spawn(c, false); } if (stepArrive(m, dt)) continue; if (c.k === 'bird') stepBird(m, dt); else if (c.k === 'kite') stepKite(m, dt, t2); else if (c.k === 'balloon') stepBalloon(m, dt, t2); else if (c.k === 'plane') stepPlane(m, dt, t2); else stepCloud(m, dt, t2); } return; }
  // t307u: on the pannable phone sky only the visible window (+ margin) is repainted; full repaint while panning
  const cull = PERF.cull && performance.now() - PERF.scrollAt > 450, cx0 = cull ? Math.max(0, PERF.vx0) : -1e9, cx1 = cull ? Math.min(TW, PERF.vx1) : 1e9;
  ctx.save(); if (cull) { ctx.beginPath(); ctx.rect(cx0, 0, cx1 - cx0, TH); ctx.clip(); }
  if (bgWarmQ.length && bgCanvas) bgWarm(ctx, cull ? cx0 + 1 : 0); // t333u: hidden under the backdrop drawn next
  // t289u: colour drift of the time-of-day sky now cross-fades (was a hard swap that also re-seeded clouds/fireflies)
  if (KF.on) kfDraw(ctx, dt); else if (bgPrev && bgFade > 0) { ctx.drawImage(bgPrev, 0, 0, TW, TH); ctx.globalAlpha = 1 - bgFade; ctx.drawImage(bgCanvas, 0, 0, TW, TH); ctx.globalAlpha = 1; bgFade -= dt / bgFadeS(); if (bgFade <= 0) { poolBg(bgPrev); bgPrev = null; mistPv = null; for (const cl of skyClouds) cl.pv = null; } } else if (bgCanvas) ctx.drawImage(bgCanvas, 0, 0, TW, TH);
  drawOrbs(ctx, t);
  if (lightX == null) lightX = sunAt.x; lightX += (sunAt.x - lightX) * Math.min(1, dt * 0.25);
  const stK = clamp((TOD.night - 0.2) / 0.35, 0, 1); if (stK > 0 && !REDUCED) { ctx.save(); for (const s of stars) { if (s.x < cx0 - 8 || s.x > cx1 + 8) continue; const tw = Math.abs(Math.sin(t * 1.3 + s.ph)); ctx.globalAlpha = stK * TOD.night * (0.35 + 0.65 * tw); ctx.fillStyle = s.col || '#fff'; ctx.beginPath(); ctx.arc(s.x, s.y, s.r * 1.2, 0, Math.PI * 2); ctx.fill(); if (s.r > 1.4 && tw > 0.7) { ctx.strokeStyle = s.col || '#fff'; ctx.lineWidth = 0.8; ctx.globalAlpha = stK * TOD.night * (tw - 0.7) * 2.4; const L = s.r * 4.5; ctx.beginPath(); ctx.moveTo(s.x - L, s.y); ctx.lineTo(s.x + L, s.y); ctx.moveTo(s.x, s.y - L); ctx.lineTo(s.x, s.y + L); ctx.stroke(); } } ctx.restore(); }
  if (sunAt.up && TOD.night < 0.4 && !REDUCED) { ctx.save(); const x = sunAt.x * TW, y = sunAt.y * TH; const L = Math.min(TH * 0.85, 480), rc = TOD.warm > 0.4 ? '255,200,140' : '255,248,215', ra = clamp((1 - TOD.night * 2) * (1 - ORB.cov) * (1 - RAIN.k * 0.9), 0, 1);
    if (ra > 0.01 && x + L > cx0 && x - L < cx1) { const rs = raySprites(rc, L), mix = 0.5 + 0.5 * Math.cos(t * 0.4); ctx.translate(x, y); ctx.rotate(t * 0.02); if (mix > 0.01) { ctx.globalAlpha = ra * mix; ctx.drawImage(rs[0], -L, -L, L * 2, L * 2); } if (mix < 0.99) { ctx.globalAlpha = ra * (1 - mix); ctx.drawImage(rs[1], -L, -L, L * 2, L * 2); } } ctx.restore(); }
  // volcano smoke: slow wisps rising from the crater, leaning with the shared wind
  if (smokeAt) { ctx.save(); const sx0 = smokeAt.x * TW, sy0 = smokeAt.y * TH, sc0 = clamp(TH / 450, 0.7, 1.5), col = TOD.night > 0.5 ? '150,155,200' : TOD.warm > 0.4 ? '255,215,200' : '240,244,250';
    for (let i = 0; i < 7; i++) { const k = ((t * 0.035 + i / 7) % 1), x = sx0 + (WIND * 60 + 20) * k * sc0 + Math.sin(t * 0.5 + i) * 4, y = sy0 - k * TH * 0.16, r = (5 + k * 22) * sc0; const al = 0.3 * (1 - k) * Math.min(1, k * 6); if (al < 0.005) continue; ctx.globalAlpha = al; ctx.drawImage(glow(col, [0.6, 0.6], 96), x - r, y - r, r * 2, r * 2); }
    ctx.restore(); }
  // pelangi: fades in for ~8 of every 40 minutes by day (server clock → everyone sees it together)
  { const want = sunAt.up && TOD.night < 0.15 && TOD.warm < 0.75 && (rbForce || SKYC.ev === 'pelangi') ? 1 : 0; rbK += (want - rbK) * Math.min(1, dt * 0.12);
    if (rbCv && rbK > 0.01) { const cx = clamp(1 - lightX, 0.25, 0.75) * TW; ctx.globalAlpha = rbK * 0.6; ctx.drawImage(rbCv, cx - rbCv.width / 2, TH * 0.8 - rbR - 10); ctx.globalAlpha = 1; } }
  // far valley mist drifting behind the clouds
  mistX = (((mistX + (0.004 + WIND * 0.01) * dt * (REDUCED ? 0.3 : 1)) % 1) + 1) % 1;
  // t308u: live layers baked at rebuild time (cloud sprites, mist) now fade old->new together with the backdrop: old on top at a*f, new under at
  // (a-a*f)/(1-a*f) so the combined opacity stays a (no dip / no tint pop when a rebuild commits)
  const xf = KF.on ? KF.xf : bgPrev && bgFade > 0 ? bgFade : 0, xd = (img, old, a, x, y, w, h) => { if (xf > 0 && old) { const a2 = a * xf, a1 = (a - a2) / (1 - a2 || 1); ctx.globalAlpha = a1; ctx.drawImage(img, x, y, w, h); ctx.globalAlpha = a2; ctx.drawImage(old, x, y, w, h); } else { ctx.globalAlpha = a; ctx.drawImage(img, x, y, w, h); } };
  const mistBand = (off, y, hk, al) => { if (!mistCv || al <= 0.01) return; const x = -(((off % 1) + 1) % 1) * TW, h = TH * 0.16 * hk, pv = mistPv && mistPv.width === mistCv.width ? mistPv : null; xd(mistCv, pv, al, x, y, TW + 1, h); xd(mistCv, pv, al, x + TW, y, TW + 1, h); ctx.globalAlpha = 1; };
  mistBand(mistX * 0.6, TH * 0.56, 1, 0.5 * (1 - TOD.night * 0.35));
  // decor clouds drift with the wind (parallax: near = faster/bigger), far ones first; wrap only once fully off-screen
  for (const cl of skyClouds) { cl.x += (0.003 + WIND * 0.012) * cl.sp * dt * (REDUCED ? 0.4 : 1); const L = cl.x * TW + cl.ox; if (L > TW + 4) cl.x = (-cl.ox - cl.w - 4) / TW; else if (L + cl.w < -4) cl.x = (TW + 4 - cl.ox) / TW; }
  for (let d = 3; d >= 0; d--) for (const cl of skyClouds) { if (cl.d !== d || !cl.cv) continue; const a = (0.97 - d * 0.15) * (1 - TOD.night * 0.3), br = REDUCED ? 1 : 1 + Math.sin(t * 0.12 + cl.ph) * 0.012, x = cl.x * TW, y = cl.y * TH + (REDUCED ? 0 : Math.sin(t * 0.07 + cl.ph) * 2 * (1 - d * 0.2)), L = x + cl.ox * br, T = y + cl.oy * br, w = cl.w * br, h = cl.h * br;
    const wr = clamp((lightX - cl.x) / 0.5 + 0.5, 0, 1), sr = wr * wr * (3 - 2 * wr), rk = 0.55 + 0.4 * (1 - TOD.night) + TOD.warm * 0.15;
    const pv = cl.pv; xd(cl.cv, pv && pv.cv, a, L, T, w, h); if (sr > 0.01) xd(cl.rr, pv && pv.rr, a * rk * sr, L, T, w, h); if (sr < 0.99) xd(cl.rl, pv && pv.rl, a * rk * (1 - sr), L, T, w, h); ctx.globalAlpha = 1; }
  mistBand(mistX + 0.37, TH * 0.68, 0.8, 0.32 + clamp(1 - Math.abs(TOD.h - 6.6) / 1.8, 0, 1) * 0.35);
  drawRain(ctx, dt, cx0, cx1, PQk);
  // sunlit motes / pollen drifting by day
  { const dk = (1 - TOD.night) * (0.55 + TOD.warm * 0.6) * (1 - RAIN.k); if (dk > 0.05 && !REDUCED) { ctx.save(); const nM = Math.round(motes.length * PQk), mg = glow('255,246,214'); for (let mi = 0; mi < nM; mi++) { const m = motes[mi]; m.x += (WIND * 0.02 + Math.sin(t * m.sp + m.ph) * 0.003) * dt; m.y += (Math.cos(t * m.sp * 0.7 + m.ph) * 0.002 - 0.0012) * dt; if (m.x > 1.03) m.x = -0.03; if (m.x < -0.03) m.x = 1.03; if (m.y < 0.08) m.y = 0.85;
      const x = m.x * TW, y = m.y * TH, r = m.r * 4; if (x < cx0 - r || x > cx1 + r) continue; ctx.globalAlpha = dk * 0.45 * (0.4 + 0.6 * Math.abs(Math.sin(t * m.sp * 2.4 + m.ph))); ctx.drawImage(mg, x - r, y - r, r * 2, r * 2); } ctx.restore(); } }
  // fireflies over the hills at night (fade in with dusk instead of popping on), coloured glow + bright core
  { const ffK = clamp((TOD.night - 0.3) / 0.35, 0, 1); if (fireflies.length && ffK > 0) { ctx.save(); const nF = Math.round(fireflies.length * PQk); for (let fi = 0; fi < nF; fi++) { const f = fireflies[fi]; f.x += Math.sin(t * f.sp + f.ph) * 0.004 * dt + WIND * 0.002 * dt; if (f.x > 1.02) f.x = -0.02; if (f.x < -0.02) f.x = 1.02; const x = f.x * TW, y = f.y * TH + Math.sin(t * f.sp * 1.7 + f.ph) * 6, a = ffK * TOD.night * Math.max(0, Math.sin(t * f.sp * 2 + f.ph)); if (a < 0.03 || x < cx0 - 20 || x > cx1 + 20) continue; ctx.globalAlpha = a * 0.9; ctx.drawImage(glow(f.c || '230,255,140', [0.35, 0.3333]), x - f.r * 7, y - f.r * 7, f.r * 14, f.r * 14); ctx.globalAlpha = a; ctx.fillStyle = '#fffbe0'; ctx.beginPath(); ctx.arc(x, y, f.r * 0.55, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1; } ctx.restore(); } }
  // wind streaks (more + longer when windy)
  if (!REDUCED) { const k = Math.abs(WIND), n = Math.round((2 + k * 12) * PQk); ctx.save(); ctx.strokeStyle = TOD.night > 0.5 ? 'rgba(220,230,255,.18)' : 'rgba(255,255,255,.4)'; ctx.lineWidth = 1.4; ctx.lineCap = 'round';
    for (let i = 0; i < n; i++) { const s = streaks[i]; s.x += WIND * (0.18 + 0.1 * (i % 3)) * dt; if (s.x > 1.15) { s.x = -0.15; s.y = rand(0.05, 0.8); } if (s.x < -0.15) { s.x = 1.15; s.y = rand(0.05, 0.8); }
      const x = s.x * TW, y = s.y * TH + Math.sin(t * 1.5 + s.ph) * 6, L = s.l * TW * (0.4 + k) * Math.sign(WIND || 1); ctx.globalAlpha = 0.25 + 0.5 * k; ctx.beginPath(); ctx.moveTo(x, y); ctx.bezierCurveTo(x - L * 0.3, y - 6, x - L * 0.6, y + 6, x - L, y); ctx.stroke(); }
    ctx.restore(); }
  hits = []; arrCues.length = 0;
  const list = creatures(), order = { cloud: 0, kite: 1, balloon: 2, plane: 3, bird: 4 };
  for (const c of list) {
    const s = sprite(c); let m = sim.get(c.id); if (!m) m = spawn(c, false);
    m.cr = c; if (stepArrive(m, dt)) { if (m.arr.ph === 0) { arrCues.push(m); continue; } } // t346u: hidden during the countdown, scripted while entering
    else if (c.k === 'bird') stepBird(m, dt); else if (c.k === 'kite') stepKite(m, dt, t); else if (c.k === 'balloon') stepBalloon(m, dt, t); else if (c.k === 'plane') stepPlane(m, dt, t); else stepCloud(m, dt, t);
    const sc = scaleFor(c, s) * (m.es || 1), [x0, y0, x1, y1] = s.box, hw = (x1 - x0) * sc / 2, hh = (y1 - y0) * sc / 2, px = m.x * TW, py = m.y * TH;
    hits.push({ id: c.id, x0: px - hw, x1: px + hw, y0: py - hh, y1: py + hh + 18, c, m, s, sc, o: order[c.k] || 0 });
  }
  hits.sort((a, b) => a.o - b.o);
  drawLife(ctx, dt, t);
  for (const h of hits) h.fa = h.m.fa = Math.min(1, (h.m.fa == null ? (revealAt && performance.now() - revealAt > 1500 ? 1 : -Math.random() * 0.5) : h.m.fa) + dt * 2.2); // t313u: soft staggered fade-in on first load
  for (const h of hits) if (h.m.ea != null) h.fa *= h.m.ea; // t346u: entrance fade (side entries materialise on the dotted trail)
  for (const h of hits) { if (h.fa <= 0) continue; ctx.save(); ctx.globalAlpha = Math.max(0, h.fa); if (h.c.k === 'kite') kiteTail(ctx, h.c, h.m, h.s, h.sc, t); else if (h.c.k === 'balloon') balloonString(ctx, h.c, h.m, h.s, h.sc, t); ctx.restore(); }
  // names are painted first so every creature sprite sits ON TOP of the text
  for (const h of hits) h.off = h.x1 < cx0 - 40 || h.x0 > cx1 + 40;
  for (const h of hits) if (!h.off) label(ctx, h.c.nm, (h.x0 + h.x1) / 2, h.y1 - 2, { size: 11, free: true, alpha: (h.m.alpha == null ? 1 : h.m.alpha) * Math.max(0, h.fa) });
  for (const h of hits) { const k = h.c.k, m = h.m; if (h.off && k !== 'plane') continue; if (h.fa <= 0) continue; ctx.save(); ctx.globalAlpha = h.fa;
    if (k === 'bird') drawBird(ctx, h.c, m, h.s, h.sc);
    else if (k === 'plane') { if (!(m.loop > 0)) m.fl = Math.cos(m.a) < 0; const fl = !!m.fl; /* keep the facing for the whole loop (no mid-loop mirror pop) */ drawPlain(ctx, m, h.s, h.sc, fl ? m.a - Math.PI : m.a, fl ? -1 : 1); }
    else if (k === 'cloud') { ctx.save(); ctx.globalAlpha = 0.95 * m.alpha * h.fa; const b = 1 + Math.sin(t * 0.6 + m.seed) * 0.02; drawPlain(ctx, m, h.s, h.sc * b, 0, 1); ctx.restore(); }
    else drawPlain(ctx, m, h.s, h.sc, m.ang || 0, 1); ctx.restore(); }
  drawArrFx(ctx, dt); for (const h of hits) if (h.m.arr && h.m.arr.ph === 1) drawArrTrail(ctx, h.m); for (const m of arrCues) drawArrCue(ctx, m); // t346u
  drawEvCap(ctx, dt);
  if (TOD.night > 0.05) { ctx.fillStyle = 'rgba(15,20,60,' + (TOD.night * 0.12).toFixed(3) + ')'; ctx.fillRect(0, 0, TW, TH); }
  ctx.restore();
  firstPaintFx(ctx, dt);
}
/* t313u: the first painted frames cross-fade from the CSS placeholder gradient (same stops as #tank's background) to the real scene */
let paintFade = 0;
function firstPaintFx(ctx, dt) { if (paintFade >= 1) return; paintFade = Math.min(1, paintFade + (REDUCED ? 1 : Math.min(dt, 0.05) * 1.8)); if (paintFade >= 1) return;
  const g = ctx.createLinearGradient(0, 0, 0, TH); g.addColorStop(0, '#6f8fc4'); g.addColorStop(0.5, '#a9bfdc'); g.addColorStop(0.64, '#c9b9a6'); g.addColorStop(0.76, '#7d9a72'); g.addColorStop(1, '#5f8458'); ctx.save(); ctx.setTransform(DPR, 0, 0, DPR, 0, 0); ctx.globalAlpha = 1 - paintFade * paintFade * (3 - 2 * paintFade); ctx.fillStyle = g; ctx.fillRect(0, 0, TW, TH); ctx.restore(); }
let hits = [];
function paintWind() { const el = $('windPill'); if (!el) return; const k = windKmh(WIND), arr = WIND >= 0.05 ? '→' : WIND <= -0.05 ? '←' : '·'; const txt = T('wind', { arr, n: k }); if (el.textContent !== txt) { el.textContent = txt; el.classList.toggle('gusty', Math.abs(WIND) > 0.6); el.title = T('windTip'); } }

/* ---------- walkway: ~10 NPC strollers + one character per present visitor ---------- */
const walkers = [];
function makeWalker(o) { return Object.assign({ x: rand(0.03, 0.97), dir: Math.random() < 0.5 ? -1 : 1, sp: rand(18, 38), pause: 0, lane: Math.random() < 0.5 ? 0 : 1, emote: '', emoteT: 0, ph: rand(0, 6), alpha: 0, leaving: false }, o); }
/* t314u: no bot/NPC strollers any more — the walkway shows only real visitors (CFG.npcs kept unused) */
function syncVisitors(list) {
  if (WP) { list = list.filter(v => !v.me); doc.documentElement.classList.toggle('wp-walk', list.length > 0); } // t314u: wallpaper shows real spectators, not itself
  const want = new Map(list.map(v => ['v' + v.id, v]));
  for (const w of walkers) if (!w.npc) { const v = want.get(w.key); if (!v) w.leaving = true; else { w.leaving = false; w.name = v.name; w.em = v.em; w.me = v.me; w.gm = v.gm; } }
  for (const [key, v] of want) if (!walkers.some(w => w.key === key)) walkers.push(makeWalker({ key, em: v.em, name: v.name, me: v.me, gm: v.gm, lane: 1, x: Math.random() < 0.5 ? 0.02 : 0.98, alpha: 0 }));
}
const BALLOON_MS = 6000;
/** latest real chat line per present visitor (from shared cm) within the last few seconds → walker key 'v'+id */
function chatBalloons() {
  const out = new Map(); if (!room) return out; const now = nowMs();
  for (const m of room.s.cm) if (!m.k && m.by && now - m.at < BALLOON_MS && now - m.at > -5000) out.set('v' + m.by, m.t);
  return out;
}
/* t238u: bigger, high-contrast balloons (14-15px, opaque white, dark border + shadow, up to 2 lines) on #balloonFx, lifted BLIFT px above the walk so they overlap the tank */
const bfx = $('balloonFx'), balCtx = bfx && bfx.getContext('2d'), BLIFT = 64; let bfxKey = '';
function placeBfx() {
  if (!bfx || !PERF.bfxDirty) return; PERF.bfxDirty = false; const k = [walk.offsetLeft + walk.clientLeft, walk.offsetTop + walk.clientTop, WW, WH, WDPR].join(',');
  if (k === bfxKey) return; bfxKey = k; const [l, tp] = k.split(',').map(Number);
  bfx.style.left = l + 'px'; bfx.style.top = (tp - BLIFT) + 'px'; bfx.style.width = WW + 'px'; bfx.style.height = (WH + BLIFT) + 'px'; bfx.width = Math.round(WW * WDPR); bfx.height = Math.round((WH + BLIFT) * WDPR); PERF.balDirty = true;
}
function balloon(ctx, text, x, yb, alpha) {
  const fs = WW > 600 ? 15 : 14, lh = fs + 4, padX = 12, padY = 7, maxW = Math.min(250, WW * 0.62), cw = ctx.canvas.width / WDPR;
  ctx.save(); ctx.globalAlpha = alpha; ctx.font = '600 ' + fs + 'px system-ui,-apple-system,"Segoe UI",Roboto,sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const fit = s => { while (s.length > 1 && ctx.measureText(s).width > maxW) s = s.slice(0, -2) + '…'; return s; };
  let lines = [String(text)];
  if (ctx.measureText(text).width > maxW) { const words = String(text).split(/\s+/); let a = ''; let i = 0; for (; i < words.length; i++) { const n = a ? a + ' ' + words[i] : words[i]; if (ctx.measureText(n).width > maxW && a) break; a = n; } lines = i < words.length ? [fit(a), fit(words.slice(i).join(' '))] : [fit(a)]; }
  const w = Math.max(...lines.map(l => ctx.measureText(l).width)) + padX * 2, h = lines.length * lh + padY * 2 - 4, bx = clamp(x - w / 2, 4, Math.max(4, cw - w - 4)), by = Math.max(2, yb - 8 - h), tx = clamp(x, bx + 12, bx + w - 12);
  ctx.shadowColor = 'rgba(0,40,60,.35)'; ctx.shadowBlur = 8; ctx.shadowOffsetY = 2; ctx.fillStyle = '#fff'; ctx.strokeStyle = 'rgba(12,64,88,.7)'; ctx.lineWidth = 1.6;
  ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(bx, by, w, h, 12); else ctx.rect(bx, by, w, h); ctx.moveTo(tx - 7, by + h); ctx.lineTo(tx, by + h + 8); ctx.lineTo(tx + 7, by + h); ctx.fill(); ctx.shadowColor = 'transparent'; ctx.stroke();
  ctx.fillStyle = '#fff'; ctx.fillRect(tx - 6, by + h - 2, 12, 2.5);
  ctx.fillStyle = '#0b2a38'; lines.forEach((l, i) => ctx.fillText(l, bx + w / 2, by + padY + lh * i + lh / 2 - 2 + 0.5)); ctx.restore();
}
function drawWalk(dt, now) {
  const ctx = wctx; ctx.setTransform(WDPR, 0, 0, WDPR, 0, 0);
  placeBfx(); if (balCtx && PERF.balDirty) { balCtx.setTransform(WDPR, 0, 0, WDPR, 0, 0); balCtx.clearRect(0, 0, WW, WH + BLIFT); PERF.balDirty = false; } const bq = []; // t307u: balloon overlay cleared only after it had balloons
  if (WP) { ctx.clearRect(0, 0, WW, WH); const g = ctx.createLinearGradient(0, 0, 0, WH); g.addColorStop(0, 'rgba(10,24,16,0)'); g.addColorStop(0.45, 'rgba(10,24,16,.26)'); g.addColorStop(1, 'rgba(10,24,16,.5)'); ctx.fillStyle = g; ctx.fillRect(0, 0, WW, WH); } else { // t314u: wallpaper = spectators silhouetted at the bottom of the sky
  const N = TOD.night, gk = WH + '|' + TOD.key + '|' + N.toFixed(2); if (drawWalk.gk !== gk) { const g = ctx.createLinearGradient(0, 0, 0, WH); g.addColorStop(0, shade('#6fba58', N, TOD.warm)); g.addColorStop(0.42, shade('#82c862', N, TOD.warm)); g.addColorStop(0.43, shade('#e9d4a2', N, TOD.warm)); g.addColorStop(1, shade('#dcc18a', N, TOD.warm)); drawWalk.gk = gk; drawWalk.g = g; } ctx.fillStyle = drawWalk.g; ctx.fillRect(0, 0, WW, WH);
  if (!walk.__grass || walk.__grass.w !== WW || walk.__grass.n !== N) { const Rg = bgRng('lb-walk'), gl = []; for (let x = 0; x < WW; x += 5) gl.push([x + Rg() * 4, Rg()]); walk.__grass = { w: WW, n: N, gl }; }
  ctx.strokeStyle = shade('#4f9a40', N, 0); ctx.lineWidth = 1.2; ctx.beginPath(); for (const [x, r] of walk.__grass.gl) { const sw = Math.sin(now / 900 + x * 0.05) * 2 * Math.abs(WIND) + WIND * 2; ctx.moveTo(x, WH * 0.43); ctx.lineTo(x + sw, WH * (0.3 - r * 0.25)); } ctx.stroke();
  ctx.fillStyle = 'rgba(150,110,60,.18)'; for (const [x, r] of walk.__grass.gl) if (r > 0.86) { ctx.beginPath(); ctx.ellipse(x, WH * (0.55 + (r - 0.86) * 3), 2.5, 1.2, 0, 0, Math.PI * 2); ctx.fill(); }
  ctx.fillStyle = shade('#ffffff', N, 0); for (const [x, r] of walk.__grass.gl) if (r < 0.04) { ctx.beginPath(); ctx.arc(x, WH * 0.36, 2.2, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#ffd23f'; ctx.beginPath(); ctx.arc(x, WH * 0.36, 0.9, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = shade('#ffffff', N, 0); }
  }
  const t = now / 1000, lanes = [WH * 0.62, WH * 0.92];
  for (let i = walkers.length - 1; i >= 0; i--) { const w = walkers[i]; w.alpha = clamp(w.alpha + (w.leaving ? -dt * 1.5 : dt * 1.5), 0, 1); if (w.leaving && w.alpha <= 0) walkers.splice(i, 1); }
  const said = chatBalloons();
  const order = walkers.slice().sort((a, b) => a.lane - b.lane || (a.me ? 1 : 0) - (b.me ? 1 : 0));
  for (const w of order) {
    if (w.pause > 0) { w.pause -= dt; if (w.emoteT > 0) w.emoteT -= dt; }
    else { w.x += w.dir * w.sp * dt / WW; if (w.x < 0.03) { w.x = 0.03; w.dir = 1; } if (w.x > 0.97) { w.x = 0.97; w.dir = -1; } if (Math.random() < dt * 0.12) { w.pause = rand(1.5, 4); if (Math.random() < 0.6) { w.emote = CFG.emotes[Math.floor(Math.random() * CFG.emotes.length)]; w.emoteT = w.pause; } } }
    const size = w.lane ? clamp(WH * 0.36, 28, 42) : clamp(WH * 0.28, 22, 34), x = w.x * WW, y = lanes[w.lane], bob = w.pause > 0 ? 0 : Math.abs(Math.sin(t * 7 + w.ph)) * 4;
    ctx.save(); ctx.globalAlpha = w.alpha * (w.lane ? 1 : 0.92);
    ctx.fillStyle = 'rgba(60,50,20,.2)'; ctx.beginPath(); ctx.ellipse(x, y - 2, size * 0.38, size * 0.1, 0, 0, Math.PI * 2); ctx.fill();
    ctx.translate(x, y - bob); if (w.dir > 0 && w.pause <= 0) ctx.scale(-1, 1);
    ctx.font = size + 'px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom'; if (WP) { ctx.globalAlpha = w.alpha; ctx.shadowColor = 'rgba(255,255,255,.55)'; ctx.shadowBlur = 8; } ctx.fillText(w.em, 0, 0); ctx.restore(); /* t314u: wallpaper spectators get a soft glow so they read on the dark glass */
    if (w.emoteT > 0 && w.emote) { ctx.save(); ctx.globalAlpha = w.alpha; ctx.font = '16px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif'; ctx.textAlign = 'center'; ctx.fillText(w.emote, x + size * 0.45, y - size - bob - 2); ctx.restore(); }
    if (!w.npc && said.has(w.key)) { if (balCtx) bq.push([said.get(w.key), x, y - size - bob - 20 + BLIFT, w.alpha, w.me]); else balloon(ctx, said.get(w.key), x, y - size - bob - 30, w.alpha); }
    if (!w.npc) label(ctx, w.name + (w.gm ? ' (GM)' : '') + (w.me ? ' · ' + T('you') : ''), x, y - size - bob - 10, { size: 11, alpha: w.alpha, bg: w.me ? '#ff7a6b' : 'rgba(255,255,255,.92)', fg: w.me ? '#fff' : (w.gm ? '#a3271e' : '#1d4f86') });
  }
  bq.sort((p, q) => (p[4] ? 1 : 0) - (q[4] ? 1 : 0)); for (const b of bq) balloon(balCtx, b[0], b[1], b[2], b[3]); if (bq.length) PERF.balDirty = true;
}
/* t307u: the tank's backing store follows a pixel budget (phones: the pannable sky is ~3x the screen wide → was 2168x1165 px at DPR 2);
   resize is a no-op when nothing changed (ResizeObserver + window resize both fired → two full rebuilds), and a real change re-allocates,
   paints immediately (no blank frame) and rebuilds the backdrop in slices while the old one is shown stretched */
let rsKey = '';
function tankDpr() { const d = Math.min(2, root.devicePixelRatio || 1); return Math.round(Math.max(1, Math.min(d, Math.sqrt(PX_BUDGET[PERF.lvl] / Math.max(1, TW * TH)))) * 100) / 100; }
function measureView() { const sc = $('tankScroll'); if (!sc) return; const pan = sc.scrollWidth > sc.clientWidth + 4 && !doc.documentElement.classList.contains('wp') && !doc.body.classList.contains('wp');
  if (!pan) { PERF.cull = false; return; } const r = tank.getBoundingClientRect(), rs = sc.getBoundingClientRect(), vw = rs.width, m = vw * 0.4; PERF.vx0 = rs.left - r.left - m; PERF.vx1 = rs.left - r.left + vw + m; PERF.cull = PERF.vx1 - PERF.vx0 < TW * 0.9; }
function resize(force) {
  const r = tank.getBoundingClientRect(), r2 = walk.getBoundingClientRect();
  TW = Math.max(200, r.width); TH = Math.max(160, r.height); WW = Math.max(200, walk.clientWidth || r2.width); WH = Math.max(60, walk.clientHeight || r2.height);
  WDPR = Math.min(2, root.devicePixelRatio || 1); DPR = tankDpr(); PERF.bfxDirty = true; PERF.scrollAt = performance.now(); measureView();
  const key = [TW, TH, WW, WH, DPR, WDPR].join(','); if (key === rsKey && !force) return; rsKey = key;
  const tw = Math.round(TW * DPR), th = Math.round(TH * DPR), ww = Math.round(WW * WDPR), wh = Math.round(WH * WDPR);
  if (tank.width !== tw || tank.height !== th) { tank.width = tw; tank.height = th; } if (walk.width !== ww || walk.height !== wh) { walk.width = ww; walk.height = wh; }
  if (KF.on || KF.done || KF.job) kfReset(); // t340u: keyframes are size/DPR specific → re-bake once
  lblC.clear(); if (!bgCanvas) buildBg(); else { bgRequest(true); try { drawTank(0, performance.now()); drawWalk(0, performance.now()); } catch (e) {} }
}
let lastT = performance.now();
function frame(now) {
  root.requestAnimationFrame(frame);
  // t307u: behind an open dialog (drawing board, list, info) the sky ticks at ~12 fps (its backdrop blur no longer re-renders 60x/s); level 3 = steady 30 fps
  /* t310u: behind an open dialog (kite info card, drawing board, list) the sky was redrawn at ~12 fps = visibly jerky through the translucent
     blurred overlay. Now it holds the last frame perfectly still (no draws, no backdrop slices → the compositor keeps the blur cached) and
     resumes from where it was when the dialog closes (dt reset, no jump). */
  if (PERF.modal) { if (PERF.frozen) { lastT = now; PERF.lastDraw = now; return; } PERF.frozen = true; } else PERF.frozen = false;
  const gap = PERF.lvl >= 3 ? 31 : 0; if (gap && now - PERF.lastDraw < gap - 3) return;
  const iv = now - PERF.lastDraw; PERF.lastDraw = now;
  let dt = Math.min(0.1, (now - lastT) / 1000); lastT = now; if (reduce) dt *= 0.5;
  const w0 = performance.now();
  try { drawTank(dt, now, !PERF.tankVis); if (PERF.walkVis) drawWalk(dt, now); } catch (e) { if (!frame.err) { frame.err = 1; console.error(e); } }
  try { bgPump(COARSE ? 4 : 6); } catch (e) { bgJob = null; console.error(e); }
  try { kfPump(COARSE ? 4 : 6); } catch (e) { KF.job = null; console.error(e); }
  govern(now, iv, performance.now() - w0);
}
function govern(now, iv, work) {
  if (PERF.forced || PERF.modal || !PERF.tankVis || doc.hidden || iv > 250 || now - PERF.t0 < 4000) return;
  if (!PERF.win.length) PERF.ws = now; PERF.win.push(iv); PERF.work.push(work); if (PERF.win.length < 90 && !(now - PERF.ws > 2000 && PERF.win.length >= 10)) return;
  const n = PERF.win.length, avg = PERF.win.reduce((a, b) => a + b, 0) / n, wk = PERF.work.reduce((a, b) => a + b, 0) / n, longF = PERF.win.filter(x => x > 40).length / n; PERF.win = []; PERF.work = [];
  PERF.last = { fps: Math.round(1000 / avg), work: +wk.toFixed(1), longF: +longF.toFixed(2) };
  const slow = avg > (PERF.lvl >= 3 ? 40 : 24) && (wk > 8 || longF > 0.15); PERF.slow = slow ? (PERF.slow || 0) + 1 : 0;
  if ((PERF.slow >= 2 || (slow && avg > 60)) && PERF.lvl < 3) { PERF.lvl++; PERF.slow = 0; PERF.t0 = now; PERF.changes.push(Object.assign({ lvl: PERF.lvl, at: Math.round(now) }, PERF.last)); try { root.sessionStorage.setItem('langitbersama.perf', String(PERF.lvl)); } catch (e) {} resize(true); }
}
root.DQPerf = { get: () => ({ lvl: PERF.lvl, dpr: DPR, wdpr: WDPR, tank: [tank.width, tank.height], cull: PERF.cull, view: [Math.round(PERF.vx0), Math.round(PERF.vx1)], modal: PERF.modal, vis: [PERF.tankVis, PERF.walkVis], last: PERF.last, changes: PERF.changes, job: !!bgJob, fade: bgFade }), set: l => { PERF.lvl = Math.max(0, Math.min(3, l | 0)); PERF.forced = true; resize(true); } };

/* ---------- connection & room ---------- */
let room = null, mode = 'idle', pingTimer = null, entering = null;
/* t249u: loading vs truly empty — `synced` flips once the room is joined and the first hello (seed) has landed */
let synced = false;
const isReady = () => !!room && synced;
/* t313u: the loader leaves as soon as content is there (creatures in state) or the room is synced; it fades out instead of popping.
   The empty copy only shows after the room has been ready AND empty for EMPTY_GRACE ms (no flash of "nobody drew" on first load). */
const contentReady = () => !!room && (synced || creatures().length > 0);
const EMPTY_GRACE = 1400; let emptySince = 0, loadOutT = 0, revealAt = 0;
function setLoader(rd) {
  const el = $('tankLoad'); if (!el) return;
  if (!rd) { clearTimeout(loadOutT); loadOutT = 0; el.hidden = false; el.classList.remove('out'); doc.documentElement.classList.remove('dq-ready'); return; }
  if (!revealAt) revealAt = performance.now();
  doc.documentElement.classList.add('dq-ready');
  if (el.hidden || loadOutT) return; el.classList.add('out'); loadOutT = setTimeout(() => { loadOutT = 0; if (el.classList.contains('out')) el.hidden = true; }, REDUCED ? 0 : 480);
}
function showEmpty(rd, n) {
  const el = $('tankEmpty'); if (!rd || n > 0) { emptySince = 0; el.hidden = true; return; }
  if (!emptySince) { emptySince = Date.now(); setTimeout(() => { try { renderStatus(); } catch (e) {} }, EMPTY_GRACE + 30); }
  el.hidden = Date.now() - emptySince < EMPTY_GRACE;
}
function markReady(r) { if (room !== r) return; synced = true; chatSig = ''; listSig = ''; renderStatus(); renderChat(); try { renderList(true); } catch (e) {} }
let ss = null; try { ss = root.sessionStorage; } catch (e) { ss = null; }
let ls = null; try { ls = root.localStorage; } catch (e) { ls = null; }
const conn = new N.Connection({ storage: ss, onWake: () => { if (room && !room.local) room.refresh(); }, onSocket: () => connBadge(), lobbyWake: () => {} });
const creatures = () => (room ? room.s.cr : []);
const nowMs = () => (room ? room.now() : Date.now());
function connBadge() {
  const el = $('conn'); if (!el) return;
  if (!room) { el.textContent = T('conn_connecting'); el.classList.add('off'); return; }
  if (room.local) { el.textContent = T('conn_solo'); el.classList.add('off'); return; }
  const st = conn.state; el.textContent = st === 'online' ? T('conn_online') : st === 'reconnecting' ? T('conn_reconnecting') : T('conn_connecting'); el.classList.toggle('off', st !== 'online');
}
function loadJSON(k, d) { try { const v = JSON.parse(getLS(k) || 'null'); return v == null ? d : v; } catch (e) { return d; } }
let gmStore = loadJSON(KEYS.gm, []); if (!Array.isArray(gmStore)) gmStore = [];
/* GM size overrides survive anything that strips/overwrites cr[].sz (old cached clients, stale tank-cache reseed): the GM re-asserts them */
let gmSizes = loadJSON('langitbersama.gmsz', {}); if (!gmSizes || typeof gmSizes !== 'object' || Array.isArray(gmSizes)) gmSizes = {};
const saveGmSizes = () => { const k = Object.keys(gmSizes); if (k.length > 300) for (const x of k.slice(0, k.length - 300)) delete gmSizes[x]; setLS('langitbersama.gmsz', JSON.stringify(gmSizes)); };
let szFixAt = 0, szTimer = null;
function gmSizeCheck() {
  if (!isGM || !room) return; clearTimeout(szTimer);
  const wrong = room.s.cr.filter(c => gmSizes[c.id] && c.sz !== gmSizes[c.id]); if (!wrong.length) return;
  if (Date.now() - szFixAt < 2500) { szTimer = setTimeout(gmSizeCheck, 2600); return; }
  szFixAt = Date.now();
  room.edit('size-fix', s2 => { let n = 0; for (const c of s2.cr) if (gmSizes[c.id] && c.sz !== gmSizes[c.id]) { c.sz = gmSizes[c.id]; n++; } return n ? undefined : null; })
    .catch(() => {}).then(() => { szTimer = setTimeout(gmSizeCheck, 2600); });
}
const saveGm = () => setLS(KEYS.gm, JSON.stringify(gmStore.slice(-DQ.LIM.pinMax)));
let tankSaveAt = 0, gmFixAt = 0;
function saveTank() { if (room && !room.local && room.data) setLS(KEYS.tank, JSON.stringify({ cr: room.s.cr, del: room.s.del })); }
let knownIds = null;
function onRoom() {
  gmRefresh();
  const s = room.s;
  // cache the tank so a fresh room (everyone left) can be re-seeded by the next visitor
  if (!room.local) { clearTimeout(tankSaveAt); tankSaveAt = setTimeout(saveTank, 800); }
  for (const id of sim.keys()) if (!s.cr.some(c => c.id === id)) { sim.delete(id); sprites.delete(id); }
  if (isGM) {
    let ch = false;
    for (const c of s.cr) if (c.im && !gmStore.some(x => x.id === c.id)) { gmStore.push(c); ch = true; }
    const before = gmStore.length; gmStore = gmStore.filter(x => !s.del.includes(x.id) && !s.cr.some(c => c.id === x.id && !c.im)); if (gmStore.length !== before) ch = true;
    if (ch) saveGm();
    { let pr = false; for (const id of Object.keys(gmSizes)) if (s.del.includes(id)) { delete gmSizes[id]; pr = true; } if (pr) saveGmSizes();
      for (const g of gmStore) if (gmSizes[g.id] && g.sz !== gmSizes[g.id]) { g.sz = gmSizes[g.id]; ch = true; } if (ch) saveGm();
      gmSizeCheck(); }
    const missing = gmStore.filter(x => !s.cr.some(c => c.id === x.id));
    if (missing.length && Date.now() - gmFixAt > 8000) { gmFixAt = Date.now(); room.edit('rehydrate', s2 => DQ.merge(s2, missing, nowMs()) ? undefined : null).catch(() => {}); }
  }
  { const ids = new Set(s.cr.map(c => c.id)); if (knownIds) for (const c of s.cr) if (!knownIds.has(c.id) && !sim.has(c.id) && nowMs() - c.at < 20000) { const m = spawn(c, true); if (!m.arr) { SFX.splash(); LIFE.whoosh(0.5); } } knownIds = ids; }
  renderStatus(); renderChat(); syncVisitors(visitors()); try { renderList(); } catch (e) {}
  if (room.gone && !room.local) { room.gone = false; setTimeout(() => enterOnline().catch(() => goLocal()), 1500); }
}
function gmRefresh() {
  const g = mode === 'online' && !!room && !room.local && room.isGamemaster();
  if (g !== isGM) { isGM = g; listSig = ''; chatSig = ''; chatArm = ''; if (room) hello(g).catch(() => {}); renderStatus(); renderChat(); }
  if (gmUI) gmUI.sync();
}
function visitors() {
  if (!room) return [];
  const s = room.s, now = nowMs(), out = [], seen = new Set();
  for (const p of DQ.present(s, room.players(), now)) { const r = s.pr[DQ.K(p.id)]; seen.add(p.id); if (r.w && p.id !== room.me) continue; /* t314u: wallpaper screens are not spectators */ out.push({ id: p.id, name: r.n || p.displayName, em: CFG.avatars[r.a] || CFG.avatars[0], me: p.id === room.me, gm: room.isGamemaster(p.id) }); }
  if (room.me && !seen.has(room.me)) out.push({ id: room.me, name: myName, em: CFG.avatars[myAv], me: true, gm: isGM });
  return out;
}
function renderStatus() {
  const all = creatures(), n = all.filter(c => !c.im).length, np = all.length - n; $('countPill').textContent = T('count', { n: contentReady() ? n : '…', max: DQ.MAX_CREATURES }); $('stage').classList.toggle('pending', !contentReady()); $('pinPill').hidden = false; $('pinPill').textContent = T('countPerm', { n: np }); $('pinPill').title = T('permTip');
  $('visPill').textContent = T('visitors', { n: Math.max(1, visitors().length) });
  { const hc = $('howCounts'); hc.textContent = ''; for (const [cls, txt] of [['pill', T('count', { n, max: DQ.MAX_CREATURES })], ['pill soft pin', T('countPerm', { n: np })], ['pill soft', T('visitors', { n: Math.max(1, visitors().length) })]]) { const sp = doc.createElement('span'); sp.className = cls; sp.textContent = txt; hc.appendChild(sp); } const tip = doc.createElement('p'); tip.className = 'muted small'; tip.textContent = T('permTip'); hc.appendChild(tip); }
  { setLoader(contentReady()); showEmpty(isReady(), all.length); } $('fullHint').hidden = n < DQ.MAX_CREATURES;
  const rp = $('roomPill'); rp.hidden = true; if (room) rp.textContent = T('roomLabel', { code: room.code }); // t209u: room code hidden from the UI
  $('meBtn').hidden = !myName; $('meName').textContent = myName; $('meAv').textContent = CFG.avatars[myAv]; $('meGm').hidden = !isGM;
  connBadge();
}
/** presence + (GM) mark + seed a fresh room from the local tank cache + GM rehydrate */
function hello(first, carry) {
  if (!room) return Promise.resolve();
  const me = room.me, live = room.players().map(p => p.id), cache = loadJSON(KEYS.tank, null);
  return room.edit('hello', s => {
    DQ.ping(s, me, myName, myAv, nowMs(), room.local ? null : live);
    if (WP && me && s.pr[DQ.K(me)]) s.pr[DQ.K(me)].w = 1; // t314u: mark the wallpaper screen so visitors don't see it as a spectator
    if (isGM) s.gm[DQ.K(me)] = 1; else delete s.gm[DQ.K(me)];
    if (first) {
      if (!s.sd) { if (cache && !room.local) { s.del = DQ.arr(s.del).concat(DQ.arr(cache.del)).slice(-DQ.LIM.delKeep); DQ.merge(s, cache.cr, nowMs()); } s.sd = 1; }
      if (isGM) DQ.merge(s, gmStore.filter(x => !s.del.includes(x.id)), nowMs());
      if (carry && !room.local) { s.del = DQ.arr(s.del).concat(DQ.arr(carry.del).filter(id => !s.del.includes(id))).slice(-DQ.LIM.delKeep); DQ.merge(s, carry.cr.filter(c => !s.del.includes(c.id)), nowMs()); } // t351u: a room hop brings the sky along
    }
  });
}
function startPing() { clearInterval(pingTimer); pingTimer = setInterval(() => { if (room && doc.visibilityState !== 'hidden') { hello(false).catch(() => {}); roomCheck().catch(() => {}); } }, 60000); setTimeout(() => roomCheck().catch(() => {}), 15000); }
function withTimeout(p, ms) { return Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(Error('timeout')), ms))]); }
/* t351u: ONE shared public room. Core (main 25148e5) lets drawquarium + langitbersama hold 500 seats + 500 spectators per room
   (GET /api/game/config limits; every other game stays 16/4/20). Sticky rules:
   - pick = joinable public WAITING room: among alive ones (updated < 5 min) the fullest (seated+spectators); if none is alive, the most
     recently updated one (not the fullest: Core bumped old ghost-full 16/20 rooms to 500 too, they must stay abandoned)
     [t322u ghost seats are harmless now: they make the long-lived main room the fullest = the canonical one];
   - take a seat, else watch the SAME room (a wallpaper watches first); a transient join/watch failure re-reads the list and retries
     that room with backoff — never `match` while a public waiting room exists;
   - `match` only when the list has NO public waiting room (or every room is truly 500/500 full / the list endpoint is down —
     Core's match still joins the oldest waiting room with a free seat before it opens a new one);
   - nothing in this game ever sets status 'playing' (match ignores playing rooms → would spawn Room B);
   - roomCheck (60 s ping): a client stuck in a smaller room (empty-list race) hops into the fuller one and brings its creatures. */
const ALIVE_MS = 5 * 60000;
const cfgLim = (k, d) => { const L = conn.config && conn.config.limits, v = L ? Number(L[k]) : 0; return v > 0 ? v : d; };
const specMax = () => cfgLim('spectators', DQ.SPEC_MAX);
const people = x => (x.seated | 0) + (x.spectators | 0);
const hasSeat = x => (x.seated | 0) < (x.maxPlayers | 0);
const canWatch = x => (x.spectators | 0) < specMax();
const joinable = x => hasSeat(x) || canWatch(x);
function pickRoom(list, now) {
  const ts = x => Date.parse(x.updatedAt || '') || 0, alive = x => (now - ts(x) < ALIVE_MS ? 1 : 0);
  return list.filter(joinable).sort((a, b) => alive(b) - alive(a) || alive(b) * (people(b) - people(a)) || ts(b) - ts(a) || (b.version | 0) - (a.version | 0))[0] || null; // nobody alive → the most recently used room (old ghost-full rooms Core bumped to 500 stay abandoned)
}
let joinErr = null;
async function publicRooms() { try { const r = await conn.rooms(); return DQ.arr(r && r.rooms).filter(x => x.status === 'waiting' && x.visibility === 'public'); } catch (e) { joinErr = e; return null; } }
async function joinRoom(r, x, opts) {
  const seat = async () => { try { if (hasSeat(x)) return await r.enter('join', Object.assign({ code: x.code }, opts)); } catch (e) { joinErr = e; } return null; };
  const watch = async () => { try { if (canWatch(x)) return await r.enter('watch', Object.assign({ code: x.code }, opts)); } catch (e) { joinErr = e; } return null; };
  return WP ? ((await watch()) || (await seat())) : ((await seat()) || (await watch())); // t322u: a wallpaper screen only watches, seats stay free for people
}
const nap = ms => new Promise(res => setTimeout(res, ms));
async function stickyEnter(r, opts) {
  joinErr = null; let list = await publicRooms(), pick = null;
  for (let i = 0; i < 4; i++) {
    if (list && !list.length) { root.DQRoomPath = 'match-empty'; return await r.enter('match', opts); } // no public waiting room at all
    pick = list ? pickRoom(list, Date.now()) : null;
    if (pick) { const d = await joinRoom(r, pick, opts); if (d) { root.DQRoomPath = (i ? 'retry' + i + ':' : '') + 'join:' + pick.code; return d; } }
    else if (list) break; // every public room is truly 500/500 full
    if (i < 3) { const w = joinErr && joinErr.wait ? Math.min(12, joinErr.wait) * 1000 + 300 : 0; joinErr = null; /* honour a 429 backoff */ await nap(Math.max(w, 400 * (i + 1) + Math.random() * 400)); list = await publicRooms(); }
  }
  if (!list || !pick || hasSeat(pick)) { root.DQRoomPath = 'match-fallback'; return await r.enter('match', opts); } // Core match still prefers an existing waiting room with a free seat
  throw joinErr || Error('room busy'); // watch-only room kept refusing: do not open Room B, caller retries / goes local
}
async function enterOnline(carry) {
  if (entering) return entering;
  entering = (async () => {
    await withTimeout(conn.start(), 9000);
    const r = new N.Room(conn, { onChange: () => { if (room === r) onRoom(); } });
    const opts = { displayName: myName || 'JadiDaring' };
    await stickyEnter(r, opts);
    room = r; mode = 'online'; onRoom(); await hello(true, carry).catch(() => {}); markReady(r); startPing(); return r;
  })();
  try { return await entering; } finally { entering = null; }
}
let lastHop = 0;
async function roomCheck() {
  if (!room || room.local || mode !== 'online' || entering || doc.visibilityState === 'hidden' || Date.now() - lastHop < 90000) return;
  const list = await publicRooms(); if (!list || !room || room.local) return;
  const mine = list.find(x => x.code === room.code), pick = pickRoom(list, Date.now());
  if (!pick || pick.code === room.code) return;
  if (mine && joinable(mine) && people(mine) >= people(pick)) return; // ours is reachable and at least as full: others will come here
  lastHop = Date.now(); const carry = { cr: room.s.cr.slice(), del: DQ.arr(room.s.del).slice() }; saveTank();
  root.DQRoomHop = { from: room.code, to: pick.code, at: Date.now() };
  try { await enterOnline(carry); } catch (e) { /* stay: next ping retries */ }
}
async function goLocal() {
  const r = new N.Room(new N.LocalLink(ls), { onChange: () => { if (room === r) onRoom(); } });
  await r.enter('local', { displayName: myName || 'JadiDaring' }); room = r; mode = 'local'; onRoom(); await hello(true).catch(() => {}); markReady(r); return r;
}
async function connect() { try { await enterOnline(); } catch (e) { await goLocal(); } }

/* ---------- chat ---------- */
let chatSig = '', lastSend = 0, chatPingKey = '', chatArm = '', chatArmT = 0;
/** t304u: only the server-confirmed GM (online room) sees the chat delete controls */
function chatCanDel() { return isGM && !!room && !room.local && isReady(); }
function renderChat() {
  const s = room ? room.s : DQ.newState(), last = s.cm[s.cm.length - 1], canDel = chatCanDel(), sig = lang + ':' + (isReady() ? 1 : 0) + ':' + s.cm.length + ':' + (last ? last.i + last.t : '') + ':' + (canDel ? 'g' + chatArm : '') + ':' + s.cm.map(DQ.chatKey).join(',');
  if (sig === chatSig) return; const hadSig = !!chatSig && chatSig.split(':')[0] === lang && chatSig.split(':')[1] === '1'; chatSig = sig;
  const lastKey = last ? DQ.chatKey(last) : ''; if (hadSig && last && room && last.by !== room.me && !last.k && lastKey !== chatPingKey) SFX.ping(); chatPingKey = lastKey;
  $('chatClear').hidden = !canDel || !s.cm.length; $('chatBox').classList.toggle('gm-chat', canDel); paintClear();
  const ul = $('chatList'), near = ul.scrollHeight - ul.scrollTop - ul.clientHeight < 60; ul.textContent = '';
  if (!isReady() && !s.cm.length) { const li = doc.createElement('li'); li.className = 'loading'; li.setAttribute('role', 'status'); li.innerHTML = '<span class="cl-fish" aria-hidden="true"></span><span class="cl-txt"></span><span class="tl-dots" aria-hidden="true"><i>.</i><i>.</i><i>.</i></span>'; li.querySelector('.cl-txt').textContent = T('chatLoading'); ul.appendChild(li); return; }
  if (!s.cm.length) { const li = doc.createElement('li'); li.className = 'empty'; li.textContent = T('chatEmpty'); ul.appendChild(li); return; }
  for (const m of s.cm) {
    const li = doc.createElement('li');
    if (m.k) { li.className = 'sys'; li.textContent = T(m.k === 'add' ? 'chatAdd' : m.k === 'gone' ? 'chatGone' : 'chatDel', { who: m.n, name: m.t }); }
    else { if (room && m.by === room.me) li.className = 'me'; const b = doc.createElement('b'); b.textContent = m.n + (room && room.isGamemaster(m.by) ? ' (GM)' : '') + ':'; li.appendChild(b); li.appendChild(doc.createTextNode(m.t)); }
    if (canDel) { const k = DQ.chatKey(m), b = doc.createElement('button'); b.type = 'button'; b.className = 'cm-del' + (chatArm === k ? ' arm' : ''); b.dataset.k = k; b.textContent = chatArm === k ? T('chatDelSure') : '🗑'; b.title = T('chatDelMsg'); b.setAttribute('aria-label', T('chatDelMsg') + (m.k ? '' : ': ' + m.n + ' — ' + m.t)); li.classList.add('can-del'); if (chatArm === k) li.classList.add('armed'); li.appendChild(b); }
    ul.appendChild(li);
  }
  if (near || (last && room && last.by === room.me)) ul.scrollTop = ul.scrollHeight;
}
/* t304u: GM chat moderation — tap 🗑 once to arm ("Hapus?"), tap again within 4 s to delete; 🧹 clears all the same way */
function armChat(k) { chatArm = k; clearTimeout(chatArmT); if (k) chatArmT = setTimeout(() => { chatArm = ''; chatSig = ''; renderChat(); }, 4000); chatSig = ''; renderChat(); }
function paintClear() { const b = $('chatClear'), on = chatArm === '*'; b.classList.toggle('arm', on); b.textContent = on ? T('chatClearSure') : '🧹'; b.title = T('chatClear'); b.setAttribute('aria-label', T('chatClear')); }
async function gmDeleteChat(keys) {
  if (!chatCanDel()) return; armChat(''); let n = 0;
  try { await room.edit(keys ? 'chat-del' : 'chat-clear', s => { n = DQ.deleteChat(s, keys, { gm: true }); return n ? undefined : null; }); SFX.tap && SFX.tap(); if (n) toast(T(keys ? 'chatDeleted' : 'chatCleared', { n })); }
  catch (e) { toast(T('chatDelFail'), true); }
  chatSig = ''; renderChat();
}
$('chatList').addEventListener('click', e => {
  const b = e.target.closest && e.target.closest('.cm-del'); if (!b || !chatCanDel()) return; e.preventDefault(); e.stopPropagation();
  const k = b.dataset.k; if (chatArm === k) gmDeleteChat([k]); else armChat(k);
});
$('chatClear').addEventListener('click', e => { e.preventDefault(); if (!chatCanDel()) return; if (chatArm === '*') gmDeleteChat(null); else armChat('*'); });
$('chatForm').addEventListener('submit', e => {
  e.preventDefault(); const inp = $('chatInput'), text = DQ.cleanText(inp.value, DQ.LIM.chatMax); if (!text || !room) return;
  const t = Date.now(); if (t - lastSend < DQ.LIM.chatGap) return; lastSend = t; inp.value = '';
  room.edit('chat', s => { DQ.ping(s, room.me, myName, myAv, nowMs(), null); return DQ.chat(s, room.me, myName, text, nowMs()) ? undefined : null; }).catch(() => { toast(T('sendFail'), true); inp.value = text; });
});

/* ---------- name gate ---------- */
function openGate() {
  $('nameInput').value = ''; /* t367u: never prefill (placeholder JadiDaring) */ $('gateGm').hidden = !isGM; $('gateErr').textContent = ''; renderAv(); renderGateLang(); $('gate').hidden = false; setTimeout(() => $('nameInput').focus(), 30);
}
function renderAv() {
  const box = $('avPick'); box.textContent = '';
  CFG.avatars.forEach((a, i) => { const b = doc.createElement('button'); b.type = 'button'; b.setAttribute('role', 'radio'); b.setAttribute('aria-checked', String(i === myAv)); b.textContent = a; b.addEventListener('click', () => { myAv = i; renderAv(); }); box.appendChild(b); });
}
$('gateForm').addEventListener('submit', e => {
  e.preventDefault(); const n = DQ.cleanText($('nameInput').value, DQ.LIM.nameMax); if (!n) { $('gateErr').textContent = T('needName'); return; }
  const first = !room; myName = n; setLS(KEYS.name, n); try { sessionStorage.setItem('jdng.langitbersama', n); } catch (x) {} setLS(KEYS.av, String(myAv)); setLS(KEYS.lang, lang); /* t325u: confirm the gate language */ $('gate').hidden = true; renderStatus();
  if (!getLS('langitbersama.howSeen')) { setLS('langitbersama.howSeen', '1'); setTimeout(openHow, 350); }
  if (first && !entering) connect(); else hello(false).catch(() => {});
});
$('meBtn').addEventListener('click', openGate);
/* t205u: mobile hamburger + chat history drawer (input stays; sending shows a balloon on your walker) */
/* t209u: desktop puts "Buat ikan" at the left of the residents pill in the tank bar; mobile keeps it in the header next to ☰ */
const deskMQ = root.matchMedia ? root.matchMedia('(min-width: 901px)') : null;
function placeCreate() { const b = $('createBtn'), bar = doc.querySelector('.tank-bar'), hr = doc.querySelector('.hdr-right'); if (deskMQ && deskMQ.matches) { if (b.parentNode !== bar) bar.insertBefore(b, bar.firstChild); } else if (b.parentNode !== hr) hr.insertBefore(b, hr.firstChild); }
placeCreate(); if (deskMQ) { if (deskMQ.addEventListener) deskMQ.addEventListener('change', placeCreate); else if (deskMQ.addListener) deskMQ.addListener(placeCreate); }
function setMenu(open) { if (open) { const hb = doc.querySelector('.top').getBoundingClientRect(); $('hdrMore').style.setProperty('--menu-top', Math.max(8, Math.round(hb.bottom) + 4) + 'px'); } $('hdrMore').classList.toggle('open', open); $('menuBtn').setAttribute('aria-expanded', open ? 'true' : 'false'); $('menuBtn').textContent = open ? '✕' : '☰'; }
function setHist(open) { $('chatBox').classList.toggle('open', open); $('histBtn').setAttribute('aria-expanded', open ? 'true' : 'false'); $('histBtn').querySelector('.arr').textContent = open ? '▼' : '▲'; if (open) { const ul = $('chatList'); setTimeout(() => { ul.scrollTop = ul.scrollHeight; }, 0); } }
$('menuBtn').addEventListener('click', e => { e.stopPropagation(); setMenu(!$('hdrMore').classList.contains('open')); });
$('hdrMore').addEventListener('click', e => { if (e.target.closest('button,a')) setMenu(false); });
/* t247u: menu entry -> same page in ?wallpaper mode (same tab; room/hash dropped: wallpaper joins the public tank) */
$('wpBtn').href = (location.pathname || '/') + '?wallpaper';
doc.addEventListener('click', e => { if (!e.target.closest('#hdrMore,#menuBtn')) setMenu(false); });
$('histBtn').addEventListener('click', () => setHist(!$('chatBox').classList.contains('open')));
$('histClose').addEventListener('click', () => setHist(false));

/* ---------- maker: choose kind → draw ---------- */
const board = $('board'), bctx = board.getContext('2d', { willReadFrequently: true }), guide = $('guide'), gctx = guide.getContext('2d');
board.width = B.w * 2; board.height = B.h * 2; guide.width = B.w * 2; guide.height = B.h * 2;
let mk = { kind: 'kite', strokes: [], tool: 'p', c: 3, w: 3, cur: null };
const KIND_LIST = ['kite', 'bird', 'balloon', 'plane', 'cloud'], KIND_BTN = { kite: 'pickKite', bird: 'pickBird', balloon: 'pickBalloon', plane: 'pickPlane', cloud: 'pickCloud' }, KIND_COL = { kite: 2, bird: 7, balloon: 9, plane: 1, cloud: 1 };
const PREVIEW = {
  kite: [{ m: 'f', c: 2, w: 1, p: [] }, { m: 'p', c: 0, w: 2, p: [[240, 26], [240, 302]] }, { m: 'p', c: 0, w: 2, p: [[82, 150], [398, 150]] }, { m: 'b', c: 4, w: 1, p: [[200, 110]] }, { m: 'b', c: 4, w: 1, p: [[280, 200]] }],
  bird: [{ m: 'f', c: 7, w: 1, p: [] }, { m: 'p', c: 4, w: 4, p: [[392, 162], [428, 170], [392, 178]] }, { m: 'p', c: 1, w: 5, p: [[360, 158]] }, { m: 'p', c: 0, w: 3, p: [[360, 158]] }, { m: 'p', c: 13, w: 4, p: [[200, 190], [180, 120], [175, 70]] }],
  balloon: [{ m: 'f', c: 9, w: 1, p: [] }, { m: 'p', c: 1, w: 4, p: [[178, 92], [190, 66], [216, 56]] }, { m: 'p', c: 0, w: 2, p: [[200, 150], [205, 155]] }, { m: 'p', c: 0, w: 2, p: [[275, 150], [280, 155]] }, { m: 'p', c: 0, w: 2, p: [[215, 190], [240, 205], [265, 190]] }],
  plane: [{ m: 'f', c: 1, w: 1, p: [] }, { m: 'p', c: 7, w: 2, p: [[176, 192], [440, 172]] }, { m: 'p', c: 11, w: 2, p: [[150, 236], [300, 184]] }, { m: 'p', c: 2, w: 3, p: [[90, 120], [200, 145]] }],
  cloud: [{ m: 'f', c: 1, w: 1, p: [] }, { m: 'p', c: 0, w: 2, p: [[200, 210], [205, 214]] }, { m: 'p', c: 0, w: 2, p: [[280, 210], [285, 214]] }, { m: 'p', c: 9, w: 5, p: [[178, 232]] }, { m: 'p', c: 9, w: 5, p: [[306, 232]] }, { m: 'p', c: 0, w: 2, p: [[225, 236], [242, 248], [260, 236]] }],
};
function previewKinds() {
  for (const k of KIND_LIST) {
    const cv = $(KIND_BTN[k]).querySelector('canvas'), ctx = cv.getContext('2d', { willReadFrequently: true }); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cv.width, cv.height); ctx.scale(cv.width / B.w, cv.height / B.h); drawGuide(ctx, k, true); paint(ctx, PREVIEW[k], k);
  }
}
function openMaker() { mk.back = false; $('chooseStep').hidden = false; $('drawStep').hidden = true; $('maker').hidden = false; doc.documentElement.classList.add('jr-hub-off'); previewKinds(); setTimeout(() => $('pickKite').focus(), 30); }
function closeMaker() { $('maker').hidden = true; doc.documentElement.classList.remove('jr-hub-off'); }
function startDraw(kind) {
  const keep = mk.back && kind === mk.kind && mk.strokes.length > 0; mk.back = false; // t214u: "Ganti bentuk" then the same shape keeps the drawing
  if (!keep) { mk.kind = kind; mk.strokes = []; mk.cur = null; mk.tool = 'p'; mk.c = KIND_COL[kind] == null ? 3 : KIND_COL[kind]; mk.pins = null; mk.pinMan = false; }
  $('chooseStep').hidden = true; $('drawStep').hidden = false; $('drawErr').textContent = '';
  $('drawTitle').textContent = EMO[kind] + ' ' + T('draw_' + kind); $('critterLabel').textContent = T('critterName'); if (!keep) $('critterInput').value = '';
  gctx.setTransform(2, 0, 0, 2, 0, 0); gctx.clearRect(0, 0, B.w, B.h); drawGuide(gctx, kind, false);
  renderTools(); redraw();
}
function redraw() { bctx.setTransform(2, 0, 0, 2, 0, 0); bctx.clearRect(0, 0, B.w, B.h); const r = paint(bctx, mk.strokes, mk.kind); bctx.__last = r; bctx.__leak = r === 0 && floodLeak; if (!mk.cur) pinSync(); }
/* ---------- t275u: attachment pins on the draw board (kite string+tail, balloon string, bird wing hinge) ----------
   Auto = follows the ink after every stroke; dragging a pin (or arrow keys) makes it manual until "Auto" is tapped. Sent as c.pn. */
const pinFx = $('pinFx'), pfx = pinFx.getContext('2d'), pinsEl = $('pins'); pinFx.width = B.w * 2; pinFx.height = B.h * 2;
const PIN_ICO = { kite: ['🎀'], balloon: ['🧵'], bird: ['🪽', '🪽'] };
function pinSync() {
  const n = DQ.PIN_N[mk.kind], ink = n ? inkScan(board, 2) : null; mk.ink = ink;
  if (!ink) { mk.pins = null; mk.pinMan = false; }
  else if (!mk.pinMan || !mk.pins) { mk.pins = defPins(mk.kind, ink); mk.pinMan = false; }
  pinRender();
}
function pinRender() {
  const on = !!(mk.pins && DQ.PIN_N[mk.kind]); $('pinBar').hidden = !DQ.PIN_N[mk.kind];
  if (DQ.PIN_N[mk.kind]) { $('pinHint').textContent = T(!on ? 'pinWait_' + mk.kind : mk.tool === 'n' ? 'pinHint_' + mk.kind : 'pinOff_' + mk.kind); $('pinIco').textContent = PIN_ICO[mk.kind][0]; $('pinAuto').style.visibility = on && mk.pinMan ? 'visible' : 'hidden'; $('pinTool').disabled = !on; if (!on && mk.tool === 'n') { mk.tool = 'p'; renderTools(); } }
  const want = on ? mk.pins.length / 2 : 0;
  while (pinsEl.children.length > want) pinsEl.lastChild.remove();
  while (pinsEl.children.length < want) pinsEl.appendChild(pinMake(pinsEl.children.length));
  for (let i = 0; i < want; i++) { const el = pinsEl.children[i]; el.style.left = (mk.pins[i * 2] / B.w * 100) + '%'; el.style.top = (mk.pins[i * 2 + 1] / B.h * 100) + '%'; el.classList.toggle('auto', !mk.pinMan); el.classList.toggle('w', mk.kind === 'bird'); el.firstChild.textContent = PIN_ICO[mk.kind][i] || '📍'; el.setAttribute('aria-label', T(mk.kind === 'bird' ? (i ? 'pin_wr' : 'pin_wl') : 'pin_' + mk.kind)); }
  pinPreview();
}
function pinMake(i) {
  const el = doc.createElement('button'); el.type = 'button'; el.className = 'apin'; el.dataset.i = String(i); el.appendChild(doc.createElement('span'));
  el.addEventListener('pointerdown', e => { if (!mk.pins || mk.tool !== 'n') return; e.preventDefault(); e.stopPropagation(); pinDrag = i; el.classList.add('drag'); });
  el.addEventListener('keydown', e => { const d = { ArrowLeft: [-4, 0], ArrowRight: [4, 0], ArrowUp: [0, -4], ArrowDown: [0, 4] }[e.key]; if (!d || !mk.pins) return; e.preventDefault(); mk.pins[i * 2] = clamp(mk.pins[i * 2] + d[0], 0, B.w); mk.pins[i * 2 + 1] = clamp(mk.pins[i * 2 + 1] + d[1], 0, B.h); mk.pinMan = true; pinRender(); });
  return el;
}
/* pin mode: grab a pin, or tap anywhere on the board to bring the nearest pin there; drag follows the pointer (document-level, so leaving the board is fine) */
let pinDrag = -1;
function pinAt(e, i) { const r = board.getBoundingClientRect(); mk.pins[i * 2] = Math.round(clamp((e.clientX - r.left) / r.width * B.w, 0, B.w)); mk.pins[i * 2 + 1] = Math.round(clamp((e.clientY - r.top) / r.height * B.h, 0, B.h)); mk.pinMan = true; pinRender(); }
function pinGrab(e) {
  if (!mk.pins) return; const r = board.getBoundingClientRect(), x = (e.clientX - r.left) / r.width * B.w, y = (e.clientY - r.top) / r.height * B.h; let best = 0, bd = Infinity;
  for (let i = 0; i < mk.pins.length / 2; i++) { const d = Math.hypot(mk.pins[i * 2] - x, mk.pins[i * 2 + 1] - y); if (d < bd) { bd = d; best = i; } }
  pinDrag = best; pinAt(e, best); const el = pinsEl.children[best]; if (el) el.classList.add('drag');
}
doc.addEventListener('pointermove', e => { if (pinDrag >= 0 && mk.pins) { e.preventDefault(); pinAt(e, pinDrag); } }, { passive: false });
const pinEnd = () => { if (pinDrag < 0) return; pinDrag = -1; for (const el of pinsEl.children) el.classList.remove('drag'); SFX.tap(); };
doc.addEventListener('pointerup', pinEnd); doc.addEventListener('pointercancel', pinEnd);
/** dashed preview of what hangs from / flaps at the pins, drawn over the board (not part of the drawing) */
function pinPreview() {
  const g = pfx; g.setTransform(2, 0, 0, 2, 0, 0); g.clearRect(0, 0, B.w, B.h); if (!mk.pins || !mk.ink) return;
  const p = mk.pins; g.save(); g.lineCap = 'round'; g.lineJoin = 'round';
  if (mk.kind === 'kite') {
    g.setLineDash([2, 6]); g.lineWidth = 2; g.strokeStyle = 'rgba(60,60,80,.7)'; g.beginPath(); g.moveTo(p[0], p[1]); g.quadraticCurveTo(p[0] + 30, p[1] + 80, p[0] + 90, B.h + 10); g.stroke();
    g.setLineDash([]); g.strokeStyle = 'rgba(255,93,93,.75)'; g.fillStyle = 'rgba(255,93,93,.75)'; g.lineWidth = 3; g.beginPath(); g.moveTo(p[0], p[1]); const L = 110, pts = [];
    for (let i = 1; i <= 8; i++) { const f = i / 8, x = p[0] - 18 * f + Math.sin(f * 7) * 9, y = p[1] + L * f; g.lineTo(x, y); pts.push([x, y]); } g.stroke();
    for (const [i, q] of pts.entries()) if (i % 2) { const r = 7; g.beginPath(); g.moveTo(q[0], q[1]); g.lineTo(q[0] - r, q[1] - r * 0.6); g.lineTo(q[0] - r, q[1] + r * 0.6); g.closePath(); g.moveTo(q[0], q[1]); g.lineTo(q[0] + r, q[1] - r * 0.6); g.lineTo(q[0] + r, q[1] + r * 0.6); g.closePath(); g.fill(); }
  } else if (mk.kind === 'balloon') {
    g.setLineDash([]); g.lineWidth = 2; g.strokeStyle = 'rgba(70,70,90,.7)'; g.beginPath(); g.moveTo(p[0], p[1]); for (let i = 1; i <= 10; i++) { const f = i / 10; g.lineTo(p[0] + Math.sin(f * 9) * 6 * f, p[1] + 120 * f); } g.stroke();
  } else if (mk.kind === 'bird') {
    const [x0, y0] = mk.ink.box, wl = Math.min(p[0], p[2]), wr = Math.max(p[0], p[2]), wy = (p[1] + p[3]) / 2, top = Math.min(y0, wy) - 4;
    g.fillStyle = 'rgba(47,138,232,.16)'; g.strokeStyle = 'rgba(47,138,232,.85)'; g.lineWidth = 2; g.setLineDash([7, 6]);
    g.beginPath(); if (g.roundRect) g.roundRect(wl, top, wr - wl, wy - top, 10); else g.rect(wl, top, wr - wl, wy - top); g.fill(); g.stroke();
    g.setLineDash([]); g.lineWidth = 3; g.beginPath(); g.moveTo(p[0], p[1]); g.lineTo(p[2], p[3]); g.stroke();
    const mx = (wl + wr) / 2, ay = top + (wy - top) / 2; g.lineWidth = 2.5; g.beginPath(); g.moveTo(mx, ay - 14); g.lineTo(mx, ay + 14); g.moveTo(mx - 6, ay - 8); g.lineTo(mx, ay - 14); g.lineTo(mx + 6, ay - 8); g.moveTo(mx - 6, ay + 8); g.lineTo(mx, ay + 14); g.lineTo(mx + 6, ay + 8); g.stroke();
    void x0;
  }
  g.restore();
}
$('pinAuto').addEventListener('click', () => { mk.pinMan = false; pinSync(); });
$('pinTool').addEventListener('click', () => { mk.tool = mk.tool === 'n' ? 'p' : 'n'; renderTools(); });
function renderTools() {
  const pal = $('palette'); pal.textContent = '';
  PAL.forEach((col, i) => { const b = doc.createElement('button'); b.type = 'button'; b.style.background = col; b.setAttribute('role', 'radio'); b.setAttribute('aria-checked', String(i === mk.c)); b.setAttribute('aria-label', T('color') + ' ' + (i + 1)); b.addEventListener('click', () => { mk.c = i; if (mk.tool === 'e') mk.tool = 'p'; renderTools(); }); pal.appendChild(b); });
  const sz = $('sizes'); sz.textContent = '';
  W8.forEach((w, i) => { const b = doc.createElement('button'); b.type = 'button'; b.setAttribute('role', 'radio'); b.setAttribute('aria-checked', String(i + 1 === mk.w)); b.setAttribute('aria-label', T('size') + ' ' + (i + 1)); const dot = doc.createElement('i'); const d = Math.max(4, Math.round(w * 0.7)); dot.style.width = dot.style.height = d + 'px'; b.appendChild(dot); b.addEventListener('click', () => { mk.w = i + 1; renderTools(); }); sz.appendChild(b); });
  if (mk.tool === 'n' && !DQ.PIN_N[mk.kind]) mk.tool = 'p';
  $('pinTool').textContent = T(mk.tool === 'n' ? 'pinDone' : 'pinTool'); $('pinTool').classList.toggle('on', mk.tool === 'n'); $('pinTool').setAttribute('aria-pressed', String(mk.tool === 'n')); pinsEl.classList.toggle('live', mk.tool === 'n'); board.classList.toggle('pinmode', mk.tool === 'n'); if (mk.pins !== undefined) pinRender();
  for (const [id, t] of [['toolPen', 'p'], ['toolEraser', 'e'], ['toolBucket', 'b']]) { $(id).classList.toggle('on', mk.tool === t); $(id).setAttribute('aria-pressed', String(mk.tool === t)); }
  board.classList.toggle('bucket', mk.tool === 'b'); board.classList.toggle('erase', mk.tool === 'e');
}
function boardPt(e) { const r = board.getBoundingClientRect(); return [clamp((e.clientX - r.left) / r.width * B.w, 0, B.w), clamp((e.clientY - r.top) / r.height * B.h, 0, B.h)]; }
board.addEventListener('pointerdown', e => {
  if (e.button !== undefined && e.button > 0) return; e.preventDefault();
  if (mk.tool === 'n') { pinGrab(e); return; }
  try { board.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
  if (mk.strokes.length >= DQ.LIM.strokesMax) { $('drawErr').textContent = T('tooBig'); return; }
  $('drawErr').textContent = '';
  if (mk.tool === 'b') { // bucket: one tap = one flood op; refused/no-op fills are not kept
    const q = boardPt(e).map(v => Math.round(v)); mk.strokes.push({ c: mk.c, w: 1, m: 'b', p: [q] }); redraw();
    if (bctx.__last === 0) { const leak = bctx.__leak; mk.strokes.pop(); redraw(); if (leak) $('drawErr').textContent = T('bucketLeak'); }
    return;
  }
  mk.cur = { c: mk.c, w: mk.w, m: mk.tool, p: [boardPt(e)] }; mk.strokes.push(mk.cur); redraw();
});
board.addEventListener('pointermove', e => {
  if (!mk.cur) return; const p = boardPt(e), last = mk.cur.p[mk.cur.p.length - 1]; if (Math.hypot(p[0] - last[0], p[1] - last[1]) < 1.5) return;
  mk.cur.p.push(p);
  bctx.save(); bctx.setTransform(2, 0, 0, 2, 0, 0); bctx.globalCompositeOperation = mk.cur.m === 'e' ? 'destination-out' : 'source-over'; bctx.strokeStyle = PAL[mk.cur.c]; bctx.lineWidth = W8[mk.cur.w - 1]; bctx.lineCap = 'round'; bctx.lineJoin = 'round';
  bctx.beginPath(); bctx.moveTo(last[0], last[1]); bctx.lineTo(p[0], p[1]); bctx.stroke(); bctx.restore();
});
const endStroke = () => { if (mk.cur) { mk.cur = null; redraw(); } };
board.addEventListener('pointerup', endStroke); board.addEventListener('pointercancel', endStroke); board.addEventListener('lostpointercapture', endStroke);
$('toolPen').addEventListener('click', () => { mk.tool = 'p'; renderTools(); });
$('toolEraser').addEventListener('click', () => { mk.tool = 'e'; renderTools(); });
$('toolBucket').addEventListener('click', () => { mk.tool = 'b'; renderTools(); });
$('toolUndo').addEventListener('click', () => { mk.strokes.pop(); redraw(); });
$('toolClear').addEventListener('click', () => { mk.strokes = []; mk.pinMan = false; redraw(); });
for (const k of KIND_LIST) $(KIND_BTN[k]).addEventListener('click', () => startDraw(k));
$('drawBack').addEventListener('click', () => { mk.back = true; $('chooseStep').hidden = false; $('drawStep').hidden = true; });
$('chooseCancel').addEventListener('click', closeMaker);
$('createBtn').addEventListener('click', () => { if (!myName) { openGate(); return; } if (!isGM && creatures().filter(c => !c.im).length >= DQ.MAX_CREATURES) toast(T('fullHint')); openMaker(); });
let submitting = false;
$('submitForm').addEventListener('submit', async e => {
  e.preventDefault(); if (submitting || !room) return;
  if (!mk.strokes.some(st => st.m !== 'e')) { $('drawErr').textContent = T('emptyDraw'); return; }
  const d = DQ.pack(mk.strokes); if (!d) { $('drawErr').textContent = T('tooBig'); return; }
  const nm = DQ.cleanText($('critterInput').value, DQ.LIM.critterName) || (T(mk.kind) + ' ' + myName).slice(0, DQ.LIM.critterName);
  const c = { id: DQ.rid(), k: mk.kind, nm, bn: myName, bp: room.me, u: uid, at: nowMs(), im: isGM ? 1 : 0, d, sz: DQ.pickSize() };
  if (DQ.PIN_N[mk.kind]) { pinSync(); if (mk.pins) c.pn = mk.pins.map(Math.round); }
  submitting = true; $('submitBtn').disabled = true; let result = null;
  try {
    await room.edit('add', s => {
      const r = DQ.addCreature(s, c, nowMs()); result = r; if (!r.ok) return null;
      DQ.sysChat(s, 'add', room.me, myName, r.c.nm, nowMs()); if (r.culled) DQ.sysChat(s, 'gone', 0, '', r.culled.nm, nowMs());
      DQ.ping(s, room.me, myName, myAv, nowMs(), null); if (isGM) s.gm[DQ.K(room.me)] = 1;
    }, { id: c.id, k: c.k });
    if (!result || !result.ok) { toast(T(result && (result.err === 'full' || result.err === 'space') ? result.err : 'sendFail'), true); return; }
    if (isGM && !gmStore.some(x => x.id === result.c.id)) { gmStore.push(result.c); saveGm(); }
    { const m0 = sim.get(result.c.id); if (!(m0 && m0.arr)) { const m = spawn(result.c, true); if (!m.arr) SFX.splash(); } } closeMaker(); // t346u: keep an already-planned countdown (onRoom may have spawned it first) toast(T('added', { name: result.c.nm }));
    if (result.culled) setTimeout(() => toast(T('culled', { name: result.culled.nm }), true), 400);
  } catch (err) { toast(T(err && err.code === 'toolarge' ? 'tooBig' : 'sendFail'), true); }
  finally { submitting = false; $('submitBtn').disabled = false; }
});

/* ---------- creature info ---------- */
let infoId = null, infoTimer = null;
function openInfo(id) {
  const c = creatures().find(x => x.id === id); if (!c) return; infoId = id;
  drawStill($('infoPic'), c); $('infoName').textContent = c.nm; $('infoImm').hidden = !c.im;
  $('infoKind').textContent = (EMO[c.k] || '') + ' ' + T(c.k);
  $('infoBy').textContent = c.bn;
  try { $('infoAt').textContent = new Date(c.at).toLocaleString(({ id: 'id-ID', en: 'en-GB', zh: 'zh-CN', ja: 'ja-JP', ko: 'ko-KR', ms: 'ms-MY', es: 'es-ES', pt: 'pt-BR', th: 'th-TH' })[lang] || 'en-GB', { dateStyle: 'medium', timeStyle: 'short' }); } catch (e) { $('infoAt').textContent = new Date(c.at).toLocaleString(); }
  const tickAge = () => { const a = DQ.age(nowMs() - c.at); $('infoAge').textContent = T('age_' + a.u, { n: a.n }); };
  tickAge(); clearInterval(infoTimer); infoTimer = setInterval(tickAge, 15000);
  $('renameForm').hidden = !isGM; $('renameInput').value = c.nm; $('renameInput').setAttribute('aria-label', T('rename')); $('renameInput').placeholder = T('rename'); $('infoDel').hidden = !DQ.canDelete(c, { gm: isGM, u: uid }); $('infoPin').hidden = !isGM; paintSize(c); $('infoPin').textContent = T(c.im ? 'unpin' : 'pin'); $('infoPin').classList.toggle('on', !!c.im); $('info').hidden = false; setTimeout(() => $('infoClose').focus(), 30);
}
function paintSize(c) {
  const row = $('infoSizeRow'), box = $('infoSize'); row.hidden = !isGM; if (!isGM) return; box.textContent = ''; const cur = DQ.sizeOf(c);
  DQ.SIZES.forEach((v, i) => { const b = doc.createElement('button'); b.type = 'button'; b.className = 'sz-btn' + (v === cur ? ' on' : ''); b.dataset.sz = String(v); b.setAttribute('aria-pressed', v === cur ? 'true' : 'false'); b.textContent = T('sz' + i); b.style.fontSize = (11 + i * 1.5) + 'px'; b.addEventListener('click', () => setSize(c.id, v)); box.appendChild(b); });
}
async function setSize(id, v) {
  if (!isGM || !room) return; SFX.tap(); gmSizes[id] = v; saveGmSizes();
  try {
    await room.edit('size', s => { const x = s.cr.find(y => y.id === id); if (!x || x.sz === v) return null; x.sz = v; });
    const g = gmStore.find(x => x.id === id); if (g) { g.sz = v; saveGm(); } saveTank();
    const c = creatures().find(x => x.id === id); if (c && infoId === id) paintSize(Object.assign({}, c, { sz: v }));
  } catch (e) { toast(T('sendFail'), true); }
}
function closeInfo() { $('info').hidden = true; infoId = null; clearInterval(infoTimer); if (listReturn) { listReturn = false; openList(); } }
/* ---------- t213u: fish list (newest first); tap a row -> the creature info modal (GM pin / size / delete live there) ---------- */
let listReturn = false, listSig = '';
function listRows() { return creatures().slice().sort((a, b) => (b.at || 0) - (a.at || 0)); }
function renderList(force) {
  if ($('fishList').hidden) return; const rows = listRows(), now = nowMs();
  const sig = lang + '|' + isReady() + '|' + isGM + '|' + Math.floor(now / 30000) + '|' + rows.map(c => c.id + c.im + DQ.sizeOf(c) + c.nm).join(','); if (!force && sig === listSig) return; listSig = sig;
  const np = rows.filter(c => c.im).length; $('fishListSub').textContent = T('fishListSub') + ' · ' + T('count', { n: rows.length - np, max: DQ.MAX_CREATURES }) + ' · ' + T('countPerm', { n: np });
  const ul = $('fishListUl'); ul.textContent = '';
  if (!rows.length) { const li = doc.createElement('li'); li.className = 'flist-empty'; li.textContent = isReady() ? T('fishListEmpty') : T('tankLoading') + '…'; ul.appendChild(li); return; }
  for (const c of rows) {
    const li = doc.createElement('li'), b = doc.createElement('button'); b.type = 'button'; b.className = 'flist-row'; b.dataset.id = c.id;
    const cv = doc.createElement('canvas'); cv.width = 96; cv.height = 72; cv.setAttribute('aria-hidden', 'true'); try { drawStill(cv, c); } catch (e) {}
    const tx = doc.createElement('span'); tx.className = 'flist-tx';
    const nm = doc.createElement('strong'); nm.textContent = (EMO[c.k] || '') + ' ' + c.nm; tx.appendChild(nm);
    const a = DQ.age(now - c.at), meta = doc.createElement('small'); meta.textContent = c.bn + ' · ' + T('age_' + a.u, { n: a.n }); tx.appendChild(meta);
    const tags = doc.createElement('span'); tags.className = 'flist-tags';
    if (c.im) { const t = doc.createElement('em'); t.className = 'tag pin'; t.textContent = '📌 ' + T('pinTag'); tags.appendChild(t); }
    const si = DQ.SIZES.indexOf(DQ.sizeOf(c)); { const t = doc.createElement('em'); t.className = 'tag'; t.textContent = T('size') + ': ' + T('sz' + (si < 0 ? 2 : si)); tags.appendChild(t); }
    tx.appendChild(tags); b.appendChild(cv); b.appendChild(tx);
    b.addEventListener('click', () => { SFX.tap && SFX.tap(); $('fishList').hidden = true; listReturn = true; openInfo(c.id); if ($('info').hidden) listReturn = false; });
    li.appendChild(b); ul.appendChild(li);
  }
}
function openList() { setMenu(false); $('fishList').hidden = false; listSig = ''; renderList(true); setTimeout(() => $('fishListClose').focus(), 30); }
function closeList() { $('fishList').hidden = true; listReturn = false; }
$('listBtn').addEventListener('click', openList); $('listBtn2').addEventListener('click', openList); $('fishListClose').addEventListener('click', closeList);
$('fishList').addEventListener('click', e => { if (e.target === $('fishList')) closeList(); });
doc.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('fishList').hidden) { e.stopImmediatePropagation(); closeList(); } }, true);
$('infoClose').addEventListener('click', closeInfo);
/* t214u: GM renames a creature from the info modal; synced through room state, GM store and tank cache */
$('renameForm').addEventListener('submit', async e => {
  e.preventDefault(); if (!isGM || !room || !infoId) return; const id = infoId, nm = DQ.cleanText($('renameInput').value, DQ.LIM.critterName); if (!nm) { $('renameInput').focus(); return; }
  const cur = creatures().find(x => x.id === id); if (cur && cur.nm === nm) return; $('renameBtn').disabled = true; let done = false;
  try {
    await room.edit('rename', s => { done = DQ.renameCreature(s, id, nm, { gm: true }); return done ? undefined : null; }, { id });
    if (done) { const g = gmStore.find(x => x.id === id); if (g) { g.nm = done; saveGm(); } saveTank(); if (infoId === id) $('infoName').textContent = done; SFX.tap(); toast(T('renamed', { name: done })); }
  } catch (err) { toast(T('sendFail'), true); } finally { $('renameBtn').disabled = false; }
});
$('infoDel').addEventListener('click', async () => {
  const c = creatures().find(x => x.id === infoId); if (!c || !room) return;
  if (!root.confirm(T('delConfirm', { name: c.nm }))) return;
  let gone = null;
  try {
    await room.edit('delete', s => { gone = DQ.deleteCreature(s, c.id, { gm: isGM, u: uid }); if (!gone) return null; DQ.sysChat(s, 'del', room.me, myName, gone.nm, nowMs()); }, { id: c.id });
    if (gone) { gmStore = gmStore.filter(x => x.id !== c.id); saveGm(); sim.delete(c.id); toast(T('deleted', { name: c.nm })); }
    closeInfo();
  } catch (e) { toast(T('sendFail'), true); }
});
$('infoPin').addEventListener('click', async () => {
  const c = creatures().find(x => x.id === infoId); if (!c || !room || !isGM) return;
  const on = !c.im; let r = null;
  try {
    await room.edit(on ? 'pin' : 'unpin', s => { r = DQ.pinCreature(s, c.id, on, { gm: true }); if (!r || !r.ok) return null; for (const g of r.culled) DQ.sysChat(s, 'gone', 0, '', g.nm, nowMs()); }, { id: c.id });
    if (!r || !r.ok) { toast(T(on ? 'space' : 'sendFail'), true); return; }
    if (on) { if (!gmStore.some(x => x.id === c.id)) gmStore.push(Object.assign({}, r.c)); } else gmStore = gmStore.filter(x => x.id !== c.id);
    saveGm(); toast(T(on ? 'pinned' : 'unpinnedT', { name: c.nm })); for (const g of r.culled) toast(T('culled', { name: g.nm }), true);
    openInfo(c.id);
  } catch (e) { toast(T('sendFail'), true); }
});
tank.addEventListener('click', e => {
  if (WP) return; // t243u: wallpaper has no click targets
  const r = tank.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
  for (let i = hits.length - 1; i >= 0; i--) { const h = hits[i]; if (x >= h.x0 && x <= h.x1 && y >= h.y0 && y <= h.y1) { openInfo(h.id); return; } }
});
function openHow() { try { renderStatus(); } catch (e) {} $('how').hidden = false; setTimeout(() => $('howClose').focus(), 30); }
function closeHow() { $('how').hidden = true; $('howBtn').focus(); }
$('howBtn').addEventListener('click', openHow); $('howOk').addEventListener('click', closeHow); $('howClose').addEventListener('click', closeHow);
$('how').addEventListener('click', e => { if (e.target === $('how')) closeHow(); });
doc.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('how').hidden) { e.stopImmediatePropagation(); closeHow(); } }, true);
function stickerBlob(c) {
  const strokes = DQ.decode(c.d), box = bboxOf(strokes, c.k), Q = 2, pad = 12, full = doc.createElement('canvas'); full.width = B.w * Q; full.height = B.h * Q;
  const fctx = full.getContext('2d', { willReadFrequently: true }); fctx.setTransform(Q, 0, 0, Q, 0, 0); paint(fctx, strokes, c.k);
  const [x0, y0, x1, y1] = strokes.some(st => st.m === 'b') ? alphaBox(full, Q) : box, out = doc.createElement('canvas'); out.width = Math.ceil((x1 - x0 + pad * 2) * Q); out.height = Math.ceil((y1 - y0 + pad * 2) * Q);
  out.getContext('2d').drawImage(full, (x0 - pad) * Q, (y0 - pad) * Q, out.width, out.height, 0, 0, out.width, out.height); return out;
}
$('infoDl').addEventListener('click', () => {
  const c = creatures().find(x => x.id === infoId); if (!c) return; SFX.tap();
  const cv = stickerBlob(c), name = (DQ.cleanText(c.nm, 20).replace(/[^\p{L}\p{N}_-]+/gu, '-').replace(/^-+|-+$/g, '') || 'langitbersama') + '-sticker.png';
  const go = url => { const a = doc.createElement('a'); a.href = url; a.download = name; doc.body.appendChild(a); a.click(); a.remove(); };
  if (cv.toBlob) cv.toBlob(b => { if (!b) return go(cv.toDataURL('image/png')); const u = URL.createObjectURL(b); go(u); setTimeout(() => URL.revokeObjectURL(u), 4000); }, 'image/png'); else go(cv.toDataURL('image/png'));
});
root.DQSticker = id => { const c = creatures().find(x => x.id === id); return c ? stickerBlob(c).toDataURL('image/png') : ''; };
function paintMute() { const b = $('muteBtn'); b.textContent = muted ? '🔇' : '🔊'; const t = T(muted ? 'unmute' : 'mute'); b.title = t; b.setAttribute('aria-label', t); b.setAttribute('aria-pressed', muted ? 'true' : 'false'); }
$('muteBtn').addEventListener('click', () => { muted = !muted; setLS('langitbersama.mute', muted ? '1' : '0'); paintMute(); ambGesture(); ambSync(); if (!muted) SFX.tap(); muteFlash(); });
/* t244u: brief big 🔊/🔇 at top-right on every toggle (button or wallpaper M) — fades after ~1.3 s */
function muteFlash() { let el = $('muteFlash'); if (!el) { el = doc.createElement('div'); el.id = 'muteFlash'; el.setAttribute('aria-hidden', 'true'); doc.body.appendChild(el); }
  el.textContent = muted ? '🔇' : '🔊'; el.classList.remove('show'); void el.offsetWidth; el.classList.add('show'); clearTimeout(muteFlash.t); muteFlash.t = setTimeout(() => el.classList.remove('show'), 1300); }
// t214u: the create/draw modal never closes from a backdrop tap or Esc (only Batal / submit), so a drawing is not lost by accident
$('info').addEventListener('click', e => { if (e.target === $('info')) closeInfo(); });
doc.addEventListener('keydown', e => { if (e.key !== 'Escape') return; if (!$('info').hidden) closeInfo(); else if (!$('maker').hidden) e.preventDefault(); else if (!$('gate').hidden && myName && room) $('gate').hidden = true; });
root.addEventListener('beforeunload', e => { if (!$('maker').hidden && !$('drawStep').hidden && mk.strokes.length) { e.preventDefault(); e.returnValue = ''; } });

/* t325u: the name gate also asks for the language — 9 chips (same LANGS / KEYS.lang / applyLang as the 🌐 header picker).
   Default = saved choice or the browser guess (detectLang); a tap switches the whole UI live and saves it; Masuk saves the shown one too. */
if ($('langPick')) $('langPick').addEventListener('keydown', e => { const d = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0; if (!d) return; e.preventDefault(); const i = (LANGS.indexOf(lang) + d + LANGS.length) % LANGS.length; $('langPick').children[i].click(); });
function renderGateLang() {
  const box = $('langPick'); if (!box) return; $('gateLangTxt').textContent = T('uiLang') + (lang === 'en' ? '' : ' · Language');
  if (!box.children.length) for (const l of LANGS) { const b = doc.createElement('button'); b.type = 'button'; b.setAttribute('role', 'radio'); b.dataset.l = l; b.lang = l; b.textContent = CFG.text[l].langName;
    b.addEventListener('click', () => { if (lang === l) return; lang = l; setLS(KEYS.lang, l); applyLang(); b.focus(); }); box.appendChild(b); }
  for (const b of box.children) { const on = b.dataset.l === lang; b.setAttribute('aria-checked', String(on)); b.tabIndex = on ? 0 : -1; }
}
/* ---------- i18n ---------- */
function applyLang() {
  doc.documentElement.lang = lang;
  doc.querySelectorAll('[data-t]').forEach(el => { el.textContent = T(el.dataset.t); });
  doc.querySelectorAll('[data-tp]').forEach(el => { el.placeholder = T(el.dataset.tp); });
  doc.querySelectorAll('[data-ta]').forEach(el => { el.setAttribute('aria-label', T(el.dataset.ta)); el.title = T(el.dataset.ta); });
  paintMute(); 
  { const t = T('menu'); $('menuBtn').title = t; $('menuBtn').setAttribute('aria-label', t); $('histClose').setAttribute('aria-label', T('close')); }
  { const t = T('howOpen'); $('howBtn').title = t; $('howBtn').setAttribute('aria-label', t); $('howClose').setAttribute('aria-label', T('close')); }
  const ol = $('howList'); ol.textContent = ''; for (const s of (CFG.text[lang] || CFG.text.id).how) { const li = doc.createElement('li'); li.textContent = s; ol.appendChild(li); }
  const sel = $('langSel'); if (!sel.options.length) for (const l of LANGS) { const o = doc.createElement('option'); o.value = l; o.textContent = CFG.text[l].langName; sel.appendChild(o); }
  sel.value = lang; if (!$('drawStep').hidden) { $('drawTitle').textContent = EMO[mk.kind] + ' ' + T('draw_' + mk.kind); $('critterLabel').textContent = T('critterName'); }
  paintWind();
  renderGateLang(); chatSig = ''; renderStatus(); renderChat();
}
$('langSel').addEventListener('change', e => { lang = e.target.value; setLS(KEYS.lang, lang); applyLang(); });

/* ---------- boot ---------- */
applyLang();
if (root.ResizeObserver) { const ro = new ResizeObserver(() => resize()); ro.observe(tank); ro.observe(walk); } else root.addEventListener('resize', () => resize());
{ const sc = $('tankScroll'); const centre = () => { if (sc.scrollWidth > sc.clientWidth + 4) sc.scrollLeft = (sc.scrollWidth - sc.clientWidth) / 2; measureView(); }; setTimeout(centre, 60);
  sc.addEventListener('scroll', () => { PERF.scrollAt = performance.now(); if (!sc.__pv) { sc.__pv = 1; root.requestAnimationFrame(() => { sc.__pv = 0; measureView(); }); } }, { passive: true }); }
root.addEventListener('resize', () => resize());
/* t307u: pause drawing the sky / walk when scrolled out of view (sim keeps stepping), throttle behind open dialogs */
if (root.IntersectionObserver) { const io = new IntersectionObserver(es => { for (const e of es) { if (e.target === tank) PERF.tankVis = e.isIntersecting; else if (e.target === walk) PERF.walkVis = e.isIntersecting; } }); io.observe(tank); io.observe(walk); }
{ const mods = () => [...doc.querySelectorAll('.modal')]; const chk = () => { PERF.modal = mods().some(m => !m.hidden && m.id !== 'gate' && m.style.display !== 'none'); }; if (root.MutationObserver) { const mo = new MutationObserver(chk); for (const m of mods()) mo.observe(m, { attributes: true, attributeFilter: ['hidden', 'style'] }); } chk(); }
resize(); root.requestAnimationFrame(frame);
setInterval(() => { PERF.bfxDirty = true; if (room) { room.tick(); syncVisitors(visitors()); renderStatus(); try { renderList(); } catch (e) {} } }, 1000);
/* ---------- typed gamemaster claim (BE: POST rooms/{code}/gamemaster {code}; badge = players[].gamemaster) ----------
   No visible chip: a ?gmjd query param (short trigger, not the secret) auto-opens a password-style prompt once in an online room.
   The typed code is never put in the URL or storage. ?gmjd alone grants nothing. */
function gmClaimUI({ canClaim, claim, onDone, listKey }) {
  const d = document, w = window;
  const m = d.createElement('div'); m.id = 'gmClaim'; m.setAttribute('role', 'dialog'); m.setAttribute('aria-modal', 'true'); m.setAttribute('aria-label', 'Kode gamemaster');
  m.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.45);display:none;align-items:center;justify-content:center';
  m.innerHTML = '<form id="gmClaimForm" style="background:#fff;color:#222;padding:16px;border-radius:14px;width:260px;max-width:86vw;font:14px system-ui,sans-serif;box-shadow:0 8px 30px rgba(0,0,0,.3)">'
    + '<b style="display:block;margin-bottom:8px">Kode gamemaster</b>'
    + '<input id="gmClaimInput" type="password" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Masukkan kode" maxlength="128" style="width:100%;box-sizing:border-box;padding:8px;border:1px solid #bbb;border-radius:8px;font:inherit;color:#222;background:#fff">'
    + '<p id="gmClaimErr" role="alert" style="color:#c0392b;min-height:1.2em;margin:6px 0;font-size:13px"></p>'
    + '<div style="display:flex;gap:8px;justify-content:flex-end"><button type="button" id="gmClaimCancel" style="padding:6px 12px;border-radius:8px;border:1px solid #bbb;background:#f3f3f3;color:#222;font:inherit">Batal</button>'
    + '<button type="submit" id="gmClaimOk" style="padding:6px 12px;border-radius:8px;border:0;background:#c0392b;color:#fff;font:600 14px system-ui,sans-serif">Masuk</button></div></form>';
  d.body.appendChild(m);
  const inp = m.querySelector('#gmClaimInput'), er = m.querySelector('#gmClaimErr'), ok = m.querySelector('#gmClaimOk');
  // no visible chip: only a ?gmjd query param (not the secret; value ignored) arms the prompt; intent survives the home/gate screen until a room is entered
  const trig = () => /[?&]gmjd(=|&|$)/i.test(w.location.search || '');
  let busy = false, want = trig(), asked = false;
  const close = () => { m.style.display = 'none'; inp.value = ''; er.textContent = ''; };
  const open = () => { if (!canClaim()) return; er.textContent = ''; inp.value = ''; m.style.display = 'flex'; setTimeout(() => inp.focus(), 20); };
  m.addEventListener('click', e => { if (e.target === m) close(); });
  m.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Escape') close(); });
  m.addEventListener('keyup', e => e.stopPropagation());
  m.querySelector('#gmClaimCancel').addEventListener('click', close);
  m.querySelector('#gmClaimForm').addEventListener('submit', async e => {
    e.preventDefault(); e.stopPropagation(); const code = inp.value.trim(); if (!code || busy) { inp.focus(); return; }
    busy = true; ok.disabled = true; er.textContent = '';
    try {
      await claim(code); want = false; close();
      // strip ?gmjd so a refresh doesn't re-prompt (other params like ?room= are kept)
      if (trig() && w.history && w.history.replaceState) { const u = new URL(w.location.href); for (const k of [...u.searchParams.keys()]) if (k.toLowerCase() === 'gmjd') u.searchParams.delete(k); w.history.replaceState(w.history.state, '', u.pathname + u.search + u.hash); }
      sync(); if (onDone) onDone();
    }
    catch (x) { inp.value = ''; er.textContent = x && x.status === 403 ? 'Kode salah.' : 'Gagal, coba lagi.'; inp.focus(); }
    finally { busy = false; ok.disabled = false; }
  });
  function sync() {
    const on = !!canClaim();
    if (!on) { asked = false; if (m.style.display !== 'none' && !busy) close(); return; }
    if (want && !asked) { asked = true; open(); }
  }
  return { sync, open, close };
}
gmUI = gmClaimUI({ listKey: N.GM_KEY, canClaim: () => mode === 'online' && !!room && !!room.data && !room.local && !room.isGamemaster(), claim: code => room.claimGamemaster(code), onDone: () => { toast('Mode gamemaster aktif'); gmRefresh(); } });
root.addEventListener('pagehide', () => { if (room && !room.local) { saveTank(); conn.leaveBeacon(); } });
root.addEventListener('pageshow', e => { if (e.persisted && room && !room.local) { room = null; synced = false; chatSig = ''; try { renderStatus(); renderChat(); } catch (x) {} connect(); } });
doc.addEventListener('visibilitychange', () => { if (doc.visibilityState === 'visible' && conn.config) { conn.visible(); if (room && !room.local) hello(false).catch(() => {}); } });
if (WP) { if (!myName) myName = 'Wallpaper'; connect(); doc.addEventListener('keydown', e => { if (e.ctrlKey || e.metaKey || e.altKey) return; if (e.key === 'm' || e.key === 'M') $('muteBtn').click(); else if (e.key === 'f' || e.key === 'F') fsToggle(); }); wpFsHint(); } // t243u: spectator-ish, name not saved; M toggles sound
else if (myName && (() => { try { return navigator.webdriver && !localStorage.getItem('jdng.force') ? '1' : sessionStorage.getItem('jdng.langitbersama'); } catch (x) { return ''; } })()) connect(); else openGate(); // t367u: name modal first on every new visit (tab session)
/* t244u: wallpaper fullscreen — F key / double-click / tap the hint chip; Esc exits (browser). Mac: Control+⌘+F or the green button also work. */
function fsEl() { return doc.fullscreenElement || doc.webkitFullscreenElement || null; }
function fsCan() { const d = doc.documentElement; return !!(d.requestFullscreen || d.webkitRequestFullscreen); }
function fsToggle() { const d = doc.documentElement; try { if (fsEl()) { (doc.exitFullscreen || doc.webkitExitFullscreen).call(doc); return; } const r = d.requestFullscreen ? d.requestFullscreen() : d.webkitRequestFullscreen && d.webkitRequestFullscreen(); if (r && r.catch) r.catch(() => {}); } catch (e) { /* not allowed */ } }
function wpFsHint() {
  const mac = /Mac|iPhone|iPad/i.test(navigator.platform || navigator.userAgent || ''), en = lang !== 'id', can = fsCan();
  const el = doc.createElement('button'); el.type = 'button'; el.id = 'fsHint';
  el.textContent = '⛶ ' + (en ? (can ? 'Fullscreen: press F / double-click' : 'Fullscreen') : (can ? 'Layar penuh: tekan F / klik 2x' : 'Layar penuh')) + (mac ? ' · Mac: Control+⌘+F' : ' · F11');
  doc.body.appendChild(el); el.addEventListener('click', e => { e.stopPropagation(); fsToggle(); });
  const show = ms => { el.classList.add('show'); clearTimeout(wpFsHint.t); wpFsHint.t = setTimeout(() => el.classList.remove('show'), ms); };
  setTimeout(() => show(7000), 300);
  doc.addEventListener('dblclick', e => { if (e.target !== el) fsToggle(); });
  const onFs = () => { if (fsEl()) { clearTimeout(wpFsHint.t); el.classList.remove('show'); } else show(3500); };
  doc.addEventListener('fullscreenchange', onFs); doc.addEventListener('webkitfullscreenchange', onFs);
}
root.DQFs = { toggle: fsToggle, can: fsCan, el: fsEl };

root.DQApp = { roomCheck: f => { if (f) lastHop = 0; return roomCheck(); }, pickRoom, pinsOf: id => { const c = creatures().find(x => x.id === id); return c ? pinsOf(c, sprite(c)) : null; }, inkOf: id => { const c = creatures().find(x => x.id === id); return c ? inkScan(sprite(c).cv, SPR_Q) : null; }, openList, setMenu, setHist, balloons: () => [...chatBalloons()], get room() { return room; }, get mk() { return mk; }, redraw: () => redraw(), get mode() { return mode; }, sim, walkers, hits: () => hits, get gmStore() { return gmStore; }, conn, openInfo, dbg: () => ({ isGM, gmSizes }) };
})(window);

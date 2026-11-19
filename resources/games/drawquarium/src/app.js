/* Drawquarium: UI, i18n (id/en), tank + walkway animation, drawing board, open chat, presence, GM persistence. */
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
const KEYS = { name: 'drawquarium.name', av: 'drawquarium.av', lang: 'drawquarium.lang', uid: 'drawquarium.uid', gm: 'drawquarium.gm', tank: 'drawquarium.tank' };
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
/* Name follows the Jadidaring account (window.__JD_ME, injected by the server); it is never typed in-game.
   Guests play as "Tamu" (saving needs login, the server answers 401 and the site shows the login prompt).
   Without the server bridge (local file) the old name gate still works. */
const JDME = (() => { try { const m = window.__JD_ME; return m && typeof m === 'object' ? m : null; } catch (x) { return null; } })();
const accountName = () => (JDME && JDME.in ? DQ.cleanText(JDME.name, DQ.LIM.nameMax) : '') || 'Tamu';
if (JDME) myName = accountName();
function nameLockNote() {
  const inp = $('nameInput'); if (!JDME || !inp) return; inp.value = accountName(); inp.readOnly = true; inp.setAttribute('aria-readonly', 'true'); inp.style.opacity = '.75';
  let n = $('nameLock'); if (!n) { n = doc.createElement('small'); n.id = 'nameLock'; n.style.cssText = 'font-weight:400;font-size:13px;opacity:.8'; inp.insertAdjacentElement('afterend', n); }
  const id = lang === 'id', next = encodeURIComponent('/game/drawquarium');
  n.innerHTML = JDME.in ? (id ? 'Nama mengikuti akun Jadidaring. Ganti di <a href="/akun" target="_top">Akun</a>.' : 'Your name follows your Jadidaring account. Change it in <a href="/akun" target="_top">Account</a>.')
    : (id ? 'Kamu main sebagai Tamu. <a href="/masuk?next=' + next + '" target="_top">Masuk</a> supaya namamu ikut akun dan karyamu tersimpan.' : 'You are playing as a guest. <a href="/masuk?next=' + next + '" target="_top">Log in</a> to use your account name and save.');
}
let myAv = Math.max(0, Math.min(CFG.avatars.length - 1, parseInt(getLS(KEYS.av), 10) || 0));
const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const hashStr = s => { let h = 2166136261; for (const ch of String(s)) { h ^= ch.codePointAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };

/* ---------- toasts ---------- */
/* ---------- soft WebAudio SFX (no assets) ---------- */
let muted = getLS('drawquarium.mute') === '1', actx = null, lastSfx = {};
function ac() { if (muted) return null; try { if (!actx) { const A = root.AudioContext || root.webkitAudioContext; if (!A) return null; actx = new A(); } if (actx.state === 'suspended') actx.resume(); return actx; } catch (e) { return null; } }
function tone(f0, f1, dur, vol, type, delay) {
  const a = ac(); if (!a) return; const t = a.currentTime + (delay || 0), o = a.createOscillator(), g = a.createGain();
  o.type = type || 'sine'; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.015); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(a.destination); o.start(t); o.stop(t + dur + 0.05);
}
const SFX = {
  ok(k, gap) { const n = Date.now(); if (muted || doc.visibilityState === 'hidden' || n - (lastSfx[k] || 0) < gap) return false; lastSfx[k] = n; return true; },
  tick(n) { if (!this.ok('tick' + n, 300)) return; const f = n === 1 ? 1175 : 784; tone(f, f, 0.09, 0.035, 'sine'); tone(f * 2, f * 2, 0.05, 0.01, 'sine', 0.005); }, // t330u countdown
  whoosh() { if (!this.ok('whoosh', 500)) return; tone(1100, 260, 0.32, 0.025, 'triangle'); },
  splash() { if (!this.ok('splash', 600)) return; const a = ac(); if (!a) return; const len = 0.35, b = a.createBuffer(1, Math.floor(a.sampleRate * len), a.sampleRate), d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 3); const src = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain(); f.type = 'lowpass'; f.frequency.value = 900; g.gain.value = 0.09; src.buffer = b; src.connect(f); f.connect(g); g.connect(a.destination); src.start(); tone(500, 180, 0.25, 0.05, 'sine', 0.02); },
  ping() { if (!this.ok('ping', 1500)) return; tone(880, 1320, 0.12, 0.04); tone(1320, 1500, 0.1, 0.03, 'sine', 0.09); },
  tap() { if (!this.ok('tap', 80)) return; tone(700, 900, 0.05, 0.025, 'triangle'); },
};
/* ---------- t241u→t246u: cozy procedural aquarium soundscape (no assets, no musical pad). "Warm living-room tank at night":
   1) room tone: brown noise → LP 170 Hz (felt more than heard) + a far-away filter hush (pink-ish noise → BP 1.6 kHz, barely there)
   2) water lap: brown noise → BP ~520 Hz whose level swells on two slow, unrelated LFOs (0.11/0.173 Hz) + filter drift; plus a
      "filter trickle" — tiny resonant noise grains (1.4–3.8 kHz) arriving in phrases (random-walk density), panned
   3) organic bubble pops (Minnaert-style: sine whose pitch rises as it surfaces + a 6 ms airy click), singles + clusters, stereo
   4) food drop: wet plip + soft settle puff   5) seabed burst: rising blups + airy tail (both panned to where they happen on screen)
   All through AMB.bus (fades with mute/visibility), every voice enveloped; mostly quiet bed, occasional life. */
const AMB = { vol: 0.6, on: false, target: 0, bus: null, timer: 0, tr: 0, dens: 0.3, gest: false, susp: 0, wn: null };
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
  AMB.ev = a.createGain(); AMB.ev.gain.value = 3; AMB.ev.connect(bus); // event/bubble voices sit ~8 dB over the bed peaks
  const brown = nbuf(a, 7, true, 2), pink = nbuf(a, 5, false, 2); AMB.wn = nbuf(a, 1, false, 1).b;
  // 1) room tone + distant filter hush
  { const s = loopSrc(a, brown, 0), lp = filt(a, 'lowpass', 170, 0.3), hp = filt(a, 'highpass', 38, 0.5), g = a.createGain(); g.gain.value = 0.07; s.connect(lp); lp.connect(hp); hp.connect(g); g.connect(bus); }
  { const s = loopSrc(a, pink, 1.3), bp = filt(a, 'bandpass', 1600, 0.45), lp = filt(a, 'lowpass', 3200, 0.3), g = a.createGain(); g.gain.value = 0.006; s.connect(bp); bp.connect(lp); lp.connect(g); g.connect(bus); lfo(a, 0.023, 0.0018, g.gain); }
  // 2) water lap: level swells on two slow unrelated LFOs, filter drifts
  { const s = loopSrc(a, brown, 3.1), bp = filt(a, 'bandpass', 520, 0.85), lp = filt(a, 'lowpass', 1400, 0.4), g = a.createGain(); g.gain.value = 0.05;
    lfo(a, 0.11, 0.026, g.gain); lfo(a, 0.173, 0.016, g.gain); lfo(a, 0.067, 150, bp.frequency); s.connect(bp); bp.connect(lp); lp.connect(g); g.connect(bus); }
}
const ambLive = () => !!(AMB.on && actx && AMB.bus && actx.state === 'running');
function panOut(a, node, pan) { if (!a.createStereoPanner) return node; const p = a.createStereoPanner(); p.pan.value = clamp(pan, -0.9, 0.9); node.connect(p); return p; }
function env(g, t, v, att, dec) { g.gain.value = 0; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, v), t + att); g.gain.exponentialRampToValueAtTime(0.0001, t + att + dec); }
/** noise grain: bandpassed slice of shared noise, enveloped */
function grain(a, t, f, q, v, att, dec, pan, type) {
  const s = a.createBufferSource(), bf = filt(a, type || 'bandpass', f, q), g = a.createGain(); s.buffer = AMB.wn; env(g, t, v, att, dec);
  s.connect(bf); bf.connect(g); panOut(a, g, pan).connect(AMB.ev); s.start(t, Math.random() * 0.8, att + dec + 0.05);
}
/** one bubble: sine whose pitch rises as it surfaces (bigger = lower + longer), tiny airy click on the release */
function bub(a, t, f, v, pan, d, rise) {
  const o = a.createOscillator(), g = a.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(f * (rise || rand(1.25, 1.7)), t + d);
  env(g, t, v, 0.004, d); o.connect(g); panOut(a, g, pan).connect(AMB.ev); o.start(t); o.stop(t + d + 0.05);
  grain(a, t + d * 0.2, rand(3000, 5200), 0.9, v * 0.22, 0.002, 0.006, pan, 'highpass');
}
function ambBubble() {
  if (!ambLive()) return; const a = actx, t0 = a.currentTime + 0.02, cl = Math.random() < 0.32, n = cl ? 2 + (Math.random() * 4 | 0) : 1, pan = rand(-0.7, 0.7), fc = rand(320, 760);
  for (let i = 0, t = t0; i < n; i++, t += rand(0.04, 0.14)) { const f = fc * rand(0.8, 1.3), d = clamp(36 / f, 0.045, 0.11); bub(a, t, f, rand(0.006, cl ? 0.014 : 0.018), pan + rand(-0.15, 0.15), d); }
}
function ambTick() { clearTimeout(AMB.timer); if (!AMB.on) return; ambBubble(); AMB.timer = setTimeout(ambTick, rand(2200, 7000)); }
/** filter trickle: phrases of tiny resonant droplets; density random-walks so it comes and goes */
function ambTrickle() {
  clearTimeout(AMB.tr); if (!AMB.on) return; AMB.dens = clamp(AMB.dens + rand(-0.06, 0.06), 0.05, 0.55);
  if (ambLive() && Math.random() < AMB.dens) { const a = actx, t = a.currentTime + 0.01; grain(a, t, rand(1400, 3800), rand(6, 11), rand(0.01, 0.026), 0.004, rand(0.03, 0.07), rand(-0.5, 0.5)); }
  AMB.tr = setTimeout(ambTrickle, rand(70, 170));
}
const xPan = x => (clamp(x, 0, 1) - 0.5) * 1.5;
/* t244u: event sounds (only while the ambient bed is live → same mute / visibility / fade rules) */
const LIFE = {
  last: {}, ok(k, gap) { const n = Date.now(); if (!ambLive() || n - (this.last[k] || 0) < gap) return false; this.last[k] = n; return true; },
  plip(x) { if (!this.ok('plip', 140)) return; const a = actx, t = a.currentTime + 0.01, p = xPan(x), f = rand(1100, 1700);
    bub(a, t, f, rand(0.012, 0.018), p, 0.03, rand(1.4, 1.8)); // wet surface plip
    const o = a.createOscillator(), g = a.createGain(); o.frequency.setValueAtTime(rand(360, 430), t + 0.008); o.frequency.exponentialRampToValueAtTime(210, t + 0.07); env(g, t + 0.008, 0.007, 0.004, 0.06); o.connect(g); panOut(a, g, p).connect(AMB.ev); o.start(t); o.stop(t + 0.12);
    grain(a, t + 0.02, 900, 0.8, 0.004, 0.01, 0.12, p); },
  settle(x) { if (!this.ok('settle', 900)) return; const a = actx, t = a.currentTime + 0.01; grain(a, t, rand(420, 560), 1.1, 0.02, 0.03, 0.2, xPan(x), 'bandpass'); },
  nibble(x) { if (!this.ok('nib', 350)) return; const a = actx; bub(a, a.currentTime + 0.01, rand(650, 900), 0.008, xPan(x), 0.04, 1.3); },
  burst(x, n) { if (!this.ok('burst', 2500)) return; const a = actx, p = xPan(x); let t = a.currentTime + 0.03, f = rand(240, 380);
    for (let i = 0; i < n; i++) { bub(a, t, f * rand(0.92, 1.08), rand(0.011, 0.02), p + rand(-0.12, 0.12), clamp(40 / f, 0.05, 0.14), rand(1.6, 2.2)); f *= rand(1.04, 1.12); t += rand(0.045, 0.11); }
    grain(a, a.currentTime + 0.05, rand(3600, 4600), 0.7, 0.012, 0.09, 0.6, p); },
};
function ambSync() {
  const want = !muted && AMB.gest && doc.visibilityState !== 'hidden';
  if (want) { const a = ac(); if (!a) return; try { if (!AMB.bus) ambBuild(a); } catch (e) { return; } clearTimeout(AMB.susp); }
  if (!actx || !AMB.bus) { AMB.on = false; AMB.target = 0; return; }
  const a = actx, t = a.currentTime, g = AMB.bus.gain; AMB.target = want ? AMB.vol : 0;
  g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.linearRampToValueAtTime(AMB.target, t + (want ? 1 : 0.6));
  if (want && !AMB.on) { AMB.on = true; AMB.timer = setTimeout(ambTick, 1500); AMB.tr = setTimeout(ambTrickle, 400); }
  if (!want) { AMB.on = false; clearTimeout(AMB.timer); clearTimeout(AMB.tr); clearTimeout(AMB.susp); AMB.susp = setTimeout(() => { if (!AMB.on && actx && actx.state === 'running') actx.suspend().catch(() => {}); }, 900); }
}
function ambGesture() { if (AMB.gest) return; AMB.gest = true; ambSync(); }
['pointerdown', 'keydown', 'touchstart'].forEach(ev => doc.addEventListener(ev, ambGesture, { capture: true, passive: true }));
doc.addEventListener('visibilitychange', ambSync);
root.DQAmb = { state: () => ({ on: AMB.on, target: AMB.target, built: !!AMB.bus, gest: AMB.gest, ctx: actx ? actx.state : 'none' }), sync: ambSync };
function toast(msg, warn) {
  const el = doc.createElement('div'); el.className = 'toast' + (warn ? ' warn' : ''); el.textContent = msg; $('toasts').appendChild(el);
  setTimeout(() => el.remove(), warn ? 4800 : 3200);
}

/* ---------- silhouettes (board coords 480x360; fish faces right) ---------- */
const P2 = () => new Path2D();
const FISH = (() => {
  const body = P2(); body.ellipse(295, 185, 140, 88, 0, 0, Math.PI * 2);
  const tail = P2(); tail.moveTo(178, 185); tail.quadraticCurveTo(120, 140, 52, 92); tail.quadraticCurveTo(82, 185, 52, 278); tail.quadraticCurveTo(120, 230, 178, 185); tail.closePath();
  const fin = P2(); fin.moveTo(232, 112); fin.quadraticCurveTo(275, 38, 348, 104); fin.closePath();
  const fin2 = P2(); fin2.moveTo(262, 262); fin2.quadraticCurveTo(292, 312, 334, 266); fin2.closePath();
  const eye = P2(); eye.arc(382, 166, 11, 0, Math.PI * 2);
  return { fill: [tail, fin, fin2, body], guide: [eye], box: [52, 38, 435, 312], wagX: 228 };
})();
const JELLY = (() => {
  const bell = P2(); bell.moveTo(95, 205); bell.bezierCurveTo(95, 28, 385, 28, 385, 205);
  for (let i = 0; i < 6; i++) { const x0 = 385 - i * 48.33, x1 = x0 - 48.33; bell.quadraticCurveTo((x0 + x1) / 2, 228, x1, 205); }
  bell.closePath();
  const tents = []; for (let i = 0; i < 6; i++) { const x0 = 122 + i * 47; const t = P2(); t.moveTo(x0, 218); t.bezierCurveTo(x0 - 20, 258, x0 + 20, 298, x0, 342); tents.push(t); }
  return { fill: [bell], guide: tents, box: [95, 40, 385, 228], bellY: 212, cx: 240 };
})();
const SHAPE = k => k === 'jelly' ? JELLY : FISH;
function drawGuide(ctx, kind, strong) {
  const S = SHAPE(kind); ctx.save(); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  ctx.fillStyle = strong ? 'rgba(120,150,165,.26)' : 'rgba(120,150,165,.2)'; for (const p of S.fill) ctx.fill(p); // t214u: grey see-through silhouette so white paint shows
  ctx.setLineDash([9, 8]); ctx.lineWidth = 3; ctx.strokeStyle = '#6fa6bb'; for (const p of S.fill) ctx.stroke(p); for (const p of S.guide) ctx.stroke(p);
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

/* ---------- tank simulation (client-side; positions are not synced) ---------- */
const tank = $('tank'), tctx = tank.getContext('2d'), walk = $('walk'), wctx = walk.getContext('2d');
/* t325u flicker/perf: pixel budget for the (3x wide on phones) tank backing store, visible-window culling while not panning, frozen frame behind dialogs, dirty-only balloon overlay */
const COARSE = (() => { try { return root.matchMedia('(pointer:coarse)').matches || root.innerWidth <= 900; } catch (e) { return false; } })();
const PX_BUDGET = COARSE ? 1.9e6 : 4.2e6;
const PERF = { vx0: 0, vx1: 1e9, cull: false, scrollAt: 0, modal: false, frozen: false, balDirty: true, resizes: 0, rebuilds: 0 };
let TW = 800, TH = 450, WW = 800, WH = 120, DPR = 1, WDPR = 1, bgCanvas = null;
const sim = new Map(); // id -> motion
/* t209u: the swim area is a bit larger than the visible tank (the canvas clips), so creatures use the edges and corners instead of crowding the middle */
const SWIM = { x0: -0.05, x1: 1.05, y0: -0.03, y1: 0.84, tx0: -0.03, tx1: 1.03, ty0: 0.03, ty1: 0.8 };
const FISH_SPEED = [0.018, 0.05, 0.13], FISH_AMP = [0, 5, 16], FISH_FREQ = [0, 4.5, 12];
function spawn(c, fresh) {
  const m = { id: c.id, k: c.k, x: rand(0.02, 0.98), y: rand(0.08, 0.76), vx: 0, vy: 0, tx: 0.5, ty: 0.4, mode: 1, modeT: rand(1, 4), targetT: 0, face: Math.random() < 0.5 ? -1 : 1, faceS: 1, amp: 0, freq: 0, phase: rand(0, 6), seed: rand(0, 10), born: performance.now() };
  m.faceS = m.face;
  if (c.k === 'jelly') { m.T = rand(3.0, 4.4); m.t = rand(0, m.T); m.rest = false; m.vy = 0; m.c = 0; m.drift = rand(-0.01, 0.01); }
  if (fresh && dropPlan(c, m)) { /* t330u: countdown → thrown in from above (tanklife.js) */ } else if (fresh) { m.x = rand(0.38, 0.62); m.y = 0.07; m.vy = 0.025; m.splash = 1; m.fa = 0; m.fin = 1; for (let i = 0; i < 9; i++) bursts.push({ x: m.x + rand(-0.025, 0.025), y: m.y + rand(0.02, 0.08), d: i * 0.08, r: rand(1.2, 3), s: rand(0.05, 0.1), w: rand(0, 6) }); } // t323u: new creatures fade in gently with a puff of bubbles
  newTarget(m); sim.set(c.id, m); return m;
}
function newTarget(m) {
  const r = Math.random();
  if (TL.N > 0.3 && Math.random() < TL.N * 0.85 && !m.feed) { m.tx = rand(SWIM.tx0, SWIM.tx1); m.ty = rand(0.5, SWIM.ty1); m.targetT = rand(8, 16); return; } // t323u: at night fish settle low, near the plants
  if (r < 0.3) { m.tx = Math.random() < 0.5 ? rand(SWIM.tx0, 0.12) : rand(0.88, SWIM.tx1); m.ty = Math.random() < 0.5 ? rand(SWIM.ty0, 0.18) : rand(0.62, SWIM.ty1); } // corner
  else if (r < 0.55) { if (Math.random() < 0.5) { m.tx = Math.random() < 0.5 ? rand(SWIM.tx0, 0.1) : rand(0.9, SWIM.tx1); m.ty = rand(SWIM.ty0, SWIM.ty1); } else { m.tx = rand(SWIM.tx0, SWIM.tx1); m.ty = Math.random() < 0.5 ? rand(SWIM.ty0, 0.14) : rand(0.68, SWIM.ty1); } } // an edge
  else { m.tx = rand(SWIM.tx0, SWIM.tx1); m.ty = rand(SWIM.ty0, SWIM.ty1); }
  m.targetT = rand(5, 12);
}
function pickMode(m) { if (TL.N > 0.5 && !m.feed) { m.follow = null; m.mode = Math.random() < 0.65 ? 0 : 1; m.modeT = rand(5, 10); return; } /* t323u: sleepy at night */ if (m.k !== 'jelly' && Math.random() < 0.22 * (1 - TL.N)) { const others = [...sim.values()].filter(o => o !== m && o.k !== 'jelly'); if (others.length) { const o = others[Math.floor(Math.random() * others.length)]; m.follow = o.id; m.chase = Math.random() < 0.45; m.mode = m.chase ? 2 : 1; m.modeT = rand(3, 6); if (m.chase) { o.mode = 2; o.modeT = m.modeT; newTarget(o); } return; } } m.follow = null; const r = Math.random(); m.mode = r < 0.4 ? 0 : r < 0.85 ? 1 : 2; m.modeT = m.mode === 2 ? rand(1.2, 2.6) : m.mode === 1 ? rand(3, 6) : rand(3, 7); if (m.mode === 2) newTarget(m); }
function stepFish(m, dt) {
  m.modeT -= dt; if (m.modeT <= 0) pickMode(m);
  if (m.feed) feedFish(m, dt);
  if (m.follow) { const o = sim.get(m.follow); if (!o) m.follow = null; else { const back = m.chase ? 0.02 : 0.07; m.tx = clamp(o.x - (o.face || 1) * back, SWIM.x0, SWIM.x1); m.ty = clamp(o.y + (m.chase ? 0 : 0.04), SWIM.y0, SWIM.y1); m.targetT = 1; } }
  m.targetT -= dt; const dx = m.tx - m.x, dy = (m.ty - m.y) * TH / TW, dist = Math.hypot(dx, dy);
  if (!m.follow && !(m.feed && m.feedDelay <= 0) && (dist < 0.03 || m.targetT <= 0)) newTarget(m);
  const sp = FISH_SPEED[m.mode] * (m.feed ? 1 : 1 - 0.45 * TL.N), k = Math.min(1, dt * (m.mode === 2 ? 3 : 1.4)); // t323u: slower at night
  m.vx += ((dx / (dist || 1)) * sp - m.vx) * k; m.vy += ((dy / (dist || 1)) * sp * 0.6 - m.vy) * k;
  if (m.splash) { m.vy = Math.max(m.vy, 0.018); if (m.y > 0.24) m.splash = 0; }
  m.x += m.vx * dt; m.y += m.vy * dt * TW / TH;
  if (m.x < SWIM.x0) { m.x = SWIM.x0; m.vx = Math.abs(m.vx); } if (m.x > SWIM.x1) { m.x = SWIM.x1; m.vx = -Math.abs(m.vx); }
  m.y = clamp(m.y, SWIM.y0, SWIM.y1);
  if (m.vx > 0.004) m.face = 1; else if (m.vx < -0.004) m.face = -1;
  m.faceS += (m.face - m.faceS) * Math.min(1, dt * 5);
  const speed = Math.hypot(m.vx, m.vy), lvl = speed < 0.028 ? 0 : speed < 0.08 ? 1 : 2; m.lvl = lvl;
  m.amp += (FISH_AMP[lvl] - m.amp) * Math.min(1, dt * 3); m.freq += (FISH_FREQ[lvl] - m.freq) * Math.min(1, dt * 3);
  m.phase += m.freq * dt; m.tilt = clamp((m.vy / (speed || 1)) * 0.3, -0.3, 0.3) * Math.sign(m.faceS || 1);
}
function stepJelly(m, dt) {
  const before = m.t; m.t += dt * (1 - 0.4 * TL.N); /* t323u: lazier pulses at night */ if (m.t >= m.T) m.t -= m.T;
  if (m.y < 0.2) m.rest = true; else if (m.y > 0.5) m.rest = false;
  if (m.splash && m.y > 0.2) m.splash = 0;
  if (m.y > 0.72) m.rest = false;
  const pulse = !m.rest && !m.splash; const p = m.t / m.T;
  if (pulse && m.t < before) m.vy = -0.11; // new pulse starts: kick upward
  m.c = pulse && p < 0.24 ? Math.sin(Math.PI * p / 0.24) : 0; // contraction 0..1
  m.vy += (0.014 - m.vy) * Math.min(1, dt * 0.9); // relax to a slow sink
  m.drift += rand(-0.004, 0.004) * dt; m.drift = clamp(m.drift, -0.012, 0.012);
  m.x += m.drift * dt; m.y += m.vy * dt;
  if (m.x < SWIM.x0 + 0.02) { m.x = SWIM.x0 + 0.02; m.drift = Math.abs(m.drift); } if (m.x > SWIM.x1 - 0.02) { m.x = SWIM.x1 - 0.02; m.drift = -Math.abs(m.drift); }
  m.y = clamp(m.y, SWIM.y0, SWIM.y1);
}
/* t210u: the mobile tank is wider (pans), but creatures keep their old on-screen size so the extra width is real swim room */
const sizeW = () => (root.innerWidth <= 900 ? Math.min(TW, 860) : TW);
const fishTarget = () => clamp(sizeW() * 0.075, 38, 76), jellyTarget = () => clamp(sizeW() * 0.08, 42, 80);
function scaleFor(c, s) { return DQ.sizeOf(c) * baseScale(c, s); }
function baseScale(c, s) { const [x0, y0, x1, y1] = s.box; return c.k === 'jelly' ? jellyTarget() / Math.max(y1 - y0, 190) : fishTarget() / Math.max(x1 - x0, 190); }
function drawFish(ctx, c, m, s, sc) {
  const [x0, y0, x1, y1] = s.box, cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, bh = y1 - y0, q = SPR_Q, wagX = FISH.wagX, step = 8;
  ctx.save(); ctx.translate(m.x * TW, m.y * TH + Math.sin(m.phase * 0.25 + m.seed) * 2); ctx.rotate(m.tilt || 0); ctx.scale(m.faceS * sc, sc);
  const end = Math.min(x1, wagX);
  for (let x = x0; x < end; x += step) {
    const w = Math.pow((wagX - x) / (wagX - 50), 1.5), dy = m.amp * Math.min(1.3, w) * Math.sin(m.phase - (wagX - x) / 45), sw = Math.min(step, end - x);
    ctx.drawImage(s.cv, x * q, y0 * q, sw * q + 0.6, bh * q, x - cx, y0 - cy + dy, sw + 0.8, bh);
  }
  if (x1 > end) ctx.drawImage(s.cv, end * q, y0 * q, (x1 - end) * q, bh * q, end - cx, y0 - cy, x1 - end, bh);
  ctx.restore();
}
function drawJelly(ctx, c, m, s, sc) {
  const [x0, y0, x1, y1] = s.box, q = SPR_Q, cx = JELLY.cx, by = JELLY.bellY, mid = (y0 + y1) / 2, bw = x1 - x0, t = performance.now() / 1000;
  ctx.save(); ctx.translate(m.x * TW, m.y * TH); ctx.scale(sc, sc); ctx.translate(-cx, -mid);
  const top = Math.min(by, y1);
  if (top > y0) { const sx = 1 - 0.14 * m.c, sy = 1 + 0.07 * m.c; ctx.save(); ctx.translate(cx, top); ctx.scale(sx, sy); ctx.drawImage(s.cv, x0 * q, y0 * q, bw * q, (top - y0) * q, x0 - cx, y0 - top, bw, top - y0 + 0.5); ctx.restore(); }
  const stepY = 6;
  for (let y = Math.max(y0, by); y < y1; y += stepY) {
    const depth = (y - by) / 140, k = 1 - 0.3 * m.c * Math.min(1, depth), dx = Math.sin(t * 2.1 + y / 26 + m.seed) * 6 * depth * (1 - m.c * 0.6), yy = by + (y - by) * (1 - 0.1 * m.c), h = Math.min(stepY, y1 - y);
    ctx.drawImage(s.cv, x0 * q, y * q, bw * q, h * q + 0.6, cx + (x0 - cx) * k + dx, yy, bw * k, h + 0.8);
  }
  ctx.restore();
}
function label(ctx, text, x, y, opt) {
  opt = opt || {}; if (!REDUCED) y += Math.sin(performance.now() / 600 + x * 0.05) * 1.2; ctx.save(); ctx.font = '600 ' + (opt.size || 12) + 'px system-ui,-apple-system,"Segoe UI",Roboto,sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const w = ctx.measureText(text).width + 14, h = (opt.size || 12) + 8, cw = ctx.canvas === tank ? TW : ctx.canvas === walk ? WW : ctx.canvas.width / WDPR; if (!opt.free && cw > w + 4) x = clamp(x, w / 2 + 2, cw - w / 2 - 2); ctx.globalAlpha = opt.alpha == null ? 1 : opt.alpha;
  ctx.fillStyle = opt.bg || 'rgba(255,255,255,.82)'; ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(x - w / 2, y - h / 2, w, h, h / 2); else ctx.rect(x - w / 2, y - h / 2, w, h); ctx.fill();
  ctx.fillStyle = opt.fg || '#0f4c66'; ctx.fillText(text, x, y + 0.5); ctx.restore();
}
/* t237u: artistic tank — layered water + far reef haze + dunes + soft corals + mossy stones + polished chest. Seeded (no flicker on resize). Mid-water kept clear; decor sits on the seabed + edges, density scales with TW. */
let weeds = [], chestAt = { x: 0.6, y: 0.86 }, rayGrad = null;
function bgRng(key) { let a = hashStr(key) || 1; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function rrPath(c, x, y, w, h, r) { r = Math.min(r, w / 2, h / 2); c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
function buildBg() {
  bgCanvas = doc.createElement('canvas'); bgCanvas.width = Math.round(TW * DPR); bgCanvas.height = Math.round(TH * DPR); const c = bgCanvas.getContext('2d'); c.scale(DPR, DPR); rayGrad = null;
  const R = bgRng('dq-bg-t237u'), rr = (a, b) => a + R() * (b - a), pick = a => a[Math.floor(R() * a.length)], PI = Math.PI, PI2 = PI * 2, U = clamp(TH / 450, 0.7, 1.5);
  // 1) water depth: pale aqua surface -> teal -> deep blue
  const g = c.createLinearGradient(0, 0, 0, TH);
  [[0, '#c6f2ec'], [0.1, '#94dee0'], [0.32, '#58bdcd'], [0.6, '#3195b6'], [0.84, '#22729a'], [1, '#1a5d86']].forEach(s => g.addColorStop(s[0], s[1])); c.fillStyle = g; c.fillRect(0, 0, TW, TH);
  const sg = c.createLinearGradient(0, 0, 0, TH * 0.16); sg.addColorStop(0, 'rgba(255,255,255,.34)'); sg.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = sg; c.fillRect(0, 0, TW, TH * 0.16);
  for (let x = rr(-60, 140); x < TW + 100; x += rr(240, 380)) { const bl = c.createRadialGradient(x, -TH * 0.04, 0, x, -TH * 0.04, TH * 0.55); bl.addColorStop(0, 'rgba(255,253,230,.18)'); bl.addColorStop(1, 'rgba(255,253,230,0)'); c.fillStyle = bl; c.fillRect(x - TH * 0.55, 0, TH * 1.1, TH * 0.55); }
  // drifting motes (very faint plankton bokeh)
  for (let i = 0, n = Math.min(160, Math.round(TW * TH / 9000)); i < n; i++) { c.fillStyle = 'rgba(255,255,255,' + rr(0.04, 0.13).toFixed(3) + ')'; c.beginPath(); c.arc(rr(0, TW), rr(0.04, 0.8) * TH, rr(0.6, 2.2), 0, PI2); c.fill(); }
  // 2) far reef haze: two soft ridges with faint coral-head bumps
  const ridge = (base, amp, fr, col, bumps) => { const p = [rr(0, 6), rr(0, 6), rr(0, 6)], h = x => base - amp * (0.5 + 0.3 * Math.sin(x * fr + p[0]) + 0.2 * Math.sin(x * fr * 2.3 + p[1]) + 0.12 * Math.sin(x * fr * 5.1 + p[2]));
    c.fillStyle = col; c.beginPath(); c.moveTo(0, TH); for (let x = 0; x <= TW + 8; x += 8) c.lineTo(x, h(x)); c.lineTo(TW, TH); c.closePath(); c.fill();
    if (bumps) for (let x = rr(10, 80); x < TW; x += rr(70, 150)) { const y = h(x), k = rr(0.6, 1.2) * U; for (let j = 0; j < 3; j++) { c.beginPath(); c.arc(x + (j - 1) * 9 * k, y + 2, (6 + R() * 8) * k, PI, 0); c.fill(); } }
    return h; };
  ridge(TH * 0.8, TH * 0.12, 0.006, 'rgba(150,215,225,.20)', true);
  ridge(TH * 0.845, TH * 0.085, 0.011, 'rgba(38,118,150,.26)', true);
  // 3) seabed dunes
  const sandY = TH * 0.85;
  const dune = (base, amp, fr, top, bot, shade) => { const p0 = rr(0, 6), p1 = rr(0, 6), h = x => base + amp * (Math.sin(x * fr + p0) * 0.6 + Math.sin(x * fr * 2.7 + p1) * 0.4);
    const dg = c.createLinearGradient(0, base - amp, 0, TH); dg.addColorStop(0, top); dg.addColorStop(1, bot); c.save();
    if (shade) { c.shadowColor = 'rgba(70,50,20,.28)'; c.shadowBlur = 12 * U; c.shadowOffsetY = -3 * U; }
    c.fillStyle = dg; c.beginPath(); c.moveTo(0, TH + 20); for (let x = 0; x <= TW + 6; x += 6) c.lineTo(x, h(x)); c.lineTo(TW, TH + 20); c.closePath(); c.fill(); c.restore();
    c.strokeStyle = 'rgba(255,248,225,.5)'; c.lineWidth = 1.4; c.beginPath(); for (let x = 0; x <= TW + 6; x += 6) x ? c.lineTo(x, h(x) + 1) : c.moveTo(x, h(x) + 1); c.stroke(); return h; };
  const backH = dune(sandY - TH * 0.012, TH * 0.018, 0.008, '#e0c48c', '#c9a76c', false);
  // --- decor helpers ---
  const stone = (x, y, rw, rh, col, moss) => { c.save(); c.beginPath(); c.ellipse(x, y, rw, rh, rr(-0.15, 0.15), PI, 0); c.closePath(); const sgr = c.createRadialGradient(x - rw * 0.35, y - rh * 0.7, rw * 0.1, x, y, rw * 1.1); sgr.addColorStop(0, '#d5e2e2'); sgr.addColorStop(0.35, col); sgr.addColorStop(1, '#4f6a74'); c.fillStyle = sgr; c.fill(); c.clip();
    if (moss) { const mg = c.createLinearGradient(0, y - rh, 0, y - rh * 0.35); mg.addColorStop(0, 'rgba(120,185,105,.6)'); mg.addColorStop(1, 'rgba(120,185,105,0)'); c.fillStyle = mg; c.fillRect(x - rw, y - rh, rw * 2, rh); for (let i = 0; i < 6; i++) { c.fillStyle = 'rgba(150,205,120,.45)'; c.beginPath(); c.arc(x + rr(-0.7, 0.7) * rw, y - rh * rr(0.75, 1), rr(1.5, 3.5) * U, 0, PI2); c.fill(); } }
    c.restore(); };
  const pile = (x, y, k) => { const cols = ['#8fa9b0', '#7d97a1', '#a3b9bc', '#6f8c97']; c.fillStyle = 'rgba(40,40,30,.18)'; c.beginPath(); c.ellipse(x, y + 2, 40 * k, 6 * k, 0, 0, PI2); c.fill();
    stone(x - 18 * k, y + 2, 20 * k, 17 * k, pick(cols), true); stone(x + 16 * k, y + 3, 24 * k, 20 * k, pick(cols), true); stone(x, y + 4, 15 * k, 28 * k, pick(cols), true); if (R() < 0.6) stone(x + 34 * k, y + 4, 9 * k, 8 * k, pick(cols), false); };
  const fan = (x, y, h, col, hi) => { const w = h * rr(0.95, 1.25), ph = rr(0, 6), N = 12; c.save(); c.globalAlpha *= 0.6; const fg = c.createRadialGradient(x, y, h * 0.1, x, y - h * 0.4, h); fg.addColorStop(0, hi); fg.addColorStop(1, col); c.fillStyle = fg; c.beginPath(); c.moveTo(x, y);
    for (let i = 0; i <= N; i++) { const a = -PI * 0.93 + i / N * PI * 0.86, r = 1 + 0.07 * Math.sin(i * 1.9 + ph); c.lineTo(x + Math.cos(a) * w / 2 * r, y + Math.sin(a) * h * r); } c.closePath(); c.fill(); c.restore();
    c.save(); c.strokeStyle = col; c.lineCap = 'round'; for (let i = 0; i < 9; i++) { const a = -PI * 0.9 + i / 8 * PI * 0.8, ex = x + Math.cos(a) * w / 2 * 0.96, ey = y + Math.sin(a) * h * 0.96; c.lineWidth = 2.2 * U; c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + (ex - x) * 0.3, y + (ey - y) * 0.65, ex, ey); c.stroke(); }
    c.fillStyle = hi; for (let i = 0; i < 14; i++) { const a = -PI * 0.9 + R() * PI * 0.8, f = rr(0.4, 0.97); c.beginPath(); c.arc(x + Math.cos(a) * w / 2 * f, y + Math.sin(a) * h * f, rr(0.8, 1.8) * U, 0, PI2); c.fill(); } c.restore(); };
  const brain = (x, y, r, col) => { c.save(); c.beginPath(); c.ellipse(x, y, r * 1.15, r, 0, PI, 0); c.closePath(); const bg2 = c.createRadialGradient(x - r * 0.4, y - r * 0.75, r * 0.1, x, y - r * 0.2, r * 1.3); bg2.addColorStop(0, '#fff1e2'); bg2.addColorStop(0.35, col); bg2.addColorStop(1, 'rgba(90,50,60,.9)'); c.fillStyle = bg2; c.fill(); c.clip();
    c.strokeStyle = 'rgba(80,40,40,.22)'; c.lineWidth = 1.3 * U; for (let j = 1; j < 5; j++) { const yy = y - r * j / 5, ph = rr(0, 6); c.beginPath(); for (let xx = x - r * 1.2; xx <= x + r * 1.2; xx += 3) { const v = yy + Math.sin(xx * 0.35 / U + ph) * 2 * U; xx === x - r * 1.2 ? c.moveTo(xx, v) : c.lineTo(xx, v); } c.stroke(); } c.restore(); };
  const anemone = (x, y, h, col, tip) => { c.save(); c.fillStyle = col; c.beginPath(); c.moveTo(x - h * 0.22, y); c.quadraticCurveTo(x - h * 0.16, y - h * 0.3, x - h * 0.2, y - h * 0.42); c.lineTo(x + h * 0.2, y - h * 0.42); c.quadraticCurveTo(x + h * 0.16, y - h * 0.3, x + h * 0.22, y); c.closePath(); c.fill();
    c.lineCap = 'round'; c.lineWidth = 3.2 * U; for (let i = 0; i < 13; i++) { const f = i / 12 - 0.5, ex = x + f * h * 1.2 + rr(-3, 3), ey = y - h * (0.85 + 0.25 * (1 - Math.abs(f) * 2)) ; c.strokeStyle = col; c.beginPath(); c.moveTo(x + f * h * 0.35, y - h * 0.4); c.quadraticCurveTo(x + f * h * 0.8, y - h * 0.75, ex, ey); c.stroke(); c.fillStyle = tip; c.beginPath(); c.arc(ex, ey, 2.1 * U, 0, PI2); c.fill(); } c.restore(); };
  const tubes = (x, y, h, col) => { for (let i = 0; i < 3; i++) { const th = h * [0.7, 1, 0.55][i], tw = h * 0.2, tx = x + (i - 1) * tw * 1.05; const tg = c.createLinearGradient(tx - tw / 2, 0, tx + tw / 2, 0); tg.addColorStop(0, col); tg.addColorStop(0.45, '#f3dcff'); tg.addColorStop(1, col); c.fillStyle = tg; rrPath(c, tx - tw / 2, y - th, tw, th + 2, tw / 2.5); c.fill(); c.fillStyle = 'rgba(70,30,90,.55)'; c.beginPath(); c.ellipse(tx, y - th + tw * 0.25, tw * 0.36, tw * 0.15, 0, 0, PI2); c.fill(); } };
  const tuft = (x, y, h) => { c.save(); c.lineCap = 'round'; for (let i = 0; i < 7; i++) { const f = i / 6 - 0.5; c.strokeStyle = i % 2 ? 'rgba(70,165,110,.85)' : 'rgba(110,190,120,.85)'; c.lineWidth = 2 * U; c.beginPath(); c.moveTo(x + f * 10 * U, y); c.quadraticCurveTo(x + f * 16 * U, y - h * 0.6, x + f * h * 0.9 + rr(-4, 4), y - h * rr(0.7, 1.05)); c.stroke(); } c.restore(); };
  const star = (x, y, r, col) => { c.save(); c.translate(x, y); c.rotate(rr(0, PI2)); c.scale(1, 0.55); c.fillStyle = col; c.beginPath(); for (let i = 0; i < 10; i++) { const a = i * PI / 5 - PI / 2, rad = i % 2 ? r * 0.45 : r; i ? c.lineTo(Math.cos(a) * rad, Math.sin(a) * rad) : c.moveTo(Math.cos(a) * rad, Math.sin(a) * rad); } c.closePath(); c.lineJoin = 'round'; c.lineWidth = r * 0.25; c.strokeStyle = col; c.fill(); c.stroke(); c.fillStyle = 'rgba(255,255,255,.45)'; for (let i = 0; i < 5; i++) { const a = i * PI * 0.4 - PI / 2; c.beginPath(); c.arc(Math.cos(a) * r * 0.5, Math.sin(a) * r * 0.5, r * 0.08, 0, PI2); c.fill(); } c.restore(); };
  const shell = (x, y, r, col) => { c.save(); c.fillStyle = col; c.beginPath(); c.moveTo(x, y); c.arc(x, y, r, PI * 1.08, PI * 1.92); c.closePath(); c.fill(); c.strokeStyle = 'rgba(160,90,90,.35)'; c.lineWidth = 0.8; for (let i = 1; i < 5; i++) { const a = PI * 1.08 + i / 5 * PI * 0.84; c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); c.stroke(); } c.restore(); };
  const PINK = ['#f59fb0', '#ef8a9c', '#ffb0a0'], WARM = ['#ffb27a', '#f7a26b', '#ffc48f'], PURP = ['#b99be8', '#c9a3e0', '#a98ee0'], BRAIN = ['#e9a07a', '#cf9fd9', '#f0b47e', '#e79aa6'];
  const cx0 = chestAt.x * TW, cw = 70 * U;
  const deco = (x, y, k, far) => { if (Math.abs(x - cx0) < cw) return; const e = Math.abs(x / TW - 0.5) * 2, hk = (0.6 + 0.5 * e) * k * U, ty = R();
    if (ty < 0.2) fan(x, y, (42 + R() * 22) * hk, pick(R() < 0.5 ? PINK : PURP), '#ffe6ec');
    else if (ty < 0.38) brain(x, y + 2, (14 + R() * 8) * hk, pick(BRAIN));
    else if (ty < 0.53) anemone(x, y + 2, (30 + R() * 12) * hk, pick(R() < 0.5 ? PINK : WARM), '#fff1d6');
    else if (ty < 0.66) tubes(x, y + 3, (34 + R() * 16) * hk, pick(PURP));
    else if (ty < 0.82) pile(x, y, (0.55 + R() * 0.35) * hk / U * U);
    else tuft(x, y + 2, (22 + R() * 14) * hk);
    if (!far && R() < 0.35) tuft(x + rr(14, 26) * U, y + 3, rr(12, 22) * U); };
  // back row (smaller, hazier)
  c.save(); c.globalAlpha = 0.62; for (let i = 0, n = Math.max(4, Math.round(TW / 180)); i < n; i++) { const x = (i + rr(0.15, 0.85)) / n * TW; deco(x, backH(x), 0.65, true); } c.restore();
  const midH = dune(sandY + TH * 0.035, TH * 0.014, 0.013, '#efd8a4', '#d9bd86', true);
  // front row: anchor piles + big flora near both edges, then scattered slots
  pile(TW * rr(0.07, 0.12), midH(TW * 0.1), 1.1 * U); pile(TW * rr(0.82, 0.87), midH(TW * 0.85), 1.25 * U);
  fan(TW * 0.035, midH(TW * 0.035) + 2, 70 * U, '#ef8a9c', '#ffe6ec'); anemone(TW * 0.95, midH(TW * 0.95) + 3, 44 * U, '#f7a26b', '#fff1d6');
  for (let i = 0, n = Math.max(6, Math.round(TW / 125)); i < n; i++) { const x = (i + rr(0.2, 0.8)) / n * TW; if (x < TW * 0.06 || x > TW * 0.93) continue; deco(x, midH(x) + rr(0, 4), 1, false); }
  // polished treasure chest (cute easter egg)
  { const s = clamp(TH / 450, 0.7, 1.1), x = cx0, y = midH(x) + 4 * s, w = 46 * s, h = 22 * s, lh = 15 * s; chestAt.y = (y - h) / TH;
    c.fillStyle = 'rgba(60,40,15,.28)'; c.beginPath(); c.ellipse(x, y + 1, w * 0.66, 5 * s, 0, 0, PI2); c.fill();
    const wb = c.createLinearGradient(x - w / 2, 0, x + w / 2, 0); wb.addColorStop(0, '#7f522a'); wb.addColorStop(0.5, '#a8713f'); wb.addColorStop(1, '#744a24'); c.fillStyle = wb; rrPath(c, x - w / 2, y - h, w, h, 4 * s); c.fill();
    c.strokeStyle = 'rgba(60,35,15,.35)'; c.lineWidth = 1; c.beginPath(); c.moveTo(x - w / 2 + 2, y - h * 0.5); c.lineTo(x + w / 2 - 2, y - h * 0.5); c.stroke();
    c.save(); c.beginPath(); c.moveTo(x - w / 2, y - h); c.lineTo(x - w / 2, y - h - lh * 0.3); c.bezierCurveTo(x - w / 2, y - h - lh * 1.3, x + w / 2, y - h - lh * 1.3, x + w / 2, y - h - lh * 0.3); c.lineTo(x + w / 2, y - h); c.closePath();
    const lg = c.createLinearGradient(0, y - h - lh, 0, y - h); lg.addColorStop(0, '#c99258'); lg.addColorStop(1, '#8e5c2c'); c.fillStyle = lg; c.fill(); c.clip(); const gold = c.createLinearGradient(0, y - h - lh, 0, y); gold.addColorStop(0, '#fff0a0'); gold.addColorStop(1, '#e0a526'); c.fillStyle = gold; c.fillRect(x - w * 0.34 - 2 * s, y - h - lh * 1.2, 4 * s, lh * 1.2); c.fillRect(x + w * 0.34 - 2 * s, y - h - lh * 1.2, 4 * s, lh * 1.2); c.restore();
    const gold2 = c.createLinearGradient(0, y - h - 3 * s, 0, y); gold2.addColorStop(0, '#fff0a0'); gold2.addColorStop(1, '#d9981f'); c.fillStyle = gold2;
    c.fillRect(x - w * 0.34 - 2 * s, y - h, 4 * s, h); c.fillRect(x + w * 0.34 - 2 * s, y - h, 4 * s, h); rrPath(c, x - w / 2 - 1, y - h - 2 * s, w + 2, 4 * s, 2 * s); c.fill(); rrPath(c, x - 4.5 * s, y - h - 3 * s, 9 * s, 10 * s, 2 * s); c.fill();
    c.fillStyle = '#5a3a1a'; c.beginPath(); c.arc(x, y - h + 1.5 * s, 1.4 * s, 0, PI2); c.fill(); c.fillRect(x - 0.6 * s, y - h + 1.5 * s, 1.2 * s, 3 * s);
    c.fillStyle = '#ffd84a'; for (const [dx, dy] of [[-w * 0.7, 1], [-w * 0.6, 3], [w * 0.62, 2]]) { c.beginPath(); c.ellipse(x + dx, y + dy * s, 3.4 * s, 1.6 * s, 0, 0, PI2); c.fill(); }
    c.fillStyle = 'rgba(255,255,255,.85)'; c.beginPath(); const sx = x + w * 0.3, sy = y - h - lh * 0.7, sr = 4 * s; c.moveTo(sx, sy - sr); c.quadraticCurveTo(sx, sy, sx + sr, sy); c.quadraticCurveTo(sx, sy, sx, sy + sr); c.quadraticCurveTo(sx, sy, sx - sr, sy); c.quadraticCurveTo(sx, sy, sx, sy - sr); c.fill(); }
  const frontH = dune(sandY + TH * 0.088, TH * 0.01, 0.019, '#f8e9c4', '#e8cf9b', true);
  // sand ripples + pebbles + little treasures on the front sand
  for (let i = 0, n = Math.round(TW / 24); i < n; i++) { const x = rr(0, TW), y = rr(midH(x) + 8, TH - 3), l = rr(8, 18) * U; c.strokeStyle = 'rgba(170,130,70,.2)'; c.lineWidth = 1; c.beginPath(); c.moveTo(x - l, y); c.quadraticCurveTo(x, y - 3, x + l, y); c.stroke(); c.strokeStyle = 'rgba(255,255,255,.28)'; c.beginPath(); c.moveTo(x - l, y + 1.2); c.quadraticCurveTo(x, y - 1.8, x + l, y + 1.2); c.stroke(); }
  const PEB = ['#c9a86f', '#b89a6a', '#9fb3ad', '#d7c19a', '#8c9c9a', '#e8cfa0', '#a88f7a', '#c7b2c9'];
  for (let i = 0, n = Math.round(TW / 9); i < n; i++) { const x = rr(0, TW), y = rr(midH(x) + 6, TH - 2), s = rr(1.2, 4.2) * U * (R() < 0.12 ? 2 : 1), a = rr(-0.5, 0.5);
    c.fillStyle = 'rgba(90,70,40,.2)'; c.beginPath(); c.ellipse(x + 0.8, y + s * 0.4, s, s * 0.55, a, 0, PI2); c.fill(); c.fillStyle = pick(PEB); c.beginPath(); c.ellipse(x, y, s, s * 0.65, a, 0, PI2); c.fill(); c.fillStyle = 'rgba(255,255,255,.35)'; c.beginPath(); c.ellipse(x - s * 0.3, y - s * 0.25, s * 0.35, s * 0.2, a, 0, PI2); c.fill(); }
  for (let i = 0, n = Math.max(3, Math.round(TW / 260)); i < n; i++) { const x = (i + rr(0.1, 0.9)) / n * TW, y = rr(frontH(x) + 6, TH - 6); if (Math.abs(x - cx0) < cw) continue; R() < 0.45 ? star(x, y, rr(6, 9) * U, pick(['#f79a7a', '#f2b35c', '#ef8fa0'])) : shell(x, y, rr(4, 7) * U, pick(['#f7c6d0', '#fde3c8', '#e8d4f4'])); }
  // soft vignette: edges + bottom
  const ew = Math.min(TW * 0.14, 170); let vg = c.createLinearGradient(0, 0, ew, 0); vg.addColorStop(0, 'rgba(10,45,75,.24)'); vg.addColorStop(1, 'rgba(10,45,75,0)'); c.fillStyle = vg; c.fillRect(0, 0, ew, TH);
  vg = c.createLinearGradient(TW, 0, TW - ew, 0); vg.addColorStop(0, 'rgba(10,45,75,.24)'); vg.addColorStop(1, 'rgba(10,45,75,0)'); c.fillStyle = vg; c.fillRect(TW - ew, 0, ew, TH);
  vg = c.createLinearGradient(0, TH * 0.8, 0, TH); vg.addColorStop(0, 'rgba(20,50,70,0)'); vg.addColorStop(1, 'rgba(20,50,70,.14)'); c.fillStyle = vg; c.fillRect(0, TH * 0.8, TW, TH * 0.2);
  tlBuild(midH); // t323u: sand line + night / cloud / leaf / glass overlays
  // kelp clusters (animated in drawTank): tall at both edges, short seagrass sprinkled across wide tanks
  const K = bgRng('dq-kelp-t237u'), kr = (a, b) => a + K() * (b - a), KC = [['#2e9b6f', '#8fe0a8'], ['#3fb47f', '#a6ecb8'], ['#4a9f5c', '#b4e59a'], ['#2b8f7a', '#8ad9c4']]; weeds = [];
  const cl = (fx, h, w) => { const x = fx * TW, col = KC[Math.floor(K() * KC.length)]; for (let j = -1; j <= 1; j++) weeds.push({ x: x + j * w * 0.9 + kr(-3, 3), base: TH * 0.9 + kr(0, 6), h: h * (j ? kr(0.62, 0.85) : 1), w, c: col[0], c2: col[1], ph: kr(0, 6) }); };
  cl(kr(0.02, 0.05), TH * kr(0.28, 0.36), 7 * U); cl(kr(0.1, 0.14), TH * kr(0.18, 0.24), 6 * U); cl(kr(0.86, 0.9), TH * kr(0.2, 0.26), 6 * U); cl(kr(0.94, 0.98), TH * kr(0.28, 0.36), 7 * U);
  for (let i = 0, n = Math.floor(TW / 420); i < n; i++) { const fx = (i + kr(0.25, 0.75)) / n * 0.7 + 0.15; if (Math.abs(fx * TW - cx0) < cw * 1.2) continue; cl(fx, TH * kr(0.09, 0.14), 4.5 * U); }
}
function kelpBlade(ctx, k, t, sw) {
  const N = 9, L = [], Rt = [], amp = k.h * 0.13 * sw;
  for (let i = 0; i <= N; i++) { const f = i / N, off = (Math.sin(t * 1.05 + k.ph + f * 2.2) * 0.7 + Math.sin(t * 0.6 + k.ph * 1.7 + f * 3.1) * 0.3) * amp * Math.pow(f, 1.4), x = k.x + off, y = k.base - k.h * f, hw = k.w * 0.5 * (1 - f * 0.78) * (0.9 + 0.1 * Math.sin(f * 9 + k.ph)); L.push([x - hw, y]); Rt.push([x + hw, y]); }
  ctx.fillStyle = k.c; ctx.beginPath(); ctx.moveTo(L[0][0], L[0][1]); for (let i = 1; i <= N; i++) ctx.lineTo(L[i][0], L[i][1]); const tip = (L[N][0] + Rt[N][0]) / 2; ctx.quadraticCurveTo(tip, L[N][1] - k.w * 0.8, Rt[N][0], Rt[N][1]); for (let i = N - 1; i >= 0; i--) ctx.lineTo(Rt[i][0], Rt[i][1]); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = k.c2; ctx.globalAlpha = 0.55; ctx.lineWidth = 1; ctx.beginPath(); for (let i = 0; i < N; i++) { const mx = (L[i][0] + Rt[i][0]) / 2; i ? ctx.lineTo(mx, L[i][1]) : ctx.moveTo(mx, L[i][1]); } ctx.stroke(); ctx.globalAlpha = 1;
  ctx.fillStyle = k.c2; for (const [i, sd] of [[3, -1], [5, 1], [7, -1]]) { if (k.h < 60) break; const x = sd < 0 ? L[i][0] : Rt[i][0]; ctx.beginPath(); ctx.ellipse(x + sd * k.w * 0.35, L[i][1], k.w * 0.42, k.w * 0.3, 0, 0, Math.PI * 2); ctx.fill(); }
}
/* t244u: tank life — sparse food sprinkles (every ~12–30 s: 3–6 flakes plip in near the top, sway down, settle on the sand and dissolve;
   up to 3 nearby fish swim over and nibble) + seabed bubble bursts (every ~14–35 s from the chest or a random spot, with blups). */
const food = [], bursts = [], LIFE_T = { food: rand(6, 12), burst: rand(8, 16) }, FOOD_COL = ['#c8743a', '#e0a050', '#a85a2c', '#d98c5f', '#8c4a22'];
function dropFood(o) { // t323u: opts { cx, n, all (feeding time: every fish comes), pellets (share of round, faster-sinking pellets) }
  o = o || {}; const cx = o.cx != null ? o.cx : (Math.random() < 0.6 ? rand(0.36, 0.64) : rand(0.12, 0.88)), n = o.n || 3 + (Math.random() * 4 | 0), batch = [], pel = o.pellets != null ? o.pellets : 0.2;
  for (let i = 0; i < n; i++) { const pl = Math.random() < pel, f = { x: cx + rand(-0.035, 0.035) * (o.all ? 1.6 : 1), y: rand(-0.02, 0.01), vy: 0, delay: i * rand(0.08, 0.22), ph: rand(0, 6), sw: pl ? rand(0.001, 0.003) : rand(0.004, 0.01), r: pl ? rand(2, 2.8) : rand(2.2, 3.6), rot: rand(0, 3), col: pl ? ['#7a3f1c', '#94502a', '#6b3a22'][i % 3] : FOOD_COL[i % FOOD_COL.length], pel: pl, sink: pl ? rand(0.06, 0.08) : rand(0.03, 0.05), life: 1, set: false, gone: false, plip: false }; food.push(f); batch.push(f); }
  ripples.push({ x: cx, t: 0 }); if (o.all) ripples.push({ x: cx + 0.02, t: -0.25 });
  const fish = [...sim.values()].filter(m => m.k !== 'jelly' && !m.feed).sort((p, q) => Math.abs(p.x - cx) - Math.abs(q.x - cx)).slice(0, o.all ? 99 : Math.min(3, Math.ceil(sim.size / 3)));
  fish.forEach((m, i) => { m.feedDelay = rand(0.3, 1.2) + i * (o.all ? 0.25 : 0.5); m.feed = batch[i % batch.length]; m.feedT = rand(6, 10); });
}
function spawnBurst() {
  const atChest = Math.random() < 0.4, x = atChest ? chestAt.x : rand(0.08, 0.92), y = atChest ? chestAt.y : rand(0.86, 0.9), n = 5 + (Math.random() * 9 | 0);
  for (let i = 0; i < n; i++) bursts.push({ x: x + rand(-0.006, 0.006), y, d: i * rand(0.05, 0.12), r: rand(1.6, 4.6), s: rand(0.14, 0.26), w: rand(0, 6) });
  LIFE.burst(x, Math.min(8, n));
}
function feedFish(m, dt) { // called from stepFish: steer to the flake, nibble on contact
  if (m.feedDelay > 0) { m.feedDelay -= dt; return; } const f = m.feed; m.feedT -= dt;
  if (!f || f.gone || m.feedT <= 0) { m.feed = null; newTarget(m); return; } if (f.delay > 0) return;
  m.follow = null; m.tx = clamp(f.x, SWIM.x0, SWIM.x1); m.ty = clamp(f.y, SWIM.y0, SWIM.y1); m.targetT = 1; m.mode = Math.hypot(m.tx - m.x, m.ty - m.y) > 0.2 ? 2 : 1; m.modeT = Math.max(m.modeT, 1);
  if (Math.hypot((m.x - f.x) * TW, (m.y - f.y) * TH) < 16) { f.gone = true; m.feed = null; LIFE.nibble(f.x); m.mode = 0; m.modeT = rand(1.5, 3); newTarget(m); }
}
function drawLife(ctx, dt, t) {
  LIFE_T.food -= dt; if (LIFE_T.food <= 0) { LIFE_T.food = rand(18, 40) * (1 + TL.N * 2); if (food.length < 24 && TL.N < 0.6 && !TL.feed) dropFood(); } // t323u: rarer, none at night (feeding time does the big one)
  LIFE_T.burst -= dt; if (LIFE_T.burst <= 0) { LIFE_T.burst = rand(14, 35); if (bursts.length < 40) spawnBurst(); }
  let settledNow = null;
  for (let i = food.length - 1; i >= 0; i--) { const f = food[i];
    if (f.delay > 0) { f.delay -= dt; continue; } if (!f.plip) { f.plip = true; LIFE.plip(f.x); }
    if (!f.set) { f.vy += (f.sink - f.vy) * Math.min(1, dt * 1.5); f.y += f.vy * dt; f.rot += dt * 0.8; if (f.y >= 0.855) { f.y = 0.855 + rand(0, 0.02); f.set = true; settledNow = f; } }
    else f.life -= dt / 7;
    if (f.gone) f.life -= dt * 4; if (f.life <= 0) { f.gone = true; food.splice(i, 1); continue; }
    const x = (f.x + (f.set ? 0 : Math.sin(t * 1.6 + f.ph) * f.sw)) * TW, y = f.y * TH;
    ctx.save(); ctx.globalAlpha = clamp(f.life, 0, 1) * 0.95; ctx.translate(x, y); ctx.rotate(f.rot); ctx.fillStyle = f.col; ctx.beginPath(); if (f.pel) ctx.arc(0, 0, f.r, 0, Math.PI * 2); else ctx.ellipse(0, 0, f.r * 1.3, f.r * 0.8, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,240,200,.55)'; ctx.beginPath(); ctx.arc(-f.r * 0.4, -f.r * 0.25, f.r * 0.35, 0, Math.PI * 2); ctx.fill(); ctx.restore(); }
  if (settledNow) LIFE.settle(settledNow.x);
  if (bursts.length) { ctx.save(); ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.lineWidth = 1.1;
    for (let i = bursts.length - 1; i >= 0; i--) { const b = bursts[i]; if (b.d > 0) { b.d -= dt; continue; } b.y -= b.s * dt; b.s += dt * 0.02; if (b.y < -0.03) { bursts.splice(i, 1); continue; }
      const x = (b.x + Math.sin(t * 3 + b.w) * 0.006) * TW, y = b.y * TH; ctx.beginPath(); ctx.arc(x, y, b.r, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
    ctx.restore(); }
}
root.DQLife = { food, bursts, drop: dropFood, burst: spawnBurst, timers: LIFE_T };
const bubbles = Array.from({ length: 22 }, (_, i) => ({ x: Math.random(), y: Math.random(), r: i < 6 ? rand(1.5, 3.5) : rand(2, 6), s: i < 6 ? rand(0.06, 0.1) : rand(0.03, 0.08), w: rand(0, 6), st: i < 6 }));
/*TANKLIFE*/
function drawTank(dt, now) {
  const ctx = tctx; ctx.setTransform(DPR, 0, 0, DPR, 0, 0); tlUpdate(); tlPill(now);
  const cull = PERF.cull, vx0 = cull ? clamp(Math.floor(PERF.vx0), 0, TW) : 0, vx1 = cull ? clamp(Math.ceil(PERF.vx1), 0, TW) : TW; // t325u: phones only paint the visible part (+40%) of the 3x wide tank
  ctx.save(); if (cull) { ctx.beginPath(); ctx.rect(vx0, 0, vx1 - vx0, TH); ctx.clip(); }
  if (bgCanvas) { if (cull) { const k = bgCanvas.width / TW; ctx.drawImage(bgCanvas, vx0 * k, 0, (vx1 - vx0) * k, bgCanvas.height, vx0, 0, vx1 - vx0, TH); } else ctx.drawImage(bgCanvas, 0, 0, TW, TH); }
  const t = now / 1000, sw = REDUCED ? 0.3 : 1;
  // god rays (count scales with width)
  if (!rayGrad) { rayGrad = ctx.createLinearGradient(0, 0, 0, TH * 0.88); rayGrad.addColorStop(0, 'rgba(255,253,235,.6)'); rayGrad.addColorStop(0.5, 'rgba(255,255,255,.22)'); rayGrad.addColorStop(1, 'rgba(255,255,255,0)'); }
  ctx.save(); ctx.fillStyle = rayGrad;
  for (let i = 0, n = Math.max(4, Math.round(TW / 210)); i < n; i++) { const x = TW * (i + 0.3) / n + Math.sin(t * 0.25 + i * 1.7) * 26 * sw, w0 = 26 + (i * 37) % 44, sl = TH * 0.22; ctx.globalAlpha = (0.2 + (REDUCED ? 0 : 0.08 * Math.sin(t * 0.5 + i * 2.1))) * (0.08 + 0.92 * TL.L); ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + w0, 0); ctx.lineTo(x + w0 + sl + 50, TH * 0.88); ctx.lineTo(x + sl - 10, TH * 0.88); ctx.closePath(); ctx.fill(); }
  ctx.restore();
  drawOutside(ctx, t); // t323u: cloud + leaf shadows from outside the glass
  if (!REDUCED && TL.L > 0.05) { ctx.save(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.6; ctx.globalAlpha = 0.07 * TL.L;
    for (let i = 0, n = Math.round(TW / 70); i < n; i++) { const cx = ((i / n + t * 0.01) % 1.05) * TW, cy = TH * (0.04 + (i % 3) * 0.05) + Math.sin(t + i) * 5; ctx.beginPath(); ctx.ellipse(cx, cy, 22 + Math.sin(t * 1.3 + i) * 8, 6, Math.sin(t * 0.4 + i) * 0.3, 0, Math.PI * 2); ctx.stroke(); }
    ctx.fillStyle = 'rgba(255,252,225,1)'; ctx.globalAlpha = 0.07 * TL.L;
    for (let i = 0, n = Math.round(TW / 55); i < n; i++) { const cx = ((i * 0.618 + t * 0.006 * (i % 2 ? 1 : -1)) % 1 + 1) % 1 * TW, cy = TH * (0.88 + (i % 3) * 0.035) + Math.sin(t * 0.7 + i) * 2; ctx.beginPath(); ctx.ellipse(cx, cy, 16 + Math.sin(t * 0.9 + i * 1.3) * 6, 4, 0, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore(); }
  ctx.save(); for (const k of weeds) kelpBlade(ctx, k, t, sw); ctx.restore();
  ctx.save(); ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.fillStyle = 'rgba(255,255,255,.14)'; ctx.lineWidth = 1.1;
  const bk = 0.7 + 0.6 * TL.I; for (const b of bubbles) { b.y -= b.s * dt * bk; if (b.y < -0.05) { b.y = b.st ? chestAt.y : 0.95; b.x = b.st ? chestAt.x + rand(-0.004, 0.004) : Math.random(); } const x = (b.x + Math.sin(t * (b.st ? 2 : 1) + b.w) * (b.st ? 0.004 : 0.008)) * TW, y = b.y * TH; ctx.beginPath(); ctx.arc(x, y, b.r, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); if (b.r > 2.5) { ctx.fillStyle = 'rgba(255,255,255,.8)'; ctx.beginPath(); ctx.arc(x - b.r * 0.35, y - b.r * 0.35, b.r * 0.25, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,.14)'; } }
  ctx.restore();
  drawEquipment(ctx, dt, t); drawLife(ctx, dt, t); drawRipples(ctx, dt); drawCritters(ctx, t); drawNight(ctx, dt, t); // t323u
  hits = []; const cues = [];
  const list = creatures();
  for (const c of list) {
    const s = sprite(c); let m = sim.get(c.id); if (!m) m = spawn(c, false);
    m.cr = c; if (stepDrop(m, dt)) { if (m.drop.ph === 0) { cues.push(m); continue; } } else if (c.k === 'jelly') stepJelly(m, dt); else stepFish(m, dt); // t330u
    const sc = scaleFor(c, s), [x0, y0, x1, y1] = s.box, hw = (x1 - x0) * sc / 2, hh = (y1 - y0) * sc / 2, px = m.x * TW, py = m.y * TH;
    hits.push({ id: c.id, x0: px - hw, x1: px + hw, y0: py - hh, y1: py + hh + 18, c, m, s, sc });
  }
  // names are painted first so every creature sprite sits ON TOP of the text (pin status only in info modal)
  for (const h of hits) h.fa = h.m.fa = Math.min(1, (h.m.fa == null ? (revealAt && performance.now() - revealAt > 1500 ? 1 : -Math.random() * 0.5) : h.m.fa) + dt * (h.m.fin ? 0.55 : 2.2)); // t313u: soft staggered fade-in on first load
  const inView = h => !cull || (h.x1 + 60 > vx0 && h.x0 - 60 < vx1);
  for (const h of hits) if (h.fa > 0 && inView(h) && !(h.m.drop && h.m.drop.ph < 2)) label(ctx, h.c.nm, (h.x0 + h.x1) / 2, h.y1 - 2, { size: 11, free: true, alpha: h.fa }); // t242u: name tracks the creature past either edge (no clamp)
  for (const h of hits) { if (h.fa <= 0 || !inView(h)) continue; const fa = h.fa < 1, e = h.fa * h.fa * (3 - 2 * h.fa), sc = h.m.fin && fa ? h.sc * (0.62 + 0.38 * e) : h.sc; if (h.m.fin && !fa) h.m.fin = 0;
    if (h.m.fin && fa) { const x = h.m.x * TW, y = h.m.y * TH, r = 50 * (0.6 + e), g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, 'rgba(255,255,240,' + (0.38 * (1 - e)).toFixed(3) + ')'); g.addColorStop(1, 'rgba(255,255,240,0)'); ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2); } // t323u: soft welcome glow
    const rot = h.m.drop && h.m.rot; if (rot) { const px = h.m.x * TW, py = h.m.y * TH; ctx.save(); ctx.translate(px, py); ctx.rotate(rot); ctx.translate(-px, -py); } // t330u: spin while thrown in
    if (fa) { ctx.save(); ctx.globalAlpha = h.m.fin ? e : h.fa; } if (h.c.k === 'jelly') drawJelly(ctx, h.c, h.m, h.s, sc); else drawFish(ctx, h.c, h.m, h.s, sc); if (fa) ctx.restore(); if (rot) ctx.restore(); }
  drawSplash(ctx, dt); for (const m of cues) drawDropCue(ctx, m); // t330u
  drawGone(ctx, dt); drawNightLift(ctx); drawGlass(ctx); // t323u
  ctx.fillStyle = 'rgba(255,255,255,.08)'; ctx.fillRect(0, 0, TW, 6);
  firstPaintFx(ctx, dt); ctx.restore();
}
/* t313u: the first painted frames cross-fade from the CSS placeholder gradient (same stops as #tank's background) to the real scene */
let paintFade = 0;
function firstPaintFx(ctx, dt) { if (paintFade >= 1) return; paintFade = Math.min(1, paintFade + (REDUCED ? 1 : Math.min(dt, 0.05) * 1.8)); if (paintFade >= 1) return;
  const g = ctx.createLinearGradient(0, 0, 0, TH); g.addColorStop(0, '#c6f2ec'); g.addColorStop(0.28, '#7cc6d6'); g.addColorStop(0.62, '#2f86a8'); g.addColorStop(0.82, '#1a5d86'); g.addColorStop(0.88, '#e8d4a0'); g.addColorStop(1, '#d9bf86'); ctx.save(); ctx.setTransform(DPR, 0, 0, DPR, 0, 0); ctx.globalAlpha = 1 - paintFade * paintFade * (3 - 2 * paintFade); ctx.fillStyle = g; ctx.fillRect(0, 0, TW, TH); ctx.restore(); }
let hits = [];

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
  if (!bfx) return; const k = [walk.offsetLeft + walk.clientLeft, walk.offsetTop + walk.clientTop, WW, WH, WDPR].join(',');
  if (k === bfxKey) return; bfxKey = k; const [l, tp] = k.split(',').map(Number);
  bfx.style.left = l + 'px'; bfx.style.top = (tp - BLIFT) + 'px'; bfx.style.width = WW + 'px'; bfx.style.height = (WH + BLIFT) + 'px'; bfx.width = Math.round(WW * WDPR); bfx.height = Math.round((WH + BLIFT) * WDPR); PERF.balDirty = false;
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
  const ctx = wctx; ctx.setTransform(WDPR, 0, 0, WDPR, 0, 0); ctx.clearRect(0, 0, WW, WH);
  placeBfx(); if (balCtx && PERF.balDirty) { balCtx.setTransform(WDPR, 0, 0, WDPR, 0, 0); balCtx.clearRect(0, 0, WW, WH + BLIFT); PERF.balDirty = false; } const bq = []; // t325u: clear the overlay only when something was drawn on it
  if (WP) { const g = ctx.createLinearGradient(0, 0, 0, WH); g.addColorStop(0, 'rgba(4,30,46,0)'); g.addColorStop(0.45, 'rgba(4,30,46,.28)'); g.addColorStop(1, 'rgba(4,30,46,.55)'); ctx.fillStyle = g; ctx.fillRect(0, 0, WW, WH); } // t314u: wallpaper = spectators silhouetted in front of the glass
  else { const g = ctx.createLinearGradient(0, 0, 0, WH); g.addColorStop(0, '#6d8f9a'); g.addColorStop(0.12, '#6d8f9a'); g.addColorStop(0.13, '#f2dfb2'); g.addColorStop(1, '#e6cd96'); ctx.fillStyle = g; ctx.fillRect(0, 0, WW, WH);
  ctx.fillStyle = 'rgba(160,120,60,.12)'; for (let x = 0; x < WW; x += 46) ctx.fillRect(x, WH * 0.13, 2, WH); }
  const t = now / 1000, lanes = [WH * 0.6, WH * 0.9];
  for (let i = walkers.length - 1; i >= 0; i--) { const w = walkers[i]; w.alpha = clamp(w.alpha + (w.leaving ? -dt * 1.5 : dt * 1.5), 0, 1); if (w.leaving && w.alpha <= 0) walkers.splice(i, 1); }
  const said = chatBalloons();
  const order = walkers.slice().sort((a, b) => a.lane - b.lane || (a.me ? 1 : 0) - (b.me ? 1 : 0));
  for (const w of order) {
    if (w.pause > 0) { w.pause -= dt; if (w.emoteT > 0) w.emoteT -= dt; }
    else { w.x += w.dir * w.sp * dt / WW; if (w.x < 0.03) { w.x = 0.03; w.dir = 1; } if (w.x > 0.97) { w.x = 0.97; w.dir = -1; } if (Math.random() < dt * 0.12) { w.pause = rand(1.5, 4); if (Math.random() < 0.6) { w.emote = CFG.emotes[Math.floor(Math.random() * CFG.emotes.length)]; w.emoteT = w.pause; } } }
    const size = w.lane ? clamp(WH * 0.36, 28, 42) : clamp(WH * 0.28, 22, 34), x = w.x * WW, y = lanes[w.lane], bob = w.pause > 0 ? 0 : Math.abs(Math.sin(t * 7 + w.ph)) * 4;
    ctx.save(); ctx.globalAlpha = w.alpha * (w.lane ? 1 : 0.92);
    ctx.fillStyle = 'rgba(80,60,30,.18)'; ctx.beginPath(); ctx.ellipse(x, y - 2, size * 0.38, size * 0.1, 0, 0, Math.PI * 2); ctx.fill();
    ctx.translate(x, y - bob); if (w.dir > 0 && w.pause <= 0) ctx.scale(-1, 1);
    ctx.font = size + 'px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom'; if (WP) { ctx.globalAlpha = w.alpha; ctx.shadowColor = 'rgba(255,255,255,.55)'; ctx.shadowBlur = 8; } ctx.fillText(w.em, 0, 0); ctx.restore(); /* t314u: wallpaper spectators get a soft glow so they read on the dark glass */
    if (w.emoteT > 0 && w.emote) { ctx.save(); ctx.globalAlpha = w.alpha; ctx.font = '16px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif'; ctx.textAlign = 'center'; ctx.fillText(w.emote, x + size * 0.45, y - size - bob - 2); ctx.restore(); }
    if (!w.npc && said.has(w.key)) { if (balCtx) bq.push([said.get(w.key), x, y - size - bob - 20 + BLIFT, w.alpha, w.me]); else balloon(ctx, said.get(w.key), x, y - size - bob - 30, w.alpha); }
    if (!w.npc) label(ctx, w.name + (w.gm ? ' (GM)' : '') + (w.me ? ' · ' + T('you') : ''), x, y - size - bob - 10, { size: 11, alpha: w.alpha, bg: w.me ? '#ff7a6b' : 'rgba(255,255,255,.92)', fg: w.me ? '#fff' : (w.gm ? '#a3271e' : '#0f5c7a') });
  }
  bq.sort((p, q) => (p[4] ? 1 : 0) - (q[4] ? 1 : 0)); for (const b of bq) balloon(balCtx, b[0], b[1], b[2], b[3]); if (bq.length) PERF.balDirty = true;
}
/* t325u: resize was a full re-alloc + sync buildBg on EVERY call (ResizeObserver + window resize both fire; the phone keyboard / URL bar
   fire resize without a size change). Setting canvas.width clears it, and ResizeObserver runs after rAF and before paint → a blank
   (placeholder-gradient) frame = the flicker. Now: no-op when nothing changed, and a real change repaints immediately. */
let rsKey = '';
function tankDpr() { const d = Math.min(2, root.devicePixelRatio || 1); return Math.round(Math.max(1, Math.min(d, Math.sqrt(PX_BUDGET / Math.max(1, TW * TH)))) * 100) / 100; }
function measureView() { const sc = $('tankScroll'); if (!sc || WP) { PERF.cull = false; return; } if (!(sc.scrollWidth > sc.clientWidth + 4)) { PERF.cull = false; return; }
  const r = tank.getBoundingClientRect(), rs = sc.getBoundingClientRect(), vw = rs.width, m = vw * 0.4; PERF.vx0 = rs.left - r.left - m; PERF.vx1 = rs.left - r.left + vw + m; PERF.cull = PERF.vx1 - PERF.vx0 < TW * 0.9; }
function resize(force) {
  const r = tank.getBoundingClientRect(), r2 = walk.getBoundingClientRect();
  TW = Math.max(200, r.width); TH = Math.max(160, r.height); WW = Math.max(200, walk.clientWidth || r2.width); WH = Math.max(60, walk.clientHeight || r2.height);
  DPR = tankDpr(); WDPR = Math.min(2, root.devicePixelRatio || 1); PERF.scrollAt = performance.now(); measureView();
  const key = [TW, TH, WW, WH, DPR, WDPR].join(','); if (key === rsKey && force !== true) return; const bgKey = [TW, TH, DPR].join(','), bgSame = rsKey && rsKey.split(',').slice(0, 2).concat(rsKey.split(',')[4]).join(',') === bgKey; rsKey = key; PERF.resizes++;
  const tw = Math.round(TW * DPR), th = Math.round(TH * DPR), ww = Math.round(WW * WDPR), wh = Math.round(WH * WDPR);
  if (tank.width !== tw || tank.height !== th) { tank.width = tw; tank.height = th; } if (walk.width !== ww || walk.height !== wh) { walk.width = ww; walk.height = wh; }
  if (!bgSame || !bgCanvas) { buildBg(); PERF.rebuilds++; }
  try { const n = performance.now(); drawTank(0, n); drawWalk(0, n); } catch (e) {} // paint now: no blank frame between re-alloc and the next rAF
}
let lastT = performance.now();
function frame(now) {
  /* t325u: behind an open dialog (its backdrop is a blur of the page) the tank holds its last frame still instead of re-rendering
     tank + full-screen blur 60x/s (heavy on phones, shimmered on Safari); resumes without a jump */
  if (PERF.modal && paintFade >= 1 && !WP) { lastT = now; PERF.frozen = true; root.requestAnimationFrame(frame); return; } PERF.frozen = false;
  if (PERF.cull && now - PERF.scrollAt < 450) PERF.cull = false, PERF.recull = 1; else if (PERF.recull && now - PERF.scrollAt >= 450) { PERF.recull = 0; measureView(); }
  let dt = Math.min(0.1, (now - lastT) / 1000); lastT = now; if (reduce) dt *= 0.5;
  try { drawTank(dt, now); drawWalk(dt, now); } catch (e) { if (!frame.err) { frame.err = 1; console.error(e); } }
  root.requestAnimationFrame(frame);
}

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
let gmSizes = loadJSON('drawquarium.gmsz', {}); if (!gmSizes || typeof gmSizes !== 'object' || Array.isArray(gmSizes)) gmSizes = {};
const saveGmSizes = () => { const k = Object.keys(gmSizes); if (k.length > 300) for (const x of k.slice(0, k.length - 300)) delete gmSizes[x]; setLS('drawquarium.gmsz', JSON.stringify(gmSizes)); };
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
  for (const id of sim.keys()) if (!s.cr.some(c => c.id === id)) { const m = sim.get(id); if (m && m.cr) leaveFx(m, m.cr, sprites.get(id)); sim.delete(id); sprites.delete(id); } // t331u: leavers swim off to the side
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
  { const ids = new Set(s.cr.map(c => c.id)); if (knownIds) for (const c of s.cr) if (!knownIds.has(c.id) && !sim.has(c.id) && nowMs() - c.at < 20000) { if (!spawn(c, true).drop) SFX.splash(); } knownIds = ids; }
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
      if (s.sd && !s.cr.length && cache && !room.local && DQ.arr(cache.cr).length) DQ.merge(s, DQ.arr(cache.cr).filter(c => !s.del.includes(c.id)), nowMs()); // t322u: an emptied overflow room gets the cached tank back
      if (!s.sd) { if (cache && !room.local) { s.del = DQ.arr(s.del).concat(DQ.arr(cache.del)).slice(-DQ.LIM.delKeep); DQ.merge(s, cache.cr, nowMs()); } s.sd = 1; }
      if (isGM) DQ.merge(s, gmStore.filter(x => !s.del.includes(x.id)), nowMs());
      if (carry && !room.local) { s.del = DQ.arr(s.del).concat(DQ.arr(carry.del).filter(id => !s.del.includes(id))).slice(-DQ.LIM.delKeep); DQ.merge(s, carry.cr.filter(c => !s.del.includes(c.id)), nowMs()); } // t322u: a room hop brings the tank along
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
    const opts = { displayName: myName || 'Tamu' };
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
  if (mine && joinable(mine) && people(mine) >= people(pick)) return; // t351u: ours is reachable and at least as full: others will come here
  lastHop = Date.now(); const carry = { cr: room.s.cr.slice(), del: DQ.arr(room.s.del).slice() }; saveTank();
  root.DQRoomHop = { from: room.code, to: pick.code, at: Date.now() };
  try { await enterOnline(carry); } catch (e) { /* stay offline-safe: next ping retries */ }
}
async function goLocal() {
  const r = new N.Room(new N.LocalLink(ls), { onChange: () => { if (room === r) onRoom(); } });
  await r.enter('local', { displayName: myName || 'Kamu' }); room = r; mode = 'local'; onRoom(); await hello(true).catch(() => {}); markReady(r); return r;
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
  $('nameInput').value = ''; /* t367u: never prefill (placeholder JadiDaring) */ nameLockNote(); $('gateGm').hidden = !isGM; $('gateErr').textContent = ''; renderAv(); renderGateLang(); $('gate').hidden = false; if (!JDME) setTimeout(() => $('nameInput').focus(), 30);
}
function renderAv() {
  const box = $('avPick'); box.textContent = '';
  CFG.avatars.forEach((a, i) => { const b = doc.createElement('button'); b.type = 'button'; b.setAttribute('role', 'radio'); b.setAttribute('aria-checked', String(i === myAv)); b.textContent = a; b.addEventListener('click', () => { myAv = i; renderAv(); }); box.appendChild(b); });
}
$('gateForm').addEventListener('submit', e => {
  e.preventDefault(); const n = JDME ? accountName() : DQ.cleanText($('nameInput').value, DQ.LIM.nameMax); if (!n) { $('gateErr').textContent = T('needName'); return; }
  const first = !room; myName = n; if (!JDME) setLS(KEYS.name, n); try { sessionStorage.setItem('jdng.drawquarium', n); } catch (x) {} setLS(KEYS.av, String(myAv)); setLS(KEYS.lang, lang); /* t325u: confirm the gate language */ $('gate').hidden = true; renderStatus();
  if (!getLS('drawquarium.howSeen')) { setLS('drawquarium.howSeen', '1'); setTimeout(openHow, 350); }
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
let mk = { kind: 'fish', strokes: [], tool: 'p', c: 3, w: 3, cur: null };
function previewKinds() {
  for (const [id, k, ops] of [['pickFish', 'fish', [{ m: 'f', c: 3, w: 1, p: [] }, { m: 'p', c: 4, w: 4, p: [[120, 120], [110, 185], [120, 250]] }, { m: 'p', c: 0, w: 3, p: [[382, 166]] }]], ['pickJelly', 'jelly', [{ m: 'f', c: 9, w: 1, p: [] }, ...[0, 1, 2, 3, 4, 5].map(i => ({ m: 'p', c: 15, w: 3, p: [[122 + i * 47, 220], [104 + i * 47, 260], [140 + i * 47, 300], [122 + i * 47, 340]] })), { m: 'p', c: 1, w: 3, p: [[170, 110], [210, 80]] }]]]) {
    const cv = $(id).querySelector('canvas'), ctx = cv.getContext('2d'); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cv.width, cv.height); ctx.scale(cv.width / B.w, cv.height / B.h); drawGuide(ctx, k, true); paint(ctx, ops, k);
  }
}
function openMaker() { mk.back = false; $('chooseStep').hidden = false; $('drawStep').hidden = true; $('maker').hidden = false; doc.documentElement.classList.add('jr-hub-off'); previewKinds(); setTimeout(() => $('pickFish').focus(), 30); }
function closeMaker() { $('maker').hidden = true; doc.documentElement.classList.remove('jr-hub-off'); }
function startDraw(kind) {
  const keep = mk.back && kind === mk.kind && mk.strokes.length > 0; mk.back = false; // t214u: "Ganti bentuk" then the same shape keeps the drawing
  if (!keep) { mk.kind = kind; mk.strokes = []; mk.cur = null; mk.tool = 'p'; mk.c = kind === 'fish' ? 3 : 9; }
  $('chooseStep').hidden = true; $('drawStep').hidden = false; $('drawErr').textContent = '';
  $('drawTitle').textContent = T(kind === 'fish' ? 'drawTitleFish' : 'drawTitleJelly'); $('critterLabel').textContent = T(kind === 'fish' ? 'critterName' : 'critterNameJelly'); if (!keep) $('critterInput').value = '';
  gctx.setTransform(2, 0, 0, 2, 0, 0); gctx.clearRect(0, 0, B.w, B.h); drawGuide(gctx, kind, false);
  renderTools(); redraw();
}
function redraw() { bctx.setTransform(2, 0, 0, 2, 0, 0); bctx.clearRect(0, 0, B.w, B.h); const r = paint(bctx, mk.strokes, mk.kind); bctx.__last = r; bctx.__leak = r === 0 && floodLeak; }
function renderTools() {
  const pal = $('palette'); pal.textContent = '';
  PAL.forEach((col, i) => { const b = doc.createElement('button'); b.type = 'button'; b.style.background = col; b.setAttribute('role', 'radio'); b.setAttribute('aria-checked', String(i === mk.c)); b.setAttribute('aria-label', T('color') + ' ' + (i + 1)); b.addEventListener('click', () => { mk.c = i; if (mk.tool === 'e') mk.tool = 'p'; renderTools(); }); pal.appendChild(b); });
  const sz = $('sizes'); sz.textContent = '';
  W8.forEach((w, i) => { const b = doc.createElement('button'); b.type = 'button'; b.setAttribute('role', 'radio'); b.setAttribute('aria-checked', String(i + 1 === mk.w)); b.setAttribute('aria-label', T('size') + ' ' + (i + 1)); const dot = doc.createElement('i'); const d = Math.max(4, Math.round(w * 0.7)); dot.style.width = dot.style.height = d + 'px'; b.appendChild(dot); b.addEventListener('click', () => { mk.w = i + 1; renderTools(); }); sz.appendChild(b); });
  for (const [id, t] of [['toolPen', 'p'], ['toolEraser', 'e'], ['toolBucket', 'b']]) { $(id).classList.toggle('on', mk.tool === t); $(id).setAttribute('aria-pressed', String(mk.tool === t)); }
  board.classList.toggle('bucket', mk.tool === 'b'); board.classList.toggle('erase', mk.tool === 'e');
}
function boardPt(e) { const r = board.getBoundingClientRect(); return [clamp((e.clientX - r.left) / r.width * B.w, 0, B.w), clamp((e.clientY - r.top) / r.height * B.h, 0, B.h)]; }
board.addEventListener('pointerdown', e => {
  if (e.button !== undefined && e.button > 0) return; e.preventDefault(); try { board.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
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
$('toolClear').addEventListener('click', () => { mk.strokes = []; redraw(); });
$('pickFish').addEventListener('click', () => startDraw('fish'));
$('pickJelly').addEventListener('click', () => startDraw('jelly'));
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
  submitting = true; $('submitBtn').disabled = true; let result = null;
  try {
    await room.edit('add', s => {
      const r = DQ.addCreature(s, c, nowMs()); result = r; if (!r.ok) return null;
      DQ.sysChat(s, 'add', room.me, myName, r.c.nm, nowMs()); if (r.culled) DQ.sysChat(s, 'gone', 0, '', r.culled.nm, nowMs());
      DQ.ping(s, room.me, myName, myAv, nowMs(), null); if (isGM) s.gm[DQ.K(room.me)] = 1;
    }, { id: c.id, k: c.k });
    if (!result || !result.ok) { toast(T(result && (result.err === 'full' || result.err === 'space') ? result.err : 'sendFail'), true); return; }
    if (isGM && !gmStore.some(x => x.id === result.c.id)) { gmStore.push(result.c); saveGm(); }
    if (!spawn(result.c, true).drop) SFX.splash(); closeMaker(); toast(T('added', { name: result.c.nm }));
    if (result.culled) setTimeout(() => toast(T('culled', { name: result.culled.nm }), true), 400);
  } catch (err) { toast(T(err && err.code === 'toolarge' ? 'tooBig' : 'sendFail'), true); }
  finally { submitting = false; $('submitBtn').disabled = false; }
});

/* ---------- creature info ---------- */
let infoId = null, infoTimer = null;
function openInfo(id) {
  const c = creatures().find(x => x.id === id); if (!c) return; infoId = id;
  drawStill($('infoPic'), c); $('infoName').textContent = c.nm; $('infoImm').hidden = !c.im;
  $('infoKind').textContent = (c.k === 'jelly' ? '🪼 ' : '🐟 ') + T(c.k);
  $('infoBy').textContent = c.bn;
  try { $('infoAt').textContent = new Date(c.at).toLocaleString(lang === 'id' ? 'id-ID' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short' }); } catch (e) { $('infoAt').textContent = new Date(c.at).toLocaleString(); }
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
    const nm = doc.createElement('strong'); nm.textContent = (c.k === 'jelly' ? '🪼 ' : '🐟 ') + c.nm; tx.appendChild(nm);
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
    if (gone) { gmStore = gmStore.filter(x => x.id !== c.id); saveGm(); { const m = sim.get(c.id); if (m && m.cr) leaveFx(m, m.cr, sprites.get(c.id)); } sim.delete(c.id); toast(T('deleted', { name: c.nm })); }
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
  const cv = stickerBlob(c), name = (DQ.cleanText(c.nm, 20).replace(/[^\p{L}\p{N}_-]+/gu, '-').replace(/^-+|-+$/g, '') || 'drawquarium') + '-sticker.png';
  const go = url => { const a = doc.createElement('a'); a.href = url; a.download = name; doc.body.appendChild(a); a.click(); a.remove(); };
  if (cv.toBlob) cv.toBlob(b => { if (!b) return go(cv.toDataURL('image/png')); const u = URL.createObjectURL(b); go(u); setTimeout(() => URL.revokeObjectURL(u), 4000); }, 'image/png'); else go(cv.toDataURL('image/png'));
});
root.DQSticker = id => { const c = creatures().find(x => x.id === id); return c ? stickerBlob(c).toDataURL('image/png') : ''; };
function paintMute() { const b = $('muteBtn'); b.textContent = muted ? '🔇' : '🔊'; const t = T(muted ? 'unmute' : 'mute'); b.title = t; b.setAttribute('aria-label', t); b.setAttribute('aria-pressed', muted ? 'true' : 'false'); }
$('muteBtn').addEventListener('click', () => { muted = !muted; setLS('drawquarium.mute', muted ? '1' : '0'); paintMute(); ambGesture(); ambSync(); if (!muted) SFX.tap(); muteFlash(); });
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
  sel.value = lang; if (!$('drawStep').hidden) { $('drawTitle').textContent = T(mk.kind === 'fish' ? 'drawTitleFish' : 'drawTitleJelly'); $('critterLabel').textContent = T(mk.kind === 'fish' ? 'critterName' : 'critterNameJelly'); }
  renderGateLang(); chatSig = ''; renderStatus(); renderChat();
}
$('langSel').addEventListener('change', e => { lang = e.target.value; setLS(KEYS.lang, lang); applyLang(); });

/* ---------- boot ---------- */
applyLang();
if (root.ResizeObserver) new ResizeObserver(() => resize()).observe(tank); else root.addEventListener('resize', resize);
{ const sc = $('tankScroll'); const centre = () => { if (sc.scrollWidth > sc.clientWidth + 4) sc.scrollLeft = (sc.scrollWidth - sc.clientWidth) / 2; measureView(); }; setTimeout(centre, 60);
  sc.addEventListener('scroll', () => { PERF.scrollAt = performance.now(); }, { passive: true }); } // t325u: full-width paint while panning, culled again 450 ms after
/* t325u: any open dialog (gate, maker, info, list, how, GM) freezes the tank frame behind its blurred backdrop */
{ const ms = [...doc.querySelectorAll('.modal')], upd = () => { PERF.modal = ms.some(m => !m.hidden); }; upd(); if (root.MutationObserver) { const mo = new MutationObserver(upd); for (const m of ms) mo.observe(m, { attributes: true, attributeFilter: ['hidden'] }); } }
root.DQPerf = { get: () => Object.assign({ DPR, WDPR, TW, TH, px: tank.width * tank.height }, PERF) };
root.addEventListener('resize', resize);
resize(); root.requestAnimationFrame(frame);
setInterval(() => { if (room) { room.tick(); syncVisitors(visitors()); renderStatus(); try { renderList(); } catch (e) {} } }, 1000);
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
else if (myName && (() => { try { return navigator.webdriver && !localStorage.getItem('jdng.force') ? '1' : sessionStorage.getItem('jdng.drawquarium'); } catch (x) { return ''; } })()) connect(); else openGate(); // t367u: name modal first on every new visit (tab session)
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

root.DQApp = { roomCheck: f => { if (f) lastHop = 0; return roomCheck(); }, pickRoom, openList, setMenu, setHist, balloons: () => [...chatBalloons()], get room() { return room; }, get mk() { return mk; }, redraw: () => redraw(), get mode() { return mode; }, sim, walkers, hits: () => hits, get gmStore() { return gmStore; }, conn, openInfo, dbg: () => ({ isGM, gmSizes }) };
})(window);

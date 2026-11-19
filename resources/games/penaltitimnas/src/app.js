/* Penalti Timnas app: home, offline vs bot / tutorial / demo, online 1v1 (host-authoritative kick sequencing), audio, chat. */
(function () {
'use strict';
const P = window.PT, R = window.PR, J = window.JDK, $ = J.$, toast = J.toast;
const NAME_KEY = 'penaltitimnas.name', KIT_KEY = 'penaltitimnas.kit', DIFF_KEY = 'penaltitimnas.diff', STAT_KEY = 'penaltitimnas.stat', TUT_KEY = 'penaltitimnas.tut';
const PICK_MS = 9000, NEXT_MS = 6200, MAXP = 2;
const DEMO = /demo/i.test(location.hash);
let kit = J.getLS(KIT_KEY) || 'merah', diff = +(J.getLS(DIFF_KEY) || 1);
if (!P.KITS.some(k => k.id === kit)) kit = 'merah'; if (!(diff >= 0 && diff < 4)) diff = 1;
const stat = (() => { try { return Object.assign({ w: 0, l: 0, g: 0, s: 0, st: 0, best: 0 }, JSON.parse(J.getLS(STAT_KEY) || '{}')); } catch (e) { return { w: 0, l: 0, g: 0, s: 0, st: 0, best: 0 }; } })();
const myName = () => ($('nameInput').value || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 16);
/* ---------- audio ---------- */
const S = {
  whistle() { J.tone(2900, 0.16, 'sine', 0.08, 2750); J.tone(2900, 0.32, 'sine', 0.08, 2600, 0.2); },
  kick() { J.tone(140, 0.12, 'sine', 0.3, 45); J.noise(0.05, 0.25, 1800); },
  net() { J.noise(0.4, 0.14, 0, 0, 2200); },
  post() { J.tone(880, 0.6, 'triangle', 0.12, 860); J.tone(1320, 0.4, 'sine', 0.05, 1300); },
  roar() { J.noise(2.4, 0.3, 0, 0, 1100); J.noise(1.6, 0.12, 2500, 0.1); },
  groan() { J.noise(1.3, 0.16, 0, 0, 420); J.tone(220, 0.9, 'sawtooth', 0.025, 140); },
  save() { J.noise(0.12, 0.22, 900); this.roar(); },
  tap() { J.tone(520, 0.05, 'square', 0.04); },
  chat() { J.tone(990, 0.06, 'sine', 0.05); },
  chant() { const seq = [392, 392, 392, 466]; seq.forEach((f, i) => { J.tone(f, 0.22, 'sawtooth', 0.025, f * 0.98, i * 0.24); J.tone(f / 2, 0.22, 'triangle', 0.05, 0, i * 0.24); }); [1.15, 1.4, 1.65].forEach(d => J.noise(0.06, 0.35, 1500, d)); },
};
let amb = null;
function ambience(on) {
  const a = J.ac(); if (!a) return; if (!amb) { const len = a.sampleRate * 2, b = a.createBuffer(1, len, a.sampleRate), ch = b.getChannelData(0); let last = 0; for (let i = 0; i < len; i++) { last = last * 0.97 + (Math.random() * 2 - 1) * 0.03; ch[i] = last * 6; } const s = a.createBufferSource(); s.buffer = b; s.loop = true; const f = a.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 700; f.Q.value = 0.6; const gn = a.createGain(); gn.gain.value = 0; s.connect(f).connect(gn).connect(a.destination); s.start(); amb = gn; }
  amb.gain.setTargetAtTime(on && !J.Snd.muted ? 0.05 : 0, a.currentTime, 0.4);
}
/* ---------- home UI ---------- */
function paintKits() { $('kitPick').innerHTML = P.KITS.map(k => '<button class="kit" role="radio" aria-checked="' + (k.id === kit) + '" data-k="' + k.id + '"><canvas width="80" height="80"></canvas>' + J.esc(k.n) + '</button>').join(''); $('kitPick').querySelectorAll('.kit').forEach((b, i) => R.kitIcon(b.querySelector('canvas'), P.KITS[i])); }
function paintDiff() { $('diffPick').innerHTML = P.BOTS.map((b, i) => '<button data-v="' + i + '" class="' + (i === diff ? 'on' : '') + '">' + ['Mudah', 'Sedang', 'Sulit', 'Juara'][i] + '</button>').join(''); $('botSub').textContent = 'Lawan ' + P.BOTS[diff].n + ' · 5 tendangan, offline'; }
function paintStat() { const n = stat.w + stat.l; $('statTitle').textContent = n ? stat.w + ' menang · ' + stat.l + ' kalah' : 'Rekor'; $('statSub').textContent = n ? 'Gol ' + stat.g + ' · tepisan ' + stat.s + ' · beruntun ' + stat.best : 'Belum main'; }
function saveStat() { J.setLS(STAT_KEY, JSON.stringify(stat)); paintStat(); }
/* ---------- match engine ---------- */
let M = null; // {mode, names[2], kits[2], bots[2] (null|skill obj), me side, seed, kicks[], shown, phase, anim, aimAt, n}
const hist = []; // my shots (bot reads them)
function newMatch(mode, o) {
  M = Object.assign({ mode, names: ['Kamu', 'Bot'], kits: [P.kitOf(kit), P.kitOf('putih')], bots: [null, P.BOTS[diff]], side: 0, seed: (Math.random() * 1e9) | 0, kicks: [], res: [], shown: 0, phase: 'idle', anim: null, n: -1, aimT0: 0, end: null }, o || {});
  if (M.kits[0].id === M.kits[1].id) M.kits[1] = P.kitOf(M.kits[0].id === 'merah' ? 'putih' : 'merah');
  return M;
}
const kickerSide = n => n % 2, keeperSide = n => 1 - n % 2;
function tallyM() { return P.tally(M.res); }
function outcomeOf(n, k) { return P.resolve(k.s, k.d, (M.seed + n * 7919) >>> 0); }
/* offline sequencing */
function offStartKick() {
  const t = tallyM(); if (t.done) return finish(t);
  const n = M.kicks.length, k = { t: Date.now() }; M.kicks.push(k); beginAim(n);
  const ks = kickerSide(n), gs = keeperSide(n), r = P.rng(M.seed + n * 31);
  if (M.bots[ks] && (!M.tut || n > 99)) k.s = P.botShot(M.bots[ks].skill, r);
  if (M.tut && M.bots[ks]) k.s = P.botShot(0.2, r);
  if (M.bots[gs]) k.d = M.tut ? { x: 0, y: 0.35 } : P.botDive(M.bots[gs].read, hist.slice(-4), r);
  if (M.side < 0) setTimeout(() => offCheck(), 900 + r() * 900);
}
function offCheck() { const n = M.kicks.length - 1, k = M.kicks[n]; if (k && k.s && k.d && M.shown === n && M.phase === 'aim') playKick(n); }
function myPick(kind, v) {
  if (!M || M.phase !== 'aim') return; const n = M.n, k = M.kicks[n]; if (!k || k[kind]) return;
  if (kind === 's') hist.push({ x: v.x, y: v.y });
  if (M.mode !== 'online') { k[kind] = v; M.picked = kind; setRole(); offCheck(); return; }
  M.picked = kind; M.pend = { n, kind, v }; setRole();
  shell.edit('pick', s => { if (s.ph !== 'play' || s.g !== M.g || !Array.isArray(s.k) || s.k.length - 1 !== n) return null; const kk = s.k[n]; if (kk[kind]) return null; kk[kind] = v; });
}
function beginAim(n) { M.n = n; M.phase = 'aim'; M.picked = null; M.pend = null; M.aim = null; M.keep = null; M.aimT0 = performance.now(); M.anim = null; $('replayBtn').hidden = true; S.whistle(); setRole(); board(); coachFor(n); }
function playKick(n) {
  const k = M.kicks[n]; const o = outcomeOf(n, k); k.o = o; M.shown = n + 1; M.phase = 'anim'; M.anim = { o, t: 0, n, kKit: M.kits[kickerSide(n)], gKit: keeperKitOf(keeperSide(n)), num: String([10, 7, 9, 11, 8][Math.floor(n / 2) % 5]) }; M.aim = null; M.keep = M.keep && { x: M.keep.x, y: M.keep.y };
  M.fired = false; setRole(); S.kick();
}
function keeperKitOf(side) { const k = M.kits[side]; return { a: k.id === 'hijau' ? '#ff7a1a' : '#24b04a', b: '#111', c: '#fff' }; }
function onArrive(A) {
  const o = A.o, n = A.n; M.res[n] = o.goal; M.fired = true; const ks = kickerSide(n), mine = M.side === ks, keepMine = M.side === keeperSide(n);
  const [bx, by] = R.g2s(L, o.x, o.y);
  callout(P.LABEL[o.out], o.out === 'goal' ? 'goal' : o.out === 'save' ? 'save' : '', sublineFor(o, n));
  if (o.goal) { S.net(); S.roar(); setTimeout(() => S.chant(), 900); R.burst(bx, by, 60, ['#e0242f', '#ffffff', '#ffd23f']); ex = 1; J.buzz(mine ? [30, 40, 60] : 40); }
  else if (o.out === 'save') { S.save(); R.burst(bx, by, 26, ['#9cff5a', '#ffffff']); ex = 0.8; J.buzz(keepMine ? [30, 40, 60] : 50); }
  else if (o.out === 'post' || o.out === 'bar') { S.post(); setTimeout(() => S.groan(), 300); ex = 0.4; }
  else { S.groan(); ex = 0.2; }
  if (M.mode !== 'online' || M.side >= 0) { if (mine && o.goal) stat.g++; if (keepMine && !o.goal && o.out === 'save') stat.s++; }
  board();
}
function sublineFor(o, n) { const kn = M.names[kickerSide(n)], gn = M.names[keeperSide(n)]; if (o.goal) return kn + ' mencetak gol'; if (o.out === 'save') return gn + ' menebak tepat!'; if (o.out === 'post' || o.out === 'bar') return 'Aduh, membentur ' + (o.out === 'bar' ? 'mistar' : 'tiang'); return kn + ' gagal (' + (o.p > 1 ? 'kekencangan' : 'meleset') + ')'; }
function afterAnim(n) {
  const o = M.kicks[n].o, dramatic = o.out === 'save' || o.out === 'post' || o.out === 'bar' || tallyM().done || (n >= 8);
  $('replayBtn').hidden = false;
  if (dramatic && !M.noReplay) startReplay(n, () => nextAfter(n)); else { M.phase = 'gap'; M.gapUntil = performance.now() + 900; M.gapN = n; }
}
function startReplay(n, then) { const o = M.kicks[n].o; M.phase = 'replay'; M.anim = Object.assign({}, M.anim || {}, { o, t: Math.max(0.3, R.arriveT(o) - 0.5), n, replay: true, then, kKit: M.kits[kickerSide(n)], gKit: keeperKitOf(keeperSide(n)) }); $('replayBtn').hidden = true; }
function nextAfter(n) { M.phase = 'gap'; M.gapUntil = performance.now() + 500; M.gapN = n; }
function gapDone() {
  if (M.mode === 'online') { M.phase = 'idle'; onlineSync(); return; }
  M.phase = 'idle'; offStartKick();
}
function finish(t) {
  M.phase = 'end'; ambience(false); const me = M.side; let title = '', sub = '';
  const nameW = M.names[t.win];
  if (me < 0) { title = nameW + ' menang!'; } else if (t.win === me) { title = 'MENANG! 🏆'; sub = 'Kamu juara adu penalti'; } else { title = 'Kalah tipis…'; sub = nameW + ' lebih dingin di titik putih'; }
  if (me >= 0 && !M.tut && M.mode !== 'demo') { if (t.win === me) { stat.w++; stat.st++; stat.best = Math.max(stat.best, stat.st); } else { stat.l++; stat.st = 0; } saveStat(); }
  if (M.tut) { J.setLS(TUT_KEY, '1'); title = 'Tutorial selesai!'; sub = 'Siap lawan bot atau tantang teman.'; }
  $('resTitle').textContent = title; $('resSub').textContent = sub + (t.sudden ? ' · lewat sudden death' : '');
  $('resBoard').innerHTML = [0, 1].map(s => '<div class="ln"><canvas width="64" height="64" style="width:32px;height:32px"></canvas><b>' + J.esc(M.names[s]) + (s === me ? ' (kamu)' : '') + '</b><span class="dots">' + (s ? t.b : t.a).map(g => '<i class="' + (g ? 'g' : 'x') + '"></i>').join('') + '</span><span class="n">' + (s ? t.sb : t.sa) + '</span></div>').join('');
  $('resBoard').querySelectorAll('canvas').forEach((c, i) => R.kitIcon(c, M.kits[i]));
  $('resNote').textContent = me >= 0 && M.mode !== 'online' && !M.tut ? 'Rekor: ' + stat.w + ' menang · beruntun ' + stat.st : '';
  const online = M.mode === 'online', host = online && shell.canRun();
  $('againBtn').hidden = online; $('toLobbyBtn').hidden = !host; $('endWait').textContent = online && !host ? 'Menunggu host kembali ke lobby…' : '';
  $('result').hidden = false; S.whistle(); setTimeout(() => S.whistle(), 400); if (t.win === me) setTimeout(() => S.chant(), 700);
}
/* ---------- HUD ---------- */
function board() {
  if (!M) return; const t = tallyM(), dots = (arr, n0) => { let h = ''; const len = Math.max(5, arr.length); for (let i = 0; i < len; i++) h += '<i class="' + (i < arr.length ? (arr[i] ? 'g' : 'x') : '') + '"></i>'; return h; };
  $('board').innerHTML = '<div class="tm"><span>' + J.esc(M.names[0]) + '</span><div class="dots">' + dots(t.a) + '</div></div><div><span class="sc">' + t.sa + '–' + t.sb + '</span>' + (t.sudden ? '<small class="sd">SUDDEN DEATH</small>' : '') + '</div><div class="tm"><span>' + J.esc(M.names[1]) + '</span><div class="dots">' + dots(t.b) + '</div></div>';
}
function setRole() {
  if (!M) return; const n = M.n, ks = kickerSide(n), el = $('role'); el.classList.remove('keep');
  let T = '', Sb = '';
  if (M.phase === 'aim') {
    if (M.side === ks) { T = 'KAMU MENENDANG'; Sb = M.picked ? 'Menunggu kiper lawan…' : 'Usap bola ke arah gawang'; }
    else if (M.side === keeperSide(n)) { T = 'KAMU JAGA GAWANG'; Sb = M.picked ? 'Menunggu penendang…' : 'Ketuk titik tebakanmu di gawang'; el.classList.add('keep'); }
    else { T = M.names[ks] + ' bersiap'; Sb = M.names[keeperSide(n)] + ' di bawah mistar'; }
  } else if (M.phase === 'anim' || M.phase === 'replay') { T = ''; Sb = ''; }
  $('roleT').textContent = T; $('roleS').textContent = Sb; $('roleT').hidden = !T; if (M.phase !== 'aim') $('timer').style.width = '0';
}
function callout(txt, cls, sub) { const c = $('callout'); c.innerHTML = '<b class="' + (cls || '') + '">' + J.esc(txt) + '</b>' + (sub ? '<small>' + J.esc(sub) + '</small>' : ''); clearTimeout(callout.t); callout.t = setTimeout(() => { c.innerHTML = ''; }, 1700); }
const COACH = { 0: 'Kamu menendang duluan. <b>Usap ke atas</b> dari bola ke titik di gawang. Usapan sedang = tenaga pas.', 1: 'Sekarang kamu kiper. <b>Ketuk</b> titik di gawang untuk menebak lompatan.', 2: 'Coba pojok atas: usap lebih panjang &amp; agak miring. Jangan kekencangan!', 3: 'Bot suka menendang ke pojok. Tebak sisi yang kosong.' };
function coachFor(n) { const c = $('coach'); if (M.tut && COACH[n]) { c.innerHTML = COACH[n]; c.hidden = false; } else c.hidden = true; }
function bubble(name, x) { const b = $('bubbles'), p = document.createElement('p'); p.textContent = name + ': ' + x; b.appendChild(p); while (b.children.length > 3) b.firstChild.remove(); setTimeout(() => p.remove(), 4200); }
/* ---------- canvas + input ---------- */
const cv = $('cv'); let L = null, G = null, ex = 0, last = performance.now();
function frame(now) {
  requestAnimationFrame(frame); const dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (!$('home').hidden) { heroFrame(now, dt); return; }
  if ($('play').hidden || !M) return;
  const f = J.fitCanvas(cv); G = f.g; L = R.layout(f.W, f.H); ex = Math.max(0, ex - dt * 0.35);
  if (M.phase === 'anim' && M.anim) { M.anim.t += dt; const A = M.anim; if (!M.fired && A.t >= R.arriveT(A.o)) onArrive(A); if (A.t >= R.animLen(A.o)) afterAnim(A.n); }
  else if (M.phase === 'replay' && M.anim) { M.anim.t += dt * 0.4; if (M.anim.t >= R.arriveT(M.anim.o) + 0.5) { const th = M.anim.then; M.anim = Object.assign({}, M.anim, { replay: false, t: R.animLen(M.anim.o) }); th && th(); } }
  else if (M.phase === 'gap' && now >= M.gapUntil) gapDone();
  if (M.phase === 'aim') timerTick(now);
  if (M.mode === 'online') onlineTick();
  G.clearRect(0, 0, f.W, f.H);
  R.scene(G, L, { now: now / 1000, dt, anim: M.anim, ex, aim: M.aim, keep: M.phase === 'aim' && M.side === keeperSide(M.n) ? Object.assign({ show: !M.picked }, M.keep || {}) : (M.phase === 'anim' && M.keep) ? M.keep : null, kKit: M.kits[kickerSide(Math.max(0, M.n))], gKit: keeperKitOf(keeperSide(Math.max(0, M.n))), num: '10' });
}
function timerTick(now) {
  let left;
  if (M.mode === 'online') { const k = M.kicks[M.n]; left = k ? (k.t + PICK_MS - shell.sNow()) / PICK_MS : 1; }
  else left = 1 - (now - M.aimT0) / (M.tut ? 1e9 : 12000);
  $('timer').style.width = Math.max(0, Math.min(1, left)) * 100 + '%';
  if (M.mode !== 'online' && left <= 0 && !M.picked) { const n = M.n; if (M.side === kickerSide(n)) myPick('s', { x: 0, y: 0.25, p: 0.4 }); else if (M.side === keeperSide(n)) myPick('d', { x: 0, y: 0.35 }); }
}
let drag = null;
const myRole = () => !M || M.phase !== 'aim' || M.picked ? '' : M.side === kickerSide(M.n) ? 'k' : M.side === keeperSide(M.n) ? 'g' : '';
function aimFrom(d) {
  const dx = d.x - d.x0, dy = d.y0 - d.y, S2 = (L.by - (L.gy - L.GH * 0.5)) / (L.H * 0.27);
  const [gx, gy] = R.s2g(L, L.cx + dx * S2 * 1.15, L.by - dy * S2);
  const pts = d.pts, a = pts[pts.length - 1], b = pts.find(p => a.t - p.t <= 110) || pts[0], sp = Math.hypot(a.x - b.x, a.y - b.y) / Math.max(16, a.t - b.t);
  return { x: P.clamp(gx, -1.7, 1.7), y: P.clamp(gy, 0, 1.7), p: P.clamp(sp / (L.H * 0.0031), 0.12, 1.35) };
}
cv.addEventListener('pointerdown', e => {
  const role = myRole(); if (!role || !L) return; const r = cv.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
  if (role === 'g') { const [gx, gy] = R.s2g(L, x, y); M.keep = { x: P.clamp(gx, -1, 1), y: P.clamp(gy, 0, 1) }; S.tap(); myPick('d', M.keep); return; }
  if (y < L.gy) return; drag = { x0: x, y0: y, x, y, pts: [{ x, y, t: e.timeStamp }] }; cv.setPointerCapture(e.pointerId);
});
cv.addEventListener('pointermove', e => { if (!drag) return; const r = cv.getBoundingClientRect(); drag.x = e.clientX - r.left; drag.y = e.clientY - r.top; drag.pts.push({ x: drag.x, y: drag.y, t: e.timeStamp }); if (drag.pts.length > 30) drag.pts.shift(); if (drag.y0 - drag.y > 20) M.aim = aimFrom(drag); });
cv.addEventListener('pointerup', e => { if (!drag) return; const d = drag; drag = null; if (d.y0 - d.y < 30) { M.aim = null; toast('Usap ke atas, ke arah gawang', '', 1400); return; } const a = aimFrom(d); M.aim = a; myPick('s', a); });
cv.addEventListener('pointercancel', () => { drag = null; if (M) M.aim = null; });
/* keyboard */
let kAim = null, kHold = 0;
document.addEventListener('keydown', e => {
  if ($('play').hidden || !M || /INPUT/.test(e.target.tagName)) return; const role = myRole();
  if (role === 'g' && /^[1-6]$/.test(e.key)) { const i = +e.key - 1, z = { x: [-0.66, 0, 0.66][i % 3], y: i < 3 ? 0.72 : 0.26 }; M.keep = z; myPick('d', z); }
  if (role === 'k') { kAim = kAim || { x: 0, y: 0.5, p: 0 }; const st = 0.12; if (e.key === 'ArrowLeft') kAim.x -= st; if (e.key === 'ArrowRight') kAim.x += st; if (e.key === 'ArrowUp') kAim.y += st; if (e.key === 'ArrowDown') kAim.y -= st; kAim.x = P.clamp(kAim.x, -1.5, 1.5); kAim.y = P.clamp(kAim.y, 0, 1.5); if (e.key === ' ' && !kHold) kHold = performance.now(); if (kHold) kAim.p = Math.min(1.35, (performance.now() - kHold) / 900); M.aim = Object.assign({}, kAim); if (/Arrow| /.test(e.key)) e.preventDefault(); }
});
document.addEventListener('keyup', e => { if (e.key === ' ' && kHold && myRole() === 'k') { kAim.p = Math.min(1.35, (performance.now() - kHold) / 900); kHold = 0; myPick('s', Object.assign({}, kAim)); kAim = null; } });
/* ---------- hero ---------- */
const hero = $('heroCv'); let heroA = null, heroNext = 0;
function heroFrame(now, dt) {
  const f = J.fitCanvas(hero), Lh = R.layout(f.W, f.H * 1.25); const r = Math.random;
  if (!heroA && now > heroNext) { const s = P.botShot(0.7, r), d = P.botDive(0, [], r); heroA = { o: P.resolve(s, d, (now | 0)), t: 0, kKit: P.kitOf(kit), gKit: { a: '#24b04a', b: '#111', c: '#fff' } }; }
  if (heroA) { heroA.t += dt; if (heroA.o.goal && !heroA.b && heroA.t > R.arriveT(heroA.o)) { heroA.b = 1; const [x, y] = R.g2s(Lh, heroA.o.x, heroA.o.y); R.burst(x, y, 30, ['#e0242f', '#fff', '#ffd23f']); } if (heroA.t > R.animLen(heroA.o)) { heroA = null; heroNext = now + 1200; } }
  f.g.clearRect(0, 0, f.W, f.H); R.scene(f.g, Lh, { now: now / 1000, dt, anim: heroA, ex: heroA && heroA.b ? 0.8 : 0.1, kKit: P.kitOf(kit), noKicker: true });
}
/* ---------- screens ---------- */
function startPlay() { J.show('play'); $('result').hidden = true; $('callout').innerHTML = ''; $('bubbles').innerHTML = ''; ambience(true); board(); }
function startBot(tut) {
  const nm = myName() || 'Kamu';
  newMatch(tut ? 'tut' : 'bot', { names: [nm, tut ? 'Pelatih' : P.BOTS[diff].n], kits: [P.kitOf(kit), P.kitOf(tut ? 'putih' : P.BOTS[diff].kit)], bots: [null, tut ? P.BOTS[0] : P.BOTS[diff]], tut: !!tut, noReplay: false });
  if (tut) M.tutLeft = 4; startPlay(); $('chatBtn').hidden = true; setTimeout(offStartKick, 600);
}
function startDemo() { newMatch('demo', { names: ['Garuda Merah', 'Gajah Putih'], kits: [P.kitOf('merah'), P.kitOf('putih')], bots: [P.BOTS[2], P.BOTS[2]], side: -1 }); startPlay(); setTimeout(offStartKick, 300); }
function toMenu() { if (M && M.mode === 'online') { shell.leave(true); } M = null; ambience(false); $('result').hidden = true; J.show('home'); }
/* tutorial ends after 4 kicks */
const _tally = tallyM; // eslint-friendly
function tutDone() { return M && M.tut && M.res.length >= 4; }
const _offStart = offStartKick;
offStartKick = function () { if (tutDone()) { const t = Object.assign(P.tally(M.res), { win: 0, done: true }); return finish(t); } return _offStart(); }; // eslint-disable-line no-func-assign
/* ---------- online ---------- */
let shell = null, hostSeen = {}, lastWrite = 0, kitSent = '';
function sideOf(s, id) { return s.m && Array.isArray(s.m.ids) ? s.m.ids.indexOf(id) : -1; }
function onRoom(r, data) {
  const s = r.s;
  if (s.ph === 'lobby') { if (M && M.mode === 'online') { M = null; $('result').hidden = true; } if ($('lobby').hidden) J.show('lobby'); shell.renderLobby(); paintVs(r); sendKit(r); return; }
  if (!s.m || !Array.isArray(s.k)) return;
  if (!M || M.mode !== 'online' || M.g !== s.g) {
    const ids = s.m.ids, names = s.m.nm, sd = sideOf(s, r.me);
    newMatch('online', { g: s.g, seed: s.seed >>> 0, names: names.slice(), kits: s.m.kt.map(P.kitOf), bots: ids.map(id => id ? null : P.BOTS[s.m.bs || 1]), side: sd, noReplay: false });
    startPlay(); $('chatBtn').hidden = false; hostSeen = {};
    const kk = s.k; for (let i = 0; i < kk.length; i++) { M.kicks[i] = Object.assign({}, kk[i]); if (kk[i].s && kk[i].d && i < kk.length - 1) { M.kicks[i].o = outcomeOf(i, kk[i]); M.res[i] = M.kicks[i].o.goal; M.shown = i + 1; } }
    board();
  }
  M.bots = s.m.ids.map(id => id ? null : P.BOTS[s.m.bs || 1]); M.names = s.m.nm.slice(); M.side = sideOf(s, r.me);
  for (let i = 0; i < s.k.length; i++) M.kicks[i] = Object.assign(M.kicks[i] || {}, s.k[i]);
  M.sph = s.ph; M.sres = s.res;
  onlineSync();
}
function onlineSync() {
  if (!M || M.mode !== 'online') return; const n = M.kicks.length - 1, k = M.kicks[n];
  if (M.phase === 'anim' || M.phase === 'replay' || M.phase === 'gap' || M.phase === 'end') return;
  if (M.shown < n) { for (let i = M.shown; i < n; i++) { const kk = M.kicks[i]; if (kk.s && kk.d) { kk.o = outcomeOf(i, kk); M.res[i] = kk.o.goal; } } M.shown = n; board(); }
  if (k && k.s && k.d && M.shown === n) { if (M.n !== n) beginAim(n); playKick(n); return; }
  if (M.sph === 'end' && M.shown >= M.kicks.length) { finish(tallyM()); return; }
  if (k && M.n !== n && M.shown === n) beginAim(n);
  if (M.phase === 'aim' && M.pend && M.pend.n === n && k[M.pend.kind]) M.pend = null;
}
function onlineTick() {
  const r = shell.room; if (!r || !shell.canRun(r) || !M || M.mode !== 'online' || M.sph !== 'play') return;
  const t = performance.now(); if (t - lastWrite < 350) return;
  const s = r.s, n = s.k.length - 1, k = s.k[n], now = shell.sNow(); if (!k) return;
  // replace departed players with a bot
  const seatedIds = r.seated().map(p => p.id);
  const gone = s.m.ids.map((id, i) => id && !seatedIds.includes(id) ? i : -1).filter(i => i >= 0);
  if (gone.length) { lastWrite = t; shell.edit('bot-in', st => { if (st.ph !== 'play') return null; for (const i of gone) { st.m.ids[i] = 0; st.m.nm[i] = st.m.nm[i] + ' (bot)'; } }); toast('Lawan keluar, bot menggantikan', 'warn', 3000); return; }
  const ks = kickerSide(n), gs = keeperSide(n), rr = P.rng((s.seed + n * 31) >>> 0);
  const need = {};
  if (!k.s && !s.m.ids[ks] && (k.d || now > k.t + 1200)) need.s = P.botShot((P.BOTS[s.m.bs || 1]).skill, rr);
  if (!k.d && !s.m.ids[gs] && (k.s || now > k.t + 1600)) need.d = P.botDive(P.BOTS[s.m.bs || 1].read, s.k.slice(0, n).filter((x, i) => kickerSide(i) === ks && x.s).slice(-4).map(x => x.s), rr);
  if (now > k.t + PICK_MS + 700) { if (!k.s) need.s = { x: 0, y: 0.25, p: 0.4 }; if (!k.d) need.d = { x: 0, y: 0.35 }; }
  if (need.s || need.d) { lastWrite = t; shell.edit('auto', st => { const q = st.k[n]; if (st.ph !== 'play' || st.k.length - 1 !== n) return null; if (need.s && !q.s) q.s = need.s; if (need.d && !q.d) q.d = need.d; }); return; }
  if (k.s && k.d) {
    if (!hostSeen[n]) hostSeen[n] = t;
    if (t - hostSeen[n] < NEXT_MS) return;
    lastWrite = t; const res = s.k.map((q, i) => P.resolve(q.s, q.d, (s.seed + i * 7919) >>> 0).goal), tl = P.tally(res);
    if (tl.done) shell.edit('end', st => { if (st.ph !== 'play' || st.k.length - 1 !== n) return null; st.ph = 'end'; st.res = { win: tl.win, sa: tl.sa, sb: tl.sb }; return { status: 'waiting' }; });
    else shell.edit('next', st => { if (st.ph !== 'play' || st.k.length - 1 !== n) return null; st.k.push({ t: Math.round(shell.sNow() + 300) }); });
  }
}
function sendKit(r) { if (r.spectator || kitSent === r.code + kit) return; const id = r.me; const kt = r.s.kt || {}; if (kt[id] === kit) { kitSent = r.code + kit; return; } kitSent = r.code + kit; shell.edit('kit', s => { s.kt = Object.assign({}, s.kt || {}); s.kt[id] = kit; for (const k of Object.keys(s.kt)) if (!r.seated().some(p => String(p.id) === k)) delete s.kt[k]; }); }
function paintVs(r) { const ps = r.seated(), kt = r.s.kt || {}; const side = p => '<div class="side"><canvas width="108" height="108"></canvas><b>' + (p ? J.esc(p.displayName) : '???') + '</b><small class="muted">' + (p ? '' : r.s.set.bot != null ? 'atau bot ' + P.BOTS[r.s.set.bot].n : 'menunggu') + '</small></div>'; $('lobbyVs').innerHTML = side(ps[0]) + '<em>VS</em>' + side(ps[1]); $('lobbyVs').querySelectorAll('canvas').forEach((c, i) => R.kitIcon(c, P.kitOf(ps[i] ? kt[ps[i].id] || 'merah' : 'putih'))); const ob = $('onBot'); ob.innerHTML = P.BOTS.map((b, i) => '<button data-v="' + i + '" class="' + ((r.s.set.bot ?? 1) === i ? 'on' : '') + '">' + ['Mudah', 'Sedang', 'Sulit', 'Juara'][i] + '</button>').join(''); ob.parentElement.hidden = ps.length >= 2; $('startBtn').textContent = ps.length >= 2 ? '⚽ Mulai adu penalti' : '⚽ Mulai lawan bot'; }
async function startOnline() {
  const r = shell.room; if (!shell.canRun(r)) return; const ps = r.seated(); const kt = r.s.kt || {}; const bs = r.s.set.bot ?? 1;
  let ids, nm, kts; if (ps.length >= 2) { const sw = Math.random() < 0.5; const a = sw ? ps[1] : ps[0], b = sw ? ps[0] : ps[1]; ids = [a.id, b.id]; nm = [a.displayName, b.displayName]; kts = [kt[a.id] || 'merah', kt[b.id] || 'putih']; }
  else { const a = ps[0] || { id: r.me, displayName: myName() }; ids = [a.id, 0]; nm = [a.displayName, P.BOTS[bs].n]; kts = [kt[a.id] || kit, P.BOTS[bs].kit]; }
  if (kts[0] === kts[1]) kts[1] = kts[0] === 'merah' ? 'putih' : 'merah';
  const g = Math.random().toString(36).slice(2, 8);
  await shell.edit('start', s => { if (s.ph !== 'lobby') return null; s.ph = 'play'; s.g = g; s.seed = (Math.random() * 1e9) | 0; s.m = { ids, nm: nm.map(x => String(x).slice(0, 16)), kt: kts, bs }; s.k = [{ t: Math.round(shell.sNow() + 2500) }]; s.res = null; return { status: 'playing' }; });
}
async function toLobby() { if (!shell.canRun()) return; await shell.edit('lobby', s => { s.ph = 'lobby'; s.k = []; s.m = null; s.res = null; return { status: 'waiting' }; }); }
/* ---------- chat in play ---------- */
const CHEERS = ['Ayo Garuda! 🦅', 'GOOOL!', 'Tenang, fokus!', 'Kiper hebat! 🧤', 'Sudah kuduga 😏', 'Sekali lagi!', 'GG 🤝'];
function cheer(x) { S.chant(); ex = Math.max(ex, 0.5); if (M && M.mode === 'online' && shell.room) shell.sendChat(x); else bubble(myName() || 'Kamu', x); }
/* ---------- boot ---------- */
function boot() {
  $('nameInput').value = J.getLS(NAME_KEY) || ''; $('nameInput').addEventListener('change', () => J.setLS(NAME_KEY, myName()));
  if (window.JDNG) window.JDNG.on(n => { if (n && !$('nameInput').value) { $('nameInput').value = n; J.setLS(NAME_KEY, myName()); } });
  paintKits(); paintDiff(); paintStat();
  $('kitPick').addEventListener('click', e => { const b = e.target.closest('.kit'); if (!b) return; kit = b.dataset.k; J.setLS(KIT_KEY, kit); paintKits(); S.tap(); kitSent = ''; if (shell && shell.room && shell.room.s.ph === 'lobby') sendKit(shell.room); });
  $('diffPick').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; diff = +b.dataset.v; J.setLS(DIFF_KEY, String(diff)); paintDiff(); S.tap(); });
  $('botBtn').addEventListener('click', () => { J.setLS(NAME_KEY, myName()); startBot(false); });
  $('tutBtn').addEventListener('click', () => startBot(true));
  $('exitBtn').addEventListener('click', toMenu); $('resMenu').addEventListener('click', toMenu);
  $('againBtn').addEventListener('click', () => { if (M && M.mode === 'demo') return startDemo(); startBot(M && M.tut && false); });
  $('toLobbyBtn').addEventListener('click', toLobby); $('startBtn').addEventListener('click', startOnline);
  $('onBot').addEventListener('click', e => { const b = e.target.closest('button'); if (b) shell.setRoom('bot', +b.dataset.v); });
  $('replayBtn').addEventListener('click', () => { if (!M || M.phase !== 'gap' && M.phase !== 'aim') return; const n = M.shown - 1; if (n < 0 || !M.kicks[n].o) return; const ph = M.phase, keep = { n: M.n, picked: M.picked }; startReplay(n, () => { if (ph === 'aim') { M.phase = 'aim'; M.anim = null; } else nextAfter(n); }); });
  $('cheer').innerHTML = CHEERS.map(c => '<button type="button">' + J.esc(c) + '</button>').join(''); $('cheer').addEventListener('click', e => { const b = e.target.closest('button'); if (b) cheer(b.textContent); });
  $('chatBtn').addEventListener('click', () => { const slot = $('chatSlot'), chat = $('chat'); if (slot.hidden) { slot.appendChild(chat); slot.hidden = false; } else { $('chatCard').appendChild(chat); slot.hidden = true; } });
  J.initMute('penaltitimnas.mute', ['muteBtn', 'muteBtn2'], m => ambience(!m && !$('play').hidden));
  shell = window.MPShell({ slug: 'penaltitimnas', title: 'Penalti Timnas', max: MAXP, defSet: { bot: 1 }, myName, saveName: n => J.setLS(NAME_KEY, n), toast, sfx: { chat: S.chat, cheer: () => {} }, accent: '#e0242f', inviteText: 'Duel adu penalti denganku di Penalti Timnas!',
    quick: ['Siap duel! ⚽', 'Ayo mulai!', 'Kiper siap 🧤', 'Nggak bakal masuk 😏', 'GG 🤝'],
    onRoom, onLeave: () => { if (M && M.mode === 'online') M = null; $('result').hidden = true; $('chatSlot').hidden = true; $('chatCard').appendChild($('chat')); ambience(false); J.show('home'); },
    onChat: m => { if (!$('play').hidden) bubble(m.n, m.x); },
    localChat: x => bubble(myName() || 'Kamu', x),
    color: (p) => P.kitOf((shell.room && shell.room.s.kt || {})[p.id] || 'merah').a,
    hostHint: (r, ps) => ps.length >= 2 ? 'Siap! Peran tendang/kiper diundi saat mulai.' : 'Bagikan link undangan, atau mulai lawan bot.' });
  window.PTApp = { get M() { return M; }, shell, startBot, startDemo, myPick, toMenu };
  shell.boot();
  if (DEMO) startDemo();
  requestAnimationFrame(frame);
}
boot();
})();

/* Rebut Bendera Kampung app: home (live bot demo), solo 2v2/3v3 vs bots, latihan 1v1 with coach, #demo, online 2-6 (host-authoritative sim; snapshots + taps over the realtime input channel, persisted fallback). */
(function () {
'use strict';
const B = window.RB, R = window.RR, J = window.JDK, $ = J.$, toast = J.toast;
const NAME_KEY = 'rebutbendera.name', STAT_KEY = 'rebutbendera.stat', SIZE_KEY = 'rebutbendera.size';
const MAXP = 6, SNAP_MS = 550, PERSIST_MS = 4000, PERSIST_FB_MS = 1300, GO_MS = 340, LEAD = 3200;
const DEMO = /demo/i.test(location.hash);
const BOTN = ['Ucok', 'Asep', 'Joko', 'Dedi', 'Rina', 'Siti', 'Bayu', 'Tono', 'Wati', 'Agus', 'Yanti', 'Budi'];
const TN = ['Merah', 'Biru'], HAIR = ['#1d1208', '#2b1a0e', '#3a2414', '#140c06'];
const stat = (() => { try { return Object.assign({ n: 0, w: 0, caps: 0, tags: 0 }, JSON.parse(J.getLS(STAT_KEY) || '{}')); } catch (e) { return { n: 0, w: 0, caps: 0, tags: 0 }; } })();
const myName = () => ($('nameInput').value || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 16);
let soloSize = +(J.getLS(SIZE_KEY) || 2) === 3 ? 3 : 2;
/* ---------- audio ---------- */
const SX = {
  prit(d) { J.tone(2900, 0.09, 'sine', 0.07, 2800, d); J.tone(2900, 0.32, 'sine', 0.07, 2500, (d || 0) + 0.12); J.noise(0.3, 0.02, 3000, (d || 0) + 0.12); },
  tag() { J.tone(330, 0.08, 'square', 0.05, 220); J.noise(0.08, 0.12, 900); },
  caught() { J.tone(300, 0.35, 'sawtooth', 0.06, 110); },
  grab() { J.tone(523, 0.08, 'triangle', 0.07); J.tone(659, 0.08, 'triangle', 0.07, 0, 0.08); J.tone(784, 0.16, 'triangle', 0.07, 0, 0.16); },
  cap() { [523, 659, 784, 1046].forEach((f, i) => J.tone(f, 0.14, 'triangle', 0.08, 0, i * 0.09)); J.noise(1.4, 0.13, 0, 0.2, 1500); kentong(0.05); kentong(0.3); },
  lose() { J.tone(392, 0.2, 'triangle', 0.06, 0); J.tone(330, 0.3, 'triangle', 0.06, 0, 0.2); },
  free() { J.tone(1318, 0.25, 'sine', 0.05); J.tone(1760, 0.4, 'sine', 0.04, 0, 0.1); },
  tp() { J.noise(0.35, 0.08, 1200, 0, 300); J.tone(240, 0.3, 'sine', 0.05, 720); },
  ping() { J.tone(880, 0.06, 'sine', 0.06); J.tone(1320, 0.1, 'sine', 0.05, 0, 0.06); },
  tick() { J.tone(660, 0.07, 'square', 0.03); },
  step() { J.tone(500, 0.03, 'triangle', 0.02, 380); },
  win() { [523, 659, 784, 659, 784, 1046].forEach((f, i) => J.tone(f, 0.16, 'triangle', 0.08, 0, i * 0.12)); J.noise(2, 0.14, 0, 0.3, 1400); },
  chat() { J.tone(990, 0.06, 'sine', 0.05); },
};
function kentong(d) { J.tone(740, 0.09, 'triangle', 0.08, 700, d); J.noise(0.04, 0.05, 2000, d); }
/* ---------- match setup ---------- */
let G = null, shell = null;
const now = () => G && G.mode === 'online' ? shell.sNow() : performance.now();
function look(i, team) { return { skin: R.SKIN[(i * 3 + team) % R.SKIN.length], hair: HAIR[(i * 5 + team * 2) % HAIR.length] }; }
function newG(mode, pl, o) {
  const Sx = B.newMatch({ seed: o.seed, dur: o.dur || 180000, cap: o.cap || 3, players: pl });
  const nums = [0, 0]; Sx.P.forEach(p => { Object.assign(p, look(p.i, p.team)); p.num = ++nums[p.team]; p.rx = p.x; p.ry = p.y; p.wk = 0; });
  const me = o.me == null ? -1 : o.me, team = me >= 0 ? Sx.P[me].team : (o.team || 0);
  G = { mode, S: Sx, me, team, flip: team === 0, auth: o.auth !== false, t0: o.t0, acc: 0, last: 0, pings: [], fx: [], tap: null, seen: 0, q: 0, pend: null, lastGo: 0, armed: null, lastPing: 0, cam: null, g: o.g || '', ended: false, endAt: 0, shown: false, coach: mode === 'tut' ? 0 : -1, lastSnapT: -1, snapAt: 0, sentAt: 0, persistAt: 0, bucket: 100, bucketAt: performance.now(), size: o.size || 2, cdBeep: 4, mism: 0, gotInput: 0 };
  return G;
}
function soloPlayers(size, mode) {
  const me = { id: 'me', name: myName() || 'Kamu', team: 0 }, pl = [me], BN = botNames([me.name]); let b = 0;
  if (mode === 'tut') return [me, { id: 'b0', name: 'Pak RT', team: 1, bot: true, sk: 0.62 }];
  for (let i = 1; i < size; i++) pl.push({ id: 'b' + b, name: BN[b++], team: 0, bot: true, sk: 0.95 });
  for (let i = 0; i < size; i++) pl.push({ id: 'b' + b, name: BN[b++], team: 1, bot: true, sk: mode === 'demo' ? 0.95 : 0.9 });
  return pl;
}
function startSolo(mode) {
  if (shell && shell.room) shell.leave(true);
  const size = mode === 'demo' ? 3 : soloSize, pl = soloPlayers(size, mode);
  if (mode === 'demo') { pl[0].bot = true; pl[0].name = BOTN[11]; pl[0].sk = 0.95; }
  newG(mode, pl, { seed: (Math.random() * 1e9) | 0, me: mode === 'demo' ? null : 0, dur: mode === 'tut' ? 240000 : 180000, cap: mode === 'tut' ? 2 : 3, t0: performance.now() + LEAD, size });
  if (mode === 'tut') { const e = G.S.P[1]; e.think = 1e12; }
  startPlay();
}
function startPlay() { if (G.coach >= 0) $('coach').textContent = TIPS[0]; J.show('play'); $('result').hidden = true; $('bubbles').innerHTML = ''; $('coach').hidden = G.coach < 0; $('chatBtn').hidden = G.mode !== 'online'; $('pings').hidden = G.me < 0; $('capTo').textContent = 'rebut ' + G.S.cap; disarm(); hud(); }
/* ---------- simulation drive ---------- */
function frameSim(t) {
  const dt = Math.min(250, Math.max(0, t - (G.last || t))); G.last = t; const S = G.S;
  if (t < G.t0) { const c = Math.ceil((G.t0 - t) / 1000); if (c < G.cdBeep && c >= 1) { G.cdBeep = c; SX.tick(); } return; }
  if (G.cdBeep > 0) { G.cdBeep = 0; S_prit(); }
  if (G.auth) {
    if (!S.over) { G.acc += dt; let n = 0; while (G.acc >= B.DT && n++ < 6) { G.acc -= B.DT; B.step(S, B.DT); } if (n >= 6) G.acc = 0; }
  } else if (!S.over) { // guest prediction between host snapshots
    S.t += dt; for (const p of S.P) { p.now = S.t; B.move(p, dt); p.hid = B.inJem(p.x, p.y) ? 1 : 0; } for (const f of S.F) if (f.by >= 0) { const c = S.P[f.by]; f.x = c.x; f.y = c.y; }
  }
  for (const p of S.P) { const d = Math.hypot(p.x - p.rx, p.y - p.ry); if (d > 2.2) { p.rx = p.x; p.ry = p.y; } else { const k = Math.min(1, dt / (G.auth ? 40 : 90)); p.rx += (p.x - p.rx) * k; p.ry += (p.y - p.ry) * k; } if (p.mv) p.wk += dt * 0.017; }
  events();
  if (G.mode === 'tut') coachTick();
  if (S.over && !G.ended) { G.ended = true; G.endAt = t; S_prit(); if (G.mode === 'online' && G.auth) endOnline(); }
  if (G.ended && !G.shown && t - G.endAt > 1500) showResult();
}
function S_prit() { SX.prit(); }
function events() {
  const S = G.S, list = S.ev.filter(e => e.n > G.seen); if (!list.length) return; G.seen = list[list.length - 1].n;
  for (const e of list) onEvent(e);
  if (G.mode === 'online' && G.auth) G.hot = true;
}
const nm = i => { const p = G.S.P[i]; return p ? (G.me === i ? 'Kamu' : p.name) : '?'; };
function fx(i, txt, col) { const p = G.S.P[i]; if (p) G.fx.push({ x: p.x, y: p.y, txt, col, at: performance.now() }); }
function onEvent(e) {
  const S = G.S, me = G.me, my = G.team, A = S.P[e.a], Bp = S.P[e.b];
  if (e.k === 'tag') { if (e.b === me) { toast('Kamu ditangkap ' + nm(e.a) + '! Masuk penjara 🔒', 'warn', 2600); S_caught(); J.buzz(120); } else if (e.a === me) { toast('Kena! ' + nm(e.b) + ' masuk penjara 👮', 'ok', 2000); SX.tag(); J.buzz(40); } else { SX.tag(); if (Bp && Bp.team === my) toast(nm(e.b) + ' ditangkap!', 'warn', 1800); }
    fx(e.b, 'TERTANGKAP!', '#ffb4a0'); if (Bp && Bp.team === my && Bp.bot && me >= 0) addPing({ x: B.JAIL[1 - Bp.team][0], y: B.JAIL[1 - Bp.team][1], k: 'tolong', n: Bp.name, team: my }, true); }
  else if (e.k === 'ret') toast('Bendera ' + TN[e.b] + ' kembali ke tiangnya', '', 1600);
  else if (e.k === 'grab') { SX.grab(); fx(e.a, 'DAPAT BENDERA!', '#ffe08a'); toast((e.a === me ? 'Kamu' : nm(e.a)) + ' merebut bendera ' + TN[e.b] + '! 🚩', A && A.team === my ? 'ok' : 'warn', 2000); }
  else if (e.k === 'cap') { const ours = e.b === my; if (ours || G.me < 0) SX.cap(); else SX.lose(); G.capFx = { team: e.b, at: performance.now(), who: nm(e.a) }; J.buzz(ours ? 80 : 30); }
  else if (e.k === 'free') { SX.free(); fx(e.a, 'BEBAS!', '#bff7c8'); toast(nm(e.a) + ' membebaskan ' + e.b + ' teman! 🔓', A && A.team === my ? 'ok' : 'warn', 2000); }
  else if (e.k === 'auto') { if (e.a === me) toast('Kamu bebas sendiri. Ayo lagi!', 'ok', 1600); }
  else if (e.k === 'tp') { if (e.a === me || (A && A.team === my)) SX.tp(); fx(e.a, 'WUSH!', '#fff'); }
}
function S_caught() { SX.caught(); SX.prit(); }
/* ---------- player input ---------- */
function goTo(x, y, quiet) {
  if (!G || G.me < 0 || G.ended) return; const p = G.S.P[G.me]; if (p.st) { if (!quiet) toast('Di penjara… tunggu dibebaskan', 'warn', 1200); return; }
  x = Math.max(0.4, Math.min(B.W - 0.4, x)); y = Math.max(0.4, Math.min(B.H - 0.4, y)); B.setTarget(p, x, y); if (!quiet) { G.tap = { x, y, at: performance.now() }; SX.step(); }
  if (G.mode === 'online' && !G.auth) G.pend = [x, y];
}
function flushGo(t) {
  if (!G.pend || t - G.lastGo < GO_MS) return; const c = shell.conn; if (!take()) return;
  const [x, y] = G.pend; G.pend = null; G.lastGo = t; const q = ++G.q;
  if (c.inputReady()) c.input({ key: 'go', payload: { g: G.g, x: Math.round(x * 100), y: Math.round(y * 100), q } }).catch(() => { G.pend = G.pend || [x, y]; });
  else if (!G.fbBusy) { G.fbBusy = true; G.lastGo = t + 600; const me = shell.room.me; shell.edit('go', s => { if (s.ph !== 'play' || s.g !== G.g) return null; s.in = Object.assign({}, s.in || {}); s.in[me] = [Math.round(x * 100), Math.round(y * 100), q]; }).finally(() => { G.fbBusy = false; }); }
}
function take() { const t = performance.now(); G.bucket = Math.min(100, G.bucket + (t - G.bucketAt) * 100 / 60000); G.bucketAt = t; if (G.bucket < 1) return false; G.bucket--; return true; }
function addPing(g, silent) { g.at = performance.now(); G.pings.push(g); if (G.pings.length > 8) G.pings.shift(); if (!silent) SX.ping(); }
function placePing(k, x, y) {
  if (!G || G.me < 0) return; const t = performance.now(); if (t - G.lastPing < 1200) { toast('Tunggu sebentar…', '', 900); return; } G.lastPing = t;
  addPing({ x, y, k, n: 'Kamu', team: G.team }); if (G.auth) G.S.pings.push({ team: G.team, k, x, y, t: G.S.t });
  if (G.mode === 'online' && shell.conn.inputReady() && take()) shell.conn.input({ key: 'ping', payload: { g: G.g, x: Math.round(x * 100), y: Math.round(y * 100), k } }).catch(() => {});
}
function disarm() { G && (G.armed = null); $('pings').querySelectorAll('button').forEach(b => b.classList.remove('armed')); }
function onPingBtn(e) { const b = e.target.closest('button'); if (!b || !G || G.me < 0) return; e.stopPropagation(); const k = b.dataset.k, p = G.S.P[G.me];
  if (k === 'tolong') { disarm(); placePing('tolong', p.x, p.y); return; }
  if (G.armed === k) { disarm(); return; } disarm(); G.armed = k; b.classList.add('armed'); toast('Ketuk peta untuk memasang tanda ' + (k === 'serang' ? 'serang ⚔️' : 'jaga 🛡️'), '', 1400); }
let drag = false, dragAt = 0;
function worldAt(e) { const rect = cv.getBoundingClientRect(); return R.unproject(e.clientX - rect.left, e.clientY - rect.top); }
function onDown(e) { if (!G || $('play').hidden || G.ended) return; e.preventDefault(); J.ac && J.ac(); const w = worldAt(e);
  if (G.armed) { placePing(G.armed, w[0], w[1]); disarm(); return; } drag = true; dragAt = performance.now(); goTo(w[0], w[1]); try { cv.setPointerCapture(e.pointerId); } catch (x) { /* ok */ } }
function onMove(e) { if (!drag || !G) return; const t = performance.now(); if (t - dragAt < 110) return; dragAt = t; const w = worldAt(e); goTo(w[0], w[1], true); G.tap = { x: w[0], y: w[1], at: t - 250 }; }
function onUp() { drag = false; }
const keys = {}; let keyAt = 0;
function onKey(e, down) { if (e.target.closest && e.target.closest('input')) return; const k = { KeyW: 'u', ArrowUp: 'u', KeyS: 'd', ArrowDown: 'd', KeyA: 'l', ArrowLeft: 'l', KeyD: 'r', ArrowRight: 'r' }[e.code];
  if (down && e.code === 'Escape' && G && !$('play').hidden) { toMenu(); return; }
  if (down && G && !$('play').hidden && (e.code === 'Digit1' || e.code === 'Digit2' || e.code === 'Digit3')) { const b = $('pings').children[+e.code.slice(5) - 1]; if (b) b.click(); return; }
  if (!k || !G || $('play').hidden) return; e.preventDefault(); keys[k] = down; }
function keyTick(t) { if (!G || G.me < 0 || t - keyAt < 140) return; const dx = (keys.r ? 1 : 0) - (keys.l ? 1 : 0), dy = (keys.d ? 1 : 0) - (keys.u ? 1 : 0); if (!dx && !dy) return; keyAt = t; const p = G.S.P[G.me], s = R.project(p.x, p.y), a = R.unproject(s[0], s[1]), b = R.unproject(s[0] + dx * 60, s[1] + dy * 60); let vx = b[0] - a[0], vy = b[1] - a[1]; const n = Math.hypot(vx, vy) || 1; goTo(p.x + vx / n * 1.7, p.y + vy / n * 1.7, true); }
/* ---------- coach (latihan) ---------- */
const TIPS = ['Ketuk tanah untuk lari ke sana 👆 (atau tahan dan geser)', 'Lari melewati garis kapur di tengah. Itu wilayah lawan, hati-hati!', 'Bendera Biru ada di ujung sana 🚩 Sentuh untuk merebutnya!', 'Dapat! Bawa pulang ke wilayahmu (lewati garis kapur)', 'Poin! 🎉 Pak RT sekarang menjaga. Coba pos ronda ⛺ untuk jalan pintas, atau ngumpet di gang jemuran 👕', 'Satu poin lagi untuk menang. Kalau ditangkap, tunggu 15 detik di penjara.'];
function coachTick() { const S = G.S, p = S.P[0], st = G.coach; let next = st;
  if (st === 0 && Math.hypot(p.x - B.SPAWN[0][0][0], p.y - B.SPAWN[0][0][1]) > 1.6) next = 1;
  else if (st === 1 && B.side(p.x) !== 0) next = 2; else if (st === 2 && p.carry >= 0) next = 3; else if (st === 3 && p.caps >= 1) next = 4; else if (st === 4 && (S.t > (G.c4 || 0) + 9000 || S.t < p.tp)) next = 5;
  if (next !== st) { G.coach = next; S_tickOk(); if (next === 2) { const e = S.P[1]; e.think = S.t + 4000; } if (next === 4) G.c4 = S.t; if (next === 2 || next === 3) addPing({ x: next === 2 ? B.FLAG[1][0] : B.MID - 2, y: next === 2 ? B.FLAG[1][1] : p.y, k: next === 2 ? 'serang' : 'jaga', n: 'Pelatih', team: 0 }, true); }
  const c = $('coach'); let m = TIPS[G.coach]; if (p.st) m = 'Di penjara! 🔒 Tunggu 15 detik, nanti bebas sendiri.'; if (c.textContent !== m) c.textContent = m; }
function S_tickOk() { J.tone(880, 0.08, 'triangle', 0.05); J.tone(1175, 0.12, 'triangle', 0.05, 0, 0.08); }
/* ---------- drawing ---------- */
const cv = $('cv');
function viewKids(S, fade) {
  const my = G.team, meP = G.me >= 0 ? S.P[G.me] : null;
  return S.P.map(p => { let alpha = 1; if (p.hid && !p.st) { if (p.team !== my) { const near = S.P.some(q => q.team === my && !q.st && Math.hypot(q.x - p.x, q.y - p.y) < 1.8); alpha = near ? 0.55 : 0.1; } else alpha = 0.6; }
    return { x: p.rx, y: p.ry, team: p.team, skin: p.skin, hair: p.hair, walk: p.wk, moving: !!p.mv && !p.st, dir: p.dir, carry: p.carry >= 0 ? p.carry : null, jail: !!p.st, alpha: alpha * (fade || 1), me: p === meP, cd: S.t < p.cd, imm: S.t < p.imm && !p.st, name: (p === meP ? 'Kamu' : p.name.slice(0, 10)) + (p.gone ? ' 🤖' : ''), num: p.num }; });
}
function camTarget(S) {
  if (G.me >= 0) { const p = S.P[G.me]; return [p.rx, p.ry]; }
  const c = S.P.find(p => p.carry >= 0); if (c) return [c.rx, c.ry]; let x = 0, y = 0, n = 0; for (const p of S.P) if (!p.st) { x += p.rx; y += p.ry; n++; } return n ? [x / n, y / n] : [B.MID, B.H / 2];
}
function draw(t) {
  const { g, W, H, r } = J.fitCanvas(cv); g._dpr = r; const S = G.S, tg = camTarget(S);
  if (!G.cam) G.cam = tg.slice(); const k = G.me >= 0 ? 0.14 : 0.05; G.cam[0] += (tg[0] - G.cam[0]) * k; G.cam[1] += (tg[1] - G.cam[1]) * k;
  const meP = G.me >= 0 ? S.P[G.me] : null, pt = performance.now();
  const route = meP && !meP.st && meP.path && meP.path.length ? [[meP.rx, meP.ry]].concat(meP.path) : null;
  const pings = G.pings.filter(g2 => pt - g2.at < 3600 && (G.me < 0 || g2.team === G.team)).map(g2 => ({ x: g2.x, y: g2.y, k: g2.k, n: g2.n, age: pt - g2.at }));
  const kids = viewKids(S), flags = S.F.map(f => ({ x: f.x, y: f.y, by: f.by }));
  const danger = meP && !meP.st && B.side(meP.x) !== meP.team && S.t >= meP.imm && t >= G.t0 && !S.over;
  R.scene(g, W, H, { cam: G.cam, flip: G.flip, kids, flags, pings, route, tap: G.tap && pt - G.tap.at < 500 ? { x: G.tap.x, y: G.tap.y, age: pt - G.tap.at } : null, prReady: meP ? S.t >= meP.tp : true, danger, cy: 0.56 }, t);
  // floating texts
  G.fx = G.fx.filter(f => pt - f.at < 1300); for (const f of G.fx) { const a = (pt - f.at) / 1300, p = R.project(f.x, f.y, 1.9 + a * 1.2); g.save(); g.globalAlpha = 1 - a * a; g.font = '900 15px system-ui,sans-serif'; g.textAlign = 'center'; g.lineWidth = 4; g.strokeStyle = 'rgba(40,16,6,.85)'; g.strokeText(f.txt, p[0], p[1]); g.fillStyle = f.col; g.fillText(f.txt, p[0], p[1]); g.restore(); }
  // captions
  if (t < G.t0) { const c = Math.ceil((G.t0 - t) / 1000); R.caption(g, W, H, String(c), G.me >= 0 ? 'Kamu Tim ' + TN[G.team] + ' · rebut bendera ' + TN[1 - G.team] + '!' : 'Menonton', 1); }
  else if (t - G.t0 < 900) R.caption(g, W, H, 'PRIIIT! MULAI!', '', 1 - (t - G.t0) / 900);
  if (G.capFx && pt - G.capFx.at < 1800) { const a = (pt - G.capFx.at) / 1800, T = R.TEAM[G.capFx.team]; R.caption(g, W, H, 'POIN TIM ' + TN[G.capFx.team].toUpperCase() + '!', G.capFx.who + ' membawa pulang bendera', a < 0.8 ? 1 : (1 - a) * 5, T.l); }
  if (G.ended && !G.shown) R.caption(g, W, H, 'PRIIIT! SELESAI', '', 1);
  const mc = $('mini'), mg = mc.getContext('2d'), mw = mc.clientWidth || 84, mh = mc.clientHeight || 144, mr = Math.min(2, window.devicePixelRatio || 1);
  if (mc.width !== Math.round(mw * mr)) { mc.width = Math.round(mw * mr); mc.height = Math.round(mh * mr); } mg.setTransform(mr, 0, 0, mr, 0, 0); mg.clearRect(0, 0, mw, mh); R.minimap(mg, 4, 4, mw - 8, mh - 8, { flip: G.flip, kids: kids.map(q => Object.assign({}, q)), flags, pings });
}
function fmt(ms) { ms = Math.max(0, ms); const s = Math.ceil(ms / 1000); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }
function hud() { if (!G) return; const S = G.S; $('sc0').textContent = S.sc[0]; $('sc1').textContent = S.sc[1]; const left = S.dur - S.t; $('clock').textContent = fmt(left); $('clock').classList.toggle('low', left < 30000);
  const st = $('status'), p = G.me >= 0 ? S.P[G.me] : null; let m = '', cls = '';
  if (!p) m = '👀 Menonton pertandingan';
  else if (p.st) { m = '🔒 Di penjara · tunggu teman (' + Math.max(0, Math.ceil((15000 - (S.t - p.jt)) / 1000)) + ' d)'; cls = 'jail'; }
  else if (p.carry >= 0) { m = '🚩 Bawa pulang ke wilayahmu!'; cls = 'carry'; }
  else if (B.side(p.x) !== p.team) { if (S.t < p.imm) m = '✨ Kebal sebentar'; else { m = '⚠️ Wilayah lawan · awas ditangkap!'; cls = 'danger'; } }
  else if (S.t < p.cd) m = '😮‍💨 Ngos-ngosan…';
  else if (p.hid) m = '👕 Ngumpet di jemuran';
  else m = S.P.some(q => q.team !== p.team && !q.st && B.side(q.x) === p.team) ? '🛡️ Ada penyusup! Kejar dan tangkap' : '🛡️ Wilayahmu · aman';
  if (st.textContent !== m) st.textContent = m; st.className = 'status ' + cls;
  const cd = $('prCd'); if (p && S.t < p.tp && !p.st) { cd.hidden = false; cd.textContent = '⛺ Pos ronda ' + Math.ceil((p.tp - S.t) / 1000) + ' d'; } else cd.hidden = true; }
/* ---------- result ---------- */
function showResult() {
  G.shown = true; const S = G.S, my = G.team, win = S.win, on = G.mode === 'online';
  const title = G.me < 0 ? (win === 2 ? 'Seri!' : 'Tim ' + TN[win] + ' menang!') : win === 2 ? 'Seri! Sama kuat 🤝' : win === my ? 'Tim kamu menang! 🎉' : 'Kalah… revans? 💪';
  $('resTitle').textContent = title; $('resKick').textContent = G.mode === 'tut' ? 'LATIHAN SELESAI' : 'HASIL PERTANDINGAN';
  $('resScore').innerHTML = '<span class="t0">' + S.sc[0] + '</span> – <span class="t1">' + S.sc[1] + '</span>';
  $('resSub').textContent = 'Merah vs Biru · ' + (S.t >= S.dur ? 'waktu habis' : 'rebut ' + S.cap + ' tercapai') + ' · ' + fmt(S.t);
  const rows = S.P.slice().sort((a, b) => a.team - b.team || (b.caps * 3 + b.tags + b.frees) - (a.caps * 3 + a.tags + a.frees));
  const best = rows.reduce((a, b) => (b.caps * 3 + b.tags * 1.2 + b.frees) > (a.caps * 3 + a.tags * 1.2 + a.frees) ? b : a, rows[0]);
  $('resTable').innerHTML = '<tr><th>Pemain</th><th>🚩 Poin</th><th>👮 Tangkap</th><th>🔓 Bebasin</th></tr>' + rows.map(p => '<tr class="t' + p.team + (p.i === G.me ? ' me' : '') + '"><td>' + (p === best ? '⭐ ' : '') + J.esc(p.i === G.me ? 'Kamu' : p.name) + (p.bot ? ' 🤖' : '') + '</td><td>' + p.caps + '</td><td>' + p.tags + '</td><td>' + p.frees + '</td></tr>').join('');
  let note = '';
  if (G.me >= 0 && G.mode !== 'demo') { const p = S.P[G.me]; if (G.mode !== 'tut') { stat.n++; if (win === my) stat.w++; stat.caps += p.caps; stat.tags += p.tags; J.setLS(STAT_KEY, JSON.stringify(stat)); paintStat(); }
    note = p === best ? '⭐ Kamu pemain terbaik!' : p.caps ? 'Kamu membawa pulang ' + p.caps + ' bendera.' : p.tags ? 'Kamu menangkap ' + p.tags + ' penyusup.' : 'Coba lewat gang jemuran biar tidak kelihatan.';
    G.share = 'Rebut Bendera Kampung: Merah ' + S.sc[0] + ' – ' + S.sc[1] + ' Biru. ' + (win === my ? 'Timku menang! 🚩' : 'Ayo revans!'); if (win === my) SX.win(); }
  $('resNote').textContent = note; $('againBtn').hidden = on; $('toLobbyBtn').hidden = !(on && shell.canRun()); $('endWait').textContent = on && !shell.canRun() ? 'Menunggu host kembali ke lobby…' : '';
  $('result').hidden = false; }
function paintStat() { $('statTitle').textContent = stat.n ? 'Menang ' + stat.w + '/' + stat.n : 'Rekor'; $('statSub').textContent = stat.n ? '🚩 ' + stat.caps + ' bendera · 👮 ' + stat.tags + ' tangkapan' : 'Belum main'; }
function share() { const txt = (G && G.share) || 'Rebut Bendera Kampung: capture the flag 2v2 / 3v3 di HP'; const url = location.origin + location.pathname; if (navigator.share) navigator.share({ title: 'Rebut Bendera Kampung', text: txt, url }).catch(() => {}); else if (navigator.clipboard) navigator.clipboard.writeText(txt + ' ' + url).then(() => toast('Disalin!'), () => {}); }
function bubble(name, x) { const b = $('bubbles'), p = document.createElement('p'); p.textContent = name + ': ' + x; b.appendChild(p); while (b.children.length > 3) b.firstChild.remove(); setTimeout(() => p.remove(), 4200); }
function toMenu() { if (G && G.mode === 'online' && shell.room) shell.leave(true); G = null; $('result').hidden = true; $('coach').hidden = true; $('chatSlot').hidden = true; $('chatCard').appendChild($('chat')); J.show('home'); }
/* ---------- online ---------- */
function botNames(taken) { const t = taken.map(x => x.toLowerCase()); return BOTN.filter(n => !t.includes(n.toLowerCase())); }
function prefTeam(s, id) { const v = (s.tm || {})[id]; return v === 0 || v === 1 ? v : -1; }
function assignTeams(ps, s, size) { // honour picks while the team has room; the rest balance by seat
  const cnt = [0, 0], out = {}; for (const p of ps) { const v = prefTeam(s, p.id); if (v >= 0 && cnt[v] < size) { out[p.id] = v; cnt[v]++; } }
  ps.forEach(p => { if (out[p.id] != null) return; const v = cnt[0] <= cnt[1] ? 0 : 1; out[p.id] = v; cnt[v]++; }); return { out, cnt };
}
function onRoom(r) {
  const s = r.s;
  if (s.ph === 'lobby' || !s.m) { if (G && G.mode === 'online') { G = null; $('result').hidden = true; } if ($('lobby').hidden) J.show('lobby'); shell.renderLobby(); paintLobbySeg(r); return; }
  if (!G || G.mode !== 'online' || G.g !== s.g) {
    const pl = s.m.pl || [], me = pl.findIndex(p => p.id === r.me && !p.bot);
    newG('online', pl, { seed: s.seed >>> 0, g: s.g, me: me >= 0 && !r.spectator ? me : null, team: 0, dur: s.m.dur, cap: s.m.cap, t0: s.t0, auth: shell.canRun(r), size: s.m.size });
    if (shell.sNow() > s.t0 + 1500) G.late = true; startPlay();
    toast(G.me < 0 ? 'Kamu menonton pertandingan ini' : 'Kamu Tim ' + TN[G.team] + '! Rebut bendera ' + TN[1 - G.team], 'ok', 2200);
  }
  const seated = r.seated().map(p => p.id);
  for (const p of G.S.P) if (!p.bot || p.gone) { const gone = !seated.includes(p.id); if (gone && !p.gone) { p.gone = true; if (G.auth) { p.bot = true; p.sk = 0.92; } } else if (!gone && p.gone) { p.gone = false; if (G.auth) p.bot = false; } }
  if (!G.auth && shell.canRun(r) && s.ph === 'play') { G.auth = true; G.acc = 0; toast('Kamu sekarang host pertandingan', 'ok', 2000); G.S.P.forEach(p => { if (p.gone) { p.bot = true; p.sk = 0.92; } }); }
  if (G.auth) { const inn = s.in || {}; for (const id in inn) { const p = G.S.P.find(q => String(q.id) === id && !q.gone), a = inn[id]; if (p && Array.isArray(a) && a[2] > (p.q || 0)) { p.q = a[2]; B.setTarget(p, a[0] / 100, a[1] / 100); } } }
  else if (s.sn && performance.now() - G.gotInput > 2000) applyNet(s.sn);
  if (s.ph === 'end' && s.res && s.res.sn && !G.auth) { applyNet(s.res.sn); if (!G.ended) { G.ended = true; G.endAt = performance.now() - 1200; } }
  if (!$('result').hidden) { $('toLobbyBtn').hidden = !shell.canRun(r); $('endWait').textContent = shell.canRun(r) ? '' : 'Menunggu host kembali ke lobby…'; }
}
function onInput(d) {
  if (!G || G.mode !== 'online' || !d.input) return; const k = d.input.key, pl = d.input.payload || {}; if (pl.g !== G.g) return; const r = shell.room; if (!r || d.playerId === r.me) return;
  if (k === 'snap') { if (!G.auth) { G.gotInput = performance.now(); applyNet(pl.n); } return; }
  const p = G.S.P.find(q => String(q.id) === String(d.playerId) && !q.gone);
  if (k === 'go' && G.auth && p && pl.q > (p.q || 0) && isFinite(pl.x) && isFinite(pl.y)) { p.q = pl.q; B.setTarget(p, pl.x / 100, pl.y / 100); }
  else if (k === 'ping' && p && PINGK.includes(pl.k) && isFinite(pl.x)) { if (p.team === G.team || G.me < 0) addPing({ x: pl.x / 100, y: pl.y / 100, k: pl.k, n: p.name, team: p.team }); if (G.auth) G.S.pings.push({ team: p.team, k: pl.k, x: pl.x / 100, y: pl.y / 100, t: G.S.t }); }
}
const PINGK = ['serang', 'jaga', 'tolong'];
function applyNet(n) {
  if (!n || !Array.isArray(n.P) || n.t <= G.lastSnapT || G.auth) return; G.lastSnapT = n.t; const S = G.S, me = G.me, p = me >= 0 ? S.P[me] : null;
  const keep = p ? { x: p.x, y: p.y, tx: p.tx, ty: p.ty, st: p.st, carry: p.carry, tp: p.tp } : null;
  if (G.late) { G.seen = n.seq || 0; G.late = false; }
  B.applySnap(S, n, me >= 0 ? me : null);
  if (p) { const a = n.P[me], hx = a[0] / 100, hy = a[1] / 100, jump = p.st !== keep.st || p.carry !== keep.carry || (a[7] > 0 && keep.tp <= S.t), err = Math.hypot(hx - keep.x, hy - keep.y);
    if (!jump && err < 1.6 && !p.st) { p.x = keep.x + (hx - keep.x) * 0.35; p.y = keep.y + (hy - keep.y) * 0.35; p.tx = keep.tx; p.ty = keep.ty; p.path = B.path(p.team, p.x, p.y, p.tx, p.ty); }
    else if (p.st || jump) { p.tx = p.x; p.ty = p.y; p.path = []; }
    const off = Math.hypot(a[2] / 100 - p.tx, a[3] / 100 - p.ty) > 0.35 && !p.st; if (off) { if (!G.mism) G.mism = performance.now(); else if (performance.now() - G.mism > 1300 && !G.pend) { G.pend = [p.tx, p.ty]; G.mism = 0; } } else G.mism = 0; }
  for (const e of n.ev || []) if (!S.ev.some(x => x.n === e.n)) S.ev.push(e); S.ev.sort((a, b) => a.n - b.n); while (S.ev.length > 14) S.ev.shift();
}
function hostNet(t) {
  const c = shell.conn, pt = performance.now(), S = G.S; if (!shell.room || shell.room.s.g !== G.g) return;
  const due = pt - G.sentAt >= SNAP_MS || (G.hot && pt - G.sentAt > 140) || (S.over && !G.sentOver);
  if (due && t >= G.t0 - 300 && c.inputReady() && take()) { G.sentAt = pt; G.hot = false; if (S.over) G.sentOver = true; c.input({ key: 'snap', payload: { g: G.g, n: B.snap(S) } }).catch(() => {}); }
  const gap = c.inputReady() ? PERSIST_MS : PERSIST_FB_MS;
  if (!S.over && !G.persisting && pt - G.persistAt >= gap && t >= G.t0) { G.persisting = true; G.persistAt = pt; const sn = B.snap(S); shell.edit('snap', s => { if (s.ph !== 'play' || s.g !== G.g) return null; s.sn = sn; }).finally(() => { G.persisting = false; }); }
}
function endOnline() { const sn = B.snap(G.S); shell.edit('end', s => { if (s.ph !== 'play' || s.g !== G.g) return null; s.ph = 'end'; s.sn = sn; s.res = { sn, win: G.S.win }; return { status: 'waiting' }; }); }
async function startOnline() {
  const r = shell.room; if (!shell.canRun(r)) return; const s = r.s, set = s.set || {}, ps = r.seated().slice(0, MAXP);
  const size = Math.max(+set.size === 3 ? 3 : 2, Math.ceil(ps.length / 2)), { out, cnt } = assignTeams(ps, s, size), dur = +set.dur === 300000 ? 300000 : 180000;
  const pl = ps.map(p => ({ id: p.id, name: String(p.displayName || 'Pemain').slice(0, 16), team: out[p.id] })), bn = botNames(pl.map(p => p.name)); let b = 0;
  for (let tm = 0; tm < 2; tm++) for (let i = cnt[tm]; i < size; i++) pl.push({ id: 'bot' + b, name: bn[b++], team: tm, bot: true, sk: 0.92 });
  const g = Math.random().toString(36).slice(2, 8);
  await shell.edit('start', s2 => { if (s2.ph !== 'lobby') return null; s2.ph = 'play'; s2.g = g; s2.seed = (Math.random() * 1e9) | 0; s2.t0 = Math.round(shell.sNow() + LEAD + 500); s2.m = { pl, size, dur, cap: 3 }; s2.sn = null; s2.in = {}; s2.res = null; return { status: 'playing' }; });
}
async function toLobby() { if (!shell.canRun()) return; await shell.edit('lobby', s => { s.ph = 'lobby'; s.m = null; s.sn = null; s.in = {}; s.res = null; return { status: 'waiting' }; }); }
function paintLobbySeg(r) { const set = r.s.set || {}, size = +set.size === 3 ? 3 : 2, dur = +set.dur === 300000 ? 300000 : 180000;
  $('onSize').innerHTML = [2, 3].map(v => '<button data-v="' + v + '" class="' + (v === size ? 'on' : '') + '">' + v + 'v' + v + '</button>').join('');
  $('onDur').innerHTML = [180000, 300000].map(v => '<button data-v="' + v + '" class="' + (v === dur ? 'on' : '') + '">' + v / 60000 + ' menit</button>').join('');
  const mine = prefTeam(r.s, r.me); $('teamPick').querySelectorAll('button').forEach(b => b.classList.toggle('on', +b.dataset.v === mine)); $('teamPick').parentElement.hidden = r.spectator; }
function lobbyTeams(r) { const s = r.s, set = s.set || {}, ps = r.seated().slice(0, MAXP), size = Math.max(+set.size === 3 ? 3 : 2, Math.ceil(ps.length / 2)); return Object.assign(assignTeams(ps, s, size), { ps, size }); }
function lobbyDraw(t) { const r = shell && shell.room; if (!r || !r.s || $('lobby').hidden) return; const c = $('lobbyCv'), { g, W, H, r: dpr } = J.fitCanvas(c); g._dpr = dpr;
  const { out, cnt, ps, size } = lobbyTeams(r), kids = [], n = [0, 0], my = out[r.me] != null ? out[r.me] : 0;
  const put = (team, name, me, bot, i) => { const k = n[team]++, sp = B.SPAWN[team][k % 3], x = team ? B.MID + 1.6 + k * 0.2 : B.MID - 1.6 - k * 0.2, y = 4.6 + k * 1.5; const lk = look(i, team); kids.push({ x, y, team, skin: lk.skin, hair: lk.hair, walk: t / 160 + i, moving: false, dir: team ? Math.PI : 0, name: name.slice(0, 10) + (bot ? ' 🤖' : ''), me, num: k + 1 }); void sp; };
  ps.forEach((p, i) => put(out[p.id], String(p.displayName || ''), p.id === r.me, false, i)); const bn = botNames(ps.map(p => String(p.displayName || ''))); let b = 0; for (let tm = 0; tm < 2; tm++) for (let i = cnt[tm]; i < size; i++) put(tm, bn[b++], false, true, 7 + b);
  R.scene(g, W, H, { cam: [B.MID, 6.6], flip: my === 0, kids, flags: [{ x: B.FLAG[0][0], y: B.FLAG[0][1], by: -1 }, { x: B.FLAG[1][0], y: B.FLAG[1][1], by: -1 }], S: Math.max(22, Math.min(40, W / 8.5)), cy: 0.5, prReady: true }, t); }
function lobbyTag(p, i, r) { const { out } = lobbyTeams(r), v = out[p.id]; return v == null ? '' : '<span class="tm t' + v + '">' + TN[v] + '</span>'; }
/* ---------- hero: live bot match ---------- */
let H0 = null;
function heroDraw(t) { const c = $('heroCv'); if (!c.clientWidth) return; const { g, W, H, r } = J.fitCanvas(c); g._dpr = r;
  if (!H0 || H0.S.over) { const pl = soloPlayers(2, 'demo'); pl[0].bot = true; pl[0].name = BOTN[11]; const keepG = G; newG('demo', pl, { seed: (Math.random() * 1e9) | 0, me: null, t0: 0 }); H0 = G; G = keepG; H0.cam = [B.MID, B.H / 2]; H0.last = t; }
  const dt = Math.min(100, t - H0.last); H0.last = t; H0.acc += dt; while (H0.acc >= B.DT) { H0.acc -= B.DT; B.step(H0.S, B.DT); } for (const p of H0.S.P) { p.rx = p.x; p.ry = p.y; if (p.mv) p.wk += dt * 0.017; }
  const keepG = G; G = H0; const tg = camTarget(H0.S); H0.cam[0] += (tg[0] - H0.cam[0]) * 0.02; H0.cam[1] += (tg[1] - H0.cam[1]) * 0.02;
  R.scene(g, W, H, { cam: H0.cam, flip: true, kids: viewKids(H0.S), flags: H0.S.F.map(f => ({ x: f.x, y: f.y, by: f.by })), S: Math.max(24, Math.min(44, W / 9)), cy: 0.6, prReady: true }, t); G = keepG; }
/* ---------- loop ---------- */
let lastHud = 0;
function frame(t) {
  try {
    if (!$('home').hidden) heroDraw(t); else if (!$('lobby').hidden) lobbyDraw(t);
    if (G && (!$('play').hidden || !$('result').hidden)) { const nt = now(); keyTick(t); frameSim(nt); if (G && G.mode === 'online') { if (G.auth) hostNet(nt); else if (G.me >= 0) flushGo(performance.now()); } if (G) { draw(nt); if (t - lastHud > 120) { lastHud = t; hud(); } } }
  } catch (e) { console.error(e); }
  requestAnimationFrame(frame);
}
const CHEERS = ['Serbu! ⚔️', 'Jaga bendera! 🛡️', 'Tolong bebasin! 🆘', 'Mantap! 🔥'];
function boot() {
  $('nameInput').value = J.getLS(NAME_KEY) || ''; $('nameInput').addEventListener('change', () => J.setLS(NAME_KEY, myName()));
  if (window.JDNG) window.JDNG.on(n => { if (n && !$('nameInput').value) { $('nameInput').value = n; J.setLS(NAME_KEY, myName()); } });
  paintStat(); const paintSize = () => $('soloSize').querySelectorAll('button').forEach(b => b.classList.toggle('on', +b.dataset.v === soloSize)); paintSize();
  $('soloSize').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; soloSize = +b.dataset.v; J.setLS(SIZE_KEY, String(soloSize)); paintSize(); SX.tick(); });
  $('soloBtn').addEventListener('click', () => startSolo('solo')); $('tutBtn').addEventListener('click', () => startSolo('tut'));
  $('exitBtn').addEventListener('click', toMenu); $('resMenu').addEventListener('click', toMenu); $('shareBtn').addEventListener('click', share);
  $('againBtn').addEventListener('click', () => startSolo(G && G.mode === 'tut' ? 'tut' : G && G.mode === 'demo' ? 'demo' : 'solo'));
  $('toLobbyBtn').addEventListener('click', toLobby); $('startBtn').addEventListener('click', startOnline);
  $('onSize').addEventListener('click', e => { const b = e.target.closest('button'); if (b) shell.setRoom('size', +b.dataset.v); });
  $('onDur').addEventListener('click', e => { const b = e.target.closest('button'); if (b) shell.setRoom('dur', +b.dataset.v); });
  $('teamPick').addEventListener('click', e => { const b = e.target.closest('button'); const r = shell.room; if (!b || !r || r.spectator) return; const v = +b.dataset.v, me = r.me; shell.edit('team', s => { if (s.ph !== 'lobby') return null; s.tm = Object.assign({}, s.tm || {}); if (s.tm[me] === v) return null; s.tm[me] = v; }); });
  cv.addEventListener('pointerdown', onDown); cv.addEventListener('pointermove', onMove); cv.addEventListener('pointerup', onUp); cv.addEventListener('pointercancel', onUp);
  $('pings').addEventListener('click', onPingBtn); $('pings').addEventListener('pointerdown', e => e.stopPropagation());
  document.addEventListener('keydown', e => onKey(e, true)); document.addEventListener('keyup', e => onKey(e, false));
  $('chatBtn').addEventListener('click', () => { const slot = $('chatSlot'), chat = $('chat'); if (slot.hidden) { slot.appendChild(chat); slot.hidden = false; } else { $('chatCard').appendChild(chat); slot.hidden = true; } });
  J.initMute('rebutbendera.mute', ['muteBtn', 'muteBtn2']);
  shell = window.MPShell({ slug: 'rebutbendera', title: 'Rebut Bendera Kampung', max: MAXP, defSet: { size: 2, dur: 180000 }, myName, saveName: n => J.setLS(NAME_KEY, n), toast, sfx: { chat: SX.chat, cheer: () => {} }, accent: '#e2412f', inviteText: 'Ayo main Rebut Bendera Kampung bareng! Tim Merah vs Biru 🚩',
    quick: CHEERS.concat(['Siap!', 'Ayo mulai!', 'GG 🔥']),
    onRoom, onLeave: () => { if (G && G.mode === 'online') G = null; $('result').hidden = true; $('chatSlot').hidden = true; $('chatCard').appendChild($('chat')); J.show('home'); },
    onChat: m => { if (!$('play').hidden) bubble(m.n, m.x); }, localChat: x => bubble(myName() || 'Kamu', x),
    color: (p, i) => { const r = shell && shell.room; const v = r ? lobbyTeams(r).out[p.id] : i % 2; return v ? '#2f7fd8' : '#e2412f'; }, tag: lobbyTag,
    hostHint: (r, ps) => ps.length >= 2 ? ps.length + ' pemain siap. Kursi kosong diisi bot.' : 'Bagikan link undangan. Sendirian? Teman dan lawan diisi bot.' });
  shell.conn.onInput = onInput;
  window.RBApp = { get G() { return G; }, shell, startSolo, toMenu, goTo, placePing, showResult, applyNet };
  shell.boot();
  if (DEMO) startSolo('demo');
  requestAnimationFrame(frame);
}
boot();
})();

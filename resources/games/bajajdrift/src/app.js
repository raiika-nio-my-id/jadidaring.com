/* Bajaj Drift app: home, race loop, input, ghosts, board. window.BDApp */
(function () {
'use strict';
const J = window.JDK, $ = J.$, O = window.BD, R = window.BR;
const NAME_KEY = 'bajajdrift.name', OPT_KEY = 'bajajdrift.opts', BEST = t => 'bajajdrift.best.' + t, RUNS_KEY = 'bajajdrift.runs';
const DEF = { monas: { name: 'Bang Komeng', time: 58 }, gang: { name: 'Mpok Ijah', time: 62 } };
const hash = () => location.hash || '';
const myName = () => ($('nameInput').value || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 16);
let S = { track: 'monas', ghost: 'top', liv: 'oranye' };
try { Object.assign(S, JSON.parse(J.getLS(OPT_KEY) || '{}')); } catch (e) { /* bad json */ }
if (!O.TRACKS[S.track]) S.track = 'monas';
let board = [], boardOk = false, mode = 'none', G = null, V = null, ghost = null, paused = false, acc = 0, last = 0, auto = false, endT = 0, coachStep = 0, posted = null;
const keys = { l: 0, r: 0, d: 0 }, pads = { l: 0, r: 0, d: 0 };
const H = { V: null, g: null };

/* ---------- best (local replay) ---------- */
function loadBest(t) { try { const b = JSON.parse(J.getLS(BEST(t)) || 'null'); return b && b.time > 0 && Array.isArray(b.rec) ? b : null; } catch (e) { return null; } }
function saveBest(t, b) { J.setLS(BEST(t), JSON.stringify(b)); }

/* ---------- board (/api/game/scores, Monas only: score = 300000 - ms) ---------- */
function parseBoard(d) {
  const arr = Array.isArray(d) ? d : d && (d.scores || d.data) || [], best = {};
  for (const e of arr) { const nm = String(e.name || e.player_name || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 16), sc = Number(e.score); if (!nm || !(sc > 0) || sc >= O.C.MAXMS) continue; const t = O.dec(sc) / 1000; if (t < 20) continue; const k = nm.toLowerCase(); if (!best[k] || best[k].time > t) best[k] = { name: nm, time: t }; }
  return Object.values(best).sort((a, b) => a.time - b.time);
}
async function loadBoard() {
  try { const r = await fetch('/api/game/scores?limit=50', { headers: { Accept: 'application/json' }, cache: 'no-store' }); if (!r.ok) throw Error(r.status); board = parseBoard(await r.json()); boardOk = true; }
  catch (e) { boardOk = false; }
  paintBoard(); paintGhostNote(); return board;
}
async function postScore(name, time) {
  try { const r = await fetch('/api/game/scores', { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ name, score: O.enc(time * 1000) }) }); return r.ok; } catch (e) { return false; }
}
function paintBoard() {
  const ul = $('boardList'), me = myName().toLowerCase(); ul.innerHTML = '';
  if (!board.length) { ul.innerHTML = '<li class="muted">' + (boardOk ? 'Belum ada catatan waktu. Jadilah juara pertama!' : 'Papan juara belum bisa dimuat.') + '</li>'; }
  board.slice(0, 10).forEach(e => { const li = document.createElement('li'); if (me && e.name.toLowerCase() === me) li.className = 'me'; li.innerHTML = '<span>' + J.esc(e.name) + '</span><em>' + O.fmt(e.time) + '</em>'; ul.appendChild(li); });
  $('boardNote').textContent = board.length ? 'Waktu tercepat 3 putaran Putaran Monas. Satu nama, satu rekor terbaik.' : '';
}

/* ---------- ghosts ---------- */
function myBoardTime() { const me = myName().toLowerCase(), e = me && board.find(x => x.name.toLowerCase() === me), b = loadBest('monas'); return Math.min(e ? e.time : 1e9, b ? b.time : 1e9); }
function pickGhost(t, kind) {
  const T = O.TRACKS[t], P = O.pace(t, T.laps), dflt = () => ({ kind: 'pace', P, scale: DEF[t].time / P.total, time: DEF[t].time, name: DEF[t].name, label: 'ghost latihan' });
  if (kind === 'none') return null;
  if (kind === 'me') { const b = loadBest(t); return b ? { kind: 'rec', rec: b.rec, time: b.time, name: 'Rekormu', label: 'replay rekormu' } : dflt(); }
  if (!T.board || !board.length) return dflt();
  let e = board[0];
  if (kind === 'rival') { const mine = myBoardTime(), me = myName().toLowerCase(), up = board.filter(x => x.time < mine - 0.005 && x.name.toLowerCase() !== me); e = up.length ? up[up.length - 1] : board[0]; if (mine < 1e9 && !up.length) return { kind: 'pace', P, scale: board[0].time / P.total, time: board[0].time, name: board[0].name, label: 'kamu juara, kejar dirimu' }; }
  return { kind: 'pace', P, scale: e.time / P.total, time: e.time, name: e.name + (e === board[0] ? ' 👑' : ''), label: kind === 'rival' ? 'rival satu tingkat di atasmu' : 'juara papan' };
}
function ghostPos(gh, t) { if (!gh) return null; const p = gh.kind === 'rec' ? O.recAt(gh.rec, Math.max(0, t)) : O.paceAt(gh.P, gh.scale, Math.max(0, t)); return p && { x: p.x, y: p.y, h: p.h, name: gh.name }; }
function ghostTimeAt(gh, dist) { if (!gh) return null; return gh.kind === 'rec' ? O.recTimeAt(gh.rec, dist) : O.paceTimeAt(gh.P, gh.scale, dist); }
function paintGhostNote() {
  const g = pickGhost(S.track, S.ghost), T = O.TRACKS[S.track]; let m;
  if (!g) m = 'Balap sendirian, tanpa ghost.';
  else if (g.kind === 'rec') m = '👻 Replay rekormu sendiri (' + O.fmt(g.time) + ').';
  else if (!T.board && S.ghost !== 'me') m = 'Papan juara hanya untuk Putaran Monas. Di Gang Senen kamu ditemani ' + g.name + ' (' + O.fmt(g.time) + ').';
  else if (S.ghost === 'me') m = 'Belum ada rekormu di sirkuit ini. Sementara ditemani ' + g.name + ' (' + O.fmt(g.time) + ').';
  else if (!board.length) m = 'Belum ada juara. Ghost latihan ' + g.name + ' (' + O.fmt(g.time) + ') menemanimu.';
  else m = (S.ghost === 'rival' ? '🎯 ' : '👑 ') + g.name.replace(' 👑', '') + ' · ' + O.fmt(g.time) + ' (' + g.label + '). Ghost papan melaju di jalur ideal dengan waktu mereka.';
  $('ghostNote').textContent = m;
}

/* ---------- sound ---------- */
let E = { o: null };
function engOn() { const a = J.ac(); if (!a || E.o) return; try { const o = a.createOscillator(), f = a.createBiquadFilter(), g = a.createGain(), l = a.createOscillator(), lg = a.createGain(); o.type = 'sawtooth'; f.type = 'lowpass'; f.frequency.value = 500; g.gain.value = 0; l.type = 'square'; l.frequency.value = 18; lg.gain.value = 0.01; l.connect(lg).connect(g.gain); o.connect(f).connect(g).connect(a.destination); o.start(); l.start(); E = { o, f, g, l, a }; } catch (e) { E = { o: null }; } }
function engSet(v, on) { if (!E.o) return; const t = E.a.currentTime; E.o.frequency.setTargetAtTime(46 + v * 5.2, t, 0.05); E.l.frequency.setTargetAtTime(13 + v * 1.3, t, 0.05); E.g.gain.setTargetAtTime(on ? 0.022 : 0, t, 0.08); E.f.frequency.setTargetAtTime(380 + v * 42, t, 0.1); }
function engOff() { if (!E.o) return; try { E.g.gain.cancelScheduledValues(0); E.o.stop(); E.l.stop(); } catch (e) { /* stopped */ } E = { o: null }; }
const sfx = {
  cd: () => J.tone(520, 0.14, 'square', 0.06), go: () => J.tone(1040, 0.35, 'square', 0.07),
  hop: () => J.tone(300, 0.07, 'triangle', 0.05, 420), drift: () => J.noise(0.25, 0.05, 1800),
  tier: t => { J.tone([0, 700, 880, 1100][t], 0.09, 'square', 0.05); J.tone([0, 1050, 1320, 1650][t], 0.09, 'square', 0.04, 0, 0.06); },
  boost: t => { J.noise(0.35 + t * 0.1, 0.07, 600); J.tone(160, 0.4 + t * 0.1, 'sawtooth', 0.05, 480 + t * 160); },
  bump: () => { J.noise(0.18, 0.12, 80, 0, true); J.tone(110, 0.15, 'square', 0.06, 60); },
  lap: () => { J.tone(784, 0.1, 'square', 0.05); J.tone(988, 0.16, 'square', 0.05, 0, 0.1); },
  fin: () => [523, 659, 784, 1047].forEach((f, i) => J.tone(f, 0.18, 'square', 0.06, 0, i * 0.12)),
  lost: () => J.tone(220, 0.18, 'triangle', 0.05, 150)
};

/* ---------- ui helpers ---------- */
let callT = 0;
function call(txt, sub, cls, ms) { const el = $('call'); el.innerHTML = '<b class="' + (cls || '') + '">' + J.esc(txt) + '</b>' + (sub ? '<small>' + J.esc(sub) + '</small>' : ''); clearTimeout(callT); callT = setTimeout(() => { el.innerHTML = ''; }, ms || 1100); }
function coach(m) { const c = $('coach'); if (!m) { c.hidden = true; return; } c.innerHTML = m; c.hidden = false; }
function setSeg(id, v) { for (const b of $(id).children) b.classList.toggle('on', b.dataset.v === v); }
function saveOpts() { J.setLS(OPT_KEY, JSON.stringify(S)); }
function paintHome() {
  setSeg('trackSeg', S.track); setSeg('ghostSeg', S.ghost); setSeg('livSeg', S.liv);
  const T = O.TRACKS[S.track], b = loadBest(S.track);
  $('playSub').textContent = T.laps + ' putaran ' + (S.track === 'monas' ? 'keliling Monas' : 'di gang sempit Senen');
  $('recBtn').disabled = !b; $('recTitle').textContent = b ? O.fmt(b.time) : 'Rekorku'; $('recSub').textContent = b ? 'Balap lawan replay-mu' : 'Belum ada di ' + T.short;
  $('boardTrack').textContent = 'Putaran Monas · 3 putaran'; paintGhostNote();
}

/* ---------- race ---------- */
function start(m, opt) {
  opt = opt || {}; mode = m; auto = m === 'demo' || !!opt.auto; paused = false; acc = 0; endT = 0; coachStep = 0; posted = null;
  const tid = m === 'tut' ? 'monas' : opt.track || S.track;
  G = O.create(tid, { laps: m === 'tut' ? 2 : undefined }); G.lastTier = 1;
  ghost = m === 'tut' ? null : pickGhost(tid, m === 'demo' ? 'top' : opt.ghost || S.ghost);
  if (!V) V = R.view($('cv'), tid); else R.setTrack(V, tid);
  J.show('play'); $('pause').hidden = true; $('result').hidden = true; $('wrong').hidden = true; coach(null);
  for (const k in pads) pads[k] = 0; paintPads();
  call('3', ghost ? 'Lawan: ' + ghost.name : (m === 'tut' ? 'Latihan' : ''), 'cd', 900); sfx.cd(); engOn();
  if (m === 'tut') coach('Bajaj ngegas sendiri. Belok pakai <b>◀ ▶</b>, ikuti jalan.');
  else if (m === 'race' && !loadBest(tid) && (+J.getLS(RUNS_KEY) || 0) < 2) coach('Tips: di tikungan <b>tahan DRIFT</b> sambil belok, lepas saat percikan <b>oranye/ungu</b>.');
  J.ac();
}
function inputNow() { if (auto) return O.bot(G, 0.92); return { steer: (keys.r || pads.r ? 1 : 0) - (keys.l || pads.l ? 1 : 0), drift: !!(keys.d || pads.d) }; }
function tick(dt) {
  if (!G) return; if (!G.over) G.inp = inputNow(); else G.inp = { steer: 0, drift: false };
  O.step(G, dt); R.fxStep(V, G, dt);
  for (const e of G.ev) onEv(e); G.ev.length = 0;
  if (mode === 'tut') tutor();
  if (mode === 'race' && coachStep === 0 && G.t > 9) { coachStep = 9; coach(null); }
}
function onEv(e) {
  switch (e.t) {
    case 'cd': call(String(e.n), '', 'cd', 900); sfx.cd(); break;
    case 'go': call('GAS!', '', 'b2', 900); sfx.go(); J.buzz(30); break;
    case 'hop': sfx.hop(); break;
    case 'drift': sfx.drift(); break;
    case 'tier': sfx.tier(e.tier); J.buzz(15); break;
    case 'boost': G.lastTier = e.tier; V.shake = 0.15 + 0.1 * e.tier; sfx.boost(e.tier); J.buzz(25 + e.tier * 10); call(['', 'BOOST', 'BOOST!!', 'TURBO UNGU!!!'][e.tier], '', 'b' + e.tier, 800); break;
    case 'driftLost': sfx.lost(); if (mode !== 'demo') J.toast('Drift putus 💥', 'warn', 900); break;
    case 'driftEnd': if (e.pts >= 60 && mode !== 'demo') J.toast('Drift +' + e.pts + (e.pts >= 200 ? ' 🔥' : ''), 'good', 900); break;
    case 'bump': V.shake = 0.5; sfx.bump(); J.buzz(60); R.burst(V, G.x, G.y, 6, ['#d9cdb5', '#b9a98a'], 'smoke'); break;
    case 'lap': { sfx.lap(); const lt = G.lapT[G.lapT.length - 1]; call(e.final ? 'PUTARAN TERAKHIR!' : 'PUTARAN ' + (G.lap + 1), 'putaran ' + G.lap + ': ' + O.fmt(lt), 'b2', 1500); break; }
    case 'finish': finish(); break;
    case 'wrong': J.buzz(40); break;
  }
}
function tutor() {
  const g = G, s = g.stats;
  if (coachStep === 0 && g.t > 4) { coachStep = 1; coach('Tikungan! <b>Tahan DRIFT</b> sambil tekan <b>◀</b> atau <b>▶</b>.'); }
  else if (coachStep === 1 && s.drifts > 0) { coachStep = 2; coach('Tahan terus… percikan <b class="t1">biru</b> → <b class="t2">oranye</b> → <b class="t3">ungu</b>. Lalu <b>LEPAS</b>!'); }
  else if (coachStep === 2 && (s.boosts[1] + s.boosts[2] > 0 || s.boosts[0] > 1)) { coachStep = 3; coach('Mantap! Boost ungu paling kencang. Selesaikan 2 putaran.'); setTimeout(() => { if (coachStep === 3) coach(null); }, 3500); }
  else if (coachStep === 2 && g.drift && g.tier >= 2) coach('Sekarang <b>LEPAS</b> tombol DRIFT! 🚀');
}
function finish() {
  sfx.fin(); call('FINIS!', O.fmt(G.time), 'b2', 1800); R.burst(V, G.x, G.y, 40, ['#ff5a3c', '#ffd23f', '#59c7ff', '#fff', '#2f9e5a'], 'conf');
  if (mode === 'demo') { endT = setTimeout(() => { if (mode === 'demo') start('demo'); }, 3500); return; }
  J.setLS(RUNS_KEY, String((+J.getLS(RUNS_KEY) || 0) + 1));
  const tid = G.id, prev = loadBest(tid), isBest = mode === 'race' && (!prev || G.time < prev.time - 1e-6);
  if (isBest) saveBest(tid, { time: +G.time.toFixed(3), rec: G.rec.concat([Math.round(G.x * 10), Math.round(G.y * 10), Math.round(G.h * 100), Math.round(G.maxDist * 10)]), at: Date.now(), name: myName() });
  const nm = myName(); posted = null;
  if (mode === 'race' && G.T.board && nm) posted = postScore(nm, G.time).then(ok => ok ? loadBoard() : null);
  endT = setTimeout(() => result(prev, isBest), 1400);
}
async function result(prev, isBest) {
  if (!G) return; const g = G, T = g.T, tut = mode === 'tut';
  engSet(0, false);
  $('resKick').textContent = (tut ? 'LATIHAN · ' : '') + T.name.toUpperCase();
  $('resTitle').textContent = tut ? 'Latihan selesai! 🎓' : isBest ? (prev ? 'Rekor baru! 🏆' : 'Rekor pertamamu! 🏁') : 'Finis! 🏁';
  $('resTime').textContent = O.fmt(g.time);
  let sub = '';
  if (!tut && prev && !isBest) sub = 'Rekormu ' + O.fmt(prev.time) + ' (+' + (g.time - prev.time).toFixed(2) + ' dtk)';
  else if (!tut && prev && isBest) sub = 'Lebih cepat ' + (prev.time - g.time).toFixed(2) + ' dtk dari rekor lama';
  if (ghost && !tut) { const d = g.time - ghost.time; sub += (sub ? ' · ' : '') + (d < 0 ? 'Menang ' + (-d).toFixed(2) + ' dtk dari ' : 'Kalah ' + d.toFixed(2) + ' dtk dari ') + ghost.name.replace(' 👑', ''); }
  $('resSub').textContent = sub;
  const bl = Math.min.apply(null, g.lapT), rows = g.lapT.map((t, i) => '<tr' + (t === bl && g.lapT.length > 1 ? ' class="best"' : '') + '><td>Putaran ' + (i + 1) + (t === bl && g.lapT.length > 1 ? ' ⚡' : '') + '</td><td>' + O.fmt(t) + '</td></tr>');
  const s = g.stats; rows.push('<tr><td>Drift · boost ungu</td><td>' + s.drifts + ' · ' + s.boosts[2] + '×</td></tr>', '<tr><td>Kecepatan puncak</td><td>' + s.maxKmh + ' km/j</td></tr>', '<tr><td>Nabrak pagar</td><td>' + s.bumps + '×</td></tr>');
  $('resTable').innerHTML = rows.join('');
  let note = '';
  if (tut) note = 'Siap? Balapan 3 putaran dan kejar ghost juara.';
  else if (!T.board) note = 'Rekor Gang Senen disimpan di HP ini. Papan juara online hanya untuk Putaran Monas.';
  else if (!myName()) note = 'Isi nama pembalap di menu supaya waktumu masuk papan juara.';
  else note = 'Mengirim waktu ke papan juara…';
  $('resNote').textContent = note; $('result').hidden = false; J.show('play', false);
  if (posted) { const b = await posted; if (b && G === g) { const me = myName().toLowerCase(), i = board.findIndex(x => x.name.toLowerCase() === me); $('resNote').textContent = i >= 0 ? 'Peringkat #' + (i + 1) + ' dari ' + board.length + ' di papan juara Putaran Monas' + (board[i].time < g.time - 0.005 ? ' (rekor terbaikmu ' + O.fmt(board[i].time) + ')' : '') + '.' : 'Waktu terkirim.'; } else if (G === g) $('resNote').textContent = 'Papan juara sedang tidak bisa dihubungi. Rekor tetap tersimpan di HP ini.'; }
}
function share() {
  if (!G) return; const t = 'Aku finis ' + O.fmt(G.time) + ' di Bajaj Drift (' + G.T.name + ')! 🛺💨 Bisa lebih cepat?', url = location.origin + location.pathname;
  if (navigator.share) navigator.share({ title: 'Bajaj Drift', text: t, url }).catch(() => {}); else if (navigator.clipboard) navigator.clipboard.writeText(t + ' ' + url).then(() => J.toast('Teks pamer disalin 📋', 'good'), () => J.toast(t)); else J.toast(t);
}
function toHome() { clearTimeout(endT); mode = 'none'; G = null; engOff(); $('result').hidden = true; $('pause').hidden = true; J.show('home'); paintHome(); paintBoard(); }
function pause(on) { if (mode === 'none' || mode === 'demo' || !G || G.over) return; paused = on; $('pause').hidden = !on; if (on) engSet(0, false); }

/* ---------- loop ---------- */
function hud() {
  const g = G; $('lapTxt').textContent = Math.min(g.laps, g.lap + 1) + '/' + g.laps; $('timeTxt').textContent = O.fmt(Math.max(0, g.over ? g.time : g.t));
  const gp = $('gapTxt'); let gt = null; if (ghost && g.t > 0 && g.maxDist > 2) gt = ghostTimeAt(ghost, g.maxDist);
  if (gt != null) { const d = (g.over ? g.time : g.t) - gt; gp.textContent = (d > 0 ? '+' : '−') + Math.abs(d).toFixed(2); gp.className = 'gap ' + (d > 0 ? 'behind' : 'ahead'); } else { gp.textContent = ''; gp.className = 'gap'; }
  $('kmh').textContent = Math.round(g.v * O.C.KMH);
  $('charge').className = 'charge' + (g.boostT > 0 ? ' boost c' + (g.lastTier || 1) : g.drift ? ' c' + g.tier : '');
  const pd = $('padD'); pd.classList.toggle('t1', g.drift && g.tier === 1); pd.classList.toggle('t2', g.drift && g.tier === 2); pd.classList.toggle('t3', g.drift && g.tier === 3);
  const w = g.wrong && !g.over; if ($('wrong').hidden === w) $('wrong').hidden = !w;
}
function loop(ts) {
  requestAnimationFrame(loop); const dt = Math.min(0.05, Math.max(0, (ts - last) / 1000 || 0)); last = ts;
  if (G && !$('play').hidden) {
    if (!paused) { acc += dt; let n = 0; while (acc >= O.C.DT && n < 5) { acc -= O.C.DT; tick(O.C.DT); n++; } if (n >= 5) acc = 0; }
    if (!G) return;
    const gp = ghostPos(ghost, G.t);
    R.frame(V, paused ? 0 : dt, G, { ghost: gp, livery: S.liv, zoom: 1.5 }); R.mini($('mini'), V.T, G, gp); hud();
    engSet(G.v, !paused && !G.over);
  } else if (!$('home').hidden) heroFrame(dt);
}
function heroFrame(dt) {
  const cv = $('heroCv'); if (!cv.clientWidth) return;
  if (!H.V) { H.V = R.view(cv, 'monas'); H.g = O.create('monas', { noCountdown: true, free: true }); H.g.lastTier = 1; for (let i = 0; i < 60 * 9; i++) { H.g.inp = O.bot(H.g, 1); O.step(H.g, O.C.DT); H.g.ev.length = 0; } }
  const g = H.g; H.acc = (H.acc || 0) + dt; while (H.acc >= O.C.DT) { H.acc -= O.C.DT; g.inp = O.bot(g, 1); O.step(g, O.C.DT); for (const e of g.ev) if (e.t === 'boost') g.lastTier = e.tier; g.ev.length = 0; R.fxStep(H.V, g, O.C.DT); }
  R.frame(H.V, dt, g, { hero: true, livery: S.liv, zoom: 1.3, cy: 0.4 });
}

/* ---------- input ---------- */
function paintPads() { $('padL').classList.toggle('on', !!pads.l); $('padR').classList.toggle('on', !!pads.r); $('padD').classList.toggle('on', !!pads.d); }
function bindPad(id, k) {
  const el = $(id), on = e => { e.preventDefault(); try { el.setPointerCapture(e.pointerId); } catch (x) { /* no */ } pads[k] = 1; paintPads(); J.ac(); }, off = e => { e.preventDefault(); pads[k] = 0; paintPads(); };
  el.addEventListener('pointerdown', on); el.addEventListener('pointerup', off); el.addEventListener('pointercancel', off); el.addEventListener('lostpointercapture', off); el.addEventListener('contextmenu', e => e.preventDefault());
}
const KM = { ArrowLeft: 'l', a: 'l', A: 'l', ArrowRight: 'r', d: 'r', D: 'r', ' ': 'd', Shift: 'd', ArrowDown: 'd', s: 'd', S: 'd', ArrowUp: 'd', w: 'd', W: 'd' };
document.addEventListener('keydown', e => {
  if (e.target && /INPUT|TEXTAREA/.test(e.target.tagName)) return; if ($('play').hidden) return;
  const k = KM[e.key]; if (k) { keys[k] = 1; e.preventDefault(); return; }
  if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') pause(!paused);
  else if ((e.key === 'r' || e.key === 'R') && mode !== 'demo' && mode !== 'none') start(mode);
});
document.addEventListener('keyup', e => { const k = KM[e.key]; if (k) keys[k] = 0; });
window.addEventListener('blur', () => { keys.l = keys.r = keys.d = 0; });
document.addEventListener('visibilitychange', () => { if (document.hidden) { pause(true); engSet(0, false); } });

/* ---------- init ---------- */
function init() {
  $('nameInput').value = J.getLS(NAME_KEY) || '';
  $('nameInput').addEventListener('change', () => { J.setLS(NAME_KEY, myName()); paintBoard(); paintGhostNote(); });
  if (window.JDNG) window.JDNG.on(n => { if (n && !$('nameInput').value) { $('nameInput').value = n; J.setLS(NAME_KEY, myName()); paintBoard(); } });
  J.initMute('bajajdrift.mute', ['muteBtn', 'muteBtn2'], m => { if (m) engOff(); else if (G && !G.over) engOn(); });
  const segs = { trackSeg: 'track', ghostSeg: 'ghost', livSeg: 'liv' };
  for (const id in segs) $(id).addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; S[segs[id]] = b.dataset.v; saveOpts(); paintHome(); J.tone(600, 0.04, 'square', 0.03); });
  $('playBtn').addEventListener('click', () => { J.setLS(NAME_KEY, myName()); start('race'); });
  $('tutBtn').addEventListener('click', () => start('tut'));
  $('recBtn').addEventListener('click', () => start('race', { ghost: 'me' }));
  $('pauseBtn').addEventListener('click', () => pause(true)); $('resumeBtn').addEventListener('click', () => pause(false));
  $('restartBtn').addEventListener('click', () => start(mode)); $('quitBtn').addEventListener('click', toHome);
  $('againBtn').addEventListener('click', () => start(mode === 'tut' ? 'race' : mode)); $('resMenu').addEventListener('click', toHome); $('shareBtn').addEventListener('click', share);
  bindPad('padL', 'l'); bindPad('padR', 'r'); bindPad('padD', 'd');
  paintHome(); loadBoard();
  if (/^#demo/.test(hash())) start('demo'); else J.show('home');
  requestAnimationFrame(loop);
}
window.BDApp = {
  get G() { return G; }, get V() { return V; }, get ghost() { return ghost; }, get mode() { return mode; }, get board() { return board; }, get S() { return S; }, get paused() { return paused; },
  set auto(v) { auto = !!v; }, get auto() { return auto; }, keys, pads,
  start, toHome, loadBoard, parseBoard, pickGhost, ghostPos, ghostTimeAt, pause, loadBest,
  ff(sec) { for (let i = 0; i < sec * 60 && G && !G.over; i++) tick(O.C.DT); } // tests: fast-forward
};
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();

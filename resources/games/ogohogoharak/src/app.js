/* Ogoh-Ogoh Arak app: home, solo (bots) / latihan / demo, online co-op 2-6 (shared beat clock, per-bar reports, host seals), baleganjur audio, cheer chat. */
(function () {
'use strict';
const O = window.OG, R = window.OR, J = window.JDK, $ = J.$, toast = J.toast;
const NAME_KEY = 'ogohogoharak.name', OG_KEY = 'ogohogoharak.og', STAT_KEY = 'ogohogoharak.stat';
const MAXP = 6, SEAL_MS = 1000, REP_MS = 150;
const DEMO = /demo/i.test(location.hash);
let design = +(J.getLS(OG_KEY) || 0); if (!(design >= 0 && design < 3)) design = 0;
const stat = (() => { try { return Object.assign({ n: 0, w: 0, best: 0, stars: 0 }, JSON.parse(J.getLS(STAT_KEY) || '{}')); } catch (e) { return { n: 0, w: 0, best: 0, stars: 0 }; } })();
const myName = () => ($('nameInput').value || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 16);
const BOTN = ['Made', 'Ketut', 'Komang', 'Nyoman', 'Gede', 'Putu', 'Wayan', 'Kadek'];
/* ---------- audio: baleganjur ---------- */
const PELOG = [293.7, 311.1, 370, 440, 466.2, 587.3];
const MEL = [0, 2, 3, 2, 4, 3, 2, 1, 0, 2, 4, 5, 4, 3, 2, 0];
const S = {
  gong(d) { J.tone(82, 2.2, 'sine', 0.22, 78, d); J.tone(164, 1.6, 'sine', 0.06, 160, d); J.tone(247, 0.9, 'triangle', 0.025, 0, d); },
  dug(d) { J.tone(120, 0.16, 'sine', 0.3, 55, d); J.noise(0.04, 0.12, 0, d, 900); },
  tak(d) { J.noise(0.05, 0.16, 1800, d); J.tone(420, 0.04, 'triangle', 0.05, 300, d); },
  ceng(d, v) { J.noise(0.07, v || 0.07, 6500, d); },
  reyong(i, d) { const f = PELOG[MEL[i % MEL.length]]; J.tone(f * 2, 0.22, 'triangle', 0.045, f * 1.99, d); J.tone(f * 4.01, 0.12, 'sine', 0.012, 0, d); },
  prit(d) { J.tone(2600, 0.12, 'sine', 0.06, 2500, d); J.tone(2600, 0.2, 'sine', 0.06, 2300, (d || 0) + 0.16); },
  tap() { J.tone(700, 0.04, 'square', 0.025); },
  miss() { J.tone(160, 0.18, 'sawtooth', 0.05, 90); },
  drop() { J.tone(200, 0.6, 'sawtooth', 0.09, 50); J.noise(0.5, 0.25, 0, 0, 500); },
  cheer() { J.noise(1.8, 0.16, 0, 0, 1400); J.noise(1.2, 0.08, 2600, 0.1); },
  fire() { J.noise(3.5, 0.12, 0, 0, 700); J.noise(2.5, 0.05, 3000, 0.4); },
  chat() { J.tone(990, 0.06, 'sine', 0.05); },
};
let schedBeat = -99;
function music(G, now) {
  const rel = now - G.t0, nb = Math.floor((rel + 160) / O.BEAT); if (nb <= schedBeat) return; schedBeat = nb; if (J.Snd.muted) return;
  const bt = nb * O.BEAT, d = Math.max(0, (bt - rel) / 1000), bar = Math.floor(nb / 4), k = ((nb % 4) + 4) % 4;
  if (nb < 0) { if (nb >= -4) S.tak(d); return; }
  if (bar >= G.types.length) return;
  const ty = G.types[bar], hen = ty === 'h';
  if (k === 0 && bar % 2 === 0) S.gong(d); if (hen) return;
  if (k === 0 && (G.types[bar] === 'L' || G.types[bar] === 'R')) S.prit(d);
  if (k % 2 === 0) S.dug(d); else S.tak(d);
  S.ceng(d + O.BEAT / 2000, 0.08); S.ceng(d + O.BEAT * 0.75 / 1000, 0.04);
  S.reyong(nb * 2, d); S.reyong(nb * 2 + 1, d + O.BEAT / 2000);
}
/* ---------- home ---------- */
function paintOg() { $('ogPick').innerHTML = O.DESIGNS.map(d => '<button class="og" role="radio" aria-checked="' + (d.id === design) + '" data-v="' + d.id + '"><canvas width="128" height="128"></canvas>' + J.esc(d.name) + '</button>').join(''); $('ogPick').querySelectorAll('.og').forEach((b, i) => R.ogIcon(b.querySelector('canvas'), O.DESIGNS[i])); }
function paintStat() { $('statTitle').textContent = stat.n ? 'Terbaik ' + stat.best : 'Rekor'; $('statSub').textContent = stat.n ? stat.w + '/' + stat.n + ' pawai sukses · ' + '★'.repeat(stat.stars) : 'Belum main'; }
/* ---------- run ---------- */
let G = null;
function newRun(mode, o) {
  o = o || {}; const seed = o.seed != null ? o.seed >>> 0 : (Math.random() * 1e9) >>> 0;
  G = Object.assign({ mode, seed, g: o.g || 'L' + seed, types: O.route(seed, mode === 'tut' ? { bars: 10, hening: 1 } : {}), t0: 0, design: O.DESIGNS[o.og == null ? design : o.og], crew: [], botSkill: 0.78, taps: [], myAcc: [], myHits: [], sealed: [], reported: {}, phase: 'count', noDrop: mode === 'tut', auto: mode === 'demo', simR: null, seenDrops: 0, dropAt: -9e9, judge: null, seat: 0, others: {}, ended: false }, o.extra || {});
  schedBeat = -99; return G;
}
const clock = () => G && G.mode === 'online' ? shell.sNow() : performance.now();
function startSolo(mode) {
  J.setLS(NAME_KEY, myName()); newRun(mode); const me = myName() || 'Kamu';
  G.crew = [{ id: 'me', n: me, me: true }].concat([0, 1, 2].map(i => ({ id: 'b' + i, n: BOTN[i], bot: true, bi: i })));
  if (mode === 'demo') { G.crew[0] = { id: 'me', n: 'Demo', me: true }; }
  G.t0 = clock() + O.LEAD; startPlay();
}
function startPlay() { J.show('play'); $('result').hidden = true; $('bubbles').innerHTML = ''; $('coach').hidden = true; $('chatBtn').hidden = !(G && G.mode === 'online'); paintCorners(); hud(); }
function paintCorners() { $('corners').innerHTML = G.types.map((t, i) => t === 'L' || t === 'R' || t === 'h' ? '<b class="' + (t === 'h' ? 'h' : '') + '" style="left:' + ((i + 0.5) / G.types.length * 100).toFixed(1) + '%"></b>' : '').join(''); }
function relNow() { return clock() - G.t0; }
function tap(dir) {
  if (!G || G.phase !== 'walk' && G.phase !== 'count' || G.spectate) return; const rel = relNow(); if (rel < -O.WIN.ok) return;
  const bar = Math.floor((rel + O.WIN.ok) / O.BAR), ty = G.types[bar]; if (!ty) return;
  G.taps.push({ t: Math.round(rel), d: dir }); if (G.taps.length > 400) G.taps.splice(0, 100);
  const nb = Math.round(rel / O.BEAT), dt = Math.abs(rel - nb * O.BEAT), want = ty === 'L' ? -1 : ty === 'R' ? 1 : 0;
  let jt, jc; if (ty === 'h') { jt = 'SSST! 🤫'; jc = '#8fd3ff'; S.miss(); G.wob = 1; }
  else if (dt > O.WIN.ok) { jt = 'MELESET'; jc = '#ff6b6b'; S.miss(); G.wob = 1; }
  else if (want && dir !== want) { jt = dir ? 'SALAH ARAH' : 'KE SAMPING!'; jc = '#ff9a3c'; S.miss(); G.wob = 0.7; }
  else { jt = dt <= O.WIN.perfect ? 'PAS!' : dt <= O.WIN.good ? 'BAGUS' : 'OK'; jc = dt <= O.WIN.perfect ? '#35d07f' : dt <= O.WIN.good ? '#ffc93c' : '#ffb07a'; S.tap(); J.buzz && J.buzz(12); }
  G.judge = { jt, jc, at: performance.now(), x: dir < 0 ? 0.25 : dir > 0 ? 0.75 : 0.5 };
}
function autoTap(rel) { // demo / test bot: taps near each beat with a little jitter
  const nb = Math.floor(rel / O.BEAT) + 1; if (G.autoNext == null || G.autoNext < nb - 1) G.autoNext = Math.max(0, nb - 1);
  const k = G.autoNext, bt = k * O.BEAT, bar = Math.floor(k / 4), ty = G.types[bar]; if (!ty) return; const jit = G.autoJ != null ? G.autoJ : ((O.rng(k * 31 + G.seed)() - 0.5) * 70);
  if (rel >= bt + jit) { G.autoNext = k + 1; if (ty !== 'h') tap(ty === 'L' ? -1 : ty === 'R' ? 1 : 0); }
}
function judgeBars(rel) {
  for (let n = G.myAcc.length; n < G.types.length; n++) { if (rel < (n + 1) * O.BAR - O.WIN.ok + 5) break; const j = O.judge(G.spectate ? [] : G.taps, n, G.types[n]); G.myAcc[n] = j.acc; G.myHits[n] = j.hits; }
}
function botsFor(n, ids) { return G.crew.filter(c => c.bot).map(c => O.botAcc(G.seed, n, c.bi, G.botSkill)); }
function offlineSeal() { for (let n = G.sealed.length; n < G.myAcc.length; n++) G.sealed[n] = Math.round(O.team([G.myAcc[n]], botsFor(n)) * 100) / 100; }
function frameRun(now) {
  const rel = relNow(); if (G.auto && G.phase !== 'burn' && G.phase !== 'fail') autoTap(rel);
  if (G.phase === 'count' && rel >= 0) G.phase = 'walk';
  if (G.phase === 'count' || G.phase === 'walk') { music(G, clock()); judgeBars(rel); if (G.mode === 'online') onlineTick(rel); else offlineSeal(); }
  const r = O.sim(G.sealed.map(x => x), G.types, { noDrop: G.noDrop }); G.simR = r;
  if (G.sealed.length > (G.flashN || 0)) { const a = G.sealed[G.sealed.length - 1], ty = G.types[G.sealed.length - 1]; G.flashN = G.sealed.length; if (ty !== 'h' || a < 0.5) { if (a >= 0.85) { G.flash = { t: performance.now(), txt: (ty === 'L' || ty === 'R') ? 'PUTARAN KOMPAK! 🌀' : 'KOMPAK! +' + Math.round(a * 100), c: '#7dffb0' }; J.noise(0.5, 0.05, 0, 0, 1600); } else if (a < 0.45) G.flash = { t: performance.now(), txt: 'GOYANG!', c: '#ff7a6b' }; } }
  if (r.drops > G.seenDrops) { G.seenDrops = r.drops; G.dropAt = performance.now(); S.drop(); toast('Ogoh-ogoh jatuh! Angkat lagi… (' + (3 - r.drops) + ' kesempatan)', 'warn', 2200); }
  if (r.over && (G.phase === 'walk' || G.phase === 'count')) { G.phase = G.endKind = r.win ? 'burn' : 'fail'; G.endAt = performance.now(); if (r.win) { S.cheer(); S.fire(); } else S.drop(); }
  if ((G.phase === 'burn' && performance.now() - G.endAt > 7000) || (G.phase === 'fail' && performance.now() - G.endAt > 3200)) finish();
}
/* ---------- drawing ---------- */
const cv = $('cv');
function stFor(now, rel) {
  const types = G.types, n = Math.floor(rel / O.BAR), ty = types[n], t = now / 1000, r = G.simR || { bal: 1, drops: 0 };
  const beatPh = ((rel / O.BEAT) % 1 + 1) % 1, uEnd = types.length * R.SPEED;
  const st = { types, design: G.design, u: Math.min(uEnd + 0.6, Math.max(0, rel / O.BAR * R.SPEED)), crew: [], ay: 0.57 };
  st.crew = crewView(); st.bob = rel > 0 && ty && ty !== 'h' && G.phase === 'walk' ? Math.pow(1 - beatPh, 3) : 0;
  const instab = Math.pow(1 - r.bal, 1.4); G.wob = (G.wob || 0) * 0.94; const wa = 0.05 + instab * 0.32 + G.wob * 0.12;
  st.wobA = Math.sin(t * 4.2) * wa + Math.sin(t * 7.1) * wa * 0.3; st.wobT = Math.sin(t * 4.2) * (instab + G.wob * 0.5);
  if (ty === 'L' || ty === 'R') { const q = (rel - n * O.BAR) / O.BAR, e = q < 0.15 ? 0 : q > 0.9 ? 1 : (q - 0.15) / 0.75; st.spinA = (ty === 'L' ? -1 : 1) * (e * e * (3 - 2 * e)) * Math.PI * 2; }
  const da = performance.now() - G.dropAt; if (da < 2200) { st.drop = da < 350 ? da / 350 : da < 1100 ? 1 : 1 - (da - 1100) / 1100; st.dropDir = G.seenDrops % 2 ? 1 : -1; }
  if (ty === 'h' && G.phase === 'walk') st.hening = 1;
  const ph = G.phase === 'end' ? G.endKind : G.phase;
  if (ph === 'burn') { const e = Math.min(9, (performance.now() - G.endAt) / 1000); st.u = uEnd + 1; st.away = Math.min(1, e / 1.2); st.fire = Math.min(1, Math.max(0, (e - 1) / 2)); st.burn = Math.min(1, Math.max(0, (e - 1.6) / 3)); st.collapse = Math.min(1, Math.max(0, (e - 4.2) / 1.6)); st.wobA = Math.sin(t * 3) * 0.03; st.spinA = 0; }
  if (ph === 'fail') { const e = (performance.now() - G.endAt) / 1000; st.drop = 1; st.fall = Math.min(0.5, e * 0.6) * (st.dropDir || 1); st.dropDir = 1; }
  return st;
}
function crewView() { const n = G.myAcc.length - 1; return G.crew.map(c => { let acc = null; if (n >= 0) { if (c.me) acc = G.myAcc[n]; else if (c.bot) acc = O.botAcc(G.seed, n, c.bi, G.botSkill); else { const a = (G.others[c.id] || [])[n]; acc = a == null ? null : a / 100; } } return { n: c.n + (c.gone ? ' (keluar)' : ''), me: c.me, bot: c.bot, acc }; }); }
function draw(now) {
  const { g, W, H } = J.fitCanvas(cv), rel = relNow();
  R.scene(g, W, H, stFor(now, rel), now);
  if (G.phase === 'count' || G.phase === 'walk') {
    const n = Math.max(0, Math.floor((rel + O.WIN.ok) / O.BAR)), k = Math.floor(((rel + O.WIN.ok) % O.BAR) / O.BEAT), ph = ((rel / O.BEAT) % 1 + 1) % 1;
    const hits = curHits(n), jd = G.judge, cnt = rel < 0 ? (rel < -O.BEAT * 3 ? '3' : rel < -O.BEAT * 2 ? '2' : rel < -O.BEAT ? '1' : 'ARAK! 🥁') : (rel < 500 ? 'ARAK! 🥁' : '');
    R.cue(g, W, H, { ph, rel, types: G.types, BEAT: O.BEAT, type: G.types[n], next: G.types[n + 1], hits, beat: k, count: rel < -O.LEAD + 400 ? '' : cnt, jt: jd && jd.jt, jc: jd && jd.jc, jx: jd && jd.x * W, jAge: jd ? performance.now() - jd.at : 9e9 }, now);
    if (G.flash && performance.now() - G.flash.t < 900) { const e = (performance.now() - G.flash.t) / 900; g.save(); g.globalAlpha = 1 - e * e; g.textAlign = 'center'; g.font = '900 ' + Math.round(26 + 10 * Math.min(1, e * 5)) + 'px system-ui,sans-serif'; g.lineWidth = 6; g.strokeStyle = 'rgba(20,6,10,.85)'; g.strokeText(G.flash.txt, W / 2, H * 0.3 - e * 20); g.fillStyle = G.flash.c; g.fillText(G.flash.txt, W / 2, H * 0.3 - e * 20); g.restore(); }
    if (G.spectate) R.caption(g, W, H, 'Menonton pawai', 'Room sedang main. Tunggu ronde berikutnya.', 0.8);
  } else if (G.phase === 'burn') { const e = (performance.now() - G.endAt) / 1000; if (e > 0.8) R.caption(g, W, H, 'Ogoh-ogoh dibakar! 🔥', e > 3.4 ? 'Bhuta kala pergi · besok Nyepi, sunyi 🌙' : 'Sampai di lapangan, sekaa bersorak', Math.min(1, (e - 0.8) * 2)); }
  else if (G.phase === 'fail') R.caption(g, W, H, 'Ogoh-ogoh roboh!', 'Kurang kompak… coba lagi', 1);
}
function curHits(n) { const b0 = n * O.BAR, out = []; for (let k = 0; k < 4; k++) { const bt = b0 + k * O.BEAT; let best = null; for (const x of G.taps) { const d = Math.abs(x.t - bt); if (d <= O.WIN.ok && (best == null || d < best)) best = d; } out.push(best == null ? (relNow() > bt + O.WIN.ok && G.types[n] !== 'h' ? 0 : null) : best <= O.WIN.perfect ? 1 : best <= O.WIN.good ? 0.7 : 0.35); } return out; }
let lastHud = 0;
function hud() { if (!G) return; const rel = relNow(), r = G.simR || { bal: 1, drops: 0 };
  $('prog').style.width = (Math.max(0, Math.min(1, rel / (G.types.length * O.BAR))) * 100).toFixed(1) + '%';
  const b = $('bal'); b.style.width = Math.round(r.bal * 100) + '%'; b.className = r.bal < 0.3 ? 'low' : r.bal < 0.6 ? 'mid' : '';
  $('lives').innerHTML = G.noDrop ? '∞' : '❤'.repeat(Math.max(0, 3 - r.drops)) + '<s>' + '❤'.repeat(Math.min(3, r.drops)) + '</s>';
  const cw = crewView(); $('crew').innerHTML = cw.filter(c => !c.bot || G.mode !== 'online').slice(0, 8).map(c => '<span class="' + (c.me ? 'me ' : '') + (c.acc == null ? '' : c.acc >= 0.8 ? 'g' : c.acc >= 0.5 ? 'm' : 'x') + '">' + J.esc(c.n) + '</span>').join('');
  if (G.mode === 'tut') coach(rel);
}
function coach(rel) { const n = Math.floor(rel / O.BAR), ty = G.types[n], nx = G.types[n + 1]; let m = '';
  if (rel < 0) m = 'Dengar hitungan: 3, 2, 1… lalu ketuk tiap ketukan 🥁'; else if (ty === 'L' || ty === 'R') m = 'PUTAR! Ketuk sisi ' + (ty === 'L' ? 'KIRI' : 'KANAN') + ' layar tiap ketukan'; else if (ty === 'h') m = 'HENING: tahan, jangan ketuk sama sekali'; else if (nx === 'L' || nx === 'R') m = 'Perempatan di depan! Birama berikut ketuk sisi ' + (nx === 'L' ? 'kiri ⟲' : 'kanan ⟳'); else if (nx === 'h') m = 'Birama berikut HENING. Siap-siap diam'; else if (n < 3) m = 'Ketuk saat bulatan di jalur sampai di lingkaran putih (kiri). Hijau = PAS'; else if (ty === 'f') m = 'Birama terakhir! Lalu ogoh-ogoh dibakar 🔥';
  const c = $('coach'); c.hidden = !m; c.textContent = m; }
function skipTo(bar, acc) { if (!G || G.mode === 'online') return; const a = acc == null ? 0.9 : acc; for (let n = G.myAcc.length; n < bar; n++) { G.myAcc[n] = a; G.myHits[n] = [1, 1, 1, 1]; } G.t0 = clock() - bar * O.BAR + 50; schedBeat = -99; }
/* ---------- result ---------- */
function finish() {
  if (!G || G.ended) return; G.ended = true; const r = G.simR, nC = G.types.filter(t => t === 'L' || t === 'R').length, win = r.win;
  G.phase = 'end'; $('result').hidden = false;
  $('resKick').textContent = G.mode === 'tut' ? 'LATIHAN SELESAI' : G.mode === 'online' ? 'PAWAI CO-OP · ' + G.crew.filter(c => !c.bot).length + ' PEMAIN' : 'HASIL PAWAI';
  $('resTitle').textContent = win ? 'Pawai sukses! 🔥' : 'Ogoh-ogoh roboh!';
  $('resStars').innerHTML = win ? '★'.repeat(r.stars) + '<s>' + '★'.repeat(3 - r.stars) + '</s>' : '';
  $('resSub').textContent = win ? (r.stars === 3 ? 'Kompak sekali, banjar bangga!' : r.stars === 2 ? 'Rapi! Sedikit lagi sempurna.' : 'Sampai juga, walau goyang-goyang.') : 'Jatuh 3 kali di birama ' + r.bars + ' dari ' + G.types.length + '.';
  const myAvg = G.myAcc.length ? G.myAcc.reduce((a, b) => a + b, 0) / G.myAcc.length : 0;
  $('resStats').innerHTML = [['Skor tim', r.score], ['Kekompakan tim', Math.round(r.avg * 100) + '%'], ['Ketukanmu', G.spectate ? '-' : Math.round(myAvg * 100) + '%'], ['Putaran berhasil', r.turnsOk + '/' + nC], ['Birama sempurna', r.perfect + '/' + r.bars], ['Jatuh', G.noDrop ? '-' : r.drops + '/3']].map(x => '<div><b>' + J.esc(String(x[1])) + '</b><small>' + x[0] + '</small></div>').join('');
  let note = ''; if (G.mode === 'solo' || G.mode === 'online') { stat.n++; if (win) { stat.w++; stat.stars = Math.max(stat.stars, r.stars); } if (r.score > stat.best) { if (stat.best) note = '🏅 Rekor baru! ' + r.score; stat.best = r.score; } J.setLS(STAT_KEY, JSON.stringify(stat)); paintStat(); }
  $('resNote').textContent = note; const on = G.mode === 'online'; $('againBtn').hidden = on; $('toLobbyBtn').hidden = !(on && shell.canRun()); $('endWait').textContent = on && !shell.canRun() ? 'Menunggu host kembali ke lobby…' : '';
  G.share = 'Ogoh-Ogoh Arak: ' + (win ? 'pawai sukses ' + '★'.repeat(r.stars) : 'ogoh-ogoh roboh 😅') + ' · skor ' + r.score + ' · kompak ' + Math.round(r.avg * 100) + '%';
  if (on && shell.canRun()) endOnline(r);
}
function share() { const txt = (G && G.share) || 'Ogoh-Ogoh Arak'; const url = location.origin + location.pathname; if (navigator.share) navigator.share({ title: 'Ogoh-Ogoh Arak', text: txt, url }).catch(() => {}); else if (navigator.clipboard) navigator.clipboard.writeText(txt + ' ' + url).then(() => toast('Disalin!'), () => {}); }
function bubble(name, x) { const b = $('bubbles'), p = document.createElement('p'); p.textContent = name + ': ' + x; b.appendChild(p); while (b.children.length > 3) b.firstChild.remove(); setTimeout(() => p.remove(), 4200); }
function toMenu() { if (G && G.mode === 'online' && shell.room) shell.leave(true); G = null; $('result').hidden = true; $('coach').hidden = true; J.show('home'); }
/* ---------- online ---------- */
let shell = null;
function onRoom(r) {
  const s = r.s;
  if (s.ph === 'lobby' || !s.m) { if (G && G.mode === 'online') { G = null; $('result').hidden = true; } if ($('lobby').hidden) J.show('lobby'); shell.renderLobby(); paintLobbySeg(r); return; }
  if (!G || G.mode !== 'online' || G.g !== s.g) {
    newRun('online', { seed: s.seed >>> 0, g: s.g, og: s.m.og });
    const ids = s.m.ids, seat = ids.indexOf(r.me); G.seat = seat; G.spectate = seat < 0; G.t0 = s.t0; G.ids = ids;
    G.crew = ids.map((id, i) => ({ id, n: s.m.nm[i], me: id === r.me })).concat(Array.from({ length: s.m.bots || 0 }, (_, i) => ({ id: 'b' + i, n: BOTN[i], bot: true, bi: i })));
    if (relNow() > O.BAR) { G.lateJoin = true; for (let n = 0; n < Math.floor(relNow() / O.BAR) - 1; n++) { G.myAcc[n] = 0; G.myHits[n] = [0, 0, 0, 0]; } }
    startPlay(); toast(G.spectate ? 'Kamu menonton pawai ini' : 'Pawai dimulai! Ikuti ketukan 🥁', 'ok', 2000);
  }
  G.sealed = (s.sb || []).map(x => x == null ? null : x / 100); const cut = G.sealed.indexOf(null); if (cut >= 0) G.sealed.length = cut;
  G.others = s.r || {}; const seated = r.seated().map(p => p.id); G.crew.forEach(c => { if (!c.bot) c.gone = !seated.includes(c.id); });
  if (s.ph === 'end' && G.phase !== 'end' && G.phase !== 'burn' && G.phase !== 'fail') { /* local sim will catch up from sealed bars */ }
}
let writing = false;
function onlineTick(rel) {
  const r = shell.room; if (!r || r.s.g !== G.g || writing) return; const host = shell.canRun(r), me = r.me;
  if (G.spectate && !host) return;
  // my report for each judged bar (staggered by seat)
  if (!host && !G.spectate) { const mine = (r.s.r || {})[me] || []; for (let n = 0; n < G.myAcc.length; n++) { if (mine[n] != null || G.reported[n]) continue; if (rel < (n + 1) * O.BAR + REP_MS + G.seat * 110) break; G.reported[n] = 1; const v = Math.round(G.myAcc[n] * 100); writing = true; shell.edit('rep', s => { if (s.ph !== 'play' || s.g !== G.g) return null; s.r = Object.assign({}, s.r || {}); const a = (s.r[me] || []).slice(); a[n] = v; s.r[me] = a; }).finally(() => { writing = false; }); return; } }
  if (!host) return;
  const sb = r.s.sb || []; let n = sb.length; while (n > 0 && sb[n - 1] == null) n--;
  const upto = []; for (let b = n; b < G.types.length; b++) { if (rel < (b + 1) * O.BAR + SEAL_MS) break; upto.push(b); }
  if (!upto.length) return; writing = true;
  shell.edit('seal', s => { if (s.ph !== 'play' || s.g !== G.g) return null; s.r = Object.assign({}, s.r || {}); s.sb = (s.sb || []).slice();
    if (!G.spectate) { const a = (s.r[me] || []).slice(); for (const b of upto) a[b] = Math.round((G.myAcc[b] || 0) * 100); s.r[me] = a; }
    for (const b of upto) { const hum = []; for (const id of s.m.ids) { const a = (s.r[id] || [])[b]; if (a != null) hum.push(a / 100); } s.sb[b] = Math.round(O.team(hum, G.crew.filter(c => c.bot).map(c => O.botAcc(s.seed >>> 0, b, c.bi, G.botSkill))) * 100); }
    const res = O.sim(s.sb.map(x => x / 100), G.types, {}); if (res.over) { s.ph = 'end'; s.res = { win: res.win, score: res.score, stars: res.stars || 0 }; return { status: 'waiting' }; }
  }).finally(() => { writing = false; });
}
function endOnline() {}
async function startOnline() {
  const r = shell.room; if (!shell.canRun(r)) return; const ps = r.seated().slice(0, MAXP); const set = r.s.set || {};
  const ids = ps.map(p => p.id), nm = ps.map(p => String(p.displayName || 'Pemain').slice(0, 16)); let bots = +set.bot || 0; if (ids.length + bots < 2) bots = 2 - ids.length; bots = Math.min(bots, 8 - ids.length);
  const g = Math.random().toString(36).slice(2, 8);
  await shell.edit('start', s => { if (s.ph !== 'lobby') return null; s.ph = 'play'; s.g = g; s.seed = (Math.random() * 1e9) | 0; s.t0 = Math.round(shell.sNow() + O.LEAD + 600); s.m = { ids, nm, bots, og: +set.og || 0 }; s.r = {}; s.sb = []; s.res = null; return { status: 'playing' }; });
}
async function toLobby() { if (!shell.canRun()) return; await shell.edit('lobby', s => { s.ph = 'lobby'; s.m = null; s.r = {}; s.sb = []; s.res = null; return { status: 'waiting' }; }); }
function paintLobbySeg(r) { const set = r.s.set || {}, og = +set.og || 0, bot = +set.bot || 0;
  $('onOg').innerHTML = O.DESIGNS.map(d => '<button data-v="' + d.id + '" class="' + (d.id === og ? 'on' : '') + '">' + J.esc(d.name.split(' ')[1]) + '</button>').join('');
  $('onBot').innerHTML = [0, 2, 4].map(v => '<button data-v="' + v + '" class="' + (v === bot ? 'on' : '') + '">' + (v ? '+' + v : 'Tanpa') + '</button>').join(''); }
function lobbyDraw(now) { const r = shell && shell.room; if (!r || !r.s || $('lobby').hidden) return; const c = $('lobbyCv'), g = c.getContext('2d'), set = r.s.set || {};
  const crew = r.seated().map(p => ({ n: String(p.displayName || '').slice(0, 12), me: p.id === r.me })); for (let i = 0; i < (+set.bot || 0); i++) crew.push({ n: BOTN[i], bot: true });
  R.scene(g, c.width, c.height, { u: now / 1000 * 0.5, types: HERO_T, design: O.DESIGNS[+set.og || 0], crew, bob: Math.pow(1 - (now / O.BEAT) % 1, 3), wobA: Math.sin(now / 300) * 0.04, ay: 0.62 }, now); }
/* ---------- loop ---------- */
const HERO_T = O.route(7, { bars: 300 }).map(t => t === 'f' ? 'j' : t);
function heroDraw(now) { const c = $('heroCv'); if (!c.clientWidth) return; const { g, W, H } = J.fitCanvas(c); R.scene(g, W, H, { u: now / 1000 * 0.6, types: HERO_T, design: O.DESIGNS[design], crew: BOTN.slice(0, 4).map(n => ({ n: '' })), bob: Math.pow(1 - (now / O.BEAT) % 1, 3), wobA: Math.sin(now / 300) * 0.05, ay: 0.5 }, now); }
function frame(now) {
  try {
    if (!$('home').hidden) heroDraw(now);
    else if (!$('lobby').hidden) lobbyDraw(now);
    if (G && (!$('play').hidden || !$('result').hidden)) { frameRun(now); draw(now); if (now - lastHud > 120) { lastHud = now; hud(); } }
  } catch (e) { console.error(e); }
  requestAnimationFrame(frame);
}
/* ---------- input ---------- */
function onPointer(e) { if (!G || $('play').hidden || e.target.closest('button,.chat-pop,input,form')) return; e.preventDefault(); const ty = G.types[Math.floor((relNow() + O.WIN.ok) / O.BAR)]; const turn = ty === 'L' || ty === 'R'; const rect = cv.getBoundingClientRect(); const x = (e.clientX - rect.left) / rect.width; tap(turn ? (x < 0.5 ? -1 : 1) : 0); }
function onKey(e) { if (!G || $('play').hidden || (e.target.closest && e.target.closest('input'))) return; if (e.code === 'Space' || e.code === 'KeyJ' || e.code === 'Enter') { e.preventDefault(); tap(0); } else if (e.code === 'ArrowLeft' || e.code === 'KeyA') { e.preventDefault(); tap(-1); } else if (e.code === 'ArrowRight' || e.code === 'KeyD') { e.preventDefault(); tap(1); } else if (e.code === 'Escape') toMenu(); }
const CHEERS = ['Ayo kompak! 🥁', 'PUTAR! 🌀', 'Semangat sekaa!', 'Angkat! 💪', 'Ssst… hening 🤫', 'Mantap! 🔥'];
function cheer(x) { if (G && G.mode === 'online' && shell.room) shell.sendChat(x); else bubble(myName() || 'Kamu', x); }
function boot() {
  $('nameInput').value = J.getLS(NAME_KEY) || ''; $('nameInput').addEventListener('change', () => J.setLS(NAME_KEY, myName()));
  if (window.JDNG) window.JDNG.on(n => { if (n && !$('nameInput').value) { $('nameInput').value = n; J.setLS(NAME_KEY, myName()); } });
  paintOg(); paintStat();
  $('ogPick').addEventListener('click', e => { const b = e.target.closest('.og'); if (!b) return; design = +b.dataset.v; J.setLS(OG_KEY, String(design)); paintOg(); S.tap(); });
  $('soloBtn').addEventListener('click', () => startSolo('solo')); $('tutBtn').addEventListener('click', () => startSolo('tut'));
  $('exitBtn').addEventListener('click', toMenu); $('resMenu').addEventListener('click', toMenu); $('shareBtn').addEventListener('click', share);
  $('againBtn').addEventListener('click', () => startSolo(G && G.mode === 'tut' ? 'tut' : G && G.mode === 'demo' ? 'demo' : 'solo'));
  $('toLobbyBtn').addEventListener('click', toLobby); $('startBtn').addEventListener('click', startOnline);
  $('onBot').addEventListener('click', e => { const b = e.target.closest('button'); if (b) shell.setRoom('bot', +b.dataset.v); });
  $('onOg').addEventListener('click', e => { const b = e.target.closest('button'); if (b) shell.setRoom('og', +b.dataset.v); });
  cv.addEventListener('pointerdown', onPointer); $('play').addEventListener('pointerdown', e => { if (e.target !== cv) onPointer(e); }); document.addEventListener('keydown', onKey);
  $('cheer').innerHTML = CHEERS.map(c => '<button type="button">' + J.esc(c) + '</button>').join(''); $('cheer').addEventListener('click', e => { const b = e.target.closest('button'); if (b) cheer(b.textContent); });
  $('chatBtn').addEventListener('click', () => { const slot = $('chatSlot'), chat = $('chat'); if (slot.hidden) { slot.appendChild(chat); slot.hidden = false; } else { $('chatCard').appendChild(chat); slot.hidden = true; } });
  J.initMute('ogohogoharak.mute', ['muteBtn', 'muteBtn2']);
  shell = window.MPShell({ slug: 'ogohogoharak', title: 'Ogoh-Ogoh Arak', max: MAXP, defSet: { bot: 0, og: design }, myName, saveName: n => J.setLS(NAME_KEY, n), toast, sfx: { chat: S.chat, cheer: () => {} }, accent: '#e8452c', inviteText: 'Ayo usung ogoh-ogoh bareng di Ogoh-Ogoh Arak!',
    quick: ['Siap ngarak! 🥁', 'Ayo mulai!', 'Tunggu sebentar', 'Kompak ya! 💪', 'GG 🔥'],
    onRoom, onLeave: () => { if (G && G.mode === 'online') G = null; $('result').hidden = true; $('chatSlot').hidden = true; $('chatCard').appendChild($('chat')); J.show('home'); },
    onChat: m => { if (!$('play').hidden) bubble(m.n, m.x); }, localChat: x => bubble(myName() || 'Kamu', x),
    color: p => ['#e8452c', '#ffc93c', '#35d07f', '#3a9ad8', '#b05ad8', '#ff8fb1'][Math.abs(String(p.id).split('').reduce((a, c) => a + c.charCodeAt(0), 0)) % 6],
    hostHint: (r, ps) => ps.length >= 2 ? ps.length + ' penggotong siap. Tambah bot kalau mau tandu lebih ramai.' : 'Bagikan link undangan. Sendirian? Pawai jalan dengan 2 bot.' });
  window.OGApp = { get G() { return G; }, shell, startSolo, tap, toMenu, finish, skipTo };
  shell.boot();
  if (DEMO) startSolo('demo');
  requestAnimationFrame(frame);
}
boot();
})();

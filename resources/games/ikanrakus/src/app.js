/* Ikan Rakus app: screens, input, loop, audio, save, leaderboard. */
(function (root) {
'use strict';
const S = root.IRSim, RD = root.IRRender, doc = document, $ = id => doc.getElementById(id);
const SAVE_KEY = 'ikanrakus.save', NAME_KEY = 'ikanrakus.name', MUTE_KEY = 'ikanrakus.mute', HINT_KEY = 'ikanrakus.hint';
const getLS = k => { try { return root.localStorage.getItem(k); } catch (e) { return null; } }, setLS = (k, v) => { try { root.localStorage.setItem(k, v); } catch (e) { /* private */ } };
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmtN = n => Math.round(n).toLocaleString('id-ID');
let save = (() => { try { const s = JSON.parse(getLS(SAVE_KEY) || 'null'); if (s && typeof s.un === 'number') return s; } catch (e) { /* fresh */ } return { un: 1, st: {}, best: {}, eb: 0, hb: 0, runs: 0, how: 0 }; })();
if (typeof save.hb !== 'number') save.hb = 0;
if (!save.dm) save.dm = { d: '', p: [0, 0, 0], ok: [0, 0, 0], streak: 0, last: '', total: 0 };
if (typeof save.coach !== 'number') save.coach = 0;
/* ---------- daily missions (same 3 for everyone each day, seeded by WITA date) ---------- */
const MISSIONS = [
  { id: 'teri', t: n => 'Makan ' + n + ' teri', n: [40, 60, 80], ev: e => e.e === 'eat' && e.sp === 'teri' ? 1 : 0 },
  { id: 'besar', t: n => 'Makan ' + n + ' ikan besar (kakap ke atas)', n: [5, 8, 12], ev: e => e.e === 'eat' && ['kakap', 'kerapu', 'barakuda', 'hiu', 'macan'].includes(e.sp) ? 1 : 0 },
  { id: 'dash', t: n => 'Pakai SRUDUK ' + n + '×', n: [15, 25, 40], ev: e => e.e === 'dash' ? 1 : 0 },
  { id: 'combo', t: n => 'Combo ' + n + ' beruntun', n: [6, 8, 10], max: true, ev: e => e.e === 'eat' ? e.combo : 0 },
  { id: 'mutiara', t: n => 'Ambil ' + n + ' mutiara', n: [2, 3, 4], ev: e => e.e === 'pearl' ? 1 : 0 },
  { id: 'rakus', t: n => 'Masuk mode RAKUS ' + n + '×', n: [3, 5, 7], ev: e => e.e === 'frenzy' ? 1 : 0 },
  { id: 'hiu', t: n => 'Hiu Lapar: skor ' + fmtN(n) + ' dalam 1 run', n: [4000, 6000, 9000], max: true, fin: (w, lv) => lv === 'hiu' ? w.score : 0 },
  { id: 'lepas', t: n => 'Laut Lepas: bertahan ' + n + ' detik', n: [60, 90, 120], max: true, fin: (w, lv) => lv === 'endless' ? Math.round(w.t) : 0 },
  { id: 'raja', t: () => 'Capai ukuran terakhir (mode apa saja)', n: [1, 1, 1], max: true, ev: e => e.e === 'grow' && W && e.stage >= W.maxStage ? 1 : 0 },
  { id: 'lolos', t: n => 'Lolos dari jaring ' + n + '×', n: [1, 2, 3], ev: e => e.e === 'escape' ? 1 : 0 }
];
function todayKey(off) { const d = new Date(Date.now() + 8 * 3600e3 - (off || 0) * 864e5); return d.toISOString().slice(0, 10); }
function dayMissions(key) {
  let h = 2166136261; for (const ch of key) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; }
  const pool = MISSIONS.map((m, i) => i), out = [];
  while (out.length < 3) { h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0; const i = pool.splice(h % pool.length, 1)[0]; const m = MISSIONS[i]; out.push({ m, n: m.n[(h >>> 8) % 3] }); }
  return out;
}
let DM = null;
function dmEnsure() { const k = todayKey(); if (save.dm.d !== k) { save.dm.d = k; save.dm.p = [0, 0, 0]; save.dm.ok = [0, 0, 0]; } DM = dayMissions(k); return DM; }
function dmBump(i, v, isMax) { const dm = save.dm; if (dm.ok[i]) return; const n = DM[i].n; dm.p[i] = isMax ? Math.max(dm.p[i], v) : dm.p[i] + v; if (dm.p[i] >= n) { dm.p[i] = n; dm.ok[i] = 1; dmDone(i); } }
function dmDone(i) {
  const dm = save.dm; SFX.pick(); toast('✅ Misi harian: ' + DM[i].m.t(DM[i].n), 'good', 2600);
  if (dm.ok.every(Boolean)) { const y = todayKey(1); dm.streak = dm.last === y ? dm.streak + 1 : dm.last === dm.d ? dm.streak : 1; dm.last = dm.d; dm.total++; setTimeout(() => { banner('MISI HARIAN BERES! 🔥 ' + dm.streak + ' hari', 1800); SFX.win(); }, 900); }
  persist();
}
function dmEvent(e) { if (!DM || mode !== 'game') return; DM.forEach((x, i) => { if (x.m.ev) { const v = x.m.ev(e); if (v) dmBump(i, v, x.m.max); } }); }
function dmFinish(w, lv) { if (!DM) return; DM.forEach((x, i) => { if (x.m.fin) { const v = x.m.fin(w, lv); if (v) dmBump(i, v, true); } }); persist(); }
function paintDaily() {
  dmEnsure(); const dm = save.dm, streakAlive = dm.last === dm.d || dm.last === todayKey(1);
  $('dailyList').innerHTML = DM.map((x, i) => '<li class="' + (dm.ok[i] ? 'ok' : '') + '"><span>' + (dm.ok[i] ? '✅ ' : '') + esc(x.m.t(x.n)) + '</span><i style="width:' + Math.round(dm.p[i] / x.n * 100) + '%"></i><b>' + fmtN(Math.min(dm.p[i], x.n)) + '/' + fmtN(x.n) + '</b></li>').join('');
  $('dailyStreak').textContent = streakAlive && dm.streak ? '🔥 ' + dm.streak + ' hari' : 'Baru tiap hari';
}

const persist0 = () => setLS(SAVE_KEY, JSON.stringify(save));
function persist() { persist0(); }
let hint = getLS(HINT_KEY) !== '0';

/* ---------- audio ---------- */
let AC = null, muted = getLS(MUTE_KEY) === '1';
function ac() { if (!AC) { try { AC = new (root.AudioContext || root.webkitAudioContext)(); } catch (e) { AC = null; } } if (AC && AC.state === 'suspended') AC.resume(); return AC; }
function tone(f, d, type, vol, f2) { if (muted || !AC) return; const t = AC.currentTime, o = AC.createOscillator(), g = AC.createGain(); o.type = type || 'sine'; o.frequency.setValueAtTime(f, t); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + d); g.gain.setValueAtTime(vol || 0.08, t); g.gain.exponentialRampToValueAtTime(0.0001, t + d); o.connect(g); g.connect(AC.destination); o.start(t); o.stop(t + d + 0.02); }
function noise(d, vol, freq) { if (muted || !AC) return; const t = AC.currentTime, n = Math.floor(AC.sampleRate * d), b = AC.createBuffer(1, n, AC.sampleRate), a = b.getChannelData(0); for (let i = 0; i < n; i++) a[i] = (Math.random() * 2 - 1) * (1 - i / n); const s = AC.createBufferSource(), f = AC.createBiquadFilter(), g = AC.createGain(); s.buffer = b; f.type = 'lowpass'; f.frequency.value = freq || 900; g.gain.value = vol || 0.2; s.connect(f); f.connect(g); g.connect(AC.destination); s.start(t); }
const SFX = {
  eat: r => tone(700 - Math.min(400, r * 8), 0.12, 'sine', 0.12, 160),
  combo: n => tone(500 + n * 70, 0.09, 'triangle', 0.07),
  grow: () => [392, 523, 659, 784].forEach((f, i) => setTimeout(() => tone(f, 0.16, 'triangle', 0.09), i * 80)),
  splash: () => { noise(0.35, 0.28, 900); setTimeout(() => tone(320, 0.18, 'sine', 0.05, 140), 40); },
  whoosh: () => tone(900, 0.32, 'sine', 0.04, 300),
  hurt: () => { tone(220, 0.35, 'sawtooth', 0.08, 70); noise(0.25, 0.2, 600); },
  warn: () => tone(180, 0.18, 'square', 0.04, 140),
  sting: () => { tone(1400, 0.06, 'square', 0.05); setTimeout(() => tone(1100, 0.06, 'square', 0.05), 60); },
  boom: () => { noise(1.1, 0.5, 300); tone(90, 0.6, 'sine', 0.18, 40); },
  pick: () => { tone(988, 0.08, 'triangle', 0.08); setTimeout(() => tone(1319, 0.14, 'triangle', 0.08), 70); },
  frenzy: () => [523, 659, 784, 1046, 1319].forEach((f, i) => setTimeout(() => tone(f, 0.12, 'square', 0.05), i * 55)),
  win: () => { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => tone(f, 0.2, 'triangle', 0.1), i * 120)); },
  lose: () => tone(330, 0.5, 'triangle', 0.09, 120),
  click: () => tone(660, 0.04, 'triangle', 0.05),
  dash: () => { noise(0.18, 0.12, 1800); tone(240, 0.16, 'sine', 0.07, 520); },
  growl: () => tone(120, 0.4, 'sawtooth', 0.05, 80),
  tap: () => tone(500 + Math.random() * 300, 0.04, 'square', 0.04)
};
function paintMute() { $('muteBtn').textContent = muted ? '🔇' : '🔊'; $('muteBtn').setAttribute('aria-label', muted ? 'Suara mati' : 'Suara nyala'); }

/* ---------- canvas / camera ---------- */
const cv = $('cv'), g = cv.getContext('2d'); let VW = 0, VH = 0, DPR = 1;
function resize() { DPR = Math.min(2, root.devicePixelRatio || 1); VW = root.innerWidth; VH = root.innerHeight; cv.width = Math.round(VW * DPR); cv.height = Math.round(VH * DPR); g.setTransform(DPR, 0, 0, DPR, 0, 0); }
root.addEventListener('resize', resize); resize();
const cam = { x: S.WW / 2, y: S.WH / 2, s: 1, shake: 0 };
function camTarget(w, snap) {
  const st = w.p.stage, A = 760 * 470 * (1 + st * 0.16);
  let s = Math.sqrt(VW * VH / A); s = Math.max(s, VW / S.WW, VH / (S.WH + 80)); s = Math.min(s, 2.2);
  cam.s = snap ? s : cam.s + (s - cam.s) * 0.04;
  const hw = VW / 2 / cam.s, hh = VH / 2 / cam.s, tx = Math.max(hw, Math.min(S.WW - hw, w.p.x)), ty = Math.max(-80 + hh, Math.min(S.WH - hh, w.p.drop > 0 ? Math.min(w.p.y, S.SURF + hh * 0.45) : w.p.y));
  if (snap) { cam.x = tx; cam.y = ty; } else { cam.x += (tx - cam.x) * 0.12; cam.y += (ty - cam.y) * 0.12; }
}

/* ---------- state ---------- */
let W = null, deco = null, mode = 'demo', running = false, paused = true, endTimer = 0, last = 0, T = 0;
const ui = { pops: [], parts: [], hint, near: false };
const key = { l: 0, r: 0, u: 0, d: 0 };
const joy = { id: null, ax: 0, ay: 0, cx: 0, cy: 0, on: false }, mouse = { on: false, x: 0, y: 0 };
let lastInputKind = 'touch';
function demoWorld() { W = S.create(0, { seed: 99 }); W.p.inv = 1e9; W.p.dead = 1; W.L = Object.assign({}, W.L, { haz: [] }); deco = RD.decor(7, S.SEAS[0]); mode = 'demo'; paused = false; camTarget(W, true); }

/* ---------- screens ---------- */
function show(id) { for (const s of ['home', 'map', 'play']) $(s).hidden = s !== id; doc.body.classList.toggle('home-mode', id !== 'play'); doc.documentElement.classList.toggle('jr-hub-off', id === 'play'); }
function overlay(id, on) { $(id).hidden = !on; }
function toast(msg, kind, ms) { const t = doc.createElement('div'); t.className = 'toast ' + (kind || ''); t.textContent = msg; $('toasts').appendChild(t); while ($('toasts').children.length > 3) $('toasts').firstChild.remove(); setTimeout(() => t.remove(), ms || 2600); }
let bannerT = 0; function banner(txt, ms) { const b = $('banner'); b.textContent = txt; b.hidden = false; b.style.animation = 'none'; void b.offsetWidth; b.style.animation = ''; clearTimeout(bannerT); bannerT = setTimeout(() => { b.hidden = true; }, ms || 1300); }
const ICONS = {}; function ic(k) { return ICONS[k] || (ICONS[k] = RD.icon(k, 64)); }
const HAZ_INFO = {
  ubur: ['⚡ Ubur-ubur', 'Menyetrum dan bikin kamu lambat sebentar. Tidak bisa dimakan.'],
  jaring: ['🕸️ Jaring nelayan', 'Kapal datang, area kuning = jaring turun. Kalau terjaring, tap/klik cepat 7× untuk lolos.'],
  plastik: ['🛍️ Kantong kresek', 'Mirip ubur-ubur, tapi itu sampah. Kalau termakan, pertumbuhan berkurang dan kamu lambat.'],
  bom: ['💣 Bom ikan', 'Botol bom tenggelam lalu meledak. Keluar dari lingkaran merah sebelum hitungan habis!']
};
function homeStats() {
  const stars = Object.values(save.st).reduce((a, b) => a + b, 0);
  $('statLine').textContent = save.runs ? '⭐ ' + stars + '/27 · Level ' + Math.min(save.un, 9) + '/9 · Laut Lepas ' + fmtN(save.eb) + (save.hb ? ' · Hiu ' + fmtN(save.hb) : '') : '9 level · Kepulauan Seribu, Bunaken, Raja Ampat';
  paintDaily();
  $('playLbl').textContent = save.runs ? 'Lanjut: Level ' + Math.min(save.un, 9) : 'Main';
}
function goHome() { doc.body.classList.remove('shark'); coach.on = false; running = false; overlay('result', false); overlay('pause', false); overlay('intro', false); show('home'); homeStats(); if (mode !== 'demo') demoWorld(); if (location.hash && root.history.replaceState) root.history.replaceState(null, '', location.pathname + location.search); }
function paintMap() {
  let html = '', prevSea = -1;
  S.LEVELS.forEach((L, i) => {
    if (L.sea !== prevSea) { if (prevSea >= 0) html += '</div>'; html += '<div class="sea">' + esc(S.SEAS[L.sea].n) + '</div><div class="lvgrid">'; prevSea = L.sea; }
    const lock = i + 1 > save.un, st = save.st[i] || 0;
    html += '<button type="button" class="lv' + (lock ? ' locked' : '') + '" data-lv="' + i + '"' + (lock ? ' aria-disabled="true"' : '') + ' aria-label="Level ' + (i + 1) + ' ' + esc(L.n) + (lock ? ' terkunci' : ', ' + st + ' bintang') + '"><b>' + (lock ? '🔒' : i + 1) + '</b><span>' + esc(L.n) + '</span><em>' + (lock ? '' : '★'.repeat(st) + '☆'.repeat(3 - st)) + '</em></button>';
  });
  $('mapList').innerHTML = html + '</div>';
}

/* ---------- game flow ---------- */
let curLv = 0;
function start(lv) {
  ac(); overlay('result', false); overlay('pause', false); curLv = lv; W = S.create(lv); const endl = lv === 'endless' || lv === 'hiu'; deco = RD.decor(lv === 'endless' ? 31 : lv === 'hiu' ? 53 : 11 + lv * 7, S.SEAS[W.L.sea]); mode = 'game'; running = true; paused = true; endTimer = 0;
  ui.pops.length = 0; ui.parts.length = 0; $('toasts').innerHTML = ''; $('banner').hidden = true; $('combo').hidden = true;
  camTarget(W, true); show('play'); paintChain(true); hud(true);
  const L = W.L; doc.body.classList.toggle('shark', lv === 'hiu'); $('hungerBox').hidden = lv !== 'hiu'; paintDash(true);
  $('introSea').textContent = lv === 'hiu' ? 'Mode hiu · tanpa akhir' : lv === 'endless' ? 'Mode tanpa akhir' : S.SEAS[L.sea].n + ' · Level ' + (lv + 1) + '/9';
  $('introName').textContent = L.n;
  const ed = S.ORDER.filter(k => S.SP[k].r < S.PR[0] * 0.95);
  $('introGoal').innerHTML = (lv === 'hiu' ? 'Kamu anak hiu yang <b>selalu lapar</b>. Bar merah turun terus: makan terus atau kelaparan! Sruduk untuk menyergap.' : lv === 'endless' ? 'Bertahan selama mungkin. Bahaya makin sering, skor masuk papan rekor.' : 'Tumbuh ' + L.goal.length + '× sampai bar penuh.') + '<br>Mulai bisa makan: ' + ed.map(k => '<img alt="' + esc(S.SP[k].n) + '" title="' + esc(S.SP[k].n) + '" src="' + ic(k) + '">').join('');
  const prev = new Set(); if (!endl) for (let i = 0; i < lv; i++) S.LEVELS[i].haz.forEach(h => prev.add(h));
  const nh = L.haz.filter(h => !prev.has(h)), list = endl ? [] : nh;
  $('introHaz').hidden = !list.length; $('introHaz').innerHTML = list.map(h => '<b>Baru: ' + esc(HAZ_INFO[h][0]) + '</b>' + esc(HAZ_INFO[h][1])).join('<br>');
  for (const h of L.haz) W.tips[h] = 1;
  dmEnsure(); coach.on = lv === 0 && save.coach < 1; coach.eats = 0; coach.warned = false;
  $('introCtl').textContent = lastInputKind === 'mouse' ? 'Gerakkan mouse (atau panah/WASD). Klik / Spasi = SRUDUK. Esc = jeda.' : 'Seret jari untuk berenang. Tombol ⚡ atau tap jari kedua = SRUDUK (ngebut).';
  overlay('intro', true); setTimeout(() => $('introGo').focus(), 50);
}
function go() { overlay('intro', false); paused = false; last = performance.now(); }
function pause(on) { if (mode !== 'game' || W.done) return; paused = on; overlay('pause', on); $('hintChk').checked = hint; if (on) { joy.on = false; $('joy').hidden = true; } else last = performance.now(); }
function finish() {
  running = false; const win = W.done === 'win', lv = curLv, st = S.stars(W);
  save.runs++; dmFinish(W, lv);
  if (lv === 'hiu') { const nb = W.score > save.hb; if (nb) save.hb = W.score; persist(); $('resKick').textContent = 'Hiu Lapar'; $('resTitle').textContent = nb ? 'Rekor hiu baru! 🦈' : 'Hiu tumbang…'; $('resStars').innerHTML = ''; }
  else if (lv === 'endless') { const nb = W.score > save.eb; if (nb) save.eb = W.score; persist(); $('resKick').textContent = 'Laut Lepas'; $('resTitle').textContent = nb ? 'Rekor baru!' : 'Dimakan juga…'; $('resStars').innerHTML = ''; }
  else {
    if (win) { save.st[lv] = Math.max(save.st[lv] || 0, st); save.best[lv] = Math.max(save.best[lv] || 0, W.score); if (save.un < lv + 2) save.un = Math.min(9, lv + 2); }
    persist(); $('resKick').textContent = 'Level ' + (lv + 1) + ' · ' + W.L.n;
    $('resTitle').textContent = win ? (lv === 8 ? 'Raja Laut Raja Ampat! 👑' : 'Kenyang! Level selesai') : 'Yah, dimakan…';
    $('resStars').innerHTML = win ? [0, 1, 2].map(i => '<span class="' + (i < st ? '' : 'off') + '">★</span>').join('') : '';
  }
  const secs = Math.round(W.t), eatenN = Object.values(W.eaten).reduce((a, b) => a + b, 0);
  $('resGrid').innerHTML = '<div><b>' + fmtN(W.score) + '</b><span>Skor' + (lv === 'hiu' ? ' · rekor ' + fmtN(save.hb) : lv !== 'endless' && save.best[lv] ? ' · terbaik ' + fmtN(save.best[lv]) : lv === 'endless' ? ' · rekor ' + fmtN(save.eb) : '') + '</span></div><div><b>' + secs + ' dtk</b><span>' + (lv === 'endless' || lv === 'hiu' ? 'Bertahan' : 'Waktu · 3★ ≤ ' + W.L.par + ' dtk tanpa mati') + '</span></div>';
  $('resEaten').innerHTML = eatenN ? S.ORDER.filter(k => W.eaten[k]).map(k => '<span><img alt="" src="' + ic(k) + '">' + esc(S.SP[k].n) + ' ×' + W.eaten[k] + '</span>').join('') : '<span>Belum makan apa-apa</span>';
  $('lbForm').hidden = lv !== 'endless' || W.score <= 0; $('lbSubmit').disabled = false;
  if (lv === 'hiu') { $('resNext').textContent = '🦈 Main lagi'; $('resNext').dataset.act = 'retry'; }
  else if (lv === 'endless') { $('resNext').textContent = '🌊 Main lagi'; $('resNext').dataset.act = 'retry'; }
  else if (win && lv < 8) { $('resNext').textContent = 'Level ' + (lv + 2) + ' →'; $('resNext').dataset.act = 'next'; }
  else if (win) { $('resNext').textContent = '🌊 Coba Laut Lepas'; $('resNext').dataset.act = 'endless'; }
  else { $('resNext').textContent = '↻ Coba lagi'; $('resNext').dataset.act = 'retry'; }
  $('resRetry').hidden = $('resNext').dataset.act === 'retry';
  (win ? SFX.win : SFX.lose)(); overlay('result', true); setTimeout(() => $('resNext').focus(), 60);
}

/* ---------- HUD ---------- */
let hudCache = {};
function paintChain(force) {
  if (!W || mode !== 'game') return; const st = W.p.stage; if (!force && hudCache.chain === st) return; hudCache.chain = st;
  const ks = S.ORDER.filter(k => W.L.mix[k]), nextR = S.PR[Math.min(W.maxStage, st + 1)];
  $('chain').innerHTML = ks.map(k => { const r = S.SP[k].r, ok = r < S.PR[st] * 0.95, nx = !ok && st < W.maxStage && r < nextR * 0.95; return '<span class="' + (ok ? 'ok' : 'no') + (nx ? ' next' : '') + '" title="' + esc(S.SP[k].n) + (ok ? ': bisa dimakan' : nx ? ': bisa dimakan setelah tumbuh' : ': bahaya') + '"><img alt="' + esc(S.SP[k].n) + '" src="' + ic(k) + '"></span>'; }).join('');
  const gl = W.L.goal; $('grow').querySelectorAll('b').forEach(b => b.remove());
}
function hud(force) {
  if (!W || mode !== 'game') return; const pg = S.progress(W);
  const lives = W.lives, sc = W.score, f = W.L.endless && W.p.stage >= W.maxStage ? 1 : pg.f;
  if (force || hudCache.lives !== lives) { hudCache.lives = lives; $('lives').textContent = '❤️'.repeat(Math.max(0, lives)) + '🖤'.repeat(Math.max(0, 3 - lives)); }
  if (force || hudCache.sc !== sc) { hudCache.sc = sc; $('score').textContent = fmtN(sc); }
  const fp = Math.round(f * 100); if (force || hudCache.f !== fp) { hudCache.f = fp; $('growFill').style.width = fp + '%'; }
  const lbl = W.L.endless ? (W.p.stage >= W.maxStage ? 'RAJA LAUT · bertahan!' : 'Ukuran ' + (W.p.stage + 1) + '/' + (W.maxStage + 1)) : (W.p.stage < W.maxStage ? 'Ukuran ' + (W.p.stage + 1) + '/' + (W.maxStage + 1) : 'Terakhir! Penuhi bar');
  if (force || hudCache.lbl !== lbl) { hudCache.lbl = lbl; $('growTxt').textContent = lbl; }
  const rk = W.frenzy > 0 ? Math.round(W.frenzy / 6 * 100) : Math.round(W.rakus * 100); if (force || hudCache.rk !== rk) { hudCache.rk = rk; $('rakusFill').style.width = rk + '%'; $('rakusFill').parentNode.classList.toggle('on', W.frenzy > 0); }
  if (W.L.shark) { const hg = Math.round(W.hunger * 100); if (force || hudCache.hg !== hg) { hudCache.hg = hg; $('hungerFill').style.width = hg + '%'; $('hungerBox').classList.toggle('low', hg < 25); } }
  paintDash(force);
  paintChain(force);
}
function paintDash(force) { if (!W) return; const cd = W.L.shark ? S.DASH.cdShark : S.DASH.cd, f = W.p.dashCd > 0 ? 1 - W.p.dashCd / cd : 1, q = Math.round(f * 20); if (!force && hudCache.dq === q) return; hudCache.dq = q; const b = $('dashBtn'); b.style.setProperty('--f', (q * 5) + '%'); b.classList.toggle('ready', q >= 20); }
let comboT = 0; function comboShow(n) { const c = $('combo'); c.textContent = 'COMBO ×' + (n >= 6 ? 3 : 2) + ' · ' + n; c.hidden = false; c.style.animation = 'none'; void c.offsetWidth; c.style.animation = ''; clearTimeout(comboT); comboT = setTimeout(() => { c.hidden = true; }, 900); }

/* ---------- events from sim ---------- */
/* ---------- first-run coach (level 1) ---------- */
const coach = { on: false, eats: 0, warned: false };
function coachEvent(e) {
  if (!coach.on) return;
  if (e.e === 'eat') { coach.eats++; if (coach.eats === 1) toast('Nyam! Makan terus yang bercincin hijau 🟢', 'good', 1800); if (coach.eats === 3) toast('Bar hijau di atas = pertumbuhan. Penuh = tumbuh besar!', 'edu', 3000); if (coach.eats >= 5) { coach.on = false; save.coach = 1; persist(); } }
  if (e.e === 'hunt' && !coach.warned) { coach.warned = true; toast('Ikan bertanda ! mengejarmu. Kabur, atau tekan SRUDUK ⚡', 'warn', 3000); }
}
let lastWarn = 0, lastSting = 0;
const WHY = { jaring: 'Terangkat jaring nelayan!', bom: 'Kena bom ikan!', lapar: 'Kelaparan! Makan terus!' };
function events() {
  for (const e of W.ev) {
    if (mode === 'demo') continue;
    dmEvent(e); coachEvent(e);
    switch (e.e) {
      case 'eat': { const r = S.SP[e.sp].r; SFX.eat(r); ui.pops.push({ x: e.x, y: e.y, txt: '+' + e.gain, t: 0, life: 0.8, col: e.gain >= 100 ? '#ffcf3a' : '#fff', size: 14 + Math.min(10, e.gain / 15) }); for (let i = 0; i < 5; i++) ui.parts.push({ x: e.x + (Math.random() - 0.5) * r, y: e.y + (Math.random() - 0.5) * r, r: 2 + Math.random() * 4, t: 0, life: 0.7, vy: -40 - Math.random() * 40 }); if (e.combo >= 3) { comboShow(e.combo); SFX.combo(e.combo); } break; }
      case 'grow': SFX.grow(); banner(W.p.stage >= W.maxStage ? (W.L.endless ? 'RAJA LAUT! 👑' : 'UKURAN TERAKHIR! 🐟') : 'TUMBUH BESAR! 🐟', 1400); paintChain(true); toast('Sekarang bisa makan: ' + S.ORDER.filter(k => W.L.mix[k] && S.SP[k].r < S.PR[W.p.stage] * 0.95 && !(S.SP[k].r < S.PR[W.p.stage - 1] * 0.95)).map(k => S.SP[k].n).join(', '), 'good'); break;
      case 'dash': SFX.dash(); for (let i = 0; i < 6; i++) ui.parts.push({ x: W.p.x - W.p.dir * S.pr(W) * (0.8 + Math.random()), y: W.p.y + (Math.random() - 0.5) * S.pr(W), r: 2 + Math.random() * 4, t: 0, life: 0.5, vy: -20 }); break;
      case 'hungry': SFX.growl(); toast('Perut keroncongan! Bar merah hampir habis 🍖', 'warn', 1800); break;
      case 'school': if (!W._schoolTold) { W._schoolTold = 1; toast('Kawanan teri lewat! Sergap! 🐟', 'good', 1600); } break;
      case 'starve': cam.shake = 0.3; break;
      case 'frenzy': SFX.frenzy(); banner('MODE RAKUS! ⚡ skor ×2', 1300); break;
      case 'hunt': if (T - lastWarn > 1.5) { lastWarn = T; SFX.warn(); } break;
      case 'bite': cam.shake = 0.4; break;
      case 'plunge': SFX.whoosh(); break;
      case 'splash': SFX.splash(); cam.shake = Math.max(cam.shake, 0.25); for (let i = 0; i < 16; i++) ui.parts.push({ x: e.x + (Math.random() - 0.5) * 90, y: S.SURF + 20 + Math.random() * 90, r: 2 + Math.random() * 5, t: 0, life: 0.6 + Math.random() * 0.6, vy: -30 - Math.random() * 40 }); break;
      case 'die': SFX.hurt(); cam.shake = 0.5; banner(e.last ? 'GAME OVER 💀' : (e.why === 'lapar' ? 'KELAPARAN! 💀' : e.why === 'jaring' ? 'TERJARING! 💀' : e.why === 'bom' ? 'KENA BOM! 💀' : 'TERMAKAN! 💀'), 1100); if (W.lives > 0) toast((WHY[e.why] || 'Dimakan ' + (S.SP[e.why] ? S.SP[e.why].n : 'ikan besar') + '!') + ' Sisa nyawa ' + W.lives + '.', 'warn'); break;
      case 'sting': SFX.sting(); if (T - lastSting > 4) { lastSting = T; toast('Kesetrum ubur-ubur! ⚡', 'warn', 1600); } break;
      case 'plastic': SFX.hurt(); toast('Itu kresek, bukan makanan! Sampah plastik bikin ikan sakit.', 'edu', 3200); ui.pops.push({ x: e.x, y: e.y, txt: '−3 🐟', t: 0, life: 1, col: '#ff8080', size: 18 }); break;
      case 'boat': deco.boat.push({ x: e.x, t: 0, life: 7 }); break;
      case 'trapped': banner('TERJARING! Tap cepat!', 1200); SFX.warn(); break;
      case 'escape': SFX.pick(); ui.pops.push({ x: W.p.x, y: W.p.y - 30, txt: 'LOLOS! +30', t: 0, life: 1, col: '#9dffb0', size: 18 }); break;
      case 'boom': SFX.boom(); cam.shake = 0.7; if (!W._boomTold) { W._boomTold = 1; toast('Bom ikan menghancurkan karang dan semua ikan di sekitarnya' + (e.killed ? ' (' + e.killed + ' ekor)' : '') + '. Di dunia nyata itu dilarang!', 'edu', 3600); } break;
      case 'pearl': SFX.pick(); ui.pops.push({ x: e.x, y: e.y - 20, txt: 'Mutiara +' + e.gain, t: 0, life: 1.1, col: '#ffd6ff', size: 18 }); break;
      case 'shield': SFX.pick(); toast('Perisai gelembung: tahan 1 gigitan (10 dtk) 🛡️', 'good', 2000); break;
      case 'shieldpop': SFX.sting(); toast('Perisai pecah! Kabur!', 'warn', 1500); break;
      case 'tip': { const h = HAZ_INFO[e.k]; if (h) toast(h[0] + ': ' + h[1], 'edu', 3600); break; }
      case 'win': endTimer = 1.3; break;
      case 'lose': endTimer = 0.9; break;
    }
  }
  W.ev.length = 0;
}

/* ---------- input ---------- */
function inputVec() {
  let ax = (key.r - key.l), ay = (key.d - key.u);
  if (ax || ay) return { ax, ay };
  if (joy.on) return { ax: joy.ax, ay: joy.ay };
  if (mouse.on && W) { const wx = (mouse.x - VW / 2) / cam.s + cam.x, wy = (mouse.y - VH / 2) / cam.s + cam.y, dx = wx - W.p.x, dy = wy - W.p.y, d = Math.hypot(dx, dy); if (d < 6) return { ax: 0, ay: 0 }; const m = Math.min(1, d / 90); return { ax: dx / d * m, ay: dy / d * m }; }
  return { ax: 0, ay: 0 };
}
let dashReq = false;
function doDash() { if (mode === 'game' && W && !paused && $('intro').hidden) dashReq = true; }
function escapeTap() { if (mode === 'game' && W && W.p.trapped && !paused) { S.tapEscape(W); SFX.tap(); return true; } return false; }
cv.addEventListener('pointerdown', e => {
  lastInputKind = e.pointerType === 'mouse' ? 'mouse' : 'touch'; ac(); if (mode !== 'game' || paused) return;
  const wasTrapped = escapeTap();
  if (e.pointerType === 'mouse') { if (!wasTrapped && e.button === 0) doDash(); mouse.on = true; mouse.x = e.clientX; mouse.y = e.clientY; return; }
  if (joy.id !== null) { if (!wasTrapped) doDash(); return; } joy.id = e.pointerId; joy.on = true; joy.cx = e.clientX; joy.cy = e.clientY; joy.ax = joy.ay = 0; try { cv.setPointerCapture(e.pointerId); } catch (er) { /* ok */ }
  const j = $('joy'); j.hidden = false; j.style.left = joy.cx + 'px'; j.style.top = joy.cy + 'px'; j.firstChild.style.transform = '';
});
cv.addEventListener('pointermove', e => {
  if (e.pointerType === 'mouse') { lastInputKind = 'mouse'; mouse.on = true; mouse.x = e.clientX; mouse.y = e.clientY; return; }
  if (e.pointerId !== joy.id) return; let dx = e.clientX - joy.cx, dy = e.clientY - joy.cy; const d = Math.hypot(dx, dy), R = 48;
  if (d > R * 1.3) { joy.cx += dx / d * (d - R * 1.3); joy.cy += dy / d * (d - R * 1.3); dx = e.clientX - joy.cx; dy = e.clientY - joy.cy; const j = $('joy'); j.style.left = joy.cx + 'px'; j.style.top = joy.cy + 'px'; }
  const dd = Math.hypot(dx, dy), m = Math.min(1, dd / R); joy.ax = dd > 4 ? dx / dd * m : 0; joy.ay = dd > 4 ? dy / dd * m : 0;
  $('joy').firstChild.style.transform = 'translate(' + (joy.ax * R) + 'px,' + (joy.ay * R) + 'px)';
});
const joyEnd = e => { if (e.pointerId !== joy.id) return; joy.id = null; joy.on = false; joy.ax = joy.ay = 0; $('joy').hidden = true; };
cv.addEventListener('pointerup', joyEnd); cv.addEventListener('pointercancel', joyEnd);
cv.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') mouse.on = false; });
const KEYS = { ArrowLeft: 'l', a: 'l', A: 'l', ArrowRight: 'r', d: 'r', D: 'r', ArrowUp: 'u', w: 'u', W: 'u', ArrowDown: 'd', s: 'd', S: 'd' };
doc.addEventListener('keydown', e => {
  if (e.target && /INPUT|TEXTAREA/.test(e.target.tagName)) return;
  if (mode === 'game' && !$('intro').hidden && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); go(); return; }
  if (KEYS[e.key] && mode === 'game') { key[KEYS[e.key]] = 1; lastInputKind = 'mouse'; mouse.on = false; e.preventDefault(); if (W && W.p.trapped && !e.repeat) escapeTap(); return; }
  if ((e.key === ' ' || e.key === 'Shift') && mode === 'game') { e.preventDefault(); if (!escapeTap() && !e.repeat) doDash(); return; }
  if ((e.key === 'Escape' || e.key === 'p' || e.key === 'P') && mode === 'game' && running && $('intro').hidden) pause(!paused);
});
doc.addEventListener('keyup', e => { if (KEYS[e.key]) key[KEYS[e.key]] = 0; });
doc.addEventListener('visibilitychange', () => { if (doc.hidden && mode === 'game' && running && !paused && $('intro').hidden) pause(true); });

/* ---------- loop ---------- */
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000 || 0.016); last = now; T += dt;
  if (W) {
    if (mode === 'demo') { const p = W.p; p.x = S.WW / 2 + Math.sin(T * 0.1) * 500; S.step(W, dt, { ax: 0, ay: 0 }); W.ev.length = 0; }
    else if (!paused) {
      const iv = inputVec(); iv.dash = dashReq; dashReq = false; S.step(W, dt, iv); events(); hud();
      if (endTimer > 0) { endTimer -= dt; if (endTimer <= 0 && running) finish(); }
    }
    for (const b of deco.boat) b.t += paused ? 0 : dt; deco.boat = deco.boat.filter(b => b.t < b.life);
    for (const q of ui.pops) q.t += dt; ui.pops = ui.pops.filter(q => q.t < q.life);
    for (const b of ui.parts) { b.t += dt; b.y += b.vy * dt; } ui.parts = ui.parts.filter(b => b.t < b.life);
    camTarget(W, false);
    let near = false; if (mode === 'game') for (const f of W.fish) if (S.edible(W, f) && Math.hypot(f.x - W.p.x - W.p.dir * S.pr(W), f.y - W.p.y) < S.pr(W) * 3) { near = true; break; }
    ui.near = near; ui.hint = hint && mode === 'game'; ui.noPlayer = mode === 'demo';
    ui.coach = null; if (coach.on && mode === 'game' && !paused) { let bd = 1e12; for (const f of W.fish) if (S.edible(W, f)) { const d = (f.x - W.p.x) ** 2 + (f.y - W.p.y) ** 2; if (d < bd) { bd = d; ui.coach = f; } } }
    const sx = cam.shake > 0 ? (Math.random() - 0.5) * 14 * cam.shake : 0, sy = cam.shake > 0 ? (Math.random() - 0.5) * 14 * cam.shake : 0; cam.shake = Math.max(0, cam.shake - dt);
    g.save(); g.translate(sx, sy); RD.draw(g, W, cam, VW, VH, T, deco, ui); g.restore();
  }
  root.requestAnimationFrame(frame);
}

/* ---------- leaderboard ---------- */
let lbCache;
async function loadLb() {
  $('lbList').innerHTML = '<li class="muted">Memuat…</li>';
  try { const r = await fetch('/api/game/scores?limit=20', { headers: { Accept: 'application/json' } }); if (!r.ok) throw Error(r.status); const d = await r.json(); lbCache = Array.isArray(d.scores) ? d.scores : []; } catch (e) { lbCache = null; }
  const el = $('lbList'); $('lbMine').textContent = save.eb ? 'Rekormu: ' + fmtN(save.eb) : 'Main Laut Lepas untuk masuk papan rekor.';
  if (lbCache === null) { el.innerHTML = '<li class="muted">Papan rekor offline. Coba lagi nanti.</li>'; return; }
  if (!lbCache.length) { el.innerHTML = '<li class="muted">Belum ada rekor. Jadi yang pertama!</li>'; return; }
  const me = myName(); el.innerHTML = lbCache.slice(0, 15).map(s => '<li' + (me && s.name === me ? ' class="me"' : '') + '><span>' + esc(s.name) + '</span><b>' + fmtN(s.score) + '</b></li>').join('');
}
function myName() { return ($('nameIn').value || '').replace(/[^\p{L}\p{N} ._'-]/gu, '').trim().slice(0, 16); }
$('lbForm').addEventListener('submit', async e => {
  e.preventDefault(); const name = myName(); if (!name) { toast('Isi nama dulu ya', 'warn'); $('nameIn').focus(); return; }
  setLS(NAME_KEY, name); $('lbSubmit').disabled = true;
  try { const r = await fetch('/api/game/scores', { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ name, score: Math.round(W.score) }) }); if (!r.ok) throw Error(r.status); $('lbForm').hidden = true; toast('Terkirim ke papan rekor! 🏆', 'good'); }
  catch (er) { $('lbSubmit').disabled = false; toast('Gagal mengirim, coba lagi', 'warn'); }
});

/* ---------- wiring ---------- */
const on = (id, f) => $(id).addEventListener('click', e => { SFX.click(); f(e); });
on('playBtn', () => { ac(); if (!save.how) { save.how = 1; persist(); } start(Math.min(save.un, 9) - 1); });
on('endlessBtn', () => start('endless'));
on('hiuBtn', () => start('hiu'));
$('dashBtn').addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); ac(); if (!escapeTap()) doDash(); });
on('mapBtn', () => { paintMap(); show('map'); });
on('mapBack', () => goHome());
$('mapList').addEventListener('click', e => { const b = e.target.closest('.lv'); if (!b) return; const lv = +b.dataset.lv; if (lv + 1 > save.un) { toast('Selesaikan level sebelumnya dulu', 'warn'); return; } SFX.click(); start(lv); });
on('howBtn', () => overlay('how', true)); on('howClose', () => overlay('how', false));
on('lbBtn', () => { overlay('lb', true); loadLb(); }); on('lbClose', () => overlay('lb', false));
on('muteBtn', () => { muted = !muted; setLS(MUTE_KEY, muted ? '1' : '0'); paintMute(); });
on('introGo', go);
on('pauseBtn', () => pause(true)); on('resumeBtn', () => pause(false)); on('restartBtn', () => { overlay('pause', false); start(curLv); }); on('quitBtn', goHome);
$('hintChk').addEventListener('change', e => { hint = e.target.checked; setLS(HINT_KEY, hint ? '1' : '0'); });
on('resNext', () => { overlay('result', false); const a = $('resNext').dataset.act; if (a === 'next') start(curLv + 1); else if (a === 'endless') start('endless'); else start(curLv); });
on('resRetry', () => { overlay('result', false); start(curLv); }); on('resMenu', goHome);
for (const id of ['how', 'lb']) $(id).addEventListener('click', e => { if (e.target.id === id) overlay(id, false); });
$('nameIn').value = getLS(NAME_KEY) || '';
// logo fish
(function () { const c = $('logoFish').getContext('2d'); let t = 0; (function lf() { t += 0.016; c.clearRect(0, 0, 240, 120); c.save(); c.translate(150 + Math.sin(t * 1.3) * 6, 56 + Math.sin(t * 2) * 4); RD.fish(c, 'player', 34, t, { mouth: 0.5 + 0.5 * Math.sin(t * 4) }); c.restore(); c.save(); c.translate(62 + Math.sin(t * 1.3 + 1) * 8, 64 + Math.sin(t * 2.6) * 5); RD.fish(c, 'teri', 10, t * 1.5, { fast: true }); c.restore(); c.save(); c.translate(36, 46 + Math.sin(t * 2.2) * 4); RD.fish(c, 'teri', 8, t * 1.7, { fast: true }); c.restore(); if (!$('home').hidden) root.requestAnimationFrame(lf); else setTimeout(lf, 500); })(); })();
paintMute(); homeStats(); demoWorld();
const h = (location.hash || '').toLowerCase(), mm = h.match(/^#level-?(\d)$/);
if (h === '#hiu' || h === '#hiu-lapar') start('hiu'); else if (h === '#lepas' || h === '#endless') start('endless'); else if (mm && +mm[1] >= 1 && +mm[1] <= save.un) start(+mm[1] - 1); else show('home');
root.requestAnimationFrame(t => { last = t; frame(t); });
root.IRApp = { dmEnsure, paintDaily, MISSIONS, todayKey, start, go, get world() { return W; }, get mode() { return mode; }, get paused() { return paused; }, finish, save: () => save };
})(window);

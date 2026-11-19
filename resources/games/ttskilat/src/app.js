/* TTS Kilat: screens, input, save, leaderboard */
(function () {
'use strict';
const S = window.TTSSim, R = window.TTSRender, $ = id => document.getElementById(id);
const KEY = 'ttskilat.v1', SITE = 'https://ttskilat.jadidaring.com/';
const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
let save = load();
function load() { try { const s = JSON.parse(localStorage.getItem(KEY) || '{}'); return Object.assign({ v: 1, stars: {}, best: {}, pts: 0, solved: 0, daily: {}, streak: 0, lastDaily: '', name: '', mute: false, cur: null, lastPack: 0, seenHow: false }, s); } catch (e) { return { v: 1, stars: {}, best: {}, pts: 0, solved: 0, daily: {}, streak: 0, lastDaily: '', name: '', mute: false, cur: null, lastPack: 0, seenHow: false }; } }
function persist() { try { localStorage.setItem(KEY, JSON.stringify(save)); } catch (e) {} }
const witaKey = (off = 0) => new Date(Date.now() + 8 * 3600e3 + off * 864e5).toISOString().slice(0, 10);
const niceDate = k => { const [y, m, d] = k.split('-').map(Number); return d + ' ' + BULAN[m - 1] + ' ' + y; };
const fmt = t => Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0');
function toast(msg, cls) { const d = document.createElement('div'); d.className = 'toast ' + (cls || ''); d.textContent = msg; $('toasts').appendChild(d); setTimeout(() => d.remove(), 2200); }
/* ---------- sound ---------- */
let ac = null;
function tone(f, d = 0.06, type = 'triangle', v = 0.05, delay = 0) { if (save.mute) return; try { ac = ac || new (window.AudioContext || window.webkitAudioContext)(); const o = ac.createOscillator(), g = ac.createGain(), t = ac.currentTime + delay; o.type = type; o.frequency.value = f; g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + d); o.connect(g).connect(ac.destination); o.start(t); o.stop(t + d + 0.02); } catch (e) {} }
const sfx = { key: () => tone(660, 0.035, 'square', 0.02), word: () => { tone(660, 0.1); tone(880, 0.12, 'triangle', 0.05, 0.08); }, win: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.18, 'triangle', 0.06, i * 0.1)), hint: () => tone(440, 0.12, 'sine', 0.05), bad: () => tone(180, 0.15, 'sawtooth', 0.03) };
/* ---------- screens ---------- */
function show(id) { for (const s of ['home', 'packs', 'play', 'maker']) $(s).hidden = s !== id; document.documentElement.classList.toggle('jr-hub-off', id === 'play' || id === 'maker'); if (id !== 'play') stopTimer(); window.scrollTo(0, 0); }
function packStars(pi) { return (save.stars[S.PACKS[pi].id] || []).reduce((a, b) => a + (b || 0), 0); }
function unlocked(pi, li) { return li === 0 || (save.stars[S.PACKS[pi].id] || [])[li - 1] > 0; }
function nextLevel(pi) { const a = save.stars[S.PACKS[pi].id] || []; for (let li = 0; li < S.PER_PACK; li++) if (!a[li]) return li; return -1; }
function homeRefresh() {
  const k = witaKey(), d = save.daily[k], st = streakNow();
  $('dailyDate').textContent = niceDate(k);
  $('dailyStreak').textContent = st ? '🔥 ' + st + ' hari' : '';
  $('dailyBtn').classList.toggle('done', !!d); whoPeek();
  $('dailySub').textContent = d ? `Selesai ${'⭐'.repeat(d.s)} · ${fmt(d.t)} · besok ada TTS baru` : (save.cur && save.cur.key === 'd:' + k ? 'Lanjutkan TTS hari ini' : 'Satu TTS baru tiap hari, sama untuk semua pemain');
  const pi = save.lastPack || 0, li = nextLevel(pi);
  $('playLbl').textContent = save.solved ? (li >= 0 ? `Lanjut: ${S.PACKS[pi].n} #${li + 1}` : 'Pilih paket TTS') : 'Main TTS';
  const total = S.PACKS.reduce((a, _, i) => a + packStars(i), 0);
  $('statLine').textContent = save.solved ? `${save.solved} TTS selesai · ⭐ ${total} · ${save.pts.toLocaleString('id-ID')} Poin TTS` : (S.PACKS.length * S.PER_PACK) + ' TTS + 1 TTS Harian baru tiap hari';
  $('muteBtn').textContent = save.mute ? '🔇' : '🔊';
}
function streakNow() { return save.lastDaily === witaKey() || save.lastDaily === witaKey(-1) ? save.streak : 0; }
function packsRefresh() {
  const box = $('packList'); box.innerHTML = '';
  S.PACKS.forEach((P, pi) => {
    const sec = document.createElement('section'); sec.className = 'pack'; const nx = nextLevel(pi);
    sec.innerHTML = `<h3><span aria-hidden="true">${P.icon}</span> ${P.n}<span class="pc">⭐ ${packStars(pi)}/${S.PER_PACK * 3}</span></h3><p>${P.d}</p><div class="lvls"></div>`;
    const g = sec.querySelector('.lvls');
    for (let li = 0; li < S.PER_PACK; li++) {
      const b = document.createElement('button'); b.type = 'button'; const s = (save.stars[P.id] || [])[li] || 0, un = unlocked(pi, li);
      b.className = 'lv' + (un ? '' : ' lock') + (un && li === nx ? ' next' : ''); b.innerHTML = un ? `${li + 1}<small>${s ? '★'.repeat(s) : ''}</small>` : '🔒';
      b.setAttribute('aria-label', `${P.n} TTS ${li + 1}` + (un ? (s ? `, ${s} bintang` : '') : ', terkunci'));
      b.onclick = () => un ? openLevel(pi, li) : toast('Selesaikan TTS sebelumnya dulu 🔒');
      g.appendChild(b);
    }
    box.appendChild(sec);
  });
  $('packsStars').textContent = '⭐ ' + S.PACKS.reduce((a, _, i) => a + packStars(i), 0);
}
/* ---------- play ---------- */
let G = null; // {kind, pi, li, key, pz, st, cur, dir}
function openDaily(k) { k = typeof k === 'string' ? k : witaKey(); begin({ kind: 'd', key: 'd:' + k, date: k, title: k === witaKey() ? 'TTS Harian' : '📅 Arsip Harian', sub: niceDate(k), pz: S.generate(S.dailySpec(k)) }); }
function openLevel(pi, li) { save.lastPack = pi; persist(); begin({ kind: 'p', pi, li, key: 'p:' + S.PACKS[pi].id + ':' + li, title: S.PACKS[pi].icon + ' ' + S.PACKS[pi].n, sub: 'TTS ' + (li + 1) + ' dari ' + S.PER_PACK, pz: S.generate(S.levelSpec(pi, li)) }); }
function begin(g) {
  G = g; G.st = S.start(g.pz);
  const c = save.cur; if (c && c.key === g.key && c.fill && c.fill.length === g.pz.sol.length && (!c.sol || c.sol === g.pz.sol.map(x => x || '.').join(''))) { G.st.fill = c.fill; G.st.rev = c.rev; G.st.hints = c.hints; G.st.checks = c.checks; G.st.t = c.t; S.newlySolved(G.st); }
  G.dir = g.pz.words[0].dir; G.cur = g.pz.words[0].cells[0];
  $('pzTitle').textContent = g.title; $('pzSub').textContent = g.sub;
  show('play'); R.mount(g.pz, { onCell, onClue: wi => { focusWord(wi); draw(); } });
  if (location.hash !== '#main') history.pushState({ p: 1 }, '', '#main');
  jumpUnsolved(-1); draw(); startTimer(); requestAnimationFrame(R.fit);
  coachStep(save.coach ? 9 : 0);
  if (!save.seenHow) { save.seenHow = true; persist(); $('how').hidden = false; }
}
const curWordIdx = () => { const ws = G.pz.words; let i = ws.findIndex(w => w.dir === G.dir && w.cells.includes(G.cur)); if (i < 0) { i = ws.findIndex(w => w.cells.includes(G.cur)); if (i >= 0) G.dir = ws[i].dir; } return i; };
const locked = i => [...G.st.wordsDone].some(k => G.pz.words[k].cells.includes(i));
function draw() { const wi = curWordIdx(); R.update(G.st, G.cur, G.dir, wi); const done = G.st.wordsDone.size; $('prog').textContent = done + '/' + G.pz.words.length + ' kata'; $('timer').textContent = fmt(G.st.t); $('hintLetter').innerHTML = '<span aria-hidden="true">💡</span> Huruf'; }
function focusWord(wi) { const w = G.pz.words[wi]; G.dir = w.dir; G.cur = w.cells.find(c => !G.st.fill[c]) ?? w.cells[0]; }
function jumpUnsolved(from) { const ws = G.pz.words, n = ws.length; for (let k = 1; k <= n; k++) { const wi = (from + k + n) % n; if (!G.st.wordsDone.has(wi) && ws[wi].cells.some(c => G.st.fill[c] !== G.pz.sol[c])) { focusWord(wi); return true; } } return false; }
function onCell(i) { if (G.st.done) return; if (i === G.cur) { const other = G.pz.words.find(w => w.dir !== G.dir && w.cells.includes(i)); if (other) G.dir = other.dir; } else { G.cur = i; if (!G.pz.words.some(w => w.dir === G.dir && w.cells.includes(i))) G.dir = 1 - G.dir; } draw(); }
function step(delta) { const w = G.pz.words[curWordIdx()]; const k = w.cells.indexOf(G.cur); const nk = k + delta; if (nk >= 0 && nk < w.cells.length) G.cur = w.cells[nk]; }
function afterChange() {
  const fresh = S.newlySolved(G.st);
  if (fresh.length) { sfx.word(); fresh.forEach(wi => R.flash(G.pz.words[wi].cells, 'flash')); if (coachAt === 1) coachStep(2); }
  if (S.solved(G.st)) { draw(); return finish(); }
  const wi = curWordIdx(), w = G.pz.words[wi];
  if (fresh.includes(wi)) { jumpUnsolved(wi); }
  else if (w && w.cells.every(c => G.st.fill[c]) && !G.st.wordsDone.has(wi) && G.cur === w.cells[w.cells.length - 1]) { R.flash(w.cells, 'shake'); sfx.bad(); toast('Hmm, ada huruf yang belum pas 🤔'); }
  else if (G.pz.sol.every((c, i) => !c || G.st.fill[i])) toast('Semua terisi tapi ada yang salah. Coba ✔ Cek');
  saveCur(); draw();
}
function typeLetter(ch) {
  if (!G || G.st.done) return; let wi = curWordIdx(); const w = G.pz.words[wi];
  // skip locked cells forward
  let k = w.cells.indexOf(G.cur); while (locked(G.cur) && k < w.cells.length - 1) { k++; G.cur = w.cells[k]; }
  if (locked(G.cur)) { jumpUnsolved(wi); draw(); return typeLetter(ch); }
  S.setLetter(G.st, G.cur, ch); sfx.key();
  // advance to next non-locked cell in word
  while (k < w.cells.length - 1) { k++; if (!locked(w.cells[k]) && !G.st.rev[w.cells[k]]) { G.cur = w.cells[k]; break; } if (k === w.cells.length - 1) break; }
  afterChange();
}
function backspace() {
  if (!G || G.st.done) return;
  if (G.st.fill[G.cur] && !locked(G.cur) && !G.st.rev[G.cur]) { G.st.fill[G.cur] = ''; G.st.bad[G.cur] = 0; }
  else { const w = G.pz.words[curWordIdx()]; let k = w.cells.indexOf(G.cur); while (k > 0) { k--; const c = w.cells[k]; if (!locked(c) && !G.st.rev[c]) { G.cur = c; G.st.fill[c] = ''; G.st.bad[c] = 0; break; } } }
  saveCur(); draw();
}
function moveArrow(dx, dy) { G.dir = dx ? 0 : 1; let x = G.cur % G.pz.w, y = Math.floor(G.cur / G.pz.w); for (;;) { x += dx; y += dy; if (x < 0 || y < 0 || x >= G.pz.w || y >= G.pz.h) break; const i = y * G.pz.w + x; if (G.pz.sol[i]) { G.cur = i; break; } } draw(); }
function nextWord(delta) { const n = G.pz.words.length; let wi = curWordIdx(); for (let k = 0; k < n; k++) { wi = (wi + delta + n) % n; if (!G.st.wordsDone.has(wi)) break; } focusWord(wi); draw(); }
function onKey(k) {
  if (!G || $('play').hidden) return;
  if (k === 'BS') backspace(); else if (k === 'DIR') { onCell(G.cur); } else if (/^[A-Z]$/.test(k)) typeLetter(k);
}
function hintLetter() {
  if (G.st.done) return; let i = G.cur; if (G.st.fill[i] === G.pz.sol[i]) { const w = G.pz.words[curWordIdx()]; i = w.cells.find(c => G.st.fill[c] !== G.pz.sol[c]); if (i == null) { jumpUnsolved(curWordIdx()); i = G.cur; } }
  if (S.revealCell(G.st, i)) { sfx.hint(); R.flash([i], 'flash'); G.cur = i; step(1); afterChange(); }
}
function hintWord() { if (G.st.done) return; const wi = curWordIdx(); if (S.revealWord(G.st, G.pz.words[wi])) { sfx.hint(); afterChange(); } }
function doCheck() { if (G.st.done) return; const n = S.check(G.st); if (n) { sfx.bad(); toast(n + ' huruf salah ditandai merah', 'bad'); } else toast(G.st.fill.some(Boolean) ? 'Sejauh ini benar semua 👍' : 'Isi dulu beberapa huruf', 'good'); draw(); saveCur(); }
let timerId = 0;
function startTimer() { stopTimer(); timerId = setInterval(() => { if (!G || G.st.done || document.hidden || $('play').hidden || !$('how').hidden) return; G.st.t++; $('timer').textContent = fmt(G.st.t); if (G.st.t % 5 === 0) saveCur(); }, 1000); }
function stopTimer() { clearInterval(timerId); }
function saveCur() { if (!G || G.st.done) return; save.cur = { key: G.key, sol: G.pz.sol.map(x => x || '.').join(''), fill: G.st.fill, rev: G.st.rev, hints: G.st.hints, checks: G.st.checks, t: G.st.t }; persist(); }
/* ---------- finish ---------- */
let lastShare = '';
function finish() {
  const st = G.st; st.done = true; stopTimer(); const s = S.stars(st), p = S.points(st); let gain = 0, title = 'TTS selesai!';
  if (save.cur && save.cur.key === G.key) save.cur = null;
  if (G.kind === 'p') {
    const id = S.PACKS[G.pi].id; save.stars[id] = save.stars[id] || []; const first = !save.stars[id][G.li];
    save.stars[id][G.li] = Math.max(save.stars[id][G.li] || 0, s); const prev = save.best[G.key] || 0; gain = Math.max(0, p - prev); save.best[G.key] = Math.max(prev, p); if (first) save.solved++;
  } else if (G.kind === 'c') { title = 'TTS teman selesai!'; save.made = save.made || {}; if (!save.made[G.key]) { save.made[G.key] = 1; save.solved++; }
  } else {
    if (!save.daily[G.date]) { gain = p; save.daily[G.date] = { s, t: st.t, h: st.hints, p }; save.solved++; if (G.date === witaKey()) { save.streak = save.lastDaily === witaKey(-1) ? save.streak + 1 : (save.lastDaily === G.date ? save.streak : 1); save.lastDaily = G.date; } title = 'TTS Harian beres!'; } else title = 'Sudah selesai hari ini';
  }
  save.pts += gain; persist(); sfx.win();
  $('resTitle').textContent = title;
  $('resStars').innerHTML = [1, 2, 3].map(k => `<span class="${k <= s ? '' : 'off'}">⭐</span>`).join('');
  $('resStats').innerHTML = `<div><b>${fmt(st.t)}</b><span>waktu</span></div><div><b>${st.hints}</b><span>bantuan</span></div>${G.kind === 'c' ? `<div><b>${G.pz.words.length}</b><span>kata</span></div>` : `<div><b>+${gain}</b><span>Poin TTS</span></div>`}`;
  const dToday = G.kind === 'd' && G.date === witaKey(); RES_DAILY = dToday;
  $('lbFormTxt').textContent = dToday ? (save.whoSent === G.date ? `Namamu sudah ada di daftar yang selesai hari ini ✅` : `Tulis namamu biar masuk daftar yang sudah menyelesaikan TTS Harian hari ini (Poin TTS ${save.pts.toLocaleString('id-ID')} ikut terkirim ke papan rekor).`) : `Total Poin TTS-mu ${save.pts.toLocaleString('id-ID')}. Kirim ke papan rekor?`;
  $('sendBtn').textContent = dToday ? 'Masuk daftar' : 'Kirim'; $('nameIn').closest('.frow').hidden = dToday && save.whoSent === G.date; $('whoFromRes').hidden = !dToday;
  $('lbForm').hidden = !save.pts && !dToday; $('nameIn').value = (window.JDNG && JDNG.name) || '';
  const isD = G.kind === 'd', isC = G.kind === 'c'; $('shareBtn').hidden = false;
  const nx = isD ? -1 : (G.li + 1 < S.PER_PACK ? G.li + 1 : -1);
  $('nextBtn').textContent = isC ? '✏️ Buat TTS-mu' : isD ? 'Main TTS lain ▶' : nx >= 0 ? `TTS ${nx + 1} ▶` : 'Paket lain ▶';
  $('nextBtn').onclick = () => { $('result').hidden = true; if (isC) return openMaker(); if (!isD && nx >= 0) openLevel(G.pi, nx); else { packsRefresh(); show('packs'); } };
  const rows = G.pz.words.map(w => w.cells.some(c => st.rev[c]) ? '🟨' : '🟩').join('');
  if (isC) lastShare = `Aku menyelesaikan TTS "${G.ctitle}" ${'⭐'.repeat(s)} ⏱ ${fmt(st.t)} 💡${st.hints}\n${rows}\nCoba juga: ${G.link}`;
  else if (!isD) lastShare = `TTS Kilat · ${S.PACKS[G.pi].n} #${G.li + 1}\n${'⭐'.repeat(s)} ⏱ ${fmt(st.t)} 💡${st.hints}\n${rows}\n${SITE}`;
  if (isD) { const rows = G.pz.words.map(w => w.cells.some(c => st.rev[c]) ? '🟨' : '🟩').join(''); lastShare = `TTS Kilat Harian ${niceDate(G.date)}\n${'⭐'.repeat(s)} ⏱ ${fmt(st.t)} 💡${st.hints}${streakNow() > 1 ? ' 🔥' + streakNow() : ''}\n${rows}\n${SITE}`; }
  setTimeout(() => { $('result').hidden = false; }, 650);
}
async function share() { try { if (navigator.share) { await navigator.share({ text: lastShare }); return; } } catch (e) { if (e && e.name === 'AbortError') return; } try { await navigator.clipboard.writeText(lastShare); toast('Hasil disalin, tempel di WhatsApp 📋', 'good'); } catch (e) { prompt('Salin hasilmu:', lastShare); } }
/* ---------- leaderboard ---------- */
async function lbOpen() {
  $('lb').hidden = false; $('lbList').innerHTML = '<li>Memuat…</li>'; $('nameIn2').value = (window.JDNG && JDNG.name) || '';
  $('lbMine').textContent = save.pts ? `Poin TTS-mu: ${save.pts.toLocaleString('id-ID')}` : 'Selesaikan TTS untuk dapat Poin TTS.'; $('lbSendRow').hidden = !save.pts;
  try { const L = bestPerName(await scoresGet(true)).slice(0, 20);
    $('lbList').innerHTML = L.length ? '' : '<li>Belum ada rekor. Jadilah yang pertama!</li>';
    L.forEach((e, i) => { const li = document.createElement('li'); li.innerHTML = '<b></b><span></span><i></i>'; li.children[0].textContent = i + 1; li.children[1].textContent = e.nm; li.children[2].textContent = Number(e.score || 0).toLocaleString('id-ID'); $('lbList').appendChild(li); });
  } catch (e) { $('lbList').innerHTML = '<li>Papan rekor belum bisa dimuat. Coba lagi nanti.</li>'; }
}
// Names: 1-16 chars, letters/digits + space ._'- (server rule). A trailing "." marks a "finished today's TTS Harian" entry
// (one shared /api/game/scores board per subdomain, so the daily list rides on it; see README "Daftar selesai hari ini").
const cleanName = v => String(v || '').replace(/[^\p{L}\p{N} '\-]/gu, '').replace(/\s+/g, ' ').trim().slice(0, 15);
const MARK = '.';
let scCache = null, scAt = 0, RES_DAILY = false;
async function scoresGet(fresh) {
  if (!fresh && scCache && Date.now() - scAt < 30000) return scCache;
  const r = await fetch('/api/game/scores?limit=50', { headers: { Accept: 'application/json' }, cache: 'no-store' }); if (!r.ok) throw Error(r.status);
  const d = await r.json(); scCache = (Array.isArray(d.scores) ? d.scores : []).map(e => { const raw = String(e.name || e.player_name || '?'); return { nm: raw.replace(/\.+$/, '') || '?', daily: raw.endsWith(MARK), score: Number(e.score || 0), at: Date.parse(e.created_at || '') || 0 }; }); scAt = Date.now(); return scCache;
}
function bestPerName(L) { const m = new Map(); L.forEach(e => { const k = e.nm.toLowerCase(), o = m.get(k); if (!o || e.score > o.score) m.set(k, e); }); return [...m.values()].sort((a, b) => b.score - a.score); }
const witaOf = ms => new Date(ms + 8 * 3600e3).toISOString();
function todayDone(L) { const k = witaKey(), m = new Map(); L.filter(e => e.daily && e.at && witaOf(e.at).slice(0, 10) === k).sort((a, b) => a.at - b.at).forEach(e => { const n = e.nm.toLowerCase(); if (!m.has(n)) m.set(n, e); }); return [...m.values()]; }
async function send(inp, after) {
  const name = cleanName(inp.value); if (!name) { toast('Isi nama dulu ya', 'bad'); inp.focus(); return; }
  const daily = inp.id === 'nameIn' && RES_DAILY && save.daily[witaKey()]; if (!save.pts && !daily) return;
  try { const r = await fetch('/api/game/scores', { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ name: daily ? name + MARK : name, score: save.pts }) }); if (!r.ok) throw Error(r.status);
    scCache = null; if (daily) { save.whoSent = witaKey(); save.whoName = name; persist(); toast('Namamu masuk daftar hari ini! ✅', 'good'); } else toast('Terkirim ke papan rekor! 🏆', 'good'); inp.value = ''; after && after(); }
  catch (e) { toast('Gagal mengirim, coba lagi', 'bad'); }
}
/* ---------- daftar yang sudah selesai TTS Harian hari ini (shared) ---------- */
let peekT = 0;
async function whoPeek() {
  const el = $('whoLine'); if (Date.now() - peekT < 20000 && el.dataset.n) return; peekT = Date.now();
  try { const n = todayDone(await scoresGet()).length; el.dataset.n = n; $('whoCnt').textContent = n ? `👥 ${n} orang sudah selesai hari ini` : '👥 Belum ada yang selesai hari ini'; el.hidden = false; }
  catch (e) { el.hidden = !save.daily[witaKey()]; $('whoCnt').textContent = '👥 Daftar yang sudah selesai hari ini'; }
}
async function whoOpen() {
  const k = witaKey(), mine = save.daily[k], ul = $('whoList'); $('whoDate').textContent = niceDate(k) + ' (WITA)';
  $('who').hidden = false; ul.innerHTML = '<li class="none">Memuat…</li>';
  $('whoPlay').hidden = !!mine; $('whoMine').textContent = mine ? (save.whoSent === k ? `Kamu selesai ${'⭐'.repeat(mine.s)} · ${fmt(mine.t)}` : `Kamu sudah selesai ${'⭐'.repeat(mine.s)} tapi belum masuk daftar. Kirim nama dari layar hasil TTS Harian.`) : 'Kamu belum menyelesaikan TTS Harian hari ini.';
  try {
    const L = todayDone(await scoresGet(true)); ul.innerHTML = '';
    if (!L.length) ul.innerHTML = '<li class="none">Belum ada yang masuk daftar. Jadilah yang pertama! 🏁</li>';
    L.forEach((e, i) => { const li = document.createElement('li'); li.innerHTML = '<b></b><span></span><i></i>'; li.children[0].textContent = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1; li.children[1].textContent = e.nm; li.children[2].textContent = witaOf(e.at).slice(11, 16); if (save.whoSent === k && save.whoName && e.nm.toLowerCase() === save.whoName.toLowerCase()) li.className = 'me'; ul.appendChild(li); });
    $('whoLine').dataset.n = L.length; $('whoCnt').textContent = L.length ? `👥 ${L.length} orang sudah selesai hari ini` : '👥 Belum ada yang selesai hari ini';
  } catch (e) { ul.innerHTML = '<li class="none">Daftar belum bisa dimuat (perlu koneksi). Coba lagi nanti.</li>'; }
}
/* ---------- first-play coach ---------- */
let coachAt = 9, coachT = 0;
function coachPos() { const cb = $('clueBar').getBoundingClientRect(); document.documentElement.style.setProperty('--coachB', Math.round(innerHeight - cb.top + 10) + 'px'); }
function coachStep(n) {
  clearTimeout(coachT); coachAt = n; const el = $('coach');
  if (n >= 9 || !G) { el.hidden = true; return; }
  const touch = matchMedia('(pointer:coarse)').matches;
  el.textContent = n === 0 || n === 1 ? (touch ? '👇 Baca pertanyaannya, lalu ketik jawabannya di keyboard' : '👇 Baca pertanyaannya, lalu langsung ketik jawabannya') : '🟩 Benar! Kotak hijau terkunci. Lanjut pertanyaan berikutnya, atau ketuk kotak mana saja';
  coachPos(); el.hidden = false;
  if (n === 0) coachAt = 1;
  if (n === 2) coachT = setTimeout(() => { save.coach = 1; persist(); coachStep(9); }, 4200);
}
/* ---------- kamus (clue / pattern lookup) ---------- */
const BANK = window.TTSBank || [];
function kamusSearch(q) {
  q = q.trim(); const ul = $('kamusList'); ul.innerHTML = ''; if (q.length < 2) { ul.innerHTML = '<li class="none">Ketik minimal 2 huruf</li>'; return; }
  let res;
  if (/^[A-Za-z?_.*]+$/.test(q) && /[?_.*]/.test(q)) { const re = new RegExp('^' + q.toUpperCase().replace(/[?_.*]/g, '.') + '$'); res = BANK.filter(b => re.test(b[0])); }
  else { const words = q.toLowerCase().split(/\s+/).filter(Boolean), up = q.toUpperCase().replace(/[^A-Z]/g, ''); res = BANK.filter(b => words.every(w => b[1].toLowerCase().includes(w)) || (up.length >= 3 && b[0].startsWith(up))); }
  if (!res.length) { ul.innerHTML = '<li class="none">Belum ketemu. Coba kata kunci lain 🙂</li>'; return; }
  res.slice(0, 40).forEach(b => { const li = document.createElement('li'); li.innerHTML = '<b></b><span></span>'; li.firstChild.textContent = b[0] + ' (' + b[0].length + ')'; li.lastChild.textContent = b[1]; ul.appendChild(li); });
  if (res.length > 40) { const li = document.createElement('li'); li.className = 'none'; li.textContent = '+' + (res.length - 40) + ' lagi, perjelas kata kuncinya'; ul.appendChild(li); }
}
function kamusOpen() { $('kamus').hidden = false; $('kamusIn').value = ''; kamusSearch(''); setTimeout(() => $('kamusIn').focus(), 50); }
/* ---------- archive ---------- */
function archOpen() {
  const ul = $('archList'); ul.innerHTML = '';
  for (let off = 0; off >= -6; off--) {
    const k = witaKey(off), d = save.daily[k], li = document.createElement('li'), b = document.createElement('button'); b.type = 'button';
    b.className = d ? 'ok' : ''; b.innerHTML = '<b></b><span></span>'; b.firstChild.textContent = (off === 0 ? 'Hari ini · ' : off === -1 ? 'Kemarin · ' : '') + niceDate(k);
    b.lastChild.textContent = d ? '⭐'.repeat(d.s) + ' ' + fmt(d.t) : (save.cur && save.cur.key === 'd:' + k ? 'lanjutkan' : 'belum');
    b.onclick = () => { $('arch').hidden = true; openDaily(k); }; li.appendChild(b); ul.appendChild(li);
  }
  $('arch').hidden = false;
}
/* ---------- maker (custom TTS + share link) ---------- */
const MK_MAX = 16, MK_MIN = 3;
const EXAMPLE = [['MERDEKA', 'Bebas dari penjajahan'], ['BENDERA', 'Kain berwarna yang dikibarkan saat upacara'], ['GARUDA', 'Lambang negara Indonesia'], ['PANCASILA', 'Dasar negara dengan lima sila'], ['UPACARA', 'Kegiatan tiap Senin pagi di sekolah'], ['MONAS', 'Tugu tinggi ikon Jakarta'], ['RAKYAT', 'Seluruh penduduk suatu negara'], ['PAHLAWAN', 'Orang yang berjasa membela bangsa']];
const cleanAns = v => String(v || '').toUpperCase().replace(/[^A-Z]/g, '');
function b64e(str) { const b = new TextEncoder().encode(str); let bin = ''; b.forEach(x => bin += String.fromCharCode(x)); return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
function b64d(s) { s = s.replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '='; const bin = atob(s), b = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) b[i] = bin.charCodeAt(i); return new TextDecoder().decode(b); }
function mkRow(a = '', c = '') {
  const r = document.createElement('div'); r.className = 'mkr';
  r.innerHTML = '<input class="ans" maxlength="14" autocapitalize="characters" autocomplete="off" spellcheck="false" aria-label="Jawaban"><input class="clue" maxlength="90" autocomplete="off" aria-label="Pertanyaan"><button type="button" class="del" aria-label="Hapus baris">✕</button>';
  const [ia, ic] = r.querySelectorAll('input'); ia.value = a; ic.value = c; ia.placeholder = 'KUCING'; ic.placeholder = 'Hewan yang suka mengeong';
  ia.oninput = () => { const v = cleanAns(ia.value); if (v !== ia.value) ia.value = v; ia.classList.remove('err'); mkDraft(); }; ic.oninput = () => { ic.classList.remove('err'); mkDraft(); };
  r.querySelector('.del').onclick = () => { r.remove(); if ($('mkRows').children.length < MK_MIN) mkRow(); mkDraft(); };
  $('mkRows').appendChild(r); return r;
}
function mkRead() { return [...$('mkRows').children].map(r => { const [a, c] = r.querySelectorAll('input'); return [cleanAns(a.value), c.value.trim(), a, c]; }); }
function mkDraft() { save.draft = { t: $('mkTitle').value, a: $('mkAuthor').value, w: mkRead().map(x => [x[0], x[1]]) }; persist(); $('mkOut').hidden = true; }
function openMaker() {
  show('maker'); if (location.hash !== '#buat') history.replaceState(null, '', '#buat');
  if (!$('mkRows').children.length) { const d = save.draft; $('mkTitle').value = d ? d.t || '' : ''; $('mkAuthor').value = d ? d.a || '' : ((window.JDNG && JDNG.name) || save.name || ''); const w = d && d.w && d.w.length ? d.w : []; w.forEach(x => mkRow(x[0], x[1])); while ($('mkRows').children.length < 6) mkRow(); }
  $('mkOut').hidden = true;
}
function customPuzzle(data) { const list = data.w.map(x => [cleanAns(x[0]), String(x[1] || '').slice(0, 90)]).filter(x => x[0].length >= 2 && x[1]); return S.build(list, { seed: S.hash(JSON.stringify(list)), count: list.length, maxW: 13, maxH: 13, tries: 60 }); }
let mkData = null, mkPz = null;
function mkBuild() {
  const rows = mkRead(), seen = new Set(), list = []; let bad = 0;
  rows.forEach(([a, c, ia, ic]) => { if (!a && !c) return; if (a.length < 2 || a.length > 13 || seen.has(a)) { ia.classList.add('err'); bad++; return; } if (!c) { ic.classList.add('err'); bad++; return; } seen.add(a); list.push([a, c]); });
  if (bad) return toast(bad + ' baris perlu dicek (jawaban 2–13 huruf, tidak dobel, pertanyaan diisi)', 'bad');
  if (list.length < MK_MIN) return toast('Isi minimal ' + MK_MIN + ' kata dulu ya', 'bad');
  if (list.length > MK_MAX) return toast('Maksimal ' + MK_MAX + ' kata', 'bad');
  mkData = { v: 1, t: $('mkTitle').value.trim().slice(0, 40), a: $('mkAuthor').value.trim().slice(0, 20), w: list };
  mkPz = customPuzzle(mkData); const inA = new Set(mkPz.words.map(w => w.ans)), miss = list.filter(x => !inA.has(x[0])).map(x => x[0]);
  rows.forEach(([a, , ia]) => ia.classList.toggle('err', miss.includes(a)));
  mkData.w = list.filter(x => inA.has(x[0]));
  $('mkMsg').textContent = miss.length ? `TTS jadi dengan ${mkPz.words.length} kata (${mkPz.w}×${mkPz.h}). Tidak bisa disilangkan: ${miss.join(', ')}. Ganti kata itu atau tetap bagikan tanpa kata tersebut.` : `TTS jadi! ${mkPz.words.length} kata, kotak ${mkPz.w}×${mkPz.h}. Coba main dulu atau langsung bagikan link-nya.`;
  $('mkOut').hidden = false; sfx.word(); $('mkOut').scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}
const mkLink = d => SITE + '#tts=' + b64e(JSON.stringify(d));
async function shareLink(text, url) { try { if (navigator.share) { await navigator.share({ text, url }); return; } } catch (e) { if (e && e.name === 'AbortError') return; } try { await navigator.clipboard.writeText(text + '\n' + url); toast('Link disalin, tempel di WhatsApp 📋', 'good'); } catch (e) { prompt('Salin link ini:', url); } }
function openCustom(d, fromLink) {
  const pz = customPuzzle(d); if (!pz || pz.words.length < 2) { toast('Link TTS ini rusak 😕', 'bad'); return goHome(); }
  const link = mkLink(d), t = d.t || 'TTS buatan teman';
  begin({ kind: 'c', key: 'c:' + S.hash(link), title: '✏️ ' + t, sub: d.a ? 'dibuat oleh ' + d.a : (fromLink ? 'TTS kiriman teman' : 'TTS buatanmu'), pz, ctitle: t, link, fromLink });
}
function readHashTTS() { const m = location.hash.match(/^#tts=([A-Za-z0-9_-]+)/); if (!m) return null; try { const d = JSON.parse(b64d(m[1])); if (d && Array.isArray(d.w) && d.w.length >= 2) return d; } catch (e) {} return null; }
/* ---------- wiring ---------- */
function goHome() { coachStep(9); G && saveCur(); $('result').hidden = true; homeRefresh(); show('home'); }
$('dailyBtn').onclick = openDaily;
$('playBtn').onclick = () => { if (!save.solved && !save.cur) return openLevel(0, 0); const pi = save.lastPack || 0, li = nextLevel(pi); if (li >= 0) openLevel(pi, li); else { packsRefresh(); show('packs'); } };
$('packBtn').onclick = () => { packsRefresh(); show('packs'); };
$('packsBack').onclick = goHome;
$('playBack').onclick = () => { if (location.hash === '#main') history.back(); else goHome(); };
window.addEventListener('popstate', () => { if (!$('play').hidden) goHome(); });
$('howBtn').onclick = () => { $('how').hidden = false; }; $('howClose').onclick = () => { $('how').hidden = true; };
$('lbBtn').onclick = lbOpen; $('lbClose').onclick = () => { $('lb').hidden = true; };
$('sendBtn').onclick = () => send($('nameIn'), () => { if (RES_DAILY) { $('nameIn').closest('.frow').hidden = true; $('lbFormTxt').textContent = 'Namamu sudah ada di daftar yang selesai hari ini ✅'; } else $('lbForm').hidden = true; });
$('whoBtn').onclick = whoOpen; $('whoFromRes').onclick = whoOpen; $('whoClose').onclick = () => { $('who').hidden = true; }; $('whoPlay').onclick = () => { $('who').hidden = true; $('result').hidden = true; openDaily(); };
$('sendBtn2').onclick = () => send($('nameIn2'), lbOpen);
$('muteBtn').onclick = () => { save.mute = !save.mute; persist(); homeRefresh(); };
$('resHome').onclick = () => { if (location.hash === '#main') history.back(); else goHome(); };
$('shareBtn').onclick = share;
$('kamusBtn').onclick = kamusOpen; $('kamusClose').onclick = () => { $('kamus').hidden = true; }; $('kamusIn').oninput = e => kamusSearch(e.target.value);
$('archBtn').onclick = archOpen; $('archClose').onclick = () => { $('arch').hidden = true; };
$('makeBtn').onclick = openMaker; $('makerBack').onclick = () => { history.replaceState(null, '', location.pathname); goHome(); };
$('mkAdd').onclick = () => { if ($('mkRows').children.length >= MK_MAX) return toast('Maksimal ' + MK_MAX + ' kata', 'bad'); mkRow().querySelector('input').focus(); };
$('mkEx').onclick = () => { $('mkRows').innerHTML = ''; EXAMPLE.forEach(x => mkRow(x[0], x[1])); if (!$('mkTitle').value) $('mkTitle').value = 'TTS Hari Kemerdekaan'; mkDraft(); };
$('mkTitle').oninput = mkDraft; $('mkAuthor').oninput = mkDraft;
$('mkBuild').onclick = mkBuild;
$('mkPlay').onclick = () => { if (mkData) openCustom(mkData, false); };
$('mkShare').onclick = () => { if (mkData) shareLink(`Coba TTS buatanku${mkData.t ? ' "' + mkData.t + '"' : ''} di TTS Kilat (${mkData.w.length} kata) ✏️`, mkLink(mkData)); };
$('hintLetter').onclick = hintLetter; $('hintWord').onclick = hintWord; $('checkBtn').onclick = doCheck;
$('cluePrev').onclick = () => nextWord(-1); $('clueNext').onclick = () => nextWord(1); $('clueText').onclick = () => onCell(G.cur);
R.keyboard(onKey); $('kb').classList.add('auto');
document.addEventListener('keydown', e => {
  if (!G || $('play').hidden || !$('result').hidden || !$('how').hidden || e.ctrlKey || e.metaKey || e.altKey || /INPUT|TEXTAREA/.test(document.activeElement.tagName)) return;
  const k = e.key;
  if (/^[a-zA-Z]$/.test(k)) { typeLetter(k.toUpperCase()); e.preventDefault(); }
  else if (k === 'Backspace' || k === 'Delete') { backspace(); e.preventDefault(); }
  else if (k === 'ArrowLeft') { moveArrow(-1, 0); e.preventDefault(); } else if (k === 'ArrowRight') { moveArrow(1, 0); e.preventDefault(); }
  else if (k === 'ArrowUp') { moveArrow(0, -1); e.preventDefault(); } else if (k === 'ArrowDown') { moveArrow(0, 1); e.preventDefault(); }
  else if (k === 'Tab' || k === 'Enter') { nextWord(e.shiftKey ? -1 : 1); e.preventDefault(); }
  else if (k === ' ') { onCell(G.cur); e.preventDefault(); }
});
window.addEventListener('resize', () => { R.fit(); if (!$('coach').hidden) coachPos(); });
document.addEventListener('visibilitychange', () => { if (document.hidden) saveCur(); });
window.TTSApp = { get G() { return G; }, get save() { return save; }, whoOpen, todayDone, scoresGet, openDaily, openLevel, typeLetter, finish, openMaker, openCustom, mkLink, b64d, kamusSearch, get coachAt() { return coachAt; } };
homeRefresh();
const hd = readHashTTS();
if (hd) openCustom(hd, true); else if (/^#tts=/.test(location.hash)) toast('Link TTS ini rusak 😕', 'bad');
else if (location.hash === '#harian') openDaily(); else if (location.hash === '#buat') openMaker(); else if (location.hash === '#main') history.replaceState(null, '', location.pathname);
})();

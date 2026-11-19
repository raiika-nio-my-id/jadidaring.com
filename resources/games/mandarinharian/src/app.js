'use strict';
/* Mandarin Harian: 1 kata/hari (WITA), kuis dengar + cocokkan, progres di localStorage. */
const $ = id => document.getElementById(id);
const N = BANK.length, EPOCH = Date.UTC(2026, 10, 3), SLUG = 'mandarinharian', URL0 = 'https://mandarinharian.jadidaring.com/';
const HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'], BLN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
/* ---------- WITA day math ---------- */
const now = () => Date.now();
const witaKey = (ms = now()) => new Date(ms + 8 * 3600e3).toISOString().slice(0, 10);
const keyMs = k => Date.parse(k + 'T00:00:00Z');
const dayNum = k => Math.round((keyMs(k) - EPOCH) / 864e5);
const idxOf = k => ((dayNum(k) % N) + N) % N;
const addDays = (k, d) => new Date(keyMs(k) + d * 864e5).toISOString().slice(0, 10);
const niceDate = k => { const d = new Date(keyMs(k)); return `${HARI[d.getUTCDay()]}, ${d.getUTCDate()} ${BLN[d.getUTCMonth()]} ${d.getUTCFullYear()}`; };
const shortDay = k => HARI[new Date(keyMs(k)).getUTCDay()].slice(0, 3);
/* ---------- save ---------- */
const SK = 'mh.v1';
let save = (() => { try { return Object.assign({ days: {}, learned: {}, mute: false, prac: 0, sent: '' }, JSON.parse(localStorage.getItem(SK) || '{}')); } catch (e) { return { days: {}, learned: {}, mute: false, prac: 0, sent: '' }; } })();
const persist = () => { try { localStorage.setItem(SK, JSON.stringify(save)); } catch (e) {} };
function streak() {
  let k = witaKey(); if (!save.days[k]) k = addDays(k, -1);
  let n = 0; while (save.days[k]) { n++; k = addDays(k, -1); } return n;
}
const learnedIdx = () => Object.keys(save.learned).map(Number).filter(i => Number.isInteger(i) && i >= 0 && i < BANK.length && BANK[i]).sort((a, b) => save.learned[a].at - save.learned[b].at);
/* ---------- tones ---------- */
const TONE = { 'āēīōūǖ': 1, 'áéíóúǘ': 2, 'ǎěǐǒǔǚ': 3, 'àèìòùǜ': 4 };
const toneOf = s => { for (const g in TONE) for (const ch of g) if (s.includes(ch)) return TONE[g]; return 5; };
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const pyHTML = w => ((w && w.py) || []).map(s => `<i class="c${toneOf(s)}">${esc(s)}</i>`).join(' ');
const pyText = w => ((w && w.py) || []).join(' ');
const TC = ['', 'var(--t1)', 'var(--t2)', 'var(--t3)', 'var(--t4)', 'var(--ink)'];
function wordHTML(w, cell) {
  const chars = [...w.hz];
  const c = cell || (chars.length >= 4 ? 70 : chars.length === 3 ? 84 : 98);
  return `<div class="cat">${w.c} kosakata sehari-hari</div><div class="hzrow" style="--cell:${c}px" lang="zh-CN">${chars.map((ch, i) => `<span class="tz" style="--tc:${TC[toneOf(w.py[i])]}"><span>${esc(ch)}</span></span>`).join('')}</div>` +
    `<div class="pyrow" lang="zh-Latn-pinyin">${pyHTML(w)}</div><div class="arti"><small>artinya</small>${esc(w.ar)}</div>`;
}
/* ---------- audio ---------- */
let AC = null, curAudio = null;
function ac() { if (!AC) try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} if (AC && AC.state === 'suspended') AC.resume(); return AC; }
function beep(kind) {
  if (save.mute) return; const a = ac(); if (!a) return; const t = a.currentTime;
  const notes = kind === 'ok' ? [660, 880] : kind === 'win' ? [523, 659, 784, 1047] : [220, 180];
  notes.forEach((f, i) => { const o = a.createOscillator(), g = a.createGain(); o.type = kind === 'bad' ? 'square' : 'triangle'; o.frequency.value = f; g.gain.setValueAtTime(0, t + i * .09); g.gain.linearRampToValueAtTime(kind === 'bad' ? .05 : .12, t + i * .09 + .01); g.gain.exponentialRampToValueAtTime(.001, t + i * .09 + .22); o.connect(g).connect(a.destination); o.start(t + i * .09); o.stop(t + i * .09 + .25); });
}
let zhVoice = null;
function pickVoice() { try { const v = speechSynthesis.getVoices(); zhVoice = v.find(x => /^zh[-_]CN/i.test(x.lang)) || v.find(x => /^(zh|cmn)/i.test(x.lang)) || null; } catch (e) {} document.querySelectorAll('.exsay').forEach(b => b.hidden = !zhVoice); }
if ('speechSynthesis' in window) { pickVoice(); speechSynthesis.onvoiceschanged = pickVoice; }
function speakTTS(text, rate, btn) {
  if (!zhVoice) return false; try { speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(text); u.voice = zhVoice; u.lang = zhVoice.lang; u.rate = rate || .85; if (btn) { btn.classList.add('playing'); u.onend = u.onerror = () => btn.classList.remove('playing'); } speechSynthesis.speak(u); return true; } catch (e) { return false; }
}
function say(w, slow, btn) {
  if (save.mute) { toast('Suara dimatikan — ketuk 🔇 untuk menyalakan'); return; }
  try { if (curAudio) { curAudio.pause(); curAudio = null; } if ('speechSynthesis' in window) speechSynthesis.cancel(); } catch (e) {}
  const a = new Audio('data:audio/mpeg;base64,' + w.au); a.playbackRate = slow ? .7 : 1; try { a.preservesPitch = true; } catch (e) {}
  curAudio = a; if (btn) btn.classList.add('playing');
  const off = () => btn && btn.classList.remove('playing'); a.onended = off; a.onerror = () => { off(); speakTTS(w.hz, slow ? .55 : .8, btn); };
  const p = a.play(); if (p && p.catch) p.catch(() => { off(); if (!speakTTS(w.hz, slow ? .55 : .8, btn)) toast('Ketuk lagi untuk mendengar 🔊'); });
}
/* ---------- ui helpers ---------- */
let toastT = 0;
function toast(m) { const t = $('toast'); t.textContent = m; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => t.hidden = true, 2200); }
function confetti() { const c = $('confetti'), cols = ['#c8372d', '#f2b632', '#1f9a62', '#2f6fdb', '#e8890c']; c.innerHTML = ''; for (let i = 0; i < 46; i++) { const e = document.createElement('i'); e.style.left = Math.random() * 100 + 'vw'; e.style.background = cols[i % 5]; e.style.setProperty('--dx', (Math.random() * 160 - 80) + 'px'); e.style.setProperty('--rot', (Math.random() * 720 - 360) + 'deg'); e.style.animationDelay = Math.random() * .4 + 's'; c.appendChild(e); } setTimeout(() => c.innerHTML = '', 2400); }
const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const pyk = i => ((BANK[i] && BANK[i].py) || []).join('').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
function others(ex, n) { ex = ex.filter(i => BANK[i]); const ban = new Set(ex), bp = new Set(ex.map(pyk)), ar0 = i => String((BANK[i] && BANK[i].ar) || '').split(' (')[0].split(' / ')[0], ba = new Set(ex.map(ar0)); return shuffle([...Array(N).keys()].filter(i => !ban.has(i) && !bp.has(pyk(i)) && !ba.has(ar0(i)))).slice(0, n); }
const stars = s => s >= 90 ? 3 : s >= 60 ? 2 : 1;
/* ---------- home ---------- */
function renderHome() {
  const k = witaKey(), w = BANK[idxOf(k)], dn = dayNum(k);
  $('tDay').textContent = dn >= 0 ? `Hari ke-${dn + 1}` : 'Kata hari ini';
  $('tDate').textContent = niceDate(k) + ' · WITA';
  const box = $('wordBox'); box.innerHTML = wordHTML(w); box.classList.remove('pop'); void box.offsetWidth; box.classList.add('pop');
  box.insertAdjacentHTML('beforeend', '<span class="lantern" aria-hidden="true">🏮</span><span class="lantern l2" aria-hidden="true">🏮</span>');
  box.querySelector('.hzrow').onclick = () => { box.querySelectorAll('.tz').forEach((t, j) => setTimeout(() => { t.classList.remove('bump'); void t.offsetWidth; t.classList.add('bump'); }, j * 90)); say(w, false, $('sayBtn')); };
  $('tipBox').innerHTML = `<b>💡 Cara baca:</b> ${esc(w.tip)}`;
  $('exBox').innerHTML = `<span class="lbl">Contoh di percakapan</span><span class="exh" lang="zh-CN">${esc(w.ex[0])}</span><span class="exp">${esc(w.ex[1])}</span><span class="exa">${esc(w.ex[2])}</span><button type="button" class="exsay" aria-label="Dengar contoh" ${zhVoice ? '' : 'hidden'}>🔊</button>`;
  $('exBox').querySelector('.exsay').onclick = e => speakTTS(w.ex[0], .8, e.currentTarget);
  const st = streak(), d = save.days[k], L = learnedIdx();
  $('streakChip').textContent = '🔥 ' + st; $('streakChip').classList.toggle('hot', !!d);
  $('learnChip').textContent = '📚 ' + L.length;
  $('muteBtn').textContent = save.mute ? '🔇' : '🔊';
  $('quizLbl').textContent = d ? 'Ulangi kuis hari ini' : 'Kuis 1 menit';
  $('quizBtn').classList.toggle('gold', !d);
  const oldSt = $('todayCard').querySelector('.stamp'); if (oldSt) oldSt.remove();
  $('todayCard').classList.toggle('done', !!d); if (d) $('todayCard').insertAdjacentHTML('beforeend', '<span class="stamp" aria-hidden="true"><span><b>学会</b>SELESAI</span></span>');
  $('doneLine').hidden = !d; if (d) $('doneLine').textContent = `✅ Hari ini selesai · ${d.s} poin ${'⭐'.repeat(stars(d.s))}${st > 1 ? ` · streak ${st} hari 🔥` : ''}`;
  // week
  const wr = $('weekRow'); wr.innerHTML = '';
  for (let i = 6; i >= 0; i--) {
    const dk = addDays(k, -i);
    const wi = idxOf(dk), dd = save.days[dk], got = save.learned[wi];
    const b = document.createElement('button'); b.type = 'button'; b.className = 'wd' + (dd ? ' done' : got ? ' done' : i ? ' miss' : '') + (i ? '' : ' now');
    b.innerHTML = `<span class="d">${i ? shortDay(dk) : 'Hari ini'}</span><span class="h${[...BANK[wi].hz].length > 2 ? ' long' : ''}" lang="zh-CN">${esc(BANK[wi].hz)}</span><span class="s">${dd ? '⭐'.repeat(stars(dd.s)) : got ? '✓' : i ? '·' : '✨'}</span>`;
    b.setAttribute('aria-label', `${niceDate(dk)}: ${BANK[wi].hz} ${pyText(BANK[wi])}`);
    b.onclick = () => i ? openWord(wi, dk) : (scrollTo({ top: 0, behavior: 'smooth' }), say(w, false, $('sayBtn')));
    wr.appendChild(b);
  }
  // collection
  const cg = $('collGrid'); cg.innerHTML = '';
  L.slice().reverse().forEach(i => { const x = BANK[i], b = document.createElement('button'); b.type = 'button'; b.className = 'cw'; b.innerHTML = `<span class="h" lang="zh-CN">${esc(x.hz)}</span><span class="p">${pyHTML(x)}</span><span class="a">${esc(x.ar)}</span>`; b.onclick = () => openWord(i); cg.appendChild(b); });
  $('colSub').textContent = L.length ? `${L.length} dari ${N} kata · ketuk untuk dengar lagi` : 'Kata yang sudah kamu kuasai muncul di sini.';
  $('pracLbl').textContent = save.prac ? `rekor ${save.prac}/6` : '6 soal dengar';
  tick(); whoPeek();
}
function tick() {
  const ms = keyMs(addDays(witaKey(), 1)) - 8 * 3600e3 - now(), h = Math.floor(ms / 36e5), m = Math.floor(ms % 36e5 / 6e4);
  $('nextLine').textContent = `Kata baru dalam ${h} jam ${m} menit (00.00 WITA)`;
}
function openWord(i, dk) {
  const w = BANK[i], got = save.learned[i], m = $('wordModal'), c = $('wmCard');
  c.innerHTML = `<button type="button" class="x m-x" data-close="wordModal" aria-label="Tutup">✕</button><h2>${dk ? niceDate(dk) : 'Koleksi kata'}</h2><p class="muted">${got ? '✅ Sudah dipelajari' : 'Belum dipelajari'}</p>` +
    `<div class="word">${wordHTML(w, [...w.hz].length >= 3 ? 64 : 80)}</div><div class="t-actions"><button type="button" class="btn primary" id="wmSay">🔊 Dengar</button><button type="button" class="btn" id="wmSlow">🐢 Pelan</button></div>` +
    `<div class="tip"><b>💡</b> ${esc(w.tip)}</div><div class="ex"><span class="lbl">Contoh</span><span class="exh" lang="zh-CN">${esc(w.ex[0])}</span><span class="exp">${esc(w.ex[1])}</span><span class="exa">${esc(w.ex[2])}</span></div>` +
    `<button type="button" class="btn big gold" id="wmQuiz" style="margin-top:12px">🎯 ${got ? 'Latih kata ini' : 'Pelajari & kuis'}</button>`;
  m.hidden = false; say(w, false, $('wmSay'));
  $('wmSay').onclick = e => say(w, false, e.currentTarget); $('wmSlow').onclick = e => say(w, true, e.currentTarget);
  $('wmQuiz').onclick = () => { m.hidden = true; startQuiz(i, dk && dk !== witaKey() ? 'catch' : 'catch'); };
}
/* ---------- quiz ---------- */
let Q = null;
function startQuiz(i, mode) {
  ac(); const k = witaKey(); mode = mode || 'daily';
  if (mode === 'prac') {
    let pool = shuffle(learnedIdx()); if (pool.length < 6) pool = pool.concat(others(pool, 6 - pool.length)); pool = shuffle(pool).filter(x => BANK[x]);
    Q = { mode, k, w: -1, steps: pool.slice(0, 6).map(x => ({ t: 'listen', w: x })), at: 0, pts: 0 };
    $('quiz').hidden = false; document.body.style.overflow = 'hidden'; return step();
  }
  if (!BANK[i]) return;
  const L = learnedIdx().filter(x => x !== i);
  let rev = shuffle(L).slice(0, 2); if (rev.length < 2) rev = rev.concat(others([i, ...rev], 2 - rev.length));
  Q = { mode, k, w: i, steps: [{ t: 'listen', w: i }, { t: 'hanzi', w: i }, { t: 'match', ws: shuffle([i, ...rev]) }], at: 0, pts: 0 };
  $('quiz').hidden = false; document.body.style.overflow = 'hidden'; step();
}
function closeQuiz() { $('quiz').hidden = true; document.body.style.overflow = ''; Q = null; renderHome(); }
function dots() { $('qDots').innerHTML = Q.steps.map((s, j) => `<i class="${j < Q.at ? 'on' : j === Q.at ? 'cur' : ''}"></i>`).join(''); $('qPts').textContent = Q.pts + (Q.mode === 'prac' ? '' : ' poin'); }
function step() {
  dots(); const s = Q.steps[Q.at], b = $('qBody'); if (!s) return result();
  if (s.t === 'match') return matchStep(s, b);
  const w = BANK[s.w], isHz = s.t === 'hanzi';
  const ops = shuffle([s.w, ...others([s.w], 3)]); let tries = 0;
  b.innerHTML = `<h2 class="q-title" id="qTitle">${isHz ? 'Dengar, lalu pilih Hanzi-nya' : 'Dengar, apa artinya?'}</h2><p class="q-sub">${Q.mode === 'prac' ? `Soal ${Q.at + 1} dari ${Q.steps.length}` : isHz ? 'Cocokkan bunyi dengan karakter yang benar' : 'Ketuk tombol merah untuk mendengar lagi'}</p>` +
    `<button type="button" class="ear" id="qEar" aria-label="Putar suara">🔊</button><button type="button" class="slowlink" id="qSlow">🐢 putar pelan</button>` +
    `<div class="opts">${ops.map(o => `<button type="button" class="opt${isHz ? ' hz' : ''}" data-i="${o}" ${isHz ? 'lang="zh-CN"' : ''}>${esc(isHz ? BANK[o].hz : BANK[o].ar)}</button>`).join('')}</div><div class="feedback" id="qFb" aria-live="polite"></div>`;
  $('qEar').onclick = e => say(w, false, e.currentTarget); $('qSlow').onclick = () => say(w, true, $('qEar'));
  setTimeout(() => Q && say(w, false, $('qEar')), 250);
  b.querySelectorAll('.opt').forEach(o => o.onclick = () => {
    if (o.disabled) return; const ok = +o.dataset.i === s.w; tries++;
    if (!ok) { o.classList.add('bad'); o.disabled = true; beep('bad'); $('qFb').textContent = tries === 1 ? 'Belum tepat, dengar sekali lagi 👂' : 'Hampir! Coba lagi'; setTimeout(() => Q && say(w, false, $('qEar')), 350); return; }
    o.classList.add('ok'); beep('ok'); const per = Q.mode === 'prac' ? 1 : 30, got = tries === 1 ? per : tries === 2 ? Math.round(per / 2) : Q.mode === 'prac' ? 0 : 5;
    Q.pts += got; b.querySelectorAll('.opt').forEach(x => x.disabled = true);
    $('qFb').innerHTML = `<span class="big" lang="zh-CN">${esc(w.hz)} · ${pyHTML(w)}</span>${tries === 1 ? '🎉 Tepat!' : '👍 Betul'} — ${esc(w.ar)}`;
    dots(); setTimeout(() => { if (!Q) return; Q.at++; step(); }, 1300);
  });
}
function matchStep(s, b) {
  const cols = [['Hanzi', 'hz'], ['Pinyin', 'py'], ['Arti', 'ar']]; let sel = [null, null, null], miss = 0, done = 0;
  b.innerHTML = `<h2 class="q-title" id="qTitle">Cocokkan pasangannya</h2><p class="q-sub">Pilih satu Hanzi, satu pinyin dan satu arti yang sama</p><div class="match">${cols.map(([h, f], c) => `<div class="mcol"><h3>${h}</h3>${shuffle(s.ws).map(i => `<button type="button" class="mc${f === 'hz' ? ' hz' : ''}" data-c="${c}" data-i="${i}" ${f === 'hz' ? 'lang="zh-CN"' : ''}>${f === 'py' ? pyHTML(BANK[i]) : esc(BANK[i][f])}</button>`).join('')}</div>`).join('')}</div><div class="feedback" id="qFb" aria-live="polite"></div>`;
  b.querySelectorAll('.mc').forEach(el => el.onclick = () => {
    if (el.disabled) return; const c = +el.dataset.c, i = +el.dataset.i;
    if (sel[c]) sel[c].classList.remove('sel'); sel[c] = sel[c] === el ? null : el; if (sel[c]) el.classList.add('sel');
    if (c === 0 && sel[0]) say(BANK[i]);
    if (sel.every(Boolean)) {
      const ids = sel.map(x => +x.dataset.i), ok = ids.every(x => x === ids[0]), cur = sel; sel = [null, null, null];
      if (ok) { cur.forEach(x => { x.classList.remove('sel'); x.classList.add('done'); x.disabled = true; }); done++; beep('ok'); const w = BANK[ids[0]]; $('qFb').innerHTML = `✅ <span lang="zh-CN">${esc(w.hz)}</span> = ${esc(w.ar)}`; if (done === 3) { Q.pts += Math.max(10, 40 - miss * 10); dots(); setTimeout(() => { if (!Q) return; Q.at++; step(); }, 1100); } }
      else { miss++; beep('bad'); cur.forEach(x => { x.classList.remove('sel'); x.classList.add('bad'); setTimeout(() => x.classList.remove('bad'), 400); }); $('qFb').textContent = 'Belum cocok, coba lagi 🙂'; }
    }
  });
}
function result() {
  const b = $('qBody'), k = Q.k; Q.at = Q.steps.length; dots(); beep('win'); confetti();
  if (Q.mode === 'prac') {
    const p = Q.pts; if (p > save.prac) save.prac = p; persist();
    b.innerHTML = `<div class="res"><p class="stars">${'<span>⭐</span>'.repeat(p >= 6 ? 3 : p >= 4 ? 2 : 1)}</p><p class="score">${p}/6</p><p class="msg">${p >= 6 ? 'Sempurna! Telingamu makin peka 👂✨' : p >= 4 ? 'Bagus! Ulangi biar makin hafal.' : 'Pelan-pelan saja, ulangi lagi ya.'}</p><div class="row"><button type="button" class="btn gold" id="rAgain">⚡ Latihan lagi</button><button type="button" class="btn" id="rHome">Kembali</button></div></div>`;
    $('rAgain').onclick = () => startQuiz(-1, 'prac'); $('rHome').onclick = closeQuiz; return;
  }
  const w = BANK[Q.w], s = Q.pts, daily = Q.mode === 'daily', first = daily && !save.days[k];
  if (!save.learned[Q.w]) save.learned[Q.w] = { at: now(), k, s };
  else save.learned[Q.w].s = Math.max(save.learned[Q.w].s || 0, s);
  if (daily) { const d = save.days[k]; save.days[k] = { w: Q.w, s: d ? Math.max(d.s, s) : s, first: d ? d.first : s, t: d ? d.t : now() }; }
  persist(); const st = streak();
  b.innerHTML = `<div class="res">${daily ? `<span class="streakbig">🔥 Streak ${st} hari</span>` : ''}<p class="stars">${'<span>⭐</span>'.repeat(stars(s))}</p><p class="score">${s}<small style="font-size:18px;color:var(--mute)">/100</small></p>` +
    `<p class="msg">${s >= 90 ? 'Hebat! Kata ini sudah jadi milikmu 🎉' : s >= 60 ? 'Mantap! Dengar sekali lagi biar nempel.' : 'Tidak apa-apa, ulangi kuisnya ya 💪'}</p>` +
    `<button type="button" class="rw" id="rWord" aria-label="Dengar lagi"><span class="h" lang="zh-CN">${esc(w.hz)}</span><span class="pyrow" style="font-size:20px">${pyHTML(w)}</span><span>${esc(w.ar)} 🔊</span></button>` +
    `<p class="muted">${daily ? (first ? 'Kata hari ini masuk koleksimu.' : 'Skor terbaik hari ini disimpan.') + ' Kata baru besok jam 00.00 WITA.' : 'Kata ini masuk koleksimu (streak hanya dari kata hari ini).'}</p>` +
    `<div class="row"><button type="button" class="btn primary" id="rShare">📤 Bagikan</button><button type="button" class="btn" id="rHome">Selesai</button></div>${daily ? '<p class="muted" id="rSend"></p>' : ''}</div>`;
  $('rWord').onclick = () => say(w); $('rHome').onclick = closeQuiz;
  $('rShare').onclick = () => share(w, s, st, daily);
  setTimeout(() => say(w), 500);
  if (daily && first) sendDone(s);
}
function share(w, s, st, daily) {
  const t = `🀄 Mandarin Harian${daily ? ' hari ke-' + (dayNum(Q ? Q.k : witaKey()) + 1) : ''}\n${w.hz} (${pyText(w)}) = ${w.ar}\n${'⭐'.repeat(stars(s))} ${s}/100${daily && st ? ' · 🔥' + st : ''}\nBelajar 1 kata Mandarin sehari, gratis:\n${URL0}`;
  if (navigator.share) navigator.share({ text: t }).catch(() => {}); else window.open('https://wa.me/?text=' + encodeURIComponent(t), '_blank', 'noopener');
}
/* ---------- shared "sudah belajar hari ini" list (per-subdomain /api/game/scores) ----------
   score = dayNum*1000 + skor, name + "." marks a daily entry, so today's learners always rank on top of the 50-row board. */
const cleanName = v => String(v || '').replace(/[^\p{L}\p{N} '\-]/gu, '').replace(/\s+/g, ' ').trim().slice(0, 15);
let scCache = null, scAt = 0;
async function scoresGet(fresh) {
  if (!fresh && scCache && now() - scAt < 30000) return scCache;
  const r = await fetch('/api/game/scores?limit=50', { headers: { Accept: 'application/json' }, cache: 'no-store' }); if (!r.ok) throw Error(r.status);
  const d = await r.json(); scCache = (Array.isArray(d.scores) ? d.scores : []).map(e => { const raw = String(e.name || e.player_name || '?'), sc = Number(e.score || 0); return { nm: raw.replace(/\.+$/, '') || '?', daily: raw.endsWith('.'), day: Math.floor(sc / 1000), s: sc % 1000, at: Date.parse(e.created_at || '') || 0 }; }); scAt = now(); return scCache;
}
function todayList(L) { const dn = dayNum(witaKey()), m = new Map(); L.filter(e => e.daily && e.day === dn).sort((a, b) => a.at - b.at).forEach(e => { const n = e.nm.toLowerCase(); if (!m.has(n)) m.set(n, e); }); return [...m.values()]; }
async function sendDone(s) {
  const el = $('rSend'), k = witaKey(), name = cleanName(window.JDNG && JDNG.name);
  if (!name) { if (el) el.textContent = ''; return; }
  try { const r = await fetch('/api/game/scores', { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ name: name + '.', score: dayNum(k) * 1000 + s }) }); if (!r.ok) throw Error(r.status);
    save.sent = k; save.sentName = name; persist(); scCache = null; if (el) el.textContent = `👥 ${name} masuk daftar “sudah belajar hari ini”.`; }
  catch (e) { if (el) el.textContent = ''; }
}
let peekT = 0;
async function whoPeek() {
  const el = $('whoLine'); if (now() - peekT < 20000 && el.dataset.n) return; peekT = now();
  try { const n = todayList(await scoresGet()).length; el.dataset.n = n; $('whoCnt').textContent = n ? `👥 ${n} orang sudah belajar hari ini` : '👥 Belum ada yang belajar hari ini'; el.hidden = false; } catch (e) { el.hidden = true; }
}
async function whoOpen() {
  const k = witaKey(), ul = $('whoList'), mine = save.days[k]; $('whoDate').textContent = niceDate(k) + ' (WITA) · kata: ' + BANK[idxOf(k)].hz;
  $('who').hidden = false; ul.innerHTML = '<li class="none">Memuat…</li>';
  $('whoMine').textContent = mine ? (save.sent === k ? 'Kamu sudah masuk daftar hari ini ✅' : 'Kamu sudah selesai hari ini.') : 'Selesaikan kuis hari ini supaya namamu masuk daftar.';
  try { const L = todayList(await scoresGet(true)); ul.innerHTML = L.length ? '' : '<li class="none">Belum ada. Jadilah yang pertama! 🏁</li>';
    L.forEach((e, i) => { const li = document.createElement('li'); li.innerHTML = '<b></b><span></span><i></i>'; li.children[0].textContent = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1; li.children[1].textContent = e.nm + ' ' + '⭐'.repeat(stars(e.s)); li.children[2].textContent = e.at ? new Date(e.at + 8 * 3600e3).toISOString().slice(11, 16) : ''; if (save.sent === k && save.sentName && e.nm.toLowerCase() === save.sentName.toLowerCase()) li.className = 'me'; ul.appendChild(li); });
    $('whoLine').dataset.n = L.length; $('whoCnt').textContent = L.length ? `👥 ${L.length} orang sudah belajar hari ini` : '👥 Belum ada yang belajar hari ini';
  } catch (e) { ul.innerHTML = '<li class="none">Daftar belum bisa dimuat (perlu koneksi).</li>'; }
}
/* ---------- wiring ---------- */
const syncHub = () => document.documentElement.classList.toggle('jr-hub-off', !$('quiz').hidden || !$('wordModal').hidden || !$('who').hidden);
if (window.MutationObserver) new MutationObserver(syncHub).observe(document.getElementById('app'), { attributes: true, subtree: true, attributeFilter: ['hidden'] });
$('sayBtn').onclick = e => say(BANK[idxOf(witaKey())], false, e.currentTarget);
$('slowBtn').onclick = e => say(BANK[idxOf(witaKey())], true, e.currentTarget);
$('quizBtn').onclick = () => startQuiz(idxOf(witaKey()), 'daily');
$('pracBtn').onclick = () => startQuiz(-1, 'prac');
$('qClose').onclick = () => { if (!Q || Q.at >= Q.steps.length || confirm('Keluar dari kuis? Progres kuis ini tidak disimpan.')) closeQuiz(); };
$('muteBtn').onclick = () => { save.mute = !save.mute; persist(); $('muteBtn').textContent = save.mute ? '🔇' : '🔊'; if (save.mute) { try { curAudio && curAudio.pause(); speechSynthesis.cancel(); } catch (e) {} } };
$('whoBtn').onclick = whoOpen;
document.addEventListener('click', e => { const c = e.target.closest('[data-close]'); if (c) $(c.dataset.close).hidden = true; else if (e.target.classList && e.target.classList.contains('modal')) e.target.hidden = true; });
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { if (!$('wordModal').hidden) $('wordModal').hidden = true; else if (!$('who').hidden) $('who').hidden = true; else if (Q) $('qClose').click(); return; }
  if (Q && /^[1-4]$/.test(e.key)) { const o = $('qBody').querySelectorAll('.opt')[+e.key - 1]; if (o) o.click(); }
  else if (Q && (e.key === ' ' || e.key === 'Enter') && $('qEar') && document.activeElement === document.body) { e.preventDefault(); $('qEar').click(); }
});
let lastKey = witaKey();
setInterval(() => { if (witaKey() !== lastKey) { lastKey = witaKey(); if (!Q) renderHome(); } else tick(); }, 30000);
document.addEventListener('visibilitychange', () => { if (!document.hidden && witaKey() !== lastKey) { lastKey = witaKey(); if (!Q) renderHome(); } });
renderHome();
if (window.JDNG) JDNG.on(() => { if (!/^#(demo|snap)/.test(location.hash)) setTimeout(() => say(BANK[idxOf(witaKey())], false, $('sayBtn')), 200); });

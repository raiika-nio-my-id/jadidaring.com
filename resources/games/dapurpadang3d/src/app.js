/* Dapur Padang Panik: UI, renderer, input, solo + tutorial, online host/client loop, chat, shouts, GM. */
(function (root) {
'use strict';
const doc = root.document, $ = id => doc.getElementById(id), D = root.DP, N = root.DPNet, Sim = D.Sim;
/* ---------- JSON config (#website-config) ---------- */
let CONF = {}; try { CONF = JSON.parse($('website-config').textContent) || {}; } catch (e) { CONF = {}; }
(function mergeGame(gc) {
  if (!gc || typeof gc !== 'object') return; const C = D.CFG;
  for (const k of ['speed', 'burnAfter', 'expirePenalty', 'burnPenalty', 'tipFrac']) if (Number.isFinite(gc[k])) C[k] = gc[k];
  if (gc.recipes && typeof gc.recipes === 'object') for (const r in gc.recipes) if (C.recipes[r] && Number.isFinite(gc.recipes[r].cook)) C.recipes[r].cook = gc.recipes[r].cook;
  if (Array.isArray(gc.shifts)) gc.shifts.forEach((s, i) => { const d = C.shifts[i]; if (!d || !s) return; if (Number.isFinite(s.dur)) d.dur = s.dur; if (Number.isFinite(s.gap)) d.gap = s.gap; if (Array.isArray(s.menu) && s.menu.every(m => C.menu[m])) d.menu = s.menu.slice(); if (Array.isArray(s.stars) && s.stars.length === 3) d.stars = s.stars.map(Number); });
})(CONF.game);
const SITE = Object.assign({ title: 'Dapur Padang Panik', footer: '', termsUrl: '/syarat-ketentuan', gameHubUrl: 'https://gamehub.jadidaring.com/' }, CONF.site || {});
const SHOUTS = Array.isArray(CONF.shouts) && CONF.shouts.length ? CONF.shouts.slice(0, 8) : [{ icon: '🍚', id: 'Nasi!', en: 'Rice!' }, { icon: '👍', id: 'Mantap!', en: 'Nice!' }];
/* ---------- storage + i18n ---------- */
const NAME_KEY = 'dapurpadang.name', LANG_KEY = 'dapurpadang.lang', MUTE_KEY = 'dapurpadang.mute', TUT_KEY = 'dapurpadang.tut', BEST_KEY = 'dapurpadang.best', SET_KEY = 'dapurpadang.set';
function getLS(k) { try { return root.localStorage.getItem(k) || ''; } catch (e) { return ''; } }
function setLS(k, v) { try { root.localStorage.setItem(k, v); } catch (e) { /* private mode */ } }
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
let lang = getLS(LANG_KEY) === 'en' ? 'en' : 'id', muted = getLS(MUTE_KEY) === '1';
let saved = { sh: 0 }; try { saved = Object.assign(saved, JSON.parse(getLS(SET_KEY) || '{}')); } catch (e) { /* ignore */ }
const saveSet = () => setLS(SET_KEY, JSON.stringify(saved));
const STR = {
  id: {
    paused: 'Jeda', tagline: 'Masak bareng, panik bareng!', lead: SITE.lead || '', youTitle: 'Kamu', name: 'Nama koki', namePh: 'Tulis namamu',
    practiceTitle: 'Latihan sendiri (offline)', practiceSub: 'Dapur yang sama, tempo santai. Bisa tanpa internet.', shift: 'Shift', sh0: 'Pagi', sh1: 'Siang', sh2: 'Malam Ramai',
    practiceGo: 'Mulai latihan', tutGo: 'Main tutorial', onlineTitle: 'Main bareng (1–4 koki)', onlineSub: 'Satu dapur, satu skor tim. Ada chat dan teriakan cepat.',
    createPub: 'Buat room publik', createPriv: 'Buat room privat', match: 'Cari room cepat', codePh: 'KODE', join: 'Gabung',
    howTitle: 'Cara main', terms: 'Syarat & Ketentuan', roomCode: 'Kode room', invite: 'Undang teman', leave: 'Keluar', players: 'Koki',
    start: 'Buka warung!', you: 'kamu', host: 'host', visPub: 'Room publik: siapa saja bisa masuk lewat Cari room.', visPriv: 'Room privat: masuk pakai kode atau link undangan.',
    waitHost: 'Menunggu host membuka warung…', spectating: 'Kamu menonton.', exit: '✕ Keluar', pause: '⏸', resume: '▶', skip: 'Lewati',
    keys: 'Maju/mundur: W/S · Belok: A/D atau Q/E (tahan = terus belok) · Kamera selalu di belakang koki, geser layar/mouse = lihat sekeliling, roda = zoom · Ambil/Taruh: Spasi · Proses: F atau J · Chat: Enter · Teriak: 1–6',
    kSpace: 'Spasi', rotT: 'Miringkan HP-mu 🔄', rotP: 'Main dengan HP landscape: jempol kiri untuk jalan, jempol kanan untuk aksi, seperti main konsol.', rotGo: 'Layar penuh', rotSkip: 'Tetap tegak', grab: 'Ambil/Taruh', work: 'Proses', send: 'Kirim', chatPh: 'Ketik pesan…', bookTitle: '📖 Buku resep',
    soundOn: '🔊', soundOff: '🔇', nextShift: 'Shift berikutnya', again: 'Ulangi shift', toLobby: 'Ke lobi', menu: 'Menu',
    gameOver: 'Warung tutup!', tutDone: 'Tutorial selesai!', waitAgain: 'Menunggu host…', copied: 'Link undangan disalin!',
    exitConfirm: 'Keluar dari dapur?', errName: 'Isi nama koki dulu ya.', errCode: 'Kode room 6 huruf.', errNet: 'Koneksi bermasalah, coba lagi.',
    errBusy: 'Server sibuk, tunggu {s} detik.', errMissing: 'Room tidak ditemukan.', errGeneric: 'Gagal: {msg}', errFull: 'Room penuh/sedang main, kamu masuk sebagai penonton.',
    onlineOff: 'Main online hanya di dapurpadang3d.jadidaring.com. Latihan tetap bisa.', onlineDown: 'Server online sedang tidak bisa dihubungi. Latihan tetap bisa.',
    roomGone: 'Room sudah ditutup.', hostTook: 'Kamu sekarang host dapur.', netHost: 'Kamu host', netClient: 'Online',
    gmTitle: 'Semua lobi (GM)', gmRefresh: 'Muat ulang', gmLoading: 'Memuat…', gmEmpty: 'Tidak ada lobi aktif.', gmCount: '{n} lobi aktif', gmErr: 'Gagal memuat: {msg}',
    gmPrivate: 'Privat', gmPublic: 'Publik', gmPlaying: 'Main', gmWaiting: 'Menunggu', gmPlayers: '{n}/{max} koki · {w} penonton', gmJoin: 'Gabung', gmWatch: 'Tonton',
    best: 'Rekor {s}: {v} 🪙', bestNone: 'Belum ada rekor.', served: 'Tersaji', tips: 'Tip', expired: 'Pelanggan kabur', burned: 'Gosong', streakBest: 'Beruntun terbaik',
    stars: 'Bintang: {a} / {b} / {c}', newBest: 'Rekor baru!', mvp: 'antar', shiftName: 'Shift {n}', tutName: 'Tutorial', chatSys: '{n} masuk dapur', chatLeft: '{n} keluar',
    chatSlow: 'Pelan-pelan, satu pesan per detik.', solo: 'Latihan', tip1: 'Tip: joystik atas = maju, kiri/kanan = belok terus. Kamera selalu di belakang koki. Pegang lauk lalu ambil piring = langsung diplating!',
    // results / hints
    h_raw: 'Potong dulu di talenan 🔪', h_rawC: 'Cabai diulek dulu di cobek 🪨', h_noPot: 'Itu tidak dimasak di kuali', h_noMatch: 'Tidak cocok dengan isi kuali (lihat 📖)',
    h_potBusy: 'Kuali sedang dipakai', h_notYet: 'Belum matang, sabar…', h_burnt: 'Gosong! Tekan Proses untuk membersihkan', h_needPlate: 'Pakai piring dulu 🍽️', h_empty: 'Piringnya masih kosong',
    h_wrong: 'Tidak ada pesanan seperti ini (lihat tiket)', h_plateNo: 'Tidak bisa masuk piring ini', h_useCobek: 'Cabai diulek di cobek', h_useTalenan: 'Daging/ikan dipotong di talenan',
    h_nothing: 'Taruh bahan di sini dulu', h_workHint: 'Taruh di talenan/cobek, lalu Proses', h_cooking: 'Sedang dimasak…', h_noWork: 'Ini tidak perlu diproses',
    g_putBack: 'Kembalikan', g_addNasi: 'Tambah nasi', g_toPot: 'Masukkan', g_scoop: 'Ambil masakan', g_serve: 'Sajikan!', g_trash: 'Buang', g_pick: 'Angkat', g_drop: 'Taruh', g_plate: 'Gabung', g_toPlate: 'Ambil piring', g_take: 'Ambil {x}',
    w_chop: 'Potong', w_grind: 'Ulek', w_clean: 'Bersihkan',
    i_daging: 'daging', i_dagingP: 'daging potong', i_ikan: 'ikan', i_ikanP: 'ikan potong', i_cabai: 'cabai', i_sambal: 'sambal ijo', i_santan: 'santan', i_bumbu: 'bumbu', i_nasi: 'nasi', i_plate: 'piring', i_rendang: 'rendang', i_gulai: 'gulai',
    m_gulai: 'Nasi Gulai Ikan', m_sambal: 'Nasi Sambal Ijo', m_rendang: 'Nasi Rendang', m_komplit: 'Rendang Komplit', m_gulaiS: 'Gulai Komplit',
    f_serve: '+{v}', f_burn: 'Gosong! −{v}', f_exp: 'Pelanggan ngamuk! −{v}', f_done: 'Matang!', f_streak: 'Beruntun ×{v}!',
    // how to
    how1: '<b>Ambil bahan</b> dari peti: ikan, daging, cabai, santan, bumbu.', how2: '<b>Olah</b>: ikan & daging dipotong di talenan, cabai diulek di cobek (tombol Proses).',
    how3: '<b>Masak</b> di kuali: ikan potong + santan = gulai; daging potong + bumbu + santan = rendang. Jangan sampai gosong!',
    how4: '<b>Sajikan</b>: piring + nasi + masakan → loket. Cepat = tip besar, urut = beruntun.',
    // tutorial
    t1: 'Ambil <b>ikan</b> dari peti (tombol ✋).', t2: 'Taruh ikan di <b>talenan</b>.', t3: 'Tekan <b>Proses 🔪</b> di talenan untuk memotong.', t4: 'Angkat ikan potong, masukkan ke <b>kuali</b>.',
    t5: 'Ambil <b>santan</b>, masukkan ke kuali. Gulai mulai dimasak!', t6: 'Sambil menunggu: ambil <b>piring</b>.', t7: 'Isi piring dengan <b>nasi</b> dari magic com.',
    t8: 'Gulai matang? Bawa piring ke <b>kuali</b> untuk mengambilnya.', t9: 'Antar ke <b>loket</b> untuk menyajikan!', t10: 'Pesanan baru: <b>Sambal Ijo</b>! Ambil cabai, taruh di <b>cobek</b>, lalu Proses.',
    t11: 'Piring + nasi + sambal ijo → <b>loket</b>.', tEnd: 'Mantap, Uda/Uni! Siap buka warung beneran?', tEndGo: 'Mulai Shift Pagi'
  },
  en: {
    paused: 'Paused', tagline: 'Cook together, panic together!', lead: 'Co-op cooking for 1–4 players. Chop fish and beef, grind green sambal, cook gulai and rendang, serve with rice before customers rage.',
    youTitle: 'You', name: 'Chef name', namePh: 'Your name', practiceTitle: 'Practice (offline)', practiceSub: 'Same kitchen, relaxed pace. Works offline.', shift: 'Shift', sh0: 'Morning', sh1: 'Noon', sh2: 'Busy Night',
    practiceGo: 'Start practice', tutGo: 'Play tutorial', onlineTitle: 'Play together (1–4 chefs)', onlineSub: 'One kitchen, one team score. Chat and quick shouts.',
    createPub: 'Create public room', createPriv: 'Create private room', match: 'Quick match', codePh: 'CODE', join: 'Join', howTitle: 'How to play', terms: 'Terms & Conditions',
    roomCode: 'Room code', invite: 'Invite friends', leave: 'Leave', players: 'Chefs', start: 'Open the restaurant!', you: 'you', host: 'host',
    visPub: 'Public room: anyone can join via Quick match.', visPriv: 'Private room: join with the code or invite link.', waitHost: 'Waiting for the host…', spectating: 'You are watching.',
    exit: '✕ Exit', pause: '⏸', resume: '▶', skip: 'Skip', keys: 'Forward/back: W/S · Turn: A/D or Q/E (hold = keep turning) · Camera always behind the chef, drag = look around, wheel = zoom · Pick/Drop: Space · Process: F or J · Chat: Enter · Shout: 1–6',
    kSpace: 'Space', rotT: 'Turn your phone sideways 🔄', rotP: 'Play in landscape: left thumb to walk, right thumb for actions, like a handheld console.', rotGo: 'Fullscreen', rotSkip: 'Stay portrait', grab: 'Pick/Drop', work: 'Process', send: 'Send', chatPh: 'Type a message…', bookTitle: '📖 Recipe book', soundOn: '🔊', soundOff: '🔇',
    nextShift: 'Next shift', again: 'Replay shift', toLobby: 'To lobby', menu: 'Menu', gameOver: 'Kitchen closed!', tutDone: 'Tutorial complete!', waitAgain: 'Waiting for the host…', copied: 'Invite link copied!',
    exitConfirm: 'Leave the kitchen?', errName: 'Enter a chef name first.', errCode: 'Room code is 6 letters.', errNet: 'Connection problem, try again.', errBusy: 'Server busy, wait {s} s.',
    errMissing: 'Room not found.', errGeneric: 'Failed: {msg}', errFull: 'Room is full/playing, you joined as a spectator.', onlineOff: 'Online play only on dapurpadang3d.jadidaring.com. Practice still works.',
    onlineDown: 'The online server is unreachable. Practice still works.', roomGone: 'The room was closed.', hostTook: 'You are now the kitchen host.', netHost: 'You are host', netClient: 'Online',
    gmTitle: 'All lobbies (GM)', gmRefresh: 'Refresh', gmLoading: 'Loading…', gmEmpty: 'No active lobbies.', gmCount: '{n} active lobbies', gmErr: 'Load failed: {msg}', gmPrivate: 'Private', gmPublic: 'Public',
    gmPlaying: 'Playing', gmWaiting: 'Waiting', gmPlayers: '{n}/{max} chefs · {w} watching', gmJoin: 'Join', gmWatch: 'Watch',
    best: 'Best {s}: {v} 🪙', bestNone: 'No record yet.', served: 'Served', tips: 'Tips', expired: 'Customers lost', burned: 'Burnt', streakBest: 'Best streak',
    stars: 'Stars: {a} / {b} / {c}', newBest: 'New record!', mvp: 'served', shiftName: 'Shift {n}', tutName: 'Tutorial', chatSys: '{n} joined the kitchen', chatLeft: '{n} left',
    chatSlow: 'Slow down, one message per second.', solo: 'Practice', tip1: 'Tip: stick up = walk, left/right = keep turning. The camera stays behind your chef. Holding a dish? Grab a plate to plate it straight away!',
    h_raw: 'Chop it on the cutting board first 🔪', h_rawC: 'Grind chili in the mortar first 🪨', h_noPot: 'That does not go in the pot', h_noMatch: 'Does not match the pot (see 📖)',
    h_potBusy: 'The pot is busy', h_notYet: 'Not cooked yet…', h_burnt: 'Burnt! Press Process to clean', h_needPlate: 'Use a plate first 🍽️', h_empty: 'The plate is empty',
    h_wrong: 'No order like this (check the tickets)', h_plateNo: 'Cannot add to this plate', h_useCobek: 'Grind chili in the mortar', h_useTalenan: 'Chop beef/fish on the board',
    h_nothing: 'Put an ingredient here first', h_workHint: 'Put it on a board/mortar, then Process', h_cooking: 'Cooking…', h_noWork: 'Nothing to process',
    g_putBack: 'Put back', g_addNasi: 'Add rice', g_toPot: 'Add to pot', g_scoop: 'Take dish', g_serve: 'Serve!', g_trash: 'Trash', g_pick: 'Pick up', g_drop: 'Put down', g_plate: 'Combine', g_toPlate: 'Take plate', g_take: 'Take {x}',
    w_chop: 'Chop', w_grind: 'Grind', w_clean: 'Clean',
    i_daging: 'beef', i_dagingP: 'chopped beef', i_ikan: 'fish', i_ikanP: 'chopped fish', i_cabai: 'chili', i_sambal: 'green sambal', i_santan: 'coconut milk', i_bumbu: 'spices', i_nasi: 'rice', i_plate: 'plate', i_rendang: 'rendang', i_gulai: 'gulai',
    m_gulai: 'Rice + Fish Gulai', m_sambal: 'Rice + Green Sambal', m_rendang: 'Rice + Rendang', m_komplit: 'Rendang Combo', m_gulaiS: 'Gulai Combo',
    f_serve: '+{v}', f_burn: 'Burnt! −{v}', f_exp: 'Customer stormed off! −{v}', f_done: 'Done!', f_streak: 'Streak ×{v}!',
    how1: '<b>Grab</b> from crates: fish, beef, chili, coconut milk, spices.', how2: '<b>Prep</b>: chop fish & beef on the board, grind chili in the mortar (Process).',
    how3: '<b>Cook</b> in the pot: chopped fish + coconut milk = gulai; chopped beef + spices + coconut milk = rendang. Do not burn it!',
    how4: '<b>Serve</b>: plate + rice + dish → window. Fast = big tips, in order = streak.',
    t1: 'Take a <b>fish</b> from the crate (✋ button).', t2: 'Put the fish on the <b>cutting board</b>.', t3: 'Press <b>Process 🔪</b> at the board to chop.', t4: 'Pick up the chopped fish, put it in a <b>pot</b>.',
    t5: 'Take <b>coconut milk</b>, add it to the pot. Gulai is cooking!', t6: 'Meanwhile: grab a <b>plate</b>.', t7: 'Fill the plate with <b>rice</b> from the rice cooker.',
    t8: 'Gulai done? Bring the plate to the <b>pot</b> to scoop it.', t9: 'Take it to the <b>serving window</b>!', t10: 'New order: <b>Green Sambal</b>! Take a chili, put it in the <b>mortar</b>, then Process.',
    t11: 'Plate + rice + green sambal → <b>window</b>.', tEnd: 'Great job, chef! Ready to open for real?', tEndGo: 'Start Morning Shift'
  }
};
function T(k, v) { let s = (STR[lang] && STR[lang][k] != null) ? STR[lang][k] : (STR.id[k] != null ? STR.id[k] : k); if (v) s = String(s).replace(/\{(\w+)\}/g, (m, x) => v[x] != null ? v[x] : m); return s; }
const shiftLabel = sh => sh === 'tut' ? T('tutName') : T('sh' + (sh | 0));
function applyLang() {
  doc.documentElement.lang = lang;
  doc.querySelectorAll('[data-t]').forEach(e => { e.innerHTML = T(e.dataset.t); });
  doc.querySelectorAll('[data-tp]').forEach(e => { e.placeholder = T(e.dataset.tp); });
  doc.querySelectorAll('[data-c]').forEach(e => { e.textContent = SITE[e.dataset.c] || ''; });
  doc.querySelectorAll('.lb').forEach(b => b.classList.toggle('on', b.dataset.lang === lang));
  $('termsLink').href = SITE.termsUrl || '/syarat-ketentuan'; $('hubLink').href = SITE.gameHubUrl || 'https://gamehub.jadidaring.com/';
  paintMute(); renderHow(); renderShouts(); renderBest(); renderBook(); if (room) renderRoom();
}
/* ---------- audio ---------- */
let actx = null;
function ac() { if (muted) return null; try { if (!actx) actx = new (root.AudioContext || root.webkitAudioContext)(); if (actx.state === 'suspended') actx.resume(); return actx; } catch (e) { return null; } }
function tone(f, ms, type = 'square', vol = 0.05, slide = 0, delay = 0) {
  const a = ac(); if (!a) return; const t = a.currentTime + delay / 1000, o = a.createOscillator(), g = a.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, f + slide), t + ms / 1000);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + ms / 1000); o.connect(g); g.connect(a.destination); o.start(t); o.stop(t + ms / 1000 + 0.02);
}
function noise(ms, vol = 0.05, hp = 800, delay = 0) {
  const a = ac(); if (!a) return; const n = Math.floor(a.sampleRate * ms / 1000), b = a.createBuffer(1, n, a.sampleRate), d = b.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n); const s = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain(), t = a.currentTime + delay / 1000;
  s.buffer = b; f.type = 'highpass'; f.frequency.value = hp; g.gain.value = vol; s.connect(f); f.connect(g); g.connect(a.destination); s.start(t);
}
const SFX = {
  pick: () => tone(520, 70, 'triangle', 0.06, 260), drop: () => tone(240, 80, 'triangle', 0.07, -80), chop: () => noise(40, 0.05, 2500), grind: () => tone(110, 70, 'sine', 0.1, -30),
  pot: () => { noise(220, 0.035, 1200); tone(300, 90, 'sine', 0.04, -100); }, cook: () => { noise(400, 0.04, 3000); }, done: () => { tone(880, 120, 'sine', 0.08); tone(1175, 180, 'sine', 0.08, 0, 130); },
  warn: () => tone(700, 90, 'square', 0.03), burn: () => { tone(160, 400, 'sawtooth', 0.06, -90); noise(300, 0.05, 400); },
  serve: () => { [784, 988, 1319].forEach((f, i) => tone(f, 110, 'triangle', 0.07, 0, i * 70)); }, wrong: () => tone(150, 160, 'square', 0.05),
  exp: () => { tone(220, 200, 'sawtooth', 0.05, -80); tone(180, 260, 'sawtooth', 0.05, -60, 160); }, bell: () => { tone(1500, 220, 'sine', 0.05); tone(1500, 220, 'sine', 0.04, 0, 140); },
  shout: () => tone(660, 90, 'square', 0.04, 220), chat: () => tone(990, 50, 'sine', 0.03), trash: () => noise(160, 0.05, 300), clean: () => noise(90, 0.04, 1800),
  win: () => { [523, 659, 784, 1047].forEach((f, i) => tone(f, 170, 'triangle', 0.08, 0, i * 120)); }, star: () => tone(1320, 160, 'sine', 0.07, 400)
};
function paintMute() { ['muteBtn', 'muteBtn2'].forEach(id => { const b = $(id); if (b) { b.textContent = muted ? T('soundOff') : T('soundOn'); b.setAttribute('aria-pressed', muted ? 'true' : 'false'); } }); }
/* ---------- small UI helpers ---------- */
const toastAt = {};
function toast(msg, kind = '', ms = 2400) { const el = doc.createElement('div'); el.className = 'toast ' + kind; el.textContent = msg; $('toasts').appendChild(el); setTimeout(() => el.remove(), ms); while ($('toasts').children.length > 3) $('toasts').firstChild.remove(); }
function hintToast(code) { const k = 'h_' + code; if (!STR.id[k]) return; const n = Date.now(); if (n - (toastAt[k] || 0) < 1800) return; toastAt[k] = n; toast(T(k), 'warn', 2000); }
function show(id) {
  ['home', 'lobby', 'game', 'end'].forEach(s => { $(s).hidden = s !== id; }); doc.documentElement.classList.toggle('jr-hub-off', id === 'game');
  const slot = id === 'lobby' ? 'lobbyChatSlot' : id === 'end' ? 'endChatSlot' : id === 'game' ? 'gameChatSlot' : null;
  $('chat').hidden = !slot || mode !== 'online'; if (slot && $(slot) && $('chat').parentNode !== $(slot)) $(slot).appendChild($('chat'));
  $('endChatSlot').hidden = mode !== 'online'; $('game').classList.toggle('solo', mode !== 'online');
  if (id === 'game') { fitBoard(); setTimeout(fitBoard, 60); } else { $('game').classList.remove('side-on'); if (id === 'home') leaveFs(); }
  if (id !== 'home') root.scrollTo(0, 0);
}
function seg(id, val, onPick) { const el = $(id); const paint = v => el.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.v === String(v))); paint(val); el.addEventListener('click', e => { const b = e.target.closest('button'); if (!b || el.classList.contains('ro')) return; paint(b.dataset.v); onPick(Number(b.dataset.v)); }); return paint; }
function bucket(cap, perSec) { let tokens = cap, at = Date.now(); return { take() { const n = Date.now(); tokens = Math.min(cap, tokens + (n - at) / 1000 * perSec); at = n; if (tokens >= 1) { tokens -= 1; return true; } return false; }, get n() { return tokens; } }; }
const myName = () => $('nameInput').value.replace(/\s+/g, ' ').trim().slice(0, 24);
const fmtT = ms => { const s = Math.max(0, Math.ceil(ms / 1000)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };

/* =====================================================================
   RENDERER (canvas). Kitchen units = tiles; TK tiles of order tickets on top.
   ===================================================================== */
const TK = 1.7, LIFT = 0.2;
function rr(g, x, y, w, h, r) { r = Math.min(r, w / 2, h / 2); g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
function circ(g, x, y, r) { g.beginPath(); g.arc(x, y, Math.max(0.1, r), 0, Math.PI * 2); }
function ell(g, x, y, rx, ry) { g.beginPath(); g.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), 0, 0, Math.PI * 2); }
/* --- items --- */
function drawBowl(g, x, y, r, fill, rim) { g.fillStyle = rim || '#3b6ea5'; ell(g, x, y + r * 0.25, r * 0.95, r * 0.6); g.fill(); g.fillStyle = fill; ell(g, x, y, r * 0.8, r * 0.42); g.fill(); }
function drawItem(g, it, x, y, r) {
  if (!it) return;
  if (D.isPlate(it)) return drawPlate(g, D.plateOf(it), x, y, r);
  g.save(); g.lineJoin = 'round'; g.lineCap = 'round';
  switch (it) {
    case 'daging': g.fillStyle = '#a3262a'; rr(g, x - r * 0.8, y - r * 0.55, r * 1.6, r * 1.1, r * 0.45); g.fill(); g.strokeStyle = '#f2c2b8'; g.lineWidth = r * 0.16; g.beginPath(); g.moveTo(x - r * 0.45, y - r * 0.1); g.quadraticCurveTo(x, y + r * 0.3, x + r * 0.5, y - r * 0.15); g.stroke(); break;
    case 'dagingP': for (const [dx, dy] of [[-0.45, 0.15], [0.4, 0.2], [0, -0.3]]) { g.fillStyle = '#8f2424'; rr(g, x + dx * r - r * 0.33, y + dy * r - r * 0.3, r * 0.66, r * 0.6, r * 0.15); g.fill(); g.fillStyle = '#c94a44'; g.fillRect(x + dx * r - r * 0.25, y + dy * r - r * 0.26, r * 0.5, r * 0.16); } break;
    case 'ikan': g.fillStyle = '#5f8fae'; ell(g, x - r * 0.1, y, r * 0.75, r * 0.42); g.fill(); g.beginPath(); g.moveTo(x + r * 0.55, y); g.lineTo(x + r * 1.0, y - r * 0.4); g.lineTo(x + r * 1.0, y + r * 0.4); g.closePath(); g.fill(); g.fillStyle = '#cfe3ee'; ell(g, x - r * 0.15, y + r * 0.12, r * 0.5, r * 0.18); g.fill(); g.fillStyle = '#111'; circ(g, x - r * 0.55, y - r * 0.08, r * 0.09); g.fill(); break;
    case 'ikanP': for (const dx of [-0.42, 0.42]) { g.fillStyle = '#f0a99a'; rr(g, x + dx * r - r * 0.34, y - r * 0.4, r * 0.68, r * 0.8, r * 0.25); g.fill(); g.strokeStyle = '#8fb3c9'; g.lineWidth = r * 0.12; g.stroke(); } break;
    case 'cabai': g.strokeStyle = '#2f8f3a'; g.lineWidth = r * 0.42; g.beginPath(); g.moveTo(x - r * 0.75, y + r * 0.25); g.quadraticCurveTo(x, y - r * 0.55, x + r * 0.7, y + r * 0.05); g.stroke(); g.strokeStyle = '#7bc96f'; g.lineWidth = r * 0.12; g.beginPath(); g.moveTo(x - r * 0.45, y + r * 0.02); g.quadraticCurveTo(x, y - r * 0.38, x + r * 0.4, y - r * 0.08); g.stroke(); g.strokeStyle = '#6b4a1e'; g.lineWidth = r * 0.14; g.beginPath(); g.moveTo(x + r * 0.7, y + r * 0.05); g.lineTo(x + r * 0.95, y - r * 0.2); g.stroke(); break;
    case 'sambal': drawBowl(g, x, y, r, '#4c9a2a', '#6d6d6d'); g.fillStyle = '#7fc85a'; for (const [dx, dy] of [[-0.3, -0.05], [0.2, 0.05], [0, -0.15]]) { circ(g, x + dx * r, y + dy * r, r * 0.15); g.fill(); } break;
    case 'santan': g.fillStyle = '#6b4226'; circ(g, x, y, r * 0.78); g.fill(); g.fillStyle = '#fffaf0'; circ(g, x, y, r * 0.56); g.fill(); g.fillStyle = '#e8e0cc'; circ(g, x + r * 0.15, y + r * 0.12, r * 0.2); g.fill(); break;
    case 'bumbu': drawBowl(g, x, y, r, '#e0752b', '#9a5b2a'); g.fillStyle = '#ffb347'; circ(g, x - r * 0.2, y - r * 0.05, r * 0.16); g.fill(); g.fillStyle = '#3c8d2f'; ell(g, x + r * 0.35, y - r * 0.25, r * 0.3, r * 0.12); g.fill(); break;
    case 'nasi': drawBowl(g, x, y + r * 0.1, r, '#fff', '#3b6ea5'); g.fillStyle = '#fff'; ell(g, x, y - r * 0.05, r * 0.62, r * 0.45); g.fill(); g.fillStyle = '#e9eef2'; circ(g, x + r * 0.2, y, r * 0.12); g.fill(); break;
    case 'rendang': case 'gulai': drawPlate(g, [it], x, y, r); break;
  }
  g.restore();
}
function drawPlate(g, a, x, y, r) {
  g.save(); g.fillStyle = 'rgba(0,0,0,.18)'; ell(g, x, y + r * 0.18, r * 1.0, r * 0.62); g.fill();
  g.fillStyle = '#fbfbfb'; ell(g, x, y, r * 1.0, r * 0.62); g.fill(); g.strokeStyle = '#d4d8dd'; g.lineWidth = Math.max(1, r * 0.08); g.stroke();
  g.fillStyle = '#eef1f4'; ell(g, x, y, r * 0.72, r * 0.42); g.fill();
  const has = k => a.includes(k);
  if (has('gulai')) { g.fillStyle = '#f0a020'; ell(g, x + r * 0.22, y + r * 0.02, r * 0.5, r * 0.3); g.fill(); g.fillStyle = '#ffd36b'; ell(g, x + r * 0.1, y - r * 0.05, r * 0.2, r * 0.08); g.fill(); g.fillStyle = '#e9a090'; rr(g, x + r * 0.2, y - r * 0.1, r * 0.3, r * 0.22, r * 0.08); g.fill(); }
  if (has('rendang')) { for (const [dx, dy] of [[0.12, -0.08], [0.42, 0.05], [0.25, 0.18]]) { g.fillStyle = '#4a2512'; rr(g, x + dx * r - r * 0.17, y + dy * r - r * 0.13, r * 0.34, r * 0.26, r * 0.08); g.fill(); } g.fillStyle = '#7a3a14'; ell(g, x + r * 0.28, y + r * 0.02, r * 0.1, r * 0.05); g.fill(); }
  if (has('nasi')) { g.fillStyle = '#fff'; ell(g, x - r * 0.33, y - r * 0.08, r * 0.36, r * 0.26); g.fill(); g.strokeStyle = '#e2e6ea'; g.lineWidth = Math.max(1, r * 0.05); g.stroke(); }
  if (has('sambal')) { g.fillStyle = '#3f8f26'; ell(g, x - r * 0.05 + (has('gulai') || has('rendang') ? 0 : r * 0.2), y + r * 0.22, r * 0.24, r * 0.13); g.fill(); g.fillStyle = '#86d160'; circ(g, x + (has('gulai') || has('rendang') ? -r * 0.08 : r * 0.12), y + r * 0.19, r * 0.06); g.fill(); }
  g.restore();
}
const RAW_OF = { gulai: ['ikan', 'santan'], rendang: ['daging', 'bumbu', 'santan'], sambal: ['cabai'], nasi: ['nasi'] };
function menuIngredients(m) { const def = D.CFG.menu[m]; if (!def) return []; const out = []; for (const c of def.p) for (const x of RAW_OF[c] || []) if (!out.includes(x)) out.push(x); return out; }
/* --- stations --- */
function stationTop(g, s, px, py, ts, hl) {
  const top = py - LIFT * ts;
  g.fillStyle = '#c99a63'; g.fillRect(px, top, ts, ts); g.fillStyle = '#e8c48f'; g.fillRect(px + 1, top + 1, ts - 2, ts - 2);
  g.strokeStyle = 'rgba(120,70,30,.25)'; g.lineWidth = 1; g.strokeRect(px + 0.5, top + 0.5, ts - 1, ts - 1);
  if (hl) { g.save(); g.strokeStyle = '#ffe14d'; g.lineWidth = Math.max(2, ts * 0.09); g.shadowColor = '#fff3a0'; g.shadowBlur = ts * 0.35; g.strokeRect(px + 2, top + 2, ts - 4, ts - 4); g.restore(); }
}
function stationFront(g, px, py, ts, col) { g.fillStyle = col || '#8a5a32'; g.fillRect(px, py + ts - LIFT * ts, ts, LIFT * ts); g.fillStyle = 'rgba(0,0,0,.12)'; g.fillRect(px, py + ts - LIFT * ts, ts, 2); }
function drawStation(g, sim, s, px, py, ts, now, hl, fx) {
  const cx = px + ts / 2, cy = py + ts / 2 - LIFT * ts, r = ts * 0.32, c = s.c;
  const below = sim.stAt(s.x, s.y + 1); if (!below) stationFront(g, px, py, ts, c === 'L' ? '#7a1f14' : CRATE_COL[c] ? '#6b4226' : '#8a5a32');
  stationTop(g, s, px, py, ts, hl);
  if (D.CRATE[c]) { g.fillStyle = '#a56a35'; g.fillRect(px + ts * 0.08, cy - ts * 0.4, ts * 0.84, ts * 0.8); g.strokeStyle = '#6b4226'; g.lineWidth = Math.max(1, ts * 0.05); for (let k = 1; k < 3; k++) { g.beginPath(); g.moveTo(px + ts * 0.08, cy - ts * 0.4 + k * ts * 0.27); g.lineTo(px + ts * 0.92, cy - ts * 0.4 + k * ts * 0.27); g.stroke(); } g.strokeRect(px + ts * 0.08, cy - ts * 0.4, ts * 0.84, ts * 0.8); g.fillStyle = CRATE_COL[c]; circ(g, cx, cy, ts * 0.32); g.fill(); drawItem(g, D.CRATE[c], cx, cy, r * 0.85); }
  else if (c === 'N') { g.fillStyle = '#f4f4f4'; rr(g, cx - ts * 0.36, cy - ts * 0.3, ts * 0.72, ts * 0.62, ts * 0.18); g.fill(); g.fillStyle = '#e86a8a'; ell(g, cx, cy - ts * 0.22, ts * 0.33, ts * 0.14); g.fill(); g.fillStyle = '#5fc05f'; circ(g, cx + ts * 0.2, cy + ts * 0.14, ts * 0.05); g.fill(); g.fillStyle = '#ffffff'; for (let k = 0; k < 2; k++) { const t = (now / 900 + k * 0.5 + s.x) % 1; g.globalAlpha = 0.5 * (1 - t); circ(g, cx - ts * 0.1 + k * ts * 0.18, cy - ts * 0.35 - t * ts * 0.4, ts * (0.06 + t * 0.06)); g.fill(); } g.globalAlpha = 1; }
  else if (c === 'P') { for (let k = 0; k < 3; k++) { g.fillStyle = '#fff'; ell(g, cx, cy + ts * 0.12 - k * ts * 0.09, ts * 0.36, ts * 0.17); g.fill(); g.strokeStyle = '#c9cfd6'; g.lineWidth = 1; g.stroke(); } }
  else if (c === 'T') { g.fillStyle = '#d9a86b'; rr(g, cx - ts * 0.4, cy - ts * 0.3, ts * 0.8, ts * 0.6, ts * 0.1); g.fill(); g.strokeStyle = '#a8773f'; g.lineWidth = 1; g.stroke(); g.fillStyle = '#9aa4ad'; g.fillRect(cx + ts * 0.18, cy - ts * 0.38, ts * 0.06, ts * 0.3); g.fillStyle = '#3b2416'; g.fillRect(cx + ts * 0.17, cy - ts * 0.44, ts * 0.08, ts * 0.1); }
  else if (c === 'U') { g.fillStyle = '#5c5c5c'; ell(g, cx, cy + ts * 0.04, ts * 0.38, ts * 0.27); g.fill(); g.fillStyle = '#3d3d3d'; ell(g, cx, cy, ts * 0.28, ts * 0.17); g.fill(); g.fillStyle = '#777'; g.save(); g.translate(cx + ts * 0.2, cy - ts * 0.16); g.rotate(0.7); rr(g, -ts * 0.06, -ts * 0.18, ts * 0.12, ts * 0.32, ts * 0.06); g.fill(); g.restore(); }
  else if (c === 'K') drawStove(g, s, cx, cy, ts, now, fx);
  else if (c === 'L') { g.fillStyle = '#fff3d6'; g.fillRect(px + ts * 0.06, cy - ts * 0.38, ts * 0.88, ts * 0.76); for (let k = 0; k < 4; k++) { g.fillStyle = k % 2 ? '#fff' : '#c62828'; g.fillRect(px + ts * 0.06 + k * ts * 0.22, cy - ts * 0.46, ts * 0.22, ts * 0.16); } g.fillStyle = '#f2b705'; circ(g, cx, cy + ts * 0.1, ts * 0.12); g.fill(); g.fillStyle = '#7a1f14'; g.font = '900 ' + Math.round(ts * 0.22) + 'px system-ui'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('⇨', cx, cy - ts * 0.12); }
  else if (c === 'X') { g.fillStyle = '#7d8a93'; rr(g, cx - ts * 0.28, cy - ts * 0.3, ts * 0.56, ts * 0.62, ts * 0.08); g.fill(); g.fillStyle = '#5c6870'; g.fillRect(cx - ts * 0.33, cy - ts * 0.36, ts * 0.66, ts * 0.1); g.fillStyle = '#fff'; g.font = '700 ' + Math.round(ts * 0.3) + 'px system-ui'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('♻', cx, cy + ts * 0.02); }
  if (s.it) { const bob = s.p > 0 ? Math.sin(now / 60) * ts * 0.02 : 0; drawItem(g, s.it, cx, cy + bob, r * (D.isPlate(s.it) ? 1.05 : 0.95)); }
  if (s.p > 0) bar(g, cx, cy - ts * 0.55, ts * 0.8, ts * 0.13, s.p, '#5bd16b');
}
const CRATE_COL = { D: '#f3c9c1', I: '#cfe3ee', H: '#d8efcf', M: '#f6ecd9', B: '#f7d9b5' };
function bar(g, x, y, w, h, p, col) { g.fillStyle = 'rgba(0,0,0,.55)'; rr(g, x - w / 2 - 1, y - 1, w + 2, h + 2, h / 2); g.fill(); g.fillStyle = col; rr(g, x - w / 2, y, Math.max(h, w * Math.min(1, p)), h, h / 2); g.fill(); }
const POT_COL = { ikanP: '#f0a99a', dagingP: '#8f2424', santan: '#fff8ea', bumbu: '#e0752b' };
function drawStove(g, s, cx, cy, ts, now, fx) {
  const pot = s.pot, C = D.CFG;
  g.fillStyle = '#3a3f45'; rr(g, cx - ts * 0.44, cy - ts * 0.42, ts * 0.88, ts * 0.84, ts * 0.1); g.fill();
  if (pot.s === 1 || pot.s === 2) { for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2 + now / 300, fl = 0.8 + 0.2 * Math.sin(now / 70 + k); g.fillStyle = k % 2 ? '#ff9d2e' : '#ffd23f'; circ(g, cx + Math.cos(a) * ts * 0.34, cy + Math.sin(a) * ts * 0.3, ts * 0.07 * fl); g.fill(); } }
  g.fillStyle = '#16181b'; ell(g, cx, cy, ts * 0.36, ts * 0.3); g.fill(); g.fillStyle = '#2a2d31'; ell(g, cx, cy - ts * 0.02, ts * 0.29, ts * 0.22); g.fill();
  g.fillStyle = '#16181b'; g.fillRect(cx + ts * 0.32, cy - ts * 0.05, ts * 0.14, ts * 0.08);
  if (pot.c.length) {
    let col;
    if (pot.s === 3) col = '#1a1110';
    else if (pot.s === 2) col = pot.r === 'rendang' ? '#4a2512' : '#f0a020';
    else if (pot.s === 1) { const p = pot.t / (C.recipes[pot.r].cook * 1000), from = pot.r === 'rendang' ? [200, 120, 70] : [250, 220, 170], to = pot.r === 'rendang' ? [74, 37, 18] : [240, 160, 32]; col = 'rgb(' + from.map((v, i) => Math.round(v + (to[i] - v) * p)).join(',') + ')'; }
    else col = POT_COL[pot.c[pot.c.length - 1]] || '#fff8ea';
    g.fillStyle = col; ell(g, cx, cy - ts * 0.02, ts * 0.25, ts * 0.18); g.fill();
    if (pot.s === 0) pot.c.forEach((x, i) => { g.fillStyle = POT_COL[x]; circ(g, cx - ts * 0.12 + i * ts * 0.12, cy - ts * 0.02, ts * 0.06); g.fill(); });
    if (pot.s === 1) { g.fillStyle = 'rgba(255,255,255,.45)'; for (let k = 0; k < 3; k++) { const t = (now / 500 + k / 3) % 1; circ(g, cx - ts * 0.12 + k * ts * 0.12, cy - ts * 0.02, ts * 0.04 * t); g.fill(); } }
  }
  if (pot.s === 0 && pot.c.length) { const need = needList(pot.c); need.forEach((x, i) => { const ix = cx - (need.length - 1) * ts * 0.17 + i * ts * 0.34, iy = cy - ts * 0.62; g.fillStyle = 'rgba(255,255,255,.85)'; circ(g, ix, iy, ts * 0.17); g.fill(); g.globalAlpha = 0.85; drawItem(g, x, ix, iy, ts * 0.12); g.globalAlpha = 1; }); }
  if (pot.s === 1) bar(g, cx, cy - ts * 0.58, ts * 0.8, ts * 0.13, pot.t / (C.recipes[pot.r].cook * 1000), '#ffcc33');
  if (pot.s === 2) { const warn = pot.t > C.warnAfter * 1000, blink = warn && Math.floor(now / (pot.t > (C.burnAfter - 3) * 1000 ? 120 : 250)) % 2;
    g.fillStyle = warn ? (blink ? '#ff3b30' : '#ffcc00') : '#3ac25e'; circ(g, cx, cy - ts * 0.6, ts * 0.17); g.fill(); g.fillStyle = '#fff'; g.font = '900 ' + Math.round(ts * 0.24) + 'px system-ui'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(warn ? '!' : '✓', cx, cy - ts * 0.6 + 1);
    if (warn) bar(g, cx, cy - ts * 0.38, ts * 0.7, ts * 0.08, 1 - (pot.t - C.warnAfter * 1000) / ((C.burnAfter - C.warnAfter) * 1000), '#ff3b30'); }
  if (pot.s === 3) { g.fillStyle = '#fff'; g.font = '900 ' + Math.round(ts * 0.3) + 'px system-ui'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('☠', cx, cy - ts * 0.02); if (s.p > 0) bar(g, cx, cy - ts * 0.58, ts * 0.8, ts * 0.13, s.p, '#5bd16b'); }
  if (fx && (pot.s === 1 || pot.s === 2) && Math.random() < 0.06) fx.puff(s.x + 0.5, s.y + 0.3 - LIFT, '#ffffff', 0.5);
  if (fx && pot.s === 3 && Math.random() < 0.15) fx.puff(s.x + 0.5, s.y + 0.3 - LIFT, '#333333', 0.8);
}
function needList(c) { for (const k in D.CFG.recipes) { const r = D.CFG.recipes[k].c; if (c.every(x => r.includes(x))) { const rest = r.filter(x => !c.includes(x)); if (rest.length) return rest; } } return []; }
/* --- chefs --- */
function drawChef(g, ch, x, y, ts, now, opt) {
  const col = D.COLORS[ch.c % 4], r = ts * 0.33, sp = Math.hypot(ch.vx || 0, ch.vy || 0), bob = sp > 0.3 ? Math.abs(Math.sin(now / 90)) * ts * 0.05 : 0, f = ch.f || 0, fx = Math.cos(f), fy = Math.sin(f);
  g.fillStyle = 'rgba(0,0,0,.22)'; ell(g, x, y + r * 0.75, r * 0.95, r * 0.4); g.fill();
  if (opt.me) { g.strokeStyle = 'rgba(255,255,255,.85)'; g.lineWidth = Math.max(1.5, ts * 0.05); g.setLineDash([ts * 0.08, ts * 0.06]); ell(g, x, y + r * 0.75, r * 1.05, r * 0.45); g.stroke(); g.setLineDash([]); }
  const by = y - bob;
  g.fillStyle = col; circ(g, x, by, r); g.fill(); g.strokeStyle = 'rgba(0,0,0,.25)'; g.lineWidth = 1.5; g.stroke();
  g.fillStyle = '#fff'; ell(g, x, by + r * 0.35, r * 0.62, r * 0.45); g.fill(); // apron
  g.fillStyle = '#ffe0bd'; circ(g, x + fx * r * 0.15, by - r * 0.35 + fy * r * 0.1, r * 0.55); g.fill(); // face
  g.fillStyle = '#fff'; ell(g, x, by - r * 0.95, r * 0.52, r * 0.22); g.fill(); circ(g, x - r * 0.25, by - r * 1.15, r * 0.25); g.fill(); circ(g, x + r * 0.25, by - r * 1.15, r * 0.25); g.fill(); circ(g, x, by - r * 1.25, r * 0.28); g.fill(); // toque
  g.strokeStyle = 'rgba(0,0,0,.12)'; g.lineWidth = 1; ell(g, x, by - r * 0.95, r * 0.52, r * 0.22); g.stroke();
  const ex = x + fx * r * 0.32, ey = by - r * 0.38 + fy * r * 0.18; g.fillStyle = '#2b1a10'; circ(g, ex - r * 0.16, ey, r * 0.07); g.fill(); circ(g, ex + r * 0.16, ey, r * 0.07); g.fill();
  if (opt.work) { const a = Math.sin(now / 45) * 0.8; g.save(); g.translate(x + fx * r * 0.8, by + fy * r * 0.5); g.rotate(f + a); g.fillStyle = '#c0c7ce'; g.fillRect(0, -ts * 0.03, ts * 0.28, ts * 0.06); g.fillStyle = '#3b2416'; g.fillRect(-ts * 0.08, -ts * 0.035, ts * 0.1, ts * 0.07); g.restore(); }
  if (ch.h) { const hx = x + fx * r * 0.85, hy = by + fy * r * 0.55 + r * 0.05; g.fillStyle = '#ffe0bd'; circ(g, hx - r * 0.45, hy + r * 0.1, r * 0.16); g.fill(); circ(g, hx + r * 0.45, hy + r * 0.1, r * 0.16); g.fill(); drawItem(g, ch.h, hx, hy, ts * (D.isPlate(ch.h) ? 0.3 : 0.26)); }
  if (opt.name) { g.font = '800 ' + Math.max(10, Math.round(ts * 0.3)) + 'px system-ui'; g.textAlign = 'center'; g.textBaseline = 'bottom'; const nm = opt.name, w = g.measureText(nm + (opt.gm ? ' (GM)' : '')).width; g.fillStyle = 'rgba(0,0,0,.55)'; rr(g, x - w / 2 - 5, by - r * 1.62 - ts * 0.32, w + 10, ts * 0.34, ts * 0.12); g.fill(); g.fillStyle = '#fff'; g.textAlign = 'left'; g.fillText(nm, x - w / 2, by - r * 1.62); if (opt.gm) { g.fillStyle = '#ff5a52'; g.fillText(' (GM)', x - w / 2 + g.measureText(nm).width, by - r * 1.62); } }
  if (opt.bubble) { const t = opt.bubble; g.font = '800 ' + Math.max(11, Math.round(ts * 0.34)) + 'px system-ui'; const w = Math.min(ts * 5, g.measureText(t).width + 14), bx = x - w / 2, byy = by - r * 1.7 - ts * (opt.name ? 0.95 : 0.6); g.fillStyle = '#fff'; rr(g, bx, byy, w, ts * 0.5, ts * 0.18); g.fill(); g.beginPath(); g.moveTo(x - 5, byy + ts * 0.5); g.lineTo(x + 5, byy + ts * 0.5); g.lineTo(x, byy + ts * 0.66); g.fill(); g.fillStyle = '#2b1a10'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(t, x, byy + ts * 0.26, w - 8); }
}
/* --- particles / floating text --- */
function makeFx() {
  /* particles live in 3D: x, z on the floor plan, h = height. Old 2D call sites pass (x, y) with y = tile y - LIFT, so z = y + LIFT. */
  const P = [], F = [];
  return {
    P, F, shake: 0,
    puff(x, y, col, s = 0.6) { this.puff3(x, 1.2, y + LIFT + 0.1, col, s); },
    puff3(x, h, z, col, s = 0.6) { P.push({ x, z, h, vx: (Math.random() - 0.5) * 0.25, vz: (Math.random() - 0.5) * 0.25, vh: 0.5 + Math.random() * 0.4, life: 1, d: 0.9 + Math.random() * 0.5, col, s, k: 'puff' }); },
    burst(x, y, cols, n = 14, sp = 3) { for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, v = sp * (0.2 + Math.random() * 0.5); P.push({ x, z: y + LIFT + 0.1, h: 1.15, vx: Math.cos(a) * v * 0.5, vz: Math.sin(a) * v * 0.5, vh: 1.4 + Math.random() * 2, life: 1, d: 0.7 + Math.random() * 0.5, col: cols[i % cols.length], s: 0.05 + Math.random() * 0.05, k: 'bit', g: -6 }); } },
    text(x, y, t, col, big) { F.push({ x, z: Math.max(0.5, y + LIFT + 0.4), h: 1.7, t, col, life: 1, d: big ? 1.6 : 1.2, big }); },
    step(dt) { const s = dt / 1000; for (let i = P.length - 1; i >= 0; i--) { const p = P[i]; p.life -= s / p.d; if (p.life <= 0) { P.splice(i, 1); continue; } p.x += p.vx * s; p.z += p.vz * s; p.h += p.vh * s; if (p.g) p.vh += p.g * s; if (p.h < 0.92 && p.k === 'bit') { p.h = 0.92; p.vh = Math.abs(p.vh) * 0.3; } } for (let i = F.length - 1; i >= 0; i--) { const f = F[i]; f.life -= s / f.d; if (f.life <= 0) F.splice(i, 1); else f.h += 0.6 * s; } if (this.shake > 0) this.shake = Math.max(0, this.shake - s * 2.5); if (P.length > 260) P.splice(0, P.length - 260); },
    draw(g, ts, oy) { // 2D fallback only
      for (const p of P) { g.globalAlpha = Math.max(0, p.life) * (p.k === 'puff' ? 0.45 : 1); g.fillStyle = p.col; circ(g, p.x * ts, oy + (p.z - LIFT - (p.h - 1.15)) * ts, (p.k === 'puff' ? p.s * (1.6 - p.life) * 0.5 : p.s) * ts); g.fill(); }
      g.globalAlpha = 1;
      for (const f of F) { const sc = f.big ? 0.62 : 0.42; g.globalAlpha = Math.min(1, f.life * 2.5); g.font = '900 ' + Math.round(ts * sc) + 'px system-ui'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = f.col; g.fillText(f.t, f.x * ts, oy + (f.z - 0.6 - (f.h - 1.7)) * ts); }
      g.globalAlpha = 1;
    }
  };
}
/* --- tickets --- */
function drawTickets(g, sim, ts, wpx, now) {
  g.fillStyle = G3 ? 'rgba(90,46,23,.72)' : '#5a2e17'; g.fillRect(0, 0, wpx, TK * ts); g.fillStyle = G3 ? 'rgba(59,29,14,.72)' : '#3b1d0e'; g.fillRect(0, TK * ts - ts * 0.12, wpx, ts * 0.12);
  g.strokeStyle = '#2a140a'; g.lineWidth = 2; g.beginPath(); g.moveTo(0, ts * 0.18); g.lineTo(wpx, ts * 0.18); g.stroke();
  const mo = Math.max(3, sim.maxOrders()), tw = Math.min(ts * 2.9, (wpx - ts * 0.3) / mo - ts * 0.12), th = TK * ts - ts * 0.42;
  sim.orders.forEach((o, i) => {
    const ratio = Math.max(0, o.t / o.T), shakeX = ratio < 0.25 && !sim.tut ? Math.sin(now / 40 + i) * ts * 0.04 : 0, age = sim.tut ? 1 : Math.min(1, (o.T - o.t) / 400);
    const x = ts * 0.15 + i * (tw + ts * 0.12) + shakeX, y = ts * 0.22 - (1 - age) * ts * 1.2;
    g.save(); g.translate(x, y);
    g.fillStyle = '#fffaf0'; rr(g, 0, 0, tw, th, ts * 0.12); g.fill(); if (i === 0) { g.strokeStyle = '#f2b705'; g.lineWidth = Math.max(2, ts * 0.07); g.stroke(); }
    const pr = th * 0.3; drawPlate(g, D.CFG.menu[o.m].p, pr * 1.15, th * 0.42, pr);
    const ing = menuIngredients(o.m), ir = Math.min(ts * 0.15, (tw - pr * 2.5) / (ing.length * 2.4));
    ing.forEach((it, k) => { const ix = pr * 2.45 + ir * 1.2 + k * ir * 2.3, iy = th * 0.62; g.fillStyle = '#f1e4cf'; circ(g, ix, iy, ir * 1.1); g.fill(); drawItem(g, it, ix, iy, ir * 0.9); });
    g.font = (ratio < 0.25 ? '' : '') + Math.round(ts * 0.36) + 'px system-ui'; g.textAlign = 'right'; g.textBaseline = 'top'; g.fillText(sim.tut ? '😋' : ratio > 0.55 ? '😋' : ratio > 0.25 ? '😐' : '😡', tw - ts * 0.06, ts * 0.04);
    g.fillStyle = '#7a1f14'; g.font = '800 ' + Math.round(ts * 0.2) + 'px system-ui'; g.textAlign = 'left'; g.fillText(T('m_' + o.m), pr * 2.4, ts * 0.06, tw - pr * 2.4 - ts * 0.6);
    if (!sim.tut) bar(g, tw / 2, th - ts * 0.17, tw - ts * 0.2, ts * 0.1, ratio, ratio > 0.55 ? '#3ac25e' : ratio > 0.25 ? '#ffcc33' : '#ff3b30');
    g.restore();
  });
}
/* --- full scene --- */
function renderKitchen(cv, sim, o) {
  const g = cv.getContext('2d'), ts = o.ts, wpx = D.W * ts, oy = TK * ts, now = o.now, fx = o.fx;
  g.setTransform(o.dpr, 0, 0, o.dpr, 0, 0); g.clearRect(0, 0, wpx, (D.H + TK) * ts);
  if (fx && fx.shake > 0) g.translate((Math.random() - 0.5) * ts * 0.25 * fx.shake, (Math.random() - 0.5) * ts * 0.25 * fx.shake);
  for (let y = 0; y < D.H; y++) for (let x = 0; x < D.W; x++) { g.fillStyle = (x + y) % 2 ? '#f3dfbf' : '#fbecd2'; g.fillRect(x * ts, oy + y * ts, ts + 0.5, ts + 0.5); }
  g.fillStyle = 'rgba(122,31,20,.07)'; for (let y = 1; y < D.H - 1; y++) g.fillRect(ts, oy + y * ts, (D.W - 2) * ts, 1);
  const hl = new Set(o.hl || []), tutHl = new Set(o.tut || []), chefRows = [];
  for (const ch of sim.chefs) { const d = (o.disp && o.disp[ch.id]) || ch; chefRows.push({ ch, x: d.x, y: d.y }); }
  chefRows.sort((a, b) => a.y - b.y);
  let ci = 0;
  for (let y = 0; y < D.H; y++) {
    for (let x = 0; x < D.W; x++) { const s = sim.stAt(x, y); if (s) drawStation(g, sim, s, x * ts, oy + y * ts, ts, now, hl.has(s.i), fx); }
    while (ci < chefRows.length && chefRows[ci].y < y + 1) { const r = chefRows[ci++], meta = (o.meta && o.meta(r.ch)) || {}; drawChef(g, r.ch, r.x * ts, oy + r.y * ts, ts, now, meta); }
  }
  while (ci < chefRows.length) { const r = chefRows[ci++], meta = (o.meta && o.meta(r.ch)) || {}; drawChef(g, r.ch, r.x * ts, oy + r.y * ts, ts, now, meta); }
  for (const i of tutHl) { const s = sim.st[i]; if (!s) continue; const cx = (s.x + 0.5) * ts, cy = oy + (s.y + 0.5 - LIFT) * ts, b = Math.sin(now / 180) * ts * 0.12;
    g.save(); g.strokeStyle = '#ff3b30'; g.lineWidth = Math.max(2, ts * 0.08); g.globalAlpha = 0.6 + 0.4 * Math.sin(now / 150); g.strokeRect(s.x * ts + 1, oy + (s.y - LIFT) * ts + 1, ts - 2, ts - 2); g.globalAlpha = 1;
      const ay = s.y <= 1 ? cy + ts * 0.9 + b : cy - ts * 0.85 - b, dir = s.y <= 1 ? -1 : 1; g.fillStyle = '#ff3b30'; g.strokeStyle = '#fff'; g.lineWidth = 2; g.beginPath(); g.moveTo(cx, ay + dir * ts * 0.3); g.lineTo(cx - ts * 0.25, ay - dir * ts * 0.05); g.lineTo(cx - ts * 0.1, ay - dir * ts * 0.05); g.lineTo(cx - ts * 0.1, ay - dir * ts * 0.35); g.lineTo(cx + ts * 0.1, ay - dir * ts * 0.35); g.lineTo(cx + ts * 0.1, ay - dir * ts * 0.05); g.lineTo(cx + ts * 0.25, ay - dir * ts * 0.05); g.closePath(); g.fill(); g.stroke(); g.restore(); }
  if (fx) fx.draw(g, ts, oy);
  drawTickets(g, sim, ts, wpx, now);
}

/* =====================================================================
   STATE
   ===================================================================== */
let mode = null, sim = null, me = 1, paused = false, room = null, onlineOk = false, hostG = null, seenV = 0, endSent = false, starting = false, wasHost = null;
let lastEvN = 0, evG = null, lastFrame = 0, simAcc = 0, tut = null, soloShift = 0, ended = false;
const SIM_MS = 50, fx = makeFx(), disp = {};
let ss = null; try { ss = root.sessionStorage; } catch (e) { ss = null; }
const conn = new N.Connection({ storage: ss, onWake: () => { if (room) room.refresh(); }, onSocket: () => {}, lobbyWake: () => gmWake() });
const cv = $('board'), ov3 = $('ov3'); let TS = 40, DPR = 1;
const ART = { drawItem, bar, rr };
let G3 = null; try { G3 = root.R3 && R3.create(cv, ov3, ART); } catch (e) { G3 = null; if (root.console) console.warn('WebGL off', e); }
if (!G3) { doc.documentElement.classList.add('no3d'); }
function fitBoard() {
  const st = $('stage'); if (!st || $('game').hidden) return;
  if (G3) { const w = st.clientWidth, h = st.clientHeight; if (w < 50 || h < 50) return; G3.resize(w, h, Math.min(1.75, root.devicePixelRatio || 1)); return; }
  const w = st.clientWidth - 8, h = st.clientHeight - 8; if (w < 50 || h < 50) return;
  TS = Math.max(16, Math.floor(Math.min(w / D.W, h / (D.H + TK)) * 4) / 4); DPR = Math.min(2.5, root.devicePixelRatio || 1);
  const cw = Math.round(TS * D.W), ch = Math.round(TS * (D.H + TK)); cv.style.width = cw + 'px'; cv.style.height = ch + 'px'; cv.width = Math.round(cw * DPR); cv.height = Math.round(ch * DPR);
}
/* ---------- third-person camera ---------- */
const cam = { yaw: -Math.PI / 2, p: 0.7, eye: null, drag: false, lastDrag: 0 };
const wrapA = a => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };
function camReset(ch) { cam.hd = -Math.PI / 2; cam.look = 0; cam.yaw = -Math.PI / 2; cam.eye = null; cam.pe = null; if (ch) ch.f = -Math.PI / 2; }
const rigD = p => (p <= 1 ? 2.6 + 1.6 * p : 4.2 - (p - 1) * 4.6), rigH = p => (p <= 1 ? 1.1 + 2.9 * p : 4.0 + (p - 1) * 1.0); // past p=1 the camera swings overhead (anti-occlusion)
function camBlocked(x, z, p, cy, sy) { // would a counter hide the chef from this camera pitch?
  if (!sim) return false; const d = rigD(p), h = rigH(p);
  for (let q = 0.3; q <= d; q += 0.07) { const t = q / d; const py = 0.25 + (h - 0.25) * t; if (py > 0.98) break; const gx = Math.floor(x - cy * d * t), gz = Math.floor(z - sy * d * t);
    if (gx >= 0 && gz >= 0 && gx < D.W && gz < D.H && sim.grid[gz * D.W + gx] >= 0) return true; }
  return false; }
function camRig(x, z) { const cy = Math.cos(cam.yaw), sy = Math.sin(cam.yaw); let p = cam.p; while (p < 1.6 && camBlocked(x, z, p, cy, sy)) p = Math.min(1.6, p + 0.06);
  cam.pe = cam.pe == null ? p : cam.pe + (p - cam.pe) * 0.12; const d = rigD(cam.pe), h = rigH(cam.pe);
  return { eye: [x - cy * d, h, z - sy * d], at: [x + cy * 1.1, 0.75, z + sy * 1.1] }; }
const myChef = () => (sim ? sim.chef(me) : null);
/* ---------- input ---------- */
const keys = new Set(), joy = { x: 0, y: 0, on: false };
const KV = { ArrowUp: [0, -1], KeyW: [0, -1], ArrowDown: [0, 1], KeyS: [0, 1], ArrowLeft: [-1, 0], KeyA: [-1, 0], ArrowRight: [1, 0], KeyD: [1, 0] }, TURN = { KeyQ: -1, KeyE: 1, Comma: -1, Period: 1 };
function inputVec() { let x = joy.x, y = joy.y; for (const k of keys) { const v = KV[k]; if (v) { x += v[0]; y += v[1]; } } const m = Math.hypot(x, y); return m > 1 ? [x / m, y / m] : [x, y]; }
doc.addEventListener('keydown', e => {
  if ($('game').hidden) return; const inInput = e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA');
  if (inInput) { if (e.code === 'Escape') e.target.blur(); return; }
  if (!$('bookModal').hidden) { if (e.code === 'Escape' || e.code === 'KeyB') { e.preventDefault(); $('bookModal').hidden = true; } return; }
  if (KV[e.code] || TURN[e.code]) { e.preventDefault(); keys.add(e.code); return; }
  if (e.repeat) return;
  if (e.code === 'Space') { e.preventDefault(); press('g'); }
  else if (e.code === 'KeyF' || e.code === 'KeyJ' || e.code === 'ShiftLeft' || e.code === 'ShiftRight') { e.preventDefault(); press('w'); }
  else if (e.code === 'Enter' && mode === 'online') { e.preventDefault(); $('chatInput').focus(); }
  else if (/^Digit[1-8]$/.test(e.code) && mode === 'online') { e.preventDefault(); shout(Number(e.code.slice(5)) - 1); }
  else if (e.code === 'KeyB') { e.preventDefault(); openBook(); }
  else if ((e.code === 'KeyP' || e.code === 'Escape') && mode === 'solo') { e.preventDefault(); togglePause(); }
});
doc.addEventListener('keyup', e => { keys.delete(e.code); });
root.addEventListener('blur', () => { keys.clear(); joy.x = joy.y = 0; });
(function joystick() {
  const el = $('joy'), kn = $('knob'); let pid = null, cx = 0, cy = 0;
  const set = (x, y) => { const R = el.clientWidth / 2 - 10, dx = x - cx, dy = y - cy, d = Math.hypot(dx, dy), k = d > R ? R / d : 1; kn.style.transform = 'translate(' + dx * k + 'px,' + dy * k + 'px)'; const m = Math.min(1, d / R); joy.x = d > 6 ? dx / d * m : 0; joy.y = d > 6 ? dy / d * m : 0; if (m > 0.85) { joy.x = dx / d; joy.y = dy / d; } };
  el.addEventListener('pointerdown', e => { e.preventDefault(); pid = e.pointerId; try { el.setPointerCapture(pid); } catch (x) { /* old browsers */ } const r = el.getBoundingClientRect(); cx = r.left + r.width / 2; cy = r.top + r.height / 2; joy.on = true; set(e.clientX, e.clientY); ac(); });
  el.addEventListener('pointermove', e => { if (e.pointerId === pid) set(e.clientX, e.clientY); });
  const up = e => { if (pid != null && e.pointerId !== pid) return; pid = null; joy.on = false; joy.x = joy.y = 0; kn.style.transform = ''; };
  el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up); el.addEventListener('lostpointercapture', up);
})();
/* phones: try fullscreen + landscape lock (Android Chrome); iOS just gets the rotate hint */
const coarse = () => !!(root.matchMedia && root.matchMedia('(pointer:coarse)').matches);
let fsMine = false;
function goLandscape() {
  if (!coarse()) return; const de = doc.documentElement, so = root.screen && root.screen.orientation;
  const lock = () => { try { if (so && so.lock) so.lock('landscape').catch(() => {}); } catch (x) { /* unsupported */ } };
  try { if (!doc.fullscreenElement && de.requestFullscreen) de.requestFullscreen({ navigationUI: 'hide' }).then(() => { fsMine = true; lock(); setTimeout(fitBoard, 120); }).catch(lock); else lock(); } catch (x) { lock(); }
}
function leaveFs() { if (fsMine && doc.fullscreenElement && doc.exitFullscreen) doc.exitFullscreen().catch(() => {}); fsMine = false; }
$('rotGo').addEventListener('click', () => { goLandscape(); });
$('rotSkip').addEventListener('click', () => { $('game').classList.add('port-ok'); setTimeout(fitBoard, 30); });
$('sideBtn').addEventListener('click', () => { $('game').classList.toggle('side-on'); });
for (const [id, op] of [['grabBtn', 'g'], ['workBtn', 'w']]) {
  const b = $(id); b.addEventListener('pointerdown', e => { e.preventDefault(); b.classList.add('hit'); setTimeout(() => b.classList.remove('hit'), 120); press(op); });
  b.addEventListener('contextmenu', e => e.preventDefault()); b.addEventListener('click', e => { if (e.detail === 0) press(op); }); // keyboard activation
}
/* drag on the 3D view = turn the camera (mouse or finger); 2D fallback keeps tap-to-walk */
let tapGoal = null;
(function look() {
  const el = $('stage'); let pid = null, lx = 0, ly = 0, moved = 0;
  el.addEventListener('pointerdown', e => { if (e.target.closest('button,.tut,.overlay')) return; if (!sim || !myChef()) return;
    if (!G3) { const r = cv.getBoundingClientRect(), x = (e.clientX - r.left) / TS, y = (e.clientY - r.top) / TS - TK; if (y >= 0) tapGoal = [x, y]; return; }
    pid = e.pointerId; lx = e.clientX; ly = e.clientY; moved = 0; cam.drag = true; try { el.setPointerCapture(pid); } catch (x) { /* old browsers */ } });
  el.addEventListener('pointermove', e => { if (e.pointerId !== pid) return; const dx = e.clientX - lx, dy = e.clientY - ly; lx = e.clientX; ly = e.clientY; moved += Math.abs(dx) + Math.abs(dy);
    cam.look = wrapA((cam.look || 0) + dx * 0.0085); cam.p = Math.max(0.12, Math.min(1, cam.p - dy * 0.004)); cam.lastDrag = performance.now(); });
  const up = e => { if (e.pointerId !== pid) return; pid = null; cam.drag = false; };
  el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up); el.addEventListener('lostpointercapture', up);
  el.addEventListener('wheel', e => { if (!G3 || $('game').hidden) return; e.preventDefault(); cam.p = Math.max(0.12, Math.min(1, cam.p + e.deltaY * 0.001)); }, { passive: false });
})();
/* ---------- actions ---------- */
let opQ = 0, pend = [];
function press(op) {
  ac(); if (!sim || sim.over || paused) return; const ch = myChef(); if (!ch) return;
  const s = sim.target(ch); if (!s) { if (op === 'w' && ch.h && D.WORK.T[ch.h]) hintToast('workHint'); else if (op === 'w' && ch.h === 'cabai') hintToast('workHint'); return; }
  if (mode === 'online' && !room.isHost()) {
    if (pend.length >= 6) return; const q = ++opQ; pend.push([q, op, s.i]);
    const r = sim.apply(me, op, s.i); feedback(r, s, ch); ch.a = q; sendIn(true); return;
  }
  const r = sim.apply(me, op, s.i); feedback(r, s, ch); if (mode === 'online') hostDirty = true;
}
function feedback(r, s, ch) {
  switch (r) {
    case 'pick': case 'back': case 'plate': SFX.pick(); fx.burst(s.x + 0.5, s.y + 0.4 - LIFT, ['#fff', '#ffe07a'], 5, 1.5); break;
    case 'drop': SFX.drop(); break;
    case 'cook': SFX.pot(); setTimeout(SFX.cook, 120); fx.text(s.x + 0.5, s.y - 0.2, '🔥', '#fff'); break;
    case 'potAdd': SFX.pot(); break;
    case 'work': case 'clean': SFX.chop(); break;
    case 'far': case 'nop': break;
    case 'full': SFX.wrong(); break;
    default: if (STR.id['h_' + r]) { SFX.wrong(); hintToast(r); }
  }
  if (tut) tutCheck();
}
/* ---------- events (from the authoritative sim, or a received snapshot) ---------- */
function playEvents(ev, g, clientView) {
  if (g !== evG) { evG = g; lastEvN = 0; for (const e of ev || []) lastEvN = Math.max(lastEvN, e[0]); return; }
  for (const e of ev || []) {
    if (e[0] <= lastEvN) continue; lastEvN = e[0]; const k = e[1], s = sim && sim.st[e[2]], pid = e[3], v = e[4], mine = pid === me;
    const sx = s ? s.x + 0.5 : D.W / 2, sy = s ? s.y + 0.3 - LIFT : 1;
    if (k === 'new') { SFX.bell(); }
    else if (k === 'pot') { if (!(clientView && mine)) SFX.pot(); for (let i = 0; i < 4; i++) fx.puff(sx, sy, '#fff', 0.5); }
    else if (k === 'dish') { if (!(clientView && mine)) SFX.pick(); fx.burst(sx, sy, ['#ffd36b', '#fff', '#f0a020'], 10, 2); }
    else if (k === 'serve') { SFX.serve(); fx.burst(sx, sy, ['#f2b705', '#e4572e', '#3aa857', '#2e86de', '#fff'], 26, 4); fx.text(sx - 0.6, sy - 0.2, T('f_serve', { v }), '#ffe07a', true); fx.shake = Math.max(fx.shake, 0.25); if (sim && sim.streak >= 2) setTimeout(() => fx.text(sx - 1.2, sy - 0.9, T('f_streak', { v: Math.min(3, 1 + 0.5 * (sim.streak - 1)).toFixed(1).replace('.0', '') }), '#ff9d2e'), 300); }
    else if (k === 'exp') { SFX.exp(); fx.text(D.W / 2, 0.8, T('f_exp', { v: D.CFG.expirePenalty }), '#ff6b5b', true); fx.shake = Math.max(fx.shake, 0.6); }
    else if (k === 'done') { SFX.done(); fx.text(sx, sy - 0.4, T('f_done'), '#7dff8a'); fx.burst(sx, sy, ['#ffe07a', '#fff'], 8, 1.6); }
    else if (k === 'burn') { SFX.burn(); for (let i = 0; i < 12; i++) fx.puff(sx + (Math.random() - 0.5) * 0.6, sy, '#222', 1.1); fx.text(sx, sy - 0.4, T('f_burn', { v: D.CFG.burnPenalty }), '#ff6b5b', true); fx.shake = Math.max(fx.shake, 0.7); }
    else if (k === 'chop') { SFX.drop(); fx.burst(sx, sy, s && s.c === 'U' ? ['#4c9a2a', '#86d160'] : ['#f0a99a', '#c94a44', '#fff'], 10, 2.2); fx.text(sx, sy - 0.3, '✓', '#7dff8a'); }
    else if (k === 'clean') { SFX.clean(); fx.burst(sx, sy, ['#bfefff', '#fff'], 12, 2); }
    else if (k === 'trash') { if (!(clientView && mine)) SFX.trash(); }
    else if (k === 'end') { /* end screen plays its own fanfare */ }
  }
}
/* ---------- shouts (bubbles above chefs) ---------- */
const bubbles = {}; let shoutSeq = 0, shoutAt = 0;
function showBubble(pid, idx) { const sh = SHOUTS[idx]; if (!sh) return; bubbles[pid] = { t: (sh.icon || '') + ' ' + (sh[lang] || sh.id), until: performance.now() + 2600 }; SFX.shout(); addChatLine({ k: 'sh' + Date.now() + pid, p: pid, n: nameOf(pid), x: (sh.icon || '') + ' ' + (sh[lang] || sh.id), t: 'sh' }); }
function shout(idx) {
  if (mode !== 'online' || !room || room.spectator || !SHOUTS[idx]) return; const n = Date.now(); if (n - shoutAt < 900) return; shoutAt = n;
  if (room.s.ph !== 'play') { sendChat((SHOUTS[idx].icon || '') + ' ' + (SHOUTS[idx][lang] || SHOUTS[idx].id)); return; }
  showBubble(me, idx);
  if (room.isHost()) { if (sim) { sim.hs.push([hsKey(), me, idx]); hostDirty = true; } }
  else { outShout = [++shoutSeq, idx]; sendIn(true); }
}
let hsBase = Date.now() % 1e6; const hsKey = () => ++hsBase;
const seenHs = new Set();
function readShouts(hs) { for (const h of hs || []) { if (!Array.isArray(h)) continue; const key = h[0] + ':' + h[1]; if (seenHs.has(key)) continue; seenHs.add(key); if (h[1] !== me) showBubble(h[1], h[2] | 0); } if (seenHs.size > 300) seenHs.clear(); }
function renderShouts() { const el = $('shouts'); if (!el) return; el.innerHTML = SHOUTS.map((s, i) => '<button type="button" data-sh="' + i + '" title="' + (i + 1) + '">' + esc((s.icon || '') + ' ' + (s[lang] || s.id)) + '</button>').join(''); }
$('shouts').addEventListener('click', e => { const b = e.target.closest('[data-sh]'); if (b) shout(Number(b.dataset.sh)); });
function nameOf(pid) { const c = sim && sim.chef(pid); if (c) return c.name; const p = room && room.players().find(q => q.id === pid); return p ? p.displayName : '?'; }

/* =====================================================================
   FRAME LOOP
   ===================================================================== */
let hintKey = '', hudKey = '', workSfxAt = 0, warnAt = 0, tickAt = 0, posAt = 0, lastSentPos = '';
function frame(now) {
  root.requestAnimationFrame(frame);
  const dt = Math.min(100, now - (lastFrame || now)); lastFrame = now;
  if ($('game').hidden || !sim) return;
  const ch = myChef(), host = mode === 'solo' || (mode === 'online' && room && room.isHost());
  if (!paused && !sim.over && ch) {
    let [vx, vy] = inputVec();
    if (G3) { // tank / shooter steer: stick X (and Q/E) = keep turning while held, stick Y = walk forward/back along the chef's heading
      let tq = 0; for (const k of keys) if (TURN[k]) tq += TURN[k];
      const ax = Math.abs(vx) > 0.15 ? Math.sign(vx) * (Math.abs(vx) - 0.15) / 0.85 : 0, turnIn = Math.max(-1, Math.min(1, ax + tq));
      if (!vx && !vy && !tq) cam.hd = ch.f; // idle: follow whatever the sim says (bots, resets)
      cam.hd = wrapA((cam.hd == null ? ch.f : cam.hd) + turnIn * 2.6 * dt / 1000);
      const fwd = -vy, hc = Math.cos(cam.hd), hs = Math.sin(cam.hd); vx = hc * fwd; vy = hs * fwd;
      if (!vx && !vy && turnIn) ch.f = cam.hd; }
    if (vx || vy) tapGoal = null; else if (tapGoal) { const dx = tapGoal[0] - ch.x, dy = tapGoal[1] - ch.y, d = Math.hypot(dx, dy); if (d < 0.25) tapGoal = null; else { vx = dx / d; vy = dy / d; if (d < 0.6) { const t = sim.target(ch); if (t) tapGoal = null; } } }
    if (vx || vy || Math.hypot(ch.vx, ch.vy) > 0) sim.move(ch, vx, vy, dt, sim.chefs); if (!vx && !vy) { ch.vx = 0; ch.vy = 0; }
    if (G3 && cam.hd != null && (vx || vy)) ch.f = cam.hd; // walking backwards keeps facing forward
    if (vx || vy) { if (ch.w >= 0 && !sim.inReach(ch, sim.st[ch.w])) ch.w = -1; }
  }
  if (mode === 'solo' && !paused) { simAcc += dt; while (simAcc >= SIM_MS) { simAcc -= SIM_MS; sim.step(SIM_MS); } }
  else if (mode === 'online' && !host) { sim.step(dt); }
  if (host) playEvents(sim.ev, mode === 'solo' ? 'solo' + soloRun : hostG, false);
  // smooth display positions (remote chefs glide toward the latest known position)
  for (const c of sim.chefs) { const d = disp[c.id] || (disp[c.id] = { x: c.x, y: c.y }); if (c.id === me || mode === 'solo') { d.x = c.x; d.y = c.y; } else { const k = 1 - Math.pow(0.0015, dt / 1000); const far = Math.hypot(c.x - d.x, c.y - d.y) > 3; d.x = far ? c.x : d.x + (c.x - d.x) * k; d.y = far ? c.y : d.y + (c.y - d.y) * k; } }
  // continuous work sfx / particles + pot warnings + last-seconds tick
  if (ch && ch.w >= 0 && now - workSfxAt > 170) { workSfxAt = now; const s = sim.st[ch.w]; if (s) { (s.c === 'U' ? SFX.grind : s.c === 'K' ? SFX.clean : SFX.chop)(); fx.burst(s.x + 0.5, s.y + 0.4 - LIFT, s.c === 'U' ? ['#4c9a2a'] : s.c === 'K' ? ['#bfefff'] : ['#f0a99a', '#fff'], 2, 1.2); } }
  if (!sim.tut && now - warnAt > 520 && sim.st.some(s => s.pot && s.pot.s === 2 && s.pot.t > D.CFG.warnAfter * 1000)) { warnAt = now; SFX.warn(); }
  if (!sim.tut && !sim.over && sim.left < 10500 && sim.left > 0) { const sec = Math.ceil(sim.left / 1000); if (sec !== tickAt) { tickAt = sec; tone(sec <= 3 ? 1000 : 750, 60, 'square', 0.035); } }
  fx.step(paused ? 0 : dt);
  const h = ch && !sim.over ? D.hint(sim, ch) : { s: null, g: '', w: '' };
  const meta = c => ({ me: c.id === me && mode === 'online', name: mode === 'online' ? c.name : '', gm: mode === 'online' && isGm(c.id), work: c.w >= 0, bubble: bubbles[c.id] && bubbles[c.id].until > now ? bubbles[c.id].t : '' });
  if (G3) draw3d(ch, dt, now, h, meta); else renderKitchen(cv, sim, { ts: TS, dpr: DPR, now, fx, disp, hl: h.s ? [h.s.i] : [], tut: tut ? tutHl() : [], meta });
  paintButtons(h, ch); paintHud();
  if (mode === 'online' && !host && ch && !room.spectator) { const pos = ch.x.toFixed(2) + ',' + ch.y.toFixed(2); if (pos !== lastSentPos && now - posAt > 480) sendIn(false); }
  if (mode === 'solo' && sim.over && !ended) { ended = true; setTimeout(() => { if (mode === 'solo' && sim && sim.over) finishSolo(); }, 900); }
}
function draw3d(ch, dt, now, h, meta) {
  const [W] = G3.size, gk = mode === 'solo' ? 'solo' + soloRun : 'on' + (room && room.s ? room.s.g : ''); if (cam.gk !== gk) { cam.gk = gk; camReset(ch); }
  // camera always sits behind the chef's heading; a drag/look adds a temporary offset that eases back once the finger/mouse lets go
  const c = ch || sim.chefs[0], dd = c ? disp[c.id] || c : { x: D.W / 2, y: D.H / 2 };
  if (ch && !cam.drag && now - cam.lastDrag > 250 && cam.look) { cam.look *= Math.exp(-dt / 220); if (Math.abs(cam.look) < 0.002) cam.look = 0; }
  if (!ch) { let turn = 0; for (const k of keys) if (TURN[k]) turn += TURN[k]; if (turn) cam.look = wrapA((cam.look || 0) + turn * 2.3 * dt / 1000); }
  const base = ch ? (cam.hd == null ? ch.f : cam.hd) : (cam.hd == null ? -Math.PI / 2 : cam.hd); cam.yaw = wrapA(base + (cam.look || 0));
  const rig = camRig(dd.x, dd.y), k = cam.eye ? 1 - Math.exp(-dt / 85) : 1; cam.eye = cam.eye || rig.eye.slice();
  for (let i = 0; i < 3; i++) cam.eye[i] += (rig.eye[i] - cam.eye[i]) * k;
  const sh = fx.shake > 0 ? fx.shake * 0.12 : 0, eye = sh ? cam.eye.map(v => v + (Math.random() - 0.5) * sh) : cam.eye;
  const tts = Math.min(40, W / 12.5);
  G3.render(sim, { now, fx, disp, eye, at: rig.at, hl: h.s ? [h.s.i] : [], tut: tut ? tutHl() : [], meta, need: needList, meId: me, yaw: cam.yaw, mini: true, topY: TK * tts, iname: x => { const t = T('i_' + x); return t.charAt(0).toUpperCase() + t.slice(1); }, tickets: g => drawTickets(g, sim, tts, W, now) });
}
function paintButtons(h, ch) {
  const key = (h.s ? h.s.i : -1) + '|' + h.g + '|' + h.w + '|' + (ch ? ch.h + ch.w : '') + lang + (tut ? tut.i : '');
  if (key === hintKey) return; hintKey = key;
  let gl = T('grab'), wl = T('work');
  if (h.g) { const [a, b] = h.g.split(':'); gl = a === 'take' ? T('g_take', { x: T('i_' + b) }) : T('g_' + a); }
  if (h.w) wl = T('w_' + h.w);
  $('grabLbl').textContent = gl; $('workLbl').textContent = wl;
  $('grabBtn').classList.toggle('dim', !h.g); $('workBtn').classList.toggle('dim', !h.w);
  $('grabBtn').classList.toggle('glow', !!h.g && !!tut); $('workBtn').classList.toggle('glow', !!h.w && !!tut);
  $('workBtn').querySelector('.ic').textContent = h.w === 'grind' ? '🪨' : h.w === 'clean' ? '🧽' : '🔪';
}
function paintHud() {
  const st = sim.tut ? 0 : sim.stars(), need = sim.starNeed(), k = [sim.tut ? 'tut' : sim.shift, Math.ceil(sim.left / 1000), sim.score, st, sim.streak, lang].join('|');
  if (k === hudKey) return; const prevScore = Number((hudKey.split('|')[2]) || 0), prevSt = Number(hudKey.split('|')[3] || 0); hudKey = k;
  $('shName').textContent = sim.tut ? T('tutName') : T('shiftName', { n: shiftLabel(sim.shift) });
  $('timer').textContent = sim.tut ? '∞' : fmtT(sim.left); $('timer').classList.toggle('low', !sim.tut && sim.left < 20000);
  $('scoreBox').textContent = sim.score; $('starBox').innerHTML = sim.tut ? '' : [0, 1, 2].map(i => '<span title="' + need[i] + '" style="' + (i < st ? '' : 'filter:grayscale(1) opacity(.35)') + '">⭐</span>').join('');
  if (st > prevSt && !sim.tut) SFX.star();
  if (sim.score > prevScore) { $('scoreBox').animate && $('scoreBox').animate([{ transform: 'scale(1.35)' }, { transform: 'scale(1)' }], 300); }
  $('streakBox').hidden = sim.streak < 2; $('streakBox').textContent = '🔥×' + Math.min(3, 1 + 0.5 * (sim.streak - 1)).toFixed(1).replace('.0', '');
  paintCrew();
}
function paintCrew() { if (mode !== 'online' || !sim) { $('crew').innerHTML = ''; return; } $('crew').innerHTML = sim.chefs.map(c => '<li><span class="dot" style="background:' + D.COLORS[c.c % 4] + '"></span>' + esc(c.name) + (isGm(c.id) ? ' <em class="gm-tag">(GM)</em>' : '') + '<b>' + c.sv + '</b></li>').join(''); }

/* =====================================================================
   SOLO + TUTORIAL
   ===================================================================== */
let soloRun = 0;
function startSolo(shift) {
  stopOnline(); mode = 'solo'; me = 1; paused = false; simAcc = 0; ended = false; soloRun++; pend = []; tapGoal = null;
  if (shift == null) shift = !getLS(TUT_KEY) ? 'tut' : soloShift;
  const name = myName() || (lang === 'en' ? 'You' : 'Kamu');
  sim = new Sim({ players: [{ id: 1, name }], shift }); for (const k in disp) delete disp[k];
  tut = shift === 'tut' ? { i: 0 } : null; $('tutBox').hidden = !tut; if (tut) tutPaint();
  $('pauseBtn').hidden = false; $('pauseBtn').textContent = T('pause'); $('overlay').hidden = true; hudKey = ''; hintKey = '';
  show('game'); if (!tut && getLS('dapurpadang.tip') !== '1') { setLS('dapurpadang.tip', '1'); toast(T('tip1'), 'good', 4500); }
}
function finishSolo() {
  if (sim.tut) { setLS(TUT_KEY, '1'); tut = null; $('tutBox').hidden = true; SFX.win(); overlay('<div class="ovc">🎉 ' + esc(T('tutDone')) + '<p>' + esc(T('tEnd')) + '</p><button type="button" class="btn green big" id="tutGoBtn">' + esc(T('tEndGo')) + '</button></div>'); $('tutGoBtn').onclick = () => startSolo(0); return; }
  const res = sim.result(), bk = 's' + sim.shift; let best = {}; try { best = JSON.parse(getLS(BEST_KEY) || '{}') || {}; } catch (e) { best = {}; }
  const isBest = res.sc > (best[bk] | 0); if (isBest) { best[bk] = res.sc; setLS(BEST_KEY, JSON.stringify(best)); }
  showEnd(res, true, isBest); renderBest();
}
function overlay(html) { const o = $('overlay'); o.innerHTML = html; o.hidden = !html; }
function togglePause() { if (mode !== 'solo' || !sim || sim.over) return; paused = !paused; $('pauseBtn').textContent = paused ? T('resume') : T('pause'); overlay(paused ? '<div class="ovc">⏸ ' + esc(T('paused')) + '<p>' + esc(T('keys')) + '</p><button type="button" class="btn green" id="resumeBtn">' + esc(T('resume')) + '</button></div>' : ''); if (paused) $('resumeBtn').onclick = togglePause; }
/* tutorial steps: [done(sim, ch), highlight station codes(sim, ch)] — progress is monotonic */
function anyItem(pred) { for (const c of sim.chefs) if (c.h && (pred(c.h) || D.plateOf(c.h).some(pred))) return true; for (const s of sim.st) { if (s.it && (pred(s.it) || D.plateOf(s.it).some(pred))) return true; if (s.pot && s.pot.c.some(pred)) return true; } return false; }
const potHas = x => sim.st.some(s => s.pot && s.pot.c.includes(x));
const TUT = [
  [ch => ch.h === 'ikan' || anyItem(x => x === 'ikanP') || potHas('ikanP'), ch => ['I']],
  [ch => sim.st.some(s => s.c === 'T' && (s.it === 'ikan' || s.it === 'ikanP')) || anyItem(x => x === 'ikanP') || sim.served > 0, ch => ['T']],
  [ch => anyItem(x => x === 'ikanP') || potHas('ikanP') || sim.served > 0, ch => ['T']],
  [ch => potHas('ikanP') || anyItem(x => x === 'gulai') || sim.served > 0, ch => ch.h === 'ikanP' ? ['K'] : ['T']],
  [ch => sim.st.some(s => s.pot && s.pot.r === 'gulai' && s.pot.s >= 1) || anyItem(x => x === 'gulai') || sim.served > 0, ch => ch.h === 'santan' ? ['K'] : ['M']],
  [ch => anyItem(x => D.isPlate(x)) || sim.served > 0, ch => ['P']],
  [ch => anyItem(x => D.isPlate(x) && D.plateOf(x).includes('nasi')) || sim.served > 0, ch => ['N']],
  [ch => anyItem(x => D.isPlate(x) && D.plateOf(x).includes('gulai')) || sim.served > 0, ch => ['K']],
  [ch => sim.served > 0, ch => ['L']],
  [ch => anyItem(x => x === 'sambal') || sim.served > 1, ch => ch.h === 'cabai' || sim.st.some(s => s.c === 'U' && s.it === 'cabai') ? ['U'] : ['H']],
  [ch => sim.served > 1 || sim.over, ch => { const h = ch.h || ''; if (!D.isPlate(h)) return h === 'sambal' ? ['P'] : sim.st.some(s => s.c === 'U' && s.it === 'sambal') ? ['P', 'U'] : ['P']; const a = D.plateOf(h); return !a.includes('nasi') ? ['N'] : !a.includes('sambal') ? ['U'] : ['L']; }]
];
function tutCheck() { if (!tut || !sim) return; const ch = myChef(); if (!ch) return; const i0 = tut.i; while (tut.i < TUT.length && TUT[tut.i][0](ch)) tut.i++; if (tut.i !== i0) { tutPaint(); if (tut.i < TUT.length) SFX.star(); } }
function tutPaint() { if (!tut) return; const i = Math.min(tut.i, TUT.length - 1); $('tutN').textContent = (i + 1) + '/' + TUT.length; $('tutT').innerHTML = T('t' + (i + 1)); }
let tutHlAt = 0, tutHlCache = [];
function tutHl() { const n = performance.now(); if (n - tutHlAt < 150) return tutHlCache; tutHlAt = n; tutCheck(); const ch = myChef(); if (!ch || tut.i >= TUT.length) return (tutHlCache = []); const codes = TUT[tut.i][1](ch); tutHlCache = sim.st.filter(s => codes.includes(s.c) && (s.c !== 'K' || tut.i !== 7 || (s.pot && s.pot.s === 2)) && (s.c !== 'T' || tut.i < 1 || tut.i > 3 || !sim.st.some(q => q.c === 'T' && q.it) || s.it)).map(s => s.i); return tutHlCache; }
$('tutSkip').addEventListener('click', () => { setLS(TUT_KEY, '1'); startSolo(soloShift); });

/* =====================================================================
   ONLINE (host-authoritative co-op)
   ===================================================================== */
let tickBusy = false, lastTick = 0, hostDirty = false, hostCm = [], inBusy = false, inAgain = false, sentQ = 0, outChat = null, outShout = null, clientG = null, wireT = -1;
const hostBudget = bucket(3, 1.75), inBudget = bucket(5, 1.6), hostLoop = { at: 0, acc: 0 };
let chatSeq = Date.now() % 1e7;
function makeRoom() { return new N.Room(conn, { onChange: onRoom }); }
function stopOnline() { if (room) { const r = room; room = null; r.leave(); } hostG = null; clientG = null; resetChat(); }
function errMsg(e) {
  if (!e) return T('errNet'); if (e.code === 'busy') return T('errBusy', { s: e.wait || 10 }); if (e.code === 'network') return T('errNet');
  if (e.status === 404 || e.status === 422) return T('errMissing'); return T('errGeneric', { msg: e.server || e.message || '' });
}
async function enterOnline(kind, opts) {
  stopOnline(); const r = makeRoom(); mode = 'online'; sim = null; room = r; endSent = false; hostG = null; wasHost = null; tut = null; $('tutBox').hidden = true;
  try { await r.enter(kind, Object.assign({ set: { sh: saved.osh | 0 }, maxPlayers: 4 }, opts)); } catch (e) { if (room === r) { room = null; mode = null; } throw e; }
  me = r.me; if (room === r && r.s.ph === 'lobby') { renderRoom(); show('lobby'); } addChatLine({ k: 'sys-in' + Date.now(), t: 'sys', x: T('chatSys', { n: myName() || '?' }) }); gmAnnounce(); return r;
}
async function onlineAction(kind) {
  const name = myName(); if (!name) { toast(T('errName'), 'warn'); $('nameInput').focus(); return; }
  setLS(NAME_KEY, name); const code = $('codeInput').value.trim().toUpperCase();
  if (kind === 'join' && !/^[A-Z2-9]{6}$/.test(code)) { toast(T('errCode'), 'warn'); return; }
  doc.querySelectorAll('.online-btn').forEach(b => { b.disabled = true; });
  try { await enterOnline(kind, { displayName: name, code }); }
  catch (e) {
    if (kind === 'join' && e.status === 409) { try { await enterOnline('watch', { displayName: name, code }); toast(T('errFull'), 'warn', 4000); } catch (e2) { toast(errMsg(e2), 'warn', 4000); } }
    else toast(errMsg(e), 'warn', 4000);
  } finally { doc.querySelectorAll('.online-btn').forEach(b => { b.disabled = !onlineOk; }); }
}
let seatSeen = null;
function onRoom(r, data) {
  if (r !== room) return;
  if (!data) { toast(T('roomGone'), 'warn'); exitToMenu(true); return; }
  me = r.me; const s = r.s, host = r.isHost(); gmMeSync();
  joinLeaveLines(r.seated());
  if (s.ph === 'play' && s.s) {
    if (host) {
      if (!sim || sim.pred || hostG !== s.g) {
        if (!(sim && !sim.pred && hostG === s.g)) { sim = Sim.fromSnap(s.s, false); hostG = s.g; seenV = data.version; endSent = false; hostCm = s.cm.slice(); hostLoop.at = 0; hostLoop.acc = 0; if (wasHost === false) toast(T('hostTook'), 'good', 4000); }
      }
      takeInputs(data.events);
    } else clientSnap(s);
  } else if (!starting && s.ph !== 'end') { sim = null; hostG = null; }
  if (!(host && s.ph === 'play')) syncChat(s.cm);
  wasHost = host;
  if (s.ph === 'play') { if ($('game').hidden) { hudKey = ''; hintKey = ''; ended = false; $('pauseBtn').hidden = true; overlay(''); show('game'); } }
  else if (s.ph === 'end') { showEnd(s.res, false); }
  else { renderRoom(); if ($('lobby').hidden) show('lobby'); }
}
function joinLeaveLines(ps) {
  const ids = new Map(ps.map(p => [p.id, p.displayName])); if (seatSeen) { for (const [id, n] of ids) if (!seatSeen.has(id) && id !== me) { addChatLine({ k: 'sj' + id + Date.now(), t: 'sys', x: T('chatSys', { n }) }); SFX.chat(); } for (const [id, n] of seatSeen) if (!ids.has(id)) addChatLine({ k: 'sl' + id + Date.now(), t: 'sys', x: T('chatLeft', { n }) }); }
  seatSeen = ids;
}
function clientSnap(s) {
  if (clientG !== s.g) { clientG = s.g; opQ = 0; sentQ = 0; pend = []; wireT = -1; for (const k in disp) delete disp[k]; }
  if (s.s.t === wireT && sim && sim.pred) return; wireT = s.s.t;
  const old = sim && sim.pred ? sim.chef(me) : null, n = Sim.fromSnap(s.s, true), nc = n.chef(me);
  if (nc) {
    if (old) { nc.x = old.x; nc.y = old.y; nc.f = old.f; }
    pend = pend.filter(p => p[0] > nc.a); for (const p of pend) n.apply(me, p[1], p[2]); if (pend.length) nc.a = pend[pend.length - 1][0];
    if (opQ < nc.a) opQ = nc.a;
  }
  sim = n; playEvents(s.s.ev, s.g, true); readShouts(s.s.hs);
}
function takeInputs(events) {
  if (!sim) return;
  for (const e of events || []) {
    if (e.version <= seenV) continue; seenV = e.version;
    if (e.type !== 'in' || !e.payload || e.payload.g !== hostG) continue;
    const p = e.payload, c = sim.chef(e.playerId); if (!c) continue;
    if (e.playerId !== me) sim.place(c, +p.x, +p.y, +p.f);
    const ops = Array.isArray(p.a) ? p.a.slice(-6) : [];
    for (const op of ops) { if (!Array.isArray(op)) continue; const q = Number(op[0]) || 0; if (q <= c.a) continue; c.a = q; if (op[1] === 'g' || op[1] === 'w') sim.apply(c.id, op[1], op[2] | 0); }
    if (p.m && typeof p.m.x === 'string') { const k = 'c' + e.playerId + '.' + (p.m.i | 0); if (!hostCm.some(m => m.k === k)) { const m = { k, p: e.playerId, n: c.name, x: cleanChat(p.m.x) }; if (m.x) { hostCm.push(m); hostCm = hostCm.slice(-30); addChatLine(m); SFX.chat(); } } }
    if (Array.isArray(p.h)) { const k = e.playerId + ':' + (p.h[0] | 0); if (!seenHs.has('in' + k)) { seenHs.add('in' + k); const idx = p.h[1] | 0; if (SHOUTS[idx]) { sim.hs.push([hsKey(), e.playerId, idx]); showBubble(e.playerId, idx); } } }
    hostDirty = true;
  }
}
function pruneLeft() { if (!room || !sim) return; const ids = new Set(room.seated().map(p => p.id)); const before = sim.chefs.length; sim.chefs = sim.chefs.filter(c => ids.has(c.id)); if (sim.chefs.length !== before) hostDirty = true; }
/* host sim runs on a timer (keeps going when rAF is throttled in a background tab) */
setInterval(() => {
  if (mode !== 'online' || !sim || sim.pred || !room || !room.isHost() || room.s.ph !== 'play') return;
  const now = performance.now(), dt = Math.min(1500, now - (hostLoop.at || now)); hostLoop.at = now; hostLoop.acc += dt;
  while (hostLoop.acc >= SIM_MS) { hostLoop.acc -= SIM_MS; sim.step(SIM_MS); }
  pruneLeft();
  if (sim.over && !endSent) { endSent = true; setTimeout(sendEnd, 700); return; }
  if (!tickBusy && Date.now() - lastTick >= (hostDirty ? 240 : 520) && hostBudget.take()) sendTick();
}, SIM_MS);
function tickState(r) { return Object.assign({}, r.s, { s: sim.snap(), cm: hostCm.slice(-30) }); }
async function sendTick() {
  tickBusy = true; lastTick = Date.now(); hostDirty = false; const r = room;
  try { await r.push('tick', { state: tickState(r) }); }
  catch (e) {
    if (e.status !== 409 || r !== room) return;
    try { await r.settle(e.used); if (r === room && sim && r.s.ph === 'play' && hostBudget.take()) { lastTick = Date.now(); await r.push('tick', { state: tickState(r) }); } } catch (e2) { hostDirty = true; }
  } finally { tickBusy = false; }
}
async function sendEnd() {
  const r = room; if (!r || !sim) return; const res = sim.result(), snap = sim.snap(), cm = hostCm.slice(-30);
  try { await r.edit('end', s => { if (s.ph !== 'play' || s.g !== hostG) return null; s.ph = 'end'; s.res = res; s.s = snap; s.cm = cm; return { status: 'waiting' }; }); }
  catch (e) { endSent = false; }
}
async function startOnline(shift) {
  const r = room; if (!r || !r.isHost()) return; const ps = r.seated(); if (!ps.length) return;
  if (shift == null) shift = r.s.set.sh | 0; shift = Math.max(0, Math.min(2, shift | 0));
  const g = Math.random().toString(36).slice(2, 8), next = new Sim({ players: ps.slice(0, 4).map(p => ({ id: p.id, name: p.displayName })), shift });
  ['startBtn', 'againBtn', 'nextBtn'].forEach(id => { $(id).disabled = true; }); starting = true;
  try {
    sim = next; hostG = g; seenV = r.version; endSent = false; hostLoop.at = 0; hostLoop.acc = 0; hudKey = ''; for (const k in disp) delete disp[k];
    const res = await r.edit('start', (s, d) => { gmPrune(s, d); s.ph = 'play'; s.g = g; s.res = null; s.set.sh = shift; s.s = next.snap(); hostCm = s.cm.slice(-30); return { status: 'playing' }; });
    if (!res) { sim = null; hostG = null; }
  } catch (e) { sim = null; hostG = null; toast(errMsg(e), 'warn'); }
  finally { starting = false; ['startBtn', 'againBtn', 'nextBtn'].forEach(id => { $(id).disabled = false; }); }
}
async function toLobby() { const r = room; if (!r || !r.isHost()) return; try { await r.edit('lobby', (s, d) => { gmPrune(s, d); s.ph = 'lobby'; s.s = null; s.res = null; return { status: 'waiting' }; }); } catch (e) { toast(errMsg(e), 'warn'); } }
async function setShift(v) { saved.osh = v; saveSet(); const r = room; if (!r || !r.isHost()) return; try { await r.edit('set', s => { if (s.ph !== 'lobby') return null; s.set.sh = v; }); } catch (e) { toast(errMsg(e), 'warn'); } }
/** client -> host: position + pending actions (+ chat / shout), one write, budgeted */
async function sendIn(urgent) {
  const r = room; if (!r || r.spectator || r.isHost() || r.s.ph !== 'play' || !sim || !sim.pred) return; const ch = myChef(); if (!ch) return;
  if (inBusy) { if (urgent) inAgain = true; return; }
  if (!inBudget.take()) { if (urgent) setTimeout(() => sendIn(true), 300); return; }
  inBusy = true; posAt = performance.now(); lastSentPos = ch.x.toFixed(2) + ',' + ch.y.toFixed(2);
  const a = pend.slice(-6), m0 = outChat, h0 = outShout, payload = { g: r.s.g, x: Math.round(ch.x * 100) / 100, y: Math.round(ch.y * 100) / 100, f: Math.round(ch.f * 100) / 100, a };
  if (m0) payload.m = m0; if (h0) payload.h = h0;
  try { await r.push('in', { payload }); if (a.length) sentQ = Math.max(sentQ, a[a.length - 1][0]); if (outChat === m0) outChat = null; if (outShout === h0) outShout = null; }
  catch (e) { if (r === room) { inAgain = true; if (e.status === 409) { try { await r.settle(e.used); } catch (e2) { /* next */ } } } }
  finally { inBusy = false; const more = inAgain || outChat || outShout || pend.some(p => p[0] > sentQ); inAgain = false; if (more && room === r) setTimeout(() => sendIn(true), 40); }
}
/* ---------- chat ---------- */
const BAD = /\b(anjing|bangsat|babi|kontol|memek|ngentot|goblok|tolol|fuck|shit|bitch)\b/gi;
function cleanChat(x) { return String(x || '').replace(/[\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120).replace(BAD, w => w[0] + '*'.repeat(w.length - 1)); }
const chatKeys = new Set();
function resetChat() { chatKeys.clear(); $('chatLog').innerHTML = ''; seatSeen = null; }
function addChatLine(m) {
  if (!m || !m.k || chatKeys.has(m.k)) return; chatKeys.add(m.k); const log = $('chatLog'), p = doc.createElement('p');
  if (m.t === 'sys') { p.className = 'sys'; p.textContent = m.x; }
  else { if (m.t === 'sh') p.className = 'sh'; const gmT = isGm(m.p) ? ' <em class="gm-tag">(GM)</em>' : ''; p.innerHTML = '<b>' + esc(m.n || '?') + gmT + ':</b> ' + esc(m.x); }
  const stick = log.scrollTop + log.clientHeight >= log.scrollHeight - 30; log.appendChild(p); while (log.children.length > 80) log.firstChild.remove(); if (stick) log.scrollTop = log.scrollHeight;
}
function syncChat(cm) { for (const m of cm || []) { if (!m || typeof m !== 'object') continue; const fresh = !chatKeys.has(m.k); addChatLine({ k: String(m.k || ''), p: m.p, n: String(m.n || ''), x: cleanChat(m.x) }); if (fresh && m.p !== me && chatKeys.size > 1) SFX.chat(); } }
let chatAt = 0;
async function sendChat(raw) {
  const x = cleanChat(raw); if (!x || !room || room.spectator && room.s.ph === 'play') return false; const n = Date.now(); if (n - chatAt < 1200) { toast(T('chatSlow'), 'warn', 1500); return false; } chatAt = n;
  const k = 'c' + me + '.' + (++chatSeq), m = { k, p: me, n: myName() || nameOf(me), x };
  if (room.s.ph === 'play') {
    if (room.isHost()) { hostCm.push(m); hostCm = hostCm.slice(-30); hostDirty = true; addChatLine(m); }
    else { outChat = { i: chatSeq, x }; addChatLine(m); sendIn(true); }
  } else { addChatLine(m); try { await room.edit('chat', s => { s.cm = (s.cm || []).concat([m]).slice(-30); }); } catch (e) { toast(errMsg(e), 'warn'); } }
  return true;
}
$('chatForm').addEventListener('submit', e => { e.preventDefault(); const i = $('chatInput'); Promise.resolve(sendChat(i.value)).then(ok => { if (ok) i.value = ''; }); if (!$('game').hidden) i.blur(); });
/* ---------- lobby / end ---------- */
let onShiftPaint = () => {};
function renderRoom() {
  const r = room; if (!r || !r.data) return; const s = r.s, host = r.isHost(), ps = r.seated();
  $('roomCode').textContent = r.code; $('lobbyVis').textContent = r.data.visibility === 'public' ? T('visPub') : T('visPriv');
  $('pCount').textContent = ps.length + '/' + (r.data.maxPlayers || 4);
  $('pList').innerHTML = ps.map((p, i) => '<li><span class="dot" style="background:' + D.COLORS[i % 4] + '"></span><span>' + esc(p.displayName) + (isGm(p.id, s) ? ' <em class="gm-tag">(GM)</em>' : '') + '</span>' + (p.id === r.me ? '<span class="tag">' + esc(T('you')) + '</span>' : '') + (p.host ? '<span class="tag">' + esc(T('host')) + '</span>' : '') + '</li>').join('');
  $('hostBox').hidden = !host; $('onShift').classList.toggle('ro', !host); onShiftPaint(s.set.sh | 0);
  $('lobbyWait').textContent = r.spectator ? T('spectating') : host ? '' : T('waitHost');
}
const END_T = { id: ['Pelanggan masih lapar…', 'Lumayan, Uda/Uni!', 'Mantap, dapur kompak!', 'Juara Dapur Padang! 🏆'], en: ['Customers still hungry…', 'Not bad, chefs!', 'Great teamwork!', 'Padang Kitchen Champions! 🏆'] };
let endShownKey = '';
function showEnd(res, solo, isBest) {
  res = res && typeof res === 'object' ? res : { sc: 0, sv: 0, ex: 0, bn: 0, tp: 0, bs: 0, st: 0, need: [0, 0, 0], sh: 0, ch: [] };
  const st = Math.max(0, Math.min(3, res.st | 0)), need = Array.isArray(res.need) ? res.need : [0, 0, 0];
  $('endKicker').textContent = T('shiftName', { n: shiftLabel(res.sh | 0) }) + (solo ? ' · ' + T('solo') : '');
  $('endTitle').textContent = END_T[lang][st] + (isBest ? ' · ' + T('newBest') : '');
  $('endStars').innerHTML = [0, 1, 2].map(i => '<span class="' + (i < st ? 'on' : '') + '">⭐</span>').join('');
  $('endScore').textContent = (res.sc | 0) + ' 🪙';
  $('endTally').innerHTML = [['served', res.sv], ['tips', res.tp], ['expired', res.ex], ['burned', res.bn], ['streakBest', res.bs]].map(([k, v]) => '<li>' + esc(T(k)) + '<b>' + (v | 0) + '</b></li>').join('') + '<li>' + esc(T('stars', { a: need[0], b: need[1], c: need[2] })) + '</li>';
  $('endCrew').innerHTML = solo ? '' : (Array.isArray(res.ch) ? res.ch : []).map(c => '<li><span class="dot" style="background:' + D.COLORS[(c.c | 0) % 4] + '"></span>' + esc(c.n) + (isGm(c.i) ? ' <em class="gm-tag">(GM)</em>' : '') + ' · ' + (c.sv | 0) + ' ' + esc(T('mvp')) + '</li>').join('');
  const host = solo || (room && room.isHost()), hasNext = (res.sh | 0) < 2;
  $('nextBtn').hidden = !host || !hasNext; $('againBtn').hidden = !host; $('toLobbyBtn').hidden = solo || !host; $('endWait').textContent = host ? '' : T('waitAgain');
  $('nextBtn').dataset.sh = String((res.sh | 0) + 1); $('againBtn').dataset.sh = String(res.sh | 0);
  const key = JSON.stringify(res) + solo; if ($('end').hidden || key !== endShownKey) { endShownKey = key; if ($('end').hidden) { show('end'); SFX.win(); for (let i = 0; i < st; i++) setTimeout(SFX.star, 400 + i * 260); } }
}
async function exitToMenu(silent) {
  const r = room; room = null; mode = null; sim = null; paused = false; tut = null; hostG = null; clientG = null; overlay(''); $('tutBox').hidden = true; resetChat(); show('home'); gmMeSync(); renderBest(); if (gm) setTimeout(gmLoad, 400);
  if (r && !silent) await r.leave(); else if (r && conn.forget) conn.forget();
}
function confirmExit() { if ((mode === 'solo' && sim && !sim.over && !sim.tut) || (room && room.s.ph === 'play')) { if (!root.confirm(T('exitConfirm'))) return; } exitToMenu(false); }
function invite() {
  if (!room) return; const url = location.origin + location.pathname + '?room=' + room.code, done = () => toast(T('copied'), 'good');
  if (navigator.share && /Mobi|Android/i.test(navigator.userAgent)) navigator.share({ title: 'Dapur Padang Panik', text: 'Masak bareng di Dapur Padang Panik · ' + room.code, url }).catch(() => {});
  else if (navigator.clipboard) navigator.clipboard.writeText(url).then(done, () => toast(url, '', 6000)); else toast(url, '', 6000);
}
/* ---------- #gamemaster ---------- */
let gm = false, gmRooms = null, gmErr = '', gmBusy = false, gmAt = 0, gmWakeT = 0;
const gmHash = () => (location.hash || '').toLowerCase().includes(N.GM_KEY);
function gmSync() { const on = gmHash(); if (on === gm) return; gm = on; gmRooms = null; gmErr = ''; const box = $('gmRooms'); if (box) box.hidden = !gm; if (gm) gmLoad(); else renderGm(); }
const gmKey = id => 'p' + id;
// (GM) tag follows the server (players[].gamemaster, typed claim); the hash only shows the lobby list
function isGm(id) { return mode === 'online' && !!room && id != null && room.isGamemaster(id); }
function gmPrune(s) { if (s && 'gm' in s) delete s.gm; } // legacy hash-era state.gm marks: dropped on start / back to lobby
function gmAnnounce() { gmMeSync(); }
let gmUI = null;
function gmMeSync() { doc.documentElement.classList.toggle('gm-on', mode === 'online' && !!room && room.isGamemaster()); if (gmUI) gmUI.sync(); }
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
async function gmLoad() {
  if (!gm || gmBusy) return; if (!onlineOk) { renderGm(); return; }
  gmBusy = true; gmAt = Date.now(); renderGm();
  try { const d = await conn.rooms({ gm: true }); gmRooms = Array.isArray(d && d.rooms) ? d.rooms : []; gmErr = ''; } catch (e) { gmErr = errMsg(e); } finally { gmBusy = false; renderGm(); }
}
function gmWake() { if (!gm || room) return; clearTimeout(gmWakeT); gmWakeT = setTimeout(gmLoad, 1200); }
function renderGm() {
  const box = $('gmRooms'); if (!box) return; box.hidden = !gm; if (!gm) return; const list = gmRooms || [];
  $('gmNote').textContent = !conn.allowed ? T('onlineOff') : !onlineOk ? (conn.failed ? T('onlineDown') : T('gmLoading')) : gmErr ? T('gmErr', { msg: gmErr }) : gmRooms === null ? T('gmLoading') : list.length ? T('gmCount', { n: list.length }) : T('gmEmpty');
  $('gmRefresh').disabled = !onlineOk || gmBusy;
  $('gmList').innerHTML = list.map(r => {
    const code = esc(r.code), priv = r.visibility === 'private', playing = r.status === 'playing';
    return '<li data-code="' + code + '"><b class="code">' + code + '</b><span class="gm-meta"><span class="badge' + (priv ? ' priv">' + esc(T('gmPrivate')) : '">' + esc(T('gmPublic'))) + '</span> <span class="badge st">' + esc(T(playing ? 'gmPlaying' : 'gmWaiting')) + '</span><br><small class="muted">'
      + esc(T('gmPlayers', { n: Number(r.seated) || 0, max: Number(r.maxPlayers) || 0, w: Number(r.spectators) || 0 })) + '</small></span><span class="gm-act">'
      + (playing ? '' : '<button type="button" class="btn green small online-btn" data-gm="join" data-code="' + code + '">' + esc(T('gmJoin')) + '</button>')
      + '<button type="button" class="btn ghost small online-btn" data-gm="watch" data-code="' + code + '">' + esc(T('gmWatch')) + '</button></span></li>';
  }).join('');
}
async function gmEnter(kind, code) {
  if (!/^[A-Z2-9]{6}$/.test(code || '')) return; $('codeInput').value = code; if (kind === 'join') return onlineAction('join');
  const name = myName(); if (!name) { toast(T('errName'), 'warn'); $('nameInput').focus(); return; }
  setLS(NAME_KEY, name); try { await enterOnline('watch', { displayName: name, code }); } catch (e) { toast(errMsg(e), 'warn', 4000); }
}
function onlineNote() { const n = $('onlineNote'); if (!n) return; const msg = !conn.allowed ? T('onlineOff') : (conn.failed ? T('onlineDown') : ''); n.textContent = msg; n.hidden = !msg; }

/* =====================================================================
   HOME: how-to strip, recipe book, best line, hero demo (bot chefs cooking for real)
   ===================================================================== */
function iconStrip(cvs, seq, h) {
  const r = Math.min(2.5, root.devicePixelRatio || 1), w = seq.length * h * 0.95; cvs.width = Math.round(w * r); cvs.height = Math.round(h * r); cvs.style.width = w + 'px'; cvs.style.height = h + 'px';
  const g = cvs.getContext('2d'); g.setTransform(r, 0, 0, r, 0, 0); seq.forEach((it, i) => { const x = h * 0.475 + i * h * 0.95, y = h / 2; if (it === '>' || it === '+') { g.fillStyle = '#7a1f14'; g.font = '900 ' + Math.round(h * 0.5) + 'px system-ui'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(it === '>' ? '→' : '+', x, y); } else drawItem(g, it, x, y, h * 0.36); });
}
function renderHow() {
  const el = $('howList'); if (!el) return; const seqs = [['ikan', 'daging', 'cabai', 'santan'], ['ikan', '>', 'ikanP', 'cabai', '>', 'sambal'], ['ikanP', '+', 'santan', '>', 'gulai'], ['P:nasi', '+', 'gulai', '>', 'P:nasi+gulai']];
  el.innerHTML = seqs.map((s, i) => '<div class="st"><canvas data-i="' + i + '"></canvas><span>' + T('how' + (i + 1)) + '</span></div>').join('');
  el.querySelectorAll('canvas').forEach(c => iconStrip(c, seqs[+c.dataset.i], 26));
}
function renderBook() {
  const el = $('bookBody'); if (!el) return; const R = D.CFG.recipes, nm = x => T('i_' + x);
  const main = x => x === 'gulai' ? nm('ikanP') + ' + ' + nm('santan') + ' → ' + (lang === 'en' ? 'pot ' : 'kuali ') + R.gulai.cook + (lang === 'en' ? ' s' : ' dtk') : x === 'rendang' ? nm('dagingP') + ' + ' + nm('bumbu') + ' + ' + nm('santan') + ' → ' + (lang === 'en' ? 'pot ' : 'kuali ') + R.rendang.cook + (lang === 'en' ? ' s' : ' dtk') : x === 'sambal' ? nm('cabai') + ' → cobek' : '';
  el.innerHTML = Object.keys(D.CFG.menu).map(k => { const d = D.CFG.menu[k]; return '<div class="rc"><canvas data-m="' + k + '"></canvas><div><b>' + esc(T('m_' + k)) + ' · ' + d.pts + ' 🪙</b>' + esc((lang === 'en' ? 'plate + ' : 'piring + ') + d.p.map(nm).join(' + ')) + '<br><span class="muted">' + esc(d.p.map(main).filter(Boolean).join(' · ')) + '</span></div></div>'; }).join('')
    + '<p class="muted small">' + esc(lang === 'en' ? 'Burnt pot? Press Process at the stove to clean it. Serve the leftmost ticket first for a streak bonus.' : 'Kuali gosong? Tekan Proses di kompor untuk membersihkan. Sajikan tiket paling kiri dulu untuk bonus beruntun.') + '</p>';
  el.querySelectorAll('canvas').forEach(c => { const r = Math.min(2.5, root.devicePixelRatio || 1); c.width = 64 * r; c.height = 46 * r; c.style.width = '64px'; c.style.height = '46px'; const g = c.getContext('2d'); g.setTransform(r, 0, 0, r, 0, 0); drawPlate(g, D.CFG.menu[c.dataset.m].p, 32, 23, 26); });
}
function openBook() { renderBook(); $('bookModal').hidden = false; if (mode === 'solo' && sim && !sim.over && !paused && !sim.tut) togglePause(); }
function renderBest() { let best = {}; try { best = JSON.parse(getLS(BEST_KEY) || '{}') || {}; } catch (e) { best = {}; } const v = best['s' + soloShift] | 0; const el = $('bestLine'); if (el) el.textContent = v ? T('best', { s: shiftLabel(soloShift), v }) : T('bestNone'); }
/* --- hero: three bot chefs run the real sim (grid BFS + a recipe plan) --- */
function bfs(sim, from, goals) {
  const W = D.W, H = D.H, start = from[1] * W + from[0], prev = new Int32Array(W * H).fill(-2); prev[start] = -1; const q = [start];
  while (q.length) { const c = q.shift(); if (goals.has(c)) { const path = []; let k = c; while (k !== start && k >= 0) { path.unshift(k); k = prev[k]; } return path; }
    const x = c % W, y = (c / W) | 0; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy, n = ny * W + nx; if (nx < 0 || ny < 0 || nx >= W || ny >= H || prev[n] !== -2 || sim.solidAt(nx, ny)) continue; prev[n] = c; q.push(n); } }
  return null;
}
const PLANS = {
  gulai: [['I', 'g'], ['T', 'g', s => !s.it], ['=', 'w'], ['=', 'g'], ['K', 'g', s => s.pot.s === 0 && !s.pot.c.length, 'pot'], ['M', 'g'], ['@', 'g'], ['P', 'g'], ['N', 'g'], ['@', 'scoop'], ['L', 'g']],
  sambal: [['H', 'g'], ['U', 'g', s => !s.it, 'pot'], ['=', 'w'], ['P', 'g'], ['N', 'g'], ['@', 'g'], ['L', 'g']],
  rendang: [['D', 'g'], ['T', 'g', s => !s.it], ['=', 'w'], ['=', 'g'], ['K', 'g', s => s.pot.s === 0 && !s.pot.c.length, 'pot'], ['B', 'g'], ['@', 'g'], ['M', 'g'], ['@', 'g'], ['P', 'g'], ['N', 'g'], ['@', 'scoop'], ['L', 'g']]
};
function botStep(sim, b, dt) {
  const ch = sim.chef(b.id); if (!ch) return; b.t += dt;
  if (!b.plan || b.t > 30000) { if (ch.h) { b.plan = [['X', 'g']]; } else { const o = sim.orders.find(o => !sim.chefs.some(c => c !== ch && c.bp === o.id)) || sim.orders[0]; const m = o ? o.m : 'gulai'; ch.bp = o ? o.id : 0; b.plan = PLANS[m === 'sambal' ? 'sambal' : m === 'rendang' || m === 'komplit' ? 'rendang' : 'gulai']; } b.i = 0; b.t = 0; b.st = null; b.last = null; b.pot = null; }
  if (b.i >= b.plan.length) { b.plan = null; return; }
  const [code, op, filt, mark] = b.plan[b.i];
  let s = code === '=' ? b.last : code === '@' ? b.pot : b.st;
  if (!s || (code !== '=' && code !== '@' && s.c !== code)) { let best = null, bd = 1e9; for (const q of sim.st) { if (q.c !== code || (filt && !filt(q))) continue; const d = Math.hypot(q.x + 0.5 - ch.x, q.y + 0.5 - ch.y); if (d < bd) { bd = d; best = q; } } s = b.st = best; }
  if (!s) { sim.move(ch, 0, 0, dt, sim.chefs); return; }
  const t = sim.target(ch);
  if (t !== s) {
    const goals = new Set(); for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) { const x = s.x + dx, y = s.y + dy; if (!sim.solidAt(x, y)) goals.add(y * D.W + x); }
    const cx = Math.floor(ch.x), cy = Math.floor(ch.y); let tx, ty;
    if (goals.has(cy * D.W + cx)) { tx = s.x + 0.5; ty = s.y + 0.5; } else { const p = bfs(sim, [cx, cy], goals); if (!p || !p.length) { tx = s.x + 0.5; ty = s.y + 0.5; } else { tx = p[0] % D.W + 0.5; ty = ((p[0] / D.W) | 0) + 0.5; } }
    const dx = tx - ch.x, dy = ty - ch.y, d = Math.hypot(dx, dy) || 1; sim.move(ch, dx / d, dy / d, dt * 0.8, sim.chefs); return;
  }
  ch.vx = ch.vy = 0;
  if (b.wait > 0) { b.wait -= dt; return; }
  if (op === 'w') { if (ch.w < 0) { if (D.WORK[s.c] && s.it && D.WORK[s.c][s.it]) sim.apply(ch.id, 'w', s.i); else { b.i++; b.last = s; b.st = null; } } return; }
  if (op === 'scoop') { if (s.pot.s === 3) { if (ch.w < 0) sim.apply(ch.id, 'w', s.i); return; } if (s.pot.s !== 2) return; }
  const r = sim.apply(ch.id, 'g', s.i);
  if (['pick', 'drop', 'plate', 'cook', 'potAdd', 'serve', 'trash'].includes(r)) { if (mark) b.pot = s; b.last = s; b.st = null; b.i++; b.wait = 250; if (r === 'serve' && Math.random() < 0.6) b.say = 1; }
  else if (r === 'wrong' || r === 'burnt' || r === 'noMatch' || r === 'potBusy') { b.plan = ch.h ? [['X', 'g']] : null; b.i = 0; }
  else b.wait = 400;
}
function hero() {
  const c = $('heroCv'), hfx = makeFx(), hd = {}; let hs = null, bots = [], last = 0, hts = 0;
  const mk = () => { hs = new Sim({ players: [{ id: 1, name: 'Uda' }, { id: 2, name: 'Uni' }, { id: 3, name: 'Mak' }], shift: 1, seed: 7 }); hs.left = hs.dur = 1e9; bots = [1, 2, 3].map(id => ({ id, plan: null, i: 0, t: 0 })); };
  let H3 = null; try { H3 = G3 && R3.create(c, $('heroOv'), ART); } catch (e) { H3 = null; }
  const size = () => { const w = c.parentNode.clientWidth || 600; hts = w / D.W; const r = Math.min(2, root.devicePixelRatio || 1); if (H3) { H3.resize(w, Math.round(w * 0.56), Math.min(1.5, r)); return; } c.width = Math.round(w * r); c.height = Math.round(hts * (D.H + TK) * r); c.style.height = Math.round(hts * (D.H + TK)) + 'px'; };
  mk(); size(); root.addEventListener('resize', size); root.DPHero = () => hs;
  const loop = now => {
    root.requestAnimationFrame(loop); if ($('home').hidden || doc.visibilityState !== 'visible') { last = now; return; }
    let dt = Math.min(100, now - (last || now)); last = now; if (!hts) size();
    while (dt > 0) { const d = Math.min(50, dt); dt -= d; for (const b of bots) botStep(hs, b, d); hs.step(d); }
    for (const e of hs.ev) { if (e[0] <= (hs.seenEv || 0)) continue; hs.seenEv = e[0]; const s = hs.st[e[2]]; if (e[1] === 'serve' && s) { hfx.burst(s.x + 0.5, s.y + 0.3, ['#f2b705', '#e4572e', '#3aa857', '#fff'], 18, 3.5); hfx.text(s.x - 0.2, s.y - 0.2, '+' + e[4], '#ffe07a', true); } if (e[1] === 'chop' && s) hfx.burst(s.x + 0.5, s.y + 0.3, ['#f0a99a', '#fff', '#4c9a2a'], 8, 2); if (e[1] === 'done' && s) hfx.text(s.x + 0.5, s.y - 0.3, T('f_done'), '#7dff8a'); }
    if (hs.orders.length === 0 && hs.t > 4000) hs.spawnIn = Math.min(hs.spawnIn, 300);
    if (hs.expired > 6 || hs.t > 600000) mk();
    hfx.step(Math.min(100, now - (hfx.at || now))); hfx.at = now;
    const sayers = {}; for (const b of bots) { if (b.say) { b.say = 0; b.sayUntil = now + 1800; } if (b.sayUntil > now) sayers[b.id] = '👍 ' + (lang === 'en' ? 'Nice!' : 'Mantap!'); }
    const hmeta = ch => ({ name: ch.name, work: ch.w >= 0, bubble: sayers[ch.id] || '' });
    if (H3) { const a = Math.PI / 2 + 0.55 * Math.sin(now / 7000), [hw] = H3.size; H3.render(hs, { now, fx: hfx, disp: null, eye: [6.5 + Math.cos(a) * 8.2, 7.4, 4.5 + Math.sin(a) * 8.2], at: [6.5, 0.4, 4.0], fov: 0.95, meta: hmeta, need: needList, tickets: g => drawTickets(g, hs, Math.min(34, hw / 14), hw, now) }); }
    else renderKitchen(c, hs, { ts: hts, dpr: c.width / (hts * D.W), now, fx: hfx, disp: null, meta: hmeta });
  };
  root.requestAnimationFrame(loop);
}

/* =====================================================================
   BOOT
   ===================================================================== */
async function boot() {
  $('nameInput').value = getLS(NAME_KEY) || '';
  $('nameInput').addEventListener('change', () => setLS(NAME_KEY, myName()));
  soloShift = Math.max(0, Math.min(2, saved.sh | 0));
  seg('soloShift', soloShift, v => { soloShift = v; saved.sh = v; saveSet(); renderBest(); });
  onShiftPaint = seg('onShift', saved.osh | 0, v => setShift(v));
  doc.querySelectorAll('.lb').forEach(b => b.addEventListener('click', () => { lang = b.dataset.lang; setLS(LANG_KEY, lang); applyLang(); hintKey = ''; hudKey = ''; }));
  const mute = () => { muted = !muted; setLS(MUTE_KEY, muted ? '1' : '0'); paintMute(); if (!muted) SFX.pick(); };
  $('muteBtn').addEventListener('click', mute); $('muteBtn2').addEventListener('click', mute);
  $('practiceBtn').addEventListener('click', () => { setLS(NAME_KEY, myName()); ac(); goLandscape(); startSolo(); });
  $('tutBtn').addEventListener('click', () => { setLS(NAME_KEY, myName()); ac(); startSolo('tut'); });
  $('createPub').addEventListener('click', () => onlineAction('public'));
  $('createPriv').addEventListener('click', () => onlineAction('private'));
  $('matchBtn').addEventListener('click', () => onlineAction('match'));
  $('joinForm').addEventListener('submit', e => { e.preventDefault(); onlineAction('join'); });
  $('codeInput').addEventListener('input', e => { e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''); });
  $('inviteBtn').addEventListener('click', invite); $('lobbyLeave').addEventListener('click', () => exitToMenu(false));
  $('startBtn').addEventListener('click', () => { goLandscape(); startOnline(); });
  $('exitBtn').addEventListener('click', confirmExit); $('pauseBtn').addEventListener('click', togglePause);
  $('bookBtn').addEventListener('click', openBook); $('bookClose').addEventListener('click', () => { $('bookModal').hidden = true; });
  $('bookModal').addEventListener('click', e => { if (e.target === $('bookModal')) $('bookModal').hidden = true; });
  const again = sh => { if (mode === 'solo') startSolo(sh); else startOnline(sh); };
  $('againBtn').addEventListener('click', () => again(Number($('againBtn').dataset.sh) || 0)); $('nextBtn').addEventListener('click', () => again(Number($('nextBtn').dataset.sh) || 0));
  $('toLobbyBtn').addEventListener('click', toLobby); $('endMenu').addEventListener('click', () => exitToMenu(false));
  root.addEventListener('resize', fitBoard); if (root.visualViewport) root.visualViewport.addEventListener('resize', fitBoard);
  root.addEventListener('pagehide', () => { if (room) conn.leaveBeacon(); });
  doc.addEventListener('visibilitychange', () => { if (doc.visibilityState === 'visible') { if (conn.config) conn.visible(); } else if (mode === 'solo' && sim && !sim.over && !paused && !sim.tut) togglePause(); });
  $('gmRefresh').addEventListener('click', gmLoad);
  $('gmList').addEventListener('click', e => { const b = e.target.closest('[data-gm]'); if (b) gmEnter(b.dataset.gm, b.dataset.code); });
  root.addEventListener('hashchange', gmSync); setInterval(() => { if (gm && !room && doc.visibilityState === 'visible' && Date.now() - gmAt > 10000) gmLoad(); }, 2000);
  gmSync(); gmUI = gmClaimUI({ listKey: N.GM_KEY, canClaim: () => mode === 'online' && !!room && !!room.data && !room.local && !room.isGamemaster(), claim: code => room.claimGamemaster(code), onDone: () => { toast('Mode gamemaster aktif', 'good'); gmMeSync(); } }); applyLang(); hero(); root.requestAnimationFrame(frame);
  if ((location.hash || '').toLowerCase() === '#latihan') startSolo();
  root.addEventListener('hashchange', () => { if ((location.hash || '').toLowerCase() === '#latihan' && !room) startSolo(); });
  doc.querySelectorAll('.online-btn').forEach(b => { b.disabled = true; });
  if (conn.allowed) { try { await conn.start(); onlineOk = true; } catch (e) { conn.failed = true; onlineOk = false; } }
  doc.querySelectorAll('.online-btn').forEach(b => { b.disabled = !onlineOk; }); onlineNote(); if (gm) gmLoad();
  if (conn.code && conn.token) { try { await conn.leave(); } catch (e) { conn.forget(); } }
  const JR = root.JRInvite, invCode = JR && JR.code ? JR.code('room') : '';
  if (invCode && JR.run) {
    JR.run({ code: invCode, lang, gameName: 'Dapur Padang Panik', nameKey: NAME_KEY, nameMax: 24, accent: '#b3261e',
      check: async code => { if (!conn.allowed) return 'offline'; if (!onlineOk) return { fallback: T('onlineDown') }; return conn.probe(code); },
      join: async name => {
        $('nameInput').value = name; setLS(NAME_KEY, name);
        try { await enterOnline('join', { displayName: name, code: invCode }); return { ok: true }; }
        catch (e) {
          if (e.status === 409) { try { await enterOnline('watch', { displayName: name, code: invCode }); toast(T('errFull'), 'warn', 4000); return { ok: true }; } catch (e2) { /* fall through */ } }
          if (e.status === 404 || e.status === 422) return { ok: false, missing: true };
          return { ok: false, retry: true, message: errMsg(e) };
        }
      },
      fallback: () => {}
    });
  }
}
if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', boot); else boot();
root.DPApp = { get cam() { return cam; }, get sim() { return sim; }, get room() { return room; }, get mode() { return mode; }, get me() { return me; }, get tut() { return tut; }, get gm() { return gm; }, press, shout, sendChat, startSolo, startOnline, conn, get pend() { return pend; }, botStep, PLANS };
})(window);

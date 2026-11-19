/* Malam Pendakian: UI, input, solo + bots + tutorial, online host/client loop, chat, shouts/pings, GM, audio. */
(function (root) {
'use strict';
const doc = root.document, $ = id => doc.getElementById(id), G = root.MPGame, R = root.MPRender, N = root.MPNet, Sim = G.Sim, CFG = G.CFG;
/* ---------- JSON config (#website-config) ---------- */
let CONF = {}; try { CONF = JSON.parse($('website-config').textContent) || {}; } catch (e) { CONF = {}; }
(function mergeGame(gc) {
  if (!gc || typeof gc !== 'object') return;
  for (const k of ['speed', 'drain', 'batPick', 'give', 'fogTime', 'posBonus', 'allDownLose', 'reviveT']) if (Number.isFinite(gc[k]) && gc[k] > 0) CFG[k] = gc[k];
  for (const grp of ['light', 'pocong', 'kunti', 'fear']) if (gc[grp] && typeof gc[grp] === 'object') for (const k in gc[grp]) if (CFG[grp] && k in CFG[grp] && Number.isFinite(gc[grp][k])) CFG[grp][k] = gc[grp][k];
})(CONF.game);
const SITE = Object.assign({ title: 'Malam Pendakian', footer: '', termsUrl: '/syarat-ketentuan', gameHubUrl: 'https://gamehub.jadidaring.com/' }, CONF.site || {});
const SHOUTS = Array.isArray(CONF.shouts) && CONF.shouts.length ? CONF.shouts.slice(0, 6) : [{ icon: '📍', id: 'Sini!', en: 'Here!' }, { icon: '⚠️', id: 'Awas!', en: 'Watch out!' }];
/* ---------- storage + i18n ---------- */
const NAME_KEY = 'malampendakian.name', LANG_KEY = 'malampendakian.lang', MUTE_KEY = 'malampendakian.mute', TUT_KEY = 'malampendakian.tut', BEST_KEY = 'malampendakian.best', SET_KEY = 'malampendakian.set';
function getLS(k) { try { return root.localStorage.getItem(k) || ''; } catch (e) { return ''; } }
function setLS(k, v) { try { root.localStorage.setItem(k, v); } catch (e) { /* private mode */ } }
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
let lang = getLS(LANG_KEY) === 'en' ? 'en' : 'id', muted = getLS(MUTE_KEY) === '1';
let saved = { bots: 2, obots: 0 }; try { saved = Object.assign(saved, JSON.parse(getLS(SET_KEY) || '{}')); } catch (e) { /* ignore */ }
const saveSet = () => setLS(SET_KEY, JSON.stringify(saved));
const STR = {
  id: {
    tagline: 'Naik bareng, jangan sampai terpisah.', kick: 'Horor co-op 1–4 pemain · tanpa download', lead: SITE.lead || '', youTitle: 'Pendaki', name: 'Nama kamu',
    practiceTitle: 'Latihan (offline, bareng bot)', practiceSub: 'Jalur yang sama, ditemani teman bot. Bisa tanpa internet.', bots: 'Bot', practiceGo: 'Mulai mendaki', tutGo: 'Tutorial',
    onlineTitle: 'Mabar online (1–4 pendaki)', onlineSub: 'Satu rombongan, satu nasib. Ada chat, ping cepat, dan bot pengisi.',
    createPub: 'Buat room publik', createPriv: 'Buat room privat', match: 'Cari room cepat', codePh: 'KODE', join: 'Gabung', howTitle: 'Cara bertahan', terms: 'Syarat & Ketentuan',
    roomCode: 'Kode room', invite: 'Undang teman', leave: 'Keluar', players: 'Rombongan', start: 'Mulai mendaki!', you: 'kamu', host: 'host', botsNote: 'Host bisa menambah teman bot supaya rombongan lengkap.',
    visPub: 'Room publik: siapa saja bisa masuk lewat Cari room.', visPriv: 'Room privat: masuk pakai kode atau link undangan.', waitHost: 'Menunggu host mulai mendaki…', spectating: 'Kamu menonton.',
    exit: '✕', pause: '⏸', resume: '▶ Lanjut', paused: 'Jeda', skip: 'Lewati', give: 'Bagi', pray: 'Doa', on: 'Nyala', off: 'Mati', send: 'Kirim', chatPh: 'Ketik pesan…',
    soundOn: '🔊', soundOff: '🔇', again: 'Mendaki lagi', toLobby: 'Ke lobi', menu: 'Menu', waitAgain: 'Menunggu host…', copied: 'Link undangan disalin!',
    exitConfirm: 'Tinggalkan rombongan?', errName: 'Isi nama dulu ya.', errCode: 'Kode room 6 huruf.', errNet: 'Koneksi bermasalah, coba lagi.', errBusy: 'Server sibuk, tunggu {s} detik.',
    errMissing: 'Room tidak ditemukan.', errGeneric: 'Gagal: {msg}', errFull: 'Room penuh/sedang main, kamu masuk sebagai penonton.',
    onlineOff: 'Main online hanya di malampendakian.jadidaring.com. Latihan tetap bisa.', onlineDown: 'Server online sedang tidak bisa dihubungi. Latihan tetap bisa.',
    roomGone: 'Room sudah ditutup.', hostTook: 'Kamu sekarang host rombongan.', keys: 'Gerak: WASD · Arah senter: mouse · Senter nyala/mati: F · Bagi baterai: Q · Doa: tahan E · Chat: Enter · Teriak: 1–6 · Bantuan: H',
    helpT: 'Cara main', helpKeysH: 'Kontrol', helpBtn: 'Bantuan', helpClose: 'Oke, lanjut', helpLive: 'Game tetap jalan — teman masih mendaki.', helpTouch: 'Di HP', helpKey: 'Keyboard + mouse',
    hMove: 'Jalan', hMoveT: 'Joystick kiri', hAim: 'Arahkan senter', hAimT: 'Geser jari di layar', hAimK: 'Gerakkan mouse', hLight: 'Senter nyala/mati', hShare: 'Bagi 🔋 ke teman dekat', hPray: 'Doa (tolong teman kesurupan)', hPrayT: 'Tahan 🙏', hPrayK: 'Tahan E', hChat: 'Chat / teriak cepat', hChatT: '💬 + tombol teriak', hChatK: 'Enter · 1–6',
    gP: '<b>Pocong</b> melompat mendekat. Sorot terus sampai lingkaran penuh → hilang.', gK: '<b>Kuntilanak</b> muncul di pohon lalu menyerang ±5 dtk. Sorot cepat!', gGoal: '<b>Tujuan:</b> nyalakan Pos 1–3 (kabut mundur, baterai terisi), lalu semua kumpul di ⛩ Puncak sebelum 🌫️ penuh.', gFear: '<b>😨 Takut</b> naik di gelap & sendirian, turun dekat teman/lampu. Penuh = kesurupan.',
    legend: '<b>WASD</b> jalan · <b>mouse</b> arah senter · <b>F</b> senter · <b>Q</b> bagi · <b>E</b> doa · <b>H</b> bantuan', legendT: '🕹️ kiri = jalan · 👆 geser layar = arah senter · 🔦 nyala/mati · ❓ bantuan',
    gmTitle: 'Semua lobi (GM)', gmRefresh: 'Muat ulang', gmLoading: 'Memuat…', gmEmpty: 'Tidak ada lobi aktif.', gmCount: '{n} lobi aktif', gmErr: 'Gagal memuat: {msg}',
    gmPrivate: 'Privat', gmPublic: 'Publik', gmPlaying: 'Main', gmWaiting: 'Menunggu', gmPlayers: '{n}/{max} pendaki · {w} penonton', gmJoin: 'Gabung', gmWatch: 'Tonton',
    best: 'Rekor: {s}⭐ dalam {t}', bestNone: 'Belum pernah sampai puncak.', newBest: 'Rekor baru!', chatSys: '{n} bergabung', chatLeft: '{n} pergi', chatSlow: 'Pelan-pelan, satu pesan per detik.', solo: 'Latihan',
    win: 'Sampai Puncak!', loseFog: 'Kabut menelan rombongan…', loseDown: 'Semua kesurupan…', winSub: 'Rombongan selamat. Doa di tugu puncak terkabul.', loseSub: 'Turun dulu, coba lagi. Ikuti pita merah, jaga baterai, tetap dekat.',
    endKick: 'Malam Pendakian', t_time: 'Waktu', t_fog: 'Kabut', t_ban: 'Hantu diusir', t_down: 'Kesurupan', t_give: 'Bagi baterai', t_pick: 'Baterai dipungut', t_pos: 'Pos menyala',
    downMe: 'Kamu kesurupan! Tahan 🙏 Doa (atau tunggu teman).', downOther: '{n} kesurupan! Dekati & tahan 🙏', revMe: 'Kamu sadar kembali!', revOther: '{n} sadar kembali', posLit: 'Pos {n} menyala! Kabut −{s} dtk', gather: 'Kumpul semua di Puncak!',
    giveOk: 'Baterai dibagi +{v}', giveLow: 'Baterai kamu tinggal sedikit', giveNone: 'Dekati teman yang baterainya kurang', batLow: 'Baterai hampir habis! Cari ✨ atau minta teman', darkFear: 'Gelap bikin takut. Nyalakan senter / dekati teman',
    fogWarn: 'Kabut makin tebal…', youName: 'Kamu', kesurupan: 'Kesurupan!', specBadge: '👀 Menonton', followRib: 'Ikuti pita merah sampai Puncak!',
    how1: '<b>Ikuti jalur & pita merah</b> ke atas. Tetap dekat rombongan: sendirian di gelap bikin takut.', how2: '<b>Senter</b> membekukan pocong dan mengusir kuntilanak. Tapi baterai terbatas: matikan saat aman, pungut ✨.',
    how3: '<b>Kesurupan?</b> Teman mendekat dan tahan 🙏 Doa (E). Bagi 🔋 (Q) ke teman yang kehabisan.', how4: '<b>Nyalakan 3 Pos</b> (mengusir kabut) lalu kumpul semua di <b>Puncak</b> sebelum kabut penuh.',
    t1: 'Geser <b>joystick kiri</b> (keyboard: <kbd>W A S D</kbd>) dan ikuti <b>jalur tanah</b> ke atas.', t2: 'Senter menguras 🔋. Tekan <b>🔦</b> (keyboard: <kbd>F</kbd>) untuk mematikan, lalu nyalakan lagi.', t3: 'Pungut <b>baterai berkilau ✨</b> di jalur (+40).',
    t4: '<b>Pocong!</b> Arahkan senter ke dia: <b>geser jari di layar</b> (PC: gerakkan <b>mouse</b>) sampai lingkarannya penuh.', t5: '<b>Kuntilanak</b> di pohon! Sorot cepat sebelum dia menyerang.', t6: 'Lanjut naik dan nyalakan <b>Pos 1</b>: lampunya mengusir kabut & mengisi baterai. Teman kehabisan? Tombol <b>🔋 Bagi</b> (<kbd>Q</kbd>).',
    t7: '<b>Raka kesurupan!</b> Dekati dia dan <b>tahan 🙏 Doa</b> (<kbd>E</kbd>) sampai pulih.', tEnd: 'Mantap! Mulai sekarang kabut turun beneran. Nyalakan semua Pos dan capai Puncak bersama! Lupa kontrol? Tekan ❓.', tutDone: 'Tutorial selesai'
  },
  en: {
    tagline: 'Climb together, never split up.', kick: 'Co-op horror for 1–4 · no download', lead: 'Co-op horror for 1–4 players on your phone, no download. Hike a mountain at midnight with flashlights, follow the red ribbons, light up pocong and kuntilanak until they vanish, and reach the summit before the fog swallows your group.',
    youTitle: 'Hiker', name: 'Your name', practiceTitle: 'Practice (offline, with bots)', practiceSub: 'Same trail, with bot companions. Works offline.', bots: 'Bots', practiceGo: 'Start hiking', tutGo: 'Tutorial',
    onlineTitle: 'Play online (1–4 hikers)', onlineSub: 'One group, one fate. Chat, quick pings and filler bots.', createPub: 'Create public room', createPriv: 'Create private room', match: 'Quick match', codePh: 'CODE', join: 'Join',
    howTitle: 'How to survive', terms: 'Terms & Conditions', roomCode: 'Room code', invite: 'Invite friends', leave: 'Leave', players: 'Group', start: 'Start hiking!', you: 'you', host: 'host', botsNote: 'The host can add bot companions to fill the group.',
    visPub: 'Public room: anyone can join via Quick match.', visPriv: 'Private room: join with the code or invite link.', waitHost: 'Waiting for the host…', spectating: 'You are watching.',
    exit: '✕', pause: '⏸', resume: '▶ Resume', paused: 'Paused', skip: 'Skip', give: 'Share', pray: 'Pray', on: 'On', off: 'Off', send: 'Send', chatPh: 'Type a message…',
    soundOn: '🔊', soundOff: '🔇', again: 'Hike again', toLobby: 'To lobby', menu: 'Menu', waitAgain: 'Waiting for the host…', copied: 'Invite link copied!',
    exitConfirm: 'Leave the group?', errName: 'Enter a name first.', errCode: 'Room code is 6 letters.', errNet: 'Connection problem, try again.', errBusy: 'Server busy, wait {s} s.',
    errMissing: 'Room not found.', errGeneric: 'Failed: {msg}', errFull: 'Room is full/playing, you joined as a spectator.', onlineOff: 'Online play only on malampendakian.jadidaring.com. Practice still works.',
    onlineDown: 'The online server is unreachable. Practice still works.', roomGone: 'The room was closed.', hostTook: 'You are now the group host.', keys: 'Move: WASD · Aim flashlight: mouse · Flashlight on/off: F · Share battery: Q · Pray: hold E · Chat: Enter · Shout: 1–6 · Help: H',
    helpT: 'How to play', helpKeysH: 'Controls', helpBtn: 'Help', helpClose: 'Got it', helpLive: 'The game keeps running — your friends are still hiking.', helpTouch: 'On phone', helpKey: 'Keyboard + mouse',
    hMove: 'Walk', hMoveT: 'Left joystick', hAim: 'Aim flashlight', hAimT: 'Drag on the screen', hAimK: 'Move the mouse', hLight: 'Flashlight on/off', hShare: 'Share 🔋 with a nearby friend', hPray: 'Pray (help a possessed friend)', hPrayT: 'Hold 🙏', hPrayK: 'Hold E', hChat: 'Chat / quick shouts', hChatT: '💬 + shout buttons', hChatK: 'Enter · 1–6',
    gP: '<b>Pocong</b> hops toward you. Keep it lit until the ring fills → gone.', gK: '<b>Kuntilanak</b> appears in a tree and strikes after ~5 s. Light her fast!', gGoal: '<b>Goal:</b> light Posts 1–3 (fog recedes, batteries recharge), then everyone gathers at the ⛩ Summit before 🌫️ fills.', gFear: '<b>😨 Fear</b> rises in the dark & alone, drops near friends/lamps. Full = possessed.',
    legend: '<b>WASD</b> walk · <b>mouse</b> aim · <b>F</b> light · <b>Q</b> share · <b>E</b> pray · <b>H</b> help', legendT: '🕹️ left = walk · 👆 drag screen = aim · 🔦 on/off · ❓ help',
    gmTitle: 'All lobbies (GM)', gmRefresh: 'Refresh', gmLoading: 'Loading…', gmEmpty: 'No active lobbies.', gmCount: '{n} active lobbies', gmErr: 'Load failed: {msg}', gmPrivate: 'Private', gmPublic: 'Public',
    gmPlaying: 'Playing', gmWaiting: 'Waiting', gmPlayers: '{n}/{max} hikers · {w} watching', gmJoin: 'Join', gmWatch: 'Watch',
    best: 'Best: {s}⭐ in {t}', bestNone: 'Never reached the summit yet.', newBest: 'New record!', chatSys: '{n} joined', chatLeft: '{n} left', chatSlow: 'Slow down, one message per second.', solo: 'Practice',
    win: 'Summit reached!', loseFog: 'The fog swallowed the group…', loseDown: 'Everyone got possessed…', winSub: 'The group made it. The summit shrine heard your prayers.', loseSub: 'Head down and try again. Follow the ribbons, save battery, stay close.',
    endKick: 'Malam Pendakian', t_time: 'Time', t_fog: 'Fog', t_ban: 'Ghosts banished', t_down: 'Possessed', t_give: 'Battery shared', t_pick: 'Batteries found', t_pos: 'Posts lit',
    downMe: 'You are possessed! Hold 🙏 Pray (or wait for a friend).', downOther: '{n} is possessed! Get close & hold 🙏', revMe: 'You came back to your senses!', revOther: '{n} is back', posLit: 'Post {n} lit! Fog −{s} s', gather: 'Everyone gather at the summit!',
    giveOk: 'Battery shared +{v}', giveLow: 'Your battery is too low', giveNone: 'Get close to a friend who needs battery', batLow: 'Battery almost empty! Find ✨ or ask a friend', darkFear: 'Darkness is scary. Light up or stay close',
    fogWarn: 'The fog is getting thicker…', youName: 'You', kesurupan: 'Possessed!', specBadge: '👀 Watching', followRib: 'Follow the red ribbons to the summit!',
    how1: '<b>Follow the trail & red ribbons</b> uphill. Stay close: alone in the dark your fear rises.', how2: '<b>Flashlights</b> freeze pocong and banish kuntilanak. Battery is limited: switch off when safe, pick up ✨.',
    how3: '<b>Possessed?</b> A friend gets close and holds 🙏 Pray (E). Share 🔋 (Q) with friends who run out.', how4: '<b>Light 3 Posts</b> (they push back the fog) then gather everyone at the <b>Summit</b> before the fog is full.',
    t1: 'Drag the <b>left joystick</b> (keyboard: <kbd>W A S D</kbd>) and follow the <b>dirt trail</b> uphill.', t2: 'The flashlight drains 🔋. Tap <b>🔦</b> (keyboard: <kbd>F</kbd>) to switch it off, then on again.', t3: 'Pick up a <b>sparkling battery ✨</b> on the trail (+40).',
    t4: '<b>Pocong!</b> Point your flashlight at it: <b>drag on the screen</b> (PC: move the <b>mouse</b>) until the ring fills.', t5: 'A <b>kuntilanak</b> in the trees! Light her up before she strikes.', t6: 'Keep climbing and light <b>Post 1</b>: its lamp pushes back the fog & recharges batteries. Friend out of power? <b>🔋 Share</b> (<kbd>Q</kbd>).',
    t7: '<b>Raka is possessed!</b> Get close and <b>hold 🙏 Pray</b> (<kbd>E</kbd>) until he recovers.', tEnd: 'Great! From now on the fog is real. Light every post and reach the summit together! Forgot the controls? Press ❓.', tutDone: 'Tutorial complete'
  }
};
function T(k, v) { let s = (STR[lang] && STR[lang][k] != null) ? STR[lang][k] : (STR.id[k] != null ? STR.id[k] : k); if (v) s = String(s).replace(/\{(\w+)\}/g, (m, x) => v[x] != null ? v[x] : m); return s; }
function applyLang() {
  doc.documentElement.lang = lang;
  doc.querySelectorAll('[data-t]').forEach(e => { e.innerHTML = T(e.dataset.t); });
  doc.querySelectorAll('[data-tp]').forEach(e => { e.placeholder = T(e.dataset.tp); });
  doc.querySelectorAll('[data-c]').forEach(e => { e.textContent = SITE[e.dataset.c] || ''; });
  doc.querySelectorAll('.lb').forEach(b => b.classList.toggle('on', b.dataset.lang === lang));
  $('termsLink').href = SITE.termsUrl || '/syarat-ketentuan'; $('hubLink').href = SITE.gameHubUrl || 'https://gamehub.jadidaring.com/';
  paintMute(); renderHow(); renderShouts(); renderBest(); if (room) renderRoom(); hudKey = ''; if (tut) tutPaint();
}
/* ---------- audio (WebAudio, all synthesized) ---------- */
let actx = null, master = null, amb = null;
function ac() { if (muted) return null; try { if (!actx) { actx = new (root.AudioContext || root.webkitAudioContext)(); master = actx.createGain(); master.gain.value = 0.9; master.connect(actx.destination); } if (actx.state === 'suspended') actx.resume(); return actx; } catch (e) { return null; } }
function tone(f, ms, type = 'sine', vol = 0.05, slide = 0, delay = 0) {
  const a = ac(); if (!a) return; const t = a.currentTime + delay / 1000, o = a.createOscillator(), g = a.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, f + slide), t + ms / 1000);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + ms / 1000); o.connect(g); g.connect(master); o.start(t); o.stop(t + ms / 1000 + 0.03);
}
let nbuf = null;
function noiseBuf(a) { if (!nbuf) { nbuf = a.createBuffer(1, a.sampleRate, a.sampleRate); const d = nbuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; } return nbuf; }
function noise(ms, vol = 0.05, freq = 800, type = 'highpass', delay = 0) {
  const a = ac(); if (!a) return; const s = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain(), t = a.currentTime + delay / 1000; s.buffer = noiseBuf(a); f.type = type; f.frequency.value = freq;
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + ms / 1000); s.connect(f); f.connect(g); g.connect(master); s.start(t, Math.random() * 0.5); s.stop(t + ms / 1000 + 0.05);
}
function ambience(on) {
  const a = on ? ac() : actx; if (!a) return;
  if (on && !amb) { const s = a.createBufferSource(); s.buffer = noiseBuf(a); s.loop = true; const f = a.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 420; f.Q.value = 0.6; const g = a.createGain(); g.gain.value = 0.0; const lfo = a.createOscillator(), lg = a.createGain(); lfo.frequency.value = 0.09; lg.gain.value = 180; lfo.connect(lg); lg.connect(f.frequency); s.connect(f); f.connect(g); g.connect(master); s.start(); lfo.start(); g.gain.setTargetAtTime(0.05, a.currentTime, 1.5); amb = { s, g, lfo }; }
  else if (!on && amb) { const x = amb; amb = null; try { x.g.gain.setTargetAtTime(0, actx.currentTime, 0.3); setTimeout(() => { try { x.s.stop(); x.lfo.stop(); } catch (e) { /* stopped */ } }, 1200); } catch (e) { /* closed */ } }
}
const SFX = {
  click: () => { tone(1800, 30, 'square', 0.03); tone(900, 40, 'square', 0.025, 0, 25); }, step: () => noise(55, 0.018, 900, 'bandpass'),
  bat: () => { [880, 1175, 1568].forEach((f, i) => tone(f, 120, 'triangle', 0.06, 0, i * 60)); }, give: () => { tone(660, 120, 'triangle', 0.06, 300); tone(990, 160, 'sine', 0.05, 0, 110); },
  thump: () => { tone(70, 160, 'sine', 0.16, -30); noise(90, 0.05, 300, 'lowpass'); }, hihi: () => { for (let i = 0; i < 4; i++) tone(1250 - i * 60, 110, 'triangle', 0.035, -200, i * 140); },
  stinger: () => { tone(110, 900, 'sawtooth', 0.09, -60); tone(233, 700, 'sawtooth', 0.06, 40); noise(500, 0.12, 2500); }, scream: () => { tone(1600, 600, 'sawtooth', 0.05, -900); noise(400, 0.08, 3500); },
  banish: () => { [1047, 1319, 1568, 2093].forEach((f, i) => tone(f, 260, 'sine', 0.05, 0, i * 55)); noise(300, 0.03, 5000); }, pos: () => { [523, 659, 784].forEach((f, i) => tone(f, 400, 'triangle', 0.06, 0, i * 110)); tone(1047, 600, 'sine', 0.05, 0, 330); },
  down: () => { tone(300, 900, 'sine', 0.07, -220); tone(304, 900, 'sine', 0.05, -230); }, rev: () => { [392, 523, 659, 784].forEach((f, i) => tone(f, 200, 'sine', 0.06, 0, i * 80)); },
  beat: (v) => { tone(58, 120, 'sine', 0.12 * v, -10); tone(52, 130, 'sine', 0.09 * v, -10, 170); }, cricket: () => { for (let i = 0; i < 3; i++) tone(4300 + Math.random() * 300, 28, 'sine', 0.008, 0, i * 55); },
  owl: () => { tone(390, 260, 'sine', 0.025, -40); tone(370, 380, 'sine', 0.025, -50, 330); }, shout: () => tone(700, 90, 'square', 0.035, 200), chat: () => tone(990, 50, 'sine', 0.03),
  win: () => { [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 260, 'triangle', 0.07, 0, i * 130)); }, lose: () => { [392, 330, 262, 196].forEach((f, i) => tone(f, 380, 'sine', 0.06, -20, i * 230)); }, star: () => tone(1320, 160, 'sine', 0.07, 400)
};
function paintMute() { ['muteBtn', 'muteBtn2'].forEach(id => { const b = $(id); if (b) { b.textContent = muted ? T('soundOff') : T('soundOn'); b.setAttribute('aria-pressed', muted ? 'true' : 'false'); } }); }
/* ---------- small UI helpers ---------- */
const toastAt = {};
function toast(msg, kind = '', ms = 2400) { const el = doc.createElement('div'); el.className = 'toast ' + kind; el.textContent = msg; $('toasts').appendChild(el); setTimeout(() => el.remove(), ms); while ($('toasts').children.length > 3) $('toasts').firstChild.remove(); }
function hint(key, msg, kind, gap = 6000) { if ($('game').hidden || (sim && sim.ph !== 'run')) return; const n = Date.now(); if (n - (toastAt[key] || 0) < gap) return; toastAt[key] = n; toast(msg, kind || 'warn', 2600); }
let bannerT = 0;
function banner(html, ms = 2200, kind = '') { const b = $('banner'); b.innerHTML = html; b.className = 'banner ' + kind; b.hidden = false; clearTimeout(bannerT); bannerT = setTimeout(() => { b.hidden = true; }, ms); }
function show(id) {
  ['home', 'lobby', 'game', 'end'].forEach(s => { $(s).hidden = s !== id; }); doc.documentElement.classList.toggle('jr-hub-off', id === 'game');
  const slot = id === 'lobby' ? 'lobbyChatSlot' : id === 'end' ? 'endChatSlot' : id === 'game' ? 'gameChatSlot' : null;
  $('chat').hidden = !slot || mode !== 'online'; if (slot && $(slot) && $('chat').parentNode !== $(slot)) $(slot).appendChild($('chat'));
  $('endChatSlot').hidden = mode !== 'online'; $('game').classList.toggle('solo', mode !== 'online'); $('game').classList.toggle('demo', mode === 'demo');
  if (id !== 'game') { $('gameChatSlot').hidden = true; ambience(false); } else { fit(); setTimeout(fit, 60); }
  if (id !== 'game') toggleHelp(false);
  if (id === 'end' || id === 'home') { $('toasts').replaceChildren(); $('scare').className = 'scare'; }
  if (id !== 'home') root.scrollTo(0, 0);
}
function seg(id, val, onPick) { const el = $(id); const paint = v => el.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.v === String(v))); paint(val); el.addEventListener('click', e => { const b = e.target.closest('button'); if (!b || el.classList.contains('ro')) return; paint(b.dataset.v); onPick(Number(b.dataset.v)); }); return paint; }
function bucket(cap, perSec) { let tokens = cap, at = Date.now(); return { take() { const n = Date.now(); tokens = Math.min(cap, tokens + (n - at) / 1000 * perSec); at = n; if (tokens >= 1) { tokens -= 1; return true; } return false; }, get n() { return tokens; } }; }
const myName = () => $('nameInput').value.replace(/\s+/g, ' ').trim().slice(0, 24);
const fmtT = s => { s = Math.max(0, Math.round(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
const BOT_NAMES = ['Raka', 'Sari', 'Dimas'];

/* =====================================================================
   STATE
   ===================================================================== */
let mode = null, sim = null, me = 1, paused = false, room = null, onlineOk = false, hostG = null, seenV = 0, endSent = false, starting = false, wasHost = null;
let lastEvN = 0, evG = null, lastFrame = 0, simAcc = 0, tut = null, ended = false, soloRun = 0, soloBots = 2;
const SIM_MS = 50, fx = R.makeFx(), disp = {}, cam = { x: 15, y: 300, init: false };
let ss = null; try { ss = root.sessionStorage; } catch (e) { ss = null; }
const conn = new N.Connection({ storage: ss, onWake: () => { if (room) room.refresh(); }, onSocket: () => {}, lobbyWake: () => gmWake() });
const cv = $('board'); let CW = 360, CH = 640, DPR = 1, TS = 36;
function fit() {
  if ($('game').hidden) return; const w = root.innerWidth, h = root.innerHeight; CW = w; CH = h; DPR = Math.min(2, root.devicePixelRatio || 1);
  TS = Math.max(28, Math.min(58, Math.round(Math.min(w / 10.5, h / 15))));
  cv.style.width = w + 'px'; cv.style.height = h + 'px'; cv.width = Math.round(w * DPR); cv.height = Math.round(h * DPR);
}
const myH = () => (sim ? sim.hiker(me) : null);
const isHostNow = () => mode === 'solo' || mode === 'demo' || (mode === 'online' && room && room.isHost());
/* ---------- input ---------- */
const keys = new Set(), joy = { x: 0, y: 0, on: false }, aim = { on: false, x: 0, y: 0, mouse: false, at: 0 };
let lightWant = 1, prayHeld = false;
const KV = { ArrowUp: [0, -1], KeyW: [0, -1], ArrowDown: [0, 1], KeyS: [0, 1], ArrowLeft: [-1, 0], KeyA: [-1, 0], ArrowRight: [1, 0], KeyD: [1, 0] };
function inputVec() { let x = joy.x, y = joy.y; for (const k of keys) { const v = KV[k]; if (v) { x += v[0]; y += v[1]; } } const m = Math.hypot(x, y); return m > 1 ? [x / m, y / m] : [x, y]; }
doc.addEventListener('keydown', e => {
  if ($('game').hidden || mode === 'demo') return; const inInput = e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA');
  if (inInput) { if (e.code === 'Escape') e.target.blur(); return; }
  if (helpOpen && (e.code === 'Escape' || e.code === 'KeyH')) { e.preventDefault(); toggleHelp(false); return; }
  if (KV[e.code]) { e.preventDefault(); keys.add(e.code); return; }
  if (e.code === 'KeyE' || e.code === 'KeyR') { e.preventDefault(); setPray(true); return; }
  if (e.repeat) return;
  if (e.code === 'Space' || e.code === 'KeyF') { e.preventDefault(); toggleLight(); }
  else if (e.code === 'KeyQ') { e.preventDefault(); give(); }
  else if (e.code === 'KeyH' || e.code === 'Slash') { e.preventDefault(); toggleHelp(); }
  else if (e.code === 'Enter' && mode === 'online') { e.preventDefault(); openChat(true); }
  else if (/^Digit[1-6]$/.test(e.code)) { e.preventDefault(); shout(Number(e.code.slice(5)) - 1); }
  else if ((e.code === 'KeyP' || e.code === 'Escape') && mode === 'solo') { e.preventDefault(); togglePause(); }
});
doc.addEventListener('keyup', e => { keys.delete(e.code); if (e.code === 'KeyE' || e.code === 'KeyR') setPray(false); });
root.addEventListener('blur', () => { keys.clear(); joy.x = joy.y = 0; setPray(false); });
(function joystick() {
  const el = $('joy'), kn = $('knob'); let pid = null, cx = 0, cy = 0;
  const set = (x, y) => { const R2 = el.clientWidth / 2 - 12, dx = x - cx, dy = y - cy, d = Math.hypot(dx, dy), k = d > R2 ? R2 / d : 1; kn.style.transform = 'translate(' + dx * k + 'px,' + dy * k + 'px)'; const m = Math.min(1, d / R2); joy.x = d > 6 ? dx / d * m : 0; joy.y = d > 6 ? dy / d * m : 0; if (m > 0.8) { joy.x = dx / d; joy.y = dy / d; } };
  el.addEventListener('pointerdown', e => { e.preventDefault(); pid = e.pointerId; try { el.setPointerCapture(pid); } catch (x) { /* old browsers */ } const r = el.getBoundingClientRect(); cx = r.left + r.width / 2; cy = r.top + r.height / 2; joy.on = true; set(e.clientX, e.clientY); ac(); });
  el.addEventListener('pointermove', e => { if (e.pointerId === pid) set(e.clientX, e.clientY); });
  const up = e => { if (pid != null && e.pointerId !== pid) return; pid = null; joy.on = false; joy.x = joy.y = 0; kn.style.transform = ''; };
  el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up); el.addEventListener('lostpointercapture', up);
})();
/* aim: drag anywhere on the canvas (touch) or move the mouse */
(function aimInput() {
  let pid = null;
  const at = e => { aim.x = e.clientX; aim.y = e.clientY; aim.at = performance.now(); };
  cv.addEventListener('pointerdown', e => { if (mode === 'demo') return; ac(); if (e.pointerType === 'mouse') { aim.mouse = true; at(e); return; } pid = e.pointerId; try { cv.setPointerCapture(pid); } catch (x) { /* ignore */ } aim.on = true; at(e); });
  cv.addEventListener('pointermove', e => { if (e.pointerType === 'mouse') { aim.mouse = true; at(e); return; } if (e.pointerId === pid) at(e); });
  const up = e => { if (e.pointerId === pid) { pid = null; aim.on = false; } };
  cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
  cv.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') aim.mouse = false; });
})();
function holdBtn(id, down, upFn) { const b = $(id); b.addEventListener('pointerdown', e => { e.preventDefault(); ac(); b.classList.add('hit'); down(); }); const u = () => { b.classList.remove('hit'); if (upFn) upFn(); }; b.addEventListener('pointerup', u); b.addEventListener('pointercancel', u); b.addEventListener('pointerleave', u); b.addEventListener('contextmenu', e => e.preventDefault()); b.addEventListener('click', e => { if (e.detail === 0) { down(); if (upFn) setTimeout(upFn, 2600); } }); }
holdBtn('lightBtn', () => toggleLight());
holdBtn('giveBtn', () => give());
holdBtn('prayBtn', () => setPray(true), () => setPray(false));
holdBtn('chatBtn', () => openChat());
function toggleLight() { const h = myH(); if (!h || h.dn || mode === 'demo') return; lightWant = lightWant ? 0 : 1; h.on = lightWant; SFX.click(); if (tut) tut.tg = (tut.tg || 0) + 1; dirtyIn(true); }
function setPray(v) { if (prayHeld === v) return; prayHeld = v; const h = myH(); if (h) h.rv = v ? 1 : 0; $('prayBtn').classList.toggle('on', v); dirtyIn(true); }
let opQ = 0, pend = [];
function give() {
  const h = myH(); if (!h || h.dn || !sim || sim.ph !== 'run' || mode === 'demo') return;
  if (mode === 'online' && !room.isHost()) { if (h.bat < CFG.give + 5) return hint('gl', T('giveLow')); if (!sim.hikers.some(o => o !== h && !o.dn && Math.hypot(o.x - h.x, o.y - h.y) < 1.9 && o.bat < CFG.batMax - 10)) return hint('gn', T('giveNone')); pend.push([++opQ, 'b']); SFX.give(); sendIn(true); return; }
  const r = sim.apply(me, 'b'); if (r === 'low') hint('gl', T('giveLow')); else if (r === 'none') hint('gn', T('giveNone'));
  if (mode === 'online') hostDirty = true;
}
let inDirty = false; function dirtyIn(urgent) { if (mode === 'online' && room && !room.isHost()) { inDirty = true; if (urgent) sendIn(true); } else if (mode === 'online') hostDirty = true; }

/* ---------- events from the authoritative sim (or a received snapshot) ---------- */
function nameOf(pid) { const c = sim && sim.hiker(pid); if (c) return c.id === me ? T('youName') : c.name; const p = room && room.players().find(q => q.id === pid); return p ? p.displayName : '?'; }
let flash = 0, shake = 0;
let scareT = 0; function scare(k) { const el = $('scare'); el.className = 'scare'; void el.offsetWidth; el.className = 'scare on ' + (k === 'k' ? 'k' : 'p'); clearTimeout(scareT); scareT = setTimeout(() => { el.className = 'scare'; }, 720); }
function playEvents(ev, g) {
  if (g !== evG) { evG = g; lastEvN = 0; for (const e of ev || []) lastEvN = Math.max(lastEvN, e[0]); return; }
  const h = myH(), near = (x, y, r) => !h || Math.hypot(h.x - x, h.y - y) < r;
  for (const e of ev || []) {
    if (e[0] <= lastEvN) continue; lastEvN = e[0]; const [, k, x, y, id, ex] = e, mine = id === me;
    if (mode === 'demo') { if (k === 'ban') fx.burst(x, y - 0.5, ['#fff', '#fff1a8', '#cfe6ff'], 18, 2.6, { glow: true }); if (k === 'pos') fx.burst(x, y - 1, ['#ffcf6a', '#ff9a3c', '#fff'], 24, 3, { glow: true }); continue; }
    if (k === 'spP') { if (near(x, y, 11)) SFX.thump(); }
    else if (k === 'spK') { if (near(x, y, 9)) SFX.hihi(); }
    else if (k === 'ban') { SFX.banish(); fx.burst(x, y - 0.5, ['#ffffff', '#fff1a8', '#cfe6ff'], 26, 3, { glow: true, life: 0.9 }); fx.text(x, y - 1.2, ex === 'k' ? '✨ Kunti!' : '✨ Pocong!', '#fff1a8'); }
    else if (k === 'jump') { if (mine) { SFX.stinger(); flash = 1; shake = 16; scare('p'); if (root.navigator.vibrate) root.navigator.vibrate(180); } else if (near(x, y, 9)) SFX.thump(); fx.burst(x, y - 0.4, ['#fff', '#ddd'], 14, 3); }
    else if (k === 'swoop') { if (mine) { SFX.scream(); flash = 1; shake = 14; scare('k'); if (root.navigator.vibrate) root.navigator.vibrate(160); } else if (near(x, y, 9)) SFX.hihi(); fx.burst(x, y - 0.6, ['#fff', '#ff3a3a', '#111'], 16, 3.5); }
    else if (k === 'fade') { fx.burst(x, y - 0.4, ['rgba(255,255,255,.6)'], 8, 1.2); }
    else if (k === 'bat') { if (mine || near(x, y, 6)) SFX.bat(); fx.burst(x, y - 0.3, ['#f3c63c', '#fff6c8'], 12, 2, { glow: true }); fx.text(x, y - 0.8, '+' + CFG.batPick + '🔋', '#ffe27a'); }
    else if (k === 'give') { SFX.give(); const t = sim && sim.hiker(ex); fx.text(t ? t.x : x, (t ? t.y : y) - 1, '+' + CFG.give + '🔋', '#ffe27a'); if (ex === me) toast(T('giveOk', { v: CFG.give }), 'good', 1800); }
    else if (k === 'pos') { SFX.pos(); fx.burst(x, y - 1, ['#ffcf6a', '#ff9a3c', '#fff'], 34, 3.2, { glow: true, life: 1.1 }); banner('🏮 ' + esc(T('posLit', { n: (ex | 0) + 1, s: CFG.posBonus })), 2600, 'warm'); }
    else if (k === 'down') { SFX.down(); fx.burst(x, y - 0.6, ['#c49bff', '#7a3cff', '#fff'], 18, 2.4); if (mine) { banner('🌀 ' + esc(T('downMe')), 3200, 'purple'); flash = 0.7; } else toast(T('downOther', { n: nameOf(id) }), 'warn', 3200); }
    else if (k === 'rev') { SFX.rev(); fx.burst(x, y - 0.6, ['#ffe28a', '#fff'], 22, 2.6, { glow: true }); if (mine) toast(T('revMe'), 'good'); else toast(T('revOther', { n: nameOf(id) }), 'good', 1800); }
  }
}
/* ---------- shouts (bubbles + map pings) ---------- */
const bubbles = {}, pings = []; let shoutSeq = 0, shoutAt = 0, outShout = null;
function showShout(pid, idx, x, y) {
  const sh = SHOUTS[idx]; if (!sh) return; const label = (sh.icon || '') + ' ' + (sh[lang] || sh.id); bubbles[pid] = { t: label, until: performance.now() + 2600 }; SFX.shout();
  if (Number.isFinite(x) && (idx === 0 || idx === 1 || idx === 5)) { pings.push({ x, y, icon: sh.icon || '❗', at: performance.now() }); if (pings.length > 6) pings.shift(); }
  if (mode === 'online') addChatLine({ k: 'sh' + Date.now() + pid + idx, p: pid, n: nameOf(pid), x: label, t: 'sh' });
}
function shout(idx) {
  if (!sim || !SHOUTS[idx] || mode === 'demo') return; const n = Date.now(); if (n - shoutAt < 900) return; shoutAt = n; const h = myH();
  if (mode === 'online' && (!room || room.spectator)) return;
  if (mode === 'online' && room.s.ph !== 'play') { sendChat((SHOUTS[idx].icon || '') + ' ' + (SHOUTS[idx][lang] || SHOUTS[idx].id)); return; }
  if (!h) return; showShout(me, idx, h.x, h.y);
  if (isHostNow()) { sim.shout(me, idx); seenHs.add(sim.hs[sim.hs.length - 1][0] + ':' + me); hostDirty = true; }
  else { outShout = [++shoutSeq, idx]; sendIn(true); }
}
const seenHs = new Set();
function readShouts(hs) { for (const h of hs || []) { if (!Array.isArray(h)) continue; const key = h[0] + ':' + h[1]; if (seenHs.has(key)) continue; seenHs.add(key); if (h[1] !== me) showShout(h[1], h[2] | 0, +h[3], +h[4]); } if (seenHs.size > 400) seenHs.clear(); }
function renderShouts() { const el = $('shouts'); if (!el) return; el.innerHTML = SHOUTS.map((s, i) => '<button type="button" data-sh="' + i + '" title="' + (i + 1) + '"><span>' + esc(s.icon || '') + '</span><small>' + esc(s[lang] || s.id) + '</small><kbd class="kk">' + (i + 1) + '</kbd></button>').join(''); }
$('shouts').addEventListener('click', e => { const b = e.target.closest('[data-sh]'); if (b) shout(Number(b.dataset.sh)); });

/* =====================================================================
   FRAME LOOP (local movement, prediction, camera, render, HUD)
   ===================================================================== */
let hudKey = '', hintKey = '', lastStep = 0, ambAt = 0, beatAt = 0, ffAt = 0, lastInAt = 0, lastInKey = '', hostDirty = false;
function sx(x) { return CW / 2 + (x - cam.x) * TS; }
function sy(y) { return CH / 2 + (y - cam.y) * TS; }
function goalOf() { if (!sim) return null; const m = sim.map, i = sim.lit.findIndex(v => !v); return i >= 0 ? m.pos[i] : m.shrine; }
function camTarget() {
  const h = myH(); if (h && mode !== 'demo') {
    let oy = 0; const d = $('gameChatSlot'); if (!d.hidden) { const top = d.getBoundingClientRect().top, want = top - TS * 1.6, cur = CH / 2 + 1.3 * TS; if (cur > want) oy = (cur - want) / TS; }
    return [h.x + Math.cos(h.f) * 0.9, h.y - 1.3 + oy + Math.sin(h.f) * 0.9 * (oy ? 0.3 : 1)]; }
  const al = sim.hikers.filter(o => !o.dn), L = al.length ? al : sim.hikers; if (!L.length) return [sim.map.camp.x, sim.map.camp.y];
  return [L.reduce((a, o) => a + o.x, 0) / L.length, L.reduce((a, o) => a + o.y, 0) / L.length - 1.5];
}
function frame(now) {
  root.requestAnimationFrame(frame);
  const dt = Math.min(100, now - (lastFrame || now)); lastFrame = now;
  if ($('game').hidden || !sim) return;
  const h = myH(), run = sim.ph === 'run', online = mode === 'online';
  const canAct = h && !paused && run && mode !== 'demo' && !(online && room && room.spectator);
  if (canAct) {
    const [vx, vy] = inputVec(), moving = !!(vx || vy);
    if (moving && !h.dn) { const bx = h.x, by = h.y; sim.move(h, vx, vy, dt); if (now - lastStep > 330 && (h.x !== bx || h.y !== by)) { lastStep = now; SFX.step(); } }
    let want = null;
    if (aim.on || aim.mouse) { const ax = aim.x - sx(h.x), ay = aim.y - sy(h.y - 0.5); if (Math.hypot(ax, ay) > 12) want = Math.atan2(ay, ax); }
    else if (moving) want = Math.atan2(vy, vx);
    if (want != null && !h.dn) { const d = G.angDiff(want, h.f), turn = 11 * dt / 1000; h.f += Math.abs(d) < turn ? d : Math.sign(d) * turn; }
    h.on = lightWant; h.rv = prayHeld ? 1 : 0;
  }
  /* simulation */
  if ((mode === 'solo' || mode === 'demo') && !paused) {
    simAcc = Math.min(simAcc + dt, 400);
    while (simAcc >= SIM_MS) { simAcc -= SIM_MS; sim.step(SIM_MS); if (tut) tutTick(); }
    playEvents(sim.ev, 'solo' + soloRun); readShouts(sim.hs);
  } else if (online && sim) {
    if (sim.pred) sim.step(dt); else { playEvents(sim.ev, hostG); readShouts(sim.hs); }
  }
  /* display smoothing (remote hikers + entities) */
  const k = Math.min(1, dt / 90);
  for (const o of sim.hikers) {
    if (o.id === me && mode !== 'demo') { delete disp[o.id]; continue; }
    if (!online) { delete disp[o.id]; continue; }
    let p = disp[o.id]; if (!p || Math.hypot(p.x - o.x, p.y - o.y) > 4) p = disp[o.id] = { x: o.x, y: o.y, w: 0 };
    const mx = (o.x - p.x) * k, my = (o.y - p.y) * k; p.x += mx; p.y += my; if (Math.hypot(mx, my) > 0.002) { p.w += dt / 1000 * 9; o.walk = p.w; }
  }
  if (online) for (const e of sim.ents) { const key = 'e' + e.id; let p = disp[key]; if (!p || Math.hypot(p.x - e.x, p.y - e.y) > 3) p = disp[key] = { x: e.x, y: e.y }; p.x += (e.x - p.x) * Math.min(1, dt / 70); p.y += (e.y - p.y) * Math.min(1, dt / 70); }
  /* camera */
  const [tx, ty] = camTarget(), W = sim.map.W, half = CW / 2 / TS;
  if (!cam.init) { cam.x = tx; cam.y = ty; cam.init = true; }
  cam.x += (tx - cam.x) * Math.min(1, dt / 220); cam.y += (ty - cam.y) * Math.min(1, dt / 220);
  cam.x = half * 2 >= W ? W / 2 : G.clamp(cam.x, half, W - half); cam.y = G.clamp(cam.y, CH / 2 / TS - 1, sim.map.H - CH / 2 / TS + 1);
  /* ambience */
  if (mode !== 'demo') {
    if (now > ambAt) { ambAt = now + 2500 + Math.random() * 5000; if (Math.random() < 0.82) SFX.cricket(); else SFX.owl(); }
    if (h && !h.dn && h.fear > 55 && now > beatAt) { const v = (h.fear - 55) / 45; beatAt = now + 1000 - v * 450; SFX.beat(0.5 + v * 0.5); }
  }
  if (now > ffAt) { ffAt = now + 700 + Math.random() * 900; const fx0 = cam.x + (Math.random() - 0.5) * CW / TS, fy0 = cam.y + (Math.random() - 0.5) * CH / TS; fx.burst(fx0, fy0, ['#d8ff8a', '#fff6a0'], 1, 0.25, { glow: true, life: 2.6, r: 0.05 }); }
  fx.step(dt); flash = Math.max(0, flash - dt / 380); shake = Math.max(0, shake - dt / 30);
  /* render */
  const nowB = performance.now();
  for (let i = pings.length - 1; i >= 0; i--) if (nowB - pings[i].at > 4500) pings.splice(i, 1);
  R.render(cv, sim, {
    cw: CW, ch: CH, dpr: DPR, ts: TS, cam, now, me: mode === 'demo' ? null : me, fx, disp: online ? disp : null, pings, demo: mode === 'demo', shake, goal: goalOf(), downLabel: T('kesurupan'),
    meta: o => ({ name: o.id === me && mode !== 'demo' ? T('youName') : o.name, gm: isGm(o.id), me: o.id === me && mode !== 'demo', bubble: bubbles[o.id] && bubbles[o.id].until > nowB ? bubbles[o.id].t : '' })
  });
  if (flash > 0) { const g = cv.getContext('2d'); g.fillStyle = 'rgba(255,250,240,' + (flash * 0.55) + ')'; g.fillRect(0, 0, CW, CH); }
  if (mode !== 'demo') { paintHud(now); hints(now); }
  /* online client: send my position / light / pray */
  if (online && sim.pred && h) { const key = h.x.toFixed(1) + ',' + h.y.toFixed(1) + ',' + h.f.toFixed(1) + h.on + h.rv; if (key !== lastInKey && now - lastInAt >= 260) { lastInAt = now; lastInKey = key; sendIn(false); } }
  if (online && !sim.pred) hostDirty = hostDirty || (h && (h.mv || h.walk > 0));
  /* end */
  if (!run && !ended && (mode === 'solo' || mode === 'demo')) {
    ended = true; const res = sim.result();
    if (mode === 'demo') { setTimeout(() => { if (mode === 'demo') startDemo(); }, 3000); return; }
    let isBest = false; if (res.w) { let b = {}; try { b = JSON.parse(getLS(BEST_KEY) || '{}') || {}; } catch (e) { b = {}; } if (!b.s || res.s > b.s || (res.s === b.s && res.t < b.t)) { isBest = true; setLS(BEST_KEY, JSON.stringify({ s: res.s, t: res.t })); } }
    (res.w ? SFX.win : SFX.lose)(); banner(res.w ? '⛩️ ' + esc(T('win')) : (res.why === 'fog' ? '🌫️ ' + esc(T('loseFog')) : '🌀 ' + esc(T('loseDown'))), 1500, res.w ? 'warm' : 'purple');
    setTimeout(() => { if (mode === 'solo' && sim && sim.ph !== 'run') showEnd(res, true, isBest); }, 1500);
  }
}
function paintHud(now) {
  const h = myH(), m = sim.map, fogP = Math.min(1, sim.fog / CFG.fogTime);
  const prog = h ? sim.progress(h) : sim.teamProgress();
  $('progFill').style.width = (prog * 100).toFixed(1) + '%';
  $('fogFill').style.width = (fogP * 100).toFixed(1) + '%'; $('fogFill').parentNode.parentNode.classList.toggle('hot', fogP > 0.75);
  $('fogTxt').textContent = fmtT((CFG.fogTime - sim.fog) / (sim.calm ? 0.3 : 1));
  if (h) {
    $('batFill').style.width = (h.bat / CFG.batMax * 100).toFixed(1) + '%'; $('batFill').parentNode.parentNode.classList.toggle('hot', h.bat < 20);
    $('fearFill').style.width = h.fear.toFixed(1) + '%'; $('fearFill').parentNode.parentNode.classList.toggle('hot', h.fear > 65);
    $('fearIc').textContent = h.dn ? '🌀' : h.fear > 75 ? '😱' : h.fear > 45 ? '😨' : '🙂';
    const on = sim.lightOn(h); $('lightBtn').classList.toggle('on', !!h.on); $('lightBtn').classList.toggle('off', !h.on); $('lightLbl').textContent = h.on ? (h.bat > 0 ? T('on') : '0%') : T('off');
    const mate = sim.hikers.some(o => o !== h && !o.dn && Math.hypot(o.x - h.x, o.y - h.y) < 1.9 && o.bat < CFG.batMax - 10);
    $('giveBtn').classList.toggle('dim', !(mate && h.bat >= CFG.give + 5)); $('giveBtn').classList.toggle('glow', !!(mate && h.bat > 50 && sim.hikers.some(o => o !== h && o.bat < 20 && Math.hypot(o.x - h.x, o.y - h.y) < 1.9)));
    const needPray = h.dn || sim.hikers.some(o => o !== h && o.dn && Math.hypot(o.x - h.x, o.y - h.y) < 1.7);
    $('prayBtn').classList.toggle('glow', needPray && !prayHeld); $('prayBtn').classList.toggle('dim', !needPray && !prayHeld);
    void on;
  }
  const dots = sim.hikers.map(o => '<i style="left:' + (sim.progress(o) * 100).toFixed(0) + '%;background:' + (o.dn ? '#c49bff' : G.COLORS[o.c % G.COLORS.length]) + '"></i>').join('');
  const key = lang + '|' + dots + '|' + sim.hikers.map(o => o.id + ':' + o.name + ':' + Math.round(o.bat / 10) + ':' + o.dn + ':' + (isGm(o.id) ? 1 : 0)).join(',');
  if (key === hudKey) return; hudKey = key; $('progDots').innerHTML = dots;
  $('team').innerHTML = sim.hikers.length < 2 ? '' : sim.hikers.map(o => '<li class="' + (o.dn ? 'dn' : '') + (o.id === me ? ' me' : '') + '"><span class="dot" style="background:' + G.COLORS[o.c % G.COLORS.length] + '"></span><span class="nm">' + esc(o.id === me ? T('youName') : o.name) + (o.bot ? ' 🤖' : '') + (isGm(o.id) ? ' <em class="gm-tag">(GM)</em>' : '') + '</span><span class="tb"><i style="width:' + Math.round(o.bat) + '%"></i></span>' + (o.dn ? '<span>🌀</span>' : '') + '</li>').join('');
  void m; void now;
}
function hints(now) {
  const h = myH(); if (!h || sim.ph !== 'run' || paused) return;
  if (!h.dn && h.on && h.bat > 0 && h.bat < 15) hint('bat', T('batLow'), 'warn', 9000);
  if (!h.dn && !sim.lightOn(h) && h.fear > 50 && !tut) hint('dark', T('darkFear'), 'warn', 12000);
  if (sim.fog / CFG.fogTime > 0.75 && !sim.calm) hint('fog', T('fogWarn'), 'warn', 20000);
  const sh = sim.map.shrine; if (Math.hypot(h.x - sh.x, h.y - sh.y) < CFG.winR && sim.hikers.length > 1 && !sim.hikers.every(o => Math.hypot(o.x - sh.x, o.y - sh.y) < CFG.winR)) hint('gather', T('gather'), 'good', 8000);
  void now;
}

/* =====================================================================
   SOLO (practice with bots) + TUTORIAL + DEMO
   ===================================================================== */
function soloPlayers(nb) { const ps = [{ id: 1, name: myName() || T('youName') }]; for (let i = 0; i < nb; i++) ps.push({ id: -1 - i, name: BOT_NAMES[i], bot: true }); return ps; }
function resetRun() {
  for (const k in disp) delete disp[k]; for (const k in bubbles) delete bubbles[k]; pings.length = 0; seenHs.clear(); cam.init = false; simAcc = 0; ended = false; paused = false; lightWant = 1; prayHeld = false;
  hudKey = ''; lastEvN = 0; evG = null; flash = 0; shake = 0; overlay(''); toggleHelp(false); if (mode !== 'demo') showLegend(20000); $('prayBtn').classList.remove('on'); $('banner').hidden = true;
}
function startSolo(opts) {
  opts = opts || {}; stopOnline(); const doTut = !!opts.tut || !getLS(TUT_KEY);
  mode = 'solo'; me = 1; soloRun++; resetRun();
  sim = new Sim({ seed: (Math.random() * 1e9) | 0, players: soloPlayers(doTut ? 0 : soloBots), calm: doTut });
  if (doTut) { sim.tutHold = true; tut = { i: 0, tg: 0, eid: 0, ban0: 0, at: 0 }; $('tutBox').hidden = false; tutPaint(); } else { tut = null; $('tutBox').hidden = true; }
  $('pauseBtn').hidden = false; $('pauseBtn').textContent = T('pause'); show('game'); ambience(true); showLegend(doTut ? 12000 : 20000);
  if (!doTut) banner('🎗️ ' + esc(T('followRib')), 2600, 'warm');
}
let helpOpen = false, helpPaused = false, legTimer = 0;
function helpHtml(full) {
  const row = (ic, what, t, k) => '<tr><td class="hi">' + ic + '</td><td>' + esc(T(what)) + '</td><td>' + esc(t) + '</td><td><kbd>' + esc(k) + '</kbd></td></tr>';
  const tb = '<table class="ctl"><thead><tr><th></th><th></th><th>📱 ' + esc(T('helpTouch')) + '</th><th>⌨️ ' + esc(T('helpKey')) + '</th></tr></thead><tbody>' +
    row('🕹️', 'hMove', T('hMoveT'), 'W A S D') + row('🔦', 'hAim', T('hAimT'), T('hAimK')) + row('💡', 'hLight', '🔦 ' + T('on') + '/' + T('off'), 'F') +
    row('🔋', 'hShare', '🔋 ' + T('give'), 'Q') + row('🙏', 'hPray', T('hPrayT'), T('hPrayK')) + (mode === 'solo' ? '' : row('💬', 'hChat', T('hChatT'), T('hChatK'))) + '</tbody></table>';
  return tb + (full ? '<ul class="ghosts"><li><span class="gi">👻</span><span>' + T('gP') + '</span></li><li><span class="gi">🩸</span><span>' + T('gK') + '</span></li><li><span class="gi">😨</span><span>' + T('gFear') + '</span></li><li><span class="gi">⛩</span><span>' + T('gGoal') + '</span></li></ul>' : '');
}
function toggleHelp(v) {
  v = v == null ? !helpOpen : !!v; if (v === helpOpen) return; helpOpen = v; const el = $('help');
  if (v) { keys.clear(); joy.x = joy.y = 0; helpPaused = mode === 'solo' && !!sim && sim.ph === 'run' && !paused; if (helpPaused) paused = true;
    el.innerHTML = '<div class="helpc" role="dialog" aria-modal="true" aria-label="' + esc(T('helpT')) + '"><b class="ht">❓ ' + esc(T('helpT')) + '</b>' + helpHtml(true) + (mode === 'online' ? '<p class="muted small">' + esc(T('helpLive')) + '</p>' : '') + '<button type="button" class="btn lamp" id="helpClose">' + esc(T('helpClose')) + '</button></div>';
    el.hidden = false; $('helpClose').onclick = () => toggleHelp(false); $('legend').hidden = true; }
  else { el.hidden = true; el.innerHTML = ''; if (helpPaused) { paused = false; helpPaused = false; } if (!$('game').hidden && sim && sim.ph === 'run') showLegend(8000); }
}
function showLegend(ms) { const el = $('legend'); el.innerHTML = '<span class="lg-k">' + T('legend') + '</span><span class="lg-t">' + T('legendT') + '</span><button type="button" aria-label="close">✕</button>'; el.classList.toggle('wt', !$('tutBox').hidden); el.hidden = false; el.querySelector('button').onclick = () => { el.hidden = true; }; clearTimeout(legTimer); legTimer = setTimeout(() => { el.hidden = true; }, ms); }
function overlay(html) { const o = $('overlay'); o.innerHTML = html; o.hidden = !html; }
function togglePause() {
  if (helpOpen) { toggleHelp(false); return; }
  if (mode !== 'solo' || !sim || sim.ph !== 'run') return; paused = !paused; $('pauseBtn').textContent = paused ? T('resume') : T('pause');
  overlay(paused ? '<div class="ovc"><b>⏸ ' + esc(T('paused')) + '</b>' + helpHtml(false) + '<button type="button" class="btn lamp" id="resumeBtn">' + esc(T('resume')) + '</button></div>' : '');
  if (paused) { $('resumeBtn').onclick = togglePause; keys.clear(); joy.x = joy.y = 0; }
}
const TUT_N = 7;
function tutPaint() { if (!tut) return; const i = Math.min(tut.i, TUT_N - 1); $('tutN').textContent = (i + 1) + '/' + TUT_N; $('tutT').innerHTML = T('t' + (i + 1)); }
function tutNext() { tut.i++; tut.at = sim.t; SFX.star(); if (tut.i >= TUT_N) tutEnd(false); else { tutPaint(); tutEnter(); } }
function tutEnter() {
  const h = myH(); if (!h) return; const m = sim.map;
  if (tut.i === 3) { const y = Math.max(m.top + 3, h.y - 5.5), e = sim.spawn('p', h, { x: G.trailX(m, y), y }); tut.eid = e.id; tut.ban0 = sim.st.ban; }
  if (tut.i === 4) { const e = sim.spawn('k', h); tut.eid = e.id; }
  if (tut.i === 6) { const r = sim.addHiker({ id: -1, name: BOT_NAMES[0], bot: true, c: 1 }, 1); r.x = G.clamp(h.x + 1.1, 1, m.W - 1); r.y = h.y - 0.4; if (G.collides(m, r.x, r.y, CFG.r)) { r.x = h.x; r.y = h.y + 0.8; } r.dn = 1; r.fear = 100; r.dnT = 0; r.f = Math.PI / 2; SFX.down(); fx.burst(r.x, r.y - 0.6, ['#c49bff', '#7a3cff', '#fff'], 18, 2.4); hudKey = ''; }
}
function tutTick() {
  const h = myH(); if (!tut || !h || tut.i >= TUT_N) return; const m = sim.map, i = tut.i;
  if (i === 0 && h.y < m.camp.y - 9) tutNext();
  else if (i === 1 && tut.tg >= 2 && h.on) tutNext();
  else if (i === 2 && sim.st.picks >= 1) tutNext();
  else if (i === 3) { if (!sim.ents.some(e => e.id === tut.eid)) { if (sim.st.ban > tut.ban0) tutNext(); else tutEnter(); } }
  else if (i === 4) { if (!sim.ents.some(e => e.id === tut.eid)) tutNext(); }
  else if (i === 5 && sim.lit[0]) tutNext();
  else if (i === 6) { const r = sim.hiker(-1); if (!r || !r.dn) tutNext(); }
  if (h.dn && sim.hikers.length === 1) { /* never stuck alone: hint the self-pray */ hint('self', T('downMe'), 'warn', 7000); }
}
function tutEnd(skipped) {
  if (!tut) return; tut = null; setLS(TUT_KEY, '1'); sim.calm = false; sim.tutHold = false; sim.next = 12; $('tutBox').hidden = true;
  if (!skipped) { banner('✅ ' + esc(T('tutDone')) + '<small>' + T('tEnd') + '</small>', 4200, 'warm'); fx.burst(cam.x, cam.y, ['#ffd166', '#fff', '#ff9a3c'], 30, 3.5, { glow: true }); }
  else banner('🎗️ ' + esc(T('followRib')), 2400, 'warm');
}
$('tutSkip').addEventListener('click', () => { if (tut) tutEnd(true); });
function startDemo() {
  stopOnline(); mode = 'demo'; me = -1; soloRun++; resetRun(); tut = null; $('tutBox').hidden = true;
  sim = new Sim({ seed: (Math.random() * 1e9) | 0, players: [0, 1, 2].map(i => ({ id: -1 - i, name: BOT_NAMES[i], bot: true })) });
  $('pauseBtn').hidden = true; show('game');
}
/* --- home hero: bots hiking the real sim --- */
function hero() {
  const c = $('heroCv'), hfx = R.makeFx(), hc = { x: 15, y: 300 }; let hs = null, last = 0, w = 0, hgt = 0, r = 1;
  const mk = () => { hs = new Sim({ seed: 1000 + ((Math.random() * 9000) | 0), players: [0, 1, 2].map(i => ({ id: -1 - i, name: BOT_NAMES[i], bot: true })) }); hs.next = 6; const al = hs.hikers; hc.x = al[0].x; hc.y = al[0].y - 2; };
  const size = () => { w = c.parentNode.clientWidth || 360; hgt = c.parentNode.clientHeight || 260; r = Math.min(2, root.devicePixelRatio || 1); c.width = Math.round(w * r); c.height = Math.round(hgt * r); c.style.width = w + 'px'; c.style.height = hgt + 'px'; };
  mk(); size(); root.addEventListener('resize', size); root.MPHero = () => hs;
  const loop = now => {
    root.requestAnimationFrame(loop); if ($('home').hidden || doc.visibilityState !== 'visible') { last = now; return; }
    let dt = Math.min(100, now - (last || now)); last = now; if (!w) size();
    while (dt > 0) { const d = Math.min(50, dt); dt -= d; hs.step(d); }
    if (hs.ph !== 'run' || hs.t > 240000) mk();
    for (const e of hs.ev) { if (e[0] <= (hs.seen || 0)) continue; hs.seen = e[0]; if (e[1] === 'ban') hfx.burst(e[2], e[3] - 0.5, ['#fff', '#fff1a8'], 14, 2.4, { glow: true }); if (e[1] === 'bat') hfx.burst(e[2], e[3], ['#f3c63c', '#fff'], 8, 1.6, { glow: true }); }
    hfx.step(Math.min(100, now - (hfx.at || now))); hfx.at = now;
    const al = hs.hikers.filter(o => !o.dn), L = al.length ? al : hs.hikers, ax = L.reduce((a, o) => a + o.x, 0) / L.length, ay = L.reduce((a, o) => a + o.y, 0) / L.length - 1.6;
    hc.x += (ax - hc.x) * 0.05; hc.y += (ay - hc.y) * 0.05; const ts = Math.max(24, Math.min(40, w / 11));
    hc.x = G.clamp(hc.x, w / 2 / ts, hs.map.W - w / 2 / ts);
    R.render(c, hs, { cw: w, ch: hgt, dpr: r, ts, cam: hc, now, me: null, fx: hfx, disp: null, demo: true, meta: o => ({ name: o.name.replace(/ 🤖$/, '') }) });
  };
  root.requestAnimationFrame(loop);
}

/* =====================================================================
   ONLINE (host-authoritative co-op)
   ===================================================================== */
let tickBusy = false, lastTick = 0, hostCm = [], inBusy = false, inAgain = false, sentQ = 0, outChat = null, clientG = null, wireT = -1, hostEvN = 0;
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
  try { await r.enter(kind, Object.assign({ set: { bots: saved.obots | 0 }, maxPlayers: 4 }, opts)); } catch (e) { if (room === r) { room = null; mode = null; } throw e; }
  me = r.me; if (room === r && r.s.ph === 'lobby') { renderRoom(); show('lobby'); } addChatLine({ k: 'sys-in' + Date.now(), t: 'sys', x: T('chatSys', { n: myName() || '?' }) }); gmMeSync(); return r;
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
      if (!(sim && !sim.pred && hostG === s.g)) { sim = Sim.fromSnap(s.s, false); hostG = s.g; seenV = data.version; endSent = false; hostCm = s.cm.slice(); hostLoop.at = 0; hostLoop.acc = 0; lastEvN = 0; evG = null; if (wasHost === false) toast(T('hostTook'), 'good', 4000); }
      takeInputs(data.events);
    } else clientSnap(s);
  } else if (!starting && s.ph !== 'end') { sim = null; hostG = null; }
  if (!(host && s.ph === 'play')) syncChat(s.cm);
  wasHost = host;
  if (s.ph === 'play') { if ($('game').hidden) { resetRun(); $('pauseBtn').hidden = true; show('game'); ambience(true); if (!r.spectator) banner('🎗️ ' + esc(T('followRib')), 2600, 'warm'); else toast(T('specBadge'), '', 2400); } }
  else if (s.ph === 'end') { showEnd(s.res, false); }
  else { renderRoom(); if ($('lobby').hidden) show('lobby'); }
}
function joinLeaveLines(ps) {
  const ids = new Map(ps.map(p => [p.id, p.displayName])); if (seatSeen) { for (const [id, n] of ids) if (!seatSeen.has(id) && id !== me) { addChatLine({ k: 'sj' + id + Date.now(), t: 'sys', x: T('chatSys', { n }) }); SFX.chat(); } for (const [id, n] of seatSeen) if (!ids.has(id)) addChatLine({ k: 'sl' + id + Date.now(), t: 'sys', x: T('chatLeft', { n }) }); }
  seatSeen = ids;
}
function clientSnap(s) {
  if (clientG !== s.g) { clientG = s.g; opQ = 0; sentQ = 0; pend = []; wireT = -1; for (const k in disp) delete disp[k]; lastEvN = 0; evG = null; cam.init = false; }
  if (s.s.t === wireT && sim && sim.pred) return; wireT = s.s.t;
  const old = sim && sim.pred ? sim.hiker(me) : null, n = Sim.fromSnap(s.s, true), nc = n.hiker(me);
  if (nc && old && !nc.dn && !old.dn) { nc.x = old.x; nc.y = old.y; nc.f = old.f; }
  if (nc) { nc.on = lightWant; nc.rv = prayHeld ? 1 : 0; pend = pend.filter(p => p[0] > nc.a); if (opQ < nc.a) opQ = nc.a; if (old) nc.walk = old.walk; }
  if (old && nc && old.dn && !nc.dn) { /* revived: the host owns where we stand */ }
  for (const o of n.hikers) { const p = disp[o.id]; if (p && o.id !== me) o.walk = p.w; }
  sim = n; playEvents(s.s.ev, s.g); readShouts(s.s.hs);
}
function takeInputs(events) {
  if (!sim) return;
  for (const e of events || []) {
    if (e.version <= seenV) continue; seenV = e.version;
    if (e.type !== 'in' || !e.payload || e.payload.g !== hostG) continue;
    const p = e.payload, c = sim.hiker(e.playerId); if (!c || c.bot) continue;
    if (e.playerId !== me) { sim.place(c, +p.x, +p.y, +p.f); c.on = p.on ? 1 : 0; c.rv = p.rv ? 1 : 0; }
    const ops = Array.isArray(p.a) ? p.a.slice(-6) : [];
    for (const op of ops) { if (!Array.isArray(op)) continue; const q = Number(op[0]) || 0; if (q <= c.a) continue; c.a = q; if (op[1] === 'b') sim.apply(c.id, 'b'); }
    if (p.m && typeof p.m.x === 'string') { const k = 'c' + e.playerId + '.' + (p.m.i | 0); if (!hostCm.some(m => m.k === k)) { const m = { k, p: e.playerId, n: c.name, x: cleanChat(p.m.x) }; if (m.x) { hostCm.push(m); hostCm = hostCm.slice(-30); addChatLine(m); SFX.chat(); } } }
    if (Array.isArray(p.h)) { const k = 'in' + e.playerId + ':' + (p.h[0] | 0); if (!seenHs.has(k)) { seenHs.add(k); const idx = p.h[1] | 0; if (SHOUTS[idx]) sim.shout(e.playerId, idx); } }
    hostDirty = true;
  }
}
function pruneLeft() { if (!room || !sim) return; const ids = new Set(room.seated().map(p => p.id)); const before = sim.hikers.length; sim.hikers = sim.hikers.filter(c => c.id < 0 || ids.has(c.id)); if (sim.hikers.length !== before) { hostDirty = true; hudKey = ''; } }
/* host sim runs on a timer (keeps going when rAF is throttled in a background tab) */
setInterval(() => {
  if (mode !== 'online' || !sim || sim.pred || !room || !room.isHost() || room.s.ph !== 'play') return;
  const now = performance.now(), dt = Math.min(1500, now - (hostLoop.at || now)); hostLoop.at = now; hostLoop.acc += dt;
  while (hostLoop.acc >= SIM_MS) { hostLoop.acc -= SIM_MS; sim.step(SIM_MS); }
  pruneLeft(); if (sim.evN !== hostEvN) { hostEvN = sim.evN; hostDirty = true; }
  if (sim.ph !== 'run' && !endSent) { endSent = true; sendTick(); setTimeout(sendEnd, 1500); return; }
  if (!tickBusy && Date.now() - lastTick >= (hostDirty ? 240 : 520) && hostBudget.take()) sendTick();
}, SIM_MS);
function tickState(r) { return Object.assign({}, r.s, { s: sim.snap(), cm: hostCm.slice(-30) }); }
async function sendTick() {
  const r = room; if (!r || !sim) return; tickBusy = true; lastTick = Date.now(); hostDirty = false;
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
function onlinePlayers(ps, nb) {
  const out = ps.slice(0, 4).map((p, i) => ({ id: p.id, name: p.displayName, c: i }));
  for (let i = 0; i < nb && out.length < 4; i++) out.push({ id: -1 - i, name: BOT_NAMES[i], bot: true, c: out.length });
  return out;
}
async function startOnline() {
  const r = room; if (!r || !r.isHost()) return; const ps = r.seated(); if (!ps.length) return;
  const nb = Math.max(0, Math.min(3, r.s.set.bots | 0)), g = Math.random().toString(36).slice(2, 8), next = new Sim({ seed: (Math.random() * 1e9) | 0, players: onlinePlayers(ps, nb) });
  ['startBtn', 'againBtn'].forEach(id => { $(id).disabled = true; }); starting = true;
  try {
    sim = next; hostG = g; seenV = r.version; endSent = false; hostLoop.at = 0; hostLoop.acc = 0; hostEvN = 0; resetRun();
    const res = await r.edit('start', s => { if ('gm' in s) delete s.gm; s.ph = 'play'; s.g = g; s.res = null; s.s = next.snap(); hostCm = (s.cm || []).slice(-30); return { status: 'playing' }; });
    if (!res) { sim = null; hostG = null; }
  } catch (e) { sim = null; hostG = null; toast(errMsg(e), 'warn'); }
  finally { starting = false; ['startBtn', 'againBtn'].forEach(id => { $(id).disabled = false; }); }
}
async function toLobby() { const r = room; if (!r || !r.isHost()) return; try { await r.edit('lobby', s => { if ('gm' in s) delete s.gm; s.ph = 'lobby'; s.s = null; s.res = null; return { status: 'waiting' }; }); } catch (e) { toast(errMsg(e), 'warn'); } }
async function setBots(v) { saved.obots = v; saveSet(); const r = room; if (!r || !r.isHost()) return; try { await r.edit('set', s => { if (s.ph !== 'lobby') return null; s.set.bots = v; }); } catch (e) { toast(errMsg(e), 'warn'); } }
/** client -> host: position + light/pray + pending actions (+ chat / shout), one write, budgeted */
async function sendIn(urgent) {
  const r = room; if (!r || r.spectator || r.isHost() || r.s.ph !== 'play' || !sim || !sim.pred) return; const h = myH(); if (!h) return;
  if (inBusy) { if (urgent) inAgain = true; return; }
  if (!inBudget.take()) { if (urgent) setTimeout(() => sendIn(true), 300); return; }
  inBusy = true; inDirty = false;
  const a = pend.slice(-6), m0 = outChat, h0 = outShout, payload = { g: r.s.g, x: Math.round(h.x * 100) / 100, y: Math.round(h.y * 100) / 100, f: Math.round(h.f * 100) / 100, on: lightWant ? 1 : 0, rv: prayHeld ? 1 : 0, w: h.walk > 0 ? 1 : 0, a };
  if (m0) payload.m = m0; if (h0) payload.h = h0;
  try { await r.push('in', { payload }); if (a.length) sentQ = Math.max(sentQ, a[a.length - 1][0]); if (outChat === m0) outChat = null; if (outShout === h0) outShout = null; }
  catch (e) { if (r === room) { inAgain = true; if (e.status === 409) { try { await r.settle(e.used); } catch (e2) { /* next */ } } } }
  finally { inBusy = false; const more = inAgain || inDirty || outChat || outShout || pend.some(p => p[0] > sentQ); inAgain = false; if (more && room === r) setTimeout(() => sendIn(true), 60); }
}
/* ---------- chat ---------- */
const BAD = /\b(anjing|bangsat|babi|kontol|memek|ngentot|goblok|tolol|fuck|shit|bitch)\b/gi;
function cleanChat(x) { return String(x || '').replace(/[\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120).replace(BAD, w => w[0] + '*'.repeat(w.length - 1)); }
const chatKeys = new Set();
function resetChat() { chatKeys.clear(); $('chatLog').innerHTML = ''; seatSeen = null; }
function addChatLine(m) {
  if (!m || !m.k || chatKeys.has(m.k)) return; chatKeys.add(m.k); const log = $('chatLog'), p = doc.createElement('p');
  if (m.t === 'sys') { p.className = 'sys'; p.textContent = m.x; }
  else { if (m.t === 'sh') p.className = 'sh'; const gmT = isGm(m.p) ? ' <em class="gm-tag">(GM)</em>' : ''; p.innerHTML = '<b>' + esc(m.n || '?') + gmT + ':</b> ' + esc(m.x); if (m.t !== 'sh' && m.p != null && m.x) { bubbles[m.p] = { t: '💬 ' + (m.x.length > 26 ? m.x.slice(0, 25) + '…' : m.x), until: performance.now() + 3500 }; if (!$('game').hidden && $('gameChatSlot').hidden && m.p !== me) $('chatBtn').classList.add('ping'); } }
  const stick = log.scrollTop + log.clientHeight >= log.scrollHeight - 30; log.appendChild(p); while (log.children.length > 80) log.firstChild.remove(); if (stick) log.scrollTop = log.scrollHeight;
}
function syncChat(cm) { for (const m of cm || []) { if (!m || typeof m !== 'object') continue; const fresh = !chatKeys.has(m.k); addChatLine({ k: String(m.k || ''), p: m.p, n: String(m.n || ''), x: cleanChat(m.x) }); if (fresh && m.p !== me && chatKeys.size > 1) SFX.chat(); } }
let chatAt = 0;
async function sendChat(raw) {
  const x = cleanChat(raw); if (!x || !room || (room.spectator && room.s.ph === 'play')) return false; const n = Date.now(); if (n - chatAt < 1000) { toast(T('chatSlow'), 'warn', 1500); return false; } chatAt = n;
  const k = 'c' + me + '.' + (++chatSeq), m = { k, p: me, n: myName() || nameOf(me), x };
  if (room.s.ph === 'play') {
    if (room.isHost()) { hostCm.push(m); hostCm = hostCm.slice(-30); hostDirty = true; addChatLine(m); }
    else { outChat = { i: chatSeq, x }; addChatLine(m); sendIn(true); }
  } else { addChatLine(m); try { await room.edit('chat', s => { s.cm = (s.cm || []).concat([m]).slice(-30); }); } catch (e) { toast(errMsg(e), 'warn'); } }
  return true;
}
$('chatForm').addEventListener('submit', e => { e.preventDefault(); const i = $('chatInput'); Promise.resolve(sendChat(i.value)).then(ok => { if (ok) i.value = ''; }); if (!$('game').hidden) { i.blur(); $('gameChatSlot').hidden = true; } });
function openChat(focus) {
  if (mode !== 'online') return; const d = $('gameChatSlot'); d.hidden = !d.hidden; $('chatBtn').classList.remove('ping');
  if (!d.hidden) { if ($('chat').parentNode !== d) d.appendChild($('chat')); $('chat').hidden = false; const log = $('chatLog'); log.scrollTop = log.scrollHeight; if (focus !== false) setTimeout(() => $('chatInput').focus(), 30); }
}
/* ---------- lobby / end ---------- */
let onBotsPaint = () => {};
function renderRoom() {
  const r = room; if (!r || !r.data) return; const s = r.s, host = r.isHost(), ps = r.seated(), nb = Math.max(0, Math.min(3, s.set.bots | 0)), bots = Math.max(0, Math.min(nb, 4 - ps.length));
  $('roomCode').textContent = r.code; $('lobbyVis').textContent = r.data.visibility === 'public' ? T('visPub') : T('visPriv');
  $('pCount').textContent = (ps.length + bots) + '/4';
  $('pList').innerHTML = ps.map((p, i) => '<li><span class="dot" style="background:' + G.COLORS[i % G.COLORS.length] + '"></span><span>' + esc(p.displayName) + (isGm(p.id) ? ' <em class="gm-tag">(GM)</em>' : '') + '</span>' + (p.id === r.me ? '<span class="tag">' + esc(T('you')) + '</span>' : '') + (p.host ? '<span class="tag">' + esc(T('host')) + '</span>' : '') + '</li>').join('')
    + Array.from({ length: bots }, (_, i) => '<li class="bot"><span class="dot" style="background:' + G.COLORS[(ps.length + i) % G.COLORS.length] + '"></span><span>' + esc(BOT_NAMES[i]) + ' 🤖</span><span class="tag">bot</span></li>').join('');
  $('hostBox').hidden = !host; $('onBots').classList.toggle('ro', !host); onBotsPaint(nb);
  $('lobbyWait').textContent = r.spectator ? T('spectating') : host ? '' : T('waitHost');
}
let endShownKey = '';
function showEnd(res, solo, isBest) {
  res = res && typeof res === 'object' ? res : { w: 0, why: 'fog', t: 0, fog: 100, s: 0, ban: 0, dn: 0, gv: 0, pk: 0, lit: 0, n: [] };
  const st = Math.max(0, Math.min(3, res.s | 0)), w = !!res.w;
  $('endKicker').textContent = T('endKick') + (solo ? ' · ' + T('solo') : '');
  $('endTitle').textContent = (w ? '⛩️ ' + T('win') : res.why === 'down' ? '🌀 ' + T('loseDown') : '🌫️ ' + T('loseFog')) + (isBest ? ' · ' + T('newBest') : '');
  $('endSub').textContent = w ? T('winSub') : T('loseSub');
  $('end').classList.toggle('won', w); $('end').classList.toggle('lost', !w);
  $('endStars').innerHTML = [0, 1, 2].map(i => '<span class="' + (i < st ? 'on' : '') + '">⭐</span>').join('');
  $('endTally').innerHTML = [['t_time', fmtT(res.t)], ['t_fog', (res.fog | 0) + '%'], ['t_pos', (res.lit | 0) + '/3'], ['t_ban', res.ban | 0], ['t_pick', res.pk | 0], ['t_give', res.gv | 0], ['t_down', res.dn | 0]].map(([k, v]) => '<li>' + esc(T(k)) + '<b>' + esc(v) + '</b></li>').join('');
  $('endCrew').innerHTML = (Array.isArray(res.n) ? res.n : []).map(c => Array.isArray(c) ? '<li><span class="dot" style="background:' + G.COLORS[(c[1] | 0) % G.COLORS.length] + '"></span>' + esc(c[0]) + (c[2] ? ' 🤖' : '') + '</li>' : '').join('');
  const host = solo || (room && room.isHost());
  $('againBtn').hidden = !host; $('toLobbyBtn').hidden = solo || !host; $('endWait').textContent = host ? '' : T('waitAgain');
  const key = JSON.stringify(res) + solo;
  if ($('end').hidden || key !== endShownKey) { const was = $('end').hidden; endShownKey = key; if (was) { show('end'); if (!solo) (w ? SFX.win : SFX.lose)(); for (let i = 0; i < st; i++) setTimeout(SFX.star, 500 + i * 280); } }
}
async function exitToMenu(silent) {
  const r = room; room = null; mode = null; sim = null; paused = false; tut = null; hostG = null; clientG = null; overlay(''); $('tutBox').hidden = true; resetChat(); show('home'); gmMeSync(); renderBest(); if (gm) setTimeout(gmLoad, 400);
  if (location.hash && /^#(latihan|tutorial|demo)$/i.test(location.hash) && root.history.replaceState) root.history.replaceState(null, '', location.pathname + location.search);
  if (r && !silent) await r.leave(); else if (r && conn.forget) conn.forget();
}
function confirmExit() { if ((mode === 'solo' && sim && sim.ph === 'run' && !tut && sim.t > 15000) || (room && room.s.ph === 'play' && !room.spectator)) { if (!root.confirm(T('exitConfirm'))) return; } exitToMenu(false); }
function invite() {
  if (!room) return; const url = location.origin + location.pathname + '?room=' + room.code, done = () => toast(T('copied'), 'good');
  if (navigator.share && /Mobi|Android/i.test(navigator.userAgent)) navigator.share({ title: 'Malam Pendakian', text: 'Naik gunung malam bareng di Malam Pendakian · ' + room.code, url }).catch(() => {});
  else if (navigator.clipboard) navigator.clipboard.writeText(url).then(done, () => toast(url, '', 6000)); else toast(url, '', 6000);
}
/* ---------- #gamemaster ---------- */
let gm = false, gmRooms = null, gmErr = '', gmBusy = false, gmAt = 0, gmWakeT = 0;
const gmHash = () => (location.hash || '').toLowerCase().includes(N.GM_KEY);
function gmSync() { const on = gmHash(); if (on === gm) return; gm = on; gmRooms = null; gmErr = ''; const box = $('gmRooms'); if (box) box.hidden = !gm; if (gm) gmLoad(); else renderGm(); }
// (GM) tag follows the server (players[].gamemaster, typed claim); the hash only shows the lobby list. Bots (id < 0) never are.
function isGm(id) { return mode === 'online' && !!room && id != null && id > 0 && room.isGamemaster(id); }
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
   HOME: how-to strip, best line
   ===================================================================== */
function renderHow() {
  const el = $('howList'); if (!el) return;
  el.innerHTML = [1, 2, 3, 4].map(i => '<div class="st"><canvas data-i="' + i + '" width="84" height="60"></canvas><span>' + T('how' + i) + '</span></div>').join('');
  const hc = $('howCtl'); if (hc) hc.innerHTML = helpHtml(false);
  el.querySelectorAll('canvas').forEach(c => {
    const r = Math.min(2.5, root.devicePixelRatio || 1), w = 84, hh = 60; c.width = w * r; c.height = hh * r; c.style.width = w + 'px'; c.style.height = hh + 'px';
    const g = c.getContext('2d'), i = +c.dataset.i, now = 1200, ts = 30; g.setTransform(r, 0, 0, r, 0, 0);
    const bg = g.createRadialGradient(w / 2, hh / 2, 4, w / 2, hh / 2, w * 0.7); bg.addColorStop(0, '#24304a'); bg.addColorStop(1, '#0b1020'); g.fillStyle = bg; R.rr(g, 0, 0, w, hh, 12); g.fill();
    const H = (c0, f, extra) => Object.assign({ id: 9, c: c0, f, on: 1, bat: 80, fear: 10, dn: 0, walk: 0, rvp: 0 }, extra || {});
    const cone = (x, y, a) => { g.save(); g.globalCompositeOperation = 'lighter'; const gr = g.createRadialGradient(x, y, 2, x, y, 46); gr.addColorStop(0, 'rgba(255,226,150,.55)'); gr.addColorStop(1, 'rgba(255,226,150,0)'); g.fillStyle = gr; g.beginPath(); g.moveTo(x, y); g.arc(x, y, 46, a - 0.5, a + 0.5); g.closePath(); g.fill(); g.restore(); };
    if (i === 1) { g.strokeStyle = '#e8282b'; g.lineWidth = 3; g.beginPath(); g.moveTo(60, 14); g.lineTo(70, 22); g.stroke(); g.fillStyle = '#6b4a2c'; g.fillRect(58, 12, 3, 30); cone(26, 40, -0.9); R.drawHiker(g, 26, 48, ts, H(0, -0.9), now, { light: true }); R.drawHiker(g, 42, 52, ts, H(1, -1.2), now, { light: true }); }
    if (i === 2) { cone(20, 40, -0.2); R.drawHiker(g, 20, 48, ts, H(2, -0.2), now, { light: true }); R.drawPocong(g, 62, 48, ts, { id: 1, ph: 0.8, fr: 1, lt: 1 }, now, 1); g.strokeStyle = '#fff1a8'; g.lineWidth = 2.5; g.beginPath(); g.arc(62, 30, 8, -Math.PI / 2, Math.PI); g.stroke(); }
    if (i === 3) { R.drawHiker(g, 30, 46, ts, H(1, 0, { dn: 1, rvp: 0.6 }), now, {}); R.drawHiker(g, 56, 48, ts, H(3, Math.PI, { rv: 1 }), now, { light: false }); g.font = '18px system-ui'; g.textAlign = 'center'; g.fillText('🙏', 58, 18); }
    if (i === 4) { g.font = '26px system-ui'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('🏮', 24, 32); g.fillText('⛩️', 62, 30); g.fillStyle = '#ffd166'; g.font = '900 16px system-ui'; g.fillText('→', 43, 32); }
  });
}
function renderBest() { let b = {}; try { b = JSON.parse(getLS(BEST_KEY) || '{}') || {}; } catch (e) { b = {}; } const el = $('bestLine'); if (el) el.textContent = b.s ? T('best', { s: b.s, t: fmtT(b.t) }) : T('bestNone'); }

/* =====================================================================
   BOOT
   ===================================================================== */
async function boot() {
  $('nameInput').value = getLS(NAME_KEY) || '';
  $('nameInput').addEventListener('change', () => setLS(NAME_KEY, myName()));
  soloBots = Math.max(0, Math.min(3, saved.bots == null ? 2 : saved.bots | 0));
  seg('soloBots', soloBots, v => { soloBots = v; saved.bots = v; saveSet(); });
  onBotsPaint = seg('onBots', saved.obots | 0, v => setBots(v));
  doc.querySelectorAll('.lb').forEach(b => b.addEventListener('click', () => { lang = b.dataset.lang; setLS(LANG_KEY, lang); applyLang(); }));
  const mute = () => { muted = !muted; setLS(MUTE_KEY, muted ? '1' : '0'); paintMute(); if (muted) ambience(false); else { SFX.click(); if (!$('game').hidden) ambience(true); } };
  $('muteBtn').addEventListener('click', mute); $('muteBtn2').addEventListener('click', mute);
  $('practiceBtn').addEventListener('click', () => { setLS(NAME_KEY, myName()); ac(); startSolo(); });
  $('tutBtn').addEventListener('click', () => { setLS(NAME_KEY, myName()); ac(); startSolo({ tut: true }); });
  $('createPub').addEventListener('click', () => { ac(); onlineAction('public'); });
  $('createPriv').addEventListener('click', () => { ac(); onlineAction('private'); });
  $('matchBtn').addEventListener('click', () => { ac(); onlineAction('match'); });
  $('joinForm').addEventListener('submit', e => { e.preventDefault(); ac(); onlineAction('join'); });
  $('codeInput').addEventListener('input', e => { e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''); });
  $('inviteBtn').addEventListener('click', invite); $('lobbyLeave').addEventListener('click', () => exitToMenu(false));
  $('startBtn').addEventListener('click', () => { ac(); startOnline(); });
  $('exitBtn').addEventListener('click', confirmExit); $('pauseBtn').addEventListener('click', togglePause); $('helpBtn').addEventListener('click', () => toggleHelp());
  $('againBtn').addEventListener('click', () => { ac(); if (mode === 'solo') startSolo(); else startOnline(); });
  $('toLobbyBtn').addEventListener('click', toLobby); $('endMenu').addEventListener('click', () => exitToMenu(false));
  root.addEventListener('resize', fit); if (root.visualViewport) root.visualViewport.addEventListener('resize', fit);
  root.addEventListener('pagehide', () => { if (room) conn.leaveBeacon(); });
  doc.addEventListener('visibilitychange', () => { if (doc.visibilityState === 'visible') { if (conn.config) conn.visible(); } else if (mode === 'solo' && sim && sim.ph === 'run' && !paused) togglePause(); });
  $('gmRefresh').addEventListener('click', gmLoad);
  $('gmList').addEventListener('click', e => { const b = e.target.closest('[data-gm]'); if (b) gmEnter(b.dataset.gm, b.dataset.code); });
  root.addEventListener('hashchange', gmSync); setInterval(() => { if (gm && !room && doc.visibilityState === 'visible' && Date.now() - gmAt > 10000) gmLoad(); }, 2000);
  gmSync(); gmUI = gmClaimUI({ listKey: N.GM_KEY, canClaim: () => mode === 'online' && !!room && !!room.data && !room.local && !room.isGamemaster(), claim: code => room.claimGamemaster(code), onDone: () => { toast('Mode gamemaster aktif', 'good'); gmMeSync(); hudKey = ''; if (room) renderRoom(); } });
  applyLang(); hero(); root.requestAnimationFrame(frame);
  const route = () => { const h = (location.hash || '').toLowerCase(); if (room) return; if (h === '#latihan') startSolo(); else if (h === '#tutorial') startSolo({ tut: true }); else if (h === '#demo') startDemo(); };
  route(); root.addEventListener('hashchange', route);
  doc.querySelectorAll('.online-btn').forEach(b => { b.disabled = true; });
  if (conn.allowed) { try { await conn.start(); onlineOk = true; } catch (e) { conn.failed = true; onlineOk = false; } }
  doc.querySelectorAll('.online-btn').forEach(b => { b.disabled = !onlineOk; }); onlineNote(); if (gm) gmLoad();
  if (conn.code && conn.token) { try { await conn.leave(); } catch (e) { conn.forget(); } }
  const JR = root.JRInvite, invCode = JR && JR.code ? JR.code('room') : '';
  if (invCode && JR.run) {
    JR.run({ code: invCode, lang, gameName: 'Malam Pendakian', nameKey: NAME_KEY, nameMax: 24, accent: '#ffb347',
      check: async code => { if (!conn.allowed) return 'offline'; if (!onlineOk) return { fallback: T('onlineDown') }; return conn.probe(code); },
      join: async name => {
        $('nameInput').value = name; setLS(NAME_KEY, name); ac();
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
root.MPApp = { get sim() { return sim; }, get room() { return room; }, get mode() { return mode; }, get me() { return me; }, get tut() { return tut; }, get gm() { return gm; }, get cam() { return cam; }, get pend() { return pend; },
  shout, sendChat, startSolo, startOnline, startDemo, toggleLight, give, setPray, conn, joy, aim, keys, tutEnd: () => tutEnd(true) };
})(window);

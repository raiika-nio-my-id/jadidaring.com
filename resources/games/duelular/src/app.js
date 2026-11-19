/* Duel Ular: UI, local practice, online host loop (authoritative sim + snapshot writes) and client renderer
   (interpolates snapshots so snakes glide between host writes). */
(function (root) {
'use strict';
const doc = root.document, U = root.UN, N = root.UNNet, $ = id => doc.getElementById(id);
const NAME_KEY = 'duelular.name', LANG_KEY = 'duelular.lang', MUTE_KEY = 'duelular.mute', SET_KEY = 'duelular.set';
const TICK_MS = 600;           // host snapshot cadence (~100 writes/min, under the 120/min per-player limit)
const SIM_MS = 25;             // fixed sim step
const getLS = k => { try { return root.localStorage.getItem(k); } catch (e) { return null; } };
const setLS = (k, v) => { try { root.localStorage.setItem(k, v); } catch (e) { /* private mode */ } };
const ss = (() => { try { return root.sessionStorage; } catch (e) { return null; } })();
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* ---------- texts ---------- */
const TX = {
  id: {
    tagline: 'Ular santai multiplayer 2–8 pemain', lead: 'Makan wajik, tumbuh panjang, ambil power-up, dan jadi ular terakhir yang bertahan di kebun yang adem.',
    youTitle: 'Kamu', name: 'Nama panggilan', namePh: 'Tulis namamu', practiceTitle: 'Latihan (offline)', practiceSub: 'Main sendiri atau lawan bot, tanpa internet. Cocok buat coba kontrol dulu.',
    bots: 'Bot lawan', duration: 'Durasi', unlimited: '∞ Tanpa batas waktu', practiceGo: 'Mulai latihan', onlineTitle: 'Main online bareng teman', maxPlayers: 'Maks. pemain',
    createPub: 'Buat room publik', createPriv: 'Buat room privat', match: 'Cari room publik', codePh: 'KODE', join: 'Gabung',
    howTitle: 'Cara main', foot: 'Duel Ular · game JaRing (jadidaring.com). Kontrol: tombol arah (kiri bawah) atau WASD / panah, bisa juga geser layar; sprint: tahan tombol 💨 (kanan bawah) atau Spasi / Shift.',
    how: ['Ular maju <b>1 kotak tiap ' + U.CFG.base + ' ms</b>. Arahkan dengan <b>tombol arah</b> di kiri bawah (keyboard: <b>W A S D</b> / panah), atau <b>geser</b> di arena.', '<b>Sprint</b>: tahan tombol <b>💨</b> di kanan bawah (keyboard: <b>Spasi</b> / Shift) supaya lebih cepat. Tenaga sprint terbatas dan baru terisi lagi setelah tombol dilepas. Pencet berkali-kali tidak bikin lebih cepat.', '<b>Mau nabrak tembok</b>, <b>batu</b>, <b>badan sendiri</b>, atau <b>badan ular lain</b>? Ular <b>berhenti sebentar (' + U.CFG.grace + ' ms)</b> sambil berkedip. Belok ke arah aman dalam waktu itu dan kamu selamat. Kalau tidak belok, kamu tersingkir.', '<b>Adu kepala</b> (dua kepala masuk kotak yang sama) = dua-duanya langsung tersingkir. Kepalamu ditandai garis tepi di depan dan samping.', '<b>Wajik kecil</b> +1 ruas, <b>berlian besar</b> +3 ruas. Makanan dan power-up <b>tidak hilang</b> sampai dimakan. <b>🐢 Kura-kura</b> bikin <b>kamu sendiri</b> lebih pelan. <b>🧲 Magnet</b>: selama aktif, makanan dalam jarak <b>2 kotak</b> dari kepala langsung termakan.', '<b>Tanpa batas waktu</b>: ronde jalan terus sampai tinggal <b>satu ular</b>. Itu pemenangnya.'],
    lgSmall: 'Wajik kecil +1', lgBig: 'Berlian +3', lgFast: 'Ngebut (kamu)', lgSlow: 'Pelan (kamu)', lgMag: 'Magnet 2 kotak', lgOb: 'Batu (rintangan)', sprint: 'Sprint', sprintHint: 'Tahan untuk sprint (Spasi / Shift)', kSpace: 'Spasi', grace: 'Belok!',
    gmTitle: 'Semua lobi (GM)', gmRefresh: '↻ Muat ulang', gmPrivate: 'Privat', gmPublic: 'Publik', gmWaiting: 'Menunggu', gmPlaying: 'Main', gmPlayers: '{n}/{max} pemain · {w} penonton', gmEmpty: 'Belum ada lobi.', gmLoading: 'Memuat lobi…', gmCount: '{n} lobi (termasuk privat).', gmJoin: 'Gabung', gmWatch: '👁 Tonton', gmErr: 'Gagal memuat lobi: {msg}',
    roomCode: 'Kode room', invite: 'Salin undangan', leave: 'Keluar', players: 'Pemain', start: 'Mulai main', host: 'Host', you: 'Kamu',
    visPub: 'Room publik: siapa pun bisa masuk lewat "Cari room publik".', visPriv: 'Room privat: bagikan kode atau tautan undangan.',
    needTwo: 'Butuh minimal 2 pemain untuk mulai. Ajak teman lewat kode di atas.', waitHost: 'Menunggu host memulai permainan…', spectating: 'Kamu menonton room ini.',
    exit: '✕ Keluar', pause: '⏸ Jeda', resume: '▶ Lanjut', paused: 'Dijeda', len: 'Panjang', ready: 'Siap…', go: 'GAS!',
    youDied: 'Kamu tersingkir!', why_wall: 'nabrak tembok, tidak sempat belok', why_obs: 'nabrak batu, tidak sempat belok', why_self: 'nabrak badan sendiri, tidak sempat belok', why_body: 'nabrak badan ular lain, tidak sempat belok', why_head: 'adu kepala', why_left: 'keluar',
    watching: 'Menonton', waitingHost: 'Menunggu host…', gameOver: 'Permainan selesai', winner: '{n} menang!', soloEnd: 'Panjang akhir: {l}', draw: 'Seri! Tidak ada pemenang',
    again: 'Main lagi', toLobby: 'Ke lobi', menu: 'Menu utama', waitAgain: 'Menunggu host main lagi…', rankLen: '{l} ruas', rankDead: '✝ {w} maks',
    copied: 'Tautan undangan disalin!', exitConfirm: 'Keluar dari permainan?', errName: 'Isi nama dulu ya.', errCode: 'Kode room harus 6 huruf/angka.',
    errNet: 'Koneksi bermasalah. Coba lagi.', errBusy: 'Server sibuk, tunggu {s} detik.', errMissing: 'Room tidak ditemukan.', errFull: 'Room penuh atau sedang main, kamu masuk sebagai penonton.', errGeneric: 'Gagal: {msg}',
    onlineOff: 'Main online hanya bisa di situs jadidaring.com. Mode latihan tetap bisa dipakai.', onlineDown: 'Server game sedang tidak tersedia. Mode latihan tetap bisa dipakai.', roomGone: 'Room sudah berakhir.', afkWarn: 'Kamu tidak aktif. Sentuh layar dalam 60 detik supaya tetap di room.', afkKick: 'Kamu keluar dari room karena tidak aktif (AFK).', hostAfk: 'Host tidak aktif / sudah keluar. Kamu dikeluarkan dari room, silakan cari room lagi.', afk: 'AFK', gmStale: 'Nyangkut {m} mnt',
    hostTook: 'Kamu sekarang host — permainan dilanjutkan dari perangkatmu.', netHost: 'Kamu host: arena dihitung di perangkatmu (~{hz}×/detik dikirim).', netClient: 'Arena dari host, diperhalus di layarmu.', bot: 'Bot', soundOn: '🔊', soundOff: '🔇'
  },
  en: {
    tagline: 'Cozy multiplayer snake for 2–8 players', lead: 'Munch gems, grow long, grab power-ups and be the last snake standing in a calm little garden.',
    youTitle: 'You', name: 'Nickname', namePh: 'Type your name', practiceTitle: 'Practice (offline)', practiceSub: 'Play alone or against bots, no internet needed. Great for learning the controls.',
    bots: 'Bot rivals', duration: 'Duration', unlimited: '∞ No time limit', practiceGo: 'Start practice', onlineTitle: 'Play online with friends', maxPlayers: 'Max players',
    createPub: 'Create public room', createPriv: 'Create private room', match: 'Find public room', codePh: 'CODE', join: 'Join',
    howTitle: 'How to play', foot: 'Duel Ular · a JaRing game (jadidaring.com). Controls: arrow pad (bottom left) or WASD / arrow keys, swipe also works; sprint: hold 💨 (bottom right) or Space / Shift.',
    how: ['Your snake moves <b>1 cell every ' + U.CFG.base + ' ms</b>. Steer with the <b>arrow pad</b> at the bottom left (keyboard: <b>W A S D</b> / arrow keys), or <b>swipe</b> on the arena.', '<b>Sprint</b>: hold <b>💨</b> at the bottom right (keyboard: <b>Space</b> / Shift) to go faster. Sprint energy is limited and refills after you let go. Tapping it repeatedly does not make you faster.', 'About to hit a <b>wall</b>, a <b>rock</b>, <b>your own body</b> or <b>another snake\'s body</b>? Your snake <b>pauses for a moment (' + U.CFG.grace + ' ms)</b> and blinks. Turn to a safe side in time and you are fine; no turn = out.', '<b>Head-on</b> (two heads into the same cell) = both out at once. Your head has an outline on its front and sides.', '<b>Small wajik</b> +1 segment, <b>big diamond</b> +3. Food and power-ups <b>never disappear</b> until eaten. <b>🐢 Turtle</b> slows <b>only you</b>. <b>🧲 Magnet</b>: while active, food within <b>2 cells</b> of your head is eaten instantly.', '<b>No time limit</b>: the round goes on until only <b>one snake</b> is left. That one wins.'],
    lgSmall: 'Small wajik +1', lgBig: 'Diamond +3', lgFast: 'Speed up (you)', lgSlow: 'Slow (you)', lgMag: 'Magnet, 2 cells', lgOb: 'Rock (obstacle)', sprint: 'Sprint', sprintHint: 'Hold to sprint (Space / Shift)', kSpace: 'Space', grace: 'Turn!',
    gmTitle: 'All lobbies (GM)', gmRefresh: '↻ Refresh', gmPrivate: 'Private', gmPublic: 'Public', gmWaiting: 'Waiting', gmPlaying: 'Playing', gmPlayers: '{n}/{max} players · {w} watching', gmEmpty: 'No lobbies yet.', gmLoading: 'Loading lobbies…', gmCount: '{n} lobbies (private included).', gmJoin: 'Join', gmWatch: '👁 Watch', gmErr: 'Could not load lobbies: {msg}',
    roomCode: 'Room code', invite: 'Copy invite', leave: 'Leave', players: 'Players', start: 'Start game', host: 'Host', you: 'You',
    visPub: 'Public room: anyone can join via "Find public room".', visPriv: 'Private room: share the code or invite link.',
    needTwo: 'At least 2 players are needed. Invite friends with the code above.', waitHost: 'Waiting for the host to start…', spectating: 'You are watching this room.',
    exit: '✕ Leave', pause: '⏸ Pause', resume: '▶ Resume', paused: 'Paused', len: 'Length', ready: 'Ready…', go: 'GO!',
    youDied: 'You are out!', why_wall: 'hit the wall, no turn in time', why_obs: 'hit a rock, no turn in time', why_self: 'bit your own body, no turn in time', why_body: 'hit another snake\'s body, no turn in time', why_head: 'head-on crash', why_left: 'left',
    watching: 'Watching', waitingHost: 'Waiting for host…', gameOver: 'Game over', winner: '{n} wins!', soloEnd: 'Final length: {l}', draw: 'Draw! No winner',
    again: 'Play again', toLobby: 'To lobby', menu: 'Main menu', waitAgain: 'Waiting for the host to play again…', rankLen: '{l} segments', rankDead: '✝ {w} max',
    copied: 'Invite link copied!', exitConfirm: 'Leave the game?', errName: 'Please enter your name.', errCode: 'Room code must be 6 letters/digits.',
    errNet: 'Connection problem. Try again.', errBusy: 'Server busy, wait {s} s.', errMissing: 'Room not found.', errFull: 'Room is full or playing; you joined as a spectator.', errGeneric: 'Failed: {msg}',
    onlineOff: 'Online play only works on jadidaring.com. Practice mode still works.', onlineDown: 'The game server is unavailable. Practice mode still works.', roomGone: 'The room has ended.', afkWarn: 'You are idle. Tap the screen within 60 s to stay in the room.', afkKick: 'You left the room because you were idle (AFK).', hostAfk: 'The host is idle or gone. You left the room, please find another one.', afk: 'AFK', gmStale: 'Stale {m} min',
    hostTook: 'You are now the host — the game continues on your device.', netHost: 'You host: the arena runs on your device (~{hz}×/s sent).', netClient: 'Arena from the host, smoothed on your screen.', bot: 'Bot', soundOn: '🔊', soundOff: '🔇'
  }
};
let lang = getLS(LANG_KEY) === 'en' ? 'en' : 'id';
const T = (k, v) => { let s = (TX[lang][k] ?? TX.id[k] ?? k); if (v) s = String(s).replace(/\{(\w+)\}/g, (m, x) => v[x] ?? m); return s; };
function applyLang() {
  doc.documentElement.lang = lang;
  doc.querySelectorAll('[data-t]').forEach(e => { e.textContent = T(e.dataset.t); });
  doc.querySelectorAll('[data-tp]').forEach(e => { e.placeholder = T(e.dataset.tp); });
  doc.querySelectorAll('.lb').forEach(b => b.classList.toggle('on', b.dataset.lang === lang));
  $('howList').innerHTML = T('how').map(x => '<li>' + x + '</li>').join('');
  const gem = big => '<svg viewBox="0 0 24 24" width="22" height="22" style="filter:drop-shadow(0 0 3px rgba(255,214,64,.9))">' + (big
    ? '<path d="M12 1.5L22 12 12 22.5 2 12Z" fill="#f2b51d"/><path d="M12 1.5L22 12H2Z" fill="#ffd84a"/><path d="M12 6L16.5 12 12 18 7.5 12Z" fill="#fff3b0"/><path d="M12 1.5L22 12 12 22.5 2 12Z" fill="none" stroke="#b9800c" stroke-width="1.2" stroke-linejoin="round"/>'
    : '<path d="M12 5L18 12 12 19 6 12Z" fill="#ffcf33"/><path d="M12 5L18 12H6Z" fill="#ffe680"/><path d="M12 5L18 12 12 19 6 12Z" fill="none" stroke="#c98d10" stroke-width="1" stroke-linejoin="round"/>') + '</svg>';
  $('legend').innerHTML = [[0, gem(0), 'lgSmall'], [0, gem(1), 'lgBig'], [0, '⚡', 'lgFast'], [0, '🐢', 'lgSlow'], [0, '🧲', 'lgMag'], ['#8c7b6b', '■', 'lgOb']]
    .map(([c, s, k]) => '<div><i style="' + (c ? 'background:' + c + '26;border:1px solid ' + c + '99;color:' + c : 'font-size:17px') + '">' + s + '</i>' + esc(T(k)) + '</div>').join('');
  const sb = $('sprintBtn'); if (sb) { sb.title = T('sprintHint'); sb.setAttribute('aria-label', T('sprintHint')); }
  onlineNote(); paintMute(); if (room) renderRoom(); renderGm();
}

/* ---------- sound (tiny WebAudio blips) ---------- */
let actx = null, muted = getLS(MUTE_KEY) === '1';
function beep(f, ms, type = 'square', vol = 0.06, slide = 0) {
  if (muted) return; try {
    actx = actx || new (root.AudioContext || root.webkitAudioContext)(); if (actx.state === 'suspended') actx.resume();
    const o = actx.createOscillator(), g = actx.createGain(), t = actx.currentTime; o.type = type; o.frequency.setValueAtTime(f, t); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, f + slide), t + ms / 1000);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + ms / 1000); o.connect(g); g.connect(actx.destination); o.start(t); o.stop(t + ms / 1000 + 0.02);
  } catch (e) { /* no audio */ }
}
const SFX = { eat: () => beep(740, 80, 'sine', 0.05), eatB: () => { beep(587, 100, 'sine', 0.06); setTimeout(() => beep(880, 140, 'sine', 0.06), 80); }, eatM: () => beep(980, 60, 'sine', 0.035, 200), pws: () => beep(440, 240, 'triangle', 0.05, 440), pwl: () => beep(520, 280, 'triangle', 0.05, -260), pwm: () => beep(330, 260, 'sine', 0.06, 330),
  gr: () => beep(392, 260, 'sine', 0.06, -60), grok: () => beep(523, 90, 'sine', 0.05, 160), die: () => beep(330, 420, 'triangle', 0.06, -200), ob: () => beep(196, 90, 'sine', 0.03), cd: () => beep(523, 110, 'sine', 0.05), go: () => beep(784, 220, 'triangle', 0.06), win: () => { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => beep(f, 170, 'triangle', 0.05), i * 130)); } };
function paintMute() { ['muteBtn', 'muteBtn2'].forEach(id => { const b = $(id); if (b) { b.textContent = muted ? T('soundOff') : T('soundOn'); b.setAttribute('aria-pressed', muted ? 'true' : 'false'); } }); }

/* ---------- small helpers ---------- */
function toast(msg, kind = '', ms = 2600) { const el = doc.createElement('div'); el.className = 'toast ' + kind; el.textContent = msg; $('toasts').appendChild(el); setTimeout(() => el.remove(), ms); }
function show(id) { ['home', 'lobby', 'game', 'end'].forEach(s => { $(s).hidden = s !== id; }); doc.documentElement.classList.toggle('jr-hub-off', id === 'game'); if (id === 'game') fitBoard(); }
function seg(id, val, onPick) { const el = $(id); const paint = v => el.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.v === String(v))); paint(val); el.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; paint(b.dataset.v); onPick(Number(b.dataset.v)); }); return paint; }
const fmtTime = ms => { ms = Math.max(0, ms); const s = Math.ceil(ms / 1000); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
function bucket(cap, perSec) { let tokens = cap, at = Date.now(); const fill = () => { const n = Date.now(); tokens = Math.min(cap, tokens + (n - at) / 1000 * perSec); at = n; }; return { take() { fill(); if (tokens >= 1) { tokens -= 1; return true; } return false; }, level() { fill(); return tokens; } }; }
const saved = (() => { try { return Object.assign({ bots: 3, dur: 150, mx: 8, odur: 150 }, JSON.parse(getLS(SET_KEY) || '{}')); } catch (e) { return { bots: 3, dur: 150, mx: 8, odur: 150 }; } })();
const saveSet = () => setLS(SET_KEY, JSON.stringify(saved));
const myName = () => $('nameInput').value.replace(/\s+/g, ' ').trim().slice(0, 24);

/* ---------- state ---------- */
let mode = null;         // 'solo' | 'online'
let sim = null;          // local authoritative sim (solo, or online when I am host)
let room = null, me = 1;
let paused = false, lastFrame = 0, simAcc = 0, raf = 0;
let wire = null, wireRx = 0, wireGap = TICK_MS, wireT = -1;   // client: last snapshot view
let seenV = 0, lastEv = 0, endSent = false, hostG = null, wasHost = false;
let tickBusy = false, lastTick = 0, hostBudget = bucket(3, 1.75);
const dbg = { lat: [], sentLat: [], q: {}, tap: 0 };
let pendAt = null, turnBusy = false, pend = '', turnSeq = 0, turnBudget = bucket(6, 1.8), turnG = null;
/* realtime input (.room.input): own limiter 120/min per token -> bucket 6 + 1.9/s stays <= 120/min. inflight = turns sent via
   /input not yet acked by a host snapshot (resent through actions if the WS fanout was lost). rturn = remote turns to draw now. */
let inputOff = 0, inBudget = bucket(6, 1.9), hostInBudget = bucket(6, 1.9), hostSeq = 0, inflight = []; const rturn = new Map();
const INPUT_ECHO_MS = 600, INPUT_RESEND_MS = 2000, RTURN_TTL_MS = 2500;
let deadShown = false, onlineOk = false, starting = false;
/* t302u presence / AFK: public rooms used to keep ghost seats (tab closed without pagehide, phone locked, AFK) and rooms frozen on
   "Permainan selesai" forever, and server rooms/match sent every new player into the oldest one. Now:
   - host writes a tiny state heartbeat (s.hb) every HB_MS in lobby/end so the room's updatedAt stays fresh (matchmaking skips stale rooms);
   - seated guests send a light /input heartbeat (no version bump) so everyone can tag silent seats AFK; AFK seats get no snake at start;
   - idle in lobby/end (no tap/key) -> warn at 3 min, leave at 4 min; tab hidden too long -> leave (play: host 25 s / guest 60 s; else 150 s);
   - guests leave a room whose host shows no sign of life (lobby/end 120 s, play 45 s) instead of staring at a frozen results screen;
   - host returns the room to the lobby 30 s after a round ends. */
const HB_MS = 25000, GUEST_HB_MS = 20000, AFK_SEAT_MS = 65000, IDLE_WARN_MS = 180000, IDLE_KICK_MS = 240000, END_LOBBY_MS = 30000;
let lastInputAt = Date.now(), hiddenAt = 0, phaseAt = 0, lastPh = '', hbAt = 0, hbInAt = 0, afkWarned = false, hostSig = '', hostSeenAt = 0, staleReadAt = 0, autoLobbyG = null, afkMsg = '';
const seatSeen = new Map(), seatFirst = new Map();
let netSeen = 0, wdAt = 0, wakeAt = 0, pushHalf = 60; // guest: when the wake for the pending read arrived; host: half of the last snapshot write RTT
const conn = new N.Connection({ storage: ss, onWake: () => { netSeen = performance.now(); if (room) { if (!wakeAt) wakeAt = performance.now(); room.refresh(); } }, onInput: d => { netSeen = performance.now(); onNetInput(d); }, onSocket: () => {}, lobbyWake: () => gmWake() });

/* ---------- board rendering ---------- */
const cv = $('board'), ctx = cv.getContext('2d');
let cs = 16, dpr = 1;
function fitBoard() {
  root.document.documentElement.style.setProperty('--vh', (root.innerHeight / 100) + 'px');
  const r = $('boardWrap').getBoundingClientRect(); if (!r.width || !r.height) return;
  const size = Math.max(150, Math.floor(Math.min(r.width, r.height))); cs = size / U.W; dpr = Math.min(2, root.devicePixelRatio || 1);
  cv.style.width = size + 'px'; cv.style.height = size + 'px'; cv.width = Math.round(size * dpr); cv.height = Math.round(size * dpr);
}
const px = c => (U.cx(c) + 0.5) * cs, py = c => (U.cy(c) + 0.5) * cs;
function pathPt(path, x) { const i = Math.floor(x), f = x - i, a = path[Math.min(i, path.length - 1)], b = path[Math.min(i + 1, path.length - 1)]; return [px(a) + (px(b) - px(a)) * f, py(a) + (py(b) - py(a)) * f]; }
/** axis-aligned block bar: one filled rect per straight run between consecutive points (never a rotated / diagonal draw).
    A non-orthogonal pair (should not happen) is drawn as an L through the corner, so the bar always reads as a manhattan polyline. */
function barRects(g, pts, w, dx = 0, dy = 0) {
  const h = w / 2, R = (x0, y0, x1, y1) => g.fillRect(Math.min(x0, x1) - h + dx, Math.min(y0, y1) - h + dy, Math.abs(x1 - x0) + w, Math.abs(y1 - y0) + w);
  if (pts.length === 1) { R(pts[0][0], pts[0][1], pts[0][0], pts[0][1]); return; }
  for (let i = 1; i < pts.length; i++) { const [x0, y0] = pts[i - 1], [x1, y1] = pts[i]; if (Math.abs(x1 - x0) > 0.01 && Math.abs(y1 - y0) > 0.01) { R(x0, y0, x1, y0); R(x1, y0, x1, y1); } else R(x0, y0, x1, y1); }
}
/** draw a snake as a flat blocky square bar (Zenless Zone Zero style) from `o` (cells back from the newest head) to the tail.
    Body = filled squares, no outline. Head = same square size as the body (+ eyes). Only the local player's head (opt.mine)
    gets a border, on the front and both sides only (never the back edge toward the neck); other snakes: plain filled head.
    opt.tail = explicit tail position along path (a growing snake keeps its tail still); default o + len - 1. */
function shade(hex, k) { const n = parseInt(hex.slice(1), 16); let r = n >> 16, g = (n >> 8) & 255, b = n & 255; const f = v => Math.round(k < 0 ? v * (1 + k) : v + (255 - v) * k); return 'rgb(' + f(r) + ',' + f(g) + ',' + f(b) + ')'; }
/** direction index of the head's back edge: toward the first body point (falls back to the opposite of the heading) */
function backDir(pts, d) {
  if (pts.length > 1) { const dx = pts[1][0] - pts[0][0], dy = pts[1][1] - pts[0][1]; if (Math.abs(dx) > 0.01 || Math.abs(dy) > 0.01) return Math.abs(dx) >= Math.abs(dy) ? (dx > 0 ? 1 : 3) : (dy > 0 ? 2 : 0); }
  return (d + 2) % 4;
}
/** head outline on 3 sides (inside the W0 square): every edge except `back` (0 up, 1 right, 2 down, 3 left). Uses g.fillStyle. */
function headBorder(g, hx, hy, W0, bw, back) {
  const x0 = hx - W0 / 2, y0 = hy - W0 / 2;
  if (back !== 0) g.fillRect(x0, y0, W0, bw);
  if (back !== 2) g.fillRect(x0, y0 + W0 - bw, W0, bw);
  if (back !== 3) g.fillRect(x0, y0, bw, W0);
  if (back !== 1) g.fillRect(x0 + W0 - bw, y0, bw, W0);
}
function drawSnake(path, o, len, color, opt = {}) {
  if (!path.length || len <= 0) return; o = Math.min(Math.max(0, o), path.length - 1);
  const end = Math.max(o, Math.min(path.length - 1, opt.tail ?? (o + len - 1)));
  const pts = [pathPt(path, o)]; for (let k = Math.floor(o) + 1; k < end; k++) pts.push([px(path[k]), py(path[k])]); if (end > o) pts.push(pathPt(path, end));
  ctx.save(); const A = opt.alpha ?? 1, W0 = cs * 0.84, hs = W0 / 2;
  ctx.globalAlpha = A * 0.14; ctx.fillStyle = 'rgb(60,45,30)'; barRects(ctx, pts, W0, 0, cs * 0.09);   // soft drop shadow, straight down only
  ctx.globalAlpha = A; ctx.fillStyle = color; barRects(ctx, pts, W0);                                 // body: flat filled squares, no stroke
  const [hx, hy] = pts[0], d = U.DIRS[opt.d | 0], ex = -d[1], ey = d[0];
  // head: exactly the body square (W0), border drawn inside it so the head is never larger than the body
  const bw = Math.max(1.5, cs * 0.13), gp = opt.grace ? 0.5 + 0.5 * Math.sin(performance.now() / 70) : 0;
  ctx.fillStyle = shade(color, 0.1); ctx.fillRect(hx - hs, hy - hs, W0, W0);
  if (opt.grace) { ctx.globalAlpha = A * (0.3 + 0.45 * gp); ctx.fillStyle = '#fff6d8'; ctx.fillRect(hx - hs, hy - hs, W0, W0); ctx.globalAlpha = A; }
  if (opt.mine) { ctx.fillStyle = opt.grace && gp > 0.5 ? '#fff6d8' : shade(color, -0.45); headBorder(ctx, hx, hy, W0, bw, backDir(pts, opt.d | 0)); }
  // simple eyes: two small white bars near the front edge (like the reference), dark pupils
  for (const sg of [-1, 1]) {
    const ix = hx + d[0] * cs * 0.14 + ex * sg * cs * 0.15, iy = hy + d[1] * cs * 0.14 + ey * sg * cs * 0.15, ew = cs * (d[0] ? 0.12 : 0.07), eh = cs * (d[0] ? 0.07 : 0.12);
    ctx.fillStyle = '#fffaf0'; ctx.fillRect(ix - ew, iy - eh, ew * 2, eh * 2);
    ctx.fillStyle = '#2f2a3a'; ctx.fillRect(ix + d[0] * cs * 0.03 - cs * 0.04, iy + d[1] * cs * 0.03 - cs * 0.04, cs * 0.08, cs * 0.08);
  }
  if (opt.sprint) { ctx.globalAlpha = 0.45 * A; ctx.fillStyle = '#fffaf0'; const t = Math.max(1, cs * 0.08); for (const sg of [-1, 1]) { const ax = hx - d[0] * cs * 0.95 + ex * sg * cs * 0.32, ay = hy - d[1] * cs * 0.95 + ey * sg * cs * 0.32, lx = d[0] ? cs * 0.5 : t, ly = d[0] ? t : cs * 0.5; ctx.fillRect(ax - lx / 2, ay - ly / 2, lx, ly); } }
  if (opt.label) { ctx.globalAlpha = 0.95 * A; ctx.font = '700 ' + Math.max(10, cs * 0.6) + 'px system-ui,sans-serif'; ctx.textAlign = 'center'; ctx.lineWidth = 3; ctx.lineJoin = 'round'; ctx.strokeStyle = 'rgba(255,250,240,.85)'; ctx.strokeText(opt.label, hx, hy - cs * 0.95); ctx.fillStyle = shade(color, -0.35); ctx.fillText(opt.label, hx, hy - cs * 0.95); }
  if (opt.arrow != null) { const a = U.DIRS[opt.arrow]; ctx.globalAlpha = 0.9 * A; ctx.fillStyle = '#fffaf0'; const r = cs * 0.12; ctx.fillRect(hx + a[0] * cs * 0.9 - r, hy + a[1] * cs * 0.9 - r, r * 2, r * 2); }
  ctx.restore();
}
function rr(x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
function drawScene(sc, now) {
  const S = cs * U.W; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, S, S);
  ctx.fillStyle = '#e4ecc9'; ctx.fillRect(0, 0, S, S);
  ctx.fillStyle = '#dbe5bd'; for (let y = 0; y < U.H; y++) for (let x = (y & 1); x < U.W; x += 2) ctx.fillRect(x * cs, y * cs, cs, cs); // soft grass checker
  const pulse = 0.5 + 0.5 * Math.sin(now / 260);
  for (const o of sc.ob) for (const c of o.c) {
    const x = U.cx(c) * cs, y = U.cy(c) * cs;
    if (o.on) { ctx.fillStyle = 'rgba(70,50,30,.18)'; rr(x + cs * 0.1, y + cs * 0.18, cs * 0.86, cs * 0.82, cs * 0.3); ctx.fill(); ctx.fillStyle = '#9c8b78'; rr(x + cs * 0.06, y + cs * 0.06, cs * 0.86, cs * 0.84, cs * 0.3); ctx.fill(); ctx.fillStyle = '#b7a893'; rr(x + cs * 0.18, y + cs * 0.14, cs * 0.46, cs * 0.3, cs * 0.15); ctx.fill(); }
    else { ctx.strokeStyle = 'rgba(140,123,107,' + (0.35 + 0.45 * pulse) + ')'; ctx.setLineDash([3, 3]); ctx.lineWidth = 2; rr(x + 2, y + 2, cs - 4, cs - 4, cs * 0.3); ctx.stroke(); ctx.setLineDash([]); }
  }
  // ZZZ-style pellets: small = flat yellow wajik (rhombus) with a soft glow; big = larger faceted gold diamond, stronger pulsing glow
  for (const c of sc.food) wajik(px(c), py(c), cs * 0.3, cs * 0.4, 6 + 3 * pulse);
  for (const c of sc.big) gem(px(c), py(c), cs * (0.46 + 0.04 * pulse), cs * (0.58 + 0.04 * pulse), 12 + 8 * pulse);
  const PW = { s: ['#e9b949', '⚡'], l: ['#6fae9a', '🐢'], m: ['#9b7fc0', '🧲'] };
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  // power-ups: plain icon, no disc / outline; just a soft coloured glow
  for (const p of sc.pw) { const [c, ic] = PW[p.k] || PW.s; ctx.save(); ctx.shadowColor = c; ctx.shadowBlur = 8 + 6 * pulse; ctx.font = Math.round(cs * (0.86 + 0.05 * pulse)) + 'px system-ui,"Apple Color Emoji","Segoe UI Emoji",sans-serif'; ctx.fillStyle = '#3b3226'; ctx.fillText(ic, px(p.p), py(p.p) + cs * 0.05); ctx.restore(); }
  ctx.textBaseline = 'alphabetic';
  for (const z of sc.snakes) { if (z.mag) { ctx.save(); ctx.globalAlpha = 0.18; ctx.fillStyle = '#9b7fc0'; const [hx, hy] = pathPt(z.path, z.o); ctx.beginPath(); ctx.arc(hx, hy, cs * 2.5, 0, 7); ctx.fill(); ctx.restore(); } }
  for (const z of sc.snakes) drawSnake(z.path, z.o, z.len, U.COLORS[z.c % 8], z);
  ctx.strokeStyle = '#b89a72'; ctx.lineWidth = 4; rr(2, 2, S - 4, S - 4, 10); ctx.stroke();
}
function rhomb(x, y, w, h) { ctx.beginPath(); ctx.moveTo(x, y - h); ctx.lineTo(x + w, y); ctx.lineTo(x, y + h); ctx.lineTo(x - w, y); ctx.closePath(); }
function wajik(x, y, w, h, glow) {
  ctx.save(); ctx.shadowColor = 'rgba(255,214,64,.95)'; ctx.shadowBlur = glow; ctx.fillStyle = '#ffcf33'; rhomb(x, y, w, h); ctx.fill(); ctx.restore();
  ctx.fillStyle = '#ffe680'; ctx.beginPath(); ctx.moveTo(x, y - h); ctx.lineTo(x + w, y); ctx.lineTo(x - w, y); ctx.closePath(); ctx.fill(); // lit upper half
  ctx.strokeStyle = '#c98d10'; ctx.lineWidth = Math.max(1, w * 0.12); ctx.lineJoin = 'round'; rhomb(x, y, w, h); ctx.stroke();
}
function gem(x, y, w, h, glow) {
  ctx.save(); ctx.shadowColor = 'rgba(255,200,40,1)'; ctx.shadowBlur = glow; ctx.fillStyle = '#f2b51d'; rhomb(x, y, w, h); ctx.fill(); ctx.restore();
  ctx.fillStyle = '#ffd84a'; ctx.beginPath(); ctx.moveTo(x, y - h); ctx.lineTo(x + w, y); ctx.lineTo(x - w, y); ctx.closePath(); ctx.fill(); // crown
  ctx.fillStyle = '#e09a12'; ctx.beginPath(); ctx.moveTo(x, y + h); ctx.lineTo(x + w, y); ctx.lineTo(x, y); ctx.closePath(); ctx.fill(); // shaded facet
  ctx.fillStyle = '#fff3b0'; rhomb(x, y, w * 0.45, h * 0.45); ctx.fill(); // table facet
  ctx.fillStyle = 'rgba(255,255,255,.9)'; rhomb(x - w * 0.12, y - h * 0.18, w * 0.12, h * 0.14); ctx.fill(); // sparkle
  ctx.strokeStyle = '#b9800c'; ctx.lineWidth = Math.max(1.2, w * 0.09); ctx.lineJoin = 'round'; rhomb(x, y, w, h); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x - w, y); ctx.lineTo(x + w, y); ctx.lineWidth = Math.max(1, w * 0.05); ctx.stroke(); // girdle
}

/** scene from the local sim (solo / host): 1-cell interpolation using each snake's move clock */
function sceneFromSim(now) {
  const t = sim.t, multi = sim.snakes.length > 1, sn = [];
  for (const s of sim.snakes) {
    if (s.al) {
      // f = progress (0..1) of the next move: the drawn head glides b[1] -> b[0] (one move behind, so it never guesses).
      // Tail: if the last move grew, the tail did not move -> it stays exactly on b[len-1] (no stale trail cell, no jump).
      const moved = s.n > 0 && s.b.length > 1, f = t < 0 || s.gr || !moved ? 1 : Math.min(1, Math.max(0, s.acc)), grew = !!s.lg;
      const still = grew || s.lt == null || !moved, path = still ? s.b.slice() : s.b.concat(s.lt), o = moved ? 1 - f : 0;
      sn.push({ path, o, len: s.b.length, tail: still ? s.b.length - 1 : o + s.b.length - 1, c: s.c, d: s.d, me: s.id === me && multi, mine: s.id === me && !s.bot, label: multi ? s.name : '', grace: cueF('h' + s.id, !!s.gr, now, 0), sprint: sim.sprinting(s), mag: s.fx.m > t });
    }
    else if (s.last && t - s.die < 1400) sn.push({ path: s.last, o: 0, len: s.last.length, c: s.c, d: s.d, alpha: 0.6 * (1 - (t - s.die) / 1400) });
  }
  return { snakes: sn, food: sim.food.filter(f => !f.k).map(f => f.p), big: sim.food.filter(f => f.k).map(f => f.p), pw: sim.pw, ob: sim.ob.map(o => ({ on: o.a <= t, c: o.c })) };
}
/** scene from the last snapshot (online client). Dead reckoning: each head keeps moving along its direction at its own
    speed from where the snapshot left it (max PRED cells), so what you see is close to the host's "now" instead of one
    tick behind. My own snake uses the direction I just tapped. `lagMs` (snapshot age) self-calibrates on every snapshot. */
/* PRED: how many cells a head may glide past the snapshot. It used to be a fixed 3, but one snapshot gap (~600 ms) + its age
   (~200-500 ms) is 6-7 cells at 150 ms/cell (9-10 sprinting), so every guest snake stopped dead for the last part of each
   gap and then jumped = the stutter guests felt while the host (local sim) was smooth. Now the cap covers gap + age. */
/* own snake (t294u): its path is known (my own taps), so it may glide further; at 6 cells the guest's own head stalled every
   snapshot gap on a slow link ("ga bisa gerak"). Other snakes stay at 6 (a wrong guess there = blink). */
const PRED_MIN = 3, PRED_MAX = +(root.__PREDMAX || 6), PRED_OWN = 10, capOf = s => s.id === me ? PRED_OWN : PRED_MAX;
function predCap(s, el) { const iv = U.ivOf(s.x[0] * 100 > el, s.x[1] * 100 > el, s.sp) || U.CFG.base; return Math.max(PRED_MIN, Math.min(capOf(s), Math.ceil((wireGap * 1.35 + lagMs) / iv) + 1)); }
let lagMs = 200, meAbs = 0, ownTurns = []; const eMax = new Map(), drawnProg = new Map(); let eMaxT = -2; // per-snake prediction never runs backwards within one snapshot
function ahead(s, el) {
  if (!wire || wire.t < 0 || !s.al || s.x[3]) return 0; const iv = U.ivOf(s.x[0] * 100 > el, s.x[1] * 100 > el, s.sp); // host-confirmed sprint only: toggling locally never makes the prediction jump
  /* other snakes (t296u): a remote turn changes the path from the move after the one that snake is in, and reaches us one
     input trip later, so they are drawn one move + one trip behind the host sim (= what the host sees of itself, minus the
     trip). Their turns then always arrive before we draw past the corner: no path change under the head, no snap back. */
  if (s.id === me) return Math.max(0, s.u + (el + lagMs) / iv);
  return Math.max(remLo(s), s.u + (el + lagMs - remDelay()) / iv - 1);
}
/** debounced on/off cue (t305u): raw has to hold ON_MS before it shows; once shown it stays until raw has been false OFF_MS
    (net = 1: guest view built from snapshots; 0: local / host sim = the real state, hides at once when the snake is saved) */
const CUE_ON = 70, CUE_OFF = 140, cueSt = new Map(); let cueMine = false;
function cueF(key, raw, now, net) {
  let c = cueSt.get(key); if (!c) { c = { on: false, r0: -1, r1: -1e9 }; cueSt.set(key, c); }
  if (now < c.r1 - 5000) { c.on = false; c.r0 = -1; c.r1 = -1e9; } // clock reset / new page time base
  if (raw) { if (c.r0 < 0) c.r0 = now; c.r1 = now; if (!c.on && now - c.r0 >= CUE_ON) { c.on = true; c.t1 = now; } }
  else { c.r0 = -1; if (c.on && (!net || now - c.r1 >= CUE_OFF)) { c.on = false; if (dbg.cue && dbg.cue.length < 80) dbg.cue.push([key, Math.round(now - c.t1)]); } }
  return c.on;
}
let echoMs = 140; const remDelay = () => Math.max(60, Math.min(450, echoMs + 30));
const dirTo = (a, b, dflt) => { const dx = U.cx(b) - U.cx(a), dy = U.cy(b) - U.cy(a); return dy < 0 ? 0 : dx > 0 ? 1 : dy > 0 ? 2 : dx < 0 ? 3 : dflt; };
/** how far behind b[0] a remote head may be drawn: one move, if the snapshot carries the tail cell freed by that move */
function remLo(s) {
  if (s.id === me || s.b.length < 2 || !s.h.length || s.lg) return 0; const adj = (a, b) => Math.abs(U.cx(a) - U.cx(b)) + Math.abs(U.cy(a) - U.cy(b)) === 1;
  let n = 0, prev = s.b[s.b.length - 1]; while (n < 2 && n < s.h.length && adj(prev, s.h[n])) { prev = s.h[n]; n++; } return -n;
}
function sceneFromWire(now) {
  const el = now - wireRx, t = wire.t + Math.min(el, wireGap * 1.5), sn = [], last = pend.length ? +pend[pend.length - 1] : null;
  const obs = new Set(); for (const o of wire.ob) if (o.on) for (const c of o.c) obs.add(c);
  const occ = new Map(); for (const s of wire.sn) if (s.al) { // t296u: tail cells the snake has moved off by host-now are free (no false stop / snap)
    const iv = U.ivOf(s.x[0] * 100 > el, s.x[1] * 100 > el, s.sp) || U.CFG.base, adv = s.x[3] ? 0 : Math.max(0, Math.floor(s.u + (el + lagMs) / iv) - s.g), keep = Math.max(1, s.b.length - adv);
    for (let i = 0; i < keep; i++) occ.set(s.b[i], s.id); } // bodies (prediction stops before another snake = grace)
  for (const s of wire.sn) {
    if (s.al) {
      const mine = s.id === me;
      if (eMaxT !== wireT) { eMaxT = wireT; eMax.clear(); }
      /* own turns (t294u): the corner goes where MY head was drawn when I tapped (move `at`), never back at the snapshot head.
         A snapshot that is already past `at` (host had not got the turn yet) is rewound locally to that cell, like the host will. */
      const op = mine ? ownPlan(s) : null, rp = mine ? null : remotePlan(s, now), bk = op && op.rb ? op.rb.k : s.k, bb = op && op.rb ? op.rb.b : s.b;
      const stepDir = op ? (i => op.f(bk + i)) : rp || (() => s.d), dirN = stepDir(99);
      /* anti-blink: within one snapshot and across snapshots the drawn head never runs BACK along the path it was already
         drawn on (absolute move progress, any shape incl. own / remote turns); it holds until the prediction catches up. */
      /* t296u visual smoother: the drawn head (absolute move progress A) chases the prediction target T at its own speed,
         x0.25..2.2: a snapshot that is a bit ahead is caught up smoothly (no forward jump), one that is behind only slows the
         head down while the target moves (no freeze, never backwards); it snaps only when the path under the head changed
         or the error is large. */
      const iv = U.ivOf(s.x[0] * 100 > el, s.x[1] * 100 > el, s.sp) || U.CFG.base;
      const eNow = (s.k - bk) + Math.min(predCap(s, el), ahead(s, el)), pv = drawnProg.get(s.id), T = bk + eNow, gid = room && room.s.g;
      let e = eNow, A = -1;
      const lo = op && op.rb ? 0 : remLo(s);
      if (pv && pv.g === gid && pv.k < bk + lo && dbg.vlog && dbg.vlog.length < 60) dbg.vlog.push(['fwd', mine, +(pv.k - bk).toFixed(2), +eNow.toFixed(2), bk, lo, wireSrc, Math.round(el), Math.round(lagMs), Math.round(echoMs)]);
      if (pv && pv.g === gid && pv.k >= bk + lo && now > pv.t) {
        A = pv.k - bk; const d = eNow - A, step = Math.min(100, now - pv.t) / iv;
        const recent = pv.blk && now - pv.blk < 800; // head was held at a wall/body: the target ran on meanwhile, the host did not
        if (recent && d > 0) e = Math.min(eNow, A + step * 1.3);
        else if (d > 3 || -d > capOf(s)) { if (dbg.vlog && dbg.vlog.length < 60) dbg.vlog.push(['snap', mine, +A.toFixed(2), +eNow.toFixed(2), bk, s.k, wireT, Math.round(el), Math.round(lagMs), op ? JSON.stringify(ownTurns.map(t => [t.q, t.at, t.ds.join('')])) : '', s.ack]); A = -1; dbg.vsnap = (dbg.vsnap || 0) + 1; }
        else if (d >= 0) e = Math.min(eNow, A + step * Math.min(2.2, 1 + d));
        else e = T > pv.T + 1e-6 ? A + step * Math.max(0.6, 1 + 0.4 * d) : A; // t300u: was x0.25 (looked frozen when a snapshot landed behind the drawn head)
      }
      const want = Math.ceil(Math.max(e, eNow)), pred = [], pdir = []; let h = bb[0], brk = false;
      for (let i = 0; i < want; i++) { const di = stepDir(i), x = U.cx(h) + U.DIRS[di][0], y = U.cy(h) + U.DIRS[di][1]; if (x < 0 || y < 0 || x >= U.W || y >= U.H) { brk = true; break; } const c = U.cell(x, y); const oc = occ.get(c); if (obs.has(c) || (i && bb.includes(c)) || (oc != null && oc !== s.id)) { brk = true; break; } pred.push(c); pdir.push(di); h = c; }
      if (A >= 0 && pv.c != null) { const hk = Math.ceil(A - 1e-9) - 1, cNow = hk < 0 ? bb[0] : pred[hk]; if (cNow !== pv.c) { if (dbg.vlog && dbg.vlog.length < 60) dbg.vlog.push(['path', mine, +A.toFixed(2), +eNow.toFixed(2), bk, s.k, wireT, Math.round(el), Math.round(lagMs), op ? JSON.stringify(ownTurns.map(t => [t.q, t.at, t.ds.join('')])) : '', s.ack, pv.c, cNow, pred.length, brk, lagSrc.map(Math.round), wireSrc, Math.round(echoMs), rp ? 'rp' : '', JSON.stringify(rturn.get(s.id) || null), s.d, Math.round(s.u * 10)]); e = eNow; dbg.vpath = (dbg.vpath || 0) + 1; } }
      const ee = Math.max(lo, Math.min(e, pred.length)), blockedNow = brk && Math.ceil(e) > pred.length; pred.length = Math.max(0, Math.ceil(ee - 1e-9)); pdir.length = pred.length;
      h = pred.length ? pred[pred.length - 1] : bb[0]; const hd = pred.length ? pdir[pdir.length - 1] : stepDir(0), nd = stepDir(pred.length); if (mine) meAbs = bk + ee;
      drawnProg.set(s.id, { g: gid, k: bk + ee, T, t: now, c: pred.length ? pred[pred.length - 1] : bb[0], blk: blockedNow && ee >= pred.length - 0.02 ? now : pv && pv.g === gid ? pv.blk : 0 });
      const back = ee < 0, path = back ? bb.concat(s.h.slice(0, Math.ceil(-ee - 1e-9))) : pred.reverse().concat(bb), tail = back ? bb.length - 1 - ee : path.length - 1 - Math.max(0, ee - s.g); // pending growth: tail stays put; back = remote head drawn up to 1 move behind b[0] (tail on the freed cell)
      /* t305u Belok cue: the host freezes me at a wall for a moment when my turn reaches it late, even though I already
         turned on my screen -> that snapshot's grace flashed "Belok!" for 1-3 frames (mobile: slower link = more often).
         Server grace is ignored while my own turn is still unacked AND my drawn head can move on in the direction I chose;
         both cues are debounced (on after 70 ms, off after 140 ms) so one snapshot / one frame never blinks it. */
      const blkNext = blockedAhead(h, nd, obs) || ownAhead(h, nd, s) || otherAhead(h, nd, s, occ), srvGr = s.x[3] * 100 > el;
      const myTurnLate = mine && srvGr && !blkNext && (!!pend || ownTurns.some(t => s.ack < t.q));
      if (mine) dbg.grLate = (dbg.grLate || 0) + (myTurnLate ? 1 : 0);
      const gSrv = srvGr && !myTurnLate, gHead = cueF('h' + s.id, gSrv || (blockedNow && pred.length <= 1 && blkNext), now, 1);
      if (mine) cueMine = cueF('o', gSrv, now, 1);
      sn.push({ path, o: back ? -ee : pred.length - ee, len: s.b.length, tail, c: s.c, d: pred.length ? hd : back ? dirTo(bb[1], bb[0], s.d) : nd, me: mine, mine, label: s.name, arrow: mine && dirN !== s.d ? dirN : null, grace: gHead, sprint: s.sp, mag: s.x[2] * 100 > el });
    }
    else if (s.b.length && t - s.die < 1400 && s.die > 0) sn.push({ path: s.b, o: 0, len: s.b.length, c: s.c, d: s.d, alpha: 0.6 * Math.max(0, 1 - (t - s.die) / 1400) });
  }
  return { snakes: sn, food: wire.food, big: wire.big, pw: wire.pw, ob: wire.ob, t };
}

/** remote turn heard over .room.input before the host snapshot shows it: step i (0 = first predicted cell after s.b[0]) goes
    straight until the move index the sender turned at (a), then follows its 1-3 queued directions (reversals skipped). */
function ownPlan(s) {
  const g = room && room.s.g, now = performance.now();
  ownTurns = ownTurns.filter(t => t.g === g && now - t.t < 3000 && !(s.ack >= t.q && s.k >= t.at + t.ds.length));
  const list = ownTurns.slice(); if (pend) list.push({ q: Infinity, at: pendAt == null ? s.k : pendAt, ds: pend.split('').map(Number) });
  const steps = []; let cur = s.d, lastAt = -1, firstQ = 0;
  for (const t of list) for (let j = 0; j < t.ds.length; j++) {
    const d = t.ds[j]; if (d === cur || d === (cur + 2) % 4) continue; const at = Math.max(t.at + j, lastAt + 1);
    if (!steps.length) firstQ = t.q; steps.push([at, d]); cur = d; lastAt = at;
  }
  if (!steps.length) return null;
  const f = m => { let d = s.d; for (const st of steps) if (m >= st[0]) d = st[1]; return d; };
  /* snapshot already past my corner and the host has not applied it yet: re-route the last r moves locally (straight run only) */
  let rb = null; const r = s.k - steps[0][0];
  if (r >= 1 && r <= 6 && s.ack < firstQ && s.b.length > r && s.h.length >= r) {
    let straight = true; for (let j = 0; j < r; j++) if (s.b[j] !== U.cell(U.cx(s.b[j + 1]) + U.DIRS[s.d][0], U.cy(s.b[j + 1]) + U.DIRS[s.d][1])) straight = false;
    if (straight) { const b = s.b.slice(r); for (let j = 0; j < r; j++) b.push(s.h[j]); rb = { k: steps[0][0], b }; }
  }
  return { f, rb };
}
function remotePlan(s, now) {
  const all = rturn.get(s.id); if (!all) return null; const g = room && room.s.g;
  const list = all.filter(r => r.g === g && now - r.at <= RTURN_TTL_MS && !(r.host ? s.k >= (r.a == null ? 0 : r.a) + r.ds.length : s.ack >= r.q));
  if (!list.length) { rturn.delete(s.id); return null; } if (list.length !== all.length) rturn.set(s.id, list);
  const steps = []; let cur = s.d, lastAt = -1;
  for (const r of list) for (let j = 0; j < r.ds.length; j++) {
    const d = r.ds[j]; if (d === cur || d === (cur + 2) % 4) continue; const at = Math.max(r.a == null ? s.k : r.a + j, s.k, lastAt + 1); steps.push([at - s.k, d]); cur = d; lastAt = at;
  }
  if (!steps.length) return null;
  return i => { let d = s.d; for (const st of steps) if (i >= st[0]) d = st[1]; return d; };
}
function ownAhead(h, d, s) { const x = U.cx(h) + U.DIRS[d][0], y = U.cy(h) + U.DIRS[d][1]; if (x < 0 || y < 0 || x >= U.W || y >= U.H) return false; const k = s.b.indexOf(U.cell(x, y)); return k >= 0 && !(k === s.b.length - 1 && !s.g); }
function otherAhead(h, d, s, occ) { const x = U.cx(h) + U.DIRS[d][0], y = U.cy(h) + U.DIRS[d][1]; if (x < 0 || y < 0 || x >= U.W || y >= U.H) return false; const o = occ.get(U.cell(x, y)); return o != null && o !== s.id; }
function blockedAhead(h, d, obs) { const x = U.cx(h) + U.DIRS[d][0], y = U.cy(h) + U.DIRS[d][1]; return x < 0 || y < 0 || x >= U.W || y >= U.H || obs.has(U.cell(x, y)); }
/* ---------- HUD ---------- */
let hudKey = '';
function hud(view, t, dur, mine, fxLeft, stam) {
  const sb = $('sprintBtn'); if (sb) { const v = stam == null ? 1 : stam; sb.style.setProperty('--st', v.toFixed(2)); sb.classList.toggle('on', spOn); sb.classList.toggle('low', v < 0.15); }
  $('timer').textContent = !(dur > 0) ? fmtTime(Math.max(0, t) - 999) : t < 0 ? fmtTime(dur) : fmtTime(dur - t); // unlimited: elapsed time counts up
  $('myLen').textContent = mine ? (T('len') + ': ' + mine.len) : (room && room.spectator ? T('watching') : '');
  const fx = []; if (fxLeft) { if (fxLeft[0] > 0) fx.push('⚡ ' + Math.ceil(fxLeft[0] / 1000)); if (fxLeft[1] > 0) fx.push('🐢 ' + Math.ceil(fxLeft[1] / 1000)); if (fxLeft[2] > 0) fx.push('🧲 ' + Math.ceil(fxLeft[2] / 1000)); }
  $('myFx').innerHTML = fx.map(x => '<span>' + x + '</span>').join('');
  const rows = view.slice().sort((a, b) => (b.al - a.al) || (b.len - a.len));
  const key = rows.map(r => r.id + ':' + r.al + ':' + r.len + ':' + (isGm(r.id) ? 1 : 0)).join('|') + lang;
  if (key !== hudKey) { hudKey = key; $('scoreList').innerHTML = rows.map(r => '<li class="' + (r.al ? '' : 'dead ') + (r.id === me ? 'me' : '') + '"><span class="dot" style="background:' + U.COLORS[r.c % 8] + '"></span>' + esc(r.name) + (isGm(r.id) ? ' <em class="gm-tag">(GM)</em>' : mode === 'solo' && r.id === me ? ' <em class="gm-badge">(GM)</em>' : '') + '<b>' + (r.al ? r.len : '✝') + '</b></li>').join(''); }
  // countdown / death overlay
  const ov = $('overlay'); let html = '';
  if (t < 0) { const n = Math.ceil(-t / 1000); html = '<div class="big">' + n + '</div><div>' + esc(T('ready')) + '</div>'; if (n !== hud.cd) { hud.cd = n; SFX.cd(); } }
  else if (t < 700) { html = '<div class="big">' + esc(T('go')) + '</div>'; if (hud.cd !== 0) { hud.cd = 0; SFX.go(); } }
  else if (paused) html = '<div class="big">⏸</div><div>' + esc(T('paused')) + '</div>';
  else if (mine && mine.al && mine.gr) html = '<div class="gr">' + esc(T('grace')) + '</div>';
  else if (mine && !mine.al) html = '<div>' + esc(T('youDied')) + '</div><div class="small muted">' + esc(T('why_' + (mine.why || 'wall'))) + '</div>';
  else if (mode === 'online' && room && !room.isHost() && wireRx && performance.now() - wireRx > 3500) html = '<div class="small">' + esc(T('waitingHost')) + '</div>';
  if (ov.dataset.h !== html) { ov.dataset.h = html; ov.innerHTML = html; ov.hidden = !html; }
}
function playEvents(ev) { for (const e of ev) { if (e[0] <= lastEv) continue; lastEv = e[0]; const k = e[1], mine = e[3] === me; if (k.startsWith('eat') || k.startsWith('pw')) { if (mine) (SFX[k] || SFX.eat)(); } else if (k === 'gr' || k === 'grok') { if (mine) SFX[k](); } else if (k === 'die') { if (mine) SFX.die(); else beep(220, 90, 'sine', 0.03); } else if (k === 'ob') SFX.ob(); } }

/* ---------- main loop ---------- */
function frame(now) {
  raf = root.requestAnimationFrame(frame);
  if ($('game').hidden) return;
  const dt = Math.min(250, now - (lastFrame || now)); lastFrame = now;
  if (sim && mode === 'solo' && !paused) { simAcc += dt; while (simAcc >= SIM_MS) { simAcc -= SIM_MS; sim.step(SIM_MS); } }
  if (sim) {
    const sc = sceneFromSim(now); drawScene(sc, now); playEvents(sim.ev);
    const m = sim.snake(me), fxl = m ? [m.fx.s - sim.t, m.fx.l - sim.t, m.fx.m - sim.t] : null;
    hud(sim.snakes.map(s => ({ id: s.id, name: s.name, c: s.c, al: s.al, len: s.b.length })), sim.t, sim.dur, m ? { len: m.b.length, al: m.al, why: m.why, gr: cueF('o', !!m.gr, now, 0) } : null, fxl, m ? m.st / U.CFG.stamina : null);
    if (mode === 'solo' && sim.over) finishSolo();
  } else if (wire) {
    const sc = sceneFromWire(now); drawScene(sc, now); playEvents(wire.ev);
    const m = wire.sn.find(s => s.id === me), el = now - wireRx;
    if (m && inflight.length) resendLost(m);
    hud(wire.sn.map(s => ({ id: s.id, name: s.name, c: s.c, al: s.al, len: s.al ? s.b.length : 0 })), sc.t, wire.dur, m ? { len: m.b.length, al: m.al, why: m.why, gr: cueMine && m.al } : null, m ? [m.x[0] * 100 - el, m.x[1] * 100 - el, m.x[2] * 100 - el] : null, m ? m.st / 10 : null);
  }
}
/* host sim runs on a timer (keeps going when rAF is throttled) */
setInterval(() => {
  if (mode !== 'online' || !sim || !room || !room.isHost() || room.s.ph !== 'play') return;
  const now = performance.now(), dt = Math.min(1500, now - (hostLoop.at || now)); hostLoop.at = now; hostLoop.acc += dt;
  while (hostLoop.acc >= SIM_MS) { hostLoop.acc -= SIM_MS; sim.step(SIM_MS); }
  pruneLeft();
  if (sim.over && !endSent) { endSent = true; sendEnd(); return; }
  if (!tickBusy && Date.now() - lastTick >= TICK_MS && hostBudget.take()) sendTick(); else blastSnap();
}, SIM_MS);
const hostLoop = { at: 0, acc: 0 };

/* ---------- solo practice ---------- */
function startSolo() {
  stopOnline(); mode = 'solo'; me = 1; paused = false; simAcc = 0; lastEv = 0; deadShown = false; hud.cd = null; spOn = false; spSent = 0;
  const name = myName() || (lang === 'en' ? 'You' : 'Kamu'), bots = saved.bots | 0, botNames = ['Neo', 'Lila', 'Bima', 'Sari', 'Rudi', 'Tari', 'Joko'];
  const players = [{ id: 1, name }].concat(Array.from({ length: bots }, (_, i) => ({ id: 100 + i, name: T('bot') + ' ' + botNames[i], bot: true })));
  sim = new U.Sim({ players, dur: 0 }); // unlimited $('pauseBtn').hidden = false; $('pauseBtn').textContent = T('pause');
  $('netInfo').textContent = ''; show('game'); hudKey = '';
}
let soloDone = false;
function finishSolo() { if (soloDone) return; soloDone = true; setTimeout(() => { soloDone = false; if (mode === 'solo' && sim && sim.over) showEnd(sim.ranking(), true); }, 900); }

/* ---------- online ---------- */
function makeRoom() { return new N.Room(conn, { onChange: onRoom }); }
function stopOnline() { if (room) { const r = room; room = null; r.leave(); } wire = null; }
function errMsg(e) {
  if (!e) return T('errNet'); if (e.code === 'busy') return T('errBusy', { s: e.wait || 10 }); if (e.code === 'network') return T('errNet');
  if (e.status === 404 || e.status === 422) return T('errMissing'); return T('errGeneric', { msg: e.server || e.message || '' });
}
async function enterOnline(kind, opts) {
  const r = makeRoom(); mode = 'online'; sim = null; wire = null; room = r; endSent = false; hostG = null;
  try { await r.enter(kind, Object.assign({ set: { dur: 0 }, maxPlayers: saved.mx }, opts)); } catch (e) { if (room === r) { room = null; mode = null; } throw e; }
  me = r.me; const n0 = Date.now(); lastInputAt = n0; phaseAt = n0; hostSeenAt = n0; hbAt = n0; hbInAt = 0; afkWarned = false; seatSeen.clear(); seatFirst.clear(); renderRoom(); gmAnnounce(); return r;
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
function onRoom(r, data) {
  if (r !== room) return;
  if (!data) { toast(T('roomGone'), 'warn'); exitToMenu(true); return; }
  me = r.me; const s = r.s, host = r.isHost(); gmMeSync(); seenRoom(r, data);
  if (host && s.ph === 'play') {
    if (!sim || hostG !== s.g) { // host migration (or my own start): resume from the last snapshot
      if (!(sim && hostG === s.g) && s.s) { sim = U.Sim.fromSnap(s.s); markRemote(sim); hostG = s.g; seenV = data.version; endSent = false; hostLoop.at = 0; hostLoop.acc = 0; if (wasHost === false && wire) toast(T('hostTook'), 'good', 4000); }
    }
    takeInputs(data.events);
  } else if (!host && !starting) { sim = null; hostG = null; }
  wasHost = host;
  if (s.ph === 'play' && s.s && !host) {
    if (turnG !== s.g) { turnG = s.g; wireT = -1e9; turnSeq = 0; pend = ''; lastEv = 0; hud.cd = null; spSent = 0; inflight = []; rturn.clear(); }
    if (s.s.t !== wireT || !wire) { const n = performance.now(); takeWire(s.s, n, wakeAt ? n - wakeAt + (+s.lt || 60) + 30 : null, 0); }
  }
  wakeAt = 0;
  if (s.ph === 'play') { if ($('game').hidden) { hudKey = ''; lastEv = 0; hud.cd = null; $('pauseBtn').hidden = true; show('game'); } $('netInfo').textContent = host ? T('netHost', { hz: (1000 / TICK_MS).toFixed(1) }) : (r.spectator ? T('spectating') : T('netClient')); }
  else if (s.ph === 'end') { sim = host ? sim : null; showEnd(s.res, false); }
  else { if (!starting) sim = null; wire = null; renderRoom(); show('lobby'); }
}
/** online host: every snake except mine gets the extra network grace (their turn still has to travel to me) */
function markRemote(sm) { for (const z of sm.snakes) z.rm = z.id !== me; }
function takeInputs(events) {
  if (!sim) return;
  for (const e of events || []) {
    if (e.version <= seenV) continue; seenV = e.version;
    if (e.type !== 'dir') continue; applyDir(e.playerId, e.payload);
  }
}
/** host: one guest turn/sprint batch {g, q, d, a?, s?} from the action log OR the realtime input fanout (same checks: game id,
    seq > ack so a turn that arrives both ways is applied once, max 3 directions, digits 0-3 only) */
function applyDir(pid, p) {
  if (!sim || !p || p.g !== hostG || pid === me) return false;
  const s = sim.snake(pid), q = Number(p.q) || 0; if (!s || !s.al || q <= s.ack) return false;
  s.ack = q; const ds = String(p.d || '').replace(/[^0-3]/g, '').slice(0, 3), a = Number(p.a); if (p.s === 0 || p.s === 1) sim.sprint(s.id, p.s === 1);
  for (let i = 0; i < ds.length; i++) { const dd = Number(ds[i]); if (p.a != null && Number.isFinite(a)) sim.turnAt(s.id, dd, a + i); else sim.turn(s.id, dd); }
  return true;
}
/** .room.input from the room channel: host applies it to the sim right away (still authoritative, snapshots unchanged);
    every other viewer draws the remote turn immediately instead of waiting ~1 s for the next snapshot. No read, no version. */
function onNetInput(m) {
  if (!room || mode !== 'online' || !m || m.playerId == null) return;
  seatSeen.set(m.playerId, Date.now()); if (hostOf(room) === m.playerId) hostSeenAt = Date.now();
  if (m.input && m.input.payload && m.input.payload.hb === 1) return; // t302u presence heartbeat only
  if (m.playerId === me) { const q = Number(m.input && m.input.payload && m.input.payload.q) || 0; const tn = performance.now(); for (const x of inflight) if (x.q <= q) { if (!x.echo && x.q === q && x.sent) echoMs = Math.max(20, Math.min(800, echoMs * 0.7 + (tn - x.sent) * 0.3)); x.echo = true; } return; } // own echo = fanout works
  const p = m.input && m.input.payload; if (!p || typeof p !== 'object' || room.s.ph !== 'play') return;
  if (p.S && typeof p.S === 'object') { // t296u: host snapshot over the light fanout (no read round trip, ~2x the snapshot rate)
    const hp = room.data && room.data.players && room.data.players.find(q => q.id === m.playerId);
    if (!sim && hp && hp.host && p.g === room.s.g) { dbg.snapIn = (dbg.snapIn || 0) + 1; takeWire(p.S, performance.now(), (+p.lt || 60) + Math.min(250, echoMs * 0.5) + 15, 1); }
    return;
  }
  dbg.rxIn = (dbg.rxIn || 0) + 1;
  if (sim && room.isHost()) { if (applyDir(m.playerId, p)) dbg.inApplied = (dbg.inApplied || 0) + 1; return; }
  const ds = String(p.d || '').replace(/[^0-3]/g, '').slice(0, 3); if (!ds || p.g !== room.s.g) return;
  /* t296u: keep EVERY unacked remote turn (was only the newest: two quick turns -> the first was dropped -> wrong path -> snap) */
  const q = Number(p.q) || 0, list = (rturn.get(m.playerId) || []).filter(x => x.g === p.g); if (list.some(x => x.q >= q && x.host === !!p.h)) return;
  list.push({ g: p.g, q, a: Number.isFinite(Number(p.a)) && p.a != null ? Number(p.a) : null, ds: ds.split('').map(Number), host: !!p.h, at: performance.now() }); if (list.length > 8) list.shift();
  rturn.set(m.playerId, list);
}
/** host: blast my own turn so guests draw it now (visual only; the snapshot stays the authority). Skipped when over budget. */
function blastHostTurn(d) {
  if (!sim || !conn.inputReady() || !hostInBudget.take()) return; const s = sim.snake(me); if (!s || !s.al) return;
  conn.input({ direction: String(d), payload: { g: hostG, q: ++hostSeq, d: String(d), a: s.n, h: 1 } }).catch(() => {});
}
/* t296u: between two action snapshots (every TICK_MS) the host also fans one snapshot out over /input: no DB write, no version,
   and guests get it in the WS frame (no wake -> read trip). Shares the host input bucket with turn blasts (keeps 2 tokens for
   turns) so it stays under the 120/min input limit; a snapshot over ~3.9 KB (big 8p board) just waits for the action path. */
let lastSnapOut = 0, snapBusy = false, inHalf = 60; const enc8 = typeof TextEncoder === 'function' ? new TextEncoder() : null;
function blastSnap() {
  if (snapBusy || !sim || !room || root.__NOSNAPIN || !conn.inputReady() || room.s.ph !== 'play') return; const n = Date.now();
  if (n - lastTick < Math.min(TICK_MS * 0.8, TICK_MS * 0.5 + pushHalf) || n - lastSnapOut < TICK_MS * 0.45 || hostInBudget.level() < 3) return;
  const mk = sim.mark, S = sim.snap(); sim.mark = mk; lastSnapOut = n; // keep the action path's commit mark
  const body = { key: 'snap', payload: { g: hostG, S, lt: Math.round(inHalf) } }, js = JSON.stringify(body);
  if ((enc8 ? enc8.encode(js).length : js.length * 2) > 3900 || !hostInBudget.take()) return;
  snapBusy = true; const t0 = performance.now();
  conn.input(body).then(() => { inHalf = inHalf * 0.6 + Math.min(400, (performance.now() - t0) / 2) * 0.4; dbg.snapOut = (dbg.snapOut || 0) + 1; }).catch(() => {}).finally(() => { snapBusy = false; });
}
function pruneLeft() { if (!room || !sim) return; const ids = new Set(room.seated().map(p => p.id)); for (const s of sim.snakes) if (s.al && !ids.has(s.id)) sim.kill(s, 'left'); }
async function sendTick() {
  tickBusy = true; lastTick = Date.now(); const r = room;
  try { const state = Object.assign({}, r.s, { s: sim.snap(), lt: Math.round(pushHalf) }), t0 = performance.now(); await r.push('tick', { state }); pushHalf = pushHalf * 0.6 + Math.min(400, (performance.now() - t0) / 2) * 0.4; if (r === room && sim) sim.commit(); }
  catch (e) {
    if (e.status !== 409 || r !== room) return;
    try { await r.settle(e.used); if (r === room && sim && r.s.ph === 'play' && hostBudget.take()) { lastTick = Date.now(); await r.push('tick', { state: Object.assign({}, r.s, { s: sim.snap(), lt: Math.round(pushHalf) }) }); if (r === room && sim) sim.commit(); } } catch (e2) { /* next tick */ }
  }
  finally { tickBusy = false; }
}
async function sendEnd() {
  const r = room, res = sim.ranking(), snap = sim.snap();
  try { await r.edit('end', s => { if (s.ph !== 'play' || s.g !== hostG) return null; s.ph = 'end'; s.res = res; s.s = snap; return { status: 'waiting' }; }); SFX.win(); }
  catch (e) { endSent = false; }
}
async function startOnline() {
  const r = room; if (!r || !r.isHost()) return; const ps = r.seated().filter(p => !isAfk(p.id)); if (ps.length < 2) { toast(T('needTwo'), 'warn'); return; }
  const g = Math.random().toString(36).slice(2, 8), dur = 0; // unlimited (round ends when one snake is left)
  const next = new U.Sim({ players: ps.slice(0, 8).map((p, i) => ({ id: p.id, name: p.displayName, c: i, rm: p.id !== r.me })), dur });
  $('startBtn').disabled = true; $('againBtn').disabled = true; starting = true;
  try {
    sim = next; hostG = g; seenV = r.version; endSent = false; hostLoop.at = 0; hostLoop.acc = 0; lastEv = 0; hud.cd = null; hudKey = '';
    const res = await r.edit('start', (s, d) => { gmPrune(s, d); s.ph = 'play'; s.g = g; s.res = []; s.s = next.snap(); return { status: 'playing' }; });
    if (res) next.commit(); else { sim = null; hostG = null; }
  } catch (e) { sim = null; hostG = null; toast(errMsg(e), 'warn'); }
  finally { starting = false; $('startBtn').disabled = false; $('againBtn').disabled = false; }
}
async function toLobby() { const r = room; if (!r || !r.isHost()) return; try { await r.edit('lobby', (s, d) => { gmPrune(s, d); s.ph = 'lobby'; s.s = null; s.res = []; return { status: 'waiting' }; }); } catch (e) { toast(errMsg(e), 'warn'); } }
async function setDur(v) { saved.odur = v; saveSet(); const r = room; if (!r || !r.isHost()) return; try { await r.edit('set', s => { if (s.ph !== 'lobby') return null; s.set.dur = v; }); } catch (e) { toast(errMsg(e), 'warn'); } }

/* ---------- input ---------- */
let spOn = false, spSent = 0;
/** sprint is a hold: host / solo apply it directly, a client sends its intent (batched with turns, same write budget) */
/* sprint = ONE boolean "held" state: on while any sprint key or the 💨 button is held. Presses never add speed;
   the sim's move clock is a 0..1 progress, so toggling can never exceed the sprint interval. */
const spKeys = new Set(); let spBtn = false;
function sprintKey(code, down) { if (down) spKeys.add(code); else spKeys.delete(code); setSprint(spKeys.size > 0 || spBtn); }
function setSprint(on) {
  on = !!on; if (on === spOn) return; spOn = on;
  if ($('game').hidden) return;
  if (mode === 'solo' && sim) { sim.sprint(me, on); return; }
  if (mode !== 'online' || !room || room.spectator) return;
  if (sim && room.isHost()) { sim.sprint(me, on); return; }
  sendTurns();
}
function steer(d) {
  if ($('game').hidden) return;
  if (mode === 'solo' && sim) { if (!paused) sim.turn(me, d); return; }
  if (mode !== 'online' || !room || room.spectator) return;
  if (sim && room.isHost()) { sim.turn(me, d); blastHostTurn(d); return; }
  if (!wire) return; const mine = wire.sn.find(s => s.id === me); if (!mine || !mine.al) return;
  const last = pend.length ? +pend[pend.length - 1] : (turnSeq > mine.ack && steer.last != null ? steer.last : mine.d);
  if (d === last || d === (last + 2) % 4) return; if (!pend) { dbg.tap = Date.now(); let la = -1; for (const t of ownTurns) la = Math.max(la, t.at + t.ds.length - 1); pendAt = Math.max(drawnAt(mine), la + 1); } pend = (pend + d).slice(-3); steer.last = d; sendTurns();
}
/** move number of the cell my head is gliding into on screen right now (what the player reacts to) */
function drawnAt(mine) {
  const el = performance.now() - wireRx, est = mine.k + Math.min(predCap(mine, el), ahead(mine, el));
  const v = meAbs >= mine.k - 6 && meAbs <= mine.k + PRED_OWN + 1 ? meAbs : est; // what was actually drawn last frame
  return Math.max(0, Math.ceil(v - 0.1)); // the cell the head is gliding into: it never slides back to turn
}
/** t296u: one snapshot from either path (0 = action + read, 1 = host /input fanout). Older than what we already draw = ignored
    (the slower read path often lands after a newer fanout snapshot); a big step back = new host resumed -> take it. Each path
    keeps its own age estimate; lagMs = age of the snapshot on screen. */
const lagSrc = [250, 120]; let wireSrc = 0;
function takeWire(S, n, age, src) {
  if (wire && S.t <= wireT && S.t > wireT - 1500) { dbg.stale = (dbg.stale || 0) + 1; return; }
  if (wire && wireRx) wireGap = Math.max(200, Math.min(2500, wireGap * 0.7 + (n - wireRx) * 0.3));
  if (age != null) lagSrc[src] = Math.max(0, Math.min(900, lagSrc[src] * 0.6 + age * 0.4)); lagMs = lagSrc[src]; wireSrc = src;
  wire = U.view(S); wireT = S.t; wireRx = n; const mw = wire.sn.find(z => z.id === me); if (mw) resendLost(mw);
  if (mw) for (const k in dbg.q) if (+k <= mw.ack) { if (dbg.lat.length < 500) dbg.lat.push(Date.now() - dbg.q[k]); delete dbg.q[k]; }
}
/** snapshot age = (wake -> read landed here) + host's half write RTT (state.lt) + broadcast hop. The old self-calibration
    compared the prediction with the NEW snapshot's own position (which is just as old), so it converged to ~0 ms and every
    guest view ran a full snapshot-age (~2 cells) behind the host. Kept below for reference, no longer called. */
function measureAge(s, n) { if (!wakeAt) return; const age = n - wakeAt + (+s.lt || 60) + 30; lagMs = Math.max(0, Math.min(900, lagMs * 0.6 + age * 0.4)); }
/** (unused) snapshot age estimate: predicted (k + ahead) of straight-moving snakes vs their real k + u in the new snapshot */
function calibrate(old, nv, el) {
  if (!old || old.t < 0 || nv.t < 0) return; let err = 0, n = 0;
  for (const s of old.sn) { const z = nv.sn.find(q => q.id === s.id); if (!s.al || !z || !z.al || z.d !== s.d || z.k - s.k > 8) continue; if (s.x[3] || z.x[3]) continue; const iv = U.ivOf(s.x[0] * 100 > el, s.x[1] * 100 > el, s.sp); err += ((z.k + z.u) - (s.k + ahead(s, el))) * iv; n++; }
  if (n) lagMs = Math.max(0, Math.min(900, lagMs + 0.35 * err / n));
}
/* Guest turns: first choice is the light realtime input (POST rooms/{code}/input -> .room.input to everyone, ~1 WS hop),
   fallback is the old versioned 'dir' action (host reads it from the event log). Same payload either way; host dedupes by q. */
async function sendTurns() {
  const spWant = spOn ? 1 : 0;
  if (turnBusy || (!pend && spWant === spSent) || !room || room.spectator || !wire) return;
  const live = !root.__NOINPUT && performance.now() > inputOff && conn.inputReady() && inBudget.take();
  if (!live && !turnBudget.take()) { setTimeout(sendTurns, 160); return; }
  turnBusy = true; const d = pend, q = ++turnSeq, r = room, a = pendAt; pend = ''; pendAt = null; if (d) ownTurns.push({ q, g: r.s.g, at: a == null ? (wire ? (wire.sn.find(z => z.id === me) || {}).k | 0 : 0) : a, ds: d.split('').map(Number), t: performance.now() }); const t0 = dbg.tap, sp0 = spSent; spSent = spWant;
  const payload = { g: r.s.g, q, d }; if (a != null && d) payload.a = a; if (spWant !== sp0 || !d) payload.s = spWant;
  if (live) {
    try {
      const body = { key: d ? 'turn' : 'sprint', payload }; if (d) body.direction = d;
      const fl = { q, payload, at: Infinity, echo: false, sent: performance.now() }; inflight.push(fl); if (inflight.length > 8) inflight.shift(); // echo may beat the 202
      try { await conn.input(body); } catch (e) { inflight = inflight.filter(x => x !== fl); throw e; } fl.at = performance.now();
      if (d) { dbg.q[q] = t0; if (dbg.sentLat.length < 500) dbg.sentLat.push(Date.now() - t0); } dbg.viaInput = (dbg.viaInput || 0) + 1;
      turnBusy = false; if (pend || (spOn ? 1 : 0) !== spSent) setTimeout(sendTurns, 0); return;
    } catch (e) { dbg.inputFail = (dbg.inputFail || 0) + 1; if (r !== room) { turnBusy = false; return; } } // fall through: same payload via actions
  }
  try { await r.push('dir', { payload }); dbg.viaAction = (dbg.viaAction || 0) + 1; if (d) { dbg.q[q] = t0; if (dbg.sentLat.length < 500) dbg.sentLat.push(Date.now() - t0); } }
  catch (e) { spSent = sp0; ownTurns = ownTurns.filter(x => x.q !== q); if (e.status === 409 && r === room) { pend = (d + pend).slice(-3); pendAt = a; turnSeq--; try { await r.settle(e.used); } catch (e2) { /* ignore */ } } }
  finally { turnBusy = false; if (pend || (spOn ? 1 : 0) !== spSent) setTimeout(sendTurns, 30); }
}
/** a turn sent over /input that the host snapshot still has not acked after INPUT_RESEND_MS (fanout lost, host socket was
    reconnecting...): resend the newest one through the persisted 'dir' action so it can never be lost (host dedupes by q). */
function resendLost(mw) {
  inflight = inflight.filter(x => x.q > mw.ack); if (!inflight.length) return;
  /* no own echo 600 ms after the POST returned (Reverb echoes to the sender too, before the 202 on live) = fanout lost -> resend
     now; echoed but still not acked by a snapshot after 2 s (host socket down?) -> resend too */
  const now = performance.now(), late = inflight.filter(x => now - x.at > (x.echo ? INPUT_RESEND_MS : INPUT_ECHO_MS)); if (!late.length) return;
  const all = inflight, last = all[all.length - 1], r = room; inflight = [];
  if (!last.echo) inputOff = now + 15000; // fanout looks broken: actions only for a while
  if (!r || r.spectator || !turnBudget.take()) return;
  const payload = Object.assign({}, last.payload, { d: all.map(x => x.payload.d || '').join('').slice(-3), s: spOn ? 1 : 0 });
  if (all.length > 1 || last.echo) delete payload.a; // several / very late turns: no lag rewind, plain turns
  dbg.resent = (dbg.resent || 0) + 1; r.push('dir', { payload }).catch(() => {});
}
const KEYS = { ArrowUp: 0, KeyW: 0, ArrowRight: 1, KeyD: 1, ArrowDown: 2, KeyS: 2, ArrowLeft: 3, KeyA: 3 };
const SPRINT_KEYS = ['ShiftLeft', 'ShiftRight', 'Space'];
doc.addEventListener('keydown', e => {
  if ($('game').hidden || e.target.tagName === 'INPUT') return;
  if (e.code in KEYS) { e.preventDefault(); steer(KEYS[e.code]); }
  else if (SPRINT_KEYS.includes(e.code)) { e.preventDefault(); if (!e.repeat) sprintKey(e.code, true); } // key-repeat ignored
  else if ((e.code === 'KeyP' || e.code === 'Escape') && mode === 'solo') { e.preventDefault(); togglePause(); }
});
doc.addEventListener('keyup', e => { if (SPRINT_KEYS.includes(e.code)) sprintKey(e.code, false); });
root.addEventListener('blur', () => { spKeys.clear(); spBtn = false; setSprint(false); });
(function swipe() {
  let sx = 0, sy = 0, on = false; const el = $('game');
  el.addEventListener('touchstart', e => { if (e.target.closest('button')) return; const t = e.touches[0]; sx = t.clientX; sy = t.clientY; on = true; }, { passive: true });
  el.addEventListener('touchmove', e => {
    if (!on) return; e.preventDefault(); const t = e.touches[0], dx = t.clientX - sx, dy = t.clientY - sy;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 22) return; steer(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 1 : 3) : (dy > 0 ? 2 : 0)); sx = t.clientX; sy = t.clientY;
  }, { passive: false });
  el.addEventListener('touchend', () => { on = false; });
})();
(function sprintBtn() {
  const b = $('sprintBtn'); if (!b) return; let pid = null;
  b.addEventListener('pointerdown', e => { e.preventDefault(); pid = e.pointerId; try { b.setPointerCapture(pid); } catch (x) { /* old browsers */ } spBtn = true; setSprint(true); });
  const up = e => { if (pid != null && e.pointerId !== pid) return; pid = null; spBtn = false; setSprint(spKeys.size > 0); };
  b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up); b.addEventListener('lostpointercapture', up);
  b.addEventListener('contextmenu', e => e.preventDefault());
})();
$('dpad').addEventListener('pointerdown', e => { const b = e.target.closest('[data-d]'); if (!b) return; e.preventDefault(); b.classList.add('hit'); setTimeout(() => b.classList.remove('hit'), 120); steer(Number(b.dataset.d)); });
function togglePause() { if (mode !== 'solo' || !sim || sim.over) return; paused = !paused; $('pauseBtn').textContent = paused ? T('resume') : T('pause'); }

/* ---------- t302u presence / AFK ---------- */
function hostOf(r) { const h = r && r.data && (r.data.players || []).find(p => p.host && !p.spectator); return h ? h.id : null; }
function seenRoom(r, data) {
  const n = Date.now(), s = r.s;
  for (const p of r.players()) if (!seatFirst.has(p.id)) seatFirst.set(p.id, n);
  for (const e of (data && data.events) || []) if (e.playerId != null && e.type !== 'join') { const t = Date.parse(e.createdAt || ''); seatSeen.set(e.playerId, Math.max(seatSeen.get(e.playerId) || 0, Number.isFinite(t) ? Math.min(n, t - (conn.offset || 0)) : n)); }
  const sig = [hostOf(r), s.ph, s.g, s.hb, s.s && s.s.t].join('|'); if (sig !== hostSig) { hostSig = sig; hostSeenAt = n; }
  if (s.ph !== lastPh) { lastPh = s.ph; phaseAt = n; afkWarned = false; }
}
/** a seat that showed no sign of life (heartbeat, input, action) for AFK_SEAT_MS; never me */
function isAfk(id) { if (!room || room.local || id === me) return false; const n = Date.now(); return n - Math.max(seatFirst.get(id) || n, seatSeen.get(id) || 0) > AFK_SEAT_MS; }
function afkOut(key) { if (!room) return; afkMsg = T(key); exitToMenu(false); if (doc.visibilityState === 'visible') { toast(afkMsg, 'warn', 7000); afkMsg = ''; } }
function presence() {
  const r = room; if (!r || r.local || mode !== 'online' || !r.data) return;
  const n = Date.now(), ph = r.s.ph, vis = doc.visibilityState === 'visible', host = r.isHost();
  if (hiddenAt && n - hiddenAt > (ph === 'play' ? (host ? 25000 : 60000) : 150000)) { afkOut('afkKick'); return; }
  if (ph !== 'play') {
    const idle = n - Math.max(lastInputAt, phaseAt);
    if (idle > IDLE_KICK_MS) { afkOut('afkKick'); return; }
    if (idle > IDLE_WARN_MS && !afkWarned && vis) { afkWarned = true; toast(T('afkWarn'), 'warn', 8000); }
    if (host && idle < IDLE_WARN_MS && n - hbAt > HB_MS) { hbAt = n; r.edit('hb', s => { if (s.ph === 'play') return null; s.hb = n; }).catch(() => {}); }
    if (!host && !r.spectator && n - hbInAt > GUEST_HB_MS) { hbInAt = n; if (conn.inputReady()) conn.input({ key: 'hb', payload: { hb: 1 } }).catch(() => {}); else r.push('hb', { payload: { hb: 1 } }).catch(() => {}); }
    if (host && ph === 'end' && n - phaseAt > END_LOBBY_MS && autoLobbyG !== r.s.g) { autoLobbyG = r.s.g; toLobby(); }
  }
  if (!host && vis) {
    const quiet = n - Math.max(hostSeenAt, phaseAt), lim = ph === 'play' ? 45000 : 120000;
    if (quiet > lim * 0.5 && n - staleReadAt > 10000) { staleReadAt = n; r.refresh(true); }
    if (quiet > lim) { afkOut('hostAfk'); return; }
  }
  if ($('lobby') && !$('lobby').hidden && n % 5000 < 1000) renderRoom();
}

/* ---------- screens ---------- */
function renderRoom() {
  const r = room; if (!r || !r.data) return; const s = r.s, host = r.isHost(), ps = r.seated();
  $('roomCode').textContent = r.code; $('lobbyVis').textContent = r.data.visibility === 'public' ? T('visPub') : T('visPriv');
  $('pCount').textContent = ps.length + '/' + (r.data.maxPlayers || 8);
  $('pList').innerHTML = ps.map((p, i) => '<li><span class="dot" style="background:' + U.COLORS[i % 8] + '"></span><span>' + esc(p.displayName) + (isGm(p.id, s) ? ' <em class="gm-tag">(GM)</em>' : '') + '</span>' + (p.id === r.me ? '<span class="tag">' + esc(T('you')) + '</span>' : '') + (p.host ? '<span class="tag">' + esc(T('host')) + '</span>' : '') + (isAfk(p.id) ? '<span class="tag afk">' + esc(T('afk')) + '</span>' : '') + '</li>').join('');
  $('hostBox').hidden = !host; $('startBtn').disabled = ps.filter(p => !isAfk(p.id)).length < 2;
  $('lobbyWait').textContent = r.spectator ? T('spectating') : host ? (ps.length < 2 ? T('needTwo') : '') : T('waitHost');
}
function showEnd(res, solo) {
  res = (res || []).slice(); const w = res[0];
  const tie = res[1] && w.a && res[1].a && w.l === res[1].l && w.e === res[1].e;
  let title = solo && res.length === 1 ? T('soloEnd', { l: w ? (w.l || w.w) : 0 }) : !w || tie ? T('draw') : T('winner', { n: w.n });
  $('endTitle').textContent = title;
  const order = [res[1], res[0], res[2]], hts = [110, 150, 80];
  $('podium').innerHTML = order.map((p, k) => p ? '<div class="pod"><span class="nm">' + esc(p.n) + '</span><span class="sc">' + esc(p.a ? T('rankLen', { l: p.l }) : T('rankDead', { w: p.w })) + '</span><div class="bar" style="height:' + hts[k] + 'px;background:' + U.COLORS[p.c % 8] + '">' + p.r + '</div></div>' : '').join('');
  $('rankList').innerHTML = res.slice(3).map(p => '<li><span>' + p.r + '.</span><span class="dot" style="background:' + U.COLORS[p.c % 8] + '"></span>' + esc(p.n) + '<b>' + esc(p.a ? T('rankLen', { l: p.l }) : T('rankDead', { w: p.w })) + '</b></li>').join('');
  const host = solo || (room && room.isHost());
  $('againBtn').hidden = !host; $('toLobbyBtn').hidden = solo || !host; $('endWait').textContent = host ? '' : T('waitAgain');
  if ($('end').hidden) { show('end'); if (solo && w && w.i === me) SFX.win(); }
}
async function exitToMenu(silent) {
  const r = room; room = null; mode = null; sim = null; wire = null; paused = false; spOn = false; show('home'); gmMeSync(); if (gm) setTimeout(gmLoad, 400);
  if (r && !silent) await r.leave(); else if (r && conn.forget) conn.forget();
}
function confirmExit() { if ((mode === 'solo' && sim && !sim.over) || (room && room.s.ph === 'play')) { if (!root.confirm(T('exitConfirm'))) return; } exitToMenu(false); }
function invite() {
  if (!room) return; const url = location.origin + location.pathname + '?room=' + room.code, done = () => toast(T('copied'), 'good');
  if (navigator.share && /Mobi|Android/i.test(navigator.userAgent)) navigator.share({ title: 'Duel Ular', text: 'Duel Ular · ' + room.code, url }).catch(() => {});
  else if (navigator.clipboard) navigator.clipboard.writeText(url).then(done, () => toast(url, '', 6000)); else toast(url, '', 6000);
}
/* ---------- #gamemaster: every lobby incl. private (server honours GET rooms?gm=gamemaster) ---------- */
let gm = false, gmRooms = null, gmErr = '', gmBusy = false, gmAt = 0, gmWakeT = 0;
const gmHash = () => (location.hash || '').toLowerCase().includes(N.GM_KEY);
function gmSync() {
  const on = gmHash(); if (on === gm) return; gm = on; gmRooms = null; gmErr = '';
  const box = $('gmRooms'); if (box) box.hidden = !gm; if (gm) gmLoad(); else renderGm();
}
/** (GM) tag follows the server: players[].gamemaster after a typed claim (POST rooms/{code}/gamemaster). The hash only shows the lobby list. */
function isGm(id) { return mode === 'online' && !!room && id != null && room.isGamemaster(id); }
/** legacy hash-era state.gm marks: dropped on start / back to lobby */
function gmPrune(s) { if (s && 'gm' in s) delete s.gm; }
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
  try { const d = await conn.rooms({ gm: true }); gmRooms = Array.isArray(d && d.rooms) ? d.rooms : []; gmErr = ''; }
  catch (e) { gmErr = errMsg(e); }
  finally { gmBusy = false; renderGm(); }
}
function gmWake() { if (!gm || room) return; clearTimeout(gmWakeT); gmWakeT = setTimeout(gmLoad, 1200); }
function renderGm() {
  const box = $('gmRooms'); if (!box) return; box.hidden = !gm; if (!gm) return;
  const age = r => { const t = Date.parse(r.updatedAt || ''); return Number.isFinite(t) ? Math.max(0, conn.serverNow() - t) : 1e9; };
  const list = (gmRooms || []).slice().sort((a, b) => (age(a) >= N.FRESH_MS) - (age(b) >= N.FRESH_MS)); // t302u: stale (ghost) rooms last, tagged
  $('gmNote').textContent = !conn.allowed ? T('onlineOff') : !onlineOk ? (conn.failed ? T('onlineDown') : T('gmLoading'))
    : gmErr ? T('gmErr', { msg: gmErr }) : gmRooms === null ? T('gmLoading') : list.length ? T('gmCount', { n: list.length }) : T('gmEmpty');
  $('gmRefresh').disabled = !onlineOk || gmBusy;
  $('gmList').innerHTML = list.map(r => {
    const code = esc(r.code), priv = r.visibility === 'private', playing = r.status === 'playing', st = age(r) >= N.FRESH_MS;
    return '<li data-code="' + code + '"' + (st ? ' class="stale"' : '') + '><b class="code">' + code + '</b><span class="gm-meta"><span class="badge' + (priv ? ' priv">' + esc(T('gmPrivate')) : '">' + esc(T('gmPublic'))) + '</span> <span class="badge st">' + esc(T(playing ? 'gmPlaying' : 'gmWaiting')) + '</span>' + (st ? ' <span class="badge stale">' + esc(T('gmStale', { m: Math.round(age(r) / 60000) })) + '</span>' : '') + '<br><small class="muted">'
      + esc(T('gmPlayers', { n: Number(r.seated) || 0, max: Number(r.maxPlayers) || 0, w: Number(r.spectators) || 0 })) + '</small></span><span class="gm-act">'
      + (playing ? '' : '<button type="button" class="btn green small online-btn" data-gm="join" data-code="' + code + '">' + esc(T('gmJoin')) + '</button>')
      + '<button type="button" class="btn ghost small online-btn" data-gm="watch" data-code="' + code + '">' + esc(T('gmWatch')) + '</button></span></li>';
  }).join('');
}
async function gmEnter(kind, code) {
  if (!/^[A-Z2-9]{6}$/.test(code || '')) return; $('codeInput').value = code;
  if (kind === 'join') return onlineAction('join');
  const name = myName(); if (!name) { toast(T('errName'), 'warn'); $('nameInput').focus(); return; }
  setLS(NAME_KEY, name); try { await enterOnline('watch', { displayName: name, code }); } catch (e) { toast(errMsg(e), 'warn', 4000); }
}
function onlineNote() { const n = $('onlineNote'); if (!n) return; const msg = !conn.allowed ? T('onlineOff') : (conn.failed ? T('onlineDown') : ''); n.textContent = msg; n.hidden = !msg; }

/* ---------- hero animation ---------- */
function hero() {
  // grid snakes on a 40x8 board (15 px cells): moves are only R / U / D one cell at a time, so the body is always a clean
  // manhattan polyline of squares (the old version sampled a sine wave per segment = staircase / diagonal look).
  const c = $('heroCv'), g = c.getContext('2d'), Q = 15, W = 13, L = 14, SPS = 6; // SPS = cells per second
  const mk = (row, pat, n0) => { const cells = []; let x = -L - 2, y = row, i = 0; while (x <= 40 + 2) { cells.push([x, y]); const m = pat[i++ % pat.length]; if (m === 'R') x++; else if (m === 'U') y--; else y++; } return { cells, n0 }; };
  const S = [['#5f9e57', mk(1, 'RRRRRRDDRRRRRUURRRR', 0)], ['#e07a5f', mk(4, 'RRRRUURRRRRRDDRRRRR', 19)], ['#4f8fb0', mk(6, 'RRRRRRRUURRRRDDRRR', 38)]];
  const loop = now => { if (!$('home').hidden) { const t = now / 1000; g.clearRect(0, 0, 600, 120);
    for (const [col, s] of S) { const N = s.cells.length - L - 1, st = t * SPS + s.n0, n = Math.floor(st) % N, f = st - Math.floor(st);
      const at = (k, fr) => { const a = s.cells[k], b = s.cells[k + 1]; return [(a[0] + (b[0] - a[0]) * fr + 0.5) * Q, (a[1] + (b[1] - a[1]) * fr + 0.5) * Q]; };
      const pts = [at(n + L - 1, f)]; for (let k = n + L - 1; k > n; k--) pts.push([(s.cells[k][0] + 0.5) * Q, (s.cells[k][1] + 0.5) * Q]); pts.push(at(n, f));
      g.globalAlpha = 0.14; g.fillStyle = '#5a4630'; barRects(g, pts, W, 0, 1.5); g.globalAlpha = 1; g.fillStyle = col; barRects(g, pts, W);
      const [hx, hy] = pts[0], h = W / 2; g.fillStyle = shade(col, 0.1); g.fillRect(hx - h, hy - h, W, W);
      if (s === S[0][1]) { g.fillStyle = shade(col, -0.45); headBorder(g, hx, hy, W, 2, backDir(pts, 1)); } // like in game: only "your" snake has the front + side outline
      const a = s.cells[n + L - 1], b = s.cells[n + L], dx = b[0] - a[0], dy = b[1] - a[1]; g.fillStyle = '#fffaf0';
      if (dx) { g.fillRect(hx + 0.5, hy - 4, 3, 3); g.fillRect(hx + 0.5, hy + 1, 3, 3); } else { const yy = dy < 0 ? hy - 3.5 : hy + 0.5; g.fillRect(hx - 4, yy, 3, 3); g.fillRect(hx + 1, yy, 3, 3); } }
    g.globalAlpha = 1; } root.requestAnimationFrame(loop); };
  root.requestAnimationFrame(loop);
}

/* ---------- boot ---------- */
let durPaint = () => {};
async function boot() {
  $('nameInput').value = getLS(NAME_KEY) || '';
  $('nameInput').addEventListener('change', () => setLS(NAME_KEY, myName()));
  seg('botSeg', saved.bots, v => { saved.bots = v; saveSet(); });
  seg('maxSeg', saved.mx, v => { saved.mx = v; saveSet(); });
  doc.querySelectorAll('.lb').forEach(b => b.addEventListener('click', () => { lang = b.dataset.lang; setLS(LANG_KEY, lang); applyLang(); }));
  const mute = () => { muted = !muted; setLS(MUTE_KEY, muted ? '1' : '0'); paintMute(); };
  $('muteBtn').addEventListener('click', mute); $('muteBtn2').addEventListener('click', mute);
  $('practiceBtn').addEventListener('click', () => { setLS(NAME_KEY, myName()); startSolo(); });
  $('createPub').addEventListener('click', () => onlineAction('public'));
  $('createPriv').addEventListener('click', () => onlineAction('private'));
  $('matchBtn').addEventListener('click', () => onlineAction('match'));
  $('joinForm').addEventListener('submit', e => { e.preventDefault(); onlineAction('join'); });
  $('codeInput').addEventListener('input', e => { e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''); });
  $('inviteBtn').addEventListener('click', invite); $('lobbyLeave').addEventListener('click', () => exitToMenu(false));
  $('startBtn').addEventListener('click', startOnline);
  $('exitBtn').addEventListener('click', confirmExit); $('pauseBtn').addEventListener('click', togglePause);
  $('againBtn').addEventListener('click', () => { if (mode === 'solo') startSolo(); else startOnline(); });
  $('toLobbyBtn').addEventListener('click', toLobby); $('endMenu').addEventListener('click', () => exitToMenu(false));
  root.addEventListener('resize', () => { if (!$('game').hidden) fitBoard(); }); if (root.visualViewport) root.visualViewport.addEventListener('resize', () => { if (!$('game').hidden) fitBoard(); });
  root.addEventListener('pagehide', () => { if (room) conn.leaveBeacon(); });
  ['pointerdown', 'keydown', 'touchstart', 'wheel'].forEach(t => doc.addEventListener(t, () => { lastInputAt = Date.now(); if (afkWarned) afkWarned = false; }, { capture: true, passive: true }));
  setInterval(presence, 1000);
  doc.addEventListener('visibilitychange', () => { if (doc.visibilityState === 'visible') { presence(); hiddenAt = 0; lastInputAt = Math.max(lastInputAt, Date.now() - IDLE_WARN_MS + 30000); if (afkMsg) { toast(afkMsg, 'warn', 7000); afkMsg = ''; } if (conn.config) conn.visible(); } else hiddenAt = Date.now();
    if (doc.visibilityState !== 'visible' && mode === 'solo' && sim && !sim.over && !paused) togglePause(); });
  setInterval(() => { if (room) room.tick(); }, 300);
  /* t300u freeze watchdog: realtime is socket-only (no polling while the socket says 'online'), so a half-dead socket or a lost
     wake froze the game until a reconnect. During play: guest reads when no snapshot came for 1.2 s, host reads when no socket
     frame came for 1.5 s (picks up guest turns from the action log). Max ~1 read / 900 ms, only while stalled. */
  setInterval(() => {
    if (!room || room.local || mode !== 'online' || !room.s || room.s.ph !== 'play' || doc.visibilityState !== 'visible') return; const n = performance.now();
    if (n - wdAt < 900) return;
    if (sim ? n - netSeen > 1500 : (!wireRx || n - wireRx > 1200)) { wdAt = n; dbg.wd = (dbg.wd || 0) + 1; room.refresh(); }
  }, 300);
  $('gmRefresh').addEventListener('click', gmLoad);
  $('gmList').addEventListener('click', e => { const b = e.target.closest('[data-gm]'); if (b) gmEnter(b.dataset.gm, b.dataset.code); });
  root.addEventListener('hashchange', gmSync); setInterval(() => { if (gm && !room && doc.visibilityState === 'visible' && Date.now() - gmAt > 10000) gmLoad(); }, 2000);
  gmSync(); gmUI = gmClaimUI({ listKey: N.GM_KEY, canClaim: () => mode === 'online' && !!room && !!room.data && !room.local && !room.isGamemaster(), claim: code => room.claimGamemaster(code), onDone: () => { toast('Mode gamemaster aktif', 'good'); gmMeSync(); renderRoom(); } }); applyLang(); hero(); raf = root.requestAnimationFrame(frame);
  if ((location.hash || '').toLowerCase() === '#latihan') startSolo();
  root.addEventListener('hashchange', () => { if ((location.hash || '').toLowerCase() === '#latihan' && !room) startSolo(); });
  doc.querySelectorAll('.online-btn').forEach(b => { b.disabled = true; });
  if (conn.allowed) { try { await conn.start(); onlineOk = true; } catch (e) { conn.failed = true; onlineOk = false; } }
  doc.querySelectorAll('.online-btn').forEach(b => { b.disabled = !onlineOk; }); onlineNote(); if (gm) gmLoad();
  if (conn.code && conn.token) { try { await conn.leave(); } catch (e) { conn.forget(); } }
  const JR = root.JRInvite, invCode = JR && JR.code ? JR.code('room') : '';
  if (invCode && JR.run) {
    JR.run({ code: invCode, lang, gameName: 'Duel Ular', nameKey: NAME_KEY, nameMax: 24, accent: '#5f9e57',
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
root.UNApp = { scene: () => (sim ? sceneFromSim(performance.now()) : wire ? sceneFromWire(performance.now()) : null), get gm() { return gm; }, gmLoad, setSprint, get sprint() { return spOn; }, dbg, get lagMs() { return lagMs; }, get wireGap() { return wireGap; }, get echoMs() { return echoMs; }, get sim() { return sim; }, get room() { return room; }, get wire() { return wire; }, get mode() { return mode; }, get me() { return me; }, steer, startSolo, conn };
})(window);

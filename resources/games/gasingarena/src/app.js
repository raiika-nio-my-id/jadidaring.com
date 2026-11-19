/* Gasing Arena UI: practice vs bots + host-authoritative online rooms on the JaRing /api/game platform */
(function () {
  'use strict';
  const N = window.GANet, G = window.GAGame, RD = window.GARender, doc = document, root = window;
  const cfg = JSON.parse(doc.getElementById('website-config').textContent);
  const $ = (s, r) => (r || doc).querySelector(s);
  const $$ = (s, r) => [...(r || doc).querySelectorAll(s)];
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const getLS = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const setLS = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* private mode */ } };
  const home = $('#home'), lobby = $('#lobby'), play = $('#play'), end = $('#end');
  const LS_NAME = 'gasingarena.name', LS_MUTE = 'gasingarena.mute', LS_LANG = 'gasingarena.lang';
  const T = {
    id: { tagline: cfg.site.tagline, lead: cfg.site.lead, kicker: 'Permainan rakyat · online', playFriends: 'Main bareng teman', name: 'Nama', practiceTitle: 'Latihan', practiceSub: 'Lawan bot di tampah yang sama. Cocok buat belajar tarik-lepas.', practiceGo: 'Main latihan', bots: 'Lawan bot', onlineTitle: 'Online', onlineSub: 'Buat room atau gabung pakai kode. 2–6 pemain.', createPub: 'Buat publik', createPriv: 'Buat privat', match: 'Cari room publik', join: 'Gabung', howTitle: 'Cara main', how1: 'Tarik ke belakang seperti ketapel untuk membidik arah, lepas, lalu tap tepat saat penanda di tengah: Perfect (paling tengah, susah!), Great, Good, atau Bad.', how2: 'Tabrak lawan sampai putarannya habis atau terlempar keluar tampah.', how3: 'Ambil power-up: ⚡ gas, 🛡️ perisai, 🪨 berat.', how4: 'Gasing terakhir yang masih berputar dapat 1 poin. Pertama yang capai target poin (3/5/7) juara!', goal: 'Pertama {n} poin', goalLong: 'Pertama kumpul {n} poin menang!', target: 'Target poin', ptsHost: 'dipilih host', terms: 'Syarat & Ketentuan', lobbyTitle: 'Lobby', addBots: 'Tambah bot', start: 'Mulai', leave: 'Keluar room', invite: 'Salin undangan', menu: 'Menu', again: 'Main lagi', toLobby: 'Ke lobby', send: 'Kirim', gmTitle: 'Semua lobby (GM)', waitingHost: 'Menunggu host memulai…', youHost: 'Kamu host — tekan Mulai kalau sudah siap.', soloHost: 'Sendirian? Tambah bot lalu Mulai, atau bagikan undangan.', tipAim: 'Tarik ke belakang untuk bidik arah, lalu lepas!', tipCharge: 'Tap pas penanda di tengah!', reaim: '↺ Bidik ulang', qPerfect: 'PERFECT!', qGreat: 'GREAT!', qGood: 'GOOD', qBad: 'BAD…', tipWait: 'Menunggu pemain lain melempar…', tipFight: 'Adu putaran! Ambil power-up ⚡🛡️🪨', tipSpect: 'Kamu menonton.', phaseAim: 'Bidik', phaseFight: 'Adu!', phaseRound: 'Ronde selesai', phaseMatch: 'Selesai', round: 'Ronde', winRound: 'menang ronde!', draw: 'Seri!', winMatch: 'juara tampah!', out: 'KELUAR!', fall: 'JATUH!', go: 'ADU!', ready: 'Siap… lempar!', you: 'Kamu', host: 'host', bot: 'bot', pub: 'Publik', priv: 'Privat', players: 'pemain', copied: 'Link undangan disalin', joinFail: 'Gagal gabung', noRooms: 'Belum ada room publik — dibuatkan baru.', createFail: 'Gagal membuat room', onlineOff: 'Mode online hanya tersedia di gasingarena.jadidaring.com.', onlineDown: 'Server online belum tersambung. Latihan tetap bisa dimainkan.', onlineWait: 'Menyambungkan server…', roomGone: 'Room sudah ditutup.', errCode: 'Kode room 6 huruf.', errNet: 'Koneksi bermasalah, coba lagi.', errBusy: 'Server sibuk, tunggu {s} detik.', errFull: 'Room penuh atau sedang main — kamu menonton.', waitEnd: 'Menunggu host memulai lagi…', hostTook: 'Kamu sekarang host.', pullMore: 'Tarik lebih jauh untuk melempar', gmJoin: 'Gabung', gmWatch: 'Tonton', gmEmpty: 'Belum ada room.', gmLoading: 'Memuat…' },
    en: { tagline: 'Pull, release, spin battle!', lead: 'Throw your spinning top into the tray with 2–6 players. Bump rivals until they wobble, fall or fly out. Power-ups, sparks, chat and bot practice.', kicker: 'Folk game · online', playFriends: 'Play with friends', name: 'Name', practiceTitle: 'Practice', practiceSub: 'Fight bots in the same tray.', practiceGo: 'Play practice', bots: 'Bots', onlineTitle: 'Online', onlineSub: 'Create a room or join with a code. 2–6 players.', createPub: 'Public room', createPriv: 'Private room', match: 'Find public room', join: 'Join', howTitle: 'How to play', how1: 'Pull back like a slingshot to aim, release, then tap when the marker hits the centre: Perfect (dead centre, hard!), Great, Good or Bad.', how2: 'Bump rivals until their spin runs out or they fly out of the tray.', how3: 'Power-ups: ⚡ boost, 🛡️ shield, 🪨 heavy.', how4: 'The last top still spinning scores 1 point. First to the target (3/5/7 points) is champion!', goal: 'First to {n}', goalLong: 'First to {n} points wins!', target: 'Points to win', ptsHost: 'host picks', terms: 'Terms', lobbyTitle: 'Lobby', addBots: 'Add bots', start: 'Start', leave: 'Leave room', invite: 'Copy invite', menu: 'Menu', again: 'Play again', toLobby: 'To lobby', send: 'Send', gmTitle: 'All lobbies (GM)', waitingHost: 'Waiting for the host…', youHost: 'You are host — press Start when ready.', soloHost: 'Alone? Add bots and Start, or share the invite.', tipAim: 'Pull back to aim, then release!', tipCharge: 'Tap when the marker hits the centre!', reaim: '↺ Re-aim', qPerfect: 'PERFECT!', qGreat: 'GREAT!', qGood: 'GOOD', qBad: 'BAD…', tipWait: 'Waiting for others to throw…', tipFight: 'Spin battle! Grab power-ups ⚡🛡️🪨', tipSpect: 'You are watching.', phaseAim: 'Aim', phaseFight: 'Battle!', phaseRound: 'Round over', phaseMatch: 'Over', round: 'Round', winRound: 'wins the round!', draw: 'Draw!', winMatch: 'is the champion!', out: 'OUT!', fall: 'FELL!', go: 'FIGHT!', ready: 'Ready… throw!', you: 'You', host: 'host', bot: 'bot', pub: 'Public', priv: 'Private', players: 'players', copied: 'Invite link copied', joinFail: 'Could not join', noRooms: 'No public room yet — made a new one.', createFail: 'Could not create room', onlineOff: 'Online play only works on gasingarena.jadidaring.com.', onlineDown: 'Online server not connected. Practice still works.', onlineWait: 'Connecting…', roomGone: 'The room was closed.', errCode: 'Room code is 6 letters.', errNet: 'Connection problem, try again.', errBusy: 'Server busy, wait {s} s.', errFull: 'Room full or playing — you are watching.', waitEnd: 'Waiting for the host…', hostTook: 'You are now the host.', pullMore: 'Pull further to throw', gmJoin: 'Join', gmWatch: 'Watch', gmEmpty: 'No rooms.', gmLoading: 'Loading…' }
  };
  let lang = getLS(LS_LANG) === 'en' ? 'en' : 'id';
  const t = (k, v) => { let s = (T[lang] && T[lang][k]) || T.id[k] || k; if (v) for (const x in v) s = s.replace('{' + x + '}', v[x]); return s; };
  function applyLang() {
    $$('[data-t]').forEach(el => { el.textContent = t(el.getAttribute('data-t')); });
    $$('[data-c]').forEach(el => { const k = el.getAttribute('data-c'); el.textContent = (cfg.site && cfg.site[k]) || ''; });
    $$('.lb').forEach(b => b.classList.toggle('on', b.getAttribute('data-lang') === lang));
    doc.documentElement.lang = lang; onlineNote(); if (room) renderLobby();
  }

  /* ---------- sound (WebAudio, no files) ---------- */
  let mute = getLS(LS_MUTE) === '1', ac = null;
  function ensureAudio() { if (!ac) { try { ac = new (root.AudioContext || root.webkitAudioContext)(); } catch (e) { ac = null; } } if (ac && ac.state === 'suspended') ac.resume().catch(() => {}); return ac; }
  function tone(freq, dur, type, vol, slide) {
    if (mute) return; const a = ensureAudio(); if (!a) return; const now = a.currentTime;
    const o = a.createOscillator(), g = a.createGain(); o.type = type || 'sine'; o.frequency.setValueAtTime(freq, now);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, slide), now + dur);
    g.gain.setValueAtTime(vol || 0.06, now); g.gain.exponentialRampToValueAtTime(0.0008, now + dur);
    o.connect(g); g.connect(a.destination); o.start(now); o.stop(now + dur + 0.03);
  }
  function noise(dur, vol, hp) {
    if (mute) return; const a = ensureAudio(); if (!a) return; const n = Math.max(1, Math.floor(a.sampleRate * dur)), b = a.createBuffer(1, n, a.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const s = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain(); s.buffer = b; f.type = 'highpass'; f.frequency.value = hp || 1200; g.gain.value = vol || 0.08;
    s.connect(f); f.connect(g); g.connect(a.destination); s.start();
  }
  const SFX = {
    throw: p => { noise(0.25, 0.07, 600); tone(240 + p * 260, 0.22, 'triangle', 0.05, 520 + p * 300); },
    perfect: () => { noise(0.35, 0.09, 400); [523, 784, 1046, 1568].forEach((f, i) => setTimeout(() => tone(f, 0.22, 'triangle', 0.055), i * 55)); tone(180, 0.5, 'sawtooth', 0.03, 900); },
    great: () => { noise(0.22, 0.07, 700); tone(440, 0.16, 'triangle', 0.05, 660); setTimeout(() => tone(660, 0.14, 'triangle', 0.045), 70); },
    good: () => { noise(0.18, 0.06, 600); tone(392, 0.14, 'triangle', 0.04, 440); },
    bad: () => { noise(0.18, 0.05, 300); tone(300, 0.38, 'sawtooth', 0.035, 110); },
    tick: () => tone(1200, 0.02, 'square', 0.012),
    hit: () => { noise(0.06, 0.12, 2500); tone(900 + Math.random() * 300, 0.05, 'square', 0.025); },
    out: () => { tone(520, 0.4, 'sawtooth', 0.04, 90); },
    fight: () => { tone(392, 0.09, 'square', 0.04); setTimeout(() => tone(523, 0.14, 'square', 0.04), 90); },
    win: () => { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => tone(f, 0.18, 'triangle', 0.06), i * 110)); },
    chat: () => tone(880, 0.05, 'sine', 0.03), click: () => tone(660, 0.04, 'triangle', 0.03)
  };
  function syncMute() { const label = mute ? '🔇' : '🔊'; $('#muteBtn').textContent = label; $('#mutePlay').textContent = label; }
  function toast(msg, kind, ms) { const d = doc.createElement('div'); d.className = 'toast' + (kind ? ' ' + kind : ''); d.textContent = msg; $('#toasts').appendChild(d); setTimeout(() => d.remove(), ms || 2600); }

  /* ---------- state ---------- */
  let mode = null; // null | 'solo' | 'online'
  let match = null, localId = null, botsN = 1, room = null, onlineOk = false, hostG = null, clientG = null, seenV = 0, endSent = false, starting = false, wasHost = null;
  let aim = null, dragging = false, dragStart = null, charge = null, pendThrow = null, hostDirty = false, hostCm = [], lastTick = 0, tickBusy = false, roundTimer = 0, endTimer = 0;
  const myName = () => $('#nameInput').value.replace(/\s+/g, ' ').trim().slice(0, 24);
  function nick() { let n = myName(); if (!n) { n = 'Pemain' + (10 + Math.floor(Math.random() * 90)); $('#nameInput').value = n; } setLS(LS_NAME, n); return n; }
  $('#nameInput').value = getLS(LS_NAME) || '';
  $('#nameInput').addEventListener('change', () => setLS(LS_NAME, myName()));
  let ptsN = 3; const PTS = [3, 5, 7], pts = v => PTS.indexOf(v | 0) >= 0 ? v | 0 : 3;
  $$('#ptsSeg button').forEach(b => b.addEventListener('click', () => { $$('#ptsSeg button').forEach(x => x.classList.remove('on')); b.classList.add('on'); ptsN = pts(+b.dataset.v); SFX.click(); }));
  $$('#botSeg button').forEach(b => b.addEventListener('click', () => { $$('#botSeg button').forEach(x => x.classList.remove('on')); b.classList.add('on'); botsN = +b.dataset.v; SFX.click(); }));
  $$('.lb').forEach(b => b.addEventListener('click', () => { lang = b.dataset.lang; setLS(LS_LANG, lang); applyLang(); }));
  $('#muteBtn').onclick = $('#mutePlay').onclick = () => { mute = !mute; setLS(LS_MUTE, mute ? '1' : '0'); syncMute(); ensureAudio(); };

  function show(screen) {
    [home, lobby, play, end].forEach(s => { s.hidden = s !== screen; });
    doc.documentElement.classList.toggle('jr-hub-off', screen === play);
    const chat = $('#chat');
    if (screen === lobby) { $('#lobbyChatSlot').appendChild(chat); chat.classList.add('docked'); }
    else if (screen === end && mode === 'online') { $('#endChatSlot').appendChild(chat); chat.classList.add('docked'); }
    else { doc.body.appendChild(chat); chat.classList.remove('docked', 'on'); }
    $('#endChatSlot').hidden = mode !== 'online'; $('#chatToggle').hidden = mode !== 'online';
    if (screen === play) { arenaR.fit(); }
    root.scrollTo(0, 0);
  }

  /* ---------- renderers ---------- */
  const arenaR = RD.Renderer($('#arena'));
  const heroR = RD.Renderer($('#heroCv'), { layout: (w, h) => { if (w > 700) { const R = Math.min(w * 0.27, h / 1.55); return { R, cx: w * 0.7, cy: h * 0.5 + R * 0.1 }; } const R = Math.min(w * 0.42, h * 0.5); return { R, cx: w / 2, cy: h - R * 0.75 }; } });
  (function logo() { const c = $('#logoCv'), g = c.getContext('2d'), d = Math.min(2, root.devicePixelRatio || 1); c.width = 44 * d; c.height = 44 * d; g.scale(d, d); RD.drawGasing(g, 22, 40, 14, { color: '#c8432b', design: 0, spin: 0, angle: 0.6, thrown: false }, 0); })();
  let demo = null, demoWait = 0;
  function newDemo() { demo = G.createMatch({ seed: (Math.random() * 1e9) | 0, players: ['Ucok', 'Siti', 'Budi', 'Ayu'].map((n, i) => ({ id: 'd' + i, name: n, bot: true })), rounds: 99 }); G.resetRound(demo); demo.tops.forEach(x => { x.botAt = 20 + Math.random() * 60; }); }
  function stepDemo() {
    if (!demo) newDemo();
    if (demo.phase === 'roundend' || demo.phase === 'matchend') { if (++demoWait > 90) { demoWait = 0; newDemo(); } return; }
    G.step(demo, 1 / 60);
  }

  /* ---------- effects: diff the shown match frame to frame ---------- */
  let seen = null, lastHitFx = 0;
  function fxDiff(m, R, quiet) {
    if (!m) { seen = null; return; }
    const key = m.round + ':' + m.phase;
    if (!seen) { seen = { key, hits: m.hits, alive: {}, thrown: {} }; for (const top of m.tops) seen.thrown[top.id] = top.thrown; }
    for (const top of m.tops) {
      if (top.thrown && seen.thrown[top.id] === false && !quiet) throwFx(top, R);
      seen.thrown[top.id] = top.thrown;
      const was = seen.alive[top.id];
      if (was === true && !top.alive && !quiet) {
        const [x, y] = R.P(top.x, top.y); R.float(x, y - 50, top.out === 'fall' ? t('fall') : t('out'), top.out === 'fall' ? '#ffd23f' : '#ff6b4a'); R.burst(x, y - 30, 18, top.color); R.shake(top.out === 'ring' ? 12 : 5); SFX.out();
      }
      seen.alive[top.id] = top.alive;
    }
    if (m.hits > seen.hits && !quiet) { const n = performance.now(); if (n - lastHitFx > 70) { lastHitFx = n; SFX.hit(); R.shake(3); } }
    seen.hits = m.hits;
    if (key !== seen.key) {
      const prev = seen.key; seen.key = key;
      if (!quiet) {
        if (m.phase === 'fight') { banner(t('go')); SFX.fight(); }
        else if (m.phase === 'aim' && prev && m.round > 1) banner(t('round') + ' ' + m.round, t('ready'));
        else if (m.phase === 'roundend' || m.phase === 'matchend') { const w = m.tops.find(x => x.id === m.winnerId); banner(w ? w.name : t('draw'), w ? t('winRound') : ''); if (w && w.id === localId) SFX.win(); else SFX.out(); }
      }
    }
  }
  // throw animation by pull quality: Perfect = flashy, Great = solid, Good = plain, Bad = awkward
  function throwFx(top, R) {
    const mine = top.id === localId, q = top.tq, [x, y] = R.P(top.x, top.y), s = R.layout.R * 0.1;
    if (q === 3) {
      R.float(x, y - s * 3.4, t('qPerfect'), '#ffd23f', mine ? 1.8 : 1.15); R.ring(x, y, '#ffd23f', mine ? 1.7 : 1); R.ring(x, y, '#fff3b0', mine ? 1.2 : 0.7, 0.15); if (mine) R.ring(x, y, '#b8ff7a', 2.1, 0.3);
      R.burst(x, y - s, mine ? 50 : 18, '#ffd23f'); R.burst(x, y - s, mine ? 24 : 8, '#ff7a3c');
      if (mine) { R.flash('255,214,90'); R.shake(10); SFX.perfect(); } else SFX.great();
    } else if (q === 2) {
      R.float(x, y - s * 3.4, t('qGreat'), '#fff1a8', mine ? 1.35 : 0.95); R.ring(x, y, '#ffe27a', mine ? 1.1 : 0.7);
      R.burst(x, y - s, mine ? 22 : 10, '#ffe9a8'); if (mine) { R.shake(4); SFX.great(); } else SFX.throw(0.7);
    } else if (q === 1) {
      R.float(x, y - s * 3.2, t('qGood'), '#ffffff', mine ? 1.1 : 0.8); R.ring(x, y, 'rgba(255,255,255,.7)', mine ? 0.7 : 0.5);
      R.burst(x, y - s, mine ? 8 : 4, '#f3e6c8'); if (mine) { R.shake(1.5); SFX.good(); } else SFX.throw(0.5);
    } else if (q === 0) {
      R.float(x, y - s * 3.0, t('qBad'), '#c9c3b6', mine ? 1.15 : 0.85, true); R.dust(x, y, mine ? 18 : 9);
      if (mine) { R.shake(2); SFX.bad(); } else SFX.throw(0.3);
    } else SFX.throw(0.6);
    if (mine) meterFlash(q);
  }
  let bannerT = 0;
  function banner(big, small) { const b = $('#banner'); b.innerHTML = esc(big) + (small ? '<small>' + esc(small) + '</small>' : ''); b.hidden = false; b.style.animation = 'none'; void b.offsetWidth; b.style.animation = ''; clearTimeout(bannerT); bannerT = setTimeout(() => { b.hidden = true; }, 1700); }

  let hudKey = '';
  function updateHud(m) {
    if (!m) return;
    $('#roundLbl').textContent = t('round') + ' ' + m.round + ' · ' + t('goal').replace('{n}', m.target);
    const me = m.tops.find(x => x.id === localId);
    $('#phaseLbl').textContent = { aim: t('phaseAim'), fight: t('phaseFight'), roundend: t('phaseRound'), matchend: t('phaseMatch') }[m.phase] || '';
    const k = m.tops.map(x => x.id + (x.alive ? 1 : 0) + x.wins).join('|') + m.target + lang;
    if (k !== hudKey) {
      hudKey = k; const need = m.target;
      $('#scoreRow').innerHTML = m.tops.map(x => '<span class="sc' + (x.id === localId ? ' me' : '') + (!x.alive && x.thrown ? ' out' : '') + '"><span class="dot" style="background:' + esc(x.color) + '"></span>' + esc(x.name.slice(0, 12)) + ' <span class="pips">' + '●'.repeat(Math.min(need, x.wins)) + '○'.repeat(Math.max(0, need - x.wins)) + '</span></span>').join('');
    }
    const tip = $('#tip'); let msg = '';
    if (m.phase === 'aim') { const left = Math.max(0, Math.ceil((G.AIM_LIMIT - m.tick) / 60)); msg = !me ? t('tipSpect') : me.thrown ? t('tipWait') : charge ? '' : t('tipAim') + (left <= 10 ? ' (' + left + ')' : ''); }
    else if (m.phase === 'fight' && m.tick < 150) msg = t('tipFight');
    if (!meterEl.hidden) msg = '';
    tip.hidden = !msg; if (msg) tip.textContent = msg;
  }

  /* ---------- input: slingshot drag = direction, timing meter = power ---------- */
  // 1) drag back from anywhere (slingshot) to aim; drag length does NOT matter
  // 2) release locks the aim and starts the meter; 3) tap/click/Space when the marker is in the centre
  const arena = $('#arena'), wrap = $('#arenaWrap'), meterEl = $('#pullMeter'), markEl = $('#pmMark'), pmLbl = $('#pmLabel');
  const MIN_DRAG = 12; // px before a drag counts as an aim (else a tap aims at the centre)
  function myTop() { return match && localId != null ? match.tops.find(q => q.id === localId) : null; }
  function canAim() { const me = myTop(); return !!(match && match.phase === 'aim' && me && me.alive && !me.thrown && !pendThrow); }
  function pos(ev) { const r = arena.getBoundingClientRect(); return { x: ev.clientX - r.left, y: ev.clientY - r.top }; }
  function aimFrom(p) {
    const L = arenaR.layout, ddx = dragStart.x - p.x, ddy = dragStart.y - p.y, px = Math.hypot(ddx, ddy);
    if (px < MIN_DRAG) return null;
    // screen pull vector -> world direction (undo the tray tilt + the bottom-seat camera rotation)
    const [dx, dy] = arenaR.toWorldDir(ddx / L.R, ddy / (L.R * RD.TILT));
    return { dx, dy, power: 0.7 };
  }
  function defaultAim() { const me = myTop(); return me ? { dx: me.ax, dy: me.ay, power: 0.7 } : null; }
  function startCharge(a) {
    if (!canAim() || !a) return; charge = { dx: a.dx, dy: a.dy, t0: performance.now(), last: -1 };
    meterEl.hidden = false; meterEl.className = 'pull-meter'; pmLbl.textContent = t('tipCharge'); $('#tip').hidden = true;
  }
  function stopCharge() { charge = null; if (!meterEl.classList.contains('fx')) meterEl.hidden = true; }
  function meterNow(now) { return charge ? G.meterPos(((now || performance.now()) - charge.t0) / 1000) : 0; }
  function fire(now) {
    if (!charge) return; if (!canAim()) { stopCharge(); return; }
    const p = meterNow(now), q = G.judge(p), c = charge; charge = null; markEl.style.left = (p * 100) + '%';
    meterEl.classList.add('fx', 'q' + q); pmLbl.textContent = [t('qBad'), t('qGood'), t('qGreat'), t('qPerfect')][q];
    doThrow(c.dx, c.dy, q);
  }
  let meterT = 0;
  function meterFlash() { clearTimeout(meterT); meterT = setTimeout(() => { meterEl.hidden = true; meterEl.className = 'pull-meter'; }, 900); }
  wrap.addEventListener('pointerdown', ev => {
    if (ev.target.closest && ev.target.closest('#pmReaim')) return;
    if (charge) { const now = performance.now(); fire(now); ensureAudio(); ev.preventDefault(); return; }
    if (ev.target !== arena || !canAim()) return; ensureAudio(); dragging = true; dragStart = pos(ev); aim = null;
    try { arena.setPointerCapture(ev.pointerId); } catch (e) { /* ignore */ } ev.preventDefault();
  });
  arena.addEventListener('pointermove', ev => { if (!dragging) return; aim = aimFrom(pos(ev)); ev.preventDefault(); });
  const release = ev => {
    if (!dragging) return; dragging = false; const a = (ev && ev.type === 'pointerup' ? aimFrom(pos(ev)) : aim) || aim; aim = null;
    if (!canAim()) return; startCharge(a || defaultAim());
  };
  arena.addEventListener('pointerup', release); arena.addEventListener('pointercancel', () => { dragging = false; aim = null; });
  $('#pmReaim').addEventListener('click', ev => { ev.stopPropagation(); stopCharge(); meterEl.hidden = true; SFX.click(); });
  doc.addEventListener('keydown', ev => {
    if (play.hidden || ev.target.tagName === 'INPUT') return;
    if (ev.code === 'Space' || ev.code === 'Enter') { ev.preventDefault(); if (ev.repeat) return; if (charge) fire(performance.now()); else if (canAim()) startCharge(defaultAim()); }
    else if (ev.code === 'Escape' && charge) stopCharge();
  });
  function doThrow(dx, dy, q) {
    if (!canAim()) return; q = q === 0 || q === 1 || q === 2 || q === 3 ? q : 1;
    if (mode === 'solo' || (room && room.isHost())) { G.throwTop(match, localId, dx, dy, 0, q); hostDirty = true; if (mode === 'online') sendTick(true); }
    else if (mode === 'online' && room) { if (!G.throwTop(match, localId, dx, dy, 0, q)) return; const me = match.tops.find(z => z.id === localId); pendThrow = { g: clientG, r: match.round, at: Date.now(), d: [+me.ax.toFixed(4), +me.ay.toFixed(4), G.QUALITY[q].power, q, 1] }; sendIn(); }
  }

  /* ---------- main loop ---------- */
  let lastFrame = performance.now(), acc = 0;
  function frame(now) {
    root.requestAnimationFrame(frame);
    const dt = Math.min(0.25, (now - lastFrame) / 1000); lastFrame = now;
    if (!home.hidden) { stepDemo(); heroR.draw(demo, {}); }
    if (play.hidden || !match) return;
    const authority = mode === 'solo' || (room && room.isHost());
    acc += dt; let n = 0;
    while (acc >= 1 / 60 && n++ < 15) { acc -= 1 / 60; const prev = match.phase; G.step(match, 1 / 60); if (authority && match.phase !== prev) onPhase(prev); }
    if (acc > 0.5) acc = 0;
    const smooth = mode === 'online' && !authority;
    if (smooth) { const k = Math.exp(-dt * 9); for (const z of match.tops) { if (!z.ex && !z.ey) continue; z.ex *= k; z.ey *= k; if (Math.abs(z.ex) + Math.abs(z.ey) < 1e-4) z.ex = z.ey = 0; z.x += z.ex; z.y += z.ey; } }
    fxDiff(match, arenaR, false);
    if (charge && !canAim()) stopCharge();
    if (charge) { const p = meterNow(now); markEl.style.left = (p * 100) + '%'; const z = G.judge(p); meterEl.classList.toggle('hot', z === 3); meterEl.classList.toggle('warm', z === 2); meterEl.classList.toggle('mild', z === 1); }
    arenaR.draw(match, { localId, aim: dragging ? aim : charge ? { dx: charge.dx, dy: charge.dy, power: 0.7, locked: true } : null });
    if (smooth) for (const z of match.tops) if (z.ex || z.ey) { z.x -= z.ex; z.y -= z.ey; }
    updateHud(match);
  }
  function onPhase(prev) {
    hostDirty = true; if (mode === 'online') sendTick(true);
    if (match.phase === 'roundend') { clearTimeout(roundTimer); roundTimer = setTimeout(() => { if (match && match.phase === 'roundend') { G.nextRound(match); seen && (seen.key = ''); if (mode === 'online') sendTick(true); } }, 2300); }
    if (match.phase === 'matchend') { clearTimeout(endTimer); endTimer = setTimeout(() => { if (mode === 'solo') showEnd(results(match)); else sendEnd(); }, 2000); }
  }
  function results(m) { return m.tops.map(x => ({ id: x.id, n: x.name, c: x.color, w: x.wins | 0, b: !!x.bot, d: x.design | 0 })).sort((a, b) => b.w - a.w); }

  /* ---------- practice ---------- */
  function startPractice() {
    stopOnline(); mode = 'solo'; const name = nick(); localId = 'p0';
    const players = [{ id: localId, name, bot: false }];
    const botNames = ['Ucok', 'Siti', 'Budi', 'Ayu', 'Joko'];
    for (let i = 0; i < botsN; i++) players.push({ id: 'b' + i, name: botNames[i] + ' 🤖', bot: true });
    match = G.createMatch({ seed: (Math.random() * 1e9) | 0, players, target: ptsN });
    G.resetRound(match); seen = null; hudKey = ''; acc = 0; clearTimers(); stopCharge();
    show(play); banner(t('round') + ' 1', t('goalLong').replace('{n}', match.target)); SFX.click();
  }
  function clearTimers() { clearTimeout(roundTimer); clearTimeout(endTimer); }
  $('#practiceBtn').onclick = startPractice; $('#heroPlay').onclick = startPractice;

  function showEnd(res, waiting) {
    clearTimers(); show(end); res = res || [];
    const w = res[0] && res[0].w > 0 && (!res[1] || res[1].w < res[0].w) ? res[0] : null;
    $('#endKicker').textContent = t('phaseMatch');
    $('#endTitle').textContent = w ? (w.id === localId ? t('you') + ' ' : w.n + ' ') + t('winMatch') : t('draw');
    $('#endCrew').innerHTML = res.map(x => '<li class="' + (x.id === localId ? 'me' : '') + '"><span><span class="dot" style="background:' + esc(x.c) + '"></span>' + esc(x.n) + (x.id === localId ? ' <span class="tag">' + esc(t('you')) + '</span>' : '') + '</span><strong>' + (x.w | 0) + ' 🏆</strong></li>').join('');
    const c = $('#endCv'), g = c.getContext('2d'), d = Math.min(2, root.devicePixelRatio || 1); c.width = 160 * d; c.height = 150 * d; g.setTransform(d, 0, 0, d, 0, 0); g.clearRect(0, 0, 160, 150);
    g.font = '42px system-ui'; g.textAlign = 'center'; g.fillText('👑', 80, 40);
    RD.drawGasing(g, 80, 140, 34, { color: (w || res[0] || {}).c || '#c8432b', design: (w || res[0] || {}).d || 0, spin: 0, angle: 0.8 }, 0);
    const host = mode !== 'online' || (room && room.isHost());
    $('#againBtn').hidden = !host; $('#toLobbyBtn').hidden = mode !== 'online' || !host;
    $('#endWait').textContent = host ? '' : t('waitEnd');
    if (w && (w.id === localId)) SFX.win();
  }

  /* ---------- online ---------- */
  let ss = null; try { ss = root.sessionStorage; } catch (e) { ss = null; }
  const conn = new N.Connection({ storage: ss, onWake: () => { if (room) { if (!wakeAt) wakeAt = performance.now(); room.refresh(); } }, onSocket: () => {}, lobbyWake: () => gmWake() });
  let wakeAt = 0, ageEma = 250, pushHalf = 60; // guest: when the wake for the next read arrived; smoothed snapshot age (ms); host: half of the last tick write RTT
  setInterval(() => { if (room && room.tick) room.tick(); }, 300); // HTTP poll only while the websocket is down
  function bucket(cap, perSec) { let tokens = cap, at = Date.now(); return { take() { const n = Date.now(); tokens = Math.min(cap, tokens + (n - at) / 1000 * perSec); at = n; if (tokens >= 1) { tokens -= 1; return true; } return false; } }; }
  const hostBudget = bucket(4, 1.8), inBudget = bucket(4, 1.5);
  function errMsg(e) { if (!e) return t('errNet'); if (e.code === 'busy') return t('errBusy', { s: e.wait || 10 }); if (e.code === 'network' || e.code === 'offline') return t('errNet'); if (e.status === 404 || e.status === 422) return t('joinFail'); return (e.server || e.message || t('errNet')); }
  function onlineNote() { const n = $('#onlineNote'); const msg = !conn.allowed ? t('onlineOff') : conn.failed ? t('onlineDown') : !onlineOk ? t('onlineWait') : ''; n.textContent = msg; n.hidden = !msg; $$('.online-btn').forEach(b => { b.disabled = !onlineOk; }); }
  function stopOnline() { if (room) { const r = room; room = null; r.leave(); } hostG = null; clientG = null; pendThrow = null; resetChat(); }
  async function enterOnline(kind, opts) {
    stopOnline(); clearTimers(); mode = 'online'; match = null; endSent = false; wasHost = null;
    const r = new N.Room(conn, { onChange: onRoom }); room = r;
    try { await r.enter(kind, Object.assign({ set: { bots: 0, pts: 3 }, maxPlayers: (cfg.game && cfg.game.maxPlayers) || 6 }, opts)); }
    catch (e) { if (room === r) { room = null; mode = null; } throw e; }
    if (room === r) { onRoom(r, r.data); addChatLine({ k: 'sys' + Date.now(), t: 'sys', x: '👋 ' + opts.displayName }); }
    return r;
  }
  async function onlineAction(kind) {
    const name = nick(), code = $('#codeInput').value.trim().toUpperCase();
    if (kind === 'join' && !/^[A-Z2-9]{6}$/.test(code)) { toast(t('errCode'), 'bad'); return; }
    $$('.online-btn').forEach(b => { b.disabled = true; });
    try { await enterOnline(kind, { displayName: name, code }); }
    catch (e) {
      if (kind === 'join' && e.status === 409) { try { await enterOnline('watch', { displayName: name, code }); toast(t('errFull'), '', 4000); } catch (e2) { toast(errMsg(e2), 'bad', 4000); } }
      else toast((kind === 'join' ? t('joinFail') : t('createFail')) + ': ' + errMsg(e), 'bad', 4000);
    } finally { $$('.online-btn').forEach(b => { b.disabled = !onlineOk; }); }
  }
  $('#createPub').onclick = () => onlineAction('public');
  $('#createPriv').onclick = () => onlineAction('private');
  $('#matchBtn').onclick = () => onlineAction('match');
  $('#joinForm').onsubmit = ev => { ev.preventDefault(); onlineAction('join'); };
  $('#codeInput').addEventListener('input', e => { e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''); });

  function onRoom(r, data) {
    if (r !== room) return;
    if (!data) { toast(t('roomGone'), 'bad'); exitToMenu(); return; }
    const s = r.s, host = r.isHost(); localId = r.spectator ? null : r.me;
    doc.body.classList.toggle('gm-on', r.isGamemaster());
    if (s.ph === 'play' && s.s) {
      if (host) {
        if (hostG !== s.g && !starting) { match = G.restore(s.s); hostG = s.g; seenV = data.version; endSent = false; hostCm = s.cm.slice(-30); seen = null; if (wasHost === false) toast(t('hostTook'), 'good'); if (match && (match.phase === 'roundend' || match.phase === 'matchend')) onPhase(); }
        takeInputs(data.events); pruneLeft();
      } else clientSnap(s);
      if (play.hidden) { hudKey = ''; acc = 0; show(play); }
    } else if (s.ph === 'end') { if (!(host && starting)) { match = null; hostG = null; if (end.hidden) showEnd(s.res); } }
    else { match = null; hostG = null; clientG = null; renderLobby(); if (lobby.hidden) show(lobby); }
    if (!(host && s.ph === 'play')) syncChat(s.cm);
    wakeAt = 0; wasHost = host; if (gmUI) gmUI.sync();
  }
  /* Guest view. The host writes a snapshot every ~0.3-0.5 s (platform write limit) and it is already ~0.1-0.5 s old when it
     lands here. Old behaviour: restore it as-is -> every snapshot yanked the tops BACK in time (the "lag" guests saw).
     Now: (1) estimate the snapshot age (host write half-RTT + wake->read here), (2) fast-forward the restored match to the
     host's "now" with the same physics (guest sim never spawns power-ups / ends rounds / throws for bots), (3) hide the
     remaining correction with a decaying per-top offset, (4) keep a predicted fight running if the snapshot still predates
     my own throw. */
  function clientSnap(s) {
    const snap = s.s; if (!snap) return;
    const wire = s.g + ':' + snap.round + ':' + snap.phase + ':' + snap.tick + ':' + snap.hits;
    if (clientG === s.g && wire === clientSnap.last) return; clientSnap.last = wire;
    if (clientG !== s.g) { clientG = s.g; pendThrow = null; seen = null; }
    const nowP = performance.now();
    let age = wakeAt ? (nowP - wakeAt) + (+snap.lt || 60) + 30 : ageEma;
    age = Math.max(0, Math.min(700, age)); ageEma = ageEma * 0.7 + age * 0.3;
    const sm = snap.tops.find(q => q.id === localId);
    if (pendThrow && match && pendThrow.g === s.g && pendThrow.r === snap.round && snap.phase === 'aim' && sm && sm.alive && !sm.thrown && match.round === snap.round && match.phase === 'fight' && Date.now() - (pendThrow.at || 0) < 3000) return; // my throw has not reached the host yet: keep the predicted fight
    const m = G.restore(snap); if (!m) return; m.client = true;
    if (pendThrow) {
      const me = m.tops.find(q => q.id === localId);
      if (!me || pendThrow.r !== m.round || m.phase !== 'aim' || me.thrown) pendThrow = pendThrow.r === m.round && m.phase === 'aim' && me && !me.thrown ? pendThrow : null;
      if (pendThrow && me && !me.thrown) G.throwTop(m, localId, pendThrow.d[0], pendThrow.d[1], pendThrow.d[2], pendThrow.d[3], pendThrow.d[4] === 1);
    }
    if (m.phase === 'fight' || m.phase === 'aim') { const n = Math.round(age / (1000 / 60)); for (let i = 0; i < n && m.phase !== 'roundend'; i++) G.step(m, 1 / 60); }
    // visual continuity: where each top is drawn now vs where the corrected sim puts it
    if (match && match.round === m.round) {
      for (const z of m.tops) {
        const o = match.tops.find(q => q.id === z.id); z.ex = 0; z.ey = 0; if (!o) continue;
        if (o.alive && z.alive && o.thrown === z.thrown) { const dx = o.x + (o.ex || 0) - z.x, dy = o.y + (o.ey || 0) - z.y; if (Math.hypot(dx, dy) < 0.6) { z.ex = dx; z.ey = dy; } z.angle = o.angle; }
      }
    }
    // keep local sparks for continuity
    if (match && match.sparks) m.sparks = match.sparks;
    match = m;
  }
  function takeInputs(events) {
    if (!match) return;
    for (const e of events || []) {
      if (!(e.version > seenV)) continue; seenV = e.version;
      if (e.type !== 'in' || !e.payload || e.payload.g !== hostG) continue;
      const p = e.payload;
      if (Array.isArray(p.th) && p.th.length >= 3 && p.th.length <= 5 && (p.r | 0) === match.round && match.phase === 'aim') { const q = p.th.length >= 4 ? [0, 1, 2, 3].indexOf(p.th[3]) : -1; if (G.throwTop(match, e.playerId, +p.th[0], +p.th[1], +p.th[2], q >= 0 ? q : undefined, p.th[4] === 1)) hostDirty = true; }
      if (p.m && typeof p.m.x === 'string') { const pl = room.players().find(q => q.id === e.playerId); const m = { k: 'c' + e.playerId + '.' + (p.m.i | 0), p: e.playerId, n: pl ? pl.displayName : '?', x: cleanChat(p.m.x) }; if (m.x && !hostCm.some(q => q.k === m.k)) { hostCm.push(m); hostCm = hostCm.slice(-30); addChatLine(m); SFX.chat(); hostDirty = true; } }
    }
    if (hostDirty) sendTick(true);
  }
  function pruneLeft() { if (!room || !match) return; const ids = new Set(room.seated().map(p => p.id)); for (const top of match.tops) if (!top.bot && !ids.has(top.id) && top.alive) { top.alive = false; top.out = 'ring'; top.thrown = true; hostDirty = true; } }
  // host: snapshots on a timer so play continues even when rAF is throttled
  setInterval(() => {
    if (mode !== 'online' || !room || !match || !room.isHost() || room.s.ph !== 'play') return;
    if (play.hidden) { const prev = match.phase; for (let i = 0; i < 6; i++) G.step(match, 1 / 60); if (match.phase !== prev) onPhase(prev); }
    const gap = match.phase === 'fight' ? (hostDirty ? 300 : 450) : (hostDirty ? 250 : 1500);
    if (Date.now() - lastTick >= gap) sendTick(false);
  }, 100);
  function tickState(r) { return Object.assign({}, r.s, { s: Object.assign(G.snapshot(match), { lt: Math.round(pushHalf) }), cm: hostCm.slice(-30) }); }
  async function sendTick(urgent) {
    const r = room; if (!r || !match || !r.isHost() || r.s.ph !== 'play' || r.s.g !== hostG) return;
    if (tickBusy) { if (urgent) hostDirty = true; return; }
    if (!hostBudget.take()) { hostDirty = true; return; }
    tickBusy = true; lastTick = Date.now(); hostDirty = false;
    const t0 = performance.now();
    try { await r.push('tick', { state: tickState(r) }); pushHalf = pushHalf * 0.6 + Math.min(400, (performance.now() - t0) / 2) * 0.4; }
    catch (e) { hostDirty = true; if (e.status === 409 && r === room) { try { await r.settle(e.used); } catch (e2) { /* next tick */ } } }
    finally { tickBusy = false; }
  }
  let inBusy = false, outChat = null, chatSeq = Date.now() % 1e6;
  async function sendIn() {
    const r = room; if (!r || r.spectator || r.isHost() || r.s.ph !== 'play') return;
    if (inBusy) { setTimeout(sendIn, 120); return; }
    if (!inBudget.take()) { setTimeout(sendIn, 350); return; }
    const payload = { g: r.s.g }, th = pendThrow, m0 = outChat;
    if (th && th.g === r.s.g) { payload.r = th.r; payload.th = th.d; }
    if (m0) payload.m = m0; if (!payload.th && !payload.m) return;
    inBusy = true;
    try { await r.push('in', { payload }); if (outChat === m0) outChat = null; }
    catch (e) { if (r === room) { if (e.status === 409) { try { await r.settle(e.used); } catch (e2) { /* retry */ } } setTimeout(sendIn, 200); } }
    finally { inBusy = false; }
  }
  async function sendEnd() {
    const r = room; if (!r || !match || endSent) return; endSent = true; const res = results(match), snap = G.snapshot(match), cm = hostCm.slice(-30);
    try { await r.edit('end', s => { if (s.ph !== 'play' || s.g !== hostG) return null; s.ph = 'end'; s.res = res; s.s = snap; s.cm = cm; return { status: 'waiting' }; }); }
    catch (e) { endSent = false; setTimeout(sendEnd, 800); }
  }
  async function startOnline() {
    const r = room; if (!r || !r.isHost() || starting) return;
    const ps = r.seated(); let bots = Math.max(0, Math.min(6 - ps.length, (r.s.set && r.s.set.bots) | 0)); if (ps.length + bots < 2) bots = 1;
    const botNames = ['Ucok', 'Siti', 'Budi', 'Ayu', 'Joko'];
    const players = ps.slice(0, 6).map(p => ({ id: p.id, name: p.displayName || 'Pemain', bot: false }));
    for (let i = 0; i < bots; i++) players.push({ id: 'b' + i, name: botNames[i] + ' 🤖', bot: true });
    const g = Math.random().toString(36).slice(2, 8), next = G.createMatch({ seed: (Math.random() * 1e9) >>> 0, players, target: pts(r.s.set && r.s.set.pts) });
    G.resetRound(next); starting = true; $('#startBtn').disabled = true; $('#againBtn').disabled = true;
    try {
      match = next; hostG = g; seenV = r.version; endSent = false; seen = null; hudKey = ''; clearTimers();
      const res = await r.edit('start', s => { s.ph = 'play'; s.g = g; s.res = null; s.s = G.snapshot(next); hostCm = s.cm.slice(-30); return { status: 'playing' }; });
      if (!res) { match = null; hostG = null; } else { seenV = Math.max(seenV, res.version || 0); show(play); banner(t('round') + ' 1', t('goalLong').replace('{n}', match.target)); }
    } catch (e) { match = null; hostG = null; toast(errMsg(e), 'bad'); }
    finally { starting = false; $('#startBtn').disabled = false; $('#againBtn').disabled = false; if (room) onRoom(room, room.data); }
  }
  async function toLobby() { const r = room; if (!r || !r.isHost()) return; try { await r.edit('lobby', s => { s.ph = 'lobby'; s.s = null; s.res = null; return { status: 'waiting' }; }); } catch (e) { toast(errMsg(e), 'bad'); } }
  async function setBots(v) { const r = room; if (!r || !r.isHost()) return; try { await r.edit('set', s => { if (s.ph !== 'lobby') return null; s.set.bots = v; }); } catch (e) { toast(errMsg(e), 'bad'); } }
  $$('#lobbyBotSeg button').forEach(b => b.addEventListener('click', () => setBots(+b.dataset.v)));
  async function setPts(v) { const r = room; if (!r || !r.isHost()) return; try { await r.edit('set', s => { if (s.ph !== 'lobby') return null; s.set = s.set || {}; s.set.pts = pts(v); }); } catch (e) { toast(errMsg(e), 'bad'); } }
  $$('#lobbyPtsSeg button').forEach(b => b.addEventListener('click', () => { SFX.click(); setPts(+b.dataset.v); }));

  function renderLobby() {
    const r = room; if (!r || !r.data) return; const d = r.data, host = r.isHost(), ps = r.seated(), bots = (r.s.set && r.s.set.bots) | 0, P = pts(r.s.set && r.s.set.pts);
    $('#roomCode').textContent = d.code || '------';
    $('#lobbyMeta').textContent = (d.visibility === 'private' ? t('priv') : t('pub')) + ' · ' + ps.length + '/' + (d.maxPlayers || 6) + ' ' + t('players') + ' · ' + t('goal').replace('{n}', P);
    const rows = ps.map((p, i) => '<li class="' + (p.id === r.me ? 'me' : '') + '"><span><span class="dot" style="background:' + G.COLORS[i % 6] + '"></span>' + esc(p.displayName || '?') + (p.gamemaster ? ' <em class="gm-badge on">(GM)</em>' : '') + (p.id === r.me ? '<span class="tag">' + esc(t('you')) + '</span>' : '') + '</span><span class="small muted">' + (p.host ? '👑 ' + esc(t('host')) : '') + '</span></li>');
    for (let i = 0; i < Math.min(bots, 6 - ps.length); i++) rows.push('<li><span><span class="dot" style="background:' + G.COLORS[(ps.length + i) % 6] + '"></span>' + ['Ucok', 'Siti', 'Budi', 'Ayu', 'Joko'][i] + ' 🤖</span><span class="small muted">' + esc(t('bot')) + '</span></li>');
    $('#crewList').innerHTML = rows.join('');
    $('#startBtn').hidden = !host; $('#lobbyBots').hidden = !host;
    $$('#lobbyBotSeg button').forEach(b => b.classList.toggle('on', +b.dataset.v === bots));
    $$('#lobbyPtsSeg button').forEach(b => { b.classList.toggle('on', +b.dataset.v === P); b.disabled = !host; }); $('#lobbyPtsHint').textContent = host ? '' : t('ptsHost');
    $('#lobbyWait').textContent = host ? (ps.length < 2 && !bots ? t('soloHost') : t('youHost')) : t('waitingHost');
  }
  function invite() {
    if (!room) return; const url = location.origin + location.pathname + '?room=' + room.code, done = () => toast(t('copied'), 'good');
    if (navigator.share && /Mobi|Android/i.test(navigator.userAgent)) navigator.share({ title: 'Gasing Arena', text: 'Adu gasing bareng! Kode ' + room.code, url }).catch(() => {});
    else if (navigator.clipboard) navigator.clipboard.writeText(url).then(done, () => toast(url, '', 6000)); else toast(url, '', 6000);
  }
  $('#copyInvite').onclick = invite; $('#roomCode').onclick = invite;
  $('#startBtn').onclick = () => startOnline();
  function exitToMenu() { charge = null; meterEl.hidden = true; stopOnline(); clearTimers(); mode = null; match = null; show(home); onlineNote(); }
  $('#leaveLobby').onclick = exitToMenu;
  $('#backPlay').onclick = () => { if (mode === 'online' && !confirm(lang === 'en' ? 'Leave the match?' : 'Keluar dari pertandingan?')) return; exitToMenu(); };
  $('#endMenu').onclick = exitToMenu;
  $('#toLobbyBtn').onclick = toLobby;
  $('#againBtn').onclick = () => { if (mode === 'solo') startPractice(); else startOnline(); };

  /* ---------- chat ---------- */
  const BAD = /\b(anjing|bangsat|babi|kontol|memek|ngentot|goblok|tolol|fuck|shit|bitch)\b/gi;
  function cleanChat(x) { return String(x || '').replace(/[\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120).replace(BAD, w => w[0] + '*'.repeat(w.length - 1)); }
  const chatKeys = new Set();
  function resetChat() { chatKeys.clear(); $('#chatLog').innerHTML = ''; }
  function isGm(id) { return !!(room && room.isGamemaster(id)); }
  function addChatLine(m) {
    if (!m || !m.k || chatKeys.has(m.k)) return; chatKeys.add(m.k); const log = $('#chatLog'), p = doc.createElement('p');
    if (m.t === 'sys') { p.className = 'sys'; p.textContent = m.x; } else p.innerHTML = '<b>' + esc(m.n || '?') + (isGm(m.p) ? ' <em class="gm-badge on">(GM)</em>' : '') + ':</b> ' + esc(m.x);
    log.appendChild(p); while (log.children.length > 80) log.firstChild.remove(); log.scrollTop = log.scrollHeight;
  }
  function syncChat(cm) { for (const m of cm || []) { if (!m || typeof m !== 'object') continue; const fresh = !chatKeys.has(m.k); addChatLine({ k: String(m.k || ''), p: m.p, n: String(m.n || ''), x: cleanChat(m.x) }); if (fresh && m.p !== (room && room.me)) SFX.chat(); } }
  let chatAt = 0;
  async function sendChat(raw) {
    const x = cleanChat(raw); if (!x || !room) return false; const n = Date.now(); if (n - chatAt < 900) return false; chatAt = n;
    const k = 'c' + room.me + '.' + (++chatSeq), m = { k, p: room.me, n: myName() || '?', x };
    if (room.s.ph === 'play') {
      if (room.isHost()) { hostCm.push(m); hostCm = hostCm.slice(-30); addChatLine(m); hostDirty = true; }
      else { outChat = { i: chatSeq, x }; addChatLine(Object.assign({}, m, { k: 'c' + room.me + '.' + chatSeq })); sendIn(); }
    } else { addChatLine(m); try { await room.edit('chat', s => { s.cm = (s.cm || []).concat([m]).slice(-30); }); } catch (e) { toast(errMsg(e), 'bad'); } }
    return true;
  }
  (cfg.emoji || []).forEach(e => { const b = doc.createElement('button'); b.type = 'button'; b.textContent = e; b.onclick = () => sendChat(e); $('#emojiRow').appendChild(b); });
  $('#chatToggle').onclick = () => $('#chat').classList.toggle('on');
  $('#chatForm').onsubmit = ev => { ev.preventDefault(); const i = $('#chatInput'); Promise.resolve(sendChat(i.value)).then(ok => { if (ok) i.value = ''; }); };

  /* ---------- gamemaster ---------- */
  let gm = false, gmRooms = null, gmBusy = false, gmAt = 0, gmWakeT = 0;
  function gmSync() { gm = (location.hash || '').toLowerCase().includes(N.GM_KEY); $('#gmRooms').hidden = !gm; if (gm) gmLoad(); }
  async function gmLoad() {
    if (!gm || gmBusy) return; if (!onlineOk) { $('#gmNote').textContent = t('onlineWait'); return; }
    gmBusy = true; gmAt = Date.now(); $('#gmNote').textContent = t('gmLoading');
    try { const d = await conn.rooms({ gm: true }); gmRooms = Array.isArray(d && d.rooms) ? d.rooms : []; } catch (e) { gmRooms = []; $('#gmNote').textContent = errMsg(e); }
    finally { gmBusy = false; }
    $('#gmNote').textContent = gmRooms.length ? gmRooms.length + ' room' : t('gmEmpty');
    $('#gmList').innerHTML = gmRooms.map(r => '<li><span><code>' + esc(r.code) + '</code> <small class="muted">' + esc(r.visibility || '') + ' · ' + esc(r.status || '') + ' · ' + (Number(r.seated) || 0) + '/' + (Number(r.maxPlayers) || 0) + '</small></span><span>' + (r.status === 'playing' ? '' : '<button type="button" class="btn green small" data-gm="join" data-code="' + esc(r.code) + '">' + esc(t('gmJoin')) + '</button> ') + '<button type="button" class="btn ghost small" data-gm="watch" data-code="' + esc(r.code) + '">' + esc(t('gmWatch')) + '</button></span></li>').join('');
  }
  function gmWake() { if (!gm || room) return; clearTimeout(gmWakeT); gmWakeT = setTimeout(gmLoad, 1200); }
  $('#gmRefresh').onclick = gmLoad;
  $('#gmList').addEventListener('click', async e => { const b = e.target.closest('[data-gm]'); if (!b) return; $('#codeInput').value = b.dataset.code; if (b.dataset.gm === 'join') return onlineAction('join'); try { await enterOnline('watch', { displayName: nick(), code: b.dataset.code }); } catch (x) { toast(errMsg(x), 'bad'); } });
  root.addEventListener('hashchange', gmSync);
  function gmClaimUI({ canClaim, claim, onDone }) {
    const w = root, m = doc.createElement('div'); m.id = 'gmClaim'; m.setAttribute('role', 'dialog'); m.setAttribute('aria-modal', 'true'); m.setAttribute('aria-label', 'Kode gamemaster');
    m.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.45);display:none;align-items:center;justify-content:center';
    m.innerHTML = '<form id="gmClaimForm" style="background:#fff;color:#222;padding:16px;border-radius:14px;width:260px;max-width:86vw;font:14px system-ui,sans-serif;box-shadow:0 8px 30px rgba(0,0,0,.3)">'
      + '<b style="display:block;margin-bottom:8px">Kode gamemaster</b>'
      + '<input id="gmClaimInput" type="password" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Masukkan kode" maxlength="128" style="width:100%;box-sizing:border-box;padding:8px;border:1px solid #bbb;border-radius:8px;font:inherit;color:#222;background:#fff">'
      + '<p id="gmClaimErr" role="alert" style="color:#c0392b;min-height:1.2em;margin:6px 0;font-size:13px"></p>'
      + '<div style="display:flex;gap:8px;justify-content:flex-end"><button type="button" id="gmClaimCancel" style="padding:6px 12px;border-radius:8px;border:1px solid #bbb;background:#f3f3f3;color:#222;font:inherit">Batal</button>'
      + '<button type="submit" id="gmClaimOk" style="padding:6px 12px;border-radius:8px;border:0;background:#c0392b;color:#fff;font:600 14px system-ui,sans-serif">Masuk</button></div></form>';
    doc.body.appendChild(m);
    const inp = m.querySelector('#gmClaimInput'), er = m.querySelector('#gmClaimErr'), ok = m.querySelector('#gmClaimOk');
    // only a ?gmjd query param (value ignored, not the secret) arms the prompt; intent survives until a room is entered
    const trig = () => /[?&]gmjd(=|&|$)/i.test(w.location.search || '');
    let busy = false, want = trig(), asked = false;
    const close = () => { m.style.display = 'none'; inp.value = ''; er.textContent = ''; };
    const open = () => { if (!canClaim()) return; er.textContent = ''; inp.value = ''; m.style.display = 'flex'; setTimeout(() => inp.focus(), 20); };
    m.addEventListener('click', e => { if (e.target === m) close(); });
    m.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Escape') close(); });
    m.querySelector('#gmClaimCancel').addEventListener('click', close);
    m.querySelector('#gmClaimForm').addEventListener('submit', async e => {
      e.preventDefault(); e.stopPropagation(); const code = inp.value.trim(); if (!code || busy) { inp.focus(); return; }
      busy = true; ok.disabled = true; er.textContent = '';
      try {
        await claim(code); want = false; close();
        if (trig() && w.history && w.history.replaceState) { const u = new URL(w.location.href); for (const k of [...u.searchParams.keys()]) if (k.toLowerCase() === 'gmjd') u.searchParams.delete(k); w.history.replaceState(w.history.state, '', u.pathname + u.search + u.hash); }
        sync(); if (onDone) onDone();
      } catch (x) { inp.value = ''; er.textContent = x && x.status === 403 ? 'Kode salah.' : 'Gagal, coba lagi.'; inp.focus(); }
      finally { busy = false; ok.disabled = false; }
    });
    function sync() { const on = !!canClaim(); if (!on) { asked = false; if (m.style.display !== 'none' && !busy) close(); return; } if (want && !asked) { asked = true; open(); } }
    return { sync, open, close };
  }
  const gmUI = gmClaimUI({ canClaim: () => mode === 'online' && !!room && !!room.data && !room.isGamemaster(), claim: code => room.claimGamemaster(code), onDone: () => { toast('Mode GM aktif', 'good'); renderLobby(); } });

  /* ---------- boot ---------- */
  applyLang(); syncMute(); gmSync();
  root.addEventListener('pagehide', () => { if (room) conn.leaveBeacon(); });
  doc.addEventListener('visibilitychange', () => { if (doc.visibilityState === 'visible' && conn.config) conn.visible(); });
  root.addEventListener('resize', () => { arenaR.fit(); heroR.fit(); });
  const params = new URLSearchParams(location.search), inviteCode = (params.get('room') || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const onlineReady = (async () => {
    if (!conn.allowed) { onlineNote(); return 'offline'; }
    onlineNote();
    try { await conn.start(); onlineOk = true; conn.failed = false; } catch (e) { conn.failed = true; onlineOk = false; }
    onlineNote(); if (gm) gmLoad(); return onlineOk ? 'ready' : 'down';
  })();
  if (inviteCode && root.JRInvite) root.JRInvite.run({
    code: inviteCode, lang, gameName: 'Gasing Arena', nameKey: LS_NAME, nameMax: 24, accent: '#c8432b', defaultName: getLS(LS_NAME) || '',
    check: async c => { const st = await onlineReady; if (st === 'offline') return 'offline'; if (st !== 'ready') return { fallback: t('onlineDown') }; return conn.probe(c); },
    join: async name => { $('#nameInput').value = name; $('#codeInput').value = inviteCode; try { await enterOnline('join', { displayName: name, code: inviteCode }); return { ok: true }; } catch (e) { if (e.status === 404 || e.status === 422) return { ok: false, missing: true }; if (e.status === 409) { try { await enterOnline('watch', { displayName: name, code: inviteCode }); toast(t('errFull'), '', 4000); return { ok: true }; } catch (e2) { return { ok: false, message: errMsg(e2) }; } } return { ok: false, retry: true, message: errMsg(e) }; } },
    fallback: () => { $('#codeInput').value = ''; }
  });
  if (location.hash === '#latihan' || location.hash === '#practice' || location.hash === '#demo') { if (location.hash === '#demo') botsN = 2; startPractice(); }
  root.requestAnimationFrame(frame);
  root.GAApp = { get meter() { return charge ? { active: true, pos: meterNow() } : { active: false }; }, fire, arenaR, startPractice, getMatch: () => match, show, get room() { return room; }, get mode() { return mode; }, doThrow, conn, get localId() { return localId; } };
})();

// Whoosh Atur Rel: screens, input, audio, storage, tutorial.
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var LV = WR_DATA.levels, ST = WR_DATA.stations, MAPS = {};
  function mapOf(i) { return MAPS[i] || (MAPS[i] = WR.build(LV[i])); }
  // ---------- storage ----------
  function ld(k, d) { try { var v = localStorage.getItem('whoosh.' + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } }
  function sv(k, v) { try { localStorage.setItem('whoosh.' + k, JSON.stringify(v)); } catch (e) { } }
  var stars = ld('stars', {}), best = ld('best', {}), rec = ld('rec', { daily: {}, endless: [] }), muted = !!ld('mute', false), tutDone = !!ld('tut', false), seen = ld('seen', {});
  function today() { var d = new Date(Date.now() + 8 * 3600e3); return d.toISOString().slice(0, 10); }
  function todayLabel() { var d = new Date(Date.now() + 8 * 3600e3), m = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']; return d.getUTCDate() + ' ' + m[d.getUTCMonth()] + ' ' + d.getUTCFullYear(); }
  // ---------- audio ----------
  var AC = null, master = null;
  function ac() {
    if (!AC) { try { AC = new (window.AudioContext || window.webkitAudioContext)(); master = AC.createGain(); master.gain.value = 0.7; master.connect(AC.destination); } catch (e) { AC = null; } }
    if (AC && AC.state === 'suspended') AC.resume();
    return AC;
  }
  function tone(f, t, dur, type, vol, f2, lp) {
    if (muted || !ac()) return; var c = AC, t0 = c.currentTime + (t || 0), o = c.createOscillator(), g = c.createGain(), out = g;
    o.type = type || 'sine'; o.frequency.setValueAtTime(f, t0); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol || 0.2, t0 + 0.015); g.gain.setValueAtTime(vol || 0.2, t0 + Math.max(0.02, dur - 0.08)); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g);
    if (lp) { var fl = c.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = lp; g.connect(fl); out = fl; }
    out.connect(master); o.start(t0); o.stop(t0 + dur + 0.05);
  }
  var NB = null;
  function noise(t, dur, vol, ftype, f1, f2, q) {
    if (muted || !ac()) return; var c = AC;
    if (!NB) { NB = c.createBuffer(1, c.sampleRate, c.sampleRate); var d = NB.getChannelData(0); for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
    var s = c.createBufferSource(), fl = c.createBiquadFilter(), g = c.createGain(), t0 = c.currentTime + (t || 0);
    s.buffer = NB; s.loop = true; fl.type = ftype || 'bandpass'; fl.Q.value = q || 1; fl.frequency.setValueAtTime(f1, t0); if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol, t0 + Math.min(0.05, dur / 3)); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    s.connect(fl); fl.connect(g); g.connect(master); s.start(t0); s.stop(t0 + dur + 0.05);
  }
  var SFX = {
    horn: function (ty) {
      if (ty === 'kcic') { [0, 0.62].forEach(function (t) { tone(698, t, 0.5, 'sawtooth', 0.07, 0, 2200); tone(880, t, 0.5, 'sawtooth', 0.06, 0, 2200); }); }
      else if (ty === 'krl') { [0, 0.22, 0.6, 0.82].forEach(function (t) { tone(587, t, 0.17, 'square', 0.05, 0, 1800); tone(740, t, 0.17, 'square', 0.04, 0, 1800); }); }
      else { tone(196, 0, 1.3, 'sawtooth', 0.09, 0, 1200); tone(247, 0, 1.3, 'sawtooth', 0.07, 0, 1200); }
    },
    bell: function () { tone(1250, 0, 0.18, 'triangle', 0.08); tone(1250, 0.24, 0.18, 'triangle', 0.08); },
    sw: function () { noise(0, 0.07, 0.25, 'bandpass', 2400, 0, 2); tone(140, 0, 0.09, 'sine', 0.2, 70); },
    lock: function () { tone(330, 0, 0.09, 'square', 0.05); tone(262, 0.1, 0.12, 'square', 0.05); },
    sig: function (on) { tone(on ? 880 : 440, 0, 0.12, 'sine', 0.13, on ? 1175 : 330); },
    ok: function () { [523, 659, 784].forEach(function (f, i) { tone(f, i * 0.07, 0.18, 'triangle', 0.12); }); },
    late: function () { tone(523, 0, 0.16, 'triangle', 0.1); tone(392, 0.12, 0.2, 'triangle', 0.1); },
    wrong: function () { tone(180, 0, 0.32, 'sawtooth', 0.09, 120, 900); },
    crash: function () { noise(0, 0.9, 0.6, 'lowpass', 3000, 200, 0.7); tone(70, 0, 0.6, 'sine', 0.4, 35); noise(0.05, 0.5, 0.25, 'bandpass', 900, 300, 3); },
    whoosh: function () { noise(0, 0.7, 0.18, 'bandpass', 400, 3200, 1.5); },
    win: function () { [523, 659, 784, 1047].forEach(function (f, i) { tone(f, i * 0.12, 0.28, 'triangle', 0.13); tone(f / 2, i * 0.12, 0.28, 'sine', 0.07); }); },
    fail: function () { [392, 330, 262].forEach(function (f, i) { tone(f, i * 0.18, 0.3, 'triangle', 0.12); }); },
    tap: function () { tone(660, 0, 0.05, 'sine', 0.08); }
  };
  function setMute(m) { muted = m; sv('mute', m); $('muteBtn').textContent = $('hMute').textContent = m ? '🔇' : '🔊'; if (!m) SFX.tap(); }
  // ---------- game state ----------
  var cv = $('cv'), G = null, mode = 'home', paused = false, hold = false, speed = 1, overlay = false;
  var ui = { fx: [], sel: null, pred: null, warn: {}, now: 0, bump: {}, showKeys: false, coach: null, shake: 0 };
  var demo = null, botT = 0, predT = 0, hornAt = {}, tut = null, acc = 0, demoBotCfg = null;
  WRR.init(cv);
  function newDemo(lvIdx) {
    var m = mapOf(lvIdx); demo = { kind: 'demo', lv: lvIdx, map: m, st: WR.newGame(m, { endless: true, pace: 1, seed: (Math.random() * 1e9) | 0 }) };
    WRR.setLevel(m, LV[lvIdx].theme);
  }
  function start(kind, lvIdx, seed) {
    var m = mapOf(lvIdx), st = WR.newGame(m, kind === 'level' ? {} : { endless: true, seed: seed });
    G = { kind: kind, lv: lvIdx, map: m, st: st, seed: seed, saved: false };
    WRR.setLevel(m, LV[lvIdx].theme, kind === 'level' ? null : 'senja'); ui.fx = []; ui.sel = null; ui.pred = null; ui.warn = {}; ui.coach = null; hornAt = {}; acc = 0;
    paused = false; hold = false; tut = null; speed = 1; $('speedBtn').textContent = '1×';
    setMode('play'); hud(true);
    var L = LV[lvIdx];
    $('hLevel').textContent = kind === 'level' ? (lvIdx + 1) + '. ' + L.name : kind === 'daily' ? 'Harian · ' + todayLabel() : 'Tanpa Batas';
    $('hPlace').textContent = kind === 'level' ? L.place : L.name;
    if (kind === 'level' && lvIdx === 0 && !tutDone) { tut = { step: 0 }; showIntro(true); }
    else showIntro(false);
  }
  function setMode(m) {
    mode = m; document.body.classList.toggle('homing', m === 'home');
    $('home').classList.toggle('hidden', m !== 'home'); $('hud').classList.toggle('hidden', m === 'home');
    $('dim').classList.toggle('off', m !== 'home');
    document.documentElement.classList.toggle('jr-hub-off', m === 'play');
    if (m === 'home') { closeOv(); coach(null); hideToast(); if (!demo || demo.st.over) newDemo(7); else WRR.setLevel(demo.map, LV[demo.lv].theme); refreshHome(); window.scrollTo(0, 0); }
  }
  function cur() { return mode === 'home' ? demo : G; }
  // ---------- events -> feedback ----------
  function drain(g) {
    var st = g.st, evs = st.events, live = g === G && mode === 'play';
    for (var i = 0; i < evs.length; i++) {
      var e = evs[i];
      if (!live) { if (e.e === 'crash') { WRR.boom(ui, e.x, e.y, ui.now); } continue; }
      if (e.e === 'spawn') { if (e.type === 'kcic') SFX.whoosh(); }
      else if (e.e === 'switch') { SFX.sw(); ui.bump[e.id] = ui.now; }
      else if (e.e === 'locked') { SFX.lock(); toast(e.pend ? '⏳ Wesel terkunci, kereta lewat. Pindah setelah lewat.' : 'Antrean wesel dibatalkan'); }
      else if (e.e === 'signal') SFX.sig(e.on);
      else if (e.e === 'arrive') {
        var n = g.map.nodes[e.exit], txt = e.res === 'ok' ? '+' + e.pts + ' Tepat!' : e.res === 'late' ? '+' + e.pts + ' Telat ' + Math.round(e.delay) + 's' : 'Salah tujuan!';
        ui.fx.push({ k: 'txt', x: n.x - 0.9, y: n.y - 0.4, t: ui.now, life: 1.5, s: txt, bg: e.res === 'ok' ? 'rgba(47,158,68,.95)' : e.res === 'late' ? 'rgba(247,103,7,.95)' : 'rgba(224,49,49,.95)' });
        ui.fx.push({ k: 'ring', x: n.x, y: n.y, t: ui.now, life: 0.7, col: e.res === 'ok' ? '#51cf66' : e.res === 'late' ? '#ff922b' : '#fa5252' });
        if (e.res === 'ok') SFX.ok(); else if (e.res === 'late') SFX.late(); else SFX.wrong(); if (e.res === 'wrong' && st.gen) { toast('❌ Salah tujuan! Nyawa -1'); var hh = $('hHearts'); hh.classList.remove('hit'); void hh.offsetWidth; hh.classList.add('hit'); }
        if (tut && tut.step === 1 && e.id === 1) { tut.step = 2; coachMsg('Tepat waktu! 🎉', 'Lencana <b>✓ hijau</b> di kereta artinya wesel sudah mengarah ke tujuannya. <b>✗ merah</b> artinya salah jalur.', 3500); }
      } else if (e.e === 'crash') {
        WRR.boom(ui, e.x, e.y, ui.now); ui.shake = ui.now + 0.5; SFX.crash(); var h = $('hHearts'); h.classList.remove('hit'); void h.offsetWidth; h.classList.add('hit');
        toast(st.hearts > 0 ? '💥 Tabrakan! Sisa nyawa ' + st.hearts : '💥 Tabrakan!'); if (navigator.vibrate) try { navigator.vibrate(180); } catch (x) { }
      } else if (e.e === 'over') { setTimeout(function () { if (G && G.st === st) finish(); }, e.res === 'win' ? 700 : 1300); }
    }
    evs.length = 0;
  }
  // ---------- tutorial (L1 first play) ----------
  function nearNode(st, id, node, d) { var tr = st.trains.filter(function (t) { return t.id === id && t.st === 'run'; })[0]; if (!tr) return null; var e = st.map.edges[tr.edges[tr.edges.length - 1]]; return e.to === node && e.len - tr.s < d ? tr : null; }
  function tutTick() {
    if (!tut || !G) return; var st = G.st, s1 = G.map.nodes.S1;
    if (tut.step === 0) { var t1 = nearNode(st, 1, 'S1', 1.9); if (t1) { if (WR.routeExit(st, t1) === t1.dest) { tut.step = 1; return; } hold = true; tut.target = 'S1'; ui.coach = { x: s1.x, y: s1.y }; coach('<div class="ct">LANGKAH 1 · WESEL</div>KRL ini menuju <b>Cikarang</b> (lencana ungu <b>C</b>), tapi wesel kuning mengarah ke Gudang. <b>Ketuk wesel</b> untuk membelokkan!', true); } }
    else if (tut.step === 2) { var t2 = nearNode(st, 2, 'S1', 2.4); if (t2) { if (WR.routeExit(st, t2) === t2.dest) { tut.step = 4; return; } hold = true; tut.target = 'S1'; ui.coach = { x: s1.x, y: s1.y }; coach('<div class="ct">LANGKAH 2</div>Kereta barang ke <b>Gudang</b> (lencana cokelat <b>G</b>). Lihat tanda <b class="r">✗</b> merah? Jalurnya salah. Ketuk wesel lagi!', true); } }
    else if (tut.step === 4 && st.t > 14) { tut.step = 5; coachMsg('Sekarang giliranmu!', 'Kereta berikutnya diumumkan di ujung kiri 4 detik sebelum masuk. Wesel <b>terkunci</b> saat dilewati kereta, ketukanmu diantrekan ⏳.', 5500); }
  }
  function tutAct(ct) {
    if (!tut || !hold) return true; if (ct.k !== 'w' || ct.id !== tut.target) return false;
    hold = false; ui.coach = null; coach(null); tut.step = tut.step === 0 ? 1 : 4; return true;
  }
  // ---------- input ----------
  function act(ct) {
    if (mode !== 'play' || !G || G.st.over || overlay || paused) return;
    if (!tutAct(ct)) return;
    ac(); WR.toggle(G.st, ct); drain(G); predT = 0;
  }
  cv.addEventListener('pointerdown', function (ev) {
    if (mode !== 'play') return; ev.preventDefault(); var r = cv.getBoundingClientRect(), ct = WRR.pick(ev.clientX - r.left, ev.clientY - r.top, G.st);
    if (ct) { ui.sel = ui.showKeys ? ct : null; act(ct); }
  });
  document.addEventListener('keydown', function (ev) {
    var k = ev.key.toLowerCase(); if (ev.target && ev.target.tagName === 'INPUT') return;
    if (mode !== 'play' || !G) return;
    if (overlay) { if (k === 'enter' || k === ' ') { var b = document.querySelector('#ovCard .btn.primary,#ovCard .btn.green'); if (b) { ev.preventDefault(); b.click(); } } else if (k === 'escape' && paused) resume(); return; }
    var cs = G.map.controls, idx = ui.sel ? cs.indexOf(ui.sel) : -1;
    if (k === 'a' || k === 'arrowleft' || k === 'arrowup' && false) { ui.showKeys = true; ui.sel = cs[(idx - 1 + cs.length) % cs.length]; ev.preventDefault(); }
    else if (k === 'd' || k === 'arrowright' || k === 'tab') { ui.showKeys = true; ui.sel = cs[(idx + 1) % cs.length]; ev.preventDefault(); }
    else if (k === 'w' || k === 's' || k === ' ' || k === 'enter' || k === 'arrowup' || k === 'arrowdown') { ui.showKeys = true; if (!ui.sel) ui.sel = tut && tut.target ? cs.filter(function (c) { return c.id === tut.target; })[0] : cs[0]; else act(ui.sel); ev.preventDefault(); }
    else if (/^[1-9]$/.test(k)) { ui.showKeys = true; var c = cs[+k - 1]; if (c) { ui.sel = c; act(c); } }
    else if (k === 'p' || k === 'escape') pause();
    else if (k === 'f') toggleSpeed();
    else if (k === 'm') setMute(!muted);
  });
  // ---------- overlays ----------
  function openOv(html) { $('ovCard').className = 'card'; $('ovCard').innerHTML = html; $('ov').classList.remove('hidden'); overlay = true; var f = $('ovCard').querySelector('.btn.primary,.btn.green'); if (f && matchMedia('(hover:hover)').matches) f.focus({ preventScroll: true }); }
  function closeOv() { $('ov').classList.add('hidden'); overlay = false; }
  function on(id, fn) { var e = $(id); if (e) e.onclick = function () { ac(); fn(); }; }
  var LEG = '<div class="legend"><div><span class="tk kcic"></span><span><b>Whoosh</b> · paling cepat, toleransi telat ±6 dtk</span></div><div><span class="tk krl"></span><span><b>KRL</b> · sering datang, toleransi ±12 dtk</span></div><div><span class="tk barang"></span><span><b>Kereta barang</b> · pelan &amp; panjang, toleransi ±30 dtk</span></div></div>';
  function showIntro(tutorial) {
    var L = LV[G.lv], m = G.map, n = G.st.total, h;
    if (G.kind === 'level') {
      h = '<div class="sub">LEVEL ' + (G.lv + 1) + ' · ' + L.place.toUpperCase() + '</div><h2>' + L.name + '</h2><p>' + (L.intro || L.blurb) + '</p>';
      if (G.lv === 0 || !seen.legend) h += LEG;
      h += '<p class="sub">' + n + ' kereta · ' + m.switches.length + ' wesel · ' + m.signals.length + ' sinyal · ❤️×' + G.st.hearts + '</p>';
    } else {
      h = '<div class="sub">' + (G.kind === 'daily' ? 'HARIAN · ' + todayLabel().toUpperCase() : 'TANPA BATAS') + '</div><h2>' + L.name + '</h2><p>' + (G.kind === 'daily' ? 'Jadwal kereta hari ini sama untuk semua pemain. Makin lama makin padat, bertahan selama mungkin!' : 'Kereta datang terus dan makin rapat. 3 nyawa, berapa poin yang bisa kamu kumpulkan?') + '</p>' + LEG;
    }
    h += '<div class="acts"><button type="button" class="btn big primary" id="goBtn">Mulai ▶</button></div>';
    openOv(h); seen.legend = 1; sv('seen', seen);
    on('goBtn', function () {
      closeOv(); SFX.horn('krl');
      if (G.kind === 'level' && !seen[L.id] && (L.id === 'L2' || L.id === 'L4')) { seen[L.id] = 1; sv('seen', seen); var tg = L.id === 'L2' ? { sig: m.signals[0] } : { x: m.nodes[m.switches[0]].x, y: m.nodes[m.switches[0]].y }; ui.coach = tg; setTimeout(function () { if (ui.coach === tg) ui.coach = null; }, 6000); }
    });
  }
  function pause() {
    if (mode !== 'play' || overlay || G.st.over) return; paused = true;
    openOv('<h2>Jeda</h2><p class="sub">' + $('hLevel').textContent + '</p><div class="acts" style="flex-direction:column"><button type="button" class="btn big green" id="resBtn">Lanjut ▶</button><button type="button" class="btn" id="rstBtn">↻ Ulangi</button><button type="button" class="btn" id="howP">❓ Cara main</button><button type="button" class="btn" id="menuBtn">🏠 Menu</button></div>');
    on('resBtn', resume); on('rstBtn', function () { start(G.kind, G.lv, G.seed); }); on('menuBtn', function () { setMode('home'); }); on('howP', function () { how(true); });
  }
  function resume() { closeOv(); paused = false; }
  function toggleSpeed() { speed = speed === 1 ? 2 : 1; $('speedBtn').textContent = speed + '×'; }
  function finish() {
    var st = G.st, h; hold = false; coach(null); ui.coach = null; ui.pred = null; ui.warn = {};
    if (G.kind === 'level') {
      var s = WR.stars(st), id = LV[G.lv].id, nb = st.score > (best[id] || 0) && s > 0;
      if (s > (stars[id] || 0)) stars[id] = s; if (nb) best[id] = st.score; sv('stars', stars); sv('best', best);
      if (G.lv === 0 && tut) { tutDone = true; sv('tut', true); }
      if (s) { SFX.win(); WRR.confetti(ui, 8, 4.5, ui.now); if (s === 3) setTimeout(function () { WRR.confetti(ui, 4, 3, ui.now); WRR.confetti(ui, 12, 6, ui.now); }, 350); } else SFX.fail();
      h = '<div class="sub">LEVEL ' + (G.lv + 1) + ' · ' + LV[G.lv].name.toUpperCase() + '</div><h2>' + (s === 3 ? 'Sempurna!' : s ? 'Level selesai!' : 'Gagal, 3 tabrakan') + '</h2>';
      h += '<div class="stars">' + [1, 2, 3].map(function (k, i) { return '<i class="' + (s >= k ? 'on' : '') + '" style="animation-delay:' + (0.15 + i * 0.18) + 's">★</i>'; }).join('') + '</div>';
      h += '<div class="big-score">' + st.score + '</div>' + (nb ? '<span class="newrec">REKOR BARU</span>' : '<div class="sub">rekor: ' + (best[id] || 0) + '</div>');
      h += grid(st) + '<p class="sub">' + (s === 3 ? 'Tanpa tabrakan, maks 1 salah jalur, ≥85% sampai tujuan.' : '★★★ = tanpa tabrakan, maks 1 salah jalur, ≥85% sampai tujuan (telat tetap dihitung).') + '</p>';
      var nx = G.lv + 1 < LV.length && s > 0;
      h += '<div class="acts"><button type="button" class="btn" id="mBtn">🏠</button><button type="button" class="btn" id="rBtn">↻ Ulangi</button>' + (nx ? '<button type="button" class="btn primary" id="nBtn">Lanjut ▶</button>' : '') + '</div>';
      openOv(h); if (!s) $('ovCard').classList.add('fail'); on('rBtn', function () { start('level', G.lv); }); on('mBtn', function () { setMode('home'); }); if (nx) on('nBtn', function () { start('level', G.lv + 1); });
    } else {
      SFX.fail(); var list = G.kind === 'daily' ? (rec.daily[today()] || []) : rec.endless, bestS = list.length ? list[0].s : 0, nb2 = st.score > bestS;
      h = '<div class="sub">' + (G.kind === 'daily' ? 'HARIAN · ' + todayLabel().toUpperCase() : 'TANPA BATAS') + '</div><h2>Perjalanan selesai</h2><div class="big-score">' + st.score + '</div>' + (nb2 ? '<span class="newrec">REKOR BARU</span>' : '<div class="sub">rekor: ' + bestS + '</div>');
      h += grid(st) + '<p class="sub">Bertahan ' + Math.round(st.t) + ' detik · ' + (st.ok + st.late) + ' kereta tiba</p>';
      h += '<div class="name-row"><input id="nmIn" maxlength="16" placeholder="JadiDaring" autocomplete="off" aria-label="Nama"><button type="button" class="btn green" id="svBtn">Simpan</button></div>';
      h += '<div class="acts"><button type="button" class="btn" id="mBtn">🏠</button>' + (G.kind === 'daily' ? '<button type="button" class="btn" id="shBtn">📤 Bagikan</button>' : '') + '<button type="button" class="btn primary" id="rBtn">↻ Lagi</button></div>';
      openOv(h); if (window.JDNG && JDNG.name) $('nmIn').value = JDNG.name; // t367u: name from the jd-namegate modal
      on('svBtn', function () { saveRec($('nmIn').value.trim() || 'JadiDaring'); $('svBtn').disabled = true; $('svBtn').textContent = '✓'; });
      on('rBtn', function () { autoSave(); start(G.kind, G.lv, G.kind === 'daily' ? G.seed : (Math.random() * 1e9) | 0); }); on('mBtn', function () { autoSave(); setMode('home'); });
      if (G.kind === 'daily') on('shBtn', share);
    }
  }
  function grid(st) { return '<div class="res-grid"><div><b>' + st.ok + '</b><small>tepat</small></div><div><b>' + st.late + '</b><small>telat</small></div><div><b>' + st.wrong + '</b><small>salah</small></div><div><b>' + st.crash + '</b><small>tabrakan</small></div></div>'; }
  function saveRec(name) {
    if (!G || G.saved) return; G.saved = true; var st = G.st, e = { n: name.slice(0, 16), s: st.score, t: Math.round(st.t) };
    var list = G.kind === 'daily' ? (rec.daily[today()] = rec.daily[today()] || []) : rec.endless;
    list.push(e); list.sort(function (a, b) { return b.s - a.s; }); list.length = Math.min(list.length, 10);
    if (G.kind === 'daily') { var ks = Object.keys(rec.daily).sort(); while (ks.length > 14) delete rec.daily[ks.shift()]; }
    sv('rec', rec);
  }
  function autoSave() { if (G && G.kind !== 'level' && !G.saved && G.st.score > 0) saveRec((window.JDNG && JDNG.name) || 'JadiDaring'); }
  function share() {
    var st = G.st, txt = '🚄 Whoosh Atur Rel · Harian ' + todayLabel() + '\n' + st.score + ' poin · ' + st.ok + ' tepat waktu · bertahan ' + Math.round(st.t) + ' dtk\nBisa kalahkan? https://whoosh.jadidaring.com/';
    if (navigator.share) navigator.share({ text: txt }).catch(function () { }); else window.open('https://wa.me/?text=' + encodeURIComponent(txt), '_blank', 'noopener');
  }
  function how(fromPause) {
    openOv('<h2>Cara main</h2><ol class="how-list"><li>Setiap kereta punya <b>lencana warna</b> stasiun tujuan. Antar ke stasiun dengan warna yang sama.</li><li>Ketuk <b>wesel kuning</b> untuk memindah jalur. Garis kuning = arah aktif.</li><li>Ketuk <b>lampu sinyal</b>: <b class="r">merah</b> menahan kereta, <b class="g">hijau</b> jalan.</li><li>Tanda <b class="r">AWAS</b> + klakson = dua kereta akan bertabrakan. Cepat tahan salah satunya!</li><li>Kereta yang ditahan terlalu lama jadi <b>telat</b> (lingkaran oranye). Whoosh paling tidak sabar.</li><li>Wesel terkunci saat dilewati kereta, ketukanmu diantrekan ⏳.</li></ol>' + LEG + '<p class="sub">Keyboard: <span class="kbd">A</span>/<span class="kbd">D</span> pilih, <span class="kbd">W</span>/<span class="kbd">Spasi</span> ketuk, <span class="kbd">1</span>-<span class="kbd">9</span> langsung, <span class="kbd">P</span> jeda, <span class="kbd">F</span> 2×, <span class="kbd">M</span> suara</p><div class="acts"><button type="button" class="btn big primary" id="okH">Oke!</button></div>');
    on('okH', function () { if (fromPause) pause.call(null, closeOv()); else closeOv(); });
  }
  function levels() {
    var h = '<h2>Pilih level</h2><p class="sub">' + totalStars() + ' / ' + LV.length * 3 + ' ★</p><div class="lv-grid">';
    LV.forEach(function (L, i) { var open = i === 0 || stars[LV[i - 1].id] > 0, s = stars[L.id] || 0; h += '<button type="button" class="lv' + (open ? '' : ' lock') + '" data-i="' + i + '"' + (open ? '' : ' disabled') + '><span class="n">' + (i + 1) + '</span><b>' + (open ? '' : '🔒 ') + L.name + '</b><small>' + L.place + '</small><div class="ls">' + [1, 2, 3].map(function (k) { return s >= k ? '★' : '<span class="o">★</span>'; }).join('') + '</div></button>'; });
    h += '</div><div class="acts"><button type="button" class="btn" id="cl">Tutup</button></div>';
    openOv(h); on('cl', closeOv);
    Array.prototype.forEach.call(document.querySelectorAll('.lv[data-i]'), function (b) { b.onclick = function () { ac(); closeOv(); start('level', +b.dataset.i); }; });
  }
  function records(tab) {
    tab = tab || 'daily'; var list = tab === 'daily' ? (rec.daily[today()] || []) : rec.endless;
    var h = '<h2>Rekor</h2><div class="tabs"><button type="button" class="btn' + (tab === 'daily' ? ' on' : '') + '" id="tD">Harian hari ini</button><button type="button" class="btn' + (tab === 'endless' ? ' on' : '') + '" id="tE">Tanpa Batas</button><button type="button" class="btn' + (tab === 'lv' ? ' on' : '') + '" id="tL">Level</button></div>';
    if (tab === 'lv') h += '<ul class="rec-list">' + LV.map(function (L, i) { return '<li><span>' + (i + 1) + '. ' + L.name + '</span><span>' + ('★'.repeat(stars[L.id] || 0) || '–') + ' · ' + (best[L.id] || 0) + '</span></li>'; }).join('') + '</ul>';
    else h += list.length ? '<ul class="rec-list">' + list.map(function (e, i) { return '<li><span>' + (i + 1) + '. ' + esc(e.n) + '</span><b>' + e.s + '</b></li>'; }).join('') + '</ul>' : '<p class="sub">Belum ada rekor. Main dulu!</p>';
    h += '<p class="sub">Rekor tersimpan di perangkat ini.</p><div class="acts"><button type="button" class="btn" id="cl">Tutup</button></div>';
    openOv(h); on('cl', closeOv); on('tD', function () { records('daily'); }); on('tE', function () { records('endless'); }); on('tL', function () { records('lv'); });
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function totalStars() { return LV.reduce(function (a, L) { return a + (stars[L.id] || 0); }, 0); }
  function nextLevel() { for (var i = 0; i < LV.length; i++) if (!stars[LV[i].id]) return i; return LV.length - 1; }
  function refreshHome() {
    var n = nextLevel(); $('playLbl').textContent = !tutDone && !stars.L1 ? 'Main (tutorial)' : 'Main · Level ' + (n + 1);
    var d = rec.daily[today()]; $('dailySub').textContent = d && d.length ? 'Rekor hari ini: ' + d[0].s : todayLabel();
    $('endSub').textContent = rec.endless.length ? 'Rekor: ' + rec.endless[0].s : 'Makin lama makin padat';
    var ts = totalStars(); $('statLine').textContent = ts ? '⭐ ' + ts + ' / ' + LV.length * 3 + ' bintang · ' + Object.keys(stars).length + ' level selesai' : 'Gratis · tanpa download · tanpa iklan';
  }
  // ---------- coach / toast ----------
  var coachTimer = 0, toastTimer = 0;
  function coach(html, top) { var c = $('coach'); clearTimeout(coachTimer); if (!html) { c.classList.add('hidden'); return; } c.innerHTML = html; c.classList.toggle('top', !!top && WRR.isRot()); c.classList.remove('hidden'); }
  function coachMsg(t, b, ms) { coach('<div class="ct">' + t.toUpperCase() + '</div>' + b); coachTimer = setTimeout(function () { coach(null); }, ms); }
  function toast(t) { var e = $('toast'); e.textContent = t; e.classList.remove('hidden'); clearTimeout(toastTimer); toastTimer = setTimeout(hideToast, 2200); }
  function hideToast() { $('toast').classList.add('hidden'); }
  function hud(force) {
    if (!G) return; var st = G.st, mx = st.maxH || LV[G.lv].hearts || 3, hs = '';
    for (var i = 0; i < mx; i++) hs += i < st.hearts ? '❤️' : '🖤';
    if (hud.h !== hs || force) { $('hHearts').textContent = hs; hud.h = hs; }
    $('hScore').textContent = st.score;
    $('hDone').textContent = G.kind === 'level' ? (st.ok + st.late + st.wrong + st.crash) + '/' + st.total : Math.round(st.t) + 's';
    $('hDoneL').textContent = G.kind === 'level' ? 'kereta' : 'waktu';
  }
  // ---------- loop ----------
  var last = 0, DT = 1 / 60;
  function frame(ts) {
    var now = ts / 1000, dt = Math.min(0.05, last ? now - last : 0); last = now; ui.now = now;
    var g = cur();
    if (g && !(mode === 'play' && (paused || hold || overlay))) {
      acc += dt * (mode === 'play' ? speed : 1);
      while (acc >= DT) {
        acc -= DT;
        if (g !== G || mode !== 'play') { botT -= DT; if (botT <= 0) { botT = 0.3; WR.bot(g.st, 6).forEach(function (a) { WR.toggle(g.st, a); }); } }
        WR.step(g.st, DT); drain(g);
        if (g === G && mode === 'play') {
          tutTick(); if (hold) { acc = 0; break; }
          g.st.queue.forEach(function (q) { if (!q.ann && q[0] - g.st.t < 4) { q.ann = 1; SFX.bell(); } });
        }
        if (g.st.over && g !== G) { newDemo(g.lv); g = cur(); }
      }
      if (mode === 'play' && g === G && !g.st.over) {
        predT -= dt; if (predT <= 0) {
          predT = 0.2; var p = WR.predict(g.st, 5); ui.pred = p; ui.warn = {};
          if (p) { p.ids.forEach(function (id) { ui.warn[id] = 1; }); var key = p.ids.join('-'); if (!hornAt[key] || now - hornAt[key] > 3.5) { hornAt[key] = now; var tr = g.st.trains.filter(function (t) { return p.ids.indexOf(t.id) >= 0; }).sort(function (a, b) { return WR.SPEC[b.type].v - WR.SPEC[a.type].v; })[0]; SFX.horn(tr ? tr.type : 'krl'); } }
        }
      }
    } else if (!g) acc = 0;
    if (g && g === G && mode === 'play' && g.st.over) { ui.pred = null; ui.warn = {}; }
    if (mode === 'play') hud();
    var hp = mode === 'home' ? 0 : $('hud').offsetHeight; WRR.setPad(hp, mode === 'home' ? 0 : 6);
    WRR.draw(g ? g.st : null, ui);
    requestAnimationFrame(frame);
  }
  // ---------- wiring ----------
  on('playBtn', function () { start('level', nextLevel()); });
  on('dailyBtn', function () { start('daily', 7, WR.hash('whoosh|' + today())); });
  on('endlessBtn', function () { start('endless', 7, (Math.random() * 1e9) | 0); });
  on('lvBtn', levels); on('howBtn', function () { how(false); }); on('recBtn', function () { records(); });
  on('muteBtn', function () { setMute(!muted); }); on('hMute', function () { setMute(!muted); });
  on('backBtn', pause); on('pauseBtn', pause); on('speedBtn', toggleSpeed);
  $('ov').addEventListener('pointerdown', function (e) { if (e.target === $('ov') && !(G && mode === 'play')) closeOv(); });
  window.addEventListener('resize', function () { WRR.resize(); });
  document.addEventListener('visibilitychange', function () { if (document.hidden && mode === 'play' && G && !G.st.over && !overlay) pause(); });
  $('muteBtn').textContent = $('hMute').textContent = muted ? '🔇' : '🔊';
  WRR.resize();
  function route() {
    var h = location.hash.slice(1);
    if (h === 'demo') { // hub snapshot: busy corridor run by the bot with the HUD showing
      newDemo(7); G = demo; G.kind = 'demo'; mode = 'demo'; $('home').classList.add('hidden'); $('hud').classList.remove('hidden'); $('dim').classList.add('off'); document.documentElement.classList.add('jr-hub-off');
      $('hLevel').textContent = 'Koridor Halim–Tegalluar'; $('hPlace').textContent = 'Whoosh · KRL · Barang'; for (var i = 0; i < 900; i++) { if (i % 18 === 0) WR.bot(demo.st, 6).forEach(function (a) { WR.toggle(demo.st, a); }); WR.step(demo.st, DT); } demo.st.events.length = 0;
      hud = (function (orig) { return function () { var s = demo.st; $('hHearts').textContent = '❤️❤️❤️'.slice(0, s.hearts * 2) || '🖤'; $('hScore').textContent = s.score; $('hDone').textContent = Math.round(s.t) + 's'; $('hDoneL').textContent = 'waktu'; }; })(hud);
      mode = 'demo-play'; return;
    }
    var m = /^(L[1-8])$/.exec(h); if (h === 'tutorial') { tutDone = false; start('level', 0); return; }
    if (m) { start('level', LV.map(function (L) { return L.id; }).indexOf(m[1])); return; }
    setMode('home');
  }
  route();
  // demo route keeps the bot playing with the HUD on
  var _cur = cur; cur = function () { return mode === 'demo-play' ? demo : _cur(); };
  var _hudCall = function () { if (mode === 'demo-play') hud(); }; setInterval(_hudCall, 250);
  requestAnimationFrame(frame);
  window.__whoosh = { get G() { return G; }, get demo() { return demo; }, get mode() { return mode; }, start: start, act: act, ui: ui };
})();

// Kopi Senja - screens, ingredient taps, latte-art swipe, Web Audio synth, guided first shift, modes (Biasa / Rush Senja / Harian), records, #demo / #tutorial.
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); }, root = document.documentElement;
  var CFG = JSON.parse($('website-config').textContent), TX = CFG.text, LN = CFG.lines, R = window.KSR, GM = CFG.game;
  function t(k, v) { var s = TX[k] == null ? k : TX[k]; if (v) for (var n in v) s = s.split('{' + n + '}').join(v[n]); return s; }
  function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
  var store = {
    get: function (k, d) { try { var v = localStorage.getItem('kopisenja.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem('kopisenja.' + k, JSON.stringify(v)); } catch (e) {} }
  };
  document.querySelectorAll('[data-t]').forEach(function (el) { el.textContent = t(el.getAttribute('data-t')); });
  document.querySelectorAll('[data-t-aria]').forEach(function (el) { el.setAttribute('aria-label', t(el.getAttribute('data-t-aria'))); });
  document.querySelectorAll('[data-c]').forEach(function (el) { var k = el.getAttribute('data-c').split('.'), v = CFG; k.forEach(function (x) { v = v && v[x]; }); el.textContent = v || ''; });
  var DAY = KS.waDay(); $('harianSub').textContent = t('modeHarianSub', { date: DAY.split('-').reverse().join('/') });
  // ---------- sound (synth only) ----------
  var Snd = {
    ctx: null, muted: store.get('mute', 0) === 1,
    ensure: function () { if (!this.ctx) { var A = window.AudioContext || window.webkitAudioContext; if (A) try { this.ctx = new A(); } catch (e) {} } if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); },
    nbuf: function (sec) { var c = this.ctx, n = Math.max(1, Math.floor(c.sampleRate * sec)), b = c.createBuffer(1, n, c.sampleRate), d = b.getChannelData(0); for (var i = 0; i < n; i++) d[i] = Math.random() * 2 - 1; return b; },
    tone: function (f, dur, type, vol, when, to) {
      if (this.muted || !this.ctx) return; var c = this.ctx, t0 = c.currentTime + (when || 0), o = c.createOscillator(), g = c.createGain();
      o.type = type || 'sine'; o.frequency.setValueAtTime(f, t0); if (to) o.frequency.exponentialRampToValueAtTime(to, t0 + dur);
      g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol || 0.2, t0 + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(g); g.connect(c.destination); o.start(t0); o.stop(t0 + dur + 0.02);
    },
    noise: function (dur, vol, freq, type, when, to) {
      if (this.muted || !this.ctx) return; var c = this.ctx, t0 = c.currentTime + (when || 0), s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
      s.buffer = this.nbuf(dur); f.type = type || 'bandpass'; f.frequency.setValueAtTime(freq || 1500, t0); if (to) f.frequency.exponentialRampToValueAtTime(to, t0 + dur); g.gain.setValueAtTime(vol || 0.3, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      s.connect(f); f.connect(g); g.connect(c.destination); s.start(t0);
    },
    pour: function () { this.noise(0.45, 0.16, 500, 'bandpass', 0, 1400); this.tone(320, 0.3, 'sine', 0.04, 0.05, 520); },
    clink: function () { var s = this; [2400, 3100, 2700].forEach(function (f, i) { s.tone(f, 0.12, 'triangle', 0.07, i * 0.07); }); },
    hiss: function () { this.noise(0.6, 0.12, 4500, 'highpass'); },
    shot: function () { this.noise(0.25, 0.2, 180, 'lowpass'); this.pour(); },
    spoon: function () { this.noise(0.08, 0.12, 3000, 'highpass'); this.tone(1800, 0.06, 'triangle', 0.05); },
    wrong: function () { this.tone(180, 0.22, 'square', 0.08, 0, 120); this.tone(150, 0.22, 'square', 0.06, 0.08, 100); },
    bell: function () { this.tone(1568, 0.5, 'sine', 0.13); this.tone(2093, 0.7, 'sine', 0.08, 0.12); },
    kaching: function () { this.noise(0.05, 0.25, 6000, 'highpass'); this.tone(2637, 0.25, 'triangle', 0.12, 0.04); this.tone(3520, 0.4, 'triangle', 0.1, 0.12); },
    star: function (i) { this.tone(660 * Math.pow(1.122, i * 2), 0.22, 'triangle', 0.13); },
    fanfare: function () { var s = this; [523, 659, 784, 1047, 784, 1047].forEach(function (f, i) { s.tone(f, i > 3 ? 0.5 : 0.18, 'triangle', 0.13, i * 0.11); s.tone(f / 2, 0.2, 'square', 0.025, i * 0.11); }); },
    trombone: function () { var s = this; [392, 370, 349, 294].forEach(function (f, i) { s.tone(f, i === 3 ? 0.9 : 0.35, 'sawtooth', 0.06, i * 0.38, i === 3 ? 240 : f * 0.97); }); },
    blip: function () { this.tone(660, 0.06, 'triangle', 0.1); },
    draw: function () { this.noise(0.05, 0.05, 2200, 'bandpass'); }
  };
  var ingSnd = { es: 'clink', foam: 'hiss', shot: 'shot', gula: 'spoon', bubuk: 'spoon', matcha: 'spoon', coklat: 'pour', aren: 'pour', susu: 'pour', air: 'pour' };
  function syncMute() { ['muteBtn', 'homeMute'].forEach(function (id) { $(id).textContent = Snd.muted ? '🔇' : '🔊'; $(id).setAttribute('aria-label', t(Snd.muted ? 'unmute' : 'mute')); }); }
  function toggleMute() { Snd.muted = !Snd.muted; store.set('mute', Snd.muted ? 1 : 0); syncMute(); Snd.ensure(); Snd.blip(); }
  $('muteBtn').addEventListener('click', toggleMute); $('homeMute').addEventListener('click', toggleMute); syncMute();
  // ---------- name (placeholder only, never prefilled with the brand) ----------
  var nameIn = $('nameIn'), saved = store.get('name', '');
  if (saved && typeof saved === 'string') nameIn.value = saved;
  nameIn.addEventListener('input', function () { store.set('name', nameIn.value.trim().slice(0, 16)); });
  if (window.JDNG) window.JDNG.on(function (n) { if (n && !nameIn.value) { nameIn.value = n; store.set('name', n); } });
  function barista() { return nameIn.value.trim() || t('baristaDefault'); }
  // ---------- helpers ----------
  var lastToast = {};
  function toast(msg, cls) { var now = performance.now(); if (lastToast[msg] && now - lastToast[msg] < 900) return; lastToast[msg] = now; var box = $('toasts'), el = document.createElement('div'); el.className = 'toast ' + (cls || ''); el.textContent = msg; box.appendChild(el); while (box.children.length > 3) box.removeChild(box.firstChild); setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 1550); }
  function banner(msg) { var b = $('banner'); b.textContent = msg; b.hidden = false; b.style.animation = 'none'; void b.offsetWidth; b.style.animation = ''; clearTimeout(banner.tm); banner.tm = setTimeout(function () { b.hidden = true; }, 2400); }
  var bubbleT = 0;
  function say(msg, cls, sec) { var b = $('bubble'); b.textContent = msg; b.className = 'bubble ' + (cls || ''); b.hidden = false; b.style.animation = 'none'; void b.offsetWidth; b.style.animation = ''; bubbleT = sec || 2.6; placeBubble(); cust.talk = Math.min(1.2, msg.length * 0.04); }
  function placeBubble() { var b = $('bubble'), L = R.L, x = L.custX + 20 * L.k, y = L.counterY - 175 * L.k; var oc = $('orderCard').getBoundingClientRect(); b.style.left = Math.max(8, Math.min(window.innerWidth - b.offsetWidth - 8, x)) + 'px'; b.style.top = Math.max(oc.bottom + 6, y - b.offsetHeight) + 'px'; }
  function rp(n) { return t('rp') + '\u00a0' + String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }
  function ing(id) { return KS.ingById(CFG, id); }
  function show(id, on) { $(id).hidden = !on; }
  // ---------- state ----------
  var cv = $('cv'); R.init(cv, CFG);
  var mode = 'home', S = null, C = null, paused = false, tutStep = -1, fill = 1, cust = { c: 0, dx: 0.8, mood: 0, talk: 0 }, queue = [], phaseT = 0, flow = 'idle', flowT = 0, botT = 0, botR = Math.random, pourT = 0, pourCol = null, steamT = 0;
  var art = null, artT = 0, artMax = 6, shiftMode = 'biasa', prog = 0;
  function panelH() { var p = $('panel'); return p && !$('hud').hidden ? p.offsetHeight : 180; }
  function insets() { var oc = $('orderCard'), top = 150; if (!$('hud').hidden && oc) top = oc.getBoundingClientRect().bottom + 8; return { top: Math.max(120, top), bottom: Math.max(150, panelH()) }; }
  function resize() { R.layout(window.innerWidth, window.innerHeight, Math.min(2, window.devicePixelRatio || 1), insets()); root.style.setProperty('--panel', panelH() + 'px'); var oc = $('orderCard'); if (oc && !$('hud').hidden) { var ob = oc.getBoundingClientRect().bottom; if (ob > 0) root.style.setProperty('--rtop', Math.round(ob + 58) + 'px'); } }
  window.addEventListener('resize', resize);
  // ingredient buttons
  var ingBox = $('ings'), KEYS = '1234567890';
  CFG.ingredients.forEach(function (g, i) {
    var b = document.createElement('button'); b.type = 'button'; b.className = 'ing'; b.id = 'ing-' + g.id; b.setAttribute('data-ing', g.id); b.setAttribute('aria-label', g.name);
    b.innerHTML = '<span class="key" aria-hidden="true"></span><span class="e" aria-hidden="true"></span><span class="nm"></span>';
    b.querySelector('.key').textContent = KEYS[i] || ''; b.querySelector('.e').textContent = g.emoji; b.querySelector('.nm').textContent = g.name;
    b.addEventListener('click', function () { tap(g.id, b); }); ingBox.appendChild(b);
  });
  function flash(b, cls) { b.classList.remove('wrong', 'right'); void b.offsetWidth; b.classList.add(cls); clearTimeout(b._t); b._t = setTimeout(function () { b.classList.remove(cls); }, 380); }
  // ---------- order card ----------
  function renderOrder() {
    if (!C) return; var d = C.d, c = CFG.customers[C.o.cust];
    $('oWho').textContent = c.name + ' · ' + t('order');
    var nm = $('oName'); nm.textContent = d.name; if (d.art) { var s = document.createElement('span'); s.className = 'art-tag'; s.textContent = CFG.art[d.art].emoji + ' ' + CFG.art[d.art].name; nm.appendChild(s); }
    var ol = $('chips'); ol.innerHTML = '';
    d.steps.forEach(function (id, i) { var li = document.createElement('li'), g = ing(id); li.className = i < C.step ? 'done' : i === C.step && C.phase === 'mix' ? 'now' : ''; li.innerHTML = '<span class="n"><span></span></span><b></b>'; li.querySelector('.n span').textContent = i + 1; li.querySelector('b').textContent = g.emoji + ' ' + g.name; ol.appendChild(li); });
    if (d.art) { var li = document.createElement('li'); li.className = 'art' + (C.phase === 'art' ? ' now' : C.phase === 'done' || C.phase === 'served' ? ' done' : ''); li.innerHTML = '<span class="n"><span>✎</span></span><b></b>'; li.querySelector('b').textContent = CFG.art[d.art].emoji + ' Latte art'; ol.appendChild(li); }
    var cb = $('oCombo'); if (S && S.streak >= 2) { cb.hidden = false; cb.textContent = '🔥 ' + t('combo', { n: S.streak }); } else cb.hidden = true;
    hint();
  }
  function hint() { var want = C && C.phase === 'mix' ? KS.expect(C) : null; document.querySelectorAll('.ing').forEach(function (b) { b.classList.toggle('hint', mode === 'tut' && tutStep >= 1 && b.getAttribute('data-ing') === want); }); }
  function hud() {
    if (!S) return; $('clock').textContent = KS.fmtClock(KS.clock(S)); $('progNum').textContent = t('served', { n: Math.min(S.i + (C && flow !== 'leaving' ? 1 : 0), S.orders.length), m: S.orders.length }); $('money').textContent = rp(S.money);
  }
  // ---------- flow ----------
  function startShift(m, opts) {
    opts = opts || {}; shiftMode = m; Snd.ensure();
    var seed = m === 'harian' ? 'harian-' + DAY : opts.seed || (m + '-' + Date.now());
    S = KS.shift({ cfg: CFG, mode: m === 'tut' ? 'biasa' : m, seed: seed, drinks: m === 'tut' ? GM.tutorialDrinks : opts.drinks });
    mode = m === 'tut' ? 'tut' : opts.demo ? 'demo' : 'play'; R.rush = m === 'rush';
    DLGS.forEach(function (d) { show(d, false); }); show('home', false); show('hud', true); show('demoTag', mode === 'demo'); show('coach', false); show('artHud', false); root.classList.remove('art-on');
    root.classList.add('jr-hub-off'); paused = false; C = null; flow = 'idle'; flowT = 0.3; cust.dx = 0.8; prog = 0;
    $('receipt').hidden = true; $('bubble').hidden = true; resize(); hud();
    if (m === 'rush' && mode === 'play') setTimeout(function () { if (mode === 'play') banner(t('rushBanner')); }, 300);
    if (mode === 'tut') tutStep = 0;
    if (mode !== 'demo') location.hash = m === 'tut' ? '#tutorial' : '#main';
  }
  function nextCustomer() {
    C = KS.cup(S, mode === 'tut' ? 1e6 : 1); fill = 1; cust.c = C.o.cust; cust.dx = 0.8; cust.mood = 0.4; flow = 'enter'; flowT = 0;
    queue = []; for (var i = S.i + 1; i < Math.min(S.orders.length, S.i + 1 + S.M.queue); i++) queue.push(S.orders[i].cust);
    renderOrder(); var oc = $('orderCard'); oc.classList.remove('pop'); void oc.offsetWidth; oc.classList.add('pop'); hud(); Snd.bell();
    $('panel').classList.remove('locked');
    if (S.i === S.orders.length - 1 && S.orders.length > 2 && mode !== 'tut') toast(t('lastOrder'), 'gold');
    if (mode === 'tut') { if (C.d.id === 'latte') coach(3); else coach(0); }
    setTimeout(resize, 30);
  }
  function tap(id, btn) {
    if (paused || !C || C.phase !== 'mix' || flow !== 'play' || (mode === 'tut' && $('coach').classList.contains('needOk'))) return;
    Snd.ensure(); var res = KS.add(C, id); btn = btn || $('ing-' + id);
    if (res.ok) {
      flash(btn, 'right'); fill = 0; pourCol = R.dropColor(id); pourT = 0.4; (Snd[ingSnd[id]] || Snd.pour).call(Snd);
      if (id === 'foam' || id === 'air') steamT = 1.2;
      R.burst(R.L.cupX, R.L.cupY - 90 * R.L.k, 'drop', 5);
      if (mode === 'tut' && tutStep === 1) coach(2);
      renderOrder();
      if (res.done) { $('panel').classList.add('locked'); if (res.art) setTimeout(function () { if (C && C.phase === 'art') startArt(); }, 450); else setTimeout(function () { if (C && C.phase === 'done') serveCup(); }, 420); }
    } else if (!res.ignored) {
      flash(btn, 'wrong'); Snd.wrong(); R.shake(0.25); toast(t('wrong', { i: ing(res.expect).name }), 'bad'); cust.mood = -0.3; renderOrder();
    }
  }
  // ---------- latte art ----------
  var pen = { down: false, id: null };
  function startArt() {
    art = { kind: C.d.art, drink: C.d.id, strokes: [], pen: null }; artMax = mode === 'tut' ? 30 : S.M.artTime; artT = 0;
    show('artHud', true); root.classList.add('art-on'); $('artTitle').textContent = t('artTitle', { a: CFG.art[C.d.art].emoji + ' ' + CFG.art[C.d.art].name }); Snd.hiss();
    var hintEl = document.querySelector('#artHud small'); hintEl.textContent = mode === 'tut' ? t(CFG.tutorial[4].text) : t('artHint'); if (mode === 'tut') { tutStep = 4; show('coach', false); }
  }
  function artUnits(e) { var A = R.L.art; return [Math.max(-1.3, Math.min(1.3, (e.clientX - A.x) / A.r)), Math.max(-1.3, Math.min(1.3, (e.clientY - A.y) / A.r))]; }
  cv.addEventListener('pointerdown', function (e) { if (!art || paused || mode === 'demo') return; e.preventDefault(); pen.down = true; pen.id = e.pointerId; try { cv.setPointerCapture(e.pointerId); } catch (er) {} var u = artUnits(e); art.strokes.push([u]); art.pen = u; Snd.ensure(); });
  cv.addEventListener('pointermove', function (e) { if (!art || !pen.down || e.pointerId !== pen.id) return; var u = artUnits(e), s = art.strokes[art.strokes.length - 1], l = s[s.length - 1]; if (Math.hypot(u[0] - l[0], u[1] - l[1]) > 0.02) { s.push(u); if (s.length % 6 === 0) Snd.draw(); } art.pen = u; });
  function penUp(e) { if (!pen.down || (e && e.pointerId !== pen.id)) return; pen.down = false; if (art) art.pen = null; }
  cv.addEventListener('pointerup', penUp); cv.addEventListener('pointercancel', penUp);
  function finishArt(skip) {
    if (!art || !C) return; var sc;
    if (skip) { KS.skipArt(C); sc = 0; } else sc = KS.setArt(C, art.strokes);
    C.art = art.strokes; C.artDone = true; art = null; show('artHud', false); root.classList.remove('art-on'); pen.down = false;
    if (!skip) toast(sc >= GM.artGood ? CFG.art[C.d.art].emoji + ' ' + t('artGreat') : sc >= GM.artBad ? t('artOk') : t('artBad'), sc >= GM.artGood ? 'gold' : sc >= GM.artBad ? 'good' : 'bad');
    if (sc >= GM.artGood) { R.burst(R.L.cupX, R.L.cupY - 70 * R.L.k, 'star', 10); Snd.fanfare(); }
    if (mode === 'tut') show('coach', false);
    setTimeout(function () { if (C && C.phase === 'done') serveCup(); }, 350);
  }
  $('artDone').addEventListener('click', function () { finishArt(false); }); $('artSkip').addEventListener('click', function () { finishArt(true); });
  // ---------- serve / leave ----------
  function serveCup() {
    var r = KS.serve(S, C); if (!r) return; flow = 'served'; flowT = 0; C.artDone = true;
    cust.mood = r.stars >= 4 ? 1 : r.stars >= 3 ? 0.2 : -0.6;
    if (window.innerHeight >= 760) say(pick(r.stars >= 4 ? LN.happy.filter(function (l) { return !/latte art/i.test(l) || (C.d.art && C.artScore >= GM.artGood); }) : r.stars >= 3 ? LN.ok : LN.sad), r.stars >= 4 ? 'happy' : r.stars >= 3 ? '' : 'sad', 1.8);
    receipt(r); Snd.kaching(); for (var i = 0; i < r.stars; i++) (function (k) { setTimeout(function () { Snd.star(k); }, 160 + k * 110); })(i);
    R.burst(R.L.cupX, R.L.cupY - 60 * R.L.k, 'coin', 6 + r.stars * 2); if (r.stars === 5) R.burst(R.L.custX, R.L.counterY - 120 * R.L.k, 'star', 10);
    if (r.streak >= 2) toast('🔥 ' + t('combo', { n: r.streak }), 'gold');
    var m = $('money'); m.classList.remove('bump'); void m.offsetWidth; m.classList.add('bump'); hud(); renderOrder();
  }
  function receipt(r) {
    var el = $('receipt'); el.className = 'receipt' + (r.left ? ' bad' : ''); el.hidden = false; el.style.animation = 'none'; void el.offsetWidth; el.style.animation = '';
    var st = $('rStars'); st.innerHTML = ''; for (var i = 0; i < 5; i++) { var s = document.createElement('i'); s.textContent = '★'; if (i < r.stars) { s.className = 'on'; s.style.animationDelay = (0.12 + i * 0.1) + 's'; } st.appendChild(s); }
    $('rLine').textContent = r.left ? t('leave') : C.d.short + ' · ' + rp(r.price); $('rTip').textContent = r.left ? '' : r.tip ? '+ ' + t('tipLbl') + ' ' + rp(r.tip) + (r.combo > 1 ? '  (×' + r.combo.toFixed(1).replace('.', ',') + ')' : '') : '';
    clearTimeout(receipt.tm); receipt.tm = setTimeout(function () { el.hidden = true; }, 1900);
  }
  function leaveCup() {
    var r = KS.leave(S, C); if (!r) return; flow = 'served'; flowT = 0; cust.mood = -1; say(pick(LN.leave), 'sad', 1.6); receipt(r); Snd.trombone(); R.shake(0.3);
    $('panel').classList.add('locked'); if (art) { art = null; show('artHud', false); root.classList.remove('art-on'); } hud(); renderOrder();
  }
  // ---------- tutorial ----------
  function coach(i) {
    tutStep = i; var step = CFG.tutorial[i], el = $('coach'); if (!step) { show('coach', false); return; }
    $('coachTxt').textContent = t(step.text); var needOk = step.id === 'order' || step.id === 'latte'; el.classList.toggle('noOk', !needOk); el.classList.toggle('needOk', needOk); el.hidden = false; el.style.animation = 'none'; void el.offsetWidth; el.style.animation = ''; hint();
  }
  $('coachOk').addEventListener('click', function () { Snd.ensure(); Snd.blip(); if (tutStep === 0) coach(1); else if (tutStep === 3) { $('coach').classList.remove('needOk'); show('coach', false); tutStep = 3.5; } });
  $('skipTut').addEventListener('click', function () { store.set('tut', 1); show('coach', false); startShift('biasa'); });
  function tutDone() { store.set('tut', 1); show('hud', false); show('tutDlg', true); R.confetti(); Snd.fanfare(); }
  $('tutStart').addEventListener('click', function () { startShift('biasa'); });
  // ---------- end ----------
  var DLGS = ['pauseDlg', 'tutDlg', 'endDlg', 'recDlg'];
  function endShift() {
    var sum = KS.summary(S); if (mode === 'demo') { startShift('rush', { demo: true, seed: 'demo' + Date.now() }); return; }
    if (mode === 'tut') { tutDone(); return; }
    var out = KS.record(store.get('rec', {}), sum, DAY); store.set('rec', out.rec);
    mode = 'end'; show('hud', false); show('endDlg', true); root.classList.remove('jr-hub-off');
    $('endSub').textContent = t('endSub', { who: barista(), n: sum.served, s: String(sum.avg).replace('.', ',') }) + ' · ' + t(shiftMode === 'rush' ? 'modeRush' : shiftMode === 'harian' ? 'modeHarian' : 'modeBiasa');
    $('bestBadge').hidden = !out.isBest; $('eScore').textContent = sum.score; $('eMoney').textContent = rp(sum.money); $('eTips').textContent = rp(sum.tips); $('eCombo').textContent = '×' + sum.bestCombo;
    var list = $('cupList'); list.innerHTML = '';
    S.res.forEach(function (x, i) { var d = document.createElement('div'), a = document.createElement('span'), b = document.createElement('span'), dr = KS.drinkById(CFG, x.drink); d.style.animationDelay = (i * 0.06) + 's'; if (x.r.left) d.className = 'gone'; a.textContent = CFG.customers[x.cust].name + ' · ' + dr.short; b.textContent = x.r.left ? '😤 pergi' : '★'.repeat(x.r.stars) + (x.r.tip ? ' +' + rp(x.r.tip) : ''); d.appendChild(a); d.appendChild(b); list.appendChild(d); });
    if (sum.avg >= 4) { R.confetti(); Snd.fanfare(); } else if (sum.avg < 2.5) Snd.trombone(); else Snd.bell();
    location.hash = '#main'; stats();
  }
  $('againBtn').addEventListener('click', function () { startShift(shiftMode); });
  $('menuBtn').addEventListener('click', goHome);
  // ---------- pause / home / records ----------
  function setPause(on) { if (mode !== 'play' && mode !== 'tut') return; paused = on; show('pauseDlg', on); }
  $('pauseBtn').addEventListener('click', function () { setPause(true); }); $('resumeBtn').addEventListener('click', function () { setPause(false); });
  $('quitBtn').addEventListener('click', goHome);
  function goHome() { mode = 'home'; paused = false; art = null; DLGS.forEach(function (d) { show(d, false); }); show('hud', false); show('home', true); root.classList.remove('jr-hub-off', 'art-on'); show('artHud', false); idleScene(); location.hash = ''; stats(); resize(); }
  function stats() {
    var r = store.get('rec', {}), el = $('statStrip'); el.innerHTML = ''; if (!r.shifts) return; var b = r.best || {};
    [[t('best'), Math.max(b.biasa || 0, b.rush || 0, b.harian || 0)], [t('cups'), r.cups || 0]].concat(r.daily && r.daily[DAY] ? [[t('today'), r.daily[DAY]]] : []).forEach(function (p) { var s = document.createElement('span'); s.textContent = p[0] + ': ' + p[1]; el.appendChild(s); });
  }
  $('recBtn').addEventListener('click', function () {
    var r = store.get('rec', {}), b = r.best || {}, g = $('recGrid'); g.innerHTML = '';
    [[t('modeBiasa'), b.biasa || '–'], [t('modeRush'), b.rush || '–'], [t('today'), (r.daily || {})[DAY] || '–'], [t('shifts'), r.shifts || 0], [t('cups'), r.cups || 0], [t('endPerfect'), r.perfect || 0]].forEach(function (p) { var d = document.createElement('div'), s = document.createElement('small'), v = document.createElement('b'); s.textContent = p[0]; v.textContent = p[1]; d.appendChild(s); d.appendChild(v); g.appendChild(d); });
    show('recDlg', true);
  });
  $('recClose').addEventListener('click', function () { show('recDlg', false); });
  $('tutBtn').addEventListener('click', function () { startShift('tut'); });
  document.querySelectorAll('.mode').forEach(function (b) { b.addEventListener('click', function () { var m = b.getAttribute('data-mode'); if (!store.get('tut', 0)) startShift('tut'); else startShift(m); }); });
  // keyboard
  window.addEventListener('keydown', function (e) {
    if (e.target && e.target.tagName === 'INPUT') return;
    if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') { if (mode === 'play' || mode === 'tut') setPause(!paused); return; }
    if (e.key === 'm' || e.key === 'M') { toggleMute(); return; }
    if (art && (e.key === 'Enter')) { finishArt(false); return; }
    if (art && (e.key === ' ')) { e.preventDefault(); finishArt(true); return; }
    var i = KEYS.indexOf(e.key); if (i >= 0 && CFG.ingredients[i] && (mode === 'play' || mode === 'tut')) { var b = $('ing-' + CFG.ingredients[i].id); b.classList.add('press'); setTimeout(function () { b.classList.remove('press'); }, 90); tap(CFG.ingredients[i].id, b); }
  });
  document.addEventListener('visibilitychange', function () { if (document.hidden && (mode === 'play' || mode === 'tut') && !paused) setPause(true); });
  // ---------- idle home scene + demo bot ----------
  function idleScene() { S = KS.shift({ cfg: CFG, mode: 'biasa', seed: 'home' + Date.now() }); C = null; flow = 'idle'; flowT = 0.2; cust.dx = 0.8; }
  function botStep(dt) {
    if (!C) return; botT -= dt; if (botT > 0) return;
    if (C.phase === 'mix' && flow === 'play') { var w = KS.bot(C, botR, mode === 'home' ? 1 : 0.93); var res = KS.add(C, w); if (res.ok) { fill = 0; pourCol = R.dropColor(w); pourT = 0.4; if (w === 'foam' || w === 'air') steamT = 1; if (mode === 'demo') { renderOrder(); flash($('ing-' + w), 'right'); } } else if (mode === 'demo') { flash($('ing-' + w), 'wrong'); renderOrder(); } botT = 0.75; if (res.done && !res.art) botT = 0.4; }
    else if (C.phase === 'art') { C.art = KS.botArt(C.d.art, botR, 0.03); KS.setArt(C, C.art); C.artDone = true; botT = 0.5; }
    else if (C.phase === 'done' && flow === 'play') { if (mode === 'demo') serveCup(); else { KS.serve(S, C); flow = 'served'; flowT = 0; cust.mood = 1; } botT = 0.6; }
  }
  // ---------- loop ----------
  var last = performance.now();
  function loop(now) {
    var dt = Math.min(0.05, (now - last) / 1000); last = now; requestAnimationFrame(loop);
    if (!paused) step(dt);
    var st = { prog: prog, queue: queue, cust: C || flow === 'served' || flow === 'leaving' ? cust : null, C: C, showCup: !!C && flow !== 'leaving', fill: fill, pour: pourT > 0 ? pourCol : null, art: art };
    if (art) art.drink = C ? C.d.id : art.drink;
    R.steam = steamT; R.frame(st, paused ? 0 : dt);
  }
  function step(dt) {
    if (bubbleT > 0) { bubbleT -= dt; placeBubble(); if (bubbleT <= 0) $('bubble').hidden = true; }
    if (cust.talk > 0) cust.talk -= dt; if (pourT > 0) pourT -= dt; if (steamT > 0) steamT -= dt; if (fill < 1) fill = Math.min(1, fill + dt * 3);
    if (!S) return; var tgt = (S.i + (C && flow === 'play' ? KS.patFrac(C) * 0 + Math.min(1, C.time / C.pat) * 0.5 : 0)) / S.orders.length; prog += (tgt - prog) * Math.min(1, dt * 2);
    flowT += dt;
    if (flow === 'idle') { if (flowT > 0.3 && !S.done) { if (mode === 'home') { C = KS.cup(S, 1e6); cust.c = C.o.cust; cust.dx = 0.8; flow = 'enter'; flowT = 0; queue = [S.orders[(S.i + 1) % S.orders.length].cust, S.orders[(S.i + 2) % S.orders.length].cust]; } else nextCustomer(); } }
    else if (flow === 'enter') { cust.dx = Math.max(0, cust.dx - dt * 1.9); if (cust.dx <= 0) { flow = 'play'; flowT = 0; if (mode !== 'home') say(pick(LN.order).split('{d}').join(C.d.name), '', 2.4); } }
    else if (flow === 'play') {
      if (mode === 'home' || mode === 'demo') botStep(dt);
      if (mode === 'play' || mode === 'demo' || mode === 'tut') {
        if (art) { artT += dt; $('artBar').style.width = Math.max(0, 100 * (1 - artT / artMax)) + '%'; if (artT >= artMax) finishArt(art.strokes.length === 0); }
        var ev = KS.tick(C, dt), pf = KS.patFrac(C); $('patBar').style.width = (pf * 100) + '%'; $('patience').classList.toggle('low', pf < GM.lowPatience);
        if (C.phase === 'mix' && flowT > 0.5) cust.mood = pf > 0.6 ? 0.4 : pf > GM.lowPatience ? 0 : -0.7;
        if (ev === 'leave') leaveCup();
      }
    }
    else if (flow === 'served') { if (flowT > (mode === 'home' ? 1.2 : 1.6)) { flow = 'leaving'; flowT = 0; } }
    else if (flow === 'leaving') { cust.dx -= dt * 2.2; if (cust.dx < -0.9) { C = null; if (mode === 'home') { if (S.i >= S.orders.length || S.done) S = KS.shift({ cfg: CFG, mode: 'biasa', seed: 'home' + Date.now() }); flow = 'idle'; flowT = 0; } else if (S.done) { flow = 'end'; if (mode === 'tut') tutDone(); else endShift(); } else { flow = 'idle'; flowT = 0; } } }
  }
  // ---------- routes ----------
  function route() {
    var h = location.hash;
    if (h === '#demo') startShift('rush', { demo: true, seed: GM.demoSeed });
    else if (h === '#tutorial') startShift('tut');
    else if (mode !== 'home' && mode !== 'end' && h !== '#main') goHome();
  }
  window.addEventListener('hashchange', function () { var h = location.hash; if ((h === '#tutorial' && mode === 'tut') || (h === '#demo' && mode === 'demo') || h === '#main') return; route(); });
  resize(); idleScene(); stats();
  if (location.hash === '#demo' || location.hash === '#tutorial') route(); else if (location.hash) history.replaceState(null, '', location.pathname + location.search);
  requestAnimationFrame(loop);
  window.__ks = { get S() { return S; }, get C() { return C; }, get mode() { return mode; }, get flow() { return flow; }, get tutStep() { return tutStep; }, get art() { return art; }, get paused() { return paused; }, R: R, tap: tap, finishArt: finishArt, store: store, cust: cust };
})();

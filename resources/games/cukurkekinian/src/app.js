// Cukur Kekinian - screens, pointer input (scissors swipe / clipper rub), Web Audio synth, guided first customer, shift + records, #demo / #tutorial.
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); }, root = document.documentElement;
  var CFG = JSON.parse($('website-config').textContent), TX = CFG.text, LN = CFG.lines, R = window.CKR, GM = CFG.game;
  function t(k, v) { var s = TX[k] == null ? k : TX[k]; if (v) for (var n in v) s = s.split('{' + n + '}').join(v[n]); return s; }
  function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
  var store = {
    get: function (k, d) { try { var v = localStorage.getItem('cukurkekinian.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem('cukurkekinian.' + k, JSON.stringify(v)); } catch (e) {} }
  };
  document.querySelectorAll('[data-t]').forEach(function (el) { el.textContent = t(el.getAttribute('data-t')); });
  document.querySelectorAll('[data-t-aria]').forEach(function (el) { el.setAttribute('aria-label', t(el.getAttribute('data-t-aria'))); });
  document.querySelectorAll('[data-c]').forEach(function (el) { var k = el.getAttribute('data-c').split('.'), v = CFG; k.forEach(function (x) { v = v && v[x]; }); el.textContent = v || ''; });
  // ---------- sound (synth only) ----------
  var Snd = {
    ctx: null, muted: store.get('mute', 0) === 1, buzzG: null, buzzF: null,
    ensure: function () {
      if (!this.ctx) { var A = window.AudioContext || window.webkitAudioContext; if (A) try { this.ctx = new A(); this.motor(); } catch (e) {} }
      if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
    },
    nbuf: function (sec) { var c = this.ctx, n = Math.max(1, Math.floor(c.sampleRate * sec)), b = c.createBuffer(1, n, c.sampleRate), d = b.getChannelData(0); for (var i = 0; i < n; i++) d[i] = Math.random() * 2 - 1; return b; },
    motor: function () { // clipper motor: sawtooth hum with a fast wobble, gain follows the clipper
      var c = this.ctx, o = c.createOscillator(), o2 = c.createOscillator(), f = c.createBiquadFilter(), g = c.createGain(), lfo = c.createOscillator(), lg = c.createGain();
      o.type = 'sawtooth'; o.frequency.value = 118; o2.type = 'square'; o2.frequency.value = 236; f.type = 'lowpass'; f.frequency.value = 900; g.gain.value = 0;
      lfo.frequency.value = 38; lg.gain.value = 40; lfo.connect(lg); lg.connect(f.frequency);
      o.connect(f); o2.connect(f); f.connect(g); g.connect(c.destination); o.start(); o2.start(); lfo.start(); this.buzzG = g; this.buzzF = f;
    },
    buzz: function (on, cutting) { if (!this.buzzG) return; var n = this.ctx.currentTime, v = this.muted || !on ? 0 : cutting ? 0.075 : 0.035; this.buzzG.gain.setTargetAtTime(v, n, 0.03); this.buzzF.frequency.setTargetAtTime(cutting ? 1400 : 800, n, 0.05); },
    tone: function (f, dur, type, vol, when, to) {
      if (this.muted || !this.ctx) return; var c = this.ctx, t0 = c.currentTime + (when || 0), o = c.createOscillator(), g = c.createGain();
      o.type = type || 'sine'; o.frequency.setValueAtTime(f, t0); if (to) o.frequency.exponentialRampToValueAtTime(to, t0 + dur);
      g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol || 0.2, t0 + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(g); g.connect(c.destination); o.start(t0); o.stop(t0 + dur + 0.02);
    },
    noise: function (dur, vol, freq, type, when) {
      if (this.muted || !this.ctx) return; var c = this.ctx, t0 = c.currentTime + (when || 0), s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
      s.buffer = this.nbuf(dur); f.type = type || 'bandpass'; f.frequency.value = freq || 1500; g.gain.setValueAtTime(vol || 0.3, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      s.connect(f); f.connect(g); g.connect(c.destination); s.start(t0);
    },
    snip: function (n) { this.noise(0.05, 0.35, 6500, 'highpass'); this.tone(2600 + Math.random() * 600, 0.04, 'square', 0.05); if (n > 3) this.noise(0.05, 0.25, 5000, 'highpass', 0.05); },
    bell: function () { this.tone(1318, 0.6, 'sine', 0.16); this.tone(1046, 0.8, 'sine', 0.14, 0.16); },
    ouch: function () { this.tone(330, 0.25, 'square', 0.07, 0, 160); this.noise(0.15, 0.2, 300, 'lowpass'); },
    star: function (i) { this.tone(660 * Math.pow(1.122, i * 2), 0.25, 'triangle', 0.15); this.tone(1320 * Math.pow(1.122, i * 2), 0.18, 'sine', 0.06, 0.02); },
    fanfare: function () { var s = this; [523, 659, 784, 1047, 784, 1047].forEach(function (f, i) { s.tone(f, i > 3 ? 0.5 : 0.18, 'triangle', 0.14, i * 0.11); s.tone(f / 2, 0.2, 'square', 0.03, i * 0.11); }); },
    trombone: function () { var s = this; [392, 370, 349, 294].forEach(function (f, i) { s.tone(f, i === 3 ? 0.9 : 0.35, 'sawtooth', 0.07, i * 0.38, i === 3 ? 240 : f * 0.97); }); },
    tool: function () { this.noise(0.12, 0.12, 2500); this.tone(880, 0.05, 'triangle', 0.08); },
    tick: function () { this.tone(1500, 0.04, 'square', 0.04); },
    blip: function () { this.tone(660, 0.06, 'triangle', 0.12); },
    whoosh: function () { this.noise(0.4, 0.18, 900, 'bandpass'); }
  };
  function syncMute() { ['muteBtn', 'homeMute'].forEach(function (id) { $(id).textContent = Snd.muted ? '🔇' : '🔊'; $(id).setAttribute('aria-label', t(Snd.muted ? 'unmute' : 'mute')); }); }
  function toggleMute() { Snd.muted = !Snd.muted; store.set('mute', Snd.muted ? 1 : 0); syncMute(); Snd.ensure(); Snd.buzz(false); Snd.blip(); }
  $('muteBtn').addEventListener('click', toggleMute); $('homeMute').addEventListener('click', toggleMute); syncMute();
  // ---------- name (placeholder only, never prefilled with the brand) ----------
  var nameIn = $('nameIn'), saved = store.get('name', '');
  if (saved && typeof saved === 'string') nameIn.value = saved;
  nameIn.addEventListener('input', function () { store.set('name', nameIn.value.trim().slice(0, 16)); });
  function barber() { return nameIn.value.trim() || t('barberDefault'); }
  // ---------- toasts / banner / bubble ----------
  var lastToast = {};
  function toast(msg, cls) { var now = performance.now(); if (lastToast[msg] && now - lastToast[msg] < 1200) return; lastToast[msg] = now; var box = $('toasts'), el = document.createElement('div'); el.className = 'toast ' + (cls || ''); el.textContent = msg; box.appendChild(el); while (box.children.length > 3) box.removeChild(box.firstChild); setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 1550); }
  function banner(msg) { var b = $('banner'); b.textContent = msg; b.hidden = false; b.style.animation = 'none'; void b.offsetWidth; b.style.animation = ''; clearTimeout(banner.tm); banner.tm = setTimeout(function () { b.hidden = true; }, 2400); }
  var bubbleT = 0;
  function say(msg, cls, sec) { var b = $('bubble'); b.textContent = msg; b.className = 'bubble ' + (cls || ''); b.hidden = false; b.style.animation = 'none'; void b.offsetWidth; b.style.animation = ''; bubbleT = sec || 2.4; placeBubble(); }
  function placeBubble() { var b = $('bubble'), Lr = R.L; b.style.left = Math.max(8, Math.min(window.innerWidth - b.offsetWidth - 8, Lr.cx + Lr.k * 0.55)) + 'px'; b.style.top = Math.max(Lr.top + 8, Lr.cy + Lr.k * 0.1 - b.offsetHeight - 14) + 'px'; }
  // ---------- state ----------
  var cv = $('cv'); R.init(cv, CFG);
  var mode = 'home', S = null, who = null, paused = false, tutStep = -1, SH = null, ui = { mood: 0, react: '', reactT: 0, enter: 1, guide: true, pct: 0, sweat: false, who: null };
  var tool = 'scissors', guard = 1, ptr = { down: false, x: 0, y: 0, lx: 0, ly: 0, id: null, on: false }, botT = 0, hurried = false, lastTick = 0;
  function insets() { var w = window.innerWidth; return { top: w >= 700 ? 150 : 138, bottom: window.innerHeight < 620 ? 150 : 170 }; }
  function resize() { R.layout(window.innerWidth, window.innerHeight, Math.min(2, window.devicePixelRatio || 1), insets()); }
  window.addEventListener('resize', resize); resize();
  function show(id, on) { $(id).hidden = !on; }
  var DLGS = ['pauseDlg', 'resDlg', 'tutDlg', 'endDlg', 'recDlg'];
  function rp(n) { return t('rp') + '\u00a0' + String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }
  function stats() {
    var r = store.get('rec', {}), el = $('statStrip'); el.innerHTML = '';
    if (!r.shifts) return; [[t('best'), (r.best || 0) + '★'], [t('bestTip'), rp(r.bestTip || 0)], [t('shifts'), r.shifts || 0]].forEach(function (p) { var s = document.createElement('span'); s.textContent = p[0] + ': ' + p[1]; el.appendChild(s); });
  }
  // guard chips
  GM.guards.forEach(function (g, i) { var b = document.createElement('button'); b.type = 'button'; b.className = 'guard'; b.id = 'guard' + i; b.innerHTML = '<span></span><small></small>'; b.firstChild.textContent = GM.guardLabels[i]; b.lastChild.textContent = Math.round(g * 10) + 'mm'; b.addEventListener('click', function () { setGuard(i); }); $('guards').appendChild(b); });
  function setTool(tl, quiet) { tool = tl; if (S) S.tool = tl; $('toolScissors').classList.toggle('on', tl === 'scissors'); $('toolClipper').classList.toggle('on', tl === 'clipper'); $('guards').classList.toggle('off', tl !== 'clipper'); if (!quiet) Snd.tool(); if (tl !== 'clipper') Snd.buzz(false); }
  function setGuard(i) { guard = i; if (S) S.guard = i; for (var j = 0; j < GM.guards.length; j++) $('guard' + j).classList.toggle('on', j === i); Snd.blip(); }
  $('toolScissors').addEventListener('click', function () { setTool('scissors'); });
  $('toolClipper').addEventListener('click', function () { setTool('clipper'); });
  $('finishBtn').addEventListener('click', function () { if ((mode === 'play' || mode === 'tut') && S && !S.done && !paused) { if (mode === 'tut' && tutStep < 3) return toast(CFG.tutorial[tutStep].text); CK.finish(S); } });
  // ---------- flow ----------
  function newCustomer(style, w, seed, limit) {
    R.clear(); who = w; ui.who = w; S = CK.create({ cfg: CFG, style: style, seed: seed, limit: limit }); S.guard = guard; S.tool = tool;
    ui.enter = 0; ui.mood = 0.2; ui.react = ''; hurried = false; ptr.down = false;
    $('whoName').textContent = '🧔 ' + w.name; $('styleName').textContent = S.style.emoji + ' ' + S.style.name; $('styleDesc').textContent = S.style.desc;
    R.drawCard($('cardCv'), S.style, w); var ph = $('photo'); ph.classList.remove('pop'); void ph.offsetWidth; ph.classList.add('pop');
    ['tk1', 'tk2', 'tk3', 'tk4'].forEach(function (id, i) { $(id).style.left = GM.starAt[i] + '%'; });
    $('patience').hidden = !S.limit; $('bubble').hidden = true;
  }
  function enterHud() { show('home', false); show('hud', true); root.classList.add('jr-hub-off'); DLGS.forEach(function (d) { show(d, false); }); $('demoTag').hidden = mode !== 'demo'; $('coach').hidden = mode !== 'tut'; setTool(tool, true); setGuard(guard); }
  function goHome() {
    mode = 'home'; paused = false; Snd.buzz(false); SH = null; R.setCursor(null);
    var st = CFG.styles[Math.floor(Math.random() * CFG.styles.length)]; newCustomer(st.id, pick(CFG.customers), 'home' + Date.now(), 0); ui.enter = 1;
    show('home', true); show('hud', false); DLGS.forEach(function (d) { show(d, false); }); root.classList.remove('jr-hub-off'); stats();
    if (location.hash) history.replaceState(null, '', location.pathname + location.search);
  }
  function startShift() {
    Snd.ensure(); mode = 'play'; paused = false; SH = { list: CK.shift(CFG, 'shift' + Date.now()), idx: -1, res: [] }; tool = 'scissors'; guard = 1; enterHud(); nextCustomer();
  }
  function nextCustomer() {
    SH.idx++; var cu = SH.list[SH.idx]; newCustomer(cu.style, cu.who, cu.seed, GM.patience); show('resDlg', false); paused = false;
    $('custNum').textContent = (SH.idx + 1) + '/' + SH.list.length; banner(t('fArrive', { n: SH.idx + 1, t: SH.list.length, name: cu.who.name })); Snd.bell(); setTimeout(function () { if (S && !S.done) say(pick(LN.arrive)); }, 700);
  }
  function startTut() {
    Snd.ensure(); mode = 'tut'; paused = false; SH = { list: [{ style: GM.tutorialStyle, who: CFG.customers[0] }], idx: 0, res: [] }; tool = 'scissors'; guard = 1; enterHud();
    newCustomer(GM.tutorialStyle, CFG.customers[0], 'tutor', 0); $('custNum').textContent = '🎓'; tutStep = 0; coach(); Snd.bell(); say(LN.arrive[0]);
  }
  function startDemo() {
    mode = 'demo'; paused = false; SH = { list: [], idx: 0, res: [] }; tool = 'scissors'; guard = 2; enterHud();
    newCustomer('mullet', CFG.customers[1], CFG.game.demoSeed, 0); ui.enter = 1; $('custNum').textContent = '2/5';
    // snapshot staging: sides already clipped, nape still being shaped, a few locks falling
    for (var i = 0; i < 150; i++) CK.bot(S, 0.05); S.strands.forEach(function (sd) { sd.hit = 0; }); CK.events(S); S.strands.forEach(function (sd) { if (sd.z === 'top' && Math.abs(sd.th) < 25) sd.L = Math.max(sd.L, sd.T + 0.9); });
    ui.mood = 0.6; say(LN.arrive[2], '', 99);
  }
  function coach() {
    var st = CFG.tutorial[tutStep]; if (!st) return; $('coachTxt').textContent = st.text; $('coachSub').textContent = st.sub; $('coach').hidden = false; $('coachOk').hidden = st.id !== 'photo';
    var cb = $('coach'); cb.style.animation = 'none'; void cb.offsetWidth; cb.style.animation = '';
    ['photo', 'toolScissors', 'toolClipper', 'guard1', 'finishBtn'].forEach(function (id) { $(id).classList.remove('pulse'); });
    if (st.id === 'photo') $('photo').classList.add('pulse'); if (st.id === 'scissors') { setTool('scissors', true); $('toolScissors').classList.add('pulse'); }
    if (st.id === 'clipper') { $('toolClipper').classList.add('pulse'); } if (st.id === 'finish') $('finishBtn').classList.add('pulse');
  }
  function tutNext() { tutStep++; Snd.blip(); coach(); }
  function tutCheck() {
    if (mode !== 'tut' || !S || S.done) return; var id = CFG.tutorial[tutStep] && CFG.tutorial[tutStep].id;
    if (id === 'scissors' && CK.zoneMatch(S, 'top') >= 0.6) { toast('✂️ Mantap!', 'good'); tutNext(); }
    else if (id === 'clipper') { $('guard1').classList.toggle('pulse', tool === 'clipper' && guard !== 1); $('toolClipper').classList.toggle('pulse', tool !== 'clipper'); if (CK.zoneMatch(S, 'side') >= 0.6) { toast('🪒 Rapi!', 'good'); tutNext(); } }
  }
  $('coachOk').addEventListener('click', function () { if (mode === 'tut' && tutStep === 0) tutNext(); });
  $('skipTut').addEventListener('click', function () { store.set('tut', 1); startShift(); });
  // ---------- result ----------
  function showResult(r) {
    Snd.buzz(false); ptr.down = false; R.setCursor(null); R.flash(); $('coach').hidden = true;
    var good = r.stars >= 4, bad = r.stars <= 2; ui.react = ''; ui.mood = good ? 1 : bad ? -0.8 : 0.4;
    SH.res.push({ name: who.name, style: S.style, r: r });
    var dl = $('resDlg'); dl.classList.toggle('great', good); dl.classList.toggle('bad', bad);
    $('resEmoji').textContent = ['😭', '😕', '🙂', '😎', '🤩'][r.react]; $('resTitle').textContent = t('resultTitle', { name: who.name.split(' ')[0] });
    $('resQuote').textContent = '“' + pick(LN.react[r.react]) + '”'; $('rPct').textContent = r.pct + '%'; $('rTip').textContent = rp(r.tip); $('rLeft').textContent = S.limit ? Math.ceil(r.left) + 's' : '–';
    var sb = $('resStars'); sb.innerHTML = ''; sb.setAttribute('aria-label', r.stars + ' / 5'); for (var i = 0; i < 5; i++) { var s = document.createElement('i'); s.textContent = '★'; sb.appendChild(s); }
    var last = mode === 'tut' || SH.idx >= SH.list.length - 1; $('nextBtn').textContent = mode === 'tut' ? t('tutStart') : last ? t('toEnd') : t('next');
    setTimeout(function () {
      show('resDlg', true);
      for (var j = 0; j < 5; j++) (function (j) { setTimeout(function () { sb.children[j].className = j < r.stars ? 'on' : 'off'; if (j < r.stars) Snd.star(j); }, 250 + j * 220); })(j);
      setTimeout(function () { if (good) { R.confetti(r.stars === 5 ? 200 : 110); R.sparkle(); Snd.fanfare(); } else if (bad) Snd.trombone(); else Snd.bell(); }, 300 + r.stars * 220);
    }, 450);
  }
  $('nextBtn').addEventListener('click', function () {
    if (mode === 'tut') { store.set('tut', 1); show('resDlg', false); show('tutDlg', true); return; }
    if (SH.idx >= SH.list.length - 1) return endShift(); nextCustomer();
  });
  $('tutStart').addEventListener('click', startShift);
  function endShift() {
    show('resDlg', false); var tot = 0, tips = 0, perf = 0, cl = $('custList'); cl.innerHTML = '';
    SH.res.forEach(function (x) { tot += x.r.stars; tips += x.r.tip; if (x.r.stars === 5) perf++; var d = document.createElement('div'), a = document.createElement('span'), b = document.createElement('span'); a.textContent = x.style.emoji + ' ' + x.name + ' · ' + x.style.name; b.textContent = '★'.repeat(x.r.stars) + '☆'.repeat(5 - x.r.stars); d.appendChild(a); d.appendChild(b); cl.appendChild(d); });
    var rec = CK.record(store.get('rec', {}), { stars: tot, tips: tips, perfects: perf }); var nb = rec.newBest; delete rec.newBest; store.set('rec', rec);
    $('eStars').textContent = tot + '/' + SH.list.length * 5; $('eTips').textContent = rp(tips); $('ePerf').textContent = perf; $('bestBadge').hidden = !nb; $('endSub').textContent = t('endSub', { name: barber() });
    show('endDlg', true); if (nb || tot >= SH.list.length * 4) { R.confetti(160); Snd.fanfare(); } else Snd.bell(); mode = 'end';
  }
  $('againBtn').addEventListener('click', startShift); $('menuBtn').addEventListener('click', goHome);
  $('playBtn').addEventListener('click', function () { if (CK.needTut(store.get('tut', 0))) startTut(); else startShift(); });
  $('tutBtn').addEventListener('click', startTut);
  $('recBtn').addEventListener('click', function () {
    var r = store.get('rec', {}), g = $('recGrid'); g.innerHTML = '';
    if (!r.shifts) { var p = document.createElement('p'); p.className = 'muted'; p.textContent = t('recEmpty'); g.appendChild(p); }
    else [[t('best'), (r.best || 0) + '★'], [t('bestTip'), rp(r.bestTip || 0)], [t('shifts'), r.shifts], [t('perfects'), r.perfects || 0]].forEach(function (x) { var d = document.createElement('div'), s = document.createElement('small'), b = document.createElement('b'); s.textContent = x[0]; b.textContent = x[1]; d.appendChild(s); d.appendChild(b); g.appendChild(d); });
    show('recDlg', true);
  });
  $('recClose').addEventListener('click', function () { show('recDlg', false); });
  $('pauseBtn').addEventListener('click', function () { if (mode === 'play' || mode === 'tut') { paused = true; Snd.buzz(false); ptr.down = false; show('pauseDlg', true); } });
  $('resumeBtn').addEventListener('click', function () { paused = false; show('pauseDlg', false); });
  $('quitBtn').addEventListener('click', goHome);
  // ---------- pointer: scissors swipe / clipper rub ----------
  function active() { return (mode === 'play' || mode === 'tut') && S && !S.done && !paused && (mode !== 'tut' || tutStep > 0); }
  function cur(e) { var h = R.toHead(e.clientX, e.clientY); return { px: e.clientX, py: e.clientY, x: h.x, y: h.y }; }
  cv.addEventListener('pointerdown', function (e) {
    Snd.ensure(); if (mode === 'tut' && tutStep === 0) { tutNext(); return; } if (!active()) return;
    var p = cur(e); ptr.down = true; ptr.id = e.pointerId; ptr.x = p.x; ptr.y = p.y; ptr.lx = p.x; ptr.ly = p.y; ptr.px = p.px; ptr.py = p.py; ptr.on = true; try { cv.setPointerCapture(e.pointerId); } catch (er) {}
    if (tool === 'scissors') R.addTrail(p.px, p.py); e.preventDefault();
  });
  cv.addEventListener('pointermove', function (e) {
    var p = cur(e); ptr.px = p.px; ptr.py = p.py; ptr.on = true; ptr.x = p.x; ptr.y = p.y; if (!ptr.down || !active() || e.pointerId !== ptr.id) return;
    if (tool === 'scissors') {
      R.addTrail(p.px, p.py); var n = CK.snip(S, ptr.lx, ptr.ly, p.x, p.y); ptr.lx = p.x; ptr.ly = p.y; if (n) { Snd.snip(n); ptr.snap = 0.12; }
    }
  });
  function up(e) { if (e && e.pointerId !== ptr.id) return; ptr.down = false; Snd.buzz(tool === 'clipper' && false); if (e && e.pointerType !== 'mouse') ptr.on = false; }
  cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up); cv.addEventListener('pointerleave', function (e) { if (e.pointerType === 'mouse') ptr.on = false; });
  window.addEventListener('keydown', function (e) { if (!(mode === 'play' || mode === 'tut')) return; if (e.key === '1' || e.key === 's') setTool('scissors'); if (e.key === '2' || e.key === 'c') setTool('clipper'); if (e.key === 'Enter') $('finishBtn').click(); });
  // ---------- events -> fx / sound / mood ----------
  function handle(ev) {
    var play = mode === 'play' || mode === 'tut';
    ev.forEach(function (e) {
      R.event(S, e, who);
      if (!play) return;
      if (e.e === 'over') { ui.react = 'shock'; ui.reactT = 1.2; Snd.ouch(); say(pick(LN.ouch), 'ouch', 1.4); toast(t('fOver'), 'bad'); if (navigator.vibrate) try { navigator.vibrate(40); } catch (er) {} }
      if (e.e === 'timeout') toast(t('fTimeout'), 'bad');
      if (e.e === 'finish') showResult(e.r);
    });
  }
  function hud() {
    var pct = CK.match(S); ui.pct = pct; $('matchNum').textContent = pct + '%'; $('matchBar').style.width = pct + '%';
    var st = pct > 0 ? CK.stars(CFG, pct) : 0, ms = $('mStars'); if (ms.dataset.n !== String(st)) { ms.dataset.n = st; ms.innerHTML = '★'.repeat(st) + '<span class="dim">' + '★'.repeat(5 - st) + '</span>'; }
    if (S.limit) { var left = Math.max(0, S.limit - S.time); $('patBar').style.width = (100 * left / S.limit) + '%'; $('patNum').textContent = Math.ceil(left) + 's'; $('patience').classList.toggle('low', left < 15);
      if (left < 15 && !hurried && mode === 'play') { hurried = true; toast(t('fHurry'), 'bad'); say(pick(LN.hurry), '', 2); }
      if (left < 10 && Math.ceil(left) !== lastTick && mode === 'play') { lastTick = Math.ceil(left); Snd.tick(); } ui.sweat = left < 15; } else ui.sweat = false;
  }
  // ---------- loop ----------
  var last = performance.now();
  function frame(now) {
    var dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (S) {
      if (ui.enter < 1) ui.enter = Math.min(1, ui.enter + dt * 2.5);
      if (!active()) S.strands.forEach(function (sd) { if (sd.hit) sd.hit = Math.max(0, sd.hit - dt * 3); });
      var cutting = false;
      if (active()) {
        CK.step(S, dt);
        if (tool === 'clipper' && ptr.down) cutting = CK.clip(S, ptr.x, ptr.y, dt) > 0;
        Snd.buzz(tool === 'clipper' && ptr.down, cutting);
        tutCheck();
      } else if (mode === 'home' || mode === 'demo') {
        botT += dt; var spd = mode === 'demo' ? 0.16 : 0.1; if (botT > spd) { botT = 0; var a = CK.bot(S, 0.05); if (a) { R.setCursor({ tool: a.tool, x: R.L.cx + a.x * R.L.k, y: R.L.cy + a.y * R.L.k, down: true, scalp: true, snap: a.tool === 'scissors' ? 0.1 : 0 }); } else if (mode === 'home') { var st = CFG.styles[Math.floor(Math.random() * CFG.styles.length)]; newCustomer(st.id, pick(CFG.customers), 'home' + now, 0); } }
        if (mode === 'demo' && S.strands.every(function (sd) { return sd.L - sd.T < 0.13; })) { newCustomer('mullet', CFG.customers[1], CFG.game.demoSeed + now, 0); ui.enter = 1; }
      }
      handle(CK.events(S));
      if (mode === 'play' || mode === 'tut' || mode === 'demo') { if (!S.done) hud(); }
      if (mode !== 'home' && mode !== 'demo') R.setCursor(ptr.on && active() ? { tool: tool, x: ptr.px, y: ptr.py, down: ptr.down, scalp: CK.onScalp(ptr.x, ptr.y), snap: ptr.snap || 0 } : null);
      if (ptr.snap > 0) ptr.snap -= dt;
      if (ui.reactT > 0) { ui.reactT -= dt; if (ui.reactT <= 0) ui.react = ''; }
      if (!S.done && mode !== 'home' && mode !== 'demo') { var target = ui.pct < 10 ? 0.1 : Math.max(-1, Math.min(1, (ui.pct - 35) / 45)); ui.mood += (target - ui.mood) * Math.min(1, dt * 2); }
      if (bubbleT > 0) { bubbleT -= dt; placeBubble(); if (bubbleT <= 0) $('bubble').hidden = true; }
    }
    R.draw(S, ui, dt);
    requestAnimationFrame(frame);
  }
  // ---------- routes ----------
  function route() { var h = location.hash; if (h === '#demo') startDemo(); else if (h === '#tutorial') startTut(); else goHome(); }
  window.addEventListener('hashchange', route);
  document.addEventListener('visibilitychange', function () { if (document.hidden && (mode === 'play' || mode === 'tut') && S && !S.done && !paused) { paused = true; Snd.buzz(false); show('pauseDlg', true); } });
  route(); requestAnimationFrame(frame);
  window.__ck = { get mode() { return mode; }, get S() { return S; }, get tutStep() { return tutStep; }, get SH() { return SH; }, get tool() { return tool; }, get guard() { return guard; }, get paused() { return paused; }, R: R, store: store };
})();

// Pawang Hujan - screens, touch/mouse input, Web Audio synth, guided first round, records, #demo / #tutorial.
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); }, root = document.documentElement;
  var CFG = JSON.parse($('website-config').textContent), TX = CFG.text, R = window.PHR;
  function t(k, v) { var s = TX[k] == null ? k : TX[k]; if (v) for (var n in v) s = s.split('{' + n + '}').join(v[n]); return s; }
  var store = {
    get: function (k, d) { try { var v = localStorage.getItem('pawanghujan.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem('pawanghujan.' + k, JSON.stringify(v)); } catch (e) {} }
  };
  document.querySelectorAll('[data-t]').forEach(function (el) { el.textContent = t(el.getAttribute('data-t')); });
  document.querySelectorAll('[data-t-aria]').forEach(function (el) { el.setAttribute('aria-label', t(el.getAttribute('data-t-aria'))); });
  document.querySelectorAll('[data-c]').forEach(function (el) { var k = el.getAttribute('data-c').split('.'), v = CFG; k.forEach(function (x) { v = v && v[x]; }); el.textContent = v || ''; });
  // ---------- sound (synth only) ----------
  var Snd = {
    ctx: null, muted: store.get('mute', 0) === 1, rainG: null, fireG: null, holdO: null,
    ensure: function () {
      if (!this.ctx) { var A = window.AudioContext || window.webkitAudioContext; if (A) try { this.ctx = new A(); this.beds(); } catch (e) {} }
      if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
    },
    nbuf: function (sec) { var c = this.ctx, n = Math.floor(c.sampleRate * sec), b = c.createBuffer(1, n, c.sampleRate), d = b.getChannelData(0); for (var i = 0; i < n; i++) d[i] = Math.random() * 2 - 1; return b; },
    beds: function () { // looping rain hiss + fire crackle bed, gains follow the game
      var c = this.ctx, self = this;
      [['rainG', 'highpass', 900, 0.5], ['fireG', 'bandpass', 500, 2]].forEach(function (o) { var s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain(); s.buffer = self.nbuf(2); s.loop = true; f.type = o[1]; f.frequency.value = o[2]; f.Q.value = o[3]; g.gain.value = 0; s.connect(f); f.connect(g); g.connect(c.destination); s.start(); self[o[0]] = g; });
    },
    bed: function (rain, fire) { if (!this.ctx || !this.rainG) return; var n = this.ctx.currentTime, m = this.muted ? 0 : 1; this.rainG.gain.setTargetAtTime(m * Math.min(0.22, rain * 0.07), n, 0.3); this.fireG.gain.setTargetAtTime(m * Math.min(0.12, fire * 0.03), n, 0.4); },
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
    bowl: function (f) { var s = this; [1, 2.71, 5.1].forEach(function (h, i) { s.tone(f * h, 2.4 - i * 0.6, 'sine', 0.16 / (i + 1)); }); },
    holdStart: function () { if (this.muted || !this.ctx) return; var c = this.ctx, o = c.createOscillator(), g = c.createGain(); o.type = 'sine'; o.frequency.value = 220; g.gain.value = 0.0001; g.gain.exponentialRampToValueAtTime(0.08, c.currentTime + 0.2); o.connect(g); g.connect(c.destination); o.start(); this.holdO = { o: o, g: g }; },
    holdSet: function (ch) { if (this.holdO) this.holdO.o.frequency.setTargetAtTime(220 + ch * 300, this.ctx.currentTime, 0.05); },
    holdStop: function () { if (!this.holdO) return; var h = this.holdO, n = this.ctx.currentTime; h.g.gain.cancelScheduledValues(n); h.g.gain.setTargetAtTime(0.0001, n, 0.05); h.o.stop(n + 0.3); this.holdO = null; },
    thunder: function () { this.noise(0.08, 0.5, 3000, 'highpass'); this.noise(1.6, 0.55, 120, 'lowpass', 0.05); this.tone(55, 1.2, 'sawtooth', 0.08, 0.05, 30); },
    sizzle: function () { this.noise(0.5, 0.22, 5000, 'highpass'); this.tone(1200, 0.25, 'sine', 0.05, 0, 400); },
    perfect: function () { var s = this; [523, 659, 784, 1047].forEach(function (f, i) { s.tone(f, 0.5, 'triangle', 0.14, i * 0.07); }); s.bowl(392); },
    ok: function () { this.bowl(330); },
    spill: function () { this.tone(300, 0.35, 'square', 0.06, 0, 120); this.noise(0.3, 0.2, 800); },
    rainbow: function () { var s = this; [523, 587, 659, 784, 880, 1047, 1175].forEach(function (f, i) { s.tone(f, 0.35, 'sine', 0.12, i * 0.06); }); },
    merge: function () { this.noise(0.4, 0.2, 400, 'lowpass'); this.tone(180, 0.3, 'sine', 0.1, 0, 260); },
    ignite: function () { this.noise(0.25, 0.18, 700); },
    warn: function () { this.tone(440, 0.18, 'square', 0.05); this.tone(330, 0.25, 'square', 0.05, 0.2); },
    blip: function () { this.tone(660, 0.06, 'triangle', 0.12); },
    lose: function () { var s = this; [392, 349, 311, 262].forEach(function (f, i) { s.tone(f, 0.4, 'triangle', 0.12, i * 0.18); }); }
  };
  function syncMute() { $('muteBtn').textContent = Snd.muted ? '🔇' : '🔊'; $('muteBtn').setAttribute('aria-label', t(Snd.muted ? 'unmute' : 'mute')); }
  $('muteBtn').addEventListener('click', function () { Snd.muted = !Snd.muted; store.set('mute', Snd.muted ? 1 : 0); syncMute(); Snd.ensure(); if (Snd.muted) Snd.holdStop(); Snd.blip(); });
  syncMute();
  // ---------- name (placeholder only, never prefilled with the brand) ----------
  var nameIn = $('nameIn'), saved = store.get('name', '');
  if (saved && typeof saved === 'string') nameIn.value = saved;
  nameIn.addEventListener('input', function () { store.set('name', nameIn.value.trim().slice(0, 16)); });
  function pawang() { var v = nameIn.value.trim(); return v || t('pawangDefault'); }
  // ---------- toasts ----------
  var lastToast = {};
  function toast(msg, cls) { var now = performance.now(); if (lastToast[msg] && now - lastToast[msg] < 1200) return; lastToast[msg] = now; var box = $('toasts'), el = document.createElement('div'); el.className = 'toast ' + (cls || ''); el.textContent = msg; box.appendChild(el); while (box.children.length > 3) box.removeChild(box.firstChild); setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 1550); }
  var bannerT = 0; function banner(msg, sec) { var b = $('banner'); b.textContent = msg; b.hidden = false; bannerT = sec || 2.5; }
  // ---------- state ----------
  var cv = $('cv'); R.init(cv, CFG);
  var botSpeed = 0.7, mode = 'home', S = null, paused = false, tutStep = -1, tutWait = 0, botOn = true, uiCharge = 0;
  function resize() { R.layout(window.innerWidth, window.innerHeight, Math.min(2, window.devicePixelRatio || 1)); }
  window.addEventListener('resize', resize); resize();
  function newSim(o) { R.clear(); S = PH.create(o); return S; }
  function show(id, on) { $(id).hidden = !on; }
  function stats() {
    var r = store.get('rec', {}), el = $('statStrip'); el.innerHTML = '';
    [[t('best'), r.best || 0], [t('bestTime'), fmt(r.bestTime || 0)], [t('runs'), r.runs || 0]].forEach(function (p) { var s = document.createElement('span'); s.textContent = p[0] + ': ' + p[1]; el.appendChild(s); });
  }
  function fmt(sec) { sec = Math.floor(sec); return Math.floor(sec / 60) + ':' + ('0' + sec % 60).slice(-2); }
  function goHome() {
    botSpeed = 0.7; mode = 'home'; paused = false; botOn = true; newSim({ seed: 'home' + Math.floor(Date.now() / 60000) }); prewarm(8);
    show('home', true); show('hud', false); ['pauseDlg', 'overDlg', 'tutDlg', 'howDlg'].forEach(function (d) { show(d, false); });
    root.classList.remove('jr-hub-off'); stats(); if (location.hash) history.replaceState(null, '', location.pathname + location.search);
  }
  function enterHud() { show('home', false); show('hud', true); root.classList.add('jr-hub-off'); $('pawangName').textContent = '🧙 ' + pawang(); $('demoTag').hidden = mode !== 'demo'; $('coach').hidden = mode !== 'tut'; show('overDlg', false); show('pauseDlg', false); show('tutDlg', false); }
  function startPlay() { Snd.ensure(); mode = 'play'; botOn = false; paused = false; newSim({ seed: 'run' + Date.now() }); enterHud(); banner('🌧️ ' + t('play') + '!', 1.6); }
  function startTut() { Snd.ensure(); mode = 'tut'; botOn = false; paused = false; newSim({ seed: CFG.game.tutorialSeed, tutorial: true }); tutStep = 0; enterHud(); coach(); }
  function startDemo() {
    mode = 'demo'; botOn = true; paused = false; botSpeed = 0.6; newSim({ seed: CFG.game.demoSeed }); prewarm(40);
    // snapshot staging: a few hotspots, some haze and scorched land, three rain clouds
    [[1, 5], [4, 6], [2, 2], [5, 3]].forEach(function (p, i) { var c = PH.tile(S.t, p[0], p[1], S.P); if (c && PH.burnable(c)) { c.fire = 0.55 + i * 0.12; c.burnt = 0.3; c.wet = 0; } });
    S.haze = 0.32; S.clouds.length = 0; PH.addCloud(S, 1.6, 5.2, 0.9); PH.addCloud(S, 4.2, 2.6, 1, 1.6); PH.addCloud(S, 3.4, 6.6, 0.25).born = -5; S.clouds.forEach(function (c) { c.born = -5; });
    enterHud();
  }
  function prewarm(sec) { for (var i = 0; i < sec * 20; i++) { bot(0.05); PH.step(S, 0.05); var ev = PH.events(S); if (mode === 'demo') ev.forEach(function (e) { if (e.e === 'rainbow') R.event(S, e); }); if (S.over) break; } }
  function coach() {
    var st = CFG.tutorial[tutStep]; if (!st) return; $('coachTxt').textContent = st.text; $('coachSub').textContent = st.sub; $('coach').hidden = false;
    var cb = $('coach'); cb.style.animation = 'none'; void cb.offsetWidth; cb.style.animation = '';
  }
  function tutNext() {
    tutStep++; Snd.blip();
    var id = CFG.tutorial[tutStep] && CFG.tutorial[tutStep].id;
    if (id === 'ritual') S.clouds.forEach(function (c) { c.w = Math.min(c.w, 0.12); });
    if (id === 'thunder') { S.thunder = 1; PH.ignite(S, PH.tile(S.t, 1, 6, S.P).k === 'r' || PH.tile(S.t, 1, 6, S.P).k === 'v' ? null : PH.tile(S.t, 1, 6, S.P)); }
    if (id === 'done') { tutWait = 2.8; }
    coach();
  }
  function finishTut() { store.set('tut', 1); show('tutDlg', true); paused = true; }
  // ---------- autoplay bot (home background + #demo) ----------
  function bot(dt) {
    if (!botOn || !S) return; var fs = PH.fires(S).sort(function (a, b) { return b.fire - a.fire; });
    S.clouds.forEach(function (c, i) { var f = fs[i % Math.max(1, fs.length)]; if (!f || c.w <= 0) return; var dx = f.x + 0.5 - c.x, dy = f.y + 0.5 - c.y, d = Math.hypot(dx, dy); if (d > 0.05) { var m = Math.min(d, botSpeed * dt); c.x += dx / d * m; c.y += dy / d * m; } });
    if (S.ritual.cool <= 0 && !S.ritual.holding && S.clouds.filter(function (c) { return c.w > 0.2; }).length < 2) PH.ritualHold(S);
    if (S.ritual.holding && S.ritual.charge >= 0.9) PH.ritualRelease(S);
    if (S.thunder && fs.length > 3 && S.clouds[0]) PH.thunder(S, S.clouds[0].id);
    if (S.haze > 0.8) S.haze = 0.5; // keep the attract loop pretty
  }
  // ---------- events -> fx / sound / toasts / tutorial ----------
  function handle(ev) {
    var play = mode === 'play' || mode === 'tut';
    ev.forEach(function (e) {
      R.event(S, e);
      if (!play) return;
      switch (e.e) {
        case 'out': Snd.sizzle(); toast(e.peat ? t('fPeat') : t('fOut'), e.peat ? 'gold' : 'good'); break;
        case 'soaked': toast(t('fSoaked'), 'good'); break;
        case 'reignite': Snd.ignite(); toast(t('fReignite'), 'bad'); break;
        case 'ignite': if (S.time > 1) Snd.ignite(); break;
        case 'rainbow': Snd.rainbow(); toast(t('fRainbow', { m: e.mult }), 'rb'); var mt = $('multTag'); mt.classList.remove('pop'); void mt.offsetWidth; mt.classList.add('pop'); break;
        case 'streakLost': toast(t('fLost'), 'bad'); break;
        case 'merge': Snd.merge(); toast(t('fMerge'), 'good'); break;
        case 'ritual':
          if (e.res === 'perfect') { Snd.perfect(); toast(t('fPerfect'), 'gold'); } else if (e.res === 'ok') { Snd.ok(); toast(t('fOk'), 'good'); } else if (e.res === 'spill') { Snd.spill(); toast(t('fSpill'), 'bad'); } else { Snd.blip(); toast(t('fFizzle')); }
          if (mode === 'tut' && tutStep === 2 && (e.res === 'perfect' || e.res === 'ok')) tutNext(); break;
        case 'charge': Snd.tone(988, 0.2, 'triangle', 0.12); toast(t('fCharge'), 'gold'); break;
        case 'thunder': Snd.thunder(); toast(t('fThunder'), 'gold'); if (navigator.vibrate) try { navigator.vibrate(40); } catch (x) {} if (mode === 'tut' && tutStep === 3) tutNext(); break;
        case 'level': Snd.warn(); banner(t('fLevel', { n: e.level }), 2.4); break;
        case 'wind': toast(t('fWind')); break;
        case 'drywarn': Snd.warn(); banner(t('fDryWarn'), 2.6); break;
        case 'dry': banner(t('fDry'), 3); break;
        case 'dryend': toast(t('fDryEnd'), 'good'); break;
        case 'scorched': toast(t('fScorched'), 'bad'); break;
        case 'over': gameOver(); break;
      }
    });
  }
  function gameOver() {
    Snd.holdStop(); Snd.lose(); Snd.bed(0, 0); var prev = store.get('rec', {}), rec = PH.record(prev, S); store.set('rec', { best: rec.best, bestTime: rec.bestTime, runs: rec.runs, out: rec.out });
    $('oScore').textContent = PH.finalScore(S); $('oTime').textContent = fmt(S.time); $('oOut').textContent = S.out; $('oRb').textContent = S.rainbows;
    $('overSub').textContent = t('overSub', { name: pawang() }); $('bestBadge').hidden = !rec.isBest; mode = 'over'; show('overDlg', true); root.classList.remove('jr-hub-off');
  }
  // ---------- input: drag clouds, double-tap = petir ----------
  var drag = null, lastTap = null;
  function pt(e) { var r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
  cv.addEventListener('pointerdown', function (e) {
    if (!(mode === 'play' || mode === 'tut') || paused) return; Snd.ensure();
    var p = pt(e), f = R.toField(p.x, p.y), c = PH.cloudAt(S, f.x, f.y + R.ELEV, 0.45) || PH.cloudAt(S, f.x, f.y, 0.2);
    if (!c) return; e.preventDefault();
    var now = performance.now();
    if (lastTap && lastTap.id === c.id && now - lastTap.t < 340) { lastTap = null; if (!PH.thunder(S, c.id)) toast(t('fNoThunder')); return; }
    lastTap = { id: c.id, t: now };
    PH.grab(S, c.id); drag = { id: c.id, pid: e.pointerId, dx: c.x - f.x, dy: c.y - f.y, sx: p.x, sy: p.y };
    try { cv.setPointerCapture(e.pointerId); } catch (x) {}
  });
  cv.addEventListener('pointermove', function (e) { if (!drag || e.pointerId !== drag.pid || !S) return; var p = pt(e), f = R.toField(p.x, p.y); PH.drag(S, drag.id, f.x + drag.dx, f.y + drag.dy); if (Math.hypot(p.x - drag.sx, p.y - drag.sy) > 12) lastTap = null; });
  function endDrag(e) { if (!drag || (e && e.pointerId !== drag.pid)) return; if (S) PH.drop(S, drag.id); drag = null; }
  cv.addEventListener('pointerup', endDrag); cv.addEventListener('pointercancel', endDrag);
  // ---------- mangkuk ritual: hold, release in the golden zone ----------
  var bowl = $('bowlBtn'), holding = false;
  function bowlDown(e) { if (e) e.preventDefault(); if (!(mode === 'play' || mode === 'tut') || paused || holding) return; Snd.ensure(); if (PH.ritualHold(S)) { holding = true; bowl.classList.add('hold'); Snd.holdStart(); } }
  function bowlUp() { if (!holding) return; holding = false; bowl.classList.remove('hold'); Snd.holdStop(); if (S && S.ritual.holding) PH.ritualRelease(S); }
  bowl.addEventListener('pointerdown', function (e) { try { bowl.setPointerCapture(e.pointerId); } catch (x) {} bowlDown(e); });
  bowl.addEventListener('pointerup', bowlUp); bowl.addEventListener('pointercancel', bowlUp); bowl.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  window.addEventListener('keydown', function (e) { if ((e.code === 'Space' || e.key === ' ') && !e.repeat && (mode === 'play' || mode === 'tut')) { e.preventDefault(); bowlDown(); } if (e.key === 'Escape' && mode === 'play') togglePause(true); });
  window.addEventListener('keyup', function (e) { if (e.code === 'Space' || e.key === ' ') bowlUp(); });
  // ---------- buttons ----------
  $('playBtn').addEventListener('click', function () { Snd.ensure(); store.get('tut', 0) ? startPlay() : startTut(); });
  $('howBtn').addEventListener('click', function () { show('howDlg', true); });
  $('howClose').addEventListener('click', function () { show('howDlg', false); });
  $('howPlay').addEventListener('click', function () { show('howDlg', false); startTut(); });
  $('skipTut').addEventListener('click', function () { store.set('tut', 1); startPlay(); });
  $('tutStart').addEventListener('click', function () { startPlay(); });
  $('againBtn').addEventListener('click', function () { startPlay(); });
  $('menuBtn').addEventListener('click', goHome);
  $('quitBtn').addEventListener('click', goHome);
  $('resumeBtn').addEventListener('click', function () { togglePause(false); });
  $('pauseBtn').addEventListener('click', function () { if (mode === 'demo') return goHome(); togglePause(true); });
  function togglePause(on) { if (!(mode === 'play' || mode === 'tut')) return; paused = on; show('pauseDlg', on); bowlUp(); endDrag(); if (on) Snd.bed(0, 0); }
  document.addEventListener('visibilitychange', function () { if (document.hidden && mode === 'play' && !paused) togglePause(true); if (document.hidden) Snd.bed(0, 0); });
  // ---------- HUD sync (only touch the DOM on change) ----------
  var last = {};
  function setTxt(id, v) { if (last[id] !== v) { last[id] = v; $(id).textContent = v; } }
  function setW(id, v) { v = Math.round(v * 200) / 2; if (last[id] !== v) { last[id] = v; $(id).style.width = v + '%'; } }
  function hud() {
    setTxt('scoreNum', String(Math.round(S.score))); setTxt('timeNum', fmt(S.time)); setTxt('lvNum', String(S.level));
    setTxt('multTag', '×' + S.mult); if (last.mh !== (S.mult > 1)) { last.mh = S.mult > 1; $('multTag').hidden = !last.mh; }
    setW('hazeBar', S.haze); setW('rainBar', Math.min(1, S.streak / S.P.streakNeed));
    var hw = S.haze > 0.7; if (last.hw !== hw) { last.hw = hw; document.querySelector('.meter.haze').classList.toggle('warn', hw); }
    var ang = Math.round(Math.atan2(S.wind.y, S.wind.x) * 180 / Math.PI), sp = Math.hypot(S.wind.x, S.wind.y);
    if (last.wa !== ang) { last.wa = ang; $('windArrow').style.transform = 'rotate(' + ang + 'deg) scale(' + (0.7 + Math.min(0.6, sp)) + ')'; $('windChip').style.opacity = sp < 0.02 ? 0.4 : 1; }
    setTxt('thunderNum', String(S.thunder)); if (last.th !== S.thunder) { last.th = S.thunder; $('thunderBox').classList.toggle('ready', S.thunder > 0); }
    var pr = S.thunderProg + ':' + S.thunder; if (last.pr !== pr) { last.pr = pr; var pips = $('thunderPips').children; for (var i = 0; i < pips.length; i++) pips[i].classList.toggle('on', S.thunder >= S.P.maxThunder || i < S.thunderProg); }
    var rc = S.ritual, ch = rc.holding ? Math.min(1, rc.charge) : 0, gold = rc.holding && rc.charge >= S.P.ritualPerfect[0] && rc.charge <= S.P.ritualPerfect[1];
    uiCharge = ch; var cs = (Math.round(ch * 50) / 50).toFixed(2); if (last.cs !== cs) { last.cs = cs; bowl.style.setProperty('--c', cs); }
    if (last.gold !== gold) { last.gold = gold; bowl.classList.toggle('gold', gold); }
    var cool = rc.cool > 0; if (last.cool !== cool) { last.cool = cool; bowl.classList.toggle('cool', cool); }
    if (rc.holding) Snd.holdSet(rc.charge);
  }
  // ---------- main loop ----------
  var prevT = performance.now(), acc = 0;
  function loop(now) {
    var dt = Math.min(0.1, (now - prevT) / 1000); prevT = now;
    if (S) {
      var run = !paused && mode !== 'over';
      if (run) { acc += dt; var steps = 0; while (acc >= 1 / 60 && steps < 6) { acc -= 1 / 60; steps++; bot(1 / 60); PH.step(S, 1 / 60); handle(PH.events(S)); if (mode === 'over') break; } }
      if (mode === 'tut' && tutWait > 0 && !paused) { tutWait -= dt; if (tutWait <= 0) finishTut(); }
      if (mode === 'tut' && tutStep === 0) { var lit = PH.fires(S)[0]; if (!lit || S.clouds.some(function (c) { return !c.held && c.w > 0 && PH.cover(c, lit) > 0; })) tutNext(); }
      if (mode === 'tut' && tutStep === 1 && !PH.fires(S).length) tutNext();
      if (mode === 'tut' && tutStep < 2) S.clouds.forEach(function (c) { c.w = Math.max(c.w, 0.5); });
      if (mode === 'tut' && tutStep === 2 && !S.clouds.length) PH.addCloud(S, 1.2, 1.6, 0.1);
      if (bannerT > 0 && (bannerT -= dt) <= 0) $('banner').hidden = true;
      var gd = null, lit0 = mode === 'tut' && tutStep === 0 && S.clouds[0] && !S.clouds[0].held && PH.fires(S)[0];
      if (lit0) gd = { x0: S.clouds[0].x, y0: S.clouds[0].y, x1: lit0.x + 0.5, y1: lit0.y + 0.5 };
      R.frame(S, run ? dt : 0, { charge: uiCharge, hint: mode === 'tut' && tutStep === 0 && S.clouds[0] ? S.clouds[0].id : null, guide: gd });
      if (mode === 'play' || mode === 'tut' || mode === 'demo') hud();
      if (mode === 'play' || mode === 'tut') Snd.bed(run ? S.clouds.filter(function (c) { return c.w > 0; }).length : 0, run ? S.fireSum || 0 : 0);
    }
    requestAnimationFrame(loop);
  }
  // ---------- routes ----------
  var h = location.hash;
  if (h === '#demo') startDemo(); else if (h === '#tutorial') { goHome(); startTut(); } else goHome();
  requestAnimationFrame(loop);
  window.__ph = { get S() { return S; }, get mode() { return mode; }, get tutStep() { return tutStep; }, startPlay: startPlay, startTut: startTut, R: R };
})();

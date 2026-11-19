// Bumerang Sakti app: screens, input, game loop, Web Audio synth, highscore API, cosmetic shop.
(function () {
  'use strict';
  var CFG = JSON.parse(document.getElementById('website-config').textContent);
  var T = CFG.text, G = CFG.game, SHOP = CFG.shop, R = BS.R, root = document.documentElement;
  var $ = function (id) { return document.getElementById(id); };
  var KEY = 'bumerangsakti.';
  var store = {
    get: function (k, d) { try { var v = localStorage.getItem(KEY + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem(KEY + k, JSON.stringify(v)); } catch (e) { } }
  };
  var save = {
    name: store.get('name', ''), coins: store.get('coins', 0), best: store.get('best', 0), local: store.get('local', []),
    owned: store.get('owned', { skins: ['kayu'], trails: ['angin'] }), skin: store.get('skin', 'kayu'), trail: store.get('trail', 'angin'),
    tutDone: store.get('tutDone', false), muted: store.get('muted', false), pending: store.get('pending', []), plays: store.get('plays', 0)
  };
  function persist() { ['name', 'coins', 'best', 'local', 'owned', 'skin', 'trail', 'tutDone', 'muted', 'pending', 'plays'].forEach(function (k) { store.set(k, save[k]); }); }
  function skinObj(id) { return SHOP.skins.filter(function (s) { return s.id === (id || save.skin); })[0] || SHOP.skins[0]; }
  function trailObj(id) { return SHOP.trails.filter(function (s) { return s.id === (id || save.trail); })[0] || SHOP.trails[0]; }

  // ---------- text ----------
  document.querySelectorAll('[data-t]').forEach(function (el) { el.textContent = T[el.getAttribute('data-t')] || ''; });
  document.querySelectorAll('[data-c]').forEach(function (el) { var v = CFG; el.getAttribute('data-c').split('.').forEach(function (k) { v = v && v[k]; }); el.textContent = v || ''; });
  $('skipTut').textContent = T.skip + ' ⏭';

  // ---------- online / API ----------
  var ONLINE = /^https?:$/.test(location.protocol) && CFG.api.hosts.some(function (h) { return location.hostname === h || location.hostname.slice(-h.length - 1) === '.' + h; });
  function apiGet() {
    return fetch(CFG.api.scores + '?limit=' + CFG.api.limit, { headers: { Accept: 'application/json' }, cache: 'no-store' })
      .then(function (r) { if (!r.ok) throw Error('HTTP ' + r.status); return r.json(); }).then(BS.parseBoard);
  }
  function apiPost(name, score) {
    return fetch(CFG.api.scores, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ name: name, score: score }) })
      .then(function (r) { if (r.status === 422) return 'rejected'; if (!r.ok) throw Error('HTTP ' + r.status); return 'ok'; });
  }
  function flushPending() {
    if (!ONLINE || !save.pending.length) return;
    var p = save.pending.shift(); persist();
    apiPost(p.name, p.score).then(function () { flushPending(); }, function () { save.pending.unshift(p); persist(); });
  }

  // ---------- audio (Web Audio synth, no assets) ----------
  var A = { ctx: null, master: null, noise: null };
  function audio() {
    if (!A.ctx) {
      try {
        var C = window.AudioContext || window.webkitAudioContext; if (!C) return null;
        A.ctx = new C(); A.master = A.ctx.createGain(); A.master.gain.value = save.muted ? 0 : 0.6;
        var comp = A.ctx.createDynamicsCompressor(); A.master.connect(comp); comp.connect(A.ctx.destination);
        var b = A.ctx.createBuffer(1, A.ctx.sampleRate, A.ctx.sampleRate), d = b.getChannelData(0); for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; A.noise = b;
      } catch (e) { A.ctx = null; return null; }
    }
    if (A.ctx.state === 'suspended') A.ctx.resume();
    return A.ctx;
  }
  function tone(f, when, dur, type, vol, f2) {
    var c = A.ctx; if (!c || save.muted) return;
    var o = c.createOscillator(), g = c.createGain(); o.type = type || 'sine'; o.frequency.setValueAtTime(f, when);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, when + dur);
    g.gain.setValueAtTime(0.0001, when); g.gain.exponentialRampToValueAtTime(vol, when + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    o.connect(g); g.connect(A.master); o.start(when); o.stop(when + dur + 0.05);
  }
  function noise(when, dur, vol, freq, type, f2) {
    var c = A.ctx; if (!c || save.muted) return;
    var s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain(); s.buffer = A.noise; f.type = type || 'bandpass'; f.frequency.setValueAtTime(freq, when);
    if (f2) f.frequency.exponentialRampToValueAtTime(f2, when + dur);
    g.gain.setValueAtTime(vol, when); g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    s.connect(f); f.connect(g); g.connect(A.master); s.start(when, Math.random() * 0.5); s.stop(when + dur + 0.05);
  }
  var SFX = {
    whoosh: function (n) { noise(n, 0.35, 0.35, 500, 'bandpass', 2400); },
    pop: function (n, combo) { var f = Math.min(1700, 480 + combo * 28); tone(f, n, 0.13, 'sine', 0.32, f * 1.6); tone(f * 2, n, 0.08, 'triangle', 0.08); },
    bonk: function (n) { tone(240, n, 0.12, 'square', 0.12, 130); },
    boom: function (n) { noise(n, 0.7, 0.9, 900, 'lowpass', 80); tone(110, n, 0.45, 'sine', 0.6, 35); },
    ouch: function (n) { tone(420, n, 0.4, 'sawtooth', 0.14, 110); noise(n, 0.3, 0.4, 400, 'lowpass'); },
    chime: function (n) { [880, 1320, 1760].forEach(function (f, i) { tone(f, n + i * 0.07, 0.3, 'sine', 0.2); }); },
    shield: function (n) { tone(500, n, 0.35, 'triangle', 0.25, 1300); },
    block: function (n) { tone(1400, n, 0.2, 'triangle', 0.25, 600); noise(n, 0.15, 0.3, 3000, 'highpass'); },
    catch: function (n) { tone(1320, n, 0.09, 'sine', 0.22); tone(1760, n + 0.06, 0.12, 'sine', 0.18); },
    buzz: function (n) { tone(170, n, 0.12, 'square', 0.09); tone(150, n + 0.14, 0.16, 'square', 0.09); },
    fanfare: function (n) { [523, 659, 784, 1047].forEach(function (f, i) { tone(f, n + i * 0.08, 0.28, 'triangle', 0.22); tone(f * 2, n + i * 0.08, 0.2, 'sine', 0.06); }); },
    tick: function (n) { tone(1100, n, 0.04, 'square', 0.06); },
    spawn: function (n) { tone(380, n, 0.16, 'sine', 0.07, 760); },
    over: function (n) { [784, 659, 523, 392].forEach(function (f, i) { tone(f, n + i * 0.14, 0.3, 'triangle', 0.2); }); },
    tap: function (n) { tone(700, n, 0.06, 'sine', 0.12, 900); }
  };
  function sfx(name, arg) { if (!A.ctx || save.muted) return; SFX[name](A.ctx.currentTime + 0.005, arg); }
  // Cheerful pentatonic loop, layers grow with combo tier. Scheduled from game time so it stays on the wave beat.
  var CHORDS = [[0, 4, 7], [7, 11, 14], [9, 12, 16], [5, 9, 12]], PENTA = [0, 2, 4, 7, 9, 12, 14, 16, 19];
  var MEL = [4, -1, 3, -1, 2, 3, 4, -1, 5, -1, 4, -1, 3, -1, 2, -1, 3, -1, 4, -1, 5, -1, 6, 5, 4, -1, 3, -1, 2, -1, -1, -1];
  function mf(m) { return 440 * Math.pow(2, (m - 69) / 12); }
  function musicStep(step, when, tier) {
    var s8 = step % 8, bar = Math.floor(step / 8) % 4, ch = CHORDS[bar];
    if (s8 % 4 === 0) tone(150, when, 0.2, 'sine', 0.45, 45);
    if (s8 === 4) noise(when, 0.12, 0.22, 1600);
    if ((tier >= 1 && step % 2) || tier >= 3) noise(when, 0.04, 0.05, 7500, 'highpass');
    if (step % 2 === 0) tone(mf(48 + ch[(step / 2) % 2 ? 2 : 0]), when, 0.2, 'triangle', 0.17);
    var m = MEL[step % 32]; if (m >= 0) { var f = mf(72 + PENTA[m]); tone(f, when, 0.28, 'sine', 0.1); tone(f * 2, when, 0.12, 'triangle', 0.025); }
    if (tier >= 2) tone(mf(72 + ch[step % 3]), when, 0.12, 'triangle', 0.045);
    if (tier >= 4 && step % 2) tone(mf(84 + PENTA[(step * 7) % PENTA.length]), when, 0.15, 'sine', 0.035);
  }

  // ---------- canvas ----------
  var cv = $('cv'), cx = cv.getContext('2d'), W = 0, H = 0, DPR = 1, SC = 1, ground = 0, F = { x: 0, y: 0, w: 0, h: 0 };
  function resize() {
    W = window.innerWidth; H = window.innerHeight; DPR = Math.min(2, window.devicePixelRatio || 1);
    cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
    SC = Math.max(0.8, Math.min(1.25, Math.min(W, H * 0.75) / 400));
    ground = H - Math.max(56, Math.min(110, H * 0.11));
    var top = Math.max(96, H * 0.14), bottom = ground - 125 * SC;
    F = { x: W * 0.06, w: W * 0.88, y: top, h: Math.max(140, bottom - top) };
  }
  window.addEventListener('resize', resize); resize();
  function rad(kind) { var r = Math.max(17, Math.min(30, Math.min(W, 700) * 0.052)); return { mon: r, big: r * 1.45, boss: r * 2.3, tnt: r * 0.95, bomb: r * 0.92, time: r * 0.85, shield: r * 0.85 }[kind] || r; }
  function catchPt() { return { x: S.px, y: ground - 36 * SC }; }
  function catchR() { return Math.max(52, 62 * SC); }

  // ---------- state ----------
  var beatLen = 60 / G.bpm, stepLen = beatLen / 2, RNG = BS.rng(Date.now());
  var S = null;
  function fresh(mode) {
    return { mode: mode, t: 0, timeLeft: G.startTime, lives: G.lives, score: 0, combo: 0, maxCombo: 0, tier: 0, shield: false, ents: [], parts: [], pops: [], waves: 0, waveList: [],
      lastWaveBar: -99, normal: 0, lastBossAt: -1, bossKills: 0, lastBar: -1, px: W / 2, pdir: 1, aim: null, boom: null, shake: 0, hurt: 0, tutStep: -1, nextStep: 0, throws: 0, idleHint: 0, lastTick: 99, endAt: 0, demoT: 0, coachLoop: null, hintCd: 0 };
  }
  S = fresh('menu');

  function tierNow() { return BS.tierFor(S.combo, G.comboTiers); }
  function mk(kind, rx, ry, wave, delay) {
    return { kind: kind, rx: rx, ry: ry, wave: wave, born: S.t + (delay || 0), expire: wave.forever ? Infinity : S.t + (kind === 'boss' ? G.bossLifeBeats : G.lifeBeats) * beatLen, hp: kind === 'big' ? 2 : kind === 'boss' ? G.bossHp : 1, maxHp: kind === 'boss' ? G.bossHp : 0, r: rad(kind), seed: RNG() * 6, flash: 0, cd: 0, leaving: 0, dead: false, x: 0, y: 0 };
  }
  function spawnWave(def, forever) {
    var w = def || BS.makeWave(RNG, { tier: tierNow(), wave: S.waves, timeLeft: S.timeLeft, hasShield: S.shield });
    var wave = { id: ++S.waves, move: w.move, t0: S.t, seed: RNG() * 6, killable: 0, killed: 0, escaped: 0, forever: !!forever, cleanGiven: false };
    w.items.forEach(function (it, i) { S.ents.push(mk(it.kind, it.x, it.y, wave, i * 0.05)); if (it.kind === 'mon' || it.kind === 'big' || it.kind === 'boss') wave.killable++; });
    S.waveList.push(wave);
    if (S.mode !== 'menu') sfx('spawn');
  }
  function place(e) {
    var w = e.wave, age = S.t - w.t0, rx = e.rx, ry = e.ry;
    if (w.move === 'spin') { var dx = rx - 0.5, dy = ry - 0.45, a = Math.atan2(dy, dx) + age * 0.55, d = Math.sqrt(dx * dx + dy * dy); rx = 0.5 + Math.cos(a) * d; ry = 0.45 + Math.sin(a) * d; }
    var x = F.x + rx * F.w, y = F.y + ry * F.h;
    if (w.move === 'bob') y += Math.sin(S.t * 2.2 + e.seed) * 6 * SC;
    else if (w.move === 'sway') x += Math.sin(age * 0.9 + w.seed) * F.w * 0.08;
    else if (w.move === 'drift') { x += Math.sin(age * 0.45 + w.seed) * F.w * 0.13; y += Math.sin(age * 0.8 + e.seed) * 8; }
    if (e.leaving) y -= e.leaving * e.leaving * 500;
    e.x = Math.max(e.r, Math.min(W - e.r, x)); e.y = y;
  }

  // ---------- FX ----------
  var CONF = ['#ff6fb5', '#ffd23f', '#5fe08a', '#5fb8ff', '#b07bff', '#ff8a3d'];
  function burst(x, y, n, opt) {
    opt = opt || {}; n = Math.round(n * (1 + S.tier * 0.4));
    for (var i = 0; i < n; i++) {
      var a = Math.random() * Math.PI * 2, sp = (opt.speed || 260) * (0.3 + Math.random());
      var shape = opt.shape || (Math.random() < 0.5 ? 'conf' : Math.random() < 0.5 ? 'star' : 'dot');
      S.parts.push({ x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 80, g: opt.g == null ? 500 : opt.g, life: 0.7 + Math.random() * 0.5, max: 1.1, size: (opt.size || 7) * (0.6 + Math.random() * 0.8), col: opt.col || CONF[i % CONF.length], shape: shape, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 12 });
    }
  }
  function ringFx(x, y, r, col) { S.parts.push({ x: x, y: y, vx: 0, vy: 0, g: 0, life: 0.45, max: 0.45, size: r, col: col || '#fff', shape: 'ring', rot: 0, vr: 0 }); }
  function smoke(x, y, n, col) { for (var i = 0; i < n; i++) { var a = Math.random() * 6.28, sp = 40 + Math.random() * 120; S.parts.push({ x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 30, g: -40, life: 0.8, max: 0.8, size: 10 + Math.random() * 14, col: col || 'rgba(255,255,255,.75)', shape: 'smoke', rot: 0, vr: 0 }); } }
  function slash(x, y, ang) { S.parts.push({ x: x, y: y, vx: 0, vy: 0, g: 0, life: 0.25, max: 0.25, size: 34 * SC, col: '#fff', shape: 'slash', rot: ang + 0.6, vr: 0 }); }
  function pop(x, y, txt, col, size, life) { S.pops.push({ x: x, y: y, txt: txt, col: col || '#fff', size: (size || 22) * SC, life: life || 0.9, max: life || 0.9, vy: -60 }); }
  var bannerT = 0;
  function banner(txt, col) { var b = $('banner'); b.hidden = true; void b.offsetWidth; b.textContent = txt; b.style.color = col || '#ffe14d'; b.hidden = false; clearTimeout(bannerT); bannerT = setTimeout(function () { b.hidden = true; }, 1150); }
  var coachKey = '';
  function coach(ic, tx, y, sub) {
    var c = $('coach'), k = ic + tx + (sub || ''); if (!ic) { c.hidden = true; coachKey = ''; return; }
    $('coachSub').textContent = sub || ''; $('coachSub').hidden = !sub;
    c.style.top = (y || Math.min(H - (sub ? 70 : 52), ground + 4)) + 'px';
    if (k === coachKey) return; coachKey = k; $('coachIc').textContent = ic; $('coachTx').textContent = tx; c.hidden = true; void c.offsetWidth; c.hidden = false;
  }
  var toastT = 0;
  function toast(t) { var el = $('toast'); el.textContent = t; el.hidden = false; clearTimeout(toastT); toastT = setTimeout(function () { el.hidden = true; }, 1800); }

  // ---------- HUD ----------
  var hudLives = -1;
  function hud() {
    if (hudLives !== S.lives) {
      var h = ''; for (var i = 0; i < G.lives; i++) h += '<span class="' + (i < S.lives ? '' : 'lost') + (i === S.lives && hudLives > S.lives ? ' pop' : '') + '">❤️</span>';
      $('lives').innerHTML = h; hudLives = S.lives;
    }
    var tl = Math.max(0, S.timeLeft); $('tnum').textContent = Math.ceil(tl); $('tfill').style.width = Math.min(100, tl / G.startTime * 100) + '%';
    $('tnum').parentNode.classList.toggle('low', tl <= 10 && S.mode === 'play');
    $('score').textContent = S.score.toLocaleString('id-ID');
    var cb = $('combo'); cb.hidden = S.combo < 2; $('comboN').textContent = S.combo; $('mult').textContent = 'x' + BS.multFor(S.combo);
    $('shieldIc').hidden = !S.shield;
  }
  function bumpCombo() { var cb = $('combo'); cb.classList.remove('bump'); void cb.offsetWidth; cb.classList.add('bump'); }

  // ---------- rules ----------
  function kill(e, why) {
    if (e.dead) return; e.dead = true; e.wave.killed++;
    var demo = S.mode === 'menu';
    burst(e.x, e.y, e.kind === 'big' ? 22 : 14, {}); ringFx(e.x, e.y, e.r * 1.4, '#ffe1f1'); smoke(e.x, e.y, 3);
    if (demo) return;
    S.combo++; if (S.combo > S.maxCombo) S.maxCombo = S.combo;
    var pts = BS.killScore(e.kind, S.combo, G.base); S.score += pts; if (S.boom) S.boom.kills++;
    var m = BS.multFor(S.combo);
    pop(e.x, e.y - e.r, '+' + pts, m >= 3 ? '#ffd23f' : m >= 2 ? '#7dffb0' : '#fff', 20 + m * 3);
    sfx('pop', S.combo); bumpCombo();
    var nt = tierNow();
    if (nt > S.tier) { S.tier = nt; banner(G.tierWords[nt] || 'WOW!'); sfx('fanfare'); burst(W / 2, H * 0.4, 30, { speed: 420 }); }
    else if (S.combo % 10 === 0) { pop(W / 2, H * 0.36, 'COMBO ' + S.combo + '!', '#ffd23f', 36, 1.2); sfx('fanfare'); }
    S.tier = nt;
    checkClean(e.wave);
  }
  function checkClean(w) {
    if (S.mode !== 'play' || w.cleanGiven || w.killable < 3 || w.escaped || w.killed < w.killable) return;
    w.cleanGiven = true; var b = Math.round(50 * BS.multFor(S.combo)); S.score += b; S.timeLeft = Math.min(G.maxTime, S.timeLeft + G.cleanBonusTime);
    pop(W / 2, F.y + F.h * 0.25, T.clean + ' +' + b + '  ⏱+' + G.cleanBonusTime, '#7dffb0', 28, 1.3);
  }
  function explode(e) {
    if (e.dead) return; e.dead = true;
    var R2 = Math.max(110, Math.min(W, H) * G.tntRadius);
    S.shake = Math.max(S.shake, 12); sfx('boom'); ringFx(e.x, e.y, R2 * 0.7, '#ffd23f'); ringFx(e.x, e.y, R2 * 0.45, '#ff8a3d');
    burst(e.x, e.y, 26, { col: null, speed: 480 }); smoke(e.x, e.y, 10, 'rgba(255,220,150,.8)');
    if (S.mode !== 'menu') { var pts = BS.killScore('tnt', S.combo, G.base); S.score += pts; pop(e.x, e.y, '💥 +' + pts, '#ffb347', 30); if (S.boom) S.boom.tnt = true; }
    S.ents.forEach(function (o) {
      if (o.dead || o === e || o.born > S.t || BS.dist(o.x, o.y, e.x, e.y) > R2 + o.r) return;
      if (o.kind === 'mon' || o.kind === 'big') kill(o, 'tnt');
      else if (o.kind === 'boss') { bossHit(o, 2); }
      else if (o.kind === 'tnt') setTimeout(function () { if (S) explode(o); }, 120);
      else if (o.kind === 'bomb') { o.dead = true; smoke(o.x, o.y, 6); pop(o.x, o.y, '💨', '#fff', 22); }
    });
  }
  function hit(e, ang) {
    if (e.kind === 'mon') { slash(e.x, e.y, ang); kill(e); }
    else if (e.kind === 'big') {
      slash(e.x, e.y, ang); e.hp--; if (S.mode !== 'menu') S.boom && (S.boom.touched = true);
      if (e.hp > 0) { e.flash = 0.25; e.cd = 0.3; sfx('bonk'); burst(e.x, e.y, 6, { size: 5 }); pop(e.x, e.y - e.r, '1/2', '#fff', 18); if (S.mode === 'tut') coach('💪', T.tBigAgain, null, T.tBigSub); }
      else kill(e);
    } else if (e.kind === 'boss') bossHit(e, 1, ang);
    else if (e.kind === 'tnt') explode(e);
    else if (e.kind === 'bomb') bomb(e);
    else if (e.kind === 'time') { e.dead = true; S.timeLeft = Math.min(G.maxTime, S.timeLeft + G.timePowerup); pop(e.x, e.y, '⏱ +' + G.timePowerup, '#7dffb0', 28, 1.2); sfx('chime'); burst(e.x, e.y, 12, { col: '#7dffb0', shape: 'star' }); }
    else if (e.kind === 'shield') { e.dead = true; S.shield = true; pop(e.x, e.y, '🛡 ' + T.shieldOn, '#8fdcff', 26, 1.2); sfx('shield'); burst(e.x, e.y, 12, { col: '#8fdcff', shape: 'star' }); }
  }
  function startBoss() {
    S.lastBossAt = S.normal; spawnWave(BS.bossWave(RNG));
    banner('👑 ' + T.bossIn, '#c58bff'); sfx('fanfare'); S.shake = 8; S.bossHintT = S.t;
  }
  function bossHit(e, n, ang) {
    if (e.dead) return;
    if (ang != null) slash(e.x, e.y, ang);
    e.hp -= n; e.flash = 0.25; e.cd = 0.25;
    if (S.mode === 'menu') { if (e.hp <= 0) e.dead = true; return; }
    for (var i = 0; i < n; i++) { S.combo++; if (S.combo > S.maxCombo) S.maxCombo = S.combo; }
    var pts = BS.killScore('bossHit', S.combo, G.base) * n; S.score += pts; if (S.boom) { S.boom.touched = true; }
    pop(e.x + (Math.random() - 0.5) * e.r, e.y - e.r * 0.8, '+' + pts, '#ffd23f', 24 + n * 4);
    burst(e.x, e.y, 8 * n, { shape: 'star', col: '#ffe14d', speed: 320 }); ringFx(e.x, e.y, e.r * 1.1, '#c58bff');
    S.shake = Math.max(S.shake, 4 + n * 2); sfx('pop', S.combo); tone(160, A.ctx ? A.ctx.currentTime : 0, 0.15, 'square', 0.1, 90); bumpCombo();
    var nt = tierNow(); if (nt > S.tier) { S.tier = nt; banner(G.tierWords[nt] || 'WOW!'); }
    if (e.hp <= 0) bossDown(e);
  }
  function bossDown(e) {
    e.dead = true; e.wave.killed++; S.bossKills++;
    S.combo += G.bossComboBonus; if (S.combo > S.maxCombo) S.maxCombo = S.combo; S.tier = tierNow();
    var reward = Math.round(G.bossReward * BS.multFor(S.combo)); S.score += reward;
    S.timeLeft = Math.min(G.maxTime, S.timeLeft + G.bossTime);
    banner('👑 ' + T.bossDown, '#ffd23f'); sfx('fanfare'); setTimeout(function () { sfx('chime'); }, 250); S.shake = 18;
    burst(e.x, e.y, 60, { speed: 600, size: 10 }); smoke(e.x, e.y, 12, 'rgba(220,190,255,.8)'); ringFx(e.x, e.y, e.r * 2, '#ffd23f'); ringFx(e.x, e.y, e.r * 1.4, '#c58bff');
    pop(W / 2, F.y + F.h * 0.6, '+' + reward + '  🔥+' + G.bossComboBonus + '  ⏱+' + G.bossTime, '#ffd23f', 30, 1.8);
    for (var i = 0; i < 4; i++) setTimeout(function () { if (S) burst(W * (0.2 + Math.random() * 0.6), H * (0.2 + Math.random() * 0.3), 20, { speed: 380 }); }, 150 * i);
    bumpCombo();
  }
  function bomb(e) {
    e.dead = true; smoke(e.x, e.y, 10, 'rgba(90,80,110,.7)'); burst(e.x, e.y, 10, { col: '#ffb347', shape: 'star' });
    if (S.mode === 'menu') return;
    if (S.shield) { S.shield = false; sfx('block'); pop(e.x, e.y, '🛡 ' + T.blocked, '#8fdcff', 28, 1.2); ringFx(e.x, e.y, 60, '#8fdcff'); return; }
    S.shake = 16; sfx('ouch'); S.hurt = 1; S.combo = 0; S.tier = 0;
    pop(e.x, e.y, T.ouch + ' 💔', '#ff6b6b', 28, 1.2);
    if (S.mode === 'tut') { coach('💣', T.tBomb, null, T.tBombSub); return; }
    S.lives--; if (navigator.vibrate) try { navigator.vibrate(120); } catch (x) { }
    if (S.lives <= 0) endGame('lives');
  }

  // ---------- throw ----------
  function ptr(ev) { return { x: ev.clientX, y: ev.clientY }; }
  cv.addEventListener('pointerdown', function (ev) {
    if (S.mode !== 'play' && S.mode !== 'tut') return;
    audio(); ev.preventDefault();
    if (S.boom) return;
    var p = ptr(ev), c = catchPt();
    if (BS.dist(p.x, p.y, c.x, c.y) <= catchR()) { S.aim = { pts: [p], id: ev.pointerId }; try { cv.setPointerCapture(ev.pointerId); } catch (x) { } sfx('tap'); }
    else { S.hintCd = 1.6; pop(c.x, c.y - 110 * SC, '👆 ' + T.startOnYou, '#ffe14d', 20, 1.1); ringFx(c.x, c.y, catchR(), '#ffe14d'); }
  });
  cv.addEventListener('pointermove', function (ev) {
    if (!S.aim || ev.pointerId !== S.aim.id) return;
    var evs = ev.getCoalescedEvents ? ev.getCoalescedEvents() : [ev]; if (!evs.length) evs = [ev];
    evs.forEach(function (e2) { var p = ptr(e2), l = S.aim.pts[S.aim.pts.length - 1]; if (BS.dist(p.x, p.y, l.x, l.y) > 5 && S.aim.pts.length < 900) S.aim.pts.push(p); });
  });
  function release(ev) {
    if (!S.aim || (ev && ev.pointerId !== S.aim.id)) return;
    var pts = S.aim.pts, c = catchPt(); S.aim = null;
    var res = BS.checkThrow(pts, c.x, c.y, catchR() * 1.15, 110 * SC);
    if (res === 'ok') { pts.push(c); launch(pts); }
    else if (res === 'end') {
      sfx('buzz'); var e = pts[pts.length - 1]; smoke(e.x, e.y, 4);
      pop(c.x, c.y - 110 * SC, '↩ ' + T.backToYou, '#ff9ad5', 22, 1.3); ringFx(c.x, c.y, catchR(), '#ff6fb5');
      if (S.mode === 'tut') coach('↩', T.backToYou);
    }
  }
  cv.addEventListener('pointerup', release); cv.addEventListener('pointercancel', function () { S.aim = null; });
  function launch(pts) {
    var L = BS.pathLength(pts); if (!isFinite(L) || L <= 0) return;
    S.boom = { pts: pts, L: L, d: 0, speed: Math.max(700, L / 1.8), kills: 0, tnt: false, touched: false, trail: [], prev: pts[0], hitIds: [] };
    S.throws++; sfx('whoosh');
  }
  function stepBoom(dt) {
    var b = S.boom; if (!b) return;
    var d0 = b.d; b.d = Math.min(b.L, b.d + b.speed * dt);
    var br = 16 * SC, steps = Math.max(1, Math.ceil((b.d - d0) / 10)), prev = BS.pointAt(b.pts, d0);
    for (var s = 1; s <= steps; s++) {
      var q = BS.pointAt(b.pts, d0 + (b.d - d0) * s / steps);
      for (var i = 0; i < S.ents.length; i++) {
        var e = S.ents[i]; if (e.dead || e.leaving || e.born > S.t || e.cd > 0) continue;
        if (BS.segDist(prev.x, prev.y, q.x, q.y, e.x, e.y) < e.r + br) { if (e.kind !== 'bomb' && e.kind !== 'time' && e.kind !== 'shield') b.touched = true; hit(e, q.ang); if (S.mode === 'over') return; }
      }
      b.trail.push({ x: q.x, y: q.y, t: S.rt }); prev = q;
    }
    b.ang = (b.ang || 0) + dt * 22; b.pos = prev;
    if (b.d >= b.L) {
      var c = catchPt(); sfx('catch'); ringFx(c.x, c.y, 30, '#fff');

      if (S.mode !== 'menu') {
        if (b.kills >= 3) { var bonus = BS.multiBonus(b.kills, S.combo); S.score += bonus; pop(W / 2, F.y + F.h * 0.55, b.kills + 'x SUPER! +' + bonus, '#ff9ad5', 30, 1.3); burst(c.x, c.y - 60, 20, { speed: 380 }); }
        else if (!b.kills && !b.touched && !b.tnt) { if (S.combo > 0) pop(c.x, c.y - 110 * SC, T.miss + ' · combo 0', '#fff', 18); S.combo = 0; S.tier = 0; }
        else pop(c.x, c.y - 100 * SC, T.catch, '#fff', 16, 0.6);
      }
      S.boom = null; S.trailFade = b.trail;
    }
  }

  // ---------- tutorial ----------
  var TUT = [
    function () { spawnWave({ move: 'bob', items: [{ kind: 'mon', x: 0.32, y: 0.62 }, { kind: 'mon', x: 0.5, y: 0.45 }, { kind: 'mon', x: 0.68, y: 0.62 }] }, true); },
    function () { spawnWave({ move: 'bob', items: [{ kind: 'big', x: 0.5, y: 0.5 }] }, true); },
    function () { spawnWave({ move: 'bob', items: [{ kind: 'tnt', x: 0.5, y: 0.5 }].concat(BS.shapes(6, 'ring', Math.random).map(function (p) { return { kind: 'mon', x: 0.5 + (p.x - 0.5) * 0.55, y: 0.5 + (p.y - 0.45) * 0.55 }; })) }, true); },
    function () { spawnWave({ move: 'bob', items: [{ kind: 'bomb', x: 0.5, y: 0.5 }, { kind: 'mon', x: 0.14, y: 0.35 }, { kind: 'mon', x: 0.2, y: 0.7 }, { kind: 'mon', x: 0.86, y: 0.35 }, { kind: 'mon', x: 0.8, y: 0.7 }] }, true); },
    function () { spawnWave({ move: 'bob', items: [{ kind: 'time', x: 0.35, y: 0.55 }, { kind: 'shield', x: 0.65, y: 0.55 }] }, true); }
  ];
  var TUT_HINT = [null, ['💪', T.tBig, T.tBigSub], ['🧨', T.tTnt, T.tTntSub], ['💣', T.tBomb, T.tBombSub], ['⏱🛡', T.tPower, T.tPowerSub]];
  var TUT_BOMB = 3, TUT_POWER = 4;
  function tutNext() {
    S.tutStep++; S.ents = []; S.waveList = [];
    if (S.tutStep >= TUT.length) { finishTut(); return; }
    TUT[S.tutStep](); S.coachLoop = null; S.tutT = S.t;
    if (TUT_HINT[S.tutStep]) coach(TUT_HINT[S.tutStep][0], TUT_HINT[S.tutStep][1], null, TUT_HINT[S.tutStep][2]);
  }
  function finishTut() {
    save.tutDone = true; persist(); S.ents = []; S.waveList = []; S.mode = 'play'; S.combo = 0; S.tier = 0; S.score = 0; S.shield = S.shield || false; S.lives = G.lives; S.timeLeft = G.startTime; hudLives = -1;
    S.coachLoop = null; coach(''); $('skipTut').hidden = true; banner(T.go, '#5fe08a'); sfx('fanfare'); S.lastWaveBar = Math.floor(S.t / (beatLen * 4));
  }
  function buildLoop() {
    var ts = S.ents.filter(function (e) { return !e.dead && e.born <= S.t && (S.tutStep !== TUT_BOMB || e.kind !== 'bomb'); });
    if (S.tutStep === TUT_BOMB) ts = ts.filter(function (e) { return e.x < W / 2; });
    if (!ts.length) return null;
    var x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9; ts.forEach(function (e) { x0 = Math.min(x0, e.x - e.r); x1 = Math.max(x1, e.x + e.r); y0 = Math.min(y0, e.y - e.r); y1 = Math.max(y1, e.y + e.r); });
    var c = catchPt(), pts = [{ x: c.x, y: c.y }];
    // Path goes straight THROUGH each target (left→right over the top), then back to the player.
    ts.slice().sort(function (p, q) { return p.x - q.x; }).forEach(function (e) { pts.push({ x: e.x, y: e.y }); });
    if (ts.length === 1) { var e0 = ts[0]; pts.splice(1, 0, { x: e0.x - 50, y: e0.y + 40 }); pts.push({ x: e0.x + 50, y: e0.y - 30 }); }
    pts.push({ x: c.x, y: c.y }); return smoothPath(pts);
  }
  function smoothPath(p) {
    var out = [p[0]];
    for (var i = 1; i < p.length; i++) { var a = p[i - 1], b = p[i]; for (var k = 1; k <= 8; k++) out.push({ x: a.x + (b.x - a.x) * k / 8, y: a.y + (b.y - a.y) * k / 8 }); }
    return out;
  }

  // ---------- flow ----------
  function show(id) { howOpen = id === 'howScr'; ['menu', 'nameScr', 'shop', 'board', 'over', 'pause', 'howScr'].forEach(function (s) { $(s).hidden = s !== id; }); }
  function setPlaying(on) { root.classList.toggle('jr-hub-off', on); $('hud').hidden = !on; }
  function startGame(forceTut) {
    audio(); S = fresh('play'); S.px = W / 2; hudLives = -1; save.plays++; persist();
    show(null); setPlaying(true); coach('');
    if (forceTut || !save.tutDone) { S.mode = 'tut'; $('skipTut').hidden = false; tutNext(); }
    else { banner(T.go, '#5fe08a'); S.lastWaveBar = -99; }
    hud();
  }
  function endGame(reason) {
    if (S.mode === 'over') return;
    S.mode = 'over'; S.aim = null; S.endAt = S.rt; coach(''); $('skipTut').hidden = true;
    banner(reason === 'time' ? '⏱ ' + T.timeUp : '💔 ' + T.livesUp, '#ff9ad5'); sfx('over');
    var score = BS.clampScore(S.score), coins = BS.coinsFor(score, G.coinDiv), isBest = score > save.best && score > 0;
    save.coins += coins; if (isBest) save.best = score;
    if (score > 0) save.local = BS.mergeLocal(save.local, { name: save.name, score: score, at: Date.now() }, 20);
    persist();
    $('overTitle').textContent = reason === 'time' ? '⏱ ' + T.timeUp : '💔 ' + T.livesUp;
    $('finalScore').textContent = score.toLocaleString('id-ID'); $('ovCombo').textContent = S.maxCombo; $('ovBest').textContent = save.best.toLocaleString('id-ID'); $('ovCoins').textContent = '+' + coins;
    $('newBest').hidden = !isBest;
    var note = $('sendNote'); note.classList.remove('bad');
    if (score <= 0) note.textContent = '';
    else if (!ONLINE) note.textContent = '📱 ' + T.offline;
    else {
      note.textContent = '⏳ ' + T.sending;
      apiPost(save.name, score).then(function (r) { note.textContent = r === 'ok' ? '🌏 ' + T.sent : '📱 ' + T.sendFail; },
        function () { save.pending.push({ name: save.name, score: score }); save.pending = save.pending.slice(-5); persist(); note.textContent = '📱 ' + T.sendFail; note.classList.add('bad'); });
    }
    setTimeout(function () { if (S.mode !== 'over') return; setPlaying(false); show('over'); refreshMenu(); if (isBest) burst(W / 2, H * 0.3, 40, { speed: 500 }); }, 1300);
  }
  function toMenu() { S = fresh('menu'); S.px = W / 2; setPlaying(false); show('menu'); refreshMenu(); coach(''); $('skipTut').hidden = true; }
  function refreshMenu() { $('meName').textContent = save.name || '—'; $('bestTop').textContent = save.best.toLocaleString('id-ID'); $('coinTop').textContent = save.coins; $('muteBtn').textContent = (save.muted ? '🔇 ' : '🔊 ') + T.mute; }
  function pause() { if (S.mode !== 'play' && S.mode !== 'tut') return; S.prevMode = S.mode; S.mode = 'pause'; S.aim = null; show('pause'); }
  function resume() { if (S.mode !== 'pause') return; S.mode = S.prevMode; show(null); audio(); }

  // name
  function askName(then) {
    show('nameScr'); var inp = $('nameIn'); inp.value = ''; /* t367u: never prefill */ nameCheck(); askName.then = then;
    setTimeout(function () { try { inp.focus(); } catch (e) { } }, 50);
  }
  function nameCheck() { var v = $('nameIn').value, ok = BS.validName(v), h = $('nameHint'); h.textContent = !v.trim() ? T.nameHint : ok ? '✓ ' + BS.cleanName(v) : '⚠ ' + T.nameBad; h.classList.toggle('bad', !!v.trim() && !ok); $('nameGo').disabled = !ok; return ok; }
  $('nameIn').addEventListener('input', nameCheck);
  $('nameForm').addEventListener('submit', function (ev) { ev.preventDefault(); if (!nameCheck()) return; save.name = BS.cleanName($('nameIn').value); persist(); refreshMenu(); var t = askName.then; askName.then = null; if (t) t(); else show('menu'); });
  $('nameBack').addEventListener('click', function () { show('menu'); });
  $('meChip').addEventListener('click', function () { askName(null); });
  if (window.JDNG) JDNG.on(function (n) { var c = BS.cleanName(n); if (BS.validName(c)) { save.name = c; persist(); refreshMenu(); } }); // t367u: name from the jd-namegate modal

  $('playBtn').addEventListener('click', function () { audio(); if (!BS.validName(save.name)) askName(function () { startGame(false); }); else startGame(false); });
  $('howBtn').addEventListener('click', function () { audio(); show('howScr'); drawLegend(); });
  $('howBack').addEventListener('click', function () { show('menu'); });
  $('howBack2').addEventListener('click', function () { show('menu'); });
  $('howPlay').addEventListener('click', function () { audio(); if (!BS.validName(save.name)) askName(function () { startGame(true); }); else startGame(true); });
  $('muteBtn').addEventListener('click', function () { save.muted = !save.muted; persist(); audio(); if (A.master) A.master.gain.value = save.muted ? 0 : 0.6; refreshMenu(); });
  $('pauseBtn').addEventListener('click', pause);
  $('resumeBtn').addEventListener('click', resume);
  $('quitBtn').addEventListener('click', toMenu);
  $('skipTut').addEventListener('click', function () { if (S.mode === 'tut') finishTut(); });
  $('overAgain').addEventListener('click', function () { startGame(false); });
  $('overMenu').addEventListener('click', toMenu);
  $('overBoard').addEventListener('click', function () { openBoard('over'); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' || e.key === 'p') { if (S.mode === 'pause') resume(); else pause(); } });
  document.addEventListener('visibilitychange', function () { if (document.hidden) pause(); });

  // shop
  var shopOpen = false;
  function renderShop() {
    $('coinShop').textContent = save.coins;
    function list(el, items, kind, cur) {
      el.innerHTML = '';
      items.forEach(function (it) {
        var owned = save.owned[kind].indexOf(it.id) >= 0 || it.price === 0, b = document.createElement('button');
        b.type = 'button'; b.className = 'item' + (cur === it.id ? ' sel' : '') + (owned ? '' : ' lock');
        var sw = kind === 'skins' ? '<span class="sw" style="background:' + (it.rainbow ? 'linear-gradient(90deg,#ff5fa2,#ffd23f,#5fe08a,#5f7bff)' : 'linear-gradient(135deg,' + it.a + ' 50%,' + it.b + ' 50%)') + '"></span>'
          : '<span class="tr">' + ({ plain: '💨', star: '⭐', bubble: '💧', rainbow: '🌈', fire: '🔥', heart: '💖' }[it.type] || '✨') + '</span>';
        b.innerHTML = sw + '<span>' + it.name + '</span><span class="pr">' + (cur === it.id ? '✓ ' + T.used : owned ? T.use : '🪙 ' + it.price) + '</span>';
        b.addEventListener('click', function () {
          audio();
          if (!owned) { if (save.coins < it.price) { toast('🪙 ' + T.notEnough + ' (' + save.coins + '/' + it.price + ')'); sfx('buzz'); return; } save.coins -= it.price; save.owned[kind].push(it.id); toast('🎉 ' + T.bought); sfx('fanfare'); }
          else sfx('tap');
          if (kind === 'skins') save.skin = it.id; else save.trail = it.id; persist(); renderShop(); refreshMenu();
        });
        el.appendChild(b);
      });
    }
    list($('skinList'), SHOP.skins, 'skins', save.skin); list($('trailList'), SHOP.trails, 'trails', save.trail);
  }
  $('shopBtn').addEventListener('click', function () { audio(); renderShop(); show('shop'); shopOpen = true; });
  $('shopBack').addEventListener('click', function () { shopOpen = false; show('menu'); });
  var pvc = $('pv').getContext('2d'), pvTrail = [];
  function drawPreview(t) {
    var w = 320, h = 120; pvc.clearRect(0, 0, w, h);
    var x = w / 2 + Math.cos(t * 2.2) * 120, y = h / 2 + Math.sin(t * 4.4) * 34;
    pvTrail.push({ x: x, y: y, t: t }); while (pvTrail.length > 40) pvTrail.shift();
    R.trail(pvc, pvTrail, t, trailObj().type, skinObj()); R.boomerang(pvc, x, y, t * 14, 22, skinObj(), t);
  }

  // how-to screen: legend icons drawn with the real sprites + animated loop demo
  var howOpen = false, legendDone = false;
  function drawLegend() {
    if (legendDone) return; legendDone = true;
    document.querySelectorAll('canvas.ico').forEach(function (cv2) {
      var k = cv2.getAttribute('data-k'), g = cv2.getContext('2d'), d = 2; cv2.width = 48 * d; cv2.height = 48 * d; g.scale(d, d);
      var r = { mon: 14, big: 16, boss: 13, tnt: 13, bomb: 12, time: 13, shield: 13 }[k] || 14;
      var e = { kind: k, x: 24, y: k === 'boss' ? 29 : k === 'big' ? 22 : 25, r: r, born: -9, hp: k === 'big' ? 2 : k === 'boss' ? 10 : 1, maxHp: 10, seed: 1, flash: 0, leaving: 0 };
      R.entity(g, e, 0.4, 0.6);
    });
  }
  var demoMons = [{ x: 105, y: 60 }, { x: 160, y: 42 }, { x: 215, y: 60 }];
  function drawHowDemo(t) {
    var c2 = $('howDemo'); if (!c2) return; var g = c2.getContext('2d'), w = 320, h = 150;
    var gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#7fd4ff'); gr.addColorStop(1, '#d9f4ff'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.fillStyle = '#8fd16a'; g.fillRect(0, h - 18, w, 18);
    var per = 3.2, k = (t % per) / per, px = 160, py = h - 18, cyP = py - 22;
    var loop = smoothPath([{ x: px, y: cyP }].concat(demoMons.map(function (m) { return { x: m.x, y: m.y }; })).concat([{ x: px, y: cyP }]));
    var L = BS.pathLength(loop), fly = Math.min(1, k / 0.7), done = k >= 0.7;
    g.save(); g.strokeStyle = 'rgba(255,255,255,.8)'; g.lineWidth = 3; g.setLineDash([6, 7]); g.beginPath(); loop.forEach(function (p, i) { i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y); }); g.stroke(); g.restore();
    var bq = BS.pointAt(loop, fly * L);
    demoMons.forEach(function (m, i) { var hitAt = (i + 1) / (demoMons.length + 1); m.hitK = m.hitK || 0;
      var gone = fly >= hitAt * 0.98 && !(k < 0.02);
      if (!gone) R.entity(g, { kind: 'mon', x: m.x, y: m.y, r: 13, born: -9, hp: 1, seed: i, flash: 0, leaving: 0 }, t, 0.5);
      else if (fly - hitAt < 0.12) { R.star(g, m.x, m.y, 16 * (1 - (fly - hitAt) * 8), '#ffe14d'); g.strokeStyle = '#fff'; g.lineWidth = 3; g.beginPath(); g.moveTo(m.x - 14, m.y + 10); g.lineTo(m.x + 14, m.y - 10); g.stroke(); } });
    R.player(g, px, py, 0.55, t, false, !done, skinObj(), '', false, 0);
    if (!done) R.boomerang(g, bq.x, bq.y, t * 18, 11, skinObj(), t);
    g.font = '900 15px system-ui,sans-serif'; g.textAlign = 'center'; g.lineWidth = 4; g.strokeStyle = '#3a2260'; g.fillStyle = '#ffe14d';
    if (done && k < 0.95) { g.strokeText('💥 ×3!', 160, 100); g.fillText('💥 ×3!', 160, 100); }
  }

  // board
  var boardFrom = 'menu', boardTab = ONLINE ? 'on' : 'lo';
  function openBoard(from) { boardFrom = from; show('board'); setTab(ONLINE ? 'on' : 'lo'); }
  function setTab(tab) {
    boardTab = tab; $('tabOn').classList.toggle('on', tab === 'on'); $('tabLo').classList.toggle('on', tab === 'lo');
    var note = $('boardNote'), ol = $('rank');
    if (tab === 'lo' || !ONLINE) { note.textContent = tab === 'on' ? '📴 ' + T.offlineBoard : ''; fill(save.local); if (tab === 'on') { $('tabOn').classList.remove('on'); $('tabLo').classList.add('on'); } return; }
    note.textContent = '⏳ ' + T.loading; ol.innerHTML = '';
    apiGet().then(function (rows) { if (boardTab !== 'on') return; note.textContent = ''; fill(rows); }, function () { if (boardTab !== 'on') return; note.textContent = '📴 ' + T.offlineBoard; fill(save.local); });
  }
  function fill(rows) {
    var ol = $('rank'); ol.innerHTML = '';
    if (!rows.length) { $('boardNote').textContent = '🌟 ' + T.empty; return; }
    rows.slice(0, 50).forEach(function (r) { var li = document.createElement('li'); if (r.name === save.name) li.className = 'me'; var n = document.createElement('span'); n.textContent = r.name; var s = document.createElement('b'); s.textContent = BS.clampScore(r.score).toLocaleString('id-ID'); li.appendChild(n); li.appendChild(s); ol.appendChild(li); });
  }
  $('boardBtn').addEventListener('click', function () { openBoard('menu'); });
  $('boardBack').addEventListener('click', function () { show(boardFrom); });
  $('tabOn').addEventListener('click', function () { setTab('on'); });
  $('tabLo').addEventListener('click', function () { setTab('lo'); });

  // ---------- main loop ----------
  var last = performance.now(); S.rt = 0;
  function frame(now) {
    var dt = Math.min(0.05, (now - last) / 1000); last = now;
    var rt = (S.rt || 0) + dt; S.rt = rt;
    if (S.mode === 'play' || S.mode === 'tut' || S.mode === 'menu' || S.mode === 'over') update(dt);
    draw(rt);
    if (shopOpen && !$('shop').hidden) drawPreview(rt);
    if (howOpen) drawHowDemo(rt);
    requestAnimationFrame(frame);
  }
  function update(dt) {
    S.t += dt;
    var active = S.mode === 'play' || S.mode === 'tut';
    // music on the game clock
    if (active && A.ctx && !save.muted) { while (S.nextStep * stepLen < S.t + 0.12) { var when = A.ctx.currentTime + Math.max(0, S.nextStep * stepLen - S.t); musicStep(S.nextStep, when, S.tier); S.nextStep++; } }
    else S.nextStep = Math.ceil(S.t / stepLen);
    // player walks only when idle
    var c = catchPt(), walking = !S.aim && !S.boom && S.mode !== 'over';
    if (walking) { S.px += S.pdir * 48 * SC * dt; var lo = W * 0.2, hi = W * 0.8; if (S.px < lo) { S.px = lo; S.pdir = 1; } if (S.px > hi) { S.px = hi; S.pdir = -1; } }
    S.walking = walking; S.hurt = Math.max(0, S.hurt - dt); S.shake = Math.max(0, S.shake - dt * 40); S.hintCd = Math.max(0, S.hintCd - dt);
    // timer
    if (S.mode === 'play') {
      S.timeLeft -= dt;
      var sec = Math.ceil(S.timeLeft); if (sec <= 10 && sec < S.lastTick && sec > 0) sfx('tick'); S.lastTick = sec;
      if (S.timeLeft <= 0) { S.timeLeft = 0; endGame('time'); }
    }
    // waves on bar boundaries
    var bar = Math.floor(S.t / (beatLen * 4));
    if (bar !== S.lastBar) {
      S.lastBar = bar;
      var alive = S.ents.some(function (e) { return !e.dead && !e.leaving && (e.kind === 'mon' || e.kind === 'big' || e.kind === 'boss'); });
      var bossAlive = S.ents.some(function (e) { return e.kind === 'boss' && !e.dead && !e.leaving; });
      if (S.mode === 'play') {
        if (bossAlive) { if (bar - S.lastWaveBar >= G.waveEveryBars) { spawnWave({ move: 'bob', items: [{ kind: 'mon', x: 0.1 + RNG() * 0.15, y: 0.15 + RNG() * 0.6 }, { kind: 'mon', x: 0.75 + RNG() * 0.15, y: 0.15 + RNG() * 0.6 }] }); S.lastWaveBar = bar; } }
        else if (!alive || bar - S.lastWaveBar >= G.waveEveryBars) {
          if (BS.bossDue(S.normal, G.bossEvery, S.lastBossAt)) startBoss();
          else { spawnWave(); S.normal++; }
          S.lastWaveBar = bar;
        }
      }
      if (S.mode === 'menu' && !alive) spawnWave({ move: 'bob', items: BS.shapes(5, 'arc', Math.random).map(function (p, i) { return { kind: i === 2 ? 'tnt' : i === 0 ? 'big' : 'mon', x: p.x, y: p.y }; }) }, true);
    }
    // entities
    for (var i = S.ents.length - 1; i >= 0; i--) {
      var e = S.ents[i]; place(e); e.flash = Math.max(0, e.flash - dt); e.cd = Math.max(0, e.cd - dt);
      if (!e.leaving && S.t > e.expire) { e.leaving = 0.001; if (!e.dead && (e.kind === 'mon' || e.kind === 'big' || e.kind === 'boss')) e.wave.escaped++; if (!e.dead && e.kind === 'boss' && S.mode === 'play') { pop(W / 2, F.y + F.h * 0.3, T.bossGone, '#fff', 26, 1.4); } }
      if (e.leaving) e.leaving += dt;
      if (e.dead || e.leaving > 0.7) S.ents.splice(i, 1);
    }
    // demo throw in menu
    if (S.mode === 'menu') { S.demoT += dt; if (!S.boom && S.demoT > 2.4 && S.ents.length) { S.demoT = 0; S.tutStep = 0; var lp = buildLoop(); S.tutStep = -1; if (lp) launch(lp); } }
    stepBoom(dt);
    // tutorial progress
    if (S.mode === 'tut') {
      var left = S.ents.filter(function (e) { return !e.dead && e.kind !== 'bomb'; }).length;
      if (!left && !S.boom) tutNext();
      else if (S.tutStep === TUT_POWER && S.t - S.tutT > 10 && !S.boom) tutNext();
      if (S.mode === 'tut' && !S.aim && !S.boom) {
        S.coachLoop = buildLoop();
        if (S.tutStep === 0) { var k = ((S.t - S.tutT) % 2.6) / 2.6; if (k < 0.18) coach('👆', T.t1, null, T.tLoopSub); else if (k < 0.82) coach('💥', T.t2, null, T.tLoopSub); else coach('↩', T.t3, null, T.tLoopSub); }
      } else S.coachLoop = null;
    } else if (S.mode === 'play' && S.bossHintT != null && S.t - S.bossHintT < 3.5) coach('👑', T.bossHint, null, T.bossHintSub);
    else if (S.mode === 'play' && S.throws === 0 && S.t > 3 && !S.aim) coach('👆', T.t1 + ' → 💥 → ↩', null, T.tLoopSub);
    else if (S.mode === 'play' && (S.throws > 0 || S.bossHintT != null) && coachKey) coach('');
    // particles & popups
    S.parts.forEach(function (p) { p.life -= dt; p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.98; p.rot += p.vr * dt; });
    S.parts = S.parts.filter(function (p) { return p.life > 0; }); if (S.parts.length > 600) S.parts.splice(0, S.parts.length - 600);
    S.pops.forEach(function (p) { p.life -= dt; p.y += p.vy * dt; p.vy *= 0.95; }); S.pops = S.pops.filter(function (p) { return p.life > 0; });
    if (active) hud();
  }
  function draw(rt) {
    cx.setTransform(DPR, 0, 0, DPR, 0, 0);
    var beat = ((S.t % beatLen) / beatLen), tier = S.mode === 'menu' ? 1 : S.tier;
    var sx = S.shake ? (Math.random() - 0.5) * S.shake : 0, sy = S.shake ? (Math.random() - 0.5) * S.shake : 0;
    cx.save(); cx.translate(sx, sy);
    R.background(cx, W, H, rt, tier, beat, ground);
    S.ents.forEach(function (e) { if (e.born <= S.t) R.entity(cx, e, S.t, beat); });
    if (S.coachLoop) R.coach(cx, S.coachLoop, S.t - S.tutT, catchPt().x, catchPt().y, catchR());
    var c = catchPt(), skin = skinObj(), tr = trailObj();
    if (S.mode === 'play' || S.mode === 'tut') { if (!S.aim && !S.boom) R.ring(cx, c.x, c.y, catchR(), rt, 'rgba(255,255,255,.7)'); }
    R.player(cx, S.px, ground, SC, rt, S.walking, !!S.aim || !!S.boom, skin, S.mode === 'menu' ? '' : save.name, S.shield, S.hurt);
    if (S.aim) { var e = S.aim.pts[S.aim.pts.length - 1]; R.aim(cx, S.aim.pts, c.x, c.y, catchR(), rt, S.aim.pts.length > 8 && BS.dist(e.x, e.y, c.x, c.y) < catchR() * 1.15); }
    if (S.boom) { R.trail(cx, S.boom.trail, S.rt, tr.type, skin); if (S.boom.pos) R.boomerang(cx, S.boom.pos.x, S.boom.pos.y, S.boom.ang, 20 * SC, skin, rt); }
    else { if (S.trailFade) R.trail(cx, S.trailFade, S.rt, tr.type, skin); if (S.mode !== 'menu' && !S.aim) R.boomerang(cx, c.x + 20 * SC, c.y - 14 * SC, -0.6, 13 * SC, skin, rt); }
    R.particles(cx, S.parts); R.popups(cx, S.pops);
    cx.restore();
  }

  // test/debug hook (read-only helpers)
  window.__bs = { get S() { return S; }, boss: function () { if (S.mode === 'play') { S.ents = []; startBoss(); } }, start: startGame, end: endGame, catchPt: catchPt, catchR: catchR, online: ONLINE, save: save, finishTut: function () { if (S.mode === 'tut') finishTut(); } };

  refreshMenu(); show('menu'); setPlaying(false); flushPending();
  requestAnimationFrame(frame);
})();

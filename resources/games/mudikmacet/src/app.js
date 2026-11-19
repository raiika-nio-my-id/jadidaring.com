// Mudik Macet - screens, input, Web Audio synth, records, tutorial, daily worker.
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); }, root = document.documentElement;
  var CFG = JSON.parse($('website-config').textContent), M = window.MM, R = window.MMR, TX = CFG.text;
  function t(k, v) { var s = TX[k] == null ? k : TX[k]; if (v) for (var n in v) s = s.split('{' + n + '}').join(v[n]); return s; }
  var store = {
    get: function (k, d) { try { var v = localStorage.getItem('mudikmacet.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem('mudikmacet.' + k, JSON.stringify(v)); } catch (e) {} }
  };
  // ---------- texts into DOM ----------
  document.querySelectorAll('[data-t]').forEach(function (el) { el.textContent = t(el.getAttribute('data-t')); });
  document.querySelectorAll('[data-t-aria]').forEach(function (el) { el.setAttribute('aria-label', t(el.getAttribute('data-t-aria'))); });
  document.querySelectorAll('[data-c]').forEach(function (el) { var k = el.getAttribute('data-c').split('.'), v = CFG; k.forEach(function (x) { v = v && v[x]; }); el.textContent = v || ''; });
  // ---------- sound (synth only) ----------
  var Snd = {
    ctx: null, muted: store.get('mute', 0) === 1,
    ensure: function () { if (!this.ctx) { var A = window.AudioContext || window.webkitAudioContext; if (A) try { this.ctx = new A(); } catch (e) {} } if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); },
    tone: function (f, dur, type, vol, when, to) {
      if (this.muted || !this.ctx) return; var c = this.ctx, t0 = c.currentTime + (when || 0), o = c.createOscillator(), g = c.createGain();
      o.type = type || 'sine'; o.frequency.setValueAtTime(f, t0); if (to) o.frequency.exponentialRampToValueAtTime(to, t0 + dur);
      g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol || 0.2, t0 + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(g); g.connect(c.destination); o.start(t0); o.stop(t0 + dur + 0.02);
    },
    noise: function (dur, vol, freq, when) {
      if (this.muted || !this.ctx) return; var c = this.ctx, t0 = c.currentTime + (when || 0), n = Math.floor(c.sampleRate * dur), b = c.createBuffer(1, n, c.sampleRate), d = b.getChannelData(0);
      for (var i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
      var s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain(); s.buffer = b; f.type = 'bandpass'; f.frequency.value = freq || 1500; f.Q.value = 1.2; g.gain.value = vol || 0.3;
      s.connect(f); f.connect(g); g.connect(c.destination); s.start(t0);
    },
    clack: function () { this.noise(0.06, 0.35, 2200); this.tone(180, 0.06, 'square', 0.06); },
    slide: function () { this.noise(0.18, 0.12, 600); },
    horn: function () { this.tone(392, 0.16, 'square', 0.07); this.tone(494, 0.16, 'square', 0.06); },
    tintin: function () { var s = this; [0, 0.22].forEach(function (w) { s.tone(392, 0.15, 'square', 0.07, w); s.tone(494, 0.15, 'square', 0.06, w); }); },
    vroom: function () { this.tone(70, 0.7, 'sawtooth', 0.12, 0, 260); this.noise(0.5, 0.15, 400); },
    win: function () { var s = this; [523, 659, 784, 1047, 784, 1047].forEach(function (f, i) { s.tone(f, 0.22, 'triangle', 0.18, 0.12 * i); }); s.tintin(); },
    star: function (i) { this.tone(880 * (1 + i * 0.26), 0.25, 'sine', 0.2); this.tone(1760 * (1 + i * 0.26), 0.12, 'sine', 0.05); },
    blip: function () { this.tone(660, 0.06, 'triangle', 0.12); }
  };
  function syncMute() { $('muteBtn').textContent = Snd.muted ? '🔇' : '🔊'; $('muteBtn').setAttribute('aria-label', t(Snd.muted ? 'unmute' : 'mute')); }
  $('muteBtn').addEventListener('click', function () { Snd.muted = !Snd.muted; store.set('mute', Snd.muted ? 1 : 0); syncMute(); Snd.ensure(); Snd.blip(); });
  syncMute();
  // ---------- name (placeholder only, never prefilled with the brand) ----------
  var nameIn = $('nameIn'), saved = store.get('name', '');
  if (saved && typeof saved === 'string') nameIn.value = saved;
  nameIn.addEventListener('input', function () { store.set('name', nameIn.value.trim().slice(0, 16)); });
  function driver() { var v = nameIn.value.trim(); return v || t('driver'); }
  // ---------- toast ----------
  var toastT; function toast(msg) { var el = $('toast'); el.textContent = msg; el.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(function () { el.classList.remove('on'); }, 1300); }
  // ---------- daily (generated in a worker, cached per WITA date) ----------
  var DK = M.dateKey(Date.now(), 480), dailyLvl = null, dailyWait = false;
  (function () {
    var c = store.get('daily', null); if (c && c.dk === DK && c.lvl && c.lvl.g) { dailyLvl = c.lvl; return; }
    var done = function (l) { dailyLvl = l; store.set('daily', { dk: DK, lvl: l }); updateHome(); if (dailyWait) { dailyWait = false; startDaily(); } };
    var opt = CFG.game.daily;
    try {
      var src = $('mm-sim').textContent + '\nonmessage=function(e){postMessage(MM.generate("mudikmacet|"+e.data.dk,e.data.opt))};';
      var w = new Worker(URL.createObjectURL(new Blob([src], { type: 'text/javascript' })));
      w.onmessage = function (e) { done(e.data); w.terminate(); }; w.onerror = function (ev) { if (ev && ev.preventDefault) ev.preventDefault(); setTimeout(function () { done(M.generate('mudikmacet|' + DK, opt)); }, 30); };
      w.postMessage({ dk: DK, opt: opt });
    } catch (e) { setTimeout(function () { done(M.generate('mudikmacet|' + DK, opt)); }, 60); }
  })();
  // ---------- records ----------
  function rec() { return store.get('best', {}); }
  function unlocked(i) { return i === 0 || !!rec()[CFG.levels[i - 1].id]; }
  function nextLevelIdx() { var r = rec(); for (var i = 0; i < CFG.levels.length; i++) if (!r[CFG.levels[i].id]) return i; return CFG.levels.length - 1; }
  function fmtDate(dk) { var p = dk.split('-'), mon = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']; return +p[2] + ' ' + mon[+p[1] - 1] + ' ' + p[0]; }
  function updateHome() {
    var r = rec(), tut = M.tutDone(localStorage), n = nextLevelIdx();
    $('playLbl').textContent = tut ? t('play') + ' · ' + t('levelN', { n: n + 1 }) : t('play');
    $('dailySub').textContent = dailyLvl ? (r['d:' + DK] ? t('dailyDone') : fmtDate(DK) + ' · ' + t('parHint', { par: dailyLvl.par }).replace(' untuk ⭐⭐⭐', '')) : t('dailyLoading');
    var stars = 0, cleared = 0; CFG.levels.forEach(function (l) { if (r[l.id]) { cleared++; stars += r[l.id].stars; } });
    $('statStrip').innerHTML = ''; [['🏁', cleared + '/' + CFG.levels.length], ['⭐', stars + '/' + CFG.levels.length * 3]].forEach(function (x) { var s = document.createElement('span'); s.textContent = x[0] + ' ' + x[1]; $('statStrip').appendChild(s); });
  }
  // ---------- game state ----------
  var Game = null, homePreview = M.parse(CFG.levels[4]);
  function newGame(mode, def, meta) {
    var ps = M.parse(def); R.clearFx();
    Game = { mode: mode, def: def, id: meta.id, name: meta.name, par: def.par, start: M.clone(ps), pieces: ps, hist: [], hinted: false, over: false,
      vis: ps.map(function (p) { return { x: p.x, y: p.y }; }), drag: null, hint: null, sel: 0, carOut: 0, step: 0, shakeK: -1, glowK: -1 };
    return Game;
  }
  function enterPlay() {
    $('home').hidden = true; $('hud').hidden = false; $('winDlg').hidden = true; $('levelsDlg').hidden = true; root.classList.add('playing', 'jr-hub-off');
    var demo = Game.mode === 'demo'; $('demoTag').hidden = !demo; ['undoBtn', 'resetBtn', 'hintBtn'].forEach(function (id) { $(id).disabled = demo; });
    $('coach').hidden = Game.mode !== 'tutorial'; $('hintBtn').hidden = Game.mode === 'tutorial';
    $('lvName').textContent = Game.name; relayout(); hud(); coach();
  }
  function goHome() {
    Game = null; $('hud').hidden = true; $('winDlg').hidden = true; $('home').hidden = false; root.classList.remove('playing', 'jr-hub-off');
    if (/^#(demo|tutorial|daily)$/.test(location.hash)) history.replaceState(null, '', location.pathname + location.search);
    updateHome(); relayout();
  }
  function startLevel(i) { var l = CFG.levels[i]; newGame('pack', l, { id: l.id, name: t('levelN', { n: i + 1 }) + ' · ' + l.name, idx: i }); Game.idx = i; enterPlay(); toast(l.blurb); }
  function startTutorial() { newGame('tutorial', CFG.tutorial, { id: 'tut', name: t('tutTitle') }); enterPlay(); }
  function startDaily() {
    if (!dailyLvl) { dailyWait = true; toast(t('dailyLoading')); return; }
    newGame('daily', dailyLvl, { id: 'd:' + DK, name: t('dailyTitle') + ' · ' + fmtDate(DK) }); enterPlay();
  }
  function startDemo() {
    var i = CFG.levels.findIndex(function (l) { return l.id === CFG.game.demoLevel; }); if (i < 0) i = 0;
    var l = CFG.levels[i]; newGame('demo', l, { id: l.id, name: t('levelN', { n: i + 1 }) + ' · ' + l.name });
    var sol = M.solve(Game.pieces).path; for (var k = 0; k < CFG.game.demoMoves && k < sol.length; k++) { Game.hist.push(Game.pieces); Game.pieces = M.move(Game.pieces, sol[k][0], sol[k][1]); }
    Game.vis = Game.pieces.map(function (p) { return { x: p.x, y: p.y }; }); var nx = sol[CFG.game.demoMoves]; if (nx) Game.hint = { k: nx[0], d: nx[1] };
    enterPlay();
  }
  function moves() { return Game.hist.length; }
  function starStr(n) { return '★★★'.slice(0, n) + '☆☆☆'.slice(0, 3 - n); }
  function hud() {
    if (!Game) return; $('mvNum').textContent = moves(); $('parNum').textContent = Game.par;
    $('starPre').textContent = Game.mode === 'tutorial' ? '' : starStr(M.stars(Math.max(moves(), Game.par), Game.par, Game.hinted, CFG.game.stars));
    $('undoBtn').disabled = Game.mode === 'demo' || !moves() || Game.over;
  }
  function tutStep() { return Game && Game.mode === 'tutorial' ? CFG.tutorial.steps[Game.step] : null; }
  function pieceIdx(id) { for (var i = 0; i < Game.pieces.length; i++) if (Game.pieces[i].id === id) return i; return -1; }
  function coach() {
    var s = tutStep(); if (!s) { if (Game) Game.hand = null; return; }
    $('coachTxt').textContent = s.text; $('coachSub').textContent = s.sub || '';
    var k = pieceIdx(s.piece); Game.hand = { k: k, dir: s.dir, dist: s.piece === 'A' ? 2 : 1 }; Game.glowK = k;
  }
  function blocksExit(p) { var car = Game.pieces[0]; return M.cells(p).some(function (c) { return c[1] === M.EXIT_ROW && c[0] >= car.x + car.len; }); }
  function tutCheck() {
    var s = tutStep(); if (!s) return; var p = Game.pieces[pieceIdx(s.piece)];
    if (s.piece === 'A' ? M.isWin(Game.pieces) : !blocksExit(p)) { Game.step++; Snd.star(Game.step - 1); coach(); }
  }
  // ---------- moves ----------
  function commit(k, d) {
    if (!Game || Game.over) return false; var n = M.move(Game.pieces, k, d); if (!n) return false;
    Game.hist.push(Game.pieces); Game.pieces = n; Game.hint = null; Game.sel = k; Snd.clack(); Snd.slide(); R.exhaust(n[k], d > 0 ? 1 : -1);
    if (Game.mode === 'tutorial') tutCheck();
    hud(); if (M.isWin(n)) win(); return true;
  }
  function undo() { if (!Game || Game.over || !moves() || Game.mode === 'demo') return; Game.pieces = Game.hist.pop(); Game.hint = null; Snd.blip(); hud(); }
  function reset() { if (!Game || Game.over || Game.mode === 'demo') return; Game.pieces = M.clone(Game.start); Game.hist = []; Game.hinted = false; Game.hint = null; Game.step = 0; coach(); Snd.blip(); hud(); }
  function hint() {
    if (!Game || Game.over || Game.mode !== 'pack' && Game.mode !== 'daily') return; Snd.ensure();
    if (M.exitClear(Game.pieces)) { Game.hint = { k: 0, d: M.W - Game.pieces[0].len - Game.pieces[0].x }; toast(t('hintNone')); return; }
    var s = M.solve(Game.pieces, 250000); if (!s || !s.path.length) { toast(t('hintSolving')); return; }
    Game.hint = { k: s.path[0][0], d: s.path[0][1] }; Game.hinted = true; Snd.tone(990, 0.18, 'sine', 0.15); hud(); toast(t('hinted'));
  }
  function win() {
    Game.over = true; Game.drag = null; Game.hand = null; Game.glowK = -1; var g = Game; Snd.vroom(); hud();
    var t0 = performance.now(); (function drive() { if (Game !== g) return; var e = (performance.now() - t0) / 800; g.carOut = Math.min(4, e * e * 4); if (Math.random() < 0.7) R.exhaust({ dir: 'h', x: g.pieces[0].x + g.carOut, y: g.pieces[0].y, len: 2 }, 1); if (e < 1) requestAnimationFrame(drive); })();
    setTimeout(function () { if (Game !== g) return; showWin(g); }, 850);
  }
  function showWin(g) {
    var mv = g.hist.length, st = g.mode === 'tutorial' ? 3 : M.stars(mv, g.par, g.hinted, CFG.game.stars), best = mv, isNew = false;
    if (g.mode === 'tutorial') M.setTut(localStorage, true);
    else if (g.mode !== 'demo') { var m = M.mergeBest(rec(), g.id, mv, st); store.set('best', m.rec); best = m.rec[g.id].moves; isNew = m.isNew && (m.rec[g.id].plays > 1); }
    R.confetti(160); Snd.win();
    $('winTitle').textContent = t('winTitle');
    $('winSub').textContent = g.mode === 'tutorial' ? t('tutDone') : t('winSub', { name: driver(), moves: mv });
    var badge = isNew ? t('newBest') : (g.hinted ? t('hinted') : (mv <= g.par ? t('perfect') : '')); $('winBadge').textContent = badge; $('winBadge').hidden = !badge;
    $('wMoves').textContent = mv; $('wPar').textContent = g.par; $('wBest').textContent = best;
    var ws = $('winStars'); ws.innerHTML = ''; for (var i = 0; i < 3; i++) { var s = document.createElement('i'); s.textContent = '⭐'; ws.appendChild(s); }
    ws.setAttribute('aria-label', st + ' / 3');
    for (var j = 0; j < st; j++) (function (j) { setTimeout(function () { ws.children[j].classList.add('on'); Snd.star(j); }, 300 + j * 280); })(j);
    var hasNext = g.mode === 'tutorial' || (g.mode === 'pack' && g.idx < CFG.levels.length - 1);
    $('nextBtn').textContent = hasNext ? t('next') + ' · ' + t('levelN', { n: g.mode === 'tutorial' ? 1 : g.idx + 2 }) : t('menu');
    $('winDlg').hidden = false; $('nextBtn').focus();
  }
  $('nextBtn').addEventListener('click', function () { Snd.ensure(); Snd.blip(); var g = Game; if (!g) return goHome(); if (g.mode === 'tutorial') return startLevel(0); if (g.mode === 'pack' && g.idx < CFG.levels.length - 1) return startLevel(g.idx + 1); goHome(); });
  $('againBtn').addEventListener('click', function () { Snd.blip(); var g = Game; if (!g) return; if (g.mode === 'pack') startLevel(g.idx); else if (g.mode === 'daily') startDaily(); else startTutorial(); });
  $('menuBtn').addEventListener('click', function () { Snd.blip(); goHome(); });
  $('backBtn').addEventListener('click', function () { Snd.blip(); goHome(); });
  $('undoBtn').addEventListener('click', undo); $('resetBtn').addEventListener('click', reset); $('hintBtn').addEventListener('click', hint);
  $('skipTut').addEventListener('click', function () { M.setTut(localStorage, true); startLevel(0); });
  // ---------- home buttons ----------
  $('playBtn').addEventListener('click', function () { Snd.ensure(); Snd.blip(); if (!M.tutDone(localStorage)) startTutorial(); else startLevel(nextLevelIdx()); });
  $('dailyBtn').addEventListener('click', function () { Snd.ensure(); Snd.blip(); startDaily(); });
  $('howBtn').addEventListener('click', function () { Snd.ensure(); Snd.blip(); startTutorial(); });
  $('levelsBtn').addEventListener('click', function () {
    Snd.ensure(); Snd.blip(); var gEl = $('lvGrid'), r = rec(); gEl.innerHTML = '';
    CFG.levels.forEach(function (l, i) {
      var b = document.createElement('button'), o = r[l.id], u = unlocked(i); b.type = 'button'; b.className = 'lv' + (o ? ' done' : '') + (u ? '' : ' lock');
      b.innerHTML = '<b></b><span class="nm"></span><span class="st"></span>'; b.children[0].textContent = i + 1; b.children[1].textContent = l.name; b.children[2].textContent = o ? starStr(o.stars) : (u ? t('par') + ' ' + l.par : t('locked'));
      b.setAttribute('aria-label', t('levelN', { n: i + 1 }) + ' ' + l.name + (u ? '' : ' (' + t('locked') + ')'));
      b.addEventListener('click', function () { if (!u) { Snd.horn(); toast(t('locked')); return; } $('levelsDlg').hidden = true; startLevel(i); });
      gEl.appendChild(b);
    });
    $('levelsDlg').hidden = false;
  });
  $('lvClose').addEventListener('click', function () { $('levelsDlg').hidden = true; });
  // ---------- pointer input on the board ----------
  var cv = $('cv');
  function pieceAt(gx, gy) { var o = M.grid(Game.pieces); return o[Math.floor(gy) * M.W + Math.floor(gx)]; }
  cv.addEventListener('pointerdown', function (e) {
    Snd.ensure(); if (!Game || Game.over || Game.mode === 'demo' || !$('winDlg').hidden) return;
    var h = R.hit(e.clientX, e.clientY); if (!h.inside) return; var k = pieceAt(h.x, h.y); if (k == null || k < 0) return;
    var p = Game.pieces[k]; e.preventDefault();
    if (p.fixed) { Snd.horn(); Game.shakeK = k; setTimeout(function () { if (Game) Game.shakeK = -1; }, 300); toast(t('polisi')); return; }
    var s = tutStep(); if (s && p.id !== s.piece) { Snd.horn(); toast(t('tutLocked')); return; }
    var l = M.limits(Game.pieces, k); Game.drag = { k: k, sx: e.clientX, sy: e.clientY, min: l.min, max: l.max, off: 0, bumped: false, id: e.pointerId }; Game.sel = k;
    try { cv.setPointerCapture(e.pointerId); } catch (er) {}
  });
  cv.addEventListener('pointermove', function (e) {
    var d = Game && Game.drag; if (!d || d.id !== e.pointerId) return; var p = Game.pieces[d.k], cs = R.layout().cs;
    var raw = (p.dir === 'h' ? e.clientX - d.sx : e.clientY - d.sy) / cs, off = Math.max(d.min, Math.min(d.max, raw));
    if (!d.bumped && (raw > d.max + 0.3 || raw < d.min - 0.3)) { // pushed into something
      var edge = raw > 0 ? (p.dir === 'h' ? p.x + p.len + d.max : p.y + p.len + d.max) >= M.W : (p.dir === 'h' ? p.x + d.min : p.y + d.min) <= 0;
      if (!edge) { d.bumped = true; Snd.horn(); var bx = p.dir === 'h' ? (raw > 0 ? p.x + p.len + d.max : p.x + d.min - 1) : p.x, by = p.dir === 'v' ? (raw > 0 ? p.y + p.len + d.max : p.y + d.min - 1) : p.y;
        var o = M.grid(Game.pieces)[by * M.W + bx]; if (o >= 0) { Game.shakeK = o; setTimeout(function () { if (Game) Game.shakeK = -1; }, 280); } }
    }
    d.off = off;
  });
  function endDrag(e) {
    var d = Game && Game.drag; if (!d || (e && d.id !== e.pointerId)) return; Game.drag = null; var n = Math.round(d.off);
    var p = Game.pieces[d.k]; Game.vis[d.k] = { x: p.x + (p.dir === 'h' ? d.off : 0), y: p.y + (p.dir === 'v' ? d.off : 0) };
    if (n) commit(d.k, n);
  }
  cv.addEventListener('pointerup', endDrag); cv.addEventListener('pointercancel', endDrag);
  // keyboard: Tab-free play — Space cycles vehicles, arrows slide one cell, Z undo, R reset
  document.addEventListener('keydown', function (e) {
    if (!Game || Game.over || Game.mode === 'demo' || e.target === nameIn) return; var k = e.key;
    if (k === ' ' || k === 'n') { e.preventDefault(); var ps = Game.pieces, i = Game.sel; do { i = (i + 1) % ps.length; } while (ps[i].fixed); var s = tutStep(); if (s) i = pieceIdx(s.piece); Game.sel = i; Game.glowK = i; Snd.blip(); return; }
    var dir = { ArrowLeft: [-1, 'h'], ArrowRight: [1, 'h'], ArrowUp: [-1, 'v'], ArrowDown: [1, 'v'] }[k];
    if (dir) { e.preventDefault(); var p = Game.pieces[Game.sel]; if (p.dir !== dir[1]) { Snd.horn(); return; } var st = tutStep(); if (st && p.id !== st.piece) { toast(t('tutLocked')); return; } if (!commit(Game.sel, dir[0])) Snd.horn(); return; }
    if (k === 'z' || k === 'Z') undo(); else if (k === 'r' || k === 'R') reset(); else if (k === 'Escape') goHome();
  });
  // ---------- layout + loop ----------
  function relayout() { R.resize($('home').hidden ? 'play' : 'home', Game && Game.mode === 'tutorial' ? 72 : 0); }
  window.addEventListener('resize', relayout);
  R.init(cv, CFG); relayout();
  var last = performance.now(), homeVis = homePreview.map(function (p) { return { x: p.x, y: p.y }; });
  function loop(now) {
    var dt = Math.min(0.05, (now - last) / 1000); last = now; var tt = now / 1000;
    if (Game) {
      var a = 1 - Math.pow(0.0005, dt);
      Game.pieces.forEach(function (p, i) { var v = Game.vis[i]; if (Game.drag && Game.drag.k === i) { v.x = p.x + (p.dir === 'h' ? Game.drag.off : 0); v.y = p.y + (p.dir === 'v' ? Game.drag.off : 0); } else { v.x += (p.x - v.x) * a; v.y += (p.y - v.y) * a; if (Math.abs(p.x - v.x) < 0.002) v.x = p.x; if (Math.abs(p.y - v.y) < 0.002) v.y = p.y; } });
      R.frame({ pieces: Game.pieces, vis: Game.vis, drag: Game.drag, hint: Game.hint, carOut: Game.carOut, hand: Game.hand, glowK: Game.glowK, shakeK: Game.shakeK }, tt, dt);
    } else R.frame({ pieces: homePreview, vis: homeVis }, tt, dt);
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
  // ---------- routes ----------
  function route() { var h = location.hash; if (h === '#demo') startDemo(); else if (h === '#tutorial') startTutorial(); else if (h === '#daily') startDaily(); }
  updateHome(); route();
  window.addEventListener('hashchange', route);
  window.MMApp = { get game() { return Game; }, startLevel: startLevel, startTutorial: startTutorial, startDaily: startDaily, startDemo: startDemo, commit: commit, undo: undo, reset: reset, hint: hint, goHome: goHome, dailyKey: DK, get daily() { return dailyLvl; } };
})();

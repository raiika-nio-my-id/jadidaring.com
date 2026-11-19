/* Monyet Uluwatu app glue */
(function () {
'use strict';
const J = window.JDK, MU = window.MU, MR = window.MR, $ = J.$;
const NAME_KEY = 'monyetuluwatu.name', BEST_KEY = 'monyetuluwatu.best', SEEN_KEY = 'monyetuluwatu.tut';
const myName = () => ($('nameInput').value || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 16);
let G = null, mode = 'none', paused = false, last = 0, raf = 0, coachShown = '', heroG = null, demoCd = 0, endTimer = 0;
const hash = () => (location.hash || '').toLowerCase();
const loadBest = () => { try { const a = JSON.parse(J.getLS(BEST_KEY) || '[]'); return Array.isArray(a) ? a.filter(o => o && typeof o.s === 'number').slice(0, 5) : []; } catch (e) { return []; } };
function paintBest() { const b = loadBest(); if (b.length) { $('bestBtn').disabled = false; $('bestTitle').textContent = 'Rekor ' + b[0].s; $('bestSub').textContent = b[0].n + (b[0].w ? ' · sampai sunset' : ' · ' + (b[0].c || '')); } }
// --- sound
const SFX = {
  shoo() { J.noise(0.18, 0.16, 1800); J.tone(520, 0.08, 'triangle', 0.05, 880); },
  bonk() { J.tone(180, 0.12, 'square', 0.06, 120); },
  steal() { J.tone(900, 0.09, 'square', 0.05, 1400); J.tone(1300, 0.09, 'square', 0.05, 1900, 0.09); J.tone(700, 0.18, 'sawtooth', 0.04, 400, 0.2); },
  throw() { J.noise(0.14, 0.08, 600); },
  fed() { J.tone(660, 0.07, 'triangle', 0.05); },
  recover() { [784, 988, 1175].forEach((f, i) => J.tone(f, 0.12, 'triangle', 0.06, 0, i * 0.07)); },
  escape() { J.tone(440, 0.2, 'sawtooth', 0.05, 220); J.tone(330, 0.3, 'sawtooth', 0.05, 160, 0.18); },
  basket() { [523, 659, 784].forEach((f, i) => J.tone(f, 0.08, 'square', 0.04, 0, i * 0.05)); },
  gong() { J.tone(98, 1.6, 'sine', 0.12, 92); J.tone(196, 1.1, 'sine', 0.05, 190); },
  nope() { J.tone(200, 0.1, 'square', 0.04, 160); },
  win() { [523, 659, 784, 1047, 784, 1047].forEach((f, i) => J.tone(f, 0.18, 'triangle', 0.06, 0, i * 0.12)); },
  lose() { [392, 330, 262, 196].forEach((f, i) => J.tone(f, 0.22, 'triangle', 0.06, 0, i * 0.16)); },
};
// gamelan-ish ambience: pelog-like 5-note loop + kecak "cak" near sunset
const PELOG = [293.7, 311.1, 370, 440, 466.2]; let ambT = 0, ambStep = 0;
function ambience(dt) {
  if (J.Snd.muted || !G || paused || G.over) return; ambT -= dt; if (ambT > 0) return;
  const p = MU.pct(G), tempo = 0.42 - p * 0.14; ambT = tempo; const pat = [0, 2, 3, 2, 4, 3, 1, 2];
  const n = PELOG[pat[ambStep % 8]]; J.tone(n * 2, 0.35, 'sine', 0.018); if (ambStep % 4 === 0) J.tone(n / 2, 0.6, 'sine', 0.03);
  if (p > 0.8 && ambStep % 2 === 0) J.noise(0.05, 0.05, 2400);
  ambStep++;
}
// --- HUD
function hud() {
  if (!G) return; $('clock').textContent = MU.clock(G); $('score').textContent = G.score;
  $('lives').innerHTML = [0, 1, 2].map(i => '<i class="' + (i < G.lives ? '' : 'off') + '">❤️</i>').join('');
  $('banN').textContent = G.bananas; $('ban').classList.toggle('low', G.bananas === 0 && G.mons.some(m => m.st === 'perch'));
  $('sunFill').style.width = (MU.pct(G) * 100).toFixed(1) + '%';
  const cb = $('combo'); if (G.mult > 1) { cb.hidden = false; cb.textContent = 'Beruntun x' + G.mult; } else cb.hidden = true;
}
function callout(big, small) { const c = $('callout'); c.innerHTML = '<b>' + J.esc(big) + '</b>' + (small ? '<small>' + J.esc(small) + '</small>' : ''); clearTimeout(callout.t); callout.t = setTimeout(() => { c.innerHTML = ''; }, 1500); }
const ITEM_NAME = { hp: 'HP', kacamata: 'Kacamata', sandal: 'Sandal' };
function drain() {
  for (const e of G.ev) {
    MR.onEvent(G, e); if (mode === 'demo') continue;
    if (e.t === 'shoo') { SFX.shoo(); J.buzz(12); }
    else if (e.t === 'bonk') SFX.bonk();
    else if (e.t === 'steal') { SFX.steal(); J.buzz([30, 40, 30]); if (mode === 'main' && G.stats.lost === 1) J.toast('Monyetnya naik ke tembok. Ketuk dia buat lempar pisang!', '', 2600); }
    else if (e.t === 'throw') SFX.throw();
    else if (e.t === 'fed') SFX.fed();
    else if (e.t === 'recover') { SFX.recover(); $('ban').classList.remove('bump'); }
    else if (e.t === 'escape') { SFX.escape(); J.buzz(120); if (mode === 'main') J.toast(ITEM_NAME[e.item] + ' ' + (e.who || 'turis') + ' dibawa kabur!', 'warn'); }
    else if (e.t === 'basket') { SFX.basket(); bump(); }
    else if (e.t === 'streak') { J.toast('Pedagang kasih 1 pisang! (' + e.n + ' usiran beruntun)'); bump(); }
    else if (e.t === 'nopisang') { SFX.nope(); J.toast('Pisang habis! Ketuk keranjang pisang.', 'warn'); }
    else if (e.t === 'wave') { SFX.gong(); callout(e.n >= 5 ? 'Sunset rush!' : 'Gelombang ' + e.n, MU.clock(G) + (e.n >= 4 ? ' · monyet makin berani' : '')); }
    else if (e.t === 'basketIn') J.tone(880, 0.05, 'triangle', 0.03);
    else if (e.t === 'end') finish();
    else if (e.t === 'tutdone') { J.setLS(SEEN_KEY, '1'); callout('Siap!', 'Sekarang jaga sampai sunset'); endTimer = setTimeout(() => start('main'), 1600); }
  }
  G.ev.length = 0;
}
function bump() { const b = $('ban'); b.classList.remove('bump'); void b.offsetWidth; b.classList.add('bump'); }
const COACH = ['<b>Ketuk monyet</b> yang mendekati turis untuk mengusirnya. HUS!', 'Yah, ada yang lolos dan mengambil HP…', 'Monyet di tembok mau barter. <b>Ketuk dia</b> untuk lempar pisang. HP = <b>2 pisang</b>.', 'HP kembali! 👏', 'Stok pisang habis. <b>Ketuk keranjang pisang</b>.', 'Mantap! Kamu siap jaga tangga pura.', ''];
function coach() { const el = $('coach'); if (mode !== 'tut' || !G || !G.tut) { el.hidden = true; return; } const h = COACH[G.tut.stage] || ''; if (h !== coachShown) { coachShown = h; el.innerHTML = h; el.hidden = !h; } }
// --- loop
function frame(ts) {
  raf = requestAnimationFrame(frame); const dt = Math.min(0.05, (ts - (last || ts)) / 1000); last = ts;
  if (!$('play').hidden && G) {
    if (!paused) {
      MU.step(G, dt);
      if (mode === 'demo') { demoCd -= dt; if (demoCd <= 0) { const t = MU.bot(G, 0.85); if (t) { MU.tap(G, t[0], t[1]); demoCd = 0.5 + Math.random() * 0.3; } } if (G.over) { G = demoGame(); } }
      drain(); hud(); coach(); ambience(dt);
    }
    MR.draw($('cv'), G, ts / 1000);
  } else if (!$('home').hidden) {
    if (!heroG) heroG = heroGame(); MU.step(heroG, dt); demoCd -= dt; if (demoCd <= 0) { const t = MU.bot(heroG, 0.5); if (t) MU.tap(heroG, t[0], t[1]); demoCd = 0.9; } if (heroG.over) heroG = heroGame(); heroG.ev.length = 0;
    MR.draw($('heroCv'), heroG, ts / 1000, { still: true });
  }
}
function heroGame() { const g = MU.create((Math.random() * 1e9) >>> 0, { dur: 400 }); ff(g, 90); return g; }
function demoGame() { const g = MU.create(20261105 + ((Math.random() * 99) | 0)); ff(g, 76); return g; }
function ff(g, sec) { let cd = 0; for (let i = 0; i < sec * 30; i++) { MU.step(g, 1 / 30); cd -= 1 / 30; if (cd <= 0) { const t = MU.bot(g, 0.95); if (t) MU.tap(g, t[0], t[1]); cd = 0.35; } if (g.over) break; } g.ev.length = 0; g.lives = 3; g.over = false; }
// --- flow
function start(m) {
  clearTimeout(endTimer); mode = m; paused = false; $('pause').hidden = true; MR.fx.length = 0; coachShown = '';
  if (m === 'tut') G = MU.create(7, { tut: true }); else if (m === 'demo') G = demoGame(); else G = MU.create((Math.random() * 4294967295) >>> 0);
  J.show('play'); $('result').hidden = true; hud(); coach(); J.ac();
  if (m === 'main') { SFX.gong(); callout('16:30', 'Jaga barang turis sampai sunset!'); }
}
function finish() {
  const won = G.won, name = myName() || 'JadiDaring', list = loadBest(), rec = { n: name, s: G.score, w: won ? 1 : 0, c: MU.clock(G), d: new Date().toISOString().slice(0, 10) };
  list.push(rec); list.sort((a, b) => b.s - a.s); const top = list.slice(0, 5); J.setLS(BEST_KEY, JSON.stringify(top)); const rank = top.indexOf(rec);
  setTimeout(() => {
    if (mode !== 'main') return;
    won ? SFX.win() : SFX.lose();
    $('resKick').textContent = won ? 'SUNSET ULUWATU · 18:30' : 'TUMBANG JAM ' + MU.clock(G);
    $('resTitle').textContent = won ? 'Sunset aman! 🌅' : 'Barang turis habis dibawa kabur!';
    $('resSub').textContent = won ? 'Bonus bertahan +' + G.bonus + ' (nyawa & sisa pisang)' : 'Monyetnya makin pintar menjelang sunset. Coba lagi!';
    $('resScore').textContent = G.score; $('resBest').textContent = rank === 0 ? '🏆 Rekor baru di HP ini!' : 'Rekor: ' + top[0].s;
    const s = G.stats; $('resStats').innerHTML = [['🐒 Diusir', s.shoo], ['⚡ Nyaris dicuri', s.near], ['🍌 Ditebus', s.recov], ['💨 Dibawa kabur', 3 - Math.max(0, G.lives)], ['🍌 Pisang dilempar', s.ban], ['🔥 Beruntun terbaik', s.best]].map(r => '<li><span>' + r[0] + '</span><b>' + r[1] + '</b></li>').join('');
    $('lbList').innerHTML = top.map((o, i) => '<li class="' + (i === rank ? 'me' : '') + '">' + J.esc(o.n) + ' · <b>' + o.s + '</b> <small class="muted">' + (o.w ? '🌅' : o.c) + '</small></li>').join('');
    $('result').hidden = false; paintBest();
  }, 900);
}
function toHome() { clearTimeout(endTimer); mode = 'none'; G = null; $('result').hidden = true; J.show('home'); paintBest(); }
function share() {
  const url = location.href.split('#')[0].split('?')[0], text = 'Aku dapat ' + (G ? G.score : 0) + ' poin jagain turis dari monyet Uluwatu' + (G && G.won ? ' sampai sunset 🌅' : '') + '! Coba kalahkan: ' + url;
  if (navigator.share) navigator.share({ title: 'Monyet Uluwatu', text }).catch(() => {}); else if (navigator.clipboard) navigator.clipboard.writeText(text).then(() => J.toast('Teks pamer disalin!'), () => J.toast(text)); else J.toast(text);
}
function pause(on) { if (!G || G.over || mode === 'demo') return; paused = on; $('pause').hidden = !on; }
function boot() {
  $('nameInput').value = J.getLS(NAME_KEY) || ''; $('nameInput').addEventListener('change', () => J.setLS(NAME_KEY, myName()));
  if (window.JDNG) window.JDNG.on(n => { if (n && !$('nameInput').value) { $('nameInput').value = n; J.setLS(NAME_KEY, myName()); } });
  J.initMute('monyetuluwatu.mute', ['muteBtn', 'muteBtn2']);
  MR.icon($('banIco'), 'pisang');
  $('tebus').innerHTML = [['kacamata', 'Kacamata', 1], ['hp', 'HP', 2], ['sandal', 'Sandal', 1]].map(r => '<div><canvas data-k="' + r[0] + '"></canvas>' + r[1] + '<small>' + '<canvas data-k="pisang"></canvas>'.repeat(r[2]) + '×' + r[2] + '</small></div>').join('');
  for (const c of document.querySelectorAll('#tebus canvas')) MR.icon(c, c.dataset.k);
  paintBest();
  $('playBtn').addEventListener('click', () => { J.setLS(NAME_KEY, myName()); start(J.getLS(SEEN_KEY) ? 'main' : 'tut'); });
  $('tutBtn').addEventListener('click', () => start('tut'));
  $('bestBtn').addEventListener('click', () => { const b = loadBest(); J.toast(b.map((o, i) => (i + 1) + '. ' + o.n + ' ' + o.s).join(' · '), '', 3500); });
  $('exitBtn').addEventListener('click', () => { if (mode === 'main' && G && !G.over && G.t > 5) { pause(true); return; } toHome(); });
  $('pauseBtn').addEventListener('click', () => pause(!paused)); $('resumeBtn').addEventListener('click', () => pause(false)); $('quitBtn').addEventListener('click', () => { paused = false; toHome(); });
  $('againBtn').addEventListener('click', () => start('main')); $('resMenu').addEventListener('click', toHome); $('shareBtn').addEventListener('click', share);
  const cv = $('cv');
  cv.addEventListener('pointerdown', e => { e.preventDefault(); if (!G || paused || mode === 'demo') return; const r = cv.getBoundingClientRect(), w = MR.toWorld(e.clientX - r.left, e.clientY - r.top); MU.tap(G, w[0], w[1]); });
  document.addEventListener('keydown', e => { if (e.target && /INPUT/.test(e.target.tagName)) return; if ((e.key === 'p' || e.key === 'P' || e.key === 'Escape') && !$('play').hidden) pause(!paused); });
  document.addEventListener('visibilitychange', () => { if (document.hidden && mode === 'main') pause(true); });
  if (/^#demo/.test(hash())) start('demo'); else J.show('home');
  requestAnimationFrame(frame);
  window.MUApp = { get G() { return G; }, get mode() { return mode; }, start, tapW: (x, y) => G && MU.tap(G, x, y), pause, toHome };
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();

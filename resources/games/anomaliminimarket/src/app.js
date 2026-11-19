/* Anomali Mini Market app glue — landscape + gamepad controls. window.AMApp for tests. */
(function () {
'use strict';
const J = window.JDK, AM = window.AM, AR = window.AR, $ = J.$;
const UNLOCK_KEY = 'anomaliminimarket.unlock';
const END_KEY = 'anomaliminimarket.endings', NAME_KEY = 'anomaliminimarket.name', BEST_KEY = 'anomaliminimarket.best', SEEN_KEY = 'anomaliminimarket.tut', OFFER_KEY = 'anomaliminimarket.tutOffered';
const myName = () => ($('nameInput').value || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 16);
let G = null, mode = 'home', paused = false, last = 0, stick = { dx: 0, dy: 0, active: false }, endTimer = 0, portrait = false, walkTo = null;

const SFX = {
  ok() { J.tone(523, 0.08, 'triangle', 0.05); J.tone(784, 0.1, 'triangle', 0.05, 0, 0.07); },
  bad() { J.tone(180, 0.2, 'sawtooth', 0.06, 90); J.buzz(30); },
  catch() { [440, 554, 659, 880].forEach((f, i) => J.tone(f, 0.12, 'square', 0.04, 0, i * 0.06)); },
  pay() { J.tone(660, 0.08, 'sine', 0.05); J.tone(880, 0.1, 'sine', 0.04, 0, 0.08); },
  fill() { J.tone(392, 0.05, 'triangle', 0.04); },
  open() { J.noise(0.04, 0.05, 1800); },
  win() { [523, 659, 784, 1047].forEach((f, i) => J.tone(f, 0.18, 'triangle', 0.06, 0, i * 0.1)); },
  perfect() { [523, 659, 784, 1047, 1319].forEach((f, i) => J.tone(f, 0.2, 'triangle', 0.06, 0, i * 0.09)); },
  chime() { J.tone(784, 0.16, 'sine', 0.04); J.tone(587, 0.22, 'sine', 0.04, 0, 0.16); },
  lose() { [392, 330, 262, 196].forEach((f, i) => J.tone(f, 0.22, 'triangle', 0.05, 0, i * 0.12)); }
};

function loadBest() {
  try { const a = JSON.parse(J.getLS(BEST_KEY) || '[]'); return Array.isArray(a) ? a.filter(o => o && typeof o.s === 'number').slice(0, 5) : []; } catch (e) { return []; }
}
function paintBest() {
  const b = loadBest();
  if (b.length) { $('bestBtn').disabled = false; $('bestTitle').textContent = 'Rekor ' + b[0].s; $('bestSub').textContent = b[0].n + (b[0].w ? ' · shift OK' : ''); }
}
/* Phase C ending gallery: unlocked ids in localStorage; locked ones stay ??? (no spoiler) */
function loadEnds() { try { const a = JSON.parse(J.getLS(END_KEY) || '[]'); return Array.isArray(a) ? a : []; } catch (e) { return []; } }
function paintEnds() {
  const got = loadEnds(), el = $('endList'); if (!el) return;
  $('endCount').textContent = AM.ENDINGS.filter(e => got.includes(e.id)).length + '/' + AM.ENDINGS.length;
  el.innerHTML = AM.ENDINGS.map(e => got.includes(e.id) ? '<li class="on" data-id="' + e.id + '"><i>' + e.icon + '</i><b>' + J.esc(e.name) + '</b><small>' + J.esc(e.flavor) + '</small></li>' : '<li class="lock"><i>❔</i><b>???</b><small>Belum terbuka</small></li>').join('');
}
function glossHTML() {
  return AM.ANOMALIES.map(a => '<dt>' + J.esc(a.label) + '</dt><dd>' + J.esc(a.tip) + ' <i>Cek: ' + J.esc(a.look) + '</i></dd>').join('');
}

function lockLandscape() {
  try { if (screen.orientation && screen.orientation.lock) screen.orientation.lock('landscape').catch(() => {}); } catch (e) { /* ignore */ }
}
function checkPortrait() {
  const isPort = window.matchMedia('(orientation: portrait) and (max-width: 900px)').matches;
  portrait = isPort; // loop freezes the simulation while the rotate gate is up
  const gate = $('rotateGate');
  if (gate) gate.hidden = !isPort;
  if (!isPort) lockLandscape();
}

/* ---------- chrome: one surface at a time ---------- */
const SHEETS = ['inspectSheet', 'paySheet', 'restockSheet'];
function openSheetId() { for (const id of SHEETS) if (!$(id).hidden) return id; return ''; }
function overlayOpen() { return !!openSheetId() || !$('pause').hidden || !$('tutOffer').hidden; }
/* z-stack: stage < hud/controls < sheet/pause/offer < lesson-bar < rotate-gate. While any overlay is up:
   no fx-banner, no floating toasts, no playfield coach, no Game Hub pill. */
function syncChrome() {
  const open = overlayOpen();
  document.body.classList.toggle('sheet-open', open);
  if (open) { const t = $('toasts'); if (t.firstChild) t.innerHTML = ''; if (G) G.fx = null; $('fxBanner').hidden = true; $('coach').hidden = true; }
  if (!$('home').hidden) document.documentElement.classList.toggle('jr-hub-off', !$('tutOffer').hidden);
  else if (!$('play').hidden) document.documentElement.classList.add('jr-hub-off');
}
const SHEET_MSG = { inspectSheet: 'inspMsg', paySheet: 'payMsg', restockSheet: 'restockMsg' };
/* status text: floating toast on the free playfield, else inside the open sheet (never over it) */
function note(msg, kind) {
  const id = openSheetId();
  if (id) { setMsg(SHEET_MSG[id], msg, kind || ''); return; }
  if (overlayOpen()) return;
  J.toast(msg, kind || '');
}

/* ---------- HUD + feedback ---------- */
function setMsg(id, text, kind) {
  const el = $(id); if (!el) return;
  el.hidden = !text; el.textContent = text || ''; el.className = 'sheet-msg ' + (kind || '');
}
function hud() {
  if (!G) return;
  $('modeHud').textContent = G.cfg.label;
  $('clockHud').textContent = AM.clockLabel(G) + (G.clockSkew ? ' ⏪' : '');
  $('scoreHud').textContent = AM.scoreOf(G);
  $('moneyHud').textContent = AM.money(G.money);
  $('queueHud').textContent = G.active.filter(c => !c.served).length + ' antri';
  const sc = AM.stockCount(G), low = AM.stockRatio(G) < 0.55;
  $('stockHud').textContent = '📦 ' + sc + '/' + G.shelf.length + (low ? ' RESTOK!' : '');
  $('stockHud').classList.toggle('warn', low || G.restockDue);
  $('fearFill').style.width = G.fear.toFixed(1) + '%';
  $('repFill').style.width = G.rep.toFixed(1) + '%';
  $('stockFill').style.width = (AM.stockRatio(G) * 100).toFixed(1) + '%';
  $('fearVal').textContent = Math.round(G.fear); $('repVal').textContent = Math.round(G.rep); $('stockVal').textContent = sc + '/' + G.shelf.length;
  $('fearRow').classList.toggle('danger', G.fear >= 70);
  $('repRow').classList.toggle('danger', G.rep <= 30);
  $('stockRow').classList.toggle('danger', low);
  const ph = G.phase === 'inspect' ? 'Inspeksi' : G.phase === 'pay' ? 'Bayar' : G.phase === 'restock' ? 'Restok' : 'Toko';
  const act = AM.curAct(G), acts = G.cfg.acts || [];
  const actTag = act && acts.length > 1 ? (G.actBreak ? 'Jeda restok → ' + act.label : 'Babak ' + (G.actIdx + 1) + '/' + acts.length + ' ' + act.label) + ' · ' : '';
  $('phaseTag').textContent = G.isTut ? ph + ' · Pelajaran ' + Math.min(G.tutStep + 1, AM.TUT_STEPS.length - 1) + '/' + (AM.TUT_STEPS.length - 1) : ph + ' · ' + actTag + G.served + '/' + G.total;
  $('phaseTag').classList.toggle('spike', !!act && act.key === 'spike' && !G.actBreak);
  // transient tip (play screen) + the same tip inside open sheets
  const tipOn = !!(G.tip && G.tipT > 0);
  // a tip belongs to the surface it was raised on (no stale inspect/restock text inside the pay sheet)
  $('coach').hidden = !tipOn || G.phase !== 'play' || G.tipPh !== 'play' || !!G.fx; if (G.tip) $('coach').textContent = G.tip;
  // tutorial lesson bar sits above every sheet
  const lt = lessonFor(G);
  $('lessonBar').hidden = !lt || G.over;
  $('play').classList.toggle('tut-on', !!lt && !G.over);
  if (lt) {
    $('lessonText').textContent = lt;
    const s = AM.tutCur(G); $('lessonBtn').textContent = s && s.ok === 'ack' ? 'Mengerti ▶' : 'Lewati langkah';
    $('play').style.setProperty('--lesson-h', ($('lessonBar').offsetHeight || 0) + 'px');
  }
  for (const el of document.querySelectorAll('.sheet-coach')) { el.hidden = !G.tut || G.isTut || !tipOn || G.tipPh !== G.phase || G.phase === 'play'; el.textContent = G.tip || ''; }
  syncChrome();
  const fxEl = $('fxBanner');
  if (G.fx && !overlayOpen()) { fxEl.hidden = false; if (fxEl.textContent !== G.fx.text) fxEl.textContent = G.fx.text; fxEl.className = 'fx-banner ' + G.fx.kind; } else fxEl.hidden = true;
  const edc = $('edcLed'); if (edc && G.edc) edc.className = 'edc-led ' + G.edc.s;
  $('inspectBtn').classList.toggle('on', !!AM.servable(G) && G.phase === 'play'); // kasir-only: someone is queueing
  $('restockBtn').classList.toggle('on', G.restockDue || AM.stockRatio(G) < 0.55);
  $('payBtn').classList.toggle('on', G.phase === 'pay');
}

/* Tutorial lesson text, but when the player opens Restok outside the restock lesson the bar explains the open sheet. */
function lessonFor(G) {
  const lt = AM.lessonText(G); if (!lt) return '';
  const s = AM.tutCur(G);
  if (G.phase === 'restock' && s && s.id !== 'restock') return 'Restok (di luar urutan): pilih produk → ketuk slot kosong ＋ → Selesai restok. Setelah itu lanjut ' + lt.split(' · ')[0] + '.';
  return lt;
}

function drainEv() {
  for (const e of G.ev) {
    if (e.t === 'catch') SFX.catch();
    else if (e.t === 'false' || e.t === 'miss' || e.t === 'ghostpay') SFX.bad();
    else if (e.t === 'payok') SFX.pay();
    else if (e.t === 'fill' || e.t === 'restock') SFX.fill();
    else if (e.t === 'inspect') SFX.open();
    else if (e.t === 'win') SFX.win();
    else if (e.t === 'perfect') SFX.perfect();
    else if (e.t === 'lose') SFX.lose();
    else if (e.t === 'act') SFX.chime();
  }
  G.ev.length = 0;
}

function showResult() {
  closeSheets();
  J.show('result', false);
  const won = G.won, sc = AM.scoreOf(G), sheet = $('result').querySelector('.sheet');
  sheet.classList.toggle('perfect', !!G.perfect); sheet.classList.toggle('lost', !won);
  const tutDone = G.isTut && AM.tutComplete(G);
  if (G.isTut) {
    $('resKick').textContent = tutDone ? 'TUTORIAL LULUS' : 'TUTORIAL BELUM LENGKAP';
    $('resTitle').textContent = tutDone ? 'Siap jaga shift! 🎓 9/9 pelajaran' : 'Ada pelajaran yang dilewati';
    const missed = AM.TUT_STEPS.filter(s => s.id !== 'end' && G.lessons[s.id] !== true).map(s => s.text.split(' · ')[0]);
    $('resNote').hidden = !missed.length; $('resNote').textContent = missed.length ? 'Dilewati: ' + missed.join(', ') + '. Ulangi tutorial atau langsung main.' : '';
    $('againBtn').textContent = '🧾 Mulai Shift Biasa';
    $('retryTutBtn').hidden = false;
  } else {
    $('resKick').textContent = G.perfect ? '✨ SHIFT SEMPURNA ✨' : won ? 'SHIFT SELESAI' : 'SHIFT GAGAL';
    $('resTitle').textContent = G.perfect ? 'Tanpa satu pun kesalahan! (+150)' : won ? 'Minimarket aman!' : (G.loseWhy === 'takut' ? 'Takut penuh — kamu kabur' : 'Reputasi hancur — toko tutup');
    $('resNote').hidden = G.perfect || !won; $('resNote').textContent = won && !G.perfect ? 'Sempurna = 0 hantu lolos, 0 salah tolak, 0 salah bayar, 0 pelanggan kelamaan antri.' : '';
    $('againBtn').textContent = '↻ Shift lagi';
    $('retryTutBtn').hidden = true;
  }
  const nLes = AM.TUT_STEPS.filter(s => s.id !== 'end' && G.lessons[s.id] === true).length;
  $('resSub').textContent = G.isTut ? 'Tutorial · ' + nLes + '/9 pelajaran selesai · Hantu tertangkap ' + G.caught
    : G.cfg.label + ' · Ditangani ' + G.served + '/' + G.total + ' · Hantu tertangkap ' + G.caught + ' · Lolos ' + G.missed + (G.left ? ' · Pergi ' + G.left : '') + (G.vanished ? ' · Menghilang ' + G.vanished : '');
  $('resScore').textContent = sc;
  $('againBtn').onclick = () => start(G.isTut ? 'biasa' : mode);
  const list = loadBest();
  if (!G.isTut) {
    list.push({ n: myName() || 'JadiDaring', s: sc, w: won ? 1 : 0, mode: mode });
    list.sort((a, b) => b.s - a.s);
    J.setLS(BEST_KEY, JSON.stringify(list.slice(0, 5)));
  }
  $('resBest').textContent = list[0] ? 'Rekor HP ini: ' + list[0].s : '';
  const en = AM.ENDINGS.find(e => e.id === G.ending), got = loadEnds(), fresh = en && !got.includes(en.id);
  $('resEnd').hidden = !en; if (en) { $('resEnd').innerHTML = '<i>' + en.icon + '</i><b>Akhir: ' + J.esc(en.name) + (fresh ? ' <em>BARU!</em>' : '') + '</b><small>' + J.esc(en.flavor) + '</small>'; if (fresh) { got.push(en.id); J.setLS(END_KEY, JSON.stringify(got)); } }
  $('resStats').innerHTML = '<li>Benar lolos <b>' + G.correctPass + '</b></li><li>Tangkap hantu <b>' + G.caught + '</b></li><li>Salah tolak <b>' + G.falseReject + '</b></li><li>Hantu lolos <b>' + G.missed + '</b></li><li>Salah bayar <b>' + G.payMistakes + '</b></li><li>Pergi / menghilang <b>' + (G.left + G.vanished) + '</b></li><li>Omzet <b>' + AM.money(G.money) + '</b></li>';
  $('lbList').innerHTML = loadBest().map((o, i) => '<li class="' + (o.n === myName() ? 'me' : '') + '">' + J.esc(o.n) + ' — ' + o.s + (o.w ? ' ✓' : '') + '</li>').join('') || '<li class="muted">Belum ada</li>';
  paintBest();
  if (tutDone) J.setLS(SEEN_KEY, '1'); // only a complete tutorial counts
  if (won && mode === 'biasa' && !J.getLS(UNLOCK_KEY)) { J.setLS(UNLOCK_KEY, '1'); $('resNote').hidden = false; $('resNote').textContent = '🌑 Malam Anomali terbuka!' + ($('resNote').textContent ? ' ' + $('resNote').textContent : ''); paintLock(); }
}

/* auto-walk to a stand point: kasir front (checkout) or a gondola with empty slots (restok); detours round props */
const segClear = (a, b) => { for (let k = 1; k <= 12; k++) { const t = k / 12; if (AM.blocked(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t)) return false; } return true; };
function walkStep() {
  if (!walkTo || G.phase !== 'play') { walkTo = null; return; }
  const w = walkTo, stop = () => { walkTo = null; AM.setInput(G, 0, 0); };
  if (w.kind === 'kasir') {
    if (!AM.servable(G)) { stop(); note('Belum ada pelanggan antri di kasir'); return; }
    if (AM.atKasir(G)) { stop(); openInspectUI(); return; }
  } else {
    if (!AM.unitEmpty(G, AM.UNITS[w.unit])) { stop(); return; }
    if (AM.nearUnit(G, true) === w.unit) { stop(); openRestockUI(w.unit); return; }
  }
  const me = [G.px, G.py], tg = [w.u, w.v];
  let aim = tg;
  if (!segClear(me, tg)) {
    const vias = [[4.1, 5.6], [4.6, G.py], [4.1, G.py], [G.px, 3.0], [7.1, 3.0], [4.6, 3.0]].filter(p => !AM.blocked(p[0], p[1]) && segClear(me, p) && Math.hypot(p[0] - G.px, p[1] - G.py) > 0.15);
    aim = vias.find(p => segClear(p, tg)) || vias[0] || tg;
  }
  let du = aim[0] - G.px, dv = aim[1] - G.py;
  if (G.bump) { // blocked by a prop: slide sideways along u toward the open aisle
    walkBump = (walkBump || 0) + 1;
    if (walkBump > 4) { du = (G.px < 4.2 ? 1 : -1) * 0.8; dv *= 0.3; }
  } else walkBump = 0;
  AM.setInput(G, du, dv);
}
let walkBump = 0;

function loop(ts) {
  requestAnimationFrame(loop);
  const dt = Math.min(0.05, (ts - last) / 1000 || 0.016); last = ts;
  if (mode === 'home') {
    const hc = $('heroCv'); if (hc && !$('home').hidden) { const hf = J.fitCanvas(hc); AR.hero(hf.g, hf.W, hf.H, ts / 1000); }
    return;
  }
  if (mode === 'gallery') return;
  if (mode === 'folk') {
    if (G && G.phase === 'inspect' && G.current && !$('inspectSheet').hidden) AR.drawCustomerPortrait($('custCv'), G.current, ts / 1000);
    if (G && folkTheft && !$('play').hidden) { const f = J.fitCanvas($('cv')); hud(); if (G.phase === 'play') $('restockBtn').classList.add('on'); for (const s of G.shelf) if (s.fx > 0) s.fx -= dt; AR.frame(f.g, f.W, f.H, G, ts / 1000, dt); }
    return;
  }
  if (!G) return;
  const cv = $('cv'), fit = J.fitCanvas(cv);
  const frozen = paused || portrait;
  if (!frozen && !G.over && G.phase === 'play') {
    if (stick.active) { walkTo = null; const w = AM.screenToWorld(stick.dx, stick.dy); AM.setInput(G, w[0], w[1]); } else if (walkTo) walkStep();
    AM.step(G, dt, dt); AM.tickFx(G, dt); drainEv(); hud();
    if (G.over) endTimer = 0.9;
  } else if (!frozen && !G.over && (G.phase === 'inspect' || G.phase === 'pay' || G.phase === 'restock')) {
    AM.step(G, dt * 0.15, dt); AM.tickFx(G, dt); // slow sim clock while a sheet is open; fx/LEDs stay on real time
    drainEv(); hud();
    if (G.phase === 'inspect' && G.current) AR.drawCustomerPortrait($('custCv'), G.current, ts / 1000);
    if (G.over) endTimer = 0.9;
  } else if (G.over && endTimer > 0) { endTimer -= dt; AM.tickFx(G, dt); hud(); if (endTimer <= 0) showResult(); }
  else if (!frozen && !G.over) { AM.tickFx(G, dt); hud(); }
  AR.frame(fit.g, fit.W, fit.H, G, ts / 1000, dt);
}

function closeSheets() {
  $('inspectSheet').hidden = true;
  $('paySheet').hidden = true;
  $('restockSheet').hidden = true;
  syncChrome();
}
/* every sheet opener: drop stale banners/toasts/coach so the sheet starts clean */
function cleanOpen() { $('toasts').innerHTML = ''; if (G) { G.fx = null; G.tip = ''; G.tipT = 0; } for (const el of document.querySelectorAll('.sheet-coach')) { el.hidden = true; el.textContent = ''; } }

/* ---------- inspection ---------- */
function paintInspect() {
  const c = G.current; if (!c) return;
  const ev = AM.evidence(c), soft = G.cfg.soft;
  $('inspKick').textContent = c.cold ? 'UDARA DINGIN…' : 'PELANGGAN';
  $('inspName').textContent = ev.sapaan + ' ' + ev.saysName;
  $('inspSays').textContent = '“' + ev.says + '”';
  $('ktpFields').innerHTML =
    '<dt>Nama</dt><dd>' + J.esc(ev.ktp.name) + '</dd>' +
    '<dt>Tgl lahir</dt><dd>' + J.esc(ev.ktp.dob) + '</dd>' +
    '<dt>JK</dt><dd>' + ev.ktp.jk + '</dd>' +
    '<dt>Status</dt><dd>' + J.esc(ev.ktp.status) + '</dd>';
  AR.drawKtpFace($('ktpFace'), c.photoTraits);
  AR.drawCustomerPortrait($('custCv'), c, performance.now() / 1000);
  $('evidList').innerHTML = ev.lines.map(l => '<li class="' + (soft && l.bad ? 'bad' : '') + '"><span>' + J.esc(l.label) + '</span><b>' + J.esc(l.v) + '</b></li>').join('');
  $('basketLine').innerHTML = '<span>Keranjang:</span> ' + ev.basket.map(b => '<span class="item' + (soft && (b.weird || b.oddTag) ? ' bad' : '') + '">' + b.icon + ' ' + J.esc(b.name) + ' <small>' + J.esc(b.label) + '</small></span>').join(' ');
  const box = $('anomalyChips'); box.innerHTML = '';
  $('ktpFace').classList.toggle('glitch', !!c.glitch);
  AM.ANOMALIES.forEach(a => {
    if (a.malam && G.mode !== 'malam' && c.anomalies.indexOf(a.id) < 0) return; // Malam-only folklore chips only on Malam
    const b = document.createElement('button');
    b.type = 'button'; b.textContent = (a.folk ? '👻 ' : '') + a.label; b.title = a.tip; b.dataset.id = a.id; if (a.folk) b.className = 'folk';
    if (G.markedList.indexOf(a.id) >= 0) b.classList.add('on');
    if (G.tut && soft && c.anomalies.indexOf(a.id) >= 0) b.classList.add('hint');
    b.onclick = () => { AM.toggleMark(G, a.id); setMsg('inspMsg', a.label + ': ' + a.tip, ''); paintInspect(); };
    box.appendChild(b);
  });
}

/* gate tip: replaces stale toasts, stays 3.4 s, and holds the coach line so nothing overwrites it mid-read */
let lastGate = null;
function gateTip(msg, why, c) {
  lastGate = { msg, why, id: c ? c.id : null, at: performance.now() };
  walkTo = null; AM.setInput(G, 0, 0);
  if (G) { G.tip = ''; G.tipT = 0; G.fx = null; }
  $('toasts').innerHTML = ''; J.toast(msg, 'gate', 3400); J.tone(330, 0.07, 'triangle', 0.04);
}
/* kasir-only checkout: inspect the front-of-queue customer from the counter front; never walk to a browsing customer */
function openInspectUI(target) {
  if (G.phase !== 'play') return;
  let why = AM.kasirGate(G, target || null);
  if (why === 'browse') { gateTip('Biar dia antri di kasir dulu', 'browse', target); return; }
  if (why === 'notfront') { gateTip('Layani antrian depan dulu', 'notfront', target); return; } // tip only: never open the front's sheet from a 2nd-in-queue tap
  const c = AM.servable(G);
  if (why === 'none' || !c) { note('Belum ada pelanggan antri di kasir'); return; }
  if (why === 'far') { walkTo = { kind: 'kasir', u: AM.KASIR[0], v: AM.KASIR[1] }; note('Jalan ke kasir — layani ' + c.sapaan + ' ' + c.spoken + ' (antrian depan)…'); return; }
  if (!AM.openInspect(G, c)) return;
  walkTo = null; AM.setInput(G, 0, 0);
  closeSheets(); cleanOpen(); setMsg('inspMsg', ''); $('glossInsp').hidden = true;
  $('inspectSheet').hidden = false; $('inspectSheet').scrollTop = 0; paintInspect(); SFX.open(); drainEv(); hud();
}

/* ---------- payment ---------- */
function paintPay() {
  const c = G.current; if (!c) return;
  const ev = AM.evidence(c);
  $('payTotal').textContent = AM.money(c.total);
  if (c.pay === 'cash') {
    $('cashUI').hidden = false; $('qrisUI').hidden = true;
    $('payTitle').textContent = 'Tunai';
    $('payBill').textContent = AM.money(c.bill);
    $('payBillNote').textContent = c.fakeMoney ? '(tanpa benang pengaman, gambar luntur)' : '(benang pengaman ada)';
    const bn = $('payBillArt'); bn.className = 'cash note d' + c.bill + (c.fakeMoney ? ' fake' : ''); bn.innerHTML = noteHTML(c.bill, c.fakeMoney);
    $('payNeed').textContent = AM.money(ev.change);
    $('payGiven').textContent = AM.money(G.payGiven);
  } else {
    $('cashUI').hidden = true; $('qrisUI').hidden = false;
    $('payTitle').textContent = 'QRIS';
    $('qrisNeed').textContent = AM.money(ev.qris.required);
    $('qrisAmt').textContent = AM.money(ev.qris.received);
    $('qrisAmt').classList.toggle('diff', G.cfg.soft && ev.qris.received !== ev.qris.required);
  }
}
/* rupiah art: coin for Rp500; notes = colour band, guilloche, portrait oval, security thread, corner values */
function noteHTML(v, fake) {
  if (v < 1000) return '<b>500</b><small>RUPIAH</small>';
  const n = (v / 1000) + '.000';
  return '<i class="rp">Rp</i><i class="pt"></i><b>' + n + '</b><i class="cn">' + (v / 1000) + 'rb</i>' + (fake ? '' : '<i class="th"></i>') + '<i class="wm"></i>';
}
function openPayUI() {
  const c = G.current; if (!c || G.phase !== 'pay') { note('Periksa dulu, lalu loloskan untuk bayar'); return; }
  closeSheets(); cleanOpen(); $('paySheet').hidden = false; setMsg('payMsg', ''); $('paySheet').querySelector('.sheet').scrollTop = 0;
  $('paySheet').classList.remove('edc-ok', 'edc-bad');
  const row = $('changeBtns'); row.innerHTML = '';
  AM.DENOMS.forEach(v => {
    const b = document.createElement('button'); b.type = 'button'; b.dataset.v = v;
    b.className = 'cash ' + (v < 1000 ? 'coin' : 'note') + ' d' + v; b.setAttribute('aria-label', AM.money(v));
    b.innerHTML = noteHTML(v);
    b.onclick = () => { AM.addChange(G, v); $('payGiven').textContent = AM.money(G.payGiven); setMsg('payMsg', ''); SFX.fill(); };
    row.appendChild(b);
  });
  if (!$('qrisGrid').firstChild) { let h = ''; for (let i = 0; i < 81; i++) { const x = i % 9, y = (i / 9) | 0, fin = (x < 3 && y < 3) || (x > 5 && y < 3) || (x < 3 && y > 5); h += '<i class="' + (fin ? (x % 2 === 1 && y % 2 === 1 ? '' : 'on') : ((i * 37 + 11) % 7 < 3 ? 'on' : '')) + '"></i>'; } $('qrisGrid').innerHTML = h; }
  paintPay(); hud();
}
function doPay(accept) {
  if (!G || G.phase !== 'pay' || payBusy) return { done: false, good: false, msg: '' };
  const qris = G.current && G.current.pay === 'qris';
  const res = AM.confirmPay(G, accept); drainEv();
  if (res.done && qris) { // EDC shows green/red on the sheet + world terminal, then the sheet closes
    $('paySheet').classList.add(G.edc && G.edc.s === 'ok' ? 'edc-ok' : 'edc-bad'); setMsg('payMsg', (G.edc && G.edc.s === 'ok' ? '✓ ' : '👻 ') + res.msg, 'good');
    const fx = G.fx; G.fx = null; payBusy = true; hud();
    setTimeout(() => { payBusy = false; closeSheets(); if (mode === 'folk') folkReturn(); else if (G && fx && !G.over) G.fx = fx; hud(); }, 450);
    return res;
  }
  if (res.done) { closeSheets(); if (mode === 'folk') folkReturn(); } // finished → shop floor (or folk gallery)
  else if (res.msg) { setMsg('payMsg', '✖ ' + res.msg, 'bad'); paintPay(); } // stays open for a retry
  hud();
  return res;
}

let payBusy = false;
/* ← Cek lagi: pay → inspect for the same customer; marks/evidence kept, queue untouched */
function backToInspectUI() {
  if (!G || payBusy || !AM.backToInspect(G)) return;
  closeSheets(); cleanOpen(); setMsg('inspMsg', 'Cek lagi — tanda tetap. ✓ Loloskan lagi atau ✖ Tolak.'); $('glossInsp').hidden = true;
  $('inspectSheet').hidden = false; $('inspectSheet').scrollTop = 0; $('inspectSheet').querySelector('.sheet').scrollTop = 0; paintInspect(); hud();
}
const GAME_URL = 'https://www.jadidaring.com/anomaliminimarket/';
/* ---------- restock ---------- */
function paintRestock() {
  const tray = $('productTray'); tray.innerHTML = '';
  AM.PRODUCTS.forEach(p => {
    const b = document.createElement('button'); b.type = 'button'; b.dataset.id = p.id;
    b.innerHTML = '<span class="ico">' + p.icon + '</span><span class="nm">' + p.name + '</span>'; if (G.selectedProduct === p.id) { b.classList.add('on'); b.setAttribute('aria-pressed', 'true'); }
    b.onclick = () => { AM.selectProduct(G, p.id); paintRestock(); };
    tray.appendChild(b);
  });
  const map = $('shelfMap'); map.innerHTML = '';
  const U = AM.UNITS[G.restockUnit] || AM.UNITS[0];
  $('restockTitle').textContent = U.name + ' — isi slot kosong';
  U.slots.map(i => G.shelf[i]).forEach(s => {
    const d = document.createElement('button'); d.type = 'button'; d.className = 'slot' + (s.empty ? '' : ' stocked') + (s.fx > 0 ? ' just' : ''); d.dataset.id = s.id;
    d.innerHTML = s.empty ? '<span class="plus">＋</span><small>kosong</small>' : '<span>' + s.product.icon + '</span>';
    d.setAttribute('aria-label', s.empty ? 'Slot kosong ' + (s.id + 1) : s.product.name);
    d.onclick = () => { if (s.empty && AM.fillSlot(G, s.id)) { drainEv(); paintRestock(); hud(); } };
    map.appendChild(d);
  });
  const left = AM.unitEmpty(G, U), other = G.shelf.length - AM.stockCount(G) - left;
  const selName = (AM.PRODUCTS.find(p => p.id === G.selectedProduct) || {}).name;
  $('restockSel').textContent = selName || '';
  setMsg('restockMsg', left ? left + ' slot kosong di rak ini — ketuk ＋ untuk isi ' + selName : other ? 'Rak ini penuh. Rak lain masih kosong ' + other + ' — Selesai lalu jalan ke sana.' : 'Rak penuh! Tekan Selesai restok.', left ? '' : 'good');
}
/* physical restok: only at a gondola with empty slots; from afar walk there first (no fullscreen menu across the store) */
function openRestockUI(unit) {
  if (G.phase === 'restock') { paintRestock(); return; }
  if (G.phase !== 'play') return;
  if (!AM.openRestock(G, unit)) {
    const ui = unit != null && AM.unitEmpty(G, AM.UNITS[unit]) ? unit : AM.emptyUnit(G);
    if (ui < 0) { note('Rak sudah penuh'); return; }
    const u = AM.UNITS[ui]; walkTo = { kind: 'rak', unit: ui, u: u.at[0], v: u.at[1] }; note('Dekati rak kosong — jalan ke ' + u.name + '…'); return;
  }
  walkTo = null; AM.setInput(G, 0, 0);
  closeSheets(); cleanOpen(); $('restockSheet').hidden = false; paintRestock(); hud();
}
function finishRestock() {
  if (!G || G.phase !== 'restock') { closeSheets(); return; }
  const r = AM.closeRestock(G); drainEv(); closeSheets(); hud();
  if (r.filled && r.full) SFX.ok();
  if (mode === 'folk') folkReturn(); // theft → restok → back to folk gallery
}

function afterDecide(reject) {
  AM.decide(G, reject);
  drainEv();
  if (G.phase === 'pay') { $('inspectSheet').hidden = true; openPayUI(); }
  else { closeSheets(); if (mode === 'folk') folkReturn(); }
  hud();
}

/* ---------- modes ---------- */
/* Malam Anomali unlocks after one Shift Biasa win (?unlock=1 for testers). */
function malamOpen() { return !!J.getLS(UNLOCK_KEY) || /[?&#]unlock\b/.test(location.search + location.hash); }
function paintLock() {
  const b = $('nightBtn'); if (!b) return; const open = malamOpen();
  b.classList.toggle('locked', !open); b.setAttribute('aria-disabled', open ? 'false' : 'true');
  $('nightSub').textContent = open ? '33 pelanggan · lebih banyak hantu' : '🔒 Selesaikan Shift Biasa dulu';
}
function requestStart(choice) {
  if (choice === 'malam' && !malamOpen()) { J.toast('🔒 Selesaikan Shift Biasa dulu untuk membuka Malam Anomali', ''); const b = $('nightBtn'); b.classList.remove('shake'); void b.offsetWidth; b.classList.add('shake'); return { mode: 'malam', locked: true }; }
  const plan = AM.startPlan(choice, !!J.getLS(SEEN_KEY), !!J.getLS(OFFER_KEY));
  if (plan.offerTut) { $('tutOffer').hidden = false; syncChrome(); return plan; }
  start(plan.mode); return plan;
}
function start(m) {
  $('tutOffer').hidden = true;
  G = AM.create((Math.random() * 1e9) | 0, { mode: m });
  mode = m; paused = false; stick = { dx: 0, dy: 0, active: false }; endTimer = 0; walkTo = null;
  $('pause').hidden = true; closeSheets(); J.show('play', false); hud(); lockLandscape();
  if (G.tut && !G.isTut) AM.tip(G, 'Joystick kiri = gerak. Layani pelanggan di meja kasir (🔍 Periksa). Ketuk rak KOSONG = jalan ke sana & restok.', 5);
}

function goHome() { mode = 'home'; G = null; walkTo = null; closeSheets(); $('pause').hidden = true; paused = false; J.show('home', true); paintBest(); paintEnds(); }
function togglePause() {
  if (!G || G.over || mode === 'home') return;
  paused = !paused; $('pause').hidden = !paused; syncChrome();
}

function bindStick() {
  const zone = $('stickZone'), knob = $('stickKnob');
  const set = (cx, cy, rect) => {
    const x = cx - rect.left - rect.width / 2, y = cy - rect.top - rect.height / 2;
    const len = Math.hypot(x, y), max = 42, nx = len > max ? x / len * max : x, ny = len > max ? y / len * max : y;
    knob.style.transform = 'translate(' + nx + 'px,' + ny + 'px)';
    stick.dx = nx / max; stick.dy = ny / max; stick.active = true;
  };
  const clear = () => { if (!stick.active) return; stick = { dx: 0, dy: 0, active: false }; knob.style.transform = 'translate(0,0)'; if (G) AM.setInput(G, 0, 0); };
  const onDown = e => { e.preventDefault(); const t = e.touches ? e.touches[0] : e; set(t.clientX, t.clientY, zone.getBoundingClientRect()); };
  const onMove = e => { if (!stick.active) return; e.preventDefault(); const t = e.touches ? e.touches[0] : e; set(t.clientX, t.clientY, zone.getBoundingClientRect()); };
  zone.addEventListener('pointerdown', onDown); window.addEventListener('pointermove', onMove); window.addEventListener('pointerup', clear);
  zone.addEventListener('touchstart', onDown, { passive: false }); zone.addEventListener('touchmove', onMove, { passive: false }); zone.addEventListener('touchend', clear);
}

function bindKeys() {
  const down = {};
  window.addEventListener('keydown', e => {
    if ($('rotateGate') && !$('rotateGate').hidden) return;
    if (e.target && e.target.tagName === 'INPUT') return;
    if (e.repeat) return;
    const k = e.key.toLowerCase(); down[k] = true;
    if (k === 'e') { e.preventDefault(); if (G && !paused && G.phase === 'play') openInspectUI(); }
    if (k === 'r') { e.preventDefault(); if (G && !paused && G.phase === 'play') openRestockUI(); }
    if (k === ' ' || k === 'enter') {
      if (!G || paused || mode === 'home') return;
      e.preventDefault();
      if (G.phase === 'play') openInspectUI();
      else if (G.phase === 'pay' && G.current && G.current.pay === 'cash') doPay(true);
    }
    if (k === 'p') togglePause();
    if (k === 'm') $('muteBtn').click();
    applyKeys(down);
  });
  window.addEventListener('keyup', e => { down[e.key.toLowerCase()] = false; applyKeys(down); });
}
function applyKeys(down) {
  if (!G || paused || G.phase !== 'play') return;
  let dx = 0, dy = 0;
  if (down.w || down.arrowup) dy -= 1; if (down.s || down.arrowdown) dy += 1;
  if (down.a || down.arrowleft) dx -= 1; if (down.d || down.arrowright) dx += 1;
  if (dx || dy) { stick.active = false; walkTo = null; const w = AM.screenToWorld(dx, dy); AM.setInput(G, w[0], w[1]); }
  else if (!stick.active && !walkTo) AM.setInput(G, 0, 0);
}

/* tap the shop floor: front-of-queue customer → kasir checkout; rak → walk there & restok; browsing customer → tip only */
/* tap target: a name tag first (exact identity, topmost tag wins), then the frontmost body box under the finger, else nearest hit */
const inR = (r, x, y) => r && x >= r[0] && x <= r[2] && y >= r[1] && y <= r[3];
function pickHit(x, y) {
  const cs = AR.hits.filter(h => h.c);
  const tag = cs.filter(h => h.tag && inR(h.tag.r, x, y)).sort((a, b) => b.z - a.z)[0];
  if (tag) return tag;
  const body = cs.filter(h => inR(h.b, x, y)).sort((a, b) => b.z - a.z)[0];
  if (body) return body;
  let best = null, bd = 46;
  for (const h of AR.hits) { const d = Math.hypot(h.x - x, h.y - y) - (h.c ? 8 : 0); if (d < bd) { bd = d; best = h; } }
  return best;
}
function tapCanvas(e) {
  if (!G || paused || portrait || G.phase !== 'play') return;
  const r = $('cv').getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
  const best = pickHit(x, y);
  if (!best) return;
  if (best.c) openInspectUI(best.c); else openRestockUI(best.unit);
}


/* ---------- Phase C folk gallery (?folk=1) — reuse #wardGallery ---------- */
let folkCusts = [], folkSel = null, folkLayout = null;
function folkWanted() { const q = location.search + '&' + location.hash.replace(/^#/, '?'); return /(?:^|[?&#])(?:folk|folklore)=1\b/.test(q) || /(?:^|[?&#])folk\b/.test(q); }
function wgTitle(k, h) { const b = $('wardGallery').querySelector('.wg-bar .kicker'), t = $('wardGallery').querySelector('.wg-bar h2'); if (b) b.textContent = k; if (t) t.textContent = h; }
function folkReturn() { if (mode !== 'folk' || !G) return; folkTheft = false; G.fx = null; G.phase = 'play'; G.current = null; G.markedList = []; G.payGiven = 0; J.show('wardGallery', false); paintFolkGallery(); }
function paintFolkGallery() {
  const cs = folkCusts, cv = $('wgCv'), ctx = cv.getContext('2d'), cols = 4, cw = 300, ch = 270, px = 20, py = 10, top = 4;
  cv.width = px * 2 + cols * cw; cv.height = top + py + Math.ceil(cs.length / cols) * ch;
  ctx.fillStyle = '#241c2c'; ctx.fillRect(0, 0, cv.width, cv.height); folkLayout = { cols, cw, ch, px, py, top };
  const seen = {}; let malamN = 0;
  cs.forEach((c, i) => {
    const a = AM.ANOMALIES.find(x => x.id === c.anomalies[0]) || {}, col = i % cols, row = (i / cols) | 0, x = px + col * cw + cw / 2, y = top + py + row * ch + 125;
    if (folkSel && folkSel.id === c.id) { ctx.fillStyle = 'rgba(138,90,192,.22)'; ctx.fillRect(px + col * cw + 4, top + py + row * ch + 2, cw - 8, ch - 10); }
    AR.figure(ctx, x, y, 2, Object.assign({}, c.traits, { basket: true, items: 1 + i % 3, float: c.floatFeet, redEyes: c.redEyes, lk: c.lk, wet: c.wet }), 0);
    ctx.textAlign = 'center'; ctx.fillStyle = '#f5efe6'; ctx.font = '700 12px system-ui'; ctx.fillText(a.label || '', x, y + 20);
    ctx.fillStyle = '#c8b8d8'; ctx.font = '10px system-ui'; ctx.fillText(a.id || '', x, y + 34);
    if (a.malam) { malamN++; ctx.fillStyle = '#e8b84a'; ctx.font = '700 10px system-ui'; ctx.fillText('Malam-only', x, y + 48); }
    if (c.thief) { ctx.fillStyle = '#ffd080'; ctx.font = '700 11px system-ui'; ctx.fillText('🪙 theft', x, y + (a.malam ? 62 : 48)); }
    seen[a.id] = 1;
  });
  const box = $('wgCover'); box.innerHTML = ''; let miss = 0, okN = 0;
  AM.FOLK.forEach(a => { const b = document.createElement('b'); b.textContent = a.malam ? a.id + '·M' : a.id; b.title = a.label; b.className = seen[a.id] ? 'ok' : 'miss'; seen[a.id] ? okN++ : miss++; box.appendChild(b); });
  $('wgSub').textContent = '12 folklore · ' + malamN + ' Malam-only · cover ' + (miss ? 'MINUS ' + miss : 'LENGKAP');
  const n = $('fgNote'); if (folkSel && folkSel.thief) { n.hidden = false; n.textContent = folkSel.stole ? THEFT : '🪙 Tuyul — Demo theft / Periksa'; } else n.hidden = true;
  return { n: cs.length, okN, miss, malamN, ids: cs.map(c => c.anomalies[0]) };
}
function folkHit(e) {
  if (!folkLayout) return null;
  const cv = $('wgCv'), r = cv.getBoundingClientRect(), x = (e.clientX - r.left) * (cv.width / r.width), y = (e.clientY - r.top) * (cv.height / r.height);
  const L = folkLayout, col = (x - L.px) / L.cw | 0, row = (y - L.top - L.py) / L.ch | 0;
  return col < 0 || row < 0 ? null : folkCusts[row * L.cols + col] || null;
}
function folkInspect(c) {
  if (!c || !G) return false;
  folkSel = c; G.mode = c.mm ? 'malam' : 'biasa'; G.cfg = AM.MODES[G.mode] || G.cfg;
  G.phase = 'play'; G.current = null; G.markedList = []; G.payGiven = 0; G.over = false;
  const q = AM.queueSlot(0); c.u = q[0]; c.v = q[1]; c.state = 'queue'; c.qi = 0; c.served = false; c.pat = 999;
  G.active = [c]; G.px = AM.KASIR[0]; G.py = AM.KASIR[1];
  if (!AM.openInspect(G, c)) return false;
  const a = AM.ANOMALIES.find(x => x.id === c.anomalies[0]);
  // sheets live under #play — must show play or inspClose/pay are not visible
  J.show('play', false); closeSheets(); cleanOpen(); setMsg('inspMsg', a ? a.tip : ''); $('glossInsp').hidden = true;
  $('inspectSheet').hidden = false; paintInspect(); SFX.open(); return true;
}
function folkPayDemo() { if (!folkSel || !G) return; if (G.current !== folkSel || G.phase !== 'inspect') folkInspect(folkSel); if (G.phase === 'inspect') { AM.decide(G, false); drainEv(); } if (G.phase === 'pay') { $('inspectSheet').hidden = true; openPayUI(); } }
const THEFT = '🪙 Barang di rak hilang sendiri…';
let folkTheft = false; // Demo theft view: play chrome + #fxBanner + Restok, ✕ back to gallery
function folkStealDemo() {
  if (!G || mode !== 'folk') return false;
  if (!folkSel || !folkSel.thief) folkSel = folkCusts.find(c => c.anomalies[0] === 'tuyul_coin') || folkCusts.find(c => c.thief) || null;
  if (!folkSel) return false;
  const c = folkSel; G.mode = c.mm ? 'malam' : 'biasa'; G.cfg = AM.MODES[G.mode] || G.cfg;
  G.phase = 'play'; G.current = null; G.markedList = []; G.payGiven = 0; G.over = false;
  const q = AM.queueSlot(0); c.u = q[0]; c.v = q[1]; c.state = 'queue'; c.qi = 0; c.served = false; c.pat = 999; G.active = [c];
  const s = G.shelf.find(x => !x.empty) || G.shelf[0]; if (s) { s.empty = true; s.fx = 0.7; }
  c.stole = 1;
  const ui = AM.emptyUnit(G); if (ui >= 0) { G.px = AM.UNITS[ui].at[0]; G.py = AM.UNITS[ui].at[1]; } // stand at the robbed rak → Restok opens
  $('fgNote').hidden = false; $('fgNote').textContent = THEFT;
  folkTheft = true; walkTo = null; closeSheets(); J.show('play', false);
  AM.fx(G, 'bad', THEFT); G.fx.t = 1e9; // hold banner until Restok / ✕
  hud(); $('restockBtn').classList.add('on'); SFX.bad();
  return true;
}
function openFolkGallery() {
  mode = 'folk'; walkTo = null; closeSheets(); $('pause').hidden = true; paused = false;
  G = AM.create(77, { mode: 'malam' }); G.active = []; G.exiting = []; G.paused = true; G.fx = null;
  folkCusts = AM.FOLK.map((a, i) => AM.makeCustomer(AM.mul(900 + i * 17), G.cfg, i, { ghost: true, anomalies: [a.id] }, a.malam ? 'malam' : 'biasa'));
  folkSel = folkCusts[0] || null; $('wardGallery').classList.add('folk'); $('fgActs').hidden = false;
  wgTitle('PHASE C · FOLK', 'Galeri Folklore'); J.show('wardGallery', false); paintFolkGallery();
}
function closeFolkGallery() { $('wardGallery').classList.remove('folk'); history.replaceState(null, '', location.pathname); goHome(); }
function openGallery() {
  mode = 'gallery'; G = null; walkTo = null; closeSheets(); $('pause').hidden = true; paused = false;
  $('wardGallery').classList.remove('folk'); $('fgActs').hidden = true; $('fgNote').hidden = true;
  wgTitle('ART-P0.3 · LEMARI', 'Wardrobe Biasa'); J.show('wardGallery', false); paintGallery();
}

/* ---------- Art-P0.3 wardrobe gallery (?gallery=1 / ?wardrobe=1) — Biasa seed proof, no packs ---------- */
function galleryWanted() {
  const q = location.search + '&' + location.hash.replace(/^#/, '?');
  return /(?:^|[?&#])(?:gallery|wardrobe)=1\b/.test(q) || /(?:^|[?&#])gallery\b/.test(q);
}
function gallerySeed() {
  const m = (location.search + location.hash).match(/(?:[?&#]|^)seed=(\d+)/);
  return m ? (+m[1] || 2) : 2;
}
function paintGallery() {
  const seed = gallerySeed(), g = AM.create(seed, { mode: 'biasa' }), cs = g.customers, K = Object.keys(AM.WARD);
  const cv = $('wgCv'), ctx = cv.getContext('2d');
  const cols = 8, cellW = 156, cellH = 200, padX = 24, padY = 18, top = 8;
  const rows = Math.ceil(cs.length / cols);
  cv.width = padX * 2 + cols * cellW; cv.height = top + padY + rows * cellH + 10;
  ctx.fillStyle = '#241c2c'; ctx.fillRect(0, 0, cv.width, cv.height);
  const seen = {}; K.forEach(k => { seen[k] = new Set(); });
  cs.forEach((c, i) => {
    const col = i % cols, row = (i / cols) | 0, x = padX + col * cellW + cellW / 2, y = top + padY + row * cellH + 118;
    const f = c.traits.face; K.forEach(k => seen[k].add(f[k]));
    AR.figure(ctx, x, y, 2.15, Object.assign({}, c.traits, { basket: true, items: 1 + (i % 3) }), 0);
    ctx.fillStyle = '#f5efe6'; ctx.font = '700 11px system-ui'; ctx.textAlign = 'center';
    ctx.fillText(c.sapaan + ' ' + c.spoken, x, y + 18);
    ctx.font = '10px system-ui'; ctx.fillStyle = '#c8b8d8';
    ctx.fillText(f.top + ' · ' + f.bottom + ' · ' + f.foot, x, y + 32);
    ctx.fillText(f.hair + ' · kc ' + f.glasses + ' · mask ' + f.mask, x, y + 44);
  });
  ctx.textAlign = 'left';
  // coverage chips
  const rare = { foot: ['sandal', 'boots'], bottom: ['rok', 'olahraga'], top: ['bikini', 'olahraga', 'polisi'], hair: ['hijab', 'botak'], glasses: ['hitam', 'kotak', 'bulat'], mask: ['on'] };
  const box = $('wgCover'); box.innerHTML = '';
  let miss = 0, okN = 0;
  K.forEach(k => {
    const lab = document.createElement('span'); lab.className = 'lab'; lab.textContent = k + ':'; box.appendChild(lab);
    AM.WARD[k].forEach(v => {
      const b = document.createElement('b'); b.textContent = v;
      const hit = seen[k].has(v); if (hit) { b.className = 'ok'; okN++; } else { b.className = 'miss'; miss++; }
      if ((rare[k] || []).indexOf(v) >= 0) b.title = 'varian kunci';
      box.appendChild(b);
    });
  });
  const uniq = new Set(cs.map(c => AM.wardSig(c.traits.face))).size;
  $('wgSub').textContent = 'Biasa seed ' + seed + ' · ' + cs.length + ' pelanggan · ' + uniq + ' unique · cover ' + (miss ? 'MINUS ' + miss : 'LENGKAP') + ' · dressShift';
  return { n: cs.length, uniq, miss, okN, seen: Object.fromEntries(K.map(k => [k, [...seen[k]]])) };
}
function closeGallery() { history.replaceState(null, '', location.pathname); goHome(); }

function boot() {
  J.initMute('anomaliminimarket.mute', ['muteBtn', 'muteBtn2']);
  paintBest(); paintEnds(); paintLock(); checkPortrait(); $('glossN').textContent = AM.ANOMALIES.length;
  $('glossHome').innerHTML = glossHTML(); $('glossInsp').innerHTML = glossHTML();
  window.addEventListener('orientationchange', () => setTimeout(checkPortrait, 150));
  window.addEventListener('resize', checkPortrait);
  lockLandscape();

  $('playBtn').onclick = () => requestStart('biasa');
  $('nightBtn').onclick = () => requestStart('malam');
  $('easyBtn').onclick = () => requestStart('latihan');
  $('tutBtn').onclick = () => requestStart('tut');
  $('offerTut').onclick = () => { J.setLS(OFFER_KEY, '1'); start('tut'); };
  $('offerSkip').onclick = () => { J.setLS(OFFER_KEY, '1'); start('biasa'); };
  $('offerCancel').onclick = () => { $('tutOffer').hidden = true; syncChrome(); };
  $('bestBtn').onclick = () => {
    const b = loadBest(); J.show('result', true); $('resEnd').hidden = true;
    $('resKick').textContent = 'REKOR LOKAL'; $('resTitle').textContent = 'Papan skor HP ini';
    $('resSub').textContent = 'Skor tertinggi di perangkat ini'; $('resScore').textContent = b[0] ? b[0].s : '—';
    $('resBest').textContent = ''; $('resStats').innerHTML = ''; $('resNote').hidden = true; $('retryTutBtn').hidden = true;
    $('lbList').innerHTML = b.map((o, i) => '<li class="' + (o.n === myName() ? 'me' : '') + '">' + J.esc(o.n) + ' — ' + o.s + (o.w ? ' ✓' : '') + '</li>').join('') || '<li>Kosong</li>';
    $('againBtn').textContent = 'Menu'; $('againBtn').onclick = goHome;
  };

  $('inspectBtn').onclick = () => { if (G && !paused && G.phase === 'play') openInspectUI(); };
  $('restockBtn').onclick = () => { if (G && !paused && (G.phase === 'play' || G.phase === 'restock')) openRestockUI(); };
  $('payBtn').onclick = () => { if (G && !paused) { if (G.phase === 'pay') openPayUI(); else note('Loloskan pelanggan dulu untuk bayar'); } };
  $('interactBtn').onclick = () => {
    if (!G || paused) return;
    if (G.phase === 'play') { const q = AM.servable(G); if (q && AM.atKasir(G)) openInspectUI(); else if (AM.nearUnit(G, true) >= 0) openRestockUI(); else if (q || AM.stockRatio(G) >= 1) openInspectUI(); else openRestockUI(); }
    else if (G.phase === 'inspect') note('Pilih ✓ Loloskan atau ✖ Tolak');
    else if (G.phase === 'pay') openPayUI();
    else if (G.phase === 'restock') finishRestock();
  };

  $('inspClose').onclick = () => { if (G) { AM.cancelInspect(G); hud(); } closeSheets(); if (mode === 'folk') folkReturn(); else note('Inspeksi ditunda'); };
  $('passBtn').onclick = () => afterDecide(false);
  $('rejectBtn').onclick = () => afterDecide(true);
  $('glossBtn').onclick = () => { $('glossInsp').hidden = !$('glossInsp').hidden; };

  $('payBack').onclick = $('payClose').onclick = backToInspectUI;
  $('changeClear').onclick = () => { AM.clearChange(G); $('payGiven').textContent = AM.money(0); setMsg('payMsg', 'Kembalian di-reset. Susun lagi.', ''); };
  $('changeOk').onclick = () => doPay(true);
  $('cashReject').onclick = () => doPay(false);
  $('qrisOk').onclick = () => doPay(true);
  $('qrisWrong').onclick = () => doPay(false);

  $('restockClose').onclick = $('restockDone').onclick = finishRestock;

  $('lessonBtn').onclick = () => {
    if (!G || !G.isTut) return;
    const s = AM.tutCur(G); if (s && s.ok === 'ack') AM.tutAck(G); else AM.tutSkip(G);
    hud();
  };

  $('pauseBtn').onclick = togglePause; $('resumeBtn').onclick = togglePause;
  $('exitBtn').onclick = () => { if (mode === 'folk') { closeSheets(); folkReturn(); } else goHome(); }; $('quitBtn').onclick = goHome;
  $('againBtn').onclick = () => start(mode === 'tut' ? 'biasa' : mode);
  $('retryTutBtn').onclick = () => start('tut');
  $('resMenu').onclick = goHome;
  $('shareBtn').onclick = () => {
    const t = 'Aku ' + (G && G.perfect ? 'shift SEMPURNA di' : G && G.won ? 'selesai shift' : 'main') + ' Anomali Mini Market skor ' + (G ? AM.scoreOf(G) : '') + '!', url = GAME_URL; // full game URL (no ?v= / unlock), never the site root
    if (navigator.share) navigator.share({ text: t, url }).catch(() => {});
    else if (navigator.clipboard) navigator.clipboard.writeText(t + ' ' + url).then(() => J.toast('Tersalin', 'good'));
  };

  $('cv').addEventListener('pointerdown', tapCanvas);

  // debug walk-solid overlay (default OFF): ?debug=solids · #debugsolids · localStorage anomaliminimarket.debugSolids=1
  AR.setDebugSolids(/debug=solids/.test(location.search) || /debugsolids/i.test(location.hash) || J.getLS('anomaliminimarket.debugSolids') === '1');
  bindStick(); bindKeys();

  $('wgClose').onclick = () => { if (mode === 'folk') closeFolkGallery(); else closeGallery(); };
  $('wgCv').onclick = e => { if (mode === 'folk') { const c = folkHit(e); if (c) folkInspect(c); } };
  $('fgInsp').onclick = () => folkSel && folkInspect(folkSel);
  $('fgPay').onclick = folkPayDemo;
  $('fgSteal').onclick = folkStealDemo;
  if (folkWanted()) openFolkGallery();
  else if (galleryWanted()) openGallery();
  else if (/^#demo/.test(location.hash)) start('latihan');
  requestAnimationFrame(loop);
}

window.AMApp = { get G() { return G; }, get lastGate() { return lastGate; }, pickHit, get mode() { return mode; }, get walkTo() { return walkTo; }, requestStart, start, malamOpen, paintLock, doPay, note, overlayOpen, openGallery, paintGallery, galleryWanted, folkWanted, openFolkGallery, paintFolkGallery, folkInspect, folkPayDemo, folkStealDemo, get folkTheft() { return folkTheft; }, get folkCusts() { return folkCusts; }, get folkSel() { return folkSel; }, debugSolids(on) { AR.setDebugSolids(on); J.setLS('anomaliminimarket.debugSolids', on ? '1' : ''); return AR.debugSolids; } };
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();

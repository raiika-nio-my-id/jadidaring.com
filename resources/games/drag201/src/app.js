/* Drag 201: app (screens, input, race loop, career/garage, online, audio) */
(function (root) {
'use strict';
const D = root.D201, R = root.D201R, N = root.MPNet, doc = document, $ = id => doc.getElementById(id);
const NAME_KEY = 'drag201.name', SAVE_KEY = 'drag201.save', MUTE_KEY = 'drag201.mute';
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const getLS = k => { try { return root.localStorage.getItem(k); } catch (e) { return null; } }, setLS = (k, v) => { try { root.localStorage.setItem(k, v); } catch (e) { /* private mode */ } };
const fmt = ms => ms == null ? '–' : (ms / 1000).toFixed(3), fmt2 = ms => ms == null ? '–' : (ms / 1000).toFixed(2);
const BODY = ['#e8463a', '#2f7de1', '#1fa35b', '#8f3bd6', '#ff8a1f', '#14b8c4', '#ff5fa2', '#f2f2f2', '#22252e', '#ffd23f'];
const STRIPE = ['#f7f1e3', '#ffd23f', '#111', '#ff8a1f', '#7fd8ff', '#e8463a', '#3ddc84'];
const PAINT_COST = 40;
/** livery of a bike: saved paint or the factory colors */
function paintOf(id) { const b = bikeOf(id), p = save.paint && save.paint[id]; return p ? { col: BODY[p[0]] || b.col, col2: STRIPE[p[1]] || b.col2, pi: p } : { col: b.col, col2: b.col2, pi: null }; }
const PAL = ['#e8463a', '#2f7de1', '#1fa35b', '#8f3bd6', '#ff8a1f', '#14b8c4'];
function toast(msg, kind, ms) { const t = doc.createElement('div'); t.className = 'toast ' + (kind || ''); t.textContent = msg; $('toasts').appendChild(t); setTimeout(() => t.remove(), ms || 2600); }
function myName() { return ($('nameInput').value || '').replace(/[^\p{L}\p{N} ._'-]/gu, '').trim().slice(0, 16); }

/* ---------- save ---------- */
function blankSave() { return { coins: 150, cur: 'bebek4', own: { bebek4: { mesin: 0, knalpot: 0, gir: 0, ban: 0 } }, car: 0, best: null, tut: 0, runs: 0 }; }
let save = (() => { try { const s = JSON.parse(getLS(SAVE_KEY) || 'null'); if (s && s.own && s.own.bebek4) return Object.assign(blankSave(), s); } catch (e) { /* fresh */ } return blankSave(); })();
function persist() { setLS(SAVE_KEY, JSON.stringify(save)); paintCoins(); }
function paintCoins() { for (const id of ['coinHome', 'coinCareer', 'coinGarage']) $(id).textContent = '🪙 ' + save.coins; }
const mySpec = () => D.spec(save.cur, save.own[save.cur]);
const bikeOf = id => D.BIKES.find(b => b.id === id) || D.BIKES[0];

/* ---------- audio ---------- */
let AC = null, muted = getLS(MUTE_KEY) === '1', eng = null;
function ac() { if (AC || muted) { if (AC && AC.state === 'suspended') AC.resume(); return AC; } try { AC = new (root.AudioContext || root.webkitAudioContext)(); } catch (e) { AC = null; } return AC; }
function tone(f, d, type, vol, slide) { const a = ac(); if (!a || muted) return; const o = a.createOscillator(), g = a.createGain(), t = a.currentTime; o.type = type || 'square'; o.frequency.setValueAtTime(f, t); if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + d); g.gain.setValueAtTime(vol || 0.08, t); g.gain.exponentialRampToValueAtTime(0.0001, t + d); o.connect(g); g.connect(a.destination); o.start(t); o.stop(t + d + 0.02); }
function noise(d, vol, fq) { const a = ac(); if (!a || muted) return; const n = a.sampleRate * d, b = a.createBuffer(1, n, a.sampleRate), ch = b.getChannelData(0); for (let i = 0; i < n; i++) ch[i] = (Math.random() * 2 - 1) * (1 - i / n); const s = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain(); f.type = 'bandpass'; f.frequency.value = fq || 900; g.gain.value = vol || 0.2; s.buffer = b; s.connect(f); f.connect(g); g.connect(a.destination); s.start(); }
const SFX = { amber: () => tone(620, 0.16, 'square', 0.06), green: () => tone(1240, 0.32, 'square', 0.08), foul: () => tone(180, 0.5, 'sawtooth', 0.1, 90), pop: () => noise(0.09, 0.35, 1600), perfect: () => { tone(880, 0.08, 'triangle', 0.08); setTimeout(() => tone(1320, 0.12, 'triangle', 0.08), 70); }, nos: () => noise(0.7, 0.3, 500), click: () => tone(700, 0.04, 'triangle', 0.05), win: () => { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => tone(f, 0.18, 'triangle', 0.09), i * 110)); noise(1.2, 0.12, 700); }, lose: () => tone(330, 0.4, 'triangle', 0.08, 160), chat: () => tone(990, 0.05, 'sine', 0.04), coin: () => tone(1400, 0.08, 'triangle', 0.06, 1900) };
function engine(on) {
  const a = ac(); if (!a || muted) { if (eng) { eng.g.gain.value = 0; } return; }
  if (!eng) { const o1 = a.createOscillator(), o2 = a.createOscillator(), f = a.createBiquadFilter(), g = a.createGain(); o1.type = 'sawtooth'; o2.type = 'square'; f.type = 'lowpass'; f.frequency.value = 900; f.Q.value = 6; g.gain.value = 0; o1.connect(f); o2.connect(f); f.connect(g); g.connect(a.destination); o1.start(); o2.start(); eng = { o1, o2, f, g }; }
  if (!on) eng.g.gain.setTargetAtTime(0, a.currentTime, 0.08);
}
function engineSet(rpm, load) { if (!eng || muted || !AC) return; const t = AC.currentTime, f = 34 + rpm * 190; eng.o1.frequency.setTargetAtTime(f, t, 0.03); eng.o2.frequency.setTargetAtTime(f * 0.502, t, 0.03); eng.f.frequency.setTargetAtTime(500 + rpm * 2600, t, 0.05); eng.g.gain.setTargetAtTime(0.025 + load * 0.06, t, 0.05); }
function paintMute() { for (const id of ['muteBtn', 'muteBtn2']) $(id).textContent = muted ? '🔇' : '🔊'; }

/* ---------- screens ---------- */
const SCREENS = ['home', 'career', 'garage', 'lobby', 'race', 'result'];
function show(id, keepRace) { for (const s of SCREENS) { if (s === 'race' && keepRace) continue; $(s).hidden = s !== id; } if (keepRace) $('race').hidden = false; doc.documentElement.classList.toggle('jr-hub-off', id === 'race' || keepRace); if (id === 'home') paintHome(); }

/* ---------- home ---------- */
function paintHome() {
  paintCoins(); const sp = mySpec(), b = bikeOf(save.cur), ideal = D.simIdeal(sp).summary();
  $('stripBike').textContent = b.name; $('stripStat').textContent = 'Waktu ideal ' + fmt2(ideal.tot) + ' s · ' + ideal.top + ' km/j';
  drawBikeCv($('stripCv'), save.cur, 0.86);
  const ci = Math.min(save.car, D.RIVALS.length - 1), rv = D.RIVALS[ci];
  $('careerSub').textContent = save.car >= D.RIVALS.length ? 'Juara! Raja Sirkuit sudah tumbang 👑' : 'Lawan ' + (ci + 1) + '/10 · ' + rv.n + ' · 🪙 ' + rv.pay;
  $('sunSub').textContent = isSunday() ? 'Hari Minggu: koin 2× ☀️' : 'Sirkuit pagi · koin 2× tiap Minggu';
  $('taSub').textContent = save.best ? 'Rekormu ' + fmt(save.best) + ' s' : 'Kejar rekor nasional';
  $('bestLine').textContent = save.best ? 'Rekor pribadi: ' + fmt(save.best) + ' s' : '';
}
function drawBikeCv(c, id, k, tuneCol) {
  const r = Math.min(2, root.devicePixelRatio || 1), w = c.clientWidth || c.width, h = c.clientHeight || c.height; c.width = w * r; c.height = h * r; const g = c.getContext('2d'); g.setTransform(r, 0, 0, r, 0, 0); g.clearRect(0, 0, w, h);
  const b = bikeOf(id), p = save.own[id] ? paintOf(id) : b, s = Math.min(w / 110, h / 64) * (k || 1); R.bike(g, w / 2 - 32 * s, h - 6 * s, s, { matic: !!b.cvt, col: p.col, col2: p.col2, num: '201' });
}
let lbCache = null;
async function loadLb() {
  try { const r = await fetch('/api/game/scores?limit=20', { headers: { Accept: 'application/json' } }); if (!r.ok) throw Error(r.status); const d = await r.json(); lbCache = Array.isArray(d.scores) ? d.scores : []; }
  catch (e) { lbCache = lbCache || null; }
  paintLb();
}
function paintLb() {
  const el = $('lbList'); if (lbCache === null) { el.innerHTML = '<li class="muted">Papan rekor offline. Main dulu, nanti dicoba lagi.</li>'; return; }
  if (!lbCache.length) { el.innerHTML = '<li class="muted">Belum ada rekor. Jadi yang pertama!</li>'; return; }
  const me = myName(); el.innerHTML = lbCache.slice(0, 10).map(s => '<li' + (s.name === me ? ' class="me"' : '') + '><span>' + esc(s.name) + '</span><b>' + fmt(30000 - s.score) + ' s</b></li>').join('');
}

/* ---------- career ---------- */
function paintCareer() {
  paintCoins();
  $('ladder').innerHTML = D.RIVALS.map((rv, i) => {
    const done = i < save.car, next = i === save.car, lock = i > save.car, b = bikeOf(rv.bike), lv = Object.values(rv.tune).reduce((a, x) => a + x, 0);
    return '<li style="--bc:' + b.col + '" class="' + (done ? 'done' : next ? 'next' : 'lock') + '"><span class="n">' + (done ? '✓' : i + 1) + '</span><span class="who"><b>' + esc(rv.n) + (i === 9 ? ' 👑' : '') + '</b><small>' + esc(b.name) + (lv ? ' · modif +' + lv : ' · standar') + ' · 🪙 ' + rv.pay + '</small></span>'
      + (lock ? '<span>🔒</span>' : '<button class="btn small ' + (next ? 'green' : 'ghost') + '" data-rv="' + i + '">' + (done ? 'Ulang' : 'Tantang') + '</button>') + '</li>';
  }).join('');
}

/* ---------- garage ---------- */
let gIdx = 0;
const PART_TXT = { mesin: ['Mesin', 'Bore up & porting: tenaga semua gigi'], knalpot: ['Knalpot', 'Knalpot racing (sirkuit): tenaga + top speed'], gir: ['Gir rasio', 'Gigi 1–2 lebih galak: start makin ngacir'], ban: ['Ban', 'Ban drag: zona start lebih lebar, jarang spin'] };
function paintGarage() {
  paintCoins(); const b = D.BIKES[gIdx], own = !!save.own[b.id], tune = save.own[b.id] || {}, sp = D.spec(b.id, tune), base = D.spec(b.id, {});
  $('gName').textContent = b.name; $('gCls').textContent = b.cls + (save.cur === b.id ? ' · dipakai' : '');
  drawBikeCv($('garageCv'), b.id, 1);
  const pw = x => x.k / 250, top = x => x.vg[x.vg.length - 1] / 50, grip = x => (0.3 + x.grip * 0.14);
  $('gStats').innerHTML = [['Tenaga', pw(sp), pw(base)], ['Top speed', top(sp), top(base)], ['Grip start', grip(sp), grip(base)]].map(([n, v, v0]) => '<div class="stat"><span>' + n + '</span><span class="bar2"><i class="' + (v > v0 + 0.001 ? 'up' : '') + '" style="width:' + Math.round(Math.min(1, v) * 100) + '%"></i></span><b>' + Math.round(v * 100) + '</b></div>').join('');
  const ideal = D.simIdeal(sp).summary(); $('gIdeal').textContent = 'Ideal ' + fmt2(ideal.tot) + ' s · ' + ideal.top + ' km/j';
  const use = $('gUse'); if (own) { use.textContent = save.cur === b.id ? '✓ Dipakai' : 'Pakai motor ini'; use.disabled = save.cur === b.id; }
  else { use.textContent = 'Beli 🪙 ' + b.price; use.disabled = save.coins < b.price; }
  $('parts').innerHTML = D.PARTS.map(p => {
    const lv = tune[p.id] | 0, max = lv >= 5, cost = max ? 0 : p.cost[lv];
    return '<li><i>' + p.icon + '</i><span class="pn"><b>' + PART_TXT[p.id][0] + ' · Lv ' + lv + '</b><small>' + PART_TXT[p.id][1] + '</small><span class="pips">' + [0, 1, 2, 3, 4].map(i => '<span class="' + (i < lv ? 'on' : '') + '"></span>').join('') + '</span></span>'
      + (own ? (max ? '<b class="muted">MAX</b>' : '<button class="btn small green" data-part="' + p.id + '"' + (save.coins < cost ? ' disabled' : '') + '>🪙 ' + cost + '</button>') : '<small class="muted">beli dulu</small>') + '</li>';
  }).join('');
  // livery (cat & striping): the #1 "modif motor" search intent is visual modif
  const lv = $('livery'); lv.hidden = !own;
  if (own) { const p = paintOf(b.id), cur = p.pi || [BODY.indexOf(b.col), STRIPE.indexOf(b.col2)];
    const sw = (arr, k) => arr.map((c, i) => '<button class="sw' + (cur[k] === i ? ' on' : '') + '" style="background:' + c + '" data-paint="' + k + ',' + i + '" aria-label="Warna ' + (i + 1) + '"' + (cur[k] !== i && save.coins < PAINT_COST ? ' disabled' : '') + '></button>').join('');
    $('swBody').innerHTML = sw(BODY, 0); $('swStripe').innerHTML = sw(STRIPE, 1); }
}
function buyPaint(k, i) {
  const b = D.BIKES[gIdx]; if (!save.own[b.id]) return; const p = paintOf(b.id), cur = (p.pi || [BODY.indexOf(b.col), STRIPE.indexOf(b.col2)]).slice();
  if (cur[k] === i || save.coins < PAINT_COST) return; save.coins -= PAINT_COST; cur[k] = i; save.paint = save.paint || {}; save.paint[b.id] = cur;
  SFX.coin(); toast(k ? 'Striping baru! 🎨' : 'Cat baru! 🎨', 'good', 1200); persist(); paintGarage(); paintHome(); bikeToRoom();
}
function garageUse() {
  const b = D.BIKES[gIdx];
  if (!save.own[b.id]) { if (save.coins < b.price) return; save.coins -= b.price; save.own[b.id] = { mesin: 0, knalpot: 0, gir: 0, ban: 0 }; SFX.coin(); toast('Motor baru: ' + b.name + '!', 'good'); }
  save.cur = b.id; persist(); paintGarage(); bikeToRoom();
}
function buyPart(id) { const b = D.BIKES[gIdx], t = save.own[b.id]; if (!t) return; const p = D.PARTS.find(x => x.id === id), lv = t[id] | 0; if (lv >= 5 || save.coins < p.cost[lv]) return; save.coins -= p.cost[lv]; t[id] = lv + 1; SFX.coin(); persist(); paintGarage(); bikeToRoom(); }

/* =====================================================================
   RACE
   ===================================================================== */
let race = null, mode = null, room = null, me = null;
const cv = $('raceCv'), g = cv.getContext('2d'), tc = $('tachCv'), tg = tc.getContext('2d'); let W = 0, H = 0, DPR = 1, TS = 0, BOT = 0;
function fit() { DPR = Math.min(2, root.devicePixelRatio || 1); W = cv.clientWidth || root.innerWidth; H = cv.clientHeight || root.innerHeight; cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR); TS = tc.clientWidth || 150; const duel = race && race.duel, pr = (duel ? $('rpm1') : $('operBtn')).getBoundingClientRect(); BOT = pr.height ? Math.max(0, H - pr.top + 6) : 0; if (W > H && H < 560 && !duel) BOT = Math.min(BOT, H * 0.08); tc.width = Math.round(TS * DPR); tc.height = Math.round(TS * DPR); }
function lane(o) { return Object.assign({ run: new D.Run(o.spec), seenEv: 0 }, o); }
/** start a race. opts: { kind, rivals:[{name,spec,skill,seed}], t0 (clock ms of green), clock() } */
function startRace(opts) {
  const sp = mySpec(), b = paintOf(save.cur), lanes = [];
  lanes.push(lane({ id: me != null ? me : 1, name: myName() || 'Kamu', spec: sp, col: b.col, col2: b.col2, num: '1', me: true }));
  (opts.rivals || []).forEach((r, i) => { const rb = bikeOf(r.spec.id); lanes.push(lane({ id: r.id != null ? r.id : -1 - i, name: r.name, spec: r.spec, col: r.col || rb.col, col2: r.col2 || rb.col2, num: String(i + 2), bot: !r.remote, remote: !!r.remote, brain: r.remote ? null : D.botBrain(r.skill, r.seed) })); });
  if (opts.duel) { const c2 = PAL.find(c => c !== b.col) || PAL[1]; lanes[0].name = myName() || 'Pemain 1'; lanes.push(lane({ id: 2, name: 'Pemain 2', spec: sp, col: c2, col2: '#ffffff', num: '2', p2: true })); }
  if (opts.kind === 'demo') { lanes[0].bot = true; lanes[0].me = false; lanes[0].brain = D.botBrain(0.8, 77); lanes[0].name = 'Raja'; }
  const clock = opts.clock || (() => performance.now());
  race = { kind: opts.kind, rv: opts.rv, lanes, clock, t0: opts.t0 != null ? opts.t0 : clock() + 4600, fx: R.makeFx(), lit: -1, done: false, endAt: 0, shake: 0, camD: 0, coachK: '', g: opts.g, sent: 0, finSent: false, tut: opts.kind === 'tut', sun: !!opts.sun, day: !!opts.day, duel: !!opts.duel };
  race.lanes.sort((a, c) => (a.me ? 2 : a.p2 ? 1 : 0) - (c.me ? 2 : c.p2 ? 1 : 0)); // me nearest (drawn last, bottom)
  gasHeld = false; nosUsed = false; gas2 = false; $('gasBtn').classList.remove('nos', 'used'); $('gasLbl').textContent = 'GAS'; $('gasSub').textContent = 'tahan';
  $('gas2').classList.remove('nos', 'used', 'down'); $('gas2Lbl').textContent = 'GAS'; $('gas2Sub').textContent = 'tahan'; $('oper2Sub').textContent = 'lepas kopling'; $('oper2').classList.remove('auto'); $('race').classList.toggle('duel', race.duel); $('p2grp').hidden = !race.duel; $('duelRpm').hidden = !race.duel;
  $('gasKey').textContent = 'Spasi'; $('operKey').textContent = 'K'; $('gas2Key').textContent = 'A'; dqHide(); race.keyK = '';
  $('operSub').textContent = 'lepas kopling'; $('operBtn').classList.remove('auto'); $('tree').querySelectorAll('i').forEach(i => i.classList.remove('on'));
  $('chatBtn').hidden = mode !== 'online'; $('raceChatSlot').hidden = true; $('coach').hidden = true;
  $('hudInfo').textContent = opts.sun ? 'Sunmori Cup ☀️' : opts.kind === 'career' ? 'Karir ' + (opts.rv + 1) + '/10' : opts.kind === 'ta' ? 'Time Attack' : opts.kind === 'tut' ? 'Latihan' : opts.kind === 'online' ? 'Online · ' + (room ? room.code : '') : opts.kind === 'demo' ? 'Demo' : opts.duel ? 'Duel 1 HP 👥' : 'Adu Cepat';
  show('race'); fit(); engine(true);
}
const myLane = () => race && race.lanes.find(L => L.me);
/** step every locally simulated lane up to the race clock */
function advance() {
  const tt = race.clock() - race.t0;
  for (const L of race.lanes) {
    if (L.remote) continue; const r = L.run;
    if (L.me && !L.bot) r.setGas(gasHeld || (r.launched));
    if (L.p2) r.setGas(gas2 || r.launched);
    while (r.t + D.DT <= tt && r.t < 30000) { if (L.brain) D.driveBot(r, L.brain); r.step(D.DT); }
  }
  return tt;
}
let gasHeld = false, nosUsed = false, gas2 = false;
const p2Lane = () => race && race.lanes.find(L => L.p2);
function oper2Tap() { const L = p2Lane(); if (!L || race.done) return; advance(); const r = L.run; if (r.fin !== null || r.t < -4000 + 50) return; const q = r.tap(); if (q) feedback(L, q); }
function nos2Tap() { const L = p2Lane(); if (!L) return; advance(); if (L.run.useNos()) { $('gas2').classList.add('used'); SFX.nos(); callout('Pemain 2 · NOS! 🔥', '#7fd8ff'); race.shake = 6; } }
function operTap() {
  const L = myLane(); if (!L || L.bot || race.done) return; advance(); const r = L.run; if (r.fin !== null) return;
  if (r.t < -4000 + 50) return;
  const q = r.tap(); if (!q) return; feedback(L, q);
}
function nosTap() { const L = myLane(); if (!L || L.bot) return; advance(); if (L.run.useNos()) { nosUsed = true; $('gasBtn').classList.add('used'); SFX.nos(); callout('NOS! 🔥', '#7fd8ff'); race.shake = 6; } }
const kc = x => '<kbd class="kc">' + x + '</kbd>';
/* t365u false start = DISQUALIFIED: the bike stays on the line (game.js freezes a fouled run). Solo: red overlay + auto restart of the same race; online: out of this heat, wait for the result; duel: the other rider still runs (bye run). */
const SOLO_RESTART = { career: 1, quick: 1, ta: 1, tut: 1 };
let dqT = 0, dqLeft = 0;
function dqHide() { clearInterval(dqT); dqT = 0; $('dqBox').hidden = true; }
function onFoul(L) {
  if (!race || L.bot) return; race.shake = 10;
  if (race.kind === 'online' && L.me) { L.run.t = 30000; $('dqWhy').textContent = 'Start sebelum lampu hijau. Kamu keluar dari heat ini, tunggu hasil.'; $('dqCnt').textContent = ''; $('dqAgain').hidden = true; $('dqMenu').hidden = true; $('dqBox').hidden = false; setTimeout(() => { if (race && race.kind === 'online') $('dqBox').hidden = true; }, 2600); return; }
  if (!L.me || !SOLO_RESTART[race.kind]) return;
  race.dq = true; race.done = true; engineSet(0.15, 0.1);
  save.runs++; persist();
  $('dqWhy').textContent = 'Start sebelum lampu hijau. Tunggu lampu HIJAU, baru tekan OPER' + (kbMode() ? ' (K).' : '.');
  $('dqAgain').hidden = false; $('dqMenu').hidden = false; $('dqBox').hidden = false;
  dqLeft = 3; const paint = () => { $('dqCnt').textContent = 'Start ulang dalam ' + dqLeft + '…'; }; paint();
  clearInterval(dqT); dqT = setInterval(() => { dqLeft--; if (dqLeft <= 0) { dqHide(); if (race && race.dq) again(); } else paint(); }, 1000);
}
const kbMode = () => doc.documentElement.classList.contains('kb') || matchMedia('(hover:hover) and (pointer:fine)').matches;
function paintKeys(r, tt) {
  if (race.dq) { if (race.keyK !== 'dq') { race.keyK = 'dq'; $('keybar').innerHTML = ''; } return; }
  const k = !r ? '' : r.fin !== null ? 'f' : r.launched ? (r.sp.cvt ? 'c' : 'l') : tt >= 0 ? 'g' : 'w'; if (race.keyK === k + (gasHeld ? 1 : 0)) return; race.keyK = k + (gasHeld ? 1 : 0);
  const it = (cls, keys, txt) => '<span class="' + cls + '">' + keys.map(kc).join('') + ' ' + txt + '</span>';
  $('keybar').innerHTML = !r || k === 'f' ? '' : !r.launched
    ? it(gasHeld ? 'now' : '', ['Spasi'], 'tahan = GAS') + it(k === 'g' ? 'now' : 'off', ['K'], k === 'g' ? 'START sekarang!' : 'START (tunggu hijau)') + it('off', ['N'], 'NOS')
    : it(k === 'c' ? 'off' : 'now', ['K', 'Spasi'], k === 'c' ? 'otomatis (CVT)' : 'oper gigi') + it(r.nos > 0 ? '' : 'off', ['N'], 'NOS 🔥');
}
const Q_TXT = { perfect: ['PERFECT!', '#3ddc84'], good: ['Bagus', '#ffd23f'], early: ['Kecepetan', '#ff8b8b'], late: ['Telat!', '#ff8b8b'], spin: ['Ban spin!', '#ff8b8b'], bog: ['Mesin ngempos', '#ff8b8b'] };
function feedback(L, q) {
  const r = L.run, E = L.p2 ? { gl: 'gas2Lbl', gs: 'gas2Sub', gb: 'gas2', os: 'oper2Sub', ob: 'oper2' } : { gl: 'gasLbl', gs: 'gasSub', gb: 'gasBtn', os: 'operSub', ob: 'operBtn' }, who = race.duel ? (L.p2 ? 'P2 · ' : 'P1 · ') : '';
  if (!r.ev.length) return; const e = r.ev[r.ev.length - 1];
  if (e[0] === 'launch') {
    if (r.foul) { callout(who + 'DISKUALIFIKASI', '#ff4d4d', 'Start sebelum lampu hijau'); SFX.foul(); $('tree').querySelector('.red').classList.add('on'); onFoul(L); }
    else { const t = Q_TXT[q]; callout(who + (q === 'perfect' ? 'START PERFECT!' : t[0]), t[1], 'RT ' + fmt(r.rt) + ' s'); if (q === 'perfect') SFX.perfect(); }
    SFX.pop(); race.fx.smoke(L.sx || 100, (L.sy || H * 0.8) - 4, q === 'spin' ? 26 : 12, 1.2); race.shake = q === 'spin' ? 8 : 4;
    $(E.gl).textContent = 'NOS'; $(E.gs).textContent = '1× dorongan'; $(E.gb).classList.add('nos'); if (L.p2) $('gas2Key').textContent = 'D'; else { $('gasKey').textContent = 'N'; $('operKey').textContent = 'K/Spasi'; } $(E.os).textContent = r.sp.cvt ? 'CVT otomatis' : 'naik gigi'; $(E.ob).classList.toggle('auto', !!r.sp.cvt);
  } else if (e[0] === 'shift') { const t = Q_TXT[q]; callout(who + t[0], t[1], 'Gigi ' + (e[3] + 1)); SFX.pop(); if (q === 'perfect') SFX.perfect(); race.fx.flame((L.sx || 100) - 6, (L.sy || H * 0.8) - 22, q === 'perfect'); race.shake = q === 'perfect' ? 5 : 2; }
}
let calloutT = 0;
function callout(txt, col, sub) { const c = $('callout'); c.classList.remove('show'); void c.offsetWidth; c.innerHTML = esc(txt) + (sub ? '<small>' + esc(sub) + '</small>' : ''); c.style.color = col || '#fff'; c.classList.add('show'); clearTimeout(calloutT); calloutT = setTimeout(() => c.classList.remove('show'), 950); }
function coach(k, html) { if (race.coachK === k) return; race.coachK = k; const c = $('coach'); if (!html) { c.hidden = true; return; } c.innerHTML = html; c.hidden = false; }
function treeLights(t, r) {
  const n = t >= 0 ? 4 : t >= -1000 ? 3 : t >= -2000 ? 2 : t >= -3000 ? 1 : 0;
  if (n !== race.lit) { const is = $('tree').querySelectorAll('i'); is.forEach((el, i) => { if (i < 4) el.classList.toggle('on', i < 3 ? n > i : n >= 4); }); if (n > race.lit && n > 0) (n === 4 ? SFX.green : SFX.amber)(); race.lit = n; if (n === 4 && race.kind !== 'demo') callout('HIJAU!', '#3ddc84'); }
  if (r && r.foul) $('tree').querySelector('.red').classList.add('on');
}
function frameRace(now) {
  const tt = advance(), L = myLane() || race.lanes[race.lanes.length - 1], r = L.run;
  if (race.kind === 'online') onlineRace(tt);
  // events -> fx for bots/remote too
  for (const ln of race.lanes) { const ev = ln.run.ev; while (ln.seenEv < ev.length) { const e = ev[ln.seenEv++]; if ((ln.me && !ln.bot) || ln.p2) continue; if (e[0] === 'launch') race.fx.smoke(ln.sx || 0, (ln.sy || 0) - 4, 8); if (e[0] === 'shift') race.fx.flame((ln.sx || 0) - 6, (ln.sy || 0) - 22 * (ln.s || 1), e[2] === 'perfect'); } }
  treeLights(tt, r);
  // camera: follow me (or leader in demo), smoothed
  const lead = race.kind === 'demo' || race.duel ? race.lanes.reduce((a, c) => (c.run.d > a.run.d ? c : a)) : L;
  const want = Math.max(0, Math.min(D.DIST + 25, dispD(lead, tt) - 4)); race.camD += (want - race.camD) * 0.18;
  race.fx.step(1 / 60); if (race.shake > 0) race.shake *= 0.86;
  if (L.run.launched && L.run.fin === null && Math.random() < 0.5) race.fx.smoke((L.sx || 0) - 8, (L.sy || 0) - 10 * (L.s || 1), 1, 0.5);
  g.setTransform(DPR, 0, 0, DPR, 0, 0);
  const view = race.lanes.map(ln => ({ run: ln.remote ? ghost(ln, tt) : ln.run, name: ln.name, col: ln.col, col2: ln.col2, me: (ln.me && !ln.bot) || !!ln.p2, num: ln.num, spec: ln.spec, bot: ln.bot && !ln.me, src: ln }));
  R.scene(g, { W, H, day: !!race.day, bottom: BOT, lanes: view, camD: race.camD, now, fx: race.fx, shake: race.shake });
  view.forEach(v => { v.src.sx = v.sx; v.src.sy = v.sy; v.src.s = v.s; });
  tg.setTransform(DPR, 0, 0, DPR, 0, 0); R.tach(tg, TS, r, { grip: r.sp.grip, now });
  $('distMe').style.width = Math.min(100, r.d / D.DIST * 100) + '%'; $('distTxt').textContent = Math.min(201, Math.floor(r.d)) + ' / 201 m';
  const L2 = race.duel && p2Lane(); if (L2) { const r2 = L2.run; $('distTxt').textContent = 'P1 ' + Math.min(201, Math.floor(r.d)) + ' · P2 ' + Math.min(201, Math.floor(r2.d)) + ' m'; rpmBar('rpm1', r); rpmBar('rpm2', r2);
    const ib2 = !r2.launched ? (() => { const b = D.launchBand(r2.sp.grip); return r2.rpm >= b[0] && r2.rpm <= b[1]; })() : Math.min(r2.rpm, r2.slip > 0 || r2.spin > 0 ? r2.road() + 0.04 : 1) >= D.SHIFT.perfect[0];
    $('oper2').classList.toggle('hint', r2.fin === null && (r2.launched ? !r2.sp.cvt && ib2 && r2.g < r2.sp.vg.length - 1 && r2.shiftT <= 0 : tt >= 0)); $('gas2').classList.toggle('hint', !r2.launched && tt > -3200 && !gas2); }
  // pad hints (ease of use: pulse the button you should press now)
  const inBand = !r.launched ? (() => { const b = D.launchBand(r.sp.grip); return r.rpm >= b[0] && r.rpm <= b[1]; })() : Math.min(r.rpm, r.slip > 0 || r.spin > 0 ? r.road() + 0.04 : 1) >= D.SHIFT.perfect[0];
  const operHint = r.fin === null && (r.launched ? !r.sp.cvt && inBand && r.g < r.sp.vg.length - 1 && r.shiftT <= 0 : tt >= 0);
  $('operBtn').classList.toggle('hint', !!operHint && !L.bot); $('gasBtn').classList.toggle('hint', !r.launched && tt > -3200 && !gasHeld && !L.bot);
  engineSet(r.rpm, r.launched ? (r.fin === null ? 1 : 0.2) : (gasHeld ? 0.8 : 0.15));
  if (!race.duel && !L.bot) paintKeys(r, tt);
  if (race.duel) coach(tt < -600 ? 'd0' : '', tt < -600 ? '👥 <b>P2 kiri</b> · <b>P1 kanan</b>. Tahan GAS di zona hijau, tap OPER saat HIJAU!' + (kbMode() ? '<br>P2: ' + kc('A') + ' gas ' + kc('S') + ' oper ' + kc('D') + ' NOS · P1: ' + kc('Spasi') + ' gas ' + kc('K') + ' oper ' + kc('N') + ' NOS' : '') : '');
  else if (race.tut || (save.runs < 2 && race.kind !== 'online' && race.kind !== 'demo')) tutCoach(tt, r, inBand);
  else if (!r.launched && tt > 1500 && !L.bot) coach('late', '<b>Lampu sudah HIJAU!</b> Tap <b>OPER</b>' + (kbMode() ? ' ' + kc('K') : '') + ' sekarang.'); else coach('', '');
  // finish logic (solo)
  if (race.kind !== 'online' && !race.done) {
    const all = race.lanes.every(ln => ln.run.fin !== null || ln.run.t >= 25000 || ln.run.foul), meDone = race.lanes.filter(ln => (ln.me && !ln.bot) || ln.p2).every(ln => ln.run.fin !== null || ln.run.t >= 25000 || ln.run.foul) && (r.fin !== null || r.t >= 25000 || race.duel);
    if (meDone && !race.endAt) { race.endAt = now + (race.kind === 'demo' ? 1800 : 1400); if (!race.duel && r.fin !== null && !r.foul) callout('FINISH ' + fmt(r.fin) + ' s', '#ffd23f', 'ET ' + fmt(r.fin - r.rt)); }
    if (race.endAt && now >= race.endAt) { for (const ln of race.lanes) while (ln.run.fin === null && ln.run.t < 25000) { if (ln.brain) D.driveBot(ln.run, ln.brain); ln.run.step(D.DT); } race.done = true; soloEnd(); }
    else if (!race.endAt && all) race.endAt = now + 600;
  }
}
function rpmBar(id, r) { const el = $(id); if (!el) return; const z = !r.launched ? D.launchBand(r.sp.grip) : D.SHIFT.perfect, x = r.launched && (r.slip > 0 || r.spin > 0) ? Math.min(r.rpm, r.road() + 0.04) : r.rpm; el.querySelector('i').style.width = Math.round(Math.min(1, x) * 100) + '%'; const s = el.querySelector('s'); s.style.left = (z[0] * 100).toFixed(1) + '%'; s.style.width = ((z[1] - z[0]) * 100).toFixed(1) + '%'; el.classList.toggle('in', x >= z[0] && x <= z[1]); el.querySelector('b').textContent = r.fin !== null ? 'FINISH' : r.launched ? (r.sp.cvt ? 'CVT' : 'Gigi ' + (r.g + 1)) : 'START'; }
function dispD(ln, tt) { return ln.remote ? ghost(ln, tt).d : ln.run.d; }
function tutCoach(tt, r, inBand) {
  const K = kbMode(), G = K ? ' ' + kc('Spasi') : ' (tombol merah)', O = K ? ' ' + kc('K') : '', O2 = K ? ' ' + kc('K') + '/' + kc('Spasi') : '', NS = K ? ' ' + kc('N') : ' (tombol biru)';
  if (r.foul) return coach('foul', '<b>Kecepatan!</b> Tap OPER hanya setelah lampu <b style="color:#3ddc84">HIJAU</b>.');
  if (!r.launched) {
    if (tt < 0 && !gasHeld) return coach('g0', '① <b>Tahan GAS</b>' + G + '. Lampu kuning menyala satu per satu…');
    if (tt < 0 && !inBand) return coach('g1', '② Jaga jarum di <b style="color:#3ddc84">zona hijau</b>: lepas-tahan GAS' + G + ' sedikit.');
    if (tt < 0) return coach('g2', '③ Mantap! Tahan di hijau, <b>tunggu lampu HIJAU</b>… jangan tekan OPER dulu!');
    return coach('g3', '④ <b>HIJAU! Tap OPER</b>' + O + ' sekarang!');
  }
  if (r.fin !== null) return coach('', '');
  if (r.sp.cvt && r.nos > 0) return coach('c1', 'Matic = <b>CVT otomatis</b>, tidak perlu oper gigi. Pakai <b style="color:#7fd8ff">NOS 🔥</b>' + NS + ' di tengah lintasan!');
  if (r.g < 2) return coach('s1', 'Jarum masuk <b style="color:#3ddc84">hijau</b> + lampu kedip → <b>tap OPER</b>' + O2 + ' naik gigi.');
  if (r.nos > 0) return coach('n1', 'Gas terus! Tekan <b style="color:#7fd8ff">NOS 🔥</b>' + NS + ' untuk dorongan sekali.');
  return coach('s2', 'Terus oper di zona hijau sampai garis 201 m!');
}
/* remote lane: dead-reckoned from progress pushes */
function ghost(ln, tt) {
  const p = ln.prog || { d: 0, v: 0, t: -4000, g: 0, w: 0, l: 0 }, dt = Math.max(0, Math.min(1500, tt - p.t)) / 1000, v = p.v;
  let d = p.d + v * dt; if (ln.finRow) d = Math.max(d, D.DIST + Math.max(0, (tt - ln.finRow.tot) / 1000) * 12); else d = Math.min(d, D.DIST - 0.3);
  const o = ln.gh || (ln.gh = { d: 0 }); o.d = o.d ? o.d + (d - o.d) * 0.35 : d;
  return { d: o.d, v, rpm: Math.min(1, v / (ln.spec.vg[Math.min(p.g, ln.spec.vg.length - 1)] || 30)), g: p.g, wheelie: p.w || 0, launched: !!p.l, fin: ln.finRow ? 1 : null, nosT: 0 };
}

/* ---------- solo modes ---------- */
function rivalOf(i) { const rv = D.RIVALS[i]; return { name: rv.n, spec: D.spec(rv.bike, rv.tune), skill: rv.skill, seed: (Math.random() * 1e9) | 0 }; }
function startCareer(i) { mode = 'solo'; me = null; const n = Math.min(i, save.car, D.RIVALS.length - 1); startRace({ kind: 'career', rv: n, rivals: [rivalOf(n)] }); }
const isSunday = () => new Date().getDay() === 0;
function startQuick(sun) {
  mode = 'solo'; me = null; const sp = mySpec(), names = D.BOT_NAMES.slice().sort(() => Math.random() - 0.5);
  startRace({ kind: 'quick', sun: !!sun, day: !!sun, rivals: [0.3, 0.5, 0.68].map((sk, i) => ({ name: names[i], spec: sp, skill: sk + Math.random() * 0.08, seed: (Math.random() * 1e9) | 0, col: PAL[(i + 1) % PAL.length] })) });
}
function startDuel() { mode = 'solo'; me = null; startRace({ kind: 'duel', duel: true, rivals: [] }); }
function startTA() { mode = 'solo'; me = null; startRace({ kind: 'ta', rivals: [] }); }
function startTut() { mode = 'solo'; me = null; startRace({ kind: 'tut', rivals: [] }); }
function startDemo() { mode = 'demo'; me = null; startRace({ kind: 'demo', t0: performance.now() + 900, rivals: [0.55, 0.7, 0.9].map((sk, i) => ({ name: D.BOT_NAMES[i], spec: D.spec(['bebek2', 'sport', 'camp'][i], { mesin: 2 }), skill: sk, seed: 11 + i, col: PAL[i + 1] })) }); }
function rows() {
  return race.lanes.map(ln => { const s = ln.remote ? (ln.finRow || { rt: null, et: null, tot: null, top: 0, foul: 0 }) : ln.run.summary(); return { id: ln.id, name: ln.name, me: ln.me && !ln.bot, bot: ln.bot, rt: s.rt, et: s.et, tot: s.tot, top: s.top, foul: s.foul }; })
    .sort(rank);
}
function rank(a, b) { const k = x => (x.foul ? 2e9 : 0) + (x.tot == null ? 1e9 : x.tot); return k(a) - k(b); }
function soloEnd() {
  engine(false); if (race.kind === 'demo') { setTimeout(() => { if (mode === 'demo') startDemo(); }, 600); return; }
  if (race.kind === 'duel') return duelEnd();
  const rs = rows(), mine = rs.find(x => x.me), r = myLane().run, pos = rs.indexOf(mine) + 1, win = pos === 1 && !mine.foul && mine.tot != null;
  save.runs++; let coins = 0, title, sub = '';
  if (race.kind === 'career') { const rv = D.RIVALS[race.rv]; if (win) { coins = rv.pay + r.perf * 10; if (race.rv === save.car) { save.car++; sub = race.rv === 9 ? '👑 Kamu RAJA SIRKUIT! Karir tamat.' : 'Lawan berikutnya terbuka: ' + D.RIVALS[race.rv + 1].n; } else sub = 'Balapan ulang: bayaran penuh tetap.'; } else { coins = Math.round(rv.pay * 0.3); sub = mine.foul ? 'Start sebelum hijau = diskualifikasi.' : tip(r); } title = win ? 'Menang lawan ' + rv.n + '!' : 'Kalah dari ' + rv.n; }
  else if (race.kind === 'quick') { coins = [140, 70, 40, 25][pos - 1] + r.perf * 5; if (mine.foul) coins = 10; if (race.sun && isSunday()) coins *= 2; title = mine.foul ? 'Diskualifikasi' : win ? 'Juara 1!' : 'Posisi ' + pos; sub = win ? 'Ngacir! Coba Karir buat bayaran lebih besar.' : mine.foul ? 'Tunggu lampu hijau dulu.' : tip(r);  if (race.sun) { title = '☀️ ' + title; sub = (isSunday() ? 'Bonus Minggu: koin 2×! ' : 'Main lagi hari Minggu: koin 2×. ') + sub; }}
  else if (race.kind === 'tut') { coins = save.tut ? 0 : 100; save.tut = 1; title = mine.foul ? 'Hampir! Ulangi latihan' : 'Latihan selesai 🎓'; sub = mine.foul ? 'Tap OPER setelah lampu HIJAU.' : 'Siap. Sekarang tantang Ucup Karbu di Karir!'; }
  else { coins = mine.foul ? 0 : 30 + r.perf * 5; title = mine.foul ? 'Diskualifikasi' : fmt(mine.tot) + ' s'; const isBest = !mine.foul && mine.tot != null && (!save.best || mine.tot < save.best); if (isBest) { save.best = mine.tot; title += ' · Rekor baru!'; } sub = mine.foul ? 'Start sebelum hijau tidak dihitung.' : 'Total = reaksi + ET. ' + tip(r); }
  save.coins += coins; persist();
  showResult({ title, sub, rows: rs, win: win || (race.kind !== 'career' && race.kind !== 'quick' && !mine.foul), coins, marks: [r.lq].concat(r.summary().marks), ta: race.kind === 'ta' && !mine.foul && mine.tot != null ? mine.tot : null });
  if (win) SFX.win(); else SFX.lose(); if (coins) setTimeout(SFX.coin, 600);
}
function duelEnd() {
  const rs = race.lanes.map(ln => { const s = ln.run.summary(); return { id: ln.id, name: (ln.p2 ? 'P2 · ' : 'P1 · ') + ln.name, me: true, rt: s.rt, et: s.et, tot: s.tot, top: s.top, foul: s.foul, p2: !!ln.p2 }; }).sort(rank);
  const a = rs[0], b = rs[1], ok = x => !x.foul && x.tot != null; let title, sub;
  if (!ok(a)) { title = 'Dua-duanya diskualifikasi'; sub = 'Tunggu lampu HIJAU dulu, baru tap OPER.'; }
  else { title = a.name.slice(5) + ' menang! 🏁'; sub = ok(b) ? 'Selisih ' + fmt(b.tot - a.tot) + ' s · ' + (a.rt != null && b.rt != null && a.rt < b.rt ? 'menang di start (RT ' + fmt(a.rt) + ')' : 'menang di oper gigi (ET ' + fmt(a.et) + ')') : b.name.slice(5) + ' diskualifikasi (start sebelum hijau).'; }
  duelScore[a.p2 ? 1 : 0] += ok(a) ? 1 : 0; sub += ' · Skor P1 ' + duelScore[0] + ' – ' + duelScore[1] + ' P2';
  showResult({ title, sub, rows: rs, win: ok(a), coins: 0, marks: [] }); SFX.win();
}
let duelScore = [0, 0];
function tip(r) {
  const m = r.summary().marks, bad = m.filter(x => x === 'early' || x === 'late').length;
  if (r.lq === 'bog') return 'Tips: gas kurang saat start, jaga jarum di zona hijau.'; if (r.lq === 'spin') return 'Tips: rpm terlalu tinggi saat start, ban spin. Modif Ban membantu.';
  if (r.rt > 450) return 'Tips: reaksi lambat (RT ' + fmt(r.rt) + '). Tap OPER tepat saat lampu hijau.'; if (bad) return 'Tips: ' + bad + ' oper meleset. Oper saat lampu kecil di takometer berkedip.';
  return 'Tips: upgrade motor di Garasi biar makin kencang.';
}
function confetti(on) {
  const box = $('result'); box.querySelectorAll('.cf').forEach(e => e.remove()); if (!on || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const cols = ['#ffd23f', '#e8463a', '#2f7de1', '#1fa35b', '#fff', '#ff8a1f'];
  for (let i = 0; i < 42; i++) { const e = document.createElement('i'); e.className = 'cf' + (i % 5 === 0 ? ' sq' : ''); e.style.cssText = 'left:' + (Math.random() * 100).toFixed(1) + '%;background:' + cols[i % cols.length] + ';animation-delay:' + (Math.random() * 0.6).toFixed(2) + 's;animation-duration:' + (1.6 + Math.random() * 1.4).toFixed(2) + 's;--dx:' + Math.round(Math.random() * 160 - 80) + 'px;--r:' + Math.round(Math.random() * 900 - 450) + 'deg'; box.appendChild(e); }
  setTimeout(() => box.querySelectorAll('.cf').forEach(e => e.remove()), 3400);
}
function showResult(o) {
  $('resTitle').textContent = o.title; $('resSub').textContent = o.sub || ''; $('resKick').textContent = race && race.kind === 'online' ? 'HASIL · ONLINE' : 'HASIL · 201 M';
  $('result').querySelector('.res-card').className = 'res-card ' + (o.win ? 'win' : 'lose');
  $('resRows').innerHTML = o.rows.map((x, i) => '<tr class="' + (x.me ? 'me' : '') + '"><td>' + (i + 1) + '</td><td>' + esc(x.name) + (x.bot ? ' 🤖' : '') + (isGm(x.id) ? ' <em class="gm-tag">(GM)</em>' : '') + '</td><td>' + fmt(x.rt) + '</td><td>' + fmt(x.et) + '</td><td' + (x.foul ? ' class="foul">DQ' : '>' + fmt(x.tot)) + '</td><td>' + (x.top || '–') + '</td></tr>').join('');
  $('resMarks').innerHTML = (o.marks || []).filter(Boolean).map(q => '<span class="' + q + '">' + esc((Q_TXT[q] || [q])[0]) + '</span>').join('');
  $('resReward').textContent = o.coins ? '+🪙 ' + o.coins : '';
  confetti(o.win && o.rows[0] && o.rows[0].me);
  const online = mode === 'online', host = online && room && room.isHost();
  $('againBtn').hidden = online && !host; $('toLobbyBtn').hidden = !host; $('endWait').textContent = online && !host ? 'Menunggu host memulai lagi…' : '';
  $('nextBtn').hidden = !(race && race.kind === 'career' && save.car < D.RIVALS.length && race.rv < save.car);
  $('resGarage').hidden = online;
  taPending = o.ta; $('taForm').hidden = o.ta == null; if (o.ta != null) { $('taNote').textContent = 'Kirim ' + fmt(o.ta) + ' s sebagai ' + (myName() || '(isi nama dulu)'); $('taSubmit').disabled = false; }
  show('result', true);
}
let taPending = null;
async function submitTA() {
  const name = myName(); if (!name) { toast('Isi nama pembalap di menu dulu', 'warn'); return; } if (taPending == null) return; $('taSubmit').disabled = true;
  try { const r = await fetch('/api/game/scores', { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ name, score: Math.max(0, 30000 - Math.round(taPending)) }) }); if (!r.ok) throw Error(r.status); toast('Terkirim ke papan rekor!', 'good'); taPending = null; $('taForm').hidden = true; loadLb(); }
  catch (e) { $('taSubmit').disabled = false; toast('Gagal mengirim, coba lagi', 'warn'); }
}
function again() {
  ac(); if (!race) return;
  if (mode === 'online') return startOnline();
  const k = race.kind; if (k === 'career') startCareer(race.rv); else if (k === 'quick') startQuick(race.sun); else if (k === 'ta') startTA(); else if (k === 'duel') startDuel(); else startTut();
}
async function exitToMenu(silent) {
  dqHide();
  const r = room; room = null; mode = null; race = null; engine(false); show('home'); resetChat(); gmMeSync();
  if (location.hash && /^#(latihan|demo)$/i.test(location.hash) && root.history.replaceState) root.history.replaceState(null, '', location.pathname + location.search);
  if (r && !silent) await r.leave(); else if (r && conn.forget) conn.forget();
}
function confirmExit() { if (race && !race.done && race.kind !== 'demo' && myLane() && myLane().run.launched && !root.confirm('Keluar dari balapan?')) return; exitToMenu(false); }

/* ---------- input ---------- */
function bindPad(el, down, up) {
  el.addEventListener('pointerdown', e => { e.preventDefault(); ac(); el.classList.add('down'); try { el.setPointerCapture(e.pointerId); } catch (x) { /* ok */ } down(); });
  const end = e => { if (!el.classList.contains('down')) return; el.classList.remove('down'); if (up) up(); };
  el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end); el.addEventListener('lostpointercapture', end);
  el.addEventListener('contextmenu', e => e.preventDefault());
}
bindPad($('gasBtn'), () => { const L = myLane(); if (!L) return; if (L.run.launched) nosTap(); else gasHeld = true; }, () => { gasHeld = false; });
bindPad($('operBtn'), operTap);
bindPad($('gas2'), () => { const L = p2Lane(); if (!L) return; if (L.run.launched) nos2Tap(); else gas2 = true; }, () => { gas2 = false; });
bindPad($('oper2'), oper2Tap);
const keys = {};
doc.addEventListener('keydown', e => {
  if (e.target.tagName !== 'INPUT' && /^( |k|K|n|N|Enter|ArrowUp|a|A|s|S|d|D)$/.test(e.key)) doc.documentElement.classList.add('kb');
  if ($('race').hidden || e.target.tagName === 'INPUT') return; const k = e.key; if (keys[k]) return; keys[k] = 1;
  if (race && race.dq) { if (k === 'k' || k === 'K' || k === 'Enter' || k === ' ') { e.preventDefault(); dqHide(); again(); } return; }
  if (k === ' ') { e.preventDefault(); const L = myLane(); if (L && L.run.launched) operTap(); else { gasHeld = true; $('gasBtn').classList.add('down'); } }
  else if (k === 'Enter' || k === 'ArrowUp' || k === 'k' || k === 'K') { e.preventDefault(); operTap(); }
  else if (k === 'n' || k === 'N' || k === 'Shift') nosTap();
  else if ((k === 'a' || k === 'A') && race && race.duel) { const L = p2Lane(); if (L && L.run.launched) oper2Tap(); else { gas2 = true; $('gas2').classList.add('down'); } }
  else if ((k === 's' || k === 'S') && race && race.duel) oper2Tap();
  else if ((k === 'd' || k === 'D') && race && race.duel) nos2Tap();
});
doc.addEventListener('keyup', e => { delete keys[e.key]; if (e.key === 'a' || e.key === 'A') { gas2 = false; $('gas2').classList.remove('down'); } if (e.key === ' ') { gasHeld = false; $('gasBtn').classList.remove('down'); } });

/* ---------- main loop ---------- */
function frame(now) { root.requestAnimationFrame(frame); if (race && !$('race').hidden) { try { frameRace(now); } catch (e) { console.error(e); } } if (room) room.tick(); }

/* ---------- home hero: a looping 2-bike drag ---------- */
function hero() {
  const c = $('heroCv'), hg = c.getContext('2d'); let hr = null, w = 0, h = 0, r = 1, t0 = 0;
  const mk = now => { const s1 = D.spec('camp', { mesin: 3 }), s2 = D.spec('bebek2', { mesin: 5, gir: 5 }); hr = { a: new D.Run(s1), b: new D.Run(s2), ba: D.botBrain(0.85, (Math.random() * 1e9) | 0), bb: D.botBrain(0.9, (Math.random() * 1e9) | 0), fx: R.makeFx(), cam: 0 }; t0 = now + 2600; };
  const size = () => { w = c.clientWidth || 360; h = c.clientHeight || 260; r = Math.min(2, root.devicePixelRatio || 1); c.width = w * r; c.height = h * r; };
  root.addEventListener('resize', size);
  const loop = now => {
    root.requestAnimationFrame(loop); if ($('home').hidden || doc.visibilityState !== 'visible') return; if (!w) size(); if (!hr) mk(now);
    const tt = now - t0; for (const [run, br] of [[hr.a, hr.ba], [hr.b, hr.bb]]) while (run.t + D.DT <= tt && run.t < 30000) { D.driveBot(run, br); run.step(D.DT); }
    if (hr.a.t > 12000 && hr.b.t > 12000) mk(now);
    hr.cam += (Math.max(0, Math.min(D.DIST + 20, Math.max(hr.a.d, hr.b.d) - 6)) - hr.cam) * 0.1; hr.fx.step(1 / 60);
    hg.setTransform(r, 0, 0, r, 0, 0); R.scene(hg, { W: w, H: h, hz: w > 700 ? 0.47 : 0.56, bottom: w > 700 ? 36 : 0, ax: w > 700 ? 0.44 : 0.3, lanes: [{ run: hr.b, name: 'Bli Komang', col: '#2f7de1', col2: '#ffd23f', num: '9' }, { run: hr.a, name: 'Raja Sirkuit', col: '#8f3bd6', col2: '#ff8a1f', num: '1' }], camD: hr.cam, now, fx: hr.fx });
  };
  root.requestAnimationFrame(loop);
}

/* =====================================================================
   ONLINE (2–4 riders). Host writes {t0 (server ms of green), seed, riders, bots}; every client simulates itself,
   pushes progress events ('p'), and records its own finish row in state.f via edit(). Host ends when all rows are in.
   ===================================================================== */
const conn = new N.Connection({ storage: root.sessionStorage, onWake: () => room && room.refresh(), lobbyWake: () => gmWake() });
let onlineOk = false, starting = false, endSending = false;
const sNow = () => conn.serverNow();
function makeRoom() { return new N.Room(conn, { onChange: onRoom }); }
function errMsg(e) { if (!e) return 'Koneksi bermasalah'; if (e.code === 'busy') return 'Server sibuk, coba ' + (e.wait || 10) + ' dtk lagi'; if (e.code === 'network') return 'Koneksi bermasalah'; if (e.status === 404 || e.status === 422) return 'Room tidak ditemukan'; return 'Gagal: ' + (e.server || e.message || ''); }
function bikeRow() { const t = save.own[save.cur] || {}, p = paintOf(save.cur), pi = p.pi || [BODY.indexOf(p.col), STRIPE.indexOf(p.col2)]; return [me, save.cur, (t.mesin | 0), (t.knalpot | 0), (t.gir | 0), (t.ban | 0), pi[0], pi[1]]; }
async function bikeToRoom() { const r = room; if (!r || r.spectator || r.s.ph !== 'lobby') return; const row = bikeRow(); try { await r.edit('bike', s => { const bk = Array.isArray(s.bk) ? s.bk.filter(x => Array.isArray(x) && x[0] !== me) : []; bk.push(row); s.bk = bk.slice(-16); }); } catch (e) { /* lobby only cosmetic */ } }
async function enterOnline(kind, opts) {
  if (room) { const old = room; room = null; old.leave(); }
  const r = makeRoom(); mode = 'online'; room = r; race = null; resetChat();
  try { await r.enter(kind, Object.assign({ set: { bots: 1 }, maxPlayers: 4 }, opts)); } catch (e) { if (room === r) { room = null; mode = null; } throw e; }
  me = r.me; if (r.s.ph === 'lobby') { renderRoom(); show('lobby'); } addChatLine({ k: 'sys-in' + Date.now(), t: 'sys', x: (myName() || 'Kamu') + ' masuk room' }); gmMeSync(); bikeToRoom(); return r;
}
async function onlineAction(kind) {
  const name = myName(); if (!name) { toast('Isi nama pembalap dulu', 'warn'); $('nameInput').focus(); return; }
  setLS(NAME_KEY, name); const code = $('codeInput').value.trim().toUpperCase();
  if (kind === 'join' && !/^[A-Z2-9]{6}$/.test(code)) { toast('Kode room 6 huruf/angka', 'warn'); return; }
  doc.querySelectorAll('.online-btn').forEach(b => { b.disabled = true; });
  try { await enterOnline(kind, { displayName: name, code }); }
  catch (e) { if (kind === 'join' && e.status === 409) { try { await enterOnline('watch', { displayName: name, code }); toast('Room penuh, kamu menonton', 'warn', 4000); } catch (e2) { toast(errMsg(e2), 'warn', 4000); } } else toast(errMsg(e), 'warn', 4000); }
  finally { doc.querySelectorAll('.online-btn').forEach(b => { b.disabled = !onlineOk; }); }
}
let seatSeen = null;
function onRoom(r, data) {
  if (r !== room) return;
  if (!data) { toast('Room ditutup', 'warn'); exitToMenu(true); return; }
  me = r.me; const s = r.s; gmMeSync(); joinLeave(r.seated()); syncChat(s.cm);
  if (s.ph === 'play' && s.s && s.g) {
    if (!race || race.g !== s.g) beginOnlineRace(s);
    else readProgress(data.events, s);
  } else if (s.ph === 'end' && s.res) { if (race && race.g === s.g && !race.done) finishOnline(s); else if (!race || race.g !== s.g) { beginOnlineRace(Object.assign({}, s, { s: s.s || { t0: 0, L: [], B: [] } }), true); finishOnline(s); } }
  else { if (!$('result').hidden && race) { /* host pressed "Ke lobby" */ } race = null; engine(false); renderRoom(); if ($('lobby').hidden) show('lobby'); }
}
function joinLeave(ps) { const ids = new Map(ps.map(p => [p.id, p.displayName])); if (seatSeen) { for (const [id, n] of ids) if (!seatSeen.has(id) && id !== me) { addChatLine({ k: 'sj' + id + Date.now(), t: 'sys', x: n + ' masuk room' }); SFX.chat(); } for (const [id, n] of seatSeen) if (!ids.has(id)) addChatLine({ k: 'sl' + id + Date.now(), t: 'sys', x: n + ' keluar' }); } seatSeen = ids; }
function specFromRow(row) { return D.spec(row[1], { mesin: row[2] | 0, knalpot: row[3] | 0, gir: row[4] | 0, ban: row[5] | 0 }); }
function beginOnlineRace(s, silent) {
  const S = s.s, mine = (S.L || []).find(x => x[0] === me), spect = !mine || (room && room.spectator);
  const rivals = [];
  (S.L || []).forEach((x, i) => { if (x[0] === me && !spect) return; rivals.push({ id: x[0], name: x[6] || ('P' + (i + 1)), spec: specFromRow(x), remote: true, col: PAL[i % PAL.length] }); });
  (S.B || []).forEach((b, i) => rivals.push({ id: -1 - i, name: b[0], spec: D.spec(b[1], { mesin: b[2], knalpot: b[2], gir: b[2], ban: b[2] }), skill: b[3], seed: b[4], col: PAL[(4 + i) % PAL.length] }));
  if (mine && !spect) { const t = { mesin: mine[2], knalpot: mine[3], gir: mine[4], ban: mine[5] }; if (mine[1] !== save.cur || JSON.stringify(t) !== JSON.stringify(save.own[save.cur])) { /* ride what you registered */ } }
  startRace({ kind: 'online', rivals, t0: Number(S.t0) || sNow() + 4000, clock: sNow, g: s.g });
  if (spect) { const L = myLane(); L.bot = true; L.me = false; L.remote = true; L.run.d = -999; race.lanes = race.lanes.filter(x => x !== L); race.spect = true; toast('Kamu menonton balapan ini', '', 2400); }
  if (silent) $('race').hidden = true;
  // every rider gets a distinct livery color by seat: same colors on every phone, never two red bikes
  // each rider shows their own livery; if an earlier seat already uses that body color, a free team color is used instead (same result on every phone)
  const used = new Set(), seatCol = new Map();
  (S.L || []).forEach(x => { const bb = bikeOf(String(x[1])); let c = BODY[x[7]] || bb.col; if (used.has(c)) c = PAL.find(q => !used.has(q)) || c; used.add(c); seatCol.set(x[0], [c, STRIPE[x[8]] || bb.col2]); });
  race.lanes.forEach(ln => { const sc = ln.id >= 0 && seatCol.get(ln.id); if (sc) { ln.col = sc[0]; ln.col2 = sc[1]; } });
  race.lanes.forEach(ln => { if (ln.remote) ln.prog = null; });
  readProgress(room.data.events, s);
}
function readProgress(events, s) {
  if (!race) return; const byId = new Map(race.lanes.filter(l => l.remote).map(l => [l.id, l]));
  for (const e of events || []) { if (e.type !== 'p' || !e.payload || e.payload.g !== s.g) continue; const ln = byId.get(e.playerId); if (!ln) continue; const p = e.payload; if (!ln.prog || p.t >= ln.prog.t) ln.prog = { d: +p.d || 0, v: +p.v || 0, t: +p.t || 0, g: p.gr | 0, w: +p.w || 0, l: p.l ? 1 : 0 }; }
  for (const f of Array.isArray(s.f) ? s.f : []) { if (!Array.isArray(f)) continue; const ln = byId.get(f[0]); if (ln && !ln.finRow) { ln.finRow = { tot: f[1], et: f[2], rt: f[3], foul: f[4], top: f[5] }; } }
}
let pushBusy = false, lastPush = 0;
function onlineRace(tt) {
  const r = room; if (!r || !race || race.spect) { hostCheck(tt); return; } const L = myLane(); if (!L) return; const run = L.run;
  // force a no-show after 12 s so a frozen phone cannot hold the room
  if (!run.launched && tt > 12000) { run.launched = true; run.foul = true; run.rt = tt; run.lq = 'bog'; run.fin = null; run.t = 30000; }
  const done = run.fin !== null || run.t >= 25000;
  // staggered write slots on the shared server clock: each rider owns its own phase of the 700 ms cycle, so pushes from 2-4 phones interleave instead of colliding (409)
  if (race.hIdx == null) { const LL = (r.s.s && r.s.s.L) || []; race.hN = Math.max(1, LL.length); race.hIdx = Math.max(0, LL.findIndex(x => x[0] === me)); }
  const slot = Math.floor((tt + 100000 - race.hIdx * 700 / race.hN) / 700);
  if (!done && !pushBusy && slot !== lastPush && tt > -1500) {
    pushBusy = true; lastPush = slot;
    r.push('p', { payload: { g: race.g, d: Math.round(run.d * 10) / 10, v: Math.round(run.v * 10) / 10, t: Math.round(run.t), gr: run.g, w: Math.round(run.wheelie * 100) / 100, l: run.launched ? 1 : 0 } }).catch(e => { if (e && e.status === 409) return r.settle(e.used).catch(() => {}); }).finally(() => { pushBusy = false; });
  }
  if (done && !race.finSent) { race.finSent = true; sendFin(run); }
  hostCheck(tt);
}
async function sendFin(run) {
  const r = room, g = race.g, s = run.summary(), row = [me, s.foul ? null : s.tot, s.et, s.rt, s.foul, s.top];
  if (s.tot == null) row[1] = null;
  try { await r.edit('fin', st => { if (st.ph !== 'play' || st.g !== g) return null; const f = Array.isArray(st.f) ? st.f.filter(x => Array.isArray(x) && x[0] !== me) : []; f.push(row); st.f = f; }); }
  catch (e) { if (race && race.g === g) { race.finSent = false; } }
}
function hostCheck(tt) {
  const r = room; if (!r || !r.isHost() || endSending || r.s.ph !== 'play' || r.s.g !== race.g) return;
  // results always list every registered rider; a rider that looks absent (left, or a presence blip) only stops blocking the end after 14 s
  const ids = new Set(r.seated().map(p => p.id)), riders = (r.s.s.L || []).map(x => x[0]), f = Array.isArray(r.s.f) ? r.s.f : [];
  const has = id => f.some(x => Array.isArray(x) && x[0] === id);
  const all = riders.every(id => has(id) || (!ids.has(id) && tt > 14000));
  if (!(all && tt > 0) && tt < 26000) return;
  endSending = true; const g = race.g;
  const bots = (r.s.s.B || []).map((b, i) => { const run = D.simBot(D.spec(b[1], { mesin: b[2], knalpot: b[2], gir: b[2], ban: b[2] }), b[3], b[4]), sm = run.summary(); return { id: -1 - i, name: b[0], bot: 1, rt: sm.rt, et: sm.et, tot: sm.tot, top: sm.top, foul: sm.foul }; });
  const names = new Map((r.s.s.L || []).map(x => [x[0], x[6]]));
  const hum = riders.map(id => { const x = f.find(y => y[0] === id); return x ? { id, name: names.get(id) || '?', rt: x[3], et: x[2], tot: x[1], top: x[5], foul: x[4] } : { id, name: names.get(id) || '?', rt: null, et: null, tot: null, top: 0, foul: 0 }; });
  const res = hum.concat(bots).sort(rank);
  r.edit('end', s => { if (s.ph !== 'play' || s.g !== g) return null; s.ph = 'end'; s.res = { rows: res }; return { status: 'waiting' }; }).catch(() => {}).finally(() => { endSending = false; });
}
function finishOnline(s) {
  if (!race) return; race.done = true; engine(false);
  const rs = (s.res.rows || []).map(x => Object.assign({}, x, { me: x.id === me })), mineI = rs.findIndex(x => x.me), mine = rs[mineI];
  let coins = 0, title = 'Balapan selesai', sub = '';
  if (mine) { const pos = mineI + 1; coins = mine.foul || mine.tot == null ? 10 : [150, 90, 60, 40][pos - 1] || 40; title = mine.foul ? 'Diskualifikasi' : pos === 1 ? 'Juara 1! 🏆' : 'Posisi ' + pos; sub = pos === 1 && !mine.foul ? 'Kamu tercepat di room ini.' : 'Juara: ' + (rs[0] ? rs[0].name : '–'); if (race.lanes.some(l => l.me && !l.bot)) { const run = myLane().run; mine.marks = [run.lq].concat(run.summary().marks); } }
  else { title = 'Hasil balapan'; sub = 'Juara: ' + (rs[0] ? rs[0].name : '–'); }
  const key = s.g + ':' + me; if (race.paid !== key && mine) { race.paid = key; save.coins += coins; save.runs++; persist(); (mineI === 0 && !mine.foul ? SFX.win : SFX.lose)(); }
  showResult({ title, sub, rows: rs, win: mine && mineI === 0 && !mine.foul, coins: mine ? coins : 0, marks: mine && mine.marks });
}
async function startOnline() {
  const r = room; if (!r || !r.isHost() || starting) return; const ps = r.seated(); if (!ps.length) return; starting = true; $('startBtn').disabled = true; $('againBtn').disabled = true;
  const nb = Math.max(0, Math.min(3, r.s.set.bots | 0, 4 - ps.length)), bk = Array.isArray(r.s.bk) ? r.s.bk : [];
  const L = ps.slice(0, 4).map(p => { const b = bk.find(x => Array.isArray(x) && x[0] === p.id) || [p.id, 'bebek4', 0, 0, 0, 0]; return [p.id, String(b[1]), b[2] | 0, b[3] | 0, b[4] | 0, b[5] | 0, p.displayName, b[6] == null ? -1 : b[6] | 0, b[7] == null ? -1 : b[7] | 0]; });
  const avg = L.reduce((a, x) => a + D.simIdeal(specFromRow(x)).fin, 0) / L.length, pick = D.RIVALS.slice().sort((a, b) => Math.abs(D.simIdeal(D.spec(a.bike, a.tune)).fin - avg) - Math.abs(D.simIdeal(D.spec(b.bike, b.tune)).fin - avg));
  const B = Array.from({ length: nb }, (_, i) => { const rv = pick[i]; const lv = Math.round(Object.values(rv.tune).reduce((a, x) => a + x, 0) / 4); return [rv.n, rv.bike, lv, Math.min(0.75, rv.skill), (Math.random() * 1e9) | 0]; });
  const g = Math.random().toString(36).slice(2, 8);
  try { await r.edit('start', s => { if ('gm' in s) delete s.gm; s.ph = 'play'; s.g = g; s.f = []; s.res = null; s.s = { t0: Math.round(sNow() + 5600), L, B }; return { status: 'playing' }; }); }
  catch (e) { toast(errMsg(e), 'warn'); }
  finally { starting = false; $('startBtn').disabled = false; $('againBtn').disabled = false; }
}
async function toLobby() { const r = room; if (!r || !r.isHost()) return; try { await r.edit('lobby', s => { s.ph = 'lobby'; s.s = null; s.res = null; s.f = []; return { status: 'waiting' }; }); } catch (e) { toast(errMsg(e), 'warn'); } }
async function setBots(v) { const r = room; if (!r || !r.isHost()) return; try { await r.edit('set', s => { if (s.ph !== 'lobby') return null; s.set.bots = v; }); } catch (e) { toast(errMsg(e), 'warn'); } }
function renderRoom() {
  const r = room; if (!r || !r.data) return; const s = r.s, host = r.isHost(), ps = r.seated(), nb = Math.max(0, Math.min(3, s.set.bots | 0)), bots = Math.max(0, Math.min(nb, 4 - ps.length)), bk = Array.isArray(s.bk) ? s.bk : [];
  $('roomCode').textContent = r.code; $('lobbyVis').textContent = r.data.visibility === 'public' ? 'Room publik: siapa saja bisa masuk lewat "Cari lawan".' : 'Room privat: masuk pakai kode atau link undangan.';
  $('pCount').textContent = (ps.length + bots) + '/4';
  $('pList').innerHTML = ps.map((p, i) => { const b = bk.find(x => Array.isArray(x) && x[0] === p.id), bn = b ? bikeOf(b[1]).name + ' +' + ((b[2] | 0) + (b[3] | 0) + (b[4] | 0) + (b[5] | 0)) : '…'; return '<li><span class="dot" style="background:' + PAL[i % PAL.length] + '"></span><span>' + esc(p.displayName) + (isGm(p.id) ? ' <em class="gm-tag">(GM)</em>' : '') + '</span>' + (p.id === r.me ? '<span class="tag">kamu</span>' : '') + (p.host ? '<span class="tag">host</span>' : '') + '<span class="bk">🏍️ ' + esc(bn) + '</span></li>'; }).join('')
    + Array.from({ length: bots }, (_, i) => '<li><span class="dot" style="background:' + PAL[(ps.length + i) % PAL.length] + '"></span><span>Bot ' + (i + 1) + ' 🤖</span><span class="tag">bot</span><span class="bk">setara level kalian</span></li>').join('');
  $('hostBox').hidden = !host; $('onBots').querySelectorAll('button').forEach(b => b.classList.toggle('on', +b.dataset.v === nb));
  $('lobbyWait').textContent = r.spectator ? 'Kamu menonton.' : host ? (ps.length < 2 && !bots ? 'Undang teman atau tambah bot, lalu mulai.' : '') : 'Menunggu host memulai…';
}
/* chat */
const BAD = /\b(anjing|bangsat|babi|kontol|memek|ngentot|goblok|tolol|fuck|shit|bitch)\b/gi;
function cleanChat(x) { return String(x || '').replace(/[\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120).replace(BAD, w => w[0] + '*'.repeat(w.length - 1)); }
const chatKeys = new Set(); let chatSeq = Date.now() % 1e7, chatAt = 0;
function resetChat() { chatKeys.clear(); $('chatLog').innerHTML = ''; seatSeen = null; }
function addChatLine(m) {
  if (!m || !m.k || chatKeys.has(m.k)) return; chatKeys.add(m.k); const log = $('chatLog'), p = doc.createElement('p');
  if (m.t === 'sys') { p.className = 'sys'; p.textContent = m.x; } else { p.innerHTML = '<b>' + esc(m.n || '?') + (isGm(m.p) ? ' <em class="gm-tag">(GM)</em>' : '') + ':</b> ' + esc(m.x); if (!$('race').hidden && $('raceChatSlot').hidden && m.p !== me) { callout('💬 ' + m.n, '#fff', m.x.slice(0, 40)); } }
  const stick = log.scrollTop + log.clientHeight >= log.scrollHeight - 30; log.appendChild(p); while (log.children.length > 80) log.firstChild.remove(); if (stick) log.scrollTop = log.scrollHeight;
}
function syncChat(cm) { for (const m of cm || []) { if (!m || typeof m !== 'object') continue; const fresh = !chatKeys.has(m.k); addChatLine({ k: String(m.k || ''), p: m.p, n: String(m.n || ''), x: cleanChat(m.x) }); if (fresh && m.p !== me && chatKeys.size > 1) SFX.chat(); } }
async function sendChat(raw) {
  const x = cleanChat(raw); if (!x || !room) return false; const n = Date.now(); if (n - chatAt < 1000) { toast('Pelan-pelan ngetiknya 🙂', 'warn', 1500); return false; } chatAt = n;
  const m = { k: 'c' + me + '.' + (++chatSeq), p: me, n: myName() || '?', x }; addChatLine(m);
  try { await room.edit('chat', s => { s.cm = (s.cm || []).concat([m]).slice(-30); }); } catch (e) { toast(errMsg(e), 'warn'); } return true;
}
const QUICK = ['🔥 Gas!', '😎 Siap', '🏁 Rematch?', '👏 GG', '😂', '🙏 Tunggu'];
/* GM */
let gm = false, gmRooms = null, gmErr = '', gmBusy = false, gmAt = 0, gmWakeT = 0, gmUI = null;
const gmHash = () => (location.hash || '').toLowerCase().includes(N.GM_KEY);
function gmSync() { const on = gmHash(); if (on === gm) return; gm = on; gmRooms = null; gmErr = ''; $('gmRooms').hidden = !gm; if (gm) gmLoad(); else renderGm(); }
function isGm(id) { return mode === 'online' && !!room && id != null && id > 0 && room.isGamemaster(id); }
function gmMeSync() { doc.documentElement.classList.toggle('gm-on', mode === 'online' && !!room && room.isGamemaster()); if (gmUI) gmUI.sync(); }
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
async function gmLoad() { if (!gm || gmBusy) return; if (!onlineOk) { renderGm(); return; } gmBusy = true; gmAt = Date.now(); renderGm(); try { const d = await conn.rooms({ gm: true }); gmRooms = Array.isArray(d && d.rooms) ? d.rooms : []; gmErr = ''; } catch (e) { gmErr = errMsg(e); } finally { gmBusy = false; renderGm(); } }
function gmWake() { if (!gm || room) return; clearTimeout(gmWakeT); gmWakeT = setTimeout(gmLoad, 1200); }
function renderGm() {
  const box = $('gmRooms'); box.hidden = !gm; if (!gm) return; const list = gmRooms || [];
  $('gmNote').textContent = !onlineOk ? 'Online belum siap' : gmErr ? gmErr : gmRooms === null ? 'Memuat…' : list.length ? list.length + ' room' : 'Belum ada room';
  $('gmList').innerHTML = list.map(r => { const code = esc(r.code), playing = r.status === 'playing'; return '<li><b class="code">' + code + '</b><span class="gm-meta"><span class="badge' + (r.visibility === 'private' ? ' priv">privat' : '">publik') + '</span> <span class="badge">' + (playing ? 'balapan' : 'lobby') + '</span> <small class="muted">' + (Number(r.seated) || 0) + '/' + (Number(r.maxPlayers) || 0) + '</small></span>' + (playing ? '' : '<button class="btn small green online-btn" data-gm="join" data-code="' + code + '">Masuk</button>') + '<button class="btn small ghost online-btn" data-gm="watch" data-code="' + code + '">Tonton</button></li>'; }).join('');
}
async function gmEnter(kind, code) { if (!/^[A-Z2-9]{6}$/.test(code || '')) return; $('codeInput').value = code; if (kind === 'join') return onlineAction('join'); const name = myName(); if (!name) { toast('Isi nama pembalap dulu', 'warn'); return; } try { await enterOnline('watch', { displayName: name, code }); } catch (e) { toast(errMsg(e), 'warn'); } }
function invite() { if (!room) return; const url = location.origin + location.pathname + '?room=' + room.code, done = () => toast('Link undangan disalin', 'good'); if (navigator.share && /Mobi|Android/i.test(navigator.userAgent)) navigator.share({ title: 'Drag 201', text: 'Adu drag 201 m sama aku di Drag 201 · room ' + room.code, url }).catch(() => {}); else if (navigator.clipboard) navigator.clipboard.writeText(url).then(done, () => toast(url, '', 6000)); else toast(url, '', 6000); }

/* ---------- boot ---------- */
async function boot() {
  $('nameInput').value = getLS(NAME_KEY) || ''; $('nameInput').addEventListener('change', () => { setLS(NAME_KEY, myName()); paintLb(); });
  paintMute(); paintHome(); hero(); root.addEventListener('resize', () => { if (!$('race').hidden) fit(); });
  const mute = () => { muted = !muted; setLS(MUTE_KEY, muted ? '1' : '0'); paintMute(); if (muted) engine(false); else { ac(); SFX.click(); if (race && !race.done) engine(true); } };
  $('muteBtn').addEventListener('click', mute); $('muteBtn2').addEventListener('click', mute);
  const nm = () => setLS(NAME_KEY, myName());
  $('careerBtn').addEventListener('click', () => { ac(); nm(); paintCareer(); show('career'); });
  $('ladder').addEventListener('click', e => { const b = e.target.closest('[data-rv]'); if (b) { ac(); startCareer(+b.dataset.rv); } });
  $('quickBtn').addEventListener('click', () => { ac(); nm(); startQuick(); });
  $('sunBtn').addEventListener('click', () => { ac(); nm(); startQuick(true); });
  $('taBtn').addEventListener('click', () => { ac(); nm(); startTA(); });
  $('tutBtn').addEventListener('click', () => { ac(); nm(); startTut(); });
  $('duelBtn').addEventListener('click', () => { ac(); nm(); duelScore = [0, 0]; startDuel(); });
  $('garageBtn').addEventListener('click', () => { gIdx = Math.max(0, D.BIKES.findIndex(b => b.id === save.cur)); paintGarage(); show('garage'); });
  $('resGarage').addEventListener('click', () => { race = null; gIdx = Math.max(0, D.BIKES.findIndex(b => b.id === save.cur)); paintGarage(); show('garage'); });
  $('bikePrev').addEventListener('click', () => { gIdx = (gIdx + D.BIKES.length - 1) % D.BIKES.length; paintGarage(); });
  $('bikeNext').addEventListener('click', () => { gIdx = (gIdx + 1) % D.BIKES.length; paintGarage(); });
  $('gUse').addEventListener('click', garageUse); $('parts').addEventListener('click', e => { const b = e.target.closest('[data-part]'); if (b) buyPart(b.dataset.part); });
  $('livery').addEventListener('click', e => { const b = e.target.closest('[data-paint]'); if (b && !b.disabled) { const [k, i] = b.dataset.paint.split(',').map(Number); buyPaint(k, i); } });
  doc.querySelectorAll('[data-back]').forEach(b => b.addEventListener('click', () => { if (room) { renderRoom(); show('lobby'); } else show('home'); }));
  $('againBtn').addEventListener('click', again); $('nextBtn').addEventListener('click', () => { ac(); startCareer(save.car); });
  $('dqAgain').addEventListener('click', () => { ac(); dqHide(); again(); }); $('dqMenu').addEventListener('click', () => exitToMenu(false));
  $('resMenu').addEventListener('click', () => exitToMenu(false)); $('toLobbyBtn').addEventListener('click', toLobby);
  $('taForm').addEventListener('submit', e => { e.preventDefault(); submitTA(); });
  $('exitBtn').addEventListener('click', confirmExit);
  $('matchBtn').addEventListener('click', () => { ac(); onlineAction('match'); }); $('createPub').addEventListener('click', () => { ac(); onlineAction('public'); }); $('createPriv').addEventListener('click', () => { ac(); onlineAction('private'); });
  $('joinForm').addEventListener('submit', e => { e.preventDefault(); ac(); onlineAction('join'); });
  $('codeInput').addEventListener('input', e => { e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''); });
  $('inviteBtn').addEventListener('click', invite); $('lobbyLeave').addEventListener('click', () => exitToMenu(false)); $('startBtn').addEventListener('click', () => { ac(); startOnline(); });
  $('onBots').addEventListener('click', e => { const b = e.target.closest('button'); if (b) setBots(+b.dataset.v); });
  $('quickChat').innerHTML = QUICK.map(q => '<button type="button">' + esc(q) + '</button>').join(''); $('quickChat').addEventListener('click', e => { const b = e.target.closest('button'); if (b) sendChat(b.textContent); });
  $('chatForm').addEventListener('submit', e => { e.preventDefault(); const i = $('chatInput'); Promise.resolve(sendChat(i.value)).then(ok => { if (ok) i.value = ''; }); if (!$('race').hidden) { i.blur(); $('raceChatSlot').hidden = true; $('chatCard').appendChild($('chat')); } });
  $('chatBtn').addEventListener('click', () => { const d = $('raceChatSlot'); d.hidden = !d.hidden; if (!d.hidden) d.appendChild($('chat')); else $('chatCard').appendChild($('chat')); });
  root.addEventListener('pagehide', () => { if (room) conn.leaveBeacon(); });
  doc.addEventListener('visibilitychange', () => { if (doc.visibilityState === 'visible' && conn.config) conn.visible(); });
  $('gmRefresh').addEventListener('click', gmLoad); $('gmList').addEventListener('click', e => { const b = e.target.closest('[data-gm]'); if (b) gmEnter(b.dataset.gm, b.dataset.code); });
  root.addEventListener('hashchange', gmSync); setInterval(() => { if (gm && !room && doc.visibilityState === 'visible' && Date.now() - gmAt > 10000) gmLoad(); }, 2000);
  gmSync(); gmUI = gmClaimUI({ canClaim: () => mode === 'online' && !!room && !!room.data && !room.local && !room.isGamemaster(), claim: code => room.claimGamemaster(code), onDone: () => { toast('Mode gamemaster aktif', 'good'); gmMeSync(); if (room) renderRoom(); } });
  root.requestAnimationFrame(frame);
  const route = () => { const h = (location.hash || '').toLowerCase(); if (room) return; if (h === '#latihan') startTut(); else if (h === '#demo') startDemo(); else if (h === '#duel') startDuel(); };
  route(); root.addEventListener('hashchange', route);
  loadLb();
  doc.querySelectorAll('.online-btn').forEach(b => { b.disabled = true; });
  if (conn.allowed) { try { await conn.start(); onlineOk = true; } catch (e) { conn.failed = true; onlineOk = false; } }
  doc.querySelectorAll('.online-btn').forEach(b => { b.disabled = !onlineOk; });
  const note = $('onlineNote'), msg = !conn.allowed ? 'Mode online hanya di drag201.jadidaring.com.' : conn.failed ? 'Server online sedang tidak bisa dihubungi. Mode solo tetap jalan.' : ''; note.textContent = msg; note.hidden = !msg;
  if (gm) gmLoad();
  if (conn.code && conn.token) { try { await conn.leave(); } catch (e) { conn.forget(); } }
  const JR = root.JRInvite, invCode = JR && JR.code ? JR.code('room') : '';
  if (invCode && JR.run) {
    JR.run({ code: invCode, lang: 'id', gameName: 'Drag 201', nameMax: 16, accent: '#ffd23f',
      check: async code => { if (!conn.allowed) return 'offline'; if (!onlineOk) return { fallback: 'Server online sedang tidak bisa dihubungi.' }; return conn.probe(code); },
      join: async name => {
        $('nameInput').value = name; setLS(NAME_KEY, myName()); ac();
        try { await enterOnline('join', { displayName: myName() || name, code: invCode }); return { ok: true }; }
        catch (e) { if (e.status === 409) { try { await enterOnline('watch', { displayName: name, code: invCode }); toast('Room penuh, kamu menonton', 'warn', 4000); return { ok: true }; } catch (e2) { /* fall through */ } } if (e.status === 404 || e.status === 422) return { ok: false, missing: true }; return { ok: false, retry: true, message: errMsg(e) }; }
      }, fallback: () => {} });
  }
}
if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', boot); else boot();
root.D201App = { get race() { return race; }, get room() { return room; }, get mode() { return mode; }, get me() { return me; }, get save() { return save; }, persist, startCareer, startQuick, startTA, startTut, startDemo, startDuel, startOnline, operTap, nosTap, setGas: v => { gasHeld = !!v; }, sendChat, conn };
})(window);

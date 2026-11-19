/* Tamiya Lintasan app: screens, garage, solo races vs bots, time attack, tutorial, demo, online 2–4 (+bots) via /api/game + Reverb,
   chat sorak-sorai with bubbles over cars, GM tools (#gamemaster / ?gmjd claim, #gamemaster lobby list), invite links. */
(function (root) {
'use strict';
const T = root.TL, R = root.TLR, N = root.MPNet, doc = document, $ = id => doc.getElementById(id);
const NAME_KEY = 'tamiyalintasan.name', SAVE_KEY = 'tamiyalintasan.save', MUTE_KEY = 'tamiyalintasan.mute';
const getLS = k => { try { return root.localStorage.getItem(k); } catch (e) { return null; } }, setLS = (k, v) => { try { root.localStorage.setItem(k, v); } catch (e) { /* private mode */ } };
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = ms => ms == null ? '–' : (ms / 1000).toFixed(2);
const PAL = ['#2f7de1', '#e23b3b', '#f5b301', '#19a974', '#8f3bd6', '#ff8a1f', '#ec4f9a'];
let save = { cfg: { ch: 'kilat', din: 'atomik', rol: 'bearing', ban: 'slick' }, track: 'datar', best: {}, tut: 0, races: 0, wins: 0 };
try { const s = JSON.parse(getLS(SAVE_KEY) || 'null'); if (s && typeof s === 'object') save = Object.assign(save, s, { cfg: Object.assign({}, save.cfg, s.cfg || {}) }); } catch (e) { /* fresh */ }
function persist() { setLS(SAVE_KEY, JSON.stringify(save)); }
let muted = getLS(MUTE_KEY) === '1', mode = null, race = null, room = null, me = 0, lastRoute = '';
const myName = () => ($('nameInput').value || '').replace(/\s+/g, ' ').trim().slice(0, 16);
function toast(msg, kind, ms) { for (const o of $('toasts').children) if (o.textContent === msg) o.remove(); const t = doc.createElement('div'); t.className = 'toast ' + (kind || ''); t.textContent = msg; $('toasts').appendChild(t); setTimeout(() => t.remove(), ms || 2200); while ($('toasts').children.length > 3) $('toasts').firstChild.remove(); }
function show(id) { for (const s of doc.querySelectorAll('.screen')) s.hidden = s.id !== id && !(id === 'result' && s.id === 'race'); doc.documentElement.classList.toggle('jr-hub-off', id !== 'home'); if (id === 'home') paintHome(); }
/* ---------- sound ---------- */
let AC = null, motor = null;
function ac() { if (muted) return null; try { if (!AC) AC = new (root.AudioContext || root.webkitAudioContext)(); if (AC.state === 'suspended') AC.resume(); } catch (e) { AC = null; } return AC; }
function tone(f, d, type, vol, f2, delay) { const a = ac(); if (!a) return; const t = a.currentTime + (delay || 0), o = a.createOscillator(), g = a.createGain(); o.type = type || 'square'; o.frequency.setValueAtTime(f, t); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + d); g.gain.setValueAtTime(vol || 0.06, t); g.gain.exponentialRampToValueAtTime(0.0001, t + d); o.connect(g).connect(a.destination); o.start(t); o.stop(t + d + 0.02); }
function noise(d, vol, hp) { const a = ac(); if (!a) return; const b = a.createBuffer(1, Math.max(1, a.sampleRate * d), a.sampleRate), ch = b.getChannelData(0); for (let i = 0; i < ch.length; i++) ch[i] = (Math.random() * 2 - 1) * (1 - i / ch.length); const s = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain(); f.type = 'highpass'; f.frequency.value = hp || 800; g.gain.value = vol || 0.12; s.buffer = b; s.connect(f).connect(g).connect(a.destination); s.start(); }
const SFX = {
  click: () => tone(660, 0.05, 'square', 0.04), light: () => tone(440, 0.18, 'square', 0.06), go: () => tone(880, 0.35, 'square', 0.07),
  perfect: () => { tone(988, 0.08, 'triangle', 0.08); tone(1318, 0.14, 'triangle', 0.08, 0, 0.07); }, ok: () => tone(740, 0.09, 'triangle', 0.06),
  bump: () => { noise(0.18, 0.2, 500); tone(180, 0.2, 'sawtooth', 0.06, 70); }, co: () => { noise(0.5, 0.22, 300); tone(520, 0.6, 'sawtooth', 0.06, 90); },
  fin: () => [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.16, 'square', 0.06, 0, i * 0.1)), lose: () => [392, 330, 262].forEach((f, i) => tone(f, 0.2, 'triangle', 0.06, 0, i * 0.14)),
  chat: () => tone(1200, 0.05, 'sine', 0.05), foul: () => tone(200, 0.4, 'square', 0.07, 120), cheer: () => noise(0.35, 0.08, 1800),
};
function motorOn(on) {
  const a = on ? ac() : AC; if (!a) return;
  if (on && !motor) { const o = a.createOscillator(), o2 = a.createOscillator(), f = a.createBiquadFilter(), g = a.createGain(); o.type = 'sawtooth'; o2.type = 'square'; f.type = 'lowpass'; f.frequency.value = 1400; g.gain.value = 0; o.connect(f); o2.connect(f); f.connect(g).connect(a.destination); o.start(); o2.start(); motor = { o, o2, g }; }
  if (!on && motor) { const m = motor; motor = null; try { m.g.gain.setTargetAtTime(0, a.currentTime, 0.05); setTimeout(() => { try { m.o.stop(); m.o2.stop(); } catch (e) { /* stopped */ } }, 300); } catch (e) { /* closed */ } }
}
function motorSet(v, on) { if (!motor || !AC) return; const t = AC.currentTime, f = 160 + v * 52; motor.o.frequency.setTargetAtTime(f, t, 0.05); motor.o2.frequency.setTargetAtTime(f * 1.5, t, 0.05); motor.g.gain.setTargetAtTime(on ? 0.018 + v * 0.0016 : 0, t, 0.08); }
function paintMute() { for (const id of ['muteBtn', 'muteBtn2']) { $(id).textContent = muted ? '🔇' : '🔊'; $(id).setAttribute('aria-pressed', muted ? 'true' : 'false'); } }
function toggleMute() { muted = !muted; setLS(MUTE_KEY, muted ? '1' : '0'); paintMute(); if (muted) motorOn(false); else { SFX.click(); if (race && !race.done && !race.demo) motorOn(true); } }
const buzz = ms => { try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) { /* no */ } };
/* ---------- home ---------- */
const ch = id => T.byId(T.CHASSIS, id), partName = (L, id) => T.byId(L, id).n.split(' ').slice(1).join(' ');
const TIPS = { datar: 'Tips: lintasan datar → ban slick / low-friction + dinamo kencang.', gelombang: 'Tips: gelombang → ban spons biar nggak loncat-loncat.', tanjakan: 'Tips: tanjakan → dinamo torsi atau ban spons kuat nanjak.' };
function paintTracks(box, cur, onPick) { box.innerHTML = T.TRACKS.map(t => '<button class="trk' + (t.id === cur ? ' on' : '') + '" role="radio" aria-checked="' + (t.id === cur) + '" data-tr="' + t.id + '"><i>' + t.e + '</i>' + esc(t.n.replace('Sirkuit ', '')) + '</button>').join(''); box.onclick = e => { const b = e.target.closest('[data-tr]'); if (b) onPick(b.dataset.tr); }; }
function paintHome() {
  const c = save.cfg, k = ch(c.ch);
  $('stripName').textContent = k.n; $('stripSet').textContent = partName(T.DINAMO, c.din) + ' · ' + partName(T.ROLLER, c.rol) + ' · ' + partName(T.BAN, c.ban);
  R.preview($('stripCv').getContext('2d'), 96, 64, 1, carLook(c), 900);
  paintTracks($('trackPick'), save.track, id => { save.track = id; persist(); SFX.click(); paintHome(); });
  const tr = T.trackOf(save.track); $('trackTip').textContent = tr.sub + ' ' + (TIPS[tr.id] || '');
  const b = save.best[save.track]; $('taSub').textContent = b ? 'Rekor ' + fmt(b.ms) + ' dtk · ' + tr.n.replace('Sirkuit ', '') : 'Kejar rekor 3 lap';
  $('lbList').innerHTML = T.TRACKS.map(t => { const x = save.best[t.id]; return '<li>' + t.e + ' <b>' + esc(t.n) + '</b>: ' + (x ? fmt(x.ms) + ' dtk <small class="muted">(' + esc(partName(T.DINAMO, x.cfg.din) + ' · ' + partName(T.ROLLER, x.cfg.rol) + ' · ' + partName(T.BAN, x.cfg.ban)) + ')</small>' : '<span class="muted">belum ada</span>') + '</li>'; }).join('');
}
const carLook = (c, i) => { const k = ch(c.ch); return { ch: k.id, col: k.col, col2: k.col2, rol: c.rol, num: i == null ? '7' : String(i + 1) }; };
function hero() {
  const c = $('heroCv'), g = c.getContext('2d'); let hr = null;
  const mk = () => { hr = { t0: performance.now() - 1500, lanes: T.BOTS.slice(0, 3).concat([T.BOTS[6]]).map((b, i) => ({ run: new T.Run(T.spec(b.cfg), 'datar', { laps: 99 }), br: T.botBrain(b.skill, (Math.random() * 1e9) | 0), look: carLook(b.cfg, i), L0: i % 3, name: b.n.split(' ')[0] })) }; };
  const loop = now => {
    root.requestAnimationFrame(loop); if ($('home').hidden || doc.visibilityState !== 'visible') return; if (!hr || now - hr.t0 > 60000) mk();
    const W = c.clientWidth || 360, H = c.clientHeight || 300, r = Math.min(2, root.devicePixelRatio || 1); if (c.width !== Math.round(W * r)) { c.width = Math.round(W * r); c.height = Math.round(H * r); }
    const tt = now - hr.t0; for (const l of hr.lanes) while (l.run.t + 1000 * T.DT <= tt) { T.driveBot(l.run, l.br); l.run.step(T.DT); }
    R.scene(g, { W, H, r, top: 44, bottom: 96, pad: 4, track: T.trackOf('datar'), now, cars: hr.lanes.map((l, i) => Object.assign({ s: l.run.s, L0: l.L0, v: l.run.v, coLeft: l.run.co, coAt: l.run.coAt, lane4: i === 3 ? 0.3 : 0, name: l.name }, l.look)), tags: false });
  };
  root.requestAnimationFrame(loop);
}
const lobbyBub = {}; let lobbyAt = 0;
/* lobby: the room's track with every racer's car parked on the start grid (chat bubbles pop over their car) */
function lobbyLoop(now) {
  root.requestAnimationFrame(lobbyLoop); const r = room; if ($('lobby').hidden || !r || !r.data || doc.visibilityState !== 'visible' || now - lobbyAt < 45) return; lobbyAt = now;
  const c = $('lobbyCv'), W = c.clientWidth || 340, H = c.clientHeight || 178, k = Math.min(2, root.devicePixelRatio || 1); if (c.width !== Math.round(W * k)) { c.width = Math.round(W * k); c.height = Math.round(H * k); }
  const s = r.s, ps = r.seated(), bk = Array.isArray(s.bk) ? s.bk : [], want = Math.max(0, Math.min(3, (s.set && s.set.bots) | 0)), nb = Math.max(ps.length < 2 ? 1 : 0, Math.min(want, 4 - ps.length));
  const seats = ps.map(p => { const b = bk.find(x => Array.isArray(x) && x[0] === p.id); return { id: p.id, name: p.id === r.me ? '' : p.displayName, cfg: b ? cfgOf(b) : null, me: p.id === r.me }; });
  for (let i = 0; i < nb; i++) seats.push({ id: -9 - i, name: 'Bot ' + (i + 1), cfg: T.BOTS[(i * 2 + 1) % T.BOTS.length].cfg });
  R.grid(c.getContext('2d'), W, H, k, seats.map((x, i) => { const bb = lobbyBub[x.id]; return Object.assign({ me: x.me, name: x.name, bubble: bb && bb.t > now ? bb.x : '' }, carLook(x.cfg || T.BOTS[i % T.BOTS.length].cfg, i)); }), now);
}
function garageLoop(now) { root.requestAnimationFrame(garageLoop); root.requestAnimationFrame(lobbyLoop); if ($('garage').hidden) return; const c = $('garageCv'), W = c.clientWidth || 360, H = c.clientHeight || 200, r = Math.min(2, root.devicePixelRatio || 1); if (c.width !== Math.round(W * r)) { c.width = Math.round(W * r); c.height = Math.round(H * r); } R.preview(c.getContext('2d'), W, H, r, carLook(save.cfg), now); }
/* ---------- garage ---------- */
let garageAfter = null;
function openGarage(after) { garageAfter = after || null; $('gRace').textContent = after === 'lobby' ? '✓ Pakai di room' : '🏁 Balapan!'; paintGarage(); show('garage'); }
function paintGarage() {
  const c = save.cfg, tr = T.trackOf(save.track);
  $('gTrack').textContent = tr.e + ' ' + tr.n.replace('Sirkuit ', '');
  $('chassisPick').innerHTML = T.CHASSIS.map(k => '<button class="chs' + (k.id === c.ch ? ' on' : '') + '" role="radio" aria-checked="' + (k.id === c.ch) + '" data-ch="' + k.id + '"><i style="background:' + k.col + ';border-color:' + k.col2 + '"></i>' + esc(k.n) + '</button>').join('');
  const row = (key, title, sub, L) => '<div class="part"><h3>' + title + ' <small>' + sub + '</small></h3><div class="opts n' + L.length + '">' + L.map(o => '<button class="opt' + (o.id === c[key] ? ' on' : '') + '" data-k="' + key + '" data-v="' + o.id + '" aria-pressed="' + (o.id === c[key]) + '">' + o.e + ' ' + esc(o.n.split(' ').slice(1).join(' ')) + '<small>' + esc(o.sub) + '</small></button>').join('') + '</div></div>';
  $('parts').innerHTML = row('din', 'Dinamo', 'kecepatan vs torsi', T.DINAMO) + row('rol', 'Roller', 'cengkeram dinding = lebar jendela tikungan', T.ROLLER) + row('ban', 'Ban', 'cocokkan dengan lintasan', T.BAN);
  const st = T.stats(c, tr.id), bar = (n, v) => '<div class="stat"><span>' + n + '</span><s><i style="width:' + Math.round(Math.max(0.06, Math.min(1, v)) * 100) + '%"></i></s></div>';
  $('gStats').innerHTML = bar('Top speed', st.top) + bar('Akselerasi', st.acc) + bar('Jendela tikung', st.win) + bar('Stabil (anti CO)', st.stab);
  $('gIdeal').textContent = 'Waktu ideal (semua tikungan PAS) di ' + tr.n + ': ' + fmt(st.ideal) + ' dtk';
  $('gTip').textContent = TIPS[tr.id];
}
/* ---------- race core ---------- */
const BOT_LINES = { M: ['Aduh terpental!', 'Waduh rollerku!', 'Hampir aja…', 'Yah, telat!'], CO: ['TERBANG! 😱', 'Course out!!', 'Mobilku kemana?!'], P: ['Pas banget!', 'Wuuush!', 'Gas terus!'], fin: ['GG!', 'Mantap!', 'Rematch?'] };
const CHEERS = ['🔥 Gas!', '👏 Mantap', '😱 Terbang!', '🏁 GG', '😂 Wkwk', '💪 Ayo!'];
function mkLane(o) { return Object.assign({ wob: 0, bubble: '', bubbleT: 0, evi: 0, ds: 0, prog: null, finRow: null, mSeen: 0 }, o); }
function startRace(o) {
  motorOn(false);
  const clock = o.clock || (() => performance.now()), laps = o.laps || T.LAPS, t0 = o.t0 != null ? o.t0 : clock() + 3300;
  race = { kind: o.kind, track: o.track, laps, clock, t0, lanes: [], done: false, g: o.g || null, fx: R.makeFx(), demo: o.kind === 'demo', spect: !!o.spect, shown: 0, coach: o.coach || null, pushSlot: -1 };
  const seats = o.seats || [{ me: true }].concat(o.rivals || []);
  const n = seats.length, used = new Set();
  seats.forEach((s, i) => {
    const cfg = s.me ? save.cfg : s.cfg, look = carLook(cfg, i); if (used.has(look.col)) { look.col = PAL.find(c => !used.has(c)) || look.col; } used.add(look.col);
    const ln = mkLane(Object.assign({ id: s.me ? me : s.id, name: s.me ? (myName() || 'Kamu') : s.name, cfg, me: !!s.me, remote: !!s.remote, L0: i % 3, lane4: n === 4 ? (i === 0 ? -0.28 : i === 3 ? 0.28 : 0) : 0, look }, s));
    if (!ln.remote) { ln.run = new T.Run(T.spec(cfg), o.track, { laps }); if (!s.me) ln.brain = T.botBrain(s.skill || 0.6, s.seed || ((Math.random() * 1e9) | 0)); }
    race.lanes.push(ln);
  });
  $('lights').className = 'lights'; $('lights').querySelectorAll('i').forEach(x => x.classList.remove('on'));
  $('cheer').hidden = race.demo; $('chatBtn').hidden = !(mode === 'online' && room); $('raceChatSlot').hidden = true; $('chatCard').appendChild($('chat'));
  $('coach').hidden = !race.coach; if (race.coach) $('coach').textContent = race.coach[0];
  $('tapBtn').hidden = race.demo || race.spect; $('tbar').hidden = race.demo || race.spect; $('callout').innerHTML = '';
  show('race'); if (!race.demo) motorOn(true);
  return race;
}
const myLane = () => race && race.lanes.find(l => l.me);
function laneWorld(ln) { const s = ln.me || !ln.remote ? ln.run.s : ln.ds, lo = T.laneOff(s, ln.L0); return T.pos(s, lo.off + ln.lane4); }
function callout(txt, col, sub) { const c = $('callout'); c.innerHTML = '<b style="color:' + (col || '#fff') + '">' + esc(txt) + '</b>' + (sub ? '<small>' + esc(sub) + '</small>' : ''); const b = c.firstChild; b.style.animation = 'none'; void b.offsetWidth; b.style.animation = ''; }
function bubble(ln, txt) { if (!ln) return; ln.bubble = String(txt).slice(0, 40); ln.bubbleT = performance.now() + 2800; }
function onEvent(ln, e) {
  const k = e[0], mine = ln.me && !race.demo, p = laneWorld(ln);
  if (k === 'P') { race.fx.add(p.x, p.y, { n: 8, c: '#ffd23f', sp: 3, life: 0.4, sz: 0.09 }); if (mine) { callout('PAS!', '#ffd23f'); SFX.perfect(); buzz(12); coachStep('p'); } else if (ln.brain && Math.random() < 0.08) bubble(ln, pick(BOT_LINES.P)); }
  else if (k === 'G') { if (mine) { callout('Oke', '#bff5cf'); SFX.ok(); coachStep('p'); } }
  else if (k === 'M') { ln.wob = 1; race.fx.add(p.x, p.y, { n: 16, c: '#ffb020', sp: 6, life: 0.45 }); if (mine) { callout('TERPENTAL!', '#ff5a4a', 'ketuk pas di zona emas'); SFX.bump(); buzz(60); coachStep('m'); } else if (ln.brain && Math.random() < 0.4) bubble(ln, pick(BOT_LINES.M)); }
  else if (k === 'CO') { race.fx.add(p.x, p.y, { n: 26, c: '#ff5a4a', sp: 8, life: 0.6 }); if (mine) { callout('COURSE OUT!', '#ff5a4a', 'terlalu kencang & meleset'); SFX.co(); buzz([80, 40, 80]); coachStep('m'); } else if (ln.brain && Math.random() < 0.6) bubble(ln, pick(BOT_LINES.CO)); }
  else if (k === 'early' && mine) { callout('Kecepetan!', '#ffb4a8'); }
  else if (k === 'jet' && mine) { callout('START KILAT!', '#7dffa8'); SFX.go(); coachStep('go'); }
  else if (k === 'go' && mine) { coachStep('go'); }
  else if (k === 'late' && mine) { callout('Telat ON', '#ffd9a0'); coachStep('go'); }
  else if (k === 'foul' && mine) { callout('CURI START!', '#ff5a4a', '+1 detik'); SFX.foul(); buzz(100); }
  else if (k === 'fin') { race.fx.add(p.x, p.y, { n: 30, conf: true, c: ln.look.col, sp: 5, life: 1.2, sz: 0.16 }); if (mine) { SFX.fin(); motorOn(false); } else if (ln.brain && Math.random() < 0.5) bubble(ln, pick(BOT_LINES.fin)); }
}
const pick = L => L[(Math.random() * L.length) | 0];
function coachStep(kind) {
  if (!race || !race.coach) return; const C = $('coach');
  if (kind === 'go' && race.coachAt < 1) { race.coachAt = 1; C.textContent = race.coach[1]; }
  else if (kind === 'p' && race.coachAt < 2) { race.coachAt = 2; C.textContent = race.coach[2]; }
  else if (kind === 'm' && race.coachAt < 3) { C.textContent = race.coach[3]; }
}
function doTap() {
  if (!race || race.done || race.demo || race.spect) return; const L = myLane(); if (!L || !L.run) return;
  const tt = race.clock() - race.t0; if (tt < -3200) return;
  const b = $('tapBtn'); b.classList.add('down'); setTimeout(() => b.classList.remove('down'), 90);
  ac(); stepLocal(tt); const v = L.run.press(); if (v === 'go') SFX.go();
  pumpEvents();
}
function stepLocal(tt) {
  for (const ln of race.lanes) { if (ln.remote) continue; const r = ln.run; let n = 0; while (r.t + 1000 * T.DT <= tt && n++ < 4000) { if (ln.brain) T.driveBot(r, ln.brain); r.step(T.DT); } }
}
function pumpEvents() { for (const ln of race.lanes) { if (ln.remote) continue; const ev = ln.run.ev; while (ln.evi < ev.length) onEvent(ln, ev[ln.evi++]); } }
function remoteStep(ln, tt) {
  const p = ln.prog; if (!p) { ln.ds = 0; return; }
  if (ln.finRow) { ln.ds += (Math.max(ln.ds, race.laps * T.LAP) - ln.ds) * 0.2; ln.coLeft = 0; return; }
  const dt = Math.max(0, tt - p.t) / 1000; ln.coLeft = p.co > 0 ? Math.max(0, p.co - (tt - p.t)) : 0; ln.coAt = p.ca;
  const est = ln.coLeft > 0 ? p.s : Math.min(p.s + p.v * Math.min(dt, 1.2), race.laps * T.LAP);
  ln.ds = ln.ds > est + 3 ? est : ln.ds + (est - ln.ds) * 0.25; ln.v = p.v;
  if ((p.m | 0) > ln.mSeen) { ln.mSeen = p.m | 0; ln.wob = 1; const w = laneWorld(ln); race.fx.add(w.x, w.y, { n: 12, c: '#ffb020', sp: 6, life: 0.4 }); }
}
function standings() {
  return race.lanes.map(l => { const run = l.run, fin = run ? run.fin : (l.finRow ? l.finRow.tot || 1e9 : null), s = run ? run.s : l.ds; return { l, fin, s }; })
    .sort((a, b) => (a.fin == null) - (b.fin == null) || (a.fin != null ? a.fin - b.fin : b.s - a.s));
}
let lastHud = '';
function hud(tt) {
  const L = myLane(), st = standings(), n = race.lanes.length, laps = race.laps;
  const lights = $('lights'), li = lights.querySelectorAll('i');
  if (tt < 0) { const k = tt < -3000 ? 0 : tt < -2000 ? 1 : tt < -1000 ? 2 : 3; li.forEach((x, i) => x.classList.toggle('on', i < k && i < 3)); if (race.lightK !== k) { race.lightK = k; if (k > 0 && !race.demo) SFX.light(); } }
  else { li.forEach((x, i) => x.classList.toggle('on', i === 3)); if (race.lightK !== 9) { race.lightK = 9; if (!race.demo) { SFX.go(); if (!L || L.run.on === null) callout('HIJAU!', '#7dffa8', 'ketuk ON'); } } if (tt > 2200) lights.classList.add('off'); }
  const ref = L || st[0].l, s = ref.run ? ref.run.s : ref.ds, lap = Math.min(laps, Math.floor(s / T.LAP) + 1), pos = st.findIndex(x => x.l === ref) + 1;
  const time = ref.run && ref.run.fin != null ? ref.run.fin : Math.max(0, tt);
  const h = 'Lap ' + lap + '/' + laps + '|P' + pos + '/' + n + '|' + fmt(time);
  if (h !== lastHud) { lastHud = h; const [a, b, c] = h.split('|'); $('hudLap').textContent = a; $('hudPos').textContent = b; $('hudTime').textContent = c; }
  if (!L || race.demo || race.spect) return;
  const run = L.run, tb = $('tbar'), tap = $('tapBtn');
  $('tbSpd').textContent = T.kmh(run.v) + ' km/j';
  if (run.on === null) { $('tapLbl').textContent = 'ON'; $('tapSub').textContent = tt < 0 ? 'tunggu lampu hijau…' : 'KETUK SEKARANG!'; tap.classList.toggle('hot', tt >= 0); tap.classList.toggle('idle', tt < 0); $('tbZone').style.opacity = 0; $('tbNeedle').style.left = '0%'; $('tbLbl').textContent = 'Siap-siap'; tb.classList.remove('hot'); return; }
  tap.classList.remove('idle');
  if (run.fin !== null) { $('tapLbl').textContent = 'FINIS'; $('tapSub').textContent = fmt(run.fin) + ' dtk'; tap.classList.remove('hot'); tb.classList.remove('hot'); return; }
  if (run.co > 0) { $('tapLbl').textContent = 'TERBANG…'; $('tapSub').textContent = 'mobil dipasang lagi'; tap.classList.remove('hot'); tb.classList.remove('hot'); return; }
  if (run.ci >= run.nCorners()) { $('tapLbl').textContent = 'GAS!'; $('tapSub').textContent = 'lurus ke finis'; $('tbZone').style.opacity = 0; tap.classList.remove('hot'); tb.classList.remove('hot'); return; }
  const tg = run.target(run.ci), hw = run.sp.win / 2, a = tg - hw - 6, b = tg + hw + 1.2, span = b - a, x = Math.max(0, Math.min(1, (run.s - a) / span));
  $('tbZone').style.opacity = 1; $('tbZone').style.left = ((tg - hw - a) / span * 100) + '%'; $('tbZone').style.width = (2 * hw / span * 100) + '%';
  $('tbNeedle').style.left = (x * 100) + '%'; $('tbLbl').textContent = 'Tikungan ' + (run.ci % 4 + 1);
  const hot = run.s >= tg - hw - 1.2 && !run.pend; tap.classList.toggle('hot', hot); tb.classList.toggle('hot', hot);
  $('tapLbl').textContent = 'TIKUNG!'; $('tapSub').textContent = run.pend ? (run.pend === 'p' ? 'PAS!' : run.pend === 'g' ? 'oke' : 'kecepetan!') : hot ? 'ketuk di emas!' : 'tunggu jarum…';
}
let cvW = 0, cvH = 0;
function frame(now) {
  root.requestAnimationFrame(frame); if (!race || $('race').hidden) return;
  const tt = race.clock() - race.t0; stepLocal(tt); pumpEvents();
  for (const ln of race.lanes) { if (ln.remote) remoteStep(ln, tt); if (ln.wob > 0) ln.wob = Math.max(0, ln.wob - 0.03); if (ln.bubble && now > ln.bubbleT) ln.bubble = ''; }
  race.fx.step(1 / 60);
  const c = $('raceCv'), W = c.clientWidth || innerWidth, H = c.clientHeight || innerHeight, r = Math.min(2, root.devicePixelRatio || 1);
  if (W !== cvW || H !== cvH) { cvW = W; cvH = H; c.width = Math.round(W * r); c.height = Math.round(H * r); }
  const L = myLane(), hot = L && L.run && L.run.on !== null && L.run.ci < L.run.nCorners() ? L.run.ci % 4 : -1;
  const land = W > H && H <= 500, bottom = race.demo ? 10 : race.spect ? 60 : land ? 90 : (H < 620 ? 150 : 176);
  R.scene(c.getContext('2d'), { W, H, r, top: 58, bottom, track: T.trackOf(race.track), now, fx: race.fx, hot, halo: !race.demo, cars: race.lanes.map(ln => Object.assign({ s: ln.run ? ln.run.s : ln.ds, L0: ln.L0, lane4: ln.lane4, v: ln.run ? ln.run.v : ln.v || 0, coLeft: ln.run ? ln.run.co : ln.coLeft, coAt: ln.run ? ln.run.coAt : ln.coAt, wob: ln.wob, bump: ln.run && ln.run.bump, me: ln.me && !race.demo, name: ln.me && !race.demo ? '' : ln.name, bubble: ln.bubble }, ln.look)) });
  hud(tt);
  if (L && L.run && motor) motorSet(L.run.v, L.run.on !== null && L.run.fin === null && L.run.co <= 0);
  if (mode === 'online') onlineRace(tt);
  else if (!race.done) localCheck(tt);
}
/* ---------- solo modes ---------- */
function pickBots(n) { const pool = T.BOTS.slice(0, 6).sort((a, b) => a.skill - b.skill), lvl = Math.min(3, Math.floor((save.wins || 0) / 2)), out = pool.slice(lvl, lvl + n); if ((save.wins || 0) >= 6) out[out.length - 1] = T.BOTS[6]; return out.map(b => ({ id: -1, name: b.n, cfg: b.cfg, skill: b.skill, seed: (Math.random() * 1e9) | 0 })); }
function startLatihan() { mode = 'solo'; startRace({ kind: 'latihan', track: save.track, rivals: pickBots(3).map((b, i) => Object.assign(b, { id: -1 - i })) }); }
function startTA() { mode = 'solo'; startRace({ kind: 'ta', track: save.track, rivals: [] }); }
function startTut() { mode = 'solo'; const r = startRace({ kind: 'tut', track: 'datar', laps: 1, rivals: [{ id: -1, name: 'Ucup', cfg: T.BOTS[0].cfg, skill: 0.3, seed: 7 }], coach: ['🚦 Tunggu lampu HIJAU, lalu ketuk tombol ON.', '👀 Lihat bar bawah. Saat jarum masuk zona EMAS, ketuk TIKUNG!', '✅ Mantap! Ulangi di tiap tikungan (ada 4 per lap).', '💥 Terpental = telat/kecepetan. Ketuk pas jarum di emas.'] }); r.coachAt = 0; }
function startDemo() { mode = 'demo'; const bots = [T.BOTS[1], T.BOTS[2], T.BOTS[3], T.BOTS[6]]; startRace({ kind: 'demo', track: 'datar', laps: 9, t0: performance.now() - 7400, seats: bots.map((b, i) => ({ id: -1 - i, name: b.n.split(' ')[0], cfg: b.cfg, skill: b.skill, seed: 11 + i })) }); }
function localCheck(tt) {
  const L = myLane(); if (race.demo) { if (race.lanes.every(l => l.run.fin !== null)) startDemo(); return; }
  if (!L || L.run.fin === null) { if (tt > 90000) finishLocal(); return; }
  if (!race.finAt) race.finAt = tt; if (tt - race.finAt > 1500) finishLocal();
}
function finishLocal() {
  race.done = true; motorOn(false);
  for (const ln of race.lanes) { const r = ln.run; let n = 0; while (r.fin === null && r.t < 120000 && n++ < 9000) { if (ln.brain) T.driveBot(r, ln.brain); r.step(T.DT); } }
  const rows = race.lanes.map(ln => Object.assign(rowOf(ln.run), { id: ln.id, name: ln.name, me: ln.me, bot: !!ln.brain })).sort(T.rank);
  const mine = rows.find(x => x.me), pos = rows.indexOf(mine) + 1;
  let title = pos === 1 ? 'Juara 1! 🏆' : 'Posisi ' + pos, sub = '', note = '';
  if (race.kind === 'ta') { const b = save.best[race.track]; title = 'Time Attack'; if (mine.tot != null && (!b || mine.tot < b.ms)) { save.best[race.track] = { ms: mine.tot, cfg: Object.assign({}, save.cfg) }; note = '🎉 Rekor baru ' + T.trackOf(race.track).n + '!'; SFX.fin(); } else note = b ? 'Rekor kamu: ' + fmt(b.ms) + ' dtk' : ''; }
  else if (race.kind === 'tut') { save.tut = 1; title = 'Tutorial selesai!'; sub = 'Sekarang coba Latihan vs 3 bot atau mabar online.'; }
  else { save.races++; if (pos === 1) save.wins++; sub = pos === 1 ? 'Kamu tercepat di lintasan!' : 'Juara: ' + rows[0].name; if (pos !== 1) SFX.lose(); note = mine.cnt.co ? 'Tips: course out = mobil terlalu kencang saat meleset. Coba roller karet / ban spons.' : mine.cnt.m > 2 ? 'Tips: lihat bar bawah, ketuk saat jarum di emas.' : mine.cnt.p >= 10 ? 'Tikungan rapi! Coba dinamo lebih kencang.' : ''; }
  persist(); showResult({ title, sub, rows, mine, note });
}
const rowOf = run => { const s = run.summary(); return { tot: s.tot, best: s.best, laps: s.laps, p: s.cnt.p, m: s.cnt.m + s.cnt.co, co: s.cnt.co, foul: s.foul, cnt: s.cnt }; };
function showResult(o) {
  $('resKick').textContent = race ? (T.trackOf(race.track).e + ' ' + T.trackOf(race.track).n).toUpperCase() : 'HASIL'; $('resTitle').textContent = o.title; $('resSub').textContent = o.sub || '';
  $('resRows').innerHTML = o.rows.map((x, i) => '<tr class="' + (x.me ? 'me' : '') + '"><td>' + (i === 0 && x.tot != null ? '🏆' : i + 1) + '</td><td>' + esc(x.name) + (x.bot ? ' 🤖' : '') + (x.me ? ' <span class="tag">kamu</span>' : '') + '</td><td>' + fmt(x.tot) + '</td><td>' + fmt(x.best) + '</td><td>' + (x.p | 0) + '</td><td>' + (x.m | 0) + '</td></tr>').join('');
  const m = o.mine; $('resLaps').textContent = m && m.laps && m.laps.length ? 'Lap kamu: ' + m.laps.map((t, i) => 'L' + (i + 1) + ' ' + fmt(t)).join(' · ') + (m.foul ? ' · curi start +1 dtk' : '') : '';
  $('resNote').textContent = o.note || '';
  const online = mode === 'online' && room; $('toLobbyBtn').hidden = !(online && (room.isHost() || room.isGamemaster())); $('againBtn').hidden = !!online; $('endWait').textContent = online && !room.isHost() ? 'Menunggu host kembali ke lobby…' : '';
  $('result').hidden = false; doc.documentElement.classList.add('jr-hub-off');
}
function again() { $('result').hidden = true; if (!race) return show('home'); const k = race.kind; if (k === 'ta') startTA(); else if (k === 'tut') startTut(); else startLatihan(); }
function exitToMenu(silent) {
  motorOn(false); $('result').hidden = true; race = null; const r = room; room = null; if (r) { r.leave(); } mode = null; gmMeSync(); show('home'); if (!silent) SFX.click();
  if (location.hash && /^#(latihan|demo)$/i.test(location.hash)) { lastRoute = ''; history.replaceState(null, '', location.pathname + location.search); }
}
/* =====================================================================
   ONLINE (2–4 racers, bots fill empty seats). Host writes {t0 server ms of green, tr, L seats, B bots}; every phone simulates its own
   car + the seeded bots, pushes progress ('p') in staggered slots and writes its finish row into state.f; host ends when all rows are in.
   ===================================================================== */
const conn = new N.Connection({ storage: root.sessionStorage, onWake: () => room && room.refresh(), lobbyWake: () => gmWake() });
let onlineOk = false, starting = false, endSending = false, seatSeen = null;
const sNow = () => conn.serverNow();
function makeRoom() { return new N.Room(conn, { onChange: onRoom }); }
function errMsg(e) { if (!e) return 'Koneksi bermasalah'; if (e.code === 'busy') return 'Server sibuk, coba ' + (e.wait || 10) + ' dtk lagi'; if (e.code === 'network') return 'Koneksi bermasalah'; if (e.status === 404 || e.status === 422) return 'Room tidak ditemukan'; return 'Gagal: ' + (e.server || e.message || ''); }
const carRow = () => { const c = save.cfg; return [me, c.ch, c.din, c.rol, c.ban]; };
async function carToRoom() { const r = room; if (!r || r.spectator || r.s.ph !== 'lobby') return; const row = carRow(); try { await r.edit('car', s => { const bk = Array.isArray(s.bk) ? s.bk.filter(x => Array.isArray(x) && x[0] !== me) : []; bk.push(row); s.bk = bk.slice(-12); }); } catch (e) { /* cosmetic */ } }
async function enterOnline(kind, opts) {
  if (room) { const old = room; room = null; old.leave(); }
  const r = makeRoom(); mode = 'online'; room = r; race = null; resetChat();
  try { await r.enter(kind, Object.assign({ set: { bots: 1, tr: save.track }, maxPlayers: 4 }, opts)); } catch (e) { if (room === r) { room = null; mode = null; } throw e; }
  me = r.me; if (r.s.ph === 'lobby') { renderRoom(); show('lobby'); } addChatLine({ k: 'sys-in' + Date.now(), t: 'sys', x: (myName() || 'Kamu') + ' masuk room' }); gmMeSync(); carToRoom(); return r;
}
async function onlineAction(kind) {
  const name = myName(); if (!name) { toast('Isi nama racer dulu', 'warn'); $('nameInput').focus(); return; }
  setLS(NAME_KEY, name); const code = $('codeInput').value.trim().toUpperCase();
  if (kind === 'join' && !/^[A-Z2-9]{6}$/.test(code)) { toast('Kode room 6 huruf/angka', 'warn'); return; }
  doc.querySelectorAll('.online-btn').forEach(b => { b.disabled = true; });
  try { await enterOnline(kind, { displayName: name, code }); }
  catch (e) { if (kind === 'join' && e.status === 409) { try { await enterOnline('watch', { displayName: name, code }); toast('Room penuh (maks 4), kamu menonton', 'warn', 4000); } catch (e2) { toast(errMsg(e2), 'warn', 4000); } } else toast(errMsg(e), 'warn', 4000); }
  finally { doc.querySelectorAll('.online-btn').forEach(b => { b.disabled = !onlineOk; }); }
}
function onRoom(r, data) {
  if (r !== room) return;
  if (!data) { toast('Room ditutup', 'warn'); exitToMenu(true); return; }
  me = r.me; const s = r.s; gmMeSync(); joinLeave(r.seated()); syncChat(s.cm);
  if (s.ph === 'play' && s.s && s.g) { if (!race || race.g !== s.g) beginOnlineRace(s); else readProgress(data.events, s); }
  else if (s.ph === 'end' && s.res) { if (race && race.g === s.g && !race.done) { readProgress(data.events, s); finishOnline(s); } else if ((!race || race.g !== s.g) && s.s) { beginOnlineRace(s); finishOnline(s); } }
  else { if (race) { race = null; motorOn(false); } $('result').hidden = true; renderRoom(); if ($('lobby').hidden && $('garage').hidden) show('lobby'); }
}
function joinLeave(ps) { const ids = new Map(ps.map(p => [p.id, p.displayName])); if (seatSeen) { for (const [id, n] of ids) if (!seatSeen.has(id) && id !== me) { addChatLine({ k: 'sj' + id + Date.now(), t: 'sys', x: n + ' masuk room' }); SFX.chat(); } for (const [id, n] of seatSeen) if (!ids.has(id)) addChatLine({ k: 'sl' + id + Date.now(), t: 'sys', x: n + ' keluar' }); } seatSeen = ids; }
const cfgOf = row => ({ ch: String(row[1] || 'kilat'), din: String(row[2] || 'atomik'), rol: String(row[3] || 'bearing'), ban: String(row[4] || 'slick') });
function beginOnlineRace(s) {
  const S = s.s, L = Array.isArray(S.L) ? S.L : [], B = Array.isArray(S.B) ? S.B : [], mineRow = L.find(x => x[0] === me), spect = !mineRow || (room && room.spectator);
  if (mineRow) { const c = cfgOf([0, mineRow[2], mineRow[3], mineRow[4], mineRow[5]]); save.cfg = Object.assign(save.cfg, c); }
  const seats = L.map(x => x[0] === me && !spect ? { me: true, id: me } : { id: x[0], name: String(x[1] || '?'), cfg: cfgOf([0, x[2], x[3], x[4], x[5]]), remote: true })
    .concat(B.map((b, i) => ({ id: -1 - i, name: String(b[0]), cfg: cfgOf([0, b[1], b[2], b[3], b[4]]), skill: +b[5] || 0.6, seed: b[6] | 0 })));
  startRace({ kind: 'online', track: S.tr || 'datar', seats, t0: Number(S.t0) || sNow() + 4000, clock: sNow, g: s.g, spect });
  pushBusy = false; lastPush = -1; race.hIdx = Math.max(0, L.findIndex(x => x[0] === me)); race.hN = Math.max(1, L.length);
  if (spect) toast('Kamu menonton balapan ini', '', 2400);
  readProgress(room.data.events, s);
}
function readProgress(events, s) {
  if (!race) return; const byId = new Map(race.lanes.filter(l => l.remote).map(l => [l.id, l]));
  for (const e of events || []) { if (e.type !== 'p' || !e.payload || e.payload.g !== s.g) continue; const ln = byId.get(e.playerId); if (!ln) continue; const p = e.payload; if (!ln.prog || p.t >= ln.prog.t) ln.prog = { s: +p.s || 0, v: +p.v || 0, t: +p.t || 0, co: +p.co || 0, ca: +p.ca || 0, m: p.m | 0 }; }
  for (const f of Array.isArray(s.f) ? s.f : []) { if (!Array.isArray(f)) continue; const ln = byId.get(f[0]); if (ln && !ln.finRow) ln.finRow = { tot: f[1], best: f[2], p: f[3], m: f[4] }; }
}
let pushBusy = false, lastPush = -1;
function onlineRace(tt) {
  const r = room; if (!r || !race) return; if (race.spect || race.done) { hostCheck(tt); return; } const L = myLane(); if (!L) return; const run = L.run;
  if (run.fin === null && tt > 70000) { run.fin = null; race.forced = true; }
  const done = run.fin !== null || race.forced;
  const slot = Math.floor((tt + 100000 - race.hIdx * 600 / race.hN) / 600);
  if (!done && !pushBusy && slot !== lastPush && tt > -1500) {
    pushBusy = true; lastPush = slot;
    r.push('p', { payload: { g: race.g, s: Math.round(run.s * 100) / 100, v: Math.round(run.v * 100) / 100, t: Math.round(run.t), co: Math.round(run.co), ca: Math.round((run.coAt || 0) * 100) / 100, m: run.cnt.m + run.cnt.co } }).catch(e => { if (e && e.status === 409) return r.settle(e.used).catch(() => {}); }).finally(() => { pushBusy = false; });
  }
  if (done && !race.finSent) { race.finSent = true; sendFin(run); }
  hostCheck(tt);
}
async function sendFin(run) {
  const r = room, g = race.g, x = rowOf(run), row = [me, x.tot, x.best, x.p, x.m];
  try { await r.edit('fin', st => { if (st.ph !== 'play' || st.g !== g) return null; const f = Array.isArray(st.f) ? st.f.filter(y => Array.isArray(y) && y[0] !== me) : []; f.push(row); st.f = f; }); }
  catch (e) { if (race && race.g === g) race.finSent = false; }
}
function hostCheck(tt) {
  const r = room; if (!r || !race || !r.isHost() || endSending || r.s.ph !== 'play' || r.s.g !== race.g) return;
  const ids = new Set(r.seated().map(p => p.id)), riders = (r.s.s.L || []).map(x => x[0]), f = Array.isArray(r.s.f) ? r.s.f : [];
  const has = id => f.some(x => Array.isArray(x) && x[0] === id), all = riders.every(id => has(id) || (!ids.has(id) && tt > 25000));
  if (!(all && tt > 0) && tt < 80000) return;
  endSending = true; const g = race.g, S = r.s.s;
  const bots = (S.B || []).map((b, i) => { const run = T.simBot(T.spec(cfgOf([0, b[1], b[2], b[3], b[4]])), S.tr || 'datar', +b[5] || 0.6, b[6] | 0), x = rowOf(run); return { id: -1 - i, name: String(b[0]), bot: 1, tot: x.tot, best: x.best, p: x.p, m: x.m }; });
  const names = new Map((S.L || []).map(x => [x[0], x[1]]));
  const hum = riders.map(id => { const x = f.find(y => y[0] === id); return x ? { id, name: names.get(id) || '?', tot: x[1], best: x[2], p: x[3], m: x[4] } : { id, name: names.get(id) || '?', tot: null, best: null, p: 0, m: 0 }; });
  const res = hum.concat(bots).sort(T.rank);
  r.edit('end', s => { if (s.ph !== 'play' || s.g !== g) return null; s.ph = 'end'; s.res = { rows: res }; return { status: 'waiting' }; }).catch(() => {}).finally(() => { endSending = false; });
}
function finishOnline(s) {
  if (!race) return; race.done = true; motorOn(false);
  const rs = (s.res.rows || []).map(x => Object.assign({}, x, { me: x.id === me })), mineI = rs.findIndex(x => x.me), mine = rs[mineI];
  const L = myLane(); if (mine && L && L.run) mine.laps = L.run.lapT.slice();
  let title = 'Hasil balapan', sub = 'Juara: ' + (rs[0] ? rs[0].name : '–');
  if (mine) { const pos = mineI + 1; title = mine.tot == null ? 'Tidak finis' : pos === 1 ? 'Juara 1! 🏆' : 'Posisi ' + pos; if (pos === 1 && mine.tot != null) sub = 'Kamu tercepat di room ini!'; const key = s.g + ':' + me; if (race.paid !== key) { race.paid = key; save.races++; if (pos === 1) save.wins++; persist(); (pos === 1 ? SFX.fin : SFX.lose)(); } }
  showResult({ title, sub, rows: rs, mine });
}
function canRun(r) { return !!r && (r.isHost() || r.isGamemaster()); }
async function startOnline() {
  const r = room; if (!canRun(r) || starting) return; const ps = r.seated().slice(0, 4); if (!ps.length) return; starting = true; $('startBtn').disabled = true;
  const want = Math.max(0, Math.min(3, r.s.set.bots | 0)), nb = Math.max(ps.length < 2 ? 1 : 0, Math.min(want, 4 - ps.length)), bk = Array.isArray(r.s.bk) ? r.s.bk : [];
  const L = ps.map(p => { const b = bk.find(x => Array.isArray(x) && x[0] === p.id) || [p.id, 'kilat', 'atomik', 'bearing', 'slick']; return [p.id, p.displayName, String(b[1]), String(b[2]), String(b[3]), String(b[4])]; });
  const pool = T.BOTS.slice(0, 6).sort(() => Math.random() - 0.5);
  const B = Array.from({ length: nb }, (_, i) => { const b = pool[i]; return [b.n, b.cfg.ch, b.cfg.din, b.cfg.rol, b.cfg.ban, Math.min(0.75, b.skill + 0.05), (Math.random() * 1e9) | 0]; });
  const g = Math.random().toString(36).slice(2, 8), tr = T.trackOf(r.s.set.tr).id;
  try { await r.edit('start', s => { s.ph = 'play'; s.g = g; s.f = []; s.res = null; s.s = { t0: Math.round(sNow() + 5200), tr, L, B }; return { status: 'playing' }; }); }
  catch (e) { toast(errMsg(e), 'warn'); }
  finally { starting = false; $('startBtn').disabled = false; }
}
async function toLobby() { const r = room; if (!canRun(r)) return; try { await r.edit('lobby', s => { s.ph = 'lobby'; s.s = null; s.res = null; s.f = []; return { status: 'waiting' }; }); } catch (e) { toast(errMsg(e), 'warn'); } }
async function setRoom(k, v) { const r = room; if (!canRun(r)) return; try { await r.edit('set', s => { if (s.ph !== 'lobby') return null; s.set[k] = v; }); } catch (e) { toast(errMsg(e), 'warn'); } }
function renderRoom() {
  const r = room; if (!r || !r.data) return; const s = r.s, host = canRun(r), ps = r.seated(), want = Math.max(0, Math.min(3, s.set.bots | 0)), bots = Math.max(ps.length < 2 ? 1 : 0, Math.min(want, 4 - ps.length)), bk = Array.isArray(s.bk) ? s.bk : [], tr = T.trackOf(s.set.tr);
  $('roomCode').textContent = r.code; $('lobbyVis').textContent = r.data.visibility === 'public' ? 'Room publik: siapa saja bisa masuk lewat "Cari lawan". Maks 4 racer.' : 'Room privat: masuk pakai kode atau link undangan. Maks 4 racer.';
  $('pCount').textContent = (ps.length + bots) + '/4';
  $('pList').innerHTML = ps.map((p, i) => { const b = bk.find(x => Array.isArray(x) && x[0] === p.id), c = b ? cfgOf(b) : null, col = c ? ch(c.ch).col : PAL[i % PAL.length]; return '<li><span class="dot" style="background:' + col + '"></span><span>' + esc(p.displayName) + (isGm(p.id) ? ' <em class="gm-tag">(GM)</em>' : '') + '</span>' + (p.id === r.me ? '<span class="tag">kamu</span>' : '') + (p.host ? '<span class="tag">host</span>' : '') + '<span class="bk">🏎️ ' + (c ? esc(ch(c.ch).n + ' · ' + partName(T.DINAMO, c.din)) : '…') + '</span></li>'; }).join('')
    + Array.from({ length: bots }, (_, i) => '<li><span class="dot" style="background:#bbb"></span><span>Bot ' + (i + 1) + ' 🤖</span><span class="tag">bot</span><span class="bk">isi kursi kosong</span></li>').join('');
  $('lobbyTrack').textContent = 'Lintasan: ' + tr.e + ' ' + tr.n + ' · ' + T.LAPS + ' lap';
  $('hostBox').hidden = !host; $('onBots').querySelectorAll('button').forEach(b => b.classList.toggle('on', +b.dataset.v === want));
  $('onTrack').innerHTML = T.TRACKS.map(t => '<button data-tr="' + t.id + '" class="' + (t.id === tr.id ? 'on' : '') + '" title="' + esc(t.n) + '">' + t.e + '</button>').join('');
  $('lobbyWait').textContent = r.spectator ? 'Kamu menonton.' : host ? (ps.length < 2 ? 'Undang teman (🔗) atau langsung mulai lawan bot.' : '') : 'Menunggu host memulai…';
}
/* chat sorak-sorai */
const BAD = /\b(anjing|bangsat|babi|kontol|memek|ngentot|goblok|tolol|fuck|shit|bitch)\b/gi;
function cleanChat(x) { return String(x || '').replace(/[\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120).replace(BAD, w => w[0] + '*'.repeat(w.length - 1)); }
const chatKeys = new Set(); let chatSeq = Date.now() % 1e7, chatAt = 0;
function resetChat() { chatKeys.clear(); $('chatLog').innerHTML = ''; seatSeen = null; }
function addChatLine(m) {
  if (!m || !m.k || chatKeys.has(m.k)) return; chatKeys.add(m.k); const log = $('chatLog'), p = doc.createElement('p');
  if (m.t === 'sys') { p.className = 'sys'; p.textContent = m.x; } else { p.innerHTML = '<b>' + esc(m.n || '?') + (isGm(m.p) ? ' <em class="gm-tag">(GM)</em>' : '') + ':</b> ' + esc(m.x); if (race && !race.done) bubble(race.lanes.find(l => (l.me && m.p === me) || (!l.me && l.id === m.p)), m.x); else lobbyBub[m.p] = { x: String(m.x).slice(0, 40), t: performance.now() + 3200 }; }
  const stick = log.scrollTop + log.clientHeight >= log.scrollHeight - 30; log.appendChild(p); while (log.children.length > 80) log.firstChild.remove(); if (stick) log.scrollTop = log.scrollHeight;
}
function syncChat(cm) { for (const m of cm || []) { if (!m || typeof m !== 'object') continue; const fresh = !chatKeys.has(String(m.k || '')); addChatLine({ k: String(m.k || ''), p: m.p, n: String(m.n || ''), x: cleanChat(m.x) }); if (fresh && m.p !== me && chatKeys.size > 1) SFX.chat(); } }
async function sendChat(raw) {
  const x = cleanChat(raw); if (!x) return false; const n = Date.now(); if (n - chatAt < 1200) { toast('Pelan-pelan soraknya 🙂', 'warn', 1400); return false; } chatAt = n;
  if (!room) { const L = myLane(); if (L) { bubble(L, x); SFX.cheer(); const bot = race.lanes.filter(l => l.brain); if (bot.length && Math.random() < 0.6) setTimeout(() => { if (race) bubble(pick(bot), pick(['Siap!', 'Ayo kejar!', 'Hahaha', '🔥🔥', 'Nggak mau kalah!'])); }, 700); } return true; }
  const m = { k: 'c' + me + '.' + (++chatSeq), p: me, n: myName() || '?', x }; addChatLine(m); SFX.cheer();
  try { await room.edit('chat', s => { s.cm = (s.cm || []).concat([m]).slice(-30); }); } catch (e) { toast(errMsg(e), 'warn'); } return true;
}
const QUICK = ['🔥 Gas!', '😎 Siap', '🏁 Rematch?', '👏 GG', '😂 Wkwk', '🙏 Tunggu'];
/* GM */
let gm = false, gmRooms = null, gmErr = '', gmBusy = false, gmAt = 0, gmWakeT = 0, gmUI = null;
const gmHash = () => { const h = (location.hash || '').toLowerCase(); return h.includes(N.GM_KEY) || h.includes('gamemaster'); };
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
  const trig = () => /[?&]gmjd(=|&|$)/i.test(w.location.search || '') || /gamemaster/i.test(w.location.hash || '');
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
  $('gmList').innerHTML = list.map(r => { const code = esc(r.code), playing = r.status === 'playing'; return '<li><b class="code">' + code + '</b><span class="gm-meta"><span class="badge">' + (r.visibility === 'private' ? 'privat' : 'publik') + '</span> <span class="badge">' + (playing ? 'balapan' : 'lobby') + '</span> <small class="muted">' + (Number(r.seated) || 0) + '/' + (Number(r.maxPlayers) || 0) + '</small></span>' + (playing ? '' : '<button class="btn small green online-btn" data-gm="join" data-code="' + code + '">Masuk</button>') + '<button class="btn small ghost online-btn" data-gm="watch" data-code="' + code + '">Tonton</button></li>'; }).join('');
}
async function gmEnter(kind, code) { if (!/^[A-Z2-9]{6}$/.test(code || '')) return; $('codeInput').value = code; if (kind === 'join') return onlineAction('join'); const name = myName(); if (!name) { toast('Isi nama racer dulu', 'warn'); return; } try { await enterOnline('watch', { displayName: name, code }); } catch (e) { toast(errMsg(e), 'warn'); } }
function invite() { if (!room) return; const url = location.origin + location.pathname + '?room=' + room.code, done = () => toast('Link undangan disalin', 'good'); if (navigator.share && /Mobi|Android/i.test(navigator.userAgent)) navigator.share({ title: 'Tamiya Lintasan', text: 'Adu Tamiya sama aku di Tamiya Lintasan · room ' + room.code, url }).catch(() => {}); else if (navigator.clipboard) navigator.clipboard.writeText(url).then(done, () => toast(url, '', 6000)); else toast(url, '', 6000); }
function confirmExit() { if (mode === 'online' && room) { if (root.confirm('Keluar dari room?')) exitToMenu(false); return; } exitToMenu(false); }
/* ---------- boot ---------- */
async function boot() {
  $('nameInput').value = getLS(NAME_KEY) || ''; $('nameInput').addEventListener('change', () => setLS(NAME_KEY, myName()));
  if (root.JDNG) root.JDNG.on(n => { if (n && !$('nameInput').value) { $('nameInput').value = n; setLS(NAME_KEY, myName()); } });
  paintMute(); paintHome(); hero(); root.requestAnimationFrame(garageLoop);
  $('muteBtn').addEventListener('click', toggleMute); $('muteBtn2').addEventListener('click', toggleMute);
  const nm = () => setLS(NAME_KEY, myName());
  $('latBtn').addEventListener('click', () => { ac(); nm(); if (!save.tut) { toast('Pertama kali? Mulai dari tutorial singkat 🎓', '', 2600); startTut(); } else startLatihan(); });
  $('taBtn').addEventListener('click', () => { ac(); nm(); startTA(); });
  $('tutBtn').addEventListener('click', () => { ac(); nm(); startTut(); });
  $('garageBtn').addEventListener('click', () => { SFX.click(); openGarage(); });
  $('lobGarage').addEventListener('click', () => { SFX.click(); openGarage('lobby'); });
  $('resGarage').addEventListener('click', () => { $('result').hidden = true; if (mode !== 'online') race = null; openGarage(mode === 'online' && room ? 'lobby' : null); });
  $('chassisPick').addEventListener('click', e => { const b = e.target.closest('[data-ch]'); if (b) { save.cfg.ch = b.dataset.ch; persist(); SFX.click(); paintGarage(); } });
  $('parts').addEventListener('click', e => { const b = e.target.closest('[data-k]'); if (b) { save.cfg[b.dataset.k] = b.dataset.v; persist(); SFX.click(); paintGarage(); } });
  $('gRace').addEventListener('click', () => { ac(); if (garageAfter === 'lobby' && room) { carToRoom(); renderRoom(); show('lobby'); } else startLatihan(); });
  doc.querySelectorAll('[data-back]').forEach(b => b.addEventListener('click', () => { if (room) { carToRoom(); renderRoom(); show('lobby'); } else show('home'); }));
  $('againBtn').addEventListener('click', () => { ac(); again(); }); $('resMenu').addEventListener('click', () => exitToMenu(false)); $('toLobbyBtn').addEventListener('click', toLobby);
  $('exitBtn').addEventListener('click', confirmExit);
  const tapBtn = $('tapBtn'); tapBtn.addEventListener('pointerdown', e => { e.preventDefault(); doTap(); }); tapBtn.addEventListener('click', e => { if (e.detail === 0) doTap(); });
  $('raceCv').addEventListener('pointerdown', e => { if (e.isPrimary !== false) doTap(); });
  doc.addEventListener('keydown', e => {
    if (e.target && /INPUT|TEXTAREA/.test(e.target.tagName)) return;
    if ((e.code === 'Space' || e.key === 'Enter') && !$('race').hidden && $('result').hidden) { e.preventDefault(); if (!e.repeat) doTap(); }
    else if (e.key === 'm' || e.key === 'M') toggleMute();
  });
  $('cheer').innerHTML = CHEERS.map(q => '<button type="button">' + esc(q) + '</button>').join(''); $('cheer').addEventListener('click', e => { const b = e.target.closest('button'); if (b) sendChat(b.textContent); });
  $('matchBtn').addEventListener('click', () => { ac(); onlineAction('match'); }); $('createPub').addEventListener('click', () => { ac(); onlineAction('public'); }); $('createPriv').addEventListener('click', () => { ac(); onlineAction('private'); });
  $('joinForm').addEventListener('submit', e => { e.preventDefault(); ac(); onlineAction('join'); });
  $('codeInput').addEventListener('input', e => { e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''); });
  $('inviteBtn').addEventListener('click', invite); $('lobbyLeave').addEventListener('click', () => exitToMenu(false)); $('startBtn').addEventListener('click', () => { ac(); startOnline(); });
  $('onBots').addEventListener('click', e => { const b = e.target.closest('button'); if (b) setRoom('bots', +b.dataset.v); });
  $('onTrack').addEventListener('click', e => { const b = e.target.closest('[data-tr]'); if (b) setRoom('tr', b.dataset.tr); });
  $('quickChat').innerHTML = QUICK.map(q => '<button type="button">' + esc(q) + '</button>').join(''); $('quickChat').addEventListener('click', e => { const b = e.target.closest('button'); if (b) sendChat(b.textContent); });
  $('chatForm').addEventListener('submit', e => { e.preventDefault(); const i = $('chatInput'); Promise.resolve(sendChat(i.value)).then(ok => { if (ok) i.value = ''; }); if (!$('race').hidden) { i.blur(); $('raceChatSlot').hidden = true; $('chatCard').appendChild($('chat')); } });
  $('chatBtn').addEventListener('click', () => { const d = $('raceChatSlot'); d.hidden = !d.hidden; if (!d.hidden) d.appendChild($('chat')); else $('chatCard').appendChild($('chat')); });
  root.addEventListener('pagehide', () => { if (room) conn.leaveBeacon(); });
  doc.addEventListener('visibilitychange', () => { if (doc.visibilityState === 'visible' && conn.config) conn.visible(); });
  $('gmRefresh').addEventListener('click', gmLoad); $('gmList').addEventListener('click', e => { const b = e.target.closest('[data-gm]'); if (b) gmEnter(b.dataset.gm, b.dataset.code); });
  root.addEventListener('hashchange', gmSync); setInterval(() => { if (gm && !room && doc.visibilityState === 'visible' && Date.now() - gmAt > 10000) gmLoad(); }, 2000);
  gmSync(); gmUI = gmClaimUI({ canClaim: () => mode === 'online' && !!room && !!room.data && !room.local && !room.isGamemaster(), claim: code => room.claimGamemaster(code), onDone: () => { toast('Mode gamemaster aktif: kamu bisa mulai & atur room', 'good', 3200); gmMeSync(); if (room) renderRoom(); } });
  root.requestAnimationFrame(frame);
  const route = () => { const h = (location.hash || '').toLowerCase(); if (room || h === lastRoute) return; lastRoute = h; if (h === '#latihan') { ac(); startLatihan(); } else if (h === '#demo') startDemo(); else if (h === '' && mode !== 'online') { if (race) { race = null; motorOn(false); } $('result').hidden = true; mode = null; show('home'); } };
  route(); root.addEventListener('hashchange', route);
  doc.querySelectorAll('.online-btn').forEach(b => { b.disabled = true; });
  if (conn.allowed) { try { await conn.start(); onlineOk = true; } catch (e) { conn.failed = true; onlineOk = false; } }
  doc.querySelectorAll('.online-btn').forEach(b => { b.disabled = !onlineOk; });
  const note = $('onlineNote'), msg = !conn.allowed ? 'Mode online hanya di tamiyalintasan.jadidaring.com. Latihan & Time Attack tetap jalan.' : conn.failed ? 'Server online sedang tidak bisa dihubungi. Mode solo tetap jalan.' : ''; note.textContent = msg; note.hidden = !msg;
  if (gm) gmLoad();
  if (conn.code && conn.token) { try { await conn.leave(); } catch (e) { conn.forget(); } }
  const JR = root.JRInvite, invCode = JR && JR.code ? JR.code('room') : '';
  if (invCode && JR.run) {
    JR.run({ code: invCode, lang: 'id', gameName: 'Tamiya Lintasan', nameMax: 16, accent: '#ff8a1f',
      check: async code => { if (!conn.allowed) return 'offline'; if (!onlineOk) return { fallback: 'Server online sedang tidak bisa dihubungi.' }; return conn.probe(code); },
      join: async name => {
        $('nameInput').value = name; setLS(NAME_KEY, myName()); ac();
        try { await enterOnline('join', { displayName: myName() || name, code: invCode }); return { ok: true }; }
        catch (e) { if (e.status === 409) { try { await enterOnline('watch', { displayName: name, code: invCode }); toast('Room penuh (maks 4), kamu menonton', 'warn', 4000); return { ok: true }; } catch (e2) { /* fall through */ } } if (e.status === 404 || e.status === 422) return { ok: false, missing: true }; return { ok: false, retry: true, message: errMsg(e) }; }
      }, fallback: () => {} });
  }
}
if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', boot); else boot();
root.TLApp = { get race() { return race; }, get room() { return room; }, get mode() { return mode; }, get me() { return me; }, get save() { return save; }, persist, startLatihan, startTA, startTut, startDemo, startOnline, tap: doTap, sendChat, conn, openGarage };
})(window);

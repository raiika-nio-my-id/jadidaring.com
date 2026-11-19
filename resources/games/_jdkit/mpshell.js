/* JaRing kit MPShell: shared online plumbing for multiplayer games (/api/game rooms + Reverb via MPNet):
   enter/match/public/private/join, lobby list with capacity, chat (rate limit 1.2 s, 120 chars, word filter, quick chips),
   GM tools (#gamemaster / ?gmjd claim prompt, #gamemaster lobby list incl. private), ?room= invite (JRInvite card), pagehide leave.
   The game supplies hooks; DOM ids are the kit standard (see README). */
(function (root) {
'use strict';
const N = root.MPNet, doc = document, $ = id => doc.getElementById(id);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const BAD = /\b(anjing|bangsat|babi|kontol|memek|ngentot|goblok|tolol|fuck|shit|bitch)\b/gi;
function cleanChat(x) { return String(x || '').replace(/[\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120).replace(BAD, w => w[0] + '*'.repeat(w.length - 1)); }
function MPShell(cfg) {
  const MAX = cfg.max, toast = cfg.toast, sfx = cfg.sfx || {};
  const conn = new N.Connection({ storage: root.sessionStorage, onWake: () => room && room.refresh(), lobbyWake: () => gmWake() });
  let room = null, me = 0, onlineOk = false, seatSeen = null, gm = false, gmRooms = null, gmErr = '', gmBusy = false, gmAt = 0, gmWakeT = 0, gmUI = null;
  const chatKeys = new Set(); let chatSeq = Date.now() % 1e7, chatAt = 0;
  const myName = () => cfg.myName();
  function errMsg(e) { if (!e) return 'Koneksi bermasalah'; if (e.code === 'busy') return 'Server sibuk, coba ' + (e.wait || 10) + ' dtk lagi'; if (e.code === 'network') return 'Koneksi bermasalah'; if (e.status === 404 || e.status === 422) return 'Room tidak ditemukan'; if (e.status === 409) return 'Room penuh / sedang main'; return 'Gagal: ' + (e.server || e.message || ''); }
  const canRun = r => { r = r || room; return !!r && (r.isHost() || r.isGamemaster()); };
  const isGm = id => !!room && id != null && id > 0 && room.isGamemaster(id);
  function gmMeSync() { doc.documentElement.classList.toggle('gm-on', !!room && room.isGamemaster()); if (gmUI) gmUI.sync(); }
  async function enter(kind, opts) {
    if (room) { const old = room; room = null; old.leave(); }
    const r = new N.Room(conn, { onChange: onRoom }); room = r; resetChat(); if (cfg.onEnter) cfg.onEnter(r);
    try { await r.enter(kind, Object.assign({ set: Object.assign({}, cfg.defSet || {}), maxPlayers: MAX }, opts)); } catch (e) { if (room === r) room = null; throw e; }
    me = r.me; addChatLine({ k: 'sys-in' + Date.now(), t: 'sys', x: (myName() || 'Kamu') + ' masuk room' }); gmMeSync(); onRoom(r, r.data); if (cfg.afterEnter) cfg.afterEnter(r); return r;
  }
  async function action(kind) {
    const name = myName(); if (!name) { toast('Isi nama dulu', 'warn'); $('nameInput').focus(); return; }
    if (cfg.saveName) cfg.saveName(name); const code = $('codeInput').value.trim().toUpperCase();
    if (kind === 'join' && !/^[A-Z2-9]{6}$/.test(code)) { toast('Kode room 6 huruf/angka', 'warn'); return; }
    btns(true);
    try { await enter(kind, { displayName: name, code }); }
    catch (e) { if (kind === 'join' && e.status === 409) { try { await enter('watch', { displayName: name, code }); toast('Room penuh (maks ' + MAX + '), kamu menonton', 'warn', 4000); } catch (e2) { toast(errMsg(e2), 'warn', 4000); } } else toast(errMsg(e), 'warn', 4000); }
    finally { btns(!onlineOk); }
  }
  const btns = dis => doc.querySelectorAll('.online-btn').forEach(b => { b.disabled = dis; });
  function onRoom(r, data) {
    if (r !== room) return;
    if (!data) { toast('Room ditutup', 'warn'); leave(true); return; }
    me = r.me; gmMeSync(); joinLeave(r.seated()); syncChat(r.s.cm); cfg.onRoom(r, data);
  }
  function joinLeave(ps) { const ids = new Map(ps.map(p => [p.id, p.displayName])); if (seatSeen) { for (const [id, n] of ids) if (!seatSeen.has(id) && id !== me) { addChatLine({ k: 'sj' + id + Date.now(), t: 'sys', x: n + ' masuk room' }); if (sfx.chat) sfx.chat(); } for (const [id, n] of seatSeen) if (!ids.has(id)) addChatLine({ k: 'sl' + id + Date.now(), t: 'sys', x: n + ' keluar' }); } seatSeen = ids; }
  async function leave(silent) { const r = room; room = null; if (r) { try { await r.leave(); } catch (e) { /* gone */ } } if (cfg.onLeave) cfg.onLeave(silent); }
  async function edit(type, fn) { const r = room; if (!r) return null; try { return await r.edit(type, fn); } catch (e) { toast(errMsg(e), 'warn'); return null; } }
  async function setRoom(k, v) { if (!canRun()) return; await edit('set', s => { if (s.ph !== 'lobby') return null; s.set[k] = v; }); }
  /* standard lobby: code, visibility, players x/MAX, host box */
  function renderLobby() {
    const r = room; if (!r || !r.data) return; const ps = r.seated(), host = canRun(r);
    $('roomCode').textContent = r.code; $('lobbyVis').textContent = (r.data.visibility === 'public' ? 'Room publik: siapa saja bisa masuk lewat "Cari lawan".' : 'Room privat: masuk pakai kode atau link undangan.') + ' Maks ' + MAX + ' pemain.';
    const extra = cfg.lobbyRows ? cfg.lobbyRows(r, ps) : { rows: null, count: ps.length };
    $('pCount').textContent = extra.count + '/' + MAX;
    $('pList').innerHTML = extra.rows || ps.map((p, i) => '<li><span class="dot" style="background:' + (cfg.color ? cfg.color(p, i) : '#f5b301') + '"></span><span>' + esc(p.displayName) + (isGm(p.id) ? ' <em class="gm-tag">(GM)</em>' : '') + '</span>' + (p.id === r.me ? '<span class="tag">kamu</span>' : '') + (p.host ? '<span class="tag">host</span>' : '') + (cfg.tag ? cfg.tag(p, i, r) : '') + '</li>').join('');
    $('hostBox').hidden = !host;
    $('lobbyWait').textContent = r.spectator ? 'Kamu menonton.' : host ? (cfg.hostHint ? cfg.hostHint(r, ps) : '') : 'Menunggu host memulai…';
    if (cfg.renderLobby) cfg.renderLobby(r, ps, host);
  }
  /* chat */
  function resetChat() { chatKeys.clear(); $('chatLog').innerHTML = ''; seatSeen = null; }
  function addChatLine(m) {
    if (!m || !m.k || chatKeys.has(m.k)) return; chatKeys.add(m.k); const log = $('chatLog'), p = doc.createElement('p');
    if (m.t === 'sys') { p.className = 'sys'; p.textContent = m.x; } else { p.innerHTML = '<b>' + esc(m.n || '?') + (isGm(m.p) ? ' <em class="gm-tag">(GM)</em>' : '') + ':</b> ' + esc(m.x); if (cfg.onChat) cfg.onChat(m); }
    const stick = log.scrollTop + log.clientHeight >= log.scrollHeight - 30; log.appendChild(p); while (log.children.length > 80) log.firstChild.remove(); if (stick) log.scrollTop = log.scrollHeight;
  }
  function syncChat(cm) { for (const m of cm || []) { if (!m || typeof m !== 'object') continue; const fresh = !chatKeys.has(String(m.k || '')); addChatLine({ k: String(m.k || ''), p: m.p, n: String(m.n || ''), x: cleanChat(m.x) }); if (fresh && m.p !== me && chatKeys.size > 1 && sfx.chat) sfx.chat(); } }
  async function sendChat(raw) {
    const x = cleanChat(raw); if (!x) return false; const n = Date.now(); if (n - chatAt < 1200) { toast('Pelan-pelan soraknya 🙂', 'warn', 1400); return false; } chatAt = n;
    if (!room) { if (cfg.localChat) cfg.localChat(x); return true; }
    const m = { k: 'c' + me + '.' + (++chatSeq), p: me, n: myName() || '?', x }; addChatLine(m); if (sfx.cheer) sfx.cheer();
    try { await room.edit('chat', s => { s.cm = (s.cm || []).concat([m]).slice(-30); }); } catch (e) { toast(errMsg(e), 'warn'); } return true;
  }
  /* GM */
  const gmHash = () => { const h = (location.hash || '').toLowerCase(); return h.includes(N.GM_KEY) || h.includes('gamemaster'); };
  function gmSync() { const on = gmHash(); if (on === gm) return; gm = on; gmRooms = null; gmErr = ''; $('gmRooms').hidden = !gm; if (gm) gmLoad(); else renderGm(); }
  async function gmLoad() { if (!gm || gmBusy) return; if (!onlineOk) { renderGm(); return; } gmBusy = true; gmAt = Date.now(); renderGm(); try { const d = await conn.rooms({ gm: true }); gmRooms = Array.isArray(d && d.rooms) ? d.rooms : []; gmErr = ''; } catch (e) { gmErr = errMsg(e); } finally { gmBusy = false; renderGm(); } }
  function gmWake() { if (!gm || room) return; clearTimeout(gmWakeT); gmWakeT = setTimeout(gmLoad, 1200); }
  function renderGm() {
    const box = $('gmRooms'); box.hidden = !gm; if (!gm) return; const list = gmRooms || [];
    $('gmNote').textContent = !onlineOk ? 'Online belum siap' : gmErr ? gmErr : gmRooms === null ? 'Memuat…' : list.length ? list.length + ' room' : 'Belum ada room';
    $('gmList').innerHTML = list.map(r => { const code = esc(r.code), playing = r.status === 'playing'; return '<li><b class="code">' + code + '</b><span class="gm-meta"><span class="badge">' + (r.visibility === 'private' ? 'privat' : 'publik') + '</span> <span class="badge">' + (playing ? 'main' : 'lobby') + '</span> <small class="muted">' + (Number(r.seated) || 0) + '/' + (Number(r.maxPlayers) || 0) + '</small></span>' + (playing ? '' : '<button class="btn small green online-btn" data-gm="join" data-code="' + code + '">Masuk</button>') + '<button class="btn small ghost online-btn" data-gm="watch" data-code="' + code + '">Tonton</button></li>'; }).join('');
  }
  async function gmEnter(kind, code) { if (!/^[A-Z2-9]{6}$/.test(code || '')) return; $('codeInput').value = code; if (kind === 'join') return action('join'); const name = myName(); if (!name) { toast('Isi nama dulu', 'warn'); return; } try { await enter('watch', { displayName: name, code }); } catch (e) { toast(errMsg(e), 'warn'); } }
  function gmClaimUI({ canClaim, claim, onDone }) {
    const d = document, w = window, m = d.createElement('div'); m.id = 'gmClaim'; m.setAttribute('role', 'dialog'); m.setAttribute('aria-modal', 'true'); m.setAttribute('aria-label', 'Kode gamemaster');
    m.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.45);display:none;align-items:center;justify-content:center';
    m.innerHTML = '<form id="gmClaimForm" style="background:#fff;color:#222;padding:16px;border-radius:14px;width:260px;max-width:86vw;font:14px system-ui,sans-serif;box-shadow:0 8px 30px rgba(0,0,0,.3)"><b style="display:block;margin-bottom:8px">Kode gamemaster</b>'
      + '<input id="gmClaimInput" type="password" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Masukkan kode" maxlength="128" style="width:100%;box-sizing:border-box;padding:8px;border:1px solid #bbb;border-radius:8px;font:inherit;color:#222;background:#fff">'
      + '<p id="gmClaimErr" role="alert" style="color:#c0392b;min-height:1.2em;margin:6px 0;font-size:13px"></p><div style="display:flex;gap:8px;justify-content:flex-end"><button type="button" id="gmClaimCancel" style="padding:6px 12px;border-radius:8px;border:1px solid #bbb;background:#f3f3f3;color:#222;font:inherit">Batal</button>'
      + '<button type="submit" id="gmClaimOk" style="padding:6px 12px;border-radius:8px;border:0;background:#c0392b;color:#fff;font:600 14px system-ui,sans-serif">Masuk</button></div></form>';
    d.body.appendChild(m);
    const inp = m.querySelector('#gmClaimInput'), er = m.querySelector('#gmClaimErr'), ok = m.querySelector('#gmClaimOk');
    const trig = () => /[?&]gmjd(=|&|$)/i.test(w.location.search || '') || /gamemaster/i.test(w.location.hash || '');
    let busy = false, want = trig(), asked = false;
    const close = () => { m.style.display = 'none'; inp.value = ''; er.textContent = ''; };
    const open = () => { if (!canClaim()) return; er.textContent = ''; inp.value = ''; m.style.display = 'flex'; setTimeout(() => inp.focus(), 20); };
    m.addEventListener('click', e => { if (e.target === m) close(); }); m.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Escape') close(); }); m.addEventListener('keyup', e => e.stopPropagation());
    m.querySelector('#gmClaimCancel').addEventListener('click', close);
    m.querySelector('#gmClaimForm').addEventListener('submit', async e => {
      e.preventDefault(); e.stopPropagation(); const code = inp.value.trim(); if (!code || busy) { inp.focus(); return; } busy = true; ok.disabled = true; er.textContent = '';
      try { await claim(code); want = false; close(); if (trig() && w.history && w.history.replaceState) { const u = new URL(w.location.href); for (const k of [...u.searchParams.keys()]) if (k.toLowerCase() === 'gmjd') u.searchParams.delete(k); w.history.replaceState(w.history.state, '', u.pathname + u.search + u.hash); } sync(); if (onDone) onDone(); }
      catch (x) { inp.value = ''; er.textContent = x && x.status === 403 ? 'Kode salah.' : 'Gagal, coba lagi.'; inp.focus(); }
      finally { busy = false; ok.disabled = false; }
    });
    function sync() { const on = !!canClaim(); if (!on) { asked = false; if (m.style.display !== 'none' && !busy) close(); return; } if (want && !asked) { asked = true; open(); } }
    return { sync, open, close };
  }
  function invite() { if (!room) return; const url = location.origin + location.pathname + '?room=' + room.code, done = () => toast('Link undangan disalin', 'good'); if (navigator.share && /Mobi|Android/i.test(navigator.userAgent)) navigator.share({ title: cfg.title, text: cfg.inviteText + ' · room ' + room.code, url }).catch(() => {}); else if (navigator.clipboard) navigator.clipboard.writeText(url).then(done, () => toast(url, '', 6000)); else toast(url, '', 6000); }
  async function boot() {
    $('matchBtn').addEventListener('click', () => action('match')); $('createPub').addEventListener('click', () => action('public')); $('createPriv').addEventListener('click', () => action('private'));
    $('joinForm').addEventListener('submit', e => { e.preventDefault(); action('join'); });
    $('codeInput').addEventListener('input', e => { e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''); });
    $('inviteBtn').addEventListener('click', invite); $('lobbyLeave').addEventListener('click', () => leave(false));
    $('quickChat').innerHTML = (cfg.quick || []).map(q => '<button type="button">' + esc(q) + '</button>').join(''); $('quickChat').addEventListener('click', e => { const b = e.target.closest('button'); if (b) sendChat(b.textContent); });
    $('chatForm').addEventListener('submit', e => { e.preventDefault(); const i = $('chatInput'); Promise.resolve(sendChat(i.value)).then(ok => { if (ok) i.value = ''; }); if (cfg.afterChatSubmit) cfg.afterChatSubmit(i); });
    root.addEventListener('pagehide', () => { if (room) conn.leaveBeacon(); });
    doc.addEventListener('visibilitychange', () => { if (doc.visibilityState === 'visible' && conn.config) conn.visible(); });
    $('gmRefresh').addEventListener('click', gmLoad); $('gmList').addEventListener('click', e => { const b = e.target.closest('[data-gm]'); if (b) gmEnter(b.dataset.gm, b.dataset.code); });
    root.addEventListener('hashchange', gmSync); setInterval(() => { if (gm && !room && doc.visibilityState === 'visible' && Date.now() - gmAt > 10000) gmLoad(); }, 2000);
    gmSync(); gmUI = gmClaimUI({ canClaim: () => !!room && !!room.data && !room.local && !room.isGamemaster(), claim: code => room.claimGamemaster(code), onDone: () => { toast('Mode gamemaster aktif: kamu bisa mulai & atur room', 'good', 3200); gmMeSync(); if (room) cfg.onRoom(room, room.data); } });
    btns(true);
    if (conn.allowed) { try { await conn.start(); onlineOk = true; } catch (e) { conn.failed = true; onlineOk = false; } }
    btns(!onlineOk);
    const note = $('onlineNote'), msg = !conn.allowed ? 'Mode online hanya di ' + cfg.slug + '.jadidaring.com. Mode lawan bot tetap jalan.' : conn.failed ? 'Server online sedang tidak bisa dihubungi. Mode lawan bot tetap jalan.' : ''; note.textContent = msg; note.hidden = !msg;
    if (gm) gmLoad();
    if (conn.code && conn.token) { try { await conn.leave(); } catch (e) { conn.forget(); } }
    const JR = root.JRInvite, invCode = JR && JR.code ? JR.code('room') : '';
    if (invCode && JR.run) {
      JR.run({ code: invCode, lang: 'id', gameName: cfg.title, nameMax: 16, accent: cfg.accent,
        check: async code => { if (!conn.allowed) return 'offline'; if (!onlineOk) return { fallback: 'Server online sedang tidak bisa dihubungi.' }; return conn.probe(code); },
        join: async name => {
          $('nameInput').value = name; if (cfg.saveName) cfg.saveName(myName());
          try { await enter('join', { displayName: myName() || name, code: invCode }); return { ok: true }; }
          catch (e) { if (e.status === 409) { try { await enter('watch', { displayName: name, code: invCode }); toast('Room penuh (maks ' + MAX + '), kamu menonton', 'warn', 4000); return { ok: true }; } catch (e2) { /* fall through */ } } if (e.status === 404 || e.status === 422) return { ok: false, missing: true }; return { ok: false, retry: true, message: errMsg(e) }; }
        }, fallback: () => {} });
    }
  }
  return { conn, boot, enter, action, leave, edit, setRoom, renderLobby, sendChat, addChatLine, canRun, isGm, errMsg, invite, get room() { return room; }, get me() { return me; }, get online() { return onlineOk; }, sNow: () => conn.serverNow() };
}
root.MPShell = MPShell; root.JDK = Object.assign(root.JDK || {}, { esc, cleanChat });
})(window);

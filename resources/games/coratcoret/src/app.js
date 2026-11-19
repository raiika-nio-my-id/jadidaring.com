(function () {
'use strict';
const DG = window.DG, $ = id => document.getElementById(id);
let CFG;
try { CFG = JSON.parse($('website-config').textContent); }
catch (e) { document.body.insertAdjacentHTML('afterbegin', '<p role="alert" style="margin:0;padding:14px;background:#ffd8cc;font-weight:700">website-config JSON tidak valid: ' + String(e.message).replace(/</g, '&lt;') + '</p>'); return; }
const G = CFG.game, PAL = CFG.palette, SIZES = CFG.brushSizes, W = DG.W, H = DG.H;
const local = { get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* private mode */ } } };
let session = null; try { session = window.sessionStorage; } catch (e) { session = null; }
const UI_LANGS = ['id', 'en', 'ms', 'vi', 'th', 'zh'];
function detectLang() {
  const list = (navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || '']).map(x => String(x).toLowerCase());
  for (const l of list) { const m = /^(zh|th|vi|ms|zsm|id|in|en)\b/.exec(l); if (m) return { zsm: 'ms', in: 'id' }[m[1]] || m[1]; }
  return '';
}
let LANG = local.get('dg.lang') || detectLang() || (CFG.site && CFG.site.lang) || 'id'; if (!UI_LANGS.includes(LANG)) LANG = 'id';
/* zh/th/vi/ms texts + word lists ship deflate-compressed in #dg-lang-pack; id/en stay plain so the game works even if decoding fails */
async function inflatePack(b64) {
  const bin = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
  if (window.DecompressionStream) { try { return new TextDecoder().decode(await new Response(new Blob([bin]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer()); } catch (e) { /* fall back */ } }
  return new TextDecoder().decode(DG.inflateRaw(bin));
}
const packReady = (async () => {
  const el = $('dg-lang-pack'), raw = el && el.textContent.trim(); if (!raw || raw.indexOf('LANGPACK') >= 0) return false;
  try { const pack = JSON.parse(await inflatePack(raw)); DG.mergePack(CFG, pack); if (window.JRInvite) for (const l of Object.keys(pack.invite || {})) JRInvite.text[l] = pack.invite[l]; return true; }
  catch (e) { if (window.console) console.warn('lang pack', e); return false; }
})();
if (!CFG.i18n[LANG]) document.documentElement.classList.add('dg-wait');
const FLAG = {
  id: '<path fill="#e70011" d="M0 0h30v10H0z"/><path fill="#fff" d="M0 10h30v10H0z"/>',
  en: '<path fill="#012169" d="M0 0h30v20H0z"/><path stroke="#fff" stroke-width="4" d="M0 0l30 20M30 0L0 20"/><path stroke="#c8102e" stroke-width="1.6" d="M0 0l30 20M30 0L0 20"/><path stroke="#fff" stroke-width="6" d="M15 0v20M0 10h30"/><path stroke="#c8102e" stroke-width="3.4" d="M15 0v20M0 10h30"/>',
  ms: '<path fill="#fff" d="M0 0h30v20H0z"/><path stroke="#cc0001" stroke-width="1.43" d="M0 .7h30M0 3.6h30M0 6.4h30M0 9.3h30M0 12.1h30M0 15h30M0 17.8h30"/><path fill="#010066" d="M0 0h16v11.4H0z"/><circle cx="6.4" cy="5.7" r="3.9" fill="#fc0"/><circle cx="7.5" cy="5.7" r="3.2" fill="#010066"/><path fill="#fc0" d="M12 2.6l.8 2.3 2.4-.2-1.9 1.5 1.9 1.5-2.4-.2-.8 2.3-.8-2.3-2.4.2 1.9-1.5-1.9-1.5 2.4.2z"/>',
  vi: '<path fill="#da251d" d="M0 0h30v20H0z"/><path fill="#ff0" d="M15 4l1.5 4.6h4.8l-3.9 2.8 1.5 4.6-3.9-2.8-3.9 2.8 1.5-4.6-3.9-2.8h4.8z"/>',
  th: '<path fill="#a51931" d="M0 0h30v20H0z"/><path fill="#f4f5f8" d="M0 3.3h30v13.4H0z"/><path fill="#2d2a4a" d="M0 6.7h30v6.6H0z"/>',
  zh: '<path fill="#ee1c25" d="M0 0h30v20H0z"/><path fill="#ff0" d="M5 2l1.2 3.6h3.7l-3 2.2 1.1 3.6L5 9.2l-3 2.2 1.1-3.6-3-2.2h3.7z"/><circle cx="10.5" cy="2.5" r=".8" fill="#ff0"/><circle cx="12" cy="4.5" r=".8" fill="#ff0"/><circle cx="12" cy="7.3" r=".8" fill="#ff0"/><circle cx="10.5" cy="9.3" r=".8" fill="#ff0"/>',
  multi: '<path fill="#2b7de9" d="M0 0h30v20H0z"/><g fill="none" stroke="#fff" stroke-width="1.3"><circle cx="15" cy="10" r="7"/><ellipse cx="15" cy="10" rx="3" ry="7"/><path d="M8 10h14M9.2 6.3h11.6M9.2 13.7h11.6"/></g>'
};
const flag = l => '<svg class="flag" viewBox="0 0 30 20" aria-hidden="true" focusable="false">' + (FLAG[l] || FLAG.multi) + '</svg>';
const langName = l => (l === 'multi' ? t('wordLangMulti') : (CFG.langs && CFG.langs[l]) || l);
const wordLangs = () => UI_LANGS.filter(l => DG.hasLang(CFG, l)).concat(DG.hasLang(CFG, 'multi') ? ['multi'] : []);
const reduced = window.matchMedia ? matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
function t(key, vars) {
  let s = CFG.i18n[LANG] && CFG.i18n[LANG][key]; if (s === undefined) s = CFG.i18n.id[key]; if (s === undefined) return key;
  if (typeof s !== 'string') return s;
  return vars ? s.replace(/\{(\w+)\}/g, (m, k) => (vars[k] !== undefined ? vars[k] : m)) : s;
}
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const cfgPath = p => p.split('.').reduce((o, k) => (o ? o[k] : undefined), CFG);
const AV = ['#ffd23f', '#ff9cbc', '#9be7dc', '#b9c8ff', '#ffc59a', '#c9f5a0', '#e2c4ff', '#ffe08a'];
const avatarColor = id => AV[Math.abs(Number(id) || String(id).length) % AV.length];
const initials = n => Array.from(String(n || '?').trim())[0] ? Array.from(String(n).trim())[0].toUpperCase() : '?';
const fmt = ms => { const s = Math.max(0, Math.ceil(ms / 1000)); return s >= 60 ? Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0') : String(s); };

/* ---------------- toast ---------------- */
let toastTimer;
function toast(msg) { const el = $('toast'); el.textContent = msg; el.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => { el.hidden = true; }, 3600); }
function errMsg(e) {
  if (!e) return t('errGeneric');
  if (e.code === 'offline') return t('errOffline');
  if (e.code === 'disabled') return t('errDisabled');
  if (e.code === 'mismatch') return t('errMismatch');
  if (e.code === 'network') return t('errNetwork');
  if (e.code === 'busy' || e.status === 429) return t('errBusy', { s: e.wait || Math.max(1, Math.ceil(((net.backoffUntil || 0) - Date.now()) / 1000)) });
  if (e.code === 'few') return t('errFew', { n: G.minPlayers });
  if (e.code === 'slow') return t('errSlow');
  if (e.code === 'toolarge' || e.status === 422 && /too large/i.test(e.server || '')) return t('errTooLarge');
  const s = String(e.server || '');
  if (/full/i.test(s)) return t('errFull');
  if (/not open/i.test(s)) return t('errNotOpen');
  if (/closed/i.test(s)) return t('errClosed');
  if (e.status === 404) return t('errNotFound');
  if (e.status === 403 || e.status === 401) return t('errMember');
  if (e.status === 422) return t('errInvalid');
  return t('errGeneric');
}

/* ---------------- player list (compact for big rooms) ---------------- */
const PLIST_COMPACT = 8, FRESH_MS = 120000; let lastPlayers = [], plistSheet = null;
function playerLI(p) {
  return '<li class="' + [p.me ? 'me' : '', p.drawer ? 'drawer' : '', p.ok ? 'ok' : '', p.gone ? 'gone' : ''].join(' ') + '"><span class="avatar" style="background:' + avatarColor(p.id) + '" aria-hidden="true">' + esc(initials(p.name)) + '</span><span class="pname">' + esc(p.name) + (p.gm ? ' <em class="gm-tag">(GM)</em>' : p.me ? ' <em class="gm-badge">(GM)</em>' : '') + (p.fresh ? ' <em class="new-badge">' + esc(t('newBadge')) + '</em>' : '') + (p.handoff ? '<button type="button" class="host-btn" data-act="handoff" data-id="' + esc(p.id) + '" aria-label="' + esc(t('hostGive') + ': ' + p.name) + '">👑\u00a0' + esc(t('hostGive')) + '</button>' : '<small>' + esc([p.me ? '(' + t('you') + ')' : '', p.host ? '★ ' + t('host') : '', p.drawer ? '✎ ' + t('drawing') : '', p.ok ? '✓ ' + t('guessed') : '', p.gone ? t('offline') : ''].filter(Boolean).join(' · ') || ' ') + '</small>') + '</span>' + (p.mark ? '<button type="button" class="mark-btn" data-act="mark" data-id="' + esc(p.id) + '" aria-pressed="' + p.mark.pressed + '" aria-label="' + esc(t('partyMark') + ': ' + p.name) + '">✓</button>' : '') + '<span class="pscore">' + esc(p.score) + '</span></li>';
}
function renderSheet() {
  const rows = lastPlayers.slice().sort((a, b) => b.score - a.score);
  plistSheet.querySelector('h3').textContent = t('playersAll', { n: rows.length });
  plistSheet.querySelector('ol').innerHTML = rows.map(playerLI).join('');
}
function closeSheet() { if (!plistSheet) return; plistSheet.remove(); plistSheet = null; const b = document.querySelector('.plist-more'); if (b) b.focus(); }
function openSheet() {
  if (plistSheet) return;
  plistSheet = document.createElement('div'); plistSheet.className = 'plist-sheet'; plistSheet.setAttribute('role', 'dialog'); plistSheet.setAttribute('aria-modal', 'true');
  plistSheet.innerHTML = '<div class="plist-panel"><div class="plist-head"><h3></h3><button type="button" class="icon-btn" data-close aria-label="' + esc(t('close')) + '">×</button></div><ol class="plist all"></ol></div>';
  plistSheet.addEventListener('click', e => { if (e.target === plistSheet || e.target.closest('[data-close]')) closeSheet(); });
  plistSheet.addEventListener('keydown', e => { if (e.key === 'Escape') closeSheet(); });
  document.body.appendChild(plistSheet); renderSheet(); plistSheet.querySelector('[data-close]').focus();
}

/* ---------------- drawing board ---------------- */
function hexRgb(h) { const m = /^#?([0-9a-f]{6})$/i.exec(h || ''); const n = m ? parseInt(m[1], 16) : 0; return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
const LAG = 1800, units = ops => ops.reduce((n, o) => n + (o[0] === 's' ? (o.length - 3) / 4 : 1), 0), grows = (a, b) => b.length >= a.length && a.every((o, k) => o === b[k] || (k === a.length - 1 && o[0] === 's' && b[k].startsWith(o)));
class Board {
  constructor(cv) {
    this.cv = cv; this.ctx = cv.getContext('2d', { willReadFrequently: true }); this.rendered = []; this.enabled = false; this.localKey = null;
    this.tool = 'brush'; this.color = 1; this.size = 1; this.cur = null; this.onCommit = null; this.blank();
    cv.addEventListener('pointerdown', e => this.down(e));
    cv.addEventListener('pointermove', e => this.move(e));
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(n => cv.addEventListener(n, e => this.up(e)));
  }
  blank() { const c = this.ctx; c.fillStyle = '#ffffff'; c.fillRect(0, 0, W, H); }
  pos(e) { const r = this.cv.getBoundingClientRect(); return [DG.clamp(Math.round((e.clientX - r.left) / r.width * W), 0, W - 1), DG.clamp(Math.round((e.clientY - r.top) / r.height * H), 0, H - 1)]; }
  stroke(op, from, open) {
    const c = this.ctx, p = op.pts, col = PAL[op.c] || '#1d2340', w = SIZES[op.z] || 7;
    c.lineCap = 'round'; c.lineJoin = 'round'; c.strokeStyle = col; c.fillStyle = col; c.lineWidth = w;
    if (p.length === 1) { c.beginPath(); c.arc(p[0][0], p[0][1], w / 2, 0, Math.PI * 2); c.fill(); return; }
    // smooth: quadratic curves through segment midpoints (raw samples are the control points); open = live preview, tail drawn on finish
    const n = p.length, s = Math.min(n, Math.max(1, from || 0)), m = i => [(p[i - 1][0] + p[i][0]) / 2, (p[i - 1][1] + p[i][1]) / 2];
    c.beginPath(); c.moveTo(...(s < 2 ? p[0] : m(s - 1)));
    for (let i = s; i < n; i++) i < 2 ? c.lineTo(...m(1)) : c.quadraticCurveTo(...p[i - 1], ...m(i));
    if (!open) c.lineTo(...p[n - 1]); c.stroke();
  }
  flood(x, y, hex) {
    const c = this.ctx, img = c.getImageData(0, 0, W, H), d = img.data, n = W * H, rgb = hexRgb(hex), i0 = (y * W + x) * 4;
    const tr = d[i0], tg = d[i0 + 1], tb = d[i0 + 2];
    if (Math.abs(tr - rgb[0]) + Math.abs(tg - rgb[1]) + Math.abs(tb - rgb[2]) < 10) return;
    const seen = new Uint8Array(n), stack = [y * W + x]; seen[y * W + x] = 1;
    const match = p => { const j = p * 4; return Math.abs(d[j] - tr) + Math.abs(d[j + 1] - tg) + Math.abs(d[j + 2] - tb) <= 110; };
    const visit = q => { if (!seen[q]) { if (match(q)) { seen[q] = 1; stack.push(q); } else seen[q] = 2; } };
    while (stack.length) { const p = stack.pop(), px = p % W; if (px > 0) visit(p - 1); if (px < W - 1) visit(p + 1); if (p >= W) visit(p - W); if (p < n - W) visit(p + W); }
    for (let p = 0; p < n; p++) if (seen[p]) { const j = p * 4; d[j] = rgb[0]; d[j + 1] = rgb[1]; d[j + 2] = rgb[2]; d[j + 3] = 255; } // boundary pixels too: hides anti-alias halos
    c.putImageData(img, 0, 0);
  }
  apply(str, from) { const op = DG.decodeOp(str); if (!op) return; if (op.t === 's') this.stroke(op, from || 0); else this.flood(op.x, op.y, PAL[op.c] || '#1d2340'); }
  setOps(ops) { this.blank(); ops = ops || []; for (const o of ops) this.apply(o); this.rendered = ops.slice(); }
  sync(ops) {
    ops = ops || []; const r = this.rendered; let k = 0;
    while (k < r.length && k < ops.length && r[k] === ops[k]) k++;
    if (k === r.length) { for (let i = k; i < ops.length; i++) this.apply(ops[i]); this.rendered = ops.slice(); return; }
    if (k === r.length - 1 && k < ops.length && r[k][0] === 's' && ops[k].startsWith(r[k])) { this.apply(ops[k], (r[k].length - 3) / 4); for (let i = k + 1; i < ops.length; i++) this.apply(ops[i]); this.rendered = ops.slice(); return; }
    this.setOps(ops);
  }
  // viewerDelay: online spectators replay polled stroke chunks ~LAG ms behind arrival, spread over time (smooth instead of jumpy)
  viewerDelay(ops) {
    ops = ops || []; const now = performance.now(), P = this.pb, n = units(ops);
    if (!P || !grows(P.T, ops)) { this.setOps(ops); const o = ops[ops.length - 1]; this.pb = { T: ops.slice(), c: [[now, n]], d: n, i: Math.max(0, ops.length - 1), j: o ? units([o]) : 0 }; return; }
    if (n > P.c[P.c.length - 1][1]) P.c.push([now, n]);
    P.T = ops.slice(); if (!this.raf) this.raf = requestAnimationFrame(t => this.step(t));
  }
  step(t) {
    this.raf = 0; const P = this.pb; if (!P) return; const c = P.c; let D = c[0][1];
    for (let k = 1; k < c.length; k++) { const e = c[k][0] + LAG, s = Math.max(c[k - 1][0] + LAG, c[k][0]); if (t >= e) { D = c[k][1]; continue; } if (t > s) D = c[k - 1][1] + (c[k][1] - c[k - 1][1]) * (t - s) / (e - s); break; }
    while (c.length > 1 && t >= c[1][0] + LAG) c.shift();
    this.adv(Math.floor(D)); if (c.length > 1) this.raf = requestAnimationFrame(x => this.step(x));
  }
  adv(D) {
    const P = this.pb, T = P.T;
    while (P.d < D && P.i < T.length) {
      const o = T[P.i], u = units([o]);
      if (P.j >= u) { if (P.i === T.length - 1) break; if (o[0] === 's') this.apply(o, u); P.i++; P.j = 0; continue; }
      const k = Math.min(u, P.j + D - P.d);
      if (o[0] === 's') this.stroke(DG.decodeOp(o.slice(0, 3 + 4 * k)), P.j, 1); else this.apply(o);
      P.d += k - P.j; P.j = k;
    }
    const o = T[P.i]; this.rendered = T.slice(0, P.i).concat(P.j ? [P.j >= units([o]) ? o : o.slice(0, 3 + 4 * P.j)] : []);
  }
  flush() { const P = this.pb; if (!P) return; this.adv(1e9); const o = P.T[P.i]; if (o && o[0] === 's') this.apply(o, units([o])); this.pb = null; }
  down(e) {
    if (!this.enabled || (e.button !== undefined && e.button > 0)) return; e.preventDefault();
    const p = this.pos(e);
    if (this.tool === 'fill') { const op = DG.encodeFill(this.color, p[0], p[1]); if (!this.onCommit || this.onCommit(op) !== false) { this.apply(op); this.rendered.push(op); } return; }
    try { this.cv.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    this.cur = { c: this.tool === 'eraser' ? 0 : this.color, z: this.size, pts: [p], id: e.pointerId };
    this.stroke({ c: this.cur.c, z: this.cur.z, pts: [p] }, 0);
  }
  move(e) {
    if (!this.cur || e.pointerId !== this.cur.id) return;
    const list = e.getCoalescedEvents ? e.getCoalescedEvents() : []; const evs = list.length ? list : [e];
    for (const ev of evs) {
      const q = this.pos(ev), pts = this.cur.pts, l = pts[pts.length - 1];
      if (Math.hypot(q[0] - l[0], q[1] - l[1]) < 2.5) continue;
      pts.push(q); this.stroke({ c: this.cur.c, z: this.cur.z, pts }, pts.length - 1, 1);
      if (pts.length >= 1200) { const keep = { c: this.cur.c, z: this.cur.z, id: this.cur.id }; this.finish(); this.cur = Object.assign(keep, { pts: [q] }); }
    }
  }
  up(e) { if (!this.cur || (e.pointerId !== undefined && e.pointerId !== this.cur.id)) return; this.finish(); }
  finish() { const cur = this.cur; this.cur = null; if (!cur) return; this.stroke(cur, cur.pts.length); const op = DG.encodeStroke(cur.c, cur.z, cur.pts); if (this.onCommit && this.onCommit(op) === false) { this.setOps(this.rendered); return; } this.rendered.push(op); }
  cancel() { if (this.cur) { this.cur = null; this.setOps(this.rendered); } }
  liveOp() { return this.cur ? DG.encodeStroke(this.cur.c, this.cur.z, this.cur.pts) : null; }
}

/* ---------------- built-in doodles (simple shapes drawn by this page) ---------------- */
const TAU = Math.PI * 2;
const arc = (cx, cy, r, a0 = 0, a1 = TAU, n = 32, ry = r) => { const p = []; for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * i / n; p.push([cx + Math.cos(a) * r, cy + Math.sin(a) * ry]); } return p; };
const wave = (x0, x1, y, amp, n = 4) => { const p = []; for (let i = 0; i <= 40; i++) { const x = x0 + (x1 - x0) * i / 40; p.push([x, y + Math.sin(i / 40 * n * TAU) * amp]); } return p; };
const S = (c, z, pts) => ({ c, z, pts });
const DOODLES = {
  sun: () => [S(5, 2, arc(400, 300, 110))].concat(Array.from({ length: 8 }, (_, k) => { const a = k * Math.PI / 4; return S(5, 2, [[400 + Math.cos(a) * 140, 300 + Math.sin(a) * 140], [400 + Math.cos(a) * 200, 300 + Math.sin(a) * 200]]); }), [S(1, 3, [[362, 272]]), S(1, 3, [[438, 272]]), S(1, 2, arc(400, 300, 52, 0.2 * Math.PI, 0.8 * Math.PI, 14))]),
  house: () => [S(1, 2, [[250, 300], [250, 500], [550, 500], [550, 300], [250, 300]]), S(4, 2, [[215, 315], [400, 150], [585, 315]]), S(7, 2, [[370, 500], [370, 400], [430, 400], [430, 500]]), S(10, 2, [[280, 340], [340, 340], [340, 390], [280, 390], [280, 340]]), S(10, 2, [[460, 340], [520, 340], [520, 390], [460, 390], [460, 340]])],
  fish: () => [S(10, 2, arc(380, 300, 160, 0, TAU, 40, 90)), S(10, 2, [[538, 300], [640, 220], [640, 380], [538, 300]]), S(1, 3, [[290, 280]]), S(10, 2, [[350, 212], [410, 160], [450, 216]]), S(1, 1, [[226, 312], [250, 322]])],
  tree: () => [S(7, 3, [[370, 520], [370, 370]]), S(7, 3, [[430, 520], [430, 370]]), S(8, 2, arc(400, 270, 115)), S(8, 2, arc(300, 320, 70)), S(8, 2, arc(500, 320, 70)), S(9, 2, [[200, 522], [600, 522]])],
  star: () => { const p = []; for (let i = 0; i <= 10; i++) { const r = i % 2 ? 85 : 210, a = -Math.PI / 2 + i * Math.PI / 5; p.push([400 + Math.cos(a) * r, 310 + Math.sin(a) * r]); } return [S(6, 3, p)]; },
  umbrella: () => [S(4, 2, arc(400, 300, 200, Math.PI, TAU, 32))].concat([0, 1, 2, 3].map(k => S(4, 2, arc(250 + k * 100, 300, 50, Math.PI, TAU, 12, 22))), [S(1, 3, [[400, 280], [400, 500]]), S(1, 3, arc(370, 500, 30, 0, Math.PI, 12))]),
  cup: () => [S(1, 2, arc(390, 250, 110, 0, TAU, 32, 22)), S(1, 2, [[280, 250], [302, 480], [478, 480], [500, 250]]), S(1, 2, arc(505, 355, 52, -Math.PI / 2, Math.PI / 2, 16)), S(2, 1, [[340, 200], [330, 170], [350, 140], [340, 110]]), S(2, 1, [[400, 200], [390, 165], [410, 130], [400, 95]]), S(2, 1, [[455, 200], [445, 170], [465, 140], [455, 110]])],
  mountain: () => [S(1, 2, [[100, 480], [300, 180], [420, 360], [520, 240], [700, 480]]), S(10, 2, [[252, 252], [278, 272], [300, 246], [324, 266], [346, 250]]), S(6, 2, arc(640, 140, 48)), S(9, 2, [[80, 482], [720, 482]])],
  boat: () => [S(7, 3, [[220, 380], [580, 380], [520, 460], [280, 460], [220, 380]]), S(1, 2, [[400, 380], [400, 150]]), S(4, 2, [[408, 165], [408, 360], [545, 360], [408, 165]]), S(10, 2, wave(150, 650, 505, 10, 5))],
  flower: () => [S(6, 3, arc(400, 250, 38))].concat(Array.from({ length: 6 }, (_, k) => { const a = k * TAU / 6; return S(13, 2, arc(400 + Math.cos(a) * 82, 250 + Math.sin(a) * 82, 42, 0, TAU, 20)); }), [S(8, 3, [[400, 292], [400, 540]]), S(8, 2, [[400, 455], [470, 405], [482, 445], [400, 455]])]),
  clock: () => [S(1, 3, arc(400, 300, 180, 0, TAU, 44))].concat(Array.from({ length: 12 }, (_, k) => { const a = k * TAU / 12; return S(1, 1, [[400 + Math.cos(a) * 150, 300 + Math.sin(a) * 150], [400 + Math.cos(a) * 168, 300 + Math.sin(a) * 168]]); }), [S(1, 3, [[400, 300], [400, 185]]), S(4, 2, [[400, 300], [492, 300]]), S(1, 4, [[400, 300]])]),
  heart: () => { const p = []; for (let i = 0; i <= 48; i++) { const a = i / 48 * TAU, x = 16 * Math.pow(Math.sin(a), 3), y = 13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a); p.push([400 + x * 12, 290 - y * 12]); } return [S(4, 3, p)]; }
};
const doodleOps = id => DOODLES[id]().map(s => ({ c: s.c, z: s.z, pts: s.pts.map(p => [Math.round(p[0]), Math.round(p[1])]) }));

/* ---------------- shared UI state ---------------- */
const board = new Board($('board'));
let mode = null;
const RT = Object.assign({ mode: 'socket', reconnectMaxSeconds: 15 }, CFG.realtime || {});
const net = new DG.Connection({ storage: session, reconnectMaxMs: RT.reconnectMaxSeconds * 1000, onWake: () => { if (mode && mode.kind === 'online') mode.wake(); }, onSocket: () => { updateConn(); requestRender(); }, lobbyWake: () => scheduleRooms() });
board.onCommit = op => (mode && mode.commit ? mode.commit(op) : false);

/* chat autoscroll (t360u): follow new lines unless the reader scrolled up on purpose; own messages always jump down */
let chatStick = true, chatRaf = 0;
function chatGap(c) { return c.scrollHeight - c.scrollTop - c.clientHeight; }
function chatToBottom(force) { const c = $('chat'); if (!c) return; if (force) chatStick = true; if (chatStick) c.scrollTop = c.scrollHeight; }
function chatStickSoon(force) { if (force) chatStick = true; chatToBottom(); cancelAnimationFrame(chatRaf); chatRaf = requestAnimationFrame(() => { chatToBottom(); chatRaf = requestAnimationFrame(() => chatToBottom()); }); }
$('chat').addEventListener('scroll', () => { const c = $('chat'); if (c.clientHeight) chatStick = chatGap(c) < Math.max(40, Math.min(110, c.clientHeight * 0.75)); }, { passive: true });
if (window.ResizeObserver) new ResizeObserver(() => chatToBottom()).observe($('chat'));
function setHTML(el, html) {
  if (el._h === html) return false;
  const a = document.activeElement, keep = a && el.contains(a) && a.id ? { id: a.id, value: a.value, start: a.selectionStart, end: a.selectionEnd, tag: a.tagName } : null;
  el.innerHTML = html; el._h = html;
  if (keep) { const n = document.getElementById(keep.id); if (n) { if (keep.tag === 'TEXTAREA' || (keep.tag === 'INPUT' && n.type === 'text')) { n.value = keep.value; try { n.setSelectionRange(keep.start, keep.end); } catch (e) { /* ignore */ } } n.focus({ preventScroll: true }); } }
  return true;
}
function slotsHTML(text, word) {
  const words = String(text).split(' ');
  return '<span class="slots' + (word ? ' word' : '') + '" aria-hidden="true">' + words.map(w => '<span class="w">' + DG.units(w).map(ch => '<i' + (/^[\p{L}\p{N}_]/u.test(ch) ? '' : ' class="sym"') + '>' + (ch === '_' ? '' : esc(ch)) + '</i>').join('') + '</span>').join('') + '</span>';
}
function hintSR(text) { return DG.units(String(text)).map(ch => ch === '_' ? '_' : ch).join(' '); }

/* ---------------- tools ---------------- */
function buildTools() {
  const sw = PAL.map((c, i) => '<button type="button" class="swatch" data-color="' + i + '" style="background:' + esc(c) + '" aria-label="' + esc(t('color', { n: i + 1 })) + '" aria-pressed="false"></button>').join('');
  const sz = SIZES.map((s, i) => '<button type="button" class="tbtn" data-size="' + i + '" aria-label="' + esc(t('size', { n: i + 1 })) + '" aria-pressed="false"><span class="size-dot" style="width:' + Math.max(4, Math.min(24, s * 0.6)) + 'px;height:' + Math.max(4, Math.min(24, s * 0.6)) + 'px"></span></button>').join('');
  $('tools').setAttribute('aria-label', t('tools'));
  $('tools').innerHTML = '<div class="tool-group" role="group" aria-label="' + esc(t('tools')) + '">' +
    '<button type="button" class="tbtn" data-tool="brush" aria-pressed="false"><span class="ico brush" aria-hidden="true"></span><span class="lbl">' + esc(t('brush')) + '</span></button>' +
    '<button type="button" class="tbtn" data-tool="eraser" aria-pressed="false"><span class="ico eraser" aria-hidden="true"></span><span class="lbl">' + esc(t('eraser')) + '</span></button>' +
    '<button type="button" class="tbtn" data-tool="fill" aria-pressed="false"><span class="ico fill" aria-hidden="true"></span><span class="lbl">' + esc(t('fill')) + '</span></button></div>' +
    '<div class="tool-group" role="group">' + sz + '</div><div class="tool-group" role="group">' + sw + '</div>' +
    '<div class="tool-group"><button type="button" class="tbtn" data-op="undo">↶ <span class="lbl">' + esc(t('undo')) + '</span></button><button type="button" class="tbtn" data-op="clear">✕ <span class="lbl">' + esc(t('clear')) + '</span></button></div>' +
    '<p class="hint-keys">' + esc(t('shortcuts')) + '</p>';
  syncTools();
}
function syncTools() {
  document.querySelectorAll('#tools [data-tool]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.tool === board.tool)));
  document.querySelectorAll('#tools [data-size]').forEach(b => b.setAttribute('aria-pressed', String(Number(b.dataset.size) === board.size)));
  document.querySelectorAll('#tools [data-color]').forEach(b => b.setAttribute('aria-pressed', String(Number(b.dataset.color) === board.color)));
}
$('tools').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  if (b.dataset.tool) board.tool = b.dataset.tool;
  if (b.dataset.size) board.size = Number(b.dataset.size);
  if (b.dataset.color) { board.color = Number(b.dataset.color); if (board.tool === 'eraser') board.tool = 'brush'; }
  if (b.dataset.op === 'undo' && mode && mode.undo) mode.undo();
  if (b.dataset.op === 'clear' && mode && mode.clear) mode.clear();
  syncTools();
});
document.addEventListener('keydown', e => {
  if ($('game').hidden || !board.enabled) return;
  const tag = (e.target && e.target.tagName) || ''; if (/INPUT|TEXTAREA|SELECT/.test(tag)) return;
  const k = e.key.toLowerCase();
  if ((e.ctrlKey || e.metaKey) && k === 'z') { e.preventDefault(); if (mode && mode.undo) mode.undo(); return; }
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if (k === 'b') board.tool = 'brush'; else if (k === 'e') board.tool = 'eraser'; else if (k === 'f') board.tool = 'fill';
  else if (k === '[') board.size = Math.max(0, board.size - 1); else if (k === ']') board.size = Math.min(SIZES.length - 1, board.size + 1); else return;
  syncTools();
});

/* ---------------- game screen rendering ---------------- */
let raf = 0;
function requestRender() { if (!raf) raf = requestAnimationFrame(() => { raf = 0; render(); }); }
function render() {
  gmMeSync();
  if (!mode || $('game').hidden) return;
  const v = mode.view();
  $('gameTitle').textContent = v.title || ''; $('gameSub').textContent = v.sub || '';
  const timer = $('timer');
  if (v.timer) { const left = Math.max(0, v.timer.left), p = v.timer.total ? DG.clamp(left / v.timer.total, 0, 1) : 0; timer.hidden = false; timer.style.setProperty('--p', p.toFixed(3)); timer.classList.toggle('low', left <= 10000); $('timerText').textContent = fmt(left); timer.setAttribute('aria-label', fmt(left)); }
  else { timer.style.setProperty('--p', '0'); $('timerText').textContent = '–'; timer.classList.remove('low'); }
  let hint = '';
  if (v.hint && v.hint.type === 'mask') hint = '<span class="label">' + esc(t('letters', { n: DG.letterCount(v.hint.text.replace(/_/g, 'x')) })) + '</span>' + slotsHTML(v.hint.text) + '<span class="sr-only">' + esc(hintSR(v.hint.text)) + '</span>';
  else if (v.hint && v.hint.type === 'word') hint = '<span class="label">' + esc(v.hint.label || '') + '</span>' + slotsHTML(v.hint.text, true) + '<span class="sr-only">' + esc(v.hint.text) + '</span>';
  else if (v.hint && v.hint.type === 'text') hint = '<span class="label" style="font-size:.95rem;text-transform:none;letter-spacing:0">' + esc(v.hint.text) + '</span>';
  setHTML($('hint'), hint || '<span class="label">&nbsp;</span>');
  const players = v.players || [], many = players.length > PLIST_COMPACT;
  let shown = players;
  if (many) { // big rooms: drawer + you + top scores (seat order kept), the rest behind "+N" (full list in a sheet)
    const pick = new Set(players.filter(p => p.drawer || p.me).map(p => p.id));
    for (const p of players.slice().sort((a, b) => b.score - a.score)) { if (pick.size >= PLIST_COMPACT - 1) break; pick.add(p.id); }
    shown = players.filter(p => pick.has(p.id));
  }
  setHTML($('plist'), shown.map(playerLI).join('') + (many ? '<li class="more"><button type="button" class="plist-more" data-act="plist-more" aria-haspopup="dialog">' + esc(t('playersMore', { n: players.length - shown.length })) + '</button></li>' : ''));
  lastPlayers = players; if (plistSheet) renderSheet();
  $('specCount').textContent = v.spec || '';
  const noPlayers = !(v.players && v.players.length);
  document.querySelector('.g-players').hidden = noPlayers;
  // keep the grid template in sync: a hidden panel must not leave the board in the 200px players column
  document.querySelector('.g-body').classList.toggle('no-players', noPlayers);
  $('chatTitle').hidden = !v.chat;
  document.querySelector('.g-body').classList.toggle('has-chat', !!v.chat);
  const tg = $('chatToggle'); tg.hidden = !v.chat; if (!v.chat && root.classList.contains('dg-chat-open')) setChatOpen(false); else syncChatToggle();
  const chat = $('chat'), wasHidden = chat.hidden;
  chat.hidden = !v.chat;
  // t360u: stickiness comes from the reader's own scrolling (chatStick), not from a gap measured now (layout shifts broke that)
  if (v.chat && (setHTML(chat, v.chat.map(c => '<li class="' + esc(c.cls || '') + '">' + c.html + '</li>').join('')) || wasHidden)) chatStickSoon();
  const form = $('chatForm'), input = $('chatInput'); form.hidden = !v.chatMode || v.chatMode === 'none';
  const off = v.chatMode === 'off'; input.disabled = off; form.querySelector('button').disabled = off;
  input.placeholder = v.chatMode === 'chat' ? t('chatPlaceholderChat') : t('chatPlaceholder');
  $('chatNote').textContent = v.chatNote || '';
  setHTML($('sideActions'), v.side || '');
  const stage = $('stage');
  if (v.stage) { stage.hidden = false; setHTML(stage, v.stage); } else { stage.hidden = true; setHTML(stage, ''); }
  document.querySelector('.g-body').classList.toggle('has-stage', !!v.stage);
  const cnt = $('stageCount'); if (cnt && v.stageCount !== undefined) cnt.textContent = fmt(v.stageCount);
  const rc = $('revealCount');
  if (rc && v.revealCount !== undefined) { const n = String(Math.max(0, Math.ceil(v.revealCount / 1000))); if (rc.textContent !== n) { rc.textContent = n; rc.setAttribute('aria-label', t('seconds', { n })); rc.classList.remove('tick'); void rc.offsetWidth; rc.classList.add('tick'); } }
  const d = v.draw || { mode: 'view', ops: [] };
  if (d.mode === 'local') { board.pb = null; if (board.localKey !== d.key) { board.cancel(); board.setOps(d.ops); board.localKey = d.key; } board.enabled = true; }
  else { if (board.cur) board.cancel(); board.enabled = false; board.localKey = null; if (d.lag) board.viewerDelay(d.ops); else { board.flush(); board.sync(d.ops); } }
  $('board').classList.toggle('can-draw', board.enabled);
  $('board').setAttribute('aria-label', board.enabled ? t('canvasLabel') : t('canvasViewLabel'));
  $('tools').hidden = !board.enabled;
}
setInterval(() => { if (mode && mode.tick) mode.tick(); render(); }, 250);

$('stage').addEventListener('click', e => { const b = e.target.closest('[data-act]'); if (b && mode && mode.act) mode.act(b.dataset.act, b); });
$('sideActions').addEventListener('click', e => { const b = e.target.closest('[data-act]'); if (b && mode && mode.act) mode.act(b.dataset.act, b); });
$('plist').addEventListener('click', e => { const b = e.target.closest('[data-act]'); if (!b) return; if (b.dataset.act === 'plist-more') { openSheet(); return; } if (mode && mode.act) mode.act(b.dataset.act, b); });
$('stage').addEventListener('change', e => { const el = e.target.closest('[data-set]'); if (el && mode && mode.setting) mode.setting(el.dataset.set, el.value); });
$('chatForm').addEventListener('submit', async e => {
  e.preventDefault(); const input = $('chatInput'), text = input.value.trim(); if (!text || !mode || !mode.say) return;
  input.value = ''; chatStickSoon(true);
  try { await mode.say(text); } catch (err) { toast(errMsg(err)); }
  chatStick = true; requestRender(); chatStickSoon(true);
});
// press-and-hold peek (party mode)
['pointerdown', 'keydown'].forEach(n => $('sideActions').addEventListener(n, e => { if (e.target.closest('#peekBtn') && (n === 'pointerdown' || e.key === ' ' || e.key === 'Enter')) { e.preventDefault(); if (mode) mode.peek = true; } }));
['pointerup', 'pointerleave', 'pointercancel', 'keyup', 'focusout'].forEach(n => $('sideActions').addEventListener(n, e => { if (e.target.closest && e.target.closest('#peekBtn') && mode) mode.peek = false; }));
$('exitBtn').addEventListener('click', () => { if (mode && mode.exit) mode.exit(); else showHome(); });

/* mobile play screen: size the game to the visual viewport (keyboard aware); chat expand toggle */
const root = document.documentElement;
function fitViewport() {
  const vv = window.visualViewport, h = vv ? vv.height : window.innerHeight, top = vv ? Math.max(0, vv.offsetTop) : 0;
  root.style.setProperty('--dg-vh', Math.round(h) + 'px'); root.style.setProperty('--dg-vt', Math.round(top) + 'px');
  root.classList.toggle('dg-short', h < 560);
  if (root.classList.contains('dg-play')) chatToBottom();
}
if (window.visualViewport) { visualViewport.addEventListener('resize', fitViewport); visualViewport.addEventListener('scroll', fitViewport); }
window.addEventListener('resize', fitViewport); window.addEventListener('orientationchange', fitViewport);
function syncChatToggle() { const open = root.classList.contains('dg-chat-open'), tg = $('chatToggle'), label = t(open ? 'chatCollapse' : 'chatExpand'); if (tg.textContent !== label) tg.textContent = label; tg.setAttribute('aria-expanded', String(open)); }
function setChatOpen(open) { root.classList.toggle('dg-chat-open', !!open); syncChatToggle(); chatStickSoon(true); }
$('chatToggle').addEventListener('click', () => setChatOpen(!root.classList.contains('dg-chat-open')));
$('chatInput').addEventListener('focus', () => { chatStickSoon(true); setTimeout(() => chatStickSoon(), 250); });
function showGame(m) {
  root.classList.add('dg-play'); chatStick = true; fitViewport();
  mode = m; board.localKey = null; board.rendered = []; board.blank(); board.tool = 'brush'; board.color = 1; board.size = 1;
  $('home').hidden = true; $('game').hidden = false; $('siteNav').hidden = true; buildTools(); render(); chatStickSoon(true);
  window.scrollTo(0, 0); $('gameTitle').setAttribute('tabindex', '-1'); $('gameTitle').focus({ preventScroll: true });
}
function showHome() {
  closeSheet();
  root.classList.remove('dg-play', 'dg-chat-open');
  mode = null; board.enabled = false; $('game').hidden = true; $('home').hidden = false; $('siteNav').hidden = false; $('chatInput').value = '';
  const target = $('play'); if (target) target.scrollIntoView({ block: 'start' });
  gmMeSync(); loadRooms(); updateConn();
}
function stageCard(inner) { return '<div class="stage-card">' + inner + '</div>'; }
/* Pause between turns: big ticking number (filled in by render() from v.revealCount so every client counts down to the same deadline). */
function nextCountHTML(key) { return '<div class="next-count" role="timer" aria-live="off"><span class="nc-lbl">' + esc(t(key)) + '</span><b class="nc-num" id="revealCount" aria-live="off">&nbsp;</b></div>'; }
function podiumHTML(rows) {
  // columns by position (1st centre, 2nd left, 3rd right); medal/height by actual place so ties look tied
  const top = [1, 2, 3].map(pl => rows.filter(r => r.place === pl)[0] || rows[pl - 1]).map((r, i) => r
    ? '<div class="pod pos' + (i + 1) + ' r' + Math.min(r.place, 3) + '"><span class="pod-name" title="' + esc(r.name) + '">' + esc(r.name) + '</span><div class="pod-step"><b>' + r.place + '</b><span class="pod-score">' + esc(r.score) + '</span></div></div>'
    : '<div class="pod pos' + (i + 1) + ' r' + (i + 1) + ' empty"><span class="pod-name"></span><div class="pod-step"><b>' + (i + 1) + '</b><span class="pod-score">–</span></div></div>').join('');
  return '<div class="podium" aria-hidden="true">' + top + '</div><ol class="gains final">' + rows.map(r => '<li><span class="g-name">' + r.place + '. ' + esc(r.name) + '</span><span class="g-pts">' + esc(t('points', { n: r.score })) + '</span></li>').join('') + '</ol>';
}
function rankRows(players) { const rows = players.map(p => ({ id: p.id, name: p.name, score: p.score })).sort((a, b) => b.score - a.score); let place = 0, last = null; rows.forEach((r, i) => { if (r.score !== last) { place = i + 1; last = r.score; } r.place = place; }); return rows; }
function choicesHTML(list) { return '<div class="choices">' + list.map((w, i) => '<button type="button" class="btn yellow" data-act="pick" data-i="' + i + '">' + esc(w) + '</button>').join('') + '</div>'; }
function savePNG() { $('board').toBlob(b => { if (!b) return; const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = 'corat-coret.png'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); }, 'image/png'); }

/* ================= ONLINE MODE ================= */
class OnlineMode {
  constructor(game) { this.kind = 'online'; this.game = game; this.lastSafety = 0; }
  wake() { this.game.refresh().catch(onlineError); }
  tick() {
    const g = this.game; if (!g.data) return;
    if (board.cur && g.canDraw()) { const live = board.liveOp(); if (live !== this.lastLive) { this.lastLive = live; g.setLive(live); } }
    g.tick(); // local deadlines only (writes); no periodic reads — updates arrive via Reverb wakeups
  }
  name(id) { const g = this.game, p = g.players().find(x => x.id === id); return p ? p.displayName : (g.s.names && g.s.names[id]) || '—'; }
  commit(op) { const ok = this.game.commit(op); if (!ok && this.game.full) toast(t('canvasFull')); return ok; }
  undo() { this.game.undo(); board.setOps(this.game.localOps); }
  clear() { this.game.clearDrawing(); board.setOps([]); }
  say(text) { return this.game.say(text); }
  setting(key, value) { this.game.settings({ [key]: value }).catch(e => toast(errMsg(e))); }
  async exit() { if (!confirm(t('exitConfirm'))) return; try { await this.game.leave(); } catch (e) { /* ignore */ } showHome(); }
  act(name, el) {
    const g = this.game;
    if (name === 'pick') g.pick(Number(el.dataset.i)).catch(e => toast(errMsg(e)));
    else if (name === 'start') g.start().catch(e => toast(errMsg(e)));
    else if (name === 'rematch') g.rematch().catch(e => toast(errMsg(e)));
    else if (name === 'handoff') { el.disabled = true; g.transferHost(el.dataset.id).then(r => { if (!r || r.state.hostId === g.me) toast(t('hostMoveFail')); }, e => toast(errMsg(e))); }
    else if (name === 'copy') copyInvite(g.data.code, g.s.settings && g.s.settings.lang);
    else if (name === 'home') { g.leave().finally(showHome); }
    else if (name === 'custom') this.setting('custom', ($('stCustom') || {}).value || '');
  }
  view() {
    const g = this.game, d = g.data;
    if (!d) return { title: '…', chat: [], chatMode: 'off' };
    const s = g.s, me = g.me, now = g.now(), turn = s.turn, isDrawer = g.isDrawer(), phase = s.phase || 'lobby';
    const seatedList = g.liveSeated(), secret = d.private && d.private.turn && turn && d.private.turn.id === turn.id ? d.private.turn.word : null;
    const v = { title: t('roomTitle', { code: d.code }), sub: (phase === 'lobby' ? t('lobbyTitle') : t('roundOf', { r: s.round || 1, n: s.rounds || s.settings.rounds })) + (d.spectator ? ' · ' + t('spectatorBadge') : '') };
    if (net.state === 'reconnecting') v.sub += ' · ⚠ ' + t('connReconnecting');
    if (turn && phase === 'choosing') v.timer = { left: turn.until - now, total: G.chooseSeconds * 1000 };
    if (turn && phase === 'drawing') v.timer = { left: turn.until - now, total: turn.total };
    const multi = s.settings && s.settings.lang === 'multi', shown = w => (w && typeof w === 'object' ? DG.wordFor(w, multi ? LANG : s.settings.lang) : w);
    const revealed = turn && (turn.words || turn.word), revealWord = shown(revealed);
    if (phase === 'drawing') v.hint = isDrawer && secret ? { type: 'word', text: shown(secret), label: t('yourWord') } : { type: 'mask', text: DG.hintFor(turn, LANG) };
    else if (phase === 'reveal' && revealWord) v.hint = { type: 'word', text: revealWord, label: t('revealTitle') };
    else if (phase === 'choosing') v.hint = { type: 'text', text: t('msgChoosing', { name: this.name(turn.drawer) }) };
    else if (phase === 'lobby') v.hint = { type: 'text', text: t(d.visibility === 'private' ? 'lobbyCountPrivate' : 'lobbyCount', { n: seatedList.length, max: d.maxPlayers, min: G.minPlayers }) };
    // live seats only (gone seats leave the list); podium adds departed scorers not back under the same name
    const ids = seatedList.map(p => p.id), handoff = g.isHost() && phase === 'lobby' && d.status !== 'closed';
    if (this.lastHost !== undefined && this.lastHost !== s.hostId && phase === 'lobby') { if (s.hostId === me) toast('👑 ' + t('hostYou')); else if (this.lastHost === me) toast(t('msgHost', { name: this.name(s.hostId) })); }
    this.lastHost = s.hostId;
    const row = id => { const p = seatedList.find(x => x.id === id); return { id, name: p ? p.displayName : this.name(id), score: (s.scores && s.scores[id]) || 0, me: id === me, gm: g.isGamemaster(id), host: s.hostId === id, drawer: !!(turn && turn.drawer === id && ['choosing', 'drawing'].includes(phase)), ok: !!(turn && phase === 'drawing' && turn.guessed && turn.guessed[id]), gone: !p, handoff: handoff && id !== me && !!p, fresh: !!(s.joined && s.joined[id] && now - s.joined[id] < FRESH_MS && !['lobby', 'over'].includes(phase)) }; };
    v.players = ids.map(row);
    const liveNames = new Set(v.players.map(p => String(p.name).trim().toLowerCase()));
    const podium = v.players.concat(Object.keys(s.scores || {}).map(Number).filter(id => !ids.includes(id) && (s.scores[id] || 0) > 0).map(row).filter(p => !liveNames.has(String(p.name).trim().toLowerCase())));
    const specs = d.players.filter(p => p.spectator).length; v.spec = specs ? t('spectatorsCount', { n: specs }) : '';
    // chat
    const ctx = { me, name: id => this.name(id), mine: i => g.myGuesses.get(i) };
    v.chat = (s.chat || []).map(c => chatLine(c, ctx)).filter(Boolean).concat(phase === 'drawing' ? g.pendingGuesses().map(p => ({ cls: 'pending', html: '<b>' + esc(this.name(me)) + ':</b> ' + esc(p.t) + ' <small>' + esc(t('msgPending')) + '</small>' })) : []);
    const cm = g.chatMode(); v.chatMode = cm;
    v.chatNote = cm === 'off' ? (d.spectator ? t('chatOffSpectator') : isDrawer ? t('chatOffDrawer') : '') : cm === 'guessed' ? t('chatGuessed') : (phase === 'drawing' ? (turn.secure ? t('secureOn') : t('secureOff')) : '');
    if (isDrawer && phase === 'drawing' && multi && secret && typeof secret === 'object') v.chatNote = '🌐 ' + t('otherLangs') + ': ' + [...new Set(UI_LANGS.filter(l => l !== LANG && secret[l] && secret[l] !== secret[LANG]).map(l => secret[l]))].join(' · ');
    if (isDrawer && phase === 'drawing' && turn.emptyAt && !turn.drew && g.drewFor !== turn.id && !g.drawOps().length) { const w = emptyWarnNote(turn.emptyAt - (Number(G.emptySkipMs) || 0), now); if (w) v.chatNote = w; }
    // stage overlays
    if (d.status === 'closed') v.stage = stageCard('<h3>' + esc(t('closedTitle')) + '</h3><p class="muted">' + esc(t('closedText')) + '</p><div class="stage-actions"><button type="button" class="btn primary" data-act="home">' + esc(t('backHome')) + '</button></div>');
    else if (phase === 'lobby') v.stage = this.lobbyStage(d, s, seatedList);
    else if (phase === 'choosing') {
      if (isDrawer) { const list = (g.ensureChoices() || []).map(w => (multi ? DG.wordFor(DG.conceptOf(CFG, w) || w, LANG) : w)); v.stage = stageCard('<h3>' + esc(t('chooseTitle')) + '</h3>' + choicesHTML(list) + '<p class="muted">' + esc(t('chooseAuto')) + ' <b id="stageCount"></b></p>'); v.stageCount = turn.until - now; }
      else v.stage = stageCard('<h3>' + esc(t('chooseWait', { name: this.name(turn.drawer) })) + '</h3><p class="muted">' + esc(t('roundOf', { r: s.round, n: s.rounds || s.settings.rounds })) + '</p>');
    } else if (phase === 'reveal') {
      const empty = turn.reason === 'empty', guessed = turn.guessed || {}, bonus = Number(turn.drawerBonus) || 0, base = turn.drawerBase !== undefined ? Number(turn.drawerBase) || 0 : (Number(turn.drawerPts) || 0) - bonus;
      const rows = Object.keys(guessed).map(id => ({ name: this.name(Number(id)), pts: (guessed[id] && guessed[id].pts) || 0 }));
      // same durations as core finishTurn(): revealSeconds after a real word, 4 s empty canvas, 3 s skipped turn; synced to server time via g.now()
      const revTotal = (revealed && !empty ? Number(G.revealSeconds) || 5 : empty ? 4 : 3) * 1000;
      v.timer = { left: (turn.revealUntil || now) - now, total: revTotal }; v.revealCount = (turn.revealUntil || now) - now;
      const gains = (revealWord || empty || rows.length) ? '<p class="muted" style="margin:0">' + esc(t('revealGains')) + '</p>' + gainsHTML(rows, this.name(turn.drawer), base, bonus, empty) : '';
      v.stage = stageCard((empty ? emptyNoticeHTML() : '<h3>' + esc(revealWord ? t('revealTitle') : t('revealNone')) + '</h3>') + (revealWord ? '<p class="big">' + esc(revealWord) + '</p>' + (multi && turn.words ? multiListHTML(turn.words) : '') : empty ? '' : '<p class="muted">' + esc(turn.reason === 'left' ? t('revealLeft') : t('revealTimeout')) + '</p>') + gains + nextCountHTML('nextIn'));
    } else if (phase === 'over') {
      const rows = rankRows(podium);
      v.stage = stageCard('<h3>' + esc(t('overTitle')) + '</h3>' + podiumHTML(rows) + '<div class="stage-actions">' + (g.isHost() ? '<button type="button" class="btn primary" data-act="rematch">' + esc(t('rematch')) + '</button>' : '<p class="muted">' + esc(t('rematchWait')) + '</p>') + '<button type="button" class="btn ghost" data-act="home">' + esc(t('exit')) + '</button></div>');
    }
    v.draw = g.canDraw() ? { mode: 'local', key: turn.id, ops: g.drawOps() } : { mode: 'view', ops: phase === 'lobby' ? [] : s.draw, lag: phase === 'drawing' };
    return v;
  }
  lobbyStage(d, s, seatedList) {
    const g = this.game, st = s.settings, need = Math.max(0, G.minPlayers - seatedList.length);
    let html = '<h3>' + esc(t('lobbyTitle')) + '</h3><p class="muted" style="margin:0">' + esc(t('lobbyInvite')) + '</p><div class="code">' + esc(d.code) + '</div>';
    html += '<div class="stage-actions" style="margin-top:0"><button type="button" class="btn small" data-act="copy">' + esc(t('copyInvite')) + '</button>' + (g.isHost() ? '<button type="button" class="btn small primary" data-act="start"' + (need ? ' disabled' : '') + '>' + esc(t('start')) + '</button>' : '') + '</div>';
    html += '<p class="muted" style="margin:8px 0 0">' + esc(need ? t('lobbyNeed', { n: need }) : (g.isHost() ? '' : t('lobbyWaitHost'))) + '</p>';
    const eff = DG.roundsFor(seatedList.length, st.rounds, G);
    html += '<p class="muted lobby-note">' + esc(t('joinMidNote')) + (eff < st.rounds ? ' ' + esc(t('roundsCapped', { n: seatedList.length, r: eff })) : '') + '</p>';
    if (g.isHost()) {
      const opt = (list, cur, label) => list.map(x => '<option value="' + esc(x) + '"' + (String(x) === String(cur) ? ' selected' : '') + '>' + esc(label(x)) + '</option>').join('');
      html += '<div class="settings"><label class="field"><span>' + esc(t('roundsLabel')) + '</span><select id="stRounds" data-set="rounds">' + opt(G.roundsOptions, st.rounds, x => x) + '</select></label>' +
        '<label class="field"><span>' + esc(t('timeLabel')) + '</span><select id="stTime" data-set="drawTime">' + opt(G.drawTimeOptions, st.drawTime, x => t('seconds', { n: x })) + '</select></label>' +
        '<label class="field"><span>' + esc(t('wordLangLabel')) + '</span><select id="stLang" data-set="lang">' + opt(wordLangs().includes(st.lang || 'id') ? wordLangs() : wordLangs().concat([st.lang || 'id']), st.lang || 'id', langName) + '</select></label>' +
        (st.lang === 'multi' ? '<p class="muted full" style="margin:0">' + esc(t('wordLangMultiHint')) + '</p>' : '') + '<label class="field full"><span>' + esc(t('customLabel')) + '</span><textarea id="stCustom" data-set="custom" rows="1" maxlength="900" aria-describedby="stCustomHint">' + esc((st.custom || []).join(', ')) + '</textarea><small class="muted" id="stCustomHint">' + esc(t('customHint')) + '</small></label></div>';
    } else {
      html += '<p style="font-weight:800;margin:8px 0 0">' + esc(st.rounds + ' × ' + t('roundsLabel').toLowerCase() + ' · ' + t('seconds', { n: st.drawTime })) + ' · ' + flag(st.lang || 'id') + ' ' + esc(langName(st.lang || 'id')) + '</p>' + (st.lang === 'multi' ? '<p class="muted" style="margin:4px 0 0">' + esc(t('wordLangMultiHint')) + '</p>' : '');
    }
    return stageCard(html);
  }
}
/* Reveal: per-turn gains with the drawer's share and the all-guessed bonus as a badge (icons first, minimal reading). */
function multiListHTML(words) { return '<ul class="ml-list">' + UI_LANGS.filter(l => words[l]).map(l => '<li' + (l === LANG ? ' class="me"' : '') + '>' + flag(l) + '<span>' + esc(words[l]) + '</span></li>').join('') + '</ul>'; }
function gainsHTML(rows, drawerName, base, bonus, empty) {
  let html = rows.map(r => '<li><span>' + esc(r.name) + '</span><span class="plus">+' + esc(r.pts) + '</span></li>').join('');
  html += '<li class="drawer-gain' + (empty ? ' zero' : '') + '"><span>✎ ' + esc(drawerName) + (empty ? ' <b class="gain-badge empty" title="' + esc(t('revealEmptyTitle')) + '">🚫🖌️</b>' : '') + '</span><span class="plus">+' + esc(base || 0) + '</span></li>';
  if (bonus) html += '<li class="bonus-gain"><span><b class="gain-badge all">🎉 ' + esc(t('allBonus')) + '</b></span><span class="plus">+' + esc(bonus) + '</span></li>';
  return '<ul class="gains">' + html + '</ul>';
}
function emptyNoticeHTML() { return '<div class="empty-skip" role="status"><span class="empty-ico" aria-hidden="true">🖼️<b>🚫</b></span><b>' + esc(t('revealEmptyTitle')) + '</b><small>' + esc(t('revealEmpty', { n: Math.round((Number(G.emptySkipMs) || 15000) / 1000) })) + '</small></div>'; }
let emptyWarned = '';
function emptyWarnNote(startMs, now) {
  const ms = Number(G.emptySkipMs) || 0; if (!ms) return ''; const left = Math.ceil((startMs + ms - now) / 1000); if (left <= 0) return '';
  const msg = '⏳ ' + t('emptyWarn', { n: left }), key = String(startMs);
  if (left <= 5 && emptyWarned !== key) { emptyWarned = key; toast('✏️ ' + msg); } // one nudge per turn, shortly before the skip
  return msg;
}
function chatLine(c, ctx) {
  if (!c || typeof c !== 'object') return null;
  const nm = esc(ctx.name(c.p)), tx = esc(String(c.t || '').slice(0, 80));
  switch (c.k) {
    case 'm': case 'g': return { cls: '', html: '<b>' + nm + ':</b> ' + tx };
    case 'gc': return { cls: 'gc', html: '✓ <b>' + nm + ':</b> ' + tx };
    case 'close': return c.p === ctx.me ? { cls: 'close', html: esc(t('msgCloseMe', { text: ctx.mine(c.r) || '…' })) } : { cls: 'close', html: esc(t('msgClose', { name: ctx.name(c.p) })) };
    case 'ok': return c.p === ctx.me ? { cls: 'ok', html: esc(t('msgOkMe', { word: ctx.mine(c.r) || '', n: c.n || 0 })) } : { cls: 'ok', html: esc(t('msgOk', { name: ctx.name(c.p), n: c.n || 0 })) };
    case 'sys': {
      const map = { start: 'msgStart', choosing: 'msgChoosing', drawing: 'msgDrawing', reveal: 'msgReveal', timeout: 'msgTimeout', left: 'msgLeft', skip: 'msgSkip', empty: 'msgEmpty', joined: 'msgJoined', over: 'msgOver', lobby: 'msgLobby', host: 'msgHost' };
      return { cls: 'sys', html: esc(t(map[c.m] || 'msgSkip', { name: ctx.name(c.p), word: (c.w && typeof c.w === 'object' ? DG.wordFor(c.w, LANG) : c.t) || '' })) };
    }
    default: return null;
  }
}
function onlineError(e) {
  if (!e) return;
  if (e.status === 403 || e.status === 404) { if (mode && mode.kind === 'online') { toast(t('errMember')); net.forget(); showHome(); } return; }
  if (e.code === 'busy' || e.status === 409) return;
  if (e.code === 'network') { updateConn(); return; }
  toast(errMsg(e));
}
async function copyInvite(code, wl) {
  const url = location.origin + location.pathname + '?room=' + encodeURIComponent(code) + (wl ? '&wl=' + encodeURIComponent(wl) : '');
  try { await navigator.clipboard.writeText(url); toast(t('copied')); } catch (e) { toast(t('copyFail', { code })); }
}

/* ================= SOLO DRAWING PRACTICE ================= */
class SoloMode {
  constructor() { this.kind = 'solo'; this.used = []; this.newWord(); }
  relang() { if (this.phase === 'choose') this.newWord(); }
  newWord() { this.phase = 'choose'; this.ops = []; this.key = (this.key || 0) + 1; this.word = null; this.choices = DG.pickChoices(DG.wordPool(CFG, LANG, []), recentWords().concat(this.used), G.wordChoices); }
  tick() { if (this.phase === 'draw' && Date.now() >= this.until) { board.cancel(); this.phase = 'done'; toast(t('soloDone')); } }
  commit(op) { if (this.phase !== 'draw') return false; const next = this.ops.concat([op]); if (DG.opsBytes(next) > DG.LIMITS.drawBudget) { toast(t('canvasFull')); return false; } this.ops = next; return true; }
  undo() { if (this.phase !== 'draw') return; this.ops.pop(); board.setOps(this.ops); }
  clear() { if (this.phase !== 'draw') return; this.ops = []; board.setOps(this.ops); }
  act(name, el) {
    if (name === 'pick') { this.word = this.choices[Number(el.dataset.i)]; this.used.push(this.word); rememberWord(this.word); this.phase = 'draw'; this.total = G.defaultDrawTime * 1000; this.until = Date.now() + this.total; this.key++; }
    else if (name === 'finish') { board.cancel(); this.phase = 'done'; }
    else if (name === 'save') savePNG();
    else if (name === 'next') this.newWord();
    else if (name === 'home') showHome();
    requestRender();
  }
  exit() { showHome(); }
  view() {
    const v = { title: t('soloHeader'), sub: this.phase === 'choose' ? t('soloChoose') : '', players: [], chat: null, chatMode: 'none', chatNote: t('soloInfo') };
    if (this.phase === 'draw') { v.timer = { left: this.until - Date.now(), total: this.total }; v.side = '<button type="button" class="btn small primary" data-act="finish">' + esc(t('soloFinish')) + '</button>'; }
    if (this.word) v.hint = { type: 'word', text: this.word, label: t('yourWord') };
    if (this.phase === 'choose') v.stage = stageCard('<h3>' + esc(t('soloChoose')) + '</h3>' + choicesHTML(this.choices));
    if (this.phase === 'done') { v.stage = stageCard('<h3>' + esc(t('soloDone')) + '</h3><p class="big">' + esc(this.word) + '</p><div class="stage-actions"><button type="button" class="btn yellow" data-act="save">' + esc(t('soloSave')) + '</button><button type="button" class="btn primary" data-act="next">' + esc(t('soloNext')) + '</button><button type="button" class="btn ghost" data-act="home">' + esc(t('backHome')) + '</button></div>'); v.side = '<button type="button" class="btn small yellow" data-act="save">' + esc(t('soloSave')) + '</button>'; }
    v.draw = this.phase === 'draw' ? { mode: 'local', key: 'solo' + this.key, ops: this.ops } : { mode: 'view', ops: this.ops };
    return v;
  }
}

/* ================= GUESS THE DOODLE ================= */
class DoodleMode {
  constructor() { this.kind = 'doodle'; this.ids = DG.shuffle(Object.keys(DOODLES).filter(id => CFG.doodles && CFG.doodles[id])).slice(0, G.doodleRounds); this.i = -1; this.score = 0; this.chat = []; this.next(); }
  answers(id) { const a = CFG.doodles[id] || {}; return (a[LANG] || a.id || []).concat(...UI_LANGS.filter(l => l !== LANG).map(l => a[l] || [])); }
  next() {
    this.i++; if (this.i >= this.ids.length) { this.phase = 'over'; return; }
    const id = this.ids[this.i]; this.strokes = doodleOps(id); this.answer = (CFG.doodles[id][LANG] || CFG.doodles[id].id)[0];
    this.total = G.doodleSeconds * 1000; this.start = Date.now(); this.until = this.start + this.total; this.phase = 'play'; this.hint = DG.maskOf(this.answer); this.got = false;
    const n = this.strokes.reduce((a, s) => a + s.pts.length, 0); this.drawMs = reduced.matches ? 0 : Math.min(14000, 3000 + n * 40); this.points = n;
    this.chat.push({ cls: 'sys', html: esc(t('doodleOf', { i: this.i + 1, n: this.ids.length })) });
  }
  partial() {
    const e = Date.now() - this.start, k = this.drawMs ? Math.min(1, e / this.drawMs) : 1; let budget = Math.ceil(this.points * k); const out = [];
    for (const s of this.strokes) { if (budget <= 0) break; const take = Math.min(s.pts.length, budget); out.push(DG.encodeStroke(s.c, s.z, s.pts.slice(0, take))); budget -= take; }
    return out;
  }
  tick() {
    if (this.phase === 'play') {
      const frac = (Date.now() - this.start) / this.total;
      while (DG.hintTarget(frac, this.answer, G.hintAt) > DG.revealedCount(this.hint)) { const n = DG.revealOne(this.answer, this.hint); if (n === this.hint) break; this.hint = n; }
      if (Date.now() >= this.until) this.finish(false);
    } else if (this.phase === 'reveal' && Date.now() >= this.revealUntil) this.next();
  }
  finish(ok, pts) { this.phase = 'reveal'; this.lastOk = !!ok; this.lastPts = pts || 0; this.revealTotal = (ok ? Number(G.revealSeconds) || 5 : 3) * 1000; this.revealUntil = Date.now() + this.revealTotal; if (!ok) this.chat.push({ cls: 'sys', html: esc(t('msgReveal', { word: this.answer })) }); }
  say(text) {
    if (this.phase !== 'play') return;
    let best = 'no'; for (const a of this.answers(this.ids[this.i])) { const v = DG.judge(text, a); if (v === 'ok') { best = 'ok'; break; } if (v === 'close') best = 'close'; }
    if (best === 'ok') { const pts = DG.guessPoints(this.until - Date.now(), this.total, G); this.score += pts; this.chat.push({ cls: 'ok', html: esc(t('msgOkMe', { word: this.answer, n: pts })) }); this.got = true; this.finish(true, pts); }
    else if (best === 'close') this.chat.push({ cls: 'close', html: esc(t('msgCloseMe', { text })) });
    else this.chat.push({ cls: '', html: '<b>' + esc(t('you')) + ':</b> ' + esc(text) });
    this.chat = this.chat.slice(-60);
  }
  act(name) { if (name === 'skip' && this.phase === 'play') this.finish(false); else if (name === 'again') { mode = new DoodleMode(); board.rendered = []; board.blank(); } else if (name === 'home') showHome(); requestRender(); }
  exit() { showHome(); }
  view() {
    const v = { title: t('doodleHeader'), sub: this.phase === 'over' ? '' : t('doodleOf', { i: Math.min(this.i + 1, this.ids.length), n: this.ids.length }), players: [{ id: 1, name: t('you'), score: this.score, me: false }], chat: this.chat, chatMode: this.phase === 'play' ? 'guess' : 'off', chatNote: t('doodleInfo') };
    if (this.phase === 'play') { v.timer = { left: this.until - Date.now(), total: this.total }; v.hint = { type: 'mask', text: this.hint }; v.side = '<button type="button" class="btn small ghost" data-act="skip">' + esc(t('doodleSkip')) + '</button>'; v.draw = { mode: 'view', ops: this.partial() }; }
    else if (this.phase === 'reveal') {
      const left = this.revealUntil - Date.now(); v.timer = { left, total: this.revealTotal || 3000 }; v.revealCount = left;
      v.stage = stageCard((this.lastOk ? '<h3 class="ok-title">✓ ' + esc(t('doodleCorrect', { n: this.lastPts })) + '</h3>' : '<h3>' + esc(t('revealTitle')) + '</h3>') + '<p class="big">' + esc(this.answer) + '</p>' + nextCountHTML(this.i + 1 >= this.ids.length ? 'resultIn' : 'nextDoodle'));
      v.hint = { type: 'word', text: this.answer, label: t('revealTitle') }; v.draw = { mode: 'view', ops: this.strokes.map(s => DG.encodeStroke(s.c, s.z, s.pts)) }; }
    else { v.draw = { mode: 'view', ops: [] }; v.stage = stageCard('<h3>' + esc(t('overTitle')) + '</h3><p class="big">' + esc(t('doodleResult', { n: this.score })) + '</p><div class="stage-actions"><button type="button" class="btn primary" data-act="again">' + esc(t('doodleAgain')) + '</button><button type="button" class="btn ghost" data-act="home">' + esc(t('backHome')) + '</button></div>'); }
    return v;
  }
}

/* Offline modes remember recently drawn words on this device (per language), so replays keep showing fresh words. */
function recentWords() { try { const v = JSON.parse(local.get('dg.used.' + LANG) || '[]'); return Array.isArray(v) ? v.slice(-DG.LIMITS.usedKeep) : []; } catch (e) { return []; } }
function rememberWord(w) { local.set('dg.used.' + LANG, JSON.stringify(recentWords().concat([w]).slice(-DG.LIMITS.usedKeep))); }
/* ================= PASS-AND-PLAY PARTY ================= */
class PartyMode {
  constructor(names, rounds, drawTime) { this.kind = 'party'; this.players = names.map((n, i) => ({ id: i + 1, name: n, score: 0 })); this.rounds = rounds; this.drawTime = drawTime; this.round = 1; this.turn = 0; this.used = []; this.chat = []; this.peek = false; this.beginTurn(); }
  get drawer() { return this.players[this.turn]; }
  relang() { if (this.phase === 'pass' || this.phase === 'choose') this.choices = DG.pickChoices(DG.wordPool(CFG, LANG, []), recentWords().concat(this.used), G.wordChoices); }
  beginTurn() { this.phase = 'pass'; this.ops = []; this.guessed = {}; this.word = null; this.key = (this.key || 0) + 1; this.choices = DG.pickChoices(DG.wordPool(CFG, LANG, []), recentWords().concat(this.used), G.wordChoices); }
  tick() {
    if (this.phase === 'draw') {
      const frac = (Date.now() - this.start) / this.total;
      while (DG.hintTarget(frac, this.word, G.hintAt) > DG.revealedCount(this.hint)) { const n = DG.revealOne(this.word, this.hint); if (n === this.hint) break; this.hint = n; }
      if (Date.now() >= this.until) { toast(t('timeUp')); this.endTurn(); }
      else if (!this.drew && G.emptySkipMs > 0 && Date.now() - this.start >= G.emptySkipMs) this.endTurn('empty');
    }
  }
  endTurn(reason) {
    board.cancel(); this.phase = 'reveal'; this.reason = reason || null; const pts = [];
    for (const id of Object.keys(this.guessed)) { const p = this.players.find(x => x.id === Number(id)); p.score += this.guessed[id]; pts.push(this.guessed[id]); }
    // same drawer formula as online; eligible = everyone except the drawer (pass-the-phone: all are at the table)
    const r = reason === 'empty' ? { base: 0, bonus: 0, total: 0 } : DG.drawerPoints(pts, this.players.length - 1, G);
    this.drawerPts = r.total; this.drawerBase = r.base; this.drawerBonus = r.bonus; this.drawer.score += this.drawerPts;
    this.chat.push({ cls: 'sys', html: esc(reason === 'empty' ? t('msgEmpty', { name: this.drawer.name }) : t('msgReveal', { word: this.word })) });
  }
  advance() { this.turn++; if (this.turn >= this.players.length) { this.turn = 0; this.round++; } if (this.round > this.rounds) { this.phase = 'over'; this.chat.push({ cls: 'sys', html: esc(t('msgOver')) }); return; } this.beginTurn(); }
  commit(op) { if (this.phase !== 'draw') return false; const next = this.ops.concat([op]); if (DG.opsBytes(next) > DG.LIMITS.drawBudget) { toast(t('canvasFull')); return false; } this.ops = next; this.drew = true; return true; }
  undo() { if (this.phase !== 'draw') return; this.ops.pop(); board.setOps(this.ops); }
  clear() { if (this.phase !== 'draw') return; this.ops = []; board.setOps(this.ops); }
  act(name, el) {
    if (name === 'ready') this.phase = 'choose';
    else if (name === 'pick') { this.word = this.choices[Number(el.dataset.i)]; this.used.push(this.word); rememberWord(this.word); this.hint = DG.maskOf(this.word); this.phase = 'draw'; this.drew = false; this.total = this.drawTime * 1000; this.start = Date.now(); this.until = this.start + this.total; this.key++; this.chat.push({ cls: 'sys', html: esc(t('msgDrawing', { name: this.drawer.name })) }); }
    else if (name === 'mark' && this.phase === 'draw') {
      const id = Number(el.dataset.id); if (id === this.drawer.id) return;
      if (this.guessed[id] !== undefined) delete this.guessed[id];
      else { const pts = DG.guessPoints(this.until - Date.now(), this.total, G); this.guessed[id] = pts; const p = this.players.find(x => x.id === id); this.chat.push({ cls: 'ok', html: esc(t('msgOk', { name: p.name, n: pts })) }); }
      if (Object.keys(this.guessed).length >= this.players.length - 1) this.endTurn();
    }
    else if (name === 'end' && this.phase === 'draw') this.endTurn();
    else if (name === 'next') this.advance();
    else if (name === 'again') { const keep = this.chat; mode = new PartyMode(this.players.map(p => p.name), this.rounds, this.drawTime); mode.chat = keep.concat(mode.chat).slice(-60); /* t362u: rematch keeps the chat */ board.rendered = []; board.blank(); }
    else if (name === 'home') showHome();
    requestRender();
  }
  exit() { if (this.phase === 'over' || confirm(t('exitConfirm'))) showHome(); }
  view() {
    const d = this.drawer, v = { title: t('partyHeader'), sub: this.phase === 'over' ? '' : t('roundOf', { r: this.round, n: this.rounds }), chat: this.chat.slice(-40), chatMode: 'none', chatNote: t('partyInfo') };
    v.players = this.players.map(p => ({ id: p.id, name: p.name, score: p.score, drawer: p.id === d.id && ['choose', 'draw', 'pass'].includes(this.phase), ok: this.guessed[p.id] !== undefined, mark: this.phase === 'draw' && p.id !== d.id ? { pressed: this.guessed[p.id] !== undefined } : null }));
    if (this.phase === 'pass') v.stage = stageCard('<p class="muted" style="margin:0">' + esc(t('partyPass')) + '</p><p class="big">' + esc(d.name) + '</p><p class="muted">' + esc(t('partyPassText', { name: d.name })) + '</p><button type="button" class="btn primary" data-act="ready">' + esc(t('partyReady', { name: d.name })) + '</button>');
    if (this.phase === 'choose') v.stage = stageCard('<h3>' + esc(t('chooseTitle')) + '</h3>' + choicesHTML(this.choices));
    if (this.phase === 'draw') {
      v.timer = { left: this.until - Date.now(), total: this.total };
      v.hint = this.peek ? { type: 'word', text: this.word, label: t('yourWord') } : { type: 'mask', text: this.hint };
      v.side = '<button type="button" class="btn small yellow peek" id="peekBtn">' + esc(t('partyPeek')) + '</button><button type="button" class="btn small primary" data-act="end">' + esc(t('partyEnd')) + '</button>';
      v.chatNote = t('partyMark');
      if (!this.drew) { const w = emptyWarnNote(this.start, Date.now()); if (w) v.chatNote = w; }
    }
    if (this.phase === 'reveal') {
      const empty = this.reason === 'empty', rows = Object.keys(this.guessed).map(id => ({ name: this.players.find(p => p.id === Number(id)).name, pts: this.guessed[id] }));
      v.hint = { type: 'word', text: this.word, label: t('revealTitle') };
      v.stage = stageCard((empty ? emptyNoticeHTML() : '<h3>' + esc(t('revealTitle')) + '</h3>') + '<p class="big">' + esc(this.word) + '</p>' + gainsHTML(rows, d.name, this.drawerBase || 0, this.drawerBonus || 0, empty) + '<button type="button" class="btn primary" data-act="next">' + esc(t('partyNext')) + '</button>');
    }
    if (this.phase === 'over') v.stage = stageCard('<h3>' + esc(t('overTitle')) + '</h3>' + podiumHTML(rankRows(this.players)) + '<div class="stage-actions"><button type="button" class="btn primary" data-act="again">' + esc(t('rematch')) + '</button><button type="button" class="btn ghost" data-act="home">' + esc(t('backHome')) + '</button></div>');
    v.draw = this.phase === 'draw' ? { mode: 'local', key: 'party' + this.key, ops: this.ops } : { mode: 'view', ops: this.phase === 'reveal' ? this.ops : [] };
    return v;
  }
}

/* ================= HOME: online lobby & practice setup ================= */
let onlineState = 'off', roomsTimer = 0, roomsAt = 0, roomList = [];
function setOnline(state, msg, isErr) {
  onlineState = state;
  document.querySelectorAll('.online-btn').forEach(b => { b.disabled = state !== 'ready'; });
  const n = $('onlineNote'); n.textContent = msg || ''; n.classList.toggle('err', !!isErr); updateConn();
}
function note(msg, isErr) { const n = $('onlineNote'); n.textContent = msg; n.classList.toggle('err', !!isErr); }
function updateConn() {
  const c = $('conn'); let st = 'offline', label = t('connOffline');
  if (net.config && !net.stopped) { if (net.state === 'online') { st = 'online'; label = t('connOnline'); } else if (net.state === 'reconnecting') { st = 'reconnecting'; label = t('connReconnecting'); } else { st = 'reconnecting'; label = t('connConnecting'); } }
  c.dataset.state = st; c.textContent = label; c.setAttribute('aria-label', label);
}
function scheduleRooms() { if ($('home').hidden) return; clearTimeout(roomsTimer); roomsTimer = setTimeout(loadRooms, Math.max(0, 1500 - (Date.now() - roomsAt))); }
// #gamemaster: GM view lists every lobby (public + private, backend checks ?gm=); without the hash: public only
const GM_KEY = 'gamemaster', gmOn = () => location.hash === '#' + GM_KEY;
function gmTitle() { const h = $('roomsTitle'); if (h) { h.dataset.i18n = gmOn() ? 'roomsTitleGM' : 'roomsTitle'; h.textContent = t(h.dataset.i18n); } }
window.addEventListener('hashchange', () => { gmTitle(); roomList = []; renderRooms(); loadRooms(); });
// (GM) tag is server-owned: typed code in the room → POST rooms/{code}/gamemaster; the hash alone only opens the GM lobby list
let gmUI = null;
const gmMine = () => !!(mode && mode.kind === 'online' && mode.game.data && mode.game.isGamemaster());
function gmMeSync() { document.documentElement.classList.toggle('gm-on', gmMine()); if (gmUI) gmUI.sync(); }
function gmAnnounce() { gmMeSync(); }
async function loadRooms() {
  gmTitle();
  if (onlineState !== 'ready' || $('home').hidden) { renderRooms(); return; }
  roomsAt = Date.now();
  try { const r = await net.rooms(gmOn() ? GM_KEY : ''); roomList = (r && Array.isArray(r.rooms)) ? r.rooms : []; } catch (e) { if (e.code !== 'busy') roomList = []; }
  renderRooms();
}
/* the API lists every public room until someone calls leave; a live room is written at least every hostHeartbeatSeconds
   (host beat), so one untouched for staleRoomSeconds has nobody left in it (closed tabs) -> hide it */
function roomAlive(r) { const u = Date.parse(r.updatedAt || ''); return r.seated > 0 && (!Number.isFinite(u) || net.serverNow() - u <= (RT.staleRoomSeconds || 120) * 1000); }
setInterval(() => { if (!$('home').hidden && roomList.length) renderRooms(); }, 30000); /* local re-filter only (no request) */
function renderRooms() {
  const el = $('rooms');
  if (onlineState !== 'ready') { el.innerHTML = ''; return; }
  const list = roomList.filter(roomAlive);
  if (!list.length) { el.innerHTML = '<li class="muted">' + esc(t(gmOn() ? 'roomsEmptyGM' : 'roomsEmpty')) + '</li>'; return; }
  el.innerHTML = list.map(r => { const open = r.status === 'waiting' && r.seated < r.maxPlayers; return '<li class="room' + (r.visibility === 'private' ? ' priv' : '') + '"><span><b>' + esc(r.code) + '</b>' + (r.visibility === 'private' ? ' <em class="room-priv">' + esc(t('roomPrivate')) + '</em>' : '') + '<small>' + esc((r.status === 'waiting' ? t('roomWaiting') : t('roomPlaying')) + ' · ' + t('roomSeats', { n: r.seated, max: r.maxPlayers }) + (r.spectators ? ' · ' + t('roomSpectators', { n: r.spectators }) : '')) + '</small></span><button type="button" class="btn small ' + (open ? 'teal' : 'ghost') + '" data-room="' + esc(r.code) + '" data-kind="' + (open ? 'join' : 'watch') + '">' + esc(open ? t('join') : t('watch')) + '</button></li>'; }).join('');
}
$('rooms').addEventListener('click', e => { const b = e.target.closest('[data-room]'); if (!b) return; $('codeInput').value = b.dataset.room; go(b.dataset.kind, b.dataset.room); });
function newGame() { return new DG.OnlineGame(net, CFG, { onChange: () => requestRender(), onNotice: onlineError }); }
let entering = false;
// result for the invite gate: {ok} | {ok:false, missing|retry, message}
function joinFail(e) { return { ok: false, missing: e.status === 404 || e.status === 422, retry: e.code === 'network' || e.code === 'busy' || e.status === 429, message: errMsg(e) }; }
async function go(kind, code) {
  if (entering || onlineState !== 'ready') return { ok: false, retry: true };
  const name = $('nameInput').value.replace(/\s+/g, ' ').trim().slice(0, 24);
  if (!name) { note(t('errName'), true); $('nameInput').focus(); return { ok: false, retry: true, message: t('errName') }; }
  if ((kind === 'join' || kind === 'watch') && !/^[A-Z2-9]{6}$/.test(code || '')) { note(t('errCode'), true); $('codeInput').focus(); return { ok: false, missing: true }; }
  local.set('dg.name', name); entering = true; document.querySelectorAll('.online-btn').forEach(b => { b.disabled = true; });
  const g = newGame(), opts = { displayName: name, code, maxPlayers: kind === 'private' ? (G.privateMaxPlayers || G.maxPlayers) : (Number($('maxSelect').value) || G.maxPlayers), settings: { rounds: G.defaultRounds, drawTime: G.defaultDrawTime, lang: DG.hasLang(CFG, LANG) ? LANG : 'id', custom: [] } };
  try {
    await g.enter(kind, opts);
    // quick match picks the oldest open public room, which may be one whose players all closed their tabs: close it and match again
    for (let n = 0; kind === 'match' && n < 3 && g.abandoned(); n++) { await g.closeAbandoned(); await g.enter(n < 2 ? 'match' : 'public', opts); }
    note(''); showGame(new OnlineMode(g)); gmAnnounce(g); return { ok: true };
  }
  catch (e) {
    if (kind === 'join' && e.status === 409 && /not open/i.test(e.server || '')) {
      try { await g.enter('watch', opts); toast(t('nowWatching')); showGame(new OnlineMode(g)); return { ok: true }; } catch (e2) { note(errMsg(e2), true); return joinFail(e2); }
    } else { note(errMsg(e), true); return joinFail(e); }
  } finally { entering = false; if (onlineState === 'ready') document.querySelectorAll('.online-btn').forEach(b => { b.disabled = false; }); }
}
$('createPrivate').addEventListener('click', () => go('private'));
$('createPublic').addEventListener('click', () => go('public'));
$('quickMatch').addEventListener('click', () => go('match'));
$('joinForm').addEventListener('submit', e => { e.preventDefault(); go('join', $('codeInput').value.trim().toUpperCase()); });
$('watchBtn').addEventListener('click', () => go('watch', $('codeInput').value.trim().toUpperCase()));
$('refreshRooms').addEventListener('click', loadRooms);
$('codeInput').addEventListener('input', e => { const el = e.target, v = el.value.toUpperCase().replace(/[^A-Z2-9]/g, '').slice(0, 6); if (v !== el.value) el.value = v; });
$('soloStart').addEventListener('click', () => showGame(new SoloMode()));
$('doodleStart').addEventListener('click', () => showGame(new DoodleMode()));

// party setup
let partyNames = [];
function renderPartyNames() {
  const ul = $('partyNames');
  ul.innerHTML = partyNames.map((n, i) => '<li><label class="sr-only" for="pn' + i + '">' + esc(t('partyDefault', { n: i + 1 })) + '</label><input type="text" id="pn' + i + '" maxlength="20" value="' + esc(n) + '" placeholder="' + esc(t('partyDefault', { n: i + 1 })) + '" data-i="' + i + '"><button type="button" class="icon-btn" data-rm="' + i + '" aria-label="' + esc(t('partyRemove', { name: n || t('partyDefault', { n: i + 1 }) })) + '"' + (partyNames.length <= 2 ? ' disabled' : '') + '>×</button></li>').join('');
  $('partyAdd').disabled = partyNames.length >= G.partyMaxPlayers;
}
$('partyNames').addEventListener('input', e => { const i = e.target.dataset.i; if (i !== undefined) partyNames[Number(i)] = e.target.value; });
$('partyNames').addEventListener('click', e => { const b = e.target.closest('[data-rm]'); if (!b || partyNames.length <= 2) return; partyNames.splice(Number(b.dataset.rm), 1); renderPartyNames(); });
$('partyAdd').addEventListener('click', () => { if (partyNames.length < G.partyMaxPlayers) { partyNames.push(''); renderPartyNames(); const last = $('pn' + (partyNames.length - 1)); if (last) last.focus(); } });
$('partyForm').addEventListener('submit', e => {
  e.preventDefault();
  const names = partyNames.map((n, i) => (n.replace(/\s+/g, ' ').trim() || t('partyDefault', { n: i + 1 })).slice(0, 20));
  if (names.length < 2) { $('partyNote').textContent = t('playersMin'); return; }
  $('partyNote').textContent = '';
  showGame(new PartyMode(names, Number($('partyRounds').value) || 1, Number($('partyTime').value) || G.defaultDrawTime));
});

/* ---------------- i18n & static content ---------------- */
function fillSelect(el, list, cur, label) { const v = el.value || String(cur); el.innerHTML = list.map(x => '<option value="' + esc(x) + '"' + (String(x) === v ? ' selected' : '') + '>' + esc(label(x)) + '</option>').join(''); }
function applyI18n() {
  document.documentElement.lang = LANG === 'zh' ? 'zh-CN' : LANG;
  const pn = $('privateNote'); if (pn) pn.textContent = t('privateNote', { max: G.privateMaxPlayers || G.maxPlayers });
  document.title = t('metaTitle');
  const md = document.querySelector('meta[name=description]'); if (md) md.setAttribute('content', t('metaDescription'));
  const ogt = document.querySelector('meta[property="og:title"]'); if (ogt) ogt.setAttribute('content', t('metaTitle'));
  const ogd = document.querySelector('meta[property="og:description"]'); if (ogd) ogd.setAttribute('content', t('metaDescription'));
  const tc = document.querySelector('meta[name=theme-color]'); if (tc && CFG.site.themeColor) tc.setAttribute('content', CFG.site.themeColor);
  document.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
  document.querySelectorAll('[data-i18n-ph]').forEach(el => { el.placeholder = t(el.dataset.i18nPh); });
  document.querySelectorAll('[data-i18n-aria]').forEach(el => { el.setAttribute('aria-label', t(el.dataset.i18nAria)); });
  document.querySelectorAll('[data-i18n-list]').forEach(el => { const l = t(el.dataset.i18nList); el.textContent = Array.isArray(l) ? (l[Number(el.dataset.index)] || '') : ''; el.hidden = !el.textContent; });
  document.querySelectorAll('[data-c]').forEach(el => { el.textContent = cfgPath(el.dataset.c) || ''; });
  const h1 = $('heroTitle'), title = t('heroTitle'), cut = title.indexOf(', ');
  if (cut > 0) { h1.textContent = ''; h1.append(title.slice(0, cut + 2)); const m = document.createElement('span'); m.className = 'mark'; m.textContent = title.slice(cut + 2); h1.append(m); }
  $('langBtn').innerHTML = '<svg class="globe" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><g fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18"/></g></svg>' + flag(LANG) + '<span>' + esc(LANG === 'zh' ? '中文' : LANG.toUpperCase()) + '</span>';
  $('langBtn').setAttribute('aria-label', t('langBtnLabel', { lang: langName(LANG) })); $('langBtn').setAttribute('aria-haspopup', 'dialog');
  $('gLangBtn').innerHTML = flag(LANG); $('gLangBtn').setAttribute('aria-label', t('langBtnLabel', { lang: langName(LANG) })); $('gLangBtn').setAttribute('aria-haspopup', 'dialog');
  if (!$('langPop').hidden) renderLangGrid();
  $('doodleText').textContent = t('doodleText', { n: Math.min(G.doodleRounds, Object.keys(DOODLES).length) });
  const rules = t('rules'); $('steps').innerHTML = Array.isArray(rules) ? rules.map(r => '<li><h3>' + esc(r.title) + '</h3><p>' + esc(r.text) + '</p></li>').join('') : '';
  $('scoring').textContent = t('scoringNote', { min: G.guessMinPoints, max: G.guessMaxPoints, bonus: G.drawerAllBonus ?? 50, sec: Math.round((Number(G.emptySkipMs) || 15000) / 1000) });
  fillSelect($('maxSelect'), G.maxPlayersOptions, G.maxPlayers, x => x);
  fillSelect($('partyRounds'), G.roundsOptions, Math.min(2, G.defaultRounds), x => x);
  fillSelect($('partyTime'), G.drawTimeOptions, G.defaultDrawTime, x => t('seconds', { n: x }));
  renderPartyNames(); renderRooms(); updateConn();
  if (onlineState === 'off' && $('onlineNote').dataset.key) $('onlineNote').textContent = t($('onlineNote').dataset.key);
  if (mode && mode.relang) mode.relang();
  if (mode) { buildTools(); $('stage')._h = null; $('plist')._h = null; $('chat')._h = null; $('hint')._h = null; $('sideActions')._h = null; render(); }
}
/* MLBB-style language picker: globe chip -> grid of flags with native names */
function renderLangGrid() {
  $('langGrid').innerHTML = UI_LANGS.filter(l => CFG.i18n[l]).map(l => '<button type="button" class="lang-opt" data-lang="' + l + '" lang="' + (l === 'zh' ? 'zh-CN' : l) + '" aria-pressed="' + (l === LANG) + '">' + flag(l) + '<span>' + esc(langName(l)) + '</span></button>').join('');
}
let langReturn = null;
function openLang() { renderLangGrid(); langReturn = document.activeElement; $('langPop').hidden = false; const cur = $('langGrid').querySelector('[aria-pressed="true"]') || $('langGrid').querySelector('button'); if (cur) cur.focus(); }
function closeLang() { if ($('langPop').hidden) return; $('langPop').hidden = true; if (langReturn && langReturn.focus) langReturn.focus(); }
function setLang(l) { if (!CFG.i18n[l]) return; LANG = l; local.set('dg.lang', l); closeLang(); applyI18n(); }
$('langBtn').addEventListener('click', openLang); $('gLangBtn').addEventListener('click', openLang);
$('langClose').addEventListener('click', closeLang);
$('langPop').addEventListener('click', e => { const b = e.target.closest('[data-lang]'); if (b) setLang(b.dataset.lang); else if (e.target === $('langPop')) closeLang(); });
$('langPop').addEventListener('keydown', e => {
  if (e.key === 'Escape') { e.preventDefault(); closeLang(); return; }
  if (e.key === 'Tab') { const f = Array.from($('langPop').querySelectorAll('button')); const i = f.indexOf(document.activeElement); if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); } else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); } }
});
$('brandLink').addEventListener('click', e => { if (!$('game').hidden) { e.preventDefault(); if (mode && mode.exit) mode.exit(); } });

/* ---------------- boot ---------------- */
partyNames = [1, 2, 3].map(n => '');
$('nameInput').value = local.get('dg.name') || '';
applyI18n(); gmTitle();
/* typed GM claim: no visible chip; a ?gmjd query param (short trigger, not the secret) auto-opens a password prompt in an online room → POST rooms/{code}/gamemaster; code never stored */
function gmClaimUI({ canClaim, claim, onDone, listKey }) {
const d = document, w = window, m = d.createElement('div'), L = 'Kode gamemaster';
m.id = 'gmClaim'; m.setAttribute('role', 'dialog'); m.setAttribute('aria-modal', 'true'); m.setAttribute('aria-label', L); m.style.display = 'none';
m.innerHTML = '<form id="gmClaimForm"><b>' + L + '</b><input id="gmClaimInput" type="password" autocomplete="off" placeholder="Masukkan kode" maxlength="128"><p id="gmClaimErr" role="alert"></p><div><button type="button" id="gmClaimCancel">Batal</button><button type="submit" id="gmClaimOk">Masuk</button></div></form>';
d.body.append(m);
const q = s => m.querySelector(s), inp = q('#gmClaimInput'), er = q('#gmClaimErr'), ok = q('#gmClaimOk'), trig = () => /[?&]gmjd(=|&|$)/i.test(w.location.search || '');
let busy = false, want = trig(), asked = false;
const close = () => { m.style.display = 'none'; inp.value = er.textContent = ''; };
const open = () => { if (!canClaim()) return; close(); m.style.display = 'flex'; setTimeout(() => inp.focus(), 20); };
m.onclick = e => { if (e.target === m) close(); }; q('#gmClaimCancel').onclick = close;
m.onkeydown = e => { e.stopPropagation(); if (e.key === 'Escape') close(); }; m.onkeyup = e => e.stopPropagation();
q('#gmClaimForm').onsubmit = async e => {
e.preventDefault(); e.stopPropagation(); const code = inp.value.trim(); if (!code || busy) return inp.focus();
busy = ok.disabled = true; er.textContent = '';
try { await claim(code); want = false; close(); if (trig() && w.history.replaceState) { const u = new URL(w.location.href); for (const k of [...u.searchParams.keys()]) if (k.toLowerCase() === 'gmjd') u.searchParams.delete(k); w.history.replaceState(w.history.state, '', u.pathname + u.search + u.hash); } sync(); if (onDone) onDone(); }
catch (x) { inp.value = ''; er.textContent = x && x.status === 403 ? 'Kode salah.' : 'Gagal, coba lagi.'; inp.focus(); }
finally { busy = ok.disabled = false; }
};
function sync() { const on = !!canClaim(); if (!on) { asked = false; if (m.style.display !== 'none' && !busy) close(); return; } if (want && !asked) { asked = true; open(); } }
return { sync, open, close };
}
gmUI = gmClaimUI({ listKey: GM_KEY, canClaim: () => !!(mode && mode.kind === 'online' && mode.game.data && !mode.game.isGamemaster()), claim: code => mode.game.claimGamemaster(code), onDone: () => { toast('Mode gamemaster aktif'); requestRender(); } });
const waitCap = setTimeout(() => document.documentElement.classList.remove('dg-wait'), 1500);
packReady.then(ok => { clearTimeout(waitCap); if (ok) applyI18n(); document.documentElement.classList.remove('dg-wait'); });
// invite link (?room=CODE): handled by the JRInvite gate below (name prompt only, or back to the menu with a notice)
const invite = window.JRInvite ? JRInvite.code('room') : '';
const REJOIN_KEY = 'drawguess.rejoin';
function takeRejoin() { try { if (!session) return null; const r = JSON.parse(session.getItem(REJOIN_KEY) || 'null'); session.removeItem(REJOIN_KEY); return r && /^[A-Z2-9]{6}$/.test(r.code) && ['join', 'watch'].includes(r.kind) && Date.now() - (Number(r.at) || 0) < 60000 ? r : null; } catch (e) { return null; } }
window.addEventListener('pagehide', e => {
  if (e.persisted || !mode || mode.kind !== 'online') return;
  const r = mode.game.leaveOnHide();
  if (r && session) { try { session.setItem(REJOIN_KEY, JSON.stringify({ code: r.code, kind: r.kind, at: Date.now() })); } catch (err) { /* ignore */ } }
});
async function resumeSaved() { const g = newGame(); try { await g.resume(); if (!mode) { showGame(new OnlineMode(g)); gmAnnounce(g); } } catch (e) { if (e.status === 403 || e.status === 404) net.forget(); } }
const onlineReady = (async function initOnline() {
  if (!net.allowed) { setOnline('off', t('errOffline')); $('onlineNote').dataset.key = 'errOffline'; return 'offline'; }
  setOnline('checking', t('onlineChecking'));
  try {
    await net.start(); setOnline('ready', t('onlineReady')); loadRooms();
    if (net.code && net.token && (!invite || invite === net.code)) await resumeSaved();
    else if (!net.code) { const r = takeRejoin(); if (r && (!invite || invite === r.code) && $('nameInput').value.trim()) await go(r.kind, r.code); }
    return 'ready';
  } catch (e) { const key = e.code === 'disabled' ? 'errDisabled' : e.code === 'mismatch' ? 'errMismatch' : 'errNetwork'; setOnline('off', t(key), true); $('onlineNote').dataset.key = key; return t(key); }
})();
if (invite) packReady.then(() => { const wl = new URLSearchParams(location.search).get('wl'); JRInvite.run({
  code: invite, lang: LANG, gameName: (CFG.site && CFG.site.name) || '', nameKey: 'dg.name', nameMax: 24, accent: '#ff6a55',
  check: async c => { const st = await onlineReady; if (st === 'offline') return 'offline'; if (st !== 'ready') return { fallback: st }; if (mode && mode.kind === 'online' && net.code === c) return 'session'; return JRInvite.probe(c); },
  join: name => { $('nameInput').value = name; $('codeInput').value = invite; return go('join', invite); },
  fallback: msg => { $('codeInput').value = ''; if (msg) note(msg, true); if (!mode) { const p = $('play'); if (p) p.scrollIntoView({ block: 'start' }); if (net.code && net.token && onlineState === 'ready') resumeSaved(); } }
});
  // word language of the invited room (from the link), shown on the invite card
  const code = document.querySelector('.jr-inv-card .jr-inv-code');
  if (code && wl && (wl === 'multi' || (CFG.langs && CFG.langs[wl]))) code.insertAdjacentHTML('afterend', '<p class="dg-inv-lang">' + flag(wl) + '<span>' + esc(t('wordLangTag', { lang: langName(wl) })) + '</span></p>');
  if (wl && history.replaceState) { const u = new URL(location.href); u.searchParams.delete('wl'); history.replaceState(history.state, '', u.pathname + u.search + u.hash); }
});
window.addEventListener('online', () => { if (onlineState === 'ready') net.visible(); });
// one catch-up read when the tab comes back (browsers may have throttled or dropped the socket meanwhile)
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && onlineState === 'ready') net.visible(); });
})();

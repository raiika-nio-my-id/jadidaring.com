/* JaRing kit: tiny shared helpers (localStorage, toast, WebAudio SFX, mute, screens). window.JDK */
(function (root) {
'use strict';
const doc = document, $ = id => doc.getElementById(id);
const getLS = k => { try { return root.localStorage.getItem(k); } catch (e) { return null; } }, setLS = (k, v) => { try { root.localStorage.setItem(k, v); } catch (e) { /* private */ } };
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function toast(msg, kind, ms) { const box = $('toasts'); if (!box) return; for (const o of box.children) if (o.textContent === msg) o.remove(); const t = doc.createElement('div'); t.className = 'toast ' + (kind || ''); t.textContent = msg; box.appendChild(t); setTimeout(() => t.remove(), ms || 2200); while (box.children.length > 3) box.firstChild.remove(); }
function show(id, hubOn) { for (const s of doc.querySelectorAll('.screen')) s.hidden = s.id !== id; doc.documentElement.classList.toggle('jr-hub-off', !(hubOn || id === 'home')); }
const Snd = { muted: false, key: null, AC: null };
function ac() { if (Snd.muted) return null; try { if (!Snd.AC) Snd.AC = new (root.AudioContext || root.webkitAudioContext)(); if (Snd.AC.state === 'suspended') Snd.AC.resume(); } catch (e) { Snd.AC = null; } return Snd.AC; }
function tone(f, d, type, vol, f2, delay) { const a = ac(); if (!a) return; const t = a.currentTime + (delay || 0), o = a.createOscillator(), g = a.createGain(); o.type = type || 'square'; o.frequency.setValueAtTime(f, t); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + d); g.gain.setValueAtTime(vol || 0.06, t); g.gain.exponentialRampToValueAtTime(0.0001, t + d); o.connect(g).connect(a.destination); o.start(t); o.stop(t + d + 0.02); }
function noise(d, vol, hp, delay, lp) { const a = ac(); if (!a) return; const b = a.createBuffer(1, Math.max(1, a.sampleRate * d), a.sampleRate), ch = b.getChannelData(0); for (let i = 0; i < ch.length; i++) ch[i] = (Math.random() * 2 - 1) * (1 - i / ch.length); const s = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain(); f.type = lp ? 'lowpass' : 'highpass'; f.frequency.value = lp || hp || 800; g.gain.value = vol || 0.12; s.buffer = b; s.connect(f).connect(g).connect(a.destination); s.start(a.currentTime + (delay || 0)); }
function initMute(key, ids, onChange) {
  Snd.key = key; Snd.muted = getLS(key) === '1';
  const paint = () => ids.forEach(id => { const b = $(id); if (b) { b.textContent = Snd.muted ? '🔇' : '🔊'; b.setAttribute('aria-pressed', Snd.muted ? 'true' : 'false'); } });
  const toggle = () => { Snd.muted = !Snd.muted; setLS(key, Snd.muted ? '1' : '0'); paint(); if (!Snd.muted) tone(660, 0.05, 'square', 0.04); if (onChange) onChange(Snd.muted); };
  ids.forEach(id => { const b = $(id); if (b) b.addEventListener('click', toggle); });
  doc.addEventListener('keydown', e => { if (e.target && /INPUT|TEXTAREA/.test(e.target.tagName)) return; if (e.key === 'm' || e.key === 'M') toggle(); });
  paint(); return toggle;
}
const buzz = ms => { try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) { /* no */ } };
/* seeded PRNG (mulberry32) */
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function fitCanvas(c) { const W = c.clientWidth || 360, H = c.clientHeight || 640, r = Math.min(2, root.devicePixelRatio || 1); if (c.width !== Math.round(W * r) || c.height !== Math.round(H * r)) { c.width = Math.round(W * r); c.height = Math.round(H * r); } const g = c.getContext('2d'); g.setTransform(r, 0, 0, r, 0, 0); return { g, W, H, r }; }
root.JDK = Object.assign(root.JDK || {}, { $, getLS, setLS, esc, toast, show, Snd, ac, tone, noise, initMute, buzz, rng, fitCanvas });
})(window);

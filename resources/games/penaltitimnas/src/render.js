/* Penalti Timnas renderer: night stadium (ring roof, red-white crowd wave, flares), pitch in perspective, goal + net, keeper & kicker, ball flight, replay zoom. window.PR */
(function (root) {
'use strict';
const P = root.PT, TAU = Math.PI * 2, clamp = (v, a, b) => Math.max(a, Math.min(b, v)), lerp = (a, b, t) => a + (b - a) * t, ease = t => 1 - Math.pow(1 - clamp(t, 0, 1), 3);
let crowd = null, cW = 0, cH = 0; const parts = [];
function layout(W, H) {
  const GW = Math.min(W * 0.84, H * 0.56), GH = GW * 0.34, gy = H * 0.5;
  return { W, H, cx: W / 2, hz: H * 0.3, gy, GW, GH, by: H * 0.79, br: clamp(W * 0.042, 12, 22) };
}
const g2s = (L, x, y) => [L.cx + x * L.GW / 2, L.gy - y * L.GH];
const s2g = (L, sx, sy) => [(sx - L.cx) / (L.GW / 2), (L.gy - sy) / L.GH];
/* timeline */
const RUN = 0.55;
const flyT = o => 0.62 - 0.22 * Math.min(o.p, 1.1);
const arriveT = o => RUN + flyT(o);
const animLen = o => arriveT(o) + 1.25;
function ballAt(L, o, t) {
  const [sx, sy] = [L.cx, L.by]; let [tx, ty] = g2s(L, o.x, o.y);
  if (t < RUN) return { x: sx, y: sy, r: L.br, sh: 1, z: 0 };
  const F = flyT(o), u = (t - RUN) / F;
  if (u <= 1) { const k = ease(u * 0.9 + 0.1 * u * u), arc = Math.sin(Math.PI * u) * L.GH * (0.25 + 0.25 * o.p); return { x: lerp(sx, tx, k), y: lerp(sy, ty, k) - arc * (1 - o.y * 0.4), r: lerp(L.br, L.br * 0.42, k), sh: 1 - k * 0.6, z: u }; }
  const a = t - RUN - F, r0 = L.br * 0.42;
  if (o.out === 'goal') { const q = ease(a / 0.18), fall = clamp((a - 0.12) / 0.45, 0, 1); const bx = tx + (tx - L.cx) * 0.06 * q, byy = lerp(ty - L.GH * 0.04 * q, L.gy - L.GH * 0.1, fall * fall); return { x: bx, y: byy - Math.abs(Math.sin(fall * 5)) * (1 - fall) * L.GH * 0.06, r: r0 * (1 - 0.14 * q), sh: 0.4, z: 2 }; }
  if (o.out === 'save' || o.out === 'post' || o.out === 'bar') {
    const dir = o.out === 'save' ? (Math.sign(o.x - o.kx) || (o.x >= 0 ? 1 : -1)) : -Math.sign(o.x) || 1, up = o.out === 'bar' ? -1 : 0.4;
    const q = clamp(a / 0.9, 0, 1), k = ease(q);
    return { x: tx + dir * L.GW * 0.38 * k, y: ty + (L.by - ty) * 0.55 * k - Math.sin(Math.PI * q) * L.GH * (0.35 + up * 0.3), r: lerp(r0, L.br * 0.75, k), sh: 0.6, z: 1 };
  }
  // wide / over: keep flying
  const vx = (tx - sx) / F, vy = (ty - sy) / F, q = clamp(a / 0.6, 0, 1);
  return { x: tx + vx * a * 0.6, y: ty + vy * a * 0.6 - a * a * L.GH * 0.2, r: r0 * (1 - 0.3 * q), sh: 0, z: 3, fade: q };
}
function keeperAt(L, o, t, idle) {
  if (!o || t < 0.47) return { x: Math.sin(idle * 3.1) * 0.06, y: 0, ang: 0, q: 0 };
  const q = ease((t - 0.47) / 0.42), side = Math.abs(o.kx) < 0.25 ? 0 : Math.sign(o.kx), reach = side ? Math.min(1, Math.abs(o.kx) / 0.7) : 0;
  return { x: o.kx * q * 0.86, y: Math.max(0, (o.ky - 0.25)) * q * 0.9, ang: -side * q * 1.25 * reach, q, side };
}
/* ---- painters ---- */
function buildCrowd(L) {
  const r = P.rng(77), dots = [], tiers = 4;
  for (let t = 0; t < tiers; t++) {
    const y0 = L.H * 0.06 + t * L.H * 0.055, n = Math.round(L.W / 7);
    for (let i = 0; i < n; i++) { const x = (i + r() * 0.6) / n * L.W, curve = Math.pow((x - L.cx) / L.W, 2) * L.H * 0.12; const c = r(); dots.push({ x, y: y0 + curve + r() * L.H * 0.04, c: c < 0.55 ? '#e0242f' : c < 0.85 ? '#f4f1ea' : c < 0.93 ? '#ffd23f' : '#3a4a8a', s: 2 + r() * 2 + t * 0.6, ph: r() * TAU }); }
  }
  return dots;
}
function stadium(g, L, now, ex) {
  const { W, H, hz } = L;
  let gr = g.createLinearGradient(0, 0, 0, hz); gr.addColorStop(0, '#060d24'); gr.addColorStop(1, '#1b2f66'); g.fillStyle = gr; g.fillRect(0, 0, W, hz + 2);
  // ring roof (temu gelang style)
  g.strokeStyle = 'rgba(190,205,255,.35)'; g.lineWidth = 3; g.beginPath(); g.ellipse(L.cx, H * 0.02, W * 0.75, H * 0.09, 0, 0, Math.PI); g.stroke();
  g.lineWidth = 1; for (let i = 0; i < 18; i++) { const a = i / 17 * Math.PI; g.beginPath(); g.moveTo(L.cx + Math.cos(a) * W * 0.75, H * 0.02 + Math.sin(a) * H * 0.09); g.lineTo(L.cx + Math.cos(a) * W * 0.8, H * 0.02 + Math.sin(a) * H * 0.13 - 4); g.stroke(); }
  // stands
  g.fillStyle = '#15204a'; g.beginPath(); g.moveTo(0, H * 0.06); g.quadraticCurveTo(L.cx, H * 0.02, W, H * 0.06); g.lineTo(W, hz); g.lineTo(0, hz); g.fill();
  for (let t = 0; t < 5; t++) { const y = H * 0.06 + t * H * 0.055; g.fillStyle = t % 2 ? 'rgba(255,255,255,.03)' : 'rgba(0,0,0,.18)'; g.beginPath(); g.moveTo(0, y + H * 0.012); g.quadraticCurveTo(L.cx, y - H * 0.02, W, y + H * 0.012); g.lineTo(W, y + H * 0.03); g.quadraticCurveTo(L.cx, y, 0, y + H * 0.03); g.fill(); }
  if (!crowd || cW !== W || cH !== H) { crowd = buildCrowd(L); cW = W; cH = H; }
  const wave = now * 2.2;
  for (const d of crowd) { const w = Math.max(0, Math.sin(wave - d.x / W * 7)); const j = (w * w * 3 + Math.max(0, Math.sin(now * 9 + d.ph)) * ex * 4); g.fillStyle = d.c; g.fillRect(d.x, d.y - j, d.s, d.s * 1.4); }
  // flags
  for (let i = 0; i < 3; i++) { const fx = W * (0.18 + i * 0.32), fy = H * 0.12 + i % 2 * H * 0.04, wv = Math.sin(now * 3 + i) * 4; g.fillStyle = '#e0242f'; g.beginPath(); g.moveTo(fx, fy); g.quadraticCurveTo(fx + 14, fy - 4 + wv, fx + 30, fy + wv); g.lineTo(fx + 30, fy + 9 + wv); g.quadraticCurveTo(fx + 14, fy + 5 + wv, fx, fy + 9); g.fill(); g.fillStyle = '#fff'; g.beginPath(); g.moveTo(fx, fy + 9); g.quadraticCurveTo(fx + 14, fy + 5 + wv, fx + 30, fy + 9 + wv); g.lineTo(fx + 30, fy + 18 + wv); g.quadraticCurveTo(fx + 14, fy + 14 + wv, fx, fy + 18); g.fill(); }
  // floodlights
  for (const fx of [W * 0.06, W * 0.94]) { const rg = g.createRadialGradient(fx, H * 0.035, 2, fx, H * 0.035, W * 0.35); rg.addColorStop(0, 'rgba(255,255,235,.95)'); rg.addColorStop(0.08, 'rgba(255,255,220,.35)'); rg.addColorStop(1, 'rgba(255,255,220,0)'); g.fillStyle = rg; g.fillRect(0, 0, W, hz); }
  // flares when excited
  if (ex > 0.3) for (let i = 0; i < 5; i++) { const fx = W * (0.1 + i * 0.2) + Math.sin(now + i) * 6, fy = H * 0.15 + (i % 2) * H * 0.05; const rg = g.createRadialGradient(fx, fy, 1, fx, fy, 26 * ex); rg.addColorStop(0, 'rgba(255,230,180,' + ex + ')'); rg.addColorStop(0.3, 'rgba(255,60,30,' + 0.6 * ex + ')'); rg.addColorStop(1, 'rgba(255,40,20,0)'); g.fillStyle = rg; g.fillRect(fx - 30, fy - 30, 60, 60); }
  // ad boards
  const ay = hz - H * 0.035; g.fillStyle = '#0a1230'; g.fillRect(0, ay, W, H * 0.035);
  g.font = '900 ' + Math.round(H * 0.022) + 'px system-ui,sans-serif'; g.textBaseline = 'middle'; g.textAlign = 'center';
  const ads = ['AYO GARUDA', 'JADIDARING', 'MERAH PUTIH', 'GAME HUB']; const off = (now * 30) % (W / 2);
  for (let i = -1; i < 5; i++) { const x = i * W / 2 - off + W / 4; g.fillStyle = i % 2 ? '#ffd23f' : '#fff'; g.fillText(ads[(i + 4) % 4], x, ay + H * 0.018); }
}
function pitch(g, L) {
  const { W, H, hz, gy } = L; const gr = g.createLinearGradient(0, hz, 0, H); gr.addColorStop(0, '#1d7a3c'); gr.addColorStop(1, '#2fa152'); g.fillStyle = gr; g.fillRect(0, hz, W, H - hz);
  // mowing wedges converging to a vanishing point (oblique ground plane)
  { const vx = L.cx, vy = hz - H * 0.55; g.fillStyle = 'rgba(255,255,255,.045)'; for (let i = -9; i <= 9; i += 2) { const x0 = L.cx + i * W * 0.16, x1 = L.cx + (i + 1) * W * 0.16, k0 = (H - vy) / (hz - vy); g.beginPath(); g.moveTo(vx + (x0 - vx) / k0, hz); g.lineTo(vx + (x1 - vx) / k0, hz); g.lineTo(x1, H); g.lineTo(x0, H); g.fill(); } }
  // stripes
  let y = hz, k = 0, h = 6; while (y < H) { if (k % 2) { g.fillStyle = 'rgba(255,255,255,.05)'; g.fillRect(0, y, W, h); } y += h; h *= 1.28; k++; }
  g.strokeStyle = 'rgba(255,255,255,.85)'; g.lineWidth = 2;
  g.beginPath(); g.moveTo(0, gy); g.lineTo(W, gy); g.stroke(); // goal line
  const bw = L.GW * 0.78, sixY = gy + (L.by - gy) * 0.28; g.beginPath(); g.moveTo(L.cx - bw, gy); g.lineTo(L.cx - bw * 1.12, sixY); g.lineTo(L.cx + bw * 1.12, sixY); g.lineTo(L.cx + bw, gy); g.stroke();
  const pw = L.GW * 1.6, boxY = gy + (L.by - gy) * 1.25; g.beginPath(); g.moveTo(L.cx - pw, gy); g.lineTo(L.cx - pw * 1.35, boxY); g.lineTo(L.cx + pw * 1.35, boxY); g.lineTo(L.cx + pw, gy); g.stroke();
  g.beginPath(); g.ellipse(L.cx, boxY, L.GW * 0.5, (H - boxY) * 0.25, 0, 0, Math.PI); g.stroke();
  g.fillStyle = '#fff'; g.beginPath(); g.ellipse(L.cx, L.by + L.br * 0.9, 5, 2.4, 0, 0, TAU); g.fill();
}
function goalBack(g, L, bulge) {
  const [lx, ty] = g2s(L, -1, 1), [rx] = g2s(L, 1, 1), d = L.GH * 0.42;
  g.fillStyle = 'rgba(10,20,40,.25)'; g.beginPath(); g.moveTo(lx, L.gy); g.lineTo(lx + d * 0.4, L.gy - d * 0.25); g.lineTo(lx + d * 0.4, ty - d * 0.3); g.lineTo(rx - d * 0.4, ty - d * 0.3); g.lineTo(rx - d * 0.4, L.gy - d * 0.25); g.lineTo(rx, L.gy); g.closePath(); g.fill();
  g.strokeStyle = 'rgba(255,255,255,.38)'; g.lineWidth = 1;
  const off = (x, y) => { if (!bulge) return [x, y]; const dx = x - bulge.x, dy = y - bulge.y, dd = Math.hypot(dx, dy), f = bulge.a * Math.exp(-dd * dd / (L.GH * L.GH * 0.18)); return [x + dx * f * 0.3, y + dy * f * 0.3 - f * 4]; };
  const nx = 18, ny = 7;
  for (let i = 0; i <= nx; i++) { g.beginPath(); for (let j = 0; j <= ny; j++) { const x = lerp(lx + d * 0.4, rx - d * 0.4, i / nx), y = lerp(ty - d * 0.3, L.gy - d * 0.25, j / ny); const [a, b] = off(x, y); j ? g.lineTo(a, b) : g.moveTo(a, b); } g.stroke(); }
  for (let j = 0; j <= ny; j++) { g.beginPath(); for (let i = 0; i <= nx; i++) { const x = lerp(lx + d * 0.4, rx - d * 0.4, i / nx), y = lerp(ty - d * 0.3, L.gy - d * 0.25, j / ny); const [a, b] = off(x, y); i ? g.lineTo(a, b) : g.moveTo(a, b); } g.stroke(); }
  for (let j = 0; j <= 4; j++) { const t = j / 4; g.beginPath(); g.moveTo(lx, lerp(ty, L.gy, t)); g.lineTo(lx + d * 0.4, lerp(ty - d * 0.3, L.gy - d * 0.25, t)); g.moveTo(rx, lerp(ty, L.gy, t)); g.lineTo(rx - d * 0.4, lerp(ty - d * 0.3, L.gy - d * 0.25, t)); g.stroke(); }
}
function goalFrame(g, L, shake) {
  const [lx, ty] = g2s(L, -1, 1), [rx] = g2s(L, 1, 1), w = Math.max(4, L.GW * 0.018), s = shake || 0;
  g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(lx - w / 2 + 3, L.gy - 2, rx - lx + w, 4);
  for (const px of [lx, rx]) { const pg = g.createLinearGradient(px - w / 2 + s, 0, px + w / 2 + s, 0); pg.addColorStop(0, '#ffffff'); pg.addColorStop(0.55, '#e9eae4'); pg.addColorStop(1, '#9ea3a8'); g.fillStyle = pg; g.fillRect(px - w / 2 + s, ty - w / 2, w, L.gy - ty + w / 2); }
  { const cg = g.createLinearGradient(0, ty - w / 2, 0, ty + w / 2); cg.addColorStop(0, '#ffffff'); cg.addColorStop(1, '#b8bcc0'); g.fillStyle = cg; g.fillRect(lx - w / 2 + s, ty - w / 2, rx - lx + w, w); }
  softShadow(g, lx + (rx - lx) / 2 + w, L.gy + 2, (rx - lx) * 0.55, L.GH * 0.06, 0.25);
  g.fillStyle = 'rgba(0,0,0,.12)'; g.fillRect(lx + w * 0.15 + s, ty, w * 0.3, L.gy - ty);
}
function person(g, x, fy, h, kit, o) {
  // o: {ang, back, arms, leg, glove, num}
  o = o || {}; g.save(); g.translate(x, fy - h * 0.5); g.rotate(o.ang || 0);
  const sh = kit.a, tr = kit.b, skin = o.skin || '#c98a5a', hw = h * 0.17;
  // legs
  g.strokeStyle = '#1a1a2a'; g.lineCap = 'round'; g.lineWidth = h * 0.09; const lg = o.leg || 0;
  g.beginPath(); g.moveTo(-hw * 0.45, h * 0.12); g.lineTo(-hw * 0.6 - lg * h * 0.1, h * 0.48); g.moveTo(hw * 0.45, h * 0.12); g.lineTo(hw * 0.6 + lg * h * 0.25, h * 0.48 - lg * h * 0.12); g.stroke();
  g.strokeStyle = skin; g.lineWidth = h * 0.06; g.beginPath(); g.moveTo(-hw * 0.55, h * 0.3); g.lineTo(-hw * 0.6 - lg * h * 0.1, h * 0.46); g.stroke();
  // shorts
  g.fillStyle = tr; g.fillRect(-hw, h * 0.02, hw * 2, h * 0.14);
  // arms
  const ar = o.arms || 0; g.strokeStyle = sh; g.lineWidth = h * 0.075;
  g.beginPath(); g.moveTo(-hw * 0.9, -h * 0.25); g.lineTo(-hw * 1.4 - ar * h * 0.25, -h * 0.05 - ar * h * 0.42); g.moveTo(hw * 0.9, -h * 0.25); g.lineTo(hw * 1.4 + ar * h * 0.25, -h * 0.05 - ar * h * 0.42); g.stroke();
  if (o.glove) { g.fillStyle = o.glove; for (const s of [-1, 1]) { g.beginPath(); g.arc(s * (hw * 1.4 + ar * h * 0.25), -h * 0.05 - ar * h * 0.42, h * 0.065, 0, TAU); g.fill(); } }
  // torso (painted: light from the floodlights top-left, dark outline)
  g.fillStyle = sh; g.beginPath(); g.moveTo(-hw, -h * 0.3); g.lineTo(hw, -h * 0.3); g.lineTo(hw * 0.9, h * 0.04); g.lineTo(-hw * 0.9, h * 0.04); g.closePath(); g.fill(); g.strokeStyle = 'rgba(10,10,24,.55)'; g.lineWidth = Math.max(1, h * 0.012); g.stroke();
  { const tg = g.createLinearGradient(-hw, -h * 0.3, hw, h * 0.04); tg.addColorStop(0, 'rgba(255,255,255,.22)'); tg.addColorStop(0.5, 'rgba(255,255,255,0)'); tg.addColorStop(1, 'rgba(0,0,30,.28)'); g.fillStyle = tg; g.fill(); }
  g.fillStyle = tr; g.fillRect(-hw, -h * 0.3, hw * 2, h * 0.04);
  if (o.back && o.num) { g.fillStyle = kit.c; g.font = '900 ' + Math.round(h * 0.16) + 'px system-ui,sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(o.num, 0, -h * 0.12); }
  // head
  g.fillStyle = skin; g.beginPath(); g.arc(0, -h * 0.4, h * 0.09, 0, TAU); g.fill(); g.strokeStyle = 'rgba(10,10,24,.45)'; g.lineWidth = Math.max(1, h * 0.01); g.stroke(); g.fillStyle = '#1b130e'; g.beginPath(); g.arc(0, -h * 0.42 - (o.back ? -h * 0.01 : h * 0.01), h * 0.092, Math.PI * (o.back ? 0.9 : 1.05), Math.PI * (o.back ? 2.1 : 1.95)); g.fill(); if (o.back) { g.beginPath(); g.arc(0, -h * 0.41, h * 0.085, 0, TAU); g.fill(); }
  g.restore();
}
function softShadow(g, x, y, rx, ry, a) { const gr = g.createRadialGradient(x, y, 0, x, y, rx); gr.addColorStop(0, 'rgba(0,8,4,' + a + ')'); gr.addColorStop(0.6, 'rgba(0,8,4,' + a * 0.5 + ')'); gr.addColorStop(1, 'rgba(0,8,4,0)'); g.save(); g.translate(x, y); g.scale(1, ry / rx); g.translate(-x, -y); g.fillStyle = gr; g.beginPath(); g.arc(x, y, rx, 0, TAU); g.fill(); g.restore(); }
function ball(g, b, alpha) {
  if (alpha != null) g.globalAlpha = alpha; const bg = g.createRadialGradient(b.x - b.r * 0.35, b.y - b.r * 0.4, b.r * 0.1, b.x, b.y, b.r); bg.addColorStop(0, '#ffffff'); bg.addColorStop(0.7, '#eef0f4'); bg.addColorStop(1, '#a9afbd'); g.fillStyle = bg; g.beginPath(); g.arc(b.x, b.y, b.r, 0, TAU); g.fill(); g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 1; g.stroke();
  g.fillStyle = '#1a1a2a'; g.beginPath(); g.arc(b.x, b.y, b.r * 0.32, 0, TAU); g.fill(); for (let i = 0; i < 5; i++) { const a = i / 5 * TAU + (b.spin || 0); g.beginPath(); g.arc(b.x + Math.cos(a) * b.r * 0.78, b.y + Math.sin(a) * b.r * 0.78, b.r * 0.2, 0, TAU); g.fill(); }
  g.globalAlpha = 1;
}
function burst(x, y, n, cols) { for (let i = 0; i < n; i++) { const a = Math.random() * TAU, s = 80 + Math.random() * 260; parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 160, life: 1 + Math.random() * 0.8, c: cols[i % cols.length], w: 3 + Math.random() * 4, rot: Math.random() * TAU }); } }
function stepParts(g, dt) { for (let i = parts.length - 1; i >= 0; i--) { const p = parts[i]; p.life -= dt; if (p.life <= 0) { parts.splice(i, 1); continue; } p.vy += 380 * dt; p.vx *= 0.99; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += dt * 8; g.save(); g.globalAlpha = Math.min(1, p.life); g.translate(p.x, p.y); g.rotate(p.rot); g.fillStyle = p.c; g.fillRect(-p.w / 2, -p.w * 0.3, p.w, p.w * 0.6); g.restore(); } }
/** main scene. st: {now, dt, anim:{o,t,kKit,gKit,num,replay}, ex, aim:{x,y,p,live}, keep:{x,y,show}, kKit, gKit} */
function scene(g, L, st) {
  const A = st.anim, o = A && A.o, t = A ? A.t : 0;
  g.save();
  if (A && A.replay) { const z = 1.4, fx = L.cx, fy = L.gy - L.GH * 0.3; g.translate(fx, fy); g.scale(z, z); g.translate(-fx, -fy + L.H * 0.06); }
  { const par = (o ? (ballAt(L, o, t).x - L.cx) : (st.aim ? (g2s(L, st.aim.x, 0)[0] - L.cx) : Math.sin(st.now * 0.2) * L.W * 0.05)) * -0.04; g.save(); g.translate(L.cx, 0); g.scale(1.05, 1); g.translate(-L.cx + par, 0); stadium(g, L, st.now, st.ex || 0); g.restore(); } pitch(g, L);
  const b = o ? ballAt(L, o, t) : { x: L.cx, y: L.by, r: L.br, sh: 1, z: 0 };
  b.spin = o ? t * 18 * (o.p || 0.5) : 0;
  const bul = o && o.out === 'goal' && t > arriveT(o) ? { x: g2s(L, o.x, o.y)[0], y: g2s(L, o.x, o.y)[1], a: Math.max(0, 1 - (t - arriveT(o)) * 1.4) * 1.2 } : null;
  goalBack(g, L, bul);
  const behind = o && (o.out === 'goal' || o.out === 'over' || o.out === 'wide') && b.z >= 2;
  if (behind) ball(g, b, b.fade != null ? 1 - b.fade : 1);
  // keeper
  const K = keeperAt(L, o, t, st.now), kh = L.GH * 0.82, [kx] = g2s(L, K.x, 0);
  softShadow(g, kx, L.gy + 2, kh * 0.26, kh * 0.05, 0.4);
  person(g, kx + (K.side || 0) * kh * 0.15 * K.q, L.gy - K.y * L.GH, kh, st.gKit || P.KITS[1], { ang: K.ang, arms: o ? 0.4 + K.q * 0.6 : 0.35 + Math.sin(st.now * 3) * 0.08, glove: '#9cff5a', leg: K.q * 0.3 });
  const shake = o && (o.out === 'post' || o.out === 'bar') && t > arriveT(o) ? Math.sin(t * 80) * Math.max(0, 1 - (t - arriveT(o)) * 2) * 3 : 0;
  goalFrame(g, L, shake);
  // shadow + ball
  if (!behind) { if (b.sh > 0) { const shy = o && t > RUN ? lerp(L.by + L.br * 0.9, L.gy, clamp((t - RUN) / flyT(o), 0, 1)) : L.by + L.br * 0.9; softShadow(g, b.x, shy, b.r * 1.3, b.r * 0.42, 0.45 * b.sh); } ball(g, b, b.fade != null ? 1 - b.fade : 1); }
  // kicker from behind
  const kk = st.kKit || P.KITS[0], ph = o ? clamp(t / RUN, 0, 1) : 0, kH = L.H * 0.26;
  const kxp = lerp(L.cx - L.W * 0.2, L.cx - L.br * 1.6, ph), kyp = lerp(L.H * 1.06, L.by + L.br * 1.6, ph);
  if (!st.noKicker && (!A || !A.replay || t < 1.1)) softShadow(g, kxp, kyp, kH * 0.22, kH * 0.05, 0.42);
  if (!st.noKicker && (!A || !A.replay || t < 1.1)) person(g, kxp, kyp + Math.abs(Math.sin(ph * 9)) * -6, kH, kk, { back: true, num: st.num || '10', leg: o && t > RUN - 0.12 && t < RUN + 0.3 ? 1 : 0, arms: 0.15 + ph * 0.2 });
  // aim overlay
  if (st.aim) { const [ax, ay] = g2s(L, st.aim.x, st.aim.y); g.strokeStyle = 'rgba(255,255,255,.75)'; g.setLineDash([4, 6]); g.lineWidth = 2; g.beginPath(); g.moveTo(L.cx, L.by); g.quadraticCurveTo((L.cx + ax) / 2, (L.by + ay) / 2 - L.GH * 0.4, ax, ay); g.stroke(); g.setLineDash([]);
    const rr = L.GH * 0.11; g.strokeStyle = st.aim.p > 1 ? '#ff5a4d' : st.aim.p >= 0.5 ? '#5dff9a' : '#ffd23f'; g.lineWidth = 3; g.beginPath(); g.arc(ax, ay, rr, 0, TAU); g.moveTo(ax - rr * 1.5, ay); g.lineTo(ax + rr * 1.5, ay); g.moveTo(ax, ay - rr * 1.5); g.lineTo(ax, ay + rr * 1.5); g.stroke();
    // power gauge
    const gx = L.cx + L.br * 3.2, gh = L.H * 0.14, gy0 = L.by + L.br - gh; g.fillStyle = 'rgba(0,0,0,.45)'; g.fillRect(gx, gy0, 12, gh); g.fillStyle = 'rgba(93,255,154,.55)'; g.fillRect(gx, gy0 + gh * (1 - 0.95 / 1.3), 12, gh * 0.4 / 1.3); const pv = clamp(st.aim.p, 0, 1.3) / 1.3; g.fillStyle = st.aim.p > 1 ? '#ff5a4d' : '#fff'; g.fillRect(gx - 3, gy0 + gh * (1 - pv) - 2, 18, 4); }
  if (st.keep && st.keep.show) { g.strokeStyle = 'rgba(255,255,255,.28)'; g.lineWidth = 1; g.font = '800 ' + Math.round(L.GH * 0.16) + 'px system-ui'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = 'rgba(255,255,255,.45)'; let n = 1; for (const zy of [0.72, 0.26]) for (const zx of [-0.66, 0, 0.66]) { const [a, c] = g2s(L, zx, zy); g.strokeRect(a - L.GW / 6 + 3, c - L.GH / 4 + 3, L.GW / 3 - 6, L.GH / 2 - 6); g.fillText(String(n++), a, c); } }
  if (st.keep && st.keep.x != null) { const [a, c] = g2s(L, st.keep.x, st.keep.y); g.fillStyle = 'rgba(156,255,90,.9)'; g.beginPath(); g.arc(a, c, L.GH * 0.1, 0, TAU); g.fill(); g.fillStyle = '#183'; g.font = '900 ' + Math.round(L.GH * 0.12) + 'px system-ui'; g.fillText('🧤', a, c + 1); }
  stepParts(g, st.dt || 0.016);
  g.restore();
  const vg = g.createRadialGradient(L.cx, L.H * 0.5, L.H * 0.3, L.cx, L.H * 0.5, L.H * 0.75); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,20,.35)'); g.fillStyle = vg; g.fillRect(0, 0, L.W, L.H);
  if (A && A.replay) { const bh = L.H * 0.07; g.fillStyle = '#000'; g.fillRect(0, 0, L.W, bh); g.fillRect(0, L.H - bh, L.W, bh); g.fillStyle = '#ff3b3b'; g.beginPath(); g.arc(18, bh + 18, 6, 0, TAU); g.fill(); g.fillStyle = '#fff'; g.font = '900 15px system-ui'; g.textAlign = 'left'; g.textBaseline = 'middle'; g.fillText('REPLAY · GERAK LAMBAT', 30, bh + 18); }
}
function kitIcon(c, kit) { const x = c.getContext('2d'), s = c.width; x.clearRect(0, 0, s, s); x.fillStyle = kit.a; x.beginPath(); x.moveTo(s * 0.3, s * 0.12); x.lineTo(s * 0.7, s * 0.12); x.lineTo(s * 0.95, s * 0.3); x.lineTo(s * 0.82, s * 0.45); x.lineTo(s * 0.74, s * 0.38); x.lineTo(s * 0.74, s * 0.9); x.lineTo(s * 0.26, s * 0.9); x.lineTo(s * 0.26, s * 0.38); x.lineTo(s * 0.18, s * 0.45); x.lineTo(s * 0.05, s * 0.3); x.closePath(); x.fill(); x.strokeStyle = kit.b; x.lineWidth = s * 0.06; x.stroke(); x.fillStyle = kit.c; x.font = '900 ' + Math.round(s * 0.32) + 'px system-ui'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('10', s * 0.5, s * 0.6); }
root.PR = { layout, g2s, s2g, scene, ballAt, keeperAt, arriveT, animLen, RUN, burst, kitIcon, parts };
})(window);

// Local gamehub snapshot (the site isn't deployed yet): serve index.html under its real origin, open #demo (3 bots, HP 5),
// wait for a clash, capture 1280×800 and encode WebP exactly like /workspace/gaming/tools/snapshot.js (≤14 KB target).
const { chromium } = require('playwright-core'); const fs = require('fs'), path = require('path');
const HTML = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8'), ORIGIN = 'https://pedangsihir.jadidaring.com';
const OUT = process.argv[2] || '/workspace/gaming/snapshots/pedangsihir.webp', MAX = 14 * 1024;
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const ctx = await b.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 }), p = await ctx.newPage();
  await p.route('**/*', r => { const u = new URL(r.request().url()); if (u.origin !== ORIGIN) return r.abort(); if (u.pathname.startsWith('/api/')) return r.fulfill({ status: 503, body: '{}' }); return r.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: HTML }); });
  await p.goto(ORIGIN + '/#demo'); await p.waitForFunction(() => window.PSApp && PSApp.mode && PSApp.mode.kind === 'demo');
  await p.waitForFunction(() => PSApp.mode.ph === 'clash' && PSApp.mode.n >= 2 && PSApp.mode.lastRes && PSApp.mode.lastRes.dmg.length, null, { timeout: 40000 }); await p.waitForTimeout(1500);
  const png = await p.screenshot({ type: 'png' }); fs.writeFileSync('/tmp/ps-snap.png', png);
  const r = await p.evaluate(async ({ b64, maxBytes }) => {
    const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
    const enc = (w, q) => { const h = Math.round(img.naturalHeight * w / img.naturalWidth), c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); x.imageSmoothingQuality = 'high'; x.drawImage(img, 0, 0, w, h); const url = c.toDataURL('image/webp', q); return { url, w, h, q, bytes: Math.floor((url.length - 23) * 3 / 4) }; };
    let best = null; for (const w of [640, 560, 480, 400]) for (const q of [0.82, 0.75, 0.68, 0.6, 0.52, 0.45, 0.38]) { const x = enc(w, q); best = x; if (x.bytes <= maxBytes) return x; } return best;
  }, { b64: png.toString('base64'), maxBytes: MAX });
  fs.writeFileSync(OUT, Buffer.from(r.url.split(',')[1], 'base64')); fs.writeFileSync('/tmp/ps-snap.json', JSON.stringify({ url: r.url, w: r.w, h: r.h }));
  console.log(OUT, r.w + 'x' + r.h, 'q=' + r.q, (r.bytes / 1024).toFixed(1) + ' KB'); await b.close();
})().catch(e => { console.error(e); process.exit(1); });

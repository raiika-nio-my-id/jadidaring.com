// Game Hub snapshot from a local screenshot (menu shot: title + pink monsters), encoded WebP like gaming/tools/snapshot.js (≤14 KB).
const { chromium } = require(process.env.PWC || 'playwright-core'); const fs = require('fs'), path = require('path');
const SRC = process.argv[3] || path.join(__dirname, '..', 'screenshots', '1280x800-menu.png');
const OUT = process.argv[2] || '/workspace/gaming/snapshots/bumerangsakti.webp', MAX = 14 * 1024;
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const p = await (await b.newContext()).newPage(); await p.setContent('<html></html>');
  const r = await p.evaluate(async ({ b64, maxBytes }) => {
    const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
    const enc = (w, q) => { const h = Math.round(img.naturalHeight * w / img.naturalWidth), c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); x.imageSmoothingQuality = 'high'; x.drawImage(img, 0, 0, w, h); const url = c.toDataURL('image/webp', q); return { url, w, h, q, bytes: Math.floor((url.length - 23) * 3 / 4) }; };
    let best = null; for (const w of [640, 560, 480, 400]) for (const q of [0.82, 0.75, 0.68, 0.6, 0.52, 0.45, 0.38]) { const x = enc(w, q); best = x; if (x.bytes <= maxBytes) return x; } return best;
  }, { b64: fs.readFileSync(SRC).toString('base64'), maxBytes: MAX });
  fs.writeFileSync(OUT, Buffer.from(r.url.split(',')[1], 'base64')); fs.writeFileSync('/tmp/bs-snap.json', JSON.stringify({ url: r.url, w: r.w, h: r.h }));
  console.log(OUT, r.w + 'x' + r.h, 'q=' + r.q, (r.bytes / 1024).toFixed(1) + ' KB'); await b.close();
})().catch(e => { console.error(e); process.exit(1); });

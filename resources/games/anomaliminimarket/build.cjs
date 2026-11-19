// Builds game.html (served at /game/anomaliminimarket/play, see docs/games-in-git.md) from src/ + the shared kit.
// Run: node resources/games/anomaliminimarket/build.cjs   (then commit src/ and game.html together)
// src/ship/*.js is the shipped (terser-minified) copy of src/{game,render,app}.js. After editing src/*.js run with
// SHIP=squeeze to regenerate src/ship/ with the token-aware squeezer (or terser: SHIP=terser, needs npx terser).
const fs = require('fs'), path = require('path'), cp = require('child_process');
const NG = { slug: 'anomaliminimarket', title: 'Anomali Mini Market', icon: '\uD83C\uDFEA', accent: '#e8b84a', ink: '#1a1410', bg: '#1a1520', bg2: '#3a2040', inputs: ['#nameInput'], keys: ['anomaliminimarket.name'], max: 16 };
const dir = __dirname, SRC = path.join(dir, 'src'), SHIP = path.join(SRC, 'ship'), files = ['game.js', 'render.js', 'app.js'];
if (process.env.SHIP === 'squeeze') { const squeeze = require('./squeeze.cjs'); for (const f of files) fs.writeFileSync(path.join(SHIP, f), squeeze(fs.readFileSync(path.join(SRC, f), 'utf8'))); }
if (process.env.SHIP === 'terser') for (const f of files) fs.writeFileSync(path.join(SHIP, f), cp.execFileSync('npx', ['--yes', 'terser', path.join(SRC, f), '-m', '-c', 'passes=2']).toString());
require('../_jdkit/build-lib.cjs')(dir, NG, { mp: false, js: files.map(f => 'ship/' + f) });
fs.renameSync(path.join(dir, 'index.deploy.html'), path.join(dir, 'game.html')); fs.unlinkSync(path.join(dir, 'index.html'));
const html = fs.readFileSync(path.join(dir, 'game.html'), 'utf8');
if (/[^\x00-\x7f]/.test(html)) throw Error('non-ASCII left in output');
if (/gmjd1212|gamemasterjd/i.test(html)) throw Error('retired GM key in output');
console.log('game.html', Buffer.byteLength(html), 'bytes');

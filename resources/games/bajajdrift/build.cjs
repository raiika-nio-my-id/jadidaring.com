// Builds game.html (served at /game/bajajdrift/play, see docs/games-in-git.md) from src/ + the shared kit in ../_jdkit.
// Run: node resources/games/bajajdrift/build.cjs   (then commit src/ and game.html together)
const fs = require('fs'), path = require('path'), dir = __dirname;
const NG = { slug: 'bajajdrift', title: 'Bajaj Drift', icon: '\uD83D\uDEFA', accent: '#f2661c', ink: '#1f1408', bg: '#1d2a3a', bg2: '#2f4a5e', inputs: ['#nameInput'], keys: ['bajajdrift.name'], max: 16 };
require('../_jdkit/build-lib.cjs')(dir, NG, { mp: false, js: ['game.js', 'render.js', 'app.js'] });
fs.renameSync(path.join(dir, 'index.deploy.html'), path.join(dir, 'game.html')); fs.unlinkSync(path.join(dir, 'index.html'));
const html = fs.readFileSync(path.join(dir, 'game.html'), 'utf8');
if (/[^\x00-\x7f]/.test(html)) throw Error('non-ASCII left in output');
if (/gmjd1212|gamemasterjd/i.test(html)) throw Error('retired GM key in output');
console.log('game.html', Buffer.byteLength(html), 'bytes');

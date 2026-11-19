// Builds game.html (served at /game/ogohogoharak/play, see docs/games-in-git.md) from src/ + the shared kit in ../_jdkit.
// Run: node resources/games/ogohogoharak/build.cjs   (then commit src/ and game.html together)
const fs = require('fs'), path = require('path'), dir = __dirname;
const NG = { slug: 'ogohogoharak', title: 'Ogoh-Ogoh Arak', icon: '\uD83D\uDC79', accent: '#e8452c', ink: '#1a0f14', bg: '#140c1c', bg2: '#3a1830', inputs: ['#nameInput'], keys: ['ogohogoharak.name'], invite: 'room', max: 16 };
require('../_jdkit/build-lib.cjs')(dir, NG, { mp: true, js: ['game.js', 'render.js', 'app.js'] });
fs.renameSync(path.join(dir, 'index.deploy.html'), path.join(dir, 'game.html')); fs.unlinkSync(path.join(dir, 'index.html'));
const html = fs.readFileSync(path.join(dir, 'game.html'), 'utf8');
if (/[^\x00-\x7f]/.test(html)) throw Error('non-ASCII left in output');
if (/gmjd1212|gamemasterjd/i.test(html)) throw Error('retired GM key in output');
console.log('game.html', Buffer.byteLength(html), 'bytes');

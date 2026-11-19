// Builds game.html (served at /game/monyetuluwatu/play, see docs/games-in-git.md) from src/ + the shared kit in ../_jdkit.
// Run: node resources/games/monyetuluwatu/build.cjs   (then commit src/ and game.html together)
const fs = require('fs'), path = require('path'), dir = __dirname;
const NG = { slug: 'monyetuluwatu', title: 'Monyet Uluwatu', icon: '\uD83D\uDC12', accent: '#f08a24', ink: '#2a160b', bg: '#3b1d2e', bg2: '#8a3b2a', inputs: ['#nameInput'], keys: ['monyetuluwatu.name'], max: 16 };
require('../_jdkit/build-lib.cjs')(dir, NG, { mp: false, js: ['game.js', 'render.js', 'app.js'] });
fs.renameSync(path.join(dir, 'index.deploy.html'), path.join(dir, 'game.html')); fs.unlinkSync(path.join(dir, 'index.html'));
const html = fs.readFileSync(path.join(dir, 'game.html'), 'utf8');
if (/[^\x00-\x7f]/.test(html)) throw Error('non-ASCII left in output');
if (/gmjd1212|gamemasterjd/i.test(html)) throw Error('retired GM key in output');
console.log('game.html', Buffer.byteLength(html), 'bytes');

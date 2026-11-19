// Builds game.html (served at /game/tamiyalintasan/play, see docs/games-in-git.md). build-src.cjs is the game's original
// build (inlines src/* into index.html + ASCII copy); this wrapper turns its output into game.html.
// Run: node resources/games/tamiyalintasan/build.cjs   (then commit src/ and game.html together)
const fs = require('fs'), path = require('path'), cp = require('child_process'), dir = __dirname;
cp.execFileSync(process.execPath, [path.join(dir, 'build-src.cjs'), ...process.argv.slice(2)], { stdio: 'inherit' });
const idx = path.join(dir, 'index.html'), dep = path.join(dir, 'index.deploy.html'), out = path.join(dir, 'game.html');
if (!fs.existsSync(dep)) cp.execFileSync('python3', [path.join(dir, 'tools', 'to-deploy-ascii.py'), idx, dep], { stdio: 'inherit' });
fs.renameSync(dep, out); fs.unlinkSync(idx);
const html = fs.readFileSync(out, 'utf8');
if (/[^\x00-\x7f]/.test(html)) throw Error('non-ASCII left in output');
if (/gmjd1212|gamemasterjd/i.test(html)) throw Error('retired GM key in output');
console.log('game.html', Buffer.byteLength(html), 'bytes');

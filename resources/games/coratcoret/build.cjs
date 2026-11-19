// Builds game.html (served at /game/coratcoret/play, see docs/games-in-git.md) from src/.
// Run: node resources/games/coratcoret/build.cjs   (then commit src/ and game.html together)
// Steps (same as the old local build): tools/inline.cjs inlines src/* into index.html (lang pack deflated),
// tools/shrink-pack.py re-deflates the lang pack with zopfli (optional: pip install zopfli),
// tools/to-deploy-ascii.py writes the ASCII-only game.html. index.html is a temporary file.
const { execFileSync } = require('child_process'), fs = require('fs'), path = require('path');
const dir = __dirname, tmp = path.join(dir, 'index.html'), out = path.join(dir, 'game.html');
execFileSync(process.execPath, [path.join(dir, 'tools', 'inline.cjs')], { stdio: 'inherit' });
try { execFileSync('python3', [path.join(dir, 'tools', 'shrink-pack.py'), tmp], { stdio: 'inherit' }); }
catch (e) { console.warn('shrink-pack skipped or over 300 KB (only the old admin editor needed that limit):', e.status); }
execFileSync('python3', [path.join(dir, 'tools', 'to-deploy-ascii.py'), tmp, out], { stdio: 'inherit' });
fs.unlinkSync(tmp);
const html = fs.readFileSync(out, 'utf8');
if (/[^\x00-\x7f]/.test(html)) throw Error('non-ASCII left in output');
if (/gmjd1212|gamemasterjd/i.test(html)) throw Error('retired GM key in output');
console.log('game.html', Buffer.byteLength(html), 'bytes');

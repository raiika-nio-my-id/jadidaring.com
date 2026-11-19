// Inlines src/* into the single deliverable index.html (no runtime dependencies).
// zh/th/vi/ms (UI text + word lists + the multilingual concept table) ship as one deflate-raw + base64 language pack
// (<script type="text/plain" id="dg-lang-pack">) that the page inflates at start-up (DecompressionStream, JS fallback).
const fs = require('fs'), path = require('path'), zlib = require('zlib'), p = f => path.join(__dirname, '..', 'src', f);
const cfg = JSON.stringify(JSON.parse(fs.readFileSync(p('config.json'), 'utf8')));
let html = fs.readFileSync(p('template.html'), 'utf8').replace(/^[ \t]+/gm, ''); // drop template indentation (no multi-line strings/pre in template)
const put = (mark, text) => { if (!html.includes(mark)) throw Error('missing ' + mark); if (/<\/script/i.test(text) && mark !== '/*CSS*/') throw Error('</script in ' + mark); html = html.replace(mark, () => text); };
function langPack() {
  const langs = ['zh', 'th', 'vi', 'ms'], pack = { v: 1, langs, i18n: {}, invite: {}, doodles: {}, extras: {} };
  for (const l of langs) { const j = JSON.parse(fs.readFileSync(p('lang/' + l + '.json'), 'utf8')); pack.i18n[l] = j.i18n; pack.invite[l] = j.invite; pack.doodles[l] = j.doodles; }
  pack.concepts = fs.readFileSync(p('lang/concepts.txt'), 'utf8').split('\n').filter(l => l.trim() && !/^# en;/.test(l)).map(l => l.replace(/^# /, '#')).join('\n');
  let lang = null, cat = '';
  for (const raw of fs.readFileSync(p('lang/extras.txt'), 'utf8').split('\n')) {
    const line = raw.trim(); if (!line) continue;
    if (line[0] === '@') { lang = line.slice(1); pack.extras[lang] = {}; continue; }
    if (line[0] === '#') { cat = line.slice(1).trim(); continue; }
    const words = line.split(lang === 'zh' ? /\s+/ : '|').map(w => w.trim()).filter(Boolean);
    pack.extras[lang][cat] = (pack.extras[lang][cat] ? pack.extras[lang][cat] + '|' : '') + words.join('|');
  }
  pack.t2s = fs.readFileSync(p('lang/t2s.txt'), 'utf8').trim();
  const raw = Buffer.from(JSON.stringify(pack), 'utf8');
  return { b64: zlib.deflateRawSync(raw, { level: 9 }).toString('base64'), raw: raw.length };
}
const pack = langPack();
put('/*CONFIG*/', cfg.replace(/</g, '\\u003c'));
put('/*LANGPACK*/', pack.b64);
put('/*CSS*/', fs.readFileSync(p('style.css'), 'utf8').replace(/\/\*[\s\S]*?\*\/\n?/g, '').trim().replace(/\n+/g, '')); // CSS comments stay in src only; one rule per line -> joined
// light, safe minify: drop whole-line comments and indentation (sources have no multi-line strings)
// + multi-line block comments whose lines start with /* ... and end with */ (JSDoc-style)
const slim = src => { let blk = false; return src.split('\n').map(l => l.trim()).filter(l => { if (blk) { if (/\*\/$/.test(l)) blk = false; return false; } if (/^\/\*/.test(l) && !l.includes('*/')) { blk = true; return false; } return l && !/^\/\/|^\/\*.*\*\/$/.test(l); }).map(l => l.replace(/([;{},)])\s*\/\/ [^'"`]*$/, '$1').replace(/\s*\/\* [^*'"`]{1,80} \*\/\s*/g, ' ')).join('\n'); };
const squeeze = process.env.SQUEEZE === '0' ? x => x : require('./squeeze.cjs'); // t240u: drop non-significant spaces (~17 KB); SQUEEZE=0 to disable
put('/*CORE*/', squeeze(slim(fs.readFileSync(p('core.js'), 'utf8'))));
put('/*APP*/', squeeze(slim(fs.readFileSync(p('app.js'), 'utf8'))));
fs.writeFileSync(path.join(__dirname, '..', 'index.html'), html);
console.log('index.html', html.length, 'chars,', Buffer.byteLength(html), 'bytes; lang pack', pack.raw, '->', pack.b64.length, 'base64');
if (Buffer.byteLength(html) >= 300000) console.warn('index.html over 300 KB before zopfli: run python3 tools/shrink-pack.py (enforces < 300 KB)');

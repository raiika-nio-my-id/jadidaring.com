// Inlines src/* into the single deliverable game.html (no runtime dependencies), ASCII-only.
// Run: node resources/games/langitbersama/build.cjs   (then commit src/ and game.html together)
// Laravel serves game.html at /game/langitbersama/play (see docs/games-in-git.md).
const fs = require('fs'), path = require('path'), p = f => path.join(__dirname, 'src', f);
let html = fs.readFileSync(p('template.html'), 'utf8');
const put = (mark, text) => { if (!html.includes(mark)) throw Error('missing ' + mark); if (/<\/script/i.test(text) && mark !== '/*SNIPPETS*/' && mark !== '/*CSS*/') throw Error('</script in ' + mark); html = html.replace(mark, () => text); };
put('/*CONFIG*/', JSON.stringify(JSON.parse(fs.readFileSync(p('config.json'), 'utf8'))).replace(/</g, '\\u003c'));
put('/*CSS*/', fs.readFileSync(p('style.css'), 'utf8').trim());
put('/*SNIPPETS*/', fs.readFileSync(p('snippets/jr-hub.html'), 'utf8').trim());
put('/*RULES*/', fs.readFileSync(p('rules.js'), 'utf8').trim());
put('/*NET*/', fs.readFileSync(p('net.js'), 'utf8').trim());
put('/*APP*/', fs.readFileSync(p('app.js'), 'utf8').trim());
if (!/<body>\n<!-- JaRing Game Hub link/.test(html)) throw Error('hub snippet must follow <body>');
// t313u: pre-fill [data-t] / [data-tp] with the default (id) copy at build time so the first paint already has the button labels
// (they were empty until the app script ran → header/chat buttons widened ~1 s after first paint = layout shift on mobile)
{ const C = JSON.parse(fs.readFileSync(p('config.json'), 'utf8')), ID = (C.text && C.text.id) || {}, esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const body0 = html.indexOf('<body>'), body1 = html.indexOf('<script id="dq-rules">'); let b = html.slice(body0, body1);
  b = b.replace(/(<(\w+)\b[^>]*\sdata-t="(\w+)"[^>]*>)(<\/\2>)/g, (m, open, tag, k, close) => typeof ID[k] === 'string' && !/[{}]/.test(ID[k]) ? open + esc(ID[k]) + close : m);
  b = b.replace(/(<input\b[^>]*\sdata-tp="(\w+)")([^>]*>)/g, (m, a, k, c) => /\splaceholder=/.test(m) || typeof ID[k] !== 'string' ? m : a + ' placeholder="' + esc(ID[k]) + '"' + c);
  html = html.slice(0, body0) + b + html.slice(body1); }
// ASCII-only output (same as the old tools/to-deploy-ascii.py): \uXXXX inside <script>, \XXXX inside <style>, &#xXXXX; in markup.
const hex = (n, w) => n.toString(16).padStart(w, '0');
const js = t => t.replace(/[^\x00-\x7f]/gu, ch => { const c = ch.codePointAt(0); if (c < 0x10000) return '\\u' + hex(c, 4); const o = c - 0x10000; return '\\u' + hex(0xd800 + (o >> 10), 4) + '\\u' + hex(0xdc00 + (o & 0x3ff), 4); });
const css = t => t.replace(/[^\x00-\x7f]/gu, ch => '\\' + ch.codePointAt(0).toString(16).toUpperCase() + ' ');
const ent = t => t.replace(/[^\x00-\x7f]/gu, ch => '&#x' + ch.codePointAt(0).toString(16).toUpperCase() + ';');
html = html.split(/(<script\b[^>]*>[\s\S]*?<\/script>|<style\b[^>]*>[\s\S]*?<\/style>)/).map(part => part.startsWith('<script') ? js(part) : part.startsWith('<style') ? css(part) : ent(part)).join('');
if (/[^\x00-\x7f]/.test(html)) throw Error('non-ASCII left in output');
if (/gmjd1212|gamemasterjd/i.test(html)) throw Error('retired GM key in output');
fs.writeFileSync(path.join(__dirname, 'game.html'), html);
console.log('game.html', Buffer.byteLength(html), 'bytes');

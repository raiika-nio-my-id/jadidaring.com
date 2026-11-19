// Inlines src/* into the single deliverable index.html (no runtime dependencies).
const fs = require('fs'), path = require('path'), p = f => path.join(__dirname, 'src', f);
let html = fs.readFileSync(p('template.html'), 'utf8');
const put = (mark, text) => { if (!html.includes(mark)) throw Error('missing ' + mark); if (/<\/script/i.test(text) && mark !== '/*SNIPPETS*/') throw Error('</script in ' + mark); html = html.replace(mark, () => text); };
put('/*CSS*/', fs.readFileSync(p('style.css'), 'utf8').trim());
put('/*SNIPPETS*/', fs.readFileSync(p('snippets/jr-hub.html'), 'utf8').trim() + '\n' + fs.readFileSync(p('snippets/jd-namegate.html'), 'utf8').trim() + '\n' + fs.readFileSync(p('snippets/jr-invite.html'), 'utf8').trim());
put('/*GAME*/', fs.readFileSync(p('game.js'), 'utf8').trim());
put('/*NET*/', fs.readFileSync(p('net.js'), 'utf8').trim());
put('/*APP*/', fs.readFileSync(p('app.js'), 'utf8').trim());
if (!/<body>\n<!-- JaRing Game Hub link/.test(html)) throw Error('hub snippet must follow <body>');
fs.writeFileSync(path.join(__dirname, 'index.html'), html);
console.log('index.html', Buffer.byteLength(html), 'bytes');

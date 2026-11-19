// Inlines src/* into the single deliverable index.html (no runtime dependencies).
const fs = require('fs'), p = f => require('path').join(__dirname, 'src', f);
const cfg = JSON.stringify(JSON.parse(fs.readFileSync(p('config.json'), 'utf8')), null, 2);
let html = fs.readFileSync(p('template.html'), 'utf8');
const put = (mark, text) => { if (!html.includes(mark)) throw Error('missing ' + mark); if (/<\/script/i.test(text) && mark !== '/*CSS*/') throw Error('</script in ' + mark); html = html.replace(mark, () => text); };
put('/*CONFIG*/', cfg.replace(/</g, '\\u003c'));
put('/*CSS*/', fs.readFileSync(p('style.css'), 'utf8').trim());
put('/*CORE*/', fs.readFileSync(p('core.js'), 'utf8').trim());
put('/*APP*/', fs.readFileSync(p('app.js'), 'utf8').trim());
fs.writeFileSync(require('path').join(__dirname, 'index.html'), html);
console.log('index.html', html.length, 'bytes');

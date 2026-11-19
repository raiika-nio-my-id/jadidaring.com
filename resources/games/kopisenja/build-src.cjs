// Inlines src/* into the single deliverable index.html (no runtime dependencies) + ASCII index.deploy.html.
const fs = require('fs'), path = require('path'), p = f => path.join(__dirname, 'src', f);
const cfg = JSON.parse(fs.readFileSync(p('config.json'), 'utf8'));
let html = fs.readFileSync(p('template.html'), 'utf8');
const put = (mark, text) => { if (!html.includes(mark)) throw Error('missing ' + mark); if (/<\/script/i.test(text) && mark !== '/*CSS*/' && mark !== '/*SNIPPETS*/') throw Error('</script in ' + mark); html = html.replace(mark, () => text); };
const NG = { slug: 'kopisenja', title: 'Kopi Senja', icon: '\u2615', accent: '#f2a65a', ink: '#2a1006', bg: '#1f1014', bg2: '#6a2f3e', inputs: ['#nameIn'], max: 16 };
const ng = fs.readFileSync(p('snippets/jd-namegate.tpl.html'), 'utf8').trim(); if (!ng.includes('/*JDNG_CFG*/')) throw Error('namegate tpl changed');
put('/*CONFIG*/', JSON.stringify(cfg, null, 1).replace(/</g, '\\u003c'));
put('/*CSS*/', fs.readFileSync(p('style.css'), 'utf8').trim());
put('/*SNIPPETS*/', fs.readFileSync(p('snippets/jr-hub.html'), 'utf8').trim() + '\n' + ng.replace('/*JDNG_CFG*/', () => JSON.stringify(NG)));
put('/*SIM*/', fs.readFileSync(p('sim.js'), 'utf8').trim());
put('/*RENDER*/', fs.readFileSync(p('render.js'), 'utf8').trim());
put('/*APP*/', fs.readFileSync(p('app.js'), 'utf8').trim());
if (!/<body>\n<!-- JaRing Game Hub link/.test(html)) throw Error('hub snippet must follow <body>');
fs.writeFileSync(path.join(__dirname, 'index.html'), html);
console.log('index.html', Buffer.byteLength(html), 'bytes');
require('child_process').execFileSync('python3', [path.join(__dirname, 'tools', 'to-deploy-ascii.py'), path.join(__dirname, 'index.html'), path.join(__dirname, 'index.deploy.html')], { stdio: 'inherit' });

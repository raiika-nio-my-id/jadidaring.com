// Inlines src/* + the SHARED snippets from /workspace/hub-links (hub pill + name-gate template, not forked) into index.html, then the ASCII deploy copy.
const fs = require('fs'), path = require('path'), p = f => path.join(__dirname, 'src', f), HUB = path.join(__dirname, 'hub');
const NG_CFG = { inputs: [], keys: [], max: 15, icon: '🏮', title: 'Mandarin Harian', sub: 'Namamu dipakai di daftar “sudah belajar hari ini”.', accent: '#f2b632', ink: '#3a2600', bg: '#2a1512', bg2: '#8f2a20', slug: 'mandarinharian' };
let html = fs.readFileSync(p('template.html'), 'utf8');
const put = (mark, text) => { if (!html.includes(mark)) throw Error('missing ' + mark); html = html.replace(mark, () => text); };
if (process.argv.includes('--bank')) require('child_process').execFileSync('python3', [path.join(__dirname, 'tools', 'mkbank.py')], { stdio: 'inherit' });
const ng = fs.readFileSync(path.join(HUB, 'jd-namegate.tpl.html'), 'utf8').trim(); if (!ng.includes('/*JDNG_CFG*/')) throw Error('namegate tpl changed');
put('/*CSS*/', fs.readFileSync(p('style.css'), 'utf8').trim());
put('/*SNIPPETS*/', fs.readFileSync(path.join(HUB, 'snippet.html'), 'utf8').trim() + '\n' + ng.replace('/*JDNG_CFG*/', () => JSON.stringify(NG_CFG)));
for (const [m, f] of [['/*BANK*/', 'bank.js'], ['/*APP*/', 'app.js']]) { const t = fs.readFileSync(p(f), 'utf8').trim(); if (/<\/script/i.test(t)) throw Error('</script in ' + f); put(m, t); }
if (!/<body>\n<!-- JaRing Game Hub link/.test(html)) throw Error('hub snippet must follow <body>');
fs.writeFileSync(path.join(__dirname, 'index.html'), html);
console.log('index.html', Buffer.byteLength(html), 'bytes');
require('child_process').execFileSync('python3', [path.join(__dirname, 'tools', 'to-deploy-ascii.py'), path.join(__dirname, 'index.html'), path.join(__dirname, 'index.deploy.html')], { stdio: 'inherit' });

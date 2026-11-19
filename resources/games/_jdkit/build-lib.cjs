// Shared builder for jdkit games (vendored from the old local /workspace/jdkit, 2026-11-20). build(dir, NG, opts) writes dir/index.html + dir/index.deploy.html.
const fs = require('fs'), path = require('path'), K = __dirname; // js files are .cjs-safe (repo package.json is type: module)
module.exports = function build(dir, NG, opts = {}) {
  const p = f => path.join(dir, 'src', f), k = f => path.join(K, f);
  let html = fs.readFileSync(p('template.html'), 'utf8');
  const put = (mark, text) => { if (!html.includes(mark)) throw Error('missing ' + mark); html = html.replace(mark, () => text); };
  const ng = fs.readFileSync(k('snippets/jd-namegate.tpl.html'), 'utf8').trim();
  put('/*CSS*/', fs.readFileSync(k('base.css'), 'utf8').trim() + '\n' + fs.readFileSync(p('style.css'), 'utf8').trim());
  let snip = fs.readFileSync(k('snippets/jr-hub.html'), 'utf8').trim();
  if (NG.inputs) snip += '\n' + ng.replace('/*JDNG_CFG*/', () => JSON.stringify(NG));
  if (opts.mp) snip += '\n' + fs.readFileSync(k('snippets/jr-invite.html'), 'utf8').trim();
  put('/*SNIPPETS*/', snip);
  const js = ['/* ' + NG.slug + ' */\nwindow.JD_SLUG = ' + JSON.stringify(NG.slug) + ';', fs.readFileSync(k('kit.js'), 'utf8')];
  if (opts.mp) js.push(fs.readFileSync(k('net.js'), 'utf8'), fs.readFileSync(k('mpshell.js'), 'utf8'));
  for (const f of opts.js || []) js.push(fs.readFileSync(p(f), 'utf8'));
  for (const s of js) if (/<\/script/i.test(s)) throw Error('</script in js');
  put('/*JS*/', js.map(s => s.trim()).join('\n'));
  if (!/<body>\n<!-- JaRing Game Hub link/.test(html)) throw Error('hub snippet must follow <body>');
  fs.writeFileSync(path.join(dir, 'index.html'), html);
  require('child_process').execFileSync('python3', [k('tools/to-deploy-ascii.py'), path.join(dir, 'index.html'), path.join(dir, 'index.deploy.html')], { stdio: 'inherit' });
  console.log('index.html', Buffer.byteLength(html), 'bytes');
};

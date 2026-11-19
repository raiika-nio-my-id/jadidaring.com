#!/usr/bin/env python3
"""Re-deflate the dg-lang-pack in index.html with zopfli (same raw-deflate bytes after inflate, ~6% smaller base64).
Run after `node build.js`; enforces index.html < 300 KB. Needs `pip install --user --break-system-packages zopfli`."""
import re, sys, zlib, base64, zopfli.zopfli as zz
p = sys.argv[1] if len(sys.argv) > 1 else 'index.html'
html = open(p, encoding='utf8').read()
m = re.search(r'(<script type="text/plain" id="dg-lang-pack">)(.*?)(</script>)', html, re.S)
raw = zlib.decompress(base64.b64decode(m.group(2).strip()), -15)
c = zz.compress(raw, numiterations=60)[2:-4]
assert zlib.decompress(c, -15) == raw
html = html[:m.start(2)] + base64.b64encode(c).decode() + html[m.end(2):]
open(p, 'w', encoding='utf8').write(html)
n = len(html.encode()); print(p, n, 'bytes (lang pack', len(m.group(2)), '->', len(base64.b64encode(c)), ')')
if n >= 300000: sys.exit('index.html over 300 KB')

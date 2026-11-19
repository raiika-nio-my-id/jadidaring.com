#!/usr/bin/env python3
import re,sys
src=sys.argv[1] if len(sys.argv)>1 else 'index.html'
dst=sys.argv[2] if len(sys.argv)>2 else 'index.deploy.html'
s=open(src,encoding='utf-8').read()
def css(t):
    return ''.join(c if ord(c)<128 else '\\%X '%ord(c) for c in t)
def js(t):
    o=[]
    for c in t:
        n=ord(c)
        if n<128:o.append(c)
        elif n<0x10000:o.append('\\u%04x'%n)
        else:
            n-=0x10000;o.append('\\u%04x\\u%04x'%(0xD800+(n>>10),0xDC00+(n&0x3FF)))
    return ''.join(o)
def html(t):
    return ''.join(c if ord(c)<128 else '&#x%X;'%ord(c) for c in t)
out=[];pos=0
for m in re.finditer(r'(<style[^>]*>)(.*?)(</style>)|(<script[^>]*>)(.*?)(</script>)',s,re.S|re.I):
    out.append(html(s[pos:m.start()]))
    if m.group(1):out.append(m.group(1)+css(m.group(2))+m.group(3))
    else:out.append(m.group(4)+js(m.group(5))+m.group(6))
    pos=m.end()
out.append(html(s[pos:]))
r=''.join(out);assert all(ord(c)<128 for c in r)
open(dst,'w',encoding='ascii').write(r)
print(dst,len(r))

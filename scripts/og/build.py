#!/usr/bin/env python3
"""Regenerate public/og-home-v2.{webp,png}. Needs google-chrome + Pillow. Run from repo root."""
import re, subprocess, pathlib, math
from PIL import Image
r = pathlib.Path(__file__).resolve().parents[2]
svg = (r/'public/marketing/images/logo-mark-white.svg').read_text()
logo = re.search(r'<svg[^>]*>(.*)</svg>', svg, re.S).group(1)
web = ''.join(f'<path d="M1200 0 A{i*170} {i*170} 0 0 0 {1200-i*170} 0"/>' if False else
              f'<circle cx="1140" cy="40" r="{i*170}"/>' for i in range(1, 8))
web += ''.join(f'<line x1="1140" y1="40" x2="{1140-600*math.cos(a)}" y2="{40+600*math.sin(a)}"/>'
               for a in [math.radians(x) for x in range(10, 90, 15)])
t = (r/'scripts/og/home.html.tpl').read_text()
t = t.replace('__FONT__', (r/'resources/fonts/Baloo2.ttf').as_uri()).replace('__LOGO__', logo).replace('__WEB__', web)
h = pathlib.Path('/tmp/og-home.html'); h.write_text(t)
png = r/'public/og-home-v2.png'
subprocess.run(['google-chrome','--headless','--no-sandbox','--hide-scrollbars','--force-device-scale-factor=1',
  '--window-size=1200,630',f'--screenshot={png}','--virtual-time-budget=2000',h.as_uri()],check=True)
im = Image.open(png).convert('RGB'); assert im.size == (1200, 630), im.size
im.save(png, optimize=True); im.save(r/'public/og-home-v2.webp', quality=90)

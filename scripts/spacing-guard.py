"""Spacing guard: flags sibling buttons/chips/cards/inputs whose boxes are < 8px apart (touch/overlap)."""
# Usage: start the app (php artisan serve --port=8090, seeded DB with admin@test.local / rahasia-panjang and member shipu / rahasia123),
# then: python3 scripts/spacing-guard.py   (env: WIDTHS=360,412,1280 THEMES=light,dark SHOTS=dir BASE=... RULES=...)
# Exit 1 when any sibling button/chip/card/input pair is closer than 8px. Mark an intentional overlap with data-spacing-ok.
import asyncio, json, sys, os
from playwright.async_api import async_playwright
BASE = os.environ.get('BASE', 'http://jadidaring.test')
RULES = os.environ.get('RULES', 'MAP jadidaring.test 127.0.0.1:8090')
SHOTS = os.environ.get('SHOTS', '')
PUBLIC = ['/', '/berita', '/berita/teknologi/artikel-uji-6', '/berita/ekonomi', '/game', '/komunitas', '/u/shipu', '/masuk', '/daftar', '/tidak-ada-halaman-ini']
ADMIN = ['/admin', '/admin/statistik', '/admin/berita', '/admin/berita/1', '/admin/berita/topik', '/admin/berita/komentar', '/admin/komunitas', '/admin/komunitas/1', '/admin/komunitas/komentar', '/admin/komunitas/curhatan', '/admin/user', '/admin/user/2', '/admin/game', '/admin/game/1', '/admin/pesan', '/admin/log', '/admin/backup']
ADMIN += [p for p in os.environ.get('EXTRA_ADMIN', '').split(',') if p]
JS = r"""
() => {
  const MIN = 8, out = [];
  const isBox = (el) => {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0) return false;
    if (cs.position === 'fixed' || cs.position === 'absolute' || cs.position === 'sticky') return false;
    const r = el.getBoundingClientRect(); if (r.width < 4 || r.height < 4) return false;
    const tag = el.tagName;
    if (['BUTTON','INPUT','SELECT','TEXTAREA'].includes(tag) && cs.display !== 'contents') return true;
    if (tag === 'INPUT' && el.type === 'hidden') return false;
    const vis = cs.boxShadow !== 'none' || (cs.backgroundColor !== 'rgba(0, 0, 0, 0)' && cs.backgroundColor !== 'transparent') || parseFloat(cs.borderTopWidth) > 0 && cs.borderTopStyle !== 'dashed' && cs.borderTopStyle !== 'none';
    return vis;
  };
  const name = (el) => el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).slice(0,2).join('.') : '') + ' "' + (el.innerText || el.value || '').trim().slice(0, 24).replace(/\s+/g,' ') + '"';
  // A child that is a wrapper (e.g. <form> around a button) stands for its first visual descendant box.
  const boxOf = (el) => { if (isBox(el)) return el; const cs = getComputedStyle(el); if (cs.display === 'none') return null; const kids = [...el.children]; if (kids.length === 1) return boxOf(kids[0]); return null; };
  for (const p of document.querySelectorAll('body *')) {
    if (p.closest('svg, .jd-ghost, .adm-skel, [aria-hidden="true"], .pf-avwrap, [data-spacing-ok], dialog:not([open])')) continue;
    const kids = [...p.children].map(boxOf).filter(Boolean);
    for (let i = 0; i + 1 < kids.length; i++) {
      const a = kids[i].getBoundingClientRect(), b = kids[i + 1].getBoundingClientRect();
      const dx = Math.max(b.left - a.right, a.left - b.right), dy = Math.max(b.top - a.bottom, a.top - b.bottom);
      const gap = Math.max(dx, dy);
      if (gap < MIN - 0.5) out.push({ gap: Math.round(gap * 10) / 10, a: name(kids[i]), b: name(kids[i + 1]), parent: name(p).slice(0, 60) });
    }
  }
  return out;
}
"""
async def run(paths, ctx, label, theme, w, report):
  pg = await ctx.new_page()
  for path in paths:
    resp = await pg.goto(BASE + path, wait_until='load'); await pg.wait_for_timeout(250)
    if resp and resp.status >= 500:
      report.append({'page': path, 'vw': w, 'theme': theme, 'hits': [{'gap': -1, 'a': 'HTTP %d' % resp.status, 'b': '', 'parent': 'page'}]}); continue
    hits = await pg.evaluate(JS)
    if hits: report.append({'page': path, 'vw': w, 'theme': theme, 'hits': hits})
    if SHOTS:
      fn = f"{SHOTS}/{label}-{theme}-{w}-{path.strip('/').replace('/', '_') or 'home'}.png"
      await pg.screenshot(path=fn, full_page=True)
  await pg.close()
async def main():
  report = []
  async with async_playwright() as p:
    b = await p.chromium.launch(args=[f'--host-resolver-rules={RULES}'] if RULES else [])
    for w in [int(x) for x in os.environ.get('WIDTHS', '360,412,1280').split(',')]:
      for theme in os.environ.get('THEMES', 'light,dark').split(','):
        ctx = await b.new_context(viewport={'width': w, 'height': 900}, color_scheme=theme)
        await ctx.add_init_script(f"try{{localStorage.setItem('jadidaring-theme','{theme}')}}catch(e){{}}")
        if os.environ.get('PUB', '1') == '1': await run(PUBLIC, ctx, 'pub', theme, w, report)
        if os.environ.get('MEM', '1') == '1':
          mctx = await b.new_context(viewport={'width': w, 'height': 900}, color_scheme=theme)
          await mctx.add_init_script(f"try{{localStorage.setItem('jadidaring-theme','{theme}')}}catch(e){{}}")
          pg = await mctx.new_page(); await pg.goto(BASE + '/masuk')
          await pg.fill('input[name=login]', 'shipu'); await pg.fill('input[name=password]', 'rahasia123')
          await pg.click('form button[type=submit]'); await pg.wait_for_load_state('load'); await pg.close()
          await run(['/akun', '/komunitas/halamanku', '/u/shipu', '/komunitas'], mctx, 'mem', theme, w, report)
          await mctx.close()
        if os.environ.get('ADM', '1') == '1':
          pg = await ctx.new_page(); await pg.goto(BASE + '/admin/masuk')
          await pg.fill('input[name=email]', 'admin@test.local'); await pg.fill('input[name=password]', 'rahasia-panjang')
          await pg.click('form button[type=submit]'); await pg.wait_for_load_state('load'); await pg.close()
          await run(ADMIN, ctx, 'adm', theme, w, report)
        await ctx.close()
    await b.close()
  n = sum(len(r['hits']) for r in report)
  json.dump(report, open(os.environ.get('OUT', '/tmp/jdsess/touch.json'), 'w'), ensure_ascii=False, indent=1)
  import collections
  c = collections.Counter(); where = collections.defaultdict(set)
  for r in report:
    for h in r['hits']:
      k = (h['parent'][:40], h['a'][:45], h['b'][:45], h['gap']); c[k] += 1; where[k].add(f"{r['page']}@{r['vw']}{r['theme'][0]}")
  for k, v in c.most_common(80): print(v, k, sorted(where[k])[:3])
  print('TOTAL', n)
  sys.exit(1 if n else 0)
asyncio.run(main())

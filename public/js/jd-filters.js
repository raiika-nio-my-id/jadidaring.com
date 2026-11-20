/* Filter/tab chips: swap only the listing (fetch + DOMParser), pushState, popstate.
   On click the chip turns active and the listing becomes the page-change skeleton at once; a newer click aborts the
   older request; a failed load puts the chips back and shows a toast (back/forward failures load the page normally).
   Chips: one swipeable row with edge fades, active chip scrolled into view. Active chip is a pressed physical button. */
(function () {
  'use strict';
  var doc = document, reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)');
  function still() { return reduce && reduce.matches; }
  var bars = doc.querySelectorAll('[data-jd-chips]');
  var slots = doc.querySelectorAll('[data-jd-slot]');

  /* ---------- chip rows: fades, scroll into view ---------- */
  function activeOf(bar) { return bar.querySelector('[aria-current="page"], .is-active'); }
  function fades(bar) {
    var max = bar.scrollWidth - bar.clientWidth;
    bar.classList.toggle('jd-fade-l', bar.scrollLeft > 4);
    bar.classList.toggle('jd-fade-r', max > 4 && bar.scrollLeft < max - 4);
  }
  function reveal(bar, smooth) {
    var a = activeOf(bar);
    if (!a || bar.scrollWidth <= bar.clientWidth) return;
    var left = a.offsetLeft - (bar.clientWidth - a.offsetWidth) / 2;
    bar.scrollTo({ left: Math.max(0, left), behavior: smooth && !still() ? 'smooth' : 'auto' });
  }
  function initBar(bar) {
    bar.classList.add('jd-chips');
    bar.addEventListener('scroll', function () { fades(bar); }, { passive: true });
    reveal(bar, false); fades(bar);
  }
  bars.forEach(initBar);
  window.addEventListener('resize', function () { bars.forEach(function (b) { fades(b); }); });
  /* the home page has plain scroll rows without data-jd-chips */
  doc.querySelectorAll('.pills-bar:not([data-jd-chips])').forEach(function (bar) {
    bar.classList.add('jd-chips');
    bar.addEventListener('scroll', function () { fades(bar); }, { passive: true });
    fades(bar);
  });

  if (!slots.length || !window.fetch || !window.DOMParser || !history.pushState) return;

  /* ---------- in-place swap ---------- */
  var ctl = null, cur = loc(location.href);
  function loc(u) { var a = new URL(u, location.href); return a.pathname + a.search; }
  history.replaceState({ jd: 1 }, '', location.href);

  function sameChips(href) { return href; }
  function syncChips(next) {
    var nb = next.querySelectorAll('[data-jd-chips]');
    bars.forEach(function (bar, i) {
      var n = nb[i]; if (!n) return;
      var links = bar.querySelectorAll('a'), nl = n.querySelectorAll('a');
      var prev = activeOf(bar);
      if (links.length !== nl.length) { bar.innerHTML = n.innerHTML; initBar(bar); return; }
      var newActive = null;
      links.forEach(function (a, k) {
        var b = nl[k];
        var on = b.getAttribute('aria-current') === 'page' || b.classList.contains('is-active');
        a.classList.toggle('is-active', on && !a.matches('.ch-tab'));
        if (on) { a.setAttribute('aria-current', 'page'); newActive = a; } else a.removeAttribute('aria-current');
        a.setAttribute('href', b.getAttribute('href'));
      });
      reveal(bar, true);
      bar.dispatchEvent(new CustomEvent('jd:chipchange', { detail: { next: newActive, prev: prev } }));
    });
  }
  function syncForms(next) {
    doc.querySelectorAll('form[data-jd-form]').forEach(function (f) {
      var n = f.id ? next.getElementById(f.id) : null;
      if (!n) { var all = doc.querySelectorAll('form[data-jd-form]'), na = next.querySelectorAll('form[data-jd-form]'); n = na[Array.prototype.indexOf.call(all, f)]; }
      if (!n) return;
      f.setAttribute('action', n.getAttribute('action'));
      var q = f.querySelector('[name="q"]'), nq = n.querySelector('[name="q"]');
      if (q && nq) { q.value = nq.value; q.placeholder = nq.placeholder; }
      var v = n.getAttribute('data-jd-view');
      if (v) { try { if (window.jdTrack) window.jdTrack(v, JSON.parse(n.getAttribute('data-jd-params') || '{}')); } catch (e) {} }
    });
  }
  function head(next) {
    if (next.title) doc.title = next.title;
    ['link[rel="canonical"]', 'meta[property="og:url"]', 'meta[name="description"]', 'meta[property="og:description"]', 'meta[property="og:title"]'].forEach(function (sel) {
      var a = doc.head.querySelector(sel), b = next.head.querySelector(sel);
      if (a && b) a.setAttribute(a.hasAttribute('content') ? 'content' : 'href', b.getAttribute(a.hasAttribute('content') ? 'content' : 'href'));
    });
    var ra = doc.head.querySelector('meta[name="robots"]'), rb = next.head.querySelector('meta[name="robots"]');
    if (rb && !ra) { ra = doc.createElement('meta'); ra.name = 'robots'; doc.head.appendChild(ra); }
    if (ra) { if (rb) ra.setAttribute('content', rb.getAttribute('content')); else ra.remove(); }
  }
  function enter(el) {
    el.classList.remove('jd-enter'); void el.offsetWidth;
    var kids = el.querySelectorAll('.news-card, .game-card, .pf-mini, .ch-card, .clay-empty');
    kids.forEach(function (k, i) { k.style.setProperty('--i', Math.min(i, 11)); });
    el.classList.add('jd-enter');
  }

  function setOn(a, on) {
    a.classList.toggle('is-active', on && !a.matches('.ch-tab'));
    if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  }
  function press(a) {
    var bar = a.closest('[data-jd-chips]'), prev = activeOf(bar);
    if (prev === a) return;
    if (prev) setOn(prev, false);
    setOn(a, true);
    reveal(bar, true);
  }
  /* chip state before an optimistic switch, so a failed load can put it back */
  function snapChips() {
    var out = [];
    bars.forEach(function (bar) { bar.querySelectorAll('a').forEach(function (a) { out.push([a, a.getAttribute('aria-current'), a.classList.contains('is-active')]); }); });
    return out;
  }
  function restoreChips(snap) {
    snap.forEach(function (r) {
      if (r[1]) r[0].setAttribute('aria-current', r[1]); else r[0].removeAttribute('aria-current');
      r[0].classList.toggle('is-active', r[2]);
    });
    bars.forEach(function (b) { reveal(b, true); });
  }
  /* back/forward: switch the chip whose link is the new URL before the data arrives */
  function pressFor(url) {
    var want = loc(url);
    bars.forEach(function (bar) {
      bar.querySelectorAll('a').forEach(function (a) { if (loc(a.href) === want) press(a); });
    });
  }

  /* ---------- listing skeleton (same ghost cards as the page-change overlay in jd-vt.js) ---------- */
  var MIN_SKEL = 220;
  function kindFor(url) {
    var u = new URL(url, location.href), p = u.pathname;
    if (/^\/game/.test(p)) return 'game';
    if (/^\/komunitas/.test(p)) return u.searchParams.get('tab') === 'profil' ? 'pfmini' : 'feed';
    return 'news';
  }
  function skelOn(url) {
    var list = doc.querySelector('[data-jd-slot="list"]');
    if (!list || !window.jdSkel) { slots.forEach(function (s) { s.classList.add('jd-loading'); }); return; }
    skelOff();
    var kind = kindFor(url), box = doc.createElement('div');
    box.className = 'jd-fskel';
    box.setAttribute('aria-hidden', 'true');
    /* komunitas profile search: the real search/sort form stays, a ghost bar stands in when it is not on screen yet */
    var form = list.querySelector(':scope > form[data-jd-form]');
    box.innerHTML = (kind === 'pfmini' && !form ? '<div class="jd-sk jd-fskel__bar"></div>' : '') + window.jdSkel.list(kind);
    list.insertBefore(box, form ? form.nextSibling : list.firstChild);
    list.classList.add('jd-skel-on');
    list.setAttribute('aria-busy', 'true');
    say('Memuat…');
  }
  function skelOff() {
    var list = doc.querySelector('[data-jd-slot="list"]');
    slots.forEach(function (s) { s.classList.remove('jd-loading'); });
    if (!list) return;
    list.querySelectorAll(':scope > .jd-fskel').forEach(function (n) { n.remove(); });
    list.classList.remove('jd-skel-on');
    list.removeAttribute('aria-busy');
  }
  var live = null;
  function say(t) {
    if (!live) { live = doc.createElement('p'); live.className = 'sr-only'; live.setAttribute('aria-live', 'polite'); doc.body.appendChild(live); }
    live.textContent = t;
  }

  /* ---------- error toast ---------- */
  var toastEl = null, toastT = null;
  function toast(msg, retry) {
    if (!toastEl) {
      toastEl = doc.createElement('div');
      toastEl.className = 'jd-toast';
      toastEl.setAttribute('role', 'alert');
      doc.body.appendChild(toastEl);
    }
    toastEl.innerHTML = '';
    var t = doc.createElement('span'); t.textContent = msg; toastEl.appendChild(t);
    if (retry) {
      var b = doc.createElement('button');
      b.type = 'button'; b.className = 'jd-toast__btn'; b.textContent = 'Coba lagi';
      b.addEventListener('click', function () { b.classList.add('is-pressed'); hideToast(); retry(); });
      toastEl.appendChild(b);
    }
    var x = doc.createElement('button');
    x.type = 'button'; x.className = 'jd-toast__x'; x.setAttribute('aria-label', 'Tutup'); x.textContent = '×';
    x.addEventListener('click', hideToast);
    toastEl.appendChild(x);
    void toastEl.offsetWidth;
    toastEl.classList.add('is-on');
    clearTimeout(toastT); toastT = setTimeout(hideToast, 7000);
  }
  function hideToast() { if (toastEl) toastEl.classList.remove('is-on'); }

  /* opts.snap: chip state to restore on failure; opts.pop: back/forward (URL already changed) */
  function go(url, push, scrollTop, opts) {
    opts = opts || {};
    if (ctl) ctl.abort();
    ctl = new AbortController();
    var my = ctl, t0 = Date.now(), timedOut = false;
    hideToast();
    skelOn(url);
    var t = setTimeout(function () { timedOut = true; my.abort(); }, 12000);
    function failed() {
      if (my !== ctl) return;
      ctl = null;
      skelOff(); say('');
      if (opts.pop) { location.href = url; return; }   /* history already moved: let the browser load it */
      if (opts.snap) restoreChips(opts.snap);
      toast(navigator.onLine === false ? 'Kamu sedang offline. Filter belum bisa dimuat.' : 'Gagal memuat. Filter dikembalikan.', function () {
        if (opts.chip) press(opts.chip);
        go(url, push, scrollTop, { snap: opts.snap, chip: opts.chip });
      });
    }
    fetch(url, { credentials: 'same-origin', signal: my.signal, headers: { 'Accept': 'text/html', 'X-Requested-With': 'jd-swap' } })
      .then(function (r) {
        var ct = r.headers.get('content-type') || '';
        if (!r.ok || ct.indexOf('text/html') < 0) throw new Error('http');
        return r.text().then(function (h) { return { h: h, url: r.url || url }; });
      })
      .then(function (res) {
        clearTimeout(t);
        if (my !== ctl) return null;
        var next = new DOMParser().parseFromString(res.h, 'text/html'), ok = true;
        slots.forEach(function (s) { if (!next.querySelector('[data-jd-slot="' + s.getAttribute('data-jd-slot') + '"]')) ok = false; });
        /* a different page layout came back: not an error, just open it normally */
        if (!ok || next.querySelectorAll('[data-jd-chips]').length !== bars.length) { location.href = res.url; return null; }
        /* keep the skeleton up a moment on very fast answers, so it reads as a step and not a flash */
        var wait = Math.max(0, MIN_SKEL - (Date.now() - t0));
        return new Promise(function (done) { setTimeout(function () { done({ next: next, url: res.url }); }, wait); });
      })
      .then(function (r) {
        if (!r || my !== ctl) return;
        ctl = null;
        var next = r.next;
        slots.forEach(function (s) {
          s.innerHTML = next.querySelector('[data-jd-slot="' + s.getAttribute('data-jd-slot') + '"]').innerHTML;
          if (s.getAttribute('data-jd-slot') === 'list') enter(s);
        });
        skelOff(); say('');
        syncChips(next); syncForms(next); head(next);
        var fin = loc(r.url);
        if (push) history.pushState({ jd: 1 }, '', fin);
        else if (fin !== loc(location.href)) history.replaceState({ jd: 1 }, '', fin);
        cur = fin;
        var l = doc.querySelector('[data-jd-slot="list"]');
        if (doc.querySelectorAll('time[data-jd-time]').length && window.__jdLocalTime) window.__jdLocalTime();
        doc.querySelectorAll('[data-jd-slot] [data-jd-view]').forEach(function (el) {
          try { var p = JSON.parse(el.getAttribute('data-jd-params') || '{}'); if (window.jdTrack) window.jdTrack(el.getAttribute('data-jd-view'), p); } catch (e) {}
        });
        if (scrollTop && l) {
          var y = l.getBoundingClientRect().top + window.scrollY - 90;
          if (y < window.scrollY) window.scrollTo({ top: Math.max(0, y), behavior: still() ? 'auto' : 'smooth' });
        }
      })
      .catch(function (e) {
        clearTimeout(t);
        if (e && e.name === 'AbortError' && !timedOut) return;   /* replaced by a newer click */
        failed();
      });
  }

  doc.addEventListener('click', function (e) {
    if (e.defaultPrevented || e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var a = e.target.closest && e.target.closest('a[href]');
    if (!a || (a.target && a.target !== '_self') || a.hasAttribute('download')) return;
    var inChips = a.closest('[data-jd-chips]');
    var inPager = a.closest('[data-jd-slot="list"] .pager, [data-jd-slot="list"] .pf-pager');
    if (!inChips && !inPager) return;
    var u = new URL(a.href, location.href);
    if (u.origin !== location.origin || (u.pathname === location.pathname && u.search === location.search && u.hash)) return;
    e.preventDefault();
    if (loc(u.href) === cur && inChips && !ctl) return;
    var snap = snapChips();
    if (inChips) press(a);
    go(u.href, true, !!inPager, { snap: snap, chip: inChips ? a : null });
  });
  doc.addEventListener('submit', function (e) {
    var f = e.target;
    if (e.defaultPrevented || !f.matches || !f.matches('form[data-jd-form]') || (f.method || 'get').toLowerCase() !== 'get') return;
    e.preventDefault();
    var u = new URL(f.action, location.href), fd = new FormData(f);
    u.search = '';
    fd.forEach(function (v, k) { if (String(v) !== '') u.searchParams.append(k, v); });
    var btn = e.submitter || f.querySelector('button[type="submit"],button:not([type])');
    if (btn) { btn.classList.add('is-pressed'); setTimeout(function () { btn.classList.remove('is-pressed'); }, 160); }
    go(u.href, true, false, { snap: snapChips() });
  });
  doc.addEventListener('change', function (e) {
    var s = e.target;
    if (s && s.matches && s.matches('form[data-jd-form] select') && s.form.requestSubmit) s.form.requestSubmit();
  });
  window.addEventListener('popstate', function () {
    if (loc(location.href) === cur && !ctl) return;
    pressFor(location.href);
    go(location.href, false, false, { pop: true });
  });
})();

/* Infinite scroll for listings (news, game, komunitas). Shared by all three.
   Server renders real ?page=N pages with a plain "Muat lebih banyak" link (crawlers, no-JS). This script:
   - auto-loads the next batch (?partial=1) when the footer nears the viewport, at most MAX_AUTO times,
   - then keeps the button so the visitor loads one batch per click (footer stays reachable),
   - shows ghost cards while a click loads, a small spinner for auto-loads, and a retry button on errors,
   - re-loads the batches the visitor had open when coming back (back/forward) from a card, then restores scroll. */
(function () {
  'use strict';
  var MAX_AUTO = 3, TIMEOUT = 15000;
  var L = '&nbsp;', L2 = '&nbsp;<br>&nbsp;', L3 = '&nbsp;<br>&nbsp;<br>&nbsp;', L5 = '&nbsp;<br>&nbsp;<br>&nbsp;<br>&nbsp;<br>&nbsp;';
  var reduce = window.matchMedia ? matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
  var restoredOnce = false;

  /* ghost cards use the real card classes, so the colours and box sizes match (peach on game, clay on news/komunitas) */
  function ghost(kind) {
    if (kind === 'game') return '<div class="game-card jd-ghost inf-ghost"><div class="game-card__media jd-sk"></div><h2 class="game-card__title">' + L + '</h2><p class="game-card__desc">' + L5 + '</p><div class="game-card__footer"><span class="game-card__badge">Mainkan</span><span class="game-card__play">Buka Game</span></div></div>';
    if (kind === 'profile') return '<div class="pf-mini jd-ghost inf-ghost"><span class="pf-mini__av pf-mini__av--ph jd-sk"></span><span class="pf-mini__body"><strong>' + L + '</strong><span class="pf-user">' + L + '</span><span class="news-date">' + L + '</span></span></div>';
    return '<div class="news-card jd-ghost inf-ghost"><div class="jd-sk jd-sk-news-img"></div><h2>' + L3 + '</h2><div class="news-meta-row"><span class="news-date">' + L + '</span></div></div>';
  }

  function navType() { try { return performance.getEntriesByType('navigation')[0].type; } catch (e) { return ''; } }
  function key() { return 'jd:inf:' + location.pathname + location.search; }

  function init(nav) {
    if (nav.classList.contains('is-js')) return;
    var list = nav.parentNode && nav.parentNode.querySelector('[data-jd-inf-list]');
    var btn = nav.querySelector('.inf__btn'), status = nav.querySelector('.inf__status');
    if (!list || !btn || !window.fetch || !window.IntersectionObserver || !window.DOMParser) return;

    var kind = nav.getAttribute('data-kind') || 'news';
    var next = nav.getAttribute('data-next');
    var page = parseInt(nav.getAttribute('data-page'), 10) || 1;
    var auto = 0, busy = false, io = null, ghosts = [], seen = {};
    nav.classList.add('is-js', 'is-auto');
    btn.setAttribute('aria-live', 'off');
    var prevLink = nav.querySelector('.inf__prev');
    if (prevLink) prevLink.hidden = true;
    var label = btn.textContent;

    function mark() {
      Array.prototype.forEach.call(list.children, function (c) { var h = c.getAttribute && c.getAttribute('href'); if (h) seen[h] = 1; });
    }
    mark();

    function say(t) { if (status) status.textContent = t || ''; }
    function addGhosts() {
      var n = kind === 'game' ? 3 : kind === 'profile' ? 4 : 3, t = document.createElement('template');
      t.innerHTML = new Array(n + 1).join(ghost(kind));
      ghosts = Array.prototype.slice.call(t.content.children);
      ghosts.forEach(function (g) { g.setAttribute('aria-hidden', 'true'); list.appendChild(g); });
    }
    function dropGhosts() { ghosts.forEach(function (g) { g.remove(); }); ghosts = []; }

    function append(frag) {
      var n = 0;
      Array.prototype.slice.call(frag.children).forEach(function (c) {
        var h = c.getAttribute('href');
        if (h && seen[h]) return;
        if (h) seen[h] = 1;
        c.classList.add('inf-in');
        c.style.setProperty('--i', Math.min(n++, 11));
        list.appendChild(c);
      });
      try { if (window.__jdLocalTime) window.__jdLocalTime(); } catch (e) {}
    }

    /* fetch one batch; resolves with false when it was the last one */
    function fetchBatch() {
      var ctl = new AbortController(), t = setTimeout(function () { ctl.abort(); }, TIMEOUT);
      return fetch(next, { credentials: 'same-origin', signal: ctl.signal, headers: { 'Accept': 'text/html', 'X-Requested-With': 'jd-inf' } })
        .then(function (r) {
          clearTimeout(t);
          if (!r.ok || (r.headers.get('content-type') || '').indexOf('text/html') < 0) throw new Error('bad');
          return r.text();
        })
        .then(function (html) {
          var tpl = document.createElement('template');
          tpl.innerHTML = html;
          var f = tpl.content, nn = f.querySelector('[data-jd-inf]');
          if (nn) nn.remove();
          append(f);
          page++;
          var nb = nn && nn.querySelector('.inf__btn');
          next = nb ? nn.getAttribute('data-next') : null;
          if (nb) btn.setAttribute('href', nb.getAttribute('href'));
          nav.setAttribute('data-page', page);
          return !!next;
        }, function (e) { clearTimeout(t); throw e; });
    }

    function finish() {
      if (io) { io.disconnect(); io = null; }
      btn.hidden = true;
      if (!nav.querySelector('.inf__end')) {
        var p = document.createElement('p');
        p.className = 'inf__end'; p.textContent = 'Sudah semua';
        nav.insertBefore(p, status || null);
      }
      nav.classList.remove('is-auto');
      nav.classList.add('is-done');
      say('');
    }
    function manual() {
      if (io) { io.disconnect(); io = null; }
      nav.classList.remove('is-auto');
    }
    function watch() {
      if (!io) return;
      io.unobserve(nav); io.observe(nav);   /* re-check: it may still be in range after the batch */
    }
    function fail(wasAuto) {
      dropGhosts(); busy = false;
      nav.classList.remove('is-busy'); btn.removeAttribute('aria-busy'); btn.classList.remove('is-pressed');
      nav.classList.add('is-error');
      btn.textContent = 'Gagal memuat. Coba lagi';
      btn.hidden = false;
      say('');
      manual();
    }

    function load(isAuto) {
      if (busy || !next) return;
      busy = true;
      nav.classList.remove('is-error');
      if (isAuto) { nav.classList.add('is-loading'); say('Memuat…'); }
      else { nav.classList.add('is-busy'); btn.setAttribute('aria-busy', 'true'); btn.textContent = 'Memuat…'; addGhosts(); }
      fetchBatch().then(function (more) {
        dropGhosts(); busy = false;
        nav.classList.remove('is-busy', 'is-loading'); btn.removeAttribute('aria-busy'); btn.classList.remove('is-pressed');
        btn.textContent = label; say('');
        if (!more) return finish();
        if (isAuto) { auto++; if (auto >= MAX_AUTO) manual(); else watch(); }
      }, function () { fail(isAuto); });
    }

    btn.addEventListener('click', function (e) {
      if (e.defaultPrevented || e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      if (!next) return;
      e.preventDefault();
      load(false);
    });
    /* instant press feedback, before the fetch even starts (touch :active can lag) */
    btn.addEventListener('pointerdown', function () { btn.classList.add('is-pressed'); });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (ev) {
      btn.addEventListener(ev, function () { if (!busy) btn.classList.remove('is-pressed'); });
    });

    io = new IntersectionObserver(function (es) {
      if (es.some(function (e) { return e.isIntersecting; }) && !busy && next && auto < MAX_AUTO) load(true);
    }, { rootMargin: '0px 0px 600px 0px' });

    /* remember how many batches were open when a card is opened, so Back can bring the same view */
    list.addEventListener('click', function (e) {
      var a = e.target.closest && e.target.closest('a[href]');
      if (!a || !list.contains(a)) return;
      try { sessionStorage.setItem(key(), JSON.stringify({ last: page, y: window.scrollY })); } catch (x) {}
    });

    var saved = null;
    if (!restoredOnce && navType() === 'back_forward') {
      try { saved = JSON.parse(sessionStorage.getItem(key()) || 'null'); sessionStorage.removeItem(key()); } catch (x) {}
    }
    restoredOnce = true;
    if (saved && saved.last > page && next) {
      busy = true; say('Memuat…'); nav.classList.add('is-loading');
      try { history.scrollRestoration = 'manual'; } catch (x) {}
      var steps = 0;
      (function step() {
        if (page >= saved.last || !next || steps++ > 30) {
          busy = false; nav.classList.remove('is-loading'); say('');
          auto = Math.min(MAX_AUTO, steps);
          if (!next) return finish();
          window.scrollTo(0, saved.y || 0);
          if (auto >= MAX_AUTO) manual(); else io.observe(nav);
          return;
        }
        fetchBatch().then(step, function () { busy = false; nav.classList.remove('is-loading'); fail(false); window.scrollTo(0, saved.y || 0); });
      })();
    } else {
      io.observe(nav);
    }
  }

  function scan() { Array.prototype.forEach.call(document.querySelectorAll('[data-jd-inf]:not(.is-js)'), init); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', scan); else scan();
  /* listing swapped in place by jd-filters.js (chips/search): the new footer needs wiring too */
  if (window.MutationObserver) new MutationObserver(scan).observe(document.body || document.documentElement, { childList: true, subtree: true });
})();

/* Instant click feedback for main-nav navigation: on click, immediately overlay the content area (below the nav)
   with a skeleton that matches the target section. Removed on pagehide/pageshow so it never sticks (bfcache). */
(function () {
  'use strict';
  var el = null, safety = null;
  /* Skeleton cards reuse the real card classes and structure (text is ghosted), so box sizes match the real cards. */
  var L = '&nbsp;', L2 = '&nbsp;<br>&nbsp;', L3 = '&nbsp;<br>&nbsp;<br>&nbsp;', L5 = '&nbsp;<br>&nbsp;<br>&nbsp;<br>&nbsp;<br>&nbsp;';
  function card(kind) {
    if (kind === 'game') return '<div class="game-card jd-ghost"><div class="game-card__media jd-sk"></div><h2 class="game-card__title">' + L + '</h2><p class="game-card__desc">' + L5 + '</p><div class="game-card__footer"><span class="game-card__badge">Mainkan</span><span class="game-card__play">Buka Game</span></div></div>';
    if (kind === 'profile') return '<div class="ch-card jd-ghost"><header class="ch-head"><span class="ch-av jd-sk"></span><div class="ch-who"><span class="ch-name">' + L + '</span><span class="ch-meta">' + L + '</span></div></header><div class="ch-body">' + L3 + '</div><footer class="ch-actions"><span class="ch-act">' + L + '</span></footer></div>';
    if (kind === 'pfmini') return '<div class="pf-mini jd-ghost"><span class="pf-mini__av pf-mini__av--ph jd-sk"></span><span class="pf-mini__body"><strong>' + L + '</strong><span class="pf-user">' + L + '</span><span class="news-date">' + L + '</span></span></div>';
    return '<div class="news-card jd-ghost"><div class="jd-sk jd-sk-news-img"></div><h2>' + L3 + '</h2><div class="news-meta-row"><span class="news-date">' + L + '</span></div></div>';
  }
  /* Shared with jd-filters.js: the listing skeleton for a filter/tab change, same ghost cards as the page-change overlay.
     kind: news | game | feed (curhatan cards) | pfmini (komunitas profile cards). */
  window.jdSkel = {
    list: function (kind) {
      var wrap = kind === 'game' ? 'game-grid' : kind === 'feed' ? 'ch-list ch-list--feed' : kind === 'pfmini' ? 'pf-cards' : 'news-grid';
      var n = kind === 'feed' ? 5 : kind === 'pfmini' ? 8 : 6, c = '';
      for (var i = 0; i < n; i++) c += card(kind === 'feed' ? 'profile' : kind);
      return '<div class="' + wrap + '">' + c + '</div>';
    }
  };
  function build(path) {
    var kind = /^\/u\//.test(path) ? 'profil' : /^\/game/.test(path) ? 'game' : /^\/komunitas/.test(path) ? 'komunitas' : /^\/berita/.test(path) ? 'berita' : 'generic';
    var box = document.createElement('div');
    box.className = 'jd-skel';
    box.setAttribute('aria-hidden', 'true');
    var tpl = kind !== 'generic' ? document.getElementById('jd-sk-' + kind) : null;
    var main = document.createElement('main');
    main.className = 'clay-main';
    var shell = document.createElement('div');
    shell.className = 'clay-shell';
    main.appendChild(shell);
    box.appendChild(main);
    if (tpl) {
      /* real static UI (title, chips, search, tabs) from the same partials as the page; only the listing is skeleton */
      shell.appendChild(tpl.content.cloneNode(true));
      shell.querySelectorAll('[id]').forEach(function (n) { n.removeAttribute('id'); });
      shell.querySelectorAll('[for]').forEach(function (n) { n.removeAttribute('for'); });
      shell.querySelectorAll('[data-jd-chips],[data-jd-slot],[data-jd-form],[data-jd-view],[data-jd-params]').forEach(function (n) {
        ['data-jd-chips', 'data-jd-slot', 'data-jd-form', 'data-jd-view', 'data-jd-params'].forEach(function (k) { n.removeAttribute(k); });
      });
      shell.querySelectorAll('a,input,button,select').forEach(function (n) { n.tabIndex = -1; });
      var slot = shell.querySelector('[data-sk]');
      var n = kind === 'komunitas' ? 5 : 6, cards = '';
      if (kind === 'profil') { if (slot) slot.innerHTML = '<div class="jd-sk jd-sk-pfhead"></div><div class="jd-sk jd-sk-pfblock"></div><div class="jd-sk jd-sk-pfblock"></div>'; }
      else {
      for (var i = 0; i < n; i++) cards += card(kind === 'game' ? 'game' : kind === 'komunitas' ? 'profile' : 'news');
      if (slot) slot.innerHTML = cards;
      }
    } else {
      var g = '';
      for (var j = 0; j < 3; j++) g += card('news');
      shell.innerHTML = '<div class="clay-section"><i class="jd-sk jd-sk-title"></i><div class="news-grid">' + g + '</div></div>';
    }
    return box;
  }
  function show(path) {
    hide(true);
    var h = document.querySelector('.clay-header');
    el = build(path);
    el.style.top = (h ? Math.max(0, Math.round(h.getBoundingClientRect().bottom)) : 0) + 'px';
    document.body.appendChild(el);
    void el.offsetWidth;
    el.classList.add('is-on');
    document.documentElement.classList.add('jd-leaving');
    /* leaving a profile: the status bar drops the member colour at once */
    var bar = document.querySelector('meta[name="theme-color"][data-fixed]');
    if (bar && window.__defaultThemeColor) { bar.dataset.pageColor = bar.dataset.pageColor || bar.content; bar.setAttribute('content', window.__defaultThemeColor()); }
    safety = setTimeout(function () { hide(); }, 15000);
  }
  function hide(keepBar) {
    clearTimeout(safety);
    document.documentElement.classList.remove('jd-leaving');
    var fixed = document.querySelector('meta[name="theme-color"][data-fixed]');
    if (keepBar !== true && fixed && fixed.dataset.pageColor) { fixed.setAttribute('content', fixed.dataset.pageColor); }
    if (el) { el.remove(); el = null; }
    if (keepBar !== true) restoreNav();
  }

  /* Instant nav state: the destination item becomes active on pointerdown, before anything loads. */
  var NAVSEL = '.clay-nav a, .clay-bottom-nav a';
  function navLinks() { return Array.prototype.slice.call(document.querySelectorAll(NAVSEL)); }
  var initial = null;
  function snapshot() { initial = navLinks().map(function (l) { return l.getAttribute('aria-current'); }); }
  function restoreNav() {
    if (!initial) return;
    navLinks().forEach(function (l, i) {
      l.classList.remove('is-pressed');
      if (initial[i]) l.setAttribute('aria-current', initial[i]); else l.removeAttribute('aria-current');
    });
  }
  function markNav(a) {
    var path = a.pathname;
    navLinks().forEach(function (l) {
      var on = l.pathname === path && !l.classList.contains('clay-brand');
      l.classList.toggle('is-pressed', on);
      if (on) l.setAttribute('aria-current', 'page'); else l.removeAttribute('aria-current');
    });
  }
  function navTarget(e) {
    var a = e.target.closest && e.target.closest(NAVSEL);
    if (!a || (a.target && a.target !== '_self') || a.hasAttribute('download') || a.origin !== location.origin) return null;
    return a;
  }
  var armed = null;
  document.addEventListener('pointerdown', function (e) {
    if ((e.pointerType === 'mouse' && e.button) || e.metaKey || e.ctrlKey || e.shiftKey) return;
    var a = navTarget(e);
    if (!a || (a.pathname === location.pathname && a.search === location.search)) return;
    armed = a; markNav(a);
  }, true);
  function disarm(e) {
    if (!armed) return;
    var a = armed; armed = null;
    var up = e.type === 'pointerup' && e.target.closest && e.target.closest(NAVSEL) === a;
    if (!up) restoreNav();
  }
  document.addEventListener('pointerup', disarm, true);
  document.addEventListener('pointercancel', disarm, true);
  snapshot();
  document.addEventListener('click', function (e) {
    if (e.defaultPrevented || e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var a = e.target.closest && e.target.closest('.clay-nav a, .clay-bottom-nav a, .clay-brand');
    if (!a || (a.target && a.target !== '_self') || a.hasAttribute('download') || a.origin !== location.origin) return;
    if (a.pathname === location.pathname && a.search === location.search) return;
    markNav(a);
    show(a.pathname);
  });
  window.addEventListener('pageshow', function () { hide(); });
  window.addEventListener('pagehide', function () { hide(true); });
})();

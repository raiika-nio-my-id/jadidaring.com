/* Instant click feedback for main-nav navigation: on click, immediately overlay the content area (below the nav)
   with a skeleton that matches the target section. Removed on pagehide/pageshow so it never sticks (bfcache). */
(function () {
  'use strict';
  var el = null, safety = null;
  function card(kind) {
    if (kind === 'game') return '<div class="jd-sk-card"><i class="jd-sk jd-sk-img"></i><i class="jd-sk jd-sk-line"></i><i class="jd-sk jd-sk-line jd-sk-short"></i></div>';
    if (kind === 'profile') return '<div class="jd-sk-card jd-sk-row"><i class="jd-sk jd-sk-av"></i><span><i class="jd-sk jd-sk-line"></i><i class="jd-sk jd-sk-line jd-sk-short"></i></span></div>';
    return '<div class="jd-sk-card"><i class="jd-sk jd-sk-img"></i><i class="jd-sk jd-sk-line"></i><i class="jd-sk jd-sk-line"></i><i class="jd-sk jd-sk-line jd-sk-short"></i></div>';
  }
  function build(path) {
    var kind = /^\/game/.test(path) ? 'game' : /^\/komunitas/.test(path) ? 'profile' : /^\/(berita|$)/.test(path) ? 'news' : 'generic';
    var n = kind === 'profile' ? 8 : kind === 'generic' ? 3 : 6, cards = '';
    for (var i = 0; i < n; i++) cards += card(kind === 'generic' ? 'news' : kind);
    var box = document.createElement('div');
    box.className = 'jd-skel';
    box.setAttribute('aria-hidden', 'true');
    box.innerHTML = '<div class="clay-shell"><i class="jd-sk jd-sk-title"></i><div class="jd-sk-grid jd-sk-grid--' + kind + '">' + cards + '</div></div>';
    return box;
  }
  function show(path) {
    hide();
    var h = document.querySelector('.clay-header');
    el = build(path);
    el.style.top = (h ? Math.max(0, Math.round(h.getBoundingClientRect().bottom)) : 0) + 'px';
    document.body.appendChild(el);
    void el.offsetWidth;
    el.classList.add('is-on');
    safety = setTimeout(hide, 15000);
  }
  function hide() {
    clearTimeout(safety);
    if (el) { el.remove(); el = null; }
  }
  document.addEventListener('click', function (e) {
    if (e.defaultPrevented || e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var a = e.target.closest && e.target.closest('.clay-nav a, .clay-bottom-nav a, .clay-brand');
    if (!a || (a.target && a.target !== '_self') || a.hasAttribute('download') || a.origin !== location.origin) return;
    if (a.pathname === location.pathname && a.search === location.search) return;
    show(a.pathname);
  });
  window.addEventListener('pageshow', hide);
  window.addEventListener('pagehide', hide);
})();

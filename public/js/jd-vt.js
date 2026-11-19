/* Thin top progress bar for slow main-nav navigations (appears only after 300ms). */
(function () {
  'use strict';
  var bar, timer;
  function off() { clearTimeout(timer); if (bar) { bar.classList.remove('is-on'); } }
  document.addEventListener('click', function (e) {
    if (e.defaultPrevented || e.button || e.metaKey || e.ctrlKey || e.shiftKey) return;
    var a = e.target.closest && e.target.closest('.clay-nav a, .clay-bottom-nav a, .clay-brand');
    if (!a || a.target === '_blank' || a.origin !== location.origin) return;
    clearTimeout(timer);
    timer = setTimeout(function () {
      if (!bar) { bar = document.createElement('div'); bar.className = 'jd-progress'; bar.setAttribute('aria-hidden', 'true'); document.body.appendChild(bar); }
      void bar.offsetWidth; bar.classList.add('is-on');
    }, 300);
  });
  window.addEventListener('pageshow', off);
  window.addEventListener('pagehide', off);
})();

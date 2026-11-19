/* Chip click feedback (trial): clicked chip jiggles while settling into the pressed state (capture phase: runs before the optimistic press). Own file/commit so it can be reverted alone. */
(function () {
  'use strict';
  if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  function play(el, cls) {
    el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls);
    el.addEventListener('animationend', function h() { el.classList.remove(cls); el.removeEventListener('animationend', h); });
  }
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('[data-jd-chips] a');
    if (!a || e.button || e.metaKey || e.ctrlKey || e.shiftKey || a.getAttribute('aria-current') === 'page') return;
    play(a, 'jd-jig');
  }, true);
})();

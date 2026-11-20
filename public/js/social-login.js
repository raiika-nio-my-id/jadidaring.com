/* Instant press feedback on social login links: spinner + "Membuka …" the moment the finger lands, reset on bfcache/back. */
(function () {
    'use strict';
    var links = document.querySelectorAll('.clay-social__btn[data-loading-text]');
    if (!links.length) { return; }
    function busy(a) {
        if (a.getAttribute('aria-busy') === 'true') { return; }
        var label = a.querySelector('span');
        if (label && !a.hasAttribute('data-label')) { a.setAttribute('data-label', label.textContent); }
        if (label) { label.textContent = a.getAttribute('data-loading-text'); }
        a.setAttribute('aria-busy', 'true');
        a.classList.add('is-loading');
    }
    function reset() {
        links.forEach(function (a) {
            var label = a.querySelector('span');
            if (label && a.hasAttribute('data-label')) { label.textContent = a.getAttribute('data-label'); }
            a.removeAttribute('aria-busy');
            a.classList.remove('is-loading');
        });
    }
    links.forEach(function (a) {
        a.addEventListener('pointerdown', function (e) { if (e.button === 0) { busy(a); } });
        a.addEventListener('pointercancel', reset);
        a.addEventListener('click', function (e) {
            if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) { reset(); return; }
            if (a.getAttribute('data-clicked') === '1') { e.preventDefault(); return; }
            a.setAttribute('data-clicked', '1');
            busy(a);
        });
    });
    window.addEventListener('pageshow', function () { reset(); links.forEach(function (a) { a.removeAttribute('data-clicked'); }); });
})();

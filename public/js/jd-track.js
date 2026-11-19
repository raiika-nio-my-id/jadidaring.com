/* Declarative GA4 hooks. All sends go through window.jdTrack, which no-ops without consent.
   [data-jd-view]  -> fires once on load      [data-jd-click] -> fires on click
   Both take JSON params in data-jd-params and the event name in the attribute value.
   Also: outbound link clicks, article read_complete at 75% scroll. No PII is ever collected here. */
(function () {
    'use strict';
    function t(name, params) { if (window.jdTrack) { window.jdTrack(name, params || {}); } }
    function params(el) {
        try { return JSON.parse(el.getAttribute('data-jd-params') || '{}'); } catch (e) { return {}; }
    }
    function run() {
        document.querySelectorAll('[data-jd-view]').forEach(function (el) { t(el.getAttribute('data-jd-view'), params(el)); });
    }
    if (window.__gaLoaded) { run(); } else { document.addEventListener('jd:ga-ready', run, { once: true }); }

    document.addEventListener('click', function (e) {
        var el = e.target && e.target.closest ? e.target.closest('[data-jd-click]') : null;
        if (el) { t(el.getAttribute('data-jd-click'), params(el)); }
        var a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
        if (a && !el) {
            try {
                var u = new URL(a.href, location.href);
                if ((u.protocol === 'http:' || u.protocol === 'https:') && u.hostname !== location.hostname && !/(^|\.)jadidaring\.com$/.test(u.hostname)) {
                    t('outbound_click', { link_domain: u.hostname, outbound: true });
                }
            } catch (err) {}
        }
    }, true);

    var art = document.querySelector('[data-jd-article]');
    if (art) {
        var sent = false;
        var check = function () {
            if (sent) { return; }
            var r = art.getBoundingClientRect(), h = r.height;
            if (h > 0 && (window.innerHeight - r.top) / h >= 0.75) {
                sent = true;
                window.removeEventListener('scroll', check);
                var p = params(art);
                p.percent_scrolled = 75;
                t('read_complete', p);
            }
        };
        window.addEventListener('scroll', check, { passive: true });
    }

})();

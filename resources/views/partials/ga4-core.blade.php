{{-- Shared GA4 core: consent mode, lazy gtag load, window.jdTrack(name, params). $ga4 = measurement id, $banner = show consent banner. --}}
@if (! $ga4)
<script>window.jdTrack = function () {};</script>
@else
<script>
    (function () {
        var id = @json($ga4), key = 'jadidaring-consent';
        window.dataLayer = window.dataLayer || [];
        function gtag() { dataLayer.push(arguments); }
        window.__gaLoaded = false;
        window.jdTrack = function (name, params) {
            if (!window.__gaLoaded || typeof name !== 'string' || !/^[a-z][a-z0-9_]{0,39}$/.test(name)) { return; }
            var p = {};
            if (params && typeof params === 'object') {
                for (var k in params) {
                    if (Object.prototype.hasOwnProperty.call(params, k) && /^[a-z][a-z0-9_]{0,39}$/.test(k)) {
                        var v = params[k];
                        if (typeof v === 'number' || typeof v === 'boolean') { p[k] = v; } else if (typeof v === 'string') { p[k] = v.slice(0, 100); }
                    }
                }
            }
            gtag('event', name, p);
        };
        if (!id) { return; }
        gtag('consent', 'default', { analytics_storage: 'denied', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' });
        function load() {
            if (window.__gaLoaded) { return; }
            window.__gaLoaded = true;
            gtag('consent', 'update', { analytics_storage: 'granted' });
            var s = document.createElement('script');
            s.async = true;
            s.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(id);
            document.head.appendChild(s);
            gtag('js', new Date());
            gtag('config', id, { anonymize_ip: true });
            document.dispatchEvent(new Event('jd:ga-ready'));
        }
        window.jdGaLoad = load;
        var saved = null;
        try { saved = localStorage.getItem(key); } catch (e) {}
        var banner = document.getElementById('consent-banner');
        if (saved === 'granted') { load(); } else if (saved !== 'denied' && banner) { banner.hidden = false; }
        if (banner) {
            banner.addEventListener('click', function (e) {
                var v = e.target && e.target.getAttribute && e.target.getAttribute('data-consent');
                if (!v) { return; }
                try { localStorage.setItem(key, v); } catch (err) {}
                banner.hidden = true;
                if (v === 'granted') { load(); }
            });
        }
    })();
</script>
@endif

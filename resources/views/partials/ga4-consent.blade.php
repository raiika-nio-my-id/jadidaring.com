@php($ga4 = (string) config('services.ga4.measurement_id'))
@if (preg_match('/^G-[A-Z0-9]{4,20}$/', $ga4) === 1)
    <div id="consent-banner" class="clay-consent" role="dialog" aria-label="Persetujuan analitik" hidden>
        <p>Kami memakai Google Analytics untuk memahami penggunaan situs. Data hanya dikumpulkan jika Anda setuju.</p>
        <div>
            <button type="button" class="clay-btn clay-btn--mint" data-consent="granted">Setuju</button>
            <button type="button" class="clay-btn clay-btn--peach" data-consent="denied">Tolak</button>
        </div>
    </div>
    <script>
        (function () {
            var id = @json($ga4), key = 'jadidaring-consent', banner = document.getElementById('consent-banner');
            window.dataLayer = window.dataLayer || [];
            function gtag() { dataLayer.push(arguments); }
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
            }
            var saved = null;
            try { saved = localStorage.getItem(key); } catch (e) {}
            if (saved === 'granted') { load(); } else if (saved !== 'denied') { banner.hidden = false; }
            banner.addEventListener('click', function (e) {
                var v = e.target && e.target.getAttribute && e.target.getAttribute('data-consent');
                if (!v) { return; }
                try { localStorage.setItem(key, v); } catch (err) {}
                banner.hidden = true;
                if (v === 'granted') { load(); }
            });
        })();
    </script>
@endif

<style>#consent-banner[hidden]{display:none!important}</style>
<div id="consent-banner" role="dialog" aria-label="Persetujuan analitik" hidden style="position:fixed;left:8px;right:8px;bottom:8px;z-index:2147483000;background:#fff;color:#222;border-radius:14px;padding:10px 12px;font:13px/1.4 system-ui,sans-serif;box-shadow:0 4px 20px rgba(0,0,0,.25);display:flex;gap:8px;align-items:center;flex-wrap:wrap"><span style="flex:1 1 200px">Kami memakai Google Analytics untuk memahami penggunaan situs. Data hanya dikumpulkan jika Anda setuju.</span><button type="button" data-consent="granted" style="border:0;border-radius:10px;padding:6px 12px;background:#9fe3c4;font:inherit">Setuju</button><button type="button" data-consent="denied" style="border:0;border-radius:10px;padding:6px 12px;background:#f7c9b6;font:inherit">Tolak</button></div>
@include('partials.ga4-core', ['ga4' => $ga4, 'banner' => true])
<script>
    (function () {
        var slug = @json($slug), started = false;
        function start() {
            if (started) { return; }
            started = true;
            window.jdTrack && window.jdTrack('game_start', { game_slug: slug });
        }
        ['pointerdown', 'keydown', 'touchstart'].forEach(function (ev) { addEventListener(ev, start, { capture: true, passive: true }); });
        if (typeof window.fetch === 'function') {
            var native = window.fetch.bind(window);
            window.fetch = function (input, init) {
                var p = native(input, init);
                try {
                    var url = typeof input === 'string' ? input : (input && input.url) || '';
                    var method = String((init && init.method) || (input && input.method) || 'GET').toUpperCase();
                    if (method === 'POST' && /\/api\/game\/scores(\?|$)/.test(url)) {
                        var body = init && typeof init.body === 'string' ? JSON.parse(init.body) : {};
                        p.then(function (r) {
                            if (r && r.ok) { window.jdTrack && window.jdTrack('post_score', { game_slug: slug, score: Number(body.score) || 0 }); }
                        }).catch(function () {});
                    }
                } catch (e) {}
                return p;
            };
        }
    })();
</script>

{{-- game_start / post_score hooks; window.jdTrack comes from ga4-core (top level) or ga4-game-frame (framed git game). $slug = game slug. --}}
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

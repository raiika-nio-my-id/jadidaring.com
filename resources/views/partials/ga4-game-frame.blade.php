{{-- Framed git game (/game/{slug}/play): no second consent banner or gtag here. Events go to the shell page's window.jdTrack, which holds consent. --}}
<script>
    window.jdTrack = function (name, params) {
        try { if (window.parent !== window && typeof window.parent.jdTrack === 'function') { window.parent.jdTrack(name, params); } } catch (e) {}
    };
</script>
@include('partials.ga4-game-hooks', ['slug' => $slug])

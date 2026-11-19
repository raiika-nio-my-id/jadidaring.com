@php($ga4 = (string) config('services.ga4.measurement_id'))
@php($ga4 = preg_match('/^G-[A-Z0-9]{4,20}$/', $ga4) === 1 ? $ga4 : '')
@if ($ga4 !== '')
    <div id="consent-banner" class="clay-consent" role="dialog" aria-label="Persetujuan analitik" hidden>
        <p>Kami memakai Google Analytics untuk memahami penggunaan situs. Data hanya dikumpulkan jika Anda setuju.</p>
        <div>
            <button type="button" class="clay-btn clay-btn--mint" data-consent="granted">Setuju</button>
            <button type="button" class="clay-btn clay-btn--peach" data-consent="denied">Tolak</button>
        </div>
    </div>
@endif
@include('partials.ga4-core', ['ga4' => $ga4, 'banner' => true])
@if ($ga4 !== '')
    @php($flashed = \App\Support\Ga4::pull())
    @if ($flashed !== [])
        <script>(function(){var q=@json($flashed, JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT);function go(){q.forEach(function(e){window.jdTrack(e[0],e[1]);});}if(window.__gaLoaded){go();}else{document.addEventListener('jd:ga-ready',go,{once:true});}})();</script>
    @endif
    <script src="{{ \App\Support\AssetUrl::to('js/jd-track.js') }}" defer></script>
@endif

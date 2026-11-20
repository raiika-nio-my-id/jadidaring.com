@if (empty($articles))
    <div class="clay-card clay-card--sky clay-empty">
        <div class="clay-empty__icon" aria-hidden="true">&#128240;</div>
        <h2 class="clay-empty__title">Berita segera hadir</h2>
        <p class="clay-empty__text">{{ $emptyText ?? '' }}</p>
    </div>
@else
    <div data-jd-inf-list class="news-grid @if (! empty($featured)) news-grid--home @endif">
        @include('clay._news-cards', ['articles' => $articles, 'featured' => $featured ?? null])
    </div>
@endif
@once
    <script src="{{ \App\Support\AssetUrl::to('js/news-nav.js') }}" defer></script>
@endonce

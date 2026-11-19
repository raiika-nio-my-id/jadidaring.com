@if (empty($articles))
    <div class="clay-card clay-card--sky clay-empty">
        <div class="clay-empty__icon" aria-hidden="true">&#128240;</div>
        <h2 class="clay-empty__title">Berita segera hadir</h2>
        <p class="clay-empty__text">{{ $emptyText ?? '' }}</p>
    </div>
@else
    <div class="news-grid @if (! empty($featured)) news-grid--home @endif">
        @foreach ($articles as $a)
            <a href="{{ $a['url'] }}" class="news-card @if (empty($a['image_url'])) news-card--noimg @endif @if (! empty($featured) && $loop->first) news-card--featured @endif">
                @if (! empty($a['image_url']))
                    <img src="{{ $a['image_url'] }}" alt="" width="640" height="360" loading="lazy" decoding="async" referrerpolicy="no-referrer">
                @endif
                <span class="topic-badge topic-badge--{{ $a['topic'] }}">{{ \App\Http\Controllers\ClayController::TOPICS[$a['topic']] ?? $a['topic'] }}</span>
                <h2>{{ $a['title'] }}</h2>
                <p>{{ $a['summary'] }}</p>
                <div class="news-meta-row"><time class="news-date" datetime="{{ $a['published_at'] }}"><svg class="news-date__icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M8 3v4M16 3v4M3 10h18"/></svg><span>{{ \Illuminate\Support\Carbon::parse($a['published_at'])->locale('id')->translatedFormat('d F Y H:i') }}</span></time></div>
            </a>
        @endforeach
    </div>
@endif
@once
    <script src="{{ \App\Support\AssetUrl::to('js/news-nav.js') }}" defer></script>
@endonce

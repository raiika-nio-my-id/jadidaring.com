@if (empty($articles))
    <div class="clay-card clay-card--sky clay-empty">
        <div class="clay-empty__icon" aria-hidden="true">&#128240;</div>
        <h2 class="clay-empty__title">Berita segera hadir</h2>
        <p class="clay-empty__text">{{ $emptyText ?? '' }}</p>
    </div>
@else
    <div class="news-grid">
        @foreach ($articles as $a)
            <a href="{{ $a['url'] }}" class="news-card @if (empty($a['image_url'])) news-card--noimg @endif">
                @if (! empty($a['image_url']))
                    <img src="{{ $a['image_url'] }}" alt="" loading="lazy" referrerpolicy="no-referrer">
                @endif
                <span class="topic-badge topic-badge--{{ $a['topic'] }}">{{ \App\Http\Controllers\ClayController::TOPICS[$a['topic']] ?? $a['topic'] }}</span>
                <h2>{{ $a['title'] }}</h2>
                <p>{{ $a['summary'] }}</p>
                <time datetime="{{ $a['published_at'] }}">{{ \Illuminate\Support\Carbon::parse($a['published_at'])->locale('id')->translatedFormat('d F Y H:i') }}</time>
            </a>
        @endforeach
    </div>
@endif
@once
    <script src="/js/news-nav.js" defer></script>
@endonce

@foreach ($stories as $s)
    <a href="{{ $s['url'] }}" class="news-card">
        <img src="{{ \App\Services\BedtimeImage::src($s['id'], 480, $s['img']['v']) }}"
             srcset="{{ \App\Services\BedtimeImage::src($s['id'], 480, $s['img']['v']) }} 480w, {{ \App\Services\BedtimeImage::src($s['id'], 800, $s['img']['v']) }} 800w"
             sizes="(min-width: 960px) 25vw, (min-width: 640px) 50vw, 100vw"
             width="480" height="252" alt="{{ $s['img']['alt'] }}" loading="lazy" decoding="async">
        <h2>{{ $s['title'] }}</h2>
        <div class="news-meta-row" style="margin-bottom: 0.5rem; color: var(--clay-muted); font-size: 0.875rem;">
            <span>oleh <strong>{{ $s['author'] }}</strong>@if(!empty($s['author_origin'])) <small>({{ $s['author_origin'] }})</small>@endif</span>
        </div>
        <p style="font-size: 0.9375rem; color: var(--clay-ink); line-height: 1.45; margin: 0;">{{ $s['summary'] }}</p>
    </a>
@endforeach

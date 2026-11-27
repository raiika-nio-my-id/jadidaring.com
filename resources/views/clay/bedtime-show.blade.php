@extends('layouts.clay')

@push('head')
    <meta property="article:published_time" content="{{ $publishedWita }}">
    <meta property="article:modified_time" content="{{ $modifiedWita }}">
    <meta property="article:section" content="Bed Time Stories">
    <script type="application/ld+json">{!! json_encode($jsonLd, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_HEX_TAG | JSON_HEX_AMP) !!}</script>
    <script type="application/ld+json">{!! json_encode($breadcrumbLd, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_HEX_TAG | JSON_HEX_AMP) !!}</script>
    <link rel="preload" as="image" href="{{ \App\Services\BedtimeImage::src($story['id'], 800, $story['img']['v']) }}" imagesrcset="{{ \App\Services\BedtimeImage::src($story['id'], 480, $story['img']['v']) }} 480w, {{ \App\Services\BedtimeImage::src($story['id'], 800, $story['img']['v']) }} 800w, {{ \App\Services\BedtimeImage::src($story['id'], 1200, $story['img']['v']) }} 1200w" imagesizes="(min-width: 800px) 760px, 100vw" fetchpriority="high">
@endpush

@section('content')
    <article class="clay-section news-article bedtime-article">
        <a href="/bed-time-stories" class="news-back"><span aria-hidden="true">&larr;</span> Kembali ke Bed Time Stories</a>

        <p><span class="topic-badge topic-badge--static" style="background: #312E81; color: #FEF08A;">Bed Time Stories</span></p>
        <h1 class="clay-section__title">{{ $story['title'] }}</h1>

        <div class="clay-card clay-card--lavender bedtime-credit-block" style="margin: 1.25rem 0; padding: 1rem 1.25rem; border-radius: var(--radius-md);">
            <p style="margin: 0; font-size: 1rem; color: inherit;">
                <strong>Penulis:</strong> {{ $story['author'] }}@if(!empty($story['author_origin'])) ({{ $story['author_origin'] }})@endif
            </p>
            @if (!empty($story['adapter']))
                <p style="margin: 0.35rem 0 0; font-size: 0.9375rem; color: inherit; opacity: 0.92;">
                    <strong>Diceritakan ulang oleh:</strong> {{ $story['adapter'] }}
                </p>
            @endif
        </div>

        @php($im = $story['img'])
        <figure class="news-figure">
            <img class="news-hero" src="{{ \App\Services\BedtimeImage::src($story['id'], 800, $im['v']) }}"
                 srcset="{{ \App\Services\BedtimeImage::src($story['id'], 480, $im['v']) }} 480w, {{ \App\Services\BedtimeImage::src($story['id'], 800, $im['v']) }} 800w, {{ \App\Services\BedtimeImage::src($story['id'], 1200, $im['v']) }} 1200w"
                 sizes="(min-width: 800px) 760px, 100vw" width="1200" height="630" alt="{{ $im['alt'] }}" fetchpriority="high" decoding="async">
            @if ($im['photo'] && $im['credit'])
                <figcaption class="news-figure__credit">
                    Foto: {{ $im['credit'] }}@if($im['license']) · {{ $im['license'] }}@endif
                    @if($im['source_url']) · <a href="{{ $im['source_url'] }}" rel="nofollow noopener noreferrer" target="_blank">Sumber foto</a>@endif
                </figcaption>
            @endif
        </figure>


        <div class="clay-card news-body bedtime-body">
            @foreach ($story['paragraphs'] as $p)
                <p lang="{{ $story['language'] }}">{{ $p }}</p>
            @endforeach
        </div>

        @if (!empty($story['moral']))
            <aside class="clay-card clay-card--mint bedtime-moral" aria-label="Pesan moral" style="margin-top: 1.5rem;">
                <h2 style="font-size: 1.125rem; font-weight: 700; margin-bottom: 0.5rem; color: var(--clay-mint-ink, inherit);">Pesan moral</h2>
                <p style="margin: 0; font-style: italic; line-height: 1.5;">&ldquo;{{ $story['moral'] }}&rdquo;</p>
            </aside>
        @endif

        @if ($prev || $next)
            <nav class="bedtime-nav" style="display: flex; justify-content: space-between; gap: 1rem; margin-top: 2rem; flex-wrap: wrap;">
                @if ($prev)
                    <a href="{{ $prev->url() }}" class="clay-btn clay-btn--secondary" style="flex: 1; min-width: 200px; text-align: left;">
                        &larr; {{ $prev->title }}
                    </a>
                @else
                    <div style="flex: 1;"></div>
                @endif
                @if ($next)
                    <a href="{{ $next->url() }}" class="clay-btn clay-btn--secondary" style="flex: 1; min-width: 200px; text-align: right;">
                        {{ $next->title }} &rarr;
                    </a>
                @endif
            </nav>
        @endif

        @if (!empty($others))
            <section class="bedtime-others" style="margin-top: 3rem;">
                <h2 class="clay-section__title" style="font-size: 1.35rem; margin-bottom: 1rem;">Cerita lainnya</h2>
                <div class="news-grid">
                    @include('clay._bedtime-cards', ['stories' => $others])
                </div>
            </section>
        @endif
    </article>
@endsection

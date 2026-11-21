@extends('layouts.clay')

@push('head')
    <meta property="article:published_time" content="{{ $publishedWita }}">
    <meta property="article:modified_time" content="{{ $modifiedWita }}">
    <meta property="article:section" content="{{ $topicName }}">
    <script type="application/ld+json">{!! json_encode($jsonLd, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_HEX_TAG | JSON_HEX_AMP) !!}</script>
    <script type="application/ld+json">{!! json_encode($breadcrumbLd, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_HEX_TAG | JSON_HEX_AMP) !!}</script>
    <link rel="preload" as="image" href="{{ \App\Services\NewsImage::src($article['id'], 800, $article['img']['v']) }}" imagesrcset="{{ \App\Services\NewsImage::src($article['id'], 480, $article['img']['v']) }} 480w, {{ \App\Services\NewsImage::src($article['id'], 800, $article['img']['v']) }} 800w, {{ \App\Services\NewsImage::src($article['id'], 1200, $article['img']['v']) }} 1200w" imagesizes="(min-width: 800px) 760px, 100vw" fetchpriority="high">
@endpush

@section('content')
    <article class="clay-section news-article" data-jd-article data-jd-view="view_article" data-jd-params="{{ json_encode(['article_id' => (int) $article['id'], 'topic' => (string) $article['topic']]) }}">
        <a href="/berita/{{ $article['topic'] }}" class="news-back" data-news-back data-fallback="/berita/{{ $article['topic'] }}"><span aria-hidden="true">&larr;</span> Kembali ke daftar berita</a>


        <p><span class="topic-badge topic-badge--static topic-badge--{{ $article['topic'] }}">{{ $topicName }}</span></p>
        <h1 class="clay-section__title">{{ $article['title'] }}</h1>
        <p class="news-meta news-meta-row"><time class="news-date" data-jd-time="wd" datetime="{{ $article['published_at'] }}"><svg class="news-date__icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M8 3v4M16 3v4M3 10h18"/></svg><span data-jd-t>{{ \Illuminate\Support\Carbon::parse($article['published_at'])->wita(true) }}</span></time></p>

        @php($im = $article['img'])
        <figure class="news-figure">
            <img class="news-hero" src="{{ \App\Services\NewsImage::src($article['id'], 800, $im['v']) }}"
                 srcset="{{ \App\Services\NewsImage::src($article['id'], 480, $im['v']) }} 480w, {{ \App\Services\NewsImage::src($article['id'], 800, $im['v']) }} 800w, {{ \App\Services\NewsImage::src($article['id'], 1200, $im['v']) }} 1200w"
                 sizes="(min-width: 800px) 760px, 100vw" width="1200" height="630" alt="{{ $im['alt'] }}" fetchpriority="high" decoding="async">
            @if ($im['photo'])
                <figcaption class="news-figure__credit">Foto: {{ $im['credit'] }} · {{ $im['license'] }} · <a href="{{ $im['source_url'] }}" rel="nofollow noopener noreferrer" target="_blank">Sumber foto</a></figcaption>
            @endif
        </figure>

        <p class="news-lead">{{ $article['summary'] }}</p>

        <div class="clay-card news-body">
            {!! \App\Support\NewsBody::render($article['paragraphs']) !!}
        </div>

        @php($shareUrl = urlencode('https://'.config('singlepage.base_domain').'/berita/'.$article['topic'].'/'.$article['slug']))
        <p class="news-share" aria-label="Bagikan">Bagikan:
            <a href="https://wa.me/?text={{ $shareUrl }}" target="_blank" rel="noopener noreferrer" data-jd-click="share" data-jd-params='{"method":"whatsapp","content_type":"article","item_id":"{{ (int) $article['id'] }}"}'>WhatsApp</a> ·
            <a href="https://twitter.com/intent/tweet?url={{ $shareUrl }}" target="_blank" rel="noopener noreferrer" data-jd-click="share" data-jd-params='{"method":"x","content_type":"article","item_id":"{{ (int) $article['id'] }}"}'>X</a> ·
            <a href="https://www.facebook.com/sharer/sharer.php?u={{ $shareUrl }}" target="_blank" rel="noopener noreferrer" data-jd-click="share" data-jd-params='{"method":"facebook","content_type":"article","item_id":"{{ (int) $article['id'] }}"}'>Facebook</a>
        </p>

        <section class="clay-card clay-card--mint news-sources" aria-labelledby="sumber-h">
            <h2 id="sumber-h">Sumber</h2>
            <ul>
                @foreach ($article['sources'] as $s)
                    <li><a href="{{ $s['url'] }}" rel="nofollow noopener noreferrer" target="_blank">{{ $s['title'] }}</a> <small>({{ $s['domain'] }})</small></li>
                @endforeach
            </ul>
        </section>

        <section class="clay-card clay-card--lavender news-comments" id="komentar"
            data-url="/berita/{{ $article['topic'] }}/{{ $article['slug'] }}/komentar"
            data-auth="{{ auth()->check() ? '1' : '0' }}"@can('access-admin-panel') data-mod-base="/admin/berita/komentar/"@endcan>
            <h2>Komentar</h2>
            <div class="news-comments__list" aria-live="polite"><p class="news-comments__hint">Komentar dimuat saat Anda menggulir ke sini…</p></div>
            @auth
                <form class="clay-form news-comments__form" hidden>
                    <label for="c-body">Tulis komentar</label>
                    <textarea class="clay-input" id="c-body" name="body" rows="3" maxlength="1000" required></textarea>
                    <button class="clay-btn clay-btn--primary" type="submit">Kirim</button>
                    <p class="news-comments__msg" role="status"></p>
                </form>
            @else
                <p><a href="/masuk">Masuk</a> atau <a href="/daftar">daftar</a> untuk berkomentar.</p>
            @endauth
        </section>
    </article>
    <script src="{{ \App\Support\AssetUrl::to('js/news-comments.js') }}" defer></script>
    <script src="{{ \App\Support\AssetUrl::to('js/news-nav.js') }}" defer></script>
@endsection

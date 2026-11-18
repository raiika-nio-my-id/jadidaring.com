@extends('layouts.clay')

@push('head')
    <meta property="article:published_time" content="{{ $article['published_at'] }}">
    <meta property="article:section" content="{{ $topicName }}">
    <script type="application/ld+json">{!! json_encode($jsonLd, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_HEX_TAG | JSON_HEX_AMP) !!}</script>
@endpush

@section('content')
    <article class="clay-section news-article">
        <nav class="pills-bar" aria-label="Topik Berita">
            <a href="/berita" class="clay-pill clay-pill--sky">Semua</a>
            <a href="/berita/{{ $article['topic'] }}" class="clay-pill clay-pill--sky is-active">{{ $topicName }}</a>
        </nav>

        <h1 class="clay-section__title">{{ $article['title'] }}</h1>
        <p class="news-meta"><time datetime="{{ $article['published_at'] }}">{{ \Illuminate\Support\Carbon::parse($article['published_at'])->locale('id')->translatedFormat('l, d F Y H:i') }}</time></p>

        @if ($article['image_url'])
            <img class="news-hero" src="{{ $article['image_url'] }}" alt="" referrerpolicy="no-referrer">
        @endif

        <p class="news-lead">{{ $article['summary'] }}</p>

        <div class="clay-card news-body">
            @foreach ($article['paragraphs'] as $p)
                <p>{!! nl2br(e($p)) !!}</p>
            @endforeach
        </div>

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
            data-auth="{{ auth()->check() ? '1' : '0' }}">
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
    <script src="/js/news-comments.js" defer></script>
@endsection

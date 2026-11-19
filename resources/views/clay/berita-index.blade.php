@extends('layouts.clay')

@section('content')
    <div class="clay-section">
        <div data-jd-slot="top">
        <div class="clay-section__header">
            <h1 class="clay-section__title">Berita Terkini</h1>
        </div>

        <form class="news-search" data-jd-form role="search" method="get" action="/berita"@if (filled($q ?? null)) data-jd-view="search" data-jd-params="{{ json_encode(['search_term' => mb_substr((string) $q, 0, 80), 'search_scope' => 'berita']) }}"@endif>
            <label class="sr-only" for="news-q">Cari berita</label>
            <input class="clay-input" id="news-q" type="search" name="q" value="{{ $q ?? '' }}" placeholder="Cari berita…" maxlength="80">
            <button class="clay-btn clay-btn--primary" type="submit">Cari</button>
        </form>
        </div>

        <div class="pills-bar" data-jd-chips aria-label="Topik Berita">
            <a href="/berita" class="clay-pill clay-pill--sky @if(empty($popular)) is-active @endif" @if(empty($popular)) aria-current="page" @endif>Semua</a>
            <a href="/berita?urut=populer" class="clay-pill clay-pill--peach @if(!empty($popular)) is-active @endif" @if(!empty($popular)) aria-current="page" @endif>Populer</a>
            @foreach($topics as $slug => $name)
                <a href="/berita/{{ $slug }}" class="clay-pill clay-pill--sky">{{ $name }}</a>
            @endforeach
        </div>

        <div data-jd-slot="list">
        @include('clay._articles', ['articles' => $articles, 'emptyText' => ! empty($q) ? 'Tidak ada berita yang cocok dengan pencarian Anda.' : 'Artikel berita dari topik politik, gaming, saham, indonesia, musibah, teknologi, dan tren sosial media sedang disiapkan.'])
        @if(empty($popular))
            @include('clay._pagination')
        @else
            <p class="clay-empty__text">Populer = paling banyak dibaca 7 hari terakhir (data Google Analytics).</p>
        @endif
        </div>
    </div>
@endsection

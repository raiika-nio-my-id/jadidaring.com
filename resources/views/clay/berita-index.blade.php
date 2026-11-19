@extends('layouts.clay')

@section('content')
    <div class="clay-section">
        <div class="clay-section__header">
            <h1 class="clay-section__title">Berita Terkini</h1>
        </div>

        <form class="news-search" role="search" method="get" action="/berita">
            <label class="sr-only" for="news-q">Cari berita</label>
            <input class="clay-input" id="news-q" type="search" name="q" value="{{ $q ?? '' }}" placeholder="Cari berita…" maxlength="80">
            <button class="clay-btn clay-btn--primary" type="submit">Cari</button>
        </form>

        <div class="pills-bar" aria-label="Topik Berita">
            <a href="/berita" class="clay-pill clay-pill--sky is-active" aria-current="page">Semua</a>
            @foreach($topics as $slug => $name)
                <a href="/berita/{{ $slug }}" class="clay-pill clay-pill--sky">{{ $name }}</a>
            @endforeach
        </div>

        @include('clay._articles', ['articles' => $articles, 'emptyText' => ! empty($q) ? 'Tidak ada berita yang cocok dengan pencarian Anda.' : 'Artikel berita dari topik politik, gaming, saham, indonesia, musibah, dan teknologi sedang disiapkan.'])
    </div>
@endsection

@extends('layouts.clay')

@section('content')
    <div class="clay-section">
        <div class="clay-section__header">
            <h1 class="clay-section__title">Berita Terkini</h1>
        </div>

        <div class="pills-bar" aria-label="Topik Berita">
            <a href="/berita" class="clay-pill clay-pill--sky is-active" aria-current="page">Semua</a>
            @foreach($topics as $slug => $name)
                <a href="/berita/{{ $slug }}" class="clay-pill clay-pill--sky">{{ $name }}</a>
            @endforeach
        </div>

        @include('clay._articles', ['articles' => $articles, 'emptyText' => 'Artikel berita dari topik politik, gaming, saham, indonesia, musibah, dan teknologi sedang disiapkan.'])
    </div>
@endsection

@extends('layouts.clay')

@section('content')
    <div class="clay-section">
        <div data-jd-slot="top">
        <div class="clay-section__header">
            <h1 class="clay-section__title">Berita Terkini</h1>
        </div>
        </div>

        @include('clay._berita-controls')

        <div data-jd-slot="list">
        @include('clay._articles', ['articles' => $articles, 'emptyText' => ! empty($q) ? 'Tidak ada berita yang cocok dengan pencarian Anda.' : 'Artikel berita dari topik politik, gaming, saham, indonesia, musibah, teknologi, dan tren sosial media sedang disiapkan.'])
        @include('clay._inf-more', ['inf' => $inf ?? null])
        </div>
    </div>
@endsection

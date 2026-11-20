@extends('layouts.clay')

@section('content')
    <div class="clay-section">
        <div data-jd-slot="top">
        <div class="clay-section__header">
            <h1 class="clay-section__title">Berita: {{ $topicName }}</h1>
        </div>
        </div>

        @include('clay._berita-controls')

        <div data-jd-slot="list">
        @include('clay._articles', ['articles' => $articles, 'emptyText' => ! empty($q) ? 'Tidak ada berita '.strtolower($topicName).' yang cocok dengan pencarian Anda.' : 'Belum ada artikel untuk topik '.strtolower($topicName).'. Pantau terus pembaruan dari redaksi kami!'])
        @include('clay._inf-more', ['inf' => $inf ?? null])
        </div>
    </div>
@endsection

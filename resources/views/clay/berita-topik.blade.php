@extends('layouts.clay')

@section('content')
    <div class="clay-section">
        <div class="clay-section__header">
            <h1 class="clay-section__title">Berita: {{ $topicName }}</h1>
        </div>

        <div class="pills-bar" aria-label="Topik Berita">
            <a href="/berita" class="clay-pill clay-pill--sky">Semua</a>
            @foreach($topics as $slug => $name)
                <a href="/berita/{{ $slug }}"
                   class="clay-pill clay-pill--sky @if($slug === $currentTopic) is-active @endif"
                   @if($slug === $currentTopic) aria-current="page" @endif>
                    {{ $name }}
                </a>
            @endforeach
        </div>

        @include('clay._articles', ['articles' => $articles, 'emptyText' => 'Belum ada artikel untuk topik '.strtolower($topicName).'. Pantau terus pembaruan dari redaksi kami!'])
        @include('clay._pagination')
    </div>
@endsection

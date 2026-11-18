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

        <div class="clay-card clay-card--sky clay-empty">
            <div class="clay-empty__icon" aria-hidden="true">&#128240;</div>
            <h2 class="clay-empty__title">Berita segera hadir</h2>
            <p class="clay-empty__text">Belum ada artikel untuk topik {{ strtolower($topicName) }}. Pantau terus pembaruan dari redaksi kami!</p>
        </div>
    </div>
@endsection

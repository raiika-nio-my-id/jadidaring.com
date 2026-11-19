@extends('layouts.clay')

@section('content')
    <div class="clay-section">
        @include('clay._game-head', ['sort' => $sort])

        <div data-jd-slot="list">
        @if($games->isEmpty())
            <div class="clay-card clay-card--peach clay-empty">
                <div class="clay-empty__icon" aria-hidden="true">&#127918;</div>
                <h2 class="clay-empty__title">Belum ada game tersedia</h2>
                <p class="clay-empty__text">Saat ini belum ada game yang dipublikasikan. Silakan cek kembali nanti.</p>
            </div>
        @else
            <div class="game-grid">
                @foreach($games as $game)
                    <a href="/game/{{ $game['subdomain'] }}" class="game-card" data-jd-click="select_content" data-jd-params='{"content_type":"game","item_id":"{{ $game['subdomain'] }}"}'>
                        <div class="game-card__media">
                            @if(!empty($game['image']))
                                <img src="{{ $game['image'] }}" alt="{{ $game['title'] }}" loading="lazy">
                            @else
                                <div class="game-card__avatar">
                                    {{ $game['avatar'] ?? '🎮' }}
                                </div>
                            @endif
                        </div>
                        <h2 class="game-card__title">{{ $game['title'] }}</h2>
                        <p class="game-card__desc">{{ $game['description'] ?: 'Game web santai dan seru untuk dimainkan bersama kawan.' }}</p>
                        <div class="game-card__footer">
                            <span class="game-card__badge">
                                @if($sort === 'new')
                                    Baru
                                @else
                                    Mainkan
                                @endif
                            </span>
                            <span class="game-card__play">Buka Game &rarr;</span>
                        </div>
                    </a>
                @endforeach
            </div>
        @endif
        </div>
    </div>
@endsection

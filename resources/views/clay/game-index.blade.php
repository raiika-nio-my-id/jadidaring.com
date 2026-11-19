@extends('layouts.clay')

@section('content')
    <div class="clay-section">
        <div class="clay-section__header">
            <div>
                <h1 class="clay-section__title">Katalog Game Daring</h1>
                <p style="color: var(--clay-ink-2); font-size: 15px; margin-top: 4px;">Mainkan aneka permainan peramban langsung tanpa instalasi.</p>
            </div>

            <div class="pills-bar" style="margin-bottom: 0;" aria-label="Urutkan Game">
                <a href="/game?sort=views"
                   class="clay-pill clay-pill--peach @if($sort === 'views') is-active @endif"
                   @if($sort === 'views') aria-current="page" @endif>
                   Populer
                </a>
                <a href="/game?sort=new"
                   class="clay-pill clay-pill--peach @if($sort === 'new') is-active @endif"
                   @if($sort === 'new') aria-current="page" @endif>
                   Terbaru
                </a>
                <a href="/game?sort=az"
                   class="clay-pill clay-pill--peach @if($sort === 'az') is-active @endif"
                   @if($sort === 'az') aria-current="page" @endif>
                   A–Z
                </a>
            </div>
        </div>

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
@endsection

@extends('layouts.clay')

@section('content')
    <section class="clay-card hero-card clay-card--lavender" aria-labelledby="hero-heading">
        <h1 class="hero-title" id="hero-heading">Main Seru, Berita Hangat, Kumpul Komunitas</h1>
        <p class="hero-subtitle">
            Jadidaring adalah ruang hiburan digital lokal untuk bermain game web ringan tanpa unduh, membaca berita pilihan terpercaya, dan bersilaturahmi.
        </p>
        <div class="hero-actions">
            <a href="/game" class="clay-btn clay-btn--peach">Main Game Sekarang</a>
            <a href="/berita" class="clay-btn clay-btn--sky">Baca Berita</a>
            <a href="/komunitas" class="clay-btn clay-btn--mint">Gabung Komunitas</a>
        </div>
    </section>

    {{-- Berita Terkini Section --}}
    <section class="clay-section" aria-labelledby="berita-heading">
        <div class="clay-section__header">
            <h2 class="clay-section__title" id="berita-heading">Berita Terkini</h2>
            <a href="/berita" class="clay-pill clay-pill--sky">Lihat Semua Topik &rarr;</a>
        </div>

        <div class="pills-bar" aria-label="Topik Berita">
            <a href="/berita/politik" class="clay-pill clay-pill--sky">Politik</a>
            <a href="/berita/gaming" class="clay-pill clay-pill--sky">Gaming</a>
            <a href="/berita/saham" class="clay-pill clay-pill--sky">Saham</a>
            <a href="/berita/indonesia" class="clay-pill clay-pill--sky">Indonesia</a>
            <a href="/berita/musibah" class="clay-pill clay-pill--sky">Musibah</a>
            <a href="/berita/teknologi" class="clay-pill clay-pill--sky">Teknologi</a>
        </div>

        @include('clay._articles', ['featured' => true, 'articles' => $articles, 'emptyText' => 'Redaksi Jadidaring sedang menyiapkan sajian berita harian terbaik untuk Anda.'])
        @if (! empty($articles))
            <div class="news-more"><a href="/berita" class="clay-btn clay-btn--primary">Lihat semua berita &rarr;</a></div>
        @endif
    </section>

    {{-- Game Pilihan Section --}}
    <section class="clay-section" aria-labelledby="game-heading">
        <div class="clay-section__header">
            <h2 class="clay-section__title" id="game-heading">Game Pilihan</h2>
            <a href="/game" class="clay-pill clay-pill--peach">Jelajahi Semua Game &rarr;</a>
        </div>

        @if($games->isEmpty())
            <div class="clay-card clay-card--peach clay-empty">
                <div class="clay-empty__icon" aria-hidden="true">&#127918;</div>
                <h3 class="clay-empty__title">Game pilihan segera hadir</h3>
                <p class="clay-empty__text">Nantikan koleksi permainan seru dari berbagai kreator tanah air.</p>
            </div>
        @else
            <div class="game-grid">
                @foreach($games as $game)
                    <a href="/game/{{ $game['subdomain'] }}" class="game-card">
                        <div class="game-card__media">
                            @if(!empty($game['image']))
                                <img src="{{ $game['image'] }}" alt="{{ $game['title'] }}" loading="lazy">
                            @else
                                <div class="game-card__avatar">
                                    {{ $game['avatar'] ?? '🎮' }}
                                </div>
                            @endif
                        </div>
                        <h3 class="game-card__title">{{ $game['title'] }}</h3>
                        <p class="game-card__desc">{{ $game['description'] ?: 'Game web santai dan seru untuk dimainkan bersama kawan.' }}</p>
                        <div class="game-card__footer">
                            <span class="game-card__badge">
                                @if(!empty($game['views']))
                                    {{ number_format($game['views']) }} main
                                @else
                                    Pilihan
                                @endif
                            </span>
                            <span class="game-card__play">Mainkan &rarr;</span>
                        </div>
                    </a>
                @endforeach
            </div>
        @endif
    </section>

    {{-- Komunitas Teaser Card --}}
    <section class="clay-section" aria-labelledby="komunitas-heading">
        <div class="clay-card clay-card--mint" style="display: flex; flex-direction: column; align-items: flex-start; gap: 16px;">
            <div style="font-size: 32px;" aria-hidden="true">&#129309;</div>
            <h2 class="clay-section__title" id="komunitas-heading" style="color: var(--clay-mint-ink);">Komunitas Jadidaring</h2>
            <p style="color: var(--clay-mint-ink); font-size: 16px; max-width: 600px;">
                Tempat berkumpul pemain game, pembaca berita, dan kreator konten. Bertukar strategi, ngobrol santai, atau berdiskusi tren terkini di Indonesia. Komunitas segera hadir!
            </p>
            <a href="/komunitas" class="clay-btn clay-btn--mint" style="margin-top: 8px;">Pelajari Komunitas &rarr;</a>
        </div>
    </section>
@endsection

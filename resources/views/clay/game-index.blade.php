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
            <div class="game-grid" data-jd-inf-list>
                @include('clay._game-cards', ['games' => $games, 'sort' => $sort])
            </div>
        @endif
        @include('clay._inf-more', ['inf' => $inf ?? null])
        </div>
    </div>
@endsection

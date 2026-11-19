@extends('layouts.clay')

@section('content')
    <div class="clay-section ch-page">
        @include('clay._komunitas-feed-head')
        @include('clay._komunitas-tabs')
        <div data-jd-slot="list">
        @if (session('status'))<p class="news-comments__msg" role="status">{{ session('status') }}</p>@endif
        @if (isset($errors) && $errors->has('body'))<p class="news-comments__msg" role="alert">{{ $errors->first('body') }}</p>@endif

        @auth
            <a class="ch-cta" href="/u/{{ auth()->user()->username }}#curhatan"><span aria-hidden="true">✏️</span> Lagi mikirin apa? Tulis di profilmu</a>
        @endauth

        @if ($tab === 'mengikuti' && ! auth()->check())
            <div class="clay-card clay-card--peach clay-empty"><p class="clay-empty__text"><a href="/masuk">Masuk</a> untuk melihat curhatan dari orang yang kamu ikuti. Belum punya akun? <a href="/daftar">Daftar gratis</a>.</p></div>
        @elseif ($posts->isEmpty())
            <div class="clay-card clay-card--peach clay-empty"><p class="clay-empty__text">
                @if ($tab === 'mengikuti')
                    Belum ada curhatan dari orang yang kamu ikuti. <a href="/komunitas?tab=profil">Jelajahi profil</a> lalu tekan Ikuti.
                @else
                    Belum ada curhatan publik. @auth<a href="/u/{{ auth()->user()->username }}#curhatan">Tulis yang pertama!</a>@else<a href="/daftar">Daftar</a> dan tulis yang pertama!@endauth
                @endif
            </p></div>
        @else
            <div class="ch-list ch-list--feed" data-ch-list>
                @include('clay._curhat-list')
            </div>
        @endif
        </div>
    </div>
    <script src="{{ \App\Support\AssetUrl::to('js/curhatan.js') }}" defer></script>
@endsection

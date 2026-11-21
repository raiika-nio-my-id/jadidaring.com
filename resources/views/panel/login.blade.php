@extends('layouts.clay')

@push('head')
    <link rel="stylesheet" href="{{ \App\Support\AssetUrl::to('css/jd-admin.css') }}">
    <script src="{{ \App\Support\AssetUrl::to('js/jd-admin.js') }}" defer></script>
@endpush

@section('content')
    <div class="adm-login">
        <div class="clay-card clay-card--lavender">
            <h1 class="clay-section__title">Masuk Admin</h1>
            <p>Pakai email dan kata sandi akun admin.</p>
            @auth
                <p class="adm-note adm-note--warn">Kamu sedang masuk sebagai {{ auth()->user()->username ? '@'.auth()->user()->username : auth()->user()->email }}, yang bukan admin. Masuk di sini akan mengganti sesi itu.</p>
            @endauth
            @if (session('status'))<p class="clay-status" role="status">{{ session('status') }}</p>@endif
            @if ($errors->any())
                <ul class="clay-errors" role="alert">@foreach ($errors->all() as $e)<li>{{ $e }}</li>@endforeach</ul>
            @endif
            <form method="POST" action="{{ route('panel.login.post') }}" class="clay-form">
                @csrf
                <label for="email">Email admin</label>
                <input class="clay-input" id="email" type="email" name="email" value="{{ old('email') }}" autocomplete="username" required autofocus>
                <label for="password">Kata sandi</label>
                <input class="clay-input" id="password" type="password" name="password" autocomplete="current-password" required>
                <label class="clay-check"><input type="checkbox" name="remember" value="1"> Ingat aku</label>
                <button class="clay-btn clay-btn--primary" type="submit">Masuk</button>
            </form>
        </div>
    </div>
@endsection

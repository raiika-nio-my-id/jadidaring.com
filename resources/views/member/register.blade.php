@extends('layouts.clay')

@section('content')
    <div class="clay-auth">
        <div class="clay-card clay-card--mint">
            <h1 class="clay-section__title">Buat akun</h1>
            @include('member._form_open')
            <form method="POST" action="{{ route('member.register') }}" class="clay-form">
                @csrf
                <label for="username">Nama pengguna</label>
                <input class="clay-input" id="username" name="username" value="{{ old('username') }}" required autofocus minlength="3" maxlength="20" pattern="[a-z0-9_]+" autocomplete="username">
                <label for="password">Kata sandi (min. 8 karakter)</label>
                <input class="clay-input" id="password" type="password" name="password" required minlength="8" autocomplete="new-password">
                <label for="password_confirmation">Ulangi kata sandi</label>
                <input class="clay-input" id="password_confirmation" type="password" name="password_confirmation" required autocomplete="new-password">
                <label for="email">Email (opsional, untuk reset kata sandi)</label>
                <input class="clay-input" id="email" type="email" name="email" value="{{ old('email') }}" autocomplete="email">
                <div class="clay-hp" aria-hidden="true"><label>Website <input name="website" tabindex="-1" autocomplete="off"></label></div>
                <button class="clay-btn clay-btn--primary" type="submit">Daftar</button>
            </form>
            <p class="clay-auth__links">Sudah punya akun? <a href="{{ route('member.login') }}">Masuk</a></p>
            @include('member._social')
        </div>
    </div>
@endsection

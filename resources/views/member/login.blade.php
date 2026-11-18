@extends('layouts.clay')

@section('content')
    <div class="clay-auth">
        <div class="clay-card clay-card--lavender">
            <h1 class="clay-section__title">Masuk</h1>
            @include('member._form_open')
            <form method="POST" action="{{ route('member.login') }}" class="clay-form">
                @csrf
                <label for="login">Nama pengguna atau email</label>
                <input class="clay-input" id="login" name="login" value="{{ old('login') }}" required autofocus autocomplete="username">
                <label for="password">Kata sandi</label>
                <input class="clay-input" id="password" type="password" name="password" required autocomplete="current-password">
                <label class="clay-check"><input type="checkbox" name="remember" value="1"> Ingat saya</label>
                <button class="clay-btn clay-btn--primary" type="submit">Masuk</button>
            </form>
            <p class="clay-auth__links"><a href="{{ route('member.password.request') }}">Lupa kata sandi?</a> · <a href="{{ route('member.register') }}">Buat akun</a></p>
            @include('member._social')
        </div>
    </div>
@endsection

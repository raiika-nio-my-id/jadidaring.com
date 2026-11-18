@extends('layouts.clay')

@section('content')
    <div class="clay-auth">
        <div class="clay-card clay-card--sky">
            <h1 class="clay-section__title">Lupa kata sandi</h1>
            <p>Masukkan email yang terdaftar di akunmu. Akun tanpa email tidak bisa direset.</p>
            @include('member._form_open')
            <form method="POST" action="{{ route('member.password.email') }}" class="clay-form">
                @csrf
                <label for="email">Email</label>
                <input class="clay-input" id="email" type="email" name="email" value="{{ old('email') }}" required autofocus autocomplete="email">
                <button class="clay-btn clay-btn--primary" type="submit">Kirim tautan reset</button>
            </form>
            <p class="clay-auth__links"><a href="{{ route('member.login') }}">Kembali masuk</a></p>
        </div>
    </div>
@endsection

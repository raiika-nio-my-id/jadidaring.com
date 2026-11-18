@extends('layouts.clay')

@section('content')
    <div class="clay-auth">
        <div class="clay-card clay-card--peach">
            <h1 class="clay-section__title">Kata sandi baru</h1>
            @include('member._form_open')
            <form method="POST" action="{{ route('member.password.update') }}" class="clay-form">
                @csrf
                <input type="hidden" name="token" value="{{ $token }}">
                <label for="email">Email</label>
                <input class="clay-input" id="email" type="email" name="email" value="{{ old('email', $email) }}" required autocomplete="email">
                <label for="password">Kata sandi baru</label>
                <input class="clay-input" id="password" type="password" name="password" required minlength="8" autocomplete="new-password">
                <label for="password_confirmation">Ulangi kata sandi</label>
                <input class="clay-input" id="password_confirmation" type="password" name="password_confirmation" required autocomplete="new-password">
                <button class="clay-btn clay-btn--primary" type="submit">Simpan</button>
            </form>
        </div>
    </div>
@endsection

@extends('layouts.clay')

@section('content')
    <div class="clay-auth">
        <div class="clay-card clay-card--lavender">
            <h1 class="clay-section__title">Akunku</h1>
            <p>Masuk sebagai <strong>{{ $user->username }}</strong>.</p>
            @include('member._form_open')
            <form method="POST" action="{{ route('member.account.email') }}" class="clay-form">
                @csrf
                <label for="email">Email (untuk reset kata sandi)</label>
                <input class="clay-input" id="email" type="email" name="email" value="{{ old('email', $user->email) }}" autocomplete="email">
                <button class="clay-btn clay-btn--mint" type="submit">Simpan email</button>
            </form>
            <form method="POST" action="{{ route('member.logout') }}" class="clay-form">
                @csrf
                <button class="clay-btn clay-btn--peach" type="submit">Keluar</button>
            </form>
        </div>
    </div>
@endsection

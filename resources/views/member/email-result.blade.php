@extends('layouts.clay')

@section('content')
    <div class="clay-auth">
        <div class="clay-card clay-card--lavender">
            <h1 class="clay-section__title">{{ $ok ? 'Berhasil' : 'Gagal' }}</h1>
            <p>{{ $message }}</p>
            <div class="clay-actions"><a class="clay-btn clay-btn--primary" href="/akun">Ke akunku</a></div>
        </div>
    </div>
@endsection

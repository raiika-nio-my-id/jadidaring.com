@extends('layouts.clay')
@section('content')
<div class="clay-section">
    <div class="clay-card page-doc">
        <h1 class="clay-section__title">Kontak</h1>
        <p>Kirim pertanyaan, koreksi berita, atau laporan masalah lewat formulir ini. Pesan dibaca oleh pengelola situs.</p>
        <p>Anda juga bisa menulis ke <a href="mailto:admin@jadidaring.com">admin@jadidaring.com</a>.</p>
        @if (session('sent'))
            <p class="clay-card clay-card--mint" role="status">Terima kasih, pesan Anda sudah terkirim.</p>
        @endif
        <form method="post" action="/kontak" class="clay-form" novalidate>
            @csrf
            <input type="hidden" name="t" value="{{ $started }}">
            <div class="hp-field" aria-hidden="true"><label for="website">Situs web (jangan diisi)</label><input id="website" name="website" tabindex="-1" autocomplete="off"></div>
            <label for="c-name">Nama</label>
            <input class="clay-input" id="c-name" name="name" value="{{ old('name') }}" maxlength="100" required>
            @error('name')<p class="field-error">{{ $message }}</p>@enderror
            <label for="c-email">Email (opsional, hanya jika Anda ingin dibalas)</label>
            <input class="clay-input" id="c-email" type="email" name="email" value="{{ old('email') }}" maxlength="150">
            @error('email')<p class="field-error">{{ $message }}</p>@enderror
            <label for="c-subject">Subjek</label>
            <input class="clay-input" id="c-subject" name="subject" value="{{ old('subject') }}" maxlength="150" required>
            @error('subject')<p class="field-error">{{ $message }}</p>@enderror
            <label for="c-message">Pesan</label>
            <textarea class="clay-input" id="c-message" name="message" rows="6" maxlength="3000" required>{{ old('message') }}</textarea>
            @error('message')<p class="field-error">{{ $message }}</p>@enderror
            <div class="clay-actions"><button class="clay-btn clay-btn--primary" type="submit">Kirim pesan</button></div>
        </form>
    </div>
</div>
@endsection

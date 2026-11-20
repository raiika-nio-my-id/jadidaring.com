@php
    $metaTitle = trim(($panelTitle ?? 'Ringkasan').' · Admin Jadidaring');
    $noindex = true;
    $tabs = [
        ['panel.home', 'Ringkasan', '📊', ['panel.home']],
        ['panel.stats', 'Statistik', '📈', ['panel.stats']],
        ['panel.news', 'Berita', '📰', ['panel.news*']],
        ['panel.community', 'Komunitas', '👥', ['panel.community*']],
        ['panel.users', 'User', '🙋', ['panel.users*']],
        ['panel.games', 'Game', '🎮', ['panel.games*']],
        ['panel.pages', 'Custom Page', '🧩', ['panel.pages*']],
        ['panel.messages', 'Pesan', '✉️', ['panel.messages*']],
        ['panel.log', 'Log', '🧾', ['panel.log']],
        ['panel.backups', 'Backup', '💾', ['panel.backups*']],
    ];
    $unread = \App\Models\ContactMessage::query()->whereNull('read_at')->count();
@endphp
@extends('layouts.clay')

@section('bodyclass', 'is-admin')

@push('head')
    <link rel="stylesheet" href="{{ \App\Support\AssetUrl::to('css/jd-admin.css') }}">
    <script src="{{ \App\Support\AssetUrl::to('js/jd-admin.js') }}" defer></script>
@endpush

@section('content')
<div class="adm">
    <div class="adm-top">
        <h1 class="adm-title">Panel Admin</h1>
        <div class="adm-who">
            <span class="adm-badge adm-badge--info">{{ auth()->user()->email }}</span>
            <form method="POST" action="{{ route('panel.logout') }}">
                @csrf
                <button class="adm-btn adm-btn--ghost" type="submit">Keluar</button>
            </form>
        </div>
    </div>
    <nav class="adm-tabs" aria-label="Bagian admin">
        @foreach ($tabs as [$route, $label, $icon, $match])
            <a class="adm-tab" href="{{ route($route) }}" @if(request()->routeIs(...$match)) aria-current="page" @endif><span aria-hidden="true">{{ $icon }}</span>{{ $label }}@if($route === 'panel.messages' && $unread > 0)<span class="adm-tab__n" aria-label="{{ $unread }} belum dibaca">{{ $unread }}</span>@endif</a>
        @endforeach
    </nav>
    <div class="adm-body" data-adm-body>
        <div class="adm-skel" aria-hidden="true">
            <div class="adm-card"><div class="adm-sk" style="width:40%;height:22px"></div>@for ($i = 0; $i < 6; $i++)<div class="adm-sk-row"><div class="adm-sk" style="width:{{ [70, 55, 80, 60, 75, 50][$i] }}%"></div><div class="adm-sk" style="width:35%;height:10px"></div></div>@endfor</div>
        </div>
        @if ($errors->any())
            <ul class="adm-errors" role="alert">@foreach ($errors->all() as $e)<li>{{ $e }}</li>@endforeach</ul>
        @endif
        @yield('panel')
    </div>
</div>
<div class="adm-toast" data-adm-toast role="status" aria-live="polite" @if(session('toast_error')) data-error @endif>{{ session('toast_error') ?? session('toast') }}</div>
<dialog class="adm-dialog" data-adm-dialog aria-labelledby="adm-dlg-title">
    <form method="dialog">
        <h2 id="adm-dlg-title" data-adm-dlg-title>Yakin?</h2>
        <p data-adm-dlg-msg></p>
        <div data-adm-dlg-typewrap hidden>
            <label for="adm-dlg-type">Ketik <strong data-adm-dlg-need></strong> untuk konfirmasi</label>
            <input class="clay-input" id="adm-dlg-type" data-adm-dlg-type autocomplete="off" autocapitalize="off" spellcheck="false">
        </div>
        <div class="adm-dialog__actions">
            <button class="adm-btn" type="button" data-adm-dlg-cancel>Batal</button>
            <button class="adm-btn adm-btn--danger" type="submit" data-adm-dlg-ok>Ya, lanjutkan</button>
        </div>
    </form>
</dialog>
@endsection

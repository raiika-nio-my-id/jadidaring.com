@extends('panel.layout')
@php $panelTitle = 'Custom Page'; @endphp

@section('panel')
    <section class="adm-card">
        <div class="adm-top">
            <h2 style="margin:0">Custom Page</h2>
            <a class="adm-btn adm-btn--primary" href="{{ route('panel.pages.create') }}">＋ Buat Custom Page</a>
        </div>
        <p class="adm-muted" style="margin:8px 0 0">Halaman HTML mandiri di <strong>jadidaring.com/alamat</strong>. Tidak muncul di GameHub. Yang dipin tampil paling atas; atur urutan dengan ↑ ↓.</p>
        <form class="adm-search" method="GET" action="{{ route('panel.pages') }}" role="search" style="margin-top:12px">
            <input class="clay-input" type="search" name="q" value="{{ $q }}" placeholder="Cari nama atau alamat…" aria-label="Cari Custom Page">
            <button class="adm-btn adm-btn--primary" type="submit">Cari</button>
        </form>
        <ul class="adm-list" style="margin-top:8px">
            @forelse ($pages as $p)
                <li class="adm-row">
                    <div class="adm-row__main">
                        <a class="adm-row__title" href="{{ route('panel.pages.edit', $p->id) }}">@if($p->is_pinned)📌 @endif{{ $p->name ?: $p->subdomain }}</a>
                        <span class="adm-row__meta">
                            @if (! $p->isPublished())<span class="adm-badge adm-badge--warn">Nonaktif</span>@elseif($p->isExpired())<span class="adm-badge adm-badge--bad">Kedaluwarsa</span>@else<span class="adm-badge adm-badge--ok">Aktif</span>@endif
                            <span>/{{ $p->subdomain }}</span>
                            @if ($p->aliases_count)<span>🔗 {{ $p->aliases_count }} alias</span>@endif
                            @if ($p->expires_at)<span>⏳ s.d. {{ \Illuminate\Support\Carbon::parse($p->expires_at)->translatedFormat('j M Y') }}</span>@endif
                        </span>
                    </div>
                    <div class="adm-row__tools">
                        <a class="adm-btn" href="/{{ $p->subdomain }}" target="_blank" rel="noopener" data-no-skel>Buka ↗</a>
                        <a class="adm-btn adm-btn--sky" href="{{ route('panel.pages.edit', $p->id) }}">Edit</a>
                        <form method="POST" action="{{ route('panel.pages.pin', $p->id) }}">@csrf<button class="adm-btn {{ $p->is_pinned ? 'adm-btn--peach' : '' }}" type="submit" aria-label="{{ $p->is_pinned ? 'Lepas pin' : 'Pin' }} {{ $p->subdomain }}">{{ $p->is_pinned ? 'Lepas pin' : '📌 Pin' }}</button></form>
                        <span class="adm-inline"><form method="POST" action="{{ route('panel.pages.move', $p->id) }}">@csrf<input type="hidden" name="dir" value="up"><button class="adm-btn" type="submit" aria-label="Naikkan {{ $p->subdomain }}" @disabled($loop->first)>↑</button></form>
                        <form method="POST" action="{{ route('panel.pages.move', $p->id) }}">@csrf<input type="hidden" name="dir" value="down"><button class="adm-btn" type="submit" aria-label="Turunkan {{ $p->subdomain }}" @disabled($loop->last)>↓</button></form></span>
                    </div>
                </li>
            @empty
                <li class="adm-empty">Belum ada Custom Page{{ $q !== '' ? ' yang cocok' : '' }}.</li>
            @endforelse
        </ul>
    </section>
@endsection

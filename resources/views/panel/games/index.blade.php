@extends('panel.layout')
@php $panelTitle = 'Game'; @endphp

@section('panel')
    <section class="adm-card">
        <form class="adm-search" method="GET" action="{{ route('panel.games') }}" role="search">
            <input class="clay-input" type="search" name="q" value="{{ $q }}" placeholder="Cari slug game…" aria-label="Cari game">
            <select class="clay-input" name="f" aria-label="Filter" data-autosubmit>
                <option value="">Semua ({{ $games->count() }})</option>
                <option value="tampil" @selected($f === 'tampil')>Tampil di daftar</option>
                <option value="tersembunyi" @selected($f === 'tersembunyi')>Disembunyikan</option>
            </select>
            <button class="adm-btn adm-btn--primary" type="submit">Cari</button>
        </form>
        <p class="adm-muted" style="margin:10px 0 0">“Sembunyikan” hanya menghapus game dari daftar /game dan beranda. Halaman gamenya tetap bisa dibuka lewat link. Kode game ada di git (resources/games), jadi tidak diubah dari sini.</p>
        <ul class="adm-list" style="margin-top:8px">
            @forelse ($games as $g)
                <li class="adm-row">
                    <div class="adm-row__main">
                        <a class="adm-row__title" href="{{ route('panel.games.show', $g->id) }}">{{ $g->subdomain }}</a>
                        <span class="adm-row__meta">
                            @if ($g->hidden_from_listing)<span class="adm-badge adm-badge--warn">Disembunyikan</span>@elseif(! $g->isLive())<span class="adm-badge adm-badge--bad">Tidak live</span>@else<span class="adm-badge adm-badge--ok">Tampil</span>@endif
                            <span>🏆 {{ number_format($g->scores_count, 0, ',', '.') }} skor</span>
                            <span>🚪 {{ number_format($g->rooms_count, 0, ',', '.') }} room</span>
                            @isset($views[$g->subdomain])<span>👁 {{ number_format($views[$g->subdomain], 0, ',', '.') }} views GA</span>@endisset
                        </span>
                    </div>
                    <div class="adm-row__tools">
                        <a class="adm-btn" href="/game/{{ $g->subdomain }}" target="_blank" rel="noopener" data-no-skel>Buka ↗</a>
                        <a class="adm-btn adm-btn--sky" href="{{ route('panel.games.show', $g->id) }}">Kelola data</a>
                        <form method="POST" action="{{ route('panel.games.listing', $g->id) }}" @unless($g->hidden_from_listing) data-confirm="Sembunyikan {{ $g->subdomain }} dari daftar game?" data-confirm-ok="Sembunyikan" data-confirm-safe @endunless>
                            @csrf
                            <button class="adm-btn {{ $g->hidden_from_listing ? 'adm-btn--mint' : 'adm-btn--peach' }}" type="submit">{{ $g->hidden_from_listing ? 'Tampilkan' : 'Sembunyikan' }}</button>
                        </form>
                    </div>
                </li>
            @empty
                <li class="adm-empty">Tidak ada game yang cocok.</li>
            @endforelse
        </ul>
    </section>
@endsection

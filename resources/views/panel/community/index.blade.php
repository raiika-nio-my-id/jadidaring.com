@extends('panel.layout')
@php $panelTitle = 'Komunitas'; @endphp

@section('panel')
    @include('panel.community._sub')
    <section class="adm-card">
        <form class="adm-search" method="GET" action="{{ route('panel.community') }}" role="search">
            <input class="clay-input" type="search" name="q" value="{{ $q }}" placeholder="Cari username, nama, atau judul…" aria-label="Cari profil">
            <select class="clay-input" name="status" aria-label="Status" data-autosubmit>
                <option value="">Semua</option>
                <option value="published" @selected($status === 'published')>Publik</option>
                <option value="hidden" @selected($status === 'hidden')>Disembunyikan</option>
                <option value="dilaporkan" @selected($status === 'dilaporkan')>Dilaporkan</option>
            </select>
            <button class="adm-btn adm-btn--primary" type="submit">Cari</button>
        </form>
        <ul class="adm-list" style="margin-top:8px">
            @forelse ($pages as $p)
                <li class="adm-row">
                    <div class="adm-row__main">
                        <a class="adm-row__title" href="{{ route('panel.community.show', $p->id) }}">{{ $p->title ?: 'Tanpa judul' }} <span class="adm-muted">{{ '@'.($p->user?->username) }}</span></a>
                        <span class="adm-row__meta">@include('panel._status', ['s' => $p->status]) <span>👁 {{ number_format($p->views, 0, ',', '.') }} pengunjung</span> @if($p->reports_count)<span class="adm-badge adm-badge--warn">⚑ {{ $p->reports_count }} laporan</span>@endif @if($p->user?->banned_at)<span class="adm-badge adm-badge--bad">User diblokir</span>@endif <span>diubah {{ $p->updated_at?->wita() }}</span></span>
                    </div>
                    <div class="adm-row__tools">
                        @if ($p->user)<a class="adm-btn" href="/u/{{ $p->user->username }}" target="_blank" rel="noopener" data-no-skel>Buka</a>@endif
                        @include('panel.community._page-tools')
                    </div>
                </li>
            @empty
                <li class="adm-empty">Tidak ada profil yang cocok.</li>
            @endforelse
        </ul>
        @include('panel._pager', ['p' => $pages])
    </section>
@endsection

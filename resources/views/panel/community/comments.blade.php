@extends('panel.layout')
@php $panelTitle = 'Komentar profil'; @endphp

@section('panel')
    @include('panel.community._sub')
    <section class="adm-card">
        <form class="adm-search" method="GET" action="{{ route('panel.community.comments') }}" role="search">
            <input class="clay-input" type="search" name="q" value="{{ $q }}" placeholder="Cari isi komentar…" aria-label="Cari komentar">
            <select class="clay-input" name="f" aria-label="Filter" data-autosubmit>
                <option value="semua" @selected($f === 'semua')>Semua</option>
                <option value="dilaporkan" @selected($f === 'dilaporkan')>Dilaporkan</option>
                <option value="disembunyikan" @selected($f === 'disembunyikan')>Disembunyikan</option>
            </select>
            <button class="adm-btn adm-btn--primary" type="submit">Cari</button>
        </form>
        <ul class="adm-list" style="margin-top:8px">
            @forelse ($comments as $c)
                @include('panel.community._comment-row', ['c' => $c, 'showOwner' => true])
            @empty
                <li class="adm-empty">Tidak ada komentar.</li>
            @endforelse
        </ul>
        @include('panel._pager', ['p' => $comments])
    </section>
@endsection

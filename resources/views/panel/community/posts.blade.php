@extends('panel.layout')
@php $panelTitle = 'Curhatan'; @endphp

@section('panel')
    @include('panel.community._sub')
    <section class="adm-card">
        <div class="adm-sub" style="margin-bottom:10px">
            @foreach (['terbaru' => 'Terbaru', 'dilaporkan' => 'Dilaporkan', 'disembunyikan' => 'Disembunyikan'] as $k => $label)
                <a class="adm-chip" href="{{ route('panel.community.posts', ['f' => $k]) }}" @if($f === $k) aria-current="page" @endif>{{ $label }}</a>
            @endforeach
        </div>
        <form class="adm-search" method="GET" action="{{ route('panel.community.posts') }}" role="search">
            <input type="hidden" name="f" value="{{ $f }}">
            <input class="clay-input" type="search" name="q" value="{{ $q }}" placeholder="Cari isi curhatan…" aria-label="Cari curhatan">
            <button class="adm-btn adm-btn--primary" type="submit">Cari</button>
        </form>
        <ul class="adm-list" style="margin-top:8px">
            @forelse ($posts as $post)
                @include('panel.community._post-row', ['post' => $post])
            @empty
                <li class="adm-empty">Tidak ada curhatan di filter ini.</li>
            @endforelse
        </ul>
        @include('panel._pager', ['p' => $posts])
    </section>

    <section class="adm-card">
        <h2>Komentar curhatan yang dilaporkan / disembunyikan</h2>
        <ul class="adm-list">
            @forelse ($postComments as $c)
                <li class="adm-row">
                    <div class="adm-row__main">
                        <span class="adm-row__meta"><strong>{{ $c->user ? '@'.$c->user->username : 'akun dihapus' }}</strong> · {{ $c->created_at?->wita() }} @if($c->is_hidden)<span class="adm-badge adm-badge--bad">Disembunyikan</span>@endif @if($c->reports_count)<span class="adm-badge adm-badge--warn">⚑ {{ $c->reports_count }}</span>@endif</span>
                        <p class="adm-row__body">{{ $c->body }}</p>
                    </div>
                    <div class="adm-row__tools">
                        <form method="POST" action="{{ route('panel.community.postcomments.toggle', $c->id) }}">@csrf<button class="adm-btn {{ $c->is_hidden ? 'adm-btn--mint' : 'adm-btn--peach' }}" type="submit">{{ $c->is_hidden ? 'Tampilkan' : 'Sembunyikan' }}</button></form>
                    </div>
                </li>
            @empty
                <li class="adm-empty">Tidak ada.</li>
            @endforelse
        </ul>
    </section>
@endsection

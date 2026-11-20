@extends('panel.layout')
@php $panelTitle = 'Komentar berita'; @endphp

@section('panel')
    @include('panel.news._sub')
    <section class="adm-card">
        <form class="adm-search" method="GET" action="{{ route('panel.news.comments') }}" role="search">
            <input class="clay-input" type="search" name="q" value="{{ $q }}" placeholder="Cari isi komentar…" aria-label="Cari komentar">
            <select class="clay-input" name="f" aria-label="Filter" data-autosubmit>
                <option value="semua" @selected($f === 'semua')>Semua</option>
                <option value="disembunyikan" @selected($f === 'disembunyikan')>Disembunyikan</option>
            </select>
            <button class="adm-btn adm-btn--primary" type="submit">Cari</button>
        </form>
        <ul class="adm-list" style="margin-top:8px">
            @forelse ($comments as $c)
                <li class="adm-row">
                    <div class="adm-row__main">
                        <span class="adm-row__meta"><strong>{{ $c->user ? '@'.$c->user->username : 'akun dihapus' }}</strong> · {{ $c->created_at?->wita() }} @if($c->is_hidden)<span class="adm-badge adm-badge--bad">Disembunyikan</span>@endif</span>
                        <p class="adm-row__body">{{ $c->body }}</p>
                        @if ($c->article)<a class="adm-muted" href="{{ $c->article->url() }}" target="_blank" rel="noopener" data-no-skel>di: {{ \Illuminate\Support\Str::limit($c->article->title, 80) }}</a>@endif
                    </div>
                    <div class="adm-row__tools">
                        <form method="POST" action="{{ route('panel.news.comments.toggle', $c->id) }}">@csrf<button class="adm-btn {{ $c->is_hidden ? 'adm-btn--mint' : 'adm-btn--peach' }}" type="submit">{{ $c->is_hidden ? 'Tampilkan' : 'Sembunyikan' }}</button></form>
                        <form method="POST" action="{{ route('panel.news.comments.destroy', $c->id) }}" data-confirm="Hapus komentar ini permanen? (backup tetap disimpan)" data-confirm-ok="Hapus">@csrf @method('DELETE')<button class="adm-btn adm-btn--danger" type="submit">Hapus</button></form>
                    </div>
                </li>
            @empty
                <li class="adm-empty">Tidak ada komentar.</li>
            @endforelse
        </ul>
        @include('panel._pager', ['p' => $comments])
    </section>
@endsection

@extends('panel.layout')
@php $panelTitle = 'Profil @'.($page->user?->username); $p = $page; @endphp

@section('panel')
    @include('panel.community._sub')
    <section class="adm-card">
        <div class="adm-top">
            <h2 style="margin:0">{{ $page->title ?: 'Tanpa judul' }}</h2>
            <div class="adm-row__tools">
                @if ($page->user)<a class="adm-btn" href="/u/{{ $page->user->username }}" target="_blank" rel="noopener" data-no-skel>Buka profil ↗</a><a class="adm-btn adm-btn--sky" href="{{ route('panel.users.show', $page->user_id) }}">Lihat user</a>@endif
                @include('panel.community._page-tools')
            </div>
        </div>
        <dl class="adm-kv">
            <dt>Pemilik</dt><dd>{{ $page->user ? '@'.$page->user->username.' ('.$page->user->name.')' : '—' }}</dd>
            <dt>Status</dt><dd>@include('panel._status', ['s' => $page->status])</dd>
            <dt>Pengunjung</dt><dd>{{ number_format($page->views, 0, ',', '.') }} (unik tercatat: {{ number_format($visitors, 0, ',', '.') }})</dd>
            <dt>Laporan</dt><dd>{{ $page->reports_count }}</dd>
            <dt>Dibuat</dt><dd>{{ $page->created_at?->wita() }}</dd>
            <dt>Diubah</dt><dd>{{ $page->updated_at?->wita() }}</dd>
        </dl>
    </section>

    <section class="adm-card">
        <h2>Dinding komentar ({{ $comments->count() }} terbaru)</h2>
        <ul class="adm-list">
            @forelse ($comments as $c)
                @include('panel.community._comment-row', ['c' => $c])
            @empty
                <li class="adm-empty">Belum ada komentar.</li>
            @endforelse
        </ul>
    </section>

    <section class="adm-card">
        <h2>Curhatan ({{ $posts->count() }} terbaru)</h2>
        <ul class="adm-list">
            @forelse ($posts as $post)
                @include('panel.community._post-row', ['post' => $post])
            @empty
                <li class="adm-empty">Belum ada curhatan.</li>
            @endforelse
        </ul>
    </section>
@endsection

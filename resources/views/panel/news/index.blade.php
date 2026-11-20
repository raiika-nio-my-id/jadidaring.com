@extends('panel.layout')
@php $panelTitle = 'Berita'; @endphp

@section('panel')
    @include('panel.news._sub')
    <section class="adm-card">
        <div class="adm-top" style="margin-bottom:12px">
            <h2 style="margin:0">Artikel</h2>
            <a class="adm-btn adm-btn--primary" href="{{ route('panel.news.create') }}">✍️ Tulis berita</a>
        </div>
        <form class="adm-search" method="GET" action="{{ route('panel.news') }}" role="search">
            <input class="clay-input" type="search" name="q" value="{{ $q }}" placeholder="Cari judul atau slug…" aria-label="Cari artikel">
            <select class="clay-input" name="topik" aria-label="Topik" data-autosubmit>
                <option value="">Semua topik</option>
                @foreach ($topics as $slug => $name)<option value="{{ $slug }}" @selected($topic === $slug)>{{ $name }}</option>@endforeach
            </select>
            <select class="clay-input" name="status" aria-label="Status" data-autosubmit>
                <option value="">Semua status</option>
                @foreach (\App\Models\Article::STATUSES as $s)<option value="{{ $s }}" @selected($status === $s)>{{ ['published' => 'Terbit', 'hidden' => 'Disembunyikan', 'draft' => 'Draft'][$s] }} ({{ $statusCounts[$s] ?? 0 }})</option>@endforeach
            </select>
            <button class="adm-btn adm-btn--primary" type="submit">Cari</button>
        </form>
        <ul class="adm-list" style="margin-top:8px">
            @forelse ($articles as $a)
                <li class="adm-row">
                    <div class="adm-row__main">
                        <a class="adm-row__title" href="{{ route('panel.news.edit', $a->id) }}">{{ $a->title }}</a>
                        <span class="adm-row__meta">@include('panel._status', ['s' => $a->status]) <span class="topic-badge topic-badge--{{ $a->topic }}" style="position:static">{{ $topics[$a->topic] ?? $a->topic }}</span> <span>#{{ $a->id }}</span> <span>{{ ($a->published_at ?? $a->created_at)?->wita() }}</span> <span>💬 {{ $a->comments_count }}</span> @unless($a->image_path)<span>tanpa foto</span>@endunless</span>
                    </div>
                    <div class="adm-row__tools">
                        <a class="adm-btn" href="{{ $a->url() }}" target="_blank" rel="noopener" data-no-skel>Lihat</a>
                        <a class="adm-btn adm-btn--primary" href="{{ route('panel.news.edit', $a->id) }}">Edit</a>
                        <form method="POST" action="{{ route('panel.news.status', $a->id) }}" @if($a->status === 'published') data-confirm="Sembunyikan “{{ $a->title }}” dari situs? Bisa ditampilkan lagi kapan saja." data-confirm-ok="Sembunyikan" @endif>
                            @csrf
                            <input type="hidden" name="status" value="{{ $a->status === 'published' ? 'hidden' : 'published' }}">
                            <button class="adm-btn {{ $a->status === 'published' ? 'adm-btn--peach' : 'adm-btn--mint' }}" type="submit">{{ $a->status === 'published' ? 'Sembunyikan' : 'Terbitkan' }}</button>
                        </form>
                    </div>
                </li>
            @empty
                <li class="adm-empty">Tidak ada artikel yang cocok.</li>
            @endforelse
        </ul>
        @include('panel._pager', ['p' => $articles])
    </section>
@endsection

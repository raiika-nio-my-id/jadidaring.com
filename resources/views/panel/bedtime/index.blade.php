@extends('panel.layout')
@php $panelTitle = 'Bed Time Stories'; @endphp

@section('panel')
    <section class="adm-card">
        <div class="adm-top" style="margin-bottom:12px">
            <h2 style="margin:0">Bed Time Stories</h2>
            <a class="adm-btn adm-btn--primary" href="{{ route('panel.bedtime.create') }}">✍️ Tulis cerita</a>
        </div>
        <form class="adm-search" method="GET" action="{{ route('panel.bedtime') }}" role="search">
            <input class="clay-input" type="search" name="q" value="{{ $q }}" placeholder="Cari judul, penulis, atau slug…" aria-label="Cari cerita">
            <select class="clay-input" name="status" aria-label="Status" data-autosubmit>
                <option value="">Semua status</option>
                @foreach (\App\Models\BedtimeStory::STATUSES as $s)
                    <option value="{{ $s }}" @selected($status === $s)>{{ ['published' => 'Terbit', 'draft' => 'Draft'][$s] ?? $s }} ({{ $statusCounts[$s] ?? 0 }})</option>
                @endforeach
            </select>
            <button class="adm-btn adm-btn--primary" type="submit">Cari</button>
        </form>
        <ul class="adm-list" style="margin-top:8px">
            @forelse ($stories as $s)
                <li class="adm-row">
                    <div class="adm-row__main">
                        <a class="adm-row__title" href="{{ route('panel.bedtime.edit', $s->id) }}">{{ $s->title }}</a>
                        <span class="adm-row__meta">
                            @include('panel._status', ['s' => $s->status])
                            <span>oleh <strong>{{ $s->author }}</strong>@if($s->author_origin) ({{ $s->author_origin }})@endif</span>
                            <span>#{{ $s->id }}</span>
                            <span>{{ ($s->published_at ?? $s->created_at)?->wita() }}</span>
                            @unless($s->image_path)<span>kartu judul</span>@else<span>foto</span>@endunless
                        </span>
                    </div>
                    <div class="adm-row__tools">
                        @if ($s->status === 'published' && ! $s->published_at?->isFuture())
                            <a class="adm-btn" href="{{ $s->url() }}" target="_blank" rel="noopener" data-no-skel>Lihat</a>
                        @endif
                        <a class="adm-btn adm-btn--primary" href="{{ route('panel.bedtime.edit', $s->id) }}">Edit</a>
                        <form method="POST" action="{{ route('panel.bedtime.status', $s->id) }}">
                            @csrf
                            <input type="hidden" name="status" value="{{ $s->status === 'published' ? 'draft' : 'published' }}">
                            <button class="adm-btn {{ $s->status === 'published' ? 'adm-btn--peach' : 'adm-btn--mint' }}" type="submit">
                                {{ $s->status === 'published' ? 'Jadikan draft' : 'Terbitkan' }}
                            </button>
                        </form>
                    </div>
                </li>
            @empty
                <li class="adm-empty">Tidak ada cerita yang cocok.</li>
            @endforelse
        </ul>
        @include('panel._pager', ['p' => $stories])
    </section>
@endsection

@extends('panel.layout')
@php $panelTitle = 'Pesan'; @endphp

@section('panel')
    <div class="adm-sub">
        <a class="adm-chip" href="{{ route('panel.messages') }}" @if($f === 'semua') aria-current="page" @endif>Semua</a>
        <a class="adm-chip" href="{{ route('panel.messages', ['f' => 'belum']) }}" @if($f === 'belum') aria-current="page" @endif>Belum dibaca</a>
    </div>
    <section class="adm-card">
        <h2>Pesan dari form Kontak</h2>
        <ul class="adm-list">
            @forelse ($messages as $m)
                <li class="adm-row">
                    <div class="adm-row__main">
                        <span class="adm-row__title">{{ $m->subject }} @unless($m->read_at)<span class="adm-badge adm-badge--warn">Baru</span>@endunless</span>
                        <span class="adm-row__meta"><strong>{{ $m->name }}</strong>@if($m->email) · <a href="mailto:{{ $m->email }}">{{ $m->email }}</a>@endif · {{ $m->created_at?->wita() }}</span>
                        <p class="adm-row__body">{{ $m->message }}</p>
                    </div>
                    <div class="adm-row__tools">
                        @unless ($m->read_at)<form method="POST" action="{{ route('panel.messages.read', $m->id) }}">@csrf<button class="adm-btn adm-btn--mint" type="submit">Tandai dibaca</button></form>@endunless
                        <form method="POST" action="{{ route('panel.messages.destroy', $m->id) }}" data-confirm="Hapus pesan “{{ $m->subject }}”?" data-confirm-ok="Hapus">@csrf @method('DELETE')<button class="adm-btn adm-btn--danger" type="submit">Hapus</button></form>
                    </div>
                </li>
            @empty
                <li class="adm-empty">Belum ada pesan.</li>
            @endforelse
        </ul>
        @include('panel._pager', ['p' => $messages])
    </section>
@endsection

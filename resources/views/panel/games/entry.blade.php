@extends('panel.layout')
@php $panelTitle = $game->subdomain.' · '.($kind === 'skor' ? 'Skor #'.$entry->id : 'Room '.$entry->code); @endphp

@section('panel')
    <div class="adm-top">
        <a class="adm-chip" href="{{ route('panel.games.show', ['game' => $game->id, 'tab' => $kind]) }}">‹ Data {{ $game->subdomain }}</a>
    </div>
    <section class="adm-card">
        @if ($kind === 'skor')
            <h2>Skor #{{ $entry->id }} · {{ $entry->name }}</h2>
            <form class="adm-form" method="POST" action="{{ route('panel.games.score.update', [$game->id, $entry->id]) }}" style="margin-bottom:14px">
                @csrf
                @method('PUT')
                <div class="adm-form-grid">
                    <div class="adm-form"><label for="sname">Nama</label><input class="clay-input" id="sname" name="name" value="{{ old('name', $entry->name) }}" maxlength="16" required></div>
                    <div class="adm-form"><label for="sval">Skor</label><input class="clay-input" id="sval" type="number" name="score" min="0" value="{{ old('score', $entry->score) }}" required></div>
                </div>
                <div><button class="adm-btn adm-btn--primary" type="submit">Simpan skor</button></div>
            </form>
            <form method="POST" action="{{ route('panel.games.score.destroy', [$game->id, $entry->id]) }}" data-confirm="Hapus skor ini? Backup disimpan dulu." data-confirm-ok="Hapus">@csrf @method('DELETE')<button class="adm-btn adm-btn--danger" type="submit">Hapus skor</button></form>
        @else
            <h2>Room {{ $entry->code }}</h2>
            <p class="adm-muted">Status {{ $entry->status }} · {{ $entry->visibility }} · versi {{ $entry->version }} · {{ count($json['players']) }} pemain · {{ $json['events_total'] }} event ({{ count($json['events']) }} terakhir ditampilkan). Data room tidak bisa diedit dari sini supaya permainan yang sedang jalan tidak rusak.</p>
            <form method="POST" action="{{ route('panel.games.room.destroy', [$game->id, $entry->id]) }}" data-confirm="Hapus room {{ $entry->code }}? Pemain di room ini akan terputus. Backup disimpan dulu." data-confirm-ok="Hapus room">@csrf @method('DELETE')<button class="adm-btn adm-btn--danger" type="submit">Hapus room</button></form>
        @endif
    </section>
    <section class="adm-card">
        <h2>JSON</h2>
        <pre class="adm-json">{{ json_encode($json, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_INVALID_UTF8_SUBSTITUTE) }}</pre>
    </section>
@endsection

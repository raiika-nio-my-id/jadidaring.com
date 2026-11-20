@extends('panel.layout')
@php $panelTitle = 'Data '.$game->subdomain; @endphp

@section('panel')
    <div class="adm-top">
        <a class="adm-chip" href="{{ route('panel.games') }}">‹ Semua game</a>
        <div class="adm-row__tools">
            <a class="adm-btn" href="/game/{{ $game->subdomain }}" target="_blank" rel="noopener" data-no-skel>Buka game ↗</a>
            <a class="adm-btn adm-btn--sky" href="{{ route('panel.games.export', ['game' => $game->id, 'type' => 'semua']) }}" download data-no-skel>⬇ Ekspor JSON</a>
        </div>
    </div>

    <section class="adm-card">
        <div class="adm-top"><h2 style="margin:0">{{ $game->subdomain }} @if($game->hidden_from_listing)<span class="adm-badge adm-badge--warn">Disembunyikan dari daftar</span>@endif</h2></div>
        <div class="adm-grid" style="margin:10px 0">
            <div class="adm-stat adm-stat--lavender"><span class="adm-stat__v">{{ number_format($totals['scores'], 0, ',', '.') }}</span><span class="adm-stat__l">Skor leaderboard</span></div>
            <div class="adm-stat adm-stat--sky"><span class="adm-stat__v">{{ number_format($totals['rooms'], 0, ',', '.') }}</span><span class="adm-stat__l">Room multiplayer</span><span class="adm-stat__s">{{ $totals['oldRooms'] }} tidak aktif &gt; 24 jam</span></div>
            <div class="adm-stat adm-stat--mint"><span class="adm-stat__v">{{ number_format(array_sum($series), 0, ',', '.') }}</span><span class="adm-stat__l">Pengunjung unik 30 hari</span></div>
        </div>
        @include('panel._chart', ['series' => $series, 'label' => 'Pengunjung'])
    </section>

    <div class="adm-sub" role="tablist" aria-label="Jenis data">
        <a class="adm-chip" href="{{ route('panel.games.show', ['game' => $game->id, 'tab' => 'skor']) }}" @if($tab === 'skor') aria-current="page" @endif>🏆 Skor ({{ $totals['scores'] }})</a>
        <a class="adm-chip" href="{{ route('panel.games.show', ['game' => $game->id, 'tab' => 'room']) }}" @if($tab === 'room') aria-current="page" @endif>🚪 Room ({{ $totals['rooms'] }})</a>
    </div>

    @if ($tab === 'skor')
        <section class="adm-card">
            <form class="adm-search" method="GET" action="{{ route('panel.games.show', $game->id) }}" role="search">
                <input type="hidden" name="tab" value="skor">
                <input class="clay-input" type="search" name="q" value="{{ $q }}" placeholder="Cari nama pemain…" aria-label="Cari skor">
                <select class="clay-input" name="sort" aria-label="Urutan" data-autosubmit>
                    <option value="skor" @selected($sort === 'skor')>Skor tertinggi</option>
                    <option value="baru" @selected($sort === 'baru')>Terbaru</option>
                </select>
                <button class="adm-btn adm-btn--primary" type="submit">Cari</button>
                <a class="adm-btn" href="{{ route('panel.games.export', ['game' => $game->id, 'type' => 'skor']) }}" download data-no-skel>⬇ JSON skor</a>
            </form>
            <div class="adm-table-wrap" style="margin-top:10px">
                <table class="adm-table">
                    <thead><tr><th class="num">#</th><th>Nama</th><th class="num">Skor</th><th>Akun</th><th>Waktu</th><th></th></tr></thead>
                    <tbody>
                        @forelse ($scores as $s)
                            <tr class="is-link" data-href="{{ route('panel.games.score', [$game->id, $s->id]) }}">
                                <td class="num">{{ $sort === 'skor' ? ($scores->firstItem() + $loop->index) : $s->id }}</td>
                                <td><a class="adm-row__title" href="{{ route('panel.games.score', [$game->id, $s->id]) }}">{{ $s->name }}</a></td>
                                <td class="num">{{ number_format($s->score, 0, ',', '.') }}</td>
                                <td>{{ $s->user ? '@'.$s->user->username : 'tamu' }}</td>
                                <td>{{ $s->created_at?->wita() }}</td>
                                <td><form method="POST" action="{{ route('panel.games.score.destroy', [$game->id, $s->id]) }}" data-confirm="Hapus skor {{ $s->name }} ({{ $s->score }})? Backup disimpan dulu." data-confirm-ok="Hapus">@csrf @method('DELETE')<button class="adm-btn adm-btn--danger" type="submit" aria-label="Hapus skor {{ $s->name }}">Hapus</button></form></td>
                            </tr>
                        @empty
                            <tr><td colspan="6" class="adm-empty">Belum ada skor.</td></tr>
                        @endforelse
                    </tbody>
                </table>
            </div>
            @include('panel._pager', ['p' => $scores])
        </section>
        @if ($totals['scores'] > 0)
            <details class="adm-card adm-danger">
                <summary>Kosongkan leaderboard {{ $game->subdomain }}</summary>
                <p class="adm-muted">Semua {{ $totals['scores'] }} skor dihapus. Backup JSON lengkap ditulis dulu di server.</p>
                <form class="adm-form" method="POST" action="{{ route('panel.games.scores.clear', $game->id) }}" data-confirm="Hapus SEMUA {{ $totals['scores'] }} skor {{ $game->subdomain }}?" data-confirm-title="Kosongkan leaderboard" data-confirm-ok="Kosongkan">
                    @csrf
                    <label for="confirm-scores">Ketik <strong>{{ $game->subdomain }}</strong> untuk konfirmasi</label>
                    <input class="clay-input" id="confirm-scores" name="confirm" autocomplete="off" autocapitalize="off" spellcheck="false" required>
                    <div><button class="adm-btn adm-btn--danger" type="submit">Kosongkan leaderboard</button></div>
                </form>
            </details>
        @endif
    @else
        <section class="adm-card">
            <form class="adm-search" method="GET" action="{{ route('panel.games.show', $game->id) }}" role="search">
                <input type="hidden" name="tab" value="room">
                <input class="clay-input" type="search" name="q" value="{{ $q }}" placeholder="Cari kode room…" aria-label="Cari room">
                <select class="clay-input" name="status" aria-label="Status room" data-autosubmit>
                    <option value="">Semua status</option>
                    @foreach ($roomStatuses as $st)<option value="{{ $st }}" @selected($status === $st)>{{ $st }}</option>@endforeach
                </select>
                <button class="adm-btn adm-btn--primary" type="submit">Cari</button>
                <a class="adm-btn" href="{{ route('panel.games.export', ['game' => $game->id, 'type' => 'room']) }}" download data-no-skel>⬇ JSON room</a>
            </form>
            <div class="adm-table-wrap" style="margin-top:10px">
                <table class="adm-table">
                    <thead><tr><th>Kode</th><th>Status</th><th>Jenis</th><th class="num">Pemain</th><th class="num">Event</th><th>Aktif terakhir</th><th></th></tr></thead>
                    <tbody>
                        @forelse ($rooms as $r)
                            <tr class="is-link" data-href="{{ route('panel.games.room', [$game->id, $r->id]) }}">
                                <td><a class="adm-row__title" href="{{ route('panel.games.room', [$game->id, $r->id]) }}">{{ $r->code }}</a></td>
                                <td><span class="adm-badge">{{ $r->status }}</span></td>
                                <td>{{ $r->visibility }}</td>
                                <td class="num">{{ $r->players_count }}/{{ $r->max_players }}</td>
                                <td class="num">{{ number_format($r->events_count, 0, ',', '.') }}</td>
                                <td>{{ $r->updated_at?->wita() }}</td>
                                <td><form method="POST" action="{{ route('panel.games.room.destroy', [$game->id, $r->id]) }}" data-confirm="Hapus room {{ $r->code }} beserta pemain dan event-nya? Pemain yang sedang di room ini akan terputus. Backup disimpan dulu." data-confirm-ok="Hapus room">@csrf @method('DELETE')<button class="adm-btn adm-btn--danger" type="submit">Hapus</button></form></td>
                            </tr>
                        @empty
                            <tr><td colspan="7" class="adm-empty">Belum ada room.</td></tr>
                        @endforelse
                    </tbody>
                </table>
            </div>
            @include('panel._pager', ['p' => $rooms])
        </section>
        @if ($totals['rooms'] > 0)
            <details class="adm-card adm-danger">
                <summary>Bersihkan room {{ $game->subdomain }}</summary>
                <p class="adm-muted">Room beserta pemain dan event-nya dihapus. Backup JSON lengkap ditulis dulu. Pilih “tidak aktif &gt; 24 jam” supaya permainan yang sedang jalan tidak terputus.</p>
                <form class="adm-form" method="POST" action="{{ route('panel.games.rooms.clear', $game->id) }}" data-confirm="Hapus room {{ $game->subdomain }} sesuai pilihan?" data-confirm-title="Bersihkan room" data-confirm-ok="Hapus room">
                    @csrf
                    <label class="clay-check"><input type="radio" name="scope" value="lama" checked> Hanya yang tidak aktif &gt; 24 jam ({{ $totals['oldRooms'] }})</label>
                    <label class="clay-check"><input type="radio" name="scope" value="semua"> Semua room ({{ $totals['rooms'] }})</label>
                    <label for="confirm-rooms">Ketik <strong>{{ $game->subdomain }}</strong> untuk konfirmasi</label>
                    <input class="clay-input" id="confirm-rooms" name="confirm" autocomplete="off" autocapitalize="off" spellcheck="false" required>
                    <div><button class="adm-btn adm-btn--danger" type="submit">Hapus room</button></div>
                </form>
            </details>
        @endif
    @endif
@endsection

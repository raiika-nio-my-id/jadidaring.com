@extends('panel.layout')
@php $panelTitle = 'Backup'; @endphp

@section('panel')
    <section class="adm-card">
        <h2>Backup JSON ({{ $total }})</h2>
        <p class="adm-muted">Dibuat otomatis sebelum data dihapus: akun user yang dihapus (folder <code>backups</code>) dan hapus dari panel ini, termasuk artikel, komentar, curhatan, skor, dan room (folder <code>backups/admin</code>). Ini bukan backup seluruh database. Untuk mengembalikan data, kirim filenya ke bot.</p>
        <div class="adm-table-wrap">
            <table class="adm-table">
                <thead><tr><th>File</th><th>Jenis</th><th class="num">Ukuran</th><th>Waktu (WITA)</th><th></th></tr></thead>
                <tbody>
                    @forelse ($files as $f)
                        <tr>
                            <td style="word-break:break-all">{{ $f['name'] }}</td>
                            <td>{{ $f['dir'] === 'user' ? 'User dihapus' : 'Panel admin' }}</td>
                            <td class="num">{{ $f['size'] >= 1048576 ? number_format($f['size'] / 1048576, 1, ',', '.').' MB' : number_format(max(1, $f['size'] / 1024), 0, ',', '.').' KB' }}</td>
                            <td style="white-space:nowrap">{{ \Illuminate\Support\Carbon::createFromTimestamp($f['at'])->wita() }}</td>
                            <td><a class="adm-btn adm-btn--sky" href="{{ route('panel.backups.download', [$f['dir'], $f['name']]) }}" download>⬇ Unduh</a></td>
                        </tr>
                    @empty
                        <tr><td colspan="5" class="adm-empty">Belum ada backup.</td></tr>
                    @endforelse
                </tbody>
            </table>
        </div>
    </section>
@endsection

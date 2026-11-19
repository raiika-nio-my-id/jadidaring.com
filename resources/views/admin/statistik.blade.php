@extends('layouts.admin')

@section('title', 'Statistik')

@section('content')
    <div class="page-heading">
        <div>
            <h1>Statistik</h1>
            <p class="muted lede">Data Google Analytics 4 dan Google Search Console untuk jadidaring.com (hanya baca). Disimpan di cache sekitar 1 jam.</p>
        </div>
        <div class="row-actions">
            <form method="POST" action="{{ route('admin.statistik.refresh') }}" class="inline">
                @csrf
                <input type="hidden" name="days" value="{{ $days }}">
                <button class="button button-quiet button-small" type="submit">Refresh</button>
            </form>
        </div>
    </div>

    <div class="analytics-header-row">
        <div class="analytics-ranges">
            @foreach ($ranges as $d)
                <a href="{{ route('admin.statistik', ['days' => $d]) }}" class="analytics-range-btn {{ $days === $d ? 'active' : '' }}">{{ $d }} hari</a>
            @endforeach
        </div>
        <span class="muted" style="font-size:.82rem">{{ $days }} hari terakhir</span>
    </div>

    {{-- ── Google Analytics 4 ─────────────────────────────────────────── --}}
    <h2 style="margin-top:20px">Google Analytics</h2>
    @if ($missing['ga4'] !== [])
        <div class="card" data-state="setup-pending" style="padding:16px;margin-bottom:16px">
            <strong>Setup belum selesai</strong>
            <p class="muted" style="margin:6px 0">Data Google Analytics belum bisa ditampilkan. Yang masih kurang:</p>
            <ul style="margin:0 0 0 18px">
                @foreach ($missing['ga4'] as $item)<li>{{ $item }}</li>@endforeach
            </ul>
        </div>
    @elseif (isset($ga4['error']))
        <div class="card" data-state="error" style="padding:16px;margin-bottom:16px">
            <strong>Gagal mengambil data Google Analytics</strong>
            <p class="muted" style="margin:6px 0 0">{{ $ga4['error'] }}</p>
        </div>
    @else
        @php $g = $ga4['data']; @endphp
        <div class="analytics-cards">
            <div class="analytics-card"><div class="analytics-card-label">Page views</div><div class="analytics-card-value">{{ number_format($g['totals']['views']) }}</div></div>
            <div class="analytics-card"><div class="analytics-card-label">Sesi</div><div class="analytics-card-value">{{ number_format($g['totals']['sessions']) }}</div></div>
            <div class="analytics-card"><div class="analytics-card-label">Pengguna</div><div class="analytics-card-value">{{ number_format($g['totals']['users']) }}</div></div>
        </div>
        @include('admin.statistik-chart', ['series' => array_map(fn ($d) => $d['views'], $g['daily']), 'label' => 'Page views'])
        <div class="card table-wrap" style="margin-bottom:16px">
            <table>
                <thead><tr><th>Halaman teratas</th><th>Views</th></tr></thead>
                <tbody>
                    @forelse ($g['topPages'] as $row)
                        <tr><td>{{ $row['path'] }}</td><td>{{ number_format($row['views']) }}</td></tr>
                    @empty
                        <tr><td colspan="2" class="muted">Belum ada data.</td></tr>
                    @endforelse
                </tbody>
            </table>
        </div>
        <p class="muted" style="font-size:.8rem">Diambil {{ \Illuminate\Support\Carbon::parse($g['fetchedAt'])->wita() }}</p>
    @endif

    {{-- ── Search Console ─────────────────────────────────────────────── --}}
    <h2 style="margin-top:28px">Google Search Console</h2>
    <p class="muted" style="margin-top:0">Data Search Console tertunda 2–3 hari, jadi beberapa hari terakhir bisa masih kosong.</p>
    @if ($missing['gsc'] !== [])
        <div class="card" data-state="setup-pending" style="padding:16px;margin-bottom:16px">
            <strong>Setup belum selesai</strong>
            <p class="muted" style="margin:6px 0">Data Search Console belum bisa ditampilkan. Yang masih kurang:</p>
            <ul style="margin:0 0 0 18px">
                @foreach ($missing['gsc'] as $item)<li>{{ $item }}</li>@endforeach
            </ul>
        </div>
    @elseif (isset($gsc['error']))
        <div class="card" data-state="error" style="padding:16px;margin-bottom:16px">
            <strong>Gagal mengambil data Search Console</strong>
            <p class="muted" style="margin:6px 0 0">{{ $gsc['error'] }}</p>
        </div>
    @else
        @php $s = $gsc['data']; @endphp
        <div class="analytics-cards">
            <div class="analytics-card"><div class="analytics-card-label">Klik</div><div class="analytics-card-value">{{ number_format($s['totals']['clicks']) }}</div></div>
            <div class="analytics-card"><div class="analytics-card-label">Impresi</div><div class="analytics-card-value">{{ number_format($s['totals']['impressions']) }}</div></div>
            <div class="analytics-card"><div class="analytics-card-label">CTR</div><div class="analytics-card-value">{{ number_format($s['totals']['ctr'] * 100, 1, ',', '.') }}%</div></div>
            <div class="analytics-card"><div class="analytics-card-label">Posisi rata-rata</div><div class="analytics-card-value">{{ number_format($s['totals']['position'], 1, ',', '.') }}</div></div>
        </div>
        @include('admin.statistik-chart', ['series' => array_map(fn ($d) => $d['clicks'], $s['daily']), 'label' => 'Klik'])
        @foreach (['topQueries' => 'Kata kunci teratas', 'topPages' => 'Halaman teratas'] as $key => $heading)
            <div class="card table-wrap" style="margin-bottom:16px">
                <table>
                    <thead><tr><th>{{ $heading }}</th><th>Klik</th><th>Impresi</th><th>CTR</th><th>Posisi</th></tr></thead>
                    <tbody>
                        @forelse ($s[$key] as $row)
                            <tr>
                                <td style="word-break:break-all">{{ $row['key'] }}</td>
                                <td>{{ number_format($row['clicks']) }}</td>
                                <td>{{ number_format($row['impressions']) }}</td>
                                <td>{{ number_format($row['ctr'] * 100, 1, ',', '.') }}%</td>
                                <td>{{ number_format($row['position'], 1, ',', '.') }}</td>
                            </tr>
                        @empty
                            <tr><td colspan="5" class="muted">Belum ada data.</td></tr>
                        @endforelse
                    </tbody>
                </table>
            </div>
        @endforeach
        <p class="muted" style="font-size:.8rem">Periode {{ \Carbon\Carbon::parse($s['startDate'])->translatedFormat('d M Y') }} – {{ \Carbon\Carbon::parse($s['endDate'])->translatedFormat('d M Y') }} · diambil {{ \Illuminate\Support\Carbon::parse($s['fetchedAt'])->wita() }}</p>
    @endif
@endsection

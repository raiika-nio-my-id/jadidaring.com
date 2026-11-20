@extends('panel.layout')
@php $panelTitle = 'Statistik'; @endphp

@section('panel')
    <div class="adm-top">
        <div class="adm-sub">
            @foreach ($ranges as $d)
                <a class="adm-chip" href="{{ route('panel.stats', ['days' => $d]) }}" @if($days === $d) aria-current="page" @endif>{{ $d }} hari</a>
            @endforeach
        </div>
        <form method="POST" action="{{ route('panel.stats.refresh') }}" class="adm-inline">
            @csrf
            <input type="hidden" name="days" value="{{ $days }}">
            <button class="adm-btn adm-btn--sky" type="submit">↻ Ambil ulang dari Google</button>
        </form>
    </div>

    <section class="adm-card">
        <h2>Google Analytics</h2>
        @include('panel._ga', ['missing' => $missing['ga4'], 'ga4' => $ga4])
        @if (isset($ga4['data']))
            <div class="adm-table-wrap" style="margin-top:12px">
                <table class="adm-table">
                    <thead><tr><th>Halaman teratas</th><th class="num">Views</th></tr></thead>
                    <tbody>
                        @forelse ($ga4['data']['topPages'] as $row)
                            <tr><td style="word-break:break-all"><a href="{{ $row['path'] }}" target="_blank" rel="noopener">{{ $row['path'] }}</a></td><td class="num">{{ number_format($row['views'], 0, ',', '.') }}</td></tr>
                        @empty
                            <tr><td colspan="2" class="adm-muted">Belum ada data.</td></tr>
                        @endforelse
                    </tbody>
                </table>
            </div>
        @endif
    </section>

    <section class="adm-card">
        <h2>Google Search Console</h2>
        <p class="adm-muted">Data Search Console tertunda 2–3 hari, jadi beberapa hari terakhir bisa masih kosong.</p>
        @if ($missing['gsc'] !== [])
            <div class="adm-note adm-note--warn"><strong>Setup belum selesai.</strong> Yang kurang: {{ implode(', ', $missing['gsc']) }}.</div>
        @elseif (isset($gsc['error']))
            <div class="adm-note adm-note--warn"><strong>Gagal mengambil data Search Console.</strong> {{ $gsc['error'] }}</div>
        @else
            @php $s = $gsc['data']; @endphp
            <div class="adm-grid" style="margin-bottom:12px">
                <div class="adm-stat adm-stat--sky"><span class="adm-stat__v">{{ number_format($s['totals']['clicks'], 0, ',', '.') }}</span><span class="adm-stat__l">Klik</span></div>
                <div class="adm-stat adm-stat--lavender"><span class="adm-stat__v">{{ number_format($s['totals']['impressions'], 0, ',', '.') }}</span><span class="adm-stat__l">Impresi</span></div>
                <div class="adm-stat adm-stat--mint"><span class="adm-stat__v">{{ number_format($s['totals']['ctr'] * 100, 1, ',', '.') }}%</span><span class="adm-stat__l">CTR</span></div>
                <div class="adm-stat adm-stat--peach"><span class="adm-stat__v">{{ number_format($s['totals']['position'], 1, ',', '.') }}</span><span class="adm-stat__l">Posisi rata-rata</span></div>
            </div>
            @include('panel._chart', ['series' => array_map(fn ($d) => $d['clicks'], $s['daily']), 'label' => 'Klik'])
            @foreach (['topQueries' => 'Kata kunci teratas', 'topPages' => 'Halaman teratas'] as $key => $heading)
                <div class="adm-table-wrap" style="margin-top:12px">
                    <table class="adm-table">
                        <thead><tr><th>{{ $heading }}</th><th class="num">Klik</th><th class="num">Impresi</th><th class="num">CTR</th><th class="num">Posisi</th></tr></thead>
                        <tbody>
                            @forelse ($s[$key] as $row)
                                <tr><td style="word-break:break-all">{{ $row['key'] }}</td><td class="num">{{ number_format($row['clicks'], 0, ',', '.') }}</td><td class="num">{{ number_format($row['impressions'], 0, ',', '.') }}</td><td class="num">{{ number_format($row['ctr'] * 100, 1, ',', '.') }}%</td><td class="num">{{ number_format($row['position'], 1, ',', '.') }}</td></tr>
                            @empty
                                <tr><td colspan="5" class="adm-muted">Belum ada data.</td></tr>
                            @endforelse
                        </tbody>
                    </table>
                </div>
            @endforeach
            <p class="adm-muted">Periode {{ \Carbon\Carbon::parse($s['startDate'])->translatedFormat('d M Y') }} – {{ \Carbon\Carbon::parse($s['endDate'])->translatedFormat('d M Y') }} · diambil {{ \Illuminate\Support\Carbon::parse($s['fetchedAt'])->wita() }}</p>
        @endif
    </section>
@endsection

@if ($missing !== [])
    <div class="adm-note adm-note--warn"><strong>Setup GA belum selesai.</strong> Yang kurang: {{ implode(', ', $missing) }}.</div>
@elseif (isset($ga4['error']))
    <div class="adm-note adm-note--warn"><strong>Gagal mengambil data Google Analytics.</strong> {{ $ga4['error'] }}</div>
@else
    @php $g = $ga4['data']; @endphp
    <div class="adm-grid" style="margin-bottom:12px">
        <div class="adm-stat adm-stat--sky"><span class="adm-stat__v">{{ number_format($g['totals']['views'], 0, ',', '.') }}</span><span class="adm-stat__l">Page views</span></div>
        <div class="adm-stat adm-stat--lavender"><span class="adm-stat__v">{{ number_format($g['totals']['sessions'], 0, ',', '.') }}</span><span class="adm-stat__l">Sesi</span></div>
        <div class="adm-stat adm-stat--mint"><span class="adm-stat__v">{{ number_format($g['totals']['users'], 0, ',', '.') }}</span><span class="adm-stat__l">Pengguna</span></div>
    </div>
    @include('panel._chart', ['series' => array_map(fn ($d) => $d['views'], $g['daily']), 'label' => 'Page views'])
    <p class="adm-muted">Diambil {{ \Illuminate\Support\Carbon::parse($g['fetchedAt'])->wita() }} (cache ±1 jam).</p>
@endif

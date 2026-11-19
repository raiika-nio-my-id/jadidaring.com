{{-- Small inline bar chart. Expects $series (Y-m-d => int) and $label. --}}
@php
    $barCount = count($series);
    $maxVal = $barCount ? max(array_values($series)) : 0;
    $vW = 800; $vH = 140; $padB = 24; $padT = 8;
    $totalH = $vH + $padB + $padT; $drawH = $vH - $padT;
    $barW = $barCount > 0 ? $vW / $barCount : 1; $innerW = max(1.0, $barW - 2);
    $dates = array_keys($series);
    $labelPos = $barCount ? array_unique([0, (int) floor(($barCount - 1) / 2), max(0, $barCount - 1)]) : [];
@endphp
<div class="card analytics-chart-card">
    <p class="analytics-card-label" style="margin:0 0 6px">{{ $label }} per hari</p>
    @if ($maxVal === 0)
        <p class="analytics-empty">Belum ada data di periode ini.</p>
    @else
        <svg class="analytics-chart" viewBox="0 0 {{ $vW }} {{ $totalH }}" preserveAspectRatio="none" role="img" aria-label="{{ $label }} per hari">
            <line class="chart-grid" x1="0" y1="{{ $padT }}" x2="{{ $vW }}" y2="{{ $padT }}" stroke-dasharray="3 4" stroke-width="1"/>
            @foreach ($series as $date => $count)
                @php
                    $barH = $count > 0 ? max(2, ($count / $maxVal) * $drawH) : 2;
                    $x = round($loop->index * $barW + 1, 2);
                    $y = round($padT + $drawH - $barH, 2);
                @endphp
                <rect x="{{ $x }}" y="{{ $y }}" width="{{ round($innerW, 2) }}" height="{{ round($barH, 2) }}" rx="3" ry="3" class="chart-bar{{ $count === 0 ? ' chart-bar-zero' : '' }}"><title>{{ $date }}: {{ number_format($count) }}</title></rect>
            @endforeach
            <line class="chart-axis" x1="0" y1="{{ $padT + $drawH + 1 }}" x2="{{ $vW }}" y2="{{ $padT + $drawH + 1 }}"/>
            @foreach ($labelPos as $li)
                <text x="{{ round($li * $barW + $barW / 2, 2) }}" y="{{ $totalH - 4 }}" class="chart-label" text-anchor="middle">{{ \Carbon\Carbon::parse($dates[$li])->format('d/m') }}</text>
            @endforeach
        </svg>
    @endif
</div>

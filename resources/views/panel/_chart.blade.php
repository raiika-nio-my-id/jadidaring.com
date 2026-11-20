{{-- Inline bar chart. $series: Y-m-d => int; $label. --}}
@php
    $n = count($series); $max = $n ? max(array_values($series)) : 0;
    $vW = 800; $vH = 150; $padB = 30; $drawH = $vH - $padB - 6; $barW = $n ? $vW / $n : 1; $inner = max(1.0, $barW - 3);
    $dates = array_keys($series); $marks = $n ? array_unique([0, (int) floor(($n - 1) / 2), $n - 1]) : [];
@endphp
@if ($max === 0)
    <p class="adm-empty">Belum ada data {{ strtolower($label) }} di periode ini.</p>
@else
    <svg class="adm-chart" viewBox="0 0 {{ $vW }} {{ $vH }}" preserveAspectRatio="none" role="img" aria-label="{{ $label }} per hari">
        @foreach ($series as $date => $v)
            @php $h = $v > 0 ? max(3, $v / $max * $drawH) : 3; @endphp
            <rect class="bar{{ $v === 0 ? ' bar--zero' : '' }}" x="{{ round($loop->index * $barW + 1.5, 2) }}" y="{{ round(6 + $drawH - $h, 2) }}" width="{{ round($inner, 2) }}" height="{{ round($h, 2) }}" rx="4"><title>{{ \Carbon\Carbon::parse($date)->format('d/m') }}: {{ number_format($v, 0, ',', '.') }}</title></rect>
        @endforeach
        <line class="axis" x1="0" x2="{{ $vW }}" y1="{{ 6 + $drawH + 1 }}" y2="{{ 6 + $drawH + 1 }}"/>
        @foreach ($marks as $i)
            <text class="lbl" x="{{ round(min(max($i * $barW + $barW / 2, 30), $vW - 30), 2) }}" y="{{ $vH - 4 }}" text-anchor="middle">{{ \Carbon\Carbon::parse($dates[$i])->format('d/m') }}</text>
        @endforeach
    </svg>
@endif

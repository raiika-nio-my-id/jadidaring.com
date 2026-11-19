@if (! empty($pagination) && $pagination['pages'] > 1)
    @php
        $cur = $pagination['page']; $last = $pagination['pages']; $base = $pagination['base'];
        $href = fn (int $n): string => $n <= 1 ? $base : $base.(str_contains($base, '?') ? '&' : '?').'page='.$n;
        $nums = collect([1, $last])->merge(range(max(1, $cur - 1), min($last, $cur + 1)))->unique()->sort()->values();
    @endphp
    <nav class="pager" aria-label="Halaman berita">
        @if ($cur > 1)<a class="pager__btn" rel="prev" href="{{ $href($cur - 1) }}" aria-label="Halaman sebelumnya">&laquo;<span class="pager__txt">Sebelumnya</span></a>@endif
        <ul class="pager__list">
            @foreach ($nums as $i => $n)
                @if ($i > 0 && $n - $nums[$i - 1] > 1)<li class="pager__gap" aria-hidden="true">…</li>@endif
                <li>@if ($n === $cur)<span class="pager__btn is-active" aria-current="page">{{ $n }}</span>@else<a class="pager__btn" href="{{ $href($n) }}" aria-label="Halaman {{ $n }}">{{ $n }}</a>@endif</li>
            @endforeach
        </ul>
        @if ($cur < $last)<a class="pager__btn" rel="next" href="{{ $href($cur + 1) }}" aria-label="Halaman berikutnya"><span class="pager__txt">Berikutnya</span>&raquo;</a>@endif
    </nav>
@endif

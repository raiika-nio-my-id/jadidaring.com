{{-- Infinite-scroll footer of a listing. Works without JS (plain ?page=N links); public/js/jd-infinite.js enhances it. Needs $inf (App\Support\Infinite::data). --}}
@if (! empty($inf) && ($inf['pages'] ?? 1) > 1)
    <nav class="inf" data-jd-inf data-kind="{{ $inf['kind'] }}" data-page="{{ $inf['page'] }}" data-pages="{{ $inf['pages'] }}" @if ($inf['nextPartial']) data-next="{{ $inf['nextPartial'] }}" @endif aria-label="Halaman lain">
        @if ($inf['prev'])<a class="inf__prev" rel="prev" href="{{ $inf['prev'] }}">&larr; Halaman sebelumnya</a>@endif
        @if ($inf['next'])
            <a class="clay-btn clay-btn--secondary inf__btn" rel="next" href="{{ $inf['next'] }}">Muat lebih banyak</a>
        @else
            <p class="inf__end">Sudah semua</p>
        @endif
        <p class="inf__status" role="status" aria-live="polite"></p>
    </nav>
@endif
@once
    <script src="{{ \App\Support\AssetUrl::to('js/jd-infinite.js') }}" defer></script>
@endonce

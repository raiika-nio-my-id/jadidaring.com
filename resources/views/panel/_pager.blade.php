@if ($p->hasPages())
    <nav class="adm-pager" aria-label="Halaman">
        @if ($p->onFirstPage())<span class="adm-btn" aria-disabled="true" style="opacity:.45">‹ Sebelumnya</span>@else<a class="adm-btn" href="{{ $p->previousPageUrl() }}" rel="prev">‹ Sebelumnya</a>@endif
        <span class="adm-pager__info">Hal. {{ $p->currentPage() }} / {{ $p->lastPage() }} · {{ number_format($p->total(), 0, ',', '.') }} item</span>
        @if ($p->hasMorePages())<a class="adm-btn" href="{{ $p->nextPageUrl() }}" rel="next">Berikutnya ›</a>@else<span class="adm-btn" aria-disabled="true" style="opacity:.45">Berikutnya ›</span>@endif
    </nav>
@endif

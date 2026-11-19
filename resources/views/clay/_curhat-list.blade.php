{{-- A page of Curhatan cards + "Muat lagi". Also returned alone as the load-more fragment. Needs: $posts, $next, $liked, $previews, $moreUrl; optional $moreQuery. --}}
@foreach ($posts as $post)
    @include('clay._curhat-card', ['post' => $post])
@endforeach
@if ($next)
    @php $sep = str_contains($moreUrl, '?') ? '&' : '?'; @endphp
    <div class="ch-more">
        <a class="clay-btn clay-btn--secondary" href="{{ $moreFull ?? $moreUrl }}{{ str_contains($moreFull ?? $moreUrl, '?') ? '&' : '?' }}sebelum={{ $next }}" data-ch-more="{{ $moreUrl }}{{ $sep }}sebelum={{ $next }}" rel="next">Muat lagi</a>
    </div>
@endif

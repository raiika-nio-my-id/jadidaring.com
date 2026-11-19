@php
    $q = $q ?? ''; $popular = ! empty($popular); $ct = $currentTopic ?? null;
    $path = $ct ? '/berita/'.$ct : '/berita';
    $topicHref = fn (?string $t): string => ($t ? '/berita/'.$t : '/berita').($q !== '' ? '?q='.urlencode($q) : '');
@endphp
<form class="news-search" data-jd-form role="search" method="get" action="{{ $path }}"@if (filled($q)) data-jd-view="search" data-jd-params="{{ json_encode(['search_term' => mb_substr((string) $q, 0, 80), 'search_scope' => 'berita']) }}"@endif>
    <label class="sr-only" for="news-q">Cari berita</label>
    <input class="clay-input" id="news-q" type="search" name="q" value="{{ $q }}" placeholder="{{ $ct ? 'Cari di '.($topics[$ct] ?? 'berita').'…' : 'Cari berita…' }}" maxlength="80">
    <button class="clay-btn clay-btn--primary" type="submit">Cari</button>
</form>

<div class="pills-bar" data-jd-chips aria-label="Urutkan Berita">
    <a href="{{ $topicHref($ct) }}" class="clay-pill clay-pill--sky @if(! $popular) is-active @endif" @if(! $popular) aria-current="page" @endif>Terbaru</a>
    <a href="{{ $path }}?urut=populer" class="clay-pill clay-pill--peach @if($popular) is-active @endif" @if($popular) aria-current="page" @endif>Populer</a>
</div>
<div class="pills-bar" data-jd-chips aria-label="Topik Berita">
    <a href="{{ $popular ? '/berita?urut=populer' : $topicHref(null) }}" class="clay-pill clay-pill--sky @if(! $ct) is-active @endif" @if(! $ct) aria-current="page" @endif>Semua</a>
    @foreach($topics as $slug => $name)
        <a href="{{ ($popular ? '/berita/'.$slug.'?urut=populer' : $topicHref($slug)) }}" class="clay-pill clay-pill--sky @if($slug === $ct) is-active @endif" @if($slug === $ct) aria-current="page" @endif>{{ $name }}</a>
    @endforeach
</div>

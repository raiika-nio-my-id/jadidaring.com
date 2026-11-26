@extends('layouts.clay')

@push('head')
    <script type="application/ld+json">{!! json_encode($collectionLd, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) !!}</script>
@endpush

@section('content')
    <div class="clay-section">
        <div data-jd-slot="top">
            <div class="clay-section__header">
                <h1 class="clay-section__title">Bed Time Stories</h1>
                <p class="clay-section__subtitle" style="margin-top: 0.5rem; color: var(--clay-muted); font-size: 1.05rem;">Dongeng klasik pengantar tidur dari penulis aslinya, diceritakan ulang oleh Dongeng Anak Kecil.</p>
            </div>
        </div>

        <div data-jd-slot="list" class="news-list-wrap" style="margin-top: 1.5rem;">
            <div class="news-grid" data-jd-inf-list>
                @include('clay._bedtime-cards', ['stories' => $stories])
            </div>
            @include('clay._inf-more', ['inf' => $inf ?? null])
        </div>
    </div>
@endsection

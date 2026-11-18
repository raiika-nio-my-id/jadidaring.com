@extends('layouts.clay')

@section('content')
    <div class="clay-section">
        <a href="/u/{{ $owner->username }}" class="news-back"><span aria-hidden="true">&larr;</span> Profil {{ '@'.$owner->username }}</a>
        <h1 class="clay-section__title">{{ $title }} {{ '@'.$owner->username }}</h1>
        <nav class="pf-tabs" aria-label="Daftar">
            <a class="clay-pill" href="/u/{{ $owner->username }}/pengikut" @if ($title === 'Pengikut') aria-current="page" @endif>Pengikut</a>
            <a class="clay-pill" href="/u/{{ $owner->username }}/mengikuti" @if ($title === 'Mengikuti') aria-current="page" @endif>Mengikuti</a>
        </nav>
        @if ($users->isEmpty())
            <div class="clay-card clay-card--peach clay-empty"><p class="clay-empty__text">Belum ada siapa pun di daftar ini.</p></div>
        @else
            <div class="pf-cards">
                @foreach ($users as $u)
                    @php $pr = $u->memberPage?->profileConfig()['profile'] ?? ['avatar' => '', 'tagline' => '']; @endphp
                    <a class="pf-mini" href="/u/{{ $u->username }}">
                        @if (($pr['avatar'] ?? '') !== '')
                            <img class="pf-mini__av" src="{{ $pr['avatar'] }}" alt="" width="56" height="56" loading="lazy" referrerpolicy="no-referrer">
                        @else
                            <span class="pf-mini__av pf-mini__av--ph" aria-hidden="true">{{ mb_strtoupper(mb_substr($u->name, 0, 1)) }}</span>
                        @endif
                        <span class="pf-mini__body">
                            <strong>{{ $u->name }}</strong>
                            <span class="pf-user">{{ '@'.$u->username }}</span>
                            @if (($pr['tagline'] ?? '') !== '')<span class="pf-mini__tag">{{ $pr['tagline'] }}</span>@endif
                        </span>
                    </a>
                @endforeach
            </div>
            <nav class="pf-pager" aria-label="Halaman">
                @if ($users->previousPageUrl())<a class="clay-btn clay-btn--secondary" href="{{ $users->previousPageUrl() }}" rel="prev">&larr; Sebelumnya</a>@endif
                @if ($users->hasMorePages())<a class="clay-btn clay-btn--secondary" href="{{ $users->nextPageUrl() }}" rel="next">Berikutnya &rarr;</a>@endif
            </nav>
        @endif
    </div>
@endsection

@extends('layouts.clay')

@section('content')
    <div class="clay-section">
        <div data-jd-slot="top">
        <div class="clay-section__header">
            <h1 class="clay-section__title">Komunitas</h1>
        </div>
        <p class="news-lead">Jelajahi profil ala Friendster buatan member Jadidaring. Intip latar, musik, dan galeri mereka, lalu tinggalkan komentar.</p>
        </div>
        @include('clay._komunitas-tabs')

        <div data-jd-slot="list">
        <form class="clay-form pf-explore" data-jd-form method="get" action="/komunitas" role="search"@if (filled($q)) data-jd-view="search" data-jd-params="{{ json_encode(['search_term' => mb_substr((string) $q, 0, 20), 'search_scope' => 'komunitas']) }}"@endif>
            <label for="ex-q" class="sr-only">Cari nama pengguna</label>
            <input type="hidden" name="tab" value="profil">
            <input class="clay-input" id="ex-q" type="search" name="q" value="{{ $q }}" maxlength="20" placeholder="Cari nama pengguna…" autocomplete="off">
            <label for="ex-s" class="sr-only">Urutkan</label>
            <select class="clay-input" id="ex-s" name="urut">
                <option value="update" @selected($sort === 'update')>Baru diperbarui</option>
                <option value="baru" @selected($sort === 'baru')>Terbaru</option>
                <option value="populer" @selected($sort === 'populer')>Populer (pengikut)</option>
                @auth<option value="mengikuti" @selected($sort === 'mengikuti')>Mengikuti</option>@endauth
            </select>
            <button class="clay-btn clay-btn--primary" type="submit">Cari</button>
            @auth
                <a class="clay-btn clay-btn--secondary" href="/komunitas/buat">Buat / Edit profil</a>
            @else
                <a class="clay-btn clay-btn--secondary" href="/komunitas/buat">Cara membuat profil</a>
            @endauth
        </form>

        @if ($pages->isEmpty())
            <div class="clay-card clay-card--peach clay-empty"><p class="clay-empty__text">@if ($sort === 'mengikuti') Kamu belum mengikuti siapa pun. Buka sebuah profil lalu tekan Ikuti. @endif Belum ada profil yang cocok. <a href="/komunitas/buat">Buat profilmu</a> dan jadilah yang pertama!</p></div>
        @else
            <div class="pf-cards">
                @foreach ($pages as $p)
                    @php $cfg = $p->profileConfig(); $pr = $cfg['profile']; @endphp
                    <a class="pf-mini" href="/u/{{ $p->user->username }}">
                        @if ($pr['avatar'] !== '')
                            <img class="pf-mini__av" src="{{ $pr['avatar'] }}" alt="" width="56" height="56" loading="lazy" referrerpolicy="no-referrer">
                        @else
                            <span class="pf-mini__av pf-mini__av--ph" aria-hidden="true">{{ mb_strtoupper(mb_substr($p->user->name, 0, 1)) }}</span>
                        @endif
                        <span class="pf-mini__body">
                            <strong>{{ $p->user->name }}</strong>
                            <span class="pf-user">{{ '@'.$p->user->username }}</span>
                            @if ($pr['tagline'] !== '')<span class="pf-mini__tag">{{ $pr['tagline'] }}</span>@endif
                            <span class="news-date">{{ number_format($p->followers_count ?? 0) }} pengikut · {{ number_format($p->views) }} pengunjung</span>
                        </span>
                    </a>
                @endforeach
            </div>
            <nav class="pf-pager" aria-label="Halaman">
                @if ($pages->previousPageUrl())<a class="clay-btn" href="{{ $pages->previousPageUrl() }}" rel="prev">&larr; Sebelumnya</a>@endif
                @if ($pages->hasMorePages())<a class="clay-btn" href="{{ $pages->nextPageUrl() }}" rel="next">Berikutnya &rarr;</a>@endif
            </nav>
        @endif
        </div>
    </div>
@endsection

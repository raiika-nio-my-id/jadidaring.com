@extends('layouts.clay')

@section('bodyclass', 'is-profile')

@section('content')
    <div class="member-page">
        <div class="pf-bar">
            <a href="/komunitas" class="news-back"><span aria-hidden="true">&larr;</span> Jelajahi</a>
            @if ($isOwner)
                <span class="pf-bar__owner">
                    <a class="clay-btn clay-btn--primary" href="/komunitas/halamanku">Edit profil</a>
                    <a class="clay-btn clay-btn--secondary" href="/akun">Pengaturan akun</a>
                </span>
            @endif
        </div>
        @if (session('status'))<p class="news-comments__msg" role="status">{{ session('status') }}</p>@endif
        @if (! $page->isPublished())<p class="clay-status" role="status">Profil ini disembunyikan moderator dan hanya terlihat olehmu.</p>@endif
        @include('clay._profile')

        <div class="member-actions">
            @auth
                @unless ($isOwner)
                    <form method="post" action="/u/{{ $owner->username }}/lapor" class="member-report">
                        @csrf
                        <button class="clay-btn clay-btn--secondary" type="submit">Laporkan halaman</button>
                    </form>
                @endunless
            @endauth
        </div>

        {{-- Curhatan: site-rendered posts (outside the member HTML sandbox). The server only passes posts this viewer may see. --}}
        <section class="ch-section" id="curhatan" aria-labelledby="ch-h">
            <h2 id="ch-h" class="ch-section__title">Curhatan</h2>
            @if ($isOwner)
                @include('clay._curhat-composer')
            @endif
            <div class="ch-list" data-ch-list>
                @include('clay._curhat-list', ['moreUrl' => '/u/'.$owner->username.'/curhatan', 'moreFull' => '/u/'.$owner->username])
            </div>
            @if ($posts->isEmpty())
                <p class="ch-empty">{{ $isOwner ? 'Belum ada curhatan. Tulis yang pertama di atas, bisa juga cuma untuk pengikut atau untuk dirimu sendiri.' : 'Belum ada curhatan yang bisa kamu lihat.' }}</p>
            @endif
        </section>

        {{-- Trusted comment wall: rendered by the server outside the sandbox; members cannot remove or hide it. --}}
        <section class="clay-card clay-card--lavender news-comments pf-wall" id="komentar" aria-labelledby="kmt-h">
            <h2 id="kmt-h">Komentar &amp; Testimoni</h2>
            @auth
                <form class="clay-form" method="post" action="/u/{{ $owner->username }}/komentar">
                    @csrf
                    <label for="kb">Tulis komentar untuk {{ '@'.$owner->username }}</label>
                    <textarea class="clay-input" id="kb" name="body" rows="3" maxlength="500" required></textarea>
                    @error('body')<p class="news-comments__msg" role="alert">{{ $message }}</p>@enderror
                    <button class="clay-btn clay-btn--primary" type="submit">Kirim</button>
                </form>
            @else
                <p><a href="/masuk">Masuk</a> atau <a href="/daftar">daftar</a> untuk berkomentar.</p>
            @endauth
            @forelse ($comments as $c)
                <article class="member-comment">
                    <header><strong>{{ '@'.($c->user?->username ?? 'anonim') }}</strong> <time class="news-date" datetime="{{ $c->created_at?->toIso8601String() }}">{{ $c->created_at?->wita() }}</time></header>
                    <p>{{ $c->body }}</p>
                    @auth
                        <div class="member-comment__tools">
                            <form method="post" action="/u/{{ $owner->username }}/komentar/{{ $c->id }}/lapor">@csrf<button class="member-link" type="submit">Laporkan</button></form>
                            @if (auth()->id() === $owner->id || auth()->id() === $c->user_id)
                                <form method="post" action="/u/{{ $owner->username }}/komentar/{{ $c->id }}/sembunyikan">@csrf<button class="member-link" type="submit">Sembunyikan</button></form>
                            @endif
                        </div>
                    @endauth
                </article>
            @empty
                <p class="news-comments__hint">Belum ada komentar. Jadilah yang pertama.</p>
            @endforelse
        </section>
    </div>
    <script src="{{ \App\Support\AssetUrl::to('js/member-frame.js') }}" defer></script>
    <script src="{{ \App\Support\AssetUrl::to('js/profile-music.js') }}" defer></script>
    <script src="{{ \App\Support\AssetUrl::to('js/curhatan.js') }}" defer></script>
@endsection

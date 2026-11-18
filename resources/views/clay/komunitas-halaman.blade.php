@extends('layouts.clay')

@section('content')
    <div class="clay-section member-page">
        <a href="/komunitas" class="news-back"><span aria-hidden="true">&larr;</span> Komunitas</a>
        <h1 class="clay-section__title">{{ $page->title }}</h1>
        <p class="news-meta">oleh <strong>{{ '@'.$owner->username }}</strong> &middot; {{ number_format($page->views) }} kunjungan
            @if (! $page->isPublished()) &middot; <strong>disembunyikan moderator</strong> @endif</p>
        @if (session('status'))<p class="news-comments__msg" role="status">{{ session('status') }}</p>@endif

        {{-- Untrusted member content: isolated origin/CSP sandbox, no allow-same-origin, no top navigation, modals or fullscreen. --}}
        <div class="member-frame">
            <iframe id="member-frame" title="Halaman {{ $owner->username }}" src="{{ $frameSrc }}"
                sandbox="allow-scripts allow-popups" allow="" referrerpolicy="no-referrer" loading="lazy"
                data-min="320" data-max="8000" style="height:80vh"></iframe>
        </div>

        <div class="member-actions">
            @auth
                @unless ($isOwner)
                    <form method="post" action="/u/{{ $owner->username }}/lapor" class="member-report">
                        @csrf
                        <button class="clay-btn" type="submit">Laporkan halaman</button>
                    </form>
                @endunless
            @endauth
        </div>

        {{-- Trusted comment wall: rendered by the server outside the sandbox; members cannot remove or hide it. --}}
        <section class="clay-card clay-card--lavender news-comments" id="komentar" aria-labelledby="kmt-h">
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
                    <header><strong>{{ '@'.($c->user?->username ?? 'anonim') }}</strong> <time class="news-date" datetime="{{ $c->created_at?->toIso8601String() }}">{{ $c->created_at?->locale('id')->translatedFormat('d F Y H:i') }}</time></header>
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
@endsection

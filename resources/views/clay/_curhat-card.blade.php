{{-- One Curhatan post (site-rendered, all text escaped). Needs: $post, $liked, $previews; optional $showAuthor, $allComments. --}}
@php
    $author = $post->user;
    $isMine = auth()->check() && auth()->id() === $post->user_id;
    $avatar = \App\Services\CurhatanFeed::avatar($author);
    $name = \App\Services\CurhatanFeed::name($author);
    $vis = ['public' => ['🌐', 'Publik'], 'followers' => ['👥', 'Pengikut saja'], 'private' => ['🔒', 'Cuma aku']][$post->visibility] ?? ['🌐', 'Publik'];
    $isLiked = isset($liked[$post->id]);
    $comments = $previews[$post->id] ?? collect();
    $allComments = (bool) ($allComments ?? false);
@endphp
<article class="ch-card" id="curhat-{{ $post->id }}">
    <header class="ch-head">
        <a class="ch-av" href="/u/{{ $author->username }}" tabindex="-1" aria-hidden="true">
            @if ($avatar !== '')
                <img src="{{ $avatar }}" alt="" width="44" height="44" loading="lazy" referrerpolicy="no-referrer">
            @else
                <span>{{ mb_strtoupper(mb_substr($name, 0, 1)) }}</span>
            @endif
        </a>
        <div class="ch-who">
            <a class="ch-name" href="/u/{{ $author->username }}">{{ $name }}</a>
            <span class="ch-meta"><span class="pf-user">{{ '@'.$author->username }}</span> · <a href="{{ $post->url() }}" class="ch-time"><time datetime="{{ $post->created_at?->toIso8601String() }}" title="{{ $post->created_at?->locale('id')->translatedFormat('d F Y H:i') }}">{{ $post->created_at?->locale('id')->diffForHumans() }}</time></a> · <span class="ch-vis" title="{{ $vis[1] }}"><span aria-hidden="true">{{ $vis[0] }}</span> {{ $vis[1] }}</span></span>
        </div>
    </header>
    @if ($post->is_hidden)
        <p class="ch-flag" role="status">Disembunyikan moderator. Hanya kamu yang bisa melihatnya.</p>
    @endif
    @if ($post->body !== '')
        <div class="ch-body">{{ $post->body }}</div>
    @endif
    @if ($post->imageUrl())
        <a class="ch-img" href="{{ $post->imageUrl() }}" target="_blank" rel="noopener"><img src="{{ $post->imageUrl() }}" alt="Gambar dari {{ '@'.$author->username }}" loading="lazy"></a>
    @endif
    <footer class="ch-actions">
        @auth
            <form method="post" action="/curhatan/{{ $post->id }}/suka" class="ch-likeform">@csrf
                <button type="submit" class="ch-act ch-like{{ $isLiked ? ' is-on' : '' }}" aria-pressed="{{ $isLiked ? 'true' : 'false' }}" data-ch-like>
                    <span aria-hidden="true">{{ $isLiked ? '♥' : '♡' }}</span> <span data-ch-count>{{ number_format($post->likes_count) }}</span> <span class="sr-only">suka</span>
                </button>
            </form>
        @else
            <a class="ch-act ch-like" href="/masuk"><span aria-hidden="true">♡</span> {{ number_format($post->likes_count) }} <span class="sr-only">suka, masuk dulu</span></a>
        @endauth
        <a class="ch-act" href="{{ $post->url() }}#komentar-curhat"><span aria-hidden="true">💬</span> {{ number_format($post->comments_count) }} <span class="sr-only">komentar</span></a>
        @auth
            <span class="ch-actions__end">
                @if ($isMine)
                    <form method="post" action="/curhatan/{{ $post->id }}/hapus" data-ch-confirm="Hapus curhatan ini?">@csrf<button type="submit" class="member-link">Hapus</button></form>
                @else
                    <form method="post" action="/curhatan/{{ $post->id }}/lapor" data-ch-confirm="Laporkan curhatan ini ke moderator?">@csrf<button type="submit" class="member-link">Laporkan</button></form>
                @endif
            </span>
        @endauth
    </footer>
    @if ($comments->isNotEmpty() || auth()->check())
        <div class="ch-comments"@if ($allComments) id="komentar-curhat"@endif>
            @if (! $allComments && $post->comments_count > $comments->count())
                <a class="ch-allc" href="{{ $post->url() }}#komentar-curhat">Lihat semua {{ number_format($post->comments_count) }} komentar</a>
            @endif
            @foreach ($comments as $c)
                <div class="ch-c" id="ch-c-{{ $c->id }}">
                    <p><a class="ch-c__who" href="/u/{{ $c->user?->username }}">{{ '@'.($c->user?->username ?? 'anonim') }}</a> {{ $c->body }}</p>
                    @auth
                        <span class="ch-c__tools">
                            <time datetime="{{ $c->created_at?->toIso8601String() }}">{{ $c->created_at?->locale('id')->diffForHumans(null, true) }}</time>
                            @if (auth()->id() === $c->user_id || $isMine)
                                <form method="post" action="/curhatan/komentar/{{ $c->id }}/hapus" data-ch-confirm="Hapus komentar ini?">@csrf<button type="submit" class="member-link">Hapus</button></form>
                            @else
                                <form method="post" action="/curhatan/komentar/{{ $c->id }}/lapor" data-ch-confirm="Laporkan komentar ini?">@csrf<button type="submit" class="member-link">Laporkan</button></form>
                            @endif
                        </span>
                    @endauth
                </div>
            @endforeach
            @auth
                @unless ($post->is_hidden)
                    <form class="ch-cform" method="post" action="/curhatan/{{ $post->id }}/komentar">@csrf
                        <label class="sr-only" for="chc-{{ $post->id }}">Tulis komentar</label>
                        <input class="clay-input" id="chc-{{ $post->id }}" name="body" maxlength="{{ \App\Models\MemberPostComment::MAX_CHARS }}" required placeholder="Tulis komentar…" autocomplete="off">
                        <button class="clay-btn clay-btn--primary" type="submit">Kirim</button>
                    </form>
                @endunless
            @endauth
        </div>
    @endif
</article>

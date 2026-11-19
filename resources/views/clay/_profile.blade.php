@php
    $css = \App\Services\ProfileConfig::css($config);
    $theme = $config['theme'];
    $font = $theme['font'];
    $selfFonts = ['Nunito', 'Baloo 2'];
    $widgets = $config['widgets'];
    $p = $config['profile'];
    $hasHtml = trim((string) ($customHtml ?? '')) !== '';
    $edit = (bool) ($edit ?? false);
    // Autoplay never runs in the editor preview. Target: the mp3 player if there is one, else the first YouTube/Spotify widget.
    $autoplay = ! $edit && ! empty($config['music']['autoplay']);
    $hasMp3 = $config['music']['url'] !== '' && in_array('music', array_column($widgets, 'type'), true);
    $apTarget = null;
    if ($autoplay) {
        foreach ($widgets as $aw) {
            if ($hasMp3 ? $aw['type'] === 'music' : in_array($aw['type'], ['youtube', 'spotify'], true) && ($aw['id'] ?? '') !== '') {
                $apTarget = $aw['type'];
                break;
            }
        }
    }
    $apUsed = false;
    $displayName = ($p['name'] ?? '') !== '' ? $p['name'] : $owner->name;
    /** Inline-edit attributes (edit mode only): which config path a text element writes to, its limit and placeholder. */
    $ie = static fn (string $path, int $max, string $ph, bool $multi = false): string => $edit ? ' data-inline="'.e($path).'" data-max="'.$max.'" data-ph="'.e($ph).'"'.($multi ? ' data-multi="1"' : '') : '';
    $sectionTitles = ['about' => 'Tentang aku', 'status' => 'Status', 'gallery' => 'Galeri', 'links' => 'Tautan', 'counter' => 'Pengunjung', 'music' => 'Musik', 'friends' => 'Top teman', 'quote' => 'Kutipan', 'youtube' => 'Video', 'spotify' => 'Spotify', 'custom_html' => 'Halaman kustom'];
@endphp
@unless (in_array($font, $selfFonts, true))
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family={{ str_replace(' ', '+', $font) }}:wght@400;700&amp;display=swap">
@endunless
<div class="pf {{ $theme['bg']['fixed'] ? 'pf--fixed' : '' }} {{ $css['cursor'] !== '' ? 'pf--cursor' : '' }}" style="{{ $css['vars'] }}{{ $css['cursor'] }}"@if ($apTarget) data-autoplay="{{ $apTarget }}" data-owner="{{ $owner->username }}"@endif>
    <div class="pf-bg" style="{{ $css['bg'] }}" data-theme-color="{{ $theme['bg']['color'] }}" aria-hidden="true"@if ($edit) data-edit="bg"@endif></div>
    <div class="pf-inner">
        <header class="pf-card pf-head"@if ($edit) data-edit="head" data-fixed="1"@endif>
            @if ($edit)<span class="pf-avwrap">@endif
            @if ($p['avatar'] !== '')
                <img class="pf-avatar" src="{{ $p['avatar'] }}" alt="Foto {{ $displayName }}" width="112" height="112" referrerpolicy="no-referrer" loading="lazy">
            @else
                <span class="pf-avatar pf-avatar--ph" aria-hidden="true">{{ mb_strtoupper(mb_substr($displayName, 0, 1)) }}</span>
            @endif
            @if ($edit)<button type="button" class="le-avplus" data-avatar-upload aria-label="Ganti foto profil"><span aria-hidden="true">+</span></button></span>@endif
            <div class="pf-head__text">
                <h1{!! $ie('profile.name', 60, $owner->name) !!}>{{ $edit ? ($p['name'] ?? '') : $displayName }}</h1>
                <p class="pf-user">{{ '@'.$owner->username }}</p>
                @if ($p['tagline'] !== '' || $edit)<p class="pf-tagline"{!! $ie('profile.tagline', 80, 'Tulis tagline…') !!}>{{ $p['tagline'] }}</p>@endif
                @if (isset($followersCount))
                    {{-- One stats row (always shown): followers, following, unique visitors + the follow button. --}}
                    <div class="pf-stats">
                        <a class="pf-stat" href="/u/{{ $owner->username }}/pengikut"><strong>{{ number_format($followersCount) }}</strong> <span>Pengikut</span></a>
                        <a class="pf-stat" href="/u/{{ $owner->username }}/mengikuti"><strong>{{ number_format($followingCount ?? 0) }}</strong> <span>Mengikuti</span></a>
                        <span class="pf-stat" title="Pengunjung unik"><strong>{{ number_format($views) }}</strong> <span>Pengunjung</span></span>
                        @unless ($edit)
                            @auth
                                @if (auth()->id() !== $owner->id)
                                    @if (! empty($isFollowing))
                                        <form method="post" action="/u/{{ $owner->username }}/berhenti-mengikuti" class="pf-stats__act">@csrf<button class="clay-btn clay-btn--secondary pf-follow" type="submit">Berhenti mengikuti</button></form>
                                    @else
                                        <form method="post" action="/u/{{ $owner->username }}/ikuti" class="pf-stats__act">@csrf<button class="clay-btn clay-btn--primary pf-follow" type="submit">Ikuti</button></form>
                                    @endif
                                @endif
                            @else
                                <a class="clay-btn clay-btn--primary pf-follow pf-stats__act" href="/masuk?next=/u/{{ $owner->username }}">Masuk untuk mengikuti</a>
                            @endauth
                        @endunless
                    </div>
                @endif
            </div>
        </header>

        <div class="pf-grid" style="{{ \App\Services\ProfileConfig::layoutCss($config) }}"@if ($edit) data-edit="layout"@endif>
            @foreach ($widgets as $w)
                @php
                    $type = $w['type'];
                    $wide = in_array($type, \App\Services\ProfileConfig::WIDE_TYPES, true);
                    $wpct = \App\Services\ProfileConfig::widthOf($w);
                    if ($type === 'custom_html' && ! $hasHtml) { continue; }
                @endphp
                <section style="--w:{{ $wpct }}" class="pf-card pf-w pf-w--{{ $type }} {{ $wide ? 'pf-w--wide' : '' }}" aria-label="{{ $w['title'] ?? $sectionTitles[$type] }}"@if ($edit) data-edit="w:{{ $loop->index }}" data-type="{{ $type }}"@endif>
                    @if ($type !== 'custom_html')<h2{!! $ie('widgets.'.$loop->index.'.title', 60, $sectionTitles[$type]) !!}>{{ $edit ? ($w['title'] ?? '') : ($w['title'] ?? $sectionTitles[$type]) }}</h2>@endif
                    @switch($type)
                        @case('about')
                            @if ($edit)<p class="pf-text"{!! $ie('profile.about', 1200, 'Ceritakan dirimu…', true) !!}>{{ $p['about'] }}</p>
                            @elseif ($p['about'] !== '')<p class="pf-text">{!! nl2br(e($p['about'])) !!}</p>@else<p class="pf-muted">Belum ada cerita.</p>@endif
                            @break
                        @case('status')
                            @if ($edit)<p class="pf-status"{!! $ie('profile.status', 140, 'Lagi apa hari ini?') !!}>{{ $p['status'] }}</p>
                            @elseif ($p['status'] !== '')<p class="pf-status">{{ $p['status'] }}</p>@else<p class="pf-muted">Belum ada status.</p>@endif
                            @break
                        @case('counter')
                            <p class="pf-counter" aria-label="{{ number_format($views) }} kunjungan">{{ str_pad((string) min($views, 999999), 6, '0', STR_PAD_LEFT) }}</p>
                            @break
                        @case('links')
                            <ul class="pf-links">@forelse ($w['items'] ?? [] as $it)<li><a href="{{ $it['url'] }}" target="_blank" rel="noopener noreferrer nofollow ugc">{{ $it['label'] }}</a></li>@empty<li class="pf-muted">Belum ada tautan.</li>@endforelse</ul>
                            @break
                        @case('gallery')
                            <div class="pf-gallery">@forelse ($w['items'] ?? [] as $it)<figure><img src="{{ $it['url'] }}" alt="{{ $it['caption'] !== '' ? $it['caption'] : 'Foto galeri' }}" loading="lazy" referrerpolicy="no-referrer">@if ($it['caption'] !== '')<figcaption>{{ $it['caption'] }}</figcaption>@endif</figure>@empty<p class="pf-muted">Belum ada foto.</p>@endforelse</div>
                            @break
                        @case('music')
                            @if ($config['music']['url'] !== '')
                                <p class="pf-music-title"{!! $ie('music.title', 80, 'Lagu pilihanku') !!}>{{ $edit ? $config['music']['title'] : ($config['music']['title'] !== '' ? $config['music']['title'] : 'Lagu pilihanku') }}</p>
                                @php $ap = $apTarget === 'music' && ! $apUsed; if ($ap) { $apUsed = true; } @endphp
                                <audio class="pf-audio" controls preload="{{ $ap ? 'auto' : 'none' }}" src="{{ $config['music']['url'] }}"@if ($ap) data-ap="1"@endif></audio>
                                @unless ($ap)<p class="pf-muted">Tekan putar untuk mendengarkan.</p>@endunless
                            @else<p class="pf-muted">Belum ada lagu.</p>@endif
                            @break
                        @case('friends')
                            <ul class="pf-friends">@forelse ($w['items'] ?? [] as $it)
                                <li>@if (isset($friendPages[$it['username']]))<a href="/u/{{ $it['username'] }}">{{ '@'.$it['username'] }}</a>@else<span>{{ '@'.$it['username'] }}</span>@endif</li>
                            @empty<li class="pf-muted">Belum ada teman.</li>@endforelse</ul>
                            @break
                        @case('quote')
                            @if ($edit)
                                <blockquote class="pf-quote"><p{!! $ie('widgets.'.$loop->index.'.text', 300, 'Tulis kutipan favoritmu…', true) !!}>{{ $w['text'] ?? '' }}</p><footer>— <span{!! $ie('widgets.'.$loop->index.'.author', 60, 'Penulis') !!}>{{ $w['author'] ?? '' }}</span></footer></blockquote>
                            @else
                                <blockquote class="pf-quote"><p>{{ $w['text'] ?? '' }}</p>@if (($w['author'] ?? '') !== '')<footer>— {{ $w['author'] }}</footer>@endif</blockquote>
                            @endif
                            @break
                        @case('youtube')
                            @if (($w['id'] ?? '') !== '')
                                @php $ap = $apTarget === 'youtube' && ! $apUsed; if ($ap) { $apUsed = true; } @endphp
                                <div class="pf-yt"><iframe src="https://www.youtube-nocookie.com/embed/{{ $w['id'] }}{{ $ap ? '?autoplay=1&enablejsapi=1&playsinline=1' : '' }}" title="Video YouTube" loading="{{ $ap ? 'eager' : 'lazy' }}" referrerpolicy="strict-origin-when-cross-origin" sandbox="allow-scripts allow-same-origin allow-presentation" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen @if ($ap) data-ap="yt"@endif></iframe></div>
                            @else<p class="pf-muted">Video belum diatur.</p>@endif
                            @break
                        @case('spotify')
                            @if (($w['id'] ?? '') !== '')
                                @php $ap = $apTarget === 'spotify' && ! $apUsed; if ($ap) { $apUsed = true; } @endphp
                                <div class="pf-sp"><iframe src="https://open.spotify.com/embed/{{ $w['kind'] }}/{{ $w['id'] }}{{ $ap ? '?autoplay=1' : '' }}"@if ($ap) data-ap="sp"@endif title="Pemutar Spotify" width="100%" height="{{ ! empty($w['compact']) ? 152 : 352 }}" style="border:0;border-radius:12px" loading="lazy" referrerpolicy="strict-origin-when-cross-origin" sandbox="allow-scripts allow-same-origin allow-popups allow-presentation" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" allowfullscreen></iframe></div>
                            @else<p class="pf-muted">Spotify belum diatur.</p>@endif
                            @break
                        @case('custom_html')
                            @if (! empty($frameSrc))
                                {{-- Untrusted member HTML: isolated origin + CSP sandbox, no allow-same-origin. --}}
                                <div class="pf-frame">
                                    <iframe id="member-frame" title="Widget kustom" src="{{ $frameSrc }}" sandbox="allow-scripts allow-popups" allow="" referrerpolicy="no-referrer" loading="lazy" data-min="120" data-max="8000" style="height:320px"></iframe>
                                </div>
                            @else<p class="pf-muted">Widget kustom tampil setelah draft dibuat.</p>@endif
                            @break
                    @endswitch
                </section>
            @endforeach
        </div>
    </div>
</div>

@php
    $css = \App\Services\ProfileConfig::css($config);
    $theme = $config['theme'];
    $font = $theme['font'];
    $selfFonts = ['Nunito', 'Baloo 2'];
    $widgets = $config['widgets'];
    $p = $config['profile'];
    $hasHtml = trim((string) ($customHtml ?? '')) !== '';
    $sectionTitles = ['about' => 'Tentang aku', 'status' => 'Status', 'gallery' => 'Galeri', 'links' => 'Tautan', 'counter' => 'Pengunjung', 'music' => 'Musik', 'friends' => 'Top teman', 'quote' => 'Kutipan', 'youtube' => 'Video', 'spotify' => 'Spotify', 'custom_html' => 'Halaman kustom'];
@endphp
@unless (in_array($font, $selfFonts, true))
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family={{ str_replace(' ', '+', $font) }}:wght@400;700&amp;display=swap">
@endunless
<div class="pf {{ $theme['bg']['fixed'] ? 'pf--fixed' : '' }} {{ $css['cursor'] !== '' ? 'pf--cursor' : '' }}" style="{{ $css['vars'] }}{{ $css['cursor'] }}">
    <div class="pf-bg" style="{{ $css['bg'] }}" aria-hidden="true"></div>
    <div class="pf-inner">
        <header class="pf-card pf-head">
            @if ($p['avatar'] !== '')
                <img class="pf-avatar" src="{{ $p['avatar'] }}" alt="Foto {{ $owner->name }}" width="112" height="112" referrerpolicy="no-referrer" loading="lazy">
            @else
                <span class="pf-avatar pf-avatar--ph" aria-hidden="true">{{ mb_strtoupper(mb_substr($owner->name, 0, 1)) }}</span>
            @endif
            <div class="pf-head__text">
                <h1>{{ $owner->name }}</h1>
                <p class="pf-user">{{ '@'.$owner->username }}</p>
                @if ($p['tagline'] !== '')<p class="pf-tagline">{{ $p['tagline'] }}</p>@endif
            </div>
        </header>

        <div class="pf-grid">
            @foreach ($widgets as $w)
                @php
                    $type = $w['type'];
                    $wide = in_array($type, ['gallery', 'youtube', 'spotify', 'custom_html'], true);
                    if ($type === 'custom_html' && ! $hasHtml) { continue; }
                @endphp
                <section class="pf-card pf-w pf-w--{{ $type }} {{ $wide ? 'pf-w--wide' : '' }}" aria-label="{{ $w['title'] ?? $sectionTitles[$type] }}">
                    @if ($type !== 'custom_html')<h2>{{ $w['title'] ?? $sectionTitles[$type] }}</h2>@endif
                    @switch($type)
                        @case('about')
                            @if ($p['about'] !== '')<p class="pf-text">{!! nl2br(e($p['about'])) !!}</p>@else<p class="pf-muted">Belum ada cerita.</p>@endif
                            @break
                        @case('status')
                            @if ($p['status'] !== '')<p class="pf-status">{{ $p['status'] }}</p>@else<p class="pf-muted">Belum ada status.</p>@endif
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
                                <p class="pf-music-title">{{ $config['music']['title'] !== '' ? $config['music']['title'] : 'Lagu pilihanku' }}</p>
                                <audio class="pf-audio" controls preload="none" src="{{ $config['music']['url'] }}"></audio>
                                <p class="pf-muted">Tekan putar untuk mendengarkan.</p>
                            @else<p class="pf-muted">Belum ada lagu.</p>@endif
                            @break
                        @case('friends')
                            <ul class="pf-friends">@forelse ($w['items'] ?? [] as $it)
                                <li>@if (isset($friendPages[$it['username']]))<a href="/u/{{ $it['username'] }}">{{ '@'.$it['username'] }}</a>@else<span>{{ '@'.$it['username'] }}</span>@endif</li>
                            @empty<li class="pf-muted">Belum ada teman.</li>@endforelse</ul>
                            @break
                        @case('quote')
                            <blockquote class="pf-quote"><p>{{ $w['text'] ?? '' }}</p>@if (($w['author'] ?? '') !== '')<footer>— {{ $w['author'] }}</footer>@endif</blockquote>
                            @break
                        @case('youtube')
                            @if (($w['id'] ?? '') !== '')
                                <div class="pf-yt"><iframe src="https://www.youtube-nocookie.com/embed/{{ $w['id'] }}" title="Video YouTube" loading="lazy" referrerpolicy="strict-origin-when-cross-origin" sandbox="allow-scripts allow-same-origin allow-presentation" allow="encrypted-media; picture-in-picture" allowfullscreen></iframe></div>
                            @else<p class="pf-muted">Video belum diatur.</p>@endif
                            @break
                        @case('spotify')
                            @if (($w['id'] ?? '') !== '')
                                <div class="pf-sp"><iframe src="https://open.spotify.com/embed/{{ $w['kind'] }}/{{ $w['id'] }}" title="Pemutar Spotify" width="100%" height="{{ ! empty($w['compact']) ? 152 : 352 }}" style="border:0;border-radius:12px" loading="lazy" referrerpolicy="strict-origin-when-cross-origin" sandbox="allow-scripts allow-same-origin allow-popups allow-presentation" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" allowfullscreen></iframe></div>
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

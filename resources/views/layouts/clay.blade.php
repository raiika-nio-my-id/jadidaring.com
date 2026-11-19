<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="utf-8">
    <meta name="csrf-token" content="{{ csrf_token() }}">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>{{ $metaTitle ?? 'Jadidaring' }}</title>
    <meta name="description" content="{{ $metaDescription ?? 'Platform game web, berita, dan komunitas digital Indonesia yang seru dan ringan.' }}">
    @if(!empty($noindex))<meta name="robots" content="noindex,nofollow">@endif
    @if(!empty($relPrev))<link rel="prev" href="https://{{ config('singlepage.base_domain') }}{{ $relPrev }}">@endif
    @if(!empty($relNext))<link rel="next" href="https://{{ config('singlepage.base_domain') }}{{ $relNext }}">@endif
    <link rel="canonical" href="{{ $canonicalUrl ?? (request()->getScheme() . '://' . config('singlepage.base_domain') . request()->getRequestUri()) }}">

    <meta property="og:title" content="{{ $metaTitle ?? 'Jadidaring' }}">
    <meta property="og:description" content="{{ $metaDescription ?? 'Platform game web, berita, dan komunitas digital Indonesia yang seru dan ringan.' }}">
    <meta property="og:url" content="{{ $canonicalUrl ?? (request()->getScheme() . '://' . config('singlepage.base_domain') . request()->getRequestUri()) }}">
    <meta property="og:type" content="{{ $ogType ?? 'website' }}">
    @isset($ogImage)
        @if($ogImage)
    <meta property="og:image" content="{{ $ogImage }}">
    <meta property="og:image:width" content="1200">
    <meta property="og:image:height" content="630">
    @if(!empty($ogImageType))<meta property="og:image:type" content="{{ $ogImageType }}">@endif
    @if(!empty($ogImageAlt))<meta property="og:image:alt" content="{{ $ogImageAlt }}">
    <meta name="twitter:image:alt" content="{{ $ogImageAlt }}">@endif
    <meta name="twitter:image" content="{{ $ogImage }}">
        @endif
    @endisset
    <meta property="og:site_name" content="Jadidaring">
    <meta name="twitter:card" content="{{ ! empty($ogImage) ? 'summary_large_image' : 'summary' }}">
    <meta name="twitter:title" content="{{ $metaTitle ?? 'Jadidaring' }}">
    <meta name="twitter:description" content="{{ $metaDescription ?? 'Platform game web, berita, dan komunitas digital Indonesia yang seru dan ringan.' }}">

    <link rel="alternate" hreflang="id" href="{{ $canonicalUrl ?? (request()->getScheme() . '://' . config('singlepage.base_domain') . request()->getRequestUri()) }}">
    <link rel="alternate" hreflang="x-default" href="{{ $canonicalUrl ?? (request()->getScheme() . '://' . config('singlepage.base_domain') . request()->getRequestUri()) }}">
    <meta name="theme-color" content="#f4ecff">
    <meta name="mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-title" content="Jadidaring">
    <link rel="alternate" type="application/rss+xml" title="Berita Jadidaring" href="/berita/rss.xml">
    <script type="application/ld+json">{!! json_encode([chr(64).'context' => 'https://schema.org', chr(64).'graph' => [
        ['@type' => 'WebSite', '@id' => 'https://jadidaring.com/#website', 'name' => 'Jadidaring', 'url' => 'https://jadidaring.com/', 'inLanguage' => 'id-ID',
            'publisher' => ['@id' => 'https://jadidaring.com/#org'],
            'potentialAction' => ['@type' => 'SearchAction', 'target' => ['@type' => 'EntryPoint', 'urlTemplate' => 'https://jadidaring.com/berita?q={search_term_string}'], 'query-input' => 'required name=search_term_string']],
        ['@type' => 'Organization', '@id' => 'https://jadidaring.com/#org', 'name' => 'Jadidaring', 'url' => 'https://jadidaring.com/',
            'logo' => ['@type' => 'ImageObject', 'url' => 'https://jadidaring.com/marketing/images/logo-512.png', 'width' => 512, 'height' => 512]],
    ]], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) !!}</script>
    @include('partials.favicons')

    <link rel="preload" as="font" type="font/woff2" href="{{ \App\Support\AssetUrl::to('fonts/nunito-latin.woff2') }}" crossorigin>
    <link rel="preload" as="font" type="font/woff2" href="{{ \App\Support\AssetUrl::to('fonts/baloo2-latin.woff2') }}" crossorigin>

    <style>{!! \App\Support\InlineCss::fonts() !!}{!! \App\Support\InlineCss::clay() !!}</style>
    @include('partials.theme-boot')
    @stack('head')
    @unless (str_contains($__env->yieldContent('bodyclass'), 'is-game-page') || str_contains($__env->yieldContent('bodyclass'), 'is-embed'))
    <link rel="stylesheet" href="{{ \App\Support\AssetUrl::to('css/jd-vt.css') }}">
    @endunless
</head>
<body class="{{ trim($__env->yieldContent('bodyclass')) }}">
    <header class="clay-header">
        <div class="clay-shell">
            <div class="clay-header__bar">
                <a href="/" class="clay-brand" aria-label="Jaring Jadi Daring, beranda">
                    <span class="clay-brand__logo">
                        <img class="clay-logo clay-logo--light" src="{{ \App\Support\AssetUrl::to('marketing/images/logo-mark-light.svg') }}" alt="Jadi Daring" width="36" height="36">
                        <img class="clay-logo clay-logo--dark" src="{{ \App\Support\AssetUrl::to('marketing/images/logo-mark-white.svg') }}" alt="" width="36" height="36" aria-hidden="true">
                    </span>
                    <span class="clay-brand__text"><span class="clay-brand__name">Jaring</span><span class="clay-brand__sub" aria-hidden="true">Jadi Daring</span></span>
                </a>

                <nav class="clay-nav" aria-label="Navigasi Utama">
                    <a href="/berita" class="clay-nav__link" @if(request()->is('berita*')) aria-current="page" @endif>Berita</a>
                    <a href="/game" class="clay-nav__link" @if(request()->is('game*')) aria-current="page" @endif>Game</a>
                    <a href="/komunitas" class="clay-nav__link" @if(request()->is('komunitas*')) aria-current="page" @endif>Komunitas</a>
                    @auth
                        <a href="/u/{{ auth()->user()->username }}" class="clay-nav__link clay-nav__me" title="Masuk sebagai {{ '@'.auth()->user()->username }}" @if(request()->is('akun*') || request()->is('u/'.auth()->user()->username)) aria-current="page" @endif><span class="clay-me__av" aria-hidden="true">{{ mb_strtoupper(mb_substr(auth()->user()->name ?: auth()->user()->username, 0, 1)) }}</span><span class="clay-me__name">{{ auth()->user()->name ?: auth()->user()->username }}</span></a>
                    @else
                        <a href="/masuk" class="clay-nav__link" @if(request()->is('masuk', 'daftar')) aria-current="page" @endif>Masuk</a>
                    @endauth
                </nav>

                <div class="clay-header__actions">
                    @yield('headerActions')
                    @include('partials.theme-toggle')
                </div>
            </div>
        </div>
    </header>

    <main class="clay-main">
        <div class="clay-shell">
            @yield('content')
        </div>
    </main>

    <footer class="clay-footer">
        <div class="clay-shell">
            <div class="clay-footer__links">
                <a href="/tentang">Tentang</a>
                <a href="/kebijakan-redaksi">Kebijakan Redaksi</a>
                <a href="/kebijakan-privasi">Kebijakan Privasi</a>
                <a href="/kontak">Kontak</a>
                <a href="/syarat-ketentuan">Syarat &amp; Ketentuan</a>
                <a href="/berita/rss.xml">RSS</a>
                <a href="/berita">Berita</a>
                <a href="/game">Game</a>
                <a href="/komunitas">Komunitas</a>
            </div>
            <p>&copy; {{ date('Y') }} Jadidaring. Hak cipta dilindungi undang-undang.</p>
        </div>
    </footer>

    <nav class="clay-bottom-nav" aria-label="Navigasi Seluler">
        <a href="/berita" class="clay-bottom-nav__item" @if(request()->is('berita*')) aria-current="page" @endif>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2"></path>
                <path d="M18 14h-8"></path>
                <path d="M15 18h-5"></path>
                <path d="M10 6h8v4h-8V6Z"></path>
            </svg>
            <span>Berita</span>
        </a>
        <a href="/game" class="clay-bottom-nav__item" @if(request()->is('game*')) aria-current="page" @endif>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <line x1="6" y1="12" x2="10" y2="12"></line>
                <line x1="8" y1="10" x2="8" y2="14"></line>
                <line x1="15" y1="13" x2="15.01" y2="13"></line>
                <line x1="18" y1="11" x2="18.01" y2="11"></line>
                <rect x="2" y="6" width="20" height="12" rx="4"></rect>
            </svg>
            <span>Game</span>
        </a>
        <a href="/komunitas" class="clay-bottom-nav__item" @if(request()->is('komunitas*')) aria-current="page" @endif>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                <circle cx="9" cy="7" r="4"></circle>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
            </svg>
            <span>Komunitas</span>
        </a>
        <a href="{{ auth()->check() && auth()->user()->username ? '/u/'.auth()->user()->username : (auth()->check() ? '/akun' : '/masuk') }}" class="clay-bottom-nav__item" @if(auth()->check() && (request()->is('akun*') || request()->is('u/'.auth()->user()->username))) aria-current="page" @endif>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                <circle cx="12" cy="7" r="4"></circle>
            </svg>
            <span>@auth<span class="clay-me__tab">{{ \Illuminate\Support\Str::limit(auth()->user()->name ?: auth()->user()->username, 9, '…') }}</span>@else Akun @endauth</span>
        </a>
    </nav>

    @include('partials.ga4-consent')
    @unless (str_starts_with(request()->getHost(), 'admin.'))
        <script>if('serviceWorker' in navigator){window.addEventListener('load',function(){navigator.serviceWorker.register('/sw.js',{scope:'/'}).catch(function(){});});}</script>
    @endunless
    <script src="{{ \App\Support\AssetUrl::to('js/theme.js') }}" defer></script>
    <script src="{{ \App\Support\AssetUrl::to('js/local-time.js') }}" defer></script>
    <script src="{{ \App\Support\AssetUrl::to('js/jd-filters.js') }}" defer></script>
    @unless (str_contains($__env->yieldContent('bodyclass'), 'is-game-page') || str_contains($__env->yieldContent('bodyclass'), 'is-embed'))
    <script src="{{ \App\Support\AssetUrl::to('js/jd-vt.js') }}" defer></script>
    @endunless
</body>
</html>

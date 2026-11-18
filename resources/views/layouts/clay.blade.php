<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="utf-8">
    <meta name="csrf-token" content="{{ csrf_token() }}">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>{{ $metaTitle ?? 'Jadidaring' }}</title>
    <meta name="description" content="{{ $metaDescription ?? 'Platform game web, berita, dan komunitas digital Indonesia yang seru dan ringan.' }}">
    @if(!empty($noindex))<meta name="robots" content="noindex,nofollow">@endif
    <link rel="canonical" href="{{ $canonicalUrl ?? (request()->getScheme() . '://' . config('singlepage.base_domain') . request()->getRequestUri()) }}">

    <meta property="og:title" content="{{ $metaTitle ?? 'Jadidaring' }}">
    <meta property="og:description" content="{{ $metaDescription ?? 'Platform game web, berita, dan komunitas digital Indonesia yang seru dan ringan.' }}">
    <meta property="og:url" content="{{ $canonicalUrl ?? (request()->getScheme() . '://' . config('singlepage.base_domain') . request()->getRequestUri()) }}">
    <meta property="og:type" content="{{ $ogType ?? 'website' }}">
    @isset($ogImage)
        @if($ogImage)
    <meta property="og:image" content="{{ $ogImage }}">
        @endif
    @endisset
    <meta property="og:site_name" content="Jadidaring">
    <meta name="twitter:card" content="{{ ! empty($ogImage) ? 'summary_large_image' : 'summary' }}">
    <meta name="twitter:title" content="{{ $metaTitle ?? 'Jadidaring' }}">
    <meta name="twitter:description" content="{{ $metaDescription ?? 'Platform game web, berita, dan komunitas digital Indonesia yang seru dan ringan.' }}">

    <link rel="alternate" hreflang="id" href="{{ $canonicalUrl ?? (request()->getScheme() . '://' . config('singlepage.base_domain') . request()->getRequestUri()) }}">
    <link rel="alternate" hreflang="x-default" href="{{ $canonicalUrl ?? (request()->getScheme() . '://' . config('singlepage.base_domain') . request()->getRequestUri()) }}">
    <meta name="theme-color" content="#f4ecff">
    <script type="application/ld+json">{!! json_encode(['@context' => 'https://schema.org', '@type' => 'WebSite', 'name' => 'Jadidaring', 'url' => 'https://jadidaring.com/', 'inLanguage' => 'id-ID'], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) !!}</script>
    <link rel="icon" href="/favicon.ico" sizes="any">
    <link rel="icon" href="{{ \App\Support\AssetUrl::to('marketing/images/favicon.svg') }}" type="image/svg+xml">

    <link rel="preload" as="font" type="font/woff2" href="{{ \App\Support\AssetUrl::to('fonts/nunito-latin.woff2') }}" crossorigin>
    <link rel="preload" as="font" type="font/woff2" href="{{ \App\Support\AssetUrl::to('fonts/baloo2-latin.woff2') }}" crossorigin>

    <style>{!! \App\Support\InlineCss::fonts() !!}{!! \App\Support\InlineCss::clay() !!}</style>
    @include('partials.theme-boot')
    @stack('head')
</head>
<body>
    <header class="clay-header">
        <div class="clay-shell">
            <div class="clay-header__bar">
                <a href="/" class="clay-brand" aria-label="Beranda Jadidaring">
                    <span class="clay-brand__logo">
                        <img src="{{ \App\Support\AssetUrl::to('marketing/images/logo-mark.svg') }}" alt="Jadidaring Logo" width="36" height="36">
                    </span>
                    <span class="clay-brand__name">Jadidaring</span>
                </a>

                <nav class="clay-nav" aria-label="Navigasi Utama">
                    <a href="/berita" class="clay-nav__link" @if(request()->is('berita*')) aria-current="page" @endif>Berita</a>
                    <a href="/game" class="clay-nav__link" @if(request()->is('game*')) aria-current="page" @endif>Game</a>
                    <a href="/komunitas" class="clay-nav__link" @if(request()->is('komunitas*')) aria-current="page" @endif>Komunitas</a>
                    @auth
                        <a href="/akun" class="clay-nav__link" @if(request()->is('akun*')) aria-current="page" @endif>{{ auth()->user()->username ?? auth()->user()->name }}</a>
                    @else
                        <a href="/masuk" class="clay-nav__link" @if(request()->is('masuk', 'daftar')) aria-current="page" @endif>Masuk</a>
                    @endauth
                </nav>

                <div class="clay-header__actions">
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
                <a href="/syarat-ketentuan">Syarat &amp; Ketentuan</a>
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
        <a href="{{ auth()->check() ? '/akun' : '/masuk' }}" class="clay-bottom-nav__item">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                <circle cx="12" cy="7" r="4"></circle>
            </svg>
            <span>Akun</span>
        </a>
    </nav>

    @include('partials.ga4-consent')
    <script src="{{ \App\Support\AssetUrl::to('js/theme.js') }}" defer></script>
</body>
</html>

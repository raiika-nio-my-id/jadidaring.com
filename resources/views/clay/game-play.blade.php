{{-- Git game page (docs/games-in-git.md): site layout with a slim main nav, game document in a same-origin frame below it. --}}
@extends('layouts.clay')

@section('bodyclass', 'is-game-page')

@push('head')
    <script type="application/ld+json">{!! json_encode([chr(64).'context' => 'https://schema.org', chr(64).'graph' => [
        ['@type' => 'VideoGame', '@id' => $canonicalUrl.'#game', 'name' => $game['shortTitle'], 'description' => $game['description'], 'url' => $canonicalUrl,
            'inLanguage' => 'id-ID', 'genre' => 'Casual', 'gamePlatform' => 'Web browser', 'applicationCategory' => 'Game', 'operatingSystem' => 'Any',
            'playMode' => 'MultiPlayer', 'isAccessibleForFree' => true,
            'offers' => ['@type' => 'Offer', 'price' => '0', 'priceCurrency' => 'IDR'],
            'publisher' => ['@id' => 'https://jadidaring.com/#org'], 'isPartOf' => ['@id' => 'https://jadidaring.com/#website']],
        ['@type' => 'BreadcrumbList', 'itemListElement' => [
            ['@type' => 'ListItem', 'position' => 1, 'name' => 'Beranda', 'item' => 'https://jadidaring.com/'],
            ['@type' => 'ListItem', 'position' => 2, 'name' => 'Game', 'item' => 'https://jadidaring.com/game'],
            ['@type' => 'ListItem', 'position' => 3, 'name' => $game['shortTitle'], 'item' => $canonicalUrl]]],
    ]], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_HEX_TAG) !!}</script>
    <style>
        body.is-game-page { height: 100vh; height: 100dvh; min-height: 0; overflow: hidden; }
        .is-game-page .clay-footer, .is-game-page .clay-bottom-nav { display: none !important; }
        .is-game-page .clay-header { flex: none; position: relative; padding: 8px 0; }
        .is-game-page .clay-header .clay-shell, .is-game-page .clay-main > .clay-shell { max-width: none; padding: 0 10px; }
        .is-game-page .clay-header__bar { padding: 4px 6px 4px 14px; gap: 10px; }
        .is-game-page .clay-brand { gap: 8px; }
        .is-game-page .clay-brand__logo { width: 30px; height: 30px; }
        .is-game-page .clay-brand__name { font-size: 20px; }
        .is-game-page .clay-nav__link { min-height: 38px; padding: 6px 14px; }
        .is-game-page .clay-header__actions { gap: 8px; }
        .is-game-page .theme-toggle { min-height: 38px; min-width: 38px; width: 38px; height: 38px; }
        .is-game-page .clay-main { flex: 1 1 auto; min-height: 0; display: flex; padding: 0 0 10px; }
        .is-game-page .clay-main > .clay-shell { flex: 1 1 auto; min-height: 0; display: flex; flex-direction: column; }
        .game-stage { position: relative; flex: 1 1 auto; min-height: 0; overflow: hidden; border-radius: var(--radius-md); background: {{ $game['themeColor'] !== '' ? $game['themeColor'] : '#2f7fd1' }}; box-shadow: var(--clay-out); }
        .game-frame { display: block; width: 100%; height: 100%; border: 0; }
        .game-stage:fullscreen { border-radius: 0; }
        .game-stage:-webkit-full-screen { border-radius: 0; }
        .game-fs .icon-shrink, .game-fs[aria-pressed="true"] .icon-grow { display: none; }
        .game-fs[aria-pressed="true"] .icon-shrink { display: block; }
        .game-stage__exit { position: absolute; z-index: 2; top: max(6px, env(safe-area-inset-top)); left: 50%; transform: translateX(-50%); border: 0; border-radius: var(--radius-pill); padding: 6px 14px; min-height: 36px; background: rgba(20, 16, 40, .62); color: #fff; font: 700 13px/1 var(--font-body); cursor: pointer; }
        .game-stage__exit[hidden] { display: none; }
        .sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0; }
        /* Fallback "fullscreen" where the Fullscreen API is missing (iPhone Safari): hide the nav, frame covers the screen. */
        .is-game-full .clay-header { display: none; }
        .is-game-full .game-stage { position: fixed; inset: 0; z-index: 1000; border-radius: 0; }
        .is-game-full .clay-consent { z-index: 1001; }
        @media (max-width: 767px) {
            .is-game-page .clay-header .clay-shell, .is-game-page .clay-main > .clay-shell { padding: 0 6px; }
            .is-game-page .clay-header { padding: 6px 0; }
            .is-game-page .clay-main { padding-bottom: 6px; }
            .game-stage { border-radius: var(--radius-sm); }
            .is-game-page .clay-consent { bottom: 12px; }
        }
        /* Phones in landscape: thinnest nav so the game keeps its height. */
        @media (max-height: 500px) {
            .is-game-page .clay-header { padding: 4px 0; }
            .is-game-page .clay-header__bar { padding: 2px 4px 2px 10px; }
            .is-game-page .clay-brand__logo { width: 26px; height: 26px; }
            .is-game-page .clay-brand__name { font-size: 18px; }
            .is-game-page .clay-brand__sub { display: none; }
            .is-game-page .clay-nav__link { min-height: 32px; padding: 4px 12px; font-size: 14px; }
            .is-game-page .theme-toggle { min-height: 32px; min-width: 32px; width: 32px; height: 32px; padding: 6px; }
            .is-game-page .clay-main { padding-bottom: 4px; }
            .game-stage { border-radius: var(--radius-sm); }
            .is-game-page .clay-consent { bottom: 8px; }
        }
        /* Back to the game list (replaces the old floating Game Hub link). Press feedback is instant (pointerdown). */
        .game-back { flex: none; display: inline-flex; align-items: center; justify-content: center; text-decoration: none; color: inherit; transition: transform .08s ease, filter .08s ease; -webkit-tap-highlight-color: transparent; touch-action: manipulation; }
        .game-back svg { width: 20px; height: 20px; }
        .game-back:active, .game-back.is-pressed { transform: scale(.88); filter: brightness(.92); }
        .is-game-page .clay-header__bar { padding-left: 6px; }
    </style>
@endpush

@section('headerStart')
    <a href="/game" class="theme-toggle game-back" data-game-back aria-label="Kembali ke daftar game" title="Kembali ke daftar game">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg>
    </a>
@endsection

@section('headerActions')
    <button type="button" class="theme-toggle game-fs" data-game-fs aria-pressed="false" aria-label="Layar penuh" title="Layar penuh">
        <svg class="icon-grow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M16 3h3a2 2 0 0 1 2 2v3"/><path d="M8 21H5a2 2 0 0 1-2-2v-3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/></svg>
        <svg class="icon-shrink" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 8h3a2 2 0 0 0 2-2V3"/><path d="M21 8h-3a2 2 0 0 1-2-2V3"/><path d="M3 16h3a2 2 0 0 1 2 2v3"/><path d="M21 16h-3a2 2 0 0 0-2 2v3"/></svg>
    </button>
@endsection

@section('content')
    <h1 class="sr-only">{{ $game['shortTitle'] }}</h1>
    <p class="sr-only">{{ $game['description'] }} <a href="{{ $termsUrl }}">Syarat &amp; Ketentuan</a></p>
    <div class="game-stage" data-game-stage>
        <iframe class="game-frame" data-game-frame data-src="{{ $playUrl }}" title="{{ $game['shortTitle'] }}" allow="fullscreen; autoplay; microphone" allowfullscreen></iframe>
        <button type="button" class="game-stage__exit" data-game-fs-exit hidden>&#x2715; Keluar layar penuh</button>
    </div>
    <noscript><p>Aktifkan JavaScript untuk bermain {{ $game['shortTitle'] }}.</p></noscript>
    <script>
        (function () {
            var d = document, stage = d.querySelector('[data-game-stage]'), frame = d.querySelector('[data-game-frame]');
            var btn = d.querySelector('[data-game-fs]'), exit = d.querySelector('[data-game-fs-exit]');
            /* #hash (e.g. #gamemaster) is not sent to the server, so hand it to the game here. */
            frame.src = frame.getAttribute('data-src') + (location.hash || '');
            frame.addEventListener('load', function () { try { frame.contentWindow.focus({ preventScroll: true }); } catch (e) {} });
            function nativeEl() { return d.fullscreenElement || d.webkitFullscreenElement || null; }
            function cssOn() { return d.body.classList.contains('is-game-full'); }
            function on() { return !!nativeEl() || cssOn(); }
            function sync() {
                var v = on();
                btn.setAttribute('aria-pressed', v ? 'true' : 'false');
                btn.setAttribute('aria-label', v ? 'Keluar layar penuh' : 'Layar penuh');
                btn.title = v ? 'Keluar layar penuh' : 'Layar penuh';
                exit.hidden = !v;
                stage.setAttribute('data-fs', nativeEl() ? 'native' : (cssOn() ? 'css' : 'off'));
            }
            function fallback() { d.body.classList.add('is-game-full'); sync(); }
            function enter() {
                var req = stage.requestFullscreen || stage.webkitRequestFullscreen;
                if (!req) { fallback(); return; }
                try { var p = req.call(stage); if (p && p.catch) { p.catch(fallback); } } catch (e) { fallback(); }
            }
            function leave() {
                if (nativeEl()) { try { var p = (d.exitFullscreen || d.webkitExitFullscreen).call(d); if (p && p.catch) { p.catch(function () {}); } } catch (e) {} }
                d.body.classList.remove('is-game-full');
                sync();
            }
            btn.addEventListener('click', function () { if (on()) { leave(); } else { enter(); } });
            exit.addEventListener('click', leave);
            d.addEventListener('fullscreenchange', sync);
            d.addEventListener('webkitfullscreenchange', sync);
            d.addEventListener('keydown', function (e) { if (e.key === 'Escape' && cssOn()) { leave(); } });
            sync();

            /* Back: history.back() only when the previous page is this site's game list, else open /game. */
            var back = d.querySelector('[data-game-back]');
            if (back) {
                var press = function () { back.classList.add('is-pressed'); };
                var release = function () { back.classList.remove('is-pressed'); };
                back.addEventListener('pointerdown', press);
                ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (t) { back.addEventListener(t, release); });
                window.addEventListener('pageshow', release);
                back.addEventListener('click', function (e) {
                    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) { return; }
                    var fromList = false;
                    try { var r = new URL(d.referrer); fromList = r.origin === location.origin && /^\/game\/?$/.test(r.pathname); } catch (x) {}
                    if (fromList && history.length > 1) { e.preventDefault(); press(); history.back(); }
                });
            }
        })();
    </script>
@endsection

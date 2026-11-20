{{--
  Self-contained shell for every error page. It must render when the app is half
  broken (500) or in maintenance (503): no session, csrf, auth, database, cache,
  Vite or PHP-served assets. CSS and both logos are inlined from public/; fonts
  are plain static files with a system fallback.
--}}
@php
    $code = (int) ($code ?? 500);
    $accent = $accent ?? 'lavender';
    $mood = $mood ?? 'meh';
    $home = $home ?? \App\Support\ErrorPage::home();
    $readPublic = static function (string $path): string {
        $full = public_path($path);
        return is_file($full) ? (string) @file_get_contents($full) : '';
    };
    $stripSvg = static fn (string $svg): string => preg_replace('/\s(role|aria-label)="[^"]*"/', '', $svg) ?? '';
    $css = $readPublic('css/jd-error.css');
    $logoLight = $stripSvg($readPublic('marketing/images/logo-mark-light.svg'));
    $logoDark = $stripSvg($readPublic('marketing/images/logo-mark-white.svg'));
    $digits = str_split((string) $code);
    $hasZero = in_array('0', $digits, true);
@endphp
<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="robots" content="noindex, nofollow">
<meta name="color-scheme" content="light dark">
<meta name="theme-color" content="#F7F2EC" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#1F1B2E" media="(prefers-color-scheme: dark)">
<title>{{ $code }} · {{ $pageTitle ?? $title }} · Jadidaring</title>
<link rel="icon" href="/favicon.ico">
<script>
(function(){try{var t=localStorage.getItem('jadidaring-theme');if(t==='dark'||t==='light'){document.documentElement.setAttribute('data-theme',t);}}catch(e){}})();
</script>
<style>
@font-face{font-family:"Nunito";font-style:normal;font-weight:400 900;font-display:swap;src:url("/fonts/nunito-latin.woff2") format("woff2")}
@font-face{font-family:"Baloo 2";font-style:normal;font-weight:400 800;font-display:swap;src:url("/fonts/baloo2-latin.woff2") format("woff2")}
{!! $css !!}
</style>
</head>
<body class="ed ed--{{ $accent }}" data-home="{{ $home }}">
<header class="ed-header">
  <div class="ed-shell">
    <div class="ed-bar">
      <a href="{{ $home }}/" class="ed-brand" aria-label="Jaring Jadi Daring, beranda">
        <span class="ed-brand__logo" aria-hidden="true">
          <span class="ed-brand__logo ed-logo--light">{!! $logoLight !!}</span>
          <span class="ed-brand__logo ed-logo--dark">{!! $logoDark !!}</span>
        </span>
        <span class="ed-brand__text"><span class="ed-brand__name">Jaring</span><span class="ed-brand__sub" aria-hidden="true">Jadi Daring</span></span>
      </a>
      <div class="ed-right">
        @unless ($code === 503)
        <nav class="ed-nav" aria-label="Navigasi utama">
          <a href="{{ $home }}/berita">Berita</a>
          <a href="{{ $home }}/game">Game</a>
          <a href="{{ $home }}/komunitas">Komunitas</a>
        </nav>
        @endunless
        <button type="button" class="ed-toggle" data-ed-theme aria-label="Ganti tema terang/gelap">
          <svg class="i-sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4.5"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>
          <svg class="i-moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z"/></svg>
        </button>
      </div>
    </div>
  </div>
</header>

<main class="ed-main" id="konten">
  <div class="ed-shell">
    <div class="ed-stage">
      <div class="ed-art">
        <div class="ed-code" role="img" aria-label="Kode {{ $code }}">
          @foreach ($digits as $d)
            @if ($d === '0')
              <span class="ed-ball">@include('errors._ball', ['mood' => $mood])</span>
            @else
              <span class="ed-digit">{{ $d }}</span>
            @endif
          @endforeach
        </div>
        @unless ($hasZero)
          <span class="ed-ball ed-ball--solo">@include('errors._ball', ['mood' => $mood])</span>
        @endunless
        <span class="ed-chip"><i></i>{{ $chip ?? 'Kode galat '.$code }}</span>
      </div>

      <section class="ed-card" aria-labelledby="ed-title">
        <h1 id="ed-title">{{ $title }}</h1>
        <p class="ed-lead">{{ $lead }}</p>
        @yield('note')
        <div class="ed-actions">
          @yield('actions')
        </div>
        @hasSection('links')
          @yield('links')
        @else
          @unless ($code === 503)
          <nav class="ed-links" aria-label="Tautan cepat">
            <span>Atau mampir ke:</span>
            <a href="{{ $home }}/berita">📰 Berita</a>
            <a href="{{ $home }}/game">🎮 Game</a>
            <a href="{{ $home }}/komunitas">💬 Komunitas</a>
          </nav>
          @endunless
        @endif
      </section>
    </div>
  </div>
</main>

<footer class="ed-foot">
  <div class="ed-shell">© {{ date('Y') }} Jadidaring · Kode galat {{ $code }}</div>
</footer>

<script>
(function(){
  var d=document, root=d.documentElement, home=d.body.getAttribute('data-home')||'/';
  // Instant press feedback on every control.
  d.addEventListener('pointerdown',function(e){var el=e.target.closest('.ed-btn,.ed-links a');if(el){el.classList.add('is-pressing');}},{passive:true});
  ['pointerup','pointercancel','pointerleave'].forEach(function(t){d.addEventListener(t,function(){var p=d.querySelectorAll('.is-pressing');for(var i=0;i<p.length;i++){p[i].classList.remove('is-pressing');}},{passive:true,capture:true});});
  function busy(el){el.classList.add('is-busy');el.setAttribute('aria-busy','true');setTimeout(function(){el.classList.remove('is-busy');el.removeAttribute('aria-busy');},8000);}
  d.addEventListener('click',function(e){
    var el=e.target.closest('[data-ed-theme],[data-ed-back],[data-ed-reload],a.ed-btn');
    if(!el){return;}
    if(el.hasAttribute('data-ed-theme')){
      var dark=root.getAttribute('data-theme')==='dark'||(!root.getAttribute('data-theme')&&window.matchMedia('(prefers-color-scheme: dark)').matches);
      var next=dark?'light':'dark';root.setAttribute('data-theme',next);try{localStorage.setItem('jadidaring-theme',next);}catch(err){}
      return;
    }
    busy(el);
    if(el.hasAttribute('data-ed-back')){e.preventDefault();if(history.length>1&&d.referrer){history.back();}else{location.href=home+'/';}}
    else if(el.hasAttribute('data-ed-reload')){e.preventDefault();location.reload();}
  });
  d.addEventListener('submit',function(e){var b=e.target.querySelector('.ed-btn');if(b){busy(b);}});
  window.addEventListener('pageshow',function(){var b=d.querySelectorAll('.is-busy');for(var i=0;i<b.length;i++){b[i].classList.remove('is-busy');b[i].removeAttribute('aria-busy');}});
})();
</script>
@yield('scripts')
</body>
</html>

<?php

use App\Http\Controllers\CommunityController;
use App\Http\Controllers\StaticAssetController;
use App\Http\Controllers\TenantController;
use App\Http\Middleware\AuthenticateAdminApiKey;
use App\Http\Middleware\BlockBannedUser;
use App\Http\Middleware\EnsurePanelAdmin;
use App\Http\Middleware\GameMemberSession;
use App\Http\Middleware\OptionalSession;
use App\Http\Middleware\PublicCache;
use App\Http\Middleware\ResolveTenantPath;
use App\Http\Middleware\SecureTransport;
use App\Models\CompanyProfile;
use App\Services\TenantPath;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;
use Illuminate\Session\Middleware\StartSession;
use Illuminate\Support\Facades\Route;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;
use Symfony\Component\HttpKernel\Exception\TooManyRequestsHttpException;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        commands: __DIR__.'/../routes/console.php',
        channels: __DIR__.'/../routes/channels.php',
        health: '/up',
        then: function (): void {
            $base = strtolower((string) config('singlepage.base_domain'));
            $www = 'www.'.$base;

            if ((bool) config('singlepage.legacy_admin_host')) {
                Route::middleware('web')
                    ->domain((string) config('singlepage.admin_domain'))
                    ->group(base_path('routes/admin.php'));

                Route::middleware(['api', 'admin.api', 'throttle:admin-api'])
                    ->domain((string) config('singlepage.admin_domain'))
                    ->prefix('api/admin')
                    ->name('api.admin.')
                    ->group(base_path('routes/admin-api.php'));
            } else {
                // The old admin host is retired: everything on it is 404 (no session, no login form).
                // The panel lives at {base}/admin and the key-checked API at {base}/api/admin.
                Route::domain((string) config('singlepage.admin_domain'))
                    ->any('/{any?}', fn () => abort(404))
                    ->where('any', '.*')
                    ->name('legacy-admin.retired');
            }

            // The admin subdomain is retired: the same key-checked admin API is served on the
            // main host too (https://jadidaring.com/api/admin/...). Same middleware, same routes.
            Route::middleware(['api', 'admin.api', 'throttle:admin-api'])
                ->domain($base)
                ->prefix('api/admin')
                ->name('api.admin.main.')
                ->group(base_path('routes/admin-api.php'));

            // Game room/score API. New clients use /game/{tenant}/api/game.
            // /{tenant}/api/game stays on the bare host and www for tabs and
            // clients opened before the move (no redirect, so POSTs survive).
            foreach ([$base => 'bare', $www => 'www'] as $host => $label) {
                Route::middleware([GameMemberSession::class, ResolveTenantPath::class])
                    ->domain($host)
                    ->prefix('{tenant}/api/game')
                    ->where(['tenant' => TenantPath::routePattern()])
                    ->name('path.game.'.$label.'.')
                    ->group(base_path('routes/game.php'));
            }

            Route::middleware([GameMemberSession::class, ResolveTenantPath::class])
                ->domain($base)
                ->prefix('game/{tenant}/api/game')
                ->where(['tenant' => TenantPath::routePattern()])
                ->name('game.api.')
                ->group(base_path('routes/game.php'));

            // www is not a page host: GET/HEAD 301 to the bare domain.
            Route::domain($www)
                ->group(function (): void {
                    Route::match(['GET', 'HEAD'], '/{any?}', function (Request $request) {
                        $target = $request->getScheme().'://'.strtolower((string) config('singlepage.base_domain')).$request->getRequestUri();

                        return redirect()->away($target, 301);
                    })->where('any', '(?!up$).*');
                });

            // The old GameHub host is retired: everything goes to the game catalogue (or the matching game page).
            Route::domain('gamehub.'.$base)->group(function () use ($base): void {
                Route::match(['GET', 'HEAD'], '/{any?}', function (Request $request, ?string $any = null) use ($base) {
                    $slug = strtolower(explode('/', trim((string) $any, '/'))[0] ?? '');
                    $exists = $slug !== '' && preg_match('/^[a-z0-9-]{1,63}$/', $slug) === 1
                        && CompanyProfile::query()->live()->games()->where('subdomain', $slug)->exists();

                    $qs = $request->getQueryString();

                    return redirect()->away('https://'.$base.'/game'.($exists ? '/'.$slug : '').($qs !== null && $qs !== '' ? '?'.$qs : ''), 301);
                })->where('any', '(?!up$).*');
            });

            // Own-host Custom Pages (config singlepage.own_host_pages): {label}.{base} serves the page at /.
            // No web middleware, so no session/CSRF cookies. Other paths (except static files nginx serves) are 404.
            foreach ((array) config('singlepage.own_host_pages', []) as $label) {
                Route::domain($label.'.'.$base)->group(function (): void {
                    Route::get('/', [TenantController::class, 'showOwnHost'])->middleware('throttle:120,1');
                    Route::get('/robots.txt', [TenantController::class, 'ownHostRobots']);
                    Route::get('/sitemap.xml', [TenantController::class, 'ownHostSitemap']);
                    Route::any('/{any}', fn () => abort(404))->where('any', '(?!up$).*');
                });
            }

            // Old client/game subdomains (explicit allowlist in config/old_subdomains.php): 301 to the path
            // on the apex domain. No web middleware, so no session/CSRF cookies. Query string is kept.
            foreach ((array) config('old_subdomains', []) as $sub => $path) {
                Route::domain($sub.'.'.$base)->group(function () use ($path, $base): void {
                    Route::match(['GET', 'HEAD'], '/{any?}', function (Request $request) use ($path, $base) {
                        $qs = $request->getQueryString();

                        return redirect()->away('https://'.$base.$path.($qs !== null && $qs !== '' ? '?'.$qs : ''), 301);
                    })->where('any', '(?!up$).*');
                });
            }

            // Member page content: no session/cookie middleware, sandbox CSP set by the controller.
            Route::domain($base)
                ->get('/u/{username}/konten', [CommunityController::class, 'content'])
                ->where('username', '[a-z0-9_]{3,20}')
                ->middleware('throttle:120,1')
                ->name('community.content');

            if ((string) config('singlepage.sandbox_domain') !== '') {
                Route::domain((string) config('singlepage.sandbox_domain'))
                    ->get('/', fn () => redirect()->away('https://'.strtolower((string) config('singlepage.base_domain')), 301));

                Route::domain((string) config('singlepage.sandbox_domain'))
                    ->get('/{username}', [CommunityController::class, 'content'])
                    ->where('username', '[a-z0-9_]{3,20}')
                    ->middleware('throttle:120,1');
            }

            // One-time-key draft API: no session, no cookies, CORS-open, creates drafts only.
            Route::domain($base)
                ->match(['POST', 'OPTIONS'], '/api/komunitas/draft', [CommunityController::class, 'apiDraft'])
                ->middleware('throttle:30,1')
                ->name('community.api.draft');

            // Session-less static assets with immutable caching (independent of nginx rules).
            Route::domain($base)
                ->get('/a/{path}', StaticAssetController::class)
                ->where('path', '.*')
                ->name('assets');

            // Web admin panel (/admin) on the public host; admins only (EnsurePanelAdmin + access-admin-panel gate).
            Route::middleware('web')
                ->domain($base)
                ->group(base_path('routes/panel.php'));

            Route::middleware('web')
                ->domain($base)
                ->group(base_path('routes/clay.php'));

            // Client sites (non-game profiles) stay at /{tenant}/. Game pages
            // under /{tenant}/ are 404 now; they live at /game/{slug}.
            Route::middleware(['web', ResolveTenantPath::class])
                ->domain($base)
                ->name('path.')
                ->group(base_path('routes/tenant-path.php'));
        },
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->appendToPriorityList(StartSession::class, OptionalSession::class);
        $middleware->trustProxies(
            at: '*',
            headers: Request::HEADER_X_FORWARDED_FOR
                | Request::HEADER_X_FORWARDED_HOST
                | Request::HEADER_X_FORWARDED_PORT
                | Request::HEADER_X_FORWARDED_PROTO,
        );

        $middleware->prepend(SecureTransport::class);
        // Outermost after SecureTransport: strips Set-Cookie from file-like URLs the proxy caches.
        $middleware->prepend(\App\Http\Middleware\NoCookiesOnAssets::class);

        $isAdminHost = static fn (Request $request): bool => strtolower($request->getHost()) === strtolower((string) config('singlepage.admin_domain'));

        $middleware->redirectGuestsTo(fn (Request $request) => $isAdminHost($request) ? route('login') : route('member.login'));
        $middleware->redirectUsersTo(fn (Request $request) => $isAdminHost($request) ? route('home') : route('member.account'));

        $middleware->alias([
            'admin.api' => AuthenticateAdminApiKey::class,
            'public.cache' => PublicCache::class,
            'panel.admin' => EnsurePanelAdmin::class,
        ]);
        $middleware->appendToGroup('web', BlockBannedUser::class);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->shouldRenderJsonWhen(
            fn (Request $request) => $request->is('api/*') || $request->expectsJson(),
        );

        $exceptions->render(function (TooManyRequestsHttpException $e, Request $request) {
            if ($request->expectsJson() || $request->is('api/*') || $request->is('*/api/game/*')) {
                return null;
            }

            $wait = (int) ($e->getHeaders()['Retry-After'] ?? 30);
            $msg = 'Terlalu banyak permintaan dalam waktu singkat. Tunggu sekitar '.max(1, $wait).' detik lalu coba lagi.';

            if ($request->is('komunitas/*') && ! $request->isMethod('GET') && ! $request->isMethod('HEAD') && $request->hasSession()) {
                return redirect()->back(fallback: '/')->withInput($request->except(['password', 'password_confirmation', 'file']))->withErrors(['throttle' => $msg]);
            }

            return response()->view('errors.429', ['retryAfter' => $wait, 'exception' => $e], 429, ['Retry-After' => (string) $wait]);
        });

        // Error pages (resources/views/errors) must never be indexed.
        $exceptions->respond(function ($response) {
            if ($response instanceof \Symfony\Component\HttpFoundation\Response && $response->getStatusCode() >= 400) {
                $response->headers->set('X-Robots-Tag', 'noindex, nofollow');
            }

            return $response;
        });

        $exceptions->render(function (NotFoundHttpException $exception, Request $request) {
            if ($request->is('api/admin/*')) {
                return response()->json(['message' => 'Client not found.'], 404);
            }
        });
    })->create();

<?php

use App\Http\Middleware\AuthenticateAdminApiKey;
use App\Http\Middleware\GameMemberSession;
use App\Http\Middleware\ResolveTenantPath;
use App\Services\TenantPath;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        commands: __DIR__.'/../routes/console.php',
        channels: __DIR__.'/../routes/channels.php',
        health: '/up',
        then: function (): void {
            $base = strtolower((string) config('singlepage.base_domain'));
            $www = 'www.'.$base;

            Route::middleware('web')
                ->domain((string) config('singlepage.admin_domain'))
                ->group(base_path('routes/admin.php'));

            Route::middleware(['api', 'admin.api', 'throttle:admin-api'])
                ->domain((string) config('singlepage.admin_domain'))
                ->prefix('api/admin')
                ->name('api.admin.')
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
            Route::middleware('web')
                ->domain($www)
                ->group(function (): void {
                    Route::match(['GET', 'HEAD'], '/{any?}', function (Request $request) {
                        $target = $request->getScheme().'://'.strtolower((string) config('singlepage.base_domain')).$request->getRequestUri();

                        return redirect()->away($target, 301);
                    })->where('any', '(?!up$).*');
                });

            // Session-less static assets with immutable caching (independent of nginx rules).
            Route::domain($base)
                ->get('/a/{path}', \App\Http\Controllers\StaticAssetController::class)
                ->where('path', '.*')
                ->name('assets');

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
        $middleware->trustProxies(
            at: '*',
            headers: Request::HEADER_X_FORWARDED_FOR
                | Request::HEADER_X_FORWARDED_HOST
                | Request::HEADER_X_FORWARDED_PORT
                | Request::HEADER_X_FORWARDED_PROTO,
        );

        $isAdminHost = static fn (Request $request): bool => strtolower($request->getHost()) === strtolower((string) config('singlepage.admin_domain'));

        $middleware->redirectGuestsTo(fn (Request $request) => $isAdminHost($request) ? route('login') : route('member.login'));
        $middleware->redirectUsersTo(fn (Request $request) => $isAdminHost($request) ? route('home') : route('member.account'));

        $middleware->alias([
            'admin.api' => AuthenticateAdminApiKey::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->shouldRenderJsonWhen(
            fn (Request $request) => $request->is('api/*') || $request->expectsJson(),
        );

        $exceptions->render(function (NotFoundHttpException $exception, Request $request) {
            if ($request->is('api/admin/*')) {
                return response()->json(['message' => 'Client not found.'], 404);
            }
        });
    })->create();

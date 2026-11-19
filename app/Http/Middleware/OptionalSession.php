<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Session\Middleware\StartSession;
use Illuminate\View\Middleware\ShareErrorsFromSession;

/**
 * Starts the session only when the visitor already carries a session cookie.
 * Anonymous visitors on public pages never get a session or cookies, which is
 * what makes those responses safe for shared caches.
 *
 * Deliberately NOT a StartSession subclass: Route::withoutMiddleware(StartSession::class)
 * also excludes subclasses, which silently dropped this middleware and made logged-in
 * users see the guest page.
 */
class OptionalSession
{
    public function __construct(private StartSession $start, private ShareErrorsFromSession $share) {}

    public function handle($request, Closure $next)
    {
        if (! $request->cookies->has(config('session.cookie'))) {
            return $next($request);
        }

        return $this->start->handle($request, fn ($req) => $this->share->handle($req, $next));
    }
}

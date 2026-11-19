<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Session\Middleware\StartSession;

/**
 * Starts the session only when the visitor already carries a session cookie.
 * Anonymous visitors on public pages never get a session or cookies, which is
 * what makes those responses safe for shared caches.
 */
class OptionalSession extends StartSession
{
    public function handle($request, Closure $next)
    {
        if (! $request->cookies->has(config('session.cookie'))) {
            return $next($request);
        }

        return parent::handle($request, $next);
    }
}

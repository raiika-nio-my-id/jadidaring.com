<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Cookie\Middleware\EncryptCookies;
use Illuminate\Http\Request;
use Illuminate\Pipeline\Pipeline;
use Illuminate\Session\Middleware\StartSession;
use Symfony\Component\HttpFoundation\Response;

/**
 * Game API routes have no session. When a visitor already carries the session
 * cookie (a logged-in member), start it so the controller can see the login;
 * anonymous callers skip it, so they never create a session row.
 */
class GameMemberSession
{
    public function handle(Request $request, Closure $next): Response
    {
        if (! $request->cookies->has((string) config('session.cookie'))) {
            return $next($request);
        }

        return app(Pipeline::class)
            ->send($request)
            ->through([EncryptCookies::class, StartSession::class, BlockBannedUser::class])
            ->then($next);
    }
}

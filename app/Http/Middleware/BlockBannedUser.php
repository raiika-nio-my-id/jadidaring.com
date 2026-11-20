<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;

/** A member blocked in /admin is logged out on their next request, whichever way they signed in. */
class BlockBannedUser
{
    public const MESSAGE = 'Akun ini diblokir oleh admin.';

    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if ($user !== null && method_exists($user, 'isBanned') && $user->isBanned()) {
            $message = method_exists($user, 'banMessage') ? $user->banMessage() : self::MESSAGE;
            Auth::guard('web')->logout();

            if ($request->hasSession()) {
                $request->session()->invalidate();
                $request->session()->regenerateToken();
            }

            if ($request->expectsJson() || $request->is('*/api/*') || $request->is('api/*')) {
                return response()->json(['message' => $message], 403);
            }

            return redirect('/masuk')->withErrors(['login' => $message]);
        }

        return $next($request);
    }
}

<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Guards every /admin panel route on the public host: guests go to the admin login, logged-in non-admins get 403.
 * Responses are never cached and never indexed.
 */
class EnsurePanelAdmin
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if ($user === null) {
            if ($request->expectsJson()) {
                abort(401);
            }

            return redirect()->guest(route('panel.login'));
        }

        abort_unless($user->can('access-admin-panel'), 403, 'Halaman ini khusus admin.');

        $response = $next($request);
        $response->headers->set('Cache-Control', 'no-store, private');
        $response->headers->set('X-Robots-Tag', 'noindex, nofollow');
        $response->headers->set('X-Frame-Options', 'DENY');

        return $response;
    }
}

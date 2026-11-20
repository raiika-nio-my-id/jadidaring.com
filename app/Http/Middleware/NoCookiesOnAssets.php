<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Never send Set-Cookie on a file-like URL (/sw.js, *.css, *.webp, *.webmanifest ...).
 *
 * Nginx Proxy Manager caches such URLs for every visitor (including the response headers),
 * so a session cookie on one of them was replayed to everybody: the browser's service-worker
 * check of /sw.js overwrote a fresh login session with a shared anonymous one, and the next
 * page asked to log in again unless "Ingat saya" was ticked. Runs outermost, after the web
 * group has queued its cookies.
 */
class NoCookiesOnAssets
{
    public const PATTERN = '/\.(?:css|m?js|map|svg|png|jpe?g|webp|avif|gif|ico|woff2?|ttf|webmanifest|json|txt|xml)$/i';

    public function handle(Request $request, Closure $next): Response
    {
        $response = $next($request);

        if (preg_match(self::PATTERN, $request->getPathInfo()) === 1) {
            foreach ($response->headers->getCookies() as $cookie) {
                $response->headers->removeCookie($cookie->getName(), $cookie->getPath(), $cookie->getDomain());
            }
        }

        return $response;
    }
}

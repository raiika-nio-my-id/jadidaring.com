<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Shared-cache headers for anonymous GET/HEAD responses of public pages.
 * Anything with a session/auth cookie, a Set-Cookie header or a non-200 status keeps the framework's private defaults.
 */
class PublicCache
{
    public function handle(Request $request, Closure $next, int $maxAge = 60, int $sMaxAge = 300): Response
    {
        $response = $next($request);

        if (! in_array($request->method(), ['GET', 'HEAD'], true)
            || $this->hasIdentityCookie($request)
            || $response->getStatusCode() !== 200
            || $response->headers->has('Set-Cookie')
            || $response->headers->has('X-No-Public-Cache')) {
            return $response;
        }

        $response->headers->set('Cache-Control', "public, max-age=0, s-maxage={$sMaxAge}, stale-while-revalidate=600, stale-if-error=3600");
        $response->headers->set('Vary', 'Accept-Encoding, Cookie');

        if ($request->isMethod('GET') && ! $response->headers->has('ETag') && ! $response instanceof \Symfony\Component\HttpFoundation\StreamedResponse && ! $response instanceof \Symfony\Component\HttpFoundation\BinaryFileResponse) {
            $response->setEtag(md5((string) $response->getContent()));
        }

        $response->isNotModified($request);

        return $response;
    }

    private function hasIdentityCookie(Request $request): bool
    {
        if ($request->cookies->has(config('session.cookie')) || $request->cookies->has('XSRF-TOKEN')) {
            return true;
        }
        foreach (array_keys($request->cookies->all()) as $name) {
            if (str_starts_with((string) $name, 'remember_web_')) {
                return true;
            }
        }

        return false;
    }
}

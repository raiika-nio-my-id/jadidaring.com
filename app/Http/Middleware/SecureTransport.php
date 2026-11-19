<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Sends plain-http requests that the front proxy explicitly marks as http to https (301)
 * and adds HSTS on https responses. No includeSubDomains/preload on purpose.
 */
class SecureTransport
{
    public function handle(Request $request, Closure $next): Response
    {
        $proto = strtolower((string) $request->headers->get('X-Forwarded-Proto'));

        if ($proto === 'http' && in_array($request->method(), ['GET', 'HEAD'], true) && ! app()->environment('testing', 'local') && $request->path() !== 'up') {
            return redirect()->away('https://'.$request->getHost().$request->getRequestUri(), 301);
        }

        $response = $next($request);

        if ($proto === 'https' || $request->isSecure()) {
            $response->headers->set('Strict-Transport-Security', 'max-age=31536000');
        }

        return $response;
    }
}

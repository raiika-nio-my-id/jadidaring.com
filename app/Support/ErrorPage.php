<?php

namespace App\Support;

/**
 * Helpers for resources/views/errors/*. They must work when the app is half
 * broken, so they only read config and the request; never the DB, cache or session.
 */
final class ErrorPage
{
    /** Absolute homepage URL on the main host, so links from other hosts never loop. */
    public static function home(): string
    {
        try {
            $domain = trim((string) config('singlepage.base_domain', ''));
            $scheme = request()->getScheme() === 'http' ? 'http' : 'https';
        } catch (\Throwable) {
            $domain = '';
            $scheme = 'https';
        }

        return $scheme.'://'.($domain !== '' ? $domain : 'jadidaring.com');
    }
}

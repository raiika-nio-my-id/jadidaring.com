<?php

namespace App\Support;

/**
 * Server-side GA4 events: queued in the session on a redirecting action and
 * emitted by the next page through window.jdTrack (which honours consent).
 * Only scalar params are kept; never pass usernames, emails or free text.
 */
class Ga4
{
    private const KEY = 'ga4_events';

    /** @param array<string, string|int|float|bool> $params */
    public static function flash(string $name, array $params = []): void
    {
        if (! app()->bound('session.store') || ! request()->hasSession()) {
            return;
        }

        $clean = [];
        foreach ($params as $k => $v) {
            if (preg_match('/^[a-z][a-z0-9_]{0,39}$/', (string) $k) === 1 && is_scalar($v)) {
                $clean[$k] = is_string($v) ? mb_substr($v, 0, 100) : $v;
            }
        }

        if (preg_match('/^[a-z][a-z0-9_]{0,39}$/', $name) !== 1) {
            return;
        }

        request()->session()->push(self::KEY, [$name, (object) $clean]);
    }

    /** @return list<array{0: string, 1: object}> */
    public static function pull(): array
    {
        if (! request()->hasSession() || ! request()->session()->isStarted()) {
            return [];
        }

        $events = request()->session()->pull(self::KEY, []);

        return is_array($events) ? array_values($events) : [];
    }
}

<?php

namespace App\Services;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;

/**
 * Rust realtime engine (realtime/): the WebSocket fan-out for game rooms.
 *
 * Laravel and the Rust service share only APP_KEY. Every sub-key is an HMAC of a
 * fixed label, so no extra secret is stored in .env, the repo, HTML or URLs.
 * Browsers get a join token (5 min, signed, scoped to one game and one account)
 * from the config endpoint, never from the page source.
 *
 * Games switch per slug (GAME_RUST_GAMES). Anything not listed, or any game while
 * the Rust service is down, stays on Reverb.
 */
class Realtime
{
    public const TOKEN_TTL = 300;

    private static function root(): string
    {
        return (string) config('app.key');
    }

    public static function derive(string $label): string
    {
        return hash_hmac('sha256', $label, self::root());
    }

    public static function key(): string
    {
        return substr(self::derive('rt-key'), 0, 20);
    }

    public static function secret(): string
    {
        return self::derive('rt-pusher');
    }

    public static function token(string $slug, int $userId = 0, ?int $now = null): string
    {
        $msg = 'v1.'.(($now ?? time()) + self::TOKEN_TTL).'.'.$userId.'.'.$slug;

        return $msg.'.'.hash_hmac('sha256', $msg, self::derive('rt-join'));
    }

    /** @return array<int, string> */
    public static function games(): array
    {
        $list = config('singlepage.rust_games');
        $list = is_array($list) ? $list : explode(',', (string) $list);

        return array_values(array_filter(array_map(fn ($s) => strtolower(trim((string) $s)), $list)));
    }

    public static function healthy(): bool
    {
        if (! config('singlepage.realtime_enabled')) {
            return false;
        }

        return Cache::remember('realtime.healthy', 10, function (): bool {
            try {
                return Http::timeout(1)->get('http://'.config('singlepage.realtime_host').'/health')->json('ok') === true;
            } catch (\Throwable) {
                return false;
            }
        });
    }

    public static function engine(string $slug): string
    {
        return in_array(strtolower($slug), self::games(), true) && self::healthy() ? 'rust' : 'reverb';
    }

    public static function connectionFor(string $slug): ?string
    {
        return self::engine($slug) === 'rust' ? 'rust' : config('broadcasting.default');
    }
}

<?php

namespace App\Services;

/** Short-lived HMAC token binding a member page id to an expiry, minted only by the trusted profile page. */
class MemberFrameToken
{
    public const TTL = 300;

    public static function mint(int $pageId, ?int $now = null): string
    {
        $payload = $pageId.'.'.(($now ?? time()) + self::TTL);

        return $payload.'.'.self::sig($payload);
    }

    public static function valid(?string $token, int $pageId, ?int $now = null): bool
    {
        if (! is_string($token) || substr_count($token, '.') !== 2) {
            return false;
        }

        [$id, $exp, $sig] = explode('.', $token);
        $payload = $id.'.'.$exp;

        return ctype_digit($id) && ctype_digit($exp)
            && (int) $id === $pageId
            && (int) $exp >= ($now ?? time())
            && hash_equals(self::sig($payload), $sig);
    }

    private static function sig(string $payload): string
    {
        return rtrim(strtr(base64_encode(hash_hmac('sha256', $payload, hash('sha256', 'member-frame|'.config('app.key'), true), true)), '+/', '-_'), '=');
    }
}

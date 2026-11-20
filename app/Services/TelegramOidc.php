<?php

namespace App\Services;

use Firebase\JWT\JWK;
use Firebase\JWT\JWT;
use Firebase\JWT\Key;
use Firebase\JWT\SignatureInvalidException;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;

/**
 * "Log In with Telegram" over OpenID Connect (Authorization Code + PKCE), per
 * https://core.telegram.org/bots/telegram-login. Active only when TELEGRAM_CLIENT_ID and
 * TELEGRAM_CLIENT_SECRET (both shown by @BotFather > Login Widget) are set; otherwise the
 * classic widget stays in use.
 */
class TelegramOidc
{
    public const ISSUER = 'https://oauth.telegram.org';

    public const AUTH_URL = 'https://oauth.telegram.org/auth';

    public const TOKEN_URL = 'https://oauth.telegram.org/token';

    public const JWKS_URL = 'https://oauth.telegram.org/.well-known/jwks.json';

    private const SESSION_KEY = 'tg_oidc';

    private const JWKS_CACHE = 'tg_oidc_jwks';

    /** Algorithms we accept (Telegram default is RS256; ES256 is the other one usable with the profile scope). */
    private const ALGS = ['RS256', 'ES256'];

    public static function enabled(): bool
    {
        return filled(config('services.telegram.client_id')) && filled(config('services.telegram.client_secret'));
    }

    public static function redirectUri(): string
    {
        return route('member.telegram.oidc.callback');
    }

    /** Build the authorize URL and remember state / PKCE verifier / nonce in the session (one pending login at a time). */
    public static function authorizeUrl(): string
    {
        $state = Str::random(40);
        $nonce = Str::random(40);
        $verifier = Str::random(64);

        session()->put(self::SESSION_KEY, ['state' => $state, 'nonce' => $nonce, 'verifier' => $verifier, 'at' => time()]);

        return self::AUTH_URL.'?'.http_build_query([
            'client_id' => (string) config('services.telegram.client_id'),
            'redirect_uri' => self::redirectUri(),
            'response_type' => 'code',
            'scope' => 'openid profile',
            'state' => $state,
            'nonce' => $nonce,
            'code_challenge' => rtrim(strtr(base64_encode(hash('sha256', $verifier, true)), '+/', '-_'), '='),
            'code_challenge_method' => 'S256',
        ], '', '&', PHP_QUERY_RFC3986);
    }

    /**
     * Handle the callback: check state, exchange the code, validate the id_token.
     *
     * @return array<string, mixed> verified claims (contains the Telegram user `id`)
     *
     * @throws \RuntimeException with a user-facing message
     */
    public static function complete(?string $state, ?string $code): array
    {
        $pending = session()->pull(self::SESSION_KEY);

        if (! is_array($pending) || ! is_string($state) || $state === '' || ! hash_equals((string) $pending['state'], $state)) {
            throw new \RuntimeException('Sesi login Telegram tidak cocok atau kedaluwarsa. Coba lagi.');
        }

        if (time() - (int) $pending['at'] > 900) {
            throw new \RuntimeException('Login Telegram kedaluwarsa. Coba lagi.');
        }

        if (! is_string($code) || $code === '') {
            throw new \RuntimeException('Login Telegram dibatalkan.');
        }

        $clientId = (string) config('services.telegram.client_id');

        $response = Http::asForm()->acceptJson()->timeout(10)
            ->withBasicAuth($clientId, (string) config('services.telegram.client_secret'))
            ->post(self::TOKEN_URL, [
                'grant_type' => 'authorization_code',
                'code' => $code,
                'redirect_uri' => self::redirectUri(),
                'client_id' => $clientId,
                'code_verifier' => (string) $pending['verifier'],
            ]);

        $idToken = $response->successful() ? $response->json('id_token') : null;

        if (! is_string($idToken) || $idToken === '') {
            throw new \RuntimeException('Telegram menolak login. Coba lagi.');
        }

        return self::validateIdToken($idToken, (string) $pending['nonce']);
    }

    /**
     * Verify signature (JWKS), iss, aud, exp/iat and nonce. Returns the claims.
     *
     * @return array<string, mixed>
     *
     * @throws \RuntimeException
     */
    public static function validateIdToken(string $idToken, ?string $expectedNonce): array
    {
        $clientId = (string) config('services.telegram.client_id');

        try {
            $claims = self::decode($idToken, self::keys(false));
        } catch (SignatureInvalidException|\UnexpectedValueException $e) {
            // Unknown kid can mean Telegram rotated keys: refetch once.
            if (! str_contains($e->getMessage(), '"kid"')) {
                throw new \RuntimeException('Token Telegram tidak valid.', previous: $e);
            }
            try {
                $claims = self::decode($idToken, self::keys(true));
            } catch (\Throwable $e2) {
                throw new \RuntimeException('Token Telegram tidak valid.', previous: $e2);
            }
        } catch (\Throwable $e) {
            throw new \RuntimeException('Token Telegram tidak valid.', previous: $e);
        }

        $aud = $claims['aud'] ?? null;
        $audOk = is_array($aud) ? in_array($clientId, array_map('strval', $aud), true) : (string) $aud === $clientId;

        if (($claims['iss'] ?? null) !== self::ISSUER || ! $audOk || ! isset($claims['exp'])) {
            throw new \RuntimeException('Token Telegram tidak valid.');
        }

        // Telegram may not echo the nonce in the redirect flow (state + PKCE already bind the code to this browser),
        // but when it does it must match.
        if (array_key_exists('nonce', $claims) && ($expectedNonce === null || ! hash_equals($expectedNonce, (string) $claims['nonce']))) {
            throw new \RuntimeException('Token Telegram tidak valid.');
        }

        // `sub` is an opaque OIDC subject; the numeric Telegram user id (what the classic widget gave us) is `id`.
        $id = $claims['id'] ?? null;

        if (! (is_int($id) || (is_string($id) && ctype_digit($id))) || (int) $id <= 0) {
            throw new \RuntimeException('Telegram tidak mengirim ID akun. Coba lagi.');
        }

        $claims['id'] = (string) $id;

        return $claims;
    }

    /**
     * @param  array<string, Key>  $keys
     * @return array<string, mixed>
     */
    private static function decode(string $jwt, array $keys): array
    {
        $previous = JWT::$leeway;
        JWT::$leeway = 60;

        try {
            return json_decode((string) json_encode(JWT::decode($jwt, $keys)), true) ?: [];
        } finally {
            JWT::$leeway = $previous;
        }
    }

    /** @return array<string, Key> */
    private static function keys(bool $refresh): array
    {
        if ($refresh) {
            Cache::forget(self::JWKS_CACHE);
        }

        $jwks = Cache::remember(self::JWKS_CACHE, 3600, function (): array {
            $json = Http::acceptJson()->timeout(10)->get(self::JWKS_URL)->throw()->json();

            return is_array($json) ? $json : [];
        });

        $keys = [];

        foreach ((array) ($jwks['keys'] ?? []) as $jwk) {
            if (! is_array($jwk) || ! in_array($jwk['alg'] ?? null, self::ALGS, true) || ! isset($jwk['kid'])) {
                continue;
            }
            try {
                $key = JWK::parseKey($jwk);
                if ($key !== null) {
                    $keys[(string) $jwk['kid']] = $key;
                }
            } catch (\Throwable) {
                // skip keys this library can't use
            }
        }

        if ($keys === []) {
            Cache::forget(self::JWKS_CACHE);
            throw new \UnexpectedValueException('no usable Telegram keys');
        }

        return $keys;
    }
}

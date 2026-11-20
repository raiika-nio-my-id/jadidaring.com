<?php

namespace App\Services;

use App\Enums\UserRole;
use App\Models\User;
use App\Support\EmailNormalizer;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

/**
 * Social login providers. A provider is enabled only when its env credentials
 * exist; otherwise its button is hidden and its routes answer 404.
 */
class SocialAuth
{
    public const PROVIDERS = ['google', 'github', 'telegram'];

    public static function enabled(string $provider): bool
    {
        return match ($provider) {
            'google', 'github' => filled(config("services.{$provider}.client_id"))
                && filled(config("services.{$provider}.client_secret")),
            'telegram' => TelegramOidc::enabled() || self::telegramWidgetEnabled(),
            default => false,
        };
    }

    public static function telegramWidgetEnabled(): bool
    {
        return filled(config('services.telegram.bot_username')) && filled(config('services.telegram.bot_token'));
    }

    /**
     * @return list<string>
     */
    public static function enabledProviders(): array
    {
        return array_values(array_filter(self::PROVIDERS, fn (string $p): bool => self::enabled($p)));
    }

    /**
     * Verify the Telegram Login Widget payload (HMAC-SHA256 with sha256(bot token)).
     *
     * @param  array<string, mixed>  $data
     */
    public static function verifyTelegram(array $data, ?int $now = null): bool
    {
        $token = (string) config('services.telegram.bot_token');
        $hash = (string) ($data['hash'] ?? '');

        if ($token === '' || $hash === '' || ! isset($data['id'], $data['auth_date'])) {
            return false;
        }

        unset($data['hash']);
        $pairs = [];

        foreach ($data as $key => $value) {
            if (is_scalar($value)) {
                $pairs[] = $key.'='.$value;
            }
        }

        sort($pairs);
        $expected = hash_hmac('sha256', implode("\n", $pairs), hash('sha256', $token, true));

        if (! hash_equals($expected, strtolower($hash))) {
            return false;
        }

        return (($now ?? time()) - (int) $data['auth_date']) <= 86400;
    }

    /**
     * Find or create the member for a provider identity. Never links by email
     * to an existing account (prevents takeover through an unverified email).
     */
    public static function resolveUser(string $provider, string $providerId, ?string $email, ?string $nickname): User
    {
        $existing = User::query()->where('provider', $provider)->where('provider_id', $providerId)->first();

        if ($existing instanceof User) {
            return $existing;
        }

        $email = $email !== null ? Str::lower(trim($email)) : null;

        // Never link by email (an email at the provider may be unverified, or someone else's). If the address, or its
        // gmail-dot / +tag twin, already belongs to a member, create the account without an email and say so.
        if ($email !== null && $email !== '' && EmailNormalizer::taken($email)) {
            session()->flash('social_notice', 'Email '.$email.' sudah terdaftar di akun lain, jadi akun baru ini dibuat tanpa email. Kalau itu akunmu, masuk dengan cara lama lalu hubungkan dari sana.');
            $email = null;
        }

        $email = $email !== '' ? $email : null;
        $username = self::uniqueUsername($nickname ?: $provider);

        return User::query()->create([
            'name' => $username,
            'username' => $username,
            'email' => $email,
            'password' => Hash::make(Str::random(40)),
            'role' => UserRole::Member,
            'provider' => $provider,
            'provider_id' => $providerId,
        ]);
    }

    public static function uniqueUsername(string $seed): string
    {
        $base = Str::of(Str::ascii($seed))->lower()->replaceMatches('/[^a-z0-9_]+/', '')->limit(20, '')->toString();

        if (strlen($base) < 3) {
            $base = 'pemain'.$base;
        }

        $candidate = $base;

        while (User::query()->where('username', $candidate)->exists()) {
            $candidate = substr($base, 0, 24).random_int(100, 99999);
        }

        return $candidate;
    }
}

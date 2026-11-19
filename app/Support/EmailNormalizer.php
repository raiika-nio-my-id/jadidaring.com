<?php

namespace App\Support;

/**
 * Canonical form of an email address, used only to detect duplicates.
 * The original address is always kept for sending.
 */
class EmailNormalizer
{
    private const GMAIL = ['gmail.com', 'googlemail.com'];

    private const PLUS = ['outlook.com', 'hotmail.com', 'live.com', 'icloud.com', 'me.com', 'proton.me', 'protonmail.com', 'pm.me'];

    public static function normalize(?string $email): ?string
    {
        $email = mb_strtolower(trim((string) $email));

        if ($email === '' || substr_count($email, '@') !== 1) {
            return $email === '' ? null : $email;
        }

        [$local, $domain] = explode('@', $email);

        if (in_array($domain, self::GMAIL, true)) {
            $local = str_replace('.', '', explode('+', $local, 2)[0]);
            $domain = 'gmail.com';
        } elseif (in_array($domain, self::PLUS, true)) {
            $local = explode('+', $local, 2)[0];
        }

        return $local === '' ? $email : $local.'@'.$domain;
    }

    /** True when another user (other than $exceptUserId) already owns this address or its normalized form. */
    public static function taken(string $email, ?int $exceptUserId = null): bool
    {
        $norm = self::normalize($email);

        return \App\Models\User::query()
            ->when($exceptUserId, fn ($q) => $q->where('id', '!=', $exceptUserId))
            ->where(fn ($q) => $q->where('email_normalized', $norm)->orWhere('email', mb_strtolower(trim($email))))
            ->exists();
    }
}

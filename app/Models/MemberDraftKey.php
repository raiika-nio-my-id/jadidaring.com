<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class MemberDraftKey extends Model
{
    public const TTL_MINUTES = 60;

    protected $fillable = ['user_id', 'key_hash', 'expires_at', 'used_at'];

    protected function casts(): array
    {
        return ['expires_at' => 'datetime', 'used_at' => 'datetime'];
    }

    public static function hash(string $key): string
    {
        return hash('sha256', $key);
    }

    /** Mint a fresh key for the member; any earlier unused key stops working. Returns the plain key once. */
    public static function mint(int $userId): string
    {
        static::query()->where('user_id', $userId)->whereNull('used_at')->update(['used_at' => now()]);

        $key = 'jdk_'.bin2hex(random_bytes(24));
        static::query()->create(['user_id' => $userId, 'key_hash' => self::hash($key), 'expires_at' => now()->addMinutes(self::TTL_MINUTES)]);

        return $key;
    }
}

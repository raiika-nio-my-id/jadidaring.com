<?php

namespace App\Models;

use App\Enums\UserRole;
use App\Support\EmailNormalizer;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Illuminate\Support\Facades\File;

#[Fillable(['name', 'username', 'email', 'password', 'role', 'provider', 'provider_id'])]
#[Hidden(['password', 'remember_token'])]
class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasFactory, Notifiable;

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'role' => UserRole::class,
            'banned_at' => 'datetime',
            'banned_until' => 'datetime',
            'last_login_at' => 'datetime',
        ];
    }

    protected static function booted(): void
    {
        // Keep the duplicate-detection column in step with email, but only when email itself changes
        // (users left null by the backfill because of a collision must not crash on unrelated saves).
        static::saving(function (self $user): void {
            if ($user->isDirty('email') && ! $user->isDirty('email_normalized')) {
                $user->email_normalized = EmailNormalizer::normalize($user->email);
            }
        });

        // Curhatan rows cascade in the database; their images live on disk, so remove them with the account.
        static::deleted(function (self $user): void {
            File::deleteDirectory(storage_path('app/post-img/'.$user->id));
        });
    }

    public function companyProfile(): HasOne
    {
        return $this->hasOne(CompanyProfile::class);
    }

    public function isAdmin(): bool
    {
        return $this->role === UserRole::Admin;
    }

    /** Blocked by an admin in /admin: cannot log in or post. A timed ban lifts by itself once banned_until passes. */
    public function isBanned(): bool
    {
        return $this->banned_at !== null && ($this->banned_until === null || $this->banned_until->isFuture());
    }

    /** "sampai 22 Nov 2026, 14.00 WITA" or "permanen"; null when not banned. */
    public function banEndsText(): ?string
    {
        if (! $this->isBanned()) {
            return null;
        }

        return $this->banned_until === null ? 'permanen' : 'sampai '.$this->banned_until->wita();
    }

    public function banMessage(): string
    {
        return $this->banned_until === null
            ? 'Akun ini diblokir permanen oleh admin.'
            : 'Akun ini diblokir oleh admin sampai '.$this->banned_until->wita().'.';
    }

    public function isMember(): bool
    {
        return $this->role === UserRole::Member;
    }

    public function isClient(): bool
    {
        return $this->role === UserRole::Client;
    }

    public function memberPage(): HasOne
    {
        return $this->hasOne(MemberPage::class);
    }

    /** Members this user follows. */
    public function following(): BelongsToMany
    {
        return $this->belongsToMany(self::class, 'member_follows', 'follower_id', 'followed_id')->withTimestamps();
    }

    /** Members who follow this user. */
    public function followers(): BelongsToMany
    {
        return $this->belongsToMany(self::class, 'member_follows', 'followed_id', 'follower_id')->withTimestamps();
    }
}

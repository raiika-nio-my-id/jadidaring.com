<?php

namespace App\Models;

use App\Enums\UserRole;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;

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
        ];
    }

    public function companyProfile(): HasOne
    {
        return $this->hasOne(CompanyProfile::class);
    }

    public function isAdmin(): bool
    {
        return $this->role === UserRole::Admin;
    }

    public function isMember(): bool
    {
        return $this->role === UserRole::Member;
    }

    public function isClient(): bool
    {
        return $this->role === UserRole::Client;
    }

    public function memberPage(): \Illuminate\Database\Eloquent\Relations\HasOne
    {
        return $this->hasOne(MemberPage::class);
    }

    /** Members this user follows. */
    public function following(): \Illuminate\Database\Eloquent\Relations\BelongsToMany
    {
        return $this->belongsToMany(self::class, 'member_follows', 'follower_id', 'followed_id')->withTimestamps();
    }

    /** Members who follow this user. */
    public function followers(): \Illuminate\Database\Eloquent\Relations\BelongsToMany
    {
        return $this->belongsToMany(self::class, 'member_follows', 'followed_id', 'follower_id')->withTimestamps();
    }
}

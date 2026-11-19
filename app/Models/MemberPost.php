<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Facades\DB;

/**
 * A "Curhatan" post on a member profile. Who may see it is decided only here
 * (scopeVisibleTo / isVisibleTo), so feeds, the profile, single-post URLs, images,
 * likes and comments all share one rule.
 */
class MemberPost extends Model
{
    public const VISIBILITIES = ['public' => 'Publik', 'followers' => 'Pengikut saja', 'private' => 'Cuma aku'];

    public const MAX_CHARS = 500;

    public const AUTO_HIDE_REPORTS = 3;

    protected $fillable = ['user_id', 'body', 'image', 'visibility', 'is_hidden', 'likes_count', 'comments_count', 'reports_count'];

    protected function casts(): array
    {
        return ['is_hidden' => 'boolean'];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function comments(): HasMany
    {
        return $this->hasMany(MemberPostComment::class);
    }

    /**
     * Posts the viewer may see: not moderated away, author's profile not hidden by moderators,
     * and public / followers-only (viewer follows the author) / own posts.
     *
     * @param  Builder<MemberPost>  $query
     */
    public function scopeVisibleTo(Builder $query, ?User $viewer): void
    {
        $query->where('member_posts.is_hidden', false)
            ->whereExists(fn ($q) => $q->select(DB::raw(1))->from('member_pages')
                ->whereColumn('member_pages.user_id', 'member_posts.user_id')->where('member_pages.status', 'published'));

        if (! $viewer instanceof User) {
            $query->where('member_posts.visibility', 'public');

            return;
        }

        $query->where(fn ($w) => $w->where('member_posts.visibility', 'public')
            ->orWhere('member_posts.user_id', $viewer->id)
            ->orWhere(fn ($f) => $f->where('member_posts.visibility', 'followers')
                ->whereExists(fn ($q) => $q->select(DB::raw(1))->from('member_follows')
                    ->whereColumn('member_follows.followed_id', 'member_posts.user_id')->where('member_follows.follower_id', $viewer->id))));
    }

    public function isVisibleTo(?User $viewer): bool
    {
        return self::query()->whereKey($this->id)->visibleTo($viewer)->exists();
    }

    public function isPublic(): bool
    {
        return $this->visibility === 'public';
    }

    public function imageUrl(): ?string
    {
        return $this->image ? '/curhatan/'.$this->id.'/gambar?v='.substr($this->image, 0, 8) : null;
    }

    public function url(): string
    {
        return '/u/'.($this->user->username ?? '').'/curhatan/'.$this->id;
    }
}

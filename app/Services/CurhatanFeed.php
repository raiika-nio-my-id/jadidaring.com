<?php

namespace App\Services;

use App\Models\MemberPost;
use App\Models\MemberPostComment;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * Reads Curhatan posts for the profile section, the /komunitas feeds and single-post pages.
 * Every list goes through MemberPost::visibleTo, so a viewer only ever gets what they may see.
 * Pagination is keyset by id ("sebelum" = older than this id) so "Muat lagi" never repeats or skips.
 */
class CurhatanFeed
{
    public const PER_PAGE = 10;

    public const PREVIEW_COMMENTS = 3;

    /** @return array{posts: Collection<int, MemberPost>, next: ?int} */
    public static function profile(User $owner, ?User $viewer, ?int $before = null): array
    {
        $query = $viewer?->id === $owner->id
            ? MemberPost::query()->where('member_posts.user_id', $owner->id) // owners also see their own moderated posts (labelled)
            : MemberPost::query()->where('member_posts.user_id', $owner->id)->visibleTo($viewer);

        return self::page($query, $before);
    }

    /** @return array{posts: Collection<int, MemberPost>, next: ?int} */
    public static function latest(?User $viewer, ?int $before = null): array
    {
        // "Terbaru" is the public timeline for everyone (the guest-cached HTML is identical), never follower/private posts.
        return self::page(MemberPost::query()->visibleTo(null), $before);
    }

    /** @return array{posts: Collection<int, MemberPost>, next: ?int} */
    public static function following(User $viewer, ?int $before = null): array
    {
        $query = MemberPost::query()->visibleTo($viewer)
            ->whereIn('member_posts.user_id', DB::table('member_follows')->where('follower_id', $viewer->id)->select('followed_id'));

        return self::page($query, $before);
    }

    /**
     * @param  Builder<MemberPost>  $query
     * @return array{posts: Collection<int, MemberPost>, next: ?int}
     */
    private static function page(Builder $query, ?int $before): array
    {
        $rows = $query->with(['user:id,username,name', 'user.memberPage:id,user_id,config,html'])
            ->when($before !== null && $before > 0, fn ($q) => $q->where('member_posts.id', '<', $before))
            ->orderByDesc('member_posts.id')->limit(self::PER_PAGE + 1)->get();
        $more = $rows->count() > self::PER_PAGE;
        $posts = $rows->take(self::PER_PAGE)->values();

        return ['posts' => $posts, 'next' => $more ? (int) $posts->last()->id : null];
    }

    /**
     * Per-viewer extras for a list of posts: which ones the viewer liked and a few latest comments each.
     *
     * @param  Collection<int, MemberPost>  $posts
     * @return array{liked: array<int, true>, previews: array<int, Collection<int, MemberPostComment>>}
     */
    public static function extras(Collection $posts, ?User $viewer, int $perPost = self::PREVIEW_COMMENTS): array
    {
        $ids = $posts->pluck('id')->all();
        if ($ids === []) {
            return ['liked' => [], 'previews' => []];
        }
        $liked = $viewer ? DB::table('member_post_likes')->where('user_id', $viewer->id)->whereIn('member_post_id', $ids)
            ->pluck('member_post_id')->mapWithKeys(fn ($id) => [(int) $id => true])->all() : [];

        $previews = [];
        foreach ($ids as $id) {
            $previews[$id] = MemberPostComment::query()->where('member_post_id', $id)->where('is_hidden', false)
                ->with('user:id,username,name')->orderByDesc('id')->limit($perPost)->get()->reverse()->values();
        }

        return ['liked' => $liked, 'previews' => $previews];
    }

    /** Avatar of a post author (from their profile config), or '' for the initial placeholder. */
    public static function avatar(User $user): string
    {
        $page = $user->memberPage;
        if (! $page || ! is_array($page->config)) {
            return '';
        }

        return ProfileConfig::image($page->config['profile']['avatar'] ?? '');
    }

    public static function name(User $user): string
    {
        $name = $user->memberPage && is_array($user->memberPage->config) ? trim((string) ($user->memberPage->config['profile']['name'] ?? '')) : '';

        return $name !== '' ? mb_substr($name, 0, 60) : (string) $user->name;
    }
}

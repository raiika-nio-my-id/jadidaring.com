<?php

namespace App\Services;

use App\Models\Article;
use App\Models\NewsTopic;
use Illuminate\Support\Facades\Cache;

/**
 * Data cache for the news pages. The version key is bumped on every write,
 * so readers never see stale lists for longer than one request after a change.
 * Rendered HTML is not cached because the page chrome depends on the viewer.
 */
class NewsCache
{
    private const TTL = 600;

    public static function version(): int
    {
        return (int) Cache::get('news:version', 1);
    }

    public static function bump(): void
    {
        Cache::forever('news:version', self::version() + 1);
    }

    /**
     * @template T
     *
     * @param  callable(): T  $callback
     * @return T
     */
    public static function remember(string $key, callable $callback): mixed
    {
        return Cache::remember('news:v'.self::version().':'.$key, self::TTL, $callback);
    }

    /**
     * @return array<string, string> slug => display name, enabled topics only
     */
    public static function topics(): array
    {
        return self::remember('topics', fn (): array => NewsTopic::query()->where('enabled', true)->orderBy('slug')->pluck('name', 'slug')->all());
    }

    /**
     * @return list<array<string, mixed>>
     */
    public static function latest(?string $topic, int $limit = 12): array
    {
        return self::remember('latest:'.($topic ?? 'all').':'.$limit, function () use ($topic, $limit): array {
            return Article::query()->visible()
                ->when($topic !== null, fn ($q) => $q->where('topic', $topic))
                ->orderByDesc('published_at')->orderByDesc('id')
                ->limit($limit)
                ->get(['id', 'topic', 'slug', 'title', 'summary', 'image_url', 'image_path', 'image_alt', 'image_credit', 'image_source_url', 'image_license', 'image_updated_at', 'published_at', 'updated_at'])
                ->map(fn (Article $a): array => [
                    'id' => $a->id, 'topic' => $a->topic, 'slug' => $a->slug, 'title' => $a->title, 'summary' => $a->summary,
                    'img' => NewsImage::meta($a), 'updated_at' => $a->updated_at?->toIso8601String(), 'published_at' => $a->published_at?->toIso8601String(), 'url' => $a->url(),
                ])->all();
        });
    }

    public const PER_PAGE = 12;

    public static function total(?string $topic): int
    {
        return self::remember('total:'.($topic ?? 'all'), fn (): int => Article::query()->visible()
            ->when($topic !== null, fn ($q) => $q->where('topic', $topic))->count());
    }

    /**
     * @return list<array<string, mixed>>
     */
    public static function page(?string $topic, int $page, int $per = self::PER_PAGE): array
    {
        return self::remember('page:'.($topic ?? 'all').':'.$per.':'.$page, function () use ($topic, $page, $per): array {
            return Article::query()->visible()
                ->when($topic !== null, fn ($q) => $q->where('topic', $topic))
                ->orderByDesc('published_at')->orderByDesc('id')
                ->offset(($page - 1) * $per)->limit($per)
                ->get(['id', 'topic', 'slug', 'title', 'summary', 'image_url', 'image_path', 'image_alt', 'image_credit', 'image_source_url', 'image_license', 'image_updated_at', 'published_at', 'updated_at'])
                ->map(fn (Article $a): array => [
                    'id' => $a->id, 'topic' => $a->topic, 'slug' => $a->slug, 'title' => $a->title, 'summary' => $a->summary,
                    'img' => NewsImage::meta($a), 'updated_at' => $a->updated_at?->toIso8601String(), 'published_at' => $a->published_at?->toIso8601String(), 'url' => $a->url(),
                ])->all();
        });
    }

    /**
     * Populer is a SORT, not a filter: every visible article of the topic (or all topics), ordered by
     * GA 7-day views desc, the rest newest first. Paginated like the normal listing.
     *
     * @return list<array<string, mixed>>
     */
    public static function popularPage(?string $topic, int $page, int $per = self::PER_PAGE): array
    {
        $all = self::remember('popall:'.($topic ?? 'all'), function () use ($topic): array {
            return Article::query()->visible()
                ->when($topic !== null, fn ($q) => $q->where('topic', $topic))
                ->orderByDesc('published_at')->orderByDesc('id')
                ->limit(2000)
                ->get(['id', 'topic', 'slug', 'title', 'summary', 'image_url', 'image_path', 'image_alt', 'image_credit', 'image_source_url', 'image_license', 'image_updated_at', 'published_at', 'updated_at'])
                ->map(fn (Article $a): array => [
                    'id' => $a->id, 'topic' => $a->topic, 'slug' => $a->slug, 'title' => $a->title, 'summary' => $a->summary,
                    'img' => NewsImage::meta($a), 'updated_at' => $a->updated_at?->toIso8601String(), 'published_at' => $a->published_at?->toIso8601String(), 'url' => $a->url(),
                ])->all();
        });

        $ranked = PopularStats::rank($all, fn (array $a): string => $a['slug'], PopularStats::newsViews());

        return array_slice($ranked, ($page - 1) * $per, $per);
    }

    /**
     * Top articles by Google Analytics views (7 days). Falls back to newest-first when GA has no data.
     *
     * @return array{items: list<array<string, mixed>>, ranked: bool}
     */
    public static function popular(int $limit = 12): array
    {
        $views = PopularStats::newsViews();
        $pool = self::latest(null, 100);

        if ($views === null || $views === []) {
            return ['items' => array_slice($pool, 0, $limit), 'ranked' => false];
        }

        $pool = array_values(array_filter($pool, fn (array $a): bool => ($views[strtolower($a['slug'])] ?? 0) > 0));
        $pool = PopularStats::rank($pool, fn (array $a): string => $a['slug'], $views);

        return ['items' => array_slice($pool, 0, $limit), 'ranked' => $pool !== []];
    }
}

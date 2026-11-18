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
                ->get(['id', 'topic', 'slug', 'title', 'summary', 'image_url', 'published_at'])
                ->map(fn (Article $a): array => [
                    'topic' => $a->topic, 'slug' => $a->slug, 'title' => $a->title, 'summary' => $a->summary,
                    'image_url' => $a->image_url, 'published_at' => $a->published_at?->toIso8601String(), 'url' => $a->url(),
                ])->all();
        });
    }
}

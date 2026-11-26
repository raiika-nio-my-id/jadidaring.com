<?php

namespace App\Services;

use App\Models\BedtimeStory;
use Illuminate\Support\Facades\Cache;

/**
 * Data cache for Bed Time Stories public pages.
 */
class BedtimeCache
{
    private const TTL = 600;

    public const PER_PAGE = 12;

    public static function version(): int
    {
        return (int) Cache::get('bedtime:version', 1);
    }

    public static function bump(): void
    {
        Cache::forever('bedtime:version', self::version() + 1);
    }

    /**
     * @template T
     *
     * @param  callable(): T  $callback
     * @return T
     */
    public static function remember(string $key, callable $callback): mixed
    {
        return Cache::remember('bedtime:v'.self::version().':'.$key, self::TTL, $callback);
    }

    public static function total(): int
    {
        return self::remember('total', fn (): int => BedtimeStory::query()->visible()->count());
    }

    /**
     * @return list<array<string, mixed>>
     */
    public static function page(int $page, int $per = self::PER_PAGE): array
    {
        return self::remember('page:'.$per.':'.$page, function () use ($page, $per): array {
            return BedtimeStory::query()->visible()
                ->orderByDesc('published_at')->orderByDesc('id')
                ->offset(($page - 1) * $per)->limit($per)
                ->get()
                ->map(fn (BedtimeStory $s): array => [
                    'id' => $s->id,
                    'title' => $s->title,
                    'slug' => $s->slug,
                    'author' => $s->author,
                    'author_origin' => $s->author_origin,
                    'adapter' => $s->adapter,
                    'language' => $s->language,
                    'summary' => $s->summary ?: BedtimeStory::deriveSummary((string) $s->body),
                    'moral' => $s->moral,
                    'img' => BedtimeImage::meta($s),
                    'published_at' => $s->published_at?->toIso8601String(),
                    'updated_at' => $s->updated_at?->toIso8601String(),
                    'url' => $s->url(),
                ])->all();
        });
    }

    /**
     * @return array<string, mixed>|null
     */
    public static function find(string $slug): ?array
    {
        return self::remember('story:'.$slug, function () use ($slug): ?array {
            $story = BedtimeStory::query()->visible()->where('slug', $slug)->first();

            if (! $story instanceof BedtimeStory) {
                return null;
            }

            return [
                'id' => $story->id,
                'title' => $story->title,
                'slug' => $story->slug,
                'author' => $story->author,
                'author_origin' => $story->author_origin,
                'adapter' => $story->adapter,
                'language' => $story->language,
                'summary' => $story->summary ?: BedtimeStory::deriveSummary((string) $story->body),
                'body' => $story->body,
                'moral' => $story->moral,
                'img' => BedtimeImage::meta($story),
                'published_at' => $story->published_at?->toIso8601String(),
                'updated_at' => $story->updated_at?->toIso8601String(),
                'paragraphs' => $story->paragraphs(),
                'url' => $story->url(),
            ];
        });
    }
}

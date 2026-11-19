<?php

namespace App\Services;

use App\Services\GoogleStats\GoogleStats;
use App\Services\GoogleStats\GoogleStatsException;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;

/**
 * "Populer" rankings from real Google Analytics page views.
 * Games: last 30 days. News: last 7 days. Refreshed by `stats:refresh-popular`;
 * page loads only read the cache and never call Google. No data means no ranking (callers fall back to newest).
 */
class PopularStats
{
    public const GAME_DAYS = 30;

    public const NEWS_DAYS = 7;

    private const KEY_GAMES = 'popular:games';

    private const KEY_NEWS = 'popular:news';

    private const TTL_SECONDS = 172800;

    /**
     * Fetch from GA and store. Existing cached data is kept if GA fails.
     *
     * @return array{games: int, news: int}
     */
    public static function refresh(GoogleStats $stats): array
    {
        $games = self::aggregateGames($stats->pageViewsByPath(self::GAME_DAYS));
        $news = self::aggregateNews($stats->pageViewsByPath(self::NEWS_DAYS));

        Cache::put(self::KEY_GAMES, ['views' => $games, 'fetchedAt' => now()->toIso8601String()], self::TTL_SECONDS);
        Cache::put(self::KEY_NEWS, ['views' => $news, 'fetchedAt' => now()->toIso8601String()], self::TTL_SECONDS);

        return ['games' => count($games), 'news' => count($news)];
    }

    /** Never throws: returns false (and logs) on any failure. */
    public static function tryRefresh(GoogleStats $stats): bool
    {
        if (! $stats->isConfigured()) {
            return false;
        }

        try {
            self::refresh($stats);

            return true;
        } catch (GoogleStatsException $e) {
            Log::warning('popular-stats: refresh failed', ['category' => $e->category]);
        } catch (\Throwable $e) {
            Log::warning('popular-stats: refresh error', ['error' => $e::class]);
        }

        return false;
    }

    /** @return array<string, int>|null game slug => views (30d); null when no GA data yet */
    public static function gameViews(): ?array
    {
        $data = Cache::get(self::KEY_GAMES);

        return is_array($data) ? $data['views'] : null;
    }

    /** @return array<string, int>|null article slug => views (7d); null when no GA data yet */
    public static function newsViews(): ?array
    {
        $data = Cache::get(self::KEY_NEWS);

        return is_array($data) ? $data['views'] : null;
    }

    /**
     * Stable sort of items by GA views (desc); ties and unknowns keep their incoming order.
     *
     * @template T
     *
     * @param  iterable<T>  $items
     * @param  callable(T): string  $slugOf
     * @param  array<string, int>|null  $views
     * @return list<T>
     */
    public static function rank(iterable $items, callable $slugOf, ?array $views): array
    {
        $list = [];
        foreach ($items as $item) {
            $list[] = $item;
        }

        if ($views === null) {
            return $list;
        }

        $indexed = [];
        foreach ($list as $i => $item) {
            $indexed[] = [$i, $item];
        }
        usort($indexed, function (array $a, array $b) use ($slugOf, $views): int {
            $va = $views[strtolower($slugOf($a[1]))] ?? 0;
            $vb = $views[strtolower($slugOf($b[1]))] ?? 0;

            return $vb <=> $va ?: $a[0] <=> $b[0];
        });

        return array_map(fn (array $pair) => $pair[1], $indexed);
    }

    /**
     * @param  list<array{host: string, path: string, views: int}>  $rows
     * @return array<string, int>
     */
    public static function aggregateGames(array $rows): array
    {
        $base = strtolower(GameHub::baseDomain());
        $out = [];

        foreach ($rows as $row) {
            $path = self::cleanPath($row['path']);
            $host = $row['host'];
            $slug = null;

            if (preg_match('#^/game/([a-z0-9-]+)(?:/|$)#', $path, $m)) {
                $slug = $m[1];
            } elseif (str_ends_with($host, '.'.$base)) {
                $label = substr($host, 0, -strlen('.'.$base));
                if (preg_match('/^[a-z0-9-]+$/', $label) && ! in_array($label, ['www', 'admin', 'gamehub'], true)) {
                    $slug = $label;
                }
            } elseif (preg_match('#^/([a-z0-9-]+)(?:/|$)#', $path, $m) && ! in_array($m[1], self::RESERVED_ROOTS, true)) {
                $slug = $m[1];
            }

            if ($slug !== null) {
                $out[$slug] = ($out[$slug] ?? 0) + $row['views'];
            }
        }

        arsort($out);

        return $out;
    }

    /**
     * @param  list<array{host: string, path: string, views: int}>  $rows
     * @return array<string, int>
     */
    public static function aggregateNews(array $rows): array
    {
        $out = [];

        foreach ($rows as $row) {
            if (preg_match('#^/berita/[a-z0-9-]+/([a-z0-9-]+)/?$#', self::cleanPath($row['path']), $m)) {
                $out[$m[1]] = ($out[$m[1]] ?? 0) + $row['views'];
            }
        }

        arsort($out);

        return $out;
    }

    private const RESERVED_ROOTS = ['game', 'berita', 'komunitas', 'kontak', 'tentang', 'privasi', 'redaksi', 'login', 'register', 'ketentuan', 'syarat-ketentuan', 'a', 'api', 'curhatan', 'member', 'u', 'admin', 'terms', 'sitemap', 'sitemap-xml'];

    private static function cleanPath(string $path): string
    {
        $path = strtolower(strtok($path, '?#') ?: '');

        return $path === '' ? '/' : $path;
    }
}

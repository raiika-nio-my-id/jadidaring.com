<?php

namespace App\Services;

use App\Models\Article;
use Illuminate\Support\Str;

class NewsSlug
{
    public const MAX = 80;

    /** Slugify and cut at a word boundary, never leaving a trailing dash. */
    public static function make(string $seed): string
    {
        $slug = Str::slug($seed);

        if (strlen($slug) > self::MAX) {
            $cut = substr($slug, 0, self::MAX + 1);
            $pos = strrpos($cut, '-');
            $slug = $pos !== false && $pos >= 20 ? substr($cut, 0, $pos) : substr($slug, 0, self::MAX);
        }

        $slug = trim($slug, '-');

        return $slug !== '' ? $slug : 'berita';
    }

    public static function unique(string $seed, ?int $ignoreId = null): string
    {
        $base = self::make($seed);
        $slug = $base;

        while (Article::query()->where('slug', $slug)->when($ignoreId, fn ($q) => $q->where('id', '!=', $ignoreId))->exists()
            || \Illuminate\Support\Facades\DB::table('article_slug_redirects')->where('old_slug', $slug)->exists()) {
            $slug = $base.'-'.Str::lower(Str::random(5));
        }

        return $slug;
    }
}

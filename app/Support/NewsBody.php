<?php

namespace App\Support;

/**
 * Renders a news article body written in a tiny, safe markup:
 *   "## Heading" / "### Subheading" as their own block,
 *   "Poin penting" followed by "- " lines = key-points box,
 *   a block of "- " lines = bullet list, "**bold**" inline.
 * Everything is HTML-escaped first, so no raw HTML can get through.
 */
final class NewsBody
{
    public const KEYPOINTS_LABEL = 'Poin penting';

    /** @param list<string> $blocks */
    public static function render(array $blocks): string
    {
        $out = '';

        foreach ($blocks as $block) {
            $lines = array_values(array_filter(array_map('trim', preg_split('/\R/', $block) ?: []), fn ($l) => $l !== ''));

            if ($lines === []) {
                continue;
            }

            if (str_starts_with($block, '### ')) {
                $out .= '<h3 class="news-subhead news-subhead--3">'.self::inline(trim(substr($block, 4))).'</h3>';
            } elseif (str_starts_with($block, '## ')) {
                $out .= '<h2 class="news-subhead">'.self::inline(trim(substr($block, 3))).'</h2>';
            } elseif (self::isKeypoints($lines)) {
                $out .= '<aside class="news-keypoints" aria-label="'.self::KEYPOINTS_LABEL.'"><p class="news-keypoints__title">'.self::KEYPOINTS_LABEL.'</p>'.self::list(array_slice($lines, 1)).'</aside>';
            } elseif (self::allBullets($lines)) {
                $out .= self::list($lines);
            } else {
                $out .= '<p>'.nl2br(self::inline($block)).'</p>';
            }
        }

        return $out;
    }

    /** @param list<string> $lines */
    private static function isKeypoints(array $lines): bool
    {
        $first = strtolower(trim($lines[0], " *:#\t"));

        return count($lines) >= 2 && $first === strtolower(self::KEYPOINTS_LABEL) && self::allBullets(array_slice($lines, 1));
    }

    /** @param list<string> $lines */
    private static function allBullets(array $lines): bool
    {
        foreach ($lines as $l) {
            if (! preg_match('/^[-*] \S/', $l)) {
                return false;
            }
        }

        return $lines !== [];
    }

    /** @param list<string> $lines */
    private static function list(array $lines): string
    {
        return '<ul class="news-list">'.implode('', array_map(fn ($l) => '<li>'.self::inline(substr($l, 2)).'</li>', $lines)).'</ul>';
    }

    private static function inline(string $text): string
    {
        return preg_replace('/\*\*(?=\S)(.+?)(?<=\S)\*\*/su', '<strong>$1</strong>', e($text)) ?? e($text);
    }
}

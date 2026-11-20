<?php

namespace App\Support;

use Illuminate\Http\Request;

/** Shared bits of the "infinite scroll with crawlable ?page=N fallback" listings (news, game, komunitas). */
final class Infinite
{
    /** Relative URL of page $n for the current path and filters ("page" omitted for page 1; "partial" added for the fragment). */
    public static function url(Request $request, int $page, bool $partial = false): string
    {
        $q = $request->query();
        unset($q['page'], $q['partial']);

        if ($page > 1) {
            $q['page'] = $page;
        }

        if ($partial) {
            $q['partial'] = 1;
        }

        return $request->getPathInfo().($q === [] ? '' : '?'.http_build_query($q));
    }

    /**
     * View data for resources/views/clay/_inf-more.blade.php.
     *
     * @return array{page: int, pages: int, kind: string, prev: ?string, next: ?string, nextPartial: ?string}
     */
    public static function data(Request $request, string $kind, int $page, int $pages): array
    {
        return [
            'kind' => $kind, 'page' => $page, 'pages' => $pages,
            'prev' => $page > 1 ? self::url($request, $page - 1) : null,
            'next' => $page < $pages ? self::url($request, $page + 1) : null,
            'nextPartial' => $page < $pages ? self::url($request, $page + 1, true) : null,
        ];
    }

    /** Strict ?page value: a positive integer, otherwise 404. */
    public static function page(Request $request): int
    {
        $raw = $request->query('page', '1');
        abort_unless(is_string($raw) && ctype_digit($raw) && (int) $raw >= 1, 404);

        return (int) $raw;
    }
}

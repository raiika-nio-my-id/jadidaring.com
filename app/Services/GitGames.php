<?php

namespace App\Services;

/**
 * Games whose code lives in the repo (resources/games/{slug}/game.html) instead of the
 * company_profiles.html column. /game/{slug} renders the site layout with the main nav and
 * loads the game document from /game/{slug}/play in a same-origin frame.
 *
 * The database profile still decides whether the game is live and keeps its html as the
 * rollback copy. GIT_GAMES (comma list) switches games on; empty = every game back on DB html.
 */
class GitGames
{
    public static function enabled(string $slug): bool
    {
        $slug = strtolower(trim($slug));
        $list = array_filter(array_map('trim', explode(',', strtolower((string) config('singlepage.git_games')))));

        return in_array($slug, $list, true) && self::path($slug) !== null;
    }

    public static function path(string $slug): ?string
    {
        if (preg_match('/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/', $slug) !== 1) {
            return null;
        }

        $path = resource_path('games/'.$slug.'/game.html');

        return is_file($path) ? $path : null;
    }

    public static function html(string $slug): string
    {
        $path = self::path(strtolower(trim($slug)));

        return $path === null ? '' : (string) file_get_contents($path);
    }

    public const FRAME_MARKER = 'data-jd-gitgame-frame';

    /**
     * Framed document extras: opened top-level it goes back to the shell page (except ?wallpaper, the
     * game's own fullscreen sky mode), links that leave the game open in the whole tab, and GA events
     * are forwarded to the shell page (which owns the consent banner) instead of loading gtag twice.
     */
    public static function frame(string $html, string $slug): string
    {
        if (str_contains($html, self::FRAME_MARKER)) {
            return $html;
        }

        $shell = json_encode('/game/'.TenantPath::segment($slug), JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT | JSON_UNESCAPED_SLASHES);
        $head = '<script '.self::FRAME_MARKER.'>(function(){var shell='.$shell.';'
            ."try{if(window.top===window&&!/[?&]wallpaper\\b/i.test(location.search)){location.replace(shell+location.search+location.hash);return;}}catch(e){}"
            ."document.addEventListener('click',function(e){var a=e.target&&e.target.closest?e.target.closest('a[href]'):null;"
            ."if(!a||e.defaultPrevented||a.target||e.button!==0||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey||window.top===window){return;}"
            ."var u;try{u=new URL(a.href,location.href);}catch(x){return;}"
            ."if(!/^https?:$/.test(u.protocol)||(u.origin===location.origin&&u.pathname===location.pathname&&u.search===location.search&&u.hash)){return;}"
            ."e.preventDefault();try{window.top.location.href=u.href;}catch(x){location.href=u.href;}});})();</script>";

        $out = preg_replace_callback('/<head\b[^>]*>/i', fn (array $m) => $m[0].$head, $html, 1, $count);
        $html = is_string($out) && $count > 0 ? $out : $head.$html;

        $html = self::accountName($html);

        // The game page nav has a Back button to /game, so the floating Game Hub link (jr-hub snippet) is dropped.
        $html = (string) preg_replace('/<!-- JaRing Game Hub link[\s\S]*?<!-- \/jr-hub -->\s*/', '', $html, 1);

        $id = (string) config('services.ga4.measurement_id');

        if (preg_match('/^G-[A-Z0-9]{4,20}$/', $id) === 1 && ! str_contains($html, GameAnalytics::MARKER)) {
            $tag = '<div '.GameAnalytics::MARKER.' style="display:contents">'.view('partials.ga4-game-frame', ['slug' => $slug])->render().'</div>';
            $out = preg_replace_callback('/<\/body>/i', fn () => $tag.'</body>', $html, 1, $count);
            $html = is_string($out) && $count > 0 ? $out : $html.$tag;
        }

        return $html;
    }

    public const ACCOUNT_NAME_MARKER = 'data-jd-account-name-lock';

    /**
     * Right after the player-name bridge (window.__JD_ME): name fields listed by the game's name gate are filled
     * with the account name and made read-only (public/js/account-name.js). Games without the bridge are untouched.
     */
    private static function accountName(string $html): string
    {
        if (str_contains($html, self::ACCOUNT_NAME_MARKER) || ! str_contains($html, PlayerNameBridge::MARKER)) {
            return $html;
        }

        $script = is_file(public_path('js/account-name.js')) ? (string) file_get_contents(public_path('js/account-name.js')) : '';

        if ($script === '' || str_contains($script, '</script')) {
            return $html;
        }

        $tag = '<script '.self::ACCOUNT_NAME_MARKER.'>'.trim($script).'</script>';
        $out = preg_replace_callback('/<script\s+'.preg_quote(PlayerNameBridge::MARKER, '/').'\b[^>]*>[\s\S]*?<\/script>/i', fn (array $m) => $m[0].$tag, $html, 1, $count);

        return is_string($out) && $count > 0 ? $out : $html;
    }

    /**
     * SEO fields read from the game document head, so the shell page keeps the game's own title and description.
     *
     * @return array{title: string, shortTitle: string, description: string, ogDescription: string, themeColor: string}
     */
    public static function meta(string $html): array
    {
        $title = preg_match('/<title[^>]*>(.*?)<\/title>/is', $html, $m) === 1 ? self::text($m[1]) : '';
        $card = GameHubCatalog::pageMetadata($html);
        $og = self::metaTag($html, 'property', 'og:description');
        $theme = self::metaTag($html, 'name', 'theme-color');

        return [
            'title' => $title !== '' ? $title : $card['title'],
            'shortTitle' => $card['title'] !== '' ? $card['title'] : $title,
            'description' => $card['description'],
            'ogDescription' => $og !== '' ? $og : $card['description'],
            'themeColor' => preg_match('/^#[0-9a-fA-F]{3,8}$/', $theme) === 1 ? $theme : '',
        ];
    }

    private static function metaTag(string $html, string $attribute, string $key): string
    {
        $pattern = '/<meta\b(?=[^>]*\b'.$attribute.'=["\']'.preg_quote($key, '/').'["\'])[^>]*\bcontent=["\']([^"\']*)["\'][^>]*>/i';

        return preg_match($pattern, $html, $m) === 1 ? self::text($m[1]) : '';
    }

    private static function text(string $value): string
    {
        return trim((string) preg_replace('/\s+/u', ' ', html_entity_decode(strip_tags($value), ENT_QUOTES | ENT_HTML5, 'UTF-8')));
    }
}

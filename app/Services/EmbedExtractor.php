<?php

namespace App\Services;

/**
 * Pulls Spotify/YouTube iframes out of pasted Custom HTML and turns them into site-rendered widgets.
 * Every other iframe is removed and counted so the member is told instead of failing silently.
 */
class EmbedExtractor
{
    /**
     * @return array{html: string, widgets: list<array<string, mixed>>, notices: list<string>}
     */
    public static function extract(string $html): array
    {
        $widgets = [];
        $dropped = 0;
        $notices = [];

        $out = preg_replace_callback('~<iframe\b[^>]*>(?:.*?</iframe\s*>)?~is', function (array $m) use (&$widgets, &$dropped, &$notices): string {
            $tag = $m[0];
            $sp = ProfileConfig::spotify($tag);
            if ($sp !== null) {
                $widgets[] = ['type' => 'spotify', 'kind' => $sp['kind'], 'id' => $sp['id']];
                $notices[] = 'Embed Spotify dipindah ke widget Spotify.';

                return '';
            }
            if (preg_match('/\ssrc\s*=\s*(?:"([^"]*)"|\'([^\']*)\')/i', $tag, $s) === 1) {
                $id = ProfileConfig::youtubeId(trim(html_entity_decode($s[1] !== '' ? $s[1] : ($s[2] ?? ''), ENT_QUOTES)));
                if ($id !== '' && ! preg_match('/^[A-Za-z0-9_-]{11}$/', trim($s[1] ?: ($s[2] ?? '')))) {
                    $widgets[] = ['type' => 'youtube', 'id' => $id];
                    $notices[] = 'Embed YouTube dipindah ke widget YouTube.';

                    return '';
                }
            }
            $dropped++;

            return '';
        }, $html) ?? $html;

        if ($dropped > 0) {
            $notices[] = 'Iframe tidak diizinkan di HTML kustom ('.$dropped.' dihapus). Pakai widget YouTube atau Spotify untuk menyematkan video atau musik.';
        }

        return ['html' => $out, 'widgets' => $widgets, 'notices' => array_values(array_unique($notices))];
    }
}

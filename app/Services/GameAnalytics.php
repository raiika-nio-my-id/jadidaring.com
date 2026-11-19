<?php

namespace App\Services;

/**
 * Injects GA4 (consent-gated) plus game_start / post_score hooks into stored game HTML,
 * so no game's own code or art needs editing. Does nothing when GA4 is not configured.
 */
class GameAnalytics
{
    public const MARKER = 'data-jd-ga4';

    public function inject(string $html, string $slug): string
    {
        $id = (string) config('services.ga4.measurement_id');

        if (preg_match('/^G-[A-Z0-9]{4,20}$/', $id) !== 1 || str_contains($html, self::MARKER)) {
            return $html;
        }

        $tag = '<div '.self::MARKER.' style="display:contents">'
            .view('partials.ga4-game', ['ga4' => $id, 'slug' => $slug])->render().'</div>';
        $out = preg_replace('/<\/body>/i', str_replace('\\', '\\\\', $tag).'</body>', $html, 1, $count);

        return is_string($out) && $count > 0 ? $out : $html.$tag;
    }
}

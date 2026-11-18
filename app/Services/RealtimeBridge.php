<?php

namespace App\Services;


/** Injects public/js/realtime-bridge.js into games that are on the Rust engine list. */
class RealtimeBridge
{
    public const MARKER = 'data-jdrt-bridge';

    public function inject(string $html, string $slug): string
    {
        if (! in_array(strtolower($slug), Realtime::games(), true) || str_contains($html, self::MARKER)) {
            return $html;
        }

        $path = public_path('js/realtime-bridge.js');
        $js = is_file($path) ? (string) file_get_contents($path) : '';

        if ($js === '' || str_contains($js, '</script')) {
            return $html;
        }

        $cfg = json_encode(['cfg' => '/game/'.TenantPath::segment($slug).'/api/game/config'], JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT | JSON_UNESCAPED_SLASHES);
        $tag = '<script '.self::MARKER.">\nwindow.__JD_RT=".$cfg.";\n".$js."\n</script>";
        $out = preg_replace('/<head\b[^>]*>/i', '$0'.$tag, $html, 1, $count);

        return is_string($out) && $count > 0 ? $out : $tag.$html;
    }
}

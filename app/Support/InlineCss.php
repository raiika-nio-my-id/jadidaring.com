<?php

namespace App\Support;

use Illuminate\Support\Facades\Cache;

class InlineCss
{
    /** Minified clay.css, inlined so the first paint needs no extra request. */
    public static function clay(): string
    {
        $path = public_path('css/clay.css');
        $key = 'inline-css:clay:'.(int) @filemtime($path);

        return Cache::remember($key, 86400, static function () use ($path): string {
            $css = (string) @file_get_contents($path);
            $css = preg_replace('!/\*.*?\*/!s', '', $css) ?? $css;
            $css = preg_replace('/\s+/', ' ', $css) ?? $css;
            $css = preg_replace('/\s*([{};,>])\s*/', '$1', $css) ?? $css;
            $css = preg_replace('/:\s+/', ':', $css) ?? $css;

            return str_replace(';}', '}', trim($css));
        });
    }
}

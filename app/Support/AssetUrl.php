<?php

namespace App\Support;

class AssetUrl
{
    /** Long-cached, mtime-versioned URL for a file under public/. */
    public static function to(string $path): string
    {
        $path = ltrim($path, '/');

        return '/a/'.$path.'?v='.(int) @filemtime(public_path($path));
    }
}

<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

/**
 * Serves whitelisted public assets under /a/ with a one-year immutable cache.
 * Versioned with ?v=<mtime> by AssetUrl, so it does not rely on nginx rules.
 */
class StaticAssetController extends Controller
{
    private const TYPES = [
        'css' => 'text/css; charset=utf-8',
        'js' => 'application/javascript; charset=utf-8',
        'svg' => 'image/svg+xml',
        'woff2' => 'font/woff2',
        'png' => 'image/png',
        'webp' => 'image/webp',
    ];

    public function __invoke(Request $request, string $path): BinaryFileResponse
    {
        $ext = strtolower(pathinfo($path, PATHINFO_EXTENSION));
        $root = realpath(public_path());
        $file = realpath(public_path($path));

        abort_unless(isset(self::TYPES[$ext]) && $file !== false && $root !== false && str_starts_with($file, $root.DIRECTORY_SEPARATOR) && is_file($file), 404);
        abort_unless(preg_match('#^(fonts|css|js|marketing/images)/#', $path) === 1, 404);

        $response = response()->file($file, ['Content-Type' => self::TYPES[$ext]]);
        $response->headers->set('Cache-Control', 'public, max-age=31536000, immutable');
        $response->headers->set('Vary', 'Accept-Encoding');

        return $response;
    }
}

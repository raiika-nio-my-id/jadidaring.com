<?php

namespace App\Services;

use App\Models\Article;
use Illuminate\Support\Facades\Http;
use InvalidArgumentException;

/**
 * Article images. A photo is uploaded (or downloaded from a source URL) through the admin API, cropped to
 * 1200x630 and stored as webp in 3 sizes on our own disk. Articles without a photo get a branded title
 * card rendered in code (GD, no AI). Nothing is ever hotlinked.
 */
class NewsImage
{
    public const WIDTHS = [480, 800, 1200];

    private const RATIO_H = 630;

    private const TOPIC_COLORS = [
        'politik' => [0x5B, 0x3F, 0xA6], 'gaming' => [0x1D, 0x4F, 0xA5], 'saham' => [0x1F, 0x7A, 0x4D],
        'indonesia' => [0xA1, 0x4A, 0x0B], 'musibah' => [0xB4, 0x23, 0x18], 'teknologi' => [0x0E, 0x74, 0x90],
        'sosmed' => [0xB0, 0x2A, 0x6E], 'ekonomi' => [0x8A, 0x5A, 0x00],
        'kriminal' => [0x37, 0x41, 0x51],
    ];

    public static function dir(): string
    {
        $dir = storage_path('app/news-img');

        if (! is_dir($dir)) {
            @mkdir($dir, 0775, true);
        }

        return $dir;
    }

    /** Relative URL; $version busts caches when the image changes. */
    public static function src(int $id, int $width, int|string|null $version): string
    {
        return '/gambar-berita/'.$id.'-'.$width.'.webp'.($version ? '?v='.$version : '');
    }

    public static function absolute(int $id, int $width, int|string|null $version): string
    {
        return 'https://'.TenantPath::host().self::src($id, $width, $version);
    }

    /** @return array<string, mixed> small array safe to cache */
    public static function meta(Article $a): array
    {
        $photo = $a->image_path !== null && $a->image_path !== '';

        return [
            'photo' => $photo,
            'alt' => $photo && $a->image_alt ? $a->image_alt : $a->title,
            'credit' => $photo ? $a->image_credit : null,
            'source_url' => $photo ? $a->image_source_url : null,
            'license' => $photo ? $a->image_license : null,
            'v' => ($a->image_updated_at ?? $a->updated_at)?->timestamp,
        ];
    }

    /** File to serve for an article image (photo if there is one, otherwise the cached title card). */
    public static function file(Article $a, int $width): ?string
    {
        if (! in_array($width, self::WIDTHS, true)) {
            return null;
        }

        if ($a->image_path) {
            $path = self::dir().'/'.$a->image_path.'-'.$width.'.webp';

            if (is_file($path)) {
                return $path;
            }
        }

        return self::card($a, $width);
    }

    /**
     * @param  array{alt: string, credit: string, source_url: string, license: string}  $meta
     */
    public static function storePhoto(Article $a, string $binary, array $meta): void
    {
        $info = @getimagesizefromstring($binary);

        if ($info === false || ! in_array($info[2], [IMAGETYPE_JPEG, IMAGETYPE_PNG, IMAGETYPE_WEBP, IMAGETYPE_GIF], true)) {
            throw new InvalidArgumentException('Image must be a JPEG, PNG, WebP or GIF file.');
        }

        [$w, $h] = $info;

        if ($w < 1200 || $h < self::RATIO_H) {
            throw new InvalidArgumentException("Image is {$w}x{$h}px; it must be at least 1200x630px.");
        }

        if ($w * $h > 16_000_000) {
            throw new InvalidArgumentException('Image is too large (max 16 megapixels).');
        }

        $src = @imagecreatefromstring($binary);

        if ($src === false) {
            throw new InvalidArgumentException('Image could not be decoded.');
        }

        $base = $a->id.'-'.substr(sha1($binary), 0, 10);

        // Cover-crop to 1200x630 around the centre, never upscaling.
        $scale = max(1200 / $w, self::RATIO_H / $h);
        $cw = (int) round(1200 / $scale);
        $ch = (int) round(self::RATIO_H / $scale);
        $sx = (int) max(0, floor(($w - $cw) / 2));
        $sy = (int) max(0, floor(($h - $ch) / 3));
        $full = imagecreatetruecolor(1200, self::RATIO_H);
        imagecopyresampled($full, $src, 0, 0, $sx, $sy, 1200, self::RATIO_H, min($cw, $w - $sx), min($ch, $h - $sy));
        imagedestroy($src);

        foreach (self::WIDTHS as $width) {
            $height = (int) round($width * self::RATIO_H / 1200);
            $out = $width === 1200 ? $full : imagescale($full, $width, $height, IMG_BICUBIC);
            imagewebp($out, self::dir().'/'.$base.'-'.$width.'.webp', 80);

            if ($out !== $full) {
                imagedestroy($out);
            }
        }

        imagedestroy($full);

        $old = $a->image_path;
        $a->forceFill([
            'image_path' => $base, 'image_alt' => $meta['alt'], 'image_credit' => $meta['credit'],
            'image_source_url' => $meta['source_url'], 'image_license' => $meta['license'], 'image_updated_at' => now(),
        ])->save();

        if ($old && $old !== $base) {
            self::deleteFiles($old);
        }
    }

    public static function clearPhoto(Article $a): void
    {
        $old = $a->image_path;
        $a->forceFill(['image_path' => null, 'image_alt' => null, 'image_credit' => null, 'image_source_url' => null, 'image_license' => null, 'image_updated_at' => now()])->save();

        if ($old) {
            self::deleteFiles($old);
        }
    }

    private static function deleteFiles(string $base): void
    {
        foreach (self::WIDTHS as $width) {
            @unlink(self::dir().'/'.$base.'-'.$width.'.webp');
        }
    }

    /** Download a public https image (SSRF-safe: public IPs only, pinned, max 3 redirects, 12 MB). */
    public static function download(string $url): string
    {
        for ($hop = 0; $hop < 4; $hop++) {
            $parts = parse_url($url);

            if (($parts['scheme'] ?? '') !== 'https' || empty($parts['host']) || isset($parts['user']) || isset($parts['port']) && (int) $parts['port'] !== 443) {
                throw new InvalidArgumentException('Image URL must be a plain https URL.');
            }

            $host = $parts['host'];
            $ip = self::publicIp($host);
            $options = ['allow_redirects' => false, 'timeout' => 20, 'connect_timeout' => 8];

            if (defined('CURLOPT_RESOLVE') && ! app()->environment('testing')) {
                $options['curl'] = [CURLOPT_RESOLVE => [$host.':443:'.$ip], CURLOPT_MAXFILESIZE => 12 * 1024 * 1024];
            }

            $res = Http::withOptions($options)->withHeaders(['User-Agent' => 'JadidaringBot/1.0 (+https://jadidaring.com)', 'Accept' => 'image/*'])->get($url);

            if ($res->redirect()) {
                $url = (string) $res->header('Location');

                if (! str_starts_with($url, 'https://')) {
                    throw new InvalidArgumentException('Image URL redirected somewhere that is not https.');
                }

                continue;
            }

            if (! $res->successful()) {
                throw new InvalidArgumentException('Could not download the image (HTTP '.$res->status().').');
            }

            $body = $res->body();

            if (strlen($body) > 12 * 1024 * 1024) {
                throw new InvalidArgumentException('Image is larger than 12 MB.');
            }

            return $body;
        }

        throw new InvalidArgumentException('Too many redirects.');
    }

    /** Resolve $host and refuse private, loopback, link-local or reserved addresses. */
    public static function publicIp(string $host): string
    {
        $ips = filter_var($host, FILTER_VALIDATE_IP) ? [$host] : (gethostbynamel($host) ?: []);

        if ($ips === [] && app()->environment('testing')) {
            return '93.184.216.34';
        }

        if ($ips === []) {
            throw new InvalidArgumentException('Image host could not be resolved.');
        }

        foreach ($ips as $ip) {
            if (filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE) === false) {
                throw new InvalidArgumentException('Image host is not a public address.');
            }
        }

        return $ips[0];
    }

    /** Branded 1200x630 home/share card (GD + Baloo 2), cached on disk. */
    public static function homeCard(): string
    {
        $path = self::dir().'/home-card-v1.webp';

        if (is_file($path)) {
            return $path;
        }

        $W = 1200;
        $H = 630;
        $img = imagecreatetruecolor($W, $H);

        for ($y = 0; $y < $H; $y++) {
            $t = $y / $H;
            imageline($img, 0, $y, $W, $y, imagecolorallocate($img, (int) (0x5B * (1 - .35 * $t)), (int) (0x3F * (1 - .35 * $t)), (int) (0xA6 * (1 - .3 * $t))));
        }

        $lime = imagecolorallocatealpha($img, 0xD4, 0xFF, 0x3A, 90);
        imagesetthickness($img, 3);

        for ($i = 1; $i <= 7; $i++) {
            imagearc($img, $W - 60, 40, $i * 170, $i * 170, 90, 180, $lime);
        }

        for ($i = -3; $i <= 3; $i++) {
            imageline($img, $W - 60, 40, $W - 620, 40 + $i * 120 + 280, $lime);
        }

        $font = resource_path('fonts/Baloo2.ttf');
        $white = imagecolorallocate($img, 255, 255, 255);
        $soft = imagecolorallocate($img, 235, 230, 250);
        $limeSolid = imagecolorallocate($img, 0xD4, 0xFF, 0x3A);

        foreach ([0, 1, 2] as $dx) {
            imagettftext($img, 130, 0, 80 + $dx, 290, $white, $font, 'Jaring');
        }

        imagettftext($img, 38, 0, 84, 350, $limeSolid, $font, 'Jadi Daring · jadidaring.com');
        imagettftext($img, 44, 0, 84, 470, $white, $font, 'Game web gratis, berita hangat,');
        imagettftext($img, 44, 0, 84, 530, $white, $font, 'dan komunitas digital Indonesia.');

        imagewebp($img, $path, 84);
        imagedestroy($img);

        return $path;
    }

    /** Branded title card (GD + bundled Baloo 2). Cached on disk per title/topic/width. */
    public static function card(Article $a, int $width): string
    {
        $path = self::dir().'/card-'.$a->id.'-'.$width.'-'.substr(sha1($a->title.'|'.$a->topic), 0, 8).'.webp';

        if (is_file($path)) {
            return $path;
        }

        $W = 1200;
        $H = self::RATIO_H;
        $img = imagecreatetruecolor($W, $H);
        [$r, $g, $b] = self::TOPIC_COLORS[$a->topic] ?? [0x5B, 0x3F, 0xA6];

        for ($y = 0; $y < $H; $y++) {
            $t = $y / $H;
            imageline($img, 0, $y, $W, $y, imagecolorallocate($img, (int) ($r * (1 - .35 * $t)), (int) ($g * (1 - .35 * $t)), (int) ($b * (1 - .35 * $t))));
        }

        // Soft "net" accent in the corner (brand lime), drawn with thin arcs.
        $lime = imagecolorallocatealpha($img, 0xD4, 0xFF, 0x3A, 95);
        imagesetthickness($img, 3);

        for ($i = 1; $i <= 6; $i++) {
            imagearc($img, $W - 60, 40, $i * 160, $i * 160, 90, 180, $lime);
        }

        for ($i = -3; $i <= 3; $i++) {
            imageline($img, $W - 60, 40, $W - 60 - 560, 40 + $i * 120 + 280, $lime);
        }

        $font = resource_path('fonts/Baloo2.ttf');
        $white = imagecolorallocate($img, 255, 255, 255);
        $soft = imagecolorallocate($img, 235, 230, 250);
        $topicName = (\App\Http\Controllers\ClayController::TOPICS[$a->topic] ?? ucfirst($a->topic));

        // Topic pill.
        $bb = imagettfbbox(30, 0, $font, $topicName);
        $pw = ($bb[2] - $bb[0]) + 56;
        imagefilledrectangle($img, 72 + 22, 64, 72 + $pw - 22, 64 + 58, $white);
        imagefilledellipse($img, 72 + 22, 64 + 29, 58, 58, $white);
        imagefilledellipse($img, 72 + $pw - 22, 64 + 29, 58, 58, $white);
        imagettftext($img, 30, 0, 72 + 28, 64 + 42, imagecolorallocate($img, (int) ($r * .8), (int) ($g * .8), (int) ($b * .8)), $font, $topicName);

        // Title, wrapped to the card width (up to 5 lines, faux-bold by double strike).
        $size = 54;
        $lines = self::wrap($a->title, $font, $size, $W - 144);

        if (count($lines) > 5) {
            $size = 46;
            $lines = self::wrap($a->title, $font, $size, $W - 144);
        }

        $lines = array_slice($lines, 0, 5);

        if (count(self::wrap($a->title, $font, $size, $W - 144)) > 5) {
            $lines[4] = rtrim($lines[4], ' .,').'…';
        }

        $y = 200;

        foreach ($lines as $line) {
            imagettftext($img, $size, 0, 72, $y, $white, $font, $line);
            imagettftext($img, $size, 0, 73, $y, $white, $font, $line);
            $y += (int) ($size * 1.28);
        }

        imagettftext($img, 30, 0, 72, $H - 48, $soft, $font, 'Jaring');
        imagettftext($img, 30, 0, 73, $H - 48, $soft, $font, 'Jaring');
        imagettftext($img, 22, 0, 190, $H - 48, $soft, $font, 'Jadi Daring · jadidaring.com');

        $out = $width === $W ? $img : imagescale($img, $width, (int) round($width * $H / $W), IMG_BICUBIC);
        imagewebp($out, $path, 82);
        imagedestroy($img);

        if ($out !== $img) {
            imagedestroy($out);
        }

        return $path;
    }

    /** @return list<string> */
    private static function wrap(string $text, string $font, int $size, int $max): array
    {
        $lines = [];
        $line = '';

        foreach (preg_split('/\s+/', trim($text)) ?: [] as $word) {
            $try = $line === '' ? $word : $line.' '.$word;
            $bb = imagettfbbox($size, 0, $font, $try);

            if (($bb[2] - $bb[0]) > $max && $line !== '') {
                $lines[] = $line;
                $line = $word;
            } else {
                $line = $try;
            }
        }

        if ($line !== '') {
            $lines[] = $line;
        }

        return $lines;
    }
}

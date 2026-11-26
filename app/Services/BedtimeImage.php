<?php

namespace App\Services;

use App\Models\BedtimeStory;
use InvalidArgumentException;

/**
 * Bed Time Stories images. A photo is uploaded (or downloaded from a source URL)
 * through the admin panel or admin API, cropped to 1200x630 and stored as webp in 3 sizes.
 * Stories without a photo get a branded title card rendered in code (GD, Baloo 2 font).
 */
class BedtimeImage
{
    public const WIDTHS = [480, 800, 1200];

    private const RATIO_H = 630;

    public static function dir(): string
    {
        $dir = storage_path('app/bedtime-img');

        if (! is_dir($dir)) {
            @mkdir($dir, 0775, true);
        }

        return $dir;
    }

    /** Relative URL; $version busts caches when the image changes. */
    public static function src(int $id, int $width, int|string|null $version = null): string
    {
        return '/bedtime-stories/'.$id.'-'.$width.'.webp'.($version ? '?v='.$version : '');
    }

    public static function absolute(int $id, int $width, int|string|null $version = null): string
    {
        return 'https://'.TenantPath::host().self::src($id, $width, $version);
    }

    /** @return array<string, mixed> small array safe to cache */
    public static function meta(BedtimeStory $s): array
    {
        $photo = $s->image_path !== null && $s->image_path !== '';

        return [
            'photo' => $photo,
            'alt' => $photo && $s->image_alt ? $s->image_alt : $s->title,
            'credit' => $photo ? $s->image_credit : null,
            'source_url' => $photo ? $s->image_source_url : null,
            'license' => $photo ? $s->image_license : null,
            'v' => ($s->image_updated_at ?? $s->updated_at)?->timestamp,
        ];
    }

    /** File to serve for a bedtime story image (photo if there is one, otherwise the cached title card). */
    public static function file(BedtimeStory $s, int $width): ?string
    {
        if (! in_array($width, self::WIDTHS, true)) {
            return null;
        }

        if ($s->image_path) {
            $path = self::dir().'/'.$s->image_path.'-'.$width.'.webp';

            if (is_file($path)) {
                return $path;
            }
        }

        return self::card($s, $width);
    }

    /**
     * @param  array{alt?: ?string, credit: string, source_url?: ?string, license?: ?string}  $meta
     */
    public static function storePhoto(BedtimeStory $s, string $binary, array $meta): void
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

        $base = $s->id.'-'.substr(sha1($binary), 0, 10);

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

        $old = $s->image_path;
        $s->forceFill([
            'image_path' => $base,
            'image_alt' => $meta['alt'] ?? $s->title,
            'image_credit' => $meta['credit'],
            'image_source_url' => $meta['source_url'] ?? null,
            'image_license' => $meta['license'] ?? null,
            'image_updated_at' => now(),
        ])->save();

        if ($old && $old !== $base) {
            self::deleteFiles($old);
        }
    }

    public static function clearPhoto(BedtimeStory $s): void
    {
        $old = $s->image_path;
        $s->forceFill([
            'image_path' => null,
            'image_alt' => null,
            'image_credit' => null,
            'image_source_url' => null,
            'image_license' => null,
            'image_updated_at' => now(),
        ])->save();

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

    /** Download a public https image (SSRF-safe). */
    public static function download(string $url): string
    {
        return NewsImage::download($url);
    }

    /** Branded title card (GD + Baloo 2). Cached on disk per title/author/width. */
    public static function card(BedtimeStory $s, int $width): string
    {
        $hash = substr(sha1($s->title.'|'.$s->author), 0, 8);
        $path = self::dir().'/bedtime-card-'.$s->id.'-'.$width.'-'.$hash.'.webp';

        if (is_file($path)) {
            return $path;
        }

        $W = 1200;
        $H = self::RATIO_H;
        $img = imagecreatetruecolor($W, $H);

        // Nighttime deep blue / purple gradient (midnight atmosphere)
        for ($y = 0; $y < $H; $y++) {
            $t = $y / $H;
            $r = (int) (0x1E * (1 - 0.4 * $t) + 0x0F * (0.4 * $t));
            $g = (int) (0x1B * (1 - 0.3 * $t) + 0x17 * (0.3 * $t));
            $b = (int) (0x4B * (1 - 0.4 * $t) + 0x2A * (0.4 * $t));
            imageline($img, 0, $y, $W, $y, imagecolorallocate($img, $r, $g, $b));
        }

        // Soft moon/star arc accent in the upper corner (warm golden yellow)
        $gold = imagecolorallocatealpha($img, 0xFE, 0xF0, 0x8A, 95);
        imagesetthickness($img, 3);

        for ($i = 1; $i <= 6; $i++) {
            imagearc($img, $W - 60, 40, $i * 160, $i * 160, 90, 180, $gold);
        }

        for ($i = -3; $i <= 3; $i++) {
            imageline($img, $W - 60, 40, $W - 60 - 560, 40 + $i * 120 + 280, $gold);
        }

        $font = resource_path('fonts/Baloo2.ttf');
        $white = imagecolorallocate($img, 255, 255, 255);
        $soft = imagecolorallocate($img, 224, 231, 255);
        $goldSolid = imagecolorallocate($img, 0xFE, 0xF0, 0x8A);
        $label = 'Bed Time Stories';

        // Category pill
        $bb = imagettfbbox(28, 0, $font, $label);
        $pw = ($bb[2] - $bb[0]) + 56;
        imagefilledrectangle($img, 72 + 22, 60, 72 + $pw - 22, 60 + 54, $white);
        imagefilledellipse($img, 72 + 22, 60 + 27, 54, 54, $white);
        imagefilledellipse($img, 72 + $pw - 22, 60 + 27, 54, 54, $white);
        imagettftext($img, 28, 0, 72 + 28, 60 + 39, imagecolorallocate($img, 0x1E, 0x1B, 0x4B), $font, $label);

        // Title, wrapped to the card width (up to 5 lines, faux-bold by double strike)
        $size = 52;
        $lines = self::wrap($s->title, $font, $size, $W - 144);

        if (count($lines) > 4) {
            $size = 44;
            $lines = self::wrap($s->title, $font, $size, $W - 144);
        }

        $lines = array_slice($lines, 0, 4);

        if (count(self::wrap($s->title, $font, $size, $W - 144)) > 4) {
            $lines[3] = rtrim($lines[3], ' .,').'…';
        }

        $y = 195;

        foreach ($lines as $line) {
            imagettftext($img, $size, 0, 72, $y, $white, $font, $line);
            imagettftext($img, $size, 0, 73, $y, $white, $font, $line);
            $y += (int) ($size * 1.28);
        }

        // Author attribution
        $byText = 'oleh '.$s->author.($s->author_origin ? ' ('.$s->author_origin.')' : '');
        imagettftext($img, 26, 0, 72, $y + 20, $goldSolid, $font, $byText);

        // Footer brand
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

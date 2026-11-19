<?php

namespace App\Services;

use InvalidArgumentException;

/**
 * The one optional image of a Curhatan post. Same pipeline as ProfileImage: raster JPEG/PNG/WebP/GIF only,
 * decoded with GD (after applying the EXIF orientation) and re-encoded to WebP, so EXIF/GPS metadata and any
 * other original bytes are never stored or served. Files live outside public/ and are only served through
 * the visibility-checked /curhatan/{post}/gambar route.
 */
class PostImage
{
    public const MAX_SIDE = 1600;

    public static function dir(int $userId): string
    {
        $dir = storage_path('app/post-img/'.$userId);
        if (! is_dir($dir)) {
            @mkdir($dir, 0775, true);
        }

        return $dir;
    }

    public static function path(int $userId, string $name): ?string
    {
        if (preg_match('~^[a-f0-9]{20}\.webp$~', $name) !== 1) {
            return null;
        }
        $path = storage_path('app/post-img/'.$userId.'/'.$name);

        return is_file($path) ? $path : null;
    }

    /** @return string stored file name ({hash}.webp) */
    public static function store(int $userId, string $binary): string
    {
        if (strlen($binary) === 0 || strlen($binary) > ProfileImage::MAX_BYTES) {
            throw new InvalidArgumentException('Ukuran gambar maksimal 5 MB.');
        }
        $info = @getimagesizefromstring($binary);
        if ($info === false || ! in_array($info[2], [IMAGETYPE_JPEG, IMAGETYPE_PNG, IMAGETYPE_WEBP, IMAGETYPE_GIF], true)) {
            throw new InvalidArgumentException('Format harus JPG, PNG, WebP, atau GIF.');
        }
        [$w, $h] = $info;
        if ($w < 8 || $h < 8 || $w * $h > ProfileImage::MAX_PIXELS) {
            throw new InvalidArgumentException('Ukuran gambar tidak didukung (maks. 25 megapiksel).');
        }
        $src = @imagecreatefromstring($binary);
        if ($src === false) {
            throw new InvalidArgumentException('Gambar tidak bisa dibaca.');
        }
        if (! imageistruecolor($src)) {
            imagepalettetotruecolor($src);
        }
        if ($info[2] === IMAGETYPE_JPEG) {
            $src = self::orient($src, $binary);
        }
        $img = ProfileImage::fit($src, imagesx($src), imagesy($src), self::MAX_SIDE, self::MAX_SIDE, false);
        $name = substr(hash('sha256', $userId.'|post|'.random_bytes(8).$binary), 0, 20).'.webp';
        imagewebp($img, self::dir($userId).'/'.$name, 82);
        imagedestroy($img);
        imagedestroy($src);

        return $name;
    }

    public static function delete(int $userId, ?string $name): void
    {
        $path = $name ? self::path($userId, $name) : null;
        if ($path !== null) {
            @unlink($path);
        }
    }

    /** Phone photos store rotation in EXIF; bake it into the pixels because the metadata is dropped. */
    private static function orient(\GdImage $src, string $binary): \GdImage
    {
        if (! function_exists('exif_read_data')) {
            return $src;
        }
        $exif = @exif_read_data('data://image/jpeg;base64,'.base64_encode($binary));
        $o = is_array($exif) ? (int) ($exif['Orientation'] ?? 1) : 1;
        $rotated = match ($o) {
            3 => imagerotate($src, 180, 0),
            6 => imagerotate($src, -90, 0),
            8 => imagerotate($src, 90, 0),
            default => null,
        };
        if ($rotated instanceof \GdImage) {
            imagedestroy($src);

            return $rotated;
        }

        return $src;
    }
}

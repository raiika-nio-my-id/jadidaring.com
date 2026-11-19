<?php

namespace App\Services;

use App\Models\MemberPage;
use App\Models\MemberPageDraft;
use InvalidArgumentException;

/**
 * Member profile uploads (background, avatar, gallery, cursor). Only raster JPEG/PNG/WebP/GIF are accepted
 * (no SVG), decoded with GD and re-encoded, so no original bytes (metadata, scripts, polyglots) are ever served.
 * Files are content-hashed under storage/app/profile-img/{userId}/ and referenced in the config by a
 * strict relative path that ProfileConfig validates.
 */
class ProfileImage
{
    public const KINDS = ['bg', 'avatar', 'gallery', 'cursor'];

    public const MAX_BYTES = 5 * 1024 * 1024;

    public const MAX_PIXELS = 25_000_000;

    public const CURSOR_SIZES = [24, 32, 48];

    /** Files kept per member before old unreferenced ones are pruned. */
    public const KEEP = 30;

    /** Valid reference, e.g. /gambar-profil/12/0123456789abcdef0123.webp or …-c32.png for cursors. */
    public const REF = '~^/gambar-profil/(\d{1,10})/([a-f0-9]{20})(?:\.webp|-c(24|32|48)\.png)$~';

    public static function dir(int $userId): string
    {
        $dir = storage_path('app/profile-img/'.$userId);
        if (! is_dir($dir)) {
            @mkdir($dir, 0775, true);
        }

        return $dir;
    }

    /** Path on disk for a served file name, or null if the name is not one we produce. */
    public static function file(int $userId, string $name): ?string
    {
        if (preg_match('~^[a-f0-9]{20}(?:\.webp|-c(?:24|32|48)\.png)$~', $name) !== 1) {
            return null;
        }
        $path = storage_path('app/profile-img/'.$userId.'/'.$name);

        return is_file($path) ? $path : null;
    }

    /** @return string the config reference of the stored image */
    public static function store(int $userId, string $kind, string $binary): string
    {
        if (! in_array($kind, self::KINDS, true)) {
            throw new InvalidArgumentException('Jenis gambar tidak dikenal.');
        }
        if (strlen($binary) === 0 || strlen($binary) > self::MAX_BYTES) {
            throw new InvalidArgumentException('Ukuran gambar maksimal 5 MB.');
        }
        $info = @getimagesizefromstring($binary);
        if ($info === false || ! in_array($info[2], [IMAGETYPE_JPEG, IMAGETYPE_PNG, IMAGETYPE_WEBP, IMAGETYPE_GIF], true)) {
            throw new InvalidArgumentException('Format harus JPG, PNG, WebP, atau GIF.');
        }
        [$w, $h] = $info;
        if ($w < 8 || $h < 8 || $w * $h > self::MAX_PIXELS) {
            throw new InvalidArgumentException('Ukuran gambar tidak didukung (maks. 25 megapiksel).');
        }
        $src = @imagecreatefromstring($binary);
        if ($src === false) {
            throw new InvalidArgumentException('Gambar tidak bisa dibaca.');
        }
        if (! imageistruecolor($src)) {
            imagepalettetotruecolor($src);
        }

        $hash = substr(hash('sha256', $userId.'|'.$kind.'|'.$binary), 0, 20);
        $dir = self::dir($userId);

        if ($kind === 'cursor') {
            foreach (self::CURSOR_SIZES as $size) {
                $img = self::fit($src, $w, $h, $size, $size, false);
                imagepng($img, $dir.'/'.$hash.'-c'.$size.'.png', 9);
                imagedestroy($img);
            }
            $ref = '/gambar-profil/'.$userId.'/'.$hash.'-c32.png';
        } else {
            $img = match ($kind) {
                'avatar' => self::fit($src, $w, $h, 320, 320, true),
                'gallery' => self::fit($src, $w, $h, 1200, 1200, false),
                default => self::fit($src, $w, $h, 1920, 1920, false),
            };
            imagewebp($img, $dir.'/'.$hash.'.webp', 82);
            imagedestroy($img);
            $ref = '/gambar-profil/'.$userId.'/'.$hash.'.webp';
        }
        imagedestroy($src);
        self::prune($userId);

        return $ref;
    }

    /** Scales down (never up) into a max box; $cover crops to exactly that box from the centre. Keeps alpha. */
    public static function fit(\GdImage $src, int $w, int $h, int $maxW, int $maxH, bool $cover): \GdImage
    {
        if ($cover) {
            $side = min($w, $h);
            $sx = (int) floor(($w - $side) / 2);
            $sy = (int) floor(($h - $side) / 2);
            $tw = $th = min($maxW, $side);
            [$cw, $ch] = [$side, $side];
        } else {
            $scale = min(1, $maxW / $w, $maxH / $h);
            $tw = max(1, (int) round($w * $scale));
            $th = max(1, (int) round($h * $scale));
            [$sx, $sy, $cw, $ch] = [0, 0, $w, $h];
        }
        $out = imagecreatetruecolor($tw, $th);
        imagealphablending($out, false);
        imagesavealpha($out, true);
        imagefill($out, 0, 0, imagecolorallocatealpha($out, 0, 0, 0, 127));
        imagecopyresampled($out, $src, 0, 0, $sx, $sy, $tw, $th, $cw, $ch);

        return $out;
    }

    /** Keeps the newest KEEP files plus anything the page or draft still references. */
    public static function prune(int $userId): void
    {
        $dir = self::dir($userId);
        $files = array_merge(glob($dir.'/*.webp') ?: [], glob($dir.'/*.png') ?: []);
        if (count($files) <= self::KEEP * 3) {
            return;
        }
        $refs = json_encode([MemberPage::query()->where('user_id', $userId)->value('config'), MemberPageDraft::query()->where('user_id', $userId)->value('config')]);
        usort($files, fn (string $a, string $b): int => filemtime($b) <=> filemtime($a));
        foreach (array_slice($files, self::KEEP * 3) as $f) {
            $hash = substr(basename($f), 0, 20);
            if (! str_contains((string) $refs, $hash)) {
                @unlink($f);
            }
        }
    }
}

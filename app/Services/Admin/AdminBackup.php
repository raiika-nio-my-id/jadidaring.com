<?php

namespace App\Services\Admin;

use Illuminate\Support\Facades\File;

/** JSON backups written before any /admin delete (storage/app/backups/admin). Throws when the file cannot be verified. */
class AdminBackup
{
    public static function dir(): string
    {
        return storage_path('app/backups/admin');
    }

    /**
     * @param  array<mixed>  $data
     */
    public static function write(string $name, array $data): string
    {
        File::ensureDirectoryExists(self::dir());
        $file = self::dir().'/'.preg_replace('/[^a-z0-9_.-]/i', '_', $name).'-'.date('Ymd-His').'-'.bin2hex(random_bytes(3)).'.json';
        file_put_contents($file, json_encode(['backed_up_at' => now()->toIso8601String(), 'data' => $data], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_INVALID_UTF8_SUBSTITUTE));

        if (! is_file($file) || json_decode((string) file_get_contents($file), true) === null) {
            throw new \RuntimeException('Backup gagal ditulis; tidak ada yang dihapus.');
        }

        return $file;
    }
}

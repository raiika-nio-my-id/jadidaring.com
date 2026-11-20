<?php

namespace App\Http\Controllers\Panel;

use App\Http\Controllers\Controller;
use App\Services\Admin\AdminAudit;
use App\Services\Admin\AdminBackup;
use Illuminate\Http\Request;
use Illuminate\View\View;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

/** /admin Backup: JSON backups written before deletes (deleted users and /admin deletes), listed and downloadable. Read-only. */
class BackupController extends Controller
{
    /** @return array<string, string> folder key => absolute dir */
    private static function dirs(): array
    {
        return ['user' => storage_path('app/backups'), 'admin' => AdminBackup::dir()];
    }

    public function index(): View
    {
        $files = [];
        foreach (self::dirs() as $key => $dir) {
            foreach (glob($dir.'/*.json') ?: [] as $path) {
                $files[] = ['dir' => $key, 'name' => basename($path), 'size' => (int) filesize($path), 'at' => (int) filemtime($path)];
            }
        }
        usort($files, fn (array $a, array $b): int => $b['at'] <=> $a['at']);

        return view('panel.backups', ['files' => array_slice($files, 0, 300), 'total' => count($files)]);
    }

    public function download(Request $request, string $dir, string $name): BinaryFileResponse
    {
        $base = self::dirs()[$dir] ?? null;
        abort_if($base === null || preg_match('/^[A-Za-z0-9_.-]{1,200}\.json$/', $name) !== 1, 404);
        $path = $base.'/'.$name;
        abort_unless(is_file($path) && dirname((string) realpath($path)) === realpath($base), 404);
        AdminAudit::log($request, 'backup.download', 'backup', null, $name);

        return response()->download($path, $name, ['Content-Type' => 'application/json; charset=utf-8']);
    }
}

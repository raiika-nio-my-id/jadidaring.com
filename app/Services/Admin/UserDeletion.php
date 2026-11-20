<?php

namespace App\Services\Admin;

use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Schema;

/**
 * Deletes one member account after a verified JSON backup of its rows.
 * Shared by `users:delete-test` and the /admin User section. Admins and client-site owners are always refused.
 */
class UserDeletion
{
    public const BACKUP_TABLES = ['member_pages', 'member_page_drafts', 'member_page_comments', 'member_follows', 'prompt_form_states', 'member_posts', 'member_post_comments', 'member_post_likes', 'article_comments'];

    /** Why this user may not be deleted, or null when deletion is allowed. */
    public static function refusal(?User $user): ?string
    {
        if (! $user instanceof User) {
            return 'User tidak ditemukan.';
        }

        if ($user->isAdmin()) {
            return 'Akun admin tidak bisa dihapus.';
        }

        if (! $user->isMember() || $user->companyProfile()->exists()) {
            return 'Hanya akun member tanpa situs klien yang bisa dihapus.';
        }

        return null;
    }

    /**
     * @return array<string, array<int, mixed>|array<string, mixed>>
     */
    public static function rows(User $user): array
    {
        $rows = ['user' => $user->toArray()];

        foreach (self::BACKUP_TABLES as $table) {
            if (! Schema::hasTable($table)) {
                continue;
            }

            $q = DB::table($table);
            $rows[$table] = $table === 'member_follows'
                ? $q->where('follower_id', $user->id)->orWhere('followed_id', $user->id)->get()->all()
                : $q->where('user_id', $user->id)->get()->all();
        }

        return $rows;
    }

    /**
     * Writes and re-reads the backup. Throws when it cannot be verified, so nothing is deleted.
     *
     * @param  array<string, mixed>  $rows
     */
    public static function backup(User $user, array $rows): string
    {
        $dir = storage_path('app/backups');
        File::ensureDirectoryExists($dir);
        $file = $dir.'/deleted-user-'.preg_replace('/[^a-z0-9_.-]/i', '_', (string) ($user->username ?? $user->id)).'-'.date('Ymd-His').'.json';
        file_put_contents($file, json_encode($rows, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));

        if (! is_file($file) || json_decode((string) file_get_contents($file), true) === null) {
            throw new \RuntimeException('Backup verification failed; nothing deleted.');
        }

        return $file;
    }

    /** Backup first, then delete (sessions too). Returns the backup path. */
    public static function delete(User $user): string
    {
        if (($why = self::refusal($user)) !== null) {
            throw new \RuntimeException($why);
        }

        $file = self::backup($user, self::rows($user));
        DB::table('sessions')->where('user_id', $user->id)->delete();
        $user->delete();

        return $file;
    }
}

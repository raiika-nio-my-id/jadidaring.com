<?php

namespace App\Console\Commands;

use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Schema;

/** Removes one throwaway member account named tmp<digits> (and its cascaded rows), after a JSON backup of its rows. */
class DeleteTestUser extends Command
{
    protected $signature = 'users:delete-test {username} {--force} {--allow-non-test : allow any non-admin member username (not just tmp<digits>)}';

    protected $description = 'Delete a single throwaway test member (tmp + digits), with a scoped row backup first';

    public function handle(): int
    {
        $username = (string) $this->argument('username');

        $allowAny = (bool) $this->option('allow-non-test');
        $pattern = $allowAny ? '/^[a-z0-9_.-]{3,32}$/' : '/^tmp[0-9]{3,20}$/';

        if (preg_match($pattern, $username) !== 1) {
            $this->error($allowAny ? 'Invalid username.' : 'Only tmp<digits> accounts can be deleted with this command.');

            return self::FAILURE;
        }

        $user = User::query()->where('username', $username)->first();

        if ($user instanceof User && $user->isAdmin()) {
            $this->error('Refusing: this is an admin account.');

            return self::FAILURE;
        }

        if (! $user instanceof User || ! $user->isMember() || $user->companyProfile()->exists()) {
            $this->error('No such throwaway member (or it owns a client site).');

            return self::FAILURE;
        }

        $rows = ['user' => $user->toArray()];
        foreach (['member_pages', 'member_page_drafts', 'member_page_comments', 'member_follows', 'prompt_form_states', 'member_posts', 'member_post_comments', 'member_post_likes', 'article_comments'] as $table) {
            if (Schema::hasTable($table)) {
                $q = DB::table($table);
                $rows[$table] = match ($table) {
                    'member_follows' => $q->where('follower_id', $user->id)->orWhere('followed_id', $user->id)->get()->all(),
                    'member_page_comments' => $q->where('user_id', $user->id)->get()->all(),
                    default => $q->where('user_id', $user->id)->get()->all(),
                };
            }
        }

        $dir = storage_path('app/backups');
        File::ensureDirectoryExists($dir);
        $file = $dir.'/deleted-user-'.$username.'-'.date('Ymd-His').'.json';
        file_put_contents($file, json_encode($rows, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));

        if (! is_file($file) || json_decode((string) file_get_contents($file), true) === null) {
            $this->error('Backup verification failed; nothing deleted.');

            return self::FAILURE;
        }

        $this->info('Backup written: '.$file);
        $this->info('User #'.$user->id.' provider='.($user->provider ?: 'none').' role='.$user->role->value);
        foreach ($rows as $t => $r) {
            $this->line('  backup '.$t.': '.($t === 'user' ? 1 : count($r)));
        }

        if (! $this->option('force')) {
            $this->info('Dry run; pass --force to delete.');

            return self::SUCCESS;
        }

        DB::table('sessions')->where('user_id', $user->id)->delete();
        $user->delete();
        $this->info('Deleted '.$username.'.');

        return self::SUCCESS;
    }
}

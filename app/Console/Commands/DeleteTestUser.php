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
    protected $signature = 'users:delete-test {username} {--force}';

    protected $description = 'Delete a single throwaway test member (tmp + digits), with a scoped row backup first';

    public function handle(): int
    {
        $username = (string) $this->argument('username');

        if (preg_match('/^tmp[0-9]{3,20}$/', $username) !== 1) {
            $this->error('Only tmp<digits> accounts can be deleted with this command.');

            return self::FAILURE;
        }

        $user = User::query()->where('username', $username)->first();

        if (! $user instanceof User || ! $user->isMember() || $user->companyProfile()->exists()) {
            $this->error('No such throwaway member (or it owns a client site).');

            return self::FAILURE;
        }

        $rows = ['user' => $user->toArray()];
        foreach (['member_pages', 'member_page_drafts', 'member_page_comments', 'member_follows', 'prompt_form_states', 'member_posts', 'member_post_comments', 'member_post_likes'] as $table) {
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

        $this->info('Backup written: '.basename($file));

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

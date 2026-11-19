<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class BackfillEmailNormalized extends Command
{
    protected $signature = 'users:backfill-email-normalized';

    protected $description = 'Fill users.email_normalized after a verified row backup. Idempotent. Duplicates stay null; prints counts and usernames only.';

    public function handle(): int
    {
        $rows = DB::table('users')->orderBy('id')->get(['id', 'username', 'email', 'email_normalized'])->all();

        $dir = storage_path('app/backups');
        @mkdir($dir, 0775, true);
        $file = $dir.'/users-email-'.date('Ymd-His').'.json';
        file_put_contents($file, json_encode($rows));
        $back = json_decode((string) file_get_contents($file), true);

        if (! is_array($back) || count($back) !== count($rows)) {
            $this->error('Backup verification failed; nothing changed.');

            return self::FAILURE;
        }

        $this->info('Backup verified: '.basename($file).' ('.count($rows).' users)');

        $migration = require database_path('migrations/2026_11_19_000030_add_email_normalized_to_users.php');
        $collisions = $migration::backfill();

        $withEmail = DB::table('users')->whereNotNull('email')->count();
        $this->line('users total: '.DB::table('users')->count());
        $this->line('users with email: '.$withEmail);
        $this->line('email_normalized set: '.DB::table('users')->whereNotNull('email_normalized')->count());
        $this->line('collisions: '.count($collisions));
        foreach ($collisions as $c) {
            $this->line('  collision username: '.($c['duplicate_username'] ?? '?').' (duplicate of user id '.$c['kept_user_id'].')');
        }

        return self::SUCCESS;
    }
}

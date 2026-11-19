<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;

class BackfillEmailNormalized extends Command
{
    protected $signature = 'users:backfill-email-normalized';

    protected $description = 'Fill users.email_normalized (run after a verified backup). Duplicates stay null and are listed.';

    public function handle(): int
    {
        $migration = require database_path('migrations/2026_11_19_000030_add_email_normalized_to_users.php');
        $collisions = $migration::backfill();
        $this->info('Done. Duplicates left null: '.count($collisions));
        foreach ($collisions as $c) {
            $this->line(json_encode($c));
        }

        return self::SUCCESS;
    }
}

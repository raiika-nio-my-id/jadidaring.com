<?php

use App\Support\EmailNormalizer;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table): void {
            $table->string('email_normalized')->nullable()->unique()->after('email');
            $table->string('pending_email')->nullable()->after('email_normalized');
        });

        if (! $this->backupIsFresh()) {
            // Deploys dump the database to storage/backups before migrating. Never rewrite user data without one.
            Log::warning('email_normalized backfill skipped: no verified backup newer than 30 minutes. Run `php artisan users:backfill-email-normalized`.');

            return;
        }

        self::backfill();
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table): void {
            $table->dropUnique(['email_normalized']);
            $table->dropColumn(['email_normalized', 'pending_email']);
        });
    }

    public static function backfill(): array
    {
        $seen = [];
        $collisions = [];

        foreach (DB::table('users')->whereNotNull('email')->orderBy('id')->get(['id', 'email', 'username']) as $u) {
            $norm = EmailNormalizer::normalize($u->email);

            if ($norm === null) {
                continue;
            }

            if (isset($seen[$norm])) {
                $collisions[] = ['kept_user_id' => $seen[$norm], 'duplicate_user_id' => $u->id, 'duplicate_username' => $u->username, 'email' => $u->email, 'normalized' => $norm];

                continue;
            }

            $seen[$norm] = $u->id;
            DB::table('users')->where('id', $u->id)->update(['email_normalized' => $norm]);
        }

        if ($collisions !== []) {
            Log::warning('email_normalized backfill: duplicates left null', $collisions);
            @file_put_contents(storage_path('app/email-normalized-collisions.json'), json_encode($collisions, JSON_PRETTY_PRINT));
        }

        return $collisions;
    }

    private function backupIsFresh(): bool
    {
        if (DB::getDriverName() === 'sqlite') {
            return DB::table('users')->count() === 0;
        }

        $files = glob(storage_path('backups/*.sql.gz')) ?: [];
        usort($files, fn ($a, $b) => filemtime($b) <=> filemtime($a));

        if ($files === [] || (time() - filemtime($files[0])) > 1800 || filesize($files[0]) < 1024) {
            return false;
        }

        $h = gzopen($files[0], 'rb');
        $ok = false;
        while ($h && ! gzeof($h)) {
            $c = gzread($h, 1048576);
            if ($c === false) { $ok = false; break; }
            $ok = $ok || str_contains($c, '`users`');
        }
        $h && gzclose($h);

        return $ok;
    }
};

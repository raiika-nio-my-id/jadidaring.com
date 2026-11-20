<?php

namespace App\Console\Commands;

use App\Models\User;
use App\Services\Admin\UserDeletion;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

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

        $rows = UserDeletion::rows($user);

        try {
            $file = UserDeletion::backup($user, $rows);
        } catch (\RuntimeException $e) {
            $this->error($e->getMessage());

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

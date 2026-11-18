<?php

namespace App\Console\Commands;

use App\Enums\UserRole;
use App\Models\CompanyProfile;
use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use RuntimeException;

/**
 * Safe purge of surplus user accounts. Dry-run unless --force.
 *
 * company_profiles.user_id is UNIQUE (one profile per user) and cascades on
 * delete, so profiles cannot be pooled under one system owner. Instead every
 * user that owns ANY profile (game or client site) is protected, as is every
 * admin. Only accounts that own nothing are candidates, so the cascade has
 * nothing to delete. Game rooms, players, scores and nicknames hang off
 * company_profiles and display names, never off users, so they are unaffected.
 */
class PurgeUsers extends Command
{
    protected $signature = 'users:purge
        {--force : Execute the purge (default is a read-only dry run)}
        {--include-members : Also remove self-registered members (default keeps them)}
        {--before= : Only remove accounts created before this date (YYYY-MM-DD)}
        {--max-backup-age=60 : Maximum age in minutes of the verified backup}';

    protected $description = 'Dry-run (default) or execute removal of user accounts that own no profile; admins and profile owners are always kept';

    public function handle(): int
    {
        $before = $this->option('before');

        if ($before !== null && preg_match('/^\d{4}-\d{2}-\d{2}$/', (string) $before) !== 1) {
            $this->error('--before must be YYYY-MM-DD.');

            return self::FAILURE;
        }

        $report = $this->report($before !== null ? (string) $before : null, (bool) $this->option('include-members'));
        $this->render($report);

        if (! $this->option('force')) {
            $this->info('DRY RUN: nothing was changed. Re-run with --force after a fresh verified backup to execute.');

            return self::SUCCESS;
        }

        if ($report['admins'] < 1) {
            $this->error('Refusing: no admin account would remain.');

            return self::FAILURE;
        }

        try {
            $backup = $this->verifiedBackup((int) $this->option('max-backup-age'));
        } catch (RuntimeException $e) {
            $this->error('Refusing: '.$e->getMessage());

            return self::FAILURE;
        }

        $this->info('Backup verified: '.$backup);

        if ($report['candidate_ids'] === []) {
            $this->info('No candidates. Nothing to do.');

            return self::SUCCESS;
        }

        $profilesBefore = CompanyProfile::query()->count();
        $adminsBefore = User::query()->where('role', UserRole::Admin->value)->count();

        DB::transaction(function () use ($report, $profilesBefore, $adminsBefore): void {
            foreach (array_chunk($report['candidate_ids'], 200) as $ids) {
                // Re-check ownership inside the transaction; never delete an owner.
                $safe = User::query()->whereIn('id', $ids)
                    ->where('role', '!=', UserRole::Admin->value)
                    ->whereDoesntHave('companyProfile')
                    ->pluck('id')->all();

                if ($safe === []) {
                    continue;
                }

                if (Schema::hasTable('sessions')) {
                    DB::table('sessions')->whereIn('user_id', $safe)->delete();
                }

                $emails = User::query()->whereIn('id', $safe)->whereNotNull('email')->pluck('email')->all();

                if ($emails !== []) {
                    DB::table('password_reset_tokens')->whereIn('email', $emails)->delete();
                }

                User::query()->whereIn('id', $safe)->delete();
            }

            if (CompanyProfile::query()->count() !== $profilesBefore) {
                throw new RuntimeException('Profile count changed; rolling back.');
            }

            if (User::query()->where('role', UserRole::Admin->value)->count() !== $adminsBefore) {
                throw new RuntimeException('Admin count changed; rolling back.');
            }
        });

        $this->info('Purged '.count($report['candidate_ids']).' account(s). Profiles untouched: '.$profilesBefore.'.');

        return self::SUCCESS;
    }

    /**
     * @return array<string, mixed>
     */
    private function report(?string $before, bool $includeMembers): array
    {
        $roles = User::query()->selectRaw('role, COUNT(*) as c')->groupBy('role')->pluck('c', 'role')->all();
        $profiles = CompanyProfile::query()->count();

        $candidates = User::query()
            ->where('role', '!=', UserRole::Admin->value)
            ->whereDoesntHave('companyProfile')
            ->when(! $includeMembers, fn ($q) => $q->where('role', '!=', UserRole::Member->value))
            ->when($before !== null, fn ($q) => $q->where('created_at', '<', $before.' 00:00:00'))
            ->orderBy('id')
            ->get(['id', 'role', 'username', 'created_at']);

        return [
            'total' => User::query()->count(),
            'roles' => $roles,
            'admins' => (int) ($roles[UserRole::Admin->value] ?? 0),
            'profiles' => $profiles,
            'game_profiles' => CompanyProfile::query()->where('is_game', true)->count(),
            'profile_owners' => User::query()->whereHas('companyProfile')->count(),
            'candidate_ids' => $candidates->pluck('id')->all(),
            'candidate_roles' => $candidates->groupBy(fn (User $u) => $u->role?->value ?? 'unknown')->map->count()->all(),
            'sessions' => Schema::hasTable('sessions') && $candidates->isNotEmpty()
                ? DB::table('sessions')->whereIn('user_id', $candidates->pluck('id')->all())->count() : 0,
            'sample' => $candidates->take(10)->map(fn (User $u): string => '#'.$u->id.' '.($u->role?->value ?? '?').' '.($u->username ?? '-'))->all(),
        ];
    }

    /**
     * @param  array<string, mixed>  $r
     */
    private function render(array $r): void
    {
        $this->line('Users total: '.$r['total'].' '.json_encode($r['roles']));
        $this->line('Protected: admins='.$r['admins'].', profile owners='.$r['profile_owners'].' (profiles='.$r['profiles'].', games='.$r['game_profiles'].')');
        $this->line('Candidates to remove: '.count($r['candidate_ids']).' '.json_encode($r['candidate_roles']));
        $this->line('Sessions of candidates: '.$r['sessions']);

        foreach ($r['sample'] as $line) {
            $this->line('  - '.$line);
        }

        $this->line('Backup: '.$this->backupStatus());
    }

    private function backupStatus(): string
    {
        try {
            return 'OK '.$this->verifiedBackup((int) $this->option('max-backup-age'));
        } catch (RuntimeException $e) {
            return 'NOT READY ('.$e->getMessage().')';
        }
    }

    private function verifiedBackup(int $maxAgeMinutes): string
    {
        $files = glob(storage_path('backups/*.sql.gz')) ?: [];

        if ($files === []) {
            throw new RuntimeException('no backup found in storage/backups');
        }

        usort($files, fn (string $a, string $b): int => filemtime($b) <=> filemtime($a));
        $file = $files[0];
        $age = (time() - (int) filemtime($file)) / 60;

        if ($age > $maxAgeMinutes) {
            throw new RuntimeException(sprintf('newest backup %s is %d min old (max %d)', basename($file), $age, $maxAgeMinutes));
        }

        if (filesize($file) < 1024) {
            throw new RuntimeException('backup is too small');
        }

        $handle = gzopen($file, 'rb');

        if ($handle === false) {
            throw new RuntimeException('backup is not readable gzip');
        }

        $hasTable = false;
        $hasUsers = false;

        while (! gzeof($handle)) {
            $chunk = gzread($handle, 1048576);

            if ($chunk === false) {
                gzclose($handle);
                throw new RuntimeException('backup is corrupt gzip');
            }

            $hasTable = $hasTable || str_contains($chunk, 'CREATE TABLE');
            $hasUsers = $hasUsers || str_contains($chunk, '`users`');
        }

        gzclose($handle);

        if (! $hasTable || ! $hasUsers) {
            throw new RuntimeException('backup lacks CREATE TABLE / users');
        }

        return basename($file);
    }
}

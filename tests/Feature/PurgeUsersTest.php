<?php

namespace Tests\Feature;

use App\Models\CompanyProfile;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PurgeUsersTest extends TestCase
{
    use RefreshDatabase;

    private string $backupDir;

    protected function setUp(): void
    {
        parent::setUp();
        $this->backupDir = storage_path('backups');
        @mkdir($this->backupDir, 0777, true);
        array_map('unlink', glob($this->backupDir.'/*.sql.gz') ?: []);
    }

    protected function tearDown(): void
    {
        array_map('unlink', glob($this->backupDir.'/*.sql.gz') ?: []);
        parent::tearDown();
    }

    private function backup(int $ageMinutes = 1, ?string $sql = null): void
    {
        $sql ??= "CREATE TABLE `users` (id int);\n"."-- ".bin2hex(random_bytes(1500));
        $file = $this->backupDir.'/pre-deploy-test.sql.gz';
        file_put_contents($file, gzencode($sql));
        touch($file, time() - $ageMinutes * 60);
    }

    /** @return array{admin: User, owner: User, client: User, member: User, loose: User, game: CompanyProfile} */
    private function seedUsers(): array
    {
        $admin = User::factory()->admin()->create();
        $owner = User::factory()->client()->create();
        $game = CompanyProfile::factory()->game()->published()->create(['user_id' => $owner->id, 'subdomain' => 'drawquarium']);
        $client = User::factory()->client()->create();
        CompanyProfile::factory()->published()->create(['user_id' => $client->id, 'subdomain' => 'toko']);
        $member = User::factory()->member()->create();
        $loose = User::factory()->client()->create();

        return compact('admin', 'owner', 'client', 'member', 'loose', 'game');
    }

    public function test_dry_run_changes_nothing_and_reports_counts(): void
    {
        $u = $this->seedUsers();

        $this->artisan('users:purge')
            ->expectsOutputToContain('Users total: 5')
            ->expectsOutputToContain('Candidates to remove: 1')
            ->expectsOutputToContain('DRY RUN')
            ->assertSuccessful();

        $this->assertSame(5, User::query()->count());
        $this->assertSame(2, CompanyProfile::query()->count());
    }

    public function test_force_without_a_fresh_verified_backup_is_refused(): void
    {
        $this->seedUsers();

        $this->artisan('users:purge --force')->expectsOutputToContain('no backup found')->assertFailed();

        $this->backup(ageMinutes: 600);
        $this->artisan('users:purge --force')->expectsOutputToContain('min old')->assertFailed();

        $this->backup(sql: 'nothing useful here '.bin2hex(random_bytes(1500)));
        $this->artisan('users:purge --force')->expectsOutputToContain('lacks CREATE TABLE')->assertFailed();

        file_put_contents($this->backupDir.'/pre-deploy-test.sql.gz', str_repeat('notgzip', 400));
        $this->artisan('users:purge --force')->assertFailed();

        $this->assertSame(5, User::query()->count());
    }

    public function test_force_removes_only_unowned_non_admin_users_and_keeps_every_profile(): void
    {
        $u = $this->seedUsers();
        $this->backup();

        $this->artisan('users:purge --force')->expectsOutputToContain('Purged 1 account')->assertSuccessful();

        $this->assertNull(User::query()->find($u['loose']->id));
        foreach (['admin', 'owner', 'client', 'member'] as $key) {
            $this->assertNotNull(User::query()->find($u[$key]->id), $key);
        }
        $this->assertSame(2, CompanyProfile::query()->count());
        $this->assertNotNull(CompanyProfile::query()->where('subdomain', 'drawquarium')->first());
    }

    public function test_members_are_kept_unless_included_and_before_filters_by_date(): void
    {
        $u = $this->seedUsers();
        $this->backup();
        $old = User::factory()->member()->create(['created_at' => '2025-01-01 00:00:00']);

        $this->artisan('users:purge --force --include-members --before=2026-01-01')->assertSuccessful();

        $this->assertNull(User::query()->find($old->id));
        $this->assertNotNull(User::query()->find($u['member']->id));
        $this->assertNotNull(User::query()->find($u['loose']->id));
    }

    public function test_admins_are_never_candidates(): void
    {
        User::factory()->admin()->count(2)->create();
        $this->backup();

        $this->artisan('users:purge --force --include-members')->assertSuccessful();

        $this->assertSame(2, User::query()->where('role', 'admin')->count());
    }
}

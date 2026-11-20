<?php

namespace Tests\Feature;

use App\Enums\UserRole;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class DeleteUserCommandTest extends TestCase
{
    use RefreshDatabase;

    private function mk(string $name, UserRole $role): User
    {
        $u = new User(['name' => $name, 'username' => $name, 'email' => $name.'@example.test', 'password' => 'x']);
        $u->role = $role;
        $u->provider = 'github';
        $u->provider_id = 'gh-'.$name;
        $u->save();

        return $u;
    }

    public function test_non_test_name_needs_the_explicit_flag(): void
    {
        $this->mk('raiika13', UserRole::Member);
        $this->artisan('users:delete-test', ['username' => 'raiika13', '--force' => true])->assertFailed();
        $this->assertNotNull(User::where('username', 'raiika13')->first());
    }

    public function test_member_is_deleted_with_backup(): void
    {
        $this->mk('raiika13', UserRole::Member);
        $this->artisan('users:delete-test', ['username' => 'raiika13', '--force' => true, '--allow-non-test' => true])->assertSuccessful();
        $this->assertNull(User::where('username', 'raiika13')->first());
        $this->assertNotEmpty(glob(storage_path('app/backups/deleted-user-raiika13-*.json')));
        array_map('unlink', glob(storage_path('app/backups/deleted-user-raiika13-*.json')));
    }

    public function test_admin_is_refused(): void
    {
        $this->mk('bossadmin', UserRole::Admin);
        $this->artisan('users:delete-test', ['username' => 'bossadmin', '--force' => true, '--allow-non-test' => true])->assertFailed();
        $this->assertNotNull(User::where('username', 'bossadmin')->first());
    }
}

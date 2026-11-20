<?php

namespace Tests\Feature;

use App\Models\CompanyProfile;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class PurgeClientUsersTest extends TestCase
{
    use RefreshDatabase;

    public function test_dry_run_then_force_deletes_only_client_only_accounts_and_keeps_their_sites(): void
    {
        $admin = User::factory()->admin()->create();
        $member = User::factory()->member()->create();
        $client = User::factory()->client()->create(['email' => 'lama@example.test']);
        $site = CompanyProfile::factory()->create(['user_id' => $client->id, 'subdomain' => 'situs-lama', 'status' => \App\Enums\ProfileStatus::Published]);
        $active = User::factory()->client()->create(['email' => 'aktif@example.test']);
        DB::table('member_follows')->insert(['follower_id' => $active->id, 'followed_id' => $member->id, 'created_at' => now(), 'updated_at' => now()]);

        $this->artisan('users:purge-clients')->expectsOutputToContain('lama@example.test')
            ->expectsOutputToContain('ambigu: follow')->expectsOutputToContain('DRY RUN')->assertSuccessful();
        $this->assertModelExists($client);

        $this->artisan('users:purge-clients --force')->assertSuccessful();

        $this->assertModelMissing($client);
        $this->assertModelExists($active);
        $this->assertModelExists($admin);
        $this->assertModelExists($member);
        $this->assertNull($site->fresh()->user_id);
        $this->get('http://jadidaring.test/situs-lama')->assertOk();
    }
}

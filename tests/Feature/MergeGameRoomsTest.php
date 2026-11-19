<?php

namespace Tests\Feature;

use App\Models\CompanyProfile;
use App\Models\GameRoom;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class MergeGameRoomsTest extends TestCase
{
    use RefreshDatabase;

    private function room(CompanyProfile $p, string $code, array $state): GameRoom
    {
        return GameRoom::query()->create(['company_profile_id' => $p->id, 'code' => $code, 'visibility' => 'public', 'status' => 'waiting', 'max_players' => 500, 'state' => $state, 'version' => 3]);
    }

    public function test_merge_is_dry_by_default_and_additive_when_applied(): void
    {
        $p = CompanyProfile::factory()->published()->create(['subdomain' => 'langitbersama', 'html' => '<html></html>']);
        $target = $this->room($p, 'NEWONE', []);
        $old = $this->room($p, 'OLDONE', ['n' => 2, 'cr' => [['id' => 'a', 'k' => 'kite'], ['id' => 'b', 'k' => 'cloud']], 'cm' => [['i' => 5, 'at' => 10, 't' => 'hi']], 'del' => ['x']]);

        $this->artisan('games:merge-rooms', ['subdomain' => 'langitbersama', 'target' => 'NEWONE'])->assertSuccessful();
        $this->assertSame(3, $target->fresh()->version);

        $this->artisan('games:merge-rooms', ['subdomain' => 'langitbersama', 'target' => 'NEWONE', '--apply' => true])->assertSuccessful();
        $this->artisan('games:merge-rooms', ['subdomain' => 'langitbersama', 'target' => 'NEWONE', '--apply' => true])->assertSuccessful();

        $t = $target->fresh();
        $this->assertSame(['a', 'b'], array_column($t->state['cr'], 'id'));
        $this->assertCount(1, $t->state['cm']);
        $this->assertSame(['x'], $t->state['del']);
        $this->assertCount(2, $old->fresh()->state['cr']);
        $this->assertSame(3, $old->fresh()->version);
    }
}

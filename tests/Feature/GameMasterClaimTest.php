<?php

namespace Tests\Feature;

use App\Events\GameRoomUpdated;
use App\Models\CompanyProfile;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Event;
use Tests\TestCase;

/** Game master = the logged-in admin account. There is no shared GM key. */
class GameMasterClaimTest extends TestCase
{
    use RefreshDatabase;

    private const BASE = 'http://jadidaring.test/coratcoret/api/game/';

    protected function setUp(): void
    {
        parent::setUp();

        Event::fake([GameRoomUpdated::class]);
        $this->publish('coratcoret');
    }

    public function test_guest_and_member_cannot_claim_even_with_the_old_keys(): void
    {
        $room = $this->openRoom('Ada');

        foreach (['gmjd1212', 'gamemasterjd', ''] as $code) {
            $this->withToken($room['playerToken'])
                ->postJson(self::BASE.'rooms/'.$room['code'].'/gamemaster', ['code' => $code])
                ->assertForbidden();
        }

        $this->actingAs(User::factory()->member()->create());
        $this->withToken($room['playerToken'])
            ->postJson(self::BASE.'rooms/'.$room['code'].'/gamemaster', ['code' => 'gmjd1212'])
            ->assertForbidden();

        $seen = $this->withToken($room['playerToken'])->getJson(self::BASE.'rooms/'.$room['code'])->assertOk()->json();
        $this->assertFalse($seen['gamemaster']);
        $this->assertSame($room['version'], $seen['version']);
    }

    public function test_admin_session_claim_marks_the_player_as_gamemaster_without_any_code(): void
    {
        $room = $this->openRoom('Ada');
        $friend = $this->postJson(self::BASE.'rooms/join', ['code' => $room['code'], 'displayName' => 'Bayu'])->assertOk()->json();

        $this->actingAs(User::factory()->admin()->create());
        $claimed = $this->withToken($room['playerToken'])
            ->postJson(self::BASE.'rooms/'.$room['code'].'/gamemaster', [])
            ->assertOk()
            ->json();

        $this->assertTrue($claimed['gamemaster']);
        $this->assertSame($friend['version'] + 1, $claimed['version']);
        $this->assertFalse(collect($claimed['players'])->firstWhere('id', $friend['playerId'])['gamemaster']);
        $this->assertSame('gamemaster', collect($claimed['events'])->last()['type']);
        Event::assertDispatched(GameRoomUpdated::class, fn (GameRoomUpdated $e): bool => $e->code === $room['code'] && $e->version === $claimed['version']);
    }

    public function test_admin_who_creates_joins_or_watches_is_gamemaster_automatically(): void
    {
        $room = $this->openRoom('Ada');

        $this->actingAs(User::factory()->admin()->create());
        $joined = $this->postJson(self::BASE.'rooms/join', ['code' => $room['code'], 'displayName' => 'Admin'])->assertOk()->json();
        $this->assertTrue($joined['gamemaster']);
        $this->assertFalse(collect($joined['players'])->firstWhere('id', $room['playerId'])['gamemaster']);

        $watched = $this->postJson(self::BASE.'rooms/'.$room['code'].'/watch', ['displayName' => 'Admin2'])->assertOk()->json();
        $this->assertTrue($watched['gamemaster']);

        $own = $this->openRoom('Admin');
        $this->assertTrue($own['gamemaster']);
    }

    public function test_member_who_joins_is_not_gamemaster(): void
    {
        $room = $this->openRoom('Ada');
        $this->actingAs(User::factory()->member()->create());
        $joined = $this->postJson(self::BASE.'rooms/join', ['code' => $room['code'], 'displayName' => 'Bayu'])->assertOk()->json();
        $this->assertFalse($joined['gamemaster']);
    }

    public function test_claiming_requires_a_seated_player_token(): void
    {
        $room = $this->openRoom('Ada');
        $this->actingAs(User::factory()->admin()->create());

        $this->postJson(self::BASE.'rooms/'.$room['code'].'/gamemaster', [])
            ->assertUnauthorized()
            ->assertExactJson(['error' => 'A player token is required.']);

        $this->withToken('not-a-member')
            ->postJson(self::BASE.'rooms/'.$room['code'].'/gamemaster', [])
            ->assertForbidden()
            ->assertExactJson(['error' => 'You are not a member of this room.']);
    }

    public function test_leaving_clears_the_flag(): void
    {
        $room = $this->openRoom('Ada');
        $this->actingAs(User::factory()->admin()->create());
        $admin = $this->postJson(self::BASE.'rooms/join', ['code' => $room['code'], 'displayName' => 'Admin'])->assertOk()->json();

        $this->withToken($admin['playerToken'])->postJson(self::BASE.'rooms/'.$room['code'].'/leave')->assertOk();

        $after = $this->withToken($room['playerToken'])->getJson(self::BASE.'rooms/'.$room['code'])->assertOk()->json();
        $this->assertFalse(collect($after['players'])->contains(fn (array $p): bool => $p['gamemaster'] === true));
    }

    public function test_claims_are_rate_limited(): void
    {
        $room = $this->openRoom('Ada');

        for ($i = 0; $i < 20; $i++) {
            $this->withToken($room['playerToken'])->postJson(self::BASE.'rooms/'.$room['code'].'/gamemaster', ['code' => 'x'.$i])->assertForbidden();
        }

        $this->withToken($room['playerToken'])->postJson(self::BASE.'rooms/'.$room['code'].'/gamemaster', ['code' => 'gmjd1212'])->assertStatus(429);
    }

    public function test_config_carries_no_gamemaster_key(): void
    {
        $body = (string) $this->getJson(self::BASE.'config')
            ->assertOk()
            ->assertJsonMissingPath('gamemasterKey')
            ->assertJsonMissingPath('gamemasterSecret')
            ->assertJsonMissingPath('gamemaster')
            ->getContent();

        $this->assertStringNotContainsString('gamemasterjd', $body);
        $this->assertStringNotContainsString('gmjd1212', $body);
        $this->assertStringNotContainsString('GAME_GAMEMASTER_SECRET', $body);
    }

    public function test_rendered_game_page_never_contains_the_retired_key(): void
    {
        CompanyProfile::factory()->game()->published()->create([
            'subdomain' => 'drawquarium',
            'html' => "<html><head></head><body><script>const GM_KEY = 'gmjd1212'; const OLD='GAMEMASTERJD'; const gmHash = () => location.hash.includes(GM_KEY);</script></body></html>",
        ]);

        $page = $this->get('http://jadidaring.test/game/drawquarium/')->assertOk()->getContent();

        $this->assertStringNotContainsStringIgnoringCase('gmjd1212', $page);
        $this->assertStringNotContainsStringIgnoringCase('gamemasterjd', $page);
        $this->assertStringContainsString("const GM_KEY = 'gamemaster';", $page);
    }

    /** @return array<string, mixed> */
    private function openRoom(string $displayName, string $visibility = 'private'): array
    {
        return $this->postJson(self::BASE.'rooms', ['displayName' => $displayName, 'visibility' => $visibility])->assertOk()->json();
    }

    private function publish(string $subdomain): void
    {
        CompanyProfile::factory()->published()->create([
            'subdomain' => $subdomain,
            'html' => '<html><body>'.$subdomain.'</body></html>',
        ]);
    }
}

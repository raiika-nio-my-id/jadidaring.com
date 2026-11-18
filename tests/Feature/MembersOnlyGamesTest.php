<?php

namespace Tests\Feature;

use App\Models\CompanyProfile;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class MembersOnlyGamesTest extends TestCase
{
    use RefreshDatabase;

    private const HOST = 'http://jadidaring.test';

    private function publish(string $slug): void
    {
        CompanyProfile::factory()->game()->published()->create(['subdomain' => $slug, 'html' => '<html><body>Game</body></html>']);
    }

    public function test_guests_cannot_create_or_draw_in_restricted_games_but_can_view(): void
    {
        $this->publish('drawquarium');

        $this->postJson(self::HOST.'/game/drawquarium/api/game/rooms', ['displayName' => 'Ada', 'visibility' => 'public', 'state' => []])
            ->assertUnauthorized()->assertJsonPath('login', '/masuk');
        $this->postJson(self::HOST.'/drawquarium/api/game/rooms', ['displayName' => 'Ada'])->assertUnauthorized();
        $this->postJson(self::HOST.'/game/drawquarium/api/game/rooms/ABCD/actions', ['type' => 'draw', 'expectedVersion' => 0])->assertUnauthorized();
        $this->postJson(self::HOST.'/game/drawquarium/api/game/rooms/ABCD/input', ['type' => 'stroke'])->assertUnauthorized();

        $this->getJson(self::HOST.'/game/drawquarium/api/game/config')->assertOk();
        $this->getJson(self::HOST.'/game/drawquarium/api/game/rooms')->assertOk();
        $this->get(self::HOST.'/game/drawquarium/')->assertOk()->assertSee('masuk</a> atau', false);
    }

    public function test_members_can_create_and_the_banner_is_hidden(): void
    {
        $this->publish('drawquarium');
        $user = User::factory()->member()->create();

        $this->actingAs($user)->post(self::HOST.'/game/drawquarium/api/game/rooms', ['displayName' => 'Ada', 'visibility' => 'public', 'state' => ['ok' => true]], ['Accept' => 'application/json'])->assertOk();
        $this->actingAs($user)->get(self::HOST.'/game/drawquarium/')->assertOk()->assertDontSee('masuk</a> atau', false);
    }

    public function test_other_games_stay_open_to_guests(): void
    {
        $this->publish('mahjong');

        $this->postJson(self::HOST.'/game/mahjong/api/game/rooms', ['displayName' => 'Ada', 'visibility' => 'public', 'state' => []])->assertOk();
        $this->get(self::HOST.'/game/mahjong/')->assertOk()->assertDontSee('masuk</a> atau', false);
    }

    public function test_rule_can_be_disabled_by_env(): void
    {
        config(['singlepage.members_only_games' => '']);
        $this->publish('drawquarium');

        $this->postJson(self::HOST.'/game/drawquarium/api/game/rooms', ['displayName' => 'Ada', 'visibility' => 'public', 'state' => []])->assertOk();
    }
}

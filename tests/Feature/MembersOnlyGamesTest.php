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

    protected function setUp(): void
    {
        parent::setUp();
        config(['singlepage.members_only_games' => '*', 'singlepage.git_games' => '']); // fixture database html
    }

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

    public function test_every_game_needs_login_to_save_but_guests_can_view(): void
    {
        $this->publish('mahjong');

        $this->postJson(self::HOST.'/game/mahjong/api/game/rooms', ['displayName' => 'Ada', 'visibility' => 'public', 'state' => []])->assertUnauthorized();
        $this->postJson(self::HOST.'/game/mahjong/api/game/rooms/match', ['displayName' => 'Ada'])->assertUnauthorized();
        $this->postJson(self::HOST.'/game/mahjong/api/game/rooms/join', ['displayName' => 'Ada', 'code' => 'ABCD'])->assertUnauthorized();
        $this->postJson(self::HOST.'/game/mahjong/api/game/scores', ['name' => 'Ada', 'score' => 5])->assertUnauthorized()->assertJsonPath('login', '/masuk');
        $this->getJson(self::HOST.'/game/mahjong/api/game/scores')->assertOk();
        $this->get(self::HOST.'/game/mahjong/')->assertOk()->assertSee('masuk</a> atau', false);
    }

    public function test_scores_and_rooms_follow_the_account_name_after_rename(): void
    {
        $this->publish('mahjong');
        $user = User::factory()->member()->create(['name' => 'Budi']);

        $this->actingAs($user)->postJson(self::HOST.'/game/mahjong/api/game/scores', ['name' => 'Spoof', 'score' => 42])->assertOk()->assertJsonPath('name', 'Budi');
        $room = $this->actingAs($user)->postJson(self::HOST.'/game/mahjong/api/game/rooms', ['displayName' => 'Spoof', 'visibility' => 'public', 'state' => []])->assertOk();
        $room->assertJsonPath('players.0.displayName', 'Budi');
        $code = $room->json('code');
        $token = $room->json('playerToken');

        $this->actingAs($user)->post('http://jadidaring.test/akun/nama', ['name' => 'Budi Baru'])->assertSessionHasNoErrors();

        $this->getJson(self::HOST.'/game/mahjong/api/game/scores')->assertJsonPath('scores.0.name', 'Budi Baru');
        $this->withHeaders(['Authorization' => 'Bearer '.$token])
            ->getJson(self::HOST.'/game/mahjong/api/game/rooms/'.$code)->assertJsonPath('players.0.displayName', 'Budi Baru');
        $this->assertSame($user->id, \App\Models\GameScore::query()->first()->user_id);
    }

    public function test_legacy_unlinked_data_keeps_its_stored_name(): void
    {
        $this->publish('mahjong');
        $profile = CompanyProfile::query()->where('subdomain', 'mahjong')->first();
        \App\Models\GameScore::query()->create(['company_profile_id' => $profile->id, 'name' => 'Lama', 'score' => 9]);

        $this->getJson(self::HOST.'/game/mahjong/api/game/scores')->assertJsonPath('scores.0.name', 'Lama');
    }

    public function test_display_name_validation_and_name_bridge_for_logged_in_member(): void
    {
        $user = User::factory()->member()->create(['name' => 'Sari']);

        $this->actingAs($user)->post('http://jadidaring.test/akun/nama', ['name' => '<b>x</b>'])->assertSessionHasErrors('name');
        $this->actingAs($user)->get('http://jadidaring.test/akun')->assertOk()->assertSee('Nama tampilan');

        CompanyProfile::factory()->game()->published()->create(['subdomain' => 'catur', 'html' => '<html><head></head><body><div class="jd-namegate"></div></body></html>']);
        $this->actingAs($user)->get(self::HOST.'/game/catur/')->assertOk()->assertSee('window.__JD_ME={"in":true,"name":"Sari"', false)->assertDontSee('masuk</a> atau', false);
    }

    public function test_rule_can_be_disabled_by_env_xx(): void
    {
        config(['singlepage.members_only_games' => '']);
        $this->publish('drawquarium');

        $this->postJson(self::HOST.'/game/drawquarium/api/game/rooms', ['displayName' => 'Ada', 'visibility' => 'public', 'state' => []])->assertOk();
    }
}

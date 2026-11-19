<?php

namespace Tests\Feature;

use App\Events\GameRoomUpdated;
use App\Models\CompanyProfile;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Event;
use Tests\TestCase;

class GameRoomListTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        Event::fake([GameRoomUpdated::class]);
    }

    public function test_room_list_without_secret_returns_only_public_waiting_and_playing_rooms(): void
    {
        $this->publish('coratcoret');

        $publicWaiting = $this->openRoom('coratcoret', 'Ada', 'public');
        $publicPlaying = $this->openRoom('coratcoret', 'Bayu', 'public');
        $this->setStatus('coratcoret', $publicPlaying, 'playing');
        $privateWaiting = $this->openRoom('coratcoret', 'Cici', 'private');
        $closed = $this->openRoom('coratcoret', 'Deni', 'public');
        $this->closeRoom('coratcoret', $closed);

        $rooms = $this->getJson('http://jadidaring.test/coratcoret/api/game/rooms')
            ->assertOk()
            ->assertJsonCount(2, 'rooms')
            ->json('rooms');

        $codes = collect($rooms)->pluck('code');
        $this->assertTrue($codes->contains($publicWaiting['code']));
        $this->assertTrue($codes->contains($publicPlaying['code']));
        $this->assertFalse($codes->contains($privateWaiting['code']));
        $this->assertFalse($codes->contains($closed['code']));

        $listedPlaying = collect($rooms)->firstWhere('code', $publicPlaying['code']);
        $this->assertSame(['code', 'status', 'visibility', 'seated', 'spectators', 'maxPlayers', 'version', 'updatedAt'], array_keys($listedPlaying));
        $this->assertSame('public', $listedPlaying['visibility']);
        $this->assertSame('playing', $listedPlaying['status']);
        $this->assertSame(1, $listedPlaying['seated']);
        $this->assertSame(0, $listedPlaying['spectators']);
        $this->assertSame(4, $listedPlaying['maxPlayers']);
    }

    public function test_retired_gm_query_and_header_keys_are_ignored(): void
    {
        $this->publish('coratcoret');

        $public = $this->openRoom('coratcoret', 'Ada', 'public');
        $private = $this->openRoom('coratcoret', 'Bayu', 'private');

        foreach (['gmjd1212', 'gamemasterjd', 'wrongsecret'] as $key) {
            $this->getJson('http://jadidaring.test/coratcoret/api/game/rooms?gm='.$key)
                ->assertOk()
                ->assertJsonCount(1, 'rooms')
                ->assertJsonPath('rooms.0.code', $public['code']);

            $this->getJson('http://jadidaring.test/coratcoret/api/game/rooms', ['X-Game-Master' => $key])
                ->assertOk()
                ->assertJsonCount(1, 'rooms')
                ->assertJsonPath('rooms.0.code', $public['code']);
        }

        $this->actingAs(User::factory()->member()->create());
        $this->getJson('http://jadidaring.test/coratcoret/api/game/rooms?gm=gmjd1212')
            ->assertOk()
            ->assertJsonCount(1, 'rooms');

        $this->assertDatabaseHas('game_rooms', ['code' => $private['code'], 'visibility' => 'private']);
    }

    public function test_admin_session_lists_public_and_private_waiting_and_playing_rooms(): void
    {
        $this->publish('coratcoret');

        $public = $this->openRoom('coratcoret', 'Ada', 'public');
        $privateWaiting = $this->openRoom('coratcoret', 'Bayu', 'private');
        $privatePlaying = $this->openRoom('coratcoret', 'Cici', 'private');
        $this->setStatus('coratcoret', $privatePlaying, 'playing');
        $closedPrivate = $this->openRoom('coratcoret', 'Deni', 'private');
        $this->closeRoom('coratcoret', $closedPrivate);

        $this->actingAs(User::factory()->admin()->create());
        $rooms = $this->getJson('http://jadidaring.test/coratcoret/api/game/rooms')
            ->assertOk()
            ->assertJsonCount(3, 'rooms')
            ->json('rooms');

        $codes = collect($rooms)->pluck('code');
        $this->assertTrue($codes->contains($public['code']));
        $this->assertTrue($codes->contains($privateWaiting['code']));
        $this->assertTrue($codes->contains($privatePlaying['code']));
        $this->assertFalse($codes->contains($closedPrivate['code']));
        $this->assertSame(['code', 'status', 'visibility', 'seated', 'spectators', 'maxPlayers', 'version', 'updatedAt'], array_keys($rooms[0]));
    }

    public function test_admin_list_stays_inside_the_game_subdomain(): void
    {
        $this->publish('coratcoret');
        $this->publish('sambungcoret');

        $corat = $this->openRoom('coratcoret', 'Ada', 'private');
        $sambung = $this->openRoom('sambungcoret', 'Bayu', 'private');

        $this->actingAs(User::factory()->admin()->create());

        $this->getJson('http://jadidaring.test/coratcoret/api/game/rooms')
            ->assertOk()
            ->assertJsonCount(1, 'rooms')
            ->assertJsonPath('rooms.0.code', $corat['code']);

        $this->getJson('http://jadidaring.test/sambungcoret/api/game/rooms')
            ->assertOk()
            ->assertJsonCount(1, 'rooms')
            ->assertJsonPath('rooms.0.code', $sambung['code']);

        CompanyProfile::factory()->create(['subdomain' => 'hidden']);

        $this->getJson('http://jadidaring.test/hidden/api/game/rooms')->assertNotFound();
    }

    /**
     * @return array<string, mixed>
     */
    private function openRoom(string $subdomain, string $displayName, string $visibility): array
    {
        return $this->postJson('http://jadidaring.test/'.$subdomain.'/api/game/rooms', [
            'displayName' => $displayName,
            'visibility' => $visibility,
        ])->assertOk()->json();
    }

    /**
     * @param  array<string, mixed>  $room
     */
    private function setStatus(string $subdomain, array $room, string $status): void
    {
        $this->withToken($room['playerToken'])
            ->postJson('http://jadidaring.test/'.$subdomain.'/api/game/rooms/'.$room['code'].'/actions', [
                'type' => 'status',
                'expectedVersion' => $room['version'],
                'status' => $status,
            ])->assertOk();
    }

    /**
     * @param  array<string, mixed>  $room
     */
    private function closeRoom(string $subdomain, array $room): void
    {
        $this->withToken($room['playerToken'])
            ->postJson('http://jadidaring.test/'.$subdomain.'/api/game/rooms/'.$room['code'].'/leave')
            ->assertOk();
    }

    private function publish(string $subdomain): void
    {
        CompanyProfile::factory()->published()->create([
            'subdomain' => $subdomain,
            'html' => '<html><body>'.$subdomain.'</body></html>',
        ]);
    }
}

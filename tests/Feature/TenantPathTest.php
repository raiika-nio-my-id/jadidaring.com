<?php

namespace Tests\Feature;

use App\Models\CompanyProfile;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class TenantPathTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        config(['singlepage.members_only_games' => '']);
    }

    public function test_games_are_served_under_game_slug_and_old_paths_are_gone(): void
    {
        $this->publish('drawquarium', '<html><head></head><body>Aquarium</body></html>');
        $this->publish('langitbersama', '<html><head></head><body>Sky</body></html>');

        $this->get('http://jadidaring.test/game/drawquarium')->assertOk()->assertSee('Aquarium', false)->assertDontSee('Sky', false);
        $this->get('http://jadidaring.test/game/drawquarium/')->assertOk();
        $this->get('http://jadidaring.test/game/DrawQuarium/')->assertOk();
        $this->get('http://jadidaring.test/game/langitbersama/')->assertOk()->assertSee('Sky', false);

        $this->get('http://jadidaring.test/drawquarium')->assertNotFound();
        $this->get('http://jadidaring.test/drawquarium/')->assertNotFound();
        $this->get('http://drawquarium.jadidaring.test/')->assertRedirect('https://jadidaring.test/game/drawquarium');
        $this->get('http://jadidaring.test/game/missing')->assertNotFound();
    }

    public function test_client_sites_keep_their_path(): void
    {
        CompanyProfile::factory()->published()->create(['subdomain' => 'toko', 'html' => '<html><body>Toko</body></html>']);

        $this->get('http://jadidaring.test/toko/')->assertOk()->assertSee('Toko', false);
        $this->get('http://jadidaring.test/game/toko')->assertNotFound();
    }

    public function test_www_redirects_pages_to_the_bare_domain_but_keeps_legacy_api(): void
    {
        $this->get('http://www.jadidaring.test/game/drawquarium/?x=1')
            ->assertStatus(301)
            ->assertRedirect('http://jadidaring.test/game/drawquarium/?x=1');

        $this->get('http://www.jadidaring.test/')->assertStatus(301)->assertRedirect('http://jadidaring.test/');

        $this->publish('drawquarium', '<html><body>Aquarium</body></html>');
        $this->getJson('http://www.jadidaring.test/drawquarium/api/game/config')->assertOk()->assertJsonPath('game', 'drawquarium');
        $this->getJson('http://jadidaring.test/drawquarium/api/game/config')->assertOk()->assertJsonPath('game', 'drawquarium');
    }

    public function test_draft_and_expired_profiles_stay_not_found(): void
    {
        CompanyProfile::factory()->game()->create(['subdomain' => 'hidden', 'html' => '<html><body>Hidden</body></html>']);
        CompanyProfile::factory()->game()->published()->expired()->create(['subdomain' => 'oldshop', 'html' => '<html><body>Offline</body></html>']);

        $this->get('http://jadidaring.test/game/hidden')->assertNotFound();
        $this->get('http://jadidaring.test/game/oldshop/')->assertNotFound();
        $this->get('http://jadidaring.test/game/missing')->assertNotFound();
    }

    public function test_reserved_labels_are_not_game_paths(): void
    {
        foreach (['admin', 'api', 'app', 'reverb', 'up', 'mail', 'www', 'game', 'berita', 'komunitas'] as $label) {
            CompanyProfile::factory()->published()->create([
                'subdomain' => $label,
                'html' => '<html><body>reserved-'.$label.'</body></html>',
            ]);
        }

        $this->get('http://jadidaring.test/admin')->assertNotFound();
        $this->get('http://jadidaring.test/reverb')->assertNotFound();
        $this->get('http://jadidaring.test/app')->assertNotFound();
        $this->get('http://admin.jadidaring.test/drawquarium')->assertNotFound();
        $this->get('http://jadidaring.test/')
            ->assertOk()
            ->assertDontSee('reserved-admin', false)
            ->assertDontSee('reserved-game', false);
        $this->get('http://jadidaring.test/up')->assertOk()->assertDontSee('reserved-up', false);
        $this->get('http://jadidaring.test/berita')->assertOk()->assertDontSee('reserved-berita', false);
    }

    public function test_gamehub_path_is_retired(): void
    {
        CompanyProfile::factory()->published()->create(['subdomain' => 'gamehub', 'html' => '<html><body>JaRing hub</body></html>']);

        $this->get('http://jadidaring.test/gamehub')->assertNotFound();
        $this->get('http://jadidaring.test/gamehub/')->assertNotFound();
        $this->get('http://jadidaring.test/game/gamehub')->assertNotFound();
    }

    public function test_served_html_rewrites_api_terms_and_websocket_links(): void
    {
        $this->publish('drawquarium', <<<'HTML'
<html><head><link rel="canonical" href="https://drawquarium.jadidaring.test/"></head><body>
<a href="/syarat-ketentuan">Terms</a>
<a href="https://langitbersama.jadidaring.test/play">Sky</a>
<a href="https://admin.jadidaring.test/login">Admin</a>
<script>fetch("/api/game/config"); new WebSocket("wss://drawquarium.jadidaring.test/app/key");</script>
</body></html>
HTML);

        $this->get('http://jadidaring.test/game/drawquarium')
            ->assertOk()
            ->assertSee('rel="canonical" href="https://jadidaring.test/game/drawquarium"', false)
            ->assertSee('href="/game/drawquarium/syarat-ketentuan"', false)
            ->assertSee('href="https://jadidaring.test/game/langitbersama/play"', false)
            ->assertSee('href="https://admin.jadidaring.test/login"', false)
            ->assertSee('fetch("/game/drawquarium/api/game/config")', false)
            ->assertSee('wss://jadidaring.test/app/key', false)
            ->assertDontSee('drawquarium.jadidaring.test/', false)
            ->assertSee('http://jadidaring.test/game/drawquarium/syarat-ketentuan', false);
    }

    public function test_game_api_config_rooms_and_scores_stay_isolated(): void
    {
        $this->publish('drawquarium', '<html><body>Aquarium</body></html>');
        $this->publish('langitbersama', '<html><body>Sky</body></html>');

        $config = $this->getJson('http://jadidaring.test/game/drawquarium/api/game/config')
            ->assertOk()
            ->assertJsonPath('game', 'drawquarium')
            ->assertJsonPath('api', '/game/drawquarium/api/game')
            ->assertJsonPath('host', 'jadidaring.test')
            ->assertJsonPath('websocket.channelPrefix', 'game.drawquarium')
            ->assertJsonPath('database.isolatedBy', 'subdomain');

        $this->assertStringContainsString('ws://jadidaring.test/app/test-reverb-key', (string) $config->json('websocket.url'));

        $created = $this->postJson('http://jadidaring.test/game/drawquarium/api/game/rooms', [
            'displayName' => 'Ada',
            'visibility' => 'public',
            'state' => ['ok' => true],
        ])->assertOk()->json();

        $this->getJson('http://jadidaring.test/game/drawquarium/api/game/rooms/'.$created['code'], [
            'Authorization' => 'Bearer '.$created['playerToken'],
        ])->assertOk()->assertJsonPath('code', $created['code']);

        // The legacy path reaches the same room.
        $this->getJson('http://jadidaring.test/drawquarium/api/game/rooms/'.$created['code'], [
            'Authorization' => 'Bearer '.$created['playerToken'],
        ])->assertOk();

        $this->getJson('http://jadidaring.test/game/langitbersama/api/game/rooms/'.$created['code'], [
            'Authorization' => 'Bearer '.$created['playerToken'],
        ])->assertNotFound();

        $this->postJson('http://jadidaring.test/game/drawquarium/api/game/scores', ['name' => 'Ada', 'score' => 12])->assertOk();

        $this->getJson('http://jadidaring.test/game/langitbersama/api/game/scores')->assertOk()->assertExactJson(['scores' => []]);
        $this->getJson('http://jadidaring.test/game/drawquarium/api/game/scores')
            ->assertOk()
            ->assertJsonPath('scores.0.name', 'Ada');
    }

    public function test_a_game_visit_no_longer_increments_the_old_counter(): void
    {
        $this->publish('drawquarium', '<html><body>Aquarium</body></html>');

        $this->get('http://jadidaring.test/game/drawquarium/')->assertOk();
        $this->assertSame(0, $this->views('drawquarium'));
    }

    public function test_served_html_passes_the_connection_identity_check(): void
    {
        $source = <<<'HTML'
<!doctype html><html><head><title>Tank</title></head><body>
<script id="dq-net">
function gameSubdomain(hostname) { const m = /^([a-z0-9-]+)\.jadidaring\.(?:com|test)$/i.exec(String(hostname || '')); return m ? m[1].toLowerCase() : null; }
</script>
</body></html>
HTML;

        $this->publish('drawquarium', $source);
        $this->publish('langitbersama', str_replace('Tank', 'Sky', $source));

        $draw = $this->get('http://jadidaring.test/game/drawquarium/');
        $draw->assertOk();
        $this->assertGameIdentity($draw->getContent(), 'drawquarium', '/game/drawquarium/');

        $sky = $this->get('http://jadidaring.test/game/langitbersama/');
        $sky->assertOk();
        $this->assertGameIdentity($sky->getContent(), 'langitbersama', '/game/langitbersama/');
    }

    public function test_game_terms_page(): void
    {
        $this->publish('langitbersama', '<html><body>Sky</body></html>');

        $this->get('http://jadidaring.test/game/langitbersama/syarat-ketentuan')
            ->assertOk()
            ->assertSee('jadidaring.test/game/langitbersama', false)
            ->assertSee('http://jadidaring.test/game/langitbersama/', false);
    }

    private function publish(string $subdomain, string $html): CompanyProfile
    {
        return CompanyProfile::factory()->game()->published()->create([
            'subdomain' => $subdomain,
            'html' => $html,
        ]);
    }

    private function views(string $subdomain): int
    {
        return DB::table('page_view_records')
            ->join('company_profiles', 'company_profiles.id', '=', 'page_view_records.company_profile_id')
            ->where('company_profiles.subdomain', $subdomain)
            ->count();
    }
}

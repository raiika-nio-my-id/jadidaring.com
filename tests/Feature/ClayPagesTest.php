<?php

namespace Tests\Feature;

use App\Models\CompanyProfile;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ClayPagesTest extends TestCase
{
    use RefreshDatabase;

    public function test_public_pages_render_on_the_bare_host(): void
    {
        foreach (['/', '/berita', '/berita/politik', '/berita/teknologi', '/game', '/komunitas', '/syarat-ketentuan'] as $path) {
            $this->get('http://jadidaring.test'.$path)->assertOk()->assertSee('Jadidaring', false);
        }

        $this->get('http://jadidaring.test/berita/unknown')->assertNotFound();
        $this->get('http://jadidaring.test/showcase')->assertNotFound();
    }

    public function test_home_shows_news_empty_state(): void
    {
        $this->get('http://jadidaring.test/')->assertOk()->assertSee('Berita segera hadir', false);
    }

    public function test_game_hub_lists_only_live_games(): void
    {
        CompanyProfile::factory()->game()->published()->create(['subdomain' => 'ulartangga', 'html' => '<html><head><title>Ular Tangga Seru</title></head></html>']);
        CompanyProfile::factory()->game()->create(['subdomain' => 'draftgame']);
        CompanyProfile::factory()->game()->published()->expired()->create(['subdomain' => 'oldgame']);
        CompanyProfile::factory()->published()->create(['subdomain' => 'toko']);
        CompanyProfile::factory()->game()->published()->create(['subdomain' => 'gamehub']);

        foreach (['views', 'new', 'az', 'bogus'] as $sort) {
            $response = $this->get('http://jadidaring.test/game?sort='.$sort)->assertOk();
            $response->assertSee('/game/ulartangga', false);
            $response->assertDontSee('/game/draftgame', false);
            $response->assertDontSee('/game/oldgame', false);
            $response->assertDontSee('/game/toko', false);
            $response->assertDontSee('/game/gamehub', false);
        }
    }

    public function test_sitemap_and_robots_use_the_bare_host(): void
    {
        CompanyProfile::factory()->game()->published()->create(['subdomain' => 'ulartangga']);
        CompanyProfile::factory()->game()->create(['subdomain' => 'draftgame']);

        $this->get('http://jadidaring.test/sitemap.xml')
            ->assertOk()
            ->assertSee('https://jadidaring.test/game/ulartangga', false)
            ->assertSee('https://jadidaring.test/berita/saham', false)
            ->assertDontSee('draftgame', false);

        $this->get('http://jadidaring.test/robots.txt')
            ->assertOk()
            ->assertSee('Sitemap: https://jadidaring.test/sitemap.xml', false);
    }

    public function test_www_redirects_to_the_bare_host_and_health_stays_up(): void
    {
        $this->get('http://www.jadidaring.test/berita?x=1')->assertStatus(301)->assertRedirect('http://jadidaring.test/berita?x=1');
        $this->get('http://www.jadidaring.test/up')->assertOk();
    }

    public function test_retired_subdomains_and_gamehub_are_not_found(): void
    {
        $this->get('http://anything.jadidaring.test/')->assertNotFound();
        $this->get('http://jadidaring.test/gamehub')->assertNotFound();
    }
}

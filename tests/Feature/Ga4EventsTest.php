<?php

namespace Tests\Feature;

use App\Models\CompanyProfile;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class Ga4EventsTest extends TestCase
{
    use RefreshDatabase;

    private const HOST = 'http://jadidaring.test';

    public function test_jdtrack_helper_is_defined_with_consent_gate_and_noops_without_id(): void
    {
        config(['services.ga4.measurement_id' => null]);
        $this->get(self::HOST.'/')->assertSee('window.jdTrack', false)->assertDontSee('googletagmanager', false)->assertDontSee('jd-track.js', false);

        config(['services.ga4.measurement_id' => 'G-TEST123456']);
        $this->get(self::HOST.'/')->assertSee('if (!window.__gaLoaded', false)->assertSee('js/jd-track.js', false);
    }

    public function test_login_and_signup_events_are_flashed_once_without_pii(): void
    {
        config(['services.ga4.measurement_id' => 'G-TEST123456']);

        $this->post(self::HOST.'/daftar', ['username' => 'budi_99', 'password' => 'rahasia123', 'password_confirmation' => 'rahasia123'])->assertRedirect();
        $html = $this->get(self::HOST.'/akun')->assertOk()->getContent();
        $this->assertStringContainsString('"sign_up"', $html);
        $this->assertStringContainsString('"method":"password"', $html);
        $this->get(self::HOST.'/akun')->assertDontSee('"sign_up"', false);

        auth()->logout();
        $this->post(self::HOST.'/keluar');
        User::factory()->member()->create(['username' => 'siti', 'password' => 'rahasia123']);
        $this->post(self::HOST.'/masuk', ['login' => 'siti', 'password' => 'rahasia123'])->assertRedirect();
        $this->get(self::HOST.'/akun')->assertSee('"login"', false)->assertSee('"method":"password"', false);
    }

    public function test_game_pages_get_consent_gated_game_start_and_score_hooks(): void
    {
        CompanyProfile::factory()->published()->create(['subdomain' => 'contohgame', 'is_game' => true, 'html' => '<html><head></head><body>x</body></html>']);

        config(['services.ga4.measurement_id' => null]);
        $this->get(self::HOST.'/game/contohgame')->assertOk()->assertDontSee('game_start', false);

        config(['services.ga4.measurement_id' => 'G-TEST123456']);
        $this->get(self::HOST.'/game/contohgame')->assertOk()
            ->assertSee("jdTrack('game_start', { game_slug: slug })", false)
            ->assertSee("'post_score'", false)
            ->assertSee('"contohgame"', false);
    }

    public function test_article_hooks_and_search_carry_ids_only(): void
    {
        config(['services.ga4.measurement_id' => 'G-TEST123456']);
        $this->get(self::HOST.'/berita?q=banjir')->assertOk()->assertSee('data-jd-view="search"', false)->assertSee('search_term', false);
    }
}

<?php

namespace Tests\Feature;

use App\Models\CompanyProfile;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class GitGamesTest extends TestCase
{
    use RefreshDatabase;

    private const HOST = 'http://jadidaring.test';

    private const DB_HTML = '<html><head><title>Versi database</title></head><body>DB-ROLLBACK-COPY</body></html>';

    protected function setUp(): void
    {
        parent::setUp();
        config(['singlepage.git_games' => 'langitbersama,drawquarium,coratcoret,anomaliminimarket,bajajdrift,rebutbendera,ogohogoharak,monyetuluwatu,penaltitimnas,tamiyalintasan,mandarinharian,kopisenja,whoosh,ttskilat,ikanrakus,drag201,malampendakian,cukurkekinian,pawanghujan,mudikmacet,gasingarena,dapurpadang3d,benteng,bumerangsakti,dapurpadang,duelular,gelembung,lanjutkata,pedangsihir,sambungcoret,skalateman,ulartangga,tiltingball,idle-game,clubgame,mlbbpicker,boxing,spiderman,explodingkitten,kehidupankonoha,mahjong,mahjong-master,gambletogether,gamelanhero,nadapiano', 'singlepage.members_only_games' => '*']);
    }

    private function publish(string $slug, string $html = self::DB_HTML, string $status = 'published'): CompanyProfile
    {
        $factory = CompanyProfile::factory()->game();

        return ($status === 'published' ? $factory->published() : $factory)->create(['subdomain' => $slug, 'html' => $html]);
    }

    public function test_game_page_is_the_site_layout_with_nav_and_the_game_frame(): void
    {
        $this->publish('langitbersama');

        $this->get(self::HOST.'/game/langitbersama?room=JSW7GT')
            ->assertOk()
            ->assertSee('class="clay-header"', false)
            ->assertSee('class="clay-brand__name">Jaring', false)
            ->assertSee('is-game-page', false)
            ->assertSee('data-src="/game/langitbersama/play?room=JSW7GT"', false)
            ->assertSee('data-game-fs', false)
            ->assertSee('<title>Langit Bersama · Gambar Layanganmu, Terbangkan ke Langit Bersama</title>', false)
            ->assertSee('<link rel="canonical" href="http://jadidaring.test/game/langitbersama">', false)
            ->assertSee('"@type":"VideoGame"', false)
            ->assertDontSee('DB-ROLLBACK-COPY')
            ->assertDontSee('gmjd1212');
    }

    public function test_play_document_is_the_repo_game_with_the_usual_injections(): void
    {
        $this->publish('langitbersama');

        $response = $this->get(self::HOST.'/game/langitbersama/play')
            ->assertOk()
            ->assertHeader('X-Frame-Options', 'SAMEORIGIN')
            ->assertHeader('X-Robots-Tag', 'noindex')
            ->assertSee('jdng.langitbersama', false)
            ->assertSee('data-jd-gitgame-frame', false)
            ->assertSee("'/game/langitbersama/api/game/' + path", false)
            ->assertSee('data-jdrt-bridge', false)
            ->assertSee('<link rel="canonical" href="http://jadidaring.test/game/langitbersama">', false)
            ->assertSee('masuk</a> atau', false)
            ->assertDontSee('DB-ROLLBACK-COPY')
            ->assertDontSee('gmjd1212');

        $this->assertStringContainsString("frame-ancestors 'self'", (string) $response->headers->get('Content-Security-Policy'));
    }

    public function test_framed_game_forwards_analytics_to_the_shell_instead_of_a_second_banner(): void
    {
        config(['services.ga4.measurement_id' => 'G-TEST1234']);
        $this->publish('langitbersama');

        $this->get(self::HOST.'/game/langitbersama/play')
            ->assertOk()
            ->assertSee('window.parent.jdTrack', false)
            ->assertSee("jdTrack('game_start'", false)
            ->assertDontSee('id="consent-banner"', false)
            ->assertDontSee('googletagmanager', false);

        $this->get(self::HOST.'/game/langitbersama')->assertOk()->assertSee('id="consent-banner"', false);
    }

    public function test_rollback_switch_serves_the_database_html_again(): void
    {
        config(['singlepage.git_games' => '']);
        $this->publish('langitbersama');

        $this->get(self::HOST.'/game/langitbersama')->assertOk()->assertSee('DB-ROLLBACK-COPY')->assertDontSee('data-game-frame', false);
        $this->get(self::HOST.'/game/langitbersama/play')->assertNotFound();
    }

    public function test_unpublished_profile_hides_the_git_game_too(): void
    {
        $this->publish('langitbersama', self::DB_HTML, 'draft');

        $this->get(self::HOST.'/game/langitbersama')->assertNotFound();
        $this->get(self::HOST.'/game/langitbersama/play')->assertNotFound();
    }

    public function test_other_games_keep_their_database_html(): void
    {
        $this->publish('contohgame', '<html><head></head><body>CONTOH-DB</body></html>');

        $this->get(self::HOST.'/game/contohgame')->assertOk()->assertSee('CONTOH-DB')->assertDontSee('data-game-frame', false);
        $this->get(self::HOST.'/game/contohgame/play')->assertNotFound();
    }

    public function test_old_bare_paths_redirect_to_the_game_page(): void
    {
        $this->publish('langitbersama');

        $this->get(self::HOST.'/langitbersama')->assertStatus(301)->assertRedirect(self::HOST.'/game/langitbersama');
        $this->get(self::HOST.'/langitbersama/apa/saja?wallpaper=1')->assertStatus(301)->assertRedirect(self::HOST.'/game/langitbersama?wallpaper=1');
        $this->get('http://langitbersama.jadidaring.test/x?y=1')->assertStatus(301)->assertRedirect('https://jadidaring.test/game/langitbersama?y=1');
    }

    public function test_game_catalogue_reads_the_card_from_the_repo_file(): void
    {
        $this->publish('langitbersama');

        $this->get(self::HOST.'/game')->assertOk()->assertSee('Langit Bersama')->assertDontSee('Versi database');
    }

    public function test_built_game_file_is_ascii_and_has_no_retired_key(): void
    {
        $html = (string) file_get_contents(resource_path('games/langitbersama/game.html'));

        $this->assertTrue(mb_check_encoding($html, 'UTF-8'), 'game.html is valid UTF-8 (most builds are ASCII-only; a few deploy their UTF-8 index.html as is)');
        $this->assertStringNotContainsStringIgnoringCase('gmjd1212', $html);
        $this->assertStringContainsString('</html>', $html);
    }

    /** @return array<string, array{string, string}> */
    public static function migratedGames(): array
    {
        return [
            'drawquarium' => ['drawquarium', 'jdng.drawquarium'],
            'coratcoret' => ['coratcoret', 'JDNG_CFG'],
            'anomaliminimarket' => ['anomaliminimarket', 'data-jd-account-name-lock'],
            'gambletogether' => ['gambletogether', 'data-jd-account-name-lock'],
            'mahjong-master' => ['mahjong-master', 'data-jd-account-name-lock'],
            'mahjong' => ['mahjong', 'data-jd-account-name-lock'],
            'kehidupankonoha' => ['kehidupankonoha', 'data-jd-account-name-lock'],
            'explodingkitten' => ['explodingkitten', 'data-jd-account-name-lock'],
            'ulartangga' => ['ulartangga', 'data-jd-account-name-lock'],
            'skalateman' => ['skalateman', 'data-jd-account-name-lock'],
            'sambungcoret' => ['sambungcoret', 'data-jd-account-name-lock'],
            'pedangsihir' => ['pedangsihir', 'data-jd-account-name-lock'],
            'lanjutkata' => ['lanjutkata', 'data-jd-account-name-lock'],
            'gelembung' => ['gelembung', 'data-jd-account-name-lock'],
            'duelular' => ['duelular', 'data-jd-account-name-lock'],
            'dapurpadang' => ['dapurpadang', 'data-jd-account-name-lock'],
            'bumerangsakti' => ['bumerangsakti', 'data-jd-account-name-lock'],
            'benteng' => ['benteng', 'data-jd-account-name-lock'],
            'dapurpadang3d' => ['dapurpadang3d', 'data-jd-account-name-lock'],
            'gasingarena' => ['gasingarena', 'data-jd-account-name-lock'],
            'mudikmacet' => ['mudikmacet', 'data-jd-account-name-lock'],
            'pawanghujan' => ['pawanghujan', 'data-jd-account-name-lock'],
            'cukurkekinian' => ['cukurkekinian', 'data-jd-account-name-lock'],
            'malampendakian' => ['malampendakian', 'data-jd-account-name-lock'],
            'drag201' => ['drag201', 'data-jd-account-name-lock'],
            'ikanrakus' => ['ikanrakus', 'data-jd-account-name-lock'],
            'ttskilat' => ['ttskilat', 'data-jd-account-name-lock'],
            'whoosh' => ['whoosh', 'data-jd-account-name-lock'],
            'kopisenja' => ['kopisenja', 'data-jd-account-name-lock'],
            'mandarinharian' => ['mandarinharian', 'data-jd-account-name-lock'],
            'tamiyalintasan' => ['tamiyalintasan', 'data-jd-account-name-lock'],
            'penaltitimnas' => ['penaltitimnas', 'data-jd-account-name-lock'],
            'monyetuluwatu' => ['monyetuluwatu', 'data-jd-account-name-lock'],
            'ogohogoharak' => ['ogohogoharak', 'data-jd-account-name-lock'],
            'rebutbendera' => ['rebutbendera', 'data-jd-account-name-lock'],
            'bajajdrift' => ['bajajdrift', 'data-jd-account-name-lock'],
        ];
    }

    #[\PHPUnit\Framework\Attributes\DataProvider('migratedGames')]
    public function test_migrated_game_runs_in_the_site_layout_with_the_account_name(string $slug, string $marker): void
    {
        $this->publish($slug);

        $this->get(self::HOST.'/game/'.$slug)
            ->assertOk()
            ->assertSee('class="clay-header"', false)
            ->assertSee('data-src="/game/'.$slug.'/play"', false)
            ->assertDontSee('DB-ROLLBACK-COPY');

        $this->get(self::HOST.'/game/'.$slug.'/play')
            ->assertOk()
            ->assertHeader('X-Frame-Options', 'SAMEORIGIN')
            ->assertSee($marker, false)
            ->assertSee('window.__JD_ME={"in":false', false)
            ->assertSee('data-jd-gitgame-frame', false)
            ->assertSee("createElement('jd-an')", false)
            ->assertDontSee('DB-ROLLBACK-COPY');

        $this->get(self::HOST.'/'.$slug)->assertStatus(301)->assertRedirect(self::HOST.'/game/'.$slug);

        $html = (string) file_get_contents(resource_path('games/'.$slug.'/game.html'));
        $this->assertTrue(mb_check_encoding($html, 'UTF-8'), 'game.html is valid UTF-8 (most builds are ASCII-only; a few deploy their UTF-8 index.html as is)');
        $this->assertStringNotContainsStringIgnoringCase('gmjd1212', $html);
        $this->assertTrue(str_contains($html, 'window.__JD_ME') || str_contains($html, 'JDNG_CFG') || str_contains($html, 'data-jd-account-name '), 'the game reads the account name itself, through the shared name gate lock, or marks its name field for the lock');
    }

    /** Single-file games with no player name at all (no gate, no name field): layout + frame only. */
    public static function nameFreeGames(): array
    {
        return [
            // name-free:start
            'nadapiano' => ['nadapiano'],
            'gamelanhero' => ['gamelanhero'],
            'spiderman' => ['spiderman'],
            'boxing' => ['boxing'],
            'mlbbpicker' => ['mlbbpicker'],
            'clubgame' => ['clubgame'],
            'idle-game' => ['idle-game'],
            'tiltingball' => ['tiltingball'],
        ];
    }

    #[\PHPUnit\Framework\Attributes\DataProvider('nameFreeGames')]
    public function test_name_free_game_runs_in_the_site_layout(string $slug): void
    {
        $this->publish($slug);

        $this->get(self::HOST.'/game/'.$slug)
            ->assertOk()
            ->assertSee('class="clay-header"', false)
            ->assertSee('data-src="/game/'.$slug.'/play"', false)
            ->assertDontSee('DB-ROLLBACK-COPY');

        $this->get(self::HOST.'/game/'.$slug.'/play')
            ->assertOk()
            ->assertHeader('X-Frame-Options', 'SAMEORIGIN')
            ->assertSee('data-jd-gitgame-frame', false)
            ->assertDontSee('JaRing Game Hub link', false)
            ->assertDontSee('DB-ROLLBACK-COPY');

        $this->get(self::HOST.'/'.$slug)->assertStatus(301)->assertRedirect(self::HOST.'/game/'.$slug);

        $html = (string) file_get_contents(resource_path('games/'.$slug.'/game.html'));
        $this->assertTrue(mb_check_encoding($html, 'UTF-8'));
        $this->assertStringNotContainsStringIgnoringCase('gmjd1212', $html);
        $this->assertStringNotContainsString('JDNG_CFG', $html, 'a game with a name gate belongs in migratedGames');
    }

    public function test_shared_name_gate_games_get_the_account_name_lock_after_the_bridge(): void
    {
        $this->publish('coratcoret');
        $user = \App\Models\User::factory()->create(['name' => 'Budi Akun', 'role' => \App\Enums\UserRole::Member]);

        $html = (string) $this->actingAs($user)->get(self::HOST.'/game/coratcoret/play')->assertOk()->getContent();

        $bridge = strpos($html, 'data-jdng-name-bridge');
        $lock = strpos($html, 'data-jd-account-name-lock');
        $this->assertNotFalse($bridge);
        $this->assertNotFalse($lock);
        $this->assertGreaterThan($bridge, $lock, 'the lock runs after window.__JD_ME is set');
        $this->assertLessThan(strpos($html, 'window.JDNG_CFG'), $lock, 'the lock runs before the game reads its saved name');
        $this->assertStringContainsString('"name":"Budi Akun"', $html);
        $this->assertSame(1, substr_count($html, 'data-jd-account-name-lock'));
    }

    public function test_game_nav_has_a_back_button_and_no_floating_hub_link(): void
    {
        $this->publish('langitbersama');

        $this->get(self::HOST.'/game/langitbersama')
            ->assertOk()
            ->assertSee('data-game-back', false)
            ->assertSee('href="/game" class="theme-toggle game-back"', false);

        $this->get(self::HOST.'/game/langitbersama/play')
            ->assertOk()
            ->assertDontSee('id="jr-hub"', false)
            ->assertDontSee('JaRing Game Hub link', false);

        $this->get(self::HOST.'/game')->assertOk()->assertDontSee('data-game-back', false);
    }
}

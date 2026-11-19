<?php

namespace Tests\Feature;

use App\Models\CompanyProfile;
use App\Models\User;
use App\Services\Realtime;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class RealtimeEngineTest extends TestCase
{
    use RefreshDatabase;

    private bool $rustUp = true;

    private const HOST = 'http://jadidaring.test';

    protected function setUp(): void
    {
        parent::setUp();
        config(['singlepage.realtime_enabled' => true, 'singlepage.rust_games' => 'mahjong', 'app.key' => 'base64:'.base64_encode(str_repeat('k', 32))]);
        Cache::forget('realtime.healthy');
        CompanyProfile::factory()->game()->published()->create(['subdomain' => 'mahjong', 'html' => '<html><head></head><body>M</body></html>']);
        CompanyProfile::factory()->game()->published()->create(['subdomain' => 'drag201', 'html' => '<html><head></head><body>D</body></html>']);
    }

    private function health(bool $up): void
    {
        Cache::forget('realtime.healthy');
        $this->rustUp = $up;
        Http::fake(fn () => $this->rustUp ? Http::response(['ok' => true]) : Http::response('', 500));
    }

    public function test_listed_game_gets_rust_url_with_scoped_signed_token(): void
    {
        $this->health(true);
        $ws = $this->getJson(self::HOST.'/game/mahjong/api/game/config')->assertOk()->json('websocket');

        $this->assertSame('rust', $ws['engine']);
        $this->assertStringContainsString('/rt/app/'.Realtime::key(), $ws['url']);
        parse_str((string) parse_url($ws['url'], PHP_URL_QUERY), $q);
        [$v, $exp, $uid, $slug, $sig] = explode('.', $q['t']);
        $this->assertSame(['v1', '0', 'mahjong'], [$v, $uid, $slug]);
        $this->assertEqualsWithDelta(time() + 300, (int) $exp, 5);
        $this->assertSame(hash_hmac('sha256', "v1.$exp.$uid.$slug", Realtime::derive('rt-join')), $sig);
    }

    public function test_token_is_account_linked_and_never_in_html(): void
    {
        $this->health(true);
        $u = User::factory()->member()->create();
        $this->actingAs($u);
        $ws = $this->getJson(self::HOST.'/game/mahjong/api/game/config')->json('websocket');
        parse_str((string) parse_url($ws['url'], PHP_URL_QUERY), $q);
        $this->assertSame((string) $u->id, explode('.', $q['t'])[2]);

        $page = $this->get(self::HOST.'/game/mahjong/')->assertOk()->getContent();
        $this->assertStringNotContainsString($q['t'], $page);
        $this->assertStringNotContainsString(Realtime::secret(), $page);
        $this->assertStringContainsString('data-jdrt-bridge', $page);
        $this->assertStringContainsString('/game/mahjong/api/game/config', $page);
    }

    public function test_injected_bridge_is_byte_identical_to_the_js_file(): void
    {
        // Regression: preg_replace treated '$1' in the bridge as a backreference,
        // which dropped the '&' before t= in the SSE URL (every SSE connect 401'd).
        $js = (string) file_get_contents(public_path('js/realtime-bridge.js'));
        $this->assertStringContainsString("'$1t='", $js);

        $page = (new \App\Services\RealtimeBridge)->inject('<html><head><title>x</title></head><body></body></html>', 'mahjong');
        $this->assertStringContainsString("\n".$js."\n</script>", $page);
    }

    public function test_falls_back_to_reverb_when_rust_is_down_or_game_not_listed(): void
    {
        $this->health(false);
        $this->getJson(self::HOST.'/game/mahjong/api/game/config')->assertJsonPath('websocket.engine', 'reverb');
        $this->assertSame(config('broadcasting.default'), Realtime::connectionFor('mahjong'));

        $this->health(true);
        $this->getJson(self::HOST.'/game/drag201/api/game/config')->assertJsonPath('websocket.engine', 'reverb');
        $this->get(self::HOST.'/game/drag201/')->assertDontSee('data-jdrt-bridge', false);
        $this->assertSame('rust', Realtime::connectionFor('mahjong'));
    }

    public function test_config_response_is_not_cacheable(): void
    {
        $this->health(true);
        $this->getJson(self::HOST.'/game/mahjong/api/game/config')->assertHeader('Cache-Control');
        $this->assertStringContainsString('no-store', $this->getJson(self::HOST.'/game/mahjong/api/game/config')->headers->get('Cache-Control'));
    }

    public function test_switch_off_forces_reverb(): void
    {
        config(['singlepage.realtime_enabled' => false]);
        $this->assertSame('reverb', Realtime::engine('mahjong'));
    }
}

<?php

namespace Tests\Feature;

use App\Models\MemberPage;
use App\Models\MemberPageDraft;
use App\Models\User;
use App\Services\ProfileConfig;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ProfileRedesignTest extends TestCase
{
    use RefreshDatabase;

    private const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120 Safari/537.36';

    private function base(): string
    {
        return 'http://'.config('singlepage.base_domain');
    }

    private function page(string $name, array $attrs = []): array
    {
        $u = User::factory()->member()->create(['username' => $name, 'name' => ucfirst($name)]);

        return [$u, MemberPage::create(['user_id' => $u->id, 'title' => 'P', 'html' => '', 'config' => ProfileConfig::defaults()] + $attrs)];
    }

    private function visit(string $u, array $server = []): void
    {
        $this->call('GET', $this->base().'/u/'.$u, [], [], [], ['HTTP_USER_AGENT' => self::UA] + $server)->assertOk();
    }

    public function test_visits_count_unique_visitors_not_page_loads(): void
    {
        [$owner, $page] = $this->page('shipu');

        for ($i = 0; $i < 5; $i++) {
            $this->visit('shipu', ['REMOTE_ADDR' => '10.0.0.1']);
        }
        $this->assertSame(1, (int) $page->fresh()->views, 'refreshing must not increment');

        $this->visit('shipu', ['REMOTE_ADDR' => '10.0.0.2']);
        $this->assertSame(2, (int) $page->fresh()->views);

        $viewer = User::factory()->member()->create();
        foreach ([1, 2, 3] as $_) {
            $this->actingAs($viewer)->call('GET', $this->base().'/u/shipu', [], [], [], ['HTTP_USER_AGENT' => self::UA, 'REMOTE_ADDR' => '10.0.0.'.rand(5, 99)])->assertOk();
        }
        $this->assertSame(3, (int) $page->fresh()->views, 'a member counts once regardless of IP');
        $this->assertSame(3, \DB::table('member_page_visitors')->where('member_page_id', $page->id)->count());

        $this->actingAs($owner)->call('GET', $this->base().'/u/shipu', [], [], [], ['HTTP_USER_AGENT' => self::UA])->assertOk();
        $this->assertSame(3, (int) $page->fresh()->views, 'owner visits are not counted');

        foreach (['Googlebot/2.1', 'curl/8.0', 'python-requests/2', ''] as $ua) {
            $this->call('GET', $this->base().'/u/shipu', [], [], [], ['HTTP_USER_AGENT' => $ua, 'REMOTE_ADDR' => '10.9.9.'.rand(1, 250)])->assertOk();
        }
        $this->assertSame(3, (int) $page->fresh()->views, 'bots are not counted');
    }

    public function test_profile_is_fixed_layout_rendered_by_us_with_wall_and_no_iframe_without_custom_widget(): void
    {
        [, $page] = $this->page('ani_k');
        $html = $this->get($this->base().'/u/ani_k')->assertOk()->getContent();
        $this->assertStringContainsString('class="pf ', $html);
        $this->assertStringContainsString('id="komentar"', $html);
        $this->assertStringContainsString('class="clay-header"', $html);
        $this->assertStringNotContainsString('<iframe', $html);
    }

    public function test_config_is_strictly_validated_and_css_is_whitelisted(): void
    {
        $c = ProfileConfig::validate([
            'profile' => ['about' => '<script>x</script>hai', 'avatar' => 'http://insecure/a.png', 'tagline' => str_repeat('a', 500)],
            'theme' => [
                'bg' => ['type' => 'image', 'image' => 'https://ok.test/a.jpg"); } body{display:none', 'color' => 'red;}', 'overlay' => 9],
                'colors' => ['text' => 'url(javascript:1)', 'accent' => '#ABCDEF'],
                'font' => 'Evil Font;}', 'card' => ['radius' => 999, 'opacity' => -3, 'blur' => 'x'],
                'cursor' => ['url' => "https://ok.test/c.png'"],
            ],
            'widgets' => [['type' => 'about'], ['type' => 'evil'], ['type' => 'about'], ['type' => 'custom_html'], ['type' => 'youtube', 'id' => 'https://youtu.be/dQw4w9WgXcQ'], ['type' => 'links', 'items' => [['label' => 'x', 'url' => 'javascript:alert(1)'], ['label' => 'ok', 'url' => 'https://ok.test/']]]],
        ], false);

        $this->assertSame('xhai', $c['profile']['about']);
        $this->assertSame('', $c['profile']['avatar']);
        $this->assertSame(80, mb_strlen($c['profile']['tagline']));
        $this->assertSame('', $c['theme']['bg']['image']);
        $this->assertSame('#ede7ff', $c['theme']['bg']['color']);
        $this->assertSame(0.8, $c['theme']['bg']['overlay']);
        $this->assertSame('#2b2440', $c['theme']['colors']['text']);
        $this->assertSame('#abcdef', $c['theme']['colors']['accent']);
        $this->assertSame('Nunito', $c['theme']['font']);
        $this->assertSame(40, $c['theme']['card']['radius']);
        $this->assertSame(0.3, $c['theme']['card']['opacity']);
        $this->assertSame('', $c['theme']['cursor']['url']);
        $this->assertSame(['about', 'youtube', 'links'], array_column($c['widgets'], 'type'));
        $this->assertSame('dQw4w9WgXcQ', $c['widgets'][1]['id']);
        $this->assertCount(1, $c['widgets'][2]['items']);

        $css = ProfileConfig::css($c);
        $this->assertStringNotContainsString('javascript', $css['vars'].$css['bg']);
        $this->assertStringNotContainsString('display:none', $css['bg']);
    }

    public function test_good_image_urls_become_background_and_cursor_and_custom_widget_needs_html(): void
    {
        $c = ProfileConfig::validate(['theme' => ['bg' => ['type' => 'image', 'image' => 'https://img.test/bg.jpg'], 'cursor' => ['url' => 'https://img.test/c.png']], 'widgets' => [['type' => 'custom_html']]], true);
        $css = ProfileConfig::css($c);
        $this->assertStringContainsString('url("https://img.test/bg.jpg")', $css['bg']);
        $this->assertStringContainsString('cursor:url("https://img.test/c.png")', $css['cursor']);
        $this->assertSame(['custom_html'], array_column($c['widgets'], 'type'));
    }

    public function test_legacy_full_page_becomes_a_custom_html_widget_so_nothing_is_lost(): void
    {
        $u = User::factory()->member()->create(['username' => 'old_u']);
        $page = MemberPage::create(['user_id' => $u->id, 'title' => 'Old', 'html' => '<html><body><h1>lama</h1></body></html>']);
        $this->assertContains('custom_html', array_column($page->profileConfig()['widgets'], 'type'));

        $html = $this->get($this->base().'/u/old_u')->assertOk()->getContent();
        $this->assertMatchesRegularExpression('#<iframe id="member-frame"[^>]*sandbox="allow-scripts allow-popups"#', $html);
        $this->assertStringNotContainsString('allow-same-origin" src="/u/old_u/konten', $html);
    }

    public function test_save_creates_draft_with_validated_config_and_publish_applies_it(): void
    {
        $u = User::factory()->member()->create(['username' => 'dd_dd']);
        $cfg = json_encode(['profile' => ['tagline' => 'halo'], 'theme' => ['colors' => ['accent' => 'nope']], 'widgets' => [['type' => 'about']]]);
        $this->actingAs($u)->post($this->base().'/komunitas/halamanku', ['config' => $cfg])->assertRedirect('/komunitas/halamanku');
        $this->assertNull(MemberPage::where('user_id', $u->id)->first());
        $draft = MemberPageDraft::where('user_id', $u->id)->first();
        $this->assertSame('#7c5cff', $draft->config['theme']['colors']['accent']);

        $this->actingAs($u)->post($this->base().'/komunitas/halamanku/draft/terbitkan')->assertRedirect('/u/dd_dd');
        $this->assertSame('halo', MemberPage::where('user_id', $u->id)->first()->config['profile']['tagline']);
    }

    public function test_preview_endpoint_renders_posted_config_server_side(): void
    {
        $u = User::factory()->member()->create(['username' => 'pp_pp']);
        $r = $this->actingAs($u)->postJson($this->base().'/komunitas/halamanku/pratinjau', ['config' => ['profile' => ['tagline' => '<b>Hai</b>'], 'widgets' => [['type' => 'status']]]]);
        $r->assertOk()->assertSee('class="pf ', false)->assertDontSee('<b>Hai</b>', false);
        auth()->logout();
        $this->postJson($this->base().'/komunitas/halamanku/pratinjau', [])->assertUnauthorized();
    }

    public function test_draft_api_accepts_config_and_html_for_custom_widget(): void
    {
        $u = User::factory()->member()->create(['username' => 'api_u']);
        $key = $this->actingAs($u)->postJson($this->base().'/komunitas/draft-key')->json('key');
        auth()->logout();
        $this->postJson($this->base().'/api/komunitas/draft', ['key' => $key, 'config' => ['profile' => ['status' => 'ok'], 'widgets' => [['type' => 'status'], ['type' => 'custom_html']]], 'html' => '<html><body onclick="1"><p>w</p></body></html>'])
            ->assertCreated();
        $d = MemberPageDraft::where('user_id', $u->id)->first();
        $this->assertSame(['status', 'custom_html'], array_column($d->config['widgets'], 'type'));
        $this->assertStringContainsString('<p>w</p>', $d->html);
        $this->assertNull(MemberPage::where('user_id', $u->id)->first());
    }

    public function test_nav_account_goes_to_own_profile_and_owner_profile_is_created_on_first_visit(): void
    {
        $u = User::factory()->member()->create(['username' => 'zed_z']);
        $this->actingAs($u)->get($this->base().'/komunitas')->assertOk()->assertSee('href="/u/zed_z"', false);
        $this->get($this->base().'/u/zed_z')->assertOk()->assertSee('Edit profil')->assertSee('/akun');
        $this->assertNotNull(MemberPage::where('user_id', $u->id)->first());
        auth()->logout();
        $this->get($this->base().'/komunitas')->assertOk()->assertSee('href="/masuk"', false);
    }

    public function test_explore_lists_customised_profiles_with_search_and_sort(): void
    {
        [, $a] = $this->page('alpha_a', ['views' => 5]);
        [, $b] = $this->page('beta_b', ['views' => 50]);
        $empty = User::factory()->member()->create(['username' => 'blank_x']);
        MemberPage::create(['user_id' => $empty->id, 'title' => 'x', 'html' => '']);

        $r = $this->get($this->base().'/komunitas?tab=profil')->assertOk()->assertSee('@alpha_a')->assertSee('@beta_b')->assertDontSee('@blank_x');
        $this->get($this->base().'/komunitas?q=beta')->assertOk()->assertSee('@beta_b')->assertDontSee('@alpha_a');
        $html = $this->get($this->base().'/komunitas?urut=populer')->getContent();
        $this->assertLessThan(strpos($html, '@alpha_a'), strpos($html, '@beta_b'));
    }
}

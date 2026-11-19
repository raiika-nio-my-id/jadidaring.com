<?php

namespace Tests\Feature;

use App\Models\MemberPage;
use App\Models\User;
use App\Services\ProfileConfig;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ProfileLayoutTest extends TestCase
{
    use RefreshDatabase;

    private function base(): string
    {
        return 'http://'.config('singlepage.base_domain');
    }

    public function test_widths_layout_and_autoplay_are_validated(): void
    {
        $c = ProfileConfig::validate([
            'layout' => ['justify' => 'between', 'align' => 'stretch', 'gap' => 'loose'],
            'music' => ['url' => 'https://example.com/a.mp3', 'autoplay' => true],
            'widgets' => [['type' => 'about', 'width' => '25'], ['type' => 'status', 'width' => 42], ['type' => 'links', 'width' => '100;color:red']],
        ]);
        $this->assertSame(['justify' => 'between', 'align' => 'stretch', 'gap' => 'loose'], $c['layout']);
        $this->assertTrue($c['music']['autoplay']);
        $this->assertSame('25', (string) $c['widgets'][0]['width']);
        $this->assertArrayNotHasKey('width', array_filter($c['widgets'][1], fn ($v, $k) => $k === 'width' && (string) $v === '42', ARRAY_FILTER_USE_BOTH));
        $this->assertStringNotContainsString('red', json_encode($c['widgets'][2]));

        $bad = ProfileConfig::validate(['layout' => ['justify' => 'evil', 'align' => 1, 'gap' => '<x>'], 'music' => ['autoplay' => 'yes please']]);
        $this->assertSame(ProfileConfig::defaults()['layout'], $bad['layout']);
        $this->assertFalse($bad['music']['autoplay']);

        $old = ProfileConfig::validate(['widgets' => [['type' => 'about']]]);
        $this->assertSame(ProfileConfig::defaults()['layout'], $old['layout']);
        $this->assertFalse($old['music']['autoplay']);
    }

    public function test_autoplay_markup_only_for_visitors_never_in_editor(): void
    {
        $u = User::factory()->member()->create(['username' => 'apuser']);
        $cfg = ProfileConfig::validate([
            'music' => ['url' => 'https://example.com/a.mp3', 'title' => 'Lagu', 'autoplay' => true],
            'widgets' => [['type' => 'music', 'width' => '33'], ['type' => 'about']],
            'layout' => ['justify' => 'center', 'align' => 'top', 'gap' => 'tight'],
        ]);
        MemberPage::query()->create(['user_id' => $u->id, 'title' => 'x', 'html' => '', 'status' => 'published', 'config' => $cfg]);

        $page = $this->get($this->base().'/u/apuser')->assertOk()->getContent();
        $this->assertStringContainsString('data-autoplay="music"', $page);
        $this->assertStringContainsString('data-ap="1"', $page);
        $this->assertStringContainsString('js/profile-music.js', $page);
        $this->assertStringContainsString('--w:33', $page);
        $this->assertStringContainsString('center', $page);

        $edit = $this->actingAs($u)->get($this->base().'/komunitas/halamanku')->assertOk()->getContent();
        $this->assertStringNotContainsString('data-autoplay=', $edit);
        $this->assertStringNotContainsString('data-ap="1"', $edit);
        $this->assertStringContainsString('data-edit="layout"', $edit);
        $this->assertStringContainsString('data-avatar-upload', $edit);
        $this->assertStringContainsString('data-inline="profile.about"', $edit);
    }

    public function test_autosave_keeps_live_page_untouched(): void
    {
        $u = User::factory()->member()->create(['username' => 'asuser']);
        MemberPage::query()->create(['user_id' => $u->id, 'title' => 'x', 'html' => '', 'status' => 'published', 'config' => ProfileConfig::validate(['profile' => ['tagline' => 'lama']])]);
        $r = $this->actingAs($u)->postJson($this->base().'/komunitas/halamanku/autosave', ['config' => ['profile' => ['tagline' => 'baru'], 'widgets' => [['type' => 'about', 'width' => '75']]]]);
        $r->assertOk()->assertJsonPath('config.profile.tagline', 'baru')->assertJsonPath('config.widgets.0.width', '75');
        $this->assertSame('lama', MemberPage::query()->where('user_id', $u->id)->first()->profileConfig()['profile']['tagline']);
        $this->assertStringContainsString('baru', $this->get($this->base().'/komunitas/halamanku')->getContent());
    }
}

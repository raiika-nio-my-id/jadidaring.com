<?php

namespace Tests\Feature;

use App\Models\MemberPage;
use App\Models\MemberPageDraft;
use App\Models\User;
use App\Services\ProfileConfig;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class EditorRenderTest extends TestCase
{
    use RefreshDatabase;

    private function member(): User
    {
        return User::factory()->member()->create(['name' => 'Shipu', 'username' => 'shipu_t']);
    }

    public function test_editor_renders_for_member_without_page(): void
    {
        $r = $this->actingAs($this->member())->get('http://'.config('singlepage.base_domain').'/komunitas/halamanku');
        $r->assertOk();
        $this->assertGreaterThan(2000, strlen($r->getContent()));
        $r->assertSee('id="le-stage"', false);
    }

    public function test_editor_renders_for_member_with_legacy_page(): void
    {
        $u = $this->member();
        MemberPage::create(['user_id' => $u->id, 'title' => 'Shipu', 'html' => '<p>hi</p>', 'is_published' => true]);
        $r = $this->actingAs($u)->get('http://'.config('singlepage.base_domain').'/komunitas/halamanku');
        $r->assertOk();
        $this->assertGreaterThan(2000, strlen($r->getContent()));
    }

    public function test_editor_renders_with_pending_draft_and_sandbox_domain(): void
    {
        config(['singlepage.sandbox_domain' => 'u.'.config('singlepage.base_domain')]);
        $u = $this->member();
        MemberPage::create(['user_id' => $u->id, 'title' => 'Shipu', 'html' => '<p>hi</p>', 'status' => 'published']);
        MemberPageDraft::create(['user_id' => $u->id, 'title' => 'D', 'html' => '<p>draft</p>', 'source' => 'api', 'config' => ProfileConfig::legacy()]);
        $r = $this->actingAs($u)->get('http://'.config('singlepage.base_domain').'/komunitas/halamanku');
        $r->assertOk()->assertSee('id="le-stage"', false)->assertSee('Terbitkan');
        $this->assertGreaterThan(2000, strlen($r->getContent()));
    }

    public function test_editor_css_keeps_preview_backgrounds_inside_the_editor(): void
    {
        $css = file_get_contents(public_path('css/clay.css'));
        $this->assertMatchesRegularExpression('/\.clay-card \.pf--fixed \.pf-bg[^{]*\.pf-live \.pf--fixed \.pf-bg\s*\{\s*position:\s*absolute/', $css);
    }
}

<?php

namespace Tests\Feature;

use App\Models\MemberPage;
use App\Models\MemberPageDraft;
use App\Models\User;
use App\Services\ProfileConfig;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class ProfileLiveEditTest extends TestCase
{
    use RefreshDatabase;

    private function base(): string
    {
        return 'http://'.config('singlepage.base_domain');
    }

    private function member(string $name = 'live_a'): User
    {
        return User::factory()->member()->create(['username' => $name, 'name' => ucfirst($name)]);
    }

    public function test_editor_is_the_live_edit_mode_with_tappable_parts_and_save_bar(): void
    {
        $u = $this->member();
        MemberPage::create(['user_id' => $u->id, 'title' => 'P', 'html' => '', 'status' => 'published', 'config' => ProfileConfig::defaults()]);

        $r = $this->actingAs($u)->get($this->base().'/komunitas/halamanku')->assertOk();
        $r->assertSee('id="le-stage"', false)->assertSee('data-edit="head"', false)->assertSee('data-edit="bg"', false)
            ->assertSee('data-edit="w:0"', false)->assertSee('data-edit="wall"', false)
            ->assertSee('Simpan draft')->assertSee('Terbitkan')->assertSee('Batal')->assertSee('Tambah kotak')
            ->assertSee('profile-live.js', false)->assertSee('Pengunjung');
        $this->actingAs($u)->get($this->base().'/komunitas/halamanku/klasik')->assertOk()->assertSee('id="pf-edit"', false);
    }

    public function test_boot_json_cannot_break_out_of_its_script_tag(): void
    {
        $u = $this->member();
        $c = ProfileConfig::defaults();
        $c['profile']['tagline'] = '</script><script>alert(1)</script>';
        MemberPage::create(['user_id' => $u->id, 'title' => 'P', 'html' => '<p>x</p></script><img src=x onerror=alert(1)>', 'status' => 'published', 'config' => ProfileConfig::validate($c, true)]);
        $html = $this->actingAs($u)->get($this->base().'/komunitas/halamanku')->assertOk()->getContent();
        $boot = substr($html, strpos($html, 'id="le-boot"'));
        $boot = substr($boot, 0, strpos($boot, '</script>'));
        $this->assertStringNotContainsString('<', substr($boot, strpos($boot, '>') + 1));
    }

    public function test_preview_marks_editable_parts_only_in_edit_mode(): void
    {
        $u = $this->member();
        $cfg = ['widgets' => [['type' => 'about'], ['type' => 'quote', 'text' => 'Hai']]];
        $this->actingAs($u)->postJson($this->base().'/komunitas/halamanku/pratinjau', ['config' => $cfg, 'edit' => 1])
            ->assertOk()->assertSee('data-edit="w:1"', false)->assertSee('data-type="quote"', false);
        $this->actingAs($u)->postJson($this->base().'/komunitas/halamanku/pratinjau', ['config' => $cfg])
            ->assertOk()->assertDontSee('data-edit=', false);
    }

    public function test_publish_from_the_save_bar_saves_and_goes_live_in_one_step(): void
    {
        $u = $this->member('live_p');
        $c = ProfileConfig::defaults();
        $c['profile']['tagline'] = 'Langsung tayang';
        $this->actingAs($u)->post($this->base().'/komunitas/halamanku', ['config' => json_encode($c), 'custom_html' => '', 'action' => 'publish'])
            ->assertRedirect('/u/live_p');
        $this->assertSame('Langsung tayang', MemberPage::where('user_id', $u->id)->first()->profileConfig()['profile']['tagline']);
        $this->assertSame(0, MemberPageDraft::count());

        $c['profile']['tagline'] = 'Cuma draft';
        $this->actingAs($u)->post($this->base().'/komunitas/halamanku', ['config' => json_encode($c), 'action' => 'draft'])->assertRedirect('/komunitas/halamanku');
        $this->assertSame('Langsung tayang', MemberPage::where('user_id', $u->id)->first()->profileConfig()['profile']['tagline']);
        $this->assertSame(1, MemberPageDraft::count());
    }

    public function test_ai_import_link_opens_in_the_live_editor_with_the_same_buttons(): void
    {
        $u = $this->member('live_i');
        $c = ProfileConfig::defaults();
        $c['profile']['tagline'] = 'Dari AI';
        $r = $this->actingAs($u)->get($this->base().'/komunitas/halamanku/import?json='.rawurlencode(json_encode($c)))->assertOk();
        $r->assertSee('id="le-stage"', false)->assertSee('Terbitkan sekarang')->assertSee('Simpan sebagai draft')->assertSee('value="ai_import"', false)->assertSee('Dari AI');
        $this->assertSame(0, MemberPage::count() + MemberPageDraft::count());
    }

    public function test_profile_header_has_one_stats_row_with_follow_button(): void
    {
        $owner = $this->member('live_o');
        $fan = $this->member('live_f');
        MemberPage::create(['user_id' => $owner->id, 'title' => 'P', 'html' => '', 'status' => 'published', 'config' => ProfileConfig::defaults(), 'views' => 7]);
        DB::table('member_follows')->insert(['follower_id' => $fan->id, 'followed_id' => $owner->id, 'created_at' => now()]);

        $html = $this->get($this->base().'/u/live_o')->assertOk()->assertSee('Masuk untuk mengikuti')->getContent();
        $at = strpos($html, 'class="pf-card pf-head');
        $head = substr($html, $at, strpos($html, '</header>', $at) - $at);
        $this->assertStringContainsString('href="/u/live_o/pengikut"><strong>1</strong> <span>Pengikut</span>', $head);
        $this->assertStringContainsString('<span>Mengikuti</span>', $head);
        $this->assertStringContainsString('<strong>8</strong> <span>Pengunjung</span>', $head);
        $this->assertStringContainsString('Masuk untuk mengikuti', $head);
        $this->assertStringNotContainsString('class="clay-card pf-social"', $html);

        $this->actingAs($fan)->get($this->base().'/u/live_o')->assertSee('Berhenti mengikuti');
        $this->actingAs($owner)->get($this->base().'/u/live_o')->assertDontSee('Berhenti mengikuti')->assertDontSee('>Ikuti<', false);
    }
}

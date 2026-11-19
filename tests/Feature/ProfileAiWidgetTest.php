<?php

namespace Tests\Feature;

use App\Models\MemberPage;
use App\Models\MemberPageDraft;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class ProfileAiWidgetTest extends TestCase
{
    use RefreshDatabase;

    private const B = 'http://jadidaring.test';

    private function boot(string $content): array
    {
        $this->assertSame(1, preg_match('~<script type="application/json" id="le-boot">(.*?)</script>~s', $content, $m));

        return json_decode($m[1], true);
    }

    public function test_guest_is_sent_to_login_keeping_the_payload(): void
    {
        $r = $this->get(self::B.'/komunitas/halamanku/widget?json=abc')->assertRedirect();
        $this->assertStringContainsString('/masuk', $r->headers->get('Location'));
        $this->assertStringContainsString('/komunitas/halamanku/widget?json=abc', session('url.intended'));
    }

    public function test_link_opens_the_editor_with_a_sanitized_prefill_and_stores_nothing(): void
    {
        $user = User::factory()->member()->create(['username' => 'aiw_a']);
        $html = '<div class="w-c">Halo</div><style>.w-c{color:red}</style><script>alert(1)</script><iframe src="https://evil.test"></iframe><a href="javascript:alert(1)">x</a>';
        $forms = [
            'json' => 'json='.rawurlencode(json_encode(['title' => 'Kartu', 'html' => $html])),
            'd-zlib' => 'd='.rtrim(strtr(base64_encode(gzcompress(json_encode(['html' => $html]))), '+/', '-_'), '='),
            'html' => 'html='.rawurlencode($html),
        ];

        foreach ($forms as $qs) {
            $res = $this->actingAs($user)->get(self::B.'/komunitas/halamanku/widget?'.$qs.'&width=33')->assertOk()->assertSee('Mode edit', false);
            $prefill = $this->boot($res->getContent())['prefill'];
            $this->assertStringContainsString('Halo', $prefill['html']);
            $this->assertStringNotContainsStringIgnoringCase('<iframe', $prefill['html']);
            $this->assertStringNotContainsString('javascript:', $prefill['html']);
            $this->assertSame('33', $prefill['width']);
            $this->assertFalse($prefill['replaces']);
        }

        $this->assertSame(0, MemberPageDraft::query()->count());
        $this->assertSame(0, MemberPage::query()->count());
    }

    public function test_bad_empty_and_oversized_payloads_go_back_to_the_editor_with_a_message(): void
    {
        $user = User::factory()->member()->create(['username' => 'aiw_b']);

        $this->actingAs($user)->get(self::B.'/komunitas/halamanku/widget')->assertRedirect('/komunitas/halamanku')->assertSessionHasErrors('widget');
        $this->actingAs($user)->get(self::B.'/komunitas/halamanku/widget?json='.rawurlencode('{"html":""}'))->assertRedirect('/komunitas/halamanku')->assertSessionHasErrors('widget');
        $this->actingAs($user)->get(self::B.'/komunitas/halamanku/widget?json='.rawurlencode('{"html":'))->assertRedirect('/komunitas/halamanku')->assertSessionHasErrors('widget');
        $this->actingAs($user)->get(self::B.'/komunitas/halamanku/widget?json='.rawurlencode(json_encode(['html' => str_repeat('a', 310000)])))->assertRedirect('/komunitas/halamanku')->assertSessionHasErrors('widget');
    }

    public function test_invalid_width_is_ignored_and_existing_code_is_flagged_as_replaced(): void
    {
        $user = User::factory()->member()->create(['username' => 'aiw_c']);
        MemberPage::query()->create(['user_id' => $user->id, 'title' => 't', 'html' => '<p>lama</p>', 'config' => null, 'status' => 'published']);

        $res = $this->actingAs($user)->get(self::B.'/komunitas/halamanku/widget?width=999&json='.rawurlencode('{"html":"<p>baru</p>"}'))->assertOk();
        $prefill = $this->boot($res->getContent())['prefill'];
        $this->assertSame('', $prefill['width']);
        $this->assertTrue($prefill['replaces']);
        $this->assertSame('<p>lama</p>', MemberPage::query()->first()->html);
    }

    public function test_editor_has_the_ai_modal_hook_and_real_ubah_buttons_are_scripted(): void
    {
        $user = User::factory()->member()->create(['username' => 'aiw_d']);
        $c = $this->actingAs($user)->get(self::B.'/komunitas/halamanku')->assertOk()->assertSee('data-open="ai"', false)->assertSee('profile-ai-widget.js', false)->getContent();
        $this->assertNull($this->boot($c)['prefill']);
        $this->assertArrayNotHasKey('promptUrl', $this->boot($c));
    }

    public function test_widget_form_values_are_kept_separately_from_the_profile_form(): void
    {
        $user = User::factory()->member()->create(['username' => 'aiw_e']);
        $this->actingAs($user)->postJson(self::B.'/komunitas/buat/simpan', ['data' => ['title' => 'Profil Shipu']])->assertOk();
        $this->actingAs($user)->postJson(self::B.'/komunitas/buat/simpan', ['scope' => 'widget', 'data' => ['title' => 'Widget Shipu', 'kind' => 'Hitung mundur']])->assertOk();

        $c = $this->actingAs($user)->get(self::B.'/komunitas/halamanku')->getContent();
        $this->assertSame('Widget Shipu', $this->boot($c)['ai']['saved']['title']);
        $this->actingAs($user)->get(self::B.'/komunitas/buat')->assertSee('Profil Shipu', false);

        // saving the profile form again must not wipe the widget values
        $this->actingAs($user)->postJson(self::B.'/komunitas/buat/simpan', ['data' => ['title' => 'Profil 2']])->assertOk();
        $this->assertSame('Widget Shipu', $this->boot($this->actingAs($user)->get(self::B.'/komunitas/halamanku')->getContent())['ai']['saved']['title']);

        $this->actingAs($user)->postJson(self::B.'/komunitas/buat/reset', ['scope' => 'widget'])->assertOk();
        $this->assertNull($this->boot($this->actingAs($user)->get(self::B.'/komunitas/halamanku')->getContent())['ai']['saved']);
        $this->assertSame(1, DB::table('prompt_form_states')->count());
    }
}

<?php

namespace Tests\Feature;

use App\Models\MemberPage;
use App\Models\MemberPageDraft;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ProfileImportLinkTest extends TestCase
{
    use RefreshDatabase;

    private const B = 'http://jadidaring.test';

    private function cfg(): array
    {
        return ['profile' => ['tagline' => 'Halo dari AI', 'status' => 'Lagi ngoding', 'about' => 'Suka kopi'], 'theme' => ['bg' => ['type' => 'gradient', 'color' => '#112233', 'color2' => '#445566'], 'colors' => ['text' => '#ffffff', 'accent' => '#ff00aa', 'card' => '#000000', 'link' => '#00ffff'], 'font' => 'Poppins'], 'widgets' => [['type' => 'status'], ['type' => 'about'], ['type' => 'counter']]];
    }

    private function forms(): array
    {
        $j = json_encode($this->cfg(), JSON_UNESCAPED_UNICODE);

        return [
            'json' => 'json='.rawurlencode($j),
            'd-plain' => 'd='.rawurlencode($j),
            'd-b64' => 'd='.rtrim(strtr(base64_encode($j), '+/', '-_'), '='),
            'd-zlib' => 'd='.rtrim(strtr(base64_encode(gzcompress($j)), '+/', '-_'), '='),
            'd-raw-deflate' => 'd='.rtrim(strtr(base64_encode(gzdeflate($j)), '+/', '-_'), '='),
        ];
    }

    public function test_guest_is_sent_to_login_keeping_the_payload(): void
    {
        $r = $this->get(self::B.'/komunitas/halamanku/import?d=abc')->assertRedirect();
        $this->assertStringContainsString('/masuk', $r->headers->get('Location'));
        $this->assertStringContainsString('/komunitas/halamanku/import?d=abc', session('url.intended'));
    }

    public function test_every_encoding_previews_without_writing_anything(): void
    {
        $user = User::factory()->member()->create(['username' => 'imp_a']);

        foreach ($this->forms() as $name => $qs) {
            $this->actingAs($user)->get(self::B.'/komunitas/halamanku/import?'.$qs)->assertOk()->assertSee('Halo dari AI', false)->assertSee('Simpan sebagai draft', false);
        }

        $this->assertSame(0, MemberPageDraft::query()->count());
        $this->assertSame(0, MemberPage::query()->count());
    }

    public function test_post_creates_a_draft_only_and_bad_links_are_explained(): void
    {
        $user = User::factory()->member()->create(['username' => 'imp_b']);
        $body = json_encode($this->cfg());

        $this->actingAs($user)->post(self::B.'/komunitas/halamanku/import', ['config' => $body])->assertRedirect('/komunitas/halamanku');
        $this->assertSame(1, MemberPageDraft::query()->count());
        $this->assertSame(0, MemberPage::query()->count());
        $this->assertSame('Halo dari AI', MemberPageDraft::query()->first()->profileConfig()['profile']['tagline']);

        $this->actingAs($user)->get(self::B.'/komunitas/halamanku/import?d='.rawurlencode('{"theme":'))->assertOk()->assertSee('tidak bisa dipakai', false)->assertSee('Tempel JSON dari AI', false);
        $this->actingAs($user)->get(self::B.'/komunitas/halamanku/import')->assertOk()->assertSee('tidak bisa dipakai', false);
    }

    public function test_decimals_are_clamped_not_rejected_and_saves_are_not_hourly_limited(): void
    {
        $user = User::factory()->member()->create(['username' => 'imp_c']);
        $c = $this->cfg();
        $c['theme']['card'] = ['radius' => 12.6, 'opacity' => 0.83, 'blur' => 7.5];
        $c['theme']['bg']['overlay'] = 0.12;

        for ($i = 0; $i < 15; $i++) {
            $this->actingAs($user)->post(self::B.'/komunitas/halamanku', ['config' => json_encode($c)])->assertRedirect('/komunitas/halamanku');
        }

        $t = MemberPageDraft::query()->first()->profileConfig()['theme'];
        $this->assertSame(0.83, (float) $t['card']['opacity']);
        $this->assertSame(0.12, (float) $t['bg']['overlay']);
    }
}

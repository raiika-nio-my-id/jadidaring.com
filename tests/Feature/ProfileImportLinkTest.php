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

        $this->actingAs($user)->get(self::B.'/komunitas/halamanku/import?d='.rawurlencode('{"theme":'))->assertOk()->assertSee('tidak bisa dibaca', false)->assertSee('Tempel JSON dari AI', false);
        $this->actingAs($user)->get(self::B.'/komunitas/halamanku/import')->assertOk()->assertSee('tidak bisa dibaca', false);
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

    public function test_andikas_real_chatgpt_link_shows_all_three_actions_and_flags_fixes(): void
    {
        $user = User::factory()->member()->create(['username' => 'imp_d']);
        $link = 'json=%7B%22profile%22:%7B%22tagline%22:%22YouTuber+|+Selamat+datang+di+dunia+Shipu+Tidataru!%22,%22status%22:%22Halo!+Terima+kasih+sudah+mampir+ke+profilku.+Cek+channel+YouTube-ku,+ya!%22,%22about%22:%22Hai,+aku+Shipu+Tidataru,+seorang+YouTuber.+Kalau+kamu+pengunjung+baru,+yuk+mampir+dan+jelajahi+video-video+di+channel-ku.+Jangan+lupa+berlangganan+jika+kamu+menikmati+kontennya!%22,%22avatar%22:%22%22%7D,%22theme%22:%7B%22bg%22:%7B%22type%22:%22gradient%22,%22color%22:%22%23a18aff%22,%22color2%22:%22%23ffd1e8%22,%22angle%22:135,%22image%22:%22%22,%22pattern%22:%22grid%22,%22fixed%22:true,%22overlay%22:0.08%7D,%22colors%22:%7B%22text%22:%22%2329213d%22,%22accent%22:%22%23ffb020%22,%22card%22:%22%23fffaff%22,%22link%22:%22%23563b9a%22%7D,%22font%22:%22Press+Start+2P%22,%22card%22:%7B%22radius%22:0,%22opacity%22:1,%22blur%22:0%7D,%22cursor%22:%7B%22url%22:%22%22,%22size%22:32%7D%7D,%22music%22:%7B%22url%22:%22%22,%22title%22:%22%22%7D,%22widgets%22:%5B%7B%22type%22:%22about%22%7D,%7B%22type%22:%22status%22%7D,%7B%22type%22:%22counter%22%7D,%7B%22type%22:%22links%22,%22items%22:%5B%7B%22label%22:%22YouTube+%E2%80%94+Shipu+Tidataru%22,%22url%22:%22https:%2F%2Fwww.youtube.com%2F@ShipuTidataru%22%7D%5D%7D%5D%7D&amp;utm_source=chatgpt.com';
        $html = $this->actingAs($user)->get(self::B.'/komunitas/halamanku/import?'.$link)->assertOk()->getContent();
        foreach (['Terbitkan sekarang', 'Simpan sebagai draft', 'Batal', 'Ringkasan perubahan', 'Press Start 2P', 'Shipu Tidataru'] as $needle) {
            $this->assertStringContainsString($needle, $html);
        }
        $this->assertSame(0, MemberPage::query()->count());

        $c = $this->cfg();
        $c['theme']['bg']['overlay'] = 0.83;
        $c['bogus'] = 'x';
        $page = $this->actingAs($user)->get(self::B.'/komunitas/halamanku/import?json='.rawurlencode(json_encode($c)))->assertOk()->assertSee('diperbaiki otomatis', false);
        $this->assertStringContainsString('<mark>theme.bg.overlay</mark>', $page->getContent());
    }

    public function test_publish_action_goes_live_and_clears_draft(): void
    {
        $user = User::factory()->member()->create(['username' => 'imp_e']);
        MemberPageDraft::query()->create(['user_id' => $user->id, 'title' => 't', 'html' => '', 'source' => 'paste', 'config' => null]);
        $this->actingAs($user)->post(self::B.'/komunitas/halamanku/import', ['config' => json_encode($this->cfg()), 'action' => 'publish'])->assertRedirect('/u/imp_e')->assertSessionHas('status', 'Profil diperbarui.');
        $this->assertSame('published', MemberPage::query()->where('user_id', $user->id)->value('status'));
        $this->assertSame(0, MemberPageDraft::query()->count());
    }

    public function test_prompt_form_is_remembered_per_member_and_can_be_reset(): void
    {
        $user = User::factory()->member()->create(['username' => 'imp_f']);
        $this->actingAs($user)->postJson(self::B.'/komunitas/buat/simpan', ['data' => ['title' => 'Shipu', 'feat' => ['galeri gambar']]])->assertOk();
        $this->actingAs($user)->get(self::B.'/komunitas/buat')->assertOk()->assertSee('Shipu', false)->assertSee('Ulang dari awal', false);
        $this->actingAs($user)->postJson(self::B.'/komunitas/buat/reset')->assertOk();
        $this->assertSame(0, \Illuminate\Support\Facades\DB::table('prompt_form_states')->count());
    }
}

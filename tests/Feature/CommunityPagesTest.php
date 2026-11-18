<?php

namespace Tests\Feature;

use App\Models\MemberPage;
use App\Models\MemberPageComment;
use App\Models\User;
use App\Services\MemberPageSanitizer;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Validation\ValidationException;
use Tests\TestCase;

class CommunityPagesTest extends TestCase
{
    use RefreshDatabase;

    private function base(): string
    {
        return 'http://'.config('singlepage.base_domain');
    }

    private function hostile(): string
    {
        return '<!DOCTYPE html><html><head><meta http-equiv="refresh" content="0;url=https://evil.test"><base href="https://evil.test/"><link rel="stylesheet" href="https://evil.test/x.css">'
            .'<style>@import url(https://evil.test/a.css); body{background:url(javascript:alert(1)); cursor:url(https://ok.test/c.png),auto}</style>'
            .'<script src="https://evil.test/x.js"></script></head><body onload="x()"><h1>Hai</h1><p>teks</p>'
            .'<iframe src="https://evil.test"></iframe><a href="javascript:alert(1)">a</a><a href="https://ok.test/">b</a>'
            .'<img src="https://ok.test/i.png" onerror="y()"><audio autoplay src="https://ok.test/m.mp3"></audio>'
            .'<form action="https://evil.test/steal"><input name="q"></form><script>var ok=1;</script></body></html>';
    }

    public function test_sanitizer_strips_dangerous_markup(): void
    {
        $out = MemberPageSanitizer::clean($this->hostile());

        foreach (['evil.test/x.js', 'http-equiv', '<base', '<iframe', 'javascript:', '@import', 'autoplay', 'action='] as $bad) {
            $this->assertStringNotContainsString($bad, $out, $bad);
        }
        $this->assertStringContainsString('https://ok.test/c.png', $out);
        $this->assertStringContainsString('var ok=1;', $out);
        $this->assertStringContainsString('noopener', $out);
        $this->assertStringContainsString('noindex', $out);
    }

    public function test_sanitizer_rejects_password_fields_and_oversize_and_empty(): void
    {
        foreach ([
            '<html><body><form><input type="password"></form></body></html>',
            '<html><body><input name="otp"></body></html>',
            '',
            '<html><body>'.str_repeat('a', MemberPageSanitizer::MAX_BYTES).'</body></html>',
        ] as $html) {
            try {
                MemberPageSanitizer::clean($html);
                $this->fail('expected rejection');
            } catch (ValidationException) {
                $this->assertTrue(true);
            }
        }
    }

    public function test_member_saves_page_and_content_is_served_sandboxed_without_cookies(): void
    {
        $user = User::factory()->member()->create(['username' => 'ani_k']);

        $this->actingAs($user)->post($this->base().'/komunitas/halamanku', ['title' => 'Halaman Ani', 'html' => $this->hostile()])
            ->assertRedirect('/komunitas/halamanku');
        $this->assertNull(MemberPage::where('user_id', $user->id)->first());
        $this->actingAs($user)->post($this->base().'/komunitas/halamanku/draft/terbitkan')->assertRedirect('/u/ani_k');

        $page = MemberPage::where('user_id', $user->id)->first();
        $url = $this->base().'/u/ani_k/konten?t='.\App\Services\MemberFrameToken::mint($page->id);

        // Direct / shared URL, missing or wrong fetch destination, expired or foreign tokens are all refused.
        $this->get($this->base().'/u/ani_k/konten', ['Sec-Fetch-Dest' => 'iframe'])->assertForbidden();
        $this->get($url, ['Sec-Fetch-Dest' => 'document'])->assertForbidden();
        $this->get($url)->assertForbidden();
        $this->get($this->base().'/u/ani_k/konten?t='.\App\Services\MemberFrameToken::mint($page->id, time() - 4000), ['Sec-Fetch-Dest' => 'iframe'])->assertForbidden();
        $this->get($this->base().'/u/ani_k/konten?t='.\App\Services\MemberFrameToken::mint($page->id + 1), ['Sec-Fetch-Dest' => 'iframe'])->assertForbidden();
        $forbidden = $this->get($url, ['Sec-Fetch-Dest' => 'document']);
        $this->assertStringContainsString('/u/ani_k', $forbidden->getContent());
        $this->assertStringContainsString('noindex', (string) $forbidden->headers->get('X-Robots-Tag'));

        $r = $this->get($url, ['Sec-Fetch-Dest' => 'iframe']);
        $r->assertOk();
        $this->assertStringContainsString('noindex', (string) $r->headers->get('X-Robots-Tag'));
        $csp = (string) $r->headers->get('Content-Security-Policy');
        $this->assertStringContainsString('sandbox allow-scripts', $csp);
        $this->assertStringNotContainsString('allow-same-origin', $csp);
        $this->assertStringContainsString("connect-src 'none'", $csp);
        $this->assertStringContainsString("form-action 'none'", $csp);
        $this->assertStringContainsString('frame-ancestors '.$this->base(), $csp);
        $this->assertStringContainsString('fullscreen=()', (string) $r->headers->get('Permissions-Policy'));
        $this->assertEmpty($r->headers->getCookies());
        $this->assertStringContainsString('jdFrameHeight', $r->getContent());
    }

    public function test_viewer_renders_trusted_wall_and_nav_outside_a_sandboxed_iframe(): void
    {
        $owner = User::factory()->member()->create(['username' => 'budi_x']);
        $page = MemberPage::create(['user_id' => $owner->id, 'title' => 'B', 'html' => '<html><body><h1>x</h1></body></html>']);
        MemberPageComment::create(['member_page_id' => $page->id, 'user_id' => $owner->id, 'body' => '<b>halo</b>']);

        $html = $this->get($this->base().'/u/budi_x')->assertOk()->getContent();
        $this->assertStringContainsString('class="clay-header"', $html);
        $this->assertStringContainsString('id="komentar"', $html);
        $this->assertMatchesRegularExpression('/<iframe[^>]*sandbox="allow-scripts allow-popups"/', $html);
        $this->assertMatchesRegularExpression('#src="/u/budi_x/konten\?t=\d+\.\d+\.[A-Za-z0-9_-]+"#', $html);
        $this->assertStringNotContainsString('allow-same-origin', $html);
        $this->assertStringNotContainsString('allow-top-navigation', $html);
        $this->assertStringContainsString('&lt;b&gt;halo&lt;/b&gt;', $html);
    }

    public function test_comments_require_login_limit_links_and_owner_cannot_disable_the_wall(): void
    {
        $owner = User::factory()->member()->create(['username' => 'cici_p']);
        $guest = User::factory()->member()->create(['username' => 'dedi_q']);
        $page = MemberPage::create(['user_id' => $owner->id, 'title' => 'C', 'html' => '<html><body><p>x</p></body></html>']);

        $this->post($this->base().'/u/cici_p/komentar', ['body' => 'halo'])->assertRedirect();
        $this->assertSame(0, MemberPageComment::count());

        $this->actingAs($guest)->post($this->base().'/u/cici_p/komentar', ['body' => 'https://a.test https://b.test'])->assertSessionHasErrors('body');
        $this->actingAs($guest)->post($this->base().'/u/cici_p/komentar', ['body' => 'halo cici'])->assertRedirect();
        $c = MemberPageComment::first();
        $this->assertSame('halo cici', $c->body);

        $this->actingAs($owner)->post($this->base().'/u/cici_p/komentar/'.$c->id.'/sembunyikan')->assertRedirect();
        $this->assertTrue($c->fresh()->is_hidden);
        $this->assertFalse(\Illuminate\Support\Facades\Schema::hasColumn('member_pages', 'comments_enabled'));
        $this->get($this->base().'/u/cici_p')->assertOk()->assertSee('id="komentar"', false);
    }

    public function test_reports_auto_hide_page_and_hidden_pages_404_content(): void
    {
        $owner = User::factory()->member()->create(['username' => 'eka_r']);
        $page = MemberPage::create(['user_id' => $owner->id, 'title' => 'E', 'html' => '<html><body><p>x</p></body></html>']);

        foreach (range(1, MemberPage::AUTO_HIDE_REPORTS) as $i) {
            $this->actingAs(User::factory()->member()->create())->post($this->base().'/u/eka_r/lapor');
        }

        $this->assertSame('hidden', $page->fresh()->status);
        $this->get($this->base().'/u/eka_r/konten?t='.\App\Services\MemberFrameToken::mint($page->id), ['Sec-Fetch-Dest' => 'iframe'])->assertNotFound();
        $this->get($this->base().'/u/eka_r')->assertNotFound();
    }

    public function test_komunitas_page_has_builder_and_twenty_styles_script(): void
    {
        $this->get($this->base().'/komunitas/buat')->assertOk()->assertSee('Buat Profilmu dengan AI')->assertSee('pb-style', false);
        $js = file_get_contents(public_path('js/prompt-builder.js'));
        $this->assertSame(20, preg_match_all("/^    \['[^']+', '/m", $js));
    }

    public function test_sanitizer_keeps_allowlisted_cdn_assets_and_drops_others(): void
    {
        $out = (new \App\Services\MemberPageSanitizer)->clean('<html><head><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter">'
            .'<link rel="stylesheet" href="https://evil.example/x.css"><link rel="icon" href="https://fonts.gstatic.com/a.png">'
            .'<style>@import url("https://fonts.googleapis.com/css2?family=Lora");@import url("https://evil.example/a.css");body{color:red}</style>'
            .'<script src="https://cdn.tailwindcss.com"></script><script src="https://evil.example/a.js"></script></head><body class="p-4"><p style="color:blue">hi</p></body></html>');

        $this->assertStringContainsString('fonts.googleapis.com/css2?family=Inter', $out);
        $this->assertStringNotContainsString('evil.example', $out);
        $this->assertStringContainsString('cdn.tailwindcss.com', $out);
        $this->assertStringContainsString('family=Lora', $out);
        $this->assertStringContainsString('color:red', $out);
        $this->assertStringContainsString('color:blue', $out);
    }

    public function test_scroll_behavior_is_not_mangled(): void
    {
        $out = \App\Services\MemberPageSanitizer::clean('<html><head><style>html{scroll-behavior:smooth}body{overscroll-behavior:none;behavior:url(x)}</style></head><body>x</body></html>');

        $this->assertStringContainsString('scroll-behavior:smooth', $out);
        $this->assertStringContainsString('overscroll-behavior:none', $out);
        $this->assertStringNotContainsString('behavior:url', $out);
    }
}

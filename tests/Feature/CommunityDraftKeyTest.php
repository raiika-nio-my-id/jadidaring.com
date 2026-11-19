<?php

namespace Tests\Feature;

use App\Models\MemberDraftKey;
use App\Models\MemberPage;
use App\Models\MemberPageDraft;
use App\Models\User;
use App\Services\MemberFrameToken;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CommunityDraftKeyTest extends TestCase
{
    use RefreshDatabase;

    private function base(): string
    {
        return 'http://'.config('singlepage.base_domain');
    }

    private function mint(User $u): string
    {
        return $this->actingAs($u)->postJson($this->base().'/komunitas/draft-key')->assertOk()->json('key');
    }

    private function send(string $key, string $html, array $h = []): \Illuminate\Testing\TestResponse
    {
        auth()->logout();

        return $this->call('POST', $this->base().'/api/komunitas/draft', [], [], [], $this->transformHeadersToServerVars(['Content-Type' => 'text/html', 'X-Draft-Key' => $key] + $h), $html);
    }

    public function test_key_is_hashed_single_use_and_creates_only_a_sanitized_draft(): void
    {
        $u = User::factory()->member()->create(['username' => 'ani_k']);
        $key = $this->mint($u);

        $this->assertNull(MemberDraftKey::where('key_hash', $key)->first());
        $this->assertNotNull(MemberDraftKey::where('key_hash', hash('sha256', $key))->first());

        $r = $this->send($key, '<html><head><title>Judul A</title><script src="https://evil.test/x.js"></script></head><body onload="x()"><h1>Hai</h1></body></html>');
        $r->assertCreated()->assertJsonPath('status', 'draft');
        $this->assertSame('*', $r->headers->get('Access-Control-Allow-Origin'));
        $this->assertEmpty($r->headers->getCookies());

        $draft = MemberPageDraft::where('user_id', $u->id)->first();
        $this->assertSame('Judul A', $draft->title);
        $this->assertStringNotContainsString('evil.test', $draft->html);
        $this->assertNull(MemberPage::where('user_id', $u->id)->first(), 'a draft must never auto-publish');

        $this->send($key, '<html><body>again</body></html>')->assertUnauthorized();
        $this->assertStringNotContainsString('again', MemberPageDraft::where('user_id', $u->id)->first()->html);
    }

    public function test_expired_unknown_and_failed_posts_do_not_work_or_consume_the_key(): void
    {
        $u = User::factory()->member()->create(['username' => 'budi_x']);
        $key = $this->mint($u);

        $this->send("jdk_nope", '<html><body>x</body></html>')->assertUnauthorized();
        $this->send($key, '<html><body><input type="password"></body></html>')->assertStatus(422);
        $this->assertNull(MemberDraftKey::whereNotNull('used_at')->where('key_hash', hash('sha256', $key))->first());

        MemberDraftKey::query()->update(['expires_at' => now()->subMinute()]);
        $this->send($key, '<html><body>x</body></html>')->assertUnauthorized();
        $this->assertSame(0, MemberPageDraft::count());
    }

    public function test_key_is_bound_to_its_member_and_a_new_key_revokes_the_old(): void
    {
        $a = User::factory()->member()->create(['username' => 'aaa_a']);
        $b = User::factory()->member()->create(['username' => 'bbb_b']);
        $ka = $this->mint($a);
        $kb = $this->mint($b);

        $this->send($kb, '<html><body>for b</body></html>')->assertCreated();
        $this->assertSame(0, MemberPageDraft::where('user_id', $a->id)->count());
        $this->assertSame(1, MemberPageDraft::where('user_id', $b->id)->count());

        $k2 = $this->mint($a);
        $this->send($ka, '<html><body>old</body></html>')->assertUnauthorized();
        $this->send($k2, '<html><body>new</body></html>')->assertCreated();
    }

    public function test_mint_needs_login_and_is_rate_limited_and_options_is_cors_safe(): void
    {
        $this->postJson($this->base().'/komunitas/draft-key')->assertUnauthorized();
        $u = User::factory()->member()->create(['username' => 'cc_cc']);
        for ($i = 0; $i < 5; $i++) {
            $this->actingAs($u)->postJson($this->base().'/komunitas/draft-key')->assertOk();
        }
        $this->actingAs($u)->postJson($this->base().'/komunitas/draft-key')->assertStatus(429);
        $this->call('OPTIONS', $this->base().'/api/komunitas/draft')->assertNoContent()->assertHeader('Access-Control-Allow-Origin', '*');
    }

    public function test_owner_previews_publishes_or_cancels_draft_and_others_cannot_see_it(): void
    {
        $u = User::factory()->member()->create(['username' => 'dd_dd']);
        $o = User::factory()->member()->create(['username' => 'ee_ee']);
        $draft = MemberPageDraft::create(['user_id' => $u->id, 'title' => 'Draf', 'html' => '<html><body><p>isi draf</p></body></html>', 'source' => 'api']);

        $page = $this->actingAs($u)->get($this->base().'/komunitas/halamanku')->assertOk()->assertSee('Draft baru')->assertSee('Terbitkan')->getContent();
        $this->assertMatchesRegularExpression('/<iframe[^>]*sandbox="allow-scripts allow-popups"/', $page);
        $this->actingAs($o)->get($this->base().'/komunitas/halamanku')->assertOk()->assertDontSee('Draft baru');

        $url = $this->base().'/u/dd_dd/konten?d=1&t=';
        $this->get($url.MemberFrameToken::mint($draft->tokenId()), ['Sec-Fetch-Dest' => 'iframe'])->assertOk()->assertSee('isi draf');
        $this->get($url.MemberFrameToken::mint($draft->id), ['Sec-Fetch-Dest' => 'iframe'])->assertForbidden();
        $this->get($url.MemberFrameToken::mint($draft->tokenId()))->assertForbidden();

        $this->actingAs($u)->post($this->base().'/komunitas/halamanku/draft/batal')->assertRedirect();
        $this->assertSame(0, MemberPageDraft::count());
        $this->assertNull(MemberPage::where('user_id', $u->id)->first());

        MemberPageDraft::create(['user_id' => $u->id, 'title' => 'Draf', 'html' => '<html><body>x</body></html>']);
        $this->actingAs($o)->post($this->base().'/komunitas/halamanku/draft/terbitkan')->assertNotFound();
        $this->actingAs($u)->post($this->base().'/komunitas/halamanku/draft/terbitkan')->assertRedirect('/u/dd_dd');
        $this->assertSame('published', MemberPage::where('user_id', $u->id)->value('status'));
        $this->assertSame(0, MemberPageDraft::count());
    }

    public function test_builder_prompt_script_has_cdn_allowlist_and_draft_instructions(): void
    {
        $js = file_get_contents(public_path('js/prompt-builder.js'));
        foreach (['fonts.googleapis.com', 'fonts.gstatic.com', 'cdn.jsdelivr.net', 'cdnjs.cloudflare.com', 'unpkg.com', 'cdn.tailwindcss.com', '?json=', 'PRATINJAU'] as $needle) {
            $this->assertStringContainsString($needle, $js);
        }
        $this->actingAs(User::factory()->member()->create(['username' => 'ff_ff']))->get($this->base().'/komunitas/buat')->assertSee('data-import="https://jadidaring.test/komunitas/halamanku/import"', false);
    }
}

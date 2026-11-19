<?php

namespace Tests\Feature;

use App\Models\User;
use App\Services\SocialAuth;
use App\Support\EmailNormalizer;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\URL;
use Tests\TestCase;

class EmailChangeTest extends TestCase
{
    use RefreshDatabase;

    private const HOST = 'http://jadidaring.test';

    public function test_normalizer_rules(): void
    {
        $this->assertSame('johndoe@gmail.com', EmailNormalizer::normalize(' John.Doe+x1@Gmail.com '));
        $this->assertSame('johndoe@gmail.com', EmailNormalizer::normalize('j.o.h.n.d.o.e@googlemail.com'));
        $this->assertSame('a.b@outlook.com', EmailNormalizer::normalize('A.B+2@outlook.com'));
        $this->assertSame('a@icloud.com', EmailNormalizer::normalize('a+x@icloud.com'));
        $this->assertSame('a@proton.me', EmailNormalizer::normalize('a+x@proton.me'));
        $this->assertSame('a+x@yahoo.com', EmailNormalizer::normalize('a+x@yahoo.com'));
        $this->assertSame('a.b+c@corp.example', EmailNormalizer::normalize('A.B+c@corp.example'));
        $this->assertNull(EmailNormalizer::normalize(''));
    }

    public function test_register_rejects_gmail_twin(): void
    {
        User::factory()->member()->create(['email' => 'john.doe@gmail.com']);
        $this->post(self::HOST.'/daftar', ['username' => 'twin1', 'password' => 'rahasia123', 'password_confirmation' => 'rahasia123', 'email' => 'johndoe+2@googlemail.com'])->assertSessionHasErrors('email');
        $this->assertDatabaseMissing('users', ['username' => 'twin1']);
    }

    public function test_email_change_is_rate_limited(): void
    {
        Notification::fake();
        $u = User::factory()->member()->create(['password' => 'rahasia123']);
        foreach (['a', 'b'] as $i => $n) {
            $this->actingAs($u)->post(self::HOST.'/akun/email', ['email' => $n.'@example.com', 'current_password' => 'rahasia123'])->assertSessionHas('status');
        }
        $this->actingAs($u)->post(self::HOST.'/akun/email', ['email' => 'c@example.com', 'current_password' => 'rahasia123'])->assertStatus(429);
    }

    public function test_change_needs_password_and_stays_pending_until_verified(): void
    {
        $this->withoutMiddleware(\Illuminate\Routing\Middleware\ThrottleRequests::class);
        Notification::fake();
        $u = User::factory()->member()->create(['username' => 'siti', 'email' => 'old@example.com', 'password' => 'rahasia123']);

        $this->actingAs($u)->post(self::HOST.'/akun/email', ['email' => 'new@example.com'])->assertSessionHasErrors('current_password');
        $this->actingAs($u)->post(self::HOST.'/akun/email', ['email' => 'new@example.com', 'current_password' => 'salah'])->assertSessionHasErrors('current_password');
        $this->actingAs($u)->post(self::HOST.'/akun/email', ['email' => 'New@Example.com', 'current_password' => 'rahasia123'])->assertSessionHas('status');

        $u->refresh();
        $this->assertSame('old@example.com', $u->email);
        $this->assertSame('new@example.com', $u->pending_email);
        Notification::assertCount(2);

        $link = URL::temporarySignedRoute('member.email.verify', now()->addMinutes(60), ['user' => $u->id, 'hash' => sha1('new@example.com')]);
        $this->get(self::HOST.'/akun/email/verifikasi/'.$u->id.'/'.sha1('new@example.com'))->assertForbidden();
        $this->get($link)->assertOk()->assertSee('terverifikasi');

        $u->refresh();
        $this->assertSame('new@example.com', $u->email);
        $this->assertSame('new@example.com', $u->email_normalized);
        $this->assertNull($u->pending_email);
        $this->assertNotNull($u->email_verified_at);
    }

    public function test_expired_link_is_rejected(): void
    {
        $u = User::factory()->member()->create(['email' => null, 'pending_email' => 'new@example.com']);
        $link = URL::temporarySignedRoute('member.email.verify', now()->subMinute(), ['user' => $u->id, 'hash' => sha1('new@example.com')]);
        $this->get($link)->assertForbidden();
        $this->assertNull($u->fresh()->email);
    }

    public function test_social_only_account_skips_password_and_first_email_needs_verification(): void
    {
        $this->withoutMiddleware(\Illuminate\Routing\Middleware\ThrottleRequests::class);
        Notification::fake();
        $u = User::factory()->member()->create(['username' => 'gina', 'email' => null, 'provider' => 'github', 'provider_id' => '1']);
        $this->actingAs($u)->post(self::HOST.'/akun/email', ['email' => 'gina@example.com'])->assertSessionHasNoErrors()->assertSessionHas('status');
        $u->refresh();
        $this->assertNull($u->email);
        $this->assertSame('gina@example.com', $u->pending_email);
        Notification::assertCount(1);
    }

    public function test_change_to_a_twin_of_another_users_email_is_blocked(): void
    {
        $this->withoutMiddleware(\Illuminate\Routing\Middleware\ThrottleRequests::class);
        User::factory()->member()->create(['email' => 'a.b@gmail.com']);
        $u = User::factory()->member()->create(['password' => 'rahasia123']);
        $this->actingAs($u)->post(self::HOST.'/akun/email', ['email' => 'ab+1@gmail.com', 'current_password' => 'rahasia123'])->assertSessionHasErrors('email');
        $this->assertNull($u->fresh()->pending_email);
    }

    public function test_report_link_cancels_pending(): void
    {
        $u = User::factory()->member()->create(['email' => 'old@example.com', 'pending_email' => 'evil@example.com']);
        $this->get(URL::temporarySignedRoute('member.email.report', now()->addDay(), ['user' => $u->id]))->assertOk();
        $this->assertNull($u->fresh()->pending_email);
    }

    public function test_social_login_never_links_by_email_and_drops_a_twin_email(): void
    {
        $owner = User::factory()->member()->create(['email' => 'john.doe@gmail.com']);
        $new = SocialAuth::resolveUser('google', 'g-1', 'johndoe+x@gmail.com', 'Johnny');
        $this->assertNotSame($owner->id, $new->id);
        $this->assertNull($new->email);

        $fresh = SocialAuth::resolveUser('google', 'g-2', 'fresh@example.com', 'Fresh');
        $this->assertSame('fresh@example.com', $fresh->email);
        $this->assertSame('fresh@example.com', $fresh->email_normalized);
    }

    public function test_backfill_leaves_later_duplicates_null(): void
    {
        $a = User::factory()->member()->create(['email' => 'a.b@gmail.com']);
        $b = User::factory()->member()->create(['email' => 'x@example.com']);
        \DB::table('users')->update(['email_normalized' => null]);
        \DB::table('users')->where('id', $b->id)->update(['email' => 'ab+2@gmail.com']);

        $migration = require database_path('migrations/2026_11_19_000030_add_email_normalized_to_users.php');
        $c = $migration::backfill();

        $this->assertCount(1, $c);
        $this->assertSame($b->id, $c[0]['duplicate_user_id']);
        $this->assertSame('ab@gmail.com', $a->fresh()->email_normalized);
        $this->assertNull($b->fresh()->email_normalized);
        $b->fresh()->forceFill(['name' => 'zzz'])->save(); // unrelated save must not crash
        $this->assertSame('ab+2@gmail.com', $b->fresh()->email);
    }
}

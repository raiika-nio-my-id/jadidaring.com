<?php

namespace Tests\Feature;

use App\Enums\UserRole;
use App\Models\User;
use App\Services\SocialAuth;
use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Password;
use Tests\TestCase;

class MemberAuthTest extends TestCase
{
    use RefreshDatabase;

    private const HOST = 'http://jadidaring.test';

    public function test_register_with_username_and_password_only(): void
    {
        $this->post(self::HOST.'/daftar', [
            'username' => 'Budi_99',
            'password' => 'rahasia123',
            'password_confirmation' => 'rahasia123',
        ])->assertRedirect(route('member.account'));

        $user = User::query()->where('username', 'budi_99')->firstOrFail();
        $this->assertNull($user->email);
        $this->assertSame(UserRole::Member, $user->role);
        $this->assertAuthenticatedAs($user);
        $this->get(self::HOST.'/akun')->assertOk()->assertSee('budi_99');
    }

    public function test_register_validates_input_and_honeypot(): void
    {
        User::factory()->member()->create(['username' => 'ada', 'email' => 'ada@example.com']);

        $bad = [
            ['username' => 'ab', 'password' => 'rahasia123', 'password_confirmation' => 'rahasia123'],
            ['username' => 'has space', 'password' => 'rahasia123', 'password_confirmation' => 'rahasia123'],
            ['username' => 'ADA', 'password' => 'rahasia123', 'password_confirmation' => 'rahasia123'],
            ['username' => 'okname', 'password' => 'short', 'password_confirmation' => 'short'],
            ['username' => 'okname', 'password' => 'rahasia123', 'password_confirmation' => 'beda12345'],
            ['username' => 'okname', 'password' => 'rahasia123', 'password_confirmation' => 'rahasia123', 'email' => 'ada@example.com'],
            ['username' => 'okname', 'password' => 'rahasia123', 'password_confirmation' => 'rahasia123', 'website' => 'spam'],
        ];

        foreach ($bad as $payload) {
            $this->post(self::HOST.'/daftar', $payload)->assertSessionHasErrors();
            $this->assertGuest();
        }

        $this->assertSame(1, User::query()->count());
    }

    public function test_login_by_username_or_email_and_logout(): void
    {
        $user = User::factory()->member()->create(['username' => 'siti', 'email' => 'siti@example.com', 'password' => 'rahasia123']);

        $this->post(self::HOST.'/masuk', ['login' => 'SITI', 'password' => 'rahasia123'])->assertRedirect(route('member.account'));
        $this->assertAuthenticatedAs($user);

        $this->post(self::HOST.'/keluar')->assertRedirect('/');
        $this->assertGuest();

        $this->post(self::HOST.'/masuk', ['login' => 'siti@example.com', 'password' => 'rahasia123'])->assertRedirect();
        $this->assertAuthenticatedAs($user);
    }

    public function test_wrong_password_fails_and_is_rate_limited(): void
    {
        User::factory()->member()->create(['username' => 'siti', 'password' => 'rahasia123']);

        for ($i = 0; $i < 5; $i++) {
            $this->post(self::HOST.'/masuk', ['login' => 'siti', 'password' => 'salah'])->assertSessionHasErrors('login');
        }

        $this->post(self::HOST.'/masuk', ['login' => 'siti', 'password' => 'rahasia123'])->assertSessionHasErrors('login');
        $this->assertGuest();
    }

    public function test_guests_are_sent_to_member_login_not_admin(): void
    {
        $this->get(self::HOST.'/akun')->assertRedirect(route('member.login'));
    }

    public function test_staff_cannot_use_member_login_and_members_cannot_use_admin_login(): void
    {
        User::factory()->admin()->create(['email' => 'boss@example.com', 'password' => 'rahasia123']);
        User::factory()->member()->create(['username' => 'siti', 'email' => 'siti@example.com', 'password' => 'rahasia123']);

        $this->post(self::HOST.'/masuk', ['login' => 'boss@example.com', 'password' => 'rahasia123'])->assertSessionHasErrors('login');
        $this->assertGuest();

        $this->post('http://admin.jadidaring.test/login', ['email' => 'siti@example.com', 'password' => 'rahasia123'])->assertSessionHasErrors('email');
        $this->assertGuest();

        $this->post('http://admin.jadidaring.test/login', ['email' => 'boss@example.com', 'password' => 'rahasia123'])->assertRedirect();
    }

    public function test_forgot_password_sends_mail_only_to_members_with_email(): void
    {
        Notification::fake();
        $member = User::factory()->member()->create(['email' => 'siti@example.com']);
        $admin = User::factory()->admin()->create(['email' => 'boss@example.com']);

        $this->post(self::HOST.'/lupa-password', ['email' => 'siti@example.com'])->assertSessionHas('status');
        $this->post(self::HOST.'/lupa-password', ['email' => 'boss@example.com'])->assertSessionHas('status');
        $this->post(self::HOST.'/lupa-password', ['email' => 'nobody@example.com'])->assertSessionHas('status');

        Notification::assertSentTo($member, ResetPassword::class, function (ResetPassword $n) use ($member): bool {
            $url = $n->toMail($member)->actionUrl;

            return str_starts_with($url, 'http://jadidaring.test/reset-password/');
        });
        Notification::assertNotSentTo($admin, ResetPassword::class);
        Notification::assertCount(1);
    }

    public function test_reset_password_with_a_valid_token(): void
    {
        $member = User::factory()->member()->create(['username' => 'siti', 'email' => 'siti@example.com', 'password' => 'lamalama1']);
        $token = Password::createToken($member);

        $this->get(self::HOST.'/reset-password/'.$token.'?email=siti@example.com')->assertOk();

        $this->post(self::HOST.'/reset-password', [
            'token' => 'bad', 'email' => 'siti@example.com', 'password' => 'barubaru12', 'password_confirmation' => 'barubaru12',
        ])->assertSessionHasErrors('email');

        $this->post(self::HOST.'/reset-password', [
            'token' => $token, 'email' => 'siti@example.com', 'password' => 'barubaru12', 'password_confirmation' => 'barubaru12',
        ])->assertRedirect(route('member.login'));

        $this->post(self::HOST.'/masuk', ['login' => 'siti', 'password' => 'barubaru12'])->assertSessionHasNoErrors();
        $this->assertAuthenticatedAs($member->fresh());
    }

    public function test_social_providers_are_disabled_without_env_credentials(): void
    {
        config(['services.google.client_id' => null, 'services.github.client_id' => '', 'services.telegram.bot_token' => null]);

        $this->assertSame([], SocialAuth::enabledProviders());
        $this->get(self::HOST.'/masuk')->assertOk()->assertDontSee('/auth/google/redirect', false)->assertDontSee('telegram-widget', false);
        $this->get(self::HOST.'/auth/google/redirect')->assertNotFound();
        $this->get(self::HOST.'/auth/github/callback')->assertNotFound();
        $this->get(self::HOST.'/auth/telegram/callback')->assertNotFound();
    }

    public function test_enabled_providers_show_buttons_and_google_redirects_with_the_callback(): void
    {
        config([
            'services.google.client_id' => 'gid', 'services.google.client_secret' => 'gsecret',
            'services.github.client_id' => 'hid', 'services.github.client_secret' => 'hsecret',
            'services.telegram.bot_username' => 'JadidaringBot', 'services.telegram.bot_token' => '123:abc',
        ]);

        $this->get(self::HOST.'/masuk')
            ->assertOk()
            ->assertSee('/auth/google/redirect', false)
            ->assertSee('/auth/github/redirect', false)
            ->assertSee('data-bot-id="123"', false)->assertDontSee('abc', false)
            ->assertSee('http://jadidaring.test/auth/telegram/callback', false);

        $location = $this->get(self::HOST.'/auth/google/redirect')->assertRedirect()->headers->get('Location');
        $this->assertStringContainsString('accounts.google.com', $location);
        $this->assertStringContainsString(rawurlencode('http://jadidaring.test/auth/google/callback'), $location);
    }

    public function test_telegram_login_verifies_the_signature(): void
    {
        config(['services.telegram.bot_username' => 'JadidaringBot', 'services.telegram.bot_token' => '123:abc']);

        $data = ['id' => 4242, 'first_name' => 'Rani', 'username' => 'rani_tg', 'auth_date' => time()];
        $pairs = [];
        foreach ($data as $k => $v) {
            $pairs[] = $k.'='.$v;
        }
        sort($pairs);
        $data['hash'] = hash_hmac('sha256', implode("\n", $pairs), hash('sha256', '123:abc', true));

        $this->get(self::HOST.'/auth/telegram/callback?'.http_build_query([...$data, 'hash' => 'deadbeef']))->assertRedirect(route('member.login'));
        $this->assertGuest();

        $this->get(self::HOST.'/auth/telegram/callback?'.http_build_query($data))->assertRedirect(route('member.account'));
        $user = User::query()->where('provider', 'telegram')->where('provider_id', '4242')->firstOrFail();
        $this->assertSame('rani_tg', $user->username);
        $this->assertSame(UserRole::Member, $user->role);
        $this->assertAuthenticatedAs($user);

        // A stale payload is rejected.
        $this->assertFalse(SocialAuth::verifyTelegram($data, time() + 200000));
    }

    public function test_social_users_never_link_to_an_existing_email(): void
    {
        $existing = User::factory()->admin()->create(['email' => 'boss@example.com']);

        $user = SocialAuth::resolveUser('github', '77', 'boss@example.com', 'Boss Man');

        $this->assertNotSame($existing->id, $user->id);
        $this->assertNull($user->email);
        $this->assertSame(UserRole::Member, $user->role);
        $this->assertSame($user->id, SocialAuth::resolveUser('github', '77', null, 'x')->id);
    }

    public function test_account_email_is_only_set_after_verification(): void
    {
        \Illuminate\Support\Facades\Notification::fake();
        $user = User::factory()->member()->create(['email' => null, 'provider' => 'github', 'provider_id' => '9']);

        $this->actingAs($user)->post(self::HOST.'/akun/email', ['email' => 'Baru@Example.com'])->assertSessionHas('status');
        $this->assertNull($user->fresh()->email);
        $this->assertSame('baru@example.com', $user->fresh()->pending_email);
    }
}

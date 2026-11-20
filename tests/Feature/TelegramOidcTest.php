<?php

namespace Tests\Feature;

use App\Enums\UserRole;
use App\Models\User;
use App\Services\SocialAuth;
use App\Services\TelegramOidc;
use Firebase\JWT\JWT;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request as HttpRequest;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class TelegramOidcTest extends TestCase
{
    use RefreshDatabase;

    private const HOST = 'http://jadidaring.test';

    private const CLIENT_ID = '7654321';

    private string $privateKey;

    /** @var array<string, mixed> */
    private array $jwks;

    protected function setUp(): void
    {
        parent::setUp();
        Cache::flush();

        $res = openssl_pkey_new(['private_key_bits' => 2048, 'private_key_type' => OPENSSL_KEYTYPE_RSA]);
        openssl_pkey_export($res, $pem);
        $this->privateKey = $pem;
        $d = openssl_pkey_get_details($res);
        $b64 = fn (string $s): string => rtrim(strtr(base64_encode($s), '+/', '-_'), '=');
        $this->jwks = ['keys' => [
            ['kty' => 'OKP', 'alg' => 'EdDSA', 'kid' => 'oidc-eddsa-1', 'crv' => 'Ed25519', 'x' => 'AAAA'],
            ['kty' => 'RSA', 'alg' => 'RS256', 'kid' => 'oidc-1', 'e' => $b64($d['rsa']['e']), 'n' => $b64($d['rsa']['n'])],
        ]];

        config([
            'services.telegram.bot_username' => 'JadidaringBot', 'services.telegram.bot_token' => '123:abc',
            'services.telegram.client_id' => self::CLIENT_ID, 'services.telegram.client_secret' => 'test-secret',
        ]);
    }

    /** @param array<string, mixed> $over */
    private function token(array $over = [], ?string $key = null, string $kid = 'oidc-1'): string
    {
        $claims = array_merge([
            'iss' => 'https://oauth.telegram.org', 'aud' => self::CLIENT_ID, 'sub' => '1234123412341234123',
            'iat' => time(), 'exp' => time() + 3600, 'id' => 4242, 'name' => 'Rani', 'preferred_username' => 'rani_tg',
        ], $over);

        return JWT::encode($claims, $key ?? $this->privateKey, 'RS256', $kid);
    }

    private function fakeTelegram(string $idToken): void
    {
        Http::fake([
            TelegramOidc::JWKS_URL => Http::response($this->jwks),
            TelegramOidc::TOKEN_URL => Http::response(['access_token' => 'x', 'token_type' => 'Bearer', 'expires_in' => 3600, 'id_token' => $idToken]),
        ]);
    }

    /** @return array{state: string, query: array<string, string>} */
    private function start(): array
    {
        $location = (string) $this->get(self::HOST.'/auth/telegram/redirect')->assertRedirect()->headers->get('Location');
        $this->assertStringStartsWith('https://oauth.telegram.org/auth?', $location);
        parse_str((string) parse_url($location, PHP_URL_QUERY), $q);

        return ['state' => (string) $q['state'], 'query' => $q];
    }

    public function test_login_button_uses_the_oidc_redirect_when_configured(): void
    {
        $this->get(self::HOST.'/masuk')->assertOk()
            ->assertSee('/auth/telegram/redirect', false)
            ->assertSee('Membuka Telegram', false)
            ->assertDontSee('telegram-widget', false)
            ->assertDontSee('test-secret', false)->assertDontSee('123:abc', false);
    }

    public function test_classic_widget_stays_when_client_secret_is_missing(): void
    {
        config(['services.telegram.client_secret' => null]);

        $this->assertTrue(SocialAuth::enabled('telegram'));
        $this->get(self::HOST.'/masuk')->assertOk()->assertSee('telegram-widget', false)->assertDontSee('/auth/telegram/redirect', false);
        $this->get(self::HOST.'/auth/telegram/redirect')->assertNotFound();
        $this->get(self::HOST.'/auth/telegram/oidc/callback')->assertNotFound();
    }

    public function test_authorize_url_has_pkce_state_and_registered_redirect(): void
    {
        ['query' => $q] = $this->start();

        $this->assertSame(self::CLIENT_ID, $q['client_id']);
        $this->assertSame('code', $q['response_type']);
        $this->assertSame('openid profile', $q['scope']);
        $this->assertSame('S256', $q['code_challenge_method']);
        $this->assertSame(self::HOST.'/auth/telegram/oidc/callback', $q['redirect_uri']);
        $this->assertSame(40, strlen($q['state']));
        $this->assertNotEmpty($q['nonce']);
        $this->assertArrayNotHasKey('client_secret', $q);
        $verifier = session('tg_oidc.verifier');
        $this->assertSame(rtrim(strtr(base64_encode(hash('sha256', $verifier, true)), '+/', '-_'), '='), $q['code_challenge']);
    }

    public function test_callback_rejects_a_wrong_or_missing_state(): void
    {
        $this->fakeTelegram($this->token());
        $this->start();

        $this->get(self::HOST.'/auth/telegram/oidc/callback?code=abc&state=nope')->assertRedirect(route('member.login'));
        $this->assertGuest();
        // The pending login was consumed; even a replay of the right state now fails.
        $this->get(self::HOST.'/auth/telegram/oidc/callback?code=abc')->assertRedirect(route('member.login'));
        $this->assertGuest();
        Http::assertNotSent(fn (HttpRequest $r): bool => $r->url() === TelegramOidc::TOKEN_URL);
    }

    public function test_full_login_creates_member_and_sends_pkce_verifier_with_basic_auth(): void
    {
        ['state' => $state] = $this->start();
        $verifier = session('tg_oidc.verifier');
        $this->fakeTelegram($this->token(['nonce' => session('tg_oidc.nonce')]));

        $this->get(self::HOST.'/auth/telegram/oidc/callback?code=abc&state='.$state)->assertRedirect(route('member.account'));

        $user = User::query()->where('provider', 'telegram')->where('provider_id', '4242')->firstOrFail();
        $this->assertSame('rani_tg', $user->username);
        $this->assertSame(UserRole::Member, $user->role);
        $this->assertAuthenticatedAs($user);

        Http::assertSent(fn (HttpRequest $r): bool => $r->url() === TelegramOidc::TOKEN_URL
            && $r['code'] === 'abc' && $r['code_verifier'] === $verifier && $r['grant_type'] === 'authorization_code'
            && $r->hasHeader('Authorization', 'Basic '.base64_encode(self::CLIENT_ID.':test-secret')));

        // State is single use.
        auth()->logout();
        $this->get(self::HOST.'/auth/telegram/oidc/callback?code=abc&state='.$state)->assertRedirect(route('member.login'));
        $this->assertGuest();
    }

    public function test_existing_widget_account_is_matched_by_telegram_id_not_sub(): void
    {
        $existing = User::factory()->admin()->create(['provider' => 'telegram', 'provider_id' => '4242', 'username' => 'andika']);
        $before = User::query()->count();

        ['state' => $state] = $this->start();
        $this->fakeTelegram($this->token());

        $this->get(self::HOST.'/auth/telegram/oidc/callback?code=abc&state='.$state)->assertRedirect();
        $this->assertAuthenticatedAs($existing);
        $this->assertSame($before, User::query()->count());
        $this->assertSame(UserRole::Admin, $existing->fresh()->role);
    }

    public function test_id_token_validation_rejects_bad_tokens(): void
    {
        Http::fake([TelegramOidc::JWKS_URL => Http::response($this->jwks)]);

        $this->assertSame('4242', TelegramOidc::validateIdToken($this->token(), null)['id']);

        $other = openssl_pkey_new(['private_key_bits' => 2048, 'private_key_type' => OPENSSL_KEYTYPE_RSA]);
        openssl_pkey_export($other, $otherPem);

        $bad = [
            'forged signature' => $this->token([], $otherPem),
            'wrong issuer' => $this->token(['iss' => 'https://evil.example']),
            'wrong audience' => $this->token(['aud' => '999']),
            'expired' => $this->token(['exp' => time() - 600, 'iat' => time() - 4000]),
            'no telegram id' => $this->token(['id' => null]),
            'nonce mismatch' => $this->token(['nonce' => 'other']),
            'unknown kid' => $this->token([], null, 'nope'),
        ];

        foreach ($bad as $label => $jwt) {
            try {
                TelegramOidc::validateIdToken($jwt, 'expected-nonce');
                $this->fail($label.' was accepted');
            } catch (\RuntimeException $e) {
                $this->assertNotEmpty($e->getMessage(), $label);
            }
        }

        // HS256 with the public key as secret (alg confusion) is rejected too.
        $hs = JWT::encode(['iss' => 'https://oauth.telegram.org', 'aud' => self::CLIENT_ID, 'exp' => time() + 60, 'id' => 1], str_repeat('k', 64), 'HS256', 'oidc-1');
        $this->expectException(\RuntimeException::class);
        TelegramOidc::validateIdToken($hs, null);
    }

    public function test_user_cancel_returns_to_login_with_message(): void
    {
        $this->start();
        $this->get(self::HOST.'/auth/telegram/oidc/callback?error=access_denied')
            ->assertRedirect(route('member.login'))->assertSessionHasErrors('login');
        $this->assertGuest();
    }
}

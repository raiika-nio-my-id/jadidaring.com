<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * A login without "Ingat saya" must last the whole session, not one page.
 * Root cause of the old bug: file-like URLs (/sw.js above all, fetched by the browser on every
 * page) answered with a session Set-Cookie that the proxy cached and replayed to everyone,
 * replacing the fresh login session. Those URLs must never set a cookie.
 */
class SessionPersistenceTest extends TestCase
{
    use RefreshDatabase;

    private const H = 'http://jadidaring.test';

    private function assertNoCookies($res, string $what): void
    {
        $this->assertSame([], $res->headers->getCookies(), $what.' must not set cookies');
    }

    public function test_file_like_urls_never_set_cookies_even_with_a_session(): void
    {
        $member = User::factory()->member()->create();
        $this->actingAs($member);

        foreach (['/sw.js', '/sw.js?v=2', '/site.webmanifest', '/robots.txt', '/sitemap.xml', '/a/css/jd-vt.css', '/tidak-ada.css', '/tidak-ada.webp'] as $uri) {
            $this->assertNoCookies($this->withCookie(config('session.cookie'), 'x')->get(self::H.$uri), $uri);
        }
        $this->assertNoCookies($this->get(self::H.'/sw.js'), '/sw.js (anonymous)');

        // Normal pages still get their session/CSRF cookies.
        $this->assertNotSame([], $this->get(self::H.'/masuk')->headers->getCookies());
    }

    public function test_member_login_without_remember_survives_page_changes(): void
    {
        User::factory()->member()->create(['username' => 'sesi', 'password' => 'rahasia123']);

        $res = $this->post(self::H.'/masuk', ['login' => 'sesi', 'password' => 'rahasia123']);
        $res->assertRedirect(route('member.account'));
        $this->assertFalse(collect($res->headers->getCookies())->contains(fn ($c) => str_starts_with($c->getName(), 'remember_web_')), 'no remember cookie without Ingat saya');

        $this->get(self::H.'/akun')->assertOk();
        $this->get(self::H.'/sw.js')->assertOk();
        $this->get(self::H.'/berita')->assertOk();
        $this->get(self::H.'/akun')->assertOk();
        $this->assertAuthenticated();
    }

    public function test_admin_login_without_remember_survives_page_changes(): void
    {
        User::factory()->admin()->create(['email' => 'boss@example.test', 'password' => 'rahasia-panjang']);

        $res = $this->post(self::H.'/admin/masuk', ['email' => 'boss@example.test', 'password' => 'rahasia-panjang']);
        $res->assertRedirectContains('/admin');
        $this->assertFalse(collect($res->headers->getCookies())->contains(fn ($c) => str_starts_with($c->getName(), 'remember_web_')));

        $this->get(self::H.'/admin')->assertOk();
        $this->get(self::H.'/sw.js')->assertOk();
        $this->get(self::H.'/admin/user')->assertOk();
        $this->get(self::H.'/admin')->assertOk();
        $this->assertAuthenticated();
    }

    public function test_session_cookie_lasts_the_configured_lifetime(): void
    {
        $res = $this->get(self::H.'/admin/masuk')->assertOk();
        $cookie = collect($res->headers->getCookies())->first(fn ($c) => $c->getName() === config('session.cookie'));
        $this->assertNotNull($cookie);
        $this->assertTrue($cookie->isHttpOnly());
        $this->assertEqualsWithDelta(time() + 60 * (int) config('session.lifetime'), $cookie->getExpiresTime(), 5);
    }
}

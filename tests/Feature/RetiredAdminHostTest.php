<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/** Production setting: the old admin host is retired (404 everywhere); the panel and API live on the main host. */
class RetiredAdminHostTest extends TestCase
{
    use RefreshDatabase;

    private const ADMIN = 'http://admin.jadidaring.test';

    private const SITE = 'http://jadidaring.test';

    public function createApplication(): Application
    {
        $this->setLegacyFlag('false');

        return parent::createApplication();
    }

    protected function tearDown(): void
    {
        parent::tearDown();
        $this->setLegacyFlag('true');
    }

    private function setLegacyFlag(string $value): void
    {
        putenv('LEGACY_ADMIN_HOST='.$value);
        $_ENV['LEGACY_ADMIN_HOST'] = $value;
        $_SERVER['LEGACY_ADMIN_HOST'] = $value;
    }

    /** @return array<string, string> */
    private function key(): array
    {
        return ['X-Admin-Api-Key' => 'testing-admin-api-secret'];
    }

    public function test_every_old_admin_host_path_is_404_without_a_session_cookie(): void
    {
        $this->assertFalse((bool) config('singlepage.legacy_admin_host'));

        foreach (['/', '/login', '/masuk', '/dashboard', '/admin'] as $path) {
            $res = $this->get(self::ADMIN.$path);
            $res->assertNotFound();
            $this->assertEmpty($res->headers->getCookies(), "no cookies on $path");
        }

        $this->post(self::ADMIN.'/login', ['email' => 'a@b.c', 'password' => 'x'])->assertNotFound();
        $this->getJson(self::ADMIN.'/api/admin/news/articles')->assertNotFound();
        $this->getJson(self::ADMIN.'/api/admin/news/articles', $this->key())->assertNotFound();
        $this->postJson(self::ADMIN.'/api/admin/news/articles', [], $this->key())->assertNotFound();
    }

    public function test_main_host_panel_and_api_keep_working(): void
    {
        $this->get(self::SITE.'/admin')->assertRedirect(self::SITE.'/admin/masuk');
        $this->get(self::SITE.'/admin/masuk')->assertOk();

        $this->getJson(self::SITE.'/api/admin/news/articles')->assertUnauthorized();
        $this->getJson(self::SITE.'/api/admin/news/articles', $this->key())->assertOk();
        $this->getJson(self::SITE.'/api/admin/news/topics', $this->key())->assertOk();
    }

    public function test_admin_user_on_old_host_still_gets_404(): void
    {
        $admin = User::factory()->create(['role' => \App\Enums\UserRole::Admin]);
        $this->actingAs($admin)->get(self::ADMIN.'/')->assertNotFound();
        $this->actingAs($admin)->get(self::SITE.'/admin')->assertOk();
    }
}

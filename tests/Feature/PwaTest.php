<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PwaTest extends TestCase
{
    use RefreshDatabase;

    public function test_manifest_is_installable_and_served_as_manifest_json(): void
    {
        $res = $this->get('http://jadidaring.test/site.webmanifest')->assertOk();
        $this->assertStringStartsWith('application/manifest+json', $res->headers->get('Content-Type'));

        $m = $res->json();
        $this->assertSame('standalone', $m['display']);
        $this->assertSame('/', $m['start_url']);
        $this->assertSame('/', $m['scope']);
        $this->assertSame('/', $m['id']);
        $this->assertSame('#F7F2EC', $m['theme_color']);
        $sizes = collect($m['icons'])->pluck('sizes')->all();
        $this->assertContains('192x192', $sizes);
        $this->assertContains('512x512', $sizes);
        $this->assertTrue(collect($m['icons'])->every(fn ($i) => str_contains($i['purpose'], 'maskable')));
    }

    public function test_service_worker_headers_and_never_caches_content(): void
    {
        $res = $this->get('http://jadidaring.test/sw.js')->assertOk();
        $this->assertStringStartsWith('application/javascript', $res->headers->get('Content-Type'));
        $this->assertSame('/', $res->headers->get('Service-Worker-Allowed'));
        $this->assertStringContainsString('no-cache', $res->headers->get('Cache-Control'));

        $js = (string) file_get_contents(resource_path('pwa/sw.js'));
        $this->assertStringContainsString("const VERSION = 'v1'", $js);
        $this->assertStringContainsString('caches.delete', $js);
        $this->assertStringContainsString('/offline.html', $js);
        $this->assertStringNotContainsString('cache.put', $js);
        $this->assertStringNotContainsString('.put(', $js);
        foreach (['api', 'admin', 'auth', 'game', 'rt'] as $skip) {
            $this->assertMatchesRegularExpression('#SKIP = /.*\b'.$skip.'\b#', $js);
        }
    }

    public function test_offline_page_exists_in_indonesian(): void
    {
        $html = (string) file_get_contents(public_path('offline.html'));
        $this->assertStringContainsString('Kamu sedang offline', $html);
        $this->assertFileExists(public_path('marketing/images/logo-mark-light.svg'));
    }

    public function test_public_pages_register_the_worker_but_admin_does_not(): void
    {
        $this->get('http://jadidaring.test/')->assertSee("register('/sw.js'", false);
        $this->get('http://jadidaring.test/berita')->assertSee("register('/sw.js'", false);
        $this->get('http://admin.jadidaring.test/login')->assertDontSee('serviceWorker', false);
    }
}

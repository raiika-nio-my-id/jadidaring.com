<?php

namespace Tests\Feature;

use Tests\TestCase;

class StaticAssetTest extends TestCase
{
    public function test_assets_are_served_with_immutable_cache_and_no_session(): void
    {
        $r = $this->get('http://'.config('singlepage.base_domain').'/a/fonts/nunito-latin.woff2');
        $r->assertOk();
        $this->assertStringContainsString('immutable', (string) $r->headers->get('Cache-Control'));
        $this->assertEmpty($r->headers->getCookies());
    }

    public function test_non_whitelisted_paths_are_404(): void
    {
        $base = 'http://'.config('singlepage.base_domain');
        $this->get($base.'/a/index.php')->assertNotFound();
        $this->get($base.'/a/js/../../.env')->assertNotFound();
        $this->get($base.'/a/robots.txt')->assertNotFound();
    }
}

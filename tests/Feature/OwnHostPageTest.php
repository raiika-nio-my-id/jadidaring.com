<?php

namespace Tests\Feature;

use App\Models\CompanyProfile;
use App\Services\TenantPath;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/** Custom Pages on their own host ({label}.{base}/), e.g. andika.jadidaring.com. */
class OwnHostPageTest extends TestCase
{
    use RefreshDatabase;

    private function base(): string
    {
        return strtolower((string) config('singlepage.base_domain'));
    }

    private function page(array $extra = []): CompanyProfile
    {
        return CompanyProfile::factory()->published()->create($extra + [
            'user_id' => null, 'subdomain' => 'andika', 'name' => 'Andika', 'is_game' => false, 'hide_footer' => true,
            'html' => '<!doctype html><html><head><title>Andika</title></head><body><h1>Halo Andika</h1></body></html>',
        ]);
    }

    public function test_own_host_serves_the_page_at_root_without_cookies(): void
    {
        $this->page();
        $r = $this->get('http://andika.'.$this->base().'/');
        $r->assertOk()->assertSee('Halo Andika', false)->assertSee('rel="canonical" href="'.TenantPath::ownHostUrl('andika').'"', false);
        $this->assertSame([], $r->headers->getCookies());
        $this->assertStringNotContainsString('syarat-ketentuan', (string) $r->getContent()); // footer hidden

        $this->get('http://andika.'.$this->base().'/robots.txt')->assertOk()->assertSee('sitemap.xml');
        $this->get('http://andika.'.$this->base().'/sitemap.xml')->assertOk()->assertSee(TenantPath::ownHostUrl('andika'), false);
        $this->get('http://andika.'.$this->base().'/apa-saja')->assertNotFound();
    }

    public function test_path_url_redirects_to_the_own_host_and_admin_links_use_it(): void
    {
        $this->page();
        $this->get('http://'.$this->base().'/andika?ref=x')->assertStatus(301)->assertRedirect(TenantPath::ownHostUrl('andika').'?ref=x');
        $this->get('http://'.$this->base().'/andika/')->assertStatus(301);
        $this->assertSame(rtrim((string) TenantPath::ownHostUrl('andika'), '/'), TenantPath::publicUrl('andika'));
        $this->assertSame('andika.'.$this->base(), TenantPath::label('andika'));
        $this->assertSame('http://'.$this->base().'/lainnya', TenantPath::publicUrl('lainnya'));
    }

    public function test_draft_game_or_unconfigured_pages_are_not_served(): void
    {
        $p = $this->page(['status' => 'draft']);
        $this->get('http://andika.'.$this->base().'/')->assertNotFound();
        $p->update(['status' => 'published', 'is_game' => true]);
        $this->get('http://andika.'.$this->base().'/')->assertNotFound();

        CompanyProfile::factory()->published()->create(['user_id' => null, 'subdomain' => 'budi', 'is_game' => false, 'html' => '<p>budi</p>']);
        $this->get('http://budi.'.$this->base().'/')->assertNotFound();
    }

    public function test_import_command_creates_once_and_keeps_admin_edits_unless_forced(): void
    {
        $this->artisan('pages:import-custom', ['slug' => 'andika', 'file' => 'resources/pages/andika.html', '--name' => 'Andika Pradipta Suardi'])->assertSuccessful();
        $page = CompanyProfile::query()->where('subdomain', 'andika')->firstOrFail();
        $this->assertTrue($page->hide_footer);
        $this->assertFalse($page->is_game);
        $this->assertStringContainsString('Andika Pradipta Suardi', (string) $page->html);

        $page->update(['html' => '<p>diedit admin</p>']);
        $this->artisan('pages:import-custom', ['slug' => 'andika', 'file' => 'resources/pages/andika.html'])->assertSuccessful();
        $this->assertSame('<p>diedit admin</p>', $page->refresh()->html);

        $this->artisan('pages:import-custom', ['slug' => 'andika', 'file' => 'resources/pages/andika.html', '--force' => true])->assertSuccessful();
        $this->assertStringContainsString('Andika Pradipta Suardi', (string) $page->refresh()->html);

        $this->artisan('pages:import-custom', ['slug' => 'andika', 'file' => '.env'])->assertFailed();

        $this->get('http://andika.'.$this->base().'/')->assertOk()->assertSee('Technical Project Manager', false);
    }
}

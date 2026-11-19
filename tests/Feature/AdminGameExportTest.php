<?php

namespace Tests\Feature;

use App\Models\CompanyProfile;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AdminGameExportTest extends TestCase
{
    use RefreshDatabase;

    private const URL = 'http://admin.jadidaring.test/api/admin/games/';

    public function test_export_needs_the_admin_api_key(): void
    {
        CompanyProfile::factory()->game()->published()->create(['subdomain' => 'nadapiano', 'html' => '<html>x</html>']);

        $this->getJson(self::URL.'nadapiano/html')->assertUnauthorized();
        $this->getJson(self::URL.'nadapiano/html', ['X-Admin-Api-Key' => 'wrong'])->assertUnauthorized();
    }

    public function test_export_returns_the_scrubbed_html_and_its_hash(): void
    {
        $html = '<html><body>Nada <a href="#gmjd1212">gm</a> GamemasterJD</body></html>';
        CompanyProfile::factory()->game()->published()->create(['subdomain' => 'nadapiano', 'html' => $html]);
        $clean = '<html><body>Nada <a href="#gamemaster">gm</a> gamemaster</body></html>';

        $this->getJson(self::URL.'NadaPiano/html', $this->headers())
            ->assertOk()
            ->assertExactJson([
                'subdomain' => 'nadapiano',
                'status' => 'published',
                'bytes' => strlen($clean),
                'sha256' => hash('sha256', $clean),
                'html' => $clean,
            ]);
    }

    public function test_only_games_are_exported(): void
    {
        CompanyProfile::factory()->published()->create(['subdomain' => 'tokobaju', 'html' => '<html>client</html>']);

        $this->getJson(self::URL.'tokobaju/html', $this->headers())->assertNotFound();
        $this->getJson(self::URL.'nothing/html', $this->headers())->assertNotFound();
    }

    public function test_export_is_read_only(): void
    {
        CompanyProfile::factory()->game()->published()->create(['subdomain' => 'nadapiano', 'html' => '<html>x</html>']);

        $this->postJson(self::URL.'nadapiano/html', [], $this->headers())->assertStatus(405);
        $this->assertSame('<html>x</html>', CompanyProfile::query()->where('subdomain', 'nadapiano')->value('html'));
    }

    /** @return array<string, string> */
    private function headers(): array
    {
        return ['X-Admin-Api-Key' => 'testing-admin-api-secret'];
    }
}

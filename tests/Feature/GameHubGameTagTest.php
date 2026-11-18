<?php

namespace Tests\Feature;

use App\Models\CompanyProfile;
use App\Models\User;
use App\Services\GameHubGameBackfill;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class GameHubGameTagTest extends TestCase
{
    use RefreshDatabase;

    public function test_backfill_tags_known_game_slugs_and_leaves_sites_untagged(): void
    {
        $this->assertContains('cukurkekinian', GameHubGameBackfill::SUBDOMAINS);
        $this->assertContains('mudikmacet', GameHubGameBackfill::SUBDOMAINS);
        $this->assertContains('pawanghujan', GameHubGameBackfill::SUBDOMAINS);
        $this->assertContains('poconglari', GameHubGameBackfill::SUBDOMAINS);
        $this->assertContains('hantukampung', GameHubGameBackfill::SUBDOMAINS);
        $this->assertContains('rumahkontrakan', GameHubGameBackfill::SUBDOMAINS);
        $this->assertNotContains('cukur-kekinian', GameHubGameBackfill::SUBDOMAINS);
        $this->assertNotContains('mudik-macet', GameHubGameBackfill::SUBDOMAINS);
        $this->assertNotContains('pawang-hujan', GameHubGameBackfill::SUBDOMAINS);
        $this->assertNotContains('showcase', GameHubGameBackfill::SUBDOMAINS);
        $this->assertNotContains('gamehub', GameHubGameBackfill::SUBDOMAINS);
        $this->assertNotContains('demo', GameHubGameBackfill::SUBDOMAINS);
        $this->assertNotContains('demo1', GameHubGameBackfill::SUBDOMAINS);
        $this->assertSame(
            GameHubGameBackfill::SUBDOMAINS,
            array_values(array_unique(GameHubGameBackfill::SUBDOMAINS)),
        );

        foreach (GameHubGameBackfill::SUBDOMAINS as $subdomain) {
            CompanyProfile::factory()->create([
                'subdomain' => $subdomain,
                'is_game' => false,
            ]);
        }

        foreach (['gamehub', 'showcase', 'demo', 'demo1', 'demo12', 'cukur-kekinian', 'mudik-macet', 'pawang-hujan'] as $subdomain) {
            CompanyProfile::factory()->create([
                'subdomain' => $subdomain,
                'is_game' => null,
            ]);
        }

        GameHubGameBackfill::apply();

        foreach (GameHubGameBackfill::SUBDOMAINS as $subdomain) {
            $this->assertTrue(
                CompanyProfile::query()->where('subdomain', $subdomain)->firstOrFail()->is_game,
                $subdomain,
            );
        }

        foreach (['gamehub', 'showcase', 'demo', 'demo1', 'demo12', 'cukur-kekinian', 'mudik-macet', 'pawang-hujan'] as $subdomain) {
            $this->assertFalse(
                CompanyProfile::query()->where('subdomain', $subdomain)->firstOrFail()->is_game,
                $subdomain,
            );
        }
    }

    private function hub(string $html): CompanyProfile
    {
        return CompanyProfile::factory()->published()->create([
            'subdomain' => 'gamehub',
            'html' => $html,
        ]);
    }

    private function page(string $title, string $description): string
    {
        return '<!doctype html><html><head><title>'.e($title).'</title>'
            .'<meta name="description" content="'.e($description).'">'
            .'</head><body></body></html>';
    }

    private function save(User $admin, CompanyProfile $profile, bool $isGame): void
    {
        $payload = [
            'subdomain' => $profile->subdomain,
            'name' => $profile->user->name,
            'email' => $profile->user->email,
            'html' => $profile->html,
            'status' => 'published',
            'expires_at' => $profile->expires_at?->toDateString() ?? now()->addYear()->toDateString(),
        ];

        if ($isGame) {
            $payload['is_game'] = '1';
        }

        $this->actingAs($admin)
            ->from('http://admin.jadidaring.test/clients/'.$profile->id.'/edit')
            ->put('http://admin.jadidaring.test/clients/'.$profile->id, $payload)
            ->assertRedirect();
    }
}

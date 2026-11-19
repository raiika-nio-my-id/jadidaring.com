<?php

namespace Tests\Feature;

use App\Models\Article;
use App\Models\CompanyProfile;
use App\Services\NewsCache;
use App\Services\PopularStats;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class PopularStatsTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Cache::flush();
        Http::preventStrayRequests();
        config(['services.google_stats.property_id' => null, 'services.google_stats.sa_json_b64' => null, 'services.google_stats.sa_json_path' => null]);
    }

    private function configureGoogle(): void
    {
        $key = openssl_pkey_new(['private_key_bits' => 2048, 'private_key_type' => OPENSSL_KEYTYPE_RSA]);
        openssl_pkey_export($key, $pem);
        config([
            'services.google_stats.property_id' => '512345678',
            'services.google_stats.sa_json_b64' => base64_encode((string) json_encode([
                'type' => 'service_account', 'client_email' => 'x@test.iam.gserviceaccount.com', 'private_key' => $pem,
            ])),
        ]);
    }

    private function row(string $host, string $path, int $views): array
    {
        return ['dimensionValues' => [['value' => $host], ['value' => $path]], 'metricValues' => [['value' => (string) $views]]];
    }

    private function game(string $sub, string $when = 'now'): CompanyProfile
    {
        return CompanyProfile::factory()->game()->published()->create(['subdomain' => $sub, 'created_at' => $when]);
    }

    private function article(string $slug, string $topic = 'politik'): Article
    {
        return Article::query()->create(['topic' => $topic, 'slug' => $slug, 'title' => 'T '.$slug, 'summary' => 's', 'body' => 'b', 'sources' => [], 'status' => 'published', 'published_at' => now()->subHour()]);
    }

    public function test_aggregates_game_paths_legacy_paths_and_subdomains(): void
    {
        $out = PopularStats::aggregateGames([
            ['host' => 'jadidaring.com', 'path' => '/game/alpha', 'views' => 5],
            ['host' => 'jadidaring.com', 'path' => '/game/alpha/?x=1', 'views' => 2],
            ['host' => 'jadidaring.com', 'path' => '/beta/', 'views' => 3],
            ['host' => 'gamma.'.\App\Services\GameHub::baseDomain(), 'path' => '/', 'views' => 4],
            ['host' => 'jadidaring.com', 'path' => '/berita/politik/abc', 'views' => 99],
            ['host' => 'jadidaring.com', 'path' => '/', 'views' => 99],
        ]);

        $this->assertSame(['alpha' => 7, 'gamma' => 4, 'beta' => 3], $out);
    }

    public function test_aggregates_news_by_article_slug(): void
    {
        $out = PopularStats::aggregateNews([
            ['host' => 'jadidaring.com', 'path' => '/berita/politik/kabar-1', 'views' => 3],
            ['host' => 'jadidaring.com', 'path' => '/berita/politik/kabar-1?utm=x', 'views' => 2],
            ['host' => 'jadidaring.com', 'path' => '/berita/politik', 'views' => 50],
            ['host' => 'jadidaring.com', 'path' => '/game/alpha', 'views' => 50],
        ]);

        $this->assertSame(['kabar-1' => 5], $out);
    }

    public function test_command_fetches_ga_and_games_rank_by_views_without_labels(): void
    {
        $this->configureGoogle();
        $this->game('alpha', '2026-01-01');
        $this->game('beta', '2026-01-02');
        $this->game('gamma', '2026-01-03');

        Http::fake([
            'oauth2.googleapis.com/token' => Http::response(['access_token' => 't', 'expires_in' => 3599]),
            'analyticsdata.googleapis.com/*' => function (Request $r) {
                $start = $r->data()['dateRanges'][0]['startDate'];

                return Http::response(['rows' => $start === '29daysAgo'
                    ? [$this->row('jadidaring.com', '/game/alpha', 50), $this->row('jadidaring.com', '/game/beta', 10)]
                    : [$this->row('jadidaring.com', '/berita/politik/n1', 8)]]);
            },
        ]);

        $this->artisan('stats:refresh-popular')->assertSuccessful();

        $html = $this->get('http://jadidaring.test/game?sort=views')->assertOk()->getContent();
        $this->assertLessThan(strpos($html, '/game/beta'), strpos($html, '/game/alpha'));
        $this->assertLessThan(strpos($html, '/game/gamma'), strpos($html, '/game/beta'));
        $this->assertStringNotContainsString('tayang', $html);
    }

    public function test_game_cards_never_show_view_counts(): void
    {
        $this->game('alpha');
        Cache::put('popular:games', ['views' => ['alpha' => 1234], 'fetchedAt' => now()->toIso8601String()], 3600);

        $this->assertStringNotContainsString('1.234', $this->get('http://jadidaring.test/game')->getContent());
        $this->assertStringNotContainsString('1,234', $this->get('http://jadidaring.test/game')->getContent());
        $this->assertStringNotContainsString('1,234', $this->get('http://jadidaring.test/')->getContent());
    }

    public function test_falls_back_to_newest_first_without_ga_and_makes_no_http_calls(): void
    {
        $this->game('old', '2026-01-01');
        $this->game('new', '2026-03-01');

        $html = $this->get('http://jadidaring.test/game?sort=views')->assertOk()->getContent();
        $this->assertLessThan(strpos($html, '/game/old'), strpos($html, '/game/new'));
        $this->artisan('stats:refresh-popular')->assertSuccessful();
        Http::assertNothingSent();
    }

    public function test_ga_error_keeps_previous_data_and_fails_gracefully(): void
    {
        $this->configureGoogle();
        Cache::put('popular:games', ['views' => ['alpha' => 5], 'fetchedAt' => 'x'], 3600);
        Http::fake([
            'oauth2.googleapis.com/token' => Http::response(['access_token' => 't', 'expires_in' => 3599]),
            'analyticsdata.googleapis.com/*' => Http::response(['error' => ['message' => 'nope']], 403),
        ]);

        $this->artisan('stats:refresh-popular')->assertFailed();
        $this->assertSame(['alpha' => 5], PopularStats::gameViews());
    }

    public function test_news_popular_tab_ranks_by_ga_7d_and_falls_back(): void
    {
        $this->article('satu');
        $this->article('dua');
        NewsCache::bump();

        $fallback = $this->get('http://jadidaring.test/berita?urut=populer')->assertOk()->getContent();
        $this->assertStringContainsString('/berita/politik/satu', $fallback);

        Cache::put('popular:news', ['views' => ['dua' => 9, 'satu' => 1], 'fetchedAt' => now()->toIso8601String()], 3600);
        NewsCache::bump();
        $html = $this->get('http://jadidaring.test/berita?urut=populer')->assertOk()->getContent();
        $this->assertLessThan(strpos($html, '/berita/politik/satu'), strpos($html, '/berita/politik/dua'));
        $this->assertStringContainsString('noindex', $html);
    }

    public function test_refresh_is_scheduled(): void
    {
        $events = collect(app(\Illuminate\Console\Scheduling\Schedule::class)->events())
            ->filter(fn ($e) => str_contains((string) $e->command, 'stats:refresh-popular'));
        $this->assertCount(1, $events);
        $this->assertSame('0 */3 * * *', $events->first()->expression);
    }
}

<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Tests\TestCase;

class StatistikPageTest extends TestCase
{
    use RefreshDatabase;

    private const URL = 'http://admin.jadidaring.test/statistik';

    protected function setUp(): void
    {
        parent::setUp();
        Http::preventStrayRequests();
        config([
            'services.google_stats.property_id' => null,
            'services.google_stats.site_url' => 'sc-domain:jadidaring.com',
            'services.google_stats.sa_json_b64' => null,
            'services.google_stats.sa_json_path' => null,
        ]);
    }

    private function configure(): void
    {
        $key = openssl_pkey_new(['private_key_bits' => 2048, 'private_key_type' => OPENSSL_KEYTYPE_RSA]);
        openssl_pkey_export($key, $pem);
        config([
            'services.google_stats.property_id' => '512345678',
            'services.google_stats.sa_json_b64' => base64_encode((string) json_encode([
                'type' => 'service_account',
                'client_email' => 'jadidaring-stats@test-project.iam.gserviceaccount.com',
                'private_key' => $pem,
            ])),
        ]);
    }

    /** @return array<string, mixed> */
    private function ga4Response(): array
    {
        return ['reports' => [
            [
                'rows' => [
                    ['dimensionValues' => [['value' => now('Asia/Makassar')->format('Ymd')]], 'metricValues' => [['value' => '120'], ['value' => '45'], ['value' => '30']]],
                ],
                'totals' => [['metricValues' => [['value' => '4321'], ['value' => '987'], ['value' => '654']]]],
            ],
            ['rows' => [['dimensionValues' => [['value' => '/berita/jadwal-baru-79-kereta']], 'metricValues' => [['value' => '777']]]]],
        ]];
    }

    private function fakeGoogle(): void
    {
        Http::fake([
            'oauth2.googleapis.com/token' => Http::response(['access_token' => 'ya29.test-token', 'expires_in' => 3599]),
            'analyticsdata.googleapis.com/*' => Http::response($this->ga4Response()),
            'www.googleapis.com/webmasters/*' => function (Request $request) {
                $dims = $request->data()['dimensions'] ?? [];

                return Http::response(match ($dims[0] ?? null) {
                    null => ['rows' => [['clicks' => 210, 'impressions' => 9876, 'ctr' => 0.0213, 'position' => 14.25]]],
                    'date' => ['rows' => [['keys' => [now('Asia/Makassar')->subDays(3)->toDateString()], 'clicks' => 12, 'impressions' => 400]]],
                    'query' => ['rows' => [['keys' => ['jadwal kereta baru'], 'clicks' => 33, 'impressions' => 500, 'ctr' => 0.066, 'position' => 3.4]]],
                    'page' => ['rows' => [['keys' => ['https://jadidaring.com/berita/gsc-page'], 'clicks' => 21, 'impressions' => 300, 'ctr' => 0.07, 'position' => 5.1]]],
                });
            },
        ]);
    }

    public function test_guest_is_redirected_to_login(): void
    {
        $this->get(self::URL)->assertRedirect('http://admin.jadidaring.test/login');
        $this->post(self::URL.'/refresh')->assertRedirect('http://admin.jadidaring.test/login');
    }

    public function test_client_cannot_open_statistik(): void
    {
        $this->actingAs(User::factory()->client()->create())->get(self::URL)->assertForbidden();
        $this->actingAs(User::factory()->client()->create())->post(self::URL.'/refresh')->assertForbidden();
    }

    public function test_setup_pending_lists_missing_items_without_calling_google(): void
    {
        $this->actingAs(User::factory()->admin()->create())
            ->get(self::URL)
            ->assertOk()
            ->assertSee('Setup belum selesai')
            ->assertSee('GOOGLE_STATS_SA_JSON_B64')
            ->assertSee('GA4_PROPERTY_ID')
            ->assertSee('Search Console tertunda 2–3 hari')
            ->assertDontSee('data-state="error"', false)
            ->assertDontSee('Page views');

        Http::assertNothingSent();
    }

    public function test_admin_nav_links_to_statistik(): void
    {
        $this->actingAs(User::factory()->admin()->create())
            ->get(self::URL)
            ->assertSee('href="'.route('admin.statistik').'"', false);
    }

    public function test_property_id_given_as_measurement_id_is_flagged(): void
    {
        $this->configure();
        config(['services.google_stats.property_id' => 'G-YM4HWBFCJ4']);
        $this->fakeGoogle();

        $this->actingAs(User::factory()->admin()->create())
            ->get(self::URL)
            ->assertOk()
            ->assertSee('GA4 property ID harus berupa angka')
            ->assertDontSee('G-YM4HWBFCJ4')
            ->assertSee('Klik'); // Search Console still works
    }

    public function test_invalid_key_is_reported_as_pending_not_error(): void
    {
        config(['services.google_stats.property_id' => '512345678', 'services.google_stats.sa_json_b64' => base64_encode('not json')]);

        $this->actingAs(User::factory()->admin()->create())
            ->get(self::URL)
            ->assertOk()
            ->assertSee('Setup belum selesai')
            ->assertSee('Kunci service account tidak bisa dibaca');
        Http::assertNothingSent();
    }

    public function test_renders_ga4_and_search_console_data(): void
    {
        $this->configure();
        $this->fakeGoogle();

        $this->actingAs(User::factory()->admin()->create())
            ->get(self::URL.'?days=7')
            ->assertOk()
            ->assertDontSee('Setup belum selesai')
            ->assertSee('4,321')
            ->assertSee('987')
            ->assertSee('654')
            ->assertSee('/berita/jadwal-baru-79-kereta')
            ->assertSee('9,876')
            ->assertSee('2,1%')
            ->assertSee('14,3')
            ->assertSee('jadwal kereta baru')
            ->assertSee('https://jadidaring.com/berita/gsc-page')
            ->assertDontSee('ya29.test-token');

        Http::assertSent(function (Request $r): bool {
            if (! str_contains($r->url(), 'oauth2.googleapis.com/token')) {
                return false;
            }
            [$header, $claims] = array_map(fn ($p) => json_decode(base64_decode(strtr($p, '-_', '+/')), true), array_slice(explode('.', $r->data()['assertion']), 0, 2));

            return $header['alg'] === 'RS256'
                && str_contains($claims['scope'], 'analytics.readonly')
                && str_contains($claims['scope'], 'webmasters.readonly')
                && $claims['iss'] === 'jadidaring-stats@test-project.iam.gserviceaccount.com';
        });
        Http::assertSent(fn (Request $r): bool => str_contains($r->url(), 'properties/512345678:batchRunReports')
            && $r->data()['requests'][0]['dateRanges'][0]['startDate'] === '6daysAgo'
            && $r->hasHeader('Authorization', 'Bearer ya29.test-token'));
        Http::assertSent(fn (Request $r): bool => str_contains($r->url(), 'sites/sc-domain%3Ajadidaring.com/searchAnalytics/query'));
    }

    public function test_results_are_cached_per_range_and_refresh_bypasses_cache(): void
    {
        $this->configure();
        $this->fakeGoogle();
        $admin = User::factory()->admin()->create();
        $gaCalls = fn (): int => count(Http::recorded(fn (Request $r) => str_contains($r->url(), 'analyticsdata')));

        $this->actingAs($admin)->get(self::URL.'?days=28')->assertOk();
        $this->actingAs($admin)->get(self::URL.'?days=28')->assertOk();
        $this->assertSame(1, $gaCalls());

        $this->actingAs($admin)->get(self::URL.'?days=7')->assertOk();
        $this->assertSame(2, $gaCalls());

        $this->actingAs($admin)->post(self::URL.'/refresh', ['days' => 28])
            ->assertRedirect(route('admin.statistik', ['days' => 28]));
        $this->actingAs($admin)->get(self::URL.'?days=28')->assertOk();
        $this->assertSame(3, $gaCalls());
    }

    public function test_refresh_is_rate_limited(): void
    {
        $admin = User::factory()->admin()->create();
        for ($i = 0; $i < 3; $i++) {
            $this->actingAs($admin)->post(self::URL.'/refresh', ['days' => 7])->assertRedirect();
        }
        $this->actingAs($admin)->from(self::URL)->post(self::URL.'/refresh', ['days' => 7])
            ->assertRedirect(self::URL)
            ->assertSessionHas('success', 'Terlalu sering refresh. Tunggu beberapa menit, data masih memakai cache.');
    }

    public function test_permission_and_disabled_api_errors_show_friendly_message_and_are_not_cached(): void
    {
        $this->configure();
        Log::spy();
        Http::fake([
            'oauth2.googleapis.com/token' => Http::response(['access_token' => 'ya29.test-token']),
            'analyticsdata.googleapis.com/*' => Http::response(['error' => [
                'code' => 403, 'status' => 'PERMISSION_DENIED',
                'message' => 'User does not have sufficient permissions for this property.',
            ]], 403),
            'www.googleapis.com/webmasters/*' => Http::response(['error' => [
                'code' => 403, 'status' => 'PERMISSION_DENIED',
                'message' => 'Google Search Console API has not been used in project 123 before or it is disabled.',
                'details' => [['@type' => 'type.googleapis.com/google.rpc.ErrorInfo', 'reason' => 'SERVICE_DISABLED']],
            ]], 403),
        ]);
        $admin = User::factory()->admin()->create();

        $this->actingAs($admin)->get(self::URL)
            ->assertOk()
            ->assertSee('Gagal mengambil data Google Analytics')
            ->assertSee('Akses ditolak (403)')
            ->assertSee('Gagal mengambil data Search Console')
            ->assertSee('API belum diaktifkan')
            ->assertDontSee('sufficient permissions')
            ->assertDontSee('ya29.test-token');

        Log::shouldHaveReceived('warning')->withArgs(fn (string $msg, array $ctx): bool => $msg === 'google-stats: API error' && $ctx['category'] === 'izin' && ! str_contains(json_encode($ctx), 'ya29'));

        $this->actingAs($admin)->get(self::URL)->assertOk();
        $this->assertSame(2, count(Http::recorded(fn (Request $r) => str_contains($r->url(), 'analyticsdata'))));
    }

    public function test_rejected_key_shows_key_message(): void
    {
        $this->configure();
        Http::fake(['oauth2.googleapis.com/token' => Http::response(['error' => 'invalid_grant', 'error_description' => 'Invalid JWT Signature.'], 400)]);

        $this->actingAs(User::factory()->admin()->create())->get(self::URL)
            ->assertOk()
            ->assertSee('Kunci service account ditolak Google');
    }
}

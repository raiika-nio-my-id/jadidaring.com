<?php

namespace App\Services\GoogleStats;

use Carbon\CarbonImmutable;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Read-only GA4 Data API + Search Console client for the admin Statistik page.
 *
 * Authenticates as a service account (JWT bearer grant signed with openssl, no SDK).
 * Credentials come only from env (config/services.php → google_stats); nothing is hard-coded.
 */
class GoogleStats
{
    public const RANGES = [7, 28];

    public const CACHE_TTL_SECONDS = 3600;

    private const TOKEN_URL = 'https://oauth2.googleapis.com/token';

    private const SCOPES = 'https://www.googleapis.com/auth/analytics.readonly https://www.googleapis.com/auth/webmasters.readonly';

    private const TIMEZONE = 'Asia/Makassar';

    private ?string $accessToken = null;

    /** @var array{client_email: string, private_key: string, token_uri?: string}|null|false */
    private array|false|null $credentials = false;

    public function propertyId(): string
    {
        return trim((string) config('services.google_stats.property_id'));
    }

    public function siteUrl(): string
    {
        return trim((string) config('services.google_stats.site_url'));
    }

    /**
     * Setup items that are missing or invalid. Names only, never values.
     *
     * @return array{ga4: list<string>, gsc: list<string>}
     */
    public function missingSetup(): array
    {
        $key = [];
        if (! $this->hasKeyConfigured()) {
            $key[] = 'Kunci service account (GOOGLE_STATS_SA_JSON_B64)';
        } elseif ($this->credentials() === null) {
            $key[] = 'Kunci service account tidak bisa dibaca (bukan JSON service account yang valid)';
        }

        $ga4 = $key;
        if ($this->propertyId() === '') {
            $ga4[] = 'GA4 property ID (GA4_PROPERTY_ID)';
        } elseif (! preg_match('/^\d{6,15}$/', $this->propertyId())) {
            $ga4[] = 'GA4 property ID harus berupa angka (bukan kode G-…)';
        }

        $gsc = $key;
        if ($this->siteUrl() === '') {
            $gsc[] = 'Alamat situs Search Console (GSC_SITE_URL)';
        } elseif (! preg_match('#^(sc-domain:[a-z0-9.-]+|https?://.+/)$#i', $this->siteUrl())) {
            $gsc[] = "Alamat situs Search Console harus 'sc-domain:domain' atau URL berakhiran '/'";
        }

        return ['ga4' => $ga4, 'gsc' => $gsc];
    }

    public function normalizeRange(mixed $days): int
    {
        return in_array((int) $days, self::RANGES, true) ? (int) $days : 28;
    }

    public function ga4CacheKey(int $days): string
    {
        return 'google-stats:ga4:'.$days.':'.md5($this->propertyId());
    }

    public function gscCacheKey(int $days): string
    {
        return 'google-stats:gsc:'.$days.':'.md5($this->siteUrl());
    }

    public function forget(int $days): void
    {
        Cache::forget($this->ga4CacheKey($days));
        Cache::forget($this->gscCacheKey($days));
    }

    /**
     * @return array{totals: array{views: int, sessions: int, users: int}, daily: array<string, array{views: int, sessions: int, users: int}>, topPages: list<array{path: string, views: int}>, fetchedAt: string}
     */
    public function ga4(int $days): array
    {
        return Cache::remember($this->ga4CacheKey($days), self::CACHE_TTL_SECONDS, fn (): array => $this->fetchGa4($days));
    }

    /**
     * @return array{totals: array{clicks: int, impressions: int, ctr: float, position: float}, daily: array<string, array{clicks: int, impressions: int}>, topQueries: list<array{key: string, clicks: int, impressions: int, ctr: float, position: float}>, topPages: list<array{key: string, clicks: int, impressions: int, ctr: float, position: float}>, startDate: string, endDate: string, fetchedAt: string}
     */
    public function gsc(int $days): array
    {
        return Cache::remember($this->gscCacheKey($days), self::CACHE_TTL_SECONDS, fn (): array => $this->fetchGsc($days));
    }

    /** @return array<string, mixed> */
    private function fetchGa4(int $days): array
    {
        $range = [['startDate' => ($days - 1).'daysAgo', 'endDate' => 'today']];
        $metrics = [['name' => 'screenPageViews'], ['name' => 'sessions'], ['name' => 'totalUsers']];

        $json = $this->post('ga4', 'https://analyticsdata.googleapis.com/v1beta/properties/'.$this->propertyId().':batchRunReports', [
            'requests' => [
                [
                    'dateRanges' => $range,
                    'dimensions' => [['name' => 'date']],
                    'metrics' => $metrics,
                    'metricAggregations' => ['TOTAL'],
                    'orderBys' => [['dimension' => ['dimensionName' => 'date']]],
                    'limit' => 100,
                ],
                [
                    'dateRanges' => $range,
                    'dimensions' => [['name' => 'pagePath']],
                    'metrics' => [['name' => 'screenPageViews']],
                    'orderBys' => [['metric' => ['metricName' => 'screenPageViews'], 'desc' => true]],
                    'limit' => 10,
                ],
            ],
        ]);

        $daily = $this->emptyDays($days, fn (): array => ['views' => 0, 'sessions' => 0, 'users' => 0], 0);
        $dailyReport = $json['reports'][0] ?? [];
        foreach ($dailyReport['rows'] ?? [] as $row) {
            $raw = (string) ($row['dimensionValues'][0]['value'] ?? '');
            if (! preg_match('/^\d{8}$/', $raw)) {
                continue;
            }
            $date = substr($raw, 0, 4).'-'.substr($raw, 4, 2).'-'.substr($raw, 6, 2);
            $daily[$date] = [
                'views' => (int) ($row['metricValues'][0]['value'] ?? 0),
                'sessions' => (int) ($row['metricValues'][1]['value'] ?? 0),
                'users' => (int) ($row['metricValues'][2]['value'] ?? 0),
            ];
        }
        // The property's own timezone may shift the window by a day; keep the newest $days.
        ksort($daily);
        $daily = array_slice($daily, -$days, null, true);

        $totalRow = $dailyReport['totals'][0]['metricValues'] ?? null;
        $totals = $totalRow !== null
            ? ['views' => (int) ($totalRow[0]['value'] ?? 0), 'sessions' => (int) ($totalRow[1]['value'] ?? 0), 'users' => (int) ($totalRow[2]['value'] ?? 0)]
            : [
                'views' => array_sum(array_column($daily, 'views')),
                'sessions' => array_sum(array_column($daily, 'sessions')),
                'users' => array_sum(array_column($daily, 'users')),
            ];

        $topPages = [];
        foreach ($json['reports'][1]['rows'] ?? [] as $row) {
            $topPages[] = ['path' => (string) ($row['dimensionValues'][0]['value'] ?? ''), 'views' => (int) ($row['metricValues'][0]['value'] ?? 0)];
        }

        return ['totals' => $totals, 'daily' => $daily, 'topPages' => $topPages, 'fetchedAt' => now()->toIso8601String()];
    }

    /** @return array<string, mixed> */
    private function fetchGsc(int $days): array
    {
        // Search Console data lags ~2–3 days; the window ends yesterday and the newest days may still be empty.
        $end = CarbonImmutable::now(self::TIMEZONE)->subDay();
        $start = $end->subDays($days - 1);
        $url = 'https://www.googleapis.com/webmasters/v3/sites/'.rawurlencode($this->siteUrl()).'/searchAnalytics/query';
        $base = ['startDate' => $start->toDateString(), 'endDate' => $end->toDateString()];

        $totalsJson = $this->post('gsc', $url, $base);
        $dailyJson = $this->post('gsc', $url, $base + ['dimensions' => ['date'], 'rowLimit' => 100]);
        $queriesJson = $this->post('gsc', $url, $base + ['dimensions' => ['query'], 'rowLimit' => 10]);
        $pagesJson = $this->post('gsc', $url, $base + ['dimensions' => ['page'], 'rowLimit' => 10]);

        $t = $totalsJson['rows'][0] ?? [];
        $totals = [
            'clicks' => (int) ($t['clicks'] ?? 0),
            'impressions' => (int) ($t['impressions'] ?? 0),
            'ctr' => (float) ($t['ctr'] ?? 0),
            'position' => (float) ($t['position'] ?? 0),
        ];

        $daily = $this->emptyDays($days, fn (): array => ['clicks' => 0, 'impressions' => 0], 1);
        foreach ($dailyJson['rows'] ?? [] as $row) {
            $date = (string) ($row['keys'][0] ?? '');
            if (isset($daily[$date])) {
                $daily[$date] = ['clicks' => (int) ($row['clicks'] ?? 0), 'impressions' => (int) ($row['impressions'] ?? 0)];
            }
        }

        $rows = fn (array $json): array => array_map(fn (array $row): array => [
            'key' => (string) ($row['keys'][0] ?? ''),
            'clicks' => (int) ($row['clicks'] ?? 0),
            'impressions' => (int) ($row['impressions'] ?? 0),
            'ctr' => (float) ($row['ctr'] ?? 0),
            'position' => (float) ($row['position'] ?? 0),
        ], $json['rows'] ?? []);

        return [
            'totals' => $totals,
            'daily' => $daily,
            'topQueries' => $rows($queriesJson),
            'topPages' => $rows($pagesJson),
            'startDate' => $start->toDateString(),
            'endDate' => $end->toDateString(),
            'fetchedAt' => now()->toIso8601String(),
        ];
    }

    /**
     * Zero-filled day map, oldest first, ending $endOffset days before today (WITA).
     *
     * @template T
     *
     * @param  callable(): T  $empty
     * @return array<string, T>
     */
    private function emptyDays(int $days, callable $empty, int $endOffset): array
    {
        $end = CarbonImmutable::now(self::TIMEZONE)->subDays($endOffset);
        $out = [];
        for ($i = $days - 1; $i >= 0; $i--) {
            $out[$end->subDays($i)->toDateString()] = $empty();
        }

        return $out;
    }

    /**
     * @param  array<string, mixed>  $body
     * @return array<string, mixed>
     */
    private function post(string $api, string $url, array $body): array
    {
        try {
            $response = Http::withToken($this->token())->acceptJson()->timeout(15)->post($url, $body);
        } catch (ConnectionException $e) {
            Log::warning('google-stats: connection failed', ['api' => $api, 'error' => $e->getMessage()]);
            throw new GoogleStatsException('jaringan', $e->getMessage());
        }

        if ($response->failed()) {
            throw $this->failure($api, $response);
        }

        return (array) $response->json();
    }

    private function token(): string
    {
        if ($this->accessToken !== null) {
            return $this->accessToken;
        }

        $creds = $this->credentials();
        if ($creds === null) {
            throw new GoogleStatsException('kunci', 'service account key missing or unreadable');
        }

        $now = time();
        $segments = [
            $this->b64url((string) json_encode(['alg' => 'RS256', 'typ' => 'JWT'])),
            $this->b64url((string) json_encode([
                'iss' => $creds['client_email'],
                'scope' => self::SCOPES,
                'aud' => self::TOKEN_URL,
                'iat' => $now,
                'exp' => $now + 3600,
            ])),
        ];
        $signature = '';
        $key = openssl_pkey_get_private($creds['private_key']);
        if ($key === false || ! openssl_sign(implode('.', $segments), $signature, $key, OPENSSL_ALGO_SHA256)) {
            Log::warning('google-stats: could not sign JWT with the service account key');
            throw new GoogleStatsException('kunci', 'jwt signing failed');
        }
        $assertion = implode('.', $segments).'.'.$this->b64url($signature);

        try {
            $response = Http::asForm()->acceptJson()->timeout(15)->post(self::TOKEN_URL, [
                'grant_type' => 'urn:ietf:params:oauth:grant-type:jwt-bearer',
                'assertion' => $assertion,
            ]);
        } catch (ConnectionException $e) {
            Log::warning('google-stats: token endpoint unreachable', ['error' => $e->getMessage()]);
            throw new GoogleStatsException('jaringan', $e->getMessage());
        }

        $token = $response->successful() ? (string) $response->json('access_token', '') : '';
        if ($token === '') {
            Log::warning('google-stats: token request rejected', [
                'status' => $response->status(),
                'error' => (string) $response->json('error', ''),
                'error_description' => (string) $response->json('error_description', ''),
            ]);
            throw new GoogleStatsException('kunci', 'token request rejected');
        }

        return $this->accessToken = $token;
    }

    private function failure(string $api, Response $response): GoogleStatsException
    {
        $status = $response->status();
        $error = (array) $response->json('error', []);
        $googleStatus = (string) ($error['status'] ?? '');
        $message = (string) ($error['message'] ?? '');
        $reasons = [];
        foreach ((array) ($error['details'] ?? []) as $d) {
            if (is_array($d) && isset($d['reason'])) {
                $reasons[] = (string) $d['reason'];
            }
        }
        foreach ((array) ($error['errors'] ?? []) as $e) {
            if (is_array($e) && isset($e['reason'])) {
                $reasons[] = (string) $e['reason'];
            }
        }
        $haystack = strtolower(implode(' ', $reasons).' '.$message);

        $category = match (true) {
            str_contains($haystack, 'service_disabled') || str_contains($haystack, 'accessnotconfigured') || str_contains($haystack, 'has not been used') || str_contains($haystack, 'is disabled') => 'api_nonaktif',
            $status === 401 => 'kunci',
            $status === 403 => 'izin',
            $status === 404 => 'tidak_ditemukan',
            $status === 429 => 'kuota',
            default => 'lainnya',
        };

        Log::warning('google-stats: API error', [
            'api' => $api,
            'http_status' => $status,
            'google_status' => $googleStatus,
            'reasons' => $reasons,
            'message' => mb_substr($message, 0, 500),
            'category' => $category,
        ]);

        return new GoogleStatsException($category, "$api HTTP $status $googleStatus");
    }

    private function hasKeyConfigured(): bool
    {
        return trim((string) config('services.google_stats.sa_json_b64')) !== ''
            || trim((string) config('services.google_stats.sa_json_path')) !== '';
    }

    /** @return array{client_email: string, private_key: string}|null */
    private function credentials(): ?array
    {
        if ($this->credentials !== false) {
            return $this->credentials;
        }

        $json = null;
        $b64 = trim((string) config('services.google_stats.sa_json_b64'));
        $path = trim((string) config('services.google_stats.sa_json_path'));
        if ($b64 !== '') {
            $decoded = base64_decode($b64, true);
            $json = $decoded === false ? null : $decoded;
        } elseif ($path !== '' && is_file($path) && is_readable($path)) {
            $json = (string) file_get_contents($path);
        }

        $data = $json !== null ? json_decode($json, true) : null;
        $valid = is_array($data)
            && is_string($data['client_email'] ?? null) && $data['client_email'] !== ''
            && is_string($data['private_key'] ?? null) && str_contains($data['private_key'], 'PRIVATE KEY');

        return $this->credentials = $valid ? ['client_email' => $data['client_email'], 'private_key' => $data['private_key']] : null;
    }

    private function b64url(string $raw): string
    {
        return rtrim(strtr(base64_encode($raw), '+/', '-_'), '=');
    }
}

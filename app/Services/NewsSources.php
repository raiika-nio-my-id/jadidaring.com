<?php

namespace App\Services;

/**
 * Validates an article's source list: each source is an http(s) URL and the
 * registrable domains are distinct (at least $min of them).
 */
class NewsSources
{
    /** Second-level suffixes where the registrable domain has three labels. */
    private const MULTI_PART = [
        'co.id', 'go.id', 'or.id', 'ac.id', 'sch.id', 'web.id', 'my.id', 'net.id', 'mil.id',
        'co.uk', 'org.uk', 'ac.uk', 'gov.uk', 'com.au', 'net.au', 'org.au', 'co.jp', 'co.nz',
        'com.sg', 'com.my', 'co.in', 'com.br', 'com.cn', 'com.hk', 'co.kr', 'com.tw',
    ];

    public static function registrableDomain(string $url): ?string
    {
        $parts = parse_url(trim($url));

        if (! is_array($parts) || ! in_array(strtolower((string) ($parts['scheme'] ?? '')), ['http', 'https'], true)) {
            return null;
        }

        $host = strtolower(rtrim((string) ($parts['host'] ?? ''), '.'));

        if ($host === '' || ! str_contains($host, '.') || filter_var($host, FILTER_VALIDATE_IP) !== false) {
            return null;
        }

        $labels = explode('.', $host);
        $lastTwo = implode('.', array_slice($labels, -2));
        $take = in_array($lastTwo, self::MULTI_PART, true) ? 3 : 2;

        return implode('.', array_slice($labels, -$take));
    }

    /**
     * @param  array<int, mixed>  $sources  each item: ['url' => string, 'title' => ?string]
     * @return array{sources: list<array{title: string, url: string, domain: string}>, error: ?string}
     */
    public static function normalize(array $sources, int $min = 2): array
    {
        $min = max(2, $min);
        $clean = [];
        $domains = [];
        $own = GameHub::baseDomain();

        foreach ($sources as $source) {
            $url = is_array($source) ? (string) ($source['url'] ?? '') : (string) $source;
            $title = is_array($source) ? trim((string) ($source['title'] ?? '')) : '';
            $domain = self::registrableDomain($url);

            if ($domain === null || strlen($url) > 500) {
                return ['sources' => [], 'error' => 'Sumber tidak valid: '.mb_substr($url, 0, 80)];
            }

            if ($domain === $own) {
                return ['sources' => [], 'error' => 'Sumber tidak boleh berasal dari situs ini.'];
            }

            if (isset($domains[$domain])) {
                continue; // duplicate domain: keep the first only
            }

            $domains[$domain] = true;
            $clean[] = ['title' => mb_substr($title !== '' ? $title : $domain, 0, 150), 'url' => trim($url), 'domain' => $domain];
        }

        if (count($clean) < $min) {
            return ['sources' => [], 'error' => "Butuh minimal {$min} sumber dari domain berbeda (ditemukan ".count($clean).').'];
        }

        return ['sources' => $clean, 'error' => null];
    }
}

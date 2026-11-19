<?php

namespace Tests\Feature;

use App\Models\Article;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class JsonLdValidTest extends TestCase
{
    use RefreshDatabase;

    /** @return array<int, array<string, mixed>> */
    private function blocks(string $path): array
    {
        $html = $this->get('http://jadidaring.test'.$path)->assertOk()->getContent();
        preg_match_all('#<script type="application/ld\+json">(.*?)</script>#s', $html, $m);
        $this->assertNotEmpty($m[1], $path.' has no ld+json');
        $out = [];
        foreach ($m[1] as $raw) {
            $j = json_decode($raw, true);
            $this->assertIsArray($j, $path.' invalid JSON: '.$raw);
            $this->assertSame('https://schema.org', $j['@context'] ?? null, $path);
            $out[] = $j;
        }

        return $out;
    }

    public function test_all_ld_json_blocks_parse(): void
    {
        $a = Article::create(['topic' => 'teknologi', 'slug' => 'tes-ld', 'title' => 'Tes LD', 'summary' => 's', 'body' => str_repeat('x ', 80),
            'sources' => [], 'status' => 'published', 'published_at' => '2026-11-19 07:52:00']);
        foreach (['/', '/berita', '/berita/teknologi', '/komunitas'] as $p) {
            $this->blocks($p);
        }
        $blocks = $this->blocks($a->url());
        $types = array_map(fn ($b) => $b['@type'] ?? null, $blocks);
        $this->assertContains('NewsArticle', $types);
        $this->assertContains('BreadcrumbList', $types);
        $n = $blocks[array_search('NewsArticle', $types)];
        $this->assertStringEndsWith('+08:00', $n['datePublished']);
        $this->assertStringStartsWith('2026-11-19T15:52:00', $n['datePublished']);
        $this->assertTrue($n['isAccessibleForFree']);
        $this->assertSame('ImageObject', $n['image'][0]['@type']);
        $this->assertSame(1200, $n['image'][0]['width']);
    }
}

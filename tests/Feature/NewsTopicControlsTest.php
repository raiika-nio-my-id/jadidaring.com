<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class NewsTopicControlsTest extends TestCase
{
    use RefreshDatabase;

    public function test_topic_pages_keep_search_and_sort_controls(): void
    {
        $html = $this->get('http://jadidaring.test/berita/politik')->assertOk()->getContent();
        $this->assertStringContainsString('class="news-search"', $html);
        $this->assertStringContainsString('action="/berita/politik"', $html);
        $this->assertStringContainsString('Urutkan Berita', $html);
        $this->assertStringNotContainsString('noindex', $html);
    }

    public function test_topic_search_and_popular_are_noindex_and_keep_state(): void
    {
        $q = $this->get('http://jadidaring.test/berita/politik?q=abc')->assertOk()->getContent();
        $this->assertStringContainsString('noindex', $q);
        $this->assertStringContainsString('value="abc"', $q);
        $p = $this->get('http://jadidaring.test/berita/politik?urut=populer')->assertOk()->getContent();
        $this->assertStringContainsString('noindex', $p);
        $this->assertStringContainsString('canonical" href="https://', $p);
    }

    public function test_popular_is_a_sort_not_a_filter(): void
    {
        foreach ([1, 2, 3] as $i) {
            \App\Models\Article::query()->create([
                'topic' => 'saham', 'slug' => 'saham-tes-'.$i, 'title' => 'Berita Saham Tes '.$i, 'summary' => 's', 'body' => 'b',
                'status' => 'published', 'sources' => [['name' => 'a', 'url' => 'https://a.test'], ['name' => 'b', 'url' => 'https://b.test']], 'published_at' => now()->subMinutes($i),
            ]);
        }
        \Illuminate\Support\Facades\Cache::put('popular:news', ['views' => ['saham-tes-3' => 5], 'fetchedAt' => now()->toIso8601String()], 3600);

        $html = $this->get('http://jadidaring.test/berita/saham?urut=populer')->assertOk()->getContent();
        foreach ([1, 2, 3] as $i) {
            $this->assertStringContainsString('Berita Saham Tes '.$i, $html);
        }
        $this->assertLessThan(strpos($html, 'Berita Saham Tes 1'), strpos($html, 'Berita Saham Tes 3'));
        $this->assertLessThan(strpos($html, 'Berita Saham Tes 2'), strpos($html, 'Berita Saham Tes 1'));
        $this->assertStringNotContainsString('Google Analytics', $html);

        \Illuminate\Support\Facades\Cache::forget('popular:news');
        $this->get('http://jadidaring.test/berita?urut=populer')->assertOk()->assertSee('Berita Saham Tes 1', false);
    }
}

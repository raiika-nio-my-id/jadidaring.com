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
}

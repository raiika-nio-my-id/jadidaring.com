<?php

namespace Tests\Feature;

use App\Models\Article;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class NewsPaginationTest extends TestCase
{
    use RefreshDatabase;

    private const SITE = 'http://jadidaring.test';

    private function seedArticles(int $n): void
    {
        for ($i = 1; $i <= $n; $i++) {
            Article::query()->create([
                'topic' => $i % 2 ? 'politik' : 'teknologi', 'slug' => 'artikel-nomor-'.$i, 'title' => 'Artikel nomor '.$i,
                'summary' => 'Ringkasan '.$i, 'body' => str_repeat("Isi berita.\n\n", 6), 'image_url' => 'https://img.example.com/a.jpg',
                'sources' => [['title' => 'A', 'url' => 'https://a.example.com/1'], ['title' => 'B', 'url' => 'https://b.example.com/1']],
                'status' => 'published', 'published_at' => now()->subMinutes(100 - $i),
            ]);
        }
    }

    public function test_page_two_shows_different_articles_with_canonical_and_title(): void
    {
        $this->seedArticles(60);
        $p1 = $this->get(self::SITE.'/berita')->assertOk()
            ->assertSee('<link rel="canonical" href="https://jadidaring.test/berita">', false)
            ->assertSee('rel="next" href="https://jadidaring.test/berita?page=2"', false)
            ->assertSee('href="/berita?page=2"', false)
            ->assertSee('Artikel nomor 60')->assertDontSee('Artikel nomor 36');
        $this->assertStringNotContainsString('Halaman 1', $p1->getContent());

        $this->get(self::SITE.'/berita?page=2')->assertOk()
            ->assertSee('<link rel="canonical" href="https://jadidaring.test/berita?page=2">', false)
            ->assertSee('Halaman 2')
            ->assertSee('Artikel nomor 36')->assertDontSee('Artikel nomor 60');
    }

    public function test_out_of_range_and_invalid_pages_404(): void
    {
        $this->seedArticles(30);
        $this->get(self::SITE.'/berita?page=3')->assertNotFound();
        $this->get(self::SITE.'/berita?page=0')->assertNotFound();
        $this->get(self::SITE.'/berita?page=abc')->assertNotFound();
        $this->get(self::SITE.'/berita/politik?page=2')->assertNotFound();
    }

    public function test_topic_pagination(): void
    {
        $this->seedArticles(60);
        $this->get(self::SITE.'/berita/politik')->assertOk()
            ->assertSee('<link rel="canonical" href="https://jadidaring.test/berita/politik">', false)
            ->assertSee('href="/berita/politik?page=2"', false);
        $this->get(self::SITE.'/berita/politik?page=2')->assertOk()
            ->assertSee('<link rel="canonical" href="https://jadidaring.test/berita/politik?page=2">', false)
            ->assertSee('Halaman 2')->assertSee('Artikel nomor 5')->assertDontSee('Artikel nomor 59');
    }
}

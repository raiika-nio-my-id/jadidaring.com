<?php

namespace Tests\Feature;

use App\Models\Article;
use App\Models\CompanyProfile;
use App\Models\MemberPage;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class InfiniteScrollTest extends TestCase
{
    use RefreshDatabase;

    private const SITE = 'http://jadidaring.test';

    private function seedArticles(int $n): void
    {
        for ($i = 1; $i <= $n; $i++) {
            Article::query()->create([
                'topic' => 'politik', 'slug' => 'artikel-nomor-'.$i, 'title' => 'Artikel nomor '.$i, 'summary' => 'Ringkasan '.$i,
                'body' => str_repeat("Isi berita.\n\n", 6), 'image_url' => 'https://img.example.com/a.jpg',
                'sources' => [['title' => 'A', 'url' => 'https://a.example.com/1'], ['title' => 'B', 'url' => 'https://b.example.com/1']],
                'status' => 'published', 'published_at' => now()->subMinutes(200 - $i),
            ]);
        }
    }

    public function test_news_shows_load_more_link_instead_of_numbered_pager(): void
    {
        $this->seedArticles(30);
        $r = $this->get(self::SITE.'/berita')->assertOk()
            ->assertSee('data-jd-inf', false)
            ->assertSee('class="clay-btn clay-btn--secondary inf__btn" rel="next" href="/berita?page=2"', false)
            ->assertSee('Muat lebih banyak')
            ->assertSee('rel="next" href="https://jadidaring.test/berita?page=2"', false)
            ->assertDontSee('class="pager"', false);
        $this->assertStringNotContainsString('class="inf__prev"', $r->getContent());

        $this->get(self::SITE.'/berita?page=2')->assertOk()
            ->assertSee('rel="prev" href="https://jadidaring.test/berita"', false)
            ->assertSee('rel="next" href="https://jadidaring.test/berita?page=3"', false)
            ->assertSee('class="inf__prev" rel="prev" href="/berita"', false);

        $this->get(self::SITE.'/berita?page=3')->assertOk()->assertSee('Sudah semua')->assertDontSee('class="clay-btn clay-btn--secondary inf__btn"', false);
    }

    public function test_news_partial_returns_only_cards_and_next_footer(): void
    {
        $this->seedArticles(30);
        $r = $this->get(self::SITE.'/berita?page=2&partial=1')->assertOk()
            ->assertHeader('X-Robots-Tag', 'noindex')
            ->assertSee('Artikel nomor 18')->assertDontSee('Artikel nomor 30')
            ->assertSee('data-next="/berita?page=3&amp;partial=1"', false)
            ->assertSee('href="/berita?page=3"', false);
        $this->assertStringNotContainsString('<html', $r->getContent());
        $this->assertStringNotContainsString('clay-header', $r->getContent());

        $this->get(self::SITE.'/berita?page=3&partial=1')->assertOk()->assertSee('Sudah semua')->assertDontSee('data-next', false);
        $this->get(self::SITE.'/berita?page=4&partial=1')->assertNotFound();
    }

    public function test_news_popular_and_topic_keep_their_filters_in_next_links(): void
    {
        $this->seedArticles(60);
        $this->get(self::SITE.'/berita?urut=populer')->assertOk()->assertSee('href="/berita?urut=populer&amp;page=2"', false);
        $this->get(self::SITE.'/berita/politik?page=2&partial=1')->assertOk()->assertSee('data-next="/berita/politik?page=3&amp;partial=1"', false);
    }

    public function test_game_list_is_paginated_server_side(): void
    {
        for ($i = 1; $i <= 20; $i++) {
            CompanyProfile::factory()->game()->published()->create(['subdomain' => sprintf('gim%02d', $i), 'html' => '<html><head><title>Gim '.$i.'</title></head></html>']);
        }
        $per = \App\Http\Controllers\ClayController::GAMES_PER_PAGE;
        $p1 = $this->get(self::SITE.'/game?sort=az')->assertOk()
            ->assertSee('rel="next" href="https://jadidaring.test/game?sort=az&amp;page=2"', false)
            ->assertSee('href="/game?sort=az&amp;page=2"', false)->assertSee('Muat lebih banyak');
        $this->assertSame($per, substr_count($p1->getContent(), 'class="game-card"'));
        $p1->assertSee('/game/gim01', false)->assertDontSee('/game/gim20', false);

        $p3 = $this->get(self::SITE.'/game?sort=az&page=3')->assertOk()->assertSee('/game/gim20', false)->assertSee('Sudah semua');
        $this->assertSame(20 - 2 * $per, substr_count($p3->getContent(), 'class="game-card"'));

        $part = $this->get(self::SITE.'/game?sort=az&page=2&partial=1')->assertOk()->assertHeader('X-Robots-Tag', 'noindex')
            ->assertSee('/game/gim'.sprintf('%02d', $per + 1), false)->assertDontSee('/game/gim01"', false);
        $this->assertStringNotContainsString('<html', $part->getContent());
        $this->assertSame($per, substr_count($part->getContent(), 'class="game-card"'));

        $this->get(self::SITE.'/game?page=99')->assertNotFound();
        $this->get(self::SITE.'/game?page=x')->assertNotFound();
    }

    public function test_komunitas_explore_is_paginated_and_respects_search_and_sort(): void
    {
        $per = \App\Http\Controllers\CommunityController::EXPLORE_PER_PAGE;
        for ($i = 1; $i <= $per + 5; $i++) {
            $u = User::factory()->create(['username' => sprintf('budi%02d', $i), 'name' => 'Budi '.$i]);
            MemberPage::query()->create(['user_id' => $u->id, 'title' => 'Halaman', 'status' => 'published', 'html' => '<p>hai</p>', 'views' => $i, 'updated_at' => now()->subMinutes(100 - $i)]);
        }
        $u = User::factory()->create(['username' => 'siti01', 'name' => 'Siti']);
        MemberPage::query()->create(['user_id' => $u->id, 'title' => 'Halaman', 'status' => 'published', 'html' => '<p>hai</p>']);

        $p1 = $this->get(self::SITE.'/komunitas?tab=profil&q=budi&urut=baru')->assertOk()
            ->assertSee('rel="next" href="https://jadidaring.test/komunitas?tab=profil&amp;q=budi&amp;urut=baru&amp;page=2"', false)
            ->assertSee('Muat lebih banyak')->assertDontSee('@siti01');
        $this->assertSame($per, substr_count($p1->getContent(), 'class="pf-mini"'));

        $part = $this->get(self::SITE.'/komunitas?tab=profil&q=budi&urut=baru&page=2&partial=1')->assertOk()->assertHeader('X-Robots-Tag', 'noindex')
            ->assertSee('Sudah semua')->assertDontSee('@siti01');
        $this->assertSame(5, substr_count($part->getContent(), 'class="pf-mini"'));
        $this->assertStringNotContainsString('<html', $part->getContent());

        $this->get(self::SITE.'/komunitas?tab=profil&q=budi&page=3')->assertNotFound();
        $this->get(self::SITE.'/komunitas?page=zz')->assertNotFound();
    }

    public function test_script_is_loaded_once_per_listing(): void
    {
        $this->seedArticles(30);
        $this->assertSame(1, substr_count($this->get(self::SITE.'/berita')->getContent(), 'js/jd-infinite.js'));
    }
}

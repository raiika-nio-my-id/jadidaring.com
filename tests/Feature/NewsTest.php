<?php

namespace Tests\Feature;

use App\Models\Article;
use App\Models\ArticleComment;
use App\Models\NewsTopic;
use App\Models\User;
use App\Services\NewsSources;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class NewsTest extends TestCase
{
    use RefreshDatabase;

    private const API = 'http://admin.jadidaring.test/api/admin/news';

    private const SITE = 'http://jadidaring.test';

    /** @return array<string, mixed> */
    private function payload(array $over = []): array
    {
        return array_merge([
            'topic' => 'teknologi',
            'title' => 'Laravel merilis pembaruan keamanan penting',
            'summary' => 'Pembaruan keamanan Laravel menutup celah yang dilaporkan peneliti.',
            'body' => str_repeat("Paragraf berita yang cukup panjang untuk lolos validasi.\n\n", 6),
            'image_url' => 'https://img.example.com/a.jpg',
            'sources' => [
                ['title' => 'Laravel Blog', 'url' => 'https://blog.laravel.com/post-1'],
                ['title' => 'Detik', 'url' => 'https://inet.detik.com/x'],
            ],
            'status' => 'published',
        ], $over);
    }

    /** @return array<string, string> */
    private function key(): array
    {
        return ['X-Admin-Api-Key' => 'testing-admin-api-secret'];
    }

    public function test_sosmed_topic_page_api_nav_and_sitemap(): void
    {
        $topic = NewsTopic::query()->where('slug', 'sosmed')->first();
        $this->assertSame('Tren Sosial Media', $topic->name);
        $this->assertTrue((bool) $topic->enabled);
        $this->assertGreaterThanOrEqual(2, $topic->min_sources);

        $this->get(self::SITE.'/berita/sosmed')->assertOk()->assertSee('Tren Sosial Media')
            ->assertSee('https://jadidaring.test/berita/sosmed', false)->assertSee('media sosial Indonesia dan dunia', false);
        $this->get(self::SITE.'/berita')->assertSee('/berita/sosmed', false);
        $this->get(self::SITE.'/sitemap.xml')->assertSee('/berita/sosmed', false);
        $this->postJson(self::API.'/articles', $this->payload(['topic' => 'sosmed', 'title' => 'Tren sosial media paling ramai hari ini']), $this->key())->assertCreated();
        $this->getJson(self::API.'/topics', $this->key())->assertOk()->assertJsonFragment(['slug' => 'sosmed']);
    }

    public function test_api_requires_the_secret(): void
    {
        $this->postJson(self::API.'/articles', $this->payload())->assertUnauthorized();
        $this->postJson(self::API.'/articles', $this->payload(), ['X-Admin-Api-Key' => 'nope'])->assertUnauthorized();
        $this->assertSame(0, Article::query()->count());
    }

    public function test_source_domain_validation(): void
    {
        $this->assertSame('detik.com', NewsSources::registrableDomain('https://inet.detik.com/x'));
        $this->assertSame('kompas.co.id', NewsSources::registrableDomain('https://www.kompas.co.id/a'));
        $this->assertNull(NewsSources::registrableDomain('ftp://x.com/a'));
        $this->assertNull(NewsSources::registrableDomain('javascript:alert(1)'));
        $this->assertNull(NewsSources::registrableDomain('http://127.0.0.1/a'));

        $same = NewsSources::normalize([['url' => 'https://a.detik.com/1'], ['url' => 'https://b.detik.com/2']]);
        $this->assertNotNull($same['error']);
        $own = NewsSources::normalize([['url' => 'https://jadidaring.test/x'], ['url' => 'https://b.com/2']]);
        $this->assertNotNull($own['error']);
        $ok = NewsSources::normalize([['url' => 'https://a.com/1'], ['url' => 'https://b.com/2']]);
        $this->assertNull($ok['error']);
        $this->assertCount(2, $ok['sources']);
    }

    public function test_create_requires_two_distinct_domains(): void
    {
        $this->postJson(self::API.'/articles', $this->payload(['sources' => [['url' => 'https://a.detik.com/1'], ['url' => 'https://b.detik.com/2']]]), $this->key())
            ->assertStatus(422);
        $this->postJson(self::API.'/articles', $this->payload(['sources' => [['url' => 'https://a.com/1']]]), $this->key())->assertStatus(422);
        $this->postJson(self::API.'/articles', $this->payload(['sources' => [['url' => 'javascript:alert(1)'], ['url' => 'https://a.com/1']]]), $this->key())->assertStatus(422);
        $this->postJson(self::API.'/articles', $this->payload(['topic' => 'bogus']), $this->key())->assertStatus(422);
        $this->postJson(self::API.'/articles', $this->payload(['image_url' => 'http://insecure.example.com/a.jpg']), $this->key())->assertStatus(422);
        $this->assertSame(0, Article::query()->count());
    }

    public function test_publish_and_read_pages_with_seo(): void
    {
        $res = $this->postJson(self::API.'/articles', $this->payload(), $this->key())->assertCreated();
        $url = $res->json('article.url');
        $this->assertStringContainsString('/berita/teknologi/laravel-merilis', $url);

        $path = parse_url($url, PHP_URL_PATH);

        $this->get(self::SITE.$path)
            ->assertOk()
            ->assertSee('Laravel merilis pembaruan keamanan penting', false)
            ->assertSee('<link rel="canonical" href="https://jadidaring.test'.$path.'">', false)
            ->assertSee('og:type" content="article"', false)
            ->assertSee('og:image" content="https://jadidaring.test/gambar-berita/', false)
            ->assertSee('twitter:card" content="summary_large_image"', false)
            ->assertSee('"BreadcrumbList"', false)
            ->assertSee('"@type":"NewsArticle"', false)
            ->assertSee('blog.laravel.com', false)
            ->assertSee('rel="nofollow noopener noreferrer"', false);

        $this->get(self::SITE.'/berita')->assertOk()->assertSee($path, false);
        $this->get(self::SITE.'/berita/teknologi')->assertOk()->assertSee($path, false);
        $this->get(self::SITE.'/berita/politik')->assertOk()->assertDontSee($path, false);
        $this->get(self::SITE.'/')->assertOk()->assertSee($path, false);
        $this->get(self::SITE.'/sitemap.xml')->assertOk()->assertSee('https://jadidaring.test'.$path, false);

        $slug = basename($path);
        $this->get(self::SITE.'/berita/politik/'.$slug)->assertStatus(301)->assertRedirect($path);
        $this->get(self::SITE.'/berita/teknologi/tidak-ada')->assertNotFound();
    }

    public function test_body_is_escaped(): void
    {
        $res = $this->postJson(self::API.'/articles', $this->payload(['body' => str_repeat('<script>alert(1)</script> teks aman. ', 12)]), $this->key())->assertCreated();

        $this->get(self::SITE.parse_url($res->json('article.url'), PHP_URL_PATH))->assertOk()->assertDontSee('<script>alert(1)', false);
    }

    public function test_structured_body_renders_headings_bold_and_keypoints_safely(): void
    {
        $body = "Poin penting\n- Fakta **satu** penting\n- Fakta dua\n\nParagraf pembuka yang cukup panjang untuk lolos validasi. ".str_repeat('Kalimat isi. ', 15)."\n\n## Bagian Satu\n\nIsi dengan **angka 42** dan <b>x</b>.\n\n### Sub\n\n- a\n- b";
        $res = $this->postJson(self::API.'/articles', $this->payload(['body' => $body]), $this->key())->assertCreated();
        $this->assertArrayNotHasKey('warnings', $res->json());

        $this->get(self::SITE.parse_url($res->json('article.url'), PHP_URL_PATH))->assertOk()
            ->assertSee('<aside class="news-keypoints"', false)
            ->assertSee('<h2 class="news-subhead">Bagian Satu</h2>', false)
            ->assertSee('<h3 class="news-subhead news-subhead--3">Sub</h3>', false)
            ->assertSee('<strong>angka 42</strong>', false)
            ->assertDontSee('<b>x</b>', false);
    }

    public function test_plain_body_gets_format_warnings_and_full_list_returns_body(): void
    {
        $res = $this->postJson(self::API.'/articles', $this->payload(['body' => str_repeat('Teks polos. ', 30)]), $this->key())->assertCreated();
        $this->assertCount(2, $res->json('warnings'));
        $this->getJson(self::API.'/articles?full=1', $this->key())->assertOk()->assertJsonPath('articles.0.body', trim(str_repeat('Teks polos. ', 30)));
    }

    public function test_drafts_and_hidden_articles_are_not_public_and_cache_refreshes(): void
    {
        $draft = $this->postJson(self::API.'/articles', $this->payload(['status' => 'draft']), $this->key())->assertCreated();
        $path = parse_url($draft->json('article.url'), PHP_URL_PATH);
        $this->get(self::SITE.$path)->assertNotFound();

        $id = $draft->json('article.id');
        $this->patchJson(self::API.'/articles/'.$id, ['status' => 'published'], $this->key())->assertOk();
        $this->get(self::SITE.'/berita')->assertSee($path, false);
        $this->get(self::SITE.$path)->assertOk();

        $this->patchJson(self::API.'/articles/'.$id, ['status' => 'hidden'], $this->key())->assertOk();
        $this->get(self::SITE.'/berita')->assertDontSee($path, false);
        $this->get(self::SITE.$path)->assertNotFound();
    }

    public function test_per_topic_daily_limit_and_disabled_topic(): void
    {
        NewsTopic::query()->where('slug', 'politik')->update(['articles_per_day' => 1]);

        $this->postJson(self::API.'/articles', $this->payload(['topic' => 'politik', 'title' => 'Berita politik nomor satu hari ini']), $this->key())->assertCreated();
        $this->postJson(self::API.'/articles', $this->payload(['topic' => 'politik', 'title' => 'Berita politik nomor dua hari ini']), $this->key())->assertStatus(422);
        $this->postJson(self::API.'/articles', $this->payload(['topic' => 'politik', 'title' => 'Berita politik nomor tiga draf', 'status' => 'draft']), $this->key())->assertCreated();

        $this->patchJson(self::API.'/topics/gaming', ['enabled' => false], $this->key())->assertOk();
        $this->postJson(self::API.'/articles', $this->payload(['topic' => 'gaming']), $this->key())->assertStatus(422);

        $this->patchJson(self::API.'/topics/gaming', ['min_sources' => 1], $this->key())->assertStatus(422);
        $this->getJson(self::API.'/topics', $this->key())->assertOk()->assertJsonCount(7, 'topics');
    }

    public function test_zero_daily_limit_means_unlimited(): void
    {
        NewsTopic::query()->where('slug', 'politik')->update(['articles_per_day' => 0]);

        foreach (['satu', 'dua', 'tiga', 'empat', 'lima'] as $n) {
            $this->postJson(self::API.'/articles', $this->payload(['topic' => 'politik', 'title' => "Berita politik tanpa batas nomor {$n}"]), $this->key())->assertCreated();
        }
    }

    public function test_comments_load_lazily_and_posting_requires_a_member(): void
    {
        $res = $this->postJson(self::API.'/articles', $this->payload(), $this->key())->assertCreated();
        $path = parse_url($res->json('article.url'), PHP_URL_PATH);
        $article = Article::query()->firstOrFail();

        $this->getJson(self::SITE.$path.'/komentar')->assertOk()->assertExactJson(['comments' => []]);
        $this->postJson(self::SITE.$path.'/komentar', ['body' => 'halo'])->assertUnauthorized();

        $user = User::factory()->member()->create(['username' => 'rani']);
        $this->actingAs($user)->postJson(self::SITE.$path.'/komentar', ['body' => 'Komentar <b>bagus</b>'])
            ->assertCreated()->assertJsonPath('comment.user', 'rani')->assertJsonPath('comment.body', 'Komentar bagus');

        $this->actingAs($user)->postJson(self::SITE.$path.'/komentar', ['body' => 'http://a.com http://b.com http://c.com'])->assertStatus(422);
        $this->actingAs($user)->postJson(self::SITE.$path.'/komentar', ['body' => 'x'])->assertStatus(422);

        $this->getJson(self::SITE.$path.'/komentar')->assertJsonCount(1, 'comments');

        $comment = ArticleComment::query()->firstOrFail();
        $this->patchJson(self::API.'/comments/'.$comment->id, ['is_hidden' => true], $this->key())->assertOk();
        $this->getJson(self::SITE.$path.'/komentar')->assertJsonCount(0, 'comments');
        $this->assertSame($article->id, $comment->article_id);
    }

    public function test_comment_posting_is_rate_limited(): void
    {
        $this->postJson(self::API.'/articles', $this->payload(), $this->key())->assertCreated();
        $path = parse_url(Article::query()->firstOrFail()->url(), PHP_URL_PATH);
        $user = User::factory()->member()->create();

        for ($i = 0; $i < 5; $i++) {
            $this->actingAs($user)->postJson(self::SITE.$path.'/komentar', ['body' => 'komentar ke '.$i])->assertCreated();
        }

        $this->actingAs($user)->postJson(self::SITE.$path.'/komentar', ['body' => 'terlalu banyak'])->assertStatus(429);
    }

    public function test_ga4_banner_only_renders_with_a_valid_env_id(): void
    {
        config(['services.ga4.measurement_id' => null]);
        $this->get(self::SITE.'/')->assertDontSee('consent-banner', false)->assertDontSee('googletagmanager', false);

        config(['services.ga4.measurement_id' => 'not valid"><script>']);
        $this->get(self::SITE.'/')->assertDontSee('consent-banner', false);

        config(['services.ga4.measurement_id' => 'G-ABC123XYZ9']);
        $this->get(self::SITE.'/')->assertSee('id="consent-banner"', false)->assertSee('G-ABC123XYZ9', false)->assertSee("analytics_storage: 'denied'", false);
    }

    public function test_slugs_cut_on_a_word_boundary_without_trailing_dash(): void
    {
        $title = 'Game gratis Epic Games Store minggu ini: Mark of the Ninja Remastered dan satu lagi judul panjang sekali';
        $slug = \App\Services\NewsSlug::make($title);

        $this->assertLessThanOrEqual(80, strlen($slug));
        $this->assertStringEndsNotWith('-', $slug);
        $this->assertStringStartsWith($slug, \Illuminate\Support\Str::slug($title));
        $this->assertContains(substr(\Illuminate\Support\Str::slug($title), strlen($slug), 1), ['-', '']);
    }

    public function test_old_slug_redirects_and_delete_endpoint(): void
    {
        $res = $this->postJson(self::API.'/articles', $this->payload(), $this->key())->assertCreated();
        $article = Article::query()->firstOrFail();
        \Illuminate\Support\Facades\DB::table('article_slug_redirects')->insert(['old_slug' => 'slug-lama-terpotong-dan', 'article_id' => $article->id]);

        $this->get(self::SITE.'/berita/teknologi/slug-lama-terpotong-dan')->assertStatus(301)->assertRedirect($article->url());

        $draft = $this->postJson(self::API.'/articles', $this->payload(['status' => 'draft', 'title' => 'Draf duplikat yang akan dihapus']), $this->key())->assertCreated();
        $this->getJson(self::API.'/articles?status=draft', $this->key())->assertOk()->assertJsonCount(1, 'articles');
        $this->deleteJson(self::API.'/articles/'.$draft->json('article.id'))->assertUnauthorized();
        $this->deleteJson(self::API.'/articles/'.$draft->json('article.id'), [], $this->key())->assertOk();
        $this->deleteJson(self::API.'/articles/'.$draft->json('article.id'), [], $this->key())->assertNotFound();
        $this->assertNotNull(Article::query()->find($article->id));
    }
}

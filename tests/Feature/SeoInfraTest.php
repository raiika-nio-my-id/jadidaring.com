<?php

namespace Tests\Feature;

use App\Models\Article;
use App\Models\ContactMessage;
use App\Services\NewsImage;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class SeoInfraTest extends TestCase
{
    use RefreshDatabase;

    private const SITE = 'http://jadidaring.test';

    private const API = 'http://admin.jadidaring.test/api/admin/news';

    protected function setUp(): void
    {
        parent::setUp();
        config(['singlepage.admin_api_secret' => 'testing-admin-api-secret']);
    }

    private function key(): array
    {
        return ['X-Admin-Api-Key' => 'testing-admin-api-secret'];
    }

    private function article(array $o = []): Article
    {
        return Article::query()->create($o + [
            'topic' => 'teknologi', 'slug' => 'artikel-uji-'.uniqid(), 'title' => 'Artikel uji untuk gambar dan feed', 'summary' => 'Ringkasan artikel uji yang cukup panjang.',
            'body' => str_repeat('Isi. ', 60), 'sources' => [], 'status' => 'published', 'published_at' => now()->subHour(),
        ]);
    }

    private function photo(int $w = 1400, int $h = 900): string
    {
        $im = imagecreatetruecolor($w, $h);
        imagefill($im, 0, 0, imagecolorallocate($im, 30, 120, 200));
        ob_start();
        imagejpeg($im);

        return (string) ob_get_clean();
    }

    public function test_every_article_has_a_title_card_and_uploaded_photo_replaces_it(): void
    {
        $a = $this->article();
        $res = $this->get(self::SITE.'/gambar-berita/'.$a->id.'-1200.webp')->assertOk();
        $this->assertSame('image/webp', $res->headers->get('Content-Type'));
        $this->assertStringContainsString('public', $res->headers->get('Cache-Control'));
        $this->assertNull($res->headers->get('Set-Cookie'));
        $size = getimagesize($res->baseResponse->getFile()->getPathname());
        $this->assertSame([1200, 630], [$size[0], $size[1]]);

        $file = UploadedFile::fake()->createWithContent('p.jpg', $this->photo());
        $this->post(self::API.'/articles/'.$a->id.'/image', ['image' => $file, 'alt' => 'Pemandangan kota', 'credit' => 'Budi / Unsplash', 'source_url' => 'https://unsplash.com/photos/x', 'license' => 'Unsplash License'], $this->key() + ['Accept' => 'application/json'])
            ->assertOk()->assertJsonPath('article.image.photo', true);

        $a->refresh();
        $this->assertNotEmpty($a->image_path);
        $page = $this->get(self::SITE.'/berita/teknologi/'.$a->slug)->assertOk()
            ->assertSee('Foto: Budi / Unsplash', false)->assertSee('alt="Pemandangan kota"', false)->assertSee('gambar-berita/'.$a->id.'-1200.webp', false);
        $this->assertStringContainsString('"image":[{"@type":"ImageObject","url":"https:', $page->getContent());

        $this->deleteJson(self::API.'/articles/'.$a->id.'/image', [], $this->key())->assertOk()->assertJsonPath('article.image.photo', false);
        $this->get(self::SITE.'/berita/teknologi/'.$a->slug)->assertDontSee('Foto: Budi', false);
    }

    public function test_image_is_downloaded_from_url_and_small_or_private_urls_are_refused(): void
    {
        $a = $this->article();
        Http::fake(['https://photos.example.org/big.jpg' => Http::response($this->photo(1600, 1000), 200), 'https://photos.example.org/small.jpg' => Http::response($this->photo(800, 400), 200)]);
        $meta = ['alt' => 'Gedung parlemen', 'credit' => 'Wikimedia', 'source_url' => 'https://commons.wikimedia.org/x', 'license' => 'CC BY-SA 4.0'];

        $this->postJson(self::API.'/articles/'.$a->id.'/image', $meta + ['image_url' => 'https://photos.example.org/small.jpg'], $this->key())->assertStatus(422);
        $this->postJson(self::API.'/articles/'.$a->id.'/image', $meta + ['image_url' => 'https://127.0.0.1/a.jpg'], $this->key())->assertStatus(422);
        $this->postJson(self::API.'/articles/'.$a->id.'/image', $meta + ['image_url' => 'http://photos.example.org/big.jpg'], $this->key())->assertStatus(422);
        $this->postJson(self::API.'/articles/'.$a->id.'/image', $meta + ['image_url' => 'https://photos.example.org/big.jpg'], $this->key())->assertOk()->assertJsonPath('article.image.license', 'CC BY-SA 4.0');
        $this->postJson(self::API.'/articles/'.$a->id.'/image', ['alt' => 'x'], $this->key())->assertStatus(422);
    }

    public function test_public_pages_are_cacheable_for_guests_without_cookies_but_not_with_a_session(): void
    {
        $a = $this->article();
        $res = $this->get(self::SITE.'/berita')->assertOk();
        $this->assertStringContainsString('s-maxage=300', $res->headers->get('Cache-Control'));
        $this->assertNotNull($res->headers->get('ETag'));
        $this->assertEmpty($res->headers->getCookies());
        $this->get(self::SITE.'/berita', ['If-None-Match' => $res->headers->get('ETag')])->assertStatus(304);
        $art = $this->get(self::SITE.'/berita/teknologi/'.$a->slug)->assertOk();
        $this->assertNotNull($art->headers->get('Last-Modified'));
        $this->assertEmpty($art->headers->getCookies());

        $this->withUnencryptedCookie(config('session.cookie'), 'x')->get(self::SITE.'/berita')->assertOk();
        $login = $this->get(self::SITE.'/masuk');
        $this->assertStringNotContainsString('s-maxage', (string) $login->headers->get('Cache-Control'));
    }

    public function test_feeds_sitemaps_robots_and_schema(): void
    {
        $a = $this->article();
        $this->get(self::SITE.'/berita/rss.xml')->assertOk()->assertSee('<rss', false)->assertSee($a->slug, false)->assertSee('gambar-berita/'.$a->id.'-1200.webp', false);
        $this->get(self::SITE.'/news-sitemap.xml')->assertOk()->assertSee('news:publication_date', false)->assertSee('<news:title>Artikel uji untuk gambar dan feed</news:title>', false);
        $old = $this->article(['slug' => 'lama-sekali', 'published_at' => now()->subDays(5)]);
        $this->get(self::SITE.'/news-sitemap.xml')->assertDontSee('lama-sekali', false);
        $this->get(self::SITE.'/robots.txt')->assertSee('news-sitemap.xml', false);

        $sm = $this->get(self::SITE.'/sitemap.xml')->assertOk()->getContent();
        $this->assertStringContainsString('<loc>https://jadidaring.test/tentang</loc>', $sm);
        $this->assertMatchesRegularExpression('#'.preg_quote($a->slug, '#').'</loc><lastmod>'.$a->updated_at->format('Y-m-d').'#', $sm);

        $home = $this->get(self::SITE.'/')->assertOk();
        $home->assertSee('SearchAction', false)->assertSee('"Organization"', false)->assertSee('application/rss+xml', false);
        $this->get(self::SITE.'/berita?q=uji')->assertOk()->assertSee('noindex', false)->assertSee($a->slug, false);
        $this->get(self::SITE.'/berita/teknologi/'.$a->slug)->assertSee('"author"', false)->assertSee('Redaksi Jaring', false)->assertSee('logo-512.png', false);
    }

    public function test_static_pages_and_contact_form(): void
    {
        foreach (['/tentang', '/kebijakan-redaksi', '/kebijakan-privasi', '/kontak'] as $p) {
            $this->get(self::SITE.$p)->assertOk();
        }
        $this->get(self::SITE.'/')->assertSee('/kebijakan-privasi', false)->assertSee('/kontak', false);

        $t = time() - 10;
        $this->post(self::SITE.'/kontak', ['name' => 'Rina', 'subject' => 'Koreksi berita', 'message' => 'Ada kesalahan angka di artikel tertentu.', 't' => $t])->assertRedirect('/kontak');
        $this->assertSame(1, ContactMessage::count());
        $this->post(self::SITE.'/kontak', ['name' => 'Bot', 'subject' => 'Spam spam', 'message' => 'Pesan spam dari bot nih.', 't' => $t, 'website' => 'http://spam'])->assertRedirect('/kontak');
        $this->post(self::SITE.'/kontak', ['name' => 'Cepat', 'subject' => 'Terlalu cepat', 'message' => 'Dikirim kurang dari tiga detik.', 't' => time()])->assertRedirect('/kontak');
        $this->assertSame(1, ContactMessage::count());
        $this->post(self::SITE.'/kontak', ['name' => 'R', 'subject' => 'x', 'message' => 'pendek', 't' => $t])->assertSessionHasErrors(['name', 'subject', 'message']);
    }

    public function test_hsts_https_redirect_and_old_gamehub_host(): void
    {
        $this->get(self::SITE.'/berita', ['X-Forwarded-Proto' => 'https'])->assertHeader('Strict-Transport-Security', 'max-age=31536000');
        $this->get('http://gamehub.jadidaring.test/apa-saja')->assertStatus(301)->assertRedirect('https://jadidaring.test/game');
    }

    public function test_card_generation_handles_long_titles(): void
    {
        $a = $this->article(['title' => str_repeat('Judul sangat panjang sekali ', 12)]);
        $this->assertFileExists(NewsImage::file($a, 480));
    }

    public function test_home_has_branded_og_image_and_large_twitter_card(): void
    {
        $html = $this->get(self::SITE.'/')->assertOk()->getContent();
        $this->assertStringContainsString('og:image" content="https://jadidaring.test/og-home-v2.webp?v=2"', $html);
        $this->assertStringContainsString('og:image:type" content="image/webp"', $html);
        $this->assertSame([1200, 630], array_slice(getimagesize(public_path('og-home-v2.webp')), 0, 2));
        $this->assertStringContainsString('twitter:card" content="summary_large_image"', $html);
        $r = $this->get(self::SITE.'/og-home.webp')->assertOk();
        $this->assertSame('image/webp', $r->headers->get('Content-Type'));
        $this->assertSame([1200, 630], array_slice(getimagesize($r->baseResponse->getFile()->getPathname()), 0, 2));
    }

    public function test_www_redirect_sets_no_cookies_and_gamehub_keeps_query(): void
    {
        $r = $this->get('http://www.jadidaring.test/berita?x=1')->assertStatus(301);
        $this->assertSame([], $r->headers->getCookies());
        $this->get('http://gamehub.jadidaring.test/nope?a=b')->assertRedirect('https://jadidaring.test/game?a=b');
    }

    public function test_game_html_normalizer_sets_lang_and_slashless_canonical(): void
    {
        $i = new \App\Services\SeoInjector();
        $out = $i->normalizeGame('<html lang="en"><head><link rel="canonical" href="https://jadidaring.com/game/x/"></head>');
        $this->assertStringContainsString('<html lang="id">', $out);
        $this->assertStringContainsString('href="https://jadidaring.com/game/x"', $out);
        $this->assertStringContainsString('<html class="a" lang="id">', $i->normalizeGame('<html class="a"><head></head>'));
    }

    public function test_old_subdomains_redirect_by_allowlist_without_cookies(): void
    {
        foreach (config('old_subdomains') as $sub => $path) {
            $r = $this->get('http://'.$sub.'.jadidaring.test/x?a=b')->assertStatus(301);
            $this->assertSame('https://jadidaring.test'.$path.'?a=b', $r->headers->get('Location'));
            $this->assertSame([], $r->headers->getCookies());
        }

        $this->assertSame('/demo3/', config('old_subdomains.demo3'));
        $this->assertSame('/game/coratcoret', config('old_subdomains.drawguess'));

        foreach (['rapiin', 'pinball', 'admin', 'invoiceku', 'api', 'mail', 'random'] as $sub) {
            $this->assertArrayNotHasKey($sub, config('old_subdomains'));
        }

        $this->get('http://rapiin.jadidaring.test/')->assertNotFound();
    }
}

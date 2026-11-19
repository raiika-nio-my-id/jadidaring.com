<?php

namespace Tests\Feature;

use App\Models\Article;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class FaviconTest extends TestCase
{
    use RefreshDatabase;

    private const LINKS = [
        '<link rel="icon" href="/favicon.ico?v=2" sizes="48x48">',
        '<link rel="icon" href="/favicon.svg?v=2" type="image/svg+xml" sizes="any">',
        '<link rel="icon" href="/favicon-96x96.png?v=2" type="image/png" sizes="96x96">',
        '<link rel="icon" href="/favicon-48x48.png?v=2" type="image/png" sizes="48x48">',
        '<link rel="apple-touch-icon" href="/apple-touch-icon.png?v=2" sizes="180x180">',
        '<link rel="manifest" href="/site.webmanifest">',
    ];

    public function test_public_pages_including_news_articles_carry_the_icon_links(): void
    {
        Article::query()->create(['topic' => 'politik', 'slug' => 'uji-ikon', 'title' => 'Uji', 'summary' => 's', 'body' => 'b', 'sources' => [], 'status' => 'published', 'published_at' => now()->subHour()]);

        foreach (['/', '/game', '/berita', '/berita/politik', '/berita/politik/uji-ikon', '/komunitas'] as $path) {
            $html = $this->get('http://jadidaring.test'.$path)->assertOk()->getContent();
            foreach (self::LINKS as $link) {
                $this->assertStringContainsString($link, $html, "$path missing $link");
            }
        }
    }

    public function test_icon_files_are_square_multiples_of_48_and_ico_has_16_32_48(): void
    {
        foreach ([48, 96, 192, 512] as $size) {
            $file = $size >= 192 ? "web-app-manifest-{$size}x{$size}.png" : "favicon-{$size}x{$size}.png";
            $this->assertSame([$size, $size], array_slice(getimagesize(public_path($file)), 0, 2), $file);
        }

        $ico = (string) file_get_contents(public_path('favicon.ico'));
        $count = unpack('v', substr($ico, 4, 2))[1];
        $sizes = [];
        for ($i = 0; $i < $count; $i++) {
            $sizes[] = ord($ico[6 + $i * 16]);
        }
        sort($sizes);
        $this->assertSame([16, 32, 48], $sizes);
        $this->assertFileExists(public_path('apple-touch-icon.png'));
    }

    public function test_manifest_is_valid_json_with_existing_icons_and_robots_does_not_block_icons(): void
    {
        $manifest = json_decode((string) file_get_contents(public_path('site.webmanifest')), true, flags: JSON_THROW_ON_ERROR);
        $this->assertNotEmpty($manifest['icons']);
        foreach ($manifest['icons'] as $icon) {
            $this->assertFileExists(public_path(ltrim(strtok($icon["src"], "?"), "/")));
        }

        $robots = $this->get('http://jadidaring.test/robots.txt')->assertOk()->getContent();
        $this->assertStringContainsString("Allow: /\n", $robots);
        $this->assertDoesNotMatchRegularExpression('#Disallow:\s*/(favicon|site\.webmanifest|apple-touch|web-app)#', $robots);
        $this->assertDoesNotMatchRegularExpression('#Disallow:\s*/\s*$#m', $robots);
    }
}

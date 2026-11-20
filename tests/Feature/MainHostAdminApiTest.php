<?php

namespace Tests\Feature;

use App\Models\Article;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/** The admin API (used by the news publisher) works on the main host, behind the same key. */
class MainHostAdminApiTest extends TestCase
{
    use RefreshDatabase;

    private const API = 'http://jadidaring.test/api/admin/news';

    /** @return array<string, string> */
    private function key(): array
    {
        return ['X-Admin-Api-Key' => 'testing-admin-api-secret'];
    }

    public function test_main_host_admin_api_requires_the_key(): void
    {
        $this->getJson(self::API.'/articles')->assertUnauthorized();
        $this->getJson(self::API.'/articles', ['X-Admin-Api-Key' => 'nope'])->assertUnauthorized();
        $this->postJson(self::API.'/articles', ['title' => 'x'])->assertUnauthorized();
        $this->assertSame(0, Article::query()->count());
    }

    public function test_main_host_admin_api_lists_and_creates_articles_with_the_key(): void
    {
        $this->getJson(self::API.'/topics', $this->key())->assertOk()->assertJsonFragment(['slug' => 'teknologi']);

        $created = $this->postJson(self::API.'/articles', [
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
        ], $this->key())->assertCreated();

        $list = $this->getJson(self::API.'/articles', $this->key())->assertOk();
        $this->assertStringNotContainsString('public', (string) $list->headers->get('Cache-Control'));
        $this->assertSame(1, Article::query()->count());
        $this->assertNotNull($created->json());
    }

    public function test_unknown_admin_api_path_on_main_host_is_still_json_404_with_key(): void
    {
        $this->getJson('http://jadidaring.test/api/admin/nope', $this->key())->assertNotFound();
    }
}

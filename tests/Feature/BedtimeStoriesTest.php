<?php

namespace Tests\Feature;

use App\Models\AdminAuditLog;
use App\Models\BedtimeStory;
use App\Models\User;
use App\Services\Admin\AdminBackup;
use App\Services\BedtimeCache;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\File;
use Tests\TestCase;

class BedtimeStoriesTest extends TestCase
{
    use RefreshDatabase;

    private const SITE = 'http://jadidaring.test';

    private const API = 'http://jadidaring.test/api/admin/bedtime-stories';

    protected function tearDown(): void
    {
        File::deleteDirectory(AdminBackup::dir());
        File::deleteDirectory(storage_path('app/bedtime-img'));
        parent::tearDown();
    }

    /** @return array<string, string> */
    private function key(): array
    {
        return ['X-Admin-Api-Key' => 'testing-admin-api-secret'];
    }

    private function admin(): User
    {
        return User::factory()->admin()->create(['email' => 'admin@example.test']);
    }

    private function member(): User
    {
        return User::factory()->member()->create(['username' => 'ceritauser']);
    }

    public function test_seed_migration_inserts_the_nine_stories(): void
    {
        $path = database_path('data/bedtime-stories-seed.json');
        $this->assertFileExists($path);

        $seedData = json_decode((string) file_get_contents($path), true);
        $this->assertCount(9, $seedData);

        $slugs = array_column($seedData, 'slug');
        $count = BedtimeStory::query()->whereIn('slug', $slugs)->where('status', 'published')->count();
        $this->assertSame(9, $count);

        $story = BedtimeStory::query()->where('slug', 'the-lion-and-the-mouse')->firstOrFail();
        $this->assertSame('Aesop', $story->author);
        $this->assertSame('Yunani kuno', $story->author_origin);
        $this->assertSame('Dongeng Anak Kecil', $story->adapter);
        $this->assertSame('en', $story->language);
        $this->assertNotEmpty($story->moral);
        $this->assertNotNull($story->published_at);
        $this->assertTrue($story->published_at->isPast());
    }

    public function test_public_index_renders_with_stories_nav_and_json_ld(): void
    {
        $res = $this->get(self::SITE.'/bed-time-stories')->assertOk();
        $res->assertSee('Bed Time Stories');
        $res->assertSee('Dongeng klasik pengantar tidur dari penulis aslinya, diceritakan ulang oleh Dongeng Anak Kecil.');
        $res->assertSee('The Lion and the Mouse');
        $res->assertSee('oleh <strong>Aesop</strong>', false);
        $res->assertSee('aria-current="page"', false);
        $res->assertSee('<link rel="canonical" href="https://jadidaring.test/bed-time-stories">', false);

        // Check footer link
        $res->assertSee('<a href="/bed-time-stories">Bed Time Stories</a>', false);

        // Check JSON-LD CollectionPage
        $html = $res->getContent();
        preg_match_all('#<script type="application/ld\+json">(.*?)</script>#s', $html, $matches);
        $this->assertNotEmpty($matches[1]);

        $foundCollection = false;
        foreach ($matches[1] as $raw) {
            $j = json_decode($raw, true);
            if (is_array($j) && ($j['@type'] ?? null) === 'CollectionPage') {
                $foundCollection = true;
                $this->assertSame('https://schema.org', $j['@context']);
                $this->assertSame('Bed Time Stories', $j['name']);
                $this->assertArrayHasKey('itemListElement', $j['mainEntity']);
            }
        }
        $this->assertTrue($foundCollection, 'CollectionPage JSON-LD not found');
    }

    public function test_public_show_renders_author_credit_moral_and_body_paragraphs(): void
    {
        $res = $this->get(self::SITE.'/bed-time-stories/the-lion-and-the-mouse')->assertOk();
        $res->assertSee('The Lion and the Mouse');
        $res->assertSee('Penulis:</strong> Aesop (Yunani kuno)', false);
        $res->assertSee('Diceritakan ulang oleh:</strong> Dongeng Anak Kecil', false);
        $res->assertSee('Pesan moral');
        $res->assertSee('No act of kindness is ever wasted');
        $res->assertSee('<p lang="en">', false);
        $res->assertSee('Kembali ke Bed Time Stories');

        // Check JSON-LD
        $html = $res->getContent();
        preg_match_all('#<script type="application/ld\+json">(.*?)</script>#s', $html, $matches);
        $this->assertNotEmpty($matches[1]);

        $foundCreative = false;
        foreach ($matches[1] as $raw) {
            $j = json_decode($raw, true);
            if (is_array($j) && ($j['@type'] ?? null) === 'CreativeWork') {
                $foundCreative = true;
                $this->assertSame('https://schema.org', $j['@context']);
                $this->assertSame('The Lion and the Mouse', $j['name']);
                $this->assertSame('Aesop', $j['author']['name'] ?? null);
                $this->assertStringContainsString('Dongeng Anak Kecil', $j['creditText'] ?? '');
            }
        }
        $this->assertTrue($foundCreative, 'CreativeWork JSON-LD not found');
    }

    public function test_show_links_to_the_previous_and_next_story_by_date(): void
    {
        $res = $this->get(self::SITE.'/bed-time-stories/the-ugly-duckling')->assertOk();

        $res->assertSee('href="/bed-time-stories/the-lion-and-the-mouse"', false);
        $res->assertSee('href="/bed-time-stories/the-tortoise-and-the-hare"', false);
        $this->assertStringNotContainsString('&larr; The Ugly Duckling', (string) $res->getContent());
    }

    public function test_draft_and_future_stories_return_404(): void
    {
        $draft = BedtimeStory::factory()->draft()->create(['slug' => 'draft-story']);
        $this->get(self::SITE.'/bed-time-stories/'.$draft->slug)->assertNotFound();

        $future = BedtimeStory::factory()->create([
            'slug' => 'future-story',
            'status' => 'published',
            'published_at' => now()->addDays(5),
        ]);
        $this->get(self::SITE.'/bed-time-stories/'.$future->slug)->assertNotFound();
    }

    public function test_title_card_image_route_serves_valid_webp(): void
    {
        $story = BedtimeStory::query()->where('slug', 'the-lion-and-the-mouse')->firstOrFail();

        $res = $this->get(self::SITE.'/bedtime-stories/'.$story->id.'-480.webp')->assertOk();
        $res->assertHeader('Content-Type', 'image/webp');
        $this->assertStringContainsString('public', (string) $res->headers->get('Cache-Control'));
    }

    public function test_infinite_scroll_fragment_and_cap(): void
    {
        // Seed extra stories so total > 12 (12 per page)
        for ($i = 1; $i <= 10; $i++) {
            BedtimeStory::factory()->published()->create([
                'slug' => 'extra-story-'.$i,
                'title' => 'Extra Story '.$i,
            ]);
        }
        BedtimeCache::bump();

        // Total stories = 9 + 10 = 19 -> 2 pages
        $p1 = $this->get(self::SITE.'/bed-time-stories')->assertOk();
        $p1->assertSee('data-jd-inf', false);
        $p1->assertSee('rel="next" href="/bed-time-stories?page=2"', false);

        // Fragment ?partial=1
        $frag = $this->get(self::SITE.'/bed-time-stories?page=2&partial=1')->assertOk();
        $frag->assertHeader('X-Robots-Tag', 'noindex');
        $this->assertStringNotContainsString('<html', $frag->getContent());
        $this->assertStringNotContainsString('clay-header', $frag->getContent());

        // Out of range page 3
        $this->get(self::SITE.'/bed-time-stories?page=3')->assertNotFound();
        $this->get(self::SITE.'/bed-time-stories?page=invalid')->assertNotFound();
    }

    public function test_sitemap_includes_bedtime_stories_and_index(): void
    {
        $res = $this->get(self::SITE.'/sitemap.xml')->assertOk();
        $content = $res->getContent();
        $this->assertStringContainsString('https://jadidaring.test/bed-time-stories</loc>', $content);
        $this->assertStringContainsString('https://jadidaring.test/bed-time-stories/the-lion-and-the-mouse</loc>', $content);
    }

    public function test_admin_panel_guards_guests_and_members(): void
    {
        $this->get(self::SITE.'/admin/bedtime-stories')->assertRedirectContains('/admin/masuk');
        $this->get(self::SITE.'/admin/bedtime-stories/tulis')->assertRedirectContains('/admin/masuk');

        $member = $this->member();
        $this->actingAs($member)->get(self::SITE.'/admin/bedtime-stories')->assertForbidden();
        $this->actingAs($member)->get(self::SITE.'/admin/bedtime-stories/tulis')->assertForbidden();
    }

    public function test_admin_panel_crud_operations(): void
    {
        $admin = $this->admin();

        // Index
        $this->actingAs($admin)->get(self::SITE.'/admin/bedtime-stories')
            ->assertOk()
            ->assertSee('Bed Time Stories')
            ->assertSee('Tulis cerita');

        // Create
        $res = $this->actingAs($admin)->post(self::SITE.'/admin/bedtime-stories', [
            'title' => 'Kelinci dan Kura-kura Versi Indonesia',
            'author' => 'Aesop',
            'author_origin' => 'Yunani kuno',
            'adapter' => 'Dongeng Anak Kecil',
            'language' => 'id',
            'body' => "Di sebuah hutan yang lebat, hiduplah seekor kelinci yang sombong.\n\nKura-kura yang bijaksana menantangnya berlomba.",
            'moral' => 'Kesombongan membawa kekalahan.',
            'status' => 'published',
        ]);

        $story = BedtimeStory::query()->where('title', 'Kelinci dan Kura-kura Versi Indonesia')->firstOrFail();
        $res->assertRedirect(route('panel.bedtime.edit', $story->id));
        $this->assertSame('id', $story->language);
        $this->assertSame('published', $story->status);

        // Edit page
        $this->actingAs($admin)->get(self::SITE.'/admin/bedtime-stories/'.$story->id)->assertOk();

        // Update
        $this->actingAs($admin)->put(self::SITE.'/admin/bedtime-stories/'.$story->id, [
            'title' => 'Kelinci dan Kura-kura Versi Baru',
            'slug' => $story->slug,
            'author' => 'Aesop',
            'author_origin' => 'Yunani kuno',
            'adapter' => 'Dongeng Anak Kecil',
            'language' => 'id',
            'body' => "Di sebuah hutan yang lebat, hiduplah seekor kelinci yang sombong.\n\nKura-kura yang bijaksana menantangnya berlomba.",
            'moral' => 'Kerendahan hati dan ketekunan berbuah manis.',
            'status' => 'published',
        ])->assertRedirect(route('panel.bedtime.edit', $story->id));

        $this->assertSame('Kelinci dan Kura-kura Versi Baru', $story->fresh()->title);

        // Status toggle to draft
        $this->actingAs($admin)->post(self::SITE.'/admin/bedtime-stories/'.$story->id.'/status', [
            'status' => 'draft',
        ])->assertRedirect();
        $this->assertSame('draft', $story->fresh()->status);

        // Delete with confirmation
        $this->actingAs($admin)->delete(self::SITE.'/admin/bedtime-stories/'.$story->id, [
            'confirm' => 'SALAH',
        ])->assertSessionHasErrors('confirm');
        $this->assertNotNull(BedtimeStory::query()->find($story->id));

        $this->actingAs($admin)->delete(self::SITE.'/admin/bedtime-stories/'.$story->id, [
            'confirm' => 'HAPUS',
        ])->assertRedirect(route('panel.bedtime'));
        $this->assertNull(BedtimeStory::query()->find($story->id));

        // Verify backup and audit log
        $this->assertNotEmpty(glob(AdminBackup::dir().'/bedtime-story-'.$story->id.'-*.json'));
        $this->assertGreaterThanOrEqual(1, AdminAuditLog::query()->where('action', 'bedtime.delete')->count());
    }

    public function test_admin_api_requires_key(): void
    {
        $this->getJson(self::API)->assertUnauthorized();
        $this->getJson(self::API, ['X-Admin-Api-Key' => 'wrong'])->assertUnauthorized();
        $this->postJson(self::API, ['title' => 'Test'])->assertUnauthorized();
    }

    public function test_admin_api_create_idempotent_and_patch_and_delete(): void
    {
        // 1. Create new story (201, existing: false)
        $payload = [
            'title' => 'The Fox and the Stork',
            'slug' => 'the-fox-and-the-stork',
            'author' => 'Aesop',
            'author_origin' => 'Yunani kuno',
            'adapter' => 'Dongeng Anak Kecil',
            'language' => 'en',
            'summary' => 'A sly fox invites a stork to dinner and plays a trick on her.',
            'body' => "Once a fox invited a stork to dinner.\n\nHe served the soup in a shallow dish which the stork could not eat with her long beak.",
            'moral' => 'One bad turn deserves another, but treat others as you would like to be treated.',
            'status' => 'published',
        ];

        $res1 = $this->postJson(self::API, $payload, $this->key())->assertCreated();
        $this->assertFalse($res1->json('existing'));
        $storyId = $res1->json('story.id');
        $this->assertNotNull($storyId);

        // 2. IDEMPOTENT on same slug (200, existing: true)
        $res2 = $this->postJson(self::API, $payload, $this->key())->assertOk();
        $this->assertTrue($res2->json('existing'));
        $this->assertSame($storyId, $res2->json('story.id'));

        // 3. GET list
        $list = $this->getJson(self::API.'?q=stork', $this->key())->assertOk();
        $this->assertCount(1, $list->json('stories'));

        // 4. PATCH update
        $patchRes = $this->patchJson(self::API.'/'.$storyId, [
            'title' => 'The Fox and the Clever Stork',
            'moral' => 'Kindness is repaid with kindness.',
        ], $this->key())->assertOk();
        $this->assertSame('The Fox and the Clever Stork', $patchRes->json('story.title'));

        // 5. DELETE
        $this->deleteJson(self::API.'/'.$storyId, [], $this->key())->assertOk();
        $this->assertNull(BedtimeStory::query()->find($storyId));
    }

    public function test_admin_api_validations_and_html_rejection(): void
    {
        // Missing required fields
        $this->postJson(self::API, [], $this->key())->assertStatus(422);

        // Reject HTML in body
        $res = $this->postJson(self::API, [
            'title' => 'Story with HTML',
            'author' => 'Author',
            'body' => 'This body has <script>alert("xss")</script> inside.',
        ], $this->key())->assertStatus(422);
        $this->assertStringContainsString('HTML', (string) $res->json('message'));

        // Image URL without credit
        $resImg = $this->postJson(self::API, [
            'title' => 'Story with image but no credit',
            'author' => 'Author',
            'body' => 'Valid plain text body without any HTML tags.',
            'image_url' => 'https://example.com/photo.jpg',
        ], $this->key())->assertStatus(422);
        $this->assertArrayHasKey('image_credit', (array) $resImg->json('errors'));
    }
}

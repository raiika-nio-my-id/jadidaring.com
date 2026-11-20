<?php

namespace Tests\Feature;

use App\Models\Article;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Tests\TestCase;

class AdminNewsCreateTest extends TestCase
{
    use RefreshDatabase;

    private const H = 'http://jadidaring.test';

    private function payload(array $o = []): array
    {
        return $o + [
            'title' => 'UMR Bali 2027 resmi naik, ini rinciannya',
            'topic' => 'ekonomi',
            'summary' => 'Pemerintah Provinsi Bali menetapkan UMP 2027 naik, berikut angka dan alasannya.',
            'body' => "Poin penting\n- UMP naik\n- Berlaku Januari\n\n## Rincian kenaikan\n\n".str_repeat('Kenaikan **upah minimum** ini dibahas dewan pengupahan. ', 6),
            'sources_text' => "Antara | https://www.antaranews.com/berita/1\nhttps://www.kompas.com/umr-bali",
            'status' => 'published',
        ];
    }

    public function test_tulis_berita_button_form_and_guards(): void
    {
        $this->get(self::H.'/admin/berita/tulis')->assertRedirectContains('/admin/masuk');
        $this->actingAs(User::factory()->member()->create())->post(self::H.'/admin/berita', $this->payload())->assertForbidden();

        $this->actingAs(User::factory()->admin()->create());
        $this->get(self::H.'/admin/berita')->assertOk()->assertSee('Tulis berita');
        $this->get(self::H.'/admin/berita/tulis')->assertOk()->assertSee('Ekonomi')->assertSee('## Subjudul')->assertSee('Tebal')
            ->assertSee('name="sources_text"', false)->assertSee('name="image"', false)->assertSee('Draft')->assertSee('Terbit');
        $this->assertSame(0, Article::query()->count());
    }

    public function test_admin_publishes_with_slug_from_title_and_title_card(): void
    {
        $this->actingAs(User::factory()->admin()->create());
        $res = $this->post(self::H.'/admin/berita', $this->payload());
        $a = Article::query()->firstOrFail();
        $res->assertRedirect(route('panel.news.edit', $a->id));

        $this->assertSame(['ekonomi', 'umr-bali-2027-resmi-naik-ini-rinciannya', 'published'], [$a->topic, $a->slug, $a->status]);
        $this->assertCount(2, $a->sources);
        $this->assertSame('Antara', $a->sources[0]['title']);
        $this->assertNull($a->image_path);
        $this->get(self::H.'/berita/ekonomi/'.$a->slug)->assertOk()->assertSee('<strong>upah minimum</strong>', false)->assertSee('Rincian kenaikan');
        $this->get(self::H.'/gambar-berita/'.$a->id.'-480.webp')->assertOk(); // branded title card
    }

    public function test_shared_validation_sources_draft_and_free_licensed_photo(): void
    {
        $this->actingAs(User::factory()->admin()->create());

        $this->post(self::H.'/admin/berita', $this->payload(['sources_text' => 'https://www.kompas.com/a']))->assertSessionHasErrors('sources');
        $this->post(self::H.'/admin/berita', $this->payload(['sources_text' => "https://www.kompas.com/a\nhttps://kompas.com/b"]))->assertSessionHasErrors('sources'); // same domain
        $this->post(self::H.'/admin/berita', $this->payload(['title' => 'pendek']))->assertSessionHasErrors('title');
        $this->post(self::H.'/admin/berita', $this->payload(['topic' => 'tidak-ada']))->assertSessionHasErrors('topic');

        $img = UploadedFile::fake()->image('foto.jpg', 1200, 630);
        $this->post(self::H.'/admin/berita', $this->payload(['image' => $img]))->assertSessionHasErrors(['image_alt', 'image_credit', 'image_license']);
        $this->post(self::H.'/admin/berita', $this->payload(['image' => UploadedFile::fake()->image('foto.jpg', 1200, 630), 'image_alt' => 'Pekerja di Denpasar', 'image_credit' => 'Foto: Budi', 'image_license' => 'Hak cipta Getty', 'image_source_url' => 'https://x.example/f']))->assertSessionHasErrors('image_license');
        $this->post(self::H.'/admin/berita', $this->payload(['image' => UploadedFile::fake()->image('kecil.jpg', 600, 400), 'image_alt' => 'Pekerja di Denpasar', 'image_credit' => 'Foto: Budi', 'image_license' => 'CC0', 'image_source_url' => 'https://x.example/f']))->assertSessionHasErrors('image');
        $this->assertSame(0, Article::query()->count());

        $this->post(self::H.'/admin/berita', $this->payload(['status' => 'draft', 'image' => UploadedFile::fake()->image('foto.jpg', 1200, 630), 'image_alt' => 'Pekerja di Denpasar', 'image_credit' => 'Foto: Budi', 'image_license' => 'Foto sendiri (Jadidaring)']))->assertRedirect();
        $a = Article::query()->firstOrFail();
        $this->assertSame('draft', $a->status);
        $this->assertNull($a->published_at);
        $this->assertNotNull($a->image_path);
        $this->assertSame('Foto: Budi', $a->image_credit);
        $this->get(self::H.'/berita/ekonomi/'.$a->slug)->assertNotFound();
    }
}

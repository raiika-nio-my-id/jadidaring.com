<?php

namespace Tests\Feature;

use App\Models\Article;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Tests\TestCase;

class WitaDisplayTimeTest extends TestCase
{
    use RefreshDatabase;

    public function test_macro_formats_utc_as_wita(): void
    {
        $d = Carbon::parse('2026-11-19 07:52:00', 'UTC');
        $this->assertSame('19 Nov 2026, 15.52 WITA', $d->wita());
        $this->assertSame('Kamis, 19 Nov 2026, 15.52 WITA', $d->wita(true));
        $this->assertSame('UTC', $d->timezone->getName());
    }

    public function test_article_shows_wita_but_machine_values_keep_offset(): void
    {
        $a = Article::create(['topic' => 'teknologi', 'slug' => 'tes-wita', 'title' => 'Tes WITA', 'summary' => 's', 'body' => str_repeat('x ', 80),
            'sources' => [], 'status' => 'published', 'published_at' => '2026-11-19 07:52:00']);
        foreach ([$a->url(), '/berita'] as $path) {
            $html = $this->get('http://jadidaring.test'.$path)->assertOk()->getContent();
            $this->assertStringContainsString('15.52 WITA', $html);
            $this->assertStringNotContainsString('07.52 WITA', $html);
            $this->assertMatchesRegularExpression('/datetime="2026-11-19T07:52:00\+00:00"/', $html);
        }
    }
}

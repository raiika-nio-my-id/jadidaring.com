<?php

use Carbon\Carbon;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Str;

return new class extends Migration
{
    public function up(): void
    {
        $path = database_path('data/bedtime-stories-seed.json');

        if (! File::exists($path)) {
            return;
        }

        $items = json_decode((string) File::get($path), true);

        if (! is_array($items)) {
            return;
        }

        $now = now();
        $appTz = (string) config('app.timezone', 'UTC');

        foreach ($items as $item) {
            if (empty($item['slug'])) {
                continue;
            }

            $exists = DB::table('bedtime_stories')->where('slug', $item['slug'])->exists();

            if ($exists) {
                continue;
            }

            $publishedAt = null;

            if (! empty($item['published_at'])) {
                $publishedAt = Carbon::createFromFormat('Y-m-d H:i:s', $item['published_at'], 'Asia/Makassar')
                    ->setTimezone($appTz);
            }

            $summary = $item['summary'] ?? null;

            if ($summary === null || trim((string) $summary) === '') {
                $clean = preg_replace('/\s+/', ' ', trim(strip_tags((string) ($item['body'] ?? ''))));
                $summary = Str::limit((string) $clean, 160, '…');
            }

            DB::table('bedtime_stories')->insert([
                'title' => (string) ($item['title'] ?? ''),
                'slug' => (string) $item['slug'],
                'author' => (string) ($item['author'] ?? ''),
                'author_origin' => $item['author_origin'] ?? null,
                'adapter' => $item['adapter'] ?? 'Dongeng Anak Kecil',
                'language' => (string) ($item['language'] ?? 'en'),
                'summary' => $summary,
                'body' => (string) ($item['body'] ?? ''),
                'moral' => $item['moral'] ?? null,
                'image_url' => null,
                'image_path' => null,
                'image_alt' => null,
                'image_credit' => null,
                'image_source_url' => null,
                'image_license' => null,
                'image_updated_at' => null,
                'status' => 'published',
                'published_at' => $publishedAt,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }
    }

    public function down(): void
    {
        $path = database_path('data/bedtime-stories-seed.json');

        if (! File::exists($path)) {
            return;
        }

        $items = json_decode((string) File::get($path), true);

        if (! is_array($items)) {
            return;
        }

        $slugs = array_filter(array_column($items, 'slug'));

        if ($slugs !== []) {
            DB::table('bedtime_stories')->whereIn('slug', $slugs)->delete();
        }
    }
};

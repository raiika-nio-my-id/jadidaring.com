<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $now = now();

        DB::table('news_topics')->insertOrIgnore([
            'slug' => 'sosmed', 'name' => 'Tren Sosial Media', 'enabled' => true,
            'articles_per_day' => 4, 'min_sources' => 2,
            'created_at' => $now, 'updated_at' => $now,
        ]);
    }

    public function down(): void
    {
        DB::table('news_topics')->where('slug', 'sosmed')->delete();
    }
};

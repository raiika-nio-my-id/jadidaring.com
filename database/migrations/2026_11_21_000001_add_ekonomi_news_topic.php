<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // Wages (UMR/UMP), staple & fuel prices, tax, inflation, jobs. Stock market stays under "saham".
        $politik = DB::table('news_topics')->where('slug', 'politik')->first();
        $now = now();

        DB::table('news_topics')->insertOrIgnore([
            'slug' => 'ekonomi', 'name' => 'Ekonomi', 'enabled' => true,
            'articles_per_day' => (int) ($politik->articles_per_day ?? 4),
            'min_sources' => (int) ($politik->min_sources ?? 2),
            'created_at' => $now, 'updated_at' => $now,
        ]);
    }

    public function down(): void
    {
        DB::table('news_topics')->where('slug', 'ekonomi')->delete();
    }
};

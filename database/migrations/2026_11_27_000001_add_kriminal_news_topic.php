<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // Crime & law: bullying, violence, fraud, corruption cases, court rulings. Disasters stay under "musibah".
        $politik = DB::table('news_topics')->where('slug', 'politik')->first();
        $now = now();

        DB::table('news_topics')->insertOrIgnore([
            'slug' => 'kriminal', 'name' => 'Kriminal & Hukum', 'enabled' => true,
            'articles_per_day' => (int) ($politik->articles_per_day ?? 0),
            'min_sources' => 2,
            'created_at' => $now, 'updated_at' => $now,
        ]);
    }

    public function down(): void
    {
        DB::table('news_topics')->where('slug', 'kriminal')->delete();
    }
};

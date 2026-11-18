<?php

use App\Models\Article;
use App\Services\NewsSlug;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('article_slug_redirects', function (Blueprint $table): void {
            $table->string('old_slug', 120)->primary();
            $table->foreignId('article_id')->constrained()->cascadeOnDelete();
            $table->timestamp('created_at')->nullable();
        });

        // Repair slugs that an earlier hard 80-char cut left mid-word or with a trailing dash.
        Article::query()->orderBy('id')->each(function (Article $article): void {
            $current = $article->slug;

            if (strlen($current) < NewsSlug::MAX - 2 && ! str_ends_with($current, '-')) {
                return;
            }

            $fixed = NewsSlug::unique($article->title, $article->id);

            if ($fixed === $current) {
                return;
            }

            DB::table('article_slug_redirects')->insert(['old_slug' => $current, 'article_id' => $article->id, 'created_at' => now()]);
            $article->forceFill(['slug' => $fixed])->save();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('article_slug_redirects');
    }
};

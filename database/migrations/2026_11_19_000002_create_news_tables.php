<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('news_topics', function (Blueprint $table): void {
            $table->string('slug', 32)->primary();
            $table->string('name', 64);
            $table->boolean('enabled')->default(true);
            $table->unsignedSmallInteger('articles_per_day')->default(3);
            $table->unsignedTinyInteger('min_sources')->default(2);
            $table->timestamps();
        });

        Schema::create('articles', function (Blueprint $table): void {
            $table->id();
            $table->string('topic', 32)->index();
            $table->string('slug', 120)->unique();
            $table->string('title', 200);
            $table->string('summary', 400);
            $table->longText('body');
            $table->string('image_url', 500)->nullable();
            $table->json('sources');
            $table->string('status', 16)->default('draft');
            $table->timestamp('published_at')->nullable();
            $table->timestamps();

            $table->index(['status', 'published_at']);
            $table->index(['topic', 'status', 'published_at']);
        });

        Schema::create('article_comments', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('article_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('body', 1000);
            $table->boolean('is_hidden')->default(false);
            $table->timestamps();

            $table->index(['article_id', 'is_hidden', 'id']);
        });

        $now = now();
        $defaults = [
            ['politik', 'Politik', 4],
            ['gaming', 'Gaming', 4],
            ['saham', 'Saham & Emas', 4],
            ['indonesia', 'Kabar Baik Indonesia', 3],
            ['musibah', 'Bencana & Kecelakaan', 3],
            ['teknologi', 'Teknologi, AI & Keamanan', 5],
        ];

        foreach ($defaults as [$slug, $name, $rate]) {
            DB::table('news_topics')->insert([
                'slug' => $slug, 'name' => $name, 'enabled' => true,
                'articles_per_day' => $rate, 'min_sources' => 2,
                'created_at' => $now, 'updated_at' => $now,
            ]);
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('article_comments');
        Schema::dropIfExists('articles');
        Schema::dropIfExists('news_topics');
    }
};

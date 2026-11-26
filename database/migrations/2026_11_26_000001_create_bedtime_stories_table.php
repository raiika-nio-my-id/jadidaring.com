<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('bedtime_stories', function (Blueprint $table): void {
            $table->id();
            $table->string('title', 160);
            $table->string('slug', 160)->unique();
            $table->string('author', 120);
            $table->string('author_origin', 120)->nullable();
            $table->string('adapter', 120)->nullable();
            $table->string('language', 5)->default('en');
            $table->string('summary', 300)->nullable();
            $table->longText('body');
            $table->text('moral')->nullable();
            $table->string('image_url', 500)->nullable();
            $table->string('image_path', 120)->nullable();
            $table->string('image_alt', 200)->nullable();
            $table->string('image_credit', 200)->nullable();
            $table->string('image_source_url', 500)->nullable();
            $table->string('image_license', 100)->nullable();
            $table->timestamp('image_updated_at')->nullable();
            $table->string('status', 16)->default('draft');
            $table->timestamp('published_at')->nullable();
            $table->timestamps();

            $table->index(['status', 'published_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('bedtime_stories');
    }
};

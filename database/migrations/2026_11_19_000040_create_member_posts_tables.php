<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** Curhatan: short member posts with likes, comments and reports. Purely additive (new tables only). */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('member_posts', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('body', 2000); // ≤ 500 characters (multibyte-safe headroom)
            $table->string('image', 40)->nullable(); // {hash}.webp under storage/app/post-img/{user_id}/
            $table->string('visibility', 10)->default('public'); // public | followers | private
            $table->boolean('is_hidden')->default(false); // admin moderation / auto-hide on reports
            $table->unsignedInteger('likes_count')->default(0);
            $table->unsignedInteger('comments_count')->default(0);
            $table->unsignedSmallInteger('reports_count')->default(0);
            $table->timestamps();
            $table->index(['user_id', 'id']);
            $table->index(['visibility', 'is_hidden', 'id']);
        });

        Schema::create('member_post_likes', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('member_post_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->timestamp('created_at')->nullable();
            $table->unique(['member_post_id', 'user_id']);
        });

        Schema::create('member_post_comments', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('member_post_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('body', 1200);
            $table->boolean('is_hidden')->default(false);
            $table->unsignedSmallInteger('reports_count')->default(0);
            $table->timestamps();
            $table->index(['member_post_id', 'is_hidden', 'id']);
        });

        Schema::create('member_post_reports', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('member_post_id')->constrained()->cascadeOnDelete();
            $table->foreignId('member_post_comment_id')->nullable()->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('target', 24); // "p:{id}" or "c:{id}", one report per member per target
            $table->string('reason', 300)->nullable();
            $table->timestamp('created_at')->nullable();
            $table->unique(['user_id', 'target']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('member_post_reports');
        Schema::dropIfExists('member_post_comments');
        Schema::dropIfExists('member_post_likes');
        Schema::dropIfExists('member_posts');
    }
};

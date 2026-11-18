<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('member_pages', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('user_id')->unique()->constrained()->cascadeOnDelete();
            $table->string('title', 120);
            $table->mediumText('html');
            $table->string('status', 12)->default('published')->index(); // published | hidden
            $table->unsignedInteger('views')->default(0);
            $table->unsignedSmallInteger('reports_count')->default(0);
            $table->timestamps();
        });

        Schema::create('member_page_reports', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('member_page_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('reason', 300)->nullable();
            $table->timestamp('created_at')->nullable();
            $table->unique(['member_page_id', 'user_id']);
        });

        Schema::create('member_page_comments', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('member_page_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('body', 500);
            $table->boolean('is_hidden')->default(false);
            $table->unsignedSmallInteger('reports_count')->default(0);
            $table->timestamps();
            $table->index(['member_page_id', 'is_hidden', 'id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('member_page_comments');
        Schema::dropIfExists('member_page_reports');
        Schema::dropIfExists('member_pages');
    }
};

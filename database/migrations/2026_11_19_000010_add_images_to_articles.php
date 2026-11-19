<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('articles', function (Blueprint $table): void {
            // Self-hosted photo (null = the code-rendered title card is used).
            $table->string('image_path', 120)->nullable()->after('image_url');
            $table->string('image_alt', 200)->nullable()->after('image_path');
            $table->string('image_credit', 200)->nullable()->after('image_alt');
            $table->string('image_source_url', 500)->nullable()->after('image_credit');
            $table->string('image_license', 100)->nullable()->after('image_source_url');
            $table->timestamp('image_updated_at')->nullable()->after('image_license');
        });

        Schema::create('contact_messages', function (Blueprint $table): void {
            $table->id();
            $table->string('name', 100);
            $table->string('email', 150)->nullable();
            $table->string('subject', 150);
            $table->text('message');
            $table->string('ip_hash', 64)->nullable();
            $table->timestamp('read_at')->nullable();
            $table->timestamps();
            $table->index('created_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('contact_messages');
        Schema::table('articles', function (Blueprint $table): void {
            $table->dropColumn(['image_path', 'image_alt', 'image_credit', 'image_source_url', 'image_license', 'image_updated_at']);
        });
    }
};

<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** Web admin panel (/admin): audit log, member blocking, last-login tracking and hiding a game from the listing. */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('admin_audit_logs', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('actor', 64);
            $table->string('action', 64);
            $table->string('target_type', 32)->nullable();
            $table->string('target_id', 64)->nullable();
            $table->string('target_label', 191)->nullable();
            $table->json('meta')->nullable();
            $table->string('ip', 45)->nullable();
            $table->timestamp('created_at')->nullable();
            $table->index(['action', 'created_at']);
            $table->index(['target_type', 'target_id']);
        });

        Schema::table('users', function (Blueprint $table): void {
            if (! Schema::hasColumn('users', 'banned_at')) {
                $table->timestamp('banned_at')->nullable();
            }

            if (! Schema::hasColumn('users', 'last_login_at')) {
                $table->timestamp('last_login_at')->nullable();
            }
        });

        Schema::table('company_profiles', function (Blueprint $table): void {
            if (! Schema::hasColumn('company_profiles', 'hidden_from_listing')) {
                $table->boolean('hidden_from_listing')->default(false);
            }
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('admin_audit_logs');

        Schema::table('users', function (Blueprint $table): void {
            $table->dropColumn(['banned_at', 'last_login_at']);
        });

        Schema::table('company_profiles', function (Blueprint $table): void {
            $table->dropColumn('hidden_from_listing');
        });
    }
};

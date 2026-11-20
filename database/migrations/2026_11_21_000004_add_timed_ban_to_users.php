<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** Timed bans: banned_until NULL with banned_at set = permanent; a past banned_until = ban lifted. */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table): void {
            if (! Schema::hasColumn('users', 'banned_until')) {
                $table->timestamp('banned_until')->nullable();
            }
            if (! Schema::hasColumn('users', 'ban_reason')) {
                $table->string('ban_reason', 200)->nullable();
            }
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table): void {
            $table->dropColumn(['banned_until', 'ban_reason']);
        });
    }
};

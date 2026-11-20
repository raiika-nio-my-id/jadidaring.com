<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Custom Pages and games no longer need a client account: the owner is optional and deleting
 * a user keeps the page (user_id becomes NULL) instead of cascading it away.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('company_profiles', function (Blueprint $table): void {
            $table->dropForeign(['user_id']);
        });
        Schema::table('company_profiles', function (Blueprint $table): void {
            $table->unsignedBigInteger('user_id')->nullable()->change();
            $table->foreign('user_id')->references('id')->on('users')->nullOnDelete();
        });
    }

    public function down(): void
    {
        // Not reversible without owners for every row; keep nullable.
    }
};

<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table): void {
            $table->string('email')->nullable()->change();
            $table->string('username', 32)->nullable()->unique()->after('name');
            $table->string('provider', 32)->nullable()->after('role');
            $table->string('provider_id')->nullable()->after('provider');
            $table->unique(['provider', 'provider_id']);
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table): void {
            $table->dropUnique(['provider', 'provider_id']);
            $table->dropColumn(['username', 'provider', 'provider_id']);
        });
    }
};

<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        foreach (['member_pages', 'member_page_drafts'] as $t) {
            Schema::table($t, function (Blueprint $table) {
                $table->json('config')->nullable();
            });
        }
    }

    public function down(): void
    {
        foreach (['member_pages', 'member_page_drafts'] as $t) {
            Schema::table($t, function (Blueprint $table) {
                $table->dropColumn('config');
            });
        }
    }
};

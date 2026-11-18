<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('member_page_visitors', function (Blueprint $table) {
            $table->id();
            $table->foreignId('member_page_id')->constrained()->cascadeOnDelete();
            $table->char('visitor_hash', 64);
            $table->timestamp('first_seen')->useCurrent();
            $table->unique(['member_page_id', 'visitor_hash']);
        });

        // Old counts were page loads. The counter now means unique visitors and restarts from zero.
        DB::table('member_pages')->update(['views' => 0]);
    }

    public function down(): void
    {
        Schema::dropIfExists('member_page_visitors');
    }
};

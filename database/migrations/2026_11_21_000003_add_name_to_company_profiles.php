<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/** Custom Page "Nama" lives on the page itself (it used to be the owner account's name). */
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasColumn('company_profiles', 'name')) {
            Schema::table('company_profiles', function (Blueprint $table): void {
                $table->string('name', 120)->nullable()->after('subdomain');
            });
        }

        foreach (DB::table('company_profiles')->whereNull('name')->whereNotNull('user_id')->get(['id', 'user_id']) as $p) {
            $name = DB::table('users')->where('id', $p->user_id)->value('name');
            if (is_string($name) && $name !== '') {
                DB::table('company_profiles')->where('id', $p->id)->update(['name' => mb_substr($name, 0, 120)]);
            }
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('company_profiles', 'name')) {
            Schema::table('company_profiles', function (Blueprint $table): void {
                $table->dropColumn('name');
            });
        }
    }
};

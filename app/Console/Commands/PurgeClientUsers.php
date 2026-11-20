<?php

namespace App\Console\Commands;

use App\Enums\UserRole;
use App\Models\CompanyProfile;
use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Remove the old client accounts that only existed to own a site/game. Dry-run unless --force.
 * Kept: admins, members, and any client account with community activity (listed as ambiguous).
 * Their sites stay; company_profiles.user_id is set to NULL.
 */
class PurgeClientUsers extends Command
{
    protected $signature = 'users:purge-clients {--force : Execute (default is a dry run)}';

    protected $description = 'Dry-run (default) or delete old client-only accounts; sites are kept with no owner';

    /** table => label, every user_id that means "this person used the community" */
    private const ACTIVITY = [
        'member_pages' => 'profil komunitas', 'member_posts' => 'curhatan', 'member_post_comments' => 'komentar curhatan',
        'member_post_likes' => 'like curhatan', 'article_comments' => 'komentar berita', 'member_page_comments' => 'komentar profil',
        'game_scores' => 'skor game', 'game_players' => 'pemain game', 'member_page_drafts' => 'draf profil',
    ];

    public function handle(): int
    {
        $clients = User::query()->where('role', UserRole::Client->value)->orderBy('id')->get();
        $delete = [];
        $skip = [];

        foreach ($clients as $u) {
            $why = [];
            foreach (self::ACTIVITY as $table => $label) {
                if (Schema::hasTable($table) && Schema::hasColumn($table, 'user_id') && DB::table($table)->where('user_id', $u->id)->exists()) {
                    $why[] = $label;
                }
            }
            if (Schema::hasTable('member_follows') && DB::table('member_follows')->where('follower_id', $u->id)->orWhere('followed_id', $u->id)->exists()) {
                $why[] = 'follow';
            }
            if ($u->provider) {
                $why[] = 'login '.$u->provider;
            }
            $sites = CompanyProfile::query()->where('user_id', $u->id)->get(['id', 'subdomain', 'is_game'])
                ->map(fn ($p) => $p->subdomain.($p->is_game ? ' (game)' : ''))->all();
            $row = ['id' => $u->id, 'who' => ($u->email ?: '-').' / @'.($u->username ?: '-'), 'sites' => $sites];

            if ($why === []) {
                $delete[] = $row + ['reason' => 'role client, tanpa aktivitas komunitas'.($sites ? ', pemilik situs' : '')];
            } else {
                $skip[] = $row + ['reason' => 'ambigu: '.implode(', ', $why)];
            }
        }

        $roles = User::query()->selectRaw('role, COUNT(*) c')->groupBy('role')->pluck('c', 'role')->all();
        $this->line('Users per role: '.json_encode($roles));
        $this->line('DELETE ('.count($delete).'):');
        foreach ($delete as $r) {
            $this->line(sprintf('  #%d %s | %s | situs: %s', $r['id'], $r['who'], $r['reason'], $r['sites'] ? implode(', ', $r['sites']) : '-'));
        }
        $this->line('SKIP ambiguous ('.count($skip).'):');
        foreach ($skip as $r) {
            $this->line(sprintf('  #%d %s | %s | situs: %s', $r['id'], $r['who'], $r['reason'], $r['sites'] ? implode(', ', $r['sites']) : '-'));
        }
        $reassign = array_sum(array_map(fn ($r) => count($r['sites']), $delete));
        $this->line('Sites to keep with owner=NULL: '.$reassign);

        if (! $this->option('force')) {
            $this->info('DRY RUN: nothing changed.');

            return self::SUCCESS;
        }

        $ids = array_column($delete, 'id');
        $profilesBefore = CompanyProfile::query()->count();
        $adminsBefore = User::query()->where('role', UserRole::Admin->value)->count();

        DB::transaction(function () use ($ids, $profilesBefore, $adminsBefore): void {
            foreach (array_chunk($ids, 200) as $chunk) {
                $chunk = User::query()->whereIn('id', $chunk)->where('role', UserRole::Client->value)->pluck('id')->all();
                foreach (CompanyProfile::query()->whereIn('user_id', $chunk)->whereNull('name')->with('user')->get() as $p) {
                    $p->update(['name' => mb_substr((string) $p->user?->name, 0, 120) ?: null]); // keep the page's display name
                }
                CompanyProfile::query()->whereIn('user_id', $chunk)->update(['user_id' => null]);
                DB::table('sessions')->whereIn('user_id', $chunk)->delete();
                $emails = User::query()->whereIn('id', $chunk)->whereNotNull('email')->pluck('email')->all();
                if ($emails !== []) {
                    DB::table('password_reset_tokens')->whereIn('email', $emails)->delete();
                }
                User::query()->whereIn('id', $chunk)->delete();
            }
            if (CompanyProfile::query()->count() !== $profilesBefore || User::query()->where('role', UserRole::Admin->value)->count() !== $adminsBefore) {
                throw new \RuntimeException('Profile/admin count changed; rolled back.');
            }
        });

        $this->info('Deleted '.count($ids).' client account(s). Sites kept: '.CompanyProfile::query()->count().'.');

        return self::SUCCESS;
    }
}

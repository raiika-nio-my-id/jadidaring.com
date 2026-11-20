<?php

namespace Tests\Feature;

use App\Models\AdminAuditLog;
use App\Models\Article;
use App\Models\ArticleComment;
use App\Models\CompanyProfile;
use App\Models\GameRoom;
use App\Models\GameScore;
use App\Models\MemberPage;
use App\Models\MemberPageComment;
use App\Models\MemberPost;
use App\Models\User;
use App\Services\Admin\AdminBackup;
use Illuminate\Foundation\Http\Middleware\PreventRequestForgery;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class AdminPanelTest extends TestCase
{
    use RefreshDatabase;

    private const H = 'http://jadidaring.test';

    protected function setUp(): void
    {
        parent::setUp();
        Http::preventStrayRequests();
        config(['services.google_stats.property_id' => null, 'services.google_stats.sa_json_b64' => null, 'services.google_stats.sa_json_path' => null]);
        $this->withoutMiddleware(PreventRequestForgery::class);
    }

    protected function tearDown(): void
    {
        File::deleteDirectory(AdminBackup::dir());
        foreach (glob(storage_path('app/backups/deleted-user-*.json')) ?: [] as $f) {
            @unlink($f);
        }
        parent::tearDown();
    }

    private function admin(): User
    {
        return User::factory()->admin()->create(['email' => 'boss@example.test']);
    }

    private function member(string $username = 'budi'): User
    {
        return User::factory()->member()->create(['username' => $username]);
    }

    /** @return array{0: Article, 1: CompanyProfile, 2: GameScore, 3: GameRoom, 4: MemberPage, 5: MemberPost, 6: User} */
    private function seedData(): array
    {
        $m = $this->member();
        $article = Article::query()->create(['topic' => 'teknologi', 'slug' => 'judul-uji', 'title' => 'Judul artikel uji coba', 'summary' => str_repeat('ringkasan ', 4), 'body' => str_repeat('isi artikel ', 30), 'sources' => [], 'status' => 'published', 'published_at' => now()]);
        $game = CompanyProfile::factory()->game()->published()->create(['subdomain' => 'benteng']);
        $score = GameScore::query()->create(['company_profile_id' => $game->id, 'name' => 'Ani', 'score' => 500]);
        $room = GameRoom::query()->create(['company_profile_id' => $game->id, 'code' => 'ABCD', 'state' => ['turn' => 1]]);
        $page = MemberPage::query()->create(['user_id' => $m->id, 'title' => 'Profil Budi', 'html' => '', 'status' => 'published', 'views' => 42]);
        $post = MemberPost::query()->create(['user_id' => $m->id, 'body' => 'Curhatan pertama', 'visibility' => 'public']);

        return [$article, $game, $score, $room, $page, $post, $m];
    }

    /** @return list<array{0: string, 1: string}> */
    private function routes(): array
    {
        [$a, $g, $s, $r, $p, $post, $m] = $this->seedData();
        $c = MemberPageComment::query()->create(['member_page_id' => $p->id, 'user_id' => $m->id, 'body' => 'hai']);

        return [
            ['GET', '/admin'], ['GET', '/admin/ringkasan/ga'], ['GET', '/admin/statistik'], ['POST', '/admin/statistik/refresh'],
            ['GET', '/admin/berita'], ['GET', '/admin/berita/'.$a->id], ['PUT', '/admin/berita/'.$a->id], ['POST', '/admin/berita/'.$a->id.'/status'], ['DELETE', '/admin/berita/'.$a->id],
            ['GET', '/admin/berita/topik'], ['GET', '/admin/berita/komentar'],
            ['GET', '/admin/komunitas'], ['GET', '/admin/komunitas/'.$p->id], ['POST', '/admin/komunitas/'.$p->id.'/status'], ['POST', '/admin/komunitas/'.$p->id.'/reset-pengunjung'],
            ['GET', '/admin/komunitas/komentar'], ['POST', '/admin/komunitas/komentar/'.$c->id.'/toggle'], ['DELETE', '/admin/komunitas/komentar/'.$c->id],
            ['GET', '/admin/komunitas/curhatan'], ['POST', '/admin/komunitas/curhatan/'.$post->id.'/toggle'], ['DELETE', '/admin/komunitas/curhatan/'.$post->id],
            ['GET', '/admin/user'], ['GET', '/admin/user/'.$m->id], ['POST', '/admin/user/'.$m->id.'/blokir'], ['POST', '/admin/user/'.$m->id.'/buka-blokir'], ['DELETE', '/admin/user/'.$m->id],
            ['GET', '/admin/game'], ['GET', '/admin/game/'.$g->id], ['GET', '/admin/game/'.$g->id.'?tab=room'], ['POST', '/admin/game/'.$g->id.'/listing'], ['GET', '/admin/game/'.$g->id.'/ekspor'],
            ['GET', '/admin/game/'.$g->id.'/skor/'.$s->id], ['PUT', '/admin/game/'.$g->id.'/skor/'.$s->id], ['DELETE', '/admin/game/'.$g->id.'/skor/'.$s->id], ['POST', '/admin/game/'.$g->id.'/skor-kosongkan'],
            ['GET', '/admin/game/'.$g->id.'/room/'.$r->id], ['DELETE', '/admin/game/'.$g->id.'/room/'.$r->id], ['POST', '/admin/game/'.$g->id.'/room-kosongkan'],
            ['GET', '/admin/pesan'], ['GET', '/admin/log'], ['GET', '/admin/backup'], ['GET', '/admin/backup/admin/x.json'], ['POST', '/admin/keluar'],
        ];
    }

    public function test_guests_are_sent_to_the_admin_login_on_every_route(): void
    {
        foreach ($this->routes() as [$method, $uri]) {
            $res = $this->call($method, self::H.$uri);
            $this->assertSame(302, $res->status(), $method.' '.$uri);
            $this->assertStringEndsWith('/admin/masuk', (string) $res->headers->get('Location'), $method.' '.$uri);
        }
        $this->assertSame(1, Article::query()->count());
        $this->assertSame(0, AdminAuditLog::query()->count());
    }

    public function test_members_get_403_on_every_route_and_nothing_changes(): void
    {
        $routes = $this->routes();
        $member = $this->member('bukanadmin');

        foreach ($routes as [$method, $uri]) {
            $this->actingAs($member)->call($method, self::H.$uri)->assertForbidden();
        }

        $this->assertSame(1, Article::query()->where('status', 'published')->count());
        $this->assertSame(1, GameScore::query()->count());
        $this->assertNotNull(User::query()->where('username', 'budi')->first());
        $this->assertSame(0, AdminAuditLog::query()->count());
    }

    public function test_banned_admin_and_client_accounts_are_refused(): void
    {
        $this->actingAs(User::factory()->client()->create())->get(self::H.'/admin')->assertForbidden();
        $banned = User::factory()->admin()->create();
        $banned->forceFill(['banned_at' => now()])->save();
        $this->actingAs($banned)->get(self::H.'/admin/user')->assertRedirectContains('/masuk');
        $this->assertGuest();
    }

    public function test_admin_pages_render_and_are_not_cached_or_indexed(): void
    {
        [$a, $g, $s, $r, $p] = $this->seedData();
        $admin = $this->admin();

        foreach (['/admin', '/admin/ringkasan/ga', '/admin/statistik', '/admin/berita', '/admin/berita/'.$a->id, '/admin/berita/topik', '/admin/berita/komentar',
            '/admin/komunitas', '/admin/komunitas/'.$p->id, '/admin/komunitas/komentar', '/admin/komunitas/curhatan', '/admin/user', '/admin/game',
            '/admin/game/'.$g->id, '/admin/game/'.$g->id.'?tab=room', '/admin/game/'.$g->id.'/skor/'.$s->id, '/admin/game/'.$g->id.'/room/'.$r->id, '/admin/pesan', '/admin/log'] as $uri) {
            $res = $this->actingAs($admin)->get(self::H.$uri);
            $res->assertOk();
            $this->assertStringContainsString('no-store', (string) $res->headers->get('Cache-Control'), $uri);
            $this->assertSame('noindex, nofollow', $res->headers->get('X-Robots-Tag'), $uri);
            $this->assertStringNotContainsString((string) config('singlepage.admin_api_secret', 'x-never'), (string) $res->getContent());
        }

        $this->actingAs($admin)->get(self::H.'/admin')->assertSee('Panel Admin')->assertSee('User baru 7 hari')->assertSee('data-adm-lazy', false);
        $this->actingAs($admin)->get(self::H.'/admin/ringkasan/ga')->assertSee('Setup GA belum selesai');
    }

    public function test_admin_login_form_accepts_only_admin_accounts(): void
    {
        $this->get(self::H.'/admin/masuk')->assertOk()->assertSee('Masuk Admin');
        User::factory()->admin()->create(['email' => 'boss@example.test', 'password' => 'rahasia-panjang']);
        User::factory()->client()->create(['email' => 'client@example.test', 'password' => 'rahasia-panjang']);

        $this->post(self::H.'/admin/masuk', ['email' => 'client@example.test', 'password' => 'rahasia-panjang'])->assertSessionHasErrors('email');
        $this->assertGuest();

        $this->post(self::H.'/admin/masuk', ['email' => 'boss@example.test', 'password' => 'rahasia-panjang'])->assertRedirectContains('/admin');
        $this->assertAuthenticated();
        $this->assertSame(1, AdminAuditLog::query()->where('action', 'login')->count());
        $this->get(self::H.'/admin/masuk')->assertRedirectContains('/admin');
    }

    public function test_news_edit_hide_and_delete_with_backup_and_audit(): void
    {
        [$a] = $this->seedData();
        ArticleComment::query()->create(['article_id' => $a->id, 'user_id' => User::query()->first()->id, 'body' => 'komentar']);
        $admin = $this->admin();

        $this->actingAs($admin)->put(self::H.'/admin/berita/'.$a->id, [
            'title' => 'Judul baru yang cukup panjang', 'summary' => $a->summary, 'body' => $a->body, 'topic' => 'gaming', 'image_credit' => 'Foto: Budi',
        ])->assertRedirect();
        $a->refresh();
        $this->assertSame('Judul baru yang cukup panjang', $a->title);
        $this->assertSame('gaming', $a->topic);
        $this->assertSame('Foto: Budi', $a->image_credit);

        $this->actingAs($admin)->post(self::H.'/admin/berita/'.$a->id.'/status', ['status' => 'hidden'])->assertRedirect();
        $this->assertSame('hidden', $a->refresh()->status);
        $this->get(self::H.'/berita/gaming/'.$a->slug)->assertNotFound();

        $this->actingAs($admin)->delete(self::H.'/admin/berita/'.$a->id, ['confirm' => 'salah'])->assertSessionHasErrors('confirm');
        $this->assertNotNull(Article::query()->find($a->id));
        $this->actingAs($admin)->delete(self::H.'/admin/berita/'.$a->id, ['confirm' => 'HAPUS'])->assertRedirect();
        $this->assertNull(Article::query()->find($a->id));
        $this->assertNotEmpty(glob(AdminBackup::dir().'/article-'.$a->id.'-*.json'));

        $this->assertEqualsCanonicalizing(['news.update', 'news.hide', 'news.delete'], AdminAuditLog::query()->pluck('action')->all());
        $this->assertSame($admin->id, AdminAuditLog::query()->first()->user_id);
    }

    public function test_community_moderation(): void
    {
        [, , , , $p, $post, $m] = $this->seedData();
        DB::table('member_page_visitors')->insert(['member_page_id' => $p->id, 'visitor_hash' => str_repeat('a', 64)]);
        $c = MemberPageComment::query()->create(['member_page_id' => $p->id, 'user_id' => $m->id, 'body' => 'spam', 'reports_count' => 2]);
        $admin = $this->admin();

        $this->actingAs($admin)->post(self::H.'/admin/komunitas/'.$p->id.'/status', ['status' => 'hidden']);
        $this->assertSame('hidden', $p->refresh()->status);
        $this->actingAs($admin)->post(self::H.'/admin/komunitas/'.$p->id.'/reset-pengunjung');
        $this->assertSame(0, (int) $p->refresh()->views);
        $this->assertSame(0, DB::table('member_page_visitors')->count());

        $this->actingAs($admin)->post(self::H.'/admin/komunitas/komentar/'.$c->id.'/toggle');
        $this->assertTrue($c->refresh()->is_hidden);
        $this->actingAs($admin)->delete(self::H.'/admin/komunitas/komentar/'.$c->id);
        $this->assertNull(MemberPageComment::query()->find($c->id));

        $this->actingAs($admin)->post(self::H.'/admin/komunitas/curhatan/'.$post->id.'/toggle');
        $this->assertTrue($post->refresh()->is_hidden);
        $this->actingAs($admin)->delete(self::H.'/admin/komunitas/curhatan/'.$post->id);
        $this->assertNull(MemberPost::query()->find($post->id));
        $this->assertSame(6, AdminAuditLog::query()->count());
    }

    public function test_user_block_logs_out_and_blocks_login_and_posting(): void
    {
        $admin = $this->admin();
        $m = User::factory()->member()->create(['username' => 'nakal', 'password' => 'katasandi-ok']);

        $this->actingAs($admin)->post(self::H.'/admin/user/'.$m->id.'/blokir', ['reason' => 'spam'])->assertRedirect();
        $this->assertNotNull($m->refresh()->banned_at);
        auth()->logout();

        // Password login refused.
        $this->post(self::H.'/masuk', ['login' => 'nakal', 'password' => 'katasandi-ok'])->assertSessionHasErrors('login');
        $this->assertGuest();

        // An existing session is ended on the next request, so posting is impossible.
        $this->actingAs($m)->post(self::H.'/u/nakal/komentar', ['body' => 'halo'])->assertRedirectContains('/masuk');
        $this->assertGuest();
        $this->assertSame(0, MemberPageComment::query()->count());

        $this->actingAs($admin)->post(self::H.'/admin/user/'.$m->id.'/buka-blokir')->assertRedirect();
        $this->assertNull($m->refresh()->banned_at);
        auth()->logout();
        $this->post(self::H.'/masuk', ['login' => 'nakal', 'password' => 'katasandi-ok'])->assertSessionHasNoErrors();
        $this->assertAuthenticated();
    }

    public function test_admins_cannot_be_blocked_or_deleted(): void
    {
        $admin = $this->admin();
        $other = User::factory()->admin()->create(['username' => 'admin2']);

        $this->actingAs($admin)->post(self::H.'/admin/user/'.$other->id.'/blokir')->assertRedirect();
        $this->assertNull($other->refresh()->banned_at);
        $this->actingAs($admin)->delete(self::H.'/admin/user/'.$other->id, ['confirm' => 'admin2'])->assertRedirect();
        $this->assertNotNull(User::query()->find($other->id));
        $this->actingAs($admin)->delete(self::H.'/admin/user/'.$admin->id, ['confirm' => (string) $admin->username])->assertRedirect();
        $this->assertNotNull(User::query()->find($admin->id));
    }

    public function test_user_delete_needs_the_typed_username_and_writes_a_backup(): void
    {
        $admin = $this->admin();
        $m = $this->member('hapusaku');
        MemberPost::query()->create(['user_id' => $m->id, 'body' => 'x', 'visibility' => 'public']);

        $this->actingAs($admin)->delete(self::H.'/admin/user/'.$m->id, ['confirm' => 'salah'])->assertSessionHasErrors('confirm');
        $this->assertNotNull(User::query()->find($m->id));

        $this->actingAs($admin)->delete(self::H.'/admin/user/'.$m->id, ['confirm' => 'hapusaku'])->assertRedirect();
        $this->assertNull(User::query()->find($m->id));
        $files = glob(storage_path('app/backups/deleted-user-hapusaku-*.json'));
        $this->assertNotEmpty($files);
        $this->assertCount(1, json_decode((string) file_get_contents($files[0]), true)['member_posts']);
        $this->assertSame(1, AdminAuditLog::query()->where('action', 'user.delete')->count());
    }

    public function test_game_listing_toggle_hides_from_game_list_only(): void
    {
        [, $g] = $this->seedData();
        $admin = $this->admin();
        $this->get(self::H.'/game')->assertSee('/game/benteng', false);

        $this->actingAs($admin)->post(self::H.'/admin/game/'.$g->id.'/listing')->assertRedirect();
        $this->assertTrue($g->refresh()->hidden_from_listing);
        auth()->logout();
        $this->get(self::H.'/game')->assertDontSee('/game/benteng', false);
    }

    public function test_game_data_scores_rooms_export_and_backups(): void
    {
        [, $g, $s, $r] = $this->seedData();
        GameScore::query()->create(['company_profile_id' => $g->id, 'name' => 'Budi', 'score' => 10]);
        $other = CompanyProfile::factory()->game()->published()->create(['subdomain' => 'lain']);
        $otherScore = GameScore::query()->create(['company_profile_id' => $other->id, 'name' => 'X', 'score' => 1]);
        $admin = $this->admin();

        // A score of another game is never reachable through this game.
        $this->actingAs($admin)->get(self::H.'/admin/game/'.$g->id.'/skor/'.$otherScore->id)->assertNotFound();

        $this->actingAs($admin)->get(self::H.'/admin/game/'.$g->id.'?q=Ani')->assertSee('Ani')->assertDontSee('>Budi<', false);
        $this->actingAs($admin)->get(self::H.'/admin/game/'.$g->id.'/skor/'.$s->id)->assertSee('&quot;score&quot;: 500', false);

        $this->actingAs($admin)->put(self::H.'/admin/game/'.$g->id.'/skor/'.$s->id, ['name' => 'Ani2', 'score' => 'abc'])->assertSessionHasErrors('score');
        $this->actingAs($admin)->put(self::H.'/admin/game/'.$g->id.'/skor/'.$s->id, ['name' => 'Ani2', 'score' => 600])->assertRedirect();
        $this->assertSame(600, (int) $s->refresh()->score);

        $export = $this->actingAs($admin)->get(self::H.'/admin/game/'.$g->id.'/ekspor');
        $export->assertOk();
        $json = json_decode($export->streamedContent(), true);
        $this->assertSame('benteng', $json['game']);
        $this->assertCount(2, $json['scores']);
        $this->assertSame('ABCD', $json['rooms'][0]['room']['code']);

        $this->actingAs($admin)->delete(self::H.'/admin/game/'.$g->id.'/skor/'.$s->id)->assertRedirect();
        $this->assertNull(GameScore::query()->find($s->id));

        $this->actingAs($admin)->post(self::H.'/admin/game/'.$g->id.'/skor-kosongkan', ['confirm' => 'lain'])->assertSessionHasErrors('confirm');
        $this->actingAs($admin)->post(self::H.'/admin/game/'.$g->id.'/skor-kosongkan', ['confirm' => 'benteng'])->assertRedirect();
        $this->assertSame(0, GameScore::query()->where('company_profile_id', $g->id)->count());
        $this->assertNotNull(GameScore::query()->find($otherScore->id));

        // Fresh rooms survive "lama", "semua" removes them.
        $this->actingAs($admin)->post(self::H.'/admin/game/'.$g->id.'/room-kosongkan', ['confirm' => 'benteng', 'scope' => 'lama'])->assertRedirect();
        $this->assertNotNull(GameRoom::query()->find($r->id));
        $this->actingAs($admin)->post(self::H.'/admin/game/'.$g->id.'/room-kosongkan', ['confirm' => 'benteng', 'scope' => 'semua'])->assertRedirect();
        $this->assertNull(GameRoom::query()->find($r->id));

        $this->assertNotEmpty(glob(AdminBackup::dir().'/game-benteng-score-*.json'));
        $this->assertCount(1, glob(AdminBackup::dir().'/game-benteng-scores-*.json'));
        $this->assertCount(2, glob(AdminBackup::dir().'/game-benteng-rooms-*.json'));
        $this->assertSame(['game.score.update', 'game.export', 'game.score.delete', 'game.scores.clear', 'game.rooms.clear', 'game.rooms.clear'], AdminAuditLog::query()->orderBy('id')->pluck('action')->all());
    }

    public function test_backups_are_listed_and_downloadable_by_admins_only(): void
    {
        $admin = $this->admin();
        $file = AdminBackup::write('article-9', ['x' => 1]);
        $name = basename($file);

        $this->actingAs($admin)->get(self::H.'/admin/backup')->assertOk()->assertSee($name);
        $res = $this->actingAs($admin)->get(self::H.'/admin/backup/admin/'.$name);
        $res->assertOk();
        $this->assertSame(1, json_decode((string) file_get_contents($res->getFile()->getPathname()), true)['data']['x']);
        $this->actingAs($admin)->get(self::H.'/admin/backup/admin/..%2F..%2F.env')->assertNotFound();
        $this->actingAs($admin)->get(self::H.'/admin/backup/etc/'.$name)->assertNotFound();
        $this->assertSame(1, AdminAuditLog::query()->where('action', 'backup.download')->count());
    }
}

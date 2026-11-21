<?php

namespace Tests\Feature;

use App\Models\AdminAuditLog;
use App\Models\Article;
use App\Models\ArticleComment;
use App\Models\MemberPage;
use App\Models\MemberPageComment;
use App\Models\MemberPost;
use App\Models\MemberPostComment;
use App\Models\User;
use App\Services\Admin\AdminBackup;
use App\Services\PostImage;
use App\Services\ProfileConfig;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\File;
use Tests\TestCase;

/** The admin-only '⋯' menu on public pages: rendered only for panel admins, backed by the /admin panel routes. */
class PublicAdminModerationTest extends TestCase
{
    use RefreshDatabase;

    protected function tearDown(): void
    {
        File::deleteDirectory(storage_path('app/post-img'));
        File::deleteDirectory(AdminBackup::dir());
        parent::tearDown();
    }

    private function base(): string
    {
        return 'http://'.config('singlepage.base_domain');
    }

    private function member(string $username): User
    {
        $u = User::factory()->member()->create(['username' => $username, 'name' => ucfirst($username)]);
        MemberPage::create(['user_id' => $u->id, 'title' => $username, 'html' => '', 'status' => 'published', 'config' => ProfileConfig::defaults()]);

        return $u;
    }

    private function imageFor(User $u): string
    {
        $img = imagecreatetruecolor(40, 30);
        ob_start();
        imagejpeg($img);

        return PostImage::store($u->id, (string) ob_get_clean());
    }

    /** @return array{0: User, 1: User, 2: MemberPost, 3: MemberPostComment, 4: MemberPageComment, 5: ArticleComment, 6: Article} */
    private function scene(): array
    {
        $author = $this->member('shipu');
        $other = $this->member('budi_b');
        $post = MemberPost::create(['user_id' => $author->id, 'body' => 'Miaw', 'visibility' => 'public', 'image' => $this->imageFor($author), 'comments_count' => 1]);
        $pc = MemberPostComment::create(['member_post_id' => $post->id, 'user_id' => $other->id, 'body' => 'lucu']);
        $wall = MemberPageComment::create(['member_page_id' => $author->memberPage->id, 'user_id' => $other->id, 'body' => 'halo dinding']);
        $article = Article::query()->create(['topic' => 'teknologi', 'slug' => 'judul-uji', 'title' => 'Judul artikel uji coba', 'summary' => str_repeat('ringkasan ', 4), 'body' => str_repeat('isi artikel ', 30), 'sources' => [], 'status' => 'published', 'published_at' => now()]);
        $ac = ArticleComment::create(['article_id' => $article->id, 'user_id' => $other->id, 'body' => 'komentar berita']);

        return [$author, $other, $post, $pc, $wall, $ac, $article];
    }

    public function test_only_admins_see_the_menu_and_never_on_their_own_posts(): void
    {
        [$author, $other, $post, , , , $article] = $this->scene();
        $admin = User::factory()->admin()->create();
        $pages = ['/komunitas', '/u/shipu', '/u/shipu/curhatan/'.$post->id, '/berita/teknologi/judul-uji'];

        foreach ($pages as $p) {
            $this->get($this->base().$p)->assertOk()->assertDontSee('data-jd-mod', false)->assertDontSee('jd-mod.js', false)->assertDontSee('data-mod-base', false);
            $this->actingAs($other)->get($this->base().$p)->assertOk()->assertDontSee('data-jd-mod', false)->assertDontSee('jd-mod.js', false)->assertDontSee('data-mod-base', false);
            auth()->logout();
        }

        $this->actingAs($admin);
        $this->get($this->base().'/komunitas')->assertOk()->assertSee('jd-mod.js', false)
            ->assertSee('data-url="/admin/komunitas/curhatan/'.$post->id.'"', false)
            ->assertSee('data-url="/admin/komunitas/curhatan/'.$post->id.'/toggle"', false);
        $this->get($this->base().'/u/shipu/curhatan/'.$post->id)->assertOk()
            ->assertSee('data-after="/u/shipu#curhatan"', false)
            ->assertSee('data-url="/admin/komunitas/curhatan-komentar/', false);
        $this->get($this->base().'/u/shipu')->assertOk()->assertSee('data-url="/admin/komunitas/komentar/', false);
        $this->get($this->base().'/berita/teknologi/judul-uji')->assertOk()->assertSee('data-mod-base="/admin/berita/komentar/"', false);
    }

    public function test_admin_json_moderation_deletes_hides_and_cleans_up(): void
    {
        [$author, , $post, $pc, $wall, $ac] = $this->scene();
        $admin = User::factory()->admin()->create();
        $img = storage_path('app/post-img/'.$author->id.'/'.$post->image);
        $this->assertFileExists($img);
        $json = ['Accept' => 'application/json', 'X-Requested-With' => 'XMLHttpRequest'];

        // Hide with an explicit target state is idempotent (a double tap never un-hides).
        $this->actingAs($admin)->post($this->base().'/admin/komunitas/curhatan-komentar/'.$pc->id.'/toggle', ['hidden' => '1'], $json)->assertOk()->assertJson(['ok' => true, 'hidden' => true]);
        $this->actingAs($admin)->post($this->base().'/admin/komunitas/curhatan-komentar/'.$pc->id.'/toggle', ['hidden' => '1'], $json)->assertOk()->assertJson(['hidden' => true]);
        $this->assertTrue($pc->refresh()->is_hidden);
        $this->assertSame(0, (int) $post->refresh()->comments_count);

        $this->actingAs($admin)->deleteJson($this->base().'/admin/komunitas/curhatan-komentar/'.$pc->id)->assertOk()->assertJson(['ok' => true, 'deleted' => true]);
        $this->assertNull(MemberPostComment::query()->find($pc->id));

        $this->actingAs($admin)->post($this->base().'/admin/komunitas/komentar/'.$wall->id.'/toggle', ['hidden' => '1'], $json)->assertOk()->assertJson(['hidden' => true]);
        $this->actingAs($admin)->deleteJson($this->base().'/admin/komunitas/komentar/'.$wall->id)->assertOk()->assertJson(['deleted' => true]);
        $this->assertNull(MemberPageComment::query()->find($wall->id));

        $this->actingAs($admin)->post($this->base().'/admin/berita/komentar/'.$ac->id.'/toggle', ['hidden' => '1'], $json)->assertOk()->assertJson(['hidden' => true]);
        $this->actingAs($admin)->deleteJson($this->base().'/admin/berita/komentar/'.$ac->id)->assertOk()->assertJson(['deleted' => true]);
        $this->assertNull(ArticleComment::query()->find($ac->id));

        $this->actingAs($admin)->post($this->base().'/admin/komunitas/curhatan/'.$post->id.'/toggle', ['hidden' => '1'], $json)->assertOk()->assertJson(['hidden' => true]);
        $this->actingAs($admin)->deleteJson($this->base().'/admin/komunitas/curhatan/'.$post->id)->assertOk()->assertJson(['ok' => true, 'deleted' => true])->assertHeader('Cache-Control', 'no-store, private');
        $this->assertNull(MemberPost::query()->find($post->id));
        $this->assertFileDoesNotExist($img);
        $this->assertGreaterThanOrEqual(9, AdminAuditLog::query()->count());

        // The deleted post is gone publicly.
        $this->get($this->base().'/u/shipu/curhatan/'.$post->id)->assertNotFound();
    }

    public function test_members_get_403_and_guests_are_redirected_and_nothing_changes(): void
    {
        [, $other, $post, $pc, $wall, $ac] = $this->scene();
        $routes = [
            ['POST', '/admin/komunitas/curhatan/'.$post->id.'/toggle'], ['DELETE', '/admin/komunitas/curhatan/'.$post->id],
            ['POST', '/admin/komunitas/curhatan-komentar/'.$pc->id.'/toggle'], ['DELETE', '/admin/komunitas/curhatan-komentar/'.$pc->id],
            ['POST', '/admin/komunitas/komentar/'.$wall->id.'/toggle'], ['DELETE', '/admin/komunitas/komentar/'.$wall->id],
            ['POST', '/admin/berita/komentar/'.$ac->id.'/toggle'], ['DELETE', '/admin/berita/komentar/'.$ac->id],
        ];

        foreach ($routes as [$m, $uri]) {
            $this->call($m, $this->base().$uri, ['hidden' => '1'])->assertRedirect(route('panel.login'));
            $this->json($m, $this->base().$uri, ['hidden' => '1'])->assertUnauthorized();
        }
        $this->actingAs($other);
        foreach ($routes as [$m, $uri]) {
            $this->call($m, $this->base().$uri, ['hidden' => '1'])->assertForbidden();
            $this->json($m, $this->base().$uri, ['hidden' => '1'])->assertForbidden();
        }

        $this->assertFalse($post->refresh()->is_hidden);
        $this->assertFalse($pc->refresh()->is_hidden);
        $this->assertFalse($wall->refresh()->is_hidden);
        $this->assertFalse($ac->refresh()->is_hidden);
        $this->assertSame(0, AdminAuditLog::query()->count());
    }
}

<?php

namespace Tests\Feature;

use App\Models\MemberPage;
use App\Models\MemberPost;
use App\Models\MemberPostComment;
use App\Models\User;
use App\Services\ProfileConfig;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Routing\Middleware\ThrottleRequests;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;
use Tests\TestCase;

class CurhatanTest extends TestCase
{
    use RefreshDatabase;

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

    private function makePost(User $u, string $body, string $visibility = 'public', array $extra = []): MemberPost
    {
        return MemberPost::create(['user_id' => $u->id, 'body' => $body, 'visibility' => $visibility] + $extra);
    }

    /** @return array{0: User, 1: User, 2: User, 3: MemberPost, 4: MemberPost, 5: MemberPost} author, follower, stranger + public/followers/private posts */
    private function scene(): array
    {
        $a = $this->member('ana_a');
        $b = $this->member('budi_b');
        $c = $this->member('cici_c');
        $b->following()->attach($a->id);

        return [$a, $b, $c, $this->makePost($a, 'POST-PUBLIK'), $this->makePost($a, 'POST-PENGIKUT', 'followers'), $this->makePost($a, 'POST-RAHASIA', 'private')];
    }

    protected function tearDown(): void
    {
        File::deleteDirectory(storage_path('app/post-img'));
        parent::tearDown();
    }

    public function test_profile_section_shows_only_what_each_viewer_may_see(): void
    {
        [$a, $b, $c] = $this->scene();

        $this->get($this->base().'/u/ana_a')->assertOk()->assertSee('POST-PUBLIK')->assertDontSee('POST-PENGIKUT')->assertDontSee('POST-RAHASIA')->assertDontSee('Lagi mikirin apa?');
        $this->actingAs($c)->get($this->base().'/u/ana_a')->assertOk()->assertSee('POST-PUBLIK')->assertDontSee('POST-PENGIKUT')->assertDontSee('POST-RAHASIA');
        $this->actingAs($b)->get($this->base().'/u/ana_a')->assertOk()->assertSee('POST-PUBLIK')->assertSee('POST-PENGIKUT')->assertDontSee('POST-RAHASIA');
        $this->actingAs($a)->get($this->base().'/u/ana_a')->assertOk()->assertSee('POST-PUBLIK')->assertSee('POST-PENGIKUT')->assertSee('POST-RAHASIA')->assertSee('Lagi mikirin apa?');
    }

    public function test_direct_urls_enforce_visibility(): void
    {
        [$a, $b, $c, $pub, $fol, $priv] = $this->scene();

        $this->get($this->base().'/u/ana_a/curhatan/'.$pub->id)->assertOk()->assertSee('POST-PUBLIK');
        $this->get($this->base().'/u/ana_a/curhatan/'.$fol->id)->assertNotFound();
        $this->get($this->base().'/u/ana_a/curhatan/'.$priv->id)->assertNotFound();
        $this->get($this->base().'/u/budi_b/curhatan/'.$pub->id)->assertNotFound(); // wrong author in the URL

        $this->actingAs($c)->get($this->base().'/u/ana_a/curhatan/'.$fol->id)->assertNotFound();
        $this->actingAs($b)->get($this->base().'/u/ana_a/curhatan/'.$fol->id)->assertOk()->assertSee('POST-PENGIKUT');
        $this->actingAs($b)->get($this->base().'/u/ana_a/curhatan/'.$priv->id)->assertNotFound();
        $this->actingAs($a)->get($this->base().'/u/ana_a/curhatan/'.$priv->id)->assertOk()->assertSee('POST-RAHASIA');

        // Load-more fragment follows the same rules.
        $this->actingAs($c)->get($this->base().'/u/ana_a/curhatan')->assertOk()->assertSee('POST-PUBLIK')->assertDontSee('POST-PENGIKUT');
    }

    public function test_feeds_terbaru_is_public_only_and_mengikuti_needs_login(): void
    {
        [$a, $b, $c] = $this->scene();

        foreach ([null, $a, $b] as $viewer) {
            $viewer ? $this->actingAs($viewer) : auth()->logout();
            $this->get($this->base().'/komunitas')->assertOk()->assertSee('POST-PUBLIK')->assertDontSee('POST-PENGIKUT')->assertDontSee('POST-RAHASIA');
        }

        $this->actingAs($b)->get($this->base().'/komunitas?tab=mengikuti')->assertOk()->assertSee('POST-PUBLIK')->assertSee('POST-PENGIKUT')->assertDontSee('POST-RAHASIA');
        $this->actingAs($c)->get($this->base().'/komunitas?tab=mengikuti')->assertOk()->assertDontSee('POST-PUBLIK')->assertSee('Belum ada curhatan dari orang yang kamu ikuti');
        auth()->logout();
        $this->get($this->base().'/komunitas?tab=mengikuti')->assertOk()->assertDontSee('POST-PENGIKUT')->assertSee('untuk melihat curhatan dari orang yang kamu ikuti');
    }

    public function test_feed_pagination_load_more_never_repeats(): void
    {
        $a = $this->member('ana_a');
        for ($i = 1; $i <= 12; $i++) {
            $this->makePost($a, 'nomor-'.str_pad((string) $i, 2, '0', STR_PAD_LEFT));
        }
        $first = $this->get($this->base().'/komunitas')->assertOk()->assertSee('nomor-12')->assertSee('nomor-03')->assertDontSee('nomor-02')->getContent();
        preg_match('~data-ch-more="([^"]+)"~', $first, $m);
        $this->assertNotEmpty($m);
        $this->get($this->base().html_entity_decode($m[1]))->assertOk()->assertSee('nomor-02')->assertSee('nomor-01')->assertDontSee('nomor-03')->assertDontSee('<html', false);
    }

    public function test_hidden_posts_and_moderated_profiles_disappear_for_others(): void
    {
        [$a, $b, , $pub] = $this->scene();
        $pub->update(['is_hidden' => true]);
        $this->get($this->base().'/komunitas')->assertDontSee('POST-PUBLIK');
        $this->get($this->base().'/u/ana_a/curhatan/'.$pub->id)->assertNotFound();
        $this->actingAs($a)->get($this->base().'/u/ana_a')->assertSee('POST-PUBLIK')->assertSee('Disembunyikan moderator');

        $pub->update(['is_hidden' => false]);
        MemberPage::where('user_id', $a->id)->update(['status' => 'hidden']);
        auth()->logout();
        $this->get($this->base().'/komunitas')->assertDontSee('POST-PUBLIK');
        $this->actingAs($b)->get($this->base().'/komunitas?tab=mengikuti')->assertDontSee('POST-PENGIKUT');
    }

    public function test_create_post_validates_masks_bad_words_and_reencodes_image(): void
    {
        $a = $this->member('ana_a');
        $this->withoutMiddleware(ThrottleRequests::class); // limits have their own test

        $this->actingAs($a)->post($this->base().'/curhatan', ['body' => '', 'visibility' => 'public'])->assertSessionHasErrors('body');
        $this->actingAs($a)->post($this->base().'/curhatan', ['body' => str_repeat('é', 501), 'visibility' => 'public'])->assertSessionHasErrors('body');
        $this->actingAs($a)->post($this->base().'/curhatan', ['body' => 'halo', 'visibility' => 'semua'])->assertSessionHasErrors('visibility');
        $this->actingAs($a)->post($this->base().'/curhatan', ['body' => 'x', 'visibility' => 'public', 'image' => UploadedFile::fake()->create('a.svg', 2, 'image/svg+xml')])->assertSessionHasErrors('image');
        $this->assertSame(0, MemberPost::count());

        $this->actingAs($a)->post($this->base().'/curhatan', ['body' => str_repeat('é', 500), 'visibility' => 'private'])->assertRedirect();
        $this->actingAs($a)->post($this->base().'/curhatan', ['body' => "dasar anjing\n<b>tebal</b>", 'visibility' => 'public'])->assertRedirect();
        $masked = MemberPost::latest('id')->first();
        $this->assertSame("dasar a*****\n<b>tebal</b>", $masked->body);
        $this->get($this->base().'/u/ana_a')->assertSee('&lt;b&gt;tebal&lt;/b&gt;', false)->assertDontSee('<b>tebal</b>', false);

        // JPEG carrying an EXIF block with a GPS marker: stored as WebP, without the metadata.
        $img = imagecreatetruecolor(40, 30);
        ob_start();
        imagejpeg($img);
        $jpeg = (string) ob_get_clean();
        $exif = "Exif\0\0".'MM'."\0*\0\0\0\x08".'GPSLatitude-SECRET-LOCATION';
        $jpeg = substr($jpeg, 0, 2)."\xFF\xE1".pack('n', strlen($exif) + 2).$exif.substr($jpeg, 2);
        $tmp = tempnam(sys_get_temp_dir(), 'jp').'.jpg';
        file_put_contents($tmp, $jpeg);
        $this->actingAs($a)->post($this->base().'/curhatan', ['body' => '', 'visibility' => 'public', 'image' => new UploadedFile($tmp, 'foto.jpg', 'image/jpeg', null, true)])->assertRedirect();
        $withImage = MemberPost::latest('id')->first();
        $this->assertNotNull($withImage->image);
        $stored = (string) file_get_contents(storage_path('app/post-img/'.$a->id.'/'.$withImage->image));
        $this->assertSame('RIFF', substr($stored, 0, 4));
        $this->assertStringNotContainsString('SECRET-LOCATION', $stored);
    }

    public function test_images_follow_post_visibility_and_cache_rules(): void
    {
        [$a, $b] = $this->scene();
        $dir = storage_path('app/post-img/'.$a->id);
        File::ensureDirectoryExists($dir);
        file_put_contents($dir.'/aaaaaaaaaaaaaaaaaaaa.webp', 'RIFFxxxxWEBP');
        file_put_contents($dir.'/bbbbbbbbbbbbbbbbbbbb.webp', 'RIFFxxxxWEBP');
        $pub = $this->makePost($a, 'gambar publik', 'public', ['image' => 'aaaaaaaaaaaaaaaaaaaa.webp']);
        $fol = $this->makePost($a, 'gambar pengikut', 'followers', ['image' => 'bbbbbbbbbbbbbbbbbbbb.webp']);

        $r = $this->get($this->base().'/curhatan/'.$pub->id.'/gambar')->assertOk();
        $this->assertStringContainsString('public', (string) $r->headers->get('Cache-Control'));
        $this->assertFalse($r->headers->has('Set-Cookie'));
        $this->get($this->base().'/curhatan/'.$fol->id.'/gambar')->assertNotFound();
        $r = $this->actingAs($b)->get($this->base().'/curhatan/'.$fol->id.'/gambar')->assertOk();
        $this->assertStringContainsString('no-store', (string) $r->headers->get('Cache-Control'));
        $this->assertStringNotContainsString('public', (string) $r->headers->get('Cache-Control'));
    }

    public function test_guest_cache_holds_only_public_posts_and_member_views_are_never_public(): void
    {
        [$a, $b, , $pub] = $this->scene();

        $guest = $this->get($this->base().'/komunitas')->assertOk();
        $this->assertStringContainsString('public', (string) $guest->headers->get('Cache-Control'));
        $this->assertFalse($guest->headers->has('Set-Cookie'));
        $this->assertStringNotContainsString('POST-PENGIKUT', (string) $guest->getContent());
        $this->assertStringNotContainsString('name="_token"', (string) $guest->getContent());

        foreach (['/komunitas', '/komunitas?tab=mengikuti', '/komunitas?tab=mengikuti&partial=1'] as $path) {
            $r = $this->actingAs($b)->get($this->base().$path)->assertOk();
            $this->assertStringNotContainsString('public', (string) $r->headers->get('Cache-Control'), $path);
            $this->assertTrue($r->headers->has('X-No-Public-Cache'), $path);
        }

        auth()->logout();
        foreach (['/u/ana_a', '/u/ana_a/curhatan/'.$pub->id, '/u/ana_a/curhatan'] as $path) {
            $this->assertStringNotContainsString('public', (string) $this->get($this->base().$path)->headers->get('Cache-Control'), $path);
        }

        $like = $this->actingAs($b)->postJson($this->base().'/curhatan/'.$pub->id.'/suka')->assertOk();
        $this->assertStringContainsString('no-store', (string) $like->headers->get('Cache-Control'));
        foreach (['curhatan.store', 'curhatan.like', 'curhatan.comment', 'curhatan.report', 'curhatan.destroy', 'curhatan.comment.destroy'] as $name) {
            $route = app('router')->getRoutes()->getByName($name);
            $this->assertSame(['POST'], $route->methods(), $name);
            $this->assertNotContains('public.cache', $route->gatherMiddleware(), $name);
            $this->assertContains('auth', $route->gatherMiddleware(), $name);
        }
    }

    public function test_likes_toggle_and_respect_visibility(): void
    {
        [$a, $b, $c, $pub, $fol, $priv] = $this->scene();

        $this->actingAs($b)->postJson($this->base().'/curhatan/'.$pub->id.'/suka')->assertOk()->assertJson(['liked' => true, 'count' => 1]);
        $this->actingAs($c)->postJson($this->base().'/curhatan/'.$pub->id.'/suka')->assertJson(['liked' => true, 'count' => 2]);
        $this->actingAs($b)->postJson($this->base().'/curhatan/'.$pub->id.'/suka')->assertJson(['liked' => false, 'count' => 1]);
        $this->actingAs($b)->postJson($this->base().'/curhatan/'.$fol->id.'/suka')->assertJson(['liked' => true]);
        $this->actingAs($c)->postJson($this->base().'/curhatan/'.$fol->id.'/suka')->assertNotFound();
        $this->actingAs($b)->postJson($this->base().'/curhatan/'.$priv->id.'/suka')->assertNotFound();
        auth()->logout();
        $this->postJson($this->base().'/curhatan/'.$pub->id.'/suka')->assertUnauthorized();
        $this->assertSame(1, (int) $pub->fresh()->likes_count);
    }

    public function test_comments_create_delete_permissions_and_post_delete(): void
    {
        [$a, $b, $c, $pub, $fol] = $this->scene();

        $this->actingAs($c)->post($this->base().'/curhatan/'.$pub->id.'/komentar', ['body' => 'semangat <script>x</script> bangsat'])->assertRedirect();
        $comment = MemberPostComment::first();
        $this->assertSame('semangat <script>x</script> b******', $comment->body);
        $this->get($this->base().'/u/ana_a')->assertSee('&lt;script&gt;', false)->assertDontSee('<script>x</script>', false);
        $this->actingAs($c)->post($this->base().'/curhatan/'.$fol->id.'/komentar', ['body' => 'intip'])->assertNotFound();
        $this->actingAs($c)->post($this->base().'/curhatan/'.$pub->id.'/komentar', ['body' => str_repeat('a', 301)])->assertSessionHasErrors('body');

        $this->actingAs($b)->post($this->base().'/curhatan/komentar/'.$comment->id.'/hapus')->assertForbidden();
        $this->actingAs($c)->post($this->base().'/curhatan/komentar/'.$comment->id.'/hapus')->assertRedirect();
        $this->assertSame(0, MemberPostComment::count());

        $this->actingAs($b)->post($this->base().'/curhatan/'.$pub->id.'/komentar', ['body' => 'dari budi'])->assertRedirect();
        $this->actingAs($a)->post($this->base().'/curhatan/komentar/'.MemberPostComment::first()->id.'/hapus')->assertRedirect(); // post owner
        $this->assertSame(0, (int) $pub->fresh()->comments_count);

        $this->actingAs($b)->post($this->base().'/curhatan/'.$pub->id.'/hapus')->assertNotFound();
        $this->actingAs($a)->post($this->base().'/curhatan/'.$pub->id.'/hapus')->assertRedirect();
        $this->assertNull(MemberPost::find($pub->id));
    }

    public function test_reports_auto_hide_and_admin_can_hide_and_unhide(): void
    {
        [$a, $b, $c, $pub] = $this->scene();
        $this->actingAs($a)->post($this->base().'/curhatan/'.$pub->id.'/lapor')->assertStatus(422); // not your own
        $this->actingAs($b)->post($this->base().'/curhatan/'.$pub->id.'/lapor', ['reason' => 'spam'])->assertRedirect();
        $this->actingAs($b)->post($this->base().'/curhatan/'.$pub->id.'/lapor')->assertRedirect(); // counted once
        $this->assertSame(1, (int) $pub->fresh()->reports_count);
        $this->actingAs($c)->post($this->base().'/curhatan/'.$pub->id.'/lapor')->assertRedirect();
        $this->actingAs($this->member('dodi_d'))->post($this->base().'/curhatan/'.$pub->id.'/lapor')->assertRedirect();
        $this->assertTrue($pub->fresh()->is_hidden);

        $admin = User::factory()->admin()->create();
        $this->actingAs($admin)->get('http://admin.jadidaring.test/curhatan')->assertOk()->assertSee('POST-PUBLIK')->assertSee('spam');
        $this->actingAs($admin)->post('http://admin.jadidaring.test/curhatan/post/'.$pub->id)->assertRedirect();
        $this->assertFalse($pub->fresh()->is_hidden);
        $this->assertSame(0, (int) $pub->fresh()->reports_count);
        $this->actingAs($admin)->post('http://admin.jadidaring.test/curhatan/post/'.$pub->id)->assertRedirect();
        $this->assertTrue($pub->fresh()->is_hidden);

        $this->actingAs($b)->get('http://admin.jadidaring.test/curhatan')->assertForbidden();
    }

    public function test_rate_limits_on_posting_commenting_and_liking(): void
    {
        [$a, $b, , $pub] = $this->scene();

        for ($i = 0; $i < 5; $i++) {
            $this->actingAs($a)->post($this->base().'/curhatan', ['body' => 'cepat '.$i, 'visibility' => 'public'])->assertRedirect();
        }
        $this->actingAs($a)->post($this->base().'/curhatan', ['body' => 'kebanyakan', 'visibility' => 'public'])->assertStatus(429);

        for ($i = 0; $i < 8; $i++) {
            $this->actingAs($b)->post($this->base().'/curhatan/'.$pub->id.'/komentar', ['body' => 'k'.$i])->assertRedirect();
        }
        $this->actingAs($b)->post($this->base().'/curhatan/'.$pub->id.'/komentar', ['body' => 'lagi'])->assertStatus(429);

        for ($i = 0; $i < 60; $i++) {
            $this->actingAs($b)->postJson($this->base().'/curhatan/'.$pub->id.'/suka');
        }
        $this->actingAs($b)->postJson($this->base().'/curhatan/'.$pub->id.'/suka')->assertStatus(429);
    }

    public function test_account_deletion_cascades_posts_and_images(): void
    {
        [$a, $b, , $pub] = $this->scene();
        $dir = storage_path('app/post-img/'.$a->id);
        File::ensureDirectoryExists($dir);
        file_put_contents($dir.'/cccccccccccccccccccc.webp', 'x');
        DB::table('member_post_likes')->insert(['member_post_id' => $pub->id, 'user_id' => $b->id, 'created_at' => now()]);
        DB::statement('PRAGMA foreign_keys = ON');
        $a->delete();
        $this->assertSame(0, MemberPost::count());
        $this->assertSame(0, DB::table('member_post_likes')->count());
        $this->assertDirectoryDoesNotExist($dir);
    }
}

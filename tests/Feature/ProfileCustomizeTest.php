<?php

namespace Tests\Feature;

use App\Models\MemberPage;
use App\Models\User;
use App\Services\ProfileConfig;
use App\Services\ProfileImage;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\File;
use Tests\TestCase;

class ProfileCustomizeTest extends TestCase
{
    use RefreshDatabase;

    protected function tearDown(): void
    {
        File::deleteDirectory(storage_path('app/profile-img'));
        parent::tearDown();
    }

    private function base(): string
    {
        return 'http://'.config('singlepage.base_domain');
    }

    private function png(int $w = 64, int $h = 40): UploadedFile
    {
        $im = imagecreatetruecolor($w, $h);
        imagefill($im, 0, 0, imagecolorallocate($im, 200, 50, 120));
        ob_start();
        imagepng($im);

        return UploadedFile::fake()->createWithContent('foto.png', (string) ob_get_clean());
    }

    public function test_upload_reencodes_to_webp_and_serves_it_safely(): void
    {
        $u = User::factory()->member()->create();
        $r = $this->actingAs($u)->post($this->base().'/komunitas/halamanku/gambar', ['kind' => 'bg', 'image' => $this->png()], ['Accept' => 'application/json'])->assertCreated();
        $ref = $r->json('url');
        $this->assertMatchesRegularExpression(ProfileImage::REF, $ref);
        $this->assertStringEndsWith('.webp', $ref);
        [$w, $h, $type] = getimagesize(ProfileImage::file($u->id, basename($ref)));
        $this->assertSame(IMAGETYPE_WEBP, $type);
        $this->assertSame([64, 40], [$w, $h]);

        $this->get($this->base().$ref)->assertOk()->assertHeader('Content-Type', 'image/webp')->assertHeader('X-Content-Type-Options', 'nosniff');
        $this->get($this->base().'/gambar-profil/'.$u->id.'/../../.env')->assertNotFound();
        $this->get($this->base().'/gambar-profil/'.$u->id.'/0123456789abcdef0123.webp')->assertNotFound();

        $cfg = ProfileConfig::validate(['theme' => ['bg' => ['type' => 'image', 'image' => $ref]], 'profile' => ['avatar' => $ref]]);
        $this->assertSame($ref, $cfg['theme']['bg']['image']);
        $this->assertSame($ref, $cfg['profile']['avatar']);
        $this->assertStringContainsString('url("'.$ref.'")', ProfileConfig::css($cfg)['bg']);
    }

    public function test_avatar_is_square_and_cursor_gets_three_png_sizes(): void
    {
        $u = User::factory()->member()->create();
        $av = $this->actingAs($u)->post($this->base().'/komunitas/halamanku/gambar', ['kind' => 'avatar', 'image' => $this->png(900, 500)], ['Accept' => 'application/json'])->json('url');
        [$w, $h] = getimagesize(ProfileImage::file($u->id, basename($av)));
        $this->assertSame([320, 320], [$w, $h]);

        $cur = $this->actingAs($u)->post($this->base().'/komunitas/halamanku/gambar', ['kind' => 'cursor', 'image' => $this->png(200, 200)], ['Accept' => 'application/json'])->json('url');
        $this->assertStringEndsWith('-c32.png', $cur);
        foreach ([24, 32, 48] as $s) {
            $this->assertSame([$s, $s], array_slice(getimagesize(ProfileImage::file($u->id, str_replace('-c32', '-c'.$s, basename($cur)))), 0, 2));
        }
        $css = ProfileConfig::css(ProfileConfig::validate(['theme' => ['cursor' => ['url' => $cur, 'size' => 48]]]));
        $this->assertStringContainsString(str_replace('-c32', '-c48', $cur), $css['cursor']);
    }

    public function test_upload_rejects_svg_fake_images_big_files_guests_and_floods(): void
    {
        $u = User::factory()->member()->create();
        $post = fn (array $d) => $this->actingAs($u)->post($this->base().'/komunitas/halamanku/gambar', $d, ['Accept' => 'application/json']);

        $svg = UploadedFile::fake()->createWithContent('x.svg', '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
        $post(['kind' => 'bg', 'image' => $svg])->assertStatus(422);
        $fake = UploadedFile::fake()->createWithContent('x.png', '<?php echo 1; ?> not an image');
        $post(['kind' => 'bg', 'image' => $fake])->assertStatus(422);
        $post(['kind' => 'bg', 'image' => UploadedFile::fake()->create('big.png', 6000, 'image/png')])->assertStatus(422);
        $post(['kind' => 'evil', 'image' => $this->png()])->assertStatus(422);
        $this->assertSame([], glob(storage_path('app/profile-img/'.$u->id.'/*')) ?: []);

        auth()->logout();
        $this->post($this->base().'/komunitas/halamanku/gambar', ['kind' => 'bg', 'image' => $this->png()], ['Accept' => 'application/json'])->assertUnauthorized();

        $u = User::factory()->member()->create();
        $post = fn (array $d) => $this->actingAs($u)->post($this->base().'/komunitas/halamanku/gambar', $d, ['Accept' => 'application/json']);
        for ($i = 0; $i < 8; $i++) {
            $post(['kind' => 'gallery', 'image' => $this->png(30 + $i, 30)])->assertCreated();
        }
        $post(['kind' => 'gallery', 'image' => $this->png()])->assertStatus(429);
    }

    public function test_image_fields_accept_only_https_or_our_own_refs(): void
    {
        foreach (['/gambar-profil/1/../../x.webp', '/gambar-profil/1/0123456789abcdef0123.svg', 'javascript:alert(1)', 'http://x.test/a.png', '/etc/passwd', '/gambar-profil/1/0123456789abcdef0123.webp") ; background:url(x'] as $bad) {
            $c = ProfileConfig::validate(['profile' => ['avatar' => $bad], 'theme' => ['bg' => ['image' => $bad], 'cursor' => ['url' => $bad]], 'widgets' => [['type' => 'gallery', 'items' => [['url' => $bad]]]]]);
            $this->assertSame('', $c['profile']['avatar'], $bad);
            $this->assertSame('', $c['theme']['bg']['image'], $bad);
            $this->assertSame('', $c['theme']['cursor']['url'], $bad);
            $this->assertSame([], $c['widgets'][0]['items'], $bad);
        }
        $this->assertSame('/gambar-profil/12/0123456789abcdef0123.webp', ProfileConfig::image('/gambar-profil/12/0123456789abcdef0123.webp'));
    }

    public function test_old_configs_stay_compatible(): void
    {
        $old = ['theme' => ['bg' => ['type' => 'pattern', 'color' => '#112233', 'pattern' => 'stripes'], 'cursor' => ['url' => 'https://x.test/c.png', 'size' => 20]], 'widgets' => [['type' => 'about']]];
        $c = ProfileConfig::validate($old);
        $this->assertSame('dark', $c['theme']['bg']['ink']);
        $this->assertSame('', $c['theme']['cursor']['preset']);
        $css = ProfileConfig::css($c);
        $this->assertStringContainsString('repeating-linear-gradient(45deg,rgba(0,0,0,.07) 0 8px,transparent 8px 18px),#112233', $css['bg']);
        $this->assertSame('cursor:url("https://x.test/c.png") 0 0,auto;', $css['cursor']);
        $this->assertSame($c, ProfileConfig::validate($c), 'validation is idempotent');

        $u = User::factory()->member()->create(['username' => 'old_cfg']);
        MemberPage::create(['user_id' => $u->id, 'title' => 'P', 'html' => '', 'status' => 'published', 'config' => $old]);
        $this->get($this->base().'/u/old_cfg')->assertOk()->assertSee('#112233', false);
    }

    public function test_every_pattern_preset_and_cursor_is_valid_and_shipped(): void
    {
        $this->assertGreaterThanOrEqual(12, count(ProfileConfig::PATTERNS) - 1);
        foreach (ProfileConfig::PATTERNS as $id) {
            foreach (['dark', 'light'] as $ink) {
                $c = ProfileConfig::validate(['theme' => ['bg' => ['pattern' => $id, 'ink' => $ink]]]);
                $this->assertSame($id, $c['theme']['bg']['pattern']);
                $bg = ProfileConfig::css($c)['bg'];
                $this->assertStringNotContainsString('"', str_replace(['url("data:image/svg+xml,', '")'], '', $bg), $id);
                $this->assertDoesNotMatchRegularExpression('/[<>;{}]/', substr($bg, strlen('background:'), -1), $id);
            }
        }

        $presets = ProfileConfig::presets();
        $this->assertGreaterThanOrEqual(6, count($presets));
        foreach ($presets as $p) {
            $v = ProfileConfig::validate(['theme' => $p['theme']])['theme'];
            unset($v['style']); // colour presets leave the surface style alone
            $this->assertSame($p['theme'], $v, $p['id']);
        }
        $this->assertContains('retro', array_column($presets, 'id'));

        $this->assertGreaterThanOrEqual(6, count(ProfileConfig::CURSORS));
        foreach (array_keys(ProfileConfig::CURSORS) as $id) {
            foreach ([24, 32, 48] as $s) {
                $info = getimagesize(public_path('kursor/'.$id.'-'.$s.'.png'));
                $this->assertSame([$s, $s, IMAGETYPE_PNG], [$info[0], $info[1], $info[2]], $id.$s);
            }
        }
        $css = ProfileConfig::css(ProfileConfig::validate(['theme' => ['cursor' => ['preset' => 'pedang', 'size' => 24]]]));
        $this->assertSame('cursor:url("/kursor/pedang-24.png") 2 2,auto;', $css['cursor']);
        $this->assertSame('', ProfileConfig::validate(['theme' => ['cursor' => ['preset' => '../x']]])['theme']['cursor']['preset']);
    }

    public function test_prompt_spec_and_builder_know_the_new_fields(): void
    {
        $spec = file_get_contents(resource_path('static/prompt-spec.txt'));
        $js = file_get_contents(public_path('js/prompt-builder.js'));
        foreach (['confetti', '"ink"', 'pedang', '/gambar-profil/'] as $needle) {
            $this->assertStringContainsString($needle, $spec);
            $this->assertStringContainsString(trim($needle, '"'), $js);
        }
    }
}

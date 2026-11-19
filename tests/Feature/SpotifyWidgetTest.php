<?php

namespace Tests\Feature;

use App\Models\MemberPageDraft;
use App\Models\User;
use App\Services\EmbedExtractor;
use App\Services\ProfileConfig;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class SpotifyWidgetTest extends TestCase
{
    use RefreshDatabase;

    private const ID = '1bcIiU5FWRa2IYBqx0bk67';

    private const IFRAME = '<iframe data-testid="embed-iframe" style="border-radius:12px" src="https://open.spotify.com/embed/track/1bcIiU5FWRa2IYBqx0bk67?utm_source=generator&si=183d1238d5e24990" width="100%" height="352" frameBorder="0" allowfullscreen="" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="lazy"></iframe>';

    public function test_regex_accepts_links_and_embed_code(): void
    {
        $this->assertSame(['kind' => 'track', 'id' => self::ID], ProfileConfig::spotify(self::IFRAME));
        $this->assertSame(['kind' => 'playlist', 'id' => self::ID], ProfileConfig::spotify('https://open.spotify.com/intl-id/playlist/'.self::ID.'?si=x'));
        foreach (['album', 'episode', 'show', 'artist'] as $k) {
            $this->assertSame($k, ProfileConfig::spotify("https://open.spotify.com/embed/$k/".self::ID)['kind']);
        }
    }

    public function test_regex_rejects_bad_input(): void
    {
        foreach ([
            'https://evil.com/embed/track/'.self::ID,
            'https://open.spotify.com.evil.com/track/'.self::ID,
            'http://open.spotify.com/track/'.self::ID,
            'javascript:alert(1)',
            'https://open.spotify.com/track/short',
            'https://open.spotify.com/track/'.self::ID.'"><script>',
            'https://open.spotify.com/user/'.self::ID,
            '<iframe src="https://evil.com/track/'.self::ID.'"></iframe>',
            '<iframe src="javascript:alert(1)"></iframe>',
            '',
        ] as $bad) {
            $this->assertNull(ProfileConfig::spotify($bad), $bad);
        }
    }

    public function test_extractor_converts_spotify_and_youtube_and_warns_on_others(): void
    {
        $r = EmbedExtractor::extract('<div>hi</div>'.self::IFRAME.'<iframe src="https://www.youtube.com/embed/dQw4w9WgXcQ"></iframe><iframe src="https://evil.com/x"></iframe>');
        $this->assertSame(['spotify', 'youtube'], array_column($r['widgets'], 'type'));
        $this->assertStringNotContainsString('iframe', $r['html']);
        $this->assertContains('Embed Spotify dipindah ke widget Spotify.', $r['notices']);
        $this->assertTrue(collect($r['notices'])->contains(fn ($n) => str_contains($n, 'Iframe tidak diizinkan')));
    }

    public function test_validator_and_render(): void
    {
        $c = ProfileConfig::validate(['widgets' => [['type' => 'spotify', 'url' => self::IFRAME], ['type' => 'spotify', 'url' => 'https://evil.com']]], false);
        $this->assertSame(self::ID, $c['widgets'][0]['id']);
        $this->assertSame('', $c['widgets'][1]['id']);
        $html = view('clay._profile', ['owner' => User::factory()->make(), 'config' => $c, 'views' => 0, 'customHtml' => '', 'frameSrc' => null, 'friendPages' => []])->render();
        $this->assertStringContainsString('https://open.spotify.com/embed/track/'.self::ID, $html);
        $this->assertStringContainsString('allow-same-origin', $html);
        $this->assertStringContainsString('height="352"', $html);
        $this->assertStringNotContainsString('evil.com', $html);
    }

    public function test_saving_custom_html_with_spotify_iframe_creates_widget_and_notice(): void
    {
        $user = User::factory()->create(['username' => 'sptest']);
        $res = $this->actingAs($user)->post('http://jadidaring.test/komunitas/halamanku', ['custom_html' => self::IFRAME]);
        $res->assertRedirect('/komunitas/halamanku');
        $res->assertSessionHas('warn');
        $d = MemberPageDraft::where('user_id', $user->id)->first();
        $this->assertSame('', trim((string) $d->html));
        $this->assertContains('spotify', array_column($d->config['widgets'], 'type'));
    }

    public function test_other_iframe_gets_visible_warning(): void
    {
        $user = User::factory()->create(['username' => 'sptest2']);
        $res = $this->actingAs($user)->post('http://jadidaring.test/komunitas/halamanku', ['custom_html' => '<div><p>halo</p></div><iframe src="https://evil.com"></iframe>']);
        $res->assertSessionHas('warn');
        $this->assertStringContainsString('Iframe tidak diizinkan', json_encode(session('warn')));
    }
}

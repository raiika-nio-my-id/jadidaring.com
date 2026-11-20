<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Exceptions\ThrottleRequestsException;
use Illuminate\Session\TokenMismatchException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Route;
use Symfony\Component\HttpKernel\Exception\HttpException;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

/** Designed error pages: right status, Indonesian copy, branding, noindex, self-contained. */
class ErrorPagesTest extends TestCase
{
    use RefreshDatabase;

    private const SITE = 'http://jadidaring.test';

    protected function setUp(): void
    {
        parent::setUp();
        config(['app.debug' => false]);

        Route::get('/__err/{code}', function (int $code) {
            match ($code) {
                419 => throw new TokenMismatchException,
                429 => throw new ThrottleRequestsException('slow', null, ['Retry-After' => 42]),
                500 => throw new \RuntimeException('boom'),
                default => throw new HttpException($code),
            };
        });
    }

    /** @return array<string, array{int, string}> */
    public static function pages(): array
    {
        return [
            '403' => [403, 'Eits, pintu ini dikunci'],
            '419' => [419, 'Sesinya keburu kedaluwarsa'],
            '429' => [429, 'Pelan-pelan, jaringnya kepenuhan'],
            '500' => [500, 'Waduh, ada yang korslet'],
            '503' => [503, 'Lagi beres-beres sebentar'],
            '4xx' => [418, 'Ada yang kurang pas dengan permintaanmu'],
            '5xx' => [502, 'Server lagi nggak enak badan'],
        ];
    }

    #[DataProvider('pages')]
    public function test_each_error_page_renders_with_status_and_design(int $code, string $title): void
    {
        $res = $this->get(self::SITE.'/__err/'.$code);

        $res->assertStatus($code)
            ->assertHeader('X-Robots-Tag', 'noindex, nofollow')
            ->assertSee('<meta name="robots" content="noindex, nofollow">', false)
            ->assertSee('<html lang="id">', false)
            ->assertSee($title)
            ->assertSee('class="ed-brand__name">Jaring<', false)
            ->assertSee('Jadi Daring')
            ->assertSee('.ed-btn:active', false)
            ->assertDontSee('/build/', false)
            ->assertDontSee('/a/css/', false);
        $this->assertStringContainsString('#D4FF3A', $res->getContent(), 'white logo inlined for dark mode');
        $this->assertStringContainsString('#4D7C0F', $res->getContent(), 'dark-green logo inlined for light mode');
    }

    public function test_random_path_is_designed_404(): void
    {
        $res = $this->get(self::SITE.'/ini-tidak-ada-'.random_int(1000, 9999));

        $res->assertNotFound()
            ->assertSee('Waduh, halamannya nyasar')
            ->assertSee('Kembali ke Beranda')
            ->assertSee('action="http://jadidaring.test/berita"', false)
            ->assertSee('Alamat yang dicoba')
            ->assertSee('class="ed-links__label">Atau mampir ke:', false)
            ->assertSee('<span class="ed-ico" aria-hidden="true">', false);
    }

    public function test_429_keeps_retry_after_and_shows_countdown(): void
    {
        $this->get(self::SITE.'/__err/429')
            ->assertStatus(429)
            ->assertHeader('Retry-After', '42')
            ->assertSee('data-wait="42"', false);
    }

    public function test_429_json_requests_still_get_json(): void
    {
        $this->getJson(self::SITE.'/__err/429')->assertStatus(429)->assertJsonStructure(['message']);
    }

    public function test_500_and_503_render_without_database(): void
    {
        $queries = 0;
        DB::listen(function () use (&$queries) {
            $queries++;
        });
        $saved = ['cache.default' => config('cache.default'), 'session.driver' => config('session.driver')];
        config(['cache.default' => 'does-not-exist', 'session.driver' => 'does-not-exist']);

        foreach (['500', '503', '5xx'] as $view) {
            $html = view('errors.'.$view, ['exception' => new HttpException((int) str_replace('xx', '00', $view))])->render();
            $this->assertStringContainsString('Jaring', $html);
            $this->assertStringContainsString('ed-btn', $html);
        }

        config($saved);
        $this->assertSame(0, $queries, 'error pages must not touch the database');
    }
}

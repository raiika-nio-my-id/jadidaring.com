<?php

namespace Tests\Feature;

use App\Models\CompanyProfile;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CustomPageTest extends TestCase
{
    use RefreshDatabase;

    private const H = 'http://jadidaring.test';

    private function payload(array $o = []): array
    {
        return $o + ['name' => 'Promo Lebaran', 'subdomain' => 'promo-lebaran', 'html' => '<!doctype html><html><head><title>Promo</title></head><body><h1>Promo Lebaran</h1></body></html>', 'status' => 'published', 'expires_at' => '', 'hide_footer' => '1'];
    }

    public function test_guests_are_redirected_and_members_forbidden(): void
    {
        foreach (['/admin/custom-page', '/admin/custom-page/baru'] as $u) {
            $this->get(self::H.$u)->assertRedirectContains('/admin/masuk');
        }
        $this->post(self::H.'/admin/custom-page', $this->payload())->assertRedirectContains('/admin/masuk');
        $this->actingAs(User::factory()->member()->create())->get(self::H.'/admin/custom-page')->assertForbidden();
        $this->post(self::H.'/admin/custom-page', $this->payload())->assertForbidden();
        $this->assertSame(0, CompanyProfile::query()->count());
    }

    public function test_admin_creates_a_page_without_any_account_and_it_never_joins_gamehub(): void
    {
        $this->actingAs(User::factory()->admin()->create());
        $users = User::query()->count();

        $this->get(self::H.'/admin/custom-page/baru')->assertOk()->assertSee('Buat Custom Page')
            ->assertDontSee('name="email"', false)->assertDontSee('name="password"', false)->assertDontSee('GameHub')->assertDontSee('is_game');

        $this->post(self::H.'/admin/custom-page', $this->payload(['is_game' => '1', 'email' => 'x@y.z']))->assertRedirect();
        $page = CompanyProfile::query()->where('subdomain', 'promo-lebaran')->firstOrFail();

        $this->assertNull($page->user_id);
        $this->assertFalse((bool) $page->is_game);
        $this->assertTrue((bool) $page->hide_footer);
        $this->assertNull($page->expires_at);
        $this->assertSame('Promo Lebaran', $page->name);
        $this->assertSame($users, User::query()->count());

        $this->get(self::H.'/promo-lebaran')->assertOk()->assertSee('Promo Lebaran');
        $this->get(self::H.'/game')->assertDontSee('promo-lebaran');
        $this->get(self::H.'/admin/custom-page')->assertOk()->assertSee('Promo Lebaran')->assertSee('Aktif');
        $this->get(self::H.'/admin/game')->assertDontSee('promo-lebaran');
    }

    public function test_edit_status_slug_alias_pin_and_order(): void
    {
        $this->actingAs(User::factory()->admin()->create());
        $this->post(self::H.'/admin/custom-page', $this->payload());
        $this->post(self::H.'/admin/custom-page', $this->payload(['name' => 'Kedua', 'subdomain' => 'halaman-kedua']));
        $a = CompanyProfile::query()->where('subdomain', 'promo-lebaran')->firstOrFail();
        $b = CompanyProfile::query()->where('subdomain', 'halaman-kedua')->firstOrFail();

        $this->get(self::H.'/admin/custom-page/'.$a->id)->assertOk()->assertSee('Belum disimpan')->assertSee('Alias');

        // duplicate slug is refused
        $this->put(self::H.'/admin/custom-page/'.$a->id, $this->payload(['subdomain' => 'halaman-kedua']))->assertSessionHasErrors('subdomain');

        $this->put(self::H.'/admin/custom-page/'.$a->id, $this->payload(['name' => 'Promo Baru', 'subdomain' => 'promo-baru', 'status' => 'draft', 'expires_at' => '2030-01-31', 'hide_footer' => '0', 'is_game' => '1']))->assertRedirect();
        $a->refresh();
        $this->assertSame(['Promo Baru', 'promo-baru', 'draft', '2030-01-31', false, false], [$a->name, $a->subdomain, $a->status->value, $a->expires_at->toDateString(), (bool) $a->hide_footer, (bool) $a->is_game]);
        $this->get(self::H.'/promo-baru')->assertNotFound(); // nonaktif

        $this->post(self::H.'/admin/custom-page/'.$b->id.'/alias', ['alias' => 'kedua-juga'])->assertRedirect();
        $this->get(self::H.'/kedua-juga')->assertStatus(301)->assertRedirectContains('/halaman-kedua');
        $alias = $b->aliases()->firstOrFail();
        $this->post(self::H.'/admin/custom-page/'.$a->id.'/alias', ['alias' => 'kedua-juga'])->assertSessionHasErrors();
        $this->delete(self::H.'/admin/custom-page/'.$a->id.'/alias/'.$alias->id)->assertNotFound(); // alias of another page
        $this->delete(self::H.'/admin/custom-page/'.$b->id.'/alias/'.$alias->id)->assertRedirect();
        $this->assertSame(0, $b->aliases()->count());

        $this->post(self::H.'/admin/custom-page/'.$b->id.'/pin')->assertRedirect();
        $this->assertTrue((bool) $b->fresh()->is_pinned);

        $this->post(self::H.'/admin/custom-page/'.$b->id.'/pin'); // unpin
        $this->post(self::H.'/admin/custom-page/'.$b->id.'/urutan', ['dir' => 'up'])->assertRedirect();
        $this->assertLessThan($a->fresh()->sort_order, $b->fresh()->sort_order);
    }

    public function test_game_profiles_are_not_editable_here(): void
    {
        $this->actingAs(User::factory()->admin()->create());
        $game = CompanyProfile::factory()->game()->create(['user_id' => null]);
        $this->get(self::H.'/admin/custom-page/'.$game->id)->assertNotFound();
        $this->post(self::H.'/admin/custom-page/'.$game->id.'/pin')->assertNotFound();
    }
}

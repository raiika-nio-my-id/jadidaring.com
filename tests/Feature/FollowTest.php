<?php

namespace Tests\Feature;

use App\Models\MemberPage;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class FollowTest extends TestCase
{
    use RefreshDatabase;

    private function base(): string
    {
        return 'http://'.config('singlepage.base_domain');
    }

    private function member(string $username): User
    {
        $u = User::factory()->member()->create(['username' => $username, 'name' => ucfirst($username)]);
        MemberPage::create(['user_id' => $u->id, 'title' => $username, 'html' => '', 'status' => 'published', 'config' => \App\Services\ProfileConfig::defaults()]);

        return $u;
    }

    public function test_follow_unfollow_counts_and_idempotence(): void
    {
        $a = $this->member('aaa_a');
        $b = $this->member('bbb_b');

        $this->actingAs($a)->post($this->base().'/u/bbb_b/ikuti')->assertRedirect();
        $this->actingAs($a)->post($this->base().'/u/bbb_b/ikuti')->assertRedirect(); // double click
        $this->assertSame(1, DB::table('member_follows')->count());

        $this->actingAs($a)->get($this->base().'/u/bbb_b')->assertOk()->assertSee('Berhenti mengikuti')->assertSee('pengikut');
        $this->actingAs($b)->get($this->base().'/u/bbb_b')->assertOk()->assertDontSee('Berhenti mengikuti')->assertDontSee('>Ikuti<', false);

        $this->actingAs($a)->post($this->base().'/u/bbb_b/berhenti-mengikuti')->assertRedirect();
        $this->assertSame(0, DB::table('member_follows')->count());
    }

    public function test_cannot_follow_self_guests_blocked_unknown_user_404(): void
    {
        $a = $this->member('aaa_a');
        $this->actingAs($a)->post($this->base().'/u/aaa_a/ikuti')->assertRedirect();
        $this->assertSame(0, DB::table('member_follows')->count());

        auth()->logout();
        $this->post($this->base().'/u/aaa_a/ikuti')->assertRedirect('/masuk');
        $this->actingAs($a)->post($this->base().'/u/nobody_x/ikuti')->assertNotFound();
    }

    public function test_follow_requires_csrf_and_is_rate_limited(): void
    {
        $a = $this->member('aaa_a');
        $this->member('bbb_b');
        // CSRF is part of the web group (the test kernel skips the token check), and the form carries @csrf.
        $route = app('router')->getRoutes()->getByName('community.follow');
        $this->assertContains('web', $route->gatherMiddleware());
        $this->assertContains('auth', $route->gatherMiddleware());
        $this->actingAs($a);
        $this->actingAs($a)->get($this->base().'/u/bbb_b')->assertSee('name="_token"', false);
        for ($i = 0; $i < 30; $i++) {
            $this->post($this->base().'/u/bbb_b/ikuti');
        }
        $this->post($this->base().'/u/bbb_b/ikuti')->assertStatus(429);
    }

    public function test_lists_and_explore_sorting_and_filter(): void
    {
        $a = $this->member('aaa_a');
        $b = $this->member('bbb_b');
        $c = $this->member('ccc_c');
        $a->following()->attach([$b->id, $c->id]);
        $b->following()->attach($c->id);

        $this->get($this->base().'/u/ccc_c/pengikut')->assertOk()->assertSee('@aaa_a')->assertSee('@bbb_b');
        $this->get($this->base().'/u/aaa_a/mengikuti')->assertOk()->assertSee('@bbb_b')->assertSee('@ccc_c');

        $html = $this->get($this->base().'/komunitas?urut=populer')->assertOk()->getContent();
        $this->assertLessThan(strpos($html, '@bbb_b'), strpos($html, '@ccc_c'));
        $this->assertLessThan(strpos($html, '@aaa_a'), strpos($html, '@bbb_b'));

        $this->actingAs($b)->get($this->base().'/komunitas?urut=mengikuti')->assertOk()->assertSee('@ccc_c')->assertDontSee('@aaa_a');
        auth()->logout();
        $this->get($this->base().'/komunitas?urut=mengikuti')->assertOk()->assertSee('@aaa_a'); // guest falls back to default list
    }

    public function test_follows_cascade_when_a_user_is_deleted(): void
    {
        $a = $this->member('aaa_a');
        $b = $this->member('bbb_b');
        $a->following()->attach($b->id);
        $b->following()->attach($a->id);
        DB::statement('PRAGMA foreign_keys = ON');
        $a->delete();
        $this->assertSame(0, DB::table('member_follows')->count());
        $this->assertNotNull(User::find($b->id));
    }

    public function test_member_can_delete_own_account_with_confirmation(): void
    {
        $a = User::factory()->member()->create(['username' => 'del_me', 'password' => 'secret-pass-1']);
        DB::statement('PRAGMA foreign_keys = ON');

        $this->actingAs($a)->post($this->base().'/akun/hapus', ['confirm' => 'wrong', 'password' => 'secret-pass-1'])->assertSessionHasErrors('confirm');
        $this->actingAs($a)->post($this->base().'/akun/hapus', ['confirm' => 'del_me', 'password' => 'bad'])->assertSessionHasErrors('password');
        $this->assertNotNull(User::find($a->id));

        $this->actingAs($a)->post($this->base().'/akun/hapus', ['confirm' => 'del_me', 'password' => 'secret-pass-1'])->assertRedirect('/');
        $this->assertNull(User::find($a->id));
    }
}

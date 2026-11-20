<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Tests\TestCase;

class TimedBanTest extends TestCase
{
    use RefreshDatabase;

    private const H = 'http://jadidaring.test';

    public function test_admin_bans_for_days_with_reason_and_the_ban_lifts_itself(): void
    {
        Carbon::setTestNow('2026-11-21 02:00:00');
        $admin = User::factory()->admin()->create();
        $m = User::factory()->member()->create(['username' => 'nakal', 'password' => 'rahasia123']);

        $this->actingAs($admin)->get(self::H.'/admin/user/'.$m->id)->assertOk()
            ->assertSee('1 hari')->assertSee('30 hari')->assertSee('Permanen')->assertSee('Pilih tanggal')->assertSee('🗑 Hapus user');

        $this->post(self::H.'/admin/user/'.$m->id.'/blokir', ['duration' => '3', 'reason' => 'spam komentar'])->assertRedirect();
        $m->refresh();
        $this->assertTrue($m->isBanned());
        $this->assertSame('2026-11-24 02:00:00', $m->banned_until->toDateTimeString());
        $this->assertSame('spam komentar', $m->ban_reason);

        $this->get(self::H.'/admin/user?f=diblokir')->assertOk()->assertSee('Diblokir sampai 24 Nov 2026, 10.00 WITA');

        // login refused with the end time
        auth()->logout();
        $this->post(self::H.'/masuk', ['login' => 'nakal', 'password' => 'rahasia123'])
            ->assertSessionHasErrors(['login' => 'Akun ini diblokir oleh admin sampai 24 Nov 2026, 10.00 WITA.']);
        $this->assertGuest();

        // an active session is cut on the next request (comments, curhatan, profile edits go through the same guard)
        $this->actingAs($m)->get(self::H.'/akun')->assertRedirect('/masuk');
        $this->assertGuest();

        Carbon::setTestNow('2026-11-24 02:00:01');
        $this->assertFalse($m->fresh()->isBanned());
        $this->post(self::H.'/masuk', ['login' => 'nakal', 'password' => 'rahasia123'])->assertRedirect();
        $this->assertAuthenticatedAs($m->fresh());
        Carbon::setTestNow();
    }

    public function test_permanent_custom_date_and_unban(): void
    {
        $admin = User::factory()->admin()->create();
        $m = User::factory()->member()->create();
        $this->actingAs($admin);

        $this->post(self::H.'/admin/user/'.$m->id.'/blokir', ['duration' => 'permanen'])->assertRedirect();
        $this->assertTrue($m->fresh()->isBanned());
        $this->assertNull($m->fresh()->banned_until);
        $this->get(self::H.'/admin/user')->assertSee('Diblokir permanen');

        $this->post(self::H.'/admin/user/'.$m->id.'/buka-blokir')->assertRedirect();
        $this->assertFalse($m->fresh()->isBanned());

        $this->post(self::H.'/admin/user/'.$m->id.'/blokir', ['duration' => 'custom'])->assertSessionHasErrors('until');
        $this->post(self::H.'/admin/user/'.$m->id.'/blokir', ['duration' => 'custom', 'until' => now('Asia/Makassar')->subDay()->format('Y-m-d\TH:i')])->assertSessionHasErrors('until');
        $until = now('Asia/Makassar')->addDays(10)->setTime(20, 30);
        $this->post(self::H.'/admin/user/'.$m->id.'/blokir', ['duration' => 'custom', 'until' => $until->format('Y-m-d\TH:i')])->assertRedirect();
        $this->assertSame($until->copy()->utc()->toDateTimeString(), $m->fresh()->banned_until->toDateTimeString());
        $this->post(self::H.'/admin/user/'.$m->id.'/buka-blokir');
        $this->post(self::H.'/admin/user/'.$m->id.'/blokir', ['duration' => 'nope'])->assertSessionHasErrors('duration');
    }

    public function test_admins_cannot_ban_or_delete_themselves_or_other_admins_and_delete_keeps_a_backup(): void
    {
        $admin = User::factory()->admin()->create();
        $other = User::factory()->admin()->create();
        $this->actingAs($admin);

        foreach ([$admin, $other] as $target) {
            $this->post(self::H.'/admin/user/'.$target->id.'/blokir', ['duration' => '1'])->assertSessionHas('toast_error');
            $this->assertFalse($target->fresh()->isBanned());
            $this->delete(self::H.'/admin/user/'.$target->id, ['confirm' => (string) $target->username])->assertSessionHas('toast_error');
            $this->assertModelExists($target);
        }

        $m = User::factory()->member()->create(['username' => 'hapusaku']);
        $before = glob(storage_path('app/backups/deleted-user-*.json')) ?: [];
        $this->delete(self::H.'/admin/user/'.$m->id, ['confirm' => 'salah'])->assertSessionHasErrors('confirm');
        $this->delete(self::H.'/admin/user/'.$m->id, ['confirm' => 'hapusaku'])->assertRedirect(route('panel.users'));
        $this->assertModelMissing($m);
        $this->assertCount(count($before) + 1, glob(storage_path('app/backups/deleted-user-*.json')) ?: []);
    }
}

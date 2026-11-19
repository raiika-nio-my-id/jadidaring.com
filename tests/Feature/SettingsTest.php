<?php

namespace Tests\Feature;

use App\Models\Setting;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class SettingsTest extends TestCase
{
    use RefreshDatabase;

    public function test_settings_page_has_no_gamemaster_secret_field(): void
    {
        $admin = User::factory()->admin()->create();

        $this->actingAs($admin)
            ->get('http://admin.jadidaring.test/settings')
            ->assertOk()
            ->assertDontSee('Gamemaster secret')
            ->assertDontSee('name="gamemaster_secret"', false);
    }

    public function test_saving_settings_ignores_a_gamemaster_secret(): void
    {
        $admin = User::factory()->admin()->create();

        $this->actingAs($admin)
            ->from('http://admin.jadidaring.test/settings')
            ->put('http://admin.jadidaring.test/settings', [
                'reserved_subdomains' => 'www',
                'gamemaster_secret' => 'new-gm-key',
            ])
            ->assertRedirect('http://admin.jadidaring.test/settings')
            ->assertSessionHas('success', 'Settings saved.');

        $this->assertDatabaseMissing('settings', ['key' => 'gamemaster_secret']);
        $this->assertSame('www', Setting::getValue('reserved_subdomains'));
    }
}

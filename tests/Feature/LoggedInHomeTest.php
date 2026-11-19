<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class LoggedInHomeTest extends TestCase
{
    use RefreshDatabase;

    public function test_cached_public_page_sees_logged_in_user_with_cookie(): void
    {
        $user = User::factory()->create();
        $r = $this->actingAs($user)->get('http://jadidaring.test/komunitas');
        $r->assertOk();
        $this->assertStringNotContainsString('>Masuk<', $r->getContent());
    }
}

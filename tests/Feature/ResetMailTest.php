<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Tests\TestCase;

class ResetMailTest extends TestCase
{
    use RefreshDatabase;

    public function test_reset_email_is_indonesian_with_reset_link(): void
    {
        Notification::fake();
        User::factory()->member()->create(['username' => 'siti', 'email' => 'siti@example.com']);
        $this->post('http://jadidaring.test/lupa-password', ['email' => 'siti@example.com'])->assertRedirect();

        Notification::assertSentTo(User::where('username', 'siti')->first(), ResetPassword::class, function ($n, $ch, $user) {
            $mail = $n->toMail($user);

            return $mail->subject === 'Atur ulang kata sandi Jadidaring' && str_contains($mail->actionUrl, '/reset-password/');
        });
    }
}

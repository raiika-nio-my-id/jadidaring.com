<?php

namespace Tests\Feature;

use App\Mail\ContactSubmitted;
use App\Models\ContactMessage;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Tests\TestCase;

class ContactFormTest extends TestCase
{
    use RefreshDatabase;

    private const SITE = 'https://jadidaring.test';

    public function test_valid_submit_with_email_and_correct_captcha_creates_message_and_sends_email(): void
    {
        Mail::fake();

        $t = time() - 10;
        $response = $this->withSession(['contact_captcha' => 12])
            ->post(self::SITE.'/kontak', [
                'name' => 'Budi Utomo',
                'email' => 'budi@example.com',
                'subject' => 'Pertanyaan Kerjasama',
                'message' => 'Halo tim Jadidaring, saya tertarik untuk bekerjasama lebih lanjut.',
                'captcha' => '12',
                't' => $t,
            ]);

        $response->assertRedirect('/kontak');
        $response->assertSessionHas('sent', true);

        $this->assertSame(1, ContactMessage::count());
        $msg = ContactMessage::first();
        $this->assertSame('Budi Utomo', $msg->name);
        $this->assertSame('budi@example.com', $msg->email);
        $this->assertSame('Pertanyaan Kerjasama', $msg->subject);

        Mail::assertSent(ContactSubmitted::class, function (ContactSubmitted $mail) {
            $this->assertTrue($mail->hasTo('admin@jadidaring.com'));
            $this->assertSame('JADIDARING: Kontak dari Budi Utomo', $mail->envelope()->subject);
            $this->assertTrue($mail->hasReplyTo('budi@example.com'));

            $rendered = $mail->render();
            $this->assertStringContainsString('Budi Utomo', $rendered);
            $this->assertStringContainsString('budi@example.com', $rendered);
            $this->assertStringContainsString('Pertanyaan Kerjasama', $rendered);
            $this->assertStringContainsString('Halo tim Jadidaring, saya tertarik untuk bekerjasama lebih lanjut.', $rendered);
            $this->assertStringContainsString('WITA', $rendered);
            $this->assertStringContainsString('/admin/pesan', $rendered);

            return true;
        });
    }

    public function test_valid_submit_without_email_sends_email_with_no_reply_to(): void
    {
        Mail::fake();

        $t = time() - 10;
        $response = $this->withSession(['contact_captcha' => 15])
            ->post(self::SITE.'/kontak', [
                'name' => 'Anonim',
                'subject' => 'Laporan Masalah',
                'message' => 'Ada typo di halaman depan situs Jadidaring.',
                'captcha' => '15',
                't' => $t,
            ]);

        $response->assertRedirect('/kontak');
        $this->assertSame(1, ContactMessage::count());

        Mail::assertSent(ContactSubmitted::class, function (ContactSubmitted $mail) {
            $this->assertTrue($mail->hasTo('admin@jadidaring.com'));
            $this->assertSame('JADIDARING: Kontak dari Anonim', $mail->envelope()->subject);
            $this->assertEmpty($mail->envelope()->replyTo);

            $rendered = $mail->render();
            $this->assertStringContainsString('Anonim', $rendered);
            $this->assertStringContainsString('tidak diisi', $rendered);
            $this->assertStringContainsString('Laporan Masalah', $rendered);
            $this->assertStringContainsString('Ada typo di halaman depan situs Jadidaring.', $rendered);
            $this->assertStringContainsString('WITA', $rendered);
            $this->assertStringContainsString('/admin/pesan', $rendered);

            return true;
        });
    }

    public function test_mail_throwing_does_not_break_submission_and_logs_redacted_error(): void
    {
        Mail::shouldReceive('to')
            ->once()
            ->with('admin@jadidaring.com')
            ->andThrow(new \RuntimeException('SMTP auth failed with xsmtpsib-secret-token-12345 credentials'));

        Log::shouldReceive('error')
            ->once()
            ->withArgs(function (string $message) {
                return str_contains($message, 'Gagal mengirim email kontak untuk pesan id')
                    && str_contains($message, '[redacted]')
                    && ! str_contains($message, 'xsmtpsib-secret-token-12345');
            });

        $t = time() - 10;
        $response = $this->withSession(['contact_captcha' => 8])
            ->post(self::SITE.'/kontak', [
                'name' => 'Siti Aminah',
                'email' => 'siti@example.com',
                'subject' => 'Saran Fitur Baru',
                'message' => 'Bagus sekali situsnya, tolong tambah game tebak gambar ya.',
                'captcha' => '8',
                't' => $t,
            ]);

        $response->assertRedirect('/kontak');
        $response->assertSessionHas('sent', true);
        $this->assertSame(1, ContactMessage::count());
    }

    public function test_honeypot_filled_or_too_fast_silently_redirects_without_creating_message_or_sending_mail(): void
    {
        Mail::fake();

        $t = time() - 10;

        // Honeypot filled
        $r1 = $this->withSession(['contact_captcha' => 10])
            ->post(self::SITE.'/kontak', [
                'name' => 'Spam Bot',
                'email' => 'bot@spam.com',
                'subject' => 'Buy cheap meds',
                'message' => 'Best discounts online at our website today.',
                'captcha' => '10',
                'website' => 'http://spam-link.org',
                't' => $t,
            ]);
        $r1->assertRedirect('/kontak');
        $r1->assertSessionHas('sent', true);
        $this->assertSame(0, ContactMessage::count());
        Mail::assertNothingSent();

        // Too fast (t = time())
        $r2 = $this->withSession(['contact_captcha' => 10])
            ->post(self::SITE.'/kontak', [
                'name' => 'Fast Bot',
                'email' => 'fast@bot.com',
                'subject' => 'Lightning fast',
                'message' => 'Filled form in under 3 seconds.',
                'captcha' => '10',
                't' => time(),
            ]);
        $r2->assertRedirect('/kontak');
        $r2->assertSessionHas('sent', true);
        $this->assertSame(0, ContactMessage::count());
        Mail::assertNothingSent();
    }

    public function test_wrong_or_missing_captcha_fails_validation_and_preserves_input(): void
    {
        Mail::fake();

        $t = time() - 10;

        // Missing captcha
        $r1 = $this->withSession(['contact_captcha' => 9])
            ->post(self::SITE.'/kontak', [
                'name' => 'Doni',
                'email' => 'doni@example.com',
                'subject' => 'Tanya Jadwal',
                'message' => 'Kapan event game berikutnya diadakan?',
                't' => $t,
            ]);
        $r1->assertSessionHasErrors(['captcha']);
        $this->assertSame(0, ContactMessage::count());
        Mail::assertNothingSent();

        // Wrong captcha
        $r2 = $this->withSession(['contact_captcha' => 9])
            ->from(self::SITE.'/kontak')
            ->post(self::SITE.'/kontak', [
                'name' => 'Doni',
                'email' => 'doni@example.com',
                'subject' => 'Tanya Jadwal',
                'message' => 'Kapan event game berikutnya diadakan?',
                'captcha' => '99',
                't' => $t,
            ]);
        $r2->assertSessionHasErrors(['captcha']);
        $r2->assertSessionHasInput('name', 'Doni');
        $r2->assertSessionHasInput('email', 'doni@example.com');
        $r2->assertSessionHasInput('subject', 'Tanya Jadwal');
        $r2->assertSessionHasInput('message', 'Kapan event game berikutnya diadakan?');
        $this->assertSame(0, ContactMessage::count());
        Mail::assertNothingSent();
    }

    public function test_get_kontak_shows_math_question_and_sets_session(): void
    {
        $response = $this->get(self::SITE.'/kontak');
        $response->assertOk();

        // Must show Indonesian math question with 'Berapa' and '+'
        $response->assertSee('Berapa ', false);
        $response->assertSee('+', false);
        $response->assertSee('name="captcha"', false);

        $this->assertNotNull(session('contact_captcha'));
        $this->assertIsInt(session('contact_captcha'));
    }

    public function test_notify_recipient_comes_from_config_and_falls_back_when_invalid(): void
    {
        Mail::fake();
        config(['mail.contact_notify_to' => 'notify@example.com']);

        $t = time() - 10;
        $this->withSession(['contact_captcha' => 7])
            ->post(self::SITE.'/kontak', [
                'name' => 'Sari',
                'subject' => 'Koreksi angka',
                'message' => 'Ada kesalahan angka di artikel teknologi kemarin.',
                'captcha' => '7',
                't' => $t,
            ])
            ->assertRedirect('/kontak');

        Mail::assertSent(ContactSubmitted::class, function (ContactSubmitted $mail) {
            $this->assertTrue($mail->hasTo('notify@example.com'));
            $this->assertFalse($mail->hasTo('admin@jadidaring.com'));

            return true;
        });

        $this->assertSame('admin@jadidaring.com', ContactSubmitted::DEFAULT_RECIPIENT);
        config(['mail.contact_notify_to' => 'not-an-email']);
        $this->assertSame('admin@jadidaring.com', ContactSubmitted::recipient());
    }
}

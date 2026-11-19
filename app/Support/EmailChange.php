<?php

namespace App\Support;

use App\Models\User;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\URL;

class EmailChange
{
    public const MINUTES = 60;

    public static function sendVerification(User $user, string $new): void
    {
        Config::set('app.name', 'Jadidaring');
        $verify = URL::temporarySignedRoute('member.email.verify', now()->addMinutes(self::MINUTES), ['user' => $user->id, 'hash' => sha1($new)]);

        Notification::route('mail', $new)->notify(new class($verify) extends \Illuminate\Notifications\Notification {
            public function __construct(private string $url) {}

            public function via($n): array
            {
                return ['mail'];
            }

            public function toMail($n): MailMessage
            {
                return (new MailMessage)->subject('Verifikasi email Jadidaring')
                    ->greeting('Halo!')
                    ->line('Ada permintaan untuk memakai alamat email ini di akun Jadidaring.')
                    ->action('Verifikasi email', $this->url)
                    ->line('Tautan ini berlaku '.EmailChange::MINUTES.' menit. Email akunmu baru berubah setelah kamu mengklik tautan ini.')
                    ->line('Kalau bukan kamu yang meminta, abaikan saja email ini.')
                    ->salutation('Salam, Tim Jadidaring');
            }
        });

        if (filled($user->email)) {
            $report = URL::temporarySignedRoute('member.email.report', now()->addDays(7), ['user' => $user->id]);
            Notification::route('mail', $user->email)->notify(new class($report, $new) extends \Illuminate\Notifications\Notification {
                public function __construct(private string $url, private string $new) {}

                public function via($n): array
                {
                    return ['mail'];
                }

                public function toMail($n): MailMessage
                {
                    return (new MailMessage)->subject('Permintaan ganti email akun Jadidaring')
                        ->greeting('Halo!')
                        ->line('Ada permintaan mengganti email akun Jadidaring kamu menjadi '.$this->new.'. Emailmu belum berubah sampai alamat baru itu diverifikasi.')
                        ->line('Kalau ini bukan kamu, klik tombol di bawah untuk membatalkan permintaan.')
                        ->action('Bukan aku, batalkan', $this->url)
                        ->salutation('Salam, Tim Jadidaring');
                }
            });
        }
    }
}

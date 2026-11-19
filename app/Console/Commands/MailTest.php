<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\Mail;

/** Sends one plain test message to $TO (env) and prints the mailer error, never credentials. */
class MailTest extends Command
{
    protected $signature = 'mail:test';

    protected $description = 'Send a test email to the address in the TO environment variable';

    public function handle(): int
    {
        $to = (string) getenv('TO');

        if (filter_var($to, FILTER_VALIDATE_EMAIL) === false) {
            $this->error('TO env var must be a valid email.');

            return self::FAILURE;
        }

        $this->line('mailer='.config('mail.default').' host='.config('mail.mailers.smtp.host').' port='.config('mail.mailers.smtp.port').' from='.config('mail.from.address'));

        try {
            Mail::raw('Tes pengiriman email Jadidaring.', fn ($m) => $m->to($to)->subject('Tes email Jadidaring'));
        } catch (\Throwable $e) {
            $this->error(get_class($e).': '.preg_replace('/xsmtpsib-\S+/', '[redacted]', $e->getMessage()));

            return self::FAILURE;
        }

        $this->info('Accepted by SMTP server.');

        return self::SUCCESS;
    }
}

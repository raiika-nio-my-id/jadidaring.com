<?php

namespace App\Mail;

use App\Models\ContactMessage;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Address;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;

class ContactSubmitted extends Mailable
{
    use Queueable;

    public const RECIPIENT = 'admin@jadidaring.com';

    public function __construct(public ContactMessage $contactMessage) {}

    public function envelope(): Envelope
    {
        $replyTo = [];
        if (! empty($this->contactMessage->email) && filter_var($this->contactMessage->email, FILTER_VALIDATE_EMAIL)) {
            $replyTo[] = new Address($this->contactMessage->email, $this->contactMessage->name);
        }

        return new Envelope(
            subject: 'JADIDARING: Kontak dari '.$this->contactMessage->name,
            replyTo: $replyTo,
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'mail.contact-message',
            text: 'mail.contact-message-text',
        );
    }
}

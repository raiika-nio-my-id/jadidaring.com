Pesan kontak baru dari Jadidaring:

Nama: {{ $contactMessage->name }}
Email: {{ $contactMessage->email ?: 'tidak diisi' }}
Subjek: {{ $contactMessage->subject }}
Waktu: {{ $contactMessage->created_at->wita() }}

Pesan:
{{ $contactMessage->message }}

Buka daftar pesan di admin:
{{ route('panel.messages') }}

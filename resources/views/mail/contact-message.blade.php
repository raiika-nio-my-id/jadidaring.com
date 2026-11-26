<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="utf-8">
    <title>{{ $contactMessage->subject }}</title>
</head>
<body style="font-family: sans-serif; line-height: 1.5; color: #111;">
    <h2>Pesan Kontak Baru</h2>
    <p><strong>Nama:</strong> {{ $contactMessage->name }}</p>
    <p><strong>Email:</strong> {{ $contactMessage->email ?: 'tidak diisi' }}</p>
    <p><strong>Subjek:</strong> {{ $contactMessage->subject }}</p>
    <p><strong>Waktu:</strong> {{ $contactMessage->created_at->wita() }}</p>
    <hr>
    <p><strong>Pesan:</strong></p>
    <p style="white-space: pre-wrap;">{{ $contactMessage->message }}</p>
    <hr>
    <p>Buka daftar pesan di admin: <a href="{{ route('panel.messages') }}">{{ route('panel.messages') }}</a></p>
</body>
</html>

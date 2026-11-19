@extends('layouts.clay')

@section('content')
    <div class="clay-auth">
        <div class="clay-card clay-card--lavender">
            <h1 class="clay-section__title">Akunku</h1>
            <p>Masuk sebagai <strong>{{ '@'.$user->username }}</strong> (via {{ ['google' => 'Google', 'github' => 'GitHub', 'telegram' => 'Telegram'][$user->provider] ?? ($user->provider ? ucfirst($user->provider) : 'kata sandi') }}).</p>
            @include('member._form_open')
            <form method="POST" action="{{ route('member.account.name') }}" class="clay-form">
                @csrf
                <label for="name">Nama tampilan (dipakai di semua game)</label>
                <input class="clay-input" id="name" type="text" name="name" value="{{ old('name', $user->name) }}" maxlength="20" minlength="2" required autocomplete="nickname">
                <button class="clay-btn clay-btn--mint" type="submit">Simpan nama</button>
            </form>
            <form method="POST" action="{{ route('member.account.email') }}" class="clay-form">
                @csrf
                <label for="email">Email (untuk reset kata sandi)</label>
                <p class="news-meta">Emailmu saat ini: <strong>{{ $user->email ?? 'belum ada' }}</strong>. Email baru harus diverifikasi lewat tautan yang kami kirim.</p>
                @if ($user->pending_email)<p class="clay-status" role="status">Menunggu verifikasi: <strong>{{ $user->pending_email }}</strong>. Cek kotak masuknya.</p>@endif
                <input class="clay-input" id="email" type="email" name="email" value="{{ old('email') }}" placeholder="email@baru.com" autocomplete="email" required>
                @if ($user->provider === null)
                    <label for="email-password">Kata sandi saat ini</label>
                    <input class="clay-input" id="email-password" type="password" name="current_password" autocomplete="current-password" required>
                @endif
                <button class="clay-btn clay-btn--mint" type="submit">Kirim tautan verifikasi</button>
            </form>
            <div class="clay-actions">
                <form method="POST" action="{{ route('member.logout') }}" class="clay-form">
                    @csrf
                    <button class="clay-btn clay-btn--peach" type="submit">Keluar</button>
                </form>
            </div>
            <details class="clay-card clay-danger-zone">
                <summary>Hapus akun</summary>
                <p class="news-meta">Menghapus akun, profil, draft, dan pengikutmu secara permanen. Skor dan data main tetap ada, tanpa tautan ke akunmu.</p>
                <form method="POST" action="{{ route('member.account.delete') }}" class="clay-form">
                    @csrf
                    <label for="confirm">Ketik <strong>{{ $user->username }}</strong> untuk konfirmasi</label>
                    <input class="clay-input" id="confirm" name="confirm" autocomplete="off" required>
                    @if ($user->password !== null)
                        <label for="del-password">Kata sandi</label>
                        <input class="clay-input" id="del-password" type="password" name="password" autocomplete="current-password" required>
                    @endif
                    <div class="clay-actions"><button class="clay-btn clay-btn--danger" type="submit">Hapus akunku</button></div>
                </form>
            </details>
        </div>
    </div>
@endsection

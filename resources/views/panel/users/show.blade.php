@extends('panel.layout')
@php $panelTitle = 'User '.($user->username ? '@'.$user->username : '#'.$user->id); $prov = ['google' => 'Google', 'github' => 'GitHub', 'telegram' => 'Telegram']; @endphp

@section('panel')
    <div><a class="adm-chip" href="{{ route('panel.users') }}">‹ Semua user</a></div>
    <section class="adm-card">
        <div class="adm-top">
            <h2 style="margin:0">{{ $user->username ? '@'.$user->username : ($user->name ?: '#'.$user->id) }}
                @if ($user->isAdmin())<span class="adm-badge adm-badge--info">Admin</span>@endif
                @if ($user->banned_at)<span class="adm-badge adm-badge--bad">Diblokir</span>@endif
            </h2>
            <div class="adm-row__tools">
                @if ($user->username)<a class="adm-btn" href="/u/{{ $user->username }}" target="_blank" rel="noopener" data-no-skel>Profil ↗</a>@endif
                @if ($page)<a class="adm-btn adm-btn--sky" href="{{ route('panel.community.show', $page->id) }}">Halaman komunitas</a>@endif
            </div>
        </div>
        <dl class="adm-kv">
            <dt>ID</dt><dd>#{{ $user->id }}</dd>
            <dt>Nama</dt><dd>{{ $user->name }}</dd>
            <dt>Email</dt><dd>{{ $user->email ?? '—' }} @if($user->email && $user->email_verified_at)<span class="adm-badge adm-badge--ok">terverifikasi</span>@endif</dd>
            <dt>Jenis akun</dt><dd>{{ ['admin' => 'Admin', 'member' => 'Member', 'client' => 'Klien lama'][$user->role->value] ?? $user->role->value }}</dd>
            <dt>Masuk via</dt><dd>{{ $prov[$user->provider] ?? ($user->provider ?: 'Kata sandi') }}@if($user->provider) <span class="adm-muted">(ID {{ $user->provider_id }})</span>@endif @if($user->provider && $user->password)· juga punya kata sandi @endif</dd>
            <dt>Daftar</dt><dd>{{ $user->created_at?->wita() }}</dd>
            <dt>Login terakhir</dt><dd>{{ $user->last_login_at?->wita() ?? 'belum tercatat (pencatatan mulai 20 Nov 2026)' }}</dd>
            <dt>Sesi aktif</dt><dd>{{ $sessions }}</dd>
            @if ($user->banned_at)<dt>Diblokir sejak</dt><dd>{{ $user->banned_at->wita() }}</dd>@endif
            <dt>Profil komunitas</dt><dd>@if($page) @include('panel._status', ['s' => $page->status]) · 👁 {{ $page->views }} @else — @endif</dd>
        </dl>
    </section>

    <section class="adm-card">
        <h2>Aktivitas</h2>
        <div class="adm-grid">
            @foreach ($counts as $label => $n)
                <div class="adm-stat"><span class="adm-stat__v">{{ number_format($n, 0, ',', '.') }}</span><span class="adm-stat__l">{{ $label }}</span></div>
            @endforeach
        </div>
    </section>

    @unless ($user->isAdmin() || $isSelf)
        <section class="adm-card">
            <h2>Blokir</h2>
            @if ($user->banned_at)
                <p class="adm-muted">User ini tidak bisa masuk atau memposting. Buka blokir untuk mengizinkan lagi.</p>
                <form method="POST" action="{{ route('panel.users.unban', $user->id) }}" data-confirm="Buka blokir {{ '@'.$user->username }}?" data-confirm-ok="Buka blokir" data-confirm-safe>
                    @csrf
                    <button class="adm-btn adm-btn--mint" type="submit">Buka blokir</button>
                </form>
            @else
                <p class="adm-muted">User yang diblokir langsung dikeluarkan dari semua sesi, tidak bisa masuk (kata sandi, Google, GitHub, Telegram), dan tidak bisa memposting atau menyimpan skor. Datanya tetap ada.</p>
                <form class="adm-form" method="POST" action="{{ route('panel.users.ban', $user->id) }}" data-confirm="Blokir {{ '@'.$user->username }}? Dia langsung keluar dari semua sesi." data-confirm-ok="Blokir">
                    @csrf
                    <label for="reason">Alasan (opsional, hanya untuk log)</label>
                    <input class="clay-input" id="reason" name="reason" maxlength="200">
                    <div><button class="adm-btn adm-btn--peach" type="submit">Blokir user</button></div>
                </form>
            @endif
        </section>
    @endunless

    <details class="adm-card adm-danger">
        <summary>Hapus user permanen</summary>
        @if ($deleteRefusal !== null || $isSelf)
            <p class="adm-note adm-note--warn">{{ $deleteRefusal ?? 'Tidak bisa menghapus akunmu sendiri.' }}</p>
        @else
            <p class="adm-muted">Menghapus akun, profil, draft, curhatan, komentar, dan follow. Skor dan data main tetap ada tanpa tautan ke akun. Backup JSON ditulis dulu di server; kalau backup gagal, tidak ada yang dihapus.</p>
            <form class="adm-form" method="POST" action="{{ route('panel.users.destroy', $user->id) }}" data-confirm="Hapus {{ '@'.$user->username }} secara permanen?" data-confirm-title="Hapus user" data-confirm-ok="Hapus permanen">
                @csrf
                @method('DELETE')
                <label for="confirm-user">Ketik <strong>{{ $user->username }}</strong> untuk konfirmasi</label>
                <input class="clay-input" id="confirm-user" name="confirm" autocomplete="off" autocapitalize="off" spellcheck="false" required>
                <div><button class="adm-btn adm-btn--danger" type="submit">Hapus user</button></div>
            </form>
        @endif
    </details>

    @if ($audit->isNotEmpty())
        <section class="adm-card">
            <h2>Riwayat admin untuk user ini</h2>
            @foreach ($audit as $l)
                <div class="adm-act"><span class="adm-act__i">🧾</span><span class="adm-act__t"><strong>{{ $l->action }}</strong> · {{ $l->actor }}@if(!empty($l->meta['reason'])) · “{{ $l->meta['reason'] }}”@endif</span><span class="adm-act__w">{{ $l->created_at?->wita() }}</span></div>
            @endforeach
        </section>
    @endif
@endsection

@extends('panel.layout')
@php $panelTitle = 'User'; $prov = ['google' => 'Google', 'github' => 'GitHub', 'telegram' => 'Telegram']; @endphp

@section('panel')
    <section class="adm-card">
        <form class="adm-search" method="GET" action="{{ route('panel.users') }}" role="search">
            <input class="clay-input" type="search" name="q" value="{{ $q }}" placeholder="Cari username, email, nama, atau ID provider…" aria-label="Cari user">
            <select class="clay-input" name="provider" aria-label="Cara masuk" data-autosubmit>
                <option value="">Semua cara masuk</option>
                <option value="password" @selected($provider === 'password')>Kata sandi</option>
                @foreach ($prov as $k => $v)<option value="{{ $k }}" @selected($provider === $k)>{{ $v }}</option>@endforeach
            </select>
            <select class="clay-input" name="f" aria-label="Jenis akun" data-autosubmit>
                <option value="">Semua akun</option>
                <option value="member" @selected($f === 'member')>Member</option>
                <option value="admin" @selected($f === 'admin')>Admin</option>
                <option value="client" @selected($f === 'client')>Klien lama</option>
                <option value="diblokir" @selected($f === 'diblokir')>Diblokir</option>
            </select>
            <button class="adm-btn adm-btn--primary" type="submit">Cari</button>
        </form>
        <div class="adm-table-wrap" style="margin-top:10px">
            <table class="adm-table">
                <thead><tr><th>User</th><th>Masuk via</th><th>Daftar</th><th>Login terakhir</th><th>Status</th></tr></thead>
                <tbody>
                    @forelse ($users as $u)
                        <tr class="is-link" data-href="{{ route('panel.users.show', $u->id) }}">
                            <td><a class="adm-row__title" href="{{ route('panel.users.show', $u->id) }}">{{ $u->username ? '@'.$u->username : ($u->name ?: '#'.$u->id) }}</a><br><span class="adm-muted">{{ $u->name }}@if($u->email) · {{ $u->email }}@endif</span></td>
                            <td>{{ $prov[$u->provider] ?? ($u->provider ?: 'Kata sandi') }}</td>
                            <td>{{ $u->created_at?->wita() }}</td>
                            <td>{{ $u->last_login_at?->wita() ?? '—' }}</td>
                            <td>
                                @if ($u->role->value === 'admin')<span class="adm-badge adm-badge--info">Admin</span>@elseif($u->role->value === 'client')<span class="adm-badge">Klien</span>@endif
                                @if ($u->banned_at)<span class="adm-badge adm-badge--bad">Diblokir</span>@elseif($u->role->value === 'member')<span class="adm-badge adm-badge--ok">Aktif</span>@endif
                            </td>
                        </tr>
                    @empty
                        <tr><td colspan="5" class="adm-empty">Tidak ada user yang cocok.</td></tr>
                    @endforelse
                </tbody>
            </table>
        </div>
        @include('panel._pager', ['p' => $users])
    </section>
@endsection

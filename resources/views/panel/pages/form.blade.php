@extends('panel.layout')
@php
    $isNew = ! $page->exists;
    $panelTitle = $isNew ? 'Custom Page baru' : 'Edit '.($page->name ?: $page->subdomain);
    $status = old('status', $page->status instanceof \App\Enums\ProfileStatus ? $page->status->value : ($page->status ?: 'draft'));
    $exp = old('expires_at', $page->expires_at ? \Illuminate\Support\Carbon::parse($page->expires_at)->toDateString() : '');
@endphp

@section('panel')
    <a class="adm-chip" href="{{ route('panel.pages') }}" style="align-self:flex-start">‹ Semua Custom Page</a>
    <section class="adm-card">
        <div class="adm-top">
            <h2 style="margin:0">{{ $isNew ? 'Buat Custom Page' : ($page->name ?: $page->subdomain) }} <span class="adm-badge adm-badge--warn" data-dirty-badge hidden>Belum disimpan</span></h2>
            @unless ($isNew)
                <div class="adm-row__tools">
                    <a class="adm-btn" href="/{{ $page->subdomain }}" target="_blank" rel="noopener" data-no-skel>Buka ↗</a>
                    <form method="POST" action="{{ route('panel.pages.pin', $page->id) }}">@csrf<button class="adm-btn {{ $page->is_pinned ? 'adm-btn--peach' : '' }}" type="submit">{{ $page->is_pinned ? 'Lepas pin' : '📌 Pin' }}</button></form>
                </div>
            @endunless
        </div>
        <form class="adm-form" method="POST" action="{{ $isNew ? route('panel.pages.store') : route('panel.pages.update', $page->id) }}" data-dirty-form style="margin-top:12px">
            @csrf
            @unless ($isNew) @method('PUT') @endunless
            <div class="adm-form-grid">
                <div class="adm-form"><label for="name">Nama</label><input class="clay-input" id="name" name="name" value="{{ old('name', $page->name) }}" minlength="2" maxlength="120" required></div>
                <div class="adm-form"><label for="subdomain">Alamat</label><input class="clay-input" id="subdomain" name="subdomain" value="{{ old('subdomain', $page->subdomain) }}" maxlength="63" required pattern="[a-z0-9]([a-z0-9-]*[a-z0-9])?" autocapitalize="off" spellcheck="false" aria-describedby="slug-hint"><p class="adm-muted" id="slug-hint">jadidaring.com/<strong data-slug-preview>{{ old('subdomain', $page->subdomain) ?: 'alamat' }}</strong> · huruf kecil, angka, tanda minus.</p></div>
                <div class="adm-form"><label for="status">Status</label><select class="clay-input" id="status" name="status"><option value="published" @selected($status === 'published')>Aktif</option><option value="draft" @selected($status === 'draft')>Nonaktif</option></select></div>
                <div class="adm-form"><label for="expires_at">Kedaluwarsa (opsional)</label><input class="clay-input" id="expires_at" name="expires_at" type="date" value="{{ $exp }}"><p class="adm-muted">Kosongkan kalau tidak pernah kedaluwarsa.</p></div>
            </div>
            <label class="clay-check"><input type="hidden" name="hide_footer" value="0"><input type="checkbox" name="hide_footer" value="1" @checked(old('hide_footer', $page->hide_footer))> Sembunyikan footer Jadidaring</label>
            <label for="html">HTML</label>
            <textarea class="clay-input adm-body-input" id="html" name="html" required spellcheck="false">{{ old('html', $page->html) }}</textarea>
            <div class="clay-actions"><button class="adm-btn adm-btn--primary" type="submit" style="min-height:48px;padding-inline:28px">{{ $isNew ? 'Buat Custom Page' : 'Simpan perubahan' }}</button></div>
        </form>
    </section>

    @unless ($isNew)
        <section class="adm-card">
            <h3>Alias</h3>
            <p class="adm-muted" style="margin:0 0 10px">Alamat lain yang membuka halaman yang sama.</p>
            <ul class="adm-list">
                @forelse ($page->aliases as $a)
                    <li class="adm-row">
                        <div class="adm-row__main"><span class="adm-row__title">/{{ $a->subdomain }}</span></div>
                        <div class="adm-row__tools">
                            <form method="POST" action="{{ route('panel.pages.alias.destroy', [$page->id, $a->id]) }}" data-confirm="Hapus alias /{{ $a->subdomain }}?" data-confirm-ok="Hapus">@csrf @method('DELETE')<button class="adm-btn adm-btn--danger" type="submit">Hapus</button></form>
                        </div>
                    </li>
                @empty
                    <li class="adm-empty">Belum ada alias.</li>
                @endforelse
            </ul>
            <form class="adm-search" method="POST" action="{{ route('panel.pages.alias.store', $page->id) }}" style="margin-top:12px">
                @csrf
                <input class="clay-input" name="alias" placeholder="alias-baru" maxlength="63" required aria-label="Alias baru" autocapitalize="off" spellcheck="false">
                <button class="adm-btn adm-btn--primary" type="submit">Tambah alias</button>
            </form>
        </section>
    @endunless

    <script>
    (function () {
        var f = document.querySelector('[data-dirty-form]'), badge = document.querySelector('[data-dirty-badge]'), dirty = false;
        if (!f) return;
        var slug = f.querySelector('#subdomain'), prev = document.querySelector('[data-slug-preview]');
        f.addEventListener('input', function (e) {
            if (!dirty) { dirty = true; if (badge) badge.hidden = false; }
            if (e.target === slug && prev) prev.textContent = slug.value || 'alamat';
        });
        f.addEventListener('submit', function () { dirty = false; });
        window.addEventListener('beforeunload', function (e) { if (dirty) { e.preventDefault(); e.returnValue = ''; } });
    })();
    </script>
@endsection

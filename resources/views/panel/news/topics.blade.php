@extends('panel.layout')
@php $panelTitle = 'Topik berita'; @endphp

@section('panel')
    @include('panel.news._sub')
    <p class="adm-muted">Topik yang dimatikan tidak bisa menerbitkan artikel baru (dipakai bot JD News). Batas harian 0 = tanpa batas.</p>
    <div class="adm-cols" style="grid-template-columns:repeat(auto-fill,minmax(280px,1fr))">
        @forelse ($topics as $t)
            <form class="adm-card adm-form" method="POST" action="{{ route('panel.news.topics.update', $t->slug) }}">
                @csrf
                @method('PUT')
                <div class="adm-top"><h2 style="margin:0">{{ $t->name }}</h2><span class="adm-badge">{{ $counts[$t->slug] ?? 0 }} artikel</span></div>
                <span class="adm-muted">/berita/{{ $t->slug }}</span>
                <label for="n-{{ $t->slug }}">Nama</label>
                <input class="clay-input" id="n-{{ $t->slug }}" name="name" value="{{ $t->name }}" maxlength="64" required>
                <div class="adm-form-grid">
                    <div class="adm-form"><label for="a-{{ $t->slug }}">Artikel / hari</label><input class="clay-input" id="a-{{ $t->slug }}" type="number" name="articles_per_day" min="0" max="50" value="{{ $t->articles_per_day }}" required></div>
                    <div class="adm-form"><label for="m-{{ $t->slug }}">Min. sumber</label><input class="clay-input" id="m-{{ $t->slug }}" type="number" name="min_sources" min="2" max="10" value="{{ $t->min_sources }}" required></div>
                </div>
                <label class="clay-check"><input type="checkbox" name="enabled" value="1" @checked($t->enabled)> Aktif</label>
                <div><button class="adm-btn adm-btn--primary" type="submit">Simpan</button></div>
            </form>
        @empty
            <p class="adm-empty">Belum ada topik.</p>
        @endforelse
    </div>
@endsection

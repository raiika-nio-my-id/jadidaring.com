@extends('panel.layout')
@php $panelTitle = 'Tulis Bed Time Story'; $story = null; @endphp

@section('panel')
    <section class="adm-card">
        <h2>Tulis Bed Time Story</h2>
        <form class="adm-form" method="POST" action="{{ route('panel.bedtime.store') }}" enctype="multipart/form-data">
            @csrf
            @include('panel.bedtime._fields', ['story' => null])

            <h3 style="margin-top:10px">Foto (opsional)</h3>
            <p class="adm-muted" style="margin:0">Foto berlisensi bebas (minimal 1200×630 px) atau URL https. Jika foto diberikan, kredit foto wajib diisi. Kalau dikosongkan, kartu judul bermerek dibuat otomatis.</p>
            <input class="clay-input" type="file" name="image" accept="image/jpeg,image/png,image/webp" aria-label="Upload foto cerita">
            <div class="adm-form">
                <label for="image_url">Atau URL gambar (https)</label>
                <input class="clay-input" id="image_url" name="image_url" type="url" value="{{ old('image_url') }}" maxlength="500" placeholder="https://...">
            </div>
            <div class="adm-form-grid">
                <div class="adm-form"><label for="image_alt">Teks alt</label><input class="clay-input" id="image_alt" name="image_alt" value="{{ old('image_alt') }}" maxlength="200"></div>
                <div class="adm-form"><label for="image_credit">Kredit foto</label><input class="clay-input" id="image_credit" name="image_credit" value="{{ old('image_credit') }}" maxlength="200" placeholder="Foto: Nama / Sumber"></div>
                <div class="adm-form"><label for="image_license">Lisensi</label><select class="clay-input" id="image_license" name="image_license"><option value="">— pilih —</option>@foreach ($licenses as $l)<option value="{{ $l }}" @selected(old('image_license') === $l)>{{ $l }}</option>@endforeach</select></div>
                <div class="adm-form"><label for="image_source_url">URL sumber foto</label><input class="clay-input" id="image_source_url" name="image_source_url" type="url" value="{{ old('image_source_url') }}" maxlength="500"></div>
            </div>

            <fieldset class="adm-fieldset">
                <legend>Status</legend>
                <div class="adm-sub">
                    <label class="adm-chip adm-radio"><input type="radio" name="status" value="draft" @checked(old('status', 'draft') === 'draft')> Draft</label>
                    <label class="adm-chip adm-radio"><input type="radio" name="status" value="published" @checked(old('status') === 'published')> Terbit</label>
                </div>
            </fieldset>

            <div class="adm-form">
                <label for="published_at">Waktu Terbit (opsional, kosongkan untuk otomatis saat terbit)</label>
                <input class="clay-input" type="datetime-local" id="published_at" name="published_at" value="{{ old('published_at') }}">
            </div>

            <div class="clay-actions"><button class="adm-btn adm-btn--primary" type="submit" style="min-height:48px;padding-inline:28px">Simpan cerita</button></div>
        </form>
    </section>
@endsection

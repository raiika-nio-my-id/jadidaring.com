@extends('panel.layout')
@php $panelTitle = 'Tulis berita'; $article = null; @endphp

@section('panel')
    @include('panel.news._sub')
    <section class="adm-card">
        <h2>Tulis berita</h2>
        <form class="adm-form" method="POST" action="{{ route('panel.news.store') }}" enctype="multipart/form-data" data-news-create>
            @csrf
            @include('panel.news._fields', ['article' => null])
            <p class="adm-muted" style="margin:0">Alamat otomatis dari judul: <strong>/berita/<span data-topic-preview>{{ array_key_first($topics) }}</span>/<span data-slug-preview>judul-berita</span></strong></p>

            <label for="sources_text">Sumber (minimal 2 dari situs berbeda, satu per baris)</label>
            <textarea class="clay-input" id="sources_text" name="sources_text" rows="4" required placeholder="Kompas | https://www.kompas.com/...&#10;https://www.antaranews.com/...">{{ old('sources_text') }}</textarea>
            <p class="adm-muted" style="margin:0">Format: <code>Judul | https://…</code> atau cukup URL-nya. Harus https dan bukan dari jadidaring.com.</p>

            <h3 style="margin-top:10px">Foto (opsional)</h3>
            <p class="adm-muted" style="margin:0">Hanya foto berlisensi bebas, minimal 1200×630 px. Kalau dikosongkan, kartu judul bermerek dibuat otomatis.</p>
            <input class="clay-input" type="file" name="image" accept="image/jpeg,image/png,image/webp" aria-label="Foto berita">
            <div class="adm-form-grid">
                <div class="adm-form"><label for="image_alt">Teks alt</label><input class="clay-input" id="image_alt" name="image_alt" value="{{ old('image_alt') }}" maxlength="200"></div>
                <div class="adm-form"><label for="image_credit">Kredit foto</label><input class="clay-input" id="image_credit" name="image_credit" value="{{ old('image_credit') }}" maxlength="200" placeholder="Foto: Nama / Sumber"></div>
                <div class="adm-form"><label for="image_license">Lisensi</label><select class="clay-input" id="image_license" name="image_license"><option value="">— pilih —</option>@foreach ($licenses as $l)<option value="{{ $l }}" @selected(old('image_license') === $l)>{{ $l }}</option>@endforeach</select></div>
                <div class="adm-form"><label for="image_source_url">URL sumber foto (https)</label><input class="clay-input" id="image_source_url" name="image_source_url" type="url" value="{{ old('image_source_url') }}" maxlength="500"></div>
            </div>

            <fieldset class="adm-fieldset">
                <legend>Status</legend>
                <div class="adm-sub">
                    <label class="adm-chip adm-radio"><input type="radio" name="status" value="draft" @checked(old('status', 'draft') === 'draft')> Draft</label>
                    <label class="adm-chip adm-radio"><input type="radio" name="status" value="published" @checked(old('status') === 'published')> Terbit</label>
                </div>
            </fieldset>
            <div class="clay-actions"><button class="adm-btn adm-btn--primary" type="submit" style="min-height:48px;padding-inline:28px">Simpan berita</button></div>
        </form>
    </section>
    <script>
    (function () {
        var f = document.querySelector('[data-news-create]'); if (!f) return;
        var t = f.querySelector('#title'), tp = f.querySelector('#topic'), sp = f.querySelector('[data-slug-preview]'), tpp = f.querySelector('[data-topic-preview]');
        function slug(s) { return (s || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80).replace(/-+$/, '') || 'judul-berita'; }
        t.addEventListener('input', function () { sp.textContent = slug(t.value); });
        tp.addEventListener('change', function () { tpp.textContent = tp.value; });
        tpp.textContent = tp.value;
    })();
    </script>
@endsection

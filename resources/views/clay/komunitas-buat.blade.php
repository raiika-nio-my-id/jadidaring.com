@extends('layouts.clay')

@section('content')
    <div class="clay-section">
        <a href="/u/{{ auth()->user()->username }}" class="news-back"><span aria-hidden="true">&larr;</span> Profilku</a>
        <h1 class="clay-section__title">Edit Profil</h1>
        <p class="news-lead">Tata letak profil tetap dari Jadidaring. Kamu mengatur latar, tema, musik, dan widget. Perubahan selalu jadi draft dulu; kamu meninjau lalu menerbitkan.</p>
        @if (session('status'))<p class="clay-status" role="status">{{ session('status') }}</p>@endif
        @if ($errors->any())
            <div class="clay-card clay-card--peach" role="alert"><ul>@foreach ($errors->all() as $e)<li>{{ $e }}</li>@endforeach</ul></div>
        @endif

        @if ($draft)
            <section class="clay-card clay-card--mint" aria-labelledby="draft-h">
                <h2 id="draft-h">Draft baru</h2>
                <p class="news-meta">Pratinjau penuh di bawah belum tayang ({{ $draft->source === 'api' ? 'dikirim lewat kunci sekali pakai' : 'dari editor' }}). Terbitkan untuk menayangkan, Batal untuk membuangnya.</p>
                <div class="clay-actions">
                    <form method="post" action="/komunitas/halamanku/draft/terbitkan">@csrf<button class="clay-btn clay-btn--primary" type="submit">Terbitkan</button></form>
                    <form method="post" action="/komunitas/halamanku/draft/batal">@csrf<button class="clay-btn clay-btn--secondary" type="submit">Batal</button></form>
                </div>
                @include('clay._profile', ['config' => $draftConfig, 'customHtml' => (string) $draft->html, 'frameSrc' => $draftFrame, 'views' => (int) ($page->views ?? 0), 'friendPages' => $friendPages])
            </section>
            <script src="{{ \App\Support\AssetUrl::to('js/member-frame.js') }}" defer></script>
        @endif

        <div class="pf-editor">
        <form id="pf-edit" class="clay-form pf-edit" method="post" action="/komunitas/halamanku" enctype="multipart/form-data"
              data-types='@json(\App\Services\ProfileConfig::WIDGETS)' data-initial='@json($config)' data-csrf="{{ csrf_token() }}" data-preview="/komunitas/halamanku/pratinjau">
            @csrf
            <input type="hidden" name="config" id="pf-config">

            <details class="clay-card clay-card--lavender" open><summary>Impor dari AI</summary>
                <p class="news-meta">Tempel JSON dari AI (isi blok <code>json</code>), lalu muat ke editor.</p>
                <textarea class="clay-input" id="pf-import" rows="4" spellcheck="false" aria-label="JSON dari AI"></textarea>
                <div class="clay-actions"><button class="clay-btn clay-btn--secondary" type="button" id="pf-import-go">Muat ke editor</button></div>
                <p id="pf-import-msg" class="news-comments__msg" role="status" aria-live="polite"></p>
            </details>

            <details class="clay-card" open><summary>Profil</summary>
                <label for="e-tag">Tagline</label><input class="clay-input" id="e-tag" data-path="profile.tagline" maxlength="80">
                <label for="e-st">Status</label><input class="clay-input" id="e-st" data-path="profile.status" maxlength="140">
                <label for="e-ab">Tentang aku</label><textarea class="clay-input" id="e-ab" data-path="profile.about" rows="4" maxlength="1200"></textarea>
                <label for="e-av">URL foto profil (https)</label><input class="clay-input" id="e-av" data-path="profile.avatar" inputmode="url" placeholder="https://…/foto.jpg">
            </details>

            <details class="clay-card"><summary>Latar halaman</summary>
                <label for="e-bt">Jenis latar</label>
                <select class="clay-input" id="e-bt" data-path="theme.bg.type"><option value="gradient">Gradasi</option><option value="color">Warna</option><option value="image">Gambar</option><option value="pattern">Pola</option></select>
                <div class="pb-grid">
                    <div><label for="e-c1">Warna 1</label><input class="pb-color" type="color" id="e-c1" data-path="theme.bg.color"></div>
                    <div><label for="e-c2">Warna 2 (gradasi)</label><input class="pb-color" type="color" id="e-c2" data-path="theme.bg.color2"></div>
                </div>
                <label for="e-an">Sudut gradasi: derajat</label><input class="clay-input" type="number" id="e-an" data-path="theme.bg.angle" min="0" max="360">
                <label for="e-bi">URL gambar latar (https)</label><input class="clay-input" id="e-bi" data-path="theme.bg.image" inputmode="url">
                <label for="e-bp">Pola</label>
                <select class="clay-input" id="e-bp" data-path="theme.bg.pattern"><option value="none">Tanpa pola</option><option value="dots">Titik</option><option value="grid">Kotak</option><option value="stripes">Garis</option></select>
                <label for="e-ov">Gelapkan latar (0–0.8)</label><input class="clay-input" type="number" step="0.05" min="0" max="0.8" id="e-ov" data-path="theme.bg.overlay">
                <label class="pb-check"><input type="checkbox" data-path="theme.bg.fixed"> Latar tetap saat menggulir</label>
            </details>

            <details class="clay-card"><summary>Tema, font &amp; kartu</summary>
                <div class="pb-grid pb-grid--3">
                    <div><label for="e-t1">Teks</label><input class="pb-color" type="color" id="e-t1" data-path="theme.colors.text"></div>
                    <div><label for="e-t2">Aksen</label><input class="pb-color" type="color" id="e-t2" data-path="theme.colors.accent"></div>
                    <div><label for="e-t3">Kartu</label><input class="pb-color" type="color" id="e-t3" data-path="theme.colors.card"></div>
                </div>
                <label for="e-t4">Warna tautan</label><input class="pb-color" type="color" id="e-t4" data-path="theme.colors.link">
                <label for="e-f">Font</label>
                <select class="clay-input" id="e-f" data-path="theme.font">@foreach (\App\Services\ProfileConfig::FONTS as $f)<option>{{ $f }}</option>@endforeach</select>
                <label for="e-r">Sudut kartu (0–40): px</label><input class="clay-input" type="number" id="e-r" data-path="theme.card.radius" min="0" max="40">
                <label for="e-o">Kepekatan kartu (0.3–1)</label><input class="clay-input" type="number" step="0.05" id="e-o" data-path="theme.card.opacity" min="0.3" max="1">
                <label for="e-bl">Blur kartu (0–24): px</label><input class="clay-input" type="number" id="e-bl" data-path="theme.card.blur" min="0" max="24">
                <label for="e-cu">URL kursor kustom (https, gambar kecil)</label><input class="clay-input" id="e-cu" data-path="theme.cursor.url" inputmode="url">
            </details>

            <details class="clay-card"><summary>Musik</summary>
                <label for="e-mu">URL audio (https, .mp3/.ogg/.wav)</label><input class="clay-input" id="e-mu" data-path="music.url" inputmode="url">
                <label for="e-mt">Judul lagu</label><input class="clay-input" id="e-mt" data-path="music.title" maxlength="80">
                <p class="news-meta">Musik tidak autoplay: pengunjung menekan putar.</p>
            </details>

            <details class="clay-card" open><summary>Widget (centang, urutkan)</summary>
                <ul id="pf-widgets" class="pf-wlist"></ul>
                <label for="w_gallery">Galeri: satu per baris <code>url | keterangan</code></label><textarea class="clay-input" id="w_gallery" name="w_gallery" rows="3" spellcheck="false"></textarea>
                <label for="w_links">Tautan: satu per baris <code>label | url</code></label><textarea class="clay-input" id="w_links" name="w_links" rows="3" spellcheck="false"></textarea>
                <label for="w_friends">Top teman: satu username per baris</label><textarea class="clay-input" id="w_friends" name="w_friends" rows="3" spellcheck="false"></textarea>
                <label for="w_quote">Kutipan</label><textarea class="clay-input" id="w_quote" name="w_quote" rows="2" maxlength="300"></textarea>
                <label for="w_quote_author">Penulis kutipan</label><input class="clay-input" id="w_quote_author" name="w_quote_author" maxlength="60">
                <label for="w_youtube">Video YouTube (tautan atau ID)</label><input class="clay-input" id="w_youtube" name="w_youtube" inputmode="url">
                <label for="ch">Widget HTML kustom (opsional, maks. 300 KB, tampil di kotak terisolasi)</label>
                <textarea class="clay-input" id="ch" name="custom_html" rows="6" spellcheck="false">{{ old('custom_html', $customHtml) }}</textarea>
                <label for="cf">atau unggah file .html</label><input class="clay-input" id="cf" type="file" name="file" accept=".html,.htm,.txt">
            </details>

            <div class="clay-actions clay-actions--bar"><button class="clay-btn clay-btn--primary" type="submit">Buat Draft &amp; Pratinjau</button></div>
        </form>
        <aside class="pf-live-wrap" aria-label="Pratinjau langsung"><h2>Pratinjau langsung</h2><div id="pf-live" class="pf-live"></div></aside>
        </div>
    </div>
    <script src="{{ \App\Support\AssetUrl::to('js/profile-editor.js') }}" defer></script>
@endsection

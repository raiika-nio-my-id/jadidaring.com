@extends('layouts.clay')

@section('bodyclass', 'is-profile is-live-edit')

@push('head')
    <link rel="stylesheet" href="{{ \App\Support\AssetUrl::to('css/profile-live.css') }}">
@endpush

@section('content')
    @php
        $isImport = $mode === 'import';
        $boot = [
            'config' => $config,
            'html' => $customHtml,
            'mode' => $mode,
            'username' => $owner->username,
            'hasDraft' => (bool) $draft,
            'csrf' => csrf_token(),
            'preview' => '/komunitas/halamanku/pratinjau',
            'upload' => '/komunitas/halamanku/gambar',
            'autosave' => '/komunitas/halamanku/autosave',
            'prefill' => $prefill,
            'ai' => ['saved' => $aiSaved, 'link' => $widgetLink, 'save' => '/komunitas/buat/simpan', 'reset' => '/komunitas/buat/reset'],
            'fonts' => \App\Services\ProfileConfig::FONTS,
            'types' => \App\Services\ProfileConfig::WIDGETS,
            'patterns' => \App\Services\ProfileConfig::PATTERNS,
            'patternLabels' => \App\Services\ProfileConfig::patternLabels(),
            'patternCss' => \App\Services\ProfileConfig::patternSwatches(),
            'patternInk' => true,
            'uploadEnabled' => true,
            'styles' => \App\Services\ProfileConfig::styleCatalog(),
            'catalog' => \App\Services\ProfileConfig::catalog(),
            'presets' => \App\Services\ProfileConfig::presets(),
            'cursors' => \App\Services\ProfileConfig::cursorPresets(),
        ];
    @endphp
    <div class="member-page le-page" id="le" @if ($isImport) data-jd-view="ai_import_open" @endif>
        <div class="le-top" role="region" aria-label="Mode edit">
            <div class="le-top__txt">
                @if ($isImport)
                    <strong>Pratinjau dari AI, belum tersimpan.</strong>
                    <span>Profilmu yang sekarang tidak berubah sebelum kamu memilih di bar bawah. Ketuk bagian mana pun untuk merapikan.</span>
                @else
                    <strong>Mode edit</strong>
                    <span>Ketuk bagian mana pun di profilmu untuk mengubahnya. Semua perubahan jadi draft dulu.</span>
                @endif
            </div>
            <div class="le-chips" role="toolbar" aria-label="Pengaturan cepat">
                <button type="button" class="le-chip" data-open="theme"><span aria-hidden="true">🎨</span> Tema</button>
                <button type="button" class="le-chip" data-open="bg"><span aria-hidden="true">🖼️</span> Latar</button>
                <button type="button" class="le-chip" data-open="cursor"><span aria-hidden="true">🖱️</span> Kursor</button>
                <button type="button" class="le-chip le-chip--add" data-open="add"><span aria-hidden="true">＋</span> Tambah kotak</button>
                <button type="button" class="le-chip" data-open="order"><span aria-hidden="true">↕️</span> Susun</button>
                <button type="button" class="le-chip" data-open="ai" aria-haspopup="dialog"><span aria-hidden="true">✨</span> Buat widget pakai AI</button>
                <button type="button" class="le-chip le-chip--ghost" id="le-peek" aria-pressed="false"><span aria-hidden="true">👁️</span> Lihat sebagai pengunjung</button>
            </div>
        </div>

        @if (session('status'))<div class="pf-alert pf-alert--ok" role="status">{{ session('status') }}</div>@endif
        @if (session('warn'))<div class="pf-alert pf-alert--warn" role="status"><strong>Perhatian</strong><ul>@foreach ((array) session('warn') as $wn)<li>{{ $wn }}</li>@endforeach</ul></div>@endif
        @if ($errors->any())
            <div class="pf-alert pf-alert--err" role="alert"><strong>Ada yang perlu diperbaiki</strong><ul>@foreach ($errors->all() as $e)<li>{{ $e }}</li>@endforeach</ul></div>
        @endif
        @if ($fixes)
            <div class="imp-fix" role="status">
                <strong>Beberapa nilai diperbaiki otomatis agar sesuai batas:</strong>
                <ul>@foreach ($fixes as $f)<li><mark>{{ $f['path'] }}</mark>: {{ $f['from'] }} &rarr; <mark>{{ $f['to'] }}</mark></li>@endforeach</ul>
            </div>
        @endif
        @if ($isImport)
            @php
                $bg = $config['theme']['bg']; $col = $config['theme']['colors']; $card = $config['theme']['card'];
                $types = array_column($config['widgets'], 'type');
                $links = 0; foreach ($config['widgets'] as $w) { if (($w['type'] ?? '') === 'links') { $links += count($w['items'] ?? []); } }
            @endphp
            <details class="clay-card imp-sum">
                <summary>Ringkasan perubahan</summary>
                <ul>
                    <li><strong>Latar:</strong> {{ $bg['type'] }} {{ $bg['color'] }}@if($bg['type']==='gradient') &rarr; {{ $bg['color2'] }} ({{ $bg['angle'] }}&deg;)@endif, pola {{ $bg['pattern'] }}@if($bg["fixed"]), tetap @endif</li>
                    <li><strong>Warna:</strong> teks {{ $col['text'] }}, aksen {{ $col['accent'] }}, kartu {{ $col['card'] }}, tautan {{ $col['link'] }}</li>
                    <li><strong>Font:</strong> {{ $config['theme']['font'] }}</li>
                    <li><strong>Kartu:</strong> sudut {{ $card['radius'] }}px, kepekatan {{ $card['opacity'] }}, blur {{ $card['blur'] }}px</li>
                    <li><strong>Widget:</strong> {{ count($types) }} ({{ implode(', ', $types) ?: 'tidak ada' }})@if($links), {{ $links }} tautan @endif</li>
                    @if ($config['profile']['tagline'] !== '')<li><strong>Tagline:</strong> {{ $config['profile']['tagline'] }}</li>@endif
                    <li><strong>Musik:</strong> {{ ($config['music']['url'] ?? '') !== '' ? 'ada' : 'tidak ada' }}, <strong>kursor kustom:</strong> {{ ($config['theme']['cursor']['url'] ?? '') !== '' ? 'ada' : 'tidak ada' }}</li>
                </ul>
            </details>
        @endif
        @if ($draft && ! $isImport)
            <div class="le-draft" role="status"><span class="le-badge">Draft baru</span> Draft ini belum tayang ({{ $draft->source === 'api' ? 'dikirim lewat kunci sekali pakai' : 'dari editor' }}). Tekan <strong>Terbitkan</strong> untuk menayangkan.</div>
        @endif

        <div id="le-stage" class="le-stage" data-editing="1">
            @include('clay._profile', ['edit' => true])
        </div>

        <section class="clay-card clay-card--lavender news-comments pf-wall le-wall" data-edit="wall" data-fixed="1" aria-label="Komentar &amp; Testimoni (kotak tetap)">
            <h2>Komentar &amp; Testimoni</h2>
            <p class="news-comments__hint">Kolom komentar selalu ada di bawah profilmu dan tidak bisa dihapus. Pengunjung yang masuk bisa menulis di sini.</p>
        </section>
    </div>

    <aside id="le-panel" class="le-panel" aria-labelledby="le-panel-title" hidden>
        <div class="le-panel__grip" aria-hidden="true"></div>
        <header class="le-panel__head">
            <div>
                <h2 id="le-panel-title">Pengaturan</h2>
                <p id="le-panel-hint" class="le-panel__hint"></p>
            </div>
            <button type="button" class="le-x" id="le-close" aria-label="Tutup panel">✕</button>
        </header>
        <div id="le-panel-body" class="le-panel__body"></div>
    </aside>

    <form id="le-form" class="le-bar" method="post" action="/komunitas/halamanku" novalidate>
        @csrf
        <input type="hidden" name="config" id="le-config">
        <textarea name="custom_html" id="le-html" hidden></textarea>
        <input type="hidden" name="action" id="le-action" value="draft">
        <input type="hidden" name="source" value="{{ $isImport ? 'ai_import' : 'editor' }}">
        <p class="le-bar__state" id="le-state" role="status" aria-live="polite">{{ $isImport ? 'Belum tersimpan' : ($draft ? 'Draft belum tayang' : 'Belum ada perubahan') }}</p>
        <div class="le-bar__btns">
            <button type="button" class="clay-btn clay-btn--secondary le-btn" id="le-cancel">Batal</button>
            <button type="submit" class="clay-btn clay-btn--secondary le-btn" id="le-save" data-action="draft">{{ $isImport ? 'Simpan sebagai draft' : 'Simpan draft' }}</button>
            <button type="submit" class="clay-btn clay-btn--cta le-btn" id="le-publish" data-action="publish">{{ $isImport ? 'Terbitkan sekarang' : 'Terbitkan' }}</button>
        </div>
    </form>
    <form id="le-discard" method="post" action="/komunitas/halamanku/draft/batal" hidden>@csrf</form>

    <script type="application/json" id="le-boot">{!! json_encode($boot, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT) !!}</script>
    <script src="{{ \App\Support\AssetUrl::to('js/member-frame.js') }}" defer></script>
    <script src="{{ \App\Support\AssetUrl::to('js/jd-crop.js') }}" defer></script>
    <script src="{{ \App\Support\AssetUrl::to('js/profile-live.js') }}" defer></script>
    <script src="{{ \App\Support\AssetUrl::to('js/profile-ai-widget.js') }}" defer></script>
@endsection

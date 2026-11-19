@extends('layouts.clay')

@section('content')
    <div class="clay-section imp-page"@if (! $error) data-jd-view="ai_import_open"@endif>
        @if ($error)
            <a href="/komunitas/halamanku" class="news-back"><span aria-hidden="true">&larr;</span> Edit profil</a>
            <h1 class="clay-section__title">Pratinjau dari AI</h1>
            <div class="pf-alert pf-alert--err" role="alert">
                <strong>Tautan ini tidak bisa dibaca.</strong> {{ $error }}
                <p class="news-meta">Tautan yang sangat panjang kadang terpotong oleh aplikasi chat. Minta AI menampilkan JSON-nya, lalu tempel di kotak <strong>Tempel JSON dari AI</strong> pada halaman edit.</p>
            </div>
            <div class="clay-actions"><a class="clay-btn clay-btn--cta" href="/komunitas/halamanku">Buka editor</a></div>
        @else
            @php
                $bg = $config['theme']['bg']; $col = $config['theme']['colors']; $card = $config['theme']['card'];
                $types = array_column($config['widgets'], 'type');
                $links = 0; foreach ($config['widgets'] as $w) { if (($w['type'] ?? '') === 'links') { $links += count($w['items'] ?? []); } }
            @endphp
            <form method="post" action="/komunitas/halamanku/import" class="imp-bar" id="imp-form">
                @csrf
                <input type="hidden" name="config" value="{{ json_encode($config, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) }}">
                <div class="imp-bar__txt"><strong>Pratinjau dari AI, belum tersimpan.</strong> <span>Pilih salah satu di bawah. Profilmu yang sekarang tidak berubah sebelum kamu memilih.</span></div>
                <div class="imp-actions">
                    <button class="clay-btn clay-btn--cta" type="submit" name="action" value="publish">Terbitkan sekarang</button>
                    <button class="clay-btn clay-btn--secondary imp-btn" type="submit" name="action" value="draft">Simpan sebagai draft</button>
                    <a class="clay-btn clay-btn--secondary imp-btn" href="/komunitas/halamanku">Batal</a>
                </div>
            </form>

            @if ($fixes)
                <div class="imp-fix" role="status">
                    <strong>Beberapa nilai diperbaiki otomatis agar sesuai batas:</strong>
                    <ul>@foreach ($fixes as $f)<li><mark>{{ $f['path'] }}</mark>: {{ $f['from'] }} &rarr; <mark>{{ $f['to'] }}</mark></li>@endforeach</ul>
                </div>
            @endif

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

            <div class="imp-preview">
                @include('clay._profile', ['config' => $config, 'customHtml' => '', 'frameSrc' => null, 'friendPages' => $friendPages, 'views' => $views])
            </div>
        @endif
    </div>
@endsection

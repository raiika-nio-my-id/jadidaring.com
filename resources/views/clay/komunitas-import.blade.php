@extends('layouts.clay')

@section('content')
    <div class="clay-section">
        <a href="/komunitas/halamanku" class="news-back"><span aria-hidden="true">&larr;</span> Edit profil</a>
        <h1 class="clay-section__title">Impor profil dari AI</h1>
        @if ($error)
            <div class="clay-card clay-card--peach" role="alert">
                <p><strong>Tautan ini tidak bisa dipakai.</strong> {{ $error }}</p>
                <p class="news-meta">Tautan yang sangat panjang kadang terpotong oleh aplikasi chat. Minta AI menampilkan JSON-nya, lalu tempel di kotak <strong>Tempel JSON dari AI</strong> pada halaman edit.</p>
                <div class="clay-actions"><a class="clay-btn clay-btn--primary" href="/komunitas/halamanku">Buka editor</a></div>
            </div>
        @else
            <p class="news-lead">Ini pratinjau profil dari tautan AI. <strong>Belum disimpan dan belum tayang.</strong> Tekan "Simpan sebagai draft" untuk menyimpan; setelah itu kamu masih bisa meninjau, lalu memilih Terbitkan atau Batal.</p>
            <form method="post" action="/komunitas/halamanku/import" class="clay-actions clay-actions--solid">
                @csrf
                <input type="hidden" name="config" value="{{ json_encode($config, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) }}">
                <button class="clay-btn clay-btn--primary clay-btn--cta" type="submit">Simpan sebagai draft &amp; lihat pratinjau</button>
                <a class="clay-btn clay-btn--secondary" href="/komunitas/halamanku">Batal</a>
            </form>
            @include('clay._profile', ['config' => $config, 'customHtml' => '', 'frameSrc' => null, 'friendPages' => $friendPages, 'views' => $views])
        @endif
    </div>
@endsection

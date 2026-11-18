@extends('layouts.clay')

@section('content')
    <div class="clay-section news-article">
        <a href="/komunitas" class="news-back"><span aria-hidden="true">&larr;</span> Kembali ke Komunitas</a>
        <h1 class="clay-section__title">Halaman Saya</h1>
        <p class="news-lead">Tempel kode HTML dari AI (atau biarkan AI mengirim draft lewat kunci dari builder). Hasilnya selalu jadi draft dulu; kamu meninjau lalu menerbitkan. Kodenya dibersihkan otomatis: skrip dari luar daftar CDN tepercaya, form password, dan pengalihan otomatis dihapus atau ditolak.</p>
        @if (session('status'))<p class="clay-status" role="status">{{ session('status') }}</p>@endif
        @if ($draft)
            <section class="clay-card clay-card--mint" aria-labelledby="draft-h">
                <h2 id="draft-h">Draft baru: {{ $draft->title }}</h2>
                <p class="news-meta">Pratinjau di bawah belum tayang ({{ $draft->source === 'api' ? 'dikirim lewat kunci sekali pakai' : 'dari tempel/unggah' }}). Pilih Terbitkan untuk menayangkan atau Batal untuk membuangnya.</p>
                <div class="member-frame">
                    <iframe id="member-frame" title="Pratinjau draft" src="{{ $draftFrame }}"
                        sandbox="allow-scripts allow-popups" allow="" referrerpolicy="no-referrer" loading="eager"
                        data-min="320" data-max="8000" style="height:70vh"></iframe>
                </div>
                <div class="pb-actions">
                    <form method="post" action="/komunitas/halamanku/draft/terbitkan">@csrf<button class="clay-btn clay-btn--primary" type="submit">Terbitkan</button></form>
                    <form method="post" action="/komunitas/halamanku/draft/batal">@csrf<button class="clay-btn clay-btn--peach" type="submit">Batal</button></form>
                </div>
            </section>
            <script src="{{ \App\Support\AssetUrl::to('js/member-frame.js') }}" defer></script>
        @endif
        @if ($errors->any())
            <div class="clay-card clay-card--peach" role="alert"><ul>@foreach ($errors->all() as $e)<li>{{ $e }}</li>@endforeach</ul></div>
        @endif
        <form class="clay-form" method="post" action="/komunitas/halamanku" enctype="multipart/form-data">
            @csrf
            <label for="t">Judul halaman</label>
            <input class="clay-input" id="t" name="title" maxlength="120" required value="{{ old('title', $page?->title) }}">
            <label for="h">Kode HTML (maks. 300 KB)</label>
            <textarea class="clay-input" id="h" name="html" rows="14" spellcheck="false" placeholder="&lt;!DOCTYPE html&gt; ...">{{ old('html') }}</textarea>
            <label for="f">atau unggah file .html</label>
            <input class="clay-input" id="f" type="file" name="file" accept=".html,.htm,.txt">
            <button class="clay-btn clay-btn--primary" type="submit">Buat Draft &amp; Pratinjau</button>
        </form>
        @if ($page)<p><a href="/u/{{ auth()->user()->username }}">Lihat halamanku</a></p>@endif
    </div>
@endsection

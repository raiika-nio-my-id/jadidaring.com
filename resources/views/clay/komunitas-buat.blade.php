@extends('layouts.clay')

@section('content')
    <div class="clay-section news-article">
        <a href="/komunitas" class="news-back"><span aria-hidden="true">&larr;</span> Kembali ke Komunitas</a>
        <h1 class="clay-section__title">Halaman Saya</h1>
        <p class="news-lead">Tempel kode HTML dari AI. Kami membersihkan kodenya otomatis: skrip luar, form password, dan pengalihan otomatis dihapus atau ditolak.</p>
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
            <button class="clay-btn clay-btn--primary" type="submit">Simpan &amp; Tayangkan</button>
        </form>
        @if ($page)<p><a href="/u/{{ auth()->user()->username }}">Lihat halamanku</a></p>@endif
    </div>
@endsection

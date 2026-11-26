@extends('layouts.clay')
@section('content')
<div class="clay-section">
    <article class="clay-card page-doc">
        <h1 class="clay-section__title">Redaksi</h1>
        <p>Halaman ini menjelaskan siapa yang menerbitkan berita di Jadidaring dan bagaimana artikel disusun.</p>

        <h2>Pengelola</h2>
        <p>Situs ini dikelola oleh Andika dan Tim Jadidaring. Kami tidak memiliki wartawan tetap. Artikel diterbitkan atas nama byline <strong>Redaksi Jaring</strong>; itu nama redaksi, bukan nama orang.</p>

        <h2>Cara artikel disusun</h2>
        <p>Berita kami dirangkum dari laporan media lain. Artikel disusun dengan bantuan asisten AI yang merangkum sumber-sumber tersebut. Daftar sumber selalu ditampilkan di bagian bawah artikel.</p>
        <p>Artikel tidak ditulis oleh wartawan, dan belum tentu ditinjau satu per satu oleh editor manusia sebelum terbit. Untuk keputusan penting (hukum, keuangan, kesehatan, keselamatan), rujuk langsung ke sumber aslinya.</p>

        <h2>Kebijakan dan kontak</h2>
        <p>Aturan sumber, gambar, dan penulisan ada di <a href="/kebijakan-redaksi">Kebijakan Redaksi</a>. Cara melaporkan kesalahan ada di <a href="/kebijakan-koreksi">Kebijakan Koreksi</a>. Pertanyaan atau laporan bisa dikirim lewat <a href="/kontak">formulir kontak</a>.</p>
        <p class="page-doc__date">Diperbarui: {{ \Carbon\Carbon::parse($updated)->locale('id')->translatedFormat('d F Y') }}</p>
    </article>
</div>
@endsection

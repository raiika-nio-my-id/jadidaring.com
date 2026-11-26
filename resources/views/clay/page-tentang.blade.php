@extends('layouts.clay')
@section('content')
<div class="clay-section">
    <article class="clay-card page-doc">
        <h1 class="clay-section__title">Tentang Jadidaring</h1>
        <p>Jadidaring adalah situs untuk pembaca dan pemain di Indonesia. Isinya tiga hal: <a href="/game">game</a> yang bisa dimainkan langsung di peramban tanpa mengunduh aplikasi, <a href="/berita">berita</a> ringkas dari berbagai topik, dan <a href="/komunitas">komunitas</a> tempat anggota membuat halaman profil mereka sendiri.</p>
        <h2>Berita</h2>
        <p>Berita kami dirangkum dari laporan media lain dan selalu mencantumkan sumbernya di bagian bawah artikel. Siapa yang menerbitkan berita dijelaskan di <a href="/redaksi">Redaksi</a>. Aturan lengkapnya ada di <a href="/kebijakan-redaksi">Kebijakan Redaksi</a>, termasuk keterbukaan bahwa penulisan dibantu AI.</p>
        <h2>Game dan komunitas</h2>
        <p>Game berjalan di peramban dan sebagian mendukung bermain bersama secara langsung. Anggota yang masuk dapat menyimpan skor, membuat halaman profil, saling mengikuti, dan menulis komentar.</p>
        <h2>Hubungi kami</h2>
        <p>Pertanyaan, koreksi berita, atau laporan masalah bisa dikirim lewat <a href="/kontak">formulir kontak</a>.</p>
        <p class="page-doc__date">Diperbarui: {{ \Carbon\Carbon::parse($updated)->locale('id')->translatedFormat('d F Y') }}</p>
    </article>
</div>
@endsection

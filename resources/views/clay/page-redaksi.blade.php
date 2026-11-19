@extends('layouts.clay')
@section('content')
<div class="clay-section">
    <article class="clay-card page-doc">
        <h1 class="clay-section__title">Kebijakan Redaksi</h1>
        <h2>Sumber</h2>
        <p>Setiap berita yang kami terbitkan merujuk sedikitnya <strong>dua sumber dari situs yang berbeda</strong>. Daftar sumber ditampilkan di bagian "Sumber" pada tiap artikel agar pembaca bisa memeriksanya sendiri. Kami meringkas dan menulis ulang dengan kalimat sendiri, tidak menyalin artikel media lain.</p>
        <p>Jika sumber-sumber berbeda angka atau keterangan, kami menyebutkan perbedaannya. Informasi yang belum terkonfirmasi ditandai sebagai klaim atau dugaan.</p>
        <h2>Penulisan dibantu AI</h2>
        <p>Artikel di Jadidaring disusun dengan bantuan asisten AI yang merangkum sumber-sumber di atas. Artikel tidak ditulis oleh wartawan, dan belum tentu ditinjau satu per satu oleh editor manusia sebelum terbit. Karena itu, untuk keputusan penting (hukum, keuangan, kesehatan, keselamatan), rujuk langsung ke sumber aslinya.</p>
        <h2>Berita saham, harga emas, dan kurs</h2>
        <p>Konten ini hanya informasi dan bukan saran investasi.</p>
        <h2>Gambar</h2>
        <p>Foto yang dipakai berlisensi bebas dan kreditnya ditampilkan di bawah gambar. Artikel tanpa foto memakai kartu judul yang dibuat otomatis oleh program, bukan foto peristiwa dan bukan gambar buatan AI.</p>
        <h2>Koreksi</h2>
        <p>Menemukan kesalahan? Kirim lewat <a href="/kontak">formulir kontak</a> dengan menyebut judul artikelnya. Kami akan memeriksa dan memperbaiki artikel; bila perubahannya berarti, kami menambahkan catatan koreksi pada artikel.</p>
        <p class="page-doc__date">Diperbarui: {{ \Carbon\Carbon::parse($updated)->locale('id')->translatedFormat('d F Y') }}</p>
    </article>
</div>
@endsection

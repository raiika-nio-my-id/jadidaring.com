@extends('layouts.clay')
@section('content')
<div class="clay-section">
    <article class="clay-card page-doc">
        <h1 class="clay-section__title">Kebijakan Koreksi</h1>
        <p>Jika Anda menemukan kesalahan pada artikel Jadidaring, kami ingin memperbaikinya.</p>

        <h2>Cara melapor</h2>
        <p>Kirim laporan lewat <a href="/kontak">formulir kontak</a>. Sertakan:</p>
        <ul>
            <li>Judul atau tautan artikel</li>
            <li>Penjelasan bagian yang salah</li>
            <li>Sumber yang menurut Anda benar, jika ada</li>
        </ul>
        <p>Isi nama Anda. Email bersifat opsional, hanya jika Anda ingin dibalas.</p>

        <h2>Apa yang kami lakukan</h2>
        <p>Pesan dibaca oleh pengelola situs. Kami akan memeriksa laporan itu dengan membandingkannya ke sumber yang tercantum di artikel. Jika ada kesalahan, teks artikel akan kami perbaiki dan tanggal pembaruan di halaman akan berubah.</p>
        <p>Situs ini belum menampilkan kotak koreksi otomatis. Jika kesalahannya mengubah arti berita secara berarti, kami akan menambahkan catatan koreksi secara manual di tubuh artikel. Salah ketik yang tidak mengubah arti biasanya diperbaiki tanpa catatan khusus.</p>

        <h2>Yang tidak kami ubah</h2>
        <p>Kami mengoreksi fakta, angka, nama, atau kronologi yang keliru. Perbedaan tafsiran atau opini dari sumber yang kami rangkum, selama rangkuman itu sesuai laporan aslinya, bukan objek koreksi.</p>
        <p class="page-doc__date">Diperbarui: {{ \Carbon\Carbon::parse($updated)->locale('id')->translatedFormat('d F Y') }}</p>
    </article>
</div>
@endsection

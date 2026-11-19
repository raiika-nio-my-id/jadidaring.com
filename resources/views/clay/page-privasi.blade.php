@extends('layouts.clay')
@section('content')
<div class="clay-section">
    <article class="clay-card page-doc">
        <h1 class="clay-section__title">Kebijakan Privasi</h1>
        <p>Halaman ini menjelaskan data apa yang dikumpulkan Jadidaring dan untuk apa.</p>
        <h2>Data yang kami simpan</h2>
        <ul>
            <li><strong>Akun anggota:</strong> nama pengguna, nama tampilan, kata sandi (disimpan dalam bentuk hash), dan email jika Anda mengisinya. Jika Anda masuk lewat Google, GitHub, atau Telegram, kami menerima pengenal akun dan data profil dasar yang Anda izinkan.</li>
            <li><strong>Aktivitas:</strong> skor dan nama pemain di game, komentar berita, komentar dan pengikut di halaman komunitas, serta isi halaman profil yang Anda terbitkan.</li>
            <li><strong>Formulir kontak:</strong> nama, email (opsional), subjek, dan pesan. Alamat IP tidak disimpan utuh, hanya sidik hash untuk mencegah spam.</li>
            <li><strong>Kunjungan:</strong> penghitung kunjungan halaman profil memakai penanda pengunjung unik berbentuk hash, bukan identitas Anda.</li>
        </ul>
        <h2>Cookie dan penyimpanan peramban</h2>
        <p>Kami memakai cookie sesi dan token keamanan (CSRF) agar login dan formulir berfungsi, dan penyimpanan lokal peramban untuk pilihan tema terang/gelap. Pengunjung yang belum masuk tidak diberi cookie sesi di halaman berita dan halaman publik lain.</p>
        <p>Jika analitik Google Analytics diaktifkan, ia hanya berjalan setelah Anda menekan "Setuju" pada banner persetujuan. Pilihan "Tolak" menjaga analitik tetap mati.</p>
        <h2>Pihak ketiga</h2>
        <p>Halaman berita menautkan ke situs sumber di luar Jadidaring, dan sebagian halaman memuat font atau pustaka dari CDN. Kebijakan privasi situs-situs itu berlaku di sana.</p>
        <h2>Hak Anda</h2>
        <p>Anggota dapat menghapus akunnya sendiri di halaman akun; data akun, halaman, dan pengikutnya ikut terhapus. Untuk permintaan lain terkait data Anda, gunakan <a href="/kontak">formulir kontak</a>.</p>
        <p class="page-doc__date">Diperbarui: {{ \Carbon\Carbon::parse($updated)->locale('id')->translatedFormat('d F Y') }}</p>
    </article>
</div>
@endsection

@extends('layouts.clay')

@section('content')
    <div class="clay-section">
        <div class="clay-card">
            <h1 class="clay-section__title" style="margin-bottom: 20px;">Syarat &amp; Ketentuan</h1>
            <div style="line-height: 1.7; color: var(--clay-ink);">
                <p style="margin-bottom: 16px;">
                    Selamat datang di <strong>Jadidaring</strong>. Dengan mengakses dan menggunakan layanan Jadidaring, Anda menyetujui ketentuan dan syarat penggunaan berikut:
                </p>
                <h2 style="font-family: var(--font-display); font-size: 20px; margin: 24px 0 12px 0;">1. Penyediaan Layanan</h2>
                <p style="margin-bottom: 16px;">
                    Jadidaring menyediakan platform permainan peramban daring, agregasi berita terkini, dan ruang komunitas untuk pengguna di Indonesia secara cuma-cuma tanpa perlu mengunduh aplikasi tambahan.
                </p>
                <h2 style="font-family: var(--font-display); font-size: 20px; margin: 24px 0 12px 0;">2. Hak Kekayaan Intelektual</h2>
                <p style="margin-bottom: 16px;">
                    Seluruh konten permainan dan materi kreatif yang diunggah oleh pembuat game tetap menjadi milik masing-masing pembuat. Merek, logo, dan tata letak Jadidaring dilindungi oleh undang-undang hak cipta.
                </p>
                <h2 style="font-family: var(--font-display); font-size: 20px; margin: 24px 0 12px 0;">3. Kebijakan Penggunaan</h2>
                <p style="margin-bottom: 16px;">
                    Pengguna dilarang melakukan tindakan kecurangan, penyalahgunaan API, peretasan, pengiriman konten berbahaya atau pelecehan dalam ruang publik game dan komunitas.
                </p>
                <p style="margin-top: 32px; font-size: 14px; color: var(--clay-ink-2);">
                    Pembaruan terakhir: {{ \Carbon\Carbon::parse((string) config('singlepage.terms_updated_on'))->locale('id')->translatedFormat('d F Y') }}
                </p>
            </div>
        </div>
    </div>
@endsection

@extends('layouts.clay')

@section('content')
    <div class="clay-section">
        <div class="clay-section__header">
            <h1 class="clay-section__title">Komunitas</h1>
        </div>
        <p class="news-lead">Buat halaman profil ala Friendster-mu sendiri: musik, kursor kustom, latar unik. Isi formulir, biarkan AI yang menulis kodenya, lalu tempel hasilnya di sini.</p>

        <section class="clay-card clay-card--lavender pb-card" aria-labelledby="pb-h">
            <h2 id="pb-h">Buat Halamanmu Sendiri</h2>
            <form id="pb-form" class="clay-form pb-form" autocomplete="off">
                <div class="pb-grid">
                    <div><label for="pb-type">Jenis halaman / tujuan</label>
                        <select class="clay-input" id="pb-type" name="type">
                            <option>Profil pribadi gaya Friendster</option>
                            <option>Portofolio / personal branding</option>
                            <option>Bisnis atau UMKM</option>
                            <option>Undangan atau acara</option>
                            <option>Komunitas atau organisasi</option>
                            <option>Landing page produk</option>
                            <option>Game mini (satu pemain)</option>
                            <option>Lainnya</option>
                        </select></div>
                    <div><label for="pb-title">Judul / nama</label>
                        <input class="clay-input" id="pb-title" name="title" maxlength="80" required></div>
                </div>
                <label for="pb-desc">Deskripsi / isi konten</label>
                <textarea class="clay-input" id="pb-desc" name="desc" rows="5" maxlength="1500" placeholder="Ceritakan tentang dirimu, bagian apa saja yang ingin ada, tautan, dll."></textarea>
                <div class="pb-grid">
                    <div><label for="pb-aud">Target pengunjung</label>
                        <input class="clay-input" id="pb-aud" name="audience" maxlength="120" placeholder="mis. teman sekolah, calon pelanggan"></div>
                    <div><label for="pb-lang">Bahasa halaman</label>
                        <select class="clay-input" id="pb-lang" name="lang"><option>Bahasa Indonesia</option><option>English</option></select></div>
                </div>
                <fieldset class="pb-feats">
                    <legend>Fitur</legend>
                    <label><input type="checkbox" name="feat" value="musik dengan tombol putar/jeda (tanpa autoplay)"> Musik</label>
                    <label><input type="checkbox" name="feat" value="kursor kustom lewat CSS"> Kursor kustom</label>
                    <label><input type="checkbox" name="feat" value="penghitung pengunjung dekoratif (animasi saja)"> Penghitung pengunjung</label>
                    <label><input type="checkbox" name="feat" value="daftar Top 8 teman ala Friendster (data statis dari JSON)"> Top 8 teman</label>
                    <label><input type="checkbox" name="feat" value="status mood / sedang dengar apa"> Mood &amp; status</label>
                    <label><input type="checkbox" name="feat" value="galeri gambar"> Galeri</label>
                    <label><input type="checkbox" name="feat" value="latar bergerak halus (hormati prefers-reduced-motion)"> Latar bergerak</label>
                    <label><input type="checkbox" name="feat" value="hitung mundur"> Hitung mundur</label>
                    <label><input type="checkbox" name="feat" value="tombol WhatsApp (wa.me)"> Tombol WhatsApp</label>
                </fieldset>
                <div class="pb-grid pb-grid--3">
                    <div><label for="pb-c1">Warna utama</label><input class="pb-color" type="color" id="pb-c1" name="c1" value="#7c5cff"></div>
                    <div><label for="pb-c2">Warna kedua</label><input class="pb-color" type="color" id="pb-c2" name="c2" value="#ffd1e8"></div>
                    <div><label for="pb-c3">Warna aksen</label><input class="pb-color" type="color" id="pb-c3" name="c3" value="#ffb020"></div>
                </div>
                <label for="pb-style">Gaya desain UI</label>
                <select class="clay-input" id="pb-style" name="style" aria-describedby="pb-style-desc"></select>
                <p id="pb-style-desc" class="news-meta"></p>
                <div class="pb-grid">
                    <div><label for="pb-music">URL musik (https, opsional)</label><input class="clay-input" id="pb-music" name="music" inputmode="url" placeholder="https://.../lagu.mp3"></div>
                    <div><label for="pb-bg">URL gambar latar / foto (https, opsional)</label><input class="clay-input" id="pb-bg" name="bg" inputmode="url" placeholder="https://.../latar.jpg"></div>
                </div>
                <label for="pb-extra">Arahan tambahan (opsional)</label>
                <textarea class="clay-input" id="pb-extra" name="extra" rows="2" maxlength="600"></textarea>
                <button class="clay-btn clay-btn--primary" type="submit">Buat Prompt</button>
            </form>

            <div id="pb-result" hidden>
                <h3>Prompt kamu siap</h3>
                <div class="pb-actions">
                    <button type="button" class="clay-btn clay-btn--primary" id="pb-chatgpt">Buka di ChatGPT</button>
                    <button type="button" class="clay-btn" id="pb-gemini">Buka di Gemini</button>
                    <button type="button" class="clay-btn" id="pb-copy">Salin prompt</button>
                </div>
                <p id="pb-toast" class="news-comments__msg" role="status" aria-live="polite"></p>
                <label for="pb-preview">Pratinjau prompt</label>
                <textarea class="clay-input pb-preview" id="pb-preview" rows="12" readonly></textarea>
            </div>
        </section>

        <section class="clay-card clay-card--mint pb-card" aria-labelledby="cara-h">
            <h2 id="cara-h">Cara membuat</h2>
            <ol class="pb-steps">
                <li>Isi formulir di atas, lalu tekan <strong>Buat Prompt</strong>.</li>
                <li>Tekan <strong>Buka di ChatGPT</strong> (prompt terisi otomatis) atau <strong>Buka di Gemini</strong> (prompt disalin, tinggal tempel).</li>
                <li>Tunggu AI menulis kode. Salin <em>seluruh</em> blok kode HTML-nya.</li>
                @auth
                    <li>Buka <a href="/komunitas/halamanku">Halaman Saya</a>, tempel kodenya (atau unggah file .html), lalu simpan. Halamanmu langsung tayang di <code>/u/{{ auth()->user()->username }}</code>.</li>
                @else
                    <li><a href="/masuk">Masuk</a> atau <a href="/daftar">daftar</a> dulu, lalu buka Halaman Saya untuk menempel kodenya.</li>
                @endauth
                <li>Pengunjung bisa meninggalkan komentar di halamanmu. Kolom komentar dan menu utama selalu tampil dan tidak bisa dihapus.</li>
            </ol>
            <p class="news-meta">Keamanan: halamanmu tampil di bingkai terisolasi. Skrip dari luar, kolom password/kartu, dan pengalihan otomatis tidak diizinkan. Maks. 300 KB.</p>
            <p>@auth <a class="clay-btn clay-btn--primary" href="/komunitas/halamanku">{{ $mine ? 'Ubah halamanku' : 'Tempel halamanku' }}</a> @endauth</p>
        </section>

        <section class="clay-section" aria-labelledby="galeri-h">
            <h2 id="galeri-h">Halaman komunitas</h2>
            @if ($pages->isEmpty())
                <div class="clay-card clay-card--peach clay-empty"><p class="clay-empty__text">Belum ada halaman. Jadilah yang pertama!</p></div>
            @else
                <div class="news-grid">
                    @foreach ($pages as $p)
                        <a class="news-card news-card--noimg" href="/u/{{ $p->user->username }}">
                            <span class="topic-badge topic-badge--gaming">{{ '@'.$p->user->username }}</span>
                            <h2>{{ $p->title }}</h2>
                            <div class="news-meta-row"><span class="news-date">{{ number_format($p->views) }} kunjungan</span></div>
                        </a>
                    @endforeach
                </div>
            @endif
        </section>
    </div>
    <script src="{{ \App\Support\AssetUrl::to('js/prompt-builder.js') }}" defer></script>
@endsection

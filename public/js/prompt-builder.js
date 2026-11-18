(function () {
  'use strict';
  var STYLES = [
    ['Claymorphism', 'Bentuk gembung seperti tanah liat: warna pastel, sudut sangat bulat, bayangan lembut ganda.'],
    ['Glassmorphism', 'Panel kaca buram tembus pandang dengan blur latar dan garis tepi tipis bercahaya.'],
    ['Liquid Glass', 'Kaca cair ala Apple: translusen, memantulkan latar, sorot tepi atas yang terang.'],
    ['Neubrutalism', 'Border hitam tebal, warna datar mencolok, bayangan keras tanpa blur.'],
    ['Bento Grid', 'Kotak-kotak modular berbeda ukuran yang tersusun rapi seperti bekal bento.'],
    ['Aurora Gradient', 'Latar gradasi mengalir seperti aurora, kesan premium dan modern.'],
    ['Neumorphism / Soft UI', 'Elemen timbul-tenggelam lembut dengan satu warna dasar dan dua bayangan.'],
    ['Minimalis Swiss', 'Grid ketat, tipografi tegas, banyak ruang kosong, sedikit warna.'],
    ['Dark Mode OLED', 'Latar hitam pekat, teks kontras tinggi, aksen neon tipis.'],
    ['Y2K / Retro Futuristik', 'Krom, gelembung, gradasi mengilap, nuansa awal 2000-an.'],
    ['Cyberpunk Neon', 'Malam kota futuristik: garis neon, glitch, huruf monospace.'],
    ['Synthwave / Vaporwave', 'Matahari senja, grid perspektif, ungu-pink ala 80-an.'],
    ['Pixel Art 8-bit', 'Piksel tegas, palet terbatas, nuansa game retro.'],
    ['Editorial Majalah', 'Tata letak ala majalah: huruf serif besar, kolom, kutipan menonjol.'],
    ['Tipografi Kinetik', 'Teks raksasa yang bergerak sebagai elemen visual utama.'],
    ['Organik / Blob', 'Bentuk cair tak beraturan, kurva halus, warna bumi hangat.'],
    ['Grainy Gradient', 'Gradasi dengan tekstur noise/butiran untuk rasa analog.'],
    ['Skeuomorphism Modern', 'Tekstur material nyata (kertas, kayu, logam) dengan pencahayaan halus.'],
    ['Memphis / Maximalism', 'Pola geometris ramai, warna berani, komposisi penuh energi.'],
    ['Scrapbook / Doodle', 'Tempelan kertas, stiker, coretan tangan, tepi sobek, nuansa DIY.']
  ];

  var sel = document.getElementById('pb-style');
  var desc = document.getElementById('pb-style-desc');
  var form = document.getElementById('pb-form');
  if (!sel || !form) return;

  STYLES.forEach(function (s, i) {
    var o = document.createElement('option');
    o.value = s[0]; o.textContent = s[0]; if (i === 0) o.selected = true;
    sel.appendChild(o);
  });
  function showDesc() { var s = STYLES.filter(function (x) { return x[0] === sel.value; })[0]; desc.textContent = s ? s[1] : ''; }
  sel.addEventListener('change', showDesc); showDesc();

  var TEMPLATE = [
    'Kamu adalah desainer UI/UX dan frontend developer profesional. Buatkan SATU halaman web satu-halaman untuk komunitas Jadidaring (jadidaring.com) berdasarkan data pengguna di bagian bawah.',
    '',
    'ATURAN OUTPUT (WAJIB)',
    '- Balas HANYA dengan satu blok kode markdown berbahasa html yang berisi dokumen lengkap (<!DOCTYPE html> sampai </html>). Tanpa penjelasan di luar blok kode.',
    '- Satu file: semua CSS di <style>, semua JavaScript di <script>. Tanpa framework, CDN, Google Fonts, <link>, <iframe>, <embed>, <object>, <base>, atau <meta http-equiv>.',
    '- Maksimal 250 KB. Teks halaman memakai {LANG}.',
    '- Taruh semua konten yang bisa diubah (nama, deskripsi, tautan, daftar) dalam satu objek JSON valid di <script type="application/json" id="website-config"> lalu render dengan JavaScript.',
    '',
    'BATASAN KEAMANAN PLATFORM (halaman ditolak bila dilanggar)',
    '- Dilarang: kolom password/PIN/OTP/kartu, unggah file, form yang mengirim data ke server, pengalihan otomatis, URL javascript:, memuat skrip dari luar.',
    '- Tautan dan media hanya https:// . Gunakan gambar/audio HANYA dari URL yang diberikan pengguna; jangan mengarang URL. Bila tidak ada gambar, buat latar dengan CSS (gradasi, pola, bentuk).',
    '- Musik: sediakan tombol Putar/Jeda dan pengatur volume; DILARANG autoplay; mulai senyap sampai pengunjung menekan tombol.',
    '- Kursor kustom hanya lewat CSS cursor:url(https://...) dengan fallback, atau kursor buatan sendiri dari CSS/emoji.',
    '- Halaman tampil di dalam bingkai terisolasi: jangan akses window.parent/top, cookie, localStorage; jangan memakai popup atau alert/confirm/prompt.',
    '- Jangan mengarang informasi (alamat, harga, testimoni, kontak, statistik). Bila data kosong, hilangkan bagiannya.',
    '- Jadidaring menambahkan menu utama dan kolom komentar DI LUAR halamanmu; jangan membuat kolom komentar sendiri.',
    '',
    'KUALITAS',
    '- Mobile-first dan responsif, aksesibel (alt gambar, kontras AA, fokus terlihat, hormati prefers-reduced-motion), HTML semantik, <title> dan meta description.',
    '- Bukan template generik: komposisi, tipografi, dan warna sesuai tujuan dan gaya desain di bawah. Animasi halus dan bermakna.',
    '- Footer wajib memuat tautan teks "Syarat & Ketentuan" ke https://jadidaring.com/syarat-ketentuan dan tidak boleh menyiratkan Jadidaring bertanggung jawab atas isi halaman.',
    '',
    'DATA PENGGUNA'
  ].join('\n');

  function val(n) { var e = form.elements[n]; return e && e.value ? String(e.value).trim() : ''; }

  function build() {
    var feats = Array.prototype.slice.call(form.querySelectorAll('input[name=feat]:checked')).map(function (c) { return c.value; });
    var type = val('type');
    var lines = [TEMPLATE.replace('{LANG}', val('lang') || 'Bahasa Indonesia')];
    function add(k, v) { if (v) lines.push(k + ': ' + v); }
    add('Jenis halaman / tujuan', type);
    add('Judul / nama', val('title'));
    add('Deskripsi / isi konten', val('desc'));
    add('Target pengunjung', val('audience'));
    add('Fitur yang diminta', feats.join('; '));
    add('Warna utama', val('c1')); add('Warna kedua', val('c2')); add('Warna aksen', val('c3'));
    var st = STYLES.filter(function (x) { return x[0] === val('style'); })[0];
    add('Gaya desain UI', st ? st[0] + ' (' + st[1] + ')' : '');
    add('URL musik', val('music'));
    add('URL gambar latar / foto', val('bg'));
    add('Arahan tambahan', val('extra'));
    if (/game/i.test(type)) lines.push('Catatan game: hanya mode satu pemain yang berjalan di browser, tanpa server atau multiplayer.');
    if (/friendster/i.test(type)) lines.push('Catatan: tampilkan elemen khas Friendster/MySpace (profil, status, top teman, testimoni dekoratif) tanpa mengarang data orang lain.');
    return lines.join('\n');
  }

  var result = document.getElementById('pb-result');
  var preview = document.getElementById('pb-preview');
  var toast = document.getElementById('pb-toast');
  var prompt = '';
  function say(m) { toast.textContent = m; }

  function copy() {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(prompt).then(function () { return true; }, function () { return fallbackCopy(); });
    }
    return Promise.resolve(fallbackCopy());
  }
  function fallbackCopy() {
    preview.focus(); preview.select();
    try { return document.execCommand('copy'); } catch (e) { return false; }
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    prompt = build(); preview.value = prompt; result.hidden = false; say('');
    result.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
  });

  document.getElementById('pb-copy').addEventListener('click', function () {
    copy().then(function (ok) { say(ok ? 'Prompt disalin.' : 'Gagal menyalin. Pilih teks pratinjau lalu salin manual.'); });
  });

  document.getElementById('pb-gemini').addEventListener('click', function () {
    // Gemini has no supported prefill URL: copy, then open it.
    copy().then(function (ok) {
      say(ok ? 'Prompt disalin, tinggal tempel di Gemini.' : 'Salin prompt dari pratinjau lalu tempel di Gemini.');
      window.open('https://gemini.google.com/app', '_blank', 'noopener');
    });
  });

  document.getElementById('pb-chatgpt').addEventListener('click', function () {
    var url = 'https://chatgpt.com/?q=' + encodeURIComponent(prompt);
    if (url.length > 7500) {
      // Too long for a URL: fall back to copy + open.
      copy().then(function () { say('Prompt terlalu panjang untuk tautan. Prompt disalin, tinggal tempel di ChatGPT.'); window.open('https://chatgpt.com/', '_blank', 'noopener'); });
      return;
    }
    say('Membuka ChatGPT dengan prompt terisi…');
    window.open(url, '_blank', 'noopener');
  });
})();

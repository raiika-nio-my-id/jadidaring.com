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
    'Kamu adalah desainer UI/UX untuk komunitas Jadidaring (jadidaring.com). Profil member memakai TATA LETAK TETAP ala Friendster yang dirender oleh Jadidaring. Tugasmu: menghasilkan PENGATURAN profil dalam JSON (tema, latar, widget) berdasarkan data pengguna di bagian bawah, dan HANYA bila perlu satu widget HTML kustom.',
    '',
    'ATURAN OUTPUT (WAJIB)',
    '- Balas dengan satu blok kode markdown berbahasa json berisi objek persis sesuai skema di bawah. Tanpa komentar di dalam JSON. Teks memakai {LANG}.',
    '- OPSIONAL: bila pengguna menginginkan sesuatu yang tidak bisa dibuat widget bawaan, tambahkan satu blok kode kedua berbahasa html berisi dokumen kecil lengkap untuk widget "custom_html" (maks. 250 KB; CSS di <style>, JavaScript di <script>). Bila tidak perlu, jangan buat blok html dan jangan masukkan widget custom_html.',
    '',
    'SKEMA JSON (kunci lain diabaikan; nilai di luar batas dikoreksi atau dibuang)',
    '{ "profile": { "tagline": "<=80 huruf", "status": "<=140", "about": "<=1200", "avatar": "https://... (gambar, opsional)" },',
    '  "theme": { "bg": { "type": "color|gradient|image|pattern", "color": "#rrggbb", "color2": "#rrggbb", "angle": 0-360, "image": "https://... atau kosong", "pattern": "none|dots|grid|stripes", "fixed": true, "overlay": 0-0.8 },',
    '    "colors": { "text": "#rrggbb", "accent": "#rrggbb", "card": "#rrggbb", "link": "#rrggbb" },',
    '    "font": "Nunito|Baloo 2|Poppins|Inter|Lora|Playfair Display|Pacifico|Space Grotesk|Comic Neue|Press Start 2P",',
    '    "card": { "radius": 0-40, "opacity": 0.3-1, "blur": 0-24 }, "cursor": { "url": "https://... gambar kecil atau kosong", "size": 16-48 } },',
    '  "music": { "url": "https://... .mp3/.ogg/.wav atau kosong", "title": "judul" },',
    '  "widgets": [ urutan tampil; tipe: about, status, gallery, links, counter, music, friends, quote, youtube, custom_html. Bentuk: {"type":"gallery","items":[{"url":"https://...","caption":"..."}]} (maks 12), {"type":"links","items":[{"label":"...","url":"https://..."}]} (maks 10), {"type":"friends","items":[{"username":"..."}]} (maks 8), {"type":"quote","text":"...","author":"..."}, {"type":"youtube","id":"11 karakter atau tautan youtube"}, lainnya cukup {"type":"about"} ] }',
    '',
    'BATASAN KEAMANAN PLATFORM',
    '- Semua warna wajib #rrggbb. Semua URL wajib https:// dan HANYA dari URL yang diberikan pengguna; jangan mengarang URL gambar, audio, atau tautan. Bila tidak ada gambar, pakai latar gradient/pattern.',
    '- Musik tidak pernah autoplay (pengunjung menekan putar). Jangan mengarang informasi (alamat, harga, testimoni, kontak, statistik). Bila data kosong, kosongkan atau hapus bagiannya.',
    '- Menu utama dan kolom komentar ditambahkan Jadidaring dan tidak bisa diubah; jangan membuatnya.',
    '- Khusus widget HTML kustom: dilarang kolom password/PIN/OTP/kartu, unggah file, form kirim data, pengalihan otomatis, javascript: URL, <iframe>/<embed>/<object>/<base>, fetch/XHR/WebSocket (diblokir), dan akses window.parent/cookie/localStorage. Sumber luar yang DIIZINKAN (hanya https): <link rel="stylesheet"> dan <script src> dari fonts.googleapis.com, fonts.gstatic.com, cdn.jsdelivr.net, cdnjs.cloudflare.com, unpkg.com, dan cdn.tailwindcss.com. Domain lain dihapus oleh platform. Footer widget tidak perlu memuat S&K.',
    '',
    'KUALITAS',
    '- Pilih warna, font, latar, dan urutan widget yang cocok dengan tujuan dan gaya desain di bawah; kontras teks vs kartu minimal AA. Isi tagline, status, dan tentang aku dengan kalimat yang hidup tapi jujur sesuai data pengguna.',
    '',
    'DATA PENGGUNA'
  ].join('\n');

  function val(n) { var e = form.elements[n]; return e && e.value ? String(e.value).trim() : ''; }

  var delivery = '';

  function deliverySection(info, title) {
    if (!info) {
      return '\nPENGIRIMAN HASIL\n- Balas dengan blok json (dan blok html bila ada widget kustom). Pengguna menempel JSON di jadidaring.com/komunitas/halamanku (tombol Muat ke editor), lalu meninjau dan menerbitkannya.';
    }
    var curl = "curl -sS -X POST " + info.endpoint + " -H 'Content-Type: application/json' -H 'X-Draft-Key: " + info.key + "' --data-binary @profil.json";
    return [
      '',
      'PENGIRIMAN HASIL (kunci sekali pakai, berlaku 60 menit)',
      '- Setelah JSON selesai dan kamu periksa, kirim sebagai DRAFT:',
      '  1) Jika kamu bisa membuat permintaan HTTP: POST ke ' + info.endpoint + ' dengan Content-Type: application/json dan isi {"key":"' + info.key + '","config":{...objek JSON profil...},"html":"<dokumen HTML widget kustom sebagai string, atau hilangkan kunci html>"}.',
      '  2) Jika tidak bisa: balas dengan blok json (objek profil) dan, bila ada, blok html. Lalu blok bash berisi persis perintah ini setelah pengguna menyimpan JSON sebagai profil.json dengan bentuk {"config":{...},"html":"..."} (tambahkan "key":"' + info.key + '" bila kunci tidak dikirim lewat header):',
      '     ' + curl,
      '- Kunci ini hanya membuat DRAFT dan hangus setelah satu kali berhasil. Profil TIDAK tayang otomatis: pengguna meninjau di https://jadidaring.com/komunitas/halamanku lalu menekan Terbitkan atau Batal. Jangan membagikan kunci ini ke pihak lain dan jangan menaruhnya di dalam JSON atau HTML.',
      '- Jika pengiriman gagal, tampilkan pesan error-nya dan berikan blok json serta perintah curl di atas.'
    ].join('\n');
  }

  function mintKey() {
    if (!form.dataset.mint) { return Promise.resolve(null); }
    return fetch(form.dataset.mint, { method: 'POST', credentials: 'same-origin', headers: { 'X-CSRF-TOKEN': form.dataset.csrf, 'Accept': 'application/json' } })
      .then(function (r) { return r.ok ? r.json() : null; })
      .catch(function () { return null; });
  }

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
    if (/game/i.test(type)) lines.push('Catatan game: hanya mode satu pemain di browser; buat sebagai widget custom_html.');
    if (/friendster/i.test(type)) lines.push('Catatan: tampilkan elemen khas Friendster/MySpace (profil, status, top teman, testimoni dekoratif) tanpa mengarang data orang lain.');
    lines.push(delivery);
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
    mintKey().then(function (info) {
      delivery = deliverySection(info, val('title'));
      prompt = build(); preview.value = prompt; result.hidden = false;
      say(info ? 'Kunci draft sekali pakai (60 menit) sudah disisipkan di prompt. Jangan dibagikan.' : (form.dataset.mint ? 'Kunci draft belum tersedia (batas pembuatan tercapai). Prompt tanpa kirim otomatis: tempel hasilnya di Halaman Saya.' : 'Masuk untuk menyertakan kunci kirim draft otomatis.'));
      result.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
    });
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

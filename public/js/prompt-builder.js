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

  var SPEC_URL = 'https://jadidaring.com/komunitas/prompt-spec.txt';
  var TEMPLATE = [
    'Kamu desainer profil untuk Jadidaring (jadidaring.com). Buat PENGATURAN profil dalam JSON dari data pengguna di bawah. Teks memakai {LANG}.',
    'Spesifikasi lengkap (skema, batas, keamanan): ' + SPEC_URL + ' (baca bila bisa; kalau tidak, ikuti ringkasan ini).',
    'SKEMA: {"profile":{"tagline":"<=80","status":"<=140","about":"<=1200","avatar":"https://.. atau kosong"},"theme":{"bg":{"type":"color|gradient|image|pattern","color":"#rrggbb","color2":"#rrggbb","angle":0-360,"image":"https://.. atau kosong","pattern":"none|dots|grid|stripes","fixed":true,"overlay":0-0.8},"colors":{"text":"#rrggbb","accent":"#rrggbb","card":"#rrggbb","link":"#rrggbb"},"font":"Nunito|Baloo 2|Poppins|Inter|Lora|Playfair Display|Pacifico|Space Grotesk|Comic Neue|Press Start 2P","card":{"radius":0-40,"opacity":0.3-1,"blur":0-24},"cursor":{"url":"","size":16-48}},"music":{"url":"https://.. .mp3/.ogg/.wav atau kosong","title":""},"widgets":[urutan tampil; tipe: about,status,gallery,links,counter,music,friends,quote,youtube. gallery/links: {"type":"links","items":[{"label":"..","url":"https://.."}]}; quote: {"type":"quote","text":"..","author":".."}; lainnya {"type":"about"}]}',
    'ATURAN: warna wajib #rrggbb; angka JSON tanpa kutip (desimal boleh, mis. 0.12, dibulatkan 2 desimal; di luar rentang dipotong). URL wajib https dan hanya dari data pengguna, jangan mengarang. Jangan mengarang fakta. Tanpa komentar di JSON. Kontras teks vs kartu min. AA. Tanpa widget custom_html kecuali diminta.',
    'DATA PENGGUNA'
  ].join('\n');

  function val(n) { var e = form.elements[n]; return e && e.value ? String(e.value).trim() : ''; }

  var delivery = '';

  function deliverySection(info, withCfg) {
    if (!info) {
      return '\nHASIL: balas dengan satu blok json. Pengguna menempelnya di jadidaring.com/komunitas/halamanku (kotak "Tempel JSON dari AI").';
    }
    var cur = (withCfg && info.config) ? ['', 'PROFIL SAAT INI (ubah seperlunya, pertahankan sisanya): ' + JSON.stringify(info.config)] : [];
    return cur.concat([
      '',
      'HASIL: balas dengan SATU tautan klik di baris sendiri (teks biasa, bukan blok kode): ' + info.base + '?json=<JSON profil minify satu baris, di-URL-encode: { jadi %7B, " jadi %22, spasi %20, # %23, / %2F, , %2C, : %3A>. Boleh juga ?d=<base64url zlib-compress JSON> bila kamu punya alat kode. Jaga tautan di bawah 6000 karakter. Sertakan juga blok json yang sama sebagai cadangan. Bila tidak yakin bisa meng-encode, jangan mengarang tautan: beri blok json saja. Tautan hanya membuka pratinjau; pengguna harus masuk, menyimpan draft, lalu Terbitkan.'
    ]).join('\n');
  }

  function mintKey() {
    if (!form.dataset.import) { return Promise.resolve(null); }
    var cfg = null;
    try { cfg = JSON.parse(form.dataset.config || 'null'); } catch (e) { cfg = null; }
    return Promise.resolve({ base: form.dataset.import, config: cfg });
  }

  var MAX_URL = 6000;
  var trimmed = false;
  function enc(t) { return encodeURIComponent(t).replace(/%20/g, '+'); }

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
      delivery = deliverySection(info, true);
      prompt = build();
      if (info && info.config && enc(prompt).length > MAX_URL) { delivery = deliverySection(info, false); prompt = build(); trimmed = true; } else { trimmed = false; }
      preview.value = prompt; result.hidden = false;
      say(info ? 'Prompt siap: AI akan membalas dengan satu tautan klik ke pratinjau profilmu ' + (trimmed ? ' JSON profilmu terlalu besar untuk tautan, jadi tidak disertakan; sebutkan perubahan yang kamu mau.' : ' JSON profilmu saat ini ikut disertakan.') : 'Masuk agar AI bisa membalas dengan tautan klik langsung. Tanpa masuk, tempel JSON hasilnya di editor.');
      result.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
    });
  });

  document.getElementById('pb-copy').addEventListener('click', function () {
    copy().then(function (ok) { say(ok ? 'Prompt disalin.' : 'Gagal menyalin. Pilih teks pratinjau lalu salin manual.'); });
  });

  document.getElementById('pb-gemini').addEventListener('click', function () {
    // Gemini has no prefill URL (gemini.google.com/app?q= opens empty): open synchronously (no popup block), copy, tell the member.
    window.open('https://gemini.google.com/app', '_blank', 'noopener');
    copy().then(function (ok) { say(ok ? 'Prompt disalin, tempel di Gemini (Ctrl/Cmd+V).' : 'Gagal menyalin otomatis. Salin dari kotak pratinjau lalu tempel di Gemini.'); });
  });

  function openPrefill(base, name) {
    var url = base + enc(prompt);
    if (url.length > MAX_URL + 200) {
      // Still too long for a URL: open the chat, copy the prompt and say so.
      window.open(base.split('?')[0], '_blank', 'noopener');
      copy().then(function () { say('Prompt terlalu panjang untuk tautan, jadi disalin. Tempel di ' + name + ' (Ctrl/Cmd+V).'); });
      return;
    }
    window.open(url, '_blank', 'noopener');
    say('Membuka ' + name + ' dengan prompt sudah terisi (' + url.length + ' karakter). Tekan kirim di sana. Jika kotaknya kosong, prompt juga sudah bisa disalin dengan tombol Salin.');
  }
  document.getElementById('pb-chatgpt').addEventListener('click', function () { openPrefill('https://chatgpt.com/?q=', 'ChatGPT'); });
  document.getElementById('pb-claude').addEventListener('click', function () { openPrefill('https://claude.ai/new?q=', 'Claude'); });

  // Persist every field: per member on the server, per browser (localStorage) as fallback and for guests.
  var LS = 'jd-prompt-form-v1';
  function snapshot() {
    var d = {};
    Array.prototype.forEach.call(form.elements, function (el) {
      if (!el.name || el.type === 'submit' || el.type === 'button') return;
      if (el.type === 'checkbox') { (d[el.name] = d[el.name] || []); if (el.checked) d[el.name].push(el.value); }
      else d[el.name] = el.value;
    });
    return d;
  }
  function restore(d) {
    if (!d || typeof d !== 'object') return;
    Array.prototype.forEach.call(form.elements, function (el) {
      if (!el.name || !(el.name in d)) return;
      if (el.type === 'checkbox') el.checked = Array.isArray(d[el.name]) && d[el.name].indexOf(el.value) >= 0;
      else if (el.tagName === 'SELECT') { for (var i = 0; i < el.options.length; i++) if (el.options[i].value === d[el.name]) { el.selectedIndex = i; break; } }
      else el.value = d[el.name];
    });
    showDesc();
  }
  var saved = null;
  try { saved = form.dataset.saved ? JSON.parse(form.dataset.saved) : null; } catch (e) { saved = null; }
  if (!saved) { try { saved = JSON.parse(localStorage.getItem(LS) || 'null'); } catch (e) { saved = null; } }
  restore(saved);

  var saveTimer = null;
  function persist() {
    var d = snapshot();
    try { localStorage.setItem(LS, JSON.stringify(d)); } catch (e) { /* storage may be blocked */ }
    if (form.dataset.save) {
      fetch(form.dataset.save, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'X-CSRF-TOKEN': form.dataset.csrf }, body: JSON.stringify({ data: d }) }).catch(function () {});
    }
  }
  function later() { clearTimeout(saveTimer); saveTimer = setTimeout(persist, 700); }
  form.addEventListener('input', later); form.addEventListener('change', later);

  document.getElementById('pb-reset').addEventListener('click', function () {
    if (!window.confirm('Hapus semua isian dan mulai dari awal?')) return;
    form.reset(); sel.selectedIndex = 0; showDesc();
    try { localStorage.removeItem(LS); } catch (e) { /* ignore */ }
    if (form.dataset.reset) { fetch(form.dataset.reset, { method: 'POST', credentials: 'same-origin', headers: { 'Accept': 'application/json', 'X-CSRF-TOKEN': form.dataset.csrf } }).catch(function () {}); }
    result.hidden = true; prompt = '';
    document.getElementById('pb-saved-note').textContent = 'Semua isian dihapus. Silakan mulai dari awal.';
  });
})();

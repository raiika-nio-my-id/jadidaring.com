/* "Buat widget pakai AI": a modal inside the live profile editor (bottom sheet on phones).
   Builds a prompt that asks any AI chat for ONE widget and to answer with a clickable link that reopens this editor with the
   widget prefilled (a draft, nothing is published). Fallback: paste the code. Finished code goes to the editor via window.JDLive. */
(function () {
  'use strict';
  var bootEl = document.getElementById('le-boot');
  if (!bootEl) return;
  var B = JSON.parse(bootEl.textContent);
  var AI = B.ai || {};
  var STYLES = ['Claymorphism', 'Glassmorphism', 'Neubrutalism', 'Bento Grid', 'Aurora Gradient', 'Neumorphism / Soft UI', 'Minimalis Swiss', 'Dark Mode OLED', 'Y2K / Retro Futuristik', 'Cyberpunk Neon', 'Synthwave / Vaporwave', 'Pixel Art 8-bit', 'Editorial Majalah', 'Organik / Blob', 'Scrapbook / Doodle'];
  var KINDS = ['Kartu info / profil singkat', 'Hitung mundur', 'Mini game satu pemain', 'Animasi dekoratif', 'Jam / widget cuaca dekoratif', 'Tombol ajakan (CTA) & tautan', 'Daftar harga / menu', 'Galeri / slider gambar', 'Lainnya'];
  var SPEC = 'https://jadidaring.com/komunitas/prompt-spec.txt';
  var LS = 'jd-ai-widget-v1';
  var MAX_URL = 6000;
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  function h(tag, attrs, kids) {
    var e = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      var v = attrs[k];
      if (v === null || v === undefined || v === false) return;
      if (k === 'text') e.textContent = v; else if (k === 'cls') e.className = v;
      else if (k === 'on') Object.keys(v).forEach(function (ev) { e.addEventListener(ev, v[ev]); });
      else e.setAttribute(k, v === true ? '' : v);
    });
    (kids || []).forEach(function (c) { if (c) e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return e;
  }
  function opts(list) { return list.map(function (t) { return h('option', { value: t, text: t }); }); }
  function field(id, label, control) { return h('div', {}, [h('label', { for: id, text: label }), control]); }
  function enc(t) { return encodeURIComponent(t).replace(/%20/g, '+'); }

  var dlg = null, trigger = null, form, result, preview, msg, prompt = '', last = null, saveTimer = null;

  function build() {
    dlg = h('dialog', { cls: 'le-aim', 'aria-labelledby': 'le-aim-title', 'aria-describedby': 'le-aim-desc' });
    var close = h('button', { type: 'button', cls: 'le-x', 'aria-label': 'Tutup', text: '✕', on: { click: function () { dlg.close(); } } });
    dlg.appendChild(h('div', { cls: 'le-aim__head' }, [
      h('div', {}, [h('h2', { id: 'le-aim-title', text: '✨ Buat widget pakai AI' }), h('p', { id: 'le-aim-desc', cls: 'le-hint', text: 'Isi singkat, salin prompt ke ChatGPT, Claude, atau Gemini. AI membalas dengan tautan: kalau diklik, widget langsung terisi di editor ini. Kamu tinggal pilih lebarnya.' })]),
      close
    ]));

    form = h('form', { cls: 'le-aim__sec', autocomplete: 'off', novalidate: 'novalidate' });
    form.appendChild(h('h3', { text: '1. Ceritakan widget-nya' }));
    var grid = h('div', { cls: 'le-aim__grid' }, [
      field('lai-kind', 'Jenis widget', h('select', { id: 'lai-kind', name: 'kind', cls: 'clay-input' }, opts(KINDS))),
      field('lai-title', 'Judul widget', h('input', { id: 'lai-title', name: 'title', cls: 'clay-input', maxlength: 60, placeholder: 'mis. Hitung mundur ulang tahun' }))
    ]);
    form.appendChild(grid);
    form.appendChild(field('lai-desc', 'Isi dan perilaku widget', h('textarea', { id: 'lai-desc', name: 'desc', cls: 'clay-input', rows: 4, maxlength: 1200, placeholder: 'Jelaskan apa yang tampil, teksnya, tombol, animasi, dll.' })));
    form.appendChild(h('div', { cls: 'le-aim__grid le-aim__grid--3' }, [
      field('lai-c1', 'Warna utama', h('input', { id: 'lai-c1', name: 'c1', type: 'color', value: '#7c5cff' })),
      field('lai-c2', 'Warna kedua', h('input', { id: 'lai-c2', name: 'c2', type: 'color', value: '#ffd1e8' })),
      field('lai-c3', 'Warna aksen', h('input', { id: 'lai-c3', name: 'c3', type: 'color', value: '#ffb020' }))
    ]));
    form.appendChild(h('div', { cls: 'le-aim__grid' }, [
      field('lai-style', 'Gaya desain', h('select', { id: 'lai-style', name: 'style', cls: 'clay-input' }, opts(STYLES))),
      field('lai-lang', 'Bahasa teks', h('select', { id: 'lai-lang', name: 'lang', cls: 'clay-input' }, opts(['Bahasa Indonesia', 'English'])))
    ]));
    form.appendChild(field('lai-img', 'URL gambar (https, opsional)', h('input', { id: 'lai-img', name: 'img', cls: 'clay-input', inputmode: 'url', placeholder: 'https://…/gambar.jpg' })));
    form.appendChild(field('lai-extra', 'Arahan tambahan (opsional)', h('textarea', { id: 'lai-extra', name: 'extra', cls: 'clay-input', rows: 2, maxlength: 600 })));
    form.appendChild(h('div', { cls: 'le-aim__row' }, [
      h('button', { type: 'submit', cls: 'clay-btn clay-btn--cta le-btn', text: 'Buat prompt' }),
      h('button', { type: 'button', cls: 'clay-btn clay-btn--secondary le-btn', text: 'Ulang dari awal', on: { click: reset } })
    ]));
    form.appendChild(h('p', { cls: 'le-hint', text: B.ai && B.ai.save ? 'Isianmu tersimpan otomatis di akunmu.' : '' }));
    form.addEventListener('submit', function (e) { e.preventDefault(); makePrompt(); });
    form.addEventListener('input', later); form.addEventListener('change', later);

    msg = h('p', { cls: 'le-aim__msg', role: 'status', 'aria-live': 'polite' });
    preview = h('textarea', { id: 'lai-prev', cls: 'clay-input le-aim__prev', rows: 9, readonly: 'readonly', 'aria-label': 'Pratinjau prompt' });
    result = h('div', { cls: 'le-aim__sec', hidden: 'hidden' }, [
      h('h3', { text: '2. Kirim prompt ke AI' }),
      h('div', { cls: 'le-aim__row' }, [
        h('button', { type: 'button', cls: 'clay-btn clay-btn--cta le-btn', text: 'Salin prompt', on: { click: function () { copy().then(function (ok) { say(ok ? 'Prompt disalin. Tempel di chat AI mana pun.' : 'Gagal menyalin otomatis. Pilih teks di bawah lalu salin manual.'); }); } } }),
        h('button', { type: 'button', cls: 'clay-btn clay-btn--secondary le-btn', text: 'Buka di ChatGPT', on: { click: function () { openPrefill('https://chatgpt.com/?q=', 'ChatGPT'); } } }),
        h('button', { type: 'button', cls: 'clay-btn clay-btn--secondary le-btn', text: 'Buka di Claude', on: { click: function () { openPrefill('https://claude.ai/new?q=', 'Claude'); } } }),
        h('button', { type: 'button', cls: 'clay-btn clay-btn--secondary le-btn', text: 'Buka di Gemini', on: { click: function () { window.open('https://gemini.google.com/app', '_blank', 'noopener'); copy().then(function (ok) { say(ok ? 'Prompt disalin, tempel di Gemini.' : 'Salin prompt dari kotak di bawah lalu tempel di Gemini.'); }); } } })
      ]),
      msg,
      preview,
      h('p', { cls: 'le-hint', text: 'Setelah AI membalas, klik tautan dari jawabannya. Editor ini terbuka dengan widget terisi sebagai draft (belum tayang). Pilih lebar, lalu Simpan draft atau Terbitkan.' })
    ]);

    var code = h('textarea', { id: 'lai-code', cls: 'clay-input le-code', rows: 6, spellcheck: 'false', placeholder: '<div class="w-card">…</div>\n<style>…</style>', 'aria-describedby': 'lai-code-hint' });
    var pmsg = h('p', { cls: 'le-aim__msg', role: 'status', 'aria-live': 'polite' });
    var paste = h('div', { cls: 'le-aim__sec' }, [
      h('h3', { text: 'AI-nya tidak bisa membuat tautan? Tempel kodenya' }),
      h('p', { id: 'lai-code-hint', cls: 'le-hint', text: 'Tempel blok HTML dari AI (maks. 300 KB). Kode dibersihkan otomatis dan jalan di kotak terisolasi.' }),
      code,
      h('div', { cls: 'le-aim__row' }, [h('button', { type: 'button', cls: 'clay-btn clay-btn--secondary le-btn', text: 'Pakai kode ini', on: { click: function () {
        var raw = code.value.trim().replace(/^```[a-z]*\s*/i, '').replace(/```\s*$/, '').trim();
        try { if (raw.charAt(0) === '{') { var j = JSON.parse(raw); if (j && typeof j.html === 'string') raw = j.html; } } catch (x) { /* plain html */ }
        if (!raw) { pmsg.textContent = 'Tempel kodenya dulu.'; return; }
        if (raw.length > 300000) { pmsg.textContent = 'Kode terlalu besar (maks. 300 KB).'; return; }
        if (window.JDLive.hasCustomCode() && !window.confirm('Kode kotak kustom yang sekarang akan diganti di draft ini. Lanjut?')) return;
        if (window.JDLive.applyWidgetCode(raw, {})) { dlg.close(); window.JDLive.toast('Widget masuk. Pilih lebarnya di panel.'); }
      } } })]),
      pmsg
    ]);

    dlg.appendChild(h('div', { cls: 'le-aim__body' }, [form, result, paste]));
    dlg.addEventListener('keydown', trap);
    dlg.addEventListener('click', function (e) { if (e.target === dlg) dlg.close(); });
    dlg.addEventListener('close', function () {
      document.documentElement.classList.remove('le-aim-lock');
      if (trigger && document.contains(trigger)) trigger.focus();
    });
    document.body.appendChild(dlg);
    restore();
  }

  function trap(e) {
    if (e.key === 'Escape') { e.preventDefault(); dlg.close(); return; }
    if (e.key !== 'Tab') return;
    var f = Array.prototype.filter.call(dlg.querySelectorAll('button, input, select, textarea, [tabindex]:not([tabindex="-1"])'), function (x) { return !x.disabled && !x.hidden && x.offsetParent !== null; });
    if (!f.length) return;
    var first = f[0], lastEl = f[f.length - 1];
    if (e.shiftKey && (document.activeElement === first || !dlg.contains(document.activeElement))) { e.preventDefault(); lastEl.focus(); }
    else if (!e.shiftKey && document.activeElement === lastEl) { e.preventDefault(); first.focus(); }
  }

  function val(n) { var e = form.elements[n]; return e && e.value ? String(e.value).trim() : ''; }
  function say(m) { msg.textContent = m; }

  var RULES = [
    'ATURAN WIDGET',
    '- Tulis FRAGMEN HTML saja (tanpa <html>, <head>, <body>) dengan <style> di dalamnya. Beri semua class awalan unik "w-" agar tidak bentrok.',
    '- Harus responsif: lebar kotak nanti dipilih pengguna antara 20% dan 100% dari halaman, dan di HP selalu selebar layar. Pakai width:100%, flex/grid dengan wrap, font relatif (rem/clamp); jangan lebar tetap di atas 100%. Tinggi mengikuti isi.',
    '- Latar kotak transparan atau punya warna sendiri; kontras teks minimal AA. Hormati prefers-reduced-motion.',
    '- Widget jalan di kotak terisolasi (sandbox). DILARANG: kolom password/PIN/OTP/kartu, form kirim data, unggah file, pengalihan otomatis, javascript: URL, <iframe>/<embed>/<object>/<base>, fetch/XHR/WebSocket, akses window.parent/cookie/localStorage. Sumber luar yang boleh (hanya https): fonts.googleapis.com, fonts.gstatic.com, cdn.jsdelivr.net, cdnjs.cloudflare.com, unpkg.com, cdn.tailwindcss.com.',
    '- Jangan mengarang data, kontak, harga, atau URL; pakai hanya yang diberikan pengguna. Tanpa footer S&K.',
    '- Jangan menentukan lebar kotak: pengguna memilihnya sendiri di editor. Tulis ringkas (target di bawah 3500 karakter agar muat di tautan; batas mutlak 300 KB).'
  ];

  function linkRule() {
    return [
      '',
      'HASIL: balas dengan SATU tautan klik di baris sendiri (teks biasa, bukan blok kode): ' + AI.link + '?json=<JSON satu baris {"title":"<judul pendek>","html":"<fragmen HTML>"} yang di-URL-encode: { jadi %7B, } %7D, " %22, < %3C, > %3E, spasi %20, # %23, / %2F, : %3A, , %2C, & %26, ; %3B, = %3D, tanda kutip tunggal %27, baris baru dihapus>.',
      'Boleh juga ' + AI.link + '?d=<base64url dari JSON yang di-zlib-compress> bila kamu punya alat kode. Jaga tautan di bawah 6000 karakter; kalau tidak muat, sederhanakan widget. Sertakan juga blok html yang sama sebagai cadangan. Bila tidak yakin bisa meng-encode, jangan mengarang tautan: beri blok html saja.',
      'Tautan hanya membuka editor Jadidaring dengan widget terisi sebagai draft. Pengguna harus masuk, memilih lebar kotak, lalu menyimpan; belum tayang sebelum itu.'
    ].join('\n');
  }

  function makePrompt() {
    var lines = ['Kamu desainer front-end untuk Jadidaring (jadidaring.com). Buat SATU widget HTML/CSS (boleh JS kecil) untuk kotak kustom di profil member. Ini hanya satu widget, bukan seluruh halaman dan bukan pengaturan profil. Teks memakai ' + (val('lang') || 'Bahasa Indonesia') + '.', 'Spesifikasi sandbox: ' + SPEC + ' (baca bila bisa; kalau tidak, ikuti aturan di bawah).', ''].concat(RULES, ['', 'PERMINTAAN WIDGET']);
    function add(k, v) { if (v) lines.push(k + ': ' + v); }
    add('Jenis widget', val('kind')); add('Judul widget', val('title')); add('Isi dan perilaku', val('desc'));
    add('Warna utama', val('c1')); add('Warna kedua', val('c2')); add('Warna aksen', val('c3'));
    add('Gaya desain UI', val('style')); add('URL gambar yang boleh dipakai', val('img')); add('Arahan tambahan', val('extra'));
    if (/game/i.test(val('kind'))) lines.push('Catatan game: hanya satu pemain di browser, tanpa jaringan, kontrol sentuh dan mouse.');
    lines.push(linkRule());
    prompt = lines.join('\n');
    preview.value = prompt; result.hidden = false;
    say('Prompt siap. AI akan membalas dengan tautan; klik untuk mengisi widget di editor.');
    last = result.querySelector('button'); result.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'nearest' });
    persist();
  }

  function copy() {
    function fb() { preview.focus(); preview.select(); try { return document.execCommand('copy'); } catch (e) { return false; } }
    if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(prompt).then(function () { return true; }, function () { return fb(); });
    return Promise.resolve(fb());
  }
  function openPrefill(base, name) {
    var url = base + enc(prompt);
    if (url.length > MAX_URL + 2500) { window.open(base.split('?')[0], '_blank', 'noopener'); copy().then(function () { say('Prompt terlalu panjang untuk tautan, jadi disalin. Tempel di ' + name + '.'); }); return; }
    window.open(url, '_blank', 'noopener');
    say('Membuka ' + name + ' dengan prompt terisi. Kalau kosong, pakai Salin prompt.');
  }

  function snapshot() { var d = {}; Array.prototype.forEach.call(form.elements, function (el) { if (el.name) d[el.name] = el.value; }); return d; }
  function restore() {
    var d = AI.saved;
    if (!d) { try { d = JSON.parse(localStorage.getItem(LS) || 'null'); } catch (e) { d = null; } }
    if (!d || typeof d !== 'object') return;
    Array.prototype.forEach.call(form.elements, function (el) { if (el.name && el.name in d && typeof d[el.name] === 'string') el.value = d[el.name]; });
  }
  function persist() {
    var d = snapshot();
    try { localStorage.setItem(LS, JSON.stringify(d)); } catch (e) { /* storage may be blocked */ }
    if (AI.save) fetch(AI.save, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'X-CSRF-TOKEN': B.csrf }, body: JSON.stringify({ data: d, scope: 'widget' }) }).catch(function () {});
  }
  function later() { clearTimeout(saveTimer); saveTimer = setTimeout(persist, 700); }
  function reset() {
    if (!window.confirm('Hapus semua isian dan mulai dari awal?')) return;
    form.reset(); AI.saved = null; prompt = ''; preview.value = ''; result.hidden = true;
    try { localStorage.removeItem(LS); } catch (e) { /* ignore */ }
    if (AI.reset) fetch(AI.reset, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'X-CSRF-TOKEN': B.csrf }, body: JSON.stringify({ scope: 'widget' }) }).catch(function () {});
    form.elements.kind.focus();
  }

  window.JDAiWidget = {
    open: function (from) {
      trigger = from || document.activeElement;
      if (!dlg) build();
      if (!dlg.showModal) { window.alert('Browser ini belum mendukung jendela ini. Perbarui browsermu.'); return; }
      document.documentElement.classList.add('le-aim-lock');
      dlg.showModal();
      form.elements.kind.focus();
    }
  };
})();

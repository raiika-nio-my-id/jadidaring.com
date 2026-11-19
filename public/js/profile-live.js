/* Live edit mode for member profiles: tap a part of the page, edit it in the side panel (bottom sheet on phones),
   see it update in place, then save a draft or publish. All rendering is done by the server from validated config. */
(function () {
  'use strict';
  var bootEl = document.getElementById('le-boot');
  if (!bootEl) return;
  var B = JSON.parse(bootEl.textContent);
  var stage = document.getElementById('le-stage');
  var panel = document.getElementById('le-panel');
  var pTitle = document.getElementById('le-panel-title');
  var pHint = document.getElementById('le-panel-hint');
  var pBody = document.getElementById('le-panel-body');
  var form = document.getElementById('le-form');
  var stateEl = document.getElementById('le-state');

  var initial = JSON.stringify(B.config);
  var cfg = JSON.parse(initial);
  var html = B.html || '';
  var initialHtml = html;
  var dirty = B.mode === 'import';
  var current = null;
  var timer = null;
  var seq = 0;
  var CAT = {};
  (B.catalog || []).forEach(function (c) { CAT[c.type] = c; });

  /* ---------- helpers ---------- */
  function h(tag, attrs, kids) {
    var e = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      var v = attrs[k];
      if (v === null || v === undefined || v === false) return;
      if (k === 'text') e.textContent = v;
      else if (k === 'on') Object.keys(v).forEach(function (ev) { e.addEventListener(ev, v[ev]); });
      else if (k === 'cls') e.className = v;
      else e.setAttribute(k, v === true ? '' : v);
    });
    (kids || []).forEach(function (c) { if (c) e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return e;
  }
  var uid = 0;
  function nid() { uid += 1; return 'le-f' + uid; }
  function get(path) { return path.split('.').reduce(function (a, k) { return a == null ? a : a[k]; }, cfg); }
  function set(path, v) {
    var ks = path.split('.'); var last = ks.pop();
    var t = ks.reduce(function (a, k) { if (a[k] == null || typeof a[k] !== 'object') a[k] = {}; return a[k]; }, cfg);
    t[last] = v; changed();
  }
  function label(t) { return (CAT[t] && CAT[t].label) || t; }
  function setState(t) { stateEl.textContent = t; }

  /* ---------- field builders: every field = label + one-line hint + control ---------- */
  function field(lbl, hint, control, id) {
    return h('div', { cls: 'le-field' }, [
      h('label', { 'for': id, text: lbl }),
      hint ? h('p', { cls: 'le-hint', text: hint }) : null,
      control
    ]);
  }
  function text(path, lbl, hint, o) {
    o = o || {}; var id = nid();
    var el = h(o.area ? 'textarea' : 'input', { id: id, cls: 'clay-input', maxlength: o.max || 200, placeholder: o.ph || '', inputmode: o.url ? 'url' : null, rows: o.area ? (o.rows || 4) : null, spellcheck: o.url ? 'false' : null });
    el.value = get(path) == null ? '' : get(path);
    el.addEventListener('input', function () { set(path, el.value); });
    return field(lbl, hint, el, id);
  }
  function color(path, lbl, hint) {
    var id = nid();
    var el = h('input', { id: id, type: 'color', cls: 'le-color' });
    el.value = get(path) || '#000000';
    el.addEventListener('input', function () { set(path, el.value.toLowerCase()); });
    return field(lbl, hint, el, id);
  }
  function range(path, lbl, hint, min, max, step, unit) {
    var id = nid();
    var out = h('output', { cls: 'le-out', 'for': id });
    var el = h('input', { id: id, type: 'range', min: min, max: max, step: step, cls: 'le-range' });
    el.value = get(path);
    function show() { out.textContent = el.value + (unit || ''); }
    show();
    el.addEventListener('input', function () { show(); set(path, Number(el.value)); });
    return field(lbl, hint, h('div', { cls: 'le-rangewrap' }, [el, out]), id);
  }
  function select(path, lbl, hint, opts) {
    var id = nid();
    var el = h('select', { id: id, cls: 'clay-input' }, opts.map(function (o) { return h('option', { value: o[0], text: o[1] }); }));
    el.value = get(path);
    el.addEventListener('change', function () { set(path, el.value); });
    return field(lbl, hint, el, id);
  }
  function toggle(path, lbl, hint) {
    var id = nid();
    var el = h('input', { id: id, type: 'checkbox', cls: 'le-switch' });
    el.checked = !!get(path);
    el.addEventListener('change', function () { set(path, el.checked); });
    return h('div', { cls: 'le-field le-field--row' }, [h('div', {}, [h('label', { 'for': id, text: lbl }), hint ? h('p', { cls: 'le-hint', text: hint }) : null]), el]);
  }
  function seg(path, lbl, hint, opts, after) {
    var wrap = h('div', { cls: 'le-seg', role: 'radiogroup', 'aria-label': lbl });
    function paint() { Array.prototype.forEach.call(wrap.children, function (b) { b.setAttribute('aria-checked', b.dataset.v === String(get(path)) ? 'true' : 'false'); }); }
    opts.forEach(function (o) {
      wrap.appendChild(h('button', { type: 'button', role: 'radio', 'data-v': o[0], text: o[1], on: { click: function () { set(path, o[0]); paint(); if (after) after(o[0]); } } }));
    });
    paint();
    return h('div', { cls: 'le-field' }, [h('p', { cls: 'le-flabel', text: lbl }), hint ? h('p', { cls: 'le-hint', text: hint }) : null, wrap]);
  }
  function more(kids) {
    return h('details', { cls: 'le-more' }, [h('summary', { text: 'Lainnya' })].concat(kids));
  }
  function note(t) { return h('p', { cls: 'le-note', text: t }); }
  function swatches(colors, onPick, lbl) {
    return h('div', { cls: 'le-swatches', role: 'group', 'aria-label': lbl || 'Warna siap pakai' }, colors.map(function (c) {
      var bg = Array.isArray(c) ? 'linear-gradient(135deg,' + c[0] + ',' + c[1] + ')' : c;
      return h('button', { type: 'button', cls: 'le-swatch', style: 'background:' + bg, 'aria-label': Array.isArray(c) ? 'Gradasi ' + c[0] + ' ke ' + c[1] : 'Warna ' + c, on: { click: function () { onPick(c); } } });
    }));
  }

  /* list editor (links, gallery, friends) */
  function listEditor(w, cols, max, addLabel) {
    w.items = Array.isArray(w.items) ? w.items : [];
    var box = h('div', { cls: 'le-list' });
    function draw() {
      box.innerHTML = '';
      w.items.forEach(function (it, i) {
        var row = h('div', { cls: 'le-list__row' });
        cols.forEach(function (c) {
          var inp = h('input', { cls: 'clay-input', placeholder: c.ph, 'aria-label': c.label + ' ' + (i + 1), maxlength: c.max || 500, inputmode: c.url ? 'url' : null, spellcheck: 'false' });
          inp.value = it[c.key] || '';
          inp.addEventListener('input', function () { it[c.key] = inp.value; changed(); });
          row.appendChild(inp);
        });
        row.appendChild(h('button', { type: 'button', cls: 'le-icon', 'aria-label': 'Hapus baris ' + (i + 1), text: '✕', on: { click: function () { w.items.splice(i, 1); draw(); changed(); } } }));
        box.appendChild(row);
      });
      if (w.items.length < max) {
        box.appendChild(h('button', { type: 'button', cls: 'clay-btn clay-btn--secondary le-add', text: '＋ ' + addLabel, on: { click: function () {
          var o = {}; cols.forEach(function (c) { o[c.key] = ''; }); w.items.push(o); draw();
          var last = box.querySelectorAll('.le-list__row'); if (last.length) last[last.length - 1].querySelector('input').focus();
        } } }));
      }
    }
    draw();
    return box;
  }

  /* ---------- panels ---------- */
  var FONT_OPTS = (B.fonts || []).map(function (f) { return [f, f]; });
  var SOLIDS = ['#ffffff', '#f7f2ec', '#ede7ff', '#ffd9ec', '#d7f5e3', '#d6ecff', '#fff3b0', '#ffd6b8', '#2b2440', '#111827', '#0b1f3a', '#3b0a45'];
  var GRADS = [['#ede7ff', '#ffd9ec'], ['#a1c4fd', '#c2e9fb'], ['#fbc2eb', '#a6c1ee'], ['#ffecd2', '#fcb69f'], ['#84fab0', '#8fd3f4'], ['#f6d365', '#fda085'], ['#0f0c29', '#302b63'], ['#232526', '#414345'], ['#ff6a88', '#ff99ac'], ['#43e97b', '#38f9d7']];

  var PANELS = {
    theme: function () {
      var kids = [];
      if ((B.presets || []).length) {
        kids.push(h('p', { cls: 'le-flabel', text: 'Gaya siap pakai' }), h('p', { cls: 'le-hint', text: 'Sekali ketuk: latar, warna, font, dan kursor langsung terisi.' }));
        kids.push(h('div', { cls: 'le-presets' }, B.presets.map(function (p) {
          return h('button', { type: 'button', cls: 'le-preset', on: { click: function () { applyPreset(p); } } }, [
            h('span', { cls: 'le-preset__sw', style: p.swatch }), h('strong', { text: p.label }), h('span', { text: p.hint })
          ]);
        })));
      }
      kids.push(
        select('theme.font', 'Font', 'Huruf untuk seluruh profil.', FONT_OPTS),
        h('div', { cls: 'le-grid2' }, [
          color('theme.colors.text', 'Warna teks', 'Untuk tulisan di kartu.'),
          color('theme.colors.accent', 'Warna aksen', 'Judul, bingkai foto, angka.'),
          color('theme.colors.card', 'Warna kartu', 'Latar setiap kotak.'),
          color('theme.colors.link', 'Warna tautan', 'Untuk link yang bisa diklik.')
        ]),
        more([
          range('theme.card.radius', 'Sudut kartu', 'Makin besar makin bulat.', 0, 40, 1, 'px'),
          range('theme.card.opacity', 'Kepekatan kartu', 'Turunkan agar latar ikut terlihat.', 0.3, 1, 0.01, ''),
          range('theme.card.blur', 'Blur kartu', 'Efek kaca buram di belakang kartu.', 0, 24, 1, 'px')
        ])
      );
      return { title: 'Tema', hint: 'Warna, font, dan bentuk kartu.', kids: kids };
    },
    bg: function () {
      var bg = cfg.theme.bg;
      if (bg.type === 'pattern') bg.type = 'color';
      var body = h('div', {});
      function draw() {
        body.innerHTML = '';
        if (bg.type === 'color') {
          body.appendChild(h('p', { cls: 'le-flabel', text: 'Warna siap pakai' }));
          body.appendChild(swatches(SOLIDS, function (c) { set('theme.bg.color', c); reopen(); }));
          body.appendChild(color('theme.bg.color', 'Warna sendiri', 'Pilih warna apa saja.'));
        } else if (bg.type === 'gradient') {
          body.appendChild(h('p', { cls: 'le-flabel', text: 'Gradasi siap pakai' }));
          body.appendChild(swatches(GRADS, function (c) { cfg.theme.bg.color = c[0]; set('theme.bg.color2', c[1]); reopen(); }));
          body.appendChild(h('div', { cls: 'le-grid2' }, [color('theme.bg.color', 'Warna 1', 'Warna awal.'), color('theme.bg.color2', 'Warna 2', 'Warna akhir.')]));
          body.appendChild(range('theme.bg.angle', 'Arah gradasi', 'Putar arah perpaduan warna.', 0, 360, 1, '°'));
        } else {
          body.appendChild(imagePicker('theme.bg.image', 'bg', 'Gambar latar', 'JPG, PNG, WebP, atau GIF, maks. 5 MB. Otomatis dikompres.'));
          body.appendChild(color('theme.bg.color', 'Warna cadangan', 'Tampil selagi gambar dimuat.'));
        }
        if (bg.type !== 'image') body.appendChild(patternPicker());
      }
      draw();
      return { title: 'Latar halaman', hint: 'Warna, gradasi, pola, atau gambar di belakang profil.', kids: [
        seg('theme.bg.type', 'Jenis latar', 'Pilih dasar latarnya dulu.', [['color', 'Warna'], ['gradient', 'Gradasi'], ['image', 'Gambar']], function () { draw(); }),
        body,
        more([
          toggle('theme.bg.fixed', 'Latar diam saat menggulir', 'Latar tetap di tempat, kartu yang bergerak.'),
          range('theme.bg.overlay', 'Gelapkan latar', 'Bantu tulisan terbaca di atas gambar ramai.', 0, 0.8, 0.01, '')
        ])
      ] };
    },
    head: function () {
      return { title: 'Profil (kotak tetap)', hint: 'Foto, tagline, dan status. Kotak ini selalu ada.', fixed: true, kids: [
        imagePicker('profile.avatar', 'avatar', 'Foto profil', 'Foto persegi terlihat paling bagus. Maks. 5 MB.'),
        text('profile.tagline', 'Tagline', 'Satu kalimat di bawah namamu.', { max: 80 }),
        text('profile.status', 'Status', 'Kabar atau mood hari ini. Tampil di kotak Status.', { max: 140 }),
        note('Nama dan username diatur di Pengaturan akun. Angka Pengikut, Mengikuti, dan Pengunjung selalu tampil di sini.')
      ] };
    },
    cursor: function () {
      var kids = [];
      if ((B.cursors || []).length) kids.push(cursorPicker());
      kids.push(more([
        text('theme.cursor.url', 'Kursor dari link', 'Link https ke gambar kecil (PNG), maks. 128px.', { url: true, ph: 'https://…/kursor.png', max: 500 })
      ]));
      return { title: 'Kursor', hint: 'Bentuk penunjuk mouse saat orang membuka profilmu. Di HP tidak tampil.', kids: kids };
    },
    wall: function () {
      return { title: 'Komentar & Testimoni (kotak tetap)', hint: 'Selalu ada di bawah profil dan tidak bisa dihapus.', fixed: true, kids: [
        note('Kamu bisa menyembunyikan komentar yang mengganggu langsung dari halaman profilmu.')
      ] };
    },
    add: function () {
      var grid = h('div', { cls: 'le-catalog' });
      var counts = {};
      cfg.widgets.forEach(function (w) { counts[w.type] = (counts[w.type] || 0) + 1; });
      (B.catalog || []).forEach(function (c) {
        var full = c.multi ? (counts[c.type] || 0) >= 3 : !!counts[c.type];
        grid.appendChild(h('button', { type: 'button', cls: 'le-cat' + (c.kind === 'custom' ? ' le-cat--custom' : ''), disabled: full || cfg.widgets.length >= 14, on: { click: function () { addWidget(c.type); } } }, [
          h('span', { cls: 'le-cat__ic', 'aria-hidden': 'true', text: c.icon }),
          h('strong', { text: c.label }),
          h('span', { text: full ? 'Sudah ada di profil' : c.hint })
        ]));
      });
      return { title: 'Tambah kotak', hint: 'Pilih kotak untuk ditambahkan di bawah profilmu. Maks. 14 kotak.', kids: [grid, note('Kotak tetap (Profil dan Komentar) selalu ada. HTML kustom untuk yang ingin membuat sendiri.')] };
    },
    order: function () {
      var ul = h('ol', { cls: 'le-order' });
      ul.appendChild(h('li', { cls: 'le-order__fixed' }, [h('span', { text: '🔒' }), h('strong', { text: 'Profil' }), h('em', { text: 'Tetap di atas' })]));
      cfg.widgets.forEach(function (w, i) {
        var li = h('li', { cls: 'le-order__item', 'data-i': i }, [
          h('span', { cls: 'le-grab', 'aria-hidden': 'true', text: '⠿' }),
          h('strong', { text: (w.title || label(w.type)) }),
          h('span', { cls: 'le-order__btns' }, [
            h('button', { type: 'button', cls: 'le-icon', 'aria-label': 'Naikkan ' + label(w.type), disabled: i === 0, text: '↑', on: { click: function () { move(i, i - 1); reopen(); } } }),
            h('button', { type: 'button', cls: 'le-icon', 'aria-label': 'Turunkan ' + label(w.type), disabled: i === cfg.widgets.length - 1, text: '↓', on: { click: function () { move(i, i + 1); reopen(); } } }),
            h('button', { type: 'button', cls: 'le-icon le-icon--del', 'aria-label': 'Hapus ' + label(w.type), text: '🗑', on: { click: function () { removeWidget(i); reopen(); } } })
          ])
        ]);
        ul.appendChild(li);
      });
      ul.appendChild(h('li', { cls: 'le-order__fixed' }, [h('span', { text: '🔒' }), h('strong', { text: 'Komentar & Testimoni' }), h('em', { text: 'Tetap di bawah' })]));
      dragSort(ul);
      return { title: 'Susun kotak', hint: 'Seret ⠿ atau pakai panah untuk mengatur urutan.', kids: [ul, h('button', { type: 'button', cls: 'clay-btn clay-btn--secondary le-add', text: '＋ Tambah kotak', on: { click: function () { open('add'); } } })] };
    },
    ai: function () {
      var ta = h('textarea', { id: 'le-ai-json', cls: 'clay-input', rows: 5, spellcheck: 'false', placeholder: '{ "theme": { … } }' });
      var msg = h('p', { cls: 'le-hint', role: 'status', 'aria-live': 'polite' });
      return { title: 'Buat pakai AI', hint: 'Minta ChatGPT, Claude, atau Gemini mendesain profilmu.', kids: [
        h('a', { cls: 'clay-btn clay-btn--cta le-add', href: '/komunitas/buat', text: '✨ Buka generator prompt' }),
        note('Setelah AI menjawab, klik tautan impor dari AI. Hasilnya terbuka di halaman ini untuk ditinjau.'),
        field('Tempel JSON dari AI', 'Isi blok json saja, lalu tekan Muat.', ta, 'le-ai-json'),
        h('button', { type: 'button', cls: 'clay-btn clay-btn--secondary le-add', text: 'Muat ke profil', on: { click: function () {
          var raw = ta.value.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
          try {
            var c = JSON.parse(raw);
            if (c && c.config && typeof c.config === 'object') { if (typeof c.html === 'string' && c.html) { html = c.html; } c = c.config; }
            if (!c || typeof c !== 'object') throw new Error('x');
            cfg = merge(JSON.parse(initial), c); changed(true); msg.textContent = 'Dimuat. Periksa hasilnya, lalu Simpan draft.';
          } catch (e) { msg.textContent = 'JSON tidak valid. Pastikan hanya menempel isi blok json dari AI.'; }
        } } }),
        msg
      ] };
    }
  };

  function merge(base, over) {
    Object.keys(over).forEach(function (k) {
      if (over[k] && typeof over[k] === 'object' && !Array.isArray(over[k]) && base[k] && typeof base[k] === 'object') merge(base[k], over[k]);
      else base[k] = over[k];
    });
    return base;
  }

  function widgetPanel(i) {
    var w = cfg.widgets[i];
    if (!w) return null;
    var p = 'widgets.' + i + '.';
    var kids = [text(p + 'title', 'Judul kotak', 'Kosongkan untuk memakai judul bawaan "' + label(w.type) + '".', { max: 60, ph: label(w.type) })];
    switch (w.type) {
      case 'about': kids.push(text('profile.about', 'Tentang aku', 'Ceritakan dirimu. Enter untuk baris baru.', { area: true, max: 1200, rows: 6 })); break;
      case 'status': kids.push(text('profile.status', 'Status', 'Kabar atau mood hari ini.', { max: 140 })); break;
      case 'counter': kids.push(note('Menghitung pengunjung unik (satu orang dihitung sekali). Angkanya tidak bisa diubah.')); break;
      case 'links': kids.push(h('p', { cls: 'le-flabel', text: 'Daftar tautan' }), h('p', { cls: 'le-hint', text: 'Nama tautan dan link https. Maks. 10.' }), listEditor(w, [{ key: 'label', ph: 'Nama, mis. Instagram', label: 'Nama tautan', max: 60 }, { key: 'url', ph: 'https://…', label: 'Link', url: true }], 10, 'Tambah tautan')); break;
      case 'gallery': kids.push(h('p', { cls: 'le-flabel', text: 'Foto' }), h('p', { cls: 'le-hint', text: 'Unggah foto atau tempel link https. Maks. 12.' }), galleryEditor(w)); break;
      case 'friends': kids.push(h('p', { cls: 'le-flabel', text: 'Teman' }), h('p', { cls: 'le-hint', text: 'Username member Jadidaring, tanpa @. Maks. 8.' }), listEditor(w, [{ key: 'username', ph: 'username', label: 'Username', max: 20 }], 8, 'Tambah teman')); break;
      case 'quote': kids.push(text(p + 'text', 'Kutipan', 'Kalimat favoritmu.', { area: true, max: 300, rows: 3 }), text(p + 'author', 'Penulis', 'Siapa yang mengatakannya (opsional).', { max: 60 })); break;
      case 'youtube': kids.push(text(p + 'id', 'Link video YouTube', 'Tempel link youtube.com atau youtu.be.', { url: true, max: 200, ph: 'https://youtu.be/…' })); break;
      case 'spotify':
        if (!w.url && w.id) w.url = 'https://open.spotify.com/' + w.kind + '/' + w.id;
        kids.push(text(p + 'url', 'Link atau kode embed Spotify', 'Dari Spotify: Bagikan → Salin link, atau Sematkan.', { url: true, max: 2000, ph: 'https://open.spotify.com/track/…' }));
        kids.push(toggle(p + 'compact', 'Pemutar kecil', 'Hanya untuk satu lagu (track).'));
        break;
      case 'music': kids.push(text('music.url', 'Link lagu (mp3/ogg/wav)', 'Link https langsung ke file audio. Tidak autoplay.', { url: true, max: 500, ph: 'https://…/lagu.mp3' }), text('music.title', 'Judul lagu', 'Tampil di atas pemutar.', { max: 80 }), note('Punya lagu di Spotify? Pakai kotak Spotify.')); break;
      case 'custom_html':
        var id = nid();
        var ta = h('textarea', { id: id, cls: 'clay-input le-code', rows: 10, spellcheck: 'false' });
        ta.value = html;
        ta.addEventListener('input', function () { html = ta.value; changed(); });
        kids.push(field('Kode HTML', 'Maks. 300 KB. Jalan di kotak terisolasi; iframe Spotify/YouTube dipindah otomatis ke kotaknya.', ta, id));
        kids.push(note('Pratinjau kode baru tampil setelah kamu menekan Simpan draft.'));
        break;
    }
    kids.push(h('div', { cls: 'le-wactions' }, [
      h('button', { type: 'button', cls: 'clay-btn clay-btn--secondary', disabled: i === 0, text: '↑ Naik', on: { click: function () { move(i, i - 1); open('w:' + (i - 1)); } } }),
      h('button', { type: 'button', cls: 'clay-btn clay-btn--secondary', disabled: i === cfg.widgets.length - 1, text: '↓ Turun', on: { click: function () { move(i, i + 1); open('w:' + (i + 1)); } } }),
      h('button', { type: 'button', cls: 'clay-btn le-danger', text: 'Hapus kotak', on: { click: function () { removeWidget(i); closePanel(); } } })
    ]));
    var cat = CAT[w.type] || {};
    return { title: label(w.type), hint: (cat.kind === 'custom' ? 'Kotak kustom. ' : '') + (cat.hint || ''), kids: kids };
  }

  function galleryEditor(w) {
    w.items = Array.isArray(w.items) ? w.items : [];
    var box = h('div', { cls: 'le-list' });
    function draw() {
      box.innerHTML = '';
      w.items.forEach(function (it, i) {
        var url = h('input', { cls: 'clay-input', placeholder: 'https://…/foto.jpg', 'aria-label': 'Link foto ' + (i + 1), inputmode: 'url', spellcheck: 'false' });
        url.value = it.url || '';
        url.addEventListener('input', function () { it.url = url.value; changed(); });
        var cap = h('input', { cls: 'clay-input', placeholder: 'Keterangan (opsional)', 'aria-label': 'Keterangan foto ' + (i + 1), maxlength: 80 });
        cap.value = it.caption || '';
        cap.addEventListener('input', function () { it.caption = cap.value; changed(); });
        box.appendChild(h('div', { cls: 'le-list__row le-list__row--img' }, [
          it.url ? h('img', { src: it.url, alt: '', cls: 'le-thumb', referrerpolicy: 'no-referrer' }) : h('span', { cls: 'le-thumb' }),
          h('div', { cls: 'le-list__col' }, [url, cap]),
          h('button', { type: 'button', cls: 'le-icon', 'aria-label': 'Hapus foto ' + (i + 1), text: '✕', on: { click: function () { w.items.splice(i, 1); draw(); changed(); } } })
        ]));
      });
      if (w.items.length < 12) {
        box.appendChild(uploadButton('gallery', 'Unggah foto', function (u) { w.items.push({ url: u, caption: '' }); draw(); changed(); }));
        box.appendChild(h('button', { type: 'button', cls: 'clay-btn clay-btn--secondary le-add', text: '＋ Tambah dari link', on: { click: function () { w.items.push({ url: '', caption: '' }); draw(); } } }));
      }
    }
    draw();
    return box;
  }

  /* uploads (stage 2): POST multipart, server re-encodes; returns {url} */
  function uploadButton(kind, lbl, onDone) {
    if (!B.uploadEnabled) return null;
    var id = nid();
    var inp = h('input', { id: id, type: 'file', accept: 'image/jpeg,image/png,image/webp,image/gif', cls: 'sr-only' });
    var msg = h('span', { cls: 'le-hint', role: 'status', 'aria-live': 'polite' });
    inp.addEventListener('change', function () {
      var f = inp.files && inp.files[0];
      if (!f) return;
      if (f.size > 5 * 1024 * 1024) { msg.textContent = 'Ukuran maksimal 5 MB.'; return; }
      var fd = new FormData(); fd.append('image', f); fd.append('kind', kind);
      msg.textContent = 'Mengunggah…';
      fetch(B.upload, { method: 'POST', credentials: 'same-origin', headers: { 'X-CSRF-TOKEN': B.csrf, 'Accept': 'application/json' }, body: fd })
        .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, status: r.status, j: j }; }); })
        .then(function (res) {
          if (!res.ok) { msg.textContent = res.status === 429 ? 'Terlalu banyak unggahan. Coba lagi sebentar lagi.' : ((res.j && (res.j.message || res.j.error)) || 'Gagal mengunggah.'); return; }
          msg.textContent = 'Terunggah.'; onDone(res.j.url);
        })
        .catch(function () { msg.textContent = 'Gagal mengunggah. Cek koneksi.'; });
      inp.value = '';
    });
    return h('div', { cls: 'le-upload' }, [inp, h('label', { 'for': id, cls: 'clay-btn clay-btn--secondary le-add', text: '⬆ ' + lbl }), msg]);
  }
  function imagePicker(path, kind, lbl, hint) {
    var cur = get(path) || '';
    var kids = [
      h('p', { cls: 'le-flabel', text: lbl }), h('p', { cls: 'le-hint', text: hint }),
      cur ? h('div', { cls: 'le-imgprev' }, [h('img', { src: cur, alt: '', referrerpolicy: 'no-referrer' }), h('button', { type: 'button', cls: 'le-icon', 'aria-label': 'Hapus gambar', text: '✕', on: { click: function () { set(path, ''); reopen(); } } })]) : null,
      uploadButton(kind, cur ? 'Ganti gambar' : 'Unggah gambar', function (u) { set(path, u); reopen(); })
    ];
    var urlField = text(path, 'Atau pakai link gambar', 'Link https ke gambar.', { url: true, max: 500, ph: 'https://…' });
    kids.push(B.uploadEnabled ? more([urlField]) : urlField);
    return h('div', { cls: 'le-field' }, kids);
  }
  function patternPicker() {
    var labels = B.patternLabels || {};
    var grid = h('div', { cls: 'le-patterns', role: 'radiogroup', 'aria-label': 'Pola' });
    (B.patterns || []).forEach(function (id) {
      grid.appendChild(h('button', { type: 'button', role: 'radio', cls: 'le-pat le-pat--' + id, 'aria-checked': cfg.theme.bg.pattern === id ? 'true' : 'false', title: labels[id] || id, on: { click: function () { set('theme.bg.pattern', id); reopen(); } } }, [h('span', { cls: 'le-pat__sw', style: (B.patternCss || {})[id] || '' }), h('span', { cls: 'le-pat__l', text: labels[id] || id })]));
    });
    var kids = [h('p', { cls: 'le-flabel', text: 'Pola di atas latar' }), h('p', { cls: 'le-hint', text: 'Motif tipis yang menempel di atas warna.' }), grid];
    if (B.patternInk) kids.push(seg('theme.bg.ink', 'Warna pola', 'Pilih terang untuk latar gelap.', [['dark', 'Gelap'], ['light', 'Terang']]));
    return h('div', { cls: 'le-field' }, kids);
  }
  function cursorPicker() {
    var cu = cfg.theme.cursor;
    var grid = h('div', { cls: 'le-cursors', role: 'radiogroup', 'aria-label': 'Pilihan kursor' });
    var none = !cu.preset && !cu.url;
    grid.appendChild(h('button', { type: 'button', role: 'radio', cls: 'le-cur', 'aria-checked': none ? 'true' : 'false', on: { click: function () { cu.preset = ''; cu.url = ''; changed(); reopen(); } } }, [h('span', { cls: 'le-cur__ic', text: '⨯' }), h('span', { text: 'Bawaan' })]));
    B.cursors.forEach(function (c) {
      grid.appendChild(h('button', { type: 'button', role: 'radio', cls: 'le-cur', 'aria-checked': cu.preset === c.id && !cu.url ? 'true' : 'false', on: { click: function () { cu.preset = c.id; cu.url = ''; changed(); reopen(); } } }, [h('img', { src: c.src, alt: '', width: 32, height: 32 }), h('span', { text: c.label })]));
    });
    var kids = [h('p', { cls: 'le-flabel', text: 'Pilih kursor' }), h('p', { cls: 'le-hint', text: 'Gambar kecil buatan Jadidaring.' }), grid,
      seg('theme.cursor.size', 'Ukuran', 'Besar kecilnya kursor.', [[24, 'Kecil'], [32, 'Sedang'], [48, 'Besar']])];
    var up = uploadButton('cursor', 'Unggah kursor sendiri', function (u) { cu.url = u; cu.preset = ''; changed(); reopen(); });
    if (up) kids.push(h('p', { cls: 'le-hint', text: 'Atau unggah gambarmu sendiri (PNG transparan paling bagus). Otomatis diperkecil.' }), up);
    if (cu.url) kids.push(h('div', { cls: 'le-imgprev le-imgprev--sm' }, [h('img', { src: cu.url, alt: '' }), h('button', { type: 'button', cls: 'le-icon', 'aria-label': 'Hapus kursor unggahan', text: '✕', on: { click: function () { cu.url = ''; changed(); reopen(); } } })]));
    return h('div', { cls: 'le-field' }, kids);
  }

  function applyPreset(p) {
    cfg.theme = merge(cfg.theme, JSON.parse(JSON.stringify(p.theme)));
    changed(true); reopen();
  }

  /* ---------- widgets ---------- */
  function addWidget(type) {
    var w = { type: type };
    if (type === 'links' || type === 'gallery' || type === 'friends') w.items = [];
    if (type === 'quote') { w.text = ''; w.author = ''; }
    cfg.widgets.push(w);
    changed(true);
    var i = cfg.widgets.length - 1;
    whenRendered(function () { open('w:' + i); var el = stage.querySelector('[data-edit="w:' + i + '"]'); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' }); });
  }
  function removeWidget(i) {
    var w = cfg.widgets[i];
    if (!w || !window.confirm('Hapus kotak "' + (w.title || label(w.type)) + '"?')) return;
    cfg.widgets.splice(i, 1);
    changed(true);
  }
  function move(a, b) {
    if (b < 0 || b >= cfg.widgets.length) return;
    cfg.widgets.splice(b, 0, cfg.widgets.splice(a, 1)[0]);
    changed(true);
  }
  function dragSort(ul) {
    var drag = null;
    ul.addEventListener('pointerdown', function (e) {
      var g = e.target.closest('.le-grab'); if (!g) return;
      drag = g.closest('li'); drag.classList.add('is-drag'); ul.setPointerCapture(e.pointerId); e.preventDefault();
    });
    ul.addEventListener('pointermove', function (e) {
      if (!drag) return;
      var items = Array.prototype.slice.call(ul.querySelectorAll('.le-order__item'));
      items.forEach(function (li) {
        if (li === drag) return;
        var r = li.getBoundingClientRect();
        if (e.clientY > r.top && e.clientY < r.bottom) { ul.insertBefore(drag, e.clientY < r.top + r.height / 2 ? li : li.nextSibling); }
      });
    });
    function end() {
      if (!drag) return;
      drag.classList.remove('is-drag'); drag = null;
      var order = Array.prototype.map.call(ul.querySelectorAll('.le-order__item'), function (li) { return Number(li.dataset.i); });
      var next = order.map(function (i) { return cfg.widgets[i]; });
      if (order.some(function (v, k) { return v !== k; })) { cfg.widgets = next; changed(true); reopen(); }
    }
    ul.addEventListener('pointerup', end); ul.addEventListener('pointercancel', end);
  }

  /* ---------- panel open/close ---------- */
  function open(key) {
    var def = key.indexOf('w:') === 0 ? widgetPanel(Number(key.slice(2))) : (PANELS[key] ? PANELS[key]() : null);
    if (!def) return;
    current = key; uid = uid; // keep ids unique
    pTitle.textContent = def.title;
    pHint.textContent = def.hint || '';
    panel.classList.toggle('is-fixed', !!def.fixed);
    pBody.innerHTML = '';
    def.kids.forEach(function (k) { if (k) pBody.appendChild(k); });
    panel.hidden = false;
    document.body.classList.add('le-panel-open');
    highlight();
    if (window.matchMedia('(max-width: 899px)').matches) {
      var sel = document.querySelector('.le-sel');
      if (sel && sel !== stage.querySelector('.pf')) {
        var r = sel.getBoundingClientRect(), room = window.innerHeight - panel.offsetHeight;
        if (r.top < 110 || r.top > room - 60) window.scrollBy({ top: r.top - 116, behavior: 'smooth' });
      }
    }
    var f = pBody.querySelector('input:not([type=hidden]):not(.sr-only),textarea,select,button');
    if (f && window.matchMedia('(pointer:fine)').matches) f.focus({ preventScroll: true });
  }
  function reopen() { if (current) { var y = pBody.scrollTop; open(current); pBody.scrollTop = y; } }
  function closePanel() {
    panel.hidden = true; current = null;
    document.body.classList.remove('le-panel-open');
    highlight();
  }
  function highlight() {
    document.querySelectorAll('.le-sel').forEach(function (e) { e.classList.remove('le-sel'); });
    if (!current) return;
    var el = current === 'bg' ? stage.querySelector('.pf') : document.querySelector('[data-edit="' + current + '"]');
    if (el) el.classList.add('le-sel');
  }
  document.getElementById('le-close').addEventListener('click', closePanel);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !panel.hidden) closePanel(); });
  document.querySelectorAll('[data-open]').forEach(function (b) {
    if (b.dataset.open !== 'w' && !PANELS[b.dataset.open]) { b.hidden = true; return; }
    b.addEventListener('click', function () { open(b.dataset.open); });
  });

  /* tap anything on the page to edit it */
  document.getElementById('le').addEventListener('click', function (e) {
    if (document.body.classList.contains('le-peek')) return;
    if (e.target.closest('.le-top, .le-classic, .pf-alert, .imp-fix, .le-draft')) return;
    var t = e.target.closest('[data-edit]');
    var inStage = e.target.closest('#le-stage');
    if (!t && !inStage) return;
    e.preventDefault();
    var key = t ? t.dataset.edit : 'bg';
    if (t && t.classList.contains('pf-inner')) key = 'bg';
    open(key);
  }, true);

  /* visitor peek */
  var peek = document.getElementById('le-peek');
  peek.addEventListener('click', function () {
    var on = !document.body.classList.contains('le-peek');
    document.body.classList.toggle('le-peek', on);
    peek.setAttribute('aria-pressed', on ? 'true' : 'false');
    peek.lastChild.textContent = on ? ' Kembali mengedit' : ' Lihat sebagai pengunjung';
    if (on) closePanel();
  });

  /* ---------- live preview ---------- */
  var waiters = [];
  function whenRendered(fn) { waiters.push(fn); }
  function changed(now) {
    dirty = true; setState('Belum disimpan');
    clearTimeout(timer);
    timer = setTimeout(render, now ? 0 : 280);
  }
  function render() {
    var my = ++seq;
    stage.setAttribute('aria-busy', 'true');
    fetch(B.preview, {
      method: 'POST', credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', 'Accept': 'text/html', 'X-CSRF-TOKEN': B.csrf },
      body: JSON.stringify({ config: cfg, has_html: html.trim() !== '', edit: 1 })
    }).then(function (r) {
      if (r.status === 429) { setTimeout(render, 1500); return null; }
      return r.ok ? r.text() : Promise.reject(r.status);
    }).then(function (t) {
      if (t === null || my !== seq) return;
      morph(t);
      stage.removeAttribute('aria-busy');
      var w = waiters; waiters = []; w.forEach(function (fn) { fn(); });
    }).catch(function () { stage.removeAttribute('aria-busy'); setState('Pratinjau gagal dimuat, coba lagi'); });
  }
  /* Replace only what changed, and keep the sandboxed custom HTML frame alive (re-creating it would reload it). */
  function morph(markup) {
    var tpl = document.createElement('template');
    tpl.innerHTML = markup.trim();
    var fresh = tpl.content;
    var oldPf = stage.querySelector('.pf');
    var newPf = fresh.querySelector('.pf');
    if (!oldPf || !newPf) { stage.innerHTML = ''; stage.appendChild(fresh); return; }
    Array.prototype.forEach.call(stage.querySelectorAll('link[rel=stylesheet]'), function (l) { l.remove(); });
    Array.prototype.forEach.call(fresh.querySelectorAll('link[rel=stylesheet]'), function (l) { stage.insertBefore(l, stage.firstChild); });
    oldPf.className = newPf.className; oldPf.setAttribute('style', newPf.getAttribute('style') || '');
    var ob = oldPf.querySelector('.pf-bg'), nb = newPf.querySelector('.pf-bg');
    if (ob && nb) ob.setAttribute('style', nb.getAttribute('style') || '');
    var oh = oldPf.querySelector('.pf-head'), nh = newPf.querySelector('.pf-head');
    if (oh && nh && oh.innerHTML !== nh.innerHTML) oh.innerHTML = nh.innerHTML;
    var og = oldPf.querySelector('.pf-grid'), ng = newPf.querySelector('.pf-grid');
    if (!og || !ng) return;
    var pool = Array.prototype.slice.call(og.children);
    var keepFrame = pool.filter(function (s) { return s.querySelector('#member-frame'); })[0];
    var next = Array.prototype.map.call(ng.children, function (n) {
      if (n.dataset.type === 'custom_html' && keepFrame && html === initialHtml) {
        keepFrame.dataset.edit = n.dataset.edit; keepFrame.setAttribute('aria-label', n.getAttribute('aria-label'));
        return keepFrame;
      }
      for (var k = 0; k < pool.length; k++) {
        if (pool[k] !== keepFrame && pool[k].outerHTML === n.outerHTML) return pool.splice(k, 1)[0];
      }
      return n;
    });
    next.forEach(function (n, i) { if (og.children[i] !== n) og.insertBefore(n, og.children[i] || null); });
    while (og.children.length > next.length) og.removeChild(og.lastChild);
    highlight();
  }

  /* ---------- save bar ---------- */
  var submitting = false;
  form.addEventListener('submit', function (e) {
    var btn = e.submitter || document.getElementById('le-save');
    if (btn.dataset.action === 'publish' && !window.confirm('Terbitkan sekarang? Profilmu langsung berubah untuk semua orang.')) { e.preventDefault(); return; }
    document.getElementById('le-action').value = btn.dataset.action;
    document.getElementById('le-config').value = JSON.stringify(cfg);
    document.getElementById('le-html').value = html;
    submitting = true;
    form.querySelectorAll('button').forEach(function (b) { b.disabled = true; });
    setState(btn.dataset.action === 'publish' ? 'Menerbitkan…' : 'Menyimpan draft…');
  });
  document.getElementById('le-cancel').addEventListener('click', function () {
    if (dirty && B.mode === 'import') { if (window.confirm('Buang pratinjau dari AI? Profilmu tetap seperti sekarang.')) { submitting = true; location.href = '/komunitas/halamanku'; } return; }
    if (dirty) {
      if (!window.confirm('Buang perubahan yang belum disimpan?')) return;
      cfg = JSON.parse(initial); html = initialHtml; dirty = false; closePanel(); render();
      setState(B.hasDraft ? 'Draft belum tayang' : 'Belum ada perubahan');
      return;
    }
    if (B.hasDraft) {
      if (window.confirm('Buang draft? Profil yang sudah tayang tidak berubah.')) { submitting = true; document.getElementById('le-discard').submit(); }
      return;
    }
    location.href = '/u/' + B.username;
  });
  window.addEventListener('beforeunload', function (e) { if (dirty && !submitting) { e.preventDefault(); e.returnValue = ''; } });
})();

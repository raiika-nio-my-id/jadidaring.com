(function () {
  var form = document.getElementById('pf-edit');
  if (!form) return;
  var live = document.getElementById('pf-live');
  var cfgField = document.getElementById('pf-config');
  var TYPES = JSON.parse(form.dataset.types);
  var LABELS = { about: 'Tentang aku', status: 'Status', gallery: 'Galeri', links: 'Tautan', counter: 'Penghitung pengunjung', music: 'Pemutar musik', friends: 'Top teman', quote: 'Kutipan', youtube: 'Video YouTube', spotify: 'Spotify', custom_html: 'Widget HTML kustom' };
  var DEFAULT_ON = ['status', 'about', 'counter', 'links'];
  var order = TYPES.slice();
  var enabled = {};
  var timer = null;

  function get(o, path) { return path.split('.').reduce(function (a, k) { return a == null ? a : a[k]; }, o); }
  function set(o, path, v) { var ks = path.split('.'); var last = ks.pop(); var t = ks.reduce(function (a, k) { return a[k] = a[k] || {}; }, o); t[last] = v; }

  function lines(id) { return (form.elements[id].value || '').split('\n').map(function (s) { return s.trim(); }).filter(Boolean); }
  function pair(s) { var i = s.indexOf('|'); return i < 0 ? [s.trim(), ''] : [s.slice(0, i).trim(), s.slice(i + 1).trim()]; }

  // Any decimal is accepted: clamp to the field's min/max and round to 2 decimals (the server does the same).
  function num(el) {
    var n = Number(String(el.value).replace(',', '.'));
    if (!isFinite(n)) n = Number(el.min) || 0;
    if (el.min !== '') n = Math.max(Number(el.min), n);
    if (el.max !== '') n = Math.min(Number(el.max), n);
    return Math.round(n * 100) / 100;
  }

  function collect() {
    var c = {};
    form.querySelectorAll('[data-path]').forEach(function (el) {
      set(c, el.dataset.path, el.type === 'checkbox' ? el.checked : (el.type === 'number' || el.type === 'range') ? num(el) : el.value);
    });
    c.widgets = [];
    order.forEach(function (t) {
      if (!enabled[t]) return;
      var w = { type: t };
      if (t === 'gallery') w.items = lines('w_gallery').map(function (l) { var p = pair(l); return { url: p[0], caption: p[1] }; });
      if (t === 'links') w.items = lines('w_links').map(function (l) { var p = pair(l); return { label: p[0], url: p[1] }; });
      if (t === 'friends') w.items = lines('w_friends').map(function (u) { return { username: u.replace(/^@/, '') }; });
      if (t === 'quote') { w.text = form.elements.w_quote.value; w.author = form.elements.w_quote_author.value; }
      if (t === 'youtube') w.id = form.elements.w_youtube.value;
      if (t === 'spotify') w.url = form.elements.w_spotify.value;
      c.widgets.push(w);
    });
    return c;
  }

  function renderList() {
    var ul = document.getElementById('pf-widgets');
    ul.innerHTML = '';
    order.forEach(function (t, i) {
      var li = document.createElement('li');
      var cb = document.createElement('input'); cb.type = 'checkbox'; cb.checked = !!enabled[t]; cb.id = 'wcb_' + t;
      cb.addEventListener('change', function () { enabled[t] = cb.checked; changed(); });
      var lb = document.createElement('label'); lb.htmlFor = cb.id; lb.textContent = LABELS[t] || t;
      var up = document.createElement('button'); up.type = 'button'; up.textContent = '↑'; up.setAttribute('aria-label', 'Naikkan ' + LABELS[t]); up.disabled = i === 0;
      var dn = document.createElement('button'); dn.type = 'button'; dn.textContent = '↓'; dn.setAttribute('aria-label', 'Turunkan ' + LABELS[t]); dn.disabled = i === order.length - 1;
      up.addEventListener('click', function () { order.splice(i - 1, 0, order.splice(i, 1)[0]); renderList(); changed(); });
      dn.addEventListener('click', function () { order.splice(i + 1, 0, order.splice(i, 1)[0]); renderList(); changed(); });
      li.appendChild(cb); li.appendChild(lb); li.appendChild(up); li.appendChild(dn);
      ul.appendChild(li);
    });
  }

  function fill(c) {
    form.querySelectorAll('[data-path]').forEach(function (el) {
      var v = get(c, el.dataset.path);
      if (v === undefined || v === null) return;
      if (el.type === 'checkbox') el.checked = !!v; else el.value = v;
    });
    var ws = Array.isArray(c.widgets) ? c.widgets : [];
    var seen = {}; var next = [];
    enabled = {};
    ws.forEach(function (w) {
      if (!w || TYPES.indexOf(w.type) < 0 || seen[w.type]) return;
      seen[w.type] = 1; next.push(w.type); enabled[w.type] = true;
      if (w.type === 'gallery') form.elements.w_gallery.value = (w.items || []).map(function (i) { return i.url + (i.caption ? ' | ' + i.caption : ''); }).join('\n');
      if (w.type === 'links') form.elements.w_links.value = (w.items || []).map(function (i) { return i.label + ' | ' + i.url; }).join('\n');
      if (w.type === 'friends') form.elements.w_friends.value = (w.items || []).map(function (i) { return i.username; }).join('\n');
      if (w.type === 'quote') { form.elements.w_quote.value = w.text || ''; form.elements.w_quote_author.value = w.author || ''; }
      if (w.type === 'youtube') form.elements.w_youtube.value = w.id || '';
      if (w.type === 'spotify') form.elements.w_spotify.value = w.id ? 'https://open.spotify.com/' + w.kind + '/' + w.id : '';
    });
    TYPES.forEach(function (t) { if (next.indexOf(t) < 0) next.push(t); });
    order = next;
    renderList();
  }

  function preview() {
    var c = collect();
    cfgField.value = JSON.stringify(c);
    fetch(form.dataset.preview, {
      method: 'POST', credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', 'Accept': 'text/html', 'X-CSRF-TOKEN': form.dataset.csrf },
      body: JSON.stringify({ config: c, has_html: (form.elements.custom_html.value || '').trim() !== '' })
    }).then(function (r) { return r.ok ? r.text() : Promise.reject(); })
      .then(function (h) { live.innerHTML = h; })
      .catch(function () { live.textContent = 'Pratinjau gagal dimuat.'; });
  }
  function changed() { cfgField.value = JSON.stringify(collect()); clearTimeout(timer); timer = setTimeout(preview, 350); }

  form.addEventListener('input', changed);
  form.addEventListener('change', changed);
  form.addEventListener('submit', function () { cfgField.value = JSON.stringify(collect()); });

  document.getElementById('pf-import-go').addEventListener('click', function () {
    var msg = document.getElementById('pf-import-msg');
    var raw = document.getElementById('pf-import').value.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
    try {
      var c = JSON.parse(raw);
      if (c && c.config && typeof c.config === 'object') { if (typeof c.html === 'string' && c.html) form.elements.custom_html.value = c.html; c = c.config; }
      fill(c); changed(); msg.textContent = 'Konfigurasi dimuat ke editor. Periksa pratinjau lalu buat draft.';
    } catch (e) { msg.textContent = 'JSON tidak valid. Pastikan hanya menempel isi blok json dari AI.'; }
  });

  var initial = {};
  try { initial = JSON.parse(form.dataset.initial); } catch (e) { initial = {}; }
  fill(initial);
  if (!initial.widgets) { enabled = {}; DEFAULT_ON.forEach(function (t) { enabled[t] = true; }); renderList(); }
  changed();
})();

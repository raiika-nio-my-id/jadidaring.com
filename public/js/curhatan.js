/* Curhatan: likes without reload, "Muat lagi", composer counter / auto-grow / image preview, delete confirms.
   Every action also works as a plain form post when this script does not run. */
(function () {
    'use strict';
    var token = document.querySelector('meta[name="csrf-token"]');
    function track(name, params) { if (window.jdTrack) { window.jdTrack(name, params || {}); } }

    document.addEventListener('submit', function (e) {
        var form = e.target;
        var msg = form.getAttribute && form.getAttribute('data-ch-confirm');
        if (msg && !window.confirm(msg)) { e.preventDefault(); return; }

        if (form.classList && form.classList.contains('ch-likeform') && window.fetch) {
            e.preventDefault();
            var btn = form.querySelector('[data-ch-like]');
            if (!btn || btn.disabled) { return; }
            btn.disabled = true;
            fetch(form.action, {
                method: 'POST', credentials: 'same-origin',
                headers: { 'Accept': 'application/json', 'X-CSRF-TOKEN': token ? token.content : '', 'X-Requested-With': 'XMLHttpRequest' }
            }).then(function (r) {
                if (r.status === 429) { throw new Error('Terlalu cepat. Coba lagi sebentar.'); }
                if (!r.ok) { throw new Error('Gagal. Muat ulang halaman lalu coba lagi.'); }
                return r.json();
            }).then(function (d) {
                btn.classList.toggle('is-on', d.liked);
                btn.setAttribute('aria-pressed', d.liked ? 'true' : 'false');
                btn.firstElementChild.textContent = d.liked ? '\u2665' : '\u2661';
                var c = btn.querySelector('[data-ch-count]');
                if (c) { c.textContent = Number(d.count).toLocaleString('id-ID'); }
                if (d.liked) { track('like', { content_type: 'curhatan' }); }
            }).catch(function (err) { window.alert(err.message); })
              .then(function () { btn.disabled = false; });
        }
    });

    document.addEventListener('click', function (e) {
        var more = e.target.closest ? e.target.closest('[data-ch-more]') : null;
        if (!more || !window.fetch) { return; }
        e.preventDefault();
        var wrap = more.parentNode;
        more.textContent = 'Memuat…';
        fetch(more.getAttribute('data-ch-more'), { credentials: 'same-origin', headers: { 'Accept': 'text/html' } })
            .then(function (r) { if (!r.ok) { throw new Error(); } return r.text(); })
            .then(function (html) {
                var tpl = document.createElement('template');
                tpl.innerHTML = html;
                wrap.parentNode.insertBefore(tpl.content, wrap);
                wrap.remove();
            })
            .catch(function () { window.location.href = more.href; });
    });

    var composer = document.querySelector('[data-ch-composer]');
    if (composer) {
        var text = composer.querySelector('[data-ch-text]');
        var counter = composer.querySelector('[data-ch-counter]');
        var file = composer.querySelector('[data-ch-file]');
        var preview = composer.querySelector('[data-ch-preview]');
        var img = composer.querySelector('[data-ch-preview-img]');
        var max = Number(text.getAttribute('maxlength')) || 500;
        var grow = function () {
            text.style.height = 'auto';
            text.style.height = Math.min(text.scrollHeight + 2, 320) + 'px';
            var n = Array.from(text.value).length;
            counter.textContent = n + '/' + max;
            counter.classList.toggle('is-near', n > max - 40);
        };
        text.addEventListener('input', grow);
        grow();
        file.addEventListener('change', function () {
            var f = file.files && file.files[0];
            if (!f) { preview.hidden = true; return; }
            if (f.size > 5 * 1024 * 1024) { window.alert('Ukuran gambar maksimal 5 MB.'); file.value = ''; preview.hidden = true; return; }
            img.src = URL.createObjectURL(f);
            preview.hidden = false;
        });
        composer.querySelector('[data-ch-rm]').addEventListener('click', function () {
            file.value = '';
            preview.hidden = true;
            img.removeAttribute('src');
        });
        composer.addEventListener('submit', function () {
            var b = composer.querySelector('.ch-send');
            if (b) { b.disabled = true; b.textContent = 'Mengirim…'; }
        });
    }
})();

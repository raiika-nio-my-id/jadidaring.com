/* Admin-only moderation on public pages ('⋯' menu on Curhatan, comments). Loaded only for panel admins.
   Calls the /admin panel routes with the page's CSRF token; the server (panel.admin) is the guard. */
(function () {
    'use strict';
    var token = document.querySelector('meta[name="csrf-token"]');
    var open = null;

    function closeMenu() {
        if (!open) { return; }
        open.querySelector('.jd-mod__menu').hidden = true;
        open.querySelector('.jd-mod__btn').setAttribute('aria-expanded', 'false');
        open = null;
    }

    var toastEl = null, toastTimer = 0;
    function toast(msg, ok) {
        if (!toastEl) {
            toastEl = document.createElement('div');
            toastEl.className = 'jd-toast';
            toastEl.setAttribute('role', 'status');
            toastEl.setAttribute('aria-live', 'polite');
            document.body.appendChild(toastEl);
        }
        toastEl.textContent = msg;
        toastEl.classList.toggle('is-ok', !!ok);
        toastEl.classList.add('is-on');
        clearTimeout(toastTimer);
        toastTimer = setTimeout(function () { toastEl.classList.remove('is-on'); }, ok ? 2200 : 4200);
    }

    var dlg = null;
    function ask(title, text, yesLabel, calm) {
        if (!window.HTMLDialogElement || !document.createElement('dialog').showModal) {
            return Promise.resolve(window.confirm(title + '\n\n' + text));
        }
        if (!dlg) {
            dlg = document.createElement('dialog');
            dlg.className = 'jd-mod-dlg';
            dlg.innerHTML = '<form method="dialog"><h2></h2><p></p><div class="jd-mod-dlg__row"><button value="no" class="jd-mod-dlg__no">Batal</button><button value="yes" class="jd-mod-dlg__yes"></button></div></form>';
            document.body.appendChild(dlg);
        }
        dlg.querySelector('h2').textContent = title;
        dlg.querySelector('p').textContent = text;
        var yes = dlg.querySelector('.jd-mod-dlg__yes');
        yes.textContent = yesLabel;
        yes.classList.toggle('is-calm', !!calm);
        dlg.returnValue = '';
        return new Promise(function (resolve) {
            dlg.addEventListener('close', function done() {
                dlg.removeEventListener('close', done);
                resolve(dlg.returnValue === 'yes');
            });
            dlg.showModal();
            dlg.querySelector('.jd-mod-dlg__no').focus();
        });
    }

    function collapse(item) {
        if (!item) { return; }
        var h = item.getBoundingClientRect().height;
        item.style.height = h + 'px';
        item.offsetHeight; // reflow so the height transition starts from the current size
        item.classList.add('is-mod-gone');
        item.style.height = '0px';
        var gone = function () { if (item.parentNode) { item.parentNode.removeChild(item); } };
        item.addEventListener('transitionend', function (e) { if (e.propertyName === 'height') { gone(); } });
        setTimeout(gone, 450);
    }

    function failMessage(status) {
        if (status === 419) { return 'Sesi habis. Muat ulang halaman lalu coba lagi.'; }
        if (status === 401 || status === 403) { return 'Khusus admin. Masuk lagi sebagai admin.'; }
        if (status === 429) { return 'Terlalu cepat. Coba lagi sebentar.'; }
        return 'Gagal. Coba lagi sebentar.';
    }

    function run(btn) {
        var act = btn.getAttribute('data-mod-act');
        var what = btn.getAttribute('data-what') || 'konten';
        var del = act === 'delete';
        var title = del ? 'Hapus ' + what + '?' : 'Sembunyikan ' + what + '?';
        var text = del ? 'Dihapus permanen untuk semua orang. Salinannya tetap tersimpan di Backup admin.'
                       : 'Tidak tampil lagi untuk publik. Bisa ditampilkan lagi dari panel admin.';
        closeMenu();
        ask(title, text, del ? 'Hapus' : 'Sembunyikan', !del).then(function (yes) {
            if (!yes) { return; }
            var item = btn.closest('[data-mod-item]');
            if (item) { item.classList.add('is-mod-busy'); }
            var body = new FormData();
            if (!del) { body.append('hidden', '1'); }
            fetch(btn.getAttribute('data-url'), {
                method: del ? 'DELETE' : 'POST', credentials: 'same-origin', body: del ? null : body,
                headers: { 'Accept': 'application/json', 'X-CSRF-TOKEN': token ? token.content : '', 'X-Requested-With': 'XMLHttpRequest' }
            }).then(function (r) {
                if (r.status === 404) { return { message: 'Sudah tidak ada.' }; }
                if (!r.ok) { throw new Error(failMessage(r.status)); }
                return r.json();
            }).then(function (d) {
                toast(d.message || 'Selesai.', true);
                var after = btn.getAttribute('data-after');
                if (after) { setTimeout(function () { window.location.href = after; }, 500); }
                collapse(item);
            }).catch(function (err) {
                if (item) { item.classList.remove('is-mod-busy'); }
                toast(err && err.message ? err.message : 'Gagal. Periksa koneksi lalu coba lagi.', false);
            });
        });
    }

    document.addEventListener('click', function (e) {
        var t = e.target.closest ? e.target : null;
        if (!t) { return; }
        var item = t.closest('.jd-mod__item');
        if (item) { e.preventDefault(); run(item); return; }
        var btn = t.closest('.jd-mod__btn');
        if (btn) {
            e.preventDefault();
            var wrap = btn.closest('[data-jd-mod]');
            if (open === wrap) { closeMenu(); return; }
            closeMenu();
            var menu = wrap.querySelector('.jd-mod__menu');
            menu.hidden = false;
            menu.classList.remove('is-left');
            if (menu.getBoundingClientRect().left < 8) { menu.classList.add('is-left'); }
            var r = btn.getBoundingClientRect();
            menu.classList.toggle('is-up', window.innerHeight - r.bottom < menu.offsetHeight + 24 && r.top > menu.offsetHeight + 24);
            btn.setAttribute('aria-expanded', 'true');
            open = wrap;
            var first = menu.querySelector('.jd-mod__item');
            if (first) { first.focus({ preventScroll: true }); }
            return;
        }
        if (open && !open.contains(t)) { closeMenu(); }
    });
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && open) { var b = open.querySelector('.jd-mod__btn'); closeMenu(); b.focus(); }
    });

    /* For JS-rendered lists (news comments): build the same menu as clay/_mod-menu.blade.php. */
    window.JdMod = {
        menu: function (o) {
            var wrap = document.createElement('span');
            wrap.className = 'jd-mod';
            wrap.setAttribute('data-jd-mod', '');
            wrap.innerHTML = '<button type="button" class="jd-mod__btn" aria-haspopup="true" aria-expanded="false" title="Moderasi admin"><span aria-hidden="true">\u22ef</span><span class="sr-only">Moderasi admin</span></button><span class="jd-mod__menu" hidden><span class="jd-mod__label">Admin</span></span>';
            var menu = wrap.lastChild;
            [['hide', 'Sembunyikan', o.hideUrl, ''], ['delete', 'Hapus', o.deleteUrl, ' is-danger']].forEach(function (a) {
                if (!a[2]) { return; }
                var b = document.createElement('button');
                b.type = 'button';
                b.className = 'jd-mod__item' + a[3];
                b.setAttribute('data-mod-act', a[0]);
                b.setAttribute('data-url', a[2]);
                b.setAttribute('data-what', o.what || 'komentar');
                b.textContent = a[1];
                menu.appendChild(b);
            });
            return wrap;
        }
    };
})();

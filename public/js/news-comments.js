(function () {
    var box = document.getElementById('komentar');
    if (!box) { return; }
    var list = box.querySelector('.news-comments__list');
    var form = box.querySelector('.news-comments__form');
    var url = box.getAttribute('data-url');
    var loaded = false;

    function render(c) {
        var item = document.createElement('div');
        item.className = 'news-comment';
        item.setAttribute('data-mod-item', '');
        var who = document.createElement('strong');
        who.textContent = c.user;
        var text = document.createElement('p');
        text.textContent = c.body;
        var modBase = box.getAttribute('data-mod-base');
        if (modBase && c.id && window.JdMod) {
            /* admin-only (attribute rendered for panel admins); the /admin route is the real guard */
            var head = document.createElement('div');
            head.className = 'news-comment__head';
            head.appendChild(who);
            head.appendChild(window.JdMod.menu({ what: 'komentar', hideUrl: modBase + c.id + '/toggle', deleteUrl: modBase + c.id }));
            item.appendChild(head);
        } else {
            item.appendChild(who);
        }
        item.appendChild(text);
        return item;
    }

    function load() {
        if (loaded) { return; }
        loaded = true;
        fetch(url, { headers: { 'Accept': 'application/json' }, credentials: 'same-origin' })
            .then(function (r) { return r.json(); })
            .then(function (d) {
                list.textContent = '';
                if (!d.comments.length) {
                    var p = document.createElement('p');
                    p.className = 'news-comments__hint';
                    p.textContent = 'Belum ada komentar.';
                    list.appendChild(p);
                }
                d.comments.forEach(function (c) { list.appendChild(render(c)); });
                if (form) { form.hidden = false; }
            })
            .catch(function () { list.textContent = 'Komentar gagal dimuat.'; loaded = false; });
    }

    if ('IntersectionObserver' in window) {
        var io = new IntersectionObserver(function (entries) {
            if (entries.some(function (e) { return e.isIntersecting; })) { io.disconnect(); load(); }
        }, { rootMargin: '200px' });
        io.observe(box);
    } else {
        load();
    }

    if (form) {
        form.addEventListener('submit', function (e) {
            e.preventDefault();
            var msg = form.querySelector('.news-comments__msg');
            var token = document.querySelector('meta[name="csrf-token"]');
            msg.textContent = '';
            fetch(url, {
                method: 'POST',
                credentials: 'same-origin',
                headers: { 'Accept': 'application/json', 'Content-Type': 'application/json', 'X-CSRF-TOKEN': token ? token.content : '' },
                body: JSON.stringify({ body: form.body.value })
            }).then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); })
              .then(function (res) {
                  if (!res.ok) { msg.textContent = res.d.message || 'Gagal mengirim komentar.'; return; }
                  var first = list.querySelector('.news-comments__hint');
                  if (first) { first.remove(); }
                  list.insertBefore(render(res.d.comment), list.firstChild);
                  if (window.jdTrack) { window.jdTrack('comment_post', { content_type: 'article' }); }
                  form.body.value = '';
              }).catch(function () { msg.textContent = 'Gagal mengirim komentar.'; });
        });
    }
})();

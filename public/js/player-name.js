/*
 * Shared player name for every game on www.
 *
 * The name gate in each game still asks "Siapa namamu?" and still stores
 * sessionStorage["jdng.<slug>"] plus that game's own key. Those keys were
 * isolated when each game had its own origin. On one origin they stay
 * separate, so every game asked again.
 *
 * This bridge runs before the gate. localStorage["jdng.name"] is the shared
 * name. A jdng.* session read returns it, so the gate stays closed. A write
 * from the gate, from a per-game name key, or from a JSON name field updates
 * it. Clearing localStorage (or removing the shared value and any saved
 * per-game name) makes the next game ask again.
 */
(function () {
    var root = typeof window !== 'undefined' ? window : globalThis;

    if (root.__jdngSharedName) {
        return;
    }

    root.__jdngSharedName = 1;

    var SHARED = 'jdng.name';
    var MAX = 24;
    var local;
    var session;

    try {
        local = root.localStorage;
    } catch (error) {
        return;
    }

    if (!local || typeof local.getItem !== 'function' || typeof local.setItem !== 'function') {
        return;
    }

    try {
        session = root.sessionStorage;
    } catch (error) {
        session = null;
    }

    var localGet = local.getItem.bind(local);
    var localSet = local.setItem.bind(local);

    function clean(value) {
        return String(value == null ? '' : value).replace(/[\u0000-\u001f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, MAX);
    }

    function isSessionKey(key) {
        return typeof key === 'string' && key.indexOf('jdng.') === 0 && key !== 'jdng.force' && key !== SHARED;
    }

    function isLocalNameKey(key) {
        if (typeof key !== 'string' || key === SHARED || key === 'jdng.force') {
            return false;
        }

        return /^[a-z0-9][a-z0-9-]{0,63}\.name$/.test(key) || /^[a-z0-9][a-z0-9-]{0,63}-name$/.test(key);
    }

    function rawName(value) {
        if (typeof value !== 'string') {
            return '';
        }

        var text = value.trim();

        if (text === '') {
            return '';
        }

        if (text.charAt(0) === '"') {
            try {
                var parsed = JSON.parse(text);

                return typeof parsed === 'string' ? clean(parsed) : '';
            } catch (error) {
                return '';
            }
        }

        if (text.charAt(0) === '{' || text.charAt(0) === '[' || text === 'null' || text === 'true' || text === 'false') {
            return '';
        }

        return clean(text);
    }

    var ME = root.__JD_ME && typeof root.__JD_ME === 'object' ? root.__JD_ME : null;

    function readShared() {
        if (ME) {
            return clean(ME.name) || 'Tamu';
        }

        try {
            return clean(localGet(SHARED));
        } catch (error) {
            return '';
        }
    }

    function writeShared(name) {
        if (ME) {
            return;
        }

        try {
            if (name) {
                localSet(SHARED, name);
            }
        } catch (error) {
            // Private mode can reject writes. The gate still works for this tab.
        }
    }

    function promote() {
        if (readShared()) {
            return;
        }

        try {
            var index;
            var key;
            var name;

            for (index = 0; index < local.length; index += 1) {
                key = local.key(index);

                if (!isLocalNameKey(key)) {
                    continue;
                }

                name = rawName(localGet(key));

                if (name) {
                    writeShared(name);

                    return;
                }
            }
        } catch (error) {
            // Ignore a storage walk that a browser rejects.
        }
    }

    function wrap(storage, kind) {
        var get = storage.getItem.bind(storage);
        var set = storage.setItem.bind(storage);

        storage.getItem = function (key) {
            var current = null;

            try {
                current = get(key);
            } catch (error) {
                current = null;
            }

            if (kind === 'session' && isSessionKey(key)) {
                return readShared() || null;
            }

            if (kind === 'local' && isLocalNameKey(key) && (current == null || current === '')) {
                return readShared() || current;
            }

            return current;
        };

        storage.setItem = function (key, value) {
            set(key, value);

            var name = rawName(typeof value === 'string' ? value : String(value));

            if (!name) {
                return;
            }

            if ((kind === 'session' && isSessionKey(key)) || (kind === 'local' && isLocalNameKey(key))) {
                writeShared(name);
            }
        };
    }

    function loginModal(url) {
        if (!root.document || root.document.getElementById('jd-login-modal')) {
            return;
        }

        var box = root.document.createElement('div');
        box.id = 'jd-login-modal';
        box.setAttribute('role', 'dialog');
        box.setAttribute('aria-modal', 'true');
        box.style.cssText = 'position:fixed;inset:0;z-index:2147483600;display:flex;align-items:center;justify-content:center;background:rgba(43,36,64,.6);font:600 15px/1.5 system-ui,sans-serif';
        box.innerHTML = '<div style="background:#fff;color:#2B2440;border-radius:24px;padding:24px;max-width:340px;margin:16px;text-align:center;box-shadow:0 12px 40px rgba(0,0,0,.35)">' +
            '<h2 style="margin:0 0 8px;font-size:20px">Masuk dulu ya</h2>' +
            '<p style="margin:0 0 16px;font-weight:500">Skor dan data mainmu disimpan ke akunmu, jadi kamu perlu masuk atau daftar.</p>' +
            '<a data-a="in" style="display:block;background:#7C5CFF;color:#fff;border-radius:16px;padding:12px;text-decoration:none;margin-bottom:8px">Masuk</a>' +
            '<a data-a="up" href="/daftar" style="display:block;background:#E9E2FF;color:#2B2440;border-radius:16px;padding:12px;text-decoration:none;margin-bottom:8px">Daftar</a>' +
            '<button type="button" style="background:none;border:0;color:#6b6480;font:inherit;cursor:pointer;padding:8px">Nanti saja</button></div>';
        box.querySelector('[data-a=in]').href = (url || '/masuk') + '?next=' + encodeURIComponent(root.location.pathname);
        box.querySelector('button').addEventListener('click', function () { box.remove(); });
        root.document.body.appendChild(box);
    }

    function watch401(status, body) {
        if (status !== 401) {
            return;
        }

        try {
            var data = typeof body === 'string' ? JSON.parse(body) : null;

            if (data && data.login) {
                loginModal(data.login);
            }
        } catch (error) {
            // Not a JSON login prompt.
        }
    }

    if (!ME || !ME.in) {
        if (typeof root.fetch === 'function') {
            var nativeFetch = root.fetch.bind(root);

            root.fetch = function () {
                return nativeFetch.apply(null, arguments).then(function (response) {
                    if (response.status === 401) {
                        response.clone().text().then(function (text) { watch401(401, text); });
                    }

                    return response;
                });
            };
        }

        if (root.XMLHttpRequest) {
            var nativeSend = root.XMLHttpRequest.prototype.send;

            root.XMLHttpRequest.prototype.send = function () {
                this.addEventListener('load', function () { watch401(this.status, this.responseText); });

                return nativeSend.apply(this, arguments);
            };
        }
    }

    promote();
    wrap(local, 'local');

    if (session && typeof session.getItem === 'function' && typeof session.setItem === 'function') {
        wrap(session, 'session');
    }
})();

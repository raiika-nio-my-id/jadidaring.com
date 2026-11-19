/*
 * Git games only (GitGames::frame, docs/games-in-git.md): the player name is the Jadidaring account name.
 *
 * Runs right after the player-name bridge (window.__JD_ME). The shared name gate (JDNG_CFG) and the
 * invite gate keep working, but every name field they list is filled with the account name, made
 * read-only and hidden (the game's JS still reads its value), and a plain non-interactive chip
 * "Main sebagai <name>" is shown in its place, so nothing looks editable. The game's own saved-name
 * keys are overwritten, so an old nickname never comes back.
 * Guests get the name "Tamu"; anything that saves answers 401 and the bridge opens the login prompt.
 * The server also replaces displayName / score names with the account name.
 */
(function () {
    var root = window;
    var doc = document;
    var me = root.__JD_ME;

    if (!me || typeof me !== 'object' || root.__jdAccountName) {
        return;
    }

    root.__jdAccountName = 1;

    function clean(value, max) {
        return String(value == null ? '' : value).replace(/[\u0000-\u001f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, max || 24);
    }

    function cfg() {
        return root.JDNG_CFG && typeof root.JDNG_CFG === 'object' ? root.JDNG_CFG : {};
    }

    var name = clean(me.in ? me.name : '', cfg().max || 24) || 'Tamu';
    var tip = me.in ? 'Nama mengikuti akun Jadidaring. Ganti di menu Akun.' : 'Kamu main sebagai Tamu. Masuk supaya namamu ikut akun.';

    root.JD_ACCOUNT_NAME = name;

    function selectors() {
        // #nameInput[aria-readonly=true]: Langit Bersama / Drawquarium lock their own field (nameLockNote).
        return (cfg().inputs || []).concat(['.jr-inv-form input[type=text]', '.jr-inv-form input:not([type])', '#jdngN', '[data-jd-account-name]', '#nameInput[aria-readonly=true]']);
    }

    var slug = (root.location.pathname.split('/')[2] || '').replace(/[^a-z0-9-]/gi, '');
    var login = (typeof me.login === 'string' && me.login.charAt(0) === '/' ? me.login : '/masuk') + (slug ? '?next=' + encodeURIComponent('/game/' + slug) : '');

    function style() {
        if (doc.getElementById('jd-an-style') || !doc.head) {
            return;
        }

        var css = doc.createElement('style');
        css.id = 'jd-an-style';
        css.textContent = '.jd-an-hide{position:absolute!important;width:1px!important;height:1px!important;padding:0!important;margin:-1px!important;border:0!important;overflow:hidden!important;clip:rect(0 0 0 0)!important;clip-path:inset(50%)!important;opacity:0!important;pointer-events:none!important}'
            + '.jd-an-chip{display:inline-flex;align-items:center;gap:8px;flex:1 1 0%;min-width:0;max-width:100%;box-sizing:border-box;padding:5px 14px 5px 5px;border-radius:20px;background:rgba(127,127,127,.16);color:inherit;font:inherit;font-size:15px;line-height:1.25;text-align:left;white-space:normal;cursor:default;-webkit-user-select:none;user-select:none;vertical-align:middle}'
            + '.jd-an-av{flex:0 0 auto;width:28px;height:28px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-weight:800;font-size:14px;color:#fff;text-transform:uppercase}'
            + '.jd-an-tx{display:block;flex:1 1 auto;min-width:0;overflow-wrap:anywhere;font-weight:500}.jd-an-tx b{font-weight:800}'
            + '.jd-an-chip a{color:inherit;font-weight:800;text-decoration:underline;cursor:pointer;white-space:nowrap}';
        doc.head.appendChild(css);
    }

    function chipFor(input) {
        // Own element names, so a game's span / label rules (e.g. .name-row span{white-space:nowrap}) do not apply.
        var chip = doc.createElement('jd-an');
        var label = input.getAttribute('data-jd-account-name-label') || 'Main sebagai';
        var av = doc.createElement('jd-an-av');
        var tx = doc.createElement('jd-an-tx');
        var b = doc.createElement('b');

        chip.className = 'jd-an-chip';
        chip.setAttribute('data-jd-an-chip', '');
        chip.title = tip;
        av.className = 'jd-an-av';
        av.setAttribute('aria-hidden', 'true');
        av.style.background = /^#[0-9a-f]{3,8}$/i.test(cfg().accent || '') ? cfg().accent : '#7c5cff';
        av.textContent = name.charAt(0);
        tx.className = 'jd-an-tx';
        b.textContent = name;
        tx.appendChild(doc.createTextNode(label + ' '));
        tx.appendChild(b);

        // A game that shows its own note under the field (#nameLock) already links to Akun / Masuk.
        if (!me.in && !(input.nextElementSibling && input.nextElementSibling.id === 'nameLock')) {
            var a = doc.createElement('a');

            a.href = login;
            a.target = '_top';
            a.textContent = 'Masuk';
            tx.appendChild(doc.createTextNode(' \u00b7 '));
            tx.appendChild(a);
        }

        chip.appendChild(av);
        chip.appendChild(tx);

        return chip;
    }

    function saveKeys() {
        try {
            (cfg().keys || []).forEach(function (key) {
                root.localStorage.setItem(key, name);
            });
        } catch (error) {
            // Storage can be blocked; the fields are still locked.
        }
    }

    function lock() {
        if (root.JDNG && root.JDNG.name !== name) {
            root.JDNG.name = name;
        }

        selectors().forEach(function (selector) {
            var list;

            try {
                list = doc.querySelectorAll(selector);
            } catch (error) {
                return;
            }

            for (var i = 0; i < list.length; i += 1) {
                var input = list[i];

                if (input.value !== name) {
                    input.value = name;

                    try {
                        input.dispatchEvent(new Event('input', { bubbles: true }));
                    } catch (error) {
                        // Old browsers.
                    }
                }

                if (!input.readOnly) {
                    input.readOnly = true;
                    input.setAttribute('aria-readonly', 'true');
                }

                if (!input.__jdChip || !input.__jdChip.isConnected) {
                    style();
                    input.classList.add('jd-an-hide');
                    input.tabIndex = -1;
                    input.setAttribute('aria-hidden', 'true');
                    input.__jdChip = chipFor(input);
                    input.insertAdjacentElement('afterend', input.__jdChip);
                }
            }
        });
    }

    // Langit Bersama / Drawquarium add their own note (#nameLock) with the Akun / Masuk link: no second link in the chip.
    function dedupeLinks() {
        if (!doc.getElementById('nameLock')) {
            return;
        }

        var links = doc.querySelectorAll('.jd-an-chip a');

        for (var i = 0; i < links.length; i += 1) {
            var dot = links[i].previousSibling;

            if (dot && dot.nodeType === 3) {
                dot.parentNode.removeChild(dot);
            }

            links[i].parentNode.removeChild(links[i]);
        }
    }

    if (root.MutationObserver) {
        new MutationObserver(dedupeLinks).observe(doc.documentElement, { childList: true, subtree: true });
    }

    saveKeys();
    lock();
    doc.addEventListener('DOMContentLoaded', function () { saveKeys(); lock(); });
    root.addEventListener('load', lock);

    // Any click, key or submit (join, play, invite) sees the account name first.
    ['click', 'keydown', 'submit', 'focusin'].forEach(function (type) {
        doc.addEventListener(type, lock, true);
    });

    // A hidden name field never keeps focus (a label click or the game's own focus() call): no caret, no keyboard.
    doc.addEventListener('focusin', function (event) {
        var t = event.target;

        if (t && t.__jdChip && typeof t.blur === 'function') {
            t.blur();
        }
    }, true);

    if (root.MutationObserver) {
        new MutationObserver(lock).observe(doc.documentElement, { childList: true, subtree: true });
    }
})();

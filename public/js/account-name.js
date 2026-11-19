/*
 * Git games only (GitGames::frame, docs/games-in-git.md): the player name is the Jadidaring account name.
 *
 * Runs right after the player-name bridge (window.__JD_ME). The shared name gate (JDNG_CFG) and the
 * invite gate keep working, but every name field they list is filled with the account name and made
 * read-only, and the game's own saved-name keys are overwritten, so an old nickname never comes back.
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
        return (cfg().inputs || []).concat(['.jr-inv-form input[type=text]', '.jr-inv-form input:not([type])', '#jdngN', '[data-jd-account-name]']);
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
                    input.title = tip;
                    input.style.opacity = '0.75';
                }
            }
        });
    }

    saveKeys();
    lock();
    doc.addEventListener('DOMContentLoaded', function () { saveKeys(); lock(); });
    root.addEventListener('load', lock);

    // Any click, key or submit (join, play, invite) sees the account name first.
    ['click', 'keydown', 'submit', 'focusin'].forEach(function (type) {
        doc.addEventListener(type, lock, true);
    });

    if (root.MutationObserver) {
        new MutationObserver(lock).observe(doc.documentElement, { childList: true, subtree: true });
    }
})();

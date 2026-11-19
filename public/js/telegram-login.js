/* Telegram login via the official widget JS popup; the signed result goes to the server callback, which verifies the hash. */
(function () {
    'use strict';
    var btn = document.getElementById('tg-login'), msg = document.getElementById('tg-msg');
    if (!btn) { return; }
    function say(t) { msg.textContent = t; msg.hidden = !t; }
    btn.addEventListener('click', function () {
        say('');
        if (!window.Telegram || !window.Telegram.Login) { say('Telegram belum siap. Coba lagi sebentar lagi.'); return; }
        var nativeOpen = window.open, blocked = false;
        window.open = function () { var w = nativeOpen.apply(window, arguments); if (!w) { blocked = true; } return w; };
        try {
            window.Telegram.Login.auth({ bot_id: btn.getAttribute('data-bot-id'), request_access: 'write' }, function (user) {
                if (!user) { say('Login Telegram dibatalkan.'); return; }
                var q = new URLSearchParams();
                Object.keys(user).forEach(function (k) { q.append(k, user[k]); });
                window.location.href = btn.getAttribute('data-callback') + '?' + q.toString();
            });
        } finally { window.open = nativeOpen; }
        if (blocked) { say('Popup Telegram diblokir. Izinkan popup untuk situs ini lalu coba lagi.'); }
    });
})();

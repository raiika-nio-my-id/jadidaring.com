/* Jadidaring realtime bridge. Injected into games on the Rust engine list.
   Keeps the game's own Pusher client untouched and only decides which socket URL
   it really opens: the freshest one from /api/game/config (a new signed 5-minute
   token for Rust, or the Reverb URL when Rust is down or switched off). */
(function () {
  var C = window.__JD_RT;
  if (!C || !window.WebSocket || window.__JD_RT_ON) return;
  window.__JD_RT_ON = true;
  var Native = window.WebSocket;
  var latest = null, at = 0, busy = false;

  function refresh() {
    if (busy) return;
    busy = true;
    fetch(C.cfg, { credentials: 'same-origin', cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) {
        var u = j && j.websocket && j.websocket.url;
        if (u) { latest = u; at = Date.now(); }
      })
      .catch(function () {})
      .then(function () { busy = false; });
  }
  refresh();
  setInterval(refresh, 240000);
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden && Date.now() - at > 200000) refresh();
  });

  function ours(u) { return /^wss?:\/\/[^/]+\/(rt\/)?app\//.test(u); }

  function W(url, protocols) {
    var u = String(url);
    if (latest && ours(u)) u = latest;
    var ws = protocols === undefined ? new Native(u) : new Native(u, protocols);
    var opened = false;
    ws.addEventListener('open', function () { opened = true; });
    ws.addEventListener('close', function () { if (!opened) refresh(); });
    return ws;
  }
  W.prototype = Native.prototype;
  W.CONNECTING = Native.CONNECTING; W.OPEN = Native.OPEN; W.CLOSING = Native.CLOSING; W.CLOSED = Native.CLOSED;
  window.WebSocket = W;
})();

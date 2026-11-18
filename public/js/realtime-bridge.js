/* Jadidaring realtime bridge. Injected into games on the Rust engine list.
   The game keeps its own Pusher-style client. This bridge decides what its
   WebSocket really is:
   - Rust engine: a WebSocket-shaped object over Server-Sent Events (the proxy in
     front of the stack does not tunnel WebSocket upgrades, but streams fine).
     Sends stay on Laravel's HTTP API exactly as before.
   - Anything else (Reverb fallback): the native WebSocket, with the freshest URL.
   Tokens are short-lived and fetched from /api/game/config, never from HTML. */
(function () {
  var C = window.__JD_RT;
  if (!C || !window.WebSocket || window.__JD_RT_ON) return;
  window.__JD_RT_ON = true;
  var Native = window.WebSocket;
  var latest = null, at = 0, busy = false;

  function refresh() {
    if (busy) return Promise.resolve();
    busy = true;
    return fetch(C.cfg, { credentials: 'same-origin', cache: 'no-store' })
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
  function isRust(u) { return /^wss?:\/\/[^/]+\/rt\/app\//.test(u); }

  /* ---- SSE-backed WebSocket ---- */
  function Sse(url) {
    var self = this;
    this.url = url; this.readyState = 0; this.protocol = ''; this.extensions = ''; this.bufferedAmount = 0;
    this._l = {}; this._ch = []; this._abort = null; this._timer = null; this._closed = false; this._ready = false; this._gen = 0;
    var m = /^wss?:\/\/([^/]+)\/rt\/app\/([^?]+)\?(.*)$/.exec(url);
    this._host = m[1]; this._key = m[2]; this._qs = m[3];
    setTimeout(function () {
      if (self._closed) return;
      self.readyState = 1;
      self._emit('open', {});
      self._emit('message', { data: JSON.stringify({ event: 'pusher:connection_established', data: JSON.stringify({ socket_id: '1.1', activity_timeout: 30 }) }) });
    }, 0);
  }
  Sse.CONNECTING = 0; Sse.OPEN = 1; Sse.CLOSING = 2; Sse.CLOSED = 3;
  Sse.prototype.CONNECTING = 0; Sse.prototype.OPEN = 1; Sse.prototype.CLOSING = 2; Sse.prototype.CLOSED = 3;
  Sse.prototype.addEventListener = function (t, f) { (this._l[t] = this._l[t] || []).push(f); };
  Sse.prototype.removeEventListener = function (t, f) { this._l[t] = (this._l[t] || []).filter(function (x) { return x !== f; }); };
  Sse.prototype._emit = function (t, e) {
    e.type = t; e.target = this;
    var h = this['on' + t]; if (typeof h === 'function') { try { h.call(this, e); } catch (x) { setTimeout(function () { throw x; }); } }
    (this._l[t] || []).slice().forEach(function (f) { try { f.call(this, e); } catch (x) { setTimeout(function () { throw x; }); } }, this);
  };
  Sse.prototype._reply = function (o) { var s = this; setTimeout(function () { if (!s._closed) s._emit('message', { data: JSON.stringify(o) }); }, 0); };
  Sse.prototype.send = function (data) {
    var m; try { m = JSON.parse(data); } catch (e) { return; }
    var d = m.data; if (typeof d === 'string') { try { d = JSON.parse(d); } catch (e) { d = {}; } } d = d || {};
    if (m.event === 'pusher:ping') return this._reply({ event: 'pusher:pong', data: '{}' });
    if (m.event === 'pusher:subscribe' && d.channel) {
      if (this._ch.indexOf(d.channel) < 0) this._ch.push(d.channel);
      this._pending = (this._pending || []).concat(d.channel);
      this._schedule();
    }
    if (m.event === 'pusher:unsubscribe' && d.channel) {
      this._ch = this._ch.filter(function (c) { return c !== d.channel; });
      this._schedule();
    }
  };
  Sse.prototype._schedule = function () {
    var s = this; clearTimeout(this._timer);
    this._timer = setTimeout(function () { s._connect(); }, 25);
  };
  Sse.prototype._connect = function () {
    var s = this; if (s._closed) return;
    if (s._abort) s._abort.abort();
    var gen = ++s._gen;
    if (!s._ch.length) { s._abort = null; return; }
    var ac = s._abort = new AbortController();
    var qs = s._qs;
    if (latest) { var lm = /[?&]t=([^&]+)/.exec(latest); if (lm) qs = qs.replace(/([?&]|^)t=[^&]*/, '$1t=' + lm[1]); }
    var url = location.protocol + '//' + s._host + '/rt/sse/' + s._key + '?' + qs + '&c=' + encodeURIComponent(s._ch.join(','));
    var announced = false;
    fetch(url, { credentials: 'omit', cache: 'no-store', signal: ac.signal }).then(function (r) {
      if (!r.ok || !r.body) throw new Error('sse ' + r.status);
      var rd = r.body.getReader(), dec = new TextDecoder(), buf = '';
      function pump() {
        return rd.read().then(function (x) {
          if (gen !== s._gen || s._closed) return;
          if (x.done) throw new Error('eof');
          buf += dec.decode(x.value, { stream: true });
          var i;
          while ((i = buf.indexOf('\n\n')) >= 0) {
            var block = buf.slice(0, i); buf = buf.slice(i + 2);
            if (block.indexOf('data: ') !== 0) continue;
            var payload = block.slice(6), o; try { o = JSON.parse(payload); } catch (e) { continue; }
            if (o.event === 'jd:ready') {
              if (!announced) {
                announced = true;
                (s._pending || []).splice(0).forEach(function (c) { s._reply({ event: 'pusher_internal:subscription_succeeded', channel: c, data: '{}' }); });
              }
              continue;
            }
            s._emit('message', { data: payload });
          }
          return pump();
        });
      }
      return pump();
    }).catch(function (e) {
      if (gen !== s._gen || s._closed) return;
      s._closed = true; s.readyState = 3;
      refresh();
      s._emit('close', { code: 1006, reason: String(e && e.message || e), wasClean: false });
    });
  };
  Sse.prototype.close = function () {
    if (this._closed) return;
    this._closed = true; this.readyState = 3; clearTimeout(this._timer);
    if (this._abort) this._abort.abort();
    this._emit('close', { code: 1000, reason: '', wasClean: true });
  };

  function W(url, protocols) {
    var u = String(url);
    if (latest && ours(u)) u = latest;
    if (isRust(u)) return new Sse(u);
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

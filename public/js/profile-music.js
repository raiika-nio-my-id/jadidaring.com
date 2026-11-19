/* Profile music "Putar otomatis": try to play at once; if the browser blocks sound, start on the visitor's
   first tap, click, key or scroll. A visitor who paused it on this profile is never auto-played again. */
(function () {
  'use strict';
  var pf = document.querySelector('.pf[data-autoplay]');
  if (!pf) return;
  var KEY = 'jd-music-off:' + (pf.dataset.owner || '');
  var off = false;
  try { off = localStorage.getItem(KEY) === '1'; } catch (e) {}
  var audio = pf.querySelector('audio[data-ap]');
  var frame = pf.querySelector('iframe[data-ap]');
  var hint = null;
  var started = false;

  function remember(v) { try { if (v) localStorage.setItem(KEY, '1'); else localStorage.removeItem(KEY); } catch (e) {} }
  function showHint() {
    if (hint || started) return;
    hint = document.createElement('button');
    hint.type = 'button';
    hint.className = 'pf-ap-hint';
    hint.innerHTML = '<span aria-hidden="true">♪</span> Ketuk untuk memutar musik';
    document.body.appendChild(hint);
  }
  function hideHint() { if (hint) { hint.remove(); hint = null; } }
  var onGesture = null;
  var EVENTS = ['pointerdown', 'keydown', 'touchstart', 'scroll', 'wheel'];
  function onAny(e) { if (onGesture) onGesture(e); }
  function unlisten() { EVENTS.forEach(function (ev) { window.removeEventListener(ev, onAny, true); }); }
  function listen() { EVENTS.forEach(function (ev) { window.addEventListener(ev, onAny, { capture: true, passive: true }); }); }

  if (audio) {
    if (off) return;
    var userPaused = false;
    audio.addEventListener('play', function () { started = true; hideHint(); unlisten(); remember(false); });
    audio.addEventListener('pause', function () { if (started && !audio.ended && userPaused) remember(true); });
    // Only count a pause the visitor made on the player itself.
    audio.addEventListener('pointerdown', function () { userPaused = true; });
    audio.addEventListener('keydown', function () { userPaused = true; });
    var tryPlay = function () { var p = audio.play(); return p && p.then ? p : Promise.resolve(); };
    onGesture = function (e) {
      if (started) return unlisten();
      if (e && e.target && e.target.closest && e.target.closest('audio')) return; // the player handles its own tap
      tryPlay().catch(function () {});
    };
    tryPlay().catch(function () { showHint(); listen(); });
    return;
  }

  if (frame) {
    var kind = frame.dataset.ap;
    if (off) { frame.src = frame.src.replace(/([?&])autoplay=1&?/, '$1').replace(/[?&]$/, ''); return; }
    onGesture = function () {
      if (started) return;
      started = true; unlisten(); hideHint();
      if (kind === 'yt') {
        try { frame.contentWindow.postMessage(JSON.stringify({ event: 'command', func: 'playVideo', args: [] }), '*'); } catch (e) {}
      } else {
        var s = frame.src; frame.src = s; // reload with autoplay now that the page has a user gesture
      }
    };
    // We cannot read whether an embed really started, so hint briefly and start on the first gesture.
    setTimeout(showHint, 1200);
    listen();
    // A pause inside a YouTube embed is reported via postMessage when the JS API is on.
    if (kind === 'yt') {
      frame.addEventListener('load', function () { try { frame.contentWindow.postMessage(JSON.stringify({ event: 'listening', id: 'pf-yt' }), '*'); } catch (e) {} });
      window.addEventListener('message', function (e) {
        if (!/youtube(-nocookie)?\.com$/.test(new URL(e.origin).hostname)) return;
        var d; try { d = typeof e.data === 'string' ? JSON.parse(e.data) : e.data; } catch (x) { return; }
        var st = d && d.info && typeof d.info.playerState === 'number' ? d.info.playerState : null;
        if (st === 1) { started = true; hideHint(); unlisten(); remember(false); }
        else if (st === 2 && started) remember(true);
      });
    }
  }
})();

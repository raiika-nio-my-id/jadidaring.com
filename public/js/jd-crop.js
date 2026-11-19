/* Shared image crop step for every member upload. JdCrop.pick(file, kind) -> Promise<File|null>
   (null = cancelled). Client-side only: pan/zoom (drag, pinch, wheel, keys), 90° rotate, aspect presets, canvas export
   (re-encoded, so EXIF is dropped and orientation baked in). The server still validates and re-encodes everything. */
(function () {
  'use strict';
  var KINDS = {
    avatar: { title: 'Atur foto profil', circle: true, aspects: [['1:1', 1]], max: 512 },
    bg: { title: 'Atur gambar latar', aspects: [['Bebas', 0], ['16:9', 16 / 9], ['9:16', 9 / 16]], max: 1920 },
    gallery: { title: 'Atur foto', aspects: [['Bebas', 0], ['1:1', 1], ['4:3', 4 / 3]], max: 1600 },
    curhat: { title: 'Atur gambar', aspects: [['Bebas', 0], ['1:1', 1], ['4:5', 4 / 5]], max: 1600 },
    cursor: { title: 'Atur kursor', aspects: [['1:1', 1], ['Bebas', 0]], max: 128, type: 'image/png' }
  };
  var CSS = '.jdc{position:fixed;inset:0;z-index:2000;display:flex;align-items:center;justify-content:center;background:rgba(20,14,40,.55);opacity:0;transition:opacity .15s}.jdc.is-on{opacity:1}' +
    '.jdc__box{width:min(560px,94vw);max-height:94vh;display:flex;flex-direction:column;gap:10px;padding:16px;border-radius:24px;background:var(--clay-surface,#fff);color:var(--clay-ink,#2b2440);box-shadow:0 20px 60px rgba(0,0,0,.35);transform:scale(.96);transition:transform .18s}.jdc.is-on .jdc__box{transform:none}' +
    '.jdc__t{margin:0;font:800 1.1rem var(--font-display,inherit)}' +
    '.jdc__stage{position:relative;width:100%;height:min(56vh,420px);border-radius:16px;overflow:hidden;background:#1b1530;touch-action:none;cursor:grab}.jdc__stage:active{cursor:grabbing}.jdc__stage canvas{position:absolute;inset:0;width:100%;height:100%;display:block}' +
    '.jdc__h{position:absolute;width:30px;height:30px;margin:-15px 0 0 -15px;border-radius:50%;background:#fff;border:3px solid #6b4bd8;box-shadow:0 1px 6px rgba(0,0,0,.4);touch-action:none}' +
    '.jdc__row{display:flex;flex-wrap:wrap;gap:8px;align-items:center}.jdc__row input[type=range]{flex:1;min-width:120px;accent-color:#6b4bd8}' +
    '.jdc__b{min-height:44px;padding:8px 16px;border-radius:999px;border:0;font-weight:700;font-size:.95rem;font-family:inherit;background:var(--clay-lavender,#ede7ff);color:var(--clay-lavender-ink,#3b2a78);cursor:pointer;box-shadow:var(--clay-out,none)}.jdc__b[aria-pressed=true]{background:#6b4bd8;color:#fff}.jdc__b--go{background:#6b4bd8;color:#fff}' +
    '.jdc__act{display:flex;gap:10px;justify-content:flex-end}' +
    '@media(max-width:640px){.jdc{align-items:flex-end}.jdc__box{width:100%;max-height:96vh;border-radius:24px 24px 0 0;transform:translateY(24px)}.jdc__stage{height:min(52vh,420px)}.jdc__act .jdc__b{flex:1}}' +
    '@media(prefers-reduced-motion:reduce){.jdc,.jdc__box{transition:none}}';
  var styled = false;
  function inject() { if (styled) return; styled = true; var s = document.createElement('style'); s.textContent = CSS; document.head.appendChild(s); }
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text) e.textContent = text; return e; }

  function load(file) {
    if (window.createImageBitmap) {
      return createImageBitmap(file, { imageOrientation: 'from-image' }).catch(function () { return viaImg(file); });
    }
    return viaImg(file);
  }
  function viaImg(file) {
    return new Promise(function (res, rej) {
      var u = URL.createObjectURL(file), i = new Image();
      i.onload = function () { res(i); }; i.onerror = function () { rej(new Error('img')); }; i.src = u;
    });
  }

  function open(file, cfg) {
    inject();
    return load(file).then(function (bmp) {
      return new Promise(function (resolve) {
        var prev = document.activeElement;
        var iw = bmp.width || bmp.naturalWidth, ih = bmp.height || bmp.naturalHeight;
        var root = el('div', 'jdc'), box = el('div', 'jdc__box');
        root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true'); root.setAttribute('aria-label', cfg.title);
        var stage = el('div', 'jdc__stage'), cv = el('canvas'); stage.appendChild(cv);
        stage.tabIndex = 0; stage.setAttribute('aria-label', 'Area potong. Panah untuk geser, plus dan minus untuk zoom, R untuk putar.');
        var ctx = cv.getContext('2d');
        var asp = el('div', 'jdc__row'), ctl = el('div', 'jdc__row');
        var zoom = el('input'); zoom.type = 'range'; zoom.min = '0'; zoom.max = '100'; zoom.value = '0'; zoom.setAttribute('aria-label', 'Zoom');
        var rotB = el('button', 'jdc__b', '\u27f3 Putar 90\u00b0'); rotB.type = 'button';
        ctl.appendChild(zoom); ctl.appendChild(rotB);
        var act = el('div', 'jdc__act'), cancel = el('button', 'jdc__b', 'Batal'), go = el('button', 'jdc__b jdc__b--go', 'Pakai');
        cancel.type = 'button'; go.type = 'button'; act.appendChild(cancel); act.appendChild(go);
        box.appendChild(el('h2', 'jdc__t', cfg.title)); box.appendChild(stage);
        if (cfg.aspects.length > 1) box.appendChild(asp);
        box.appendChild(ctl); box.appendChild(act); root.appendChild(box); document.body.appendChild(root);
        var prevOv = document.body.style.overflow; document.body.style.overflow = 'hidden';

        var W = 0, H = 0, dpr = Math.min(2, window.devicePixelRatio || 1);
        var rot = 0, s = 1, cx = 0, cy = 0, fr = { x: 0, y: 0, w: 0, h: 0 }, ratio = cfg.aspects[0][1], minS = 1;
        var handles = [];
        function dims() { return rot % 2 ? [ih, iw] : [iw, ih]; }
        function setFrame(keepCenter) {
          var pad = 16, aw = W - pad * 2, ah = H - pad * 2, r = ratio || (dims()[0] / dims()[1]);
          var w = aw, h = w / r; if (h > ah) { h = ah; w = h * r; }
          fr = { x: (W - w) / 2, y: (H - h) / 2, w: w, h: h };
          fit(true);
        }
        function fit(reset) {
          var d = dims(); minS = Math.max(fr.w / d[0], fr.h / d[1]);
          if (reset) { s = minS; cx = W / 2; cy = H / 2; }
          clamp(); sync();
        }
        function clamp() {
          var d = dims(); if (s < minS) s = minS; if (s > minS * 8) s = minS * 8;
          var hw = d[0] * s / 2, hh = d[1] * s / 2;
          cx = Math.min(fr.x + hw, Math.max(fr.x + fr.w - hw, cx)); cy = Math.min(fr.y + hh, Math.max(fr.y + fr.h - hh, cy));
        }
        function sync() { zoom.value = String(Math.round(Math.log(s / minS) / Math.log(8) * 100)); draw(); place(); }
        function draw() {
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
          ctx.save(); ctx.translate(cx, cy); ctx.rotate(rot * Math.PI / 2); ctx.scale(s, s); ctx.drawImage(bmp, -iw / 2, -ih / 2); ctx.restore();
          ctx.save(); ctx.fillStyle = 'rgba(15,10,30,.62)'; ctx.beginPath(); ctx.rect(0, 0, W, H);
          if (cfg.circle) ctx.arc(fr.x + fr.w / 2, fr.y + fr.h / 2, Math.min(fr.w, fr.h) / 2, 0, 7); else ctx.rect(fr.x, fr.y, fr.w, fr.h);
          ctx.fill('evenodd'); ctx.restore();
          ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 2;
          if (cfg.circle) { ctx.beginPath(); ctx.arc(fr.x + fr.w / 2, fr.y + fr.h / 2, Math.min(fr.w, fr.h) / 2, 0, 7); ctx.stroke(); } else ctx.strokeRect(fr.x, fr.y, fr.w, fr.h);
        }
        function size() {
          var r = stage.getBoundingClientRect(); W = r.width; H = r.height;
          cv.width = W * dpr; cv.height = H * dpr; setFrame();
        }
        // free-aspect corner handles
        function place() {
          handles.forEach(function (h, i) { var c = h._c; h.style.left = (fr.x + (c[0] ? fr.w : 0)) + 'px'; h.style.top = (fr.y + (c[1] ? fr.h : 0)) + 'px'; h.hidden = !!ratio; });
        }
        [[0, 0], [1, 0], [0, 1], [1, 1]].forEach(function (c) {
          var h = el('div', 'jdc__h'); h._c = c; stage.appendChild(h); handles.push(h);
          h.addEventListener('pointerdown', function (e) {
            e.stopPropagation(); h.setPointerCapture(e.pointerId);
            var mv = function (ev) {
              var r = stage.getBoundingClientRect(), px = Math.min(W - 4, Math.max(4, ev.clientX - r.left)), py = Math.min(H - 4, Math.max(4, ev.clientY - r.top));
              var x0 = c[0] ? fr.x : px, x1 = c[0] ? px : fr.x + fr.w, y0 = c[1] ? fr.y : py, y1 = c[1] ? py : fr.y + fr.h;
              var nx = Math.min(x0, x1), ny = Math.min(y0, y1), nw = Math.abs(x1 - x0), nh = Math.abs(y1 - y0);
              if (nw < 40 || nh < 40) return;
              fr = { x: nx, y: ny, w: nw, h: nh }; fit(false);
            };
            var up = function () { h.removeEventListener('pointermove', mv); h.removeEventListener('pointerup', up); h.removeEventListener('pointercancel', up); };
            h.addEventListener('pointermove', mv); h.addEventListener('pointerup', up); h.addEventListener('pointercancel', up);
          });
        });
        // aspect buttons
        var abtn = cfg.aspects.map(function (a, i) {
          var b = el('button', 'jdc__b', a[0]); b.type = 'button'; b.setAttribute('aria-pressed', i === 0 ? 'true' : 'false');
          b.addEventListener('click', function () { ratio = a[1]; abtn.forEach(function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); }); setFrame(); });
          asp.appendChild(b); return b;
        });
        // pointers: drag = pan, two fingers = pinch
        var ptrs = {};
        stage.addEventListener('pointerdown', function (e) { stage.setPointerCapture(e.pointerId); ptrs[e.pointerId] = [e.clientX, e.clientY]; });
        stage.addEventListener('pointermove', function (e) {
          var p = ptrs[e.pointerId]; if (!p) return;
          var ids = Object.keys(ptrs);
          if (ids.length === 1) { cx += e.clientX - p[0]; cy += e.clientY - p[1]; }
          else if (ids.length === 2) {
            var o = ptrs[ids[0] === String(e.pointerId) ? ids[1] : ids[0]], d0 = Math.hypot(p[0] - o[0], p[1] - o[1]), d1 = Math.hypot(e.clientX - o[0], e.clientY - o[1]);
            if (d0 > 0) { var k = d1 / d0, r = stage.getBoundingClientRect(), mx = (e.clientX + o[0]) / 2 - r.left, my = (e.clientY + o[1]) / 2 - r.top; zoomAt(k, mx, my); }
          }
          ptrs[e.pointerId] = [e.clientX, e.clientY]; clamp(); sync();
        });
        var end = function (e) { delete ptrs[e.pointerId]; };
        stage.addEventListener('pointerup', end); stage.addEventListener('pointercancel', end);
        function zoomAt(k, mx, my) { var ns = Math.min(minS * 8, Math.max(minS, s * k)), f = ns / s; cx = mx - (mx - cx) * f; cy = my - (my - cy) * f; s = ns; }
        stage.addEventListener('wheel', function (e) { e.preventDefault(); var r = stage.getBoundingClientRect(); zoomAt(Math.exp(-e.deltaY * 0.0015), e.clientX - r.left, e.clientY - r.top); clamp(); sync(); }, { passive: false });
        zoom.addEventListener('input', function () { var ns = minS * Math.pow(8, zoom.value / 100); zoomAt(ns / s, fr.x + fr.w / 2, fr.y + fr.h / 2); clamp(); sync(); });
        rotB.addEventListener('click', function () { rot = (rot + 1) % 4; fit(true); });

        function finish(result) {
          document.removeEventListener('keydown', onKey, true); window.removeEventListener('resize', size);
          document.body.style.overflow = prevOv; root.classList.remove('is-on');
          setTimeout(function () { root.remove(); }, 160);
          if (bmp.close) try { bmp.close(); } catch (e) {}
          if (prev && prev.focus) try { prev.focus({ preventScroll: true }); } catch (e) {}
          resolve(result);
        }
        function apply() {
          go.disabled = true;
          var k = s, scale = Math.min(1, cfg.max / Math.max(fr.w / k, fr.h / k)) , ow = Math.max(1, Math.round(fr.w / k * scale)), oh = Math.max(1, Math.round(fr.h / k * scale));
          var oc = document.createElement('canvas'); oc.width = ow; oc.height = oh; var o = oc.getContext('2d');
          var f = ow / fr.w; o.imageSmoothingQuality = 'high';
          o.translate((cx - fr.x) * f, (cy - fr.y) * f); o.rotate(rot * Math.PI / 2); o.scale(s * f, s * f); o.drawImage(bmp, -iw / 2, -ih / 2);
          var want = cfg.type || 'image/webp';
          oc.toBlob(function (b) {
            if (b && b.type !== want && want === 'image/webp') { oc.toBlob(function (j) { done(j, 'image/jpeg', 'jpg'); }, 'image/jpeg', 0.9); return; }
            done(b, want, want === 'image/png' ? 'png' : 'webp');
          }, want, 0.9);
          function done(b, t, ext) { if (!b) { finish(null); return; } finish(new File([b], 'foto.' + ext, { type: t })); }
        }
        function onKey(e) {
          if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); finish(null); return; }
          if (e.key === 'Tab') {
            var f = Array.prototype.filter.call(root.querySelectorAll('button,input,[tabindex="0"]'), function (x) { return !x.disabled && !x.hidden; });
            var i = f.indexOf(document.activeElement);
            if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); } else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); }
            return;
          }
          if (document.activeElement !== stage) { if (e.key === 'Enter' && document.activeElement === document.body) apply(); return; }
          var st = 12, hit = true;
          if (e.key === 'ArrowLeft') cx -= st; else if (e.key === 'ArrowRight') cx += st; else if (e.key === 'ArrowUp') cy -= st; else if (e.key === 'ArrowDown') cy += st;
          else if (e.key === '+' || e.key === '=') zoomAt(1.1, fr.x + fr.w / 2, fr.y + fr.h / 2); else if (e.key === '-') zoomAt(1 / 1.1, fr.x + fr.w / 2, fr.y + fr.h / 2);
          else if (e.key === 'r' || e.key === 'R') { rot = (rot + 1) % 4; fit(true); return; } else if (e.key === 'Enter') { apply(); return; } else hit = false;
          if (hit) { e.preventDefault(); clamp(); sync(); }
        }
        cancel.addEventListener('click', function () { finish(null); });
        go.addEventListener('click', apply);
        root.addEventListener('pointerdown', function (e) { if (e.target === root) finish(null); });
        document.addEventListener('keydown', onKey, true); window.addEventListener('resize', size);
        requestAnimationFrame(function () { root.classList.add('is-on'); size(); go.focus(); });
      });
    });
  }

  window.JdCrop = {
    /* GIFs and unreadable files pass through untouched (cropping would drop the animation / nothing to show). */
    pick: function (file, kind) {
      var cfg = KINDS[kind] || KINDS.gallery;
      if (!file || !/^image\/(jpeg|png|webp)$/.test(file.type)) return Promise.resolve(file);
      return open(file, cfg).catch(function () { return file; });
    }
  };
})();

/* /admin panel: instant press feedback, skeleton on in-panel navigation, busy buttons on submit,
   confirm dialogs (optional typed confirmation), toasts, and lazy blocks (GA chart). No secrets here. */
(function () {
  'use strict';
  var body = function () { return document.querySelector('[data-adm-body]'); };

  /* Press states: pointerdown adds .is-pressed so the press shows before the browser's :active on slow taps. */
  var PRESS = '.adm-tab,.adm-chip,.adm-btn,.adm-stat,.clay-btn';
  document.addEventListener('pointerdown', function (e) {
    var el = e.target.closest && e.target.closest(PRESS);
    if (el) el.classList.add('is-pressed');
  }, { passive: true });
  ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (t) {
    document.addEventListener(t, function () {
      document.querySelectorAll('.is-pressed').forEach(function (n) { setTimeout(function () { n.classList.remove('is-pressed'); }, 90); });
    }, { passive: true, capture: true });
  });

  /* Keep the current tab visible in the horizontally scrolling tab bar (phones). */
  var cur = document.querySelector('.adm-tab[aria-current="page"]');
  if (cur && cur.parentNode.scrollWidth > cur.parentNode.clientWidth) {
    cur.parentNode.scrollLeft = Math.max(0, cur.offsetLeft - (cur.parentNode.clientWidth - cur.offsetWidth) / 2);
  }

  /* Skeleton on navigation inside the panel (tabs, chips, rows, pager). */
  function loading(link) {
    var b = body();
    if (!b) return;
    b.classList.add('is-loading');
    b.classList.toggle('keep-sub', !!(link && link.classList.contains('adm-chip') && link.closest('.adm-sub')));
    if (link && link.classList.contains('adm-tab')) {
      document.querySelectorAll('.adm-tab[aria-current]').forEach(function (t) { t.removeAttribute('aria-current'); });
      link.setAttribute('aria-current', 'page');
    }
    /* filter chips switch at once too (the page reloads; pageshow puts them back on Back) */
    if (link && link.classList.contains('adm-chip') && link.parentNode) {
      Array.prototype.forEach.call(link.parentNode.querySelectorAll(':scope > .adm-chip[aria-current]'), function (t) { t.dataset.wasCurrent = t.getAttribute('aria-current'); t.removeAttribute('aria-current'); });
      link.dataset.wasCurrent = link.getAttribute('aria-current') || '';
      link.setAttribute('aria-current', 'page');
    }
  }
  document.addEventListener('click', function (e) {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var a = e.target.closest && e.target.closest('a[href]');
    if (!a || a.target === '_blank' || a.hasAttribute('download') || a.hasAttribute('data-no-skel')) return;
    var url;
    try { url = new URL(a.href, location.href); } catch (x) { return; }
    if (url.origin !== location.origin || !/^\/admin(\/|$)/.test(url.pathname) || /\/ekspor$/.test(url.pathname) || /^\/admin\/backup\/.+/.test(url.pathname)) return;
    if (url.pathname === location.pathname && url.search === location.search && url.hash) return;
    loading(a);
  });
  /* Clickable table rows */
  document.addEventListener('click', function (e) {
    var tr = e.target.closest && e.target.closest('tr[data-href]');
    if (!tr || e.target.closest('a,button,form,input,select,textarea')) return;
    loading(null);
    location.href = tr.getAttribute('data-href');
  });

  /* Filters that submit on change */
  document.addEventListener('change', function (e) {
    var el = e.target;
    if (el.matches && el.matches('[data-autosubmit]') && el.form) {
      loading(null);
      el.form.requestSubmit ? el.form.requestSubmit() : el.form.submit();
    }
  });

  /* Confirm dialog */
  var dlg = document.querySelector('[data-adm-dialog]');
  function ask(form, submitter) {
    if (!dlg || typeof dlg.showModal !== 'function') {
      return window.confirm(form.getAttribute('data-confirm')) ? (form.dataset.confirmed = '1', form.requestSubmit ? form.requestSubmit(submitter) : form.submit()) : null;
    }
    var need = form.getAttribute('data-confirm-type') || '';
    dlg.querySelector('[data-adm-dlg-title]').textContent = form.getAttribute('data-confirm-title') || 'Yakin?';
    dlg.querySelector('[data-adm-dlg-msg]').textContent = form.getAttribute('data-confirm');
    var wrap = dlg.querySelector('[data-adm-dlg-typewrap]');
    var input = dlg.querySelector('[data-adm-dlg-type]');
    var ok = dlg.querySelector('[data-adm-dlg-ok]');
    ok.textContent = form.getAttribute('data-confirm-ok') || 'Ya, lanjutkan';
    ok.className = 'adm-btn ' + (form.hasAttribute('data-confirm-safe') ? 'adm-btn--primary' : 'adm-btn--danger');
    wrap.hidden = need === '';
    dlg.querySelector('[data-adm-dlg-need]').textContent = need;
    input.value = '';
    ok.disabled = need !== '';
    input.oninput = function () { ok.disabled = input.value.trim() !== need; };
    dlg.onclose = function () {
      if (dlg.returnValue !== 'ok') return;
      if (need !== '') {
        var hidden = form.querySelector('input[name="confirm"]');
        if (!hidden) { hidden = document.createElement('input'); hidden.type = 'hidden'; hidden.name = 'confirm'; form.appendChild(hidden); }
        hidden.value = input.value.trim();
      }
      form.dataset.confirmed = '1';
      if (form.requestSubmit) { form.requestSubmit(submitter && submitter.form === form ? submitter : undefined); } else { form.submit(); }
    };
    dlg.returnValue = '';
    dlg.showModal();
    setTimeout(function () { (need !== '' ? input : ok).focus(); }, 30);
  }
  if (dlg) {
    dlg.querySelector('[data-adm-dlg-cancel]').addEventListener('click', function () { dlg.close('cancel'); });
    dlg.querySelector('form').addEventListener('submit', function (e) { e.preventDefault(); if (!dlg.querySelector('[data-adm-dlg-ok]').disabled) dlg.close('ok'); });
  }

  /* Busy state on submit (and confirm gate) */
  document.addEventListener('submit', function (e) {
    var form = e.target;
    if (form.closest('[data-adm-dialog]')) return;
    if (form.hasAttribute('data-confirm') && form.dataset.confirmed !== '1') {
      e.preventDefault();
      ask(form, e.submitter);
      return;
    }
    delete form.dataset.confirmed;
    var btn = e.submitter || form.querySelector('button[type=submit],button:not([type])');
    if (form.dataset.busy === '1') { e.preventDefault(); return; }
    form.dataset.busy = '1';
    if (btn) { btn.classList.add('is-busy'); btn.setAttribute('aria-busy', 'true'); }
    if ((form.method || 'get').toLowerCase() === 'get') loading(null);
  }, false);

  /* Toast */
  var toast = document.querySelector('[data-adm-toast]');
  function show(msg, err) {
    if (!toast || !msg) return;
    toast.textContent = msg;
    toast.classList.toggle('is-error', !!err);
    toast.classList.add('is-on');
    clearTimeout(show.t);
    show.t = setTimeout(function () { toast.classList.remove('is-on'); }, err ? 7000 : 4500);
  }
  if (toast && toast.textContent.trim() !== '') { requestAnimationFrame(function () { show(toast.textContent.trim(), toast.hasAttribute('data-error')); }); }
  if (toast) toast.addEventListener('click', function () { toast.classList.remove('is-on'); });

  /* Lazy blocks (GA chart): render after first paint, keep the skeleton until then. */
  document.querySelectorAll('[data-adm-lazy]').forEach(function (box) {
    fetch(box.getAttribute('data-adm-lazy'), { credentials: 'same-origin', headers: { 'X-Requested-With': 'fetch', Accept: 'text/html' } })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.text(); })
      .then(function (html) { box.innerHTML = html; })
      .catch(function () { box.innerHTML = '<p class="adm-muted">Grafik gagal dimuat. <a href="' + location.pathname + '">Muat ulang</a>.</p>'; });
  });

  /* bfcache: never come back to a page stuck in loading/busy. */
  window.addEventListener('pageshow', function () {
    var b = body();
    if (b) b.classList.remove('is-loading', 'keep-sub');
    document.querySelectorAll('.adm-chip[data-was-current]').forEach(function (t) {
      if (t.dataset.wasCurrent) t.setAttribute('aria-current', t.dataset.wasCurrent); else t.removeAttribute('aria-current');
      delete t.dataset.wasCurrent;
    });
    document.querySelectorAll('.is-busy').forEach(function (n) { n.classList.remove('is-busy'); n.removeAttribute('aria-busy'); });
    document.querySelectorAll('form[data-busy]').forEach(function (f) { delete f.dataset.busy; });
  });
})();

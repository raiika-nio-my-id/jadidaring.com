(function () {
  var K = 'jd:news-list';
  var path = location.pathname;
  var isArticle = /^\/berita\/[^/]+\/[^/]+/.test(path);
  var store = window.sessionStorage;

  if (!isArticle) {
    // Listing: remember the exact URL + scroll when a card is opened; restore on return.
    document.addEventListener('click', function (e) {
      var card = e.target.closest && e.target.closest('a.news-card');
      if (!card) return;
      try { store.setItem(K, JSON.stringify({ url: location.pathname + location.search, y: window.scrollY })); } catch (x) {}
    });
    /* Only a back/forward return restores the saved position. A fresh visit (nav click, link, reload of a new entry) starts at the top. */
    var navType = function () { try { return performance.getEntriesByType('navigation')[0].type; } catch (x) { return ''; } };
    var restore = function (force) {
      if (force !== true && navType() !== 'back_forward') { try { store.removeItem(K); } catch (x) {} return; }
      try {
        var s = JSON.parse(store.getItem(K) || 'null');
        if (s && s.url === location.pathname + location.search && s.y > 0) { window.scrollTo(0, s.y); }
        store.removeItem(K);
      } catch (x) {}
    };
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
    window.addEventListener('load', function () { restore(); });
    window.addEventListener('pageshow', function (e) { if (e.persisted) restore(true); });
    return;
  }

  var back = document.querySelector('[data-news-back]');
  if (!back) return;
  var saved = null;
  try { saved = JSON.parse(store.getItem(K) || 'null'); } catch (x) {}
  if (saved && saved.url) back.setAttribute('href', saved.url);

  back.addEventListener('click', function (e) {
    var ref = document.referrer, fromList = false;
    try {
      var u = new URL(ref);
      fromList = u.origin === location.origin && /^\/berita(\/[^/]+)?\/?$/.test(u.pathname) || (u.origin === location.origin && u.pathname === '/');
    } catch (x) {}
    if (fromList && history.length > 1) { e.preventDefault(); history.back(); }
  });
})();

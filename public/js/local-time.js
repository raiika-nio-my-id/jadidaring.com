(function () {
  var ID = { 'Asia/Jakarta': 'WIB', 'Asia/Pontianak': 'WIB', 'Asia/Makassar': 'WITA', 'Asia/Jayapura': 'WIT' };
  var tz, abbr = null;
  try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone; } catch (e) { return; }
  if (!tz) return;
  abbr = ID[tz] || null;
  function fmt(d, wd) {
    var o = { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: tz };
    var p = {}, f = new Intl.DateTimeFormat('id-ID', o).formatToParts(d);
    f.forEach(function (x) { p[x.type] = x.value; });
    var zn = abbr;
    if (!zn) {
      var z = new Intl.DateTimeFormat('id-ID', { timeZone: tz, timeZoneName: 'short' }).formatToParts(d);
      z.forEach(function (x) { if (x.type === 'timeZoneName') zn = x.value; });
    }
    var s = p.day + ' ' + p.month + ' ' + p.year + ', ' + p.hour + '.' + p.minute + ' ' + zn;
    if (wd) s = new Intl.DateTimeFormat('id-ID', { weekday: 'long', timeZone: tz }).format(d) + ', ' + s;
    return s;
  }
  var els = document.querySelectorAll('time[data-jd-time]');
  for (var i = 0; i < els.length; i++) {
    var el = els[i], d = new Date(el.getAttribute('datetime'));
    if (isNaN(d)) continue;
    var mode = el.getAttribute('data-jd-time'), s = fmt(d, mode === 'wd');
    if (mode === 'title') { el.title = s; continue; }
    var t = el.querySelector('[data-jd-t]') || el;
    t.textContent = s;
  }
})();

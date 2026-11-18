(function () {
  var f = document.getElementById('member-frame');
  if (!f) return;
  var min = +f.dataset.min || 320, max = +f.dataset.max || 2400;
  // Only accept a plain number from this exact iframe window; everything else is ignored.
  window.addEventListener('message', function (e) {
    if (e.source !== f.contentWindow) return;
    var d = e.data;
    if (!d || typeof d !== 'object' || typeof d.jdFrameHeight !== 'number' || !isFinite(d.jdFrameHeight)) return;
    f.style.height = Math.max(min, Math.min(max, Math.ceil(d.jdFrameHeight))) + 'px';
  });
})();

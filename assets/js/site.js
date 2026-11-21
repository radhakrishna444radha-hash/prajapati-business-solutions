(function () {
  var header = document.querySelector('.site-header');
  var toggle = document.querySelector('.nav-toggle');
  var nav = document.getElementById('site-nav');
  var year = document.getElementById('year');
  if (year) year.textContent = new Date().getFullYear();
  if (!header || !toggle || !nav) return;

  function isOpen() { return nav.classList.contains('open'); }
  function setOpen(open, returnFocus) {
    nav.classList.toggle('open', open);
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (!open && returnFocus) toggle.focus();
  }

  toggle.addEventListener('click', function () { setOpen(!isOpen(), false); });
  nav.addEventListener('click', function (e) {
    if (e.target.closest && e.target.closest('a')) setOpen(false, false);
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && isOpen()) setOpen(false, true);
  });
  document.addEventListener('click', function (e) {
    if (isOpen() && !header.contains(e.target)) setOpen(false, false);
  });
  window.addEventListener('pageshow', function () { setOpen(false, false); });

  // Reset to a closed menu whenever the layout switches between mobile and desktop.
  if (window.matchMedia) {
    var mq = window.matchMedia('(min-width: 900px)');
    var reset = function () { setOpen(false, false); };
    if (mq.addEventListener) mq.addEventListener('change', reset);
    else if (mq.addListener) mq.addListener(reset);
  }
})();

// Visor d'imatges i prova de colors
(function () {
  var visor = document.querySelector('.visor');
  if (visor && visor.showModal) {
    var img = visor.querySelector('img');
    var peu = visor.querySelector('figcaption');
    var orig = visor.querySelector('.orig');
    var grup = [], idx = 0;

    function mostra(i) {
      idx = (i + grup.length) % grup.length;
      var a = grup[idx];
      img.src = a.getAttribute('href');
      img.alt = a.dataset.peu || '';
      peu.textContent = (a.dataset.peu || '') + (grup.length > 1 ? '  (' + (idx + 1) + '/' + grup.length + ')' : '');
      orig.href = a.dataset.original || a.getAttribute('href');
    }

    document.addEventListener('click', function (e) {
      var a = e.target.closest('a[data-original]');
      if (!a) return;
      e.preventDefault();
      var llista = a.closest('ul');
      grup = llista ? Array.prototype.slice.call(llista.querySelectorAll('a[data-original]')) : [a];
      mostra(grup.indexOf(a));
      visor.showModal();
    });
    visor.querySelector('.ant').addEventListener('click', function () { mostra(idx - 1); });
    visor.querySelector('.seg').addEventListener('click', function () { mostra(idx + 1); });
    visor.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowLeft') mostra(idx - 1);
      if (e.key === 'ArrowRight') mostra(idx + 1);
    });
    visor.addEventListener('click', function (e) { if (e.target === visor) visor.close(); });
    var x0 = null;
    visor.addEventListener('touchstart', function (e) { x0 = e.touches[0].clientX; }, { passive: true });
    visor.addEventListener('touchend', function (e) {
      if (x0 === null) return;
      var dx = e.changedTouches[0].clientX - x0;
      if (Math.abs(dx) > 50) mostra(idx + (dx < 0 ? 1 : -1));
      x0 = null;
    });
  }

  // Carrussels: fletxes, punts i teclat (el lliscament el fa el navegador)
  document.querySelectorAll('.carrussel').forEach(function (c) {
    var pista = c.querySelector('.pistes');
    var items = pista.children;
    var ant = c.querySelector('.ant'), seg = c.querySelector('.seg');
    var punts = c.querySelectorAll('.punts button');
    var tira = c.classList.contains('tira');
    function pas() { return items.length > 1 ? items[1].offsetLeft - items[0].offsetLeft : pista.clientWidth; }
    function actual() { return Math.round(pista.scrollLeft / pista.clientWidth); }
    function estat() {
      var i = actual();
      punts.forEach(function (p, k) { p.setAttribute('aria-current', k === i ? 'true' : 'false'); });
      if (ant) ant.hidden = pista.scrollLeft <= 2;
      if (seg) seg.hidden = pista.scrollLeft + pista.clientWidth >= pista.scrollWidth - 2;
    }
    function ves(d) {
      if (tira) pista.scrollBy({ left: d * pista.clientWidth * 0.8 });
      else pista.scrollTo({ left: (actual() + d) * pista.clientWidth });
    }
    if (ant) ant.addEventListener('click', function () { ves(-1); });
    if (seg) seg.addEventListener('click', function () { ves(1); });
    punts.forEach(function (p, k) { p.addEventListener('click', function () { pista.scrollTo({ left: k * pista.clientWidth }); }); });
    pista.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowLeft') { e.preventDefault(); ves(-1); }
      if (e.key === 'ArrowRight') { e.preventDefault(); ves(1); }
    });
    var t; pista.addEventListener('scroll', function () { clearTimeout(t); t = setTimeout(estat, 60); }, { passive: true });
    window.addEventListener('resize', estat);
    pista.querySelectorAll('img').forEach(function (im) { if (!im.complete) im.addEventListener('load', estat); });
    window.addEventListener('load', estat);
    estat();

    // Portada: passa sola a la imatge següent cada 5 segons, com al Wix
    // (s'atura mentre es toca amb el dit i quan la pestanya no es veu)
    if (c.classList.contains('portada') && items.length > 1) {
      var aturat = false, rellotge = null;
      function endavant() {
        if (aturat || document.hidden) return;
        var i = (actual() + 1) % items.length;
        pista.scrollTo({ left: i * pista.clientWidth });
      }
      function engega() { clearInterval(rellotge); rellotge = setInterval(endavant, 5000); }
      pista.addEventListener('touchstart', function () { aturat = true; }, { passive: true });
      pista.addEventListener('touchend', function () { aturat = false; engega(); }, { passive: true });
      punts.forEach(function (p) { p.addEventListener('click', engega); });
      engega();
    }
  });

})();

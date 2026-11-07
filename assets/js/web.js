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

  // Carrussels: fletxes, comptador i teclat (el lliscament el fa el navegador)
  document.querySelectorAll('.carrussel').forEach(function (c) {
    var pista = c.querySelector('.pistes');
    var items = pista.children;
    var compta = c.querySelector('.compta');
    var ant = c.querySelector('.ant'), seg = c.querySelector('.seg');
    function pas() { return items.length > 1 ? items[1].offsetLeft - items[0].offsetLeft : pista.clientWidth; }
    function actual() { return Math.round(pista.scrollLeft / pas()); }
    function estat() {
      var i = actual();
      if (compta) compta.textContent = (i + 1) + '/' + items.length;
      ant.disabled = pista.scrollLeft <= 2;
      seg.disabled = pista.scrollLeft + pista.clientWidth >= pista.scrollWidth - 2;
    }
    function ves(d) {
      var visibles = Math.max(1, Math.floor(pista.clientWidth / pas()));
      pista.scrollTo({ left: (actual() + d * visibles) * pas() });
    }
    ant.addEventListener('click', function () { ves(-1); });
    seg.addEventListener('click', function () { ves(1); });
    pista.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowLeft') { e.preventDefault(); ves(-1); }
      if (e.key === 'ArrowRight') { e.preventDefault(); ves(1); }
    });
    var t; pista.addEventListener('scroll', function () { clearTimeout(t); t = setTimeout(estat, 60); }, { passive: true });
    window.addEventListener('resize', estat);
    estat();
  });

  var prova = document.querySelector('.prova-colors');
  if (prova) {
    var html = document.documentElement;
    function marca() {
      prova.querySelectorAll('button').forEach(function (b) {
        b.setAttribute('aria-pressed', b.dataset.posa === html.dataset.tema ? 'true' : 'false');
      });
    }
    prova.addEventListener('click', function (e) {
      var b = e.target.closest('button');
      if (!b) return;
      html.dataset.tema = b.dataset.posa;
      try { localStorage.setItem('tema', b.dataset.posa); } catch (err) {}
      marca();
    });
    marca();
  }
})();

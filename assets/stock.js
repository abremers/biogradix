// Biogradix — estado de inventario en vivo (Fase: stock dinamico).
//
// El HTML se publica con el estado conocido al momento del deploy. Este script
// consulta /api/stock y solo corrige lo que haya cambiado desde entonces:
//
//   · Tarjetas de la portada  -> se atenuan y cambian "Explorar" por "Agotado".
//   · Pagina de producto      -> oculta precio y boton de compra, y muestra el
//                                aviso con "Avisarme cuando llegue".
//
// Un producto se marca disponible solo si la API lo dice explicitamente. Si la
// peticion falla, no se toca nada: queda el estado estatico del HTML.
(function () {
  'use strict';

  var WA = 'https://wa.me/15553471798';

  function lang() {
    try { return localStorage.getItem('bgLang') === 'en' ? 'en' : 'es'; } catch (e) { return 'es'; }
  }

  function txt(key, fallbackEs, fallbackEn) {
    var dict = window.TRANSLATIONS && window.TRANSLATIONS[key];
    var l = lang();
    if (dict) {
      // index.html usa { es, en }; las paginas de producto usan { es: {...} }
      if (typeof dict === 'object' && typeof dict[l] === 'string') return dict[l];
    }
    if (window.TRANSLATIONS && window.TRANSLATIONS[l] && typeof window.TRANSLATIONS[l][key] === 'string') {
      return window.TRANSLATIONS[l][key];
    }
    return l === 'en' ? fallbackEn : fallbackEs;
  }

  // ── Tarjetas de la portada ────────────────────────────────────────────
  function aplicarTarjetas(skus) {
    var celdas = document.querySelectorAll('.product-cell[data-sku]');
    for (var i = 0; i < celdas.length; i++) {
      var celda = celdas[i];
      var sku = celda.getAttribute('data-sku');
      if (!sku || !(sku in skus)) continue;
      var agotado = skus[sku] === false;
      celda.classList.toggle('is-soldout', agotado);
      var cta = celda.querySelector('.cell-cta');
      if (!cta) continue;
      if (agotado) {
        cta.setAttribute('data-i18n', 'cta-soldout');
        cta.textContent = txt('cta-soldout', 'Agotado', 'Out of stock');
      } else if (cta.getAttribute('data-i18n') === 'cta-soldout') {
        cta.setAttribute('data-i18n', 'cta-explore');
        cta.innerHTML = txt('cta-explore', 'Explorar →', 'Explore →');
      }
    }
  }

  // ── Pagina de producto ────────────────────────────────────────────────
  // Hay dos tipos de pagina:
  //   1. Con ambos estados en el marcado (data-stock-view): solo se alterna
  //      cual se muestra. Es el caso de los productos que nacieron agotados.
  //   2. Solo con el bloque de venta: si el SKU esta agotado hay que ocultar
  //      el precio, cambiar el boton y anadir el aviso.
  function aplicarProducto(skus) {
    var boton = document.querySelector('button[data-sku]');
    if (!boton) return;                       // pagina sin venta: nada que hacer
    var sku = boton.getAttribute('data-sku');
    if (!(sku in skus)) return;               // sin dato: se respeta el HTML

    var hayStock = skus[sku] === true;
    var vistasAgotado = document.querySelectorAll('[data-stock-view="soldout"]');
    var vistasVenta = document.querySelectorAll('[data-stock-view="instock"]');
    if (vistasAgotado.length || vistasVenta.length) {
      for (var a = 0; a < vistasAgotado.length; a++) vistasAgotado[a].hidden = hayStock;
      for (var v = 0; v < vistasVenta.length; v++) {
        vistasVenta[v].hidden = !hayStock;
        // Estos bloques llevan la clase .reveal, que arranca en opacity 0 y
        // solo se anima cuando el IntersectionObserver los ve. Estaban
        // ocultos cuando el observador arranco, asi que se marcan a mano
        // al mostrarlos: si no, quedarian presentes pero invisibles.
        if (hayStock) vistasVenta[v].classList.add('up');
      }
      return;
    }

    if (hayStock) return;                     // disponible: no hay nada que cambiar

    var fila = boton.parentNode;

    // 1. Precio fuera: no se puede comprar.
    var precio = document.querySelector('[data-i18n="buy-price"]');
    if (precio) precio.hidden = true;

    // 2. Comprar -> Avisarme cuando llegue (mismo estilo que las paginas agotadas).
    var aviso = document.createElement('a');
    aviso.href = WA + '?text=' + encodeURIComponent(
      lang() === 'en'
        ? 'Hi, I would like to be notified when this product is available again.'
        : 'Hola, quiero que me avisen cuando este producto vuelva a estar disponible.'
    );
    aviso.target = '_blank';
    aviso.rel = 'noopener';
    aviso.setAttribute('data-i18n', 'soldout-notify');
    aviso.textContent = txt('soldout-notify', 'Avisarme cuando llegue', 'Notify me when available');
    aviso.style.cssText = 'font-size:11px;letter-spacing:2px;text-transform:uppercase;color:var(--ink);' +
      'background:transparent;border:1px solid var(--rule);padding:13px 27px;border-radius:2px;' +
      'text-decoration:none;white-space:nowrap;';
    fila.replaceChild(aviso, boton);

    // Las paginas agotadas estaticas muestran solo "Avisarme cuando llegue" y el
    // quiz. Se quita la consulta por WhatsApp para dejar la misma fila: con tres
    // botones no cabe a 1440px y se parte en dos lineas.
    var consulta = fila.querySelector('a[data-i18n="hero-wa"]');
    if (consulta) fila.removeChild(consulta);
    fila.style.flexWrap = 'wrap';

    // 3. Aviso arriba del titulo, igual que en las paginas agotadas.
    var ancla = document.querySelector('.product-image-col');
    var columna = ancla && ancla.parentNode ? ancla.parentNode.firstElementChild : null;
    var primero = columna ? columna.firstElementChild : null;
    if (primero && !document.querySelector('[data-i18n="soldout-badge"]')) {
      var banner = document.createElement('div');
      banner.style.cssText = 'display:inline-flex;align-items:center;gap:10px;border:1px solid var(--rule);' +
        'background:var(--stone);padding:10px 18px;border-radius:2px;margin-bottom:28px;align-self:flex-start;';
      var punto = document.createElement('span');
      punto.style.cssText = 'width:6px;height:6px;border-radius:50%;background:var(--ink-faint);';
      var etiqueta = document.createElement('span');
      etiqueta.style.cssText = 'font-size:10px;letter-spacing:2px;text-transform:uppercase;color:var(--ink);font-weight:500;';
      etiqueta.setAttribute('data-i18n', 'soldout-badge');
      etiqueta.textContent = txt('soldout-badge', 'Temporalmente agotado', 'Temporarily out of stock');
      banner.appendChild(punto);
      banner.appendChild(etiqueta);
      columna.insertBefore(banner, primero);
    }
  }

  fetch('/api/stock', { headers: { 'Accept': 'application/json' } })
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (data) {
      if (!data || !data.skus) return;        // sin datos: se respeta el HTML
      aplicarTarjetas(data.skus);
      aplicarProducto(data.skus);
    })
    .catch(function () { /* sin red: se respeta el HTML */ });
})();

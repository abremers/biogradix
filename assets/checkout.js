// Biogradix checkout helper (Fase 4: transferencia SPEI).
// A page opts in by including this file and adding a button that carries the
// page-to-product mapping in its data-sku attribute:
//
//   <button type="button" onclick="startCheckout(this)" data-sku="bpc-157"
//           data-i18n="buy-cta" style="...">Comprar</button>
//
// The data-sku attribute is the single source of the page-to-SKU mapping, so
// pages can be renamed or rebranded without code changes here. The button now
// navigates to the on-site checkout page (/checkout), where the visitor fills
// in shipping details and gets SPEI transfer instructions. The server
// revalidates sku, price and stock, so no product data lives here. WhatsApp
// remains the fallback only when a button has no sku (override per button
// with data-fallback).
(function () {
  'use strict';

  var DEFAULT_FALLBACK = 'https://wa.me/15553471798';

  window.startCheckout = function (btn) {
    if (!btn) return;

    var sku = btn.dataset.sku;
    var fallback = btn.dataset.fallback || DEFAULT_FALLBACK;
    if (!sku) { window.location.href = fallback; return; }

    window.location.href = '/checkout?sku=' + encodeURIComponent(sku);
  };
})();

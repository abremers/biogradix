// Biogradix checkout helper (Phase 1).
// A page opts in by including this file and adding a button that carries the
// page-to-product mapping in its data-sku attribute:
//
//   <button type="button" onclick="startCheckout(this)" data-sku="bpc-157"
//           data-i18n="buy-cta" style="...">Comprar</button>
//
// The data-sku attribute is the single source of the page-to-SKU mapping, so
// pages can be renamed or rebranded without code changes here. On any error
// (checkout not enabled yet, out of stock, network) the visitor is sent to
// WhatsApp instead (override per button with data-fallback).
(function () {
  'use strict';

  var LOADING = { es: 'Un momento...', en: 'One moment...' };
  var DEFAULT_FALLBACK = 'https://wa.me/15553471798';

  window.startCheckout = function (btn) {
    if (!btn || btn.dataset.busy === '1') return;

    var sku = btn.dataset.sku;
    var fallback = btn.dataset.fallback || DEFAULT_FALLBACK;
    if (!sku) { window.location.href = fallback; return; }

    var lang = 'es';
    try { if (localStorage.getItem('bgLang') === 'en') lang = 'en'; } catch (e) {}

    btn.dataset.busy = '1';
    var original = btn.textContent;
    btn.textContent = LOADING[lang];
    btn.style.opacity = '.6';

    fetch('/api/create-checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sku: sku, quantity: 1, lang: lang })
    })
      .then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (data) {
          return { ok: r.ok, data: data };
        });
      })
      .then(function (result) {
        if (result.ok && result.data.url) { window.location.href = result.data.url; return; }
        window.location.href = fallback;
      })
      .catch(function () {
        window.location.href = fallback;
      })
      .finally(function () {
        btn.dataset.busy = '';
        btn.textContent = original;
        btn.style.opacity = '';
      });
  };
})();

-- ============================================================================
-- BIOGRADIX — ALTA DE LOS 4 PRODUCTOS SIN FILA EN EL CATALOGO
--
-- Estos productos ya tienen pagina publicada pero nunca se dieron de alta en
-- biogradix_products, asi que no se podian vender ni aparecian en /api/stock.
--
-- Se insertan con stock = 0 a proposito: el sitio los seguira mostrando como
-- "Temporalmente agotado" hasta que registres existencias desde el panel
-- (Inventario -> Ajustar, motivo Restock). En cuanto el stock sea mayor que 0,
-- la pagina muestra sola el precio y el boton Comprar.
--
-- Precio y presentacion: USD 299.00 por pack de 20 parches, igual que los 5
-- productos ya publicados.
--
-- Ejecutar en: Supabase -> SQL Editor. Es idempotente (on conflict do nothing).
-- ============================================================================

insert into public.biogradix_products
  (sku, name, peptide, unit_label, price, currency, stock, active, product_url)
values
  ('glutation',             'Glutatión',            'Glutatión',            'Pack de 20 parches', 299.00, 'USD', 0, true, '/producto-glutation'),
  ('timosina-alfa-1',       'Timosina Alfa-1',      'Timosina Alfa-1',      'Pack de 20 parches', 299.00, 'USD', 0, true, '/producto-timosina-alfa-1'),
  ('pt-141',                'PT-141',               'PT-141',               'Pack de 20 parches', 299.00, 'USD', 0, true, '/producto-pt-141'),
  ('cjc-1295-ipamorelin',   'CJC-1295 / Ipamorelin','CJC-1295 / Ipamorelin','Pack de 20 parches', 299.00, 'USD', 0, true, '/producto-cjc-1295-ipamorelin')
on conflict (sku) do nothing;

-- Comprobacion: deben aparecer 9 productos, 4 de ellos con stock 0.
select sku, name, price, currency, stock, active
from public.biogradix_products
order by stock desc, sku asc;
